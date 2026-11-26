import { readEntryTime } from "../shared/board.js";

/**
 * An answers' message the board once sent (`parts/cx-board.md`), as history holds it: each entry answered as a marker naming it by its key —
 * its file and the time of the version answered — the entry's title inside it, and under it the seller's sentence. The chat draws it so.
 */
export type BoardPair = { readonly file: string; readonly modified: number; readonly title: string; readonly said: string };

const OPENER = /^<board file="([^"]*)" modified="([^"]*)">/;
const CLOSE = "</board>";

/** A name is written so it never ends its attribute, and read back so. */
const named = (file: string): string => file.replaceAll("&", "&amp;").replaceAll("\"", "&quot;");
const unnamed = (file: string): string => file.replaceAll("&quot;", "\"").replaceAll("&amp;", "&");

/**
 * A message read back as the pairs it was sent as; nothing for a message that is anything else. Markers are read one after another: each
 * opens a line, its title runs on that line to the marker's own close, and its sentence to the line that opens the next. Words that look
 * like a marker inside a title or a sentence are words, and only a marker's own `file` and `modified` name an entry.
 */
export function readBoardMessage(text: string): readonly BoardPair[] | undefined {
  const pairs: BoardPair[] = [];
  let at = 0;
  for (;;) {
    const opener = OPENER.exec(text.slice(at));
    if (opener === null) return undefined;
    const start = at + opener[0].length;
    const close = text.indexOf(CLOSE, start);
    if (close < 0 || text.slice(start, close).includes("\n")) return undefined;
    const after = close + CLOSE.length;
    const next = text.indexOf(CLOSE, after);
    // The next marker opens the line its close is on, after a blank line; the sentence is everything before it.
    const line = next < 0 ? -1 : text.lastIndexOf("\n", next) + 1;
    if (next >= 0 && (line < 2 || text.slice(line - 2, line) !== "\n\n" || line <= after)) return undefined;
    const said = text.slice(after, next < 0 ? text.length : line - 2).trim();
    const modified = readEntryTime(opener[2]!);
    const file = unnamed(opener[1]!);
    if (file === "" || said === "" || modified === undefined) return undefined;
    pairs.push({ file, modified, title: text.slice(start, close), said });
    if (next < 0) return pairs;
    at = line;
  }
}

const FROM = /\n\n<board from="([^"\n]*)"(?: card="([^"\n]*)")?><\/board>$/;

/**
 * A message a board's page sent (`parts/board-page.md` §1): the page's words, then on a line of its own after a blank one a marker naming the
 * board it came from, as the answers' markers name their files, and the card it answers where the page named one: cx reads where it came
 * from, and the chat reads the card it answers after a reload of history too.
 */
export const fromBoard = (text: string, board: string, card?: string): string =>
  `${unmarked(text)}\n\n<board from="${named(board)}"${card === undefined ? "" : ` card="${named(card)}"`}></board>`;

/**
 * Words with every fragment that opens or closes a board marker taken out, however nested or split, whatever typed, pasted or gave them:
 * the message box's send and a page's send both pass their words through it, so the one marker a message can carry is the one `fromBoard` puts after a page's words, and nothing shows a
 * marker raw.
 */
export function unmarked(text: string): string {
  let left = text;
  for (let was = ""; was !== left;) {
    was = left;
    let open = false;
    left = left.replace(BOARD_TAG, (tag) => {
      if (ANSWER_OPENER.test(tag)) { open = true; return tag; }
      if (open && /^<\/board>$/.test(tag)) { open = false; return tag; }
      return "";
    });
  }
  return left.trim();
}

/**
 * Any tag that opens or closes a board's marker, in any case or spacing. Of them only an answer's marker, as `boardMessage` writes it, and
 * the close that ends it are kept, so a page's answers keep their pairs; every other is taken out, again until none is, so none is left
 * that taking one out put together.
 */
const BOARD_TAG = /<\s*board\b[^>]*>|<\/board\s*>/gi;
const ANSWER_OPENER = /^<board file="[^"]*" modified="[^"]*">$/;

/** A message read back as the words a board's page sent, the board it named and the card it answers; nothing for a message that names no board. */
export function readFromBoard(text: string): { readonly text: string; readonly board: string; readonly card?: string } | undefined {
  const found = FROM.exec(text);
  if (found === null || found[1] === "") return undefined;
  return { text: text.slice(0, found.index), board: unnamed(found[1]!), ...(found[2] === undefined || found[2] === "" ? {} : { card: unnamed(found[2]) }) };
}

/** When cx wrote an entry, as its file's name begins (`YYYYMMDD-HHMMSS`, in UTC); nothing for a name that does not. */
export function writtenAt(file: string): number | undefined {
  const parts = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(file);
  if (parts === null) return undefined;
  const [, year, month, day, hour, minute, second] = parts.map(Number) as [number, number, number, number, number, number, number];
  const at = Date.UTC(year, month - 1, day, hour, minute, second);
  return Number.isFinite(at) ? at : undefined;
}
