/**
 * The behaviour of the one set of controls (ruled 2026-11-19), each drawn by its `f-` rule in `site/forms.css`: where a thing over the page
 * stands, the tooltip, the menu and the select, the dialog, the toast, the choice and the switch. A page builds its controls with these and
 * keeps no placement, key handler, press outside or scrim test of its own. `.claude/skills/ui-forms/SKILL.md` says which to use where.
 */
import { h, svg, type Child } from "./dom.js";
import { LINES } from "./plugin-marks.js";

/** How far a thing over the page stands from what it belongs to, and how near it may come to the edge of what holds it. */
export const GAP = 6;
export const EDGE = 8;

export type Side = "above" | "below" | "right" | "left";
export interface Place { readonly side: Side; readonly left: number; readonly top: number; readonly fits: boolean }
interface Room { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

/** The places tried, in order: over the target, beside it where over it holds something a person presses, and under it for a menu. */
export const ORDER = { above: ["above", "below", "right", "left"], beside: ["right", "left", "above", "below"], below: ["below", "above"] } as const satisfies Readonly<Record<string, readonly Side[]>>;

/** The open dialog a target is in: a thing over the page keeps inside its edge, not only the window's. */
export const roomOf = (target: Element): DOMRect | null => target.closest("dialog[open], [role=dialog]")?.getBoundingClientRect() ?? null;

/**
 * The first place in `order` that holds `box` beside `at`, `GAP` clear and never nearer than `EDGE` to the edge of `room` (the window
 * where there is none); where none holds it, the first, which may then stand past the room's edge. A box wider than the room wraps to fit it.
 */
export function seat(box: HTMLElement, at: DOMRect, order: readonly Side[], end: boolean | "centre" = false, room: Room | null = null): Place {
  const r = room ?? { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  box.style.maxWidth = "";
  box.style.minWidth = "";
  if (box.offsetWidth > r.right - r.left - 2 * EDGE) { box.style.maxWidth = `${r.right - r.left - 2 * EDGE}px`; box.style.minWidth = "0"; }
  const w = box.offsetWidth, tall = box.offsetHeight;
  const along = (left: number): number => Math.max(r.left + EDGE, Math.min(left, r.right - w - EDGE));
  const across = (top: number): number => Math.max(r.top + EDGE, Math.min(top, r.bottom - tall - EDGE));
  const start = end === "centre" ? at.left + at.width / 2 - w / 2 : end ? at.right - w : at.left;
  const places: Readonly<Record<Side, () => Place>> = {
    above: () => ({ side: "above", left: along(start), top: at.top - GAP - tall, fits: at.top - GAP - tall >= r.top + EDGE }),
    below: () => ({ side: "below", left: along(start), top: at.bottom + GAP, fits: at.bottom + GAP + tall <= r.bottom - EDGE }),
    right: () => ({ side: "right", left: at.right + GAP, top: across(at.top + at.height / 2 - tall / 2), fits: at.right + GAP + w <= r.right - EDGE }),
    left: () => ({ side: "left", left: at.left - GAP - w, top: across(at.top + at.height / 2 - tall / 2), fits: at.left - GAP - w >= r.left + EDGE }),
  };
  const tried = order.map((side) => places[side]());
  const place = tried.find((one) => one.fits) ?? tried[0]!;
  box.style.left = `${place.left}px`;
  box.style.top = `${place.top}px`;
  box.dataset["side"] = place.side;
  return place;
}

const byKeyboard = (target: Element): boolean => { try { return target.matches(":focus-visible"); } catch { return false; } };

// ---- Tooltip ----

export interface TipOptions {
  /** A card of a few lines, which the pointer may rest on. */
  readonly card?: boolean;
  /** It holds what is said nowhere else, as a bar's reading does, so a tap shows it too; a label that names a control never shows by touch. */
  readonly says?: boolean;
  readonly at?: keyof typeof ORDER;
  /** Its right edge with the target's, not its left. */
  readonly end?: boolean;
}
export type Words = string | (() => readonly Child[]);

/** The one tip of a document, made when first shown. */
let tipBox: HTMLElement | undefined;
let tipped: HTMLElement | undefined;
let tippedBy: "pointer" | "keys" | "tap" | undefined;
let tippedSays: { readonly words: Words; readonly options: TipOptions } | undefined;

function tipElement(): HTMLElement {
  if (tipBox !== undefined) return tipBox;
  const box = h("div", { class: "f-tip", hidden: true, "aria-hidden": "true" });
  box.addEventListener("pointerleave", (event) => { if (event.pointerType !== "touch" && tipped !== undefined && !tipped.contains(event.relatedTarget as Node | null)) hideTip(); });
  tipBox = box;
  return box;
}

// While a tip shows, a press anywhere but on its target or on itself takes it away, however it was shown; so do the page scrolling, the
// window changing size and Escape, which leaves the focus where it is and does nothing else while a tip shows, in a dialog too. A tip whose
// target has left the document, or is no longer drawn (hidden, or inside something hidden), goes at the next of these, at the next move of
// the pointer or at any key, and the event goes on as if no tip showed: the page that removes or hides a control has no tip to close.
const orphaned = (): boolean => { if (tipped === undefined || (tipped.isConnected && tipped.getClientRects().length > 0)) return false; hideTip(); return true; };
const pressedAway = (event: Event): void => { if (!orphaned() && tipped !== undefined && !tipped.contains(event.target as Node) && tipBox?.contains(event.target as Node) !== true) hideTip(); };
const movedAway = (): void => hideTip();
const pointerMoved = (): void => { orphaned(); };
const keyed = (event: KeyboardEvent): void => { if (!orphaned() && event.key === "Escape" && tipped !== undefined) { hideTip(); event.preventDefault(); event.stopPropagation(); } };
function listen(on: boolean): void {
  const change = on ? window.addEventListener.bind(window) : window.removeEventListener.bind(window);
  change("pointerdown", pressedAway, true);
  change("pointermove", pointerMoved, true);
  change("scroll", movedAway, true);
  change("resize", movedAway);
  change("keydown", keyed as EventListener, true);
}

function showTip(target: HTMLElement, words: Words, options: TipOptions, by: "pointer" | "keys" | "tap"): void {
  // A tip with nothing to say at this moment, as a row's whole name where the row cuts none of it, does not show.
  const said = typeof words === "string" ? [words] : words().filter((one): one is Node | string => one !== undefined && one !== false && one !== "");
  if (said.length === 0) { hideTip(); return; }
  const box = tipElement();
  // In a dialog it stands in the dialog, which lies over the page.
  (target.closest("dialog[open]") ?? document.body).append(box);
  if (tipped === undefined) listen(true);
  tipped = target;
  tippedBy = by;
  tippedSays = { words, options };
  box.className = options.card === true ? "f-tip f-tip-card" : "f-tip";
  box.replaceChildren(...said);
  box.hidden = false;
  seat(box, target.getBoundingClientRect(), ORDER[options.at ?? "above"], options.end, roomOf(target));
}

/** Takes the tip away: any tip, or only the one `target` shows. `hideTip(target)` is the close of the tip `tip` put on `target`. */
export function hideTip(target?: HTMLElement): void {
  if (tipBox === undefined || tipped === undefined || (target !== undefined && tipped !== target)) return;
  listen(false);
  tipped = undefined;
  tippedBy = undefined;
  tipBox.hidden = true;
}

/**
 * Takes the tip away where its target is inside `root`. A tip is not the page's to close: one whose target leaves the document or stops
 * being drawn goes at the seller's next move by itself, so a page that draws `root` again calls nothing.
 */
export function hideTipWithin(root: Element): void {
  if (tipped !== undefined && root.contains(tipped)) hideTip(tipped);
}

/**
 * A tip on `target`, shown by a pointer resting on it or the keyboard's focus reaching it, never by a pointer's press; hidden from a screen
 * reader, so the target carries its own name (`aria-label`) and no `title`.
 */
export function tip<T extends HTMLElement>(target: T, words: Words, options: TipOptions = {}): T {
  target.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch") showTip(target, words, options, "pointer"); });
  target.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "touch" && !(options.card === true && tipBox?.contains(event.relatedTarget as Node | null) === true)) hideTip(target);
  });
  target.addEventListener("focus", () => { if (givenBack !== target && byKeyboard(target)) showTip(target, words, options, "keys"); });
  // The focus moving on takes away what the focus showed; a tap on a card moves the focus off its target and must not.
  target.addEventListener("blur", () => { if (tippedBy === "keys") hideTip(target); });
  if (options.card === true || options.says === true) {
    let tapped = false;
    target.addEventListener("pointerdown", (event) => { tapped = event.pointerType === "touch"; });
    target.addEventListener("click", () => {
      if (!tapped) return;
      tapped = false;
      if (tipped === target && tipBox?.hidden === false) hideTip();
      else showTip(target, words, options, "tap");
    });
  }
  return target;
}

