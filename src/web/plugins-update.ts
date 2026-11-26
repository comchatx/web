import type { Backend } from "./backend.js";
import { nameIn, type Plugin } from "./catalogue.js";
import { h, type Child } from "./dom.js";
import type { Doing } from "./plugins-doing.js";
import { dependencyOrder, sourceFor, updatable, type Held } from "./plugins-model.js";
import type { Language, StringKey } from "./strings.js";

type Say = (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;

/** What Update reads and does where it is drawn: the world, the words, the clicks under way, and the press itself. */
export type UpdateContext = {
  readonly held: Held;
  readonly say: Say;
  readonly language: Language;
  readonly list: (names: readonly string[]) => string;
  readonly doing: Doing;
  /** Updates the plugins, from the control at `at`, which keeps the keyboard through the press. */
  readonly update: (plugins: readonly Plugin[], at: string) => void;
  /** An update of the plugin waits in the queue: Update is not offered for it while it does. */
  readonly inQueue?: (plugin: Plugin) => boolean;
};
/** The installed plugins with a new version whose update is not in the queue. */
export const offered = (context: UpdateContext): readonly Plugin[] => updatable(context.held).filter((plugin) => context.inQueue?.(plugin) !== true);

/** The installed plugins with a new version whose Update nobody has pressed to ✓: what the reminder's dots are for. */
export const unasked = (held: Held, doing: Doing): readonly Plugin[] => updatable(held).filter((plugin) => !doing.updateAsked(plugin));

/** The reminder where a person looks for plugins: a dot, and its words for a screen reader. Nothing where nothing is left to press. */
export function newDot(say: Say, language: Language, held: Held, doing: Doing, inQueue: (plugin: Plugin) => boolean): readonly Child[] {
  const some = unasked(held, doing).filter((plugin) => !inQueue(plugin));
  if (some.length === 0) return [];
  const words = some.length === 1 ? say("pl.updateLine", { name: nameIn(some[0]!, language) }) : say("pl.updatesLine", { count: some.length });
  // Read after the name it stands by, as its own sentence: a comma before it reads as a stray one in the page's text.
  return [h("span", { class: "dot pl-new", "aria-hidden": "true" }), h("span", { class: "pl-sr" }, ` ${words}`)];
}

/**
 * Update's place: the ring while the click is written down, standing where Update was with the keyboard it had and its word's room;
 * else Update, its visible word alone and its name saying which plugins. Once written down the update is the queue's.
 */
function act(context: UpdateContext, plugins: readonly Plugin[], at: string, word: StringKey): HTMLElement {
  const { say } = context;
  const names = context.list(plugins.map((plugin) => nameIn(plugin, context.language)));
  if (plugins.some((plugin) => context.doing.busy(plugin)?.act === "update")) {
    return h("button", { type: "button", class: "pl-busy pl-hold", "aria-disabled": "true", "aria-busy": "true", "aria-label": say("pl.doing.updateName", { name: names }), "data-focus": at },
      h("span", { class: "pl-hold-word", "aria-hidden": "true" }, say(word)), h("span", { class: "pl-spin", "aria-hidden": "true" }));
  }
  const name = plugins.length === 1 ? { "aria-label": say("pl.updateName", { name: names }) } : {};
  return h("button", { type: "button", ...name, "data-focus": at, onclick: () => context.update(plugins, at) }, say(word));
}

/** A plugin's new version under its page's header: the header names it, so the line says only what is new. */
export function updateLine(context: UpdateContext, plugin: Plugin): HTMLElement | undefined {
  // By id: the page draws a record anew from the version it shows.
  if (!offered(context).some((one) => one.id === plugin.id)) return undefined;
  return h("div", { class: "pl-news", role: "status" }, h("span", {}, context.say("pl.updateHere")),
    h("span", { class: "pl-news-acts" }, act(context, [plugin], `update ${plugin.id}`, "pl.update")));
}

/**
 * A plugin's new version on its row in Yours, with nothing drawn under the row: Update at the row's end, after this month's spend and
 * left of the switch, its ring in its place. A failed update is the queue's row.
 */
export function rowUpdate(context: UpdateContext, plugin: Plugin): { readonly end: HTMLElement } | undefined {
  if (!offered(context).some((one) => one.id === plugin.id)) return undefined;
  return { end: h("span", { class: "pl-update-end" }, act(context, [plugin], `update ${plugin.id}`, "pl.update")) };
}

/** Atop Yours, where two or more plugins have a new version: how many, and Update all. One alone is said on its row. */
export function updatesLine(context: UpdateContext): HTMLElement | undefined {
  const some = offered(context);
  if (some.length < 2) return undefined;
  return h("div", { class: "pl-news pl-updates", role: "status" }, h("span", {}, context.say("pl.updatesLine", { count: some.length })),
    h("span", { class: "pl-news-acts" }, act(context, some, "update-all", "pl.updateAll")));
}

/**
 * Updates plugins as `pi update` updates a package, asking nothing: each one's warning was said at its install. Each is its own click on
 * its own record, in the order installs go, what a plugin builds on first: each is written down before the next is sent, so the
 * account's row keeps that order, and a sleeping computer keeps them all. None is waited for past its writing, since the queue says how
 * each stands. Answers whether any was written down. Each plugin is walked as `held` records it, so a link the world was given counts
 * on a plugin pressed as on one it builds on.
 */
export async function sendUpdates(backend: Backend, held: Held, doing: Doing, plugins: readonly Plugin[]): Promise<boolean> {
  let added = false;
  const asked = new Set(plugins.map((plugin) => plugin.id));
  const roots = plugins.map((plugin) => held.catalogue.plugins.find((one) => one.id === plugin.id) ?? plugin);
  for (const plugin of dependencyOrder(held, roots).filter((one) => asked.has(one.id))) {
    await doing.track({ item: plugin, act: "update" }, async () => { await backend.updatePackage(sourceFor(held, plugin)!); added = true; }).catch(() => undefined);
  }
  return added;
}
