import { readFileSync } from "node:fs";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { NotRunning, Refused, Unopened, type EarlierPart, type HeldMessage, type Me, type Opened } from "./backend.js";
import { NOTICE_MS, placeWord, working, type StreamEvent } from "./stream-model.js";
import { kindOf, turnOf } from "./cx-scene.js";
import { PlatformBackend } from "./platform-backend.js";
import { lineOf } from "./step-line.js";
import { FileUploads } from "./file-uploads.js";
import { FLOOR_MS, LIFE_WAIT_MS, OPEN_RETRIES, STOP_WAIT_MS, TURN_WAIT_MS, Visit, WAIT_MS } from "./visit.js";

const EPOCH = "a".repeat(32);
const ME: Me = { kind: "signed_in", account: "acct", email: undefined, name: undefined, box: "provisioned", balance: { available: 1000, open_floor: 10, can_open: true }, money: { currency: "USD", unitsPerMinor: 1 }, spending: undefined };
const entry = (seq: number, body: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => ({ epoch: EPOCH, seq, entryId: `e${seq}`, body });
const said = (seq: number, content: string): Readonly<Record<string, unknown>> => entry(seq, { form: "message", role: "user", content });
const answered = (seq: number, text: string): Readonly<Record<string, unknown>> => entry(seq, { form: "message", role: "assistant", content: [{ form: "text", text }], stopReason: "stop" });
/** Eighty entries of a stored life: forty questions and their answers. */
const stored = Array.from({ length: 80 }, (_, at) => (at % 2 === 0 ? said(at + 1, `question ${at / 2}`) : answered(at + 1, `answer ${(at - 1) / 2}`)));

/** One pi that every page on the conversation sends to: its queue, in its kinds, and the messages its runs read, in the order read. */
type Pi = { running: boolean; readonly queued: { readonly text: string; readonly kind: "steering" | "followUp" }[]; readonly read: string[] };

type Connection = { readonly since: string | undefined; readonly hear: (event: StreamEvent) => void; readonly broken: () => void; closed: boolean };

/** The page's world, with the platform, the clock and the tab in the test's hands: every request the page makes is written down in order. */
function world(options: { readonly me?: Me; readonly kept?: string; readonly opens?: readonly Opened[]; readonly openAnswered?: Promise<void>; readonly closing?: () => Promise<void>; /** How the box answers a close; unset, it closes. */ readonly closeAnswer?: "closed" | "busy"; /** How the platform answers a restart; unset, it restarts. */ readonly restartAnswer?: "restarted" | "busy" | "fails"; readonly beforeSend?: () => Promise<void>; readonly hold?: (type: string) => Promise<void> | undefined; readonly glance?: () => void; readonly board?: () => void; readonly history?: (epoch: string, before: number) => Promise<EarlierPart>; readonly handles?: string; /** Messages an installed package takes as its commands once pi rests after a stop, whichever command brings them. */ readonly handledAtRest?: readonly string[]; readonly pi?: Pi; readonly droppedLine?: (model: string) => string } = {}) {
  const asked: string[] = [];
  const connections: Connection[] = [];
  const timers: { at: number; then: () => void; cancelled: boolean }[] = [];
  const given: string[] = [];
  /** Every command the page sent, whole. */
  const posted: Readonly<Record<string, unknown>>[] = [];
  /** The messages given back because the person took them back themselves. */
  const taken: string[] = [];
  /** What pi's queue holds, as its `clear_queue` answers; unset, the answer says nothing of it. */
  let piHolds: readonly string[] | undefined;
  /** Whether cx's actions were offered at each draw the page was asked for. */
  const drawn: boolean[] = [];
  /** What each draw the page asked for covered. */
  const whats: ("stream" | "all")[] = [];
  /** At each draw: the messages the page was told still wait. */
  const waiting: (readonly string[])[] = [];
  /** At each draw: whether the page would draw the computer switching on, and whether an open was refused or a message given back by then. */
  const switching: { readonly said: boolean; readonly refused: boolean; readonly given: number }[] = [];
  const opens = [...(options.opens ?? [])];
  let now = 0;
  let rested = false;
  let me = options.me ?? ME;
  let kept = options.kept ?? placeWord(ME.kind === "signed_in" ? ME.account : "", EPOCH) ?? null;
  let commandFails: boolean | readonly string[] = false;
  /** The platform has opened the box for a message it kept, and passes what comes next to pi. */
  let boxUp = false;
  /** The open the platform asked for the messages it keeps, while it is under way: a message sent meanwhile joins it. */
  let platformOpen: Promise<Opened> | undefined;
  /** pi's refusal of every prompt, in its words (`""` for none given); unset, pi takes them. */
  let refusal: string | undefined;
  /** The reason given with each give-back the page was told of. */
  const whys: (string | undefined)[] = [];
  /** The messages the platform keeps for the box, as its row holds them, and the ids it took back. */
  let row: HeldMessage[] = me.kind === "signed_in" ? [...(me.held ?? [])] : [];
  let heldIds = 0;
  let keepsNext = false;
  /** An account read under way answers, when it does, what the account was when it was asked. */
  let slowAccount: Promise<void> | undefined;
  /** The messages that reached pi, through the platform or straight. */
  const delivered: string[] = [];
  const visit = new Visit({
    backend: {
      open: async () => { asked.push("open"); await options.openAnswered; return opens.shift() ?? { kind: "open" }; },
      close: async () => { asked.push("close"); await options.closing?.(); return options.closeAnswer ?? "closed"; },
      restart: async () => { asked.push("restart"); if (options.restartAnswer === "fails") throw new Error("restart answered 503"); return options.restartAnswer ?? "restarted"; },
      stream: (since, hear, broken) => {
        asked.push(`stream ${since ?? "-"}`);
        const connection: Connection = { since, hear, broken, closed: false };
        connections.push(connection);
        return () => { connection.closed = true; };
      },
      history: async (epoch, before) => { asked.push(`history ${epoch}:${before}`); return options.history?.(epoch, before) ?? { epoch, entries: [], from: before, earlier: false }; },
      takeBack: async (id) => {
        asked.push(`take back ${id}`);
        const was = row.length;
        row = row.filter((one) => one.id !== id);
        return row.length < was ? "back" : "taken";
      },
      command: async (command, hold) => {
        const type = String(command["type"]);
        posted.push(command);
        const said = command["message"] === undefined ? "" : ` ${String(command["message"])}${command["streamingBehavior"] === undefined ? "" : ` ${String(command["streamingBehavior"])}`}`;
        asked.push(`${type}${said}${command["mode"] === undefined ? "" : ` ${String(command["mode"])}`}`);
        await options.hold?.(type);
        if (commandFails === true || (commandFails !== false && commandFails.includes(type))) throw new Error("command answered 503");
        // The platform keeps a message the box was not there to take, opens the box for it as the page's own open would, and answers once that open is.
        let kept: HeldMessage | undefined;
        // A running box that holds a change to the plugins refuses the message, and the platform keeps it.
        if (type === "prompt" && keepsNext) {
          keepsNext = false;
          const held = { id: (++heldIds).toString(16).padStart(16, "0"), message: String(command["message"]), at: now };
          row = [...row, held];
          return { held };
        }
        if ((type === "prompt" || type === "steer") && !visit.awake && !boxUp) {
          const held = { id: hold ?? (++heldIds).toString(16).padStart(16, "0"), message: String(command["message"]), at: now };
          row = [...row, held];
          platformOpen ??= (async (): Promise<Opened> => { asked.push("platform open"); await options.openAnswered; return opens.shift() ?? { kind: "open" }; })().finally(() => { platformOpen = undefined; });
          const opened = await platformOpen;
          // One taken back meanwhile is not sent: the platform answers that it kept it.
          if (!row.includes(held)) return { held };
          // An open admission refused leaves the message listed as ended, until the page takes it out.
          if (opened.kind === "refused") { row = row.map((one) => (one === held ? { ...held, refused: "" } : one)); throw new Unopened(opened); }
          row = row.filter((one) => one !== held);
          if (opened.kind === "failed") throw new Unopened(opened);
          // The box up, the platform sends what it kept and answers with pi's own answer, as below.
          boxUp = true;
          kept = held;
        }
        if (type === "prompt" || type === "steer") delivered.push(String(command["message"]));
        if (type === "prompt" && refusal !== undefined) {
          // One pi refused stays listed as ended, with pi's words.
          if (kept !== undefined) row = [...row, { ...kept, refused: refusal }];
          throw new Refused(refusal === "" ? undefined : refusal);
        }
        // pi gives its queue up whole: asked again, it gives what was queued since.
        const pi = options.pi;
        if (pi !== undefined) {
          if (type === "get_state") return { success: true, data: { pendingMessageCount: pi.queued.length } };
          if (type === "clear_queue") { const all = pi.queued.splice(0); return { success: true, data: { steering: all.filter((one) => one.kind === "steering").map((one) => one.text), followUp: all.filter((one) => one.kind === "followUp").map((one) => one.text) } }; }
          if (type === "abort") pi.running = false;
          // Steering mode `all`: a run pi starts reads its whole steering queue with the prompt.
          if (type === "prompt" && !pi.running) { pi.running = true; pi.read.push(String(command["message"]), ...pi.queued.filter((one) => one.kind === "steering").map((one) => one.text)); pi.queued.splice(0, pi.queued.length, ...pi.queued.filter((one) => one.kind !== "steering")); }
          else if (type === "prompt" || type === "steer") pi.queued.push({ text: String(command["message"]), kind: "steering" });
          return type === "prompt" || type === "steer" ? { sentAt: now } : {};
        }
        if (type === "get_state") return { success: true, data: { pendingMessageCount: piHolds?.length ?? 0 } };
        if (type === "clear_queue" && piHolds !== undefined) { const steering = piHolds; piHolds = []; return { success: true, data: { steering, followUp: [] } }; }
        if (type === "prompt" && options.handles !== undefined && command["message"] === options.handles) return { success: true, data: { disposition: "handled" }, sentAt: now };
        if (type === "abort") rested = true;
        if (rested && (type === "prompt" || type === "steer") && options.handledAtRest?.includes(String(command["message"])) === true) return { success: true, data: { disposition: "handled" }, sentAt: now };
        return type === "prompt" || type === "steer" ? { sentAt: now } : {};
      },
    },
    account: async () => { asked.push("me"); const read = me; if (slowAccount !== undefined) await slowAccount; return read; },
    glance: () => { options.glance?.(); },
    now: () => now,
    later: (ms, then) => { const timer = { at: now + ms, then, cancelled: false }; timers.push(timer); return () => { timer.cancelled = true; }; },
    place: { read: () => kept, write: (word) => { kept = word; } },
    changed: (what) => { whats.push(what); drawn.push(visit.idle); waiting.push(visit.stream.items.flatMap((item) => (item.kind === "user" && item.pending ? [item.text] : []))); switching.push({ said: visit.box === "waking", refused: visit.blocked !== undefined, given: given.length }); },
    heard: () => { asked.push("heard"); },
    board: () => { options.board?.(); },
    giveBack: (messages, how, why) => { given.push(...messages); whys.push(why); if (how === "asked") taken.push(...messages); },
    ...(options.beforeSend === undefined ? {} : { beforeSend: options.beforeSend }),
    ...(options.droppedLine === undefined ? {} : { droppedLine: options.droppedLine }),
  });
  const settle = async (): Promise<void> => { for (let round = 0; round < 20; round++) await Promise.resolve(); };
  /** Time passes: every wait that falls due runs, in order, and what it starts settles. */
  const pass = async (ms: number): Promise<void> => {
    const until = now + ms;
    for (;;) {
      const due = timers.filter((timer) => !timer.cancelled && timer.at <= until).sort((a, b) => a.at - b.at)[0];
      if (due === undefined) break;
      due.cancelled = true;
      now = due.at;
      due.then();
      await settle();
    }
    now = until;
    await settle();
  };
  const live = (): Connection => {
    const open = connections.filter((connection) => !connection.closed);
    expect(open).toHaveLength(1);
    return open[0]!;
  };
  const hear = async (event: string, data: unknown): Promise<void> => { live().hear({ event, data }); await settle(); };
  const end = async (reason: string, status?: number): Promise<void> => { if (reason === "box_ended" || reason === "box_unavailable") boxUp = false; const connection = live(); connection.closed = true; connection.hear({ event: "end", data: { reason, ...(status === undefined ? {} : { status }) } }); await settle(); };
  return {
    visit, asked, posted, delivered, connections, given, taken, whys, drawn, whats, waiting, switching, settle, pass, live, hear, end,
    refuse: (words: string | undefined) => { refusal = words; },
    setMe: (next: Me) => { me = next; },
    failCommands: (types?: readonly string[]) => { commandFails = types ?? true; },
    piHolds: (messages: readonly string[]) => { piHolds = messages; },
    kept: () => kept,
    /** The box took what the platform kept: its row is empty. */
    boxTook: () => { row = []; },
    /** What the platform's row holds. */
    row: () => row,
    /** The next prompt is kept by the platform for a box busy with the plugins: answered 202 with what it kept. */
    keepNext: () => { keepsNext = true; },
    /** Account reads from now on wait until the returned function lets them answer. */
    slowAccount: (): (() => void) => { let answer = (): void => {}; slowAccount = new Promise<void>((done) => { answer = done; }); return () => { slowAccount = undefined; answer(); }; },
  };
}

/** Whether the computer is drawn switching on. */
const starting = (page: { readonly visit: Visit }): boolean => page.visit.box === "waking";

/** A page opened on a box that sleeps: the store's copy of its life, then the relay's word that routing found the box not running. */
async function openedAsleep(options: Parameters<typeof world>[0] = {}) {
  const page = world(options);
  await page.visit.look();
  await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: stored });
  await page.end("box_unavailable", 409);
  return page;
}

/** A page whose box is awake and idle. */
async function openedAwake(options: Parameters<typeof world>[0] = {}) {
  const page = world(options);
  await page.visit.look();
  await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: stored });
  await page.hear("life", { kind: "life", epoch: EPOCH });
  await page.hear("turn", { kind: "turn", running: false });
  return page;
}

describe("a page opens on what the store holds, and on nothing else", () => {
  it("reads the account and asks the newest part of its kept life, draws the stored exchange from one read, and opens nothing", async () => {
    const page = await openedAsleep();
    expect(page.asked).toEqual(["me", `stream ${EPOCH}:newest`]);
    expect(page.visit.stream.items).toHaveLength(80);
    expect([page.visit.stream.cursor, page.visit.box, page.visit.connection]).toEqual([`${EPOCH}:80`, "asleep", "idle"]);
    // A box asleep is not looked for again, and nothing opens it: an hour passes and the page asks nothing.
    await page.pass(60 * 60_000);
    expect(page.asked).toEqual(["me", `stream ${EPOCH}:newest`]);
  });

  it("asks for the newest part when it kept no place, for the store to say which life the box last named", async () => {
    const page = world({ kept: "" });
    await page.visit.look();
    expect(page.asked).toEqual(["me", "stream newest"]);
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: stored.slice(0, 4) });
    expect([page.visit.stream.epoch, page.kept()]).toEqual([EPOCH, placeWord("acct", EPOCH)]);
  });

  it("knows a box that runs by its life on the same connection, and only then reads what only a running box answers", async () => {
    const page = await openedAwake();
    expect(page.asked).toEqual(["me", `stream ${EPOCH}:newest`, "heard"]);
    expect([page.visit.box, page.visit.running, page.visit.idle]).toEqual(["awake", false, true]);
  });

  it("sends pi nothing while the box is awake and idle: an hour passes, by the page's waits and by the window's timers, and no get_state goes out", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval"] });
    onTestFinished(() => { vi.useRealTimers(); });
    const page = await openedAwake();
    const before = page.posted.length;
    await page.pass(60 * 60_000);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(page.posted.slice(before).map((command) => command["type"])).toEqual([]);
  });

  it("has the board read again when the box says its files changed and when a life begins, and on no other frame", async () => {
    const board = vi.fn();
    const page = world({ board });
    await page.visit.look();
    await page.hear("turn", { kind: "turn", running: false });
    expect(board).not.toHaveBeenCalled();
    await page.hear("board", { kind: "board" });
    await page.hear("life", { kind: "life", epoch: EPOCH });
    expect(board).toHaveBeenCalledTimes(2);
  });

  it("waits on an account whose computer is being set up, and on a platform it cannot reach", async () => {
    const page = world({ me: { ...ME, box: "pending" } as Me });
    await page.visit.look();
    expect(page.asked).toEqual(["me"]);
    await page.pass(WAIT_MS);
    expect(page.asked).toEqual(["me", "me"]);
  });

  it("draws a start the account says is under way as one, its time unknown: the box's 'not there yet' draws no sleep, the account is read until it says on, and then the box is listened to", async () => {
    const page = world({ me: { ...ME, machine: "starting" } as Me });
    await page.visit.look();
    // The page listens once, for what is stored; the box is not up yet.
    expect([page.visit.box, page.visit.startUntimed, page.asked]).toEqual(["waking", true, ["me", `stream ${EPOCH}:newest`]]);
    await page.end("box_unavailable", 409);
    expect([page.visit.box, page.visit.startUntimed]).toEqual(["waking", true]);
    // While the account says it starts, the account alone is read.
    await page.pass(WAIT_MS);
    expect([page.visit.box, page.asked]).toEqual(["waking", ["me", `stream ${EPOCH}:newest`, "me"]]);
    page.setMe({ ...ME, machine: "on" } as Me);
    await page.pass(WAIT_MS);
    expect([page.asked, page.visit.startUntimed]).toEqual([["me", `stream ${EPOCH}:newest`, "me", "me", `stream ${EPOCH}:newest`], false]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    expect(page.visit.box).toBe("awake");
  });

  it("draws a start the account read as off once the account says the computer is off", async () => {
    const page = world({ me: { ...ME, machine: "starting" } as Me });
    await page.visit.look();
    await page.end("box_unavailable", 409);
    page.setMe({ ...ME, machine: "off" } as Me);
    await page.pass(WAIT_MS);
    expect([page.visit.box, page.visit.startUntimed]).toEqual(["asleep", false]);
  });

  it("keeps a start it read as one of unknown beginning through an account read that fails: the line counts no time it does not know", async () => {
    const page = world({ me: { ...ME, machine: "starting" } as Me });
    await page.visit.look();
    await page.end("box_unavailable", 409);
    page.setMe(undefined as unknown as Me);
    await page.pass(WAIT_MS);
    const line = lineOf({ stream: page.visit.stream, atWork: page.visit.atWork, starting: page.visit.box === "waking", untimed: page.visit.startUntimed });
    expect([page.visit.box, page.visit.startUntimed, typeof line === "object" ? line.timed : line]).toEqual(["waking", true, false]);
    // The next true answer ends it.
    page.setMe({ ...ME, machine: "off" } as Me);
    await page.pass(WAIT_MS);
    expect([page.visit.box, page.visit.startUntimed]).toEqual(["asleep", false]);
  });

  it("stops reading the account for a start it read once the box is heard alive and the account says on with nothing held", async () => {
    const page = world({ me: { ...ME, machine: "starting", held: [{ id: "0000000000000001", message: "A held first message", at: 0 }] } as Me });
    await page.visit.look();
    await page.hear("life", { kind: "life", epoch: EPOCH });
    page.setMe({ ...ME, machine: "on", held: [] } as Me);
    await page.pass(WAIT_MS);
    const reads = page.asked.filter((one) => one === "me").length;
    await page.pass(3 * WAIT_MS);
    expect([page.visit.box, page.visit.startUntimed, page.asked.filter((one) => one === "me").length]).toEqual(["awake", false, reads]);
    expect(reads).toBe(2);
  });

  it("reads the account again slowly while the balance is under the floor, and still shows the stored exchange", async () => {
    const page = world({ me: { ...ME, balance: { available: 1, open_floor: 10, can_open: false } } as Me });
    await page.visit.look();
    expect(page.asked).toEqual(["me", `stream ${EPOCH}:newest`]);
    await page.pass(FLOOR_MS);
    expect(page.asked).toEqual(["me", `stream ${EPOCH}:newest`, "me"]);
    // A box known asleep has nothing to say: the next reads are of the account alone.
    await page.end("box_unavailable", 409);
    await page.pass(2 * FLOOR_MS);
    expect(page.asked).toEqual(["me", `stream ${EPOCH}:newest`, "me", "me", "me"]);
    // Nothing the person does opens a box the floor keeps shut: the message goes back.
    await page.visit.send("hello");
    expect([page.asked.includes("open"), page.given]).toEqual([false, ["hello"]]);
  });
});

