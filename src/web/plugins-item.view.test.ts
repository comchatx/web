import { describe, expect, it, vi } from "vitest";
import { ComputerPending, EVERYTHING, FIRST_RELEASE, SignInEnded, type Backend, type Features, type HeldBundle, type Readme, type Me, type ModelPlugin, type NpmPackage, type OnImage, type Package, type Source, type Spending } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { withRecords, type Catalogue } from "./catalogue.js";
import { REREAD_MS } from "./plugins-clicks.js";
import { route as parseRoute } from "./plugins-model.js";
import { clickStub, listOf } from "./plugins-test-kit.js";

// The page's DOM-construction port is replaced, not what it decides to draw.
const { Element } = vi.hoisted(() => {
  class Element {
    readonly parentElement = null;
    readonly children: (Element | string)[] = [];
    readonly classList = {
      add: (name: string) => { this.props["class"] = `${String(this.props["class"] ?? "")} ${name}`.trim(); },
      remove: (name: string) => { this.props["class"] = String(this.props["class"] ?? "").split(" ").filter((one) => one !== name).join(" "); },
    };
    textContent_: string | undefined;
    innerHTML = "";
    constructor(readonly tag: string, readonly props: Record<string, unknown> = {}) {}
    append(...children: unknown[]) { for (const child of children) if (child instanceof Element || typeof child === "string") this.children.push(child); }
    replaceChildren(...children: unknown[]) { this.children.splice(0); this.append(...children); }
    // A click listener stands as the press a test makes through `onclick`, as the set's controls add theirs.
    addEventListener(type: string, listener: unknown): void { if (type === "click" && this.props["onclick"] === undefined) this.props["onclick"] = listener; }
    focus(): void {}
    // The set's dialog opens a card as the browser's own modal.
    showModal(): void {}
    setAttribute(name: string, value: unknown): void { this.props[name] = value; }
    remove(): void { (globalThis as { removed?: Element[] }).removed?.push(this); }
    removeAttribute(name: string): void { delete this.props[name]; }
    // What a control drawn waiting reads of itself.
    get tagName(): string { return this.tag.toUpperCase(); }
    get childNodes(): (Element | string)[] { return [...this.children]; }
    getAttribute(name: string): string | null { return this.props[name] === undefined ? null : String(this.props[name]); }
    hasAttribute(name: string): boolean { return this.props[name] !== undefined; }
    querySelector(selector: string): Element | null {
      const name = /^:scope > \.([\w-]+)$/.exec(selector)?.[1];
      return this.children.find((child): child is Element => typeof child !== "string" && String(child.props["class"] ?? "").split(" ").includes(name ?? "")) ?? null;
    }
    set textContent(value: string) { this.textContent_ = value; }
    get textContent(): string { return this.textContent_ ?? this.children.map((child) => (typeof child === "string" ? child : child.textContent)).join(""); }
  }
  return { Element };
});
vi.mock("./dom.js", () => ({
  h: (tag: string, props: Record<string, unknown> = {}, ...children: unknown[]) => { const node = new Element(tag, props); node.append(...children); return node; },
  fill: (node: InstanceType<typeof Element>, ...children: unknown[]) => node.replaceChildren(...children),
  svg: (tag: string, props: Record<string, string> = {}, ...children: unknown[]) => { const node = new Element(tag, props); node.append(...children); return node; },
  placed: () => undefined,
}));
// A drawn mark is built on a real document (`mark-shapes.dom.test.ts`); here it is its box alone.
vi.mock("./mark-shapes.js", () => ({ drawMark: () => new Element("svg", { class: "pl-drawn" }) }));
const { PluginsPage } = await import("./plugins-page.js");
type Node = InstanceType<typeof Element>;
const nodes = (node: Node): Node[] => [node, ...node.children.flatMap((child) => (typeof child === "string" ? [] : nodes(child)))];
const byClass = (root: Node, name: string): Node[] => nodes(root).filter((node) => String(node.props["class"] ?? "").split(" ").includes(name));
/** Presses the open card's act; the newest card in the host is the open one. */
const confirm = async (host: Node): Promise<void> => {
  const card = byClass(host, "pl-card-dialog").at(-1);
  if (card === undefined) throw new Error("no card is open");
  host.children.splice(host.children.indexOf(card), 1);
  await (byClass(card, "primary")[0]!.props["onclick"] as () => Promise<void>)();
};

const say = (key: string, values?: Readonly<Record<string, string | number>>): string => `${key}${values === undefined || Object.keys(values).length === 0 ? "" : JSON.stringify(values)}`;
// A package of ours is held at the version its record was read at, so its page draws the files that record holds.
const pack = (name: string): Package => ({ name, version: CATALOGUE.plugins.find((one) => one.box?.package === name)?.version ?? "1.0.0", source: `npm:${name}` }) as Package;
const keepa = (enabled: boolean, key = false): Source => ({ name: "keepa", supplier: "Keepa", nativeUnit: "tokens", unitsPerNative: 1, aspects: [{ aspect: "amazon/us/<asin>/product", native: 14 }], enabled, spent: 0, month: { since: 0, spent: 118_000 }, ownKey: { held: key } }) as unknown as Source;
const me = { kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } } as unknown as Extract<Me, { kind: "signed_in" }>;
// A bundle of the fixtures' own listing cx-sources and Conversation Titles, so it reaches Jev through a member and a held one can miss a part;
// Essentials keeps the list a new account starts with.
const pinned = withRecords(CATALOGUE, { bundles: [{ id: "pinned", name: "Pinned", author: "ComChatX", about: { en: "p", zh: "p" }, members: ["cx-sources", "cx-topics"] }] });

