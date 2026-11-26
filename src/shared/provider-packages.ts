import cardFile from "./maker-cards.json" with { type: "json" };
import { NPM_SCOPE } from "./package-names.js";
import { balanceReaches, CARDS, makerOf, PROVIDERS } from "./model-makers.js";

/**
 * Providers the proxy carries that have no package of their own, and why: their models stay in the image's `models.json`. The providers
 * repository's `scripts/vendors.mjs` names the same.
 */
export const NO_PACKAGE: Readonly<Record<string, string>> = Object.freeze({
  radius: "its models are the organisation's, from the gateway per sign-in, which a package cannot write: it stays in the image",
  relay: "its upstream and its models are the seller's, read from the relay when it is saved, which a package cannot write: it stays in the image",
});

/**
 * Model plugins that are no maker's card, by the provider whose package brings each, written by hand in the providers repository: Jev,
 * TypeSafe's classifier, which the proxy serves on its own route and a package that needs a model names (`cx-topics`). Its package is
 * listed while its card is installed, the balance paying where no key of the seller's is saved, and the proxy putting that key in first.
 */
export const PLUGIN_PROVIDERS: Readonly<Record<string, string>> = Object.freeze({ typesafe: "jev" });

/**
 * The package that brings a provider into cx's computer, as an account's list names it: `npm:@comchatx/<provider id>`, with no version.
 * None for a provider pi does not register, one the proxy cannot carry (`LEFT_OUT`) but those `PLUGIN_PROVIDERS` names, or one
 * `NO_PACKAGE` names.
 */
export function providerPackage(provider: string): string | undefined {
  if (!Object.hasOwn(PROVIDERS, provider) || Object.hasOwn(NO_PACKAGE, provider)) return undefined;
  if (!PROVIDERS[provider]!.carried && !Object.hasOwn(PLUGIN_PROVIDERS, provider)) return undefined;
  return `npm:${NPM_SCOPE}/${provider}`;
}

/** The provider a listed package brings, where it is one `providerPackage` names; a version after the name is read past. */
export function packageProvider(source: string): string | undefined {
  const match = /^npm:@comchatx\/([a-z0-9][a-z0-9-]*)(?:@[^/]*)?$/.exec(source);
  const provider = match?.[1];
  return provider !== undefined && providerPackage(provider) === `npm:${NPM_SCOPE}/${provider}` ? provider : undefined;
}

/**
 * The cards no provider's package serves, each with a package of its own, `@comchatx/card-<id>`, published from the providers repository: a
 * manifest carrying the card's words and mark, and no extension, installed on no computer. The Plugins page reads it on npm as it reads a
 * maker's. A card the registry gains with no provider's package fails `provider-packages.test.ts` until it is named here and its package
 * is published.
 */
export const CARD_PACKAGES: readonly string[] = Object.freeze([...(cardFile as { readonly packaged: readonly string[] }).packaged]);

/** A card's own package, `@comchatx/card-<id>`, for a card `CARD_PACKAGES` names; none for any other. */
export const cardPackage = (card: string): string | undefined => (CARD_PACKAGES.includes(card) ? `${NPM_SCOPE}/card-${card}` : undefined);

/**
 * Whether a package of ours, by its npm name, is a provider's: `@comchatx/<id>` for a provider pi registers, carried or not, as the
 * providers repository publishes one for each. Such a package is a maker's way into cx's computer and is drawn on no record of its own:
 * its maker's card stands for it. So is a card's own package, `@comchatx/card-<id>`, by its name alone: its card stands for it, and
 * one whose card the registry does not name yet is drawn nowhere until it does.
 */
export function isProviderPackage(name: string): boolean {
  const match = /^@comchatx\/([a-z0-9][a-z0-9-]*)$/.exec(name);
  return match !== null && (Object.hasOwn(PROVIDERS, match[1]!) || match[1]!.startsWith("card-"));
}

/** What decides an account's makers' packages: the model plugins installed, by card id, and the providers holding a key or a sign-in. */
export type PackageHolding = { readonly cards: ReadonlySet<string>; readonly keys: ReadonlySet<string>; readonly signedIn: ReadonlySet<string> };

