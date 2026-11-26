import { heldForNext, movedAnswers, stopsOnSteps, tooLongAnswers, answer, note, said, shown, stepTime, boardCard, type BoardCard, type Fold, type Line, type Name, type Span, type ToolCard, type Words } from "./chat-model.js";
import { boardIcon } from "./board-column.js";
import type { CardAnswered, CardAsked, CardRow, CardState } from "../shared/board.js";
import type { Dialog, Notice } from "../shared/dialog.js";
import { askedRecord, dialogCard, noticeLine, type DialogPorts } from "./dialog-card.js";
import { confirmCard, confirmRows, formRows, optionCard, optionRows, recordRows } from "./option-card.js";
import { isOptionCard } from "../shared/dialog.js";
import { CONFIRM_FORM, OPTION_FORM, readOptionRecord } from "../shared/option-form.js";
import { carried, fill, h, svg } from "./dom.js";
import { hideTipWithin } from "./forms.js";
import { bar, block, skeleton, Waits } from "./waiting.js";
import { renderMarkdown, type PathLink } from "./markdown.js";
import { fileBox } from "./board-files.js";
import { dayKey } from "./days.js";
import { NOTICE_MS, working, type Block, type Item, type StreamState } from "./stream-model.js";
import type { Language, StringKey } from "./strings.js";
import { doorName } from "./catalogue.js";
import type { CardWords } from "../shared/maker-words.js";
import type { Way } from "../shared/card-choices.js";
import { unquoted, type Quote } from "./quote.js";
import type { RowOf, WaitingOf } from "./message-rows.js";
import { readBoardMessage, readFromBoard, type BoardPair } from "./board-message.js";

/** The keys that press an option card's main button: ⌘ and Enter on a Mac, Ctrl and Enter elsewhere. */
const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export type Say = (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;
/** Where a card stands, in the chat's row's words (the signed table, rows 35, 36 and 39). */
/** A card's urgency on its row: three bars, as many in ink as its level, as the Inbox marks a card; what it says is the card's own. */
const levelMark = (level: 1 | 2 | 3): SVGElement => svg("svg", { class: "told-level", viewBox: "0 0 16 16", "aria-hidden": "true" },
  ...([[1.5, 9.5, 5], [6.5, 6, 8.5], [11.5, 2.5, 12]] as const).map(([x, y, height], at) => svg("rect", { x: String(x), y: String(y), width: "3", height: String(height), rx: "1", ...(at < level ? { class: "lit" } : {}) })));
const CARD_STATES: Readonly<Record<CardState, StringKey>> = { toRead: "board.toRead", toAnswer: "board.toAnswer", read: "board.wasRead", answered: "board.wasAnswered", dismissed: "board.dismissed" };
export type StreamViewPorts = {
  readonly say: Say;
  /** The language the page speaks; absent, Chinese. */
  readonly language?: () => Language;
  /** The account the page is signed in as; absent, nothing chosen in an option card is kept in the tab. */
  readonly account?: () => string | undefined;
  /** A board card's title and where it stands, once read; none until then, or where it cannot be read, and the chat draws what it drew. */
  readonly card?: (card: BoardCard) => CardRow | undefined;
  /** Shows the board at a card. */
  readonly openCard?: (card: BoardCard) => void;
  /** A model's name as the page says it; absent, its id. */
  readonly modelName?: (model: { readonly provider: string; readonly id: string }) => string;
  /** Each card's words, by which a move's line names a way's door (`doorName`). Absent, a door is named from the registry alone. */
  readonly makers?: () => CardWords;
  /** Opens the model card. Absent, no answer offers it. */
  readonly chooseModel?: () => void;
  /** Shows a file cx named on its own tab of the board. Absent, a path the session prints is its words. */
  readonly openFile?: (path: string) => void;
  /** The page's clock: a command the page saw start is timed on it. */
  readonly now: () => number;
  /** Called each time the running cards' times are drawn, so what reads them (the line beside cx's desk) turns with them. */
  readonly ticked?: () => void;
  /** The day a time falls on, as a seller says it. */
  readonly day: (time: number) => string;
  /** What a message carries beside its words: the quotes it was sent with, and the row under it. Without it neither is drawn. */
  /** Sends the person's answer to a dialog. Without it no dialog is drawn, since none could be answered. */
  readonly answer?: DialogPorts["answer"];
  /** Whether the platform is in reach. Out of reach, a waiting message offers only what the page can do alone. Absent, it is in reach. */
  readonly reachable?: () => boolean;
  /** Whether the page still holds a waiting message, none of its commands gone to the box: out of reach, only such a one is taken back. Absent, none is. */
  readonly holds?: (key: string) => boolean;
  /** Whether a take-back of a waiting message came too late, the box or pi having it: its ✕ is no longer drawn. Absent, none did. */
  readonly late?: (key: string) => boolean;
  /** What stands under a message the person sent, by when it was said, and a stamp that changes when it does: the chat's word on an install it waited for that failed. */
  readonly beneath?: { readonly stamp: (said: string) => string; readonly draw: (said: string) => readonly HTMLElement[] };
  readonly rows?: { readonly board?: (pairs: readonly BoardPair[]) => HTMLElement; readonly quoted: (quotes: readonly Quote[]) => HTMLElement | undefined; readonly filed: (names: readonly string[]) => HTMLElement | undefined; readonly under: (message: RowOf) => HTMLElement; readonly waiting: (message: WaitingOf) => HTMLElement };
};

/** The day the person's messages under it were sent: once per day the view holds, over the first of them. */
type DayRow = { readonly kind: "day"; readonly key: string; readonly words: string };
type Row = Item | DayRow;

const lastTextLine = (element: Element): DOMRect | undefined => {
  // From the end backwards: the walk stops at the last text with anything in it, however long the answer is.
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.lastChild();
  while (node !== null && (node.textContent ?? "").trim() === "") node = walker.previousNode();
  if (node === null) return undefined;
  const last = node as Text;
  const range = document.createRange();
  range.setStart(last, Math.max(0, last.length - 1));
  range.setEnd(last, last.length);
  const rects = range.getClientRects();
  return rects.length === 0 ? undefined : rects[rects.length - 1];
};

/** How long a place landed on keeps its mark: the power light's rhythm, as main marks a landing. */
export const REVEALED_MS = 1600;

/**
 * The focus a press that lands on a card leaves there: on its first control, so a keyboard answers a choice or a field at once, else on
 * the card. A yes/no question keeps it on the card, its 是 and 否 a Tab away, so the next key never answers one unread.
 */
export function focusFirst(element: HTMLElement): void {
  const control = element.dataset["method"] === "confirm" ? null : element.querySelector<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])");
  if (control !== null) { control.focus({ preventScroll: true }); return; }
  if (!element.hasAttribute("tabindex")) element.tabIndex = -1;
  element.focus({ preventScroll: true });
}

const lineText = (line: Line): string => line.map((span) => span.text).join("");

/** A conversation not read yet, in its own rows: a message of the person's and an answer under it, twice. */
export const streamShape = (word: string): HTMLElement => skeleton(word, ...[[12, 12, 9], [12, 7]].flatMap((answer) => [
  block(h("article", { class: "item user" }), h("div", { class: "said" }, bar("sentence"))),
  h("article", { class: "item" }, ...answer.map((width) => bar(width as 12 | 9 | 7))),
]));

/**
 * The stream drawn on pi 0.87.1's interactive mode, by the rules `chat-model.ts` holds: the person's message in its own bubble, the model's
 * text as markdown with nothing behind it, its thinking whole and inline under its label, each step a quiet card whose ground is its
 * state, named in the page's words with the call's own values, and a record pi draws as a marker that opens. What pi does not draw — a
 * model or thinking-level change, a record of a form it has no drawing for, a result without its call — is not drawn. What the person
 * opened stays open while the answer arrives.
 */