function page(world: { member?: boolean; series?: Record<string, unknown>; catalogue?: Catalogue; packages?: readonly Package[]; sources?: readonly Source[]; models?: readonly ModelPlugin[]; onImage?: readonly OnImage[]; hold?: boolean; unread?: boolean; refuse?: boolean | string; features?: Features; readme?: Readme; wait?: Promise<void>; accounts?: readonly unknown[]; served?: unknown; providers?: readonly unknown[]; pending?: boolean; spending?: Spending; npm?: NpmPackage | "unreachable"; others?: readonly NpmPackage[]; pressed?: readonly HeldBundle[] } = {}) {
  const calls: string[] = [];
  const record = (name: string) => vi.fn(async (...args: unknown[]) => { calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(",")})`); });
  const ask = vi.fn();
  const box = clickStub(world.packages ?? [pack("cx-sources"), pack("@comchatx/cx-topics"), pack("cx-keepa")]);
  box.world.list = listOf(box.world.list.packages, { onImage: world.onImage ?? [] });
  box.world.hold = world.hold === true;
  box.world.pressed = world.pressed ?? [];
  const click = (name: "installPackage" | "setPackage") => { const said = record(name); return async (source: string, on: boolean) => { await said(source, on); return box[name](source, on); }; };
  const backend = {
    features: world.features ?? EVERYTHING, links: { signIn: "#in", account: "#account", help: "#help" }, readme: async () => world.readme,
    series: async () => world.series ?? {}, catalogue: async () => world.catalogue ?? pinned, npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-10-17T00:00:00.000Z" }), npmPackage: vi.fn(async (name: string) => {
      if (world.npm === "unreachable") throw new Error("npm_unreachable");
      const other = world.others?.find((one) => one.name === name);
      if (other !== undefined) return other;
      if (world.npm?.name !== name) throw new Error("unknown_package");
      return world.npm;
    }),
    packages: async () => { if (world.pending === true) throw new ComputerPending(); if (world.unread === true) throw new Error("503"); return box.packages(); },
    sources: async () => world.sources ?? [keepa(true)],
    modelPlugins: async () => world.models ?? [{ id: "jev", enabled: true, ways: ["platform"], month: 0 }],
    models: async () => (world.served as never) ?? ({ current: { provider: "openai", id: "gpt-6-sol" }, available: [{ provider: "openai", id: "gpt-6-sol", name: "GPT-6 Sol", via: "OpenAI" }] }),
    providers: async () => world.providers ?? [{ id: "openai", name: "OpenAI", platformKey: true, ownKey: false, models: [], rates: [{ model: "gpt-6-sol", input: 2_000_000, output: 10_000_000 }] }],
    accounts: async () => world.accounts ?? [{ id: "openai", name: "OpenAI", signedIn: true, models: [{ id: "gpt-6-sol", name: "GPT-6 Sol", shown: true }] }],
    now: () => Date.parse("2026-09-28"),
    installModel: record("installModel"), installPackage: vi.fn(async (source: string, on: boolean) => {
      await world.wait;
      if (world.refuse !== undefined && world.refuse !== false) { calls.push("installPackage refused"); throw new Error(world.refuse === true ? "refused" : world.refuse); }
      return click("installPackage")(source, on);
    }),
    pressBundle: async (bundle: string, sources: readonly string[]) => { calls.push(`pressBundle(${JSON.stringify(bundle)},${JSON.stringify(sources)})`); return box.pressBundle(bundle, sources); },
    removeBundle: async (bundle: string, sources: readonly string[]) => { calls.push(`removeBundle(${JSON.stringify(bundle)},${JSON.stringify(sources)})`); return box.removeBundle(bundle, sources); },
    bundleState: box.bundleState,
    setModel: record("setModel"), setPackage: click("setPackage"), setModelWays: record("setModelWays"), signIn: record("signIn"), signOut: record("signOut"),
    saveSourceKey: record("saveSourceKey"),
  } as unknown as Backend;
  const host = new Element("body");
  const view = new PluginsPage({ power: box.power, say, language: () => "en", backend, me: () => ({ ...me, ...(world.spending === undefined ? {} : { spending: world.spending }), ...(world.member === true ? { organization: { id: "org", role: "member" } } : {}) }), ask, announce: () => undefined, cards: () => host as unknown as HTMLElement, changed: async () => {} });
  return { view, backend, host: host as Node, root: view.element as unknown as Node, calls, ask, box };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const text = (root: Node) => root.textContent;

it("draws a source's tabs from its parts, and its Pricing as the unit price, each kind of request it names and what a dollar buys, with no table", async () => {
  const { view, root } = page();
  await view.load();
  view.show({ kind: "plugin", id: "keepa" });
  await settle();
  expect(byClass(root, "pl-tab").map((tab) => tab.textContent)).toEqual(["pl.tab.overview", "pl.tab.deps · 3", "pl.tab.settings"]);
  expect(text(root)).toMatch(/pl\.src\.platform\{"price":"\$[\d.]+\/[\d,]+ tokens"\}/);
  expect(byClass(root, "pl-prices").flatMap((list) => list.children.map((line) => typeof line === "string" ? line : line.textContent))).toEqual([expect.stringMatching(/^source\.typical\{"what":"[^"]+","count":"14","unit":"tokens","price":"[^"]+"\}$/)]);
  expect(text(root)).toMatch(/pl\.ov\.scale\{"one":"\$1(\.00)?","n":"71,000"\}/);
  expect(nodes(root).find((node) => node.tag === "th")).toBeUndefined();
});

it("prints a data source's price on its package's own page, under How you pay in the side card, as the gate names the source by the package", async () => {
  const listed = { ...keepa(true), name: "cx-keepa" } as Source;
  const ours: NpmPackage = { ...WEB_NPM, name: "cx-keepa", author: "ComChatX", repository: "https://github.com/comchatx/cx-keepa", readme: "# cx-keepa\n\nKeepa for cx.", ours: true };
  const { view, root } = page({ sources: [listed], npm: ours, catalogue: { ...CATALOGUE, plugins: CATALOGUE.plugins.filter((one) => one.box?.package !== "cx-keepa"), bundles: [] } });
  await view.load();
  view.show({ kind: "plugin", id: "~cx-keepa", npm: "cx-keepa" } as never);
  await settle(); await settle();
  const side = byClass(root, "pl-side")[0]!;
  expect(nodes(side).filter((node) => node.tag === "h2").map((node) => node.textContent)[0]).toBe("pl.ov.pay");
  expect(text(side)).toMatch(/pl\.src\.platform\{"price":"[^"]+"\}/);
  expect(text(byClass(root, "pl-main")[0]!)).not.toContain("pl.src.platform");
  expect(text(root)).toMatch(/pl\.ov\.scale/);
});

it("names the person's own key as the payer wherever the source's price is said, and drops the balance's price", async () => {
  const { view, root } = page({ sources: [keepa(true, true)] });
  await view.load();
  view.show({ kind: "plugin", id: "keepa" });
  await settle();
  expect(text(root)).toContain('pl.src.key{"supplier":"Keepa"}');
  expect(text(root)).not.toContain("pl.src.platform");
  expect(text(root)).not.toContain("pl.ov.scale");
});

it("returns its back link to the page it was opened from, and keeps it across a tab change", async () => {
  const { view, root } = page();
  await view.load();
  view.show({ kind: "home", view: "yours", filter: "all" });
  view.show({ kind: "plugin", id: "cx-topics" });
  view.show({ kind: "plugin", id: "cx-topics", tab: "deps" });
  view.show({ kind: "plugin", id: "jev" });
  await settle();
  const back = nodes(byClass(root, "back")[0]!).find((node) => node.tag === "a")!;
  expect(back.props["href"]).toBe("#/plugins/p/cx-topics/deps");
  expect(back.textContent).toBe('pl.pg.back{"name":"Chat Chapters"}');
});

it("installs what a plugin builds on before the plugin, and a source by the one click on its package", async () => {
  const { view, root, host, calls } = page({ packages: [], sources: [keepa(false)], models: [] });
  await view.load();
  view.show({ kind: "plugin", id: "cx-topics" });
  await settle();
  const install = async () => {
    (nodes(byClass(root, "pl-head")[0]!).find((node) => node.tag === "button")!.props["onclick"] as () => void)();
    await settle();
    // Nothing is done until the card's act is pressed.
    expect(calls).toEqual([]);
    await confirm(host);
  };
  await install();
  await settle();
  expect(calls).toEqual(['installModel("jev",true)', 'installPackage("npm:@comchatx/cx-topics",true)']);
  calls.splice(0);
  view.show({ kind: "plugin", id: "keepa" });
  await settle();
  await install();
  await settle();
  // Keepa's record says it is built on cx-sources, which no source's read has to say: it is sent first.
  expect(calls).toEqual(['installPackage("npm:cx-sources",true)', 'installPackage("npm:cx-keepa",true)']);
});

it("lists everything a bundle installs on its Plugins tab, each as its one row with nothing said beside it, and counts the same; has no Data sources tab", async () => {
  const { view, root } = page();
  await view.load();
  view.show({ kind: "bundle", id: "pinned", tab: "plugins" });
  expect(byClass(root, "pl-tab").map((tab) => tab.textContent)).toEqual(["pl.tab.overview", "pl.tab.plugins · 3"]);
  expect(byClass(root, "pl-row-link").map((row) => row.props["href"])).toEqual(["#/plugins/p/cx-sources", "#/plugins/p/cx-topics", "#/plugins/p/jev"]);
  expect([byClass(root, "pl-from").length, byClass(root, "pl-choose").length]).toEqual([0, 0]);
  expect(byClass(root, "pl-head")[0]!.textContent).toContain('"count":3');
});

it("has no Skills or Usage tab on any plugin's page, and an address of either, or of one skill, opens the plugin's Overview", async () => {
  const { view, root } = page();
  await view.load();
  const tabs = new Set<string>();
  for (const one of CATALOGUE.plugins) {
    view.show({ kind: "plugin", id: one.id });
    await settle();
    for (const tab of byClass(root, "pl-tab")) tabs.add(String(tab.textContent).split(" · ")[0]!);
  }
  expect([...tabs].filter((tab) => tab === "pl.tab.skills" || tab === "pl.tab.usage")).toEqual([]);
  const skill = CATALOGUE.plugins.find((one) => one.id === "keepa")!.box!.skills[0]!;
  for (const address of [`#/plugins/p/keepa/skills/${skill.name}`, "#/plugins/p/keepa/skills", "#/plugins/p/keepa/usage"]) {
    view.show(parseRoute(address)!);
    await settle();
    expect([nodes(root).find((node) => node.tag === "h1")?.textContent, byClass(root, "pl-tab").find((tab) => tab.props["aria-selected"] === "true")?.textContent]).toEqual(["Keepa API", "pl.tab.overview"]);
  }
});

/** Keepa's record with two templates, one that runs as it stands and one that asks for words after its name. */
const tried = (): Catalogue => ({ ...CATALOGUE, plugins: CATALOGUE.plugins.map((one) => (one.id !== "keepa" ? one : { ...one, box: { ...one.box!, prompts: [
  { name: "track-price", about: { en: "Track a price", zh: "跟踪价格" } }, { name: "compare", about: { en: "Compare two products", zh: "对比两个商品" }, hint: "<asin> <asin>" },
] } })) });
const tryCard = (root: Node, name: string) => byClass(root, "pl-try").find((one) => one.props["data-focus"] === `try ${name}`)!;

it("offers the package's templates as Try it on its Overview, one card each, its sentence alone, no command", async () => {
  const { view, root } = page({ catalogue: tried() });
  await view.load();
  view.show({ kind: "plugin", id: "keepa" });
  await settle();
  expect(byClass(root, "pl-try").map((one) => one.textContent)).toEqual(["› Track a price", "› Compare two products"]);
});

const gpt: ModelPlugin = { id: "openai", enabled: true, ways: ["account", "platform"], month: 2_140_000 };
const click = (node: Node) => (node.props["onclick"] as () => void)();

it("says a model plugin's ways in cx's order as one sentence in its Settings, and lists the chat models with their price on its Overview", async () => {
  const { view, root } = page({ models: [gpt] });
  await view.load();
  view.show({ kind: "plugin", id: "openai" });
  await settle();
  expect(text(root)).not.toContain("pl.order.two");
  expect(text(root)).toContain("GPT-6 Sol");
  expect(text(root)).toContain("$2.00 / $10.00");
  // The price's two halves, so a narrow table breaks it between them and nowhere else.
  expect(byClass(root, "pl-nobreak").map((one) => one.textContent)).toEqual(["$2.00 /", "$10.00"]);
  view.show({ kind: "plugin", id: "openai", tab: "settings" });
  await settle();
  expect(text(byClass(root, "pl-setting")[0]!)).toContain('pl.order.two{"a":"pl.who.account');
});

it("moves a way up in the order of use", async () => {
  const { view, root, calls } = page({ models: [gpt] });
  await view.load();
  view.show({ kind: "plugin", id: "openai", tab: "settings" });
  await settle();
  click(byClass(root, "pl-up")[0]!);
  await settle();
  expect(calls).toContain('setModelWays("openai",["platform","account"])');
  view.show({ kind: "plugin", id: "openai", tab: "models" });
  await settle();
  expect(byClass(root, "pl-credit")).toEqual([]);
});

it("stores the account way only once the sign-in ends signed in, first in the order", async () => {
  const out = [{ id: "openai", name: "OpenAI", signedIn: false, models: [] }];
  const { view, root, calls, backend } = page({ models: [{ ...gpt, ways: ["platform"] }], accounts: out });
  const signIn = vi.mocked(backend.signIn);
  signIn.mockRejectedValueOnce(new SignInEnded("refused", "access_denied"));
  await view.load();
  view.show({ kind: "plugin", id: "openai", tab: "settings" });
  await settle();
  const press = () => nodes(root).find((node) => node.tag === "button" && String(node.textContent).startsWith("pl.ms.signIn"))!;
  click(press());
  await settle(); await settle();
  expect(signIn.mock.calls.map(([account]) => account)).toEqual(["openai"]);
  expect(calls.some((call) => call.startsWith("setModelWays"))).toBe(false);
  click(press());
  await settle(); await settle();
  expect(calls).toContain('setModelWays("openai",["account","platform"])');
});

