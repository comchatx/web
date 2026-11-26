import type { NpmKind, NpmPackage, Words } from "./backend.js";
import { balanceReaches, CARD_IDS, CARDS, isTenantBase, PROVIDERS } from "../shared/model-makers.js";
import { cardWords, RANKED, type CardWords, type DeclaredStep } from "../shared/maker-words.js";
import { cardPackage, packageProvider, PLUGIN_PROVIDERS, providerPackage } from "../shared/provider-packages.js";
import { makesKey, runsSignIn, subscribes } from "../shared/sign-in.js";
import { LANGUAGES, text, type Language, type StringKey } from "./strings.js";
import { WAYS, type Way } from "../shared/card-choices.js";
import type { Door } from "../shared/way-moves.js";
import { isOurs } from "../shared/package-names.js";
import { OFFICIAL_BUNDLES, type OfficialBundle } from "../shared/bundles.js";
import { readDrawnMark, type DrawnMark } from "../shared/drawn-mark.js";
import { buildsOf, fieldBuilds, idsOf, onNoRecord, ourId } from "../shared/plugin-builds.js";

export { ourId } from "../shared/plugin-builds.js";
import { cdnBase, type ShippedPart } from "../shared/shipped.js";

/**
 * The Plugins page's catalogue: one record per plugin offered, and the bundles that list them. A record says what nothing else says —
 * its name and words, its Discover section, its parts, and what it builds on and why. What a package manifest, the gate's sources or the
 * box's model catalogue states is read from there, never copied here: a source's price and freshness, a package's version, a vendor's
 * models. A package of ours keeps no record here: npm's organization `comchatx` holds ours, and each says what it is in what it ships —
 * its READMEs, its skills' and prompt templates' own words, its dependencies — and in its `comchatx` field, the shelf it stands on and
 * the Chinese of its one-line words (`ourRecord`). A record is never keyed to a kind of plugin: a plugin is the parts it has.
 */
export type Need = "required" | "optional";
/** What a plugin builds on: another record, whether it cannot work without it, and one sentence why where the record has one. "Used by" is derived. */
export type Builds = { readonly on: string; readonly need: Need; readonly why?: Words };
/** A skill as the page shows it: its `SKILL.md`'s name and description, the one pi decides by, and the Chinese of it where the package gives one. */
export type Skill = { readonly name: string; readonly about: Words };
/** A source's field as its Settings ask for it: the label, and the line under it where there is one. */
export type FieldWords = { readonly label: Words; readonly help?: Words };
/**
 * A paired source's own lines on its Settings, which only its package knows: the first form's heading and the line under it, the list's
 * heading, the press that adds a connection under a pair, the connect's wait, its alert when the token reaches nothing, the line after
 * one connects, the card's line on what a pair's removal takes (`{names}`), a connection's lines on the supplier's last check: refused,
 * none listed, and the regions that did not answer (`{regions}`), and the places a region's line names (`{places}`). The page fills each
 * placeholder and adds no word of its own.
 */
export const SOURCE_LINES = ["connect", "canChange", "rows", "add", "checking", "foundNone", "connected", "removedWith", "refused", "none", "silent", "sells"] as const;
export type SourceLine = (typeof SOURCE_LINES)[number];
/** The placeholder each line holds, in both languages, and the only one it holds. */
const LINE_HOLDS: Readonly<Record<SourceLine, string | undefined>> = {
  connect: undefined, canChange: undefined, rows: undefined, add: undefined, checking: undefined, foundNone: undefined, connected: undefined,
  removedWith: "names", refused: undefined, none: undefined, silent: "regions", sells: "places",
};
/**
 * A prompt template the package ships, one Try it card: run as `/<name>`, its words its description and the Chinese of it where the
 * package gives one. `hint` is its `argument-hint`: a template that asks for words after its name is put in the composer, not sent.
 */
export type Prompt = { readonly name: string; readonly about: Words; readonly hint?: string };
/**
 * A package's README as its files at a version hold it: `en` is `README.md`, `zh` its Chinese, each absent where the package ships
 * none; `base` is where its files are served, which its relative links and pictures resolve against.
 */
export type Readme = { readonly en?: string; readonly zh?: string; readonly base?: string };
/** How a model's vendor is reached: the person's balance, their own API key, or their own subscription there. */
export { WAYS, type Way };
export type Section = "data" | "extensions" | "models";
export const SECTIONS: readonly Section[] = ["data", "extensions", "models"];
/** A vendor's logo or a line icon by name, drawn by the page's marks, or a drawing of the package's own; a record without one shows its initial. */
export type Mark = { readonly logo: string } | { readonly line: string } | DrawnMark;

/**
 * What npm says of the package a card stands for, as its card draws it: the name npm knows it by, last month's downloads where npm
 * counted them, when its version was published, where its code is, and pi's kinds of what it ships.
 */
export type OnNpm = { readonly name: string; readonly downloads?: number; readonly published?: string; readonly repository?: string; readonly homepage?: string; readonly kinds: readonly NpmKind[] };

