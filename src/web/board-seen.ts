import type { DraftStorage } from "./board-drafts.js";

/** Where the browser keeps, for each account, the newest card of each board of the base's the seller has seen. */
export const SEEN_PREFIX = "cmx-board-seen:";

/**
 * What the base knows by itself (`parts/board-page.md` §1; round 9, "The base alone"): a file landed on a board of its own the seller has
 * not opened since. For each board it keeps the time of the newest card the seller saw, the board shown in the open column; a board
 * whose newest card is newer carries the dot. A board met the first time is taken as seen, so what stood there before is not new. The
 * marks are kept for the account in the browser; a write the browser refuses keeps them for the visit. A mark comes only from a board's
 * own cards as the running box gave them: until the visit has read them no mark is kept and no dot drawn. A board the visit listed by its
 * first read from the running box, with no mark in this browser, is taken as seen as it stands when its cards are first read; one first
 * listed after that read is new to the seller, so every card on it is fresh.
 */
export class SeenBoards {
  #account: string | undefined;
  #held = new Map<string, number>();
  /** Whether the visit has read the running box yet; the boards it listed until then; the boards whose cards it read from the box. */
  #met = false;
  #listed = new Set<string>();
  #read = new Set<string>();
  constructor(readonly storage: Pick<DraftStorage, "read" | "write" | "remove"> | undefined, readonly account: () => string | undefined) {}

  #marks(): Map<string, number> {
    const account = this.account();
    if (account !== this.#account) {
      this.#account = account;
      this.#held = new Map();
      this.#met = false;
      this.#listed = new Set();
      this.#read = new Set();
      if (account === undefined) return this.#held;
      try {
        const kept = JSON.parse(this.storage?.read(`${SEEN_PREFIX}${account}`) ?? "{}") as unknown;
        if (typeof kept === "object" && kept !== null && !Array.isArray(kept)) for (const [tab, at] of Object.entries(kept)) if (typeof at === "number" && Number.isFinite(at)) this.#held.set(tab, at);
      } catch { /* none kept */ }
    }
    return this.#held;
  }

  #keep(): void {
    if (this.#account === undefined) return;
    try { this.storage?.write(`${SEEN_PREFIX}${this.#account}`, JSON.stringify(Object.fromEntries(this.#held))); } catch { /* kept for the visit */ }
  }

  /**
   * A read of the board: the boards it lists; whether it came from the running box; and the boards whose own cards it read from the box,
   * each with its newest card's time, none from a kept read or a board whose read failed. A board whose cards are read the first time this
   * visit gets a mark if it has none: as it stands where the visit listed it by its first read from the box, else none seen.
   */
  readOf(listed: readonly string[], live: boolean, read: ReadonlyMap<string, number>): void {
    const marks = this.#marks();
    if (!this.#met) for (const tab of listed) this.#listed.add(tab);
    if (live) this.#met = true;
    let added = false;
    for (const [tab, newest] of live ? read : []) {
      this.#read.add(tab);
      if (!marks.has(tab)) { marks.set(tab, this.#listed.has(tab) ? newest : 0); added = true; }
    }
    if (added) this.#keep();
  }

  /** Whether a board's cards, read from the running box, hold one newer than the seller saw; none before they are read. */
  fresh(tab: string, newest: number): boolean {
    const seen = this.#marks().get(tab);
    return this.#read.has(tab) && seen !== undefined && newest > seen;
  }

  /** The seller saw a board as it stands, its cards read from the running box. True where that took its dot away. */
  saw(tab: string, newest: number): boolean {
    const marks = this.#marks();
    const seen = marks.get(tab);
    if (!this.#read.has(tab) || (seen !== undefined && seen >= newest)) return false;
    marks.set(tab, newest);
    this.#keep();
    return seen !== undefined;
  }

  /** Only the boards that still stand keep a mark. */
  only(tabs: ReadonlySet<string>): void {
    const marks = this.#marks();
    const gone = [...marks.keys()].filter((tab) => !tabs.has(tab));
    if (gone.length === 0) return;
    for (const tab of gone) marks.delete(tab);
    this.#keep();
  }

  /** A board renamed carries its mark to its new name. */
  moved(from: string, to: string): void {
    const marks = this.#marks();
    for (const one of [this.#listed, this.#read]) if (one.delete(from)) one.add(to);
    const seen = marks.get(from);
    if (seen === undefined) return;
    marks.delete(from);
    marks.set(to, seen);
    this.#keep();
  }
}