it("turns a plugin off from its header's switch, through a card when another plugin stops with it", async () => {
  const { view, root, host, calls } = page();
  await view.load();
  view.show({ kind: "plugin", id: "cx-sources" });
  await settle();
  click(byClass(byClass(root, "pl-head")[0]!, "f-switch")[0]!);
  await settle();
  expect(calls).toEqual([]);
  await confirm(host);
  await settle();
  expect(calls).toEqual(['setPackage("npm:cx-sources",false)']);
});

it("turns a data source off at once where no other plugin stops with it: no card stands between the switch and the answer", async () => {
  const { view, root, host, calls } = page();
  await view.load();
  view.show({ kind: "plugin", id: "keepa" });
  await settle();
  click(byClass(byClass(root, "pl-head")[0]!, "f-switch")[0]!);
  await settle();
  expect(byClass(host, "pl-card-dialog")).toHaveLength(0);
  expect(calls).toEqual(['setPackage("npm:cx-keepa",false)']);
});

it("keeps a record page whole across a redraw the seller did not ask for", async () => {
  const { view, root } = page();
  await view.load();
  view.show({ kind: "plugin", id: "keepa", tab: "settings" });
  await settle();
  const drawn = root.children[0];
  view.draw();
  view.show({ kind: "plugin", id: "keepa", tab: "settings" });
  await settle();
  expect(root.children[0]).toBe(drawn);
});

it("draws no Pricing and no payer for a source that costs nothing", async () => {
  const free = { name: "amazon-sp-api", supplier: "Amazon-SP-API", nativeUnit: "requests", aspects: [], enabled: false, spent: 0 } as unknown as Source;
  const { view, root } = page({ sources: [free] });
  await view.load();
  view.show({ kind: "plugin", id: "amazon-sp-api" });
  await settle();
  expect([text(root).includes("Amazon SP-API"), byClass(root, "pl-readme").length, text(root).includes("pl.ov.pay"), text(root).includes("pl.us.unread")]).toEqual([true, 1, false, false]);
  view.show({ kind: "plugin", id: "amazon-sp-api", tab: "settings" });
  await settle();
  expect([text(root).includes("pl.st.pay"), text(root).includes("pl.src.platform")]).toEqual([false, false]);
  // A source whose price is unread is not one that costs nothing.
  view.show({ kind: "plugin", id: "keepa" });
  await settle();
  expect(text(root)).toContain("pl.ov.pay");
});

it("says a failed install's own line on the page once the world is read again", async () => {
  const { view, root, calls } = page({ packages: [pack("cx-sources")], refuse: true });
  await view.load();
  view.show({ kind: "plugin", id: "cx-topics" });
  await settle();
  const install = nodes(root).find((node) => node.tag === "button" && String(node.textContent).includes("pl.install"))!;
  (install.props["onclick"] as () => void)();
  await settle(); await settle();
  expect(calls).toContain("installPackage refused");
  expect(byClass(root, "pl-failed-text")[0]?.textContent).toBe('pl.fail.install{"name":"Chat Chapters"}');
  expect(byClass(root, "pl-again")[0]?.textContent).toBe("pl.tryAgain");
});

it("says on a record page why the installed list is not known — cx's computer not set up yet, in the chat's words — with no Try again", async () => {
  for (const [world, said] of [[{ pending: true }, "box.closedFree"]] as const) {
    const { view, root } = page(world);
    await view.load();
    view.show({ kind: "plugin", id: "keepa" });
    await settle();
    expect([byClass(root, "pl-needs").map((line) => line.textContent), /pl\.unread/.test(text(root)), nodes(root).some((node) => node.tag === "button" && node.textContent === "status.retry")], said).toEqual([[said], false, false]);
  }
});

it("says the held reads failed on a record page, with Try again, and claims neither Install nor not installed", async () => {
  const { view, root } = page({ unread: true });
  await view.load();
  view.show({ kind: "plugin", id: "keepa" });
  await settle();
  expect(text(root)).toContain("pl.unread");
  expect(nodes(root).some((node) => node.tag === "button" && String(node.textContent).includes("pl.install"))).toBe(false);
  expect(text(root)).not.toContain("pl.notInstalled");
});

it("draws a model's Settings from the accounts and providers the world lists, by their ids: ChatGPT's sign-in on GPT's card, and neither Codex's, which the platform does not run, nor Kimi's", async () => {
  for (const [account, drawn] of [["openai", true], ["openai-codex", false], ["kimi-coding", false]] as const) {
    const { view, root } = page({ models: [{ id: "openai", enabled: true, ways: ["platform"], month: 0 }], accounts: [{ id: account, name: account, signedIn: true, models: [] }] });
    await view.load();
    view.show({ kind: "plugin", id: "openai", tab: "settings" });
    await settle();
    expect(nodes(root).some((node) => String(node.props["id"] ?? "").startsWith("way-account")), account).toBe(drawn);
    expect(nodes(root).some((node) => node.props["id"] === "way-key"), account).toBe(true);
  }
});

it("installs a plugin first when Try it is pressed on one not installed, and fills the box only once it is", async () => {
  const refused = page({ catalogue: tried(), packages: [pack("cx-sources")], sources: [keepa(false)], refuse: true });
  await refused.view.load();
  refused.view.show({ kind: "plugin", id: "keepa" });
  await settle();
  const tryIt = (root: Node) => tryCard(root, "compare");
  (tryIt(refused.root).props["onclick"] as () => void)();
  await settle();
  await confirm(refused.host);
  await settle(); await settle();
  expect(refused.ask).not.toHaveBeenCalled();
  const fine = page({ catalogue: tried(), packages: [pack("cx-sources")], sources: [keepa(false)] });
  await fine.view.load();
  fine.view.show({ kind: "plugin", id: "keepa" });
  await settle();
  (tryIt(fine.root).props["onclick"] as () => void)();
  await settle();
  expect(fine.ask).not.toHaveBeenCalled();
  await confirm(fine.host);
  await settle(); await settle();
  expect(fine.calls).toContain('installPackage("npm:cx-keepa",true)');
  expect(fine.ask).toHaveBeenCalledTimes(1);
});

it("puts a template's sentence in the composer, the caret after it, and nothing for a send to send in its place, and on a record not installed only once the install is done", async () => {
  const held = page({ catalogue: tried() });
  await held.view.load();
  held.view.show({ kind: "plugin", id: "keepa" });
  await settle();
  click(tryCard(held.root, "track-price"));
  await settle();
  expect(held.ask.mock.calls).toEqual([["Track a price", [13, 13]]]);
  const fresh = page({ catalogue: tried(), packages: [pack("cx-sources")], sources: [keepa(false)] });
  await fresh.view.load();
  fresh.view.show({ kind: "plugin", id: "keepa" });
  await settle();
  click(tryCard(fresh.root, "track-price"));
  await settle();
  expect(fresh.ask).not.toHaveBeenCalled();
  await confirm(fresh.host);
  await settle(); await settle();
  expect(fresh.calls).toContain('installPackage("npm:cx-keepa",true)');
  expect(fresh.ask.mock.calls).toEqual([["Track a price", [13, 13]]]);
});

it("keeps the back link on the list a record was opened from as the seller steps between records, and names that list as the Plugins page", async () => {
  const { view, root } = page();
  await view.load();
  view.show({ kind: "home", view: "yours", filter: "all" });
  view.show({ kind: "plugin", id: "keepa", tab: "deps" });
  await settle();
  view.show({ kind: "plugin", id: "cx-sources" });
  await settle();
  expect(byClass(root, "back")[0]?.textContent).toContain("Keepa");
  view.show({ kind: "plugin", id: "keepa" });
  await settle();
  const back = byClass(root, "back")[0]!;
  // The link goes to the view left and names it, as the signed page has it.
  expect([back.textContent, nodes(back).find((node) => node.tag === "a")?.props["href"]]).toEqual(['pl.pg.back{"name":"pl.yours"}', "#/plugins/yours/all"]);
});

it("names the list on a record's back link when the record is opened again from the list, though it was last reached through another record", async () => {
  const { view, root } = page();
  await view.load();
  view.show({ kind: "plugin", id: "cx-sources" });
  await settle();
  view.show({ kind: "plugin", id: "keepa" });
  await settle();
  expect(byClass(root, "back")[0]?.textContent).toContain("Data Source Core");
  view.show({ kind: "home", view: "yours", filter: "all" });
  view.show({ kind: "plugin", id: "keepa" });
  await settle();
  const back = byClass(root, "back")[0]!;
  expect([back.textContent, nodes(back).find((node) => node.tag === "a")?.props["href"]]).toEqual(['pl.pg.back{"name":"pl.yours"}', "#/plugins/yours/all"]);
});

it("lists the required and the optional plugins as two lists, each under its own label and nothing said under either", async () => {
  const P = (id: string, builds: readonly { on: string; need: "required" | "optional" }[]) => ({ id, name: id.toUpperCase(), author: "someone", section: "extensions" as const, about: { en: id, zh: id }, builds: builds.map((one) => ({ ...one, why: { en: "w", zh: "w" } })), box: { package: id, skills: [] } });
  const both = withRecords(CATALOGUE, { plugins: [P("leaf", []), P("twig", []), P("both", [{ on: "leaf", need: "required" }, { on: "twig", need: "optional" }])] });
  const { view, root } = page({ catalogue: both, packages: [pack("leaf"), pack("twig"), pack("both")], features: EVERYTHING });
  await view.load();
  view.show({ kind: "plugin", id: "both", tab: "deps" });
  await settle();
  expect(byClass(root, "pl-need").map((group) => [group.tag, nodes(group).find((node) => node.tag === "h2")?.textContent, byClass(group, "pl-row-link").map((row) => row.props["href"]),
    nodes(group).filter((node) => node.tag === "p").length, byClass(group, "pl-reason").length])).toEqual([["section", "pl.dp.required", ["#/plugins/p/leaf"], 0, 0], ["section", "pl.dp.optional", ["#/plugins/p/twig"], 0, 0]]);
});

