import { describe, expect, it } from "vitest";
import type { BoardEntry } from "../shared/board.js";
import { baseCards, EMPTY_BOARD, withRead, type BoardModel } from "./board-model.js";

const entry = (file: string, kind: string, at: number, more: Partial<Record<string, unknown>> = {}): BoardEntry => ({ file, place: "todo", modified: at, readable: true, kind, title: file, at, body: "", ...more }) as BoardEntry;
const generic = (file: string, modified: number): BoardEntry => ({ file, place: "todo", modified, readable: false, title: file, body: "" });
const base = (todo: readonly BoardEntry[], others: ReadonlyMap<string, readonly BoardEntry[]> = new Map(), tabs: readonly string[] = ["待办", ...others.keys()]): BoardModel => withRead(EMPTY_BOARD, { shown: true, tabs, others, todo });

describe("the base", () => {
  it("draws every file as the base's, 待办's too: each by its title and words at its file's time, its front matter's kind set aside", () => {
    const model = base([entry("choice.md", "choice", 2, { options: ["A"], title: "Which?", body: "Words." }), entry("finding.md", "finding", 5), generic("odd.md", 6)]);
    const cards = baseCards(model.todo);
    expect(cards.map((one) => [one.file, one.readable, one.title])).toEqual([["odd.md", false, "odd.md"], ["finding.md", false, "finding.md"], ["choice.md", false, "Which?"]]);
    expect([cards.at(-1)!.body, "options" in cards.at(-1)!]).toEqual(["Words.", false]);
  });

  it("keeps how and when a file in 待办 says it was done, and draws it a card like any other", () => {
    const model = base([entry("d.md", "proposal", 1, { done: "answered", doneAt: 9, answer: "Go ahead." })]);
    expect(model.todo).toEqual([{ file: "d.md", place: "todo", modified: 1, readable: false, title: "d.md", body: "", done: "answered", doneAt: 9 }]);
  });

  it("holds only the tabs the read names, each its files as the base draws them, and keeps what a read leaves out", () => {
    const model = base([], new Map([["Notes", [entry("n.md", "finding", 3)]], ["Gone", [generic("g.md", 1)]]]), ["待办", "Notes"]);
    expect([[...model.others.keys()], model.others.get("Notes")![0]!.readable]).toEqual([["Notes"], false]);
    const again = withRead(model, { shown: true, todo: [generic("t.md", 4)] });
    expect([again.tabs, [...again.others.keys()], again.todo.map((one) => one.file)]).toEqual([["待办", "Notes"], ["Notes"], ["t.md"]]);
  });

  it("orders a tab's cards the newest first, and by name where two were written at once", () => {
    expect(baseCards([generic("a.md", 1), generic("b.md", 1), generic("c.md", 2)]).map((one) => one.file)).toEqual(["c.md", "b.md", "a.md"]);
  });

  it("knows nothing of a board the account's packages do not show", () => {
    expect(withRead(base([entry("a.md", "finding", 1)]), { shown: false })).toEqual({ ...EMPTY_BOARD, shown: false });
  });
});
