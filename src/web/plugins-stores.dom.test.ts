// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { EVERYTHING, FIRST_PAIR, FIRST_RELEASE, type Backend, type ConnectionCheck, type Features, type GrantAccount, type Me, type Package, type Source, type SourcePair, type StoreConnection } from "./backend.js";
import type { Plugin } from "./catalogue.js";
import { SP_SOURCE_WORDS } from "./testing/source-words.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { withRecords, type Catalogue } from "./catalogue.js";
import { PluginsPage } from "./plugins-page.js";
import { clickStub } from "./plugins-test-kit.js";
import { text, type StringKey } from "./strings.js";

const signedIn = { kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } } as unknown as Extract<Me, { kind: "signed_in" }>;
const pack = (id: string): Package => { const name = CATALOGUE.plugins.find((one) => one.id === id)!.box!.package; return { name, version: "0.1.0", source: `npm:${name}` } as Package; };
const HELP = "https://developer-docs.amazon/sp-api/docs/self-authorization";

/** Amazon SP-API's record as its next release declares its source: 0.1.12's words with the four lines signed on 2026-11-13. */
const SP_RECORD = { ...CATALOGUE.plugins.find((one) => one.id === "amazon-sp-api")!, source: SP_SOURCE_WORDS } as unknown as Plugin;
/** What the check of a store finds, as the gate keeps it: in North America, selling in three marketplaces there. */
const FOUND: readonly GrantAccount[] = [{ country: "US", profile: "ATVPDKIKX0DER", name: "Example Store" }, { country: "CA", profile: "A2EUQ1WTGCTBG2", name: "Example Store" }, { country: "MX", profile: "A1AM78C64UM0Y8", name: "Example Store" }];
const CLIENT = "amzn1.application-oa2-client.7c1e5b";
/** One store connected under the first pair, as its check found it. */
const STORE: readonly StoreConnection[] = [{ store: "c-us", region: "na", accounts: FOUND }];

/**
 * A platform at the first release that lists Amazon SP-API, paired, and Amazon Ads where asked, as the gate does, and keeps what is saved
 * as the gate keeps it: the pairs, each by the name it makes and its Client identifier, and under each its stores, each by the name the
 * platform makes, its region and what its check reached. A connect is the platform's one request: the pair where one is added, the
 * store, Amazon's check, and what it saved removed again where the check does not pass or fails outright. Amazon's answer, and what its
 * check reaches, are the test's to give.
 */
