// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { hideTip } from "./forms.js";
import { writer } from "./settings-words.js";
import { drawChart, spanMenu, type View } from "./spend-chart.js";
import { text, type StringKey } from "./strings.js";

const say = (key: StringKey, values?: Readonly<Record<string, string | number>>): string => text("zh", key, values);
afterEach(() => { hideTip(); document.body.replaceChildren(); });
const w = writer({ language: "zh", say, money: { currency: "USD", unitsPerMinor: 10_000 }, year: 2026 });

describe("a span's chart by the keyboard", () => {
  it("moves with ArrowLeft to the bar before, which takes the one tab stop", () => {
    const view: View = { bins: [{ key: "2026-09-27", name: "9 月 27 日", tick: "27", now: false }, { key: "2026-09-28", name: "9 月 28 日", tick: "今天", now: true }], through: 2, range: "", totals: [10_000, 20_000] };
    const chart = drawChart(view, [], "total", { say, w, unitsPerMinor: 10_000, step: "day" }, String);
    document.body.append(chart);
    const bar = (day: number): HTMLElement => chart.querySelector<HTMLElement>(`[data-day='${day}']`)!;
    expect([bar(1).tabIndex, bar(2).tabIndex]).toEqual([-1, 0]);
    bar(2).focus();
    bar(2).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    expect([document.activeElement === bar(1), bar(1).tabIndex, bar(2).tabIndex]).toEqual([true, 0, -1]);
  });
});

describe("a bar's reading", () => {
  it("is the set's card under its column, shown by a pointer and by a tap, which the pointer may rest on", () => {
    const view: View = { bins: [{ key: "2026-09-27", name: "9 月 27 日", tick: "27", now: false }, { key: "2026-09-28", name: "9 月 28 日", tick: "今天", now: true }], through: 2, range: "", totals: [10_000, 20_000] };
    const chart = drawChart(view, [], "total", { say, w, unitsPerMinor: 10_000, step: "day" }, String);
    document.body.append(chart);
    const bar = chart.querySelector<HTMLElement>("[data-day='2']")!;
    bar.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    const card = document.querySelector<HTMLElement>(".f-tip")!;
    expect([card.hidden, card.classList.contains("f-tip-card"), card.querySelector(".sw-read .name.when")?.textContent, card.querySelector(".money")?.textContent, chart.querySelector(".sw-tip")])
      .toEqual([false, true, "9 月 28 日", "$0.02", null]);
    hideTip();
    bar.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }));
    bar.click();
    expect(card.hidden).toBe(false);
  });
});

describe("the span's menu", () => {
  it("is the span's words and a chevron, opening the set's menu with the held span ticked at its row's end, the calendar's in pairs", () => {
    const picked: string[] = [];
    const held = spanMenu("mo1", say, "，", (span) => picked.push(span));
    document.body.append(held);
    const opener = held.querySelector<HTMLElement>("[data-key='span']")!;
    expect([opener.className, opener.getAttribute("aria-haspopup"), opener.getAttribute("aria-expanded"), opener.textContent]).toEqual(["f-select", "listbox", "false", text("zh", "sw.span.mo1")]);
    opener.click();
    const list = held.querySelector<HTMLElement>(".f-menu")!;
    const row = list.querySelector<HTMLElement>("[data-value='mo1']")!;
    expect([list.hidden, document.activeElement === row, row.getAttribute("aria-selected"), row.lastElementChild?.classList.contains("f-tick"), list.querySelector(".sw-span-grid")?.getAttribute("role")])
      .toEqual([false, true, "true", true, "group"]);
    list.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect([list.hidden, document.activeElement === opener]).toEqual([true, true]);
    opener.click();
    list.querySelector<HTMLElement>("[data-value='d7']")!.click();
    expect([picked, list.hidden]).toEqual([["d7"], true]);
  });
});
