// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { h } from "./dom.js";
import { drawnAsABrowserDraws } from "./testing/drawn.js";
import { choice, dialog, EDGE, GAP, giveBack, hideTip, hideTipWithin, menu, menuRow, ORDER, redrawTip, searchBox, seat, select, switchButton, tip, tipWouldStand, toast, toastStay } from "./forms.js";

afterEach(() => { hideTip(); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); });

const key = (target: EventTarget, name: string): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};
const pointer = (target: EventTarget, type: string, pointerType = "mouse", relatedTarget: EventTarget | null = null): void => {
  target.dispatchEvent(new PointerEvent(type, { bubbles: type !== "pointerenter" && type !== "pointerleave", pointerType, relatedTarget }));
};
/** A box of a given size at a given place, as happy-dom lays out nothing. */
const sized = (element: HTMLElement, width: number, height: number): HTMLElement => {
  Object.defineProperty(element, "offsetWidth", { configurable: true, get: () => width });
  Object.defineProperty(element, "offsetHeight", { configurable: true, get: () => height });
  return element;
};
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
const tipBox = (): HTMLElement | null => document.querySelector(".f-tip");

describe("seat", () => {
  it("stands over its target, its left edge with the target's, 6 px clear; under it where over does not fit; inside the window by 8 px", () => {
    Object.assign(window, { innerWidth: 400, innerHeight: 300 });
    const box = sized(h("div"), 100, 20);
    expect(seat(box, rect(50, 100, 30, 30), ORDER.above)).toMatchObject({ side: "above", left: 50, top: 100 - GAP - 20, fits: true });
    expect([box.style.left, box.style.top, box.dataset["side"]]).toEqual(["50px", `${100 - GAP - 20}px`, "above"]);
    expect(seat(box, rect(50, 10, 30, 30), ORDER.above)).toMatchObject({ side: "below", top: 40 + GAP });
    // Near the right edge it is pushed in to 8 px from it.
    expect(seat(box, rect(380, 100, 10, 10), ORDER.above).left).toBe(400 - 100 - EDGE);
    // Beside: right first, then left.
    expect(seat(box, rect(250, 100, 30, 30), ORDER.beside)).toMatchObject({ side: "right", left: 280 + GAP });
    expect(seat(box, rect(300, 100, 30, 30), ORDER.beside)).toMatchObject({ side: "left", left: 300 - GAP - 100 });
  });

  it("keeps inside the dialog its target is in, not only the window", () => {
    Object.assign(window, { innerWidth: 1000, innerHeight: 800 });
    const box = sized(h("div"), 100, 20);
    const room = { left: 200, top: 100, right: 500, bottom: 400 };
    expect(seat(box, rect(450, 300, 20, 20), ORDER.above, false, room).left).toBe(500 - 100 - EDGE);
    expect(seat(box, rect(250, 110, 20, 20), ORDER.above, false, room)).toMatchObject({ side: "below", top: 130 + GAP });
  });

  it("wraps a box wider than its room to the room less 8 px each side", () => {
    Object.assign(window, { innerWidth: 200, innerHeight: 300 });
    const box = h("div");
    let width = 300;
    Object.defineProperty(box, "offsetWidth", { configurable: true, get: () => (box.style.maxWidth === "" ? width : Number.parseFloat(box.style.maxWidth)) });
    Object.defineProperty(box, "offsetHeight", { configurable: true, get: () => 20 });
    seat(box, rect(20, 100, 10, 10), ORDER.above);
    expect(box.style.maxWidth).toBe(`${200 - 2 * EDGE}px`);
    width = 50;
    seat(box, rect(20, 100, 10, 10), ORDER.above);
    expect(box.style.maxWidth).toBe("");
  });
});