/** The tip showing now said and placed again: the call of a page whose target's words or place change while its tip shows. */
export function redrawTip(): void {
  if (tipped !== undefined && tippedBy !== undefined && tippedSays !== undefined) showTip(tipped, tippedSays.words, tippedSays.options, tippedBy);
}

let givenBack: Element | undefined;
/** The focus a close hands back to what opened it. The keyboard did not reach `target`, so its tip does not show, and the next Escape goes on to the page. */
export function giveBack(target: HTMLElement | SVGElement): void {
  givenBack = target;
  try { target.focus({ preventScroll: true }); } finally { givenBack = undefined; }
}

// ---- Menu and select ----

/** The menu open now: one at a time, and opening another, a tip or a dialog closes it. */
let shutMenu: () => void = () => {};

export interface MenuOptions {
  readonly order?: readonly Side[];
  /** Which edge of its button the menu lines up with, its start unless named; `centre` stands it centred under or over it. */
  readonly end?: boolean | "centre";
  /**
   * The count of columns its rows inside a `group` are printed in, as the span's calendar is two by two: there Down and Up move by a row
   * of them and Left and Right along it, and from the rows before it Down steps in and Up out of it; none wrap. Without it the list is one
   * column, and Down and Up wrap.
   */
  readonly columns?: number;
}
export interface Menu { readonly open: () => void; readonly close: (refocus: boolean) => void }

