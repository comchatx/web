/** How many vendor places the model card has, and how many of one vendor's models it lists. */
export const CARD_PLACES = 5;

/** How a model plugin is reached: the platform's balance, the person's own key, or their account at the maker. */
export type Way = "platform" | "key" | "account";
export const WAYS: readonly Way[] = Object.freeze(["platform", "key", "account"]);
/** The order of a plugin's ways where the person kept none: their own key, then their account, then the balance. */
export const DEFAULT_WAYS: readonly Way[] = Object.freeze(["key", "account", "platform"]);

/** A model plugin the person installed: whether it is on, and the ways it is reached in the order cx uses them. */
export type PluginChoice = { readonly on: boolean; readonly ways: readonly Way[] };

/**
 * What a person chose for the model card and their model plugins. `vendors` are the cards taking the chat card's places, in the order
 * their first series was ticked, and `models` a card's ticked series by series id, in the order ticked. `pins` hold a card's series at a
 * version, by series id to the version's model id, apart from the ticks: a pin outlasts its tick and its version's leaving. `plugins`
 * are the installed model plugins, absent from a record written before plugins were kept; `seen` a card's series whose news is not news
 * to the person, and under `RULE_SEEN`, no card's name, that they said "Don't show again" to the rule cx buys by. The Default row is
 * fixed and is not part of it.
 */
export type CardChoices = {
  readonly vendors: readonly string[];
  readonly models: Readonly<Record<string, readonly string[]>>;
  readonly pins?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly plugins?: Readonly<Record<string, PluginChoice>>;
  readonly seen?: Readonly<Record<string, readonly string[]>>;
};

/** The key of `seen` whose presence says the person waved off the Plugins page's rule line, in every browser they sign in on. */
export const RULE_SEEN = "plugins:rule";

/**
 * The model plugins a new account starts with, on and reached through the platform: "A new account starts with five model plugins on,
 * each answering through the platform" — GPT, Claude, Gemini, DeepSeek and Kimi, the first five of the signed Plugins page's eight
 * (`spikes/plugins-page/README.md`, *Model plugins* and its example world; ruled 2026-09-28: a new account starts with five model plugins through the platform).
 */
export const NEW_ACCOUNT_PLUGINS: readonly string[] = Object.freeze(["openai", "anthropic", "google", "deepseek", "moonshotai"]);
/** A new account's record: the five installed, none of their series ticked, so chat holds Default until the person adds one. */
export const NEW_ACCOUNT_CHOICES: CardChoices = Object.freeze({
  vendors: Object.freeze([]), models: Object.freeze({}),
  plugins: Object.freeze(Object.fromEntries(NEW_ACCOUNT_PLUGINS.map((id) => [id, Object.freeze({ on: true, ways: Object.freeze(["platform" as const]) })]))),
});
/**
 * A new account's record with the model plugins its first packages build on beside the five, each on and paid from the balance, as a
 * press installs them: the record's cards then hand each one's package at the first open as they do after any card's install.
 */
export const newAccountChoices = (models: readonly string[]): CardChoices => models.length === 0 ? NEW_ACCOUNT_CHOICES : Object.freeze({
  ...NEW_ACCOUNT_CHOICES,
  plugins: Object.freeze({ ...NEW_ACCOUNT_CHOICES.plugins, ...Object.fromEntries(models.map((id) => [id, Object.freeze({ on: true, ways: Object.freeze(["platform" as const]) })])) }),
});

const VENDOR = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MODEL = /^[\x21-\x7e]{1,256}$/;
const MAX_VENDORS_WITH_MODELS = 64;
/** How many series of one card the record may hold as seen: a card's `~` series, which are few. */
const MAX_SEEN = 16;
/** How many of one card's series the record may tick or pin: more than any maker lists, and no place of the card's. */
const MAX_SERIES = 32;

const list = (value: unknown, word: RegExp, most = CARD_PLACES): readonly string[] | undefined =>
  Array.isArray(value) && value.length <= most && value.every((item) => typeof item === "string" && word.test(item)) && new Set(value).size === value.length
    ? Object.freeze([...value as string[]]) : undefined;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** A record keyed by card, each value read by `read`, or nothing when any card or value breaks the shape. */
function byCard<T>(value: unknown, read: (one: unknown) => T | undefined): Readonly<Record<string, T>> | undefined {
  if (!isObject(value)) return undefined;
  const entries = Object.entries(value);
  if (entries.length > MAX_VENDORS_WITH_MODELS) return undefined;
  const out: Record<string, T> = {};
  for (const [card, one] of entries) {
    const read1 = VENDOR.test(card) ? read(one) : undefined;
    if (read1 === undefined) return undefined;
    out[card] = read1;
  }
  return Object.freeze(out);
}

