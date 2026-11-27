/**
 * Where cx stands beside a key a guided step leads to, and where its bubble opens: a place beside the key, nearest first, clear of every
 * word, press and picture and of every surface but the one that holds the key, its bubble over cx, under it or at its side, all of it
 * inside the window. A surface is what carries `data-zone` (a card, the computer's window, the message box, a toast; `pane` for a pane
 * of the page such as the sidebar, which cx stands wholly in or wholly out of) and any open dialog. Where a dialog holds the page, only
 * what is inside it counts. The key's own tooltip, where it has one, is kept clear of as well (`tipWouldStand`). Where no place is clear
 * at any width of the bubble, cx stands where it covers least, words and presses weighing a hundred times a surface's ground.
 */

export const GAP = 8;
export const BUB = 4;
export const EDGE = 8;
export const REACH = 56;
/** What a press or a word weighs, per px² cx covers, against 1 for a surface's ground. */
export const WORD = 100;
/** The least of the page a band leaves: one that would leave less is not tried. */
export const ROOM = 160;
/** How near a band is shrunk to the smallest that still makes room. */
export const SHRINK = 4;
const NARROW_TEACH = 160;

export type Box = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number; readonly width: number; readonly height: number };
/** `word` where it is a run of the page's text, not a press or a picture: only words call for a band (guide-band.ts). */
type Hard = Box & { readonly own: boolean; readonly word: boolean };
type Surface = { readonly box: Box; readonly holds: boolean; readonly inner: Box | null };
export type Avoid = { readonly hard: readonly Hard[]; readonly surfaces: readonly Surface[] };
export type Placed = {
  readonly figure: Box;
  readonly bubble: Box | null;
  readonly left: boolean;
  readonly under: boolean;
  readonly side: boolean;
  /** What the place covers: 0 where it is clear. */
  readonly cover: number;
  /** The bubble's width where it was narrowed to find a clear place. */
  readonly width: number | null;
};

const SURFACES = "[data-zone], dialog[open]";
const MARKS = "button, a[href], input, textarea, select, svg, img, [role=img], [role=button], [role=link], [role=tab], [tabindex]:not([tabindex='-1'])";
const MODAL = "dialog:modal";

export const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, right: left + width, bottom: top + height, width, height });
const grow = (r: Box, by: number): Box => box(r.left - by, r.top - by, r.width + 2 * by, r.height + 2 * by);
/** The box round cx's paper and the key at its desk together. */
export function deskOf(paper: Box | DOMRectReadOnly, key: Box | DOMRectReadOnly): Box {
  const left = Math.min(paper.left, key.left);
  const top = Math.min(paper.top, key.top);
  return box(left, top, Math.max(paper.right, key.right) - left, Math.max(paper.bottom, key.bottom) - top);
}
export const inter = (a: Box, b: Box): number => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** The part of the window a node is seen in: the window, cut by every scroller round it. */
function seenIn(node: Element): Box {
  const win = node.ownerDocument.defaultView!;
  let r = box(0, 0, win.innerWidth, win.innerHeight);
  for (let up = node.parentElement; up !== null && up !== node.ownerDocument.body; up = up.parentElement) {
    const style = win.getComputedStyle(up);
    if (style.position === "fixed") break;
    if (!/(auto|scroll|hidden)/.test(style.overflowX + style.overflowY)) continue;
    const u = up.getBoundingClientRect();
    const left = Math.max(r.left, u.left);
    const top = Math.max(r.top, u.top);
    r = box(left, top, Math.max(0, Math.min(r.right, u.right) - left), Math.max(0, Math.min(r.bottom, u.bottom) - top));
  }
  return r;
}

/**
 * What in `doc` cx must keep clear of: `hard`, every word, press and picture (`own` where it is on the card that holds `key`, covered
 * after any other); `surfaces`, every zone, each marked where it holds `key`. `mine` is what is cx's own and counts for nothing.
 */
export function obstacles(doc: Document, key: Element | null, mine: (el: Element) => boolean): Avoid {
  const hard: Hard[] = [];
  const surfaces: Surface[] = [];
  const clip = (r: DOMRectReadOnly, node: Element): Box | null => {
    if (r.width < 1 || r.height < 1) return null;
    const seen = seenIn(node);
    const left = Math.max(r.left, seen.left);
    const top = Math.max(r.top, seen.top);
    const right = Math.min(r.right, seen.right);
    const bottom = Math.min(r.bottom, seen.bottom);
    return right - left < 1 || bottom - top < 1 ? null : box(left, top, right - left, bottom - top);
  };
  const shown = (el: Element | null): el is Element => el !== null && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && !mine(el);
  const modal = [...doc.querySelectorAll(MODAL)].find(shown) ?? null;
  const counts = (el: Element): boolean => modal === null || modal.contains(el);
  const own = (el: Element): boolean => {
    const zone = key === null ? null : el.closest(SURFACES);
    return zone !== null && zone !== key && zone.contains(key) && zone.getAttribute("data-zone") !== "pane";
  };
  const texts = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  for (let n = texts.nextNode(); n !== null; n = texts.nextNode()) {
    const parent = n.parentElement;
    if (n.nodeValue?.trim() === "" || !shown(parent) || !counts(parent)) continue;
    range.selectNodeContents(n);
    const onCard = own(parent);
    for (const r of range.getClientRects()) { const b = clip(r, parent); if (b !== null) hard.push({ ...b, own: onCard, word: true }); }
  }
  for (const el of doc.querySelectorAll(`${MARKS}, ${SURFACES}`)) {
    if (!shown(el) || !counts(el) || el.closest("svg svg") !== null) continue;
    const b = clip(el.getBoundingClientRect(), el);
    if (b === null) continue;
    if (el.matches(MARKS)) { hard.push({ ...b, own: own(el), word: false }); continue; }
    const holds = key !== null && key !== el && el.contains(key);
    const inner = holds && el.getAttribute("data-zone") === "pane" ? box(b.left + EDGE, b.top + EDGE, b.width - 2 * EDGE, b.height - 2 * EDGE) : null;
    surfaces.push({ box: b, holds, inner });
  }
  return { hard, surfaces };
}

