/**
 * The one thing a guided step leads the seller to press ripples: a ring of the action colour leaves the press's own edge, grows 10 px
 * out and fades, once every two seconds, for as long as the step waits for the press (app.css `.ripple`). Under reduced motion it
 * stands still, a band round the press apart from the keyboard's focus ring. The ring takes no pointer, so the press keeps its own.
 *
 * It is laid over the press each frame from where the press is then, so it follows a scroll or a page that moves. It stands in the
 * modal dialog that holds the press, if one does: a modal dialog is drawn over everything outside it, a ring included.
 */

/** How far the ring draws past the press's edge, in px: 10 px out, and its 2 px line. */
export const RIPPLE_REACH = 12;

type Edges = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

/** The press's corner radius in px as drawn: its own border-radius, or for a shape of cx's scene (an SVG rect) its `rx` at its scale. */
export function radiusOf(node: Element): number {
  const win = node.ownerDocument.defaultView;
  if (win === null) return 0;
  if (node instanceof win.SVGGraphicsElement) {
    const rx = Number.parseFloat(node.getAttribute("rx") ?? "0") || 0;
    const m = node.getScreenCTM();
    return m === null ? 0 : rx * Math.hypot(m.a, m.b);
  }
  const v = win.getComputedStyle(node).borderTopLeftRadius;
  const n = Number.parseFloat(v) || 0;
  return v.endsWith("%") ? (n / 100) * node.getBoundingClientRect().width : n;
}

/** The part of the window the press is seen in: the window, cut by every scroller round the press. */
export function seenOf(node: Element): Edges {
  const win = node.ownerDocument.defaultView;
  if (win === null) return { left: 0, top: 0, right: 0, bottom: 0 };
  let seen: Edges = { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight };
  for (let up = node.parentElement; up !== null && up !== node.ownerDocument.body; up = up.parentElement) {
    const style = win.getComputedStyle(up);
    if (style.position === "fixed") break;
    if (!/(auto|scroll)/.test(style.overflowX + style.overflowY)) continue;
    const u = up.getBoundingClientRect();
    seen = { left: Math.max(seen.left, u.left), top: Math.max(seen.top, u.top), right: Math.min(seen.right, u.right), bottom: Math.min(seen.bottom, u.bottom) };
  }
  return seen;
}

/**
 * Lays the ring `mark` over the press's box, in client px, its corners rounded as the press's are. Its ring goes RIPPLE_REACH past each edge, past
 * the edge of the scroller round the press too (a tab that fills its row); only where the press itself is cut by its scroller or the
 * window (`seen`) is the ring cut with it. `at` is where the mark's own frame begins in client px (a modal dialog's, where it stands in
 * one).
 */
export function placeRipple(mark: HTMLElement, box: DOMRectReadOnly, radius: number, seen: Edges, at: { readonly x: number; readonly y: number }): void {
  const cut = (inset: number): string => `${(inset > 0.5 ? inset : -RIPPLE_REACH).toFixed(1)}px`;
  Object.assign(mark.style, {
    left: `${box.left - at.x}px`, top: `${box.top - at.y}px`, width: `${box.width}px`, height: `${box.height}px`, borderRadius: `${radius.toFixed(1)}px`,
    clipPath: `inset(${cut(seen.top - box.top)} ${cut(box.right - seen.right)} ${cut(box.bottom - seen.bottom)} ${cut(seen.left - box.left)})`,
  });
  mark.hidden = false;
}

export type Ripple = {
  /** Ripples round the press `press` finds each frame (a draw may draw it anew) from now on, or stops with `null`. */
  show(press: (() => Element | null) | null): void;
  readonly element: HTMLElement;
};

/** A ripple for `doc`: one ring, moved to the press shown, drawn each frame while there is one. */
export function ripple(doc: Document): Ripple {
  const mark = doc.createElement("div");
  mark.className = "ripple";
  mark.hidden = true;
  mark.setAttribute("aria-hidden", "true");
  let press: (() => Element | null) | null = null;
  let frame = 0;
  const win = doc.defaultView;
  const tick = (): void => {
    frame = 0;
    if (press === null || win === null) return;
    frame = win.requestAnimationFrame(tick);
    const key = press();
    if (key === null || !key.isConnected) { mark.hidden = true; return; }
    const home = key.closest("dialog:modal") ?? doc.body;
    if (mark.parentElement !== home) home.append(mark);
    // A fixed box is laid from its containing block, the window unless an ancestor is transformed: read where it begins.
    mark.style.left = "0px";
    mark.style.top = "0px";
    mark.hidden = false;
    const origin = mark.getBoundingClientRect();
    placeRipple(mark, key.getBoundingClientRect(), radiusOf(key), seenOf(key), { x: origin.left, y: origin.top });
  };
  return Object.freeze({
    element: mark,
    show(next: (() => Element | null) | null): void {
      press = next;
      if (next === null) { if (frame !== 0) win?.cancelAnimationFrame(frame); frame = 0; mark.hidden = true; return; }
      // Shown again, the ring starts from the press's edge.
      mark.getAnimations({ subtree: true }).forEach((one) => { one.currentTime = 0; });
      if (frame === 0) tick();
    },
  });
}
