// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { FIRST_RELEASE, type Backend, type Me, type NpmPackage, type Package, type Source } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { catalogueWith } from "./catalogue.js";
import { again, type CardContext } from "./plugins-cards.js";
import { REREAD_MS } from "./plugins-clicks.js";
import { href } from "./plugins-model.js";
import { PluginsPage } from "./plugins-page.js";
import { DEFAULT_PACKAGES, defaultSource } from "../shared/package-names.js";
import type { Power } from "./plugins-queue.js";
import { clickStub, oursAt } from "./plugins-test-kit.js";
import { STRINGS, text, type StringKey } from "./strings.js";

const settle = async (): Promise<void> => { for (let n = 0; n < 12; n++) await Promise.resolve(); await vi.advanceTimersByTimeAsync(0); };
const pages: PluginsPage[] = [];
afterEach(() => { for (const page of pages.splice(0)) page.leave(); vi.clearAllTimers(); vi.useRealTimers(); document.body.replaceChildren(); location.hash = ""; });

const KEEPA = CATALOGUE.plugins.find((one) => one.id === "keepa")!;
/** Keepa's and cx-sources' display names, as each page draws them. */
const NAME = { keepa: { en: "Keepa API", zh: "Keepa 数据接口" }, sources: { en: "Data Source Core", zh: "数据源基础功能" } } as const;
const CHANNELS = "@amaster.ai/pi-channels";
const nothing = { en: "", zh: "" };
const pack = (name: string, version: string, source = `npm:${name}`): Package => ({ name, version, source, about: nothing, description: nothing });
/** Keepa a release behind the version ours give, someone else's package a release behind npm's, and cx-sources current. */
const BEHIND: readonly Package[] = [pack("cx-sources", CATALOGUE.plugins.find((one) => one.id === "cx-sources")!.version!), pack("cx-keepa", "0.0.1"), pack(CHANNELS, "0.1.28")];
const npm = (name: string, version: string, uses: readonly string[] = []): NpmPackage => ({ name, description: "", kinds: ["extension"], author: "amaster", updated: "2026-10-22T00:00:00.000Z", version, repository: "", readme: "", readme_cut: false, ours: false, shipped: { skills: [], prompts: [], unread: [] }, uses });

/** A page over a box that ends each click at once, unless held; npm gives pi-channels 0.1.29, and any other of someone else's as `theirs` says. */
function world(language: "en" | "zh", start: readonly Package[] = BEHIND, keepaOn = true, catalogue = CATALOGUE, power?: () => Power, theirs: Readonly<Record<string, NpmPackage>> = {}) {
  const box = clickStub(start);
  box.world.newest = { "cx-keepa": KEEPA.version!, [CHANNELS]: "0.1.29" };
  const sources: Source[] = [{ name: "keepa", supplier: "Keepa", enabled: keepaOn } as unknown as Source];
  const backend = {
    features: FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" },
    catalogue: async () => catalogue, packages: async () => box.packages(),
    sources: async () => sources, models: async () => undefined, accounts: async () => [], providers: async () => [], modelPlugins: async () => [], series: async () => ({}), chatOffer: async () => undefined,
    readme: async () => undefined, now: () => Date.UTC(2026, 9, 22), npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-10-22T00:00:00Z" }),
    npmPackage: async (name: string, version?: string) => (name === CHANNELS ? npm(name, "0.1.29") : theirs[name] ?? oursAt(name, version)),
    installPackage: (source: string, on: boolean) => box.installPackage(source, on), setPackage: (source: string, on: boolean) => box.setPackage(source, on),
    updatePackage: (source: string) => box.updatePackage(source),
  } as unknown as Backend;
  const say = (key: StringKey, values?: Record<string, string | number>): string => text(language, key, values);
  const changed = vi.fn(async () => undefined);
  const page = new PluginsPage({ power: power ?? box.power, backend, language: () => language, say: (key, values) => say(key as StringKey, values), me: () => ({ kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } }) as Extract<Me, { kind: "signed_in" }>, ask: () => undefined, announce: () => undefined, changed });
  pages.push(page); document.body.append(page.element);
  return { box, page, say, sources, changed };
}

const yours = async (page: PluginsPage): Promise<void> => { location.hash = "#/plugins/yours"; page.show({ kind: "home", view: "yours", filter: "all" }); await settle(); };
const keepaPage = async (page: PluginsPage): Promise<void> => { location.hash = "#/plugins/p/keepa"; page.show({ kind: "plugin", id: "keepa" }); await settle(); };
const lines = (page: PluginsPage): readonly string[] => [...page.element.querySelectorAll(".pl-news")].filter((one) => one.querySelector('[data-focus^="update"]') !== null).map((one) => one.textContent ?? "");
/** What stands at the shelves' rows' ends in Yours: Update, or Try again where its press was refused. */
const ends = (page: PluginsPage): readonly string[] => [...page.element.querySelectorAll(".pl-shelf:not(.pl-queue) .pl-update-end > *")].map((one) => one.textContent ?? "");
/** The queue's rows: the plugin's name, where it stands, `ring` where it runs, and its end's presses by their names, one that takes no press marked so. */
const queue = (page: PluginsPage): readonly (readonly string[])[] => [...page.element.querySelectorAll<HTMLElement>(".pl-queue li")].map((row) => [
  row.querySelector(".pl-row-name strong")?.textContent ?? "", row.querySelector(".pl-row-end .pl-q-state-word")?.textContent ?? "",
  ...(row.querySelector(".pl-row-end .pl-q-state .pl-spin:not(.pl-still)") === null ? [] : ["ring"]),
  ...[...row.querySelectorAll<HTMLButtonElement>(".pl-row-end > button")].map((one) => `${one.getAttribute("aria-label") ?? ""}${one.disabled ? " (off)" : ""}`)]);