export type Plugin = {
  readonly id: string;
  readonly name: string;
  /** Its name on the Chinese page, where it has one; `name` is the English, and the name on a page with none. */
  readonly nameZh?: string;
  readonly author: string;
  readonly mark?: Mark;
  readonly section: Section;
  /** The card's one line. */
  readonly about: Words;
  /**
   * The record's Overview where it is no package: one markdown text, drawn as a package's README is (ruled 2026-11-06). A package's
   * Overview is its README.
   */
  readonly description?: Words;
  readonly builds: readonly Builds[];
  /**
   * A pi package: the name pi lists it under, the skills it adds and the prompt templates it ships. `source` is the list's own word for
   * it on a record made of a listed package, which is how that record finds its package: two listed packages can state one name. On a
   * record of a package the image does not carry it is what a click installs and the list then states: `npm:<name>`, with no version,
   * is the registry's current. `readme` is the package's own, its Overview; `unread` names a part of its files the platform could not
   * read, which the page says rather than drawing it empty.
   */
  readonly box?: { readonly package: string; readonly skills: readonly Skill[]; readonly prompts?: readonly Prompt[]; readonly source?: string; readonly readme?: Readme; readonly unread?: readonly ShippedPart[] };
  /**
   * A data source: the name the gate lists it under, and each kind of purchase in a seller's words. `baseWhy` is the sentence why it
   * needs what it builds on, for a link that gives none of its own. `ownKey` is the sentence its description ends on where the
   * person's own key is a way to pay for it, and is said nowhere else. `help` is the supplier's page on getting what the source's
   * Settings ask the person for. `fields` words each field the source's Settings ask for by the gate's name for it: its label, and the
   * line under it where it says more than the label.
   */
  readonly source?: { readonly name: string; readonly baseWhy?: Words; readonly ownKey?: Words; readonly help?: string; readonly aspects: Readonly<Record<string, Words>>; readonly fields?: Readonly<Record<string, FieldWords>>; readonly lines?: Readonly<Partial<Record<SourceLine, Words>>>; readonly regions?: Readonly<Record<string, Words>> };
  /**
   * A model maker: who makes the models, whether they answer in chat, and the ways the maker can be reached; `subscription` is the plans the
   * maker's subscription is sold as, where they are not the maker's name. `keys` and `accounts` are the providers, in the platform's own lists,
   * that are the maker's own and through which a person's own API key and sign-in reach it. A host's key, such as OpenRouter's, is on no
   * maker's card.
   */
  readonly model?: { readonly vendor: string; /** The maker's name as its own Chinese site gives it, where that is not `vendor`. */ readonly vendorZh?: string; readonly chat: boolean; readonly ways: readonly Way[]; readonly subscription?: readonly string[]; readonly keys: readonly string[]; readonly accounts: readonly string[]; /** The steps its package declares its sign-in card draws. */ readonly signIn?: readonly DeclaredStep[] };
  /** What the plugin changes on the page. */
  readonly page?: { readonly changes: readonly Words[]; readonly undo?: Words };
  /** The day the plugin was last updated, as an ISO date, where a record states one. */
  readonly updated?: string;
  /** The version a record states, said of a plugin nobody holds yet; what a held or offered package or source states of itself is read first. */
  readonly version?: string;
  /**
   * Where the package's own words are, for a record ComChatX did not make: the record's words are the office's and can lag the
   * package's. What the list states of a held package is read first.
   */
  readonly home?: string;
  /**
   * No record of the catalogue: made by the page from a package the person installed themselves, out of what the package states of
   * itself. ComChatX neither made nor checked it, and nothing offers it once it is removed.
   */
  readonly own?: true;
  /**
   * A package of pi's gallery, by the name npm knows it by: one the gallery lists, or one the person installed from npm. Its page is the
   * gallery's, drawn from what npm says of it.
   */
  readonly npm?: string;
  /** Published and not offered yet: Discover lists it nowhere; installed, it is drawn as any other. */
  readonly unreleased?: true;
  /** The package npm holds for it, ours or a model maker's: what its card's facts and links say. None for what is no package. */
  readonly onNpm?: OnNpm;
  /** A package of someone else's made for ComChatX, as its search entry's keyword `comchatx` says: listed among ComChatX's plugins. */
  readonly comchatx?: true;
  /** The Chinese of the line such a package's own field declares, as `declaredBy` read it: drawn on every page in place of npm's words. */
  readonly declaredZh?: string;
};

/** A bundle is only a list and its author, with the name and words its card and banner show. */
export type Bundle = {
  readonly id: string;
  readonly name: string;
  readonly nameZh?: string;
  readonly author: string;
  readonly mark?: Mark;
  /** The banner's drawing, by name, for a bundle that has one. */
  readonly art?: string;
  readonly about: Words;
  /** Its Overview: one markdown text, drawn as a package's README is. */
  readonly description?: Words;
  readonly members: readonly string[];
};

/**
 * The catalogue's plugins and bundles, and each card's words as its maker's package says them (`cardWords`), which every page that names a
 * maker reads. `oursRead` says where ours are not all here: `partial` while the platform's answer is not every one npm holds, `failed`
 * where ours could not be read at all; neither is a list to count.
 */
export type Catalogue = { readonly plugins: readonly Plugin[]; readonly bundles: readonly Bundle[]; readonly words: CardWords; readonly oursRead?: "partial" | "failed" };



/**
 * What the page offers beside ours: Jev, TypeSafe's classifier, named as its package's `comchatx` field names it, else by its provider's
 * registry name. The model makers are not written here but made from pi's registry (`makerRecords`).
 */
function jevRecord(words: CardWords): Plugin {
  const named = words["jev"]?.card;
  const mark = words["jev"]?.mark;
  const vendor = named?.vendor ?? PROVIDERS["typesafe"]?.name ?? "jev";
  return readPlugin({
    id: "jev", name: named?.name ?? vendor, author: "ComChatX", ...(mark === undefined ? {} : { mark }), section: "models",
    about: modelLine(vendor, named?.vendorZh),
    builds: [],
    model: { vendor, chat: false, ways: ["key", "platform"], keys: ["typesafe"], accounts: [] },
  }, "plugins[0]");
}

/** Who every official bundle is by, as the page names it. */
const OFFICIAL_AUTHOR = "ComChatX";


// The page's `Say`, named here apart: the platform reads this file, and the page's own carries the DOM in.
type Say = (key: StringKey, values: Readonly<Record<string, string>>) => string;
/** A subscription's plans as a sentence names them: one alone, more joined by "or" in the language `say` speaks. */
export const plansSaid = (plans: readonly string[], say: Say): string => plans.reduce((joined, plan) => say("pl.or", { a: joined, b: plan }));

/** The name a way's door is said under in the line a move draws: a sign-in by its subscription's plans, a key by its maker's or its host's. */
export function doorName(door: Door, say: Say, made: CardWords): string {
  const row = PROVIDERS[door.provider];
  const words = row?.card === undefined ? undefined : made[row.card]?.card;
  const plans = row?.card === undefined ? undefined : made[row.card]?.plans;
  if (door.way === "account") return (plans === undefined ? undefined : plansSaid(plans, say)) ?? words?.vendor ?? row?.name ?? door.provider;
  return (row?.host === true ? row.name : words?.vendor ?? row?.name) ?? door.provider;
}

/** A model plugin's maker as the page's language names it, else the plugin's own name. */
export const vendorIn = (plugin: { readonly name: string; readonly nameZh?: string | undefined; readonly model?: { readonly vendor: string; readonly vendorZh?: string } | undefined }, language: Language): string =>
  (language === "zh" ? plugin.model?.vendorZh : undefined) ?? plugin.model?.vendor ?? nameIn(plugin, language);

