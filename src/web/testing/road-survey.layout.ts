import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { type AccountMoney, type Me } from "../backend.js";
import { dollars } from "../../shared/money.js";
import { openRoad, type RoadBackend } from "../road.js";
import { browser } from "./browser.js";

// The sign-up survey's two pages drawn by the road's own code in the stand-in DOM, three of the first page's options chosen and one of
// the second's, laid out by Chrome under the start page's stylesheets at a phone's 320, 700 and 1,280, in both languages and themes.
const SITE = join(process.cwd(), "src/web/site");
const SHEETS = ["theme.css", "www/assets/css/base.css", "www/assets/css/chrome.css", "www/assets/css/sign-in.css", "www/assets/css/pricing.css", "door.css", "pay.css", "road.css", "forms.css"];
const CX = pathToFileURL(join(process.cwd(), "src/web/cx.js")).href;
const WIDTHS = [320, 700, 1280] as const;
const UNITS = 1_000_000;
const me: Me = { kind: "signed_in", account: "a1", email: "chen@example.com", name: undefined, box: "pending", balance: undefined, money: dollars(UNITS), spending: undefined, terms: true };
const money = { state: "trial", figure: 0, model_figure: 0, debt: 0, blocks: { given: 0, paid: 0 }, warning: { below: 0, low: false, model_low: false },
  lots: [{ kind: "sign_up", landed_on: "2026-11-13", units: UNITS, remainder: UNITS, used: 0, ends_on: "2026-11-20", days_left: 7 }],
  renewal: { price: 10 * UNITS, takes: 0, short: 0 }, next_period: { last_day: "2026-12-12", renews_on: "2026-12-13" } } as AccountMoney;

let chrome: Awaited<ReturnType<typeof browser>>;
const scratch = mkdtempSync(join(tmpdir(), "cmx-road-survey-"));
beforeAll(async () => { chrome = await browser(); });
afterAll(async () => { await chrome.close(); rmSync(scratch, { recursive: true, force: true }); });

const settled = async (): Promise<void> => { for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0)); };
/** A page of the survey as the road draws it, for the longest name the name field takes. */
async function drawn(language: "zh" | "en", second: boolean): Promise<string> {
  const backend = {
    me: async () => me, accountMoney: async () => money, acceptTerms: async () => undefined, setName: async () => undefined, startBox: async () => false,
    leave: async () => "ended" as const, features: { checkout: true }, returned: async () => ({ state: "unpaid" as const }),
    spaces: async () => undefined,
  } as unknown as RoadBackend;
  const root = document.createElement("div");
  root.id = "road";
  document.body.append(root);
  await openRoad(root, { backend, language, year: 2026, go: vi.fn(), skip: vi.fn(), cx: () => document.createElementNS("http://www.w3.org/2000/svg", "svg"), storage: sessionStorage });
  await settled();
  root.querySelector<HTMLButtonElement>(".trial button")!.click();
  await settled();
  const field = root.querySelector<HTMLInputElement>("#call")!;
  field.value = (language === "zh" ? "陈" : "W").repeat(Number(field.maxLength));
  field.dispatchEvent(new Event("input"));
  root.querySelector("form")!.requestSubmit();
  await settled();
  const choose = (...at: readonly number[]): void => { const blocks = root.querySelectorAll<HTMLInputElement>(".f-block input"); for (const n of at) blocks[n]!.click(); };
  choose(0, 3, 4);
  if (second) {
    root.querySelector<HTMLButtonElement>(".road-ask-acts .road-go")!.click();
    await settled();
    choose(4);
  }
  // A box ticked by a press holds it as a property, which markup does not carry.
  for (const box of root.querySelectorAll<HTMLInputElement>("input[type='checkbox']")) box.toggleAttribute("checked", box.checked);
  const html = root.outerHTML;
  root.remove();
  return html;
}

async function opened(markup: string, name: string, language: "zh" | "en", theme: "light" | "dark", width: number): Promise<void> {
  const file = join(scratch, `${name}.html`);
  const links = SHEETS.map((sheet) => `<link rel="stylesheet" href="${pathToFileURL(join(SITE, sheet)).href}">`).join("");
  writeFileSync(file, `<!doctype html><html lang="${language === "zh" ? "zh-CN" : "en"}" data-theme="${theme}"><head><meta charset="utf-8">${links}<script src="${CX}"></script></head><body class="theme-app" data-page="login">${markup}</body></html>`);
  await chrome.open(file, width, 900);
}

