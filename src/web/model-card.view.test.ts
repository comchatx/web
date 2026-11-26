import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CardView, SeriesPick } from "./model-card.js";

// The card's DOM-construction port is replaced by a small tree, as the stream view's tests do, not its decisions about what to draw.
// The pages' content security policy drops a style attribute and leaves the CSSOM alone; so does this tree, so a width set as an
// attribute draws nothing here, as it draws nothing in production.
const { Element } = vi.hoisted(() => {
  class Style {
    width = "";
    gridTemplateRows = "";
  }
  class Element {
    readonly children: (Element | string)[] = [];
    readonly attributes = new Map<string, string>();
    readonly style = new Style();
    readonly listeners = new Map<string, ((event: unknown) => void)[]>();
    parent: Element | undefined;
    readonly classList = {
      add: (name: string) => this.#classes(new Set([...this.#names(), name])),
      remove: (name: string) => this.#classes(new Set([...this.#names()].filter((known) => known !== name))),
      toggle: (name: string, on: boolean) => (on ? this.classList.add(name) : this.classList.remove(name)),
      contains: (name: string) => this.#names().has(name),
    };
    constructor(readonly tag: string, props: Record<string, unknown> = {}) {
      for (const [name, value] of Object.entries(props)) {
        if (typeof value === "function") this.addEventListener(name.slice(2), value as (event: unknown) => void);
        else if (typeof value === "string") this.setAttribute(name, value);
        else if (value === true) this.setAttribute(name, "");
      }
    }
    #names(): Set<string> { return new Set((this.attributes.get("class") ?? "").split(" ").filter(Boolean)); }
    #classes(names: Set<string>): void { this.attributes.set("class", [...names].join(" ")); }
    append(...children: (Element | string)[]): void { for (const child of children) { if (child instanceof Element) child.parent = this; this.children.push(child); } }
    replaceChildren(...children: (Element | string)[]): void { this.children.splice(0); this.append(...children); }
    setAttribute(name: string, value: string): void { if (name !== "style") this.attributes.set(name, value); }
    getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
    get title(): string { return this.attributes.get("title") ?? ""; }
    set title(value: string) { this.attributes.set("title", value); }
    get textContent(): string { return this.children.map((child) => (typeof child === "string" ? child : child.textContent)).join(""); }
    set textContent(value: string) { this.replaceChildren(value); }
    addEventListener(type: string, listener: (event: unknown) => void): void { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
    removeEventListener(type: string, listener: (event: unknown) => void): void { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((known) => known !== listener)); }
    dispatch(type: string, event: Record<string, unknown> = {}): void { for (const listener of this.listeners.get(type) ?? []) listener({ preventDefault: () => undefined, target: this, ...event }); }
    click(): void { this.dispatch("click"); }
    focus(): void { active = this; }
    contains(node: unknown): boolean { return node === this || this.children.some((child) => child instanceof Element && child.contains(node)); }
    all(): Element[] { return [this, ...this.children.flatMap((child) => (child instanceof Element ? child.all() : []))]; }
    matches(selector: string): boolean {
      const [tag, ...classes] = selector.split(".");
      return (tag === "" || tag === this.tag) && classes.every((name) => this.classList.contains(name));
    }
    querySelectorAll(selector: string): Element[] { return this.all().slice(1).filter((node) => node.matches(selector)); }
    querySelector(selector: string): Element | null { return this.querySelectorAll(selector)[0] ?? null; }
  }
  let active: Element | undefined;
  // The page tells a press inside the card from one outside by `instanceof Node`; here every node is an Element.
  (globalThis as { Node?: unknown }).Node = Element;
  const documentListeners = new Map<string, ((event: unknown) => void)[]>();
  (globalThis as { document?: unknown }).document = {
    get activeElement() { return active; },
    addEventListener: (type: string, listener: (event: unknown) => void) => documentListeners.set(type, [...(documentListeners.get(type) ?? []), listener]),
    removeEventListener: (type: string, listener: (event: unknown) => void) => documentListeners.set(type, (documentListeners.get(type) ?? []).filter((known) => known !== listener)),
    dispatch: (type: string, event: Record<string, unknown>) => { for (const listener of documentListeners.get(type) ?? []) listener(event); },
    listening: (type: string) => (documentListeners.get(type) ?? []).length,
  };
  return { Element };
});
vi.mock("./dom.js", () => ({
  h: (tag: string, props: Record<string, unknown>, ...children: (InstanceType<typeof Element> | string | false | undefined)[]) => { const node = new Element(tag, props); node.append(...children.filter((child): child is InstanceType<typeof Element> | string => child !== undefined && child !== false)); return node; },
  fill: (node: InstanceType<typeof Element>, ...children: (InstanceType<typeof Element> | string)[]) => node.replaceChildren(...children),
  svg: (tag: string, props: Record<string, string> = {}, ...children: (InstanceType<typeof Element> | string)[]) => { const node = new Element(tag, props); node.append(...children); return node; },
}));
/** The set's tip, held as the words each target's tip would say: what it draws is the set's own tests'. */
const tips = vi.hoisted(() => new Map<unknown, string | (() => readonly unknown[])>());
vi.mock("./forms.js", () => ({ tip: <T>(target: T, words: string | (() => readonly unknown[])): T => { tips.set(target, words); return target; }, hideTip: () => undefined, hideTipWithin: () => undefined, giveBack: (target: HTMLElement) => target.focus() }));
const tipOf = (target: unknown): string => { const words = tips.get(target); return words === undefined ? "" : typeof words === "string" ? words : words().join(""); };
const { ModelCard, NO_VIEW } = await import("./model-card.js");
type Node = InstanceType<typeof Element>;
const doc = (globalThis as unknown as { document: { dispatch: (type: string, event: Record<string, unknown>) => void; listening: (type: string) => number; activeElement: Node | undefined } }).document;
afterEach(() => { card.close(); vi.restoreAllMocks(); });

