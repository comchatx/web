// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { CATALOGUE } from "./canned-catalogue.js";
import { ART, LOGOS } from "./plugin-marks.js";
import { tile } from "./plugins-page.js";

it("names a mark's own parts anew in each drawing, so a second Poolside card reads its own mask, not the first's", () => {
  // pi's catalogue lists no Poolside model from 1.5.0, so its card is gone; its mark, the one that names parts of itself, is drawn on another maker's.
  const maker = CATALOGUE.plugins.find((one) => one.section === "models" && one.mark !== undefined && "logo" in one.mark)!;
  const poolside = { ...maker, mark: { logo: "poolside" } };
  const [first, second] = [tile(poolside), tile(poolside, true)];
  const ids = (drawn: HTMLElement): string[] => [...drawn.querySelectorAll("[id]")].map((one) => one.id);
  expect([ids(first).length > 0, ids(first).some((id) => ids(second).includes(id))]).toEqual([true, false]);
  // Each reference inside a drawing points at a part of that drawing.
  for (const drawn of [first, second]) {
    const named = new Set(ids(drawn));
    const used = [...drawn.innerHTML.matchAll(/url\(#([^)]+)\)/g)].map((match) => match[1]!);
    expect(used.length > 0 && used.every((id) => named.has(id))).toBe(true);
  }
});

it("draws Jev's initial where its package declares a mark by a name the set does not hold, an inherited one too, and TypeSafe's where it declares that", () => {
  const jev = CATALOGUE.plugins.find((one) => one.id === "jev")!;
  const drawn = (mark: { readonly logo: string } | { readonly line: string }) => {
    const one = tile({ ...jev, mark });
    return [one.textContent, one.querySelector("svg") !== null];
  };
  expect([drawn({ logo: "toString" }), drawn({ line: "constructor" }), drawn({ logo: "typesafe" })]).toEqual([["J", false], ["J", false], ["", true]]);
});

it("carries no style attribute in any mark, which the page's policy refuses, so each draws as its drawing means", () => {
  const drawn = (body: string): Element => { const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.innerHTML = body; return svg; };
  const styled = Object.entries({ ...LOGOS, ...ART }).filter(([, mark]) => drawn(mark.body).querySelector("[style]") !== null).map(([name]) => name);
  expect(styled).toEqual([]);
  const poolside = drawn(LOGOS["poolside"]!.body).querySelector("mask");
  expect(poolside?.getAttribute("mask-type")).toBe("alpha");
});
