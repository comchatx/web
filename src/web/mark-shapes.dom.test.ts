// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { readDrawnMark, type DeclaredMark } from "../shared/drawn-mark.js";
import { drawMark } from "./mark-shapes.js";
import { DECLARED } from "./testing/drawn-marks.js";

const SQUARE = "M4 4h16v16H4z", LINE = "M2 2L20 20";
const drawn = (mark: DeclaredMark): SVGSVGElement => drawMark(readDrawnMark(mark)!);
const own = (element: Element): Element[] => [...element.children];
const attrs = (element: Element | null | undefined, ...names: string[]): (string | null)[] => names.map((name) => element?.getAttribute(name) ?? null);
/** What a group's mask takes out: the black shapes of the mask it names. */
const holes = (group: Element): Element[] => {
  const id = /^url\(#(.+)\)$/.exec(group.getAttribute("mask") ?? "")?.[1];
  const mask = id === undefined ? null : group.ownerDocument.getElementById(id) ?? group.parentElement?.querySelector(`mask[id="${id}"]`) ?? null;
  return mask === null ? [] : own(mask).filter((one) => one.getAttribute("fill") === "black" || one.getAttribute("stroke") === "black");
};

describe("a drawn mark", () => {
  it("is the whole tile's box, its ground first, then the package's paths in order, each in its ink", () => {
    const svg = drawn({ ground: "#0F141A", draw: [{ d: SQUARE, ink: "#FFFFFF", rule: "evenodd" }, { d: LINE, ink: "cx-sand", width: 1.6 }, { d: SQUARE, ink: "cx-forest" }, { d: SQUARE }] });
    expect(attrs(svg, "viewBox", "class")).toEqual(["-8 -8 40 40", "pl-drawn"]);
    const [ground, filled, line, forest, text] = own(svg);
    expect(attrs(ground, "x", "y", "width", "height", "fill")).toEqual(["-8", "-8", "40", "40", "#0F141A"]);
    expect(attrs(filled, "d", "fill", "fill-rule")).toEqual([SQUARE, "#FFFFFF", "evenodd"]);
    expect(attrs(line, "d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin")).toEqual([LINE, "none", "var(--cx-sand)", "1.6", "round", "round"]);
    expect([forest?.getAttribute("fill"), text?.getAttribute("fill"), text?.getAttribute("fill-rule")]).toEqual(["var(--cx-forest)", "currentColor", "nonzero"]);
  });

  it("takes a cut path out of everything drawn before it, and of nothing after", () => {
    const svg = drawn({ draw: [{ d: SQUARE }, { d: LINE, width: 2, cut: true }, { d: "M10 10h2v2h-2z" }] });
    const [mask, cut, after] = own(svg);
    expect([mask?.tagName.toLowerCase(), cut?.tagName.toLowerCase(), after?.getAttribute("d")]).toEqual(["mask", "g", "M10 10h2v2h-2z"]);
    expect(attrs(own(cut!)[0], "d")).toEqual([SQUARE]);
    expect(holes(cut!).map((one) => attrs(one, "d", "stroke-width"))).toEqual([[LINE, "2"]]);
  });

  it("builds every part as an element of its own, so a path's words stay one attribute", () => {
    const tags = new Set(Object.values(DECLARED).flatMap((mark) => [...drawn(mark).querySelectorAll("*")].map((one) => one.tagName.toLowerCase())));
    expect([...tags].filter((tag) => !["path", "rect", "circle", "polygon", "mask", "g", "svg", "defs", "clippath"].includes(tag))).toEqual([]);
    expect(Object.values(DECLARED).some((mark) => drawn(mark).querySelector("image, use, foreignObject, script, a, style") !== null)).toBe(false);
  });
});

describe("the shapes", () => {
  it("draws a book with the package's mark set on its cover, cut out of it where the mark says", () => {
    const svg = drawn({ on: "book", draw: [{ d: SQUARE, cut: true }, { d: "M10 10h2v2h-2z" }] });
    const [, cut, kept] = own(svg);
    const book = own(cut!)[0];
    expect([book?.getAttribute("fill-rule"), book?.getAttribute("d")?.startsWith("M6.2 2.2h11.6")]).toEqual(["evenodd", true]);
    const cover = "translate(12 9.8) scale(0.68) translate(-12 -12)";
    expect([holes(cut!)[0]?.getAttribute("transform"), kept?.getAttribute("transform"), kept?.getAttribute("fill")]).toEqual([cover, cover, "currentColor"]);
  });

  it("draws a board with what the package puts on it, in the grid's own places", () => {
    const [, cut] = own(drawn({ on: "board", draw: [{ d: SQUARE, cut: true }] }));
    expect([own(cut!)[0]?.getAttribute("d")?.startsWith("M5.5 3.5h13"), holes(cut!)[0]?.getAttribute("transform")]).toEqual([true, null]);
  });

  it("draws a magnifier at the lower right over the package's subject, set back and cleared around the lens", () => {
    const [, under, lens, handle] = own(drawn({ on: "glass", draw: [{ d: SQUARE }] }));
    expect([own(under!)[0]?.getAttribute("transform"), own(own(under!)[0]!)[0]?.getAttribute("d")]).toEqual(["translate(0.4 0.4) scale(0.84)", SQUARE]);
    expect(holes(under!).map((one) => attrs(one, "cx", "cy", "r"))).toEqual([["16.6", "16.6", "6.1"]]);
    expect([lens?.getAttribute("fill-rule"), attrs(handle, "d", "stroke-width")]).toEqual(["evenodd", ["M20.2 20.2l1.9 1.9", "2.4"]]);
  });

  it("draws cx from cx.js standing still without its hands, where the package places it, as wide as it says, in the colours it names", () => {
    const svg = drawn({ on: "cx", cx: [{ x: 18, y: 6, size: 12.6, ink: "cx-sand" }, { x: 8, y: 16, size: 25.2 }] });
    const figures = [...svg.querySelectorAll("svg.cx")];
    // cx.js's box is 250 by 170 of its units about its middle, and its mark 126 wide: 12.6 grid units wide is a tenth of each.
    const placed = figures.map((one) => attrs(one, "x", "y", "width", "height").map((value) => Math.round(Number(value) * 1000) / 1000));
    expect(placed).toEqual([[18 - 12.5, 6 - 8.5, 25, 17], [8 - 25, 16 - 17, 50, 34]]);
    expect(figures.map((one) => [one.querySelector(".cx-hands"), one.querySelector(".cx-paper") !== null])).toEqual([[null, true], [null, true]]);
    expect(figures.map((one) => [(one as SVGElement).style.getPropertyValue("--cx-forest"), (one as SVGElement).style.getPropertyValue("--cx-sand")])).toEqual([["var(--cx-sand)", ""], ["", ""]]);
  });

  it("cuts each figure clear of the figures declared after it and of what the package draws", () => {
    const svg = drawn({ on: "cx", cx: [{ x: 18, y: 6, size: 12.6 }, { x: 8, y: 16, size: 25.2 }], draw: [{ d: SQUARE }, { d: LINE, cut: true, width: 1 }] });
    const groups = [...svg.querySelectorAll("g[mask]")].filter((one) => one.querySelector(":scope > svg.cx") !== null);
    // The front figure's outline: its two rings, 37.5 of cx's units out from ±19, grown by one grid unit; the package's square grown by one.
    const cut = groups.map((group) => holes(group).map((one) => attrs(one, "cx", "cy", "r", "d", "stroke-width").map((value) => (value !== null && /^[\d.-]+$/.test(value) ? String(Math.round(Number(value) * 1000) / 1000) : value))));
    expect(cut).toEqual([[["4.2", "16", "8.5", null, null], ["11.8", "16", "8.5", null, null], [null, null, null, SQUARE, "2"]], [[null, null, null, SQUARE, "2"]]]);
  });

  it("names each figure's own masks anew in each drawing, so no drawing reads another's", () => {
    const ids = (svg: SVGSVGElement): string[] => [...svg.querySelectorAll("svg.cx [id]")].map((one) => one.id);
    const [first, second] = [drawn({ on: "cx" }), drawn({ on: "cx" })];
    expect([ids(first).length > 0, ids(first).some((id) => ids(second).includes(id))]).toEqual([true, false]);
    const named = new Set(ids(first));
    const used = [...first.querySelectorAll("svg.cx [mask], svg.cx [clip-path]")].flatMap((one) => ["mask", "clip-path"].map((key) => /url\(#(.+)\)/.exec(one.getAttribute(key) ?? "")?.[1]).filter((id) => id !== undefined));
    expect([used.length > 0, used.every((id) => named.has(id))]).toEqual([true, true]);
  });

  it("draws cx alone, in the tile's middle, where the package names cx and nothing else", () => {
    expect(attrs(drawn({ on: "cx" }).querySelector("svg.cx"), "x", "width").map(Number)).toEqual([12 - 125 * (32.9 / 126), 250 * (32.9 / 126)]);
  });
});
