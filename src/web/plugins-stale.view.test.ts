// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { FIRST_RELEASE, type Backend, type Me, type Package, type Written } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { withRecords } from "./catalogue.js";
import { REREAD_MS } from "./plugins-clicks.js";
import { PluginsPage } from "./plugins-page.js";
import { clickStub } from "./plugins-test-kit.js";
import { text, type StringKey } from "./strings.js";

const plugin = { id: "rec-click", name: "Rec click", author: "ComChatX", section: "extensions" as const, about: { en: "x", zh: "x" }, builds: [], box: { package: "rec-click", source: "npm:rec-click", skills: [] } };
const catalogue = withRecords(CATALOGUE, { plugins: [plugin] });
const pack = { name: "rec-click", source: "npm:rec-click", version: "1.0.0", enabled: true } as Package;
const RECORD = "#/plugins/p/rec-click";
const settle = async (): Promise<void> => { for (let n = 0; n < 12; n++) await Promise.resolve(); await vi.advanceTimersByTimeAsync(0); };
const pages: PluginsPage[] = [];
afterEach(() => { for (const page of pages.splice(0)) page.leave(); vi.clearAllTimers(); vi.useRealTimers(); document.body.replaceChildren(); location.hash = ""; });

// A read of the page's world begun before a write (another click's reload, or any load) whose sibling read (sources) is slow: its
// list was served before the write and lands after the acknowledgement. Such a world is dropped, and the read the write starts draws.
function world(language: "en" | "zh", start: readonly Package[], over: { readonly answered?: "entry" } = {}) {
  const box = clickStub(start); box.world.hold = true;
  let holding = false; const gates: PromiseWithResolvers<void>[] = [];
  // A list held is answered when let go, as the platform answers it then: the row's waiting list as it stands at the answer.
  let listing: "now" | "then" | undefined; const lists: PromiseWithResolvers<void>[] = [];
  const bare = ({ waiting: _row, ...click }: Written): Written => click;
  const backend = {
    features: FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" },
    catalogue: async () => catalogue, packages: async () => {
      // `then`: answered with the row as it stands when let go; `now`: the row as it stood when asked, serialized before a later write.
      const asked = structuredClone(box.world.list);
      if (listing !== undefined) { const at = listing; const g = Promise.withResolvers<void>(); lists.push(g); await g.promise; if (at === "now") return asked; }
      return structuredClone(box.world.list);
    },
    sources: async () => { if (holding) { const g = Promise.withResolvers<void>(); gates.push(g); await g.promise; } return []; }, models: async () => undefined, accounts: async () => [], providers: async () => [], modelPlugins: async () => [], series: async () => ({}), chatOffer: async () => undefined,
    readme: async () => undefined, now: () => Date.UTC(2026, 9, 22), npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-10-22T00:00:00Z" }),
    installPackage: (source: string, on: boolean) => box.installPackage(source, on),
    setPackage: async (source: string, on: boolean) => { const click = await box.setPackage(source, on); return over.answered === "entry" ? bare(click) : click; },
  } as unknown as Backend;
  const say = (key: StringKey, values?: Record<string, string | number>): string => text(language, key, values);
  const page = new PluginsPage({ backend, language: () => language, say: (key, values) => say(key as StringKey, values), me: () => ({ kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } }) as Extract<Me, { kind: "signed_in" }>, ask: () => undefined, announce: () => undefined, changed: async () => undefined });
  pages.push(page); document.body.append(page.element);
  return {
    box, page, hold: () => { holding = true; }, release: () => { gates.shift()!.resolve(); }, all: () => { holding = false; for (const g of gates.splice(0)) g.resolve(); },
    holdList: (at: "now" | "then" = "then") => { listing = at; }, letList: () => { listing = undefined; for (const g of lists.splice(0)) g.resolve(); },
  };
}
const show = async (page: PluginsPage, hash: string, route: Parameters<PluginsPage["show"]>[0]): Promise<void> => { location.hash = hash; page.show(route); await settle(); };
const checked = (page: PluginsPage) => page.element.querySelector(".pl-head .f-switch")?.getAttribute("aria-checked");

for (const language of ["en", "zh"] as const) {
  it(`keeps an acknowledged off drawn Off when a load begun before the write lands after it (${language})`, async () => {
    vi.useFakeTimers();
    const { box, page, hold, release, all } = world(language, [pack]);
    location.hash = RECORD; await page.load();
    await show(page, RECORD, { kind: "plugin", id: "rec-click" });
    expect(checked(page)).toBe("true");
    hold(); const stale = page.load(); await settle();
    page.element.querySelector<HTMLButtonElement>(".pl-head .f-switch")!.click(); await settle();
    document.querySelector<HTMLDialogElement>("dialog.pl-card-dialog")?.querySelector<HTMLButtonElement>("button.primary")?.click(); await settle();
    expect(box.world.sent.map((c) => c.op)).toEqual(["off"]);
    const atWrite = checked(page);
    release(); await stale; await settle();
    const afterStale = checked(page);
    all(); await vi.advanceTimersByTimeAsync(REREAD_MS); await settle();
    expect(atWrite).toBe("false");
    expect(afterStale).toBe("false");
  });
}