const say = (key: string, values?: Readonly<Record<string, string | number>>): string => `${key}${values === undefined ? "" : JSON.stringify(values)}`;
const platform = (id: string, name: string) => ({ provider: "openrouter", id, name, aggregator: true as const, source: "platform" as const, through: "OpenRouter" });
const view: CardView = {
  slots: [
    { id: "anthropic", name: "Anthropic", source: "key", onCard: true, models: [{ provider: "anthropic", id: "opus", name: "Claude Opus 5.5", via: "own key", source: "key" }, platform("anthropic/haiku", "Anthropic: Claude 3 Haiku")] },
    { id: "openai", name: "OpenAI", source: "account", onCard: true, models: [{ provider: "openai", id: "sol", name: "GPT-6 Sol", via: "account", source: "account" }] },
    { id: "minimax", name: "MiniMax", source: "platform", onCard: true, models: [platform("minimax/m3", "MiniMax: MiniMax M3")] },
  ],
  current: { provider: "anthropic", id: "opus", name: "Claude Opus 5.5", vendor: "anthropic", vendorName: "Anthropic", served: true, chosen: false },
  default: { provider: "openrouter", id: "minimax/m3" },
};
let chosen: [string, string][];
let ofSeries: (SeriesPick | undefined)[];
let others: (string | undefined)[];
let card: InstanceType<typeof ModelCard>;
const element = (): Node => card.element as unknown as Node;
const trigger = (): Node => element().children[0] as Node;
const rowsOf = (): Node[] => (element().children[1] as Node).children[0] instanceof Element ? ((element().children[1] as Node).children[0] as Node).children as Node[] : [];
const texts = (): string[] => rowsOf().map((row) => row.textContent);
/** What a screen reader reads of a node: its words, less what is hidden from it. */
const heard = (node: Node): string => (node.getAttribute("aria-hidden") === "true" ? "" : node.children.map((child) => (typeof child === "string" ? child : heard(child))).join(""));
const inert = (): boolean | undefined => (element().children[1] as Node & { inert?: boolean }).inert;
beforeEach(() => {
  chosen = []; others = []; ofSeries = [];
  card = new ModelCard({ say, choose: (provider, id, _platform, series) => { chosen.push([provider, id]); ofSeries.push(series); }, others: (vendor) => others.push(vendor) });
  card.update(view, "en");
});

