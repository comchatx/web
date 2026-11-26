import { buildsOnAll as allWalk, dependencyOrder as orderWalk, installsWith as installsWalk, requiredOf as requiredWalk } from "../shared/plugin-builds.js";
import { NPM_KINDS, NPM_ORDERS, versionInUse, type Version, type ClickEnd, type HeldBundle, type NpmKind, type NpmOrder, type Account, type Click, type Model, type ModelPlugin, type Models, type NpmPackage, type OnImage, type Package, type PackageList, type Provider, type Series, type SeriesByVendor, type Shipped, type Source, type Words } from "./backend.js";
import { nameIn, ourShippedBox, plansSaid, vendorIn, type Bundle, type Catalogue, type Plugin, type Section, type Way } from "./catalogue.js";
import type { Say } from "./stream-view.js";
import type { Language, StringKey } from "./strings.js";
import type { CardStep } from "./sign-in-card.js";
import { IMAGE_PACKAGE_ROOT, imageSource } from "../shared/image-root.js";
import { npmNameOf } from "./plugins-npm.js";
import { isOurs } from "../shared/package-names.js";
import { makerOf, PROVIDERS } from "../shared/model-makers.js";
import { keyProvidersOf, packageProvider } from "../shared/provider-packages.js";

/**
 * What the Plugins page knows of the person, read once per load: the catalogue, and what they hold of it. Every surface of the page
 * asks the functions below, so one question has one answer wherever it is drawn.
 */
export type Held = {
  readonly catalogue: Catalogue;
  readonly packages: readonly Package[];
  readonly sources: readonly Source[];
  readonly models: readonly ModelPlugin[];
  /** The packages the image carries that the person has not installed: what one states of itself is known before it is installed. */
  readonly onImage: readonly OnImage[];
  /** The models the box serves today, where the read answered: a vendor serving none of them is not offered. */
  readonly served?: Models;
  /** The person's accounts and keyed providers, where the reads answered: a way counts as connected only on their word. */
  readonly accounts?: readonly Account[];
  readonly providers?: readonly Provider[];
  /** Each vendor's chat models by series, where the platform offers them so and the read answered. */
  readonly series?: SeriesByVendor;
  /** The vendors holding chat's places, in the order their first series was ticked, where the platform offers series and the read answered. */
  readonly chat?: readonly string[];
  /** Which of the three the account is, where the read answered: unread, the page draws a member's. */
  readonly account?: Standing;
  /** The models the platform's key serves this account (`/me`'s `served_models`), where the read answered: what a trial's balance pays for. */
  readonly platformServed?: readonly PlatformModel[];
  /** npm's newest version of each installed package the page read npm for, by npm name: ours as `/plugins/ours` gives them, someone else's as its own read does. */
  readonly newest?: Readonly<Record<string, string>>;
  /** The bundles the account's presses brought, as `/me` keeps them, where the read answered. */
  readonly pressed?: readonly HeldBundle[];
  /** The npm names whose last end the list keeps is a failed install, where the list said its ends. */
  readonly failedInstalls?: readonly string[];
};

/** A model the platform's key serves, as `/me` names it. */
export type PlatformModel = { readonly provider: string; readonly id: string };

/** A member, a trial or a free account (PRODUCT §2.6): a free account reaches no model. */
export type Standing = "member" | "trial" | "free";

export type Item = Plugin | Bundle;

const OWN = "~";
/**
 * The catalogue the page draws from, for what the platform offers and what cx's computer lists. Bundles and the model vendors are
 * records only where the platform offers them as plugins; a link to a record that is not drawn is no link. A package cx's computer lists
 * that no record takes is one the person installed themselves, and gets a record made of what the package states of itself: one that
 * no record names, and one that states the name of a record's package where that record's is the image's.
 */
export function drawnCatalogue(catalogue: Catalogue, features: { readonly bundles: boolean; readonly modelPlugins: boolean }, packages: readonly Package[], sources: readonly Source[], served?: Models, onImage: readonly OnImage[] = [], accounts?: readonly Pick<Account, "id">[]): Catalogue {
  // Where a vendor cannot be installed or removed, the ones there are are the ones the platform serves, and the ones whose subscription
  // it signs in to, whose page is where that is done.
  const kept = features.modelPlugins ? catalogue.plugins : catalogue.plugins.filter((plugin) => plugin.model === undefined || plugin.model.chat === false || vendorModels(plugin, served).length > 0 || signsIn(plugin, accounts));
  const ids = new Set(kept.map((plugin) => plugin.id));
  const plugins = kept.map((plugin) => (plugin.builds.every((link) => ids.has(link.on)) ? plugin : { ...plugin, builds: plugin.builds.filter((link) => ids.has(link.on)) }));
  const taken = new Set(catalogue.plugins.flatMap((plugin) => listedFor(packages, onImage, plugin)?.source ?? []));
  const boxed = new Set(catalogue.plugins.flatMap((plugin) => plugin.box?.package ?? []));
  const selling = new Set([...catalogue.plugins.flatMap((plugin) => plugin.source?.name ?? []), ...sources.map((source) => source.name)]);
  // A maker's package is its maker card's: the card's install and its key or sign-in put it in the list, so it is drawn on no record of its own.
  // One of ours is drawn from its record alone: one whose record the page has not read is not someone else's.
  const mine = packages.filter((one) => !taken.has(one.source) && packageProvider(one.source) === undefined && (boxed.has(one.name) || !selling.has(one.name)) && !isOurs(npmNameOf(one.source) ?? ""));
  // Its address is its name's where no other of them states that name, else the list's own word for it: neither depends on the list's order.
  const own = mine.map((one): Plugin => ({
    ...(npmNameOf(one.source) === undefined ? {} : { npm: npmNameOf(one.source)! }),
    id: `${OWN}${mine.some((other) => other !== one && other.name === one.name) ? one.source : one.name}`, name: one.name, author: one.author ?? "", section: "extensions", about: one.about, ...(one.description.en === "" && one.description.zh === "" ? {} : { description: one.description }),
    builds: [], box: { package: one.name, skills: [], source: one.source }, own: true,
  }));
  return { plugins: [...plugins, ...own], bundles: features.bundles ? catalogue.bundles : [], words: catalogue.words, ...(catalogue.oursRead === undefined ? {} : { oursRead: catalogue.oursRead }) };
}
export const isBundle = (item: Item): item is Bundle => "members" in item;

/**
 * A record drawn from what its package ships at the version npm answered: its skills, templates and README in their own words, and as
 * what it builds on, each package it depends on that is a plugin the page holds a record of. A library it depends on is no plugin.
 */
export function withPackage(held: Held, plugin: Plugin, pkg: NpmPackage): Plugin {
  if (plugin.box === undefined) return plugin;
  return { ...plugin, builds: buildsWith(held, plugin, pkg.uses), box: { ...plugin.box, ...ourShippedBox(pkg) } };
}

/** A record's links, and as required each package npm says it uses that is another record the page holds. */
function buildsWith(held: Held, plugin: Plugin, uses: readonly string[]): Plugin["builds"] {
  const ids = uses.flatMap((name) => held.catalogue.plugins.find((one) => one.id !== plugin.id && (one.npm === name || one.box?.package === name))?.id ?? []);
  return [...plugin.builds, ...[...new Set(ids)].filter((id) => !plugin.builds.some((link) => link.on === id)).map((on) => ({ on, need: "required" as const }))];
}

/** The world with each record npm was read for linked to what its package uses, by npm name, as the record's page shows it. */
export const linkedBy = (held: Held, uses: ReadonlyMap<string, readonly string[]>): Held => ({
  ...held,
  catalogue: { ...held.catalogue, plugins: held.catalogue.plugins.map((plugin) => { const named = plugin.npm === undefined || plugin.box === undefined ? undefined : uses.get(plugin.npm); return named === undefined ? plugin : { ...plugin, builds: buildsWith(held, plugin, named) }; }) },
});

