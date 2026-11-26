import { MONEY_AS, formatShown, type Day } from "./backend.js";
import type { Money } from "../shared/money.js";
import type { Language } from "./strings.js";
import type { Say } from "./stream-view.js";

/**
 * How the settings window writes its money, days and times. A Chinese line breaks at its punctuation: the space that sets a figure, a
 * name in Latin letters or an amount off from the words beside it does not break, so a figure stays with its unit and a date stays whole.
 * English keeps a count with its unit and a day with its month.
 */
// A value drawn as an element of its own stands in the words as `\u0000name\u0000` until it is put in, and ties as a figure does.
const TIES = /(?<=[㐀-鿿）}\u0000]) (?=[A-Za-z0-9$−{\u0000])|(?<=[A-Za-z0-9%.}\u0000]) (?=[㐀-鿿（{\u0000])/g;
export const tie = (language: Language, words: string): string =>
  (language === "zh" ? words.replace(TIES, " ") : words.replace(/(\d) (?=(?:days?|months?)\b)/g, "$1 ")).replace(/ (\d{1,2}:\d{2}) /g, " $1 ");

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
export const parts = (day: Day): readonly [number, number, number] => [Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10))];

export type Words = {
  readonly language: Language; readonly say: Say; readonly money: Money;
  /** This year, as the browser's calendar has it: a day in it is written without its year. */
  readonly year: number;
};

export function writer(words: Words) {
  const { language, say, money: worth, year } = words;
  const zh = language === "zh";
  /** Money as the window writes it: two places, and an amount under half a cent as under a cent. */
  const money = (units: number): string => (units < 0 ? `−${money(-units)}` : units > 0 && units < worth.unitsPerMinor / 2 ? say("sw.under") : formatShown(units, worth, MONEY_AS));
  const dayName = (day: Day): string => {
    const [y, m, d] = parts(day);
    return zh ? tie(language, `${y === year ? "" : `${y} 年 `}${m} 月 ${d} 日`) : `${MONTHS_EN[m - 1]!.slice(0, 3)} ${d}${y === year ? "" : `, ${y}`}`;
  };
  /** A day with its year, whatever the year. */
  const dayFull = (day: Day): string => {
    const [y, m, d] = parts(day);
    return zh ? tie(language, `${y} 年 ${m} 月 ${d} 日`) : `${MONTHS_EN[m - 1]} ${d}, ${y}`;
  };
  const monthName = (y: number, m: number): string => (zh ? tie(language, `${y} 年 ${m} 月`) : `${MONTHS_EN[m - 1]} ${y}`);
  const monthShort = (m: number): string => (zh ? tie(language, `${m} 月`) : MONTHS_EN[m - 1]!.slice(0, 3));
  const yearName = (y: number): string => (zh ? tie(language, `${y} 年`) : String(y));
  const clock = (hour: number, minute = 0): string => `${hour}:${String(minute).padStart(2, "0")}`;
  const between = (from: string, to: string): string => (zh ? `${from}${/\d$/.test(from) ? " 至 " : "至 "}${to}` : `${from} – ${to}`);
  /** Two days, each with its year where the two years differ. */
  const daysBetween = (from: Day, to: Day): string => (from.slice(0, 4) === to.slice(0, 4) ? between(dayName(from), dayName(to)) : between(dayFull(from), dayFull(to)));
  const at = (day: Day, hour: number, minute = 0): string => (zh ? tie(language, `${dayName(day)} ${clock(hour, minute)}`) : `${dayName(day)}, ${clock(hour, minute)}`);
  const comma = zh ? "，" : ", ";
  return { language, unitsPerMinor: worth.unitsPerMinor, money, dayName, dayFull, monthName, monthShort, yearName, clock, between, daysBetween, at, comma };
}
export type Writer = ReturnType<typeof writer>;

/** The days between two days of the calendar. */
export const daysFrom = (from: Day, to: Day): number => {
  const [a, b] = [from, to].map((day) => { const [y, m, d] = parts(day); return Date.UTC(y, m - 1, d); });
  return Math.round((b! - a!) / 86_400_000);
};
export const addDays = (day: Day, n: number): Day => {
  const [y, m, d] = parts(day);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
/** The browser's own day for a time: the zone the window's reads are asked in. */
export const localDay = (time: number): Day => {
  const at = new Date(time);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
};
