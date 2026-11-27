/**
 * A quote the person put in a message: pi's id for the quoted entry, its place in the life as `<epoch>:<seq>`, and the words they saw —
 * a message of theirs whole, or what they selected in an answer.
 */
export type Quote = { readonly entry: string; readonly at: string; readonly words: string; readonly from?: QuoteFrom };

/**
 * Where on the board a quote's words were, for one quoted there: its tab, the card's file on that tab or the tree's file a tab shows, and
 * the source its card draws — 「收件箱 · {title}」, a board's name, a file's name. A quote from the board has no entry and no place.
 */
export type QuoteFrom = { readonly board: string; readonly card?: string; readonly file?: string; readonly label: string };

/**
 * The source line a quote from a board draws, one rule wherever it was quoted: an excerpt of a card with a title, the board's name and
 * the title; a whole card, words in no card, or an excerpt of a card with none, the board's name. A file's is its own name, apart.
 */
export const boardSource = (name: string, part: { readonly card?: string; readonly title?: string; readonly whole?: boolean }): string =>
  part.card !== undefined && part.whole !== true && part.title !== undefined && part.title !== "" ? `${name} · ${part.title}` : name;

/**
 * A quote waiting in the message box: whose words it holds, which marks the quoted entry as read, and when they were said, which a card
 * shows; the marker carries neither. Both are the quoted entry's, and unknown for a quote that came back in a message while the entry
 * cannot be read.
 */
export type Held = Quote & { readonly who: "you" | "cx" | undefined; readonly time: number | undefined };

const MARKER = /<quote\b([^>]*)>([\s\S]*?)<\/quote>\s*/g;
const attribute = (attributes: string, name: string): string => unescaped(new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1] ?? "");
/** A board's or a file's name may hold any character, so a source's values are written as an attribute's are. */
const escaped = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unescaped = (value: string): string => value.replace(/&(quot|lt|gt|amp);/g, (_, name: string) => ({ quot: "\"", lt: "<", gt: ">", amp: "&" })[name]!);

/** Quoted words never end a marker early: a literal closing tag in them is written with a space, which closes nothing. */
const closed = (words: string): string => words.replace(/<\/quote>/gi, "</ quote>");
const named = (value: string): string => value.replace(/[">\s]/g, "");

/** The zone the page shows times in, the browser's own: a quote's card is drawn on it, so cx is told it too. */
export const pageZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The marker a quote is sent as, before the person's own words, with the zone its card's time was shown in. */
export const marker = (quote: Quote, zone: string = pageZone()): string => {
  const from = quote.from;
  if (from !== undefined) {
    const more = [["card", from.card], ["file", from.file]].flatMap(([name, value]) => (value === undefined ? [] : [` ${name}="${escaped(value)}"`])).join("");
    return `<quote board="${escaped(from.board)}"${more} from="${escaped(from.label)}">${closed(quote.words)}</quote>`;
  }
  return `<quote entry="${named(quote.entry)}" at="${named(quote.at)}"${zone === "" ? "" : ` zone="${named(zone)}"`}>${closed(quote.words)}</quote>`;
};

/** pi's own editor writes a path this way, quoted where a space or Chinese punctuation would end it (`@"成本 核算.xlsx"`). */
const CJK = "[\\p{Script_Extensions=Han}\\p{Script_Extensions=Hiragana}\\p{Script_Extensions=Katakana}\\p{Script_Extensions=Hangul}\\p{Script_Extensions=Bopomofo}]";
const SEPARATES = new RegExp(`(?:\\s|(?=\\p{Punctuation})${CJK}|[，．：；！？（）［］｛｝“”‘’…—])`, "u");
const FILE_LINE = /^@(?:"(.+)"|(\S+))$/su;
/** One line naming a file, as pi's own editor writes it. */
export const fileLine = (name: string): string => (SEPARATES.test(name) || name.startsWith("\"") ? `@"${name}"` : `@${name}`);

/**
 * A message as it is sent: one marker per quote, with the zone its card's time was shown in, then the person's words, then a line for
 * each file it names. A command named at the words' start goes before the markers, followed by a space, where pi reads a command.
 */
export function sentWith(quotes: readonly Quote[], words: string, files: readonly string[] = [], zone?: string): string {
  const command = quotes.length === 0 ? undefined : /^\/\S+(?=\s|$)/.exec(words)?.[0];
  const rest = command === undefined ? words : words.slice(command.length).trim();
  const body = [...quotes.map((quote) => marker(quote, zone ?? pageZone())), ...(rest === "" ? [] : [rest]), ...(files.length === 0 ? [] : [files.map(fileLine).join("\n")])].join("\n\n");
  return command === undefined ? body : `${command} ${body}`;
}

/**
 * A message as it is read back: the quotes its markers carry, in their order; the files it names, read from its last lines, after a
 * blank line, each a single `@name` or `@"name"`; and the person's own words with every marker and those lines taken out. A seller's own
 * last line of that shape is read as a file.
 */
export function unquoted(message: string): { readonly quotes: readonly Quote[]; readonly files: readonly string[]; readonly text: string } {
  const quotes: Quote[] = [];
  const rest = message.replace(MARKER, (_, attributes: string, words: string) => {
    const board = attribute(attributes, "board");
    const card = attribute(attributes, "card"), file = attribute(attributes, "file");
    const from: QuoteFrom | undefined = board === "" && file === "" ? undefined : { board, ...(card === "" ? {} : { card }), ...(file === "" ? {} : { file }), label: attribute(attributes, "from") || board || file };
    quotes.push({ entry: attribute(attributes, "entry"), at: attribute(attributes, "at"), words, ...(from === undefined ? {} : { from }) });
    return "";
  });
  const blocks = rest.trimEnd().split(/\n\s*\n/);
  const lines = blocks.at(-1)!.trim().split("\n");
  const files = lines.every((line) => FILE_LINE.test(line)) ? lines.map((line) => { const [, quoted, bare] = FILE_LINE.exec(line)!; return quoted ?? bare!; }) : [];
  if (quotes.length === 0 && files.length === 0) return { quotes, files, text: message };
  return { quotes, files, text: (files.length === 0 ? rest : blocks.slice(0, -1).join("\n\n")).trim() };
}

export const sameQuote = (a: Quote, b: Quote): boolean =>
  a.entry === b.entry && a.words === b.words && a.from?.board === b.from?.board && a.from?.card === b.from?.card && a.from?.file === b.from?.file;

/** The first words of a quote, as a name says which one: six words, or fourteen characters where the words are not spaced. */
export function opening(words: string): string {
  const flat = words.replace(/\s+/g, " ").trim();
  const spaced = flat.split(" ");
  const cut = spaced.length > 1 ? spaced.slice(0, 6).join(" ") : flat.slice(0, 14);
  const short = cut.length > 40 ? cut.slice(0, 40) : cut;
  return short.length < flat.length ? `${short}…` : short;
}
