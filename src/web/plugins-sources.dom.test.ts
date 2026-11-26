// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { EVERYTHING, FIRST_RELEASE, type Backend, type Features, type Me, type NpmPackage, type Package, type Source } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { ourRecord, type Catalogue } from "./catalogue.js";
import { PlatformBackend } from "./platform-backend.js";
import { PluginsPage } from "./plugins-page.js";
import { clickStub } from "./plugins-test-kit.js";
import { text, type StringKey } from "./strings.js";

const signedIn = { kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } } as unknown as Extract<Me, { kind: "signed_in" }>;
const SEPTEMBER = Date.UTC(2026, 8, 1);

/** A platform that lists Keepa as a source and answers every read and write its page makes, holding what was saved as a platform would. */
function world(over: { features?: Features; catalogue?: Catalogue; source?: Partial<Source>; language?: "en" | "zh"; gone?: boolean; held?: string; npm?: (name: string, version?: string) => Promise<NpmPackage> } = {}) {
  const calls: string[] = [];
  /** The writes that are refused, by name; a test adds and removes them as it goes. */
  const fails = new Set<string>();
  let held = over.source?.ownKey?.held === true;
  // Held, a read of the sources answers what they were when it was asked, once the test lets it.
  let holding = false;
  const gates: PromiseWithResolvers<void>[] = [];
  const record = (name: string, then?: (...args: unknown[]) => void) => vi.fn(async (...args: unknown[]) => {
    calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(",")})`);
    if (fails.has(name)) throw new Error("refused");
    then?.(...args);
  });
  const keepa = (): Source => ({
    name: "keepa", supplier: "Keepa", nativeUnit: "tokens", unitsPerNative: 1, enabled: true, spent: 0,
    aspects: [{ aspect: "amazon/us/<asin>/product", native: 14 }], rawBound: 50, freshness: { "amazon/us/<asin>/product": "1h" },
    month: { since: SEPTEMBER, spent: 11_760 }, ...over.source, ...("ownKey" in (over.source ?? {}) && over.source?.ownKey === undefined ? {} : { ownKey: { held } }),
  }) as unknown as Source;
  const catalogue = over.catalogue ?? CATALOGUE;
  // cx's computer holds Keepa at the version its record was read at, unless the test says another.
  const version = over.held ?? catalogue.plugins.find((one) => one.id === "keepa")?.version ?? "0.1.0";
  const box = clickStub(over.gone === true ? [] : [{ name: "keepa", version, source: "npm:cx-keepa" } as Package]);
  const click = (name: "installPackage" | "setPackage") => { const said = record(name); return async (source: string, on: boolean) => { await said(source, on); return box[name](source, on); }; };
  const backend = {
    features: over.features ?? EVERYTHING, links: { signIn: "#in", account: "#account", help: "#help" }, readme: async () => undefined,
    series: async () => ({}), catalogue: async () => catalogue, npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-10-17T00:00:00.000Z" }), npmPackage: over.npm ?? (async () => { throw new Error("unknown_package"); }), packages: box.packages, sources: async () => { const asked = [keepa()]; if (holding) { const gate = Promise.withResolvers<void>(); gates.push(gate); await gate.promise; } return asked; },
    modelPlugins: async () => [], models: async () => ({ current: undefined, available: [] }), providers: async () => [], accounts: async () => [],
    // The clock stands in another month than the source's own, so a month's name can only come from the source's month.
    now: () => Date.parse("2026-10-02"),
    saveSourceKey: record("saveSourceKey", () => { held = true; }), removeSourceKey: record("removeSourceKey", () => { held = false; }),
    installPackage: click("installPackage"), setPackage: click("setPackage"),
  } as unknown as Backend;
  const view = new PluginsPage({ say: (key, values) => text(over.language ?? "en", key as StringKey, values), language: () => over.language ?? "en", backend, me: () => signedIn, ask: vi.fn(), announce: vi.fn(), changed: async () => {} });
  document.body.append(view.element);
  return { view, backend, calls, fails, hold: () => { holding = true; }, gates };
}
const settle = async (): Promise<void> => { for (let n = 0; n < 4; n += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };
async function opened(view: PluginsPage, tab?: string): Promise<void> {
  await view.load();
  view.show({ kind: "plugin", id: "keepa", ...(tab === undefined ? {} : { tab }) } as never);
  await settle();
}
const all = (root: ParentNode, selector: string): readonly Element[] => [...root.querySelectorAll(selector)];
const words = (root: ParentNode, selector: string): readonly string[] => all(root, selector).map((one) => one.textContent ?? "");
const body = (view: PluginsPage): Element => view.element.querySelector(".pl-tabbody")!;
const headings = (view: PluginsPage): readonly string[] => words(body(view), "section > h2");
const press = async (control: Element | null | undefined): Promise<void> => { (control as HTMLElement).focus(); (control as HTMLElement).click(); await settle(); };
const type = (view: PluginsPage, selector: string, value: string): void => { view.element.querySelector<HTMLInputElement>(selector)!.value = value; };

afterEach(() => { document.body.replaceChildren(); location.hash = ""; });

it("keeps a source's key saved when a read begun before the save lands after the read the save starts", async () => {
  const { view, calls, hold, gates } = world();
  await opened(view, "settings");
  const pay = (): Element => all(body(view), "section").at(-1)!;
  type(view, "input.pl-key", "k-1");
  hold();
  const stale = view.load();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await press(pay().querySelector("button.primary"));
  expect(calls).toEqual(['saveSourceKey("keepa","k-1")']);
  expect(gates.length).toBeGreaterThanOrEqual(2);
  // The key's row says the key is saved, its field gone, once the save's read lands, and still once the read begun before it lands.
  const keyRow = (): readonly unknown[] => [pay().querySelector("input.pl-key") === null, words(pay(), "[data-focus='way-key']"), words(pay(), "[data-focus='way-platform']")];
  for (const gate of gates.slice(1)) gate.resolve();
  await settle();
  expect(keyRow()).toEqual([true, ["Key saved."], ["Use"]]);
  gates[0]!.resolve();
  await stale;
  await settle();
  expect(keyRow()).toEqual([true, ["Key saved."], ["Use"]]);
});

it("keeps a source's Settings whole once it is not installed, with what was saved for it, and draws them at the first release too", async () => {
  const { view } = world({ gone: true, source: { enabled: false, ownKey: { held: true } } });
  await opened(view, "settings");
  expect(words(view.element, ".pl-tabs .pl-tab")).toEqual(["Overview", "Plugins it uses · 3", "Settings"]);
  expect(headings(view)).toEqual(["How it is paid"]);
  expect(words(body(view), ".pl-way-act > *")).toContain("Key saved.");
  const first = world({ features: FIRST_RELEASE });
  await opened(first.view);
  expect(words(first.view.element, ".pl-tabs .pl-tab")).toEqual(["Overview", "Plugins it uses · 3", "Settings"]);
});

it("draws a source's Settings as who pays, a ruled section, and offers neither a limit on its spending nor how old its data may be", async () => {
  const { view } = world();
  await opened(view, "settings");
  expect([...body(view).children].map((part) => `${part.tagName}.${part.className}`)).toEqual(["SECTION.pl-setting"]);
  expect(headings(view)).toEqual(["How it is paid"]);
  expect(all(body(view), "input, select").map((one) => one.className)).toEqual(["pl-key"]);
  const zh = world({ language: "zh" });
  await opened(zh.view, "settings");
  expect(headings(zh.view)).toEqual(["付费方式"]);
});

it("pays a source from the balance or with the person's own key, one at a time: Save takes the key, Key saved. stands by Remove key, and Use goes back", async () => {
  const { view, calls } = world();
  await opened(view, "settings");
  const pay = (): Element => all(body(view), "section").at(-1)!;
  const rows = (): readonly (readonly string[])[] => all(pay(), "ul.pl-list.pl-way-list > li > div.pl-row.pl-way-row").map((row) => [row.querySelector(".pl-row-text strong")!.textContent!, row.querySelector(".pl-row-text .quiet")!.textContent!, ...[...row.querySelector(".pl-way-act")!.children].map((one) => `${one.tagName}${one.className === "" ? "" : `.${one.className.replace(/ /g, ".")}`}:${one.textContent}`)]);
  // The rows say which pays; no line above them says it again.
  expect(pay().querySelector(":scope > p")).toBeNull();
  expect(rows()).toEqual([
    ["Balance", "Paid from your balance at $1/1,000,000 tokens."],
    ["API key", "Keepa bills your own account; ComChatX charges nothing.", "INPUT.pl-key:", "BUTTON.primary:Save", "P.quiet.pl-field-note:"],
  ]);
  const field = pay().querySelector<HTMLInputElement>("input.pl-key")!;
  expect([field.type, field.placeholder, field.getAttribute("aria-label")]).toEqual(["password", "Paste your Keepa API key", "Paste your Keepa API key"]);
  await press(pay().querySelector("button.primary"));
  expect(calls).toEqual([]);
  expect(pay().querySelector(".pl-field-note")!.textContent).toBe("Paste a key first.");
  type(view, "input.pl-key", " k-1 ");
  await press(pay().querySelector("button.primary"));
  expect(calls).toEqual(['saveSourceKey("keepa","k-1")']);
  expect(pay().querySelector(":scope > p")).toBeNull();
  expect(rows()).toEqual([
    ["Balance", "Paid from your balance at $1/1,000,000 tokens.", "BUTTON:Use"],
    ["API key", "Keepa bills your own account; ComChatX charges nothing.", "SPAN.quiet:Key saved.", "BUTTON:Remove key"],
  ]);
  // The rows say what was saved: no other word is said.
  expect(view.element.querySelector(".pl-said")).toBeNull();
  expect(headings(view)).toEqual(["How it is paid"]);
  // The keyboard Save had is on the word that the key is saved, which takes no press: the same key pressed twice removes nothing.
  expect([document.activeElement?.tagName, document.activeElement?.textContent, document.activeElement?.getAttribute("tabindex")]).toEqual(["SPAN", "Key saved.", "-1"]);
  (document.activeElement as HTMLElement).click();
  await settle();
  expect(calls).toEqual(['saveSourceKey("keepa","k-1")']);
  expect(all(pay(), "[data-focus]").map((one) => `${one.textContent}:${one.getAttribute("data-focus")}`)).toEqual(["Use:way-platform", "Key saved.:way-key", "Remove key:way-forget"]);
  await press(all(pay(), "button").find((one) => one.textContent === "Use"));
  expect(calls.at(-1)).toBe('removeSourceKey("keepa")');
  // Use went with the key: the keyboard is on the key's row, where one can be saved again.
  expect(document.activeElement).toBe(pay().querySelector("button.primary"));
  expect(document.activeElement?.textContent).toBe("Save");
  type(view, "input.pl-key", "k-2");
  await press(pay().querySelector("button.primary"));
  await press(all(pay(), "button").find((one) => one.textContent === "Remove key"));
  expect([calls.at(-1), document.activeElement?.textContent]).toEqual(['removeSourceKey("keepa")', "Save"]);
  expect(headings(view)).toEqual(["How it is paid"]);
  expect(rows()[0]).toEqual(["Balance", "Paid from your balance at $1/1,000,000 tokens."]);
  const zh = world({ source: { ownKey: { held: true } }, language: "zh" });
  await opened(zh.view, "settings");
  expect(words(all(body(zh.view), "section").at(-1)!, ".pl-way-act > *")).toEqual(["使用", "API Key 已保存。", "移除 API Key"]);
});

it("leaves a key that could not be saved, and one that could not be removed, as a line that stays with the keyboard on the control pressed", async () => {
  const { view, fails } = world();
  await opened(view, "settings");
  fails.add("saveSourceKey");
  type(view, "input.pl-key", "k-1");
  await press(body(view).querySelector(".pl-way-act button.primary"));
  expect(view.element.querySelector(".pl-said")!.textContent).toBe("Not saved. Try again.");
  expect(document.activeElement?.textContent).toBe("Save");
  const keyed = world({ source: { ownKey: { held: true } } });
  await opened(keyed.view, "settings");
  keyed.fails.add("removeSourceKey");
  await press(all(body(keyed.view), ".pl-way-act button").find((one) => one.textContent === "Use"));
  expect(keyed.view.element.querySelector(".pl-said")!.textContent).toBe("Not saved. Try again.");
  expect(document.activeElement?.textContent).toBe("Use");
});

it("offers no key row on a source that takes none", async () => {
  const { view } = world({ source: { ownKey: undefined } as unknown as Partial<Source> });
  await opened(view, "settings");
  expect(words(all(body(view), "section").at(-1)!, ".pl-row-text strong")).toEqual(["Balance"]);
});

it("says a source's Pricing as what a dollar buys of a product, in each language, with no table of the source's own unit", async () => {
  const en = world();
  await opened(en.view);
  expect([en.view.element.querySelector(".pl-table"), en.view.element.textContent!.includes(" buys about ")]).toEqual([null, true]);
  const zh = world({ language: "zh" });
  await opened(zh.view);
  expect(zh.view.element.querySelector(".pl-table")).toBeNull();
  expect(zh.view.element.textContent).toMatch(/大约可以查 [\d,]+ 个商品的数据。/);
});

it("draws a source's README as its Overview, and the own-key sentence in the side card's How you pay only where its Settings draws the key's row", async () => {
  // The README's words, and How you pay's own-key sentence.
  const said = (page: PluginsPage): readonly [string, readonly string[]] => {
    const section = page.element.querySelector(".pl-main")!;
    return [section.querySelector(".pl-readme")!.textContent!.trim(), words(page.element, ".pl-side .pl-own-key")];
  };
  const keyed = world();
  await opened(keyed.view);
  expect(said(keyed.view)).toEqual([expect.stringMatching(/^cx tells you when your products and rivals/), ["Usage is billed to your balance. You can also use your own Keepa API Key."]]);
  const zh = world({ language: "zh" });
  await opened(zh.view);
  // The pinned version ships its README in Chinese too, which stands as the Overview in Chinese.
  expect(said(zh.view)).toEqual([expect.stringMatching(/^竞品和你的商品哪天调价/), ["按用量从余额扣费，也可以使用你自己的 Keepa API Key。"]]);
  // A source that takes no key has no row, and no sentence; the first release draws both.
  const platform = world({ source: { ownKey: undefined } as unknown as Partial<Source> });
  await opened(platform.view);
  expect(said(platform.view)[1]).toEqual([]);
  const first = world({ features: FIRST_RELEASE });
  await opened(first.view);
  expect(said(first.view)[1]).toEqual(["Usage is billed to your balance. You can also use your own Keepa API Key."]);
});

describe("a package's Overview, from the README its files hold", () => {
  const BASE = "https://cdn.jsdelivr.net/npm/cx-keepa@0.1.5/";
  const withReadme = (box: Record<string, unknown>) => ({ ...CATALOGUE, plugins: CATALOGUE.plugins.map((one) => (one.id === "keepa" ? { ...one, home: "https://github.com/comchatx/cx-keepa", box: { ...one.box!, readme: undefined, unread: undefined, ...box } } : one)) });
  const overview = async (language: "en" | "zh", box: Record<string, unknown>) => {
    const { view } = world({ language, features: FIRST_RELEASE, catalogue: withReadme(box) as never });
    await opened(view);
    const section = view.element.querySelector(".pl-main")!;
    const side = [...view.element.querySelectorAll(".pl-page-links a")].map((one) => one.getAttribute("href"));
    return { section, readme: section.querySelector(".pl-readme")?.textContent?.trim(), lines: words(section, ":scope > p"), links: [...section.querySelectorAll(":scope > p a")].map((one) => one.getAttribute("href")), side };
  };
  const both = { en: "In English.", zh: "用中文。", base: BASE };

  it.each(["en", "zh"] as const)("draws, in %s, its README in the page's language, the README in English under the Chinese line where it ships that alone, and its line and source without one", async (language) => {
    const line = CATALOGUE.plugins.find((one) => one.id === "keepa")!.about[language];
    expect(await overview(language, { readme: both })).toMatchObject({ readme: language === "en" ? "In English." : "用中文。", lines: [], links: [] });
    expect(await overview(language, { readme: { en: both.en, base: BASE } })).toMatchObject({ readme: "In English.", lines: language === "en" ? [] : [line], links: [] });
    // With no README at that version, its line, and its source in the side's Links alone, one way out to one place; with its README
    // unread, a word that says so under the line.
    expect(await overview(language, {})).toMatchObject({ readme: undefined, lines: [line], links: [] });
    expect((await overview(language, {})).side).toContain("https://github.com/comchatx/cx-keepa");
    expect(await overview(language, { unread: ["readme"] })).toMatchObject({ readme: undefined, lines: [line, text(language, "pl.pkg.readmeUnread")] });
  });

  it("draws its source under its line, as the side card's links draw theirs, where those link another address", async () => {
    const catalogue = withReadme({});
    const mirrored = { ...catalogue, plugins: catalogue.plugins.map((one) => (one.id === "keepa" ? { ...one, onNpm: { name: "cx-keepa", kinds: [], repository: "https://gitlab.com/comchatx/keepa-mirror" } } : one)) };
    const { view } = world({ language: "en", features: FIRST_RELEASE, catalogue: mirrored as never });
    await opened(view);
    const link = (one: Element): readonly unknown[] => [one.className, one.getAttribute("href"), one.getAttribute("target"), one.getAttribute("rel"), one.querySelector("svg") !== null, one.querySelector(".pl-sr")?.textContent];
    const fallback = [...view.element.querySelectorAll(".pl-main > p a")];
    const side = [...view.element.querySelectorAll(".pl-page-links a")].find((one) => one.getAttribute("href") === "https://gitlab.com/comchatx/keepa-mirror");
    expect([fallback.map((one) => one.getAttribute("href")), fallback[0]?.querySelector(".pl-word")?.textContent]).toEqual([["https://github.com/comchatx/cx-keepa"], "View source"]);
    expect(link(fallback[0]!).slice(0, 5)).toEqual([...link(side!).slice(0, 2).map((one, at) => (at === 1 ? "https://github.com/comchatx/cx-keepa" : one)), ...link(side!).slice(2, 5)]);
  });

  it("draws, on the Chinese page, an English README alone for a package of ours whose field declared no Chinese line", async () => {
    const { declaredZh: _declared, ...keepa } = CATALOGUE.plugins.find((one) => one.id === "keepa")!;
    const catalogue = { ...CATALOGUE, plugins: CATALOGUE.plugins.map((one) => (one.id === "keepa" ? { ...keepa, box: { ...keepa.box!, readme: { en: both.en, base: BASE }, unread: undefined } } : one)) };
    const { view } = world({ language: "zh", features: FIRST_RELEASE, catalogue: catalogue as never });
    await opened(view);
    const section = view.element.querySelector(".pl-main")!;
    expect([section.firstElementChild?.classList.contains("pl-readme"), section.querySelector(".pl-readme")?.textContent?.trim(), words(section, ":scope > p")]).toEqual([true, "In English.", []]);
  });

  it.each(["en", "zh"] as const)("draws, in %s, a link to a package's page on npm as that package's page here, in place, in a README of either language, and every other link as a link out", async (language) => {
    // Each README in its own words; the links are the same in both.
    const links = "[pi-subagents](https://www.npmjs.com/package/pi-subagents), [cx-board](https://npmjs.com/package/@comchatx/cx-board/), [a](https://www.npmjs.com/package/@_review/plugin), [b](https://www.npmjs.com/package/@-review/plugin), [c](https://www.npmjs.com/package/@scope/_plugin), [d](https://www.npmjs.com/package/@scope/-plugin), [a version](https://www.npmjs.com/package/pi-subagents/v/0.85.0), [its code](https://www.npmjs.com/package/pi-subagents?activeTab=code), [the list](https://www.npmjs.com/package/), [a name npm refuses](https://www.npmjs.com/package/node_modules) and [the web](https://keepa.com)";
    const written = { en: `# Keepa\n\nWorks with ${links}.`, zh: `# Keepa\n\n可以和这些一起用：${links}。` };
    const outside = text(language, "pl.third.outside");
    const here = (name: string) => [`#/plugins/n/${encodeURIComponent(name)}`, null, undefined];
    const out = (address: string) => [address, "_blank", outside];
    for (const lang of ["en", "zh"] as const) {
      const { section } = await overview(language, { readme: { [lang]: written[lang], base: BASE } });
      expect(section.querySelector(".pl-readme")!.textContent).toContain(lang === "en" ? "Works with" : "可以和这些一起用");
      expect([...section.querySelectorAll(".pl-readme a")].map((one) => [one.getAttribute("href"), one.getAttribute("target"), one.querySelector(".pl-sr")?.textContent])).toEqual([
        here("pi-subagents"), here("@comchatx/cx-board"), here("@_review/plugin"), here("@-review/plugin"), here("@scope/_plugin"), here("@scope/-plugin"),
        out("https://www.npmjs.com/package/pi-subagents/v/0.85.0"), out("https://www.npmjs.com/package/pi-subagents?activeTab=code"), out("https://www.npmjs.com/package/"),
        out("https://www.npmjs.com/package/node_modules"), out("https://keepa.com"),
      ]);
    }
  });

  it("draws a README's pictures its CDN serves and resolves what it writes against its files there, as pi.dev does, leaving out a picture from anywhere else", async () => {
    const readme = { en: "# Keepa\n\n![A chart](docs/chart.png) ![badge](https://img.shields.io/badge.svg)\n\nSee [the guide](docs/guide.md), [the root](/LICENSE) and [the web](https://keepa.com).", base: BASE };
    const { section } = await overview("en", { readme });
    expect([...section.querySelectorAll(".pl-readme img")].map((one) => [one.getAttribute("src"), one.getAttribute("alt")])).toEqual([[`${BASE}docs/chart.png`, "A chart"]]);
    expect([...section.querySelectorAll(".pl-readme a")].map((one) => [one.getAttribute("href"), one.getAttribute("target")])).toEqual([[`${BASE}docs/guide.md`, "_blank"], [`${BASE}LICENSE`, "_blank"], ["https://keepa.com", "_blank"]]);
  });
});