describe("the box opens for a message, or for cx, and for nothing that only reads", () => {
  it("leaves the open to the platform for a message sent while the computer sleeps: the message goes as written, waits drawn, and the box is listened to once the platform keeps it", async () => {
    const page = await openedAsleep();
    const sending = page.visit.send("next question");
    await page.settle();
    expect(page.visit.stream.items.at(-1)).toMatchObject({ kind: "user", text: "next question", pending: true });
    await sending;
    expect([page.visit.box, page.asked.slice(2)]).toEqual(["waking", ["prompt next question steer", "platform open", `stream ${EPOCH}:80`]]);
    // Answered with pi's own answer once the platform sent it: the box's moment for it, as for any message the box took.
    expect([page.given, page.visit.stream.items.at(-1)]).toEqual([[], expect.objectContaining({ text: "next question", pending: true, sentAt: 0 })]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    expect(page.visit.box).toBe("awake");
    // pi's record of it, which the platform sent, takes its place: drawn once, and sent by the page once.
    await page.hear("entry", entry(81, { form: "message", role: "user", content: "next question", timestamp: 5 }));
    expect(page.visit.stream.items.filter((item) => item.kind === "user" && item.text === "next question")).toEqual([expect.objectContaining({ pending: false })]);
    expect(page.asked.filter((one) => one.startsWith("prompt"))).toHaveLength(1);
  });

  it("item 6: sends a message only once the person's queued picks have reached the platform, so it runs on their last choice", async () => {
    let picked: () => void = () => undefined;
    const picks = new Promise<void>((resolve) => { picked = resolve; });
    const page = await openedAwake({ beforeSend: () => picks });
    const sending = page.visit.send("on my new model");
    await page.settle();
    expect(page.asked.some((line) => line.startsWith("prompt"))).toBe(false);
    picked();
    await sending;
    expect(page.asked.at(-1)).toBe("prompt on my new model steer");
  });

  it("sends a message the platform keeps no second time, however long the box it opened is slow to speak", async () => {
    const page = await openedAsleep();
    await page.visit.send("next question");
    await page.pass(LIFE_WAIT_MS);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await page.pass(TURN_WAIT_MS);
    expect(page.asked.filter((one) => one.startsWith("prompt"))).toEqual(["prompt next question steer"]);
  });

  it("sends the messages written while the platform opens for the first one at once, in the order written, and the platform asks one open for them all", async () => {
    let answer: () => void = () => undefined;
    const page = await openedAsleep({ openAnswered: new Promise((resolve) => { answer = resolve; }) });
    void page.visit.send("one");
    await page.settle();
    void page.visit.send("two");
    const last = page.visit.send("three");
    await page.settle();
    // Each is with the platform before the open is answered, so a reload meanwhile finds every one of them there.
    expect(page.asked.filter((one) => one.startsWith("prompt"))).toEqual(["prompt one steer", "prompt two steer", "prompt three steer"]);
    answer();
    await last;
    expect(page.asked.filter((one) => one === "platform open")).toHaveLength(1);
    expect([page.asked.includes("open"), page.given, page.waiting.at(-1)]).toEqual([false, [], ["one", "two", "three"]]);
  });

  it("carries a message the platform refused while the session was renewed back to the platform once the page knows its account", async () => {
    const page = world();
    page.visit.resend("carried");
    await page.visit.look();
    await page.settle();
    // The page connects from its place first; the message then goes, and the platform opens the box for it.
    expect(page.asked.slice(0, 4)).toEqual(["me", `stream ${EPOCH}:newest`, "prompt carried steer", "platform open"]);
    expect([page.given, page.visit.stream.items.at(-1)]).toEqual([[], expect.objectContaining({ kind: "user", text: "carried", pending: true })]);
  });

  it("takes the platform's word for a message it kept though the box spoke while it opened, and lets messages after it go straight to that box", async () => {
    let answer: () => void = () => undefined;
    const page = world({ openAnswered: new Promise<void>((resolve) => { answer = resolve; }) });
    await page.visit.look();
    const sending = page.visit.send("now");
    await page.settle();
    await page.hear("life", { kind: "life", epoch: EPOCH });
    answer();
    await sending;
    expect(page.visit.stream.items.at(-1)).toMatchObject({ text: "now", pending: true });
    await page.visit.send("then");
    expect(page.asked.filter((one) => one.startsWith("prompt") || one.endsWith("open"))).toEqual(["prompt now steer", "platform open", "prompt then steer"]);
  });

  it("sends straight to a box that is awake, opening nothing", async () => {
    const page = await openedAwake();
    await page.visit.send("more");
    expect(page.asked.slice(3)).toEqual(["prompt more steer"]);
  });

  it("gives back every message the platform kept for an open that was refused, and draws what the open came to", async () => {
    const page = await openedAsleep({ opens: [{ kind: "refused", reason: "global_limit" }] });
    void page.visit.send("one");
    await page.visit.send("two");
    expect(page.given).toEqual(["one", "two"]);
    expect(page.visit.stream.items.some((item) => item.kind === "user" && item.pending)).toBe(false);
    expect([page.visit.box, page.visit.blocked]).toEqual(["asleep", { kind: "refused", reason: "global_limit" }]);
    expect(page.asked.filter((one) => one === "platform open" || one === "open")).toEqual(["platform open"]);
  });

  it("is a start from a message sent while the computer sleeps until it is heard awake, and never for a computer awake", async () => {
    const page = await openedAsleep();
    expect(starting(page)).toBe(false);
    const sending = page.visit.send("next question");
    await page.settle();
    expect([page.visit.box, starting(page)]).toEqual(["waking", true]);
    // Heard awake, the computer is on: the start ends with the computer, not with the message's turn.
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await sending;
    expect([page.visit.box, page.visit.atWork, starting(page)]).toEqual(["awake", true, false]);
    await page.hear("turn", { kind: "turn", running: true });
    expect(starting(page)).toBe(false);
    // A message sent while that turn runs steers it: the computer is on, and nothing says otherwise when the turn ends before pi takes it.
    const steering = page.visit.send("and one more");
    page.live().hear({ event: "turn", data: { kind: "turn", running: false } });
    expect([page.visit.atWork, starting(page)]).toEqual([true, false]);
    await steering;
    // A computer that said it is going to sleep now is switched on again for a message.
    const closing = await openedAwake();
    await closing.hear("sleep", { kind: "sleep", dueInMs: 0 });
    void closing.visit.send("before it sleeps");
    await closing.settle();
    expect(starting(closing)).toBe(true);
    // A message that starts no turn ends its wait with the wait for its turn.
    const quiet = await openedAsleep();
    const command = quiet.visit.send("/a-command");
    await quiet.settle();
    await quiet.hear("life", { kind: "life", epoch: EPOCH });
    await command;
    await quiet.pass(TURN_WAIT_MS);
    expect([quiet.visit.atWork, starting(quiet)]).toEqual([false, false]);
  });

  it("draws no start for a message sent before the page has read the computer, until something says it was not on", async () => {
    const page = world();
    await page.visit.look();
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: stored });
    expect(page.visit.box).toBe("unknown");
    const sending = page.visit.send("hello");
    await page.settle();
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await sending;
    expect([page.visit.atWork, page.asked.includes("prompt hello steer"), page.switching.some((draw) => draw.said)]).toEqual([true, true, false]);
    // The connection finding the box gone is that word, and so is an open the box has to come up for.
    let answer = (): void => undefined;
    const gone = world({ openAnswered: new Promise((resolve) => { answer = resolve; }) });
    await gone.visit.look();
    const waiting = gone.visit.send("hello");
    await gone.settle();
    expect(gone.visit.box).toBe("unknown");
    await gone.end("box_unavailable", 409);
    expect(gone.visit.box).toBe("waking");
    answer();
    await gone.settle();
    await gone.hear("life", { kind: "life", epoch: EPOCH });
    await waiting;
    expect([gone.visit.box, gone.asked.includes("prompt hello steer")]).toEqual(["awake", true]);
  });

  it("ends a start with what a refused open came to, and gives the message back", async () => {
    let answer = (): void => undefined;
    const page = await openedAsleep({ opens: [{ kind: "refused", reason: "global_limit" }], openAnswered: new Promise((resolve) => { answer = resolve; }) });
    const sending = page.visit.send("one");
    await page.settle();
    expect([starting(page), page.visit.blocked]).toEqual([true, undefined]);
    answer();
    await sending;
    expect([starting(page), page.visit.blocked, page.given]).toEqual([false, { kind: "refused", reason: "global_limit" }, ["one"]]);
    // From the draw that holds the refusal on, none draws the computer switching on.
    const after = page.switching.slice(page.switching.findIndex((draw) => draw.refused));
    expect([page.switching.some((draw) => draw.said), after.length > 0, after.some((draw) => draw.said)]).toEqual([true, true, false]);
  });

  it("keeps a message that got no answer in the composer when the platform cannot be reached, says so, and draws no start", async () => {
    const page = await openedAsleep();
    page.failCommands();
    await page.visit.send("one");
    // Nothing reached the platform, so nothing was kept: the message is back where it was written, and the account is read to learn whether the platform is there.
    expect([page.given, page.visit.box, page.asked.includes("open"), page.asked.at(-1)]).toEqual([["one"], "asleep", false, "me"]);
    const after = page.switching.filter((draw) => draw.given > 0);
    expect([after.length > 0, after.some((draw) => draw.said)]).toEqual([true, false]);
  });

  it("asks a box between states again without end, at one, two and then every five seconds, a start for as long as it is so answered", async () => {
    const between: Opened = { kind: "refused", reason: "lease_held" };
    const page = await openedAsleep({ opens: [between, { kind: "refused", reason: "machine_busy" }, ...Array.from({ length: 40 }, () => between)] });
    const sending = page.visit.wake();
    await page.settle();
    expect(page.asked.filter((one) => one === "open")).toHaveLength(1);
    await page.pass(OPEN_RETRIES[0]);
    await page.pass(OPEN_RETRIES[1]);
    await page.pass(OPEN_RETRIES[2]);
    expect(page.asked.filter((one) => one === "open")).toHaveLength(4);
    // Long past the three waits it is still a start: nothing ends it, and nothing is said in its place.
    for (let round = 0; round < 38; round++) await page.pass(OPEN_RETRIES[2]);
    expect(page.asked.filter((one) => one === "open")).toHaveLength(42);
    expect([page.visit.box, page.visit.blocked, page.given, page.waiting.at(-1)]).toEqual(["waking", undefined, [], []]);
    await page.pass(OPEN_RETRIES[2]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await sending;
    expect([page.visit.box, page.given, page.asked.at(-1)]).toEqual(["awake", [], "heard"]);
  });
  it("asks again, as an open under way, when the open came back with a status and no word of the platform's: something between cut it", async () => {
    const cut: Opened = { kind: "failed", step: "box", status: 502, reason: undefined };
    const page = await openedAsleep({ opens: [cut, { kind: "failed", step: "session", status: 504, reason: undefined }] });
    const sending = page.visit.wake();
    await page.settle();
    expect([page.asked.filter((one) => one === "open").length, page.visit.box, page.visit.blocked]).toEqual([1, "waking", undefined]);
    await page.pass(OPEN_RETRIES[0]);
    await page.pass(OPEN_RETRIES[1]);
    // The third ask is answered as the open in flight ends: the box is open, and the page goes on to it.
    expect([page.asked.filter((one) => one === "open").length, page.visit.blocked]).toEqual([3, undefined]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await sending;
    expect([page.visit.box, page.visit.blocked, page.visit.unreachable]).toEqual(["awake", undefined, false]);
  });

  it("asks again, as a start under way, when 开机 reaches a box still closing: the box refuses it until its close has ended, and no failure is drawn", async () => {
    // As the platform passes on the box's own 409 `box_closing` (`platform-backend.ts`, `unopened`).
    const closing: Opened = { kind: "failed", step: "box", status: 409, reason: "box_closing" };
    const page = await openedAsleep({ opens: [closing, closing] });
    const sending = page.visit.wake();
    await page.settle();
    expect([page.asked.filter((one) => one === "open").length, page.visit.box, page.visit.blocked]).toEqual([1, "waking", undefined]);
    await page.pass(OPEN_RETRIES[0]);
    await page.pass(OPEN_RETRIES[1]);
    expect([page.asked.filter((one) => one === "open").length, page.visit.blocked]).toEqual([3, undefined]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await sending;
    expect([page.visit.box, page.visit.blocked]).toEqual(["awake", undefined]);
  });

  it("draws the open failed as before when the platform refused it with its word, and out of reach when nothing answered", async () => {
    const refused = await openedAsleep({ opens: [{ kind: "failed", step: "box", status: 503, reason: "indeterminate" }] });
    await refused.visit.wake();
    await refused.pass(10_000);
    expect([refused.asked.filter((one) => one === "open").length, refused.visit.box, refused.visit.blocked]).toEqual([1, "asleep", { kind: "failed", step: "box", status: 503, reason: "indeterminate" }]);
    const silent = await openedAsleep({ opens: [{ kind: "failed", step: "box", status: undefined, reason: undefined }] });
    silent.setMe(undefined as unknown as Me);
    await silent.visit.wake();
    await silent.settle();
    expect([silent.visit.blocked, silent.visit.unreachable]).toEqual([undefined, true]);
    await silent.pass(10_000);
    expect(silent.asked.filter((one) => one === "open")).toHaveLength(1);
  });

  it("reads a session another ask is still opening as an open, asks nothing again, and learns pi is up from the life the box names", async () => {
    const page = await openedAsleep({ opens: [{ kind: "opening" }] });
    const sending = page.visit.wake();
    await page.settle();
    expect([page.visit.box, page.visit.blocked, page.asked.filter((one) => one === "open")]).toEqual(["waking", undefined, ["open"]]);
    await page.pass(OPEN_RETRIES[0]);
    expect([page.visit.box, page.given, page.asked.filter((one) => one === "open")]).toEqual(["waking", [], ["open"]]);
    expect(page.asked).not.toContain("heard");
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await sending;
    expect([page.visit.box, page.asked.at(-1)]).toEqual(["awake", "heard"]);
  });
  it("gives a message back when the box took it in no answer, and keeps the rest going", async () => {
    const page = await openedAwake();
    page.failCommands();
    await page.visit.send("lost");
    expect(page.given).toEqual(["lost"]);
    expect(page.visit.stream.items.some((item) => item.kind === "user" && item.text === "lost")).toBe(false);
  });

  it("gives a message pi refused back with pi's own reason, and none with one that did not reach pi or that pi gave no words for", async () => {
    const page = await openedAwake();
    page.refuse("No API key found for the selected model.");
    await page.visit.send("refused");
    page.refuse("");
    await page.visit.send("wordless");
    page.refuse(undefined);
    page.failCommands();
    await page.visit.send("lost");
    expect([page.given, page.whys]).toEqual([["refused", "wordless", "lost"], ["No API key found for the selected model.", undefined, undefined]]);
  });

  it("reads a box that ends its stream while the page's own open is in flight as the box that open brings up, never as asleep", async () => {
    let answer: () => void = () => undefined;
    const page = world({ openAnswered: new Promise((resolve) => { answer = resolve; }) });
    await page.visit.look();
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: stored });
    const sending = page.visit.send("hello");
    await page.settle();
    // The relay found no box before the open was answered: the page connects again once the open is done.
    expect(page.visit.box).toBe("unknown");
    await page.end("box_unavailable", 409);
    expect([page.visit.box, page.visit.connection]).toEqual(["waking", "idle"]);
    answer();
    await page.settle();
    expect(page.asked.at(-1)).toBe(`stream ${EPOCH}:80`);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await sending;
    expect(page.visit.box).toBe("awake");
  });

});