const press = async (page: PluginsPage, at: string): Promise<void> => {
  const control = page.element.querySelector<HTMLButtonElement>(`[data-focus="${at}"]`)!;
  control.focus(); control.click();
  await settle();
};
const ended = async (): Promise<void> => { await vi.advanceTimersByTimeAsync(REREAD_MS); await settle(); await settle(); };
const toast = (page: PluginsPage): string => page.element.querySelector(".pl-toast")?.textContent ?? "";
const dot = (page: PluginsPage): string => { const host = document.createElement("span"); host.append(...page.newDot().filter((one): one is Node => one instanceof Node)); return host.querySelector(".pl-new") === null ? "" : host.textContent ?? ""; };
const tab = (page: PluginsPage): string => [...page.element.querySelectorAll("nav.pl-views a")].at(-1)?.textContent ?? "";

it("names the one plugin left to update on the Chinese page by its Chinese name, in the Yours tab's and the sidebar's spoken words", async () => {
  vi.useFakeTimers();
  const named = { ...CATALOGUE, plugins: CATALOGUE.plugins.map((one) => (one.id === "keepa" ? { ...one, nameZh: "Keepa 数据接口" } : one)) };
  const { page, say } = world("zh", BEHIND.filter((one) => one.name !== CHANNELS), true, named);
  await page.load();
  await yours(page);
  const spoken = ` ${say("pl.updateLine", { name: "Keepa 数据接口" })}`;
  expect([dot(page), tab(page)]).toEqual([spoken, `${say("pl.yours")}${spoken}`]);
});

