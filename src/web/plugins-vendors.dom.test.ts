// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { EVERYTHING, FIRST_RELEASE, type Backend, type Features, type Me } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { type Catalogue } from "./catalogue.js";
import { PluginsPage } from "./plugins-page.js";
import { appRegion, listOf } from "./plugins-test-kit.js";
import { text, type StringKey } from "./strings.js";

/** The page where a model maker is not a plugin: the vendors the platform serves, drawn held, with no switch, ways stored or series. */
const SERVED_ONLY: Features = Object.freeze({ ...FIRST_RELEASE, modelPlugins: false });
const signedIn = { kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } } as unknown as Extract<Me, { kind: "signed_in" }>;
const sol = { provider: "openai", id: "gpt-6-sol", name: "GPT-6 Sol" };
const luna = { provider: "openai", id: "gpt-6-luna", name: "GPT-6 Luna", via: "OpenAI" };
const m3 = { provider: "minimax", id: "minimax-m3", name: "MiniMax M3" };

/** A platform that serves OpenAI and MiniMax, and answers every read a vendor's page could make, so nothing is left out for want of an answer. */
function world(over: { chatOn?: string; series?: Record<string, unknown>; features?: Features; ownKey?: boolean; balance?: number; ways?: readonly string[]; signedIn?: boolean; enabled?: boolean; month?: number; language?: "en" | "zh"; catalogue?: Catalogue; account?: "member" | "trial" | "free"; modelMoney?: number; platformServed?: readonly { provider: string; id: string }[] | "unread"; packagesUnread?: boolean; follows?: boolean; held?: boolean; available?: readonly object[]; signsInTo?: readonly object[]; hostKey?: boolean; full?: true | "many"; placed?: readonly string[]; ticked?: readonly string[]; signIn?: Backend["signIn"]; answerSignIn?: Backend["answerSignIn"]; waysGate?: Promise<void>; providers?: readonly object[] } = {}) {
  const calls: string[] = [];
  /** The writes that are refused, by name; a test adds and removes them as it goes. */
  const fails = new Set<string>();
  let ownKey = over.ownKey === true;
  let subscribed = over.signedIn ?? true;
  let hostKey = over.hostKey;
  let available = over.available ?? [sol, luna, m3];
  let series = over.series as Record<string, readonly { name: string }[]> | undefined;
  let enabled = over.enabled ?? true;
  let added: readonly string[] = [];
  // Held, a read of the model plugins answers what they were when it was asked, once the test lets it.
  let holding = false;
  const gates: PromiseWithResolvers<void>[] = [];
  /** Where the world follows, a series written to is read back changed, as a platform's would be. */
  const written = (change: object) => (vendor: unknown, name: unknown): void => {
    if (over.follows === true && series !== undefined) series = { ...series, [vendor as string]: series[vendor as string]!.map((one) => (one.name === name ? { ...one, ...change } : one)) };
  };
  const changed = vi.fn(async () => {});
  const record = (name: string, then?: (...args: unknown[]) => unknown) => vi.fn(async (...args: unknown[]) => {
    calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(",")})`);
    if (fails.has(name)) throw new Error("refused");
    return then?.(...args);
  });
  const backend = {
    features: over.features ?? FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" }, readme: async () => undefined,
    series: async () => series ?? {},
    chatOffer: async () => ({ vendors: [], models: [], places: [...new Set([...(over.placed ?? []), ...Object.entries(series ?? {}).filter(([, list]) => list.some((one) => (one as { inChat?: boolean }).inChat === true)).map(([id]) => id)])] }),
    catalogue: async () => over.catalogue ?? CATALOGUE, npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-10-17T00:00:00.000Z" }), npmPackage: async () => { throw new Error("unknown_package"); }, packages: async () => { if (over.packagesUnread === true) throw new Error("no answer"); return listOf([]); }, sources: async () => [],
    modelPlugins: async () => {
      const asked = [...(over.held === false ? [] : [{ id: "openai", enabled, ways: over.ways ?? ["platform", "account", "key"], month: over.month ?? 800_000 }]), ...added.map((id) => ({ id, enabled: true, ways: ["platform"] }))];
      if (holding) { const gate = Promise.withResolvers<void>(); gates.push(gate); await gate.promise; }
      return asked;
    },
    models: async () => ({ current: over.chatOn === "minimax" ? { provider: "minimax", id: "minimax-m3" } : { provider: "openai", id: "gpt-6-sol" }, available, default: { provider: "minimax", id: "minimax-m3" } }),
    providers: async () => [{ id: "openai", name: "OpenAI", platformKey: true, ownKey, models: [{ id: "gpt-6-luna", name: "GPT-6 Luna", shown: true }], rates: [{ model: "gpt-6-sol", input: 20_000, output: 100_000 }] },
      ...(over.hostKey === undefined ? [] : [{ id: "openrouter", name: "OpenRouter", platformKey: false, ownKey: hostKey, models: [], rates: [] }]), ...(over.providers ?? [])],
    accounts: async () => [{ id: "openai", name: "ChatGPT", signedIn: subscribed, models: [] }],
    ...(over.account === undefined ? {} : { accountMoney: async () => ({ state: over.account, model_figure: over.modelMoney ?? 0 }), platformModels: async () => { if (over.platformServed === "unread") throw new Error("no answer"); return over.platformServed ?? [{ provider: "minimax", id: "minimax-m3" }]; } }),
    // With five vendors in chat, or five of this one's series, a tick on is refused; an untick is always taken.
    setSeries: record("setSeries", (vendor, name, on) => (over.full !== undefined && on === true ? (over.full === true ? "full" : over.full) : written({ inChat: on })(vendor, name))), pinSeries: record("pinSeries"), now: () => Date.parse("2026-09-28"),
    addToChat: record("addToChat", (vendor, names) => { for (const name of names as string[]) written({ inChat: true })(vendor, name); }),
    saveOwnKey: record("saveOwnKey", (provider) => { if (provider === "openrouter") hostKey = true; else ownKey = true; }),
    removeOwnKey: record("removeOwnKey", (provider) => { if (provider === "openrouter") hostKey = false; else ownKey = false; }),
    setModelWays: record("setModelWays", async () => { await over.waysGate; }), showModel: record("showModel"), setModel: record("setModel", (_id, on) => { enabled = on as boolean; }), installModel: record("installModel", (id) => { added = [...added, id as string]; }),
    vendors: async () => over.ticked, setVendors: record("setVendors"),
    signIn: over.signIn ?? record("signIn", () => { if (over.signsInTo !== undefined) available = over.signsInTo; }), signOut: record("signOut", () => { subscribed = false; }), answerSignIn: over.answerSignIn,
  } as unknown as Backend;
  const view = new PluginsPage({ say: (key, values) => text(over.language ?? "en", key as StringKey, values), language: () => over.language ?? "en", backend, me: () => (over.balance === undefined ? signedIn : { ...signedIn, balance: { available: over.balance } } as typeof signedIn), ask: vi.fn(), announce: appRegion(), changed });
  document.body.append(view.element);
  return { backend, view, calls, changed, fails, hold: () => { holding = true; }, gates };
}
const settle = async (): Promise<void> => { for (let n = 0; n < 4; n += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };
async function opened(view: PluginsPage, tab?: string, id = "openai"): Promise<void> {
  await view.load();
  view.show({ kind: "plugin", id, ...(tab === undefined ? {} : { tab }) } as never);
  await settle();
}
const all = (root: ParentNode, selector: string): readonly Element[] => [...root.querySelectorAll(selector)];
const words = (root: ParentNode, selector: string): readonly string[] => all(root, selector).map((one) => one.textContent ?? "");
const tabs = (view: PluginsPage): readonly string[] => words(view.element, ".pl-tabs .pl-tab");

afterEach(() => { document.body.replaceChildren(); location.hash = ""; });

it("draws, where model makers are not plugins, a Models shelf with a card for each vendor the platform serves and each model plugin installed, held, and no row to the models' own page", async () => {
  const { view } = world({ features: SERVED_ONLY });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all" });
  const shelf = view.element.querySelector("section.pl-shelf#models") ?? all(view.element, "section.pl-shelf").find((one) => one.querySelector("h3")?.textContent?.startsWith("Models"))!;
  // Jev serves no chat model and is listed all the same: a package that needs a model gets it through Jev's card.
  expect(all(shelf, "a.pl-card-name").map((one) => one.getAttribute("href"))).toEqual(["#/plugins/p/jev", "#/plugins/p/openai", "#/plugins/p/minimax"]);
  // A served vendor is held: its card offers no install.
  expect(all(shelf, "button")).toHaveLength(0);
  expect(all(shelf, ".pl-done-mark")).toHaveLength(3);
  expect(all(view.element, "a").map((one) => one.getAttribute("href"))).not.toContain("#/plugins/models");
  // A vendor the platform serves no model of has no card.
  expect(all(view.element, "a").map((one) => one.getAttribute("href"))).not.toContain("#/plugins/p/z-ai");
});

it("draws, where model makers are not plugins, a vendor whose subscription the platform signs in to though it serves none of its models: its card and its page, where the sign-in is", async () => {
  const { view } = world({ features: SERVED_ONLY, available: [m3], signedIn: false });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all" });
  const shelf = all(view.element, "section.pl-shelf").find((one) => one.querySelector("h3")?.textContent?.startsWith("Models"))!;
  expect(all(shelf, "a.pl-card-name").map((one) => one.getAttribute("href"))).toEqual(["#/plugins/p/jev", "#/plugins/p/openai", "#/plugins/p/minimax"]);
  await opened(view, "settings");
  // No model of its to list, and no balance to pay with: the subscription and the key are its ways.
  expect(tabs(view)).toEqual(["Overview", "Settings"]);
  expect(words(view.element, ".pl-way-list strong")).toEqual(["Subscription", "API key"]);
  expect(view.element.querySelector("#way-account .pl-way-act button")!.textContent).toBe("Sign in to ChatGPT");
  document.body.replaceChildren();
  // Signed in, its models come through the subscription: still none the balance pays for.
  const signed = world({ features: SERVED_ONLY, available: [m3, { provider: "openai", id: "gpt-6-sol", name: "GPT-6 Sol", via: "ChatGPT" }] });
  await opened(signed.view, "settings");
  expect(words(signed.view.element, ".pl-way-list strong")).toEqual(["Subscription", "API key"]);
});

it("counts on the Models tab the models a sign-in brings, read again as it lands", async () => {
  const { view } = world({ available: [m3], signedIn: false, signsInTo: [m3, { provider: "openai", id: "gpt-6-sol", name: "GPT-6 Sol", via: "ChatGPT" }] });
  await opened(view, "settings");
  expect(tabs(view)).toEqual(["Overview", "Settings"]);
  view.element.querySelector<HTMLButtonElement>("#way-account .pl-way-act button")!.click();
  await settle();
  expect(tabs(view)).toEqual(["Overview", "Models · 1", "Settings"]);
});

it("draws Yours' Models section, where model makers are not plugins, with the link to where the chat's vendors are chosen", async () => {
  const { view } = world({ features: SERVED_ONLY });
  await view.load();
  view.show({ kind: "home", view: "yours", filter: "all" });
  const shelf = view.element.querySelector("section.pl-shelf#models")!;
  expect(all(shelf, "a.pl-row-link").map((one) => one.getAttribute("href"))).toEqual(["#/plugins/p/jev", "#/plugins/p/openai", "#/plugins/p/minimax"]);
  const link = shelf.querySelector("a.pl-showall")!;
  expect([link.getAttribute("href"), link.textContent]).toEqual(["#/plugins/models", "Models in chat ›"]);
});

it("draws no control in a vendor's header where model makers are not plugins, and Installed with ⋮ where they are", async () => {
  const first = world({ features: SERVED_ONLY });
  await opened(first.view);
  expect(first.view.element.querySelector("h1")!.textContent).toBe("GPT");
  expect(all(first.view.element, ".pl-head-tools > *")).toHaveLength(0);
  document.body.replaceChildren();
  const every = world({ features: EVERYTHING });
  await opened(every.view);
  // Where they are, the head says Installed and holds ⋮, and no switch: a vendor is on while it is installed (sheet 3c).
  expect([every.view.element.querySelector(".pl-head-tools [role=switch]"), every.view.element.querySelector(".pl-head-tools .pl-state")?.textContent, every.view.element.querySelector(".pl-head-tools .pl-more") !== null]).toEqual([null, "Installed", true]);
});

it("draws at the first release a maker's ⋮, its series and its order of ways, and no Usage tab and no image model", async () => {
  const first = world({ series: bySeries(), ownKey: true });
  await opened(first.view, "models");
  expect(first.view.element.querySelector(".pl-head-tools .pl-more")).not.toBeNull();
  expect(first.view.element.querySelector(".pl-series")).not.toBeNull();
  expect(tabs(first.view)).not.toContain("Usage");
  expect(first.view.element.textContent).not.toContain("GPT Image 2");
  await opened(first.view, "settings");
  expect(first.view.element.textContent).toContain("Order of use");
});

it("draws no Usage tab on a vendor's page, at the first release or with every feature on", async () => {
  const first = world();
  await opened(first.view, "usage");
  expect(tabs(first.view)).toEqual(["Overview", "Models · 2", "Settings"]);
  document.body.replaceChildren();
  const every = world({ features: EVERYTHING });
  await opened(every.view, "usage");
  expect(tabs(every.view)).not.toContain("Usage");
  expect(every.view.element.querySelector(".pl-media")).toBeNull();
});

it("draws the Subscription way at the first release where the platform signs in to it, on the Overview and in Settings", async () => {
  const first = world();
  await opened(first.view);
  expect(words(first.view.element, ".pl-way-list strong")).toEqual(["Balance", "Subscription", "API key"]);
  await opened(first.view, "settings");
  expect(words(first.view.element, ".pl-way-list strong")).toEqual(["Balance", "Subscription", "API key"]);
  document.body.replaceChildren();
  const every = world({ features: EVERYTHING });
  await opened(every.view);
  expect(words(every.view.element, ".pl-way-list strong")).toContain("Subscription");
});

it("draws no tick on the Models tab where model makers are not plugins", async () => {
  const first = world({ features: SERVED_ONLY });
  await opened(first.view, "models");
  expect(words(first.view.element, ".pl-model-name strong")).toEqual(expect.arrayContaining(["GPT-6 Sol", "GPT-6 Luna"]));
  expect(all(first.view.element, "input[type=checkbox]")).toHaveLength(0);
  document.body.replaceChildren();
  const every = world({ features: EVERYTHING });
  await opened(every.view, "models");
  expect(all(every.view.element, "input[type=checkbox]").length).toBeGreaterThan(0);
});

it("draws no image, video or audio model on the Models tab, at the first release or with every feature on", async () => {
  for (const features of [FIRST_RELEASE, EVERYTHING]) {
    const { view } = world({ features });
    await opened(view, "models");
    expect([view.element.querySelector(".pl-media"), view.element.textContent?.includes("Images, video and audio")]).toEqual([null, false]);
    document.body.replaceChildren();
  }
});

it("says at the first release that no model is chosen for chat as a plain sentence, the rank the series' branch says it at", async () => {
  const first = world({ chatOn: "minimax" });
  await opened(first.view);
  const line = all(first.view.element, ".pl-main section p").find((one) => one.textContent === "No model of OpenAI's is chosen for chat.")!;
  expect([line.tagName, line.className]).toEqual(["P", ""]);
});

it("draws in Settings, where model makers are not plugins, no Use or Stop on the balance and no order of ways", async () => {
  const first = world({ features: SERVED_ONLY, ownKey: true });
  await opened(first.view, "settings");
  expect(all(first.view.element, "#way-platform button")).toHaveLength(0);
  expect(first.view.element.querySelector("#way-platform")!.textContent).toContain("Connected");
  expect(first.view.element.querySelector(".pl-up")).toBeNull();
  expect(first.view.element.textContent).not.toContain("Order of use");
  document.body.replaceChildren();
  const every = world({ features: EVERYTHING, ownKey: true });
  await opened(every.view, "settings");
  expect(all(every.view.element, "#way-platform button")).toHaveLength(1);
  expect(every.view.element.textContent).toContain("Order of use");
});

it("saves and forgets a person's own key from the vendor's Settings, on the key's route alone where model makers are not plugins", async () => {
  const { view, calls } = world({ features: SERVED_ONLY });
  await opened(view, "settings");
  const field = view.element.querySelector<HTMLInputElement>("#way-key input")!;
  field.value = "sk-test";
  const shown = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
  // The drawing moves the row down, as the line it puts above it does.
  let drawn = 0;
  const place = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ top: drawn++ === 0 ? 765 : 800 }) as DOMRect);
  view.element.querySelector<HTMLButtonElement>("#way-key button")!.focus();
  view.element.querySelector<HTMLButtonElement>("#way-key button")!.click();
  await settle(); await settle();
  expect(calls).toEqual(['saveOwnKey("openai","sk-test")']);
  // A line drawn above the row can push it out of view: the row is brought back as little as it takes, so the ring on its word is whole.
  expect(shown.mock.contexts.at(-1)).toBe(view.element.querySelector("#way-key"));
  expect(shown).toHaveBeenLastCalledWith({ block: "nearest" });
  shown.mockRestore(); place.mockRestore();
  expect(view.element.querySelector("#way-key")!.textContent).toContain("Key saved.");
  // The keyboard Save had is on the word that the key is saved, not on Remove key: the same key pressed twice removes nothing.
  expect([document.activeElement?.tagName, document.activeElement?.textContent]).toEqual(["SPAN", "Key saved."]);
  (document.activeElement as HTMLElement).click();
  await settle();
  expect(calls).toEqual(['saveOwnKey("openai","sk-test")']);
  // A control the drawing leaves where it was scrolls nothing, wherever the reader has scrolled.
  const still = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
  const kept = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ top: 900 }) as DOMRect);
  view.element.querySelector<HTMLButtonElement>("#way-key button")!.focus();
  view.element.querySelector<HTMLButtonElement>("#way-key button")!.click();
  await settle(); await settle();
  expect(still).not.toHaveBeenCalled();
  still.mockRestore(); kept.mockRestore();
  expect(calls).toEqual(['saveOwnKey("openai","sk-test")', 'removeOwnKey("openai")']);
  expect(document.activeElement).toBe(view.element.querySelector("#way-key input"));
});

it("works a key row from the keyboard as the signed page does: Enter saves, the row's word is the one word, and Remove key goes back to the field", async () => {
  for (const row of ["way-key"]) {
    const { view, calls } = world({ features: EVERYTHING, hostKey: false });
    await opened(view, "settings");
    const provider = "openai";
    const field = view.element.querySelector<HTMLInputElement>(`#${row} input`)!;
    expect(field.getAttribute("data-focus")).toBe(`${row}-field`);
    field.value = "sk-typed";
    field.focus();
    // Enter while a character is still being composed is the input method's, and saves nothing.
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }));
    await settle();
    expect(calls).toEqual([]);
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await settle(); await settle();
    const keyed = (): readonly string[] => calls.filter((call) => call.includes("OwnKey"));
    expect(keyed()).toEqual([`saveOwnKey("${provider}","sk-typed")`]);
    expect([document.activeElement?.tagName, document.activeElement?.textContent]).toEqual(["SPAN", "Key saved."]);
    // Nothing above the tabs says it again: the row's word is the one word.
    expect(view.element.querySelector(".pl-said")).toBeNull();
    expect(view.element.textContent!.split("Key saved.").length - 1).toBe(1);
    view.element.querySelector<HTMLButtonElement>(`[data-focus=${row === "way-key" ? "way-forget" : `${row}-forget`}]`)!.click();
    await settle(); await settle();
    expect(keyed().at(-1)).toBe(`removeOwnKey("${provider}")`);
    expect(document.activeElement).toBe(view.element.querySelector(`#${row} input`));
    document.body.replaceChildren();
  }
});

