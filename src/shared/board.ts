import { firstHeading } from "./markdown.js";
import { defaultSource, isOurs, NPM_SCOPE } from "./package-names.js";
import { CONFIRM_FORM, OPTION_FORM, readAnswersValue, readConfirmedValue, type OptionAnswer } from "./option-form.js";

/** The board's base: a directory whose Markdown files are cards, by the name pi lists it under and the source its install names. */
export const BOARD_PACKAGE = "@comchatx/cx-board";
export const BOARD_SOURCE = defaultSource(BOARD_PACKAGE);
/** The module on the base, since 0.3 the Inbox's page for 待办; the box still lists its `todo/` where the account holds it at 0.2.x. */
export const TASKS_PACKAGE = "@comchatx/cx-board-tasks";
export const TASKS_SOURCE = defaultSource(TASKS_PACKAGE);

/** The steward's own session command for the board: pi never sees it, and only the steward reads and moves the board's files. */
export const BOARD_VERB = "cx_board";

/** The tree's directory of boards, one per person, each holding one directory per tab. */
export const BOARD_ROOT = "board";
/**
 * A tab is a directory of the person's board, named by it: no slash, no control character, never `.`, `..` or a name that starts with a
 * dot, at most 64 characters. The base draws one per directory, by name, with no knowledge of who writes it.
 */
export const BOARD_TAB = /^(?!\.)[^/\\\u0000-\u001f\u007f]{1,64}$/u;
/**
 * The to-do and question module's tab: the one directory whose `todo/` and `done/` are places, whose files have kinds and whose clicks the
 * platform keeps. A click's key, `<modified>/<name>`, is resolved under it.
 */
export const TASKS_TAB = "待办";
export const BOARD_PLACES = ["todo", "done"] as const;
export type BoardPlace = (typeof BOARD_PLACES)[number];

export const BOARD_KINDS = ["finding", "change", "proposal", "choice", "input"] as const;
export type BoardKind = (typeof BOARD_KINDS)[number];
/** The kinds that wait for the seller's answer; the rest are only to read. */
export const ASKING_KINDS: readonly BoardKind[] = Object.freeze(["proposal", "choice", "input"]);

export const DONE_WAYS = ["read", "dismissed", "answered"] as const;
export type DoneWay = (typeof DONE_WAYS)[number];

/** A person's id as a directory name: the account's id, which the platform makes. */
export const PERSON = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
/** An entry's file name, as cx writes it and as the board moves it: one name, no directory, ending in `.md`. */
export const ENTRY_FILE = /^(?:\.\.\/)?(?!\.)[^/\\\0]{1,200}\.md$/;
/**
 * A base card's file, as a tab's directory holds it at any depth: its path from the tab, each part a name that starts with no dot, at most
 * sixteen deep. A click never names one: only the module's entries are clicked, by `ENTRY_FILE`.
 */
export const BASE_FILE = /^(?:(?!\.)[^/\\\0]{1,200}\/){0,15}(?!\.)[^/\\\0]{1,200}\.md$/;
/** A file a part may name: a module's entry or a base card's path. */
const partFile = (file: string): boolean => ENTRY_FILE.test(file) || BASE_FILE.test(file);
/**
 * A file waits in `todo/` or directly in the person's board, and an entry names it as `todo/` sees it: `x.md` in `todo/`, `../x.md` beside
 * it, so two files of one name are two entries, whatever reads or clicks them.
 */
export const BESIDE_TODO = "../";
/** A waiting entry's name as its directory holds it. */
export const bareName = (file: string): string => (file.startsWith(BESIDE_TODO) ? file.slice(BESIDE_TODO.length) : file);
/** `todo`'s order, newest first by name: by the file's own name, then the one in `todo/` before the one beside it. */
export const nameBefore = (one: string, other: string): boolean => bareName(one) < bareName(other) || (bareName(one) === bareName(other) && one < other);
export const todoOrder = (a: { readonly file: string }, b: { readonly file: string }): number => (nameBefore(a.file, b.file) ? 1 : nameBefore(b.file, a.file) ? -1 : 0);

/** The most of one file the board reads; a larger one is drawn as a generic row. */
export const ENTRY_MAX_BYTES = 32 * 1024;
/** Entries in one part of a list, unless the reader asks fewer. */
export const BOARD_PART = 20;
/** The most a list of one place reads, newest first by name; the rest wait for a later read. */
export const BOARD_MAX_FILES = 2000;
/** A choice's options the board draws, each one line. */
export const MAX_OPTIONS = 12;

/**
 * One file on the board as the page draws it. Every Markdown file is a card of the base: its title — the front matter's, else its first
 * heading, else its file's name — and its words (decision D223). One whose front matter has a known kind, a title and when cx wrote it is
 * `readable`, and carries those besides, which the module draws; any other is the base's alone, drawn at its file's time.
 */
