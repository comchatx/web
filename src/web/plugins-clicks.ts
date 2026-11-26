import { refusalOf, type Click, type PackageList, type PackageRefusal } from "./backend.js";

/**
 * How often the list is read again while a click of this page's has not ended. cx's computer was measured to take about a second for a
 * package the image carries and about fourteen for one from the internet, so two seconds says an end soon after it happens.
 */
export const REREAD_MS = 2_000;
/** The longest cx's computer takes to end one change once it starts it: the bound it puts on the change, and the second it gives pi to exit. */
export const BOX_ENDS_BY_MS = 241_000;
/** How long a click is read for, counted from the click: the computer's own bound and two reads past it, so an end at the bound is read and not missed. */
export const WAIT_BOUND_MS = BOX_ENDS_BY_MS + 2 * REREAD_MS;
/** The rejection of a click the bound passed with no end said: neither done nor failed. */
export const UNENDED = "unended";
/** The rejection of a click a sleeping computer keeps: it ends at the computer's next start. */
export const ASLEEP = "asleep";

/**
 * The rejection of clicks cx's computer ended as failed: its message is the first one's reason, as a click's refusal always was, and
 * it names every click that failed, so what was heard of one package is said of that package.
 */
export class Refused extends Error {
  constructor(readonly clicks: readonly { readonly source: string; readonly op: Click["op"]; readonly reason: string; readonly detail?: string }[]) { super(clicks[0]?.reason ?? ""); }
}

type Outcome = { readonly how: "unsaid" } | { readonly how: "done"; readonly end: string } | { readonly how: "failed"; readonly reason: string; readonly detail?: string; readonly end: string };
type Watched = { id: string; op: Click["op"]; readonly source: string; outcome?: Outcome };
type Batch = {
  readonly clicks: readonly Watched[]; readonly since: number;
  /** How many reads had begun when the clicks were answered: only a read begun later says anything of them. */
  readonly after: number;
  readonly resolve: (how: "done" | "unsaid") => void; readonly reject: (error: Error) => void;
};

/** The platform's own words for a read or a click it could not serve: none of them is the computer saying how it would end a change. */
const PLATFORMS: readonly PackageRefusal[] = ["box_unreachable", "waiting_full", "sources_unavailable"];
const SWITCH: readonly Click["op"][] = ["on", "off"];
/** The platform's own rule for which waiting entry a later click on its source takes the place of: the same op, or both a switch. */
const folds = (one: Click["op"], other: Click["op"]): boolean => one === other || (SWITCH.includes(one) && SWITCH.includes(other));

/**
 * The page's clicks that have not ended, and the one timer that reads the list for them. A click's answer says only that the platform
 * wrote it down; how it ended is what a later list says, and this is where that is read.
 */
export class Clicks {
  readonly #read: () => Promise<PackageList>;
  readonly #asleep: () => boolean;
  readonly #now: () => number;
  readonly #batches = new Set<Batch>();
  readonly #said = new Set<string>();
  #reads = 0;
  /** The one read that is out, and the one asked for behind it. */
  #out: Promise<PackageList> | undefined;
  #kept: Promise<PackageList> | undefined;
  #timer: ReturnType<typeof setInterval> | undefined;