describe("tip", () => {
  it("shows on a pointer resting on its target, hidden from a screen reader, and goes when the pointer leaves", () => {
    const target = tip(h("button", { "aria-label": "Add files" }), "Add files");
    document.body.append(target);
    pointer(target, "pointerenter");
    expect(tipBox()?.hidden).toBe(false);
    expect(tipBox()?.textContent).toBe("Add files");
    expect(tipBox()?.getAttribute("aria-hidden")).toBe("true");
    expect(target.hasAttribute("title")).toBe(false);
    pointer(target, "pointerleave");
    expect(tipBox()?.hidden).toBe(true);
  });

  it("never shows a label by touch, and a tap does what the control does", () => {
    const pressed = vi.fn();
    const target = tip(h("button", { onclick: pressed }), "Copy");
    document.body.append(target);
    pointer(target, "pointerenter", "touch");
    pointer(target, "pointerdown", "touch");
    target.click();
    expect(tipBox()?.hidden ?? true).toBe(true);
    expect(pressed).toHaveBeenCalledOnce();
  });

  it("shows what a target says nowhere else on a tap, and takes it away on a second tap there or a press elsewhere", () => {
    const target = tip(h("button"), "¥12.40 on 3 Nov", { says: true });
    const elsewhere = h("button");
    document.body.append(target, elsewhere);
    pointer(target, "pointerdown", "touch");
    target.click();
    expect(tipBox()?.hidden).toBe(false);
    pointer(target, "pointerdown", "touch");
    target.click();
    expect(tipBox()?.hidden).toBe(true);
    pointer(target, "pointerdown", "touch");
    target.click();
    pointer(elsewhere, "pointerdown", "touch");
    expect(tipBox()?.hidden).toBe(true);
  });

  it("goes on Escape with the focus left where it is, and the Escape goes no further", () => {
    const target = tip(h("button"), "Send");
    document.body.append(target);
    target.focus();
    pointer(target, "pointerenter");
    const further = vi.fn();
    document.addEventListener("keydown", further);
    const escape = key(target, "Escape");
    expect(tipBox()?.hidden).toBe(true);
    expect(escape.defaultPrevented).toBe(true);
    expect(further).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(target);
    // With no tip shown, Escape is the page's again.
    key(target, "Escape");
    expect(further).toHaveBeenCalledOnce();
  });

  it("goes at its next event once its target has left the page, and leaves that Escape to the page", () => {
    const target = tip(h("button"), "Send");
    const other = h("button");
    document.body.append(target, other);
    pointer(target, "pointerenter");
    expect(tipBox()?.hidden).toBe(false);
    target.remove();
    const further = vi.fn();
    document.addEventListener("keydown", further);
    const escape = key(other, "Escape");
    expect([tipBox()?.hidden, escape.defaultPrevented, further.mock.calls.length]).toEqual([true, false, 1]);
    document.removeEventListener("keydown", further);
  });

  it("goes at the next move of the pointer or the next key once its target is no longer drawn, and that event goes on", () => {
    drawnAsABrowserDraws();
    const target = tip(h("button"), "Full screen");
    const row = h("div", {}, target);
    const other = h("button");
    document.body.append(row, other);
    pointer(target, "pointerenter");
    window.dispatchEvent(new PointerEvent("pointermove"));
    key(other, "a");
    expect(tipBox()?.hidden, "a drawn target keeps its tip through a move and a key").toBe(false);
    row.hidden = true;
    expect(tipBox()?.hidden).toBe(false);
    window.dispatchEvent(new PointerEvent("pointermove"));
    expect(tipBox()?.hidden, "a move after its row was hidden").toBe(true);
    row.hidden = false;
    pointer(target, "pointerenter");
    row.hidden = true;
    const further = vi.fn();
    document.addEventListener("keydown", further);
    const escape = key(other, "Escape");
    expect([tipBox()?.hidden, escape.defaultPrevented, further.mock.calls.length]).toEqual([true, false, 1]);
    document.removeEventListener("keydown", further);
  });

  it("goes when the page scrolls and on a press anywhere but its target or itself", () => {
    const target = tip(h("button"), "Rename");
    document.body.append(target, h("p", { class: "far" }));
    pointer(target, "pointerenter");
    window.dispatchEvent(new Event("scroll"));
    expect(tipBox()?.hidden).toBe(true);
    pointer(target, "pointerenter");
    pointer(target, "pointerdown");
    expect(tipBox()?.hidden).toBe(false);
    pointer(document.querySelector(".far")!, "pointerdown");
    expect(tipBox()?.hidden).toBe(true);
  });

  it("keeps a card while the pointer crosses from its target onto it, and draws it as a card", () => {
    const target = tip(h("button"), () => [h("p", {}, "Balance"), h("p", {}, "¥40")], { card: true });
    document.body.append(target);
    pointer(target, "pointerenter");
    const card = tipBox()!;
    expect(card.className).toBe("f-tip f-tip-card");
    pointer(target, "pointerleave", "mouse", card);
    expect(card.hidden).toBe(false);
    pointer(card, "pointerleave", "mouse", document.body);
    expect(card.hidden).toBe(true);
  });

  it("stands inside the open dialog its target is in", () => {
    const box = h("dialog", { open: true });
    const target = tip(h("button"), "Close");
    box.append(target);
    document.body.append(box);
    pointer(target, "pointerenter");
    expect(tipBox()?.parentElement).toBe(box);
  });

  it("does not show while it has nothing to say, and goes when its words become nothing", () => {
    let words = "";
    const target = tip(h("button"), () => [words]);
    document.body.append(target);
    pointer(target, "pointerenter");
    expect(tipBox()?.hidden ?? true).toBe(true);
    words = "Drag to resize";
    pointer(target, "pointerenter");
    expect(tipBox()?.textContent).toBe("Drag to resize");
    words = "";
    redrawTip();
    expect(tipBox()?.hidden).toBe(true);
  });

  it("says its target's new words when the page redraws it, and nothing when no tip shows", () => {
    let words = "Full screen";
    const target = tip(h("button"), () => [words]);
    document.body.append(target);
    redrawTip();
    expect(tipBox()?.hidden ?? true).toBe(true);
    pointer(target, "pointerenter");
    words = "Exit full screen";
    redrawTip();
    expect([tipBox()?.hidden, tipBox()?.textContent]).toEqual([false, "Exit full screen"]);
  });

  it("is taken away by the page that draws again the part its target is in, and only by that one", () => {
    const part = h("div"), other = h("div");
    const target = tip(h("button"), "Copy");
    part.append(target);
    document.body.append(part, other);
    pointer(target, "pointerenter");
    hideTipWithin(other);
    expect(tipBox()?.hidden).toBe(false);
    hideTipWithin(part);
    expect(tipBox()?.hidden).toBe(true);
  });
});