/** A card's pins, series id to the version's model id, or nothing when one breaks the shape. */
const readPins = (value: unknown): Readonly<Record<string, string>> | undefined => {
  if (!isObject(value)) return undefined;
  const entries = Object.entries(value);
  return entries.length <= MAX_SERIES && entries.every(([series, version]) => MODEL.test(series) && typeof version === "string" && MODEL.test(version)) ? Object.freeze({ ...value as Record<string, string> }) : undefined;
};

const readPlugin = (value: unknown): PluginChoice | undefined => {
  if (!isObject(value) || Object.keys(value).sort().join() !== "on,ways" || typeof value["on"] !== "boolean") return undefined;
  const ways = value["ways"];
  if (!Array.isArray(ways) || ways.length > WAYS.length || !ways.every((way) => WAYS.includes(way as Way)) || new Set(ways).size !== ways.length) return undefined;
  return Object.freeze({ on: value["on"], ways: Object.freeze([...ways as Way[]]) });
};

/** The record as sent or stored, or nothing when any part breaks the shape: a list longer than five, a repeat, an unknown key. */
export function readCardChoices(value: unknown): CardChoices | undefined {
  if (!isObject(value)) return undefined;
  const keys = Object.keys(value);
  if (!keys.includes("models") || !keys.includes("vendors") || keys.some((key) => !["models", "vendors", "pins", "plugins", "seen"].includes(key))) return undefined;
  const vendors = list(value["vendors"], VENDOR);
  const models = byCard(value["models"], (ids) => list(ids, MODEL, MAX_SERIES));
  const pins = value["pins"] === undefined ? undefined : byCard(value["pins"], readPins);
  const plugins = value["plugins"] === undefined ? undefined : byCard(value["plugins"], readPlugin);
  const seen = value["seen"] === undefined ? undefined : byCard(value["seen"], (ids) => list(ids, MODEL, MAX_SEEN));
  if (vendors === undefined || models === undefined || (value["pins"] !== undefined && pins === undefined) || (value["plugins"] !== undefined && plugins === undefined) || (value["seen"] !== undefined && seen === undefined)) return undefined;
  return Object.freeze({ vendors, models, ...(pins === undefined ? {} : { pins }), ...(plugins === undefined ? {} : { plugins }), ...(seen === undefined ? {} : { seen }) });
}

/**
 * A model the person chose, as sent and as it waits in the account's list until the box ends it. One at most: a later pick replaces it.
 * A pick of a series names the series and the provider it is reached through, and a version only where the person pinned one: the box
 * takes the series' newest version that provider serves when it applies the pick (`seriesMember` in `model-series.ts`). A pick of no
 * series — the Default row, a model offered by no series — names the model. Its end, a refusal included, is said once on an answer, and
 * the row keeps the last among its ends for the list (`kept-clicks.ts`).
 */
export type PendingPick = { readonly provider: string; readonly modelId?: string; readonly series?: string };

/** A pick as sent, or as it waits in the account's list, or nothing when it breaks the shape: it names a model, a series, or both. */
export function readPendingPick(value: unknown): PendingPick | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (!Object.keys(record).every((key) => key === "provider" || key === "modelId" || key === "series")) return undefined;
  const { provider, modelId, series } = record;
  if (typeof provider !== "string" || !VENDOR.test(provider)) return undefined;
  if (modelId !== undefined && (typeof modelId !== "string" || !MODEL.test(modelId))) return undefined;
  if (series !== undefined && (typeof series !== "string" || !MODEL.test(series))) return undefined;
  if (modelId === undefined && series === undefined) return undefined;
  return Object.freeze({ provider, ...(modelId === undefined ? {} : { modelId }), ...(series === undefined ? {} : { series }) });
}

/**
 * The platform's word, on the answer to a command that ran the model, of what became of the pick that waited, handed to the box first: `taken`, or
 * the refusal's code. It is on that answer whatever the answer is, an error one included.
 */
export const PICK_HEADER = "x-cmx-pick";
export type PickOutcome = "taken" | "model_not_allowed" | "model_refused";
export const readPickOutcome = (value: string | null): PickOutcome | undefined =>
  value === "taken" || value === "model_not_allowed" || value === "model_refused" ? value : undefined;
/**
 * How long the platform waits on one call to the gate for a pick, how long a pick's own reply waits for its hand — which goes on behind
 * the tenant's turn after the reply, so this bounds the reply and not the hand — and how long a message waits on the page's picks.
 */
export const PICK_BOUND_MS = 10_000;
/**
 * The pi commands that run the model, before which the account's waiting list is handed to the box; no other command reads it. `new_session` starts the next
 * conversation on the pick.
 */
export const RUNS_MODEL: ReadonlySet<string> = new Set(["prompt", "steer", "follow_up", "compact", "new_session"]);
