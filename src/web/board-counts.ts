import type { DraftStorage } from "./board-drafts.js";

/** Where the browser keeps the numbers pages gave, one key for each account. */
export const COUNTS_PREFIX = "cmx-board-counts:";

/** A page's number on the board's icon, and its words for what it counts where it gave any. */
export type PageCount = { readonly n: number; readonly words?: string };

const readCount = (value: unknown): PageCount | undefined => {
  if (!Array.isArray(value) || typeof value[0] !== "number" || !Number.isSafeInteger(value[0]) || value[0] < 1) return undefined;
  return typeof value[1] === "string" && value[1] !== "" ? { n: value[0], words: value[1] } : { n: value[0] };
};

/**
 * The numbers pages gave the board's icon (`parts/board-page.md` §1), by tab, for the account signed in: kept in the browser, so the icon
 * carries a page's number before that page runs again, as round 8 has it. A zero is no number. A write the browser refuses keeps the
 * number drawn, and the next load does not have it.
 */
export class PageCounts {
  #account: string | undefined;
  #held = new Map<string, PageCount>();
  constructor(readonly storage: Pick<DraftStorage, "read" | "write" | "remove"> | undefined, readonly account: () => string | undefined) {}

  #counts(): Map<string, PageCount> {
    const account = this.account();
    if (account !== this.#account) {
      this.#account = account;
      this.#held = new Map();
      if (account === undefined) return this.#held;
      try {
        const kept = JSON.parse(this.storage?.read(`${COUNTS_PREFIX}${account}`) ?? "{}") as unknown;
        if (typeof kept === "object" && kept !== null && !Array.isArray(kept)) for (const [tab, value] of Object.entries(kept)) { const one = readCount(value); if (one !== undefined) this.#held.set(tab, one); }
      } catch { /* none kept */ }
    }
    return this.#held;
  }

  #keep(): void {
    if (this.#account === undefined) return;
    const name = `${COUNTS_PREFIX}${this.#account}`;
    try {
      if (this.#held.size === 0) this.storage?.remove(name);
      else this.storage?.write(name, JSON.stringify(Object.fromEntries([...this.#held].map(([tab, one]) => [tab, one.words === undefined ? [one.n] : [one.n, one.words]]))));
    } catch { /* the copy is not kept */ }
  }

  /** A tab's number, if its page gave one. */
  of(tab: string): PageCount | undefined { return this.#counts().get(tab); }

  /** A page's number and words; true where it changed what is drawn. */
  set(tab: string, n: number, words: string | undefined): boolean {
    const counts = this.#counts();
    const was = counts.get(tab);
    if (n === 0) { if (was === undefined) return false; counts.delete(tab); }
    else { if (was?.n === n && was.words === words) return false; counts.set(tab, words === undefined ? { n } : { n, words }); }
    this.#keep();
    return true;
  }

  /** Only the tabs that still hold a page keep a number: one whose page went takes its number with it. True where one went. */
  only(tabs: ReadonlySet<string>): boolean {
    const counts = this.#counts();
    const gone = [...counts.keys()].filter((tab) => !tabs.has(tab));
    if (gone.length === 0) return false;
    for (const tab of gone) counts.delete(tab);
    this.#keep();
    return true;
  }

  /** Every tab's number, the tabs in the order given. */
  all(tabs: readonly string[]): readonly (PageCount & { readonly tab: string })[] {
    const counts = this.#counts();
    return tabs.flatMap((tab) => { const one = counts.get(tab); return one === undefined ? [] : [{ tab, ...one }]; });
  }
}

/**
 * The board's icon's name for its number (`parts/board-page.md` §1). The number is the base's own count, as built, and the sum of the
 * numbers pages gave. With no page's number, the icon is named as built. With one, the name is 看板 or the base's count, then each page's
 * words for its number, in the tabs' order; where no page gave words, 「看板，有新内容」: the base has no word for what a page counts.
 */
export function iconName(base: number, pages: readonly PageCount[], say: (key: "board.board" | "board.boardPending" | "frame.boardNew", values?: Readonly<Record<string, number>>) => string, comma: string): string {
  if (pages.length === 0) return base > 0 ? say("board.boardPending", { n: base }) : say("board.board");
  const words = pages.flatMap((one) => (one.words === undefined ? [] : [one.words]));
  if (words.length === 0) return base > 0 ? say("board.boardPending", { n: base }) : say("frame.boardNew");
  return [base > 0 ? say("board.boardPending", { n: base }) : say("board.board"), ...words].join(comma);
}
