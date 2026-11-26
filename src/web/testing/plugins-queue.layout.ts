import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { FIRST_RELEASE, type Backend, type Click, type ClickEnd, type Me, type Package, type PackageList } from "../backend.js";
import { CATALOGUE } from "../canned-catalogue.js";
import { withRecords, type Plugin } from "../catalogue.js";
import { PluginsPage } from "../plugins-page.js";
import { text, type StringKey } from "../strings.js";
import { browser } from "./browser.js";

// The queue first in Yours laid out by a real browser, under the sheet's worst cases: ten rows from one press, the 61-character scoped
// name running, and the 20-字 Chinese name failed with npm's 214-character answer, which its row does not say. Nothing leaves its row or
// the window, and a row with retry and × keeps one row's height. With QUEUE_SHOTS set to a directory, each state is pictured there too.
const read = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");

const LONG = "@seller-tools-community/amazon-listing-keyword-optimizer-2026";
const CHINESE = "亚马逊广告关键词竞价与否定词批量整理助手";
const NPM_SAID = "npm error code E404 npm error 404 Not Found - GET https://registry.npmjs.org/@seller-tools-community%2famazon-ads-negative-keyword-batch-organizer - Not found npm error 404 The requested resource could not be found";
const NAMES = ["Listing writer", "Product PDF", "Keyword planner", "Review digest", "Ad spend watch", "Inventory planner", "A+ content writer", "Price tracker", "Return reasons", "Coupon planner", LONG, CHINESE];
const made = (name: string, at: number): Plugin => ({ id: `q${at}`, name, author: "ComChatX", section: "extensions", about: { en: "An invented plugin for the layout.", zh: "为排版虚构的插件。" }, builds: [], box: { package: `q${at}`, source: `npm:q${at}`, skills: [] } } as unknown as Plugin);
const PLUGINS = NAMES.map(made);
const catalogue = withRecords(CATALOGUE, { plugins: PLUGINS });
const source = (name: string): string => `npm:q${NAMES.indexOf(name)}`;
const click = (name: string, op: Click["op"] = "install"): Click => ({ id: `${NAMES.indexOf(name)}`.padStart(16, "0"), op, source: source(name) });
const failed = (name: string, op: Click["op"] = "install"): ClickEnd => ({ op, source: source(name), ok: false, reason: "pi_failed", detail: NPM_SAID, at: 1 });
const installed: readonly Package[] = [{ name: "q7", version: "0.1.0", source: source("Price tracker"), enabled: true } as Package];

/** The states pictured and laid out: what the platform's list says, and whether cx is answering. */
const STATES: Readonly<Record<string, { readonly list: Omit<PackageList, "packages" | "onImage">; readonly answering?: boolean; readonly route?: "discover" | "record" }>> = {
  asleep: { list: { asleep: true, waiting: [click("Listing writer"), click("Keyword planner"), click("Price tracker", "update")], ends: [] } },
  awake: { list: { asleep: false, waiting: [click("Listing writer"), click("Keyword planner"), click("Price tracker", "update")], ends: [] } },
  answering: { list: { asleep: false, waiting: [click("Keyword planner")], ends: [] }, answering: true },
  failed: { list: { asleep: false, waiting: [], ends: [failed("Keyword planner")] } },
  many: { list: { asleep: false, waiting: NAMES.slice(0, 10).map((name) => click(name)), ends: [] } },
  long: { list: { asleep: false, waiting: [click(LONG), click("Price tracker", "update")], ends: [failed(CHINESE)] } },
  discover: { list: { asleep: true, waiting: [click(LONG), click(CHINESE), click("Keyword planner")], ends: [] }, route: "discover" },
  record: { list: { asleep: true, waiting: [click("Keyword planner")], ends: [] }, route: "record" },
};

let chrome: Awaited<ReturnType<typeof browser>>;
const scratch = mkdtempSync(join(tmpdir(), "cmx-plugins-queue-"));
const shots = process.env["QUEUE_SHOTS"];
beforeAll(async () => { chrome = await browser(); if (shots !== undefined) mkdirSync(shots, { recursive: true }); });
afterAll(async () => { await chrome.close(); rmSync(scratch, { recursive: true, force: true }); });

