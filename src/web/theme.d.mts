/** `theme.mjs` as the tests read it: the check the generator runs, and the rule a stylesheet is held to. */
export function check(board?: string): { readonly written: readonly (readonly [string, string])[]; readonly lines: readonly string[]; readonly problems: readonly string[] };
export function ownValues(name: string, text: string): string[];
export function themeNames(text: string): Set<string>;
export const PAIRS: readonly (readonly [string, string, number, string])[];
