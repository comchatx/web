import { UPLOAD_MAX_BYTES } from "../shared/upload.js";
import { fill, h } from "./dom.js";
import { hideTipWithin, tip } from "./forms.js";
import type { FileCard } from "./file-uploads.js";
import { fileIcon, retryIcon } from "./message-rows.js";
import { opening, sameQuote, type Held, type Quote } from "./quote.js";
import type { StringKey } from "./strings.js";

/** A file's name, which its card may cut: a drawn tip shows it whole where the card does cut it. */
const cutName = (name: HTMLElement, words: string): HTMLElement => tip(name, () => (name.scrollWidth > name.clientWidth + 1 ? [words] : []));

type Say = (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;

export type QuoteBoxPorts = {
  readonly say: Say;
  /** A moment's day and time, as a seller writes them. */
  readonly when: (time: number) => string;
  /** The message box: it takes the focus after a quote joins or leaves, and its description is what the cards draw. */
  readonly draft: HTMLTextAreaElement;
  /** The quotes changed: the message box's own height did, and what stands over it follows. */
  readonly changed: () => void;
  /** The files in the box, drawn after the quotes in the same row, and what their cards' controls do. */
  readonly files?: { readonly cards: () => readonly FileCard[]; readonly remove: (id: string) => void; readonly retry: (id: string) => void };
};

/** A file's size counted in 1,024s, as the limit is: one decimal under 10, whole above. */
export function sizeOf(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"] as const;
  let n = bytes;
  let at = 0;
  while (n >= 1024 && at < units.length - 1) { n /= 1024; at += 1; }
  return `${at === 0 || n >= 10 ? Math.round(n) : Math.round(n * 10) / 10} ${units[at]}`;
}

/** What a file's card says under its name: how far it has gone up, why it cannot go, or that its name was taken; with nothing to say, its size. */
export function fileSaid(card: FileCard, say: Say): string | undefined {
  if (card.state === "uploading") return say("composer.uploading", { n: card.size === undefined || card.size === 0 ? 0 : Math.floor((card.received / card.size) * 100) });
  if (card.state === "large") return say("composer.tooLarge", { limit: sizeOf(UPLOAD_MAX_BYTES) });
  if (card.state === "failed") return say(card.why ?? "composer.uploadFailed");
  if (card.saved !== undefined && card.saved !== card.name) return say("composer.renamed");
  return card.size === undefined ? undefined : sizeOf(card.size);
}

const DESCRIBED = "quoted-now";

/**
 * The quotes waiting in the message box: a card each, side by side over the writing area, with the quoted words, when they were said and
 * a way to take the card out. They are the page's until sent; the message box is described by the cards' own words and times, so a
 * screen reader hears what is drawn.
 */
export class QuoteBox {
  readonly element = h("div", { class: "quoted", hidden: true });
  #quotes: readonly Held[] = [];
  #drawn: readonly Held[] = [];
  /** One row for as long as the box lives: a card's progress redraws its cards, not the row, so where it is scrolled stays. */
  readonly #row = h("div", { class: "cards" });
  constructor(readonly ports: QuoteBoxPorts) {}

  get held(): readonly Held[] { return this.#quotes; }
  get quotes(): readonly Quote[] { return this.#quotes.map(({ entry, at, words, from }) => ({ entry, at, words, ...(from === undefined ? {} : { from }) })); }

  /** A quote joins the cards, once, the newest in view, and the message box takes the focus. */
  add(quote: Held): void {
    if (!this.#quotes.some((held) => sameQuote(held, quote))) this.#quotes = [...this.#quotes, quote];
    this.draw();
    const cards = this.element.querySelector(".cards");
    if (cards !== null) cards.scrollLeft = cards.scrollWidth;
    this.ports.draft.focus({ preventScroll: true });
    this.ports.changed();
  }

  /** Whose words a waiting quote holds and when they were said, learned after its card was drawn. */
  know(quote: Quote, who: "you" | "cx", time: number | undefined): void {
    if (!this.#quotes.some((held) => sameQuote(held, quote) && held.who === undefined)) return;
    this.#quotes = this.#quotes.map((held) => (sameQuote(held, quote) && held.who === undefined ? { ...held, who, time } : held));
    this.draw();
  }

  /** The cards go with the message they were sent in, or with the conversation they quoted. */
  clear(): void {
    if (this.#quotes.length === 0) return;
    this.#quotes = [];
    this.draw();
    this.ports.changed();
  }

  draw(): void {
    const { say, draft } = this.ports;
    const files = this.ports.files?.cards() ?? [];
    if (this.#quotes.length === 0 && files.length === 0) { hideTipWithin(this.element); this.element.hidden = true; this.element.replaceChildren(); draft.removeAttribute("aria-describedby"); return; }
    const when = (quote: Held): string => (quote.time === undefined ? "" : this.ports.when(quote.time));
    this.element.hidden = false;
    // The cards are drawn again with the page; a card's control holding the focus holds it through that.
    const active = document.activeElement as HTMLElement | null;
    const heldCard = active?.closest<HTMLElement>("[data-card]")?.dataset["card"];
    const heldControl = active?.classList.contains("retry") === true ? "retry" : "remove";
    const before = this.#drawn;
    this.#drawn = this.#quotes;
    const sameQuotes = before.length === this.#quotes.length && before.every((quote, at) => sameQuote(quote, this.#quotes[at]!));
    if (this.#row.parentNode !== this.element) fill(this.element, this.#row);
    // A tip a card of the row shows goes with the row it stands on.
    hideTipWithin(this.#row);
    fill(this.#row,
        ...this.#quotes.map((quote, at) => {
          const remove = say("quote.remove", { words: opening(quote.words) });
          return h("div", { class: "quote-card", "data-card": `quote-${at}`, role: "group", "aria-label": say("quote.card", { words: opening(quote.words) }) },
            h("div", { class: "quote-body", id: `${DESCRIBED}-${at}` }, h("span", { class: "excerpt" }, quote.words),
              // Under a quote from the board, where on it the words were, in the time's place.
              quote.from !== undefined ? h("span", { class: "when from", dir: "auto" }, quote.from.label) : quote.time !== undefined && h("span", { class: "when" }, when(quote))),
            tip(h("button", { type: "button", class: "remove", "aria-label": remove, onclick: () => { this.#quotes = this.#quotes.filter((held) => held !== quote); this.draw(); draft.focus({ preventScroll: true }); this.ports.changed(); } }, "×"), remove));
        }),
        ...files.map((card) => this.#fileCard(card)));
    if (heldCard !== undefined && (sameQuotes || !heldCard.startsWith("quote-"))) this.element.querySelector<HTMLElement>(`[data-card="${heldCard}"] .${heldControl}`)?.focus({ preventScroll: true });
    draft.setAttribute("aria-describedby", [...this.element.querySelectorAll(".quote-body, .file-body")].map((body) => body.id).join(" "));
  }

  /**
   * A file's card: its picture, or the file mark, its name as it stands in the seller's files, and at its foot what the card has to say.
   * Try again is a mark named by its word and described by the card it stands on, so two failed files are told apart.
   */
  #fileCard(card: FileCard): HTMLElement {
    const { say, draft } = this.ports;
    const port = this.ports.files!;
    const shown = card.saved ?? card.name;
    const said = fileSaid(card, say);
    const body = `${DESCRIBED}-${card.id}`;
    const remove = say("composer.removeFile", { name: shown });
    const retry = say("status.retry");
    // A picture the browser cannot draw keeps the mark every other file has.
    const picture = card.image === undefined ? fileIcon() : h("img", { src: card.image, alt: "", onerror: (event: Event) => (event.target as HTMLElement).replaceWith(fileIcon()) });
    return h("div", { class: `quote-card file-card ${card.state}`, "data-card": card.id, ...(card.state === "failed" && card.why !== undefined ? { "data-why": "" } : {}) },
      h("span", { class: "file-thumb", "aria-hidden": "true" }, picture),
      h("div", { class: "file-body", id: body }, cutName(h("span", { class: "file-name" }, shown), shown), said !== undefined && h("span", { class: "file-said" }, said)),
      tip(h("button", { type: "button", class: "remove", "aria-label": remove, onclick: () => { port.remove(card.id); draft.focus({ preventScroll: true }); } }, "×"), remove),
      card.state === "failed" && tip(h("button", { type: "button", class: "retry", "aria-label": retry, "aria-describedby": body, onclick: () => { port.retry(card.id); this.element.querySelector<HTMLElement>(`[data-card="${card.id}"] .remove`)?.focus({ preventScroll: true }); } }, retryIcon()), retry));
  }
}
