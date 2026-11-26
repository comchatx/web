import { DEFAULT_WAYS, type CardChoices, type Way } from "./card-choices.js";
import { balanceReaches, cardProviders } from "./model-makers.js";
import { BALANCE_PROVIDER, type Door } from "./way-moves.js";

/** How the seller holds a provider: an API key there, or a sign-in. */
export type Held = Readonly<Record<string, "key" | "account">>;

/** The ways the seller keeps for a card, in their order: every way, keys first, where they set none. */
export const waysOf = (choices: CardChoices | undefined, card: string): readonly Way[] => choices?.plugins?.[card]?.ways ?? DEFAULT_WAYS;

/** What can be reached by a way, kept or not, in the order of the ways kept: one whose way is not kept is left out. */
export const inWayOrder = <T>(items: readonly T[], order: readonly Way[], wayOf: (item: T) => Way): readonly T[] =>
  order.flatMap((way) => items.filter((item) => wayOf(item) === way));

/**
 * A card's ways as doors, in the seller's order: the balance's one door where the account may use it and the balance reaches the card, and
 * for a key or a sign-in each of the card's own providers the seller holds one at, as the card lists them; a host is no door of a maker's card.
 */
export function doorsOf(card: string, order: readonly Way[], held: Held, balance: boolean): readonly Door[] {
  const doors: readonly Door[] = [
    ...(balance && balanceReaches(card) ? [{ way: "platform" as const, provider: BALANCE_PROVIDER }] : []),
    ...cardProviders(card).flatMap((provider): readonly Door[] => { const way = held[provider]; return way === undefined ? [] : [{ way, provider }]; }),
  ];
  return inWayOrder(doors, order, (door) => door.way);
}

/** The doors after the one a call came by; none when that door is not among the seller's. */
export function doorsAfter(doors: readonly Door[], from: Door): readonly Door[] {
  const at = doors.findIndex((door) => door.way === from.way && door.provider === from.provider);
  return at < 0 ? [] : doors.slice(at + 1);
}
