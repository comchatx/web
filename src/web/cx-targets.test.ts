import { expect, it } from "vitest";
import "./cx.js";

it("gives every point of the computer's drawing to the computer, the keyboard's near end included, and ends cx's target where it begins", () => {
  const { COMPUTER_PTS, TARGETS, hit } = CxCharacter;
  expect(COMPUTER_PTS.length).toBeGreaterThan(0);
  expect(COMPUTER_PTS.filter(([x, y]) => hit(x, y) !== "computer")).toEqual([]);
  const near = COMPUTER_PTS.reduce((best, point) => (point[0] < best[0] ? point : best));
  expect(hit(near[0], near[1])).toBe("computer");
  expect(TARGETS.cx.x + TARGETS.cx.w).toBeLessThanOrEqual(TARGETS.computer.x);
  // cx's own middle stays cx's.
  expect(hit(0, 0)).toBe("cx");
});
