import type { Kind } from "./cx-scene.js";
import type { StringKey } from "./strings.js";
import { fill, h, keep, keepAttribute } from "./dom.js";
import { bar } from "./waiting.js";

/**
 * Where cx's computer stands while the board cannot be read from it (`parts/board-page.md` §1): off; switching on; a start that failed or
 * was refused; off under the balance's floor; or off and out of reach. A computer on, or not read yet, is none of them.
 */
export type Off = "off" | "starting" | "failed" | "refused" | "balance" | "unreachable";

/**
 * The board's reading of the corner's kind: a computer on or at work is read, one not read yet draws as before, and one
 * on but out of reach keeps what it drew; out of reach and off, it says it is reconnecting.
 */
export function offOf(kind: Kind | undefined): Off | undefined {
  switch (kind) {
    case "off": case "starting": case "failed": case "refused": case "balance": return kind;
    case "unreachableAsleep": return "unreachable";
    default: return undefined;
  }
}

export type OffPorts = {
  readonly say: (key: StringKey) => string;
  /** The seller's press that starts the computer: the app's own start, the one cx's card gives (decision D227). */
  readonly wake: () => void;
  /** Where 获取帮助 goes, as cx's card has it. */
  readonly help: string;
  /** The message box's own line under the balance's floor, its way on a link inside it, so the board and the box never disagree. */
  readonly floor: () => readonly (string | HTMLElement)[];
};

/** The computer's state in the sentence signed for it, which a screen reader hears; the screen shows one short line. */
const SPOKEN: Readonly<Record<Off, StringKey>> = {
  off: "cx.computer.off", starting: "cx.computer.starting", failed: "cx.computer.failed", refused: "cx.computer.refused", balance: "cx.computer.off", unreachable: "status.reconnecting",
};

/**
 * What lies under the glass (way C, ruled 2026-11-12): the board the page still holds, drawn by the board itself and out of reach, or the
 * board's shape; none where the seller's system asks for less transparency, which is way A.
 */
export type Under = "last" | "shape";

/** One card of the board's shape while the computer starts: a title, a date and its lines, in the product's skeleton bars. */
const shapeCard = (title: 6 | 7 | 8 | 9, lines: readonly (7 | 8 | 9 | 10 | 11 | 12)[]): HTMLElement => h("div", { class: "off-sk-card" }, bar(title, "body"), bar(3, "small"), ...lines.map((width) => bar(width, "small")));

/**
 * The board's place while cx's computer is off (round 10, way A as signed): one line that says why the board is not shown, and the press
 * that starts the computer, in every tab's place; the start's answer where it did not start; the floor's own line where it cannot. While
 * the computer starts, only the board's shape breathes where the cards will be, however long the start takes, with no words.
 */
export class BoardOff {
  readonly #said = h("p", { class: "unseen", role: "status", id: "board-off-said" });
  readonly #line = h("p", { class: "off-line" });
  readonly #go = h("button", { type: "button", class: "primary", onclick: () => this.ports.wake() }) as HTMLButtonElement;
  readonly #help: HTMLAnchorElement;
  readonly #acts: HTMLElement;
  readonly #mid: HTMLElement;
  // Way A draws the first three while the computer starts; under the glass all twelve stand, cut at the place's foot.
  readonly #shape = h("div", { class: "off-shape", "aria-hidden": "true" }, shapeCard(8, [12, 10]), shapeCard(6, [12, 7]), shapeCard(9, [11]), shapeCard(7, [12, 9]),
    shapeCard(8, [10]), shapeCard(6, [12, 8]), shapeCard(9, [12, 10]), shapeCard(7, [11]), shapeCard(8, [12, 7]), shapeCard(6, [12, 9]), shapeCard(9, [10]), shapeCard(7, [12, 8]));
  readonly #glass = h("div", { class: "off-glass", "aria-hidden": "true", hidden: true });
  readonly element: HTMLElement;
  #drawn: Off | undefined;

  constructor(readonly ports: OffPorts) {
    // A link, as it opens the seller's mail, drawn as the outlined button beside 重试 (the prototype's).
    this.#help = h("a", { href: ports.help, class: "button" }) as HTMLAnchorElement;
    this.#acts = h("div", { class: "off-acts" }, this.#go, this.#help);
    this.#mid = h("div", { class: "off-mid" }, this.#line, this.#acts);
    this.element = h("div", { class: "board-pane board-off", hidden: true, tabindex: "-1", role: "group", "aria-labelledby": this.#said.id }, this.#said, this.#shape, this.#glass, this.#mid);
  }

  /** The state drawn, none while the board is shown. */
  get off(): Off | undefined { return this.#drawn; }

  /** Draws the place for the computer's state, over what lies under the glass where there is glass, or takes it away where there is none. */
  draw(off: Off | undefined, under?: Under): void {
    const pressed = document.activeElement === this.#go;
    this.#drawn = off;
    this.element.classList.toggle("glass", off !== undefined && under !== undefined);
    this.element.classList.toggle("over-last", off !== undefined && under === "last");
    keep(this.#glass, "hidden", off === undefined || under === undefined);
    keep(this.element, "hidden", off === undefined);
    // Back on, the status says so rather than keeping the last state it said.
    if (off === undefined) { if (this.#said.textContent !== "") keep(this.#said, "textContent", this.ports.say("cx.computer.on")); return; }
    const say = this.ports.say;
    const bad = off === "failed" || off === "refused";
    const starting = off === "starting";
    keep(this.#said, "textContent", say(SPOKEN[off]));
    this.element.classList.toggle("starting", starting);
    keep(this.#mid, "hidden", starting);
    keep(this.#shape, "hidden", under === "last" || (under === undefined && !starting));
    this.#line.classList.toggle("bad", bad);
    // A line that repeats what the status says is the screen's alone; the reason and the floor's way on are read where they stand.
    if (off === "balance") fill(this.#line, ...this.ports.floor());
    else keep(this.#line, "textContent", say(bad ? (off === "failed" ? "cx.say.failed" : "cx.say.refused") : off === "unreachable" ? "status.reconnecting" : "frame.boxOff"));
    if (bad || off === "unreachable") keepAttribute(this.#line, "aria-hidden", "true"); else this.#line.removeAttribute("aria-hidden");
    keep(this.#go, "textContent", say(bad ? "status.retry" : "cx.on"));
    keep(this.#go, "hidden", !(off === "off" || bad));
    keep(this.#help, "textContent", say("menu.help"));
    keep(this.#help, "hidden", !bad);
    keep(this.#acts, "hidden", this.#go.hidden);
    // The press that leaves as the computer starts hands the keyboard to the place, not to the page's body.
    if (pressed && this.#go.hidden) this.focus();
  }

  /** Takes the keyboard: the place itself, never the press that starts a computer billed by the hour. */
  focus(): void { this.element.focus({ preventScroll: true }); }
}
