// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { FIRST_RELEASE, type Backend, type ConnectionCheck, type GrantAccount, type Me, type Package, type Source, type SourcePair, type StoreConnection } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import type { Catalogue, Plugin } from "./catalogue.js";
import { PluginsPage } from "./plugins-page.js";
import { clickStub, scrimPresses } from "./plugins-test-kit.js";
import { text, type StringKey } from "./strings.js";
import { ADS_SOURCE_WORDS } from "./testing/source-words.js";

const signedIn = { kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } } as unknown as Extract<Me, { kind: "signed_in" }>;
const pack = (id: string): Package => { const name = CATALOGUE.plugins.find((one) => one.id === id)!.box!.package; return { name, version: "0.1.0", source: `npm:${name}` } as Package; };
const CLIENT = "amzn1.application-oa2-client.4f2a9c";
const OTHER = "amzn1.application-oa2-client.77b1e0";
const BRAND: readonly GrantAccount[] = [{ country: "US", profile: "4100", name: "Example Brand", region: "na" }, { country: "CA", profile: "4101", name: "Example Brand", region: "na" }, { country: "JP", profile: "4102", name: "Example Brand", region: "fe" }];
const OUTDOOR: readonly GrantAccount[] = [{ country: "US", profile: "4200", name: "Example Outdoor", region: "na" }];

/** The catalogue with Amazon Ads' record as its package at 0.1.5 declares its source, or as one that declares no words of its own. */
const withWords = (words: boolean): Catalogue => ({
  ...CATALOGUE,
  plugins: CATALOGUE.plugins.map((plugin): Plugin => (plugin.id !== "amazon-ads" ? plugin : { ...plugin, source: words ? (ADS_SOURCE_WORDS as unknown as NonNullable<Plugin["source"]>) : { name: "amazon-ads", help: ADS_SOURCE_WORDS.help, aspects: {} } })),
});

/** The catalogue with Amazon Ads' record selling the source by another name, as a second paired source would. */
const named = (catalogue: Catalogue, name: string): Catalogue => (name === "amazon-ads" ? catalogue : {
  ...catalogue, plugins: catalogue.plugins.map((plugin): Plugin => (plugin.id !== "amazon-ads" ? plugin : { ...plugin, source: { ...plugin.source!, name } })),
});

/**
 * A platform that lists Amazon Ads as the gate lists a paired source of grants, and keeps what is saved as the gate and the platform keep
 * it: its pairs, by the names the platform makes, each with its Client identifier, and its grants under them, each with what Amazon's last
 * check listed. A pair added with its first grant is kept only where the check passes; a pair's last grant takes the pair with it. Amazon's
 * answer and what it lists are the test's to give.
 */
