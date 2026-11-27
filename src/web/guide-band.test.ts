import { describe, expect, it } from "vitest";
import { giveWay, samePose, shown, wordsUnder, type Band, type Stand } from "./guide-band.js";
import { box, type Box } from "./guide-place.js";

const HOST = box(0, 0, 400, 700);
const LINE = 20;
const PITCH = 24;

/**
 * A page of lines every 24 px from `from` to `to`, `slides` px down per px of a top band and up per px of a foot band where the page
 * keeps its end in view (the chat), clipped to what the band leaves; cx stands at `cx` whatever the band, and the key at `key`.
 */
function page(o: { readonly cx: Box; readonly key: Box; readonly from?: number; readonly to?: number; readonly keyMoves?: boolean }) {
  const lines: Box[] = [];
  for (let y = o.from ?? 0; y + LINE <= (o.to ?? HOST.height); y += PITCH) lines.push(box(0, y, HOST.width, LINE));
  const tried: (Band | null)[] = [];
  const stand = (band: Band | null): Stand => {
    tried.push(band);
    const by = band === null ? 0 : band.side === "top" ? band.px : -band.px;
    const left = shown(HOST, band);
    const seen = lines.map((l) => box(l.left, l.top + by, l.width, l.height)).flatMap((l) => {
      const top = Math.max(l.top, left.top);
      const bottom = Math.min(l.bottom, left.bottom);
      return bottom - top < 1 ? [] : [box(l.left, top, l.width, bottom - top)];
    });
    const cover = seen.reduce((sum, l) => sum + 100 * Math.max(0, Math.min(l.right, o.cx.right) - Math.max(l.left, o.cx.left)) * Math.max(0, Math.min(l.bottom, o.cx.bottom) - Math.max(l.top, o.cx.top)), 0);
    const key = o.keyMoves === true ? box(o.key.left, o.key.top + by, o.key.width, o.key.height) : o.key;
    return { key, cx: o.cx, pose: [o.cx], cover, under: wordsUnder(seen, HOST, [o.cx]) };
  };
  return { stand, tried };
}

describe("the band a page gives way by", () => {
  it("is none, and nothing is tried, where cx covers no words", () => {
    const { stand, tried } = page({ cx: box(200, 560, 150, 100), key: box(0, 710, 400, 40), to: 500 });
    expect(giveWay(HOST, ["top", "foot"], stand)).toBeNull();
    expect(tried).toEqual([null]);
    // Over a card's blank ground alone (cover, but none of the page's words), no band either.
    const blank = (band: Band | null): Stand => ({ key: box(0, 300, 100, 20), cx: box(200, 560, 150, 100), pose: [box(200, 560, 150, 100)], cover: band === null ? 5_000 : 0, under: null });
    expect(giveWay(HOST, ["top", "foot"], blank)).toBeNull();
  });

  it("is tried from none on each side, the bubble's side first, and kept only where the key stays wholly in view", () => {
    // cx over the page's first lines: the top is tried first, from no band, then the foot, again from no band.
    const top = page({ cx: box(200, 20, 150, 100), key: box(0, 300, 100, 20), keyMoves: true, to: 400 });
    expect(giveWay(HOST, ["top", "foot"], top.stand)).toEqual({ side: "top", px: 120 });
    const sides = top.tried.filter((b) => b !== null).map((b) => b.side);
    expect(sides[0]).toBe("top");
    expect(sides).toContain("foot");
    // The same band, 120 px, would carry a key low on the page out of view: no band is kept.
    const low = page({ cx: box(200, 20, 150, 100), key: box(0, 620, 100, 20), keyMoves: true, to: 400 });
    expect(giveWay(HOST, ["top"], low.stand)).toBeNull();
  });

  it("is shrunk, once it makes room, to the smallest that still does, to 4 px: of two that clear on one side, the smaller", () => {
    // The first step clears with 8 px to spare under cx; the band is cut back to within 4 px of the least that clears (36).
    const chat = page({ cx: box(200, 560, 150, 100), key: box(0, 710, 400, 40), to: 600 });
    const band = giveWay(HOST, ["foot"], chat.stand);
    expect(band?.side).toBe("foot");
    expect(band!.px).toBeGreaterThanOrEqual(36);
    expect(band!.px).toBeLessThanOrEqual(36 + 4);
    expect(band!.px).toBeLessThan(44);
  });

  it("is shrunk only while cx and its bubble stand where the band that cleared put them", () => {
    // 120 px clears with cx where it stood; from 60 px a smaller band clears too, but with cx's bubble stood elsewhere: 120 is kept.
    const fig = box(200, 560, 150, 100);
    const stand = (band: Band | null): Stand => {
      const px = band?.px ?? 0;
      const bubble = px >= 120 || px < 60 ? box(200, 450, 150, 100) : box(40, 300, 150, 100);
      return { key: box(0, 300, 100, 20), cx: fig, pose: [fig, bubble], cover: px >= 60 ? 0 : 1_000, under: px >= 60 ? null : box(0, 500, 400, 172) };
    };
    expect(giveWay(HOST, ["foot"], stand)).toEqual({ side: "foot", px: 120 });
  });

  it("leaves the page ROOM px: a band that would leave less is not tried", () => {
    // The first step would give up 128 px of 250, leaving 122.
    const short = box(0, 0, 400, 250);
    const { stand, tried } = page({ cx: box(200, 20, 150, 100), key: box(0, 200, 100, 20), to: 250 });
    expect(giveWay(short, ["top"], stand)).toBeNull();
    expect(tried).toEqual([null]);
  });
});