for (const language of ["en", "zh"] as const) {
  it(`keeps a second press drawn as asked when the first press's own read lands after it (${language})`, async () => {
    vi.useFakeTimers();
    const { box, page, hold, release, all } = world(language, [pack]);
    location.hash = RECORD; await page.load();
    await show(page, RECORD, { kind: "plugin", id: "rec-click" });
    hold();
    const press = async () => { page.element.querySelector<HTMLButtonElement>(".pl-head .f-switch")!.click(); await settle(); document.querySelector<HTMLDialogElement>("dialog.pl-card-dialog")?.querySelector<HTMLButtonElement>("button.primary")?.click(); await settle(); };
    await press();
    const afterOff = checked(page);
    await press();
    const afterOn = checked(page);
    release(); await settle();
    const afterFirstRead = checked(page);
    all(); await vi.advanceTimersByTimeAsync(REREAD_MS); await settle();
    expect(box.world.sent.map((c) => c.op)).toEqual(["off", "on"]);
    expect([afterOff, afterOn, afterFirstRead]).toEqual(["false", "true", "true"]);
  });
}

for (const language of ["en", "zh"] as const) {
  it(`keeps a removal gone from Yours when the read after an earlier press lands after it (${language})`, async () => {
    vi.useFakeTimers();
    const { box, page, hold, release, all } = world(language, [pack]);
    location.hash = RECORD; await page.load();
    await show(page, "#/plugins/yours/all", { kind: "home", view: "yours", filter: "all" });
    await show(page, RECORD, { kind: "plugin", id: "rec-click" });
    hold();
    page.element.querySelector<HTMLButtonElement>(".pl-head .f-switch")!.click(); await settle();
    page.element.querySelector<HTMLButtonElement>(".pl-more")!.click(); page.element.querySelector<HTMLButtonElement>(".pl-head-tools .f-menu [role=menuitem]")!.click(); await settle();
    const dialog = document.querySelector<HTMLDialogElement>("dialog.pl-card-dialog");
    if (dialog !== null) history.replaceState({}, "", location.href);
    dialog?.querySelector<HTMLButtonElement>("button.primary")?.click(); await settle();
    const row = () => page.element.querySelector(`a.pl-row[href="${RECORD}"]`) !== null;
    await show(page, "#/plugins/yours/all", { kind: "home", view: "yours", filter: "all" });
    const atWrite = row();
    release(); await settle();
    const afterFirst = row();
    all(); await vi.advanceTimersByTimeAsync(REREAD_MS); await settle();
    expect([box.world.sent.map((c) => c.op), location.hash]).toEqual([["off", "remove"], "#/plugins/yours/all"]);
    expect([atWrite, afterFirst]).toEqual([false, false]);
  });
}

for (const language of ["en", "zh"] as const) {
  it(`draws an off as asked from its write's answer alone, the row's waiting list it carries, while no list is answered (${language})`, async () => {
    vi.useFakeTimers();
    const drawn = async (answered?: "entry"): Promise<readonly (string | null | undefined)[]> => {
      const { box, page, holdList, letList } = world(language, [pack], answered === undefined ? {} : { answered });
      location.hash = RECORD; await page.load();
      await show(page, RECORD, { kind: "plugin", id: "rec-click" });
      holdList();
      page.element.querySelector<HTMLButtonElement>(".pl-head .f-switch")!.click(); await settle();
      document.querySelector<HTMLDialogElement>("dialog.pl-card-dialog")?.querySelector<HTMLButtonElement>("button.primary")?.click(); await settle();
      const said = [box.world.sent.map((c) => c.op).join(), checked(page)];
      letList(); page.leave(); document.body.replaceChildren();
      return said;
    };
    // An answer that carried no row leaves the record as last read until a list says otherwise: the row is what draws it.
    expect([await drawn(), await drawn("entry")]).toEqual([["off", "false"], ["off", "true"]]);
  });

  it(`draws nothing stale from a list read begun before a write and answered after it, its waiting list carrying the click (${language})`, async () => {
    vi.useFakeTimers();
    const { box, page, holdList, letList } = world(language, [pack], { answered: "entry" });
    location.hash = RECORD; await page.load();
    await show(page, RECORD, { kind: "plugin", id: "rec-click" });
    holdList(); const early = page.load(); await settle();
    page.element.querySelector<HTMLButtonElement>(".pl-head .f-switch")!.click(); await settle();
    document.querySelector<HTMLDialogElement>("dialog.pl-card-dialog")?.querySelector<HTMLButtonElement>("button.primary")?.click(); await settle();
    // The answer carried no row, so what draws the off is the list answered after it, though its read began before.
    expect([box.world.sent.map((c) => c.op), checked(page), box.world.list.waiting?.map((c) => c.op)]).toEqual([["off"], "true", ["off"]]);
    letList(); await early; await settle();
    expect(checked(page)).toBe("false");
  });
}

for (const language of ["en", "zh"] as const) {
  it(`draws an off as asked throughout when a list read before its write lands after the write's answer (${language})`, async () => {
    vi.useFakeTimers();
    const { page, holdList, letList } = world(language, [pack]);
    location.hash = RECORD; await page.load();
    await show(page, RECORD, { kind: "plugin", id: "rec-click" });
    // The list is read, and its row with it, before the click is written; it reaches the page after the click's answer.
    holdList("now"); const early = page.load(); await settle();
    page.element.querySelector<HTMLButtonElement>(".pl-head .f-switch")!.click(); await settle();
    document.querySelector<HTMLDialogElement>("dialog.pl-card-dialog")?.querySelector<HTMLButtonElement>("button.primary")?.click(); await settle();
    const drawn = [checked(page)];
    letList(); await early;
    drawn.push(checked(page));
    await settle();
    drawn.push(checked(page));
    expect([...new Set(drawn)]).toEqual(["false"]);
  });
}
