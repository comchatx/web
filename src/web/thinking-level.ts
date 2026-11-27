import { THINKING_LEVELS } from "../shared/package-request.js";
import { h } from "./dom.js";
import { giveBack, hideTip, hideTipWithin, tip } from "./forms.js";
import type { Item } from "./stream-model.js";
import type { Say } from "./stream-view.js";

/** pi's thinking level in the conversation and the levels the model in use takes, each by pi's own name, in pi's order. */
export type Thinking = { readonly level: string; readonly levels: readonly string[] };

const SCALE: readonly string[] = THINKING_LEVELS;
/** pi's `DEFAULT_THINKING_LEVEL`: the product's pi settings name no `defaultThinkingLevel` of their own. */
export const PI_DEFAULT = "medium";

/** The level pi starts a model on when asked for `level`: that level where the model takes it, else the nearest it takes, upward first, as pi's own `clampThinkingLevel` moves it. */
export function clamped(level: string, levels: readonly string[]): string | undefined {
  if (levels.includes(level)) return level;
  const at = SCALE.indexOf(level);
  if (at < 0) return levels[0];
  return SCALE.slice(at).find((one) => levels.includes(one)) ?? SCALE.slice(0, at).reverse().find((one) => levels.includes(one)) ?? levels[0];
}

/** The level a new conversation on this model starts at: pi's default, clamped to the model. */
export function piDefault(levels: readonly string[]): string | undefined { return clamped(PI_DEFAULT, levels); }

/** pi's last record of a level among the items drawn, by the item's key, so a record newer than pi's last word is told from one it saw. */
export function lastThinkingRecord(items: readonly Item[]): { readonly key: string; readonly level: string } | undefined {
  for (let at = items.length - 1; at >= 0; at--) {
    const item = items[at]!;
    if (item.kind !== "record" || item.form !== "thinking_level_change") continue;
    const level = item.body["thinkingLevel"];
    if (typeof level === "string" && level !== "") return { key: item.key, level };
  }
  return undefined;
}

/** How the model in use is paid: a sign-in costs nothing per answer, so the line under the levels says nothing of cost there. */
export type Way = "paid" | "signedIn";

export type ThinkingView = { readonly thinking: Thinking | undefined; readonly way: Way };

/**
 * The selector beside the model, in the model card's own form: a quiet button that says the level pi answered, and a card of the model's
 * levels that opens upward from it. A model that takes one level only has nothing to choose, so nothing is drawn, as the model card
 * draws no control that chooses nothing.
 */
