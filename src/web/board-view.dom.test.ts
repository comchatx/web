// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { afterCursor, BOARD_PART, entryCursor, readCursor, TASKS_TAB, writeCursor, type BoardEntry } from "../shared/board.js";
import { BoardRefused, type BoardRead, type BoardTabAsk } from "./backend.js";
import { BoardView } from "./board-view.js";
import type { Off } from "./board-off.js";
import { text, type StringKey } from "./strings.js";

const entry = (file: string, kind: string, at: number, more: Partial<Record<string, unknown>> = {}): BoardEntry => ({ file, place: "todo", modified: at, readable: true, kind, title: `Title of ${file}`, at, body: `Words of **${file}**.`, ...more }) as BoardEntry;
const read = (shown: boolean, entries: readonly BoardEntry[], next?: string): BoardRead => ({ shown, entries, ...(next === undefined ? {} : { next }) });

afterEach(() => { document.body.replaceChildren(); });

function world(places: { todo: BoardEntry[] }, options: { readonly shown?: boolean; readonly fail?: boolean } = {}) {
  const asked: string[] = [];
  const backend = {
    board: vi.fn(async (before?: string): Promise<BoardRead> => {
      asked.push(before === undefined ? "todo" : `todo<${before}`);
      if (options.fail === true) throw new Error("/board answered 503");
      // As the box pages: the rows after the cursor by the one rule, never by finding the cursor's row.
      const all = places.todo.filter((one) => afterCursor(entryCursor(one), before === undefined ? undefined : readCursor(before), false));
      const part = all.slice(0, BOARD_PART);
      return read(options.shown ?? true, part, BOARD_PART < all.length ? writeCursor(entryCursor(part.at(-1)!)) : undefined);
    }),
  };
  const changed = vi.fn();
  const view = new BoardView({
    backend, say: (key: StringKey, values) => text("en", key, values), now: () => 1_000,
    time: (time) => `t${time}`, clock: (time) => `c${time}`, day: (time) => (time >= 100 ? "Today" : "Yesterday"), changed,
  }, () => "en");
  document.body.append(view.head, view.page);
  return { view, backend, asked, changed };
}
const cards = (root: ParentNode = document): string[] => [...root.querySelectorAll<HTMLElement>("#board-pending .board-entry")].map((card) => card.dataset["file"]!);
const words = (selector: string): string[] => [...document.querySelectorAll<HTMLElement>(selector)].filter((one) => !one.closest("[hidden]")).map((one) => one.textContent ?? "");
const card = (file: string): HTMLElement => document.querySelector<HTMLElement>(`#board-pending [data-file="${file}"]`)!;