/** A plugin's or a bundle's name as the page's language names it: its Chinese name on the Chinese page where it has one, else `name`. */
/** The name the Plugins page gives the plugin a package of the list is, by the package's npm name; none for a package no plugin listed is. */
export const packageNamed = (plugins: readonly Plugin[], pkg: string, language: Language): string | undefined => {
  const owner = plugins.find((one) => one.box?.package === pkg);
  return owner === undefined ? undefined : nameIn(owner, language);
};

export const nameIn = (record: { readonly name: string; readonly nameZh?: string | undefined }, language: Language): string =>
  (language === "zh" ? record.nameZh : undefined) ?? record.name;

/** A maker's plugin name, the one its card and the chat's card go by: its models' name where that is not the maker's, else the maker's. */
export const pluginName = (id: string, words: CardWords): string | undefined => words[id]?.card?.name ?? CARDS[id]?.name;

/** A model plugin's one line: the maker or host its models come from, in its Chinese name where it has one, one sentence for every card (ruled 2026-11-13 and 2026-11-15). */
export const modelLine = (vendor: string, vendorZh = vendor): Words => ({ en: text("en", "pl.model.from", { vendor }), zh: text("zh", "pl.model.from", { vendor: vendorZh }) });

/**
 * One record per card the registry has — each maker's, and each host's the proxy carries — in OpenRouter's ranking (`RANKED`), the
 * rest by id: the card's own providers' keys and sign-ins, never a host's on a maker's card, since a host serves many makers and is a
 * card of its own. The balance is a way where OpenRouter serves the maker, since the platform pays through its one OpenRouter key, and so
 * never on a host's card. A sign-in is a way where the platform runs it: a subscription where pi marks it the maker's own, the person's
 * account at the provider otherwise, and the key's way where the sign-in makes a key.
 */
export function makerRecords(made: CardWords): readonly Plugin[] {
  // A card whose upstream is the seller's own asks for a base beside the key, which no card here draws: it is no card on the page yet.
  const drawn = CARD_IDS.filter((id) => !CARDS[id]!.providers.some(isTenantBase));
  const order = [...RANKED.filter((id) => drawn.includes(id)), ...drawn.filter((id) => !RANKED.includes(id))];
  return order.map((id): Plugin => {
    const card = CARDS[id]!;
    const words = made[id]?.card ?? {};
    const mark = made[id]?.mark;
    const plans = made[id]?.plans;
    const steps = made[id]?.signIn?.steps;
    const reach = card.providers;
    const keys = reach.filter((provider) => PROVIDERS[provider]?.key === true && PROVIDERS[provider]?.carried === true);
    const accounts = reach.filter((provider) => runsSignIn(provider) && PROVIDERS[provider]?.signIn !== undefined);
    const subscribed = reach.some(subscribes);
    // A sign-in that makes a key saves a key: its way is the key's.
    const signsIn = accounts.some((provider) => !makesKey(provider));
    const ways: readonly Way[] = [...(balanceReaches(id) ? ["platform" as const] : []), ...(signsIn ? ["account" as const] : []), ...(keys.length > 0 ? ["key" as const] : [])];
    const name = words.name ?? card.name;
    return {
      id, name, author: "ComChatX", ...(mark === undefined ? {} : { mark }), section: "models",
      about: modelLine(words.vendor ?? card.name, words.vendorZh),
      ...(words.description === undefined ? {} : { description: words.description }),
      builds: [],
      model: { vendor: words.vendor ?? card.name, ...(words.vendorZh === undefined ? {} : { vendorZh: words.vendorZh }), chat: true, ways, ...(subscribed && plans !== undefined ? { subscription: plans } : {}), keys, accounts, ...(steps === undefined || accounts.length === 0 ? {} : { signIn: steps }) },
    };
  });
}

class Unreadable extends Error {}
type Value = unknown;
const obj = (value: Value, at: string): Readonly<Record<string, Value>> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Unreadable(`${at}: not an object`);
  return value as Readonly<Record<string, Value>>;
};
const list = (value: Value, at: string): readonly Value[] => { if (!Array.isArray(value)) throw new Unreadable(`${at}: not a list`); return value; };
const str = (value: Value, at: string): string => { if (typeof value !== "string" || value.trim() === "") throw new Unreadable(`${at}: not a word`); return value; };
// A record names a subscription by one plan, as the first records did, or by a list of them.
const plansOf = (value: Value, at: string): readonly string[] => Object.freeze(typeof value === "string" ? [str(value, at)] : list(value, at).map((one, n) => str(one, `${at}[${n}]`)));
const bool = (value: Value, at: string): boolean => { if (typeof value !== "boolean") throw new Unreadable(`${at}: not true or false`); return value; };
const oneOf = <T extends string>(value: Value, allowed: readonly T[], at: string): T => { if (!allowed.includes(value as T)) throw new Unreadable(`${at}: not one of ${allowed.join(", ")}`); return value as T; };
const optional = <T>(value: Value, read: (value: Value) => T): T | undefined => (value === undefined ? undefined : read(value));
const day = (value: Value, at: string): string => { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(Date.parse(value)).toISOString().slice(0, 10) !== value) throw new Unreadable(`${at}: not a date`); return value; };
/** Words in every language the page speaks, each written in that language. */
const words = (value: Value, at: string): Words => {
  const given = obj(value, at);
  const read = Object.fromEntries(LANGUAGES.map((language) => [language, str(given[language], `${at}.${language}`)])) as Record<(typeof LANGUAGES)[number], string>;
  // Where no Chinese was given, `zh` is the English copied: only what an author wrote as Chinese is held to it.
  if (read.zh !== read.en && !/[一-鿿]/.test(read.zh) && !/^[\x20-\x7e]+$/.test(read.zh)) throw new Unreadable(`${at}.zh: not Chinese`);
  if (/[一-鿿]/.test(read.en)) throw new Unreadable(`${at}.en: not English`);
  return Object.freeze(read);
};
const wordList = (value: Value, at: string): readonly Words[] => Object.freeze(list(value, at).map((one, n) => words(one, `${at}[${n}]`)));
// A template is sent as `/<name>`: a name with a space or a slash in it would send other words.
const templateName = (value: Value, at: string): string => { const name = str(value, at); if (!/^[^\s/]+$/.test(name)) throw new Unreadable(`${at}: not a template's name`); return name; };
// A mark the reader refuses, of any shape, is no mark, and the rest of the record stands.
const mark = (value: Value): { readonly mark?: Mark } => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const given = value as Readonly<Record<string, Value>>;
  if (typeof given["logo"] === "string") return { mark: Object.freeze({ logo: given["logo"] }) };
  if (typeof given["line"] === "string") return { mark: Object.freeze({ line: given["line"] }) };
  const drawn = readDrawnMark(given);
  return drawn === undefined ? {} : { mark: drawn };
};

