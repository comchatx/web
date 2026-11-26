import { versionInUse, type Series, type Version } from "./backend.js";
import type { Maker } from "../shared/model-series.js";
import type { CardWords } from "../shared/maker-words.js";

/** What a search reads of words: letters and figures alone, so 「gpt4o」 finds GPT-4o and 「claude opus」 finds Claude Opus. */
const plain = (words: string): string => words.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * A name's letters and figures as `plain` reads them, and where each of its words begins: at its start, after a space or a mark, where
 * letters turn to figures or back ("Qwen3.8" begins at q, 3 and 8), and at every Chinese character.
 */
function wordsOf(name: string): { readonly text: string; readonly at: readonly number[] } {
  let text = "";
  let gap = true;
  let last = "";
  const at: number[] = [];
  for (const char of name.toLowerCase()) {
    if (!/[\p{L}\p{N}]/u.test(char)) { gap = true; continue; }
    const kind = /\p{N}/u.test(char) ? "figure" : /[a-z]/.test(char) ? "letter" : "glyph";
    if (gap || kind === "glyph" || kind !== last) at.push(text.length);
    text += char;
    last = kind;
    gap = false;
  }
  return { text, at };
}

/** Whether a name holds what was typed from where one of its words begins: 「r1」 finds R1, and not Premier 1.0 or Ember-1. */
const holds = (name: string, typed: string): boolean => { const read = wordsOf(name); return read.at.some((at) => read.text.startsWith(typed, at)); };

/** The words of a search, or none while they hold no letter or figure, so a lone mark leaves the list as it was. */
export const sought = (words: string): string => (plain(words) === "" ? "" : words.trim());

/**
 * Whether a maker is what was typed: its name, or a word its card's `aliases` give, one a seller in China may search it by that its
 * English name does not hold: searched, never printed. A maker with none is found by its own name, its series' and its versions'.
 */
const makerHolds = (maker: Maker | undefined, typed: string, made: CardWords): boolean =>
  maker !== undefined && (holds(maker.name, typed) || (made[maker.id]?.aliases ?? []).some((word) => holds(word, typed) || typed.includes(plain(word))));

/** Whether a search finds a series: in its name, its maker's, its versions' names and ids, or a maker's Chinese names. */
export function finds(series: Series, words: string, made: CardWords): boolean {
  const typed = plain(words);
  if (typed === "") return true;
  return holds(series.name, typed) || makerHolds(series.maker, typed, made) || series.versions.some((version) => holds(version.name, typed) || holds(version.id, typed));
}

/**
 * The versions a search found a series by, where neither its name nor its maker's holds the words and only some of its versions do:
 * 「gpt4o」 finds GPT by GPT-4o, an older version than the one it is on. None where the name, the maker or every version holds them.
 */
export function foundVersions(series: Series, words: string, made: CardWords): readonly Version[] {
  const typed = plain(words);
  if (typed === "" || holds(series.name, typed) || makerHolds(series.maker, typed, made)) return [];
  const hits = series.versions.filter((version) => holds(version.name, typed) || holds(version.id, typed));
  return hits.length === series.versions.length ? [] : hits;
}

/** One maker's series on a host's card, as they are listed. */
export type MakerGroup = { readonly maker: Maker; readonly series: readonly Series[] };

/**
 * A host's series by maker: each maker once, in the order its name sorts, with its series as they are listed. A series that serves
 * nothing today is not listed.
 */
export function byMaker(series: readonly Series[]): readonly MakerGroup[] {
  const groups = new Map<string, { maker: Maker; series: Series[] }>();
  for (const one of series) {
    if (one.maker === undefined || versionInUse(one) === undefined) continue;
    (groups.get(one.maker.id) ?? groups.set(one.maker.id, { maker: one.maker, series: [] }).get(one.maker.id)!).series.push(one);
  }
  return [...groups.values()].map((group) => ({ maker: group.maker, series: group.series }))
    .sort((a, b) => a.maker.name.localeCompare(b.maker.name, "en", { sensitivity: "base" }));
}

/** Whether a vendor's series are many makers', as a host's are: its tab lists them in two parts, with makers and a search. */
export const ofMakers = (series: readonly Series[]): boolean => series.some((one) => one.maker !== undefined);