type Try = { readonly f: Box; readonly b: Box | null; readonly left: boolean; readonly under: boolean; readonly side: boolean };

/**
 * The places to try, nearest the key first: right of it, left of it, over it and under it, stepping out 4 px at a time up to REACH;
 * then (`level`) higher or lower beside it within its height; then (`card`) just outside the card that holds it, along its edges. At
 * each, the bubble over cx to the right, over it to the left, under it, and last at its side.
 */
function* places(key: Box, fig: { readonly w: number; readonly h: number }, size: { readonly w: number; readonly h: number }, view: Box, level: boolean, card: Box | null): Generator<Try> {
  const cx = key.left + key.width / 2;
  const cy = key.top + key.height / 2;
  const clampX = (x: number): number => Math.max(view.left, Math.min(x, view.right - fig.w));
  const clampY = (y: number): number => Math.max(view.top, Math.min(y, view.bottom - fig.h));
  const shifts: number[] = [];
  for (let t = 1; t <= Math.floor((key.height - fig.h) / 2); t += 1) shifts.push(-t, t);
  const along = (from: number, to: number, at: number): number[] => {
    const out = [at];
    for (let t = 24; at - t >= from || at + t <= to; t += 24) { if (at - t >= from) out.push(at - t); if (at + t <= to) out.push(at + t); }
    return out;
  };
  const ways: ((d: number) => Box[])[] = card !== null ? [
    () => along(card.left, card.right - fig.w, clampX(cx - fig.w / 2)).map((x) => box(clampX(x), card.top - GAP - fig.h, fig.w, fig.h)),
    () => along(card.top, card.bottom - fig.h, clampY(cy - fig.h / 2)).map((y) => box(card.right + GAP, clampY(y), fig.w, fig.h)),
    () => along(card.top, card.bottom - fig.h, clampY(cy - fig.h / 2)).map((y) => box(card.left - GAP - fig.w, clampY(y), fig.w, fig.h)),
    () => along(card.left, card.right - fig.w, clampX(cx - fig.w / 2)).map((x) => box(clampX(x), card.bottom + GAP, fig.w, fig.h)),
  ] : level ? [
    (d) => shifts.map((t) => box(key.right + GAP + d, cy - fig.h / 2 + t, fig.w, fig.h)),
    (d) => shifts.map((t) => box(key.left - GAP - d - fig.w, cy - fig.h / 2 + t, fig.w, fig.h)),
  ] : [
    (d) => [box(key.right + GAP + d, cy - fig.h / 2, fig.w, fig.h)],
    (d) => [box(key.left - GAP - d - fig.w, cy - fig.h / 2, fig.w, fig.h)],
    (d) => [0, -24, 24, -48, 48].map((s) => box(clampX(cx - fig.w / 2 + s), key.top - GAP - d - fig.h, fig.w, fig.h)),
    (d) => [0, -24, 24, -48, 48].map((s) => box(clampX(cx - fig.w / 2 + s), key.bottom + GAP + d, fig.w, fig.h)),
  ];
  const gap = (f: Box): number => Math.hypot(Math.max(0, key.left - f.right, f.left - key.right), Math.max(0, key.top - f.bottom, f.top - key.bottom));
  // Each at the whole pixels it is drawn at, so what is judged clear is what is drawn.
  const whole = (f: Box): Box => box(Math.round(f.left), Math.round(f.top), f.width, f.height);
  const figures: { readonly f: Box; readonly g: number; readonly w: number; readonly d: number; readonly s: number }[] = [];
  ways.forEach((way, w) => { for (let d = 0; d <= (card !== null ? 0 : REACH); d += 4) way(d).forEach((f, s) => { const r = whole(f); figures.push({ f: r, g: gap(r), w, d, s }); }); });
  figures.sort((a, b) => a.g - b.g || a.w - b.w || a.d - b.d || a.s - b.s);
  for (const { f } of figures) yield* around(f, size, view);
}