/**
 * `list` opened by `button`: under it, the keyboard on the row in use or the first. Up and Down wrap, Home and End; Escape and a row pressed close it
 * and return the focus to the button; Tab closes it from the button, so the focus goes on to what follows it; a press outside, the page scrolling or the window changing size closes it.
 */
export function menu(button: HTMLElement, list: HTMLElement, options: MenuOptions = {}): Menu {
  const rows = (): HTMLElement[] => [...list.querySelectorAll<HTMLElement>("[role^=menuitem], [role=option]")].filter((row) => !row.hidden);
  // A menu whose button has left the document closes at its own next event, and the event goes on as if no menu were open.
  const orphaned = (): boolean => { if (button.isConnected) return false; close(false); return true; };
  const outside = (event: Event): void => { if (!orphaned() && !list.contains(event.target as Node) && !button.contains(event.target as Node)) close(false); };
  // The page scrolling under it closes it; its own long list scrolling does not.
  const scrolled = (event: Event): void => { if (!orphaned() && !list.contains(event.target as Node)) close(false); };
  const resized = (): void => close(false);
  const close = (refocus: boolean): void => {
    if (list.hidden) return;
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    shutMenu = () => {};
    window.removeEventListener("pointerdown", outside, true);
    window.removeEventListener("scroll", scrolled, true);
    window.removeEventListener("resize", resized);
    if (refocus) giveBack(button);
  };
  const open = (): void => {
    shutMenu();
    hideTip();
    if (list.parentElement === null) (button.closest("dialog[open]") ?? document.body).append(list);
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    seat(list, button.getBoundingClientRect(), options.order ?? ORDER.below, options.end, roomOf(button));
    const all = rows();
    (all.find((row) => row.getAttribute("aria-checked") === "true" || row.getAttribute("aria-selected") === "true") ?? all[0])?.focus();
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("scroll", scrolled, { passive: true, capture: true });
    window.addEventListener("resize", resized);
    shutMenu = () => close(false);
  };
  list.hidden = true;
  button.setAttribute("aria-haspopup", list.getAttribute("role") === "listbox" ? "listbox" : "menu");
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", () => { if (list.hidden) open(); else close(true); });
  button.addEventListener("keydown", (event) => { if ((event.key === "ArrowDown" || event.key === "ArrowUp") && list.hidden) { event.preventDefault(); open(); } });
  // A row pressed has done its act by the time its press reaches the list: the menu closes, the focus back on its button.
  list.addEventListener("click", (event) => { if (!orphaned() && (event.target as Element).closest("[role^=menuitem], [role=option]") !== null) close(true); });
  list.addEventListener("keydown", (event) => {
    if (orphaned()) return;
    const all = rows(), at = all.indexOf(document.activeElement as HTMLElement), last = all.length - 1;
    const grouped = options.columns === undefined ? -1 : all.findIndex((row) => row.closest("[role=group]") !== null);
    const n = options.columns ?? 1, inGrid = grouped >= 0 && at >= grouped, column = inGrid ? (at - grouped) % n : 0;
    const to = (grouped < 0
      ? { ArrowDown: (at + 1) % all.length, ArrowUp: (at - 1 + all.length) % all.length, Home: 0, End: last }
      : { ArrowDown: !inGrid ? at + 1 : at + n <= last ? at + n : at, ArrowUp: !inGrid ? Math.max(0, at - 1) : at - n >= grouped ? at - n : Math.max(0, grouped - 1),
          ArrowRight: inGrid && column < n - 1 && at < last ? at + 1 : undefined, ArrowLeft: inGrid && column > 0 ? at - 1 : undefined, Home: 0, End: last } as Readonly<Record<string, number | undefined>>)[event.key];
    if (to !== undefined) { event.preventDefault(); all[to]?.focus(); }
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (event.key === "Tab") close(true);
  });
  return { open, close };
}