describe("a start that did not happen", () => {
  it("catches up once shown again on a box it last heard asleep, which another page or device woke meanwhile, and asks nothing until then", async () => {
    const page = await openedAsleep();
    const before = page.asked.length;
    page.setMe({ ...ME, machine: "on" } as Me);
    await page.pass(3 * 60 * 60_000);
    expect(page.asked.slice(before)).toEqual([]);
    page.visit.show();
    await page.settle();
    expect(page.asked.slice(before)).toEqual(["me", expect.stringMatching(/^stream /)]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    expect([page.visit.box, page.visit.connection]).toEqual(["awake", "open"]);
    // A page that holds its stream heard everything meanwhile: shown again, it asks nothing.
    const held = page.asked.length;
    page.visit.show();
    await page.settle();
    expect(page.asked.slice(held)).toEqual([]);
  });

  it("has the account read again when the open was refused for the balance, so the page learns the floor the open met", async () => {
    const page = await openedAsleep({ opens: [{ kind: "refused", reason: "balance" }] });
    const before = page.asked.filter((one) => one === "me").length;
    page.setMe({ ...ME, balance: { available: 1, open_floor: 10, can_open: false } } as Me);
    await page.visit.send("one");
    await page.settle();
    expect(page.asked.filter((one) => one === "me")).toHaveLength(before + 1);
    expect([page.visit.canOpen, page.visit.box, page.given]).toEqual([false, "asleep", ["one"]]);
    // Any other refusal is the platform's own: nothing about the account changed.
    const full = await openedAsleep({ opens: [{ kind: "refused", reason: "global_limit" }] });
    const reads = full.asked.filter((one) => one === "me").length;
    await full.visit.send("one");
    await full.settle();
    expect(full.asked.filter((one) => one === "me")).toHaveLength(reads);
  });

  it("is out of reach, not a failure, when the open had no answer at all: the box stays as last heard and the account is read until the platform answers", async () => {
    const page = await openedAsleep({ opens: [{ kind: "failed", step: "box", status: undefined, reason: undefined }] });
    const before = page.asked.filter((one) => one === "me").length;
    page.setMe(undefined as unknown as Me);
    await page.visit.send("one");
    await page.settle();
    expect([page.visit.box, page.visit.blocked, page.visit.unreachable, page.given]).toEqual(["asleep", undefined, true, ["one"]]);
    expect(page.asked.filter((one) => one === "me")).toHaveLength(before + 1);
    page.setMe(ME);
    await page.pass(60_000);
    expect(page.visit.unreachable).toBe(false);
  });

  it("has the account read when the computer goes to sleep under a page watching it without the person's asking, and not when they switched it off", async () => {
    const fell = await openedAwake();
    const before = fell.asked.filter((one) => one === "me").length;
    await fell.hear("sleep", { kind: "sleep", dueInMs: 0 });
    await fell.end("box_ended");
    expect([fell.visit.box, fell.asked.filter((one) => one === "me").length]).toEqual(["asleep", before + 1]);
    const asked = await openedAwake();
    const reads = asked.asked.filter((one) => one === "me").length;
    await asked.visit.sleep();
    await asked.end("box_ended");
    expect([asked.visit.box, asked.asked.filter((one) => one === "me").length]).toEqual(["asleep", reads]);
    // Nor when the box says it sleeps, and its stream ends, before the switch-off itself has answered.
    let closed = (): void => {};
    const early = await openedAwake({ closing: () => new Promise<void>((resolve) => { closed = resolve; }) });
    const earlier = early.asked.filter((one) => one === "me").length;
    const off = early.visit.sleep();
    await early.settle();
    await early.hear("sleep", { kind: "sleep", dueInMs: 0 });
    await early.end("box_ended");
    closed();
    await off;
    expect([early.visit.box, early.asked.filter((one) => one === "me").length]).toEqual(["asleep", earlier]);
  });

  it("ends a refusal for the balance when credit arrives: the computer is off again and can be switched on", async () => {
    const page = await openedAsleep({ opens: [{ kind: "refused", reason: "balance" }] });
    page.setMe({ ...ME, balance: { available: 1, open_floor: 10, can_open: false } } as Me);
    await page.visit.send("one");
    await page.settle();
    expect([page.visit.canOpen, page.visit.blocked]).toEqual([false, { kind: "refused", reason: "balance" }]);
    page.setMe(ME);
    await page.pass(60_000);
    expect([page.visit.canOpen, page.visit.blocked, page.visit.box]).toEqual([true, undefined, "asleep"]);
    // While the account still says it can open, the platform's refusal stands: it is what the page knows.
    const lagging = await openedAsleep({ opens: [{ kind: "refused", reason: "balance" }] });
    await lagging.visit.send("one");
    await lagging.settle();
    await lagging.pass(60_000);
    expect([lagging.visit.canOpen, lagging.visit.blocked]).toEqual([true, { kind: "refused", reason: "balance" }]);
  });

  it("says once the open that dropped the person's default, through the new life that start brings, and lets it go as pi's notices go", async () => {
    const notices = (page: { readonly visit: Visit }): readonly string[] => page.visit.stream.notices.map((one) => `${one.id} ${one.message}`);
    const page = await openedAsleep({ opens: [{ kind: "open", dropped: "openrouter/gone/not-served" }, { kind: "open" }], droppedLine: (model) => `dropped ${model}` });
    const opened = page.visit.wake();
    await page.settle();
    await page.hear("life", { kind: "life", epoch: "b".repeat(32) });
    expect(await opened).toBe(true);
    expect(notices(page)).toEqual(["cx:default-dropped dropped openrouter/gone/not-served"]);
    await page.pass(NOTICE_MS);
    expect(notices(page)).toEqual([]);
    // Without words for it, the page draws nothing of it.
    const quiet = await openedAsleep({ opens: [{ kind: "open", dropped: "openrouter/gone/not-served" }] });
    const woke = quiet.visit.wake();
    await quiet.settle();
    await quiet.hear("life", { kind: "life", epoch: EPOCH });
    await woke;
    expect(notices(quiet)).toEqual([]);
  });

});

describe("what cx's cards ask of the computer", () => {
  it("says a switch-off did not finish when the box refuses it as busy, and keeps the computer on", async () => {
    const page = await openedAwake({ closeAnswer: "busy" });
    await page.visit.sleep();
    expect([page.asked.includes("close"), page.visit.failed, page.visit.box]).toEqual([true, "close", "awake"]);
  });

  it("draws a switch-off that did not finish as the platform reads the computer, on, and the line about it goes with the next state drawn", async () => {
    let page!: Awaited<ReturnType<typeof openedAwake>>;
    // The box began its close and said so, then the platform's request for it ended without the box's answer.
    page = await openedAwake({ closing: async () => { await page.hear("sleep", { kind: "sleep", dueInMs: 0 }); throw new Error("close answered 502"); } });
    page.setMe({ ...ME, machine: "on" } as Me);
    await page.visit.sleep();
    const drawn = (): string => kindOf({ pending: false, box: page.visit.box, closing: page.visit.closing, atWork: page.visit.atWork, refusal: page.visit.blocked, floor: false, unreachable: page.visit.unreachable });
    expect([drawn(), page.visit.failed]).toEqual(["on", "close"]);
    // The next state drawn takes the line with it: here the computer going off.
    page.setMe({ ...ME, machine: "off" } as Me);
    await page.end("box_ended", 200);
    await page.pass(WAIT_MS);
    expect([page.visit.box, page.visit.failed]).toEqual(["asleep", undefined]);
  });

  it("takes the line about a switch-off that did not finish away as a start begins, where the platform could not be read at its end", async () => {
    let page!: Awaited<ReturnType<typeof openedAwake>>;
    page = await openedAwake({ closing: async () => { await page.hear("sleep", { kind: "sleep", dueInMs: 0 }); throw new Error("close answered 502"); } });
    page.setMe(undefined as unknown as Me);
    await page.visit.sleep();
    expect(page.visit.failed).toBe("close");
    page.setMe({ ...ME, machine: "off" } as Me);
    const starting = page.visit.wake();
    await page.settle();
    expect([page.visit.box, page.visit.failed]).toEqual(["waking", undefined]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await starting;
  });

  it("draws a switch-off whose request failed as done when the platform reads the computer off, with no line", async () => {
    let page!: Awaited<ReturnType<typeof openedAwake>>;
    page = await openedAwake({ closing: async () => { await page.hear("sleep", { kind: "sleep", dueInMs: 0 }); throw new Error("close answered 502"); } });
    page.setMe({ ...ME, machine: "off" } as Me);
    await page.visit.sleep();
    expect([page.visit.box, page.visit.closing, page.visit.failed]).toEqual(["asleep", false, undefined]);
  });

  it.each(["busy", "fails"] as const)("lets go of what a switch-off waits on once the box answers it %s, as one it closes does", async (outcome) => {
    let fails = outcome === "fails";
    const options: { closeAnswer: "closed" | "busy"; closing: () => Promise<void> } = { closeAnswer: outcome === "busy" ? "busy" : "closed", closing: async () => { if (fails) throw new Error("close failed"); } };
    const page = await openedAwake(options);
    for (let press = 0; press < 10; press++) await page.visit.sleep();
    const kept = page.visit.closesWaiting;
    fails = false;
    options.closeAnswer = "closed";
    await page.visit.sleep();
    expect([kept, page.visit.closesWaiting, page.visit.box]).toEqual([0, 0, "asleep"]);
  });

  it("opens a sleeping box by the same gate as a first message, and does nothing for a box already awake", async () => {
    const asleep = await openedAsleep();
    const waking = asleep.visit.wake();
    await asleep.settle();
    await asleep.hear("life", { kind: "life", epoch: EPOCH });
    expect([await waking, asleep.asked.slice(2)]).toEqual([true, ["open", `stream ${EPOCH}:80`, "heard"]]);
    const awake = await openedAwake();
    expect(await awake.visit.wake()).toBe(true);
    expect(awake.asked.includes("open")).toBe(false);
  });

  it("opens a box heard awake once a command it was not there to take says so, the one open shared, and draws no start until something says it was off", async () => {
    const page = await openedAwake();
    const before = page.asked.length;
    page.visit.notThere(page.visit.found);
    expect([page.visit.awake, page.visit.box]).toEqual([false, "awake"]);
    const one = page.visit.wake();
    const two = page.visit.wake();
    await page.settle();
    expect(page.visit.box).toBe("awake");
    await page.hear("life", { kind: "life", epoch: EPOCH });
    expect([await one, await two, page.visit.awake, page.asked.slice(before).filter((ask) => ask === "open" || ask.startsWith("stream"))]).toEqual([true, true, true, ["open", `stream ${EPOCH}:80`]]);
    // A box the page already does not hear as on is left as it is: its open is the one a wake asks.
    const asleep = await openedAsleep();
    asleep.visit.notThere(asleep.visit.found);
    expect([asleep.visit.box, asleep.asked.includes("open")]).toEqual(["asleep", false]);
  });

  /** Files the page uploads through the visit, each first begin refused for the box's state and answered when the test says. */
  const refusedUploads = (page: Awaited<ReturnType<typeof openedAwake>>) => {
    const refusals = new Map<string, () => void>();
    const ends = new Map<string, number>();
    const tries = new Map<string, number>();
    const uploads = new FileUploads({
      wake: () => page.visit.wake(), why: () => undefined, found: () => page.visit.found, notThere: (found) => page.visit.notThere(found), changed: () => undefined, tell: () => undefined,
      command: async (command) => {
        if (command["op"] === "begin") {
          const name = String(command["name"]);
          tries.set(name, (tries.get(name) ?? 0) + 1);
          if (tries.get(name) === 1) return new Promise((_, reject) => { refusals.set(name, () => reject(new NotRunning())); });
          return { data: { upload: name } };
        }
        if (command["op"] === "piece") return { data: { received: 3 } };
        if (command["op"] === "end") { const name = String(command["upload"]); ends.set(name, (ends.get(name) ?? 0) + 1); return { data: { name } }; }
        return {};
      },
    });
    const flush = async (): Promise<void> => { for (let n = 0; n < 8; n++) await new Promise((resolve) => setTimeout(resolve, 0)); };
    return { uploads, refusals, ends, flush, opens: () => page.asked.filter((one) => one === "open").length };
  };

  for (const late of [false, true]) {
    it(`opens the box once for three files refused together, however late an old refusal arrives (${late ? "the third after the box was heard again" : "all three before"})`, async () => {
      const page = await openedAwake();
      const { uploads, refusals, ends, flush, opens } = refusedUploads(page);
      uploads.add(["a.txt", "b.txt", "c.txt"].map((name) => new File(["abc"], name)));
      await flush();
      expect([[...refusals.keys()], opens()]).toEqual([["a.txt", "b.txt", "c.txt"], 0]);
      refusals.get("a.txt")!(); refusals.get("b.txt")!();
      if (!late) refusals.get("c.txt")!();
      await flush();
      expect(opens()).toBe(1);
      await page.hear("life", { kind: "life", epoch: EPOCH });
      await flush();
      // The third was sent before the box was found up again: its refusal is old news, and the file goes again without another open.
      if (late) { refusals.get("c.txt")!(); await flush(); }
      expect([uploads.cards.map((card) => card.state), [...ends.values()], opens()]).toEqual([["done", "done", "done"], [1, 1, 1], 1]);
    });
  }

  it("reads the account every WAIT_MS while cx works, so the balance beside the chat follows a turn's calls, and stops once it rests", async () => {
    const page = await openedAwake();
    const reads = (): number => page.asked.filter((one) => one === "me").length;
    const before = reads();
    await page.hear("turn", { kind: "turn", running: true });
    await page.pass(WAIT_MS);
    await page.pass(WAIT_MS);
    const working = reads() - before;
    await page.hear("turn", { kind: "turn", running: false });
    await page.pass(WAIT_MS);
    await page.pass(10 * WAIT_MS);
    expect([working, reads() - before]).toEqual([2, 3]);
  });

  it("cuts no stream that holds a running turn for a refused upload: the page is still drawn working, and the upload waits for the one open", async () => {
    const page = await openedAwake({ pi: { running: true, queued: [], read: [] } });
    await page.hear("turn", { kind: "turn", running: true });
    const before = page.live();
    const { uploads, refusals, flush, opens } = refusedUploads(page);
    uploads.add([new File(["abc"], "busy.txt")]);
    await flush();
    refusals.get("busy.txt")!();
    await flush();
    expect([before.closed, working(page.visit.stream), page.visit.running, page.visit.awake, opens(), page.connections.filter((one) => !one.closed).length]).toEqual([false, true, true, true, 1, 1]);
    expect(uploads.cards.map((card) => card.state)).toEqual(["done"]);
    // The next wake asks nothing: the open answered.
    expect([await page.visit.wake(), opens()]).toEqual([true, 1]);
  });

  /** The platform's own reader over canned answers: the open a page asks, read as the live page reads it. */
  const platformOver = (answer: () => Response): PlatformBackend => new PlatformBackend({
    fetch: (async () => answer()) as typeof fetch, eventSource: () => { throw new Error("no stream on this adapter"); }, clientId: "test",
    go: () => undefined, leaving: { set: () => undefined, take: () => false }, renewing: { set: () => undefined, take: () => undefined }, session: () => true,
  });
  const RECOVERY_ANSWERS = {
    "refused for management, 503": () => Response.json({ error: "management_unavailable", at: "control_unavailable" }, { status: 503 }),
    "refused for the balance, 409": () => Response.json({ kind: "refused", reason: "balance" }, { status: 409 }),
    "still opening": (n: number) => (n === 1 ? Response.json({}) : Response.json({ error: "session already opening" }, { status: 500 })),
  } as const;
  for (const [name, answer] of Object.entries(RECOVERY_ANSWERS)) {
    it(`keeps a running turn drawn working and stoppable when the open a refused upload asks is ${name}: the card alone takes the answer`, async () => {
      const page = await openedAwake({ pi: { running: true, queued: [], read: [] } });
      let requests = 0;
      const platform = platformOver(() => answer(++requests));
      vi.spyOn(page.visit.ports.backend, "open").mockImplementation(async () => { page.asked.push("open"); return platform.open(); });
      await page.hear("turn", { kind: "turn", running: true });
      const before = page.live();
      const { uploads, refusals, flush, opens } = refusedUploads(page);
      uploads.add([new File(["abc"], "busy.txt")]);
      await flush();
      refusals.get("busy.txt")!();
      await flush();
      const scene = kindOf({ pending: false, box: page.visit.box, closing: page.visit.closing, atWork: page.visit.atWork, refusal: page.visit.blocked, floor: false, unreachable: page.visit.unreachable });
      expect([before.closed, working(page.visit.stream), page.visit.running, page.visit.stoppable, page.visit.box, scene, opens()]).toEqual([false, true, true, true, "awake", "working", 1]);
      expect(uploads.cards.map((card) => card.state)).toEqual([name === "still opening" ? "done" : "failed"]);
    });
  }

  it("draws no line and no Stop once a run pi died in has its error message and the turn's end, the answer half heard before it", async () => {
    const page = await openedAwake();
    await page.visit.send("hello");
    await page.settle();
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: [said(81, "hello")] });
    await page.hear("delta", { kind: "delta", body: { form: "message_delta", event: "text_start", contentIndex: 0 } });
    await page.hear("delta", { kind: "delta", body: { form: "message_delta", event: "text_delta", contentIndex: 0, delta: "Working on" } });
    const answering = lineOf({ stream: page.visit.stream, atWork: page.visit.atWork, starting: false });
    expect([typeof answering === "object" ? answering.key : answering, page.visit.stoppable]).toEqual(["line.answering", true]);
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: [entry(82, { form: "message", role: "assistant", content: [], stopReason: "error", errorMessage: "pi exited during the run (ended by SIGKILL)" })] });
    // Until the turn's end is heard, the line stays on the answer under the red line, as the picture of it showed.
    const unheard = lineOf({ stream: page.visit.stream, atWork: page.visit.atWork, starting: false });
    expect([typeof unheard === "object" ? [unheard.key, unheard.target] : unheard, page.visit.stoppable]).toEqual([["line.answering", `${EPOCH}:82`], true]);
    await page.hear("turn", { kind: "turn", running: false });
    expect([lineOf({ stream: page.visit.stream, atWork: page.visit.atWork, starting: false }), page.visit.atWork, page.visit.stoppable]).toEqual([undefined, false, false]);
  });

  it("counts pi at work from a message sent until its turn ends: the switch sends no close before the box names the turn, and cx reads the message", async () => {
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const page = await openedAwake({ beforeSend: () => held });
    const sending = page.visit.send("price history");
    await page.settle();
    // Waiting on a pick, before the prompt is on its way: at work, and cx reads what was sent.
    expect([page.visit.atWork, page.visit.idle, turnOf(page.visit.stream, page.visit.atWork)]).toEqual([true, false, "reading"]);
    await page.visit.sleep();
    release();
    await sending;
    // The box took the prompt and has not yet named its turn.
    expect(page.visit.atWork).toBe(true);
    await page.visit.sleep();
    await page.hear("turn", { kind: "turn", running: true });
    await page.visit.sleep();
    await page.hear("turn", { kind: "turn", running: false });
    expect([page.visit.atWork, page.visit.idle]).toEqual([false, true]);
    expect(page.asked.includes("close")).toBe(false);
  });

  it("draws cx idle again once a message is given back, the switch offered, with no other event", async () => {
    const page = await openedAwake();
    page.failCommands();
    await page.visit.send("price history");
    expect([page.given, page.visit.atWork, page.drawn.at(-1)]).toEqual([["price history"], false, true]);
  });

  it("reads the account again when a message is refused, so a balance that ran out closes the composer", async () => {
    const page = await openedAwake();
    page.failCommands(["prompt"]);
    page.setMe({ ...ME, balance: { available: -1, open_floor: 10, can_open: false } } as Me);
    const before = page.asked.length;
    await page.visit.send("price history");
    await page.settle();
    expect(page.asked.slice(before)).toEqual(["prompt price history steer", "me"]);
    expect([page.given, page.visit.canOpen]).toEqual([["price history"], false]);
  });

  it("draws the whole page at a delivery's end only when pi is no longer at work", async () => {
    const page = await openedAwake();
    await page.visit.send("hello");
    expect([page.visit.atWork, page.whats.at(-1)]).toEqual([true, "stream"]);
  });

  it("frees cx's actions after a short wait for a message the box took that starts no turn", async () => {
    const page = await openedAwake();
    await page.visit.send("/an-extension-command");
    expect(page.visit.atWork).toBe(true);
    await page.pass(TURN_WAIT_MS);
    expect([page.visit.atWork, page.visit.idle]).toEqual([false, true]);
  });

  it("asks for no open while the balance is under the open floor, which is where the computer is not offered", async () => {
    const page = await openedAsleep({ me: { ...ME, balance: { available: 1, open_floor: 10, can_open: false } } as Me });
    expect(page.visit.canOpen).toBe(false);
    expect(await page.visit.wake()).toBe(false);
    expect(page.asked.includes("open")).toBe(false);
  });

  it("puts an idle box to sleep by the box's own close, and takes the end that follows as sleep, not as a box to look for", async () => {
    const page = await openedAwake();
    await page.visit.sleep();
    expect(page.asked.at(-1)).toBe("close");
    expect(page.visit.box).toBe("asleep");
    await page.hear("sleep", { kind: "sleep", dueInMs: 0 });
    await page.end("box_ended");
    await page.pass(60_000);
    expect(page.asked.at(-1)).toBe("close");
    expect(page.visit.box).toBe("asleep");
  });

  it("asks nothing of a box the box says is at work: no close, no compaction", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    expect(page.visit.idle).toBe(false);
    await page.visit.sleep();
    await page.visit.compact();
    expect(page.asked.slice(3)).toEqual([]);
  });

  it("compacts with pi's own command, and holds a message sent meanwhile until pi has answered", async () => {
    const page = await openedAwake();
    let answer: () => void = () => undefined;
    page.visit.ports.backend.command = (command) => {
      page.asked.push(String(command["type"]) + (command["message"] === undefined ? "" : ` ${String(command["message"])}`));
      return command["type"] === "compact" ? new Promise<void>((resolve) => { answer = resolve; }) : Promise.resolve();
    };
    const compacting = page.visit.compact();
    await page.settle();
    expect(page.visit.asked).toBe("compact");
    const sending = page.visit.send("after");
    await page.settle();
    expect(page.asked.slice(3)).toEqual(["compact"]);
    answer();
    await compacting;
    await sending;
    expect(page.asked.slice(3)).toEqual(["compact", "prompt after"]);
  });

  it("compacts on the person's last choice of model: the compaction waits for the picks still on their way, as a message does", async () => {
    let chosen = (): void => {};
    const picks = new Promise<void>((resolve) => { chosen = resolve; });
    const page = await openedAwake({ beforeSend: () => picks });
    const compacting = page.visit.compact();
    await page.settle();
    expect(page.asked.slice(3)).toEqual([]);
    chosen();
    await compacting;
    expect(page.asked.slice(3)).toEqual(["compact"]);
  });

  it("says a request that did not complete, and leaves the box as it was", async () => {
    const page = await openedAwake();
    page.failCommands();
    await page.visit.compact();
    expect([page.visit.failed, page.visit.asked, page.visit.box]).toEqual(["compact", undefined, "awake"]);
  });

  it("asks nothing more while a compaction it asked is unanswered: a second ask is not sent", async () => {
    const page = await openedAwake();
    const answers: (() => void)[] = [];
    page.visit.ports.backend.command = (command) => {
      page.asked.push(String(command["type"]));
      return command["type"] === "compact" ? new Promise<void>((resolve) => { answers.push(resolve); }) : Promise.resolve();
    };
    const first = page.visit.compact();
    await page.settle();
    const later = [page.visit.compact(), page.visit.sleep()];
    await page.settle();
    expect([page.visit.asked, page.asked.slice(3)]).toEqual(["compact", ["compact"]]);
    for (const answer of answers) answer();
    await Promise.all([first, ...later]);
    expect([page.visit.asked, page.asked.slice(3), page.visit.box]).toEqual([undefined, ["compact"], "awake"]);
  });

  it("says no failure answered to a Summarise after a compaction ended: the summary it asked for is written", async () => {
    let release!: () => void;
    const wait = new Promise<void>((done) => { release = done; });
    const page = await openedAwake({ hold: (type) => (type === "compact" ? wait : undefined) });
    page.failCommands(["compact"]);
    const asking = page.visit.compact();
    await page.settle();
    await page.hear("compaction", { kind: "compaction", running: true });
    await page.hear("entry", entry(90, { form: "compaction", summary: "finished", firstKeptEntryId: "e1", tokensBefore: 90_000 }));
    await page.hear("compaction", { kind: "compaction", running: false });
    release();
    await asking;
    expect([page.visit.failed, page.visit.stream.tidying, page.visit.atWork]).toEqual([undefined, false, false]);
  });

  it("asks no second compaction while pi writes a summary, though no turn is said to run: cx's card offers none", async () => {
    const page = await openedAwake();
    await page.hear("compaction", { kind: "compaction", running: true });
    expect([page.visit.idle, page.visit.atWork]).toEqual([false, true]);
    await page.visit.compact();
    expect(page.asked.slice(3)).toEqual([]);
    await page.hear("compaction", { kind: "compaction", running: false });
    expect(page.visit.idle).toBe(true);
  });

  it("clears a compaction that did not finish once one ends, by its summary or by pi done writing one, and leaves nothing at work", async () => {
    const bySummary = await openedAwake();
    await bySummary.hear("turn", { kind: "turn", running: false });
    bySummary.failCommands(["compact"]);
    await bySummary.visit.compact();
    await bySummary.hear("compaction", { kind: "compaction", running: true });
    await bySummary.hear("turn", { kind: "turn", running: true });
    expect(bySummary.visit.failed).toBe("compact");
    await bySummary.hear("entry", entry(90, { form: "compaction", summary: "the story so far", firstKeptEntryId: "e1", tokensBefore: 90_000 }));
    expect(bySummary.visit.failed).toBeUndefined();
    await bySummary.hear("compaction", { kind: "compaction", running: false });
    await bySummary.hear("turn", { kind: "turn", running: false });
    expect([bySummary.visit.atWork, bySummary.visit.idle]).toEqual([false, true]);
    const byEnd = await openedAwake();
    byEnd.failCommands(["compact"]);
    await byEnd.visit.compact();
    await byEnd.hear("compaction", { kind: "compaction", running: true });
    expect(byEnd.visit.failed).toBe("compact");
    await byEnd.hear("compaction", { kind: "compaction", running: false });
    expect([byEnd.visit.failed, byEnd.visit.atWork]).toEqual([undefined, false]);
  });
});

