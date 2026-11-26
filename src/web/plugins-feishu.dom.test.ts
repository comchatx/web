// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { FEISHU_HOOK_PREFIX } from "../shared/feishu.js";
import { FIRST_RELEASE, type Backend, type Me, type Package } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { PluginsPage } from "./plugins-page.js";
import { clickStub } from "./plugins-test-kit.js";
import { text, type StringKey } from "./strings.js";

const signedIn = { kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } } as unknown as Extract<Me, { kind: "signed_in" }>;
const pack = (id: string): Package => { const name = CATALOGUE.plugins.find((one) => one.id === id)!.box!.package; return { name, version: "0.1.0", source: `npm:${name}` } as Package; };
const HOOK = `${FEISHU_HOOK_PREFIX}a1b2-c3`;

/** A platform at the first release that keeps the Feishu bot's address as the account's row does; a read or a write can be made to fail. */
function world(over: { hook?: string; installed?: boolean; language?: "en" | "zh"; gate?: Promise<void>; packages?: () => Promise<unknown> } = {}) {
  const calls: string[] = [];
  const fails = new Set<string>();
  let hook = over.hook ?? "";
  const record = <A extends unknown[], R>(name: string, then: (...args: A) => R) => vi.fn(async (...args: A): Promise<Awaited<R>> => {
    calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(",")})`);
    if (fails.has(name)) throw new Error("refused");
    return await then(...args);
  });
  const box = clickStub([pack("cx-sources"), ...(over.installed === false ? [] : [pack("cx-feishu")])]);
  const backend = {
    features: FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" }, readme: async () => undefined,
    series: async () => ({}), catalogue: async () => CATALOGUE, npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-10-17T00:00:00.000Z" }), npmPackage: async () => { throw new Error("unknown_package"); }, packages: over.packages ?? box.packages, sources: async () => [],
    modelPlugins: async () => [], models: async () => ({ current: undefined, available: [] }), providers: async () => [], accounts: async () => [],
    now: () => Date.parse("2026-10-02"),
    feishu: record("feishu", () => hook),
    saveFeishu: record("saveFeishu", async (next: string) => { await over.gate; if (fails.has("saveFeishu")) throw new Error("refused"); hook = next; }),
    removeFeishu: record("removeFeishu", () => { hook = ""; }),
    installPackage: box.installPackage, setPackage: box.setPackage,
  } as unknown as Backend;
  const view = new PluginsPage({ say: (key, values) => text(over.language ?? "en", key as StringKey, values), language: () => over.language ?? "en", backend, me: () => signedIn, ask: vi.fn(), announce: vi.fn(), changed: async () => {} });
  document.body.append(view.element);
  return { view, calls, fails, hook: () => hook };
}
const settle = async (): Promise<void> => { for (let n = 0; n < 6; n += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };
async function opened(view: PluginsPage, tab?: string): Promise<void> {
  await view.load();
  view.show({ kind: "plugin", id: "cx-feishu", ...(tab === undefined ? {} : { tab }) } as never);
  await settle();
}
const words = (root: ParentNode, selector: string): readonly string[] => [...root.querySelectorAll(selector)].map((one) => one.textContent ?? "");
const body = (view: PluginsPage): Element => view.element.querySelector(".pl-tabbody")!;
const at = (view: PluginsPage, place: string): HTMLElement | undefined => [...view.element.querySelectorAll<HTMLElement>("[data-focus]")].find((one) => one.getAttribute("data-focus") === place);
const focused = (): string | null | undefined => document.activeElement?.getAttribute("data-focus");
const press = async (control: Element | null | undefined): Promise<void> => { (control as HTMLElement).focus(); (control as HTMLElement).click(); await settle(); };
const type = (view: PluginsPage, value: string): void => { const input = at(view, "feishu") as HTMLInputElement; input.value = value; input.dispatchEvent(new Event("input")); };
const toast = (view: PluginsPage): string => view.element.querySelector(".pl-toast")?.textContent ?? "";
const note = (view: PluginsPage): string => view.element.querySelector("#feishu-note")?.textContent ?? "";

afterEach(() => { document.body.replaceChildren(); location.hash = ""; });

it("gives cx-feishu a Settings tab before install as after: before, its field and Save disabled under the line; a saved address keeps its Remove live", async () => {
  const bare = world({ installed: false });
  await opened(bare.view);
  expect(words(bare.view.element, ".pl-tab")).toContain("Settings");
  await opened(bare.view, "settings");
  const first = body(bare.view).firstElementChild!;
  expect([first.id, first.textContent]).toEqual(["pl-after-install", "Install to set these up."]);
  expect([...body(bare.view).querySelectorAll("input, button")].map((one) => [one.getAttribute("data-focus"), (one as HTMLInputElement).disabled, one.getAttribute("aria-describedby")]))
    .toEqual([["feishu", true, "pl-after-install feishu-note feishu-help"], ["feishu-save", true, "pl-after-install"]]);
  document.body.replaceChildren();
  const saved = world({ installed: false, hook: HOOK });
  await opened(saved.view, "settings");
  expect([...body(saved.view).querySelectorAll("button")].map((one) => [one.getAttribute("data-focus"), (one as HTMLButtonElement).disabled])).toEqual([["feishu-remove", false]]);
  await press(at(saved.view, "feishu-remove"));
  expect([saved.calls, saved.hook()]).toEqual([["feishu()", "removeFeishu()"], ""]);
  document.body.replaceChildren();
  const held = world();
  await opened(held.view);
  expect(words(held.view.element, ".pl-tab")).toContain("Settings");
  expect(held.calls).toEqual([]);
});

it("asks for the bot's address where none is saved, says what is wrong with one that is no bot's, and saves one that is", async () => {
  const w = world();
  await opened(w.view, "settings");
  expect(w.calls).toEqual(["feishu()"]);
  expect([words(body(w.view), "h2"), body(w.view).querySelector("label")?.textContent, (at(w.view, "feishu") as HTMLInputElement).placeholder]).toEqual([["Feishu"], "Your Feishu bot's webhook address", `${FEISHU_HOOK_PREFIX}…`]);
  expect(body(w.view).textContent).toContain("Until you add a bot, cx tells you in the chat.");
  expect(body(w.view).textContent).toContain("set its custom keyword to cx in Security settings");
  await press(at(w.view, "feishu-save"));
  expect([note(w.view), focused(), w.calls]).toEqual(["Paste the address first.", "feishu", ["feishu()"]]);
  for (const wrong of ["https://example.com/hook", FEISHU_HOOK_PREFIX, `${FEISHU_HOOK_PREFIX}a b`]) {
    type(w.view, wrong);
    await press(at(w.view, "feishu-save"));
    expect([note(w.view), focused(), (at(w.view, "feishu") as HTMLInputElement).value]).toEqual(["That is not a Feishu bot's webhook address.", "feishu", wrong]);
  }
  type(w.view, `  ${HOOK} `);
  (at(w.view, "feishu") as HTMLInputElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  await settle();
  expect([w.hook(), toast(w.view), focused()]).toEqual([HOOK, "Saved.", "feishu-saved"]);
  expect(at(w.view, "feishu-saved")?.textContent).toBe(HOOK);
  expect(body(w.view).textContent).toContain("Takes effect the next time cx's computer switches on.");
  expect(note(w.view)).toBe("");
});

it("draws a saved address with Remove, which empties it and gives the field back", async () => {
  const w = world({ hook: HOOK });
  await opened(w.view, "settings");
  expect([at(w.view, "feishu-saved")?.textContent, at(w.view, "feishu-saved")?.getAttribute("lang"), at(w.view, "feishu")]).toEqual([HOOK, "en", undefined]);
  await press(at(w.view, "feishu-remove"));
  expect([w.hook(), toast(w.view), focused(), (at(w.view, "feishu") as HTMLInputElement).value]).toEqual(["", "Removed. It takes effect the next time cx's computer switches on.", "feishu", ""]);
});

it("keeps what was typed and says so where a save fails, keeps the address where a removal fails, and says a read that failed", async () => {
  const w = world();
  await opened(w.view, "settings");
  w.fails.add("saveFeishu");
  type(w.view, HOOK);
  await press(at(w.view, "feishu-save"));
  expect([w.hook(), focused(), (at(w.view, "feishu") as HTMLInputElement).value, w.view.element.textContent?.includes("Not saved. Try again.")]).toEqual(["", "feishu", HOOK, true]);
  document.body.replaceChildren();
  const saved = world({ hook: HOOK });
  await opened(saved.view, "settings");
  saved.fails.add("removeFeishu");
  await press(at(saved.view, "feishu-remove"));
  expect([saved.hook(), focused(), at(saved.view, "feishu-saved")?.textContent]).toEqual([HOOK, "feishu-remove", HOOK]);
  document.body.replaceChildren();
  const unread = world();
  unread.fails.add("feishu");
  await opened(unread.view, "settings");
  expect([body(unread.view).textContent, at(unread.view, "feishu")]).toEqual(["FeishuThis could not be read just now.", undefined]);
});

it("says it all in Chinese", async () => {
  const w = world({ language: "zh" });
  await opened(w.view, "settings");
  expect([words(body(w.view), "h2"), body(w.view).querySelector("label")?.textContent]).toEqual([["飞书"], "飞书机器人的 Webhook 地址"]);
  type(w.view, "x");
  await press(at(w.view, "feishu-save"));
  expect(note(w.view)).toBe("这不是飞书机器人的 Webhook 地址。");
});

it("turns Save while the address is being saved, taking no second press, and the answer draws the row anew", async () => {
  for (const refused of [false, true]) {
    let open!: () => void;
    const w = world({ gate: new Promise<void>((resolve) => { open = resolve; }) });
    await opened(w.view, "settings");
    type(w.view, HOOK);
    const save = at(w.view, "feishu-save")!;
    save.focus();
    save.click();
    save.click();
    await settle();
    expect([save.getAttribute("aria-busy"), save.getAttribute("aria-label"), save.querySelector(".pl-spin") !== null, focused(), w.calls.filter((one) => one.startsWith("saveFeishu")).length])
      .toEqual(["true", "Save", true, "feishu-save", 1]);
    if (refused) w.fails.add("saveFeishu");
    open();
    await settle();
    // Saved, the address stands where the field was; refused, Save is drawn back as it was, with the word that it was not saved.
    const after = at(w.view, "feishu-save");
    expect(refused ? [after?.getAttribute("aria-busy"), after?.querySelector(".pl-spin") ?? null, after?.textContent] : [at(w.view, "feishu-saved")?.textContent, after]).toEqual(refused ? [null, null, "Save"] : [HOOK, undefined]);
    document.body.replaceChildren();
  }
});

it("keeps Save turning through the page's read of a new world, and takes a press of the Save drawn anew as none", async () => {
  let open!: () => void;
  const w = world({ gate: new Promise<void>((resolve) => { open = resolve; }) });
  await opened(w.view, "settings");
  type(w.view, HOOK);
  const first = at(w.view, "feishu-save");
  await press(first);
  // The page reads what is held again while the address is being saved, and draws the tab anew from the new world.
  await w.view.load();
  await settle();
  const redrawn = at(w.view, "feishu-save")!;
  expect([redrawn !== first, redrawn.isConnected]).toEqual([true, true]);
  await press(redrawn);
  expect([redrawn.getAttribute("aria-busy"), redrawn.getAttribute("aria-disabled"), redrawn.querySelector(".pl-spin") !== null, w.calls.filter((one) => one.startsWith("saveFeishu")).length])
    .toEqual(["true", "true", true, 1]);
  open();
  await settle();
  expect([at(w.view, "feishu-saved")?.textContent, w.calls.filter((one) => one.startsWith("saveFeishu")).length]).toEqual([HOOK, 1]);
});

it("turns a record's Try again while what is held is read again, taking no second read, and draws the record from the answer", async () => {
  let unread = true;
  let gate: PromiseWithResolvers<void> | undefined;
  const box = clickStub([pack("cx-sources"), pack("cx-feishu")]);
  let reads = 0;
  const w = world({ packages: async () => { reads += 1; if (gate !== undefined) await gate.promise; if (unread) throw new Error("no answer"); return box.packages(); } });
  await opened(w.view);
  const again = (): HTMLElement => [...w.view.element.querySelectorAll<HTMLElement>(".pl-needs button")].find((one) => one.textContent?.includes(text("en", "status.retry")) === true)!;
  const before = reads;
  unread = false;
  gate = Promise.withResolvers<void>();
  again().click();
  again().click();
  await settle();
  expect([reads - before, again().getAttribute("aria-busy"), again().querySelector(".pl-spin") !== null]).toEqual([1, "true", true]);
  gate.resolve();
  await settle();
  expect([reads - before, again()]).toEqual([1, undefined]);
});