function readPlugin(value: Value, at: string): Plugin {
  const given = obj(value, at);
  const box = optional(given["box"], (one) => {
    const b = obj(one, `${at}.box`);
    const skills = list(b["skills"] ?? [], `${at}.box.skills`).map((skill, n) => { const s = obj(skill, `${at}.box.skills[${n}]`); return Object.freeze({ name: str(s["name"], `${at}.box.skills[${n}].name`), about: words(s["about"], `${at}.box.skills[${n}].about`) }); });
    const prompts = list(b["prompts"] ?? [], `${at}.box.prompts`).map((prompt, n) => { const p = obj(prompt, `${at}.box.prompts[${n}]`); return Object.freeze({ name: templateName(p["name"], `${at}.box.prompts[${n}].name`), about: words(p["about"], `${at}.box.prompts[${n}].about`), ...(p["hint"] === undefined ? {} : { hint: str(p["hint"], `${at}.box.prompts[${n}].hint`) }) }); });
    const readme = optional(b["readme"], (value) => { const r = obj(value, `${at}.box.readme`); return Object.freeze(Object.fromEntries((["en", "zh", "base"] as const).flatMap((key) => (r[key] === undefined ? [] : [[key, str(r[key], `${at}.box.readme.${key}`)]])))) as Readme; });
    const unread = optional(b["unread"], (value) => Object.freeze(list(value, `${at}.box.unread`).map((part, n) => oneOf(part, ["readme", "skills", "prompts"] as const, `${at}.box.unread[${n}]`))));
    return Object.freeze({
      package: str(b["package"], `${at}.box.package`), ...(b["source"] === undefined ? {} : { source: str(b["source"], `${at}.box.source`) }), skills: Object.freeze(skills),
      ...(prompts.length === 0 ? {} : { prompts: Object.freeze(prompts) }),
      ...(readme === undefined ? {} : { readme }), ...(unread === undefined || unread.length === 0 ? {} : { unread }),
    });
  });
  const source = optional(given["source"], (one) => {
    const s = obj(one, `${at}.source`);
    const aspects = obj(s["aspects"] ?? {}, `${at}.source.aspects`);
    const fields = optional(s["fields"], (value) => Object.freeze(Object.fromEntries(Object.entries(obj(value, `${at}.source.fields`)).map(([field, said]) => {
      const f = obj(said, `${at}.source.fields.${field}`);
      const extra = Object.keys(f).find((key) => key !== "label" && key !== "help");
      if (extra !== undefined) throw new Unreadable(`${at}.source.fields.${field}.${extra} is not a field's words`);
      return [field, Object.freeze({ label: words(f["label"], `${at}.source.fields.${field}.label`), ...(f["help"] === undefined ? {} : { help: words(f["help"], `${at}.source.fields.${field}.help`) }) })];
    }))));
    const lines = optional(s["lines"], (value) => Object.freeze(Object.fromEntries(Object.entries(obj(value, `${at}.source.lines`)).map(([line, said]) => {
      if (!(SOURCE_LINES as readonly string[]).includes(line)) throw new Unreadable(`${at}.source.lines.${line} is not a source's line`);
      const read = words(said, `${at}.source.lines.${line}`);
      const holds = LINE_HOLDS[line as SourceLine];
      for (const language of ["en", "zh"] as const) {
        const held = [...read[language].matchAll(/\{([^{}]*)\}/g)].map((one) => one[1]);
        if (held.join() !== (holds ?? "")) throw new Unreadable(`${at}.source.lines.${line}.${language}: ${holds === undefined ? "holds no placeholder" : `holds {${holds}} once`}`);
      }
      return [line, read];
    }))));
    // A region's name, by the region the gate lists a connection's reach in.
    const regions = optional(s["regions"], (value) => Object.freeze(Object.fromEntries(Object.entries(obj(value, `${at}.source.regions`)).map(([region, said]) => [region, words(said, `${at}.source.regions.${region}`)]))));
    return Object.freeze({ name: str(s["name"], `${at}.source.name`), ...(s["baseWhy"] === undefined ? {} : { baseWhy: words(s["baseWhy"], `${at}.source.baseWhy`) }), ...(s["ownKey"] === undefined ? {} : { ownKey: words(s["ownKey"], `${at}.source.ownKey`) }), ...(s["help"] === undefined ? {} : { help: str(s["help"], `${at}.source.help`) }), aspects: Object.freeze(Object.fromEntries(Object.entries(aspects).map(([aspect, said]) => [aspect, words(said, `${at}.source.aspects.${aspect}`)]))), ...(fields === undefined ? {} : { fields }), ...(lines === undefined ? {} : { lines }), ...(regions === undefined ? {} : { regions }) });
  });
  const model = optional(given["model"], (one) => {
    const m = obj(one, `${at}.model`);
    const ways = list(m["ways"], `${at}.model.ways`).map((way, n) => oneOf(way, WAYS, `${at}.model.ways[${n}]`));
    if (ways.length === 0 || new Set(ways).size !== ways.length) throw new Unreadable(`${at}.model.ways: none, or one twice`);
    const providers = (field: "keys" | "accounts"): readonly string[] => Object.freeze(list(m[field] ?? [], `${at}.model.${field}`).map((one, n) => str(one, `${at}.model.${field}[${n}]`)));
    return Object.freeze({ vendor: str(m["vendor"], `${at}.model.vendor`), chat: bool(m["chat"], `${at}.model.chat`), ways: Object.freeze(ways), ...(m["subscription"] === undefined ? {} : { subscription: plansOf(m["subscription"], `${at}.model.subscription`) }), keys: providers("keys"), accounts: providers("accounts") });
  });
  // `undo` is what the seller sees when the change goes, as the remove card says it.
  const page = optional(given["page"], (one) => { const p = obj(one, `${at}.page`); return Object.freeze({ changes: wordList(p["changes"], `${at}.page.changes`), ...(p["undo"] === undefined ? {} : { undo: words(p["undo"], `${at}.page.undo`) }) }); });
  if (box === undefined && source === undefined && model === undefined && page === undefined) throw new Unreadable(`${at}: has no part`);
  const builds = Object.freeze(list(given["builds"] ?? [], `${at}.builds`).map((one, n) => { const b = obj(one, `${at}.builds[${n}]`); return Object.freeze({ on: str(b["on"], `${at}.builds[${n}].on`), need: oneOf(b["need"], ["required", "optional"] as const, `${at}.builds[${n}].need`), ...(b["why"] === undefined ? {} : { why: words(b["why"], `${at}.builds[${n}].why`) }) }); }));
  return Object.freeze({
    id: str(given["id"], `${at}.id`), name: str(given["name"], `${at}.name`), ...(given["nameZh"] === undefined ? {} : { nameZh: str(given["nameZh"], `${at}.nameZh`) }), author: str(given["author"], `${at}.author`),
    ...(given["mark"] === undefined ? {} : mark(given["mark"])),
    section: oneOf(given["section"], SECTIONS, `${at}.section`),
    about: words(given["about"], `${at}.about`),
    ...(given["description"] === undefined ? {} : { description: words(given["description"], `${at}.description`) }),
    builds,
    ...(box === undefined ? {} : { box }), ...(source === undefined ? {} : { source }), ...(model === undefined ? {} : { model }), ...(page === undefined ? {} : { page }),
    ...(given["updated"] === undefined ? {} : { updated: day(given["updated"], `${at}.updated`) }),
    ...(given["version"] === undefined ? {} : { version: str(given["version"], `${at}.version`) }),
    ...(given["home"] === undefined ? {} : { home: str(given["home"], `${at}.home`) }),
    ...(given["unreleased"] === true ? { unreleased: true as const } : {}),
  });
}

