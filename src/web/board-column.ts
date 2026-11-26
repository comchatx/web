import { fill, h, svg } from "./dom.js";
import { giveBack, hideTip, redrawTip, tip } from "./forms.js";
import type { StringKey } from "./strings.js";

/**
 * The chat's least width, the column's least, and the strip of the chat left in sight at the column's most, in rem
 * (`spikes/board/README.md`, "The divider."). The column's least is 17rem while its head holds the board's icon alone, and 22rem with a
 * row of five: the column stands beside the chat on a window that holds the sidebar's 15.5rem, the chat at its least, the divider's line
 * and the column at its least with a row of five; on a narrower one it lies over the chat as a sheet. Beside the chat it drags past the
 * chat's least, over the chat, as far as the strip. `app.css` holds the same sum.
 */
export const CHAT_LEAST = 30;
export const COLUMN_LEAST = 17;
export const COLUMN_LEAST_ROW = 22;
export const CHAT_STRIP = 6;
/**
 * The pull of the column's edge, in rem (`spikes/board/README.md`, "Pulling the edge"). `TURN`: how round the turn from a narrowing chat
 * to a covered one is. Within the strip by the sidebar, measured from the sidebar's edge to the pointer: the edge runs ahead of the pointer by up to `LEAD`, is taken to full screen
 * at `TAKE`, and let go at `LET_GO`.
 */
export const TURN = 1;
export const LEAD = 0.75;
export const TAKE = 3;
export const LET_GO = 4.5;
const SIDEBAR = 15.5;
/** Where the browser keeps the width the seller gave the column, for every conversation, and whether they left it over the chat. */
export const WIDTH_KEY = "cmx-board-width";
export const OVER_KEY = "cmx-board-over";

const icon = (...paths: readonly string[]): SVGElement => svg("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" },
  ...paths.map((d) => svg("path", { d })));
/**
 * The column's pages, an icon each in a row at the chat's top right. The board is the one page there is, at the row's right end, so its
 * place holds as pages come.
 */
const PAGES = [{ id: "board", name: "board.board", glyph: ["M9 5H7a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2", "M9 3.5h6v3H9z", "M9.5 11h5", "M9.5 15h3.5"] }] as const satisfies readonly { readonly id: string; readonly name: StringKey; readonly glyph: readonly string[] }[];
/** The board's own mark, on its icon and on the chat's row for a card. */
export const boardIcon = (): SVGElement => icon(...PAGES[0].glyph);

/** Full screen's mark: four corners out, and in full screen four corners in. */
const FULL = ["M4 9V4h5", "M15 4h5v5", "M20 15v5h-5", "M9 20H4v-5"];
const FULL_EXIT = ["M9 4v5H4", "M20 9h-5V4", "M15 20v-5h5", "M4 15h5v5"];

/**
 * The column's first-open width, in px: the board's own, from 24rem to 30rem by the window, never past `meet`, the widest it stands
 * beside the chat. 退出全屏 returns to it (ruled 2026-11-12).
 */
const firstOpen = (meet: number, rem: number): number => Math.min(meet, 30 * rem, Math.max(24 * rem, 0.26 * innerWidth));
const remOf = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
/** ln(1 + eˣ), which is x itself long before eˣ leaves the floating point's range. */
const softplus = (x: number): number => (x > 30 ? x : Math.log1p(Math.exp(x)));

