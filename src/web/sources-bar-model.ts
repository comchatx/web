import type { Source, SourceMonth } from "./backend.js";
import { purchase as buy, reconcile, replay } from "./source-rows.js";

/** cx's motion vocabulary, `CxCharacter.MOTION`, in seconds: the bar keeps no timing of its own. */
export type Motion = { readonly blend: number; readonly wipe: number; readonly hold: number; readonly read: number; readonly hop: { readonly dur: number } };

/**
 * One purchase, from its receipt's arrival (the design of 2026-09-24, as signed off on 2026-09-28): the edge sweeps the purchase over its
 * row; held a moment, the money leaves the row as a receipt on cx's hop and lands in cx's raised hand, the hand going up just before it
 * arrives; the edge sweeps the row back, its figure moved on, while cx reads.
 */
export function timeline(motion: Motion) {
  const covered = motion.wipe;
  const launch = covered + motion.hold;
  const land = launch + motion.hop.dur;
  const reach = land - (motion.blend + 0.03);
  const settled = land + motion.wipe;
  const read = land + motion.read;
  return Object.freeze({ covered, launch, reach, land, settled, read, end: Math.max(settled, read) });
}

export type Face = { readonly phase: "base" | "in" | "over" | "out"; readonly u: number };
/** The row's face a time into its purchase, `u` how far the edge has gone before easing. With reduced motion there is no edge. */
export function faceAt(t: number, times: ReturnType<typeof timeline>, reduced: boolean): Face {
  if (t < 0) return { phase: "base", u: 0 };
  if (t < times.covered) return reduced ? { phase: "over", u: 1 } : { phase: "in", u: t / times.covered };
  if (t < times.land) return { phase: "over", u: 1 };
  if (t < times.settled) return reduced ? { phase: "base", u: 0 } : { phase: "out", u: (t - times.land) / (times.settled - times.land) };
  return { phase: "base", u: 0 };
}

export type Hold = { readonly catching: false | "watch" | "reach"; readonly receipt: boolean; readonly busy: boolean };
/** One purchase as the ledger shows it: how far a source's month figure rose between two reads, in platform units and the supplier's own. */
export type Purchase = { readonly key: string; readonly source: string; readonly units: number; readonly native: { readonly amount: number; readonly unit: string } | undefined };
export type Playing = { readonly purchase: Purchase; readonly place: number; readonly took: string | undefined; readonly t: number };

type Entry = { readonly purchase: Purchase; readonly place: number; readonly took: string | undefined; readonly after: readonly string[]; readonly before: SourceMonth | undefined; startedAt: number | undefined };

/** How far a month rose from the one read before it; a month the page has not read before counts from zero. */
function rise(before: SourceMonth, now: SourceMonth): Omit<Purchase, "key" | "source"> | undefined {
  const fresh = before.since !== now.since;
  const units = fresh ? now.spent : now.spent - before.spent;
  if (units <= 0) return undefined;
  // Nothing settled yet this month is zero of every unit; otherwise the tokens rose only if both figures count the same unit.
  const from = fresh || (before.spent === 0 && before.native === undefined) ? 0 : before.native?.unit === now.native?.unit ? before.native?.amount : undefined;
  const amount = now.native === undefined || from === undefined ? undefined : now.native.amount - from;
  return { units, native: amount === undefined || amount <= 0 ? undefined : { amount, unit: now.native!.unit } };
}

/**
 * The sidebar's source rows and the purchases they show, from the ledger alone: each `/sources` answer carries what was settled at every
 * source this month, and a purchase is a source's figure rising between two answers. The stream only says when to ask again — a `cx get`
 * ending — and what cx does meanwhile; nothing a tool printed is read for money. Rows follow the rule of `source-rows.ts`: the first
 * figures read order them by each source's last settlement; after that a rise takes a row as a purchase does. A figure once read stays on
 * screen until an answer carrying a newer one replaces it, and only such an answer is the base the next rise is counted from.
 */
export class SourcesBarModel {
  readonly #times: ReturnType<typeof timeline>;
  #read = false;
  #enabled: readonly string[] = [];
  /** The rows after every purchase seen: what is drawn once nothing plays. */
  #rows: readonly string[] = [];
  /** Each source's last settlement, in ms, as the ledger said or as the page saw it rise. */
  #last = new Map<string, number>();
  /** The figures last read, source by source: what the rows show, and the base of the next rise. */
  readonly #figures = new Map<string, SourceMonth>();
  #based = false;
  /** The rows drawn now: a purchase's row changes hands only under its cover. */
  #drawn: readonly string[] = [];
  readonly #queue: Entry[] = [];
  #count = 0;

