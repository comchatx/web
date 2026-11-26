import { writeCursor, type BoardEntry } from "../shared/board.js";

/**
 * What the page knows of the board (`parts/cx-board.md`): whether the account's packages show it, its tabs, and every file in each tab,
 * each drawn as a card of the base.
 */
export type BoardModel = {
  /** Unknown until the first read answers. */
  readonly shown: boolean | undefined;
  /** The person's tabs, by name: one per directory of the board, as the last read said. */
  readonly tabs: readonly string[];
  /** Each tab but 待办, its files as the base draws them. */
  readonly others: ReadonlyMap<string, readonly BoardEntry[]>;
  /** 待办's files, read first: the tab every first read asks for. */
  readonly todo: readonly BoardEntry[];
};

/** An entry's key, as the cursor writes one: its time and its name. */
export const entryKey = (entry: { readonly file: string; readonly modified: number }): string => writeCursor({ modified: entry.modified, name: entry.file });

export const EMPTY_BOARD: BoardModel = Object.freeze({ shown: undefined, tabs: Object.freeze([]), others: new Map(), todo: Object.freeze([]) });

/** A tab's cards, the newest first by when each file was last written, then by name. */
export const baseCards = (entries: readonly BoardEntry[]): readonly BoardEntry[] =>
  [...entries].sort((a, b) => b.modified - a.modified || (b.file < a.file ? -1 : 1));

/** A fresh read of the board folded into what the page holds: every file a card of the base, whatever its front matter. */
export function withRead(model: BoardModel, read: { readonly shown: boolean; readonly tabs?: readonly string[]; readonly others?: ReadonlyMap<string, readonly BoardEntry[]>; readonly todo?: readonly BoardEntry[] }): BoardModel {
  if (!read.shown) return { ...EMPTY_BOARD, shown: false };
  const tabs = read.tabs ?? model.tabs;
  const others = new Map([...(read.others ?? model.others)].filter(([tab]) => tabs.includes(tab)).map(([tab, entries]) => [tab, entries.map(asBase)] as const));
  return { shown: true, tabs, others, todo: (read.todo ?? model.todo).map(asBase) };
}

/** A file as the base draws it, whatever its front matter: its title, its words, its time, and how and when it was done. */
export function asBase(entry: BoardEntry): BoardEntry {
  if (!entry.readable) return entry;
  const { file, place, modified, title, body, done, doneAt, pending, from } = entry;
  return { file, place, modified, readable: false, title, body, ...(done === undefined ? {} : { done }), ...(doneAt === undefined ? {} : { doneAt }), ...(pending === undefined ? {} : { pending }), ...(from === undefined ? {} : { from }) };
}