export type BoardEntry = {
  readonly file: string;
  readonly place: BoardPlace;
  /** When the file was last written, in milliseconds; the base card's time, and the order of what cx left without a time. */
  readonly modified: number;
  readonly title: string;
  readonly body: string;
} & (
  | {
      readonly readable: false;
      readonly done?: DoneWay;
      readonly doneAt?: number;
      /** Why no words are drawn: the file is over `ENTRY_MAX_BYTES`, or the board could not read it. */
      readonly unshown?: Unshown;
    }
  | {
      readonly readable: true;
      readonly kind: BoardKind;
      readonly at: number;
      readonly options?: readonly string[];
      readonly hint?: string;
      readonly done?: DoneWay;
      readonly doneAt?: number;
      readonly answer?: string;
    }
) & {
  /** A click that waits for the box: the entry drawn where it will be once the box moves it, done or, taken back, to do. */
  readonly pending?: true;
  /**
   * Kept by the platform after a move, either way: the whole key of the entry it was moved from — time and name — and, after it, that
   * entry's own `from`, the chain of keys the file had, the latest first, at most `BOARD_FROM`.
   */
  readonly from?: readonly BoardCursor[];
};

/** One part of a place's entries, newest first; `next` names the file a later part starts after, when there are more. */
export type BoardPart = {
  readonly place: BoardPlace;
  readonly entries: readonly BoardEntry[];
  readonly next?: string;
  /** The person's tabs, by name, as the box read them with the part. */
  readonly tabs?: readonly string[];
  /** The tabs that hold a page, who wrote each, and the name in each language a package gives its tab, as the box read them with the part. */
  readonly pages?: readonly { readonly tab: string; readonly by: BoardPageBy; readonly name?: BoardLabel }[];
};

/** A tab's name in each language, as a package gives it (`comchatx.board.name`): drawn for its tab in place of the folder's name. */
export type BoardLabel = { readonly zh: string; readonly en: string };
/** One language's name of a tab: 1 to 64 characters, not all blank, with no control character. */
export const BOARD_LABEL = /^(?!\s*$)[^\u0000-\u001f\u007f]{1,64}$/u;
/** A tab's name in both languages; nothing where either is missing or breaks `BOARD_LABEL`. */
export function readBoardLabel(value: unknown): BoardLabel | undefined {
  if (!record(value)) return undefined;
  const zh = value["zh"], en = value["en"];
  return typeof zh === "string" && typeof en === "string" && BOARD_LABEL.test(zh) && BOARD_LABEL.test(en) ? { zh, en } : undefined;
}

/** The meta tag the app's page at `/` names the second site in, where a board's page is drawn; absent, no page is drawn. */
export const PAGES_ORIGIN_META = "cmx-pages-origin";
/** A tab's page file, at the top of its directory: written there, it is cx's (`parts/cx-board.md` §1). */
export const PAGE_FILE = "page.html";
/**
 * The most of a viewer's page the board reads; a larger one is no viewer. The box's job hands it over in base64, kit and all, under the
 * 8 MiB its runner takes of a job's output, and the platform holds each one whole while it passes.
 */
export const VIEWER_MAX_BYTES = 5 * 1024 * 1024;
/** The most of each of the ready-made elements' two files the board reads; a larger one is no elements. */
export const KIT_MAX_BYTES = 256 * 1024;
/** An npm package's name as the account's list names it, a package that may declare a board of its own. */
export const PLUGIN_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]{0,213}$/;
/**
 * The most of a file a page hands the seller through `cxBoard.save`, or has drawn by `markdown` from a file opened; a larger one is
 * refused. The read itself is not bounded: it passes as it is read (`parts/cx-board.md` §2).
 */
export const BOARD_READ_MAX_BYTES = 5 * 1024 * 1024;
/**
 * The most a page writes in one file through `cxBoard.write`, as UTF-8: it crosses to the box in base64, under the million bytes the box's
 * relay takes in one request.
 */
export const BOARD_WRITE_MAX_BYTES = 512 * 1024;
/** The deepest a file a page reads or writes lies under its own tab. */
export const BOARD_FILE_DEPTH = 16;
const FILE_PART = /^(?!\.)[^/\\\u0000-\u001f\u007f]{1,255}$/u;
/**
 * A file's path in a page's own tab, as `cxBoard` names it: parts joined by `/`, none empty and none led by a dot (so no `..`), no
 * backslash or control character, at most `BOARD_FILE_DEPTH` deep and 1,024 characters long. It fixes no name or format.
 */
