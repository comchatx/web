import { readFileSync } from "node:fs";
import { DEFAULT_PACKAGES, defaultSource } from "../shared/package-names.js";
import { expect, it, vi } from "vitest";
import { ComputerPending, EVERYTHING, FIRST_RELEASE, type Backend, type Features, type Readme, type Me, type ModelPlugin, type Models, type NpmPackage, type Package, type PackageList, type Source } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { catalogueWith, withRecords, type Catalogue } from "./catalogue.js";
import { REREAD_MS, WAIT_BOUND_MS } from "./plugins-clicks.js";
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
    addEventListener(): void {}
    setAttribute(name: string, value: unknown): void { this.props[name] = value; }
    removeAttribute(name: string): void { delete this.props[name]; }
    // What a control drawn waiting reads of itself.
    get tagName(): string { return this.tag.toUpperCase(); }
    get childNodes(): (Element | string)[] { return [...this.children]; }
    closest(): null { return null; }
    getAttribute(name: string): string | null { return this.props[name] === undefined ? null : String(this.props[name]); }
    hasAttribute(name: string): boolean { return this.props[name] !== undefined; }
    remove(): void { (globalThis as { removed?: Element[] }).removed?.push(this); }
    // A list of bare classes, as the page reads its failure and fact lines by: whatever under this node carries one of them.
    querySelectorAll(selector: string): Element[] {
      const names = selector.split(",").map((one) => one.trim());
      if (!names.every((one) => /^\.[\w-]+$/.test(one))) return [];
      const all = (node: Element): Element[] => node.children.flatMap((child) => (typeof child === "string" ? [] : [child, ...all(child)]));
      return all(this).filter((node) => String(node.props["class"] ?? "").split(" ").some((one) => names.includes(`.${one}`)));
    }
    get dataset(): Record<string, string> {
      return Object.fromEntries(Object.entries(this.props).filter(([name]) => name.startsWith("data-")).map(([name, value]) => [name.slice(5).replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase()), String(value)]));
    }
    /** Enough of a selector for the page's three: the retry button, the first link or button in the body, and a waiting control's words. */
    querySelector(selector: string): Element | null | undefined {
      if (selector === ":scope > .pl-hold-word") return this.children.find((child): child is Element => typeof child !== "string" && String(child.props["class"] ?? "").split(" ").includes("pl-hold-word")) ?? null;
      const all = (node: Element): Element[] => [node, ...node.children.flatMap((child) => (typeof child === "string" ? [] : all(child)))];
      const has = (node: Element, name: string): boolean => String(node.props["class"] ?? "").split(" ").includes(name);
      if (selector === "button.pl-retry") return all(this).find((node) => node.tag === "button" && has(node, "pl-retry"));
      const body = all(this).find((node) => has(node, "pl-body"));
      return body === undefined ? undefined : all(body).slice(1).find((node) => node.tag === "a" || node.tag === "button");
    }
    focus(): void { (globalThis as { focused?: Element }).focused = this; }
    // The set's dialog opens a card as the browser's own modal.
    showModal(): void {}
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
const { PluginsPage, PENDING_AGAIN_MS } = await import("./plugins-page.js");
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
/** A card is found by its name's link, the one link it holds. */
const cardOf = (root: Node, href: string): Node | undefined => byClass(root, "pl-card").find((card) => byClass(card, "pl-card-name")[0]?.props["href"] === href);
/** A row of 我的 or the queue is found by its name's link, the row's one link. */
const rowOf = (root: Node, href: string): Node | undefined => byClass(root, "pl-row-item").find((row) => byClass(row, "pl-row-link").some((link) => link.props["href"] === href));
const rowHrefs = (root: Node): unknown[] => byClass(root, "pl-row-link").map((link) => link.props["href"]);
const cardHrefs = (root: Node): unknown[] => byClass(root, "pl-card").map((card) => byClass(card, "pl-card-name")[0]?.props["href"]);

const say = (key: string, values?: Readonly<Record<string, string | number>>): string => `${key}${values === undefined || Object.keys(values).length === 0 ? "" : JSON.stringify(values)}`;
const pack = (name: string): Package => ({ name, version: "1.0.0", source: `npm:${name}` }) as Package;
const keepa = (enabled: boolean): Source => ({ name: "keepa", supplier: "Keepa", nativeUnit: "token", unitsPerNative: 1, aspects: [], enabled, spent: 0, month: { since: 0, spent: 118_000 } }) as unknown as Source;
const me = { kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } } as unknown as Extract<Me, { kind: "signed_in" }>;

// A bundle of the fixtures' own listing cx-sources and Conversation Titles, so it reaches Jev through a member and a held one can miss a part;
// Essentials keeps the list a new account starts with.
const pinned = withRecords(CATALOGUE, { bundles: [{ id: "pinned", name: "Pinned", author: "ComChatX", about: { en: "p", zh: "p" }, members: ["cx-sources", "cx-topics"] }] });
const extra = (count: number): Catalogue => withRecords(pinned, {
  plugins: Array.from({ length: count }, (_, n) => ({ id: `x${n}`, name: `Extra ${n}`, author: "someone", section: "extensions", about: { en: `extra ${n}`, zh: `extra ${n}` }, builds: [], box: { package: `x${n}`, skills: [] } })),
});

function page(world: { series?: Record<string, unknown>; catalogue?: Catalogue; packages?: readonly Package[]; sources?: readonly Source[]; models?: readonly ModelPlugin[]; unread?: boolean | string; pending?: boolean; asked?: number; listWait?: Promise<void>; readsWait?: Promise<void>; npmWait?: Promise<void>; npm?: (name: string) => Promise<NpmPackage>; hold?: boolean; refuse?: boolean | string; features?: Features; readme?: Readme; wait?: Promise<void>; served?: Models; starting?: () => boolean } = {}) {
  const installModel = vi.fn(async () => { await world.wait; if (world.refuse === true) throw new Error("503"); });
  const box = clickStub(world.packages ?? [pack("cx-sources"), pack("@comchatx/cx-topics"), pack("cx-keepa")]);
  box.world.hold = world.hold === true;
  const installPackage = vi.fn(async (source: string, on: boolean) => { await world.wait; if (typeof world.refuse === "string") throw new Error(world.refuse); return box.installPackage(source, on); });
  const setPackage = vi.fn(box.setPackage);
  const pressBundle = vi.fn(async (bundle: string, sources: readonly string[]) => { await world.wait; if (typeof world.refuse === "string") throw new Error(world.refuse); return box.pressBundle(bundle, sources); });
  const ask = vi.fn();
  const send = vi.fn();
  const changed = vi.fn(async () => {});
  const backend = {
    features: world.features ?? EVERYTHING, links: { signIn: "#in", account: "#account", help: "#help" }, readme: async () => world.readme, now: () => Date.parse("2026-10-17T12:58:00.000Z"),
    series: async () => { await world.readsWait; return world.series ?? {}; }, catalogue: async () => world.catalogue ?? pinned, npmPackages: async () => { await world.npmWait; return { packages: [], total: 0, read_at: "2026-10-17T00:00:00.000Z" }; }, npmPackage: async (name: string) => { if (world.npm !== undefined) return world.npm(name); throw new Error("unknown_package"); },
    packages: async () => {
      world.asked = (world.asked ?? 0) + 1;
      await world.listWait; if (world.pending === true) throw new ComputerPending(); if (world.unread === true) throw new Error("503"); if (typeof world.unread === "string") throw new Error(world.unread); return box.packages();
    },
    sources: async () => { await world.readsWait; return world.sources ?? [keepa(true)]; },
    modelPlugins: async () => world.models ?? [{ id: "jev", enabled: true, ways: ["platform"], month: 0 }],
    models: async () => { if (world.served === undefined) throw new Error("no read"); return world.served; },
    accounts: async () => { throw new Error("no read"); }, providers: async () => { throw new Error("no read"); },
    installModel, installPackage, setPackage, pressBundle, removeBundle: box.removeBundle, bundleState: box.bundleState,
  } as unknown as Backend;
  const host = new Element("body");
  const view = new PluginsPage({ power: box.power, say, language: () => "en", backend, me: () => me, ask, announce: () => undefined, cards: () => host as unknown as HTMLElement, changed, ...(world.starting === undefined ? {} : { starting: world.starting }) });
  return { view, host: host as Node, root: view.element as unknown as Node, installModel, installPackage, setPackage, pressBundle, ask, send, changed, box };
}

it("draws Discover's Bundles shelf ahead of its Data sources and its shelves from the records, with no Paid tag on any card", async () => {
  const { view, root } = page();
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all" });
  // An official bundle has no drawing of its own, so no banner stands over the shelves.
  expect(byClass(root, "pl-banner")).toHaveLength(0);
  // Beside Pi plugins, ComChatX's are a section of their own and each shelf a heading under its title.
  expect(byClass(root, "pl-section-title").map((one) => [one.tag, one.textContent])).toEqual([["h2", "pl.section.ours"], ["h2", "pl.section.pi"]]);
  const shelves = byClass(root, "pl-shelf").map((shelf) => nodes(shelf).find((node) => node.tag === "h3")!.textContent);
  expect(shelves).toEqual(["pl.shelf.bundles3", "pl.shelf.data4", "pl.shelf.extensions9", expect.stringMatching(/^pl\.shelf\.models\d+$/)]);
  const keepaCard = cardOf(root, "#/plugins/p/keepa")!;
  expect(byClass(keepaCard, "pl-chip-paid")).toHaveLength(0);
  view.show({ kind: "home", view: "discover", filter: "bundles", shelf: "bundles" });
  const bundle = cardOf(root, "#/plugins/b/pinned")!;
  expect(byClass(bundle, "pl-chip-paid")).toHaveLength(0);
  // The bundle counts everything it installs: its two and Jev, which comes with Conversation Titles.
  expect(bundle.textContent).toContain('pl.members{"count":3}');
});

it("shows six cards a shelf with a Show all for the rest, and the whole shelf on its own address", async () => {
  const { view, root } = page({ catalogue: extra(7) });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "plugins" });
  const extensions = byClass(root, "pl-shelf").find((shelf) => shelf.textContent.startsWith("pl.shelf.extensions"))!;
  expect(byClass(extensions, "pl-card")).toHaveLength(6);
  expect(byClass(extensions, "pl-showall")[0]?.props["href"]).toBe("#/plugins/discover/shelf/extensions");
  expect(byClass(root, "pl-banner")).toHaveLength(0);
  view.show({ kind: "home", view: "discover", filter: "plugins", shelf: "extensions" });
  expect(byClass(root, "pl-card")).toHaveLength(9 + 7);
  expect(byClass(root, "pl-showall")).toHaveLength(0);
});

it("draws no banner and no bundle shelf when the catalogue holds no bundle", async () => {
  const { view, root } = page({ catalogue: { ...CATALOGUE, bundles: [] } });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all" });
  expect(byClass(root, "pl-banner")).toHaveLength(0);
  expect(byClass(root, "pl-shelf").some((shelf) => shelf.textContent.startsWith("pl.shelf.bundles"))).toBe(false);
});

it("draws Yours from what is held: a switch on a plugin's row, off where it is off with no Off by its name, the month to two places and its bundle's mark", async () => {
  const { view, root } = page({ sources: [keepa(false)] });
  await view.load();
  view.show({ kind: "home", view: "yours", filter: "all" });
  const row = rowOf(root, "#/plugins/p/keepa")!;
  expect([row.textContent, nodes(row).filter((node) => node.props["role"] === "switch").map((node) => [node.props["aria-label"], node.props["aria-checked"]])]).toEqual([expect.not.stringContaining("pl.off"), [["Keepa API", "false"]]]);
  // The month is the figure alone, as the sidebar draws it; a screen reader hears it said as this month's.
  expect(byClass(row, "pl-month")[0]?.textContent).toBe('$0.12pl.month{"amount":"$0.12"}');
  expect(byClass(byClass(row, "pl-month")[0]!, "pl-sr")[0]?.textContent).toBe('pl.month{"amount":"$0.12"}');
  const base = rowOf(root, "#/plugins/p/cx-sources")!;
  expect(byClass(base, "pl-mark-bundle")[0]?.props["aria-label"]).toContain("Pinned");
});

it("narrows by search and offers to ask cx when nothing matches", async () => {
  const { view, root, ask } = page();
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all" });
  const input = nodes(root).find((node) => node.tag === "input")!;
  (input.props["oninput"] as (event: unknown) => void)({ target: { value: "zzzz" } });
  const empty = byClass(root, "pl-empty")[0]!;
  (nodes(empty).find((node) => node.tag === "button")!.props["onclick"] as () => void)();
  expect(ask).toHaveBeenCalledWith('pl.noMatchDraft{"q":"zzzz"}');
  (input.props["oninput"] as (event: unknown) => void)({ target: { value: "keepa" } });
  // The listing playbook's README says it reads Keepa's history and Amazon Seller's Overview names Keepa's; cx-sources' README names no source.
  expect(cardHrefs(root)).toEqual(["#/plugins/b/amazon-seller", "#/plugins/p/keepa", "#/plugins/p/cx-listing-playbook"]);
  view.leave();
  view.show({ kind: "home", view: "discover", filter: "all" });
  expect(byClass(root, "pl-nomatch")).toHaveLength(0);
  expect(nodes(root).find((node) => node.tag === "input")!.props["value"]).toBe("");
});