export class ThinkingCard {
  readonly element = h("div", { class: "tl" });
  #view: ThinkingView = { thinking: undefined, way: "paid" };
  #drawn = "";
  #opened = false;
  readonly #rows = h("div", { class: "mp-rows" });
  readonly #card = h("div", { class: "mp-card tl-card", role: "menu", "aria-hidden": "true" }, this.#rows);
  readonly #trigger: HTMLButtonElement;
  /** The row's name, where the control is a row whole: it stands at the press's left, the level at its right. */
  #lead: HTMLElement | undefined;
  readonly #outside = (event: Event): void => { if (!(event.target instanceof Node && this.element.contains(event.target))) this.close(); };
  /** Escape closes the open menu wherever the keyboard is, before anything under it hears it, and hands the keyboard back to its trigger. */
  readonly #escape = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !this.#opened) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
    giveBack(this.#trigger);
  };
  readonly #keys = (event: KeyboardEvent): void => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const items = [...this.#rows.querySelectorAll<HTMLElement>("button.mp-row")];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : at < 0 ? (event.key === "ArrowDown" ? 0 : items.length - 1) : (at + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
    items[next]?.focus();
  };

  /** `opens`: it opens, and the one menu open beside it closes, its owner says which. */
  constructor(readonly ports: { readonly say: Say; readonly choose: (level: string) => void; readonly opens?: () => void }) {
    this.#trigger = tip(h("button", { type: "button", class: "mp-trigger tl-trigger", "aria-haspopup": "menu", "aria-expanded": "false", onclick: () => (this.#opened ? this.close() : this.open()) }), () => [this.#opened ? "" : this.ports.say("thinking.choose")]);
    this.#card.inert = true;
    this.element.hidden = true;
  }

  get opened(): boolean { return this.#opened; }

  /** Makes the control its row whole, the row's name at its left: drawn from the next drawing on. */
  lead(name: HTMLElement): void { this.#lead = name; this.redraw(); }

  /** Draws the selector for a view in a language; nothing is drawn again while both are what they were. */
  update(view: ThinkingView, language: string): void {
    const drawn = `${language}\u0000${JSON.stringify(view)}`;
    if (drawn === this.#drawn) return;
    this.#view = view;
    this.#drawn = drawn;
    this.redraw();
  }

  redraw(): void {
    const say = this.ports.say;
    const thinking = this.#view.thinking;
    if (thinking === undefined || thinking.levels.length < 2) {
      this.close();
      hideTipWithin(this.element);
      this.element.replaceChildren();
      this.element.hidden = true;
      return;
    }
    if (this.element.hidden) { this.element.replaceChildren(this.#trigger, this.#card); this.element.hidden = false; }
    // The row on cx's card is named 思考强度: the level is said by pi's own name.
    this.#trigger.replaceChildren(...(this.#lead === undefined ? [thinking.level] : [this.#lead, h("span", { class: "cc-chosen" }, thinking.level)]));
    this.#trigger.setAttribute("aria-label", say("thinking.spoken", { level: thinking.level }));
    this.#card.setAttribute("aria-label", say("thinking.choose"));
    const fallback = piDefault(thinking.levels);
    const focused = document.activeElement;
    const held = focused instanceof Element && this.#rows.contains(focused) ? focused.getAttribute("data-level") : null;
    this.#rows.style.gridTemplateRows = `repeat(${thinking.levels.length}, var(--row)) auto`;
    this.#rows.replaceChildren(
      ...thinking.levels.map((level) => {
        const inUse = level === thinking.level;
        return h("button", { type: "button", class: `mp-row${inUse ? " mp-in-use" : ""}`, role: "menuitemradio", "aria-checked": String(inUse), "data-level": level, onclick: () => this.#pick(level) },
          h("span", { class: "mp-slot" }, inUse ? h("span", { class: "mp-tick", "aria-hidden": "true" }, "✓") : ""),
          h("span", { class: "mp-name" }, h("span", { class: "mp-text" }, level)),
          ...(level === fallback ? [h("span", { class: "mp-hint" }, say("card.default"))] : []));
      }),
      h("div", { class: "mp-row tl-note" }, say(this.#view.way === "signedIn" ? "thinking.noteSignedIn" : "thinking.note")));
    if (held !== null) this.#rows.querySelector<HTMLElement>(`button[data-level="${held}"]`)?.focus({ preventScroll: true });
  }

  /** One press: the card closes and the level goes to the account's list, unless it is the level drawn. */
  #pick(level: string): void {
    this.close();
    if (level !== this.#view.thinking?.level) this.ports.choose(level);
  }

  open(): void {
    hideTip(this.#trigger);
    if (this.#opened || this.element.hidden) return;
    this.ports.opens?.();
    this.#opened = true;
    this.element.classList.add("open");
    this.#card.setAttribute("aria-hidden", "false");
    this.#card.inert = false;
    this.#trigger.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", this.#outside);
    document.addEventListener("keydown", this.#escape, true);
    this.#card.addEventListener("keydown", this.#keys);
    (this.#rows.querySelector<HTMLElement>("button.mp-row.mp-in-use") ?? this.#rows.querySelector<HTMLElement>("button.mp-row"))?.focus({ preventScroll: true });
  }

  close(): void {
    if (!this.#opened) return;
    this.#opened = false;
    this.element.classList.remove("open");
    this.#card.setAttribute("aria-hidden", "true");
    this.#card.inert = true;
    this.#trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", this.#outside);
    document.removeEventListener("keydown", this.#escape, true);
    this.#card.removeEventListener("keydown", this.#keys);
    // Focus never stays in the closed card, whichever way it closed.
    if (this.#card.contains(document.activeElement)) giveBack(this.#trigger);
  }
}