export const boardFilePath = (file: unknown): file is string =>
  typeof file === "string" && file.length <= 1024 && file.split("/").length <= BOARD_FILE_DEPTH && file.split("/").every((part) => FILE_PART.test(part));
/** One of a page's own tab's files, as `cxBoard.list` answers it: its path, when it was last written, and its size in bytes. */
export type BoardFileRow = { readonly file: string; readonly modified: number; readonly size: number };
/** A tab's files as the box answered them; nothing where their shape is not there. */
export function readBoardFiles(value: unknown): readonly BoardFileRow[] | undefined {
  if (!record(value) || !Array.isArray(value["files"])) return undefined;
  const rows: BoardFileRow[] = [];
  for (const one of value["files"] as unknown[]) {
    if (!record(one) || !boardFilePath(one["file"]) || typeof one["modified"] !== "number" || !Number.isFinite(one["modified"]) || typeof one["size"] !== "number" || !Number.isSafeInteger(one["size"]) || one["size"] < 0) return undefined;
    rows.push(Object.freeze({ file: one["file"], modified: one["modified"], size: one["size"] }));
  }
  return Object.freeze(rows);
}
/**
 * A file of the tenant tree as a press names it, opened on its own tab of the board (`parts/cx-board.md` §2): its path under the tree's
 * root, parts joined by `/`, none empty, `.` or `..` and none holding NUL, at most 4,096 characters. A dot-named part is a name like any
 * other: what cx may read, the tab may show.
 */
export const treeFilePath = (file: unknown): file is string =>
  typeof file === "string" && file.length <= 4096 && file.split("/").every((part) => part !== "" && part !== "." && part !== ".." && !part.includes("\0"));
/** The most open files one look at them names. */
export const OPENED_MAX = 16;
/** A kind of file, as a viewer declares the kinds it draws: an extension in lower case. */
export const FILE_KIND = /^[a-z0-9]{1,8}$/;
/** A file's kind, its name's extension in lower case; none where the name has none, or is only a dot-led name. */
export function fileKind(file: string): string | undefined {
  const name = file.slice(file.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  const kind = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  return FILE_KIND.test(kind) ? kind : undefined;
}
/** The kinds a file is drawn as its own page, on the second site (decision D217), whatever a package declares. */
export const PAGE_KINDS: readonly string[] = Object.freeze(["html", "htm"]);
/** What the log names a file's kind by: no package's name, and a kind it does not class is `plain`. */
const LOGGED: Readonly<Record<string, "markdown" | "table" | "picture" | "html">> = Object.freeze({ md: "markdown", markdown: "markdown", csv: "table", tsv: "table", png: "picture", jpg: "picture", jpeg: "picture", gif: "picture", webp: "picture", html: "html", htm: "html" });
export const loggedKind = (file: string): "markdown" | "table" | "picture" | "html" | "plain" => LOGGED[fileKind(file) ?? ""] ?? "plain";
/** An open file as a look at it answered: its size and the time it was written, or that it is no file there. */
export type OpenedFile = { readonly file: string; readonly size: number; readonly modified: number } | { readonly file: string; readonly missing: true };
/** Open files as the box answered them; nothing where their shape is not there. */
export function readOpenedFiles(value: unknown): readonly OpenedFile[] | undefined {
  if (!record(value) || !Array.isArray(value["files"]) || value["files"].length > OPENED_MAX) return undefined;
  const rows: OpenedFile[] = [];
  for (const one of value["files"] as unknown[]) {
    if (!record(one) || !treeFilePath(one["file"])) return undefined;
    if (one["missing"] === true) rows.push(Object.freeze({ file: one["file"], missing: true as const }));
    else if (typeof one["size"] === "number" && Number.isSafeInteger(one["size"]) && one["size"] >= 0 && typeof one["modified"] === "number" && Number.isFinite(one["modified"])) rows.push(Object.freeze({ file: one["file"], size: one["size"], modified: one["modified"] }));
    else return undefined;
  }
  return Object.freeze(rows);
}
/** Who wrote a tab's page, as the box read it: cx, by the page file in the tab's directory, or the package that declares the tab. */
export type BoardPageBy = "cx" | { readonly package: string };
/** A tab's page as the box answers it: its HTML, who wrote it, and the ready-made elements where the installed base carries them. */
export type BoardPage = { readonly html: string; readonly by: BoardPageBy; readonly kit?: { readonly css: string; readonly js: string } };
/**
 * Who made a page, as its caption names it: cx, a plugin of ours by its name without our scope, where the page holds no record of its
 * package to name it by, or any other plugin by its npm name.
 */
export type PageMaker = { readonly kind: "cx" } | { readonly kind: "ours"; readonly name: string; readonly package?: string } | { readonly kind: "third"; readonly name: string };
export const pageMaker = (by: BoardPageBy): PageMaker =>
  by === "cx" ? { kind: "cx" } : isOurs(by.package) ? { kind: "ours", name: by.package.startsWith(`${NPM_SCOPE}/`) ? by.package.slice(NPM_SCOPE.length + 1) : by.package, package: by.package } : { kind: "third", name: by.package };
const readPageBy = (value: unknown): BoardPageBy | undefined => (value === "cx" ? "cx" : record(value) && typeof value["package"] === "string" && PLUGIN_NAME.test(value["package"]) ? { package: value["package"] } : undefined);
/** A page as the box answered it; nothing where its shape is not there. */
/** A page's head as the box hands it on before the page's bytes: who made it, and the ready-made elements where the base is whole. */
export type BoardPageHead = Omit<BoardPage, "html">;
export function readPageHead(value: unknown): BoardPageHead | undefined {
  if (!record(value)) return undefined;
  const by = readPageBy(value["by"]);
  const kit = value["kit"];
  if (by === undefined || (kit !== undefined && (!record(kit) || typeof kit["css"] !== "string" || typeof kit["js"] !== "string"))) return undefined;
  return { by, ...(kit === undefined ? {} : { kit: { css: kit["css"] as string, js: kit["js"] as string } }) };
}
/**
 * A file's head line as the box hands a read on (`parts/cx-board.md` §2): its size, the time it was written, and the ready-made elements
 * where it is drawn as its own page.
 */
export type BoardFileHead = { readonly size: number; readonly modified: number; readonly kit?: { readonly css: string; readonly js: string } };
export function readFileHead(value: unknown): BoardFileHead | undefined {
  if (!record(value)) return undefined;
  const { size, modified, kit } = value;
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0 || typeof modified !== "number" || !Number.isFinite(modified)) return undefined;
  if (kit !== undefined && (!record(kit) || typeof kit["css"] !== "string" || typeof kit["js"] !== "string")) return undefined;
  return { size, modified, ...(kit === undefined ? {} : { kit: { css: kit["css"] as string, js: kit["js"] as string } }) };
}
export function readBoardPage(value: unknown): BoardPage | undefined {
  if (!record(value) || typeof value["html"] !== "string") return undefined;
  const head = readPageHead(value);
  return head === undefined ? undefined : { html: value["html"], ...head };
}
/** A page's maker as the platform answered it to the page. */
export function readPageMaker(value: unknown): PageMaker | undefined {
  if (!record(value)) return undefined;
  if (value["kind"] === "cx") return { kind: "cx" };
  return (value["kind"] === "ours" || value["kind"] === "third") && typeof value["name"] === "string" && value["name"] !== "" ? { kind: value["kind"], name: value["name"], ...(value["kind"] === "ours" && typeof value["package"] === "string" ? { package: value["package"] } : {}) } : undefined;
}