it("says in the key's row that a key comes first where Save is pressed on an empty field, keeps the keyboard in the field and saves nothing", async () => {
  for (const language of ["en", "zh"] as const) {
    const { view, calls } = world({ language });
    await opened(view, "settings");
    const field = view.element.querySelector<HTMLInputElement>("#way-key input")!;
    const note = view.element.querySelector("#way-key .pl-field-note")!;
    expect([note.textContent, note.getAttribute("role")]).toEqual(["", "status"]);
    field.value = "   ";
    view.element.querySelector<HTMLButtonElement>("#way-key button")!.click();
    await settle();
    expect(calls).toEqual([]);
    expect(note.textContent).toBe(text(language, "pl.st.keyEmpty"));
    expect(note.isConnected).toBe(true);
    expect(document.activeElement).toBe(field);
    document.body.replaceChildren();
  }
});

it("ticks, once a key is saved or a sign-in lands, the series the vendor's row on Models in chat lists, up to five with a version, and none where one is already ticked", async () => {
  const version = (id: string) => ({ id, name: id, input: 100_000, output: 500_000 });
  const many = { openai: [{ name: "GPT Bare", inChat: false, versions: [] }, ...["A", "B", "C", "D", "E", "F"].map((one) => ({ name: `GPT ${one}`, inChat: false, versions: [version(`gpt-${one}`)] }))] };
  // One write of the record, as 加入对话 makes, so the page draws the tick as soon as it is answered (one setSeries per series drew it after the fifth).
  const ticks = (calls: readonly string[]): readonly string[] => calls.filter((call) => call.startsWith("setSeries") || call.startsWith("addToChat"));
  const five = [`addToChat("openai",${JSON.stringify(["A", "B", "C", "D", "E"].map((one) => `GPT ${one}`))})`];
  const keyed = world({ features: EVERYTHING, series: many });
  await opened(keyed.view, "settings");
  keyed.view.element.querySelector<HTMLInputElement>("#way-key input")!.value = "sk-test";
  keyed.view.element.querySelector<HTMLButtonElement>("#way-key button")!.click();
  await settle(); await settle();
  expect(ticks(keyed.calls)).toEqual(five);
  document.body.replaceChildren();
  const signed = world({ features: EVERYTHING, series: many, signedIn: false });
  await opened(signed.view, "settings");
  signed.view.element.querySelector<HTMLButtonElement>("#way-account .pl-way-act button")!.click();
  await settle(); await settle();
  expect(signed.calls.some((call) => call.startsWith('signIn("openai"'))).toBe(true);
  expect(ticks(signed.calls)).toEqual(five);
  document.body.replaceChildren();
  const held = world({ features: EVERYTHING, series: bySeries() });
  await opened(held.view, "settings");
  held.view.element.querySelector<HTMLInputElement>("#way-key input")!.value = "sk-test";
  held.view.element.querySelector<HTMLButtonElement>("#way-key button")!.click();
  await settle(); await settle();
  expect(held.calls).toContain('saveOwnKey("openai","sk-test")');
  expect(ticks(held.calls)).toEqual([]);
});

