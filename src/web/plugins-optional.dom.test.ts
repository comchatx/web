// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { FIRST_RELEASE, type Backend, type NpmPackage, type Package } from "./backend.js";
import { catalogueWith, type Catalogue } from "./catalogue.js";
import { REREAD_MS } from "./plugins-clicks.js";
import { PluginsPage } from "./plugins-page.js";
import { clickStub } from "./plugins-test-kit.js";
import { text, type StringKey } from "./strings.js";

// A press installs what a plugin cannot work without; what it can work without is offered on its Plugins it uses, and a plugin's Remove
// says what stays (ruled 2026-11-09). The chain is cx-listing-watch's as npm holds it.

const settle = async (): Promise<void> => { for (let n = 0; n < 12; n++) await Promise.resolve(); await vi.advanceTimersByTimeAsync(0); };
const pages: PluginsPage[] = [];
afterEach(() => { for (const page of pages.splice(0)) page.leave(); vi.clearAllTimers(); vi.useRealTimers(); document.body.replaceChildren(); location.hash = ""; });

const SCHEDULER = "@amaster.ai/pi-task-scheduler";
const CHANNELS = "@amaster.ai/pi-channels";
const npm = (name: string, more: Partial<NpmPackage> = {}): NpmPackage => ({ name, description: `${name} words.`, kinds: [], author: "ComChatX", updated: "2026-10-01T00:00:00.000Z", version: "1.0.0", repository: "", readme: "", readme_cut: false, ours: true,
  shipped: { skills: [], prompts: [], unread: [] }, uses: [], ...more });
const ours = (name: string, id: string, builds: readonly (string | { readonly on: string; readonly need: "optional" })[]): NpmPackage =>
  npm(name, { comchatx: { name: id, section: "extensions", builds } });
const PACKAGES: readonly NpmPackage[] = [
  ours("@comchatx/cx-listing-watch", "cx-listing-watch", ["@comchatx/cx-schedule", { on: "cx-feishu", need: "optional" }, "cx-listing-playbook", "cx-amazon-sp-api", { on: "cx-keepa", need: "optional" }]),
  ours("@comchatx/cx-schedule", "cx-schedule", [SCHEDULER]),
  ours("cx-feishu", "cx-feishu", [CHANNELS]),
  ours("cx-listing-playbook", "cx-listing-playbook", ["cx-amazon-sp-api", { on: "cx-keepa", need: "optional" }]),
  ours("cx-amazon-sp-api", "cx-amazon-sp-api", ["cx-sources"]),
  ours("cx-keepa", "cx-keepa", ["cx-sources"]),
  ours("cx-sources", "cx-sources", []),
  ours("cx-only-optional", "cx-only-optional", [{ on: "cx-keepa", need: "optional" }]),
];
const BUNDLE = { id: "playbook-set", name: "Playbook set", about: { en: "A set.", zh: "一套。" }, description: { en: "A set.", zh: "一套。" }, members: ["cx-listing-playbook", "cx-amazon-sp-api", "cx-sources"] };
const CATALOGUE: Catalogue = catalogueWith(PACKAGES, [BUNDLE]);
const held = (name: string): Package => ({ name, version: "1.0.0", source: `npm:${name}`, about: { en: "", zh: "" }, description: { en: "", zh: "" } });