describe("how a stream ends", () => {
  it("keeps a running turn's Stop and its line across a stream that reached its age, until the box says the turn ended", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    await page.end("max_age");
    // The new connection, before the box has said anything on it, and after its life: cx is still at work, and can be stopped.
    expect([page.visit.connection, page.visit.running, page.visit.stoppable, page.visit.atWork]).toEqual(["open", true, true, true]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    expect([page.visit.running, page.visit.stoppable, page.visit.atWork]).toEqual([true, true, true]);
    await page.hear("turn", { kind: "turn", running: false });
    expect([page.visit.running, page.visit.stoppable, page.visit.atWork]).toEqual([false, false, false]);
    // A stream that truly broke draws no Stop while it connects again, as before.
    const broke = await openedAwake();
    await broke.hear("turn", { kind: "turn", running: true });
    await broke.end("box_silent");
    expect([broke.visit.connection, broke.visit.stoppable]).toEqual(["reconnecting", false]);
  });

  it("draws a sleeping box's page asleep at once when routing says the box is not running: one stream, and no word of reconnecting", async () => {
    const page = world();
    await page.visit.look();
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: stored });
    await page.end("box_unavailable", 409);
    expect([page.visit.box, page.visit.connection]).toEqual(["asleep", "idle"]);
    await page.pass(60_000);
    expect(page.asked).toEqual(["me", `stream ${EPOCH}:newest`]);
  });

  it("follows a running turn through a reconnect routing could not answer once: the account is read, the stream asked again, and the answer draws", async () => {
    const page = await openedAwake();
    await page.visit.send("a long question");
    await page.hear("turn", { kind: "turn", running: true });
    await page.end("max_age");
    const before = page.asked.length;
    // The reconnect's call to the box answers 503: routing could not say whether the box runs, so it is not taken as asleep.
    await page.end("box_unavailable", 503);
    expect([page.visit.box, page.visit.connection]).toEqual(["awake", "reconnecting"]);
    await page.pass(1_000);
    expect(page.asked.slice(before)).toEqual(["me", `stream ${EPOCH}:80`]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: [
      entry(81, { form: "message", role: "user", content: "a long question", timestamp: 0 }),
      answered(82, "the long answer"),
    ] });
    await page.hear("turn", { kind: "turn", running: false });
    expect(page.visit.stream.items.at(-1)).toMatchObject({ kind: "assistant", blocks: [{ kind: "text", text: "the long answer" }] });
    expect([page.visit.box, page.visit.connection]).toEqual(["awake", "open"]);
  });

  it("takes a box stopped mid-turn, its sleep frame missed, as asleep when routing says it is not running, so a message sent then goes to the platform, which opens it", async () => {
    const page = await openedAwake();
    await page.visit.send("a long question");
    await page.hear("turn", { kind: "turn", running: true });
    await page.end("max_age");
    await page.end("box_unavailable", 409);
    expect([page.visit.box, page.visit.connection]).toEqual(["asleep", "idle"]);
    const before = page.asked.length;
    const sending = page.visit.send("are you there");
    await page.settle();
    // The message goes to the platform, which opens the box for it; the page listens once it is answered.
    expect(page.asked.slice(before)).toEqual(["prompt are you there steer", "platform open", `stream ${EPOCH}:80`]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await sending;
    expect(page.asked.slice(before)).toEqual(["prompt are you there steer", "platform open", `stream ${EPOCH}:80`, "heard"]);
  });

  it("follows a running turn through a stream the box's side broke: the stream is asked again, and the rest of the answer draws", async () => {
    const page = await openedAwake();
    await page.visit.send("a long question");
    await page.hear("turn", { kind: "turn", running: true });
    const before = page.asked.length;
    // The platform's read of the box broke mid-turn; the relay ends it box_ended, which says nothing of sleep.
    await page.end("box_ended");
    expect([page.visit.box, page.visit.connection]).toEqual(["awake", "reconnecting"]);
    await page.pass(1_000);
    expect(page.asked.slice(before)).toEqual(["me", `stream ${EPOCH}:80`]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: [
      entry(81, { form: "message", role: "user", content: "a long question", timestamp: 0 }),
      answered(82, "the long answer"),
    ] });
    await page.hear("turn", { kind: "turn", running: false });
    expect(page.visit.stream.items.at(-1)).toMatchObject({ kind: "assistant", blocks: [{ kind: "text", text: "the long answer" }] });
    expect([page.visit.box, page.visit.connection]).toEqual(["awake", "open"]);
  });

  it("sends a message to the platform to keep for a box whose stream broke, since nothing has heard it since", async () => {
    const page = await openedAwake();
    await page.end("box_ended");
    const before = page.asked.length;
    const sending = page.visit.send("still there?");
    await page.settle();
    // The message goes to the platform, which opens the box for it; the page listens once it is answered.
    expect(page.asked.slice(before)).toEqual(["prompt still there? steer", "platform open", `stream ${EPOCH}:80`]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await sending;
    expect(page.asked.slice(before)).toEqual(["prompt still there? steer", "platform open", `stream ${EPOCH}:80`, "heard"]);
  });

  it("draws a box asleep once the platform says its Machine is off, instead of reconnecting to it for ever", async () => {
    const page = await openedAwake();
    page.setMe({ ...ME, machine: "off" });
    await page.end("box_ended");
    const before = page.asked.length;
    await page.pass(1_000);
    expect([page.visit.box, page.visit.connection, page.asked.slice(before)]).toEqual(["asleep", "idle", ["me"]]);
    await page.pass(60_000);
    expect(page.asked.slice(before)).toEqual(["me"]);
  });

  it("reads a box drawn asleep only because an open failed by what the platform says next, and listens to it when its Machine is on", async () => {
    const page = await openedAwake({ opens: [{ kind: "failed", step: "box", status: 503, reason: "indeterminate" }] });
    await page.end("box_ended");
    await page.pass(1_000);
    await page.visit.send("hello");
    await page.settle();
    expect([page.visit.box, page.visit.blocked?.kind]).toEqual(["asleep", "failed"]);
    page.setMe({ ...ME, machine: "on" });
    const before = page.asked.length;
    // The stream to the box that runs ends as a broken one does, not as sleep: the failed open said nothing of the box.
    await page.end("box_ended");
    expect(page.visit.connection).toBe("reconnecting");
    await page.pass(2_000);
    expect(page.asked.slice(before)).toEqual(["me", `stream ${EPOCH}:80`]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    expect([page.visit.box, page.visit.blocked, page.visit.awake]).toEqual(["awake", undefined, true]);
  });

  it("stops reconnecting to a box drawn asleep only because an open failed once the platform says its Machine is off", async () => {
    const page = await openedAwake({ opens: [{ kind: "failed", step: "box", status: 503, reason: "indeterminate" }] });
    await page.end("box_ended");
    await page.pass(1_000);
    await page.visit.send("hello");
    await page.settle();
    expect([page.visit.box, page.visit.blocked?.kind]).toEqual(["asleep", "failed"]);
    page.setMe({ ...ME, machine: "off" });
    const before = page.asked.length;
    await page.end("box_ended");
    expect(page.visit.connection).toBe("reconnecting");
    await page.pass(2_000);
    expect([page.visit.box, page.visit.connection, page.asked.slice(before)]).toEqual(["asleep", "idle", ["me"]]);
    await page.pass(60_000);
    expect([page.visit.connection, page.asked.slice(before)]).toEqual(["idle", ["me"]]);
  });

  it("takes a stream's word over the platform's: a Machine read off while the page holds a stream or opens leaves the box as heard", async () => {
    const held = await openedAwake();
    held.setMe({ ...ME, machine: "off" });
    await held.visit.look();
    expect([held.visit.box, held.visit.awake]).toEqual(["awake", true]);
  });

  it("asks once more after a box stopped mid-turn with its sleep frame missed, and draws it asleep on routing's 409", async () => {
    const page = await openedAwake();
    await page.visit.send("a long question");
    await page.hear("turn", { kind: "turn", running: true });
    const before = page.asked.length;
    await page.end("box_ended");
    await page.pass(1_000);
    await page.end("box_unavailable", 409);
    expect([page.visit.box, page.visit.connection]).toEqual(["asleep", "idle"]);
    await page.pass(60_000);
    // Asleep without the person's asking, the account is read once more: the balance may be why.
    expect(page.asked.slice(before)).toEqual(["me", `stream ${EPOCH}:80`, "me"]);
  });

  it("draws the answer to a message the platform opened the box for when the stream ends box_ended just after that open", async () => {
    const page = await openedAsleep();
    const sending = page.visit.send("wake up");
    await page.settle();
    const before = page.asked.length;
    // The platform answered once it opened the box, and the page connected for it; that stream stops before the box is heard.
    await page.end("box_ended");
    expect(page.visit.connection).toBe("reconnecting");
    await page.pass(1_000);
    expect(page.asked.slice(before)).toEqual(["me", `stream ${EPOCH}:80`]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await sending;
    // The platform sent it once the box was up; the page sends it no second time.
    expect(page.asked.filter((one) => one.startsWith("prompt"))).toEqual(["prompt wake up steer"]);
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: [
      entry(81, { form: "message", role: "user", content: "wake up", timestamp: 2_000 }),
      answered(82, "awake now"),
    ] });
    expect(page.visit.stream.items.at(-1)).toMatchObject({ kind: "assistant", blocks: [{ kind: "text", text: "awake now" }] });
  });

  it("takes a box that said it is going to sleep as asleep when its stream ends", async () => {
    const page = await openedAwake();
    await page.hear("sleep", { kind: "sleep", dueInMs: 0 });
    expect(page.visit.closing).toBe(true);
    await page.end("box_ended");
    expect(page.visit.box).toBe("asleep");
  });

  it("holds when the sleep is due as the box says it, and copies no threshold of its own", async () => {
    const page = await openedAwake();
    await page.hear("sleep", { kind: "sleep", dueInMs: 600_000 });
    expect(page.visit.sleepDueAt).toBe(600_000);
    await page.hear("sleep", { kind: "sleep", dueInMs: null });
    expect(page.visit.sleepDueAt).toBeUndefined();
  });

  it("connects again at once when the stream ages out, keeping what it knows of the box, and later for a stream that broke", async () => {
    const page = await openedAwake();
    await page.end("max_age");
    expect([page.asked.at(-1), page.visit.box]).toEqual([`stream ${EPOCH}:80`, "awake"]);
    await page.end("box_silent");
    expect(page.visit.connection).toBe("reconnecting");
    await page.pass(1_000);
    expect(page.asked.at(-1)).toBe(`stream ${EPOCH}:80`);
    await page.end("life_conflict");
    expect(page.visit.connection).toBe("held");
    await page.pass(60_000);
    page.visit.retry();
    expect(page.visit.connection).toBe("reconnecting");
  });
});

describe("a box opened again before its close ended", () => {
  // An open that overtakes a close finds the box still running: it opens again in the same process and answers at once. Its stream was
  // never ended, and a box names its life once on a stream: only a stream made after the open hears it.
  it("makes its stream again after an open that found the box closing, and is awake once the box names its life on it", async () => {
    const page = await openedAwake();
    // The box says it is going to sleep: its close is under way, asked in another tab or by its own timer.
    await page.hear("sleep", { kind: "sleep", dueInMs: 0 });
    const held = page.live();
    const before = page.asked.length;
    const woke = page.visit.wake();
    await page.settle();
    expect(page.asked.slice(before)).toEqual(["open", `stream ${EPOCH}:80`]);
    expect(held.closed).toBe(true);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    expect(await woke).toBe(true);
    expect([page.visit.box, starting(page)]).toEqual(["awake", false]);
  });

  it("makes its stream again when Switch on, pressed while the page's own switch-off closes the box, opens it once the close answers", async () => {
    let closed = (): void => {};
    let opened = (): void => {};
    const page = await openedAwake({ closing: () => new Promise<void>((done) => { closed = done; }), openAnswered: new Promise<void>((done) => { opened = done; }) });
    const off = page.visit.sleep();
    await page.settle();
    await page.hear("sleep", { kind: "sleep", dueInMs: 0 });
    const on = page.visit.wake();
    await page.settle();
    closed();
    await off;
    await page.settle();
    opened();
    await page.settle();
    expect(page.asked.filter((one) => one.startsWith("stream"))).toEqual([`stream ${EPOCH}:newest`, `stream ${EPOCH}:80`]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    expect(await on).toBe(true);
    expect([page.visit.box, starting(page)]).toEqual(["awake", false]);
  });

  it("makes its stream again when the platform opens a closing box for a message, and is awake once the box names its life on it", async () => {
    const page = await openedAwake();
    await page.hear("sleep", { kind: "sleep", dueInMs: 0 });
    const before = page.asked.length;
    const sending = page.visit.send("still there?");
    await page.settle();
    expect(page.asked.slice(before)).toEqual(["prompt still there? steer", "platform open", `stream ${EPOCH}:80`]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await sending;
    expect([page.visit.box, starting(page)]).toEqual(["awake", false]);
  });
});

describe("what the person sent is drawn once, in pi's words", () => {
  it("takes pi's rewritten record of a message, when the store brings it back, and is not left at work", async () => {
    // An account with no stored life and a box asleep: the message is drawn before any life is known, and the platform opens the box for it.
    const page = world({ kept: "" });
    await page.visit.look();
    await page.end("box_unavailable", 409);
    await page.pass(1_000);
    const sending = page.visit.send("/skill foo");
    await page.settle();
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await page.hear("turn", { kind: "turn", running: false });
    await sending;
    expect(page.asked.filter((one) => one.startsWith("prompt"))).toEqual(["prompt /skill foo steer"]);
    const sentAt = 1_000;
    await page.hear("turn", { kind: "turn", running: true });
    // The skill ran; the store holds pi's record of the message in the skill's words, not the person's.
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: [
      entry(1, { form: "message", role: "user", content: "Use the foo skill.", timestamp: sentAt + 40 }),
      answered(2, "done"),
    ] });
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await page.hear("turn", { kind: "turn", running: false });
    const users = page.visit.stream.items.filter((item) => item.kind === "user");
    expect(users.map((item) => item.kind === "user" && [item.text, item.pending])).toEqual([["Use the foo skill.", false]]);
    expect(working(page.visit.stream)).toBe(false);
  });
});

describe("the stream waits on nothing but the account", () => {
  it("reads what the page shows beside the account as it asks the stream, and not again for a reconnect", async () => {
    let glances = 0;
    const page = world({ glance: () => { glances++; } });
    await page.visit.look();
    expect([page.asked, glances]).toEqual([["me", `stream ${EPOCH}:newest`], 1]);
    await page.end("store_failed");
    await page.pass(60_000);
    expect([page.asked.filter((one) => one.startsWith("stream")).length > 1, glances]).toEqual([true, 1]);
  });

  it("reads nothing beside an account that is signed out", async () => {
    let glances = 0;
    const page = world({ me: { kind: "signed_out" }, glance: () => { glances++; } });
    await page.visit.look();
    expect(glances).toBe(0);
  });
});

describe("the part of the life before the one the page holds", () => {
  const newest = { kind: "entries", epoch: EPOCH, entries: stored.slice(40), from: 41, earlier: true };

  it("is read when asked, one read at a time, and put before what the page holds", async () => {
    let answer: (part: EarlierPart) => void = () => undefined;
    const page = world({ history: () => new Promise((resolve) => { answer = resolve; }) });
    await page.visit.look();
    await page.hear("entries", newest);
    expect([page.visit.answered, page.visit.stream.items]).toMatchObject([true, { length: 40 }]);
    const reading = page.visit.loadEarlier();
    void page.visit.loadEarlier();
    expect([page.asked.filter((one) => one.startsWith("history")), page.visit.loadingEarlier]).toEqual([[`history ${EPOCH}:41`], true]);
    answer({ epoch: EPOCH, entries: stored.slice(0, 40), from: 1, earlier: false });
    await reading;
    expect([page.visit.loadingEarlier, page.visit.stream.items.length, page.visit.stream.from, page.visit.stream.earlier]).toEqual([false, 80, 1, false]);
    // Nothing is stored before the first entry: nothing more is asked.
    await page.visit.loadEarlier();
    expect(page.asked.filter((one) => one.startsWith("history"))).toHaveLength(1);
  });

  it("takes a failed read for a wait: its line stays, nothing asks again by itself, and the person's next arrival at the top reads", async () => {
    let fails = true;
    const page = world({ history: async (epoch) => { if (fails) throw new Error("/history answered 503"); return { epoch, entries: stored.slice(0, 40), from: 1, earlier: false }; } });
    const reads = (): number => page.asked.filter((one) => one.startsWith("history")).length;
    await page.visit.look();
    await page.hear("entries", newest);
    await page.visit.loadEarlier();
    await page.pass(60_000);
    expect([reads(), page.visit.loadingEarlier, page.visit.stream.items.length]).toEqual([1, true, 40]);
    fails = false;
    await page.visit.loadEarlier();
    expect([reads(), page.visit.loadingEarlier, page.visit.stream.items.length]).toEqual([2, false, 80]);
  });

  it("ends a failed read's wait when a new life comes, which holds nothing earlier, and asks nothing more", async () => {
    const NEXT = "b".repeat(32);
    const page = world({ history: async () => { throw new Error("/history answered 503"); } });
    await page.visit.look();
    await page.hear("entries", newest);
    await page.visit.loadEarlier();
    expect(page.visit.loadingEarlier).toBe(true);
    await page.hear("entries", { kind: "entries", epoch: NEXT, entries: stored.slice(0, 3), from: 1, earlier: false });
    await page.visit.loadEarlier();
    expect([page.visit.stream.epoch, page.visit.loadingEarlier, page.asked.filter((one) => one.startsWith("history")).length]).toEqual([NEXT, false, 1]);
  });

  it("is not asked by a page that holds the life from its start", async () => {
    const page = await openedAsleep();
    await page.visit.loadEarlier();
    expect(page.asked.some((one) => one.startsWith("history"))).toBe(false);
  });
});