for (const language of ["en", "zh"] as const) {
  it(`reminds of the plugins with a new version, atop Yours, at each row's end and by the dots, and updates them all at one press: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say, sources, changed } = world(language);
    await page.load();
    await yours(page);
    const count = say("pl.updatesLine", { count: 2 });
    expect([lines(page), ends(page)]).toEqual([[`${count}${say("pl.updateAll")}`], [say("pl.update"), say("pl.update")]]);
    expect(page.element.querySelector(".pl-updates")?.nextElementSibling?.matches(".pl-shelf")).toBe(true);
    // Each row's Update stands at its end, after the row's link, and names its plugin; nothing is drawn under the row, and no version is printed.
    const updates = [...page.element.querySelectorAll<HTMLElement>('.pl-update-end button[data-focus^="update "]')];
    expect(updates.map((one) => one.getAttribute("aria-label"))).toEqual([say("pl.updateName", { name: NAME.keepa[language] }), say("pl.updateName", { name: CHANNELS })]);
    // Update stands left of the row's switch, in the row's end beside the row and its link.
    expect(updates.map((one) => [one.closest(".pl-row-end")?.previousElementSibling?.querySelector("a.pl-row-link") !== null, one.closest(".pl-update-end")!.nextElementSibling?.matches(".f-switch")])).toEqual([[true, true], [true, true]]);
    expect(page.element.querySelectorAll(".pl-rows .pl-news").length).toBe(0);
    expect(page.element.querySelector(".pl-news")?.textContent).not.toMatch(/\d+\.\d+\.\d+/);
    expect([tab(page), dot(page)]).toEqual([`${say("pl.yours")} ${count}`, ` ${count}`]);
    // A search shows what it found, its rows with their own lines: the count is the whole of Yours', and is not said over a search.
    const search = page.element.querySelector<HTMLInputElement>("input.pl-search")!;
    search.value = "Keepa"; search.dispatchEvent(new Event("input")); await settle();
    expect([page.element.querySelector(".pl-updates"), lines(page), ends(page)]).toEqual([null, [], [say("pl.update")]]);
    search.value = ""; search.dispatchEvent(new Event("input")); await settle();
    await press(page, "update-all");
    await ended();
    expect(box.world.sent.map((click) => [click.op, click.source])).toEqual([["update", "npm:cx-keepa"], ["update", `npm:${CHANNELS}`]]);
    expect(box.world.list.packages.map((one) => [one.name, one.version])).toEqual([["cx-sources", BEHIND[0]!.version], ["cx-keepa", KEEPA.version], [CHANNELS, "0.1.29"]]);
    expect([lines(page), ends(page), tab(page), dot(page)]).toEqual([[], [], say("pl.yours"), ""]);
    expect(toast(page)).toBe(say("pl.q.added"));
    // The update moved no source: Keepa stays on as it was, and the app read the account again for the sidebar. Update gone, the
    // keyboard goes to the first row it stood on.
    expect([sources[0]!.enabled, changed.mock.calls.length > 0, document.activeElement?.getAttribute("href")]).toEqual([true, true, "#/plugins/p/keepa"]);
  });

  it(`says one plugin's new version on its row alone, and Update there updates that one: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = world(language, BEHIND.filter((one) => one.name !== CHANNELS));
    await page.load();
    await yours(page);
    expect([lines(page), ends(page), dot(page)]).toEqual([[], [say("pl.update")], ` ${say("pl.updateLine", { name: NAME.keepa[language] })}`]);
    await press(page, "update keepa");
    await ended();
    expect([box.world.sent.map((click) => click.source), ends(page), toast(page), document.activeElement?.getAttribute("href")]).toEqual([["npm:cx-keepa"], [], say("pl.q.added"), "#/plugins/p/keepa"]);
  });

  it(`puts Update all's updates in the queue in the press's order, the first running, and offers no Update for them while they are there: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = world(language);
    box.world.hold = true;
    await page.load();
    await yours(page);
    await press(page, "update-all");
    expect(box.world.sent.map((click) => [click.op, click.source])).toEqual([["update", "npm:cx-keepa"], ["update", `npm:${CHANNELS}`]]);
    expect(queue(page)).toEqual([[NAME.keepa[language], say("pl.q.updating"), "ring", `${say("pl.q.cancelUpdate", { name: NAME.keepa[language] })} (off)`], [CHANNELS, say("pl.q.turnUpdate"), say("pl.q.cancelUpdate", { name: CHANNELS })]]);
    // One sentence for the press; the shelf's Update, Update all and the dots go while the queue holds them.
    expect([toast(page), lines(page), ends(page), dot(page)]).toEqual([say("pl.q.added"), [], [], ""]);
    box.release();
    await ended();
    expect([page.element.querySelector(".pl-queue"), lines(page), dot(page)]).toEqual([null, [], ""]);
  });

  it(`offers no Update again, nor counts it, for a plugin whose update ended while the batch runs and the list still names its old version, until cx's computer lists the new one: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page } = world(language, BEHIND, true, CATALOGUE, () => "on");
    box.world.hold = true;
    await page.load();
    await yours(page);
    await press(page, "update-all");
    // While changes wait, the platform answers a read from the account's row: Keepa's update ended well, and the packages are the old ones.
    const old = box.world.list.packages;
    box.end(box.world.sent[0]!);
    box.world.list = { ...box.world.list, packages: old, asleep: true };
    await ended();
    expect([lines(page), ends(page), dot(page), queue(page).map((row) => row[0])]).toEqual([[], [], "", [CHANNELS]]);
    // The batch ends, and cx's computer answers the list itself with the new versions.
    box.release();
    box.world.list = { ...box.world.list, asleep: false, packages: box.world.list.packages.map((one) => (one.name === "cx-keepa" ? { ...one, version: KEEPA.version! } : one)) };
    await ended();
    expect([page.element.querySelector(".pl-queue"), lines(page), ends(page), dot(page)]).toEqual([null, [], [], ""]);
  });

  it(`updates what a plugin builds on before the plugin, as installs go, whatever the shelves' order: ${language}`, async () => {
    vi.useFakeTimers();
    const core = CATALOGUE.plugins.find((one) => one.id === "cx-sources")!;
    const { box, page } = world(language, [pack("cx-sources", "0.0.1"), pack("cx-keepa", "0.0.1")]);
    box.world.newest = { "cx-sources": core.version!, "cx-keepa": KEEPA.version! };
    box.world.hold = true;
    await page.load();
    await yours(page);
    await press(page, "update-all");
    expect(box.world.sent.map((click) => click.source)).toEqual(["npm:cx-sources", "npm:cx-keepa"]);
    expect(queue(page).map((row) => row[0])).toEqual([NAME.sources[language], NAME.keepa[language]]);
  });

  it(`updates what someone else's plugin builds on, as npm says, before it, and it before a plugin of ours that builds on it: ${language}`, async () => {
    vi.useFakeTimers();
    const other = "pi-fixture-other";
    const catalogue = catalogueWith([
      { ...npm("cx-keepa", "0.0.2", [other]), ours: true, comchatx: { order: 1, id: "keepa", name: "Keepa API" } },
      { ...npm("cx-sources", "0.0.2"), ours: true, comchatx: { order: 2, id: "cx-sources", name: "Data Source Core" } },
    ], []);
    const { box, page } = world(language, [pack("cx-keepa", "0.0.1"), pack(other, "0.0.1"), pack("cx-sources", "0.0.1")], true, catalogue, undefined, { [other]: npm(other, "0.0.2", ["cx-sources"]) });
    box.world.newest = { "cx-keepa": "0.0.2", "cx-sources": "0.0.2", [other]: "0.0.2" };
    box.world.hold = true;
    await page.load();
    await yours(page);
    await press(page, "update-all");
    expect(box.world.sent.map((click) => click.source)).toEqual(["npm:cx-sources", `npm:${other}`, "npm:cx-keepa"]);
  });

  it(`updates what someone else's plugin builds on, as npm says, before it, where both were pressed: ${language}`, async () => {
    vi.useFakeTimers();
    const [alpha, omega] = ["pi-fixture-alpha", "pi-fixture-omega"];
    const catalogue = catalogueWith([{ ...npm("cx-sources", "0.0.2"), ours: true, comchatx: { order: 1, id: "cx-sources", name: "Data Source Core" } }], []);
    const { box, page } = world(language, [pack(alpha, "0.0.1"), pack(omega, "0.0.1"), pack("cx-sources", "0.0.1")], true, catalogue, undefined, { [alpha]: npm(alpha, "0.0.2", [omega]), [omega]: npm(omega, "0.0.2") });
    box.world.newest = { "cx-sources": "0.0.2", [alpha]: "0.0.2", [omega]: "0.0.2" };
    box.world.hold = true;
    await page.load();
    await yours(page);
    await press(page, "update-all");
    expect(box.world.sent.map((click) => click.source)).toEqual(["npm:cx-sources", `npm:${omega}`, `npm:${alpha}`]);
  });

  it(`answers an update pressed while cx's computer sleeps by its rows in the queue, each saying it updates when the computer starts, and no ✓: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = world(language);
    box.world.hold = true;
    box.world.list = { ...box.world.list, asleep: true };
    await page.load();
    await yours(page);
    await press(page, "update-all");
    await ended();
    expect(toast(page)).toBe(say("pl.q.added"));
    expect(queue(page).map((row) => row.slice(0, 2))).toEqual([[NAME.keepa[language], say("pl.updateQueued")], [CHANNELS, say("pl.updateQueued")]]);
    expect([page.element.querySelectorAll(".pl-update-end .pl-done-mark").length, dot(page), tab(page)]).toEqual([0, "", say("pl.yours")]);
    // Its page offers no Update while it waits.
    await keepaPage(page);
    expect(page.element.querySelector('[data-focus^="update"]')).toBeNull();
  });

  it(`draws an update's queue row with the head its shelf row has, the switch alone saying it is off: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page } = world(language, BEHIND.filter((one) => one.name !== CHANNELS), false);
    box.world.hold = true;
    await page.load();
    await yours(page);
    // The words beside the name; the marks after it, which only 我的 draws, have none.
    const head = (row: Element | null): readonly string[] => [...row!.querySelectorAll(".pl-row-name > *")].map((one) => one.textContent ?? "").filter((one) => one !== "");
    const shelf = head(page.element.querySelector('.pl-shelf:not(.pl-queue) a.pl-row-link[href="#/plugins/p/keepa"]')!.closest("li"));
    // Off is the switch's to say, not a word by the name (sheet 1).
    expect(shelf).toEqual([NAME.keepa[language]]);
    await press(page, "update keepa");
    expect(head(page.element.querySelector('.pl-queue li[data-source="npm:cx-keepa"]'))).toEqual(shelf);
    box.release();
    await ended();
  });

  it(`draws a failed update in the queue alone, as its failure with no reason, the retry mark and ×, and the retry sends it again to the queue's end: ${language}`, async () => {
    vi.useFakeTimers();
    // cx-sources missing: nothing is drawn under Keepa's shelf row, before the update failed or after.
    const { box, page, say } = world(language, BEHIND.filter((one) => one.name !== "cx-sources"));
    box.world.fail = "pi_failed";
    box.world.detail = "npm error code ENOTFOUND";
    await page.load();
    await yours(page);
    const item = (): Element => page.element.querySelector('.pl-shelf:not(.pl-queue) a.pl-row-link[href="#/plugins/p/keepa"]')!.closest("li")!;
    const order = (): readonly string[] => [...item().children].map((one) => [...one.classList].join(" ")).concat(item().querySelector(".pl-row-end .pl-update-end") === null ? [] : ["update"]);
    expect(order()).toEqual(["pl-row", "pl-row-end", "update"]);
    await press(page, "update keepa");
    await ended();
    // The shelf's row offers no Update and says nothing of the failure: its row in the queue does, without npm's words.
    expect([order(), item().querySelector(".pl-q-state")]).toEqual([["pl-row", "pl-row-end"], null]);
    const row = page.element.querySelector<HTMLElement>('.pl-queue li[data-source="npm:cx-keepa"]')!;
    const state = row.querySelector<HTMLElement>(".pl-row-end .pl-q-state")!;
    expect([state.getAttribute("role"), state.matches(".pl-q-state-bad"), state.querySelector("svg") !== null, state.textContent, row.textContent?.includes("ENOTFOUND")]).toEqual(["alert", true, true, say("pl.fail.updateHere"), false]);
    expect(queue(page)).toEqual([[NAME.keepa[language], say("pl.fail.updateHere"), say("pl.q.retryUpdate", { name: NAME.keepa[language] }), say("pl.q.cancelUpdate", { name: NAME.keepa[language] })]]);
    // Keepa is still behind: pi-channels' Update stands, and the dots count it alone.
    expect([lines(page), ends(page), dot(page)]).toEqual([[], [say("pl.update")], ` ${say("pl.updateLine", { name: CHANNELS })}`]);
    box.world.fail = undefined;
    box.world.hold = true;
    row.querySelector<HTMLButtonElement>('[data-focus^="retry "]')!.click();
    await settle(); await settle();
    expect(queue(page)).toEqual([[NAME.keepa[language], say("pl.q.updating"), "ring", `${say("pl.q.cancelUpdate", { name: NAME.keepa[language] })} (off)`]]);
    expect([toast(page), document.activeElement?.getAttribute("data-focus")]).toEqual([say("pl.q.added"), "queue update npm:cx-keepa"]);
    expect(box.world.sent.map((click) => [click.op, click.source])).toEqual([["update", "npm:cx-keepa"], ["update", "npm:cx-keepa"]]);
    box.release();
    await ended();
    expect(page.element.querySelector(".pl-queue")).toBeNull();
  });

  it(`draws a failed update on Yours and Keepa's page, not again on its Discover card: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page } = world(language);
    box.world.fail = "pi_failed";
    await page.load();
    await yours(page);
    await press(page, "update keepa");
    await ended();
    expect(page.element.querySelectorAll(".pl-queue .pl-q-state-bad").length).toBe(1);
    location.hash = "#/plugins"; page.show({ kind: "home", view: "discover", filter: "all" }); await settle();
    const card = [...page.element.querySelectorAll(".pl-card")].find((one) => one.querySelector('a[href="#/plugins/p/keepa"]') !== null);
    expect([page.element.querySelector(".pl-failed"), card?.querySelector(".pl-done-mark")?.textContent]).toEqual([null, "✓"]);
  });

  it(`keeps ✓ on Keepa's Discover card while cx's computer updates it, saying nothing of the update there: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = world(language);
    box.world.hold = true;
    await page.load();
    await yours(page);
    await press(page, "update keepa");
    location.hash = "#/plugins"; page.show({ kind: "home", view: "discover", filter: "all" }); await settle();
    // Discover says nothing of a new version (ruled 2026-11-13): the card stays installed, ✓, with no ring.
    const mark = page.element.querySelector<HTMLElement>('[data-focus="act #/plugins/p/keepa"]')!;
    expect([mark.className, mark.getAttribute("aria-busy"), mark.getAttribute("aria-label"), mark.querySelector(".pl-spin"), mark.textContent]).toEqual(["pl-done-mark", null, say("pl.installedName", { name: NAME.keepa[language] }), null, "✓"]);
    expect("pl.doing.update" in STRINGS).toBe(false);
    box.release();
    await ended();
    expect(page.element.querySelector('[data-focus="act #/plugins/p/keepa"]')?.textContent).toBe("✓");
  });

  it(`keeps Keepa's switch on and pressable on its page while its update is in the queue, with nothing turning there: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = world(language);
    box.world.hold = true;
    await page.load();
    await keepaPage(page);
    await press(page, "update keepa");
    const toggle = page.element.querySelector<HTMLButtonElement>("[role=switch]")!;
    expect([toggle.getAttribute("aria-busy"), toggle.getAttribute("aria-disabled"), toggle.previousElementSibling?.textContent, page.element.querySelector(".pl-head-tools .f-menu [role=menuitem]")?.textContent])
      .toEqual([null, null, say("pl.switch.on"), say("pl.head.remove")]);
    expect([page.element.querySelectorAll("[aria-busy=true]").length, page.element.querySelector('[data-focus^="update"]'), toast(page)]).toEqual([0, null, say("pl.q.added")]);
    toggle.click();
    await settle();
    expect(box.world.sent.map((click) => click.op)).toEqual(["update", "off"]);
    box.release();
    await ended();
  });

  it(`reads the reminder for the sidebar before the page opens, and counts no update already asked for: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = world(language);
    await page.glance();
    expect(dot(page)).toBe(` ${say("pl.updatesLine", { count: 2 })}`);
    const asked = world(language);
    asked.box.world.list = { ...asked.box.world.list, asleep: true, waiting: [{ id: "0000000000000001", op: "update", source: "npm:cx-keepa" }] };
    await asked.page.glance();
    expect(dot(asked.page)).toBe(` ${say("pl.updateLine", { name: CHANNELS })}`);
    expect(box.world.sent).toEqual([]);
  });
}