export class StreamView {
  // A file box's press is heard here, once, for every answer: a draft's words are copies of their drawing, which carry no listener of their
  // own, so the box is known by the path it names, as the page's own script knows one in a page.
  readonly element = h("div", { class: "stream", role: "log", "aria-live": "polite", onclick: (event: Event) => {
    const box = event.target instanceof Element ? event.target.closest("button.file-open[data-cx-file]") : null;
    const path = box?.getAttribute("data-cx-file");
    if (path !== null && path !== undefined) this.ports.openFile?.(path);
  } });
  /** What is drawn, by item key, in the stream's order: an earlier part put first leaves every drawn item's element as it was. */
  #rendered = new Map<string, { readonly item: Row; readonly element: HTMLElement; readonly waits: boolean; readonly now: boolean; readonly cancel: boolean; readonly moved: boolean; readonly tooLong: string | undefined; readonly onStep?: boolean; readonly cards?: string; readonly beneath?: string; readonly under?: HTMLElement | undefined }>();
  /** The day rows drawn, by day: one whose words have not changed is the same row. */
  #days = new Map<string, DayRow>();
  /** The next update keeps the reader where they are, wherever that is: a far stretch the reader read on through has met the latest. */
  #holding = false;
  /** Cards and lines the person opened, by key. */
  readonly #open = new Set<string>();
  /** When each timed call was seen to start, and to end, on the page's clock; one running across a break in the connection is lost. */
  readonly #timed = new Map<string, { readonly from: number; to: number | undefined; lost?: true }>();
  /** Calls whose arguments the page saw arriving: one first seen whole — history, or a reconnect — is not timed, as pi times none it did not see start. */
  readonly #arriving = new Set<string>();
  /** The life the three above are of: a new life's keys name none of an old one's, so they start empty. */
  #life: string | undefined;
  /** The answer being written, its pieces drawn once each: a delta parses only the piece it grows, and the rest are copies of their drawings. */
  #written = new Map<string, HTMLElement>();
  #breaks = 0;
  /** The running times drawn, brought up to date each second while any is on the page. */
  readonly #running = new Map<HTMLElement, { readonly key: string; readonly from: number }>();
  /** What each running card's 已运行 last said, as time run: the line reads it, so the two never show two numbers. */
  readonly #ran = new Map<string, number>();
  #ticker: ReturnType<typeof setInterval> | undefined;
  readonly #tail = h("div", { class: "stream-tail" });
  /** After the last item: what a package said in passing. */
  readonly #dialogs = h("div", { class: "stream-dialogs" });
  /** At the end of the conversation, above the message box: the card of what is new in the seller's plugins. */
  readonly #feature = h("div", { class: "stream-feature" });
  /** Each dialog's and notice's drawing: a card stays the one the person types into for as long as the page holds its dialog. */
  readonly #asked = new Map<Dialog | Notice, HTMLElement>();
  /** The askings whose option card's answer is on its way: a card asked again meanwhile is drawn going. */
  readonly #going = new Set<string>();
  /** What a screen reader is told when an option card leaves: said, not drawn. */
  readonly #told = h("p", { class: "oc-told", role: "status" });
  /** The answers out, kept through a reset, which draws every card anew: a card drawn while its answer goes is drawn as sending. */
  readonly #waits = new Waits(() => this.element);
  /** Above the first item: what the page says while it waits for the stream, or for the part before the one it holds. */
  readonly #top = h("div", { class: "stream-top" });
  /** Items put before the ones drawn: their loading line announced them, so their arrival is not read out as new messages. */
  readonly #before = h("div", { class: "stream-earlier", "aria-live": "off" });
  /** The view stays at the bottom as the stream's box changes height, until the person scrolls away from it. */
  #following = false;
  /** Away from the bottom, the first line in view and how far below the view's top it stood: what the view keeps where it is. */
  #first: Placed | undefined;
  /**
   * Where the view itself last left the scroll. The scroll event that comes of it a frame later reads no new place: by then the width
   * may have moved again, and the place read would carry that frame's jump.
   */
  #placed: number | undefined;
  #waiting: "stream" | "earlier" | undefined;
  /** How many messages the person had sent at the last update: one more is a message just sent. */
  #sent = 0;
  /** The next update shows the latest message, wherever the view was. */
  #latest = false;
  /** The next update draws a stretch read in place of what was drawn: loaded, as an earlier part is, not news for the log to read out. */
  #loaded = false;
  constructor(readonly ports: StreamViewPorts) {}

  /**
   * Puts the chat into `main`, before `after`, when another page had it there; the next update then shows the latest message, since a
   * person coming back to the chat reads on from its end.
   */
  show(main: HTMLElement, ...after: HTMLElement[]): void {
    const scroller = this.element.parentElement;
    if (scroller === null || scroller.parentElement === main) return;
    main.replaceChildren(scroller, ...after);
    this.#latest = true;
  }

  /**
   * Moves the page to an item of the stream, and marks it for a moment so the eye finds it. Every landing leaves the same room over what
   * it goes to: the room the conversation keeps at its edges for whatever it brings into view.
   */
  reveal(key: string): boolean {
    const held = this.#rendered.get(key);
    if (held === undefined || held.element.hidden) return false;
    // The place landed on shows its day: the day's own line, when one stands over it, opens the view.
    const own = held.element.previousElementSibling;
    this.#land((own instanceof HTMLElement && own.classList.contains("day-line") ? own : held.element).getBoundingClientRect().top);
    this.#following = false;
    held.element.classList.add("revealed");
    setTimeout(() => held.element.classList.remove("revealed"), REVEALED_MS);
    return true;
  }

