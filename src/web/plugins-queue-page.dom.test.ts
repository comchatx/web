// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { FIRST_RELEASE, type Backend, type Me, type Package } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { withRecords } from "./catalogue.js";
import { REREAD_MS, WAIT_BOUND_MS } from "./plugins-clicks.js";
import { PluginsPage } from "./plugins-page.js";
import { clickStub } from "./plugins-test-kit.js";
import { text, type StringKey } from "./strings.js";

// The queue first in Yours, as the Plugins page draws and works it over the platform's list: 取消 and 重试 on its rows, the still ring that
// goes to it from a card, the answer that holds the installs back, and what it tells the line above the message box.
const made = (id: string, name: string) => ({ id, name, author: "ComChatX", section: "extensions" as const, about: { en: "A plugin.", zh: "一个插件。" }, builds: [], box: { package: id, source: `npm:${id}`, skills: [] } });
const RECORDS = [made("lw", "Listing writer"), made("kp", "Keyword planner"), made("pdf", "Product PDF")];
const catalogue = withRecords(CATALOGUE, { plugins: RECORDS });
const settle = async (): Promise<void> => { for (let n = 0; n < 12; n++) await Promise.resolve(); await vi.advanceTimersByTimeAsync(0); };
const pages: PluginsPage[] = [];
afterEach(() => { for (const page of pages.splice(0)) page.leave(); vi.clearAllTimers(); vi.useRealTimers(); document.body.replaceChildren(); location.hash = ""; });

function world(start: readonly Package[] = [], answering: () => boolean = () => false, starting?: () => boolean) {
  const box = clickStub(start);
  box.world.hold = true;
  const announced: string[] = [];
  const changed = vi.fn(async () => undefined);
  const listRead = vi.fn();
  const backend = {
    features: FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" },
    catalogue: async () => catalogue, packages: async () => box.packages(),
    sources: async () => [], models: async () => undefined, accounts: async () => [], providers: async () => [], modelPlugins: async () => [], series: async () => ({}), chatOffer: async () => undefined,
    readme: async () => undefined, now: () => Date.UTC(2026, 10, 10), npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-11-10T00:00:00Z" }),
    installPackage: (source: string, on: boolean) => box.installPackage(source, on), setPackage: (source: string, on: boolean) => box.setPackage(source, on), updatePackage: (source: string) => box.updatePackage(source),
    cancelClick: vi.fn((id: string) => box.cancelClick(id)), forgetFailure: vi.fn((source: string) => box.forgetFailure(source)),
  } as unknown as Backend & { cancelClick: ReturnType<typeof vi.fn>; forgetFailure: ReturnType<typeof vi.fn> };
  const say = (key: StringKey, values?: Record<string, string | number>): string => text("zh", key, values);
  // The computer as cx's card holds it: starting while the chat's line says so, and otherwise as the box's list last said.
  const power = (): "off" | "starting" | "on" => (starting?.() === true ? "starting" : box.power());
  const page = new PluginsPage({ power, backend, language: () => "zh", say: (key, values) => say(key as StringKey, values), me: () => ({ kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } }) as Extract<Me, { kind: "signed_in" }>,
    ask: () => undefined, announce: (words) => { announced.push(words); }, changed, answering, listRead, ...(starting === undefined ? {} : { starting }) });
  pages.push(page); document.body.append(page.element);
  return { box, page, say, backend, announced, changed, listRead };
}
const yours = async (page: PluginsPage): Promise<void> => { location.hash = "#/plugins/yours/all"; page.show({ kind: "home", view: "yours", filter: "all" }); await settle(); };
const rows = (page: PluginsPage): readonly string[] => [...page.element.querySelectorAll<HTMLElement>(".pl-queue li")].map((one) => `${one.querySelector("strong")?.textContent} ${one.querySelector(".pl-row-end .pl-q-state-word")?.textContent}`);
const focused = (): string | null => document.activeElement?.getAttribute("data-focus") ?? null;
const sleeping = async (box: ReturnType<typeof clickStub>, sources: readonly string[]): Promise<void> => { box.world.list = { ...box.world.list, asleep: true }; for (const one of sources) await box.installPackage(one, true); };

