import { h } from "./dom.js";

/**
 * cx's bubble beside a key, as a guided step draws it: main's own bubble (`.cx-bubble`, its ground, edge, shadow, corners, tail and
 * type), grown to teach (`.teach`): a title, a line or two, what to press, and 跳过 beside it on the last row. It takes the pointer and
 * the keys; the figure under it still takes neither.
 */
export type Teach = { readonly title: string; readonly lines: readonly string[]; readonly press: string; readonly skip: string };

/** The bubble's words as a guided step says them, 跳过 pressing `skipped`. */
export function teach(bubble: HTMLElement, words: Teach, skipped: () => void): void {
  bubble.replaceChildren(
    h("span", { class: "teach-said" }, h("span", { class: "teach-title" }, words.title), ...words.lines.map((line) => h("span", { class: "teach-line" }, line))),
    h("span", { class: "teach-foot" }, h("span", { class: "teach-press" }, words.press),
      h("button", { type: "button", class: "f-btn", "data-act": "skip", onclick: () => skipped() }, words.skip)));
  bubble.classList.add("teach");
  bubble.style.width = "";
}

/**
 * A bubble that teaches is as wide as its widest line: laid out as wide as app.css lets it, then drawn at the width its longest line
 * needs (each line of its title and lines as they wrap, and the last row, the press and 跳过 side by side), so no side of it and no row
 * in it stands empty. Where the narrower width would break a line again, the wider one stays.
 */
export function fit(bubble: HTMLElement): void {
  bubble.style.width = "";
  if (!bubble.classList.contains("teach")) return;
  const doc = bubble.ownerDocument;
  const win = doc.defaultView;
  if (win === null) return;
  const cs = win.getComputedStyle(bubble);
  if (cs.clipPath !== "none" || cs.display === "none") return;
  const px = (v: string): number => Number.parseFloat(v) || 0;
  const edges = px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth);
  const range = doc.createRange();
  for (let round = 0; round < 3; round += 1) {
    const r = bubble.getBoundingClientRect();
    if (!(r.width > 0) || !(bubble.offsetWidth > 0)) return;
    // A scale on the figure: lines are read in its pixels, the width set in the bubble's own.
    const k = r.width / bubble.offsetWidth;
    const start = r.left + (px(cs.borderLeftWidth) + px(cs.paddingLeft)) * k;
    const widest = (el: Element, from?: number): number => {
      range.selectNodeContents(el);
      let w = 0;
      for (const q of range.getClientRects()) w = Math.max(w, (q.right - (from ?? q.left)) / k);
      return w;
    };
    let need = 0;
    for (const el of bubble.querySelectorAll(".teach-title, .teach-line")) need = Math.max(need, widest(el, start));
    const foot = bubble.querySelector(".teach-foot");
    const press = foot?.querySelector(".teach-press");
    const skip = foot?.querySelector("button");
    if (foot && press && skip) need = Math.max(need, widest(press) + skip.getBoundingClientRect().width / k + px(win.getComputedStyle(foot).columnGap));
    const width = Math.ceil(need + (cs.boxSizing === "border-box" ? edges : 0) - 0.01);
    const height = bubble.offsetHeight;
    const was = bubble.style.width;
    if (Math.abs(width - bubble.offsetWidth) < 1) return;
    bubble.style.width = `${width}px`;
    if (bubble.offsetHeight > height) { bubble.style.width = was; return; }
  }
}

const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** What takes the focus in `doc`, in its order: in a modal dialog, only what the dialog holds. */
function tabbables(doc: Document): HTMLElement[] {
  const within = doc.querySelector("dialog:modal") ?? doc;
  return [...within.querySelectorAll<HTMLElement>(TABBABLE)].filter((el) => el.tabIndex >= 0 && el.closest("[inert]") === null && el.checkVisibility({ checkVisibilityCSS: true }));
}

/**
 * What comes after `key` in the page's order, the bubble left out: in a modal dialog, past its last press, its first again; past the
 * page's last, nothing, and the browser goes on as it would. Undefined where the key does not take the focus.
 */
export function afterKey(key: Element, bubble: Element): HTMLElement | null | undefined {
  const doc = key.ownerDocument;
  const list = tabbables(doc).filter((el) => !bubble.contains(el));
  const at = list.indexOf(key as HTMLElement);
  if (at < 0) return undefined;
  return list[at + 1] ?? (doc.querySelector("dialog:modal") === null ? null : list[0] ?? null);
}

/**
 * 跳过 in the order right after the key cx points at, as a popover's presses follow the press they belong to: Tab on the key goes to
 * 跳过, Tab on 跳过 to what came after the key, and Shift+Tab back the same way. Where the key is the page's last, 跳过, drawn after it,
 * is already next in the page's own order and is left there. On a modal dialog the bubble stands inside it, so 跳过 goes round with
 * the dialog's presses. Gives what ends it.
 */
export function tabBeside(doc: Document, bubble: HTMLElement, keyOf: () => Element | null): () => void {
  const keys = (event: KeyboardEvent): void => {
    if (event.key !== "Tab" || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const skip = bubble.querySelector<HTMLElement>('[data-act="skip"]');
    const key = keyOf();
    if (skip === null || key === null || !key.isConnected) return;
    const after = afterKey(key, bubble);
    skip.tabIndex = after ? -1 : 0;
    if (after === undefined) return;
    const at = event.target;
    const to = at === skip ? (event.shiftKey ? key : after) : at === key && !event.shiftKey ? skip : after !== null && at === after && event.shiftKey ? skip : null;
    if (to === null || !(to instanceof HTMLElement)) return;
    event.preventDefault();
    to.focus({ preventScroll: to === skip });
  };
  doc.addEventListener("keydown", keys, true);
  return () => doc.removeEventListener("keydown", keys, true);
}

/**
 * Where the bubble stands: back in cx's place, as main draws it, with `at` null; else at `at` (in the window's pixels, as the placement
 * found it, guide-place.ts), in `home` (cx's place, or the modal dialog that holds the key, which keeps everything outside it from the
 * pointer and the keys, so 跳过 can be pressed and goes round with the dialog's presses), its tail towards cx by `way`.
 */
export function standAt(bubble: HTMLElement, home: HTMLElement | Element, way: { readonly left: boolean; readonly under: boolean; readonly side: boolean } | null, at: { readonly left: number; readonly top: number } | null): void {
  if (at === null || way === null) {
    if (bubble.parentElement !== home) home.insertBefore(bubble, home.children[1] ?? null);
    bubble.classList.remove("fixed", "hold", "left", "under", "side");
    Object.assign(bubble.style, { left: "", top: "", width: "" });
    return;
  }
  if (bubble.parentElement !== home) home.append(bubble);
  bubble.classList.add("fixed");
  bubble.classList.toggle("left", way.left);
  bubble.classList.toggle("under", way.under);
  bubble.classList.toggle("side", way.side);
  // A fixed box is laid from its containing block, the window unless an ancestor is transformed: read where it begins.
  Object.assign(bubble.style, { left: "0px", top: "0px" });
  const origin = bubble.getBoundingClientRect();
  Object.assign(bubble.style, { left: `${at.left - origin.left}px`, top: `${at.top - origin.top}px` });
}