// 重试 after a failed Update updates again, whether Keepa's source is on or off and whether cx's computer wakes or sleeps for the try: it
// never switches the source.
for (const language of ["en", "zh"] as const) for (const asleep of [false, true]) for (const keepaOn of [false, true]) {
  it(`tries a failed Update again as an update: ${language}, ${asleep ? "asleep" : "awake"}, source ${keepaOn ? "on" : "off"}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = world(language, BEHIND.filter((one) => one.name !== CHANNELS), keepaOn);
    box.world.fail = "pi_failed";
    await page.load();
    await yours(page);
    await press(page, "update keepa");
    await ended();
    const retry = page.element.querySelector<HTMLButtonElement>('.pl-queue [data-focus^="retry "]');
    expect(retry?.getAttribute("aria-label")).toBe(say("pl.q.retryUpdate", { name: NAME.keepa[language] }));
    box.world.fail = undefined;
    if (asleep) { box.world.hold = true; box.world.list = { ...box.world.list, asleep: true }; }
    retry!.focus(); retry!.click();
    await settle();
    await ended();
    expect(box.world.sent.map((click) => [click.op, click.source])).toEqual([["update", "npm:cx-keepa"], ["update", "npm:cx-keepa"]]);
    expect([page.element.querySelector('[data-focus^="retry "]'), toast(page)]).toEqual([null, say("pl.q.added")]);
    expect(queue(page)).toEqual(asleep ? [[NAME.keepa[language], say("pl.updateQueued"), say("pl.q.cancelUpdate", { name: NAME.keepa[language] })]] : []);
  });
}

it("leaves an update's retry to Update: the card's Try again switches nothing for it", async () => {
  const run = vi.fn(async () => true);
  expect(await again({ run } as unknown as CardContext, KEEPA, { act: "update" })).toBe(false);
  expect(run).not.toHaveBeenCalled();
});

// Round 28 draws Update's rings still where motion is reduced, and the queue's ring stands as they do, and turning otherwise; another ring keeps its own motion. Read from the
// cascade the browser computes under each preference, with the site's own stylesheet.
for (const reduce of [true, false]) {
  it(`turns Update's rings ${reduce ? "not at all where motion is reduced" : "where motion is not reduced"}, as round 28 draws them`, async () => {
    vi.useFakeTimers();
    const device = (window as unknown as { readonly happyDOM: { readonly settings: { readonly device: { prefersReducedMotion: string } } } }).happyDOM.settings.device;
    const was = device.prefersReducedMotion;
    device.prefersReducedMotion = reduce ? "reduce" : "no-preference";
    const style = document.createElement("style");
    style.textContent = readFileSync(resolve("src/web/site/app.css"), "utf8");
    document.head.append(style);
    try {
      expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(reduce);
      const { box, page } = world("en");
      box.world.hold = true;
      await page.load();
      await yours(page);
      await press(page, "update-all");
      // The queue's one ring, where the update cx's computer runs stands.
      const rings = [...page.element.querySelectorAll<HTMLElement>(".pl-queue .pl-q-state .pl-spin:not(.pl-still)")];
      expect(rings.length).toBe(1);
      expect(rings.map((ring) => getComputedStyle(ring).animation)).toEqual(Array(1).fill(reduce ? "none" : "pl-spin 0.8s linear infinite"));
      const other = document.createElement("span");
      other.className = "pl-spin";
      document.body.append(other);
      expect(getComputedStyle(other).animationName === "none" || getComputedStyle(other).animation === "none").toBe(false);
      box.release();
      await ended();
    } finally {
      style.remove();
      device.prefersReducedMotion = was;
    }
  });
}

