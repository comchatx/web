import { h } from "./dom.js";
import { doingName, type Busy } from "./plugins-doing.js";
import { href, type Item } from "./plugins-model.js";
import type { Language } from "./strings.js";

/** The ring that turns while a click is being written down: drawn, not read, since its control carries the name. */
export const spinner = (): HTMLElement => h("span", { class: "pl-spin", "aria-hidden": "true" });

/**
 * A click being written down, where its control stood: the control turns and says no words, and keeps a
 * name for a screen reader. On a card it stands where + did and keeps the keyboard + had, taking no press, and so it does in a line,
 * where a button that would change the same plugin stood; on a row, which is one link, it is the ring in the row.
 */
export function busyMark(say: Parameters<typeof doingName>[0], language: Language, item: Item, busy: Busy, place: "card" | "row" | "line" = "row", focus = `act ${href.item(item)}`): HTMLElement {
  const name = doingName(say, language, item, busy);
  // An update on a card that is not drawn installed, a bundle's whose members are not all in, turns the ring in the room + had; Discover keeps an installed card's ✓.
  const card = busy.act === "update" ? "pl-act pl-act-ring" : "pl-doing pl-act-doing";
  if (place !== "row") return h("button", { type: "button", class: place === "card" ? card : "pl-doing pl-busy", "aria-disabled": "true", "aria-busy": "true", "aria-label": name, "data-focus": focus }, spinner());
  return h("span", { class: "pl-doing" }, h("span", { role: "status", "aria-label": name }, spinner()));
}

/** Set on a control the ring named, so drawing it back takes away only the name the ring gave. */
const NAMED = "data-ring-named";

/**
 * A control drawn waiting or drawn back. A button turns the ring where its words stood, the words keeping their room unseen and staying
 * its name for a screen reader, as Update's does; a field, which holds no ring, has it beside. Either is marked busy and takes no press,
 * and keeps the keyboard where it was. What it is drawn as is read from the control itself, so a control drawn waiting twice turns once.
 */
export function ringed<T extends HTMLElement>(control: T, busy: boolean): T {
  if (busy === (control.getAttribute("aria-busy") === "true")) return control;
  // A switch is drawn waiting as the set draws one busy: it stays where it was, its track washed, and takes no press.
  if (control.getAttribute("role") === "switch") {
    if (busy) { control.setAttribute("aria-busy", "true"); control.setAttribute("aria-disabled", "true"); }
    else { control.removeAttribute("aria-busy"); control.removeAttribute("aria-disabled"); }
    return control;
  }
  const field = control.tagName === "SELECT" || control.tagName === "INPUT";
  if (busy) {
    if (control.getAttribute("aria-label") === null) { control.setAttribute("aria-label", control.textContent?.trim() ?? ""); control.setAttribute(NAMED, ""); }
    control.setAttribute("aria-busy", "true");
    control.setAttribute("aria-disabled", "true");
    if (field) { control.after(h("span", { class: "pl-spin pl-beside", "aria-hidden": "true" })); return control; }
    control.classList.add("pl-busy", "pl-hold");
    control.replaceChildren(h("span", { class: "pl-hold-word", "aria-hidden": "true" }, ...control.childNodes), spinner());
    return control;
  }
  control.removeAttribute("aria-busy");
  control.removeAttribute("aria-disabled");
  if (control.hasAttribute(NAMED)) { control.removeAttribute("aria-label"); control.removeAttribute(NAMED); }
  if (field) { if (control.nextElementSibling?.classList.contains("pl-beside") === true) control.nextElementSibling.remove(); return control; }
  control.classList.remove("pl-busy", "pl-hold");
  const words = control.querySelector(":scope > .pl-hold-word");
  control.replaceChildren(...(words === null ? [] : [...words.childNodes]));
  return control;
}

/**
 * Set on every control drawn for an operation that is out, naming the owner and the operation, so its settling finds what is drawn now
 * and nothing another owner drew under the same key: a page drawn inside another page holds its own.
 */
const WAIT = "data-wait";