type Front = { readonly fields: ReadonlyMap<string, string>; readonly options: readonly string[] | undefined; readonly body: string; readonly lines: readonly string[] };

const FENCE = "---";

/** A value as front matter writes it: bare, or quoted with JSON's double quotes, or with single quotes doubled inside. */
function unquote(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
    try { const read: unknown = JSON.parse(value); if (typeof read === "string") return read; } catch { /* drawn as it stands */ }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
  return value;
}

/** The front matter of an entry's file: flat `key: value` lines, and `options:` followed by `- option` lines; none when the file opens otherwise. */
function front(text: string): Front | undefined {
  const all = text.replace(/^﻿/, "").split(/\r?\n/);
  if (all[0]?.trim() !== FENCE) return undefined;
  const end = all.findIndex((line, index) => index > 0 && line.trim() === FENCE);
  if (end < 0) return undefined;
  const lines = all.slice(1, end);
  const fields = new Map<string, string>();
  let options: string[] | undefined;
  let inOptions = false;
  for (const line of lines) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const item = /^\s+-\s?(.*)$/.exec(line) ?? (inOptions ? /^-\s?(.*)$/.exec(line) : null);
    if (item !== null && inOptions) { options!.push(unquote(item[1]!)); continue; }
    // A line is cut at a line feed alone: a line or paragraph separator, or a lone carriage return, inside a value is part of it.
    const pair = /^([A-Za-z][A-Za-z0-9_]*):(.*)$/s.exec(line);
    if (pair === null) return undefined;
    const [, key, rest] = pair;
    inOptions = key === "options" && rest!.trim() === "";
    if (inOptions) { options = []; continue; }
    if (fields.has(key!)) return undefined;
    fields.set(key!, unquote(rest!));
  }
  return { fields, options, body: all.slice(end + 1).join("\n").replace(/^\n+/, ""), lines };
}

const time = (value: string | undefined): number | undefined => {
  if (value === undefined || value === "") return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
};
const oneLine = (value: string): string => value.replace(/\s+/g, " ").trim();

