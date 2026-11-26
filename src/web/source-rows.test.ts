import { expect, it } from "vitest";
import { MAX_ROWS, purchase, reconcile, replay } from "./source-rows.js";

const FIVE = ["A", "B", "C", "D", "E"];

it("draws the ruled walkthrough: A B C, then D, A, E and A again", () => {
  const steps: readonly (readonly [readonly string[], string])[] = [[["A", "B", "C"], "A B C"], [["D"], "D B C"], [["A"], "D A C"], [["E"], "D A E"], [["A"], "D A E"]];
  const held: string[] = [];
  for (const [buys, rows] of steps) {
    held.push(...buys);
    expect([held.join(""), replay(FIVE, held).rows.join(" ")]).toEqual([held.join(""), rows]);
  }
});

it("takes the place of the row least recently bought from, and says which place changed hands and whose it was", () => {
  const { rows, last } = replay(FIVE, ["A", "B", "C"]);
  expect(purchase(rows, FIVE, last, "D")).toEqual({ rows: ["D", "B", "C"], place: 0, took: "A" });
  expect(purchase(rows, FIVE, last, "B")).toEqual({ rows: ["A", "B", "C"], place: 1, took: undefined });
  expect(purchase(["A"], ["A", "B"], new Map(), "B")).toEqual({ rows: ["A", "B"], place: 1, took: undefined });
});

it("keeps as many rows as enabled sources, at most three, and never displaces one while fewer than three are enabled", () => {
  expect(replay([], ["A"]).rows).toEqual([]);
  expect(replay(["A", "B"], ["B", "A", "B"]).rows).toEqual(["A", "B"]);
  expect(replay(FIVE, []).rows).toEqual(["A", "B", "C"]);
  expect(replay(FIVE, []).rows.length).toBe(MAX_ROWS);
});

it("gives a turned-off source's place to the most recently bought enabled source not on a row, the others staying where they are", () => {
  const { rows, last } = replay(FIVE, ["A", "B", "C", "D", "E"]);
  expect(rows).toEqual(["D", "E", "C"]);
  expect(reconcile(rows, ["A", "B", "C", "E"], last)).toEqual(["B", "E", "C"]);
  expect(reconcile(rows, ["C"], last)).toEqual(["C"]);
});

it("rebuilds rows in which a purchase from a source not enabled took no place, and keeps it as that source's most recent", () => {
  const { rows, last } = replay(["A", "B", "C", "D"], ["A", "B", "C", "E", "D"]);
  expect([rows, last.get("E")]).toEqual([["D", "B", "C"], 3]);
});
