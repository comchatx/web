/**
 * A quote the person put in a message: pi's id for the quoted entry, its place in the life as `<epoch>:<seq>`, and the words they saw —
 * a message of theirs whole, or what they selected in an answer.
 */
export type Quote = { readonly entry: string; readonly at: string; readonly words: string };

/**
 * A quote waiting in the message box: whose words it holds, which marks the quoted entry as read, and when they were said, which a card
 * shows; the marker carries neither. Both are the quoted entry's, and unknown for a quote that came back in a message while the entry
 * cannot be read.
 */
export type Held = Quote & { readonly who: "you" | "cx" | undefined; readonly time: number | undefined };

const MARKER = /<quote\b([^>]*)>([\s\S]*?)<\/quote>\s*/g;
const attribute = (attributes: string, name: string): string => new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1] ?? "";

/** Quoted words never end a marker early: a literal closing tag in them is written with a space, which closes nothing. */
const closed = (words: string): string => words.replace(/<\/quote>/gi, "</ quote>");
const named = (value: string): string => value.replace(/[">\s]/g, "");

/** The zone the page shows times in, the browser's own: a quote's card is drawn on it, so cx is told it too. */
export const pageZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The marker a quote is sent as, before the person's own words, with the zone its card's time was shown in. */
export const marker = (quote: Quote, zone: string = pageZone()): string =>
  `<quote entry="${named(quote.entry)}" at="${named(quote.at)}"${zone === "" ? "" : ` zone="${named(zone)}"`}>${closed(quote.words)}</quote>`;

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
    quotes.push({ entry: attribute(attributes, "entry"), at: attribute(attributes, "at"), words });
    return "";
  });
  const blocks = rest.trimEnd().split(/\n\s*\n/);
  const lines = blocks.at(-1)!.trim().split("\n");
  const files = lines.every((line) => FILE_LINE.test(line)) ? lines.map((line) => { const [, quoted, bare] = FILE_LINE.exec(line)!; return quoted ?? bare!; }) : [];
  if (quotes.length === 0 && files.length === 0) return { quotes, files, text: message };
  return { quotes, files, text: (files.length === 0 ? rest : blocks.slice(0, -1).join("\n\n")).trim() };
}

export const sameQuote = (a: Quote, b: Quote): boolean => a.entry === b.entry && a.words === b.words;

/** The first words of a quote, as a name says which one: six words, or fourteen characters where the words are not spaced. */
export function opening(words: string): string {
  const flat = words.replace(/\s+/g, " ").trim();
  const spaced = flat.split(" ");
  const cut = spaced.length > 1 ? spaced.slice(0, 6).join(" ") : flat.slice(0, 14);
  const short = cut.length > 40 ? cut.slice(0, 40) : cut;
  return short.length < flat.length ? `${short}…` : short;
}
