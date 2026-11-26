import { CARD_PLACES, PICK_BOUND_MS, type PickOutcome } from "../shared/card-choices.js";
import { makerOf, PROVIDERS } from "../shared/model-makers.js";
import { plainName } from "../shared/model-series.js";
import { isDefault, type Account, type ChatOffer, type Model, type Models, type PendingPick, type Provider } from "./backend.js";
import { pluginName } from "./catalogue.js";
import type { CardWords } from "../shared/maker-words.js";
import { h, svg } from "./dom.js";
import { giveBack, hideTip, hideTipWithin, tip } from "./forms.js";
import type { Say } from "./stream-view.js";
import { lastModel, type StreamState } from "./stream-model.js";

/**
 * The model card: a view of the models the box offers and of the person's vendor slots, drawn under the composer's right edge. Seven
 * rows of one height on every level — default, five vendors, others; then ‹ vendor, five models, others — so the card's shape never
 * changes under the hand: a vendor with fewer models leaves its rows empty rather than shrinking the card. Nothing here names a vendor:
 * every vendor, its source, its order and its models are read from what the backends report. The card lays its rows out itself, from
 * the one row count here, so the stylesheet holds only the theme's names.
 */
export const SLOTS = CARD_PLACES;

/** Where a model comes from: the platform's key, the person's own key, or an account of theirs at the provider. */
export type Source = "platform" | "key" | "account";
type Named = { readonly provider: string; readonly id: string };
/**
 * A model as its vendor's level lists it: the record the box reports, where it is paid, and — when it reaches the vendor through another
 * provider, an aggregator — that provider's name.
 */
export type SlotModel = Model & { readonly source: Source; readonly through?: string };
/**
 * A vendor as the card shows it: every model of it the box reports, and the person's own way to it when they brought one,
 * else the platform's; `onCard` says it takes one of the card's places.
 */
/**
 * `unavailable`: a vendor the person ticked with nothing on offer now; it keeps its place in the record and is drawn there, to be unticked.
 * `waiting`: a vendor the person holds a key for whose models only the box can list, while it has not answered.
 */
export type Slot = { readonly id: string; readonly name: string; readonly source: Source; readonly models: readonly SlotModel[]; readonly onCard: boolean; readonly unavailable?: true; readonly waiting?: true };
export type Current = Named & { readonly name: string; readonly vendor: string; readonly vendorName: string; /** Among the models offered; one that is not stays the current one, said so. */ readonly served: boolean; /** A pick the page holds that pi has not taken yet. */ readonly chosen: boolean; /** Who pays for it, where a card's row says: the person's key or subscription, or the balance. */ readonly source?: Source };
/** `default` is the platform's pick as it names it, which the page never names; `unlisted` marks one the box does not offer yet, which no row can choose. */
/** `byRecord`: the slots are the record's ticks, so a card with none is Default alone and still opens, on Default and the way to add vendors. */
export type CardView = { readonly slots: readonly Slot[]; readonly current: Current | undefined; readonly default: (Named & { readonly unlisted?: true }) | undefined; readonly byName?: Named; readonly byRecord?: true };
/** The card before the box has answered: no vendor, no model in use, no default. */
export const NO_VIEW: CardView = Object.freeze({ slots: Object.freeze([]), current: undefined, default: undefined });
export type Level = "vendors" | { readonly vendor: string };
export type Row =
  | { readonly kind: "default"; readonly inUse: boolean }
  | { readonly kind: "vendor"; readonly slot: Slot; readonly inUse: boolean }
  | { readonly kind: "back"; readonly slot: Slot }
  | { readonly kind: "model"; readonly model: SlotModel; readonly inUse: boolean; readonly tagged: boolean }
  | { readonly kind: "empty" }
  | { readonly kind: "waiting" }
  | { readonly kind: "others"; readonly vendor: string | undefined };
export type ModelRow = Extract<Row, { readonly kind: "model" }>;

const same = (one: Named, other: Named): boolean => one.provider === other.provider && one.id === other.id;
/** The model in use and the platform's default, which is all a tick needs: the card's view carries both. */
type InUse = { readonly current: Named | undefined; readonly default?: Named | undefined; /** The model the person last picked by name on this page: the platform's default picked by name is that name, not Default. */ readonly byName?: Named | undefined };

/** Whether the model in use is the Default row's: the platform's default, unless the person picked that model by name. */
export const isPlatform = (use: InUse): boolean => isDefault(use.current, use.default) && !(use.byName !== undefined && use.current !== undefined && same(use.byName, use.current));

/**
 * How the notice names a default the box no longer finds, given as `<provider>/<model>`: by its name where the list still holds it, else
 * by the model's own id, since the provider word is the platform's route and no name is left to read.
 */
export function droppedName(word: string, available: readonly Pick<Model, "provider" | "id" | "name">[]): string {
  const slash = word.indexOf("/");
  if (slash <= 0) return word;
  const [provider, id] = [word.slice(0, slash), word.slice(slash + 1)];
  const found = available.find((model) => model.provider === provider && model.id === id);
  return found === undefined ? id : plainName(found.name);
}

/** A vendor on the card goes by its plugin's name, as its plugin page does: GPT, Claude, Kimi. */
const makerName = pluginName;

