/**
 * The sign-up survey's answers as the platform keeps them: each option by a key of its own, never by its words, so the words may change
 * and a count of a key still means the same option. An option that comes to mean something new takes a new key.
 */
export const SHOPS = Object.freeze(["amazonSeller", "solo", "bestbuy", "agent", "shopify", "other", "none"] as const);
export const WANTS = Object.freeze(["listing", "ads", "restock", "profit", "claims", "rivals", "media"] as const);
export type Shop = (typeof SHOPS)[number];
export type Want = (typeof WANTS)[number];
/** The free line's bound, in characters, as the page's field holds it. */
export const LINE_MAX = 100;
export type SurveyAnswers = { readonly shops: readonly Shop[]; readonly wants: readonly Want[]; readonly line?: string };

const LINE = new RegExp(`^[^\\p{Cc}]{1,${LINE_MAX}}$`, "u");
const picks = <T extends string>(value: unknown, from: readonly T[]): readonly T[] | undefined =>
  Array.isArray(value) && new Set(value).size === value.length && value.every((one): one is T => typeof one === "string" && (from as readonly string[]).includes(one)) ? value : undefined;

/**
 * The answers as a press sent them, in the platform's order; nothing where any part is not this shape. Only a list left out stands for
 * none: one given as anything but a list of keys is not this shape. A line is kept trimmed, and goes where nothing is left of it.
 */
export function readAnswers(value: unknown): SurveyAnswers | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const given = value as Readonly<Record<string, unknown>>;
  if (!Object.keys(given).every((key) => key === "shops" || key === "wants" || key === "line")) return undefined;
  const shops = given["shops"] === undefined ? [] : picks(given["shops"], SHOPS);
  const wants = given["wants"] === undefined ? [] : picks(given["wants"], WANTS);
  const line = given["line"] === undefined ? "" : typeof given["line"] === "string" ? given["line"].trim() : undefined;
  if (shops === undefined || wants === undefined || line === undefined || (line !== "" && !LINE.test(line))) return undefined;
  return Object.freeze({ shops: SHOPS.filter((one) => shops.includes(one)), wants: WANTS.filter((one) => wants.includes(one)), ...(line === "" ? {} : { line }) });
}
