import { UPLOAD_MAX_BYTES, UPLOAD_PIECE_BYTES, UPLOAD_VERB } from "../shared/upload.js";
import { NotRunning } from "./backend.js";

/**
 * A file in the message box, as its card draws it. `uploading` from the moment it is added, cx's computer starting first if it sleeps.
 * `saved`: the name it took in the seller's files, once it is whole there. A card that came back with a message has no file of the
 * page's: its name, and its size where this page wrote it.
 */
export type FileCard = {
  readonly id: string;
  readonly name: string;
  readonly size: number | undefined;
  readonly image: string | undefined;
  readonly state: "uploading" | "large" | "failed" | "done";
  readonly received: number;
  readonly saved: string | undefined;
  /** Why a failed file did not go, where it was that cx's computer did not start: the words the page already says for that cause. */
  readonly why?: UploadWhy | undefined;
};
/** The causes of a computer that did not start that the page tells apart, each by the words it already prints for it. */
export type UploadWhy = "cx.say.balance" | "status.unreachable" | "cx.say.refused" | "cx.say.failed";

export type FileUploadsPorts = {
  /** A session command, as `POST /command` takes it. */
  readonly command: (command: Readonly<Record<string, unknown>>) => Promise<unknown>;
  /** cx's computer, ready to take a file: at once while it runs, started as a message starts it while it sleeps; false if it did not start. */
  readonly wake: () => Promise<boolean>;
  /** Why cx's computer did not start, after a `wake` that said so; nothing where the page cannot name it. */
  readonly why: () => UploadWhy | undefined;
  /** How many times the page has found cx's computer up: a command is sent under the count of the moment. */
  readonly found: () => number;
  /** A command sent under `found` that the box was not there to take: the next `wake` starts it, unless the page has found it up since. */
  readonly notThere: (found: number) => void;
  /** The cards changed: what draws them, and Send, follow. */
  readonly changed: () => void;
  /** A file that cannot go, or took another name, as it happens: said to a screen reader. */
  readonly tell: (cards: readonly FileCard[]) => void;
  /** A small picture of an image file, for its card, as an address the page's policy lets it draw; none where it cannot make one. */
  readonly picture?: (file: File) => Promise<string | undefined>;
};

type Card = { -readonly [K in keyof FileCard]: FileCard[K] } & { readonly file: File | undefined; run: object | undefined; going: Promise<void> | undefined; upload: string | undefined };

/** A command of the file's the box was not there to take, with the count it was sent under. */
class Refused extends Error {
  constructor(readonly found: number) { super("the box was not there to take the command"); }
}
/** cx's computer did not start for the file, and why, where the page can say. */
class NotStarted extends Error {
  constructor(readonly why: UploadWhy | undefined) { super("cx's computer did not start"); }
}

/** A refusal's piece count, if it says one: where the box's copy stands. */
const refusal = (body: unknown): { readonly error: unknown; readonly received: unknown } | undefined => {
  if (typeof body !== "object" || body === null || (body as { success?: unknown }).success !== false) return undefined;
  const data = (body as { data?: { received?: unknown } }).data;
  return { error: (body as { error?: unknown }).error, received: data?.received };
};
const dataOf = (body: unknown): Readonly<Record<string, unknown>> => {
  const data = typeof body === "object" && body !== null ? (body as { data?: unknown }).data : undefined;
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
};

/** A piece of a file in base64, as the box takes it. */
export async function base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = "";
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(text);
}

/** How many times a piece the box held differently is sent again from where the box says it stands. */
const RESENDS = 3;

/**
 * The files in the message box: each goes up the moment it is added, in pieces, to the top of the seller's files, and stays there
 * whether or not the message is sent (spikes/message-box, "For the build"). One added while cx's computer sleeps starts it and goes up
 * as soon as it can take it (ruled 2026-10-22). The cards do not outlive the page, as typed words do not.
 */
export class FileUploads {
  #cards: Card[] = [];
  #next = 0;
  /** The size of each file this page wrote, by the name it took: a card brought back with its message says it again. */
  readonly #sizes = new Map<string, number>();
  constructor(readonly ports: FileUploadsPorts) {}