it("gives an unknown id its own line, and a deep link the loading line before the world is read", async () => {
  const early = page();
  early.view.show({ kind: "plugin", id: "keepa" });
  expect(text(early.root)).toContain("stream.loading");
  const { view, root } = page();
  await view.load();
  view.show({ kind: "plugin", id: "no-such-plugin" });
  expect(text(root)).toContain("pl.unknown");
});

it("lists and counts on Plugins it uses only the plugins it names itself, not those they build on in turn", async () => {
  const P = (id: string, builds: readonly { on: string; need: "required" | "optional" }[]) => ({ id, name: id.toUpperCase(), author: "someone", section: "extensions" as const, about: { en: id, zh: id }, builds: builds.map((one) => ({ ...one, why: { en: "w", zh: "w" } })), box: { package: id, skills: [] } });
  const catalogue = withRecords(CATALOGUE, { plugins: [P("leaf", []), P("other", [{ on: "leaf", need: "required" }]), P("mid", [{ on: "leaf", need: "required" }]), P("top", [{ on: "mid", need: "required" }, { on: "other", need: "optional" }])] });
  const { view, root } = page({ catalogue, packages: ["cx-sources", "leaf", "mid", "other", "top"].map(pack) });
  await view.load();
  view.show({ kind: "plugin", id: "top", tab: "deps" });
  await settle();
  expect([byClass(root, "pl-tab").map((tab) => tab.textContent), byClass(root, "pl-row-link").map((row) => row.props["href"])]).toEqual([["pl.tab.overview", "pl.tab.deps · 2"], ["#/plugins/p/mid", "#/plugins/p/other"]]);
});

it("says a way is connected on the Overview only where Settings says so, and counts only connected ways in the order of use", async () => {
  const world = { models: [{ id: "openai", enabled: true, ways: ["account", "platform"], month: 0 }] as unknown as readonly ModelPlugin[], accounts: [{ id: "openai", name: "OpenAI", signedIn: false, models: [] }] };
  const one = page(world);
  await one.view.load();
  one.view.show({ kind: "plugin", id: "openai" });
  await settle();
  const side = byClass(one.root, "pl-way-link").map((link) => link.textContent);
  expect(side.find((line) => line.startsWith("pl.way.account"))).toContain('pl.bill.account{"vendor":"ChatGPT"}pl.mo.connect');
  const two = page(world);
  await two.view.load();
  two.view.show({ kind: "plugin", id: "openai", tab: "settings" });
  await settle();
  const account = nodes(two.root).find((node) => node.props["id"] === "way-account")!;
  expect(account.textContent).not.toContain("pl.ms.connected");
  // A subscription waiting for sign-in is offered, not counted: the balance is the one way, which its row says, so no sentence repeats it
  // and no order to change is listed.
  expect(text(two.root)).not.toContain("pl.order.");
  expect(text(two.root)).not.toContain('pl.who.account');
  expect(byClass(two.root, "pl-up")).toEqual([]);
});

const sol = { provider: "openai", id: "gpt-6-sol", name: "GPT-6 Sol", via: "OpenAI" };

it("lists on the Overview only the model the chat is on, and leaves the rest to the link", async () => {
  const other = { ...sol, id: "gpt-6-luna", name: "GPT-6 Luna" };
  // Luna is shown in the picker through the account, yet the Overview names only the one the chat is on.
  const accounts = [{ id: "openai", name: "OpenAI", signedIn: true, models: [{ id: "gpt-6-sol", name: "GPT-6 Sol", shown: true }, { id: "gpt-6-luna", name: "GPT-6 Luna", shown: true }] }];
  const { view, root } = page({ models: [gpt], accounts, served: { current: { provider: "openai", id: "gpt-6-sol" }, available: [sol, { ...other, provider: "openai" }] } });
  await view.load();
  view.show({ kind: "plugin", id: "openai" });
  await settle();
  const table = byClass(root, "pl-models")[0]!;
  expect(nodes(table).filter((node) => node.tag === "tr").length).toBe(2);
  expect(text(table)).toContain("GPT-6 Sol");
  // The block's title says these are the models in use; no row says it again.
  expect(byClass(table, "pl-tag")).toHaveLength(0);
  expect(text(root)).toContain('pl.mo.all{"n":2}');
});

it("draws the record's shape where the record will be while the record's own reads are out, and the record once they answer", async () => {
  let go = (): void => {};
  const slow = new Promise<void>((resolve) => { go = resolve; });
  const ours: NpmPackage = { ...WEB_NPM, name: "cx-keepa", author: "ComChatX", readme: "# cx-keepa\n\nKeepa for cx.", ours: true };
  const { view, root, backend } = page({ npm: ours, catalogue: { ...CATALOGUE, plugins: CATALOGUE.plugins.filter((one) => one.box?.package !== "cx-keepa"), bundles: [] } });
  await view.load();
  // A package's page reads it from npm: held until npm answers.
  const npmPackage = backend.npmPackage.bind(backend);
  (backend as { npmPackage: Backend["npmPackage"] }).npmPackage = async (...args) => { await slow; return npmPackage(...args); };
  view.show({ kind: "plugin", id: "~cx-keepa", npm: "cx-keepa" } as never);
  await settle();
  const shape = byClass(root, "sk");
  // The head, the tabs and the columns stand in the record's own frame; the words are a screen reader's alone, and no heading is drawn.
  expect([shape.length, shape[0]?.props["aria-busy"], byClass(root, "unseen")[0]?.textContent, ["pl-head", "pl-tabs", "pl-columns"].map((one) => byClass(shape[0]!, one).length), nodes(root).filter((node) => node.tag === "h1").length]).toEqual([1, "true", "stream.loading", [1, 1, 1], 0]);
  go();
  await settle();
  expect([byClass(root, "sk").length, nodes(root).find((node) => node.tag === "h1")?.textContent]).toEqual([0, "cx-keepa"]);
});

it("keeps a held vendor serving nothing its page, saying so once and selling no model; a failed read keeps every record page", async () => {
  const { view, root } = page({ models: [gpt], served: { current: undefined, available: [] } });
  await view.load();
  view.show({ kind: "plugin", id: "openai" });
  await settle();
  // Installed, reached by a key and holding none: the key is what it waits for.
  expect(byClass(root, "pl-idle").map((one) => one.textContent)).toEqual(["pl.mo.keyFirst"]);
  expect(text(root)).not.toContain("pl.ov.description");
  expect(byClass(root, "pl-tab").map((tab) => tab.textContent)).not.toContain("pl.tab.models");
  const failed = page({ unread: true });
  await failed.view.load();
  failed.view.show({ kind: "plugin", id: "openai" });
  await settle();
  expect(text(failed.root)).toContain("pl.unread");
  expect(text(failed.root)).not.toContain("pl.unknown");
});

describe("a vendor serving nothing today", () => {
  const IDLE = { current: undefined, available: [] };
  const keyed = [{ id: "openai", name: "OpenAI", platformKey: true, ownKey: true, models: [], rates: [] }];
  /** The line under the head, and where the page holds the package's Overview and the ways' heading, in the order they are drawn. */
  const drawn = async (world: Parameters<typeof page>[0], id = "openai"): Promise<{ readonly line: readonly unknown[]; readonly overview: readonly string[]; readonly order: readonly string[] }> => {
    const { view, root } = page({ served: IDLE, ...world });
    await view.load();
    view.show({ kind: "plugin", id });
    await settle();
    const all = nodes(root);
    return {
      line: byClass(root, "pl-idle").map((one) => one.textContent),
      overview: byClass(root, "pl-readme").map((one) => String((one as unknown as { innerHTML: string }).innerHTML)),
      order: all.flatMap((node) => (byClass(node, "pl-readme").includes(node) ? ["overview"] : node.tag === "h2" && node.textContent === "pl.mo.ways" ? ["ways"] : [])),
    };
  };
  it("holding no key, draws its package's Overview over the ways it is reached by, and says the key comes first", async () => {
    const seen = await drawn({ models: [gpt] });
    expect([seen.line, seen.order]).toEqual([["pl.mo.keyFirst"], ["overview", "ways"]]);
    expect(seen.overview[0]).toContain("GPT is OpenAI");
  });
  it("with no Overview of its own, draws the ways alone, as before", async () => {
    const bare = { ...pinned, plugins: pinned.plugins.map((one) => (one.id === "openai" ? { ...one, description: undefined } : one)) } as Catalogue;
    const seen = await drawn({ models: [gpt], catalogue: bare });
    expect([seen.line, seen.order]).toEqual([["pl.mo.keyFirst"], ["ways"]]);
  });
  it("holding a key, says its vendor lists nothing here", async () => {
    expect((await drawn({ models: [gpt], providers: keyed })).line).toEqual(['pl.mt.none{"vendor":"OpenAI"}']);
  });
  it("where the page's read of keys failed and the record's own read found the key, says what its key row says: held", async () => {
    const { view, root, backend } = page({ served: IDLE, models: [gpt] });
    const reads: string[] = [];
    (backend as { providers: () => Promise<unknown> }).providers = async () => {
      reads.push("providers");
      if (reads.length === 1) throw new Error("unread");
      return keyed;
    };
    await view.load();
    view.show({ kind: "plugin", id: "openai" });
    await settle();
    expect([reads.length, byClass(root, "pl-idle").map((one) => one.textContent), text(root).includes("pl.mo.keyFirst")]).toEqual([2, ['pl.mt.none{"vendor":"OpenAI"}'], false]);
  });
  it("installed and reached by no key, as by the balance alone, says no model is available today", async () => {
    expect((await drawn({ models: [{ id: "tencent", enabled: true, ways: ["platform"], month: 0 }] }, "tencent")).line).toEqual(["pl.mo.idle"]);
  });
});

