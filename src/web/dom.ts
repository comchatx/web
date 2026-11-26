export type Child = Node | string | undefined | false;
type Attributes = Readonly<Record<string, string | boolean | undefined | ((event: Event) => void)>>;

/** One element: a function value listens to the event its name says (`onclick`), `false` and `undefined` set nothing, and text is always text. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attributes: Attributes = {}, ...children: readonly Child[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (typeof value === "function") element.addEventListener(name.slice(2), value);
    else if (value === true) element.setAttribute(name, "");
    else if (typeof value === "string") element.setAttribute(name, value);
  }
  for (const child of children) if (child !== undefined && child !== false) element.append(child);
  return element;
}

/** `replaceChildren` with the same children `h` takes. */
export function fill(element: Element, ...children: readonly Child[]): void {
  element.replaceChildren(...children.filter((child): child is Node | string => child !== undefined && child !== false));
}

/**
 * The control drawn at a place, its `data-focus`, found by comparing the attribute: a place can hold a record's own words, a series'
 * name or a model's id, and no selector is built from those.
 */
export function placed(root: ParentNode | undefined, place: string): HTMLElement | undefined {
  return [...(root?.querySelectorAll?.<HTMLElement>("[data-focus]") ?? [])].find((one) => one.getAttribute("data-focus") === place);
}

/** A property set only when it differs, so a redraw that changes nothing writes nothing a live region or an observer would hear. */
export function keep<K extends "hidden" | "textContent" | "title">(element: HTMLElement, name: K, value: HTMLElement[K]): void {
  if (element[name] !== value) element[name] = value;
}

/** An attribute set only when it differs, as `keep` does for a property. */
export function keepAttribute(element: Element, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

/**
 * Puts the keyboard back on a control a new drawing replaced, scrolling nothing; where the drawing moved it from `top`, as a line drawn
 * above it does, its row comes back into view as little as it takes, so the ring is whole. A control the reader scrolled away from stays.
 */
export function refocus(again: HTMLElement, top: number | undefined): void {
  again.focus({ preventScroll: true });
  if (top !== undefined && again.getBoundingClientRect().top !== top) (again.closest("li") ?? again).scrollIntoView?.({ block: "nearest" });
}

const SVG = "http://www.w3.org/2000/svg";
/** One SVG element, attributes as given; text is always text. */
export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Readonly<Record<string, string>> = {}, ...children: readonly (Node | string)[]): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

/**
 * What a reader holds in an element, kept through its replacement by a new drawing of the same thing: the control with the focus, the
 * one of its `roving` controls that is the Tab stop, and words selected in its `written` text. Each is found again by its place, and only where
 * the new drawing has the same place. Called before the replacement; what it returns is called after.
 */
export function carried(old: HTMLElement, fresh: HTMLElement, roving: string, written: string): () => void {
  const stops = [...old.querySelectorAll<HTMLElement>(roving)];
  const stop = stops.findIndex((one) => one.tabIndex === 0);
  const focused = stops.indexOf(document.activeElement as HTMLElement);
  const selection = typeof getSelection === "function" ? getSelection() : null;
  /** A point of the selection as the text it is in and how many characters into it; one outside the item stays where it is. */
  const point = (node: Node | null, offset: number): { readonly node: Node; readonly offset: number } | { readonly text: number; readonly chars: number } | undefined => {
    if (node === null) return undefined;
    if (!old.contains(node)) return { node, offset };
    const texts = [...old.querySelectorAll<HTMLElement>(written)];
    const text = texts.findIndex((one) => one.contains(node));
    if (text === -1) return undefined;
    const before = document.createRange();
    before.setStart(texts[text]!, 0);
    before.setEnd(node, offset);
    return { text, chars: before.toString().length };
  };
  const held = selection !== null && selection.rangeCount > 0 && !selection.isCollapsed && (old.contains(selection.anchorNode) || old.contains(selection.focusNode));
  const anchor = held ? point(selection.anchorNode, selection.anchorOffset) : undefined;
  const focus = held ? point(selection.focusNode, selection.focusOffset) : undefined;
  return () => {
    const next = [...fresh.querySelectorAll<HTMLElement>(roving)];
    if (next.length === stops.length && stop >= 0) for (const [at, one] of next.entries()) one.tabIndex = at === stop ? 0 : -1;
    if (next.length === stops.length && focused >= 0) next[focused]!.focus({ preventScroll: true });
    if (selection === null || anchor === undefined || focus === undefined) return;
    const texts = [...fresh.querySelectorAll<HTMLElement>(written)];
    const place = (at: NonNullable<typeof anchor>): { readonly node: Node; readonly offset: number } | undefined => {
      if ("node" in at) return at;
      const text = texts[at.text];
      if (text === undefined) return undefined;
      let left = at.chars;
      const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const length = (node.textContent ?? "").length;
        if (left <= length) return { node, offset: left };
        left -= length;
      }
      return undefined;
    };
    const from = place(anchor);
    const to = place(focus);
    if (from !== undefined && to !== undefined) selection.setBaseAndExtent(from.node, from.offset, to.node, to.offset);
  };
}
