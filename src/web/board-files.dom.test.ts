// @vitest-environment happy-dom
// @vitest-environment-options { "settings": { "navigation": { "disableChildFrameNavigation": true } } }
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { OPENED_MAX, TASKS_TAB, type BoardEntry, type OpenedFile } from "../shared/board.js";
import { BoardRefused, type BoardRead, type BoardViewer, type OpenedFrom, type OpenRead } from "./backend.js";
import { FILES_PREFIX, fileBox, OpenFiles, pageFileBox } from "./board-files.js";
import { BoardView } from "./board-view.js";
import { renderMarkdown } from "./markdown.js";
import { EMPTY, reduce, type StreamEvent, type StreamState } from "./stream-model.js";
import { StreamView } from "./stream-view.js";
import { text, type StringKey } from "./strings.js";

const PAGES = "https://pages.example";
const APP = "https://app.example";
type Posted = readonly [unknown, string];
const windows = new WeakMap<HTMLIFrameElement, { readonly posted: Posted[]; readonly postMessage: (data: unknown, origin: string) => void }>();
beforeAll(() => {
  // The stand-in DOM navigates no frame: what a page draws is the browser's, witnessed in `board-files.layout.ts`.
  Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
    configurable: true,
    get(this: HTMLIFrameElement) {
      let one = windows.get(this);
      if (one === undefined) { const posted: Posted[] = []; one = { posted, postMessage: (data, origin) => { posted.push([data, origin]); } }; windows.set(this, one); }
      return one;
    },
  });
});
afterEach(() => { document.body.replaceChildren(); });

const say = (key: StringKey, values?: Readonly<Record<string, string | number>>): string => text("en", key, values);
const settle = async (): Promise<void> => { for (let n = 0; n < 10; n++) await Promise.resolve(); };
const memory = () => { const kept = new Map<string, string>(); return { kept, read: (key: string) => kept.get(key) ?? null, write: (key: string, value: string) => { kept.set(key, value); }, remove: (key: string) => { kept.delete(key); }, keys: () => [...kept.keys()] }; };

describe("the files open as tabs, kept in the browser", () => {
  it("keeps them for the account in the order opened, once each, and the first goes past the most", () => {
    const store = memory();
    let account = "a";
    const files = new OpenFiles(store, () => account);
    files.add("reports/w46.md");
    files.add("data/sales.csv");
    files.add("reports/w46.md");
    expect([files.all, store.kept.get(`${FILES_PREFIX}a`)]).toEqual([["reports/w46.md", "data/sales.csv"], '["reports/w46.md","data/sales.csv"]']);
    // A reload reads them back; another account has its own.
    expect(new OpenFiles(store, () => "a").all).toEqual(["reports/w46.md", "data/sales.csv"]);
    account = "b";
    expect(files.all).toEqual([]);
    account = "a";
    for (let n = 0; n < OPENED_MAX; n++) files.add(`many/${n}.md`);
    expect([files.all.length, files.has("reports/w46.md"), files.has("data/sales.csv"), files.all[0]]).toEqual([OPENED_MAX, false, false, "many/0.md"]);
    for (const path of files.all) files.remove(path);
    expect(store.kept.has(`${FILES_PREFIX}a`)).toBe(false);
  });
});

describe("the file box", () => {
  it("names the file and what a press does, carries its path, holds its kind's mark and the board's, and is pressed in the chat by its port", () => {
    const pressed: string[] = [];
    const box = fileBox("reports/w46.md", say, (path) => pressed.push(path));
    expect([box.getAttribute("aria-label"), box.dataset["cxFile"], box.textContent, box.querySelectorAll(".mark > .of-kind, .mark > .to-board").length]).toEqual(["w46.md, show on the board", "reports/w46.md", "w46.md", 2]);
    box.click();
    expect(pressed).toEqual(["reports/w46.md"]);
    // In a page's words it is the kit's form, for the page's own script to take the press.
    const page = pageFileBox("data/sales.csv", say);
    expect([page.className, page.dataset["cxFile"], page.querySelectorAll("svg").length, page.textContent]).toEqual(["file-ref", "data/sales.csv", 1, "sales.csv"]);
  });
});

it("opens a file from its box in an answer cx is still writing, as from one in an answer saved, through the real reducer, view and renderer", () => {
  const opened: string[] = [];
  const page = new StreamView({ say, now: () => 0, day: () => "Today", openFile: (path) => opened.push(path) });
  document.body.append(page.element);
  const delta = (event: string, extra: Record<string, unknown> = {}): StreamEvent => ({ event: "delta", data: { kind: "delta", body: { form: "message_delta", event, contentIndex: 0, ...extra } } });
  let state = [{ event: "life", data: { kind: "life", epoch: "c".repeat(32) } }, { event: "turn", data: { kind: "turn", running: true } }, delta("text_start"), delta("text_delta", { delta: "The plan is in `reports/restock-plan.md`" })].reduce(reduce, EMPTY as StreamState);
  page.update(state);
  // The answer grows while the seller reads it, so what they press is the drawing of a later word.
  state = reduce(state, delta("text_delta", { delta: " and" }));
  page.update(state);
  const box = page.element.querySelector<HTMLButtonElement>(".item.assistant.draft button.file-open");
  expect(box?.dataset["cxFile"]).toBe("reports/restock-plan.md");
  box!.click();
  expect(opened).toEqual(["reports/restock-plan.md"]);
});

