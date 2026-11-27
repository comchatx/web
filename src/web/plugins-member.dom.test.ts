// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { FIRST_RELEASE, type Backend, type ClickEnd, type Me, type Package } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { withRecords } from "./catalogue.js";
import { PluginsPage } from "./plugins-page.js";
import { clickStub } from "./plugins-test-kit.js";
import { failureUnder, queueRow, type QueueRow } from "./plugins-queue.js";
import { text, type StringKey } from "./strings.js";

// What an organization's member sees on Discover and Yours: what is installed, and who installed it, with nothing that installs, turns,
// removes, updates or makes; the admin's page is main's, every control in place.
const made = (id: string, name: string) => ({ id, name, author: "ComChatX", section: "extensions" as const, about: { en: "A plugin.", zh: "一个插件。" }, builds: [], box: { package: id, source: `npm:${id}`, skills: [], prompts: [{ name: "draft", about: { en: "Draft a listing", zh: "写一条商品描述" } }] } });
const catalogue = withRecords(CATALOGUE, { plugins: [made("lw", "Listing writer"), made("kp", "Keyword planner"), made("pdf", "Product PDF")] });
const settle = async (): Promise<void> => { for (let n = 0; n < 12; n++) await Promise.resolve(); await vi.advanceTimersByTimeAsync(0); };
const say = (key: StringKey, values?: Record<string, string | number>): string => text("zh", key, values);
const pages: PluginsPage[] = [];
afterEach(() => { for (const page of pages.splice(0)) page.leave(); vi.clearAllTimers(); vi.useRealTimers(); document.body.replaceChildren(); location.hash = ""; });

const source = (id: string): string => catalogue.plugins.find((one) => one.id === id)!.box!.source!;
function page(role: "admin" | "member", ends: readonly ClickEnd[] = []): PluginsPage {
  // Keepa installed and on with a newer version out, SP-API installed and off, Amazon Ads not installed.
  const box = clickStub([{ name: source("keepa").replace(/^npm:/, ""), version: "0.0.1", source: source("keepa"), enabled: true } as Package, { name: source("amazon-sp-api").replace(/^npm:/, ""), version: "1.0.0", source: source("amazon-sp-api"), enabled: false } as Package]);
  box.world.newest = { [source("keepa")]: "9.0.0" };
  box.world.list = { ...box.world.list, ends };
  const backend = {
    features: FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" },
    catalogue: async () => catalogue, packages: async () => box.packages(),
    sources: async () => [], models: async () => undefined, accounts: async () => [], providers: async () => [], modelPlugins: async () => [], series: async () => ({}), chatOffer: async () => undefined,
    readme: async () => undefined, now: () => Date.UTC(2026, 10, 10), npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-11-10T00:00:00Z" }),
    installPackage: (source: string, on: boolean) => box.installPackage(source, on), setPackage: (source: string, on: boolean) => box.setPackage(source, on), updatePackage: (source: string) => box.updatePackage(source),
  } as unknown as Backend;
  const me = { kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 }, organization: { id: "org", role } } as unknown as Extract<Me, { kind: "signed_in" }>;
  const one = new PluginsPage({ power: () => box.power(), backend, language: () => "zh", say: (key, values) => say(key as StringKey, values), me: () => me,
    ask: () => undefined, announce: () => undefined, changed: async () => undefined, answering: () => false, listRead: () => undefined });
  pages.push(one); document.body.append(one.element);
  return one;
}
const open = async (one: PluginsPage, view: "discover" | "yours"): Promise<void> => { await one.load(); location.hash = `#/plugins/${view}/all`; one.show({ kind: "home", view, filter: "all" }); await settle(); };
const card = (one: PluginsPage, id: string): HTMLElement | undefined => [...one.element.querySelectorAll<HTMLElement>(".pl-card")].find((each) => each.querySelector(`a[href="#/plugins/p/${id}"]`) !== null);
const row = (one: PluginsPage, id: string): HTMLElement | undefined => [...one.element.querySelectorAll<HTMLElement>(".pl-shelf li")].find((each) => each.querySelector(`a.pl-row-link[href="#/plugins/p/${id}"]`) !== null);

it("draws a member's Discover with no + and no Create, and says on each installed card that the organization installed it", async () => {
  vi.useFakeTimers();
  const one = page("member");
  await open(one, "discover");
  expect(one.element.querySelector(".pl-create")).toBeNull();
  expect(card(one, "amazon-ads")?.querySelector(".pl-act")).toBeNull();
  expect(card(one, "keepa")?.querySelector(".pl-by-org")?.textContent).toBe("由组织安装");
  expect(card(one, "amazon-ads")?.querySelector(".pl-by-org")).toBeNull();
});

it("draws a member's Yours with no switch, no ⋮, no update and no new mark: an installed plugin that is off says 未开启", async () => {
  vi.useFakeTimers();
  const one = page("member");
  await open(one, "yours");
  expect(row(one, "keepa")).toBeDefined();
  expect(one.element.querySelector(".pl-shelf [role=switch]")).toBeNull();
  expect(one.element.querySelector(".pl-shelf .f-icon[aria-haspopup], .pl-shelf .f-menu")).toBeNull();
  expect(row(one, "amazon-sp-api")?.querySelector(".pl-row-end")?.textContent).toBe("未开启");
  expect(row(one, "keepa")?.querySelector(".pl-row-end")?.textContent).toBe("");
  expect(one.newDot()).toEqual([]);
});

