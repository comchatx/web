import { href } from "./plugins-model.js";
import type { StringKey } from "./strings.js";

/**
 * The lines said in the conversation during the tutorial, by the signed prototype's names for them: cx's, the last of them (T10) at the
 * last scene, and the seller's first question (S1), which the page puts in the message box and draws as the seller's own once it is sent
 * unchanged.
 */
export const GUIDE_LINES = Object.freeze({
  T1: "guide.t1",
  T1n: "guide.t1n",
  T2: "guide.t2",
  T6: "guide.t6",
  S1: "guide.s1",
  A1: "guide.a1",
  A2: "guide.a2",
  T7: "guide.t7",
  T10: "guide.t10",
} as const satisfies Record<string, StringKey>);

export type GuideLine = keyof typeof GUIDE_LINES;

/** The line the seller says, drawn as their message is: every other is cx's. */
export const SELLERS: GuideLine = "S1";

export const isGuideLine = (value: unknown): value is GuideLine => typeof value === "string" && Object.hasOwn(GUIDE_LINES, value);

/** Where a braced name in a line opens, in place, by the words the line prints: that plugin's own page. */
export const GUIDE_LINKS: Readonly<Record<string, string>> = Object.freeze({
  "Keepa 数据接口": href.npm("cx-keepa"),
  "Keepa API": href.npm("cx-keepa"),
  "亚马逊卖家整合包": "#/plugins/b/amazon-seller",
  "Amazon Seller Bundle": "#/plugins/b/amazon-seller",
  "亚马逊卖家接口": href.npm("cx-amazon-sp-api"),
  "Amazon SP-API": href.npm("cx-amazon-sp-api"),
});

/** A run of a line's words: a link where the signed line braces a name it knows, a value where it names one given. */
export type GuidePiece = { readonly words: string; readonly href?: string; readonly value?: true };

const HAN_SPACE_END = /\p{Script=Han} $/u;
const HAN_START = /^\p{Script=Han}/u;
const HAN_LAST = /\p{Script=Han}$/u;
const HAN_AFTER_SPACE = /^ \p{Script=Han}/u;

/**
 * A line in runs, read from its signed words before any value goes in: a braced name in the link table is always that link, whatever the
 * values hold; any other braced name among the values is that value, as text, and the space beside either goes where Chinese meets Chinese (copy rule 5, as `text` does for a value). A brace
 * it knows neither way stays as written, so what a value holds is never read as a link.
 */
export function guidePieces(signed: string, values: Readonly<Record<string, string>> = {}, links: Readonly<Record<string, string>> = GUIDE_LINKS): readonly GuidePiece[] {
  const pieces: GuidePiece[] = [];
  let from = 0;
  for (const match of signed.matchAll(/\{([^{}]+)\}/g)) {
    const name = match[1]!;
    const piece: GuidePiece | undefined = Object.hasOwn(links, name) ? { words: name, href: links[name]! } : Object.hasOwn(values, name) ? { words: values[name]!, value: true } : undefined;
    if (piece === undefined) continue;
    const before = signed.slice(from, match.index);
    pieces.push({ words: HAN_SPACE_END.test(before) && HAN_START.test(piece.words) ? before.slice(0, -1) : before }, piece);
    from = match.index + match[0].length;
    if (HAN_LAST.test(piece.words) && HAN_AFTER_SPACE.test(signed.slice(from))) from += 1;
  }
  pieces.push({ words: signed.slice(from) });
  return pieces.filter((piece) => piece.words !== "" || piece.value === true);
}

/** How many characters a line's runs hold, as a growing line counts them: Unicode code points, a value's among them. */
export const guideLength = (pieces: readonly GuidePiece[]): number => pieces.reduce((sum, piece) => sum + [...piece.words].length, 0);

/** Where a value stands in a line's markdown until it is drawn: a private-use character, which markdown reads as a letter of text. */
export const GUIDE_VALUE = 0xe000;

/**
 * A line's runs as the markdown an answer is drawn from, up to `shown` characters while it grows, whole once it has ended. The signed
 * words are the markdown, so a numbered line is a list; a link is a markdown link to its page, its words cut where the line is. A value
 * is not markdown: it stands as one `GUIDE_VALUE` character, the first value's, then the next, and `values` holds its words as far as
 * the line has grown, for the view to put in as text.
 */
export function guideMarkdown(pieces: readonly GuidePiece[], shown?: number): { readonly source: string; readonly values: readonly string[] } {
  let left = shown ?? Number.POSITIVE_INFINITY;
  let source = "";
  const values: string[] = [];
  for (const piece of pieces) {
    if (left <= 0) break;
    const characters = [...piece.words];
    const words = characters.slice(0, left).join("");
    left -= characters.length;
    if (piece.value === true) {
      source += String.fromCodePoint(GUIDE_VALUE + values.length);
      values.push(words);
    } else source += piece.href === undefined ? words : `[${words}](${piece.href})`;
  }
  return { source, values };
}