describe("a waiting message taken back", () => {
  /** An awake box answering "one", with "two", "three" and "four" sent while it works: pi holds all three. */
  async function busy(options: Parameters<typeof world>[0] = {}) {
    const page = await openedAwake(options);
    await page.hear("turn", { kind: "turn", running: true });
    for (const message of ["two", "three", "four"]) { await page.visit.send(message); await page.pass(10); }
    page.piHolds(["two", "three", "four"]);
    return page;
  }
  type Page = Awaited<ReturnType<typeof busy>>;
  const sent = (page: Page): string[] => page.asked.filter((line) => /^(prompt|steer|clear_queue|abort|set_steering_mode)/.test(line));
  const waits = (page: Page): readonly string[] => page.visit.stream.items.flatMap((item) => (item.kind === "user" && item.pending ? [`${item.text}${item.queued === true ? "" : " (first)"}`] : []));
  const keyOf = (page: Page, words: string): string => page.visit.stream.items.find((item) => item.kind === "user" && item.pending && item.text === words)!.key;
  const stamps = (page: Page): readonly (number | undefined)[] => page.visit.stream.items.flatMap((item) => (item.kind === "user" && item.pending ? [item.sentAt] : []));
  /** pi's record of a message, stamped as pi stamps it: the moment it was queued. */
  const record = (page: Page, seq: number, content: string, timestamp: number) => page.hear("entry", entry(seq, { form: "message", role: "user", content, timestamp }));
  /** A wait the test ends. */
  const gate = (): { readonly wait: Promise<void>; readonly open: () => void } => { let open!: () => void; const wait = new Promise<void>((resolve) => { open = resolve; }); return { wait, open }; };

  it("is taken back from the platform while it opens the computer: it goes back as taken, the others go in their order, and pi is never sent it", async () => {
    const opening = gate();
    const page = await openedAsleep({ openAnswered: opening.wait });
    for (const message of ["one", "two", "three"]) void page.visit.send(message);
    await page.settle();
    expect(waits(page)).toEqual(["one (first)", "two", "three"]);
    await page.visit.withdraw(keyOf(page, "two"));
    expect([page.given, page.taken, waits(page)]).toEqual([["two"], ["two"], ["one (first)", "three"]]);
    expect(page.asked.filter((one) => one.startsWith("take back"))).toHaveLength(1);
    opening.open();
    await page.settle();
    expect(page.delivered).toEqual(["one", "three"]);
  });

  it("leaves the one behind it to start cx's turn when it was the first, and has pi sent nothing when it was the only one", async () => {
    const opening = gate();
    const page = await openedAsleep({ openAnswered: opening.wait });
    for (const message of ["one", "two"]) void page.visit.send(message);
    await page.settle();
    await page.visit.withdraw(keyOf(page, "one"));
    expect([page.taken, waits(page)]).toEqual([["one"], ["two (first)"]]);
    await page.visit.withdraw(keyOf(page, "two"));
    expect([page.taken, waits(page), page.visit.atWork]).toEqual([["one", "two"], [], true]);
    opening.open();
    await page.settle();
    await page.pass(TURN_WAIT_MS);
    expect([page.delivered, page.visit.atWork, page.given]).toEqual([[], false, ["one", "two"]]);
  });

  it("asks pi's whole queue back for one pi holds, and sends the others again in their order as any message goes", async () => {
    const page = await busy();
    const before = sent(page).length;
    expect(stamps(page)).toEqual([0, 10, 20]);
    await page.visit.withdraw(keyOf(page, "three"));
    await page.pass(10);
    expect(sent(page).slice(before)).toEqual(["clear_queue", "prompt two steer", "prompt four steer"]);
    expect([page.given, page.taken, waits(page)]).toEqual([["three"], ["three"], ["two", "four"]]);
    // Each is the box's again, known by its new moment there.
    expect(stamps(page)).toEqual([40, 40]);
  });

  it("gives nothing back that pi's loop took meanwhile, sends it no second time and draws no ✕ on it again: the queue's answer says which were still its to give", async () => {
    const page = await busy();
    page.piHolds(["three", "four"]);
    const before = sent(page).length;
    await page.visit.withdraw(keyOf(page, "two"));
    await page.pass(10);
    expect(sent(page).slice(before)).toEqual(["clear_queue", "prompt three steer", "prompt four steer"]);
    expect([page.given, waits(page)]).toEqual([[], ["two", "three", "four"]]);
    // The one the loop took offers no take-back again; the ones given back keep theirs.
    expect(["two", "three", "four"].map((text) => page.visit.late(keyOf(page, text)))).toEqual([true, false, false]);
    await record(page, 81, "two", 0);
    expect(waits(page)).toEqual(["three", "four"]);
    // One still pi's to give comes back, and the one the loop took is left to its record.
    const other = await busy();
    other.piHolds(["three", "four"]);
    await other.visit.withdraw(keyOf(other, "three"));
    await other.pass(10);
    expect(sent(other).slice(before)).toEqual(["clear_queue", "prompt four steer"]);
    expect([other.taken, waits(other)]).toEqual([["three"], ["two", "four"]]);
  });

  it("does nothing for a message pi has recorded, and nothing when pi gave no message back or did not answer", async () => {
    const page = await busy();
    const two = keyOf(page, "two");
    await record(page, 81, "two", 0);
    const before = sent(page).length;
    await page.visit.withdraw(two);
    expect(sent(page).slice(before)).toEqual([]);
    page.piHolds([]);
    await page.visit.withdraw(keyOf(page, "three"));
    await page.pass(10);
    expect([sent(page).slice(before), page.given, waits(page)]).toEqual([["clear_queue"], [], ["three", "four"]]);
    page.failCommands(["clear_queue"]);
    await page.visit.withdraw(keyOf(page, "four"));
    await page.pass(10);
    expect([sent(page).slice(before), page.given, waits(page)]).toEqual([["clear_queue", "clear_queue"], [], ["three", "four"]]);
  });

  it("waits for a message on its way to the box to be answered before it reads who holds it, so none is both given back and sent", async () => {
    const going = gate();
    let hold = false;
    const page = await busy({ hold: (type) => (hold && type === "prompt" ? going.wait : undefined) });
    hold = true;
    void page.visit.send("five");
    await page.settle();
    const before = sent(page).length;
    const taking = page.visit.withdraw(keyOf(page, "five"));
    await page.settle();
    expect([sent(page).slice(before), page.given]).toEqual([[], []]);
    hold = false;
    page.piHolds(["two", "three", "four", "five"]);
    going.open();
    await taking;
    await page.pass(10);
    expect(sent(page).slice(before)).toEqual(["clear_queue", "prompt two steer", "prompt three steer", "prompt four steer"]);
    expect([page.given, waits(page)]).toEqual([["five"], ["two", "three", "four"]]);
  });

  it("holds a message sent meanwhile until the others are on their way again, however long pi takes to answer", async () => {
    const answering = gate();
    const chosen = gate();
    let choosing = false;
    const page = await busy({ hold: (type) => (type === "clear_queue" ? answering.wait : undefined), beforeSend: () => (choosing ? chosen.wait : Promise.resolve()) });
    const before = sent(page).length;
    choosing = true;
    void page.visit.send("five");
    await page.settle();
    const taking = page.visit.withdraw(keyOf(page, "three"));
    choosing = false;
    chosen.open();
    await page.settle();
    expect(sent(page).slice(before)).toEqual(["clear_queue"]);
    answering.open();
    await taking;
    await page.pass(10);
    expect(sent(page).slice(before)).toEqual(["clear_queue", "prompt two steer", "prompt four steer", "prompt five steer"]);
    expect(waits(page)).toEqual(["two", "four", "five"]);
  });

  it("takes one out of the messages a Stop kept together before they are handed to pi, the first of them too", async () => {
    for (const which of ["three", "two"] as const) {
      const chosen = gate();
      let choosing = false;
      const page = await busy({ beforeSend: () => (choosing ? chosen.wait : Promise.resolve()) });
      choosing = true;
      const stopping = page.visit.stop();
      await page.settle();
      const before = sent(page).length;
      await page.hear("turn", { kind: "turn", running: false });
      await stopping;
      await page.settle();
      await page.visit.withdraw(keyOf(page, which));
      expect(page.taken).toEqual([which]);
      chosen.open();
      await page.pass(10);
      expect([which, sent(page).slice(before), waits(page)]).toEqual(which === "three"
        ? [which, ["prompt two steer", "steer four"], ["two (first)", "four"]]
        : [which, ["prompt three steer", "steer four"], ["three (first)", "four"]]);
    }
  });

  it("lets a Stop in flight say first what pi holds: taken back then, it leaves the messages the Stop kept, and pi's queue is asked for once", async () => {
    const page = await busy();
    const before = sent(page).length;
    const stopping = page.visit.stop();
    await page.settle();
    const taking = page.visit.withdraw(keyOf(page, "three"));
    await page.settle();
    expect([sent(page).slice(before), page.given]).toEqual([["clear_queue", "abort"], []]);
    await page.hear("turn", { kind: "turn", running: false });
    await stopping;
    await taking;
    await page.pass(10);
    expect(sent(page).slice(before)).toEqual(["clear_queue", "abort", "prompt two steer", "steer four"]);
    expect([page.taken, waits(page)]).toEqual([["three"], ["two (first)", "four"]]);
  });

  it("leaves a Stop that follows nothing to send twice: the others it put back are the page's own until the box takes them", async () => {
    const chosen = gate();
    let choosing = false;
    const page = await busy({ beforeSend: () => (choosing ? chosen.wait : Promise.resolve()) });
    choosing = true;
    const before = sent(page).length;
    await page.visit.withdraw(keyOf(page, "three"));
    await page.settle();
    const stopping = page.visit.stop();
    await page.settle();
    await page.hear("turn", { kind: "turn", running: false });
    await stopping;
    chosen.open();
    await page.pass(10);
    expect(sent(page).slice(before)).toEqual(["clear_queue", "clear_queue", "abort", "prompt two steer", "steer four"]);
    expect(page.given).toEqual(["three"]);
  });
  it("is not asked of pi while it tidies mid-run, when its loop holds a message its queue still names: asked once the tidying is over, and one the page still holds goes back at once", async () => {
    const page = await busy();
    const before = sent(page).length;
    await page.hear("compaction", { kind: "compaction", running: true });
    void page.visit.withdraw(keyOf(page, "three"));
    await page.pass(10);
    expect(sent(page).slice(before)).toEqual([]);
    // pi's loop took "two" before it began to tidy and delivers it afterwards: its queue no longer names it once that is done.
    page.piHolds(["three", "four"]);
    await page.hear("compaction", { kind: "compaction", running: false });
    await page.pass(10);
    expect(sent(page).slice(before)).toEqual(["clear_queue", "prompt four steer"]);
    expect(page.taken).toEqual(["three"]);
  });

  it("goes back when nobody holds it: pi at rest with an empty queue will never read it", async () => {
    const page = await busy();
    page.piHolds([]);
    await page.hear("turn", { kind: "turn", running: false });
    await page.visit.withdraw(keyOf(page, "three"));
    expect([page.taken, waits(page)]).toEqual([["three"], ["two", "four"]]);
  });
});

