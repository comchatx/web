// @vitest-environment happy-dom
// @vitest-environment-options { "settings": { "navigation": { "disableChildFrameNavigation": true } } }
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BOARD_READ_MAX_BYTES, ENTRY_MAX_BYTES, TASKS_TAB, type BoardEntry, type PageMaker } from "../shared/board.js";
import { BoardRefused, type BoardPageRead, type BoardRead } from "./backend.js";
import { BoardFrame, FAILED_AFTER_MS, FIGURE_VALUES, LOADING_AFTER_MS, MOST_PAGES, QUOTE_MAX_BYTES, THEME_VALUES } from "./board-frame.js";
import { BoardView } from "./board-view.js";
import { renderMarkdown } from "./markdown.js";
import { FileNames } from "./paths.js";
import type { Off } from "./board-off.js";
import { text, type StringKey } from "./strings.js";

const PAGES = "https://pages.example";
const APP = "https://app.example";
type Posted = readonly [unknown, string];
/** Each frame's window as the page sees it: what was posted to it, and to which origin. */
const windows = new WeakMap<HTMLIFrameElement, { readonly posted: Posted[]; readonly postMessage: (data: unknown, origin: string) => void }>();
beforeAll(() => {
  // The stand-in DOM navigates no frame: the second site's answer is a browser's, proven in `board-frame.layout.ts`.
  Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
    configurable: true,
    get(this: HTMLIFrameElement) {
      let one = windows.get(this);
      if (one === undefined) { const posted: Posted[] = []; one = { posted, postMessage: (data, origin) => { posted.push([data, origin]); } }; windows.set(this, one); }
      return one;
    },
  });
});
afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); document.documentElement.removeAttribute("data-theme"); document.documentElement.removeAttribute("style"); });

const say = (key: StringKey, values?: Readonly<Record<string, string | number>>): string => text("en", key, values);
const shownFrame = (): HTMLIFrameElement | null => document.querySelector<HTMLIFrameElement>("#board-frame iframe:not([hidden])");
const from = (frame: HTMLIFrameElement | null, data: unknown, origin = PAGES): void => { window.dispatchEvent(new MessageEvent("message", { origin, source: frame!.contentWindow, data })); };
const posted = (frame: HTMLIFrameElement | null): readonly Posted[] => windows.get(frame!)?.posted ?? [];
const settle = async (): Promise<void> => { for (let n = 0; n < 5; n++) await Promise.resolve(); };
const note = (): string | undefined => { const one = document.querySelector<HTMLElement>(".frame-note"); return one === null || one.hidden ? undefined : document.querySelector(".frame-words")!.textContent ?? ""; };

function framed(read: (tab: string) => Promise<BoardPageRead>, plugin?: (npm: string) => string | undefined) {
  const ports = { origin: PAGES, appOrigin: APP, read: vi.fn(read), say, ...(plugin === undefined ? {} : { plugin }) };
  const frame = new BoardFrame(ports);
  document.body.append(frame.element);
  return { frame, ports };
}

/** The address row's box as a seller reads it: whose, then which. */
const byLine = (): string => [...document.querySelectorAll(".frame-by .address-who, .frame-by .address-where")].map((one) => one.textContent).join(" | ");

