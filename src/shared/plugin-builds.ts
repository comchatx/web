import { CARD_IDS } from "./model-makers.js";
import { isProviderPackage, PLUGIN_PROVIDERS } from "./provider-packages.js";

/**
 * What a plugin builds on, read once for the Plugins page and the platform alike: the links a package of ours names, and the walk down
 * them. The page's records and a new account's first packages are read by these functions, so a press and a first open install the same.
 */

export type Need = "required" | "optional";
export type Link = { readonly on: string; readonly need: Need };
/** The least a walk reads of a plugin: its id and what it builds on. */
export type Linked = { readonly id: string; readonly builds: readonly Link[] };
/** The least the reader reads of a package of ours as npm serves it: its name, the packages it depends on that are pi's, and its own field. */
export type OurPackage = { readonly name: string; readonly uses: readonly string[]; readonly comchatx?: Readonly<Record<string, unknown>> | undefined; readonly library?: true | undefined };

/**
 * Whether a package of ours stands on no record of its own: a provider's, which its maker's card stands for, or a library, whose manifest
 * carries no `pi` object. Nor is it a link a seller sees: a plugin depending on one is drawn without it, and npm installs it inside the plugin.
 */
export const onNoRecord = (pkg: Pick<OurPackage, "name" | "library">): boolean => isProviderPackage(pkg.name) || pkg.library === true;

/** The records that are no package, so a link names them by their id: Jev and each model plugin like it, and the makers' cards. */
export const NOT_PACKAGES: ReadonlySet<string> = new Set([...Object.values(PLUGIN_PROVIDERS), ...CARD_IDS]);
/** The model plugins a package can get its model through (decision D236): each `PLUGIN_PROVIDERS` names. */
export const MODEL_PLUGINS: ReadonlySet<string> = new Set(Object.values(PLUGIN_PROVIDERS));

const bareName = (name: string): string => name.replace(/^@[^/]+\//, "");
const said = (value: unknown): string | undefined => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined);

/** The id a package of ours goes by: its source's name where it is a data source, else its name without our scope. */
export function ourId(pkg: Pick<OurPackage, "name" | "comchatx">): string {
  const source = pkg.comchatx?.["source"];
  const name = typeof source === "object" && source !== null && !Array.isArray(source) ? said((source as Record<string, unknown>)["name"]) : undefined;
  return name ?? bareName(pkg.name);
}

/**
 * The id a package named by its npm name goes by among `ours`: one of ours by its id, a record that is no package by its own, and anyone
 * else's as `~` and its name; none for a package that stands on no record (`onNoRecord`), which is no link.
 */
export function idsOf(ours: readonly Pick<OurPackage, "name" | "comchatx" | "library">[], records: Iterable<string> = NOT_PACKAGES): (name: string) => string | undefined {
  const given = new Map(ours.map((pkg) => [pkg.name, pkg]));
  const known = new Set(records);
  return (name) => {
    const pkg = given.get(name);
    if (onNoRecord(pkg ?? { name })) return undefined;
    return pkg !== undefined ? ourId(pkg) : known.has(name) ? name : `~${name}`;
  };
}

/**
 * What a package of ours builds on: each package it depends on that is pi's, required, then each its `comchatx.builds` names that those
 * do not — a package by its npm name, as `uses` names one, or a record that is no package by its id — `required` where it says no need.
 * Each `builds` entry keeps what else it says (its `why`) for the page. A `builds` that does not read — not a list, an entry neither a
 * name nor a record, or a need neither word — gives nothing: the page then leaves the whole field out and draws the package from npm's
 * words alone, its dependencies alone standing (`buildsOf`).
 */