/** The Plugins page over the state's list, as markup, at Yours, Discover's extensions or Keyword planner's own page. */
async function drawn(language: "en" | "zh", state: string): Promise<string> {
  const { list, answering, route } = STATES[state]!;
  const read: PackageList = { packages: installed, onImage: [], ...list };
  const backend = {
    features: FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" },
    catalogue: async () => catalogue, packages: async (): Promise<PackageList> => read,
    sources: async () => [], models: async () => undefined, accounts: async () => [], providers: async () => [], modelPlugins: async () => [], series: async () => ({}), chatOffer: async () => undefined,
    readme: async () => undefined, now: () => Date.UTC(2026, 10, 10), npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-11-10T00:00:00Z" }),
  } as unknown as Backend;
  const say = (key: StringKey, values?: Record<string, string | number>): string => text(language, key, values);
  const page = new PluginsPage({ backend, language: () => language, say: (key, values) => say(key as StringKey, values), me: () => ({ kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } }) as Extract<Me, { kind: "signed_in" }>,
    ask: () => undefined, announce: () => undefined, changed: async () => undefined, answering: () => answering === true, power: () => (list.asleep === true ? "off" : "on") });
  document.body.append(page.element);
  location.hash = route === "discover" ? "#/plugins/discover/plugins/extensions" : route === "record" ? "#/plugins/p/q2" : "#/plugins/yours/all";
  await page.load();
  page.show(route === "discover" ? { kind: "home", view: "discover", filter: "plugins", shelf: "extensions" } : route === "record" ? { kind: "plugin", id: "q2" } : { kind: "home", view: "yours", filter: "all" });
  for (let n = 0; n < 20; n++) await Promise.resolve();
  const html = page.element.outerHTML;
  page.leave();
  document.body.replaceChildren();
  return html;
}

type Laid = { readonly document: readonly number[]; readonly rows: number; readonly count: string; readonly out: readonly string[]; readonly under: readonly boolean[]; readonly said: boolean; readonly corners: readonly (readonly number[])[] };

for (const language of ["zh", "en"] as const) for (const state of Object.keys(STATES)) {
  for (const [width, height] of [[320, 760], [360, 760], [1280, 800]] as const) {
    it(`lays the queue out inside ${width} px, nothing leaving its row or the window: ${state}, ${language}`, async () => {
      const file = join(scratch, `${state}-${language}-${width}.html`);
      writeFileSync(file, `<!doctype html><html lang="${language === "zh" ? "zh-Hans" : "en"}" data-theme="light"><head><meta charset="utf-8"><style>${read("src/web/site/theme.css")}\n${read("src/web/site/pay.css")}\n${read("src/web/site/app.css")}\n${read("src/web/site/forms.css")}</style></head><body><main class="main">${await drawn(language, state)}</main></body></html>`);
      await chrome.open(file, width, height);
      const laid = await chrome.evaluate<Laid>(`(() => {
        const doc = document.scrollingElement;
        const rows = [...document.querySelectorAll(".pl-queue li")];
        const inside = (one, box) => { const at = one.getBoundingClientRect(); return at.left >= box.left - 0.5 && at.right <= box.right + 0.5; };
        // What leaves its row: the row past its list, its end or its words past the row, or an end wider than the box that holds it.
        const out = rows.flatMap((li) => {
          const box = li.getBoundingClientRect();
          const name = li.querySelector(".pl-row-name strong").textContent;
          const parts = [li.querySelector(".pl-row-end"), li.querySelector(".pl-row-name"), li.querySelector(".pl-row-text > :last-child")];
          const over = [...li.querySelectorAll(".pl-row-end")].filter((one) => one.scrollWidth > one.clientWidth + 1);
          return [...(inside(li, li.closest("ul").getBoundingClientRect()) ? [] : [name + ": row"]), ...parts.filter((one) => !inside(one, box)).map((one) => name + ": " + one.className), ...over.map((one) => name + ": over " + one.className)];
        });
        const under = rows.map((li) => li.querySelector(".pl-row-end").getBoundingClientRect().top >= li.querySelector(".pl-row").getBoundingClientRect().bottom - 1);
        const said = rows.some((li) => li.textContent.includes("E404"));
        // Discover's and a record's still ring: in its card's corner, inside the card.
        const corners = [...document.querySelectorAll(".pl-queued")].map((one) => { const at = one.getBoundingClientRect(), card = (one.closest(".pl-card") ?? one.closest(".pl-head")).getBoundingClientRect(); return [at.left - card.left, card.right - at.right, at.width]; });
        return { document: [doc.scrollWidth, doc.clientWidth], rows: rows.length, count: document.querySelector(".pl-queue h2 .count")?.textContent ?? "", out, under, said, corners };
      })()`);
      if (shots !== undefined && language === "zh" && width !== 320) await chrome.shot(join(shots, `queue-${state}-${language}-${width}.png`));
      expect(laid.document[0]).toBe(laid.document[1]);
      expect(laid.out).toEqual([]);
      const rows = STATES[state]!.route !== undefined ? 0 : (STATES[state]!.list.waiting?.length ?? 0) + (STATES[state]!.list.ends?.length ?? 0);
      expect([laid.rows, laid.count]).toEqual([rows, rows === 0 ? "" : String(rows)]);
      // Retry and × stand at the row's end at every width, and the row says no reason.
      expect(laid.under.filter(Boolean)).toEqual([]);
      expect(laid.said).toBe(false);
      for (const [left, right, size] of laid.corners) { expect(left).toBeGreaterThan(0); expect(right).toBeGreaterThanOrEqual(0); expect(size).toBeGreaterThan(0); }
      if (STATES[state]!.route !== undefined) expect(laid.corners.length).toBe(state === "discover" ? 3 : 1);
    });
  }
}
