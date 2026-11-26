import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { LANGUAGE_KEY } from "./door-words.js";

const SCRIPT = readFileSync(join(import.meta.dirname, "site", "door-start.js"), "utf8");

/**
 * The door's first script run in a page of `lang`, at `address`, in a browser that kept `kept` and whose languages are `browser`: where it
 * sent the page, and the classes it set.
 */
function opened(lang: string, address: string, kept: string | null, storage: "kept" | "refused" = "kept", browser: readonly string[] = ["zh-CN"]) {
  const url = new URL(address, "https://comchatx.com");
  const classes = new Set<string>();
  const replace = vi.fn();
  const store = (values: Map<string, string>) => storage === "refused"
    ? { getItem: () => { throw new Error("refused"); }, setItem: () => { throw new Error("refused"); } }
    : { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  runInNewContext(SCRIPT, {
    URLSearchParams, navigator: { languages: browser },
    document: { documentElement: { lang, classList: { add: (name: string) => classes.add(name) } } },
    location: { pathname: url.pathname, search: url.search, hash: url.hash, replace },
    localStorage: store(new Map(kept === null ? [] : [[LANGUAGE_KEY, kept]])),
    sessionStorage: store(new Map()),
  });
  return { sent: replace.mock.calls.map(([to]) => to as string), classes: [...classes].sort() };
}

it("opens the door in the language this browser kept last when the address names none, keeping the rest of the address", () => {
  expect(opened("zh-CN", "/login?door=expired#/factor-one", "en").sent).toEqual(["/login?door=expired&lang=en#/factor-one"]);
  expect(opened("zh-CN", "/login", "en").sent).toEqual(["/login?lang=en"]);
});

it("opens the door in the browser's language when nothing was kept and the address names none", () => {
  expect(opened("zh-CN", "/login?door=expired#/factor-one", null, "kept", ["en-US"]).sent).toEqual(["/login?door=expired&lang=en#/factor-one"]);
  expect(opened("zh-CN", "/login", null, "refused", ["ja"]).sent).toEqual(["/login?lang=en"]);
  expect(opened("zh-CN", "/login", null, "kept", []).sent).toEqual(["/login?lang=en"]);
  // A kept choice outranks the browser, back to Chinese as to English.
  expect(opened("en", "/login?door=expired", "zh", "kept", ["en-US"]).sent).toEqual(["/login?door=expired&lang=zh"]);
});

it("leaves the page where it is when the address names a language, the page is already the kept one, or nothing was kept and the page is the browser's", () => {
  expect(opened("zh-CN", "/login?lang=zh", "en").sent).toEqual([]);
  expect(opened("en", "/login?lang=en", "zh").sent).toEqual([]);
  expect(opened("zh-CN", "/login", "zh").sent).toEqual([]);
  expect(opened("zh-CN", "/login", null).sent).toEqual([]);
  expect(opened("zh-CN", "/login", "en", "refused").sent).toEqual([]);
});

it("sets what the site's pages set before they draw: the script is on, ?still holds the picture, and the visit's first page lets the header come down", () => {
  expect(opened("zh-CN", "/login?lang=zh&still", null).classes).toEqual(["enter", "js", "still"]);
  expect(opened("zh-CN", "/login?lang=zh", null, "refused").classes).toEqual(["enter", "js"]);
});
