/**
 * The sidebar's source rows (ruled 2026-09-24): the enabled sources most recently bought from, at most three. A purchase from a
 * source already on a row changes nothing in the layout; one from a source not on a row takes the place of the row least recently bought
 * from, and the other rows stay where they are. No slot numbers, no pinning, no manual order: the state is the last purchase per source,
 * and the rows are derived from it and from the rows already drawn. Pure: no DOM, no clock.
 */
export const MAX_ROWS = 3;

/** A source's name to the order of its last purchase; a source never bought from is absent and ranks below every one that was. */
export type Last = ReadonlyMap<string, number>;
export type Bought = { readonly rows: readonly string[]; readonly place: number; readonly took: string | undefined };

const when = (last: Last, name: string): number => last.get(name) ?? -Infinity;
const rank = (enabled: readonly string[], name: string): number => { const at = enabled.indexOf(name); return at < 0 ? Infinity : at; };
// Most recent first; sources never bought from in the order `/sources` gives them, so the same state always draws the same rows.
const byRecent = (last: Last, enabled: readonly string[]) => (a: string, b: string): number => {
  const gap = when(last, b) - when(last, a);
  return (Number.isNaN(gap) ? 0 : gap) || rank(enabled, a) - rank(enabled, b) || (a < b ? -1 : a > b ? 1 : 0);
};

/**
 * The rows drawn, kept in place, against what is enabled now: a row whose source is no longer enabled gives its place to the most recently
 * bought enabled source not on a row; with fewer enabled sources than rows, the place goes; a free place takes the next such source.
 */
export function reconcile(rows: readonly string[], enabled: readonly string[], last: Last): readonly string[] {
  const on = new Set(enabled);
  const waiting = enabled.filter((name) => !rows.includes(name)).sort(byRecent(last, enabled));
  const kept = rows.map((name) => (on.has(name) ? name : waiting.shift())).filter((name): name is string => name !== undefined);
  while (kept.length < Math.min(MAX_ROWS, enabled.length) && waiting.length > 0) kept.push(waiting.shift()!);
  return Object.freeze(kept);
}

/** A purchase from `name`, with `last` holding the order before it: the rows after it, the place it shows on, and whom it took that place from. */
export function purchase(rows: readonly string[], enabled: readonly string[], last: Last, name: string): Bought {
  if (rows.includes(name)) return Object.freeze({ rows, place: rows.indexOf(name), took: undefined });
  if (rows.length < MAX_ROWS) return Object.freeze({ rows: Object.freeze([...rows, name]), place: rows.length, took: undefined });
  let place = 0;
  for (let at = 1; at < rows.length; at++) if (byRecent(last, enabled)(rows[place]!, rows[at]!) < 0) place = at;
  const next = [...rows];
  const took = next[place];
  next[place] = name;
  return Object.freeze({ rows: Object.freeze(next), place, took });
}

/**
 * The drawing from the purchases the page holds, oldest first, each applied as it happened, so a reload draws the rows the page last drew;
 * then what is not enabled now gives its place, as it would have on the page that saw the source turned off.
 */
export function replay(enabled: readonly string[], purchases: readonly string[]): { readonly rows: readonly string[]; readonly last: Last } {
  const last = new Map<string, number>();
  let rows = reconcile([], enabled, last);
  // A purchase from a source not enabled takes no row, and still counts as its most recent: the live page does the same.
  purchases.forEach((name, at) => {
    if (enabled.includes(name)) rows = purchase(rows, enabled, last, name).rows;
    last.set(name, at);
  });
  return Object.freeze({ rows: reconcile(rows, enabled, last), last });
}