/** A file's name as a title, for a file that gives none: without `.md`. */
export const nameTitle = (file: string): string => file.slice(file.lastIndexOf("/") + 1).replace(/\.md$/, "");

/**
 * A title and words from a file's text: the front matter's title, else its first heading at the top level as the page's renderer reads it,
 * which then leaves the words around it, else its name.
 */
function baseOf(file: string, text: string, given: string): { readonly title: string; readonly body: string } {
  if (given !== "") return { title: given, body: text };
  const heading = firstHeading(text);
  if (heading === undefined) return { title: nameTitle(file), body: text };
  const lines = text.split(/\r\n?|\n/);
  const before = lines.slice(0, heading.lines[0]).join("\n").replace(/\s+$/, "");
  const after = lines.slice(heading.lines[1]).join("\n").replace(/^\n+/, "");
  return { title: oneLine(heading.text), body: before === "" ? after : after === "" ? before : `${before}\n\n${after}` };
}

/** Why a card has no words of its file: over the board's size, or not read. */
export type Unshown = "large" | "unreadable";
export const UNSHOWN: readonly Unshown[] = ["large", "unreadable"];

/**
 * One file read as the board draws it: every one a card of the base, and its kind and the rest from its front matter where all of that is
 * there. `text` is undefined for a file the board could not read, or one over `ENTRY_MAX_BYTES`: its name is its title, with no words.
 */
export function readEntry(file: string, place: BoardPlace, text: string | undefined, modified: number, unshown?: Unshown): BoardEntry {
  if (text === undefined) return { file, place, modified, readable: false, title: nameTitle(file), body: "", ...(unshown === undefined ? {} : { unshown }) };
  const read = front(text);
  const done = read?.fields.get("done");
  const doneAt = time(read?.fields.get("doneAt"));
  const marks = { ...(place === "done" && DONE_WAYS.includes(done as DoneWay) ? { done: done as DoneWay } : {}), ...(place === "done" && doneAt !== undefined ? { doneAt } : {}) };
  const generic: BoardEntry = { file, place, modified, readable: false, ...baseOf(file, read?.body ?? text.replace(/^\uFEFF/, ""), oneLine(read?.fields.get("title") ?? "")), ...marks };
  if (read === undefined) return generic;
  const kind = read.fields.get("kind");
  const title = oneLine(read.fields.get("title") ?? "");
  const at = time(read.fields.get("at"));
  if (!BOARD_KINDS.includes(kind as BoardKind) || title === "" || at === undefined) return generic;
  const options = kind === "choice" ? (read.options ?? []).map(oneLine).filter((one) => one !== "").slice(0, MAX_OPTIONS) : undefined;
  if (kind === "choice" && options!.length === 0) return generic;
  const hint = kind === "input" ? oneLine(read.fields.get("hint") ?? "") : "";
  const answer = read.fields.get("answer");
  return {
    file, place, modified, readable: true, kind: kind as BoardKind, title, at, body: read.body,
    ...(options === undefined ? {} : { options }),
    ...(hint === "" ? {} : { hint }),
    ...marks,
    ...(place === "done" && answer !== undefined && answer !== "" ? { answer } : {}),
  };
}

/**
 * Where any board's card stands, read from its front matter by the one reader of these keys (`parts/board-page.md` §1): `done: read`,
 * `answered` or `dismissed` once the seller is done with it; else `asks: true` while it waits for an answer; else it waits to be read.
 */
export type CardState = DoneWay | "toAnswer" | "toRead";
/** What a card asks with options, as the chat says it: its questions' words, or the question a yes or a no answers. */
export type CardAsked = { readonly form: typeof OPTION_FORM; readonly questions: readonly { readonly words: string }[] } | { readonly form: typeof CONFIRM_FORM; readonly title: string };
/** The seller's answer a card keeps, in the platform's own form. */
export type CardAnswered = { readonly answers: readonly OptionAnswer[] } | { readonly confirmed: boolean };
/**
 * A card as the chat names it: its title, where it stands, and the facts any card's front matter may hold, whatever wrote it: `level`, 1 to
 * 3, where it is given; `questions`, the platform's option or confirm form, where it reads whole; and `answers`, where it is in the shape of
 * that form.
 */
