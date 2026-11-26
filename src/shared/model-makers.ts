import makers from "./model-makers.json" with { type: "json" };

/**
 * The model makers and providers the pinned pi registers, as `model-makers-generate.ts` writes them from pi's registry: the one place the
 * proxy, the platform and the page read which providers exist, which the proxy carries, and which card a model is on.
 */
export type ProviderRow = {
  readonly name: string; readonly baseUrl?: string; readonly modelBases?: readonly string[]; readonly carried: boolean; readonly card?: string; readonly host?: true; readonly key: boolean;
  readonly signIn?: { readonly name: string; readonly subscription: boolean };
  /** The API pi speaks to a provider whose base is the tenant's, and that it is: the relay's. */
  readonly api?: string; readonly tenantBase?: true;
};
export type CardRow = { readonly name: string; readonly providers: readonly string[]; readonly hosts: readonly string[] };

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) { for (const one of Object.values(value)) deepFreeze(one); Object.freeze(value); }
  return value;
};
const MAKERS = deepFreeze(makers as unknown as {
  readonly providers: Readonly<Record<string, ProviderRow>>;
  readonly cards: Readonly<Record<string, CardRow>>;
  readonly aliases: Readonly<Record<string, string>>;
  readonly series: Readonly<Record<string, readonly { readonly id: string; readonly name: string }[]>>;
});

export const PROVIDERS: Readonly<Record<string, ProviderRow>> = MAKERS.providers;
export const CARDS: Readonly<Record<string, CardRow>> = MAKERS.cards;
/** A card's series OpenRouter names with a `~…-latest` alias, by the alias and the series' name. */
export const SERIES: Readonly<Record<string, readonly { readonly id: string; readonly name: string }[]>> = MAKERS.series;
/** Every card, by id, in the registry's order. */
export const CARD_IDS: readonly string[] = Object.freeze(Object.keys(CARDS));
/** The providers the proxy carries on a key or a sign-in: every one pi registers but those `LEFT_OUT` names. */
export const CARRIED: readonly string[] = Object.freeze(Object.keys(PROVIDERS).filter((id) => PROVIDERS[id]!.carried));
export const isCarried = (provider: string): boolean => Object.hasOwn(PROVIDERS, provider) && PROVIDERS[provider]!.carried;
/** Whether a carried provider's base is the tenant's, held by the gate beside the key, and no fixed one: the relay's. */
export const isTenantBase = (provider: string): boolean => Object.hasOwn(PROVIDERS, provider) && PROVIDERS[provider]!.tenantBase === true;

/** A spelling of a maker — a host's `vendor/` word, a pi provider's id, a card stored under an old name — as its card's id. */
export const cardWord = (spelling: string): string => { const word = spelling.toLowerCase(); return MAKERS.aliases[word] ?? word; };

/** Whether the balance reaches a card: the platform pays through its one OpenRouter key, so where OpenRouter serves one of the maker's models. */
export const balanceReaches = (card: string): boolean => CARDS[card]?.hosts.includes("openrouter") === true;

/**
 * The card a model is on: its provider's card — its maker's own, or a carried host's, which offers every model the host serves; else, for
 * the balance, the card the `vendor/` word its id begins with names, where the balance reaches it. Nothing where no card is its maker's,
 * or the model is a host's the proxy does not carry.
 */
export function makerOf(provider: string, id: string): string | undefined {
  const own = PROVIDERS[provider]?.card;
  if (own !== undefined) return own;
  if (Object.hasOwn(PROVIDERS, provider)) return undefined;
  const plain = id.replace(/^~/, "");
  const slash = plain.indexOf("/");
  const card = slash > 0 ? cardWord(plain.slice(0, slash)) : undefined;
  return card !== undefined && balanceReaches(card) ? card : undefined;
}

/**
 * The providers a person's own credential reaches a card through, those the proxy carries: the maker's own, or the host the card is. A
 * host's key serves many makers and is on no maker's card.
 */
export const cardProviders = (card: string): readonly string[] => CARDS[card]?.providers.filter(isCarried) ?? [];
