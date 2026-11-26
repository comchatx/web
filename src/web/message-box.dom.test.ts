// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { messageBox, SEND_MARK } from "../shared/message-box.js";

afterEach(() => { document.body.replaceChildren(); });

const key = (field: HTMLTextAreaElement, init: KeyboardEventInit & { readonly keyCode?: number }): boolean => {
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init });
  if (init.keyCode !== undefined) Object.defineProperty(event, "keyCode", { value: init.keyCode });
  field.dispatchEvent(event);
  return event.defaultPrevented;
};

it("sends on Enter, once for a held one, and leaves Shift+Enter, an input method's Enter and every other key to the field", () => {
  let sent = 0;
  const { field } = messageBox(document, { send: () => { sent += 1; } }) as unknown as { field: HTMLTextAreaElement };
  document.body.append(field);
  const seen: [string, boolean, number][] = [];
  const at = (name: string, init: KeyboardEventInit & { readonly keyCode?: number }): void => { const before = sent; seen.push([name, key(field, init), sent - before]); };
  at("Enter", {});
  at("Enter held", { repeat: true });
  at("Shift+Enter", { shiftKey: true });
  at("Enter while choosing", { isComposing: true });
  at("Enter as Safari's input method gives it", { keyCode: 229 });
  at("a letter", { key: "a" });
  expect(seen).toEqual([
    ["Enter", true, 1], ["Enter held", true, 0], ["Shift+Enter", false, 0], ["Enter while choosing", false, 0], ["Enter as Safari's input method gives it", false, 0], ["a letter", false, 0],
  ]);
});

it("breaks the line at Enter with Ctrl, ⌘ or Alt, Shift held or not, by the browser's own editing and nothing else; a bare Enter still sends", () => {
  let sent = 0;
  const edits: string[] = [];
  const own = document.execCommand;
  document.execCommand = ((command: string, _show: boolean, value: string) => { edits.push(`${command}:${value}`); return true; }) as typeof document.execCommand;
  try {
    const { field } = messageBox(document, { send: () => { sent += 1; } }) as unknown as { field: HTMLTextAreaElement };
    document.body.append(field);
    field.value = "Only Germany";
    const held = [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { ctrlKey: true, shiftKey: true }, { metaKey: true, shiftKey: true }, { altKey: true, shiftKey: true }, { ctrlKey: true, metaKey: true, altKey: true, shiftKey: true }];
    expect([held.map((one) => key(field, one)), edits, sent]).toEqual([Array(7).fill(true), Array(7).fill("insertText:\n"), 0]);
    expect([key(field, {}), sent]).toEqual([true, 1]);
  } finally { document.execCommand = own; }
});

it("leaves a key to the caller that takes it first", () => {
  let sent = 0;
  const field = document.createElement("textarea");
  messageBox(document, { field, send: () => { sent += 1; }, before: (event: KeyboardEvent) => event.key === "Enter" && event.ctrlKey });
  expect([key(field, { ctrlKey: true }), sent, key(field, {}), sent]).toEqual([false, 0, true, 1]);
});

it("draws a new box of two lines with the words it is given, and keeps a field it is handed as it was", () => {
  const made = messageBox(document, { placeholder: "Message the helper", send: () => {} }) as unknown as { element: HTMLElement; field: HTMLTextAreaElement; control: undefined };
  const own = document.createElement("textarea");
  own.rows = 5;
  const handed = messageBox(document, { field: own, placeholder: "unused", send: () => {} }) as unknown as { field: HTMLTextAreaElement };
  expect([made.element === made.field, Number(made.field.rows), made.field.dir, made.field.placeholder, made.control, handed.field === own, Number(own.rows), own.placeholder]).toEqual([true, 2, "auto", "Message the helper", undefined, true, 5, ""]);
});

it("with a control of its own, keeps it off while the field holds only blanks, names it, draws the send mark, and sends at its press", () => {
  let sent = 0;
  const made = messageBox(document, { send: () => { sent += 1; }, control: { name: "Send", mark: SEND_MARK } }) as unknown as { element: HTMLElement; field: HTMLTextAreaElement; control: HTMLButtonElement };
  document.body.append(made.element);
  const type = (words: string): void => { made.field.value = words; made.field.dispatchEvent(new Event("input")); };
  const states: boolean[] = [made.control.disabled];
  type("  \n ");
  states.push(made.control.disabled);
  made.control.click();
  type("Only Germany");
  states.push(made.control.disabled);
  made.control.click();
  // Enter takes the control's rule: blanks send nothing.
  type(" ");
  made.field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  type("Only Germany");
  expect([states, sent, made.control.type, made.control.getAttribute("aria-label"), made.control.title, [...made.control.querySelectorAll("path")].map((one) => one.getAttribute("d")), made.element.children.length])
    .toEqual([[true, true, false], 1, "button", "Send", "Send", [...SEND_MARK], 2]);
});
