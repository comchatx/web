// @vitest-environment happy-dom
// @vitest-environment-options { "settings": { "navigation": { "disableChildFrameNavigation": true } } }
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { OPENED_MAX, TASKS_TAB, type BoardEntry, type OpenedFile } from "../shared/board.js";
import { BoardRefused, type BoardRead, type BoardViewer, type OpenedFrom, type OpenRead } from "./backend.js";
import { FILES_PREFIX, fileBox, OpenFiles, pageFileBox } from "./board-files.js";
import { BoardView } from "./board-view.js";
import { renderMarkdown } from "./markdown.js";
import { FileNames } from "./paths.js";
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

it("keeps the board's file and the tree's file of one path from the board apart across a reload, each by its path in the tree", () => {
  const store = memory();
  const files = new OpenFiles(store, () => "a");
  files.add("board/user_2abc/Reports/weekly.md");
  files.add("Reports/weekly.md");
  expect(new OpenFiles(store, () => "a").all).toEqual(["board/user_2abc/Reports/weekly.md", "Reports/weekly.md"]);
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
  const names = new FileNames([{ path: "reports/restock-plan.md", tree: "board/user_2abc/reports/restock-plan.md", modified: 1 }]);
  const page = new StreamView({ say, now: () => 0, day: () => "Today", openFile: (path) => opened.push(path), names: () => names });
  document.body.append(page.element);
  const delta = (event: string, extra: Record<string, unknown> = {}): StreamEvent => ({ event: "delta", data: { kind: "delta", body: { form: "message_delta", event, contentIndex: 0, ...extra } } });
  let state = [{ event: "life", data: { kind: "life", epoch: "c".repeat(32) } }, { event: "turn", data: { kind: "turn", running: true } }, delta("text_start"), delta("text_delta", { delta: "The plan is in `reports/restock-plan.md`" })].reduce(reduce, EMPTY as StreamState);
  page.update(state);
  // The answer grows while the seller reads it, so what they press is the drawing of a later word.
  state = reduce(state, delta("text_delta", { delta: " and" }));
  page.update(state);
  const box = page.element.querySelector<HTMLButtonElement>(".item.assistant.draft button.file-open");
  expect(box?.dataset["cxFile"]).toBe("board/user_2abc/reports/restock-plan.md");
  box!.click();
  expect(opened).toEqual(["board/user_2abc/reports/restock-plan.md"]);
});

// The answers of walk 956, as cx wrote them about the files it had just made on the board's 文档 tab.
const made = new FileNames([
  { path: "文档/亚马逊新品上架检查清单.docx", tree: "board/user_2abc/文档/亚马逊新品上架检查清单.docx", modified: 1 },
  { path: "文档/商品利润表.xlsx", tree: "board/user_2abc/文档/商品利润表.xlsx", modified: 2 },
  { path: "文档/关于推动工业互联网高质量发展的实施意见.pdf", tree: "board/user_2abc/文档/关于推动工业互联网高质量发展的实施意见.pdf", modified: 3 },
  { path: "文档/坏文件.pdf", tree: "board/user_2abc/文档/坏文件.pdf", modified: 4 },
]);
const boxesOf = (drawn: HTMLElement): readonly (readonly [string | undefined, string | null])[] => [...drawn.querySelectorAll<HTMLButtonElement>("button.file-open")].map((box) => [box.dataset["cxFile"], box.textContent]);