it("gives the keyboard to the arriving page's title when a Plugins page is reached from another, by a link or a typed address, between Discover and Yours, and through the load that draws it again; a record's tab pressed keeps it", async () => {
  const { view } = world({ features: EVERYTHING, series: bySeries() });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all" });
  await settle();
  const title = (): readonly [string | undefined, string | null | undefined] => [document.activeElement?.tagName, document.activeElement?.textContent];
  expect(title()).toEqual(["H1", "Plugins"]);
  // Discover and Yours are two pages: the view pressed hands the keyboard to the title.
  view.element.querySelector<HTMLElement>(".pl-view[href$='yours/all']")!.focus();
  view.show({ kind: "home", view: "yours", filter: "all" });
  await settle();
  expect(title()).toEqual(["H1", "Plugins"]);
  view.show({ kind: "plugin", id: "openai" } as never);
  await settle();
  expect(title()).toEqual(["H1", "GPT"]);
  const settings = view.element.querySelector<HTMLElement>(".pl-tab[href$='/settings']")!;
  settings.focus();
  // A tab of the same record is the same page: the keyboard stays on the tab, drawn anew, and through a load's redraw.
  view.show({ kind: "plugin", id: "openai", tab: "settings" } as never);
  await settle();
  expect([document.activeElement?.getAttribute("data-focus"), document.activeElement?.getAttribute("aria-selected")]).toEqual(["tab settings", "true"]);
  await view.load();
  view.show({ kind: "plugin", id: "openai", tab: "settings" } as never);
  await settle();
  expect(document.activeElement?.getAttribute("data-focus")).toBe("tab settings");
  // The chat or Settings was between: an address typed there lands on the page's title as a link does, and the app's load after the
  // arrival, which draws the record again, leaves it there.
  view.leave();
  (document.activeElement as HTMLElement | null)?.blur();
  view.show({ kind: "plugin", id: "openai", tab: "settings" } as never);
  await settle();
  expect(title()).toEqual(["H1", "GPT"]);
  await view.load();
  view.show({ kind: "plugin", id: "openai", tab: "settings" } as never);
  await settle();
  expect(title()).toEqual(["H1", "GPT"]);
});

it("keeps the arriving title's focus without the keyboard's ring after a pointer's press, and draws the ring after a key's", async () => {
  const { view } = world({ features: EVERYTHING, series: bySeries() });
  await view.load();
  const arrive = async (press: "pointerdown" | "keydown", to: { readonly kind: string; readonly id?: string }): Promise<readonly [string | undefined, boolean | undefined]> => {
    view.leave();
    (document.activeElement as HTMLElement | null)?.blur();
    document.dispatchEvent(new Event(press, { bubbles: true }));
    view.show(to as never);
    await settle();
    return [document.activeElement?.tagName, document.activeElement?.hasAttribute("data-pointed")];
  };
  expect(await arrive("pointerdown", { kind: "plugin", id: "openai" })).toEqual(["H1", true]);
  expect(await arrive("keydown", { kind: "plugin", id: "openai" })).toEqual(["H1", false]);
  expect(await arrive("pointerdown", { kind: "home", view: "discover", filter: "all" } as never)).toEqual(["H1", true]);
  // Leaving the title takes its quiet mark with it, so the next focus there is drawn by what brought it.
  const h1 = document.activeElement as HTMLElement;
  h1.blur();
  expect(h1.hasAttribute("data-pointed")).toBe(false);
  const css = readFileSync(join(process.cwd(), "src/web/site/app.css"), "utf8");
  expect(css).toMatch(/h1\[data-pointed\]:focus-visible \{ outline: none; \}/);
});

it("puts the balance last among a vendor's ways where Use is pressed with another way already connected", async () => {
  const { view, calls } = world({ features: EVERYTHING, ways: ["account"], signedIn: true });
  await opened(view, "settings");
  const use = view.element.querySelector<HTMLButtonElement>("#way-platform button")!;
  expect(use.textContent).toBe("Use");
  use.click();
  await settle(); await settle();
  expect(calls).toEqual(['setModelWays("openai",["account","platform"])']);
});

it("links a vendor's Overview and Settings to where the chat's vendors are chosen, at the first release and where a vendor is a plugin alike", async () => {
  for (const features of [FIRST_RELEASE, EVERYTHING]) {
    const { view } = world({ features });
    await opened(view);
    expect(all(view.element, ".pl-main p.quiet.pl-choose > a.pl-inline").map((one) => [one.getAttribute("href"), one.textContent])).toEqual([["#/plugins/models", "Models in chat ›"]]);
    // Under the ways, the list's last line.
    expect(view.element.querySelector(".pl-way-list")!.nextElementSibling).toBe(view.element.querySelector(".pl-choose"));
    await opened(view, "settings");
    // One control, drawn one way: the same link at the end of Settings as under the Overview's ways.
    expect(all(view.element, ".pl-tabbody > section.pl-setting:last-child > p.quiet.pl-choose > a.pl-inline").map((one) => [one.getAttribute("href"), one.textContent])).toEqual([["#/plugins/models", "Models in chat ›"]]);
    document.body.replaceChildren();
  }
});

it("says on a vendor's Overview, in the side card's How you pay, what its card says: the balance pays, at its first priced model's rate", async () => {
  const { view } = world();
  await opened(view);
  const side = view.element.querySelector(".pl-side")!;
  expect([words(side, "h2"), all(side, ".pl-part > p").map((one) => one.textContent)]).toEqual([["How you pay"], ["Answers from your balance", expect.stringMatching(/ per M tokens in \/ out$/)]]);
  expect(view.element.querySelector(".pl-main")!.contains(side)).toBe(false);
});

it("lists a vendor's ways on its Overview with the connected ones first, in the order cx uses them, and says the order in Settings alone", async () => {
  const { view } = world({ features: EVERYTHING, ways: ["account", "platform"] });
  await opened(view);
  expect(all(view.element, ".pl-way-list > li").map((row) => [row.querySelector("strong")!.textContent, row.querySelector(".pl-go")!.textContent])).toEqual([
    ["Subscription", "Connected ›"], ["Balance", "Connected ›"], ["API key", "Set up ›"]]);
  expect(view.element.textContent).not.toContain("cx uses");
  document.body.replaceChildren();
  // A subscription stored and not signed in is offered, not counted: it keeps the record's place.
  const waiting = world({ features: EVERYTHING, ways: ["account", "platform"], signedIn: false });
  await opened(waiting.view);
  expect(words(waiting.view.element, ".pl-way-list strong")).toEqual(["Balance", "Subscription", "API key"]);
});

it("draws a vendor's Settings as the ways with the order's sentence under their heading, each way's state and its one control, then the order as a numbered list", async () => {
  const { view, calls } = world({ features: EVERYTHING, ways: ["account", "platform"] });
  await opened(view, "settings");
  const ways = view.element.querySelector(".pl-tabbody > section.pl-setting")!;
  expect([...ways.children].map((part) => `${part.tagName}:${part.className}`)).toEqual(["H2:", "P:", "UL:pl-list pl-way-list"]);
  expect(ways.querySelector("p")!.textContent).toBe("cx uses your ChatGPT subscription, then your balance.");
  // Settings keeps the record's order, whatever the order of use.
  const act = (way: string): readonly string[] => [...view.element.querySelector(`#way-${way} .pl-way-act`)!.children].map((part) => `${part.tagName.toLowerCase()}${part.className === "" ? "" : `.${part.className}`}:${part.textContent}`);
  expect(words(view.element, ".pl-way-list strong")).toEqual(["Balance", "Subscription", "API key"]);
  expect(act("platform")).toEqual(["span.quiet:Connected", "button:Stop"]);
  expect(act("account")).toEqual(["span.quiet:Signed in.", "button:Sign out"]);
  expect(act("key")).toEqual(["input.pl-key:", "button.primary:Save", "p.quiet pl-field-note:"]);
  expect(view.element.querySelector("#way-key input")!.getAttribute("aria-label")).toBe("Paste your OpenAI API key");
  expect(view.element.querySelector("#way-platform .pl-row-text > .quiet")!.textContent).toBe("Paid from your balance.");
  const order = all(view.element, ".pl-tabbody > section.pl-setting")[1]!;
  expect(order.querySelector("h2")!.textContent).toBe("Order of use");
  expect(all(order, "ol.pl-list.pl-order > li > div.pl-row").map((row) => [...row.children].map((part) => `${part.tagName.toLowerCase()}.${part.className}:${part.textContent}`))).toEqual([
    ["span.pl-order-n:1", "span.pl-row-text:Subscription"], ["span.pl-order-n:2", "span.pl-row-text:Balance", "button.pl-up:↑"]]);
  expect(all(order, ".pl-row-text > strong")).toHaveLength(2);
  const up = order.querySelector<HTMLButtonElement>(".pl-up")!;
  expect([up.getAttribute("aria-label"), up.title]).toEqual(["Move up: Balance", "Move up"]);
  up.click();
  await settle();
  expect(calls).toEqual(['setModelWays("openai",["platform","account"])']);
  view.element.querySelector<HTMLButtonElement>("#way-platform button")!.click();
  await settle();
  expect(calls.at(-1)).toBe('setModelWays("openai",["account"])');
  view.element.querySelector<HTMLButtonElement>("#way-account button")!.click();
  await settle();
  expect(calls.slice(-2)).toEqual(['signOut("openai")', 'setModelWays("openai",["platform"])']);
});

