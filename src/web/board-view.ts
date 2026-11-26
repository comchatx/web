import { BOARD_MAX_FILES, BOARD_PART, fileKind, PAGE_KINDS, TASKS_TAB, type BoardEntry, type BoardLabel, type PageMaker } from "../shared/board.js";
import { BoardRefused, type Backend, type BoardPageRead, type OpenedFrom, type OpenRead } from "./backend.js";
import { fileBox, fileKey, fileName, isFileKey, kindMark, OpenFiles } from "./board-files.js";
import { sizeOf } from "./quote-box.js";
import type { DraftStorage } from "./board-drafts.js";
import { iconName, PageCounts } from "./board-counts.js";
import { fall } from "./board-fall.js";
import { SeenBoards } from "./board-seen.js";
import { BoardFrame, type FramePorts } from "./board-frame.js";
import { BoardOff, type Off, type OffPorts, type Under } from "./board-off.js";
import { baseCards, EMPTY_BOARD, entryKey, withRead, type BoardModel } from "./board-model.js";
import { h, keep, svg } from "./dom.js";
import { renderMarkdown } from "./markdown.js";
import type { StringKey } from "./strings.js";
import { bar, type Twelfths } from "./waiting.js";

/** The parts of a tab read in one go at most: the whole of it is read, so a file that lands in it is seen. */
const TODO_PARTS = Math.ceil(BOARD_MAX_FILES / BOARD_PART);
/**
 * The bars of a file while it opens, as the sheet draws them at 1280 px: two groups of lines of different lengths, in twelfths of the
 * pane, since the app draws no width from an element's own style; 0 is the blank line between the groups.
 */
const FILE_WAIT: readonly (Twelfths | 0)[] = [6, 12, 11, 0, 4, 12, 10, 12, 5];