  /** Brings words of an item just revealed to where a landing stands: what was quoted is what the page goes to. */
  toWords(key: string, words: Range): void {
    if (!this.#rendered.has(key)) return;
    this.#land((words.getClientRects()[0] ?? words.getBoundingClientRect()).top);
  }

  /**
   * Brings the page to a step the line beside cx's desk names — a card, a run of thinking, a question, or an answer by its item — as a
   * landing on a message does, marks it for as long, and moves the focus to its first control, or to it.
   */
  revealStep(step: string): boolean {
    const held = this.#rendered.get(step);
    const element = held !== undefined && !held.element.hidden ? held.element
      : [...this.element.querySelectorAll<HTMLElement>("[data-step]")].find((one) => one.dataset["step"] === step);
    if (element === undefined) return false;
    this.#land(element.getBoundingClientRect().top);
    this.#following = false;
    element.classList.add("revealed");
    setTimeout(() => element.classList.remove("revealed"), REVEALED_MS);
    focusFirst(element);
    return true;
  }

  /** When a command the page saw start began on its clock, while it runs: the time its card says it has run from. */
  cardFrom(key: string): number | undefined {
    const timed = this.#timed.get(key);
    return timed === undefined || timed.lost === true || timed.to !== undefined ? undefined : timed.from;
  }

  /** How long a running card's 已运行 says the command has run, as last drawn; nothing where the card shows no running time. */
  cardRan(key: string): number | undefined { return this.cardFrom(key) === undefined ? undefined : this.#ran.get(key); }

  /** Takes the mark off an item just revealed: what is marked is words in it, and one colour says one thing. */
  unmark(key: string): void { this.#rendered.get(key)?.element.classList.remove("revealed"); }

  #land(top: number): void {
    const scroller = this.element.parentElement;
    if (scroller === null) return;
    const room = Number.parseFloat(getComputedStyle(scroller).scrollPaddingTop);
    scroller.scrollTop += top - scroller.getBoundingClientRect().top - (Number.isFinite(room) ? room : 0);
  }

  /** How much of the view lies from the top of a drawn item to the end of what is drawn; nothing drawn reads as no limit. */
  below(key: string): number {
    const held = this.#rendered.get(key);
    const scroller = this.element.parentElement;
    if (held === undefined || scroller === null) return Infinity;
    return scroller.scrollHeight - (held.element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop);
  }

  /** An item's drawing, when it is drawn and shown. */
  elementOf(key: string): HTMLElement | undefined { const held = this.#rendered.get(key); return held === undefined || held.element.hidden ? undefined : held.element; }

  /** Whether an item is drawn: a place the view holds can be gone to at once. */
  holds(key: string): boolean { return this.#rendered.has(key); }

  /** The next update shows the latest message. */
  toLatest(): void { this.#latest = true; }

  /** The next update keeps what the reader sees where it is. */
  hold(): void { this.#holding = true; }

  /** The next update draws another stretch — a far one gone to, or the live view come back to — where loaded parts go. */
  loaded(): void { this.#loaded = true; }

  /** Where the reader is in the view: at its top, at its bottom, and whether the latest message is in view. */
  edges(): { readonly top: boolean; readonly bottom: boolean } {
    const scroller = this.element.parentElement;
    if (scroller === null || scroller.clientHeight === 0) return { top: false, bottom: false };
    return { top: scroller.scrollTop < 40, bottom: scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 40 };
  }

  /**
   * Whether the latest message is where the reader sees it: the box of the last item drawn and shown meets the view's. With nothing drawn,
   * or a view not laid out, nothing lies out of sight.
   */
  latestSeen(): boolean {
    const scroller = this.element.parentElement;
    if (scroller === null || scroller.clientHeight === 0) return true;
    for (const drawn of [...this.#rendered.values()].reverse()) {
      if (drawn.element.hidden || drawn.item.kind === "day") continue;
      const box = drawn.element.getBoundingClientRect(), view = scroller.getBoundingClientRect();
      return box.bottom > view.top && box.top < view.top + scroller.clientHeight;
    }
    return true;
  }

  /**
   * Where cx stands in the stream, in client px — a line's middle, its top and where its item begins: beside the last line of what pi is writing,
   * or, while that ends with the person's message, one line below it, where the answer starts. A message sent while pi works waits below
   * and moves nothing, and so does the day it is dated. Nothing while nothing is drawn.
   */
  lastLine(): { readonly y: number; readonly top: number; readonly start: number } | undefined {
    for (const drawn of [...this.#rendered.values()].reverse()) {
      if (drawn.element.hidden || drawn.item.kind === "day" || (drawn.item.kind === "user" && drawn.item.pending && drawn.item.queued === true)) continue;
      const box = drawn.element.getBoundingClientRect();
      if (drawn.item.kind === "user") {
        const line = lastTextLine(drawn.element) ?? box;
        return { y: box.bottom + (line.bottom - line.top), top: box.bottom, start: this.element.getBoundingClientRect().left };
      }
      const line = lastTextLine(drawn.element) ?? box;
      return { y: (line.top + line.bottom) / 2, top: line.top, start: box.left };
    }
    return undefined;
  }

  /** The stream's items, with the day over the first of the person's messages sent on it. */
  #rows(state: StreamState): readonly Row[] {
    const rows: Row[] = [];
    const days = new Map<string, DayRow>();
    const dayed = new Set<string>();
    for (const item of state.items) {
      if (item.kind === "user" && item.at !== undefined && !dayed.has(dayKey(item.at))) {
        const name = dayKey(item.at);
        dayed.add(name);
        const words = this.ports.day(item.at);
        const before = this.#days.get(name);
        const row = before?.words === words ? before : { kind: "day" as const, key: `day:${name}`, words };
        days.set(name, row);
        rows.push(row);
      }
      rows.push(item);
    }
    this.#days = days;
    return rows;
  }

  /**
   * Drops what was drawn, so the next update draws every item again in the page's words: the language changed. What the person opened and
   * the steps' times are the stream's, not its words, and stay.
   */
  redraw(): void { hideTipWithin(this.element); this.#rendered.clear(); this.#days.clear(); this.#asked.clear(); this.#dialogs.replaceChildren(); this.#before.replaceChildren(); this.element.replaceChildren(); }

  /** Forgets the stream as well as its drawing: the preview starts a recording over. */
  reset(): void { this.#forget(); this.redraw(); }

  /** The person scrolled, or the browser did: the view follows the bottom only while it is at it, and elsewhere keeps the line it shows first. */
  scrolled(): void {
    const scroller = this.element.parentElement;
    if (scroller === null) return;
    // The view's own placing raises a scroll a frame later, when the width may have moved again: it reads no new place.
    if (scroller.scrollTop === this.#placed) return;
    this.#read(scroller);
  }

  #read(scroller: HTMLElement): void {
    this.#following = atBottom(scroller);
    this.#first = firstIn(this.element, scroller);
    this.#placed = scroller.scrollTop;
  }

  /**
   * The stream's box changed size — a fill that arrived late, a notice under the composer, the chat made narrower or wider by the board's
   * divider, the window or the sidebar — and the view keeps its place: at the bottom it stays at the bottom, and elsewhere the first line
   * in view stays where it stood, however the lines above it wrap.
   */
  resized(): void {
    const scroller = this.element.parentElement;
    if (scroller === null) return;
    this.#keep(scroller);
    this.#mark(scroller);
  }

  /**
   * The place saved put back, unless the view moved since it was saved: a person's scroll whose event is still to come, read as theirs
   * now, so it stands; a view that reads as at the bottom, the browser's own clamp among them, stays at the bottom.
   */
  #keep(scroller: HTMLElement): void {
    const moved = scroller.scrollTop !== this.#placed;
    if (moved) this.#read(scroller);
    if (this.#following) scroller.scrollTop = scroller.scrollHeight;
    else if (moved) return;
    else if (this.#first !== undefined && this.#first.element.isConnected && this.#first.text?.node.isConnected !== false) scroller.scrollTop += topOf(this.#first) - scroller.getBoundingClientRect().top - this.#first.offset;
  }

  /**
   * The place read again where the view put it. A line of words is kept by its character until the person scrolls: read again after its
   * words wrapped anew, it would be the start of a line that now begins earlier, and each width step would carry the place back by it.
   */
  #mark(scroller: HTMLElement): void {
    if (this.#first?.text === undefined || !this.#first.text.node.isConnected) this.#first = firstIn(this.element, scroller);
    this.#placed = scroller.scrollTop;
  }

  /**
   * Draws what the stream holds. `waiting` is what the page is waiting on: the stream itself, before it has said anything, drawn as
   * the shape of an exchange, or the part before the one it holds, said above the first item. What arrives before the first item keeps the person's place. `retry`
   * is a stretch that could not be read: said where it would stand, with a way to ask again.
   */
  update(state: StreamState, waiting?: "stream" | "earlier", later = false, retry?: () => void): void {
    const scroller = this.element.parentElement;
    // A width changed since the last frame is held before the drawing moves anything: an answer arriving mid-drag does not end the hold.
    if (scroller !== null) this.#keep(scroller);
    // Read before a redraw empties the stream, which would read as pinned to the bottom wherever the person was.
    const pinned = scroller === null || this.#following || atBottom(scroller);
    // The place is held by the first message drawn, never a day line: a day line moves up to an earlier message of its day when one arrives.
    const first = [...this.#rendered.values()].find((one) => one.item.kind !== "day")?.element;
    const firstTop = first?.isConnected === true ? first.getBoundingClientRect().top : undefined;
    // A message the person just sent is shown wherever the view was; an answer arriving leaves them where they read.
    const latest = this.#latest || state.sent > this.#sent;
    this.#latest = false;
    this.#sent = state.sent;
    this.#clock(state);
    fill(this.#top, retry !== undefined ? h("p", { class: "quiet stream-failed", role: "status" }, this.ports.say("stream.stretchFailed"), " ", h("button", { type: "button", class: "link", onclick: retry }, this.ports.say("status.retry")))
      : waiting === "stream" ? streamShape(this.ports.say("stream.loading"))
      : waiting !== undefined && h("p", { class: "quiet stream-waiting", role: "status" }, this.ports.say("stream.loadingEarlier")));
    if (this.element.firstChild !== this.#top) this.element.insertBefore(this.#top, this.element.firstChild);
    if (this.#top.nextSibling !== this.#before) this.element.insertBefore(this.#before, this.#top.nextSibling);
    // Keys are the stream's own; one that came twice is still drawn twice.
    const keyed: { readonly key: string; readonly item: Row }[] = [];
    const seen = new Set<string>();
    for (const item of this.#rows(state)) {
      let key = item.key;
      for (let again = 1; seen.has(key); again++) key = `${item.key}#${again}`;
      seen.add(key);
      keyed.push({ key, item });
    }
    // What comes before the first item drawn in the log arrived as an earlier part; with none drawn there, what follows the earlier parts
    // is the log's. A stretch drawn in place of another is loaded whole.
    const inLog = keyed.findIndex(({ key }) => this.#rendered.get(key)?.element.parentNode === this.element);
    const split = this.#loaded ? keyed.length : inLog >= 0 ? inLog : keyed.findLastIndex(({ key }) => this.#rendered.get(key)?.element.parentNode === this.#before) + 1;
    this.#loaded = false;
    const waits = heldForNext(state.items);
    const moves = movedAnswers(state.items);
    const tooLongs = tooLongAnswers(state.items);
    const onSteps = stopsOnSteps(state.items);
    const drawn = new Map<string, { readonly item: Row; readonly element: HTMLElement; readonly waits: boolean; readonly now: boolean; readonly cancel: boolean; readonly moved: boolean; readonly tooLong: string | undefined; readonly onStep: boolean; readonly cards: string; readonly beneath: string; readonly under?: HTMLElement | undefined }>();
    const turn = working(state);
    const reach = this.ports.reachable?.() !== false;
    let parent: HTMLElement = this.#before;
    let next: ChildNode | null = this.#before.firstChild;
    keyed.forEach(({ key, item }, at) => {
      if (at === split) { parent = this.element; next = this.#before.nextSibling; }
      const held = this.#rendered.get(key);
      const marked = item.key === waits;
      // Send now is offered on a message waiting behind a turn that runs: it is that turn it stops, so the box must be in reach. Out of
      // reach, a message already handed to the box cannot be taken back either, answered or not; one the page still holds can.
      const now = reach && turn && item.kind === "user" && item.pending && item.queued === true;
      const cancel = this.ports.late?.(item.key) !== true && (reach || (item.kind === "user" && this.ports.holds?.(item.key) === true));
      const moved = moves.has(item.key);
      // The model's name is drawn as the page knows it, which a list read later may change.
      const tooLong = item.kind === "assistant" && item.model !== undefined && tooLongs.has(item.key) ? this.ports.modelName?.(item.model) ?? item.model.id : undefined;
      // A board card's row is drawn again as the card is read, or changes where it stands.
      const cards = this.#cardsOf(item);
      const live = item.kind === "asking" ? this.#dialogCard(state, item.id) : undefined;
      const beneath = item.kind === "user" && !item.pending ? this.ports.beneath?.stamp(item.echo ?? item.key) ?? "" : "";
      // A stop its step already says is not said again by the empty message after it.
      const onStep = onSteps.has(item.key);
      const element = live ?? (held?.item === item && held.waits === marked && held.now === now && held.cancel === cancel && held.moved === moved && held.tooLong === tooLong && held.onStep === onStep && held.cards === cards ? held.element
        : item.kind === "day" ? h("p", { class: "day-line" }, item.words) : onStep ? h("div", { class: "item", hidden: true }) : this.#draw(item, marked, now, cancel, moved, tooLong));
      if (held !== undefined && held.element !== element) {
        // What follows is placed against the drawing now in the page, not the one that left it.
        if (next === held.element) next = element;
        const keep = carried(held.element, element, "[data-rove]", ":scope > .markdown");
        hideTipWithin(held.element);
        held.element.replaceWith(element);
        keep();
      }
      if (element === next) next = element.nextSibling;
      else parent.insertBefore(element, next);
      // What the chat says under a message stands after it as a block of its own, across the column, never inside what the person wrote.
      const under = beneath === "" || item.kind !== "user" ? undefined
        : held?.beneath === beneath && held.under !== undefined ? held.under : h("div", { class: "item-under", "data-under": key }, ...(this.ports.beneath?.draw(item.echo ?? item.key) ?? []));
      if (held?.under !== undefined && held.under !== under) {
        if (next === held.under) next = held.under.nextSibling;
        held.under.remove();
      }
      if (under !== undefined) {
        if (under === next) next = under.nextSibling;
        else parent.insertBefore(under, next);
      }
      drawn.set(key, { item, element, waits: marked, now, cancel, moved, tooLong, onStep, cards, beneath, under });
    });
    for (const [key, held] of this.#rendered) {
      if (drawn.get(key)?.element !== held.element) { hideTipWithin(held.element); held.element.remove(); }
      if (held.under !== undefined && drawn.get(key)?.under !== held.under) held.under.remove();
    }
    this.#rendered = drawn;
    // pi writing the summary is said on the line beside cx's desk alone: the conversation draws no line of its own for it.
    fill(this.#tail, later ? h("p", { class: "quiet stream-later", role: "status" }, this.ports.say("stream.loadingLater")) : undefined);
    this.element.append(this.#tail);
    this.#drawAsked(state);
    this.#tick();
    const holding = this.#holding;
    this.#holding = false;
    // A held place is the reader's own, in the middle of the conversation: the view no longer follows the bottom, so nothing that resizes
    // it later carries them to the latest message.
    if (holding && !latest && scroller !== null && first !== undefined && firstTop !== undefined && first.isConnected) { scroller.scrollTop += first.getBoundingClientRect().top - firstTop; this.#following = false; }
    else if ((pinned || latest) && scroller !== null) { scroller.scrollTop = scroller.scrollHeight; this.#following = true; }
    // The part before arrived above what the person was reading: that stays where it was on the screen. The line saying it is on its way
    // moves what is below it down instead.
    else if (scroller !== null && first !== undefined && firstTop !== undefined && first.isConnected && [...drawn.values()].find((one) => one.item.kind !== "day")?.element !== first) scroller.scrollTop += first.getBoundingClientRect().top - firstTop;
    // The line that says what follows is on its way is wholly in view as it appears.
    if (later && scroller !== null) this.#tail.scrollIntoView({ block: "nearest" });
    // The line that says the part before is on its way is in view as it appears, however the person reached the top: a key's scroll
    // glides, and the read starts before it ends.
    if (waiting === "earlier" && this.#waiting !== "earlier" && scroller !== null) {
      const above = this.#top.getBoundingClientRect().top - this.element.getBoundingClientRect().top;
      if (above < scroller.scrollTop) scroller.scrollTop = above;
    }
    this.#waiting = waiting;
    // Where this drawing left the view is the place kept from now on.
    if (scroller !== null) this.#mark(scroller);
  }

  /** The card of a dialog pi waits on, the one already drawn if there is one; none on a page that could not answer it. */
  #dialogCard(state: StreamState, id: string): HTMLElement | undefined {
    const answer = this.ports.answer;
    const one = answer === undefined ? undefined : state.dialogs.find((dialog) => dialog.id === id);
    if (one === undefined) return undefined;
    // A `confirm` pi waits on is the one yes-or-no card, as a proposal is; it holds cx, so it stands at its place in the conversation.
    const element = this.#asked.get(one) ?? (one.method === "confirm"
      ? confirmCard({ id: one.id, title: one.title, ...(one.message === "" ? {} : { message: one.message }) }, { say: this.ports.say, answer: answer!, going: new Set(), told: (words) => { this.#told.textContent = words; }, mac: MAC })
      : dialogCard(one, { say: this.ports.say, answer: answer!, waits: this.#waits }));
    element.dataset["step"] = `dialog:${one.id}`;
    this.#asked.set(one, element);
    return element;
  }

  /**
   * A drawing that is already where it belongs is left alone: one put in again would lose the focus and the caret the person holds in it.
   * A dialog's card stands at its place in the conversation; what a package said in passing stands after the last item.
   */
  #drawAsked(state: StreamState): void {
    const answer = this.ports.answer;
    const held = [...(answer === undefined ? [] : state.dialogs), ...state.notices];
    for (const [one, element] of this.#asked) if (!held.includes(one)) { element.remove(); this.#asked.delete(one); if (one.method !== "notify") this.#waits.release(`dialog ${one.id}`); }
    const asks = new Set(state.dialogs.filter(isOptionCard).map((one) => one.form.ask));
    for (const ask of this.#going) if (!asks.has(ask)) this.#going.delete(ask);
    // The option cards stand under the newest output, in the order asked, and what a package said in passing after them.
    const options = answer === undefined ? [] : state.dialogs.filter(isOptionCard);
    [...options, ...state.notices].forEach((one, at) => {
      const told = (words: string): void => { this.#told.textContent = words; };
      const element = this.#asked.get(one) ?? (one.method === "notify" ? noticeLine(one, NOTICE_MS)
        : one.form.form === CONFIRM_FORM ? confirmCard({ id: one.id, title: one.form.title, ask: one.form.ask, ...(one.form.message === undefined ? {} : { message: one.form.message }) }, { say: this.ports.say, answer: answer!, going: this.#going, told, mac: MAC })
        : optionCard(one as Parameters<typeof optionCard>[0], { say: this.ports.say, answer: answer!, going: this.#going, told, mac: MAC, account: () => this.ports.account?.() }));
      this.#asked.set(one, element);
      if (this.#dialogs.children[at] !== element) this.#dialogs.insertBefore(element, this.#dialogs.children[at] ?? null);
    });
    if (this.#feature.nextSibling !== this.#tail) this.element.insertBefore(this.#feature, this.#tail);
    if (this.#told.nextSibling !== this.#feature) this.element.insertBefore(this.#told, this.#feature);
    if (this.#dialogs.nextSibling !== this.#told) this.element.insertBefore(this.#dialogs, this.#told);
  }

  /** The feature card's place, after every dialog: one drawing at a time, or none. */
  feature(element: HTMLElement | undefined): void {
    if (element === undefined) { this.#feature.replaceChildren(); return; }
    if (this.#feature.firstChild !== element) this.#feature.replaceChildren(element);
  }

  /**
   * A command is timed from the moment its arguments are whole to its result, as pi times a run it saw start and end: only one whose
   * arguments the page saw arrive, and whose end it heard live — one still running when the connection broke loses its time.
   */
  #clock(state: StreamState): void {
    if (state.epoch !== this.#life) { this.#forget(); this.#life = state.epoch; }
    const now = this.ports.now();
    if (state.breaks !== this.#breaks) {
      this.#breaks = state.breaks;
      for (const timed of this.#timed.values()) if (timed.to === undefined) timed.lost = true;
    }
    for (const item of state.items) {
      if (item.kind !== "assistant") continue;
      const unran = !item.draft && (item.stopReason === "aborted" || item.stopReason === "error");
      item.blocks.forEach((block: Block, at) => {
        if (block.kind !== "tool_call") return;
        if (block.id === "") { if (item.draft) this.#arriving.add(`${item.key}:${at}`); return; }
        const key = `tool:${block.id}`;
        if (block.name === "bash" && item.draft && block.result === undefined && this.#arriving.has(`${item.key}:${at}`) && !this.#timed.has(key)) this.#timed.set(key, { from: now, to: undefined });
        const timed = this.#timed.get(key);
        if (timed !== undefined && timed.to === undefined && (block.result !== undefined || unran)) timed.to = now;
      });
    }
  }

  #forget(): void { this.#open.clear(); this.#timed.clear(); this.#arriving.clear(); this.#written.clear(); }

  #time(ms: number, done: boolean): string {
    const { line, time } = stepTime(ms, done);
    return this.ports.say(line, time === undefined ? undefined : { time: this.#say(time) });
  }

  /** The running times move on each second, their text alone: nothing else of a card is drawn again. */
  #tick(): void {
    for (const element of [...this.#running.keys()]) if (!element.isConnected) this.#running.delete(element);
    const running = new Set([...this.#running.values()].map((one) => one.key));
    for (const key of [...this.#ran.keys()]) if (!running.has(key)) this.#ran.delete(key);
    this.ports.ticked?.();
    if (this.#running.size === 0) { clearInterval(this.#ticker); this.#ticker = undefined; return; }
    this.#ticker ??= setInterval(() => {
      const now = this.ports.now();
      for (const [element, { key, from }] of this.#running) { element.textContent = this.#time(now - from, false); this.#ran.set(key, now - from); }
      this.#tick();
    }, 1000);
  }

  /** A path the session prints, as main's file box whose press shows the file on the board, where the board can. */
  get #link(): PathLink | undefined { return this.ports.openFile === undefined ? undefined : (path) => fileBox(path, this.ports.say); }

  /** Between a question's answers in its row: 、 in Chinese, a comma in English. */
  #joiner(): string { return this.ports.language?.() === "en" ? ", " : "、"; }

  #say(words: Words): string { return "key" in words ? this.ports.say(words.key, words.values) : words.text; }

  /** An item's drawing, or an empty place where pi draws nothing, so every item keeps its place in the stream. */
  #draw(item: Item, waits = false, now = false, cancel = true, moved = false, tooLong?: string): HTMLElement { return this.#item(item, waits, now, cancel, moved, tooLong) ?? h("div", { class: "item", hidden: true }); }

  #item(item: Item, waits: boolean, now: boolean, cancel: boolean, moved: boolean, tooLong: string | undefined): HTMLElement | undefined {
    if (item.kind === "user") return this.#user(item, waits, now, cancel);
    // pi draws a tool's result on its call's card, and one whose call is not held is drawn by nobody.
    if (item.kind === "tool_result") return undefined;
    if (item.kind === "assistant") return this.#answer(item, moved, tooLong);
    if (item.kind === "asked" && item.form !== undefined) return h("article", { class: "item asked", "data-key": item.key }, formRows(item.form, item.answer, this.ports.say, this.#joiner()));
    if (item.kind === "asked" && item.method === "confirm") return h("article", { class: "item asked", "data-key": item.key }, confirmRows(item.title, item.answer, this.ports.say));
    if (item.kind === "asked") return h("article", { class: "item asked", "data-key": item.key }, askedRecord(item, this.ports.say));
    // A question pi waits on is drawn at its place by its card, which `update` puts there.
    if (item.kind === "asking") return undefined;
    // An answered option card's record, as its package wrote it: the rows the card left.
    const options = item.form === "custom_message" ? readOptionRecord(item.body["options"]) : undefined;
    if (options !== undefined) return h("article", { class: "item asked", "data-key": item.key }, recordRows(options, this.ports.say, this.#joiner()));
    const drawn = note(item.form, item.body);
    if (drawn === undefined) return undefined;
    if (drawn.kind === "summary") return h("article", { class: "item" }, this.#marker(item.key, this.ports.say(drawn.title), drawn.markdown));
    if (drawn.kind === "message") return h("article", { class: "item" }, this.#marker(item.key, drawn.head, drawn.markdown));
    if (drawn.kind === "moved") {
      const key = drawn.to === undefined ? `stream.stopped.${drawn.from.way}` as Exclude<`stream.stopped.${Way}`, "stream.stopped.platform">
        : `stream.moved.${drawn.from.way}.${drawn.to.way}` as Exclude<`stream.moved.${Way}.${Way}`, "stream.moved.platform.platform">;
      return h("article", { class: "item" }, h("p", { class: "quiet moved" }, this.ports.say(key, { from: doorName(drawn.from, this.ports.say, this.ports.makers?.() ?? {}), to: drawn.to === undefined ? "" : doorName(drawn.to, this.ports.say, this.ports.makers?.() ?? {}) })));
    }
    // The person's own command, which pi runs outside the model's turn: ruled above and below, its last lines, how it ended.
    const shell = h("div", { class: "shell" });
    const again = (): void => {
      shell.replaceChildren(
        this.#head({ key: "step.run", values: {} }, [], []),
        ...this.#fold(item.key, again, drawn.body, drawn.command),
        ...(drawn.status === undefined ? [] : [h("p", { class: "status-line" }, h("span", { class: `t-${drawn.status.tone}` }, this.#say(drawn.status.words)))]));
    };
    again();
    return h("article", { class: "item" }, shell);
  }

  /**
   * A message the person sent: the quotes it carries stacked over its own words, and under it its row once pi has recorded it. Until
   * then cx has not read it: it is drawn dim, and under it are the ways to take it back or have it read now. One a Stop left recorded
   * and unanswered says, under it, that cx reads it with the next.
   */
  #user(item: Extract<Item, { kind: "user" }>, waits: boolean, now: boolean, cancel: boolean): HTMLElement | undefined {
    const rows = this.ports.rows;
    // A message a board's page sent is drawn as its words alone: the marker naming its board is never drawn.
    const from = readFromBoard(item.text);
    const sent = from?.text ?? item.text;
    // An answer a page sent from a card stands under that card's row, as a quote stands over the words it is answered with.
    const answered = from?.card === undefined ? undefined : { tab: from.board, file: from.card };
    const cardRow = answered === undefined ? undefined : this.ports.card?.(answered);
    const pairs = rows?.board === undefined ? undefined : readBoardMessage(sent);
    if (pairs !== undefined) {
      // A message the board once sent is named by its sentences, as a screen reader needs a name for its row.
      const words = pairs.map((pair) => pair.said).join("\n");
      const row = item.pending ? rows!.waiting({ key: item.key, now, cancel, words: () => words }) : rows!.under({ who: "you", key: item.key, entryId: item.entryId, time: item.at, words: () => words, first: false });
      return h("article", { class: item.pending ? "item user waiting" : "item user", "data-key": item.key },
        h("div", { class: "said" }, rows!.board!(pairs)), row,
        waits && h("p", { class: "quiet held-next" }, this.ports.say("stream.readsWithNext")));
    }
    const { quotes, files, text } = unquoted(sent);
    const message = said(text);
    const refs = this.ports.rows?.quoted(quotes);
    const filed = this.ports.rows?.filed(files);
    if (message.skill === undefined && message.text === undefined && refs === undefined && filed === undefined) return undefined;
    const words = message.text ?? "";
    // A message of quotes alone is named by its first quote's words, as a screen reader needs a name for its row.
    const row = item.pending ? this.ports.rows?.waiting({ key: item.key, now, cancel, words: () => (words === "" ? quotes[0]?.words ?? "" : words) })
      : words === "" ? undefined : this.ports.rows?.under({ who: "you", key: item.key, entryId: item.entryId, time: item.at, words: () => words, first: refs === undefined && filed === undefined });
    // An answer to a card that asked with options stands as its question and answer rows alone, as an option card answered in the chat
    // leaves them: the card's own row, where cx wrote it, says it is answered. One still waiting keeps the row that can take it back.
    // The rows are the saved answer's, so they stand only for the message whose words the card saved as its answer; any other answer that
    // names the card, an earlier one or one to a form since replaced, stands as its own words.
    const sentHere = cardRow?.answer !== undefined && from !== undefined && cardRow.answer.trim() === from.text.trim();
    const rowsOf = sentHere && cardRow?.asked !== undefined && cardRow.answered !== undefined && cardRow.state === "answered" ? this.#answeredRows(cardRow.asked, cardRow.answered) : undefined;
    if (rowsOf !== undefined) {
      return h("article", { class: item.pending ? "item asked waiting" : "item asked", "data-key": item.key }, rowsOf, item.pending && row,
        waits && h("p", { class: "quiet held-next" }, this.ports.say("stream.readsWithNext")));
    }
    return h("article", { class: item.pending ? "item user waiting" : "item user", "data-key": item.key },
      cardRow !== undefined && this.#cardRow(answered!, cardRow),
      refs,
      message.skill !== undefined && this.#marker(`${item.key}:skill`, this.ports.say("stream.skill", { name: message.skill.name }), message.skill.content),
      filed,
      message.text !== undefined && h("div", { class: "said" }, renderMarkdown(message.text, this.#link)),
      row,
      waits && h("p", { class: "quiet held-next" }, this.ports.say("stream.readsWithNext")));
  }

  /** A marker for a record pi draws — a summary, a skill read in, a package's notice — whose words open what it holds; a head that held the focus keeps it across the press. */
  #marker(key: string, title: string, markdown: string): HTMLElement {
    const open = this.#open.has(key);
    const head = h("button", { type: "button", class: "note-head", "aria-expanded": String(open), onclick: () => {
      const held = head.ownerDocument.activeElement === head;
      this.#flip(key);
      const next = this.#marker(key, title, markdown);
      card.replaceWith(next);
      if (held) (next.firstElementChild as HTMLElement).focus({ preventScroll: true });
    } }, title);
    const card: HTMLElement = h("div", { class: "note" }, head, open && renderMarkdown(markdown, this.#link));
    return card;
  }

  #flip(key: string): void { if (this.#open.has(key)) this.#open.delete(key); else this.#open.add(key); }

  /** One message as pi draws it: its text and thinking in order, where it stopped (a stop the person made apart from an error), then its steps' cards. */
  #answer(item: Extract<Item, { kind: "assistant" }>, moved: boolean, tooLong: string | undefined): HTMLElement | undefined {
    const drawn = answer(item, moved, tooLong);
    if (drawn.pieces.length === 0 && drawn.stop.length === 0 && drawn.tools.length === 0) return undefined;
    const article = h("article", { class: item.draft ? "item assistant draft" : "item assistant", "data-key": item.key });
    // Thinking is the model's own words, drawn whole where it came, as pi draws it by default: the page shortens none of what the model said.
    // Each run opens with its name, so what sets it apart from the answer is said in words.
    const texts: HTMLElement[] = [];
    const written = new Map<string, HTMLElement>();
    const markdown = (source: string): HTMLElement => {
      if (!item.draft) return renderMarkdown(source, this.#link);
      const drawing = this.#written.get(source) ?? renderMarkdown(source, this.#link);
      written.set(source, drawing);
      return drawing.cloneNode(true) as HTMLElement;
    };
    let thought = 0;
    for (const piece of drawn.pieces) article.append(piece.kind === "text" ? texts[texts.push(markdown(piece.markdown)) - 1]! : h("div", { class: "thinking", "data-step": `${item.key}:thinking:${thought++}` }, h("span", { class: "thinking-label" }, this.#say({ key: "stream.thinking" })), markdown(piece.markdown)));
    if (item.draft) this.#written = written;
    const stopClass = drawn.stopped ? "stop stopped" : "stop";
    // A stop the person made is the step's stop tag, standing alone on its line; a failure is said in words.
    if (drawn.stop.length > 0) article.append(h("div", { class: stopClass }, ...drawn.stop.map((words) => (drawn.stopped && "key" in words && words.key === "stream.cancelled" ? this.#tag("stopped", "stream.cancelled") : h("p", "quiet" in words ? { class: "quiet" } : {}, this.#say(words))))));
    if (drawn.tooLong) article.append(...this.#tooLongWays(item));
    for (const card of drawn.tools) {
      article.append(this.#card(card));
      // The cards a step's own calls wrote, each its row under the step once read: each write's own record says it was written,
      // whatever the step did after it.
      for (const made of card.cards ?? []) {
        const row = this.ports.card?.(made);
        if (row !== undefined) article.append(h("div", { class: "told", "data-step": `${card.key}:${made.tab}/${made.file}` }, this.#cardRow(made, row)));
      }
    }
    // The row stands under the words that end an answer: a message that goes on to a step, or is still being written, has none.
    if (!item.draft && texts.length > 0 && drawn.tools.length === 0 && this.ports.rows !== undefined) {
      article.append(this.ports.rows.under({ who: "cx", key: item.key, entryId: item.entryId, time: item.at, words: () => texts.map((one) => one.innerText ?? one.textContent ?? "").join("\n\n").trim(), first: true }));
    }
    return article;
  }

  /** Under a turn refused for its length: the way out, then the vendor's words, folded for whoever helps. A fold keeps its place across drawings. */
  #tooLongWays(item: Extract<Item, { kind: "assistant" }>): readonly HTMLElement[] {
    const choose = this.ports.chooseModel;
    const ways = choose === undefined ? [] : [h("div", { class: "stop-ways" }, h("button", { type: "button", class: "f-btn", onclick: () => choose() }, this.ports.say("model.choose")))];
    if (!item.errorMessage) return ways;
    const key = `${item.key}:refused`;
    const words = (open: boolean): string => this.ports.say(open ? "stream.hideDetails" : "stream.showDetails");
    const raw = h("pre", { class: "stop-raw", hidden: !this.#open.has(key) }, item.errorMessage);
    const fold = h("button", { type: "button", class: "fold", "aria-expanded": String(this.#open.has(key)), onclick: () => {
      this.#flip(key);
      const open = this.#open.has(key);
      raw.hidden = !open;
      fold.setAttribute("aria-expanded", String(open));
      fold.textContent = words(open);
    } }, words(this.#open.has(key)));
    return [...ways, fold, raw];
  }

  /**
   * A step's card: its ground is its state; its header names the step in the page's words with the call's own values and settings, and
   * says when it buys or failed; then its command, whole, and what it returned, shut to pi's preview until opened. Only a step that
   * succeeded links the files it names.
   */
  #card(card: ToolCard): HTMLElement {
    // A card cx wrote on a board is drawn as the card's row, once read: its title and where it stands, a press that shows it there.
    const row = card.card === undefined || card.state !== "success" ? undefined : this.ports.card?.(card.card);
    if (row !== undefined) return h("div", { class: "told", "data-step": card.key }, this.#cardRow(card.card!, row));
    const open = this.#open.has(card.key);
    const holder = h("div", { class: `tool ${card.state}`, "data-step": card.key },
      this.#head(open ? card.name : card.shutName ?? card.name, card.settings, [card.failed && this.#tag("failed", "stream.failed"), card.state === "stopped" && this.#tag("stopped", "stream.cancelled")]));
    // A card drawn again by its own press reads the time afresh: what reads its clock is told, so the two never show two numbers.
    const again = (): void => { holder.replaceWith(this.#card(card)); if (this.#ran.has(card.key)) this.ports.ticked?.(); };
    // A step whose head is a tool's code name is its head alone until pressed: its arguments and its output are the code's words, not the
    // seller's. Opened, it shows both whole, as before.
    if ("text" in card.name && card.json !== undefined) {
      if (open) holder.append(h("pre", { class: "args" }, card.json), ...this.#fold(card.key, again, card.body === undefined ? undefined : { ...card.body, keep: card.body.lines.length }, card.command));
      holder.append(this.#toggle(card.key, again, open ? this.ports.say("stream.showLess") : this.#opens("stream.showLines", card.json.split("\n").length + (card.body?.lines.length ?? 0))));
    } else holder.append(...this.#fold(card.key, again, card.body, card.command));
    // A stopped step says so in its head, never as a last line of its output.
    if (card.note !== undefined && card.state !== "stopped") holder.append(h("pre", { class: "t-error" }, this.#say(card.note)));
    const timed = card.timed ? this.#timed.get(card.key) : undefined;
    if (timed !== undefined && timed.lost !== true) {
      const ran = (timed.to ?? this.ports.now()) - timed.from;
      const time = h("p", { class: "timing" }, this.#time(ran, timed.to !== undefined));
      if (timed.to === undefined) { this.#running.set(time, { key: card.key, from: timed.from }); this.#ran.set(card.key, ran); }
      holder.append(time);
    }
    return holder;
  }

  /** A board card's row: the board's mark, its title and where it stands; its press shows the board at it. */
  #cardRow(card: BoardCard, row: CardRow): HTMLElement {
    const many = row.state === "toAnswer" && row.asked?.form === OPTION_FORM && row.asked.questions.length > 1 ? row.asked.questions.length : undefined;
    const state = many === undefined ? this.ports.say(CARD_STATES[row.state]) : this.ports.say("board.toAnswerMany", { n: String(many) });
    return h("button", { type: "button", class: "told-card", "aria-label": this.ports.say("board.toldOpen", { title: row.title, state }), onclick: () => this.ports.openCard?.(card) },
      boardIcon(), h("span", { class: "told-title", dir: "auto" }, row.title), row.level !== undefined && levelMark(row.level), h("span", { class: "told-state" }, state));
  }

  /** What an answered card that asked with options leaves under its row: a question a row, its answer under it, as an option card does. */
  #answeredRows(asked: CardAsked, answered: CardAnswered): HTMLElement {
    if (asked.form === CONFIRM_FORM) return optionRows([{ words: asked.title }], ["confirmed" in answered ? { chosen: [this.ports.say(answered.confirmed ? "dialog.yes" : "dialog.no")] } : null], this.ports.say, "");
    return optionRows(asked.questions, "answers" in answered ? answered.answers : [], this.ports.say, this.#joiner());
  }

  /** The rows an item draws for board cards, as they stand now: the card a page's answer names, and the cards cx's steps wrote. */
  #cardsOf(item: Row): string {
    const read = this.ports.card;
    if (read === undefined) return "";
    const named: BoardCard[] = [];
    if (item.kind === "user") { const from = readFromBoard(item.text); if (from?.card !== undefined) named.push({ tab: from.board, file: from.card }); }
    if (item.kind === "assistant") for (const block of item.blocks) {
      const path = block.kind === "tool_call" && block.name === "write" && block.args !== undefined ? block.args["file_path"] ?? block.args["path"] : undefined;
      const card = typeof path === "string" ? boardCard(path) : undefined;
      if (card !== undefined) named.push(card);
      if (block.kind === "tool_call") for (const one of block.nested ?? []) {
        const made = one.name === "write" && one.ok === true && one.path !== undefined ? boardCard(one.path) : undefined;
        if (made !== undefined) named.push(made);
      }
    }
    return named.map((card) => { const row = read(card); return row === undefined ? "" : `${row.state}\u0000${row.title}\u0000${row.level ?? ""}`; }).join("\u0001");
  }

  #head(name: Name, settings: readonly Words[], tags: readonly (HTMLElement | false)[]): HTMLElement {
    return h("div", { class: "head" },
      h("span", { class: "step" }, ...this.#name(name), ...settings.map((words) => h("span", { class: "setting" }, this.ports.say("step.setting", { setting: this.#say(words) })))),
      ...tags);
  }

  #tag(kind: "failed" | "stopped", key: StringKey): HTMLElement { return h("span", { class: `f-tag ${kind}` }, this.ports.say(key)); }

  /** A step's name in the page's words, each value in it as the call wrote it. */
  #name(name: Name): readonly (Node | string)[] {
    if ("text" in name) return [name.text];
    const values = Object.values(name.values);
    const marks = Object.fromEntries(Object.keys(name.values).map((at, n) => [at, `\u0000${n}\u0000`]));
    return this.ports.say(name.key, marks).split("\u0000").flatMap((part, at): (Node | string)[] => {
      if (at % 2 === 0) return part === "" ? [] : [part];
      return [values[Number(part)]!.text];
    });
  }

  /** The press that opens a step's lines, its count said with the key's own line for one. */
  #opens(key: "stream.showLines" | "stream.earlierLines" | "stream.moreLines", count: number): string {
    return count === 1 ? this.ports.say(`${key}One`) : this.ports.say(key, { count });
  }

  /**
   * A card's command, whole, as pi writes it, then pi's preview of what the step returned, with the control that opens the rest — or, open,
   * the way back — where pi writes its hint: above the lines when the rest are earlier ones, below them otherwise. A file's text in
   * Markdown is drawn as an answer is.
   */
  #fold(key: string, again: () => void, fold: Fold | undefined, command: readonly string[] = []): readonly HTMLElement[] {
    const open = this.#open.has(key);
    const output = fold === undefined ? undefined : shown(fold, open);
    const hidden = output?.hidden ?? 0;
    const earlier = fold?.hint === "earlier";
    // A fold that shows no line has no rest to offer: it offers its lines.
    const none = (output?.lines.length ?? 0) === 0;
    const words = open ? this.ports.say("stream.showLess") : this.#opens(none ? "stream.showLines" : earlier ? "stream.earlierLines" : "stream.moreLines", hidden);
    const toggle: HTMLElement | undefined = hidden === 0 ? undefined : this.#toggle(key, again, words);
    const said: HTMLElement | undefined = command.length === 0 ? undefined : h("pre", { class: "command" }, command.join("\n"));
    const body: HTMLElement | undefined = output === undefined || output.lines.length === 0 ? undefined
      : fold?.markdown === true ? h("div", { class: "written" }, renderMarkdown(output.lines.map(lineText).join("\n"), undefined))
      : h("pre", { class: "lines" }, ...this.#lines(output.lines));
    return [said, earlier ? toggle : undefined, body, earlier ? undefined : toggle].filter((element): element is HTMLElement => element !== undefined);
  }

  #toggle(key: string, again: () => void, words: string): HTMLElement { return h("button", { type: "button", class: "more", "aria-expanded": String(this.#open.has(key)), onclick: () => { this.#flip(key); again(); } }, words); }

  #lines(lines: readonly Line[]): readonly (Node | string)[] {
    return lines.flatMap((line, at) => [...(at === 0 ? [] : ["\n"]), ...line.map((span) => this.#span(span))]);
  }

  #span(span: Span): HTMLElement { return h(span.mark === true ? "mark" : "span", { class: `t-${span.tone}` }, span.text); }
}

/** A place in the stream: an element, or inside one whose own words the view's top cuts, the first character of a line of them. */
type Placed = { readonly element: Element; readonly offset: number; readonly text?: { readonly node: Text; readonly at: number } };

const topOf = (placed: Placed): number => placed.text === undefined ? placed.element.getBoundingClientRect().top : charTop(placed.text.node, placed.text.at);

function charTop(node: Text, at: number): number {
  const range = node.ownerDocument.createRange();
  range.setStart(node, at);
  range.setEnd(node, at + 1);
  return range.getBoundingClientRect().top;
}

/**
 * The first line in view: the first element that starts at the view's top or below it, looked for inside whatever the top cuts through;
 * where the top cuts an element that holds words of its own, the first line of them wholly in view; else the innermost element cut. One
 * whose words have no line left wholly in view, or with nothing in it to read (a rule), is passed over for what follows it; one met below
 * the top is kept by its first line of words where it has them, and an element whose contents are all passed over is passed over in turn,
 * the search going on in reading order to what follows it, the next message.
 */
function firstIn(stream: HTMLElement, scroller: HTMLElement): Placed | undefined {
  const top = scroller.getBoundingClientRect().top;
  let within: Element = stream;
  // Where what the top cut had nothing left to read, the search goes on among what follows it.
  let after: Element | undefined;
  for (;;) {
    if (within !== stream && after === undefined) {
      const line = lineIn(within, top);
      if (line !== undefined) return { element: within, offset: charTop(line.node, line.at) - top, text: line };
    }
    const children = [...within.children];
    const cut = children.slice(after === undefined ? 0 : children.indexOf(after) + 1).find((one) => { const box = one.getBoundingClientRect(); return box.height > 0 && box.bottom > top && !blank(one) && (box.top >= top || !hasWords(one) || lineIn(one, top) !== undefined); });
    if (cut === undefined) {
      if (within === stream) return undefined;
      // An element with nothing in it to look for (a picture) is kept by its top; one whose contents were all passed over is passed over.
      if (after === undefined && within.children.length === 0) return { element: within, offset: within.getBoundingClientRect().top - top };
      after = within;
      within = within.parentElement ?? stream;
      continue;
    }
    after = undefined;
    const box = cut.getBoundingClientRect();
    if (box.top >= top) {
      const line = lineIn(cut, top);
      return line === undefined ? { element: cut, offset: box.top - top } : { element: cut, offset: charTop(line.node, line.at) - top, text: line };
    }
    within = cut;
  }
}

const blank = (one: Element): boolean => one.children.length === 0 && one.tagName !== "IMG" && (one.textContent ?? "").trim() === "";

const hasWords = (block: Element): boolean => [...block.childNodes].some((one) => one.nodeType === 3 && (one.textContent ?? "").trim() !== "");

/** In an element with words of its own, the first character at or below `top`: a character's top only grows along the text. */
function lineIn(block: Element, top: number): { readonly node: Text; readonly at: number } | undefined {
  if (!hasWords(block)) return undefined;
  const walk = block.ownerDocument.createTreeWalker(block, 4);
  for (let node = walk.nextNode() as Text | null; node !== null; node = walk.nextNode() as Text | null) {
    const length = node.data.length;
    if (node.data.trim() === "" || charTop(node, length - 1) < top) continue;
    let low = 0, high = length - 1;
    while (low < high) { const mid = (low + high) >> 1; if (charTop(node, mid) >= top) high = mid; else low = mid + 1; }
    return { node, at: low };
  }
  return undefined;
}

/** Near enough the bottom to count as reading the latest. */
const atBottom = (scroller: HTMLElement): boolean => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
