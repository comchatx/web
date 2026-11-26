import { expect, it } from "vitest";
import { readDrawnMark } from "../shared/drawn-mark.js";
import { DECLARED } from "./testing/drawn-marks.js";

it("reads every mark the packages of ours will declare", () => {
  expect(Object.keys(DECLARED)).toHaveLength(20);
  for (const [name, mark] of Object.entries(DECLARED)) expect(readDrawnMark(mark), name).toBeDefined();
});
