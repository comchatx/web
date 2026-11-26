import { BOARD_READ_MAX_BYTES, boardFilePath, ENTRY_MAX_BYTES, treeFilePath, type BoardFileRow, type PageMaker } from "../shared/board.js";
import { BoardRefused, type BoardPageRead, type OpenedFileBody } from "./backend.js";
import { h, svg } from "./dom.js";
import { pageFileBox } from "./board-files.js";
import { renderMarkdown } from "./markdown.js";
import type { StringKey } from "./strings.js";

/** A page still on its way after this long says so: the prototype's moment. */
export const LOADING_AFTER_MS = 400;
/** A page that has not come after this long did not load. */
export const FAILED_AFTER_MS = 15_000;
/** The most pages kept loaded at once, the one shown among them: a page out of sight may still count and ask. */
export const MOST_PAGES = 8;
/** The longest sentence a page drafts or sends. */
export const SAID_MAX = 2_000;
/** The longest words a page gives with its number, and the longest name it gives what changed. */
export const WORDS_MAX = 80;
/** The largest number a page puts on the board's icon. */
export const COUNT_MAX = 99_999;
/** Where the second site serves the page proxy. */
const PROXY_PATH = "/frame";
/** The theme's values cx's figure reads (`cx.js`), handed with the figure to every page: its line, its two colours and their shades, its pencil, chalk and paper. */
export const FIGURE_VALUES: readonly string[] = Object.freeze([
  "--cx-line", "--cx-forest", "--cx-forest-shade", "--cx-sand", "--cx-sand-shade", "--cx-sand-light", "--cx-chalk", "--cx-paper",
]);
/**
 * The theme's values a page is given: the custom properties the ready-made elements read (the board package's `kit/theme.json`), then
 * the figure's, each the app's own token of the same name. A page that reads none of them is drawn as it stands.
 */
export const THEME_VALUES: readonly string[] = Object.freeze([
  "--ground", "--raised", "--wash", "--held", "--hover", "--line", "--edge", "--ink", "--quiet", "--act", "--act-ink", "--act-hover", "--act-wash",
  "--bad", "--live", "--live-edge", "--float-edge", "--float-shadow", "--float-hover", "--font-ui", "--font-mono", "--size-caption", "--size-small",
  "--size-body", "--size-lead", "--size-title", "--leading-body", "--leading-small", "--leading-tight", "--leading-glyph",
  "--weight-regular", "--weight-strong", "--space-1", "--space-2", "--space-3", "--space-4", "--space-5", "--space-6", "--space-7",
  "--space-8", "--radius-small", "--radius", "--radius-round", ...FIGURE_VALUES,
]);

/**
 * What a page may ask of the board around it (`parts/board-page.md` §1), each for the tab whose page asks: a sentence in the message box, a
 * message sent, its own tab's files listed, read and written, a number on the board's icon, its board shown, and a file handed to the
 * seller. The frame checks each ask's shape; what the board does with it is the app's. `pressed` is the seller taking what the page shows:
 * a press in it, or the keyboard going into it. A text drawn as cx's answers are is the frame's own to answer.
 */
export type FrameAsks = {
  /** Puts the sentence in the message box; throws `BoardRefused("no_press")` where the seller did not press. */
  readonly draft: (tab: string, text: string) => void;
  /**
   * Sends the sentence as the seller's message; `drafted` where, at a press, it could not go now and was put in the message box instead;
   * throws `BoardRefused("no_press")` where the seller did not press.
   */
  readonly send: (tab: string, text: string, card?: string) => "sent" | "drafted";
  readonly files: (tab: string) => Promise<readonly BoardFileRow[]>;
  readonly read: (tab: string, file: string) => Promise<string>;
  readonly write: (tab: string, file: string, text: string) => Promise<{ readonly modified: number; readonly size: number }>;
  readonly count: (tab: string, n: number, words: string | undefined) => void;
  readonly show: (tab: string, name: string) => void;
  /**
   * Saves a file to the seller's computer under `name`: words the page gives, or one of its own tab's files; throws `BoardRefused("no_press")`
   * where the seller did not press, and `"too_large"` over `BOARD_READ_MAX_BYTES`.
   */
  readonly save: (tab: string, name: string, from: { readonly text: string } | { readonly file: string }) => Promise<"saved">;
  readonly pressed: (tab: string) => void;
  /** Shows a file of the tenant tree on its own tab of the board, at a press the proxy held it to; absent, a page's open is refused. */
  readonly open?: (tab: string, path: string) => void;
};

