import type { FoundRow, HistoryLine, HistoryRow, ListPart } from "./backend.js";
import type { StreamState } from "./stream-model.js";
import { ownWords } from "../shared/own-words.js";

/**
 * The sidebar's History: the rows read from the platform in parts, newest first, with what the live view adds since — a title as it
 * arrives, a turn under way or not, a rename, the person's messages sent since the read — so the list is never read again for something the page saw.
 * One row is open at a time, or none once the reader shut it. A search asks the platform and its rows stand in place of the list until the words are cleared.
 */
export type HistoryState = {
  readonly rows: readonly HistoryRow[];
  /** The place to read on before, when more lies before the rows read. */
  readonly next: string | undefined;
  /** Whether the first part has come. */
  readonly read: boolean;
  readonly loading: "first" | "earlier" | undefined;
  readonly failed: boolean;
  /** Whether the whole list is open in the sidebar, or only the five newest rows show. */
  readonly full: boolean;
  /** The place of the open row, whose messages show beneath it. */
  readonly open: string | undefined;
  readonly search: Search | undefined;
  /** Whether titles show: false while the account's packages do not load cx-topics, as the last part read says. */
  readonly titled: boolean;
};

export type Search = { readonly words: string; readonly rows: readonly FoundRow[]; readonly next: string | undefined; readonly loading: "first" | "earlier" | undefined; readonly failed: boolean };

export const HISTORY_EMPTY: HistoryState = Object.freeze({ rows: Object.freeze([]), next: undefined, read: false, loading: undefined, failed: false, full: false, open: undefined, search: undefined, titled: true });

/** How many of the newest rows the sidebar shows while the whole list is shut. */
export const SHOWN = 5;

/** The sequence number of a place, `<epoch>:<seq>`. */
export const seqOf = (place: string): number => Number(place.slice(place.lastIndexOf(":") + 1));
const epochOf = (place: string): string => place.slice(0, place.lastIndexOf(":"));

/** A part of the list has come: the first, or one before the rows read, taken once whatever arrives twice. */
export function listed(state: HistoryState, part: ListPart<HistoryRow>, first: boolean): HistoryState {
  const held = first ? [] : state.rows;
  const known = new Set(held.map((row) => row.at));
  return { ...state, rows: [...held, ...part.items.filter((row) => !known.has(row.at))], next: part.next, read: true, loading: undefined, failed: false, titled: part.titled !== false };
}

/** A part of a search's rows has come for these words; one for words since changed is dropped. */
export function found(state: HistoryState, words: string, part: ListPart<FoundRow>, first: boolean): HistoryState {
  if (state.search?.words !== words) return state;
  const held = first ? [] : state.search.rows;
  const known = new Set(held.map((row) => row.at));
  return { ...state, search: { words, rows: [...held, ...part.items.filter((row) => !known.has(row.at))], next: part.next, loading: undefined, failed: false } };
}

/**
 * The rows as the page shows them, newest first: the rows read, with the live view's shown titles over them by the entry each names —
 * a rename in place, a cleared title gone, a new one first — and each row whose stretch the live view holds given the person's messages
 * there that the read did not have. A rename finds its row by the entry id the row carries, wherever the live view's parts reach; a new
 * title on a message neither a row nor the live view holds is read for (`unplaced`), and one of another life waits for the next read. Without `titled`, no title of
 * the live view's joins: the rows stay the one row of every message the platform read, with the messages sent since.
 */
export function shown(rows: readonly HistoryRow[], live: StreamState, titled = true): readonly HistoryRow[] {
  const epoch = rows[0] === undefined ? live.epoch : epochOf(rows[0].at);
  if (epoch === undefined || live.epoch !== epoch) return rows;
  const said = live.items.flatMap((item) => (item.kind === "user" && !item.pending && item.key.startsWith(`${epoch}:`) ? [{ item, seq: seqOf(item.key) }] : []));
  const titles = titled ? live.titles : [];
  let held = [...rows];
  for (const title of titles) {
    const message = said.find((one) => one.item.entryId === title.target);
    const there = held.findIndex((row) => row.id === title.target || row.at === message?.item.key);
    if (title.title === undefined) { if (there >= 0) held.splice(there, 1); continue; }
    if (there >= 0) held[there] = { ...held[there]!, title: title.title };
    else if (message !== undefined) held.push({ at: message.item.key, id: title.target, time: message.item.at ?? 0, title: title.title, messages: [] });
  }
  held = held.sort((a, b) => seqOf(b.at) - seqOf(a.at));
  return held.map((row, place) => {
    const start = seqOf(row.at);
    const end = place === 0 ? Number.POSITIVE_INFINITY : seqOf(held[place - 1]!.at);
    const known = new Set(row.messages.map((line) => line.at));
    const added: HistoryLine[] = said.filter(({ item, seq }) => seq >= start && seq < end && !known.has(item.key)).map(({ item }) => ({ at: item.key, time: item.at ?? 0, line: firstLine(item.text) }));
    // A row is only the read's own when the live view has nothing to say of it; a list a row lost to a title before it is cut there.
    const messages = [...row.messages.filter((line) => seqOf(line.at) < end), ...added].sort((a, b) => seqOf(a.at) - seqOf(b.at));
    return added.length === 0 && messages.length === row.messages.length ? row : { ...row, messages };
  });
}

/** The messages a shown title of the live view names that neither a row nor the live view holds: only a fresh read can place them. */
export function unplaced(rows: readonly HistoryRow[], live: StreamState): readonly string[] {
  const held = new Set(live.items.flatMap((item) => (item.kind === "user" && item.entryId !== undefined ? [item.entryId] : [])));
  return live.titles.filter((title) => title.title !== undefined && !held.has(title.target) && !rows.some((row) => row.id === title.target)).map((title) => title.target);
}

/** The first line of a message as a row lists it: the person's own words on one line, without the quotes and skills it carries, by the index's own reading. */
export const firstLine = (text: string): string => (ownWords(text).split("\n").find((line) => line.trim() !== "") ?? "").trim();

/** The rows the shut list shows: the newest few, the newest at the bottom. */
export const newestShown = (rows: readonly HistoryRow[]): readonly HistoryRow[] => rows.slice(0, SHOWN).reverse();

/** Without titles the list is the person's messages themselves, newest first, each with the row it was read in. */
export const linesOf = (rows: readonly HistoryRow[]): readonly { readonly line: HistoryLine; readonly row: string }[] =>
  rows.flatMap((row) => row.messages.map((line) => ({ line, row: row.at }))).sort((a, b) => seqOf(b.line.at) - seqOf(a.line.at));

/** No row open, as the reader left it: the row being read does not open itself again. */
export const SHUT = "";

/** A row's list opened, or shut when it was open, and nothing else: the conversation stays where it is. */
export const toggled = (state: HistoryState, at: string, open: boolean): HistoryState => ({ ...state, open: open ? SHUT : at });

/** The first and the last moment of what a row holds: its own message's and those of the person's messages listed in it. None when no time is known. */
export function spanOf(row: HistoryRow): { readonly from: number; readonly to: number } | undefined {
  const times = [row.time, ...row.messages.map((line) => line.time)].filter((time) => time > 0);
  return times.length === 0 ? undefined : { from: Math.min(...times), to: Math.max(...times) };
}

/** A row opened: its messages show and any other row shuts. A message pressed in the open row leaves it open; its title pressed again shuts it, which is `toggled`. */
export const opened = (state: HistoryState, at: string): HistoryState => (state.open === at ? state : { ...state, open: at });