describe("a board's page in a frame", () => {
  it("gives a page exactly the values the ready-made elements read, each the app's own token of the same name, in both themes where it is a colour", () => {
    const kit = Object.keys(JSON.parse(readFileSync(join(process.cwd(), "src/web/testing/kit/theme.json"), "utf8")) as object);
    expect(THEME_VALUES).toEqual([...kit.filter((name) => name.startsWith("--")), ...FIGURE_VALUES]);
    // The figure's are names cx.js reads.
    const figure = readFileSync(join(process.cwd(), "src/web/cx.js"), "utf8");
    expect(FIGURE_VALUES.filter((name) => !figure.includes(`var(${name})`))).toEqual([]);
    // The rest the kit reads are the two data attributes the proxy sets on the page's root.
    expect(kit.filter((name) => !name.startsWith("--"))).toEqual(["data-theme", "data-locale"]);
    const theme = readFileSync(join(process.cwd(), "src/web/site/theme.css"), "utf8");
    const at = theme.indexOf("[data-theme=\"dark\"] {");
    const named = (block: string): Set<string> => new Set([...block.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((one) => one[1]!));
    // Every name is the app's; every colour the light set holds, the dark set holds too.
    expect(THEME_VALUES.filter((name) => !named(theme.slice(0, at)).has(name))).toEqual([]);
    const light = named(theme.slice(theme.indexOf(":root, [data-theme=\"light\"] {"), at));
    expect(THEME_VALUES.filter((name) => light.has(name) && !named(theme.slice(at)).has(name))).toEqual([]);
  });

  it("draws the proxy from the second site, hands it the page once it is ready, sizes the frame as the page says, and says nothing of a page that comes at once", async () => {
    vi.useFakeTimers();
    const { frame, ports } = framed(async () => ({ html: "<p>运行中</p>", by: { kind: "cx" } }));
    document.documentElement.dataset["theme"] = "dark";
    document.documentElement.lang = "zh-Hans";
    document.documentElement.style.setProperty("--ink", "#ededed");
    frame.show("Helpers", { kind: "cx" });
    const one = shownFrame()!;
    expect([one.getAttribute("src"), one.getAttribute("sandbox"), one.getAttribute("referrerpolicy"), one.title]).toEqual([`${PAGES}/frame#origin=${encodeURIComponent(APP)}`, "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads", "no-referrer", "Helpers"]);
    expect([byLine(), document.querySelector(".frame-reload")!.getAttribute("aria-label")]).toEqual(["cx | Helpers/page.html", "Reload"]);
    await settle();
    expect(posted(one)).toEqual([]);
    from(one, { cx: "ready" });
    const [data, origin] = posted(one)[0]!;
    expect(origin).toBe(PAGES);
    expect(data).toMatchObject({ cx: "page", html: "<p>运行中</p>", context: { theme: "dark", locale: "zh", values: { "--ink": "#ededed" } } });
    expect("kit" in (data as object)).toBe(false);
    expect(Object.keys((data as { context: { values: object } }).context.values).every((name) => THEME_VALUES.includes(name))).toBe(true);
    vi.advanceTimersByTime(LOADING_AFTER_MS - 50);
    from(one, { cx: "shown" });
    from(one, { cx: "size", height: 812.4 });
    vi.advanceTimersByTime(FAILED_AFTER_MS * 2);
    expect([note(), one.style.height, ports.read.mock.calls]).toEqual([undefined, "813px", [["Helpers"]]]);
  });

  it("takes a message only from the second site and its own frame, and posts only to the second site", async () => {
    const { frame } = framed(async () => ({ html: "<p>a</p>", by: { kind: "cx" }, kit: { css: ".kit{}", js: "Kit={}" } }));
    frame.show("Helpers", undefined);
    const one = shownFrame()!;
    await settle();
    from(one, { cx: "ready" }, APP);
    window.dispatchEvent(new MessageEvent("message", { origin: PAGES, source: window, data: { cx: "ready" } }));
    window.dispatchEvent(new MessageEvent("message", { origin: PAGES, data: { cx: "size", height: 40 } }));
    from(one, "ready");
    expect([posted(one), one.style.height]).toEqual([[], ""]);
    from(one, { cx: "ready" });
    expect(posted(one).map(([data, origin]) => [(data as { kit?: unknown }).kit, origin])).toEqual([[{ css: ".kit{}", js: "Kit={}" }, PAGES]]);
  });

  it("names who made the page in the signed captions, by the maker the page was read as", async () => {
    const makers: PageMaker[] = [{ kind: "ours", name: "cx-board-tasks" }, { kind: "third", name: "restock-helper" }];
    const { frame } = framed(async () => ({ html: "", by: makers.shift()! }));
    frame.show("A", { kind: "cx" });
    await settle();
    expect(byLine()).toBe("Plugin | cx-board-tasks");
    frame.show("B", undefined);
    await settle();
    expect(byLine()).toBe("Third-party plugin | restock-helper");
  });

  it("gives cx's page its place in the tree where the board's list holds the page, else the tab's own address, and a plugin's page its name", () => {
    const names = new FileNames([{ path: "Reports/page.html", tree: "board/user_2abc/Reports/page.html", modified: 1 }, { path: "Watch/notes.md", tree: "board/user_2abc/Watch/notes.md", modified: 2 }]);
    const frame = new BoardFrame({ origin: PAGES, appOrigin: APP, read: async () => ({ html: "", by: { kind: "cx" } }), say, names: () => names });
    document.body.append(frame.element);
    frame.show("Reports", { kind: "cx" });
    const listed = byLine();
    frame.show("Watch", { kind: "cx" });
    const absent = byLine();
    frame.show("Ads", { kind: "ours", name: "cx-ads", package: "@comchatx/cx-ads" });
    expect([listed, absent, byLine()]).toEqual(["cx | board/user_2abc/Reports/page.html", "cx | Watch/page.html", "Plugin | cx-ads"]);
  });

  it("names a page of ours by its card's name where the page holds the package's record, and by its npm name where it holds none or the maker came without its package", async () => {
    const makers: PageMaker[] = [{ kind: "ours", name: "cx-board-tasks", package: "@comchatx/cx-board-tasks" }, { kind: "ours", name: "cx-helper", package: "@comchatx/cx-helper" }, { kind: "ours", name: "cx-board-tasks" }];
    const { frame } = framed(async () => ({ html: "", by: makers.shift()! }), (npm) => (npm === "@comchatx/cx-board-tasks" ? "Board Inbox" : undefined));
    const caption = async (tab: string): Promise<string | null> => { frame.show(tab, undefined); await settle(); return byLine(); };
    expect([await caption("A"), await caption("B"), await caption("C")]).toEqual(["Plugin | Board Inbox", "Plugin | cx-helper", "Plugin | cx-board-tasks"]);
  });

  it("says Loading for a page still on its way after a moment, that it did not load with Try again when it does not come, and loads it again on Try again", async () => {
    vi.useFakeTimers();
    let answer: (page: BoardPageRead) => void = () => {};
    const { frame, ports } = framed(() => new Promise((resolve) => { answer = resolve; }));
    frame.show("Helpers", { kind: "cx" });
    vi.advanceTimersByTime(LOADING_AFTER_MS - 1);
    expect(note()).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(note()).toBe("Loading");
    answer({ html: "<p>late</p>", by: { kind: "cx" } });
    await settle();
    vi.advanceTimersByTime(FAILED_AFTER_MS);
    const retry = document.querySelector<HTMLButtonElement>(".frame-note > button")!;
    expect([note(), retry.hidden, retry.textContent, shownFrame(), document.querySelectorAll("#board-frame iframe").length]).toEqual(["This page did not load.", false, "Try again", null, 1]);
    retry.focus();
    retry.click();
    expect([note(), ports.read.mock.calls.length, document.activeElement?.className]).toEqual([undefined, 2, "page-icon f-icon frame-reload"]);
    from(shownFrame(), { cx: "ready" });
    answer({ html: "<p>now</p>", by: { kind: "cx" } });
    await settle();
    from(shownFrame(), { cx: "shown" });
    vi.advanceTimersByTime(FAILED_AFTER_MS);
    expect(note()).toBeUndefined();
  });

  it("says it did not load at once where the page cannot be read, and Reload reads it again", async () => {
    const { frame, ports } = framed(async () => { throw new Error("/board/page answered 404"); });
    frame.show("Helpers", { kind: "cx" });
    await settle();
    expect(note()).toBe("This page did not load.");
    document.querySelector<HTMLButtonElement>(".frame-reload")!.click();
    expect([note(), ports.read.mock.calls.length]).toEqual([undefined, 2]);
  });

  it("shows a blank page as its caption and Reload, nothing more", async () => {
    vi.useFakeTimers();
    const { frame } = framed(async () => ({ html: "", by: { kind: "cx" } }));
    frame.show("Blank", { kind: "cx" });
    await settle();
    const one = shownFrame()!;
    from(one, { cx: "ready" });
    from(one, { cx: "shown" });
    from(one, { cx: "size", height: 0 });
    vi.advanceTimersByTime(FAILED_AFTER_MS);
    expect([note(), one.style.height, byLine(), document.querySelector<HTMLElement>(".frame-reload")!.hidden]).toEqual([undefined, "0px", "cx | Blank/page.html", false]);
  });

  it("tells the page the theme and the language again when they change, out of sight too, and nothing once it is let go", async () => {
    const { frame } = framed(async () => ({ html: "<p>a</p>", by: { kind: "cx" } }));
    frame.show("Helpers", { kind: "cx" });
    await settle();
    const one = shownFrame()!;
    from(one, { cx: "ready" });
    document.documentElement.dataset["theme"] = "dark";
    await vi.waitFor(() => { expect(posted(one).at(-1)?.[0]).toMatchObject({ cx: "context", context: { theme: "dark" } }); });
    // Hidden, the page lives on out of sight, and is told still.
    frame.hide();
    document.documentElement.dataset["theme"] = "light";
    await vi.waitFor(() => { expect(posted(one).at(-1)?.[0]).toMatchObject({ cx: "context", context: { theme: "light" } }); });
    expect([one.isConnected, one.hidden, shownFrame(), frame.element.hidden]).toEqual([true, true, null, true]);
    // A tab that no longer holds a page lets its page go: nothing is told it, and nothing it says is heard.
    const told = posted(one).length;
    frame.keep(new Map());
    document.documentElement.dataset["theme"] = "dark";
    from(one, { cx: "size", height: 99 });
    await settle();
    expect([posted(one).length, one.isConnected, frame.living, one.style.height]).toEqual([told, false, [], ""]);
  });
});

describe("a page's frame, named", () => {
  it("keeps the frame titled by the tab's name through every caption, and in the language the name is asked in", () => {
    let language: "zh" | "en" = "en";
    const names: Readonly<Record<string, { zh: string; en: string }>> = { Restock: { zh: "补货清单", en: "Restock list" } };
    const frame = new BoardFrame({ origin: PAGES, appOrigin: APP, read: async () => ({ html: "<p>x</p>", by: { kind: "third", name: "example-restock" } }), say, name: (tab) => names[tab]?.[language] ?? tab });
    document.body.append(frame.element);
    frame.show("Restock", { kind: "third", name: "example-restock" });
    const titles = (): string[] => [...document.querySelectorAll<HTMLIFrameElement>("iframe.frame-page")].map((one) => one.title);
    expect(titles()).toEqual(["Restock list"]);
    // Another page shown captions every living frame again; a page with no name is titled by its folder.
    frame.show("Notes", { kind: "cx" });
    expect(titles().sort()).toEqual(["Notes", "Restock list"]);
    language = "zh";
    frame.show("Restock", { kind: "third", name: "example-restock" });
    expect(titles().sort()).toEqual(["Notes", "补货清单"]);
  });
});

describe("a tab that holds a page, on the board", () => {
  const card = (file: string): BoardEntry => ({ file, place: "todo", modified: 1, readable: false, title: file, body: "" });
  function board(options: { readonly frame?: boolean; readonly pages?: BoardRead["pages"]; readonly off?: () => Off | undefined; readonly failPage?: boolean } = {}) {
    const backend = {
      board: vi.fn(async (_before?: string, tab?: string): Promise<BoardRead> => ({
        shown: true, tab: tab ?? TASKS_TAB, tabs: ["Helpers", "Reports", TASKS_TAB].sort(), entries: [card(`${tab ?? TASKS_TAB}.md`)],
        pages: options.pages ?? [{ tab: "Helpers", by: { kind: "cx" } }],
      })),
    };
    const read = vi.fn(async (): Promise<BoardPageRead> => { if (options.failPage === true) throw new Error("box_not_running"); return { html: "<p>page</p>", by: { kind: "cx" } }; });
    const view = new BoardView({ backend, say, now: () => 1, time: String, clock: String, day: String, changed: () => {}, ...(options.frame === false ? {} : { frame: { origin: PAGES, appOrigin: APP, read } }),
      ...(options.off === undefined ? {} : { computer: { off: options.off, wake: () => {}, help: "mailto:help@example.com", floor: () => [] } }) }, () => "en");
    document.body.append(view.head, view.page);
    return { view, read };
  }
  const pane = (id: string): boolean => !document.querySelector<HTMLElement>(`#${id}`)!.hidden;

  it("keeps a page that lives drawn under the glass while cx's computer is off, out of reach and not loaded again, and shows it clear once it is on", async () => {
    const computer = { off: undefined as Off | undefined };
    const { view, read } = board({ off: () => computer.off });
    await view.read();
    view.showTab("Helpers");
    const page = shownFrame()!;
    const loads = read.mock.calls.length;
    computer.off = "off";
    view.draw();
    const frame = document.querySelector<HTMLElement>("#board-frame")!;
    expect([pane("board-frame"), frame.inert, frame.getAttribute("aria-hidden"), document.querySelector(".board-body")!.classList.contains("under-glass"), shownFrame()]).toEqual([true, true, "true", true, page]);
    computer.off = undefined;
    view.draw();
    expect([pane("board-frame"), frame.inert, frame.hasAttribute("aria-hidden"), shownFrame(), read.mock.calls.length]).toEqual([true, false, false, page, loads]);
  });

  it("lays the board's shape under the glass for a page that did not come, as on a cold open with the computer off", async () => {
    const { view } = board({ off: () => "off", failPage: true });
    await view.read();
    view.showTab("Helpers");
    await settle();
    const place = document.querySelector<HTMLElement>(".board-off")!;
    expect([pane("board-frame"), document.querySelector(".board-body")!.classList.contains("under-glass"), place.classList.contains("glass"), place.querySelector<HTMLElement>(".off-shape")!.hidden]).toEqual([false, false, true, false]);
  });

  it("draws the page in place of the tab's cards, keeps it out of sight on a tab switch, and draws a tab without one as its cards", async () => {
    const { view, read } = board();
    await view.read();
    view.showTab("Helpers");
    expect([pane("board-frame"), pane("board-pending"), document.querySelector(".board-body")!.classList.contains("framed"), shownFrame() !== null]).toEqual([true, false, true, true]);
    expect([document.querySelector("#board-frame")!.getAttribute("aria-labelledby"), document.querySelector<HTMLElement>(".board-tab[aria-selected='true']")!.getAttribute("aria-controls")]).toEqual([document.querySelector<HTMLElement>(".board-tab[aria-selected='true']")!.id, "board-frame"]);
    view.showTab("Reports");
    expect([pane("board-frame"), pane("board-pending"), shownFrame(), document.querySelector(".board-body")!.classList.contains("framed")]).toEqual([false, true, null, false]);
    view.showTab(TASKS_TAB);
    expect([pane("board-frame"), pane("board-pending"), [...document.querySelectorAll<HTMLElement>("#board-pending .board-entry")].map((one) => one.dataset["file"])]).toEqual([false, true, [`${TASKS_TAB}.md`]]);
    // The page was loaded once, out of sight, when the read said its tab holds one; shown again, or read again, it stands as it is.
    view.showTab("Helpers");
    const one = shownFrame();
    await view.read();
    expect([shownFrame(), read.mock.calls.length]).toEqual([one, 1]);
  });

  it("draws 待办 as its page where it holds one, and every tab as its cards where no second site is named", async () => {
    const without = board({ pages: [{ tab: "Helpers", by: { kind: "cx" } }, { tab: TASKS_TAB, by: { kind: "ours", name: "cx-board-tasks", package: "@comchatx/cx-board-tasks" } }] });
    await without.view.read();
    without.view.showTab(TASKS_TAB);
    expect([pane("board-frame"), pane("board-pending")]).toEqual([true, false]);
    document.body.replaceChildren();
    const plain = board({ frame: false });
    await plain.view.read();
    plain.view.showTab("Helpers");
    expect([document.querySelector("#board-frame"), pane("board-pending"), [...document.querySelectorAll<HTMLElement>("#board-pending .board-entry")].map((one) => one.dataset["file"])]).toEqual([null, true, ["Helpers.md"]]);
  });
});

describe("what a page asks of the board", () => {
  const asks = () => ({
    draft: vi.fn(), send: vi.fn((): "sent" | "drafted" => "sent"), count: vi.fn(), show: vi.fn(), pressed: vi.fn(),
    files: vi.fn(async () => [{ file: "a.json", modified: 2, size: 3 }]),
    read: vi.fn(async () => "结果"),
    write: vi.fn(async (_tab: string, _file: string, words: string) => ({ modified: 5, size: words.length })),
    save: vi.fn(async (): Promise<"saved"> => "saved"),
  });
  async function asking(page = "Restock") {
    const answered = asks();
    const frame = new BoardFrame({ origin: PAGES, appOrigin: APP, read: async () => ({ html: "<p>page</p>", by: { kind: "third", name: "example-restock" } }), say, asks: answered, names: () => new FileNames([{ path: "reports/w46.md", tree: "board/acct-1/reports/w46.md", modified: 1 }]) });
    document.body.append(frame.element);
    frame.show(page, undefined);
    await settle();
    const one = shownFrame()!;
    from(one, { cx: "ready" });
    const ask = async (id: number, data: Record<string, unknown>) => { from(one, { cx: "ask", id, ...data }); await settle(); return posted(one).find(([sent]) => (sent as { cx?: string; id?: number }).cx === "answer" && (sent as { id: number }).id === id); };
    return { frame, one, asks: answered, ask };
  }

  it("answers each ask by its id, to the second site alone, for the tab whose page asks", async () => {
    const { asks: answered, ask } = await asking();
    expect(await ask(1, { verb: "draft", text: "停止后台任务“补货”。" })).toEqual([{ cx: "answer", id: 1, ok: true, value: "drafted" }, PAGES]);
    expect(answered.draft).toHaveBeenCalledWith("Restock", "停止后台任务“补货”。");
    expect((await ask(2, { verb: "send", text: "按我的回答继续" }))?.[0]).toEqual({ cx: "answer", id: 2, ok: true, value: "sent" });
    expect(answered.send).toHaveBeenCalledWith("Restock", "按我的回答继续", undefined);
    expect((await ask(3, { verb: "list" }))?.[0]).toEqual({ cx: "answer", id: 3, ok: true, value: [{ file: "a.json", modified: 2, size: 3 }] });
    expect((await ask(4, { verb: "read", file: "out/result.txt" }))?.[0]).toEqual({ cx: "answer", id: 4, ok: true, value: "结果" });
    expect(answered.read).toHaveBeenCalledWith("Restock", "out/result.txt");
    expect((await ask(5, { verb: "write", file: "ask.json", text: "{}" }))?.[0]).toEqual({ cx: "answer", id: 5, ok: true, value: { file: "ask.json", modified: 5, size: 2 } });
    expect((await ask(6, { verb: "count", n: 6, words: " 6 条待处理 " }))?.[0]).toEqual({ cx: "answer", id: 6, ok: true });
    expect(answered.count).toHaveBeenCalledWith("Restock", 6, "6 条待处理");
    await ask(7, { verb: "count", n: 0 });
    expect(answered.count).toHaveBeenLastCalledWith("Restock", 0, undefined);
    expect((await ask(8, { verb: "show", name: "新的补货建议" }))?.[0]).toEqual({ cx: "answer", id: 8, ok: true });
    expect(answered.show).toHaveBeenCalledWith("Restock", "新的补货建议");
  });

  it("quotes a page's words with the card they were in, or the card whole, and tells the page whether a chat stands to take them", async () => {
    const quote = vi.fn();
    const answered = { ...asks(), quote };
    const frame = new BoardFrame({ origin: PAGES, appOrigin: APP, read: async () => ({ html: "<p>page</p>", by: { kind: "ours", name: "cx-board-tasks", package: "@comchatx/cx-board-tasks" } }), say, asks: answered });
    document.body.append(frame.element);
    frame.show("待办", undefined);
    await settle();
    const one = shownFrame()!;
    from(one, { cx: "ready" });
    await settle();
    expect((posted(one).find(([sent]) => (sent as { cx?: string }).cx === "page")?.[0] as { context: { quote: boolean } }).context.quote).toBe(true);
    const ask = async (id: number, data: Record<string, unknown>) => { from(one, { cx: "ask", id, ...data }); await settle(); return posted(one).find(([sent]) => (sent as { cx?: string; id?: number }).cx === "answer" && (sent as { id: number }).id === id)?.[0]; };
    expect(await ask(1, { verb: "quote", text: "退货率 12%", card: "inbox/returns.md", title: " 退货报告 " })).toEqual({ cx: "answer", id: 1, ok: true, value: "quoted" });
    expect(quote).toHaveBeenLastCalledWith("待办", { text: "退货率 12%", card: "inbox/returns.md", title: "退货报告", whole: false });
    await ask(2, { verb: "quote", text: "退货报告\n\n退货率 12%", card: "inbox/returns.md", title: "退货报告", whole: true });
    expect(quote).toHaveBeenLastCalledWith("待办", { text: "退货报告\n\n退货率 12%", card: "inbox/returns.md", title: "退货报告", whole: true });
    await ask(3, { verb: "quote", text: "竞品的价格" });
    expect(quote).toHaveBeenLastCalledWith("待办", { text: "竞品的价格", whole: false });
    for (const [at, data] of [{ verb: "quote", text: "" }, { verb: "quote", text: "x", card: "../x" }, { verb: "quote", text: "x", title: 3 }, { verb: "quote", text: "x", whole: "yes" }].entries())
      expect(await ask(10 + at, data), JSON.stringify(data)).toEqual({ cx: "answer", id: 10 + at, ok: false, reason: "malformed" });
    // A quote is not a draft: a long card is quoted whole, its long title with it, as far as the card's own read holds, and no further.
    const long = `${"退货率 12%，比上月高。".repeat(160)}`;
    expect(long.length).toBeGreaterThan(2_000);
    expect(await ask(14, { verb: "quote", text: long, card: "inbox/returns.md", title: "退".repeat(200), whole: true })).toEqual({ cx: "answer", id: 14, ok: true, value: "quoted" });
    expect(quote).toHaveBeenLastCalledWith("待办", { text: long, card: "inbox/returns.md", title: "退".repeat(200), whole: true });
    expect(await ask(15, { verb: "quote", text: "a".repeat(QUOTE_MAX_BYTES - 1), title: "bb" })).toEqual({ cx: "answer", id: 15, ok: false, reason: "too_large" });
    expect(quote).toHaveBeenCalledTimes(4);
    // At no press, the app refuses, and the page hears why.
    quote.mockImplementationOnce(() => { throw new BoardRefused("no_press"); });
    expect(await ask(20, { verb: "quote", text: "x" })).toEqual({ cx: "answer", id: 20, ok: false, reason: "no_press" });
  });

  it("refuses a quote where no chat stands beside the board, and says so in what the page is told", async () => {
    const { one, ask } = await asking();
    expect((posted(one).find(([sent]) => (sent as { cx?: string }).cx === "page")?.[0] as { context: { quote: boolean } }).context.quote).toBe(false);
    expect((await ask(1, { verb: "quote", text: "x" }))?.[0]).toEqual({ cx: "answer", id: 1, ok: false, reason: "unavailable" });
  });

  it("refuses an ask of the wrong shape, says why a refused read or write was refused, and hears no ask from another frame or origin", async () => {
    const { asks: answered, ask, one } = await asking();
    const refusals = [
      { verb: "draft", text: "" }, { verb: "draft", text: "x".repeat(2_001) }, { verb: "send", text: 1 }, { verb: "read", file: "../x" }, { verb: "write", file: ".x", text: "a" },
      { verb: "write", file: "a" }, { verb: "count", n: -1 }, { verb: "count", n: 1.5 }, { verb: "count", n: 100_000 }, { verb: "count", n: 1, words: "x".repeat(81) },
      { verb: "show", name: "" }, { verb: "show", name: 3 }, { verb: "fetch" },
    ];
    for (const [at, data] of refusals.entries()) expect((await ask(100 + at, data))?.[0], JSON.stringify(data)).toEqual({ cx: "answer", id: 100 + at, ok: false, reason: "malformed" });
    expect([answered.draft, answered.send, answered.read, answered.write, answered.count, answered.show].map((one) => one.mock.calls.length)).toEqual([0, 0, 0, 0, 0, 0]);
    answered.write.mockRejectedValueOnce(new BoardRefused("box_not_running"));
    answered.read.mockRejectedValueOnce(new Error("network"));
    expect([(await ask(200, { verb: "write", file: "a.txt", text: "x" }))?.[0], (await ask(201, { verb: "read", file: "a.txt" }))?.[0]]).toEqual([
      { cx: "answer", id: 200, ok: false, reason: "box_not_running" }, { cx: "answer", id: 201, ok: false, reason: "unreadable" },
    ]);
    const before = posted(one).length;
    from(one, { cx: "ask", id: 300, verb: "draft", text: "x" }, "https://elsewhere.example");
    window.dispatchEvent(new MessageEvent("message", { origin: PAGES, source: window, data: { cx: "ask", id: 301, verb: "draft", text: "x" } }));
    await settle();
    expect([posted(one).length, answered.draft.mock.calls.length]).toEqual([before, 0]);
  });

  it("draws a card's words for a page by the chat's own pipeline, up to a card's bound, and hands the app a file to save by the page's name for it", async () => {
    const { asks: answered, ask } = await asking();
    const words = "**Restock** by Friday:\n\n- 200 kettles\n\n| SKU | Units |\n|---|---|\n| B01 | 3 |\n\n[Report](https://example.com/r) <b>raw</b>";
    expect(await ask(1, { verb: "markdown", text: words })).toEqual([{ cx: "answer", id: 1, ok: true, value: renderMarkdown(words, undefined).innerHTML }, PAGES]);
    const drawn = (await ask(2, { verb: "markdown", text: words }))![0] as { value: string };
    expect(["<strong>Restock</strong>", "<li>200 kettles</li>", "<td>B01</td>", 'target="_blank"', "&lt;b&gt;raw&lt;/b&gt;"].map((one) => drawn.value.includes(one))).toEqual([true, true, true, true, true]);
    // A path in the words is the kit's file box, its press the page's own script's to take.
    const boxed = (await ask(50, { verb: "markdown", text: "See `reports/w46.md`." }))![0] as { value: string };
    const holder = document.createElement("div");
    holder.innerHTML = boxed.value;
    const box = holder.querySelector<HTMLButtonElement>("button[data-cx-file]");
    expect([box?.dataset["cxFile"], box?.getAttribute("aria-label"), box?.textContent]).toEqual(["board/acct-1/reports/w46.md", "w46.md, show on the board", "w46.md"]);
    const card = "字".repeat(Math.floor(ENTRY_MAX_BYTES / 3));
    expect([(await ask(3, { verb: "markdown", text: card }))?.[0], (await ask(4, { verb: "markdown", text: `${card}xxx` }))?.[0]]).toEqual([
      { cx: "answer", id: 3, ok: true, value: renderMarkdown(card, undefined).innerHTML }, { cx: "answer", id: 4, ok: false, reason: "too_large" },
    ]);
    expect([(await ask(5, { verb: "save", name: "top100.csv", text: "sku,units" }))?.[0], (await ask(6, { verb: "save", file: "exports/top100.csv" }))?.[0], (await ask(7, { verb: "save", file: "a.csv", name: "b.csv" }))?.[0]]).toEqual([
      { cx: "answer", id: 5, ok: true, value: "saved" }, { cx: "answer", id: 6, ok: true, value: "saved" }, { cx: "answer", id: 7, ok: true, value: "saved" },
    ]);
    expect(answered.save.mock.calls).toEqual([["Restock", "top100.csv", { text: "sku,units" }], ["Restock", "top100.csv", { file: "exports/top100.csv" }], ["Restock", "b.csv", { file: "a.csv" }]]);
    const refusals = [
      { verb: "markdown" }, { verb: "markdown", text: 1 }, { verb: "save", text: "x" }, { verb: "save", name: "a/b.csv", text: "x" }, { verb: "save", name: ".hidden", text: "x" },
      { verb: "save", name: "a.csv", text: "x", file: "b.csv" }, { verb: "save", file: "../x" }, { verb: "save", file: "a.csv", name: "" }, { verb: "save" },
    ];
    for (const [at, data] of refusals.entries()) expect((await ask(100 + at, data))?.[0], JSON.stringify(data)).toEqual({ cx: "answer", id: 100 + at, ok: false, reason: "malformed" });
    answered.save.mockRejectedValueOnce(new BoardRefused("no_press"));
    answered.save.mockRejectedValueOnce(new BoardRefused("too_large"));
    expect([(await ask(200, { verb: "save", name: "a.csv", text: "x" }))?.[0], (await ask(201, { verb: "save", file: "big.csv" }))?.[0]]).toEqual([
      { cx: "answer", id: 200, ok: false, reason: "no_press" }, { cx: "answer", id: 201, ok: false, reason: "too_large" },
    ]);
    expect(answered.save.mock.calls).toHaveLength(5);
  });

  it("hands the app a file of the tree to show at an open the proxy passed on, a path out of the tree refused, and refuses every open where the app takes none", async () => {
    const { asks: answered, ask } = await asking();
    const open = vi.fn();
    Object.assign(answered, { open });
    expect((await ask(1, { verb: "open", path: "reports/ads-week-46.md" }))?.[0]).toEqual({ cx: "answer", id: 1, ok: true });
    expect((await ask(2, { verb: "open", path: ".pi/notes.txt" }))?.[0]).toEqual({ cx: "answer", id: 2, ok: true });
    // A box the page's words drew for a file the board lists hands back the file's path in the tree, as any other.
    expect((await ask(3, { verb: "open", path: "board/acct-1/reports/w46.md" }))?.[0]).toEqual({ cx: "answer", id: 3, ok: true });
    expect(open.mock.calls).toEqual([["Restock", "reports/ads-week-46.md"], ["Restock", ".pi/notes.txt"], ["Restock", "board/acct-1/reports/w46.md"]]);
    for (const [at, path] of ["../x.md", "/reports/w46.md", "/etc/passwd", "a//b.md", "", 3].entries()) expect((await ask(100 + at, { verb: "open", path }))?.[0], String(path)).toEqual({ cx: "answer", id: 100 + at, ok: false, reason: "malformed" });
    expect(open).toHaveBeenCalledTimes(3);
    document.body.replaceChildren();
    const { ask: without } = await asking("Other");
    expect((await without(1, { verb: "open", path: "a.md" }))?.[0]).toEqual({ cx: "answer", id: 1, ok: false, reason: "unavailable" });
  });

  it("hands a viewer its file once its page is shown and again when it is read anew, hands an HTML file's page nothing, and gives a viewer no tab of its own", async () => {
    const opened = { path: "reports/sales.csv", name: "sales.csv", size: 9, modified: 7, text: "sku,units" };
    const answered = { ...asks(), quote: vi.fn() };
    const pages: Record<string, BoardPageRead> = {
      "file:reports/sales.csv": { html: "<p>table</p>", by: { kind: "ours", name: "cx-board" }, opened },
      "file:out/report.html": { html: "<p>report</p>", by: { kind: "cx" }, opened: { path: "out/report.html", name: "report.html", size: 13, modified: 8 } },
    };
    const frame = new BoardFrame({ origin: PAGES, appOrigin: APP, read: async (tab) => pages[tab]!, say, asks: answered });
    document.body.append(frame.element);
    frame.show("file:reports/sales.csv", undefined);
    await settle();
    const one = shownFrame()!;
    const files = (): readonly unknown[] => posted(one).map(([sent]) => sent).filter((sent) => (sent as { cx?: string }).cx === "file");
    from(one, { cx: "ready" });
    await settle();
    expect(files()).toEqual([]);
    from(one, { cx: "shown" });
    expect(files()).toEqual([{ cx: "file", file: opened }]);
    expect(posted(one).every(([, origin]) => origin === PAGES)).toBe(true);
    frame.file("file:reports/sales.csv", { ...opened, text: "sku,units\nB01,3", size: 15, modified: 9 });
    expect(files()).toEqual([{ cx: "file", file: opened }, { cx: "file", file: { ...opened, text: "sku,units\nB01,3", size: 15, modified: 9 } }]);
    const ask = async (id: number, data: Record<string, unknown>) => { from(one, { cx: "ask", id, ...data }); await settle(); return posted(one).find(([sent]) => (sent as { cx?: string; id?: number }).cx === "answer" && (sent as { id: number }).id === id)?.[0]; };
    for (const [at, data] of [{ verb: "list" }, { verb: "read", file: "a.txt" }, { verb: "write", file: "a.txt", text: "x" }, { verb: "count", n: 1 }, { verb: "save", file: "a.txt" }, { verb: "draft", text: "x" }, { verb: "send", text: "x" }, { verb: "show", name: "x" }].entries()) expect(await ask(10 + at, data), JSON.stringify(data)).toEqual({ cx: "answer", id: 10 + at, ok: false, reason: "no_tab" });
    // Its words are quoted as the file's, never as a card's: a file has no cards.
    expect(await ask(40, { verb: "quote", text: "B01,3" })).toEqual({ cx: "answer", id: 40, ok: true, value: "quoted" });
    expect(answered.quote).toHaveBeenLastCalledWith("file:reports/sales.csv", { text: "B01,3", whole: false });
    expect(await ask(41, { verb: "quote", text: "B01,3", card: "a.md" })).toEqual({ cx: "answer", id: 41, ok: false, reason: "malformed" });
    expect([answered.files, answered.read, answered.write, answered.count, answered.save].map((each) => each.mock.calls.length)).toEqual([0, 0, 0, 0, 0]);
    // Words it makes it hands the seller, as a page with a tab does.
    expect(await ask(30, { verb: "save", name: "a.csv", text: "x" })).toEqual({ cx: "answer", id: 30, ok: true, value: "saved" });
    expect(answered.save.mock.calls.at(-1)?.slice(1)).toEqual(["a.csv", { text: "x" }]);
    // A viewer draws its own file through the chat's pipeline up to a read's bound, past a card's.
    const long = "x".repeat(ENTRY_MAX_BYTES * 4);
    expect(await ask(20, { verb: "markdown", text: long })).toEqual({ cx: "answer", id: 20, ok: true, value: renderMarkdown(long, undefined).innerHTML });
    expect(await ask(21, { verb: "markdown", text: "x".repeat(BOARD_READ_MAX_BYTES + 1) })).toEqual({ cx: "answer", id: 21, ok: false, reason: "too_large" });
    frame.show("file:out/report.html", undefined);
    await settle();
    const page = shownFrame()!;
    from(page, { cx: "ready" });
    from(page, { cx: "shown" });
    await settle();
    expect(posted(page).map(([sent]) => (sent as { cx: string }).cx)).toEqual(["page"]);
  });

  it("tells the app of a press the proxy passed on, and of the keyboard going into the page", async () => {
    const { asks: answered, one } = await asking();
    from(one, { cx: "pressed" });
    expect(answered.pressed).toHaveBeenLastCalledWith("Restock");
    Object.defineProperty(document, "activeElement", { configurable: true, get: () => one });
    window.dispatchEvent(new Event("blur"));
    delete (document as { activeElement?: unknown }).activeElement;
    expect(answered.pressed).toHaveBeenCalledTimes(2);
  });

  it("keeps at most eight pages loaded out of sight, lets go a page whose tab no longer holds one, and tells each that lives of new files", async () => {
    const read = vi.fn(async (): Promise<BoardPageRead> => ({ html: "<p>page</p>", by: { kind: "cx" } }));
    const frame = new BoardFrame({ origin: PAGES, appOrigin: APP, read, say });
    document.body.append(frame.element);
    const tabs = Array.from({ length: 10 }, (_, n) => `t${n}`);
    frame.keep(new Map(tabs.map((tab) => [tab, { kind: "cx" } as const])));
    await settle();
    expect([frame.living.length, read.mock.calls.length, shownFrame()]).toEqual([MOST_PAGES, MOST_PAGES, null]);
    const frames = [...document.querySelectorAll<HTMLIFrameElement>("#board-frame iframe")];
    expect(frames.every((one) => one.hidden)).toBe(true);
    for (const one of frames.slice(0, 2)) from(one, { cx: "ready" });
    frame.files();
    expect(frames.map((one) => posted(one).some(([sent]) => (sent as { cx: string }).cx === "files"))).toEqual([true, true, false, false, false, false, false, false]);
    // A tab shown that is not among them yet is loaded for itself, and the first never shown lets go.
    frame.show("t9", undefined);
    expect([frame.living.length, frame.living.includes("t9"), frame.living.includes("t0"), frames.find((one) => one.title === "t0")!.isConnected, shownFrame()?.title]).toEqual([MOST_PAGES, true, false, false, "t9"]);
    frame.keep(new Map([["t9", { kind: "cx" }]]));
    expect([frame.living, frames.every((one) => !one.isConnected)]).toEqual([["t9"], true]);
    frame.clear();
    expect([frame.living, frame.element.hidden]).toEqual([[], true]);
  });

  it("loads again, read afresh, each living page of the tabs named, shown or out of sight, and loads none that does not live", async () => {
    const read = vi.fn(async (_tab: string): Promise<BoardPageRead> => ({ html: "<p>page</p>", by: { kind: "cx" } }));
    const frame = new BoardFrame({ origin: PAGES, appOrigin: APP, read, say });
    document.body.append(frame.element);
    frame.keep(new Map(["a", "b", "c"].map((tab) => [tab, { kind: "cx" } as const])));
    frame.show("a", undefined);
    await settle();
    const before = [...document.querySelectorAll<HTMLIFrameElement>("#board-frame iframe")];
    read.mockClear();
    frame.renew(["a", "b", "z"]);
    await settle();
    expect(read.mock.calls.map(([tab]) => tab).sort()).toEqual(["a", "b"]);
    expect([before.filter((one) => one.isConnected).map((one) => one.title), frame.living.slice().sort(), shownFrame()?.title, frame.tab]).toEqual([["c"], ["a", "b", "c"], "a", "a"]);
    expect(document.querySelector<HTMLIFrameElement>("#board-frame iframe[title='b']")!.hidden).toBe(true);
  });
});

it("never keeps more than eight pages living, the shown ones counted: the page shown longest ago lets go first, one never shown before any (P4)", async () => {
  const frame = new BoardFrame({ origin: PAGES, appOrigin: APP, read: async () => ({ html: "<p>x</p>", by: { kind: "cx" } }), say });
  document.body.append(frame.element);
  const tabs = Array.from({ length: 12 }, (_, n) => `t${n}`);
  frame.keep(new Map(tabs.map((tab) => [tab, { kind: "cx" } as const])));
  for (const tab of tabs) frame.show(tab, { kind: "cx" });
  frame.keep(new Map(tabs.map((tab) => [tab, { kind: "cx" } as const])));
  expect([frame.living.length, document.querySelectorAll("#board-frame iframe").length]).toEqual([MOST_PAGES, MOST_PAGES]);
  expect([...frame.living].sort()).toEqual(tabs.slice(4).sort());
  // Shown again, t5 is the newest shown; the next new page lets t4 go, the one shown longest ago.
  frame.show("t5", undefined);
  frame.keep(new Map([...tabs, "t12"].map((tab) => [tab, { kind: "cx" } as const])));
  frame.show("t12", { kind: "cx" });
  expect([frame.living.length, frame.living.includes("t4"), frame.living.includes("t5"), frame.living.includes("t12")]).toEqual([MOST_PAGES, false, true, true]);
  frame.clear();
});

describe("a page's number on the board", () => {
  const card = (file: string): BoardEntry => ({ file, place: "todo", modified: 1, readable: false, title: file, body: "" });
  it("counts a page's number on the icon and on its tab, the base's own boards counting nothing, kept for the account until its page goes", async () => {
    const held = new Map<string, string>();
    const store = { keys: () => [...held.keys()], read: (key: string) => held.get(key) ?? null, write: (key: string, value: string) => { held.set(key, value); }, remove: (key: string) => { held.delete(key); } };
    let pages: BoardRead["pages"] = [{ tab: "Restock", by: { kind: "third", name: "example-restock" } }];
    const backend = {
      board: vi.fn(async (_before?: string, tab?: string): Promise<BoardRead> => ({
        shown: true, tab: tab ?? TASKS_TAB, tabs: ["Notes", "Restock"], entries: tab !== undefined ? [card(`${tab}-1.md`), card(`${tab}-2.md`)] : [], ...(pages === undefined ? {} : { pages }),
      })),
    };
    const asks = { draft: vi.fn(), send: vi.fn((): "sent" => "sent"), files: vi.fn(), read: vi.fn(), write: vi.fn(), show: vi.fn(), save: vi.fn(), pressed: vi.fn(), count: vi.fn() };
    const make = () => new BoardView({ backend, say, now: () => 1, time: String, clock: String, day: String, changed: () => {}, store, account: () => "acct-1", frame: { origin: PAGES, appOrigin: APP, read: async () => ({ html: "<p>x</p>", by: { kind: "cx" } }), asks } }, () => "en");
    const view = make();
    document.body.append(view.head, view.page);
    await view.read();
    // The base counts nothing: before the page gives a number, the icon carries none.
    expect([view.count, view.countName]).toEqual([0, "Board"]);
    const frame = shownOrLiving();
    from(frame, { cx: "ready" });
    from(frame, { cx: "ask", id: 1, verb: "count", n: 6, words: "6 条补货建议" });
    await settle();
    // The number is the board's to keep: the app's own port hears nothing of it.
    expect(asks.count).not.toHaveBeenCalled();
    view.draw();
    const tab = [...document.querySelectorAll<HTMLElement>(".board-tab")].find((one) => one.id.includes("Restock"))!;
    expect([view.count, view.countName, tab.querySelector(".page-count")!.textContent, tab.getAttribute("aria-label")]).toEqual([6, "Board, 6 条补货建议", "6", "Restock, 6 条补货建议"]);
    // Kept in the browser, the number stands before the page runs again.
    document.body.replaceChildren();
    const again = make();
    await again.read();
    expect(again.count).toBe(6);
    // A tab whose page went takes its number with it, and its files are counted by no one.
    pages = [];
    await again.read();
    expect([again.count, [...held.keys()].filter((key) => key.startsWith("cmx-board-counts:"))]).toEqual([0, []]);
  });
});

const shownOrLiving = (): HTMLIFrameElement => document.querySelector<HTMLIFrameElement>("#board-frame iframe")!;