/** A page over a box that ends each click at once. */
function world(language: "en" | "zh", start: readonly Package[] = []) {
  const box = clickStub(start);
  const backend = {
    features: FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" },
    catalogue: async () => CATALOGUE, packages: async () => box.packages(),
    sources: async () => [], models: async () => undefined, accounts: async () => [], providers: async () => [], modelPlugins: async () => [], series: async () => ({}), chatOffer: async () => undefined,
    readme: async () => undefined, now: () => Date.UTC(2026, 10, 9), npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-11-09T00:00:00Z" }),
    npmPackage: async (name: string) => { const ourOne = PACKAGES.find((one) => one.name === name); return ourOne ?? npm(name, { ours: false, author: "2betop" }); },
    installPackage: (source: string, on: boolean) => box.installPackage(source, on), setPackage: (source: string, on: boolean) => box.setPackage(source, on),
    pressBundle: (bundle: string, sources: readonly string[]) => box.pressBundle(bundle, sources), removeBundle: (bundle: string, sources: readonly string[]) => box.removeBundle(bundle, sources),
    bundleState: () => box.bundleState(),
  } as unknown as Backend;
  const say = (key: StringKey, values?: Record<string, string | number>): string => text(language, key, values);
  const page = new PluginsPage({ backend, language: () => language, say: (key, values) => say(key as StringKey, values), me: () => ({ kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } }) as never,
    ask: vi.fn(), announce: vi.fn(), cards: () => document.body, changed: async () => {} });
  pages.push(page); document.body.append(page.element);
  return { box, page, say };
}
const show = async (page: PluginsPage, kind: "p" | "b", id: string, tab?: string): Promise<void> => {
  location.hash = `#/plugins/${kind}/${id}${tab === undefined ? "" : `/${tab}`}`;
  page.show({ kind: kind === "p" ? "plugin" : "bundle", id, ...(tab === undefined ? {} : { tab }) });
  await settle();
};
const dialog = (): HTMLDialogElement | null => document.querySelector<HTMLDialogElement>("dialog.pl-card-dialog");
/** Presses the head's primary control and, where a card opens, reads it and presses its own. */
const press = async (page: PluginsPage, selector = ".pl-head-tools button.primary"): Promise<HTMLDialogElement | null> => {
  page.element.querySelector<HTMLButtonElement>(selector)!.click();
  await settle();
  const open = dialog();
  const said = (open?.cloneNode(true) ?? null) as HTMLDialogElement | null;
  if (open !== null) history.replaceState({}, "", location.href);
  open?.querySelector<HTMLButtonElement>("button.primary")?.click();
  await settle(); await vi.advanceTimersByTimeAsync(REREAD_MS); await settle();
  return said;
};
/** A card's rows: the group's name, the plugin's, and its switch, on, off or none. */
const cardRows = (card: ParentNode): readonly string[] => [...card.querySelectorAll<HTMLElement>("li.pl-row-item")].map((row) =>
  [row.closest(".pl-card-part")!.querySelector(".pl-card-label")?.textContent ?? "", row.querySelector(".pl-row-link")!.textContent, row.querySelector("[role=switch]")?.getAttribute("aria-checked") ?? "-"].join(" "));
const sent = (box: ReturnType<typeof clickStub>): readonly string[] => box.world.sent.map((click) => `${click.op} ${click.source.replace(/^npm:/, "")}`);
const FIVE = ["@comchatx/cx-schedule", SCHEDULER, "cx-listing-playbook", "cx-amazon-sp-api", "cx-sources"];