/** A menu's row: a press does `act`, and the menu closes with the focus back on its button. */
export const menuRow = (words: Child, act: () => void, mark?: Child): HTMLButtonElement =>
  h("button", { type: "button", class: "f-menu-row", role: "menuitem", tabindex: "-1", onclick: act }, mark, h("span", { class: "f-words" }, words));

export interface SelectOptions {
  /** The name a screen reader hears for its list, and, with the value held, for the control. */
  readonly label: string;
  readonly values: readonly string[];
  readonly held: number;
  readonly take: (index: number) => void;
  /** Its list's left edge with the control's, not its right. */
  readonly start?: boolean;
}

/**
 * A value chosen from a list: its words and a chevron, named by its label and the value it holds, opening the menu under it, right edges
 * together, with the held line ticked at its end.
 */
export function select(options: SelectOptions): { readonly button: HTMLButtonElement; readonly list: HTMLElement; readonly hold: (index: number) => void; readonly close: (refocus: boolean) => void } {
  const named = (index: number): string => `${options.label} ${options.values[index] ?? ""}`.trim();
  const words = h("span", {}, options.values[options.held] ?? "");
  const button = h("button", { type: "button", class: "f-select", "aria-label": named(options.held) }, words, chevron());
  const rows = options.values.map((value, index) => h("button", { type: "button", class: "f-menu-row", role: "option", tabindex: "-1", "aria-selected": String(index === options.held), "data-index": String(index) },
    h("span", { class: "f-words" }, value), tick()));
  const list = h("div", { class: options.values.length > 8 ? "f-menu f-list" : "f-menu", role: "listbox", "aria-label": options.label }, ...rows);
  const hold = (index: number): void => {
    rows.forEach((row, n) => row.setAttribute("aria-selected", String(n === index)));
    words.textContent = options.values[index] ?? "";
    button.setAttribute("aria-label", named(index));
  };
  const { close } = menu(button, list, { end: options.start !== true });
  list.addEventListener("click", (event) => {
    const row = (event.target as Element).closest<HTMLElement>("[role=option]");
    if (row === null) return;
    const index = Number(row.dataset["index"]);
    hold(index);
    options.take(index);
  });
  list.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = (event.target as Element).closest<HTMLElement>("[role=option]");
    if (row !== null) { event.preventDefault(); row.click(); }
  });
  return { button, list, hold, close };
}