it("counts no host's key as a way to the maker: an OpenRouter key held leaves GPT on its balance, and the maker's own key is said under its name", async () => {
  const { view } = world({ features: EVERYTHING, ways: ["key", "platform"], hostKey: true });
  await opened(view, "settings");
  // The balance is the one way, its row saying so: no sentence above the rows repeats it.
  expect([view.element.querySelector("#way-platform")!.textContent, view.element.textContent!.includes("cx uses")]).toEqual([expect.stringContaining("Connected"), false]);
  expect(view.element.textContent).not.toContain("OpenRouter");
  document.body.replaceChildren();
  const own = world({ features: EVERYTHING, ways: ["key", "platform"], ownKey: true, hostKey: true });
  await opened(own.view, "settings");
  expect(own.view.element.querySelector(".pl-tabbody > section.pl-setting > p")!.textContent).toBe("cx uses your OpenAI API key, then your balance.");
  expect(words(own.view.element, "ol.pl-order .pl-row-text > strong")).toEqual(["API key", "Balance"]);
});

it("offers a way that is not connected with the page's one filled button, and says no order where none or one is connected", async () => {
  const none = world({ features: EVERYTHING, ways: [], signedIn: false });
  await opened(none.view, "settings");
  expect(all(none.view.element, ".pl-way-act > *").map((part) => `${part.tagName.toLowerCase()}.${part.className}:${part.textContent}`)).toEqual([
    "button.primary:Use", "button.primary:Sign in to ChatGPT", "input.pl-key:", "button.primary:Save", "p.quiet pl-field-note:"]);
  expect([...none.view.element.querySelector(".pl-tabbody > section.pl-setting")!.children].map((part) => part.tagName)).toEqual(["H2", "UL"]);
  // The button names the subscription as the row's own sentence does: by the catalogue's name, in Chinese too.
  expect(none.view.element.querySelector("#way-account .quiet")!.textContent).toBe("Counts against your ChatGPT subscription.");
  const zh = world({ features: EVERYTHING, ways: [], signedIn: false, language: "zh" });
  await opened(zh.view, "settings");
  expect([zh.view.element.querySelector("#way-account button")!.textContent, zh.view.element.querySelector("#way-account .quiet")!.textContent]).toEqual(["登录 ChatGPT", "计入你的 ChatGPT 订阅用量。"]);
  zh.view.element.remove();
  expect(none.view.element.querySelector(".pl-order")).toBeNull();
  none.view.element.querySelector<HTMLButtonElement>("#way-platform button")!.click();
  await settle();
  expect(none.calls).toEqual(['setModelWays("openai",["platform"])']);
  document.body.replaceChildren();
  const one = world({ features: EVERYTHING, ways: ["platform"], signedIn: false });
  await opened(one.view, "settings");
  expect(one.view.element.textContent).not.toContain("cx uses");
  expect(one.view.element.querySelector(".pl-order")).toBeNull();
  document.body.replaceChildren();
  const off = world({ features: EVERYTHING, ways: ["platform"], enabled: false });
  await opened(off.view, "settings");
  expect(off.view.element.querySelector(".pl-tabbody > section.pl-setting > p")!.textContent).toBe("GPT is off.");
  document.body.replaceChildren();
  const bare = world({ features: EVERYTHING, ways: [], enabled: false });
  await opened(bare.view, "settings");
  expect(bare.view.element.querySelector(".pl-way-list")!.previousElementSibling!.tagName).toBe("H2");
});

it("keeps the line that a model with no way is not connected on its own Settings, as round 27 keeps it on every plugin's Settings but SP-API's", async () => {
  for (const language of ["en", "zh"] as const) {
    const { view } = world({ features: EVERYTHING, ways: [], language });
    await opened(view, "settings");
    expect(view.element.querySelector(".pl-needs span")?.textContent).toBe(text(language, "pl.need.connect"));
    document.body.replaceChildren();
  }
});

it("says nothing of a plan where model makers are not plugins", async () => {
  const { view } = world({ features: SERVED_ONLY });
  await opened(view, "settings");
  expect(view.element.querySelector("#way-platform .pl-row-text > .quiet")!.textContent).toBe("Paid from your balance.");
});

it("says nothing of a plan to a member, or where the account's read did not answer, and keeps every price", async () => {
  for (const account of ["member", undefined] as const) {
    const { view } = world({ ...(account === undefined ? {} : { account }), ways: ["account", "platform"] });
    await opened(view);
    expect([view.element.querySelector(".pl-account"), words(view.element, ".pl-tab").some((tab) => tab.startsWith("Models"))]).toEqual([null, true]);
    expect(words(view.element, "th")).toContain("In / out, per M tokens");
    view.show({ kind: "plugin", id: "openai", tab: "settings" } as never);
    await settle();
    expect(view.element.querySelector("#way-platform .pl-row-text > .quiet")!.textContent).toBe("Paid from your balance.");
    document.body.replaceChildren();
  }
});

it("draws a trial's model plugin by what the platform serves it, not by what its balance holds: no line of its own, the Balance row as a member's, and the balance opening the vendor, its Models tab and its prices only where the served models hold one of its own", async () => {
  for (const language of ["en", "zh"] as const) {
    // The balance holds money that may pay a model other than Default, but the platform serves the trial Default alone: GPT is not opened.
    const holding = world({ account: "trial", ways: ["platform"], signedIn: false, modelMoney: 5, language });
    await opened(holding.view);
    expect(holding.view.element.querySelector(".pl-account")).toBeNull();
    expect(holding.view.element.textContent).not.toMatch(language === "en" ? /During the trial/ : /试用期间/);
    expect(words(holding.view.element, ".pl-tab").some((tab) => tab.startsWith(language === "en" ? "Models" : "模型"))).toBe(false);
    expect(words(holding.view.element, "th")).not.toContain(language === "en" ? "In / out, per M tokens" : "输入 / 输出，每百万 token");
    holding.view.show({ kind: "plugin", id: "openai", tab: "settings" } as never);
    await settle();
    expect(holding.view.element.querySelector("#way-platform .pl-row-text > .quiet")!.textContent).toBe(language === "en" ? "Paid from your balance." : "从你的余额扣费。");
    expect(holding.view.element.textContent).not.toMatch(language === "en" ? /During the trial/ : /试用期间/);
    expect([...holding.view.element.querySelector(".pl-tabbody > section.pl-setting")!.children].map((part) => part.tagName)).toEqual(["H2", "UL"]);
    document.body.replaceChildren();
  }
  // The platform serves the trial one of GPT's models though its balance holds nothing for a model other than Default: the balance opens
  // GPT, and only that model carries a price.
  const served = world({ account: "trial", ways: ["platform"], signedIn: false, platformServed: [{ provider: "openai", id: "gpt-6-sol" }], available: [sol, { provider: "openai", id: "gpt-6-luna", name: "GPT-6 Luna" }, m3] });
  await opened(served.view, "models");
  expect(words(served.view.element, ".pl-tab").some((tab) => tab.startsWith("Models"))).toBe(true);
  const priceOf = (name: string): string => [...served.view.element.querySelectorAll("table.pl-models tbody tr")].find((row) => row.querySelector(".pl-model-name")?.textContent === name)!.lastElementChild!.textContent!;
  expect(words(served.view.element, "table.pl-models th")).toContain("In / out, per M tokens");
  expect([priceOf("GPT-6 Sol") !== "", priceOf("GPT-6 Luna")]).toEqual([true, ""]);
  document.body.replaceChildren();
  // Signed in, the subscription opens its models: the Models tab is back, the order leaves the balance out, and no price is drawn.
  const signed = world({ account: "trial", features: EVERYTHING, ways: ["account", "platform"] });
  await opened(signed.view);
  expect(words(signed.view.element, ".pl-tab").some((tab) => tab.startsWith("Models"))).toBe(true);
  expect(words(signed.view.element, "th")).not.toContain("In / out, per M tokens");
  signed.view.show({ kind: "plugin", id: "openai", tab: "settings" } as never);
  await settle();
  expect(signed.view.element.querySelector(".pl-tabbody > section.pl-setting > p")!.textContent).toBe("cx uses your ChatGPT subscription.");
});

it("draws a trial whose served models could not be read as a member's: the balance opens the vendor, its Models tab and every price", async () => {
  for (const language of ["en", "zh"] as const) {
    const { view } = world({ account: "trial", ways: ["platform"], signedIn: false, platformServed: "unread", available: [sol, { provider: "openai", id: "gpt-6-luna", name: "GPT-6 Luna" }, m3], language });
    await opened(view, "models");
    expect(view.element.querySelector(".pl-account")).toBeNull();
    expect(words(view.element, ".pl-tab").some((tab) => tab.startsWith(language === "en" ? "Models" : "模型"))).toBe(true);
    expect(words(view.element, "table.pl-models th")).toContain(language === "en" ? "In / out, per M tokens" : "输入 / 输出，每百万 token");
    const prices = [...view.element.querySelectorAll("table.pl-models tbody tr")].map((row) => row.lastElementChild!.textContent);
    expect(prices.length).toBeGreaterThan(1);
    expect(prices.filter((price) => price === "")).toEqual([]);
    document.body.replaceChildren();
  }
});

it("draws a free account's model plugin as a member's: no line under its title, its Models tab and its order, and its sign-in and key still there", async () => {
  const drawn = async (account: "free" | "member"): Promise<readonly unknown[]> => {
    const { view } = world({ account, features: EVERYTHING, ways: ["account", "platform"] });
    await opened(view, undefined, "openai");
    const said = [view.element.querySelector(".pl-account"), words(view.element, ".pl-tab")];
    document.body.replaceChildren();
    return said;
  };
  const free = await drawn("free");
  expect(free).toEqual(await drawn("member"));
  expect(free[0]).toBeNull();
  const { view } = world({ account: "free", features: EVERYTHING, ways: ["account", "platform"] });
  await opened(view, "settings");
  expect(words(view.element, ".pl-way-list strong")).toEqual(["Balance", "Subscription", "API key"]);
});