/**
 * A model's vendor: the card pi's registry puts it on — its maker's, or for a host's key the host's own — by the card's name, the model
 * by its name with the maker's `Maker: ` taken off, so a model is named alike whichever way reaches it and whether cx's computer answers
 * or not. A model no card holds is the maker its aggregator names ahead of its id and its name, else its provider's.
 */
export function vendorOf(model: Pick<Model, "provider" | "id" | "name" | "aggregator">, providerName: (provider: string) => string | undefined, made: CardWords): { readonly id: string; readonly name: string; readonly model: string } {
  const card = makerOf(model.provider, model.id);
  if (card !== undefined) return { id: card, name: makerName(card, made)!, model: plainName(model.name) };
  const slash = model.aggregator === true ? model.id.indexOf("/") : -1;
  if (slash > 0) {
    const id = model.id.slice(0, slash).toLowerCase();
    const colon = model.name.indexOf(": ");
    return colon > 0 ? { id, name: model.name.slice(0, colon), model: model.name.slice(colon + 2) } : { id, name: id, model: model.name };
  }
  return { id: model.provider.toLowerCase(), name: providerName(model.provider) ?? model.provider, model: model.name };
}

/**
 * The platform's, or — where `via` names a credential of the person's — the one the model's record says it is, else their key ahead of
 * their account, as the proxy reads them.
 */
export function sourceOf(model: Model, providers: readonly Provider[], accounts: readonly Account[]): Source {
  if (model.via === undefined) return "platform";
  if (model.own !== undefined) return model.own;
  if (providers.some((provider) => provider.id === model.provider && provider.ownKey)) return "key";
  return accounts.some((account) => account.id === model.provider && account.signedIn) ? "account" : "key";
}

const RANK: Readonly<Record<Source, number>> = Object.freeze({ key: 0, account: 1, platform: 2 });
/** A provider's display name as the person's records give it: the provider's, else the account's at that provider. */
const providerNameOf = (providers: readonly Provider[], accounts: readonly Account[]) => (provider: string): string | undefined =>
  providers.find((known) => known.id === provider)?.name ?? accounts.find((known) => known.id === provider)?.name;

/** A model's own name as `vendorOf` gives it, which no maker's words bear on. */
const modelNamed = (model: Model): string => vendorOf(model, () => undefined, {}).model;

/**
 * Every vendor with a model on offer: the ones the person brought first, in the order their models are listed, then the platform's; a
 * vendor's tag is the person's own way to it when they brought one, their key before their account. A row is a record: every model the
 * box reports is a row of its vendor, so a model two credentials reach — the person's and the platform's, or two of the person's — is
 * two rows, each paid its own way. The vendors the person ticked take the card's places, in the order ticked and at most five, and come
 * first; with none recorded the card takes the first five. The plugins page shows all.
 */
export function vendorSlots(models: Models, providers: readonly Provider[], accounts: readonly Account[], made: CardWords, ticked?: readonly string[]): readonly Slot[] {
  const providerName = providerNameOf(providers, accounts);
  const slots = new Map<string, { readonly name: string; source: Source; readonly models: SlotModel[]; readonly waiting?: true }>();
  for (const model of models.available) {
    const vendor = vendorOf(model, providerName, made);
    const source = sourceOf(model, providers, accounts);
    const through = vendor.id === model.provider.toLowerCase() || PROVIDERS[model.provider]?.card === vendor.id ? undefined : providerName(model.provider) ?? model.provider;
    const slot = slots.get(vendor.id) ?? { name: vendor.name, source, models: [] };
    if (RANK[source] < RANK[slot.source]) slot.source = source;
    slot.models.push({ ...model, source, ...(through === undefined ? {} : { through }) });
    slots.set(vendor.id, slot);
  }
  // The platform knows the vendors the person holds a key for, whether or not it can list their models before the box answers.
  for (const provider of providers) {
    const card = PROVIDERS[provider.id]?.card ?? provider.id.toLowerCase();
    if (provider.ownKey && !models.available.some((model) => model.provider === provider.id) && !slots.has(card)) {
      slots.set(card, { name: makerName(card, made) ?? provider.name, source: "key", models: [], waiting: true });
    }
  }
  const all = [...slots].map(([id, slot]) => ({ id, name: slot.name, source: slot.source, models: slot.models, ...(slot.waiting === true ? { waiting: true as const } : {}) }));
  const listed = [...all.filter((slot) => slot.source !== "platform"), ...all.filter((slot) => slot.source === "platform")];
  if (ticked === undefined) return listed.map((slot, at) => ({ ...slot, onCard: at < SLOTS }));
  // The record as it is recorded: every tick holds its place, whether or not its vendor has anything on offer now.
  const places = ticked.filter((id, at) => ticked.indexOf(id) === at).slice(0, SLOTS);
  return [
    ...places.map((id): Slot => listed.find((slot) => slot.id === id) === undefined
      ? { id, name: makerName(id, made) ?? providerName(id) ?? id, source: "platform", models: [], onCard: true, unavailable: true }
      : { ...listed.find((slot) => slot.id === id)!, onCard: true }),
    ...listed.filter((slot) => !places.includes(slot.id)).map((slot) => ({ ...slot, onCard: false })),
  ];
}