  constructor(motion: Motion) { this.#times = timeline(motion); }

  get times(): ReturnType<typeof timeline> { return this.#times; }

  /** The month's figure a source's row shows at `now`: the last one read, but the one before a purchase until its cover is over the row. */
  figure(source: string, now: number): SourceMonth | undefined {
    this.#advance(now);
    const waiting = this.#queue.find((entry) => entry.purchase.source === source && (entry.startedAt === undefined || (now - entry.startedAt) / 1000 < this.#times.covered));
    return waiting === undefined ? this.#figures.get(source) : waiting.before;
  }

  /** One `/sources` answer, in the order the answers came; `visible` is asked only when a purchase is to play. */
  sources(sources: readonly Source[], visible: () => boolean, now: number): void {
    this.#advance(now);
    const enabled = sources.filter((source) => source.enabled).map((source) => source.name);
    const months = sources.filter((source) => source.month !== undefined);
    if (!this.#read) {
      this.#read = true;
      this.#enabled = enabled;
      this.#rows = reconcile([], enabled, this.#last);
    } else if (enabled.join("\n") !== this.#enabled.join("\n")) {
      this.#enabled = enabled;
      this.#rows = reconcile(this.#rows, enabled, this.#last);
    }
    if (months.length === 0) { this.#advance(now); return; }
    if (!this.#based) {
      // The first figures: the rows are the sources most recently settled at, oldest first, as a reload draws them.
      this.#based = true;
      const settled = months.filter((source) => source.month!.lastAt !== undefined).sort((a, b) => a.month!.lastAt! - b.month!.lastAt!);
      for (const source of settled) this.#last.set(source.name, source.month!.lastAt!);
      if (this.#queue.length === 0) this.#rows = replay(enabled, settled.map((source) => source.name)).rows;
      for (const source of months) this.#figures.set(source.name, source.month!);
      this.#advance(now);
      return;
    }
    const rose = months.flatMap((source) => {
      const before = this.#figures.get(source.name);
      const up = before === undefined ? undefined : rise(before, source.month!);
      return up === undefined ? [] : [{ source, up }];
    }).sort((a, b) => (a.source.month!.lastAt ?? now) - (b.source.month!.lastAt ?? now));
    const before = new Map(this.#figures);
    for (const source of months) this.#figures.set(source.name, source.month!);
    let shown: boolean | undefined;
    for (const { source, up } of rose) {
      // Each rise is the most recent purchase, in the order the ledger settled them, whatever the clocks say.
      const at = Math.max(source.month!.lastAt ?? 0, ...this.#last.values(), 0) + 1;
      if (!enabled.includes(source.name)) { this.#last.set(source.name, at); continue; }
      const next = buy(this.#rows, enabled, this.#last, source.name);
      this.#last.set(source.name, at);
      this.#rows = next.rows;
      shown ??= visible();
      const purchase = Object.freeze({ key: `${source.name}#${++this.#count}`, source: source.name, ...up });
      if (shown) this.#queue.push({ purchase, place: next.place, took: next.took, after: next.rows, before: before.get(source.name), startedAt: undefined });
    }
    this.#advance(now);
  }

  /** The rows drawn at `now`. */
  rows(now: number): readonly string[] { this.#advance(now); return this.#drawn; }

  /** The purchase playing at `now`, and how far into it. */
  playing(now: number): Playing | undefined {
    this.#advance(now);
    const head = this.#queue[0];
    return head === undefined || head.startedAt === undefined ? undefined : { purchase: head.purchase, place: head.place, took: head.took, t: (now - head.startedAt) / 1000 };
  }

  /** What cx does for the rows at `now`: during a purchase it watches, raises its hand as the receipt nears and reads it once landed. */
  hold(now: number): Hold {
    const playing = this.playing(now);
    if (playing === undefined) return { catching: false, receipt: false, busy: false };
    const t = playing.t;
    return { catching: t < this.#times.reach ? "watch" : t < this.#times.land ? "reach" : false, receipt: t >= this.#times.land && t < this.#times.read, busy: t < this.#times.read };
  }

  /** Whether anything still plays: the page draws a frame for as long as one does. */
  get active(): boolean { return this.#queue.length > 0; }

  #advance(now: number): void {
    for (;;) {
      const head = this.#queue[0];
      if (head === undefined) { this.#drawn = this.#rows; return; }
      head.startedAt ??= now;
      const t = (now - head.startedAt) / 1000;
      if (t < this.#times.covered) return;
      this.#drawn = head.after;
      if (t < this.#times.end) return;
      this.#queue.shift();
      const next = this.#queue[0];
      if (next !== undefined) next.startedAt = head.startedAt + this.#times.end * 1000;
    }
  }
}
