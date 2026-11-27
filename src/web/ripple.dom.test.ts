// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { placeRipple, radiusOf, RIPPLE_REACH, ripple } from "./ripple.js";

afterEach(() => { document.body.replaceChildren(); });

const rect = (left: number, top: number, width: number, height: number): DOMRectReadOnly =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRectReadOnly;

it("lays the ring over the key, cut only on the sides where the key itself is cut", () => {
  const mark = document.createElement("div");
  mark.hidden = true;
  placeRipple(mark, rect(100, 50, 40, 20), 8, { left: 0, top: 60, right: 1000, bottom: 800 }, { x: 10, y: 0 });
  expect([mark.style.left, mark.style.top, mark.style.width, mark.style.height, mark.style.borderRadius, mark.hidden]).toEqual(["90px", "50px", "40px", "20px", "8px", false]);
  expect(mark.style.clipPath).toBe(`inset(10.0px -${RIPPLE_REACH}.0px -${RIPPLE_REACH}.0px -${RIPPLE_REACH}.0px)`);
});

it("reads a key's corners from its own radius, a share of its width included", () => {
  const key = document.createElement("button");
  document.body.append(key);
  key.style.borderTopLeftRadius = "6px";
  expect(radiusOf(key)).toBe(6);
  key.style.borderTopLeftRadius = "50%";
  key.getBoundingClientRect = () => rect(0, 0, 32, 32);
  expect(radiusOf(key)).toBe(16);
});

it("stands in the modal dialog that holds the key, else on the page, and hides when shown nothing", () => {
  const ring = ripple(document);
  const key = document.createElement("button");
  document.body.append(key);
  ring.show(() => key);
  expect([ring.element.parentElement, ring.element.hidden, ring.element.getAttribute("aria-hidden")]).toEqual([document.body, false, "true"]);
  ring.show(null);
  expect(ring.element.hidden).toBe(true);
});