it("puts a template that asks for words after its name in the composer as its sentence alone, with no hint, and sends nothing", async () => {
  const { view, root, ask } = page({ catalogue: tried() });
  await view.load();
  view.show({ kind: "plugin", id: "keepa" });
  await settle();
  click(tryCard(root, "compare"));
  await settle();
  expect(ask.mock.calls).toEqual([["Compare two products", [20, 20]]]);
});

it("writes a month's total under a cent as less than a cent in Yours, and $0.00 only for nothing", async () => {
  const small = { ...keepa(true), month: { since: 0, spent: 5_000 } } as unknown as Source;
  const two = page({ sources: [small] });
  await two.view.load();
  two.view.show({ kind: "home", view: "yours", filter: "all" });
  await settle();
  expect(text(two.root)).toContain('pl.month{"amount":"pl.lessThan{\\"amount\\":\\"$0.01\\"}"}');
  const three = page({ sources: [{ ...keepa(true), month: { since: 0, spent: 0 } } as unknown as Source] });
  await three.view.load();
  three.view.show({ kind: "home", view: "yours", filter: "all" });
  await settle();
  expect(text(three.root)).toContain('pl.month{"amount":"$0.00"}');
});

it("tags a model's row in Yours only with the ways the order of use counts", async () => {
  const { view, root } = page({ models: [{ id: "openai", enabled: true, ways: ["account", "platform"], month: 0 }] as unknown as readonly ModelPlugin[], accounts: [{ id: "openai", name: "OpenAI", signedIn: false, models: [] }] });
  await view.load();
  view.show({ kind: "home", view: "yours", filter: "all" });
  await settle();
  const tags = byClass(root, "pl-tag").map((tag) => tag.textContent);
  expect(tags).toContain("card.platform");
  expect(tags).not.toContain("pl.way.account");
});

it("holds back the lines that depend on what is held when that read failed", async () => {
  const { view, root } = page({ unread: true, models: [{ id: "openai", enabled: true, ways: ["platform"], month: 0 }] as unknown as readonly ModelPlugin[] });
  await view.load();
  view.show({ kind: "plugin", id: "openai", tab: "models" });
  await settle();
  expect(text(root)).toContain("pl.unread");
  expect(text(root)).not.toContain("pl.mt.install");
  view.show({ kind: "plugin", id: "openai" });
  await settle();
  expect(text(root)).not.toContain("pl.mo.connect");
  expect(text(root)).not.toContain("pl.mo.connected");
});

it("says under the row why a sign-in ended without success, quoting the flow's words, and stores no way", async () => {
  const { view, root, calls, backend } = page({ models: [{ id: "openai", enabled: true, ways: ["platform"], month: 0 }] as unknown as readonly ModelPlugin[], accounts: [{ id: "openai", name: "OpenAI", signedIn: false, models: [] }] });
  vi.mocked(backend.signIn).mockRejectedValueOnce(new SignInEnded("refused", "ChatGPT authorization failed: access_denied"));
  await view.load();
  view.show({ kind: "plugin", id: "openai", tab: "settings" });
  await settle();
  click(nodes(root).find((node) => node.tag === "button" && node.textContent.startsWith("pl.ms.signIn"))!);
  await settle(); await settle();
  expect(calls.some((call) => call.startsWith("setModelWays"))).toBe(false);
  const last = byClass(root, "pl-last");
  expect(last.map((line) => line.textContent)).toEqual(['signIn.refused signIn.quoted{"words":"ChatGPT authorization failed: access_denied"}']);
  expect(String(last[0]!.props["class"])).toContain("pl-failed");
});

it("removes a plugin only through its card, then returns to the list", async () => {
  const { view, root, host, calls } = page();
  vi.stubGlobal("location", { hash: "" });
  await view.load();
  view.show({ kind: "home", view: "yours", filter: "all" });
  view.show({ kind: "plugin", id: "cx-topics" });
  await settle();
  click(byClass(root, "f-menu-row")[0]!);
  await settle();
  expect(calls).toEqual([]);
  expect(byClass(host, "pl-card-dialog")[0]!.textContent).toContain('pl.c.removeTitle{"name":"Chat Chapters"}');
  await confirm(host);
  await settle();
  // Its removal breaks the bundle no press made, which then holds nothing: Jev, which it requires, goes with it.
  expect(calls).toEqual(['installPackage("npm:@comchatx/cx-topics",false)', 'installModel("jev",false)']);
  expect((globalThis.location as { hash: string }).hash).toBe("#/plugins/yours/all");
  vi.unstubAllGlobals();
});

it("removes from a bundle only what nothing else uses, the rest its rows' switches held on", async () => {
  const { view, root, host, calls } = page({ pressed: [{ bundle: "pinned", at: 0, brought: ["cx-sources", "cx-topics"] }] });
  vi.stubGlobal("location", { hash: "" });
  await view.load();
  view.show({ kind: "bundle", id: "pinned" });
  await settle();
  click(byClass(root, "f-menu-row")[0]!);
  await settle();
  // Keepa's read names cx-sources as its base, so cx-sources stays: its row's switch is on, and holds.
  const held = nodes(byClass(host, "pl-card-dialog")[0]!).filter((node) => node.props["role"] === "switch").map((node) => [node.props["aria-label"], node.props["aria-checked"]]);
  expect(held).toContainEqual(['pl.c.keep{"name":"Data Source Core"}', "true"]);
  await confirm(host);
  await settle();
  // One request for the bundle; then Jev, the model Conversation Titles needs, which nothing staying uses.
  expect(calls).toEqual(['removeBundle("pinned",["npm:@comchatx/cx-topics"])', 'installModel("jev",false)']);
  vi.unstubAllGlobals();
});

it("takes a plugin installed on its own when the bundle that lists it is removed, as any other it installs", async () => {
  // cx-sources was installed before the press, so the press brought only Conversation Titles; the Remove takes both all the same.
  const { view, root, host, calls, box } = page({ packages: [pack("cx-sources"), pack("@comchatx/cx-topics")], sources: [], pressed: [{ bundle: "pinned", at: 0, brought: ["cx-topics"] }] });
  vi.stubGlobal("location", { hash: "" });
  await view.load();
  view.show({ kind: "bundle", id: "pinned" });
  await settle();
  click(byClass(root, "f-menu-row")[0]!);
  await settle();
  expect(["Data Source Core", "Chat Chapters", "Jev"].every((name) => byClass(host, "pl-card-dialog")[0]!.textContent.includes(name))).toBe(true);
  await confirm(host);
  await settle();
  expect(calls).toEqual(['removeBundle("pinned",["npm:@comchatx/cx-topics","npm:cx-sources"])', 'installModel("jev",false)']);
  expect(box.world.list.packages.map((one) => one.name)).toEqual([]);
  vi.unstubAllGlobals();
});

it("closes an open card as Cancel when the seller leaves the page, so nothing acts on a page they left", async () => {
  const listeners: Record<string, () => void> = {};
  vi.stubGlobal("addEventListener", (type: string, listener: () => void) => { listeners[type] = listener; });
  vi.stubGlobal("removeEventListener", (type: string) => { delete listeners[type]; });
  const { view, root, host, calls } = page();
  await view.load();
  view.show({ kind: "plugin", id: "cx-sources" });
  await settle();
  click(byClass(byClass(root, "pl-head")[0]!, "f-switch")[0]!);
  await settle();
  expect(byClass(host, "pl-card-dialog")).toHaveLength(1);
  listeners["hashchange"]!();
  await settle();
  expect(listeners["hashchange"]).toBeUndefined();
  expect(calls).toEqual([]);
  vi.unstubAllGlobals();
});

const WEB_NPM: NpmPackage = {
  name: "pi-web-access", description: "Web search and URL fetching for Pi.", kinds: ["extension"], author: "Nico Bailon", downloads: 762_066, updated: "2026-09-20T00:00:00.000Z",
  version: "0.42.0", repository: "https://github.com/nicobailon/pi-web-access", readme: "# pi-web-access\n\nSearches the web.", readme_cut: false, ours: false,
  shipped: { skills: [], prompts: [], unread: [] }, uses: [],
};
const WEB_AT = { kind: "plugin", id: "~pi-web-access", npm: "pi-web-access" } as const;
const fetched: Package = { name: "pi-web-access", source: "npm:pi-web-access", version: "0.40.0", enabled: true, about: { en: "a", zh: "a" }, description: { en: "d", zh: "d" } };
const links = (root: Node): (readonly unknown[])[] => byClass(root, "pl-page-links").flatMap((line) => nodes(line)).filter((node) => node.tag === "a").map((link) => [link.props["href"], link.props["target"], link.textContent]);

