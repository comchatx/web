// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { carried } from "./dom.js";

afterEach(() => { getSelection()?.removeAllRanges(); document.body.replaceChildren(); });

describe("an element drawn again", () => {
  /** An answer with a step between two runs of written text, and its row; `done` draws the step with its result. */
  const answer = (done: boolean): HTMLElement => {
    const article = document.createElement("article");
    article.innerHTML = `<div class="markdown"><p>The remaining <strong>412 units</strong> are available.</p></div><div class="tool">${done ? "<pre>result</pre>" : ""}</div>`
      + `<div class="markdown"><p>Order this week.</p></div><div class="actions"><button data-rove tabindex="0">Quote</button><button data-rove tabindex="-1">Copy</button></div>`;
    return article;
  };
  const again = (old: HTMLElement, fresh: HTMLElement): void => { const keep = carried(old, fresh, "[data-rove]", ":scope > .markdown"); old.replaceWith(fresh); keep(); };

  it("keeps the focus on the same control of its row, and the row's Tab stop where the arrows left it", () => {
    const old = answer(false), fresh = answer(true);
    document.body.append(old);
    const [, copy] = [...old.querySelectorAll<HTMLButtonElement>("button")];
    old.querySelector<HTMLButtonElement>("button")!.tabIndex = -1;
    copy!.tabIndex = 0;
    copy!.focus();
    again(old, fresh);
    const stops = [...fresh.querySelectorAll<HTMLButtonElement>("button")];
    expect(document.activeElement).toBe(stops[1]);
    expect(stops.map((stop) => stop.tabIndex)).toEqual([-1, 0]);
  });

  it("keeps the words selected in its written text, whichever way they were selected, across what the writing puts them in", () => {
    const old = answer(false), fresh = answer(true);
    document.body.append(old);
    const second = old.querySelectorAll(".markdown")[1]!.querySelector("p")!.firstChild!;
    // From "this" in the second run back to "412" in the first.
    getSelection()!.setBaseAndExtent(second, 10, old.querySelector("strong")!.firstChild!, 0);
    const held = getSelection()!.getRangeAt(0).toString();
    again(old, fresh);
    const selection = getSelection()!;
    expect(fresh.contains(selection.anchorNode) && fresh.contains(selection.focusNode)).toBe(true);
    // The step's result, drawn between the two runs, is now inside what the selection spans.
    expect([held, selection.getRangeAt(0).toString()]).toEqual(["412 units are available.Order this", "412 units are available.resultOrder this"]);
    expect([selection.anchorNode!.textContent, selection.anchorOffset]).toEqual(["Order this week.", 10]);
  });

  it("takes no focus and makes no selection it did not hold, and leaves both alone where the new drawing has no such place", () => {
    const old = answer(false), fresh = answer(true);
    const other = document.createElement("button");
    document.body.append(old, other);
    other.focus();
    again(old, fresh);
    expect(document.activeElement).toBe(other);
    expect(getSelection()!.rangeCount === 0 || getSelection()!.isCollapsed).toBe(true);

    const bare = document.createElement("article");
    fresh.querySelector<HTMLButtonElement>("button")!.focus();
    again(fresh, bare);
    expect(bare.contains(document.activeElement)).toBe(false);
  });
});
