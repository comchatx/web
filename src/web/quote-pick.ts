import { fill, h } from "./dom.js";
import { quoteIcon } from "./message-rows.js";

export type Picked = { readonly key: string; readonly words: string };

export type QuotePickPorts = {
  /** The page's main area, which the control floats in, and the conversation's own scrolling view. */
  readonly main: HTMLElement;
  readonly scroller: HTMLElement;
  readonly words: () => { readonly quote: string; readonly selection: string };
  readonly quote: (picked: Picked) => void;
  readonly soon: (then: () => void) => void;
  /** Where words may be quoted from, where it is not an answer's: the text an element stands in, and its key (`answerText`'s otherwise). */
  readonly locate?: Locate;
};

/**
 * The words of an answer a selection may hold: its written text, never a step's card, its thinking or its row. An answer still being
 * written offers none: a quote carries its answer's id, and pi's record has none for it yet.
 */
const ANSWER_TEXT = ".item.assistant:not(.draft) > .markdown";

/** The quotable text an element stands in, and the key a quote of it carries; none where it stands in none. */
export type Locate = (at: Element) => { readonly text: HTMLElement; readonly key: string } | undefined;

/** An answer's written text, keyed by its item. */
export const answerText: Locate = (at) => {
  const text = at.closest<HTMLElement>(ANSWER_TEXT) ?? undefined;
  const key = text?.closest<HTMLElement>(".item")?.dataset["key"];
  return text === undefined || key === undefined ? undefined : { text, key };
};

/**
 * The selection in the conversation, cut to the one answer's text it begins in: the item's key and the words as the reader sees them,
 * runs of white space as one. Where it began is its anchor, whichever way it was drawn; one begun outside an answer's text — in a
 * message of the seller's, a step, another part of the page — holds nothing to quote.
 */
export function selected(scroller: HTMLElement, selection: Selection | null, locate: Locate = answerText): (Picked & { readonly range: Range }) | undefined {
  if (selection === null || selection.isCollapsed || selection.rangeCount === 0) return undefined;
  const range = selection.getRangeAt(0);
  const anchor = selection.anchorNode;
  const at = anchor instanceof Element ? anchor : anchor?.parentElement;
  const found = at === null || at === undefined ? undefined : locate(at);
  if (found === undefined || !scroller.contains(found.text)) return undefined;
  const { text, key } = found;
  const cut = range.cloneRange();
  if (!text.contains(range.startContainer)) cut.setStart(text, 0);
  if (!text.contains(range.endContainer)) cut.setEnd(text, text.childNodes.length);
  const words = cut.toString().replace(/\s+/g, " ").trim();
  return words === "" ? undefined : { range: cut, key, words };
}

/**
 * Quote on a selection: words selected in an answer, however they were selected, float the control just above the selection's first
 * line. It is a pointer's control — not a Tab stop, never holding the focus — and keeps no state of its own: the selection is the
 * state. Every change of the selection and every scroll of the conversation places it again, shown when a selection of written words
 * has its first line in view and hidden otherwise. A press hides it and it remembers nothing of it. Escape hides it for as long as
 * that selection stands, whatever the conversation draws meanwhile, so it takes one Escape and the next is the page's. A keyboard
 * quotes a message from its row.
 */
export class QuotePick {
  readonly element = h("button", { type: "button", class: "quote-pick", tabindex: "-1", hidden: true });
  readonly #spent = new WeakSet<Event>();
  #dismissed = false;
  constructor(readonly ports: QuotePickPorts) {
    // The press takes neither the selection it acts on nor the focus.
    this.element.addEventListener("mousedown", (event) => event.preventDefault());
    this.element.addEventListener("click", () => {
      const picked = this.#selected();
      this.hide();
      if (picked === undefined) return;
      getSelection()?.removeAllRanges();
      ports.quote({ key: picked.key, words: picked.words });
    });
    document.addEventListener("selectionchange", () => { this.#dismissed = false; ports.soon(() => this.place()); });
    ports.scroller.addEventListener("scroll", () => this.place(), { passive: true });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") { if (!this.element.hidden) { this.#spent.add(event); this.#dismissed = true; } this.hide(); } });
  }

  hide(): void { this.element.hidden = true; }

  #selected(): (Picked & { readonly range: Range }) | undefined { return selected(this.ports.scroller, getSelection(), this.ports.locate); }

  /** Whether this press of Escape hid the control: the key is then spent on it, and the page does nothing else with it. */
  took(event: Event): boolean { return this.#spent.has(event); }

  place(): void {
    const { main, scroller } = this.ports;
    const picked = this.#selected();
    if (picked === undefined || this.#dismissed) { this.hide(); return; }
    const first = picked.range.getClientRects()[0] ?? picked.range.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    if (first.bottom < view.top || first.top > view.bottom) { this.hide(); return; }
    const words = this.ports.words();
    fill(this.element, quoteIcon(), h("span", {}, words.quote));
    this.element.setAttribute("aria-label", words.selection);
    this.element.hidden = false;
    const box = main.getBoundingClientRect();
    this.element.style.top = `${Math.max(view.top, first.top - this.element.offsetHeight - 6) - box.top}px`;
    this.element.style.left = `${Math.min(Math.max(first.left - box.left, 8), box.width - this.element.offsetWidth - 8)}px`;
  }
}

const MARKED_MS = 1600;
const HIGHLIGHT = "quoted";

/**
 * The quoted words in the answer a quote returns to: found whole in one run of the answer's written text as it is drawn, across
 * whatever the writing puts them in — bold, a link, two paragraphs — with runs of white space as one, as they were quoted. Never its
 * thinking or a step; words that only begin alike are not the words. None when the answer no longer holds them.
 */
export function wordsIn(answer: HTMLElement, words: string): Range | undefined {
  const sought = words.replace(/\s+/g, " ").trim();
  if (sought === "") return undefined;
  for (const text of answer.querySelectorAll<HTMLElement>(":scope > .markdown")) {
    // The text as a range reads it, white space folded, and where each of its characters stands.
    let read = "";
    const places: { readonly node: Node; readonly offset: number }[] = [];
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const said = node.textContent ?? "";
      for (let offset = 0; offset < said.length; offset++) {
        const space = /\s/.test(said[offset]!);
        if (space && (read === "" || read.endsWith(" "))) continue;
        read += space ? " " : said[offset]!;
        places.push({ node, offset });
      }
    }
    const from = read.indexOf(sought);
    if (from < 0) continue;
    const first = places[from]!;
    const last = places[from + sought.length - 1]!;
    const range = document.createRange();
    range.setStart(first.node, first.offset);
    range.setEnd(last.node, last.offset + 1);
    return range;
  }
  return undefined;
}

/**
 * Marks those words for a moment, as a selection is drawn. A browser without highlights marks nothing, and the landed answer's own
 * outline still shows the place.
 */
export function markWords(answer: HTMLElement, words: string, later: (ms: number, then: () => void) => void): boolean {
  const highlights = (globalThis.CSS as { highlights?: Map<string, unknown> } | undefined)?.highlights;
  const Highlight = (globalThis as { Highlight?: new (range: Range) => unknown }).Highlight;
  const range = wordsIn(answer, words);
  if (highlights === undefined || Highlight === undefined || range === undefined) return false;
  highlights.set(HIGHLIGHT, new Highlight(range));
  later(MARKED_MS, () => highlights.delete(HIGHLIGHT));
  return true;
}