it("keeps Settings on a vendor that is not installed, drawn as installed under the line with every control disabled and no Install of its own, and Settings on a data source that is not", async () => {
  const { view, calls } = world({ features: EVERYTHING, series: { ...bySeries(), google: [{ name: "Gemini 3.5", inChat: false, versions: [{ id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", input: 300_000, output: 2_500_000 }] }] }, providers: [{ id: "google", name: "Google", platformKey: true, ownKey: false, models: [], rates: [] }] });
  await opened(view, "settings", "google");
  const tab = view.element.querySelector(".pl-tabbody")!;
  expect([tab.firstElementChild!.id, tab.firstElementChild!.textContent, tab.textContent!.includes("Not installed.")]).toEqual(["pl-after-install", "Install to set these up.", false]);
  // The balance is no way before install: its row names it and who bills it, with no press; the key's field and Save wait.
  expect(words(tab, ".pl-way-list strong")).toEqual(["Balance", "API key"]);
  expect(all(tab, "input, button").map((one) => [one.getAttribute("data-focus"), (one as HTMLInputElement).disabled, one.getAttribute("aria-describedby")])).toEqual([["way-key-field", true, "pl-after-install"], ["way-key", true, "pl-after-install"]]);
  expect([(tab.querySelector("input.pl-key") as HTMLInputElement).placeholder, all(view.element, "button").filter((one) => one.textContent === "+ Install").length, all(tab, "a.pl-inline").length]).toEqual(["Paste your Google API key", 1, 1]);
  all(view.element, "button").find((one) => one.textContent === "+ Install")!.dispatchEvent(new MouseEvent("click"));
  await settle();
  document.querySelector<HTMLButtonElement>("dialog.pl-card-dialog button.primary")?.click();
  await settle();
  expect(calls).toEqual(['installModel("google",true)']);
  await opened(view, undefined, "keepa");
  expect(tabs(view)).toEqual(["Overview", "Plugins it uses · 3", "Settings"]);
});

it("keeps a vendor's Remove key and Sign out live before install, where the account holds them, and working, while every change waits", async () => {
  const { view, calls } = world({ features: EVERYTHING, held: false, ownKey: true, signedIn: true });
  await opened(view, "settings");
  const tab = view.element.querySelector(".pl-tabbody")!;
  expect(tab.firstElementChild!.textContent).toBe("Install to set these up.");
  expect(all(tab, "button").map((one) => [one.getAttribute("data-focus"), (one as HTMLButtonElement).disabled])).toEqual([["way-sign-out", false], ["way-forget", false]]);
  await (all(tab, "button").find((one) => one.getAttribute("data-focus") === "way-forget") as HTMLButtonElement).click();
  await settle();
  expect(calls).toContain('removeOwnKey("openai")');
  const out = all(view.element, ".pl-tabbody button").find((one) => one.getAttribute("data-focus") === "way-sign-out") as HTMLButtonElement;
  out.click();
  await settle();
  // The sign-in is gone: its row offers the sign-in again, waiting for the install like every change.
  expect([calls.filter((one) => one.startsWith("signOut(")), all(view.element, ".pl-tabbody button").some((one) => one.getAttribute("data-focus") === "way-sign-out")]).toEqual([['signOut("openai")'], false]);
});

it("draws a vendor's ways as one bordered list, a way's name over its sentence and its state at the right, and a header line that says who made it, as its card does", async () => {
  const first = world();
  await opened(first.view);
  expect(first.view.element.querySelector(".pl-head-text p")!.textContent).toMatch(/^by ComChatX( · |$)/);
  const rows = all(first.view.element, "ul.pl-list.pl-way-list > li > a.pl-row");
  expect(rows.map((row) => [...row.children].map((part) => part.className))).toEqual([["pl-row-text", "pl-go"], ["pl-row-text", "pl-go"], ["pl-row-text", "pl-go"]]);
  expect(rows.map((row) => [...row.querySelector(".pl-row-text")!.children].map((part) => `${part.tagName}:${part.textContent}`))).toEqual([
    ["STRONG:Balance", "SPAN:Paid from your balance."], ["STRONG:Subscription", "SPAN:Counts against your ChatGPT subscription."], ["STRONG:API key", "SPAN:OpenAI bills your account."]]);
  expect(rows.map((row) => row.getAttribute("href"))).toEqual(["#/plugins/p/openai/settings", "#/plugins/p/openai/settings", "#/plugins/p/openai/settings"]);
});

const solNow = { id: "gpt-6-sol", name: "GPT-6 Sol", input: 2_000_000, output: 10_000_000 };
const solWas = { id: "gpt-5.5-sol", name: "GPT-5.5 Sol", input: 2_500_000, output: 12_000_000 };
const terra = { name: "GPT Terra", inChat: false, versions: [{ id: "gpt-6-terra", name: "GPT-6 Terra", input: 1_000_000, output: 6_000_000 }] };
/** OpenAI's series as a platform that lists them would answer: one in chat with an earlier version, two not ticked. */
const bySeries = (sol: { pinned?: string } = {}) => ({
  openai: [
    { name: "GPT Sol", inChat: true, ...sol, versions: [solNow, solWas] },
    { name: "GPT Luna", inChat: false, versions: [{ id: "gpt-6-luna", name: "GPT-6 Luna", input: 100_000, output: 500_000 }] },
    terra,
  ],
  "z-ai": [{ name: "GLM-5", inChat: false, versions: [{ id: "glm-5", name: "GLM-5", input: 600_000, output: 2_200_000 }] }],
});
const cells = (row: Element): readonly string[] => [...row.children].map((cell) => cell.textContent ?? "");
const seriesRows = (view: PluginsPage): readonly Element[] => all(view.element, ".pl-series tbody tr:not(.pl-version)");

it("lists on an installed vendor's Overview what it puts in chat today, as the card does, and says what it waits for in the Models in chat page's words while it puts nothing there", async () => {
  const inChat = (view: PluginsPage): Element => all(view.element, ".pl-model-main section").find((one) => one.querySelector("h2")?.textContent === "Models you use in chat")!;
  const on = world({ features: EVERYTHING, series: bySeries() });
  await opened(on.view);
  expect([words(inChat(on.view), ".pl-models tbody .pl-mname"), inChat(on.view).querySelector("p:not(.quiet)")?.textContent]).toEqual([["GPT-6 Sol"], "All 3 models ›"]);
  const off = world({ features: EVERYTHING, series: bySeries(), enabled: false });
  await opened(off.view);
  expect([inChat(off.view).querySelector(".pl-models"), inChat(off.view).querySelector("p")!.textContent]).toEqual([null, "Its models show in chat once you turn it on."]);
  const unticked = world({ features: EVERYTHING, series: { openai: bySeries().openai.map((one) => ({ ...one, inChat: false })) } });
  await opened(unticked.view);
  expect(inChat(unticked.view).querySelector("p")!.textContent).toBe("No model of OpenAI's is chosen for chat.");
});

it("draws a vendor's chat models by series where the platform lists them so: the tick first, the series over the version it is on, then that version's price", async () => {
  const { view } = world({ features: EVERYTHING, series: bySeries() });
  await opened(view, "models");
  expect(words(view.element, ".pl-series thead th")).toEqual(["In chat", "Model", "In / out, per M tokens"]);
  expect(view.element.querySelector(".pl-series thead th")!.className).toBe("pl-tick");
  const rows = seriesRows(view);
  expect(rows.map((row) => [row.querySelector("td.pl-tick input[type=checkbox]") !== null, row.querySelector(".pl-mname strong")!.textContent, row.querySelector(".pl-msub")!.textContent, row.lastElementChild!.textContent]))
    .toEqual([[true, "GPT Sol", "GPT-6 Sol", "$2.00 / $10.00"], [true, "GPT Luna", "GPT-6 Luna", "$0.10 / $0.50"], [true, "GPT Terra", "GPT-6 Terra", "$1.00 / $6.00"]]);
  expect(rows.map((row) => row.querySelector<HTMLInputElement>("input")!.checked)).toEqual([true, false, false]);
  // A price is two figures, each kept whole.
  expect(words(rows[0]!.lastElementChild!, ".pl-nobreak")).toEqual(["$2.00 /", "$10.00"]);
  // A series wears no chip.
  expect(cells(rows[2]!).slice(2)).toEqual(["$1.00 / $6.00"]);
  expect(all(view.element, ".pl-series .pl-chip")).toEqual([]);
  expect(view.element.querySelector(".pl-tabbody")!.textContent).toContain("Ticked series show in chat and use the latest version by default; open a series to choose an earlier one.");
  expect(view.element.querySelector(".pl-credit")).toBeNull();
  // The tab counts each series once.
  expect(tabs(view)).toContain("Models · 3");
});

it("draws a vendor no key or sign-in reaches with its catalogue's series under the sentence that says what comes first, every tick shut and no price, before and after install", async () => {
  const listed = { openai: [
    { name: "GPT Sol", inChat: false, listed: true, versions: [{ id: "gpt-6-sol", name: "GPT-6 Sol", input: 0, output: 0, ways: ["key"] }] },
    { name: "GPT Luna", inChat: false, listed: true, versions: [{ id: "gpt-6-luna", name: "GPT-6 Luna", input: 0, output: 0, ways: ["key"] }] },
  ] };
  const shut = (view: PluginsPage): readonly boolean[] => seriesRows(view).map((row) => row.querySelector<HTMLInputElement>("td.pl-tick input")!.disabled);
  const sentences = (view: PluginsPage): readonly string[] => words(view.element, ".pl-tabbody > p.quiet");
  const keyless = { features: EVERYTHING, series: listed, ways: ["key"], signedIn: false, available: [] } as const;
  // Installed, reached by a key it does not hold: the list stands under the key's sentence, and a press on a tick writes nothing.
  const held = world(keyless);
  await opened(held.view, "models");
  expect([sentences(held.view), words(held.view.element, ".pl-series .pl-mname strong"), shut(held.view)])
    .toEqual([[text("en", "pl.mo.noKey")], ["GPT Sol", "GPT Luna"], [true, true]]);
  expect(words(held.view.element, ".pl-series thead th")).toEqual(["In chat", "Model"]);
  seriesRows(held.view)[0]!.querySelector<HTMLInputElement>("input")!.click();
  await settle();
  expect(held.calls.filter((call) => call.startsWith("setSeries") || call.startsWith("addToChat"))).toEqual([]);
  // Its Overview says the same in place of a model in chat.
  await opened(held.view);
  expect(words(held.view.element, ".pl-model-main section p")).toContain(text("en", "pl.mo.noKey"));
  // Not installed: the install's sentence, and the same list shut.
  const before = world({ ...keyless, held: false });
  await opened(before.view, "models");
  expect([sentences(before.view), shut(before.view)]).toEqual([[text("en", "pl.mt.install", { name: "GPT" })], [true, true]]);
  // A vendor a way reaches keeps its ticks open.
  const reached = world({ features: EVERYTHING, series: bySeries() });
  await opened(reached.view, "models");
  expect(shut(reached.view)).toEqual([false, false, false]);
});

it("says above a vendor's list, or in place of an empty one, what the seller does first, in each state, in both languages", async () => {
  const listed = { openai: [{ name: "GPT Sol", inChat: false, listed: true, versions: [{ id: "gpt-6-sol", name: "GPT-6 Sol", input: 0, output: 0, ways: ["account"] }] }] };
  // GPT as a vendor reached by a sign-in alone.
  const signInOnly = { ...CATALOGUE, plugins: CATALOGUE.plugins.map((one) => (one.id === "openai" ? { ...one, model: { ...one.model!, ways: ["account"] as const } } : one)) } as Catalogue;
  const line = async (over: Parameters<typeof world>[0], tab?: string, id = "openai"): Promise<readonly string[]> => {
    const { view } = world({ features: EVERYTHING, available: [], signedIn: false, ...over });
    await opened(view, tab, id);
    return [...words(view.element, ".pl-idle"), ...words(view.element, ".pl-tabbody > p.quiet")];
  };
  for (const language of ["en", "zh"] as const) {
    const say = (key: StringKey): string => text(language, key);
    // Installed, its list drawn: a key's way waits for the key, a sign-in's for the sign-in.
    expect(await line({ language, series: listed, ways: ["key"] }, "models")).toEqual([say("pl.mo.noKey")]);
    expect(await line({ language, series: listed, ways: ["account"], catalogue: signInOnly }, "models")).toEqual([say("pl.mo.signIn")]);
    // Its list still empty: installed and waiting for the sign-in, or not installed, as Radius is. A vendor the balance reaches that
    // serves nothing and is not installed has no page.
    expect(await line({ language, ways: ["account"], catalogue: signInOnly })).toEqual([say("pl.mo.signInFirst")]);
    expect(await line({ language }, undefined, "radius")).toEqual([say("pl.mo.installFirst")]);
    // Installed, reached by a key it does not hold, and its list empty, as Radius's is: entering the key is what lists it.
    expect(await line({ language, ways: ["key"] })).toEqual([say("pl.mo.keyFirst")]);
    const radius = world({ features: EVERYTHING, available: [], signedIn: false, language });
    await radius.backend.installModel("radius", true);
    await opened(radius.view, undefined, "radius");
    expect(words(radius.view.element, ".pl-idle")).toEqual([say("pl.mo.keyFirst")]);
    // Signed in, and the vendor lists nothing for it: no model today, as before.
    expect(await line({ language, ways: ["account"], catalogue: signInOnly, signedIn: true })).toEqual([say("pl.mo.idle")]);
  }
  const KEYS = ["pl.mo.noKey", "pl.mo.signIn", "pl.mo.installFirst", "pl.mo.signInFirst", "pl.mo.keyFirst"] as const;
  expect(KEYS.map((key) => text("zh", key)))
    .toEqual(["在「设置」中填入 API Key 后，才能选择这些模型。", "在「设置」中登录后，才能选择这些模型。", "安装后，这里会列出可用的模型。", "在「设置」中登录后，这里会列出可用的模型。", "在「设置」中填入 API Key 后，这里会列出可用的模型。"]);
  expect(KEYS.map((key) => text("en", key)))
    .toEqual(["Enter an API key in Settings to choose these models.", "Sign in from Settings to choose these models.", "Install it to see the models here.", "Sign in from Settings to see the models here.", "Enter an API key in Settings to see the models here."]);
});

it("draws no series and no version where the platform lists no series for the vendor: each served model with its price", async () => {
  const { view } = world({ features: SERVED_ONLY });
  await opened(view, "models");
  expect(view.element.querySelector(".pl-series")).toBeNull();
  expect(words(view.element, ".pl-models thead th")).toEqual(["Model", "In / out, per M tokens"]);
  expect(view.element.textContent).not.toContain("GPT Sol");
  expect(view.element.querySelector(".pl-news")).toBeNull();
  expect(view.element.querySelector(".pl-credit")).toBeNull();
  expect(tabs(view)).toContain("Models · 2");
});

it("draws a served model with its name and price alone, and nothing of a rating an older platform's record still carries", async () => {
  const rated = { ...sol, rating: { intelligenceIndex: 43, costPerTask: 0.37, speed: 95.4 }, ratedOn: "2026-10-26" };
  const luna = { provider: "openai", id: "gpt-6-luna", name: "GPT-6 Luna" };
  const { view } = world({ features: SERVED_ONLY, available: [rated, luna, m3] });
  await opened(view, "models");
  const headers = all(view.element, ".pl-models thead th").map((one) => one.textContent);
  const rows = all(view.element, ".pl-models tbody tr");
  expect(rows.map((row) => [...row.children].reduce((width, cell) => width + Number(cell.getAttribute("colspan") ?? "1"), 0))).toEqual(rows.map(() => headers.length));
  expect([all(view.element, ".pl-meter"), view.element.querySelector(".pl-credit")]).toEqual([[], null]);
  expect(view.element.textContent).not.toMatch(/Not rated yet|Artificial Analysis|tok\/s|\$0\.37/);
});

it("unfolds a series with more than one version to Always the latest and each version, and holds the series at the one chosen", async () => {
  const { view, calls } = world({ features: EVERYTHING, series: bySeries() });
  await opened(view, "models");
  // Only a series with an earlier version unfolds.
  expect(seriesRows(view).map((row) => row.querySelector(".pl-disclose") !== null)).toEqual([true, false, false]);
  const disclose = (): HTMLButtonElement => view.element.querySelector<HTMLButtonElement>(".pl-disclose")!;
  expect([disclose().getAttribute("aria-expanded"), disclose().querySelector(".pl-caret")!.textContent, all(view.element, "tr.pl-version").length]).toEqual(["false", "▾", 0]);
  disclose().click();
  expect([disclose().getAttribute("aria-expanded"), disclose().querySelector(".pl-caret")!.textContent]).toEqual(["true", "▴"]);
  const versions = all(view.element, "tr.pl-version");
  expect(versions.map((row) => row.querySelector(".pl-mname")!.textContent)).toEqual(["Always the latest", "GPT-6 Sol", "GPT-5.5 Sol"]);
  expect(versions[0]!.querySelector(".pl-msub")!.textContent).toBe("Latest: GPT-6 Sol. When OpenAI releases a new one, cx switches to it.");
  expect(versions[0]!.querySelector("td:not(.pl-tick)")!.getAttribute("colspan")).toBe("2");
  expect(versions[2]!.lastElementChild!.textContent).toBe("$2.50 / $12.00");
  const radios = all(view.element, "tr.pl-version input[type=radio]") as readonly HTMLInputElement[];
  expect(radios.map((one) => [one.checked, one.getAttribute("aria-label"), one.name])).toEqual([[true, "Always the latest", "v-openai:GPT Sol"], [false, "GPT-6 Sol", "v-openai:GPT Sol"], [false, "GPT-5.5 Sol", "v-openai:GPT Sol"]]);
  radios[2]!.dispatchEvent(new Event("change"));
  await settle();
  expect(calls).toEqual(['pinSeries("openai","GPT Sol","gpt-5.5-sol")']);
  // The series stays unfolded across the answer.
  expect(all(view.element, "tr.pl-version")).toHaveLength(3);
  (all(view.element, "tr.pl-version input[type=radio]")[0] as HTMLInputElement).dispatchEvent(new Event("change"));
  await settle();
  // Always the latest holds the series at no version: the record writes an absent word as nothing.
  expect(calls.at(-1)).toBe('pinSeries("openai","GPT Sol",)');
  disclose().click();
  expect(all(view.element, "tr.pl-version")).toHaveLength(0);
});

it("keeps a series unfolded across a change of tab on the same vendor, and folded where it was folded", async () => {
  const { view } = world({ features: EVERYTHING, series: bySeries() });
  await opened(view, "models");
  view.element.querySelector<HTMLButtonElement>(".pl-disclose")!.click();
  expect(all(view.element, "tr.pl-version")).toHaveLength(3);
  await opened(view, "overview");
  expect(view.element.querySelector(".pl-tabs [aria-selected=true]")!.textContent).toBe("Overview");
  await opened(view, "models");
  expect(all(view.element, "tr.pl-version")).toHaveLength(3);
  expect(view.element.querySelector(".pl-disclose")!.getAttribute("aria-expanded")).toBe("true");
  // Folded, it stays folded across the same change.
  view.element.querySelector<HTMLButtonElement>(".pl-disclose")!.click();
  await opened(view, "settings");
  await opened(view, "models");
  expect(all(view.element, "tr.pl-version")).toHaveLength(0);
});

it("finds a series by what the platform named it, whatever marks the name holds, so its controls work and keep the keyboard", async () => {
  const odd = 'GPT "Sol" \\ ]x';
  const { view, calls } = world({ features: EVERYTHING, series: { openai: [{ ...bySeries().openai[0]!, name: odd }] } });
  await opened(view, "models");
  const disclose = (): HTMLButtonElement => view.element.querySelector<HTMLButtonElement>(".pl-disclose")!;
  disclose().focus();
  disclose().click();
  expect(all(view.element, "tr.pl-version")).toHaveLength(3);
  expect(document.activeElement).toBe(disclose());
  const tick = (): HTMLInputElement => view.element.querySelector<HTMLInputElement>(".pl-series tbody tr:not(.pl-version) input[type=checkbox]")!;
  tick().focus();
  tick().checked = false;
  tick().dispatchEvent(new Event("change"));
  await settle(); await settle();
  expect(calls).toEqual([`setSeries("openai",${JSON.stringify(odd)},false)`]);
  expect(document.activeElement).toBe(tick());
  const radio = (): HTMLInputElement => all(view.element, "tr.pl-version input[type=radio]")[2] as HTMLInputElement;
  radio().focus();
  radio().dispatchEvent(new Event("change"));
  await settle(); await settle();
  expect(calls.at(-1)).toBe(`pinSeries("openai",${JSON.stringify(odd)},"gpt-5.5-sol")`);
  expect(document.activeElement).toBe(radio());
});

it("takes no press on a series' tick or version where the page's lists could not be read", async () => {
  const { view, calls } = world({ features: EVERYTHING, series: bySeries(), packagesUnread: true });
  await opened(view, "models");
  view.element.querySelector<HTMLButtonElement>(".pl-disclose")!.click();
  const inputs = all(view.element, ".pl-series input") as readonly HTMLInputElement[];
  expect(inputs.map((one) => one.type)).toEqual(["checkbox", "radio", "radio", "radio", "checkbox", "checkbox"]);
  expect(inputs.map((one) => one.disabled)).toEqual([true, true, true, true, true, true]);
  expect(calls).toEqual([]);
});

it("draws a series held at a version as that version, with its price and the Pinned chip, on the Models tab and the Overview", async () => {
  const { view } = world({ features: EVERYTHING, series: bySeries({ pinned: "gpt-5.5-sol" }) });
  await opened(view, "models");
  const row = seriesRows(view)[0]!;
  expect([row.querySelector(".pl-msub")!.textContent, words(row, ".pl-chip"), row.lastElementChild!.textContent]).toEqual(["GPT-5.5 Sol", ["Pinned"], "$2.50 / $12.00"]);
  view.element.querySelector<HTMLButtonElement>(".pl-disclose")!.click();
  expect((all(view.element, "tr.pl-version input[type=radio]") as readonly HTMLInputElement[]).map((one) => one.checked)).toEqual([false, false, true]);
  await opened(view, "overview");
  // The Overview lists the series in chat, each as the version it is on, and counts as the tab does.
  expect(words(view.element, ".pl-models thead th")).toEqual(["Model", "In / out, per M tokens"]);
  expect(all(view.element, ".pl-models tbody tr").map((one) => [one.querySelector("strong")!.textContent, words(one, ".pl-chip"), one.lastElementChild!.textContent])).toEqual([["GPT-5.5 Sol", ["Pinned"], "$2.50 / $12.00"]]);
  expect(view.element.querySelector(".pl-main")!.textContent).toContain("All 3 models ›");
});

it("puts a series in the chat's picker from its tick and takes it out, and has the chat's model card read again", async () => {
  const { view, calls, changed } = world({ features: EVERYTHING, series: bySeries() });
  await opened(view, "models");
  const ticks = (): readonly HTMLInputElement[] => seriesRows(view).map((row) => row.querySelector<HTMLInputElement>("input[type=checkbox]")!);
  expect(ticks().map((one) => [one.getAttribute("aria-label"), one.disabled])).toEqual([["In chat: GPT Sol", false], ["In chat: GPT Luna", false], ["In chat: GPT Terra", false]]);
  ticks()[1]!.focus();
  ticks()[1]!.checked = true;
  ticks()[1]!.dispatchEvent(new Event("change"));
  await settle();
  expect(calls).toEqual(['setSeries("openai","GPT Luna",true)']);
  expect(changed).toHaveBeenCalledTimes(1);
  // The page is drawn again with the answer, and the keyboard stays on the tick that was pressed.
  expect(document.activeElement).toBe(ticks()[1]);
  ticks()[0]!.checked = false;
  ticks()[0]!.dispatchEvent(new Event("change"));
  await settle();
  expect(calls.at(-1)).toBe('setSeries("openai","GPT Sol",false)');
});

it("refuses a tick on a vendor not in chat while five others hold its places: the box stays clear, a line above the series line says why and links to the page, and the next tick taken clears it", async () => {
  const { view, calls } = world({ features: EVERYTHING, series: bySeries(), full: true });
  await opened(view, "models");
  const tick = (at: number): HTMLInputElement => seriesRows(view)[at]!.querySelector<HTMLInputElement>("input[type=checkbox]")!;
  expect(view.element.querySelector(".vc-fact")).toBeNull();
  tick(1).checked = true;
  tick(1).dispatchEvent(new Event("change"));
  await settle();
  expect(calls).toEqual(['setSeries("openai","GPT Luna",true)']);
  const line = view.element.querySelector(".pl-model-rows > p.pl-fact.vc-fact")!;
  expect([line.textContent, line.querySelector("a")!.getAttribute("href"), line.getAttribute("role")]).toEqual(["Chat holds 5 vendors at most. Take one out to add another. Models in chat ›", "#/plugins/models", null]);
  // Round 5 draws it first, over the line that says what a tick does.
  expect([line.previousElementSibling, line.nextElementSibling!.textContent]).toEqual([null, "Ticked series show in chat and use the latest version by default; open a series to choose an earlier one."]);
  // It is said once, in the app's unseen status region, and as no toast.
  expect([words(document, ".unseen[role=status]"), words(view.element, ".pl-toast")]).toEqual([["Chat holds 5 vendors at most. Take one out to add another."], [""]]);
  expect(view.element.querySelector("[role=status].unseen")).toBeNull();
  expect([tick(1).checked, document.activeElement]).toEqual([false, tick(1)]);
  tick(0).checked = false;
  tick(0).dispatchEvent(new Event("change"));
  await settle();
  expect(view.element.querySelector(".vc-fact")).toBeNull();
});

it("tells the app's unseen status region, and no toast, when a first tick puts the vendor in chat and a last untick takes it out; a tick within chat tells nothing", async () => {
  const none = Object.fromEntries(Object.entries(bySeries()).map(([id, list]) => [id, list.map((one) => ({ ...one, inChat: false }))]));
  const { view } = world({ features: EVERYTHING, series: none, follows: true });
  await opened(view, "models");
  const said = (): readonly string[] => [...words(document, ".unseen[role=status]"), ...words(view.element, ".pl-toast")];
  const tick = async (at: number, on: boolean): Promise<void> => {
    const box = seriesRows(view)[at]!.querySelector<HTMLInputElement>("input[type=checkbox]")!;
    box.checked = on;
    box.dispatchEvent(new Event("change"));
    await settle();
  };
  await tick(1, true);
  expect(said()).toEqual(["GPT is in chat.", ""]);
  document.querySelector(".unseen[role=status]")!.textContent = "";
  await tick(0, true);
  await tick(0, false);
  expect(said()).toEqual(["", ""]);
  await tick(1, false);
  expect(said()).toEqual(["GPT is out of chat.", ""]);
  // A vendor holding its place by a tick no way reaches today is in chat already: a tick on a series it reaches says nothing.
  document.body.replaceChildren();
  const held = world({ features: EVERYTHING, series: none, follows: true, placed: ["openai"] });
  await opened(held.view, "models");
  const box = seriesRows(held.view)[1]!.querySelector<HTMLInputElement>("input[type=checkbox]")!;
  box.checked = true;
  box.dispatchEvent(new Event("change"));
  await settle();
  expect(words(document, ".unseen[role=status]")).toEqual([""]);
});

it("names each tick by the series it puts in chat in the page's own language", async () => {
  for (const [language, said] of [["en", ["In chat: GPT Sol", "In chat: GPT Luna", "In chat: GPT Terra"]], ["zh", ["用于对话：GPT Sol", "用于对话：GPT Luna", "用于对话：GPT Terra"]]] as const) {
    const { view } = world({ features: EVERYTHING, series: bySeries(), language });
    await opened(view, "models");
    expect(seriesRows(view).map((row) => row.querySelector("input[type=checkbox]")!.getAttribute("aria-label"))).toEqual(said);
    // The tick's heading words stand in a span of their own, which a phone's width hides from sight and not from a reader.
    expect(view.element.querySelector(".pl-series th.pl-tick > span")?.textContent).toBe(text(language, "pl.mt.use"));
    document.body.replaceChildren();
  }
});

it("draws a price, on the Models tab and the Overview alike, only where the balance serves first: not by the key alone, nor where the key comes first", async () => {
  const heads = (view: PluginsPage, table: string): readonly string[] => words(view.element, `${table} thead th`);
  for (const [ways, priced] of [[["key"], false], [["key", "platform"], false], [["platform", "key"], true]] as const) {
    const { view } = world({ features: EVERYTHING, series: bySeries(), ways, ownKey: true });
    await opened(view, "models");
    expect(heads(view, ".pl-series").includes("In / out, per M tokens"), ways.join()).toBe(priced);
    expect(/\$[\d.]+ \/ \$[\d.]+/.test(view.element.querySelector(".pl-series")!.textContent!), ways.join()).toBe(priced);
    document.body.replaceChildren();
    const overview = world({ features: EVERYTHING, series: bySeries(), ways, ownKey: true });
    await opened(overview.view);
    expect(heads(overview.view, ".pl-models").includes("In / out, per M tokens"), ways.join()).toBe(priced);
    document.body.replaceChildren();
  }
});

/** OpenAI's series where the seller's ways split them: GPT Sol listed by the subscription and the balance, its earlier version and GPT Luna by the balance alone. */
const byWays = (luna: { inChat?: boolean } = {}) => ({
  openai: [
    { name: "GPT Sol", inChat: true, versions: [{ ...solNow, ways: ["account", "platform"] }, { ...solWas, ways: ["platform"] }] },
    { name: "GPT Luna", inChat: false, ...luna, versions: [{ id: "gpt-6-luna", name: "GPT-6 Luna", input: 100_000, output: 500_000, ways: ["platform"] }] },
  ],
});
const parts = (root: ParentNode, table: string): readonly (readonly [string, readonly string[]])[] =>
  all(root, `${table} > tbody.pl-way-group`).map((group) => [group.querySelector("tr.pl-way-head > th")!.textContent ?? "", words(group, "tr:not(.pl-way-head):not(.pl-version) .pl-mname strong")]);

it("draws a vendor's series in parts headed by the way that serves each, in the order of use, a price only where the balance serves first, and a version another way serves with that way's tag", async () => {
  const { view } = world({ features: EVERYTHING, series: byWays(), ways: ["account", "platform"] });
  await opened(view, "models");
  expect(parts(view.element, ".pl-series")).toEqual([["Subscription", ["GPT Sol"]], ["Balance", ["GPT Luna"]]]);
  const head = view.element.querySelector(".pl-series tr.pl-way-head > th")!;
  expect([head.getAttribute("scope"), head.getAttribute("colspan")]).toEqual(["rowgroup", String(all(view.element, ".pl-series thead th").length)]);
  expect(all(view.element, ".pl-series tbody.pl-way-group").map((group) => group.querySelector("tr:not(.pl-way-head)")!.lastElementChild!.textContent)).toEqual(["", "$0.10 / $0.50"]);
  view.element.querySelector<HTMLButtonElement>(".pl-disclose")!.click();
  // Under Always the latest, each version: the one the series is on bare, the one only the balance lists tagged and priced.
  expect(all(view.element, "tr.pl-version").slice(1).map((row) => [row.querySelector(".pl-mname")!.firstChild!.textContent, words(row, ".pl-tag"), row.lastElementChild!.textContent]))
    .toEqual([["GPT-6 Sol", [], ""], ["GPT-5.5 Sol", ["Balance"], "$2.50 / $12.00"]]);
  document.body.replaceChildren();
  // With the balance first it serves every series: one part, with no head, and every version bare.
  const first = world({ features: EVERYTHING, series: byWays(), ways: ["platform", "account"] });
  await opened(first.view, "models");
  expect([all(first.view.element, ".pl-series tr.pl-way-head"), all(first.view.element, ".pl-series > tbody").length]).toEqual([[], 1]);
  first.view.element.querySelector<HTMLButtonElement>(".pl-disclose")!.click();
  expect(all(first.view.element, "tr.pl-version .pl-tag")).toEqual([]);
});

it("draws the models a vendor puts in chat on its Overview in the same parts, each under its way", async () => {
  const { view } = world({ features: EVERYTHING, series: byWays({ inChat: true }), ways: ["account", "platform"] });
  await opened(view);
  expect(parts(view.element, ".pl-models")).toEqual([["Subscription", ["GPT-6 Sol"]], ["Balance", ["GPT-6 Luna"]]]);
  document.body.replaceChildren();
  // With one of them in chat, one way serves what it puts there: no head.
  const one = world({ features: EVERYTHING, series: byWays(), ways: ["account", "platform"] });
  await opened(one.view);
  expect([all(one.view.element, ".pl-models tr.pl-way-head"), words(one.view.element, ".pl-models tbody strong")]).toEqual([[], ["GPT-6 Sol"]]);
});

it("stands the line that refuses a sixth series under the row pressed, on the Models tab as in a router's list", async () => {
  const { view, calls } = world({ features: EVERYTHING, series: bySeries(), full: "many" });
  await opened(view, "models");
  const box = seriesRows(view)[1]!.querySelector<HTMLInputElement>("input[type=checkbox]")!;
  box.checked = true;
  box.dispatchEvent(new Event("change"));
  await settle(); await settle();
  expect(calls).toEqual(['setSeries("openai","GPT Luna",true)']);
  const line = view.element.querySelector(".pl-series tr.or-held")!;
  expect([line.previousElementSibling!.querySelector(".pl-mname strong")!.textContent, line.textContent]).toEqual(["GPT Luna", "Chat holds 5 of a vendor's series at most. Untick one to tick another."]);
  expect(view.element.querySelector(".pl-tabbody > .vc-fact, .pl-model-rows > .vc-fact")).toBeNull();
});

it("keeps a series whose pinned version is no longer offered ticked, on its latest, with one line under its name naming the version that left", async () => {
  const { view } = world({ features: EVERYTHING, series: { openai: [{ name: "GPT Sol", inChat: true, gone: "GPT-5 Sol", versions: [solNow, solWas] }] } });
  await opened(view, "models");
  const [sol] = seriesRows(view);
  expect(sol!.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked).toBe(true);
  expect(words(sol!, ".pl-msub")).toEqual([solNow.name, "GPT-5 Sol is no longer offered, so this series uses its latest version."]);
  expect(words(sol!, ".pl-chip")).toEqual([]);
});

it("lists a vendor not installed with its series, every tick and version taking no press, under Models and prices on its Overview", async () => {
  const { view, calls } = world({ features: EVERYTHING, series: bySeries() });
  await opened(view, "models", "z-ai");
  expect(view.element.querySelector("h1")!.textContent).toBe("GLM");
  expect(view.element.querySelector(".pl-tabbody > p.quiet")!.textContent).toBe("Install GLM to choose its models.");
  expect((all(view.element, ".pl-series input") as readonly HTMLInputElement[]).map((one) => one.disabled)).toEqual([true]);
  expect(calls).toEqual([]);
  await opened(view, "overview", "z-ai");
  expect(words(view.element, ".pl-main h2")).toContain("Models and prices");
  expect(words(view.element, ".pl-models tbody strong")).toEqual(["GLM-5"]);
});

it("keeps a model plugin installed from Discover installed when a read begun before the install lands after the read it starts", async () => {
  const { view, calls, hold, gates } = world({ features: EVERYTHING, series: bySeries() });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all" });
  await settle();
  const plus = (): HTMLButtonElement | undefined => [...view.element.querySelectorAll<HTMLButtonElement>("button")].find((one) => one.getAttribute("aria-label") === "Install GLM");
  hold();
  const stale = view.load();
  await settle();
  plus()!.click();
  await settle();
  document.querySelector<HTMLButtonElement>("dialog.pl-card-dialog button.primary")?.click();
  await settle();
  expect(calls).toEqual(['installModel("z-ai",true)']);
  for (const gate of gates.slice(1)) gate.resolve();
  await settle();
  expect(plus()).toBeUndefined();
  gates[0]!.resolve();
  await stale;
  await settle();
  expect(plus()).toBeUndefined();
});

it("draws a vendor under Plugins it uses and on a bundle's Plugins tab, read or not, as its row in Yours: who made it and what it is, with no reason", async () => {
  const user = { ...CATALOGUE.plugins.find((one) => one.id === "cx-sources")!, id: "asks", name: "Asks", builds: [{ on: "openai", need: "optional" as const, why: { en: "It asks GPT.", zh: "它会问 GPT。" } }] };
  const catalogue: Catalogue = { ...CATALOGUE, plugins: [...CATALOGUE.plugins, user], bundles: [{ ...CATALOGUE.bundles[0]!, id: "starter", members: ["openai"] }] };
  const openai = CATALOGUE.plugins.find((one) => one.id === "openai")!;
  const line = `by ${openai.author === "" ? "ComChatX" : openai.author} · ${openai.about.en}`;
  const rowLine = (view: PluginsPage): readonly string[] => all(view.element, ".pl-tabbody a.pl-row-link").map((one) => `${one.getAttribute("href")} ${one.closest("li")!.querySelector(".pl-row-line")!.textContent}`);
  const read = world({ features: EVERYTHING, series: bySeries(), catalogue });
  await read.view.load();
  read.view.show({ kind: "plugin", id: "asks", tab: "deps" } as never);
  await settle();
  expect([rowLine(read.view), read.view.element.querySelector(".pl-tabbody")!.textContent!.includes("It asks GPT."), all(read.view.element, ".pl-news")]).toEqual([[`#/plugins/p/openai ${line}`], false, []]);
  read.view.show({ kind: "home", view: "yours", filter: "all" });
  expect(all(read.view.element, "a.pl-row-link").find((one) => one.getAttribute("href") === "#/plugins/p/openai")!.closest("li")!.querySelector(".pl-row-line")!.textContent).toBe(line);
  expect(all(read.view.element, ".pl-news-row")).toEqual([]);
  read.view.show({ kind: "bundle", id: "starter", tab: "plugins" } as never);
  await settle();
  expect([rowLine(read.view), all(read.view.element, ".pl-news")]).toEqual([[`#/plugins/p/openai ${line}`], []]);
  document.body.replaceChildren();
  const unread = world({ features: EVERYTHING, series: bySeries(), catalogue, packagesUnread: true });
  await unread.view.load();
  unread.view.show({ kind: "plugin", id: "asks", tab: "deps" } as never);
  await settle();
  expect([all(unread.view.element, ".pl-tabbody a.pl-row-link").map((one) => one.getAttribute("href")), all(unread.view.element, ".pl-news")]).toEqual([["#/plugins/p/openai"], []]);
});

it("draws a model on a bundle's Plugins tab as its row in Yours, with no price of its own there, and installs no model with the bundle", async () => {
  // Keepa is bought with the bundle, so its install card opens.
  const catalogue: Catalogue = { ...CATALOGUE, bundles: [{ ...CATALOGUE.bundles[0]!, id: "starter", members: ["openai", "keepa"] }] };
  const { view } = world({ features: EVERYTHING, catalogue, held: false });
  await view.load();
  view.show({ kind: "bundle", id: "starter", tab: "plugins" } as never);
  await settle();
  const row = view.element.querySelector('.pl-tabbody a.pl-row-link[href="#/plugins/p/openai"]')!.closest("li")!;
  expect([row.querySelector(".pl-price"), row.querySelector(".pl-row-end [data-focus^='act ']")?.getAttribute("aria-label")]).toEqual([null, "Install GPT"]);
  view.element.querySelector<HTMLButtonElement>(".pl-head-tools button.primary")!.click();
  await settle();
  // A press installs the packages on the list and what they cannot work without: the model is not on the card.
  expect(words(document.querySelector("dialog")!, ".pl-card-rows .pl-row-name strong")).toEqual(["Keepa API", "Data Source Core"]);
});

it("keeps a sign-in's chosen answer turning through the card drawn anew, and takes a press of it drawn anew as none", async () => {
  const taken = Promise.withResolvers<boolean>();
  const answers: string[] = [];
  const w = world({ features: EVERYTHING, signedIn: false,
    signIn: (_account, steps) => { steps?.heard?.({ kind: "ask", masked: false, dialog: { id: "s:2", method: "select", title: "Which plan?", options: ["Plus", "Pro"] } }); return new Promise(() => {}); },
    answerSignIn: async (_account, _id, answer) => { answers.push(JSON.stringify(answer)); return taken.promise; } });
  await opened(w.view, "settings");
  w.view.element.querySelector<HTMLButtonElement>("#way-account .pl-way-act button")!.click();
  await settle();
  const pro = (): HTMLButtonElement => all(w.view.element, ".dialog-options button").find((one) => one.textContent?.startsWith("Pro"))! as HTMLButtonElement;
  const first = pro();
  first.click();
  await settle();
  // Sending redraws the card: the answer drawn anew still turns, and a press of it is no second answer.
  const again = pro();
  expect(again).not.toBe(first);
  again.click();
  await settle();
  expect([answers, again.getAttribute("aria-busy"), again.querySelector(".pl-spin") !== null, all(w.view.element, ".dialog-options button").filter((one) => one !== again).map((one) => one.getAttribute("aria-disabled"))])
    .toEqual([['{"value":"Pro"}'], "true", true, ["true"]]);
  taken.resolve(true);
  await settle();
  expect(answers).toHaveLength(1);
});

it("gives a sign-in's card back whole when its answer is refused after the card was drawn anew, the keyboard on the answer pressed throughout", async () => {
  const taken = Promise.withResolvers<boolean>();
  const answers: string[] = [];
  const w = world({ features: EVERYTHING, signedIn: false,
    signIn: (_account, steps) => { steps?.heard?.({ kind: "ask", masked: false, dialog: { id: "s:2", method: "select", title: "Which plan?", options: ["Plus", "Pro"] } }); return new Promise(() => {}); },
    answerSignIn: async (_account, _id, answer) => { answers.push(JSON.stringify(answer)); return taken.promise; } });
  await opened(w.view, "settings");
  w.view.element.querySelector<HTMLButtonElement>("#way-account .pl-way-act button")!.click();
  await settle();
  const options = (): HTMLButtonElement[] => [...w.view.element.querySelectorAll<HTMLButtonElement>(".dialog-options button")];
  const first = options()[1]!;
  first.focus();
  first.click();
  await settle();
  // Sending draws the card anew: the keyboard is on the new Pro, which turns.
  const pressed = options()[1]!;
  expect([pressed !== first, document.activeElement === pressed, pressed.getAttribute("aria-busy")]).toEqual([true, true, "true"]);
  taken.resolve(false);
  await settle();
  // Refused, every answer of the card as it stands is pressable again, the keyboard still on the one pressed.
  const after = options();
  expect([after.map((one) => [one.getAttribute("aria-busy"), one.getAttribute("aria-disabled"), one.querySelector(".pl-spin") !== null]), document.activeElement === after[1]])
    .toEqual([[[null, null, false], [null, null, false]], true]);
  after[0]!.click();
  await settle();
  expect(answers).toEqual(['{"value":"Pro"}', '{"value":"Plus"}']);
});

it("keeps a held ↑ turning in the order drawn anew, taking no second move", async () => {
  const gate = Promise.withResolvers<void>();
  const w = world({ features: EVERYTHING, ownKey: true, waysGate: gate.promise });
  await opened(w.view, "settings");
  const up = (): HTMLElement | null => w.view.element.querySelector<HTMLElement>(".pl-order button.pl-up");
  const first = up()!;
  first.focus();
  first.click();
  await settle();
  await w.view.load();
  await settle();
  const again = up()!;
  expect([again !== first, again.getAttribute("aria-busy"), again.querySelector(".pl-spin") !== null]).toEqual([true, "true", true]);
  again.click();
  await settle();
  expect(w.calls.filter((call) => call.startsWith("setModelWays"))).toHaveLength(1);
  gate.resolve();
  await settle();
  expect(up()?.getAttribute("aria-busy") ?? null).toBe(null);
});