/** The bubble's places round cx's figure `f`: over it to the right, over it to the left, under it, and last at its side. */
function* around(f: Box, size: { readonly w: number; readonly h: number }, view: Box): Generator<Try> {
  if (size.w === 0) { yield { f, b: null, left: false, under: false, side: false }; return; }
  for (const [left, under] of [[false, false], [true, false], [false, true], [true, true]] as const) {
    yield { f, b: box(left ? f.right + BUB - size.w : f.left - BUB, under ? f.bottom + BUB : f.top - BUB - size.h, size.w, size.h), left, under, side: false };
  }
  const by = Math.max(view.top, Math.min(f.top + f.height / 2 - size.h / 2, view.bottom - size.h));
  yield { f, b: box(f.right + BUB, by, size.w, size.h), left: false, under: false, side: true };
  yield { f, b: box(f.left - BUB - size.w, by, size.w, size.h), left: true, under: false, side: true };
}

/**
 * The place for cx beside `key` (in the window's pixels), its figure `fig` px, its bubble measured by `measure` at a width (null for
 * its own), against `avoid`, inside `view`, clear of the key's tooltip `tip` where one is. A bubble that finds no clear place narrows,
 * 0.85 of its width at a time down to NARROW_TEACH, to the first clear place; where none is at any width, the place that covers least
 * at its own width. Null where no place keeps cx and its bubble inside the window.
 */
export function placeBeside(options: {
  readonly key: Box;
  readonly fig: { readonly w: number; readonly h: number };
  readonly measure: (width: number | null) => { readonly w: number; readonly h: number };
  readonly avoid: Avoid;
  readonly view: Box;
  readonly tip?: Box | null;
  /** Where cx stands already and stays (at its desk): only its bubble is placed. */
  readonly at?: Box;
}): Placed | null {
  const { key, fig, measure, avoid, view, at } = options;
  const touch = grow(key, 4);
  const tipped = options.tip === null || options.tip === undefined ? null : grow(options.tip, 2);
  const parts = (p: Try): Box[] => (p.b === null ? [p.f] : [p.f, p.b]);
  const inside = (p: Try): boolean => parts(p).every((r) => r.left >= view.left && r.top >= view.top && r.right <= view.right && r.bottom <= view.bottom);
  const judge = (p: Try, firm: boolean): { readonly cover: number; readonly across: boolean } => {
    let cover = 0;
    let across = false;
    for (const r of at !== undefined ? (p.b === null ? [] : [p.b]) : parts(p)) {
      const g = grow(r, 2);
      for (const o of avoid.hard) cover += (o.own ? 3 * WORD : WORD) * inter(g, o);
      if (!firm && tipped !== null) cover += WORD * inter(r, tipped);
      for (const s of avoid.surfaces) {
        const a = inter(r, s.box);
        if (a === 0) continue;
        if (!s.holds) cover += a;
        else if (s.inner !== null) cover += Math.max(0, r.width * r.height - inter(r, s.inner));
        else if (a < r.width * r.height - 0.5) across = true;
      }
    }
    return { cover, across };
  };
  const card = avoid.surfaces.filter((s) => s.holds && s.inner === null).map((s) => s.box).sort((a, b) => a.width * a.height - b.width * b.height)[0] ?? null;
  const find = (size: { readonly w: number; readonly h: number }, firm: boolean): (Try & { readonly cover: number }) | null => {
    let across: (Try & { readonly cover: number }) | null = null;
    let least: (Try & { readonly cover: number }) | null = null;
    const sets = at !== undefined ? [around(at, size, view)] : ([[false, null], [true, null], ...(card === null ? [] : [[false, card] as const])] as const).map(([level, edge]) => places(key, fig, size, view, level, edge));
    for (const set of sets) {
      for (const p of set) {
        // Standing at its desk, cx may be on the key (its own computer, itself): only the bubble keeps off it.
        const free = at !== undefined ? (p.b === null ? [] : [p.b]) : parts(p);
        if (!inside(p) || free.some((r) => inter(r, touch) > 0) || (firm && tipped !== null && free.some((r) => inter(r, tipped) > 0))) continue;
        const j = judge(p, firm);
        if (j.cover === 0 && !j.across) return { ...p, cover: 0 };
        if (j.cover === 0) across ??= { ...p, cover: 0 };
        if (least === null || j.cover < least.cover) least = { ...p, cover: j.cover };
      }
    }
    return across ?? least;
  };
  let held: Placed | null = null;
  for (const firm of tipped === null ? [true] : [true, false]) {
    const natural = measure(null);
    let best = natural.w > view.width ? null : find(natural, firm);
    let width: number | null = null;
    for (let w = Math.min(natural.w, view.width); !(best !== null && best.cover === 0); ) {
      w = Math.round(w * 0.85);
      if (natural.w === 0 || w < NARROW_TEACH) break;
      const p = find(measure(w), firm);
      if (p !== null && (p.cover === 0 || best === null)) { best = p; width = w; }
    }
    const placed = best === null ? null : { figure: best.f, bubble: best.b, left: best.left, under: best.under, side: best.side, cover: best.cover, width };
    if (placed !== null && placed.cover === 0) return placed;
    if (held === null || (placed !== null && placed.cover < held.cover)) held = placed;
  }
  return held;
}
