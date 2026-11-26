import { loggedKind, OPENED_MAX } from "../shared/board.js";
import type { DraftStorage } from "./board-drafts.js";
import { h, svg } from "./dom.js";
import type { StringKey } from "./strings.js";

/** Where the browser keeps the files open as tabs of the board, one key for each account. */
export const FILES_PREFIX = "cmx-board-files:";

type Say = (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;

/** A file's own name, the last part of its tree path. */
export const fileName = (path: string): string => path.split("/").at(-1) ?? path;
/** A file's tab as the frame keeps its page: a key no folder of the board can be, since a folder's name holds no slash. */
export const fileKey = (path: string): string => `/${path}`;
export const isFileKey = (tab: string): boolean => tab.startsWith("/");

const SHEET = ["M7 3.5h7l4 4v13H7z", "M14 3.5v4h4"] as const;
/** Each kind's mark is the file's sheet with its kind drawn inside; a kind no viewer of the platform's own knows is the sheet alone. */
const MARKS: Readonly<Record<ReturnType<typeof loggedKind>, readonly string[]>> = {
  markdown: [...SHEET, "M9.5 12h5", "M9.5 15h5", "M9.5 18h3"],
  table: [...SHEET, "M9.5 11.5h6v6h-6z", "M9.5 14.5h6", "M12.5 11.5v6"],
  html: [...SHEET, "M11 12l-2 2.5 2 2.5", "M14 12l2 2.5-2 2.5"],
  picture: [...SHEET, "M9 18l2.5-3.5 2 2.5 1.5-2 1.5 3", "M10.5 11.5a.6.6 0 1 0 0 1.2a.6.6 0 1 0 0-1.2z"],
  plain: SHEET,
};
/** The board's own mark, the one on the board's icon. */
const BOARD = ["M9 5H7a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2", "M9 3.5h6v3H9z", "M9.5 11h5", "M9.5 15h3.5"] as const;
const mark = (paths: readonly string[], extra?: string): SVGElement =>
  svg("svg", { class: extra === undefined ? "icon" : `icon ${extra}`, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, ...paths.map((d) => svg("path", { d })));
/** A file's kind, as its mark draws it. */
export const kindMark = (path: string): SVGElement => mark(MARKS[loggedKind(path)]);

/**
 * A file cx named, as main's file box: its kind's mark, which gives way to the board's under the pointer or the keyboard, and its name; a
 * press shows it on a tab of the board. On a base card the press is `pressed`; in the chat the stream hears it by `data-cx-file`, a
 * draft's words being copies with no listener of their own, as a page's own script does in a page's words.
 */
export function fileBox(path: string, say: Say, pressed?: (path: string) => void): HTMLButtonElement {
  const name = fileName(path);
  return h("button", { type: "button", class: "file-ref file-open", dir: "auto", "data-cx-file": path, "aria-label": say("board.fileOpen", { name }), ...(pressed === undefined ? {} : { onclick: () => pressed(path) }) },
    h("span", { class: "mark" }, mark(MARKS[loggedKind(path)], "of-kind"), mark(BOARD, "to-board")), h("span", { class: "file-ref-name" }, name)) as HTMLButtonElement;
}

/**
 * A file named in a page's words, as the kit draws one (`Kit.file`): its one mark and its name, `data-cx-file` for the page's own script
 * to take the press.
 */
export const pageFileBox = (path: string, say: Say): HTMLButtonElement =>
  h("button", { type: "button", class: "file-ref", dir: "auto", "data-cx-file": path, "aria-label": say("board.fileOpen", { name: fileName(path) }) }, mark(SHEET), h("span", { class: "file-ref-name" }, fileName(path))) as HTMLButtonElement;

/**
 * The files open as tabs of the board (`parts/board-page.md` §1), by tree path in the order they were opened, for the account signed in:
 * kept in the browser, so a reload keeps them and a second device does not show them. At most `OPENED_MAX`; one more lets the first go.
 */
export class OpenFiles {
  #account: string | undefined;
  #held: string[] = [];
  constructor(readonly storage: Pick<DraftStorage, "read" | "write" | "remove"> | undefined, readonly account: () => string | undefined) {}

  #paths(): string[] {
    const account = this.account();
    if (account !== this.#account) {
      this.#account = account;
      this.#held = [];
      if (account === undefined) return this.#held;
      try {
        const kept = JSON.parse(this.storage?.read(`${FILES_PREFIX}${account}`) ?? "[]") as unknown;
        if (Array.isArray(kept)) this.#held = [...new Set(kept.filter((one): one is string => typeof one === "string" && one !== "" && !one.startsWith("/")))].slice(-OPENED_MAX);
      } catch { /* none kept */ }
    }
    return this.#held;
  }

  #keep(): void {
    if (this.#account === undefined) return;
    const name = `${FILES_PREFIX}${this.#account}`;
    try { if (this.#held.length === 0) this.storage?.remove(name); else this.storage?.write(name, JSON.stringify(this.#held)); } catch { /* the copy is not kept */ }
  }

  get all(): readonly string[] { return [...this.#paths()]; }
  has(path: string): boolean { return this.#paths().includes(path); }

  /** Opens a file's tab after the others; the one opened first goes where there is no room. */
  add(path: string): void {
    const paths = this.#paths();
    if (paths.includes(path)) return;
    paths.push(path);
    if (paths.length > OPENED_MAX) paths.shift();
    this.#keep();
  }

  remove(path: string): void {
    const paths = this.#paths();
    const at = paths.indexOf(path);
    if (at === -1) return;
    paths.splice(at, 1);
    this.#keep();
  }
}
