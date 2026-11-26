import { CARDS, cardWord, makerOf, PROVIDERS, SERIES } from "./model-makers.js";

/**
 * A maker's chat series, which a person ticks in place of a version: OpenRouter's `~<card>/<series>-latest` aliases where it names them,
 * else one series per model name with its version taken off ("Claude Opus 5.5" is a Claude Opus), so a lone model is its own series. pi
 * names no series, so this is the one rule; its versions are the models the person can reach, newest first.
 */
export type Grouped<M> = { readonly id: string; readonly name: string; readonly versions: readonly M[] };

/** A model's name with its maker's `Maker: ` taken off, as OpenRouter writes it. */
export const plainName = (name: string): string => { const colon = name.indexOf(": "); return colon > 0 ? name.slice(colon + 2) : name; };

type Read = { readonly words: string; readonly version: readonly number[]; readonly date: readonly number[]; readonly sized: boolean };

/**
 * A name's series words and its version: numbers in the words, a date's apart, a size ("27B", "A10B") in neither, nor a context's
 * ("256K"), which makes the name a variant of its version rather than a later one.
 */
function read(name: string): Read {
  const version: number[] = [];
  const date: number[] = [];
  let sized = false;
  const numbers = (part: string): void => {
    if (/^\d+(\.\d+)?[BbTt]$/.test(part) || /^[A-Za-z]\d+[BbTt]$/.test(part)) return;
    if (/^\d+[KkMm]$/.test(part)) { sized = true; return; }
    // A version's later places read as decimals, as makers write them: 4.20 comes before 4.3.
    for (const run of part.match(/\d+(\.\d+)*/g) ?? []) {
      const [whole, ...rest] = run.split(".");
      if (whole!.length >= 4 && rest.length === 0) date.push(Number(whole));
      else version.push(Number(whole), ...rest.map((digits) => Number(`0.${digits}`)));
    }
  };
  for (const inside of name.match(/\(([^)]*)\)/g) ?? []) for (const group of inside.match(/\d+/g) ?? []) date.push(Number(group));
  const words = plainName(name).replace(/\([^)]*\)/g, " ").split(/\s+/).filter((word) => word !== "").map((word, at) => /^(\d{4}-)?\d{2}-\d{2}$/.test(word)
    ? (date.push(...word.split("-").map(Number)), "")
    : word.split("-").flatMap((part, n): string[] => {
    if (/^(preview|exp|latest)$/i.test(part)) return [];
    if (/^\d/.test(part)) { numbers(part); return []; }
    // A letter and its number name a version ("K2", "V4"), except where the name begins with one, whose letter is the series ("o3 Mini").
    if (/^[A-Za-z]\d/.test(part)) { numbers(part); return at === 0 && n === 0 ? [part[0]!] : []; }
    if (/\d/.test(part)) { numbers(part); const letters = /^[A-Za-z]{2,}/.exec(part); return letters === null ? [] : [letters[0]]; }
    return [part];
  }).join("-")).filter((word) => word !== "");
  return { words: words.join(" "), version, date, sized };
}

/** The series a model name is a version of, as its words read: the name itself where nothing but its version is left. */
export const seriesName = (name: string): string => read(name).words || plainName(name).replace(/\s*\([^)]*\)/g, "").trim();
const slug = (words: string): string => words.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const compare = (a: readonly number[], b: readonly number[]): number => {
  for (let at = 0; at < Math.max(a.length, b.length); at++) if ((a[at] ?? -1) !== (b[at] ?? -1)) return (a[at] ?? -1) - (b[at] ?? -1);
  return 0;
};
/** Newer first: the higher version, then the later date, then the version itself before its context's variant; a tie keeps the order the models were listed in. */
export const newerFirst = (a: string, b: string): number => { const [x, y] = [read(a), read(b)]; return compare(y.version, x.version) || compare(y.date, x.date) || Number(x.sized) - Number(y.sized); };

/**
 * A series' name as its newest model gives it, unless taking the version out leaves a name that begins with a plan its card's subscription
 * is sold as (`plans`, its maker's package's) and the model's own name does not ("Kimi K2.7 Code" is no "Kimi Code"): then the model's
 * own name, so a series is never read as the subscription.
 */
function shownSeries(plans: readonly string[], newest: string): string {
  const name = seriesName(newest);
  const starts = (words: string, plan: string): boolean => words.toLowerCase() === plan.toLowerCase() || words.toLowerCase().startsWith(`${plan.toLowerCase()} `);
  return plans.some((plan) => starts(name, plan) && !starts(plainName(newest), plan)) ? plainName(newest).replace(/\s*\([^)]*\)/g, "").trim() : name;
}

/** The names pi gives a model by its id alone, as its maker names it, by provider and id. */
const NAMED: Readonly<Record<string, string>> = Object.freeze({ "kimi-coding/kimi-for-coding": "Kimi For Coding" });
/** A model's name as its maker names it, where pi names it by its id. */
export const modelName = (model: { readonly provider: string; readonly id: string; readonly name: string }): string => NAMED[`${model.provider}/${model.id}`] ?? model.name;

/**
 * A card's models grouped into its series, each by its id — the card's `~` alias whose name reads as the series, else `<card>:<series>` —
 * with its versions newest first. The aliases' series come first, in OpenRouter's order, then the rest by name. `plans`, the card's
 * subscription's, bear on the names alone (`shownSeries`), never on an id.
 */
