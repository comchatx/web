import fallback from "./maker-cards.json" with { type: "json" };
import { CARD_IDS } from "./model-makers.js";
import { cardPackage, keyProvidersOf, PLUGIN_PROVIDERS } from "./provider-packages.js";
import { readBoardLabel, type BoardLabel } from "./board.js";

/**
 * What the registry does not say of a card, as its maker's package says it in its `comchatx` field: the name the card goes by where
 * that is its models' and not the maker's, the maker's name (and the Chinese of it where its own site gives one), the name its API key
 * goes by where that is not its vendor's, the card's Overview, its mark, the words a seller in China may search it by (searched, never
 * printed), the plans its subscription is sold as where those are not the maker's name, and the steps its sign-in card draws. Every
 * part optional: a card with none is drawn from the registry alone.
 */
export type MakerCard = {
  readonly name?: string; readonly vendor?: string; readonly vendorZh?: string; readonly keyName?: string;
  readonly description?: { readonly en: string; readonly zh: string };
};
/**
 * A step of a sign-in card as a package declares it: which of the card's parts it draws, and the sentence over that part. `link` is the
 * press to the vendor's page; `address` the picture of the address bar the browser stops on, drawn from the address the flow gives;
 * `show` a code the flow gives to carry to the vendor, with Copy; `field` the box the flow waits on, its placeholder and checks the flow's.
 */
export type SignInStepKind = "link" | "address" | "show" | "field";
export type DeclaredStep = { readonly kind: SignInStepKind; readonly words?: { readonly en: string; readonly zh: string } };
export type MakerWords = {
  readonly card?: MakerCard; readonly mark?: { readonly logo: string }; readonly aliases?: readonly string[]; readonly plans?: readonly string[];
  readonly signIn?: { readonly steps: readonly DeclaredStep[] };
};
/** Each card's words by its id. */
export type CardWords = Readonly<Record<string, MakerWords>>;

type Field = Readonly<Record<string, unknown>>;
const fieldOf = (value: unknown): Field | undefined => (typeof value === "object" && value !== null && !Array.isArray(value) ? value as Field : undefined);
const word = (value: unknown): string | undefined => (typeof value === "string" && value.trim() !== "" ? value : undefined);
const wordList = (value: unknown): readonly string[] | undefined => {
  const read = Array.isArray(value) ? value.map(word) : undefined;
  return read === undefined || read.length === 0 || read.some((one) => one === undefined) ? undefined : Object.freeze(read as string[]);
};

const KINDS: readonly string[] = ["link", "address", "show", "field"];
/** A declaration's steps, in order; none where any step does not read, so a card is drawn whole from its package or not from it. */
const stepsOf = (value: unknown): readonly DeclaredStep[] | undefined => {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const read = value.map((one): DeclaredStep | undefined => {
    const step = fieldOf(one);
    const kind = step?.["kind"];
    if (typeof kind !== "string" || !KINDS.includes(kind)) return undefined;
    if (step?.["words"] === undefined) return Object.freeze({ kind: kind as SignInStepKind });
    const words = fieldOf(step["words"]);
    const [en, zh] = [word(words?.["en"]), word(words?.["zh"])];
    return en === undefined || zh === undefined ? undefined : Object.freeze({ kind: kind as SignInStepKind, words: Object.freeze({ en, zh }) });
  });
  return read.some((one) => one === undefined) ? undefined : Object.freeze(read as DeclaredStep[]);
};

/** A field's card words, each part only as it reads; none where no part does. */
export function readMakerWords(value: unknown): MakerWords | undefined {
  const field = fieldOf(value);
  if (field === undefined) return undefined;
  const given = fieldOf(field["card"]);
  const about = fieldOf(given?.["description"]);
  const [en, zh] = [word(about?.["en"]), word(about?.["zh"])];
  const card = Object.fromEntries((["name", "vendor", "vendorZh", "keyName"] as const).flatMap((key) => { const one = word(given?.[key]); return one === undefined ? [] : [[key, one]]; }));
  const named: MakerCard = { ...card, ...(en === undefined || zh === undefined ? {} : { description: Object.freeze({ en, zh }) }) };
  const logo = word(fieldOf(field["mark"])?.["logo"]);
  const aliases = wordList(field["aliases"]);
  const plans = wordList(field["plans"]);
  const steps = stepsOf(fieldOf(field["signIn"])?.["steps"]);
  const read: MakerWords = {
    ...(Object.keys(named).length === 0 ? {} : { card: Object.freeze(named) }), ...(logo === undefined ? {} : { mark: Object.freeze({ logo }) }),
    ...(aliases === undefined ? {} : { aliases }), ...(plans === undefined ? {} : { plans }),
    ...(steps === undefined ? {} : { signIn: Object.freeze({ steps }) }),
  };
  return Object.keys(read).length === 0 ? undefined : Object.freeze(read);
}

const FILE = fallback as unknown as { readonly ranked: readonly string[] };

/**
 * The makers' order, as OpenRouter ranks its models' authors by their share of its requests (https://openrouter.ai/rankings, "Market
 * share", the week beginning 2026-10-26, read 2026-11-03), as pi.dev orders packages by the number their supplier gives. The page names
 * nine and groups the rest as others; every other card follows by id. Read by hand into `maker-cards.json`: nothing is fetched at run time.
 */
export const RANKED: readonly string[] = Object.freeze([...FILE.ranked]);

/**
 * Each card's words, every maker's and every plugin card's (`PLUGIN_PROVIDERS`): those the `comchatx` field of the first of its providers'
 * packages, in the registry's order, carries, as `packages` gives them; for a card no provider's package serves, its own package's
 * (`cardPackage`). A card whose package `packages` does not give is drawn from the registry alone.
 */
export function cardWords(packages: readonly { readonly name: string; readonly comchatx?: Readonly<Record<string, unknown>> | undefined }[]): CardWords {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg.comchatx] as const));
  const cards = [...CARD_IDS, ...Object.values(PLUGIN_PROVIDERS)];
  return Object.freeze(Object.fromEntries(cards.flatMap((card) => {
    const carried = keyProvidersOf(card).map((provider) => readMakerWords(byName.get(`@comchatx/${provider}`))).find((one) => one !== undefined);
    const own = cardPackage(card);
    const read = carried ?? (own === undefined ? undefined : readMakerWords(byName.get(own)));
    return read === undefined ? [] : [[card, read]];
  })));
}

/**
 * A notice's heading in each language by the `customType` pi records it under, as a package's `comchatx.notices` gives it,
 * `{ "<customType>": { zh, en } }`, each read by `readBoardLabel`'s bounds: a heading that does not read is none, and a type two
 * packages head is the first's by name.
 */
export type NoticeHeadings = ReadonlyMap<string, BoardLabel>;
export function noticeHeadings(packages: readonly { readonly name: string; readonly comchatx?: Readonly<Record<string, unknown>> | undefined }[]): NoticeHeadings {
  const found = new Map<string, BoardLabel>();
  for (const pkg of [...packages].sort((one, other) => (one.name < other.name ? -1 : one.name > other.name ? 1 : 0))) {
    for (const [type, value] of Object.entries(fieldOf(pkg.comchatx?.["notices"]) ?? {})) {
      const heading = readBoardLabel(value);
      if (heading !== undefined && !found.has(type)) found.set(type, heading);
    }
  }
  return found;
}
