// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { FIRST_RELEASE, type Backend, type Me, type Package } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { withRecords } from "./catalogue.js";
import { REREAD_MS } from "./plugins-clicks.js";
import { PluginsPage } from "./plugins-page.js";
import { clickStub } from "./plugins-test-kit.js";
import { text, type StringKey } from "./strings.js";

const plugin = { id: "rec-click", name: "Rec click", author: "ComChatX", section: "extensions" as const, about: { en: "A click's fixture", zh: "A click's fixture" }, builds: [], box: { package: "rec-click", source: "npm:rec-click", skills: [] } };
const catalogue = withRecords(CATALOGUE, { plugins: [plugin] });
const pack = { name: "rec-click", source: "npm:rec-click", version: "1.0.0", enabled: true } as Package;
const RECORD = "#/plugins/p/rec-click";
const settle = async (): Promise<void> => { for (let n = 0; n < 12; n++) await Promise.resolve(); await vi.advanceTimersByTimeAsync(0); };
const pages: PluginsPage[] = [];
afterEach(() => { for (const page of pages.splice(0)) page.leave(); vi.clearAllTimers(); vi.useRealTimers(); document.body.replaceChildren(); location.hash = ""; });

/**
 * A page over a box that ends nothing until released, whose list read after a click is written down is held until `read` is resolved:
 * what the page draws in between is what the platform's record alone says.
 */
function world(language: "en" | "zh", start: readonly Package[], asleep: boolean) {
  const box = clickStub(start); box.world.hold = true;
  box.world.list = { ...box.world.list, asleep };
  const read = Promise.withResolvers<void>();
  let holding = false;
  const send = async (kind: "installPackage" | "setPackage", source: string, on: boolean) => { const click = await box[kind](source, on); holding = true; return click; };
  const backend = {
    features: FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" },
    catalogue: async () => catalogue, packages: async () => { if (holding) await read.promise; return box.packages(); },
    sources: async () => [], models: async () => undefined, accounts: async () => [], providers: async () => [], modelPlugins: async () => [], series: async () => ({}), chatOffer: async () => undefined,
    readme: async () => undefined, now: () => Date.UTC(2026, 9, 22), npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-10-22T00:00:00Z" }),
    installPackage: (source: string, on: boolean) => send("installPackage", source, on), setPackage: (source: string, on: boolean) => send("setPackage", source, on),
  } as unknown as Backend;
  const say = (key: StringKey, values?: Record<string, string | number>): string => text(language, key, values);
  const page = new PluginsPage({ power: () => (asleep ? "off" : "on"), backend, language: () => language, say: (key, values) => say(key as StringKey, values), me: () => ({ kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } }) as Extract<Me, { kind: "signed_in" }>, ask: () => undefined, announce: () => undefined, changed: async () => undefined });
  pages.push(page); document.body.append(page.element);
  return { box, page, say, release: (): void => { holding = false; read.resolve(); } };
}

/** What stands in ✓'s place for an install in the queue: the still ring while it waits for the computer, the turning ring once it runs. */
const mark = (asleep: boolean): string => (asleep ? "a.pl-queued" : "[aria-busy=true]");
const toast = (page: PluginsPage): string => page.element.querySelector(".pl-toast")?.textContent ?? "";
const row = (page: PluginsPage): HTMLElement | null => page.element.querySelector<HTMLElement>(`a.pl-row-link[href="${RECORD}"]`)?.closest("li") ?? null;
const show = async (page: PluginsPage, hash: string, route: Parameters<PluginsPage["show"]>[0]): Promise<void> => { location.hash = hash; page.show(route); await settle(); };

for (const language of ["en", "zh"] as const) for (const asleep of [true, false]) for (const act of ["install", "off", "on", "remove"] as const) {
  it(`draws ${act} as clicked on every surface the moment the platform writes it down, before the list read after it answers: ${language}, ${asleep ? "asleep" : "awake"}`, async () => {
    vi.useFakeTimers();
    const { box, page, say, release } = world(language, act === "install" ? [] : [{ ...pack, enabled: act !== "on" }], asleep);
    location.hash = RECORD; await page.load();
    if (act === "remove") await show(page, "#/plugins/yours/all", { kind: "home", view: "yours", filter: "all" });
    await show(page, RECORD, { kind: "plugin", id: "rec-click" });
    if (act === "install") page.element.querySelector<HTMLButtonElement>(".pl-head-tools button.primary")!.click();
    else if (act === "off" || act === "on") page.element.querySelector<HTMLButtonElement>(".pl-head .f-switch")!.click();
    else { page.element.querySelector<HTMLButtonElement>(".pl-more")!.click(); page.element.querySelector<HTMLButtonElement>(".pl-head-tools .f-menu [role=menuitem]")!.click(); }
    await settle();
    const dialog = document.querySelector<HTMLDialogElement>("dialog.pl-card-dialog");
    if (dialog !== null) history.replaceState({}, "", location.href);
    dialog?.querySelector<HTMLButtonElement>("button.primary")?.click();
    await settle();
    expect(box.world.sent.map((click) => click.op)).toEqual([act]);
    // Written down; the list read after it has not answered.
    if (act === "install") {
      // In the queue, not installed: asleep, the still ring in ✓'s place; awake, it runs at once, the turning ring there; and the one sentence every press says.
      expect([page.element.querySelector(`.pl-head-tools ${mark(asleep)}`) !== null, page.element.querySelector(".pl-done") === null]).toEqual([true, true]);
      expect(toast(page)).toBe(say("pl.q.added"));
    } else if (act === "remove") {
      expect(location.hash).toBe("#/plugins/yours/all");
      await show(page, "#/plugins/yours/all", { kind: "home", view: "yours", filter: "all" });
      expect(row(page)).toBeNull();
    } else {
      expect(page.element.querySelector(".pl-head .f-switch")?.getAttribute("aria-checked")).toBe(String(act === "on"));
      await show(page, "#/plugins/yours/all", { kind: "home", view: "yours", filter: "all" });
      // The row's switch says it, with no Off beside the name (sheet 1).
      expect([row(page)?.querySelector(".f-switch")?.getAttribute("aria-checked"), row(page)?.textContent?.includes(say("pl.off"))]).toEqual([String(act === "on"), false]);
      await show(page, RECORD, { kind: "plugin", id: "rec-click" });
      expect(page.element.querySelector(".pl-head .f-switch")?.getAttribute("aria-checked")).toBe(String(act === "on"));
    }
    // The list then answers: what the record drew stands, and the sentence is not said a second time.
    page.element.querySelector(".pl-toast")!.textContent = "";
    release(); await vi.advanceTimersByTimeAsync(REREAD_MS); await settle();
    if (act === "install") { expect(page.element.querySelector(`.pl-head-tools ${mark(asleep)}`)).not.toBeNull(); expect(toast(page)).toBe(""); }
    else if (act === "remove") expect(row(page)).toBeNull();
    else expect(page.element.querySelector(".pl-head .f-switch")?.getAttribute("aria-checked")).toBe(String(act === "on"));
  });
}

