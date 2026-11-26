import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInContext, type Context } from "node:vm";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";

// The login page's picture, run by the page's own script over the page as the build writes it (`site/login.html` and
// `login.en.html`, with the copies of the site's scripts under `site/www/`). It plays on under a pointer and the keyboard and has no
// button of its own (ruled 2026-10-26 and 2026-11-02); it stops while it is scrolled out of sight and plays again when it is back; and
// under reduced motion it holds the first example, answered, and asks for no frame. The frames it asks for and the observers it makes
// are held here, so a test runs them: only the picture asks for frames on this page.
const SITE = join(import.meta.dirname, "site");
const SCRIPTS = ["chrome.js", "sign-in.js"].map((name) => readFileSync(join(SITE, "www", "assets", "js", name), "utf8"));
const PAGES = { zh: "login.html", en: "login.en.html" } as const;
const BUTTON_NAMES = ["暂停演示", "播放演示", "Pause the demo", "Play the demo"];
type Seen = (entries: readonly { readonly isIntersecting: boolean }[]) => void;

let shown: Window | undefined;
afterEach(async () => {
  await shown?.happyDOM.close();
  shown = undefined;
});

function open(language: keyof typeof PAGES, motion: "no-preference" | "reduce") {
  const win = new Window({
    url: `https://comchatx.com/login?lang=${language}`,
    width: 1440,
    height: 900,
    settings: {
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      handleDisabledFileLoadingAsSuccess: true,
      navigation: { disableFallbackToSetURL: true },
      device: { prefersReducedMotion: motion },
    },
  });
  shown = win;
  const frames = new Map<number, (ms: number) => void>();
  let asked = 0;
  const watched: { readonly target: unknown; readonly seen: Seen }[] = [];
  const stubs = {
    requestAnimationFrame: (callback: (ms: number) => void): number => {
      frames.set(++asked, callback);
      return asked;
    },
    cancelAnimationFrame: (id: number): void => {
      frames.delete(id);
    },
    IntersectionObserver: class {
      readonly #seen: Seen;
      constructor(seen: Seen) {
        this.#seen = seen;
      }
      observe(target: unknown): void {
        watched.push({ target, seen: this.#seen });
      }
      unobserve(): void {}
      disconnect(): void {}
    },
  };
  for (const [name, value] of Object.entries(stubs)) Object.defineProperty(win, name, { value, configurable: true, writable: true });
  const doc = win.document;
  doc.write(readFileSync(join(SITE, PAGES[language]), "utf8"));
  for (const source of SCRIPTS) runInContext(source, win as unknown as Context);
  const art = doc.querySelector("[data-art]")!;
  /** The browser tells the picture's observer whether the picture is in view. */
  const inView = (showing: boolean): void => {
    for (const { target, seen } of watched) if (target === art) seen([{ isIntersecting: showing }]);
  };
  /** The browser's next paint: it runs the frames asked for until now, and the picture's clock asks for the one after. */
  const paint = (ms: number): void => {
    const now = [...frames.values()];
    frames.clear();
    for (const callback of now) callback(ms);
  };
  return { win, doc, art, frames, watched, inView, paint };
}

describe.each(["zh", "en"] as const)("the login page's picture, in %s", (language) => {
  it("has no button of its own, and nothing in it takes the keyboard", () => {
    const { doc, art } = open(language, "no-preference");
    expect(doc.querySelector("[data-art-pause]")).toBeNull();
    const named = [...doc.querySelectorAll("[aria-label], button")].filter((el) =>
      BUTTON_NAMES.some((name) => el.getAttribute("aria-label") === name || el.textContent.trim() === name));
    expect(named).toEqual([]);
    expect(art.querySelectorAll("a[href], button, input, select, textarea, [tabindex]")).toHaveLength(0);
  });

  it("plays on while a pointer rests on it and while the keyboard is in it", () => {
    const { win, art, frames, inView, paint } = open(language, "no-preference");
    inView(true);
    expect(frames.size).toBe(1);
    art.dispatchEvent(new win.PointerEvent("pointerenter"));
    expect(frames.size).toBe(1);
    art.dispatchEvent(new win.FocusEvent("focusin", { bubbles: true }));
    expect(frames.size).toBe(1);
    paint(16);
    paint(33);
    expect(frames.size).toBe(1);
    art.dispatchEvent(new win.PointerEvent("pointerleave"));
    art.dispatchEvent(new win.FocusEvent("focusout", { bubbles: true }));
    expect(frames.size).toBe(1);
  });

  it("stops while it is scrolled out of sight, and plays again when it is back", () => {
    const { frames, watched, art, inView, paint } = open(language, "no-preference");
    expect(watched.filter(({ target }) => target === art)).toHaveLength(1);
    expect(frames.size).toBe(0);
    inView(true);
    expect(frames.size).toBe(1);
    inView(false);
    expect(frames.size).toBe(0);
    paint(16);
    expect(frames.size).toBe(0);
    inView(true);
    expect(frames.size).toBe(1);
  });

  it("holds still under reduced motion and asks for no frame", () => {
    const { doc, art, frames, watched } = open(language, "reduce");
    expect(doc.querySelector(".hero-media")!.classList.contains("is-still")).toBe(true);
    expect(watched.filter(({ target }) => target === art)).toEqual([]);
    expect(frames.size).toBe(0);
  });
});