it("draws as the file box through the real renderer each file the board lists that inline code names, showing its name, and leaves prose as words", () => {
  const pressed: string[] = [];
  const drawn = renderMarkdown([
    "**《亚马逊新品上架检查清单》**",
    "2. **坏文件.pdf**：已建好，`坏文件.pdf`。",
    "- `/tenant/board/user_2abc/文档/商品利润表.xlsx`",
    "- /tenant/board/user_2abc/文档/关于推动工业互联网高质量发展的实施意见.pdf",
    "- `文档/关于推动工业互联网高质量发展的实施意见.pdf`",
  ].join("\n\n"), { names: made, box: (path) => fileBox(path, say, (one) => pressed.push(one)) });
  expect(boxesOf(drawn)).toEqual([
    ["board/user_2abc/文档/坏文件.pdf", "坏文件.pdf"],
    ["board/user_2abc/文档/商品利润表.xlsx", "商品利润表.xlsx"],
    ["board/user_2abc/文档/关于推动工业互联网高质量发展的实施意见.pdf", "关于推动工业互联网高质量发展的实施意见.pdf"],
  ]);
  expect(drawn.textContent).toContain("《亚马逊新品上架检查清单》");
  expect(drawn.textContent).toContain("/tenant/board/user_2abc/文档/关于推动工业互联网高质量发展的实施意见.pdf");
  drawn.querySelectorAll<HTMLButtonElement>("button.file-open")[1]!.click();
  expect(pressed).toEqual(["board/user_2abc/文档/商品利润表.xlsx"]);
});

it("leaves as written a fenced block, a link's words, and every word that names no file the board lists", () => {
  const drawn = renderMarkdown([
    "Saved with `cxBoard.save` from `job.tree`; the kit's `Kit.file` reads `.boards.json` and `word.html`, and reports/w46.md.",
    "[坏文件.pdf](https://example.com)",
    "```\n/tenant/board/user_2abc/文档/坏文件.pdf\n```",
  ].join("\n\n"), { names: made, box: (path) => fileBox(path, say) });
  expect(boxesOf(drawn)).toEqual([]);
  expect([drawn.querySelector("a")!.textContent, drawn.querySelector("pre")!.textContent]).toEqual(["坏文件.pdf", "/tenant/board/user_2abc/文档/坏文件.pdf\n"]);
  expect(drawn.querySelectorAll("code").length).toBe(6);
});

