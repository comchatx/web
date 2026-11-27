import { Refused, Unopened, type Backend, type HeldMessage, type Me, type Opened } from "./backend.js";
import { takesMessages, type Blocked, type Box } from "./box-state.js";
import { afterEnd, type Next } from "./reconnect.js";
import { closed, CX_SAYS, cxSays, DROPPED_NOTICE, EMPTY, earlier, letGo, NEWEST, NOTICE_MS, placeWord, readCxSays, readPlace, reconnected, reduce, sent, stamped, waitsForBox, withdrawn, working, type Item, type StreamEvent, type StreamState } from "./stream-model.js";
import { DIALOG_ANSWER, isOptionCard, type Dialog, type DialogAnswer } from "../shared/dialog.js";

/** `idle` holds no stream — the box asleep, or the stream let go until an open answers; `held` waits for the person after the store and the box disagreed. */
export type Connection = "idle" | "open" | "reconnecting" | "held";

/** What the person asked of the box from cx's card, until it answers. */
export type Asked = "compact" | "close";

export type VisitPorts = {
  readonly backend: Pick<Backend, "open" | "close" | "restart" | "stream" | "command" | "history" | "takeBack">;
  /** Reads the account, `/me`; undefined when the platform could not be reached. A lapsed session is renewed from its 401. */
  readonly account: () => Promise<Me | undefined>;
  /** Reads what the page shows beside the account — sources, models, keys, the card's choices — and draws it as it arrives. */
  readonly glance: () => void;
  /** The box said the board's files changed at a turn's end, or a life began, whose board may differ from the one read: the board is read again. */
  readonly board?: (said: "board" | "life") => void;
  readonly now: () => number;
  /** Runs `then` after `ms`; the return cancels it. */
  readonly later: (ms: number, then: () => void) => () => void;
  /** The page's kept place across a reload: the word `placeWord` writes, per origin. */
  readonly place: { readonly read: () => string | null; readonly write: (word: string) => void };
  /** Something the page draws changed; `stream` when only what the stream holds did. */
  readonly changed: (what: "stream" | "all") => void;
  /** The box was heard after the page last held it as not awake: what only a running box answers can be asked now. */
  readonly heard: () => void;
  /** An awake box announced another life than the one drawn: a new conversation, whose state is its own. */
  readonly life?: () => void;
  /** The box ended an entry of the account's list: what the list says of it can be read now. */
  readonly spoke?: () => void;
  /** Awaited before each message goes out, so it follows what the person chose before sending it. */
  readonly beforeSend?: () => Promise<void>;
  /** Messages that did not reach the session go back where they were written; `asked` when the person took one back themselves. */
  readonly giveBack: (messages: readonly string[], how?: "asked", why?: string) => void;
  /** The line that says the box dropped the person's default, `<provider>/<model>`, which pi no longer finds. */
  readonly droppedLine?: (model: string) => string;
};

/** How often a page asks again while it waits on the platform: unreachable, or the person's computer still being set up. */
export const WAIT_MS = 10_000;
/** How often a page under the balance floor reads the account again, to see credit arrive. */
export const FLOOR_MS = 30_000;
/** How long a message waits for the box it opened to be heard, so its answer is seen arriving; after it, the message goes regardless. */
export const LIFE_WAIT_MS = 3_000;
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
/** An echo pi will take as a prompt, not hold behind an answer. */
const unqueued = (item: Extract<Item, { kind: "user" }>): Item => {
  const { queued: _, ...rest } = item;
  return rest;
};
/** An echo that is the page's to send again: the box's moment for it went with the queue pi gave back. */
const unstamped = (item: Extract<Item, { kind: "user" }>): Item => {
  const { sentAt: _, ...rest } = item;
  return rest;
};
/** An echo pi is done with though it records no message for it. */
const read = (item: Extract<Item, { kind: "user" }>): Item => {
  const { sentAt: _, queued: __, ...rest } = item;
  return { ...rest, pending: false };
};

/**
 * A box between states — stopping after its sleep, or another open of it under way — is asked again after these waits, the last one from
 * then on. The start has no bound: it lasts until the platform answers something else.
 */
export const OPEN_RETRIES = [1_000, 2_000, 5_000] as const;
/**
 * How long a message the box took counts pi at work before the box's turn frame says so. pi's turn begins as it takes the prompt, so the
 * frame follows at once; a message that starts no turn — an extension's command — frees cx's actions after this.
 */
export const TURN_WAIT_MS = 3_000;
/**
 * How long a Stop pi answered waits for the box to say the turn is over. pi's abort ends the turn at once and the frame follows; a turn
 * still said to run after this is pi at work, and the Stop is over: what it would have kept goes on as any message does.
 */
export const STOP_WAIT_MS = 5_000;
/** A message of the person's on its way to pi; `with` holds the ones a Stop kept behind it, handed to pi by steer, in order, once it is sent. */
type Waiting = { readonly key: string; readonly message: string; readonly with?: readonly Waiting[] };
const alone = (one: Waiting): Waiting => ({ key: one.key, message: one.message });
const together = (kept: readonly Waiting[]): readonly Waiting[] => (kept.length <= 1 ? kept : [{ ...kept[0]!, with: kept.slice(1) }]);
const each = (one: Waiting): readonly Waiting[] => [alone(one), ...(one.with ?? []).map(alone)];
type Echo = Extract<Item, { kind: "user" }>;
/** The platform's word that it keeps a message for a box that was not there: what it keeps it as. */
const heldOf = (body: unknown): HeldMessage | undefined => {
  const held = record(body) ? body["held"] : undefined;
  return record(held) && typeof held["id"] === "string" ? held as HeldMessage : undefined;
};
/** The page's id for a message it sends to a box that was not there: the platform keeps it under it, so it can be taken back while the box starts. */
const holdId = (): string => Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, "0")).join("");
/** pi's own word that it did not do what a command asked. */
const refused = (body: unknown): boolean => record(body) && body["success"] === false;
const BETWEEN_STATES: readonly string[] = ["lease_held", "machine_busy", "box_closing"];
const failedOpen: Opened = { kind: "failed", step: "box", status: undefined, reason: undefined };
type Timer = "look" | "connect" | "turn";

/**
 * One visit's life with the person's computer, free of the page it is drawn on. The page opens on what the store holds and nothing else:
 * the box opens for the first message sent, or for Switch on in a card, and for nothing that only reads. A page goes on the same
 * whether or not anyone looks at it; shown again with no stream, as after its box was heard asleep, it reads the account once and
 * takes what it has not seen from its place in one read.
 */