it("is one line closed — the vendor and the model in use — and a card that opens upward on the vendors, as tall as its rows", () => {
  expect(trigger().textContent).toBe("Anthropic · Claude Opus 5.5");
  // Drawn in its parts, so the vendor's name can give way and the model's keep its length.
  expect((trigger().children as Node[]).map((part) => [part.getAttribute("class"), part.textContent])).toEqual([["mp-vendor", "Anthropic"], ["mp-sep", " · "], ["mp-model", "Claude Opus 5.5"]]);
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(element().classList.contains("open")).toBe(false);
  expect(inert()).toBe(true);
  card.show("vendors");
  expect(element().classList.contains("open")).toBe(true);
  expect(inert()).toBe(false);
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  // Default, the three vendors on the card, others: no blank row fills it out.
  expect(rowsOf().map((row) => row.tag)).toEqual(["button", "button", "button", "button", "button"]);
  expect(texts()[0]).toBe("card.defaultcard.bestValuecard.platform›");
  expect(texts().slice(1, 4)).toEqual(["AAnthropiccard.key›", "OOpenAIcard.account›", "MMiniMaxcard.platform›"]);
  expect(texts()[4]).toBe("…card.others↗");
  // Read, a row is its words: its ✓, ›, … and ↗ are drawn and hidden, as Default's spacer is.
  expect(rowsOf().map(heard)).toEqual(["card.defaultcard.bestValuecard.platform", "Anthropiccard.key", "OpenAIcard.account", "MiniMaxcard.platform", "card.others"]);
  card.show({ vendor: "anthropic" });
  expect([texts()[1]!.startsWith("✓"), heard(rowsOf()[1]!).startsWith("✓")]).toEqual([true, false]);
  card.show("vendors");
  expect(rowsOf()[1]!.classList.contains("mp-in-use")).toBe(true);
  expect(doc.activeElement).toBe(rowsOf()[0]);
  expect(doc.listening("pointerdown")).toBe(1);
});

it("still opens where the record ticks no vendor, on Default and the way to add vendors; with nothing to choose and no record it is a line", () => {
  card.update({ slots: [], current: undefined, default: view.default, byRecord: true }, "en");
  card.show("vendors");
  expect(texts()).toEqual(["card.defaultcard.bestValuecard.platform›", "…card.others↗"]);
  card.update({ slots: [], current: undefined, default: view.default }, "en");
  expect(element().textContent).toBe("");
});

it("opens on the ticked row, on the level that holds it, and says a pick pi has not taken yet as chosen in words there, with no tooltip", () => {
  card.open();
  expect(card.level).toEqual({ vendor: "anthropic" });
  expect(doc.activeElement).toBe(rowsOf()[1]);
  expect(texts()[1]).toBe("✓Claude Opus 5.5card.key");
  card.close();
  card.update({ ...view, current: { ...view.current!, chosen: true } }, "en");
  card.open();
  expect(texts()[1]).toBe("✓Claude Opus 5.5card.chosenTagcard.key");
  expect(rowsOf()[1]!.querySelectorAll("span.mp-tick")[0]!.title).toBe("");
  card.close();
  // The default in use is ticked on the vendors, which is where the card opens for it.
  card.update({ ...view, current: { provider: "openrouter", id: "minimax/m3", name: "MiniMax M3", vendor: "minimax", vendorName: "MiniMax", served: true, chosen: true } }, "en");
  card.open();
  expect(card.level).toBe("vendors");
  expect(doc.activeElement).toBe(rowsOf()[0]);
  expect(texts()[0]).toBe("✓card.defaultcard.chosenTagcard.platform›");
});