describe("Stop keeps what the person sent", () => {
  /** An awake box answering "one", with the messages sent while it works: "two" and "three" unless others are named. */
  async function busy(messages: readonly string[] = ["two", "three"], options: Parameters<typeof world>[0] = {}) {
    const page = await openedAwake(options);
    await page.hear("turn", { kind: "turn", running: true });
    for (const message of messages) { await page.visit.send(message); await page.pass(10); }
    return page;
  }
  const sent = (page: Awaited<ReturnType<typeof busy>>): string[] => page.asked.filter((line) => /^(prompt|steer|clear_queue|abort|set_steering_mode)/.test(line));
  const echoes = (page: Awaited<ReturnType<typeof busy>>) =>
    page.visit.stream.items.filter((item) => item.kind === "user" && item.pending).map((item) => item.kind === "user" && [item.text, item.queued === true]);
  const aborted = entry(81, { form: "message", role: "assistant", content: [], stopReason: "aborted", errorMessage: "This operation was aborted" });
  /** The stop answered and the stream saying no turn runs: what the page then does with what it kept. */
  async function stopped(page: Awaited<ReturnType<typeof busy>>): Promise<number> {
    const stopping = page.visit.stop();
    await page.settle();
    const before = sent(page).length;
    await page.hear("turn", { kind: "turn", running: false });
    await stopping;
    await page.pass(10);
    return before;
  }
  const said = (page: Awaited<ReturnType<typeof busy>>): readonly string[] => page.visit.stream.items.slice(80).flatMap((item) => (item.kind === "user" ? [`${item.text}${item.pending ? " (waits)" : ""}`] : []));

  it("clears pi's queue, stops, and once the stream says no turn runs puts every unrecorded message before pi together, in order, each in its own bubble", async () => {
    const page = await busy();
    const stopping = page.visit.stop();
    await page.settle();
    expect(sent(page)).toEqual(["prompt two steer", "prompt three steer", "clear_queue", "abort"]);
    // The stop's own entries come before the stream says no turn runs; until then nothing is sent again.
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: [aborted] });
    expect(sent(page)).toHaveLength(4);
    await page.hear("turn", { kind: "turn", running: false });
    await stopping;
    await page.pass(10);
    // pi reads its whole steering queue as a run starts only in mode `all`: the rest are queued while it rests, and the first starts the run.
    expect(sent(page).slice(4)).toEqual(["prompt two steer", "steer three"]);
    expect(page.given).toEqual([]);
    // Pi takes the first as a prompt, so its answer draws below it; the second waits below it until pi records both.
    expect(echoes(page)).toEqual([["two", false], ["three", true]]);
  });

  it("hands the kept messages to pi with steer and prompt alone, and asks nothing of pi's steering mode before or after pi has recorded them: the image sets it", async () => {
    const page = await busy(["two", "three", "four"]);
    const before = await stopped(page);
    expect(sent(page).slice(before)).toEqual(["prompt two steer", "steer three", "steer four"]);
    await page.hear("turn", { kind: "turn", running: true });
    const record = (seq: number, content: string) => page.hear("entry", entry(seq, { form: "message", role: "user", content, timestamp: 40 }));
    await record(82, "two");
    await record(83, "three");
    await record(84, "four");
    // Each record took its own echo's place: the box's moment for a message handed over again is the one its record is known by.
    expect(said(page)).toEqual(["two", "three", "four"]);
    await page.hear("turn", { kind: "turn", running: false });
    expect(sent(page).slice(before)).toHaveLength(3);
  });

  it("sends one pi would not take beside the first as a message of its own, after it, and the ones behind it after that, so none is read ahead of one sent before it; it gives nothing back", async () => {
    const page = await busy(["two", "three", "four"]);
    page.failCommands(["steer"]);
    const before = await stopped(page);
    expect(sent(page).slice(before)).toEqual(["prompt two steer", "steer three", "prompt three steer", "prompt four steer"]);
    expect(page.given).toEqual([]);
    expect(said(page)).toEqual(["two (waits)", "three (waits)", "four (waits)"]);
  });

  it("gives back the first alone when its prompt is not answered: the ones beside it were never sent, and go on together", async () => {
    let armed = false;
    const page = await busy(["two", "three", "four"], { hold: (type) => (armed && type === "prompt" ? (armed = false, Promise.reject(new Error("command answered 503"))) : undefined) });
    armed = true;
    const before = await stopped(page);
    expect(sent(page).slice(before)).toEqual(["prompt two steer", "prompt three steer", "steer four"]);
    expect(page.given).toEqual(["two"]);
    expect(said(page)).toEqual(["three (waits)", "four (waits)"]);
  });

  it("stops and sends nothing when no message waits, which is what a second stop is: the first one's messages are pi's by then", async () => {
    const page = await busy();
    const before = await stopped(page);
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: [entry(82, { form: "message", role: "user", content: "two", timestamp: 40 }), entry(83, { form: "message", role: "user", content: "three", timestamp: 40 })] });
    const first = sent(page).length;
    expect(sent(page).slice(before)).toEqual(["prompt two steer", "steer three"]);
    await stopped(page);
    expect(sent(page).slice(first)).toEqual(["clear_queue", "abort"]);
    expect(page.given).toEqual([]);
    expect(said(page)).toEqual(["two", "three"]);
  });

  it("sends nothing again that pi recorded before the stop took hold, however the queue answered: the one left goes as any message does", async () => {
    const page = await busy();
    const stopping = page.visit.stop();
    await page.settle();
    // In the window between a step and pi's next turn the loop already holds "two": pi records it though clear_queue handed it back.
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: [
      entry(81, { form: "message", role: "user", content: "two", timestamp: 5 }),
      entry(82, { form: "message", role: "assistant", content: [], stopReason: "error", errorMessage: "This operation was aborted" }),
    ] });
    await page.hear("turn", { kind: "turn", running: false });
    await stopping;
    await page.pass(10);
    expect(sent(page).slice(4)).toEqual(["prompt three steer"]);
    expect(page.visit.stream.items.filter((item) => item.kind === "user" && item.text === "two")).toHaveLength(1);
  });

  it("holds a message typed during the stop until the kept ones are before pi, then sends it after them", async () => {
    const page = await busy();
    const stopping = page.visit.stop();
    await page.settle();
    const later = page.visit.send("four");
    await page.pass(10);
    expect(sent(page)).toEqual(["prompt two steer", "prompt three steer", "clear_queue", "abort"]);
    await page.hear("turn", { kind: "turn", running: false });
    await stopping;
    await later;
    await page.pass(10);
    expect(sent(page).slice(4)).toEqual(["prompt two steer", "steer three", "prompt four steer"]);
  });

  it("ends a stop pi answered once the box has still not said the turn is over after a bound: the message typed under it goes, and Stop is a first stop again", async () => {
    const page = await busy([]);
    void page.visit.stop();
    await page.settle();
    void page.visit.send("four");
    await page.pass(STOP_WAIT_MS - 1);
    expect([sent(page), page.visit.handing]).toEqual([["clear_queue", "abort"], true]);
    await page.pass(1);
    await page.pass(10);
    expect([sent(page), page.visit.handing, page.visit.stoppable]).toEqual([["clear_queue", "abort", "prompt four steer"], false, true]);
    void page.visit.stop();
    await page.settle();
    expect(sent(page).slice(3)).toEqual(["clear_queue", "abort"]);
  });

  it("sends what pi gave back on as any message goes when the turn is still said to run after the bound: no run is over for a Stop to keep them for", async () => {
    const page = await busy();
    page.piHolds(["two", "three"]);
    const stopping = page.visit.stop();
    await page.settle();
    await page.pass(STOP_WAIT_MS);
    await stopping;
    await page.pass(10);
    expect(sent(page).slice(2)).toEqual(["clear_queue", "abort", "prompt two steer", "prompt three steer"]);
    expect(page.taken).toEqual([]);
  });

  it("sends nothing again when the stop itself was not answered: pi may still be at work", async () => {
    const page = await busy();
    page.failCommands();
    await page.visit.stop();
    await page.pass(10);
    expect(sent(page)).toEqual(["prompt two steer", "prompt three steer", "abort"]);
    expect(echoes(page)).toEqual([["two", true], ["three", true]]);
  });

  it("stops waiting on the turn's end when the box goes to sleep, and the kept messages go to the platform, which opens it again", async () => {
    const page = await busy();
    const stopping = page.visit.stop();
    await page.settle();
    await page.end("box_ended");
    await page.pass(1_000);
    await page.end("box_unavailable", 409);
    await stopping;
    await page.pass(10);
    expect(page.asked).toContain("platform open");
  });

  it("gives every kept message back, the ones beside the first too, when the box that slept under the stop will not open for them", async () => {
    const page = await busy(["two", "three", "four"], { opens: [{ kind: "refused", reason: "global_limit" }] });
    const reached = page.delivered.length;
    const stopping = page.visit.stop();
    await page.settle();
    await page.end("box_ended");
    await page.pass(1_000);
    await page.end("box_unavailable", 409);
    await stopping;
    await page.pass(10);
    expect(page.given).toEqual(["two", "three", "four"]);
    expect(echoes(page)).toEqual([]);
    expect(page.delivered.slice(reached)).toEqual([]);
  });

  it("puts no mode back on a computer that slept before pi recorded them: the pi that wakes starts on its own settings", async () => {
    const page = await busy();
    const before = await stopped(page);
    expect(sent(page).slice(before)).toEqual(["prompt two steer", "steer three"]);
    await page.hear("sleep", { kind: "sleep", dueInMs: 0 });
    await page.end("box_ended");
    expect(page.visit.box).toBe("asleep");
    const waking = page.visit.wake();
    await page.settle();
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await waking;
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: [entry(82, { form: "message", role: "user", content: "two", timestamp: 40 }), entry(83, { form: "message", role: "user", content: "three", timestamp: 40 })] });
    expect(said(page)).toEqual(["two", "three"]);
    expect(sent(page).slice(before + 4)).toEqual([]);
  });
  describe("Stop and switch off", () => {
    it("stops the run, starts none for a message that waited, gives it back where it was written, and puts the computer to sleep once nothing is at work", async () => {
      const page = await busy(["two"]);
      const off = page.visit.stopAndSleep();
      await page.settle();
      expect(page.asked.includes("close")).toBe(false);
      await page.hear("turn", { kind: "turn", running: false });
      await off;
      await page.pass(10);
      expect(sent(page)).toEqual(["prompt two steer", "clear_queue", "abort"]);
      expect([page.given, echoes(page), page.asked.filter((one) => one === "close"), page.visit.box]).toEqual([["two"], [], ["close"], "asleep"]);
    });

    it("leaves the computer on when the stop was not taken: cx still works, and a box at work is not closed", async () => {
      const page = await busy([]);
      page.failCommands(["abort"]);
      await page.visit.stopAndSleep();
      await page.pass(10);
      expect([page.asked.includes("close"), page.visit.box, page.visit.atWork]).toEqual([false, "awake", true]);
    });

    it("ends at the stop while pi has not answered for the message it holds: no close, the message still waits, and a switch-off after pi answers gives it back first", async () => {
      const page = await busy(["two"]);
      page.failCommands(["clear_queue"]);
      const off = page.visit.stopAndSleep();
      await page.settle();
      await page.hear("turn", { kind: "turn", running: false });
      await off;
      await page.pass(10);
      expect(sent(page)).toEqual(["prompt two steer", "clear_queue", "abort", "clear_queue"]);
      expect([page.given, echoes(page).map((one) => one && one[0]), page.asked.includes("close"), page.visit.box]).toEqual([[], ["two"], false, "awake"]);
      await page.visit.sleep();
      expect([sent(page).slice(4), page.given, page.asked.includes("close"), page.visit.box]).toEqual([["clear_queue"], [], false, "awake"]);
      page.failCommands([]);
      await page.visit.sleep();
      expect([sent(page).slice(5), page.given, echoes(page), page.asked.filter((one) => one === "close"), page.visit.box]).toEqual([["clear_queue"], ["two"], [], ["close"], "asleep"]);
    });

    it("gives back every message the stopped run left when pi's queue answers empty or short after a lost answer: an empty queue is no word that pi read them, and the close comes after", async () => {
      for (const [held, queue] of [[["two"], []], [["two", "three"], ["three"]]] as const) {
        const seen: { given: readonly string[] } = { given: [] };
        const atClose: (readonly string[])[] = [];
        const page = await busy(held, { closing: async () => { atClose.push([...seen.given]); } });
        seen.given = page.given;
        // The asking reached pi and emptied its queue; its answer did not reach the page, nor did the next one's.
        page.failCommands(["clear_queue"]);
        const off = page.visit.stopAndSleep();
        await page.settle();
        await page.hear("turn", { kind: "turn", running: false });
        await off;
        await page.pass(10);
        expect([page.given, echoes(page).map((one) => one && one[0]), page.asked.includes("close")]).toEqual([[], [...held], false]);
        page.failCommands([]);
        page.piHolds(queue);
        await page.visit.sleep();
        expect([page.given, echoes(page), page.asked.filter((one) => one === "close"), page.visit.box], held.join()).toEqual([[...held], [], ["close"], "asleep"]);
        expect(atClose, held.join()).toEqual([[...held]]);
      }
    });
  });

  describe("Restart, from Settings", () => {
    it("asks the platform's restart of a computer at rest, then opens and hears the box it brought back", async () => {
      const page = await openedAwake();
      const before = page.asked.length;
      const on = page.visit.restart();
      await page.settle();
      expect(page.visit.box).toBe("waking");
      await page.hear("life", { kind: "life", epoch: EPOCH });
      expect(await on).toBe(true);
      expect([page.asked.slice(before).filter((one) => one === "restart" || one === "open"), page.visit.box, sent(page)]).toEqual([["restart", "open"], "awake", []]);
    });

    it("stops cx's answer first, as Stop and switch off does: the message that waited goes back, and the restart follows once nothing is at work", async () => {
      const page = await busy(["two"]);
      const on = page.visit.restart();
      await page.settle();
      expect(page.asked.includes("restart")).toBe(false);
      await page.hear("turn", { kind: "turn", running: false });
      await page.settle();
      await page.hear("life", { kind: "life", epoch: EPOCH });
      expect(await on).toBe(true);
      expect([sent(page), page.given, page.asked.filter((one) => one === "restart")]).toEqual([["prompt two steer", "clear_queue", "abort"], ["two"], ["restart"]]);
    });

    it("restarts nothing when the stop was not taken, and leaves the computer on when the platform refuses or fails the restart", async () => {
      const page = await busy([]);
      page.failCommands(["abort"]);
      expect(await page.visit.restart()).toBe(false);
      expect([page.asked.includes("restart"), page.visit.box]).toEqual([false, "awake"]);
      for (const restartAnswer of ["busy", "fails"] as const) {
        const resting = await openedAwake({ restartAnswer });
        const before = resting.asked.length;
        expect(await resting.visit.restart(), restartAnswer).toBe(false);
        expect([resting.asked.slice(before), resting.visit.box], restartAnswer).toEqual([["restart"], "awake"]);
      }
    });
  });

  describe("a second Stop stops", () => {
    it("pressed while the first is in flight: the messages it would have kept start no run and go back where they were written, in the order sent", async () => {
      const page = await busy();
      const first = page.visit.stop();
      await page.settle();
      const second = page.visit.stop();
      expect(second).toBe(first);
      await page.hear("turn", { kind: "turn", running: false });
      await first;
      await page.pass(10);
      expect(sent(page).slice(2)).toEqual(["clear_queue", "abort"]);
      expect([page.given, page.taken, echoes(page), page.visit.stoppable, page.visit.atWork]).toEqual([["two", "three"], ["two", "three"], [], false, false]);
    });

    it("can be pressed while the kept messages wait on the way to pi, where no turn runs: nothing of them is sent, and they go back", async () => {
      let hold: Promise<void> | undefined;
      const page = await busy(["two", "three"], { beforeSend: async () => { await hold; } });
      hold = new Promise<void>(() => undefined);
      await stopped(page);
      expect([page.visit.running, page.visit.stoppable]).toEqual([false, true]);
      const before = sent(page).length;
      await page.visit.stop();
      await page.pass(10);
      expect(sent(page).slice(before)).toEqual(["clear_queue", "abort"]);
      expect([page.taken, echoes(page), page.visit.stoppable]).toEqual([["two", "three"], [], false]);
    });

    it("pressed while the kept messages are being handed to pi sends no more of them, asks back the ones pi took, and sends none twice", async () => {
      let release: (() => void) | undefined;
      let armed = false;
      const page = await busy(["two", "three", "four", "five"], { hold: (type) => (armed && type === "steer" && release === undefined ? new Promise<void>((resolve) => { release = resolve; }) : undefined) });
      armed = true;
      const before = await stopped(page);
      expect(sent(page).slice(before)).toEqual(["prompt two steer", "steer three"]);
      expect([page.visit.running, page.visit.stoppable]).toEqual([false, true]);
      const second = page.visit.stop();
      await page.settle();
      // The command with the box is answered first: until then nobody can say who holds its message.
      expect(sent(page).slice(before)).toHaveLength(2);
      release!();
      await page.settle();
      // The prompt was answered, so the stop waits for the turn it starts, and for no longer than a turn takes to be named.
      await page.pass(TURN_WAIT_MS);
      await second;
      await page.pass(10);
      expect(sent(page).slice(before + 2)).toEqual(["clear_queue", "abort"]);
      expect([page.taken, echoes(page), page.visit.stoppable, page.visit.atWork]).toEqual([["two", "three", "four", "five"], [], false, false]);
    });

    it("pressed once pi has the kept messages and before its records of them land ends that run: the ones it recorded stay, the rest go back, and none starts a run", async () => {
      const page = await busy(["two", "three"]);
      const before = await stopped(page);
      expect(sent(page).slice(before)).toEqual(["prompt two steer", "steer three"]);
      expect([page.visit.running, page.visit.stoppable]).toEqual([false, true]);
      const second = page.visit.stop();
      await page.settle();
      // The prompt started a run the stop then ended: its turn frames and the record of the message it took follow.
      await page.hear("turn", { kind: "turn", running: true });
      await page.hear("entry", entry(82, { form: "message", role: "user", content: "two", timestamp: 40 }));
      await page.hear("turn", { kind: "turn", running: false });
      await second;
      await page.pass(10);
      expect(sent(page).slice(before + 2)).toEqual(["clear_queue", "abort"]);
      expect([page.taken, said(page), page.visit.stoppable]).toEqual([["three"], ["two"], false]);
    });

    it("pressed under the prompt that starts their run waits for its answer and for the turn it starts, and for no longer than a turn takes to be named when none is", async () => {
      let release: (() => void) | undefined;
      let armed = false;
      const page = await busy(["two", "three"], { hold: (type) => (armed && type === "prompt" ? new Promise<void>((resolve) => { release = resolve; }) : undefined) });
      armed = true;
      const before = await stopped(page);
      expect(sent(page).slice(before)).toEqual(["prompt two steer"]);
      void page.visit.stop();
      await page.settle();
      expect(sent(page).slice(before)).toHaveLength(1);
      release!();
      await page.settle();
      await page.pass(TURN_WAIT_MS - 1);
      expect([sent(page).slice(before + 1), page.taken]).toEqual([["clear_queue", "abort"], []]);
      await page.pass(1);
      expect([sent(page).slice(before + 1), page.taken, page.visit.stoppable]).toEqual([["clear_queue", "abort"], ["two", "three"], false]);
    });

    it("gives back what the page had not sent yet too, and a message written after the first", async () => {
      const page = await busy(["two"]);
      const first = page.visit.stop();
      await page.settle();
      void page.visit.send("three");
      await page.settle();
      void page.visit.stop();
      await page.hear("turn", { kind: "turn", running: false });
      await first;
      await page.pass(10);
      expect([sent(page).slice(1), page.taken, echoes(page)]).toEqual([["clear_queue", "abort"], ["two", "three"], []]);
    });

    it("is never a waiting message's own Send now: pressed twice, or under a stop, it is the first stop still", async () => {
      const page = await busy();
      const first = page.visit.stop("now");
      await page.settle();
      expect(page.visit.stop("now")).toBe(first);
      await page.hear("turn", { kind: "turn", running: false });
      await first;
      await page.pass(10);
      expect(sent(page).slice(4)).toEqual(["prompt two steer", "steer three"]);
      expect(page.given).toEqual([]);
    });

    it("is a first stop again once the run that read the kept messages is over, whatever of them pi never recorded", async () => {
      const page = await busy();
      await stopped(page);
      await page.hear("turn", { kind: "turn", running: true });
      await page.hear("entry", entry(82, { form: "message", role: "user", content: "two", timestamp: 40 }));
      await page.hear("turn", { kind: "turn", running: false });
      await page.hear("turn", { kind: "turn", running: true });
      await page.visit.send("four");
      await page.pass(10);
      const before = await stopped(page);
      expect(sent(page).slice(before).filter((line) => /^(steer|prompt)/.test(line))).toEqual(["prompt three steer", "steer four"]);
      expect(page.taken).toEqual([]);
    });
  });

  it("sends a command pi took and answered as done no second time at a stop: pi writes no record for it, and it is not a message that waits", async () => {
    const page = await busy(["/told", "three"], { handles: "/told" });
    const before = await stopped(page);
    expect(sent(page).slice(before)).toEqual(["prompt three steer"]);
  });

  it("draws a message pi took as an extension's command as read once pi's answer to it lands, while a message sent beside it still waits", async () => {
    const page = await busy(["/told", "three"], { handles: "/told" });
    expect(page.visit.stream.items.slice(80).flatMap((item) => (item.kind === "user" ? [[item.text, item.pending, item.queued === true]] : []))).toEqual([["/told", false, false], ["three", true, true]]);
  });

  describe("a kept message an installed package took as its command when the stop handed it to pi", () => {
    /** "first" and "second" wait behind an answer; the Stop hands "second" to a pi at rest, where the package takes it. */
    async function handedOver() {
      const page = await busy(["first", "second"], { handledAtRest: ["second"] });
      const before = await stopped(page);
      expect(sent(page).slice(before)).toEqual(["prompt first steer", "steer second"]);
      // Read at pi's answer: no record will come for it, and it waits for nothing.
      expect([echoes(page), said(page)]).toEqual([[["first", false]], ["first (waits)", "second"]]);
      return { page, before };
    }

    it("is not handed back by a second Stop as a message cx has not read", async () => {
      const { page, before } = await handedOver();
      const second = page.visit.stop();
      await page.settle();
      await page.hear("turn", { kind: "turn", running: true });
      await page.hear("turn", { kind: "turn", running: false });
      await second;
      await page.pass(10);
      expect(sent(page).slice(before + 2)).toEqual(["clear_queue", "abort"]);
      expect([page.taken, page.given, said(page)]).toEqual([["first"], ["first"], ["second"]]);
    });

    it("is not sent to pi again by a later Stop, behind the messages written since", async () => {
      const { page } = await handedOver();
      await page.hear("turn", { kind: "turn", running: true });
      await page.hear("entry", entry(82, { form: "message", role: "user", content: "first", timestamp: 40 }));
      await page.hear("turn", { kind: "turn", running: false });
      await page.hear("turn", { kind: "turn", running: true });
      await page.visit.send("third");
      await page.pass(10);
      await page.visit.send("fourth");
      await page.pass(10);
      const before = await stopped(page);
      expect(sent(page).slice(before)).toEqual(["prompt third steer", "steer fourth"]);
      expect(page.asked.filter((line) => / second( |$)/.test(line))).toEqual(["prompt second steer", "steer second"]);
      expect([page.taken, page.given]).toEqual([[], []]);
    });

    it("is drawn read when pi's answer to it lands, while the message handed over behind it is still on its way", async () => {
      let release: (() => void) | undefined;
      let steers = 0;
      const page = await busy(["first", "second", "last"], { handledAtRest: ["second"], hold: (type) => (type === "steer" && ++steers === 2 ? new Promise<void>((resolve) => { release = resolve; }) : undefined) });
      const before = await stopped(page);
      expect(sent(page).slice(before)).toEqual(["prompt first steer", "steer second", "steer last"]);
      // What the page was last told, not what the visit holds: the drawing is made from the first.
      expect(page.waiting.at(-1)).toEqual(["first", "last"]);
      release!();
      await page.pass(10);
      expect([sent(page).slice(before + 3), said(page)]).toEqual([[], ["first (waits)", "second", "last (waits)"]]);
    });

    it("is not among the messages pi holds: when the package takes the one that was to start the run too, nothing is asked back", async () => {
      const page = await busy(["/told", "second"], { handledAtRest: ["/told", "second"] });
      const before = await stopped(page);
      expect(sent(page).slice(before)).toEqual(["prompt /told steer", "prompt second steer"]);
      expect([echoes(page), said(page)]).toEqual([[], ["/told", "second"]]);
      await page.pass(60_000);
      expect(sent(page).slice(before + 2)).toEqual([]);
      void page.visit.stop();
      await page.pass(10);
      expect(sent(page).slice(before + 2).filter((line) => /^(steer|prompt)/.test(line))).toEqual([]);
      expect([page.taken, page.given]).toEqual([[], []]);
    });
  });

  it("puts the messages the page had not sent at the stop before pi with the ones pi gave back, in one request", async () => {
    let hold: Promise<void> | undefined;
    let open!: () => void;
    const page = await busy(["two"], { beforeSend: async () => { await hold; } });
    hold = new Promise<void>((resolve) => { open = resolve; });
    void page.visit.send("three");
    void page.visit.send("four");
    await page.pass(10);
    expect(sent(page)).toEqual(["prompt two steer"]);
    const stopping = page.visit.stop();
    await page.settle();
    await page.hear("turn", { kind: "turn", running: false });
    await stopping;
    hold = undefined;
    open();
    await page.pass(10);
    expect(sent(page).slice(1)).toEqual(["clear_queue", "abort", "prompt two steer", "steer three", "steer four"]);
    expect(echoes(page)).toEqual([["two", false], ["three", true], ["four", true]]);
  });

  it("starts the run with the next kept message when pi took the first as a command that starts none: the ones beside it were not sent yet, and go together", async () => {
    let hold: Promise<void> | undefined;
    let open!: () => void;
    const page = await busy([], { handles: "/told", beforeSend: async () => { await hold; } });
    hold = new Promise<void>((resolve) => { open = resolve; });
    for (const message of ["/told", "three", "four"]) void page.visit.send(message);
    await page.pass(10);
    const stopping = page.visit.stop();
    await page.settle();
    await page.hear("turn", { kind: "turn", running: false });
    await stopping;
    hold = undefined;
    open();
    await page.pass(10);
    await page.pass(10);
    expect(sent(page)).toEqual([
      "clear_queue", "abort", "prompt /told steer", "prompt three steer", "steer four",
    ]);
    expect(page.given).toEqual([]);
  });

  it("asks pi's queue again after the stop when it did not answer before it, and sends nothing again while the queue is still pi's: it is asked once more as the next message goes", async () => {
    const page = await busy();
    page.failCommands(["clear_queue"]);
    const before = await stopped(page);
    // pi stopped holding both: they are its own until it gives them up, so sending them again would have cx read each twice.
    expect([before, sent(page).slice(2)]).toEqual([5, ["clear_queue", "abort", "clear_queue"]]);
    expect([page.given, echoes(page)]).toEqual([[], [["two", true], ["three", true]]]);
    page.failCommands([]);
    await page.visit.send("four");
    await page.pass(10);
    expect(sent(page).slice(5)).toEqual(["clear_queue", "prompt two steer", "steer three", "prompt four steer"]);
    expect(page.given).toEqual([]);
  });

  it("takes every message the stopped run left when pi's queue answers empty as the next message goes, after a lost answer: after a Stop it goes ahead of that message, and after a Stop and switch off it is back where it was written before that message is sent", async () => {
    for (const how of ["stop", "off"] as const) {
      const seen: { given: readonly string[] } = { given: [] };
      const atPrompt: (readonly string[])[] = [];
      const page = await busy(["two"], { hold: (type) => { if (type === "prompt") atPrompt.push([...seen.given]); return undefined; } });
      seen.given = page.given;
      // The asking reached pi and emptied its queue; its answer did not reach the page, nor did the next one's.
      page.failCommands(["clear_queue"]);
      const stopping = page.visit.stop(how);
      await page.settle();
      await page.hear("turn", { kind: "turn", running: false });
      await stopping;
      await page.pass(10);
      expect([page.given, echoes(page).map((one) => one && one[0])], how).toEqual([[], ["two"]]);
      page.failCommands([]);
      page.piHolds([]);
      const before = sent(page).length;
      await page.visit.send("three");
      await page.pass(10);
      expect([sent(page).slice(before), page.given, atPrompt.at(-1)], how).toEqual(
        how === "off" ? [["clear_queue", "prompt three steer"], ["two"], ["two"]] : [["clear_queue", "prompt two steer", "prompt three steer"], [], []],
      );
    }
  });

  it("takes the queue pi gave up after the stop, when only the asking before it failed, as any stop does", async () => {
    let failed = false;
    const page = await busy(["two", "three"], { hold: (type) => { if (type === "clear_queue" && !failed) { failed = true; throw new Error("clear_queue answered 503"); } return undefined; } });
    await stopped(page);
    expect(sent(page).slice(2)).toEqual(["clear_queue", "abort", "clear_queue", "prompt two steer", "steer three"]);
  });

  it("sends what pi gave back on as any message goes when the stop was not answered after it: pi may still be at work, and no message is left with nobody", async () => {
    const page = await busy(["two", "three", "four"]);
    page.piHolds(["three", "four"]);
    page.failCommands(["abort"]);
    await page.visit.stop();
    page.failCommands([]);
    await page.pass(10);
    // pi's loop took "two" before the queue was asked back: its record is on its way, and it is not sent again.
    expect(sent(page).slice(3)).toEqual(["clear_queue", "abort", "prompt three steer", "prompt four steer"]);
    expect(page.given).toEqual([]);
  });

  it("waits for the box to say no turn runs on the connection it holds: a stream that connected again under the stop has not brought the stop's records yet", async () => {
    let release: (() => void) | undefined;
    const page = await busy(["two", "three"], { hold: (type) => (type === "abort" ? new Promise<void>((resolve) => { release = resolve; }) : undefined) });
    const stopping = page.visit.stop();
    await page.settle();
    page.visit.connect();
    await page.settle();
    release!();
    await page.pass(10);
    expect(sent(page).slice(2)).toEqual(["clear_queue", "abort"]);
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: [entry(81, { form: "message", role: "user", content: "two", timestamp: 5 })] });
    await page.hear("turn", { kind: "turn", running: false });
    await stopping;
    await page.pass(10);
    expect(sent(page).slice(4)).toEqual(["prompt three steer"]);
  });
});

