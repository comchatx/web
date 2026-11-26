import { CARD_PLACES } from "../shared/card-choices.js";
import { versionInUse, type Account, type Series } from "./backend.js";
import { nameIn, plansSaid, type Plugin } from "./catalogue.js";
import { h, type Child } from "./dom.js";
import { balanceServes, byWay, href, installed, modelOf, openingWays, type Held } from "./plugins-model.js";
import type { Language, StringKey } from "./strings.js";

/** What the chat's models page draws from and acts through: the held world, and the page that holds it. */
export type ChatView = {
  readonly held: Held;
  readonly language: Language;
  readonly say: (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;
  readonly tile: (plugin: Plugin) => HTMLElement;
  /** The vendors whose models are open under their row. */
  readonly open: ReadonlySet<string>;
  /** The vendor an address landed on, outlined for this one drawing. */
  readonly landed?: string | undefined;
  /** A vendor's series as its Models tab draws them: the line, the ticks, the versions and the credit. */
  readonly chooser: (plugin: Plugin, series: readonly Series[]) => HTMLElement;
  readonly toggle: (plugin: Plugin) => void;
  readonly add: (plugin: Plugin, series: readonly Series[]) => void;
  readonly takeOut: (plugin: Plugin) => void;
  /** A press as its operation is: turning while its write is out, under the key that names it, else as drawn. */
  readonly ring: (key: string, control: HTMLElement) => HTMLElement;
};

/** The model plugins installed, in the catalogue's order. */
const vendorsOf = (held: Held): readonly Plugin[] => held.catalogue.plugins.filter((plugin) => plugin.model?.chat === true && installed(held, plugin));
const off = (held: Held, plugin: Plugin): boolean => modelOf(held, plugin)?.enabled === false;
/**
 * The vendors holding chat's places, in the order their first series was ticked, as the record's one rule reads them (`places`): each
 * installed with a series ticked, turned off or on, reaching that series today or not.
 */
export function inChat(held: Held): readonly Plugin[] {
  const vendors = vendorsOf(held);
  return (held.chat ?? []).flatMap((id) => vendors.filter((plugin) => plugin.id === id));
}
/** The subscription whose sign-in ended, where none of the vendor's sign-ins is signed in now: said before whatever else it waits for. */
const endedSignIn = (held: Held, plugin: Plugin): Account | undefined => {
  const accounts = (held.accounts ?? []).filter((one) => plugin.model?.accounts.includes(one.id) === true);
  return accounts.some((one) => one.signedIn) ? undefined : accounts.find((one) => one.ended !== undefined);
};
/** The series a vendor's ways reach today; none while it is turned off or no way open to the account is connected. */
const reached = (held: Held, plugin: Plugin): readonly Series[] => (off(held, plugin) || openingWays(held, plugin).length === 0 ? [] : (held.series?.[plugin.id] ?? []).filter((one) => one.listed !== true));
/** The ticked series a vendor in chat puts in the chat's picker today, as its row here and its Overview list them. */
export const offeredInChat = (held: Held, plugin: Plugin): readonly Series[] => reached(held, plugin).filter((one) => one.inChat && one.versions.length > 0);
/**
 * A trial's vendor that only the balance pays for, where the platform serves the account none of its models, waits for membership, turned
 * off or idle alike, since no step on its own page would open its models; one the platform serves keeps its own explanation and remedy,
 * as `openingWays` opens it.
 */
const memberOnly = (held: Held, plugin: Plugin): boolean =>
  held.account === "trial" && !balanceServes(held, plugin) && plugin.model?.ways.every((way) => way === "platform") === true;
/**
 * The series Add to chat, a saved key and a finished sign-in tick, and the row below lists: the first of the grouped list (`seriesOf`), as
 * many as the card shows of a vendor's (ruled 2026-10-22), so a vendor of hundreds ticks its first five and one of a few ticks them all.
 */
export const firstFive = <S extends Series>(series: readonly S[]): readonly S[] => series.filter((one) => one.versions.length > 0).slice(0, CARD_PLACES);
export const toTick = (held: Held, plugin: Plugin): readonly Series[] => firstFive(reached(held, plugin));

/**
 * `#/plugins/models`: Default, which is always in chat; the vendors in chat, in their order, each with the models it puts there; and every
 * other installed model plugin, the ones that can be added first, each with what adding it would put in chat or what it waits for.
 */
export function chatPage(view: ChatView): readonly Child[] {
  const { held, say } = view;
  const chat = inChat(held);
  const rest = vendorsOf(held).filter((plugin) => !chat.includes(plugin));
  const full = chat.length >= CARD_PLACES;
  const addable = (plugin: Plugin): boolean => toTick(held, plugin).length > 0;
  const below = [...rest.filter(addable), ...rest.filter((plugin) => !addable(plugin))];
  return [
    h("h1", { tabindex: "-1", "data-focus": "heading" }, say("pl.mo.chooseVendors")),
    // Default's tag is the one the card under the message box draws on its Default row.
    h("ul", { class: "pl-list vc-default" }, h("li", {}, h("div", { class: "pl-row" },
      h("span", { class: "tile pl-logo vc-mark", "aria-hidden": "true" }),
      h("span", { class: "pl-row-text" }, h("span", { class: "pl-row-name" }, h("strong", {}, say("card.default")), h("span", { class: "pl-tag" }, say("card.platform"))), h("span", { class: "quiet" }, say("card.bestValue"))),
      h("span", { class: "pl-go" }, say("chat.always"))))),
    h("section", { class: "pl-shelf", "aria-labelledby": "vc-in" },
      h("div", { class: "pl-shelf-head" }, h("h2", { id: "vc-in" }, say("chat.inChat"), h("span", { class: "count" }, say("chat.places", { n: chat.length, max: CARD_PLACES })))),
      chat.length === 0 ? h("p", { class: "quiet vc-alone", tabindex: "-1", "data-focus": "empty" }, say("chat.empty"))
        : h("ol", { class: "pl-list" }, ...chat.map((plugin) => chatRow(view, plugin)))),
    h("section", { class: "pl-shelf", "aria-labelledby": "vc-add" },
      h("div", { class: "pl-shelf-head" }, h("h2", { id: "vc-add" }, say("chat.notInChat"))),
      full && below.length > 0 && h("p", { class: "pl-fact", tabindex: "-1", "data-focus": "full" }, say("card.full", { count: CARD_PLACES })),
      vendorsOf(held).length === 0 ? h("p", { class: "quiet vc-alone" }, say("chat.bare")) : below.length > 0 && h("ul", { class: "pl-list" }, ...below.map((plugin) => addRow(view, plugin, full))),
      h("p", { class: "vc-more" }, h("a", { class: "pl-inline", href: href.home("discover", "all", "models") }, say("chat.moreVendors")))),
  ];
}

const named = (view: Pick<ChatView, "say">, act: string, name: string): string => view.say("chat.named", { act, name });
/** Names as a row lists them, the models a vendor puts in chat. */
const joined = (view: ChatView, names: readonly string[]): string => names.join(view.language === "zh" ? "、" : ", ");
const rowName = (view: ChatView, plugin: Plugin, tag: string | false): HTMLElement =>
  h("span", { class: "pl-row-name" }, h("strong", {}, h("a", { class: "vc-name", href: href.item(plugin), "data-focus": `name ${plugin.id}` }, nameIn(plugin, view.language))),
    tag !== false && h("span", { class: "pl-tag" }, tag), off(view.held, plugin) && h("span", { class: "pl-chip" }, view.say("pl.off")));
/** Set up ›: to a turned-off vendor's page, where its switch is, or to the Settings tab of one with no way connected. */
const setUp = (view: Pick<ChatView, "say" | "language">, plugin: Plugin, to: string): HTMLElement =>
  h("a", { class: "button", href: to, "aria-label": named(view, view.say("chat.setUp"), nameIn(plugin, view.language)), "data-focus": `setup ${plugin.id}` }, view.say("pl.mo.connect"));
/**
 * A row's tag: the way that serves the series it lists, and none where more than one way serves them, so a vendor on several ways never
 * reads as billed to one (ruled 2026-10-27).
 */
const tagOf = (view: ChatView, plugin: Plugin, listed: readonly Series[]): string | false => {
  const parts = byWay(view.held, plugin, listed);
  const way = parts.length === 1 ? parts[0]!.way : undefined;
  return way === undefined ? false : view.say(way === "platform" ? "card.platform" : way === "key" ? "card.key" : "card.account");
};

/** What a vendor in chat that puts no model there waits for, as its row here says it: its Overview says the same. */
export const waitsInChat = (view: Pick<ChatView, "held" | "say" | "language">, plugin: Plugin): string => waiting(view, plugin, true).line;
/**
 * What a vendor with no models to offer waits for: membership, to be turned on, a sign-in made again, a way to connect open to the
 * account, or a day it serves something.
 */
function waiting(view: Pick<ChatView, "held" | "say" | "language">, plugin: Plugin, inChatNow: boolean): { readonly line: string; readonly go?: HTMLElement } {
  const { held, say } = view;
  if (memberOnly(held, plugin)) return { line: say(inChatNow ? "chat.memberInChat" : "chat.memberAdd") };
  if (off(held, plugin)) return { line: say(inChatNow ? "chat.offInChat" : "chat.offAdd"), go: setUp(view, plugin, href.item(plugin)) };
  const ended = inChatNow ? endedSignIn(held, plugin) : undefined;
  if (ended !== undefined) {
    // The subscription by the name its seller knows it by, as the vendor's Settings names it.
    const plans = plugin.model?.subscription;
    const name = plans === undefined ? ended.name : plansSaid(plans, say);
    return { line: say("chat.endedRow", { name }), go: h("a", { class: "button", href: `${href.item(plugin)}/settings`, "aria-label": named(view, say("chat.signInAgain"), name), "data-focus": `again ${plugin.id}` }, say("chat.signInAgain")) };
  }
  if (openingWays(held, plugin).length === 0) {
    const served = plugin.model?.ways.includes("platform") === true;
    return { line: say(served ? (inChatNow ? "chat.wayInChat" : "chat.wayAdd") : inChatNow ? "chat.ownInChat" : "chat.ownAdd"), go: setUp(view, plugin, `${href.item(plugin)}/settings`) };
  }
  return { line: say("pl.mo.idle") };
}

/**
 * A vendor in chat: the way that opens its models, the models it puts in chat, each as the version it is on now, and the two things done
 * to it here. A vendor with nothing to choose says what it waits for, with the press that leads there.
 */
function chatRow(view: ChatView, plugin: Plugin): HTMLElement {
  const { held, say } = view;
  const series = reached(held, plugin).filter((one) => one.versions.length > 0);
  const ticked = series.filter((one) => one.inChat).map((one) => versionInUse(one)!.name);
  const open = view.open.has(plugin.id) && series.length > 0;
  const wait = series.length > 0 ? undefined : waiting(view, plugin, true);
  const line = wait?.line ?? (ticked.length > 0 ? joined(view, ticked) : undefined);
  const acts: readonly Child[] = [
    series.length > 0 && h("button", { type: "button", class: "vc-choose", "aria-expanded": String(open), "aria-controls": open ? `choose-${plugin.id}` : undefined,
      "aria-label": named(view, say("chat.choose"), nameIn(plugin, view.language)), "data-focus": `choose ${plugin.id}`, onclick: () => view.toggle(plugin) },
      say("chat.choose"), h("span", { class: "pl-caret", "aria-hidden": "true" }, open ? "▴" : "▾")),
    wait?.go ?? false,
    view.ring(`chat-out ${plugin.id}`, h("button", { type: "button", "aria-label": named(view, say("chat.takeOut"), nameIn(plugin, view.language)), "data-focus": `out ${plugin.id}`, onclick: () => view.takeOut(plugin) }, say("chat.takeOut"))),
  ];
  return h("li", { "data-vendor": plugin.id, class: view.landed === plugin.id ? "vc-landed" : undefined },
    h("div", { class: "pl-row pl-way-row" }, view.tile(plugin),
      h("span", { class: "pl-row-text" }, rowName(view, plugin, series.length > 0 && tagOf(view, plugin, series.filter((one) => one.inChat))), line !== undefined && h("span", { class: "quiet" }, line)),
      h("span", { class: "pl-way-act" }, ...acts)),
    open && h("div", { class: "vc-chooser", id: `choose-${plugin.id}` }, view.chooser(plugin, reached(held, plugin))));
}

/**
 * A vendor installed and not in chat: the models Add to chat would put there, or what it waits for. With chat full, a vendor that could be
 * added reads Chat is full where its press stood.
 */
function addRow(view: ChatView, plugin: Plugin, full: boolean): HTMLElement {
  const { held, say } = view;
  const series = toTick(held, plugin);
  const wait = series.length > 0 ? undefined : waiting(view, plugin, false);
  const line = wait?.line ?? joined(view, series.flatMap((one) => versionInUse(one)?.name ?? []));
  const act = wait !== undefined ? wait.go
    : full ? h("span", { class: "quiet" }, say("chat.fullRow"))
    : view.ring(`chat-add ${plugin.id}`, h("button", { type: "button", "aria-label": named(view, say("pl.news.add"), nameIn(plugin, view.language)), "data-focus": `add ${plugin.id}`, onclick: () => view.add(plugin, series) }, say("pl.news.add")));
  return h("li", { "data-vendor": plugin.id, class: view.landed === plugin.id ? "vc-landed" : undefined },
    h("div", { class: "pl-row pl-way-row" }, view.tile(plugin),
      h("span", { class: "pl-row-text" }, rowName(view, plugin, series.length > 0 && tagOf(view, plugin, series)), h("span", { class: "quiet" }, line)),
      act !== undefined && h("span", { class: "pl-way-act" }, act)));
}