describe("the board's base", () => {
  it("draws every file of 待办 as one list with no group's name, each its time, title and words, with no views, no press and nothing to answer, and counts nothing", async () => {
    const { view, asked } = world({ todo: [entry("c.md", "choice", 20, { options: ["Red"] }), entry("f.md", "finding", 10), entry("d.md", "proposal", 5, { done: "answered", doneAt: 50, answer: "Go ahead." })] });
    await view.read();
    view.draw();
    const shown = [...document.querySelectorAll<HTMLElement>(".board-section")].filter((one) => !one.hidden);
    expect([cards(), shown.length, shown[0]!.hasAttribute("aria-label"), view.count, asked]).toEqual([["c.md", "f.md", "d.md"], 1, false, 0, ["todo"]]);
    expect([document.querySelector(".board-views"), document.querySelector("#board-done"), document.querySelector(".board-handover")]).toEqual([null, null, null]);
    expect(document.querySelectorAll("#board-pending .board-entry button, #board-pending .board-answer, #board-pending .board-field, #board-pending .board-foot").length).toBe(0);
    // The time is the file's, as the base reads no front matter; a file done says nothing of it.
    expect([document.querySelector('[data-file="c.md"] .board-meta')!.textContent, words('[data-file="c.md"] .board-words').map((one) => one.trim()), card("d.md").querySelector(".board-outcome")]).toEqual(["t20", ["Words of c.md."], null]);
    expect([...document.querySelectorAll("#board-pending .board-entry")].map((one) => one.className)).toEqual(["board-entry board-generic", "board-entry board-generic", "board-entry board-generic"]);
  });

  it("reads every file of 待办, part after part, and nothing done", async () => {
    const many = Array.from({ length: BOARD_PART + 3 }, (_, n) => entry(`f${String(999 - n)}.md`, "finding", 1_000 - n));
    const { view, asked } = world({ todo: many });
    await view.read();
    expect([cards().length, asked.length, asked[1]!.startsWith("todo<")]).toEqual([BOARD_PART + 3, 2, true]);
  });

  it("draws a card kept for the keyboard again when its row's words or title change under the same key, and another version as another card", async () => {
    const places = { todo: [entry("a.md", "finding", 3)] };
    const { view } = world(places);
    await view.read();
    view.draw();
    const kept = card("a.md");
    kept.focus();
    places.todo = [entry("a.md", "finding", 3, { title: "Corrected title", body: "Corrected **words**." })];
    await view.read();
    expect([card("a.md"), document.activeElement]).toEqual([kept, kept]);
    expect([kept.querySelector(".board-meta")!.textContent, kept.querySelector(".board-entry-title")!.textContent, kept.querySelector(".board-words")!.textContent!.trim()]).toEqual(["t3", "Corrected title", "Corrected words."]);
    // A file written again is another version, its own key: its own card.
    places.todo = [entry("a.md", "finding", 9)];
    await view.read();
    expect([document.querySelectorAll('[data-file="a.md"]').length, card("a.md") === kept]).toEqual([1, false]);
  });

  it("hands the keyboard on to the card after a focused one cx wrote again, never to the page, and not to the new version by its name", async () => {
    const places = { todo: [entry("x.md", "finding", 5), entry("a.md", "finding", 3), entry("c.md", "finding", 1)] };
    const { view } = world(places);
    await view.read();
    card("a.md").focus();
    places.todo = [entry("a.md", "finding", 9), entry("x.md", "finding", 5), entry("c.md", "finding", 1)];
    await view.read();
    expect([document.activeElement === document.body, document.activeElement]).toEqual([false, card("c.md")]);
  });

  it("gives two names one escaping would join two ids, and no id twice on the board", async () => {
    const { view } = world({ todo: [entry("a b.md", "finding", 50, { title: "First" }), entry("a_20b.md", "finding", 50, { title: "Second" })] });
    await view.read();
    const named = [card("a b.md"), card("a_20b.md")].map((one) => one.getAttribute("aria-labelledby")!);
    expect([named[0] !== named[1], ...named.map((id) => document.getElementById(id)?.textContent)]).toEqual([true, "First", "Second"]);
    const ids = [...document.querySelectorAll("[id]")].map((one) => one.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("moves only the cards out of order, the longest run in order left standing", async () => {
    const files = ["a.md", "b.md", "c.md", "d.md", "e.md"];
    const places = { todo: files.map((file, at) => entry(file, "finding", 10 - at)) };
    const { view } = world(places);
    await view.read();
    const list = card("a.md").parentElement!;
    const moves = vi.spyOn(list, "insertBefore");
    // a.md written again goes to the head and a new f.md comes between c.md and d.md: two insertions, nothing else touched.
    places.todo = [entry("a.md", "finding", 11), entry("b.md", "finding", 9), entry("c.md", "finding", 8), entry("f.md", "finding", 7.5), entry("d.md", "finding", 7), entry("e.md", "finding", 6)];
    await view.read();
    expect([[...list.children].map((one) => (one as HTMLElement).dataset["file"]), moves.mock.calls.map(([moved]) => (moved as HTMLElement).dataset["file"]).sort()]).toEqual([["a.md", "b.md", "c.md", "f.md", "d.md", "e.md"], ["a.md", "f.md"]]);
  });

  it("says what will come on a board that never held anything", async () => {
    const { view } = world({ todo: [] });
    await view.read();
    expect(words("#board-pending .board-empty")).toEqual(["What cx leaves for you will be here."]);
  });

  it("reads once more when asked while a read runs, keeps what it drew when a read fails, and knows no board the packages do not show", async () => {
    const places = { todo: [entry("a.md", "finding", 3)] };
    const { view, asked } = world(places);
    void view.read();
    await view.read();
    await vi.waitFor(() => expect(asked.filter((one) => one === "todo")).toHaveLength(2));
    const failing = world(places, { fail: true });
    await failing.view.read();
    expect(failing.view.shown).toBeUndefined();
    const hidden = world(places, { shown: false });
    await hidden.view.read();
    expect([hidden.view.shown, hidden.view.count, hidden.asked]).toEqual([false, 0, ["todo"]]);
  });
});

describe("the board's tabs", () => {
  const tabbed = (others: Record<string, BoardEntry[]>, todo: BoardEntry[]) => {
    const tabs = [TASKS_TAB, ...Object.keys(others)].sort();
    const asked: string[] = [];
    const backend = {
      board: vi.fn(async (_before?: string, tab = TASKS_TAB): Promise<BoardRead> => {
        asked.push(tab);
        return { shown: true, tab, tabs, entries: tab === TASKS_TAB ? todo : others[tab] ?? [] };
      }),
    };
    const view = new BoardView({ backend, say: (key: StringKey, values) => text("en", key, values), now: () => 1_000, time: (time) => `t${time}`, clock: (time) => `c${time}`, day: () => "Today", changed: vi.fn() }, () => "en");
    document.body.append(view.head, view.page);
    return { view, asked, backend };
  };
  const strip = (): string[][] => [...document.querySelectorAll<HTMLElement>(".board-tabs [role=tab]")].map((one) => [one.textContent ?? "", one.getAttribute("aria-selected")!]);
  const base = (file: string, modified: number): BoardEntry => ({ file, place: "todo", modified, readable: false, title: `Title of ${file}`, body: "Words." });

  it("draws one tab per directory by name, 待办 current, and a strip of one tab as of many", async () => {
    const one = tabbed({}, [entry("f.md", "finding", 10)]);
    await one.view.read();
    expect([strip(), document.querySelector<HTMLElement>(".board-tabs")!.hidden]).toEqual([[[TASKS_TAB, "true"]], false]);
    document.body.replaceChildren();
    const { view, asked } = tabbed({ Reports: [base("r.md", 5), base("q.md", 7)], Watch: [] }, [entry("f.md", "finding", 10)]);
    await view.read();
    expect([strip(), view.tab, asked, view.count]).toEqual([[["Reports", "false"], ["Watch", "false"], [TASKS_TAB, "true"]], TASKS_TAB, [TASKS_TAB, "Reports", "Watch"], 0]);
  });

  it("draws each tab as its cards in the one pane, 待办 as any other, the keyboard going between tabs at the arrows", async () => {
    const { view } = tabbed({ Reports: [base("r.md", 5), base("q.md", 7)], Watch: [] }, [entry("f.md", "finding", 10)]);
    await view.read();
    document.querySelector<HTMLButtonElement>(".board-tabs [role=tab]")!.click();
    expect([view.tab, cards()]).toEqual(["Reports", ["q.md", "r.md"]]);
    expect([document.querySelector<HTMLElement>("#board-pending")!.hidden, document.querySelector<HTMLElement>("#board-pending")!.getAttribute("aria-labelledby"), document.querySelector(".board-section[aria-label]")]).toEqual([false, "board-tab-Reports", null]);
    expect([...document.querySelectorAll(".board-tabs [role=tab]")].map((one) => one.getAttribute("aria-controls"))).toEqual(["board-pending", "board-pending", "board-pending"]);
    // An empty tab says what the base's empty list says.
    view.showTab("Watch");
    expect([cards().length, document.querySelector<HTMLElement>("#board-pending .board-empty")!.hidden, document.querySelector("#board-pending .board-empty")!.textContent]).toEqual([0, false, text("en", "board.neverYet")]);
    view.showTab("Reports");
    const row = document.querySelector<HTMLElement>(".board-tabs")!;
    document.querySelector<HTMLButtonElement>(".board-tabs [aria-selected=true]")!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect([view.tab, row.contains(document.activeElement), cards(), view.landing]).toEqual([TASKS_TAB, true, ["f.md"], document.activeElement]);
  });

  it("shows a tab at one of its cards a chat's row names, the card scrolled to and holding the keyboard", async () => {
    const { view } = tabbed({ Reports: [base("r.md", 5), base("q/deep.md", 7)] }, [entry("f.md", "finding", 10)]);
    await view.read();
    view.focusCard("Reports", "q/deep.md");
    expect([view.tab, (document.activeElement as HTMLElement).dataset["file"]]).toEqual(["Reports", "q/deep.md"]);
  });

  it("goes to 待办 for a tab the board does not hold", async () => {
    const { view } = tabbed({ Reports: [base("r.md", 5)] }, [entry("p.md", "proposal", 10)]);
    await view.read();
    view.showTab("Nowhere");
    expect(view.tab).toBe(TASKS_TAB);
  });
});

describe("the base's own boards at the strip", () => {
  const card = (file: string, modified: number): BoardEntry => ({ file, place: "todo", modified, readable: false, title: `Title of ${file}`, body: "Words." });
  const own = (boards: Record<string, BoardEntry[]>, options: { readonly pages?: BoardRead["pages"]; readonly keptAt?: number; readonly store?: Map<string, string> } = {}) => {
    const held = new Map(Object.entries(boards));
    const refuse: { next: BoardRefused | undefined } = { next: undefined };
    // Held, a change answers only once the test lets it: as a box a few hops away answers.
    const late: { hold: PromiseWithResolvers<void> | undefined } = { hold: undefined };
    const backend = {
      board: vi.fn(async (_before?: string, tab = TASKS_TAB): Promise<BoardRead> => {
        const tabs = [...held.keys()].sort();
        return { shown: true, tab, tabs, entries: held.get(tab) ?? [], ...(options.pages === undefined ? {} : { pages: options.pages }), ...(options.keptAt === undefined ? {} : { keptAt: options.keptAt }) };
      }),
      boardTab: vi.fn(async (ask: BoardTabAsk): Promise<void> => {
        if (late.hold !== undefined) await late.hold.promise;
        const refused = refuse.next;
        refuse.next = undefined;
        if (refused !== undefined) throw refused;
        if (ask.op === "make") held.set(ask.tab, []);
        if (ask.op === "rename") { held.set(ask.to, held.get(ask.tab)!); held.delete(ask.tab); }
        if (ask.op === "delete") held.delete(ask.tab);
      }),
    };
    const store = options.store ?? new Map<string, string>();
    const storage = { keys: () => [...store.keys()], read: (key: string) => store.get(key) ?? null, write: (key: string, value: string) => { store.set(key, value); }, remove: (key: string) => { store.delete(key); } };
    const sight = { open: false };
    const changed = vi.fn();
    const view = new BoardView({ backend, say: (key: StringKey, values) => text("en", key, values), now: () => 1_000, time: (time) => `t${time}`, clock: (time) => `c${time}`, day: () => "Today", changed, store: storage, account: () => "acct-1", inSight: () => sight.open }, () => "en");
    document.body.append(view.head, view.page);
    return { view, backend, held, refuse, late, sight, changed, store };
  };
  const tabNamed = (name: string): HTMLButtonElement => [...document.querySelectorAll<HTMLButtonElement>(".board-tabs [role=tab]")].find((one) => one.querySelector(".tab-label")!.textContent === name)!;
  const names = (): string[] => [...document.querySelectorAll<HTMLElement>(".board-tabs [role=tab] .tab-label")].map((one) => one.textContent!);
  const key = (target: Element, name: string): void => { target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true })); };
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
  const note = (): string | null => { const one = document.querySelector<HTMLElement>(".tab-note"); return one === null || one.hidden ? null : one.textContent; };

  it("makes 「Board {n}」 at the plus by the lowest number no board has, shows it empty, and gives its tab the keyboard", async () => {
    const { view, backend } = own({ [TASKS_TAB]: [entry("f.md", "finding", 10)], "Board 1": [], "Board 3": [] });
    await view.read();
    const plus = document.querySelector<HTMLButtonElement>(".board-add")!;
    expect([plus.hidden, plus.getAttribute("aria-label")]).toEqual([false, "New board"]);
    plus.click();
    await settle();
    expect(backend.boardTab).toHaveBeenCalledWith({ op: "make", tab: "Board 2" });
    expect([view.tab, names(), document.activeElement]).toEqual(["Board 2", ["Board 1", "Board 2", "Board 3", TASKS_TAB], tabNamed("Board 2")]);
    expect(document.querySelector("#board-pending .board-empty:not([hidden])")!.textContent).toBe(text("en", "board.neverYet"));
  });

  it("draws a board made at the plus before the box answers and reads nothing once it does; a board the box does not make is taken back, the name said", async () => {
    const { view, backend, late, refuse } = own({ [TASKS_TAB]: [], Reports: [card("r.md", 5)] });
    await view.read();
    view.showTab("Reports");
    const reads = backend.board.mock.calls.length;
    late.hold = Promise.withResolvers<void>();
    document.querySelector<HTMLButtonElement>(".board-add")!.click();
    await settle();
    expect([view.tab, names(), document.activeElement]).toEqual(["Board 1", ["Board 1", "Reports", TASKS_TAB], tabNamed("Board 1")]);
    late.hold.resolve();
    await settle();
    expect([view.tab, names(), backend.board.mock.calls.length - reads]).toEqual(["Board 1", ["Board 1", "Reports", TASKS_TAB], 0]);
    view.showTab("Reports");
    late.hold = Promise.withResolvers<void>();
    refuse.next = new BoardRefused("name_taken");
    document.querySelector<HTMLButtonElement>(".board-add")!.click();
    await settle();
    expect([view.tab, names()]).toEqual(["Board 2", ["Board 1", "Board 2", "Reports", TASKS_TAB]]);
    late.hold.resolve();
    await settle();
    expect([view.tab, names(), document.activeElement, note()]).toEqual(["Reports", ["Board 1", "Reports", TASKS_TAB], document.querySelector(".board-add"), text("en", "base.nameTaken")]);
  });

  it("takes a deleted board away at 删除 before the box answers and reads nothing once it does; one the box refuses comes back with the card saying why", async () => {
    const { view, backend, late, refuse, held } = own({ [TASKS_TAB]: [], Reports: [card("r.md", 5)], Watch: [card("w.md", 3)] });
    await view.read();
    view.showTab("Reports");
    const ask = (): HTMLDialogElement | null => document.querySelector<HTMLDialogElement>("dialog.tab-ask");
    const press = (): void => { [...ask()!.querySelectorAll("button")].find((one) => one.textContent === "Delete")!.click(); };
    late.hold = Promise.withResolvers<void>();
    refuse.next = new BoardRefused("busy");
    key(tabNamed("Reports"), "Delete");
    press();
    await settle();
    expect([ask(), names(), view.tab, document.activeElement]).toEqual([null, ["Watch", TASKS_TAB], "Watch", tabNamed("Watch")]);
    late.hold.resolve();
    await settle();
    expect([names(), view.tab, ask()!.querySelector("#board-del-what")!.textContent, held.has("Reports")]).toEqual([["Reports", "Watch", TASKS_TAB], "Reports", "cx is updating this board. Try again later.", true]);
    const reads = backend.board.mock.calls.length;
    late.hold = Promise.withResolvers<void>();
    press();
    await settle();
    expect([ask(), names()]).toEqual([null, ["Watch", TASKS_TAB]]);
    late.hold.resolve();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect([names(), view.tab, held.has("Reports"), backend.board.mock.calls.length - reads, view.page.querySelector(".unseen[role=status]")!.textContent]).toEqual([["Watch", TASKS_TAB], "Watch", false, 0, "Deleted “Reports”."]);
  });

  it("renames in place: a double press, F2 or Enter makes the name a selected field; Enter or leaving it keeps it, Escape and an empty name do not", async () => {
    const { view, backend } = own({ [TASKS_TAB]: [], Reports: [card("r.md", 5)] });
    await view.read();
    const field = (): HTMLInputElement => document.querySelector<HTMLInputElement>(".tab-rename:not([hidden])")!;
    tabNamed("Reports").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect([view.tab, field().value, field().selectionStart, field().selectionEnd, document.activeElement]).toEqual(["Reports", "Reports", 0, 7, field()]);
    field().value = "Weekly";
    key(field(), "Escape");
    await settle();
    expect([names(), backend.boardTab.mock.calls.length, document.activeElement]).toEqual([["Reports", TASKS_TAB], 0, tabNamed("Reports")]);
    key(tabNamed("Reports"), "F2");
    field().value = "   ";
    key(field(), "Enter");
    await settle();
    expect([names(), backend.boardTab.mock.calls.length]).toEqual([["Reports", TASKS_TAB], 0]);
    key(tabNamed("Reports"), "Enter");
    field().value = " Weekly ";
    key(field(), "Enter");
    await settle();
    expect(backend.boardTab).toHaveBeenLastCalledWith({ op: "rename", tab: "Reports", to: "Weekly" });
    expect([names(), view.tab, document.activeElement]).toEqual([[TASKS_TAB, "Weekly"].sort(), "Weekly", tabNamed("Weekly")]);
    key(tabNamed("Weekly"), "F2");
    field().value = "Monthly";
    field().dispatchEvent(new FocusEvent("blur"));
    await settle();
    expect([names(), view.tab]).toEqual([["Monthly", TASKS_TAB], "Monthly"]);
  });

  it("says under the field a name taken, a slash or a leading dot, the box's refusal of a name taken meanwhile too, and takes no name for a plugin's", async () => {
    const { view, backend, refuse } = own({ [TASKS_TAB]: [], Reports: [], Watch: [], Restock: [] }, { pages: [{ tab: "Restock", by: { kind: "third", name: "example-restock" } }] });
    await view.read();
    const field = (): HTMLInputElement => document.querySelector<HTMLInputElement>(".tab-rename:not([hidden])")!;
    view.showTab("Reports");
    key(tabNamed("Reports"), "F2");
    for (const [typed, said] of [["Watch", "Name already in use"], ["a/b", "A name can't contain / or \\"], [".x", "A name can't start with a dot"]] as const) {
      field().value = typed;
      field().dispatchEvent(new Event("input"));
      expect([note(), field().getAttribute("aria-invalid")]).toEqual([said, "true"]);
      key(field(), "Enter");
      await settle();
      expect([document.activeElement, backend.boardTab.mock.calls.length, note()]).toEqual([field(), 0, said]);
    }
    field().value = "Later";
    field().dispatchEvent(new Event("input"));
    expect(note()).toBeNull();
    refuse.next = new BoardRefused("name_taken");
    key(field(), "Enter");
    await settle();
    expect([note(), document.activeElement]).toEqual(["Name already in use", field()]);
    // Leaving a name that cannot be taken puts the old one back.
    field().value = "Watch";
    field().dispatchEvent(new FocusEvent("blur"));
    await settle();
    expect([names(), note()]).toEqual([["Reports", "Restock", "Watch", TASKS_TAB], null]);
    // A name a package's board holds is refused as a held one is: said under the field, and at the plus for a board made.
    refuse.next = new BoardRefused("name_taken");
    key(tabNamed("Reports"), "F2");
    field().value = "Elsewhere";
    field().dispatchEvent(new Event("input"));
    key(field(), "Enter");
    await settle();
    expect([note(), document.activeElement]).toEqual(["Name already in use", field()]);
    key(field(), "Escape");
    await settle();
    expect(note()).toBeNull();
    refuse.next = new BoardRefused("name_taken");
    document.querySelector<HTMLButtonElement>(".board-add")!.click();
    await settle();
    expect([note(), names()]).toEqual(["Name already in use", ["Reports", "Restock", "Watch", TASKS_TAB]]);
    key(tabNamed("Reports"), "F2");
    expect(note()).toBeNull();
    key(field(), "Escape");
    await settle();
    for (const tab of ["Restock"]) {
      view.showTab(tab);
      tabNamed(tab).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      key(tabNamed(tab), "F2");
      key(tabNamed(tab), "Delete");
      expect([document.querySelector(".tab-rename:not([hidden])"), tabNamed(tab).parentElement!.querySelector<HTMLElement>(".tab-close")!.hidden, document.querySelector("dialog.tab-ask")]).toEqual([null, true, null]);
    }
  });

  it("asks before a delete at the tab with the name and the count of cards, the keyboard on Cancel; Escape and a press outside are Cancel", async () => {
    const { view, backend } = own({ [TASKS_TAB]: [], Reports: [card("r.md", 5), card("q.md", 7)], Watch: [card("w.md", 3)] });
    await view.read();
    view.showTab("Reports");
    const close = tabNamed("Reports").parentElement!.querySelector<HTMLButtonElement>(".tab-close")!;
    expect([close.hidden, close.getAttribute("aria-label"), tabNamed("Watch").parentElement!.querySelector<HTMLElement>(".tab-close")!.hidden]).toEqual([false, "Delete “Reports”", true]);
    close.click();
    const ask = (): HTMLDialogElement | null => document.querySelector<HTMLDialogElement>("dialog.tab-ask");
    expect([ask()!.querySelector("h2")!.textContent, ask()!.querySelector("#board-del-what")!.textContent, document.activeElement!.textContent]).toEqual(["Delete “Reports”?", "Its 2 cards are deleted too.", "Cancel"]);
    key(ask()!, "Escape");
    expect([ask(), backend.boardTab.mock.calls.length, document.activeElement]).toEqual([null, 0, tabNamed("Reports")]);
    key(tabNamed("Reports"), "Delete");
    ask()!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: -50, clientY: -50 }));
    expect([ask(), backend.boardTab.mock.calls.length]).toEqual([null, 0]);
    key(tabNamed("Reports"), "Delete");
    [...ask()!.querySelectorAll("button")].find((one) => one.textContent === "Cancel")!.click();
    expect([ask(), backend.boardTab.mock.calls.length]).toEqual([null, 0]);
  });

  it("deletes at 删除, saying so and showing the next board; a board changed since says so and counts again, and one cx is writing waits", async () => {
    const { view, backend, refuse, held } = own({ [TASKS_TAB]: [], Reports: [card("r.md", 5), card("q.md", 7)], Watch: [card("w.md", 3)] });
    await view.read();
    view.showTab("Reports");
    key(tabNamed("Reports"), "Delete");
    const ask = (): HTMLDialogElement | null => document.querySelector<HTMLDialogElement>("dialog.tab-ask");
    const press = (): void => { [...ask()!.querySelectorAll("button")].find((one) => one.textContent === "Delete")!.click(); };
    refuse.next = new BoardRefused("busy");
    press();
    await settle();
    expect([ask()!.querySelector("#board-del-what")!.textContent, held.has("Reports")]).toEqual(["cx is updating this board. Try again later.", true]);
    expect(backend.boardTab).toHaveBeenLastCalledWith({ op: "delete", tab: "Reports", n: 2, newest: 7 });
    held.set("Reports", [card("s.md", 9), card("r.md", 5), card("q.md", 7)]);
    refuse.next = new BoardRefused("changed", { n: 3, newest: 9 });
    press();
    await settle();
    expect(ask()!.querySelector("#board-del-what")!.textContent).toBe("This board has changed. Its 3 cards are deleted too.");
    press();
    await settle();
    expect(backend.boardTab).toHaveBeenLastCalledWith({ op: "delete", tab: "Reports", n: 3, newest: 9 });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect([ask(), names(), view.tab, document.activeElement, view.page.querySelector(".unseen[role=status]")!.textContent]).toEqual([null, ["Watch", TASKS_TAB], "Watch", tabNamed("Watch"), "Deleted “Reports”."]);
  });

  it("draws no plus, no × and no field while cx's computer sleeps and the board is a kept read", async () => {
    const { view } = own({ [TASKS_TAB]: [], Reports: [] }, { keptAt: 500 });
    await view.read();
    view.showTab("Reports");
    key(tabNamed("Reports"), "F2");
    expect([document.querySelector<HTMLElement>(".board-add")!.hidden, tabNamed("Reports").parentElement!.querySelector<HTMLElement>(".tab-close")!.hidden, document.querySelector(".tab-rename:not([hidden])")]).toEqual([true, true, null]);
  });

  it("gives a board of the base's own the dot for a file landed since the seller last had it in sight, and takes it away once seen", async () => {
    const store = new Map<string, string>();
    const { view, held, sight } = own({ [TASKS_TAB]: [], Reports: [card("r.md", 5)] }, { store });
    await view.read();
    view.draw();
    // Met the first time, a board is seen as it stands.
    expect([view.fresh, tabNamed("Reports").querySelector<HTMLElement>(".tab-dot")!.hidden]).toEqual([false, true]);
    held.set("Reports", [card("n.md", 9), card("r.md", 5)]);
    await view.read();
    expect([view.fresh, view.count, view.countName, tabNamed("Reports").querySelector<HTMLElement>(".tab-dot")!.hidden, tabNamed("Reports").getAttribute("aria-label")]).toEqual([true, 0, "Board, new", false, "Reports, new"]);
    // Shown with the column shut is not seen; shown in sight is.
    view.showTab("Reports");
    expect(view.fresh).toBe(true);
    sight.open = true;
    view.draw();
    expect([view.fresh, tabNamed("Reports").querySelector<HTMLElement>(".tab-dot")!.hidden, JSON.parse(store.get("cmx-board-seen:acct-1")!)]).toEqual([false, true, { [TASKS_TAB]: 0, Reports: 9 }]);
  });

  it("gives the dot to a board first met after the visit's first read, a file already in it, on its tab and the icon, until the seller has it in sight (V1)", async () => {
    const store = new Map<string, string>();
    const { view, held, sight } = own({ [TASKS_TAB]: [], Reports: [card("r.md", 5)] }, { store });
    await view.read();
    view.draw();
    held.set("Competitors", [card("c.md", 20)]);
    held.set("Empty", []);
    await view.read();
    view.draw();
    const dot = (tab: string): boolean => !tabNamed(tab).querySelector<HTMLElement>(".tab-dot")!.hidden;
    expect([view.fresh, view.countName, dot("Competitors"), tabNamed("Competitors").getAttribute("aria-label"), dot("Reports"), dot("Empty")]).toEqual([true, "Board, new", true, "Competitors, new", false, false]);
    view.showTab("Competitors");
    sight.open = true;
    view.draw();
    expect([view.fresh, dot("Competitors"), JSON.parse(store.get("cmx-board-seen:acct-1")!)]).toEqual([false, false, { [TASKS_TAB]: 0, Reports: 5, Competitors: 20, Empty: 0 }]);
  });

  it("marks nothing while the box sleeps: once it wakes, a board the visit listed is seen as it stands, and nothing landed gives no dot (V2)", async () => {
    const store = new Map<string, string>();
    const options: { store: Map<string, string>; keptAt?: number } = { store, keptAt: 500 };
    const { view, backend } = own({ [TASKS_TAB]: [], Reports: [card("r.md", 5)], Notes: [card("n.md", 7)] }, options);
    const live = backend.board.getMockImplementation()!;
    let asleep = true;
    backend.board.mockImplementation(async (before, tab = TASKS_TAB) => {
      if (asleep && tab !== TASKS_TAB) throw new Error("box_not_running");
      return live(before, tab);
    });
    await view.read();
    view.draw();
    expect([view.fresh, store.get("cmx-board-seen:acct-1")]).toEqual([false, undefined]);
    asleep = false;
    delete options.keptAt;
    await view.read();
    view.draw();
    const dot = (tab: string): boolean => !tabNamed(tab).querySelector<HTMLElement>(".tab-dot")!.hidden;
    expect([view.fresh, view.countName, dot("Reports"), dot("Notes"), JSON.parse(store.get("cmx-board-seen:acct-1")!)]).toEqual([false, "Board", false, false, { [TASKS_TAB]: 0, Reports: 5, Notes: 7 }]);
  });

  it("takes a board whose own read failed at the visit's first read as seen as it stands when its read comes back, nothing landed (V3)", async () => {
    const store = new Map<string, string>();
    const { view, backend } = own({ [TASKS_TAB]: [], Reports: [card("r.md", 5)], Notes: [card("n.md", 7)] }, { store });
    const live = backend.board.getMockImplementation()!;
    let failNotes = true;
    backend.board.mockImplementation(async (before, tab = TASKS_TAB) => {
      if (failNotes && tab === "Notes") throw new Error("board_unreadable");
      return live(before, tab);
    });
    await view.read();
    view.draw();
    failNotes = false;
    await view.read();
    view.draw();
    expect([view.fresh, !tabNamed("Notes").querySelector<HTMLElement>(".tab-dot")!.hidden, JSON.parse(store.get("cmx-board-seen:acct-1")!)]).toEqual([false, false, { [TASKS_TAB]: 0, Reports: 5, Notes: 7 }]);
  });
});