/** Keepa over an older cx-sources, whose Update fails; `off` has cx-sources installed and switched off. */
async function sourcesFailed(language: "en" | "zh", off = false) {
  const start = BEHIND.filter((one) => one.name !== CHANNELS).map((one) => (one.name === "cx-sources" ? { ...one, version: "0.0.0", ...(off ? { enabled: false } : {}) } : one));
  const one = world(language, start);
  one.box.world.newest = { ...one.box.world.newest, "cx-sources": CATALOGUE.plugins.find((plugin) => plugin.id === "cx-sources")!.version! };
  one.box.world.fail = "pi_failed";
  await one.page.load();
  await yours(one.page);
  await press(one.page, "update cx-sources");
  await ended();
  expect(one.page.element.querySelector('.pl-queue [data-focus^="retry "]')).not.toBeNull();
  one.box.world.fail = undefined;
  return one;
}

for (const language of ["en", "zh"] as const) {
  it(`draws a failed Update no longer once its package has left the list, and offers Install in its place: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = await sourcesFailed(language);
    // The session removes cx-sources itself: the next list no longer names it, and Keepa still needs it.
    box.world.list = { ...box.world.list, packages: box.world.list.packages.filter((one) => one.name !== "cx-sources") };
    await page.load();
    await yours(page);
    expect(page.element.querySelector('[data-focus^="retry "]')).toBeNull();
    expect(page.element.textContent).not.toContain(say("pl.fail.updateHere"));
    // What Keepa lacks is said on its own page, not under its row.
    expect(page.element.querySelector('[data-focus="need keepa cx-sources"]')).toBeNull();
    await keepaPage(page);
    expect(page.element.querySelector('[data-focus="need keepa cx-sources"]')?.textContent).toBe({ en: "Install Data Source Core", zh: "安装数据源基础功能" }[language]);
    expect(box.world.sent.map((click) => click.op)).toEqual(["update"]);
  });

  it(`keeps a failed Update through a list read that fails, and draws it again once the list reads: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = await sourcesFailed(language);
    const read = box.packages;
    box.packages = async () => { throw new Error("unreachable"); };
    await page.load();
    expect(page.element.querySelector('[data-focus^="retry "]')).toBeNull();
    box.packages = read;
    await page.load();
    const item = page.element.querySelector('.pl-queue a.pl-row-link[href="#/plugins/p/cx-sources"]')?.closest("li");
    expect([item?.querySelector(".pl-q-state-bad")?.textContent, item?.querySelector('.pl-row-end [data-focus^="retry "]')?.getAttribute("data-focus")]).toEqual([say("pl.fail.updateHere"), "retry update npm:cx-sources"]);
    expect(box.world.sent.map((click) => click.op)).toEqual(["update"]);
  });

  it(`leaves a failed Update of what a plugin needs to the queue: that plugin's page offers no second Try again for it: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = await sourcesFailed(language, true);
    await keepaPage(page);
    expect([page.element.querySelector('[data-focus="need-again keepa cx-sources"]'), page.element.textContent?.includes(say("pl.fail.update", { name: "Data Source Billing" }))]).toEqual([null, false]);
    await yours(page);
    page.element.querySelector<HTMLButtonElement>('.pl-queue [data-focus^="retry "]')!.click();
    await settle();
    await ended();
    expect(box.world.sent.map((click) => [click.op, click.source])).toEqual([["update", "npm:cx-sources"], ["update", "npm:cx-sources"]]);
    expect(page.element.querySelector('[data-focus^="retry "]')).toBeNull();
  });
}

it("draws a bundle's page and Yours from what is held while npm is still asked for a package's newest version, offers its update once npm answers, and draws a list read again without waiting on npm", async () => {
  vi.useFakeTimers();
  const WEB = "pi-mcp-adapter";
  const { box, page, say } = world("en", [...BEHIND, pack(WEB, "0.40.0")]);
  const npmPackage = page.ports.backend.npmPackage.bind(page.ports.backend);
  let answer = (): void => undefined;
  const hold = (): void => {
    const held = new Promise<void>((done) => { answer = done; });
    page.ports.backend.npmPackage = async (name, version) => { if (name !== WEB && version === undefined) return npmPackage(name, version); await held; return name === WEB ? npm(name, "0.42.0") : npmPackage(name, version); };
  };
  hold();
  const bundle = CATALOGUE.bundles[0]!;
  location.hash = `#/plugins/b/${bundle.id}`;
  page.show({ kind: "bundle", id: bundle.id });
  let loaded = false;
  const loading = page.load().then(() => { loaded = true; });
  await settle();
  expect([page.element.querySelector("h1")?.textContent, page.element.querySelector(".sk"), loaded]).toEqual([bundle.name, null, false]);
  // npm not answered, what is newer is not known: Yours is drawn whole, and no update is offered yet.
  await yours(page);
  const count = (updates: number): string => say("pl.updatesLine", { count: updates });
  expect([page.element.querySelector(".sk"), page.element.textContent?.includes(WEB), lines(page)]).toEqual([null, true, []]);
  answer();
  await loading;
  expect(lines(page)[0]?.startsWith(count(3))).toBe(true);
  // Read again with npm held, the list draws what came in, and the update npm offered stands until it answers again.
  hold();
  await box.installPackage("npm:@comchatx/cx-topics", true);
  const again = page.load();
  await settle();
  expect([[...page.element.querySelectorAll("a.pl-row-link")].some((row) => row.getAttribute("href") === "#/plugins/p/cx-topics"), lines(page)[0]?.startsWith(count(3))]).toEqual([true, true]);
  answer();
  await again;
});