/** How a model is paid, as the rows' tags tell it apart: the platform, else the aggregator the person's credential reaches it through, else their key or account at the vendor. */
const way = (model: Pick<SlotModel, "source" | "through">): string => (model.source === "platform" || model.through === undefined ? model.source : `through\u0000${model.through}`);
/** Whether a vendor's models are paid more than one way; then each of its rows names its own, which is what says which key pays. */
export const paidManyWays = (slot: Pick<Slot, "models">): boolean => new Set(slot.models.map(way)).size > 1;
/** A model row's tag: the platform, the aggregator the person's credential reaches the model through, or the person's key or account. */
export const paidBy = (model: Pick<SlotModel, "source" | "through">, say: Say): string => (model.source === "platform" || model.through === undefined ? say(`card.${model.source}`) : model.through);

/**
 * The ticked vendors after the person ticks or unticks one, from the ticks recorded — or, with none, the card's places as they stand. A
 * tick changes only by the person's own act: one with nothing on offer now — the box asleep, a key being replaced — keeps its place, and
 * with five ticked another cannot be ticked until the person unticks one.
 */
export function toggled(slots: readonly Slot[], ticked: readonly string[] | undefined, vendor: string, on: boolean): readonly string[] {
  const recorded = ticked ?? slots.filter((slot) => slot.onCard).map((slot) => slot.id);
  const kept = recorded.filter((id, at) => recorded.indexOf(id) === at);
  if (!on) return kept.filter((id) => id !== vendor);
  if (kept.includes(vendor) || kept.length >= SLOTS) return kept;
  return [...kept, vendor];
}

/**
 * The ticked vendors after the person adds a credential at `provider`: where ticks are recorded, the credential's one vendor takes a free
 * place — the vendor its listed models name, or, before the box lists them, the provider's card — a host's own — unless a listed model
 * marks it an aggregator no card holds. Such an aggregator's key, a full card or no ticks recorded — the card taking the first five as listed, the person's own first —
 * leave them as they are.
 */
export function tickedWith(ticked: readonly string[] | undefined, slots: readonly Slot[], provider: string): readonly string[] | undefined {
  if (ticked === undefined) return ticked;
  const through = slots.flatMap((slot) => slot.models.filter((model) => model.provider === provider));
  const vendors = [...new Set(slots.filter((slot) => slot.models.some((model) => model.provider === provider && model.via !== undefined)).map((slot) => slot.id))];
  const vendor = vendors.length === 1 ? vendors[0]! : vendors.length === 0 && !through.some((model) => model.aggregator === true) ? PROVIDERS[provider]?.card ?? provider.toLowerCase() : undefined;
  if (vendor === undefined || ticked.includes(vendor) || ticked.length >= SLOTS) return ticked;
  const next = toggled(slots, ticked, vendor, true);
  return next.includes(vendor) ? next : ticked;
}

/** How many of a slot's models the card shows: up to five for a vendor on the card, none for one off it. */
export const shownOnCard = (slot: Pick<Slot, "models" | "onCard">): number => (slot.onCard ? Math.min(slot.models.length, SLOTS) : 0);

/**
 * What the card draws, from the models the box offers and the records of what the person brought. Where the record keeps series, its
 * offer is what the card lists, vendors and models both; the model in use is still known by every model on offer.
 */
export function cardView(models: Shown, providers: readonly Provider[], accounts: readonly Account[], made: CardWords, ticked?: readonly string[], byName?: Named, offer?: ChatOffer): CardView {
  const providerName = providerNameOf(providers, accounts);
  const listed = (named: Named): Model | undefined => models.available.find((model) => same(model, named));
  const current = models.current;
  const known = current === undefined ? undefined : listed(current);
  const vendor = current === undefined ? undefined : vendorOf(known ?? { provider: current.provider, id: current.id, name: current.name ?? current.id }, providerName, made);
  const fallback = models.default;
  const slots = offer === undefined ? vendorSlots(models, providers, accounts, made, ticked) : vendorSlots({ ...models, available: offer.models }, providers, accounts, made, offer.vendors);
  const source = current === undefined ? undefined : slots.flatMap((slot) => slot.models).find((model) => same(model, current))?.source;
  return {
    slots,
    current: current === undefined || vendor === undefined ? undefined : { provider: current.provider, id: current.id, name: vendor.model, vendor: vendor.id, vendorName: vendor.name, served: known !== undefined, chosen: models.chosen === true, ...(source === undefined ? {} : { source }) },
    default: fallback === undefined ? undefined : { provider: fallback.provider, id: fallback.id, ...(listed(fallback) === undefined ? { unlisted: true as const } : {}) },
    ...(byName === undefined ? {} : { byName }),
    ...(offer === undefined ? {} : { byRecord: true as const }),
  };
}

/** Default with today's model beside it; Default alone while the model has no name but its id, before the box lists it. */
const platformLine = (current: { readonly id: string; readonly name: string }, say: Say): string =>
  current.name === current.id ? say("card.default") : `${say("card.default")} · ${current.name}`;

