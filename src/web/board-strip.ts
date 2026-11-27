import type { DraftStorage } from "./board-drafts.js";

export const ORDER_PREFIX = "cmx-board-order:";
export const UNPINNED_PREFIX = "cmx-board-unpinned:";
const KEPT_MAX = 400;

type Store = Pick<DraftStorage, "read" | "write" | "remove"> | undefined;

/** A list of names kept in the browser for the account, read again when the account changes. */
class Kept {
  #account: string | undefined;
  #held: string[] = [];
  constructor(readonly storage: Store, readonly prefix: string, readonly account: () => string | undefined) {}

  forget(): void { this.#account = undefined; this.#held = []; }

  get names(): string[] {
    const account = this.account();
    if (account !== this.#account) {
      this.#account = account;
      this.#held = [];
      if (account === undefined) return this.#held;
      try {
        const kept = JSON.parse(this.storage?.read(`${this.prefix}${account}`) ?? "[]") as unknown;
        if (Array.isArray(kept)) this.#held = [...new Set(kept.filter((one): one is string => typeof one === "string" && one !== ""))].slice(-KEPT_MAX);
      } catch { /* none kept */ }
    }
    return this.#held;
  }

  set names(names: string[]) {
    this.#held = [...new Set(names)].slice(-KEPT_MAX);
    if (this.#account === undefined) return;
    const name = `${this.prefix}${this.#account}`;
    try { if (this.#held.length === 0) this.storage?.remove(name); else this.storage?.write(name, JSON.stringify(this.#held)); } catch { /* the copy is not kept */ }
  }
}

/**
 * The strip's order as the seller set it, and the plugins' boards the seller took off it, kept in the browser for the account
 * (`cmx-board-order:`, `cmx-board-unpinned:`). A tab the seller never moved stands where the board's own order puts it, after the tab it
 * follows there; a board taken off keeps its place for when it comes back.
 */
export class StripPlaces {
  readonly #order: Kept;
  readonly #off: Kept;
  constructor(storage: Store, account: () => string | undefined) {
    this.#order = new Kept(storage, ORDER_PREFIX, account);
    this.#off = new Kept(storage, UNPINNED_PREFIX, account);
  }

  /** `keys`, the board's own order of everything that may stand on the strip, in the seller's order. */
  ordered(keys: readonly string[]): readonly string[] {
    const kept = this.#order.names.filter((key) => keys.includes(key));
    const out = [...kept];
    keys.forEach((key, at) => {
      if (out.includes(key)) return;
      const before = keys.slice(0, at).reverse().find((one) => out.includes(one));
      out.splice(before === undefined ? 0 : out.indexOf(before) + 1, 0, key);
    });
    return out;
  }

  /** The tabs on the strip take the order `shown` gives them; every other key keeps its place. */
  set(all: readonly string[], shown: readonly string[]): void {
    let at = 0;
    this.#order.names = all.map((key) => (shown.includes(key) ? shown[at++]! : key));
  }

  rename(from: string, to: string): void {
    this.#order.names = this.#order.names.map((key) => (key === from ? to : key));
    if (this.#off.names.includes(from)) this.#off.names = this.#off.names.map((key) => (key === from ? to : key));
  }

  /** Another window of the browser changed them: the next look reads them again. */
  reread(): void { this.#order.forget(); this.#off.forget(); }

  isOff(key: string): boolean { return this.#off.names.includes(key); }
  takeOff(key: string): void { if (!this.isOff(key)) this.#off.names = [...this.#off.names, key]; }
  putBack(key: string): void { if (this.isOff(key)) this.#off.names = this.#off.names.filter((one) => one !== key); }
  /** A board deleted: its place goes, so a new board of its name stands where a new one does. */
  forget(key: string): void { if (this.#order.names.includes(key)) this.#order.names = this.#order.names.filter((one) => one !== key); this.putBack(key); }
}

export interface DragPorts {
  /** The width of the strip's fade at an end where tabs lie past it. */
  readonly fade: () => number;
  /** The strip's fades drawn again as it scrolls under the tab in hand. */
  readonly cut: () => void;
  /** Let go: the tabs on the strip, by their keys, in their new order. */
  readonly moved: (keys: readonly string[]) => void;
  /** A drag ended, whichever way: the keyboard goes back to the tab shown. */
  readonly ended?: () => void;
}

/**
 * A tab dragged along the strip (sheet 2 §二, as Chrome's and VS Code's): a press that moves more than 4 px lifts it; it follows the pointer
 * inside the strip, short of a fade, the others stepping aside where it would land; near a faded end the strip scrolls under it. Let go
 * inside the strip, it stays; let go outside it, Escape, a cancel, or the pointer lost with no button down put it back. A press that does
 * not move is a press. Each tab's wrap carries its key (`data-key`).
 *
 * The press owns the pointer from the moment it goes down until it ends, by listeners on the window rather than a capture, which would
 * take the click from the tab pressed; each way it ends takes them away.
 */
export function dragAlong(strip: HTMLElement, ports: DragPorts): void {
  interface Drag {
    readonly key: string; readonly x: number; readonly id: number; lifted: boolean; last: number;
    wraps: HTMLElement[]; from: number; to: number; rects: DOMRect[]; scroll0: number;
  }
  let drag: Drag | undefined;
  let scrolling = 0;
  let justMoved = false;
  const wrapsOf = (): HTMLElement[] => [...strip.children].filter((one): one is HTMLElement => one instanceof HTMLElement && one.dataset["key"] !== undefined);
  const lift = (held: Drag): void => {
    held.lifted = true;
    held.wraps = wrapsOf();
    held.from = held.wraps.findIndex((one) => one.dataset["key"] === held.key);
    held.to = held.from;
    held.rects = held.wraps.map((one) => one.getBoundingClientRect());
    held.scroll0 = strip.scrollLeft;
    const mine = held.wraps[held.from];
    if (mine === undefined) { settle(false); return; }
    mine.classList.add("lifted");
    strip.classList.add("dragging");
  };
  const follow = (held: Drag): void => {
    const mine = held.rects[held.from]!, el = held.wraps[held.from]!;
    const room = strip.getBoundingClientRect(), fade = ports.fade(), moved = strip.scrollLeft - held.scroll0;
    const lo = room.left + (strip.classList.contains("cut-start") ? fade : 0);
    const hi = Math.max(lo, room.right - mine.width - (strip.classList.contains("cut-end") ? fade : 0));
    const left = Math.min(Math.max(mine.left - moved + held.last - held.x, lo), hi);
    el.style.transform = `translateX(${left - mine.left + moved}px)`;
    const centre = left + mine.width / 2;
    let to = held.from;
    held.rects.forEach((rect, at) => {
      const middle = rect.left + rect.width / 2 - moved;
      if (at > held.from && centre > middle) to = Math.max(to, at);
      if (at < held.from && centre < middle) to = Math.min(to, at);
    });
    const width = mine.width;
    held.wraps.forEach((one, at) => {
      if (at === held.from) return;
      const shift = at > held.from && at <= to ? -width : at < held.from && at >= to ? width : 0;
      one.style.transform = shift === 0 ? "" : `translateX(${shift}px)`;
    });
    held.to = to;
  };
  const moving = (event: PointerEvent): void => {
    const held = drag;
    if (held === undefined || event.pointerId !== held.id) return;
    // The release went where the page did not hear it: the press is over, and what it moved goes back.
    if ((event.buttons & 1) === 0) { settle(false); return; }
    if (!held.lifted && Math.abs(event.clientX - held.x) > 4) lift(held);
    if (!held.lifted || drag !== held) return;
    held.last = event.clientX;
    follow(held);
    const room = strip.getBoundingClientRect(), fade = ports.fade();
    const step = event.clientX > room.right - fade ? 6 : event.clientX < room.left + fade ? -6 : 0;
    cancelAnimationFrame(scrolling);
    if (step === 0) return;
    const run = (): void => {
      if (drag !== held) return;
      const was = strip.scrollLeft;
      strip.scrollLeft += step;
      if (strip.scrollLeft === was) return;
      ports.cut();
      follow(held);
      scrolling = requestAnimationFrame(run);
    };
    scrolling = requestAnimationFrame(run);
  };
  const released = (event: PointerEvent): void => {
    if (drag === undefined || event.pointerId !== drag.id) return;
    const room = strip.getBoundingClientRect();
    settle(event.clientX >= room.left && event.clientX <= room.right && event.clientY >= room.top && event.clientY <= room.bottom);
  };
  const cancelled = (event: PointerEvent): void => { if (drag !== undefined && event.pointerId === drag.id) settle(false); };
  const lost = (): void => settle(false);
  const escape = (event: KeyboardEvent): void => { if (event.key === "Escape" && drag?.lifted === true) { event.preventDefault(); event.stopPropagation(); settle(false); } };
  const own = (on: boolean): void => {
    const way = on ? window.addEventListener.bind(window) : window.removeEventListener.bind(window);
    way("pointermove", moving as EventListener, true);
    way("pointerup", released as EventListener, true);
    way("pointercancel", cancelled as EventListener, true);
    way("blur", lost);
    way("keydown", escape as EventListener, true);
  };
  function settle(keep: boolean): void {
    const held = drag;
    drag = undefined;
    own(false);
    cancelAnimationFrame(scrolling);
    if (held === undefined || !held.lifted) return;
    for (const one of held.wraps) one.style.transform = "";
    held.wraps[held.from]?.classList.remove("lifted");
    strip.classList.remove("dragging");
    justMoved = true;
    setTimeout(() => { justMoved = false; }, 0);
    if (keep && held.to !== held.from) {
      const keys = held.wraps.map((one) => one.dataset["key"]!);
      const [key] = keys.splice(held.from, 1);
      keys.splice(held.to, 0, key!);
      ports.moved(keys);
    }
    ports.ended?.();
  }
  strip.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const wrap = target?.closest<HTMLElement>(".board-tab-wrap");
    if (wrap === undefined || wrap === null || event.button !== 0 || target?.closest(".tab-close, .tab-rename") !== null) return;
    const key = wrap.dataset["key"];
    if (key === undefined) return;
    if (drag !== undefined) settle(false);
    drag = { key, x: event.clientX, id: event.pointerId, lifted: false, last: event.clientX, wraps: [], from: -1, to: -1, rects: [], scroll0: 0 };
    own(true);
  });
  // The press that ends a drag is not a press on the tab.
  strip.addEventListener("click", (event) => { if (justMoved) { event.stopPropagation(); event.preventDefault(); } }, true);
}