describe("tipWouldStand", () => {
  it("says where a target's tip would stand without showing it, and nothing for a target with no tip or nothing to say", () => {
    let words = "Plugins";
    const target = tip(h("button"), () => [words]);
    document.body.append(target);
    const before = document.body.childElementCount;
    expect(tipWouldStand(target)).toBeInstanceOf(DOMRect);
    expect([document.body.childElementCount, tipBox()?.hidden ?? true]).toEqual([before, true]);
    words = "";
    expect(tipWouldStand(target)).toBeNull();
    expect(tipWouldStand(h("button"))).toBeNull();
  });
});

describe("giveBack", () => {
  it("hands the focus back to what opened a float without its tip, so the next Escape goes on to the page", () => {
    const target = tip(h("button"), "Account");
    document.body.append(target);
    vi.spyOn(target, "matches").mockImplementation((selector: string) => selector === ":focus-visible");
    giveBack(target);
    expect([document.activeElement, tipBox()?.hidden ?? true]).toEqual([target, true]);
    expect(key(target, "Escape").defaultPrevented).toBe(false);
    target.blur();
    target.focus();
    expect(tipBox()?.hidden).toBe(false);
  });
});

describe("searchBox", () => {
  it("holds its field after a magnifier hidden from a screen reader, in the one search form", () => {
    const input = h("input", { type: "search", "aria-label": "Search chats" });
    const box = searchBox(input);
    expect(box.className).toBe("f-search");
    expect(box.lastElementChild).toBe(input);
    expect(box.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("menu", () => {
  const made = () => {
    const button = h("button", {}, "Account");
    const picked: string[] = [];
    const list = h("div", { class: "f-menu", role: "menu" }, ...["Settings", "Usage", "Sign out"].map((name) => menuRow(name, () => picked.push(name))));
    document.body.append(button, list);
    const opened = menu(button, list);
    const rows = [...list.querySelectorAll<HTMLElement>("[role=menuitem]")];
    return { button, list, rows, opened, picked };
  };

  it("opens on its first row; Up and Down wrap, Home and End", () => {
    const { button, list, rows } = made();
    expect([list.hidden, button.getAttribute("aria-expanded"), button.getAttribute("aria-haspopup")]).toEqual([true, "false", "menu"]);
    button.click();
    expect([list.hidden, button.getAttribute("aria-expanded")]).toEqual([false, "true"]);
    expect(document.activeElement).toBe(rows[0]);
    key(rows[0]!, "ArrowUp");
    expect(document.activeElement).toBe(rows[2]);
    key(rows[2]!, "ArrowDown");
    expect(document.activeElement).toBe(rows[0]);
    key(rows[0]!, "End");
    expect(document.activeElement).toBe(rows[2]);
    key(rows[2]!, "Home");
    expect(document.activeElement).toBe(rows[0]);
  });

  it("opens from its button by Down or Up", () => {
    const { button, list, rows } = made();
    button.focus();
    key(button, "ArrowDown");
    expect(list.hidden).toBe(false);
    expect(document.activeElement).toBe(rows[0]);
  });

  it("closes on Escape with the focus back on its button, and on Tab from its button", () => {
    const { button, list, rows } = made();
    button.click();
    const escape = key(rows[1]!, "Escape");
    expect([list.hidden, document.activeElement, escape.defaultPrevented]).toEqual([true, button, true]);
    button.click();
    const tab = key(rows[0]!, "Tab");
    expect([list.hidden, document.activeElement, tab.defaultPrevented]).toEqual([true, button, false]);
  });

  it("closes on a press outside, the page scrolling, a second press on its button, and when another opens", () => {
    const { button, list } = made();
    const other = made();
    button.click();
    pointer(document.body, "pointerdown");
    expect(list.hidden).toBe(true);
    button.click();
    window.dispatchEvent(new Event("scroll"));
    expect(list.hidden).toBe(true);
    button.click();
    button.click();
    expect([list.hidden, document.activeElement]).toEqual([true, button]);
    button.click();
    other.button.click();
    expect([list.hidden, other.list.hidden]).toEqual([true, false]);
  });

  it("does a row's act on its press, and closes with the focus back on its button", () => {
    const { button, list, rows, picked } = made();
    button.click();
    rows[1]!.click();
    expect([picked, list.hidden, document.activeElement]).toEqual([["Usage"], true, button]);
  });

  it("closes at its own next event once its button has left the page, and lets that event go on", () => {
    const { button, list, rows } = made();
    button.click();
    expect(document.activeElement).toBe(rows[0]);
    button.remove();
    const down = key(rows[0]!, "ArrowDown");
    expect([list.hidden, down.defaultPrevented, document.activeElement === rows[1]]).toEqual([true, false, false]);
    // Its listeners went with it: a press elsewhere finds nothing of it.
    const removed = vi.spyOn(window, "removeEventListener");
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(removed).not.toHaveBeenCalled();
  });

  it("takes away a tip as it opens", () => {
    const { button } = made();
    const target = tip(h("button"), "Sort");
    document.body.append(target);
    pointer(target, "pointerenter");
    button.click();
    expect(tipBox()?.hidden).toBe(true);
  });
});

describe("select", () => {
  it("names its value with a chevron, opens on the held line ticked at its end, and takes a line by a press or Enter", () => {
    const taken: number[] = [];
    const made = select({ label: "Sort", values: ["Most used", "Newest", "Name"], held: 1, take: (index) => taken.push(index) });
    document.body.append(made.button, made.list);
    expect([made.button.textContent, made.button.getAttribute("aria-label")]).toEqual(["Newest", "Sort Newest"]);
    expect(made.button.getAttribute("aria-haspopup")).toBe("listbox");
    made.button.click();
    const rows = [...made.list.querySelectorAll<HTMLElement>("[role=option]")];
    expect(document.activeElement).toBe(rows[1]);
    expect(rows.map((row) => row.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    expect(rows[1]!.lastElementChild?.classList.contains("f-tick")).toBe(true);
    rows[2]!.click();
    expect([made.list.hidden, document.activeElement, made.button.textContent, made.button.getAttribute("aria-label"), taken]).toEqual([true, made.button, "Name", "Sort Name", [2]]);
    made.button.click();
    key(rows[0]!, "Enter");
    expect([made.button.textContent, taken]).toEqual(["Most used", [2, 0]]);
  });

  it("opens its list under it with the right edges together, unless it asks for the left", () => {
    Object.assign(window, { innerWidth: 1000, innerHeight: 800 });
    for (const start of [false, true]) {
      const made = select({ label: "Sort", values: ["Most used", "Newest"], held: 0, take: () => {}, ...(start ? { start } : {}) });
      document.body.append(made.button, made.list);
      vi.spyOn(made.button, "getBoundingClientRect").mockReturnValue(rect(300, 100, 80, 32));
      sized(made.list, 160, 60);
      made.button.click();
      expect([made.list.style.left, made.list.style.top], `start: ${start}`).toEqual([start ? "300px" : "220px", `${132 + GAP}px`]);
      made.close(false);
    }
  });

  it("scrolls a long list inside itself", () => {
    const made = select({ label: "Age", values: Array.from({ length: 12 }, (_, n) => `${n} days`), held: 0, take: () => {} });
    expect(made.list.className).toBe("f-menu f-list");
  });
});

describe("dialog", () => {
  const made = () => {
    const back = h("button", {}, "Cancel");
    const box = h("dialog", { class: "f-dialog" }, h("h2", {}, "Remove Keepa?"), back) as HTMLDialogElement;
    // happy-dom's own modal does not lay out: the box is given a place for the scrim test.
    Object.defineProperty(box, "getBoundingClientRect", { value: () => rect(100, 100, 300, 200) });
    const opener = h("button", {}, "Remove");
    document.body.append(opener, box);
    const open = dialog(box, back);
    return { box, back, opener, open };
  };
  const press = (box: HTMLElement, x: number, y: number, type: string): void => { box.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })); };

  it("opens with the keyboard on the way back, and the focus returns to what opened it on close", () => {
    const { box, back, opener, open } = made();
    open(opener);
    expect([box.open, document.activeElement]).toEqual([true, back]);
    box.close();
    expect(document.activeElement).toBe(opener);
  });

  it("closes on a press that starts and ends on the dimmed page, and not on its own padding or a drag across its edge", () => {
    const { box, opener, open } = made();
    open(opener);
    press(box, 120, 120, "pointerdown"); press(box, 120, 120, "click");
    expect(box.open).toBe(true);
    press(box, 120, 120, "pointerdown"); press(box, 20, 20, "click");
    expect(box.open).toBe(true);
    press(box, 20, 20, "pointerdown"); press(box, 120, 120, "click");
    expect(box.open).toBe(true);
    press(box, 20, 20, "pointerdown"); press(box, 20, 20, "click");
    expect(box.open).toBe(false);
  });

  it("closes an open menu and a tip as it opens", () => {
    const { opener, open } = made();
    const button = h("button");
    const list = h("div", { role: "menu" }, menuRow("One", () => {}));
    document.body.append(button, list);
    menu(button, list);
    button.click();
    open(opener);
    expect(list.hidden).toBe(true);
  });
});

describe("toast", () => {
  it("says its words as a status, stays for as long as they take to read, and stays while the pointer or the focus is on it", () => {
    vi.useFakeTimers();
    const { element, tell } = toast();
    document.body.append(element);
    tell("Keepa is on.");
    expect([element.hidden, element.getAttribute("role"), element.textContent]).toEqual([false, "status", "Keepa is on."]);
    vi.advanceTimersByTime(toastStay("Keepa is on.", false) - 1);
    expect(element.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(element.hidden).toBe(true);
    tell("Not saved. Try again.", true);
    pointer(element, "pointerenter");
    vi.advanceTimersByTime(60_000);
    expect(element.hidden).toBe(false);
    pointer(element, "pointerleave");
    vi.advanceTimersByTime(toastStay("Not saved. Try again.", true));
    expect(element.hidden).toBe(true);
    tell("Keepa is on.");
    element.dispatchEvent(new FocusEvent("focus"));
    vi.advanceTimersByTime(60_000);
    expect(element.hidden).toBe(false);
    element.dispatchEvent(new FocusEvent("blur"));
    vi.advanceTimersByTime(toastStay("Keepa is on.", false));
    expect(element.hidden).toBe(true);
  });

  it("counts the pointer's hold and the focus's apart: the pointer leaving does not end a hold the focus still has", () => {
    vi.useFakeTimers();
    const { element, tell } = toast();
    document.body.append(element);
    tell("Keepa is on.");
    element.dispatchEvent(new FocusEvent("focus"));
    pointer(element, "pointerenter");
    pointer(element, "pointerleave");
    vi.advanceTimersByTime(60_000);
    expect(element.hidden).toBe(false);
    pointer(element, "pointerenter");
    element.dispatchEvent(new FocusEvent("blur"));
    vi.advanceTimersByTime(60_000);
    expect(element.hidden).toBe(false);
    pointer(element, "pointerleave");
    vi.advanceTimersByTime(toastStay("Keepa is on.", false));
    expect(element.hidden).toBe(true);
  });
});

describe("choice", () => {
  const made = (role?: "radiogroup" | "tablist") => {
    const taken: number[] = [];
    const made = choice({ label: "Appearance", values: [{ name: "System" }, { name: "Light" }, { name: "Dark" }], held: 1, ...(role === undefined ? {} : { role }), take: (index) => taken.push(index) });
    document.body.append(made.element);
    const cells = [...made.element.querySelectorAll<HTMLElement>("button")];
    return { ...made, cells, taken };
  };
  const held = (cells: readonly HTMLElement[], state = "aria-checked"): number => cells.findIndex((cell) => cell.getAttribute(state) === "true");

  it("is one Tab stop; Left and Right, Up and Down in a radio group, Home and End move and hold the value", () => {
    const { element, cells, taken } = made();
    expect(element.getAttribute("role")).toBe("radiogroup");
    expect(cells.map((cell) => [cell.getAttribute("role"), cell.tabIndex])).toEqual([["radio", -1], ["radio", 0], ["radio", -1]]);
    cells[1]!.focus();
    key(cells[1]!, "ArrowRight");
    expect([held(cells), document.activeElement, cells.map((cell) => cell.tabIndex)]).toEqual([2, cells[2], [-1, -1, 0]]);
    key(cells[2]!, "ArrowRight");
    expect(held(cells)).toBe(0);
    key(cells[0]!, "ArrowUp");
    expect(held(cells)).toBe(2);
    key(cells[2]!, "Home");
    expect(held(cells)).toBe(0);
    key(cells[0]!, "End");
    expect(held(cells)).toBe(2);
    expect(taken).toEqual([2, 0, 2, 0, 2]);
  });

  it("switches a view as a tab list, by Left and Right only, and by a press", () => {
    const { element, cells, taken } = made("tablist");
    expect([element.getAttribute("role"), cells[0]!.getAttribute("role")]).toEqual(["tablist", "tab"]);
    key(cells[1]!, "ArrowDown");
    expect(held(cells, "aria-selected")).toBe(1);
    key(cells[1]!, "ArrowLeft");
    expect(held(cells, "aria-selected")).toBe(0);
    cells[2]!.click();
    expect([held(cells, "aria-selected"), taken]).toEqual([2, [0, 2]]);
  });

  it("slides its pill to a value taken, and places it with no motion when told the value from outside", () => {
    const { element, cells, hold } = made();
    cells.forEach((cell, n) => { Object.defineProperty(cell, "offsetLeft", { get: () => 4 + 60 * n }); Object.defineProperty(cell, "offsetWidth", { get: () => 60 }); });
    cells[0]!.click();
    const pill = element.querySelector<HTMLElement>(".f-pill")!;
    expect([pill.style.getPropertyValue("--f-x"), pill.style.getPropertyValue("--f-w"), element.classList.contains("still")]).toEqual(["4px", "60px", false]);
    hold(2);
    expect([pill.style.getPropertyValue("--f-x"), element.classList.contains("still"), held(cells)]).toEqual(["124px", true, 2]);
  });

  it("drawn again by the page that took a value, starts at the value it left and slides on to the one taken", async () => {
    const frames = (): Promise<void> => new Promise((done) => { requestAnimationFrame(() => requestAnimationFrame(() => done())); });
    const placed = (element: HTMLElement): HTMLElement[] => {
      const cells = [...element.querySelectorAll<HTMLElement>("button")];
      cells.forEach((cell, n) => { Object.defineProperty(cell, "offsetLeft", { get: () => 4 + 60 * n }); Object.defineProperty(cell, "offsetWidth", { get: () => 60 }); });
      return cells;
    };
    const seen: (readonly [string, boolean])[] = [];
    let drawn!: HTMLElement;
    const draw = (held: number): void => {
      const made = choice({ label: "Appearance", values: [{ name: "System" }, { name: "Light" }, { name: "Dark" }], held, take: (index) => draw(index) }).element;
      placed(made);
      if (drawn === undefined) document.body.append(made); else drawn.replaceWith(made);
      drawn = made;
    };
    draw(0);
    await frames();
    const pill = (): HTMLElement => drawn.querySelector<HTMLElement>(".f-pill")!;
    expect(pill().style.getPropertyValue("--f-x")).toBe("4px");
    drawn.querySelectorAll<HTMLElement>("button")[2]!.click();
    await new Promise<void>((done) => { requestAnimationFrame(() => { seen.push([pill().style.getPropertyValue("--f-x"), drawn.classList.contains("still")]); done(); }); });
    await frames();
    seen.push([pill().style.getPropertyValue("--f-x"), drawn.classList.contains("still")]);
    expect(seen).toEqual([["4px", true], ["124px", false]]);
    // A choice of another name drawn meanwhile starts where it is held.
    const other = choice({ label: "Language", values: [{ name: "中文" }, { name: "English" }], held: 1, take: () => {} }).element;
    document.body.append(other);
    placed(other);
    await frames();
    expect([other.querySelector<HTMLElement>(".f-pill")!.style.getPropertyValue("--f-x"), other.classList.contains("still")]).toEqual(["64px", true]);
  });

  it("names each cell by the page's key, holds a field in its last cell's pill after the cell, and says whether a value came by a press or the keys", () => {
    const field = h("input", { type: "text" });
    const taken: (readonly [number, string])[] = [];
    const { element } = choice({ label: "Auto-off", held: 2, take: (index, by) => taken.push([index, by]),
      values: [{ name: "Never", key: "auto-never" }, { name: "10 min", key: "auto-10" }, { name: "Custom", key: "auto-custom", shown: "min", field }] });
    document.body.append(element);
    const cells = [...element.querySelectorAll<HTMLElement>("button")];
    expect([cells.map((cell) => cell.dataset["key"]), cells[2]!.getAttribute("aria-label"), cells[2]!.textContent, element.lastElementChild === field, field.classList.contains("f-field"), cells[2]!.classList.contains("f-after")])
      .toEqual([["auto-never", "auto-10", "auto-custom"], "Custom", "min", true, true, true]);
    // The field stands before its cell's words: 10 min ends at 124, the field takes 40, 自定义's words the 60 after.
    cells.forEach((cell, n) => { Object.defineProperty(cell, "offsetLeft", { get: () => (n === 2 ? 164 : 4 + 60 * n) }); Object.defineProperty(cell, "offsetWidth", { get: () => 60 }); });
    Object.defineProperty(field, "offsetLeft", { get: () => 124 });
    Object.defineProperty(field, "offsetWidth", { get: () => 40 });
    // The arrows in the field move its caret, not the value.
    expect(key(field, "ArrowLeft").defaultPrevented).toBe(false);
    cells[1]!.click();
    key(cells[1]!, "End");
    const pill = element.querySelector<HTMLElement>(".f-pill")!;
    expect([taken, pill.style.getPropertyValue("--f-x"), pill.style.getPropertyValue("--f-w")]).toEqual([[[1, "press"], [2, "keys"]], "124px", "100px"]);
  });

  it("names a value drawn as a mark, and shows its name as a tip", () => {
    const icon = (): SVGElement => document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const { element } = choice({ label: "Appearance", values: [{ name: "Light", mark: icon }, { name: "Dark", mark: icon }], held: 0, take: () => {} });
    document.body.append(element);
    const cell = element.querySelector<HTMLElement>("button")!;
    expect([element.className, cell.getAttribute("aria-label")]).toEqual(["f-seg icons", "Light"]);
    pointer(cell, "pointerenter");
    expect(tipBox()?.textContent).toBe("Light");
  });
});

describe("switchButton", () => {
  it("turns on a press, says its state to a screen reader, and is not pressed while busy", () => {
    const turned: boolean[] = [];
    const made = switchButton({ label: "Keepa", on: false, turn: (on) => turned.push(on) });
    expect([made.element.getAttribute("role"), made.element.getAttribute("aria-checked"), made.element.getAttribute("aria-label"), made.element.textContent]).toEqual(["switch", "false", "Keepa", ""]);
    made.element.click();
    expect([made.element.getAttribute("aria-checked"), turned]).toEqual(["true", [true]]);
    made.busy(true);
    made.element.click();
    expect([made.element.getAttribute("aria-checked"), made.element.getAttribute("aria-disabled"), turned]).toEqual(["true", "true", [true]]);
    made.busy(false);
    made.set(false);
    expect([made.element.getAttribute("aria-checked"), made.element.hasAttribute("aria-busy")]).toEqual(["false", false]);
  });

  it("cannot be turned where it is off: a press does nothing, and it keeps the keyboard", () => {
    const turned: boolean[] = [];
    const made = switchButton({ label: "Ready", on: false, off: true, turn: (on) => turned.push(on) });
    document.body.append(made.element);
    made.element.click();
    made.element.focus();
    expect([made.element.getAttribute("aria-disabled"), made.element.getAttribute("aria-checked"), turned, document.activeElement === made.element]).toEqual(["true", "false", [], true]);
  });
});
