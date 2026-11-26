// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";

// What one test leaves behind on a document, the next finds taken back: each `it` here reads what the one before it left.
const heard: string[] = [];
const kept = vi.fn();
let ticking = 0;

it("leaves a listener on the window, the document and a media query, an interval, a frame, a timeout after restoring every mock, and a mock's calls", () => {
  window.addEventListener("resize", () => { heard.push("window"); });
  window.matchMedia("(max-width: 10px)").addEventListener("change", () => { heard.push("media"); });
  document.addEventListener("visibilitychange", () => { heard.push("document"); });
  setInterval(() => { ticking += 1; }, 5);
  requestAnimationFrame(() => { heard.push("frame"); });
  vi.restoreAllMocks();
  setTimeout(() => { heard.push("timeout"); }, 5);
  kept({ page: document.createElement("div") });
  expect(kept).toHaveBeenCalledTimes(1);
});

it("finds every one of them taken back once that test ended", async () => {
  // A width the media query comes to match: its listener, were it there, would hear the change.
  (window as unknown as { happyDOM: { setViewport: (size: { width: number }) => void } }).happyDOM.setViewport({ width: 0 });
  document.dispatchEvent(new Event("visibilitychange"));
  const was = ticking;
  await new Promise((resolve) => { setTimeout(resolve, 30); });
  expect([heard, ticking - was, kept.mock.calls]).toEqual([[], 0, []]);
  expect(vi.isMockFunction(setTimeout)).toBe(true);
});

it("asks nothing of the network when a test presses a link to another site, in a new tab or in the page, or puts in a script, a sheet or a frame from one", async () => {
  type Settings = { fetch: { interceptor: unknown } };
  const settings = (window as unknown as { happyDOM: { settings: Settings } }).happyDOM.settings;
  const asked: string[] = [];
  // Every request the page would make is counted here and answered with nothing, so the witness itself leaves the machine for none.
  settings.fetch.interceptor = {
    beforeAsyncRequest: async ({ request }: { request: { url: string } }) => { asked.push(request.url); return new Response("", { status: 204 }); },
    beforeSyncRequest: ({ request }: { request: { url: string } }) => { asked.push(request.url); return { status: 204, statusText: "", ok: true, url: request.url, redirected: false, headers: new Headers(), body: Buffer.from("") }; },
  };
  try {
    const away = Object.assign(document.createElement("a"), { href: "https://example.invalid/away", target: "_blank" });
    const here = Object.assign(document.createElement("a"), { href: "https://example.invalid/here" });
    const script = Object.assign(document.createElement("script"), { src: "https://example.invalid/a.js" });
    const sheet = Object.assign(document.createElement("link"), { rel: "stylesheet", href: "https://example.invalid/a.css" });
    const frame = Object.assign(document.createElement("iframe"), { src: "https://example.invalid/frame" });
    document.body.append(away, here, script, sheet, frame);
    away.click();
    here.click();
    await new Promise((resolve) => { setTimeout(resolve, 30); });
    expect(asked).toEqual([]);
  } finally {
    settings.fetch.interceptor = null;
    document.body.replaceChildren();
  }
});
