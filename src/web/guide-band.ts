import { box, GAP, ROOM, SHRINK, type Box } from "./guide-place.js";

/**
 * Where cx's place beside a key still covers the page's words, the page gives way by one band, at its top or at its foot, so it covers
 * none. Each side allowed is tried from no band, the side cx's bubble stands on first: the band grows by what cx still covers, at most
 * three times, while the page keeps ROOM px; a foot band that leaves cx where it stood is tried once more as the whole room under the key,
 * kept only where what it uncovers weighs more than the 1 per px² it gives up; a band that makes room is shrunk to the smallest that
 * still does with cx standing where it stood, to SHRINK px. A band is kept only where cx covers less with it than with none and the key stays wholly in the page's view;
 * between two that cover alike on one side, the smaller. Nothing is held between placements: each works its band out from none.
 */

export type Side = "top" | "foot";
export type Band = { readonly side: Side; readonly px: number };
/**
 * How cx stands with a band given: the key, cx's figure and bubble as one box (`cx`) and each apart (`pose`), what it covers, and the
 * page's words under it as one box.
 */
export type Stand = { readonly key: Box; readonly cx: Box; readonly pose: readonly Box[]; readonly cover: number; readonly under: Box | null };

/** The part of `host` left in view with `band` given up. */
export function shown(host: Box, band: Band | null): Box {
  if (band === null) return host;
  return band.side === "top" ? box(host.left, host.top + band.px, host.width, host.height - band.px) : box(host.left, host.top, host.width, host.height - band.px);
}

const within = (inner: Box, outer: Box): boolean => inner.left >= outer.left - 0.5 && inner.top >= outer.top - 0.5 && inner.right <= outer.right + 0.5 && inner.bottom <= outer.bottom + 0.5;

/** Whether cx stands as it did: its figure and bubble each where they were, to half a pixel. */
export function samePose(a: Stand, b: Stand): boolean {
  const near = (x: number, y: number): boolean => Math.abs(x - y) <= 0.5;
  return a.pose.length === b.pose.length && a.pose.every((p, i) => { const q = b.pose[i]!; return near(p.left, q.left) && near(p.top, q.top) && near(p.width, q.width) && near(p.height, q.height); });
}

/** The one box round `boxes`; null where there are none. */
export function union(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  return box(left, top, Math.max(...boxes.map((b) => b.right)) - left, Math.max(...boxes.map((b) => b.bottom)) - top);
}

/** The page's words cx covers, as one box: each of `words` whose middle is in `host` and that any of `parts` touches, 2 px round it. */
export function wordsUnder(words: readonly Box[], host: Box, parts: readonly Box[]): Box | null {
  const touches = (w: Box, p: Box): boolean => w.left < p.right + 2 && p.left - 2 < w.right && w.top < p.bottom + 2 && p.top - 2 < w.bottom;
  const mid = (w: Box): boolean => { const x = w.left + w.width / 2; const y = w.top + w.height / 2; return x >= host.left && x <= host.right && y >= host.top && y <= host.bottom; };
  return union(words.filter((w) => mid(w) && parts.some((p) => touches(w, p))));
}

/**
 * The band `host` (its box with no band) gives up, of `sides`, or null for none. `stand` gives the band, places cx again, and says how it
 * stands; null where cx has no place. It is left with the last band tried: the caller gives the one returned.
 */
export function giveWay(host: Box, sides: readonly Side[], stand: (band: Band | null) => Stand | null): Band | null {
  const none = stand(null);
  // Only the page's words under cx call for a band: a press, a picture or a card's blank ground alone does not.
  if (none === null || none.cover === 0 || none.under === null) return null;
  // A key on the page given way must stay wholly in what is left of it; one outside the page (the message box under the chat) is not moved by it.
  const onPage = within(none.key, host);
  const cost = (s: Stand | null, band: Band): number => (s === null || (onPage && !within(s.key, shown(host, band))) ? Infinity : s.cover);
  let best: { readonly band: Band | null; readonly cost: number } = { band: null, cost: none.cover };
  const consider = (band: Band, c: number): void => {
    if (c < best.cost || (c === best.cost && best.band !== null && best.band.side === band.side && band.px < best.band.px)) best = { band, cost: c };
  };
  const over = none.cx.top + none.cx.height / 2 < host.top + host.height / 2;
  const order = (over ? (["top", "foot"] as const) : (["foot", "top"] as const)).filter((side) => sides.includes(side));
  for (const side of order) {
    let px = 0;
    let short = 0;
    let s = none;
    let stuck = false;
    for (let step = 0; step < 3 && s.cover > 0 && s.under !== null; step += 1) {
      const more = Math.ceil(side === "top" ? s.cx.bottom + GAP - s.under.top : s.under.bottom - s.cx.top + GAP);
      if (more < 1 || host.height - (px + more) < ROOM) break;
      const band = { side, px: px + more };
      const next = stand(band);
      if (next === null) break;
      stuck = samePose(next, s);
      short = px;
      px = band.px;
      s = next;
      consider(band, cost(next, band));
    }
    if (side === "foot" && stuck && s.cover > 0) {
      const all = Math.floor(host.bottom - (s.key.bottom + GAP));
      if (all > px && host.height - all >= ROOM) {
        const band = { side, px: all };
        const next = stand(band);
        const c = cost(next, band);
        if (next !== null && c + all * host.width < cost(s, { side, px })) { short = px; px = all; s = next; consider(band, c); }
      }
    }
    // A band that makes room is shrunk only while cx and its bubble stand where that band put them.
    if (px > 0 && cost(s, { side, px }) === 0 && px - short > SHRINK) {
      const clear = s;
      let lo = short;
      let hi = px;
      while (hi - lo > SHRINK) {
        const mid = Math.round((lo + hi) / 2);
        const band = { side, px: mid };
        const probe = stand(band);
        if (probe !== null && cost(probe, band) === 0 && samePose(probe, clear)) hi = mid;
        else lo = mid;
      }
      consider({ side, px: hi }, 0);
    }
  }
  return best.band;
}