export class Visit {
  me: Me | undefined;
  unreachable = false;
  stream: StreamState = EMPTY;
  connection: Connection = "idle";
  box: Box = "unknown";
  /** What the last open came to, while it was not an open. */
  blocked: Blocked | undefined;
  /** When the box will sleep if nothing happens, as the box last said; the page holds no threshold of its own. */
  sleepDueAt: number | undefined;
  /** The box said it is going to sleep now. */
  closing = false;
  asked: Asked | undefined;
  /** What the person last asked from cx's card and did not complete. */
  failed: Asked | undefined;
  #listening: object | undefined;
  #closeStream: (() => void) | undefined;
  readonly #timers = new Map<Timer, () => void>();
  /** The wait that lets each timed dialog and each notice go, by its id. */
  readonly #closing = new Map<string, () => void>();
  /**
   * Option cards answered while the computer was off, by their asking: pi went with the computer, so the answer waits in this tab for
   * the card its package asks again once the computer is on, and goes to it.
   */
  readonly #heldAnswers = new Map<string, { readonly id: string; readonly answer: DialogAnswer; readonly done: (taken: boolean) => void }>();
  #looking: Promise<void> | undefined;
  #opening: Promise<boolean> | undefined;
  /** An open of the page's own succeeded and its box has not been heard since. */
  #openedUnheard = false;
  /** The box is drawn starting because the account said a start is under way, not because this page asked one. */
  #startRead = false;
  /** A switch-off waiting on the platform's answer, ended as soon as the box is heard asleep. */
  readonly #slept: (() => void)[] = [];
  /** The stream was let go since the page last heard the box awake: the box may have slept meanwhile, so nothing goes to it unopened. */
  #unheardSince = false;
  /** The last stream broke without saying the box slept, and no connection has reached the box since. */
  #broken = false;
  #failures = 0;
  #kept: string | undefined;
  #resend: string | undefined;
  readonly #queue: Waiting[] = [];
  /** The platform's id for each message it keeps for the box, by the key the page drew it under. */
  readonly #heldIds = new Map<string, string>();
  /** The platform's ids of the messages that ended without pi taking them whose words the page gave back, and the ones it has taken out of the platform since. */
  readonly #givenBack = new Set<string>();
  readonly #cleared = new Set<string>();
  /** How many compactions the page has heard end. */
  #compactions = 0;
  /** How many compactions the page has heard end: cx's card reads the context again after each. */
  get compactions(): number { return this.#compactions; }
  /** Messages on their way to a box that was not there: the platform answers each once the open it asked is answered. */
  readonly #holding = new Set<Promise<void>>();
  /** The keys of those messages. */
  readonly #posting = new Set<string>();
  /** The platform opened a box last heard on for a message: heard again, it is heard as one that came up. */
  #reheard = false;
  /** The messages the last Stop kept for pi, until the run that reads them is over: a Stop pressed meanwhile is the second one. */
  #saved: readonly string[] = [];
  /** A Stop was pressed while one was in flight. */
  #again = false;
  /** A Stop waits on the message going out: nothing more of it is sent. */
  #cut = false;
  /**
   * A Stop took hold and pi did not answer for its queue: pi holds messages no run reads, and is asked again as the next message goes.
   * `back` when a second Stop meant them for the message box.
   */
  #unclear: "keep" | "back" | undefined;
  #delivering: Promise<void> | undefined;
  /** A message's commands are with the box and not yet answered: until they are, nobody can say whether pi or the page holds it. */
  #going: Promise<void> | undefined;
  /** The message, with what it carries, whose commands are with the box: it is no longer the page's alone. */
  #passing: Waiting | undefined;
  /** Stops and messages being taken back, one behind another: nothing goes out until the page knows which messages are its own again. */
  #serial: Promise<void> | undefined;
  /** Waits on pi's tidying being over. */
  #tidied: (() => void)[] = [];
  /** A message the box took and whose turn the box has not yet named. */
  #awaitingTurn = false;
  #lifeWaiters: readonly { readonly done: () => void }[] = [];
  /** The part of the life before the one the view holds is being read, or its last read failed: its line stands until one answers or the life ends. */
  loadingEarlier = false;
  #readingEarlier = false;
  /** A stream has said something to this page — an event, or its end: until then the view has nothing of the conversation to draw. */
  answered = false;
  #answered: (() => void)[] = [];
  /** The questions waiting being let go, unanswered, for a message from the chat's box or a Stop. */
  #releasing: Promise<void> | undefined;
  /** A Stop in flight, until it has said where each waiting message goes. */
  #stopping: Promise<void> | undefined;
  /** Waits on the stream saying no turn runs, or on the box going to sleep. */
  #turnOver: (() => void)[] = [];
  /** Waits on a box not heard since its stream was let go being read again. */
  #reread: ((heard: boolean) => void)[] = [];

  constructor(readonly ports: VisitPorts) {}

  /** The box awake, heard since its stream was last let go, and not going to sleep: a message goes straight to it. */
  get #usable(): boolean { return this.box === "awake" && !this.closing && !this.#unheardSince && !this.#broken; }

  /** The box answers now: the card draws the model pi says it is on, not the last one recorded in the conversation. */
  get awake(): boolean { return this.#usable; }
  /** The box awake and not going to sleep, but not heard since its stream was let go. */
  get unheard(): boolean { return this.box === "awake" && !this.closing && this.#unheardSince; }

  /** A turn runs on a box that is awake. */
  get running(): boolean { return this.#usable && working(this.stream); }

  /**
   * A Stop has something to stop: a turn that runs, a Stop in flight, or the messages a Stop kept on their way to the run that reads
   * them. What stops cx is offered through all three, so a second Stop is never pressed on nothing.
   */
  get stoppable(): boolean {
    if (this.running || this.#stopping !== undefined) return true;
    const onTheirWay = this.#going !== undefined || this.#awaitingTurn || this.#queue.some((one) => this.#saved.includes(one.key));
    return onTheirWay && this.#saved.some((key) => this.#waits(key));
  }

  /**
   * A hand-over is under way: from the Stop that begins it until the run it starts has read every message the Stop kept. The run it
   * ends and the run it starts are both a turn with those messages still drawn as waiting, and what the page says of a message that
   * waits behind a step is not said of them.
   */
  get handing(): boolean { return this.#stopping !== undefined || this.#saved.some((key) => this.#waits(key)); }

  /**
   * pi is at work for the person: from the moment a message is sent — waiting, opening the box or on its way — until its turn ends, and
   * while any turn runs. What cx offers and what its clicks do both read this, so nothing is offered that the box would refuse as busy.
   */
  get atWork(): boolean { return this.#queue.length > 0 || this.#delivering !== undefined || this.#awaitingTurn || working(this.stream) || this.stream.tidying || this.stream.items.some((item) => item.kind === "user" && item.pending && item.held === true); }

  /** An open can be asked for now: the person signed in, their computer set up and the balance above the open floor. */
  get canOpen(): boolean {
    const me = this.me;
    return me?.kind === "signed_in" && takesMessages(me.box, me.balance);
  }

  /** A start the page read from the account: when it began is not known. */
  get startUntimed(): boolean { return this.box === "waking" && this.#startRead; }

  /** Whether cx's card may ask the box for anything now: awake, pi not at work and nothing asked of it already. */
  get idle(): boolean { return this.#usable && this.asked === undefined && !this.atWork; }


  /**
   * The start of a visit: the account read once, then the stream from the page's place and what the page shows beside it, together —
   * the stream waits on nothing but the account. A page goes on the same whether or not anyone looks at it.
   */
  look(): Promise<void> {
    return this.#looking ??= this.#look(false).finally(() => { this.#looking = undefined; });
  }

  /**
   * The page's own look again: the account read, and a stream only to a box not known to sleep. A reconnect reads the account alone;
   * what the page shows beside it was read when the page was opened or shown again.
   */
  #lookAgain(glance = true): void {
    this.#looking ??= this.#look(true, glance).finally(() => { this.#looking = undefined; });
  }

  async #look(again: boolean, glance = true): Promise<void> {
    this.#cancel("look");
    const under = this.me?.kind === "signed_in" && this.me.balance?.can_open === false;
    // What the page drew as kept before it asked: the account's answer says which of them the platform still keeps.
    const kept = [...this.#heldIds].filter(([key]) => !this.#posting.has(key));
    const knew = [...this.#heldIds];
    const me = await this.ports.account();
    this.me = me ?? this.me;
    this.unreachable = me === undefined;
    const signedIn = me?.kind === "signed_in" ? me : undefined;
    // The platform's word on the Machine decides where the page holds no stream and opens nothing: one it says is off is asleep,
    // whatever the last stream's end left the page to guess. A stream the page holds is the box's own word, and outranks it.
    const quiet = this.#listening === undefined && this.#opening === undefined;
    if (quiet && signedIn?.machine === "off" && (this.box !== "asleep" || this.connection === "reconnecting")) this.#asleep();
    // A start the platform says is under way — begun before a reload, in another tab, or for a message — is a start here too, until the
    // account says the computer is on or off: a box that answers it is not there yet is not drawn asleep for it.
    // A read that failed says nothing of it: the last answer stands until a true one ends it.
    if (quiet && me !== undefined) this.#startRead = signedIn?.machine === "starting" && this.box !== "awake";
    // Heard alive, with the account saying on and holding nothing for it, the start this reader owned has ended.
    if (this.box === "awake" && signedIn?.machine === "on" && (signedIn.held ?? []).length === 0) this.#startRead = false;
    if (quiet && this.#startRead) this.box = "waking";
    // Credit that arrives under a refusal for the balance ends it: the computer is off, and can be switched on.
    if (under && signedIn !== undefined && signedIn.balance?.can_open !== false && this.blocked?.kind === "refused" && this.blocked.reason === "balance") this.blocked = undefined;
    // Nothing asked of a box not yet read outlasts a platform out of reach.
    if (me === undefined) for (const read of this.#reread.splice(0)) read(false);
    if (signedIn !== undefined && glance) this.ports.glance();
    if (me === undefined || signedIn?.box === "pending") this.#after("look", WAIT_MS, () => this.#lookAgain());
    else if (signedIn?.balance?.can_open === false) this.#after("look", FLOOR_MS, () => this.#lookAgain());
    if (me?.kind === "signed_out") { this.#stop(); this.connection = "idle"; }
    const ready = signedIn !== undefined && signedIn.box !== "pending";
    if (signedIn?.held !== undefined) this.#drawHeld(signedIn.held, kept, knew);
    // A message the page draws as held may end without pi taking it, and nothing but the account's answer says so: the account is read
    // while the page draws one, whatever this answer, read before a later one was kept, listed. While cx works the account is read too:
    // each call of a turn is charged as it ends, and the balance beside the chat follows.
    if ((this.#heldIds.size > 0 || working(this.stream)) && !this.#timers.has("look")) this.#after("look", WAIT_MS, () => this.#lookAgain());
    const resend = this.#resend;
    this.#resend = undefined;
    if (resend !== undefined) { if (ready) void this.send(resend); else this.ports.giveBack([resend]); }
    // Read again while the start goes on, the page listens once: the stream brings what is stored, and its end says the box is not up yet.
    if (this.#startRead && again) { if (!this.#timers.has("look")) this.#after("look", WAIT_MS, () => this.#lookAgain()); this.ports.changed("all"); return; }
    // A box known asleep has nothing to say until it is opened: waiting on the platform or on credit reads the account and nothing more.
    // One the platform says has started — opened elsewhere, or drawn asleep from a failed open — is listened to.
    const asleep = again && this.box === "asleep" && !(quiet && signedIn?.machine === "on");
    if (ready && !asleep && this.#listening === undefined && this.connection !== "held") { this.connect(); return; }
    this.ports.changed("all");
  }

  /**
   * The messages the platform keeps for the box, drawn waiting once each: a reload or another tab reads them from there. One the page drew
   * as kept that the platform no longer lists was taken back in another tab, or taken by the box, whose record then lands as its own: no
   * longer drawn waiting. One that ended without pi taking it comes back to the message box as unsent, with pi's words, once, and the page
   * takes it out of the platform; one on its way there comes back with its own answer.
   */
  #drawHeld(held: readonly HeldMessage[], kept: readonly (readonly [string, string])[], knew: readonly (readonly [string, string])[]): void {
    for (const one of held) {
      if (one.refused === undefined) continue;
      const key = [...this.#heldIds].find(([, id]) => id === one.id)?.[0];
      if (key !== undefined && this.#posting.has(key)) continue;
      if (!this.#givenBack.has(one.id)) {
        this.#givenBack.add(one.id);
        if (key !== undefined) { this.#heldIds.delete(key); this.stream = withdrawn(this.stream, key); }
        this.ports.giveBack([one.message], undefined, one.refused === "" ? undefined : one.refused);
      }
      this.#clearGiven(one.id);
    }
    const listed = new Set(held.map((one) => one.id));
    for (const [key, id] of kept) {
      if (listed.has(id) || this.#heldIds.get(key) !== id || this.#posting.has(key)) continue;
      this.#heldIds.delete(key);
      this.stream = withdrawn(this.stream, key);
    }
    // One the page held as the read began and has since seen handed — its own message still drawn, as sent or as pi's record of it — is
    // not drawn again from that read. One whose words came back, its send unanswered, is still the platform's, and the read draws it.
    const handed = knew.filter(([key]) => this.stream.items.some((item) => item.kind === "user" && (item.key === key || item.echo === key)));
    const drawn = new Set([...this.#heldIds.values(), ...handed.map(([, id]) => id)]);
    for (const one of held) {
      if (drawn.has(one.id) || one.refused !== undefined) continue;
      const key = `sent-${this.stream.sent}`;
      this.stream = waitsForBox(sent(this.stream, one.message, one.at), key);
      this.#heldIds.set(key, one.id);
    }
  }

  /** A message whose words came back takes its entry out of the platform, once unless the platform could not be reached. */
  #clearGiven(id: string): void {
    if (this.#cleared.has(id)) return;
    this.#cleared.add(id);
    void this.ports.backend.takeBack(id).catch(() => { this.#cleared.delete(id); });
  }

  /** A message the platform refused while the session was being renewed: sent once more when the page is back and knows its account. */
  resend(message: string): void { this.#resend = message; }

  /**
   * A new connection from the cursor: the view's life and its place in it; with no place yet, the newest part of the kept life, or of the
   * one the platform names.
   */
  connect(): void {
    this.#stop();
    this.#cancel("connect");
    const me = this.me;
    if (this.stream.cursor === undefined && me?.kind === "signed_in") {
      const epoch = readPlace(this.ports.place.read(), me.account);
      if (epoch !== undefined) { this.stream = { ...this.stream, epoch, cursor: `${epoch}:${NEWEST}` }; this.#kept = epoch; }
    }
    this.stream = reconnected(this.stream);
    this.#untidy();
    if (this.connection !== "reconnecting") this.connection = "open";
    const token = {};
    this.#listening = token;
    this.#closeStream = this.ports.backend.stream(this.stream.cursor ?? NEWEST, (event) => { if (this.#listening === token) this.receive(event); }, () => { if (this.#listening === token) this.#ended(undefined); });
    this.ports.changed("all");
  }

  /**
   * The part of the life stored before the one the view holds, put before it: asked when the person reaches the top, one read at a time.
   * One that failed is a wait, not an error: its line stays, and the person's next arrival at the top asks again.
   */
  async loadEarlier(): Promise<void> {
    const { epoch, from } = this.stream;
    if (this.#readingEarlier || !this.stream.earlier || epoch === undefined || from === undefined) return;
    this.#readingEarlier = this.loadingEarlier = true;
    this.ports.changed("stream");
    const answer = await this.ports.backend.history(epoch, from).catch(() => undefined);
    this.#readingEarlier = false;
    if (answer === undefined) return;
    this.loadingEarlier = false;
    this.stream = earlier(this.stream, answer);
    this.ports.changed("stream");
  }

  /** The bound on the wait for a taken message's turn: the box names it, or after this long none began. */
  #armTurn(): void {
    this.#after("turn", TURN_WAIT_MS, () => {
      this.#awaitingTurn = false;
      // No turn was named: none began, so nothing waits on its end.
      if (!working(this.stream)) this.#rested();
      this.ports.changed("all");
    });
  }

  /** The stream let go: what the box says meanwhile is heard once the page connects again. */
  #letGo(): void {
    this.#stop();
    if (this.box === "awake") this.#unheardSince = true;
    if (this.connection !== "held") this.connection = "idle";
  }

  /**
   * The page is looked at again. One that holds its stream heard everything meanwhile; one that holds none, as after its box was heard
   * asleep, looks again as it did when opened, so a box another page or device woke meanwhile is heard.
   */
  show(): void {
    if (this.connection !== "held" && this.#listening === undefined) void this.look();
  }

  /** The person asks to connect again after the store and the box disagreed. */
  retry(): void {
    this.#failures = 0;
    this.connection = "reconnecting";
    this.connect();
  }

  /**
   * Sends what the person wrote: shown at once, and sent once the box is awake — opened for it first when it is not. Messages go in the
   * order written; pi takes one that arrives while a turn runs as steering, and runs one that arrives when it is idle. One that does not
   * reach the session goes back to the composer; when the box would not open, every message waiting on it does.
   */
  send(message: string, releases = false): Promise<void> {
    // A message from the chat's box lets every question waiting go first, unanswered, in the order asked, and goes after them; one whose
    // answer did not reach the box stays, and the message goes all the same.
    if (releases && (this.stream.dialogs.some((one) => !isOptionCard(one)) || this.#releasing !== undefined)) return this.#release().then(() => this.send(message));
    const key = `sent-${this.stream.sent}`;
    this.stream = sent(this.stream, message, this.ports.now());
    this.#queue.push({ key, message });
    // While the platform opens the box for a message, one sent after it goes to the platform too, which keeps it behind the first.
    if (this.#holding.size > 0) this.#hold({ key, message });
    this.ports.changed("all");
    return this.#delivering ??= this.#deliver();
  }

  async #deliver(): Promise<void> {
    for (;;) {
      // Read after the wait: a Stop puts the messages it keeps ahead of the rest.
      await this.#settled();
      const next = this.#queue[0];
      // Cleared in the same step that finds the queue empty, so a message sent after it starts the next delivery; drawn when that leaves
      // pi no longer at work, as a message given back does, since `atWork` reads it.
      if (next === undefined) { this.#delivering = undefined; if (!this.atWork) this.ports.changed("all"); return; }
      // A box that is not there is the platform's to open: it keeps each message for it, so the page asks no open of its own. An open
      // that answered covers every message waiting behind it, heard or not.
      if (!this.#usable && !this.#openedUnheard) {
        if (!this.canOpen) { this.#giveBack(this.#queue.splice(0)); continue; }
        await this.ports.beforeSend?.();
        await this.#settled();
        if (this.#unsettled || this.#queue[0] !== next) continue;
        if (this.box === "asleep" || this.closing) this.box = "waking";
        this.blocked = undefined;
        for (const one of [...this.#queue]) this.#hold(one);
        this.ports.changed("all");
        while (this.#holding.size > 0) await Promise.all([...this.#holding]);
        continue;
      }
      await this.ports.beforeSend?.();
      // The computer opening or a choice settling takes time, in which the person may take this message back or stop cx: read again.
      await this.#settled();
      // Read in the step that sends: a Stop pressed since the wait ended waits on what is going, and must find it said so.
      if (this.#unsettled || this.#queue[0] !== next) continue;
      let gone!: () => void;
      this.#going = new Promise<void>((resolve) => { gone = resolve; });
      this.#passing = next;
      await this.#pass(next);
      this.#passing = undefined;
      this.#going = undefined;
      gone();
    }
  }

  /** The queue holds `others` where it held `one`; one a Stop or a take-back already took out of it leaves nothing in its place. */
  #instead(one: Waiting, others: readonly Waiting[]): void {
    const at = this.#queue.indexOf(one);
    if (at >= 0) this.#queue.splice(at, 1, ...others);
  }

  /** The messages named that the platform keeps, asked back from it: the ones it gave back, which are the page's again. */
  async #fromPlatform(keys: readonly string[]): Promise<ReadonlySet<string>> {
    const back = new Set<string>();
    for (const key of keys) {
      const id = this.#heldIds.get(key);
      if (id === undefined || await this.ports.backend.takeBack(id).catch(() => undefined) !== "back") continue;
      this.#heldIds.delete(key);
      back.add(key);
    }
    return back;
  }

  /** One message to a box that was not there, beside the others the platform is asked to keep: nothing waits on its answer but its own. */
  #hold(one: Waiting): void {
    if (this.#posting.has(one.key)) return;
    this.#posting.add(one.key);
    this.#heldIds.set(one.key, holdId());
    const post: Promise<void> = this.#pass(one).finally(() => { this.#holding.delete(post); this.#posting.delete(one.key); });
    this.#holding.add(post);
  }

  /**
   * One message's commands to the box, with what it carries; a Stop pressed under them has the next one not sent, and the message stays the
   * page's. The first goes first: a run another hand starts while the rest are handed over reads pi's queue then, so nothing of theirs may
   * be in it ahead of the first.
   */
  async #pass(next: Waiting): Promise<void> {
    if (this.#unclear !== undefined && (await this.#reclaimed())) return;
    const rest = next.with ?? [];
    if (this.#cut) return;
    let why: string | undefined;
    let unopened: Unopened["opened"] | undefined;
    let ended = false;
    const hold = this.#posting.has(next.key) ? this.#heldIds.get(next.key) : undefined;
    const answer = await this.ports.backend.command({ type: "prompt", message: next.message, streamingBehavior: "steer" }, hold).then((body) => ({ body }), (error: unknown) => {
      why = error instanceof Refused ? error.words : undefined;
      unopened = error instanceof Unopened ? error.opened : undefined;
      ended = error instanceof Refused || (error instanceof Unopened && error.opened.kind === "refused");
      return undefined;
    });
    // pi's refusal of a message the platform kept, or an open it will not make, leaves the message listed as ended: its words come back
    // here, and its entry is taken out.
    if (ended && hold !== undefined) { this.#givenBack.add(hold); this.#clearGiven(hold); }
    const held = answer === undefined ? undefined : heldOf(answer.body);
    // Answered by pi, or not kept, it is no longer the platform's to give back.
    if (held === undefined) this.#heldIds.delete(next.key);
    // The platform answers a message it was asked to keep only once it has opened the box: pi's answer when the box took it, or its own.
    if (answer !== undefined && this.#posting.has(next.key)) this.#openedForMessage();
    if (held !== undefined) { this.#keptForBox(next, held); return; }
    // No answer to a message sent to a box that was not there is the platform out of reach, as an open of the page's own with none.
    if (answer === undefined && unopened === undefined && why === undefined && this.#posting.has(next.key)) unopened = { kind: "failed", step: "box", status: undefined, reason: undefined };
    if (unopened !== undefined) {
      this.#unopened(unopened);
      // Every message waiting on the box goes back, as when an open of the page's own was not made; one on its way to the platform comes back with its own answer.
      const back = this.#queue.filter((one) => one === next || !this.#posting.has(one.key));
      for (const one of back) this.#queue.splice(this.#queue.indexOf(one), 1);
      this.#saved = [];
      this.#giveBack(back, why);
      return;
    }
    if (answer === undefined) {
      // The ones beside it were never sent: they go on together, as a Stop's first one does.
      this.#instead(next, together(rest));
      this.#saved = [];
      this.#giveBack([alone(next)], why);
      // A message the platform refused may be one an account that owes cannot start: the account is read again, and its floor closes the composer.
      this.#lookAgain(false);
      return;
    }
    this.#awaitingTurn = true;
    this.#armTurn();
    const handled = this.#took(next.key, answer.body);
    this.ports.changed("stream");
    // It starts no run: the next of the ones beside it does, with the rest, as a Stop's first one does.
    if (handled && rest.length > 0) {
      this.#instead(next, together(rest));
      return;
    }
    const { left } = rest.length === 0 ? { left: [] } : await this.#handOver(rest);
    this.#instead(next, left);
  }

  /** The box the platform opened for a message, listened to as after an open of the page's own. */
  #openedForMessage(): void {
    if (this.#usable) return;
    // A box last heard on, opened again and heard, is heard as one that came up: it may be another start of it.
    this.#reheard = this.box === "awake";
    this.closing = false;
    this.#openedUnheard = true;
    this.connect();
  }

  /** A message the platform keeps, the box not having taken it yet: drawn waiting until pi's record of it lands, and taken back from the platform. */
  #keptForBox(next: Waiting, held: HeldMessage): void {
    const at = this.#queue.indexOf(next);
    // One the person took back while it was on its way is no longer drawn.
    if (at === -1) return;
    this.#heldIds.set(next.key, held.id);
    this.stream = waitsForBox(this.stream, next.key);
    this.#queue.splice(at, 1);
    // Only the account's answer says how it ends: the page reads it, as it does while it lists a message it keeps.
    if (!this.#timers.has("look")) this.#after("look", WAIT_MS, () => this.#lookAgain());
    this.ports.changed("all");
  }

  /** The open the platform asked for a message was not made: drawn as an open of the page's own that ended so, and the message goes back. */
  #unopened(opened: Unopened["opened"]): void {
    const was = this.box === "waking" || this.closing ? "asleep" : this.box;
    const unanswered = opened.kind === "failed" && opened.status === undefined;
    if (unanswered) { if (this.box !== "awake") this.box = was; this.unreachable = true; } else { this.blocked = opened; this.box = "asleep"; }
    if (unanswered || (opened.kind === "refused" && opened.reason === "balance")) this.#lookAgain(false);
  }

  /**
   * What pi's answer makes of a message it took, whichever command carried it, and whether an extension took it as its command. Such a
   * message is done and pi records nothing for it: it is read now, since no record will make it so, and no Stop takes it for one to
   * hand back or send again. Any other is known from here by the box's moment for it, which is what pi's record of it carries.
   */
  #took(key: string, body: unknown): boolean {
    const handled = record(body) && record(body["data"]) && body["data"]["disposition"] === "handled";
    const sentAt = record(body) ? body["sentAt"] : undefined;
    if (handled) this.stream = { ...this.stream, items: this.stream.items.map((item) => (item.kind === "user" && item.pending && item.key === key ? read(item) : item)) };
    else if (typeof sentAt === "number" && Number.isFinite(sentAt)) this.stream = stamped(this.stream, key, sentAt);
    return handled;
  }

  /**
   * Hands pi the messages that follow the prompt, by steer and in order. pi's steering queue is drained whole at its next step — the image
   * sets its steering mode to `all` — so they are read together, with the prompt when they reach pi before its first model call. The first
   * one pi does not take, and every one behind it, is returned: they go as any message does, in their order. One an extension took as its
   * command is done at its answer.
   */
  async #handOver(rest: readonly Waiting[]): Promise<{ readonly left: readonly Waiting[] }> {
    let at = 0;
    for (; at < rest.length && !this.#cut; at++) {
      const one = rest[at]!;
      const answer = await this.ports.backend.command({ type: "steer", message: one.message }).then((body) => ({ body }), () => undefined);
      if (answer === undefined || refused(answer.body)) break;
      // Read at this answer, and drawn so now: the next one's answer may be long in coming.
      if (this.#took(one.key, answer.body)) this.ports.changed("stream");
    }
    this.ports.changed("stream");
    return { left: rest.slice(at) };
  }

  /** The page still holds the message `key`: none of its commands has gone to the box, so taking it back asks the box nothing. */
  /** Whether a take-back of the waiting message `key` was asked and came too late: the box or pi had it, so no ✕ is drawn on it again. */
  late(key: string): boolean { return this.#late.has(key); }
  readonly #late = new Set<string>();

  holds(key: string): boolean { return this.#queue.some((one) => one !== this.#passing && !this.#posting.has(one.key) && each(one).some((held) => held.key === key)); }

  #waits(key: string): boolean { return this.stream.items.some((item) => item.kind === "user" && item.pending && item.key === key); }

  /** The echoes the box took and pi has not recorded, in the order sent. */
  #held(): readonly Echo[] { return this.stream.items.filter((item): item is Echo => item.kind === "user" && item.pending && item.sentAt !== undefined); }

  /**
   * pi's whole queue asked back, the only way it gives a message up: how many it gave, every one it could have held when its answer does
   * not say, and undefined when it did not answer — the queue is then still pi's. It is asked only while it holds nothing but this
   * page's messages; otherwise it is left to pi, as if pi had not answered.
   */
  async #clear(): Promise<number | undefined> {
    if (!(await this.#onlyMine())) return undefined;
    const answer = await this.ports.backend.command({ type: "clear_queue" }).then((body) => ({ body }), () => undefined);
    if (answer === undefined || refused(answer.body)) return undefined;
    const data = record(answer.body) ? answer.body["data"] : undefined;
    return record(data) && Array.isArray(data["steering"]) && Array.isArray(data["followUp"]) ? data["steering"].length + data["followUp"].length : Infinity;
  }

  /**
   * pi's queue is the session's and holds what every page on the conversation sent, but pi names no sender: it is this page's alone
   * only while it holds no more messages than this page has with pi unrecorded. pi not saying counts as another page's being there.
   */
  async #onlyMine(): Promise<boolean> {
    const answer = await this.ports.backend.command({ type: "get_state" }).catch(() => undefined);
    const data = record(answer) && !refused(answer) ? answer["data"] : undefined;
    const count = record(data) ? data["pendingMessageCount"] : undefined;
    return typeof count === "number" && count <= this.#held().length;
  }

  /** pi takes from the front of its queue, so what it gives back are the last it was sent. */
  #lastOf(given: number): readonly Echo[] {
    const held = this.#held();
    return held.slice(Math.max(0, held.length - given));
  }

  /** The waiting messages named go to the head of the page's queue as one: pi at rest takes the first as a prompt, so its answer is drawn below it, and the rest are steered after it, each in its own bubble. */
  #keep(keys: ReadonlySet<string>): void {
    const [first, ...rest] = this.stream.items.flatMap((item): Waiting[] => (item.kind === "user" && item.pending && keys.has(item.key) ? [{ key: item.key, message: item.text }] : []));
    if (first === undefined) return;
    this.stream = { ...this.stream, items: this.stream.items.map((item) => (item.key === first.key && item.kind === "user" ? unqueued(item) : item)) };
    this.#queue.unshift(rest.length === 0 ? first : { ...first, with: rest });
    this.#saved = [first.key, ...rest.map((one) => one.key)];
    this.ports.changed("stream");
  }

  /** Messages pi gave back while it may still be at work go on as any message does, ahead of what the page had not sent. */
  #goOn(echoes: readonly Echo[]): void {
    if (echoes.length === 0) return;
    this.stream = { ...this.stream, items: this.stream.items.map((item) => (item.kind === "user" && echoes.includes(item) ? unstamped(item) : item)) };
    this.#queue.unshift(...echoes.map((item): Waiting => ({ key: item.key, message: item.text })));
    this.ports.changed("stream");
  }

  /** The waiting messages named go back where they were written, in the order sent, as ones the person took back: a second Stop starts no run. */
  #handBack(keys: ReadonlySet<string>): void {
    const back = this.stream.items.filter((item): item is Echo => item.kind === "user" && item.pending && keys.has(item.key));
    this.#saved = [];
    if (back.length === 0) return;
    this.stream = back.reduce((held, one) => withdrawn(held, one.key), this.stream);
    this.ports.giveBack(back.map((one) => one.text), "asked");
    this.ports.changed("all");
  }

  /**
   * The queue a Stop could not ask back, asked for again: true when the messages it left go ahead of the message that was next. An
   * earlier asking may have emptied pi's queue with its answer lost, so what pi gives now does not say which it read: every message
   * the stopped run left unrecorded is taken as given, and at worst one is sent twice.
   */
  async #reclaimed(): Promise<boolean> {
    if ((await this.#clear()) === undefined) return false;
    const how = this.#unclear;
    this.#unclear = undefined;
    const keys = new Set(this.#held().map((item) => item.key));
    if (keys.size === 0) return false;
    if (how === "back") { this.#handBack(keys); return false; }
    this.#keep(keys);
    return true;
  }

  /**
   * The queue a Stop could not ask back, asked for before a switch-off: every message the stopped run left unrecorded goes back where
   * it was written, whatever pi's answer counts, since an empty queue after a lost answer is no word that pi read one; false while pi
   * does not answer.
   */
  async #takenBack(): Promise<boolean> {
    if ((await this.#clear()) === undefined) return false;
    this.#unclear = undefined;
    this.#handBack(new Set(this.#held().map((item) => item.key)));
    return true;
  }

  #giveBack(waiting: readonly Waiting[], why?: string): void {
    const messages = waiting.flatMap((one) => [one, ...(one.with ?? [])]);
    if (messages.length === 0) return;
    this.stream = messages.reduce((held, one) => withdrawn(held, one.key), this.stream);
    this.ports.giveBack(messages.map((one) => one.message), undefined, why);
    this.ports.changed("all");
  }

  /**
   * The person takes back a message cx has not read: it leaves the wait and goes back where it was written, and the others waiting stay
   * in their order. One the page has not sent yet is simply not sent. One pi holds has no command of its own, so pi's whole queue is
   * asked back with `clear_queue` and every other message is sent again, in order, as any message is. pi's loop may take a message at any
   * moment: the queue's answer says how many it gave back, and those are the last sent, so a message pi took meanwhile is neither given
   * back nor sent twice, and its record lands as it would have. While pi tidies mid-run its loop holds a message its queue still
   * names, so one pi holds is asked back only once the tidying is over. One nobody holds — pi at rest, its queue empty — goes back
   * too. One already recorded is left alone.
   */
  withdraw(key: string): Promise<void> {
    const mine = this.#queue.some((one) => each(one).some((held) => held.key === key));
    if (this.stream.tidying && !mine) return new Promise<void>((resolve) => { this.#tidied.push(resolve); }).then(() => this.withdraw(key));
    return this.#exclusive(() => this.#takeBack(key));
  }

  /** Runs behind every Stop and take-back asked before it. */
  #exclusive(act: () => Promise<void>): Promise<void> {
    const turn: Promise<void> = (this.#serial ?? Promise.resolve()).then(act, act).finally(() => {
      if (this.#serial !== turn) return;
      this.#serial = undefined;
      for (const done of this.#answered.splice(0)) done();
      this.ports.changed("all");
    });
    return this.#serial = turn;
  }

  async #takeBack(key: string): Promise<void> {
    await this.#going;
    if (!this.#waits(key)) return;
    // One the platform keeps, or is asked to keep while it opens the box, is asked back from it by the page's id: still there, it comes
    // back; already taken, it is a sent message, and a Stop is a stop.
    const id = this.#heldIds.get(key);
    if (id !== undefined) {
      const answer = await this.ports.backend.takeBack(id).catch(() => undefined);
      if (answer === "taken") this.#late.add(key);
      if (answer !== "back") return;
      this.#heldIds.delete(key);
      const at = this.#queue.findIndex((one) => one.key === key);
      if (at >= 0) this.#queue.splice(at, 1);
      this.#return(key);
      return;
    }
    const at = this.#queue.findIndex((one) => one.key === key || one.with?.some((kept) => kept.key === key) === true);
    if (at >= 0) {
      const holder = this.#queue[at]!;
      const [head, ...rest] = each(holder).filter((one) => one.key !== key);
      this.#queue.splice(at, 1, ...(head === undefined ? [] : [rest.length === 0 ? head : { ...head, with: rest }]));
      this.#return(key);
      return;
    }
    const given = await this.#clear();
    if (given === undefined) return;
    const back = this.#lastOf(given);
    if (back.length === 0) {
      if (given === 0 && this.stream.turn === false && !this.#awaitingTurn && this.#held().some((item) => item.key === key)) this.#return(key);
      else this.#late.add(key);
      return;
    }
    this.#goOn(back.filter((item) => item.key !== key));
    if (back.some((item) => item.key === key)) this.#return(key);
    else this.#late.add(key);
    this.#delivering ??= this.#deliver();
  }

  /** A waiting message back where it was written. The one behind a message that was to start cx's turn now starts it, so its answer is drawn below it. */
  #return(key: string): void {
    const item = this.stream.items.find((one) => one.key === key);
    if (item?.kind !== "user" || !item.pending) return;
    const rest = withdrawn(this.stream, key);
    const lead = item.queued === true ? undefined : rest.items.find((one) => one.kind === "user" && one.pending);
    this.stream = lead === undefined ? rest : { ...rest, items: rest.items.map((one) => (one === lead && one.kind === "user" ? unqueued(one) : one)) };
    this.ports.giveBack([item.text], "asked");
    this.ports.changed("all");
  }

  /**
   * How many times the page has found the box up: a life heard, or an open answered. A command is sent under the count of the moment;
   * an answer to one sent before the box was found up again says nothing of the box now.
   */
  get found(): number { return this.#found; }
  /** The switch-offs that wait to hear the box asleep: none once each close is answered. */
  get closesWaiting(): number { return this.#slept.length; }
  #found = 0;
  /** A command was refused for the box's state while a turn ran: the next `wake` asks the open, and the stream is left to the turn. */
  #doubted = false;

  /** A stream attached that says a turn runs: the box is up while it is heard, whatever an open answers. */
  get #heardRunning(): boolean { return this.#listening !== undefined && working(this.stream); }

  /**
   * A command sent under `found` that the box was not there to take, though the page heard it on: the next `wake` opens it, and every
   * asker shares that one open. One sent before the box was found up since is old news, and changes nothing. A stream that holds a
   * running turn is not let go — that turn's frames are the page's to hear, and what it draws of the turn stands — so the open is asked
   * of the box with the stream kept; any other is let go, and heard again once the open answers.
   */
  notThere(found: number): void {
    if (found !== this.#found || !this.#usable) return;
    if (this.#heardRunning) { this.#doubted = true; return; }
    this.#letGo();
    this.ports.changed("all");
  }

  /** Switch on, or Try again, from a card: the same open a first message makes. */
  wake(): Promise<boolean> {
    return this.#usable && !this.#doubted ? Promise.resolve(true) : this.#wake();
  }

  /**
   * The box put to sleep by the person: its own close, which it refuses while pi is at work. Messages a Stop left with pi unanswered for
   * are asked back first, and a box that still does not answer for them stays on: a close would end pi with them in its queue.
   */
  sleep(): Promise<void> {
    return this.#ask("close", async () => {
      // A box that stays on says so: the switch-off did not finish.
      if (this.#unclear !== undefined && !(await this.#takenBack())) throw new Error("messages left with pi");
      // The box ends its life before it answers its close, and the answer comes only once its closing work is done: heard asleep, it is off.
      let slept!: () => void;
      const ended = new Promise<"closed">((done) => { slept = () => done("closed"); this.#slept.push(slept); });
      const closing = this.ports.backend.close();
      closing.catch(() => undefined);
      try {
        const answer = await Promise.race([closing, ended]);
        // A close the platform stopped waiting for (its fetch ends at 300 s) runs on in a box the platform still reads on: it ends on the
        // box's sleep, or on the platform reading it off, and is drawn as switching off until then.
        if (answer === "unanswered") {
          const me = await this.ports.account().catch(() => undefined);
          if (me !== undefined) this.me = me;
          const machine = me?.kind === "signed_in" ? me.machine : undefined;
          if (machine === "on") { await ended; return; }
          if (machine === "off") { this.#asleep(); return; }
        }
        if (answer !== "closed") throw new Error(`close ${answer}`);
        this.#asleep();
      } catch (error) {
        // A close that did not end is drawn as the platform reads the computer: off, it did end; on, the close the box began is over.
        const me = await this.ports.account().catch(() => undefined);
        if (me !== undefined) this.me = me;
        const machine = me?.kind === "signed_in" ? me.machine : undefined;
        if (machine === "off") { this.#asleep(); return; }
        if (machine === "on") this.closing = false;
        throw error;
      } finally {
        const at = this.#slept.indexOf(slept);
        if (at >= 0) this.#slept.splice(at, 1);
      }
    });
  }

  /**
   * Stop and switch off, from the computer's card while cx works: the run stops as a second Stop stops it — every message cx has not
   * read goes back where it was written and no run starts for them — and the box is then put to sleep once nothing is at work. A stop
   * the box did not take leaves it on, and so does one that left messages with pi it did not answer for: the switch-off ends at the
   * stop, and they stay drawn as waiting.
   */
  async stopAndSleep(): Promise<void> {
    await this.stop("off");
    await this.#delivering;
    if (this.#unclear !== undefined) return;
    await this.sleep();
  }

  /**
   * The seller's restart, from Settings: cx's answer stopped first, as 停止并关机 stops it, then the platform's restart, which closes the
   * box and opens it again on the platform's image. The page then hears the box the restart opened. Whether it came back on: a stop
   * that left messages with pi, a box at work, or a restart that failed leaves it as it was.
   */
  async restart(): Promise<boolean> {
    if (this.stoppable) {
      await this.stop("off");
      await this.#delivering;
      if (this.#unclear !== undefined) return false;
    }
    // A stop the box did not take leaves cx at work, and a box at work is not closed.
    if (this.atWork) return false;
    if (this.#unclear !== undefined && !(await this.#takenBack())) return false;
    if (await this.ports.backend.restart().catch(() => "failed" as const) !== "restarted") return false;
    this.#asleep();
    this.ports.changed("all");
    return this.#wake();
  }

  /** pi's own `compact`, asked from cx's card: it runs the model, so it follows the person's last choice of one, as a message does. */
  compact(): Promise<void> {
    return this.#ask("compact", async () => { await this.ports.beforeSend?.(); await this.ports.backend.command({ type: "compact" }); });
  }

  async #ask(what: Asked, act: () => Promise<void>): Promise<void> {
    // A box drawn as last heard may have slept since its stream was let go: it is asked once the next connection has read it.
    if (this.unheard && this.connection !== "held" && !(await new Promise<boolean>((resolve) => { this.#reread.push(resolve); }))) return;
    if (!this.idle) return;
    this.asked = what;
    this.failed = undefined;
    this.ports.changed("all");
    const compactions = this.#compactions;
    // A compaction that ended while the Summarise was answered is what it asked for: a failure answered after it is no longer said.
    try { await act(); } catch { if (what !== "compact" || this.#compactions === compactions) this.failed = what; }
    this.asked = undefined;
    for (const done of this.#answered.splice(0)) done();
    this.ports.changed("all");
  }

  get #unsettled(): boolean { return this.asked !== undefined || this.#serial !== undefined; }

  /** Resolves once nothing asked from cx's card, no Stop and no message being taken back is in flight: a message waits behind them. */
  async #settled(): Promise<void> {
    while (this.#unsettled) await new Promise<void>((resolve) => { this.#answered.push(resolve); });
  }

  /**
   * The person's Stop, as pi documents keeping what was queued: `clear_queue`, then `abort`. Once the box has answered and its stream says
   * no turn runs, the record holds every entry the stop wrote; the messages the box took that pi's record did not take, and the ones the
   * page had not sent yet, then go before pi in the order written, each in its own bubble, with no new words: the first as a prompt, the
   * rest steered behind it, and the run that was stopped is not taken up again. One pi recorded before the stop keeps its record and gets no answer. A message sent after the
   * Stop took hold goes after them as it would have.
   *
   * A second Stop stops: pressed while the first is in flight, or while the messages it kept are on their way to pi or to the run that
   * reads them, it has no run start for them. Every message cx has not read then goes back where it was written, in the order sent.
   * `now` is a waiting message's own way to the first Stop, and never the second; `off` is a Stop that hands back at once, as the
   * second does.
   *
   * pi's queue is the page's only once pi answers for it. Not answered before the stop, it is asked for again after it; still not
   * answered, the messages stay pi's, nothing is sent again, and it is asked once more as the next message goes. A stop pi did not
   * answer after it gave its queue up leaves pi perhaps at work: what it gave back goes on as any message does. So does a stop pi
   * answered whose turn the box still says runs after `STOP_WAIT_MS`.
   */
  stop(how: "stop" | "now" | "off" = "stop"): Promise<void> {
    if (this.#stopping !== undefined) {
      if (how !== "now") this.#again = true;
      return this.#stopping;
    }
    if (how !== "now") this.#cut = true;
    this.#stopping = this.#exclusive(async () => {
      try { await this.#halt(how !== "now", how === "off"); } finally {
        this.#stopping = undefined;
        this.#again = false;
        this.#cut = false;
        this.ports.changed("all");
      }
    });
    this.ports.changed("all");
    return this.#stopping;
  }

  async #halt(stops: boolean, off = false): Promise<void> {
    // pi's abort does not end a dialog's wait: each question waiting is let go first, unanswered, and the turn is stopped after them.
    await this.#release();
    // A message whose commands are with the box is nobody's until they are answered.
    await this.#going;
    const second = stops && this.#saved.some((key) => this.#waits(key));
    const before = new Set(this.#queue.map((one) => one.key));
    const reach = this.#usable || this.#openedUnheard;
    let given = reach ? await this.#clear() : undefined;
    const aborted = reach && (await this.ports.backend.command({ type: "abort" }).then((body) => !refused(body), () => false));
    let ended = aborted;
    if (aborted) {
      given ??= await this.#clear();
      // The box says whether a turn runs as each connection reaches it: until it has said none does, on this one, its records may be on their way.
      if (this.box !== "asleep" && (this.stream.turn !== false || this.#awaitingTurn)) ended = await this.#turnEnds();
    }
    const mine = given === undefined ? [] : ended ? this.#held() : this.#lastOf(given);
    const back = second || this.#again || off;
    if (aborted && given === undefined && this.#held().length > 0) this.#unclear = back ? "back" : "keep";
    if (back) {
      // What the platform keeps goes back only once it gave it back: one the box took meanwhile is a sent message.
      const queued = this.#queue.splice(0).flatMap(each).map((one) => one.key);
      const kept = [...new Set([...queued, ...this.stream.items.flatMap((item) => (item.kind === "user" && item.pending && item.held === true ? [item.key] : []))])].filter((key) => this.#heldIds.has(key));
      const returned = await this.#fromPlatform(kept);
      this.#handBack(new Set([...mine.map((item) => item.key), ...queued.filter((key) => !this.#heldIds.has(key)), ...returned]));
      return;
    }
    if (ended) {
      const waiting = this.#queue.filter((one) => before.has(one.key));
      for (const one of waiting) this.#queue.splice(this.#queue.indexOf(one), 1);
      this.#keep(new Set([...mine.map((item) => item.key), ...waiting.flatMap(each).map((one) => one.key)]));
    } else this.#goOn(mine);
    if (this.#queue.length > 0) this.#delivering ??= this.#deliver();
  }

  /** True once the box says no turn runs, false when it still has not after `STOP_WAIT_MS`. */
  #turnEnds(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const over = (): void => { cancel(); resolve(true); };
      const cancel = this.ports.later(STOP_WAIT_MS, () => { this.#turnOver = this.#turnOver.filter((one) => one !== over); resolve(false); });
      this.#turnOver.push(over);
    });
  }

  #wake(): Promise<boolean> {
    return this.#opening ??= this.#open().finally(() => { this.#opening = undefined; this.#doubted = false; });
  }

  /**
   * One open at a time, whoever asked for it. A box between states is a start that goes on: it is asked again for as long as the
   * platform answers so. A session another ask is still opening is an open: the box answered, and pi's life says it is up. Every other answer ends the start. No answer at all is the platform out of reach: the box stays
   * as it was last heard, and the account is read until the platform answers again. An open refused for the balance has the account
   * read too, which then says the balance is under the floor. Only a box known asleep is drawn a start at once: one not read yet, or
   * last heard on and not heard since the page was shown, is drawn a start only once something says it was not on — an open for a box
   * already on answers at once, and nothing says it is switching on.
   */
  async #open(): Promise<boolean> {
    if (!this.canOpen) return false;
    this.#startRead = false;
    const was = this.box === "waking" || this.closing ? "asleep" : this.box;
    if (was === "asleep") this.box = "waking";
    if (was === "asleep" && this.failed === "close") this.failed = undefined;
    this.blocked = undefined;
    this.ports.changed("all");
    for (let attempt = 0; ; attempt++) {
      const opened = await this.ports.backend.open(() => this.#queue[0]?.message).catch(() => failedOpen);
      // A session still opening is a box that answered: pi is up when its life is heard, as after any open.
      if (opened.kind === "open" || opened.kind === "opening") {
        this.#found++;
        if (opened.kind === "open" && opened.dropped !== undefined && this.ports.droppedLine !== undefined) this.#dropped(this.ports.droppedLine(opened.dropped));
        // A box heard while the open was on its way is the one it opened.
        if (!this.#usable) {
          this.closing = false;
          // The box speaks on a connection made after it opened.
          this.#openedUnheard = true;
          this.connect();
          await this.#lifeHeard();
        }
        // A box last heard on, opened again and heard, is heard as one that came up: it may be another start of it.
        if (was === "awake" && this.#usable) this.ports.heard();
        return true;
      }
      // A status with no word was not the platform's answer: something between the page and it cut the request, and the open may still
      // be on its way, so it is asked again as one under way is, and the ask joins it. A status that never clears asks on, as no answer does.
      const cut = opened.kind === "failed" && opened.status !== undefined && opened.reason === undefined;
      // A running turn's stream says the box is up: while one is heard, what the open answers is the card's alone.
      if (cut || ((opened.kind === "refused" || opened.kind === "failed") && BETWEEN_STATES.includes(opened.reason ?? ""))) {
        if (!this.#heardRunning) this.#starting();
        await this.#pause(OPEN_RETRIES[Math.min(attempt, OPEN_RETRIES.length - 1)]!);
        continue;
      }
      if (this.#heardRunning) return false;
      const unanswered = opened.kind === "failed" && opened.status === undefined;
      if (unanswered) { if (this.box !== "awake") this.box = was; this.unreachable = true; } else { this.blocked = opened; this.box = "asleep"; }
      if (unanswered || (opened.kind === "refused" && opened.reason === "balance")) this.#lookAgain(false);
      this.ports.changed("all");
      return false;
    }
  }

  #dropped(message: string): void {
    this.stream = { ...this.stream, notices: [...this.stream.notices.filter((one) => one.id !== DROPPED_NOTICE), { id: DROPPED_NOTICE, method: "notify", message, tone: "info" }] };
    this.#timeAsked();
    this.ports.changed("stream");
  }

  #starting(): void {
    if (this.box === "waking") return;
    this.box = "waking";
    this.ports.changed("all");
  }

  /** Resolves when the box names its life, or after `LIFE_WAIT_MS`, whichever comes first. */
  #lifeHeard(): Promise<void> {
    return new Promise((resolve) => {
      const waiter = { done: (): void => { cancel(); resolve(); } };
      const cancel = this.ports.later(LIFE_WAIT_MS, () => { this.#lifeWaiters = this.#lifeWaiters.filter((one) => one !== waiter); resolve(); });
      this.#lifeWaiters = [...this.#lifeWaiters, waiter];
    });
  }

  /** Resolves after `ms`. */
  #pause(ms: number): Promise<void> {
    return new Promise((resolve) => { this.ports.later(ms, resolve); });
  }

  /** A frame of the connection the page holds, or the page's own word that cx says a tutorial line, which says nothing of the box. */
  receive(event: StreamEvent): void {
    if (event.event === CX_SAYS) {
      const said = readCxSays(event.data);
      if (said !== undefined) { this.stream = cxSays(this.stream, said); this.ports.changed("stream"); }
      return;
    }
    this.answered = true;
    const data = record(event.data) ? event.data : {};
    const was = this.box;
    const lived = this.stream.epoch;
    if (event.event === "life") {
      this.#found++;
      this.box = "awake";
      this.blocked = undefined;
      this.closing = false;
      this.#failures = 0;
      this.#openedUnheard = false;
      this.#unheardSince = false;
      this.#broken = false;
      if (this.connection === "reconnecting") this.connection = "open";
      for (const read of this.#reread.splice(0)) read(true);
      if (this.#awaitingTurn && !this.#timers.has("turn")) this.#armTurn();
    }
    if (event.event === "sleep") {
      const due = data["dueInMs"];
      this.closing = due === 0;
      this.sleepDueAt = typeof due === "number" && Number.isFinite(due) && due >= 0 ? this.ports.now() + due : undefined;
    }
    if (event.event === "turn") { this.#awaitingTurn = false; this.#cancel("turn"); }
    this.stream = reduce(this.stream, event);
    // A wait on the earlier part of a life ends with that life: a new one has its own, or none.
    if (this.stream.epoch !== lived) this.loadingEarlier = false;
    if (working(this.stream) && !this.#timers.has("look")) this.#after("look", WAIT_MS, () => this.#lookAgain());
    if (this.#heldAnswers.size > 0) this.#askedAgain();
    // A Summarise that did not finish is over once a compaction is: its summary landed, or pi is done writing one.
    if ((event.event === "entry" && record(data["body"]) && data["body"]["form"] === "compaction") || (event.event === "compaction" && data["running"] === false)) {
      this.#compactions++;
      if (this.failed === "compact") this.failed = undefined;
    }
    this.#untidy();
    this.#timeAsked();
    if (event.event === "turn" && data["running"] === false) this.#rested();
    this.#keepPlace();
    if (event.event === "life" && typeof data["epoch"] === "string") {
      const heard = this.#lifeWaiters;
      this.#lifeWaiters = [];
      for (const one of heard) one.done();
    }
    if (event.event === "board" || event.event === "life") this.ports.board?.(event.event);
    if (event.event === "packages") this.ports.spoke?.();
    if (event.event === "end") { this.#ended(typeof data["reason"] === "string" ? data["reason"] : "", typeof data["status"] === "number" ? data["status"] : undefined); return; }
    if ((was !== "awake" || (this.#reheard && event.event === "life")) && this.box === "awake") { this.#reheard = false; this.ports.heard(); }
    else if (event.event === "life" && was === "awake" && lived !== undefined && this.stream.epoch !== lived) this.ports.life?.();
    this.ports.changed(["entry", "entries", "delta"].includes(event.event) ? "stream" : "all");
  }

  /**
   * A stream that ends while the page's own open is in flight, before that open answered, is the open's to follow: the open connects
   * again. Otherwise the page reads sleep only from routing or from the box itself: `box_unavailable` with routing's 409 is asleep at
   * once, and so is a `box_ended` after the box said it was going to sleep or answered the person's switch-off. Any other `box_ended`
   * says only that the box's stream stopped, and any other `box_unavailable` that routing could not say: both take the broken-stream
   * path, the account read and the stream asked again, and the next connection's routing answer decides.
   */
  #ended(reason: string | undefined, status?: number): void {
    this.answered = true;
    this.#listening = undefined;
    this.#closeStream = undefined;
    if ((this.#opening !== undefined || this.#holding.size > 0) && !this.#openedUnheard) { this.connection = "idle"; this.#starting(); this.ports.changed("all"); return; }
    // A box drawn asleep because an open failed is a guess, not the box's word: its stream's end is read as any other.
    const slept = reason === "box_ended" && (this.closing || (this.box === "asleep" && this.blocked === undefined));
    const next: Next = slept ? { kind: "asleep" } : afterEnd(reason, this.#failures, status);
    if (next.kind === "hold") this.connection = "held";
    else if (next.kind === "asleep" && this.#startRead) { this.connection = "idle"; this.#after("look", WAIT_MS, () => this.#lookAgain()); }
    else if (next.kind === "asleep") {
      // A box that slept under a page, without the person's asking — its own timer, or the platform closing it at the
      // floor — has the account read again: the balance may be why.
      const fell = this.box === "awake" && !this.#unheardSince && this.asked !== "close";
      this.#asleep();
      if (fell) this.#lookAgain(false);
    } else if (next.kind === "now") { this.connect(); return; }
    else {
      this.#failures++;
      this.connection = "reconnecting";
      // The box is not heard until a connection reaches it again: a message meanwhile opens it first, which a box still on answers at once.
      this.#broken = true;
      // The account is read before the stream is asked again: a stream's 401 reads as a broken connection, and the renewal follows from this read.
      this.#after("connect", next.ms, () => this.#lookAgain(false));
    }
    for (const read of this.#reread.splice(0)) read(true);
    this.ports.changed("all");
  }

  /** No turn runs: what waited on its end goes on, and the messages a Stop kept for the run that is over are no longer a Stop's to give back. */
  #rested(): void {
    for (const over of this.#turnOver.splice(0)) over();
    if (this.#going === undefined && !this.#queue.some((one) => this.#saved.includes(one.key))) this.#saved = [];
  }

  #untidy(): void {
    if (!this.stream.tidying) for (const done of this.#tidied.splice(0)) done();
  }

  #asleep(): void {
    for (const done of this.#slept.splice(0)) done();
    if (this.failed === "close") this.failed = undefined;
    // pi went with the box, and what it waited on with it: a card left would take no answer, and no turn runs. An option card stands,
    // for its package to ask again once the computer is on.
    if (this.stream.turn !== undefined) this.stream = { ...this.stream, turn: undefined };
    const standing = this.stream.dialogs.filter(isOptionCard);
    if (standing.length !== this.stream.dialogs.length) { this.stream = { ...this.stream, dialogs: standing }; this.#timeAsked(); }
    for (const over of this.#turnOver.splice(0)) over();
    for (const done of this.#tidied.splice(0)) done();
    for (const read of this.#reread.splice(0)) read(true);
    this.box = "asleep";
    this.#startRead = false;
    this.#unheardSince = false;
    this.#broken = false;
    this.connection = this.connection === "held" ? "held" : "idle";
    this.closing = false;
    this.sleepDueAt = undefined;
    this.#openedUnheard = false;
    this.#awaitingTurn = false;
    this.#cancel("turn");
    this.#unclear = undefined;
  }

  /** Writes the life the page shows, when it changed, under the account it was shown to. */
  #keepPlace(): void {
    const epoch = this.stream.epoch;
    if (this.me?.kind !== "signed_in" || epoch === undefined || epoch === this.#kept) return;
    const word = placeWord(this.me.account, epoch);
    if (word === undefined) return;
    this.#kept = epoch;
    // A store that is full or refused costs only the next reload's pick-up, never the frame being drawn.
    try { this.ports.place.write(word); } catch { /* not kept */ }
  }

  /**
   * The person's answer to a dialog, sent to pi: once the box has taken it the card folds by it. False when it did not get there — the
   * box asleep, the platform out of reach, another answer taken first — and the dialog stays for another try while its turn runs.
   */
  async answer(id: string, answer: DialogAnswer): Promise<boolean> {
    const card = this.stream.dialogs.find((one) => one.id === id);
    if (card !== undefined && isOptionCard(card) && this.box !== "awake") return this.#whenAskedAgain(card.form.ask, id, answer);
    const took = await this.ports.backend.command({ type: DIALOG_ANSWER, id, ...answer }).then(() => true, () => false);
    if (took) this.stream = letGo(this.stream, id, answer);
    this.#timeAsked();
    this.ports.changed("stream");
    return took;
  }

  /**
   * An option card answered while the computer is off: the computer is switched on, as for a message, and the answer goes to the card its
   * package asks again. False when the computer would not come on.
   */
  #whenAskedAgain(ask: string, id: string, answer: DialogAnswer): Promise<boolean> {
    return new Promise<boolean>((done) => {
      this.#heldAnswers.get(ask)?.done(false);
      this.#heldAnswers.set(ask, { id, answer, done });
      void this.#open().then((opened) => {
        if (opened || this.#heldAnswers.get(ask)?.done !== done) return;
        this.#heldAnswers.delete(ask);
        done(false);
      });
    });
  }

  /** A card asked again for an asking whose answer waits in this tab: the answer goes to it. */
  #askedAgain(): void {
    for (const [ask, held] of this.#heldAnswers) {
      const again = this.stream.dialogs.find((one) => isOptionCard(one) && one.form.ask === ask && one.id !== held.id);
      if (again === undefined) continue;
      this.#heldAnswers.delete(ask);
      void this.answer(again.id, held.answer).then(held.done);
    }
  }

  /** Every question that holds cx let go, unanswered, one after another in the order asked; one sent meanwhile goes with them. An option card holds nothing, and stays. */
  #release(): Promise<void> {
    return this.#releasing ??= (async () => {
      const tried = new Set<string>();
      const holding = (): readonly Dialog[] => this.stream.dialogs.filter((one) => !isOptionCard(one));
      for (let one = holding()[0]; one !== undefined; one = holding().find((next) => !tried.has(next.id))) {
        tried.add(one.id);
        await this.answer(one.id, { cancelled: true });
      }
    })().finally(() => { this.#releasing = undefined; });
  }

  /**
   * pi answers a dialog the package gave a time by itself when that runs out, and says nothing: the page folds the card then, as pi
   * counts. One the package gave no time has no clock here: it folds when the platform says the box took an answer to it — the seller's,
   * or the platform's own at the end of its wait — and a dialog the platform never held stays until the seller ends it. A notice goes
   * once it has stood long enough. A page nobody looks at counts on, since pi does.
   */
  #timeAsked(): void {
    const held = [...this.stream.dialogs, ...this.stream.notices];
    for (const [id, cancel] of this.#closing) if (!held.some((one) => one.id === id)) { cancel(); this.#closing.delete(id); }
    for (const one of held) {
      if (this.#closing.has(one.id)) continue;
      if (one.method === "notify") this.#closing.set(one.id, this.ports.later(NOTICE_MS, () => this.#close(one.id)));
      else if (one.timeout !== undefined) this.#closing.set(one.id, this.ports.later(one.timeout, () => this.#fold(one.id, { cancelled: true })));
    }
  }

  #fold(id: string, answer: DialogAnswer): void {
    this.stream = letGo(this.stream, id, answer);
    this.#timeAsked();
    this.ports.changed("stream");
  }

  #close(id: string): void {
    this.stream = closed(this.stream, id);
    this.#timeAsked();
    this.ports.changed("stream");
  }

  /** Runs `then` after `ms`, in its own slot; hiding the page cancels every slot. */
  #after(name: Timer, ms: number, then: () => void): void {
    this.#cancel(name);
    this.#timers.set(name, this.ports.later(ms, () => { this.#timers.delete(name); then(); }));
  }

  #cancel(name: Timer): void {
    this.#timers.get(name)?.();
    this.#timers.delete(name);
  }

  #stop(): void {
    const close = this.#closeStream;
    this.#listening = undefined;
    this.#closeStream = undefined;
    close?.();
  }
}