it("installs a model plugin with + at once, saying nothing, and opens the install card for anything that brings, buys or runs more", async () => {
  const { view, root, host, installModel, installPackage, changed } = page({ catalogue: extra(1), models: [] });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "plugins" });
  const plus = (href: string) => nodes(cardOf(root, href)!).find((node) => node.tag === "button")!;
  const location = { hash: "" };
  vi.stubGlobal("location", location);
  await (plus("#/plugins/p/jev").props["onclick"] as (event: unknown) => Promise<void>)({ preventDefault: () => {} });
  expect(installModel).toHaveBeenCalledWith("jev", true);
  await new Promise((done) => setTimeout(done, 0));
  // A model plugin installs on the platform at once and joins no queue: nothing is said, its card's ✓ says it.
  expect(byClass(root, "pl-toast")[0]?.textContent ?? "").toBe("");
  // The sidebar's counts and the sources bar are read again.
  expect(changed).toHaveBeenCalledTimes(1);
  // The extensions shelf holds more than six cards, so x0 is drawn on its own address.
  view.show({ kind: "home", view: "discover", filter: "plugins", shelf: "extensions" });
  const pressed = (plus("#/plugins/p/x0").props["onclick"] as (event: unknown) => Promise<void>)({ preventDefault: () => {} });
  await new Promise((done) => setTimeout(done, 0));
  // Someone else's plugin runs its own code: the card says so before anything is installed, and the seller stays on the shelf.
  expect(installPackage).not.toHaveBeenCalled();
  expect(byClass(host, "pl-card-warn").map((line) => line.textContent)).toEqual(["pl.c.thirdIn1"]);
  await confirm(host);
  await pressed;
  expect(installPackage).toHaveBeenCalledWith("/opt/comchatx/packages/x0", true);
  expect(location.hash).toBe("");
  vi.unstubAllGlobals();
});

it("says on a model's row in Yours who made it and whose models it is, the maker's name or not", async () => {
  const { view, root } = page({ models: [{ id: "deepseek", enabled: false, ways: ["platform"], month: 0 }, { id: "openai", enabled: false, ways: ["platform"], month: 0 }] });
  await view.load();
  view.show({ kind: "home", view: "yours", filter: "plugins" });
  const row = (href: string) => rowOf(root, href)!;
  const line = (href: string): string | undefined => byClass(row(href), "pl-row-line")[0]?.textContent;
  expect([line("#/plugins/p/deepseek"), line("#/plugins/p/openai"), nodes(row("#/plugins/p/openai")).some((node) => node.props["role"] === "switch")]).toEqual([expect.stringMatching(/^pl\.by\{"name":"ComChatX"\} · /), expect.stringMatching(/^pl\.by\{"name":"ComChatX"\} · /), false]);
  expect([row("#/plugins/p/deepseek").textContent.includes("pl.fromVendor"), row("#/plugins/p/openai").textContent.includes("pl.fromVendor")]).toEqual([false, false]);
});

it("says on a model's row its maker and its sentence, on or off, and no order of the ways cx uses", async () => {
  const { view, root } = page({ models: [{ id: "openai", enabled: true, ways: ["account", "platform"], month: 0 }, { id: "jev", enabled: false, ways: ["platform"], month: 0 }] });
  await view.load();
  view.show({ kind: "home", view: "yours", filter: "plugins" });
  const row = (href: string) => rowOf(root, href)!;
  expect([row("#/plugins/p/openai").textContent.includes("pl.order"), byClass(row("#/plugins/p/jev"), "pl-row-line")[0]?.textContent]).toEqual([false, 'pl.by{"name":"ComChatX"} · Models from TypeSafe.']);
});

it("draws every Discover shelf in the catalogue's order, a held plugin where the catalogue has it", async () => {
  const { view, root } = page({ models: [{ id: "stepfun", enabled: true, ways: ["platform"], month: 0 }] });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "plugins", shelf: "models" });
  const order = CATALOGUE.plugins.filter((plugin) => plugin.section === "models").map((plugin) => `#/plugins/p/${plugin.id}`);
  expect(cardHrefs(root)).toEqual(order.filter((href) => cardHrefs(root).includes(href)));
  expect(cardHrefs(root).indexOf("#/plugins/p/stepfun")).toBeGreaterThan(0);
});

it("leaves a card where the catalogue has it after + installs it, and on coming back to the shelf", async () => {
  const models: ModelPlugin[] = [];
  const { view, root, installModel } = page({ models });
  installModel.mockImplementation(async () => { models.push({ id: "stepfun", enabled: true, ways: ["platform"], month: 0 }); });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "plugins", shelf: "models" });
  const before = cardHrefs(root);
  await (nodes(cardOf(root, "#/plugins/p/stepfun")!).find((node) => node.tag === "button")!.props["onclick"] as () => void)();
  await new Promise((done) => setTimeout(done, 0));
  expect(cardHrefs(root)).toEqual(before);
  view.show({ kind: "home", view: "discover", filter: "all" });
  view.show({ kind: "home", view: "discover", filter: "plugins", shelf: "models" });
  expect(cardHrefs(root)).toEqual(before);
});

it("makes a card one link: its name's link, with no handler of the card's own, and + a button beside it", async () => {
  const { view, root } = page();
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all" });
  const card = cardOf(root, "#/plugins/p/keepa")!;
  expect(card.props["onclick"]).toBeUndefined();
  expect(String(card.props["class"]).split(" ")).toContain("pl-card-open");
  // Its one link onto the page is its name's; npm's, the repository's and 反馈 open elsewhere, in a new tab, above it.
  expect(nodes(card).filter((node) => node.tag === "a" && node.props["target"] === undefined).map((node) => node.props["href"])).toEqual(["#/plugins/p/keepa"]);
  expect(nodes(card).filter((node) => node.tag === "a" && node.props["target"] !== undefined).every((node) => node.props["target"] === "_blank" && node.props["class"] === "pl-out")).toBe(true);
  const css = readFileSync(new URL("./site/app.css", import.meta.url), "utf8");
  expect(css).toMatch(/\.pl-card-open \.pl-card-name::after \{[^}]*position: absolute; inset: 0;/);
});

it("says the installed list waits for cx's computer to start, in the chat's words, while the computer starts, and loading once it is on", () => {
  let starting = true;
  const { view, root } = page({ starting: () => starting });
  void view.load();
  view.show({ kind: "home", view: "yours", filter: "all" });
  expect(byClass(root, "unseen").map((one) => one.textContent)).toEqual(["line.starting"]);
  starting = false;
  view.show({ kind: "home", view: "yours", filter: "all" });
  expect(byClass(root, "unseen").map((one) => one.textContent)).toEqual(["stream.loading"]);
  // Discover's cards are the platform's, not the computer's: their place says loading whatever the computer is doing.
  starting = true;
  view.show({ kind: "home", view: "discover", filter: "all" });
  expect(byClass(root, "unseen").map((one) => one.textContent)).toEqual(["stream.loading"]);
});

it("stands its bar at once while the reads are out, with the shelves' shape in the body and the loading word a screen reader's alone", () => {
  const { view, root } = page();
  void view.load();
  view.show({ kind: "home", view: "discover", filter: "all" });
  expect(byClass(root, "pl-bar")).toHaveLength(1);
  const shape = byClass(root, "sk");
  // Every shelf of Discover drawn full, in cards of a card's own frame: nothing of the catalogue's, and no line to read on sight.
  expect([shape.length, shape[0]?.props["aria-busy"], byClass(root, "unseen")[0]?.props["role"], byClass(root, "unseen")[0]?.textContent, byClass(root, "sk-shape")[0]?.props["aria-hidden"]]).toEqual([1, "true", "status", "stream.loading", "true"]);
  expect([byClass(root, "pl-shelf").length, byClass(root, "pl-card").length, byClass(root, "pl-card-name").length, byClass(root, "pl-empty").length]).toEqual([4, 24, 0, 0]);
});

