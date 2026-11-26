// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { FIRST_RELEASE, type Backend, type Me, type NpmPackage, type Package } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { catalogueWith, type Catalogue } from "./catalogue.js";
import { LINES } from "./plugin-marks.js";
import { REREAD_MS } from "./plugins-clicks.js";
import { PluginsPage, tile } from "./plugins-page.js";
import { clickStub } from "./plugins-test-kit.js";
import { text, type StringKey } from "./strings.js";

/** The one plugin under a remove card's Affected plugins, and what its switch says when pressed: it holds off. */
const affected = (dialog: HTMLElement): readonly (string | null | undefined)[] => {
  const row = dialog.querySelector<HTMLElement>(".pl-card-part:last-of-type li")!;
  row.querySelector<HTMLButtonElement>("[role=switch]")!.click();
  return [row.querySelector(".pl-row-name strong")?.textContent, row.querySelector(".pl-row-line")?.textContent];
};
const settle = async (): Promise<void> => { for (let n = 0; n < 12; n++) await Promise.resolve(); await vi.advanceTimersByTimeAsync(0); };
const pages: PluginsPage[] = [];
afterEach(() => { for (const page of pages.splice(0)) page.leave(); vi.clearAllTimers(); vi.useRealTimers(); document.body.replaceChildren(); location.hash = ""; });

/** A page over a box that ends each click at once, drawing `catalogue`. */
function world(language: "en" | "zh", catalogue: Catalogue, start: readonly Package[] = [], available?: number) {
  const box = clickStub(start);
  const backend = {
    features: FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" },
    catalogue: async () => catalogue, packages: async () => box.packages(),
    sources: async () => [], models: async () => undefined, accounts: async () => [], providers: async () => [], modelPlugins: async () => [], series: async () => ({}), chatOffer: async () => undefined,
    readme: async () => undefined, now: () => Date.UTC(2026, 9, 22), npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-10-22T00:00:00Z" }), npmPackage: async (name: string) => npm(name, { ours: false, author: "2betop", description: LINE }),
    installPackage: (source: string, on: boolean) => box.installPackage(source, on), setPackage: (source: string, on: boolean) => box.setPackage(source, on),
  } as unknown as Backend;
  const say = (key: StringKey, values?: Record<string, string | number>): string => text(language, key, values);
  const page = new PluginsPage({ backend, language: () => language, say: (key, values) => say(key as StringKey, values), me: () => ({ kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 }, ...(available === undefined ? {} : { balance: { available } }) }) as Extract<Me, { kind: "signed_in" }>, ask: () => undefined, announce: () => undefined, changed: async () => undefined });
  pages.push(page); document.body.append(page.element);
  return { box, page, say };
}

const show = async (page: PluginsPage, id: string, tab?: string): Promise<void> => {
  location.hash = `#/plugins/p/${id}${tab === undefined ? "" : `/${tab}`}`;
  page.show({ kind: "plugin", id, ...(tab === undefined ? {} : { tab }) });
  await settle();
};
/** Presses the record's + Install and the install card's Install, where a card opens. */
const install = async (page: PluginsPage): Promise<HTMLDialogElement | null> => {
  page.element.querySelector<HTMLButtonElement>(".pl-head-tools button.primary")!.click();
  await settle();
  const dialog = document.querySelector<HTMLDialogElement>("dialog.pl-card-dialog");
  const said = dialog?.cloneNode(true) as HTMLDialogElement | null;
  if (dialog !== null) history.replaceState({}, "", location.href);
  dialog?.querySelector<HTMLButtonElement>("button.primary")?.click();
  await settle(); await vi.advanceTimersByTimeAsync(REREAD_MS); await settle();
  return said;
};

const SCHEDULER = "~@amaster.ai/pi-task-scheduler";
const SCHEDULER_NAME = "@amaster.ai/pi-task-scheduler";
/** How often npm was asked for the scheduler's words. */
const of = (asked: { readonly mock: { readonly calls: readonly (readonly unknown[])[] } }): number => asked.mock.calls.filter(([name]) => name === SCHEDULER_NAME).length;
/** What a package says of itself where it says nothing: npm's own packages carry no words of ours. */
const NONE = { en: "", zh: "" } as const;
const LINE = "Pi extension for cron-based scheduled task management with LLM-callable tools";
const npm = (name: string, more: Partial<NpmPackage> = {}): NpmPackage => ({ name, description: "", kinds: [], author: "ComChatX", updated: "2026-10-01T00:00:00.000Z", version: "1.0.0", repository: "", readme: "", readme_cut: false, ours: true, shipped: { skills: [], prompts: [], unread: [] }, uses: [], ...more });