it("draws no file box where the board's files are not known", () => {
  expect(renderMarkdown("**坏文件.pdf**", undefined).querySelector("button")).toBeNull();
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
      // Asked for bytes, the box hands a file's bytes whatever it is, as the platform's port does.
      boardOpen: vi.fn(async (path: string, _from: OpenedFrom, bytes: boolean): Promise<OpenRead> => {
        const one = files[path] ?? { kind: "gone" };
        if (one instanceof Error) throw one;
        if (one.kind !== "file") return one;
        // A file given both is read as its words (decoded, as the port decodes them) or as its bytes, as asked.
        const { text, bytes: held, ...rest } = one;
        if (!bytes) return text === undefined ? one : { ...rest, text };
        return held !== undefined ? { ...rest, bytes: held } : text === undefined ? one : { ...rest, bytes: btoa(String.fromCharCode(...new TextEncoder().encode(text))) };
      }),
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
      inSight: () => options.inSight ?? true, ...(options.openFile === undefined ? {} : { openFile: options.openFile, names: () => new FileNames([{ path: "Reports/w46.md", tree: "board/user_2abc/Reports/w46.md", modified: 1 }]) }) }, () => "en");
    document.body.append(view.head, view.page);
    return { view, backend, stats };
  }
  const MARKDOWN: BoardViewer = { html: "<p>viewer</p>", by: { kind: "ours", name: "cx-board", package: "@comchatx/cx-board" }, kit: { css: "k", js: "j" } };
  const PICTURE: BoardViewer = { ...MARKDOWN, bytes: true };
  const strip = (): string[] => [...document.querySelectorAll<HTMLElement>(".board-tabs [role=tab]")].map((tab) => `${tab.textContent}${tab.getAttribute("aria-selected") === "true" ? "*" : ""}${tab.querySelector("svg") === null ? "" : "#"}`);
  const shown = (selector: string): boolean => { const one = document.querySelector<HTMLElement>(selector); return one !== null && !one.hidden; };
  const head = (): string[] => [...document.querySelectorAll(".file-head .address-where, .file-head .address-facts")].map((one) => one.textContent ?? "");
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
    expect([shown("#board-file"), shown("#board-frame"), document.querySelector("#board-frame")!.classList.contains("of-file"), head()]).toEqual([false, true, true, ["reports/w46.md", "2 KB · t7"]]);
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

  it("ends a file's row with 复制 where the file can be taken whole and 下载 where it is a file, 复制 showing 已复制 for a moment", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { view, backend } = board({ "reports/w46.md": { kind: "file", size: 9, modified: 7, text: "# Week 46" }, "exports/orders.xlsx": { kind: "file", size: 3, modified: 3, bytes: "AQID" } }, { md: MARKDOWN });
      const writeText = vi.fn(async () => {});
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
      const saved: { name: string; blob: Blob }[] = [];
      const made = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => { saved.push({ name: "", blob: blob as Blob }); return "blob:x"; });
      const pressed = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { saved.at(-1)!.name = this.download; });
      const heard = (): string => [...document.querySelectorAll("[role=status]")].map((one) => one.textContent).join("");
      const acts = (): (string | null)[] => [...document.querySelectorAll(".file-head .address-acts button")].map((one) => one.getAttribute("aria-label"));
      const act = (word: string): HTMLButtonElement => [...document.querySelectorAll<HTMLButtonElement>(".file-head .address-acts button")].find((one) => one.getAttribute("aria-label") === word)!;
      await view.read();
      view.openFile("reports/w46.md", "chat");
      await vi.waitFor(() => expect(acts()).toEqual(["Copy", "Download"]));
      expect(document.querySelector(".file-head > button")?.getAttribute("aria-label")).toBe("Reload");
      act("Copy").click();
      await vi.waitFor(() => expect(acts()).toEqual(["Copied", "Download"]));
      vi.advanceTimersByTime(60);
      expect([writeText.mock.calls, heard()]).toEqual([[["# Week 46"]], "Copied"]);
      vi.advanceTimersByTime(1500);
      expect(acts()).toEqual(["Copy", "Download"]);
      act("Download").click();
      await vi.waitFor(() => expect(saved.length).toBe(1));
      expect([saved[0]!.name, await saved[0]!.blob.text()]).toEqual(["w46.md", "# Week 46"]);
      view.openFile("exports/orders.xlsx", "chat");
      await vi.waitFor(() => expect(acts()).toEqual(["Download"]));
      act("Download").click();
      await vi.waitFor(() => expect(saved.length).toBe(2));
      expect([backend.boardOpen.mock.calls.at(-1), saved[1]!.name, [...new Uint8Array(await saved[1]!.blob.arrayBuffer())]]).toEqual([["exports/orders.xlsx", "chat", true], "orders.xlsx", [1, 2, 3]]);
      made.mockRestore();
      pressed.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  /** The clipboard and the browser's saves, stood in for: what was written, and each file saved with its name. */
  function takes() {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const saved: { name: string; blob: Blob }[] = [];
    const made = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => { saved.push({ name: "", blob: blob as Blob }); return "blob:x"; });
    const pressed = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { saved.at(-1)!.name = this.download; });
    const act = (word: string): HTMLButtonElement => [...document.querySelectorAll<HTMLButtonElement>(".file-head button")].find((one) => one.getAttribute("aria-label") === word)!;
    return { writeText, saved, act, restore: () => { made.mockRestore(); pressed.mockRestore(); } };
  }
  const bytesIn = async (blob: Blob): Promise<number[]> => [...new Uint8Array(await blob.arrayBuffer())];

  it("gives at 复制 and 下载 the file as the tab read it last, after 重新加载 drew the same size and time", async () => {
    const files: Record<string, OpenRead> = { "reports/file.md": { kind: "file", size: 3, modified: 7, text: "old" } };
    const { view } = board(files, { md: MARKDOWN });
    const { writeText, saved, act, restore } = takes();
    try {
      await view.read();
      view.openFile("reports/file.md", "chat");
      await vi.waitFor(() => expect(act("Copy")).toBeDefined());
      const buttons = [act("Copy"), act("Download")];
      files["reports/file.md"] = { kind: "file", size: 3, modified: 7, text: "new" };
      act("Reload").click();
      await settle();
      // The row stood: the same size and time drew the same buttons.
      expect([act("Copy"), act("Download")]).toEqual(buttons);
      act("Copy").click();
      await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
      act("Download").click();
      await vi.waitFor(() => expect(saved.length).toBe(1));
      expect([writeText.mock.calls, await saved[0]!.blob.text()]).toEqual([[["new"]], "new"]);
    } finally { restore(); }
  });

  it("downloads a text file as its own bytes, its byte order mark kept, while 复制 takes the words shown", async () => {
    // A CSV that begins with UTF-8's byte order mark: the port's decoder drops it from the words, and the file keeps it.
    const { view, backend } = board({ "exports/orders.csv": { kind: "file", size: 6, modified: 1, text: "a,b", bytes: "77u/YSxi" } }, { csv: MARKDOWN });
    const { writeText, saved, act, restore } = takes();
    try {
      await view.read();
      view.openFile("exports/orders.csv", "chat");
      await vi.waitFor(() => expect(act("Copy")).toBeDefined());
      act("Copy").click();
      await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
      act("Download").click();
      await vi.waitFor(() => expect(saved.length).toBe(1));
      expect([writeText.mock.calls, saved[0]!.name, await bytesIn(saved[0]!.blob), backend.boardOpen.mock.calls.at(-1)]).toEqual([[["a,b"]], "orders.csv", [0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62], ["exports/orders.csv", "chat", true]]);
    } finally { restore(); }
  });

  it("says on the file's tab, in its own line and to a screen reader, a download the box does not hand, and saves nothing", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { view, stats } = board({});
    stats.set("exports/all.zip", { file: "exports/all.zip", size: 3, modified: 3 });
    const { saved, act, restore } = takes();
    try {
      await view.read();
      view.openFile("exports/all.zip", "chat");
      await vi.waitFor(() => expect(act("Download")).toBeDefined());
      act("Download").click();
      await vi.waitFor(() => expect(document.querySelector("#board-file .file-said")?.textContent).toBe("This file could not be found."));
      vi.advanceTimersByTime(60);
      const heard = [...document.querySelectorAll("[role=status]")].map((one) => one.textContent).join("|");
      expect([heard.includes("This file could not be found."), act("Download"), saved.length]).toEqual([true, undefined, 0]);
    } finally { restore(); vi.useRealTimers(); }
  });

  it.each(["gone", "unreadable"] as const)("shows at 重新加载 the HTML file just read, after a download the box did not hand (%s)", async (state) => {
    const path = "plans/restock.html";
    const files: Record<string, OpenRead> = { [path]: { kind: "file", size: 21, modified: 1, text: "<h1>Restock plan</h1>" } };
    const { view } = board(files);
    const { saved, act, restore } = takes();
    try {
      await view.read();
      view.openFile(path, "chat");
      await vi.waitFor(() => expect(act("Download")).toBeDefined());
      ready(frame());
      expect(handed(frame())).toEqual([expect.objectContaining({ cx: "page", html: "<h1>Restock plan</h1>" })]);
      files[path] = { kind: state };
      act("Download").click();
      await vi.waitFor(() => expect(act("Download")).toBeUndefined());
      // The file comes back changed; one 重新加载 shows it as it is now, not the page drawn before the download.
      files[path] = { kind: "file", size: 60, modified: 2, text: "<h1>Revised plan for this week</h1>" };
      act("Reload").click();
      await vi.waitFor(() => expect(act("Download")).toBeDefined());
      ready(frame());
      expect([saved.length, head(), handed(frame())]).toEqual([0, [path, "60 B · t2"], [expect.objectContaining({ cx: "page", html: "<h1>Revised plan for this week</h1>" })]]);
    } finally { restore(); }
  });

  it("draws a card of 待办 whole by 待办's own page, its tab named by the card's title, the page asking for 待办 as its own tab does", async () => {
    const TASKS_BY = { kind: "ours", name: "cx-board-tasks", package: "@comchatx/cx-board-tasks" } as const;
    const CARD = `board/user_2abc/${TASKS_TAB}/todo/restock.md`;
    const text = "---\nkind: question\ntitle: 补货 YM-10-BLU\nat: 2026-11-25T10:00:00.000Z\n---\n要补多少？";
    const backend = {
      board: vi.fn(async (): Promise<BoardRead> => ({ shown: true, tab: TASKS_TAB, tabs: [TASKS_TAB, "Reports"], entries: [], pages: [{ tab: TASKS_TAB, by: TASKS_BY }] })),
      boardOpen: vi.fn(async (): Promise<OpenRead> => ({ kind: "file", size: 40, modified: 5, text })),
      boardViewer: vi.fn(async (): Promise<BoardViewer | undefined> => MARKDOWN),
    };
    const page = vi.fn(async () => ({ html: "<p>inbox</p>", by: TASKS_BY }));
    const asks = { draft: vi.fn(), send: vi.fn(() => "sent" as const), files: vi.fn(async () => [{ file: "todo/restock.md", modified: 5, size: 40, tree: CARD }, { file: "todo/other.md", modified: 4, size: 9, tree: `board/user_2abc/${TASKS_TAB}/todo/other.md` }]), read: vi.fn(async () => text), write: vi.fn(), count: vi.fn(), show: vi.fn(), save: vi.fn(), pressed: vi.fn(), open: vi.fn() };
    const names = new FileNames([{ path: `${TASKS_TAB}/todo/restock.md`, tree: CARD, modified: 5 }, { path: "Reports/w46.md", tree: "board/user_2abc/Reports/w46.md", modified: 1 }]);
    const view = new BoardView({ backend, say, now: () => 1, time: (time) => `t${time}`, clock: String, day: String, changed: () => {}, frame: { origin: PAGES, appOrigin: APP, read: page, asks }, store: memory(), account: () => "a", inSight: () => true, openFile: () => {}, names: () => names }, () => "en");
    document.body.append(view.head, view.page);
    await view.read();
    view.openFile(CARD, "card");
    await settle();
    expect([strip().at(-1), backend.boardViewer.mock.calls, page.mock.calls.map((call) => (call as unknown[])[0])]).toEqual(["补货 YM-10-BLU*#", [], [TASKS_TAB, TASKS_TAB]]);
    const one = frame();
    expect(one?.title).toBe("补货 YM-10-BLU");
    ready(one);
    expect(handed(one)).toEqual([
      { cx: "page", html: "<p>inbox</p>", context: expect.anything() },
      { cx: "file", file: { path: CARD, name: "restock.md", size: 40, modified: 5, text, tab: TASKS_TAB, file: "todo/restock.md" } },
    ]);
    const ask = async (id: number, data: Record<string, unknown>): Promise<unknown> => {
      window.dispatchEvent(new MessageEvent("message", { origin: PAGES, source: one!.contentWindow, data: { cx: "ask", id, ...data } }));
      await settle();
      return (windows.get(one!)?.posted ?? []).map(([sent]) => sent).find((sent) => (sent as { cx?: string; id?: number }).cx === "answer" && (sent as { id: number }).id === id);
    };
    // It answers the card, reads and writes 待办's files and opens one by its path there; the tab's number and its board stay 待办's own page's.
    expect(await ask(1, { verb: "send", text: "补 200 件", card: "todo/restock.md" })).toEqual({ cx: "answer", id: 1, ok: true, value: "sent" });
    expect(asks.send.mock.calls).toEqual([[TASKS_TAB, "补 200 件", "todo/restock.md"]]);
    expect(await ask(2, { verb: "read", file: "todo/restock.md" })).toEqual({ cx: "answer", id: 2, ok: true, value: text });
    expect(await ask(3, { verb: "list" })).toMatchObject({ ok: true });
    expect(await ask(4, { verb: "open", file: "todo/other.md" })).toEqual({ cx: "answer", id: 4, ok: true });
    expect(asks.open.mock.calls).toEqual([[TASKS_TAB, `board/user_2abc/${TASKS_TAB}/todo/other.md`, "todo/other.md"]]);
    expect(await ask(5, { verb: "open", file: "todo/none.md" })).toEqual({ cx: "answer", id: 5, ok: false, reason: "gone" });
    expect([await ask(6, { verb: "count", n: 1 }), await ask(7, { verb: "show", name: "x" })]).toEqual([{ cx: "answer", id: 6, ok: false, reason: "no_tab" }, { cx: "answer", id: 7, ok: false, reason: "no_tab" }]);
    expect([asks.count.mock.calls.length, asks.show.mock.calls.length, asks.read.mock.calls, asks.files.mock.calls.map((call) => (call as unknown[])[0])]).toEqual([0, 0, [[TASKS_TAB, "todo/restock.md"]], [TASKS_TAB, TASKS_TAB, TASKS_TAB]]);
    // A Markdown file of another tab is the viewer's, as before.
    view.openFile("board/user_2abc/Reports/w46.md", "chat");
    await settle();
    expect([strip().at(-1), backend.boardViewer.mock.calls]).toEqual(["w46.md*#", [["md"]]]);
  });

  /** 待办 drawn by its package's page, one card listed in it, and a board whose names are the test's to move. */
  function inbox(names: () => FileNames) {
    const TASKS_BY = { kind: "ours", name: "cx-board-tasks", package: "@comchatx/cx-board-tasks" } as const;
    const CARD = `board/user_2abc/${TASKS_TAB}/todo/restock.md`;
    const text = "---\nkind: question\ntitle: 补货 YM-10-BLU\nat: 2026-11-25T10:00:00.000Z\n---\n要补多少？";
    const at = { modified: 5 };
    const backend = {
      board: vi.fn(async (): Promise<BoardRead> => ({ shown: true, tab: "Reports", tabs: [TASKS_TAB, "Reports"], entries: [], pages: [{ tab: TASKS_TAB, by: TASKS_BY }] })),
      boardOpen: vi.fn(async (): Promise<OpenRead> => ({ kind: "file", size: 40, modified: at.modified, text })),
      boardViewer: vi.fn(async (): Promise<BoardViewer | undefined> => MARKDOWN),
      boardOpened: vi.fn(async (paths: readonly string[]): Promise<readonly OpenedFile[]> => paths.map((file) => ({ file, size: 40, modified: at.modified }))),
    };
    const page = vi.fn(async () => ({ html: "<p>inbox</p>", by: TASKS_BY }));
    const asks = { draft: vi.fn(), send: vi.fn(() => "sent" as const), files: vi.fn(async () => [{ file: "todo/restock.md", modified: at.modified, size: 40, tree: CARD }]), read: vi.fn(async () => text), write: vi.fn(), count: vi.fn(), show: vi.fn(), save: vi.fn(), pressed: vi.fn(), open: vi.fn() };
    const view = new BoardView({ backend, say, now: () => 1, time: (time) => `t${time}`, clock: String, day: String, changed: () => {}, frame: { origin: PAGES, appOrigin: APP, read: page, asks }, store: memory(), account: () => "a", inSight: () => true, openFile: () => {}, names }, () => "en");
    document.body.append(view.head, view.page);
    return { view, backend, asks, at, CARD };
  }
  const answers = (one: HTMLIFrameElement): unknown[] => (windows.get(one)?.posted ?? []).map(([sent]) => sent).filter((sent) => (sent as { cx?: string }).cx === "answer");

  it("loads 待办's page in a new frame where a Markdown viewer's file is read again as a card, the viewer's frame asking nothing of 待办", async () => {
    let names = new FileNames([]);
    const { view, asks, at, CARD } = inbox(() => names);
    await view.read();
    view.openFile(CARD, "chat");
    await settle();
    const viewer = frame()!;
    ready(viewer);
    expect(handed(viewer)[0]).toMatchObject({ cx: "page", html: "<p>viewer</p>" });
    // The card reaches 待办's names and changes: the reread finds it 待办's, drawn by another renderer for another owner.
    names = new FileNames([{ path: `${TASKS_TAB}/todo/restock.md`, tree: CARD, modified: 6 }]);
    at.modified = 6;
    await view.read();
    await settle();
    const card = frame()!;
    expect([card === viewer, viewer.isConnected]).toEqual([false, false]);
    ready(card);
    expect(handed(card)).toEqual([{ cx: "page", html: "<p>inbox</p>", context: expect.anything() }, { cx: "file", file: expect.objectContaining({ tab: TASKS_TAB, file: "todo/restock.md", modified: 6 }) }]);
    window.dispatchEvent(new MessageEvent("message", { origin: PAGES, source: viewer.contentWindow, data: { cx: "ask", id: 1, verb: "list" } }));
    await settle();
    expect([answers(viewer), asks.files.mock.calls.length]).toEqual([[], 0]);
  });

  it("draws a card whole where 待办's own listing named it, before the board's names hold it", async () => {
    const { view, backend, CARD } = inbox(() => new FileNames([]));
    await view.read();
    view.openFile(CARD, "card", { tab: TASKS_TAB, file: "todo/restock.md" });
    await settle();
    const one = frame()!;
    ready(one);
    expect([strip().at(-1), backend.boardViewer.mock.calls, handed(one)[1]]).toEqual(["补货 YM-10-BLU*#", [], { cx: "file", file: expect.objectContaining({ tab: TASKS_TAB, file: "todo/restock.md" }) }]);
  });

  it("draws a card whole where 待办's listing names a file already open as a plain Markdown tab, the file unchanged, and reads nothing again for it after", async () => {
    const { view, backend, CARD } = inbox(() => new FileNames([]));
    await view.read();
    view.openFile(CARD, "chat");
    await settle();
    const viewer = frame()!;
    ready(viewer);
    expect([strip().at(-1), handed(viewer)[0]]).toEqual(["restock.md*#", expect.objectContaining({ cx: "page", html: "<p>viewer</p>" })]);
    // The card pressed in 待办, its row verified: the tab is drawn as the card by 待办's page, with no change to the file.
    view.openFile(CARD, "card", { tab: TASKS_TAB, file: "todo/restock.md" });
    await settle();
    const card = frame()!;
    ready(card);
    expect([strip().at(-1), card === viewer, handed(card)]).toEqual(["补货 YM-10-BLU*#", false, [{ cx: "page", html: "<p>inbox</p>", context: expect.anything() }, { cx: "file", file: expect.objectContaining({ tab: TASKS_TAB, file: "todo/restock.md" }) }]]);
    // Pressed again, the same page for the same owner: nothing is read.
    const opens = backend.boardOpen.mock.calls.length;
    view.openFile(CARD, "card", { tab: TASKS_TAB, file: "todo/restock.md" });
    await settle();
    expect([backend.boardOpen.mock.calls.length, frame()]).toEqual([opens, card]);
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
    expect([said(), head(), shown("#board-frame")]).toEqual(["orders.xlsx | 1.8 MB · t3", ["exports/orders.xlsx", "1.8 MB · t3"], false]);
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
    expect([handed(frame()).at(-1), head()]).toEqual([{ cx: "file", file: { path: "r/w.md", name: "w.md", size: 2, modified: 2, text: "new" } }, ["r/w.md", "2 B · t2"]]);
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

  it("draws a file the board lists named on a card as the file box, whose press asks for the file's tab as pressed on a card", async () => {
    const opened: string[] = [];
    const { view } = board({}, {}, { openFile: (path, from) => opened.push(`${from}:${path}`), body: "See `w46.md`, not `reports/x.md`." });
    await view.read();
    view.showTab("Reports");
    const boxes = document.querySelectorAll<HTMLButtonElement>("#board-pending button.file-open");
    boxes[0]!.click();
    expect([boxes.length, boxes[0]!.dataset["cxFile"], opened]).toEqual([1, "board/user_2abc/Reports/w46.md", ["card:board/user_2abc/Reports/w46.md"]]);
    expect(TASKS_TAB).not.toBe("Reports");
  });
});