function world(over: { pairs?: readonly SourcePair[]; rows?: readonly StoreConnection[]; installed?: boolean; language?: "en" | "zh"; words?: boolean; removing?: Promise<void>; removal?: "fails"; name?: string; paired?: false; secret?: readonly string[] | null } = {}) {
  const calls: string[] = [];
  let pairs = [...(over.pairs ?? [])];
  let rows = [...(over.rows ?? [])];
  let made = 0;
  let answer: () => Promise<ConnectionCheck> = async () => ({ ok: true });
  let listing: readonly GrantAccount[] = BRAND;
  const record = <A extends unknown[], R>(name: string, then: (...args: A) => R) => vi.fn(async (...args: A): Promise<Awaited<R>> => {
    calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(",")})`);
    return await then(...args);
  });
  const pairOf = (one: StoreConnection): string => one.pair ?? "first";
  const name = over.name ?? "amazon-ads";
  const ads = (): Source => ({
    name, supplier: "Amazon-Ads", nativeUnit: "requests", aspects: [], enabled: rows.length > 0, spent: 0, month: { since: Date.parse("2026-10-01"), spent: 0 },
    fields: { client_id: pairs.length > 0, client_secret: pairs.length > 0 }, connections: [...rows], regions: ["na", "eu", "fe"], grants: true,
    connectionFields: [{ name: "refresh_token", secret: true }],
    ...(over.paired === false ? {} : { paired: true, pairs: [...pairs] }), ...(over.secret === null ? {} : { secretFields: [...(over.secret ?? ["client_secret"])] }),
  }) as unknown as Source;
  const connect = async (pair: string, fresh: boolean, fields: Readonly<Record<string, string>>): Promise<ConnectionCheck> => {
    made += 1;
    const store = `c-${String(made).padStart(8, "0")}`;
    if (fresh) pairs = [...pairs, { name: pair, fields: { client_id: fields["client_id"]! } }];
    rows = [...rows, { store, ...(pair === "first" ? {} : { pair }) }];
    const check = await answer();
    if (!check.ok) { rows = rows.filter((one) => one.store !== store); if (fresh) pairs = pairs.filter((one) => one.name !== pair); return check; }
    rows = rows.map((one) => (one.store === store ? { ...one, accounts: [...listing] } : one));
    return { ...check, connection: store };
  };
  const box = clickStub([pack("cx-sources"), ...(over.installed === false ? [] : [pack("amazon-ads")])]);
  const backend = {
    features: FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" }, readme: async () => undefined,
    series: async () => ({}), catalogue: async () => named(withWords(over.words !== false), name), npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-10-17T00:00:00.000Z" }), npmPackage: async () => { throw new Error("unknown_package"); },
    packages: box.packages, sources: async () => [ads()],
    modelPlugins: async () => [], models: async () => ({ current: undefined, available: [] }), providers: async () => [], accounts: async () => [],
    now: () => Date.parse("2026-10-02"),
    addPair: record("addPair", (_: string, sent: { readonly fields: Readonly<Record<string, string>> }) => connect(pairs.length === 0 ? "first" : `p-${String(made + 1).padStart(8, "0")}`, true, sent.fields)),
    connectUnder: record("connectUnder", (_: string, pair: string) => connect(pair, false, {})),
    removeConnection: record("removeConnection", (_: string, store: string) => {
      if (over.removal === "fails") throw new Error("/sources answered 503");
      const pair = rows.find((one) => one.store === store);
      rows = rows.filter((one) => one.store !== store);
      if (pair !== undefined && !rows.some((one) => pairOf(one) === pairOf(pair))) pairs = pairs.filter((one) => one.name !== pairOf(pair));
    }),
    removePair: record("removePair", async (_: string, pair: string) => { await over.removing; if (over.removal === "fails") throw new Error("/sources answered 503"); rows = rows.filter((one) => pairOf(one) !== pair); pairs = pairs.filter((one) => one.name !== pair); }),
    removeSourceKey: async () => undefined, saveSourceKey: async () => undefined,
    installPackage: box.installPackage, setPackage: box.setPackage,
  } as unknown as Backend;
  const fresh = (): PluginsPage => {
    const page = new PluginsPage({ say: (key, values) => text(over.language ?? "en", key as StringKey, values), language: () => over.language ?? "en", backend, me: () => signedIn, ask: vi.fn(), announce: vi.fn(), changed: async () => {} });
    document.body.append(page.element);
    return page;
  };
  return { view: fresh(), calls, answers: (next: typeof answer) => { answer = next; }, lists: (next: readonly GrantAccount[]) => { listing = next; } };
}
const settle = async (): Promise<void> => { for (let n = 0; n < 6; n += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };
async function opened(view: PluginsPage): Promise<void> {
  await view.load();
  view.show({ kind: "plugin", id: "amazon-ads", tab: "settings" } as never);
  await settle();
}
const all = (root: ParentNode, selector: string): readonly Element[] => [...root.querySelectorAll(selector)];
const words = (root: ParentNode, selector: string): readonly string[] => all(root, selector).map((one) => one.textContent ?? "");
const body = (view: PluginsPage): Element => view.element.querySelector(".pl-tabbody")!;
const at = (view: PluginsPage, place: string): HTMLElement | undefined => all(view.element, "[data-focus]").find((one) => one.getAttribute("data-focus") === place) as HTMLElement | undefined;
const focused = (): string | null | undefined => document.activeElement?.getAttribute("data-focus");
const press = async (control: Element | null | undefined): Promise<void> => { (control as HTMLElement).focus(); (control as HTMLElement).click(); await settle(); };
const type = (view: PluginsPage, place: string, value: string): void => { const input = at(view, place) as HTMLInputElement; input.value = value; input.dispatchEvent(new Event("input")); };
const toast = (view: PluginsPage): string => view.element.querySelector(".pl-toast")?.textContent ?? "";
const fill = (view: PluginsPage, values: Readonly<Record<string, string>>): void => { for (const [key, value] of Object.entries(values)) type(view, `sp-${key}`, value); };
const rows = (view: PluginsPage): readonly string[] => words(body(view), ".pl-way-row .pl-row-text");
const heads = (view: PluginsPage): readonly string[] => words(body(view), ".pl-pair > h3");

afterEach(() => { document.body.replaceChildren(); location.hash = ""; });

const one = { pairs: [{ name: "first", fields: { client_id: CLIENT } }], rows: [{ store: "c-brand", accounts: BRAND }, { store: "c-outdoor", accounts: OUTDOOR }] } as const;

it("connects a paired source's first grant from the form alone, named in its package's words, with no name asked: its pair and token in one request, then its Client identifier over the row", async () => {
  for (const language of ["en", "zh"] as const) {
    const { view, calls } = world({ language });
    await opened(view);
    const say = (key: StringKey): string => text(language, key);
    expect([words(body(view), "section > h2"), body(view).querySelector("section > p")!.textContent, words(body(view), ".pl-field > span"), at(view, "sp-cancel"), at(view, "sp-store")]).toEqual(
      [[ADS_SOURCE_WORDS.lines.connect[language]], ADS_SOURCE_WORDS.lines.canChange[language], ["Client identifier", "Client secret", "Refresh token"], undefined, undefined]);
    fill(view, { client_id: ` ${CLIENT} `, client_secret: "s", refresh_token: "Atzr|1" });
    await press(at(view, "sp-connect"));
    expect(calls).toEqual([`addPair("amazon-ads",{"fields":{"client_id":"${CLIENT}","client_secret":"s"},"connection":{"refresh_token":"Atzr|1"}})`]);
    expect([words(body(view), "section > h2"), heads(view), rows(view), toast(view), focused()]).toEqual([
      [ADS_SOURCE_WORDS.lines.rows[language]], [`Client identifier ${CLIENT}`],
      [language === "en" ? "Example BrandNorth America · United States, CanadaFar East · Japan" : "Example Brand北美 · 美国、加拿大远东 · 日本"],
      ADS_SOURCE_WORDS.lines.connected[language], "row c-00000001"]);
    expect([at(view, "add first")!.textContent, at(view, "remove-pair first")!.textContent, at(view, "add-pair")!.textContent]).toEqual([ADS_SOURCE_WORDS.lines.add[language], say("pl.cl.remove"), say("pl.cl.add")]);
    document.body.replaceChildren();
  }
});

it("says Amazon's refusal on the first form in its words and keeps what was typed, a token that reaches no ad account in the page's sentence, and what is missing before anything is sent", async () => {
  const { view, calls, answers } = world();
  await opened(view);
  fill(view, { client_id: CLIENT, refresh_token: "Atzr|1" });
  await press(at(view, "sp-connect"));
  expect([calls, body(view).querySelector(".pl-field-note")!.textContent, focused()]).toEqual([[], "Fill in every field first.", "sp-client_secret"]);
  answers(async () => ({ ok: false, words: "The request has an invalid grant parameter : refresh_token" }));
  fill(view, { client_secret: "s" });
  await press(at(view, "sp-connect"));
  expect([body(view).querySelector(".pl-failed")!.textContent, (at(view, "sp-refresh_token") as HTMLInputElement).value, focused(), heads(view)]).toEqual(["Amazon did not accept these. “The request has an invalid grant parameter : refresh_token”", "Atzr|1", "sp-connect", []]);
  answers(async () => ({ ok: false, words: "", none: true }));
  await press(at(view, "sp-connect"));
  expect(words(body(view), ".pl-failed")).toEqual(["Amazon found no ad account for this token; get a new one with the Amazon account that manages your ads."]);
});

it("adds a grant under a Client identifier in its press's place, asking the token alone, and Cancel gives the keyboard back to the press", async () => {
  const { view, calls, lists } = world(one);
  await opened(view);
  await press(at(view, "add first"));
  expect([words(body(view), ".pl-pair-add > h3"), words(body(view), ".pl-pair-add .pl-field > span"), at(view, "add first"), focused()]).toEqual([["Add ad accounts"], ["Refresh token"], undefined, "sp-refresh_token"]);
  await press(at(view, "sp-cancel"));
  expect([body(view).querySelector(".pl-pair-add"), focused()]).toEqual([null, "add first"]);
  await press(at(view, "add first"));
  // The gate keeps the United Kingdom as GB, its ISO code.
  lists([{ country: "GB", profile: "4300", name: "Example Home", region: "eu" }, { country: "DE", profile: "4301", name: "Example Home", region: "eu" }]);
  type(view, "sp-refresh_token", "Atzr|2");
  await press(at(view, "sp-connect"));
  expect(calls).toEqual(['connectUnder("amazon-ads","first",{"refresh_token":"Atzr|2"})']);
  expect([rows(view).at(-1), focused(), heads(view)]).toEqual(["Example HomeEurope · United Kingdom, Germany", "row c-00000001", [`Client identifier ${CLIENT}`]]);
});

it("draws an Irish ad account on Europe's line, beside its other European places, in both languages", async () => {
  for (const language of ["en", "zh"] as const) {
    const { view } = world({ language, pairs: one.pairs, rows: [{ store: "c-home", accounts: [{ country: "IE", profile: "4400", name: "Example Home", region: "eu" }, { country: "DE", profile: "4401", name: "Example Home", region: "eu" }] }] });
    await opened(view);
    expect(rows(view)).toEqual([language === "en" ? "Example HomeEurope · Ireland, Germany" : "Example Home欧洲 · 爱尔兰、德国"]);
    document.body.replaceChildren();
  }
});

it("adds a Client identifier below the last with its first token, titled as the press, and draws each level with its own presses and one Add a Client identifier", async () => {
  const { view, calls, lists } = world(one);
  await opened(view);
  await press(at(view, "add-pair"));
  expect([words(body(view), ".pl-pair-add > h3"), words(body(view), ".pl-pair-add .pl-field > span"), focused()]).toEqual([["Add a Client identifier"], ["Client identifier", "Client secret", "Refresh token"], "sp-client_id"]);
  await press(at(view, "sp-cancel"));
  expect(focused()).toBe("add-pair");
  await press(at(view, "add-pair"));
  lists(OUTDOOR);
  fill(view, { client_id: OTHER, client_secret: "s2", refresh_token: "Atzr|3" });
  await press(at(view, "sp-connect"));
  expect(calls).toEqual([`addPair("amazon-ads",{"fields":{"client_id":"${OTHER}","client_secret":"s2"},"connection":{"refresh_token":"Atzr|3"}})`]);
  expect([heads(view), words(body(view), "[data-focus^='add ']").length, words(body(view), "[data-focus='add-pair']").length, focused()]).toEqual([[`Client identifier ${CLIENT}`, `Client identifier ${OTHER}`], 2, 1, "row c-00000001"]);
});

it("says under a row what Amazon's last check said where it was no whole list: a refusal alone in the failure's colour, the regions that did not answer, none listed; a grant never checked, nothing", async () => {
  for (const language of ["en", "zh"] as const) {
    const { view } = world({ language, pairs: one.pairs, rows: [
      { store: "c-a", accounts: BRAND },
      { store: "c-b", accounts: OUTDOOR, silent: ["fe"] },
      { store: "c-c", accounts: [], refused: true },
      { store: "c-d", accounts: [] },
      { store: "c-e" },
    ] });
    await opened(view);
    const failed = all(body(view), ".pl-row-failed");
    expect([failed.length, failed[0]!.closest("[data-focus]")!.getAttribute("data-focus"), failed[0]!.textContent, failed[0]!.parentElement!.children.length]).toEqual([1, "row c-c", ADS_SOURCE_WORDS.lines.refused[language], 1]);
    expect(rows(view).slice(1)).toEqual(language === "en"
      ? ["Example OutdoorNorth America · United StatesAmazon did not answer for Far East, so this list may be incomplete.", ADS_SOURCE_WORDS.lines.refused.en, "Amazon listed no ad account.", ""]
      : ["Example Outdoor北美 · 美国亚马逊没有返回远东的广告账号，这里可能不全。", ADS_SOURCE_WORDS.lines.refused.zh, "亚马逊没有列出广告账号。", ""]);
    expect(at(view, "remove c-c")!.getAttribute("aria-label")).toBe(`${text(language, "pl.c.remove")} ${ADS_SOURCE_WORDS.lines.refused[language]}`);
    document.body.replaceChildren();
  }
});

it("removes a row at once, and the keyboard goes to the press that adds under its Client identifier, then, its last row taking the Client identifier, to Add a Client identifier, then to the first form", async () => {
  const { view, calls } = world({ pairs: [...one.pairs, { name: "p-2", fields: { client_id: OTHER } }], rows: [...one.rows, { store: "c-other", pair: "p-2", accounts: OUTDOOR }] });
  await opened(view);
  await press(at(view, "remove c-outdoor"));
  expect([calls, toast(view), focused()]).toEqual([['removeConnection("amazon-ads","c-outdoor")'], "Removed.", "add first"]);
  await press(at(view, "remove c-other"));
  expect([heads(view), focused()]).toEqual([[`Client identifier ${CLIENT}`], "add-pair"]);
  await press(at(view, "remove c-brand"));
  expect([heads(view), words(body(view), "section > h2"), focused()]).toEqual([[], ["Connect your ad accounts"], "sp-client_id"]);
});

it("closes the card that asks before a Client identifier goes on a press that starts and ends on the dimmed page, not on its own padding or across its edge, and on Escape", async () => {
  const { view, calls } = world({ pairs: [...one.pairs, { name: "p-2", fields: { client_id: OTHER } }], rows: [...one.rows, { store: "c-dead", pair: "p-2", accounts: [], refused: true }] });
  await opened(view);
  const card = (): HTMLDialogElement | null => document.querySelector("dialog.pl-card-dialog");
  await press(at(view, "remove-pair first"));
  expect(scrimPresses(card()!)).toEqual([true, true, true, false]);
  await settle();
  expect([card(), focused()]).toEqual([null, "remove-pair first"]);
  await press(at(view, "remove-pair first"));
  card()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await settle();
  expect([card(), focused(), calls]).toEqual([null, "remove-pair first", []]);
  document.body.replaceChildren();
});

it("asks before a Client identifier goes, on a card that names its ad accounts; Cancel and Escape give the keyboard back, Remove takes it with its rows; one whose rows name nothing goes at once", async () => {
  for (const language of ["en", "zh"] as const) {
    const { view, calls } = world({ language, pairs: [...one.pairs, { name: "p-2", fields: { client_id: OTHER } }], rows: [...one.rows, { store: "c-dead", pair: "p-2", accounts: [], refused: true }] });
    await opened(view);
    await press(at(view, "remove-pair first"));
    const card = (): HTMLDialogElement | null => document.querySelector("dialog.pl-card-dialog");
    const list = language === "en" ? "Example Brand, Example Outdoor" : "Example Brand、Example Outdoor";
    expect([card()!.querySelector("h2")!.textContent, card()!.querySelector(".pl-card-body")!.textContent, words(card()!, "button"), calls]).toEqual(
      [text(language, "pl.cl.removeTitle"), ADS_SOURCE_WORDS.lines.removedWith[language].replace("{names}", list), [text(language, "pl.c.cancel"), text(language, "pl.c.remove")], []]);
    await press(card()!.querySelector("[data-focus='card-cancel']"));
    expect([card(), focused()]).toEqual([null, "remove-pair first"]);
    await press(at(view, "remove-pair first"));
    card()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await settle();
    expect([card(), focused()]).toEqual([null, "remove-pair first"]);
    await press(at(view, "remove-pair first"));
    await press(card()!.querySelector("[data-focus='card-remove']"));
    expect([calls, toast(view), heads(view), focused()]).toEqual([['removePair("amazon-ads","first")'], text(language, "pl.cl.removed"), [`Client identifier ${OTHER}`], "add-pair"]);
    await press(at(view, "remove-pair p-2"));
    expect([card(), calls.at(-1), heads(view)]).toEqual([null, 'removePair("amazon-ads","p-2")', []]);
    document.body.replaceChildren();
  }
});

it("masks every field the source does not declare clear, in the first form, in Add a Client identifier and under a Client identifier; with nothing declared, every field is masked, whatever its name", async () => {
  const kinds = (view: PluginsPage): Readonly<Record<string, string | null>> => Object.fromEntries(all(body(view), "input.pl-store-field").map((input) => [input.getAttribute("data-focus"), input.getAttribute("type")]));
  const declared = world();
  await opened(declared.view);
  expect(kinds(declared.view)).toEqual({ "sp-client_id": "text", "sp-client_secret": "password", "sp-refresh_token": "password" });
  document.body.replaceChildren();
  const held = world(one);
  await opened(held.view);
  await press(at(held.view, "add-pair"));
  expect(kinds(held.view)).toEqual({ "sp-client_id": "text", "sp-client_secret": "password", "sp-refresh_token": "password" });
  await press(at(held.view, "sp-cancel"));
  await press(at(held.view, "add first"));
  expect(kinds(held.view)).toEqual({ "sp-refresh_token": "password" });
  document.body.replaceChildren();
  const undeclared = world({ secret: null });
  await opened(undeclared.view);
  expect(kinds(undeclared.view)).toEqual({ "sp-client_id": "password", "sp-client_secret": "password", "sp-refresh_token": "password" });
});

it("saves a token added under the second Client identifier under that one, not the first", async () => {
  const { view, calls } = world({ pairs: [...one.pairs, { name: "p-2", fields: { client_id: OTHER } }], rows: [...one.rows, { store: "c-home", pair: "p-2", accounts: [{ country: "GB", profile: "4300", name: "Example Home", region: "eu" }] }] });
  await opened(view);
  await press(at(view, "add p-2"));
  type(view, "sp-refresh_token", "Atzr|3");
  await press(at(view, "sp-connect"));
  expect(calls).toEqual(['connectUnder("amazon-ads","p-2",{"refresh_token":"Atzr|3"})']);
});

it("draws two levels from what the listing declares and never from the name: a paired source under another name has them, Amazon Ads listed without paired has none", async () => {
  const other = world({ ...one, name: "other-ads" });
  await opened(other.view);
  expect([heads(other.view), rows(other.view).length, at(other.view, "add-pair") !== undefined]).toEqual([[`Client identifier ${CLIENT}`], 2, true]);
  document.body.replaceChildren();
  const unpaired = world({ rows: one.rows, paired: false });
  await opened(unpaired.view);
  expect([all(body(unpaired.view), ".pl-pair").length, at(unpaired.view, "add-pair"), at(unpaired.view, "remove-pair first")]).toEqual([0, undefined, undefined]);
});

it("keeps the form the seller opened while a connect ran: the pass clears its own form alone, and the keyboard stays where the seller types", async () => {
  let pass: () => void = () => {};
  const { view, answers } = world(one);
  answers(() => new Promise((resolve) => { pass = () => resolve({ ok: true }); }));
  await opened(view);
  await press(at(view, "add first"));
  type(view, "sp-refresh_token", "Atzr|2");
  await press(at(view, "sp-connect"));
  await press(at(view, "add-pair"));
  type(view, "sp-client_id", OTHER);
  (at(view, "sp-client_id") as HTMLInputElement).focus();
  pass();
  await settle();
  expect([rows(view).length, words(body(view), ".pl-pair-add > h3"), (at(view, "sp-client_id") as HTMLInputElement).value, focused()]).toEqual([3, ["Add a Client identifier"], OTHER, "sp-client_id"]);
});

it("leaves the keyboard on the Remove pressed when the removal fails, a row's or a Client identifier's from its card, and the row and the level stand", async () => {
  const { view, calls } = world({ ...one, removal: "fails" });
  await opened(view);
  await press(at(view, "remove c-outdoor"));
  expect([calls, rows(view).length, focused()]).toEqual([['removeConnection("amazon-ads","c-outdoor")'], 2, "remove c-outdoor"]);
  await press(at(view, "remove-pair first"));
  await press(document.querySelector("dialog.pl-card-dialog [data-focus='card-remove']"));
  expect([calls.at(-1), heads(view), focused()]).toEqual(['removePair("amazon-ads","first")', [`Client identifier ${CLIENT}`], "remove-pair first"]);
});

it("keeps Remove Client identifier in its words while its card asks, and shows work on it only once the card's Remove runs", async () => {
  let removed: () => void = () => {};
  const { view, calls } = world({ ...one, removing: new Promise<void>((resolve) => { removed = resolve; }) });
  await opened(view);
  const control = (): HTMLElement => at(view, "remove-pair first")!;
  const state = (): readonly unknown[] => [control().textContent, control().getAttribute("aria-busy")];
  await press(control());
  expect([document.querySelector("dialog.pl-card-dialog") !== null, ...state()]).toEqual([true, "Remove Client identifier", null]);
  await press(document.querySelector("dialog.pl-card-dialog [data-focus='card-remove']"));
  expect([calls, control().getAttribute("aria-busy")]).toEqual([['removePair("amazon-ads","first")'], "true"]);
  removed();
  await settle();
  expect([heads(view), focused()]).toEqual([[], "sp-client_id"]);
});

it("connects on Enter in the add form under a Client identifier, its one field, as the page's other one-field forms save", async () => {
  const { view, calls } = world(one);
  await opened(view);
  await press(at(view, "add first"));
  type(view, "sp-refresh_token", "Atzr|2");
  at(view, "sp-refresh_token")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await settle();
  expect([calls, focused()]).toEqual([['connectUnder("amazon-ads","first",{"refresh_token":"Atzr|2"})'], "row c-00000001"]);
});

it("keeps every Remove live before install and holds every press that adds, under the line, as ads-apps-held-uninstalled draws it", async () => {
  const { view, calls } = world({ ...one, installed: false });
  await opened(view);
  expect(body(view).querySelector("#pl-after-install")!.textContent).toBe("Install to set these up.");
  const state = (place: string): boolean => (at(view, place) as HTMLButtonElement).disabled;
  expect(["remove-pair first", "remove c-brand", "remove c-outdoor", "add first", "add-pair"].map(state)).toEqual([false, false, false, true, true]);
  await press(at(view, "remove c-outdoor"));
  expect(calls).toEqual(['removeConnection("amazon-ads","c-outdoor")']);
});

it("prints nothing of its own where the package declares no line: no press to add under a Client identifier, no line under a refused row, and each field by its own name, as the package declares no label", async () => {
  const { view } = world({ words: false, pairs: one.pairs, rows: [{ store: "c-dead", accounts: [], refused: true }, { store: "c-none", accounts: [] }] });
  await opened(view);
  expect([at(view, "add first"), at(view, "add-pair")!.textContent, rows(view), heads(view)]).toEqual([undefined, "Add a Client identifier", ["", ""], [`client_id ${CLIENT}`]]);
  await press(at(view, "add-pair"));
  expect(words(body(view), ".pl-pair-add .pl-field > span")).toEqual(["client_id", "client_secret", "refresh_token"]);
});

it("draws a connection the listing names no pair for under the first Client identifier, and one under a pair it does not list under a heading of no value, each with its Remove", async () => {
  const { view } = world({ pairs: one.pairs, rows: [{ store: "na", region: "na" }, { store: "c-lost", pair: "p-gone", accounts: OUTDOOR }] });
  await opened(view);
  expect([heads(view), rows(view), at(view, "remove na") !== undefined, at(view, "remove-pair p-gone") !== undefined]).toEqual([[`Client identifier ${CLIENT}`, ""], ["North America", "Example OutdoorNorth America · United States"], true, true]);
});