it("draws a package of pi's gallery on its own page from what npm says of it: the third-party mark, who published it, the version an install gets, its downloads and age, and a security note, then its npm page, its repository and 反馈", async () => {
  const { view, root, host, calls } = page({ packages: [], npm: WEB_NPM });
  await view.load();
  view.show(WEB_AT as never);
  await settle(); await settle();
  expect([nodes(root).find((node) => node.tag === "h1")?.textContent, byClass(root, "pl-head-meta")[0]!.textContent]).toEqual(["pi-web-access", 'pl.by{"name":"Nico Bailon"} · 0.42.0 · pl.npm.downloads{"n":"762K"} · pl.head.updated{"when":"8 days ago"} pl.third.mark']);
  expect(byClass(root, "pl-unchecked")).toEqual([]);
  const maker = byClass(root, "pl-maker")[0]!;
  expect(nodes(maker).filter((node) => node.tag === "h2" || (node.tag === "p" && byClass(node, "pl-sr").length === 0)).map((line) => line.textContent)).toEqual(["pl.third.title", "pl.third.note"]);
  expect(links(root)).toEqual([["https://www.npmjs.com/package/pi-web-access", "_blank", "pl.third.npmpl.third.outside"], [WEB_NPM.repository, "_blank", "pl.third.githubpl.third.outside"], [`${WEB_NPM.repository}/issues`, "_blank", "pl.third.reportpl.third.outside"]]);
  expect(byClass(byClass(root, "pl-side")[0]!, "pl-part").map((cell) => nodes(cell).find((node) => node.tag === "h2")?.textContent)).toEqual(["pl.third.title"]);
  // Its one tab is its README, which npm gave: nothing reads the package's files on cx's computer, where it is not.
  expect(byClass(root, "pl-tab").map((tab) => [tab.textContent, tab.props["href"]])).toEqual([["pl.tab.overview", "#/plugins/n/pi-web-access/overview"]]);
  expect(byClass(root, "pl-readme")).toHaveLength(1);
  // The click installs it from npm, the registry's current, by pi's own install, through the card that names who made it.
  (nodes(byClass(root, "pl-head")[0]!).find((node) => node.tag === "button" && node.textContent === "+ pl.install")!.props["onclick"] as () => void)();
  await settle();
  expect(byClass(host, "pl-card-dialog").at(-1)!.textContent).toContain("pl.c.thirdIn1");
  await confirm(host);
  await settle();
  expect(calls).toEqual(['installPackage("npm:pi-web-access",true)']);
});

it("draws a gallery package from what npm's newest ships, installed or not: its README though npm's record has none, its skills, its templates, and each plugin it depends on, a record or not", async () => {
  // The platform names in `uses` the plugins alone: ours, and what the gallery lists, whether or not the page holds a record of it.
  const adapter: NpmPackage = { ...WEB_NPM, name: "pi-mcp-adapter", description: "Adapts MCP servers.", author: "Someone", uses: [] };
  const shipping: NpmPackage = { ...WEB_NPM, readme: "", uses: ["cx-sources", "pi-mcp-adapter", "pi-unanswered"], shipped: {
    readme: "# pi-web-access\n\nSearches the web from its own files.", skills: [{ name: "search", description: "Searches the web." }], prompts: [{ name: "find", description: "Find a page" }], unread: [],
  } };
  const fresh = page({ packages: [], npm: shipping, others: [adapter] });
  await fresh.view.load();
  fresh.view.show(WEB_AT as never);
  await settle(); await settle();
  expect(fresh.backend.npmPackage).toHaveBeenCalledWith("pi-web-access");
  expect([byClass(fresh.root, "pl-readme").length, text(fresh.root).includes("pl.own.nothing")]).toEqual([1, false]);
  expect(byClass(fresh.root, "pl-try").map((one) => one.textContent)).toEqual(["› Find a page"]);
  expect(byClass(fresh.root, "pl-tab").map((tab) => tab.textContent)).toEqual(["pl.tab.overview", "pl.tab.deps · 3"]);
  fresh.view.show({ ...WEB_AT, tab: "deps" } as never);
  await settle();
  // One the catalogue holds no record of is the gallery's, in npm's words where npm answered its name, and by its name where it did not.
  expect(byClass(fresh.root, "pl-row-link").map((row) => row.props["href"])).toEqual(["#/plugins/p/cx-sources", "#/plugins/n/pi-mcp-adapter", "#/plugins/n/pi-unanswered"]);
  expect(text(byClass(fresh.root, "pl-row")[1]!)).toContain("Adapts MCP servers.");
  for (const name of ["pi-mcp-adapter", "pi-unanswered"]) expect(fresh.backend.npmPackage).toHaveBeenCalledWith(name);
  // Held at an older version, it is drawn at npm's newest all the same: the version cx's computer holds is only its head's number.
  const held = page({ packages: [fetched], npm: shipping });
  await held.view.load();
  held.view.show(WEB_AT as never);
  await settle(); await settle();
  expect(held.backend.npmPackage).toHaveBeenCalledWith("pi-web-access");
  expect(held.backend.npmPackage).not.toHaveBeenCalledWith("pi-web-access", "0.40.0");
  expect([String(byClass(held.root, "pl-readme")[0]?.innerHTML).includes("Searches the web from its own files."), byClass(held.root, "pl-try").map((one) => one.textContent)]).toEqual([true, ["› Find a page"]]);
  expect(byClass(held.root, "pl-head-meta")[0]!.textContent).toContain(" · 0.40.0 · ");
});

it("names, once the package is held, the version cx's computer holds rather than npm's newer one, and the source npm gives before the package's own", async () => {
  const held = page({ packages: [{ ...fetched, home: "https://example.test/code" }], npm: WEB_NPM });
  await held.view.load();
  held.view.show(WEB_AT as never);
  await settle(); await settle();
  expect(byClass(held.root, "pl-head-meta")[0]!.textContent).toContain(" · 0.40.0 · ");
  expect(nodes(byClass(held.root, "pl-head")[0]!).filter((node) => node.props["role"] === "switch")).toHaveLength(1);
  expect(links(held.root).map(([to]) => to)).toEqual(["https://www.npmjs.com/package/pi-web-access", WEB_NPM.repository, `${WEB_NPM.repository}/issues`]);
  // Where npm gives no source, the package's own home is the link.
  const bare = page({ packages: [{ ...fetched, home: "https://example.test/code" }], npm: { ...WEB_NPM, repository: undefined } as unknown as NpmPackage });
  await bare.view.load();
  bare.view.show(WEB_AT as never);
  await settle(); await settle();
  expect(links(bare.root).map((link) => link.slice(0, 1).concat(link.slice(2)))).toEqual([["https://www.npmjs.com/package/pi-web-access", "pl.third.npmpl.third.outside"], ["https://example.test/code", "pl.third.sourcepl.third.outside"]]);
});

it("draws a gallery package npm could not be asked about from what the list holds, says npm did not answer, and an address npm knows nothing at as nothing", async () => {
  const { view, root } = page({ packages: [fetched], npm: "unreachable" });
  await view.load();
  view.show(WEB_AT as never);
  await settle(); await settle();
  // What the page could not read it claims nothing of: no author unstated, no description absent.
  expect(byClass(root, "pl-head-meta")[0]!.textContent).toBe("0.40.0 pl.third.mark");
  expect(byClass(root, "pl-main")[0]!.textContent).toContain("pl.npm.unread");
  expect(byClass(root, "pl-main")[0]!.textContent).not.toContain("pl.own.nothing");
  expect(links(root).map(([to]) => to)).toEqual(["https://www.npmjs.com/package/pi-web-access"]);
  const unknown = page({ packages: [] });
  await unknown.view.load();
  unknown.view.show({ kind: "plugin", id: "~pi-nothing", npm: "pi-nothing" } as never);
  await settle(); await settle();
  expect(text(unknown.root)).toContain("pl.unknown");
});

it("draws a package whose files are gone as held, with no version and a line that says so, and removes it from the page by its source", async () => {
  const { view, root, host, calls } = page({ packages: [{ ...fetched, version: "", missing: true }], npm: WEB_NPM });
  vi.stubGlobal("location", { hash: "" });
  await view.load();
  view.show(WEB_AT as never);
  await settle(); await settle();
  const head = byClass(root, "pl-head-text")[0]!;
  expect(byClass(head, "pl-head-meta")[0]!.textContent).toBe('pl.by{"name":"Nico Bailon"} · pl.npm.downloads{"n":"762K"} · pl.head.updated{"when":"8 days ago"} pl.chip.missing');
  expect(byClass(head, "pl-head-off").map((line) => line.textContent)).toEqual(["pl.head.missing"]);
  click(byClass(root, "f-menu-row")[0]!);
  await settle();
  await confirm(host);
  await settle();
  expect(calls).toEqual(['installPackage("npm:pi-web-access",false)']);
  vi.unstubAllGlobals();

  const whole = page({ packages: [fetched], npm: WEB_NPM });
  await whole.view.load();
  whole.view.show(WEB_AT as never);
  await settle(); await settle();
  expect(byClass(whole.root, "pl-head-off")).toEqual([]);
});

it("draws no link for a home that is not an https address, and no maker's panel on a plugin ComChatX made", async () => {
  const { view, root } = page({ packages: [{ ...fetched, home: "javascript:alert(1)" }], npm: "unreachable" });
  await view.load();
  view.show(WEB_AT as never);
  await settle(); await settle();
  expect(links(root).map(([to]) => to)).toEqual(["https://www.npmjs.com/package/pi-web-access"]);
  view.show({ kind: "plugin", id: "cx-sources" });
  await settle();
  expect(nodes(root).find((node) => node.tag === "h1")?.textContent).toBe(CATALOGUE.plugins.find((one) => one.id === "cx-sources")!.name);
  expect(byClass(root, "pl-maker")).toEqual([]);
});

it("draws no side card on a plugin ComChatX made that reads no data source and npm does not hold, though it builds on a third party's", async () => {
  const theirs = { id: "theirs", name: "Theirs", author: "Someone", section: "extensions" as const, about: { en: "t", zh: "t" }, builds: [], box: { package: "theirs", skills: [] } };
  const builder = { id: "builder", name: "Builder", author: "ComChatX", section: "extensions" as const, about: { en: "b", zh: "b" }, builds: [{ on: "theirs", need: "required" as const, why: { en: "w", zh: "w" } }], box: { package: "builder", skills: [] } };
  const { view, root } = page({ catalogue: withRecords(CATALOGUE, { plugins: [theirs, builder] }) });
  await view.load();
  view.show({ kind: "plugin", id: "builder" });
  await settle();
  expect([byClass(root, "pl-side"), root.textContent!.includes("pl.side.title")]).toEqual([[], false]);
});