// What a page holds to at a width: nothing wider than the window, every block inside the column, each option's words on one line, and
// 「可多选」 whole on one line.
const FITS = `(() => {
  const chips = [...document.querySelectorAll(".road-chips")].map((one) => one.getBoundingClientRect());
  const blocks = [...document.querySelectorAll(".f-block")].map((block) => {
    const box = block.getBoundingClientRect(), words = block.querySelector("span"), lines = words.getClientRects().length;
    return { words: words.textContent, inside: chips.some((one) => box.left >= one.left - 0.5 && box.right <= one.right + 0.5), lines };
  });
  return { wider: document.documentElement.scrollWidth > innerWidth, outside: blocks.filter((one) => !one.inside).map((one) => one.words),
    broken: blocks.filter((one) => one.lines > 1).map((one) => one.words), many: [...document.querySelectorAll(".road-many")].map((one) => one.getClientRects().length) };
})()`;

it("keeps both pages inside the window at every width, each option's words on one line and 可多选 whole, in both languages and themes", async () => {
  const seen: (readonly [string, number, string, number, unknown])[] = [];
  for (const language of ["zh", "en"] as const) for (const second of [false, true]) {
    const markup = await drawn(language, second);
    for (const theme of ["light", "dark"] as const) for (const width of WIDTHS) {
      await opened(markup, `fits-${language}-${second ? 2 : 1}-${theme}`, language, theme, width);
      seen.push([language, second ? 2 : 1, theme, width, await chrome.evaluate<unknown>(FITS)]);
    }
  }
  expect(seen).toEqual(seen.map(([language, page, theme, width]) => [language, page, theme, width, { wider: false, outside: [], broken: [], many: [1] }]));
});

it("holds the Chinese question's words whole where the line turns, at every width", async () => {
  const markup = await drawn("zh", false);
  const split: unknown[] = [];
  for (const width of WIDTHS) {
    await opened(markup, "whole", "zh", "light", width);
    split.push([width, await chrome.evaluate(`(() => {
      const heading = document.querySelector("#ask-shops"), range = document.createRange();
      const node = heading.firstChild, text = node.textContent;
      const top = (at) => { range.setStart(node, at); range.setEnd(node, at + 1); return Math.round(range.getBoundingClientRect().top); };
      // Where each seen character stands in the text, the joiners that hold a word together left out.
      const seen = [...text].flatMap((ch, at) => (ch === "\\u2060" ? [] : [at]));
      const plain = text.replace(/\\u2060/g, "");
      return ["选择", "身份", "让我更好地帮你"].filter((word) => {
        const from = plain.indexOf(word);
        return new Set(seen.slice(from, from + word.length).map(top)).size > 1;
      });
    })()`)]);
  }
  expect(split).toEqual(WIDTHS.map((width) => [width, []]));
});

it("draws a chosen block with the action's edge on the wash, an unchosen one under the pointer on the floating shade, in both themes", async () => {
  const markup = await drawn("zh", false);
  const read: unknown[] = [];
  for (const theme of ["light", "dark"] as const) {
    await opened(markup, `block-${theme}`, "zh", theme, 1280);
    const free = await chrome.evaluate<readonly [number, number]>(`(() => { const box = document.querySelectorAll(".f-block")[1].getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; })()`);
    await chrome.point(free[0], free[1]);
    read.push([theme, await chrome.evaluate(`(() => {
      const probe = document.createElement("i"); document.body.append(probe);
      const token = (name, prop) => { probe.style.cssText = prop + ": var(" + name + ")"; return getComputedStyle(probe)[prop === "color" ? "color" : "backgroundColor"]; };
      const [chosen, hovered] = [...document.querySelectorAll(".f-block")].map((one) => getComputedStyle(one));
      return [chosen.borderTopColor === token("--act", "color"), chosen.backgroundColor === token("--wash", "background-color"), chosen.boxShadow.includes("inset"),
        hovered.backgroundColor === token("--float-hover", "background-color"), hovered.borderTopColor === token("--line", "color")];
    })()`)]);
  }
  expect(read).toEqual([["light", [true, true, true, true, true]], ["dark", [true, true, true, true, true]]]);
});

it("keeps cx's waving hand clear of the page's head through the whole wave, at a phone's width and a desk's", async () => {
  const markup = await drawn("zh", false);
  const gaps: unknown[] = [];
  for (const width of [320, 1280]) {
    await opened(markup, "wave", "zh", "light", width);
    gaps.push([width, await chrome.evaluate(`(() => {
      const head = document.querySelector(".road-head").getBoundingClientRect().bottom, holder = document.querySelector(".road-cx-holder");
      let closest = Infinity;
      for (let at = 0; at <= 2.2; at += 0.05) {
        holder.replaceChildren();
        const drawing = CxCharacter.mount(holder, { size: 67.2, state: "greeting", motion: "still", stillAt: at }).element;
        drawing.setAttribute("viewBox", "-78 -40 156 81"); drawing.classList.add("road-cx"); drawing.style.display = "";
        closest = Math.min(closest, drawing.querySelector(".cx-hands").getBoundingClientRect().top - head);
      }
      return closest > 0;
    })()`)]);
  }
  expect(gaps).toEqual([[320, true], [1280, true]]);
});
