import { expect, it } from "vitest";
import { ignoreHeld, twice } from "./press.js";

const key = (target: EventTarget, name: string, repeat: boolean): Event => {
  const event = Object.assign(new Event("keydown", { cancelable: true }), { key: name, repeat });
  target.dispatchEvent(event);
  return event;
};

it("keeps a held Enter or Space from pressing a button that took the focus under it, and leaves a fresh press and other keys alone", () => {
  const button = new EventTarget();
  ignoreHeld(button);
  expect([key(button, "Enter", true).defaultPrevented, key(button, " ", true).defaultPrevented]).toEqual([true, true]);
  expect([key(button, "Enter", false).defaultPrevented, key(button, " ", false).defaultPrevented, key(button, "Tab", true).defaultPrevented]).toEqual([false, false, false]);
});

it("reads a pointer's second press as a second one, and a key's or a script's press as none", () => {
  const click = (detail: number): Event => Object.assign(new Event("click"), { detail });
  expect([twice(click(2)), twice(click(3)), twice(click(1)), twice(click(0))]).toEqual([true, true, false, false]);
});