/** The one line the collapsed card is: the vendor and the version in use by its own full name, or Default with today's model while the Default row's pick is; a pick pi has not taken yet is said as chosen. */
export const label = (view: CardView, say: Say): string => {
  const current = view.current;
  if (current === undefined) return say("model.choose");
  const named = isPlatform(view) ? platformLine(current, say) : `${current.vendorName} · ${current.name}`;
  return current.chosen ? say("card.chosenLine", { model: named }) : named;
};

/**
 * The line drawn in its parts, so where it does not fit the vendor's name gives way, to an ellipsis, and the model's keeps its length.
 * A vendor's name never holds the dot, so the line's first one is the one between them.
 */
const lineParts = (words: string): readonly (Node | string)[] => {
  const dot = words.indexOf(" · ");
  if (dot < 0) return [words];
  return [h("span", { class: "mp-vendor" }, words.slice(0, dot)), h("span", { class: "mp-sep" }, " · "), h("span", { class: "mp-model" }, words.slice(dot + 3))];
};

/** Where the card opens: on the level that ticks the model in use, so a person checking whether a pick took lands on it; the vendors otherwise. */
export function openingLevel(view: CardView): Level {
  const vendor = view.current === undefined || isPlatform(view) ? undefined : view.current.vendor;
  if (vendor === undefined) return "vendors";
  const level = { vendor };
  return rows(view, level).some((row) => row.kind === "model" && row.inUse) ? level : "vendors";
}

/** The rows of a level, as many as it has and no blank one to fill it out; a vendor no longer offered opens on the vendors. */
export function rows(view: CardView, level: Level): readonly Row[] {
  const current = view.current;
  const slot = level === "vendors" ? undefined : view.slots.find((known) => known.id === level.vendor);
  if (slot === undefined) {
    const defaultInUse = isPlatform(view);
    const vendors: Row[] = view.slots.filter((known) => known.onCard && known.unavailable !== true).map((known) => ({ kind: "vendor", slot: known, inUse: !defaultInUse && current?.vendor === known.id }));
    return [{ kind: "default", inUse: defaultInUse }, ...vendors, { kind: "others", vendor: undefined }];
  }
  const models: Row[] = slot.waiting === true ? [{ kind: "waiting" }] : [...modelRows(slot.models.slice(0, SLOTS), view, paidManyWays(slot))];
  return [{ kind: "back", slot }, ...models, { kind: "others", vendor: slot.id }];
}

/**
 * Every model given as a row, in the order given: the one in use marked — unless it is the platform's default, which no model row names —
 * and — where its vendor's models are paid more than one way — how it is paid.
 */
export function modelRows(models: readonly SlotModel[], use: InUse, tagged: boolean): readonly ModelRow[] {
  const current = isPlatform(use) ? undefined : use.current;
  return models.map((model) => ({ kind: "model", model, inUse: current !== undefined && same(current, model), tagged }));
}

const SHAPES = Object.freeze({
  circle: (): SVGElement => svg("circle", { cx: "12", cy: "12", r: "10.5" }),
  square: (): SVGElement => svg("rect", { x: "2", y: "2", width: "20", height: "20", rx: "5.5" }),
  hexagon: (): SVGElement => svg("polygon", { points: "12,1.2 21.6,6.6 21.6,17.4 12,22.8 2.4,17.4 2.4,6.6" }),
  diamond: (): SVGElement => svg("polygon", { points: "12,1 23,12 12,23 1,12" }),
  shield: (): SVGElement => svg("path", { d: "M12 1.5 21.5 5v7.2c0 5.2-4 9.3-9.5 10.8C6.5 21.5 2.5 17.4 2.5 12.2V5z" }),
  drop: (): SVGElement => svg("path", { d: "M12 1.3c4.2 5.2 8.3 9.3 8.3 13.5a8.3 8.3 0 0 1-16.6 0c0-4.2 4.1-8.3 8.3-13.5z" }),
});
const SHAPE_NAMES = Object.keys(SHAPES) as readonly (keyof typeof SHAPES)[];

/** A vendor's glyph while no brand mark is drawn: a shape its id picks and its initial, in the text colour. */
export function glyphSpec(slot: Pick<Slot, "id" | "name">): { readonly shape: keyof typeof SHAPES; readonly letter: string } {
  let hash = 0;
  for (const char of slot.id) hash = (hash * 31 + char.codePointAt(0)!) % 1_000_003;
  return { shape: SHAPE_NAMES[hash % SHAPE_NAMES.length]!, letter: [...slot.name.trim()][0]?.toUpperCase() ?? "?" };
}

function glyph(slot: Pick<Slot, "id" | "name">): SVGSVGElement {
  const spec = glyphSpec(slot);
  const shape = SHAPES[spec.shape]();
  shape.setAttribute("fill", "currentColor");
  shape.setAttribute("opacity", "0.14");
  const letter = svg("text", { x: "12", y: "12.5", "text-anchor": "middle", "dominant-baseline": "central", "font-size": "11.5", "font-weight": "700", fill: "currentColor" }, spec.letter);
  return svg("svg", { viewBox: "0 0 24 24", class: "mp-glyph", "aria-hidden": "true" }, shape, letter);
}

/** What a drawn row stands for, so a redraw can give the focus back to the same row; an empty row takes no focus and has none. */
const rowKey = (row: Row): string | undefined => {
  switch (row.kind) {
    case "vendor": return `vendor:${row.slot.id}`;
    case "model": return `model:${row.model.provider}/${row.model.id}`;
    case "empty": case "waiting": return undefined;
    default: return row.kind;
  }
};

