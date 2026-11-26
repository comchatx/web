import { expect, it } from "vitest";
import type { Source, SourceMonth } from "./backend.js";
import { faceAt, SourcesBarModel, timeline } from "./sources-bar-model.js";

const MOTION = { blend: 0.35, wipe: 0.55, hold: 0.5, read: 1.6, hop: { dur: 0.62 } };
const T = timeline(MOTION);
const SINCE = Date.UTC(2026, 8, 1);
const LETTERS = ["A", "B", "C", "D", "E"] as const;
const source = (letter: string, month?: SourceMonth, enabled = true): Source => ({ name: letter, supplier: `Supplier ${letter}`, nativeUnit: "tokens", unitsPerNative: 1, aspects: [], enabled, spent: 0, about: { en: "", zh: "" }, description: { en: "", zh: "" }, ...(month === undefined ? {} : { month }) });

/** The ledger as `/sources` answers it: each source's month so far, in units and tokens, and when it was last settled at. */
class Ledger {
  readonly spent = new Map<string, { units: number; tokens: number; at: number }>();
  off = new Set<string>();
  since = SINCE;
  #clock = SINCE;
  settle(letter: string, units = 7, tokens = 7): void {
    const now = this.spent.get(letter) ?? { units: 0, tokens: 0, at: 0 };
    this.spent.set(letter, { units: now.units + units, tokens: now.tokens + tokens, at: ++this.#clock });
  }
  answer(): readonly Source[] {
    return LETTERS.map((letter) => {
      const now = this.spent.get(letter);
      const month: SourceMonth = now === undefined ? { since: this.since, spent: 0 } : { since: this.since, spent: now.units, lastAt: now.at, native: { amount: now.tokens, unit: "tokens" } };
      return source(letter, month, !this.off.has(letter));
    });
  }
}

it("orders the rows by the ledger's last settlements when the page opens, and plays nothing for them", () => {
  const ledger = new Ledger();
  for (const letter of ["C", "A", "D", "B"]) ledger.settle(letter);
  const bar = new SourcesBarModel(MOTION);
  bar.sources(ledger.answer(), () => true, 0);
  // The rule replayed over C, A, D, B: D takes B's never-bought place, then B takes C's, the oldest; the rows keep their places.
  expect([bar.rows(0), bar.active, bar.figure("B", 0)?.spent]).toEqual([["A", "D", "B"], false, 7]);
});

it("plays the ruled walkthrough from the ledger alone: each rise is a purchase, the rows after each are the rule's", () => {
  const ledger = new Ledger();
  const bar = new SourcesBarModel(MOTION);
  bar.sources(ledger.answer(), () => true, 0);
  let now = 0;
  const after: string[] = [];
  for (const letter of ["A", "B", "C", "D", "A", "E", "A"]) {
    ledger.settle(letter);
    bar.sources(ledger.answer(), () => true, now);
    now += (T.end + 0.01) * 1000;
    after.push(bar.rows(now).join(""));
  }
  expect(after).toEqual(["ABC", "ABC", "ABC", "DBC", "DAC", "DAE", "DAE"]);
});

it("plays the rise as the purchase: the units and the tokens it rose by, the row changing hands only under its cover, cx watching, reaching, reading", () => {
  const ledger = new Ledger();
  for (const letter of ["A", "B", "C"]) ledger.settle(letter, 5, 3);
  const bar = new SourcesBarModel(MOTION);
  bar.sources(ledger.answer(), () => true, 0);
  // Nothing plays until a purchase is read: cx holds nothing for the rows.
  expect(bar.hold(1000)).toEqual({ catching: false, receipt: false, busy: false });
  ledger.settle("D", 12, 40);
  bar.sources(ledger.answer(), () => true, 2000);
  const at = (t: number) => 2000 + t * 1000;
  expect(bar.playing(at(0))).toMatchObject({ purchase: { source: "D", units: 12, native: { amount: 40, unit: "tokens" } }, place: 0, took: "A", t: 0 });
  expect([bar.rows(at(T.covered - 0.01)), bar.rows(at(T.covered))]).toEqual([["A", "B", "C"], ["D", "B", "C"]]);
  // The figure moves on under the cover too: before it the row still says what it said.
  expect([bar.figure("D", at(0))?.spent, bar.figure("D", at(T.covered - 0.01))?.spent, bar.figure("D", at(T.covered))?.spent]).toEqual([0, 0, 12]);
  expect([bar.hold(at(0)), bar.hold(at(T.reach)), bar.hold(at(T.land)), bar.hold(at(T.read))]).toEqual([
    { catching: "watch", receipt: false, busy: true }, { catching: "reach", receipt: false, busy: true }, { catching: false, receipt: true, busy: true }, { catching: false, receipt: false, busy: false },
  ]);
  expect([bar.playing(at(T.end)), bar.active]).toEqual([undefined, false]);
  // A second purchase from the same source is its rise alone, not the month's total.
  ledger.settle("D", 2, 6);
  bar.sources(ledger.answer(), () => true, at(T.end));
  expect(bar.playing(at(T.end))?.purchase).toMatchObject({ source: "D", units: 2, native: { amount: 6, unit: "tokens" } });
});

it("plays a `cx get` settled at two sources as two purchases, each with its own rise, in the order the ledger settled them", () => {
  const ledger = new Ledger();
  for (const letter of ["A", "B", "C"]) ledger.settle(letter);
  const bar = new SourcesBarModel(MOTION);
  bar.sources(ledger.answer(), () => true, 0);
  ledger.settle("E", 9, 3);
  ledger.settle("D", 4, 20);
  bar.sources(ledger.answer(), () => true, 1000);
  expect(bar.playing(1000)?.purchase).toMatchObject({ source: "E", units: 9, native: { amount: 3, unit: "tokens" } });
  expect(bar.playing(1000 + T.end * 1000)).toMatchObject({ purchase: { source: "D", units: 4, native: { amount: 20, unit: "tokens" } }, place: 1, took: "B", t: 0 });
  expect(bar.rows(1000 + (T.end + T.covered) * 1000)).toEqual(["E", "D", "C"]);
});

it("keeps the figures a missing answer or one without figures leaves, and counts the next rise from the last figures read", () => {
  const ledger = new Ledger();
  for (const letter of ["A", "B", "C"]) ledger.settle(letter);
  const bar = new SourcesBarModel(MOTION);
  bar.sources(ledger.answer(), () => true, 0);
  ledger.settle("A", 4, 4);
  // The ledger was slow: `/sources` answered with the list alone.
  bar.sources(ledger.answer().map(({ month: _month, ...rest }) => rest), () => true, 1000);
  expect([bar.figure("A", 1000)?.spent, bar.active]).toEqual([7, false]);
  bar.sources(ledger.answer(), () => true, 2000);
  expect([bar.figure("A", 2000 + T.covered * 1000)?.spent, bar.playing(2000)?.purchase.units]).toEqual([11, 4]);
});

it("counts a new month from zero, and a figure that did not rise as no purchase", () => {
  const ledger = new Ledger();
  for (const letter of ["A", "B", "C"]) ledger.settle(letter, 30, 30);
  const bar = new SourcesBarModel(MOTION);
  bar.sources(ledger.answer(), () => true, 0);
  bar.sources(ledger.answer(), () => true, 500);
  expect(bar.active).toBe(false);
  ledger.since = Date.UTC(2026, 9, 1);
  ledger.spent.clear();
  ledger.settle("B", 3, 3);
  bar.sources(ledger.answer(), () => true, 1000);
  expect(bar.playing(1000)?.purchase).toMatchObject({ source: "B", units: 3, native: { amount: 3, unit: "tokens" } });
});

it("plays nothing with the rows off screen, and asks whether they are on screen only when a rise is to play", () => {
  const ledger = new Ledger();
  for (const letter of ["A", "B", "C"]) ledger.settle(letter);
  const bar = new SourcesBarModel(MOTION);
  let asked = 0;
  const visible = () => { asked++; return false; };
  bar.sources(ledger.answer(), visible, 0);
  bar.sources(ledger.answer(), visible, 10);
  expect(asked).toBe(0);
  ledger.settle("D");
  bar.sources(ledger.answer(), visible, 20);
  expect([asked, bar.active, bar.rows(20)]).toEqual([1, false, ["D", "B", "C"]]);
});

it("gives a turned-off source's row to the next, and keeps a rise at a source not enabled as its most recent without drawing it", () => {
  const ledger = new Ledger();
  ledger.off.add("E");
  for (const letter of ["A", "B", "C"]) ledger.settle(letter);
  const bar = new SourcesBarModel(MOTION);
  bar.sources(ledger.answer(), () => false, 0);
  ledger.settle("E");
  bar.sources(ledger.answer(), () => true, 1000);
  expect([bar.rows(1000), bar.active]).toEqual([["A", "B", "C"], false]);
  ledger.settle("D");
  bar.sources(ledger.answer(), () => false, 2000);
  expect(bar.rows(2000)).toEqual(["D", "B", "C"]);
  // E is enabled, then C turned off: C's place goes to E, settled at after A, not to A.
  ledger.off.clear();
  bar.sources(ledger.answer(), () => false, 3000);
  ledger.off.add("C");
  bar.sources(ledger.answer(), () => false, 4000);
  expect(bar.rows(4000)).toEqual(["D", "B", "E"]);
});

it("sweeps the row in and back with the edge, and simply shows each face with reduced motion", () => {
  expect([faceAt(0, T, false), faceAt(T.covered / 2, T, false), faceAt(T.launch, T, false), faceAt(T.land + (T.settled - T.land) / 2, T, false), faceAt(T.settled, T, false)])
    .toEqual([{ phase: "in", u: 0 }, { phase: "in", u: 0.5 }, { phase: "over", u: 1 }, { phase: "out", u: 0.5 }, { phase: "base", u: 0 }]);
  expect([faceAt(0, T, true), faceAt(T.land - 0.01, T, true), faceAt(T.land, T, true)]).toEqual([{ phase: "over", u: 1 }, { phase: "over", u: 1 }, { phase: "base", u: 0 }]);
});

it("draws a source row's month figure in two places, less than a cent where it is not nothing, and $0.00 only for nothing", async () => {
  const { rowTotal } = await import("./sources-bar.js");
  const say = (key: string, values?: Readonly<Record<string, string | number>>) => (key === "pl.lessThan" ? `Less than ${String(values?.["amount"])}` : key);
  const total = rowTotal(say, { currency: "USD", unitsPerMinor: 10_000 }, "en");
  expect(total(5_000)).toBe("Less than $0.01");
  expect(total(0)).toBe("$0.00");
  expect(total(118_000)).toBe("$0.12");
  expect(rowTotal(say, { currency: "USD", unitsPerMinor: 10_000 }, "zh")(5_000)).toBe("Less than US$0.01");
});
