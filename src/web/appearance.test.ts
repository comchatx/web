import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

const source = readFileSync(new URL("./site/appearance.js", import.meta.url), "utf8");

/** The page's appearance script run as the page runs it, over a browser that keeps what it is given (or keeps nothing) and a system scheme. */
function page(kept: Record<string, string>, systemDark: boolean, keeps = true) {
  const attributes = new Map<string, string>();
  const listeners: Record<string, ((event: { key: string }) => void)[]> = {};
  const scheme = { matches: systemDark, change: [] as (() => void)[], addEventListener: (_: string, then: () => void) => { scheme.change.push(then); } };
  const storage = {
    getItem: (key: string) => { if (!keeps) throw new Error("denied"); return kept[key] ?? null; },
    setItem: (key: string, value: string) => { if (!keeps) throw new Error("denied"); kept[key] = value; },
  };
  const window = { matchMedia: () => scheme, addEventListener: (name: string, then: (event: { key: string }) => void) => { (listeners[name] ??= []).push(then); } };
  const context: Record<string, unknown> = { window, localStorage: storage, document: { documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) } } };
  context["globalThis"] = context;
  runInNewContext(source, context);
  const appearance = context["CmxAppearance"] as { read: () => string; choose: (chosen: string) => void };
  return { theme: () => attributes.get("data-theme"), appearance, scheme, storage: (key: string) => listeners["storage"]?.forEach((then) => then({ key })) };
}

it("sets the theme's set before anything is drawn: the system's by default, or the one chosen and kept", () => {
  expect(page({}, false).theme()).toBe("light");
  expect(page({}, true).theme()).toBe("dark");
  expect(page({ "cmx-appearance": "light" }, true).theme()).toBe("light");
  expect(page({ "cmx-appearance": "dark" }, false).theme()).toBe("dark");
  const unknown = page({ "cmx-appearance": "sepia" }, true);
  expect([unknown.theme(), unknown.appearance.read()]).toEqual(["dark", "system"]);
});

it("follows the system while it is chosen, and stops following it once light or dark is", () => {
  const kept: Record<string, string> = {};
  const shown = page(kept, false);
  shown.scheme.matches = true;
  shown.scheme.change.forEach((then) => then());
  expect(shown.theme()).toBe("dark");
  shown.appearance.choose("light");
  expect([shown.theme(), shown.appearance.read(), kept["cmx-appearance"]]).toEqual(["light", "light", "light"]);
  shown.scheme.change.forEach((then) => then());
  expect(shown.theme()).toBe("light");
  shown.appearance.choose("nonsense");
  expect(shown.appearance.read()).toBe("light");
});

it("takes a choice made in another tab, and holds a choice on the page where the browser keeps nothing", () => {
  const kept: Record<string, string> = {};
  const shown = page(kept, false);
  kept["cmx-appearance"] = "dark";
  shown.storage("cmx-appearance");
  expect(shown.theme()).toBe("dark");
  const bare = page({}, false, false);
  bare.appearance.choose("dark");
  expect([bare.theme(), bare.appearance.read()]).toEqual(["dark", "dark"]);
});
