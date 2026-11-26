// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "./cx.js";

const tick = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** cx mounted on the page and settled, with what it asks for counted from here (the setup file's spies, cleared). */
async function mounted(): Promise<{ readonly cx: ReturnType<typeof CxCharacter.mount>; readonly slot: HTMLElement; readonly frames: number; readonly later: () => number }> {
  const slot = document.createElement("span");
  document.body.append(slot);
  const cx = CxCharacter.mount(slot, { size: 30, state: "ready", scene: true });
  await tick(40);
  vi.mocked(requestAnimationFrame).mockClear();
  vi.mocked(setTimeout).mockClear();
  return { cx, slot, get frames() { return vi.mocked(requestAnimationFrame).mock.calls.length; }, later: () => vi.mocked(setTimeout).mock.calls.filter(([, ms]) => (ms ?? 0) > 40).length };
}

describe("cx's animation", () => {
  it("draws a glyph for each reason a start is refused today, and knows no reason the month's box time once gave", async () => {
    const page = await mounted();
    expect(CxCharacter.REASONS).toEqual(["balance", "seats", "unreachable", "failed"]);
    expect(() => page.cx.scene!.update({ reason: "time" as never })).toThrow(/unknown reason time/);
    page.cx.destroy();
  });

  it("asks for no frame once its element has left the document, and asks again when a signal finds it back", async () => {
    const page = await mounted();
    page.slot.remove();
    page.cx.set("writing");
    page.cx.scene!.tap();
    await tick(40);
    expect(page.frames).toBe(0);
    document.body.append(page.slot);
    page.cx.set("analysing");
    expect(page.frames).toBe(1);
    page.cx.destroy();
  });

  it("asks for no frame and sets no timer once its page is closed, though its element stays", async () => {
    const page = await mounted();
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    page.cx.set("writing");
    page.cx.scene!.update({ typing: true });
    page.cx.scene!.tap();
    await tick(40);
    expect([page.frames, page.later()]).toEqual([0, 0]);
    page.slot.remove();
  });
});

describe("cx's scene, as the page's corner needs it", () => {
  /**
   * cx mounted on a clock the test holds: its frames, its timers and its blends move only as the test moves that clock. A held frame
   * carries the held clock's time, which the fake frames do not.
   */
  async function held(): Promise<{ readonly cx: ReturnType<typeof CxCharacter.mount>; readonly slot: HTMLElement }> {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    vi.stubGlobal("requestAnimationFrame", (then: FrameRequestCallback): number => setTimeout(() => then(performance.now()), 16) as unknown as number);
    vi.stubGlobal("cancelAnimationFrame", (frame: number): void => { clearTimeout(frame); });
    const slot = document.createElement("span");
    document.body.append(slot);
    const cx = CxCharacter.mount(slot, { size: 30, state: "ready", scene: true });
    await vi.advanceTimersByTimeAsync(40);
    return { cx, slot };
  }
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("keeps the screen dark for a computer the page has not read, and lights it for one heard on", async () => {
    const page = await held();
    const lit = (): number => Number(page.slot.querySelector(".cx-screen")!.children[1]!.getAttribute("opacity"));
    page.cx.scene!.update({ dot: "heard", heard: true });
    await vi.advanceTimersByTimeAsync(900);
    expect(lit()).toBe(0);
    page.cx.scene!.update({ dot: "ready", heard: false });
    await vi.advanceTimersByTimeAsync(900);
    expect(lit()).toBeGreaterThan(0.5);
    page.cx.destroy();
  });

  it("carries cx's target with cx: in the pane cut to the view, moved as cx is, and never hidden", async () => {
    const page = await held();
    const svg = page.slot.querySelector("svg")!;
    const target = svg.querySelector<SVGElement>('[data-target="cx"]')!;
    const rider = svg.querySelector(".cx-rider")!;
    expect([target.parentElement, target.style.display]).toEqual([svg.querySelector(".cx-pane"), ""]);
    svg.getBoundingClientRect = () => ({ left: 400, top: 700, right: 498, bottom: 740, width: 98, height: 40, x: 400, y: 700, toJSON: () => ({}) });
    expect(page.cx.scene!.away({ y: 300, start: 420, left: 100, top: 0, bottom: 600 })).toBe(true);
    await vi.advanceTimersByTimeAsync(900);
    expect(rider.getAttribute("transform")).toMatch(/^translate\(/);
    expect([target.getAttribute("transform"), target.style.display]).toEqual([rider.getAttribute("transform"), ""]);
    page.cx.destroy();
  });
});

describe("cx's greeting, as the sign-up survey's first page opens on it", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
  /** cx mounted greeting on a clock the test holds, its frames counted. */
  function greeting(motion: "auto" | "still"): { readonly cx: ReturnType<typeof CxCharacter.mount>; readonly frames: () => number } {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    let frames = 0;
    vi.stubGlobal("requestAnimationFrame", (then: FrameRequestCallback): number => { frames += 1; return setTimeout(() => then(performance.now()), 16) as unknown as number; });
    vi.stubGlobal("cancelAnimationFrame", (frame: number): void => { clearTimeout(frame); });
    const slot = document.createElement("span");
    document.body.append(slot);
    return { cx: CxCharacter.mount(slot, { size: 67.2, state: "greeting", motion }), frames: () => frames };
  }

  it("waves once and is ready from the moment the wave ends, never waving again", async () => {
    const { cx } = greeting("auto");
    await vi.advanceTimersByTimeAsync(2_100);
    expect([cx.state, cx.element.getAttribute("data-state")]).toEqual(["greeting", "greeting"]);
    await vi.advanceTimersByTimeAsync(200);
    expect([cx.state, cx.element.getAttribute("data-state")]).toEqual(["ready", "ready"]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(cx.state).toBe("ready");
    cx.destroy();
  });

  it("draws one frame and holds it under reduced motion, asking for no frame after", async () => {
    const { cx, frames } = greeting("still");
    await vi.advanceTimersByTimeAsync(5_000);
    expect([cx.state, frames(), cx.element.getAttribute("aria-hidden")]).toEqual(["greeting", 0, "true"]);
    cx.destroy();
  });
});