it("asks again for a record's package its README unread, and takes the providers and accounts the world already read", async () => {
  vi.useFakeTimers();
  const { page } = world("en");
  const backend = page.ports.backend;
  const npmPackage = backend.npmPackage.bind(backend);
  const ours: string[] = [];
  // Keepa's record was read with its README unread, so Keepa's page asks npm again for its package, at its record's version.
  const keepa = CATALOGUE.plugins.find((one) => one.id === "keepa")!;
  backend.catalogue = async () => ({ ...CATALOGUE, plugins: CATALOGUE.plugins.map((one) => (one === keepa ? { ...one, box: { ...one.box!, unread: ["readme"] as const } } : one)) });
  backend.npmPackage = async (name, version) => {
    if (version === undefined) return npmPackage(name, version);
    ours.push(`${name}@${version}`);
    return new Promise<never>(() => undefined);
  };
  await page.load();
  location.hash = "#/plugins/p/keepa/settings";
  page.show({ kind: "plugin", id: "keepa", tab: "settings" });
  await settle();
  expect(ours).toEqual([`cx-keepa@${keepa.version}`]);
  // Providers and accounts asked for again would not answer: a model plugin's page draws from those the world holds.
  backend.providers = backend.accounts = () => new Promise<never>(() => undefined);
  const anthropic = CATALOGUE.plugins.find((one) => one.id === "anthropic")!;
  location.hash = "#/plugins/p/anthropic";
  page.show({ kind: "plugin", id: "anthropic" });
  await settle();
  expect([page.element.querySelector("main h1, h1")?.textContent, page.element.querySelector(".sk")]).toEqual([anthropic.name, null]);
});