const pluginById = (held: Held, id: string): Plugin | undefined => held.catalogue.plugins.find((plugin) => plugin.id === id);
/**
 * The listed package a record's is: the one a record made of a listed package was made of; else by name, the one on the image's root
 * before any other, since a package the person installed themselves can state the name of one the image carries. While the image
 * carries the record's package uninstalled, no other of its name is the record's: the record reads not installed and installs the image's.
 */
function listedFor(packages: readonly Package[], onImage: readonly OnImage[], plugin: Plugin): Package | undefined {
  const box = plugin.box;
  if (box === undefined) return undefined;
  // A package from npm is the same package at whatever version the seller pinned it.
  const npm = box.source === undefined ? undefined : npmNameOf(box.source);
  if (box.source !== undefined) return packages.find((one) => one.source === box.source) ?? (npm === undefined ? undefined : packages.find((one) => npmNameOf(one.source) === npm));
  return packages.find((one) => one.name === box.package && one.source === imageSource(box.package))
    ?? (onImage.some((one) => one.name === box.package) ? undefined : packages.find((one) => one.name === box.package));
}
export const packageOf = (held: Held, plugin: Plugin): Package | undefined => listedFor(held.packages, held.onImage, plugin);
/** The gate's row for a plugin's source where its package is listed: a source the gate does not list leaves the package's own word standing. */
export const sourceOf = (held: Held, plugin: Plugin): Source | undefined => (plugin.source === undefined || packageOf(held, plugin) === undefined ? undefined : held.sources.find((one) => one.name === plugin.source!.name));
export const modelOf = (held: Held, plugin: Plugin): ModelPlugin | undefined => (plugin.model === undefined ? undefined : held.models.find((one) => one.id === plugin.id && one.installed !== false));
/**
 * The source a click on a plugin's package names: the list's own where cx's computer lists the package, installed or on the image, else
 * the image's root for the record's package.
 */
export const sourceFor = (held: Held, plugin: Plugin): string | undefined =>
  plugin.box === undefined ? undefined : plugin.box.source ?? (packageOf(held, plugin) ?? held.onImage.find((one) => one.name === plugin.box!.package))?.source ?? imageSource(plugin.box.package);

/** What a plugin's package states of itself — its version and where its code is — as the box holds it or, not yet installed, as the image carries it. */
export const shippedOf = (held: Held, plugin: Plugin): Shipped & { readonly version?: string } =>
  packageOf(held, plugin) ?? held.onImage.find((one) => one.name === plugin.box?.package) ?? {};

/** Whether the list holds a plugin's package whose files are gone from cx's computer: a remove and a new install bring it back. */
export const filesMissing = (held: Held, plugin: Plugin): boolean => packageOf(held, plugin)?.missing === true;

/** Whether a plugin's listed package is on by the list's own word, whatever the gate says of its source; nothing where the list has no package for it. */
export const packageOn = (held: Held, plugin: Plugin): boolean | undefined => { const one = packageOf(held, plugin); return one === undefined ? undefined : one.enabled !== false; };

/** A plugin is installed when its model plugin is held, or when the list has its package. */
/**
 * cx's packages as the seller asked for them: a removal or a switch the platform keeps for a computer that is not running is drawn done.
 * An install that waits has no package to draw yet; `Doing.queued` draws it.
 */
export function asAsked(packages: readonly Package[], waiting: readonly Click[]): readonly Package[] {
  // An update changes no package's place or switch: what it waits on is drawn by the press, and the package stays as it is listed.
  const last = new Map(waiting.filter((click) => click.op !== "update").map((click) => [click.source, click.op]));
  return packages.flatMap((one) => {
    const op = last.get(one.source);
    return op === "remove" ? [] : op === "on" || op === "off" ? [{ ...one, enabled: op === "on" }] : [one];
  });
}

/** A version as npm numbers a release, `major.minor.patch`; a pre-release or anything else is not compared. */
const release = (version: string | undefined): readonly number[] | undefined => {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version?.trim() ?? "");
  return parts === null ? undefined : parts.slice(1).map(Number);
};
const later = (one: readonly number[], other: readonly number[]): boolean => {
  const at = one.findIndex((part, n) => part !== other[n]);
  return at !== -1 && one[at]! > other[at]!;
};

/**
 * npm's newer version of an installed plugin, where the page read one: what its Update brings. The page offers one only to a package pi
 * fetched from npm by its name alone, though pi also updates a listed npm alias: one installed at a version it named stays there, and one
 * whose files are gone is installed again, not updated.
 */
export function newerOf(held: Held, plugin: Plugin): string | undefined {
  const name = plugin.box?.package;
  const listed = plugin.model === undefined ? packageOf(held, plugin) : undefined;
  if (name === undefined || listed === undefined || listed.missing === true || listed.source !== `npm:${name}`) return undefined;
  const latest = held.newest?.[name];
  const have = release(listed.version), want = release(latest);
  return have !== undefined && want !== undefined && later(want, have) ? latest : undefined;
}

/** The installed plugins npm holds a newer version of, in the catalogue's order. */
export const updatable = (held: Held): readonly Plugin[] => held.catalogue.plugins.filter((plugin) => newerOf(held, plugin) !== undefined);

/** npm's newest version of each package of ours, as the catalogue read them from npm: a record of another kind states no version npm gave. */
export const oursNewest = (catalogue: Catalogue): Readonly<Record<string, string>> => Object.fromEntries(catalogue.plugins.flatMap((plugin) =>
  plugin.own !== true && plugin.version !== undefined && plugin.box !== undefined && plugin.box.source === `npm:${plugin.box.package}` ? [[plugin.box.package, plugin.version]] : []));

export const installed = (held: Held, plugin: Plugin): boolean => (plugin.model !== undefined ? modelOf(held, plugin) !== undefined : packageOf(held, plugin) !== undefined);

/**
 * A source the person connects with their own stores, by the gate's list: the gate turns it on once a store works and off once none is
 * left, so the plugin's switch is its package's alone and what is unconnected is said by the line under its head.
 */
export const connects = (held: Held, plugin: Plugin): boolean => sourceOf(held, plugin)?.connections !== undefined;
/** Such a source with an account of the person's connected: what cx loses with it, a card says; with none, nothing is lost. */
export const connected = (held: Held, plugin: Plugin): boolean => (sourceOf(held, plugin)?.connections?.length ?? 0) > 0;
/**
 * A source on the person's own account at its supplier, connected by stores or by its own fields that one read checks: what cx loses
 * with it is a connection, never a purchase. Connected is a store saved, or its fields checked and the source on.
 */
export const ownAccount = (held: Held, plugin: Plugin): boolean => connects(held, plugin) || sourceOf(held, plugin)?.checksFields === true;
export const ownConnected = (held: Held, plugin: Plugin): boolean => connected(held, plugin) || (sourceOf(held, plugin)?.checksFields === true && sourceOf(held, plugin)?.enabled === true);
/**
 * A source the gate declares one that must be connected and that is not yet, by the gate's list alone, installed or not, whatever the
 * source is called: one that lists its connections and has none, or one whose own fields one read checks and that is not on. A key a
 * source takes only if the person wants to pay with their own account is no connection it must have.
 */
export const unconnected = (held: Held, plugin: Plugin): boolean => {
  const source = held.sources.find((one) => one.name === plugin.source?.name);
  if (source === undefined) return false;
  return source.connections !== undefined ? source.connections.length === 0 : source.checksFields === true && !source.enabled;
};
/** The same as `connects`, by the gate's list alone, installed or not: a source an install switches on by its own + at once. */
export const byStore = (held: Held, plugin: Plugin): boolean => held.sources.some((one) => one.name === plugin.source?.name && one.connections !== undefined);

/**
 * On is its model plugin's switch, or its package's and, where it sells a source, the gate's for that source: a package that is on
 * over a source the gate has off does nothing, and its switch is the one control that sets both. A source connected by store is the gate's alone.
 */
export function isOn(held: Held, plugin: Plugin): boolean {
  if (plugin.model !== undefined) return modelOf(held, plugin)?.enabled === true;
  const one = packageOf(held, plugin);
  return one !== undefined && one.enabled !== false && (plugin.source === undefined || connects(held, plugin) || sourceOf(held, plugin)?.enabled !== false);
}