it("opens a vendor's level in its own rows — back, its models in the order listed, the one in use ticked, others", () => {
  card.show("vendors");
  rowsOf()[1]!.click();
  expect(card.level).toEqual({ vendor: "anthropic" });
  expect(rowsOf()).toHaveLength(4);
  expect(rowsOf()[0]!.classList.contains("mp-title")).toBe(true);
  expect(texts()[0]).toBe("‹Anthropiccard.key");
  expect(texts()[1]).toBe("✓Claude Opus 5.5card.key");
  expect(rowsOf()[1]!.getAttribute("aria-checked")).toBe("true");
  expect([rowsOf()[1]!.getAttribute("title"), rowsOf()[1]!.querySelectorAll("span.mp-bar").length]).toEqual([null, 0]);
  expect(texts()[2]).toBe("Claude 3 Haikucard.platform");
  expect(texts()[3]).toBe("…card.others↗");
  rowsOf()[0]!.click();
  expect(card.level).toBe("vendors");
  expect(texts()[0]).toBe("card.defaultcard.bestValuecard.platform›");
});

it("chooses a model and closes; chooses the default from its row and closes", () => {
  card.show("vendors");
  rowsOf()[2]!.click();
  rowsOf()[1]!.click();
  expect(chosen).toEqual([["openai", "sol"]]);
  expect(card.opened).toBe(false);
  expect(inert()).toBe(true);
  expect(doc.activeElement).toBe(trigger());
  expect(element().classList.contains("open")).toBe(false);
  expect(card.level).toBe("vendors");
  expect(doc.listening("pointerdown")).toBe(0);
  card.show("vendors");
  rowsOf()[0]!.click();
  expect(chosen).toEqual([["openai", "sol"], ["openrouter", "minimax/m3"]]);
  expect(card.opened).toBe(false);
});

it("names no model for the default: the platform's pick, its platform tag in the vendors' column, Default on the line while it is in use, and no tick on its vendor's level", () => {
  card.show("vendors");
  const row = rowsOf()[0]!;
  expect(row.querySelectorAll("span.mp-hint").map((hint) => hint.textContent)).toEqual(["card.bestValue"]);
  expect(row.querySelectorAll("span.f-tag").map((tag) => tag.textContent)).toEqual(["card.platform"]);
  expect(row.querySelectorAll("span.mp-spacer").map((spacer) => spacer.getAttribute("aria-hidden"))).toEqual(["true"]);
  expect(row.textContent).not.toContain("MiniMax");
  card.close();
  card.update({ ...view, current: { provider: "openrouter", id: "minimax/m3", name: "MiniMax M3", vendor: "minimax", vendorName: "MiniMax", served: true, chosen: false } }, "en");
  expect(trigger().textContent).toBe("card.default · MiniMax M3");
  expect(trigger().getAttribute("aria-label")).toBe('model.spoken{"model":"card.default · MiniMax M3"}');
  // With no model known the line is the action, and it is spoken once, not doubled.
  card.update({ ...view, current: undefined }, "en");
  expect(trigger().textContent).toBe("model.choose");
  expect(trigger().getAttribute("aria-label")).toBe("model.choose");
  card.update({ ...view, current: { provider: "openrouter", id: "minimax/m3", name: "MiniMax M3", vendor: "minimax", vendorName: "MiniMax", served: true, chosen: false } }, "en");
  card.show("vendors");
  expect(rowsOf()[0]!.classList.contains("mp-in-use")).toBe(true);
  expect(texts()[0]).toBe("✓card.defaultcard.bestValuecard.platform›");
  expect(rowsOf().slice(1).filter((row) => row.classList.contains("mp-in-use"))).toHaveLength(0);
  rowsOf()[3]!.click();
  expect(texts()[1]).toContain("MiniMax M3");
  expect(rowsOf().filter((row) => row.classList.contains("mp-in-use") || row.getAttribute("aria-checked") === "true")).toHaveLength(0);
  expect(texts().join("")).not.toContain("✓");
});