function world(over: { connections?: readonly StoreConnection[]; saved?: boolean; language?: "en" | "zh"; installed?: boolean; sources?: boolean; catalogue?: Catalogue; features?: Features; ads?: readonly StoreConnection[]; adsInstalled?: boolean; keepa?: boolean; keepaKey?: boolean; seller?: boolean; extra?: readonly Source[] } = {}) {
  const calls: string[] = [];
  const fails = new Set<string>();
  let connections = [...(over.connections ?? [])];
  let pairs: SourcePair[] = over.saved === true || connections.length > 0 ? [{ name: FIRST_PAIR, fields: { client_id: CLIENT } }] : [];
  let ads = [...(over.ads ?? [])];
  let answer: (store: string) => Promise<ConnectionCheck> = async () => ({ ok: true });
  let reach: { readonly region?: string; readonly accounts?: readonly GrantAccount[] } = { region: "na", accounts: FOUND };
  let made = 0;
  // Held, a read of the sources answers what they were when it was asked, once the test lets it.
  let holding = false;
  const gates: PromiseWithResolvers<void>[] = [];
  const record = <A extends unknown[], R>(name: string, then: (...args: A) => R) => vi.fn(async (...args: A): Promise<Awaited<R>> => {
    calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(",")})`);
    if (fails.has(name)) throw new Error("refused");
    return await then(...args);
  });
  const spApi = (): Source => ({ name: "amazon-sp-api", supplier: "Amazon-SP-API", nativeUnit: "requests", aspects: [], enabled: connections.length > 0, spent: 0, month: { since: Date.parse("2026-10-01"), spent: 0 },
    fields: { client_id: pairs.length > 0, client_secret: pairs.length > 0 }, secretFields: ["client_secret"], connections: [...connections], regions: ["na", "eu", "fe"],
    connectionFields: [{ name: "store", secret: false }, { name: "region", secret: false }, { name: "refresh_token", secret: true }], paired: true, pairs: [...pairs] }) as unknown as Source;
  const adsSource = (): Source => ({ name: "amazon-ads", supplier: "Amazon-Ads", nativeUnit: "requests", aspects: [], enabled: ads.length > 0, spent: 0, month: { since: Date.parse("2026-10-01"), spent: 0 }, fields: { client_id: false, client_secret: false }, connections: [...ads], regions: ["na", "eu", "fe"] }) as unknown as Source;
  const keepa = { name: "keepa", supplier: "Keepa", nativeUnit: "tokens", unitsPerNative: 1, aspects: [{ aspect: "amazon/us/<asin>/product", native: 14 }], enabled: true, spent: 0, month: { since: Date.parse("2026-10-01"), spent: 118_000 }, freshness: { "amazon/<market>/<asin>/product": "1h" }, ownKey: { held: over.keepaKey === true } } as unknown as Source;
  const box = clickStub([...(over.sources === false ? [] : [pack("cx-sources")]), ...(over.keepa === false ? [] : [pack("keepa")]), ...(over.seller === false ? [] : [pack("cx-amazon-seller")]), ...(over.installed === false ? [] : [pack("amazon-sp-api")]), ...(over.adsInstalled === true ? [pack("amazon-ads")] : [])]);
  /** A store saved under a name the platform makes in a pair, then Amazon's check; one that does not pass is removed again, with the pair made for it. */
  const connect = async (pair: string, added: boolean): Promise<ConnectionCheck> => {
    made += 1;
    const store = `c-${String(made).padStart(8, "0")}`;
    connections = [...connections, { store, ...(pair === FIRST_PAIR ? {} : { pair }) }];
    const drop = (): void => { connections = connections.filter((one) => one.store !== store); if (added) pairs = pairs.filter((one) => one.name !== pair); };
    let check: ConnectionCheck;
    try { check = await answer(store); } catch (error) { drop(); throw error; }
    if (!check.ok) { drop(); return check; }
    connections = connections.map((one) => (one.store === store ? { ...one, ...reach } : one));
    return { ...check, connection: store };
  };
  const backend = {
    features: over.features ?? FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" }, readme: async () => undefined,
    series: async () => ({}), catalogue: async () => over.catalogue ?? withRecords(CATALOGUE, { plugins: [SP_RECORD] } as never), npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-10-17T00:00:00.000Z" }), npmPackage: async () => { throw new Error("unknown_package"); }, packages: box.packages, sources: async () => { const asked = [keepa, spApi(), ...(over.ads === undefined ? [] : [adsSource()]), ...(over.extra ?? [])]; if (holding) { const gate = Promise.withResolvers<void>(); gates.push(gate); await gate.promise; } return asked; },
    modelPlugins: async () => [], models: async () => ({ current: undefined, available: [] }), providers: async () => [], accounts: async () => [],
    now: () => Date.parse("2026-10-02"),
    addPair: record("addPair", async (_name: string, sent: { readonly fields: Readonly<Record<string, string>> }) => {
      const pair = pairs.length === 0 ? FIRST_PAIR : `p-${pairs.length + 1}`;
      pairs = [...pairs, { name: pair, fields: { client_id: sent.fields["client_id"] ?? "" } }];
      return await connect(pair, true);
    }),
    connectUnder: record("connectUnder", async (_name: string, pair: string) => await connect(pair, false)),
    removeConnection: record("removeConnection", (name: string, store: string) => {
      if (name === "amazon-ads") { ads = ads.filter((one) => one.store !== store); return; }
      connections = connections.filter((one) => one.store !== store);
      pairs = pairs.filter((pair) => connections.some((one) => (one.pair ?? FIRST_PAIR) === pair.name));
    }),
    removePair: record("removePair", (_name: string, pair: string) => { connections = connections.filter((one) => (one.pair ?? FIRST_PAIR) !== pair); pairs = pairs.filter((one) => one.name !== pair); }),
    removeSourceKey: record("removeSourceKey", () => undefined), saveSourceKey: record("saveSourceKey", () => undefined),
    installPackage: box.installPackage, setPackage: box.setPackage,
  } as unknown as Backend;
  // A page drawn from nothing but what the backend lists, as a reload draws it.
  const fresh = (): PluginsPage => {
    const page = new PluginsPage({ say: (key, values) => text(over.language ?? "en", key as StringKey, values), language: () => over.language ?? "en", backend, me: () => signedIn, ask: vi.fn(), announce: vi.fn(), changed: async () => {} });
    document.body.append(page.element);
    return page;
  };
  const view = fresh();
  return { view, calls, fails, answers: (next: typeof answer) => { answer = next; }, reaches: (next: typeof reach) => { reach = next; }, hold: () => { holding = true; }, gates, fresh, box: box.world };
}
const settle = async (): Promise<void> => { for (let n = 0; n < 6; n += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };
async function opened(view: PluginsPage, id = "amazon-sp-api", tab?: string): Promise<void> {
  await view.load();
  view.show({ kind: "plugin", id, ...(tab === undefined ? {} : { tab }) } as never);
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

afterEach(() => { document.body.replaceChildren(); location.hash = ""; });

it("draws Settings at the first release for the source that takes the seller's stores, and for Keepa, whose own key the seller saves there", async () => {
  const { view } = world();
  await opened(view, "keepa");
  expect(words(view.element, ".pl-tab")).toContain("Settings");
  document.body.replaceChildren();
  const sp = world();
  await opened(sp.view);
  expect(words(sp.view.element, ".pl-tab")).toContain("Settings");
});

it("draws an unconnected SP-API's Settings as Amazon Ads' first form, in its package's words: the pair, the refresh token, no store's name and no region, and Amazon's page on getting them", async () => {
  const { view } = world();
  await opened(view, "amazon-sp-api", "settings");
  expect(words(body(view), "section > h2")).toEqual(["Connect your store"]);
  expect(words(body(view), ".pl-field > span")).toEqual(["Client identifier", "Client secret", "Refresh token"]);
  expect(all(body(view), ".pl-store-field").map((one) => [one.tagName, one.getAttribute("type"), one.getAttribute("autocomplete")])).toEqual([["INPUT", "text", "off"], ["INPUT", "password", "off"], ["INPUT", "password", "off"]]);
  expect(all(body(view), "select")).toEqual([]);
  const help = at(view, "sp-how") as HTMLAnchorElement;
  expect([help.getAttribute("href"), help.getAttribute("target"), help.getAttribute("rel"), help.textContent]).toEqual([HELP, "_blank", "noopener", "How to get these from Amazon, opens in a new tab"]);
  expect([at(view, "sp-connect")!.textContent, body(view).querySelector("p")!.textContent]).toEqual(["Connect", "Once connected, cx can read and change your store."]);
});

it("asks for every field before anything is sent, putting the keyboard on the first one empty with the note that says why", async () => {
  const { view, calls } = world();
  await opened(view, "amazon-sp-api", "settings");
  await press(at(view, "sp-connect"));
  expect([body(view).querySelector(".pl-field-note")!.textContent, focused(), calls]).toEqual(["Fill in every field first.", "sp-client_id", []]);
  expect(at(view, "sp-client_id")!.getAttribute("aria-describedby")).toBe("pl-store-note");
  fill(view, { client_id: "amzn1.id", client_secret: "s" });
  await press(at(view, "sp-connect"));
  expect([focused(), calls, (at(view, "sp-client_id") as HTMLInputElement).value]).toEqual(["sp-refresh_token", [], "amzn1.id"]);
});

it("connects the first store with its pair and token in one request, asks Amazon while saying so in its package's words, and lands on the row, its name, region and marketplaces as the check reached them, with its line", async () => {
  const { view, calls, answers } = world();
  let answer: (check: ConnectionCheck) => void = () => {};
  answers(() => new Promise((resolve) => { answer = resolve; }));
  await opened(view, "amazon-sp-api", "settings");
  fill(view, { client_id: " amzn1.id ", client_secret: "secret", refresh_token: "Atzr|t" });
  await press(at(view, "sp-connect"));
  // While Amazon is asked the button says so and takes no press, what was typed cannot change, and the keyboard stays on the button.
  const busy = at(view, "sp-connect")!;
  expect([busy.textContent, busy.getAttribute("aria-busy"), busy.getAttribute("aria-disabled"), focused()]).toEqual(["Checking with Amazon…", "true", "true", "sp-connect"]);
  expect(at(view, "sp-refresh_token")!.hasAttribute("readonly")).toBe(true);
  await press(busy);
  answer({ ok: true });
  await settle();
  expect(calls).toEqual(['addPair("amazon-sp-api",{"fields":{"client_id":"amzn1.id","client_secret":"secret"},"connection":{"refresh_token":"Atzr|t"}})']);
  expect([toast(view), words(body(view), "section > h2"), words(body(view), ".pl-pair > h3")]).toEqual(["Store connected.", ["Stores"], ["Client identifier amzn1.id"]]);
  expect(words(body(view), ".pl-way-row .pl-row-text")).toEqual(["Example StoreNorth America · Sells in United\u00a0States, Canada, Mexico"]);
  // The row takes the keyboard whole, so its ring goes round the name and the line under it.
  expect([focused(), document.activeElement?.getAttribute("tabindex"), at(view, "add first")!.textContent]).toEqual(["row c-00000001", "-1", "Add a store"]);
});

it("keeps a store just connected listed when a read begun before the connect lands after the read the connect starts", async () => {
  const { view, hold, gates } = world();
  await opened(view, "amazon-sp-api", "settings");
  fill(view, { client_id: "amzn1.id", client_secret: "secret", refresh_token: "Atzr|t" });
  hold();
  const stale = view.load();
  await settle();
  await press(at(view, "sp-connect"));
  expect(gates).toHaveLength(2);
  gates[1]!.resolve();
  await settle();
  expect(words(body(view), ".pl-way-row strong")).toEqual(["Example Store"]);
  gates[0]!.resolve();
  await stale;
  await settle();
  expect(words(body(view), ".pl-way-row strong")).toEqual(["Example Store"]);
});

it("adds a store under the Client identifier with its token alone, and on Amazon's refusal, the store removed again by the platform, says Amazon's words and keeps what was typed", async () => {
  const { view, calls, answers, reaches } = world({ connections: STORE });
  answers(async () => ({ ok: false, words: "The request has an invalid grant parameter : refresh_token" }));
  await opened(view, "amazon-sp-api", "settings");
  await press(at(view, "add first"));
  expect([words(body(view), ".pl-pair-add > h3"), words(body(view), ".pl-pair-add .pl-field > span"), focused()]).toEqual([["Add a store"], ["Refresh token"], "sp-refresh_token"]);
  fill(view, { refresh_token: "Atzr|bad" });
  await press(at(view, "sp-connect"));
  expect(calls).toEqual(['connectUnder("amazon-sp-api","first",{"refresh_token":"Atzr|bad"})']);
  const refused = body(view).querySelector(".pl-failed")!;
  expect([refused.getAttribute("role"), refused.textContent, refused.querySelector("[lang]")?.getAttribute("lang")]).toEqual(["alert", "Amazon did not accept these. “The request has an invalid grant parameter : refresh_token”", "en"]);
  expect([words(body(view), ".pl-way-row strong"), focused(), (at(view, "sp-refresh_token") as HTMLInputElement).value, toast(view)]).toEqual([["Example Store"], "sp-connect", "Atzr|bad", ""]);
  answers(async () => ({ ok: true }));
  reaches({ region: "eu", accounts: [{ country: "GB", profile: "A1F83G8C2ARO7P", name: "Example Store UK" }] });
  fill(view, { refresh_token: "Atzr|good" });
  await press(at(view, "sp-connect"));
  expect(calls.slice(1)).toEqual(['connectUnder("amazon-sp-api","first",{"refresh_token":"Atzr|good"})']);
  // The gate keeps the United Kingdom as GB, which the page names as the language does, on Europe's line.
  expect(words(body(view), ".pl-way-row .pl-row-text")).toEqual(["Example StoreNorth America · Sells in United\u00a0States, Canada, Mexico", "Example Store UKEurope · Sells in United\u00a0Kingdom"]);
  expect(focused()).toBe("row c-00000002");
});

it("says the store's package's line where Amazon's check finds no store for the token, and one where a store's last check listed no marketplace, in both languages", async () => {
  for (const language of ["en", "zh"] as const) {
    const { view, answers } = world({ language, connections: [{ store: "c-none", region: "na", accounts: [] }] });
    answers(async () => ({ ok: false, words: "", none: true }));
    await opened(view, "amazon-sp-api", "settings");
    expect(words(body(view), ".pl-way-row .quiet")).toEqual([SP_SOURCE_WORDS.lines.none[language]]);
    await press(at(view, "add first"));
    fill(view, { refresh_token: "Atzr|t" });
    await press(at(view, "sp-connect"));
    expect(words(body(view), ".pl-failed")).toEqual([SP_SOURCE_WORDS.lines.foundNone[language]]);
    document.body.replaceChildren();
  }
});

it("says a store Amazon refused later in its package's line, alone and in the failure's colour", async () => {
  for (const language of ["en", "zh"] as const) {
    const { view } = world({ language, connections: [...STORE, { store: "c-dead", region: "eu", accounts: [], refused: true }] });
    await opened(view, "amazon-sp-api", "settings");
    expect([words(body(view), ".pl-row-failed"), words(body(view), ".pl-way-row .pl-row-text").at(-1)]).toEqual([[SP_SOURCE_WORDS.lines.refused[language]], SP_SOURCE_WORDS.lines.refused[language]]);
    document.body.replaceChildren();
  }
});

it("says a refusal with no words of Amazon's without empty quotation marks, and keeps the first form's fields", async () => {
  const { view, answers } = world();
  answers(async () => ({ ok: false, words: "" }));
  await opened(view, "amazon-sp-api", "settings");
  fill(view, { client_id: "amzn1.id", client_secret: "s", refresh_token: "Atzr|t" });
  await press(at(view, "sp-connect"));
  const refused = body(view).querySelector(".pl-failed")!;
  expect([refused.textContent, refused.querySelector("[lang]"), words(body(view), ".pl-field > span")]).toEqual(["Amazon did not accept these.", null, ["Client identifier", "Client secret", "Refresh token"]]);
});

it("says a write the platform refused as not saved, and leaves the form as it was typed with the keyboard on Connect", async () => {
  const { view, calls, fails } = world();
  fails.add("addPair");
  await opened(view, "amazon-sp-api", "settings");
  fill(view, { client_id: "amzn1.id", client_secret: "s", refresh_token: "t" });
  await press(at(view, "sp-connect"));
  expect(calls).toEqual(['addPair("amazon-sp-api",{"fields":{"client_id":"amzn1.id","client_secret":"s"},"connection":{"refresh_token":"t"}})']);
  expect([view.element.querySelector(".pl-said")?.textContent, focused(), (at(view, "sp-refresh_token") as HTMLInputElement).value, body(view).querySelector(".pl-failed")]).toEqual(["Not saved. Try again.", "sp-connect", "t", null]);
});

it("says not saved where the check fails outright, the platform having removed the store and its pair again, and keeps the first form", async () => {
  const { view, calls, answers } = world();
  answers(async () => { throw new Error("provider_unavailable"); });
  await opened(view, "amazon-sp-api", "settings");
  fill(view, { client_id: "amzn1.id", client_secret: "s", refresh_token: "t" });
  await press(at(view, "sp-connect"));
  expect(calls).toEqual(['addPair("amazon-sp-api",{"fields":{"client_id":"amzn1.id","client_secret":"s"},"connection":{"refresh_token":"t"}})']);
  expect([view.element.querySelector(".pl-said")?.textContent, words(body(view), ".pl-way-row strong"), words(body(view), ".pl-field > span"), focused()])
    .toEqual(["Not saved. Try again.", [], ["Client identifier", "Client secret", "Refresh token"], "sp-connect"]);
});

it("removes a store with its own button, says so, and gives the keyboard to the press that adds under its Client identifier, or to the first form once none is left", async () => {
  const { view, calls } = world({ connections: [{ store: "c-de", region: "eu", accounts: [{ country: "DE", profile: "A1PA6795UKMFR9", name: "Example DE" }] }, { store: "c-jp", region: "fe", accounts: [{ country: "JP", profile: "A1VC38T7YXB528", name: "Example JP" }] }] });
  await opened(view, "amazon-sp-api", "settings");
  expect(words(body(view), ".pl-way-row .pl-row-text")).toEqual(["Example DEEurope · Sells in Germany", "Example JPFar East · Sells in Japan"]);
  const remove = at(view, "remove c-de")!;
  expect([remove.textContent, remove.getAttribute("aria-label")]).toEqual(["Remove", "Remove Example DE"]);
  await press(remove);
  expect([calls, toast(view), focused(), words(body(view), ".pl-way-row strong")]).toEqual([['removeConnection("amazon-sp-api","c-de")'], "Removed.", "add first", ["Example JP"]]);
  await press(at(view, "remove c-jp"));
  // The pair goes with its last store, and the first form is drawn again, its first field taking the keyboard.
  expect([focused(), words(body(view), "section > h2"), words(body(view), ".pl-field > span")[0]]).toEqual(["sp-client_id", ["Connect your store"], "Client identifier"]);
});

it("draws no line that SP-API is not connected on its own Settings, where it is connected, as round 27 filters it, and draws it on its other tabs", async () => {
  const { view } = world();
  await opened(view, "amazon-sp-api", "settings");
  expect([view.element.querySelectorAll(".pl-needs").length, words(body(view), "section > h2")]).toEqual([0, ["Connect your store"]]);
  await opened(view, "amazon-sp-api", "overview");
  expect(words(view.element, ".pl-needs")).toEqual(["Not connected.Connect Amazon SP-API"]);
});

it("says the store's region and its places in Chinese as round 27 joins them, with 、 and no 和", async () => {
  const { view } = world({ connections: STORE, language: "zh" });
  await opened(view, "amazon-sp-api", "settings");
  expect(words(body(view), ".pl-way-row .quiet")).toEqual(["北美 · 在美国、加拿大、墨西哥销售"]);
});

it("names SP-API in a reading package's Data sources as the catalogue and the sidebar do, Amazon SP-API", async () => {
  const reader = { id: "reader", name: "Reader", author: "ComChatX", section: "extensions" as const, about: { en: "r", zh: "r" }, builds: [{ on: "amazon-sp-api", need: "required" as const, why: { en: "w", zh: "w" } }], box: { package: "reader", skills: [] } };
  for (const language of ["en", "zh"] as const) {
    const { view } = world({ saved: true, connections: [{ store: "shop.us", region: "na" }], language, catalogue: withRecords(CATALOGUE, { plugins: [reader] } as never) });
    await opened(view, "reader");
    expect(words(view.element, ".pl-side-word")).toContain({ en: "Amazon SP-API", zh: "亚马逊卖家接口" }[language]);
    expect(view.element.querySelector(".pl-side")!.textContent).not.toContain("Amazon-SP-API");
    document.body.replaceChildren();
  }
});


it("installs SP-API alone at once, with no card, since it brings nothing, buys nothing and runs only ComChatX's code", async () => {
  const { view } = world({ installed: false });
  await opened(view);
  [...view.element.querySelectorAll<HTMLButtonElement>("button")].find((one) => one.textContent === "+ Install")!.click();
  await settle();
  expect(document.querySelector("dialog.pl-card-dialog")).toBeNull();
  expect(view.element.querySelector(".pl-main")!.textContent).not.toContain("+ Install");
});

it("draws no store section on a card opened for another reason, since what a source reaches is its own line's, and lists SP-API on Yours with no month, since nothing is bought from it", async () => {
  for (const [id, adsInstalled] of [["amazon-sp-api", false], ["amazon-ads", false]] as const) {
    const { view } = world({ installed: false, sources: false, adsInstalled });
    await opened(view, id);
    [...view.element.querySelectorAll<HTMLButtonElement>("button")].find((one) => one.textContent === "+ Install")!.click();
    const dialog = document.querySelector("dialog.pl-card-dialog")!;
    // A row's own line is its plugin's sentence, whatever it names; the card says nothing of stores in its own words.
    const own = words(dialog, ".pl-card-headtext, .pl-card-label, .pl-card-warn").join(" ");
    expect([words(dialog, ".pl-card-label").some((one) => /store/i.test(one)), /store|店铺/.test(own), dialog.textContent?.includes("Paid from your balance")], id).toEqual([false, false, false]);
    document.body.replaceChildren();
  }
  document.body.replaceChildren();
  const held = world({ saved: true, connections: [{ store: "shop.us", region: "na" }] });
  await held.view.load();
  held.view.show({ kind: "home", view: "yours", filter: "all" } as never);
  await settle();
  const rows = all(held.view.element, "a.pl-row-link");
  const row = (id: string) => rows.find((one) => one.getAttribute("href") === `#/plugins/p/${id}`)!.closest("li")!;
  expect([row("amazon-sp-api").querySelector(".pl-month"), row("keepa").querySelector(".pl-month > [aria-hidden]")?.textContent, row("keepa").querySelector(".pl-month > .pl-sr")?.textContent]).toEqual([null, "$0.12", "$0.12 this month"]);
});