/**
 * What a plugin's switch, its chip and its row in a list read: the money state where there is one — the gate's word for the source it
 * sells, the first thing a press on the switch changes — and otherwise whether it is on. A source the gate has on over a package cx's
 * computer has not turned on reads On, and the line under its head says what is unfinished.
 */
export function readsOn(held: Held, plugin: Plugin): boolean {
  const gate = plugin.model !== undefined ? undefined : sourceOf(held, plugin);
  return gate === undefined || gate.connections !== undefined ? isOn(held, plugin) : gate.enabled !== false;
}

/** Whether a plugin is the package a data source is built on, by the records: the channel, which buys from no source of its own. */
export const isBase = (held: Held, plugin: Plugin): boolean =>
  plugin.box !== undefined && held.catalogue.plugins.some((other) => other.source !== undefined && other.builds.some((one) => one.on === plugin.id && one.need === "required"));

const byIdIn = (held: Held) => (id: string): Plugin | undefined => pluginById(held, id);
/** What a plugin cannot work without, down the whole chain. */
export const requiredOf = (held: Held, plugin: Plugin): readonly Plugin[] => requiredWalk(byIdIn(held), plugin);
/** Plugins in the dependency's order, each after everything it builds on (`src/shared/plugin-builds.ts`). */
export const dependencyOrder = (held: Held, roots: readonly Plugin[]): readonly Plugin[] => orderWalk(byIdIn(held), roots);
/** Everything it builds on, required or optional, to the end of the chain: what its "Plugins it uses" lists, not what installs with it. */
export const buildsOnAll = (held: Held, plugin: Plugin): readonly Plugin[] => allWalk(byIdIn(held), plugin);
/** The plugins given and what each cannot work without, each once: what a press of them installs (`src/shared/plugin-builds.ts`). */
export const installsWith = (held: Held, plugins: readonly Plugin[]): readonly Plugin[] => installsWalk(byIdIn(held), plugins);
/**
 * What a plugin builds on: what it names itself, with no `via`, then everything those build on, each marked with the named plugin it
 * comes through and whether that one needs it or only uses it; required only where every link on the way is. Its page's plugins tab
 * lists the first alone; its remove card reads them all.
 */
export type Reached = { readonly plugin: Plugin; readonly need: "required" | "optional"; readonly via?: { readonly plugin: Plugin; readonly needs: boolean } };
export function reachedOf(held: Held, plugin: Plugin): readonly Reached[] {
  const direct = plugin.builds.flatMap((link): readonly Reached[] => { const on = pluginById(held, link.on); return on === undefined ? [] : [{ plugin: on, need: link.need }]; });
  const through = direct.flatMap((dep) => {
    const needed = new Set(requiredOf(held, dep.plugin).map((one) => one.id));
    return buildsOnAll(held, dep.plugin).map((one): Reached => ({ plugin: one, need: dep.need === "required" && needed.has(one.id) ? "required" : "optional", via: { plugin: dep.plugin, needs: needed.has(one.id) } }));
  });
  return [...direct, ...through.filter((one, at) => one.plugin.id !== plugin.id && !direct.some((dep) => dep.plugin.id === one.plugin.id) && through.findIndex((other) => other.plugin.id === one.plugin.id) === at)];
}

export const membersOf = (held: Held, item: Item): readonly Plugin[] => (isBundle(item) ? item.members.flatMap((id) => pluginById(held, id) ?? []) : [item]);
/**
 * Everything a bundle installs: its list and what each member cannot work without; a member's optional plugin only where the list names it.
 * This is what a bundle's plugin count counts, its Plugins tab lists, its installed state reads and its Remove takes.
 */
export const installsOf = (held: Held, bundle: Bundle): readonly Plugin[] => readOrder(held, bundle, installsWith(held, membersOf(held, bundle)));
/**
 * A bundle's plugins in the order a seller reads them, wherever they are listed: the plugin the set is for, then the data sources it
 * reads, then what a member needs, said beside it. Ties keep the bundle's own order.
 */
export function readOrder(held: Held, bundle: Bundle, plugins: readonly Plugin[]): readonly Plugin[] {
  const rank = (plugin: Plugin): number => (plugin.source !== undefined ? 1 : viaMember(held, bundle, plugin) !== undefined ? 2 : 0);
  return [...plugins].sort((a, b) => rank(a) - rank(b));
}
/** The packages on a bundle's list, which its press's one request names; the press installs beside them what each member requires, packages by their own clicks and models after (`installPlan`). A model plugin is never one. */
export const pressable = (held: Held, bundle: Bundle): readonly Plugin[] => membersOf(held, bundle).filter((plugin) => plugin.model === undefined && plugin.box !== undefined);
/** A bundle is installed when every package on its list is: nothing else holds one. */
export const holds = (held: Held, bundle: Bundle): boolean => { const members = pressable(held, bundle); return members.length > 0 && members.every((plugin) => installed(held, plugin)); };
/** The account's record of a bundle's presses, where it pressed the bundle and `/me` was read. */
export const pressOf = (held: Held, bundle: Bundle): HeldBundle | undefined => held.pressed?.find((one) => one.bundle === bundle.id);
/** The npm names whose last end the list keeps, by when it was heard, is a failed install. */
export function failedInstalls(ends: readonly ClickEnd[]): readonly string[] {
  const last = new Map<string, ClickEnd>();
  for (const end of ends) if ((last.get(end.source)?.at ?? -Infinity) <= end.at) last.set(end.source, end);
  return [...last.values()].flatMap((end) => (end.op === "install" && !end.ok ? [npmNameOf(end.source) ?? end.source] : []));
}
/**
 * Whether a bundle stands in Yours: from its press until its Remove or until none of what it installs is installed; and a bundle whose
 * list is all installed, however its plugins came. A failed press leaves the bundle as it stood before it, though the platform's row
 * keeps the record the press wrote: the bundle's first press (`since` is its `at`) that brought something, each install of which cx's
 * computer failed, leaves it out; a later press, failed or not, leaves it where its earlier press put it.
 */
export const inYours = (held: Held, bundle: Bundle): boolean => {
  if (holds(held, bundle)) return true;
  const press = pressOf(held, bundle);
  if (press === undefined || !installsOf(held, bundle).some((plugin) => installed(held, plugin))) return false;
  return !(press.since === press.at && press.brought.length > 0 && press.brought.every((name) => held.failedInstalls?.includes(name) === true));
};
/** The bundles in Yours a plugin came with: each one whose install brings it, as a member or as something a member builds on. */
export const cameWith = (held: Held, plugin: Plugin): readonly Bundle[] =>
  held.catalogue.bundles.filter((bundle) => inYours(held, bundle) && installsOf(held, bundle).some((one) => one.id === plugin.id));
/**
 * The bundles a plugin waiting in the queue came with: each `cameWith` names, and each whose recorded press brought its package, so a
 * bundle's rows carry its mark from the press, before any of what it installs has landed.
 */
export const pressedWith = (held: Held, plugin: Plugin, source: string): readonly Bundle[] =>
  held.catalogue.bundles.filter((bundle) => (inYours(held, bundle) || pressOf(held, bundle)?.brought.includes(npmNameOf(source) ?? source) === true) && installsOf(held, bundle).some((one) => one.id === plugin.id));
/** What a bundle in Yours installed that is switched off now: its page says so under its name, since the bundle itself has no switch. */
export const offIn = (held: Held, bundle: Bundle): readonly Plugin[] =>
  (inYours(held, bundle) ? installsOf(held, bundle).filter((plugin) => installed(held, plugin) && !isOn(held, plugin)) : []);
/** The model a bundle recommends: the first vendor on its list. */
export const recommendedIn = (held: Held, bundle: Bundle): Plugin | undefined => membersOf(held, bundle).find((plugin) => plugin.model !== undefined);
/** What a bundle in Yours lacks: anything it installs that is not installed, a member or what a member builds on. */
export const missingOf = (held: Held, bundle: Bundle): readonly Plugin[] => (inYours(held, bundle) ? pressable(held, bundle).filter((plugin) => !installed(held, plugin)) : []);
/**
 * The member a bundle installs a plugin for, and whether that member needs it or only uses it: another member that builds on it, where
 * one does, since a bundle's press installs with its list what each member requires.
 */