it("names in a package's 数据源 the data sources its checks read, from what 用到的插件 lists, and says none only where it reads none", async () => {
  // cx-featured-offer as our organization publishes it: SP-API required for the store, Keepa for the Featured Offer's history.
  const featured = { id: "cx-featured-offer", name: "cx-featured-offer", author: "ComChatX", section: "extensions" as const, about: { en: "f", zh: "f" },
    builds: [{ on: "amazon-sp-api", need: "required" as const, why: { en: "w", zh: "w" } }, { on: "keepa", need: "optional" as const, why: { en: "w", zh: "w" } }], box: { package: "cx-featured-offer", skills: [] } };
  const { view, root } = page({ catalogue: withRecords(CATALOGUE, { plugins: [featured] }) });
  await view.load();
  view.show({ kind: "plugin", id: "cx-featured-offer" });
  await settle();
  const side = byClass(root, "pl-side")[0]!;
  expect([byClass(side, "pl-side-row").map((row) => row.props["href"]), side.textContent.includes("pl.side.none")]).toEqual([["#/plugins/p/amazon-sp-api", "#/plugins/p/keepa"], false]);
});

it("draws no 数据源 box on a data source's own page, where the box would name only the page's own package", async () => {
  const { view, root } = page({});
  await view.load();
  view.show({ kind: "plugin", id: "keepa" });
  await settle();
  expect([byClass(root, "pl-main").length, byClass(byClass(root, "pl-side")[0]!, "pl-part").map((cell) => nodes(cell).find((node) => node.tag === "h2")?.textContent)]).toEqual([1, ["pl.ov.pay"]]);
  expect(root.textContent).not.toContain("pl.side.title");
});

it("draws no side column for a data source's record that names no source, and the security note alone where a third party made it", async () => {
  const door = { id: "door", name: "Door", author: "ComChatX", section: "data" as const, about: { en: "d", zh: "d" }, builds: [], box: { package: "door", skills: [] } };
  const theirs = { ...door, id: "theirs", name: "Theirs", author: "Someone", box: { package: "theirs", skills: [] } };
  const { view, root } = page({ catalogue: withRecords(CATALOGUE, { plugins: [door, theirs] }) });
  await view.load();
  view.show({ kind: "plugin", id: "door" });
  await settle();
  expect([byClass(root, "pl-main").length, byClass(root, "pl-side")]).toEqual([1, []]);
  expect(root.textContent).not.toContain("pl.side.none");
  view.show({ kind: "plugin", id: "theirs" });
  await settle();
  const side = byClass(root, "pl-side")[0]!;
  expect([side.textContent.includes("pl.side.title"), side.textContent.includes("pl.side.none"), byClass(side, "pl-maker").length]).toEqual([false, false, 1]);
});

// Installed from a folder on cx's computer, so nothing but the package says anything of it.
const ownPack = (over: Partial<Package> = {}): Package => ({ ...pack("pi-fees"), source: "/home/seller/pi-fees", about: { en: "Explains fees.", zh: "解释费用。" }, description: { en: "Longer words.", zh: "更长的说明。" }, origin: "seller", ...over }) as Package;

it("draws a package the person installed themselves on its own page: marked a third party's, its README as the Overview, the switch and Remove any plugin has", async () => {
  const { view, root } = page({ packages: [pack("cx-sources"), ownPack({ author: "Someone", version: "0.3.1" })], readme: { name: "README.md", text: "# pi-fees\n\nReads a fee preview." } });
  await view.load();
  view.show({ kind: "plugin", id: "~pi-fees" });
  await settle(); await settle();
  const head = byClass(root, "pl-head")[0]!;
  expect([byClass(head, "pl-chip").map((one) => one.textContent), byClass(head, "pl-unchecked")]).toEqual([["pl.third.mark"], []]);
  expect(byClass(head, "pl-head-meta")[0]!.textContent).toContain('pl.head.meta{"author":"Someone","version":"0.3.1"}');
  expect(nodes(head).filter((node) => node.props["role"] === "switch")).toHaveLength(1);
  expect(byClass(head, "pl-more")).toHaveLength(1);
  expect(byClass(root, "pl-readme")).toHaveLength(1);
  // The README stands in place of the package's own line, which it would repeat.
  expect(byClass(root, "pl-main")[0]!.textContent).not.toContain("Longer words.");
  expect(root.textContent).toContain("pl.own.note");
  // Nothing read the package, so its page states nothing about the data it may have cx buy.
  const side = byClass(root, "pl-side")[0]!;
  expect(side.textContent).not.toContain("pl.side.title");
  expect(side.textContent).not.toContain("pl.side.none");
  expect(byClass(side, "pl-maker")).toHaveLength(1);
});

it("still draws a self-installed package that ships no README, one that says nothing of itself, and one whose README is too large", async () => {
  const told = page({ packages: [ownPack()] });
  await told.view.load();
  told.view.show({ kind: "plugin", id: "~pi-fees" });
  await settle(); await settle();
  // With no README, what it says of itself is its Overview, drawn as markdown under no heading.
  expect(byClass(told.root, "pl-readme").map((one) => (one as unknown as { innerHTML: string }).innerHTML)).toEqual(["<p>Longer words.</p>\n"]);
  expect(byClass(told.root, "pl-head-meta")[0]!.textContent).toContain("pl.own.by · 1.0.0");

  const bare = page({ packages: [ownPack({ version: "", about: { en: "", zh: "" }, description: { en: "", zh: "" } })] });
  await bare.view.load();
  bare.view.show({ kind: "plugin", id: "~pi-fees" });
  await settle(); await settle();
  expect(byClass(bare.root, "pl-main")[0]!.textContent).toBe("pl.own.nothing");
  expect(byClass(bare.root, "pl-head-meta")[0]!.textContent).toBe("pl.own.by pl.third.mark");

  const large = page({ packages: [ownPack()] });
  (large.backend as { readme: Backend["readme"] }).readme = async () => { throw new Error("readme_too_large"); };
  await large.view.load();
  large.view.show({ kind: "plugin", id: "~pi-fees" });
  await settle(); await settle();
  expect([byClass(large.root, "pl-readme").map((one) => (one as unknown as { innerHTML: string }).innerHTML), byClass(large.root, "pl-main")[0]!.textContent]).toEqual([["<p>Longer words.</p>\n"], "pl.own.tooLong"]);
});

it("offers the switch and the Remove of a package cx Core Bundle installs, as of any other that is installed, whatever else the platform offers", async () => {
  for (const features of [EVERYTHING, FIRST_RELEASE]) {
    const { view, root } = page({ features, packages: [pack("cx-sources"), pack("@comchatx/cx-topics")] });
    await view.load();
    view.show({ kind: "plugin", id: "cx-topics" });
    await settle();
    const head = byClass(root, "pl-head")[0]!;
    expect(nodes(head).filter((node) => node.props["role"] === "switch")).toHaveLength(1);
    expect(byClass(head, "pl-more")).toHaveLength(1);
  }
});

describe("a member of the organization", () => {
  const head = (root: Node): Node => byClass(root, "pl-head")[0]!;
  const presses = (root: Node): Node[] => nodes(root).filter((node) => node.tag === "button" || node.props["role"] === "switch");

  it("is told under the name that the organization manages the plugin, and its head says only whether it is on", async () => {
    const member = page({ member: true, packages: [pack("cx-sources"), pack("@comchatx/cx-topics")] });
    await member.view.load();
    member.view.show({ kind: "plugin", id: "cx-topics" });
    await settle();
    expect(byClass(head(member.root), "pl-head-off").map((line) => [line.props["data-key"], line.textContent])).toEqual([["org.pluginManaged", "org.pluginManaged"]]);
    expect([nodes(head(member.root)).filter((node) => node.props["role"] === "switch"), byClass(head(member.root), "pl-more")]).toEqual([[], []]);
    expect(byClass(head(member.root), "pl-head-tools")[0]!.textContent).toBe("pl.switch.on");

    const admin = page({ packages: [pack("cx-sources"), pack("@comchatx/cx-topics")] });
    await admin.view.load();
    admin.view.show({ kind: "plugin", id: "cx-topics" });
    await settle();
    expect(byClass(head(admin.root), "pl-head-off")).toEqual([]);
    expect([nodes(head(admin.root)).filter((node) => node.props["role"] === "switch").length, byClass(head(admin.root), "pl-more").length]).toEqual([1, 1]);
  });

  it("is offered no install of a plugin not installed, and no 试一试 for it", async () => {
    const member = page({ member: true, packages: [pack("cx-sources")] });
    await member.view.load();
    member.view.show({ kind: "plugin", id: "cx-topics" });
    await settle();
    expect(presses(head(member.root))).toEqual([]);
    expect(byClass(head(member.root), "pl-head-tools")[0]!.textContent).toBe("pl.side.notInstalled");
    expect(byClass(member.root, "pl-tries")).toEqual([]);

    const admin = page({ packages: [pack("cx-sources")] });
    await admin.view.load();
    admin.view.show({ kind: "plugin", id: "cx-topics" });
    await settle();
    expect(presses(head(admin.root)).length).toBeGreaterThan(0);
  });

  it("is told a bundle is the organization's, and offered no install of it nor its ⋮", async () => {
    for (const packages of [[pack("cx-sources")], [pack("cx-sources"), pack("@comchatx/cx-topics")]]) {
      const member = page({ member: true, packages });
      await member.view.load();
      member.view.show({ kind: "bundle", id: "pinned" });
      await settle();
      expect(byClass(head(member.root), "pl-head-off").map((line) => line.props["data-key"])).toEqual(["org.bundleManaged"]);
      expect([presses(head(member.root)), byClass(head(member.root), "pl-more")]).toEqual([[], []]);
    }
  });

  it("is shown on a model's Settings the ways that pay, with no press, and no link to choose the chat's vendors", async () => {
    const member = page({ member: true });
    await member.view.load();
    member.view.show({ kind: "plugin", id: "jev", tab: "settings" });
    await settle(); await settle();
    const main = byClass(member.root, "pl-way-list")[0]!;
    expect([presses(main), byClass(member.root, "pl-up"), byClass(member.root, "pl-choose")]).toEqual([[], [], []]);
    expect(main.textContent).toContain("pl.ms.connected");

    const admin = page();
    await admin.view.load();
    admin.view.show({ kind: "plugin", id: "jev", tab: "settings" });
    await settle(); await settle();
    expect([presses(byClass(admin.root, "pl-way-list")[0]!).length > 0, byClass(admin.root, "pl-choose").length]).toEqual([true, 1]);
  });
});

