/**
 * A plugin's mark as drawing (`parts/plugins-page.md`, "The mark"): paths on a 24-unit grid, the middle 60% of the tile, each in an ink
 * from a closed list, on the tile's own ground or one colour the package names, alone or on one of the platform's four shapes. The page
 * builds the SVG from these values element by element, so nothing a package writes reaches it as markup, a style or an address.
 */

/** The theme's text, cx's two colours, or a colour of the package's own. */
export type Ink = "text" | "cx-forest" | "cx-sand" | `#${string}`;
/** One path: filled by its rule, or drawn as a line `width` units wide; a `cut` path takes itself out of what the mark drew before it. */
export type DrawnPath = { readonly d: string; readonly ink: Ink; readonly rule: "nonzero" | "evenodd"; readonly width?: number; readonly cut?: true };
/** Where cx stands in a mark on `cx`: its middle on the grid, its width (cx.js's 126 of its own units), and its colours. */
export type CxFigure = { readonly x: number; readonly y: number; readonly size: number; readonly ink: "cx" | "cx-forest" | "cx-sand" };
/** The platform's shapes a mark may stand on, each named by what it is. */
export const SHAPES = ["book", "glass", "board", "cx"] as const;
export type Shape = (typeof SHAPES)[number];
export type DrawnMark = { readonly draw: readonly DrawnPath[]; readonly ground?: string; readonly on?: Shape; readonly cx?: readonly CxFigure[] };
/** A drawn mark as it is declared: a path's ink left out is the text's and its rule `nonzero`, a figure's ink left out is cx's own. */
export type DeclaredMark = {
  readonly draw?: readonly (Omit<DrawnPath, "ink" | "rule"> & { readonly ink?: Ink; readonly rule?: DrawnPath["rule"] })[];
  readonly ground?: string; readonly on?: Shape; readonly cx?: readonly (Omit<CxFigure, "ink"> & { readonly ink?: CxFigure["ink"] })[];
};

const HEX = /^#[0-9A-Fa-f]{6}$/;
/** SVG's path data: its commands and numbers, nothing else. */
const PATH = /^\s*[Mm][MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]*$/;
const MOST_PATHS = 24, MOST_D = 16_384, MOST_FIGURES = 3;
const record = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value);
const within = (value: unknown, least: number, most: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= least && value <= most;

function readPath(value: unknown): DrawnPath | undefined {
  if (!record(value)) return undefined;
  const d = value["d"], ink = value["ink"] ?? "text", rule = value["rule"] ?? "nonzero", width = value["width"], cut = value["cut"];
  if (typeof d !== "string" || !PATH.test(d) || d.length > MOST_D) return undefined;
  if (typeof ink !== "string" || !(ink === "text" || ink === "cx-forest" || ink === "cx-sand" || HEX.test(ink))) return undefined;
  if (rule !== "nonzero" && rule !== "evenodd") return undefined;
  if (width !== undefined && !(within(width, 0, 12) && width > 0)) return undefined;
  if (cut !== undefined && cut !== true) return undefined;
  return Object.freeze({ d, ink: ink as Ink, rule, ...(width === undefined ? {} : { width }), ...(cut === true ? { cut } : {}) });
}

function readFigure(value: unknown): CxFigure | undefined {
  if (!record(value)) return undefined;
  const x = value["x"], y = value["y"], size = value["size"], ink = value["ink"] ?? "cx";
  if (!within(x, -12, 36) || !within(y, -12, 36) || !within(size, 0, 48) || size === 0) return undefined;
  if (ink !== "cx" && ink !== "cx-forest" && ink !== "cx-sand") return undefined;
  return Object.freeze({ x, y, size, ink });
}

/**
 * A package's drawn mark, each value read once and kept as read, or nothing where any part of it is refused: then the plugin is drawn
 * with no mark and the rest of its field stands.
 */
export function readDrawnMark(value: unknown): DrawnMark | undefined {
  if (!record(value)) return undefined;
  const draw = value["draw"] ?? [], ground = value["ground"], on = value["on"], figures = value["cx"];
  if (!Array.isArray(draw) || draw.length > MOST_PATHS) return undefined;
  if (on !== undefined && !SHAPES.includes(on as Shape)) return undefined;
  if (ground !== undefined && (typeof ground !== "string" || !HEX.test(ground))) return undefined;
  if (draw.length === 0 && on !== "cx") return undefined;
  const paths = draw.map(readPath);
  if (paths.some((one) => one === undefined)) return undefined;
  let cx: readonly CxFigure[] | undefined;
  if (figures !== undefined) {
    if (on !== "cx" || !Array.isArray(figures) || figures.length === 0 || figures.length > MOST_FIGURES) return undefined;
    const read = figures.map(readFigure);
    if (read.some((one) => one === undefined)) return undefined;
    cx = Object.freeze(read as CxFigure[]);
  }
  return Object.freeze({
    draw: Object.freeze(paths as DrawnPath[]),
    ...(ground === undefined ? {} : { ground }),
    ...(on === undefined ? {} : { on: on as Shape }),
    ...(cx === undefined ? {} : { cx }),
  });
}