describe("a package's dialog is answered from the page", () => {
  const ask = (id: string, body: Record<string, unknown>) => ({ kind: "ui_request", id, body: { form: "ui_request", id, ...body } });
  const confirm = (id: string, extra: Record<string, unknown> = {}) => ask(id, { method: "confirm", title: "Overwrite?", message: "notes.md already exists.", ...extra });
  const held = (page: { readonly visit: Visit }): string[] => [...page.visit.stream.dialogs, ...page.visit.stream.notices].map((one) => one.id);
  /** The questions folded where they stood, by id, with what went. */
  const folds = (page: { readonly visit: Visit }): unknown[] => page.visit.stream.items.flatMap((item) => (item.kind === "asked" ? [[item.key.slice("asked-".length), item.answer]] : []));

  it("sends the answer as pi's command with the dialog's id, and lets the dialog go once the box took it", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("ui_request", confirm("d-1")); await page.hear("ui_request", ask("d-2", { method: "select", title: "Which?", options: ["a", "b"] })); await page.hear("ui_request", ask("d-3", { method: "input", title: "Name" }));
    const draws = page.drawn.length;
    expect(await page.visit.answer("d-1", { confirmed: true })).toBe(true);
    expect(await page.visit.answer("d-2", { value: "b" })).toBe(true);
    expect(await page.visit.answer("d-3", { cancelled: true })).toBe(true);
    expect(page.posted.slice(-3)).toEqual([{ type: "extension_ui_response", id: "d-1", confirmed: true }, { type: "extension_ui_response", id: "d-2", value: "b" }, { type: "extension_ui_response", id: "d-3", cancelled: true }]);
    expect([held(page), page.drawn.length - draws]).toEqual([[], 3]);
  });

  it("keeps a dialog whose answer did not get there, for another try", async () => {
    const page = await openedAwake();
    await page.hear("ui_request", confirm("d-1"));
    page.failCommands();
    expect(await page.visit.answer("d-1", { confirmed: false })).toBe(false);
    expect(held(page)).toEqual(["d-1"]);
    page.failCommands([]);
    expect(await page.visit.answer("d-1", { confirmed: false })).toBe(true);
    expect(held(page)).toEqual([]);
  });

  it("folds a dialog when the time pi gave it runs out, lets a notice go once it has stood, and keeps one with no time until the platform says it ended", async () => {
    const page = await openedAwake();
    await page.hear("ui_request", confirm("timed", { timeout: 10_000 })); await page.hear("ui_request", confirm("untimed")); await page.hear("ui_request", ask("n-1", { method: "notify", message: "fyi" }));
    await page.pass(NOTICE_MS - 1);
    expect(held(page)).toEqual(["timed", "untimed", "n-1"]);
    const draws = page.drawn.length;
    await page.pass(1);
    expect([held(page), page.drawn.length - draws]).toEqual([["timed", "untimed"], 1]);
    await page.pass(10_000 - NOTICE_MS);
    expect(held(page)).toEqual(["untimed"]);
    // The page keeps no clock for a dialog the package gave no time: past five minutes, and long past, its card stands.
    await page.pass(300_000);
    await page.pass(3_600_000);
    expect([held(page), folds(page)]).toEqual([["untimed"], [["timed", { cancelled: true }]]]);
    expect(page.posted.some((command) => command["type"] === "extension_ui_response")).toBe(false);
    // The platform's word that the box took its answer folds it: another life's word changes nothing.
    await page.hear("dialog_ended", { kind: "dialog_ended", epoch: "f".repeat(32), id: "untimed", answer: { cancelled: true } });
    expect(held(page)).toEqual(["untimed"]);
    await page.hear("dialog_ended", { kind: "dialog_ended", epoch: EPOCH, id: "untimed", answer: { cancelled: true } });
    expect([held(page), folds(page)]).toEqual([[], [["timed", { cancelled: true }], ["untimed", { cancelled: true }]]]);
  });

  it("folds an answered dialog where its card stood, with what went, and keeps one that did not get there as a card", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("ui_request", ask("d-1", { method: "select", title: "Which?", options: ["a", "b"] })); await page.hear("ui_request", confirm("d-2"));
    await page.visit.answer("d-1", { value: "b" });
    page.failCommands();
    await page.visit.answer("d-2", { confirmed: true });
    expect([held(page), folds(page)]).toEqual([["d-2"], [["d-1", { value: "b" }]]]);
    expect(page.visit.stream.items.find((item) => item.kind === "asked")).toMatchObject({ title: "Which?", method: "select" });
  });

  it("folds an answer pi took by that answer however late the platform's acknowledgement comes: at 299,999 ms, acknowledged a millisecond later", async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const page = await openedAwake({ hold: (type) => (type === "extension_ui_response" ? gate : undefined) });
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("ui_request", ask("d-1", { method: "select", title: "Which store?", options: ["US", "UK"] }));
    await page.pass(299_999);
    const answering = page.visit.answer("d-1", { value: "UK" });
    await page.settle();
    await page.pass(1);
    expect([held(page), folds(page)]).toEqual([["d-1"], []]);
    release();
    expect(await answering).toBe(true);
    expect([held(page), folds(page)]).toEqual([[], [["d-1", { value: "UK" }]]]);
    // The platform's word of the same end, after it, changes nothing.
    await page.hear("dialog_ended", { kind: "dialog_ended", epoch: EPOCH, id: "d-1", answer: { value: "UK" } });
    expect(folds(page)).toEqual([["d-1", { value: "UK" }]]);
  });







  it("keeps questions in the order asked whichever is answered first, the one still open where it was asked", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    for (const id of ["first", "second"]) await page.hear("ui_request", ask(id, { method: "select", title: id, options: ["UK"] }));
    const places = (): string[] => page.visit.stream.items.flatMap((item) => (item.kind === "asked" ? [`folded ${item.key}`] : item.kind === "asking" ? [`open ${item.key}`] : []));
    expect(places()).toEqual(["open asked-first", "open asked-second"]);
    await page.visit.answer("second", { value: "UK" });
    expect(places()).toEqual(["open asked-first", "folded asked-second"]);
    await page.visit.answer("first", { value: "UK" });
    expect(places()).toEqual(["folded asked-first", "folded asked-second"]);
  });

  it("a message from the chat's box lets each waiting question go unanswered, in the order asked, and then goes; with none waiting it only goes", async () => {
    const page = await openedAwake();
    await page.visit.send("first", true);
    expect(page.posted.filter((command) => command["type"] === "extension_ui_response")).toEqual([]);
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("ui_request", confirm("d-1")); await page.hear("ui_request", ask("d-2", { method: "select", title: "Which?", options: ["a"] }));
    const from = page.posted.length;
    await page.visit.send("instead", true);
    expect(page.posted.slice(from).map((command) => [command["type"], command["id"] ?? command["message"], command["cancelled"]])).toEqual([
      ["extension_ui_response", "d-1", true], ["extension_ui_response", "d-2", true], ["prompt", "instead", undefined]]);
    expect([held(page), folds(page)]).toEqual([[], [["d-1", { cancelled: true }], ["d-2", { cancelled: true }]]]);
    // The folded questions stand above the message, where the cards stood.
    expect(page.visit.stream.items.slice(-3).map((item) => item.kind)).toEqual(["asked", "asked", "user"]);
  });

  it("a message whose question's release did not reach the box leaves the card, and the message still goes", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("ui_request", confirm("d-1"));
    page.failCommands(["extension_ui_response"]);
    const from = page.posted.length;
    await page.visit.send("instead", true);
    expect(page.posted.slice(from).map((command) => command["type"])).toEqual(["extension_ui_response", "prompt"]);
    expect([held(page), folds(page)]).toEqual([["d-1"], []]);
  });

  it("a message that is not from the chat's box lets no question go: it waits behind it", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("ui_request", confirm("d-1"));
    const from = page.posted.length;
    await page.visit.send("from the board");
    expect(page.posted.slice(from).map((command) => command["type"])).toEqual(["prompt"]);
    expect(held(page)).toEqual(["d-1"]);
  });

  it("Stop lets each waiting question go unanswered and then stops the turn", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("ui_request", confirm("d-1")); await page.hear("ui_request", confirm("d-2"));
    const from = page.posted.length;
    const stopping = page.visit.stop();
    await page.settle();
    await page.hear("turn", { kind: "turn", running: false });
    await stopping;
    const types = page.posted.slice(from).map((command) => command["type"] === "extension_ui_response" ? `${String(command["id"])} ${String(command["cancelled"])}` : command["type"]);
    expect(types.slice(0, 2)).toEqual(["d-1 true", "d-2 true"]);
    expect(types.indexOf("abort")).toBeGreaterThan(1);
    expect(folds(page)).toEqual([["d-1", { cancelled: true }], ["d-2", { cancelled: true }]]);
  });

  it("counts a dialog's time once, from when the page first held it: heard again or told open again, it goes when it would have", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("ui_request", confirm("timed", { timeout: 10_000 }));
    await page.pass(6_000);
    await page.hear("ui_request", confirm("timed", { timeout: 10_000 }));
    await page.hear("dialogs", { kind: "dialogs", epoch: EPOCH, open: [confirm("timed", { timeout: 4_000 }), confirm("late", { timeout: 2_000 })] });
    expect(held(page)).toEqual(["timed", "late"]);
    await page.pass(2_000);
    expect(held(page)).toEqual(["timed"]);
    await page.pass(2_000);
    expect(held(page)).toEqual([]);
  });

  it("stops counting for a dialog that went another way: answered, or taken by the end of its turn", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("ui_request", confirm("d-1", { timeout: 5_000 })); await page.hear("ui_request", confirm("d-2", { timeout: 5_000 }));
    await page.visit.answer("d-1", { confirmed: true });
    await page.hear("turn", { kind: "turn", running: false });
    expect(held(page)).toEqual([]);
    // The id the turn took unfolded, asked again, is a new dialog with its own time: a wait left over from the first would take it early.
    // The one the page folded stays folded: a frame naming it again is the recording's lag.
    await page.hear("ui_request", confirm("d-1", { timeout: 60_000 })); await page.hear("ui_request", confirm("d-2", { timeout: 60_000 }));
    const draws = page.drawn.length;
    const asked = page.asked.length;
    await page.pass(59_999);
    // The account read once after the turn, for its last call's charge, draws once; nothing of the dialogs does.
    expect([held(page), page.asked.slice(asked), page.drawn.length - draws]).toEqual([["d-2"], ["me"], 1]);
    await page.pass(1);
    expect(held(page)).toEqual([]);
  });

  it("lets every dialog go when it finds the box asleep without having heard it go: no answer would be taken", async () => {
    const page = await openedAwake();
    await page.hear("ui_request", confirm("d-1", { timeout: 60_000 })); await page.hear("ui_request", confirm("d-2")); await page.hear("ui_request", ask("n-1", { method: "notify", message: "fyi" }));
    await page.end("box_unavailable", 409);
    expect([page.visit.box, held(page)]).toEqual(["asleep", ["n-1"]]);
    // The same dialog asked on the box's next run counts its own time, not what was left of the first's.
    const draws = page.drawn.length;
    await page.pass(NOTICE_MS);
    expect([held(page), page.drawn.length - draws]).toEqual([[], 1]);
    await page.pass(60_000);
    expect(page.drawn.length - draws).toBe(1);
  });

  it("counts a timed question down as pi does", async () => {
    const page = await openedAwake();
    await page.hear("ui_request", confirm("timed", { timeout: 5_000 }));
    await page.pass(5_000);
    expect(held(page)).toEqual([]);
  });

  it("vector: only the four questions pi waits on are cards; a notice waits on nothing, and status, widget, title and editor text draw nothing [agegr extension-ui-queue blocking methods]", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    for (const method of ["setStatus", "setWidget", "setTitle", "set_editor_text"]) await page.hear("ui_request", ask(`x-${method}`, { method, title: "t", message: "m" }));
    await page.hear("ui_request", ask("s", { method: "select", title: "Which?", options: ["a"] })); await page.hear("ui_request", confirm("c"));
    await page.hear("ui_request", ask("i", { method: "input", title: "Name" })); await page.hear("ui_request", ask("e", { method: "editor", title: "Edit" }));
    await page.hear("ui_request", ask("n", { method: "notify", message: "fyi" }));
    expect([page.visit.stream.dialogs.map((one) => one.id), page.visit.stream.notices.map((one) => one.id)]).toEqual([["s", "c", "i", "e"], ["n"]]);
    // The notice goes by itself and nothing is said to pi for it.
    await page.pass(NOTICE_MS);
    expect(held(page)).toEqual(["s", "c", "i", "e"]);
    expect(page.posted.some((command) => command["type"] === "extension_ui_response")).toBe(false);
  });

  it("vector: dialogs open at once stand in the order asked, an answer to the first shows the next, and one to a waiting dialog takes only that one [agegr extension-ui-queue arrival order]", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    for (const id of ["a", "b", "c"]) await page.hear("ui_request", confirm(id));
    const before = page.visit.stream;
    expect(held(page)).toEqual(["a", "b", "c"]);
    await page.visit.answer("a", { confirmed: true });
    expect(held(page)).toEqual(["b", "c"]);
    await page.visit.answer("c", { confirmed: false });
    expect(held(page)).toEqual(["b"]);
    expect(before.dialogs.map((one) => one.id)).toEqual(["a", "b", "c"]);
  });

  it("vector: a dialog sent again, or named again by a reconnect's list, is neither doubled nor moved, and the card stays the same card [agegr extension-ui-queue reconnect replay]", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("ui_request", confirm("a")); await page.hear("ui_request", confirm("b"));
    const cards = page.visit.stream.dialogs;
    await page.hear("ui_request", confirm("b")); await page.hear("ui_request", confirm("a", { title: "Asked another way" }));
    expect(page.visit.stream.dialogs).toBe(cards);
    await page.end("max_age");
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("dialogs", { kind: "dialogs", epoch: EPOCH, open: [confirm("b"), confirm("a")] });
    expect(page.visit.stream.dialogs).toBe(cards);
    expect(held(page)).toEqual(["a", "b"]);
  });

  it("vector: an answer to a dialog the page does not hold, or a second answer, changes none of the cards [agegr extension-ui-queue close of an id not queued]", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("ui_request", confirm("a")); await page.hear("ui_request", confirm("b"));
    const cards = page.visit.stream.dialogs;
    expect(await page.visit.answer("missing", { confirmed: true })).toBe(true);
    expect(page.visit.stream.dialogs).toBe(cards);
    await page.visit.answer("a", { confirmed: true }); await page.visit.answer("a", { confirmed: true });
    expect(held(page)).toEqual(["b"]);
  });

  it("vector: the end of the turn the dialogs were asked under takes every one of them [agegr extension-ui-queue Stop clears every request]", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    for (const id of ["a", "b", "c"]) await page.hear("ui_request", confirm(id));
    await page.hear("turn", { kind: "turn", running: false });
    expect(held(page)).toEqual([]);
  });

});

describe("the messages a Stop kept reach pi in the order written", () => {
  /**
   * pi as its queue behaves: a steer joins the queue; a prompt at rest starts a run that reads the prompt and then the whole queue, and
   * a busy one joins the queue; a run another hand starts reads the queue too. What pi has read, in order, is what it was given.
   */
  function fifo() {
    let now = 1_000_000;
    let busy = true;
    let hear!: (event: StreamEvent) => void;
    let holdSteer = false;
    let releaseSteer: (() => void) | undefined;
    const timers: { at: number; then: () => void; cancelled: boolean }[] = [];
    const queue: string[] = [];
    const read: string[] = [];
    const visit = new Visit({
      backend: {
        open: async () => ({ kind: "open" }),
        close: async () => "closed",
        restart: async () => "restarted",
        stream: (_since, heard) => { hear = heard; return () => undefined; },
        history: async (epoch) => ({ epoch, entries: [], from: 1, earlier: false }),
        takeBack: async () => "taken",
        command: async (command) => {
          const type = String(command["type"]);
          if (type === "get_state") return { success: true, data: { pendingMessageCount: queue.length } };
          if (type === "clear_queue") return { success: true, data: { steering: queue.splice(0), followUp: [] } };
          if (type === "abort") { busy = false; return { success: true }; }
          if (type === "steer") {
            queue.push(String(command["message"]));
            if (holdSteer) await new Promise<void>((resolve) => { releaseSteer = resolve; });
            return { success: true, data: { disposition: "queued" }, sentAt: now };
          }
          if (type === "prompt") {
            const at = busy;
            if (at) queue.push(String(command["message"]));
            else { read.push(String(command["message"]), ...queue.splice(0)); busy = true; }
            return { success: true, data: { disposition: at ? "queued" : "started" }, sentAt: now };
          }
          return { success: true };
        },
      },
      account: async () => ME,
      glance: () => undefined,
      now: () => now,
      later: (ms, then) => { const timer = { at: now + ms, then, cancelled: false }; timers.push(timer); return () => { timer.cancelled = true; }; },
      place: { read: () => null, write: () => undefined },
      changed: () => undefined,
      heard: () => undefined,
      giveBack: () => undefined,
    });
    // Each event its own task, as an EventSource gives them: what one starts settles before the next is heard.
    const settle = async (): Promise<void> => { for (let round = 0; round < 80; round++) await Promise.resolve(); };
    const pass = async (ms: number): Promise<void> => {
      const until = now + ms;
      for (;;) {
        const due = timers.filter((timer) => !timer.cancelled && timer.at <= until).sort((a, b) => a.at - b.at)[0];
        if (due === undefined) break;
        due.cancelled = true;
        now = due.at;
        due.then();
        await settle();
      }
      now = until;
      await settle();
    };
    const turn = async (running: boolean): Promise<void> => {
      if (running && !busy) read.push(...queue.splice(0));
      busy = running;
      hear({ event: "turn", data: { kind: "turn", running } });
      await settle();
    };
    return {
      visit, settle, pass, turn,
      start: async () => {
        await visit.look();
        hear({ event: "life", data: { kind: "life", epoch: EPOCH } });
        hear({ event: "entries", data: { kind: "entries", epoch: EPOCH, entries: [said(1, "one")], from: 1, earlier: false } });
        await turn(true);
      },
      holdSteer: () => { holdSteer = true; },
      releaseSteer: async () => { holdSteer = false; releaseSteer?.(); await settle(); },
      /** All pi was given, read or still queued, in the order it reads it. */
      given: (): readonly string[] => [...read, ...queue],
    };
  }

  for (const kept of [2, 3]) {
    it(`keeps ${kept} in order when a run starts while the first of them is handed over, its answer still on its way`, async () => {
      const pi = fifo();
      await pi.start();
      for (let at = 0; at < kept; at++) { await pi.visit.send(`kept-${at}`); await pi.pass(1); }
      const stopping = pi.visit.stop();
      await pi.settle();
      void pi.visit.send("after-stop");
      await pi.settle();
      await pi.pass(1_000);
      pi.holdSteer();
      await pi.turn(false);
      await pi.turn(true);
      await pi.releaseSteer();
      await pi.pass(STOP_WAIT_MS);
      await stopping;
      await pi.settle();
      expect(pi.given()).toEqual([...Array.from({ length: kept }, (_, at) => `kept-${at}`), "after-stop"]);
    });
  }
});