it("draws the queue first in Yours, before every shelf, its rows in the order the computer runs them and each where it stands", async () => {
  vi.useFakeTimers();
  const { box, page } = world([{ name: "pdf", version: "1.0.0", source: "npm:pdf", enabled: true } as Package]);
  await sleeping(box, ["npm:lw", "npm:kp"]);
  await page.load();
  await yours(page);
  expect(page.element.querySelector(".pl-body > *, .pl-page section")?.id).toBe("queue");
  expect(rows(page)).toEqual(["Listing writer cx 的电脑开启后安装。", "Keyword planner cx 的电脑开启后安装。"]);
  // What waits is in the queue, not on a shelf, until it lands.
  expect([...page.element.querySelectorAll(".pl-shelf:not(.pl-queue) a.pl-row-link")].map((one) => one.getAttribute("href"))).toEqual(["#/plugins/p/pdf"]);
  box.world.list = { ...box.world.list, asleep: false };
  await page.load();
  expect(rows(page)).toEqual(["Listing writer 正在安装", "Keyword planner 等待安装"]);
});

it("says every row waits for cx's answer to end while cx answers", async () => {
  vi.useFakeTimers();
  const { box, page } = world([], () => true);
  await box.installPackage("npm:kp", true);
  await page.load();
  await yours(page);
  expect(rows(page)).toEqual(["Keyword planner cx 回答结束后安装。"]);
});

it("reads the list again when cx's answer ends, however long past the bound it ran, so no row still says it waits for it", async () => {
  vi.useFakeTimers();
  let answering = true;
  const { box, page } = world([], () => answering);
  const reads = vi.spyOn(box, "packages");
  await box.installPackage("npm:kp", true);
  await page.load();
  await yours(page);
  expect(rows(page)).toEqual(["Keyword planner cx 回答结束后安装。"]);
  // The answer runs past the bound: the page stops reading the list.
  await vi.advanceTimersByTimeAsync(WAIT_BOUND_MS + 10 * REREAD_MS);
  const idle = reads.mock.calls.length;
  await vi.advanceTimersByTimeAsync(10 * REREAD_MS);
  expect(reads.mock.calls.length).toBe(idle);
  // Its end reads the list again, and the row stands where the computer has it.
  answering = false;
  page.settled();
  await settle();
  expect([reads.mock.calls.length > idle, rows(page)]).toEqual([true, ["Keyword planner 正在安装"]]);
  // A queue holding nothing reads nothing at an end.
  box.release();
  await vi.advanceTimersByTimeAsync(REREAD_MS); await settle();
  const after = reads.mock.calls.length;
  page.settled();
  await settle();
  expect([rows(page), reads.mock.calls.length]).toEqual([[], after]);
});

it("takes a waiting row back at 取消, says so to a screen reader alone, and gives the keyboard to the next row's 取消, else the one before, else the heading", async () => {
  vi.useFakeTimers();
  const { box, page, backend, announced, say } = world();
  await sleeping(box, ["npm:lw", "npm:kp"]);
  await page.load();
  await yours(page);
  const toast = page.element.querySelector(".pl-toast")?.textContent ?? "";
  page.element.querySelector<HTMLButtonElement>('[data-focus="cancel install npm:lw"]')!.click();
  await settle();
  expect([backend.cancelClick.mock.calls, rows(page), announced, focused(), page.element.querySelector(".pl-toast")?.textContent ?? ""])
    .toEqual([[[box.world.sent[0]!.id]], ["Keyword planner cx 的电脑开启后安装。"], [say("pl.q.cancelledInstall", { name: "Listing writer" })], "cancel install npm:kp", toast]);
  page.element.querySelector<HTMLButtonElement>('[data-focus="cancel install npm:kp"]')!.click();
  await settle();
  expect([page.element.querySelector(".pl-queue"), focused()]).toEqual([null, "heading"]);
});

it("keeps a row the computer began before 取消 reached it, drawn as it runs, and the keyboard on it", async () => {
  vi.useFakeTimers();
  const { box, page, announced } = world();
  await sleeping(box, ["npm:lw", "npm:kp"]);
  await page.load();
  await yours(page);
  box.world.started = box.world.sent[1]!.id;
  page.element.querySelector<HTMLButtonElement>('[data-focus="cancel install npm:kp"]')!.click();
  await settle();
  expect([rows(page), announced, focused()]).toEqual([["Listing writer cx 的电脑开启后安装。", "Keyword planner cx 的电脑开启后安装。"], [], "cancel install npm:kp"]);
});