/** `@comchatx/cx-schedule@0.3.0` as npm holds it: the scheduler named in its field, and no dependency. */
const PUBLISHED = catalogueWith([npm("@comchatx/cx-schedule", { version: "0.3.0", uses: [], comchatx: { name: "cx-schedule", section: "extensions", builds: [SCHEDULER_NAME] } })]);

it("draws cx-schedule's signed clock through the page's own tile", () => {
  const schedule = CATALOGUE.plugins.find((one) => one.id === "cx-schedule")!;
  expect(schedule.mark).toEqual({ line: "clock" });
  const drawn = tile(schedule);
  expect([drawn.textContent, drawn.querySelector("path")?.getAttribute("d")]).toEqual(["", LINES["clock"]]);
});

for (const language of ["en", "zh"] as const) {
  it(`reads the scheduler from cx-schedule's published field: listed, installed with it, not twice, and warned of at its removal: ${language}`, async () => {
    vi.useFakeTimers();
    const fresh = world(language, PUBLISHED);
    await fresh.page.load();
    await show(fresh.page, "cx-schedule", "deps");
    expect([...fresh.page.element.querySelectorAll<HTMLElement>(".pl-need li strong")].map((one) => one.textContent)).toEqual([SCHEDULER_NAME]);
    await install(fresh.page);
    expect(fresh.box.world.sent.map((click) => click.source)).toEqual([`npm:${SCHEDULER_NAME}`, "npm:@comchatx/cx-schedule"]);

    const scheduler: Package = { name: SCHEDULER_NAME, version: "0.1.30", source: `npm:${SCHEDULER_NAME}`, about: NONE, description: NONE };
    const holding = world(language, PUBLISHED, [scheduler]);
    await holding.page.load();
    await show(holding.page, "cx-schedule");
    await install(holding.page);
    expect(holding.box.world.sent.map((click) => click.source)).toEqual(["npm:@comchatx/cx-schedule"]);

    const schedule: Package = { name: "@comchatx/cx-schedule", version: "0.3.0", source: "npm:@comchatx/cx-schedule", about: NONE, description: NONE };
    const both = world(language, PUBLISHED, [scheduler, schedule]);
    await both.page.load();
    location.hash = `#/plugins/n/${encodeURIComponent(SCHEDULER_NAME)}`;
    both.page.show({ kind: "plugin", id: SCHEDULER, npm: SCHEDULER_NAME });
    await settle();
    both.page.element.querySelector<HTMLButtonElement>(".pl-more")!.click();
    both.page.element.querySelector<HTMLButtonElement>(".pl-head-tools .f-menu [role=menuitem]")!.click();
    expect(affected(document.querySelector<HTMLDialogElement>("dialog.pl-card-dialog")!)).toEqual(["cx-schedule", both.say("pl.c.needsOne", { names: "cx-schedule", name: SCHEDULER_NAME })]);
    history.replaceState({}, "", location.href);
  });

  it(`installs a package with what it requires beside a ring of ours, the ring refused and the package's links kept: ${language}`, async () => {
    vi.useFakeTimers();
    const catalogue = catalogueWith([
      npm("cx-ring-a", { uses: ["cx-ring-b"] }), npm("cx-ring-b", { uses: ["cx-ring-a"] }),
      npm("cx-good", { uses: ["cx-needed"] }), npm("cx-needed"),
    ]);
    const { box, page } = world(language, catalogue);
    await page.load();
    await show(page, "cx-good");
    await install(page);
    expect(box.world.sent.map((click) => [click.op, click.source])).toEqual([["install", "npm:cx-needed"], ["install", "npm:cx-good"]]);
    expect(catalogue.plugins.some((one) => one.id.startsWith("cx-ring"))).toBe(false);
  });

  it(`draws the scheduler cx-schedule needs under Plugins it uses with npm's line and its +, and installs it with cx-schedule: ${language}`, async () => {
    vi.useFakeTimers();
    const { box, page, say } = world(language, CATALOGUE);
    await page.load();
    await show(page, "cx-schedule", "deps");
    const tab = page.element.querySelector<HTMLElement>(`[role="tab"][aria-selected="true"]`)?.textContent ?? "";
    expect(tab).toBe(`${say("pl.tab.deps")} · 1`);
    const rows = [...page.element.querySelectorAll<HTMLElement>(".pl-need li")];
    expect(rows.map((row) => row.querySelector("strong")?.textContent)).toEqual(["@amaster.ai/pi-task-scheduler"]);
    expect(rows[0]!.textContent).toContain(say("pl.third.mark"));
    expect(rows[0]!.textContent).toContain(LINE);
    expect(rows[0]!.textContent).toContain("2betop");
    expect(rows[0]!.querySelector(".pl-row-end button.f-icon")?.getAttribute("aria-label")).toBe(say("pl.installName", { name: "@amaster.ai/pi-task-scheduler" }));
    const card = await install(page);
    expect([...(card?.querySelectorAll(".pl-card-rows .pl-row-name strong") ?? [])].map((one) => one.textContent)).toEqual(["cx-schedule", "@amaster.ai/pi-task-scheduler"]);
    expect(card?.textContent).toContain(say("pl.c.thirdIn1"));
    expect(box.world.sent.map((click) => [click.op, click.source])).toEqual([["install", "npm:@amaster.ai/pi-task-scheduler"], ["install", "npm:@comchatx/cx-schedule"]]);
    await show(page, "cx-schedule", "deps");
    const row = page.element.querySelector<HTMLElement>(".pl-need li")!;
    expect(row.querySelector(".pl-row-end [role=switch]")?.getAttribute("aria-label")).toBe("@amaster.ai/pi-task-scheduler");
    await show(page, "cx-schedule");
    expect(page.element.querySelector(".pl-needs")).toBeNull();
  });

  it(`says npm's line beside "Author not stated" where npm names no author, and neither where npm cannot be read: ${language}`, async () => {
    vi.useFakeTimers();
    const rows = async (npmPackage: () => Promise<NpmPackage>): Promise<string> => {
      const { page } = world(language, CATALOGUE);
      (page.ports.backend as { npmPackage: unknown }).npmPackage = npmPackage;
      await page.load();
      await show(page, "cx-schedule", "deps");
      const text = page.element.querySelector<HTMLElement>(".pl-need li")!.textContent!;
      page.leave(); page.element.remove();
      return text;
    };
    const { say } = world(language, CATALOGUE);
    const bare = await rows(async () => { const { author: _none, ...named } = npm("@amaster.ai/pi-task-scheduler", { ours: false, description: LINE }); return named; });
    expect([bare.includes(LINE), bare.includes(say("pl.own.by"))]).toEqual([true, true]);
    const unread = await rows(async () => { throw new Error("unreachable"); });
    // Where npm could not be read, the row claims no author it did not read.
    expect([unread.includes(LINE), unread.includes(say("pl.own.by"))]).toEqual([false, false]);
  });

  it(`asks npm again at the next read where a read failed, and draws its line then: ${language}`, async () => {
    vi.useFakeTimers();
    const { page } = world(language, CATALOGUE);
    let tries = 0;
    const asked = vi.fn(async (name: string): Promise<NpmPackage> => { if (name === SCHEDULER_NAME && (tries += 1) === 1) throw new Error("unreachable"); return npm(name, { ours: false, description: LINE }); });
    (page.ports.backend as { npmPackage: unknown }).npmPackage = asked;
    await page.load();
    await show(page, "cx-schedule", "deps");
    expect(page.element.querySelector(".pl-need li")!.textContent).not.toContain(LINE);
    await page.load();
    await settle();
    expect([of(asked), page.element.querySelector(".pl-need li")!.textContent!.includes(LINE)]).toEqual([2, true]);
  });

  it(`asks npm once a page where its read answered, however often the page reads its world again: ${language}`, async () => {
    vi.useFakeTimers();
    const { page } = world(language, CATALOGUE);
    const asked = vi.fn(async (name: string): Promise<NpmPackage> => npm(name, { ours: false, description: LINE }));
    (page.ports.backend as { npmPackage: unknown }).npmPackage = asked;
    await page.load();
    await show(page, "cx-schedule", "deps");
    await page.load();
    await page.load();
    await settle();
    expect([of(asked), page.element.querySelector(".pl-need li")!.textContent!.includes(LINE)]).toEqual([1, true]);
  });

  // The seller's own copy is the one cx-schedule uses, whatever version it was pinned at: installing cx-schedule adds no second one.
  for (const source of ["npm:@amaster.ai/pi-task-scheduler", "npm:@amaster.ai/pi-task-scheduler@0.1.30"]) {
    it(`installs cx-schedule alone beside the scheduler the seller installed from ${source}, and uses that copy: ${language}`, async () => {
      vi.useFakeTimers();
      const own: Package = { name: "@amaster.ai/pi-task-scheduler", version: "0.1.30", source, about: NONE, description: NONE };
      const { box, page, say } = world(language, CATALOGUE, [own]);
      await page.load();
      await show(page, "cx-schedule");
      const card = await install(page);
      expect(card?.textContent ?? "").not.toContain(say("pl.c.thirdIn1"));
      expect(box.world.sent.map((click) => [click.op, click.source])).toEqual([["install", "npm:@comchatx/cx-schedule"]]);
      expect((await box.packages()).packages.map((one) => one.source)).toEqual([source, "npm:@comchatx/cx-schedule"]);
      await show(page, "cx-schedule", "deps");
      expect(page.element.querySelector(".pl-need li .pl-row-end [role=switch]")?.getAttribute("aria-label")).toBe(own.name);
      await show(page, "cx-schedule");
      expect(page.element.querySelector(".pl-needs")).toBeNull();
    });
  }

  it(`installs the scheduler from its own page where cx-schedule is there without it, which ends cx-schedule's reminder: ${language}`, async () => {
    vi.useFakeTimers();
    const schedule: Package = { name: "@comchatx/cx-schedule", version: "0.3.0", source: "npm:@comchatx/cx-schedule", about: NONE, description: NONE };
    const { box, page, say } = world(language, CATALOGUE, [schedule]);
    await page.load();
    await show(page, "cx-schedule");
    expect(page.element.querySelector(".pl-needs")?.textContent).toContain(say("pl.need.gone", { plugin: "cx-schedule", name: "@amaster.ai/pi-task-scheduler" }));
    location.hash = `#/plugins/n/${encodeURIComponent("@amaster.ai/pi-task-scheduler")}`;
    page.show({ kind: "plugin", id: SCHEDULER, npm: "@amaster.ai/pi-task-scheduler" });
    await settle();
    await install(page);
    expect(box.world.sent.map((click) => [click.op, click.source])).toEqual([["install", "npm:@amaster.ai/pi-task-scheduler"]]);
    expect((await box.packages()).packages.map((one) => one.source)).toEqual([schedule.source, "npm:@amaster.ai/pi-task-scheduler"]);
    await show(page, "cx-schedule");
    expect(page.element.querySelector(".pl-needs")).toBeNull();
  });

  // Removing the scheduler leaves cx-schedule installed and unable to work: the remove card says so before, and cx-schedule's page and its
  // row in Yours say so after, each with the scheduler's Install.
  it(`warns before removing the scheduler that cx-schedule can't work without it, turns cx-schedule off with it, and draws nothing missing on its page or under its row: ${language}`, async () => {
    vi.useFakeTimers();
    const both: readonly Package[] = [{ name: "@amaster.ai/pi-task-scheduler", version: "0.1.30", source: "npm:@amaster.ai/pi-task-scheduler", about: NONE, description: NONE }, { name: "@comchatx/cx-schedule", version: "0.3.0", source: "npm:@comchatx/cx-schedule", about: NONE, description: NONE }];
    const { box, page, say } = world(language, CATALOGUE, both);
    await page.load();
    location.hash = `#/plugins/n/${encodeURIComponent("@amaster.ai/pi-task-scheduler")}`;
    page.show({ kind: "plugin", id: SCHEDULER, npm: "@amaster.ai/pi-task-scheduler" });
    await settle();
    page.element.querySelector<HTMLButtonElement>(".pl-more")!.click();
    page.element.querySelector<HTMLButtonElement>(".pl-head-tools .f-menu [role=menuitem]")!.click();
    const dialog = document.querySelector<HTMLDialogElement>("dialog.pl-card-dialog")!;
    expect(affected(dialog)).toEqual(["cx-schedule", say("pl.c.needsOne", { names: "cx-schedule", name: "@amaster.ai/pi-task-scheduler" })]);
    history.replaceState({}, "", location.href);
    dialog.querySelector<HTMLButtonElement>("button.primary")!.click();
    await settle(); await vi.advanceTimersByTimeAsync(REREAD_MS); await settle();
    // cx-schedule, which can't work without it, is turned off first, so it stands off rather than lacking; its page says nothing missing.
    expect(box.world.sent.map((click) => [click.op, click.source])).toEqual([["off", "npm:@comchatx/cx-schedule"], ["remove", "npm:@amaster.ai/pi-task-scheduler"]]);
    const gone = say("pl.need.gone", { plugin: "cx-schedule", name: "@amaster.ai/pi-task-scheduler" });
    await show(page, "cx-schedule");
    expect(page.element.querySelector(".pl-needs")).toBeNull();
    location.hash = "#/plugins/yours";
    page.show({ kind: "home", view: "yours", filter: "all" });
    await settle();
    const row = page.element.querySelector<HTMLElement>('.pl-shelf:not(.pl-queue) a.pl-row-link[href="#/plugins/p/cx-schedule"]')!.closest("li")!;
    expect([row.querySelector(".pl-needs-row"), row.textContent?.includes(gone)]).toEqual([null, false]);
  });

  // What scheduled jobs need is the package's README's to say: the card that brings them says nothing of it, and draws no balance where it buys nothing.
  it(`says nothing of cx's computer or the balance at Install where the install brings cx-schedule and buys nothing: ${language}`, async () => {
    vi.useFakeTimers();
    const { page } = world(language, CATALOGUE, [], 84_170_000);
    await page.load();
    await show(page, "cx-schedule");
    const card = await install(page);
    expect(card).not.toBeNull();
    expect(card!.textContent).not.toContain("84.17");
    expect(card!.textContent).not.toMatch(/Keep it on|保持开机/);
  });
}