it("keeps the search's width beside Create on a narrow window, a card's buttons at the body's size, and the wide meters where the table fits", () => {
  const css = readFileSync(new URL("./site/app.css", import.meta.url), "utf8");
  expect(css).toMatch(/@media \(max-width: 56rem\) \{ \.pl-tools \{[^}]*justify-content: flex-end;[^}]*\} \.pl-searchbox \{ flex: 0 1 15rem;/);
  // The row of the two may be narrower than what it holds, so the search box gives way and Create ends at the page's margin.
  expect(css).toMatch(/@media \(max-width: 56rem\) \{ \.pl-tools \{ flex: 1 1 100%; min-width: 0;/);
  // A card's buttons are the set's, with no size of the page's own.
  expect(css).not.toMatch(/^\.pl-card-acts button \{/m);
  expect(css).toMatch(/^\.pl-empty button \{[^}]*font-size: var\(--size-body\)/m);
  expect(css).toMatch(/@media not \(min-width: 40rem\) \{[^@]*\.pl-table \.pl-meter \{ width: 2\.5rem; \}/);
  expect(css).toMatch(/^\.pl-model-rows \.pl-models tbody td \{ height: 3\.4375rem; \}/m);
});

it("runs the rule above Add a Client identifier as wide as the rule between two Client identifiers: the press's line is held to no paragraph's measure", () => {
  const css = readFileSync(new URL("./site/app.css", import.meta.url), "utf8");
  expect(css).toMatch(/^\.pl-setting p \{ max-width: 38rem;/m);
  expect(ruleOf(css, ".pl-setting .pl-after.pl-add-pair")).toBe(".pl-setting .pl-after.pl-add-pair { max-width: none; }");
});

it("scrolls a settings-type page at the window's edge, the column holding no scroller of its own", () => {
  const css = readFileSync(new URL("./site/app.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  expect(css).toMatch(/^main:has\(> \.settings\) \{ overflow-y: auto; \}/m);
  expect([...css.matchAll(/^\.settings \{([^}]*)\}/gm)].map((rule) => rule[1]).join("")).not.toMatch(/overflow/);
});

it("draws a series' row at its two lines' height with the tick and the bars beside the first, and every table's column heads a step under its rows", () => {
  const css = readFileSync(new URL("./site/app.css", import.meta.url), "utf8");
  // After the one-line table's fixed height, so it wins where both match.
  expect(css.indexOf(".pl-model-rows .pl-series tbody td { height: auto; vertical-align: top; }")).toBeGreaterThan(css.indexOf(".pl-model-rows .pl-models tbody td { height: 3.4375rem; }"));
  expect(/^\.pl-table th \{[^}]*\}/m.exec(css)![0]).toContain("font-size: var(--size-caption);");
  expect(/^\.pl-table \{[^}]*\}/m.exec(css)![0]).toContain("font-size: var(--size-small);");
  // One size for every table's heads: the series' table adds only where its heads stand.
  expect(css).toMatch(/^\.pl-series th \{ vertical-align: top; \}/m);
  expect(css).toMatch(/^\.pl-series td\.pl-tick \{ padding-top: var\(--space-4\); \}/m);
  expect(css).toMatch(/^\.pl-series td\.pl-rated \{ padding-top: var\(--space-6\); \}/m);
});

it("pins what a screen reader alone hears to the top of the window, so it never lengthens the document under a long list and the window cannot be scrolled away from the app", () => {
  const css = readFileSync(new URL("./site/app.css", import.meta.url), "utf8");
  expect(ruleOf(css, ".unseen")).toContain("position: absolute; top: 0; left: 0;");
});

it("scrolls the models page with main alone, as the Plugins page, so its bar is at the window's edge and not beside its column", () => {
  const css = readFileSync(new URL("./site/app.css", import.meta.url), "utf8");
  expect(ruleOf(css, ".settings.plugins")).toBe(".settings.plugins { overflow-y: visible; }");
  expect(css.indexOf(".settings.plugins {")).toBeGreaterThan(css.indexOf(".settings {"));
  expect(ruleOf(css, "main:has(> .settings)")).toContain("overflow-y: auto;");
});

it("keeps a record's page within a phone's width: the tabs stay one line that scrolls inside its strip, and every table of models folds its heads, lets a long name take a second line and breaks a price only between its two figures", () => {
  const css = readFileSync(new URL("./site/app.css", import.meta.url), "utf8");
  const narrow = /^@media not \(min-width: 40rem\) \{ \.pl-series \.pl-tick \{[^\n]*$/m.exec(css)![0];
  expect(css).not.toMatch(/\.pl-tabs \{[^}]*flex-wrap/);
  expect(ruleOf(css, ".pl-tabs")).toContain("overflow-x: auto;");
  expect(ruleOf(css, ".pl-tab")).toContain("white-space: nowrap;");
  expect(narrow).toContain(".pl-series .pl-tick { width: auto; }");
  // The plain table of the first release and the Overview's are tables of models too: the rule names them all.
  expect(narrow).toContain(".pl-models .pl-meter { width: 2rem; }");
  expect(narrow).toContain(".pl-models .pl-model-name strong { max-width: none; white-space: normal; overflow-wrap: anywhere; }");
  // A series' table has six columns: a step less between them and its English heads fit the column a phone leaves.
  expect(narrow).toContain(".pl-series th, .pl-series td { padding-right: var(--space-4); }");
  expect(css.indexOf(narrow)).toBeGreaterThan(css.indexOf(".pl-table td { padding:"));
  expect(ruleOf(css, ".pl-table th:last-child, .pl-table td:last-child")).toContain("padding-right: 0;");
  expect(narrow).not.toContain(".pl-series th.num");
  // More particular than the wide window's one-line name, so it wins wherever it stands.
  expect(css).toMatch(/^\.pl-model-name strong \{[^}]*white-space: nowrap;/m);
  // Every other table's figure keeps one line at every width, a price list's "up to 50" too; a table of models is left to fold between its two figures.
  expect(css).toMatch(/^\.pl-table:not\(\.pl-models\) \.num \{ white-space: nowrap; \}$/m);
  expect(css).not.toMatch(/\.pl-models (th|td)?\.num[^{]*\{[^}]*white-space/);
  expect(css).not.toMatch(/@media[^\n]*\.pl-table \.num \{ white-space/);
  expect(css).toMatch(/^\.pl-nobreak \{ white-space: nowrap; \}/m);
  // A series' table fits 360px: the tick's heading is read and not shown under 40rem, and a name with no place to break wraps within its column.
  expect(css).toMatch(/^@media not \(min-width: 40rem\) \{ \.pl-series th\.pl-tick > span \{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset\(50%\); white-space: nowrap; \} \}$/m);
  expect(ruleOf(css, ".pl-series .pl-mname, .pl-series .pl-mname strong, .pl-series .pl-msub")).toContain("overflow-wrap: anywhere;");
  expect(ruleOf(css, ".pl-series .pl-mname")).toContain("flex-wrap: wrap;");
});

it("lets a series' version rows take their own lines' height, shows a bar's figure on hover and on the keyboard's focus, and draws a new series' line as no warning", () => {
  const css = readFileSync(new URL("./site/app.css", import.meta.url), "utf8");
  expect(css).toMatch(/^\.pl-model-rows \.pl-models tbody tr\.pl-version td \{ height: auto; \}/m);
  expect(css).toMatch(/^\.pl-tip \{ display: none;/m);
  expect(css).toMatch(/^\.pl-meter:hover > \.pl-tip, \.pl-meter:focus-visible > \.pl-tip \{ display: block; \}/m);
  // The figure stands over the bar, so the bar does not clip it.
  expect(/^\.pl-meter \{[^}]*\}/m.exec(css)![0]).not.toContain("overflow");
  expect(/^\.pl-news \{[^}]*\}/m.exec(css)![0]).toContain("background: var(--wash)");
  expect(css).toMatch(/^\.pl-tick \{ width: 4\.5rem; \}/m);
  // Every bar's track is the line's colour, so a bar on a version's row shows on the row's own tint with no rule of its own: the two
  // grounds are never one.
  const ground = (selector: RegExp): string => /background: ([^;]+);/.exec(selector.exec(css)![0])![1]!;
  const row = ground(/^\.pl-version td \{[^}]*\}/m), track = ground(/^\.pl-meter \{[^}]*\}/m);
  expect([row, track]).toEqual(["var(--wash)", "var(--line)"]);
  expect(css).not.toMatch(/^\.pl-version \.pl-meter \{/m);
});

it("draws a way's place in the order of use as a round number, and keeps a line of Settings to its own gap", () => {
  const css = readFileSync(new URL("./site/app.css", import.meta.url), "utf8");
  const n = /^\.pl-order-n \{[^}]*\}/m.exec(css)![0];
  expect(n).toContain("border-radius: var(--radius-round)");
  expect(n).toContain("width: 1.4rem; height: 1.4rem");
  expect(n).toContain("font-size: var(--size-caption)");
  expect(css).toMatch(/^\.pl-setting p \{[^}]*margin: 0 0 var\(--space-2\);/m);
  expect(css).toMatch(/^\.pl-main \.pl-choose \{ margin-top: var\(--space-4\); \}/m);
});

const sheet = (): string => readFileSync(new URL("./site/app.css", import.meta.url), "utf8");
const ruleOf = (css: string, selector: string): string => new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{[^}]*\\}`, "m").exec(css)?.[0] ?? "";

it("sets a card's rule sentence at the body's size: no rule that ends on the card's middle, its paragraphs or the rule's line sets a size of its own", () => {
  const rules = [...sheet().matchAll(/^([^{}@\n]+) \{([^}]*)\}/gm)].filter(([, selectors]) => selectors!.split(",").some((one) => /(\.pl-card-body|\.pl-card-body p|\.pl-rule|\.pl-rule > span|\.pl-rule span)$/.test(one.trim())));
  expect(rules.map(([, selectors]) => selectors)).toEqual(expect.arrayContaining([".pl-card-body", ".pl-card-body p, .pl-card-body h3", ".pl-rule"]));
  expect(rules.filter(([, , body]) => /font-size|line-height/.test(body!)).map(([, selectors]) => selectors)).toEqual([]);
});

it("draws the buttons beside the page's own sentences at the body's step, so a row of them is one height and the arrow as tall as its neighbours", () => {
  const css = sheet();
  const body = /^([^{\n]*) \{ font-size: var\(--size-body\); line-height: var\(--leading-body\); \}$/m.exec(css.slice(css.indexOf(".pl-head-tools button.primary, .pl-news button")))![1]!.split(", ");
  expect(body).toEqual([".pl-head-tools button.primary", ".pl-news button", ".pl-way-act button", ".pl-up", ".pl-tabbody > p > button", ".pl-banner-text button", ".pl-create"]);
  // The search box beside Create is the same step and the same height: its field has the body's line and no padding of its own.
  const search = ruleOf(css, ".pl-search");
  for (const part of ["padding: 0;", "font-size: var(--size-body); line-height: var(--leading-body);"]) expect(search).toContain(part);
  expect(ruleOf(css, ".pl-searchbox")).toContain("padding: var(--space-2) var(--space-4);");
  // On a narrow window Create keeps its word on one line and the search box gives way.
  expect(ruleOf(css, ".pl-create")).toContain("white-space: nowrap;");
  expect(ruleOf(css, ".pl-tools > .pl-menu")).toContain("flex: none;");
  // The arrow keeps the button's own padding: a padding of its own made it shorter than the row's other buttons.
  expect(ruleOf(css, ".pl-up")).toBe(".pl-up { flex: none; }");
});

it("draws a new series' line as a filled band inside the faint edge at the body's size, its quiet button without an edge", () => {
  const css = sheet();
  const band = ruleOf(css, ".pl-news");
  for (const part of ["border: 1px solid var(--line);", "background: var(--wash);", "font-size: var(--size-body); line-height: var(--leading-body);"]) expect(band).toContain(part);
  expect(ruleOf(css, ".pl-news .pl-quietbtn, .pl-quietbtn")).toContain("border-color: transparent; background: none; color: var(--quiet);");
  // The quiet button's rule stands after the one that gives the band's buttons their edge, so it wins on the one that is both.
  expect(css.indexOf(".pl-news .pl-quietbtn, .pl-quietbtn {")).toBeGreaterThan(css.indexOf(".pl-news button, .pl-way-list button"));
});

it("answers the pointer in its words where a view, a quiet button or a card's link has no fill to change", () => {
  const css = sheet();
  expect(ruleOf(css, ".pl-filter:hover, .pl-view:hover")).toBe(".pl-filter:hover, .pl-view:hover { color: var(--ink); }");
  const quiet = ".pl-quietbtn:hover:not(:disabled)";
  expect(ruleOf(css, quiet)).toBe(`${quiet} { border-color: transparent; background: none; color: var(--ink); }`);
  // After the rule that fills every button of these pages under the pointer, and more particular than it.
  expect(css.indexOf(`${quiet} {`)).toBeGreaterThan(css.indexOf(":where(.pl-page) button:hover:not(:disabled) {"));
  // A card's link takes the one ground under the pointer, and nothing is underlined.
  expect(css).toMatch(/^[^{]*a\.pl-inline:hover[^{]* \{\s*border-radius: var\(--radius-small\); background: var\(--shade\);/m);
  expect(css).not.toContain("underline");
});

it("answers the pointer on a surface where the fill's step is too slight to see: a filled quiet button and the banner's link in their edge, a row that is a link in its name", () => {
  const css = sheet();
  const filled = ":where(.pl-page) button:hover:not(:disabled)";
  // Its ground is every button's, the one under the pointer.
  expect(ruleOf(css, filled)).toBe(`${filled} { border-color: var(--edge); }`);
  // The edge at rest is the faint one a shelf card has, which goes to the same edge under the pointer.
  expect(ruleOf(css, ":where(.pl-page) button, :where(.pl-page, .pl-card-dialog) select, :where(.pl-page, .pl-card-dialog) input")).toContain("border-color: var(--line);");
  expect(ruleOf(css, ".pl-card:hover")).toBe(".pl-card:hover { border-color: var(--edge); cursor: pointer; }");
  // A button with no edge of its own to show, and one that is busy, keep theirs.
  expect(ruleOf(css, ".pl-quietbtn:hover:not(:disabled)")).toContain("border-color: transparent;");
  expect(ruleOf(css, "button.pl-act-doing:hover:not(:disabled), button.pl-busy:hover:not(:disabled)")).toContain("border-color: var(--live-edge);");
  expect(css.indexOf("button.pl-act-doing:hover:not(:disabled), button.pl-busy:hover:not(:disabled) {")).toBeGreaterThan(css.indexOf(`${filled} {`));
  // The banner's link by a rule of the banner's own; a link drawn as a button lies on the one ground under the pointer.
  expect(ruleOf(css, ".pl-banner-text a.button:hover")).toBe(".pl-banner-text a.button:hover { border-color: var(--edge); }");
  expect(ruleOf(css, "a.button:hover, a.button:focus-visible")).toBe("a.button:hover, a.button:focus-visible { background: var(--shade); }");
  // A row that is a link takes the one ground under the pointer, and its name is not underlined.
  expect(ruleOf(css, "a.pl-row:hover")).toBe("a.pl-row:hover { background: var(--shade); }");
  expect(css).not.toMatch(/a\.pl-row:hover \.pl-row-name/);
  expect(css).not.toMatch(/label\.pl-row:hover[^{]*\{[^}]*text-decoration/);
  expect(css).not.toMatch(/\.pl-menu-list button:hover/);
});

it("gives a row of Create's menu the theme's ground for a row over the page under the pointer, by a rule of its own, and + and Update that ground with no outline, a step deeper under the pointer", () => {
  const css = sheet();
  const menu = ".pl-create-item:hover:not(:disabled)";
  expect(ruleOf(css, menu)).toBe(`${menu} { background: var(--float-hover); }`);
  // On the Plugins pages + and Update stand on it, with no outline (ruled 2026-11-13); a row that is a link and every other button take the one ground under the pointer.
  const acts = ".pl-act, .pl-news-acts button:not(.primary), .pl-update-end button";
  expect(css.match(/^.*\.pl-.*var\(--float-hover\).*$/gm)!.map((line) => line.slice(0, line.indexOf(" {")))).toEqual([menu, acts]);
  expect(ruleOf(css, acts)).toBe(`${acts} { border-color: transparent; background: var(--float-hover); }`);
  const pressed = ".pl-act:hover:not(:disabled), .pl-news-acts button:not(.primary):hover:not(:disabled), .pl-update-end button:hover:not(:disabled)";
  expect(ruleOf(css, pressed)).toBe(`${pressed} { border-color: transparent; background: var(--line); }`);
  // The message box's / list reads it too, by a rule of its own.
  expect(ruleOf(css, '.slash-row[aria-selected="true"]')).toBe('.slash-row[aria-selected="true"] { background: var(--float-hover); }');
  expect(ruleOf(css, "a.pl-row:hover")).toBe("a.pl-row:hover { background: var(--shade); }");
  expect(ruleOf(css, ":where(.pl-page) button:hover:not(:disabled)")).toBe(":where(.pl-page) button:hover:not(:disabled) { border-color: var(--edge); }");
});

it("draws \"Models in chat ›\" as one link wherever it stands, the action's colour on a vendor's Overview and at the end of its Settings alike", () => {
  const css = sheet();
  expect(ruleOf(css, ":is(.pl-main, .pl-setting) .pl-choose a.pl-inline")).toBe(":is(.pl-main, .pl-setting) .pl-choose a.pl-inline { color: var(--act); }");
  expect(css).not.toContain(".pl-choose a.button");
  expect(ruleOf(css, "a.button:hover, a.button:focus-visible")).toBe("a.button:hover, a.button:focus-visible { background: var(--shade); }");
});

it("pads the page's sides a step less on a narrow window, as the site's other pages are padded", () => {
  const css = sheet();
  expect(ruleOf(css, ".pl-page")).toBe(".pl-page { width: 100%; max-width: 72rem; margin: 0 auto; padding: var(--space-9) var(--space-7); }");
  expect(css).toMatch(/^@media not \(min-width: 48rem\) \{ \.pl-page \{ padding-left: var\(--space-6\); padding-right: var\(--space-6\); \} \}$/m);
  expect(css.indexOf("@media not (min-width: 48rem) { .pl-page {")).toBeGreaterThan(css.indexOf(".pl-page { width: 100%;"));
});

it("draws a drop-down at a field's height, and the search's clear mark small", () => {
  const css = sheet();
  expect(ruleOf(css, ":where(.pl-page, .pl-card-dialog) select")).toBe(":where(.pl-page, .pl-card-dialog) select { height: calc(1em * var(--leading-body) + 2 * var(--space-2) + 2px); font-size: var(--size-body); }");
  // The field it matches: the same padding and the same edge, from the rules every field of these pages has.
  expect(ruleOf(css, "select, input")).toContain("padding: var(--space-2) var(--space-4); border: 1px solid");
  expect(ruleOf(css, ":where(.pl-page) button, :where(.pl-page, .pl-card-dialog) select, :where(.pl-page, .pl-card-dialog) input")).toContain("border-color: var(--line); background: var(--hover);");
  expect(ruleOf(css, ".pl-search::-webkit-search-cancel-button")).toContain("width: 0.65rem; height: 0.65rem;");
});

it("reads a row's second line whole except in a list of what is held, of skills or of what a plugin uses", () => {
  const css = sheet();
  expect(ruleOf(css, ".pl-row-text > .quiet")).toBe(".pl-row-text > .quiet { overflow: hidden; text-overflow: ellipsis; font-size: var(--size-small); line-height: var(--leading-small); }");
  expect(ruleOf(css, ".pl-rows .pl-row-text > .quiet")).toBe(".pl-rows .pl-row-text > .quiet { white-space: nowrap; }");
  expect(css.match(/^.*\.pl-row-text > \.quiet \{[^}]*white-space/gm)).toEqual([".pl-rows .pl-row-text > .quiet { white-space"]);
});

it("draws a switch that cannot be turned as its track faded, with nothing filled under it", () => {
  // The set's one switch: what cannot be turned fades its track whole, and nothing is drawn under the button.
  const forms = readFileSync(new URL("./site/forms.css", import.meta.url), "utf8");
  expect(ruleOf(forms, ".f-switch")).toContain("border: none; background: none;");
  expect(ruleOf(forms, '.f-switch:is(:disabled, [aria-disabled="true"]:not([aria-busy="true"])) > i')).toBe('.f-switch:is(:disabled, [aria-disabled="true"]:not([aria-busy="true"])) > i { opacity: 0.45; }');
  expect(sheet()).not.toContain(".pl-switch");
});

it("fills the side box with the card's surface, gives a mark one share of its tile at every size, and lays the menu flat inside the faint edge", () => {
  const css = sheet();
  expect(ruleOf(css, ".pl-side")).toContain("border: 1px solid var(--line); border-radius: var(--radius-large); background: var(--hover);");
  expect(ruleOf(css, ".pl-logo svg")).toBe(".pl-logo svg { width: 56%; height: 56%; }");
  expect(ruleOf(css, ".tile .pl-icon")).toBe(".tile .pl-icon { width: 60%; height: 60%; }");
  expect(ruleOf(css, ".tile.pl-logo, .tile:has(> .pl-icon)")).toContain("background: var(--hover);");
  // The header's tile has the corner the side box, the lists and the cards have.
  expect(ruleOf(css, ".pl-tile-big")).toContain("border-radius: var(--radius-large);");
  expect(ruleOf(css, ".pl-tile-big")).toContain("background: var(--hover);");
  const menu = ruleOf(css, ".pl-menu-list");
  expect(menu).toContain("border: 1px solid var(--line);");
  expect(menu).toContain("background: var(--hover);");
  expect(menu).toContain("box-shadow: none;");
});

it("draws a list, a card, a dialog and every control on them as one surface darker than the page, inside the faint edge, and ends a table's last column on the row's rule", () => {
  const css = sheet();
  // Every list and every card, the ways and the order of use among them: one surface, no list of its own tone.
  expect(ruleOf(css, ".pl-list")).toContain("background: var(--hover);");
  // A shelf card is the set's card, which is that surface; the page keeps only its row of mark and words.
  expect(ruleOf(css, ".f-card.pl-card")).toBe(".f-card.pl-card { position: relative; flex-direction: row; gap: var(--space-5); min-height: 6.5rem; }");
  // A step short of the wash, which fills the banner over the cards and a new series' band and a needs line inside a list.
  for (const band of [".pl-banner", ".pl-news", ".pl-needs"]) expect(ruleOf(css, band)).toContain("background: var(--wash);");
  expect(css).not.toMatch(/^\.pl-way-list, \.pl-order \{/m);
  // A key's field is never narrower than 18rem, which holds the longest host's name ("Vercel AI Gateway") whole, and as wide as its
  // placeholder asks where a plan's name is longer (its `size`), within its row.
  expect(ruleOf(css, ".pl-way-list .pl-key")).toBe("");
  expect(ruleOf(css, ".pl-key")).toBe(".pl-key { width: auto; min-width: 18rem; max-width: 100%; }");
  // A card that asks is the set's dialog, white inside the float's edge: the page gives it no ground or edge of its own.
  const dialog = ruleOf(css, "dialog.pl-card-dialog");
  expect([dialog.includes("background"), dialog.includes("border-color"), css.includes("dialog.confirm")]).toEqual([false, false, false]);
  expect(css).not.toMatch(/^dialog \.pl-list|^dialog a\.pl-row:hover/m);
  // A row that is a link darkens once more under the pointer.
  expect(ruleOf(css, "a.pl-row:hover")).toBe("a.pl-row:hover { background: var(--shade); }");
  // Every button, field, tick box and radio of the page, and every field of its cards: the surface, the faint edge, and under the pointer the edge and the one ground.
  const control = ":where(.pl-page) button, :where(.pl-page, .pl-card-dialog) select, :where(.pl-page, .pl-card-dialog) input";
  expect(ruleOf(css, control)).toBe(`${control} { border-color: var(--line); background: var(--hover); }`);
  const under = ":where(.pl-page) button:hover:not(:disabled)";
  expect(ruleOf(css, under)).toBe(`${under} { border-color: var(--edge); }`);
  // After the site's own button, field and link-button, which are the lighter surface inside the strong edge, and weighing no more than they do, so a filled button keeps its fill and its edge.
  for (const own of ["\na.button {", "\nbutton:hover:not(:disabled, :where(.f-btn, .f-quiet, .f-icon, .f-select, .f-switch, .f-menu-row, .f-seg > button)) {", "\nselect, input {"]) {
    expect(css.indexOf(own)).toBeGreaterThan(-1);
    expect(css.indexOf(control)).toBeGreaterThan(css.indexOf(own));
  }
  // No control of the page names the lighter surface.
  expect(css.split("\n").filter((line) => /^[^{]*\.pl-[^{]*\{[^}]*background: var\(--raised\)/.test(line))).toEqual([]);
  expect(ruleOf(css, ".pl-table th:last-child, .pl-table td:last-child")).toContain("padding-right: 0;");
  expect(ruleOf(css, ".pl-try")).not.toContain("background");
  expect(ruleOf(css, ".pl-banner-text a.button")).toContain("border-color: var(--line);");
  expect(ruleOf(css, ".pl-act")).not.toContain("background");
});

it("sets each gap of a card, a row and a line of Settings on a step of the scale", () => {
  const css = sheet();
  // A card: its two buttons, its title's by-line or sentence, its groups of rows and the label over each, a sentence over its table.
  expect(ruleOf(css, ".pl-card-acts")).toContain("gap: var(--space-5);");
  // The by-line stands under the set's dialog title, at the title's own margin.
  expect([ruleOf(css, ".pl-card-headtext p"), ruleOf(css, ".pl-card-head h2")]).toEqual(["", ""]);
  expect(ruleOf(css, ".pl-card-by")).not.toContain("margin");
  expect(ruleOf(css, ".pl-card-rows")).toContain("gap: var(--space-5);");
  expect(ruleOf(css, ".pl-card-label")).toContain("margin: 0 0 var(--space-2);");
  expect(ruleOf(css, ".pl-card-warn")).toContain("gap: var(--space-3);");
  expect(ruleOf(css, ".pl-card-body > p + .pl-table")).toBe(".pl-card-body > p + .pl-table { margin-top: var(--space-2); }");
  expect(ruleOf(css, ".pl-rule")).toContain("gap: var(--space-6);");
  // A row a card's row brings with it stands a step in, under it.
  expect(ruleOf(css, ".pl-rows > li.pl-under > .pl-row")).toBe(".pl-rows > li.pl-under > .pl-row { padding-left: var(--space-8); }");
  // The label of the link stands as far under "or" as "or" under the file's field, and a field a person writes in is the page's height.
  expect(ruleOf(css, ".pl-card-body > .pl-or")).toBe(".pl-card-body > .pl-or { margin: calc(-1 * var(--space-2)) 0; }");
  expect(ruleOf(css, '.pl-field input[type="text"]')).toContain("font-size: var(--size-body); line-height: var(--leading-body);");
  // A chip after a by-line, the banner's link beside its word, a way's state or key field beside its button.
  expect(ruleOf(css, ".pl-by")).toBe(".pl-by { margin-right: var(--space-1); }");
  expect(ruleOf(css, ".pl-banner-text .row")).toContain("gap: var(--space-5);");
  expect(ruleOf(css, ".pl-way-act")).toContain("gap: var(--space-4);");
  expect(css.match(/^\.pl-way-act \{/gm)).toHaveLength(1);
  // The line that says what is missing: the page's sentence and button on a page, the row's smaller line and smallest button under a row, a step over what follows.
  const needs = ruleOf(css, ".pl-needs");
  expect(needs).toContain("margin: 0 0 var(--space-5);");
  expect(needs).toContain("font-size: var(--size-body); line-height: var(--leading-body);");
  expect(ruleOf(css, ".pl-needs button")).toContain("font-size: var(--size-body);");
  expect(ruleOf(css, ".pl-needs > a.button")).toContain("font-size: var(--size-body); line-height: var(--leading-body);");
  // No line under a title speaks of the account's state, so no rule draws one.
  expect(css).not.toContain(".pl-account");
  expect(ruleOf(css, ".pl-needs-row")).toBe(".pl-needs-row { font-size: var(--size-small); line-height: var(--leading-small); }");
  expect(ruleOf(css, ".pl-needs-row button")).toContain("padding: var(--space-1) var(--space-4); font-size: var(--size-caption);");
  expect(css.indexOf("\n.pl-needs-row {")).toBeGreaterThan(css.indexOf("\n.pl-needs button {"));
  // The block that says nothing was found stands a section's distance under the bar.
  expect(ruleOf(css, ".pl-empty")).toBe(".pl-empty { padding: var(--space-6) 0 var(--space-7); }");
  // Two sentences of an Overview, a table's columns.
  expect(ruleOf(css, ".pl-main p")).toBe(".pl-main p { margin: 0 0 var(--space-2); }");
  expect(ruleOf(css, ".pl-readme p")).toBe(".pl-readme p { margin-bottom: var(--space-3); }");
  expect(css.indexOf(".pl-readme p {")).toBeGreaterThan(css.indexOf(".pl-main p {"));
  expect(ruleOf(css, ".pl-table th")).toContain("var(--space-5) var(--space-2) 0;");
  expect(ruleOf(css, ".pl-table td")).toContain("var(--space-5) var(--space-3) 0;");
  // The optional plugins a plugin uses are three steps under the required ones.
  expect(ruleOf(css, ".pl-need + .pl-need > h2")).toBe(".pl-need + .pl-need > h2 { margin-top: var(--space-7); }");
});

it("keeps what stands under a card's head, a listed card, a card's rows, a row's two lines and its missing line in the signed forms on the scale's steps", async () => {
  const css = sheet();
  // Under a card's head: a sentence or the label of what it installs, the label of what stops or a field, the line about a stranger's code.
  expect(ruleOf(css, ".pl-card-head")).toContain("margin-bottom: var(--space-6);");
  expect(ruleOf(css, "dialog.pl-tool-dialog .pl-tool-title")).toBe("dialog.pl-tool-dialog .pl-tool-title { margin: 0 0 var(--space-6); }");
  expect(ruleOf(css, "dialog.pl-tool-dialog .pl-tool-title:has(+ .pl-card-body > .pl-field:first-child)")).toContain("margin-bottom: var(--space-5);");
  // A shelf's card keeps two lines' room for its sentence.
  expect(ruleOf(css, ".pl-card-open .pl-about")).toBe(".pl-card-open .pl-about { min-height: calc(2em * var(--leading-small)); }");
  // A card's row left out is in the quiet ink; one whose switch holds says why on a second line that wraps.
  expect(ruleOf(css, ".pl-row-item.pl-left .pl-row-link, .pl-row-item.pl-left .pl-row-link strong")).toContain("color: var(--quiet);");
  expect(ruleOf(css, ".pl-row-item.pl-why .pl-row-line")).toContain("white-space: normal;");
  // A row's name stands on the line under it, and the line of what it lacks has its edge under it.
  expect(ruleOf(css, ".pl-row-text")).toBe(".pl-row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }");
  expect(ruleOf(css, ".pl-list .pl-needs-row")).toContain("border-width: 0 0 1px;");
  // A letter in the large tile is the title's step in the quiet ink; a mark keeps the ink.
  expect(ruleOf(css, ".pl-tile-big")).toContain("font-size: var(--size-title);");
  expect(ruleOf(css, ".pl-tile-big:not(:has(svg))")).toBe(".pl-tile-big:not(:has(svg)) { color: var(--quiet); }");
  // That nothing was found is said in the small step; the other states with nothing to list keep the body's.
  expect(ruleOf(css, ".pl-nomatch p")).toBe(".pl-nomatch p { font-size: var(--size-small); line-height: var(--leading-small); }");
  expect(css.indexOf("\n.pl-nomatch p {")).toBeGreaterThan(css.indexOf("\n.pl-empty p {"));
  // The tab bar scrolls sideways and so clips outside itself: a tab's ring is drawn inside the tab, where it stands whole.
  expect([ruleOf(css, ".pl-tabs"), ruleOf(css, ".pl-tab:focus-visible")]).toEqual([expect.stringContaining("overflow-x: auto;"), ".pl-tab:focus-visible { outline-offset: -2px; }"]);
  // A failed install's or update's state at a queue row's end is the failure's colour, its mark and its word alike.
  expect(ruleOf(css, ".pl-q-state-bad")).toBe(".pl-q-state-bad { color: var(--bad); }");
  // What a row says it spent this month is the figure in the money colour, as the sidebar draws it.
  expect([ruleOf(css, ".pl-month.money"), css.includes(".pl-month-said")]).toEqual([".pl-month.money { color: var(--money); }", false]);
  const { view, root } = page({ sources: [keepa(false)] });
  await view.load();
  view.show({ kind: "home", view: "yours", filter: "all" });
  const said = byClass(root, "pl-month");
  expect(said.length).toBeGreaterThan(0);
  expect(said.map((one) => one.props["class"])).toEqual(said.map(() => "pl-month money"));
  view.show({ kind: "home", view: "discover", filter: "all" });
  (nodes(root).find((node) => node.tag === "input")!.props["oninput"] as (event: unknown) => void)({ target: { value: "zzzz" } });
  expect(byClass(root, "pl-empty").map((one) => one.props["class"])).toEqual(["pl-empty pl-nomatch"]);
});

it("keeps the gaps under the tab rule and a part's closing hairline on the scale's steps", () => {
  const css = sheet();
  expect(ruleOf(css, ".pl-tabbody")).toBe(".pl-tabbody { padding-top: var(--space-4); }");
  expect(ruleOf(css, ":where(.pl-tabbody) p")).toBe(":where(.pl-tabbody) p { margin: 0 0 var(--space-2); }");
  expect(ruleOf(css, ".pl-tabbody > p:first-child")).toContain("margin-top: var(--space-2);");
  expect(ruleOf(css, ".pl-tabbody > p.quiet:first-child")).toContain("margin-top: var(--space-4);");
  expect(ruleOf(css, ".pl-main h2, .pl-tabbody h2")).toBe(".pl-main h2, .pl-tabbody h2 { margin-top: var(--space-6); }");
  expect(ruleOf(css, ".pl-main section, .pl-tabbody > section")).toContain("margin-bottom: var(--space-2);");
  expect(ruleOf(css, ".pl-tabbody .pl-table + p")).toContain("margin-top: var(--space-2);");
  expect(ruleOf(css, ".pl-setting + .pl-setting")).toContain("padding-top: var(--space-4);");
  expect(ruleOf(css, ".pl-setting + .pl-setting > h2:first-child")).toContain("margin-top: var(--space-5);");
  expect(/^\.pl-tabs \{[^}]*\}/m.exec(css)![0]).not.toContain("margin-bottom");
  expect(ruleOf(css, ".pl-item .back, .pl-page > .back")).toContain("margin: var(--space-8) 0 var(--space-4);");
  expect(ruleOf(css, ".pl-body > .back")).toBe(".pl-body > .back { margin-bottom: var(--space-6); }");
  expect(ruleOf(css, ".pl-tabbody > .pl-setting")).toContain("margin-bottom: var(--space-3); padding-bottom: var(--space-6);");
});

it("keeps a card's title a step above its body, its link in the body's ink, its sentences a step apart, and an act that cannot be pressed yet grey", () => {
  const css = sheet();
  const forms = readFileSync(new URL("./site/forms.css", import.meta.url), "utf8");
  // The title is the set's dialog title, at the lead size.
  expect(forms).toMatch(/^\.f-dialog h2 \{[^}]*font-size: var\(--size-lead\)/m);
  expect(ruleOf(css, ".pl-card-body a.pl-inline")).toBe(".pl-card-body a.pl-inline { color: var(--ink); }");
  expect(css.indexOf(".pl-card-body a.pl-inline {")).toBeGreaterThan(css.indexOf(".pl-item .back a, .pl-inline"));
  // A link under a figure or a table is the back link's step, a step under the sentence over it.
  expect(ruleOf(css, ".pl-main a.pl-inline, .pl-setting .pl-choose a.pl-inline")).toBe(".pl-main a.pl-inline, .pl-setting .pl-choose a.pl-inline { color: var(--ink); font-size: var(--size-small); line-height: var(--leading-small); }");
  expect(css).toMatch(/^[^{]*a\.pl-inline:hover[^{]* \{\s*border-radius: var\(--radius-small\); background: var\(--shade\);/m);
  expect(css.indexOf(".pl-main a.pl-inline, .pl-setting .pl-choose a.pl-inline {")).toBeGreaterThan(css.indexOf(".pl-item .back a, .pl-inline"));
  expect(css).not.toContain(".pl-card-body > p.pl-rule:first-child");
  expect(ruleOf(css, ".pl-card-body > p + p")).toContain("margin-top: var(--space-2);");
  expect(ruleOf(css, ".pl-card-body section > p + p")).toContain("margin-top: var(--space-6);");
  // An act that cannot be pressed yet is the set's grey button, not a faded green.
  expect(css).not.toContain(".pl-card-acts button.primary:disabled");
  expect(forms).toMatch(/^\.f-btn:is\(:disabled, \[aria-disabled="true"\]\) \{ border-color: var\(--line\); background: var\(--wash\); color: var\(--quiet\);/m);
});

it("keeps the shelves, the banner and a card on the steps the signed page's gaps land on", () => {
  const css = sheet();
  expect(ruleOf(css, ".pl-shelf")).toBe(".pl-shelf { margin-bottom: var(--space-7); }");
  expect(ruleOf(css, ".pl-bar")).toContain("margin-bottom: var(--space-6);");
  // A shelf's card: its name, two lines and the last line a step under them, with no padding of the last line's own.
  // Every card, a bundle's too, is one height, measured in a built page (`plugins-settings.layout.ts`).
  expect(ruleOf(css, ".pl-card-open:has(.pl-needs-row)")).toContain("height: auto;");
  expect(css).not.toContain(".pl-card-open.pl-card-one");
  const meta = ruleOf(css, ".pl-meta");
  expect(meta).toContain("margin-top: auto;");
  expect(meta).not.toContain("padding-top");
  expect(ruleOf(css, ".pl-shelf-head")).toContain("margin-bottom: var(--space-4);");
  expect(ruleOf(css, ".pl-banner")).toContain("margin-bottom: var(--space-7); padding: var(--space-6) var(--space-7);");
  expect(ruleOf(css, ".pl-banner-text h2")).toContain("margin: 0 0 var(--space-2);");
  expect(ruleOf(css, ".pl-banner-text > .quiet")).toContain("margin-bottom: var(--space-1);");
});

it("draws the states with nothing to list in one form at the left: a body sentence, and under it the one way on where there is one", async () => {
  const css = readFileSync(new URL("./site/app.css", import.meta.url), "utf8");
  expect(css.match(/^\.pl-empty \{[^}]*\}/m)?.[0]).not.toContain("text-align");
  expect(css).toMatch(/^\.pl-empty p \{[^}]*font-size: var\(--size-body\)/m);
  const form = (root: Node): unknown => { const block = byClass(root, "pl-empty"); return [block.length, block[0]?.tag, nodes(block[0]!).filter((node) => node.tag === "p").map((node) => node.textContent), nodes(block[0]!).filter((node) => node.tag === "button").map((node) => node.textContent)]; };
  const waiting = page();
  void waiting.view.load();
  waiting.view.show({ kind: "home", view: "yours", filter: "all" });
  // Yours not read yet is its rows' shape, not a sentence.
  expect([byClass(waiting.root, "pl-empty").length, byClass(waiting.root, "sk").length, byClass(waiting.root, "pl-row").length]).toEqual([0, 1, 3]);
  const none = page({ packages: [], sources: [], models: [] });
  await none.view.load();
  none.view.show({ kind: "home", view: "yours", filter: "all" });
  expect(form(none.root)).toEqual([1, "div", ["pl.noneYours"], []]);
  const failed = page({ unread: true });
  await failed.view.load();
  failed.view.show({ kind: "home", view: "yours", filter: "all" });
  expect(form(failed.root)).toEqual([1, "div", ["pl.unread"], ["pl.tryAgain"]]);
});

it("states nothing it could not read: Discover draws neither + nor ✓, and Yours offers to read again", async () => {
  const { view, root } = page({ unread: true });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all" });
  expect(byClass(root, "pl-card").length).toBeGreaterThan(0);
  expect([byClass(root, "pl-act").length, byClass(root, "pl-done-mark").length]).toEqual([0, 0]);
  view.show({ kind: "home", view: "yours", filter: "all" });
  expect(root.textContent).toContain("pl.unread");
  expect(nodes(root).filter((node) => node.tag === "button" && node.textContent === "pl.tryAgain")).toHaveLength(1);
});

it("keeps a card on its shelf when + fails, and says on the card that it was not installed", async () => {
  const { view, root } = page({ refuse: true });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all", shelf: "models" });
  const location = { hash: "#/plugins" };
  vi.stubGlobal("location", location);
  const plus = byClass(cardOf(root, "#/plugins/p/z-ai")!, "pl-act")[0]!;
  await (plus.props["onclick"] as () => Promise<void>)();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(location.hash).toBe("#/plugins");
  expect(byClass(root, "pl-toast").map((one) => one.textContent)).toEqual([""]);
  // The line is the card's own row under it, not words inside the card.
  expect(byClass(cardOf(root, "#/plugins/p/z-ai")!, "pl-failed")).toHaveLength(0);
  expect(byClass(byClass(root, "pl-failed").find((one) => one.props["data-for"] === "#/plugins/p/z-ai")!, "pl-failed-text")[0]?.textContent).toBe('pl.fail.install{"name":"GLM"}');
  expect(byClass(cardOf(root, "#/plugins/p/z-ai")!, "pl-act")).toHaveLength(1);
});

it("draws a bundle as installed only while every plugin on its list is: with one gone it has its Install on Discover and no row on Yours", async () => {
  const whole = page();
  await whole.view.load();
  whole.view.show({ kind: "home", view: "discover", filter: "all" });
  const wholeCard = cardOf(whole.root, "#/plugins/b/pinned")!;
  expect([byClass(wholeCard, "pl-done-mark").length, byClass(wholeCard, "pl-act").length]).toEqual([1, 0]);
  const { view, root } = page({ packages: [pack("cx-sources")] });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "bundles", shelf: "bundles" });
  const card = cardOf(root, "#/plugins/b/pinned")!;
  expect([byClass(card, "pl-done-mark").length, byClass(card, "pl-act").length]).toEqual([0, 1]);
  view.show({ kind: "home", view: "yours", filter: "all" });
  expect(rowHrefs(root)).not.toContain("#/plugins/b/pinned");
  expect(root.textContent).not.toContain("pl.missing");
});

it("says the reads failed once above Discover's shelves, as Yours does, and Try again keeps the seller's place", async () => {
  const world: { unread?: boolean } = { unread: true };
  const { view, root } = page(world);
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all" });
  expect(byClass(root, "pl-unread")).toHaveLength(1);
  const shelf = byClass(root, "pl-body")[0]!.children.find((child) => typeof child !== "string" && String(child.props["class"]).includes("pl-section"));
  const body = byClass(root, "pl-body")[0]!.children;
  expect(body.indexOf(byClass(root, "pl-unread")[0]!)).toBeLessThan(body.indexOf(shelf!));
  const retry = () => (byClass(root, "pl-retry")[0]!.props["onclick"] as () => void)();
  retry();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const focused = (): Node | undefined => (globalThis as { focused?: Node }).focused;
  expect(String(focused()?.props["class"])).toContain("pl-retry");
  world.unread = false;
  retry();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(byClass(root, "pl-unread")).toHaveLength(0);
  expect(focused()?.tag === "a" || focused()?.tag === "button").toBe(true);
  expect(String(focused()?.props["class"])).not.toContain("pl-retry");
});

it("says a computer not set up yet in the chat's words, not that the list failed, and reads the list again when the computer is heard", async () => {
  const world: { pending?: boolean } = { pending: true };
  const { view, root } = page(world);
  await view.load();
  for (const at of ["discover", "yours"] as const) {
    view.show({ kind: "home", view: at, filter: "all" });
    expect([byClass(root, "pl-unread").map((line) => line.textContent), byClass(root, "pl-retry")], at).toEqual([["box.closedFree"], []]);
  }
  world.pending = false;
  view.heard();
  await vi.waitFor(() => expect(byClass(root, "pl-unread")).toEqual([]));
});

it("says the list could not be read, with Try again, when the platform answers that cx's computer did not answer it in time", async () => {
  const { view, root } = page({ unread: "box_slow" });
  await view.load();
  view.show({ kind: "home", view: "yours", filter: "all" });
  expect([byClass(root, "pl-unread").map((line) => line.textContent), byClass(root, "pl-retry").map((button) => button.textContent)]).toEqual([["pl.unreadpl.tryAgain"], ["pl.tryAgain"]]);
});

it("asks a list cx's computer was not ready to answer again on its own, while the computer is not heard anew", async () => {
  vi.useFakeTimers();
  try {
    const world: { pending?: boolean; asked?: number } = { pending: true };
    const { view, root } = page(world);
    await view.load();
    view.show({ kind: "home", view: "yours", filter: "all" });
    expect(byClass(root, "pl-unread").map((line) => line.textContent)).toEqual(["box.closedFree"]);
    const asked = world.asked;
    world.pending = false;
    await vi.advanceTimersByTimeAsync(PENDING_AGAIN_MS);
    expect([world.asked, byClass(root, "pl-unread")]).toEqual([asked! + 1, []]);
    // Ready, it is asked no more.
    await vi.advanceTimersByTimeAsync(PENDING_AGAIN_MS * 3);
    expect(world.asked).toBe(asked! + 1);
  } finally { vi.useRealTimers(); }
});

it("asks cx's computer once for what is installed when the sidebar's glance and the page's first load ask together", async () => {
  const world: { asked?: number } = {};
  const { view } = page(world);
  await Promise.all([view.glance(), view.load()]);
  expect(world.asked).toBe(1);
});

it("draws Discover as soon as everything but the installed list is in, saying the list is loading, and what is installed once it arrives", async () => {
  let arrive!: () => void;
  const { view, root } = page({ listWait: new Promise<void>((done) => { arrive = done; }) });
  view.show({ kind: "home", view: "discover", filter: "all" });
  const loading = view.load();
  await new Promise((resolve) => setTimeout(resolve, 0));
  // The catalogue stands, its cards stating neither + nor ✓ but the shape of one where it will stand, and the list's place says it is on
  // its way, with nothing to press.
  expect([byClass(root, "pl-card").length > 0, byClass(root, "pl-act").filter((one) => one.tag === "button").length, byClass(root, "pl-done-mark").length, byClass(root, "pl-act-shape").length > 0]).toEqual([true, 0, 0, true]);
  // The list's place says it is on its way to a screen reader alone.
  expect([byClass(root, "pl-unread"), byClass(root, "sk").map((one) => [one.props["aria-busy"], one.textContent]), byClass(root, "pl-retry")]).toEqual([[], [["true", "stream.loading"]], []]);
  // A shelf's count waits until the world is read whole, since what the shelf holds can still change.
  expect(byClass(root, "count")).toEqual([]);
  arrive();
  await loading;
  expect([byClass(root, "pl-unread"), byClass(root, "pl-done-mark").length > 0, byClass(root, "pl-act-shape"), byClass(root, "count").length > 0]).toEqual([[], true, [], true]);
});

it("draws Yours as its rows' shape while the installed list is read, then the rows; a list that fails says so where the shape stood", async () => {
  let arrive!: () => void;
  const { view, root } = page({ listWait: new Promise<void>((done) => { arrive = done; }) });
  view.show({ kind: "home", view: "yours", filter: "all" });
  const loading = view.load();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect([byClass(root, "sk").length, byClass(root, "pl-row").length, byClass(root, "pl-row-text").flatMap((one) => one.children.filter((child) => typeof child === "string")), byClass(root, "pl-unread")]).toEqual([1, 3, [], []]);
  arrive();
  await loading;
  expect([byClass(root, "sk"), byClass(root, "pl-row").length > 0]).toEqual([[], true]);
  const failing = page({ unread: true });
  failing.view.show({ kind: "home", view: "yours", filter: "all" });
  await failing.view.load();
  expect([byClass(failing.root, "sk"), byClass(failing.root, "pl-unread").map((line) => line.textContent?.startsWith("pl.unread"))]).toEqual([[], [true]]);
});

it("draws npm's shelf as a shelf of cards' shape while npm's list is read, and takes it away when npm answers", async () => {
  let answer!: () => void;
  const { view, root } = page({ npmWait: new Promise<void>((done) => { answer = done; }) });
  view.show({ kind: "home", view: "discover", filter: "all" });
  await view.load();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const shelf = (): Node[] => byClass(root, "pl-third").flatMap((section) => byClass(section, "sk"));
  expect([shelf().length, shelf().flatMap((one) => byClass(one, "pl-card")).length, byClass(root, "pl-third").flatMap((section) => byClass(section, "pl-empty")).length]).toEqual([1, 6, 0]);
  answer();
  await new Promise((resolve) => setTimeout(resolve, 0));
  view.draw();
  expect(shelf()).toEqual([]);
});

it("draws Discover's shelves as their cards' shape until the catalogue answers, then the catalogue's cards", async () => {
  const { view, root } = page();
  view.show({ kind: "home", view: "discover", filter: "all" });
  const loading = view.load();
  expect([byClass(root, "sk").length, byClass(root, "pl-card-name").length]).toEqual([1, 0]);
  await loading;
  expect([byClass(root, "sk").filter((one) => one.textContent === "stream.loading" && byClass(one, "pl-shelf").length > 0), byClass(root, "pl-card-name").length > 0]).toEqual([[], true]);
});

it("draws Discover as soon as the catalogue is in, while the sources and the series are still being read, and completes the cards when they are", async () => {
  let answer!: () => void;
  const { view, root } = page({ readsWait: new Promise<void>((done) => { answer = done; }) });
  view.show({ kind: "home", view: "discover", filter: "all" });
  const loading = view.load();
  await new Promise((resolve) => setTimeout(resolve, 0));
  // What is not read yet is not known: the cards stand, stating neither + nor ✓, each with the shape of one where it will stand.
  expect([byClass(root, "pl-card").length > 0, byClass(root, "pl-act").filter((one) => one.tag === "button").length, byClass(root, "pl-done-mark").length, byClass(root, "pl-empty").length, byClass(root, "pl-act-shape").length > 0]).toEqual([true, 0, 0, 0, true]);
  // The list's place says it is on its way to a screen reader alone.
  expect([byClass(root, "pl-unread"), byClass(root, "sk").map((one) => one.props["aria-busy"]), byClass(root, "pl-retry")]).toEqual([[], ["true"], []]);
  answer();
  await loading;
  expect([byClass(root, "pl-unread"), byClass(root, "pl-done-mark").length > 0]).toEqual([[], true]);
});

it("draws Discover from the catalogue as answered while npm is still asked for a bare dependency's words, and writes them in when npm answers", async () => {
  const parent: NpmPackage = { name: "@comchatx/parent", description: "A parent of ours.", kinds: ["extension"], author: "ComChatX", updated: "2026-11-03T00:00:00.000Z", version: "1.0.0", readme: "Parent", readme_cut: false, ours: true, shipped: { skills: [], prompts: [], unread: [] }, uses: ["bare-dependency"] };
  const catalogue = catalogueWith([parent]);
  expect(catalogue.plugins.find((one) => one.npm === "bare-dependency")?.about.en).toBe("");
  let answer!: () => void;
  const npm = new Promise<void>((done) => { answer = done; });
  const held = { name: "bare-dependency", source: "npm:bare-dependency", version: "1.0.0", about: { en: "", zh: "" }, description: { en: "", zh: "" } } as Package;
  const { view, root } = page({ catalogue, packages: [held], npm: async (name) => { if (name !== "bare-dependency") throw new Error("unknown_package"); await npm; return { ...parent, name, description: "Words npm holds.", author: "Someone", uses: [], ours: false }; } });
  view.show({ kind: "home", view: "discover", filter: "all" });
  const loading = view.load();
  await new Promise((resolve) => setTimeout(resolve, 0));
  // Every other read has answered; only npm's words for the bare record are out, and the cards stand without them.
  expect([byClass(root, "pl-card").length > 0, (root.textContent ?? "").includes("Words npm holds.")]).toEqual([true, false]);
  answer();
  await loading;
  // The bare record, installed, is a row of Yours, and carries the words npm gave.
  view.show({ kind: "home", view: "yours", filter: "all" });
  expect((root.textContent ?? "").includes("Words npm holds.")).toBe(true);
});

it("draws what is installed while npm is still asked for a third-party package's newest version, and offers its update once npm answers", async () => {
  const theirs = { name: "pi-mcp-adapter", source: "npm:pi-mcp-adapter", version: "0.40.0", enabled: true, about: { en: "a", zh: "a" }, description: { en: "d", zh: "d" } } as Package;
  let answer!: () => void;
  const npm = new Promise<void>((done) => { answer = done; });
  const { view, root } = page({ packages: [pack("cx-sources"), theirs], npm: async (name) => { if (name !== "pi-mcp-adapter") throw new Error("unknown_package"); await npm; return { name, description: "Web.", kinds: ["extension"], author: "Nico", updated: "2026-11-03T00:00:00.000Z", version: "0.42.0", readme: "", readme_cut: false, ours: false, shipped: { skills: [], prompts: [], unread: [] }, uses: [] }; } });
  view.show({ kind: "home", view: "yours", filter: "all" });
  const loading = view.load();
  await new Promise((resolve) => setTimeout(resolve, 0));
  // npm not answered, no update is offered: what is newer is not known yet.
  expect([(root.textContent ?? "").includes("pi-mcp-adapter"), byClass(root, "pl-unread"), (root.textContent ?? "").includes("pl.update")]).toEqual([true, [], false]);
  answer();
  await loading;
  expect((root.textContent ?? "").includes("pl.update")).toBe(true);
});

it("draws a computer that never ran as nothing installed and its first installs waiting, with no line where the list stands", async () => {
  try {
    const firsts = DEFAULT_PACKAGES.map((name, at) => ({ id: `00000000000000b${at}`, op: "install", source: defaultSource(name) }) as const);
    const { view, root } = await shelf({}, { packages: [], asleep: false, waiting: [...firsts, { id: "00000000000000a1", op: "install", source: SELLER }], ends: [] });
    for (const at of ["discover", "yours"] as const) {
      view.show({ kind: "home", view: at, filter: "all" });
      expect([byClass(root, "pl-unread"), byClass(root, "pl-retry")], at).toEqual([[], []]);
    }
    // A waiting install is in the queue, behind the defaults the computer runs first: its card holds the still ring, not ✓.
    view.show({ kind: "home", view: "discover", filter: "all", shelf: "extensions" });
    expect([ticked(root), clocked(root), failures(root)]).toEqual([0, 1, []]);
  } finally { restore(); }
});

it("says the installed list waits for cx's computer while it is not set up, with no Try again, and reads it again when the computer is heard", async () => {
  const world: { pending?: boolean; unread?: boolean } = { pending: true };
  const { view, root } = page(world);
  await view.load();
  for (const at of ["discover", "yours"] as const) {
    view.show({ kind: "home", view: at, filter: "all" });
    expect([byClass(root, "pl-unread").map((line) => line.textContent), byClass(root, "pl-retry")], at).toEqual([["box.closedFree"], []]);
  }
  // As while the list is unread, Discover's cards state neither + nor ✓.
  view.show({ kind: "home", view: "discover", filter: "all" });
  expect([byClass(root, "pl-card").length > 0, byClass(root, "pl-act").length, byClass(root, "pl-done-mark").length]).toEqual([true, 0, 0]);
  // A failure that is not the computer's setup keeps its own words and its way to read again.
  world.pending = false; world.unread = true;
  await view.load();
  expect([byClass(root, "pl-unread").map((line) => line.textContent), byClass(root, "pl-retry").length]).toEqual([["pl.unreadpl.tryAgain"], 1]);
  // Try again that finds the computer not set up leaves the focus on the page, not on a press that went.
  world.pending = true;
  const press = byClass(root, "pl-retry")[0]!;
  delete (globalThis as { focused?: Node }).focused;
  (press.props["onclick"] as () => void)();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const focused = (globalThis as { focused?: Node }).focused;
  expect([byClass(root, "pl-retry").length, focused !== undefined && focused !== press && (focused.tag === "a" || focused.tag === "button")]).toEqual([0, true]);
  world.pending = true; world.unread = false;
  await view.load();
  world.pending = false;
  view.heard();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(byClass(root, "pl-unread")).toHaveLength(0);
  // Heard with the list already read, nothing is read again.
  const reads = vi.spyOn(view, "load");
  view.heard();
  expect(reads).not.toHaveBeenCalled();
});

it("gives the sidebar's source row and the model card's links the record pages' addresses", async () => {
  const { view } = page();
  await view.load();
  expect(view.hrefFor("source", "keepa")).toBe("#/plugins/p/keepa");
  expect(view.hrefFor("vendor", "openai")).toBe("#/plugins/p/openai");
  expect(view.hrefFor("vendor", "kimi-coding")).toBe("#/plugins/p/moonshotai");
  expect(view.hrefFor("vendor", "openai-codex")).toBe("#/plugins/p/openai");
  expect(view.hrefFor("vendor", "no-such-maker")).toBeUndefined();
  expect(view.hrefFor("source", "no-such-source")).toBeUndefined();
});

it("turns where + stood while the click is written down, with no words but its name for a screen reader, neither + nor ✓, and leaves every other card its +", async () => {
  let answer!: () => void;
  const { view, root } = page({ wait: new Promise<void>((resolve) => { answer = resolve; }) });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all", shelf: "models" });
  vi.stubGlobal("location", { hash: "#/plugins" });
  const others = byClass(root, "pl-act").length;
  const out = (byClass(cardOf(root, "#/plugins/p/z-ai")!, "pl-act")[0]!.props["onclick"] as () => Promise<void>)();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const card = cardOf(root, "#/plugins/p/z-ai")!;
  expect(byClass(card, "pl-doing").map((one) => [one.textContent, one.props["aria-disabled"], one.props["aria-label"], one.props["onclick"]])).toEqual([["", "true", 'pl.doing.installName{"name":"GLM"}', undefined]]);
  expect(byClass(card, "pl-spin").map((one) => one.props["aria-hidden"])).toEqual(["true"]);
  expect(byClass(card, "pl-act")).toHaveLength(0);
  expect(byClass(card, "pl-done-mark")).toHaveLength(0);
  expect(byClass(root, "pl-act")).toHaveLength(others - 1);
  answer();
  await out;
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(byClass(root, "pl-doing")).toHaveLength(0);
});

it("says on the card why a click failed where the answer gave a reason, with Try again, and Help beside it from the second failure", async () => {
  const { view, root } = page({ refuse: "box_unreachable", packages: [pack("cx-sources")] });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all", shelf: "extensions" });
  vi.stubGlobal("location", { hash: "#/plugins" });
  const line = (): Node => byClass(root, "pl-failed").find((one) => one.props["data-for"] === "#/plugins/p/cx-amazon-seller")!;
  await (byClass(cardOf(root, "#/plugins/p/cx-amazon-seller")!, "pl-act")[0]!.props["onclick"] as () => Promise<void>)();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect([line().props["role"], byClass(line(), "pl-failed-text")[0]!.props["role"]]).toEqual([undefined, "alert"]);
  expect(byClass(line(), "pl-failed-text")[0]!.textContent).toBe('pl.fail.install{"name":"Amazon Core"} pl.why.unreached');
  expect(byClass(line(), "pl-failed-help")).toHaveLength(0);
  await (byClass(line(), "pl-again")[0]!.props["onclick"] as () => Promise<void>)();
  await new Promise((resolve) => setTimeout(resolve, 0)); await new Promise((resolve) => setTimeout(resolve, 0));
  expect(byClass(line(), "pl-failed-text")[0]!.textContent).toBe('pl.fail.install{"name":"Amazon Core"} pl.why.unreached');
  expect(byClass(byClass(line(), "pl-failed-acts")[0]!, "pl-failed-count").map((one) => one.textContent)).toEqual(['pl.fail.again{"count":2}']);
  expect(byClass(line(), "pl-failed-help").map((one) => one.props["href"])).toEqual(["#help"]);
});

it("draws a package the person installed themselves as a row on Yours' third-party shelf, marked as a third party's, and on no Discover shelf", async () => {
  const own = { ...pack("pi-fees"), about: { en: "Explains fees.", zh: "解释费用。" }, description: { en: "", zh: "" }, origin: "seller" } as Package;
  const { view, root } = page({ packages: [pack("cx-sources"), own] });
  await view.load();
  view.show({ kind: "home", view: "yours", filter: "all" });
  // npm's answer, that it holds no package by that name, is the ground for saying no author is stated: until it is in, the row says nothing of it.
  await new Promise((done) => setTimeout(done, 0));
  const shelfOf = (at: Node, link: string): string | undefined => byClass(at, "pl-shelf").find((one) => rowOf(one, link) !== undefined)?.children.flatMap((child) => (typeof child === "string" ? [] : nodes(child))).find((node) => node.tag === "h2")?.textContent;
  expect(shelfOf(root, "#/plugins/n/pi-fees")).toBe("pl.shelf.pi1");
  const row = rowOf(root, "#/plugins/n/pi-fees")!;
  expect([byClass(row, "pl-chip").map((one) => one.textContent), byClass(row, "pl-unchecked")]).toEqual([["pl.third.mark"], []]);
  expect(row.textContent).toContain("pl.own.by");
  // A package that says nothing of itself has a row that ends at who made it.
  const silent = page({ packages: [pack("cx-sources"), { ...own, about: { en: "", zh: "" } } as Package] });
  await silent.view.load();
  silent.view.show({ kind: "home", view: "yours", filter: "all" });
  await new Promise((done) => setTimeout(done, 0));
  const bare = rowOf(silent.root, "#/plugins/n/pi-fees")!;
  // The third-party mark stands on the name line, beside the name, as the signed row has it.
  expect([byClass(bare, "quiet").map((one) => one.textContent), byClass(byClass(bare, "pl-row-name")[0]!, "pl-chip").map((one) => one.textContent)]).toEqual([["pl.own.by"], ["pl.third.mark"]]);
  view.show({ kind: "home", view: "discover", filter: "all", shelf: "extensions" });
  expect(cardOf(root, "#/plugins/n/pi-fees")).toBeUndefined();
  // A package on the image's root no record names is ComChatX's to carry and not checked by it; one whose files are gone says so.
  const carried = { ...pack("cx-old"), source: "/opt/comchatx/packages/cx-old", about: { en: "", zh: "" }, description: { en: "", zh: "" } } as Package;
  const image = page({ packages: [pack("cx-sources"), carried, { ...carried, name: "cx-gone", source: "/opt/comchatx/packages/cx-gone", missing: true } as Package] });
  await image.view.load();
  image.view.show({ kind: "home", view: "yours", filter: "all" });
  const imageRow = (link: string): Node => rowOf(image.root, link)!;
  expect([imageRow("#/plugins/p/~cx-old"), imageRow("#/plugins/p/~cx-gone")].map((one) => byClass(one, "pl-unchecked").map((chip) => chip.textContent))).toEqual([[], ["pl.chip.missing"]]);
  expect([shelfOf(image.root, "#/plugins/p/~cx-old"), shelfOf(image.root, "#/plugins/p/~cx-gone")]).toEqual(["pl.shelf.extensions3", "pl.shelf.extensions3"]);
});

it("draws at first release the official bundles, and every model maker as a plugin: no banner, no filter between plugins and bundles, no row to the models' own page", async () => {
  const { view, root } = page({ features: FIRST_RELEASE });
  await view.load();
  view.show({ kind: "home", view: "discover", filter: "all" });
  expect(byClass(root, "pl-banner")).toHaveLength(0);
  // The one row of filters is the third-party plugins' kinds.
  expect(byClass(root, "pl-filters").map((one) => one.props["class"])).toEqual(["pl-filters pl-kinds"]);
  expect(byClass(root, "pl-shelf").map((shelf) => nodes(shelf).find((node) => node.tag === "h3")!.textContent).slice(0, 3)).toEqual(["pl.shelf.bundles3", "pl.shelf.data4", "pl.shelf.extensions9"]);
  expect(nodes(root).filter((node) => node.tag === "a").map((one) => one.props["href"])).not.toContain("#/plugins/models");
  // A maker the platform serves no model of is a plugin too; where makers are not plugins, it has no card.
  view.show({ kind: "home", view: "discover", filter: "all", shelf: "models" });
  expect(cardOf(root, "#/plugins/p/z-ai")).toBeDefined();
  const served = page({ features: { ...FIRST_RELEASE, modelPlugins: false } });
  await served.view.load();
  served.view.show({ kind: "home", view: "discover", filter: "all", shelf: "models" });
  expect(cardOf(served.root, "#/plugins/p/z-ai")).toBeUndefined();
});

it("answers a list address with nothing at it as any address with nothing there, and quotes no search that was not typed", async () => {
  const unknown = (root: Node) => [nodes(root).filter((node) => node.tag === "h1" || node.tag === "input").length, byClass(root, "back").map((one) => one.textContent), byClass(root, "quiet").map((one) => one.textContent)];
  // A build that offers no bundle: a bundles filter or shelf has nothing at it.
  const first = page({ features: { ...FIRST_RELEASE, bundles: false } });
  await first.view.load();
  for (const route of [{ view: "discover", filter: "bundles" }, { view: "yours", filter: "bundles" }, { view: "discover", filter: "all", shelf: "bundles" }] as const) {
    first.view.show({ kind: "home", ...route });
    expect(unknown(first.root), JSON.stringify(route)).toEqual([0, ["← nav.plugins"], ["pl.unknown"]]);
  }
  // An address with nothing at it is not the list a record opened after it goes back to, nor where a removal lands.
  first.view.show({ kind: "plugin", id: "keepa" });
  expect(byClass(first.root, "back").flatMap((one) => nodes(one).filter((node) => node.tag === "a").map((link) => link.props["href"]))).toEqual(["#/plugins/discover"]);
  // The lists such a build does draw stand at their addresses.
  first.view.show({ kind: "home", view: "discover", filter: "plugins" });
  expect(first.root.textContent).not.toContain("pl.unknown");
  expect(byClass(first.root, "pl-shelf").length).toBeGreaterThan(0);
  first.view.show({ kind: "home", view: "yours", filter: "all" });
  expect(first.root.textContent).not.toContain("pl.unknown");

  // Where bundles are offered and the person holds plugins and no bundle, Yours' bundles address is a view of its own: it draws no sentence, since something is installed and nothing was typed. No bar of filters leads to it.
  const full = page({ packages: [pack("cx-sources"), pack("cx-keepa")] });
  await full.view.load();
  full.view.show({ kind: "home", view: "yours", filter: "bundles" });
  expect(byClass(full.root, "pl-filters")).toHaveLength(0);
  expect(byClass(full.root, "pl-empty")).toHaveLength(0);
  expect(byClass(full.root, "pl-shelf")).toHaveLength(0);
  expect(full.root.textContent).not.toContain("pl.noneYours");
  expect(full.root.textContent).not.toContain("pl.noMatch");
  // Words typed that match nothing are quoted, as before.
  (nodes(full.root).find((node) => node.tag === "input")!.props["oninput"] as (event: unknown) => void)({ target: { value: "zzzz" } });
  expect(byClass(full.root, "pl-empty").map((one) => nodes(one).find((node) => node.tag === "p")!.textContent)).toEqual(['pl.noMatch{"q":"zzzz"}']);

  // A failed read keeps its own line at such an address.
  const failed = page({ catalogue: { ...CATALOGUE, bundles: [] }, unread: true });
  await failed.view.load();
  failed.view.show({ kind: "home", view: "discover", filter: "bundles" });
  expect(failed.root.textContent).toContain("pl.unread");
  expect(failed.root.textContent).not.toContain("pl.noMatch");
  expect(failed.root.textContent).not.toContain("pl.unknown");
});

it("gives a series' name cell round 5's least width beside its caret, where the window has the room", () => {
  expect(sheet()).toContain("@media (min-width: 24rem) { .pl-series .pl-mname { min-width: 4.5rem; } }");
});

it("keeps no line under a source's settings, where nothing is said", () => {
  const css = readFileSync(new URL("./site/app.css", import.meta.url), "utf8");
  expect(css).not.toMatch(/\.pl-note\b|\.pl-ways\b|\.pl-way-text\b/);
});

it("gives a way's words their own width, and a Try it card its line", () => {
  const css = sheet();
  // The one rule every .pl-go reads sets no width: a width there squeezed Connected and Set up out of their row.
  const go = [...css.matchAll(/^[^{\n]*\.pl-go[^{\n]* \{[^}]*\}/gm)].map((one) => one[0]);
  expect(go).toEqual([
    ".pl-go { flex: none; color: var(--quiet); font-size: var(--size-small); line-height: var(--leading-small); white-space: nowrap; }",
  ]);
  expect(css).not.toMatch(/\.pl-gap\b/);
  expect(ruleOf(css, ".pl-try")).toContain("font-size: var(--size-small); line-height: var(--leading-small);");
});

const SELLER = "npm:cx-amazon-seller";
const sellerCard = (root: Node): Node => cardOf(root, "#/plugins/p/cx-amazon-seller")!;
/** How the card draws its record while a click on it is out: the words in it, and what it is called. */
const doing = (root: Node): unknown[] => byClass(sellerCard(root), "pl-doing").map((one) => [byClass(one, "pl-doing")[0] === one ? nodes(one)[1]?.textContent : undefined, one.props["aria-label"]]);
const failures = (root: Node): unknown[] => byClass(root, "pl-failed").map((one) => [one.props["data-for"], byClass(one, "pl-failed-text")[0]?.textContent]);
const toast = (root: Node): string | undefined => byClass(root, "pl-toast")[0]?.textContent;
/** The seller's card's ✓, which stands only once the install has landed; and its still ring, while the install waits in the queue. */
const ticked = (root: Node): number => byClass(sellerCard(root), "pl-done-mark").filter((one) => !byClass(sellerCard(root), "pl-queued").includes(one)).length;
const clocked = (root: Node): number => byClass(sellerCard(root), "pl-queued").length;
/** A failed row's line: its words for a screen reader, which name the plugin, then the words it shows. */
const FAILED = "pl.fail.installHere";
/** The ring the seller's card turns while cx's computer runs its install. */
const RUNS = [["", 'pl.doing.installName{"name":"Amazon Core"}']];
/** The queue's rows in Yours: each one's source and where it stands, by its line's words. */
const queued = (view: { show: (route: { kind: "home"; view: "yours" | "discover"; filter: "all"; shelf?: "extensions" }) => void }, root: Node): unknown[] => {
  view.show({ kind: "home", view: "yours", filter: "all" });
  const rows = byClass(root, "pl-q-row").map((one) => [one.props["data-source"], byClass(one, "pl-q-state-word")[0]?.textContent]);
  view.show({ kind: "home", view: "discover", filter: "all", shelf: "extensions" });
  return rows;
};
/** The extensions shelf with cx-amazon-seller not installed, under a clock the test moves; `first` is what the list says of clicks when the page opens. */
async function shelf(world: Parameters<typeof page>[0] = {}, first: Partial<PackageList> = {}) {
  vi.useFakeTimers();
  vi.stubGlobal("location", { hash: "#/plugins" });
  const made = page({ packages: [pack("cx-sources")], ...world });
  made.box.world.list = { ...made.box.world.list, ...first };
  const reads = vi.spyOn(made.box, "packages");
  await made.view.load();
  made.view.show({ kind: "home", view: "discover", filter: "all", shelf: "extensions" });
  return { ...made, reads, press: (): Promise<void> => (byClass(sellerCard(made.root), "pl-act")[0]!.props["onclick"] as () => Promise<void>)() };
}
const restore = (): void => { vi.useRealTimers(); vi.unstubAllGlobals(); };

it("draws an install written down on a computer that is on as running, its card's ring, says once it went to the queue, and ✓ once the list says it landed, saying nothing then", async () => {
  try {
    const { root, box, press, installPackage, changed } = await shelf({ hold: true });
    const out = press();
    await vi.advanceTimersByTimeAsync(0);
    expect(installPackage).toHaveBeenCalledWith(SELLER, true);
    expect(box.world.sent).toEqual([{ id: expect.any(String), op: "install", source: SELLER }]);
    // Written down: the queue's first runs, so the card turns the ring, nothing reads as installed, and the press's one sentence is said.
    expect(await out).toBeUndefined();
    expect([doing(root), ticked(root), toast(root)]).toEqual([RUNS, 0, "pl.q.added"]);
    await vi.advanceTimersByTimeAsync(3 * REREAD_MS);
    expect([doing(root), ticked(root)]).toEqual([RUNS, 0]);
    const before = changed.mock.calls.length;
    box.release();
    await vi.advanceTimersByTimeAsync(REREAD_MS);
    // Landed: ✓, no word of it, and the rest of the app reads again.
    expect([doing(root), ticked(root), failures(root), changed.mock.calls.length - before]).toEqual([[], 1, [], 1]);
  } finally { restore(); }
});

it("leaves an install the list ends as failed to the queue: its card offers + again and draws no line, and the rest of the app reads again", async () => {
  try {
    const { view, root, box, press, changed } = await shelf({ hold: true });
    const out = press();
    await vi.advanceTimersByTimeAsync(0);
    await out;
    expect(doing(root)).toEqual(RUNS);
    const before = changed.mock.calls.length;
    box.world.fail = "timed_out";
    box.release();
    await vi.advanceTimersByTimeAsync(REREAD_MS);
    expect([doing(root), failures(root), ticked(root), byClass(sellerCard(root), "pl-act").length, changed.mock.calls.length - before]).toEqual([[], [], 0, 1, 1]);
    expect(queued(view, root)).toEqual([[SELLER, FAILED]]);
  } finally { restore(); }
});

it("keeps a failed install the list keeps in the queue, said again whenever the page is opened, until the list keeps it no longer", async () => {
  try {
    const kept = { op: "install", source: SELLER, ok: false, reason: "pi_failed", at: 5 } as const;
    const { view, root, box } = await shelf({}, { ends: [kept, { op: "off", source: "npm:nobody-knows", ok: false, reason: "pi_failed", at: 4 }, { op: "on", source: "npm:cx-sources", ok: true, at: 3 }] });
    const row = [[SELLER, FAILED]];
    expect([failures(root), queued(view, root)]).toEqual([[], row]);
    await view.load();
    expect(queued(view, root)).toEqual(row);
    // Left and come back to, the queue still says it: the list keeps it until 重试 or 取消.
    view.leave();
    await view.load();
    expect(queued(view, root)).toEqual(row);
    box.world.list = { ...box.world.list, ends: [] };
    await view.load();
    expect(queued(view, root)).toEqual([]);
  } finally { restore(); }
});

it("keeps the queue as the last list said it where a list carries no word of clicks", async () => {
  try {
    const entry = { id: "00000000000000a1", op: "install", source: SELLER } as const;
    const { view, root, box } = await shelf({}, { waiting: [entry] });
    expect([doing(root), ticked(root)]).toEqual([RUNS, 0]);
    // The platform could not read what it keeps: the list has neither field, and the queue stays as it was.
    const { waiting: _waiting, ends: _ends, ...wordless } = box.world.list;
    box.world.list = wordless;
    await view.load();
    expect([doing(root), ticked(root), failures(root)]).toEqual([RUNS, 0, []]);
    // A page opened on such a list holds no queue at all.
    restore();
    const fresh = await shelf({}, {});
    const { waiting: _none, ends: _nor, ...bare } = fresh.box.world.list;
    fresh.box.world.list = bare;
    await fresh.view.load();
    expect([doing(fresh.root), failures(fresh.root), byClass(sellerCard(fresh.root), "pl-act").length]).toEqual([[], [], 1]);
  } finally { restore(); }
});

it("reads the list again while an install runs, and no more once the queue has stood unchanged past the bound; the next opening reads it", async () => {
  try {
    const { view, root, box, press, reads } = await shelf({ hold: true });
    void press();
    await vi.advanceTimersByTimeAsync(WAIT_BOUND_MS - REREAD_MS);
    expect([doing(root), ticked(root)]).toEqual([RUNS, 0]);
    await vi.advanceTimersByTimeAsync(4 * REREAD_MS);
    // Not failed: cx's computer has not said it ended, so the queue still says it runs.
    expect([doing(root), failures(root), ticked(root)]).toEqual([RUNS, [], 0]);
    const read = reads.mock.calls.length;
    await vi.advanceTimersByTimeAsync(20 * REREAD_MS);
    expect([reads.mock.calls.length, vi.getTimerCount()]).toEqual([read, 0]);
    box.world.fail = "timed_out";
    box.release();
    await view.load();
    expect([doing(root), queued(view, root)]).toEqual([[], [[SELLER, FAILED]]]);
  } finally { restore(); }
});

it("draws an install on a sleeping computer as in the queue once written down, its card's clock, says it went to the queue, and reads nothing until the computer starts", async () => {
  try {
    const { root, press, reads, changed } = await shelf({ hold: true }, { asleep: true });
    const before = reads.mock.calls.length;
    const out = press();
    await vi.advanceTimersByTimeAsync(0);
    await out;
    // Read once, after the write: an install has no end of its own to wait for.
    expect(reads.mock.calls.length - before).toBe(1);
    expect([doing(root), failures(root), toast(root), ticked(root), clocked(root)]).toEqual([[], [], "pl.q.added", 0, 1]);
    // A click that waits has switched what its package sells all the same: the rest of the app reads again.
    expect(changed).toHaveBeenCalledTimes(1);
    const read = reads.mock.calls.length;
    await vi.advanceTimersByTimeAsync(WAIT_BOUND_MS);
    expect(reads.mock.calls.length).toBe(read);
  } finally { restore(); }
});

it("draws an entry that waits at the opening of the page where the queue says it stands, and ✓ once it lands, with nothing said", async () => {
  try {
    const entry = { id: "00000000000000a1", op: "install", source: SELLER } as const;
    const { root, box, installPackage, reads } = await shelf({}, { waiting: [entry] });
    // Nothing was pressed in this tab: the computer runs it, so the card turns the ring, with no + and no ✓.
    expect([installPackage.mock.calls.length, doing(root), byClass(sellerCard(root), "pl-act").length, ticked(root)]).toEqual([0, RUNS, 0, 0]);
    box.end(entry);
    await vi.advanceTimersByTimeAsync(REREAD_MS);
    expect([reads.mock.calls.length > 1, doing(root), ticked(root), toast(root), failures(root)]).toEqual([true, [], 1, "", []]);
  } finally { restore(); }
});

it("draws what the list says when a click ended unsaid, with the press's one sentence alone", async () => {
  try {
    const { root, box, press } = await shelf({ hold: true });
    const out = press();
    await vi.advanceTimersByTimeAsync(0);
    // The entry is gone and the list keeps no end for it: another click on the source took the end's place.
    box.world.list = listOf([...box.world.list.packages, { ...pack("cx-amazon-seller"), source: SELLER }]);
    await vi.advanceTimersByTimeAsync(REREAD_MS);
    await out;
    expect([doing(root), failures(root), toast(root), ticked(root)]).toEqual([[], [], "pl.q.added", 1]);
  } finally { restore(); }
});

const SOURCES = "npm:cx-sources";
const TIDY = "npm:@comchatx/cx-topics";
const PINNED = "#/plugins/b/pinned";
const pinnedCard = (root: Node): Node => cardOf(root, PINNED)!;
const bundleAct = (root: Node): Node | undefined => byClass(pinnedCard(root), "pl-act")[0];
const actSays = (root: Node): unknown[] => { const act = bundleAct(root)!; return [act.textContent, act.props["aria-label"], act.props["onclick"], act.props["aria-disabled"]]; };
/** Discover's Bundles shelf with nothing installed, and Pinned's + pressed through its card where one opens: one press brings cx-sources, then Conversation Titles. */
async function pinnedPress(first: Partial<PackageList> = {}) {
  const made = await shelf({ hold: true, packages: [] }, first);
  made.view.show({ kind: "home", view: "discover", filter: "all", shelf: "bundles" });
  return {
    ...made,
    install: async (): Promise<void> => {
      const out = (bundleAct(made.root)!.props["onclick"] as () => Promise<void>)();
      if (byClass(made.host, "pl-card-dialog").length > 0) return confirm(made.host);
      return out;
    },
  };
}

it("sends every click of a bundle's install before it waits for any, and draws the bundle installing while the plugins it installs wait", async () => {
  try {
    const { view, root, box, install } = await pinnedPress({ asleep: true });
    const out = install();
    await vi.advanceTimersByTimeAsync(0);
    // Nothing has ended, and the sleeping computer already keeps both, in the order they are to run.
    expect(box.world.sent.map((one) => [one.op, one.source])).toEqual([["install", SOURCES], ["install", TIDY]]);
    await out;
    // The list names the bundle nowhere: its plugins' entries are what waits, and its Install is not offered over them.
    // One press, one sentence.
    expect(toast(root)).toBe("pl.q.added");
    // A bundle's state is its members': while they wait in the queue its corner is the still ring, with no + and no ✓.
    const waits = [undefined, 1, 0];
    const drawn = (): unknown[] => [bundleAct(root), byClass(pinnedCard(root), "pl-queued").length, byClass(pinnedCard(root), "pl-act-doing").length];
    expect(drawn()).toEqual(waits);
    box.end(box.world.sent[0]!);
    await view.load();
    expect(drawn()).toEqual(waits);
    box.release();
    await view.load();
    expect([bundleAct(root), byClass(pinnedCard(root), "pl-queued").length, byClass(pinnedCard(root), "pl-done-mark").length]).toEqual([undefined, 0, 1]);
  } finally { restore(); }
});

it("writes down nothing of a press the platform refuses, and says the refusal under the bundle", async () => {
  try {
    const { root, box, pressBundle, install } = await pinnedPress();
    pressBundle.mockImplementationOnce(async () => { throw new Error("waiting_full"); });
    await install();
    await vi.advanceTimersByTimeAsync(REREAD_MS);
    // One press is one request: refused, none of its plugins is written down.
    expect([box.world.sent, box.world.pressed, byClass(root, "pl-doing").length, vi.getTimerCount()]).toEqual([[], [], 0, 0]);
    expect(failures(root)).toEqual([[PINNED, 'pl.fail.install{"name":"Pinned"} pl.why.full']]);
    expect(actSays(root)[0]).toBe("+");
  } finally { restore(); }
});

it("leaves a bundle's part that failed to the queue, and a part that ended done takes nothing of it away", async () => {
  try {
    const { view, root, box, install } = await pinnedPress();
    const out = install();
    await vi.advanceTimersByTimeAsync(0);
    box.world.fail = "pi_failed";
    box.end(box.world.sent[0]!);
    box.world.fail = undefined;
    box.end(box.world.sent[1]!);
    await vi.advanceTimersByTimeAsync(REREAD_MS);
    await out;
    const row = [[SOURCES, "pl.fail.installHere"]];
    expect([failures(root), queued(view, root)]).toEqual([[], row]);
    await view.load();
    expect([failures(root), queued(view, root)]).toEqual([[], row]);
  } finally { restore(); }
});