export type CardRow = { readonly title: string; readonly state: CardState; readonly level?: 1 | 2 | 3; readonly asked?: CardAsked; readonly answered?: CardAnswered; readonly answer?: string };
const LEVELS = new Map([["1", 1], ["2", 2], ["3", 3]] as const);
const json = (value: string | undefined): unknown => { try { return value === undefined ? undefined : JSON.parse(value) as unknown; } catch { return undefined; } };
const wordy = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
/** A card's `questions` read as the Inbox reads them: a form with each question and option whole, or none, the card then one without options. */
function readAsked(value: string | undefined): CardAsked | undefined {
  const form = json(value) as { form?: unknown; title?: unknown; questions?: unknown } | undefined;
  if (form?.form === CONFIRM_FORM) return wordy(form.title) ? { form: CONFIRM_FORM, title: form.title } : undefined;
  if (form?.form !== OPTION_FORM || !Array.isArray(form.questions) || form.questions.length === 0) return undefined;
  const whole = form.questions.every((one: { words?: unknown; options?: unknown } | null) => typeof one?.words === "string" && Array.isArray(one.options) && one.options.length > 0 && one.options.every((option: { name?: unknown } | null) => typeof option?.name === "string"));
  return whole ? { form: OPTION_FORM, questions: form.questions.map((one: { words: string }) => ({ words: one.words })) } : undefined;
}
function readAnswered(value: string | undefined, asked: CardAsked | undefined): CardAnswered | undefined {
  if (asked === undefined || value === undefined) return undefined;
  if (asked.form === CONFIRM_FORM) { const confirmed = readConfirmedValue(value); return confirmed === undefined ? undefined : { confirmed }; }
  const answers = readAnswersValue(value);
  return answers !== undefined && answers.length === asked.questions.length ? { answers } : undefined;
}
export function readCard(file: string, text: string): CardRow {
  const read = front(text);
  const done = read?.fields.get("done");
  const asked = readAsked(read?.fields.get("questions"));
  const state: CardState = DONE_WAYS.includes(done as DoneWay) ? done as DoneWay : read?.fields.get("asks") === "true" || asked !== undefined ? "toAnswer" : "toRead";
  const level = LEVELS.get(read?.fields.get("level")?.trim() as "1");
  const answered = readAnswered(read?.fields.get("answers"), asked);
  const answer = answered === undefined ? undefined : read?.fields.get("answer");
  return {
    title: baseOf(file, read?.body ?? text.replace(/^\uFEFF/, ""), oneLine(read?.fields.get("title") ?? "")).title, state,
    ...(level === undefined ? {} : { level }), ...(asked === undefined ? {} : { asked }), ...(answered === undefined ? {} : { answered }), ...(answer === undefined ? {} : { answer }),
  };
}

/** What the board writes into a file it moves to `done/`: how and when it was done, and the answer when one went. */
export type DoneMark = { readonly done: DoneWay; readonly doneAt: number; readonly answer?: string };

/** The front matter's lines that say how and when a file was done, as the box's move writes them and `markDone` does. */
export const doneLines = (mark: DoneMark): readonly string[] =>
  [`done: ${mark.done}`, `doneAt: ${new Date(mark.doneAt).toISOString()}`, ...(mark.answer === undefined ? [] : [`answer: ${JSON.stringify(mark.answer)}`])];

/** Where a later part starts: the last entry's time and name, so a part goes on after it even once that file has moved. */
export type BoardCursor = { readonly modified: number; readonly name: string };
/** An entry's time as a file's is read: milliseconds, never below zero, and one the cursor can write. */
export const entryTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1e16;
/**
 * A key's time read from its text: the text `String` writes for the time the box reported, the one reader the cursor and a board message
 * use, so every time the box can report comes back the same number; nothing for any other text.
 */
export function readEntryTime(text: string): number | undefined {
  const time = Number(text);
  return entryTime(time) && String(time) === text ? time : undefined;
}
export const writeCursor = (cursor: BoardCursor): string => `${String(cursor.modified)}/${cursor.name}`;
/**
 * The one rule a part goes on by: the rows whose key comes after the cursor's in the place's order — `done/` by time, the latest first, then
 * by name; `todo/` by name — found by comparing keys, never by finding the cursor's own row, which may have moved or be hidden.
 */
export const afterCursor = (key: BoardCursor, cursor: BoardCursor | undefined, byTime: boolean): boolean =>
  cursor === undefined || (byTime ? key.modified < cursor.modified || (key.modified === cursor.modified && key.name < cursor.name) : nameBefore(key.name, cursor.name));
/** An entry's key: its time and its name, as the box read its file. */
export const entryCursor = (entry: BoardEntry): BoardCursor => ({ modified: entry.modified, name: entry.file });
/** The keys a row's `from` holds at most: the moves a file is followed through. */
export const BOARD_FROM = 8;
/** Two keys are one when both their times and their names are, whole. */
export const sameKey = (one: BoardCursor, other: BoardCursor): boolean => one.modified === other.modified && one.name === other.name;
/** Whether a row was made, by a move or a chain of them, from the entry a key names. */
export const madeFrom = (row: BoardEntry, key: BoardCursor): boolean => row.from?.some((one) => sameKey(one, key)) === true;
/** The `from` a move's row carries: the whole key of the entry it moved, then that entry's own chain. */
export const fromOf = (entry: BoardEntry): readonly BoardCursor[] => [entryCursor(entry), ...(entry.from ?? [])].slice(0, BOARD_FROM);
/**
 * The key a click names, as the rows held know it: its own where a row has it; else, along the `from` chain, the key of the row a move or
 * a chain of moves made from the entry it names, matched whole; else none, a key no row reaches.
 */