it("names a model offered by series by the series, with the version it is on today beside it, and a model of no series by its own name", () => {
  const sol = { provider: "openai", id: "sol", name: "GPT-6 Sol", series: "GPT Sol", via: "account", source: "account" as const };
  card.update({ ...view, slots: view.slots.map((slot) => (slot.id === "openai" ? { ...slot, models: [sol, { ...sol, id: "mini", name: "GPT Mini", series: "GPT Mini" }] } : slot)) } as CardView, "en");
  card.show({ vendor: "openai" });
  expect(texts().slice(1, 3)).toEqual(["GPT SolGPT-6 Sol", "GPT Mini"]);
  expect(rowsOf()[1]!.querySelectorAll("span.mp-member").map((one) => one.textContent)).toEqual(["GPT-6 Sol"]);
  card.show({ vendor: "anthropic" });
  expect(texts()[1]).toBe("✓Claude Opus 5.5card.key");
});

it("chooses a row of a series as its series, saying whether the person pinned the version it is on, and a row of no series as its model", () => {
  const sol = { provider: "openai", id: "sol", name: "GPT-6 Sol", series: "GPT Sol", seriesId: "~openai/gpt-sol-latest", via: "account", source: "account" as const };
  const mini = { ...sol, id: "mini-1", name: "GPT Mini 1", series: "GPT Mini", seriesId: "openai:gpt-mini", pinned: true as const };
  const plain = { provider: "openai", id: "o9", name: "o9", via: "account", source: "account" as const };
  card.update({ ...view, slots: view.slots.map((slot) => (slot.id === "openai" ? { ...slot, models: [sol, mini, plain] } : slot)) } as CardView, "en");
  for (const at of [1, 2, 3]) { card.show({ vendor: "openai" }); rowsOf()[at]!.click(); }
  expect(chosen).toEqual([["openai", "sol"], ["openai", "mini-1"], ["openai", "o9"]]);
  expect(ofSeries).toEqual([{ id: "~openai/gpt-sol-latest", pinned: false }, { id: "openai:gpt-mini", pinned: true }, undefined]);
});

it("sends others to the page: with no vendor from the vendors, with the vendor from its level, and closes first", () => {
  card.show("vendors");
  rowsOf().at(-1)!.click();
  expect(others).toEqual([undefined]);
  expect(card.opened).toBe(false);
  card.show({ vendor: "minimax" });
  expect(card.opened).toBe(true);
  rowsOf().at(-1)!.click();
  expect(others).toEqual([undefined, "minimax"]);
  expect(card.opened).toBe(false);
});

it("closes on Escape and gives the line the focus, goes back on ArrowLeft, and closes on a press outside but not inside", () => {
  card.show({ vendor: "openai" });
  const inner = element().children[1] as Node;
  inner.dispatch("keydown", { key: "ArrowLeft" });
  expect(card.level).toBe("vendors");
  inner.dispatch("keydown", { key: "ArrowDown" });
  expect(doc.activeElement).toBe(rowsOf()[1]);
  inner.dispatch("keydown", { key: "ArrowUp" });
  expect(doc.activeElement).toBe(rowsOf()[0]);
  trigger().focus();
  inner.dispatch("keydown", { key: "ArrowUp" });
  expect(doc.activeElement).toBe(rowsOf().at(-1));
  trigger().focus();
  inner.dispatch("keydown", { key: "ArrowDown" });
  expect(doc.activeElement).toBe(rowsOf()[0]);
  inner.dispatch("keydown", { key: "Escape" });
  expect(card.opened).toBe(false);
  expect(doc.activeElement).toBe(trigger());
  card.show("vendors");
  doc.dispatch("pointerdown", { target: rowsOf()[1] });
  expect(card.opened).toBe(true);
  doc.dispatch("pointerdown", { target: new Element("body") });
  expect(card.opened).toBe(false);
});

