import { expect, it } from "vitest";
import { perFrame } from "./frame.js";

it("places cx once for many deltas in one frame, and again in the next frame asked for", () => {
  const frames: (() => void)[] = [];
  let placed = 0;
  const place = perFrame((then) => frames.push(then), () => { placed++; });
  for (let delta = 0; delta < 50; delta++) place();
  expect([frames.length, placed]).toEqual([1, 0]);
  frames.shift()!();
  expect(placed).toBe(1);
  place();
  place();
  frames.shift()!();
  expect([frames.length, placed]).toEqual([0, 2]);
});