it("turns Install while the click is written down, pressable by no one, with no words but its name for a screen reader and no line under the header", async () => {
  vi.useFakeTimers();
  try {
    let answer!: () => void;
    const { view, root } = page({ packages: [pack("cx-sources")], wait: new Promise<void>((resolve) => { answer = resolve; }) });
    await view.load();
    view.show({ kind: "plugin", id: "cx-topics" });
    await vi.advanceTimersByTimeAsync(0);
    (nodes(root).find((node) => node.tag === "button" && String(node.textContent).includes("pl.install"))!.props["onclick"] as () => void)();
    await vi.advanceTimersByTimeAsync(0);
    const busy = (): unknown[] => byClass(root, "pl-busy").map((one) => [one.textContent, one.props["aria-label"], one.props["disabled"], one.props["aria-disabled"], one.props["data-focus"], one.props["onclick"], byClass(one, "pl-spin").length]);
    // It takes no press and is not disabled, so the keyboard Install had stays on it.
    const turning = [["", 'pl.doing.installName{"name":"Chat Chapters"}', undefined, "true", "tool", undefined, 1]];
    expect(busy()).toEqual(turning);
    expect(nodes(byClass(root, "pl-head")[0]!).filter((node) => node.props["role"] === "switch")).toHaveLength(0);
    expect(byClass(root, "pl-working")).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect([busy(), byClass(root, "pl-working").length]).toEqual([turning, 0]);
    answer();
    await vi.advanceTimersByTimeAsync(0); await vi.advanceTimersByTimeAsync(0);
    expect(byClass(root, "pl-busy")).toHaveLength(0);
  } finally { vi.useRealTimers(); }
});

it("draws a switch or a removal as the seller asked once it is written down, while cx's computer is still at it, and says nothing of it until the computer has done it", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("location", { hash: "#/plugins/p/cx-topics" });
  try {
    const flip = (root: Node): void => click(byClass(root, "f-switch")[0]!);
    for (const [act, press, packages] of [["off", flip, undefined], ["on", flip, [pack("cx-sources"), { ...pack("@comchatx/cx-topics"), enabled: false }]], ["remove", (root: Node) => { click(byClass(root, "f-menu-row")[0]!); }, undefined]] as const) {
      (globalThis.location as { hash: string }).hash = "#/plugins/p/cx-topics";
      const { view, root, host, box } = page({ hold: true, ...(packages === undefined ? {} : { packages: packages as readonly Package[] }) });
      await view.load();
      view.show({ kind: "plugin", id: "cx-topics" });
      await vi.advanceTimersByTimeAsync(0);
      press(root);
      await vi.advanceTimersByTimeAsync(0);
      if (byClass(host, "pl-card-dialog").length > 0) void confirm(host);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      const drawn = (): unknown => (act === "remove" ? (globalThis.location as { hash: string }).hash : byClass(root, "f-switch").map((one) => [one.props["aria-checked"], one.props["aria-busy"]]));
      const asked = act === "remove" ? "#/plugins" : [[String(act === "on"), undefined]];
      expect([drawn(), byClass(root, "pl-busy").length, byClass(root, "pl-working").length, box.world.list.waiting?.length, text(root).includes(`pl.toast`)], act).toEqual([asked, 0, 0, 1, false]);
      await vi.advanceTimersByTimeAsync(60_000);
      expect([drawn(), text(root).includes(`pl.toast`)], act).toEqual([asked, false]);
    }
  } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
});

it("says an answer that is a fact about the plugin once, as no failure, with nothing to try", async () => {
  const { view, root } = page({ packages: [pack("cx-sources")], refuse: "not_listed" });
  await view.load();
  view.show({ kind: "plugin", id: "cx-topics" });
  await settle();
  (nodes(root).find((node) => node.tag === "button" && String(node.textContent).includes("pl.install"))!.props["onclick"] as () => void)();
  await settle(); await settle();
  expect(byClass(root, "pl-failed")).toHaveLength(0);
  expect(byClass(root, "pl-fact").map((one) => [one.textContent, one.props["role"]])).toEqual([["pl.why.gone", "status"]]);
  // A plugin the catalogue offers stays on its own page, not installed, with its Install.
  expect(nodes(root).some((node) => node.tag === "button" && String(node.textContent).includes("pl.install"))).toBe(true);
  expect(byClass(root, "pl-again")).toHaveLength(0);
});

it("draws a click on a sleeping computer as asked once written down: an install in the queue under the still ring and said to have gone there, a removal landed and a switch turned with nothing said", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("location", { hash: "#/plugins/p/cx-topics" });
  try {
    const waits = async (world: Parameters<typeof page>[0], press: (root: Node) => void): Promise<Node> => {
      const { view, root, host, box } = page({ ...world, hold: true });
      box.world.list = { ...box.world.list, asleep: true };
      await view.load();
      view.show({ kind: "home", view: "yours", filter: "all" });
      view.show({ kind: "plugin", id: "cx-topics" });
      await vi.advanceTimersByTimeAsync(0);
      press(root);
      await vi.advanceTimersByTimeAsync(0);
      const out = byClass(host, "pl-card-dialog").length > 0 ? confirm(host) : undefined;
      await vi.advanceTimersByTimeAsync(REREAD_MS);
      await out;
      return root;
    };
    const installing = await waits({ packages: [pack("cx-sources"), pack("cx-keepa")] }, (root) => (nodes(byClass(root, "pl-head")[0]!).find((node) => node.tag === "button")!.props["onclick"] as () => void)());
    // cx's computer holds it to run: the header holds the still ring, not ✓, with nothing at work, and the toast says it went to the queue.
    const head = byClass(installing, "pl-head")[0]!;
    expect([byClass(head, "pl-queued").length, byClass(head, "pl-done").length, byClass(installing, "pl-working").length, byClass(installing, "pl-busy").length]).toEqual([1, 0, 0, 0]);
    expect([text(installing).includes("pl.q.added"), byClass(installing, "pl-failed").length]).toEqual([true, 0]);
    const removing = await waits({}, (root) => { click(byClass(root, "f-menu-row")[0]!); });
    // A removal that waits lands where one that ended does, and nothing is said of it.
    expect([(globalThis.location as { hash: string }).hash, byClass(removing, "pl-failed").length, byClass(removing, "pl-busy").length, text(removing).includes("pl.toast")]).toEqual(["#/plugins/yours/all", 0, 0, false]);
    (globalThis.location as { hash: string }).hash = "#/plugins/p/cx-topics";
    const switching = await waits({}, (root) => click(byClass(root, "f-switch")[0]!));
    expect(byClass(switching, "f-switch").map((one) => [byClass(switching, "pl-state")[0]?.textContent, one.props["aria-label"], one.props["aria-checked"], one.props["aria-busy"]])).toEqual([["pl.switch.off", "Chat Chapters", "false", undefined]]);
    expect(text(switching).includes("pl.toast")).toBe(false);
  } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
});


it("draws one of ours npm lists and the catalogue holds no record of, at its npm address, with its price and as ComChatX's, never a third party's", async () => {
  const listed = { ...keepa(true), name: "cx-keepa" } as Source;
  const ours: NpmPackage = { ...WEB_NPM, name: "cx-keepa", author: "ComChatX", repository: "https://github.com/comchatx/cx-keepa", readme: "# cx-keepa\n\nKeepa for cx.", ours: true };
  const { view, root } = page({ sources: [listed], npm: ours, catalogue: { ...CATALOGUE, plugins: CATALOGUE.plugins.filter((one) => one.box?.package !== "cx-keepa"), bundles: [] } });
  await view.load();
  view.show({ kind: "plugin", id: "~cx-keepa", npm: "cx-keepa" } as never);
  await settle(); await settle();
  const said = String(text(root));
  expect([said.includes("pl.ov.pay"), said.includes("pl.third.mark"), said.includes("pl.third.note"), said.includes("pl.third.title")]).toEqual([true, false, false, false]);
  // Ours carries the links every plugin npm holds does; a home page that is its repository adds none.
  expect(links(root).map(([to]) => to)).toEqual(["https://www.npmjs.com/package/cx-keepa", ours.repository, `${ours.repository}/issues`]);
});

it("links a package's own website between its repository and 反馈 where it names one that is not its repository", async () => {
  const named = page({ packages: [], npm: { ...WEB_NPM, homepage: "https://nicobailon.example/web-access" } });
  await named.view.load();
  named.view.show(WEB_AT as never);
  await settle(); await settle();
  expect(links(named.root).map(([to, , words]) => [to, words])).toEqual([
    ["https://www.npmjs.com/package/pi-web-access", "pl.third.npmpl.third.outside"], [WEB_NPM.repository, "pl.third.githubpl.third.outside"],
    ["https://nicobailon.example/web-access", "pl.third.homepl.third.outside"], [`${WEB_NPM.repository}/issues`, "pl.third.reportpl.third.outside"],
  ]);
  const same = page({ packages: [], npm: { ...WEB_NPM, homepage: WEB_NPM.repository! } });
  await same.view.load();
  same.view.show(WEB_AT as never);
  await settle(); await settle();
  expect(links(same.root)).toHaveLength(3);
});