export function viaMember(held: Held, bundle: Bundle, plugin: Plugin): { readonly plugin: Plugin; readonly needs: boolean } | undefined {
  const member = membersOf(held, bundle).find((one) => one.id !== plugin.id && buildsOnAll(held, one).some((dep) => dep.id === plugin.id));
  return member === undefined ? undefined : { plugin: member, needs: requiredOf(held, member).some((dep) => dep.id === plugin.id) };
}

/**
 * Whether cx buys data through a plugin's source: one the gate's list prices. A source that costs nothing, such as one on the person's
 * own store, buys nothing, and while the list is unread or failed the page does not know, so it says nothing. The Paid mark and an
 * install card's Buys data say this one thing.
 */
export const buysData = (held: Held, plugin: Plugin): boolean => plugin.source !== undefined && held.sources.some((one) => one.name === plugin.source!.name && typeof one.unitsPerNative === "number");

/** The data sources an item reads: its own, and those of every plugin it builds on, optional ones too; a bundle's, its members'. */
export const sourcesOf = (held: Held, item: Item): readonly Plugin[] =>
  [...new Set(membersOf(held, item).flatMap((plugin) => [plugin, ...buildsOnAll(held, plugin)]))].filter((plugin) => plugin.source !== undefined);

/**
 * Every installed plugin that stops working when this one is turned off or removed: the users that are on and need it, along required
 * chains. One that is off already is not working, so no card names it.
 */
export const stopsIf = (held: Held, plugin: Plugin): readonly Plugin[] => usersOf(held, plugin).filter((user) => user.need === "required" && isOn(held, user.plugin)).map((user) => user.plugin);

/** Whether the chat is on one of a model plugin's models, so turning it off or removing it leaves cx unable to answer until another is chosen. */
export function chatOn(held: Held, plugin: Plugin): boolean {
  const current = held.served?.current;
  if (plugin.model === undefined || held.served === undefined || current === undefined) return false;
  return vendorModels(plugin, held.served).some((model) => model.provider === current.provider && model.id === current.id);
}

/**
 * The ways a vendor's plugin holds that pay today, in cx's order: the balance as stored; a subscription only where the account reads
 * signed in, a key only where the provider reads holding the person's own. A way waiting for sign-in is offered, not counted. Where a read
 * did not answer, the stored way stands: the page states nothing it could not read.
 */
export function connectedWays(held: Held, plugin: Plugin): readonly Way[] {
  const model = modelOf(held, plugin);
  if (plugin.model === undefined || model === undefined) return [];
  // pi holds one credential a provider, and the gate reads a key ahead of a sign-in there: a sign-in where a key is saved is not used.
  const keyed = (id: string): boolean => held.providers?.some((one) => one.id === id && one.ownKey) === true;
  return model.ways.filter((way) => way === "platform"
    || (way === "account" ? held.accounts === undefined || held.accounts.some((one) => plugin.model!.accounts.includes(one.id) && one.signedIn && !keyed(one.id))
      : held.providers === undefined || held.providers.some((one) => plugin.model!.keys.includes(one.id) && one.ownKey)));
}

/**
 * The connected ways that open a vendor's models on the account, in cx's order: every one for a member; for a trial, the balance only
 * where the models the platform serves the account hold one of the vendor's, since its proxy refuses the rest; a free account as a member.
 * A row's tags, the order's sentence, the Models tab and the prices all read this one rule; an account whose read did not answer, or a
 * trial whose served models were not read, is drawn as a member's.
 */
export function openingWays(held: Held, plugin: Plugin): readonly Way[] {
  const ways = connectedWays(held, plugin);
  return held.account === "trial" && !balanceServes(held, plugin) ? ways.filter((way) => way !== "platform") : ways;
}

/** Whether the models the platform serves the account hold one of a vendor's, as a member's do while that list is unread: what lets a trial's balance open it. */
export const balanceServes = (held: Held, plugin: Plugin): boolean => held.platformServed === undefined || held.platformServed.some((model) => makerOf(model.provider, model.id) === plugin.id);

/** Whether the balance pays for a model on this account, by the model's id: on a trial, only one the platform serves it, every one while that is unread; else every one. */
export const balancePays = (held: Held, id: string): boolean => held.account !== "trial" || held.platformServed === undefined || held.platformServed.some((one) => one.id === id);

/** Whether the account reaches a vendor's models at all: a member always, as before; a trial or a free account through an opening way. */
export const reaches = (held: Held, plugin: Plugin): boolean => held.account === undefined || held.account === "member" || openingWays(held, plugin).length > 0;

/**
 * Whether a vendor's page draws prices: where the balance is among the ways that open its models on the account, since that price is
 * what the balance takes. A trial's prices stand only where its balance opens the vendor; a vendor not installed, or one a free account
 * does not reach, keeps the balance's prices where the balance serves it, as what a member would pay.
 */
export const priced = (held: Held, plugin: Plugin): boolean =>
  held.account === "trial" || (installed(held, plugin) && reaches(held, plugin)) ? openingWays(held, plugin).includes("platform") : plugin.model?.ways.includes("platform") === true;

/**
 * The way that serves a version on the account: the first of the ways that open the vendor's models, in their order of use, that lists
 * it; none where none of them does. A version that names no ways is listed by every way.
 */
export const servingWay = (held: Held, plugin: Plugin, version: Pick<Version, "ways">): Way | undefined =>
  openingWays(held, plugin).find((way) => version.ways === undefined || version.ways.includes(way));

/**
 * A vendor's series by the way that serves the version each is on, in the order of use, the ways that serve none left out. One part where
 * the seller holds one way or every series is on the same one: the table is then drawn whole, with no part headed.
 */
export function byWay<S extends Pick<Series, "versions" | "pinned">>(held: Held, plugin: Plugin, series: readonly S[]): readonly { readonly way: Way; readonly series: readonly S[] }[] {
  const wayOf = (one: S): Way | undefined => { const version = versionInUse(one); return version === undefined ? undefined : servingWay(held, plugin, version); };
  return openingWays(held, plugin).map((way) => ({ way, series: series.filter((one) => wayOf(one) === way) })).filter((part) => part.series.length > 0);
}

/**
 * Whether a version's row shows the balance's price: where the balance serves it first (ruled 2026-10-27), since under a
 * subscription or a key the balance pays only once that way runs out; where no way opens the vendor on the account, wherever the balance
 * lists it, as what a member would pay.
 */
export const pricedFirst = (held: Held, plugin: Plugin, version: Pick<Version, "ways">): boolean => {
  const way = servingWay(held, plugin, version);
  return way === undefined ? version.ways === undefined || version.ways.includes("platform") : way === "platform";
};

/** Whether a table of these series draws the price column: the vendor's prices stand, and the balance serves first one of the versions it can show. */
export const priceColumn = (held: Held, plugin: Plugin, series: readonly Pick<Series, "versions">[]): boolean =>
  priced(held, plugin) && series.some((one) => one.versions.some((version) => pricedFirst(held, plugin, version)));

/**
 * The keys removing a model plugin deletes: those held at the maker's own providers.
 */
export const ownKeysOf = (held: Held, plugin: Plugin): readonly string[] =>
  (plugin.model?.keys ?? []).filter((provider) => keyProvidersOf(plugin.id).includes(provider) && held.providers?.some((one) => one.id === provider && one.ownKey) === true);

/** Whether a key the person saved is held for the plugin that removing it deletes: a source's own key, or a key at a model maker's own provider. */
export function keyHeld(held: Held, plugin: Plugin): boolean {
  if (plugin.source !== undefined) return sourceOf(held, plugin)?.ownKey?.held === true;
  return ownKeysOf(held, plugin).length > 0;
}

/** Whether the platform signs in to the vendor's subscription: it lists the account, signed in to or not. */
const signsIn = (plugin: Plugin, accounts: readonly Pick<Account, "id">[] | undefined): boolean =>
  accounts?.some((one) => plugin.model?.accounts.includes(one.id) === true) === true;