it("draws each path cx prints, in prose or alone as code, as the file box through the real renderer, and leaves a link's words and a code block as written", () => {
  const pressed: string[] = [];
  const drawn = renderMarkdown("The report is reports/w46.md and the table `/tenant/data/sales.csv`.\n\n[see reports/x.md](https://example.com)\n\n```\nlogs/run.txt\n```", (path) => fileBox(path, say, (one) => pressed.push(one)));
  const boxes = [...drawn.querySelectorAll<HTMLButtonElement>("button.file-open")];
  expect(boxes.map((box) => [box.dataset["cxFile"], box.textContent])).toEqual([["reports/w46.md", "w46.md"], ["data/sales.csv", "sales.csv"]]);
  expect([drawn.querySelector("a")!.textContent, drawn.querySelector("pre")!.textContent]).toEqual(["see reports/x.md", "logs/run.txt\n"]);
  boxes[1]!.click();
  expect(pressed).toEqual(["data/sales.csv"]);
});

describe("a file of the computer on its own tab of the board", () => {
  const card = (file: string, body = ""): BoardEntry => ({ file, place: "todo", modified: 1, readable: false, title: file, body });
  type Opened = OpenRead | Error;
  function board(files: Readonly<Record<string, Opened>>, viewers: Readonly<Record<string, BoardViewer>> = {}, options: { readonly inSight?: boolean; readonly openFile?: (path: string, from: OpenedFrom) => void; readonly body?: string } = {}) {
    const stats = new Map<string, OpenedFile>();
    const backend = {
      board: vi.fn(async (_before?: string, tab?: string): Promise<BoardRead> => ({
        shown: true, tab: tab ?? "Reports", tabs: ["Helpers", "Reports"], entries: [card(`${tab ?? "Reports"}.md`, options.body)], pages: [{ tab: "Helpers", by: { kind: "cx" } }],
      })),
      boardOpen: vi.fn(async (path: string, _from: OpenedFrom, _bytes: boolean): Promise<OpenRead> => { const one = files[path] ?? { kind: "gone" }; if (one instanceof Error) throw one; return one; }),
      boardViewer: vi.fn(async (kind: string): Promise<BoardViewer | undefined> => viewers[kind]),
      boardOpened: vi.fn(async (paths: readonly string[]): Promise<readonly OpenedFile[]> => paths.map((file) => {
        const held = stats.get(file);
        if (held !== undefined) return held;
        const one = files[file];
        if (one instanceof Error) throw one;
        return one === undefined || one.kind === "gone" ? { file, missing: true } : "size" in one ? { file, size: one.size, modified: one.modified } : { file, missing: true };
      })),
    };
    const page = vi.fn(async () => ({ html: "<p>page</p>", by: { kind: "cx" } as const }));
    const view = new BoardView({ backend, say, now: () => 1, time: (time) => `t${time}`, clock: String, day: String, changed: () => {}, frame: { origin: PAGES, appOrigin: APP, read: page }, store: memory(), account: () => "a",
      inSight: () => options.inSight ?? true, ...(options.openFile === undefined ? {} : { openFile: options.openFile }) }, () => "en");
    document.body.append(view.head, view.page);
    return { view, backend, stats };
  }
  const MARKDOWN: BoardViewer = { html: "<p>viewer</p>", by: { kind: "ours", name: "cx-board", package: "@comchatx/cx-board" }, kit: { css: "k", js: "j" } };
  const PICTURE: BoardViewer = { ...MARKDOWN, bytes: true };
  const strip = (): string[] => [...document.querySelectorAll<HTMLElement>(".board-tabs [role=tab]")].map((tab) => `${tab.textContent}${tab.getAttribute("aria-selected") === "true" ? "*" : ""}${tab.querySelector("svg") === null ? "" : "#"}`);
  const shown = (selector: string): boolean => { const one = document.querySelector<HTMLElement>(selector); return one !== null && !one.hidden; };
  const head = (): string[] => [...document.querySelectorAll(".file-head > span")].map((one) => one.textContent ?? "");
  const frame = (): HTMLIFrameElement | null => document.querySelector<HTMLIFrameElement>("#board-frame iframe:not([hidden])");
  const handed = (one: HTMLIFrameElement | null): unknown[] => (windows.get(one!)?.posted ?? []).map(([data]) => data).filter((data) => (data as { cx?: string }).cx === "page" || (data as { cx?: string }).cx === "file");
  const ready = (one: HTMLIFrameElement | null): void => { for (const cx of ["ready", "shown"]) window.dispatchEvent(new MessageEvent("message", { origin: PAGES, source: one!.contentWindow, data: { cx } })); };

  it("opens at the press after the board's tabs with its kind's mark, opening at once, then drawn by the viewer its kind has, its facts in one row", async () => {
    const { view, backend } = board({ "reports/w46.md": { kind: "file", size: 2048, modified: 7, text: "# Week 46" } }, { md: MARKDOWN });
    await view.read();
    let finish: (value: OpenRead) => void = () => {};
    backend.boardOpen.mockImplementationOnce(() => new Promise((done) => { finish = done; }));
    view.openFile("reports/w46.md", "chat");
    expect([strip(), view.file, shown("#board-file"), document.querySelector("#board-file [role=status]")?.getAttribute("aria-label"), head()]).toEqual([["Helpers", "Reports", "w46.md*#"], "reports/w46.md", true, "Loading", ["reports/w46.md"]]);
    await settle();
    expect(backend.boardViewer.mock.calls).toEqual([["md"]]);
    expect(backend.boardOpen.mock.calls).toEqual([["reports/w46.md", "chat", false]]);
    finish({ kind: "file", size: 2048, modified: 7, text: "# Week 46" });
    await settle();
    expect([shown("#board-file"), shown("#board-frame"), document.querySelector("#board-frame")!.classList.contains("of-file"), head()]).toEqual([false, true, true, ["reports/w46.md", "2 KB", "t7"]]);
    ready(frame());
    expect(handed(frame())).toEqual([
      { cx: "page", html: "<p>viewer</p>", kit: { css: "k", js: "j" }, context: expect.anything() },
      { cx: "file", file: { path: "reports/w46.md", name: "w46.md", size: 2048, modified: 7, text: "# Week 46" } },
    ]);
    // The same file pressed again shows the tab it has, read no more; a folder's tab shown leaves it on the strip.
    view.showTab("Reports");
    expect([strip(), shown("#board-pending"), document.querySelector("#board-frame")!.classList.contains("of-file")]).toEqual([["Helpers", "Reports*", "w46.md#"], true, false]);
    view.openFile("reports/w46.md", "page");
    expect([strip(), backend.boardOpen.mock.calls.length]).toEqual([["Helpers", "Reports", "w46.md*#"], 1]);
  });

  it("hands a picture's viewer its bytes, and draws an HTML file as its own page with the kit, no viewer asked", async () => {
    const { view, backend } = board({ "shots/a.png": { kind: "file", size: 3, modified: 1, bytes: "AQID" }, "plans/restock.html": { kind: "file", size: 9, modified: 2, text: "<h1>Plan</h1>", kit: { css: "c", js: "s" } } }, { png: PICTURE });
    await view.read();
    view.openFile("shots/a.png", "card");
    await settle();
    expect(backend.boardOpen.mock.calls.at(-1)).toEqual(["shots/a.png", "card", true]);
    ready(frame());
    expect(handed(frame()).at(-1)).toEqual({ cx: "file", file: { path: "shots/a.png", name: "a.png", size: 3, modified: 1, bytes: "AQID" } });
    view.openFile("plans/restock.html", "page");
    await settle();
    expect(backend.boardViewer.mock.calls).toEqual([["png"]]);
    ready(frame());
    expect(handed(frame())).toEqual([{ cx: "page", html: "<h1>Plan</h1>", kit: { css: "c", js: "s" }, context: expect.anything() }]);
  });

  it("draws a kind no viewer draws as the platform's row, too large as its line over that row, and gone, unread or off by its own line", async () => {
    const { view, backend } = board({
      "exports/orders.xlsx": { kind: "file", size: 1_900_000, modified: 3 }, "exports/all.csv": { kind: "large", size: 50_000_000, modified: 4 },
      "gone/x.md": { kind: "gone" }, "bad/y.md": { kind: "unreadable" }, "off/z.md": new BoardRefused("box_not_running"),
    }, { md: MARKDOWN, csv: MARKDOWN });
    await view.read();
    const said = (): string => [...document.querySelectorAll("#board-file .file-said, #board-file .file-row-name, #board-file .file-row-facts, #board-file [role=status][aria-label]")].map((one) => one.textContent || one.getAttribute("aria-label")).join(" | ");
    view.openFile("exports/orders.xlsx", "chat");
    await settle();
    expect([said(), head(), shown("#board-frame")]).toEqual(["orders.xlsx | 1.8 MB · t3", ["exports/orders.xlsx", "1.8 MB", "t3"], false]);
    view.openFile("exports/all.csv", "chat");
    await settle();
    expect(said()).toEqual("This file is too large to show. | all.csv | 48 MB · t4");
    view.openFile("gone/x.md", "chat");
    await settle();
    expect([said(), head()]).toEqual(["This file could not be found.", ["gone/x.md"]]);
    view.openFile("bad/y.md", "chat");
    await settle();
    expect(said()).toEqual("This file can't be read.");
    view.openFile("off/z.md", "chat");
    await settle();
    expect(said()).toEqual("cx's computer is off");
    // Shown again, a file that did not read is read again.
    const calls = backend.boardOpen.mock.calls.length;
    view.showTab("Reports");
    [...document.querySelectorAll<HTMLElement>(".board-tabs [role=tab]")].find((tab) => tab.textContent === "z.md")!.click();
    await settle();
    expect(backend.boardOpen.mock.calls.length).toBe(calls + 1);
  });

  it("closes with no question at its cross or Delete, showing the tab after it, else the one before, the keyboard going with it", async () => {
    const { view } = board({ "a/one.md": { kind: "file", size: 1, modified: 1, text: "1" }, "a/two.md": { kind: "file", size: 1, modified: 1, text: "2" } }, { md: MARKDOWN });
    await view.read();
    view.openFile("a/one.md", "chat");
    view.openFile("a/two.md", "chat");
    await settle();
    // The arrows go across the board's tabs and the files' alike.
    const tabs = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(".board-tabs [role=tab]")];
    tabs()[3]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect([strip(), document.activeElement?.textContent]).toEqual([["Helpers", "Reports", "one.md*#", "two.md#"], "one.md"]);
    const cross = document.querySelector<HTMLButtonElement>(".file-tab.on .tab-close")!;
    expect([cross.getAttribute("aria-label"), cross.title, document.querySelectorAll(".file-tab .tab-close:not([hidden])").length]).toEqual(["Close “one.md”", "Close “one.md”", 1]);
    cross.click();
    expect([strip(), document.activeElement?.textContent]).toEqual([["Helpers", "Reports", "two.md*#"], "two.md"]);
    tabs()[2]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect([strip(), document.activeElement?.textContent, view.file]).toEqual([["Helpers", "Reports*"], "Reports", undefined]);
  });

  it("is the file as it is now: changed while shown it is read again, changed while another tab is shown its tab takes the dot and reads once shown", async () => {
    const { view, backend, stats } = board({ "r/w.md": { kind: "file", size: 1, modified: 1, text: "old" } }, { md: MARKDOWN });
    await view.read();
    view.openFile("r/w.md", "chat");
    await settle();
    ready(frame());
    stats.set("r/w.md", { file: "r/w.md", size: 2, modified: 2 });
    backend.boardOpen.mockResolvedValue({ kind: "file", size: 2, modified: 2, text: "new" });
    await view.read();
    await settle();
    expect([handed(frame()).at(-1), head()]).toEqual([{ cx: "file", file: { path: "r/w.md", name: "w.md", size: 2, modified: 2, text: "new" } }, ["r/w.md", "2 B", "t2"]]);
    view.showTab("Reports");
    stats.set("r/w.md", { file: "r/w.md", size: 3, modified: 3 });
    backend.boardOpen.mockResolvedValue({ kind: "file", size: 3, modified: 3, text: "newer" });
    const reads = backend.boardOpen.mock.calls.length;
    await view.read();
    await settle();
    const tab = [...document.querySelectorAll<HTMLElement>(".board-tabs [role=tab]")].at(-1)!;
    expect([backend.boardOpen.mock.calls.length, tab.querySelector<HTMLElement>(".tab-dot")!.hidden, tab.getAttribute("aria-label"), view.fresh]).toEqual([reads, false, "w.md, new", true]);
    tab.click();
    await settle();
    expect([backend.boardOpen.mock.calls.length, tab.querySelector<HTMLElement>(".tab-dot")!.hidden, view.fresh, handed(frame()).at(-1)]).toEqual([reads + 1, true, false, { cx: "file", file: { path: "r/w.md", name: "w.md", size: 3, modified: 3, text: "newer" } }]);
  });

  it("draws a path on a card as the file box, whose press asks for the file's tab as pressed on a card", async () => {
    const opened: string[] = [];
    const { view } = board({}, {}, { openFile: (path, from) => opened.push(`${from}:${path}`), body: "See `reports/w46.md`." });
    await view.read();
    view.showTab("Reports");
    const box = document.querySelector<HTMLButtonElement>("#board-pending button.file-open")!;
    box.click();
    expect([box.dataset["cxFile"], opened]).toEqual(["reports/w46.md", ["card:reports/w46.md"]]);
    expect(TASKS_TAB).not.toBe("Reports");
  });
});