const mark = (kind: string, d: string): SVGSVGElement => svg("svg", { class: kind, viewBox: "0 0 24 24", "aria-hidden": "true" }, svg("path", { d }));
export const chevron = (): SVGSVGElement => mark("icon", LINES["chevron"]!);
export const tick = (): SVGSVGElement => mark("icon f-tick", "M5 12.5l4.5 4.5L19 7.5");

/** A search field: the input on the wash with its magnifier at the start, the whole box its label, so a press anywhere in it reaches the words. */
export const searchBox = (input: HTMLInputElement): HTMLLabelElement => h("label", { class: "f-search" }, mark("icon", "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4"), input);

// ---- Dialog ----

/**
 * A dialog's press on the dimmed page: one that starts and ends outside the box's border does `shut`; one on its own padding, or that
 * starts inside and ends outside, or the other way, does nothing. A large window that keeps its own opening, as the settings window does, takes this alone.
 */
export function scrimCloses(box: HTMLDialogElement, shut: () => void): void {
  const outside = (event: MouseEvent): boolean => {
    if (event.target !== box) return false;
    const r = box.getBoundingClientRect();
    return event.clientX < r.left || event.clientX >= r.right || event.clientY < r.top || event.clientY >= r.bottom;
  };
  let downOutside = false;
  box.addEventListener("pointerdown", (event) => { downOutside = outside(event); });
  box.addEventListener("click", (event) => { if (downOutside && outside(event)) shut(); downOutside = false; });
}

/**
 * The browser's own modal: it opens with the keyboard on `back`, the way back. Escape closes it, as does a press that starts and ends on the
 * dimmed page outside the box's border; a press on its own padding does nothing, nor one that starts inside and ends outside, or the other
 * way. The focus returns to what opened it. Tab past its last control leaves the page, which is inert behind it: no trap is added.
 */
export function dialog(box: HTMLDialogElement, back: HTMLElement): (opener: HTMLElement) => void {
  let opener: HTMLElement | undefined;
  scrimCloses(box, () => box.close());
  box.addEventListener("close", () => { hideTip(); if (opener !== undefined) giveBack(opener); opener = undefined; });
  return (from) => {
    opener = from;
    shutMenu();
    hideTip();
    box.showModal();
    back.focus();
  };
}

// ---- Toast ----

const HAN = /[㐀-鿿]/g;

/**
 * How long a toast stays, in milliseconds, read from its words: a second and 400 ms for each word, two Chinese characters counted as
 * one, and never under three seconds, or under five where it reports a failure or names an act.
 */
export function toastStay(words: string, asks: boolean): number {
  const read = (words.match(HAN)?.length ?? 0) / 2 + words.replace(HAN, " ").split(/\s+/).filter((one) => /[\p{L}\p{N}]/u.test(one)).length;
  return Math.max(asks ? 5000 : 3200, 1000 + Math.round(read * 400));
}

