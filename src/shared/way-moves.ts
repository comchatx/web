import { WAYS, type Way } from "./card-choices.js";

/** The pi provider the box reaches the platform's balance by: the balance way's one door. */
export const BALANCE_PROVIDER = "balance";

/** One way of a card as the box reaches it: the way, and the pi provider that serves it. */
export type Door = { readonly way: Way; readonly provider: string };

/** The code a refusal carries when the way a call came by is used up and the seller keeps another after it. */
export const WAY_USED_UP = "way_used_up";

/**
 * The header the platform's proxy puts on its own used-up refusal, holding the refusal's text, and drops from every answer a provider
 * gives. The box's hop hands what it says to the steward, which moves a chat only on a refusal so vouched for: a provider's error that
 * copies the refusal's words, which pi shows as the turn's error just the same, moves nothing.
 */
export const WAY_USED_UP_HEADER = "x-cmx-way-used-up";
/**
 * A used-up refusal as read back: the door the call came by, the card whose ways were read, and that card's doors after it in the seller's
 * order — none where the card keeps no door after it, and the turn stops.
 */
export type UsedUpSaid = { readonly from: Door; readonly card: string; readonly next: readonly Door[] };
/** Whether two readings name the same card and the same doors in the same order. */
export const sameDoors = (a: UsedUpSaid, b: UsedUpSaid): boolean =>
  a.card === b.card && doorWord(a.from) === doorWord(b.from) && a.next.length === b.next.length && a.next.every((door, at) => doorWord(door) === doorWord(b.next[at]!));

/**
 * What the steward writes in the chat's record when a used-up way ended a turn, and the page draws as a line: the door it moved the chat to,
 * or none where the card keeps no next door that serves the model, and the chat stays where it was.
 */
export const WAY_MOVED_ENTRY = "cx-way-moved";
export type WayMoved = { readonly from: Door; readonly to?: Door };

const PROVIDER = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const isDoor = (value: unknown): value is Door =>
  typeof value === "object" && value !== null && WAYS.includes((value as Door).way) && typeof (value as Door).provider === "string" && PROVIDER.test((value as Door).provider);
const doorWord = (door: Door): string => `${door.way}:${door.provider}`;
const readDoor = (word: string): Door | undefined => {
  const [way, provider, extra] = word.split(":");
  const door = { way, provider };
  return extra === undefined && isDoor(door) ? door : undefined;
};

/**
 * The refusal's text. pi shows it as the turn's error and its own retry reads it, so it holds none of the words pi retries on (a status
 * number, "error", "limit", "timeout"); the doors stand in one bracket and the card in a second, which the steward reads back.
 */
export const wayUsedUpMessage = (from: Door, next: readonly Door[], card: string): string =>
  `${WAY_USED_UP}: this way has run out for now, and ${next.length === 0 ? "no other way you keep for this model is left" : "the next message goes by the next way you keep"} [from ${doorWord(from)}; next ${next.length === 0 ? "none" : next.map(doorWord).join(" ")}] [card ${card}]`;

const BRACKET = /\[from ([a-z]+:[a-z0-9.-]+); next (none|(?:[a-z]+:[a-z0-9.-]+ ?)+)\] \[card ([a-z0-9][a-z0-9.-]{0,63})\]/;

/** The doors a turn's error names, when it is a used-up way's refusal; nothing for any other text. */
export function readWayUsedUp(text: string | undefined): UsedUpSaid | undefined {
  if (text === undefined || !text.includes(`${WAY_USED_UP}:`)) return undefined;
  const found = BRACKET.exec(text);
  if (found === null) return undefined;
  const from = readDoor(found[1]!);
  const next = found[2] === "none" ? [] : found[2]!.trim().split(" ").map(readDoor);
  if (from === undefined || next.some((door) => door === undefined)) return undefined;
  return { from, card: found[3]!, next: next as Door[] };
}

/** A recorded move as the page reads it back from the chat's record; nothing for a payload that is not one. */
export function readWayMoved(value: unknown): WayMoved | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { from, to } = value as Record<string, unknown>;
  if (!isDoor(from)) return undefined;
  if (to === undefined) return { from: { way: from.way, provider: from.provider } };
  return isDoor(to) ? { from: { way: from.way, provider: from.provider }, to: { way: to.way, provider: to.provider } } : undefined;
}