for (const language of ["en", "zh"] as const) {
  it(`installs with cx-listing-watch the five it cannot work without, and offers on its Plugins it uses the two it names and can work without, not what those use: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = world(language);
    await page.load();
    await show(page, "p", "cx-listing-watch");
    const card = await press(page);
    // The five, locked on; the two it can use under Optional, switched off, and nothing of what those use.
    const opt = say("pl.dp.optional");
    expect(cardRows(card!)).toEqual([" cx-listing-watch -", ...[" cx-schedule", ` ${SCHEDULER}`, " cx-listing-playbook", " cx-amazon-sp-api", " cx-sources"].map((one) => `${one} true`), `${opt} cx-feishu false`, `${opt} cx-keepa false`]);
    expect(card!.textContent).not.toContain(CHANNELS);
    // Each of the five is written once, each after what it needs, and the plugin pressed last.
    expect([...sent(box)].sort()).toEqual([...FIVE, "@comchatx/cx-listing-watch"].map((name) => `install ${name}`).sort());
    expect(sent(box).at(-1)).toBe("install @comchatx/cx-listing-watch");
    for (const left of ["cx-feishu", CHANNELS, "cx-keepa"]) expect(sent(box).some((one) => one.endsWith(` ${left}`)), left).toBe(false);
    await show(page, "p", "cx-listing-watch", "deps");
    const optional = [...page.element.querySelectorAll<HTMLElement>("section.pl-need")].find((one) => one.querySelector("h2")?.textContent === say("pl.dp.optional"))!;
    const rows = [...optional.querySelectorAll<HTMLElement>("li")];
    // The channels package cx-feishu needs is cx-feishu's to list, not this tab's.
    expect(rows.map((row) => row.querySelector("strong")?.textContent).sort()).toEqual(["cx-feishu", "cx-keepa"]);
    for (const row of rows) expect(row.querySelector(".pl-row-end button.f-icon")?.getAttribute("aria-label"), row.textContent ?? "").toBe(say("pl.installName", { name: row.querySelector("strong")!.textContent! }));
    // Each group is its label and its rows: nothing is said under either.
    expect([...page.element.querySelectorAll<HTMLElement>("section.pl-need > p")]).toEqual([]);
  });

  it(`asks before installing a plugin whose only links are optional, offering them switched off, and leaves what it can use uninstalled: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = world(language);
    await page.load();
    await show(page, "p", "cx-only-optional");
    const card = await press(page);
    expect([cardRows(card!), sent(box)]).toEqual([[" cx-only-optional -", `${say("pl.dp.optional")} cx-keepa false`], ["install cx-only-optional"]]);
  });

  it(`leaves out of a bundle's press, its count and its Remove a member's optional plugin its list does not name, and reads it installed without it: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = world(language);
    await page.load();
    await show(page, "b", BUNDLE.id);
    await press(page);
    expect([...sent(box)].sort()).toEqual(["install cx-amazon-sp-api", "install cx-listing-playbook", "install cx-sources"]);
    await show(page, "b", BUNDLE.id, "plugins");
    const tab = page.element.querySelector<HTMLElement>(`[role="tab"][aria-selected="true"]`)?.textContent ?? "";
    expect(tab).toBe(`${say("pl.tab.plugins")} · 3`);
    expect(page.element.querySelector(".pl-head-tools button.primary")).toBeNull();
    // Keepa installed on its own afterwards is no part of the bundle's Remove.
    const after = world(language, ["cx-listing-playbook", "cx-amazon-sp-api", "cx-sources", "cx-keepa"].map(held));
    after.box.world.pressed = [{ bundle: BUNDLE.id, at: 0, brought: ["cx-listing-playbook", "cx-amazon-sp-api", "cx-sources"] }];
    await after.page.load();
    await show(after.page, "b", BUNDLE.id);
    after.page.element.querySelector<HTMLButtonElement>(".pl-more")!.click();
    after.page.element.querySelector<HTMLButtonElement>(".pl-head-tools .f-menu [role=menuitem]")!.click();
    await settle();
    // The Remove takes the bundle's three but Keepa's base, which Keepa still uses, locked on; Keepa it does not take or list.
    expect(cardRows(dialog()!)).toEqual([`${say("pl.tab.plugins")} cx-listing-playbook false`, `${say("pl.tab.plugins")} cx-amazon-sp-api false`, `${say("pl.tab.plugins")} cx-sources true`]);
    history.replaceState({}, "", location.href);
  });

  it(`takes cx-listing-watch alone on its Remove, with what it requires that nothing else requires, and keeps locked on what another uses: ${language}`, async () => {
    vi.useFakeTimers();
    const { page, say } = world(language, ["@comchatx/cx-listing-watch", ...FIVE, "cx-keepa"].map(held));
    await page.load();
    await show(page, "p", "cx-listing-watch");
    page.element.querySelector<HTMLButtonElement>(".pl-more")!.click();
    page.element.querySelector<HTMLButtonElement>(".pl-head-tools .f-menu [role=menuitem]")!.click();
    await settle();
    const card = dialog()!;
    expect(card.querySelector("h2")?.textContent).toBe(say("pl.c.removeTitle", { name: "cx-listing-watch" }));
    // Nothing else requires cx-schedule or the scheduler it requires: they go with it. The bundle in Yours keeps what it installs, locked on;
    // Keepa, which cx-listing-watch can only use, is no part of the removal.
    const uses = say("pl.c.rmUses");
    expect(cardRows(card)).toEqual([`${uses} cx-schedule false`, `${uses} cx-listing-playbook true`, `${uses} cx-amazon-sp-api true`, `${uses} ${SCHEDULER} false`]);
    const playbook = [...card.querySelectorAll<HTMLElement>("li.pl-row-item")][1]!;
    playbook.querySelector<HTMLButtonElement>("[role=switch]")!.click();
    expect(playbook.querySelector(".pl-row-line")!.textContent).toBe(say("pl.c.stillUsed", { names: BUNDLE.name }));
    history.replaceState({}, "", location.href);
  });
}