/** One line at the window's foot, a status; it stays while the pointer or the focus is on it, and leaves by itself after. */
export function toast(): { readonly element: HTMLElement; readonly tell: (words: string, asks?: boolean) => void } {
  const element = h("p", { class: "f-toast", role: "status", hidden: true });
  let leaving: ReturnType<typeof setTimeout> | undefined;
  // The pointer and the focus each hold it, apart: one leaving does not end the other's hold.
  const holds = { pointer: false, focus: false };
  let stay = 0;
  const leave = (): void => { clearTimeout(leaving); if (!holds.pointer && !holds.focus) leaving = setTimeout(() => { element.hidden = true; element.tabIndex = -1; }, stay); };
  const hold = (by: keyof typeof holds, on: boolean): void => { holds[by] = on; if (on) clearTimeout(leaving); else leave(); };
  element.addEventListener("pointerenter", () => hold("pointer", true));
  element.addEventListener("pointerleave", () => hold("pointer", false));
  element.addEventListener("focus", () => hold("focus", true));
  element.addEventListener("blur", () => hold("focus", false));
  // A press on it keeps the focus where it was.
  element.addEventListener("mousedown", (event) => event.preventDefault());
  const tell = (words: string, asks = false): void => {
    // Emptied first, so a screen reader hears the same words said twice.
    element.textContent = "";
    element.hidden = false;
    element.tabIndex = 0;
    element.textContent = words;
    stay = toastStay(words, asks);
    leave();
  };
  return { element, tell };
}

// ---- Choice ----

export interface ChoiceValue {
  /** The words in the cell, or, for a mark, its name: a screen reader's, and its tooltip's. */
  readonly name: string;
  readonly mark?: () => SVGElement;
  /** What the cell shows where it is not its name, which is then the cell's name alone. */
  readonly shown?: Child;
  /** The page's own name for the cell, as its `data-key`, so a page drawn again can give it back the keyboard. */
  readonly key?: string;
  /**
   * A field the value holds, drawn in its cell before its words and inside its pill, after its cell for the keyboard: the last value only,
   * as a typed time is in 自定义.
   */
  readonly field?: HTMLElement;
}
export interface ChoiceOptions {
  readonly label: string;
  readonly values: readonly ChoiceValue[];
  readonly held: number;
  /** A value set (`radiogroup`) or a view switched (`tablist`). */
  readonly role?: "radiogroup" | "tablist";
  /** A value taken, by a press or by the keys. */
  readonly take: (index: number, by: "press" | "keys") => void;
}

/**
 * The choice whose value was just taken, until a choice of the same name is next drawn: a page that draws itself again as it takes a
 * value, then or once its answer comes, draws a new choice that starts at the value it left and slides from there. Its name is its
 * values' keys, which do not change with the language as its label does when it is the language that was taken.
 */
let taking: { readonly name: string; readonly from: number } | undefined;

/**
 * A few values all in sight, on one track: one Tab stop; Left and Right (and Up and Down in a radio group) move and hold, Home and End; the
 * pill slides to the value taken by a press or a key, and is placed with no motion when it is drawn, when the window changes size and when
 * the words change.
 */