function readBundle(value: Value, at: string): Bundle {
  const given = obj(value, at);
  const members = list(given["members"], `${at}.members`).map((one, n) => str(one, `${at}.members[${n}]`));
  if (members.length === 0 || new Set(members).size !== members.length) throw new Unreadable(`${at}.members: none, or one twice`);
  return Object.freeze({
    id: str(given["id"], `${at}.id`), name: str(given["name"], `${at}.name`), ...(given["nameZh"] === undefined ? {} : { nameZh: str(given["nameZh"], `${at}.nameZh`) }), author: str(given["author"], `${at}.author`),
    ...(given["mark"] === undefined ? {} : mark(given["mark"])),
    ...(given["art"] === undefined ? {} : { art: str(given["art"], `${at}.art`) }),
    about: words(given["about"], `${at}.about`),
    ...(given["description"] === undefined ? {} : { description: words(given["description"], `${at}.description`) }),
    members: Object.freeze(members),
  });
}

/**
 * The catalogue as the page may draw it, or an error naming the first thing wrong: every record whole, each id once, every plugin a
 * record builds on or a bundle lists is in the catalogue, and no plugin requires itself through another.
 */
export function readCatalogue(value: Value): Catalogue {
  const given = obj(value, "catalogue");
  return linked(list(given["plugins"], "plugins").map((one, n) => readPlugin(one, `plugins[${n}]`)), list(given["bundles"] ?? [], "bundles").map((one, n) => readBundle(one, `bundles[${n}]`)), cardWords([]));
}

function linked(plugins: readonly Plugin[], bundles: readonly Bundle[], words: CardWords): Catalogue {
  const ids = [...plugins, ...bundles].map((one) => one.id);
  const twice = ids.find((id, n) => ids.indexOf(id) !== n);
  if (twice !== undefined) throw new Unreadable(`${twice}: listed twice`);
  const known = new Set(plugins.map((one) => one.id));
  for (const plugin of plugins) for (const one of plugin.builds) if (!known.has(one.on) || one.on === plugin.id) throw new Unreadable(`${plugin.id}: builds on ${one.on}, which is not another plugin here`);
  for (const bundle of bundles) for (const member of bundle.members) if (!known.has(member)) throw new Unreadable(`${bundle.id}: lists ${member}, which is not a plugin here`);
  const required = new Map(plugins.map((one) => [one.id, one.builds.filter((b) => b.need === "required").map((b) => b.on)]));
  const loops = (id: string, path: readonly string[]): boolean => path.includes(id) || (required.get(id) ?? []).some((next) => loops(next, [...path, id]));
  const looped = plugins.find((one) => (required.get(one.id) ?? []).some((next) => loops(next, [one.id])));
  if (looped !== undefined) throw new Unreadable(`${looped.id}: requires itself through another plugin`);
  return Object.freeze({ plugins: Object.freeze([...plugins]), bundles: Object.freeze([...bundles]), words });
}

const bareName = (name: string): string => name.replace(/^@[^/]+\//, "");
const said = (value: Value): string | undefined => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined);

/**
 * What a package ships as a record's package part: its skills and templates in their own words, each in Chinese where `chinese` gives
 * it, its READMEs served from the CDN at its version, and the parts its files left unread.
 */
export function shippedBox(pkg: Pick<NpmPackage, "name" | "version" | "shipped">, given: (kind: "skills" | "prompts", name: string, language: "en" | "zh") => string | undefined = () => undefined): Pick<NonNullable<Plugin["box"]>, "skills" | "prompts" | "readme" | "unread"> {
  const { shipped } = pkg;
  const both = (kind: "skills" | "prompts", name: string, en: string): Words => ({ en, zh: given(kind, name, "zh") ?? en });
  return {
    // A skill's English is the field's where the package gives it, else its `SKILL.md`'s description; its Chinese the field's, else that English.
    skills: shipped.skills.map((skill) => { const en = given("skills", skill.name, "en") ?? skill.description; return { name: skill.name, about: both("skills", skill.name, en) }; }),
    prompts: shipped.prompts.filter((prompt) => prompt.description.trim() !== "").map((prompt) => ({ name: prompt.name, about: both("prompts", prompt.name, prompt.description), ...(prompt.hint === undefined ? {} : { hint: prompt.hint }) })),
    ...(shipped.readme === undefined && shipped.readme_zh === undefined ? {} : { readme: { ...(shipped.readme === undefined ? {} : { en: shipped.readme }), ...(shipped.readme_zh === undefined ? {} : { zh: shipped.readme_zh }), base: cdnBase(pkg.name, pkg.version) } }),
    ...(shipped.unread.length === 0 ? {} : { unread: shipped.unread }),
  };
}