for (const language of ["en", "zh"] as const) for (const asleep of [true, false]) {
  it(`says an install from Discover's + went to the queue the moment it is written down, asleep or awake, and once, its card's corner the still ring: ${language}, ${asleep ? "asleep" : "awake"}`, async () => {
    vi.useFakeTimers();
    const { box, page, say, release } = world(language, [], asleep);
    location.hash = RECORD; await page.load();
    await show(page, "#/plugins/discover/plugins/extensions", { kind: "home", view: "discover", filter: "plugins", shelf: "extensions" });
    page.element.querySelector(`a.pl-card-name[href="${RECORD}"]`)?.closest(".pl-card")?.querySelector<HTMLButtonElement>("button.pl-act")!.click();
    await settle();
    expect(box.world.sent.map((click) => click.op)).toEqual(["install"]);
    expect(toast(page)).toBe(say("pl.q.added"));
    const corner = page.element.querySelector(`a.pl-card-name[href="${RECORD}"]`)?.closest(".pl-card")?.querySelector<HTMLElement>(mark(asleep));
    expect([corner?.getAttribute("aria-label"), corner?.getAttribute("href")]).toEqual(asleep ? [say("pl.q.inQueue", { name: plugin.name }), "#/plugins/yours/all"] : [say("pl.doing.installName", { name: plugin.name }), null]);
    page.element.querySelector(".pl-toast")!.textContent = "";
    release(); await vi.advanceTimersByTimeAsync(REREAD_MS); await settle();
    expect(toast(page)).toBe("");
  });
}

for (const language of ["en", "zh"] as const) for (const origin of ["record", "discover"] as const) {
  it(`says a failed install nowhere but the queue, which keeps it by its mark and words with no reason, the retry mark and ×, wherever the press began; the record offers Install again: ${language}, ${origin}`, async () => {
    vi.useFakeTimers();
    const { box, page, say, release } = world(language, [], false);
    location.hash = RECORD; await page.load();
    if (origin === "record") await show(page, RECORD, { kind: "plugin", id: "rec-click" });
    else await show(page, "#/plugins/discover/plugins/extensions", { kind: "home", view: "discover", filter: "plugins", shelf: "extensions" });
    const press = origin === "record" ? page.element.querySelector<HTMLButtonElement>(".pl-head-tools button.primary")
      : page.element.querySelector(`a.pl-card-name[href="${RECORD}"]`)?.closest(".pl-card")?.querySelector<HTMLButtonElement>("button.pl-act");
    press!.click(); await settle();
    expect(box.world.sent).toHaveLength(1);
    await show(page, "#/plugins/p/cx-sources", { kind: "plugin", id: "cx-sources" });
    box.world.fail = "pi_failed"; box.release(); release(); await vi.advanceTimersByTimeAsync(REREAD_MS); await settle();
    // No toast says it (as ruled): the queue does.
    expect(toast(page)).not.toContain(say("pl.fail.install", { name: plugin.name }));
    await show(page, RECORD, { kind: "plugin", id: "rec-click" });
    // Its head says it where + Install stood, with 重试 and ✕ (correction 2), and no line of its own.
    expect([page.element.querySelector(".pl-head-tools button.primary"), page.element.querySelector(".pl-head-tools .pl-q-state-bad")?.textContent, page.element.querySelectorAll(".pl-head-tools .f-marks .f-icon").length, page.element.querySelector(".pl-failed")])
      .toEqual([null, say("pl.fail.installHere"), 2, null]);
    await show(page, "#/plugins/yours/all", { kind: "home", view: "yours", filter: "all" });
    const failed = page.element.querySelector<HTMLElement>('.pl-queue li[data-source="npm:rec-click"]');
    expect([failed?.querySelector(".pl-q-state-bad")?.textContent, failed?.textContent?.includes("pi_failed")]).toEqual([say("pl.fail.installHere"), false]);
    expect([...failed!.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"))).toEqual([say("pl.q.retryInstall", { name: plugin.name }), say("pl.q.cancelInstall", { name: plugin.name })]);
  });
}
