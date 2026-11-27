// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardColumn, CHAT_LEAST, CHAT_STRIP, COLUMN_LEAST, COLUMN_LEAST_ROW, LEAD, LET_GO, OVER_KEY, TAKE, TURN, WIDTH_KEY } from "./board-column.js";
import { h } from "./dom.js";
import { hideTip } from "./forms.js";
import { text } from "./strings.js";
import { drawnAsABrowserDraws } from "./testing/drawn.js";

afterEach(() => { hideTip(); vi.useRealTimers(); document.body.replaceChildren(); vi.restoreAllMocks(); });
/** The words of the set's one tip while it shows. */
const shown = (): string | undefined => { const box = document.querySelector<HTMLElement>(".f-tip"); return box === null || box.hidden ? undefined : box.textContent ?? ""; };
/** happy-dom's own media queries, taken once: a second column in a test spies on the first's spy. */
const realMatch = window.matchMedia.bind(window);

/** The column's own media query, which happy-dom does not evaluate, held by the test: beside the chat or over it. */
function column(beside = true, sidebar = 248, kept?: string, keptOver?: string, reduced = false, more: { readonly openWindow?: () => void; readonly windowed?: boolean } = {}) {
  const listeners: (() => void)[] = [];
  const query = { matches: beside, addEventListener: (_: string, listener: () => void) => { listeners.push(listener); } };
  const calm = { matches: reduced, addEventListener: () => {} };
  const asked: string[] = [];
  vi.spyOn(window, "matchMedia").mockImplementation((text) => { asked.push(text); return text.includes("calc(") ? query as unknown as MediaQueryList : text.includes("reduced-motion") ? calm as unknown as MediaQueryList : realMatch(text); });
  const root = h("div", { class: "app" });
  Object.defineProperty(root, "clientWidth", { value: 1280 });
  const top = h("div", { class: "page-top" });
  const chat = h("div", { class: "page" }, top);
  const head = h("div", { class: "board-head" }, h("button", { type: "button", class: "in-head" }));
  const page = h("div", { class: "board-page" }, h("button", { type: "button", class: "in-page" }));
  const kept_: Record<string, string[]> = { [WIDTH_KEY]: kept === undefined ? [] : [kept], [OVER_KEY]: keptOver === undefined ? [] : [keptOver] };
  const stored = kept_[WIDTH_KEY]!;
  const storedOver = kept_[OVER_KEY]!;
  const changed = vi.fn();
  const opening = vi.fn();
  const tab = page.querySelector<HTMLButtonElement>(".in-page")!;
  const made = new BoardColumn({ say: (key, values) => text("en", key, values), top, chat, root, sidebarWidth: () => sidebar, changed, opening, landing: () => tab, store: { read: (key) => kept_[key]?.at(-1) ?? null, write: (key, value) => { kept_[key]!.push(value); } }, ...more }, head, page);
  changed.mockImplementation(() => made.draw(4));
  // The column is as wide as it is drawn: happy-dom lays nothing out.
  Object.defineProperty(made.element, "offsetWidth", { get: () => parseFloat(made.element.style.width) || 0 });
  root.append(chat, made.divider, made.backdrop, made.element);
  document.body.append(root);
  const flip = (to: boolean): void => { query.matches = to; for (const listener of listeners) listener(); };
  return { made, root, top, chat, head, page, stored, storedOver, changed, opening, flip, asked };
}
const REM = 16;
/** What the chat and the column share at 1280 px beside a sidebar of 248 px, the divider's width being nothing in the stand-in DOM. */
const ROOM = 1280 - 248;
const MOST = ROOM - CHAT_STRIP * REM;
const MEET = ROOM - CHAT_LEAST * REM;