/**
 * The vendors a person holds where none is installed or removed: each one the platform serves, on, reached by the balance where a model
 * of its comes through the platform's key, by the person's own key where one is saved and by their subscription where they are signed in.
 * A model plugin no chat model is on, Jev, is held whether or not the box serves a chat model: the balance pays its one call, and its
 * record's keys say where the person's own key is read.
 */
export function servedVendors(catalogue: Catalogue, served: Models | undefined, providers: readonly Provider[] | undefined, accounts?: readonly Account[]): readonly ModelPlugin[] {
  return catalogue.plugins.flatMap((plugin): readonly ModelPlugin[] => {
    const models = vendorModels(plugin, served);
    const chatless = plugin.model?.chat === false;
    if (plugin.model === undefined || (!chatless && models.length === 0 && !signsIn(plugin, accounts))) return [];
    const key = providers?.some((one) => plugin.model!.keys.includes(one.id) && one.ownKey) === true;
    const account = accounts?.some((one) => plugin.model!.accounts.includes(one.id) && one.signedIn) === true;
    const platform = chatless ? plugin.model.ways.includes("platform") : models.some((model) => model.via === undefined);
    // The proxy pays from the person's key ahead of their subscription.
    return [{ id: plugin.id, enabled: true, ways: [...(platform ? ["platform" as const] : []), ...(key ? ["key" as const] : []), ...(account ? ["account" as const] : [])] }];
  });
}

/** A vendor serving no model today, where the read of what is served answered: its page says so once and sells nothing. */
export const idle = (held: Held, plugin: Plugin): boolean => plugin.model?.chat === true && held.served !== undefined && vendorModels(plugin, held.served).length === 0 && (held.series?.[plugin.id]?.length ?? 0) === 0;

/**
 * The name a way to a vendor is said under, wherever a sentence or a button names one: a subscription by the plans the catalogue gives
 * it, such as ChatGPT, and by the vendor's where it gives none; a key and the balance by the vendor's.
 */
/** A way's word: a sign-in is a subscription where the record names its plans, and a sign-in alone where it names none. */
export const wayWord = (plugin: Plugin, way: Way): StringKey => (way === "platform" ? "card.platform" : way === "account" && plugin.model?.subscription === undefined ? "pl.way.signIn" : `pl.way.${way}`);
/** Whose a way is in the order's sentence, by the same rule. */
export const whoWord = (plugin: Plugin, way: Way): StringKey => (way === "account" && plugin.model?.subscription === undefined ? "pl.who.signIn" : `pl.who.${way}`);

/**
 * What a sign-in is made to, as its press and its sentences say: a subscription sold as one plan by that plan (ChatGPT, Muse), one sold
 * as more by the maker (xAI, not "SuperGrok or X Premium"), and a sign-in with no plan by the maker.
 */
export const signInName = (plugin: Plugin, language: Language): string => {
  const plans = plugin.model?.subscription;
  return plans?.length === 1 ? plans[0]! : vendorIn(plugin, language);
};

/** The steps a vendor's package declares its sign-in card draws, each sentence in the page's language; none where it declares none. */
export const stepsIn = (plugin: Plugin, language: Language): readonly CardStep[] | undefined =>
  plugin.model?.signIn?.map((step) => (step.words === undefined ? { kind: step.kind } : { kind: step.kind, line: step.words[language] }));

export const wayName = (plugin: Plugin, way: Way, say: Say, language: Language, held?: Held): string => {
  const vendor = vendorIn(plugin, language);
  const plans = plugin.model?.subscription;
  if (way === "key" && held !== undefined) return keyDoor(held, plugin) ?? vendor;
  return way === "account" && plans !== undefined ? plansSaid(plans, say) : vendor;
};

/**
 * The provider whose key the key way pays with where that is not the maker's own first key, so a sentence names the door that holds it:
 * a maker's second, such as Moonshot AI's China key. The first of the card's keys the person holds, in the card's order.
 */
export function keyDoor(held: Held, plugin: Plugin): string | undefined {
  const keys = plugin.model?.keys ?? [];
  const holding = keys.find((provider) => held.providers?.some((one) => one.id === provider && one.ownKey) === true);
  if (holding === undefined || (holding === keys[0] && keyProvidersOf(plugin.id).includes(holding))) return undefined;
  return PROVIDERS[holding]?.name ?? holding;
}

/** Which way cx uses first and which takes over, for a model plugin that is on and connected: the one sentence a row, the Overview and Settings say. */
export function orderOf(held: Held, plugin: Plugin, say: Say, language: Language): string | undefined {
  const model = modelOf(held, plugin);
  const ways = openingWays(held, plugin);
  if (plugin.model === undefined || model === undefined || !model.enabled || ways.length === 0) return undefined;
  const [a, b, c] = ways.map((way) => say(whoWord(plugin, way), { vendor: wayName(plugin, way, say, language, held) }));
  return c !== undefined ? say("pl.order.more", { a: a!, b: b!, c }) : b !== undefined ? say("pl.order.two", { a: a!, b }) : say("pl.order.one", { a: a! });
}


/** A card's models among the ones the box serves: those whose card it is — a maker's through its own providers or the balance, a host's through the host's key. */
export function vendorModels(plugin: Plugin, models: Models | undefined): readonly Model[] {
  if (plugin.model === undefined) return [];
  return (models?.available ?? []).filter((model) => makerOf(model.provider, model.id) === plugin.id);
}

/**
 * Whether the page offers a plugin at all: a chat vendor the box serves no model of today is neither on Discover nor given a page, unless
 * it is held or the platform lists its series, which a person can install it for — or the balance does not reach it, as on a host's own
 * card, whose models the box serves only once the person's key there is held, which is entered on the card.
 */
export const shown = (held: Held, plugin: Plugin): boolean =>
  plugin.model?.chat !== true || held.served === undefined || installed(held, plugin) || vendorModels(plugin, held.served).length > 0 || (held.series?.[plugin.id]?.length ?? 0) > 0
  || !plugin.model.ways.includes("platform");

/** Discover's sections, and the filters that pick among them. Models come last: a new account already has its vendors. */
export type Shelf = "bundles" | Section;
export type Filter = "all" | "bundles" | "plugins";
export const FILTERS: readonly Filter[] = ["all", "bundles", "plugins"];
export const SHELVES: Readonly<Record<Filter, readonly Shelf[]>> = { all: ["bundles", "data", "extensions", "models"], bundles: ["bundles"], plugins: ["data", "extensions", "models"] };
export const PER_SHELF = 6;

/** What Discover offers on a shelf, in the catalogue's order: the official bundles, or the plugins of a section that are released. */
export function offered(held: Held, shelf: Shelf): readonly Item[] {
  return shelf === "bundles" ? held.catalogue.bundles.filter((bundle) => bundle.author === "ComChatX") : held.catalogue.plugins.filter((plugin) => plugin.section === shelf && plugin.own !== true && plugin.unreleased !== true && shown(held, plugin));
}
/** The bundle Discover's banner shows: the first one offered whose record names a drawing; none where no record names one. */
export function bannerOf(held: Held): Bundle | undefined {
  const bundles = offered(held, "bundles") as readonly Bundle[];
  return bundles.find((bundle) => bundle.art !== undefined);
}
/** Yours' shelves: Discover's, then the pi packages the person installed from anyone else, which ComChatX did not make: Pi plugins. */
export type YoursShelf = Shelf | "pi";
export const YOURS_SHELVES: Readonly<Record<Filter, readonly YoursShelf[]>> = { all: [...SHELVES.all, "pi"], bundles: SHELVES.bundles, plugins: [...SHELVES.plugins, "pi"] };
/** A package the person installed that no record takes and the image's old root did not carry: someone else's. */
/**
 * ComChatX's own: a record of the platform's catalogue, or a package by a name npm's `comchatx` organization holds (`isOurs`). A
 * package is never ours by the author it states of itself, which anyone can write; the organization says whose a package is, and the
 * gallery lists none of the organization's.
 */