/**
 * What a package ships at the version read, each skill's words and template's Chinese as its `comchatx` field at that version gives them:
 * the one reader of those words, for the catalogue's records and for a package read whole on its own page alike.
 */
export const ourShippedBox = (pkg: Pick<NpmPackage, "name" | "version" | "shipped" | "comchatx">): ReturnType<typeof shippedBox> => shippedBox(pkg, fieldWords(pkg.comchatx as Readonly<Record<string, Value>> | undefined));

type ShippedLines = Pick<ReturnType<typeof shippedBox>, "skills" | "prompts">;

/**
 * What a package of ours ships, less each skill or template the reader below would refuse, each named with the reader's own sentence:
 * the words are the package's, not the page's, so one bad line costs that line and never its package.
 */
function readableLines<T extends ShippedLines>(box: T, at: string, dropped: (sentence: string) => void): T {
  const kept = <L>(kind: string, lines: readonly L[], read: (line: L, at: string) => void): L[] => lines.filter((line, n) => {
    try { read(line, `${at}.box.${kind}[${n}]`); return true; } catch (error) {
      if (!(error instanceof Unreadable)) throw error;
      dropped(error.message);
      return false;
    }
  });
  const skills = kept("skills", box.skills, (skill, where) => { str(skill.name, `${where}.name`); words(skill.about, `${where}.about`); });
  const prompts = kept("prompts", box.prompts ?? [], (prompt, where) => {
    templateName(prompt.name, `${where}.name`); words(prompt.about, `${where}.about`);
    if (prompt.hint !== undefined) str(prompt.hint, `${where}.hint`);
  });
  return { ...box, skills, ...(box.prompts === undefined ? {} : { prompts }) };
}

/** The records of the catalogue's own that are no package: a link to one is written by its id, since no dependency can name it. */

/** The words a `comchatx` field gives of a skill or a template, `<kind>.<name>.en` and `<kind>.<name>.zh`: one line each, or none. */
function fieldWords(field: Readonly<Record<string, Value>> | undefined): (kind: "skills" | "prompts", name: string, language: "en" | "zh") => string | undefined {
  return (kind, name, language) => {
    const all = field?.[kind];
    const one = typeof all === "object" && all !== null && !Array.isArray(all) ? (all as Record<string, Value>)[name] : undefined;
    if (typeof one !== "object" || one === null) return undefined;
    // A version published before the field gave a skill's Chinese as `zh` gave it in its `about`.
    const legacy = (one as Record<string, Value>)["about"];
    return said((one as Record<string, Value>)[language]) ?? (typeof legacy === "object" && legacy !== null && !Array.isArray(legacy) ? said((legacy as Record<string, Value>)[language]) : undefined);
  };
}

/**
 * A package of ours as the page draws it, from what it ships and says of itself. npm's `description` is its line in English; what it
 * ships at its version (`shipped`) gives its Overview, its skills and its Try it; what it depends on that is a plugin (`uses`) is what
 * it requires, `on` giving the id each such name goes by here. Its `comchatx` field gives what the files do not: its shelf (the
 * plugin's name where it is not the package's, its mark, its section, its place, its data source) and the Chinese of
 * its one-line words (`about`, `skills.<name>.zh`, `prompts.<name>.zh`), and, in `builds`, what it needs beside it that no
 * dependency carries: a package by its npm name, as `uses` names one, or a model, Jev or a maker, by its id here. A field the page
 * cannot read is left whole out, and a skill or template whose words the reader refuses is left out of the record, named to `dropped`.
 */
export function ourRecord(pkg: NpmPackage, on: (name: string) => string | undefined, dropped: (sentence: string) => void = () => {}): Plugin {
  return withNpm(ourRecordOf(pkg, on, dropped), pkg);
}
/** What the page reads of a package's source: each key of it, and each of its lines. */
const SOURCE_KEYS: readonly string[] = ["name", "baseWhy", "ownKey", "help", "aspects", "fields", "lines", "regions"];

/**
 * A package's source, less each key and each line the page does not read, each named with a sentence: a package that says more than
 * the page reads keeps what the page does read, so its words can be released before the page that reads them. A line the page reads is
 * read as before, and one that does not read leaves the source unread.
 */
function readableSource(source: Value, at: string, dropped: (sentence: string) => void): Value {
  const known = (value: Value, names: readonly string[], where: string): Value => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
    const kept: Record<string, Value> = {};
    for (const [key, said] of Object.entries(value)) {
      if (names.includes(key)) kept[key] = said;
      else dropped(`${where}.${key} is not read on this page`);
    }
    return kept;
  };
  const read = known(source, SOURCE_KEYS, `${at}.source`);
  if (typeof read !== "object" || read === null || Array.isArray(read)) return read;
  const { lines } = read as Readonly<Record<string, Value>>;
  return lines === undefined ? read : { ...read, lines: known(lines, SOURCE_LINES, `${at}.source.lines`) };
}

/** The Chinese of a package's line as its `comchatx` field gives it: `about`. */
const chineseLine = (field: Readonly<Record<string, Value>>): string | undefined => said(field["about"]);
/**
 * What a package of someone else's made for ComChatX declares in its `comchatx` field, read as ours are read: its shelf, its mark and
 * the Chinese of its line, whenever the field gives one, whatever its English says. Its author stays npm's, so it is never drawn as
 * ComChatX's. A field the page cannot read declares nothing.
 */