export type FramePorts = {
  /** The second site's origin, the only one the frame is drawn from and spoken with. */
  readonly origin: string;
  readonly read: (tab: string) => Promise<BoardPageRead>;
  readonly say: (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;
  /** The app's own origin, which the proxy answers to; the page's unless a test names one. */
  readonly appOrigin?: string;
  /** What a page's asks reach; without them a page is drawn and asks nothing that is answered. */
  readonly asks?: FrameAsks;
  /** A tab's name as the board draws it, the frame's title; its folder's without it. */
  readonly name?: (tab: string) => string;
  /** A package of ours by its card's name in the page's language, where the page holds its record. */
  readonly plugin?: (npm: string) => string | undefined;
};

/** What a page is told of where it stands: the theme and its values, the language, the width it is given, and the name the chat gives its Send, for the box a page asks for. */
export type FrameContext = { readonly theme: "light" | "dark"; readonly locale: "zh" | "en"; readonly width: number; readonly values: Readonly<Record<string, string>>; readonly send: string };

const reloadIcon = (): SVGElement => svg("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" },
  ...["M19.5 12a7.5 7.5 0 1 1-2.2-5.3", "M19.5 4.5v4.5H15"].map((d) => svg("path", { d })));
/**
 * A page while it lives, shown or kept out of sight: its tab and frame, what it was read as, whether the proxy said it is ready, how far it
 * came (`shown` once the page loaded, `slow` and `failed` on the way), and how it goes.
 */
type Live = { readonly tab: string; readonly frame: HTMLIFrameElement; page?: BoardPageRead; ready: boolean; state: "loading" | "slow" | "failed" | "shown"; readonly stop: () => void };
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const said = (value: unknown): value is string => typeof value === "string" && value.trim() !== "" && value.length <= SAID_MAX;
/** A file's own name, one part of a path as a page names one in its tab: what a saved file is called. */
const fileName = (value: unknown): value is string => boardFilePath(value) && !value.includes("/");

/**
 * A board's pages in frames (`parts/board-page.md` §1): a caption row on the wash naming who made the page shown with 重新加载 at its end,
 * and each page drawn by the proxy on the second site, as wide as the column and as tall as the page says. At most `MOST_PAGES` pages are
 * kept loaded, the shown one among them, so a page out of sight still counts and asks; a tab that no longer holds a page lets its page go.
 * It takes a message only from that origin and a frame of its own, and posts only to that origin. A page that comes at once says nothing;
 * one on its way after a moment says 正在加载; one that does not come says it did not load, with 重试.
 */