export type BoardPorts = {
  readonly backend: Pick<Backend, "board"> & Partial<Pick<Backend, "boardTab" | "boardOpen" | "boardViewer" | "boardOpened">>;
  readonly say: (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;
  readonly now: () => number;
  /** A time as a row's time says it: the clock alone today, the day before it on any other. */
  readonly time: (time: number) => string;
  /** The clock alone, for a row under the day it was done. */
  readonly clock: (time: number) => string;
  /** A day as the sidebar names it. */
  readonly day: (time: number) => string;
  /** Whether the board is shown, or its count moved: the app draws the frame again. */
  readonly changed: () => void;
  /** Where the board keeps what it holds in the browser, one key each, for the account signed in: the pages' numbers, the files open, the cards seen. */
  readonly store?: DraftStorage;
  readonly account?: () => string | undefined;
  /** Where a tab's page is drawn and read, where the platform names the second site; without it a tab that holds a page is drawn as its cards. */
  readonly frame?: Omit<FramePorts, "say">;
  /** The seller showed a tab by their own press, on the strip. */
  readonly chose?: (tab: string) => void;
  /** A press on the board shown, or a key in it: the seller took what it shows. */
  readonly pressed?: (tab: string) => void;
  /** Whether the board is in sight, the column open: the board shown is then seen, and its dot goes. */
  readonly inSight?: () => boolean;
  /** A file cx named on a card pressed: the app shows it on its own tab and says so. Absent, a path on a card is its words. */
  readonly openFile?: (path: string, from: OpenedFrom) => void;
  /** Where cx's computer stands, while it is not on to be read, and what the board's place offers then (`BoardOff`). */
  readonly computer?: Omit<OffPorts, "say"> & { readonly off: () => Off | undefined };
};

const crossIcon = (): SVGElement => svg("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "aria-hidden": "true", class: "icon" }, svg("path", { d: "M7 7l10 10M17 7L7 17" }));
const plusIcon = (): SVGElement => svg("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "aria-hidden": "true" }, svg("path", { d: "M12 5v14M5 12h14" }));
/** A name for a board as the seller types it: one space for every run of them, none at either end. */
const plainName = (typed: string): string => typed.replace(/\s+/g, " ").trim();
/** A tab of the strip: its press, the field its name is changed in, the mark that asks to delete it, and the dot of something unseen. */
/** Whether the seller's system asks for less transparency: then the board's place while the computer is off has no glass. */
const clearView = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-transparency: reduce)").matches;

type TabParts = { readonly wrap: HTMLElement; readonly button: HTMLButtonElement; readonly field: HTMLInputElement; readonly close: HTMLButtonElement; readonly dot: HTMLElement };
type FileTabParts = { readonly wrap: HTMLElement; readonly button: HTMLButtonElement; readonly close: HTMLButtonElement; readonly dot: HTMLElement };
/**
 * An open file as last read: opening, drawn by a page (a viewer, or the file itself where it is HTML), the platform's plain row, too large,
 * gone, cx's computer off, or not read; `stale` where it changed since, to be read when its tab is next shown.
 */
type FileRead = {
  readonly from: OpenedFrom;
  readonly state: "opening" | "page" | "plain" | "large" | "gone" | "off" | "unreadable";
  readonly size?: number;
  readonly modified?: number;
  readonly page?: BoardPageRead;
  readonly stale?: true;
};
/** A read that drew no file, as the platform said why. */
const notShown = (from: OpenedFrom, open: OpenRead): FileRead =>
  open.kind === "large" ? { from, state: "large", size: open.size, modified: open.modified } : { from, state: open.kind === "gone" ? "gone" : open.kind === "off" ? "off" : "unreadable" };

/** A card, drawn once per file: `update` takes the row again under the same key, its time, title and words set in place. */
type Card = HTMLElement & { update?: (data: unknown) => void };

const titleOf = (entry: BoardEntry): string => entry.title;
/**
 * The board's one id builder: its kind, then a key with every character outside `[A-Za-z0-9-]` written as `_` and four hex digits, `_`
 * itself first among them, so two keys are never one id, and every `id` and each reference to one is made here.
 */
const idOf = (kind: "u" | "tab" | "file", key: string): string =>
  `board-${kind}-${key.replace(/[^A-Za-z0-9-]/g, (char) => `_${char.charCodeAt(0).toString(16).padStart(4, "0")}`)}`;

/**
 * The board, the column's one page (`parts/cx-board.md`): a strip of tabs, one per directory of the board, each drawn as its files' cards
 * or as the page its folder holds, and the files cx named open on tabs of their own. Each card is kept from draw to draw, so the focus
 * stays on it.
 */
/** How long a spoken line stands, as the app's (`app.ts`). */
const HEARD_MS = 1500;

export class BoardView {
  #model: BoardModel = EMPTY_BOARD;
  #reading: Promise<void> | undefined;
  #again = false;
  /** The tab the seller chose, while the board holds it; none chosen, 待办, else the first. */
  #tab: string | undefined;
  /** The base's strip: one tab per directory of the board, by name. */
  readonly #strip = h("div", { class: "board-tabs", role: "tablist" });
  readonly #stripButtons = new Map<string, HTMLButtonElement>();
  readonly #tabParts = new Map<string, TabParts>();
  /** The plus, after the strip: a board of the base's own made at once. */
  readonly #add: HTMLButtonElement;
  /** What the name field says of a name it cannot take, under the field. */
  readonly #note = h("p", { class: "cx-tip tab-note", id: "board-rename-note", role: "status", hidden: true });
  /** The board whose name is a field, and the board a press is making, renaming or deleting on the box. */
  #renaming: string | undefined;
  #changing = false;
  /** The question before a delete, while it is asked. */
  #asking: { readonly shut: () => void } | undefined;
  /** Whether the last read was the box's own, not what was kept while it sleeps: a board is made, renamed or deleted only then. */
  #live = false;
  /** The newest card the seller saw on each board of the base's own, for the dot. */
  readonly #seen: SeenBoards;
  /** The boards a page's ask marked, the door having kept it waiting or refused it. */
  readonly #doorMarked = new Set<string>();
  readonly #title = h("h2", { class: "board-title unseen", id: "board-title" });
  readonly head: HTMLElement;
  readonly #lookList = h("div", { class: "board-list board-cols" });
  readonly #lookSection = h("section", { class: "board-section" }, this.#lookList);
  readonly #emptyLine = h("p", { class: "board-empty" });
  readonly #pendingPane = h("div", { class: "board-pane", id: "board-pending", role: "tabpanel" }, this.#lookSection, this.#emptyLine);
  /**
   * The place for the computer's state, or none. As the computer goes off under a seller in the board, the keyboard goes to the place,
   * never to the press that starts it; as it comes on, from the place to the tab shown.
   */
  #drawOff(off: Off | undefined, held: boolean, under: Under | undefined): void {
    if (this.#off === undefined) return;
    const was = this.#off.off;
    const glassed = this.#body.classList.contains("under-glass") || this.#off.element.classList.contains("glass");
    const placed = document.activeElement !== null && this.#off.element.contains(document.activeElement);
    this.#off.draw(off, under);
    // What lies under the glass is drawn and out of reach: no press, no key, nothing a screen reader reads.
    const last = under === "last";
    this.#body.classList.toggle("under-glass", last);
    this.#body.classList.toggle("starting", last && off === "starting");
    for (const pane of this.#body.children) {
      if (pane === this.#off.element || !(pane instanceof HTMLElement)) continue;
      pane.inert = last;
      if (last) pane.setAttribute("aria-hidden", "true"); else pane.removeAttribute("aria-hidden");
    }
    this.#off.element.style.top = last ? `${this.#body.scrollTop}px` : "";
    // The glass clears over the board as it comes, once; under reduced motion it is clear at once.
    if (was !== undefined && off === undefined && glassed) this.#body.classList.add("unglass");
    if (off !== undefined) this.#body.classList.remove("unglass");
    if (was === undefined && off !== undefined && held) this.#off.focus();
    if (was !== undefined && off === undefined && placed) this.#shownButton()?.focus({ preventScroll: true });
    // The computer that came on is said once, in place of the start's sentence the place said.
    if (was === "starting" && off === undefined) this.#tell(this.ports.say("cx.computer.on"));
  }

  /** A tab's page in a frame, where the platform names the second site. */
  readonly #frame: BoardFrame | undefined;
  /** The tabs that hold a page, as the last read said, and who made each. */
  #pages: ReadonlyMap<string, PageMaker> = new Map();
  /** The names packages give their tabs, by folder. */
  #names: ReadonlyMap<string, BoardLabel> = new Map();
  /** The numbers the pages gave the board's icon, by tab, kept in the browser for the account. */
  readonly #counts: PageCounts;
  /** The files open as tabs, kept in the browser for the account, and the one shown in its folder's stead. */
  readonly #openFiles: OpenFiles;
  #file: string | undefined;
  /** Each open file as last read this visit, and the newest read asked for each. */
  readonly #fileReads = new Map<string, FileRead>();
  readonly #fileTurns = new Map<string, number>();
  /** The files that changed while another tab was shown: each tab carries the dot until it is shown. */
  readonly #fileFresh = new Set<string>();
  readonly #fileTabs = new Map<string, FileTabParts>();
  /** A file's tab: one row of its facts on the wash, then the file, drawn by a page in the frame or here. */
  readonly #fileHead = h("div", { class: "file-head", hidden: true });
  readonly #filePane = h("div", { class: "board-pane file-pane", id: "board-file", role: "tabpanel", hidden: true });
  readonly #body = h("div", { class: "board-body" }, this.#pendingPane, this.#fileHead, this.#filePane);
  /** The board's place while cx's computer is off, in every tab's stead. */
  readonly #off: BoardOff | undefined;
  readonly #announce = h("span", { class: "unseen", role: "status" });
  readonly page: HTMLElement;
  /** Each card, by its tab and its file's key (`entryKey`), so two versions of one name are two cards, and each tab's its own. */
  readonly #cards = new Map<string, Card>();

  constructor(readonly ports: BoardPorts, readonly language: () => "en" | "zh") {
    this.#counts = new PageCounts(ports.store, () => ports.account?.());
    this.#seen = new SeenBoards(ports.store, () => ports.account?.());
    this.#add = h("button", { type: "button", class: "page-icon board-add", hidden: true, onclick: () => { void this.#make(); } }, plusIcon()) as HTMLButtonElement;
    const asks = ports.frame?.asks;
    // A page's number is the board's to keep and draw; every other ask is the app's.
    this.#openFiles = new OpenFiles(ports.store, () => ports.account?.());
    const pages = ports.frame;
    // A file's tab is drawn by the page its read gave, kept here; any other tab's page is read by the frame.
    this.#frame = pages === undefined ? undefined : new BoardFrame({ ...pages, read: (tab) => (isFileKey(tab) ? this.#filePage(tab) : pages.read(tab)), say: ports.say, name: (tab) => (isFileKey(tab) ? fileName(tab.slice(1)) : this.label(tab)), ...(asks === undefined ? {} : { asks: { ...asks, count: (tab, n, words) => { if (this.#framed().has(tab) && this.#counts.set(tab, n, words)) { this.draw(); this.ports.changed(); } } } }) });
    if (this.#frame !== undefined) this.#body.append(this.#frame.element);
    this.#off = ports.computer === undefined ? undefined : new BoardOff({ ...ports.computer, say: ports.say });
    if (this.#off !== undefined) this.#body.append(this.#off.element);
    this.#body.addEventListener("animationend", (event) => { if (event.animationName === "off-unglass") this.#body.classList.remove("unglass"); });
    // The strip's tabs, as the views are: the arrows go to the one before or after, Home to the first, End to the last.
    this.#strip.addEventListener("keydown", (event) => {
      if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "tab") return;
      // A file's tab closes at Delete with no question: the file stays on the computer.
      const file = this.#shownFile();
      if (event.key === "Delete" && file !== undefined) { event.preventDefault(); this.#closeFile(file); return; }
      // On a board of the base's own: Delete asks to delete it; F2, as a spreadsheet's sheets have it, or Enter, as a file's name, changes its name.
      if (event.key === "Delete" && file === undefined && this.#own(this.tab) && this.#off?.off === undefined) { event.preventDefault(); this.#askDelete(this.tab); return; }
      if ((event.key === "F2" || event.key === "Enter") && !event.repeat && file === undefined && this.#own(this.tab) && this.#off?.off === undefined) { event.preventDefault(); this.#startRename(this.tab); return; }
      const names = this.#stripOrder();
      const at = names.indexOf(this.#shownKey());
      const to = ({ ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: names.length - 1 } as Readonly<Record<string, number>>)[event.key];
      if (to === undefined || names.length === 0) return;
      event.preventDefault();
      const name = names[(to + names.length) % names.length]!;
      if (isFileKey(name)) this.#showFile(name.slice(1)); else this.#setTab(name);
      this.#shownButton()?.focus();
    });
    this.head = h("div", { class: "board-head" }, this.#title, h("div", { class: "board-strip" }, this.#strip, this.#add), this.#note);
    this.page = h("div", { class: "board-page" }, this.#body, this.#announce);
    // A press on the board shown, or a key in it but Escape and Tab: the seller took what it shows.
    this.page.addEventListener("pointerdown", () => this.ports.pressed?.(this.tab), true);
    this.page.addEventListener("keydown", (event) => { if (event.key !== "Escape" && event.key !== "Tab") this.ports.pressed?.(this.tab); }, true);
    // The cards fall again as the board's width or a card's height changes.
    if (typeof ResizeObserver === "function") new ResizeObserver(() => this.#fall()).observe(this.#body);
    // A row of tabs cut by the board's width fades where tabs lie past its edge, and keeps the chosen one in sight as the board narrows.
    this.#strip.addEventListener("scroll", () => this.#cut(), { passive: true });
    // Narrowed, the strip brings the chosen tab back into sight; any other change of its width keeps where the seller scrolled it.
    if (typeof ResizeObserver === "function") new ResizeObserver(() => {
      const width = this.#strip.clientWidth;
      if (width < this.#stripWidth) this.#chosenInSight(); else this.#cut();
      this.#stripWidth = width;
    }).observe(this.#strip);
    // The keyboard reaching the chosen tab finds it clear of the fade, its ring in sight: after the browser's own scroll to the focus.
    this.#strip.addEventListener("focusin", () => queueMicrotask(() => this.#chosenInSight()));
  }

  get model(): BoardModel { return this.#model; }

  /**
   * The tab the strip last brought into sight, and whether its name was a field then, so a draw that keeps both leaves where the seller
   * scrolled the strip; a name field closing redraws the tab at its own width, which is brought into sight again.
   */
  #inSight: string | undefined;
  #stripWidth = 0;
  #sight(): string { return `${this.#shownKey()}\n${this.#renaming === this.tab ? "editing" : ""}`; }
  /** The strip fades at an edge where tabs lie past it (`cut-start`, `cut-end`). */
  #cut(): void {
    const strip = this.#strip;
    const room = strip.getBoundingClientRect();
    const first = strip.firstElementChild?.getBoundingClientRect(), last = strip.lastElementChild?.getBoundingClientRect();
    strip.classList.toggle("cut-start", first !== undefined && first.left < room.left - 0.5);
    strip.classList.toggle("cut-end", last !== undefined && last.right > room.right + 0.5);
  }
  /** The chosen tab scrolled into the strip's sight, clear of the fade where it fits, and the strip alone scrolled. */
  #chosenInSight(): void {
    const file = this.#shownFile();
    const wrap = file === undefined ? this.#tabParts.get(this.tab)?.wrap : this.#fileTabs.get(file)?.wrap;
    const strip = this.#strip;
    if (wrap !== undefined && wrap.isConnected && !strip.hidden) {
      const room = strip.getBoundingClientRect();
      const at = wrap.getBoundingClientRect();
      const said = getComputedStyle(strip).getPropertyValue("--space-7").trim();
      const fade = (parseFloat(said) || 0) * (said.endsWith("rem") ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16 : 1);
      // In the row's own reckoning: clear of the fade at an end the row is scrolled from, and its start first, so a tab wider than the
      // row less its fades shows where its name begins.
      const most = strip.scrollWidth - strip.clientWidth;
      const start = at.left - room.left + strip.scrollLeft, end = at.right - room.left + strip.scrollLeft;
      let to = strip.scrollLeft;
      if (end - to > strip.clientWidth - fade) to = Math.min(most, end - strip.clientWidth + fade);
      if (start - to < fade) to = Math.max(0, start - fade);
      strip.scrollLeft = to;
      this.#inSight = this.#sight();
    }
    this.#cut();
  }
  /** Whether the account's packages show the board, as the last read said; unknown before one answered. */
  get shown(): boolean | undefined { return this.#model.shown; }
  /** The count beside the board's icon: the sum of the numbers pages gave (`parts/board-page.md` §1); the base counts nothing (round 9). */
  get count(): number {
    if (this.#model.shown !== true) return 0;
    return this.#counts.all([...this.#framed().keys()]).reduce((sum, one) => sum + one.n, 0);
  }

  /**
   * The board's icon's name for its count: the pages' words for their numbers; with no number, 「看板，有新内容」 where a board of the
   * base's own holds something unseen.
   */
  get countName(): string {
    const pages = this.#model.shown === true ? this.#counts.all(this.#model.tabs.filter((tab) => this.#framed().has(tab))) : [];
    if (this.count === 0 && this.fresh) return this.ports.say("frame.boardNew");
    return iconName(0, pages, this.ports.say, this.language() === "zh" ? "，" : ", ");
  }

  /**
   * Whether a board of the base's own holds something the seller has not seen, or a page's ask the door kept waiting or refused marks its
   * board: the icon's dot, while it carries no number.
   */
  get fresh(): boolean { return this.#model.shown === true && (this.#fileFresh.size > 0 || this.#model.tabs.some((tab) => this.#fresh(tab) || this.#doorMarked.has(tab))); }

  /**
   * A page asked for its board and the door kept it waiting or refused it (round 9, "The door, and what bounds it"): its tab carries the
   * dot, and the icon its number or the dot, until the seller opens that board.
   */
  doorMarked(tab: string): void {
    if (this.#doorMarked.has(tab) || !this.#model.tabs.includes(tab)) return;
    this.#doorMarked.add(tab);
    this.draw();
    this.ports.changed();
  }

  /** A board of the base's own, not drawn as a page, whose newest card is newer than the seller saw. */
  #fresh(tab: string): boolean {
    if (this.#framed().has(tab)) return false;
    return this.#seen.fresh(tab, this.#newest(tab));
  }

  /** A board's cards as the base draws them. */
  #entriesOf(tab: string): readonly BoardEntry[] { return tab === TASKS_TAB ? this.#model.todo : this.#model.others.get(tab) ?? []; }
  #newest(tab: string): number { return this.#entriesOf(tab).reduce((most, one) => Math.max(most, one.modified), 0); }

  /** A board of the base's own the seller may make, rename and delete: on a box that answered itself, not one a package's page is drawn on. */
  #own(tab: string): boolean {
    if (this.ports.backend.boardTab === undefined || !this.#live || this.#model.shown !== true) return false;
    const by = this.#pages.get(tab);
    return by === undefined || by.kind === "cx";
  }

  /** The tabs drawn as their page, and who made each: those that hold one, where the second site is named. */
  #framed(): ReadonlyMap<string, PageMaker> {
    if (this.#frame === undefined || this.#model.shown !== true) return new Map();
    return this.#pages;
  }

  /** The names packages give their tabs, as the last read with pages said: a new map at each such read. */
  get names(): ReadonlyMap<string, BoardLabel> { return this.#names; }

  /** A tab's name as the board draws it: the one its package gives it in the page's language, else its folder's. */
  label(tab: string): string { return this.#names.get(tab)?.[this.language()] ?? tab; }

  /** The board's files changed: every page that lives hears it. */
  filesChanged(): void { this.#frame?.files(); }
  /** Where the keyboard lands as the column opens over the chat: the tab shown, else the plus. */
  get landing(): HTMLElement { return this.#shownButton() ?? this.#add; }

  /** The tab drawn: the one the seller chose while the board holds it, else 待办, else the first by name. */
  get tab(): string {
    const tabs = this.#model.tabs;
    if (this.#tab !== undefined && tabs.includes(this.#tab)) return this.#tab;
    return tabs.length === 0 || tabs.includes(TASKS_TAB) ? TASKS_TAB : tabs[0]!;
  }

  /** Shows a tab: one the board does not hold yet is shown once a read brings it. */
  showTab(tab: string): void { this.#tab = tab; this.#file = undefined; this.draw(); }

  /** The file whose tab is shown, if one is. */
  get file(): string | undefined { return this.#shownFile(); }
  #shownFile(): string | undefined { return this.#file !== undefined && this.#openFiles.has(this.#file) ? this.#file : undefined; }
  /** The tab shown, as the strip orders it: a file's by its key, else the folder's name. */
  #shownKey(): string { const file = this.#shownFile(); return file === undefined ? this.tab : fileKey(file); }
  #shownButton(): HTMLButtonElement | undefined { const file = this.#shownFile(); return file === undefined ? this.#stripButtons.get(this.tab) : this.#fileTabs.get(file)?.button; }
  /** The strip's tabs in order: the board's folders, then the files open, in the order they were opened. */
  #stripOrder(): readonly string[] { return [...this.#model.tabs, ...this.#openFiles.all.map(fileKey)]; }

  /**
   * A file of the tree shown on its own tab (`parts/board-page.md` §1): made at the press after the tabs there are, or the tab it has shown
   * again. A tab whose file was never read, changed, or did not show is read afresh; one drawn is shown as it stands.
   */
  openFile(path: string, from: OpenedFrom): void {
    this.#openFiles.add(path);
    for (const held of [...this.#fileReads.keys()]) if (!this.#openFiles.has(held)) this.#forget(held);
    const read = this.#fileReads.get(path);
    this.#file = path;
    this.#fileFresh.delete(path);
    if (read === undefined || read.stale === true || (read.state !== "page" && read.state !== "plain")) void this.#readFile(path, from);
    this.#frame?.keep(this.#allFramed());
    this.draw();
    this.ports.changed();
  }

  #showFile(path: string): void {
    const read = this.#fileReads.get(path);
    this.#file = path;
    this.#fileFresh.delete(path);
    if (read === undefined || read.stale === true || read.state === "off" || read.state === "unreadable") void this.#readFile(path, read?.from ?? "page");
    this.draw();
    this.#body.scrollTop = 0;
    this.ports.changed();
  }

  #forget(path: string): void { this.#fileReads.delete(path); this.#fileTurns.delete(path); this.#fileFresh.delete(path); this.#fileTabs.delete(path); }

  /** Closes a file's tab, asking nothing: the tab after it in the strip is shown in its place where it was shown, else the one before. */
  #closeFile(path: string): void {
    const order = this.#stripOrder();
    const at = order.indexOf(fileKey(path));
    const shown = this.#shownFile() === path;
    this.#openFiles.remove(path);
    this.#forget(path);
    if (shown) {
      const rest = order.filter((one) => one !== fileKey(path));
      const next = rest[Math.min(at, rest.length - 1)];
      this.#file = next !== undefined && isFileKey(next) ? next.slice(1) : undefined;
      if (next !== undefined && !isFileKey(next)) this.#tab = next;
      if (this.#file !== undefined) { const read = this.#fileReads.get(this.#file); if (read === undefined || read.stale === true) void this.#readFile(this.#file, read?.from ?? "page"); }
    }
    this.#frame?.keep(this.#allFramed());
    this.draw();
    this.ports.changed();
    if (shown) this.#shownButton()?.focus({ preventScroll: true });
  }

  /** Every tab drawn by a page: the board's, and the open files a page draws. */
  #allFramed(): ReadonlyMap<string, PageMaker> {
    const files = [...this.#fileReads].flatMap(([path, read]) => (read.state === "page" && read.page !== undefined ? [[fileKey(path), read.page.by] as const] : []));
    return new Map([...this.#framed(), ...files]);
  }

  /** The page a file's tab is drawn by, as its last read gave it. */
  #filePage(key: string): Promise<BoardPageRead> {
    const page = this.#fileReads.get(key.slice(1))?.page;
    return page === undefined ? Promise.reject(new Error("no page for the file")) : Promise.resolve(page);
  }

  /** Reads a file for its tab; a read overtaken by a newer one for the same file, or for a tab closed meanwhile, changes nothing. */
  async #readFile(path: string, from: OpenedFrom): Promise<void> {
    const turn = (this.#fileTurns.get(path) ?? 0) + 1;
    this.#fileTurns.set(path, turn);
    const was = this.#fileReads.get(path);
    if (was === undefined || (was.state !== "page" && was.state !== "plain")) this.#fileReads.set(path, { from, state: "opening" });
    let read: FileRead;
    try { read = await this.#fileOf(path, from); } catch (error) { read = { from, state: error instanceof BoardRefused && error.reason === "box_not_running" ? "off" : "unreadable" }; }
    if (this.#fileTurns.get(path) !== turn || !this.#openFiles.has(path)) return;
    this.#fileReads.set(path, read);
    const key = fileKey(path);
    const opened = read.page?.opened;
    if (this.#frame !== undefined && opened !== undefined && this.#frame.living.includes(key)) {
      // A viewer is handed the file anew; an HTML file is its own page, loaded again.
      if (opened.text !== undefined || opened.bytes !== undefined) this.#frame.file(key, opened); else if (this.#frame.tab === key) this.#frame.reload();
    }
    this.#frame?.keep(this.#allFramed());
    this.draw();
    this.ports.changed();
  }

  /** One read of a file: an HTML file as its own page; a kind a viewer declares, by that viewer; any other kind, its size and time. */
  async #fileOf(path: string, from: OpenedFrom): Promise<FileRead> {
    const backend = this.ports.backend;
    if (backend.boardOpen === undefined) return { from, state: "unreadable" };
    const kind = fileKind(path);
    const name = fileName(path);
    if (kind !== undefined && PAGE_KINDS.includes(kind)) {
      const open = await backend.boardOpen(path, from, false);
      if (open.kind !== "file" || open.text === undefined) return notShown(from, open);
      return { from, state: "page", size: open.size, modified: open.modified, page: { html: open.text, by: { kind: "cx" }, ...(open.kit === undefined ? {} : { kit: open.kit }), opened: { path, name, size: open.size, modified: open.modified } } };
    }
    const viewer = kind === undefined || backend.boardViewer === undefined ? undefined : await backend.boardViewer(kind);
    if (viewer === undefined) {
      const [stat] = (await backend.boardOpened?.([path])) ?? [];
      return stat === undefined || "missing" in stat ? { from, state: "gone" } : { from, state: "plain", size: stat.size, modified: stat.modified };
    }
    const open = await backend.boardOpen(path, from, viewer.bytes === true);
    if (open.kind !== "file") return notShown(from, open);
    const body = open.text !== undefined ? { text: open.text } : open.bytes !== undefined ? { bytes: open.bytes } : {};
    return { from, state: "page", size: open.size, modified: open.modified, page: { html: viewer.html, by: viewer.by, ...(viewer.kit === undefined ? {} : { kit: viewer.kit }), opened: { path, name, size: open.size, modified: open.modified, ...body } } };
  }

  /**
   * The open files as they are now, looked at after each read of the board: the file shown is read again where it changed; another's tab
   * takes the dot and is read when it is next shown. No file is watched between reads.
   */
  async #lookFiles(): Promise<void> {
    const paths = this.#openFiles.all.filter((path) => this.#fileReads.has(path));
    const look = this.ports.backend.boardOpened;
    if (paths.length === 0 || look === undefined || this.#model.shown !== true) return;
    let rows;
    try { rows = await look(paths); } catch { return; }
    let marked = false;
    for (const row of rows) {
      const read = this.#fileReads.get(row.file);
      if (read === undefined || read.state === "opening") continue;
      const gone = "missing" in row;
      const moved = gone ? read.state !== "gone" : read.state === "gone" || read.state === "off" || read.state === "unreadable" || read.modified !== row.modified;
      if (!moved) continue;
      if (row.file === this.#shownFile() && this.ports.inSight?.() === true) { void this.#readFile(row.file, read.from); continue; }
      this.#fileReads.set(row.file, { ...read, stale: true });
      if (row.file !== this.#shownFile()) { this.#fileFresh.add(row.file); marked = true; }
    }
    if (marked) { this.draw(); this.ports.changed(); }
  }

  /** The board shown at one of a tab's cards: a tab that holds a page tells it which; a card of the base's is scrolled to and takes the keyboard. */
  focusCard(tab: string, file: string): void {
    this.showTab(tab);
    if (this.#framed().has(tab)) { this.#frame!.focus(tab, file); return; }
    const at = `b:${tab}/`;
    const card = [...this.#cards].find(([key]) => key.startsWith(at) && key.slice(at.length).replace(/^[^/]*\//, "") === file)?.[1];
    card?.scrollIntoView?.({ block: "nearest" });
    card?.focus({ preventScroll: true });
  }

  #setTab(tab: string): void {
    this.ports.chose?.(tab);
    const fromFile = this.#shownFile() !== undefined;
    this.#file = undefined;
    if (this.tab === tab && !fromFile) return;
    this.#tab = tab;
    this.draw();
    this.#body.scrollTop = 0;
  }
  /** Packages updated, by npm name: each living page of the board's that one of them made is loaded again, as its reload button does. */
  updated(packages: readonly string[]): void {
    this.#frame?.renew([...this.#pages].filter(([, by]) => { const made = by.kind === "ours" ? by.package : by.kind === "third" ? by.name : undefined; return made !== undefined && packages.includes(made); }).map(([tab]) => tab));
  }

  /**
   * Reads the board again: every file in every tab, 待办's first. A read asked while one runs is made once more after it.
   * A read that fails leaves the board as it was drawn.
   */
  read(): Promise<void> {
    if (this.#reading !== undefined) { this.#again = true; return this.#reading; }
    const reading = (async () => {
      do {
        this.#again = false;
        try {
          const first = await this.ports.backend.board();
          this.#live = first.shown && first.keptAt === undefined;
          let todo = first.entries;
          let next = first.next;
          for (let part = 1; first.shown && next !== undefined && part < TODO_PARTS; part++) {
            const later = await this.ports.backend.board(next);
            todo = [...todo, ...later.entries];
            next = later.next;
          }
          // Every other tab is read whole too, so a file that lands in one is seen; one that cannot be read keeps what it held.
          const tabs = first.tabs ?? this.#model.tabs;
          const others = new Map<string, readonly BoardEntry[]>();
          const read = new Set<string>();
          for (const tab of first.shown ? tabs.filter((one) => one !== TASKS_TAB) : []) {
            try {
              const part = await this.ports.backend.board(undefined, tab);
              let entries = part.entries;
              let after = part.next;
              for (let more = 1; after !== undefined && more < TODO_PARTS; more++) { const later = await this.ports.backend.board(after, tab); entries = [...entries, ...later.entries]; after = later.next; }
              others.set(tab, entries);
              read.add(tab);
            } catch { const held = this.#model.others.get(tab); if (held !== undefined) others.set(tab, held); }
          }
          // A box asleep answers what was kept, which says nothing of pages: the pages and their numbers stand as they were.
          const paged = first.shown && first.pages !== undefined;
          if (paged) {
            this.#pages = new Map(first.pages!.map((one) => [one.tab, one.by] as const));
            this.#names = new Map(first.pages!.flatMap((one) => (one.name === undefined ? [] : [[one.tab, one.name] as const])));
          }
          this.#model = withRead(this.#model, { shown: first.shown, tabs, others, todo });
          // The pages live as the read says, out of sight too; a tab whose page went takes its number with it.
          const framed = this.#framed();
          if (paged) { this.#frame?.keep(this.#allFramed()); this.#counts.only(new Set(framed.keys())); } else if (!first.shown) this.#frame?.clear();
          if (first.shown && first.tabs !== undefined) this.#seen.only(new Set(first.tabs));
          if (first.shown) this.#seen.readOf(tabs, this.#live, new Map(this.#model.tabs.filter((tab) => tab === TASKS_TAB || read.has(tab)).map((tab) => [tab, this.#newest(tab)] as const)));
        } catch { /* the board stays as it was drawn */ }
        this.draw();
        this.ports.changed();
      } while (this.#again);
      void this.#lookFiles();
    })().finally(() => { this.#reading = undefined; });
    return this.#reading = reading;
  }

  #telling: ReturnType<typeof setTimeout> | undefined;
  // Said, then gone as the app's own spoken line goes: a line left standing is read later in the language it was said in.
  #tell(words: string): void {
    this.#announce.textContent = "";
    clearTimeout(this.#telling);
    this.#telling = setTimeout(() => { this.#announce.textContent = words; this.#telling = setTimeout(() => { this.#announce.textContent = ""; }, HEARD_MS); }, 60);
  }

  /** A card: when its file was last written, its title, and cx's words. */
  #baseCard(first: BoardEntry): Card {
    let entry = first;
    const titleId = idOf("u", entryKey(entry));
    const time = h("time", {});
    const title = h("h4", { class: "board-entry-title", id: titleId, dir: "auto" });
    const words = this.#wordsOf((made) => title.after(made));
    const unshown = h("p", { class: "board-unshown", hidden: true });
    const card: Card = h("article", { class: "board-entry board-generic", "data-file": entry.file, tabindex: "-1", "aria-labelledby": titleId }, h("p", { class: "board-meta" }, time), title, unshown);
    const drawn = (): void => {
      keep(time, "textContent", this.ports.time(entry.readable ? entry.at : entry.modified));
      keep(title, "textContent", titleOf(entry));
      words(entry.body);
      this.#drawUnshown(unshown, entry);
    };
    drawn();
    card.update = (data) => { entry = data as BoardEntry; drawn(); };
    return card;
  }

  /** In the words' place of a file the board could not draw, why, as the box said: over the board's size, or not read. */
  #drawUnshown(line: HTMLElement, entry: BoardEntry): void {
    const why = entry.readable ? undefined : entry.unshown;
    line.hidden = why === undefined;
    keep(line, "textContent", why === undefined ? "" : this.ports.say(why === "large" ? "board.tooLarge" : "board.unreadable"));
  }

  /** cx's words in a card, kept where they stand: set again only when they change, put in by `put`, taken out when there are none. */
  #wordsOf(put: (made: HTMLElement) => void): (body: string) => void {
    let shown: { readonly body: string; readonly made?: HTMLElement } = { body: "" };
    return (body) => {
      if (body === shown.body) return;
      const made = body.trim() === "" ? undefined : this.#words(body);
      if (shown.made !== undefined) { if (made === undefined) shown.made.remove(); else shown.made.replaceWith(made); } else if (made !== undefined) put(made);
      shown = { body, ...(made === undefined ? {} : { made }) };
    };
  }

  /** cx's words, drawn as an answer's are. */
  #words(body: string): HTMLElement {
    const open = this.ports.openFile;
    const words = renderMarkdown(body, open === undefined ? undefined : (path) => fileBox(path, this.ports.say, (pressed) => open(pressed, "card")));
    words.classList.add("board-words");
    words.dir = "auto";
    return words;
  }

  /** A tab's parts, made once for its name. */
  #tabOf(name: string): TabParts {
    const held = this.#tabParts.get(name);
    if (held !== undefined) return held;
    const button = h("button", { type: "button", class: "board-tab", role: "tab", id: idOf("tab", name), dir: "auto", onclick: () => this.#setTab(name), ondblclick: () => this.#startRename(name) },
      h("span", { class: "tab-label" }, name), h("span", { class: "page-count", "aria-hidden": "true", hidden: true }), h("span", { class: "tab-dot", "aria-hidden": "true", hidden: true })) as HTMLButtonElement;
    const field = h("input", { type: "text", class: "tab-rename", dir: "auto", maxlength: "64", autocomplete: "off", spellcheck: "false", hidden: true }) as HTMLInputElement;
    field.addEventListener("input", () => this.#drawNote(name));
    field.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === "Enter") { event.preventDefault(); void this.#endRename(true, true); }
      if (event.key === "Escape") { event.preventDefault(); void this.#endRename(false, true); }
    });
    field.addEventListener("blur", () => { void this.#endRename(true, false); });
    field.addEventListener("dblclick", (event) => event.stopPropagation());
    const close = h("button", { type: "button", class: "tab-close", tabindex: "-1", hidden: true, onclick: () => this.#askDelete(name) }, crossIcon()) as HTMLButtonElement;
    const dot = button.querySelector<HTMLElement>(".tab-dot")!;
    const parts = { wrap: h("span", { class: "board-tab-wrap", role: "presentation" }, button, field, close), button, field, close, dot };
    this.#stripButtons.set(name, button);
    this.#tabParts.set(name, parts);
    return parts;
  }

  #fileTabOf(path: string): FileTabParts {
    const held = this.#fileTabs.get(path);
    if (held !== undefined) return held;
    const button = h("button", { type: "button", class: "board-tab", role: "tab", id: idOf("file", path), dir: "auto", title: path, onclick: () => this.#showFile(path) },
      kindMark(path), h("span", { class: "tab-label" }, fileName(path)), h("span", { class: "tab-dot", "aria-hidden": "true", hidden: true })) as HTMLButtonElement;
    const close = h("button", { type: "button", class: "tab-close", tabindex: "-1", hidden: true, onclick: () => this.#closeFile(path) }, crossIcon()) as HTMLButtonElement;
    const parts = { wrap: h("span", { class: "board-tab-wrap file-tab", role: "presentation" }, button, close), button, close, dot: button.querySelector<HTMLElement>(".tab-dot")! };
    this.#fileTabs.set(path, parts);
    return parts;
  }

  /**
   * A file's facts and, where no page draws it, the file: its path, size and the time it was written in one row on the wash; while it
   * opens, the product's bars; a kind no viewer draws, the platform's row; too large, that line over the row; gone, its line, the path
   * alone standing; not read, its line.
   */
  #drawFile(path: string, read: FileRead | undefined): void {
    const say = this.ports.say;
    const state = read?.state ?? "opening";
    const known = read?.size !== undefined && read.modified !== undefined && state !== "gone" && state !== "unreadable";
    const facts = known ? [sizeOf(read.size!), this.ports.time(read.modified!)] : [];
    const head = JSON.stringify([path, facts]);
    if (this.#fileHead.dataset["sum"] !== head) {
      this.#fileHead.dataset["sum"] = head;
      this.#fileHead.replaceChildren(h("span", { class: "file-path", title: path }, h("bdi", {}, path)), ...facts.map((fact) => h("span", { class: "file-fact" }, fact)));
    }
    this.#filePane.setAttribute("aria-labelledby", idOf("file", path));
    const row = (): HTMLElement => h("div", { class: "file-row" }, kindMark(path),
      h("div", { class: "file-row-words" }, h("p", { class: "file-row-name", dir: "auto" }, fileName(path)), h("p", { class: "file-row-facts" }, facts.join(" · "))));
    const line = (key: StringKey): HTMLElement => h("p", { class: "file-said", role: "status" }, say(key));
    const pane = JSON.stringify([path, state, facts, this.language()]);
    if (this.#filePane.dataset["sum"] === pane) return;
    this.#filePane.dataset["sum"] = pane;
    if (state === "opening" || state === "page") this.#filePane.replaceChildren(h("div", { class: "file-stage", role: "status", "aria-label": say("stream.loading") },
      h("div", { class: "file-wait", "aria-hidden": "true" }, ...FILE_WAIT.map((width) => (width === 0 ? h("span", { class: "file-wait-gap" }) : bar(width, "small"))))));
    // The box said cx's computer is not running: the tab says so, as the board's other tabs do, and reads the file when shown again.
    else if (state === "off") this.#filePane.replaceChildren(h("div", { class: "file-stage" }, line("cx.computer.off")));
    else if (state === "plain") this.#filePane.replaceChildren(h("div", { class: "file-stage" }, row()));
    else if (state === "large") this.#filePane.replaceChildren(h("div", { class: "file-stage" }, line("board.tooLarge"), row()));
    else this.#filePane.replaceChildren(h("div", { class: "file-stage" }, line(state === "gone" ? "board.gone" : "board.unreadable")));
  }

  /** The cards of the base's boards fall as a waterfall, as many columns as the board's width holds. */
  #fall(): void { if (!this.#lookList.hidden) fall(this.#lookList); }

  /**
   * The plus makes a board at once and shows it, named 「看板 {n}」 by the lowest number no board's name has; cx finds it by that name or
   * by the number the steward gave it, which never changes. The keyboard goes to its tab at the press, and the box makes it behind it:
   * an empty board made holds nothing to read. One the box does not make is taken back, the board shown before shown again, and the
   * strip read anew; a name a package's board or one made meanwhile holds is said at the plus, as a rename's is under its field.
   */
  async #make(): Promise<void> {
    if (this.#changing || this.ports.backend.boardTab === undefined) return;
    const taken = new Set(this.#model.tabs);
    let n = 1;
    while (taken.has(this.ports.say("base.boardNumbered", { n }))) n++;
    const name = this.ports.say("base.boardNumbered", { n });
    this.#drawNote("");
    this.#changing = true;
    const was = this.#tab;
    this.ports.chose?.(name);
    this.#tab = name;
    this.#model = { ...this.#model, tabs: [...this.#model.tabs, name].sort(), others: new Map([...this.#model.others, [name, []]]) };
    this.draw();
    this.ports.changed();
    this.#stripButtons.get(name)?.focus({ preventScroll: true });
    try { await this.ports.backend.boardTab({ op: "make", tab: name }); } catch (error) {
      this.#changing = false;
      const shown = this.#tab === name;
      this.#model = { ...this.#model, tabs: this.#model.tabs.filter((one) => one !== name), others: new Map([...this.#model.others].filter(([one]) => one !== name)) };
      if (shown) { this.#tab = was; if (was !== undefined) this.ports.chose?.(was); }
      this.draw();
      this.ports.changed();
      if (shown) this.#add.focus({ preventScroll: true });
      if (error instanceof BoardRefused && error.reason === "name_taken") this.#drawNote("", "base.nameTaken", this.#add);
      void this.read();
      return;
    }
    this.#changing = false;
  }

  /** What stops a name: another board has it, it holds a slash, or it starts with a dot. */
  #fault(tab: string, name: string): StringKey | undefined {
    return this.#model.tabs.some((one) => one !== tab && one === name) ? "base.nameTaken" : /[\\/]/.test(name) ? "base.nameSlash" : name.startsWith(".") ? "base.nameDot" : undefined;
  }

  /** The line under the name field, said as it is typed, and read as the field's description. */
  #drawNote(tab: string, fault?: StringKey, under?: HTMLElement): StringKey | undefined {
    const field = this.#tabParts.get(tab)?.field;
    const said = fault ?? (field === undefined || this.#renaming !== tab ? undefined : this.#fault(tab, plainName(field.value)));
    this.#note.hidden = said === undefined;
    this.#note.textContent = said === undefined ? "" : this.ports.say(said);
    if (field === undefined && (under === undefined || said === undefined)) return said;
    if (field !== undefined && said === undefined) { field.removeAttribute("aria-invalid"); field.removeAttribute("aria-describedby"); return said; }
    if (field !== undefined) { field.setAttribute("aria-invalid", "true"); field.setAttribute("aria-describedby", this.#note.id); }
    const at = (field ?? under)!.getBoundingClientRect();
    this.#note.style.left = `${Math.max(8, Math.min(at.left, innerWidth - this.#note.offsetWidth - 8))}px`;
    this.#note.style.top = `${at.bottom + 6}px`;
    return said;
  }

  /** A board's name as a field in its tab's place, the name in it and selected: a double press, or F2 or Enter on the tab. */
  #startRename(tab: string): void {
    // While cx's computer is off a board's name is not opened for change: the box that would rename it is not there.
    if (!this.#own(tab) || this.#renaming !== undefined || this.#changing || this.#off?.off !== undefined) return;
    if (this.tab !== tab) this.#setTab(tab);
    this.#drawNote("");
    this.#renaming = tab;
    const field = this.#tabOf(tab).field;
    field.value = tab;
    this.draw();
    field.focus({ preventScroll: true });
    field.select();
  }

  /**
   * Enter, or leaving the field, keeps the new name; Escape puts the old one back; no name keeps the old one. A name the board cannot
   * take keeps the field open under its line while the keyboard is in it, and leaving it puts the old name back. A name another board
   * took meanwhile is said the same way when the box refuses it.
   */
  async #endRename(keep: boolean, focus: boolean): Promise<void> {
    const tab = this.#renaming;
    if (tab === undefined || this.#changing) return;
    const parts = this.#tabOf(tab);
    const name = plainName(parts.field.value);
    let to: string | undefined;
    if (keep && name !== "" && name !== tab) {
      if (this.#fault(tab, name) !== undefined) { if (focus) { this.#drawNote(tab); return; } } else to = name;
    }
    if (to !== undefined && this.ports.backend.boardTab !== undefined) {
      this.#changing = true;
      try { await this.ports.backend.boardTab({ op: "rename", tab, to }); } catch (error) {
        this.#changing = false;
        if (error instanceof BoardRefused && error.reason === "name_taken" && focus) { this.#drawNote(tab, "base.nameTaken"); return; }
        to = undefined;
      }
      this.#changing = false;
    }
    this.#renaming = undefined;
    this.#drawNote(tab);
    if (to !== undefined) this.#renamed(tab, to);
    this.draw();
    if (focus) this.#stripButtons.get(to ?? tab)?.focus({ preventScroll: true });
    if (to !== undefined) { this.ports.changed(); void this.read(); }
  }

  /** A board renamed on the box: its tab, its cards and what is kept of it go under the new name. */
  #renamed(from: string, to: string): void {
    const others = new Map([...this.#model.others].map(([tab, entries]) => [tab === from ? to : tab, entries] as const));
    this.#model = { ...this.#model, tabs: this.#model.tabs.map((one) => (one === from ? to : one)).sort(), others };
    this.#seen.moved(from, to);
    const parts = this.#tabParts.get(from);
    this.#tabParts.delete(from);
    this.#stripButtons.delete(from);
    if (this.#tab === from) this.#tab = to;
    if (parts !== undefined) parts.wrap.remove();
    this.ports.chose?.(to);
  }

  /**
   * The question before a delete, asked at the tab (round 8, "Deleting asks once, at the tab"): a small card under it, its corner mark
   * at the tab's ×, with the board's name, how many cards go with it, 取消 and 删除, the keyboard on 取消. Escape or a press anywhere else is
   * 取消, and the keyboard goes back where it was. A delete the box refuses keeps the card open and says why in its own line: the board
   * changed since the card asked, its count now, and the next press deletes that; or cx is writing into it, and the press waits.
   */
  #askDelete(tab: string, refused?: { readonly told: { readonly n: number; readonly newest: number }; readonly words: string }): void {
    if (!this.#own(tab)) return;
    this.#asking?.shut();
    const parts = this.#tabOf(tab);
    const from = parts.wrap.contains(document.activeElement) ? document.activeElement as HTMLElement : parts.button;
    const say = this.ports.say;
    const counted = (n: number): string => (n === 0 ? "" : n === 1 ? say("base.delCard") : say("base.delCards", { n }));
    const told = refused?.told ?? { n: this.#entriesOf(tab).length, newest: this.#newest(tab) };
    const line = h("p", { id: "board-del-what", role: "status" });
    const write = (words: string): void => { line.textContent = words; line.hidden = words === ""; };
    const card = h("dialog", { class: "tab-ask", "aria-labelledby": "board-del-ask", "aria-describedby": "board-del-what" }) as HTMLDialogElement;
    let going = false;
    const shut = (): void => { removeEventListener("resize", seat); if (card.open) card.close(); card.remove(); if (this.#asking?.shut === shut) this.#asking = undefined; };
    const back = (): void => { shut(); (from.isConnected && from.closest("[hidden]") === null ? from : this.#stripButtons.get(this.tab))?.focus({ preventScroll: true }); };
    // 删除 takes the board away at the press and shows the next; the box deletes it behind it. One the box refuses comes back where it
    // stood, shown, with the card open again under it saying why: the board changed since the card asked, its count now, and the next
    // press deletes that; or cx is writing into it, and the press waits. Any other failure brings the board back as it was.
    const go = async (): Promise<void> => {
      if (going || this.ports.backend.boardTab === undefined) return;
      going = true;
      shut();
      const before = { model: this.#model, pages: this.#pages };
      const names = this.#model.tabs;
      const at = names.indexOf(tab);
      const next = names[at + 1] ?? names[at - 1];
      this.#model = { ...this.#model, tabs: names.filter((one) => one !== tab), others: new Map([...this.#model.others].filter(([one]) => one !== tab)) };
      this.#pages = new Map([...this.#pages].filter(([one]) => one !== tab));
      if (next !== undefined) this.#tab = next;
      this.draw();
      this.ports.changed();
      (next === undefined ? this.#add : this.#stripButtons.get(next))?.focus({ preventScroll: true });
      try { await this.ports.backend.boardTab({ op: "delete", tab, ...told }); } catch (error) {
        this.#model = { ...this.#model, tabs: [...new Set([...this.#model.tabs, tab])].sort(), others: new Map([...this.#model.others, [tab, before.model.others.get(tab) ?? []]]) };
        this.#pages = before.pages;
        this.#tab = tab;
        this.draw();
        this.ports.changed();
        const busy = error instanceof BoardRefused && error.reason === "busy";
        const now = error instanceof BoardRefused && error.reason === "changed" ? error.now : undefined;
        if (!busy && now === undefined) { this.#stripButtons.get(tab)?.focus({ preventScroll: true }); return; }
        if (now !== undefined) void this.read();
        const rest = now === undefined ? "" : counted(now.n);
        const changed = say("base.delChanged");
        const words = busy ? say("base.delBusy") : rest === "" ? changed : this.language() === "zh" ? `${changed.replace(/。$/, "，")}${rest}` : `${changed} ${rest}`;
        this.#askDelete(tab, { told: now ?? told, words });
        return;
      }
      const framed = this.#framed();
      this.#frame?.keep(framed);
      this.#counts.only(new Set(framed.keys()));
      this.#tell(say("base.deleted", { name: tab }));
    };
    const no = h("button", { type: "button", onclick: back }, say("base.cancel"));
    const yes = h("button", { type: "button", onclick: () => { void go(); } }, say("base.del"));
    card.append(h("h2", { id: "board-del-ask", dir: "auto" }, say("base.delTitle", { name: tab })), line, h("div", { class: "row tab-ask-acts" }, no, yes));
    /** Under the tab's ×, the corner mark at its middle, kept inside the column; over the tab where there is no room under it. */
    const seat = (): void => {
      const at = (parts.close.hidden ? parts.button : parts.close).getBoundingClientRect();
      const within = (this.page.closest(".board") ?? this.page).getBoundingClientRect();
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      // The card is never wider than the column less its margins, so under a narrow board both its buttons stay in sight inside it.
      card.style.maxWidth = `min(20rem, ${Math.max(0, Math.floor(within.width) - 16)}px)`;
      // Measured from the column's own left: a fixed card is as wide as the window right of its left allows, and an old left can be past it.
      card.style.left = `${Math.round(within.left + 8)}px`;
      const width = card.offsetWidth;
      const left = Math.round(Math.max(within.left + 8, Math.min(at.left + at.width / 2 - 2 * rem, within.right - 8 - width)));
      const under = at.bottom + 8;
      const fits = under + card.offsetHeight <= innerHeight - 8;
      card.classList.toggle("over", !fits);
      card.style.left = `${left}px`;
      card.style.top = `${Math.round(fits ? under : at.top - 8 - card.offsetHeight)}px`;
      card.style.setProperty("--mark", `${Math.round(Math.max(rem * 0.75, Math.min(at.left + at.width / 2 - left, width - rem * 0.75)))}px`);
    };
    card.addEventListener("cancel", (event) => { event.preventDefault(); back(); });
    card.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); back(); } });
    card.addEventListener("pointerdown", (event) => {
      const box = card.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) { event.preventDefault(); back(); }
    });
    write(refused?.words ?? counted(told.n));
    this.head.ownerDocument.body.append(card);
    try { card.showModal(); } catch { card.setAttribute("open", ""); }
    seat();
    addEventListener("resize", seat);
    no.focus();
    this.#asking = { shut };
  }

  draw(): void {
    const say = this.ports.say;
    const used = new Set<string>();
    // While cx's computer is off, every tab's place says so: the strip stands, and nothing of a board is drawn, made, deleted or answered.
    const off = this.#model.shown === true ? this.ports.computer?.off() : undefined;
    // The card holding the keyboard, and the cards in the order they stood, for where the keyboard goes if its file leaves.
    const cardKeys = new Map([...this.#cards].map(([key, made]) => [made, key] as const));
    const holding = [...this.#cards].find(([, made]) => made.contains(document.activeElement))?.[0];
    const stood = holding === undefined ? [] : [...this.#pendingPane.querySelectorAll<HTMLElement>(".board-entry")].flatMap((one) => { const key = cardKeys.get(one); return key === undefined ? [] : [key]; });
    // A card moved to its new place drops the browser's focus, so the element that held it, still drawn, gets it back with its selection.
    const active = document.activeElement instanceof HTMLElement && document.activeElement !== document.body && this.page.contains(document.activeElement) ? document.activeElement : undefined;
    const selection = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? selectionOf(active) : undefined;
    // A card is kept from draw to draw for the focus it holds: a row of its key drawn again in place.
    const card = (key: string, data: unknown, make: () => Card): HTMLElement => {
      let made = this.#cards.get(key);
      const sum = JSON.stringify(data);
      if (made !== undefined && made.dataset["sum"] !== sum) made.update?.(data);
      if (made === undefined) { made = make(); this.#cards.set(key, made); }
      made.dataset["sum"] = sum;
      used.add(key);
      return made;
    };
    this.#title.textContent = say("board.board");
    const tab = this.tab;
    const file = this.#shownFile();
    // The strip is the base's: every tab by name, one current, drawn with one tab as with many.
    const framedTabs = this.#framed();
    const comma = this.language() === "zh" ? "，" : ", ";
    // The board shown in the open column is seen: its dot goes, and the icon's with it.
    if (file === undefined && this.ports.inSight?.() === true && this.#seen.saw(tab, this.#newest(tab))) queueMicrotask(() => this.ports.changed());
    if (file === undefined && this.ports.inSight?.() === true && this.#doorMarked.delete(tab)) queueMicrotask(() => this.ports.changed());
    if (file !== undefined && this.ports.inSight?.() === true && this.#fileFresh.delete(file)) queueMicrotask(() => this.ports.changed());
    const folders = this.#model.tabs.map((folder) => {
      const parts = this.#tabOf(folder);
      const button = parts.button;
      const name = this.label(folder);
      const label = button.querySelector<HTMLElement>(".tab-label")!;
      if (label.textContent !== name) label.textContent = name;
      // A tab carries its share of the icon's number, the one its page gave, named by its page's words for it; a board of the base's
      // own with something unseen carries the dot, named 「{name}，有新内容」.
      const share = framedTabs.has(folder) ? this.#counts.of(folder) : undefined;
      const marked = this.#doorMarked.has(folder);
      const fresh = marked || (share === undefined && folder !== tab && this.#fresh(folder));
      const count = button.querySelector<HTMLElement>(".page-count")!;
      count.hidden = share === undefined;
      count.textContent = share === undefined ? "" : String(share.n);
      parts.dot.hidden = !fresh;
      if (marked) button.setAttribute("aria-label", say("frame.tabNew", { name }));
      else if (share !== undefined) button.setAttribute("aria-label", share.words === undefined ? say("frame.tabNew", { name }) : `${name}${comma}${share.words}`);
      else if (fresh) button.setAttribute("aria-label", say("frame.tabNew", { name }));
      else button.removeAttribute("aria-label");
      const on = folder === tab && file === undefined;
      button.setAttribute("aria-selected", String(on));
      button.setAttribute("aria-controls", "board-pending");
      button.tabIndex = on ? 0 : -1;
      parts.wrap.classList.toggle("on", on);
      // The mark that deletes a board stands on the board shown, one of the base's own, and not while its name is a field.
      const editing = this.#renaming === folder;
      parts.wrap.classList.toggle("editing", editing);
      button.hidden = editing;
      parts.field.hidden = !editing;
      parts.close.hidden = !on || editing || !this.#own(folder) || off !== undefined;
      parts.close.setAttribute("aria-label", say("base.delNamed", { name }));
      parts.field.setAttribute("aria-label", say("base.boardName"));
      return parts.wrap;
    });
    // After the board's own tabs, a tab for each file open, its kind's mark before its name; the cross on the one shown closes it.
    const files = this.#openFiles.all.map((path) => {
      const parts = this.#fileTabOf(path);
      const name = fileName(path);
      const on = path === file;
      const fresh = this.#fileFresh.has(path);
      parts.button.setAttribute("aria-selected", String(on));
      parts.button.tabIndex = on ? 0 : -1;
      parts.wrap.classList.toggle("on", on);
      parts.dot.hidden = !fresh;
      if (fresh) parts.button.setAttribute("aria-label", say("frame.tabNew", { name })); else parts.button.removeAttribute("aria-label");
      parts.close.hidden = !on;
      parts.close.setAttribute("aria-label", say("board.closeFile", { name }));
      parts.close.title = say("board.closeFile", { name });
      return parts.wrap;
    });
    place(this.#strip, [...folders, ...files]);
    for (const path of [...this.#fileTabs.keys()]) if (!this.#openFiles.has(path)) this.#fileTabs.delete(path);
    for (const name of [...this.#stripButtons.keys()]) if (!this.#model.tabs.includes(name)) { this.#stripButtons.delete(name); this.#tabParts.delete(name); }
    if (this.#inSight !== this.#sight()) this.#chosenInSight(); else this.#cut();
    this.#add.hidden = off !== undefined || !this.#live || this.ports.backend.boardTab === undefined || this.#model.shown !== true;
    this.#add.setAttribute("aria-label", say("base.newBoard"));
    this.#add.title = say("base.newBoard");
    this.#strip.hidden = this.#model.tabs.length === 0 && files.length === 0;
    // A tab is one list of its files, and one pane draws it whichever tab it is.
    this.#pendingPane.setAttribute("aria-labelledby", idOf("tab", tab));
    const fileRead = file === undefined ? undefined : this.#fileReads.get(file);
    // A tab that holds a page is that page in a frame, where the platform names the second site. A tab left lets its page go.
    const paged = file !== undefined ? this.#frame !== undefined && fileRead?.state === "page" : this.#frame !== undefined && this.#model.shown === true && this.#pages.has(tab);
    // Under the glass (way C), the board the page still holds: 待办 as last read or kept, a board of the base's read this
    // visit, a page that came; else the board's shape. Where the seller's system asks for less transparency there is no glass (way A).
    const holds = file !== undefined ? (paged ? this.#frame!.holds(fileKey(file)) : fileRead !== undefined && fileRead.state !== "opening" && fileRead.state !== "off") : paged ? this.#frame!.holds(tab) : tab === TASKS_TAB || this.#model.others.has(tab);
    const under: Under | undefined = off === undefined || clearView() ? undefined : holds ? "last" : "shape";
    const framed = (off === undefined || under === "last") && paged;
    if (framed && file !== undefined) { this.#frame!.show(fileKey(file), fileRead?.page?.by); this.#frame!.element.setAttribute("aria-labelledby", idOf("file", file)); }
    else if (framed) { this.#frame!.show(tab, this.#pages.get(tab)); this.#frame!.element.setAttribute("aria-labelledby", idOf("tab", tab)); } else this.#frame?.hide();
    // A file's tab says its own facts over its page, so the frame's caption row is not drawn there.
    this.#frame?.element.classList.toggle("of-file", file !== undefined);
    this.#body.classList.toggle("framed", framed || file !== undefined);
    if (file === undefined) this.#stripButtons.get(tab)?.setAttribute("aria-controls", framed ? "board-frame" : "board-pending");
    else this.#fileTabs.get(file)?.button.setAttribute("aria-controls", framed ? "board-frame" : "board-file");
    const fileHidden = file === undefined || (off !== undefined && under !== "last");
    this.#fileHead.hidden = fileHidden;
    this.#filePane.hidden = fileHidden || framed;
    if (file !== undefined) this.#drawFile(file, fileRead);
    this.#pendingPane.hidden = (off !== undefined && under !== "last") || framed || file !== undefined;
    const look = baseCards(tab === TASKS_TAB ? this.#model.todo : this.#model.others.get(tab) ?? []);
    // A card is each tab's its own, so a file in two tabs' reads is two cards.
    place(this.#lookList, look.map((entry) => card(`b:${tab}/${entryKey(entry)}`, entry, () => this.#baseCard(entry))));
    this.#lookSection.hidden = look.length === 0;
    this.#emptyLine.hidden = look.length > 0;
    this.#emptyLine.textContent = say("board.neverYet");
    for (const [key, made] of [...this.#cards]) if (!used.has(key)) { made.remove(); this.#cards.delete(key); }
    if (active?.isConnected === true && (document.activeElement === null || document.activeElement === document.body)) {
      active.focus({ preventScroll: true });
      if (selection !== undefined) (active as HTMLInputElement).setSelectionRange(...selection);
    }
    // A card that held the keyboard and left, its file gone or replaced by a new version, hands it on: the card after it as they stood, else
    // the one before, else the tab; never the page's body, and never a file by name.
    if (holding !== undefined && !used.has(holding) && !(document.activeElement instanceof HTMLElement && document.activeElement !== document.body && document.activeElement.isConnected)) {
      const next = nextAfter(stood.filter((key) => key === holding || (used.has(key) && this.#pendingPane.contains(this.#cards.get(key)!))), holding);
      const fallback = this.#stripButtons.get(this.tab);
      (next === undefined ? fallback : this.#cards.get(next)!)?.focus({ preventScroll: true });
    }
    this.#fall();
    this.#drawOff(off, active !== undefined, under);
  }
}

/**
 * Puts a box's children in order and touches only what the order changed: a new row's element goes in, a departed one comes out, and of
 * those that stay, the longest run already in order stands while the rest are moved.
 */
function place(box: HTMLElement, elements: readonly HTMLElement[]): void {
  const wanted = new Set(elements);
  for (const child of [...box.children]) if (!wanted.has(child as HTMLElement)) child.remove();
  const stays = inOrder(elements, new Map([...box.children].map((child, at) => [child as HTMLElement, at] as const)));
  let next: Element | null = null;
  for (let at = elements.length - 1; at >= 0; at -= 1) {
    const element = elements[at]!;
    if (!stays.has(element)) box.insertBefore(element, next);
    next = element;
  }
}

/** After a card leaves the list, where the keyboard goes: the card after it, else the one before, else nowhere on the list; each by its key. */
function nextAfter(order: readonly string[], left: string): string | undefined {
  const at = order.indexOf(left);
  if (at < 0) return undefined;
  const rest = order.filter((key) => key !== left);
  return rest[at] ?? rest[at - 1];
}

const selectionOf = (field: HTMLInputElement | HTMLTextAreaElement): readonly [number, number, "forward" | "backward" | "none"] | undefined =>
  field.selectionStart === null || field.selectionEnd === null ? undefined : [field.selectionStart, field.selectionEnd, field.selectionDirection ?? "none"];

/** The elements already in the box that keep their places: the longest run of them whose places in the box rise in the order wanted. */
function inOrder(elements: readonly HTMLElement[], places: ReadonlyMap<HTMLElement, number>): ReadonlySet<HTMLElement> {
  const there = elements.filter((element) => places.has(element));
  const tails: number[] = [];
  const before: number[] = [];
  there.forEach((element, at) => {
    const spot = places.get(element)!;
    let low = 0;
    let high = tails.length;
    while (low < high) { const mid = (low + high) >> 1; if (places.get(there[tails[mid]!]!)! < spot) low = mid + 1; else high = mid; }
    before[at] = low > 0 ? tails[low - 1]! : -1;
    tails[low] = at;
  });
  const stays = new Set<HTMLElement>();
  for (let at = tails.at(-1) ?? -1; at >= 0; at = before[at]!) stays.add(there[at]!);
  return stays;
}