export const madeByUs = (plugin: Plugin): boolean => plugin.own !== true && (plugin.npm === undefined ? plugin.author === "ComChatX" : isOurs(plugin.npm));
export const isThird = (plugin: Plugin): boolean => plugin.own === true && !(plugin.box?.source ?? "").startsWith(`${IMAGE_PACKAGE_ROOT}/`);
/**
 * What Yours holds on a shelf: the bundles held, the installed plugins of a section, or those someone else made. One someone else made
 * for ComChatX stands on the shelf its field declares, as on Discover; Pi plugins holds the rest of theirs.
 */
export function mine(held: Held, shelf: YoursShelf, queued: (item: Item) => boolean = () => false): readonly Item[] {
  if (shelf === "bundles") return held.catalogue.bundles.filter((bundle) => inYours(held, bundle) || queued(bundle));
  const onPi = (plugin: Plugin): boolean => isThird(plugin) && plugin.comchatx !== true;
  return held.catalogue.plugins.filter((plugin) => (shelf === "pi" ? onPi(plugin) : plugin.section === shelf && !onPi(plugin)) && (installed(held, plugin) || queued(plugin)));
}

/**
 * A list in the bar's order, the same for both of Discover's sections: most downloads last month, the newest version, or the name the
 * card shows, a scoped `@…` name first. What npm gives no figure or day for, a bundle, a model with no package or a package npm does not
 * hold, goes after, in the order it had.
 */
export function inOrder<T extends Item>(items: readonly T[], order: NpmOrder, language: Language): readonly T[] {
  const name = (item: Item): string => nameIn(item, language);
  const npm = (item: Item): Plugin["onNpm"] => (isBundle(item) ? undefined : item.onNpm);
  const by: (a: T, b: T) => number = order === "downloads" ? (a, b) => (npm(b)?.downloads ?? -1) - (npm(a)?.downloads ?? -1)
    : order === "recent" ? (a, b) => (Date.parse(npm(b)?.published ?? "") || 0) - (Date.parse(npm(a)?.published ?? "") || 0)
    : (a, b) => name(a).toLowerCase().localeCompare(name(b).toLowerCase(), "en") || name(a).localeCompare(name(b), "en");
  return [...items].sort(by);
}
/** Whether a package is of a kind, as pi gives it by its manifest: what is no package is of none. */
export const ofKind = (item: Item, kind: NpmKind | "all"): boolean => kind === "all" || (!isBundle(item) && (item.onNpm?.kinds ?? []).includes(kind));

/** Search reads what a card and its page already say, in the page's language: the name, the line, the description or README, the skills' names, the author, the vendor. */
export function said(item: Item, language: Language): string {
  const skills = !isBundle(item) && item.box !== undefined ? item.box.skills.map((skill) => skill.name) : [];
  const vendor = !isBundle(item) && item.model !== undefined ? [item.model.vendor, item.model.vendorZh].filter((one) => one !== undefined).join("\n") : undefined;
  // A package's page says its README, in the page's language where it ships one, else in English.
  const readme = !isBundle(item) ? item.box?.readme?.[language] ?? item.box?.readme?.en : undefined;
  return [item.name, item.nameZh, item.about[language], item.description?.[language], readme, ...skills, item.author, vendor].filter((one): one is string => one !== undefined).join("\n");
}
/** Words as a search reads them: a no-break space is a space, and a word joiner is nothing. */
const plain = (words: string): string => words.replace(/\u2060/g, "").replace(/\u00a0/g, " ").trim().toLowerCase();
export const matches = (item: Item, language: Language, sought: string): boolean => sought.trim() === "" || plain(said(item, language)).includes(plain(sought));

/**
 * `#/plugins` is Discover; `#/plugins/<discover|yours>/<filter>` a view and its filter, `…/discover/<filter>/<shelf>` one shelf
 * whole, `…/discover/shelf/<shelf>[/<order>]` one shelf whole in an order, `…/discover/<kind>/<order>` Discover with both its sections
 * of one kind in one order, and `#/plugins/yours/models` Yours
 * landed on its Models; `#/plugins/p/<id>[/<tab>]` a plugin's page and `#/plugins/b/<id>[/<tab>]` a bundle's;
 * `#/plugins/n/<npm name>[/<tab>]` an npm package's, installed or not.
 */
export type HomeRoute = { readonly kind: "home"; readonly view: "discover" | "yours"; readonly filter: Filter; readonly shelf?: Shelf; /** The shelf of Yours an address lands on, marked for a moment. */ readonly land?: "models"; readonly third?: Third };
/** The kind of package both of Discover's sections list, and the order both are in: the page's one bar. */
export type Third = { readonly kind: NpmKind | "all"; readonly order: NpmOrder };
export const THIRD: Third = { kind: "all", order: "downloads" };
/** The page where the chat's models are chosen, landing on one vendor's row where the address names it. */
export type ChatRoute = { readonly kind: "chat"; readonly land?: string };
export type Route = HomeRoute | ChatRoute | { readonly kind: "plugin" | "bundle"; readonly id: string; readonly tab?: string; /** The npm name of a package's page addressed by it. */ readonly npm?: string };

