import type { Language } from "./strings.js";

/** The local day a time falls on, as a key two times share when they fall on the same day. */
export const dayKey = (time: number): string => { const at = new Date(time); return `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`; };

/**
 * The day a time falls on, as a seller says it: today and yesterday as words, any other day with its weekday — "Mon, Sep 14" and
 * 「9月14日 周一」 — and the year only when it is not this year's.
 */
export function dayName(time: number, now: number, language: Language, words: { readonly today: string; readonly yesterday: string }): string {
  if (dayKey(time) === dayKey(now)) return words.today;
  const before = new Date(now);
  before.setDate(before.getDate() - 1);
  if (dayKey(time) === dayKey(before.getTime())) return words.yesterday;
  const sameYear = new Date(time).getFullYear() === new Date(now).getFullYear();
  if (language === "zh") {
    const at = new Date(time);
    const week = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(at);
    return `${sameYear ? "" : `${at.getFullYear()}年`}${at.getMonth() + 1}月${at.getDate()}日 ${week}`;
  }
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(time);
}

/** The time of day a moment falls at, as a clock shows it: "10:12", in either language. */
export const clockTime = (time: number): string => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(time);

/** A moment in full, as a row's time says it under the pointer: "Oct 12, 2026, 14:02" and 「2026年10月12日 14:02」. */
export const fullDate = (time: number, language: Language): string =>
  new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(time);

/** A moment's day and time, as a seller writes them: "Mon, Sep 14, 10:12" and 「9月14日 周一 10:12」. */
export const dayAndTime = (time: number, now: number, language: Language, words: { readonly today: string; readonly yesterday: string }): string =>
  `${dayName(time, now, language, words)}${language === "zh" ? " " : ", "}${clockTime(time)}`;

/** The time under a message: the clock alone for today's, and the day before it for any other, so no row's time is read as today's. */
export const rowTime = (time: number, now: number, language: Language, words: { readonly today: string; readonly yesterday: string }): string =>
  dayKey(time) === dayKey(now) ? clockTime(time) : dayAndTime(time, now, language, words);