export function heldKey(rows: readonly BoardEntry[], click: BoardCursor): BoardCursor | undefined {
  const seen = new Set<string>();
  for (let key = click; ;) {
    if (rows.some((row) => sameKey(entryCursor(row), key))) return key;
    const next = seen.has(writeCursor(key)) ? undefined : rows.find((row) => madeFrom(row, key));
    if (next === undefined) return undefined;
    seen.add(writeCursor(key));
    key = entryCursor(next);
  }
}
/** The order of `done`, by the one rule: the latest first, then by name. */
export const doneOrder = (a: BoardEntry, b: BoardEntry): number => (afterCursor(entryCursor(a), entryCursor(b), true) ? 1 : afterCursor(entryCursor(b), entryCursor(a), true) ? -1 : 0);
export function readCursor(value: string): BoardCursor | undefined {
  const slash = value.indexOf("/");
  const modified = slash < 0 ? undefined : readEntryTime(value.slice(0, slash));
  const name = value.slice(slash + 1);
  return modified === undefined || !partFile(name) ? undefined : { modified, name };
}

/**
 * The file's text with how and when it was done in its front matter, every line cx wrote kept as it was: a mark already there is
 * replaced, and a file with no front matter is given one holding the mark alone.
 */
export function markDone(text: string, mark: DoneMark): string {
  const added = doneLines(mark);
  const read = front(text);
  if (read === undefined) return `${FENCE}\n${added.join("\n")}\n${FENCE}\n${text}`;
  const kept = read.lines.filter((line) => !/^(done|doneAt|answer):/.test(line));
  const all = text.replace(/^﻿/, "").split(/\r?\n/);
  const end = all.findIndex((line, index) => index > 0 && line.trim() === FENCE);
  return [FENCE, ...kept, ...added, ...all.slice(end)].join("\n");
}

/** The file's text as cx wrote it, its marks taken out: an entry a take-back puts back among what waits. */
export function unmarkDone(text: string): string {
  const read = front(text);
  if (read === undefined) return text;
  const kept = read.lines.filter((line) => !/^(done|doneAt|answer):/.test(line));
  const all = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const end = all.findIndex((line, index) => index > 0 && line.trim() === FENCE);
  return [FENCE, ...kept, ...all.slice(end)].join("\n");
}

/** A click still waiting for the box, as the account's row keeps it: a change to a package names its source; a model pick names none. */
type Waiting = { readonly op: string; readonly source?: string };

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether the page draws the board: while the account's package list holds cx-board, switched on. The list the box last answered says
 * whether its tenant list names the package, and the clicks still waiting, in order, are what the box runs next: an install or a switch
 * on brings it, a remove or a switch off takes it away. Unlike History's titles, nothing known is no board: an account without the
 * package sees the chat as it was.
 */
export const boardShown = (list: { readonly packages: readonly unknown[] } | undefined, waiting: readonly Waiting[]): boolean => held(list, waiting, BOARD_PACKAGE, BOARD_SOURCE);

/** Whether the module draws on the base: read as `boardShown` reads the base, for the module's own package. */
export const tasksShown = (list: { readonly packages: readonly unknown[] } | undefined, waiting: readonly Waiting[]): boolean => held(list, waiting, TASKS_PACKAGE, TASKS_SOURCE);

/**
 * The npm names of the packages from npm the account's list holds, by the name their installed copy gives, read as `boardShown` reads the
 * base: each may declare a board of its own, which the box reads from that copy.
 */
export function boardPlugins(list: { readonly packages: readonly unknown[] } | undefined, waiting: readonly Waiting[]): readonly string[] {
  const names = (list?.packages ?? []).flatMap((one) => {
    const name = record(one) && one["origin"] === "seller" && typeof one["source"] === "string" && one["source"].startsWith("npm:") && typeof one["name"] === "string" ? one["name"] : undefined;
    return name !== undefined && PLUGIN_NAME.test(name) && held(list, waiting, name, (one as Record<string, unknown>)["source"] as string) ? [name] : [];
  });
  return [...new Set(names)].sort();
}