export function declaredBy(pkg: NpmPackage): { readonly section?: Section; readonly mark?: Mark; readonly zh?: string } {
  try {
    const read = fieldRead(pkg, (name) => name, () => {});
    if (read.declared === undefined) return {};
    const { record, declared } = read;
    return { section: record.section, ...(record.mark === undefined ? {} : { mark: record.mark }), ...(declared.zh === undefined ? {} : { zh: declared.zh }) };
  } catch {
    return {};
  }
}
/** A record with what npm says of its package beside it, as its card draws it. */
const withNpm = (plugin: Plugin, pkg: NpmPackage): Plugin => Object.freeze({ ...plugin, onNpm: onNpmOf(pkg) });
const onNpmOf = (pkg: NpmPackage): OnNpm => Object.freeze({
  name: pkg.name, kinds: pkg.kinds, ...(pkg.downloads === undefined ? {} : { downloads: pkg.downloads }), ...(pkg.updated === "" ? {} : { published: pkg.updated }),
  ...(pkg.repository === undefined || pkg.repository === "" ? {} : { repository: pkg.repository }),
  ...(pkg.homepage === undefined || pkg.homepage === "" ? {} : { homepage: pkg.homepage }),
});
function ourRecordOf(pkg: NpmPackage, on: (name: string) => string | undefined, dropped: (sentence: string) => void): Plugin {
  return fieldRead(pkg, on, dropped).record;
}
/**
 * The record a package's page gives, and, where its `comchatx` field was read rather than left out, what the field declared: the one
 * answer to what a package declares, so no later read of the raw field can stand npm's words in for a line the reader refused.
 */
function fieldRead(pkg: NpmPackage, on: (name: string) => string | undefined, dropped: (sentence: string) => void): { readonly record: Plugin; readonly declared?: { readonly zh?: string } } {
  const bare = bareName(pkg.name);
  const english = said(pkg.description) ?? bare;
  const field = pkg.comchatx;
  // A line is named once: the record drawn says which of its lines it left out, the field's reading or npm's words alone.
  const plainLeft: string[] = [];
  const plainDropped = (sentence: string): void => { plainLeft.push(sentence); };
  const plainRecord = (): Plugin => { const record = readPlugin(plain, pkg.name); plainLeft.forEach(dropped); return record; };
  // What a package is and builds on is read by the one reader the seed reads it by, here too: a field that fails to read leaves out
  // its words, never its id or its links. Each link keeps what it builds on and the need, not the words beside them.
  const plain = {
    id: ourId(pkg), name: bare, author: "ComChatX", section: "extensions", about: { en: english, zh: english },
    builds: buildsOf(pkg, on).map(({ on: id, need }) => ({ on: id, need })),
    box: { package: pkg.name, source: `npm:${pkg.name}`, ...readableLines(shippedBox(pkg), pkg.name, plainDropped) }, version: pkg.version,
    ...(/^\d{4}-\d{2}-\d{2}/.test(pkg.updated) ? { updated: pkg.updated.slice(0, 10) } : {}),
    ...(pkg.repository === undefined || pkg.repository === "" ? {} : { home: pkg.repository }),
  };
  if (field === undefined) return { record: plainRecord() };
  try {
    const fieldLeft: string[] = [];
    const zh = chineseLine(field);
    const record = readPlugin({
      ...plain,
      ...(field["name"] === undefined ? {} : { name: field["name"] }),
      ...(field["nameZh"] === undefined ? {} : { nameZh: field["nameZh"] }),
      ...(field["mark"] === undefined ? {} : { mark: field["mark"] }),
      ...(field["section"] === undefined ? {} : { section: field["section"] }),
      about: { en: english, zh: zh ?? english },
      builds: fieldBuilds(pkg, on) ?? (() => { throw new Unreadable(`${pkg.name}: its builds do not read`); })(),
      box: { ...plain.box, ...readableLines(shippedBox(pkg, fieldWords(field)), pkg.name, (sentence) => { fieldLeft.push(sentence); }) },
      ...(field["source"] === undefined ? {} : { source: readableSource(field["source"], pkg.name, (sentence) => { fieldLeft.push(sentence); }) }),
    }, pkg.name);
    fieldLeft.forEach(dropped);
    return zh === undefined ? { record, declared: {} } : { record: Object.freeze({ ...record, declaredZh: record.about.zh }), declared: { zh: record.about.zh } };
  } catch {
    return { record: plainRecord() };
  }
}

/** Where a package of ours stands among ours: its `comchatx` field's `order`, a whole number, lowest first; one that gives none, last. */
function placeOf(pkg: NpmPackage): number {
  const order = pkg.comchatx?.["order"];
  return typeof order === "number" && Number.isSafeInteger(order) && order >= 0 ? order : Number.MAX_SAFE_INTEGER;
}

/**
 * The catalogue with ours as npm holds them: ours first, in the order their `comchatx` fields give and, among those that give none, as
 * given, then Jev and the model makers. A package of someone else's
 * that one of ours installs with it, or that an official bundle lists, is drawn as pi's gallery draws it. The bundles are the official ones,
 * in the code's order, cx Core Bundle first (`shared/bundles.ts`); a bundle with a member that is neither one of ours npm gave nor
 * someone else's is left out, since it cannot be installed whole, and so is one whose id another record holds. A package of ours whose record
 * cannot be read is left out alone, and each package or line left out is named to `report`, the console by default. Each card's words are
 * those its maker's package of `given` carries (`cardWords`), unless `words` gives them.
 */