it("draws a package of ours from npm's newest whatever version cx's computer holds: its head says the one held, its Overview the newest's README, pictures and templates, each in the newest's Chinese", async () => {
  const keepa = CATALOGUE.plugins.find((one) => one.id === "keepa")!;
  const edition = (version: string, words: string, template: string, zh: string): NpmPackage => ({
    name: "cx-keepa", description: "Keepa.", kinds: ["skill"], updated: "", version, readme: "", readme_cut: false, ours: true, uses: [],
    comchatx: { name: "Keepa", source: keepa.source, prompts: { [template]: { zh } } },
    shipped: { readme: `${words}\n\n![Edition](edition.png)`, skills: [], prompts: [{ name: template, description: `${words} Try it.` }], unread: [] },
  });
  // The record is read at npm's newest; cx's computer holds an older version, or that one.
  const latest = ourRecord(edition("2.0.0", "The newest edition.", "newest-only", "最新版的模板"), (name) => name);
  const asked: string[] = [];
  const older = async (name: string, version?: string): Promise<NpmPackage> => { asked.push(`${name}@${version}`); return edition("0.1.0", "The older edition.", "older-only", "旧版的模板"); };
  for (const held of ["0.1.0", "2.0.0"]) for (const language of ["en", "zh"] as const) {
    const { view } = world({ language, features: FIRST_RELEASE, catalogue: { plugins: [latest], bundles: [], words: {} }, held, npm: older });
    await opened(view);
    expect(view.element.querySelector(".pl-head-meta")?.textContent).toContain(held);
    expect(view.element.querySelector(".pl-readme")?.textContent).toContain("The newest edition.");
    expect(view.element.querySelector(".pl-readme img")?.getAttribute("src")).toBe("https://cdn.jsdelivr.net/npm/cx-keepa@2.0.0/edition.png");
    expect([...view.element.querySelectorAll(".pl-try")].map((one) => one.getAttribute("data-focus"))).toEqual(["try newest-only"]);
    expect(words(view.element, ".pl-try")[0]).toContain(language === "en" ? "The newest edition. Try it." : "最新版的模板");
  }
  // Nothing is read at the version held.
  expect(asked).toEqual([]);
});