it("keeps the focus on the row in the person's hand when the rows are drawn again while open, or gives it to the first row when that one is gone, and the keys go on working", () => {
  card.show("vendors");
  const inner = (): Node => element().children[1] as Node;
  inner().dispatch("keydown", { key: "ArrowDown" });
  expect(doc.activeElement).toBe(rowsOf()[1]);
  const [anthropic, openai, minimax] = view.slots;
  card.update({ ...view, slots: [openai!, anthropic!, minimax!] }, "en");
  expect(doc.activeElement).toBe(rowsOf()[2]);
  expect(texts()[2]).toBe("AAnthropiccard.key›");
  rowsOf()[2]!.click();
  inner().dispatch("keydown", { key: "ArrowDown" });
  expect(texts()[1]).toBe("✓Claude Opus 5.5card.key");
  expect(doc.activeElement).toBe(rowsOf()[1]);
  const fable = { provider: "anthropic", id: "fable", name: "Claude Fable 5.1", via: "own key", source: "key" as const };
  card.update({ ...view, slots: [{ ...anthropic!, models: [fable, ...anthropic!.models] }, openai!, minimax!] }, "en");
  expect(texts()[2]).toBe("✓Claude Opus 5.5card.key");
  expect(doc.activeElement).toBe(rowsOf()[2]);
  inner().dispatch("keydown", { key: "ArrowDown" });
  expect(doc.activeElement).toBe(rowsOf()[3]);
  card.update({ ...view, slots: [{ ...anthropic!, models: [fable, anthropic!.models[0]!] }, openai!, minimax!] }, "en");
  expect(doc.activeElement).toBe(rowsOf()[0]);
  inner().dispatch("keydown", { key: "ArrowUp" });
  expect(doc.activeElement).toBe(rowsOf().at(-1));
  inner().dispatch("keydown", { key: "Escape" });
  expect(card.opened).toBe(false);
  expect(doc.activeElement).toBe(trigger());
  card.update(view, "zh");
  expect(doc.activeElement).toBe(trigger());
});

it("letters a vendor's glyph in the page's own face, naming no font of its own", () => {
  card.show("vendors");
  const letter = rowsOf()[1]!.querySelectorAll("text")[0]!;
  expect([letter.textContent, letter.getAttribute("font-family")]).toEqual(["A", null]);
});

it("lays its rows out by how many it draws, a number the stylesheet does not hold", () => {
  expect((rowsOf()[0]!.parent as Node).style.gridTemplateRows).toBe("repeat(5, minmax(var(--row), auto))");
  const rule = /\.mp-rows\s*\{[^}]*\}/.exec(readFileSync(new URL("./site/app.css", import.meta.url), "utf8"))?.[0];
  expect(rule).toBe(".mp-rows { display: grid; }");
});

it("keeps one margin around its rows on all four sides, nothing standing under them", () => {
  const rule = /^\.mp-card \{[^}]*\}/m.exec(readFileSync(new URL("./site/app.css", import.meta.url), "utf8"))?.[0];
  expect(rule).toContain(" padding: var(--space-2); ");
});

it("draws the rows again only for a view or a language that changed, keeps the level, and says a model the box no longer offers on the line", () => {
  card.show("vendors");
  rowsOf()[1]!.click();
  const before = rowsOf()[0];
  card.update({ ...view, slots: [...view.slots] }, "en");
  expect(rowsOf()[0]).toBe(before);
  card.update(view, "zh");
  const inChinese = rowsOf()[0];
  expect(inChinese).not.toBe(before);
  expect(card.level).toEqual({ vendor: "anthropic" });
  const unserved: CardView = { ...view, current: { provider: "anthropic", id: "gone", name: "Gone", vendor: "anthropic", vendorName: "Anthropic", served: false, chosen: false } };
  card.update(unserved, "zh");
  expect(rowsOf()[0]).not.toBe(inChinese);
  expect(card.level).toEqual({ vendor: "anthropic" });
  expect(trigger().textContent).toBe("Anthropic · Gone");
  expect(trigger().classList.contains("mp-unserved")).toBe(true);
  // The line says it over the trigger once the card is shut; over its own open card the trigger says nothing.
  expect(tipOf(trigger())).toBe("");
  card.close();
  expect([trigger().getAttribute("title"), tipOf(trigger())]).toEqual([null, "card.notServed"]);
  expect(rowsOf().filter((row) => row.classList.contains("mp-in-use"))).toHaveLength(0);
});