  /** `asleep` is whether cx's computer is off, as cx's card holds it: a list cannot say so. */
  constructor(read: () => Promise<PackageList>, asleep: () => boolean, now: () => number = Date.now) { this.#read = read; this.#asleep = asleep; this.#now = now; }

  /** The ends this watcher has already answered a click with, by `${source}\u0000${at}`: the page does not say them a second time. */
  get said(): ReadonlySet<string> { return this.#said; }
  /** Whether the interval is running, for tests. */
  get reading(): boolean { return this.#timer !== undefined; }

  /**
   * The list, one read at a time: asked for while a read is out, it is the one read that begins when that one comes back, however many
   * asked, since the read that is out began before whatever the asker wants to hear of.
   */
  read(): Promise<PackageList> {
    if (this.#out === undefined) {
      const out: Promise<PackageList> = this.#once().finally(() => { if (this.#out === out) this.#out = undefined; });
      this.#out = out;
      return out;
    }
    this.#kept ??= this.#out.then(() => undefined, () => undefined).then(() => { this.#kept = undefined; return this.read(); });
    return this.#kept;
  }

  /**
   * The read that is out, joined, or one begun now: for a caller that asks what is installed and no click of its own, so the question
   * asked twice is asked once. A click's end is heard only from a read begun after it, whichever caller began it.
   */
  join(): Promise<PackageList> { return this.#out ?? this.read(); }

  /** One read, through the one counter that says which reads began after which clicks. */
  async #once(): Promise<PackageList> {
    const number = ++this.#reads;
    try {
      const list = await this.#read();
      for (const batch of [...this.#batches]) if (batch.after < number) this.#hear(batch, list);
      return list;
    } catch (error) {
      // The computer answered that it could not list: every change on it starts with the same list and fails the same way.
      const reason = refusalOf(error);
      if (reason !== undefined && !PLATFORMS.includes(reason)) for (const batch of [...this.#batches]) if (this.#now() - batch.since >= REREAD_MS) this.#end(batch, () => batch.reject(new Error(reason)));
      throw error;
    }
  }

  /**
   * Settles when every click has ended: `done` when the list said each one done, `unsaid` when one ended and the list keeps no word of
   * how; rejects with the first failed click's reason, with `ASLEEP` where the computer sleeps, or with `UNENDED`.
   */
  ended(clicks: readonly Click[]): Promise<"done" | "unsaid"> {
    if (clicks.length === 0) return Promise.resolve("done");
    return new Promise((resolve, reject) => {
      this.#batches.add({ clicks: clicks.map((click) => ({ id: click.id, op: click.op, source: click.source })), since: this.#now(), after: this.#reads, resolve, reject });
      this.#timer ??= setInterval(() => this.#tick(), REREAD_MS);
      void this.read().catch(() => undefined);
    });
  }

  #tick(): void {
    // A read that hangs or fails keeps no click past its bound.
    for (const batch of [...this.#batches]) if (this.#now() - batch.since >= WAIT_BOUND_MS) this.#end(batch, () => batch.reject(new Error(UNENDED)));
    if (this.#batches.size > 0 && this.#out === undefined) void this.read().catch(() => undefined);
  }

  #end(batch: Batch, settle: () => void): void {
    if (!this.#batches.delete(batch)) return;
    if (this.#batches.size === 0) { clearInterval(this.#timer); this.#timer = undefined; }
    settle();
  }

  #hear(batch: Batch, list: PackageList): void {
    const { waiting, ends } = list;
    // A list with no word of clicks is the platform not reading what it keeps: nothing is known of any click from it.
    if (waiting !== undefined && ends !== undefined) {
      for (const click of batch.clicks) {
        if (click.outcome !== undefined || waiting.some((one) => one.id === click.id)) continue;
        // Another click on the source was folded over this one: the end that comes is that entry's. Where the entry stood is not in the
        // list, so the newest entry that could have taken its place is followed, whatever was written behind it since.
        const over = waiting.findLast((one) => one.source === click.source && folds(one.op, click.op));
        if (over !== undefined) { click.id = over.id; click.op = over.op; continue; }
        const end = ends.find((one) => one.source === click.source && one.op === click.op);
        if (end === undefined) { click.outcome = { how: "unsaid" }; continue; }
        const key = `${end.source}\u0000${end.at}`;
        click.outcome = end.ok ? { how: "done", end: key } : { how: "failed", reason: end.reason ?? "", ...(end.detail === undefined ? {} : { detail: end.detail }), end: key };
      }
      if (batch.clicks.every((click) => click.outcome !== undefined)) {
        // An end is said only by the answer that carries it: clicks given up with another still out have said none of theirs.
        for (const click of batch.clicks) if (click.outcome !== undefined && click.outcome.how !== "unsaid") this.#said.add(click.outcome.end);
        const failed = batch.clicks.flatMap((click) => (click.outcome?.how === "failed" ? [{ source: click.source, op: click.op, reason: click.outcome.reason, ...(click.outcome.detail === undefined ? {} : { detail: click.outcome.detail }) }] : []));
        const unsaid = batch.clicks.some((click) => click.outcome?.how === "unsaid");
        this.#end(batch, () => (failed.length > 0 ? batch.reject(new Refused(failed)) : batch.resolve(unsaid ? "unsaid" : "done")));
        return;
      }
    }
    // Nothing wakes a sleeping computer: a click it has not ended waits from the first list that says so, and no clock runs for work it is not doing.
    if (this.#asleep()) this.#end(batch, () => batch.reject(new Error(ASLEEP)));
  }
}
