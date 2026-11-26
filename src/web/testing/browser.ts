import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable, Writable } from "node:stream";

/** The keys a test presses, by the key code the browser reports. */
const KEYS = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Delete: 46, Home: 36, End: 35, " ": 32 } as const;
export type Key = keyof typeof KEYS;

/** Where Chrome is: `CHROME_PATH` where it is set, else the place macOS and Linux install it. */
export function chromePath(): string {
  const named = process.env["CHROME_PATH"];
  if (named !== undefined && named !== "") return named;
  for (const place of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]) if (existsSync(place)) return place;
  throw new Error("no Chrome found: set CHROME_PATH");
}

/**
 * A headless Chrome driven over its DevTools pipe, so a page's real layout can be read: the stand-in DOM the unit tests use lays nothing
 * out. One page, sized as asked, opened from a file or from an `http` address; `close` ends the browser and removes its profile.
 */
export async function browser(options: { /** Takes any certificate, for a test's own `https` servers on loopback. */ readonly anyCertificate?: true } = {}): Promise<{ /** A file path, or an http address the test serves. */ readonly open: (file: string, width: number, height: number) => Promise<void>; /** The window given another size, the page kept as it is. */ readonly size: (width: number, height: number) => Promise<void>; /** The media the page reads, as the system would set it: `{ "prefers-reduced-motion": "reduce" }`; `{}` gives the page the system's own again. */ readonly media: (features: Readonly<Record<string, string>>) => Promise<void>; readonly evaluate: <T>(expression: string) => Promise<T>; readonly shot: (file: string) => Promise<void>; readonly press: (x: number, y: number) => Promise<void>; /** A real press that goes down at one point and up at another. */ readonly drag: (from: readonly [number, number], to: readonly [number, number]) => Promise<void>; /** The pointer moved to a point of the window, nothing pressed. */ readonly point: (x: number, y: number) => Promise<void>; /** The wheel turned at a point of the window, `dy` pixels down. */ readonly wheel: (x: number, y: number, dy: number) => Promise<void>; /** `held` is Shift, or CDP's modifiers: Alt 1, Ctrl 2, ⌘ 4, Shift 8. */ readonly key: (name: Key | (string & {}), held?: boolean | number) => Promise<void>; /** An input method's choosing of `text`, then its Enter that takes the choice (key code 229, as the system hands it on), then the words it put in. */ compose: (text: string) => Promise<void>; /** An expression run in each frame of the page, its own and those inside it, cross-site ones among them: the first answer that is not null. */ readonly inFrames: <T>(expression: string) => Promise<T | null>; /** Downloads saved into `dir` from now on, and each one begun since, by its address and the name it is saved under. */ /** The addresses of the browser's tabs, the test's own and any a page opened. */ readonly tabs: () => Promise<readonly string[]>; /** Every tab a page opened closed, the test's own brought to the front. */ readonly closeOthers: () => Promise<void>; readonly downloads: (dir: string) => Promise<readonly { readonly url: string; readonly name: string }[]>; readonly close: () => Promise<void> }> {
  const profile = mkdtempSync(join(tmpdir(), "cmx-layout-"));
  const chrome: ChildProcess = spawn(chromePath(), ["--headless=new", "--remote-debugging-pipe", `--user-data-dir=${profile}`, "--no-first-run", "--disable-extensions", "--hide-scrollbars", ...(options.anyCertificate ? ["--ignore-certificate-errors"] : []), "about:blank"], { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
  const toChrome = chrome.stdio[3] as Writable;
  const fromChrome = chrome.stdio[4] as Readable;
  let next = 0;
  const waiting = new Map<number, (message: { result?: unknown; error?: { message: string } }) => void>();
  let buffered = "";
  fromChrome.on("data", (chunk: Buffer) => {
    buffered += chunk.toString("utf8");
    for (let end = buffered.indexOf("\0"); end >= 0; end = buffered.indexOf("\0")) {
      const message = JSON.parse(buffered.slice(0, end)) as { id?: number; result?: unknown; error?: { message: string }; method?: string; params?: Record<string, unknown>; sessionId?: string };
      buffered = buffered.slice(end + 1);
      if (message.id !== undefined) { waiting.get(message.id)?.(message); waiting.delete(message.id); }
      else if (message.method !== undefined) heard(message.method, message.params ?? {}, message.sessionId);
    }
  });
  // Every frame's own script world, by the session that holds it: a frame of another site is a target of its own, attached as it comes.
  const worlds = new Map<string, Set<number>>();
  const begun: { readonly url: string; readonly name: string }[] = [];
  const heard = (method: string, params: Record<string, unknown>, from?: string): void => {
    if (method === "Browser.downloadWillBegin") { begun.push({ url: String(params["url"]), name: String(params["suggestedFilename"]) }); return; }
    if (method === "Target.attachedToTarget") { const child = (params["sessionId"] as string); worlds.set(child, new Set()); void watch(child); return; }
    if (from === undefined) return;
    const held = worlds.get(from) ?? new Set<number>();
    worlds.set(from, held);
    if (method === "Runtime.executionContextCreated") { const context = params["context"] as { id: number; auxData?: { isDefault?: boolean } }; if (context.auxData?.isDefault === true) held.add(context.id); }
    if (method === "Runtime.executionContextDestroyed") held.delete(params["executionContextId"] as number);
    if (method === "Runtime.executionContextsCleared") held.clear();
  };
  const watch = async (session: string): Promise<void> => {
    await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, session).catch(() => undefined);
    await send("Runtime.enable", {}, session).catch(() => undefined);
  };
  const send = (method: string, params: object = {}, sessionId?: string): Promise<Record<string, unknown>> => new Promise((done, fail) => {
    const id = ++next;
    waiting.set(id, (message) => (message.error === undefined ? done((message.result ?? {}) as Record<string, unknown>) : fail(new Error(`${method}: ${message.error.message}`))));
    toChrome.write(`${JSON.stringify({ id, method, params, ...(sessionId === undefined ? {} : { sessionId }) })}\0`);
  });
  const targets = (await send("Target.getTargets")) as { targetInfos: readonly { targetId: string; type: string }[] };
  const page = targets.targetInfos.find((one) => one.type === "page")!;
  const { sessionId } = (await send("Target.attachToTarget", { targetId: page.targetId, flatten: true })) as { sessionId: string };
  await send("Page.enable", {}, sessionId);
  await watch(sessionId);
  const evaluate = async <T>(expression: string): Promise<T> =>
    ((await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId)) as { result: { value: T } }).result.value;
  return {
    open: async (file, width, height) => {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
      await send("Page.navigate", { url: /^https?:\/\//.test(file) ? file : `file://${file}` }, sessionId);
      for (let tries = 0; tries < 100 && (await evaluate<string>("document.readyState")) !== "complete"; tries++) await new Promise((done) => setTimeout(done, 50));
      await evaluate("document.fonts.ready.then(() => true)");
    },
    size: async (width, height) => { await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, sessionId); },
    media: async (features) => { await send("Emulation.setEmulatedMedia", { features: Object.entries(features).map(([name, value]) => ({ name, value })) }, sessionId); },
    evaluate,
    point: async (x, y) => { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }, sessionId); },
    wheel: async (x, y, dy) => { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: dy }, sessionId); },
    /** A real mouse press at a point of the window: the move, the button down and up, as a person's press comes; it gives the frame under it activation. */
    press: async (x, y) => {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }, sessionId);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 }, sessionId);
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 }, sessionId);
    },
    drag: async ([x, y], [toX, toY]) => {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }, sessionId);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 }, sessionId);
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: toX, y: toY, button: "left", buttons: 1 }, sessionId);
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: toX, y: toY, button: "left", buttons: 0, clickCount: 1 }, sessionId);
    },
    /** A real key, down and up, as the keyboard sends it: a named key by its code, else the text typed, into whatever holds the keyboard. */
    key: async (name, held = false) => {
      if (!(name in KEYS)) {
        for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: name, ...(type === "keyDown" ? { text: name, unmodifiedText: name } : {}) }, sessionId);
        return;
      }
      const code = KEYS[name as Key];
      const sent = { key: name, code: name === " " ? "Space" : name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers: held === true ? 8 : held === false ? 0 : held };
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...sent, ...(name === "Enter" ? { text: "\r" } : name === " " ? { text: " " } : {}) }, sessionId);
      if (name === "Enter" || name === " ") await send("Input.dispatchKeyEvent", { type: "char", ...sent, text: name === "Enter" ? "\r" : " " }, sessionId);
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...sent }, sessionId);
    },
    compose: async (text) => {
      await send("Input.imeSetComposition", { text, selectionStart: text.length, selectionEnd: text.length }, sessionId);
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 }, sessionId);
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 }, sessionId);
      await send("Input.insertText", { text }, sessionId);
    },
    /** The window as laid out, written as a PNG. */
    shot: async (file) => {
      const { data } = (await send("Page.captureScreenshot", { format: "png" }, sessionId)) as { data: string };
      writeFileSync(file, Buffer.from(data, "base64"));
    },
    inFrames: async <T>(expression: string): Promise<T | null> => {
      for (const [session, contexts] of worlds) for (const contextId of contexts) {
        const said = await send("Runtime.evaluate", { expression, contextId, returnByValue: true, awaitPromise: true }, session).catch(() => undefined) as { result?: { value?: T } } | undefined;
        if (said?.result?.value !== undefined && said.result.value !== null) return said.result.value;
      }
      return null;
    },
    closeOthers: async () => {
      const all = ((await send("Target.getTargets")) as { targetInfos: readonly { type: string; targetId: string }[] }).targetInfos;
      for (const one of all) if (one.type === "page" && one.targetId !== page.targetId) await send("Target.closeTarget", { targetId: one.targetId });
      await send("Page.bringToFront", {}, sessionId);
    },
    tabs: async () => ((await send("Target.getTargets")) as { targetInfos: readonly { type: string; url: string }[] }).targetInfos.filter((one) => one.type === "page").map((one) => one.url),
    downloads: async (dir) => {
      await send("Browser.setDownloadBehavior", { behavior: "allowAndName", downloadPath: dir, eventsEnabled: true });
      return begun;
    },
    close: async () => {
      const ended = new Promise((done) => chrome.once("exit", done));
      chrome.kill();
      await ended;
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}