describe("pi's queue while it holds another page's message", () => {
  const busyPi = (): Pi => ({ running: true, queued: [], read: [] });
  /** A page on the conversation while cx works, sending to the one pi every page shares. */
  async function tab(pi: Pi) {
    const page = await openedAwake({ pi });
    await page.hear("turn", { kind: "turn", running: true });
    return page;
  }
  type Tab = Awaited<ReturnType<typeof tab>>;
  const acts = (page: Tab): string[] => page.asked.filter((line) => /^(prompt|steer|follow_up|clear_queue|abort)/.test(line));
  const queue = (pi: Pi): string[] => pi.queued.map((one) => `${one.kind} ${one.text}`);
  const waits = (page: Tab): string[] => page.visit.stream.items.flatMap((item) => (item.kind === "user" && item.pending ? [item.text] : []));
  const keyOf = (page: Tab, words: string): string => page.visit.stream.items.find((item) => item.kind === "user" && item.pending && item.text === words)!.key;
  async function says(page: Tab, message: string): Promise<void> { await page.visit.send(message); await page.pass(10); }

  it("offers no take-back: nothing is asked back or sent again, the message stays waiting, and the other page's stays queued once", async () => {
    const pi = busyPi();
    const [a, b] = [await tab(pi), await tab(pi)];
    await says(a, "own");
    await says(b, "foreign");
    const before = acts(a).length;
    await a.visit.withdraw(keyOf(a, "own"));
    await a.pass(10);
    expect([acts(a).slice(before), queue(pi), a.given, waits(a), waits(b)]).toEqual([[], ["steering own", "steering foreign"], [], ["own"], ["foreign"]]);
  });

  it("does not tell two pages' same words apart: with the other page's copy queued beside its own, the page takes neither", async () => {
    const pi = busyPi();
    const [a, b] = [await tab(pi), await tab(pi)];
    await says(a, "same");
    await says(b, "same");
    const before = acts(a).length;
    await a.visit.withdraw(keyOf(a, "same"));
    await a.pass(10);
    expect([acts(a).slice(before), queue(pi), a.given, waits(b)]).toEqual([[], ["steering same", "steering same"], [], ["same"]]);
  });

  it("leaves another page's follow-ups as follow-ups, and puts its own back as they were, in order, once nothing else is queued", async () => {
    const pi = busyPi();
    const a = await tab(pi);
    await says(a, "own");
    pi.queued.push({ text: "other-steer", kind: "steering" }, { text: "other-later", kind: "followUp" });
    await a.visit.withdraw(keyOf(a, "own"));
    await a.pass(10);
    expect(queue(pi)).toEqual(["steering own", "steering other-steer", "followUp other-later"]);
    const alone = busyPi();
    const page = await tab(alone);
    for (const message of ["two", "three", "four"]) await says(page, message);
    await page.visit.withdraw(keyOf(page, "three"));
    await page.pass(10);
    expect([queue(alone), page.given, waits(page)]).toEqual([["steering two", "steering four"], ["three"], ["two", "four"]]);
  });

  it("has each page's Stop end the turn without clearing the queue, the turn's end reaching each in its own event turn: every message stays queued once and the next run reads each once", async () => {
    const pi = busyPi();
    const [a, b] = [await tab(pi), await tab(pi)];
    await says(a, "mine-A");
    await says(b, "mine-B");
    const [atA, atB] = [acts(a).length, acts(b).length];
    const stopA = a.visit.stop();
    await a.settle();
    const stopB = b.visit.stop();
    await b.settle();
    await a.hear("turn", { kind: "turn", running: false });
    await stopA;
    await a.pass(10);
    await b.hear("turn", { kind: "turn", running: false });
    await stopB;
    await b.pass(10);
    expect([acts(a).slice(atA), acts(b).slice(atB), queue(pi), pi.read]).toEqual([["abort"], ["abort"], ["steering mine-A", "steering mine-B"], []]);
    // pi reads a prompt ahead of the steering it holds, so the message that starts the next run comes before the ones the Stop left with pi.
    await says(a, "next");
    expect([queue(pi), pi.read, waits(a), waits(b)]).toEqual([[], ["next", "mine-A", "mine-B"], ["mine-A", "next"], ["mine-B"]]);
  });
});

describe("what the platform keeps for a box that was not there", () => {
  it("no longer draws a kept message another tab took back, once the account is read again: nothing waits, and nothing is sent", async () => {
    const held = [{ id: "00000000000000a1", message: "taken back elsewhere", at: 1 }];
    const page = world({ me: { ...ME, machine: "starting", held } as Me });
    await page.visit.look();
    expect(page.visit.stream.items.filter((item) => item.kind === "user" && item.pending).map((item) => item.kind === "user" && item.text)).toEqual(["taken back elsewhere"]);
    page.setMe({ ...ME, machine: "starting", held: [] } as Me);
    page.boxTook();
    await page.visit.look();
    expect([page.visit.stream.items.filter((item) => item.kind === "user" && item.pending), page.visit.atWork, page.posted]).toEqual([[], false, []]);
  });

  const HELD: readonly HeldMessage[] = [{ id: "00000000000000a1", message: "first", at: 10 }, { id: "00000000000000a2", message: "second", at: 20 }];
  const held = (page: { readonly visit: Visit }): readonly string[] => page.visit.stream.items.flatMap((item) => (item.kind === "user" && item.pending && item.held === true ? [item.text] : []));

  it("draws the messages a reload reads from the platform waiting, once each however often the account is read, and sends none of them itself", async () => {
    const page = world({ me: { ...ME, machine: "starting", held: HELD } as Me });
    await page.visit.look();
    await page.hear("entries", { kind: "entries", epoch: EPOCH, entries: stored });
    expect(held(page)).toEqual(["first", "second"]);
    await page.visit.look();
    expect(held(page)).toEqual(["first", "second"]);
    expect([page.asked.filter((one) => one.startsWith("prompt") || one.endsWith("open")), page.visit.atWork]).toEqual([[], true]);
    // The box takes them from the platform in the order written: each of pi's records takes its echo's place, drawn once.
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await page.hear("entry", entry(81, { form: "message", role: "user", content: "first", timestamp: 1 }));
    await page.hear("entry", entry(82, { form: "message", role: "user", content: "second", timestamp: 1 }));
    expect(held(page)).toEqual([]);
    expect(page.visit.stream.items.slice(-2)).toEqual([expect.objectContaining({ text: "first", pending: false }), expect.objectContaining({ text: "second", pending: false })]);
  });

  it("takes a message the platform keeps back from it into the composer, and leaves one the box already took as sent", async () => {
    const page = world({ me: { ...ME, machine: "starting", held: HELD } as Me });
    await page.visit.look();
    const key = (words: string): string => page.visit.stream.items.find((item) => item.kind === "user" && item.text === words)!.key;
    await page.visit.withdraw(key("first"));
    expect([page.taken, held(page), page.asked.filter((one) => one.startsWith("take back"))]).toEqual([["first"], ["second"], ["take back 00000000000000a1"]]);
    // A tab that read the account before the box took it: the platform answers taken, and the message stays drawn as sent.
    const late = world({ me: { ...ME, machine: "starting", held: [{ id: "00000000000000b1", message: "gone", at: 1 }] } as Me });
    await late.visit.look();
    late.boxTook();
    await late.visit.withdraw(late.visit.stream.items.find((item) => item.kind === "user" && item.text === "gone")!.key);
    expect([late.taken, held(late)]).toEqual([[], ["gone"]]);
  });
});

describe("a message the platform kept that ended without pi taking it", () => {
  const kept: HeldMessage = { id: "00000000000000c1", message: "list my shoes", at: 10 };

  it("comes back to the composer as unsent, with pi's words, once however often the account is read, and leaves the platform", async () => {
    const page = world({ me: { ...ME, machine: "on", held: [{ ...kept, refused: "No API key found for openrouter" }] } as Me });
    await page.visit.look();
    await page.visit.look();
    expect([page.given, page.whys, page.taken]).toEqual([["list my shoes"], ["No API key found for openrouter"], []]);
    expect(page.visit.stream.items.some((item) => item.kind === "user" && item.pending)).toBe(false);
    expect(page.asked.filter((one) => one.startsWith("take back"))).toEqual(["take back 00000000000000c1"]);
  });

  it("is read again while the platform keeps a message, so an open page draws the end pi gave it: the message leaves the chat and its words come back", async () => {
    const page = world({ me: { ...ME, machine: "on", held: [kept] } as Me });
    await page.visit.look();
    expect(page.visit.stream.items.filter((item) => item.kind === "user" && item.pending).map((item) => item.kind === "user" && item.text)).toEqual(["list my shoes"]);
    page.setMe({ ...ME, machine: "on", held: [{ ...kept, refused: "" }] } as Me);
    await page.pass(WAIT_MS);
    expect([page.given, page.whys]).toEqual([["list my shoes"], [undefined]]);
    expect(page.visit.stream.items.some((item) => item.kind === "user" && item.pending)).toBe(false);
    expect(page.asked.filter((one) => one.startsWith("take back"))).toEqual(["take back 00000000000000c1"]);
  });

  it("is read for on the page that sent it from the moment the platform keeps it, so its words come back once when pi refuses it", async () => {
    const page = await openedAwake();
    page.keepNext();
    await page.visit.send("keep these words");
    await page.settle();
    const [kept] = page.row();
    expect(kept).toMatchObject({ message: "keep these words" });
    expect(page.visit.stream.items.filter((item) => item.kind === "user" && item.pending).map((item) => item.kind === "user" && item.text)).toEqual(["keep these words"]);
    page.setMe({ ...ME, machine: "on", held: [{ ...kept!, refused: "No API key" }] } as Me);
    await page.pass(3 * WAIT_MS);
    expect([page.given, page.whys]).toEqual([["keep these words"], ["No API key"]]);
    expect(page.visit.stream.items.some((item) => item.kind === "user" && item.pending)).toBe(false);
    expect(page.asked.filter((one) => one.startsWith("take back"))).toEqual([`take back ${kept!.id}`]);
  });

  /** A page that keeps reading for a held message's end gives its words back once, and takes it out of the platform once. */
  const givenBackOnce = async (page: Awaited<ReturnType<typeof openedAwake>>, words: string): Promise<void> => {
    const [kept] = page.row();
    page.setMe({ ...ME, machine: "on", held: [{ ...kept!, refused: "No API key" }] } as Me);
    await page.pass(3 * WAIT_MS);
    expect([page.given, page.whys]).toEqual([[words], ["No API key"]]);
    expect(page.asked.filter((one) => one.startsWith("take back"))).toEqual([`take back ${kept!.id}`]);
  };

  it("reads on for a held message kept while an older read of the account was under way, whose answer does not list it", async () => {
    const page = await openedAwake();
    const answer = page.slowAccount();
    const older = page.visit.look();
    page.keepNext();
    await page.visit.send("slow account words");
    await page.pass(WAIT_MS);
    answer();
    await older;
    await givenBackOnce(page, "slow account words");
  });

  it.each(["as sent", "as pi's record of it"])("draws a held message once when the platform hands it while a read of the account is under way, whose answer still lists it, drawn %s", async (drawn) => {
    let opened: () => void = () => undefined;
    const page = await openedAsleep({ openAnswered: new Promise((resolve) => { opened = resolve; }) });
    const sending = page.visit.send("handed words");
    await page.settle();
    const [kept] = page.row();
    page.setMe({ ...ME, machine: "starting", held: [kept!] } as Me);
    const answer = page.slowAccount();
    const reading = page.visit.look();
    await page.settle();
    opened();
    await sending;
    if (drawn === "as pi's record of it") await page.hear("entry", entry(81, { form: "message", role: "user", content: "handed words", timestamp: 9e15 }));
    answer();
    await reading;
    await page.settle();
    const copies = page.visit.stream.items.filter((item) => item.kind === "user" && item.text === "handed words");
    expect([copies.length, copies[0]?.kind === "user" && copies[0].pending]).toEqual([1, drawn === "as sent"]);
  });

  it("draws a held message's waiting row from a read under way when the answer to its send was lost, the platform still listing it unhanded", async () => {
    let lost: (error: Error) => void = () => undefined;
    const page = await openedAsleep({ openAnswered: new Promise((_, reject) => { lost = reject; }) });
    const sending = page.visit.send("uncertain words");
    await page.settle();
    page.setMe({ ...ME, machine: "off", held: [...page.row()] } as Me);
    const answer = page.slowAccount();
    const reading = page.visit.look();
    await page.settle();
    lost(new Error("the answer to the send was lost; the platform still keeps the message"));
    await sending;
    answer();
    await reading;
    await page.settle();
    expect([page.row().length, page.delivered, page.visit.stream.items.filter((item) => item.kind === "user" && item.text === "uncertain words" && item.pending).length]).toEqual([1, [], 1]);
  });

  it.each(["still held when the read answers", "sent after the read began", "still being sent when the read answers"] as const)("draws a held message %s once", async (when) => {
    let opened: () => void = () => undefined;
    const page = when === "still being sent when the read answers" ? await openedAsleep({ openAnswered: new Promise((resolve) => { opened = resolve; }) }) : await openedAwake();
    const words = `held ${when}`;
    if (when === "still held when the read answers") { page.keepNext(); await page.visit.send(words); }
    if (when === "still being sent when the read answers") { void page.visit.send(words); await page.settle(); }
    page.setMe({ ...ME, machine: "on", held: [...page.row()] } as Me);
    const answer = page.slowAccount();
    const reading = page.visit.look();
    await page.settle();
    if (when === "sent after the read began") { page.keepNext(); await page.visit.send(words); }
    answer();
    await reading;
    expect([page.visit.stream.items.filter((item) => item.kind === "user" && item.text === words && item.pending).length, page.row().length]).toEqual([1, 1]);
    opened();
  });

  it("gives a message pi refused at the platform's hand back once, from its own answer, and takes it out of the platform", async () => {
    const page = await openedAsleep();
    page.refuse("No API key found for openrouter");
    await page.visit.send("hello");
    await page.settle();
    expect([page.given, page.whys]).toEqual([["hello"], ["No API key found for openrouter"]]);
    expect(page.row()).toEqual([]);
    expect(page.asked.filter((one) => one.startsWith("take back"))).toHaveLength(1);
  });

  it("takes a message whose open admission refused out of the platform once its words are back", async () => {
    const page = await openedAsleep({ opens: [{ kind: "refused", reason: "global_limit" }] });
    await page.visit.send("one");
    await page.settle();
    expect(page.given).toEqual(["one"]);
    expect(page.row()).toEqual([]);
  });
});

describe("a summary of the chat asked for while a message waits", () => {
  it("says Summarising, with its time, and draws cx analysing while the summary runs; the message is at rest once it ends", async () => {
    const page = await openedAwake();
    // A turn answers, and a message is sent while it runs: pi queues it.
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("entry", entry(81, { form: "message", role: "user", content: "first", timestamp: 5 }));
    await page.hear("entry", answered(82, "Here it is."));
    await page.visit.send("queued");
    await page.pass(10);
    // The turn ends with the message unrecorded, and the page waits out its time for a turn to begin.
    await page.hear("turn", { kind: "turn", running: false });
    await page.pass(TURN_WAIT_MS);
    const read = (): readonly unknown[] => {
      const now = lineOf({ stream: page.visit.stream, atWork: page.visit.atWork, starting: false });
      const queuedStill = page.visit.stream.items.some((item) => item.kind === "user" && item.pending && item.queued === true);
      return [now === undefined || now === "keep" ? now : [now.key, now.timed], turnOf(page.visit.stream, page.visit.atWork), queuedStill];
    };
    expect([page.visit.idle, read()]).toEqual([true, [undefined, "none", true]]);
    // The summary the person asked for runs: the line says so with its time, and cx is at it, whatever waits.
    const compacting = page.visit.compact();
    await page.hear("compaction", { kind: "compaction", running: true });
    expect(read()).toEqual([["line.tidying", true], "analysing", true]);
    // Summarised, the message only waits again: the line says nothing and cx reads nothing.
    await page.hear("compaction", { kind: "compaction", running: false });
    await compacting;
    expect(read()).toEqual([undefined, "none", true]);
  });

  // A recorded answer that failed with nothing in it: an assistant entry with no blocks, as pi records an aborted request.
  const failedEmpty = (JSON.parse(readFileSync(new URL("./canned/stops/stream.jsonl", import.meta.url), "utf8").split("\n")[45]!) as { frame: { body: Readonly<Record<string, unknown>> } }).frame.body;
  it.each([["asked for", "a message waiting"], ["asked for", "nothing waiting"], ["pi's own", "a message waiting"], ["pi's own", "nothing waiting"]] as const)("draws cx analysing while a summary %s runs after an answer that failed empty, %s, and at rest once it ends", async (how, waits) => {
    expect([failedEmpty["role"], failedEmpty["content"], failedEmpty["stopReason"]]).toEqual(["assistant", [], "error"]);
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("entry", entry(81, { form: "message", role: "user", content: "first", timestamp: 5 }));
    await page.hear("entry", answered(82, "Here it is."));
    await page.hear("entry", entry(83, { form: "message", role: "user", content: "again", timestamp: 6 }));
    await page.hear("entry", entry(84, failedEmpty));
    if (waits === "a message waiting") await page.visit.send("queued");
    await page.pass(10);
    await page.hear("turn", { kind: "turn", running: false });
    await page.pass(TURN_WAIT_MS);
    const read = (): readonly unknown[] => {
      const now = lineOf({ stream: page.visit.stream, atWork: page.visit.atWork, starting: false });
      return [now === undefined || now === "keep" ? now : [now.key, now.timed], turnOf(page.visit.stream, page.visit.atWork)];
    };
    const resting = read();
    expect([page.visit.idle, resting[1]]).toEqual([true, "none"]);
    // Whatever the entry before it holds, the summary running is what cx is at.
    const compacting = how === "asked for" ? page.visit.compact() : undefined;
    await page.hear("compaction", { kind: "compaction", running: true });
    expect(read()).toEqual([["line.tidying", true], "analysing"]);
    await page.hear("compaction", { kind: "compaction", running: false });
    await compacting;
    expect(read()).toEqual(resting);
  });
});

describe("an option card holds nothing of cx's", () => {
  const FORM = { form: "comchatx.options/1", ask: "restock", questions: [{ words: "How should this lot ship?", options: [{ name: "By sea" }, { name: "By air" }] }] };
  const option = (id: string) => ({ kind: "ui_request", id, body: { form: "ui_request", id, method: "input", title: "How should this lot ship?", placeholder: JSON.stringify(FORM), timeout: 2 ** 31 - 1 } });
  const confirm = (id: string) => ({ kind: "ui_request", id, body: { form: "ui_request", id, method: "confirm", title: "Overwrite?", message: "" } });
  const VALUE = JSON.stringify({ form: "comchatx.options/1", answers: [{ chosen: ["By air"] }] });
  const held = (page: { readonly visit: Visit }): string[] => page.visit.stream.dialogs.map((one) => one.id);
  const answers = (page: { readonly posted: readonly Readonly<Record<string, unknown>>[] }): unknown[] => page.posted.filter((command) => command["type"] === "extension_ui_response").map((command) => [command["id"], command["value"] ?? command["cancelled"]]);

  it("stays past the turn it was asked in, past a message sent from the chat's box and past Stop, which let the question that holds cx go", async () => {
    const page = await openedAwake();
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("ui_request", option("o-1")); await page.hear("ui_request", confirm("d-1"));
    await page.visit.send("and price it", true);
    expect([answers(page), held(page)]).toEqual([[["d-1", true]], ["o-1"]]);
    await page.hear("turn", { kind: "turn", running: false });
    expect(held(page)).toEqual(["o-1"]);
    await page.hear("turn", { kind: "turn", running: true });
    const stopping = page.visit.stop();
    await page.settle();
    await page.hear("turn", { kind: "turn", running: false });
    await stopping;
    expect([answers(page), held(page)]).toEqual([[["d-1", true]], ["o-1"]]);
    expect(await page.visit.answer("o-1", { value: VALUE })).toBe(true);
    expect(answers(page).at(-1)).toEqual(["o-1", VALUE]);
  });

  it("keeps its card when an answer still on its way at the turn's end then fails, so the seller can send it again", async () => {
    let fail: (error: Error) => void = () => undefined;
    const page = await openedAwake({ hold: (type) => (type === "extension_ui_response" ? new Promise<void>((_, reject) => { fail = reject; }) : undefined) });
    await page.hear("turn", { kind: "turn", running: true });
    await page.hear("ui_request", option("o-1"));
    const sending = page.visit.answer("o-1", { value: VALUE });
    await page.settle();
    await page.hear("turn", { kind: "turn", running: false });
    fail(new Error("command answered 503"));
    expect(await sending).toBe(false);
    expect([held(page), page.visit.stream.items.some((item) => item.kind === "asked")]).toEqual([["o-1"], false]);
  });

  it("stands while the computer is off; answered then, the computer is switched on and the answer goes to the card its package asks again", async () => {
    const page = await openedAwake();
    await page.hear("ui_request", option("o-1"));
    await page.hear("sleep", { kind: "sleep", dueInMs: 0 });
    await page.end("box_ended");
    expect([page.visit.box, held(page)]).toEqual(["asleep", ["o-1"]]);
    const answering = page.visit.answer("o-1", { value: VALUE });
    await page.settle();
    expect(page.asked).toContain("open");
    expect(answers(page)).toEqual([]);
    await page.hear("life", { kind: "life", epoch: EPOCH });
    await page.hear("ui_request", option("o-2"));
    expect(await answering).toBe(true);
    expect(answers(page)).toEqual([["o-2", VALUE]]);
    expect(page.visit.stream.items.at(-1)).toMatchObject({ kind: "asked", key: "asked-o-2", answer: { value: VALUE } });
  });
});