describe("a file the board cannot draw", () => {
  const unshown = (file: string, at: number, why: "large" | "unreadable" | undefined, more: Partial<Record<string, unknown>> = {}): BoardEntry => ({ file, place: "todo", modified: at, readable: false, title: file, body: "", ...(why === undefined ? {} : { unshown: why }), ...more }) as BoardEntry;
  const line = (file: string, selector: string): string | null => { const one = document.querySelector<HTMLElement>(`[data-file="${file}"] ${selector}`); return one === null || one.hidden ? null : one.textContent; };

  it("says in the words' place why a file is not drawn on its card", async () => {
    const base = world({ todo: [unshown("big.md", 10, "large"), unshown("locked.md", 9, "unreadable"), unshown("old.md", 8, undefined), entry("f.md", "finding", 7)] });
    await base.view.read();
    expect([line("big.md", ".board-unshown"), line("locked.md", ".board-unshown"), line("old.md", ".board-unshown"), line("f.md", ".board-unshown")]).toEqual(["This file is too large to show.", "This file can't be read.", null, null]);
    expect(document.querySelector('[data-file="big.md"] .board-unshown')!.previousElementSibling!.classList.contains("board-entry-title")).toBe(true);
  });
});

describe("the board while cx's computer is off", () => {
  function offWorld(off: { now: Off | undefined }, unread: readonly string[] = []) {
    const backend = {
      board: vi.fn(async (_before?: string, tab?: string): Promise<BoardRead> => {
        if (tab !== undefined && unread.includes(tab)) throw new Error("/board answered 503 box_not_running");
        return { ...read(true, [entry("20261101-0900-a.md", "finding", 5)]), tab: TASKS_TAB, tabs: ["Notes", TASKS_TAB] };
      }),
      boardTab: vi.fn(async (): Promise<void> => undefined),
    };
    const wake = vi.fn();
    const view = new BoardView({
      backend, say: (key: StringKey, values) => text("en", key, values), now: () => 1_000, time: (time) => `t${time}`, clock: (time) => `c${time}`, day: () => "Today", changed: () => {},
      computer: { off: () => off.now, wake, help: "mailto:help@example.com", floor: () => ["Balance too low."] },
    }, () => "en");
    document.body.append(view.head, view.page);
    return { view, wake };
  }
  const place = (): HTMLElement => document.querySelector<HTMLElement>(".board-off")!;
  /** The seller's system asking for less transparency, which takes the glass away: way A. */
  const lessGlass = (less: boolean): void => { vi.stubGlobal("matchMedia", (query: string) => ({ matches: less && query.includes("prefers-reduced-transparency"), media: query, addEventListener: () => {}, removeEventListener: () => {} })); };
  afterEach(() => { vi.unstubAllGlobals(); });

  it("puts the one line and the press in the board's place, the strip standing, and nothing of a board drawn, made or handed over, where there is no glass", async () => {
    lessGlass(true);
    const off = { now: undefined as Off | undefined };
    const { view, wake } = offWorld(off);
    await view.read();
    expect([cards(), place().hidden]).toEqual([["20261101-0900-a.md"], true]);
    off.now = "off";
    view.draw();
    expect([cards().length > 0 && !document.querySelector("#board-pending")!.closest("[hidden]"), place().hidden]).toEqual([false, false]);
    expect(words(".board-off .off-line, .board-off button")).toEqual(["Switch on to see the board", "Switch on"]);
    expect(words(".board-tabs [role=tab] .tab-label")).toEqual(["Notes", "待办"]);
    expect(document.querySelector<HTMLElement>(".board-add")!.hidden).toBe(true);
    place().querySelector<HTMLButtonElement>("button")!.click();
    expect(wake).toHaveBeenCalledTimes(1);
    off.now = "starting";
    view.draw();
    expect([words(".board-off .off-line, .board-off button"), place().querySelector(".off-shape")!.closest("[hidden]")]).toEqual([[], null]);
    off.now = undefined;
    view.draw();
    expect([place().hidden, document.querySelector("#board-pending")!.closest("[hidden]")]).toEqual([true, null]);
  });

  it("takes the keyboard from a card to the place as the computer goes off, never to the press, and gives it to the tab as it comes on", async () => {
    lessGlass(false);
    const off = { now: undefined as Off | undefined };
    const { view } = offWorld(off);
    await view.read();
    view.draw();
    document.querySelector<HTMLElement>("#board-pending .board-entry")!.focus();
    expect(document.querySelector("#board-pending")!.contains(document.activeElement)).toBe(true);
    off.now = "off";
    view.draw();
    expect(document.activeElement).toBe(place());
    off.now = undefined;
    view.draw();
    expect(document.activeElement?.getAttribute("role")).toBe("tab");
    expect(document.activeElement?.textContent).toContain("待办");
  });
  it("keeps the board the page holds drawn under the glass, out of reach of a press, a key and a screen reader, and clears it as the computer comes on", async () => {
    lessGlass(false);
    const off = { now: undefined as Off | undefined };
    const { view } = offWorld(off);
    await view.read();
    view.draw();
    const body = document.querySelector<HTMLElement>(".board-body")!;
    const pending = document.querySelector<HTMLElement>("#board-pending")!;
    off.now = "off";
    view.draw();
    expect([body.classList.contains("under-glass"), pending.hidden, pending.inert, pending.getAttribute("aria-hidden"), cards()]).toEqual([true, false, true, "true", ["20261101-0900-a.md"]]);
    expect([place().classList.contains("glass"), place().querySelector<HTMLElement>(".off-glass")!.hidden, place().querySelector<HTMLElement>(".off-shape")!.hidden]).toEqual([true, false, true]);
    expect(words(".board-off .off-line, .board-off button")).toEqual(["Switch on to see the board", "Switch on"]);
    off.now = "starting";
    view.draw();
    expect([body.classList.contains("starting"), words(".board-off .off-line, .board-off button")]).toEqual([true, []]);
    off.now = undefined;
    view.draw();
    expect([body.classList.contains("under-glass"), body.classList.contains("unglass"), pending.inert, pending.hasAttribute("aria-hidden")]).toEqual([false, true, false, false]);
    body.dispatchEvent(Object.assign(new Event("animationend", { bubbles: true }), { animationName: "off-unglass" }));
    expect(body.classList.contains("unglass")).toBe(false);
  });

  it("draws the board's shape under the glass on a board the page has never read, and no glass where the system asks for less transparency", async () => {
    lessGlass(false);
    const off = { now: "off" as Off | undefined };
    const { view } = offWorld(off, ["Notes"]);
    await view.read();
    view.showTab("Notes");
    view.draw();
    const shape = place().querySelector<HTMLElement>(".off-shape")!;
    expect([place().classList.contains("glass"), shape.hidden, shape.querySelectorAll(".off-sk-card").length, document.querySelector(".board-body")!.classList.contains("under-glass")]).toEqual([true, false, 12, false]);
    lessGlass(true);
    view.draw();
    expect([place().classList.contains("glass"), shape.hidden, place().querySelector<HTMLElement>(".off-glass")!.hidden]).toEqual([false, true, true]);
  });
  it("says once that the computer is on, in place of the start's sentence, the keyboard going from the press to the place and on to the tab", async () => {
    vi.useFakeTimers();
    try {
      lessGlass(false);
      const off = { now: "off" as Off | undefined };
      const { view, wake } = offWorld(off);
      await view.read();
      view.draw();
      const go = place().querySelector<HTMLButtonElement>("button")!;
      go.focus();
      go.click();
      expect(wake).toHaveBeenCalledTimes(1);
      off.now = "starting";
      view.draw();
      expect([document.activeElement, place().querySelector("[role=status]")!.textContent]).toEqual([place(), "cx's computer is switching on"]);
      off.now = undefined;
      view.draw();
      await vi.advanceTimersByTimeAsync(100);
      const said = [...document.querySelectorAll<HTMLElement>(".board-page > [role=status]")].map((one) => one.textContent);
      expect([said, document.activeElement?.getAttribute("role"), place().hidden]).toEqual([["cx's computer is on"], "tab", true]);
      view.draw();
      await vi.advanceTimersByTimeAsync(100);
      expect([...document.querySelectorAll<HTMLElement>(".board-page > [role=status]")].map((one) => one.textContent)).toEqual(["cx's computer is on"]);
      // Said once, then gone: a page switched to the other language later reads no line left in this one.
      await vi.advanceTimersByTimeAsync(1500);
      expect([...document.querySelectorAll<HTMLElement>(".board-page > [role=status]")].map((one) => one.textContent)).toEqual([""]);
    } finally { vi.useRealTimers(); }
  });

  it("offers no 删除 on a board while the computer is off, by the ✕ or by Delete, as it offers no 新建看板", async () => {
    lessGlass(false);
    const off = { now: undefined as Off | undefined };
    const { view } = offWorld(off);
    await view.read();
    view.showTab("Notes");
    const close = (): HTMLElement => [...document.querySelectorAll<HTMLElement>(".board-tabs .tab-close")].find((one) => !one.hidden) ?? document.createElement("i");
    expect(close().classList.contains("tab-close")).toBe(true);
    off.now = "off";
    view.draw();
    expect(close().classList.contains("tab-close")).toBe(false);
    const tab = [...document.querySelectorAll<HTMLElement>(".board-tabs [role=tab]")].find((one) => one.textContent?.includes("Notes"))!;
    tab.focus();
    tab.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect(document.querySelector("dialog.tab-ask")).toBeNull();
  });
  it("opens no board's name for change while the computer is off, by F2, Enter or a double click, and opens it again once it is on", async () => {
    lessGlass(false);
    const off = { now: undefined as Off | undefined };
    const { view } = offWorld(off);
    await view.read();
    view.showTab("Notes");
    off.now = "off";
    view.draw();
    const tab = (): HTMLElement => [...document.querySelectorAll<HTMLElement>(".board-tabs [role=tab]")].find((one) => one.textContent?.includes("Notes"))!;
    const field = (): HTMLInputElement | undefined => [...document.querySelectorAll<HTMLInputElement>(".board-tabs input")].find((one) => !one.hidden);
    tab().focus();
    for (const key of ["F2", "Enter"]) tab().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    tab().dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(field()).toBeUndefined();
    off.now = undefined;
    view.draw();
    tab().dispatchEvent(new KeyboardEvent("keydown", { key: "F2", bubbles: true }));
    expect(field()).toBeDefined();
  });
});
