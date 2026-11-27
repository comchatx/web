import { fill, h } from "./dom.js";

/**
 * The place to fill in at the tutorial's last scene, as a box on the page: a run of the message box's own words (sheet 9, 2.8), which
 * cx stands above and points at. A text box does not say where its words stand, so they are laid out again, unseen, at its width and in
 * its type (`mirror`), and the run's place there is its place in the box. The measure is the signed prototype's, as it is.
 */

const COPIED = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontFeatureSettings", "fontKerning", "letterSpacing", "wordSpacing", "lineHeight",
  "textTransform", "textIndent", "tabSize", "whiteSpace", "wordBreak", "overflowWrap", "lineBreak", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "direction"] as const;

export type FillBox = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };

/** The mirror the words are laid out in, and the mark without ink that stands over the place: both taken out of the page's reading. */
export function fillParts(): { readonly mirror: HTMLElement; readonly mark: HTMLElement } {
  return { mirror: h("div", { class: "cx-fill-mirror", "aria-hidden": "true" }), mark: h("span", { class: "cx-fill", "aria-hidden": "true", hidden: "" }) };
}

/**
 * Where the `length` characters from `at` of the box's words stand in the window: the widest line of the run, where it runs onto a
 * second. None for a box not drawn, or a run scrolled more than half out of the box, which is not there to stand by.
 */
export function fillPlace(draft: HTMLTextAreaElement, mirror: HTMLElement, at: number, length: number): FillBox | null {
  if (at < 0 || draft.getClientRects().length === 0) return null;
  const style = getComputedStyle(draft);
  for (const name of COPIED) mirror.style[name] = style[name];
  mirror.style.width = `${draft.clientWidth}px`;
  const words = h("span", {}, draft.value.slice(at, at + length));
  fill(mirror, draft.value.slice(0, at), words, draft.value.slice(at + length));
  const line = [...words.getClientRects()].sort((a, b) => b.width - a.width)[0];
  if (line === undefined) return null;
  const m = mirror.getBoundingClientRect(), box = draft.getBoundingClientRect();
  const inside = { top: box.top + draft.clientTop, bottom: box.top + draft.clientTop + draft.clientHeight };
  const left = box.left + draft.clientLeft + line.left - m.left - draft.scrollLeft, top = inside.top + line.top - m.top - draft.scrollTop;
  if (Math.min(top + line.height, inside.bottom) - Math.max(top, inside.top) < line.height / 2) return null;
  return { left, top, width: line.width, height: line.height };
}