it("draws a record that draws no provider while the providers are still out, and a model's record once they answer", async () => {
  vi.useFakeTimers();
  const { page, say } = world("en");
  let provide = (): void => undefined;
  page.ports.backend.providers = () => new Promise((done) => { provide = () => { done([]); }; });
  const essentials = CATALOGUE.bundles.find((one) => one.id === "comchatx-essentials")!;
  location.hash = `#/plugins/b/${essentials.id}`;
  page.show({ kind: "bundle", id: essentials.id });
  const loading = page.load();
  await settle();
  const text = page.element.textContent ?? "";
  // Its members are the defaults and Jev, which cx-topics builds on.
  expect([page.element.querySelector("h1")?.textContent, page.element.querySelector(".sk"), text.includes(say("pl.members", { count: DEFAULT_PACKAGES.length + 1 })), page.element.querySelector(".pl-side")])
    .toEqual([essentials.name, null, true, null]);
  // A model's record draws from the providers: it stands as its shape until they answer.
  const anthropic = CATALOGUE.plugins.find((one) => one.id === "anthropic")!;
  location.hash = "#/plugins/p/anthropic";
  page.show({ kind: "plugin", id: "anthropic" });
  await settle();
  expect(page.element.querySelector(".sk")).not.toBeNull();
  provide();
  await loading;
  await settle();
  expect([page.element.querySelector("h1")?.textContent, page.element.querySelector(".sk")]).toEqual([anthropic.name, null]);
});

