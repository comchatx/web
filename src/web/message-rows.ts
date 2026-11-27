import { writtenAt, type BoardPair } from "./board-message.js";
import { SEND_MARK } from "../shared/message-box.js";
import { h, svg } from "./dom.js";
import { redrawTip, tip } from "./forms.js";
import { ignoreHeld, twice } from "./press.js";
import { opening, type Held, type Quote } from "./quote.js";
import type { StringKey } from "./strings.js";

type Say = (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;

export type MessageRowsPorts = {
  readonly say: Say;
  /** The time of day a message was said, as its row shows it. */
  readonly clock: (time: number) => string;
  /** The same moment in full, as the time's word over it says it. */
  readonly fullDate: (time: number) => string;
  /** The day and time a quote's words were said; nothing for a message the page does not hold. */
  readonly said: (quote: Quote) => Said | undefined;
  /** The same for a message the page does not hold, read from where it is stored; nothing when it cannot be read. */
  readonly saidFar: (quote: Quote) => Promise<Said | undefined>;
  /** A message took a line more after it was drawn. */
  readonly grew: () => void;
  /** The person quoted a message of theirs: it joins the quotes in the message box. */
  readonly quote: (quote: Held) => void;
  /** The person pressed a quote in a sent message: the page goes to where it was said. */
  readonly jump: (quote: Quote) => void;
  readonly copy: (words: string) => void;
  /** The person takes back a message cx has not read, to write it again. */
  readonly cancel: (key: string) => void;
  /** The person has cx read what waits now, in place of what it is doing. */
  readonly sendNow: () => void;
  /** Words for a screen reader alone, said once. */
  readonly announce: (words: string) => void;
  readonly later: (ms: number, then: () => void) => void;
};

/** When a quote's words were said, as words. */
export type Said = { readonly when: string | undefined };

/** A message as its row needs it: whose it is, its place and pi's id once it has landed, when it was said, and its words as the reader sees them. */
export type RowOf = { readonly who: "you" | "cx"; readonly key: string; readonly entryId: string | undefined; readonly time: number | undefined; readonly words: () => string; readonly first: boolean };
/** A message cx has not read, as the controls under it need it: its place, whether a turn runs that Send now would stop, and its words as the reader sees them. */
export type WaitingOf = { readonly key: string; readonly now: boolean; readonly cancel: boolean; readonly words: () => string };

const COPIED_MS = 1500;
/** How long after a message is taken back a press on a waiting message's controls is the same hand still pressing. */
const TAKEN_BACK_MS = 400;

const icon = (...paths: readonly string[]): SVGElement => svg("svg", { class: "icon", viewBox: "0 0 24 24", "aria-hidden": "true" }, ...paths.map((d) => svg("path", { d })));
/** Quote is an opening quotation mark, drawn with its word wherever it stands. */
export const quoteIcon = (): SVGElement => icon("M10 6.5C7 7.5 5 9.8 5 13v4.5h5V13H7.2", "M19 6.5c-3 1-5 3.3-5 6.5v4.5h5V13h-2.8");
const copyIcon = (): SVGElement => icon("M9 9h10v11H9z", "M5 15V4h10");
const doneIcon = (): SVGElement => icon("M5 12.5l4.5 4.5L19 7.5");
const cancelIcon = (): SVGElement => icon("M6.5 6.5l11 11", "M17.5 6.5l-11 11");
/** Add files is a plus. */
export const addIcon = (): SVGElement => icon("M12 5v14", "M5 12h14");
/** One mark for every kind of file: the page keeps no list of kinds. */
export const fileIcon = (): SVGElement => icon("M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z", "M14 3v4h4");
export const retryIcon = (): SVGElement => icon("M20.8 5.6v4.8H16", "M18.8 14.4a7.2 7.2 0 1 1-1.7-7.49L20.8 10.4");
/** Send now is an arrow rising to a bar: the message goes to the head of the line. */
const sendNowIcon = (): SVGElement => icon("M6 4.5h12", "M12 20V9", "M7.5 13.5L12 9l4.5 4.5");
/**
 * Send is the return key's arrow. Stop is a square in a ring, both the mark's own: the control it stands in has the theme's control
 * radius and is no circle. The square is filled and its side is over a third of the mark's, so it reads as a square in its ring and not
 * as a dot.
 */
export const sendIcon = (): SVGElement => icon(...SEND_MARK);
export const stopIcon = (): SVGElement => {
  const mark = icon("M12 2.5a9.5 9.5 0 1 0 0 19a9.5 9.5 0 1 0 0-19z", "M8 8h8v8h-8z");
  mark.lastElementChild!.setAttribute("class", "solid");
  return mark;
};

/** The controls of one message — its sent quotes and its row — are one Tab stop: the arrow keys move between them. */
function roved(event: KeyboardEvent): void {
  const step = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
  const from = event.target;
  if (step === 0 || !(from instanceof HTMLElement)) return;
  const stops = [...(from.closest("article")?.querySelectorAll<HTMLElement>("[data-rove]") ?? [])];
  const at = stops.indexOf(from);
  if (at === -1 || stops.length < 2) return;
  event.preventDefault();
  const to = stops[(at + step + stops.length) % stops.length]!;
  for (const stop of stops) stop.tabIndex = stop === to ? 0 : -1;
  to.focus();
}

/**
 * What a message carries beside its words: the quotes it was sent with, stacked over them, each a way back to where it was said; and the
 * row under it — a seller's message its time, Quote and Copy, an answer Copy and its time. The row keeps its room while hidden. A
 * message cx has not read carries instead the two things that can still be done with it, always shown. A row's controls are marks
 * alone, each with its word over it under the pointer or the focus (spikes/edit-sent).
 */
export class MessageRows {
  #takenBack = false;

  constructor(readonly ports: MessageRowsPorts) {}

  /** A message was taken back a moment ago: the hand that pressed may still be pressing. */
  get takenBack(): boolean { return this.#takenBack; }

  quoted(quotes: readonly Quote[]): HTMLElement | undefined {
    if (quotes.length === 0) return undefined;
    return h("div", { class: "quote-refs", onkeydown: (event) => roved(event as KeyboardEvent) }, ...quotes.map((quote, at) => {
      // A marker that names no place cannot be gone to: its words are drawn, and it is no control.
      if (quote.from === undefined && quote.at === "") return h("div", { class: "quote-ref" }, h("span", { class: "excerpt" }, quote.words));
      const ref = h("button", { type: "button", class: "quote-ref", "data-rove": "", tabindex: at === 0 ? "0" : "-1", onclick: () => this.ports.jump(quote) }, h("span", { class: "excerpt" }, quote.words));
      // A quote from the board goes back to where on it the words were, named under them in the time's place.
      if (quote.from !== undefined) { ref.append(h("span", { class: "when from", dir: "auto" }, quote.from.label)); return ref; }
      // Its name is what it draws: the words, and under them their day and time.
      const tell = (said: Said): void => { if (said.when !== undefined) ref.append(h("span", { class: "when" }, said.when)); };
      const held = this.ports.said(quote);
      if (held !== undefined) tell(held);
      else void this.ports.saidFar(quote).then((far) => { if (far !== undefined) { tell(far); this.ports.grew(); } });
      return ref;
    }));
  }

  /**
   * An answers' message the board once sent, as the chat draws it from history: each entry it answers quoted as a sent quote is, its title
   * and when cx wrote it; and under each the seller's sentence.
   */
  board(pairs: readonly BoardPair[]): HTMLElement {
    return h("div", { class: "board-sent" }, ...pairs.map((pair) => {
      const written = writtenAt(pair.file);
      return h("div", { class: "board-sent-pair" },
        h("div", { class: "quote-ref" }, h("span", { class: "excerpt", dir: "auto" }, pair.title), written !== undefined && h("span", { class: "when" }, this.ports.clock(written))),
        h("p", { dir: "auto" }, pair.said));
    }));
  }

  /** The files a message names, over its words: each its name beside the file mark. A name takes no press: no page draws the seller's files yet. */
  filed(names: readonly string[]): HTMLElement | undefined {
    if (names.length === 0) return undefined;
    return h("div", { class: "file-refs" }, ...names.map((name) => h("span", { class: "file-ref" }, fileIcon(), h("span", { class: "file-ref-name" }, name))));
  }

  under(message: RowOf): HTMLElement {
    const { say } = this.ports;
    // The time takes no press: its word is the moment in full. Under the seller's own message each word ends at the row's right edge.
    const end = message.who !== "cx";
    const when = message.time === undefined ? undefined : tip(h("time", { class: "when", datetime: new Date(message.time).toISOString() }, this.ports.clock(message.time)), this.ports.fullDate(message.time), { end });
    const copy = this.#copy(message.words, message.first && message.who === "cx", end);
    if (message.who === "cx") return h("div", { class: "actions answer-actions", onkeydown: (event) => roved(event as KeyboardEvent) }, copy, when);
    const quotable = message.entryId !== undefined;
    const quote = quotable && tip(h("button", {
      type: "button", class: "quote", "data-rove": "", tabindex: message.first ? "0" : "-1", "aria-label": say("quote.yours", { words: opening(message.words()) }),
      onclick: () => this.ports.quote({ entry: message.entryId!, at: message.key, words: message.words(), who: "you", time: message.time }),
    }, quoteIcon()), say("quote.quote"), { end: true });
    if (!quotable && message.first) copy.tabIndex = 0;
    return h("div", { class: "actions user-actions", onkeydown: (event) => roved(event as KeyboardEvent) }, when, quote, copy);
  }

  /**
   * Each control's name for a screen reader says which message it is under, as Quote's does: several may wait, each over the same two.
   * Each is a Tab stop of its own, in the order drawn, and the row is a group named by its message's words: a control Tab does not
   * reach is one a keyboard does not find.
   */
  waiting(message: WaitingOf): HTMLElement {
    const { say } = this.ports;
    const words = opening(message.words());
    const named = (bare: "stream.cancelEdit" | "stream.sendNow", withWords: "stream.cancelEditNamed" | "stream.sendNowNamed"): string => (words === "" ? say(bare) : say(withWords, { words }));
    const cancel = message.cancel && h("button", { type: "button", class: "cancel-edit", "aria-label": named("stream.cancelEdit", "stream.cancelEditNamed"), onclick: (event) => { if (!twice(event) && !this.#takenBack) this.#takeBack(message.key); } });
    if (cancel !== false) {
      tip(cancel, say("stream.cancelEdit"), { end: true }).append(cancelIcon());
      // A press that takes nothing back takes no focus either: it stays in the message box, where the press before put it.
      cancel.addEventListener("mousedown", (event) => { if (twice(event) || this.#takenBack) event.preventDefault(); });
    }
    const now = message.now && tip(h("button", { type: "button", class: "send-now", "aria-label": named("stream.sendNow", "stream.sendNowNamed"), onclick: (event) => { if (!twice(event)) this.ports.sendNow(); } }, sendNowIcon()), say("stream.sendNow"), { end: true });
    // Each press moves the focus to the message box while its key is still down: held, the key presses the control once.
    if (cancel !== false) ignoreHeld(cancel);
    if (now !== false) ignoreHeld(now);
    return h("div", { class: "actions wait-actions", role: "group", ...(words === "" ? {} : { "aria-label": words }) }, cancel, now);
  }

  /**
   * A message taken back leaves, and the next one waiting moves up under the pointer: the second press of a double-click, or one that
   * comes at once, would take that one back too. No message is taken back for a moment after one was.
   */
  #takeBack(key: string): void {
    this.#takenBack = true;
    this.ports.later(TAKEN_BACK_MS, () => { this.#takenBack = false; });
    this.ports.cancel(key);
  }

  /** Copy puts the message's words on the clipboard and says Copied for a moment, to the eye and to a screen reader. */
  #copy(words: () => string, first: boolean, end: boolean): HTMLButtonElement {
    const { say } = this.ports;
    const button: HTMLButtonElement = tip(h("button", { type: "button", class: "copy", "data-rove": "", tabindex: first ? "0" : "-1" }), () => [button.getAttribute("aria-label") ?? ""], { end });
    // Its tip, where it shows, says the word the button says now.
    const draw = (mark: SVGElement, word: "quote.copy" | "quote.copied"): void => { button.replaceChildren(mark); button.setAttribute("aria-label", say(word)); redrawTip(); };
    draw(copyIcon(), "quote.copy");
    button.addEventListener("click", () => {
      this.ports.copy(words());
      draw(doneIcon(), "quote.copied");
      this.ports.announce(say("quote.copied"));
      this.ports.later(COPIED_MS, () => { draw(copyIcon(), "quote.copy"); this.ports.announce(""); });
    });
    return button;
  }
}