export function seriesOf<M extends { readonly name: string }>(card: string, models: readonly M[], plans: readonly string[] = []): readonly Grouped<M>[] {
  const groups = new Map<string, { name: string; versions: M[] }>();
  for (const model of models) {
    const name = seriesName(model.name);
    const group = groups.get(slug(name)) ?? groups.set(slug(name), { name, versions: [] }).get(slug(name))!;
    group.versions.push(model);
  }
  // An alias whose own name carries a version ("DeepSeek V4 Flash") gives way to one that names the series alone.
  const aliases = [...SERIES[card] ?? []].sort((a, b) => Number(seriesName(a.name) !== a.name) - Number(seriesName(b.name) !== b.name));
  const aliased = new Map<string, string>();
  for (const alias of aliases) if (!aliased.has(slug(seriesName(alias.name)))) aliased.set(slug(seriesName(alias.name)), alias.id);
  const order = (SERIES[card] ?? []).map((alias) => alias.id);
  return Object.freeze([...groups].map(([key, group]): Grouped<M> => Object.freeze({
    id: aliased.get(key) ?? `${card}:${key}`,
    name: group.versions.length === 0 ? group.name : shownSeries(plans, [...group.versions].sort((a, b) => newerFirst(a.name, b.name))[0]!.name),
    versions: Object.freeze([...group.versions].sort((a, b) => newerFirst(a.name, b.name))),
  })).sort((a, b) => {
    const [x, y] = [order.indexOf(a.id), order.indexOf(b.id)];
    return x >= 0 || y >= 0 ? (x < 0 ? 1 : y < 0 ? -1 : x - y) : a.name.localeCompare(b.name);
  }));
}

/** A version a chat can wait for: OpenRouter's `(batch)` variants answer none, so no list holds one; its `(free)` ones are versions like any other. */
export const answersChat = (model: { readonly name: string }): boolean => !/\(batch\)\s*$/i.test(model.name);

/** Whether a card is a host's, such as OpenRouter's, whose models are many makers'. */
export const isHostCard = (card: string): boolean => CARDS[card]?.providers.some((provider) => PROVIDERS[provider]?.host === true && PROVIDERS[provider]?.card === card) === true;

/** Who makes a series: the maker card's id and name. */
export type Maker = { readonly id: string; readonly name: string };
export type CardSeries<M> = Grouped<M> & { readonly maker?: Maker };

/**
 * The maker of a model a host lists: the card its id's `vendor/` word names, else the word as the model's `Maker: ` spells it; a model
 * with no word, or the host's own word, is the host's, as OpenRouter's routers are.
 */
export function hostedMaker(host: string, model: { readonly id: string; readonly name: string }): Maker {
  const plain = model.id.replace(/^~/, "");
  const slash = plain.indexOf("/");
  const card = slash > 0 ? cardWord(plain.slice(0, slash)) : host;
  // A host is a card of its own, so its own routes are named by it too.
  const known = CARDS[card];
  if (known !== undefined) return { id: card, name: known.name };
  const colon = model.name.indexOf(": ");
  return { id: card, name: colon > 0 ? model.name.slice(0, colon) : card };
}

/**
 * A card's series as chat lists them, with every `(batch)` variant left out before they are grouped. On a host's card each series also
 * names its maker, and a host's `~…-latest` route is its series' Always the latest, not a version of its own, where the series has any
 * other. Its ids are the host's, as `seriesOf` gives them, so a record ticked before makers were named keeps its ticks.
 */
export function cardSeries<M extends { readonly id: string; readonly name: string }>(card: string, models: readonly M[], plans: readonly string[] = []): readonly CardSeries<M>[] {
  const listed = models.filter(answersChat);
  if (!isHostCard(card)) return seriesOf(card, listed, plans);
  return Object.freeze(seriesOf(card, listed, plans).map((one): CardSeries<M> => {
    const own = one.versions.filter((version) => !version.id.startsWith("~"));
    const versions = own.length > 0 ? Object.freeze(own) : one.versions;
    return Object.freeze({ ...one, versions, maker: Object.freeze(hostedMaker(card, versions[0]!)) });
  }));
}

/**
 * The model a pick of a series is applied as, among the models one provider serves: the version the person pinned while that provider
 * serves it, else the series' newest version there. Nothing where the provider serves no version of the series, where the pick names
 * none, or where the pin is a model the provider serves outside the series: a pin is honoured only as a version of the series it names.
 */
export function seriesMember(models: readonly { readonly provider: string; readonly id: string; readonly name: string }[], pick: { readonly provider: string; readonly series?: string | undefined; readonly modelId?: string | undefined }): string | undefined {
  const served = models.filter((model) => model.provider === pick.provider);
  const pinned = pick.modelId !== undefined && served.some((model) => model.id === pick.modelId);
  if (pick.series === undefined) return pinned ? pick.modelId : undefined;
  const byCard = new Map<string, (typeof served)[number][]>();
  for (const model of served) { const card = makerOf(model.provider, model.id); if (card !== undefined) (byCard.get(card) ?? byCard.set(card, []).get(card)!).push(model); }
  for (const [card, members] of byCard) {
    const found = cardSeries(card, members).find((one) => one.id === pick.series);
    if (found === undefined) continue;
    if (!pinned) return found.versions[0]?.id;
    return found.versions.some((version) => version.id === pick.modelId) ? pick.modelId : undefined;
  }
  return undefined;
}