it("lists on Yours the defaults waiting for a computer that never ran, each linked to its record and drawn as installed, as Discover's shelf holds them", async () => {
  vi.useFakeTimers();
  const { page } = world("en", []);
  const waiting = DEFAULT_PACKAGES.map((name, at) => ({ id: (at + 1).toString(16).padStart(16, "0"), op: "install" as const, source: defaultSource(name) }));
  page.ports.backend.packages = async () => ({ packages: [], onImage: [], asleep: false, waiting, ends: [] });
  await page.load();
  await yours(page);
  const wanted = DEFAULT_PACKAGES.map((name) => href.item(CATALOGUE.plugins.find((one) => one.box?.package === name)!));
  const rows = [...page.element.querySelectorAll<HTMLAnchorElement>("a.pl-row-link")].filter((row) => wanted.includes(row.getAttribute("href") ?? ""));
  // Each is drawn as installed, as the seller's install is until a list says otherwise: no + offers it again.
  expect([rows.map((row) => row.getAttribute("href")).sort(), page.element.querySelectorAll(".pl-act").length, page.element.querySelector(".pl-empty")]).toEqual([[...wanted].sort(), 0, null]);
});

it("draws the playbook held at 0.3.0, with 0.4.0 on npm, in 0.4.0's Chinese README, its head saying 0.3.0 with Update beside it, and asks npm nothing at 0.3.0", async () => {
  vi.useFakeTimers();
  const PLAYBOOK = "cx-listing-playbook";
  const { box, page, say } = world("zh", [...BEHIND, pack(PLAYBOOK, "0.3.0")]);
  const record = CATALOGUE.plugins.find((one) => one.box?.package === PLAYBOOK)!;
  page.ports.backend.catalogue = async () => ({ ...CATALOGUE, plugins: CATALOGUE.plugins.map((one) => (one === record ? { ...one, version: "0.4.0" } : one)) });
  box.world.newest = { ...box.world.newest, [PLAYBOOK]: "0.4.0" };
  const asked: (string | undefined)[] = [];
  const npmPackage = page.ports.backend.npmPackage.bind(page.ports.backend);
  page.ports.backend.npmPackage = async (name, version) => { if (name === PLAYBOOK) asked.push(version); return npmPackage(name, version); };
  await page.load();
  location.hash = `#/plugins/p/${record.id}`;
  page.show({ kind: "plugin", id: record.id });
  await settle();
  const head = page.element.querySelector(".pl-head-meta")!.textContent ?? "";
  // 更新 is a button in words in the head, left of the state word, and no line of its own (correction 2).
  const update = page.element.querySelector<HTMLElement>(".pl-head-tools .pl-update-end")!;
  expect([head.includes("0.3.0"), head.includes("0.4.0"), update.textContent, update.nextElementSibling?.textContent, page.element.querySelector(".pl-news")]).toEqual([true, false, say("pl.update"), say("pl.switch.on"), null]);
  expect(String(page.element.querySelector(".pl-readme")?.innerHTML)).toContain(record.box!.readme!.zh!.split("\n")[0]!);
  expect(asked).not.toContain("0.3.0");
});