it("says nothing on a store source's Remove card of what stops, of buying or of stores, an account connected or not", async () => {
  const shop = [{ store: "shop.us", region: "na" }] as const;
  const SP_API = { en: "Amazon SP-API", zh: "亚马逊卖家接口" }, ADS = { en: "Amazon Ads API", zh: "亚马逊广告接口" };
  for (const language of ["en", "zh"] as const) {
    for (const [id, name, connected] of [["amazon-sp-api", SP_API, true], ["amazon-sp-api", SP_API, false], ["amazon-ads", ADS, true], ["amazon-ads", ADS, false]] as const) {
      const { view } = id === "amazon-sp-api" ? world({ saved: true, connections: connected ? shop : [], language }) : world({ ads: connected ? shop : [], adsInstalled: true, language });
      await opened(view, id);
      view.element.querySelector<HTMLButtonElement>(".pl-more")!.click();
      view.element.querySelector<HTMLButtonElement>(".pl-head-tools .f-menu [role=menuitem]")!.click();
      await settle();
      const card = document.querySelector("dialog.pl-card-dialog")!;
      const line = text(language, "pl.c.stopBox", { name: name[language] });
      expect([(card.textContent ?? "").includes(line), /buy|购买|store|店铺|Amazon-SP-API|Amazon-Ads/.test(card.textContent ?? "")], `${id} ${connected} ${language}`).toEqual([false, false]);
      document.body.replaceChildren();
    }
  }
});