it("draws the default row as an empty one while the platform named no default, and says choose on the line while no model is in use", () => {
  card.update({ ...view, default: undefined }, "en");
  card.show("vendors");
  expect(rowsOf()[0]!.tag).toBe("div");
  expect(rowsOf()[0]!.classList.contains("mp-empty")).toBe(true);
  card.close();
  card.update({ ...view, current: undefined }, "en");
  expect(trigger().textContent).toBe("model.choose");
});

it("draws nothing on the line, and offers no control, while the page has not read the model; the line holds the height the model will take", () => {
  card.update(NO_VIEW, "en");
  expect([element().textContent, element().children.length]).toEqual(["", 0]);
  const css = readFileSync(new URL("./site/app.css", import.meta.url), "utf8");
  const mp = css.slice(css.indexOf("\n.mp {"), css.indexOf("}", css.indexOf("\n.mp {")));
  const trigger = css.slice(css.indexOf("\n.mp-trigger {"), css.indexOf("}", css.indexOf("\n.mp-trigger {")));
  expect([mp, trigger]).toEqual([expect.stringContaining("min-height: calc(1em * var(--leading-small) + 2 * var(--space-1));"), expect.stringContaining("padding: var(--space-1) ")]);
  // Where the line does not fit, the vendor's name shrinks to an ellipsis and the model's keeps its length.
  const rule = (selector: string): string => css.slice(css.indexOf(`\n${selector} {`), css.indexOf("}", css.indexOf(`\n${selector} {`)));
  expect([rule(".mp-vendor"), rule(".mp-model")]).toEqual([expect.stringContaining("flex: 0 1 auto; min-width: 1.5em; overflow: hidden; text-overflow: ellipsis;"), expect.stringContaining("flex: none;")]);
});

it("draws a model two credentials reach as two rows, each tagged with the way it is paid, the tick on the record in use; a level paid one way draws no tags", () => {
  const twice: CardView = {
    slots: [{ id: "anthropic", name: "Anthropic", source: "key", onCard: true, models: [
      { provider: "openrouter", id: "anthropic/claude-opus-5.5", name: "Anthropic: Claude Opus 5.5", aggregator: true, via: "OpenRouter", source: "key", through: "OpenRouter" },
      { provider: "anthropic", id: "claude-opus-5-5", name: "Claude Opus 5.5", via: "Anthropic", source: "key" },
    ] }],
    current: { provider: "openrouter", id: "anthropic/claude-opus-5.5", name: "Claude Opus 5.5", vendor: "anthropic", vendorName: "Anthropic", served: true, chosen: false },
    default: undefined,
  };
  card.update(twice, "en");
  card.show({ vendor: "anthropic" });
  expect(texts().slice(1, 3)).toEqual(["✓Claude Opus 5.5OpenRouter", "Claude Opus 5.5card.key"]);
  expect(rowsOf().slice(1, 3).map((row) => row.getAttribute("aria-checked"))).toEqual(["true", "false"]);
  rowsOf()[2]!.click();
  expect(chosen).toEqual([["anthropic", "claude-opus-5-5"]]);
  card.update(view, "en");
  card.show({ vendor: "openai" });
  expect(texts()[1]).toBe("GPT-6 Sol");
});

