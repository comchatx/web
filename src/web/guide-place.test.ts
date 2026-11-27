import { expect, it } from "vitest";
import { box, deskOf, inter, placeBeside, type Avoid } from "./guide-place.js";

const view = box(8, 8, 1264, 784);
const fig = { w: 27, h: 18 };
const bubble = (w: number, h: number) => (width: number | null): { readonly w: number; readonly h: number } => (width === null ? { w, h } : { w: width, h: Math.ceil((h * w) / width) });
const none: Avoid = { hard: [], surfaces: [] };

it("stands cx right of a key in the open, the bubble over it to the right, the key and its 4 px untouched", () => {
  const key = box(100, 400, 40, 30);
  const placed = placeBeside({ key, fig, measure: bubble(200, 80), avoid: none, view })!;
  expect(placed.cover).toBe(0);
  expect(placed.figure.left).toBe(key.right + 8);
  expect([placed.left, placed.under, placed.side, placed.width]).toEqual([false, false, false, null]);
  expect(inter(placed.figure, box(96, 396, 48, 38))).toBe(0);
  expect(placed.bubble!.bottom).toBe(placed.figure.top - 4);
});

it("goes left of a key at the window's right edge, and under where there is no room over", () => {
  const key = box(1230, 20, 30, 30);
  const placed = placeBeside({ key, fig, measure: bubble(200, 80), avoid: none, view })!;
  expect(placed.cover).toBe(0);
  expect(placed.figure.right).toBeLessThanOrEqual(key.left);
  expect(placed.under).toBe(true);
});

it("keeps off every word and press, and off a surface that does not hold the key, stepping further out", () => {
  const key = box(100, 400, 40, 30);
  const avoid: Avoid = { hard: [{ ...box(148, 360, 300, 80), own: false, word: true }], surfaces: [{ box: box(60, 300, 40, 200), holds: false, inner: null }] };
  const placed = placeBeside({ key, fig, measure: bubble(120, 60), avoid, view })!;
  expect(placed.cover).toBe(0);
  for (const part of [placed.figure, placed.bubble!]) {
    expect(inter(part, avoid.hard[0]!)).toBe(0);
    expect(inter(part, avoid.surfaces[0]!.box)).toBe(0);
  }
});

it("narrows a bubble that finds no clear place at its own width, and says the width", () => {
  const key = box(600, 400, 40, 30);
  const avoid: Avoid = { hard: [{ ...box(8, 8, 372, 784), own: false, word: true }, { ...box(860, 8, 412, 784), own: false, word: true }], surfaces: [] };
  const placed = placeBeside({ key, fig, measure: bubble(600, 60), avoid, view })!;
  expect(placed.cover).toBe(0);
  expect(placed.width).not.toBeNull();
  expect(placed.width!).toBeLessThan(600);
});

it("stands where it covers least where nothing is clear, and keeps clear of the key's tooltip while anything else is clear", () => {
  const key = box(600, 400, 40, 30);
  const crowd: Avoid = { hard: [{ ...box(8, 8, 1264, 784), own: false, word: true }], surfaces: [] };
  const squeezed = placeBeside({ key, fig, measure: bubble(200, 80), avoid: crowd, view })!;
  expect(squeezed.cover).toBeGreaterThan(0);
  const tip = box(560, 360, 120, 32);
  const clear = placeBeside({ key, fig, measure: bubble(200, 80), avoid: none, view, tip })!;
  expect(clear.cover).toBe(0);
  expect(inter(clear.figure, tip)).toBe(0);
  expect(inter(clear.bubble!, tip)).toBe(0);
});

it("stands just outside the card that holds the key where nothing round the key is clear", () => {
  const key = box(600, 400, 40, 30);
  const card = box(500, 300, 300, 260);
  const avoid: Avoid = { hard: [{ ...box(500, 300, 300, 260), own: true, word: true }], surfaces: [{ box: card, holds: true, inner: null }] };
  const placed = placeBeside({ key, fig, measure: bubble(160, 60), avoid, view })!;
  expect(placed.cover).toBe(0);
  expect(inter(placed.figure, card)).toBe(0);
});

it("places only the bubble round cx at its desk, cx and the key held where they are", () => {
  const key = box(445, 615, 52, 40);
  const paper = box(420, 633, 27, 18);
  const at = deskOf(paper, key);
  expect(at).toEqual(box(420, 615, 77, 40));
  const placed = placeBeside({ key, fig, measure: bubble(190, 110), avoid: none, view, at })!;
  expect(placed.figure).toEqual(at);
  expect(placed.cover).toBe(0);
  expect(inter(placed.bubble!, box(441, 611, 60, 48))).toBe(0);
});

it("finds no place where cx and its bubble cannot stand inside the window", () => {
  expect(placeBeside({ key: box(10, 10, 20, 20), fig, measure: bubble(2000, 80), avoid: none, view: box(8, 8, 100, 100) })).toBeNull();
});
