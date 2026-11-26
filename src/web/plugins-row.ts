/**
 * The parts of the one row of 我的 and the queue (sheet 1, ruled 2026-11-13), drawn with the set's forms (`forms.ts`): the two marks after
 * a name, each listing what it marks on a card that a pointer, the keyboard's focus or a tap shows; a control that is a mark alone, its
 * words its tooltip and its name; and ⋮, whose menu holds 移除.
 */
import { h, svg, type Child } from "./dom.js";
import { menu, menuRow, tip, type Menu, type TipOptions } from "./forms.js";
import type { RowHead } from "./plugins-queue.js";

/** Where a row's tip stands by its control: under it on 我的 and the queue, and where a card's room asks, above it or beside it. */
export type TipAt = NonNullable<TipOptions["at"]>;

/** The row's own marks, after the prototype's (`spikes/plugins-one/one.js:58–60`), in the 24-unit box every line mark is drawn in. */
export const PATHS = {
  bundle: "M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4",
  needed: "M12 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 8.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 8.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 15.5V13M6 8.5V10a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8.5",
  again: "M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5",
  alert: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16v.01",
  more: "M12 6v.01M12 12v.01M12 18v.01",
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
} as const;
export type RowMark = keyof typeof PATHS;

export const rowIcon = (name: RowMark): SVGSVGElement => svg("svg", { class: "icon", viewBox: "0 0 24 24", "aria-hidden": "true" }, svg("path", { d: PATHS[name] }));

/**
 * A mark after a row's name: the bundles that hold the plugin, or the plugins that cannot work without it. Its card lists them under the
 * heading; a screen reader hears the heading and the names as the mark's own name.
 */
export function rowMark(kind: "bundle" | "needed", heading: string, names: readonly string[], comma: string, colon: string, at: TipAt = "below"): HTMLButtonElement {
  const button = h("button", { type: "button", class: `f-icon pl-mark pl-mark-${kind}`, "aria-label": `${heading}${colon}${names.join(comma)}` }, rowIcon(kind));
  return tip(button, () => [h("strong", {}, heading), ...names.map((name) => h("span", {}, name))], { card: true, says: true, at });
}

/** A control that is a mark alone: its words its tooltip and its name. Off, it keeps its place and takes no press. */
export function iconAct(mark: RowMark, words: string, act: () => void, options: { readonly off?: boolean; readonly focus?: string; readonly at?: TipAt } = {}): HTMLButtonElement {
  const button = h("button", { type: "button", class: "f-icon", "aria-label": words, "data-focus": options.focus, disabled: options.off === true ? true : undefined, onclick: act }, rowIcon(mark));
  return options.off === true ? button : tip(button, words, options.at === undefined ? {} : { at: options.at });
}

/** The one row of 我的 and of a card: its tile, its name with the marks after it, one line under it, and its end. */
export function rowShell(tile: Child, name: HTMLElement, marks: readonly Child[], line: readonly Child[], end: readonly Child[], classes: readonly (string | false | undefined)[] = []): HTMLElement {
  name.append(...marks.filter((one): one is Node | string => one !== undefined && one !== false));
  return h("li", { class: ["pl-row-item", ...classes.filter((one): one is string => typeof one === "string")].join(" ") },
    h("div", { class: "pl-row" }, tile, h("span", { class: "pl-row-text" }, name, h("span", { class: "quiet pl-row-line" }, ...line))),
    h("span", { class: "pl-row-end" }, ...end));
}

/** A plugin on a card, as 我的 draws it, its name opening its page and closing the card on the way; at its end what the card asks of it. */
export function cardRow(head: RowHead, marks: readonly Child[], end: Child, classes: readonly (string | false | undefined)[]): HTMLElement {
  head.name.querySelector(".pl-row-link")?.setAttribute("data-close", "");
  return rowShell(head.tile, head.name, marks, [head.line], [end], classes);
}

/**
 * ⋮ at a row's end, its menu holding 移除; the menu opens under it, right edges together. Its open and close are the page's to call around a
 * redraw. `card` names the card 移除 opens, on the row an address that names the card presses.
 */
export function moreMenu(label: string, removeWords: string, remove: () => void, focus?: string, card?: string): { readonly controls: readonly [HTMLButtonElement, HTMLElement]; readonly menu: Menu } {
  const button = h("button", { type: "button", class: "f-icon", "aria-label": label, "data-focus": focus }, rowIcon("more"));
  const row = menuRow(removeWords, remove);
  if (card !== undefined) row.setAttribute("data-card", card);
  const list = h("div", { class: "f-menu", role: "menu", "aria-label": label }, row);
  return { controls: [tip(button, label), list], menu: menu(button, list, { end: true }) };
}