it("says beside the model's name on the line who pays where the person's key or subscription does, in the card's word, and nothing for the balance", () => {
  card.update({ ...view, current: { ...view.current!, source: "key" } }, "en");
  expect([trigger().textContent, trigger().getAttribute("aria-label")]).toEqual(["Anthropic · Claude Opus 5.5card.key", 'model.spoken{"model":"Anthropic · Claude Opus 5.5 · card.key"}']);
  card.update({ ...view, current: { provider: "openai", id: "sol", name: "GPT-6 Sol", vendor: "openai", vendorName: "OpenAI", served: true, chosen: false, source: "account" } }, "en");
  expect(trigger().textContent).toBe("OpenAI · GPT-6 Solcard.account");
  card.update({ ...view, current: { provider: "openrouter", id: "minimax/m3", name: "MiniMax M3", vendor: "minimax", vendorName: "MiniMax", served: true, chosen: false, source: "platform" }, byName: { provider: "openrouter", id: "minimax/m3" } }, "en");
  expect([trigger().textContent, trigger().getAttribute("aria-label")]).toEqual(["MiniMax · MiniMax M3", 'model.spoken{"model":"MiniMax · MiniMax M3"}']);
});

it("is not drawn with no model on offer: the line is the model in use by the name the card's button would give it, or nothing, and no card opens", () => {
  card.show("vendors");
  card.update({ slots: [], current: { provider: "openrouter", id: "gone", name: "Gone", vendor: "openrouter", vendorName: "openrouter", served: false, chosen: false }, default: undefined }, "en");
  expect(card.opened).toBe(false);
  expect(doc.listening("pointerdown")).toBe(0);
  const [words, ...rest] = element().children as Node[];
  expect(rest).toEqual([]);
  expect(words!.tag).toBe("span");
  expect(words!.classList.contains("model-label")).toBe(true);
  expect(words!.textContent).toBe("openrouter · Gone");
  expect([words!.getAttribute("title"), tipOf(words)]).toEqual([null, "model.title"]);
  card.update({ slots: [], current: { provider: "openrouter", id: "gone", name: "Gone", vendor: "openrouter", vendorName: "openrouter", served: false, chosen: false }, default: { provider: "openrouter", id: "gone", unlisted: true } }, "en");
  expect((element().children as Node[])[0]!.textContent).toBe("card.default · Gone");
  card.show("vendors");
  card.show({ vendor: "anthropic" });
  expect(card.opened).toBe(false);
  card.update(NO_VIEW, "en");
  expect(element().children).toEqual([]);
  card.update(view, "en");
  expect(element().children).toHaveLength(2);
  expect(trigger().textContent).toBe("Anthropic · Claude Opus 5.5");
  card.show("vendors");
  expect(card.opened).toBe(true);
});

it("keeps a name's words in a box of their own ahead of what stands beside them, so a long name ends in an ellipsis and never clips its tag", () => {
  const classes = (node: Node): (string | null)[] => node.children.map((child) => (typeof child === "string" ? null : child.getAttribute("class")));
  card.show({ vendor: "anthropic" });
  const [title, model] = rowsOf();
  expect(classes(title!.querySelector(".mp-name")!)).toEqual(["mp-text", "f-tag"]);
  expect(classes(model!)).toEqual(["mp-slot", "mp-name", "f-tag"]);
  expect(classes(model!.querySelector(".mp-name")!)).toEqual(["mp-text"]);
  const rule = /\.mp-text\s*\{[^}]*\}/.exec(readFileSync(new URL("./site/app.css", import.meta.url), "utf8"))?.[0];
  expect(rule).toContain("min-width: 0");
  expect(rule).toContain("text-overflow: ellipsis");
});

it("toggles from the line, and holds its rows alone: the source's credit is the Plugins pages'", () => {
  trigger().click();
  expect(card.opened).toBe(true);
  trigger().click();
  expect(card.opened).toBe(false);
  const parts = (element().children[1] as Node).children as readonly Node[];
  expect([parts.length, parts[0]!.classList.contains("mp-rows"), element().textContent.includes("card.credit")]).toEqual([1, true, false]);
});