/**
 * What a page has in flight, each under a key that names the operation — a save, a deletion, a dialog's answer — and not the element drawn
 * for it: every draw of the page draws the operation's controls from here while its answer is out, and a press of one is no second
 * operation. When the answer comes or fails the key goes, and the controls drawn for it in the page as it stands then are drawn at rest:
 * no node a press closed over is touched, and nothing is kept past the answer. The page that owns the operations holds one, for as long
 * as it is that page.
 */
export class Waits {
  static #owners = 0;
  readonly #owner = `${Waits.#owners++}`;
  readonly #out = new Map<string, { readonly detail: string | undefined }>();
  readonly #root: () => ParentNode | null | undefined;

  /** `root` is where the owner's controls are drawn now. */
  constructor(root: () => ParentNode | null | undefined) { this.#root = root; }

  has(key: string): boolean { return this.#out.has(key); }

  /** What the operation out under `key` was started with, where it was started with one: a dialog's answer, say. */
  detail(key: string): string | undefined { return this.#out.get(key)?.detail; }

  /** `control` as its operation is: turning while it is out, else as drawn. */
  ring<T extends HTMLElement>(key: string, control: T): T {
    if (!this.#out.has(key)) return control;
    control.setAttribute(WAIT, this.#mark(key));
    return ringed(control, true);
  }

  /** `control`, another of the operation's controls, taking no press while it is out — a field read-only — else as drawn. */
  hold<T extends HTMLElement>(key: string, control: T): T {
    if (!this.#out.has(key)) return control;
    control.setAttribute(WAIT, this.#mark(key));
    control.setAttribute("aria-disabled", "true");
    if (control.tagName === "INPUT" || control.tagName === "TEXTAREA") (control as unknown as HTMLInputElement).readOnly = true;
    return control;
  }

  /**
   * The operation `key`, unless it is already out: `control`, the one pressed, turns at once, and every draw until `act` settles, answered
   * or failed, draws the operation's controls waiting; then the key goes and what is drawn for it is drawn at rest. An act that answers
   * `"held"` keeps the key out — a dialog whose answer was taken — until the owner lets it go.
   */
  async run(key: string, act: () => Promise<unknown>, control?: HTMLElement, detail?: string): Promise<void> {
    if (this.#out.has(key)) return;
    const out = { detail };
    this.#out.set(key, out);
    if (control !== undefined) this.ring(key, control);
    let held = false;
    try { held = (await act()) === "held"; } finally {
      if (!held && this.#out.get(key) === out) this.#settle(key);
    }
  }

  /** Lets a held key go: the owner has dropped what it was for, or is drawing what comes after it. */
  release(key: string): void { if (this.#out.has(key)) this.#settle(key); }

  /** An `onclick` for the operation `key`: the pressed control turns; a press no event carries draws none. */
  press(key: string, act: () => Promise<unknown>): (event?: Event) => void {
    return (event) => { void this.run(key, act, event?.currentTarget as HTMLElement | undefined); };
  }

  #mark(key: string): string { return `${this.#owner} ${key}`; }

  #settle(key: string): void {
    this.#out.delete(key);
    for (const one of this.#root()?.querySelectorAll?.<HTMLElement>(`[${WAIT}]`) ?? []) {
      if (one.getAttribute(WAIT) !== this.#mark(key)) continue;
      one.removeAttribute(WAIT);
      if (one.getAttribute("aria-busy") === "true") { ringed(one, false); continue; }
      one.removeAttribute("aria-disabled");
      if (one.tagName === "INPUT" || one.tagName === "TEXTAREA") (one as HTMLInputElement).readOnly = false;
    }
  }
}

/** The sizes of the theme's text a bar stands in for: a bar is as tall as a line of that text. */
export type BarSize = "caption" | "small" | "body" | "lead" | "title" | "display";
/** How much of its line a bar fills, in twelfths. */
export type Twelfths = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * One line of text not read yet: a bar in the line's own height, `width` twelfths of it, so the shape takes the room the words will; or
 * a word's or a short sentence's width, where what holds it is as wide as its words: a tab, a button, a message bubble.
 */
export const bar = (width: Twelfths | "word" | "sentence", size: BarSize = "body"): HTMLElement => inStep(h("span", { class: `sk-bar sk-${size} sk-${typeof width === "number" ? `w${width}` : width}` }));

/** The working dot's breath (`step-breathe`), which every shape on a page breathes with, in step. */
export const BREATH_MS = 1_600;
/** A shape set at the point of the breath the clock is at, so the shapes drawn at different moments rise and fall together. */
function inStep<T extends HTMLElement>(shape: T): T {
  (shape.style as CSSStyleDeclaration | undefined)?.setProperty("animation-delay", `${-(Math.round(performance.now()) % BREATH_MS)}ms`);
  return shape;
}

/**
 * A box not read yet, a chart's or a form's: the grey fills the room `room`, an element drawn with the box's own class, gives it. A box
 * as big as its words, a message's bubble, holds the bars that size it, unseen, and breathes as one with the page's other shapes.
 */
export const block = <T extends HTMLElement>(room: T, ...sizing: readonly Node[]): T => { room.classList.add("sk-block"); room.replaceChildren(...sizing); return inStep(room); };

/** How long a read is out before its place draws the shape: a read that answers sooner draws its content with no shape before it. */
export const SHAPE_AFTER_MS = 500;

/**
 * The shape of what a place is reading, drawn in its stead until the read answers or fails: the place passes the rows, cards and bars its
 * content will be, built from the content's own classes so the shape holds the content's size, and the words it says while it reads. The
 * words are the one thing a screen reader hears; the shape is drawn, not read. A place whose own status already says them passes none.
 * Whoever draws the content draws over it, and the shape goes. The shape holds its room unseen until the read has been out
 * `SHAPE_AFTER_MS`.
 */
export function skeleton(word: string | undefined, ...shape: readonly (Node | undefined | false)[]): HTMLElement {
  const drawn = h("div", { class: "sk sk-wait", "aria-busy": "true" }, word !== undefined && h("span", { class: "unseen", role: "status" }, word), h("div", { class: "sk-shape", "aria-hidden": "true" }, ...shape));
  setTimeout(() => drawn.classList.remove("sk-wait"), SHAPE_AFTER_MS);
  return drawn;
}

/** A list's rows before its length is known, on a first visit. */
export const FIRST_ROWS = 3;
/** The most rows a list draws from what this browser remembers. */
export const MOST_ROWS = 8;
/** How long a list's length stands before this browser keeps it. */
export const ROWS_STAND_MS = 1_000;
/** The lists that draw as many rows as this browser drew there last. */
export type Rows = "yours" | "history" | "payments" | "invited";
const rowsKey = (list: Rows): string => `cmx-rows-${list}`;
const kept = (): Storage | undefined => { try { return globalThis.localStorage; } catch { return undefined; } };
const standing = new Map<Rows, { readonly count: number; readonly timer: ReturnType<typeof setTimeout> }>();

/** How many rows `list` draws before its read answers: as many as this browser drew there last, `FIRST_ROWS` on a first visit. */
export function rowsFor(list: Rows): number {
  let read: string | null | undefined;
  try { read = kept()?.getItem(rowsKey(list)); } catch { read = undefined; }
  const count = read === null || read === undefined || !/^\d+$/.test(read) ? FIRST_ROWS : Number(read);
  return Math.min(count, MOST_ROWS);
}

/** `list` drew `count` rows: once that has stood `ROWS_STAND_MS`, this browser keeps the number, and nothing a row said. */
export function keepRows(list: Rows, count: number): void {
  const pending = standing.get(list);
  // The clock measures the length, not the redraws: the same length drawn again keeps its moment running.
  if (pending?.count === count) return;
  clearTimeout(pending?.timer);
  standing.set(list, { count, timer: setTimeout(() => {
    standing.delete(list);
    try { kept()?.setItem(rowsKey(list), String(Math.min(Math.max(0, Math.floor(count)), MOST_ROWS))); } catch { /* the count is not kept */ }
  }, ROWS_STAND_MS) });
}