export function catalogueWith(given: readonly NpmPackage[], official: readonly OfficialBundle[] = OFFICIAL_BUNDLES, report: (sentence: string) => void = (sentence) => { console.warn(sentence); }, words: CardWords = cardWords(given)): Catalogue {
  const ours = [...given].sort((one, other) => placeOf(one) - placeOf(other));
  // A maker's card carries the facts and links of the first of its providers' packages npm holds, else of its own package (`cardPackage`);
  // the package itself is no card.
  const makers = new Map(given.flatMap((pkg) => { const provider = packageProvider(`npm:${pkg.name}`); return provider === undefined ? [] : [[provider, pkg] as const]; }));
  const jev = jevRecord(words);
  const jevPackage = Object.entries(PLUGIN_PROVIDERS).flatMap(([provider, card]) => (card === jev.id ? [makers.get(provider)] : []))[0];
  const base = [jevPackage === undefined ? jev : withNpm(jev, jevPackage), ...makerRecords(words).map((record) => {
    const own = cardPackage(record.id);
    const pkg = makerPackageOf(record.id, makers) ?? (own === undefined ? undefined : given.find((one) => one.name === own));
    return pkg === undefined ? record : withNpm(record, pkg);
  })];
  const idOf = idsOf(ours, base.map((one) => one.id));
  const theirs = new Map<string, Plugin>();
  const on = (name: string): string | undefined => {
    const id = idOf(name);
    if (id === `~${name}` && !theirs.has(name)) theirs.set(name, { id, name, author: "", section: "extensions", about: { en: "", zh: "" }, builds: [], box: { package: name, skills: [], source: `npm:${name}` }, npm: name, own: true });
    return id;
  };
  // pi loads the packages it can and names the one it cannot: a package of ours that cannot be read is left out alone.
  const records = ours.flatMap((pkg) => {
    // A provider's package is its maker's way in, which the maker's card stands for; a package with no `pi` object is a library: no record.
    if (onNoRecord(pkg)) return [];
    try { return [ourRecord(pkg, on, (sentence) => { report(`Plugins: a line of ${pkg.name} left out: ${sentence}`); })]; } catch (error) {
      if (!(error instanceof Unreadable)) throw error;
      report(`Plugins: ${pkg.name} left out: ${error.message}`);
      return [];
    }
  }).filter((one, n, all) => all.findIndex((other) => other.id === one.id) === n && !base.some((other) => other.id === one.id));
  // A member of an official bundle that is someone else's is drawn as pi's gallery draws it, as one ours installs with it is.
  for (const bundle of official) for (const name of bundle.members) if (!isOurs(name)) on(name);
  const all = [...records, ...base, ...theirs.values()];
  const known = new Set(all.map((one) => one.id));
  const read = all.map((plugin) => (plugin.builds.every((link) => known.has(link.on) && link.on !== plugin.id) ? plugin : { ...plugin, builds: plugin.builds.filter((link) => known.has(link.on) && link.on !== plugin.id) }));
  // Ours requiring each other in a ring cannot be installed in an order, nor can what requires one of them: those are refused, and
  // every other package keeps its links as read.
  const refused = unorderable(read);
  const plugins = read.filter((plugin) => !refused.has(plugin.id)).map((plugin) => (plugin.builds.some((link) => refused.has(link.on)) ? { ...plugin, builds: plugin.builds.filter((link) => !refused.has(link.on)) } : plugin));
  const ourGiven = new Set(ours.map((pkg) => pkg.name));
  const ofName = (name: string): string | undefined => (ourGiven.has(name) ? idOf(name) : theirs.has(name) ? `~${name}` : undefined);
  const pointed = official.map((one): Bundle => ({
    id: one.id, name: one.name, ...(one.nameZh === undefined ? {} : { nameZh: one.nameZh }), author: OFFICIAL_AUTHOR, ...(one.mark === undefined ? {} : mark(one.mark)),
    about: one.about, description: one.description, members: one.members.map((name) => ofName(name) ?? ""),
  }));
  const bundles = pointed.filter((bundle, n) => bundle.members.every((member) => known.has(member) && !refused.has(member)) && new Set(bundle.members).size === bundle.members.length
    && !known.has(bundle.id) && pointed.findIndex((other) => other.id === bundle.id) === n);
  return linked(plugins, bundles.map((bundle) => Object.freeze({ ...bundle, members: Object.freeze([...bundle.members]) })), words);
}

/** A maker card's package: the first of its card's providers that has one, as npm holds it; none where npm gave none. */
function makerPackageOf(card: string, makers: ReadonlyMap<string, NpmPackage>): NpmPackage | undefined {
  const provider = CARDS[card]?.providers.find((one) => providerPackage(one) !== undefined);
  return provider === undefined ? undefined : makers.get(provider);
}

/** The plugins whose required chain comes back to itself, and every plugin whose required chain reaches one of those. */
function unorderable(plugins: readonly Plugin[]): ReadonlySet<string> {
  const required = new Map(plugins.map((one) => [one.id, one.builds.filter((link) => link.need === "required").map((link) => link.on)]));
  const reaches = (from: string): ReadonlySet<string> => {
    const seen = new Set<string>();
    const walk = (id: string): void => { for (const next of required.get(id) ?? []) if (!seen.has(next)) { seen.add(next); walk(next); } };
    walk(from);
    return seen;
  };
  const reach = new Map(plugins.map((one) => [one.id, reaches(one.id)]));
  const ring = new Set(plugins.filter((one) => reach.get(one.id)!.has(one.id)).map((one) => one.id));
  return new Set(plugins.filter((one) => ring.has(one.id) || [...reach.get(one.id)!].some((id) => ring.has(id))).map((one) => one.id));
}

/**
 * Records given as a catalogue would give them, over this catalogue's: one with an id already here takes its place, the rest follow, and
 * the whole is read as one, so a record may build on, or list, a plugin the other side holds. A record that restates a maker restates its
 * words: the ways that reach the maker, their providers, the plans its sign-in names and its package's facts stay the registry's.
 */
export function withRecords(base: Catalogue, value: Value): Catalogue {
  const given = obj(value, "records");
  const extra = { plugins: list(given["plugins"] ?? [], "plugins").map((one, n) => readPlugin(one, `plugins[${n}]`)), bundles: list(given["bundles"] ?? [], "bundles").map((one, n) => readBundle(one, `bundles[${n}]`)) };
  const reach = (theirs: Plugin, mine: Plugin): Plugin => (theirs.model === undefined || mine.model === undefined ? theirs
    : { ...theirs, ...(mine.onNpm === undefined ? {} : { onNpm: mine.onNpm }), model: { ...theirs.model, ways: mine.model.ways, ...(mine.model.subscription === undefined ? {} : { subscription: mine.model.subscription }), keys: mine.model.keys, accounts: mine.model.accounts, ...(mine.model.signIn === undefined ? {} : { signIn: mine.model.signIn }) } });
  const plugins = [...base.plugins.map((one) => { const other = extra.plugins.find((theirs) => theirs.id === one.id); return other === undefined ? one : reach(other, one); }), ...extra.plugins.filter((other) => !base.plugins.some((one) => one.id === other.id))];
  const over = <T extends { readonly id: string }>(mine: readonly T[], theirs: readonly T[]): readonly T[] => [...mine.map((one) => theirs.find((other) => other.id === one.id) ?? one), ...theirs.filter((other) => !mine.some((one) => one.id === other.id))];
  return linked(plugins, over(base.bundles, extra.bundles), base.words);
}

/** A source's words, as a record of the catalogue gives them: its card's line, its fuller account, and each kind of purchase. */
export function sourceWords(catalogue: Catalogue, name: string): { readonly about: Words; readonly description: Words; readonly aspects: Readonly<Record<string, Words>> } | undefined {
  const plugin = catalogue.plugins.find((one) => one.source?.name === name);
  return plugin?.source === undefined ? undefined : { about: plugin.about, description: plugin.description ?? plugin.about, aspects: plugin.source.aspects };
}