export class BoardFrame {
  readonly #by = h("p", { class: "frame-by" });
  readonly #reload = h("button", { type: "button", class: "page-icon frame-reload", onclick: () => this.reload() }, reloadIcon());
  readonly #words = h("p", { class: "frame-words", role: "status" });
  readonly #retry = h("button", { type: "button", hidden: true, onclick: () => { const held = document.activeElement === this.#retry; this.reload(); if (held) this.#reload.focus({ preventScroll: true }); } });
  readonly #note = h("div", { class: "frame-note", hidden: true }, this.#words, this.#retry);
  readonly #stage = h("div", { class: "frame-stage" }, this.#note);
  readonly element = h("div", { class: "board-pane board-frame", id: "board-frame", role: "tabpanel", hidden: true }, h("div", { class: "frame-head" }, this.#by, this.#reload), this.#stage);
  /** The tab whose page is shown, if any. */
  #tab: string | undefined;
  /** Who made each page, by its tab, as the board last said or the page's read did. */
  readonly #makers = new Map<string, PageMaker>();
  /** Every page that lives, by its tab. */
  readonly #lives = new Map<string, Live>();
  /** The card a tab's page is to bring into view, told once its page is shown. */
  readonly #focusing = new Map<string, string>();
  /** When each tab's page was last shown, by a count of showings: the page shown longest ago lets go first. */
  readonly #shownAt = new Map<string, number>();
  #shows = 0;
  /** The width a page was last given, for a page told while the column is out of sight. */
  #width = 0;

  constructor(readonly ports: FramePorts) {
    window.addEventListener("message", (event) => this.#heard(event));
    // The keyboard going into a page is the seller taking it, as a press in it is.
    window.addEventListener("blur", () => { for (const live of this.#lives.values()) if (document.activeElement === live.frame) this.ports.asks?.pressed(live.tab); });
    const told = (): void => { for (const live of this.#lives.values()) this.#tell(live); };
    // The theme, the language and the width, told again whenever they change.
    new MutationObserver(told).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "lang"] });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(told).observe(this.element);
  }

  /** The tab whose page is shown, if any. */
  get tab(): string | undefined { return this.#tab; }

  /** Whether a tab's page came and has not failed: what the board can lay under the glass while cx's computer is off. */
  holds(tab: string): boolean { const live = this.#lives.get(tab); return live?.page !== undefined && live.state !== "failed"; }

  /** The tabs whose pages live now, shown or out of sight. */
  get living(): readonly string[] { return [...this.#lives.keys()]; }

  /**
   * Shows a tab's page, captioned by its maker; a page already living is shown as it stands. One not living is loaded, and where
   * `MOST_PAGES` live already, the page shown longest ago lets go first, one never shown before any, so the shown one is always among them.
   */
  show(tab: string, maker: PageMaker | undefined): void {
    this.element.hidden = false;
    if (maker !== undefined) this.#makers.set(tab, maker);
    this.#tab = tab;
    this.#shownAt.set(tab, ++this.#shows);
    if (!this.#lives.has(tab)) {
      const order = [...this.#lives.keys()].sort((one, other) => (this.#shownAt.get(one) ?? 0) - (this.#shownAt.get(other) ?? 0));
      for (const going of order.slice(0, Math.max(0, this.#lives.size - MOST_PAGES + 1))) { this.#lives.get(going)!.stop(); this.#lives.delete(going); }
    }
    const live = this.#lives.get(tab) ?? this.#load(tab);
    for (const one of this.#lives.values()) one.frame.hidden = one !== live || live.state === "failed";
    this.#caption();
    this.#says();
  }

  /** Hides the frame; the pages live on out of sight. */
  hide(): void {
    this.#tab = undefined;
    this.element.hidden = true;
    for (const one of this.#lives.values()) one.frame.hidden = true;
  }

  /**
   * The tabs that hold a page, as the board read them: a page that lives and is no longer among them goes, and each one not living is
   * loaded out of sight, the shown first then in the order given, until `MOST_PAGES` live. A page that did not load is loaded again.
   */
  keep(pages: ReadonlyMap<string, PageMaker>): void {
    for (const [tab, maker] of pages) this.#makers.set(tab, maker);
    for (const [tab, live] of [...this.#lives]) if (!pages.has(tab)) { live.stop(); this.#lives.delete(tab); }
    for (const tab of [...this.#shownAt.keys()]) if (!pages.has(tab)) this.#shownAt.delete(tab);
    for (const tab of pages.keys()) {
      const live = this.#lives.get(tab);
      if (live?.state === "failed") this.#load(tab);
      else if (live === undefined && this.#lives.size < MOST_PAGES) this.#load(tab).frame.hidden = true;
    }
    if (this.#tab !== undefined && !pages.has(this.#tab)) this.hide();
  }

  /** Lets every page go, as when the board is no longer shown. */
  clear(): void { for (const live of this.#lives.values()) live.stop(); this.#lives.clear(); this.hide(); }

  /** Loads the page shown again, read afresh. */
  reload(): void {
    const tab = this.#tab;
    if (tab === undefined) return;
    this.#load(tab);
    this.show(tab, undefined);
  }

  /** Loads again, read afresh, the page of each tab named that lives, shown or out of sight; one not living stays unloaded. */
  renew(tabs: readonly string[]): void {
    for (const tab of tabs) if (this.#lives.has(tab)) { if (tab === this.#tab) this.reload(); else this.#load(tab); }
  }

  /** The board's files changed: every page that lives hears it. */
  files(): void { for (const live of this.#lives.values()) if (live.ready && live.page !== undefined) this.#post(live, { cx: "files" }); }

  /** A viewer's file read anew: its page is handed it now if it is shown, else once it is. */
  file(tab: string, opened: OpenedFileBody): void {
    const live = this.#lives.get(tab);
    if (live?.page === undefined) return;
    live.page = { ...live.page, opened };
    this.#handed(live);
  }

  /** A viewer's page handed its file (`cxBoard.on("file")`) once it is shown: an HTML file is the page itself and is handed nothing. */
  #handed(live: Live): void {
    const opened = live.page?.opened;
    if (opened === undefined || (opened.text === undefined && opened.bytes === undefined) || !live.ready || live.state !== "shown") return;
    this.#post(live, { cx: "file", file: opened });
  }

  /** A tab's page told to bring one of its cards into view (`cxBoard.on("focus")`), now if it is shown, else once it is. */
  focus(tab: string, file: string): void {
    this.#focusing.set(tab, file);
    const live = this.#lives.get(tab);
    if (live !== undefined) this.#focused(live);
  }

  #focused(live: Live): void {
    const file = this.#focusing.get(live.tab);
    if (file === undefined || !live.ready || live.page === undefined || live.state !== "shown") return;
    this.#focusing.delete(live.tab);
    this.#post(live, { cx: "focus", file });
  }

  #caption(): void {
    const say = this.ports.say;
    const maker = this.#tab === undefined ? undefined : this.#makers.get(this.#tab);
    this.#by.textContent = maker === undefined ? "" : maker.kind === "cx" ? say("frame.byCx") : say(maker.kind === "ours" ? "frame.byPlugin" : "frame.byThird", { name: (maker.kind === "ours" && maker.package !== undefined ? this.ports.plugin?.(maker.package) : undefined) ?? maker.name });
    this.#reload.setAttribute("aria-label", say("frame.reload"));
    this.#reload.title = say("frame.reload");
    this.#retry.textContent = say("status.retry");
    for (const live of this.#lives.values()) live.frame.title = this.ports.name?.(live.tab) ?? live.tab;
  }

  /** What the shown page's note says: nothing once it came or at once, 正在加载 when slow, and that it did not load with 重试. */
  #says(): void {
    const state = this.#tab === undefined ? undefined : this.#lives.get(this.#tab)?.state;
    const kind = state === "slow" ? "loading" : state === "failed" ? "failed" : undefined;
    this.#words.textContent = kind === undefined ? "" : this.ports.say(kind === "failed" ? "frame.failed" : "stream.loading");
    this.#retry.hidden = kind !== "failed";
    this.#note.hidden = kind === undefined;
  }

  #context(): FrameContext {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const values: Record<string, string> = {};
    for (const name of THEME_VALUES) { const value = style.getPropertyValue(name).trim(); if (value !== "") values[name] = value; }
    const width = Math.round(this.element.clientWidth);
    if (width > 0) this.#width = width;
    return { theme: root.dataset["theme"] === "dark" ? "dark" : "light", locale: root.lang.startsWith("zh") ? "zh" : "en", width: this.#width, values, send: this.ports.say("composer.send") };
  }

  #post(live: Live, data: Readonly<Record<string, unknown>>): void { live.frame.contentWindow?.postMessage(data, this.ports.origin); }

  #tell(live: Live): void { if (live.ready && live.page !== undefined) this.#post(live, { cx: "context", context: this.#context() }); }

  #send(live: Live): void {
    if (live.ready && live.page !== undefined) this.#post(live, { cx: "page", html: live.page.html, ...(live.page.kit === undefined ? {} : { kit: live.page.kit }), context: this.#context() });
  }

  #state(live: Live, state: Live["state"]): void {
    live.state = state;
    if (live.tab === this.#tab) { live.frame.hidden = state === "failed"; this.#says(); }
    this.#focused(live);
    this.#handed(live);
  }

  /** A page loaded afresh for its tab, out of sight unless its tab is shown; the one that lived before for the tab goes. */
  #load(tab: string): Live {
    this.#lives.get(tab)?.stop();
    const app = this.ports.appOrigin ?? location.origin;
    const frame = h("iframe", { class: "frame-page", src: `${this.ports.origin}${PROXY_PATH}#origin=${encodeURIComponent(app)}`, sandbox: "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads", referrerpolicy: "no-referrer", title: this.ports.name?.(tab) ?? tab }) as HTMLIFrameElement;
    const loading = setTimeout(() => { if (live.state === "loading") this.#state(live, "slow"); }, LOADING_AFTER_MS);
    const failing = setTimeout(() => { if (live.state === "loading" || live.state === "slow") this.#state(live, "failed"); }, FAILED_AFTER_MS);
    const live: Live = { tab, frame, ready: false, state: "loading", stop: () => { clearTimeout(loading); clearTimeout(failing); frame.remove(); } };
    this.#lives.set(tab, live);
    frame.hidden = tab !== this.#tab;
    this.#stage.prepend(frame);
    if (tab === this.#tab) this.#says();
    void this.ports.read(tab).then((page) => {
      if (this.#lives.get(tab) !== live) return;
      live.page = page;
      this.#makers.set(tab, page.by);
      if (tab === this.#tab) this.#caption();
      this.#send(live);
    }, () => { if (this.#lives.get(tab) === live) { clearTimeout(loading); clearTimeout(failing); this.#state(live, "failed"); } });
    return live;
  }

  #heard(event: MessageEvent): void {
    if (event.origin !== this.ports.origin || !record(event.data)) return;
    const live = [...this.#lives.values()].find((one) => one.frame.contentWindow !== null && event.source === one.frame.contentWindow);
    if (live === undefined) return;
    const data = event.data;
    if (data["cx"] === "ready") { live.ready = true; this.#send(live); }
    else if (data["cx"] === "shown") this.#state(live, "shown");
    else if (data["cx"] === "size" && typeof data["height"] === "number" && Number.isFinite(data["height"])) live.frame.style.height = `${Math.max(0, Math.min(100_000, Math.ceil(data["height"])))}px`;
    else if (data["cx"] === "pressed") this.ports.asks?.pressed(live.tab);
    else if (data["cx"] === "ask" && typeof data["id"] === "number") this.#ask(live, data["id"], data);
  }

  /** One ask of a page, its shape checked, answered to the page by its id: a value, or a refusal and why. */
  #ask(live: Live, id: number, data: Readonly<Record<string, unknown>>): void {
    const tab = live.tab;
    const answer = (ok: boolean, value?: unknown, reason?: string): void => { if (this.#lives.get(tab) === live) this.#post(live, { cx: "answer", id, ok, ...(value === undefined ? {} : { value }), ...(reason === undefined ? {} : { reason }) }); };
    const settle = (promise: Promise<unknown>): void => { void promise.then((value) => answer(true, value), (error: unknown) => answer(false, undefined, error instanceof BoardRefused ? error.reason : "unreadable")); };
    const asks = this.ports.asks;
    if (asks === undefined) { answer(false, undefined, "unavailable"); return; }
    const { verb, text, file, n, words, name, card, path } = data;
    // A page that draws one file of the tree has no tab of its own: it draws words as cx's answers are, and opens a file, and nothing else.
    const opened = live.page?.opened !== undefined;
    if (opened && verb !== "markdown" && verb !== "open") { answer(false, undefined, "no_tab"); return; }
    const now = (act: () => unknown): void => { try { answer(true, act()); } catch (error) { answer(false, undefined, error instanceof BoardRefused ? error.reason : "unavailable"); } };
    if (verb === "draft" && said(text)) now(() => { asks.draft(tab, text); return "drafted"; });
    else if (verb === "send" && said(text) && (card === undefined || boardFilePath(card))) now(() => asks.send(tab, text, card));
    else if (verb === "list") settle(asks.files(tab).then((rows) => rows.map((row) => ({ file: row.file, modified: row.modified, size: row.size }))));
    else if (verb === "read" && boardFilePath(file)) settle(asks.read(tab, file));
    else if (verb === "write" && boardFilePath(file) && typeof text === "string") settle(asks.write(tab, file, text).then((done) => ({ file, modified: done.modified, size: done.size })));
    else if (verb === "count" && typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= COUNT_MAX && (words === undefined || (typeof words === "string" && words.length <= WORDS_MAX))) { asks.count(tab, n, typeof words === "string" && words.trim() !== "" ? words.trim() : undefined); answer(true); }
    else if (verb === "show" && typeof name === "string" && name.trim() !== "" && name.length <= WORDS_MAX) { asks.show(tab, name.trim()); answer(true); }
    // A card's words at most, or a viewer's own file up to a read's bound, drawn by the chat's own pipeline for the page's `.markdown` box.
    else if (verb === "markdown" && typeof text === "string") {
      if (new TextEncoder().encode(text).length > (opened ? BOARD_READ_MAX_BYTES : ENTRY_MAX_BYTES)) answer(false, undefined, "too_large");
      else answer(true, renderMarkdown(text, (path) => pageFileBox(path, this.ports.say)).innerHTML);
    }
    else if (verb === "open" && treeFilePath(path)) { if (asks.open === undefined) answer(false, undefined, "unavailable"); else { asks.open(tab, path); answer(true); } }
    else if (verb === "save" && typeof text === "string" && file === undefined && fileName(name)) settle(asks.save(tab, name, { text }));
    else if (verb === "save" && text === undefined && boardFilePath(file) && (name === undefined || fileName(name))) settle(asks.save(tab, name ?? file.split("/").at(-1)!, { file }));
    else answer(false, undefined, "malformed");
  }
}
