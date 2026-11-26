import "./cx.js";
import { svg } from "./dom.js";
import type { CxFigure, DrawnMark, DrawnPath, Ink, Shape } from "../shared/drawn-mark.js";

/**
 * A drawn mark as the page draws it (`parts/plugins-page.md`, "The mark"): the 24-unit grid is the tile's middle 60%, as wide as a logo
 * stands, so the drawing's box is the whole tile, under all of it the ground a package names; then the shape the mark stands on, then the package's paths in its order, each `cut`
 * taking itself out of all drawn before it. The shapes are the platform's, each named by what it is, and name no plugin.
 */
const BOX = { x: -8, y: -8, size: 40 } as const;
/** How far a thing drawn in front of cx, or cx in front of another cx, keeps clear of the figure behind it, in grid units. */
const CLEAR = 1;

/** A solid book: its cover, and its pages as a band at the foot, round where the spine turns. A package's paths are its cover's mark. */
const BOOK = "M6.2 2.2h11.6a2.2 2.2 0 0 1 2.2 2.2v15.2a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 19.6V4.4a2.2 2.2 0 0 1 2.2-2.2zM7.6 17.4H18.1V19.6H7.6a1.1 1.1 0 0 1 0-2.2z";
/** The cover's mark: the grid's middle set on the cover's middle, above the band, at 0.68. */
const ON_COVER = "translate(12 9.8) scale(0.68) translate(-12 -12)";
/** A board, 18 by 17: a package's paths are what is on it, mostly cut out of it. */
const PLATE = "M5.5 3.5h13a2.5 2.5 0 0 1 2.5 2.5v12a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18V6a2.5 2.5 0 0 1 2.5-2.5z";
/** A magnifier at the lower right over what is checked: the package's paths, set back to the upper left and cleared around the lens. */
const GLASS = {
  under: "translate(0.4 0.4) scale(0.84)", clear: 6.1,
  lens: "M11.8 16.6a4.8 4.8 0 1 1 9.6 0a4.8 4.8 0 1 1-9.6 0zM13.6 16.6a3 3 0 1 1 6 0a3 3 0 1 1-6 0z",
  handle: "M20.2 20.2l1.9 1.9", width: 2.4,
} as const;

let masks = 0;
const colour = (ink: Ink): string => (ink === "text" ? "currentColor" : ink === "cx-forest" || ink === "cx-sand" ? `var(--${ink})` : ink);
function pathOf(path: Pick<DrawnPath, "d" | "rule" | "width">, ink: string, grow = 0, place?: string): SVGPathElement {
  const at = place === undefined ? {} : { transform: place };
  if (path.width !== undefined) return svg("path", { d: path.d, fill: "none", stroke: ink, "stroke-width": String(path.width + 2 * grow), "stroke-linecap": "round", "stroke-linejoin": "round", ...at });
  return svg("path", { d: path.d, fill: ink, "fill-rule": path.rule, ...(grow === 0 ? {} : { stroke: ink, "stroke-width": String(2 * grow), "stroke-linejoin": "round" }), ...at });
}
/** `drawn` with `holes` taken out of it: a mask of its own, so no drawing reads another's, hidden or gone. */
function cutOf(drawn: readonly SVGElement[], holes: readonly SVGElement[]): SVGElement[] {
  if (holes.length === 0) return [...drawn];
  const id = `mark-cut-${++masks}`;
  const area = { x: String(BOX.x), y: String(BOX.y), width: String(BOX.size), height: String(BOX.size) };
  const mask = svg("mask", { id, maskUnits: "userSpaceOnUse", ...area }, svg("rect", { ...area, fill: "white" }), ...holes);
  return [mask, svg("g", { mask: `url(#${id})` }, ...drawn)];
}
/** The package's paths over `under`, in order: a cut path takes itself out of everything drawn before it. */
function paths(under: readonly SVGElement[], draw: readonly DrawnPath[], place?: string): SVGElement[] {
  return draw.reduce<SVGElement[]>((drawn, path) => (path.cut === true ? cutOf(drawn, [pathOf(path, "black", 0, place)]) : [...drawn, pathOf(path, colour(path.ink), 0, place)]), [...under]);
}

