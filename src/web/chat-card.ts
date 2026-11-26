import { CARD_PLACES, type CardChoices } from "../shared/card-choices.js";
import type { Maker } from "../shared/model-series.js";

/** One of a card's series as the person reaches it today: the id the record keeps it by, its name, and its served versions, newest first. */
export type ChatSeries<V> = { readonly id: string; readonly name: string; readonly versions: readonly V[]; readonly maker?: Maker };
type Versioned = { readonly id: string };
export type CardRow<V> = { readonly card: string; readonly series: ChatSeries<V>; readonly version: V };
/**
 * What chat offers: the vendors on the card, in their order, and each ticked series of theirs as the version it is on now; and the vendors
 * holding the card's places, the turned-off ones among them.
 */
export type ChatCard<V> = { readonly vendors: readonly string[]; readonly rows: readonly CardRow<V>[]; readonly places: readonly string[] };

const installed = (choices: CardChoices, card: string): boolean => choices.plugins?.[card] !== undefined;
const ticks = (choices: CardChoices | undefined, card: string): readonly string[] => choices?.models[card] ?? [];

export const isTicked = (choices: CardChoices | undefined, card: string, series: string): boolean => ticks(choices, card).includes(series);
export const pinOf = (choices: CardChoices | undefined, card: string, series: string): string | undefined => choices?.pins?.[card]?.[series];

/** The version a series is on: its pin while that is served, else its latest; none for a series that serves nothing. */
export function versionOf<V extends Versioned>(choices: CardChoices | undefined, card: string, series: ChatSeries<V>): V | undefined {
  const pin = pinOf(choices, card, series.id);
  return series.versions.find((version) => version.id === pin) ?? series.versions[0];
}

/** A pin whose version is no longer served: the series follows its latest meanwhile, and the record keeps the pin. */
export function pinGone(choices: CardChoices | undefined, card: string, series: ChatSeries<Versioned>): string | undefined {
  const pin = pinOf(choices, card, series.id);
  return pin === undefined || series.versions.some((version) => version.id === pin) ? undefined : pin;
}

/**
 * The card as the record draws it, on every backend. Its vendors are the installed plugins that are on with a series ticked, in the order
 * their first series was ticked; a turned-off one keeps its place and its ticks in the record and puts nothing in chat. Each ticked series
 * is one row, as the version it is on now, reached as `series` reaches it; a ticked series serving nothing today puts no row, and its
 * vendor keeps its place. Nothing ticked is Default alone.
 */
export function chatCard<V extends Versioned>(choices: CardChoices | undefined, series: Readonly<Record<string, readonly ChatSeries<V>[]>>): ChatCard<V> {
  if (choices === undefined) return { vendors: [], rows: [], places: [] };
  const held = places(choices);
  const vendors = held.filter((card) => choices.plugins?.[card]?.on === true);
  const rows = vendors.flatMap((card) => ticks(choices, card).flatMap((id): CardRow<V>[] => {
    const one = series[card]?.find((each) => each.id === id);
    const version = one === undefined ? undefined : versionOf(choices, card, one);
    return one === undefined || version === undefined ? [] : [{ card, series: one, version }];
  }));
  return { vendors, rows, places: held };
}

/**
 * The one rule for a place in chat, which everything that asks it reads: a vendor holds one exactly when its plugin is installed and one
 * of its series is ticked, on or off, reached today or not. A vendor the record lists with no tick holds none.
 */
export const places = (choices: CardChoices): readonly string[] => choices.vendors.filter((card) => installed(choices, card) && ticks(choices, card).length > 0);

/** Why a tick was refused: chat holds five vendors already, or the vendor five series. */
export type TickRefused = "full" | "many";

/**
 * The record after a series is ticked or unticked. The first tick puts its vendor in chat, last, and clearing the last tick takes it out.
 * With five vendors in chat a tick on another is refused, `full`, and so is a sixth series of one vendor, `many`, since the card shows
 * five of a vendor's (ruled 2026-10-22); the record stays as it was. A plugin not installed takes no tick. A pin is not touched.
 */
export function withTick(choices: CardChoices, card: string, series: string, on: boolean): CardChoices | TickRefused {
  const held = ticks(choices, card);
  if (on === held.includes(series)) return choices;
  if (!on) {
    const kept = held.filter((id) => id !== series);
    return { ...choices, vendors: kept.length === 0 ? choices.vendors.filter((id) => id !== card) : choices.vendors, models: { ...choices.models, [card]: kept } };
  }
  if (!installed(choices, card)) return choices;
  if (held.length >= CARD_PLACES) return "many";
  const placed = places(choices);
  if (placed.includes(card)) return { ...choices, vendors: placed, models: { ...choices.models, [card]: [...held, series] } };
  if (placed.length >= CARD_PLACES) return "full";
  return { ...choices, vendors: [...placed, card], models: { ...choices.models, [card]: [...held, series] } };
}

/** The record after a vendor's series are ticked in turn, for one write: a refusal keeps the ticks before it, and is answered with them. */
export function withTicks(choices: CardChoices, card: string, series: readonly string[]): readonly [CardChoices, TickRefused | undefined] {
  let held = choices;
  for (const one of series) {
    const next = withTick(held, card, one, true);
    if (typeof next === "string") return [held, next];
    held = next;
  }
  return [held, undefined];
}

/** The record with a vendor taken out of chat: every tick of its series cleared, reached today or not. Its pins are kept. */
export function withoutVendor(choices: CardChoices, card: string): CardChoices {
  if (!choices.vendors.includes(card) && ticks(choices, card).length === 0) return choices;
  return { ...choices, vendors: choices.vendors.filter((id) => id !== card), models: { ...choices.models, [card]: [] } };
}

/** The record after a series is held at a version, or let follow its latest again: whether or not it is ticked. */
export function withPin(choices: CardChoices, card: string, series: string, version: string | undefined): CardChoices {
  const { [series]: _was, ...rest } = choices.pins?.[card] ?? {};
  const pinned = version === undefined ? rest : { ...rest, [series]: version };
  const { [card]: _card, ...others } = choices.pins ?? {};
  return { ...choices, pins: Object.keys(pinned).length === 0 ? others : { ...others, [card]: pinned } };
}

/** Whether a tick on a vendor not in chat would be refused: five vendors already hold the card's places. */
export const chatFull = (choices: CardChoices | undefined, card: string): boolean =>
  choices !== undefined && !places(choices).includes(card) && places(choices).length >= CARD_PLACES;