/**
 * The makers' packages an account's list holds: a provider's, exactly while its card is installed and it holds a key or a sign-in; and
 * a `PLUGIN_PROVIDERS` package exactly while its card is installed, key or none. The card choices stay the card's install, and the
 * package follows them.
 */
export function heldPackages(holding: PackageHolding): ReadonlySet<string> {
  const providers = new Set([...holding.keys, ...holding.signedIn].filter((provider) => !Object.hasOwn(PLUGIN_PROVIDERS, provider)));
  const makers = [...providers].flatMap((provider) => {
    const source = providerPackage(provider);
    const card = PROVIDERS[provider]?.card;
    return source !== undefined && card !== undefined && holding.cards.has(card) ? [source] : [];
  });
  const plugins = Object.entries(PLUGIN_PROVIDERS).flatMap(([provider, card]) => (holding.cards.has(card) ? [providerPackage(provider)!] : []));
  return new Set([...makers, ...plugins]);
}

/** What a run reads of the account's list: the packages the box listed when it was asked, and what waits in the row, in its order. */
export type ListedRow = {
  readonly packages: readonly unknown[];
  readonly waiting: readonly { readonly op: string; readonly source?: string }[];
};

/** The maker's package a source names, without a version, or none for a source that is not one. */
const makerSource = (source: unknown): string | undefined => {
  const provider = typeof source === "string" ? packageProvider(source) : undefined;
  return provider === undefined ? undefined : providerPackage(provider);
};

/** The makers' packages a list the box spoke holds as the seller's: the box's own word, and nothing of the row. */
export function spokenMakers(packages: readonly unknown[]): ReadonlySet<string> {
  const held = new Set<string>();
  for (const one of packages) {
    const listed = typeof one === "object" && one !== null && (one as Record<string, unknown>)["origin"] === "seller" ? makerSource((one as Record<string, unknown>)["source"]) : undefined;
    if (listed !== undefined) held.add(listed);
  }
  return held;
}

/**
 * The makers' packages an account's list holds or will hold: those the box listed as the seller's when it was asked, then changed by
 * each entry still waiting, in order. Nothing the row kept of how an entry ended is read: the box's list is the one truth of what it holds.
 */
export function listedMakers(row: ListedRow): ReadonlySet<string> {
  const held = new Set(spokenMakers(row.packages));
  for (const move of row.waiting) {
    const source = makerSource(move.source);
    if (source === undefined || (move.op !== "install" && move.op !== "remove")) continue;
    if (move.op === "install") held.add(source);
    else held.delete(source);
  }
  return held;
}

/** The entries that bring a list from the makers' packages it holds to those it should: an install for each missing, a removal for each extra. */
export function packageDiff(desired: ReadonlySet<string>, listed: ReadonlySet<string>): { readonly install: readonly string[]; readonly remove: readonly string[] } {
  return {
    install: [...desired].filter((source) => !listed.has(source)).sort(),
    remove: [...listed].filter((source) => !desired.has(source)).sort(),
  };
}

/** The providers a card's own keys and sign-ins are held at: a maker's own, or the one `PLUGIN_PROVIDERS` names for a plugin card. */
export const keyProvidersOf = (card: string): readonly string[] =>
  CARDS[card]?.providers ?? Object.entries(PLUGIN_PROVIDERS).flatMap(([provider, one]) => (one === card ? [provider] : []));

/** Whether the platform pays for a card's models: where the balance reaches a maker, and always for a plugin card, its route on the platform's key. */
export const platformPaysFor = (card: string): boolean => balanceReaches(card) || Object.values(PLUGIN_PROVIDERS).includes(card);

/**
 * The card whose ways decide whether the balance pays a call on the platform's key: a `PLUGIN_PROVIDERS` provider's card, whatever the
 * model; otherwise the maker's card the balance model's id names. None where the platform's key would pay for a model no card governs.
 */
export const paidCard = (provider: string | undefined, model: string): string | undefined =>
  provider !== undefined && Object.hasOwn(PLUGIN_PROVIDERS, provider) ? PLUGIN_PROVIDERS[provider] : makerOf("balance", model);