it("forgets a failed row at 取消, and sends it again at 重试 to the queue's end, said as every press is, the keyboard following it", async () => {
  vi.useFakeTimers();
  const { box, page, backend, say } = world();
  box.world.detail = "npm error code ETIMEDOUT";
  box.world.fail = "pi_failed";
  await box.installPackage("npm:lw", true); await box.installPackage("npm:kp", true);
  box.release();
  box.world.fail = undefined;
  await page.load();
  await yours(page);
  expect(rows(page)).toEqual(["Listing writer 安装失败。", "Keyword planner 安装失败。"]);
  page.element.querySelector<HTMLButtonElement>('[data-focus="cancel install npm:lw"]')!.click();
  await settle();
  expect([backend.forgetFailure.mock.calls, rows(page)]).toEqual([[["npm:lw"]], ["Keyword planner 安装失败。"]]);
  page.element.querySelector<HTMLButtonElement>('[data-focus="retry install npm:kp"]')!.click();
  await settle();
  expect([box.world.sent.at(-1)?.source, rows(page), page.element.querySelector(".pl-toast")?.textContent, focused()]).toEqual(["npm:kp", ["Keyword planner 正在安装"], say("pl.q.added"), "queue install npm:kp"]);
});

it("goes from a card's ring that stands still to the queue, the keyboard on the plugin's row", async () => {
  vi.useFakeTimers();
  const { box, page, say } = world();
  await sleeping(box, ["npm:kp"]);
  await page.load();
  location.hash = "#/plugins/discover/plugins/extensions";
  page.show({ kind: "home", view: "discover", filter: "plugins", shelf: "extensions" });
  await settle();
  const ring = page.element.querySelector<HTMLAnchorElement>('a.pl-queued[data-focus="act #/plugins/p/kp"]')!;
  expect([ring.getAttribute("aria-label"), ring.getAttribute("href")]).toEqual([say("pl.q.inQueue", { name: "Keyword planner" }), "#/plugins/yours/all"]);
  // Waiting its turn is a ring that does not turn (ruled 2026-11-13).
  expect([ring.querySelector(".pl-spin.pl-still") !== null, ring.querySelector("svg")]).toEqual([true, null]);
  ring.click();
  await yours(page);
  expect(focused()).toBe("queue install npm:kp");
});

it("names the install cx's computer runs for the line above the message box, and tells it each time a list is read", async () => {
  vi.useFakeTimers();
  const { box, page, listRead } = world();
  await box.installPackage("npm:lw", true); await box.installPackage("npm:kp", true);
  await page.load();
  expect([page.installing(), listRead.mock.calls.length > 0]).toEqual([{ name: "Listing writer", act: "install" }, true]);
  box.end(box.world.sent[0]!);
  await vi.advanceTimersByTimeAsync(REREAD_MS);
  expect(page.installing()).toEqual({ name: "Keyword planner", act: "install" });
  box.release();
  await vi.advanceTimersByTimeAsync(REREAD_MS);
  expect(page.installing()).toBeUndefined();
});

describe("around a start, the list is read again as on a computer that was on, whether or not anyone looks at the page", () => {
  const installed = [{ name: "lw", version: "1.0.0", source: "npm:lw", enabled: true }, { name: "kp", version: "1.0.0", source: "npm:kp", enabled: true }] as Package[];
  /** Two updates pressed while the computer was off, the computer then starting, and every read of the list counted. */
  const pressedOff = async () => {
    vi.useFakeTimers();
    let starting = false;
    const made = world(installed, () => false, () => starting);
    const { box, backend } = made;
    box.world.list = { ...box.world.list, asleep: true };
    await box.updatePackage("npm:lw"); await box.updatePackage("npm:kp");
    const reads = vi.fn(() => box.packages());
    (backend as { packages: () => Promise<unknown> }).packages = reads;
    return { ...made, reads, start: () => { starting = true; }, end: () => { starting = false; } };
  };
  it("stops reading again once the start is over and nothing waits", async () => {
    const { box, page, reads, start, end } = await pressedOff();
    start();
    await page.load();
    box.release(); box.world.list = { ...box.world.list, asleep: false };
    end();
    await vi.advanceTimersByTimeAsync(REREAD_MS);
    const after = reads.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10 * REREAD_MS);
    expect(reads.mock.calls.length).toBe(after);
  });

  /** The document hidden or shown, as a tab put behind another and brought back. */
  let hidden = false;
  const look = (away: boolean): void => {
    hidden = away;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event("visibilitychange"));
  };
  afterEach(() => { hidden = false; delete (document as { hidden?: boolean }).hidden; });

  it("reads the list again on its own clock while the page is hidden, as it does while someone looks", async () => {
    const { page, reads, start } = await pressedOff();
    start();
    look(true);
    await page.load();
    const before = reads.mock.calls.length;
    await vi.advanceTimersByTimeAsync(REREAD_MS);
    await settle();
    expect(reads.mock.calls.length).toBe(before + 1);
  });
});
