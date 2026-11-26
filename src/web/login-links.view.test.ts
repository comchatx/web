import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInContext, type Context } from "node:vm";
import { Window, type Element as PageElement } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

// The login page's own script, run over the page as the build writes it (`site/login.html` and `login.en.html`, with the copies of
// the site's scripts under `site/www/`): the page's five ways in go to the card and its three ComChatX marks to the top, and every
// other link is the browser's, the skip link to the content first of all (brief 2026-10-22-57, corrections 24 and 25). The card is
// Clerk's, mounted by the door; here the column is empty, as before it mounts, or holds one field, as after.
const SITE = join(import.meta.dirname, "site");
const SCRIPTS = ["chrome.js", "sign-in.js"].map((name) => readFileSync(join(SITE, "www", "assets", "js", name), "utf8"));
const PAGES = {
  zh: { file: "login.html", waysIn: ["试用 ComChatX", "试用 ComChatX", "试用 ComChatX", "订阅", "登录"], skip: "跳到正文" },
  en: { file: "login.en.html", waysIn: ["Try ComChatX", "Try ComChatX", "Try ComChatX", "Subscribe", "Log in"], skip: "Skip to main content" },
} as const;
type Language = keyof typeof PAGES;
type Keys = { readonly ctrlKey?: boolean; readonly metaKey?: boolean; readonly shiftKey?: boolean; readonly altKey?: boolean };

let shown: Window | undefined;
afterEach(async () => {
  await shown?.happyDOM.close();
  shown = undefined;
});

/** The page in a window of its own with its scripts run in it: nothing is fetched, and a followed link moves nothing but a fragment. */
function open(language: Language, card: "empty" | "field") {
  const address = `https://comchatx.com/login?lang=${language}&still`;
  const win = new Window({
    url: address,
    width: 1280,
    height: 800,
    settings: {
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      handleDisabledFileLoadingAsSuccess: true,
      navigation: { disableFallbackToSetURL: true },
    },
  });
  shown = win;
  const doc = win.document;
  doc.write(readFileSync(join(SITE, PAGES[language].file), "utf8"));
  const field = doc.createElement("input");
  field.type = "email";
  if (card === "field") doc.querySelector("#door-card")!.append(field);
  for (const source of SCRIPTS) runInContext(source, win as unknown as Context);
  const links = [...doc.querySelectorAll("a")];
  const saying = (words: string) => links.filter((link) => link.textContent.trim() === words);
  const waysIn = [...new Set(PAGES[language].waysIn)].flatMap(saying);
  return { win, doc, address, field, links, waysIn, marks: saying("ComChatX"), skip: saying(PAGES[language].skip) };
}

/** One press of the main button, as a click or the keyboard's Enter makes it: true when the page's script left it to the browser. */
const press = (win: Window, link: PageElement, keys: Keys = {}): boolean =>
  link.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...keys }));

describe.each(["zh", "en"] as const)("the login page's links, in %s", (language) => {
  it("leaves the skip link to the browser before the card mounts, so the address reaches #main", () => {
    const { win, doc, skip } = open(language, "empty");
    expect(skip).toHaveLength(1);
    expect(skip[0]!.getAttribute("href")).toBe("#main");
    skip[0]!.focus();
    expect(press(win, skip[0]!)).toBe(true);
    expect(win.location.hash).toBe("#main");
    expect(doc.querySelector(win.location.hash)?.tagName).toBe("MAIN");
  });

  it("sends each of its five ways in to the card's field once the card has one, loading nothing", () => {
    const { win, doc, address, field, waysIn } = open(language, "field");
    expect(waysIn).toHaveLength(5);
    for (const link of waysIn) {
      link.focus();
      expect(press(win, link)).toBe(false);
      expect(doc.activeElement).toBe(field);
    }
    expect(win.location.href).toBe(address);
  });

  it("before the card mounts, keeps a way in from loading the page and puts the keyboard nowhere else", () => {
    const { win, doc, waysIn } = open(language, "empty");
    for (const link of waysIn) {
      link.focus();
      expect(press(win, link)).toBe(false);
      expect(doc.activeElement).toBe(link);
    }
  });

  it("sends its three ComChatX marks to the top and the keyboard to the header's mark", () => {
    const { win, doc, marks } = open(language, "field");
    const scrolled = vi.spyOn(win, "scrollTo");
    expect(marks).toHaveLength(3);
    for (const mark of marks) {
      mark.focus();
      expect(press(win, mark)).toBe(false);
      expect(doc.activeElement).toBe(doc.querySelector(".header-row > .brand"));
    }
    expect(scrolled).toHaveBeenCalledTimes(3);
  });

  it("leaves a press with a modifier key to the browser", () => {
    const { win, doc, field, waysIn, marks } = open(language, "field");
    for (const keys of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }])
      for (const link of [...waysIn, ...marks]) {
        link.focus();
        expect(press(win, link, keys)).toBe(true);
        expect(doc.activeElement).not.toBe(field);
      }
  });

  it("leaves every other link to the browser: the skip link, the language menu, and the links to other pages", () => {
    const { win, links, waysIn, marks } = open(language, "field");
    const others = links.filter((link) => !waysIn.includes(link) && !marks.includes(link));
    expect(others.map((link) => link.textContent.trim())).toEqual(expect.arrayContaining([PAGES[language].skip, "中文", "English"]));
    for (const link of others) expect(press(win, link), link.outerHTML).toBe(true);
  });
});
