import { describe, expect, it } from "vitest";
import { dayKey, dayName, fullDate, rowTime } from "./days.js";

const WORDS = { today: "Today", yesterday: "Yesterday" } as const;
const local = (year: number, month: number, day: number, hour = 12): number => new Date(year, month - 1, day, hour).getTime();
const NOW = local(2026, 10, 2, 9);

describe("a day as a seller says it", () => {
  it("says today and yesterday as words, by the local day and not by 24 hours", () => {
    expect(dayName(local(2026, 10, 2, 0), NOW, "en", WORDS)).toBe("Today");
    expect(dayName(local(2026, 10, 1, 23), NOW, "en", WORDS)).toBe("Yesterday");
    expect(dayName(local(2026, 9, 30, 23), NOW, "en", WORDS)).toBe("Wed, Sep 30");
  });

  it("names any other day with its weekday, in each language's own form, and the year only when it is another year's", () => {
    expect(dayName(local(2026, 9, 14), NOW, "en", WORDS)).toBe("Mon, Sep 14");
    expect(dayName(local(2026, 9, 14), NOW, "zh", WORDS)).toBe("9月14日 周一");
    expect(dayName(local(2025, 12, 31), NOW, "en", WORDS)).toBe("Wed, Dec 31, 2025");
    expect(dayName(local(2025, 12, 31), NOW, "zh", WORDS)).toBe("2025年12月31日 周三");
  });

  it("keys two times by the day they share", () => {
    expect(dayKey(local(2026, 9, 14, 0))).toBe(dayKey(local(2026, 9, 14, 23)));
    expect(dayKey(local(2026, 9, 14, 23))).not.toBe(dayKey(local(2026, 9, 15, 0)));
  });
});

describe("a moment in full", () => {
  it("says the year, the day and the time on a 24-hour clock, in each language", () => {
    const time = new Date(2026, 9, 12, 14, 2).getTime();
    expect([fullDate(time, "en"), fullDate(time, "zh")]).toEqual(["Oct 12, 2026, 14:02", "2026年10月12日 14:02"]);
  });
});

describe("the time under a message", () => {
  it("is the clock alone for today's message, and carries its day for any other, in each language", () => {
    expect(rowTime(local(2026, 10, 2, 8), NOW, "en", WORDS)).toBe("08:00");
    expect(rowTime(local(2026, 10, 1, 23), NOW, "en", WORDS)).toBe("Yesterday, 23:00");
    expect(rowTime(local(2026, 9, 14, 10), NOW, "en", WORDS)).toBe("Mon, Sep 14, 10:00");
    expect(rowTime(local(2026, 9, 14, 10), NOW, "zh", { today: "今天", yesterday: "昨天" })).toBe("9月14日 周一 10:00");
  });
});