export type CardPorts = {
  readonly say: Say;
  /** `platform` when the Default row was picked, not a model by its name. */
  /** A row of a series also names the series, and whether the person pinned the version it is on. */
  readonly choose: (provider: string, modelId: string, platform?: boolean, series?: SeriesPick) => void;
  /** Others: the plugins page, where the vendors on the card are ticked and a vendor's models are listed. */
  readonly others: (vendor: string | undefined) => void;
};

/**
 * The card's element: the trigger line, and the card that opens upward from it. With no model on offer — the box unreachable — a control
 * that chooses nothing is not drawn: the line is the model in use in plain words, or nothing. A stream event redraws the composer many
 * times a second, so the rows are drawn again only when what they show has changed, never under the person's hand for nothing.
 */
export class ModelCard {
  readonly element = h("div", { class: "mp" });
  #view: CardView = NO_VIEW;
  #drawn = "";
  #level: Level = "vendors";
  #opened = false;
  /** Whether the element holds the plain words rather than the trigger and the card; it holds nothing until a view is drawn. */
  #plain = true;
  /** What the model's button does, or why its model is not served: the button's tip. */
  #hint = "";
  readonly #label = tip(h("span", { class: "model-label" }), () => [this.ports.say("model.title")]);
  readonly #rows = h("div", { class: "mp-rows" });
  readonly #card: HTMLElement;
  readonly #trigger: HTMLButtonElement;
  /** The row's name, where the control is a row whole: it stands at the press's left, the model at its right. */
  #lead: HTMLElement | undefined;
  readonly #outside = (event: Event): void => { if (!(event.target instanceof Node && this.element.contains(event.target))) this.close(); };
  readonly #keys = (event: KeyboardEvent): void => {
    if (event.key === "Escape") { event.preventDefault(); this.close(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const items = [...this.#rows.querySelectorAll<HTMLElement>("button.mp-row")];
      const at = items.indexOf(document.activeElement as HTMLElement);
      // From outside the rows, down is the first row and up the last; Home and End are the first and the last, as the set's menu has them.
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : at < 0 ? (event.key === "ArrowDown" ? 0 : items.length - 1) : (at + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
      items[next]?.focus();
    }
    if (event.key === "ArrowLeft" && this.#level !== "vendors") { event.preventDefault(); this.show("vendors"); }
  };

  constructor(readonly ports: CardPorts) {
    this.#trigger = tip(h("button", { type: "button", class: "mp-trigger", "aria-haspopup": "menu", "aria-expanded": "false", onclick: () => (this.#opened ? this.close() : this.open()) }), () => [this.#opened ? "" : this.#hint]);
    this.#card = h("div", { class: "mp-card", role: "menu", "aria-hidden": "true" }, this.#rows);
    this.#card.inert = true;
  }

  get opened(): boolean { return this.#opened; }
  get level(): Level { return this.#level; }

  /** Makes the control its row whole, the row's name at its left: drawn from the next drawing on. */
  lead(name: HTMLElement): void { this.#lead = name; this.redraw(); }
  get view(): CardView { return this.#view; }

  /** Draws the card for a view in a language; nothing is drawn again while both are what they were. */
  update(view: CardView, language: string): void {
    const drawn = `${language}\u0000${JSON.stringify(view)}`;
    if (drawn === this.#drawn) return;
    this.#view = view;
    this.#drawn = drawn;
    this.redraw();
  }

  /** Draws again in the language of the moment. */
  redraw(): void {
    const say = this.ports.say;
    if (this.#view.slots.length === 0 && this.#view.byRecord !== true) {
      this.close();
      const current = this.#view.current;
      // The model goes by one name whether or not there is anything to choose: the line the card's button would read.
      this.#label.replaceChildren(...(current === undefined ? [] : lineParts(label(this.#view, say))));
      // The button leaves for the plain name: its tip leaves first.
      hideTipWithin(this.element);
      this.element.replaceChildren(...(current === undefined ? [] : [...(this.#lead === undefined ? [] : [this.#lead]), this.#label]));
      this.#plain = true;
      return;
    }
    if (this.#plain) {
      this.element.replaceChildren(this.#trigger, this.#card);
      this.#plain = false;
    }
    const words = label(this.#view, say);
    // A model the person's own key or subscription pays says so beside its name, in the card's word; the balance's says nothing.
    const source = isPlatform(this.#view) ? undefined : this.#view.current?.source;
    const paid = source === undefined || source === "platform" ? undefined : say(`card.${source}`);
    const value = [...lineParts(words), ...(paid === undefined ? [] : [h("span", { class: "f-tag mp-paid" }, paid)])];
    this.#trigger.replaceChildren(...(this.#lead === undefined ? value : [this.#lead, h("span", { class: "cc-chosen" }, ...value)]));
    // With no model known the line already says the action; spoken, it is said once.
    this.#trigger.setAttribute("aria-label", this.#view.current === undefined ? words : say("model.spoken", { model: paid === undefined ? words : `${words} · ${paid}` }));
    this.#hint = this.#view.current?.served === false ? say("card.notServed") : say("model.choose");
    this.#trigger.classList.toggle("mp-unserved", this.#view.current?.served === false);
    this.#card.setAttribute("aria-label", say("model.choose"));
    // Drawing replaces the rows: the one in the person's hand keeps the focus, or the first row takes it when that one is gone, so the keys go on working.
    const focused = document.activeElement;
    const held = focused instanceof Node && this.#rows.contains(focused) ? (focused as Element).getAttribute("data-row") ?? undefined : undefined;
    const drawn = rows(this.#view, this.#level);
    // The card is as tall as its rows: the stylesheet holds no count of them.
    this.#rows.style.gridTemplateRows = `repeat(${drawn.length}, minmax(var(--row), auto))`;
    this.#rows.replaceChildren(...drawn.map((row) => {
      const drawn = this.#row(row);
      const key = rowKey(row);
      if (key !== undefined) drawn.setAttribute("data-row", key);
      return drawn;
    }));
    if (held === undefined) return;
    const buttons = [...this.#rows.querySelectorAll<HTMLElement>("button.mp-row")];
    (buttons.find((button) => button.getAttribute("data-row") === held) ?? buttons[0])?.focus({ preventScroll: true });
  }

  #row(row: Row): HTMLElement {
    const say = this.ports.say;
    // A row's marks are drawn and not read: its checked state, its menu and its words say what they show.
    const tick = (): HTMLElement => h("span", { class: "mp-tick", "aria-hidden": "true" }, "✓");
    // A pick pi has not taken yet says so in words, quiet, beside its tick.
    const chosen = (inUse: boolean): readonly Node[] => (inUse && this.#view.current?.chosen === true ? [h("span", { class: "mp-hint" }, say("card.chosenTag"))] : []);
    const slot = (...children: readonly (Node | string)[]): HTMLElement => h("span", { class: "mp-slot" }, ...children);
    // The words shrink to an ellipsis ahead of anything beside them, so a long name never clips the tag that follows it.
    const name = (words: string, ...beside: readonly Node[]): HTMLElement => h("span", { class: "mp-name" }, h("span", { class: "mp-text" }, words), ...beside);
    const tag = (words: string): HTMLElement => h("span", { class: "f-tag" }, words);
    // A model offered by series is named by its series, with the version the series is on today beside it.
    const member = (model: Model): readonly Node[] => (model.series === undefined || model.series === model.name ? [] : [h("span", { class: "mp-hint mp-member" }, modelNamed(model))]);
    switch (row.kind) {
      case "empty": return h("div", { class: "mp-row mp-empty", "aria-hidden": "true" });
      case "waiting": return h("div", { class: "mp-row mp-note" }, say("card.whenAwake"));
      case "default": {
        const fallback = this.#view.default;
        if (fallback === undefined || fallback.unlisted === true) return h("div", { class: "mp-row mp-empty", "aria-hidden": "true" });
        // What Default does is said whole: under the name where it does not fit beside it.
        return h("button", { type: "button", class: `mp-row mp-default${row.inUse ? " mp-in-use" : ""}`, role: "menuitemradio", "aria-checked": String(row.inUse), onclick: () => { this.ports.choose(fallback.provider, fallback.id, true); this.close(); } },
          slot(row.inUse ? tick() : ""), h("span", { class: "mp-named" }, name(say("card.default")), ...(chosen(row.inUse).length > 0 ? chosen(row.inUse) : [h("span", { class: "mp-hint" }, say("card.bestValue"))])), tag(say("card.platform")),
          // The platform's pick is billed by the platform, which its tag says; a hidden chevron keeps that tag in the vendors' column.
          h("span", { class: "mp-more mp-spacer", "aria-hidden": "true" }, "›"));
      }
      case "vendor": return h("button", { type: "button", class: `mp-row${row.inUse ? " mp-in-use" : ""}`, role: "menuitem", "aria-haspopup": "menu", onclick: () => this.show({ vendor: row.slot.id }) },
        slot(glyph(row.slot)), name(row.slot.name), tag(say(`card.${row.slot.source}`)), h("span", { class: "mp-more", "aria-hidden": "true" }, "›"));
      case "back": return h("button", { type: "button", class: "mp-row mp-title", role: "menuitem", "aria-label": say("card.backTo", { vendor: row.slot.name }), onclick: () => this.show("vendors") },
        slot("‹"), name(row.slot.name, tag(say(`card.${row.slot.source}`))));
      case "model": return h("button", { type: "button", class: `mp-row${row.inUse ? " mp-in-use" : ""}`, role: "menuitemradio", "aria-checked": String(row.inUse), onclick: () => { this.ports.choose(row.model.provider, row.model.id, false, row.model.seriesId === undefined ? undefined : { id: row.model.seriesId, pinned: row.model.pinned === true }); this.close(); } },
        slot(row.inUse ? tick() : ""), name(row.model.series ?? modelNamed(row.model), ...member(row.model), ...chosen(row.inUse)), ...(row.tagged ? [tag(paidBy(row.model, say))] : []));
      case "others": return h("button", { type: "button", class: "mp-row", role: "menuitem", onclick: () => { this.close(); this.ports.others(row.vendor); } },
        slot(h("span", { "aria-hidden": "true" }, "…")), name(say("card.others")), h("span", { class: "mp-more", "aria-hidden": "true" }, "↗"));
    }
  }

  open(): void {
    hideTip(this.#trigger);
    if (this.#opened || this.#plain) return;
    this.#opened = true;
    this.#level = openingLevel(this.#view);
    this.redraw();
    this.element.classList.add("open");
    this.#card.setAttribute("aria-hidden", "false");
    this.#card.inert = false;
    this.#trigger.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", this.#outside);
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
    this.#card.removeEventListener("keydown", this.#keys);
    this.#level = "vendors";
    // Focus never stays in the closed card, whichever way it closed.
    if (this.#card.contains(document.activeElement)) giveBack(this.#trigger);
  }

  show(level: Level): void {
    this.open();
    if (!this.#opened) return;
    this.#level = level;
    this.redraw();
    this.#rows.querySelector<HTMLElement>("button.mp-row")?.focus({ preventScroll: true });
  }
}

/** The models as the card draws them: a pick the platform keeps for the next message is shown as chosen, not in use. */
export type Shown = Models & { readonly chosen?: true };

/**
 * What the card offers and ticks. The person's pick not yet answered is shown as its answer will show it: in use while the box is awake,
 * chosen while it sleeps. A pick the platform keeps for the next message is drawn as chosen, awake or asleep, since pi takes it only then.
 * Otherwise, while the box answers, pi says the model in use; while it does not, it is pi's last record of a model change in the
 * conversation, whichever parts of it are loaded — the platform's default where the stream answered that the box has no life yet — and
 * nothing at all until the stream has answered, since the page says no model it has not read. The models on offer are the backend's. The page keeps nothing of the model.
 */
export function shownModels(models: Models, box: {
  readonly awake: boolean;
  readonly picked?: Choice | undefined;
  readonly pending: Choice | undefined;
  readonly stream: StreamState;
  readonly heard: boolean;
  /** The last pick the platform said a running box took: while the page cannot count the box awake, it outranks the record. */
  readonly taken?: Choice | undefined;
}): Shown | undefined {
  if (box.picked !== undefined) {
    const current = { provider: box.picked.provider, id: box.picked.modelId };
    return box.awake ? { ...models, current } : { ...models, current, chosen: true };
  }
  if (box.pending !== undefined) return { ...models, current: { provider: box.pending.provider, id: box.pending.modelId }, chosen: true };
  // Awake, pi says what it runs on (its `get_state`). A read made while the box slept names none: until one made since it woke answers,
  // the line keeps the model the stream last said, so it does not flash Choose a model as the box wakes.
  if (box.awake && models.current !== undefined) return models;
  if (box.taken !== undefined) return { ...models, current: { provider: box.taken.provider, id: box.taken.modelId } };
  if (!box.heard) return undefined;
  const last = lastModel(box.stream);
  // A stream that answered naming no life is a box that never ran a session: no pick of the person's was ever taken, and the first
  // session starts on the platform's default, which the line says from then, so a new account is not asked to choose before it sends.
  if (last === undefined && box.stream.epoch === undefined && models.default !== undefined) return { ...models, current: { provider: models.default.provider, id: models.default.id } };
  // A stream that names no model leaves the one the box last answered, which the platform keeps while the box is not there.
  return { ...models, current: last ?? models.current };
}

/** What the page holds of the model: the models on offer and the one in use, and a pick the platform keeps for the next message. */
type HeldModels = { readonly models: Models; readonly pending: Choice | undefined; readonly taken?: Choice | undefined };

/**
 * A read of the models begun before the person's newest pick, or before its answer, keeps what the page holds of them: the pick and its
 * answer outrank it. No read carries what the platform said it took; the page keeps that until a later answer replaces it.
 */
export function afterRead<G extends HeldModels>(held: G | undefined, read: G, stale: boolean): G {
  const taken = held?.taken;
  return stale && held !== undefined ? { ...read, models: held.models, pending: held.pending, taken } : { ...read, taken };
}

/**
 * The platform's answer to the person's last pick, written into what the page holds: a running box took it, or the platform keeps it for
 * the next message. A refusal or a failure leaves it as it was.
 */
export function afterPick<G extends HeldModels>(held: G, pick: Choice, answer: PickAnswer): G {
  if (answer === "taken") return { ...held, models: { ...held.models, current: { provider: pick.provider, id: pick.modelId } }, pending: undefined, taken: pick };
  if (answer === "pending") return { ...held, pending: pick };
  return held;
}

/** A row of a series as chosen: the series' id, and whether the version it is on is the one the person pinned. */
export type SeriesPick = { readonly id: string; readonly pinned: boolean };

/**
 * A pick as the page draws it: the model the row was on at the click, with its series where it was offered by series. What is sent is
 * `sentPick`'s: a series names no version unless the person pinned one, so the box applies the series' newest.
 */
export type Choice = { readonly provider: string; readonly modelId: string; readonly series?: string; readonly pinned?: true };

/** What goes to the platform for a choice: the series and a pinned version, or the model where no series offered it. */
export const sentPick = (choice: Choice): PendingPick => (choice.series === undefined
  ? { provider: choice.provider, modelId: choice.modelId }
  : { provider: choice.provider, series: choice.series, ...(choice.pinned === true ? { modelId: choice.modelId } : {}) });

/**
 * A pick the platform keeps, as the page draws it: its version where it names one, else the version the card offers its series on now
 * through its provider; nothing where the card offers that series no longer.
 */
export function drawnPick(pick: PendingPick | undefined, offer: ChatOffer | undefined): Choice | undefined {
  if (pick === undefined) return undefined;
  const series = pick.series === undefined ? {} : { series: pick.series };
  if (pick.modelId !== undefined) return { provider: pick.provider, modelId: pick.modelId, ...series, ...(pick.series === undefined ? {} : { pinned: true as const }) };
  const offered = offer?.models.find((model) => model.provider === pick.provider && model.seriesId === pick.series);
  return offered === undefined ? undefined : { provider: pick.provider, modelId: offered.id, ...series };
}

/** What the line under the model says of the person's choice of model: the last pick's failure, or a pending pick refused when a message applied it. */
export type PickWords = "model.notAllowed" | "model.pickRefused" | "model.pickFailed";

/** What the platform said of a pick: `undefined` when it failed or refused it, which `failed` words. */
export type PickAnswer = "taken" | "pending" | undefined;

/** Resolves when what is being sent has gone, or at the bound, whichever is first. */
export function within(sending: Promise<void> | undefined, boundMs: number): Promise<void> {
  if (sending === undefined) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, boundMs);
    void sending.then(() => { clearTimeout(timer); resolve(); });
  });
}

/**
 * Sends the person's picks one at a time, the latest replacing any not yet sent, so the last pick is the one that stands. The newest pick
 * is held from the click until its answer, and every answer is given to `answered` in order; `made` counts the picks, so a
 * read that began before one knows its answer is older than the person's choice.
 */
export class Picks {
  #next: Choice | undefined;
  #held: Choice | undefined;
  #made = 0;
  #answers = 0;
  #sending: Promise<void> | undefined;
  #failed: PickWords | undefined;
  #byName: Named | undefined;
  constructor(
    readonly send: (pick: PendingPick) => Promise<"taken" | "pending">,
    readonly answered: (pick: Choice, answer: PickAnswer) => void,
    readonly boundMs: number = PICK_BOUND_MS,
  ) {}
  /** The last word on the person's choice, until the next pick or a reload. */
  get failed(): PickWords | undefined { return this.#failed; }
  /** The model last picked by name on this page; a pick of the Default row clears it. */
  get byName(): Named | undefined { return this.#byName; }
  /** The newest pick, from the click until its answer. */
  get held(): Choice | undefined { return this.#held; }
  /** How many picks the person has made on this page. */
  get made(): number { return this.#made; }
  /** Changes with every pick and every answer: a read that began at another mark is older than one of them. */
  get mark(): string { return `${this.#made}:${this.#answers}`; }
  /** Resolves once this pick and any made after it have been answered. */
  choose(provider: string, modelId: string, platform = false, series?: SeriesPick): Promise<void> {
    this.#byName = platform ? undefined : { provider, id: modelId };
    this.#next = { provider, modelId, ...(series === undefined ? {} : { series: series.id, ...(series.pinned ? { pinned: true as const } : {}) }) };
    this.#held = this.#next;
    this.#made += 1;
    this.#failed = undefined;
    return this.#sending ??= this.#drain();
  }
  /**
   * Resolves once every pick the person has made has reached the platform, or at the platform's call bound, whichever is first: a message
   * waits on it so it runs on their last choice, and never waits longer, since the platform hands the box whatever waits before it.
   */
  idle(): Promise<void> {
    return within(this.#sending, this.boundMs);
  }
  /**
   * What became of a pending pick a message applied, said on that message's answer; says whether the words changed, so a repeat of the same
   * refusal is ignored. Nothing is read again for it.
   */
  heard(outcome: PickOutcome): boolean {
    const said = outcome === "taken" ? undefined : words(outcome);
    if (said === this.#failed) return false;
    this.#failed = said;
    return true;
  }
  async #drain(): Promise<void> {
    for (let pick = this.#next; pick !== undefined; pick = this.#next) {
      this.#next = undefined;
      const answer = await this.send(sentPick(pick)).then(
        (state) => ({ state, code: undefined }),
        (error: unknown) => ({ state: undefined, code: error instanceof Error ? error.message : "" }),
      );
      this.#answers += 1;
      // Every answer is applied in order, so the page knows the model the computer runs; only the newest pick's answer is the person's last word.
      if (this.#next === undefined) {
        this.#held = undefined;
        this.#failed = answer.code === undefined ? undefined : words(answer.code);
      }
      this.answered(pick, answer.state);
    }
    this.#sending = undefined;
  }
}

/** The line under the model line: a refused or failed pick said where the person looks, naming the model the computer kept; nothing otherwise. */
export const pickLine = (failed: PickWords | undefined, view: CardView, say: Say): string | undefined =>
  failed === undefined ? undefined : failed !== "model.notAllowed" ? say(failed, { model: label({ ...view, current: view.current === undefined ? undefined : { ...view.current, chosen: false } }, say) }) : say(failed);

const words = (code: string): PickWords => (code === "model_not_allowed" ? "model.notAllowed" : code === "model_refused" ? "model.pickRefused" : "model.pickFailed");