export function fieldBuilds(pkg: OurPackage, on: (name: string) => string | undefined): readonly (Link & Readonly<Record<string, unknown>>)[] | undefined {
  const plain = plainBuilds(pkg, on);
  const given = pkg.comchatx?.["builds"] ?? [];
  if (!Array.isArray(given)) return undefined;
  const named: (Link & Readonly<Record<string, unknown>>)[] = [];
  for (const one of given as readonly unknown[]) {
    const link = typeof one === "string" ? { on: one } : typeof one === "object" && one !== null && !Array.isArray(one) ? one as Record<string, unknown> : undefined;
    if (link === undefined) return undefined;
    if (typeof link["on"] !== "string") continue;
    const need = link["need"] ?? "required";
    if (need !== "required" && need !== "optional") return undefined;
    const id = NOT_PACKAGES.has(link["on"]) ? link["on"] : on(link["on"]);
    if (id === undefined || plain.some((link) => link.on === id) || named.some((link) => link.on === id)) continue;
    named.push({ ...link, on: id, need });
  }
  return [...plain, ...named];
}
/** What a package of ours builds on as the page draws it: `fieldBuilds`, or, where its `builds` does not read, its dependencies alone. */
export const buildsOf = (pkg: OurPackage, on: (name: string) => string | undefined): readonly Link[] => fieldBuilds(pkg, on) ?? plainBuilds(pkg, on);
const plainBuilds = (pkg: OurPackage, on: (name: string) => string | undefined): readonly Link[] =>
  pkg.uses.flatMap((name): Link[] => { const id = on(name); return id === undefined ? [] : [{ on: id, need: "required" }]; });

/** Each of ours as a walk reads it, and each record that is no package with nothing under it, by id. */
export function linkedOurs(ours: readonly OurPackage[]): (id: string) => Linked | undefined {
  const on = idsOf(ours);
  const byId = new Map<string, Linked>([...NOT_PACKAGES].map((id) => [id, { id, builds: [] }]));
  for (const pkg of ours) if (!byId.has(ourId(pkg))) byId.set(ourId(pkg), { id: ourId(pkg), builds: buildsOf(pkg, on) });
  return (id) => byId.get(id);
}

/** What a plugin builds on, down the whole chain, through the links `take` admits, each once, in the order first reached. */
export function walk<T extends Linked>(byId: (id: string) => T | undefined, plugin: T, take: (need: Need) => boolean, seen = new Set<string>()): readonly T[] {
  for (const link of plugin.builds) {
    if (!take(link.need) || seen.has(link.on) || link.on === plugin.id) continue;
    seen.add(link.on);
    const next = byId(link.on);
    if (next !== undefined) walk(byId, next, take, seen);
  }
  return [...seen].flatMap((id) => byId(id) ?? []);
}
/** What a plugin cannot work without, down the whole chain. */
export const requiredOf = <T extends Linked>(byId: (id: string) => T | undefined, plugin: T): readonly T[] => walk(byId, plugin, (need) => need === "required");
/** Everything it builds on, required or optional, to the end of the chain: what it uses, which is not what installs with it. */
export const buildsOnAll = <T extends Linked>(byId: (id: string) => T | undefined, plugin: T): readonly T[] => walk(byId, plugin, () => true);
/**
 * The plugins given and what each cannot work without, each once: what installs with them, by a press and at a new account's first open
 * alike. What a plugin can work without is offered, never installed unasked (ruled 2026-11-09).
 */
export const installsWith = <T extends Linked>(byId: (id: string) => T | undefined, plugins: readonly T[]): readonly T[] =>
  [...new Set(plugins.flatMap((plugin) => [plugin, ...requiredOf(byId, plugin)]))];

/**
 * Plugins in the dependency's order: each after everything it builds on, a post-order walk, so an install that stops partway never leaves
 * a plugin without what it needs. Removal reads it backwards: what builds on a plugin goes before it.
 */
export function dependencyOrder<T extends Linked>(byId: (id: string) => T | undefined, roots: readonly T[]): readonly T[] {
  const order: T[] = [];
  const seen = new Set<string>();
  const visit = (plugin: T): void => {
    if (seen.has(plugin.id)) return;
    seen.add(plugin.id);
    for (const link of plugin.builds) { const next = byId(link.on); if (next !== undefined) visit(next); }
    order.push(plugin);
  };
  roots.forEach(visit);
  return order;
}

/** The model plugins that install with the packages named, by npm name, among ours as their records read: what a press of them installs beside them. */
export function modelPluginsWith(ours: readonly OurPackage[], names: readonly string[]): readonly string[] {
  const byId = linkedOurs(ours);
  const on = idsOf(ours);
  const roots = names.flatMap((name) => { const id = on(name); return id === undefined ? [] : byId(id) ?? []; });
  return installsWith(byId, roots).flatMap((plugin) => (MODEL_PLUGINS.has(plugin.id) ? [plugin.id] : []));
}