export function choice(options: ChoiceOptions): { readonly element: HTMLElement; readonly hold: (index: number) => void } {
  const role = options.role ?? "radiogroup";
  const state = role === "tablist" ? "aria-selected" : "aria-checked";
  const marks = options.values.some((value) => value.mark !== undefined);
  const cells = options.values.map((value, index) => {
    const named = value.mark !== undefined || value.shown !== undefined;
    const cell = h("button", { type: "button", role: role === "tablist" ? "tab" : "radio", [state]: String(index === options.held), tabindex: index === options.held ? "0" : "-1",
      "aria-label": named ? value.name : undefined, "data-key": value.key, class: value.field === undefined ? undefined : "f-after" },
      value.mark !== undefined ? value.mark() : value.shown ?? value.name);
    return value.mark === undefined ? cell : tip(cell, value.name);
  });
  const field = options.values.at(-1)?.field;
  field?.classList.add("f-field");
  const pill = h("i", { class: "f-pill", "aria-hidden": "true" });
  const name = options.values.every((value) => value.key !== undefined) ? options.values.map((value) => value.key).join(" ") : options.label;
  const element = h("div", { class: marks ? "f-seg icons" : "f-seg", role, "aria-label": options.label }, pill, ...cells, field);
  let at = options.held;
  const place = (index: number, slide: boolean): void => {
    const held = cells[index];
    if (held === undefined) return;
    element.classList.toggle("still", !slide);
    // The last value's field stands in its pill with it.
    const left = index === cells.length - 1 && field !== undefined ? Math.min(held.offsetLeft, field.offsetLeft) : held.offsetLeft;
    const right = index === cells.length - 1 && field !== undefined ? Math.max(held.offsetLeft + held.offsetWidth, field.offsetLeft + field.offsetWidth) : held.offsetLeft + held.offsetWidth;
    pill.style.setProperty("--f-x", `${left}px`);
    pill.style.setProperty("--f-w", `${right - left}px`);
  };
  const show = (index: number, slide: boolean): void => {
    at = index;
    cells.forEach((cell, n) => { cell.setAttribute(state, String(n === index)); cell.tabIndex = n === index ? 0 : -1; });
    place(index, slide);
  };
  const take = (index: number, by: "press" | "keys"): void => {
    if (index === at) return;
    const was = at;
    show(index, true);
    cells[index]?.focus();
    taking = { name, from: was };
    options.take(index, by);
  };
  element.addEventListener("click", (event) => { const index = cells.indexOf((event.target as Element).closest("button") as HTMLButtonElement); if (index >= 0) take(index, "press"); });
  element.addEventListener("keydown", (event) => {
    if (event.target === field) return;
    const n = cells.length;
    const keys: Readonly<Record<string, number>> = { ArrowRight: (at + 1) % n, ArrowLeft: (at - 1 + n) % n, Home: 0, End: n - 1, ...(role === "radiogroup" ? { ArrowDown: (at + 1) % n, ArrowUp: (at - 1 + n) % n } : {}) };
    const to = keys[event.key];
    if (to !== undefined) { event.preventDefault(); take(to, "keys"); }
  });
  // Its first report is the observing's own start, a frame after the draw, which would set down a slide from the value left.
  let observed = false;
  if (typeof ResizeObserver === "function") new ResizeObserver(() => { if (observed) place(at, false); observed = true; }).observe(element);
  // Drawn again by the page that took a value, it starts at the value it left and slides on to the one taken.
  // Only a choice still on the page then takes the value left: a draw the page replaced before its first frame does not.
  requestAnimationFrame(() => {
    const from = element.isConnected && taking?.name === name ? taking.from : undefined;
    if (from !== undefined) taking = undefined;
    place(from ?? at, false);
    if (from !== undefined && from !== at) requestAnimationFrame(() => place(at, true));
  });
  return { element, hold: (index) => show(index, false) };
}

// ---- Switch ----

export interface SwitchOptions {
  readonly label: string;
  readonly on: boolean;
  readonly turn: (on: boolean) => void;
  /** It cannot be turned: faded whole, and a press does nothing; it keeps the keyboard, so the line that says why is reached. */
  readonly off?: boolean;
  /** A switch that holds where it is: a press shakes it and calls this, whose caller says why beside it; `turn` is never called. */
  readonly refuse?: () => void;
}

/**
 * A switch: the action colour when on, faded whole when it cannot be turned; busy, it is not pressed; one that holds shakes at a press
 * and stays as it was. No word beside it says its state.
 */
export function switchButton(options: SwitchOptions): { readonly element: HTMLButtonElement; readonly set: (on: boolean) => void; readonly busy: (on: boolean) => void } {
  const element = h("button", { type: "button", class: "f-switch", role: "switch", "aria-checked": String(options.on), "aria-label": options.label, "aria-disabled": options.off === true ? "true" : undefined }, h("i", {}));
  element.addEventListener("click", () => {
    if (element.getAttribute("aria-disabled") === "true") return;
    if (options.refuse !== undefined) {
      element.classList.remove("f-refused");
      void element.offsetWidth;
      element.classList.add("f-refused");
      options.refuse();
      return;
    }
    const on = element.getAttribute("aria-checked") !== "true";
    element.setAttribute("aria-checked", String(on));
    options.turn(on);
  });
  const set = (on: boolean): void => element.setAttribute("aria-checked", String(on));
  const busy = (on: boolean): void => {
    if (on) { element.setAttribute("aria-busy", "true"); element.setAttribute("aria-disabled", "true"); }
    else { element.removeAttribute("aria-busy"); element.removeAttribute("aria-disabled"); }
  };
  return { element, set, busy };
}