describe("the board's column", () => {
  it("draws 在新窗口中打开 before full screen while the column is open, its word its name and its tip, and a press opens the window", () => {
    const openWindow = vi.fn();
    const { made, head } = column(true, 248, undefined, undefined, false, { openWindow });
    made.install(true);
    const button = head.querySelector<HTMLButtonElement>(".board-window-open")!;
    expect(button.hidden).toBe(true);
    made.set(true);
    expect([button.hidden, button.getAttribute("aria-label"), button.nextElementSibling?.classList.contains("board-full")]).toEqual([false, "Open in new window", true]);
    button.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    button.click();
    expect(openWindow).toHaveBeenCalledTimes(1);
    // Without a way to open one, there is no such control.
    document.body.replaceChildren();
    const plain = column();
    plain.made.install(true);
    plain.made.set(true);
    expect(plain.head.querySelector<HTMLButtonElement>(".board-window-open")!.hidden).toBe(true);
  });

  it("in a window of its own is always open, over nothing, with no icon, divider, full screen or 在新窗口中打开, and nothing closes it", () => {
    const { made, head, flip } = column(false, 0, undefined, undefined, false, { windowed: true });
    made.install(true);
    expect([made.open, made.over, made.covers, made.row.hidden, made.divider.hidden]).toEqual([true, false, false, true, true]);
    expect([head.querySelector<HTMLElement>(".board-full")!.hidden, head.querySelector<HTMLElement>(".board-window-open")!.hidden]).toEqual([true, true]);
    made.set(false);
    flip(true);
    flip(false);
    expect([made.open, made.took(new KeyboardEvent("keydown", { key: "Escape" }))]).toEqual([true, false]);
    expect(made.element.style.width).toBe("");
  });

  it("shows no icon and no column without the package, and with it the clipboard at the chat's top right, counting what waits", () => {
    const { made, top } = column();
    made.draw(0);
    expect([made.row.hidden, made.element.hidden, made.installed]).toEqual([true, true, false]);
    made.set(true);
    expect(made.open).toBe(false);
    made.install(true);
    expect([made.row.hidden, made.element.hidden, made.row.parentElement]).toEqual([false, false, top]);
    expect([made.icon.getAttribute("aria-label"), made.icon.textContent]).toEqual(["Board, 4 to do", "4"]);
    made.draw(0);
    expect([made.icon.getAttribute("aria-label"), made.icon.querySelector<HTMLElement>(".page-count")!.hidden]).toEqual(["Board", true]);
    made.install(false);
    expect(made.row.hidden).toBe(true);
  });

  it("opens on its icon, marked ink on wash, with the row in its head where it stood, and closes on the marked icon, the focus left on the icon", () => {
    const { made, head, top, opening } = column();
    made.install(true);
    made.icon.click();
    expect([made.open, made.icon.getAttribute("aria-pressed"), made.row.parentElement, made.divider.hidden]).toEqual([true, "true", head, false]);
    expect(opening).toHaveBeenCalledOnce();
    made.icon.focus();
    made.icon.click();
    expect([made.open, made.row.parentElement, document.activeElement]).toEqual([false, top, made.icon]);
    // The focus inside the column goes to the icon when it closes.
    made.set(true);
    made.page.querySelector<HTMLButtonElement>(".in-page")!.focus();
    made.set(false);
    expect(document.activeElement).toBe(made.icon);
  });

  it("drags beside the chat within its least and most, which leave a strip of the chat in sight, keeps the width in the browser, and puts it back on Escape", () => {
    const { made, stored } = column();
    made.install(true);
    made.set(true);
    const most = MOST;
    expect(made.divider.getAttribute("aria-valuemin")).toBe(String(COLUMN_LEAST * REM));
    expect(made.divider.getAttribute("aria-valuemax")).toBe(String(Math.round(most)));
    const width = (): number => parseFloat(made.element.style.width);
    const first = width();
    made.divider.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 1, clientX: 900, bubbles: true }));
    // A pointer drags the edge with no tip.
    expect([made.dragging, shown()]).toEqual([true, undefined]);
    made.divider.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 880, bubbles: true }));
    expect([width(), shown()]).toEqual([first + 20, undefined]);
    made.divider.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, bubbles: true }));
    expect([made.dragging, stored.at(-1)]).toEqual([false, String(first + 20)]);
    // Escape during a drag puts it back.
    made.divider.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 2, clientX: 900, bubbles: true }));
    made.divider.dispatchEvent(new PointerEvent("pointermove", { pointerId: 2, clientX: 0, bubbles: true }));
    // Dragged past the column's most, the board is full screen: it has the room it shares with the chat, and no width of its own.
    expect([made.full, made.element.style.width, made.divider.getAttribute("aria-valuenow")]).toEqual([true, "", String(Math.round(most))]);
    expect(made.took(new KeyboardEvent("keydown", { key: "Escape" }))).toBe(true);
    expect([width(), made.dragging, made.full]).toEqual([first + 20, false, false]);
    // A press past the column's least stops there.
    made.divider.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 3, clientX: 900, bubbles: true }));
    made.divider.dispatchEvent(new PointerEvent("pointermove", { pointerId: 3, clientX: 2_000, bubbles: true }));
    made.divider.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 3, bubbles: true }));
    expect([width(), stored.at(-1)]).toEqual([COLUMN_LEAST * REM, String(COLUMN_LEAST * REM)]);
  });

  it("moves with the keyboard: a rem with the arrows, four with Shift, and to the least and the most with Home and End", () => {
    const { made, stored } = column();
    made.install(true);
    made.set(true);
    const width = (): number => parseFloat(made.element.style.width);
    const key = (key: string, shiftKey = false): void => { made.divider.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true })); };
    key("Home");
    expect(width()).toBe(COLUMN_LEAST * REM);
    key("ArrowLeft");
    expect(width()).toBe(COLUMN_LEAST * REM + REM);
    key("ArrowLeft", true);
    expect(width()).toBe(COLUMN_LEAST * REM + 5 * REM);
    key("ArrowRight");
    expect(width()).toBe(COLUMN_LEAST * REM + 4 * REM);
    // End is full screen, the width the column had kept for the way back; → from it steps back to the most, and Home to the least.
    key("End");
    expect([made.full, made.element.style.width, stored.at(-1)]).toEqual([true, "", String(COLUMN_LEAST * REM + 4 * REM)]);
    key("ArrowLeft");
    expect(made.full).toBe(true);
    key("ArrowRight");
    expect([made.full, String(width())]).toEqual([false, made.divider.getAttribute("aria-valuemax")]);
    key("End");
    key("Home");
    expect([made.full, width()]).toEqual([false, COLUMN_LEAST * REM]);
    key("x");
    expect(stored.at(-1)).toBe(String(width()));
  });

  it("starts at the width the browser kept, as near it as the window allows, and at its first width with none kept", () => {
    const kept = column(true, 248, "400");
    kept.made.install(true);
    kept.made.set(true);
    expect(kept.made.element.style.width).toBe("400px");
    // A width kept beside the chat stays beside it, at the middle of the turn, where the column lies over the chat by ln 2 of a rem; one
    // the seller left over the chat goes over it again, as near it as the window allows.
    const far = column(true, 248, "5000", "0");
    far.made.install(true);
    far.made.set(true);
    expect([far.made.element.style.width, far.made.divider.style.marginLeft]).toEqual([`${MEET}px`, `-${Math.round(Math.LN2 * TURN * REM)}px`]);
    document.body.replaceChildren();
    const farOver = column(true, 248, "5000", "1");
    farOver.made.install(true);
    farOver.made.set(true);
    expect([farOver.made.element.style.width, farOver.made.overChat]).toEqual([`${MOST}px`, true]);
    const none = column(true, 248, "nothing");
    none.made.install(true);
    none.made.set(true);
    expect(parseFloat(none.made.element.style.width)).toBe(Math.min(MEET, 30 * REM, Math.max(24 * REM, 0.26 * innerWidth)));
  });

  it("opens as a sheet over the chat with the focus on its tab in view, by a press or by the keyboard, and beside the chat leaves the focus where it was", () => {
    const over = column(false);
    over.made.install(true);
    const tab = over.page.querySelector<HTMLButtonElement>(".in-page")!;
    over.made.icon.click();
    expect([over.made.over, document.activeElement]).toEqual([true, tab]);
    over.made.set(false);
    over.made.icon.focus();
    over.made.icon.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    over.made.icon.click();
    expect(document.activeElement).toBe(tab);
    // Opened again while open, nothing moves.
    over.page.querySelector<HTMLButtonElement>(".in-page")!.blur();
    over.made.set(true);
    expect(document.activeElement).not.toBe(tab);
    document.body.replaceChildren();
    const beside = column(true);
    beside.made.install(true);
    beside.made.icon.focus();
    beside.made.icon.click();
    expect([beside.made.over, document.activeElement]).toEqual([false, beside.made.icon]);
  });

  it("is a sheet over the chat on a narrow window: no divider and no width of its own, Escape closing it, and a window that narrows closes it", () => {
    const { made, flip } = column(false);
    made.install(true);
    made.set(true);
    expect([made.over, made.divider.hidden, made.element.style.width]).toEqual([true, true, ""]);
    made.page.querySelector<HTMLButtonElement>(".in-page")!.focus();
    expect(made.took(new KeyboardEvent("keydown", { key: "Escape" }))).toBe(true);
    expect([made.open, document.activeElement]).toEqual([false, made.icon]);
    expect(made.took(new KeyboardEvent("keydown", { key: "Escape" }))).toBe(false);
    // Beside the chat it stays open as the window narrows and widens again; opened over the chat it is one look.
    flip(true);
    made.set(true);
    flip(false);
    expect(made.open).toBe(false);
    flip(true);
    expect(made.open).toBe(true);
    flip(false);
    made.set(true);
    made.set(false);
    flip(true);
    expect(made.open).toBe(true);
  });

  it("beside the chat, takes an Escape inside it and closes for none", () => {
    const { made } = column();
    made.install(true);
    made.set(true);
    const inside = made.page.querySelector<HTMLButtonElement>(".in-page")!;
    const outside = h("button", { type: "button" });
    document.body.append(outside);
    const escape = (target: EventTarget): boolean => { const event = new KeyboardEvent("keydown", { key: "Escape" }); Object.defineProperty(event, "target", { value: target }); return made.took(event); };
    expect([escape(inside), made.open]).toEqual([true, true]);
    expect(escape(outside)).toBe(false);
  });

  it("names its edge in the set's tip, beside it, on the keyboard's focus, its name kept for the screen reader under a pointer's drag", () => {
    const { made } = column();
    made.install(true);
    made.set(true);
    made.divider.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 1, clientX: 900, bubbles: true }));
    expect([shown(), made.divider.getAttribute("aria-label")]).toEqual([undefined, "Resize"]);
    made.divider.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, bubbles: true }));
    vi.spyOn(made.divider, "matches").mockImplementation((selector: string) => selector === ":focus-visible");
    made.divider.dispatchEvent(new FocusEvent("focus"));
    expect(shown()).toBe("Resize");
  });

  it("keeps the keyboard's tip through a key, and takes it away for a pointer's drag, mouse or touch", () => {
    const { made } = column();
    made.install(true);
    made.set(true);
    vi.spyOn(made.divider, "matches").mockImplementation((selector: string) => selector === ":focus-visible");
    const key = (key: string): void => { made.divider.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); };
    made.divider.dispatchEvent(new FocusEvent("focus"));
    key("ArrowLeft");
    expect(shown()).toBe("Resize");
    for (const [pointerId, pointerType] of [[1, "mouse"], [2, "touch"]] as const) {
      made.divider.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId, pointerType, clientX: 900, bubbles: true }));
      expect([made.dragging, shown()], pointerType).toEqual([true, undefined]);
      made.divider.dispatchEvent(new PointerEvent("pointermove", { pointerId, pointerType, clientX: 880, bubbles: true }));
      made.divider.dispatchEvent(new PointerEvent("pointerup", { pointerId, pointerType, bubbles: true }));
      expect([made.dragging, made.divider.getAttribute("aria-label")], pointerType).toEqual([false, "Resize"]);
    }
  });

  it("names its icon in the set's tip under the pointer and on the keyboard's focus", () => {
    const { made } = column();
    made.install(true);
    made.icon.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    expect(shown()).toBe("Board");
    made.icon.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
    expect(shown()).toBeUndefined();
    vi.spyOn(made.icon, "matches").mockImplementation((selector: string) => selector === ":focus-visible");
    made.icon.dispatchEvent(new FocusEvent("focus"));
    expect(shown()).toBe("Board");
    made.icon.dispatchEvent(new FocusEvent("blur"));
    expect(shown()).toBeUndefined();
  });

  it("hands the keyboard back to its icon when Escape closes it over the chat, with no tip drawn by that focus", () => {
    const { made } = column(false);
    made.install(true);
    vi.spyOn(made.icon, "matches").mockImplementation((selector: string) => selector === ":focus-visible");
    made.set(true);
    expect(made.took(new KeyboardEvent("keydown", { key: "Escape" }))).toBe(true);
    expect([made.open, document.activeElement === made.icon, shown()]).toEqual([false, true, undefined]);
  });

  it("closes on its scrim, and gives the window's room to the chat first", () => {
    const { made } = column(false);
    made.install(true);
    made.set(true);
    made.backdrop.click();
    expect(made.open).toBe(false);
    const wide = column(true, 0);
    wide.made.install(true);
    wide.made.set(true);
    expect(wide.made.divider.getAttribute("aria-valuemax")).toBe(String(1280 - CHAT_STRIP * REM));
  });

  it("draws back at 17rem, its least while its head holds the board's icon alone, and stands beside the chat from the window that holds a row of five icons, 1081 px", () => {
    const { made, asked } = column();
    made.install(true);
    made.set(true);
    made.divider.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect([made.element.style.width, made.divider.getAttribute("aria-valuemin")]).toEqual(["272px", "272"]);
    expect([COLUMN_LEAST, COLUMN_LEAST_ROW]).toEqual([17, 22]);
    expect(asked).toContain("(min-width: calc(67.5rem + 1px))");
    expect(15.5 + CHAT_LEAST + COLUMN_LEAST_ROW).toBe(67.5);
  });

  it("goes past the chat's least over the chat to a strip of 6rem, as a change of layout alone, leaves full screen first on Escape, and comes back beside it drawn back, closed or on a narrower window", () => {
    const { made, root, changed, stored, storedOver, flip } = column();
    made.install(true);
    made.set(true);
    // It first opens beside the chat; only the seller's drag or key takes it over.
    expect([made.overChat, root.classList.contains("board-over"), made.divider.style.marginLeft]).toEqual([false, false, ""]);
    const width = (): number => parseFloat(made.element.style.width);
    changed.mockClear();
    const start = width();
    made.divider.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 1, clientX: 900, bubbles: true }));
    made.divider.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 900 - (MEET - width()) - 40, bubbles: true }));
    // Past the chat's least the chat keeps that width, give the turn's last pixel, and the divider moves over it by as much as the column passes it.
    expect([width(), made.overChat, root.classList.contains("board-over"), made.divider.style.marginLeft]).toEqual([MEET + 40, true, true, "-41px"]);
    // Nothing of the frame is drawn again: the move over the chat costs what any other move does.
    expect(changed).not.toHaveBeenCalled();
    made.divider.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: -5_000, bubbles: true }));
    // Past the most is full screen: the chat out of sight, and the column's width its most again once it is left.
    expect([made.full, made.divider.style.marginLeft, made.divider.getAttribute("aria-valuenow")]).toEqual([true, "", String(MOST)]);
    made.divider.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 900 - (MOST - start), bubbles: true }));
    expect([made.full, width(), made.divider.style.marginLeft]).toEqual([false, MOST, `-${MOST - MEET}px`]);
    made.divider.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, bubbles: true }));
    expect([stored.at(-1), storedOver.at(-1)]).toEqual([String(MOST), "1"]);
    // Escape during a drag puts it back over the chat as it was.
    made.divider.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 2, clientX: 900, bubbles: true }));
    made.divider.dispatchEvent(new PointerEvent("pointermove", { pointerId: 2, clientX: 2_000, bubbles: true }));
    expect(made.overChat).toBe(false);
    made.took(new KeyboardEvent("keydown", { key: "Escape" }));
    expect([width(), made.overChat]).toEqual([MOST, true]);
    // Drawn back by the keyboard, it stands beside the chat, and the browser keeps that.
    made.divider.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect([made.overChat, root.classList.contains("board-over"), stored.at(-1), storedOver.at(-1)]).toEqual([false, false, String(COLUMN_LEAST * REM), "0"]);
    made.divider.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    // Full screen by the keyboard keeps the width the column had, beside the chat, for the way back.
    expect([made.full, root.classList.contains("board-full"), storedOver.at(-1)]).toEqual([true, true, "0"]);
    // Escape leaves full screen first, the column open beside the chat at its first-open width; full screen again by the keyboard.
    expect(made.took(new KeyboardEvent("keydown", { key: "Escape" }))).toBe(true);
    expect([made.full, root.classList.contains("board-full"), made.open, made.overChat, width()]).toEqual([false, false, true, false, start]);
    made.divider.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(made.full).toBe(true);
    // Closed, the chat comes back and full screen is not kept; opened again, the column lies where the seller left it before full screen:
    // beside the chat at that width.
    made.set(false);
    expect([made.overChat, made.full, root.classList.contains("board-over")]).toEqual([false, false, false]);
    made.set(true);
    expect([made.overChat, made.full, width()]).toEqual([false, false, start]);
    // A window too narrow for the column beside the chat draws it as the sheet, never dragged over the chat.
    flip(false);
    made.set(true);
    expect([made.over, made.overChat, made.divider.style.marginLeft]).toEqual([true, false, ""]);
  });
});

