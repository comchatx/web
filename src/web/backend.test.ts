import { describe, expect, it } from "vitest";
import { EVERYTHING, FIRST_RELEASE, creditUsedPercent, isDefault, spentTotal, versionInUse, type Version } from "./backend.js";
import { formatMoney } from "../shared/money.js";

const money = { currency: "USD", unitsPerMinor: 10 } as const;

describe("formatMoney", () => {
  it("reads a balance to the cent", () => {
    expect(formatMoney(84210, money, "en")).toBe("$84.21");
    expect(formatMoney(0, money, "en")).toBe("$0.00");
    expect(formatMoney(84210, money, "zh")).toBe("US$84.21");
  });
  it("keeps the smaller places of a price under one whole unit of the currency", () => {
    expect(formatMoney(1, money, "en")).toBe("$0.001");
    expect(formatMoney(14, money, "en")).toBe("$0.014");
    expect(formatMoney(500, money, "en")).toBe("$0.50");
  });
});

describe("what the world behind the pages offers", () => {
  it("has every switch on where every page is drawn, and at the first release only those a route stands behind", () => {
    expect(Object.values(EVERYTHING).every((on) => on)).toBe(true);
    expect(Object.keys(FIRST_RELEASE).sort()).toEqual(Object.keys(EVERYTHING).sort());
    expect(Object.entries(FIRST_RELEASE).filter(([, on]) => on).map(([name]) => name).sort()).toEqual(["bringYourOwn", "bundles", "modelPlugins", "sourceKeys", "sourceSettings", "vendorTicks"]);
  });
});

describe("a chat series", () => {
  const version = (id: string): Version => ({ id, name: id, input: 1, output: 2 });
  const versions = [version("six"), version("five")];
  it("is on its latest version until the person pins one of its versions", () => {
    expect(versionInUse({ versions })?.id).toBe("six");
    expect(versionInUse({ versions, pinned: "five" })?.id).toBe("five");
    expect(versionInUse({ versions, pinned: "gone" })?.id).toBe("six");
    expect(versionInUse({ versions: [] })).toBeUndefined();
  });
});

describe("this month's credit", () => {
  const balance = (available: number) => ({ available, open_floor: 5000, can_open: true });
  const spending = (credited: number) => ({ credited, spent: { model: 3120, sources: 11760, boxTime: 910, boxStorage: 90 } });
  it("adds the four places the money went", () => {
    expect(spentTotal(spending(100000))).toBe(15880);
  });
  it("counts the credit used from what is left, as the low-balance rule does, and never outside 0 to 100", () => {
    expect(creditUsedPercent(balance(84210), spending(100000))).toBe(16);
    expect(creditUsedPercent(balance(12000), spending(100000))).toBe(88);
    expect(creditUsedPercent(balance(150000), spending(100000))).toBe(0);
    expect(creditUsedPercent(balance(-10), spending(100000))).toBe(100);
  });
  it("draws no bar for a month no credit landed in", () => {
    expect(creditUsedPercent(balance(84210), spending(0))).toBeUndefined();
  });
});

describe("isDefault", () => {
  it("is the platform's default by provider and id together, and never while either is absent", () => {
    const fallback = { provider: "openrouter", id: "minimax/minimax-m3" };
    expect(isDefault({ ...fallback }, fallback)).toBe(true);
    expect(isDefault({ provider: "minimax", id: "minimax/minimax-m3" }, fallback)).toBe(false);
    expect(isDefault({ provider: "openrouter", id: "minimax/minimax-m2" }, fallback)).toBe(false);
    expect(isDefault(undefined, fallback)).toBe(false);
    expect(isDefault(fallback, undefined)).toBe(false);
  });
});
