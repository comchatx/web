// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fall } from "./board-fall.js";

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

const list = (heights: readonly number[], columns: string, gap = "12px"): HTMLElement => {
  const made = document.createElement("div");
  for (const tall of heights) {
    const card = document.createElement("article");
    card.getBoundingClientRect = () => ({ height: tall }) as DOMRect;
    made.append(card);
  }
  made.getClientRects = () => [{}] as unknown as DOMRectList;
  document.body.append(made);
  vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({ display: "grid", gridTemplateColumns: columns, columnGap: gap }) as CSSStyleDeclaration);
  return made;
};
const placed = (made: HTMLElement): string[][] => [...made.children].map((card) => [(card as HTMLElement).style.gridColumn, (card as HTMLElement).style.gridRow]);

describe("a board's cards as a waterfall", () => {
  it("gives each card, in the board's order, to the column shortest so far, its rows its height and the gap", () => {
    const made = list([100, 40, 30, 50], "300px 300px");
    fall(made);
    expect([made.classList.contains("fall"), placed(made)]).toEqual([true, [["1", "1 / span 112"], ["2", "1 / span 52"], ["2", "53 / span 42"], ["2", "95 / span 62"]]]);
  });

  it("lays out as it stands a list of one column, of one card, or not drawn, and clears what an earlier fall set", () => {
    const made = list([100, 40, 30], "300px 300px");
    fall(made);
    vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({ display: "grid", gridTemplateColumns: "600px", columnGap: "12px" }) as CSSStyleDeclaration);
    fall(made);
    expect([made.classList.contains("fall"), placed(made)]).toEqual([false, [["", ""], ["", ""], ["", ""]]]);
    const one = list([100], "300px 300px");
    fall(one);
    expect(one.classList.contains("fall")).toBe(false);
    const hidden = list([10, 20], "300px 300px");
    hidden.getClientRects = () => [] as unknown as DOMRectList;
    fall(hidden);
    expect(hidden.classList.contains("fall")).toBe(false);
  });
});