/** A drag on the column's edge, its pointer placed by how far it is from the sidebar's edge, in rem: the column is the room less that. */
function dragging(made: BoardColumn, pointerId = 1) {
  const from = 900;
  const start = parseFloat(made.element.style.width) || ROOM;
  made.divider.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId, clientX: from, bubbles: true }));
  const to = (width: number): void => { made.divider.dispatchEvent(new PointerEvent("pointermove", { pointerId, clientX: from + start - width, bubbles: true })); };
  return {
    to,
    far: (rem: number): void => { to(ROOM - rem * REM); },
    up: (): void => { made.divider.dispatchEvent(new PointerEvent("pointerup", { pointerId, bubbles: true })); },
  };
}
/** The column opened beside the chat, the theme's quick time on its root, and the clock the test's. */
function pulled(reduced = false) {
  vi.useFakeTimers();
  const made = column(true, 248, undefined, undefined, reduced);
  made.root.style.setProperty("--motion-quick", "120ms");
  made.made.install(true);
  made.made.set(true);
  const width = (): number => parseFloat(made.made.element.style.width);
  const over = (): number => -parseFloat(made.made.divider.style.marginLeft || "0");
  return { ...made, width, over, chat: (): number => ROOM - width() + over() };
}

describe("the pull of the column's edge", () => {
  it("turns from a narrowing chat to a covered one along a curve 1rem round, the chat's width a soft least of the room left to it", () => {
    const { made, width, over, chat } = pulled();
    const hand = dragging(made);
    const turn = (left: number): number => Math.round(CHAT_LEAST * REM + TURN * REM * Math.log1p(Math.exp((left - CHAT_LEAST * REM) / (TURN * REM))) - left);
    // Three places across the turn: 3rem before the chat's least, at it, and 3rem past it, the pointer 1 px apart at each.
    for (const left of [33 * REM, 30 * REM, 27 * REM]) {
      hand.to(ROOM - left);
      expect([width(), over(), chat()], `${left / REM}rem left`).toEqual([ROOM - left, turn(left), left + turn(left)]);
      expect(made.ports.chat.style.minWidth).toBe(`${left + turn(left)}px`);
    }
    // At the chat's least the column already lies over it by ln 2 of a rem: no corner, and no instant at which it starts.
    expect([turn(33 * REM), turn(30 * REM), turn(27 * REM)]).toEqual([1, 11, 49]);
    // Each pixel the pointer moves across the turn gives the chat a share of it, never more than the pointer moved, the shares falling.
    const chats: number[] = [];
    for (let left = 34 * REM; left >= 26 * REM; left -= 8) { hand.to(ROOM - left); chats.push(chat()); }
    const gives = chats.slice(1).map((one, at) => chats[at]! - one);
    expect(gives.every((one) => one >= 0 && one <= 8)).toBe(true);
    expect([gives[0], gives.at(-1)]).toEqual([8, 0]);
    hand.up();
  });


  it("runs the edge ahead of the pointer within the strip by the sidebar, more the nearer it is, by 0.75rem at most", () => {
    const { made, width } = pulled();
    const hand = dragging(made);
    const reach = CHAT_STRIP - TAKE;
    for (const far of [CHAT_STRIP, 5, LET_GO, 3.5, 3.125]) {
      hand.far(far);
      const lead = Math.round(LEAD * REM * (1 - (far - TAKE) / reach) ** 2);
      expect(width() - (ROOM - far * REM), `${far}rem from the sidebar`).toBe(lead);
    }
    expect(width() - (ROOM - 3.125 * REM)).toBeLessThanOrEqual(LEAD * REM);
    expect(made.full).toBe(false);
    hand.up();
  });

  it("is taken at 3rem and glides to full screen, holds through a hand resting between 3rem and 4.5rem, and lets go at 4.5rem", () => {
    const { made, root, width } = pulled();
    const hand = dragging(made);
    hand.far(TAKE);
    // Taken: the column travels to the whole width over the theme's quick time, and is in full screen once there.
    expect([width(), made.full, root.classList.contains("gliding")]).toEqual([ROOM, false, true]);
    vi.advanceTimersByTime(119);
    expect(made.full).toBe(false);
    vi.advanceTimersByTime(1);
    expect([made.full, root.classList.contains("gliding"), root.classList.contains("board-full")]).toEqual([true, false, true]);
    // A hand resting between the take and the let-go does not make it flicker.
    const seen: boolean[] = [];
    for (const far of [3.5, 2.5, 4.4, 3.2, 4.45, 3]) { hand.far(far); vi.advanceTimersByTime(200); seen.push(made.full); }
    expect(seen).toEqual([true, true, true, true, true, true]);
    // Drawn back to 4.5rem, it lets go: out of full screen at the whole width, gliding back under the pointer.
    hand.far(LET_GO);
    expect([made.full, root.classList.contains("board-full"), root.classList.contains("gliding"), width()]).toEqual([false, false, true, ROOM - LET_GO * REM]);
    vi.advanceTimersByTime(120);
    // Let go, the hand resting between the two is under the pull's lead again, and is taken at 3rem only.
    for (const far of [4, 3.2, 4.4]) { hand.far(far); vi.advanceTimersByTime(200); expect(made.full, `${far}rem`).toBe(false); }
    hand.far(TAKE);
    vi.advanceTimersByTime(120);
    expect(made.full).toBe(true);
    // Drawn back past the strip, it is the column again at the width under the pointer.
    hand.far(10);
    vi.advanceTimersByTime(120);
    expect([made.full, width()]).toEqual([false, ROOM - 10 * REM]);
    hand.up();
  });

  it("settles on its most, the strip in sight, when let go within the pull before it is taken, and stays in full screen when let go taken", () => {
    const { made, root, width, stored, storedOver } = pulled();
    const before = width();
    let hand = dragging(made);
    hand.far(4);
    expect(width()).toBeGreaterThan(MOST);
    hand.up();
    expect([width(), made.full, root.classList.contains("gliding"), stored.at(-1), storedOver.at(-1)]).toEqual([MOST, false, true, String(MOST), "1"]);
    vi.advanceTimersByTime(120);
    expect(root.classList.contains("gliding")).toBe(false);
    hand = dragging(made, 2);
    hand.far(2);
    hand.up();
    vi.advanceTimersByTime(120);
    // Let go once taken, it is full screen, and keeps the width it had before the drag for the way back.
    expect([made.full, stored.at(-1)]).toEqual([true, String(MOST)]);
    expect(before).toBeLessThan(MOST);
  });

  it("puts the edge back where the drag began on Escape, from within the pull, on its way to full screen, and from full screen", () => {
    const { made, root, width } = pulled();
    const before = width();
    for (const [pointer, far, wait] of [[1, 4, 0], [2, 2, 60], [3, 2, 200]] as const) {
      const hand = dragging(made, pointer);
      hand.far(far);
      vi.advanceTimersByTime(wait);
      expect(made.took(new KeyboardEvent("keydown", { key: "Escape" }))).toBe(true);
      vi.advanceTimersByTime(200);
      expect([width(), made.full, made.dragging, root.classList.contains("gliding")], `${far}rem after ${wait} ms`).toEqual([before, false, false, false]);
    }
  });

  it("steps by the keyboard a rem a press: one press past the strip is full screen, one press back is the strip, End full screen and Home the least", () => {
    const { made, root, width, stored } = pulled();
    const press = (key: string): void => { made.divider.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); };
    const key = (key: string): void => { press(key); vi.advanceTimersByTime(120); };
    const first = width();
    // End takes the column to full screen as the pull does, over the theme's quick time, and keeps the width it had for the way back.
    press("End");
    expect([made.full, root.classList.contains("gliding"), width()]).toEqual([false, true, ROOM]);
    vi.advanceTimersByTime(120);
    expect([made.full, root.classList.contains("gliding"), stored.at(-1)]).toEqual([true, false, undefined]);
    expect(first).toBeLessThan(MOST);
    key("ArrowRight");
    expect([made.full, width()]).toEqual([false, MOST]);
    key("ArrowRight");
    expect(width()).toBe(MOST - REM);
    key("ArrowLeft");
    expect([made.full, width()]).toEqual([false, MOST]);
    press("ArrowLeft");
    expect([made.full, root.classList.contains("gliding")]).toEqual([false, true]);
    vi.advanceTimersByTime(120);
    expect(made.full).toBe(true);
    // One press back leaves full screen at the whole width and glides to the strip.
    press("ArrowRight");
    expect([made.full, root.classList.contains("gliding"), width()]).toEqual([false, true, MOST]);
    vi.advanceTimersByTime(120);
    key("End");
    expect(made.full).toBe(true);
    key("Home");
    expect([made.full, width()]).toEqual([false, COLUMN_LEAST * REM]);
  });

  it("takes Full screen's label away at the next move or key once closing the column hid its button, with no close of its own, and the event goes on", () => {
    drawnAsABrowserDraws();
    const { made } = column();
    made.install(true);
    const button = made.head.querySelector<HTMLButtonElement>(".board-full")!;
    const further = vi.fn();
    document.addEventListener("keydown", further);
    for (const next of [() => window.dispatchEvent(new PointerEvent("pointermove")), () => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))]) {
      made.set(true);
      button.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
      expect(shown()).toBe("Full screen");
      made.set(false);
      expect([made.open, button.getClientRects().length, shown()], "closed, the label still up until the seller's next move").toEqual([false, 0, "Full screen"]);
      next();
      expect(shown()).toBeUndefined();
    }
    expect(further, "the Escape went on to the page").toHaveBeenCalledOnce();
    document.removeEventListener("keydown", further);
  });

  it("returns to its first-open width on 退出全屏 and on Escape, and keeps it, whether full screen came by its button, the pull or End", () => {
    const { made, width, stored, storedOver } = pulled();
    const first = Math.min(MEET, 30 * REM, Math.max(24 * REM, 0.26 * innerWidth));
    const button = made.head.querySelector<HTMLButtonElement>(".board-full")!;
    const key = (key: string): void => { made.divider.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); vi.advanceTimersByTime(120); };
    const ways: readonly [string, () => void][] = [
      ["its button", () => { key("Home"); button.click(); }],
      ["the pull", () => { key("End"); key("ArrowRight"); const hand = dragging(made); hand.far(2); vi.advanceTimersByTime(120); hand.up(); }],
      ["End", () => { key("Home"); key("ArrowLeft"); key("End"); }],
    ];
    const leaves: readonly [string, () => void][] = [
      ["退出全屏", () => { button.click(); }],
      ["Escape", () => { expect(made.took(new KeyboardEvent("keydown", { key: "Escape" }))).toBe(true); }],
    ];
    for (const [left, leave] of leaves) for (const [way, enter] of ways) {
      enter();
      expect([made.full, button.getAttribute("aria-label")], `${way}, ${left}`).toEqual([true, "Exit full screen"]);
      leave();
      expect([made.full, width(), stored.at(-1), storedOver.at(-1)], `${way}, ${left}`).toEqual([false, first, String(first), "0"]);
    }
    expect(first).not.toBe(COLUMN_LEAST * REM);
    // Opened again, it stands at that width, and so does the column of a page loaded again on what the browser kept.
    made.set(false);
    made.set(true);
    expect(width()).toBe(first);
    const reloaded = column(true, 248, stored.at(-1), storedOver.at(-1));
    reloaded.made.install(true);
    reloaded.made.set(true);
    expect([reloaded.made.full, parseFloat(reloaded.made.element.style.width), reloaded.made.overChat]).toEqual([false, first, false]);
  });

  it("keeps the width it had before a drag into full screen for the next opening, and Escape after the drag lands on its first-open width", () => {
    const { made, width, stored } = pulled();
    const first = Math.min(MEET, 30 * REM, Math.max(24 * REM, 0.26 * innerWidth));
    made.divider.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    const hand = dragging(made);
    hand.far(2);
    vi.advanceTimersByTime(120);
    hand.up();
    expect([made.full, stored.at(-1)]).toEqual([true, String(COLUMN_LEAST * REM)]);
    made.set(false);
    made.set(true);
    expect([made.full, width()]).toEqual([false, COLUMN_LEAST * REM]);
    const again = dragging(made, 2);
    again.far(2);
    vi.advanceTimersByTime(120);
    again.up();
    made.took(new KeyboardEvent("keydown", { key: "Escape" }));
    expect([made.full, width()]).toEqual([false, first]);
  });

  it("takes an Escape that comes while it glides to full screen, by End or by a pull let go before it arrived, and leaves at its first-open width", () => {
    const first = Math.min(MEET, 30 * REM, Math.max(24 * REM, 0.26 * innerWidth));
    const ways: readonly [string, (made: BoardColumn) => void][] = [
      ["End", (made) => { made.divider.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })); }],
      ["a pull let go", (made) => { const hand = dragging(made); hand.far(2); hand.up(); }],
    ];
    for (const [way, enter] of ways) {
      const { made, root, width, stored, storedOver } = pulled();
      made.divider.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      enter(made);
      vi.advanceTimersByTime(60);
      expect([made.full, root.classList.contains("gliding")], way).toEqual([false, true]);
      const kept = stored.length;
      // Taken from the divider, where the board's own Escape is not inside the column: the board's, so the chat's Stop never hears it.
      const escape = new KeyboardEvent("keydown", { key: "Escape" });
      Object.defineProperty(escape, "target", { value: made.divider });
      expect(made.took(escape), way).toBe(true);
      expect([made.full, root.classList.contains("gliding"), width(), stored.slice(kept), storedOver.at(-1)], way).toEqual([false, false, first, [String(first)], "0"]);
      vi.advanceTimersByTime(500);
      expect([made.full, width()], way).toEqual([false, first]);
      vi.useRealTimers();
      vi.restoreAllMocks();
      document.body.replaceChildren();
    }
  });

  it("acts on a key or a press that comes while it glides from where the glide was going, never from part of the way", () => {
    const { made, root, width } = pulled();
    const press = (key: string): void => { made.divider.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); };
    // Home while the column glides to full screen: full screen lands at once, and Home takes it to the least.
    press("End");
    vi.advanceTimersByTime(30);
    expect(root.classList.contains("gliding")).toBe(true);
    press("Home");
    vi.advanceTimersByTime(200);
    expect([made.full, width(), root.classList.contains("gliding")]).toEqual([false, COLUMN_LEAST * REM, false]);
    // A second → while the first glides back from full screen steps a rem past the strip, never back to full screen.
    press("End");
    vi.advanceTimersByTime(120);
    press("ArrowRight");
    vi.advanceTimersByTime(30);
    press("ArrowRight");
    vi.advanceTimersByTime(200);
    expect([made.full, width()]).toEqual([false, MOST - REM]);
    // A press on the edge while it glides to full screen, let go without a move, leaves it in full screen.
    press("End");
    vi.advanceTimersByTime(30);
    made.divider.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 9, clientX: 300, bubbles: true }));
    made.divider.dispatchEvent(new PointerEvent("pointerup", { pointerId: 9, bubbles: true }));
    vi.advanceTimersByTime(200);
    expect([made.full, made.element.style.width]).toEqual([true, ""]);
  });

  it("says it glides while it travels, so the app keeps the root's class through a draw of its own", () => {
    const { made } = pulled();
    made.divider.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(made.gliding).toBe(true);
    vi.advanceTimersByTime(120);
    expect(made.gliding).toBe(false);
  });

  it("leaves the column's width beside the chat as it was on 退出全屏 from the sheet over the chat", () => {
    const { made, stored, flip } = column(false, 248, "400", "0");
    made.install(true);
    made.set(true);
    const button = made.head.querySelector<HTMLButtonElement>(".board-full")!;
    button.click();
    expect(made.full).toBe(true);
    button.click();
    expect([made.full, stored]).toEqual([false, ["400"]]);
    flip(true);
    made.set(true);
    expect(made.element.style.width).toBe("400px");
  });

  it("under reduced motion neither runs ahead nor glides, and changes place at the same two distances; the turn stays", () => {
    const { made, root, width, over } = pulled(true);
    const hand = dragging(made);
    hand.to(ROOM - 30 * REM);
    expect(over()).toBe(11);
    for (const far of [5, 4, 3.5]) { hand.far(far); expect(width(), `${far}rem`).toBe(ROOM - far * REM); }
    hand.far(TAKE);
    // No time passes: the column is in full screen at once.
    expect([made.full, root.classList.contains("gliding")]).toEqual([true, false]);
    hand.far(4.4);
    expect(made.full).toBe(true);
    hand.far(LET_GO);
    expect([made.full, width(), root.classList.contains("gliding")]).toEqual([false, ROOM - LET_GO * REM, false]);
    hand.far(4);
    hand.up();
    expect([width(), root.classList.contains("gliding")]).toEqual([MOST, false]);
    const key = (key: string): void => { made.divider.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); };
    key("ArrowLeft");
    expect(made.full).toBe(true);
    key("ArrowRight");
    expect([made.full, width()]).toEqual([false, MOST]);
  });
});