export function route(hash: string): Route | undefined {
  const parts = hash.replace(/^#/, "").split("?")[0]!.split("/").filter((part) => part !== "");
  if (parts[0] !== "plugins") return undefined;
  let named: string[];
  try { named = parts.slice(1).map((part) => decodeURIComponent(part)); } catch { return undefined; }
  const [a, b, c, d] = named;
  if (a === undefined) return { kind: "home", view: "discover", filter: "all" };
  // The addresses the accounts' list and the keys' list had land on the page itself.
  if (a === "models" && c === undefined) return b === undefined || b === "account" || b === "key" ? { kind: "chat" } : { kind: "chat", land: b };
  if (a === "discover" && (b === "all" || NPM_KINDS.some((one) => one === b)) && NPM_ORDERS.some((one) => one === c) && d === undefined) {
    return { kind: "home", view: "discover", filter: "all", third: { kind: b as Third["kind"], order: c as NpmOrder } };
  }
  if (a === "discover" && b === "shelf" && SHELVES.all.some((one) => one === c) && (d === undefined || NPM_ORDERS.some((one) => one === d)) && named.length <= 4) {
    return { kind: "home", view: "discover", filter: "all", shelf: c as Shelf, third: { kind: "all", order: (d ?? THIRD.order) as NpmOrder } };
  }
  if (a === "n" && b !== undefined) return { kind: "plugin", id: `${OWN}${b}`, npm: b, ...(c === undefined ? {} : { tab: c }) };
  if (a === "discover" || a === "yours") {
    const filter = FILTERS.find((one) => one === b) ?? "all";
    const shelf = a === "discover" ? SHELVES[filter].find((one) => one === c) : undefined;
    return { kind: "home", view: a, filter, ...(shelf === undefined ? {} : { shelf }), ...(a === "yours" && b === "models" ? { land: "models" as const } : {}) };
  }
  if ((a === "p" || a === "b") && b !== undefined) return { kind: a === "p" ? "plugin" : "bundle", id: b, ...(c === undefined ? {} : { tab: c }) };
  return undefined;
}

/**
 * A card stands over the page it was opened on, and the address names it after the page: `?card=<act>:<p|b>:<id>` for a plugin's or a
 * bundle's install, remove, enable and off, and `upload:t:-` for Create's upload. The name is the three parts as written; undefined where the
 * address names no card. `?q=<words>` beside it or alone is the search of Discover and Yours.
 */
export function cardOf(hash: string): string | undefined {
  const named = new URLSearchParams(hash.split("?")[1] ?? "").get("card");
  return named === null || named.split(":").length < 3 ? undefined : named;
}
/** The words an address searches the lists for, `?q=<words>` after the page; undefined where it names none. */
export const soughtOf = (hash: string): string | undefined => new URLSearchParams(hash.split("?")[1] ?? "").get("q") ?? undefined;
export const cardName = (act: "install" | "remove" | "enable" | "off" | "upload", kind: "p" | "b" | "t", id: string): string => `${act}:${kind}:${id}`;
/** The page an address is of, whatever stands over it. */
export const withoutCard = (hash: string): string => hash.split("?")[0] || "#/plugins";
export const withCard = (hash: string, card: string): string => `${withoutCard(hash)}?card=${card.split(":").map((part) => encodeURIComponent(part)).join(":")}`;

export const href = {
  /** What the account spent, plugin by plugin: the settings window's 用量. */
  spending: "#/settings/usage",
  /** The page where the chat's models are chosen. */
  models: "#/plugins/models",
  /** Where a trial or a free account becomes a member: the settings window's part that holds its membership. */
  membership: "#/settings/usage",
  home: (view: "discover" | "yours", filter: Filter = "all", shelf?: Shelf): string => `#/plugins/${view}/${filter}${shelf === undefined ? "" : `/${shelf}`}`,
  /** A package from npm is addressed by its name, whether installed or only listed, unless two installed packages state that name. */
  item: (item: Item): string => (!isBundle(item) && item.npm !== undefined && item.id === `${OWN}${item.npm}` ? href.npm(item.npm) : `#/plugins/${isBundle(item) ? "b" : "p"}/${encodeURIComponent(item.id)}`),
  /** A package from npm by its name alone, installed or only listed. */
  npm: (name: string): string => `#/plugins/n/${encodeURIComponent(name)}`,
  third: (third: Third): string => `#/plugins/discover/${third.kind}/${third.order}`,
  /** One of ComChatX's shelves whole, in the order the bar held. */
  shelf: (shelf: Shelf, order: NpmOrder): string => `#/plugins/discover/shelf/${shelf}${order === THIRD.order ? "" : `/${order}`}`,
};
/** Where the model card's More models lands: on the vendor's row of the page where the chat's models are chosen, else on that page. */
export const othersHref = (vendor: string | undefined, page: string | undefined): string =>
  (vendor === undefined || page === undefined ? href.models : `${href.models}/${page.slice(page.lastIndexOf("/") + 1)}`);

/**
 * What installing an item does, as the card stands: `flips` holds the rows whose switch the seller turned from where it starts, an optional
 * plugin on, a bundle's plugin off. The plugins it adds, required first; the sources it turns on; the paid ones left on afterwards, those it
 * turns on and those already on that the new plugins pay through; the sources that reach the person's own store once it is connected, which
 * buy nothing; the code not made by ComChatX; and the card's rows.
 */
export type InstallPlan = {
  readonly todo: readonly Plugin[];
  readonly buying: readonly Plugin[];
  readonly paying: readonly Plugin[];
  readonly stores: readonly Plugin[];
  readonly third: readonly Plugin[];
  readonly rows: readonly InstallRow[];
};
/**
 * A row of the install card (sheet 2d). `pressed` is the plugin itself, with no switch; `held` is installed already, ticked; `free` turns;
 * `locked` is one something in this install cannot work without, on, and `users` are those, directly. `optional` rows stand under 可选,
 * and `under` is one an optional plugin switched on brings, drawn beneath it.
 */
export type InstallRow = {
  readonly plugin: Plugin;
  readonly role: "pressed" | "held" | "free" | "locked";
  readonly on: boolean;
  readonly users: readonly Plugin[];
  readonly optional: boolean;
  readonly under: boolean;
};
const requires = (one: Plugin, plugin: Plugin): boolean => one.id !== plugin.id && one.builds.some((link) => link.on === plugin.id && link.need === "required");
export function installPlan(held: Held, item: Item, flips: ReadonlySet<string> = new Set()): InstallPlan {
  // Of models a bundle's press installs those its members build on that serve no chat, since a package that needs a model gets it
  // through the model plugin it names; a maker's card, listed or needed, stays the seller's to install.
  const pressed = (plugin: Plugin): boolean => !isBundle(item) || plugin.model === undefined || plugin.model.chat === false;
  const has = (plugin: Plugin): boolean => installed(held, plugin);
  // A bundle's rows are what it installs, each on until switched off; a plugin's are itself and its chain, then what it can use, each off until switched on.
  const brought = isBundle(item) ? installsWith(held, membersOf(held, item)).filter(pressed) : [];
  const listed = isBundle(item) ? readOrder(held, item, brought) : [];
  const required = isBundle(item) ? [] : installsWith(held, [item]).filter((plugin) => plugin.id !== item.id);
  const optional = isBundle(item) ? [] : item.builds.flatMap((link) => { const one = link.need === "optional" ? pluginById(held, link.on) : undefined; return one === undefined || required.includes(one) ? [] : [one]; });
  const roots = isBundle(item) ? brought.filter((plugin) => !has(plugin) && !flips.has(plugin.id)) : [item, ...optional.filter((plugin) => !has(plugin) && flips.has(plugin.id))];
  const takes = installsWith(held, roots);
  const ids = new Set(takes.map((plugin) => plugin.id));
  const usersIn = (plugin: Plugin): readonly Plugin[] => takes.filter((one) => requires(one, plugin));
  // A row turns while nothing else in this install cannot work without it.
  const free = (plugin: Plugin): boolean => !installsWith(held, roots.filter((one) => one.id !== plugin.id)).some((one) => one.id === plugin.id);
  const row = (plugin: Plugin, optional = false, under = false): InstallRow => {
    if (has(plugin)) return { plugin, role: "held", on: true, users: [], optional, under };
    const turns = (optional && !under) || (isBundle(item) && free(plugin));
    return { plugin, role: turns ? "free" : "locked", on: ids.has(plugin.id), users: turns ? [] : usersIn(plugin), optional, under };
  };
  const seen = new Set([...listed, ...required, ...optional].map((plugin) => plugin.id).concat(item.id));
  const rows = isBundle(item) ? listed.map((plugin) => row(plugin)) : [
    { plugin: item, role: "pressed" as const, on: true, users: [], optional: false, under: false }, ...required.map((plugin) => row(plugin)),
    ...optional.flatMap((plugin) => [row(plugin, true), ...(has(plugin) || !ids.has(plugin.id) ? [] : installsWith(held, [plugin]).filter((one) => !seen.has(one.id) && (seen.add(one.id), true)).map((one) => row(one, true, true)))]),
  ];
  const chain = dependencyOrder(held, roots).filter((plugin) => ids.has(plugin.id) && pressed(plugin));
  const todo = chain.filter((plugin) => !has(plugin));
  // A bundle's press installs what it lacks and switches nothing: a source of its that is off stays as the seller left it.
  const buying = chain.filter((plugin) => plugin.source !== undefined && !(has(plugin) && isOn(held, plugin)) && !(isBundle(item) && has(plugin)));
  const paying = chain.filter((plugin) => buysData(held, plugin) && (buying.includes(plugin) || (has(plugin) && isOn(held, plugin) && todo.length > 0)));
  const stores = buying.filter((plugin) => byStore(held, plugin));
  const third = todo.filter((plugin) => plugin.box !== undefined && !madeByUs(plugin));
  return { todo, buying, paying, stores, third, rows };
}
/**
 * The one rule a plugin's + and the card read: an install opens the card where anything but the plugin pressed would be installed, where
 * a plugin it can use is not installed, where it runs code ComChatX did not make, or where it turns a paid source on; else it happens at
 * once. A source reached by the person's own store buys nothing: SP-API alone installs at once. A bundle's set is what it installs, and
 * `cardFor` opens its card wherever that adds a plugin; with nothing to add, this rule reads the set as a plugin's +.
 */
export const quietInstall = (item: Item, plan: InstallPlan): boolean =>
  (isBundle(item) || plan.rows.every((row) => row.role === "pressed" || row.role === "held")) && plan.third.length === 0 && plan.buying.length === plan.stores.length;

/**
 * The one list of what uses a plugin, read by every card: each installed plugin whose chain reaches it, required where every link on
 * some way down is required, else optional.
 */
type User = { readonly plugin: Plugin; readonly need: "required" | "optional" };
export const usersOf = (held: Held, plugin: Plugin): readonly User[] =>
  held.catalogue.plugins.flatMap((other): readonly User[] => {
    if (other.id === plugin.id || !installed(held, other)) return [];
    if (requiredOf(held, other).some((one) => one.id === plugin.id)) return [{ plugin: other, need: "required" as const }];
    return buildsOnAll(held, other).some((one) => one.id === plugin.id) ? [{ plugin: other, need: "optional" as const }] : [];
  });

/**
 * What removing an item takes, as the card stands (sheet 2c, ruled 2026-11-17): with it go the plugins it requires that nothing else
 * installed requires, and theirs by the same rule, unless the seller switched one on (`flips`); a bundle's plugins count as what it
 * requires, and another bundle in Yours that installs one keeps it. An installed plugin that requires one that goes, directly or through
 * another, stays and is switched off.
 */
export type RemovePlan = {
  /** What goes, in the order it is removed: what builds on a plugin before the plugin. */
  readonly gone: readonly Plugin[];
  /** What stays installed and is switched off. */
  readonly off: readonly Plugin[];
  readonly rows: readonly RemoveRow[];
};
/**
 * A row of the remove card. Under 所需插件 (a bundle's 插件): `go`, removed with it, switch off; `kept`, the seller switched it on; `stay`,
 * still used by `users`, on and locked, which its mark names, a bundle's own plugin too. Under 受影响的插件: `off`, a plugin that cannot
 * work without `lost`, off and locked.
 */
export type RemoveRow = {
  readonly plugin: Plugin;
  readonly role: "go" | "kept" | "stay" | "off";
  /** What still needs the plugin once the removal is done, installed plugins and bundles in Yours: its holders. */
  readonly users: readonly (Plugin | Bundle)[];
  readonly lost?: Plugin;
};
export function removePlan(held: Held, item: Item, flips: ReadonlySet<string> = new Set()): RemovePlan {
  const has = (plugin: Plugin): boolean => installed(held, plugin);
  const members = isBundle(item) ? membersOf(held, item).filter(has) : [];
  const member = new Set(members.map((plugin) => plugin.id));
  const gone = new Map<string, Plugin>(isBundle(item) ? [] : [[item.id, item]]);
  const order: Plugin[] = [];
  const needsOf = (from: Plugin): readonly Plugin[] => from.builds.flatMap((link) => { const one = link.need === "required" ? pluginById(held, link.on) : undefined; return one === undefined || !has(one) ? [] : [one]; });
  // The account as the removal leaves it: what goes no longer installed and, on a bundle's own Remove, that bundle's presses gone with it.
  // What still holds a row is asked of it by the page's own rules.
  const after = (): Held => {
    const packs = new Set([...gone.values()].map((plugin) => packageOf(held, plugin)));
    const pressed = isBundle(item) ? held.pressed?.filter((one) => one.bundle !== item.id) : held.pressed;
    return { ...held, packages: held.packages.filter((one) => !packs.has(one)), models: held.models.filter((one) => !gone.has(one.id)), ...(pressed === undefined ? {} : { pressed }) };
  };
  const usersOfRow = (plugin: Plugin): readonly (Plugin | Bundle)[] => {
    const left = after();
    return [...held.catalogue.plugins.filter((one) => installed(left, one) && requires(one, plugin)),
      ...held.catalogue.bundles.filter((bundle) => bundle.id !== item.id && inYours(left, bundle) && installsOf(held, bundle).some((one) => one.id === plugin.id))];
  };
  for (let again = true; again;) {
    again = false;
    for (const plugin of [...members, ...[...gone.values()].flatMap(needsOf)]) {
      if (gone.has(plugin.id)) continue;
      if (!order.some((one) => one.id === plugin.id)) order.push(plugin);
      if (usersOfRow(plugin).length > 0 || flips.has(plugin.id)) continue;
      gone.set(plugin.id, plugin);
      again = true;
    }
  }
  const off = new Map<string, Plugin>();
  const short = (plugin: Plugin): Plugin | undefined => needsOf(plugin).find((one) => gone.has(one.id) || off.has(one.id));
  for (let again = true; again;) {
    again = false;
    for (const plugin of held.catalogue.plugins) if (has(plugin) && !gone.has(plugin.id) && !off.has(plugin.id) && short(plugin) !== undefined) { off.set(plugin.id, plugin); again = true; }
  }
  // A requirement only a plugin that stays brought in is no part of the removal.
  const live = order.filter((plugin) => !off.has(plugin.id) && (member.has(plugin.id) || [...gone.values()].some((from) => needsOf(from).some((one) => one.id === plugin.id))));
  const rows: readonly RemoveRow[] = [
    ...live.map((plugin): RemoveRow => { const users = usersOfRow(plugin); return { plugin, role: gone.has(plugin.id) ? "go" : users.length > 0 ? "stay" : "kept", users }; }),
    ...[...off.values()].map((plugin): RemoveRow => ({ plugin, role: "off", users: [], lost: short(plugin)! })),
  ];
  return { gone: [...dependencyOrder(held, [...gone.values()])].reverse().filter((plugin) => gone.has(plugin.id)), off: [...off.values()], rows };
}

/**
 * What a plugin that is installed and on needs from the person before it works: a model plugin with no way connected; else one line for
 * each plugin missing or off down its required chains, and a source connected by store that holds none. A plugin off, not installed, or whole says nothing.
 */
export type Needs = { readonly kind: "connect" } | { readonly kind: "gone" | "off"; readonly root: Plugin };
export function needsOf(held: Held, plugin: Plugin): readonly Needs[] {
  if (!installed(held, plugin) || !isOn(held, plugin)) return [];
  if (plugin.model !== undefined) return connectedWays(held, plugin).length === 0 ? [{ kind: "connect" }] : [];
  const lacking = lackingOf(held, plugin).map((root): Needs => ({ kind: installed(held, root) ? "off" : "gone", root }));
  return sourceOf(held, plugin)?.connections?.length === 0 ? [...lacking, { kind: "connect" }] : lacking;
}
/**
 * The first plugin missing or off down each required chain of an installed plugin. Below one the walk stops: installing it brings its
 * own chain, and turned on it says what it lacks itself.
 */
export function lackingOf(held: Held, plugin: Plugin, found = new Set<Plugin>(), walked = new Set<string>([plugin.id])): readonly Plugin[] {
  if (!installed(held, plugin)) return [];
  for (const link of plugin.builds) {
    if (link.need !== "required" || walked.has(link.on)) continue;
    walked.add(link.on);
    const next = pluginById(held, link.on);
    if (next === undefined) continue;
    if (!installed(held, next) || !isOn(held, next)) found.add(next); else lackingOf(held, next, found, walked);
  }
  return [...found];
}

/**
 * The packages that load on cx's computer by the platform's record: each the list holds and has on, its files there, with every click
 * still waiting played over it in order — an install or a switch on adds a source, a remove or a switch off takes it out — in the list's
 * order, a source new to it after it.
 */
export function standingSources(list: PackageList): readonly string[] {
  const on = new Map<string, boolean>(list.packages.map((one) => [one.source, one.enabled !== false && one.missing !== true]));
  for (const click of list.waiting ?? []) on.set(click.source, click.op === "install" || click.op === "on");
  return [...on].filter(([, loads]) => loads).map(([source]) => source);
}

/** The record whose package a listed source is, by the source a click on it names. */
const recordBySource = (held: Held, source: string): Plugin | undefined => held.catalogue.plugins.find((plugin) => plugin.box !== undefined && sourceFor(held, plugin) === source);

/** What cx can be asked by name from the given sources, as the catalogue names each source's skills: a source no record is of is left out. */
export const skillsFrom = (held: Held, sources: readonly string[]): readonly { readonly name: string; readonly source: string }[] =>
  sources.flatMap((source) => recordBySource(held, source)?.box?.skills.map((skill) => ({ name: `skill:${skill.name}`, source })) ?? []);

/** The catalogue's words for a skill of the package a source is, where a record is of that package and names the skill. */
export const skillWordsIn = (held: Held, source: string, name: string): Words | undefined =>
  recordBySource(held, source)?.box?.skills.find((skill) => skill.name === name)?.about;