it("asks again for a package of ours whose catalogue record npm answered in part, at that record's version, npm's newest, whatever version is held, through the platform's adapter, and keeps a whole read across tabs", async () => {
  const keepa = CATALOGUE.plugins.find((one) => one.id === "keepa")!;
  for (const held of ["2.0.0", "0.1.0"]) for (const between of ["load", "reopen"] as const) {
    let healthy = false;
    let now = 0;
    const asked: string[] = [];
    const edition = (version: string): NpmPackage => ({
      name: "cx-keepa", description: "Keepa.", kinds: ["skill"], updated: "", version, readme: "", readme_cut: false, ours: true, uses: [],
      comchatx: { name: "Keepa", source: keepa.source },
      shipped: healthy ? { readme: `Recovered cx-keepa@${version}.`, skills: [], prompts: [], unread: [] } : { skills: [], prompts: [], unread: ["readme", "skills", "prompts"] },
    });
    // The platform's own adapter over its routes: the catalogue's record is read at npm's newest, 2.0.0, with every part unread.
    const platform = new PlatformBackend({
      fetch: (async (input: string) => {
        const url = new URL(input, "https://platform.invalid");
        if (url.pathname === "/plugins/ours") return Response.json({ packages: [edition("2.0.0")] });
        if (url.pathname === "/plugins/bundles") return Response.json({ bundles: [] });
        if (url.pathname === "/plugins/npm/cx-keepa") { asked.push(url.searchParams.get("version") ?? "newest"); return Response.json(edition(url.searchParams.get("version") ?? "2.0.0")); }
        throw new Error(`not a route this page reads: ${input}`);
      }) as typeof globalThis.fetch,
      eventSource: () => { throw new Error("not read"); }, clientId: "web-tab", go: () => undefined,
      leaving: { set: () => undefined, take: () => false }, renewing: { set: () => undefined, take: () => undefined }, now: () => now,
    });
    const { view, backend } = world({ features: FIRST_RELEASE, catalogue: { plugins: [ourRecord(edition("2.0.0"), (name) => name)], bundles: [], words: {} }, held });
    Object.assign(backend, { catalogue: () => platform.catalogue(), npmPackage: (name: string, version?: string) => platform.npmPackage(name, version) });
    await opened(view);
    expect([held, between, view.element.textContent?.includes(text("en", "pl.pkg.readmeUnread"))]).toEqual([held, between, true]);
    healthy = true;
    // Past the gallery's five-minute keep and retry, as a seller coming back would be.
    now = 300_001;
    if (between === "load") await view.load();
    view.show({ kind: "home", view: "yours", filter: "all" } as never);
    await settle();
    for (const tab of ["overview", "skills", "overview"]) { view.show({ kind: "plugin", id: "keepa", tab } as never); await settle(); }
    // Read whole, the record is drawn from that read and asked no more, however many tabs open after.
    expect([held, between, view.element.querySelector(".pl-readme")?.textContent?.includes("Recovered cx-keepa@2.0.0."), asked]).toEqual([held, between, true, ["2.0.0", "2.0.0"]]);
  }
});
