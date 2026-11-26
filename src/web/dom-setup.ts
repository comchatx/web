import { afterEach, beforeEach, vi } from "vitest";

// A page lives as long as its document and has no signal of its own end, so a timer, an interval or a frame it asked for during a test
// can fire after the test environment's document is taken down, with no `document` or `requestAnimationFrame` there: an error no test
// owns. And while it waits, it keeps the page that asked for it, and every page after it, alive for the rest of the file; so does a
// listener left on the window, the document or a media query (whose own listener hangs one on happy-dom's window, which only its
// removal takes off). Every test on a document ends by taking back what was asked for since the last one ended; what a file asked for
// before its first test stays. The records are kept under the spies a test may restore, so a restore leaves them recording.
if (typeof document !== "undefined") {
  // A test's page reaches no other machine: a link pressed, in a new tab or in the page, goes nowhere, and a script, a sheet or a frame
  // from another site is not loaded. A test that needs an answer from a server gives it through its own stubs.
  const browser = (window as unknown as { happyDOM: { settings: { navigation: Record<string, boolean>; disableJavaScriptFileLoading: boolean; disableCSSFileLoading: boolean; handleDisabledFileLoadingAsSuccess: boolean } } }).happyDOM.settings;
  browser.navigation["disableMainFrameNavigation"] = true;
  browser.navigation["disableChildFrameNavigation"] = true;
  browser.navigation["disableChildPageNavigation"] = true;
  browser.disableJavaScriptFileLoading = true;
  browser.disableCSSFileLoading = true;
  // A refused load is said as loaded, so a page's own handling of a load goes on and no error is written for what no test asked to read.
  browser.handleDisabledFileLoadingAsSuccess = true;
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  const intervals: ReturnType<typeof setInterval>[] = [];
  const frames: number[] = [];
  const listeners: (readonly [EventTarget, string, EventListenerOrEventListenerObject | null, boolean | AddEventListenerOptions | undefined])[] = [];
  const kept = <F extends (...args: never[]) => unknown>(real: F, into: ReturnType<F>[]): F =>
    function (this: unknown, ...args: Parameters<F>): ReturnType<F> { const id = real.apply(this, args) as ReturnType<F>; into.push(id); return id; } as F;
  globalThis.setTimeout = kept(globalThis.setTimeout, timeouts);
  globalThis.setInterval = kept(globalThis.setInterval, intervals);
  globalThis.requestAnimationFrame = kept(globalThis.requestAnimationFrame, frames);
  for (const owner of [window, document, Object.getPrototypeOf(window.matchMedia("all")) as EventTarget]) {
    const add = owner.addEventListener;
    owner.addEventListener = function (this: EventTarget | undefined, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
      // The window's own, called bare, has no receiver: it is the window's.
      const target = this ?? owner;
      listeners.push([target, type, listener, options]);
      add.call(target, type, listener, options);
    };
  }
  // Spied for the tests that count what a page asks for; spied again where a test restored every mock.
  const spied = (): void => {
    if (!vi.isMockFunction(globalThis.setTimeout)) vi.spyOn(globalThis, "setTimeout");
    if (!vi.isMockFunction(globalThis.requestAnimationFrame)) vi.spyOn(globalThis, "requestAnimationFrame");
  };
  spied();
  let started = false;
  beforeEach(() => {
    spied();
    // The example world holds a plugin with a new version, so the feature card would stand at the end of every conversation a test opens
    // and read the Plugins page's world once: each test begins with it put away today, and the card's own tests take that back.
    const now = new Date();
    localStorage.setItem("cx.feature-card.day", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
    if (started) return;
    started = true;
    timeouts.length = 0; intervals.length = 0; frames.length = 0; listeners.length = 0;
  });
  afterEach(() => {
    for (const id of timeouts.splice(0)) clearTimeout(id);
    for (const id of intervals.splice(0)) clearInterval(id);
    for (const id of frames.splice(0)) cancelAnimationFrame(id);
    for (const [target, type, listener, options] of listeners.splice(0)) target.removeEventListener(type, listener, options);
    // A mock keeps what it was called with, and on what, for as long as the file runs: a callback, an element, the page behind them.
    vi.clearAllMocks();
  });
}