it("scrolls a tab that takes the keyboard into its bar, the bar alone, from either side", async () => {
  const { view } = world();
  await opened(view);
  const bar = view.element.querySelector<HTMLElement>(".pl-tabs")!;
  const box = (left: number, right: number) => ({ left, right, top: 0, bottom: 40, width: right - left, height: 40, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
  bar.getBoundingClientRect = () => box(16, 374);
  const settings = at(view, "tab settings")!, overview = at(view, "tab overview")!;
  settings.getBoundingClientRect = () => box(332 - bar.scrollLeft, 416 - bar.scrollLeft);
  overview.getBoundingClientRect = () => box(16 - bar.scrollLeft, 104 - bar.scrollLeft);
  const page = scrollY;
  settings.focus();
  expect([bar.scrollLeft, scrollY]).toEqual([42, page]);
  overview.focus();
  expect(bar.scrollLeft).toBe(0);
});

it("keeps a focused field's ring inside the page's scroller: main pads what it scrolls to by more than the ring's 2 px at 2 px off", () => {
  const css = readFileSync("src/web/site/app.css", "utf8");
  const rule = /main:has\(> \.pl-page\)\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const padding = /scroll-padding-block:\s*var\(--space-(\d)\)/.exec(rule)?.[1];
  const space = /--space-(\d):\s*([\d.]+)rem/g;
  const theme = readFileSync("src/web/site/theme.css", "utf8");
  const px = new Map([...theme.matchAll(space)].map((one) => [one[1], Number(one[2]) * 16]));
  expect(px.get(padding ?? "")).toBeGreaterThan(4);
});

/** The controls a Settings tab draws, each with whether it can be used and what describes it. */
const controls = (view: PluginsPage): readonly (readonly [string, boolean, string | null])[] =>
  all(body(view), "input, select, textarea, button").map((one) => [one.getAttribute("data-focus") ?? one.tagName, (one as HTMLInputElement).disabled, one.getAttribute("aria-describedby")]);
const lineOf = (view: PluginsPage): readonly unknown[] => { const first = body(view).firstElementChild!; return [first.tagName, first.id, first.textContent]; };
const installs = (view: PluginsPage): number => all(view.element, "button").filter((one) => one.textContent === "+ Install").length;

it("draws SP-API's Settings before install as the installed form, every field and Connect disabled under the line that describes them, the help link live, and the header's Install the one", async () => {
  for (const language of ["en", "zh"] as const) {
    const { view } = world({ installed: false, language });
    await opened(view, "amazon-sp-api", "settings");
    expect(lineOf(view)).toEqual(["P", "pl-after-install", language === "en" ? "Install to set these up." : "安装后可设置。"]);
    expect(controls(view)).toEqual([
      ["sp-client_id", true, "pl-after-install pl-store-note"], ["sp-client_secret", true, "pl-after-install pl-store-note"],
      ["sp-refresh_token", true, "pl-after-install pl-store-note"], ["sp-connect", true, "pl-after-install"],
    ]);
    expect([at(view, "sp-how")!.tagName, body(view).querySelector("h2")!.textContent]).toEqual(["A", language === "en" ? "Connect your store" : "连接店铺"]);
    expect([installs(view), body(view).textContent!.includes("Not installed.")]).toEqual([language === "en" ? 1 : 0, false]);
    document.body.replaceChildren();
  }
  const { view } = world();
  await opened(view, "amazon-sp-api", "settings");
  expect([body(view).querySelector("#pl-after-install"), controls(view).every(([, disabled]) => !disabled), at(view, "sp-refresh_token")!.getAttribute("aria-describedby")]).toEqual([null, true, "pl-store-note"]);
});

it("opens SP-API's Settings once its install is written down, while it waits in the queue for cx's computer: saving reaches the platform, not the computer", async () => {
  const { view, box, calls } = world({ installed: false });
  box.hold = true;
  await opened(view);
  await press([...view.element.querySelectorAll<HTMLButtonElement>("button")].find((one) => one.textContent === "+ Install"));
  expect(box.list.waiting?.map((one) => [one.op, one.source])).toEqual([["install", "npm:cx-amazon-sp-api"]]);
  await opened(view, "amazon-sp-api", "settings");
  expect([body(view).querySelector("#pl-after-install"), controls(view).every(([, disabled]) => !disabled)]).toEqual([null, true]);
  for (const [field, value] of [["sp-client_id", "amzn1.application-oa2-client.x"], ["sp-client_secret", "secret"], ["sp-refresh_token", "Atzr|x"]] as const) {
    const input = at(view, field) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  await press(at(view, "sp-connect"));
  expect([calls.filter((one) => one.startsWith("addPair(")).length, box.list.waiting?.length]).toEqual([1, 1]);
});

it("keeps each store's Remove and Remove Client identifier live before install, and working, while every press that adds waits under the line", async () => {
  const { view, calls } = world({ installed: false, connections: [{ store: "c-de", region: "eu", accounts: [{ country: "DE", profile: "A1PA6795UKMFR9", name: "Example DE" }] }, ...STORE] });
  await opened(view, "amazon-sp-api", "settings");
  expect(lineOf(view)[2]).toBe("Install to set these up.");
  expect(controls(view)).toEqual([["remove-pair first", false, null], ["remove c-de", false, null], ["remove c-us", false, null], ["add first", true, "pl-after-install"], ["add-pair", true, "pl-after-install"]]);
  await press(at(view, "remove c-de"));
  expect([calls, toast(view), words(body(view), ".pl-way-row strong"), lineOf(view)[2]]).toEqual([['removeConnection("amazon-sp-api","c-de")'], "Removed.", ["Example Store"], "Install to set these up."]);
});

it("reads and removes each store of an earlier shape, under the first Client identifier: one of the earliest form, by its region's name, saved with its region; one saved before pairs, its marketplaces kept by its check; one whose region Amazon has not answered yet, which says nothing", async () => {
  const earlier: readonly StoreConnection[] = [{ store: "na", region: "na" }, { store: "gl-us", region: "na", accounts: FOUND }, { store: "shop.new" }];
  const { view, calls } = world({ connections: earlier });
  await opened(view, "amazon-sp-api", "settings");
  expect([words(body(view), ".pl-pair > h3"), words(body(view), ".pl-way-row .pl-row-text")]).toEqual([[`Client identifier ${CLIENT}`], ["North America", "Example StoreNorth America · Sells in United\u00a0States, Canada, Mexico", ""]]);
  // The name a seller typed for a store before pairs is no longer printed: the row says what Amazon's check reached.
  expect(body(view).textContent).not.toContain("gl-us");
  for (const store of ["na", "gl-us", "shop.new"]) await press(at(view, `remove ${store}`));
  expect([calls, words(body(view), "section > h2")]).toEqual([['removeConnection("amazon-sp-api","na")', 'removeConnection("amazon-sp-api","gl-us")', 'removeConnection("amazon-sp-api","shop.new")'], ["Connect your store"]]);
});

it("draws Keepa's Settings before install, where its own key is served, with the key field and Save disabled under the line and no line on who pays; installed, the same enabled and still no line on who pays, its rows saying it", async () => {
  const { view } = world({ features: EVERYTHING, keepa: false });
  await opened(view, "keepa", "settings");
  expect(lineOf(view)[2]).toBe("Install to set these up.");
  expect(controls(view).map(([place, disabled, said]) => [place, disabled, said?.split(" ")[0]])).toEqual([["INPUT", true, "pl-after-install"], ["way-key", true, "pl-after-install"]]);
  expect([body(view).textContent!.includes("cx uses your balance."), (body(view).querySelector("input.pl-key") as HTMLInputElement).placeholder]).toEqual([false, "Paste your Keepa API key"]);
  document.body.replaceChildren();
  const held = world({ features: EVERYTHING, keepa: false, keepaKey: true });
  await opened(held.view, "keepa", "settings");
  // A key the account holds keeps its Remove key; Use, which also takes the key away to pay from the balance, changes what pays and waits.
  expect(controls(held.view)).toEqual([["way-platform", true, "pl-after-install"], ["way-forget", false, null]]);
  await press(at(held.view, "way-forget"));
  expect(held.calls).toEqual(['removeSourceKey("keepa")']);
  document.body.replaceChildren();
  const installed = world({ features: EVERYTHING });
  await opened(installed.view, "keepa", "settings");
  expect([body(installed.view).querySelector("#pl-after-install"), controls(installed.view).every(([, disabled]) => !disabled), body(installed.view).textContent!.includes("cx uses your balance.")]).toEqual([null, true, false]);
});

it("draws a disabled field and drop-down on the Plugins page as a disabled button, at full strength, every placeholder in the quiet words, which the theme holds at 4.5:1 on both grounds, and a key field that gives up its floor on a window of 21rem or less", async () => {
  const css = readFileSync("src/web/site/app.css", "utf8");
  const rule = (selector: string): string | undefined => new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`, "m").exec(css)?.[1]?.trim();
  expect(rule("button:disabled:not(:where(.f-btn, .f-quiet, .f-icon, .f-select, .f-switch, .f-menu-row, .f-seg > button)), button.primary:disabled:not(:where(.f-btn))")).toBe("border-color: var(--line); background: var(--wash); color: var(--quiet); cursor: default;");
  expect(rule(".pl-page :is(input, select, textarea):disabled")).toBe("border-color: var(--line); background: var(--wash); color: var(--quiet); opacity: 1; cursor: default;");
  expect(rule(".pl-page :is(input, textarea)::placeholder")).toBe("color: var(--quiet); opacity: 1;");
  expect(css).toContain("@media (max-width: 21rem) { .pl-page .pl-key { min-width: 0; } }");
  const { PAIRS } = await import("./theme.mjs");
  // The quiet words on a field's ground, enabled and disabled: the theme's check holds each pair at its floor in light and dark.
  expect(["raised", "wash"].map((ground) => PAIRS.find(([text, on]) => text === "quiet" && on === ground)?.[2])).toEqual([4.5, 4.5]);
});

it("keeps a lone character or word off the last line of the Plugins page's card lines, paragraphs and rows, and splits a two-line title evenly", () => {
  const css = readFileSync("src/web/site/app.css", "utf8");
  expect(css).toContain(".pl-page :is(p, .pl-about, .pl-row-text > span) { text-wrap: pretty; }");
  expect(/^\.pl-page h1 \{[^}]*text-wrap: balance;[^}]*\}/m.test(css)).toBe(true);
});

it("draws the two levels for a paired source no line names, by its declaration alone: the pair's fields, both its connection's secret fields asked and sent, no region, and its package's words", async () => {
  const spApi = CATALOGUE.plugins.find((one) => one.id === "amazon-sp-api")!;
  const lines = { connect: { en: "Connect your shop", zh: "连接商店" }, canChange: { en: "cx can use your shop.", zh: "cx 可以使用你的商店。" }, rows: { en: "Shops", zh: "商店" }, add: { en: "Add a shop", zh: "添加商店" }, connected: { en: "Shop connected.", zh: "商店已连接。" } };
  const fields = { app_key: { label: { en: "App key", zh: "App key" } }, app_secret: { label: { en: "App secret", zh: "App secret" } }, access_token: { label: { en: "Access token", zh: "Access token" } }, signing_key: { label: { en: "Signing key", zh: "Signing key" } } };
  const record = { ...spApi, id: "fixture-pairs", name: "Fixture pairs", box: { ...spApi.box!, package: "fixture-pairs-box" }, source: { name: "fixture-pairs", aspects: {}, fields, lines } };
  const declared = { name: "fixture-pairs", supplier: "Fixture", nativeUnit: "requests", aspects: [], enabled: false, spent: 0, month: { since: Date.parse("2026-10-01"), spent: 0 }, fields: { app_key: false, app_secret: false }, secretFields: ["app_secret"],
    connections: [], connectionFields: [{ name: "access_token", secret: true }, { name: "signing_key", secret: true }], paired: true, pairs: [] } as unknown as Source;
  const { view, calls } = world({ catalogue: withRecords(CATALOGUE, { plugins: [record] } as never), extra: [declared] });
  await opened(view, "fixture-pairs", "settings");
  expect([words(body(view), "section > h2"), words(body(view), ".pl-field > span"), all(body(view), ".pl-store-field").map((one) => one.getAttribute("type"))]).toEqual([["Connect your shop"], ["App key", "App secret", "Access token", "Signing key"], ["text", "password", "password", "password"]]);
  fill(view, { app_key: "k", app_secret: "s", access_token: "a", signing_key: "g" });
  await press(at(view, "sp-connect"));
  expect(calls).toEqual(['addPair("fixture-pairs",{"fields":{"app_key":"k","app_secret":"s"},"connection":{"access_token":"a","signing_key":"g"}})']);
});

it("opens an unconnected source's Settings once its install is written down, where Install was pressed on its own page, with the keyboard on the Settings tab", async () => {
  const { view } = world({ installed: false });
  location.hash = "#/plugins/p/amazon-sp-api";
  await opened(view);
  await press([...view.element.querySelectorAll<HTMLButtonElement>(".pl-head button")].find((one) => one.textContent === "+ Install"));
  expect(location.hash).toBe("#/plugins/p/amazon-sp-api/settings");
  // The app shows the address the hash names, as a tab pressed: the tab takes the keyboard, which a screen reader reads as the selected Settings tab.
  view.show({ kind: "plugin", id: "amazon-sp-api", tab: "settings" } as never);
  await settle();
  expect([focused(), document.activeElement?.getAttribute("role"), document.activeElement?.getAttribute("aria-selected"), document.activeElement?.textContent]).toEqual(["tab settings", "tab", "true", "Settings"]);
  expect(at(view, "sp-client_id")).toBeDefined();
});

it("opens no Settings for an install pressed on a list, nor for one whose page the seller has left before it was written down", async () => {
  const { view } = world({ installed: false });
  location.hash = "#/plugins/discover/all";
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all" } as never);
  await settle();
  await press(view.element.querySelector('button[aria-label="Install Amazon SP-API"]'));
  expect(location.hash).toBe("#/plugins/discover/all");

  const left = world({ installed: false });
  location.hash = "#/plugins/p/amazon-sp-api";
  await opened(left.view);
  [...left.view.element.querySelectorAll<HTMLButtonElement>(".pl-head button")].find((one) => one.textContent === "+ Install")!.click();
  // Gone back to the list before the install is written down.
  location.hash = "#/plugins/discover/all";
  left.view.show({ kind: "home", view: "discover", filter: "all" } as never);
  await settle();
  expect(location.hash).toBe("#/plugins/discover/all");
});

it("opens no Settings for a source that needs no connection, installed from its own page: Keepa's install card stands, and its page stays", async () => {
  const { view } = world({ installed: false, keepa: false });
  location.hash = "#/plugins/p/keepa";
  await opened(view, "keepa");
  const install = [...view.element.querySelectorAll<HTMLButtonElement>(".pl-head button")].find((one) => one.textContent === "+ Install");
  await press(install);
  expect(location.hash).toBe("#/plugins/p/keepa?card=install:p:keepa");
});

it("stays on Settings, where + Install was pressed from that tab, with the keyboard where it lands after any install", async () => {
  const { view } = world({ installed: false });
  location.hash = "#/plugins/p/amazon-sp-api/settings";
  await view.load();
  view.show({ kind: "plugin", id: "amazon-sp-api", tab: "settings" } as never);
  await settle();
  await press([...view.element.querySelectorAll<HTMLButtonElement>(".pl-head button")].find((one) => one.textContent === "+ Install"));
  expect(location.hash).toBe("#/plugins/p/amazon-sp-api/settings");
  expect(at(view, "sp-client_id")).toBeDefined();
});

it.each([[false, "#/plugins/p/fixture-fields/settings"], [true, "#/plugins/p/fixture-fields"]] as const)("opens the Settings of a source connected by its own checked fields, by its declaration alone, once its install is written down from its own page, unless it is on already (on: %s)", async (on, landed) => {
  // A source under a name nothing in the code knows: no stores, its own fields checked by one read; off, none is saved.
  const spApi = CATALOGUE.plugins.find((one) => one.id === "amazon-sp-api")!;
  const record = { ...spApi, id: "fixture-fields", name: "Fixture fields", box: { ...spApi.box!, package: "fixture-fields-box" }, source: { ...spApi.source!, name: "fixture-fields" } };
  const declared = { name: "fixture-fields", supplier: "Fixture", nativeUnit: "requests", aspects: [], enabled: on, spent: 0, month: { since: Date.parse("2026-10-01"), spent: 0 }, fields: { token: on }, checksFields: true } as unknown as Source;
  const { view } = world({ installed: false, catalogue: withRecords(CATALOGUE, { plugins: [record] } as never), extra: [declared] });
  location.hash = "#/plugins/p/fixture-fields";
  await opened(view, "fixture-fields");
  await press([...view.element.querySelectorAll<HTMLButtonElement>(".pl-head button")].find((one) => one.textContent === "+ Install"));
  const card = document.querySelector("dialog.pl-card-dialog");
  if (card !== null) await press([...card.querySelectorAll<HTMLButtonElement>("button")].find((one) => one.textContent === "Install"));
  expect(location.hash).toBe(landed);
});