  get cards(): readonly FileCard[] { return this.#cards; }
  /** Whether every file in the box is whole in the seller's files: none going up, too large or failed. */
  get ready(): boolean { return this.#cards.every((card) => card.state === "done"); }
  /** The names a sent message gives its files, as they stand in the seller's files. */
  get names(): readonly string[] { return this.#cards.flatMap((card) => (card.saved === undefined ? [] : [card.saved])); }

  /** Files from the picker, a drop or a paste join the cards; one over the limit stays as a card that says so. */
  add(files: readonly File[], named: (file: File) => string = (file) => file.name): void {
    if (files.length === 0) return;
    const added = files.map((file): Card => {
      const card: Card = { id: `file-${++this.#next}`, name: named(file), size: file.size, image: undefined, state: file.size > UPLOAD_MAX_BYTES ? "large" : "uploading", received: 0, saved: undefined, file, run: undefined, going: undefined, upload: undefined };
      this.#cards.push(card);
      if (file.type.startsWith("image/")) void this.ports.picture?.(file).then((image) => { if (image !== undefined && this.#cards.includes(card)) { card.image = image; this.ports.changed(); } }, () => undefined);
      return card;
    });
    this.ports.changed();
    this.ports.tell(added.filter((card) => card.state === "large"));
    for (const card of added) if (card.state === "uploading") this.#start(card);
  }

  /** The files a message named, back in the box with it: they are in the seller's files already and do not go up again. */
  returned(names: readonly string[]): void {
    const added = names.filter((name, at) => names.indexOf(name) === at && !this.#cards.some((card) => card.saved === name));
    if (added.length === 0) return;
    for (const name of added) this.#cards.push({ id: `file-${++this.#next}`, name, size: this.#sizes.get(name), image: undefined, state: "done", received: 0, saved: name, file: undefined, run: undefined, going: undefined, upload: undefined });
    this.ports.changed();
  }

  /**
   * A card taken out: a file still going up stops there, and one already written leaves the seller's files again, since the page
   * wrote it and nothing has read it (the final form ruled 2026-10-19). The box deletes only what it wrote, and nothing standing there since.
   */
  remove(id: string): void {
    const card = this.#cards.find((one) => one.id === id);
    if (card === undefined) return;
    this.#cards = this.#cards.filter((one) => one !== card);
    card.run = undefined;
    if (card.state === "done" && card.saved !== undefined) void this.ports.command({ type: UPLOAD_VERB, op: "remove", name: card.saved }).catch(() => undefined);
    else if (card.upload !== undefined) void this.ports.command({ type: UPLOAD_VERB, op: "abort", upload: card.upload }).catch(() => undefined);
    this.ports.changed();
  }

  /** Try again: the file goes up from its start, starting cx's computer first if it sleeps. */
  retry(id: string): void {
    const card = this.#cards.find((one) => one.id === id);
    if (card === undefined || card.state !== "failed") return;
    this.#start(card);
  }

  /** The message went with its files: the cards go, and the files stay in the seller's files. */
  clear(): void {
    if (this.#cards.length === 0) return;
    for (const card of this.#cards) card.run = undefined;
    this.#cards = [];
    this.ports.changed();
  }

  #start(card: Card): void {
    const going = this.#go(card).finally(() => { if (card.going === going) card.going = undefined; });
    card.going = going;
  }

  /**
   * A file refused because the box was not there — asleep, closing or still coming up — goes up again from its start once the box is,
   * as a message waits for it: once, since a box that refuses it again is one that is not coming up.
   */
  async #go(card: Card): Promise<void> {
    const file = card.file;
    if (file === undefined) return;
    const run = {};
    card.run = run;
    const live = (): boolean => card.run === run && this.#cards.includes(card);
    for (let woken = false; ; woken = true) {
      try {
        await this.#once(card, file, live);
        return;
      } catch (error) {
        if (!live()) return;
        if (error instanceof Refused && !woken) {
          if (card.upload !== undefined) void this.ports.command({ type: UPLOAD_VERB, op: "abort", upload: card.upload }).catch(() => undefined);
          this.ports.notThere(error.found);
          continue;
        }
        card.state = "failed";
        card.why = error instanceof NotStarted ? error.why : undefined;
        card.run = undefined;
        this.ports.changed();
        this.ports.tell([card]);
        return;
      }
    }
  }

  /** A command of the file's: one the box was not there to take is told with the count it was sent under. */
  async #send(command: Readonly<Record<string, unknown>>): Promise<unknown> {
    const found = this.ports.found();
    return this.ports.command(command).catch((error: unknown) => { throw error instanceof NotRunning ? new Refused(found) : error; });
  }

  async #once(card: Card, file: File, live: () => boolean): Promise<void> {
    card.state = "uploading";
    card.why = undefined;
    card.received = 0;
    card.upload = undefined;
    this.ports.changed();
    if (!(await this.ports.wake())) throw new NotStarted(this.ports.why());
    if (!live()) return;
    const begun = await this.#send({ type: UPLOAD_VERB, op: "begin", name: card.name, bytes: file.size });
    const upload = dataOf(begun)["upload"];
    if (refusal(begun)?.error === "too_large") { if (live()) { card.state = "large"; card.run = undefined; this.ports.changed(); this.ports.tell([card]); } return; }
    if (typeof upload !== "string") throw new Error("the upload did not begin");
    card.upload = upload;
    if (!live()) { void this.ports.command({ type: UPLOAD_VERB, op: "abort", upload }).catch(() => undefined); return; }
    let resends = 0;
    while (card.received < file.size) {
      const at = card.received;
      const said = await this.#send({ type: UPLOAD_VERB, op: "piece", upload, at, data: await base64(file.slice(at, at + UPLOAD_PIECE_BYTES)) });
      if (!live()) return;
      const refused = refusal(said);
      const received = refused === undefined ? dataOf(said)["received"] : refused.received;
      // A piece whose answer was lost is not written twice: the box says where its copy stands, and the next piece goes from there.
      if (refused !== undefined && (typeof received !== "number" || ++resends > RESENDS)) throw new Error("the piece was refused");
      if (typeof received !== "number" || received < 0 || received > file.size) throw new Error("the box said no size");
      card.received = received;
      this.ports.changed();
    }
    // Only a file not yet whole goes up again: one refused at its end fails, as any other.
    const ended = await this.ports.command({ type: UPLOAD_VERB, op: "end", upload });
    const saved = dataOf(ended)["name"];
    if (typeof saved !== "string") throw new Error("the file was not written");
    if (!live()) { void this.ports.command({ type: UPLOAD_VERB, op: "remove", name: saved }).catch(() => undefined); return; }
    card.saved = saved;
    card.state = "done";
    this.#sizes.set(saved, file.size);
    card.run = undefined;
    this.ports.changed();
    if (saved !== card.name) this.ports.tell([card]);
  }
}