let still: SVGSVGElement | undefined;
const PALETTE: Readonly<Record<CxFigure["ink"], Readonly<Record<string, string>>>> = {
  cx: {},
  "cx-forest": { "--cx-sand": "var(--cx-forest)", "--cx-sand-shade": "var(--cx-forest-shade)" },
  "cx-sand": { "--cx-forest": "var(--cx-sand)", "--cx-forest-shade": "var(--cx-sand-shade)" },
};
/** cx as `cx.js` draws it standing still, without its hands, its middle at the figure's place and `size` as wide as cx.js's mark. */
function figure(one: CxFigure): SVGSVGElement {
  still ??= CxCharacter.mount(document.createElement("div"), { size: CxCharacter.MARK_W, state: "ready", motion: "still" }).element;
  const drawn = still.cloneNode(true) as SVGSVGElement;
  drawn.querySelector(".cx-hands")?.remove();
  // The figure's masks and clips are named anew in each drawing, as `cx.js` names them in each mount.
  const own = `-mark${++masks}`;
  for (const named of drawn.querySelectorAll("[id]")) named.id += own;
  for (const user of drawn.querySelectorAll("[mask], [clip-path]")) for (const key of ["mask", "clip-path"]) {
    const ref = user.getAttribute(key);
    if (ref !== null) user.setAttribute(key, ref.replace(/url\(#([^)]+)\)/, `url(#$1${own})`));
  }
  const k = one.size / CxCharacter.MARK_W, box = CxCharacter.BOX;
  for (const [key, value] of Object.entries({ x: one.x + box.x * k, y: one.y + box.y * k, width: box.w * k, height: box.h * k })) drawn.setAttribute(key, String(value));
  for (const [name, value] of Object.entries(PALETTE[one.ink])) drawn.style.setProperty(name, value);
  return drawn;
}
/** cx's outline, grown by `CLEAR`: what a figure in front cuts out of one behind it. */
const outline = (one: CxFigure): SVGElement[] => {
  const k = one.size / CxCharacter.MARK_W;
  return [-19, 19].map((side) => svg("circle", { cx: String(one.x + side * k), cy: String(one.y), r: String(37.5 * k + CLEAR), fill: "black" }));
};

const SHAPES: Readonly<Record<Shape, (mark: DrawnMark) => SVGElement[]>> = {
  book: (mark) => paths([svg("path", { d: BOOK, fill: "currentColor", "fill-rule": "evenodd" })], mark.draw, ON_COVER),
  board: (mark) => paths([svg("path", { d: PLATE, fill: "currentColor" })], mark.draw),
  glass: (mark) => {
    const clear = svg("circle", { cx: "16.6", cy: "16.6", r: String(GLASS.clear), fill: "black" });
    return [...cutOf([svg("g", { transform: GLASS.under }, ...paths([], mark.draw))], [clear]),
      svg("path", { d: GLASS.lens, fill: "currentColor", "fill-rule": "evenodd" }),
      svg("path", { d: GLASS.handle, fill: "none", stroke: "currentColor", "stroke-width": String(GLASS.width), "stroke-linecap": "round" })];
  },
  // Each figure stands behind those declared after it and behind what the package draws, each cut clear of it.
  cx: (mark) => {
    const figures = mark.cx ?? [{ x: 12, y: 12, size: 32.9, ink: "cx" } as const];
    const held = mark.draw.filter((path) => path.cut !== true).map((path) => pathOf(path, "black", CLEAR));
    const people = figures.flatMap((one, n) => cutOf([figure(one)], [...figures.slice(n + 1).flatMap(outline), ...held.map((hole) => hole.cloneNode(true) as SVGElement)]));
    return paths(people, mark.draw);
  },
};

/** The SVG of a drawn mark, built element by element from what the reader kept. */
export function drawMark(mark: DrawnMark): SVGSVGElement {
  const ground = mark.ground === undefined ? [] : [svg("rect", { x: String(BOX.x), y: String(BOX.y), width: String(BOX.size), height: String(BOX.size), fill: mark.ground })];
  return svg("svg", { class: "pl-drawn", viewBox: `${BOX.x} ${BOX.y} ${BOX.size} ${BOX.size}` }, ...ground, ...(mark.on === undefined ? paths([], mark.draw) : SHAPES[mark.on](mark)));
}
