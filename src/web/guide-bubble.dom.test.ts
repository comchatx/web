// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { afterKey, standAt, tabBeside, teach } from "./guide-bubble.js";

afterEach(() => { document.body.replaceChildren(); });

const words = { title: "插件", lines: ["一", "二"], press: "点击「插件」", skip: "跳过" } as const;

it("says a step's title, lines and press, with 跳过 at the end of the last row pressing what it is given", () => {
  const bubble = document.createElement("span");
  const skipped = vi.fn();
  teach(bubble, words, skipped);
  expect([...bubble.querySelectorAll(".teach-title, .teach-line, .teach-press")].map((one) => one.textContent)).toEqual(["插件", "一", "二", "点击「插件」"]);
  const skip = bubble.querySelector<HTMLButtonElement>(".teach-foot > button[data-act='skip']")!;
  expect([skip.textContent, skip.className, bubble.classList.contains("teach")]).toEqual(["跳过", "f-btn", true]);
  skip.click();
  expect(skipped).toHaveBeenCalledTimes(1);
});

/** A page of three presses and a bubble after them, the presses seen. */
function page(): { readonly a: HTMLButtonElement; readonly b: HTMLButtonElement; readonly c: HTMLButtonElement; readonly bubble: HTMLElement; readonly skip: HTMLButtonElement } {
  const [a, b, c] = ["a", "b", "c"].map((name) => Object.assign(document.createElement("button"), { textContent: name }));
  const bubble = document.createElement("span");
  teach(bubble, words, () => undefined);
  document.body.append(a!, b!, c!, bubble);
  for (const one of document.querySelectorAll<HTMLElement>("button")) one.checkVisibility = () => true;
  return { a: a!, b: b!, c: c!, bubble, skip: bubble.querySelector("button")! };
}

it("finds what came after the key, the bubble left out, and nothing after the page's last", () => {
  const { a, b, c, bubble } = page();
  expect(afterKey(a, bubble)).toBe(b);
  expect(afterKey(c, bubble)).toBeNull();
  expect(afterKey(bubble, bubble)).toBeUndefined();
});

it("moves Tab from the key to 跳过, from 跳过 to what came after the key, and Shift+Tab back the same way, until it is ended", () => {
  const { a, b, bubble, skip } = page();
  const end = tabBeside(document, bubble, () => a);
  const tab = (from: HTMLElement, shiftKey = false): void => { from.focus(); from.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true })); };
  tab(a);
  expect(document.activeElement).toBe(skip);
  expect(skip.tabIndex).toBe(-1);
  tab(skip);
  expect(document.activeElement).toBe(b);
  tab(b, true);
  expect(document.activeElement).toBe(skip);
  tab(skip, true);
  expect(document.activeElement).toBe(a);
  end();
  tab(a);
  expect(document.activeElement).toBe(a);
});

it("stands the bubble back in cx's place once no step holds it", () => {
  const place = document.createElement("div");
  const slot = document.createElement("span");
  const bubble = document.createElement("span");
  place.append(slot);
  document.body.append(place, bubble);
  bubble.classList.add("fixed", "under", "hold");
  standAt(bubble, place, null, null);
  expect([bubble.parentElement, place.children[1], bubble.className]).toEqual([place, bubble, ""]);
});