it("draws no new mark for a member from the glance taken before the page is opened, as it does for an admin", async () => {
  vi.useFakeTimers();
  const [member, admin] = [page("member"), page("admin")];
  await Promise.all([member.glance(), admin.glance()]);
  expect(member.newDot()).toEqual([]);
  expect(admin.newDot()).not.toEqual([]);
});

it("keeps every control on an admin's page, as main draws it", async () => {
  vi.useFakeTimers();
  const one = page("admin");
  await open(one, "discover");
  expect(one.element.querySelector(".pl-create")).not.toBeNull();
  expect(card(one, "amazon-ads")?.querySelector(".pl-act")).not.toBeNull();
  expect(one.element.querySelector(".pl-by-org")).toBeNull();
  await open(one, "yours");
  expect(row(one, "amazon-sp-api")?.querySelector("[role=switch]")?.getAttribute("aria-checked")).toBe("false");
  expect(row(one, "keepa")?.querySelector(".f-menu")).not.toBeNull();
});

it("opens Yours for a member at the models page's address, and the models page for an admin", async () => {
  vi.useFakeTimers();
  for (const [role, landed] of [["member", "#/plugins/yours/all"], ["admin", "#/plugins/models"]] as const) {
    const one = page(role);
    await one.load();
    location.hash = "#/plugins/models";
    one.show({ kind: "chat" });
    await settle();
    expect(location.hash).toBe(landed);
  }
});

it("takes 重试 off a member's failed row and × off a waiting one; the admin's keep both", () => {
  const plugin = catalogue.plugins.find((one) => one.id === "lw")!;
  const head = () => ({ tile: document.createElement("span"), name: document.createElement("span"), line: "" });
  const base = { say: (key: string, values?: Record<string, string | number>) => say(key as StringKey, values), language: "zh" as const, head, cancel: () => undefined, retry: () => undefined };
  const failed = { act: "install", source: "npm:lw", plugin, stands: "failed" } as unknown as QueueRow;
  const waiting = { ...failed, stands: "waiting" } as unknown as QueueRow;
  const labels = (member: boolean, of: QueueRow): readonly (string | null)[] => [...queueRow({ ...base, member }, of).querySelectorAll(".pl-row-end button")].map((one) => one.getAttribute("aria-label"));
  expect(labels(true, failed)).toEqual([say("pl.q.cancelInstall", { name: plugin.name })]);
  expect(labels(false, failed)).toHaveLength(2);
  expect(labels(true, waiting)).toEqual([]);
  expect(labels(false, waiting)).toHaveLength(1);
  expect(failureUnder(base.say, "zh", failed, undefined).querySelector("button")).toBeNull();
  expect(failureUnder(base.say, "zh", failed, () => undefined).querySelector("button")).not.toBeNull();
});

// An admin's turn-off cx's computer failed: the organization's list keeps its end for everyone, the admin's to try again.
const offFailed = (): readonly ClickEnd[] => [{ op: "off", source: source("keepa"), ok: false, reason: "pi_failed", at: 1 }];
// The failure's line names its record; 重试 is the line's own press.
const failure = (one: PluginsPage): readonly [boolean, boolean] => {
  const line = one.element.querySelector('.pl-failed[data-for="#/plugins/p/keepa"]');
  return [line !== null, line?.querySelector(".pl-again") != null];
};

it("draws a member no sentence and no 重试 for an admin's failed change that is not an install or an update; the admin's page draws both", async () => {
  vi.useFakeTimers();
  for (const [role, drawn] of [["member", [false, false]], ["admin", [true, true]]] as const) {
    const one = page(role, offFailed());
    await open(one, "discover");
    expect(failure(one)).toEqual(drawn);
    location.hash = "#/plugins/p/keepa";
    one.show({ kind: "plugin", id: "keepa" });
    await settle();
    expect(failure(one)).toEqual(drawn);
    // Yours says such a failure on no row, for either: its rows say the queue's failures, an install's or an update's.
    await open(one, "yours");
    expect([row(one, "keepa") !== undefined, failure(one)]).toEqual([true, [false, false]]);
  }
});

it("draws a member's failed install on its page as sheet 2 does: the failure and ×, no 重试, no 试一试", async () => {
  vi.useFakeTimers();
  const one = page("member", [{ op: "install", source: "npm:lw", ok: false, reason: "pi_failed", at: 1 }]);
  await one.load();
  location.hash = "#/plugins/p/lw";
  one.show({ kind: "plugin", id: "lw" });
  await settle();
  const tools = one.element.querySelector(".pl-head .pl-head-tools")!;
  expect(tools.querySelector(".pl-q-state-word")?.textContent).toBe(say("pl.fail.installHere"));
  expect([...tools.querySelectorAll("button")].map((one) => one.getAttribute("aria-label"))).toEqual([say("pl.q.cancelInstall", { name: "Listing writer" })]);
  expect(one.element.querySelector(".pl-tries, .pl-try")).toBeNull();
});