describe("cx standing as it did", () => {
  const at = (pose: readonly Box[]): Stand => ({ key: box(0, 0, 10, 10), cx: pose[0]!, pose, cover: 0, under: null });
  it("is its figure and its bubble each where they were, to half a pixel, their sizes too", () => {
    const fig = box(200, 560, 150, 100);
    expect(samePose(at([fig, box(10, 10, 100, 40)]), at([fig, box(10.4, 9.6, 100.5, 40)]))).toBe(true);
    expect(samePose(at([fig, box(10, 10, 100, 40)]), at([fig, box(10, 16, 100, 40)]))).toBe(false);
    // Same left and top, a bubble narrowed: not as it stood.
    expect(samePose(at([fig, box(10, 10, 100, 40)]), at([fig, box(10, 10, 80, 60)]))).toBe(false);
    expect(samePose(at([fig]), at([fig, box(10, 10, 100, 40)]))).toBe(false);
  });
});

describe("a foot band that leaves cx where it stood", () => {
  // A chat whose lines run on above: each step (30 px: the words reach 22 px under cx's top, and 8 more) brings older lines under cx, which does not move.
  const stuck = (cover: (px: number) => number) => (band: Band | null): Stand => {
    const px = band?.px ?? 0;
    return { key: box(0, 300, 100, 20), cx: box(200, 560, 150, 100), pose: [box(200, 560, 150, 100)], cover: cover(px), under: box(0, 552, 400, 30) };
  };
  it("gives up the whole room under the key in one step where what it uncovers weighs more than the px² it gives up", () => {
    // 700 - (320 + 8) = 372 px given up, 372 × 400 = 148,800 px² weighed against cover that falls from 10⁶ to 0.
    expect(giveWay(HOST, ["foot"], stuck((px) => (px >= 372 ? 0 : 1_000_000)))).toEqual({ side: "foot", px: 372 });
  });
  it("keeps the band it had where the room under the key weighs more than what it would uncover", () => {
    // The last step's 30 px are kept: giving up 372 px to uncover 1,000 does not pay.
    expect(giveWay(HOST, ["foot"], stuck((px) => (px >= 372 ? 0 : px === 0 ? 2_000 : 1_000)))).toEqual({ side: "foot", px: 30 });
  });
});