export type ColumnPorts = {
  readonly say: (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;
  /** The chat's top row, where the icons stand while the column is closed. */
  readonly top: HTMLElement;
  /** The chat's page, whose least width the column gives while it stands beside it. */
  readonly chat: HTMLElement;
  /** The app's root, which the column stands in beside the page, and whose width it is laid out in. */
  readonly root: HTMLElement;
  /** The sidebar, whose width the chat shares the window with while it is shown beside the chat. */
  readonly sidebarWidth: () => number;
  /** The column is opening: on a narrow window the sidebar's sheet closes, as the board's lies where it was. */
  readonly opening: () => void;
  /** The column opened or closed, or its width moved: the app draws its frame again. */
  readonly changed: () => void;
  /** The column opened or shut by `set`: by the seller, or by what the page does for them. */
  readonly moved?: (open: boolean) => void;
  /** Where the focus lands as the sheet opens over the chat, which goes inert behind it: the board's tab in view. */
  readonly landing?: () => HTMLElement;
  readonly store: { readonly read: (key: string) => string | null; readonly write: (key: string, value: string) => void };
};

/**
 * The column on the chat's right whose pages are icons, the board its only one: the row of icons, the divider that drags beside the chat,
 * and the sheet over it on a window too narrow for both. Opened beside the chat it stays opened through a window that narrows and widens
 * again; over the chat it is one look. It holds the board's page, which draws itself.
 */
export class BoardColumn {
  readonly row = h("div", { class: "page-icons" });
  readonly #count = h("span", { class: "page-count", "aria-hidden": "true" });
  readonly #dot = h("span", { class: "page-dot", "aria-hidden": "true", hidden: true });
  readonly #icon: HTMLButtonElement;
  /** Full screen, in the column's head, just before the board's icon while the column is open. */
  readonly #fullButton = h("button", { type: "button", class: "page-icon board-full", hidden: true }) as HTMLButtonElement;
  /** The board has all the room it shares with the chat; never kept across a close. */
  #full = false;
  readonly divider = h("div", { class: "board-divider", role: "separator", tabindex: "0", "aria-orientation": "vertical", "aria-controls": "board" });
  readonly backdrop = h("div", { class: "board-backdrop" });
  readonly element: HTMLElement;
  readonly #beside: MediaQueryList;
  #installed = false;
  #open = false;
  /** Opened beside the chat, the seller's choice, which a window that narrows and widens again keeps. */
  #wanted = false;
  #width: number | undefined;
  /** The seller left the column over the chat; a column left beside it stays beside it on a narrower window. */
  #wantedOver: boolean;
  /** How far the column lies over the chat beside the sidebar, in px. */
  #overChat = 0;
  #drag: { readonly pointer: number; readonly from: number; readonly width: number; readonly wanted: number | undefined; readonly wantedOver: boolean; readonly full: boolean; moved: boolean } | undefined;
  /** The width the pull gives the column during a drag, past its most, until the drag ends. */
  #pulled: number | undefined;
  /** The pull has the edge: it travels to the whole width, or stands there in full screen, until the pointer draws back to `LET_GO`. */
  #held = false;
  #gliding: ReturnType<typeof setTimeout> | undefined;
  /** What runs once the column is where it is gliding to. */
  #landing: (() => void) | undefined;
  readonly #calm: MediaQueryList;

  constructor(readonly ports: ColumnPorts, readonly head: HTMLElement, readonly page: HTMLElement) {
    this.#beside = matchMedia(`(min-width: calc(${SIDEBAR + CHAT_LEAST + COLUMN_LEAST_ROW}rem + 1px))`);
    this.#calm = matchMedia("(prefers-reduced-motion: reduce)");
    this.element = h("aside", { class: "board", id: "board", hidden: true }, head, page);
    this.#icon = h("button", { type: "button", class: "page-icon", "aria-controls": "board", onclick: () => this.set(!this.#open) }, boardIcon(), this.#count, this.#dot);
    this.row.append(this.#icon);
    head.append(this.#fullButton);
    this.#fullButton.addEventListener("click", () => { if (this.#full) this.#leaveFull(); else this.setFull(true); });
    tip(this.#fullButton, () => [ports.say(this.#full ? "base.fullExit" : "base.full")]);
    // The press on the backdrop leaves the focus where it is, so the sheet's close can give it back to what opened the sheet.
    this.backdrop.addEventListener("mousedown", (event) => { event.preventDefault(); });
    this.backdrop.addEventListener("click", () => this.set(false));
    const width = Number(ports.store.read(WIDTH_KEY));
    this.#width = width > 0 ? width : undefined;
    this.#wantedOver = this.#width !== undefined && ports.store.read(OVER_KEY) === "1";
    tip(this.#icon, () => [ports.say(PAGES[0].name)]);
    this.#wireDivider();
    this.#beside.addEventListener("change", () => {
      this.#endDrag(true);
      const held = this.element.contains(document.activeElement);
      this.#open = this.#installed && (this.#beside.matches ? this.#open || this.#wanted : false);
      this.ports.changed();
      if (held && !this.#open) this.#icon.focus({ preventScroll: true });
    });
    addEventListener("resize", () => this.drawWidth());
  }

  get open(): boolean { return this.#open; }
  /** The board has the whole room it shares with the chat: beside it the chat is out of sight; over it the sheet is the window's width. */
  get full(): boolean { return this.#open && this.#full; }

  /** Full screen on or off, by its control, the divider or Escape; the next opening is beside the chat at the width it had. */
  setFull(full: boolean): void {
    if (!this.#installed || !this.#open || this.#full === full) return;
    this.#settle();
    this.#full = full;
    redrawTip();
    this.ports.changed();
  }
  /**
   * 退出全屏, by its button or by Escape: the board returns to its first-open width beside the chat and keeps it, however full screen was
   * entered (ruled 2026-11-12). Over the chat the sheet keeps its own width, and the column's beside it is left as it was.
   */
  #leaveFull(): void {
    if (this.#beside.matches) { this.#width = Math.round(firstOpen(this.#bounds().meet, remOf())); this.#wantedOver = false; this.#keepWidth(); }
    this.setFull(false);
  }
  get installed(): boolean { return this.#installed; }
  /** The column stands beside the chat, rather than over it. */
  get beside(): boolean { return this.#beside.matches; }
  /** Over the chat, the column is the one thing to reach until it is closed. */
  get over(): boolean { return this.#open && !this.#beside.matches; }
  /** Beside the sidebar, the seller dragged the column past the chat's least and it lies over part of the chat, the rest still in reach. */
  get overChat(): boolean { return this.#overChat > 0; }
  /** Whether the column, opened now, would lie over the chat: on a window with no room beside it, or at a width the seller dragged over it. */
  get covers(): boolean { return !this.#beside.matches || (this.#width !== undefined && this.#wantedOver); }
  get dragging(): boolean { return this.#drag !== undefined; }
  /** The column is travelling to full screen or back: the app keeps the root's `gliding` through a draw of its own. */
  get gliding(): boolean { return this.#gliding !== undefined; }
  get icon(): HTMLButtonElement { return this.#icon; }

  /** Whether the account's packages show the board: without them, no icon and no column. */
  install(installed: boolean): void {
    if (this.#installed === installed) return;
    this.#installed = installed;
    if (!installed) { this.#open = false; this.#wanted = false; }
    this.ports.changed();
  }

  /** What opened the column, where the focus goes back when it closes: the board's icon, or a control that opened it, as the line beside cx's desk. */
  #opener: HTMLElement | undefined;

  /**
   * Opens or closes the column. The focus that was in it goes back to what opened it — `from`, a control outside the board that opened
   * it, while that control still shows — else to the board's icon.
   */
  set(open: boolean, from?: HTMLElement): void {
    if (!this.#installed) return;
    const held = !open && this.element.contains(document.activeElement);
    if (open && !this.#open) this.#opener = from;
    const moved = open !== this.#open;
    this.#open = open;
    if (!open) { this.#full = false; this.#settle(); }
    if (moved) this.ports.moved?.(open);
    if (this.#beside.matches) this.#wanted = open;
    if (open) this.ports.opening();
    this.ports.changed();
    // Over the chat, which goes inert behind it, the sheet opens on its tab in view; a control that opened it at a place moves it on after.
    if (open && moved && this.over) this.ports.landing?.().focus({ preventScroll: true });
    if (open) return;
    const back = this.#back();
    this.#opener = undefined;
    if (held) giveBack(back);
  }

  #back(): HTMLElement {
    const opener = this.#opener;
    return opener !== undefined && opener.isConnected && opener.closest("[hidden]") === null ? opener : this.#icon;
  }

  /** Escape over the chat closes the sheet and gives the focus back to what opened it; beside it, inside the board, it does nothing more. */
  took(event: KeyboardEvent): boolean {
    if (this.#drag !== undefined) { this.#endDrag(false); return true; }
    // As the divider's keys do, Escape acts from where a glide was going: one on its way to full screen leaves full screen.
    this.#land();
    if (this.full) { this.#leaveFull(); return true; }
    if (this.over) { const back = this.#back(); this.set(false); giveBack(back); return true; }
    return this.#open && event.target instanceof Node && this.element.contains(event.target);
  }

  /** The frame as the column draws it: the row's place, the icon's count and name, the board's own where it gives one, and what is hidden. */
  draw(count: number, name?: string, dot = false): void {
    const say = this.ports.say;
    // The row stands at the chat's top right; while the column is open it is in the column's head, in the same place on the screen.
    const home = this.#open ? this.head : this.ports.top;
    if (this.row.parentElement !== home) {
      const held = this.row.contains(document.activeElement) ? document.activeElement as HTMLElement : undefined;
      home.append(this.row);
      held?.focus({ preventScroll: true });
    }
    this.row.hidden = !this.#installed;
    this.element.hidden = !this.#installed;
    this.divider.hidden = !this.#installed || !this.#open || !this.#beside.matches;
    this.#fullButton.hidden = !this.#open;
    this.#fullButton.setAttribute("aria-label", say(this.#full ? "base.fullExit" : "base.full"));
    this.#fullButton.setAttribute("aria-pressed", String(this.full));
    fill(this.#fullButton, icon(...(this.#full ? FULL_EXIT : FULL)));
    this.ports.root.classList.toggle("board-full", this.full);
    this.#icon.setAttribute("aria-pressed", String(this.#open));
    this.#icon.classList.toggle("on", this.#open);
    this.#icon.setAttribute("aria-label", name ?? (count > 0 ? say("board.boardPending", { n: count }) : say("board.board")));
    this.#count.textContent = count > 0 ? String(count) : "";
    this.#count.hidden = count === 0;
    // Something landed on a board of the base's own the seller has not seen, while the icon carries no number: the dot.
    this.#dot.hidden = count > 0 || !dot;
    this.element.setAttribute("aria-label", say("board.board"));
    this.drawWidth();
  }

  /**
   * The column's least and most, in px, `meet`, the widest it stands beside the chat before going over it, and `room`, what the chat and
   * the column share: its most leaves the strip of the chat in sight.
   */
  #bounds(): { readonly least: number; readonly most: number; readonly meet: number; readonly room: number } {
    const rem = remOf();
    const room = this.ports.root.clientWidth - this.ports.sidebarWidth() - this.divider.offsetWidth;
    const least = Math.round(COLUMN_LEAST * rem);
    return { least, most: Math.round(Math.max(least, room - CHAT_STRIP * rem)), meet: Math.round(Math.max(least, room - CHAT_LEAST * rem)), room };
  }

  drawWidth(): void {
    // A board whose package is gone holds the chat to no width.
    if (!this.#installed) { this.ports.chat.style.minWidth = ""; return; }
    const rem = remOf();
    const { least, most, meet, room } = this.#bounds();
    // The column first opens beside the chat; only the seller's own drag or key takes it over the chat, and the browser keeps that.
    const first = firstOpen(meet, rem);
    const kept = this.#width === undefined ? undefined : Math.min(this.#width, this.#wantedOver ? most : meet);
    // While the pull has the edge it stands where the pull puts it, past the column's most, for as long as the drag lasts.
    const width = this.#pulled !== undefined ? Math.round(Math.min(room, Math.max(least, this.#pulled))) : Math.round(Math.min(most, Math.max(least, kept ?? first)));
    const beside = this.#beside.matches;
    const drawn = this.#open && beside && !this.full;
    const root = this.ports.root;
    // Over the chat the sheet keeps its own width; the seller's is the column's beside it.
    this.element.style.width = beside && !this.full ? `${width}px` : "";
    // The turn from narrowing to covering is a curve, not a corner: the chat's width is a soft least of the room left to it, so it
    // narrows more and more slowly as it nears its least, and the divider and the column move over it by as much, the move having no instant.
    const left = room - width;
    const chat = CHAT_LEAST * rem + TURN * rem * softplus((left - CHAT_LEAST * rem) / (TURN * rem));
    const over = drawn ? Math.max(0, Math.round(chat - left)) : 0;
    this.divider.style.marginLeft = over > 0 ? `${-over}px` : "";
    this.ports.chat.style.minWidth = drawn ? `${left + over}px` : "";
    this.#overChat = over;
    root.classList.toggle("board-over", over > 0);
    this.divider.setAttribute("aria-label", this.ports.say("board.resize"));
    this.divider.setAttribute("aria-valuemin", String(least));
    this.divider.setAttribute("aria-valuemax", String(most));
    this.divider.setAttribute("aria-valuenow", String(this.full ? most : Math.min(most, width)));
    redrawTip();
    // Going over the chat changes the layout alone: the chat stays in reach and nothing of the frame is drawn again, so the move costs what any other does.
  }

  /**
   * The divider moved: the column takes the width at once, within its least and most. Past its most, beside the chat, the pull takes it to
   * full screen; a key back from full screen lets it go, to the width asked.
   */
  #resize(width: number): void {
    const { least, most, meet } = this.#bounds();
    if (this.#beside.matches && width > most) { if (!this.#full && !this.#held) this.#take(); return; }
    this.#width = Math.round(Math.min(most, Math.max(least, width)));
    this.#wantedOver = this.#width > meet;
    if (this.#full && this.#drag === undefined) { this.#letGo(undefined); return; }
    const was = this.#full;
    this.#full = false;
    if (was && this.#open) this.ports.changed(); else this.drawWidth();
  }

  /**
   * The pointer's drag near the whole width. Up to the column's most the edge is under the pointer. Past it, within the strip, the edge
   * runs ahead of the pointer, a little and then more; at `TAKE` it is taken and travels the rest alone. Taken, it stays until the
   * pointer has drawn back to `LET_GO`, so a hand resting at the threshold does not make it flicker.
   */
  #pull(width: number): void {
    const { most, room } = this.#bounds();
    const rem = remOf();
    const far = room - width;
    if (this.#held) {
      if (far >= LET_GO * rem) this.#letGo(far >= room - most ? undefined : width);
      if (!this.#held && this.#pulled === undefined) this.#resize(width);
      return;
    }
    if (width <= most) { this.#pulled = undefined; this.#resize(width); return; }
    if (far <= TAKE * rem) { this.#take(); return; }
    const reach = room - most - TAKE * rem;
    const lead = this.#calm.matches ? 0 : LEAD * rem * (1 - (far - TAKE * rem) / reach) ** 2;
    this.#width = most;
    this.#wantedOver = true;
    this.#pulled = width + lead;
    this.drawWidth();
  }

  /** The pull takes the edge: the column travels to the whole width, and there it is in full screen. */
  #take(): void {
    this.#held = true;
    this.#pulled = this.#bounds().room;
    this.#glide(() => { if (!this.#held) return; this.#pulled = undefined; this.#full = true; this.ports.changed(); });
  }

  /** The pull lets go: the column leaves full screen at the whole width and travels back to `width`, or to the width it keeps. */
  #letGo(width: number | undefined): void {
    this.#held = false;
    if (this.#full) { this.#full = false; this.#pulled = this.#bounds().room; this.ports.changed(); }
    this.#pulled = width;
    this.#glide();
  }

  /**
   * The column travels to where it is drawn next over the theme's quick time, and `then` runs once it is there. Under reduced motion,
   * or with no time to travel, it is there at once.
   */
  #glide(then?: () => void): void {
    clearTimeout(this.#gliding);
    this.#gliding = undefined;
    this.#landing = undefined;
    const root = this.ports.root;
    const said = getComputedStyle(root).getPropertyValue("--motion-quick").trim();
    const time = this.#calm.matches ? 0 : parseFloat(said) * (said.endsWith("ms") ? 1 : 1000);
    if (!(time > 0)) { root.classList.remove("gliding"); this.drawWidth(); then?.(); return; }
    // The width it leaves is laid out before the class that makes it travel, so the travel starts from where the edge stands.
    void this.element.offsetWidth;
    root.classList.add("gliding");
    this.drawWidth();
    this.#landing = then;
    this.#gliding = setTimeout(() => this.#land(), time);
  }

  /** The glide ends where it was going: at once, for a key or a press that comes while it travels, so they act from where it lands. */
  #land(): void {
    if (this.#gliding === undefined) return;
    clearTimeout(this.#gliding);
    this.#gliding = undefined;
    const then = this.#landing;
    this.#landing = undefined;
    this.ports.root.classList.remove("gliding");
    then?.();
  }

  /** The pull lets the edge be: nothing held, nothing travelling. */
  #settle(): void {
    this.#held = false;
    this.#pulled = undefined;
    clearTimeout(this.#gliding);
    this.#gliding = undefined;
    this.#landing = undefined;
    this.ports.root.classList.remove("gliding");
  }
  #keepWidth(): void {
    if (this.#width === undefined) return;
    try { this.ports.store.write(WIDTH_KEY, String(this.#width)); this.ports.store.write(OVER_KEY, this.#wantedOver ? "1" : "0"); } catch { /* the width lasts this visit */ }
  }

  #wireDivider(): void {
    const divider = this.divider;
    divider.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || divider.hidden) return;
      event.preventDefault();
      // A press while the column glides takes it where it was going, full screen included, and drags from there.
      this.#land();
      this.#settle();
      this.drawWidth();
      this.#held = this.#full;
      this.#drag = { pointer: event.pointerId, from: event.clientX, width: this.element.offsetWidth, wanted: this.#width, wantedOver: this.#wantedOver, full: this.#full, moved: false };
      try { divider.setPointerCapture(event.pointerId); } catch { /* a pointer the page did not see go down */ }
      // A pointer drags the edge with no tip, one the keyboard's focus had shown too: the edge under it says what it does.
      hideTip(divider);
      this.ports.root.classList.add("resizing");
    });
    divider.addEventListener("pointermove", (event) => {
      if (this.#drag?.pointer !== event.pointerId) return;
      this.#drag.moved = true;
      const width = this.#drag.width + this.#drag.from - event.clientX;
      if (this.#beside.matches) this.#pull(width); else this.#resize(width);
    });
    const letGo = (event: PointerEvent): void => { if (this.#drag?.pointer === event.pointerId) this.#endDrag(true); };
    divider.addEventListener("pointerup", letGo);
    divider.addEventListener("pointercancel", letGo);
    divider.addEventListener("lostpointercapture", letGo);
    divider.addEventListener("keydown", (event) => {
      const step = (event.shiftKey ? 4 : 1) * remOf();
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      // A key while the column glides acts from where the glide was going, not from part of the way.
      this.#land();
      const now = this.element.offsetWidth;
      // From full screen, → steps back to the column's most and Home to its least; End, or ← at the most, is full screen.
      const most = this.#bounds().most;
      const to = this.full
        ? ({ ArrowRight: most, Home: 0 } as Readonly<Record<string, number>>)[event.key]
        : ({ ArrowLeft: now + step, ArrowRight: now - step, Home: 0, End: Infinity } as Readonly<Record<string, number>>)[event.key];
      if (to === undefined) return;
      event.preventDefault();
      const before = { width: this.#width, over: this.#wantedOver };
      this.#resize(to);
      // A key that takes the column to full screen keeps the width it had, for the way back.
      if (this.#full || this.#held) { this.#width = before.width; this.#wantedOver = before.over; } else this.#keepWidth();
    });
    tip(divider, () => [this.#drag === undefined ? this.ports.say("board.resize") : ""], { at: "beside" });
  }

  /** A drag ends where the pointer lets go, and is kept; Escape puts the column back as it was. */
  #endDrag(keep: boolean): void {
    const was = this.#drag;
    if (was === undefined) return;
    this.#drag = undefined;
    this.ports.root.classList.remove("resizing");
    try { this.divider.releasePointerCapture(was.pointer); } catch { /* already let go */ }
    if (!keep) {
      this.#settle();
      this.#width = was.wanted;
      this.#wantedOver = was.wantedOver;
      if (this.#full !== was.full) { this.#full = was.full; this.ports.changed(); } else this.drawWidth();
    } else if (this.#full || this.#held) {
      // A drag that ends in full screen, or on its way there, keeps the width the column had before it, for the way back.
      this.#width = was.wanted;
      this.#wantedOver = was.wantedOver;
    } else if (this.#pulled !== undefined) {
      // Let go within the pull before it took the edge, the column settles on its most, the strip of the chat left in sight.
      this.#pulled = undefined;
      this.#width = this.#bounds().most;
      this.#wantedOver = true;
      this.#glide();
      this.#keepWidth();
    } else if (was.moved) this.#keepWidth();
  }
}