function held(list: { readonly packages: readonly unknown[] } | undefined, waiting: readonly Waiting[], name: string, named: string): boolean {
  const row = list?.packages.find((one): one is Record<string, unknown> => record(one) && one["origin"] === "seller" && (one["source"] === named || one["name"] === name));
  const source = typeof row?.["source"] === "string" ? row["source"] : named;
  let shown = row !== undefined && row["state"] !== "off";
  for (const entry of waiting) if (entry.source === source && entry.op !== "model" && entry.op !== "update") shown = entry.op === "install" || entry.op === "on";
  return shown;
}

const readKey = (value: unknown): BoardCursor | undefined =>
  record(value) && typeof value["modified"] === "number" && Number.isFinite(value["modified"]) && typeof value["name"] === "string" && ENTRY_FILE.test(value["name"]) ? { modified: value["modified"], name: value["name"] } : undefined;

const readOne = (value: unknown, place: BoardPlace): BoardEntry | undefined => {
  if (!record(value)) return undefined;
  const { file, modified, readable, kind, title, at, body, options, hint, done, doneAt, answer } = value;
  if (value["place"] !== place || typeof file !== "string" || !partFile(file) || typeof modified !== "number" || !Number.isFinite(modified)) return undefined;
  const from = Array.isArray(value["from"]) && value["from"].length > 0 && value["from"].length <= BOARD_FROM ? value["from"].map(readKey) : undefined;
  const pending = { ...(value["pending"] === true ? { pending: true as const } : {}), ...(from === undefined || from.includes(undefined) ? {} : { from: from as BoardCursor[] }) };
  // A way of being done the board no longer writes — a question kept as timed out — is read as none: the row stays, unmarked.
  if ((done !== undefined && done !== "timed_out" && !DONE_WAYS.includes(done as DoneWay)) || (doneAt !== undefined && typeof doneAt !== "number")) return undefined;
  const marks = { ...(DONE_WAYS.includes(done as DoneWay) ? { done: done as DoneWay } : {}), ...(doneAt === undefined ? {} : { doneAt }) };
  // A row a box kept before the base drew titles and words has neither: its name stands for its title.
  const base = { title: typeof title === "string" && title !== "" ? title : nameTitle(file), body: typeof body === "string" ? body : "" };
  const unshown = UNSHOWN.includes(value["unshown"] as Unshown) ? { unshown: value["unshown"] as Unshown } : {};
  if (readable === false) return { file, place, modified, readable, ...base, ...marks, ...unshown, ...pending };
  if (readable !== true || !BOARD_KINDS.includes(kind as BoardKind) || typeof title !== "string" || typeof at !== "number" || typeof body !== "string") return undefined;
  if (options !== undefined && (!Array.isArray(options) || !options.every((one): one is string => typeof one === "string"))) return undefined;
  if ((hint !== undefined && typeof hint !== "string") || (answer !== undefined && typeof answer !== "string")) return undefined;
  return {
    file, place, modified, readable, kind: kind as BoardKind, title, at, body,
    ...(options === undefined ? {} : { options: options.slice(0, MAX_OPTIONS) }),
    ...(hint === undefined ? {} : { hint }),
    ...marks,
    ...(answer === undefined ? {} : { answer }),
    ...pending,
  };
};

/** A part as the box answered it or the platform served it, each entry read again and one that breaks the shape left out; nothing when the part's own shape is not there. */
export function readBoardPart(value: unknown): BoardPart | undefined {
  if (!record(value) || !BOARD_PLACES.includes(value["place"] as BoardPlace) || !Array.isArray(value["entries"])) return undefined;
  const place = value["place"] as BoardPlace;
  const next = value["next"];
  if (next !== undefined && (typeof next !== "string" || readCursor(next) === undefined)) return undefined;
  const tabs = value["tabs"];
  const named = Array.isArray(tabs) ? tabs.filter((one): one is string => typeof one === "string" && BOARD_TAB.test(one)) : undefined;
  const pages = Array.isArray(value["pages"]) ? value["pages"].flatMap((one) => {
    const by = record(one) && typeof one["tab"] === "string" && BOARD_TAB.test(one["tab"]) ? readPageBy(one["by"]) : undefined;
    const name = by === undefined ? undefined : readBoardLabel((one as Record<string, unknown>)["name"]);
    return by === undefined ? [] : [{ tab: (one as Record<string, unknown>)["tab"] as string, by, ...(name === undefined ? {} : { name }) }];
  }) : undefined;
  return {
    place, entries: value["entries"].flatMap((one) => readOne(one, place) ?? []), ...(next === undefined ? {} : { next }), ...(named === undefined ? {} : { tabs: [...new Set(named)].sort() }),
    ...(pages === undefined ? {} : { pages: pages.filter((one, at) => pages.findIndex((other) => other.tab === one.tab) === at) }),
  };
}
