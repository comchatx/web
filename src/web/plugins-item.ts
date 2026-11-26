import type { RowHead } from "./plugins-queue.js";
import { linked, OFFER } from "./box-words.js";
import { FIRST_PAIR, MONEY_AS, SignInEnded, formatShown, formatTotal, refusalOf, type ConnectionCheck, type FieldsCheck, type SourcePair, type Features, type StoreConnection, type GrantAccount, type Words, type Account, type Backend, type Model, type Models, type Provider, type Series, type Source, type Version, versionInUse, type NpmPackage } from "./backend.js";
import type { Money } from "../shared/money.js";
import { nameIn, ourShippedBox, vendorIn, type Bundle, type Plugin, type Prompt, type SourceLine, type Way } from "./catalogue.js";
import { fill, h, placed, refocus, svg, type Child } from "./dom.js";
import { byMaker, finds, foundVersions, ofMakers, sought } from "./model-search.js";
import { LINES } from "./plugin-marks.js";
import type { TickRefused } from "./chat-card.js";
import { shapeOf, signInCard, type SignInCard } from "./sign-in-card.js";
import { badDomain, makesKey, stopsAt, type SignInStep } from "../shared/sign-in.js";
import { CARD_PLACES } from "../shared/card-choices.js";
import { PROVIDERS } from "../shared/model-makers.js";
import { isBundle, unconnected, byWay, priceColumn, pricedFirst, servingWay, connectedWays, connects, keyDoor, isBase, href, idle, madeByUs, vendorModels, wayName, wayWord, signInName, stepsIn, filesMissing, installed, installsOf, isThird, holds, inYours, needsOf, membersOf, missingOf, modelOf, offIn, orderOf, sourcesOf, reachedOf, readsOn, shippedOf, sourceFor, sourceOf, withPackage, type Held, type Item, balancePays, priced, reaches } from "./plugins-model.js";
import { bar, block, skeleton, spinner, Waits } from "./waiting.js";
import { out, outLinks, pageLinks, type OutLink } from "./plugins-card.js";
import { httpsAddress } from "../shared/https-address.js";
import { again, cardFor, factLine, failureLine, install, needAgainPlace, needPlace, needsLine, remove, turnOff, turnOn, type CardContext } from "./plugins-cards.js";
import { endSaid, switching, type About, type Busy, type Doing, type Failed } from "./plugins-doing.js";
import { readmeHtml } from "./markdown.js";
import { rowUpdate } from "./plugins-update.js";
import { switchButton, tip, type Menu } from "./forms.js";
import { iconAct, moreMenu, rowIcon } from "./plugins-row.js";
import { cancelPlace, retryPlace, type QueueRow } from "./plugins-queue.js";
import { authored, downloadsWord, galleryPlugin, langOf, npmFacts, npmPageOf, thirdMark } from "./plugins-npm.js";
import { UNREAD } from "../shared/shipped.js";
import { chatPage, firstFive, inChat, offeredInChat, waitsInChat } from "./chat-page.js";
import { FEISHU_HOOK_PREFIX, FEISHU_PACKAGE, readFeishuHook } from "../shared/feishu.js";
import type { DialogAnswer } from "../shared/dialog.js";
import type { Language, StringKey } from "./strings.js";

/**
 * What record pages read of npm by name, kept by the page that holds them so a page opened anew, as each tab is, draws at once: a
 * package of ours asked again at its record's version (`<name>@<version>`), and npm's words for a plugin a package uses that the
 * catalogue holds no record of.
 */
export type KeptReads = { readonly ours: Map<string, NpmPackage>; readonly uses: Map<string, Plugin> };
/** A package of ours read whole is settled; one npm answered with a part unread is drawn as it is and asked again at the next opening. */
const settledOurs = (kept: KeptReads, key: string): boolean => kept.ours.get(key)?.shipped.unread.length === 0;

/** What a record's page reads and does, given by the page that holds it. */
export type ItemContext = {
  readonly held: Held;
  /** What stands in ✓'s place while an install of the record waits in the queue or runs: the ring that stands still going to its row, or the ring that turns. */
  readonly queued?: (item: Item) => HTMLElement | undefined;
  /** The queue's failed row of a plugin's install or update, with its two presses, which the head draws where its button stood. */
  readonly failedRow?: (plugin: Plugin) => FailedRow | undefined;
  /** An update of the plugin waits in the queue: its page offers no Update while it does. */
  readonly inQueue?: (plugin: Plugin) => boolean;
  /** The page's reads of npm by name; a page given none keeps its own. */
  readonly kept?: KeptReads;
  /** A read of what the person holds failed: the page then states nothing about what is held. */
  readonly unread: boolean;
  /** Why it is not known, as the Plugins page says it, and whether a read that failed is offered again; absent, the read failed. */
  readonly unreadSaid?: { readonly key: StringKey; readonly retry: boolean } | undefined;
  readonly backend: Backend;
  /** Where a card opens; the document's body unless a test gives another. */
  readonly cards?: (() => HTMLElement) | undefined;
  readonly language: Language;
  readonly money: Money | undefined;
  /** Whether the person said "Don't show again" to the rule cx buys by, and the press that says it. */
  readonly ruleSeen?: () => boolean;
  readonly seeRule?: () => void;
  /** The person's balance, drawn as money, where `/me` gave one: the cards that start a payment name it. */
  readonly balance?: string;
  readonly say: (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;
  /** Puts words in the composer, with a stretch of them selected where one is given; the person sends them, or does not. */
  readonly ask: (words: string, select?: readonly [number, number]) => void;
  /** Reads the held world again and redraws. */
  readonly reload: () => Promise<void>;
  /** Lists a list of names as the language joins them. */
  readonly list: (names: readonly string[]) => string;
  /** A plugin's row as Yours draws it, for the lists on a record's page. */
  readonly row: (plugin: Plugin) => HTMLElement;
  readonly tile: (item: Plugin | Bundle, big?: boolean) => HTMLElement;
  /** A plugin's row head as 我的 draws it, for the cards' rows. */
  readonly head?: (plugin: Plugin) => RowHead;
  /** After a removal: goes to Yours, where every removal lands, and says `words` there unless they are empty. */
  readonly land?: (words: string) => void;
  /** Says what happened where the seller is now, for a result that arrives after they left this page. */
  /** Says words once where the seller is; `about` is a click that failed, said over the world as it left it, and `failed` that the words report a failure. */
  readonly tell?: (words: string, about?: About, failed?: boolean) => void;
  /** Tells a screen reader alone, through the page's one unseen status region, a fact the page itself shows. */
  readonly announce?: (words: string) => void;
  /** Where the back link goes, and the name of that page. */
  readonly back: { readonly href: string; readonly name: string };
  /** The clicks out and the ones that failed, which the page that holds this one keeps for every drawing of a record. */
  readonly doing: Doing;
  /** Updates plugins to npm's newest, from the control at `at`; absent where the page offers no Update. */
  readonly update?: (plugins: readonly Plugin[], at: string) => void;
  /** What the platform offers of the page: a tab or a control with no route behind it is not drawn. */
  readonly features: Pick<Features, "sourceSettings" | "sourceKeys" | "modelPlugins">;
  /** Waits for the clicks the platform wrote down to end, as the list says they did. */
  readonly ended: CardContext["ended"];
  /** Where a person asks for help, offered from a click's second failure. */
  readonly help: string;
  /** The series whose versions are unfolded, each by its plugin and its name: the view of whoever holds the page, so it outlives a tab change. */
  readonly openSeries: Set<string>;
  /** The vendors whose models are open under their row on the chat's models page: the view's, so they outlive its addresses and a visit to a vendor's page. */
  readonly chatOpen: Set<string>;
};

/** What a model plugin's page reads beyond the held world, each on its own: a read that fails leaves only its own part empty. */
type ModelReads = { readonly models?: Models; readonly providers: readonly Provider[]; readonly accounts: readonly Account[] };
/**
 * The form of a source's own fields: what is typed, field by field and never read back, whether its check is being asked, and what the
 * last save came to: a field the gate refused, the supplier's refusal, or the note that says what to fix.
 */
type FieldsForm = {
  readonly source: string;
  readonly values: Record<string, string>;
  checking: boolean;
  refusal?: { readonly field?: string; readonly words: string } | undefined;
  note?: string | undefined;
};
/**
 * A paired source's form, where it stands: `first` with no pair held, `new` below the last pair, else under the pair it names. It asks the
 * pair's fields and a refresh token where it adds a pair, the token alone under one; it keeps what was typed across draws.
 */
type PairForm = {
  readonly source: string;
  readonly at: string;
  readonly values: Record<string, string>;
  checking: boolean;
  refusal?: string | undefined;
  none?: boolean;
  note?: string | undefined;
};
/** The line over a plugin's Settings before it is installed, which each control it disables is described by. */
const AFTER_INSTALL = "pl-after-install";
/** What a seller fills, chooses or presses, by its tag. */
const CONTROLS: ReadonlySet<string> = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);

/** What a package ships to say of itself, read for a plugin the person installed themselves: its text, or why there is none to draw. */
type OwnWords = { readonly text: string } | { readonly none: "absent" | "large" | "unread" };
/** What npm said of a package's page: the package, that it does not have it, or nothing, since it did not answer. */
/** npm's answer for a package's page: the package, a name it does not have, npm not answering, or a read that failed before npm was asked. */
export type FailedRow = { readonly row: QueueRow; readonly retry: () => void; readonly cancel: () => void };
type NpmRead = { readonly name: string; readonly read: NpmPackage | "unknown" | "unreachable" | "unread" };

/**
 * One way to a maker as Settings and the Overview draw it: the balance, or a key or a sign-in at one of the maker's own providers. `place`
 * is the row's address, the first of each kind keeping the kind's own.
 */
type Door = { readonly way: Way; readonly provider?: string; readonly on: boolean; readonly place: string };

/** The one sign-in under way on a vendor's Settings, kept across draws so the card keeps what was typed; `stop` ends it. */
type SignInAt = { readonly account: string; readonly stop: AbortController; card: SignInCard };
/** The card opens with the sign-in's first step: until then the row's press waits. */
const stepped = (at: SignInAt | undefined): at is SignInAt => at !== undefined && (at.card.link !== undefined || at.card.ask !== undefined);
/** How the last sign-in at an account ended without success, said under its row until another begins. */
type LastWord = { readonly account: string; readonly reason: SignInEnded["reason"]; readonly words?: string; readonly minutes?: number };

/** The page the seller is on, whatever card stands over it: an answer that finds them elsewhere is said where they are. */
/** The address the seller is at, without its query: a click's end that finds another one here is said where they are. */
export const here = (): string | undefined => globalThis.location?.hash?.split("?")[0];

export type Tab = "overview" | "models" | "deps" | "settings" | "interface" | "plugins";

/** A plugin's tabs: one per part it has, never one per kind of plugin. */
/**
 * A tab that takes the keyboard is scrolled into its bar, which scrolls sideways on a narrow window: the bar is drawn anew on a redraw,
 * from its start, and the focus put back on it does not scroll it. Only the bar moves, never the page.
 */
export function tabInView(event: Event): void {
  const tab = event.target as HTMLElement, bar = event.currentTarget as HTMLElement;
  const at = tab.getBoundingClientRect(), edge = bar.getBoundingClientRect();
  if (at.left < edge.left) bar.scrollLeft -= edge.left - at.left;
  else if (at.right > edge.right) bar.scrollLeft += at.right - edge.right;
}
export function tabsOf(plugin: Plugin, held?: Held, features: Pick<Features, "sourceSettings" | "sourceKeys" | "modelPlugins"> = { sourceSettings: true, sourceKeys: true, modelPlugins: true }): readonly Tab[] {
  const tabs: Tab[] = ["overview"];
  // A trial or a free account has a vendor's Models tab only where one of its ways opens the vendor's models (§2.6).
  if (plugin.model?.chat === true && (held === undefined || (!idle(held, plugin) && reaches(held, plugin)))) tabs.push("models");
  if (plugin.builds.length > 0) tabs.push("deps");
  // A source's Settings are its stores or its own fields, or its key: a tab only where the platform has what it draws, and it
  // stays before the source is installed and after it is removed, as a vendor's do where vendors are installed.
  const has = held === undefined || installed(held, plugin);
  const stores = held === undefined || held.sources.some((one) => one.name === plugin.source?.name && (one.connections !== undefined || one.checksFields === true));
  if (plugin.model !== undefined ? has || features.modelPlugins : plugin.source !== undefined && features.sourceSettings && (features.sourceKeys || stores)) tabs.push("settings");
  // cx-feishu's Settings hold the bot it posts to, drawn before it is installed as after.
  if (plugin.box?.package === FEISHU_PACKAGE) tabs.push("settings");
  if (plugin.page !== undefined) tabs.push("interface");
  return tabs;
}

/** The plugins a plugin names itself, which its 配套插件 tab lists and counts (sheet 3): not those they build on in turn. */
const directOf = (held: Held, plugin: Plugin): ReturnType<typeof reachedOf> => reachedOf(held, plugin).filter((one) => one.via === undefined);

const DAY = 86_400;
/** A count as "about" reads it: two significant figures. */
export const roughly = (n: number): number => { if (n < 100) return Math.floor(n); const scale = 10 ** (Math.floor(Math.log10(n)) - 1); return Math.floor(n / scale) * scale; };
/** How long the typing in a search over a host's series stops before what it found is said. */
const FOUND_AFTER_MS = 600;
const searchMark = (): SVGSVGElement => svg("svg", { viewBox: "0 0 24 24", class: "pl-icon", "aria-hidden": "true" }, svg("path", { d: LINES["search"]! }));

/**
 * A source's price in the unit it sells, as a person reads it: per unit where that is a cent or more, else per thousand of them, a
 * thousand more each step with no ceiling, until it is (Keepa's per 1,000 tokens); none for a source that costs nothing.
 */
export function unitPrice(source: Pick<Source, "unitsPerNative" | "nativeUnit">, money: Money): string {
  const units = source.unitsPerNative;
  if (units === undefined) return "";
  // A price of nothing is said as nothing per unit; any other is scaled until a cent shows, however small, so none reads as $0.
  if (units <= 0) return `${formatShownAt(0, money)}/${source.nativeUnit.replace(/s$/, "")}`;
  let per = 1;
  while (units * per / money.unitsPerMinor / 100 < 0.01) per *= 1_000;
  return per === 1 ? `${formatShownAt(units, money)}/${source.nativeUnit.replace(/s$/, "")}` : `${formatShownAt(units * per, money)}/${per.toLocaleString("en")} ${source.nativeUnit}`;
}
const formatShownAt = (units: number, money: Money): string => {
  const major = units / money.unitsPerMinor / 100;
  const text = new Intl.NumberFormat(MONEY_AS, { style: "currency", currency: money.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(major);
  return text;
};

/**
 * A key field's width in the characters its placeholder needs, a Chinese character counted as two, so a plan's long name is read whole
 * where the row has room; the stylesheet keeps it no narrower than the field has always been and no wider than its row.
 */
export const holdsWords = (placeholder: string): number => [...placeholder].reduce((width, one) => width + (/[\u3000-\u9fff\uff00-\uffef]/.test(one) ? 2 : 1), 2);

/**
 * How long ago a version was published, counted from `now`, as the language says it: within the hour the minutes, within the day the
 * hours, after pi.dev's "7m ago" and "2h ago", or today where only the day is known; then yesterday, then whole days of 24 hours, months of 30 days under a year, and years,
 * each with its figure, 2 天前 and "1 month ago". In Chinese a figure and a word stand a space apart, as everywhere on the page.
 */
export function ago(iso: string, now: number, language: Language, say: ItemContext["say"]): string | undefined {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return undefined;
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  // A record that states a day and no hour was updated today until a whole day has passed.
  if (!iso.includes("T") && minutes < 24 * 60) return say("pl.ago.day");
  if (minutes < 60) return say("pl.ago.minutes", { n: Math.max(1, minutes) });
  if (minutes < 24 * 60) return say("pl.ago.hours", { n: Math.floor(minutes / 60) });
  const days = Math.floor((now - at) / (DAY * 1000));
  // Days for a month, then months for a year, then years: a package npm last saw updated two years ago reads so, not as 730 days.
  const [count, unit] = days < 30 ? [days, "day" as const] : days < 365 ? [Math.floor(days / 30), "month" as const] : [Math.floor(days / 365), "year" as const];
  // Yesterday is the one word: 前天 and 上个月 name a calendar day and month, which whole days counted back need not fall in.
  return spaced(new Intl.RelativeTimeFormat(language === "zh" ? "zh-CN" : "en", { numeric: days === 1 ? "auto" : "always" }).format(-count, unit), language);
}

export const spaced = (words: string, language: Language): string =>
  language === "zh" ? words.replace(/([A-Za-z0-9])([\u4e00-\u9fff])/g, "$1 $2").replace(/([\u4e00-\u9fff])([A-Za-z0-9])/g, "$1 $2") : words;

/** What one unit of the account's money buys of a source's commonest thing, a product, as one sentence; nothing for a source the person's own key pays, or one that sells no product. */
export function scaleOf(context: Pick<ItemContext, "money" | "language" | "say">, source: Source, short = false): string | undefined {
  const { money, language, say } = context;
  const product = source.aspects.find((aspect) => aspect.aspect.endsWith("/product"));
  if (product === undefined || money === undefined || payerOf(source) !== "balance" || source.unitsPerNative === undefined) return undefined;
  return say(short ? "pl.src.tag" : "pl.ov.scale", { one: formatShownAt(money.unitsPerMinor * 100, money), n: roughly((money.unitsPerMinor * 100) / (product.native * source.unitsPerNative)).toLocaleString(language) });
}

/**
 * A source's prices, as its Overview and its turn-on card both draw them: what a dollar buys of it, or where it sells no product or the
 * person's own key pays, who pays and at what price. Nothing where the source's read did not answer.
 */
export function pricesOf(context: Pick<ItemContext, "held" | "money" | "language" | "say">, plugin: Plugin): readonly Child[] {
  const { held, money, say } = context;
  const source = held.sources.find((one) => one.name === plugin.source?.name);
  if (source === undefined || source.unitsPerNative === undefined) return [];
  const scale = scaleOf(context, source);
  if (scale !== undefined) return [h("p", {}, scale)];
  const pays = money === undefined ? "" : payerOf(source) === "key" ? say("pl.src.key", { supplier: source.supplier }) : say("pl.src.platform", { price: unitPrice(source, money) });
  return [pays !== "" && h("p", {}, pays)];
}

/**
 * A source's Pricing on its own page, from the record the gate answers (ruled 2026-10-14): the price in the source's own unit, what each
 * kind of request the page names costs in that unit and in money, and what a dollar buys of it. Where the person's own key pays, that
 * alone; nothing where the source's read did not answer.
 */
export function priceLines(context: Pick<ItemContext, "held" | "money" | "language" | "say">, plugin: Plugin): readonly Child[] {
  const { held, money, language, say } = context;
  const source = held.sources.find((one) => one.name === plugin.source?.name);
  if (source === undefined || source.unitsPerNative === undefined || money === undefined) return [];
  if (payerOf(source) === "key") return [h("p", {}, say("pl.src.key", { supplier: source.supplier }))];
  const per = source.unitsPerNative;
  const typed = source.aspects.flatMap((aspect) => { const words = aspect.words ?? plugin.source?.aspects[aspect.aspect]; return words === undefined ? [] : [say("source.typical", { what: words[language], count: aspect.native.toLocaleString(language), unit: source.nativeUnit, price: formatShownAt(aspect.native * per, money) })]; });
  const scale = scaleOf(context, source);
  return [
    h("p", {}, say("pl.src.platform", { price: unitPrice(source, money) })),
    typed.length > 0 && h("ul", { class: "pl-plain pl-prices" }, ...typed.map((line) => h("li", {}, line))),
    scale !== undefined && h("p", { class: "quiet" }, scale),
  ];
}

/** Who pays for a source: the person's own key where one is held, else the balance. Every surface that names the payer asks this. */
export const payerOf = (source: Pick<Source, "ownKey"> | undefined): "key" | "balance" => (source?.ownKey?.held === true ? "key" : "balance");

export { vendorModels };

/**
 * What a card reads and does, from a page's context: the held world, who pays and at what price, the balance, and the page's own way of
 * doing a thing and saying what happened.
 */
export function cardsFor(context: Omit<ItemContext, "row" | "back" | "ask" | "reload" | "unread" | "doing" | "help" | "features" | "openSeries" | "chatOpen">, run: CardContext["run"]): CardContext {
  const { held, money, language, say } = context;
  const source = (plugin: Plugin): Source | undefined => held.sources.find((one) => one.name === plugin.source?.name);
  const shown = (units: number): string => (money === undefined ? "" : formatShown(units, money, MONEY_AS));
  return {
    held, backend: context.backend, language, say, list: context.list, tile: context.tile, balance: context.balance, ...(context.ruleSeen === undefined ? {} : { ruleSeen: context.ruleSeen }), ...(context.seeRule === undefined ? {} : { seeRule: context.seeRule }), ...(context.head === undefined ? {} : { head: context.head }), ended: context.ended,
    meta: (plugin) => metaOf(context, plugin),
    payLine: (plugin) => {
      const one = source(plugin);
      if (one === undefined || money === undefined || one.unitsPerNative === undefined) return "";
      return payerOf(one) === "key" ? say("pl.src.key", { supplier: one.supplier }) : say("pl.src.platform", { price: unitPrice(one, money) });
    },
    scaleLine: (plugin) => { const one = source(plugin); return one === undefined ? "" : scaleOf(context, one) ?? ""; },
    prices: (plugin) => pricesOf(context, plugin),
    byKey: (plugin) => payerOf(source(plugin)) === "key",
    modelPrice: (plugin) => {
      const rate = vendorModels(plugin, held.served).flatMap((model) => held.providers?.find((one) => one.id === model.provider)?.rates.find((one) => one.model === model.id || one.model === model.name) ?? [])[0];
      const model = vendorModels(plugin, held.served).find((one) => held.providers?.find((provider) => provider.id === one.provider)?.rates.some((r) => r.model === one.id || r.model === one.name));
      return rate === undefined || money === undefined || model === undefined ? undefined : { model: model.name, price: `${shown(rate.input)} / ${shown(rate.output)}` };
    },
    spent: (plugin) => {
      const units = (plugin.source !== undefined ? sourceOf(held, plugin)?.month?.spent : modelOf(held, plugin)?.month) ?? 0;
      return units > 0 && money !== undefined ? formatTotal(units, money, MONEY_AS, (amount, owed) => say(owed ? "pl.lessThanOwedMid" : "pl.lessThanMid", { amount })) : undefined;
    },
    run,
    host: context.cards ?? (() => globalThis.document.body),
  };
}

/** The version a plugin's head says: the one held, else the one the image pins; a plugin nobody holds, and that no package offers, says its record's. */
export const shownVersion = (held: Held, plugin: Plugin): string | undefined => sourceOf(held, plugin)?.version ?? (shippedOf(held, plugin).version || undefined) ?? plugin.version;

/**
 * A package of ours whose record's files were read in part: its name and its record's version, npm's newest, at which its page asks
 * npm again. Its Overview is npm's newest whatever version cx's computer holds; the held one is only its head's number (ruled 2026-11-06).
 */
function ourVersion(plugin: Plugin): { readonly name: string; readonly version: string } | undefined {
  const name = plugin.box?.package;
  if (!madeByUs(plugin) || name === undefined || plugin.box?.source !== `npm:${name}` || plugin.version === undefined) return undefined;
  return (plugin.box?.unread ?? []).length === 0 ? undefined : { name, version: plugin.version };
}

/**
 * Who made a plugin, its version and when it was updated: the one line its header and its install card say. `unread`, where the page
 * could not read the package, claims no author it did not read.
 */
export function metaOf(context: Pick<ItemContext, "held" | "backend" | "language" | "say">, plugin: Plugin, unread = false): string {
  const { held, say } = context;
  const version = shownVersion(held, plugin);
  // A model says what a card of it does (sheet 3c): who made it, then npm's downloads and how long ago npm published it, where npm holds it.
  if (plugin.model !== undefined) {
    const npm = plugin.onNpm;
    const published = npm?.published === undefined ? undefined : ago(npm.published, context.backend.now(), context.language, say);
    return [plugin.author === "" ? say("pl.own.by") : say("pl.by", { name: plugin.author }),
      ...(npm?.downloads === undefined ? [] : [say("pl.npm.downloads", { n: downloadsWord(npm.downloads, context.language) })]),
      ...(published === undefined ? [] : [say("pl.head.updated", { when: published })])].join(" · ");
  }
  // A package that names no maker says so, and one that states no version shows none.
  const made = plugin.author === "" ? [...(unread ? [] : [say("pl.own.by")]), ...(version === undefined ? [] : [version])].join(" · ")
      : version !== undefined ? say("pl.head.meta", { author: plugin.author, version }) : say("pl.head.metaBy", { author: plugin.author });
  // A record that states the day it was updated says how long ago that was; one that states none says nothing of it.
  const when = plugin.updated === undefined ? undefined : ago(plugin.updated, context.backend.now(), context.language, say);
  return when === undefined ? made : `${made} · ${say("pl.head.updated", { when })}`;
}

/** What counts as a press on a page: a control, not its words or the space between. */
const PRESSED = "button, a[href], input, select, textarea, summary, label, [role=button], [role=switch], [role=tab], [role=menuitem]";

/** A record's page not read yet, in the page's own frame: the head with its mark and name, the tabs, and the tab's body, what it says and the side. */
export const recordShape = (word: string): HTMLElement => skeleton(word,
  h("header", { class: "pl-head" }, block(h("span", { class: "tile pl-tile-big" })), h("div", { class: "pl-head-text" }, h("div", {}, bar(4, "display")), h("p", {}, bar(6, "small")))),
  h("nav", { class: "pl-tabs" }, ...[0, 1, 2].map(() => h("span", { class: "pl-tab" }, bar("word")))),
  h("div", { class: "pl-tabbody" },
    h("div", { class: "pl-columns" },
      h("div", { class: "pl-main" }, h("div", {}, bar(2, "small")), h("p", {}, bar(12), bar(12), bar(7)), h("div", {}, bar(2, "small")), h("p", {}, bar(12), bar(9))),
      h("div", { class: "pl-side" }, h("div", {}, bar(5, "small")), h("p", {}, bar(10, "small"), bar(8, "small"), bar(9, "small"))))));

/** A record's page: its header, its tabs, and the tab's body. A plugin's tabs follow its parts; a bundle's are its Overview and its plugins. */
export class ItemPage {
  readonly element = h("div", { class: "pl-item" });
  #modelReads: ModelReads | undefined;
  /** ⋮'s menu as the page now draws it, and the one the drawing under way built; an open one is closed before the page is drawn again and opened on the new ⋮. */
  #more: { readonly menu: Menu; readonly list: HTMLElement } | undefined;
  #drawing: { readonly menu: Menu; readonly list: HTMLElement } | undefined;
  /** Whether the drawing under way is of the record and tab drawn before: ⋮'s menu stays open across it. */
  #same = false;
  #at: { readonly plugin: Plugin; readonly tab: Tab } | undefined;
  /** The source whose Install was pressed in this page's header, unconnected, while its Settings wait to be fillable (ruled 2026-11-11). */
  #toSettings: string | undefined;
  #bundleAt: { readonly bundle: Bundle; readonly tab: Tab } | undefined;
  #ownWords: OwnWords | undefined;
  #npm: NpmRead | undefined;
  readonly #ownKept: KeptReads = { ours: new Map(), uses: new Map() };
  get #kept(): KeptReads { return this.context.kept ?? this.#ownKept; }
  /** A package of ours whose record was read in part and that npm did not answer again, `<name>@<version>`: asked again when the page opens again. */
  #ourUnread: string | undefined;
  #note: string | undefined;
  /** The Feishu bot's address as the platform last answered it, the empty string for none; absent where it could not be read. */
  #feishu: string | undefined;
  /** What is typed in the Feishu field and the note under it, kept across a redraw. */
  #feishuDraft = "";
  #feishuNote: StringKey | undefined;
  #signIn: SignInAt | undefined;
  /** A key typed on a maker's Settings and not yet saved, by plugin and provider. */
  readonly #typed = new Map<string, string>();
  /** What this page has in flight, by the operation: a draw while one is out draws its control waiting, and a press of it does nothing. */
  readonly #waits = new Waits(() => this.element);
  #lastWord: LastWord | undefined;
  #pairForm: PairForm | undefined;
  #fieldsForm: FieldsForm | undefined;
  /**
   * What a host's list of many makers holds across a redraw, by where it is drawn: a search's words, the makers opened, those shut
   * during a search, and the series a search opened on some versions that were folded again.
   */
  readonly #lists = { sought: new Map<string, string>(), open: new Set<string>(), shut: new Set<string>(), folded: new Set<string>() };
  /** A tick refused in such a list, said under its row until the next press. */
  #refused: { readonly key: string; readonly place: string | undefined; readonly why: TickRefused } | undefined;
  /** The search waiting to say what it found: its list's place, and the timer that says it once the typing stops. */
  #found: { readonly place: string; readonly timer: ReturnType<typeof setTimeout> } | undefined;
  constructor(public context: ItemContext) {
    // The landing's mark goes at the seller's next press of a control on the page; a click on words or blank space, and a drawing the seller did not ask for, keep it.
    const pressed = (event: Event): void => { if ((event.target as Element | null)?.closest?.(PRESSED) != null) this.#unmark(); };
    this.element.addEventListener?.("click", pressed, true);
    this.element.addEventListener?.("change", pressed, true);
  }

  // A field, so that it can be handed on as a function and still read this page's context.
  readonly #say = (key: StringKey, values: Readonly<Record<string, string | number>> = {}): string => this.context.say(key, values);
  /** A plugin's or a bundle's name as the page's language names it. */
  readonly #name = (one: Plugin | Bundle): string => nameIn(one, this.context.language);
  #words(words: Words | undefined): string { return words === undefined ? "" : words[this.context.language]; }
  #shown(units: number): string { return this.context.money === undefined ? "" : formatShown(units, this.context.money, MONEY_AS); }

  /** Reads what the tab draws that the held world does not carry, then draws; the reads go out together, each on its own. */
  async plugin(plugin: Plugin, tab: Tab): Promise<void> {
    const backend = this.context.backend;
    // While the record's own reads are out, the page draws the record's shape where the record will be, under the way back.
    if (this.#at === undefined) this.#draw(this.#backLink(this.context.back), recordShape(this.#say("stream.loading")));
    // Each part returns nothing where it has nothing to ask.
    const models = (): Promise<void> | undefined => {
      if (plugin.model === undefined || !(tab === "overview" || tab === "models" || tab === "settings")) return undefined;
      return modelsRead();
    };
    const modelsRead = async (): Promise<void> => {
      // The models, providers and accounts the world already read are taken as held; only what it could not read is asked again.
      const held = this.context.held;
      const [models, providers, accounts] = await Promise.all([
        held.served ?? backend.models().catch(() => undefined), held.providers ?? backend.providers().catch(() => []), held.accounts ?? backend.accounts().catch(() => []),
      ]);
      this.#modelReads = { ...(models === undefined ? {} : { models }), providers, accounts };
    };
    const feishu = (): Promise<void> | undefined => (plugin.box?.package === FEISHU_PACKAGE && tab === "settings" ? backend.feishu().then((read) => { this.#feishu = read; }, () => { this.#feishu = undefined; }) : undefined);
    // A package from npm is drawn from what npm says of it, installed or not; what it uses, and a README of the person's own, follow from that.
    const npm = plugin.npm;
    const npmRead = (): Promise<void> | undefined => {
      // Installed or not, it is drawn at npm's newest, as pi's gallery draws it (ruled 2026-11-06): the version cx's computer holds is
      // only the number its head says, beside Update.
      if (npm === undefined || this.#npm?.name === npm) return following();
      return backend.npmPackage(npm).catch((error: unknown) => (error instanceof Error && error.message === "unknown_package" ? "unknown" as const : error instanceof Error && error.message === "npm_unreachable" ? "unreachable" as const : "unread" as const))
        .then((read) => { this.#npm = { name: npm, read }; return following(); });
    };
    const following = (): Promise<void> | undefined => {
      const fromNpm = this.#npm?.name === npm && typeof this.#npm?.read === "object";
      // A plugin it uses is listed whether or not the catalogue holds its record: one it does not is read by name, as the gallery reads it.
      const unheld = typeof this.#npm?.read === "object" && fromNpm ? this.#unheld(this.#npm.read) : [];
      const unread = unheld.filter((name) => !this.#kept.uses.has(name));
      const uses = unread.map(async (name) => {
        const read = await Promise.resolve().then(() => backend.npmPackage(name)).catch(() => undefined);
        if (read !== undefined) this.#kept.uses.set(name, galleryPlugin(read));
      });
      // A plugin the person installed themselves is drawn from what its package ships to say of itself, unless npm gave its README.
      const own = plugin.own === true && plugin.box !== undefined && !fromNpm
        ? backend.readme(sourceFor(this.context.held, plugin)!).then((readme): OwnWords => (readme === undefined || readme.text.trim() === "" ? { none: "absent" } : { text: readme.text }),
          (error): OwnWords => ({ none: refusalOf(error) === "readme_too_large" ? "large" : "unread" })).then((words) => { this.#ownWords = words; })
        : undefined;
      const reads = [...uses, ...(own === undefined ? [] : [own])];
      return reads.length === 0 ? undefined : Promise.all(reads).then(() => undefined);
    };
    const ours = (): Promise<void> | undefined => {
      const ourAt = ourVersion(plugin);
      const ourKey = ourAt === undefined ? undefined : `${ourAt.name}@${ourAt.version}`;
      if (ourAt === undefined || ourKey === undefined || settledOurs(this.#kept, ourKey) || this.#ourUnread === ourKey) return undefined;
      return Promise.resolve().then(() => backend.npmPackage(ourAt.name, ourAt.version)).then((read) => { this.#kept.ours.set(ourKey, read); }, () => { this.#ourUnread = ourKey; });
    };
    const reads = [models(), feishu(), npmRead(), ours()].filter((read) => read !== undefined);
    // Nothing to read, the page is drawn at once, as before any of this was asked.
    if (reads.length > 0) await Promise.all(reads);
    this.drawPlugin(plugin, tab);
  }

  /** The record is drawn, its own reads answered: what an address asks of the page can be looked for on it. */
  get drawn(): boolean { return this.#at !== undefined || this.#bundleAt !== undefined; }

  /** Draws again what was last drawn, from what the page already read: a click out or answered changes what a record's controls say. */
  again(): void {
    if (this.#bundleAt !== undefined) this.drawBundle(this.#bundleAt.bundle, this.#bundleAt.tab);
    else if (this.#at !== undefined) this.drawPlugin(this.#at.plugin, this.#at.tab);
    else if (this.#chatAt) this.drawChat();
  }

  #chatAt = false;
  /** The vendor an address landed on, and when: outlined in every drawing until the seller's next press on the page, or until it is left. */
  #landed: { readonly id: string; readonly since: number } | undefined;
  #unmark(): void {
    if (this.#landed === undefined) return;
    this.#landed = undefined;
    this.element.querySelector?.(".vc-landed")?.classList.remove("vc-landed");
  }
  get #choosing(): Set<string> { return this.context.chatOpen; }
  /** The chat's models page, drawn from what the page holds; a vendor landed on stays outlined, its fade going on from where it was. */
  drawChat(): void {
    this.#chatAt = true;
    this.#at = undefined;
    this.#bundleAt = undefined;
    const held = this.context.held;
    this.#draw(this.#backLink({ href: "#/plugins", name: this.#say("nav.plugins") }), h("div", { class: "vc-page" }, ...chatPage({
      held, language: this.context.language, say: this.context.say, tile: (plugin) => this.context.tile(plugin), open: this.#choosing, landed: this.#landed?.id,
      chooser: (plugin, series) => ofMakers(series) ? h("div", { class: "or-list" }, ...this.#longList(plugin, series, `choose-${plugin.id}`, "h3"))
        : h("div", { class: "pl-model-rows" }, this.#fullLine(plugin), h("p", { class: "quiet" }, this.#say("pl.mt.seriesLine")), this.#seriesTable(plugin, series)),
      toggle: (plugin) => { if (this.#choosing.has(plugin.id)) this.#choosing.delete(plugin.id); else this.#choosing.add(plugin.id); this.drawChat(); placed(this.element, `choose ${plugin.id}`)?.focus(); },
      // Each write is three platform round-trips — the record read, its write, the page read again — so the press turns until it lands.
      add: (plugin, series) => { void this.#waits.run(`chat-add ${plugin.id}`, () => this.#addToChat(plugin, series), placed(this.element, `add ${plugin.id}`)); },
      takeOut: (plugin) => { void this.#waits.run(`chat-out ${plugin.id}`, () => this.#takeOut(plugin), placed(this.element, `out ${plugin.id}`)); },
      ring: (key, control) => this.#waits.ring(key, control),
    }), this.#noteLine()));
    const row = this.element.querySelector?.<HTMLElement>(".vc-landed");
    if (row !== null && row !== undefined && this.#landed !== undefined && row.style !== undefined) row.style.animationDelay = `-${Math.max(0, Date.now() - this.#landed.since)}ms`;
  }

  /**
   * An arrival at an address naming a vendor, each time the seller comes to it: its row outlined until their next press, its models open
   * where it is in chat, in view, and the keyboard on its first press, else its name.
   */
  land(id: string): void {
    const held = this.context.held;
    const landed = held.catalogue.plugins.find((plugin) => plugin.id === id);
    if (landed === undefined) { this.drawChat(); return; }
    this.#landed = { id, since: Date.now() };
    if (inChat(held).includes(landed)) this.#choosing.add(id);
    this.drawChat();
    this.element.querySelector?.(`li[data-vendor="${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: "nearest" });
    [`choose ${id}`, `add ${id}`, `again ${id}`, `setup ${id}`, `out ${id}`, `name ${id}`].map((key) => placed(this.element, key)).find(Boolean)?.focus({ preventScroll: true });
  }

  /** Puts a vendor in chat with the series its row lists; the keyboard moves to the next Add to chat, else to the vendor's own row. */
  async #addToChat(plugin: Plugin, series: readonly Series[]): Promise<void> {
    const before = this.#presses("add ");
    const at = before.indexOf(plugin.id);
    let refused: TickRefused | undefined;
    const done = await this.#act(async () => { refused = await this.context.backend.addToChat(plugin.id, series.map((one) => one.name)); });
    if (!done) return;
    // A vendor is said to be in chat only once it holds a place: a first tick refused leaves it where it was, and says why. A series refused
    // after the ones before it were ticked is said as the chooser says a tick past the fifth, and the vendor's move shows it in chat.
    const holds = inChat(this.context.held).some((one) => one.id === plugin.id);
    if (refused === "many") this.context.announce?.(this.#say("chat.seriesCap", { max: CARD_PLACES }));
    else if (holds) this.context.announce?.(this.#say("chat.addedSaid", { name: this.#name(plugin) }));
    else if (refused === "full") this.context.announce?.(this.#say("card.full", { count: CARD_PLACES }));
    const now = this.#presses("add ");
    [now[at] && `add ${now[at]}`, now[at - 1] && `add ${now[at - 1]}`, "full", `choose ${plugin.id}`, `out ${plugin.id}`].filter((key): key is string => typeof key === "string")
      .map((key) => placed(this.element, key)).find(Boolean)?.focus();
  }

  /** Takes a vendor out of chat, clearing every tick of its series; the keyboard moves to the next Take out of chat, else to the line that chat holds Default alone. */
  async #takeOut(plugin: Plugin): Promise<void> {
    const at = this.#presses("out ").indexOf(plugin.id);
    const done = await this.#act(() => this.context.backend.takeOut(plugin.id));
    if (!done) return;
    this.#choosing.delete(plugin.id);
    this.context.announce?.(this.#say("chat.outSaid", { name: this.#name(plugin) }));
    const now = this.#presses("out ");
    [now[at] && `out ${now[at]}`, now[at - 1] && `out ${now[at - 1]}`, "empty"].filter((key): key is string => typeof key === "string")
      .map((key) => placed(this.element, key)).find(Boolean)?.focus();
  }

  /** The vendors whose press of one kind is drawn, in the page's order. */
  #presses(kind: string): readonly string[] {
    return [...this.element.querySelectorAll?.(`[data-focus^="${kind}"]`) ?? []].map((one) => (one as HTMLElement).dataset["focus"]!.slice(kind.length));
  }

  /** The names a package from npm uses that the catalogue holds no record of. */
  #unheld(read: NpmPackage): readonly string[] {
    return [...new Set(read.uses)].filter((name) => !this.context.held.catalogue.plugins.some((one) => one.npm === name || one.box?.package === name));
  }

  /** The held world with a record of each plugin the page's package uses that the catalogue holds none of: npm's words for it, else its name. */
  #heldFor(plugin: Plugin): Held {
    const held = this.context.held;
    const read = this.#npmOf(plugin);
    const unheld = typeof read === "object" ? this.#unheld(read) : [];
    if (unheld.length === 0) return held;
    return { ...held, catalogue: { ...held.catalogue, plugins: [...held.catalogue.plugins, ...unheld.map((name) => this.#kept.uses.get(name) ?? galleryPlugin({ name }))] } };
  }

  /** A package of ours whose record was read in part, as npm's newest answered when asked again: its README, skills, templates and their Chinese. */
  #atVersion(plugin: Plugin): Plugin {
    const at = ourVersion(plugin);
    if (at === undefined || plugin.box === undefined) return plugin;
    const key = `${at.name}@${at.version}`;
    const read = this.#kept.ours.get(key) ?? (this.#ourUnread === key ? { ...at, shipped: UNREAD } : undefined);
    if (read === undefined) return plugin;
    const { readme: _readme, unread: _unread, ...box } = plugin.box;
    return { ...plugin, box: { ...box, ...ourShippedBox(read) } };
  }

  drawPlugin(drawn: Plugin, tab: Tab): void {
    // A package npm lists and the person has not installed is who npm says made it, in npm's words for it, but for the Chinese line one
    // made for ComChatX declares in its own field.
    const read = this.#npmOf(drawn);
    const declaredZh = drawn.declaredZh;
    const told = typeof read === "object" && drawn.own !== true ? { ...drawn, author: read.author ?? "", about: { en: read.description, zh: declaredZh ?? read.description } } : this.#atVersion(drawn);
    const held = this.#heldFor(drawn);
    const plugin = typeof read === "object" ? withPackage(held, told, read) : told;
    const tabs = tabsOf(plugin, held, this.context.features);
    const shown = tabs.includes(tab) ? tab : "overview";
    this.#same = this.#at?.plugin.id === plugin.id && this.#at.tab === shown;
    if (!this.#same) this.#forgetLists();
    this.#at = { plugin, tab: shown };
    this.#bundleAt = undefined;
    // A plugin the person installed themselves that cx's computer no longer has leaves its page to the one line that says so and how
    // it comes back; one the catalogue offers is not installed, and its page says so with its Install.
    if (!this.context.unread && plugin.own === true && this.context.doing.facts(plugin).has("not_listed")) {
      this.#draw(this.#backLink(this.context.back), factLine(this.context, plugin, new Set(["not_listed"])));
      return;
    }
    // A name npm does not have, and nothing installed by it, is no page.
    if (plugin.own !== true && this.#npmOf(plugin) === "unknown") {
      this.#draw(this.#backLink(this.context.back), h("p", { class: "quiet" }, this.#say("pl.unknown")));
      return;
    }
    this.#draw(
      this.#backLink(this.context.back),
      this.#head(plugin),
      this.#updateFailed(plugin),
      ...this.#needsLine(plugin, shown),
      !this.context.unread && idle(this.context.held, plugin) && h("p", { class: "quiet pl-idle", role: "status" }, this.#idleLine(plugin)),
      this.#unreadLine(),
      this.#noteLine(),
      ...this.#doingLines(plugin),
      // The bar is the page's form: drawn with one tab too, so every plugin's page reads the same.
      h("nav", { class: "pl-tabs", role: "tablist", onfocusin: tabInView }, ...tabs.map((one) => {
        const count = this.#count(plugin, one);
        return h("a", { class: "pl-tab", role: "tab", href: `${href.item(plugin)}/${one}`, "aria-selected": String(one === shown), "data-focus": `tab ${one}` }, this.#say(`pl.tab.${one}`), count !== undefined && h("span", { class: "pl-tab-count" }, ` · ${count}`));
      })),
      h("div", { class: "pl-tabbody" }, ...this.#tab(plugin, shown)),
    );
    this.#settingsOnceFillable();
  }

  /**
   * The one place a search waiting to say what it found is ended: its list forgotten, its page left, or its list gone from the page,
   * a chooser closed, taken away or its vendor out of chat. A search still drawn keeps its word.
   */
  #endSearch(): void {
    if (this.#found === undefined) return;
    clearTimeout(this.#found.timer);
    this.#found = undefined;
  }

  /**
   * Draws the page; a search whose list this drawing left out says nothing of it. Who opens a float closes it: a tip on the page and an
   * open ⋮ are closed by the set's own close before their anchor is drawn again, and ⋮ opens again on the same record's new head.
   */
  #draw(...children: readonly Child[]): void {
    // ⋮'s menu is closed before its anchor is drawn again; a tip needs no call, since the set takes one whose target went.
    const open = this.#more !== undefined && !this.#more.list.hidden;
    if (open) this.#more!.menu.close(false);
    this.#more = this.#drawing;
    this.#drawing = undefined;
    fill(this.element, ...children);
    if (open && this.#same) this.#more?.menu.open();
    this.#same = false;
    if (this.#found !== undefined && this.element.querySelector?.(`[id="${this.#found.place}-results"]`) === null) this.#endSearch();
  }

  /** A list of many makers opens on its makers closed and no search, each time its page or tab is come to. */
  #forgetLists(): void {
    this.#endSearch();
    for (const held of [this.#lists.open, this.#lists.shut, this.#lists.folded]) held.clear();
    this.#lists.sought.clear();
    this.#refused = undefined;
    this.#full = undefined;
  }

  /** A tab that counts says how many: the plugins it uses, the models served. */
  #count(plugin: Plugin, tab: Tab): number | undefined {
    if (tab === "deps") return directOf(this.#heldFor(plugin), plugin).length;
    if (tab === "models") return this.#modelCount(plugin);
    return undefined;
  }

  /** A vendor's chat models by series, which the held world carries only where the platform offers them so. */
  #series(plugin: Plugin): readonly Series[] | undefined {
    return this.context.held.series?.[plugin.id];
  }

  /** Whether every series a vendor lists is its catalogue's, reached by no way of the person's yet, on a vendor installed. */
  #waitsForWay(plugin: Plugin, series: readonly Series[] | undefined): boolean {
    return installed(this.context.held, plugin) && series !== undefined && series.length > 0 && series.every((one) => one.listed === true);
  }

  /** How many models a vendor has: each series once; else the chat models served. */
  #modelCount(plugin: Plugin): number | undefined {
    const series = this.#series(plugin);
    if (series !== undefined) return series.length;
    const models = this.#models();
    return models === undefined ? undefined : vendorModels(plugin, models).length;
  }

  /** The models the platform serves: the held world's, which a sign-in or a saved key reads again, before the record's own read. */
  #models(): Models | undefined {
    return this.context.held.served ?? this.#modelReads?.models;
  }

  #noteLine(): Child { return this.#note !== undefined ? h("p", { class: "pl-said", role: "status" }, this.#note) : ""; }

  /**
   * What a click on this record failed to do or found out, under its header, each in the one place: a failure in brick with the step
   * that can change it, until it is tried again; a fact about the plugin in the page's own ink. A click being written down says
   * nothing here: its control turns.
   */
  #doingLines(item: Plugin | Bundle): readonly Child[] {
    const busy = this.context.doing.busy(item);
    const failed = this.context.unread ? undefined : this.context.doing.failed(item);
    return [
      // A failed update stands where its update line stood.
      // On a bundle's page its line's try holds the press's place, so the keyboard on the press lands on it when the failure is drawn.
      failed !== undefined && failed.act !== "update" && failureLine(this.context, item, failed, { retry: () => void this.#again(item, failed), help: this.context.help, ...(isBundle(item) ? { retryPlace: "tool" } : {}) }),
      !this.context.unread && busy === undefined && factLine(this.context, item, this.context.doing.facts(item), "page", this.context.doing.stopped(item)),
    ];
  }

  /** A failed update, in its update line's place under the header: Try again updates again, its ring standing where Try again was. */
  #updateFailed(plugin: Plugin): Child {
    const failed = this.context.unread ? undefined : this.context.doing.failed(plugin);
    return failed?.act === "update" && failureLine(this.context, plugin, failed, { retry: () => void this.#again(plugin, failed), help: this.context.help, retryPlace: `update ${plugin.id}` });
  }

  /** A control's place while its click is written down: it turns, named for what is being done, taking no press and keeping the keyboard its control had. */
  #busyButton(item: Plugin | Bundle, busy: Busy): HTMLElement {
    return h("button", { type: "button", class: "primary pl-busy", "aria-disabled": "true", "aria-busy": "true", "aria-label": this.#say(`pl.doing.${busy.act}Name`, { name: this.#name(item) }), "data-focus": busy.act === "remove" ? "more" : "tool" },
      spinner());
  }

  /** When the held reads failed, the page says so once, with a way to read again, and states nothing about what is held. */
  #unreadLine(): Child {
    const said = this.context.unreadSaid ?? { key: "pl.unread", retry: true };
    return this.context.unread && h("div", { class: "pl-needs", role: "status" }, h("span", {}, ...linked(this.#say(said.key), OFFER)),
      said.retry && this.#waits.ring("read-again", h("button", { type: "button", onclick: this.#waits.press("read-again", () => this.context.reload()) }, this.#say("status.retry"))));
  }

  drawBundle(bundle: Bundle, tab: Tab): void {
    const shown: Tab = tab === "plugins" ? "plugins" : "overview";
    const held = this.context.held;
    const queued = this.context.unread ? undefined : this.context.queued?.(bundle);
    const gone = missingOf(held, bundle);
    const whole = holds(held, bundle) && gone.length === 0;
    const count = installsOf(held, bundle).length;
    const busy = this.context.doing.busy(bundle);
    const stopped = this.context.unread ? undefined : this.context.doing.failed(bundle);
    const off = offIn(held, bundle);
    // A bundle in Yours that lacks a plugin has parts in: its button says what the next press does. A failed press is said once, in its
    // line with the way to try again, and the head keeps the Install that was pressed.
    const install = busy !== undefined ? this.#busyButton(bundle, busy) : h("button", { type: "button", class: "primary", "data-focus": stopped === undefined ? "tool" : "tool again", "data-card": cardFor(held, "install", bundle), onclick: () => void this.#installBundle(bundle) },
      stopped === undefined && gone.length > 0 ? this.#say("pl.installRest") : `+ ${this.#say("pl.install")}`);
    const names = (plugins: readonly Plugin[]): string => this.context.list(plugins.map((plugin) => this.#name(plugin)));
    this.#same = this.#bundleAt?.bundle.id === bundle.id && this.#bundleAt.tab === shown;
    this.#bundleAt = { bundle, tab: shown };
    this.#at = undefined;
    this.#draw(
      this.#backLink(this.context.back),
      h("header", { class: "pl-head" }, this.context.tile(bundle, true),
        h("div", { class: "pl-head-text" }, h("h1", { tabindex: "-1", "data-focus": "heading" }, this.#name(bundle)), h("p", { class: "quiet" }, this.#say("pl.head.members", { author: bundle.author, count })),
          // A bundle has no switch of its own: what it installed that is off now is said under its name.
          !this.context.unread && off.length > 0 && h("p", { class: "quiet pl-head-off" }, this.#say(off.length > 1 ? "pl.head.offMany" : "pl.head.offOne", { names: names(off) })),
          // What it lacks is said the same way, beside Install the rest.
          !this.context.unread && busy === undefined && stopped === undefined && gone.length > 0 && h("p", { class: "quiet pl-head-off" }, this.#say(gone.length > 1 ? "pl.head.notInMany" : "pl.head.notInOne", { names: names(gone) }))),
        // The state, then ⋮, as on a plugin's page (sheet 3c).
        h("div", { class: "pl-head-tools" }, this.context.unread ? "" : busy !== undefined ? install : queued !== undefined ? queued : whole
          ? h("span", { class: "pl-state pl-done", tabindex: "-1", "data-focus": "tool" }, this.#say("pl.installed"))
          : install, ...(!this.context.unread && busy === undefined && inYours(held, bundle) ? this.#moreOf(bundle) : []))),
      this.#unreadLine(),
      // What a plugin it installed waits on from the seller, as that plugin's own page says it.
      ...(this.context.unread || busy !== undefined ? [] : installsOf(held, bundle).flatMap((plugin) => needsOf(held, plugin).some((needs) => needs.kind === "connect")
        ? [h("div", { class: "pl-needs", role: "status" }, h("span", {}, this.#say("pl.need.unconnected", { name: this.#name(plugin) })), h("a", { class: "pl-needs-act", href: `${href.item(plugin)}/settings` }, this.#say("pl.need.connectAct", { name: this.#name(plugin) })))] : [])),
      this.#noteLine(),
      ...this.#doingLines(bundle),
      h("nav", { class: "pl-tabs", role: "tablist", onfocusin: tabInView }, ...(["overview", "plugins"] as const).map((one) =>
        h("a", { class: "pl-tab", role: "tab", href: `${href.item(bundle)}/${one}`, "aria-selected": String(one === shown), "data-focus": `tab ${one}` }, this.#say(`pl.tab.${one}`), one === "plugins" && h("span", { class: "pl-tab-count" }, ` · ${count}`)))),
      h("div", { class: "pl-tabbody" }, ...(shown === "plugins" ? this.#bundlePlugins(bundle) : this.#overview(bundle, membersOf(held, bundle)))),
    );
  }

  #backLink(back: { readonly href: string; readonly name: string }): HTMLElement {
    return h("p", { class: "back" }, h("a", { href: back.href }, this.#say("pl.pg.back", { name: back.name })));
  }

  /**
   * The header (sheet 3c): the mark, the name and its line; at its end what the plugin's state allows, in the head's own height. Not
   * installed, + Install, or where its install failed, the failure's mark, 重试 and ✕ where Install stood. Installed, 更新 where a new
   * version waits, or where the update failed its mark, 重试 and ✕; then the state word, the switch and ⋮.
   */
  #head(plugin: Plugin): HTMLElement {
    const held = this.context.held;
    const has = installed(held, plugin);
    const meta = metaOf(this.context, plugin, this.#notRead(plugin));
    const busy = this.context.doing.busy(plugin);
    // A vendor the platform serves is neither installed nor removed nor switched where no route does it: its header holds no control.
    const queued = has || this.context.unread ? undefined : this.context.queued?.(plugin);
    const failed = this.context.unread ? undefined : this.context.failedRow?.(plugin);
    const tools: readonly Child[] = this.context.unread || (plugin.model !== undefined && !this.context.features.modelPlugins) ? []
      // While a click is out, its control says what is being done and takes no press; nothing reads as installed before the answer.
      : busy?.act === "install" || busy?.act === "remove" ? [this.#busyButton(plugin, busy)]
      : queued !== undefined ? [queued]
      : !has ? (failed?.row.act === "install" ? this.#failedEnd(plugin, failed)
        : [h("button", { type: "button", class: "primary", "data-focus": "tool", "data-card": cardFor(held, "install", plugin), onclick: () => void this.#install(plugin, true) }, `+ ${this.#say("pl.install")}`)])
      : [...(failed?.row.act === "update" ? this.#failedEnd(plugin, failed) : [this.#updateEnd(plugin)]), ...this.#installedEnd(plugin, busy)];
    return h("header", { class: "pl-head" }, this.context.tile(plugin, true),
      h("div", { class: "pl-head-text" }, h("h1", { tabindex: "-1", "data-focus": "heading" }, this.#name(plugin)), // Who checked it stands where who made it does, which is where the eye looks for whose it is.
        this.#headMeta(plugin, meta),
        !this.context.unread && has && filesMissing(held, plugin) && h("p", { class: "quiet pl-head-off" }, this.#say("pl.head.missing"))),
      h("div", { class: "pl-head-tools" }, ...tools));
  }

  /** 更新 where a new version waits, a button in words left of the state word, its ring in its place while it is sent. */
  #updateEnd(plugin: Plugin): Child {
    return this.context.update !== undefined && rowUpdate({ ...this.context, update: this.context.update }, plugin)?.end;
  }

  /**
   * A failed install or update where its button stood (correction 2): the alert mark, whose tip holds what npm said under a pointer, the
   * keyboard or a press, and the line 「安装失败。」 or 「更新失败。」; then 重试 and ✕, the queue's own two presses.
   */
  #failedEnd(plugin: Plugin, failed: FailedRow): readonly Child[] {
    const update = failed.row.act === "update";
    const name = this.#name(plugin);
    const words = this.#say(update ? "pl.fail.updateHere" : "pl.fail.installHere");
    const said = failed.row.detail?.trim() ?? "";
    const mark = said === "" ? rowIcon("alert") : tip(h("button", { type: "button", class: "f-icon pl-failed-mark", "aria-label": `${words} ${said}` }, rowIcon("alert")), said, { says: true, at: "below" });
    return [
      h("span", { class: "pl-q-state pl-q-state-bad", role: "alert" }, mark, h("span", { class: "pl-q-state-word" }, words)),
      h("span", { class: "f-marks" },
        iconAct("again", this.#say(update ? "pl.q.retryUpdate" : "pl.q.retryInstall", { name }), failed.retry, { focus: retryPlace(failed.row) }),
        iconAct("close", this.#say(update ? "pl.q.cancelUpdate" : "pl.q.cancelInstall", { name }), failed.cancel, { focus: cancelPlace(failed.row) })),
    ];
  }

  /**
   * An installed plugin's end: its state word, the switch and ⋮ (sheet 3c); a single file says its state with no switch, and a vendor,
   * which is on while it is installed, says 已安装.
   */
  #installedEnd(plugin: Plugin, busy: Busy | undefined): readonly Child[] {
    const held = this.context.held;
    const on = readsOn(held, plugin);
    const name = this.#name(plugin);
    const word = (key: StringKey): HTMLElement => h("span", { class: "pl-state" }, this.#say(key));
    if (plugin.model !== undefined) return [word("pl.installed"), ...this.#moreOf(plugin)];
    if (this.context.doing.facts(plugin).has("single_file")) return [word(on ? "pl.switch.on" : "pl.switch.off"), ...this.#moreOf(plugin)];
    // A press asks for the other state than the one held, however often it comes before the page is drawn again; a card closed with
    // nothing done leaves the switch as it was.
    const toggle = switchButton({ label: name, on, turn: () => void this.#turn(plugin, !on).then(() => { if (toggle.element.isConnected) toggle.set(readsOn(this.context.held, plugin)); }) });
    toggle.element.setAttribute("data-focus", "tool");
    const card = cardFor(held, on ? "off" : "on", plugin);
    if (card !== undefined) toggle.element.setAttribute("data-card", card);
    // A switch whose click is being written down keeps the keyboard and takes no press; its name says what is being done.
    const turning = switching(busy);
    if (turning !== undefined) { toggle.busy(true); toggle.element.setAttribute("aria-label", this.#say(`pl.doing.${turning}Name`, { name })); }
    return [word(on ? "pl.switch.on" : "pl.switch.off"), toggle.element, ...this.#moreOf(plugin)];
  }

  /** ⋮, holding 移除, as a row of 我的 draws it (`plugins-row.ts`); its menu is closed before the page is drawn again (`#draw`). */
  #moreOf(item: Plugin | Bundle): readonly Child[] {
    // 移除 closes the menu and gives the keyboard to ⋮ before its card opens, so a card closed with nothing done gives it back there, a
    // press of the address's as much as the seller's.
    const shut = (): void => { built?.menu.close(false); built?.controls[0].focus(); void this.#remove(item); };
    const built: ReturnType<typeof moreMenu> | undefined = moreMenu(this.#say("pl.head.more"), this.#say("pl.head.remove"), shut, "more", cardFor(this.context.held, "remove", item));
    const { controls: [button, list], menu } = built;
    button.classList.add("pl-more");
    this.#drawing = { menu, list };
    return [button, list];
  }

  /**
   * Who made it and how it stands, under the name. A package from npm carries the third-party mark and npm's facts, its version among
   * them; another the person installed themselves says ComChatX did not check it, and one whose files are gone says that instead.
   */
  #headMeta(plugin: Plugin, meta: string): HTMLElement {
    const npm = this.#npmOf(plugin);
    const missing = !this.context.unread && filesMissing(this.context.held, plugin);
    const mark = missing ? h("span", { class: "pl-unchecked" }, this.#say("pl.chip.missing")) : (plugin.own !== true && plugin.npm !== undefined && !madeByUs(plugin)) || isThird(plugin) ? thirdMark(this.context.say) : plugin.own === true ? h("span", { class: "pl-unchecked" }, this.#say("pl.own.chip")) : undefined;
    if (typeof npm === "object" && plugin.model === undefined) {
      const when = ago(npm.updated, this.context.backend.now(), this.context.language, this.context.say);
      // Installed, the version is the one cx's computer holds, which npm may since have passed; else the one an install gets.
      const version = installed(this.context.held, plugin) ? shippedOf(this.context.held, plugin).version : npm.version;
      return h("p", { class: "quiet pl-head-meta pl-third-meta" }, ...npmFacts(this.context.say, this.context.language, { author: npm.author ?? "", version, downloads: npm.downloads, when }), ...(mark === undefined ? [] : [" ", mark]));
    }
    // The mark stands after the line (sheet 3c).
    return h("p", { class: "quiet pl-head-meta" }, meta, ...(mark === undefined ? [] : [meta === "" ? "" : " ", mark]));
  }
  /** What npm said of a plugin's package, where the plugin is one of npm's and the read was of it. */
  #npmOf(plugin: Plugin): NpmRead["read"] | undefined { return plugin.npm !== undefined && this.#npm?.name === plugin.npm ? this.#npm.read : undefined; }
  /** What a link out says to a screen reader, marked as the page's language, since a README it sits in may be in another. */
  #outsideWords(): Outside { return { words: this.#say("pl.third.outside"), lang: this.context.language === "zh" ? "zh-Hans" : "en" }; }
  /** The page asked for the package and was given nothing of it: what it would say of its author and words is unknown, not unstated. */
  #notRead(plugin: Plugin): boolean { const read = this.#npmOf(plugin); return read === "unreachable" || read === "unread"; }

  /** The header's control the keyboard goes to: the first of the kinds given that is drawn, whatever their order on the page. */
  #tool(...kinds: readonly string[]): HTMLElement | undefined {
    for (const kind of kinds) { const found = this.element.querySelector?.<HTMLElement>(`.pl-head-tools ${kind}`); if (found !== null && found !== undefined) return found; }
    return undefined;
  }

  /**
   * What the plugin needs before it works, under its header, each line with the act that clears it: connect a model, or install or
   * turn on a plugin its chain lacks. The act is about that other plugin, whose failure this page draws nowhere else: it is said under
   * the line, with its try, and the keyboard stays on the control pressed.
   */
  #needsLine(plugin: Plugin, tab: Tab): readonly Child[] {
    const press = (place: string, work: () => Promise<boolean>): void => void work().then((done) => { if (!done) placed(this.element, place)?.focus(); this.#land(); });
    return needsLine(this.context, plugin, this.context.unread, {
      // A source's own Settings is where its store is connected, so it draws no line sending the seller there, as round 27 does.
      connect: !(tab === "settings" && connects(this.context.held, plugin)),
      install: (root) => press(needPlace(plugin, root), () => install(this.#cards(), root)), turnOn: (root) => press(needPlace(plugin, root), () => turnOn(this.#cards(), root)),
      under: (root) => {
        const failed = this.context.doing.failed(root);
        const place = needAgainPlace(plugin, root);
        return failed !== undefined && failureLine(this.context, root, failed, { retry: () => failed.act === "update" ? this.context.update?.([root], place) : press(place, () => again(this.#cards(), root, failed)), help: this.context.help, retryPlace: place });
      },
    });
  }

  #tab(plugin: Plugin, tab: Tab): readonly Child[] {
    switch (tab) {
      case "models": return this.#modelsTab(plugin);
      case "deps": return this.#deps(plugin);
      case "settings": return this.#ahead(plugin, plugin.model !== undefined ? this.#modelSettings(plugin) : plugin.box?.package === FEISHU_PACKAGE ? this.#feishuSettings() : this.#sourceSettings(plugin));
      case "interface": return [h("ul", { class: "pl-list" }, ...(plugin.page?.changes ?? []).map((change) => h("li", {}, h("div", { class: "pl-row" }, h("span", { class: "pl-row-text" }, h("span", {}, this.#words(change)))))))];
      default: return plugin.model !== undefined ? this.#modelOverview(plugin) : plugin.own === true || plugin.npm !== undefined ? this.#ownOverview(plugin) : this.#overview(plugin, [plugin]);
    }
  }

  /**
   * A plugin's Settings before it is installed (ruled 2026-11-04): the form it draws installed, every field, choice and press disabled,
   * under one line that says installing opens them, which each disabled control is described by; the header's + Install is the way on.
   * A link stays a link, so the help on what to prepare still opens. A press marked `data-removes` takes back what the account already
   * holds, a store, a grant, a key, a sign-in or the Feishu bot's address, and stays live: only adding and changing wait.
   */
  #ahead(plugin: Plugin, drawn: readonly Child[]): readonly Child[] {
    const nodes = drawn.filter((one): one is Element => typeof one === "object" && "tagName" in one);
    // An install written down opens Settings: what each Settings saves is kept by the platform and the gate, and none waits for cx's computer.
    if (nodes.length === 0 || installed(this.context.held, plugin) || this.context.queued?.(plugin) !== undefined) return drawn;
    const hold = (node: Element): void => {
      if (CONTROLS.has(node.tagName) && !node.hasAttribute("data-removes")) {
        node.setAttribute("disabled", "");
        node.removeAttribute("aria-disabled");
        node.setAttribute("aria-describedby", [AFTER_INSTALL, node.getAttribute("aria-describedby")].filter((one) => one !== null && one !== "").join(" "));
      }
      for (const child of [...node.children as Iterable<unknown>]) if (typeof child === "object" && child !== null && "tagName" in child) hold(child as Element);
    };
    for (const node of nodes) hold(node);
    return [h("p", { id: AFTER_INSTALL }, this.#say("pl.st.afterInstall")), ...drawn];
  }

  /**
   * The Overview of a package of pi's gallery, or one the person installed themselves, all by one writer (`#packageWords`): the README its
   * files hold at npm's newest; where its files hold none, npm's README of it, or the one cx's computer read; without one, what the package
   * says of itself, or that it says nothing. Then its Try it, and beside it the note that ComChatX neither made nor checked it.
   */
  #ownOverview(plugin: Plugin): readonly Child[] {
    const files = plugin.box?.readme;
    const npm = this.#npmOf(plugin);
    // Where its files hold no README, npm's stands for the package's own, the last block left out where npm cut it short, or the one cx's
    // computer read; either is drawn by the one writer of a package's words.
    const words: OwnWords | undefined = files?.en !== undefined || files?.zh !== undefined ? undefined
      : typeof npm === "object" ? (npm.readme.trim() === "" ? { none: "absent" } : { text: npm.readme_cut ? uncut(npm.readme) : npm.readme }) : plugin.own === true ? this.#ownWords : undefined;
    const main = h("div", { class: "pl-main" }, ...this.#packageWords(plugin, words, npm === "unreachable" || npm === "unread" ? npm : undefined), this.#prompts(plugin));
    return [h("div", { class: "pl-columns" }, main, this.#side(plugin, [plugin], this.#selling(plugin)))];
  }

  /**
   * An Overview: the record's one markdown text, drawn as a package's README is (ruled 2026-11-06), the card's line where it has none,
   * its price, read from the rates, and a package's Try it, its prompt templates, beside a column naming the data sources it buys from,
   * with their prices.
   */
  #overview(item: Plugin | Bundle, plugins: readonly Plugin[]): readonly Child[] {
    const source = "source" in item && item.source !== undefined ? item : undefined;
    const main = h("div", { class: "pl-main" }, ...this.#description(item), !("members" in item) && this.#prompts(item));
    return [h("div", { class: "pl-columns" }, main, this.#side(item, plugins, source))];
  }

  /** What a record says it is: its markdown or, for a package, what its files say (`#packageWords`). */
  #description(item: Plugin | Bundle): readonly Child[] {
    return !("members" in item) && item.box !== undefined && item.description === undefined ? this.#packageWords(item) : [readme(this.#words(item.description ?? item.about), this.#name(item), this.#outsideWords(), { packages: true })];
  }

  /**
   * A package's Overview, from its files at npm's newest, installed or not: its README in the page's language; where it has none in it, the
   * one it has, in Chinese an English README with its Chinese line above it; and with no README to draw, its line, a word where its README
   * could not be read, and the link to its source.
   */
  #packageWords(plugin: Plugin, other?: OwnWords, failed?: "unreachable" | "unread"): readonly Child[] {
    // A README npm or cx's computer gave stands where the files' would, in the language its words are in.
    const given = other !== undefined && "text" in other ? { [langOf(other.text) === "zh-CN" ? "zh" : "en"]: other.text } : undefined;
    const files: { readonly en?: string; readonly zh?: string; readonly base?: string } | undefined = given ?? plugin.box?.readme;
    const outside = this.#outsideWords();
    const own = this.context.language === "zh" ? files?.zh : files?.en;
    if (own !== undefined && own.trim() !== "") return [readme(own, this.#name(plugin), outside, { base: files?.base, repository: plugin.home, packages: true })];
    // With none in the page's language, the README the package has; on the Chinese page an English one keeps the Chinese line the
    // package declared above it, and one that declared none is drawn alone.
    const theirs = this.context.language === "zh" ? files?.en : files?.zh;
    if (theirs !== undefined && theirs.trim() !== "") return [this.context.language === "zh" && plugin.declaredZh !== undefined && h("p", {}, plugin.declaredZh), readme(theirs, this.#name(plugin), outside, { base: files?.base, repository: plugin.home, packages: true })];
    const home = plugin.home;
    // What a package says of itself at length is markdown, as a README is; its card's line is a line.
    const described = plugin.description === undefined ? "" : this.#words(plugin.description);
    const said = this.#words(plugin.about);
    return [
      // A package the page could not read is not one that says nothing of itself.
      described !== "" ? readme(described, this.#name(plugin), outside, { packages: true }) : said !== "" ? h("p", { class: "pl-words", ...authored(said) }, said) : failed === undefined && h("p", { class: "quiet" }, this.#say("pl.own.nothing")),
      other !== undefined && "none" in other && other.none === "large" && h("p", { class: "quiet" }, this.#say("pl.own.tooLong")),
      // Where the installed list failed, the page's own line says so once; no Overview adds a note of a read that failed.
      other !== undefined && "none" in other && other.none === "unread" && !this.context.unread && h("p", { class: "quiet" }, this.#say("pl.us.unread")),
      // npm is named only where npm did not answer.
      failed === "unreachable" && !this.context.unread && h("p", { class: "quiet" }, this.#say("pl.npm.unread")),
      plugin.box?.unread?.includes("readme") === true && !this.context.unread && h("p", { class: "quiet" }, this.#say("pl.pkg.readmeUnread")),
      // Its source is the side's Links' to draw where they hold it: one way out to one place.
      home !== undefined && !this.#outLinks(plugin).some((one) => one.to === home) && h("p", { class: "quiet" }, out(this.context.say, { mark: "code", word: "pl.third.source", to: home }, false)),
    ];
  }

  /**
   * The package's prompt templates, one Try it card each: its words, and the command it runs. A part of the package's files that could
   * not be read says so in their place, once the installed list answers; till then the page's own line is the one note.
   */
  #prompts(plugin: Plugin): Child {
    const prompts = plugin.box?.prompts ?? [];
    const unread = plugin.box?.unread?.includes("prompts") === true && !this.context.unread;
    if (prompts.length === 0 && !unread) return "";
    return h("section", {}, h("h2", {}, this.#say("pl.ov.try")),
      unread && h("p", { class: "quiet" }, this.#say("pl.pkg.promptsUnread")),
      prompts.length > 0 && h("ul", { class: "pl-tries" }, ...prompts.map((prompt) =>
        h("li", {}, h("button", { type: "button", class: "pl-try", "data-focus": `try ${prompt.name}`, onclick: () => void this.#tryPrompt(plugin, prompt) },
          h("span", { class: "quiet", "aria-hidden": "true" }, "› "), this.#words(prompt.about))))));
  }

  /** That a source can be paid with the person's own key, said by what draws the key's row in its Settings: the tab, and a key the source takes. */
  #ownKeyToo(plugin: Plugin): string {
    return this.context.features.sourceKeys && this.#listed(plugin)?.ownKey !== undefined ? this.#words(plugin.source?.ownKey) : "";
  }

  /**
   * The card at the right of an Overview (sheet 3c): how it is paid, the data sources it reads, the security note of a plugin ComChatX did
   * not make, and its links, in that order on every page, each only where it is true.
   */
  #side(item: Plugin | Bundle, plugins: readonly Plugin[], selling?: Plugin): HTMLElement | "" {
    const third = !("members" in item) && item.model === undefined && !madeByUs(item);
    const cells = [this.#pays(item, selling), this.#sources(item, plugins), third ? this.#maker(item) : "", "members" in item ? "" : this.#links(item)].filter((one) => one !== "");
    return cells.length === 0 ? "" : h("aside", { class: "pl-side" }, ...cells);
  }

  /** 计费方式: a source's price and the own-key sentence where it takes a key; a vendor's, what its models cost in the chat. */
  #pays(item: Plugin | Bundle, selling: Plugin | undefined): HTMLElement | "" {
    if (!("members" in item) && item.model !== undefined) {
      const price = this.#cards().modelPrice(item)?.price;
      return price === undefined ? "" : h("section", { class: "pl-part" }, h("h2", {}, this.#say("pl.ov.pay")), h("p", {}, this.#say("pl.c.modelPays")), h("p", {}, this.#say("pl.c.modelPrice", { price })));
    }
    if (selling === undefined || this.#free(selling)) return "";
    const lines = priceLines(this.context, selling);
    const key = this.#ownKeyToo(selling);
    // While the installed list failed, the page's own line is that note: a heading over nothing would read as free.
    if (lines.length === 0 && this.context.unread) return "";
    return h("section", { class: "pl-part" }, h("h2", {}, this.#say("pl.ov.pay")), ...(lines.length > 0 ? lines : [h("p", { class: "quiet" }, this.#say("pl.us.unread"))]), key !== "" && h("p", { class: "pl-own-key" }, key));
  }

  /** 数据源: the sources a plugin reads, or a bundle installs, each one link with its price; none where nothing was read or it is that source. */
  #sources(item: Plugin | Bundle, plugins: readonly Plugin[]): HTMLElement | "" {
    const held = this.context.held;
    if (!("members" in item) && (item.own === true || item.npm !== undefined || isBase(held, item))) return "";
    const paid = "members" in item ? installsOf(held, item).filter((plugin) => plugin.source !== undefined) : [...new Set(plugins.flatMap((plugin) => sourcesOf(held, plugin)))];
    if (paid.length === 0 || (paid.length === 1 && paid[0]!.id === item.id)) return "";
    return h("section", { class: "pl-part" }, h("h2", {}, this.#say("pl.side.title")), h("ul", { class: "pl-plain" }, ...paid.map((plugin) => {
      const source = held.sources.find((one) => one.name === plugin.source?.name);
      // The row is one link: the mark, the supplier, and under it the price and, where the source is not buying, why; on that source's own page it says it is this page.
      const state = source === undefined || !installed(held, plugin) ? this.#say("pl.side.notInstalled") : !readsOn(held, plugin) ? this.#say("pl.off") : undefined;
      return h("li", {}, h("a", { class: "pl-side-row", href: href.item(plugin), "aria-current": href.item(plugin) === href.item(item) ? "page" : undefined }, this.context.tile(plugin),
        h("span", { class: "pl-side-name" }, h("span", { class: "pl-side-word" }, this.#name(plugin)), h("span", { class: "quiet" }, [this.#payLine(source, true), state].filter((one) => one !== undefined && one !== "").join(" · ")))));
    })));
  }

  /** A plugin ComChatX did not make: the one note every third-party plugin carries, the trust dialog's own. */
  #maker(plugin: Plugin): HTMLElement {
    return h("section", { class: "pl-part pl-maker" }, h("h2", {}, this.#say("pl.third.title")),
      h("p", {}, this.#say(plugin.own === true && plugin.npm === undefined ? "pl.own.note" : "pl.third.note")));
  }

  /**
   * Its links, as a card's foot has them, for every plugin npm holds, ours too: npm, the repository, its own website where it names one
   * that is not its repository, and 反馈 to a GitHub repository's issues; one installed from elsewhere links its source alone.
   */
  #outLinks(plugin: Plugin): readonly OutLink[] {
    const npm = this.#npmOf(plugin);
    const read = typeof npm === "object" ? npm : plugin.onNpm;
    return outLinks(plugin.npm ?? plugin.onNpm?.name, read?.repository ?? httpsAddress(shippedOf(this.context.held, plugin).home) ?? plugin.home, read?.homepage);
  }

  #links(plugin: Plugin): HTMLElement | "" {
    return pageLinks(this.context.say, this.#outLinks(plugin)) ?? "";
  }

  /** Who pays for a source, in the one sentence every surface uses. */
  #payLine(source: Source | undefined, short = false): string {
    if (source === undefined || this.context.money === undefined || source.unitsPerNative === undefined) return "";
    if (payerOf(source) === "key") return this.#say(short ? "pl.src.keyShort" : "pl.src.key", { supplier: source.supplier });
    return short ? scaleOf(this.context, source, true) ?? unitPrice(source, this.context.money) : this.#say("pl.src.platform", { price: unitPrice(source, this.context.money) });
  }

  /** The plugins it builds on itself, each as its one row (sheet 3): under 必需 what installs with it, under 可选 what it can work without. */
  #deps(plugin: Plugin): readonly Child[] {
    const held = this.#heldFor(plugin);
    const group = (need: "required" | "optional"): Child => {
      const some = directOf(held, plugin).filter((one) => one.need === need);
      return some.length > 0 && h("section", { class: "pl-need" }, h("h2", {}, this.#say(`pl.dp.${need}`)), h("ul", { class: "pl-list pl-rows" }, ...some.map((one) => this.context.row(one.plugin))));
    };
    return [group("required"), group("optional")];
  }

  /** A bundle's 插件 tab: each plugin it installs as its one row (sheet 3), in the order its count counts them. */
  #bundlePlugins(bundle: Bundle): readonly Child[] {
    return [h("ul", { class: "pl-list pl-rows" }, ...installsOf(this.context.held, bundle).map((plugin) => this.context.row(plugin)))];
  }

  /** The source's record as the platform lists it, installed or not: a source removed keeps its month, its price and what was saved for it. */
  #listed(plugin: Plugin): Source | undefined { return this.context.held.sources.find((one) => one.name === plugin.source?.name); }

  /** A source the platform lists with no price: it costs nothing, and no Pricing or payer is drawn for it. */
  /**
   * A package's page as the source it sells: its own record's, else the source the gate lists under the package's name (the gate names
   * a source by its manifest's), else the one a record of the same package names; the words for its requests are that record's.
   */
  #selling(plugin: Plugin): Plugin | undefined {
    const name = plugin.box?.package;
    if (plugin.source !== undefined || name === undefined) return plugin.source === undefined ? undefined : plugin;
    const { catalogue, sources } = this.context.held;
    const record = catalogue.plugins.find((one) => one.source !== undefined && one.box?.package === name)?.source;
    const listed = sources.some((one) => one.name === name) ? name : record?.name;
    return listed === undefined ? undefined : { ...plugin, source: { ...(record ?? { aspects: {} }), name: listed } };
  }

  #free(plugin: Plugin): boolean { const source = this.#listed(plugin); return source !== undefined && source.unitsPerNative === undefined; }

  /**
   * A source's Settings: the stores it is connected to, where the gate lists it with stores; how old data may be before cx buys it again,
   * and who pays — the balance or the person's own key, one at a time — where the platform serves those. Drawn whether the source is
   * installed or not: what is saved waits for it.
   */
  #sourceSettings(plugin: Plugin): readonly Child[] {
    const source = this.#listed(plugin);
    if (this.context.unread) return [];
    if (source === undefined) return [h("p", {}, this.#say("pl.ms.install"))];
    if (source.checksFields === true && source.connections === undefined) return [this.#fieldsSettings(plugin, source)];
    const stores = source.connections === undefined || source.paired !== true ? [] : this.#paired(plugin, source, source.connections);
    if (!this.context.features.sourceKeys) return stores;
    return [...stores, ...this.#keySettings(source)];
  }

  /**
   * cx-feishu's: the Feishu bot cx posts to. The steward hands the address to pi-channels when cx's computer starts, so a saved or removed
   * address counts from its next start, as the line under it says.
   */
  #feishuSettings(): readonly Child[] {
    const saved = this.#feishu;
    const title = h("h2", {}, this.#say("pl.fs.title"));
    if (saved === undefined) return [h("section", { class: "pl-setting" }, title, h("p", { class: "quiet" }, this.#say("pl.us.unread")))];
    const backend = this.context.backend;
    if (saved !== "") {
      const remove = (): Promise<void> => this.#act(async () => { await backend.removeFeishu(); this.#feishu = ""; }, () => { this.context.tell?.(this.#say("pl.fs.removed")); return undefined; })
        .then((done) => placed(this.element, done ? "feishu" : "feishu-remove")?.focus());
      return [h("section", { class: "pl-setting" }, title,
        h("p", { class: "quiet" }, this.#say("pl.fs.label")),
        h("div", { class: "pl-saved" }, h("span", { class: "pl-words", lang: "en", tabindex: "-1", "data-focus": "feishu-saved", "aria-describedby": "feishu-next" }, saved),
          this.#waits.ring("feishu-remove", h("button", { type: "button", "data-focus": "feishu-remove", "data-removes": true, onclick: this.#waits.press("feishu-remove", remove) }, this.#say("pl.c.remove")))),
        h("p", { class: "quiet pl-after", id: "feishu-next" }, this.#say("pl.fs.next")))];
    }
    const field = h("input", { type: "url", id: "feishu", placeholder: `${FEISHU_HOOK_PREFIX}…`, autocomplete: "off", spellcheck: "false", "data-focus": "feishu", "aria-describedby": "feishu-note feishu-help" }) as HTMLInputElement;
    field.value = this.#feishuDraft;
    field.addEventListener("input", () => { this.#feishuDraft = field.value; });
    const noted = (key: StringKey): void => { this.#feishuNote = key; this.again(); placed(this.element, "feishu")?.focus(); };
    const save = async (): Promise<void> => {
      const value = this.#feishuDraft.trim();
      if (value === "") { noted("pl.fs.empty"); return; }
      const hook = readFeishuHook(value);
      if (hook === undefined) { noted("pl.fs.wrong"); return; }
      await this.#act(async () => { await backend.saveFeishu(hook); this.#feishu = hook; this.#feishuDraft = ""; this.#feishuNote = undefined; }, () => { this.context.tell?.(this.#say("pl.st.saved")); return undefined; })
        .then((done) => placed(this.element, done ? "feishu-saved" : "feishu")?.focus());
    };
    field.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); void this.#waits.run("feishu-save", save, placed(this.element, "feishu-save")); } });
    return [h("section", { class: "pl-setting" }, title,
      h("p", {}, this.#say("pl.fs.none")),
      h("label", { class: "pl-field pl-label", for: "feishu" }, this.#say("pl.fs.label")),
      h("div", { class: "pl-fieldrow" }, field, this.#waits.ring("feishu-save", h("button", { type: "button", class: "primary", "data-focus": "feishu-save", onclick: this.#waits.press("feishu-save", save) }, this.#say("pl.ms.save")))),
      h("p", { class: "quiet pl-field-note", id: "feishu-note", role: "status" }, this.#feishuNote === undefined ? "" : this.#say(this.#feishuNote)),
      h("p", { class: "quiet", id: "feishu-help" }, this.#say("pl.fs.help")))];
  }

  /** Who pays for a source, its rows saying which pays: the key's row says a key is saved, the balance's offers itself where the key pays. */
  #keySettings(source: Source): readonly Child[] {
    const key = payerOf(source) === "key";
    const backend = this.context.backend;
    const holder = this.#say("pl.src.keyPh", { supplier: source.supplier });
    const field = h("input", { type: "password", class: "pl-key", placeholder: holder, "aria-label": holder, autocomplete: "off", size: String(holdsWords(holder)) });
    const keyNote = h("p", { class: "quiet pl-field-note", role: "status" });
    const row = (way: "platform" | "key", line: string, ...act: readonly Child[]): HTMLElement => h("li", {}, h("div", { class: "pl-row pl-way-row" },
      h("span", { class: "pl-row-text" }, h("strong", {}, this.#say(way === "platform" ? "card.platform" : "pl.way.key")), h("span", { class: "quiet" }, line)),
      h("span", { class: "pl-way-act" }, ...act)));
    // Either press takes its own control away with the key: the keyboard goes to the key's row, where one can be saved again.
    const toBalance = (word: StringKey): HTMLElement => this.#waits.ring(`key-remove ${source.name}`, h("button", { type: "button", "data-focus": word === "pl.src.use" ? "way-platform" : "way-forget", "data-removes": word === "pl.ms.forget" ? true : undefined,
      onclick: this.#waits.press(`key-remove ${source.name}`, () => this.#act(() => backend.removeSourceKey(source.name)).then((done) => { if (done) placed(this.element, "way-key")?.focus(); })) }, this.#say(word)));
    const save = async (): Promise<void> => {
      const value = field.value.trim();
      if (value === "") { keyNote.textContent = this.#say("pl.st.keyEmpty"); field.focus(); return; }
      await this.#act(() => backend.saveSourceKey(source.name, value));
    };
    const pay = source.unitsPerNative === undefined ? "" : h("section", { class: "pl-setting" }, h("h2", {}, this.#say("pl.st.pay")),
      h("ul", { class: "pl-list pl-way-list" },
        row("platform", this.#say("pl.src.platform", { price: this.context.money === undefined ? "" : unitPrice(source, this.context.money) }), key && toBalance("pl.src.use")),
        source.ownKey !== undefined && row("key", this.#say("pl.src.key", { supplier: source.supplier }), ...(key
          // Save's place is held by the word that the key is saved, which takes the keyboard and no press: a second press of the
          // key that saved it changes nothing, where Remove key in that place would delete the key just saved.
          ? [h("span", { class: "quiet", tabindex: "-1", "data-focus": "way-key" }, this.#say("pl.ms.keySaved")), toBalance("pl.ms.forget")]
          : [field, this.#waits.ring(`key-save ${source.name}`, h("button", { type: "button", class: "primary", "data-focus": "way-key", onclick: this.#waits.press(`key-save ${source.name}`, save) }, this.#say("pl.ms.save"))), keyNote]))));
    // A change of who pays is said by the rows themselves.
    return [pay];
  }

  /**
   * A source's own fields in one form, each named in the package's words (`comchatx.source.fields`), else by the gate's name for it, and
   * typed hidden where the gate marks it secret. A field saved says so in its place and is never read back: typed again it is replaced,
   * left empty it stays. Save sends what is typed in one request, which the platform saves at the gate and checks; the answer is said
   * where the seller reads it: connected, the supplier's refusal in its words, or a field the gate refused, under that field. Remove
   * clears every field and turns the source off.
   */
  #fieldsSettings(plugin: Plugin, source: Source): HTMLElement {
    if (this.#fieldsForm?.source !== source.name) this.#fieldsForm = { source: source.name, values: {}, checking: false };
    const form = this.#fieldsForm;
    const saved = source.fields ?? {};
    const names = Object.keys(saved);
    const words = plugin.source?.fields ?? {};
    const label = (field: string): string => words[field]?.label[this.context.language] ?? field;
    const anySaved = names.some((field) => saved[field]);
    const connected = source.enabled && names.length > 0 && names.every((field) => saved[field]);
    const field = (name: string): HTMLElement => {
      const help = words[name]?.help?.[this.context.language];
      const refused = form.refusal?.field === name ? form.refusal : undefined;
      const described = [help !== undefined ? `sf-help-${name}` : undefined, refused !== undefined ? `sf-refused-${name}` : undefined, "sf-note"].filter((one) => one !== undefined).join(" ");
      const input: HTMLInputElement = h("input", { type: source.secretFields?.includes(name) === true ? "password" : "text", class: "pl-store-field", autocomplete: "off", spellcheck: "false", "data-focus": `sf-${name}`,
        placeholder: saved[name] ? this.#say("pl.sf.savedPh") : "", "aria-describedby": described, "aria-invalid": refused !== undefined ? "true" : undefined, readonly: form.checking ? true : undefined,
        oninput: () => { form.values[name] = input.value; } });
      input.value = form.values[name] ?? "";
      return h("div", {}, h("label", { class: "pl-field" }, h("span", {}, label(name)), input),
        help !== undefined && h("p", { class: "quiet", id: `sf-help-${name}` }, help),
        refused !== undefined && h("p", { class: "pl-failed", id: `sf-refused-${name}`, role: "alert" }, h("span", { class: "pl-failed-text" }, this.#say("pl.sf.fieldRefused", { label: label(name) }), " ",
          h("span", { class: "pl-store-words", lang: "en" }, this.#say("signIn.quoted", { words: refused.words })))));
    };
    const help = plugin.source?.help;
    const refusal = form.refusal !== undefined && form.refusal.field === undefined ? form.refusal : undefined;
    const remove = (): Promise<unknown> => this.#act(() => this.context.backend.removeSourceKey(source.name), () => { this.#fieldsForm = undefined; this.context.tell?.(this.#say("pl.sf.removed")); return undefined; })
      .then(() => placed(this.element, `sf-${names[0] ?? ""}`)?.focus());
    return h("section", { class: "pl-setting" }, h("h2", {}, this.#say("pl.sf.title")),
      connected && h("p", { tabindex: "-1", "data-focus": "sf-connected" }, this.#say("pl.ms.connected")),
      h("div", { class: "pl-store-form" }, ...names.map(field)),
      help !== undefined && h("p", { class: "quiet" }, h("a", { href: help, target: "_blank", rel: "noopener", "data-focus": "sf-how" }, this.#say("pl.sf.howToGet"), h("span", { class: "pl-sr" }, this.#say("pl.third.outside")))),
      refusal !== undefined && h("p", { class: "pl-failed", role: "alert" }, h("span", { class: "pl-failed-text" }, this.#say("pl.sf.refused"),
        refusal.words.trim() !== "" && " ", refusal.words.trim() !== "" && h("span", { class: "pl-store-words", lang: "en" }, this.#say("signIn.quoted", { words: refusal.words })))),
      h("p", { class: "quiet pl-field-note", id: "sf-note", role: "status" }, form.note ?? ""),
      h("p", { class: "pl-after" }, form.checking
        ? h("button", { type: "button", class: "pl-busy", "aria-disabled": "true", "aria-busy": "true", "data-focus": "sf-save" }, this.#say("pl.sf.checking"))
        : h("button", { type: "button", class: "primary", "data-focus": "sf-save", onclick: () => void this.#saveFields(source, form) }, this.#say("pl.ms.save")),
        anySaved && !form.checking && " ", anySaved && !form.checking && this.#waits.ring(`fields-remove ${source.name}`, h("button", { type: "button", "data-focus": "sf-remove", "data-removes": true, onclick: this.#waits.press(`fields-remove ${source.name}`, remove) }, this.#say("pl.c.remove")))));
  }

  /**
   * Saves what is typed: every field typed or saved before, else the note names what is missing and nothing is sent; then one request,
   * whose answer the form says. With every field saved and none typed, it sends no value and the check reads the saved ones. A field
   * saved before a refusal stays saved, as the platform keeps it, and the list read again says so.
   */
  async #saveFields(source: Source, form: FieldsForm): Promise<void> {
    if (form.checking) return;
    const names = Object.keys(source.fields ?? {});
    const typed = Object.fromEntries(names.flatMap((name) => { const value = (form.values[name] ?? "").trim(); return value === "" ? [] : [[name, value]]; }));
    const empty = names.find((name) => typed[name] === undefined && source.fields?.[name] !== true);
    form.note = empty !== undefined ? this.#say("pl.sp.fillAll") : undefined;
    if (form.note !== undefined) { this.again(); placed(this.element, `sf-${empty}`)?.focus(); return; }
    form.checking = true;
    form.refusal = undefined;
    this.context.announce?.(this.#say("pl.sf.checking"));
    this.again();
    placed(this.element, "sf-save")?.focus();
    let check: FieldsCheck = { ok: false, words: "" };
    const done = await this.#act(async () => { check = await this.context.backend.saveSourceFields(source.name, typed); }, () => { if (check.ok) this.context.tell?.(this.#say("pl.ms.connected")); return undefined; });
    form.checking = false;
    const answered = check as FieldsCheck;
    if (done && answered.ok) { this.#fieldsForm = undefined; this.again(); placed(this.element, "sf-connected")?.focus(); return; }
    if (done && !answered.ok) {
      if (answered.missing === true) form.note = this.#say("pl.sp.fillAll");
      else form.refusal = { ...(answered.field === undefined ? {} : { field: answered.field }), words: answered.words };
      // What was refused is typed again; what was saved before it is said saved by the list read again.
      if (answered.field !== undefined) for (const name of names) if (name !== answered.field && typed[name] !== undefined && names.indexOf(name) < names.indexOf(answered.field)) delete form.values[name];
    }
    this.again();
    placed(this.element, answered.ok ? "sf-save" : `sf-${answered.field ?? names[0] ?? ""}`)?.focus();
  }

  /**
   * A place by its ISO 3166 country code, as the page's language names the country: one name on one line, its words held by no-break
   * spaces, so a line breaks between two names and never inside one.
   */
  #place(code: string): string {
    const named = (): string => { try { return new Intl.DisplayNames([this.context.language === "zh" ? "zh-CN" : "en"], { type: "region" }).of(code) ?? code; } catch { return code; } };
    return named().replace(/ /g, "\u00a0");
  }

  /** Places in a line, joined as round 27 joins them: a comma in English, 、 in Chinese, and no "and". */
  #places(names: readonly string[]): string {
    return names.join(this.context.language === "zh" ? "、" : ", ");
  }

  /** A region by its package's name of it, else by the word the gate lists it under. */
  #region(plugin: Plugin, region: string): string {
    return plugin.source?.regions?.[region]?.[this.context.language] ?? region;
  }

  /** A paired source's own line, in the page's language, its placeholders filled; none where its package declares none. */
  #line(plugin: Plugin, line: SourceLine, values: Readonly<Record<string, string>> = {}): string | undefined {
    const said = plugin.source?.lines?.[line]?.[this.context.language];
    return said?.replace(/\{([a-z]+)\}/g, (whole, name: string) => values[name] ?? whole);
  }

  /** A field's name on a source's form: its package's words, else the field's word. */
  #fieldName(plugin: Plugin, field: string): string {
    return plugin.source?.fields?.[field]?.label[this.context.language] ?? field;
  }

  /** The names what the connections' last checks reached go by, each once, in the supplier's order. */
  #rowNames(rows: readonly StoreConnection[]): readonly string[] {
    return [...new Set(rows.flatMap((one) => (one.accounts ?? []).map(({ name }) => name)).filter((name) => name !== ""))];
  }

  /** The fields a connection is saved with that a seller types: those the source declares secret. The gate names the rest. */
  #tokenFields(source: Source): readonly string[] {
    return (source.connectionFields ?? []).filter(({ secret }) => secret).map(({ name }) => name);
  }

  /**
   * What a row says: the names what its last check reached go by, then a line a region, its name and the places in it, in the package's
   * `sells` where it declares one, a place whose region is not known last and alone; then what the last check said where it was no whole
   * list: a refusal, alone and in the failure's colour; the regions that did not answer; that it listed none. A place's region is the one
   * whose host listed it, else its connection's. A connection never checked says nothing of what it reaches, and one of the earlier shape,
   * a store in a region, its region.
   */
  #rowLines(plugin: Plugin, one: StoreConnection): readonly Child[] {
    if (one.refused === true) return [h("span", { class: "pl-row-failed" }, this.#line(plugin, "refused") ?? "")];
    const names = this.#rowNames([one]);
    const reached = one.accounts ?? [];
    const regionOf = (reach: GrantAccount): string | undefined => reach.region ?? one.region;
    const regions = [...new Set(reached.map(regionOf))].sort((x, y) => (x === undefined ? 1 : y === undefined ? -1 : 0));
    const placesIn = (region: string | undefined): string => {
      const places = this.#places([...new Set(reached.filter((reach) => regionOf(reach) === region).map(({ country }) => country))].map((code) => this.#place(code)));
      return this.#line(plugin, "sells", { places }) ?? places;
    };
    const silent = one.silent ?? [];
    return [
      names.length > 0 && h("strong", {}, this.#places(names)),
      one.accounts === undefined && one.region !== undefined && h("strong", {}, this.#region(plugin, one.region)),
      ...regions.map((region) => h("span", { class: "quiet" }, [region === undefined ? undefined : this.#region(plugin, region), placesIn(region)].filter((part) => part !== undefined).join(" · "))),
      silent.length > 0 && h("span", { class: "quiet" }, this.#line(plugin, "silent", { regions: this.#places(silent.map((region) => this.#region(plugin, region))) }) ?? ""),
      one.accounts !== undefined && one.accounts.length === 0 && silent.length === 0 && h("span", { class: "quiet" }, this.#line(plugin, "none") ?? ""),
    ];
  }

  /** The form of a paired source where it stands, the one held where it is this source's and that place's, else a fresh one. */
  #pairFormAt(source: Source, at: string): PairForm {
    if (this.#pairForm?.source !== source.name || this.#pairForm.at !== at) {
      this.#pairForm = { source: source.name, at, values: {}, checking: false };
    }
    return this.#pairForm;
  }

  /**
   * A paired source's Settings: its client pairs, each headed by its Client identifier, whole, with its own Remove, and under each the
   * connections granted to it, each a row under what Amazon answered, with its own Remove; under a pair's last row the press that adds
   * one more under it, and below the last pair, once, the press that adds a pair. A press opens its form where it stood. With none held,
   * the form alone. Nothing drawn reads the source's name: its words are its package's.
   */
  #paired(plugin: Plugin, source: Source, connections: readonly StoreConnection[]): readonly Child[] {
    const listed = source.pairs ?? [];
    const pairOf = (one: StoreConnection): string => one.pair ?? FIRST_PAIR;
    // A connection whose pair is not listed still stands under its pair's name, so its Remove is reached.
    const pairs: readonly SourcePair[] = [...listed, ...[...new Set(connections.map(pairOf))].filter((name) => !listed.some((one) => one.name === name)).map((name) => ({ name, fields: {} }))];
    const open = this.#pairForm?.source === source.name ? this.#pairForm.at : undefined;
    if (pairs.length === 0) return [this.#pairFormDrawn(plugin, source, this.#pairFormAt(source, FIRST_PAIR), true)];
    const backend = this.context.backend;
    // After a row's Remove the keyboard goes to the press that adds under its pair; with the pair gone, to the press that adds a pair; with nothing left, to the form.
    const landed = (pair: string): void => { (placed(this.element, `add ${pair}`) ?? placed(this.element, "add-pair") ?? placed(this.element, "sp-client_id"))?.focus(); };
    // A removal that failed leaves the keyboard on the Remove pressed.
    const removeRow = (one: StoreConnection): Promise<unknown> => this.#act(() => backend.removeConnection(source.name, one.store), () => { this.context.tell?.(this.#say("pl.gr.removed")); return undefined; })
      .then((done) => { if (done) landed(pairOf(one)); else placed(this.element, `remove ${one.store}`)?.focus(); });
    const row = (one: StoreConnection): HTMLElement => {
      const names = this.#rowNames([one]);
      const said = names.length > 0 ? this.#places(names) : one.refused === true ? this.#line(plugin, "refused") : one.accounts?.length === 0 ? this.#line(plugin, "none") : undefined;
      return h("li", {}, h("div", { class: "pl-row pl-way-row", tabindex: "-1", "data-focus": `row ${one.store}` },
        h("span", { class: "pl-row-text" }, ...this.#rowLines(plugin, one)),
        h("span", { class: "pl-way-act" }, this.#waits.ring(`row-remove ${source.name}\u0000${one.store}`, h("button", { type: "button", "data-focus": `remove ${one.store}`, "data-removes": true,
          "aria-label": said === undefined ? undefined : `${this.#say("pl.c.remove")} ${said}`, onclick: this.#waits.press(`row-remove ${source.name}\u0000${one.store}`, () => removeRow(one)) }, this.#say("pl.c.remove"))))));
    };
    const opened = (at: string, first: string) => (): void => { this.#pairForm = undefined; this.#pairFormAt(source, at); this.again(); placed(this.element, first)?.focus(); };
    const add = this.#line(plugin, "add");
    const token = this.#tokenFields(source)[0];
    const group = (pair: SourcePair): readonly Child[] => {
      const mine = connections.filter((one) => pairOf(one) === pair.name);
      const [field, value] = Object.entries(pair.fields)[0] ?? [];
      return [
        h("div", { class: "pl-pair" },
          h("h3", {}, field !== undefined && h("span", {}, this.#fieldName(plugin, field)), field !== undefined && " ", value !== undefined && h("span", { class: "pl-pair-id" }, value)),
          this.#waits.ring(`pair-remove ${source.name}\u0000${pair.name}`, h("button", { type: "button", "data-focus": `remove-pair ${pair.name}`, "data-removes": true,
            "aria-label": value === undefined ? undefined : `${this.#say("pl.cl.remove")} ${value}`, onclick: (event: Event) => { const pressed = event.currentTarget as HTMLElement | undefined; void this.#askRemovePair(plugin, source, pair, mine, (work) => this.#waits.run(`pair-remove ${source.name}\u0000${pair.name}`, work, pressed)); } }, this.#say("pl.cl.remove")))),
        mine.length > 0 && h("ul", { class: "pl-list pl-way-list" }, ...mine.map(row)),
        open === pair.name ? this.#pairFormDrawn(plugin, source, this.#pairFormAt(source, pair.name), false)
          : add !== undefined && h("p", { class: "pl-after" }, h("button", { type: "button", "data-focus": `add ${pair.name}`, "aria-label": value === undefined ? undefined : `${add} ${value}`, onclick: opened(pair.name, `sp-${token ?? ""}`) }, add)),
      ];
    };
    return [h("section", { class: "pl-setting" }, h("h2", {}, this.#line(plugin, "rows") ?? ""), ...pairs.flatMap(group),
      open === "new" ? this.#pairFormDrawn(plugin, source, this.#pairFormAt(source, "new"), false)
        : h("p", { class: "pl-after pl-add-pair" }, h("button", { type: "button", "data-focus": "add-pair", onclick: opened("new", "sp-client_id") }, this.#say("pl.cl.add"))))];
  }

  /**
   * A paired source's form: with no pair held, a section of its own, as the first visit draws it; under a pair, the refresh token alone,
   * the place saying whose it is; below the last pair, the pair and its first token. The two in the list are put away with Cancel.
   */
  #pairFormDrawn(plugin: Plugin, source: Source, form: PairForm, first: boolean): HTMLElement {
    const tokens = this.#tokenFields(source);
    const asked = form.at === FIRST_PAIR && first || form.at === "new" ? [...Object.keys(source.fields ?? {}), ...tokens] : tokens;
    const field = (key: string): HTMLElement => {
      // Masked unless the source declares the field not secret: one of its own fields its listing names and leaves out of the secret ones.
      const clear = source.secretFields !== undefined && Object.hasOwn(source.fields ?? {}, key) && !source.secretFields.includes(key);
      const input: HTMLInputElement = h("input", { type: clear ? "text" : "password", class: "pl-store-field", autocomplete: "off", spellcheck: "false", "data-focus": `sp-${key}`, "aria-describedby": "pl-store-note", readonly: form.checking ? true : undefined,
        oninput: () => { form.values[key] = input.value; } });
      input.value = form.values[key] ?? "";
      // A form of one field connects on Enter, as the page's other one-field forms save.
      if (asked.length === 1) input.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); void this.#connectPaired(plugin, source, form, asked, tokens); } });
      return h("label", { class: "pl-field" }, h("span", {}, this.#fieldName(plugin, key)), input);
    };
    const help = plugin.source?.help;
    const checking = this.#line(plugin, "checking") ?? this.#say("pl.sp.connect");
    // Cancel gives the keyboard back to the press that opened the form.
    const cancel = (): void => { this.#pairForm = undefined; this.again(); placed(this.element, form.at === "new" ? "add-pair" : `add ${form.at}`)?.focus(); };
    const body: readonly Child[] = [
      h("div", { class: "pl-store-form" }, ...asked.map(field)),
      help !== undefined && h("p", { class: "quiet" }, h("a", { href: help, target: "_blank", rel: "noopener", "data-focus": "sp-how" }, this.#say("pl.sp.howToGet"), h("span", { class: "pl-sr" }, this.#say("pl.third.outside")))),
      form.refusal !== undefined && h("p", { class: "pl-failed", role: "alert" }, h("span", { class: "pl-failed-text" }, this.#say("pl.sp.refused"),
        form.refusal.trim() !== "" && " ", form.refusal.trim() !== "" && h("span", { class: "pl-store-words", lang: "en" }, this.#say("signIn.quoted", { words: form.refusal })))),
      form.none === true && h("p", { class: "pl-failed", role: "alert" }, h("span", { class: "pl-failed-text" }, this.#line(plugin, "foundNone") ?? "")),
      h("p", { class: "quiet pl-field-note", id: "pl-store-note", role: "status" }, form.note ?? ""),
      h("p", { class: "pl-after row" }, form.checking
        ? h("button", { type: "button", class: "pl-busy", "aria-disabled": "true", "aria-busy": "true", "data-focus": "sp-connect" }, checking)
        : h("button", { type: "button", class: "primary", "data-focus": "sp-connect", onclick: () => void this.#connectPaired(plugin, source, form, asked, tokens) }, this.#say("pl.sp.connect")),
        !first && !form.checking && " ", !first && !form.checking && h("button", { type: "button", "data-focus": "sp-cancel", onclick: cancel }, this.#say("pl.c.cancel"))),
    ];
    if (first) return h("section", { class: "pl-setting" }, h("h2", {}, this.#line(plugin, "connect") ?? ""), h("p", {}, this.#line(plugin, "canChange") ?? ""), ...body);
    return h("div", { class: "pl-pair-add" }, h("h3", {}, form.at === "new" ? this.#say("pl.cl.add") : this.#line(plugin, "add") ?? ""), ...body);
  }

  /**
   * Connects at a paired source: every field asked filled, then one request. With no pair held, or below the last, a new pair with its
   * first connection, which the platform keeps only if Amazon takes the token; under a pair, the token alone. Answered as a store's connect
   * is, and on a pass the keyboard is on the new row.
   */
  async #connectPaired(plugin: Plugin, source: Source, form: PairForm, asked: readonly string[], tokens: readonly string[]): Promise<void> {
    if (form.checking) return;
    const empty = asked.find((key) => (form.values[key] ?? "").trim() === "");
    form.note = empty !== undefined ? this.#say("pl.sp.fillAll") : undefined;
    if (empty !== undefined) { this.again(); placed(this.element, `sp-${empty}`)?.focus(); return; }
    form.checking = true;
    form.refusal = undefined;
    form.none = false;
    this.context.announce?.(this.#line(plugin, "checking") ?? this.#say("pl.sp.connect"));
    this.again();
    placed(this.element, "sp-connect")?.focus();
    const backend = this.context.backend;
    const value = (key: string): string => (form.values[key] ?? "").trim();
    const connection = Object.fromEntries(tokens.map((key) => [key, value(key)]));
    let check: ConnectionCheck = { ok: false, words: "" };
    const done = await this.#act(async () => {
      check = asked.length > tokens.length
        ? await backend.addPair(source.name, { fields: Object.fromEntries(asked.filter((key) => !tokens.includes(key)).map((key) => [key, value(key)])), connection })
        : await backend.connectUnder(source.name, form.at, connection);
    }, () => {
      const said = check.ok ? this.#line(plugin, "connected") : undefined;
      if (said !== undefined) this.context.tell?.(said);
      return undefined;
    });
    form.checking = false;
    const answered = check as ConnectionCheck;
    // A form the seller opened while this one ran is theirs: it keeps what was typed, and the keyboard stays in it.
    const mine = this.#pairForm === form;
    const typing = (globalThis.document?.activeElement as HTMLElement | null | undefined)?.getAttribute?.("data-focus") ?? undefined;
    const back = (): void => { if (typing !== undefined) placed(this.element, typing)?.focus(); };
    if (done && answered.ok) {
      if (mine) this.#pairForm = undefined;
      this.again();
      if (mine) ((answered.connection === undefined ? undefined : placed(this.element, `row ${answered.connection}`)) ?? this.element.querySelector<HTMLElement>(".pl-tabbody .pl-way-row"))?.focus();
      else back();
      return;
    }
    if (done && !answered.ok && answered.none === true) form.none = true;
    else if (done && !answered.ok) form.refusal = answered.words;
    this.again();
    if (mine) placed(this.element, "sp-connect")?.focus();
    else back();
  }

  /**
   * Remove Client identifier: a pair whose rows name what goes with it asks first, on a card that names it, since no other pair could use
   * their tokens; one whose rows name nothing goes at once. Cancel or Escape on the card gives the keyboard back to the press. The press
   * shows work only once the removal runs (`run`), never while the card asks.
   */
  #askRemovePair(plugin: Plugin, source: Source, pair: SourcePair, rows: readonly StoreConnection[], run: (work: () => Promise<unknown>) => Promise<void>): Promise<unknown> {
    let done = false;
    const go = (): Promise<unknown> => run(async () => { done = await this.#act(() => this.context.backend.removePair(source.name, pair.name), () => { this.context.tell?.(this.#say("pl.cl.removed")); return undefined; }); })
      // A removal that failed leaves the keyboard on Remove Client identifier.
      .then(() => (done ? placed(this.element, "add-pair") ?? placed(this.element, "sp-client_id") : placed(this.element, `remove-pair ${pair.name}`))?.focus());
    const names = this.#rowNames(rows);
    if (names.length === 0) return go();
    return new Promise<void>((resolve) => {
      const dialog = h("dialog", { class: "confirm pl-card-dialog", "aria-labelledby": "pl-card-title", tabindex: "-1", "data-card": "remove-pair" }) as HTMLDialogElement;
      const close = (removing: boolean): void => {
        dialog.close?.();
        dialog.remove();
        if (removing) { void go().then(() => resolve()); return; }
        placed(this.element, `remove-pair ${pair.name}`)?.focus();
        resolve();
      };
      dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(false); });
      const middle = h("div", { class: "pl-card-body", tabindex: "-1" }, h("p", {}, this.#line(plugin, "removedWith", { names: this.#places(names) }) ?? ""));
      dialog.append(
        h("div", { class: "pl-card-head" }, h("div", { class: "pl-card-headtext" }, h("h2", { id: "pl-card-title" }, this.#say("pl.cl.removeTitle")))),
        middle,
        h("p", { class: "row pl-card-acts" },
          h("button", { type: "button", "data-focus": "card-cancel", onclick: () => close(false) }, this.#say("pl.c.cancel")),
          h("button", { type: "button", class: "primary", "data-focus": "card-remove", onclick: () => close(true) }, this.#say("pl.c.remove"))));
      (this.context.cards?.() ?? globalThis.document.body).append(dialog);
      if (typeof dialog.showModal === "function") dialog.showModal();
      middle.focus?.({ preventScroll: true });
    });
  }

  /** The ways a model plugin holds, in cx's order of use, as one sentence; a model that is off says so. */
  #order(plugin: Plugin): string {
    const model = modelOf(this.context.held, plugin);
    if (model === undefined) return "";
    if (!model.enabled) return this.#say("pl.order.off", { name: this.#name(plugin) });
    return orderOf(this.context.held, plugin, this.context.say, this.context.language) ?? "";
  }

  /** Who bills a way, as Settings and the Overview say it. */
  #billed(plugin: Plugin, way: Way): readonly Child[] {
    return [this.#say(`pl.bill.${way}`, { vendor: wayName(plugin, way, this.#say, this.context.language) })];
  }

  /**
   * The ways the world lists for a maker, and whether each is connected: one answer for the Overview and Settings alike. A key or a
   * sign-in is drawn where the platform lists its provider among the record's: there is a route behind it.
   */
  /** The page's own read of keys, which every reload refreshes, where it answered; else this record's: the one testimony of a key held. */
  #providers(): readonly Provider[] {
    return this.context.held.providers ?? this.#modelReads?.providers ?? [];
  }

  #wayStates(plugin: Plugin): readonly Door[] {
    const model = modelOf(this.context.held, plugin);
    // The page's own read of accounts, which every reload refreshes, where it answered; else this record's.
    const accounts = this.context.held.accounts ?? this.#modelReads?.accounts ?? [];
    const providers = this.#providers();
    // Where ways are not stored, the balance is one only where the platform serves a model of the maker's on its own credential, not through the person's.
    const balance = this.context.features.modelPlugins || this.context.held.served === undefined || vendorModels(plugin, this.context.held.served).some((one) => one.via === undefined);
    const doors = (way: "key" | "account"): readonly Door[] => ((way === "key" ? plugin.model?.keys : plugin.model?.accounts) ?? []).flatMap((provider) => {
      const listed = way === "key" ? providers.find((one) => one.id === provider) : accounts.find((one) => one.id === provider);
      return listed === undefined ? [] : [{ way, provider, on: way === "key" ? (listed as Provider).ownKey : (listed as Account).signedIn}];
    }).map((door, n) => ({ ...door, place: n === 0 ? `way-${way}` : `way-${way}-${door.provider}` }));
    // A sign-in that makes a key stands above the key it makes.
    return (plugin.model?.ways.includes("account") === true ? [] : doors("account"))
      .concat((plugin.model?.ways ?? []).flatMap((way): readonly Door[] => (way === "platform" ? (balance ? [{ way, on: model?.ways.includes(way) === true, place: "way-platform" }] : []) : doors(way))));
  }

  /**
   * A door's name: the balance, an API key, a subscription, or Sign in where the sign-in is no subscription; a maker's second key or
   * sign-in, such as Moonshot AI's China key, by its provider.
   */
  #doorLabel(plugin: Plugin, door: Door): string {
    if (door.way === "platform") return this.#say("card.platform");
    const name = PROVIDERS[door.provider!]?.name ?? door.provider!;
    if (door.place !== `way-${door.way}`) return door.way === "key" ? this.#say("pl.way.providerKey", { provider: name }) : name;
    return this.#say(wayWord(plugin, door.way));
  }

  /**
   * Who bills a door: the maker under its own name, its subscription by the name the record gives it, a second key or sign-in by its
   * provider. A sign-in that makes a key says so; one that is no subscription says the organisation it signs in to chooses the models.
   */
  #doorBill(plugin: Plugin, door: Door): readonly Child[] {
    const vendor = vendorIn(plugin, this.context.language);
    if (door.way === "account" && door.place === "way-account" && plugin.model?.subscription === undefined) return [this.#say(makesKey(door.provider!) ? "pl.bill.makesKey" : "pl.bill.organisation", { vendor })];
    if (door.way === "platform" || door.place === `way-${door.way}`) return this.#billed(plugin, door.way);
    return [this.#say(`pl.bill.${door.way}`, { vendor: PROVIDERS[door.provider!]?.name ?? door.provider! })];
  }

  /** Each way the vendor offers, who bills it, and whether it is connected: the connected ones first, in cx's order of use. A click opens it in Settings. */
  #ways(plugin: Plugin): HTMLElement {
    const states = this.#wayStates(plugin);
    const used = connectedWays(this.context.held, plugin).flatMap((way) => states.filter((one) => one.way === way && one.on));
    return h("ul", { class: "pl-list pl-way-list" }, ...[...used, ...states.filter((one) => !used.includes(one))].map((door) => {
      return h("li", {}, h("a", { class: "pl-row pl-way-link", href: `${href.item(plugin)}/settings` },
        h("span", { class: "pl-row-text" }, h("strong", {}, this.#doorLabel(plugin, door)),
          h("span", { class: "quiet" }, ...this.#doorBill(plugin, door))),
        !this.context.unread && h("span", { class: "pl-go" }, this.#say(door.on ? "pl.mo.connected" : "pl.mo.connect"))));
    }));
  }

  /** A model's price where the balance pays for it, in and out per million tokens. */
  #modelCells(model: Model, priced: boolean): readonly Child[] {
    const rate = this.#modelReads?.providers.find((one) => one.id === model.provider)?.rates.find((one) => one.model === model.id || one.model === model.name);
    return [
      priced && (!balancePays(this.context.held, model.id) ? h("td", { class: "num" }, "") : rate === undefined || this.context.money === undefined ? h("td", { class: "num quiet" }, this.#say("pl.mo.noPrice")) : h("td", { class: "num" }, h("span", { class: "pl-nobreak" }, `${this.#shown(rate.input)} /`), " ", h("span", { class: "pl-nobreak" }, this.#shown(rate.output)))),
    ];
  }

  #modelTable(models: readonly Model[], priced: boolean, tick?: (model: Model) => Child): HTMLElement {
    return h("table", { class: "pl-table pl-models" },
      h("thead", {}, h("tr", {}, h("th", {}, this.#say("pl.mo.model")), priced && h("th", { class: "num" }, this.#say("pl.mo.price")), tick !== undefined && h("th", {}, this.#say("pl.mt.use")))),
      h("tbody", {}, ...models.map((model) => {
        return h("tr", {}, h("td", { class: "pl-model-name" }, h("strong", { title: model.name }, model.name)), ...this.#modelCells(model, priced), tick !== undefined && h("td", {}, tick(model)));
      })));
  }

  /**
   * A version's price, as every table of series draws it: in and out per million tokens, where the balance serves it first. A version a
   * subscription or a key serves first shows none, since the balance pays for it only once that way runs out (「ah——A/A」).
   */
  #versionCells(plugin: Plugin, version: Version, priced: boolean): readonly Child[] {
    return [
      // The two prices break between them and nowhere else, where a narrow table folds the cell; a version the balance does not price has none.
      !priced ? "" : version.input === 0 && version.output === 0 ? h("td", { class: "num" }, "") : !pricedFirst(this.context.held, plugin, version) || !balancePays(this.context.held, version.id) ? h("td", { class: "num" }, "") : this.context.money === undefined ? h("td", { class: "num quiet" }, this.#say("pl.mo.noPrice")) : h("td", { class: "num" }, h("span", { class: "pl-nobreak" }, `${this.#shown(version.input)} /`), " ", h("span", { class: "pl-nobreak" }, this.#shown(version.output))),
    ];
  }

  /** The head every table of series has after its first column; the price's only where the balance pays for the vendor. */
  #seriesHead(priced: boolean): readonly Child[] {
    return [h("th", {}, this.#say("pl.mo.model")), priced && h("th", { class: "num" }, this.#say("pl.mo.price"))];
  }

  /**
   * Whether the vendor's tables draw a price: where the balance is one of the ways that open its models on the account (`priced`).
   */
  #priced(plugin: Plugin): boolean {
    return priced(this.context.held, plugin);
  }

  /**
   * The series a person uses in chat, each as the version it is on now, in the parts the Models tab draws them in; every series of a
   * vendor not installed, as what it would offer.
   */
  #seriesInUse(plugin: Plugin, series: readonly Series[]): HTMLElement {
    const priced = priceColumn(this.context.held, plugin, series.flatMap((one) => { const version = versionInUse(one); return version === undefined ? [] : [{ versions: [version] }]; }));
    const rows = (part: readonly Series[]): readonly Child[] => part.flatMap((one) => {
      const version = versionInUse(one);
      return version === undefined ? [] : [h("tr", {}, h("td", {}, h("span", { class: "pl-mname" }, h("strong", {}, version.name), one.pinned !== undefined && h("span", { class: "pl-chip" }, this.#say("pl.mt.pinnedChip")))), ...this.#versionCells(plugin, version, priced))];
    });
    return h("table", { class: "pl-table pl-models" }, h("thead", {}, h("tr", {}, ...this.#seriesHead(priced))), ...this.#byWay(plugin, series, this.#columns(priced, false), rows));
  }

  /**
   * A table's bodies by the way that serves the version each series is on, in the order of use, each headed by the way's name as a row
   * of the table, as a maker's row heads its series; one body with no head where one way serves them all.
   */
  #byWay(plugin: Plugin, series: readonly Series[], span: string, rows: (part: readonly Series[]) => readonly Child[]): readonly HTMLElement[] {
    const parts = byWay(this.context.held, plugin, series);
    if (parts.length < 2) return [h("tbody", {}, ...rows(series))];
    return parts.map((part) => h("tbody", { class: "pl-way-group" },
      h("tr", { class: "pl-way-head" }, h("th", { colspan: span, scope: "rowgroup" }, this.#say(wayWord(plugin, part.way)))), ...rows(part.series)));
  }

  /**
   * What a vendor waits for before its models can be chosen, or appear: one not installed that a key or a sign-in reaches, its install;
   * an installed one reached by a key, the key, said of the list above it where it lists one, or, holding one, its vendor lists nothing for it; one reached by a sign-in and no key, the
   * sign-in, said of the list above it where it lists one; any other says no model is available.
   */
  #idleLine(plugin: Plugin): string {
    const held = this.context.held;
    const ways = plugin.model?.ways ?? [];
    if (!installed(held, plugin)) return this.#say(ways.includes("key") || ways.includes("account") ? "pl.mo.installFirst" : "pl.mo.idle");
    if (ways.includes("key")) {
      const key = this.#providers().some((one) => plugin.model!.keys.includes(one.id) && one.ownKey);
      if (key) return this.#say("pl.mt.none", { vendor: vendorIn(plugin, this.context.language) });
      return this.#say((this.#series(plugin)?.length ?? 0) > 0 ? "pl.mo.noKey" : "pl.mo.keyFirst");
    }
    const signedIn = held.accounts?.some((one) => plugin.model!.accounts.includes(one.id) && one.signedIn) === true;
    if (!ways.includes("account") || signedIn) return this.#say("pl.mo.idle");
    return this.#say((this.#series(plugin)?.length ?? 0) > 0 ? "pl.mo.signIn" : "pl.mo.signInFirst");
  }

  /** The one model of this vendor's the chat is on, until a seller can choose more; the Models tab carries the rest. */
  #inUse(models: readonly Model[]): readonly Model[] {
    const current = this.#models()?.current;
    return models.filter((model) => current !== undefined && current.provider === model.provider && current.id === model.id);
  }

  #modelOverview(plugin: Plugin): readonly Child[] {
    const models = vendorModels(plugin, this.#models());
    const chosen = this.#inUse(models);
    const vendor = vendorIn(plugin, this.context.language);
    const series = this.#series(plugin);
    // A vendor the account does not reach shows what it would offer, at a member's prices, as one not installed does.
    const has = installed(this.context.held, plugin) && reaches(this.context.held, plugin);
    const ticked = series === undefined ? [] : has ? series.filter((one) => one.inChat) : series;
    // An installed vendor lists what it puts in the chat's picker today, as the card and the Models in chat page do; ticked and putting
    // nothing there, it says what it waits for in that page's words.
    const offered = has ? offeredInChat(this.context.held, plugin) : ticked;
    const count = this.#modelCount(plugin) ?? 0;
    const ways = h("section", {}, h("h2", {}, this.#say("pl.mo.ways")), this.#ways(plugin), this.#chooseVendors());
    // A vendor serving nothing today has said so under its header; its Overview sells no model, and keeps its package's own words, which
    // say how it is reached, over the ways it is reached by.
    if (idle(this.context.held, plugin)) return [h("div", { class: "pl-columns" }, h("div", { class: "pl-main pl-model-main" },
      plugin.description !== undefined && readme(this.#words(plugin.description), this.#name(plugin), this.#outsideWords(), { packages: true }), ways), this.#side(plugin, []))];
    return [h("div", { class: "pl-columns" }, h("div", { class: "pl-main pl-model-main" },
        readme(this.#words(plugin.description ?? plugin.about), this.#name(plugin), this.#outsideWords(), { packages: true }),
        plugin.model?.chat === false ? h("p", { class: "quiet" }, this.#say("pl.mo.notChat", { name: this.#name(plugin) }))
          // A host not yet reached shows what it offers by maker, closed, with the search, and no tick: hundreds of series are no one table.
          // The balance never reaches a host's own card, so its heading names no price.
          : series !== undefined && !has && ofMakers(series) ? h("section", {}, h("h2", {}, this.#say("pl.tab.models")), ...this.#search(plugin, series, "overview", { bare: true }))
          : series !== undefined ? h("section", {}, h("h2", {}, this.#say(has ? "pl.mo.inChat" : "pl.mo.models")),
          ticked.length === 0 ? h("p", {}, this.#waitsForWay(plugin, series) ? this.#idleLine(plugin) : this.#say("pl.mo.noneChosen", { vendor }))
            : offered.length === 0 ? h("p", {}, waitsInChat({ held: this.context.held, say: this.context.say, language: this.context.language }, plugin)) : this.#seriesInUse(plugin, offered),
          count > 0 && h("p", {}, h("a", { class: "pl-inline", href: `${href.item(plugin)}/models` }, `${this.#say("pl.mo.all", { n: count })} ›`))) : h("section", {}, h("h2", {}, this.#say("pl.mo.inChat")),
          chosen.length === 0 ? h("p", {}, this.#say("pl.mo.noneChosen", { vendor })) : this.#modelTable(chosen, this.#priced(plugin)),
          models.length > 0 && h("p", {}, h("a", { class: "pl-inline", href: `${href.item(plugin)}/models` }, `${this.#say("pl.mo.all", { n: models.length })} ›`))),
      ways), this.#side(plugin, []))];
  }

  /** Where the vendors the chat offers are chosen: the vendors' own page, linked under a vendor's ways and at the end of its Settings. */
  #chooseVendors(): HTMLElement {
    return h("p", { class: "quiet pl-choose" }, h("a", { class: "pl-inline", href: href.models }, `${this.#say("pl.mo.chooseVendors")} ›`));
  }

  /**
   * The Models tab. Where the platform lists the vendor's chat models by series: each series with its tick, and its versions behind its
   * name, then the models that make images, video and audio. Elsewhere: every model the vendor serves here.
   */
  #modelsTab(plugin: Plugin): readonly Child[] {
    const reads = this.#modelReads;
    const offered = this.#models();
    const models = vendorModels(plugin, offered);
    const vendor = vendorIn(plugin, this.context.language);
    const has = installed(this.context.held, plugin);
    const series = this.#series(plugin);
    const served = (model: Model) => [...(reads?.providers ?? []), ...(reads?.accounts ?? [])].find((one) => one.id === model.provider)?.models.find((one) => one.id === model.id);
    const tick = (model: Model): Child => {
      const one = served(model);
      if (one === undefined || model.via === undefined) return "";
      const way = reads?.providers.some((provider) => provider.id === model.provider && provider.ownKey) === true ? "key" : "account";
      return h("input", { type: "checkbox", checked: one.shown ? true : undefined, disabled: has ? undefined : true, "aria-label": this.#say("chat.named", { act: this.#say("pl.mt.use"), name: model.name }),
        onchange: (event) => void this.#act(() => this.context.backend.showModel(way, model.provider, model.id, (event.target as HTMLInputElement).checked)) });
    };
    // The sentence promises a tick: both are drawn only where some model can be ticked.
    const tickable = this.context.features.modelPlugins && models.some((model) => served(model) !== undefined && model.via !== undefined);
    return [
      !has && !this.context.unread && h("p", { class: "quiet" }, this.#say("pl.mt.install", { name: this.#name(plugin) })),
      !this.context.unread && this.#waitsForWay(plugin, series) && h("p", { class: "quiet" }, this.#idleLine(plugin)),
      plugin.model?.chat !== false && series !== undefined && ofMakers(series) && h("div", { class: "or-list" }, ...this.#longList(plugin, series, "tab", "h2")),
      plugin.model?.chat !== false && !(series !== undefined && ofMakers(series)) && h("section", {}, h("h2", {}, this.#say("pl.mt.chat")),
        series !== undefined ? h("div", { class: "pl-model-rows" }, this.#fullLine(plugin), h("p", { class: "quiet" }, this.#say("pl.mt.seriesLine")), this.#seriesTable(plugin, series))
          : models.length === 0 ? h("p", { class: "quiet" }, this.#say("pl.mt.none", { vendor })) : h("div", { class: "pl-model-rows" }, tickable && h("p", { class: "quiet" }, this.#say("pl.mt.chatLine")), this.#modelTable(models, this.#priced(plugin), tickable ? tick : undefined))),
    ];
  }

  /**
   * Ticks or unticks a series. A tick on a vendor not in chat while five others hold its places is refused, and so is a sixth of one
   * vendor's series: the box stays clear and a line says why. A sixth series' line stands under the row pressed, since a vendor's table
   * can run past the screen; a full chat's stands above the signed table, or under the row in a list of many makers (`place`). Any other
   * tick clears that line.
   */
  async #tick(plugin: Plugin, series: string, on: boolean, place?: string): Promise<void> {
    const backend = this.context.backend;
    const placed = async (): Promise<boolean | undefined> => (await Promise.resolve().then(() => backend.chatOffer()).catch(() => undefined))?.places.includes(plugin.id);
    const was = await placed();
    const said = await backend.setSeries(plugin.id, series, on);
    const listed = said !== undefined && (place !== undefined || said === "many");
    this.#full = said !== undefined && !listed ? { id: plugin.id, why: said } : undefined;
    this.#refused = listed ? { key: `${plugin.id}:${series}`, place, why: said } : undefined;
    // What the tick did to the vendor's place in chat is said once, in the page's status region; a tick within chat changes no place.
    if (said !== undefined) { this.context.announce?.(said === "many" ? this.#say("chat.seriesCap", { max: CARD_PLACES }) : this.#say("card.full", { count: CARD_PLACES })); return; }
    const now = await placed();
    if (was === false && now === true) this.context.announce?.(this.#say("chat.addedSaid", { name: this.#name(plugin) }));
    else if (was === true && now === false) this.context.announce?.(this.#say("chat.outSaid", { name: this.#name(plugin) }));
  }
  /**
   * The keyboard stays on the tick, or where its row went with it, on the nearest of `near` still drawn; where the tick took its vendor out
   * of chat on the chat's models page, its chooser goes with it, and the keyboard goes to the vendor's Add to chat, else to its name.
   */
  #afterTick(plugin: Plugin, at: string, near: readonly string[] = []): void {
    const tick = [at, ...near].map((place) => placed(this.element, place)).find((one) => one !== null && one !== undefined);
    if (tick !== undefined) { tick.focus(); return; }
    if (!this.#chatAt) return;
    this.#choosing.delete(plugin.id);
    (placed(this.element, `add ${plugin.id}`) ?? placed(this.element, `name ${plugin.id}`))?.focus();
  }
  #full: { readonly id: string; readonly why: TickRefused } | undefined;
  #fullLine(plugin: Plugin): Child {
    return this.#full?.id === plugin.id && this.#refusal(this.#full.why);
  }

  /**
   * A vendor's series: the tick that puts one in the chat's picker, its name with what is new or held at a version, the version it is
   * on now under it, and that version's price. A series with more than one version unfolds to the choice between always
   * the latest and one version held.
   */
  #seriesTable(plugin: Plugin, series: readonly Series[]): HTMLElement {
    const priced = priceColumn(this.context.held, plugin, series);
    return h("table", { class: "pl-table pl-models pl-series" }, h("thead", {}, this.#seriesHeadRow(priced, true)),
      ...this.#byWay(plugin, series, this.#columns(priced, true), (part) => this.#seriesRows(plugin, part, { priced })));
  }

  /** How many columns a table of series has, with the tick's or without: a row that spans the table spans them. */
  #columns(priced: boolean, ticks: boolean): string { return String(this.#seriesHead(priced).filter(Boolean).length + Number(ticks)); }

  #seriesHeadRow(priced: boolean, ticks: boolean): HTMLElement {
    return h("tr", {}, ticks && h("th", { class: "pl-tick" }, h("span", { class: "pl-tick-head" }, this.#say("pl.mt.use"))), ...this.#seriesHead(priced));
  }

  /**
   * The rows of a table of series, one series and the versions it unfolds to at a time. A list in two parts draws a series in both, so
   * `place` keeps their controls apart, a radio's group too; `maker` names the maker beside the version where the rows are many makers';
   * `found` holds the versions a search found a series by, which it opens on alone. A tick refused in such a list says why under its row.
   */
  #seriesRows(plugin: Plugin, series: readonly Series[], how: { readonly priced: boolean; readonly place?: string; readonly maker?: boolean; readonly found?: ReadonlyMap<string, readonly Version[]> }): readonly Child[] {
    const backend = this.context.backend;
    const held = this.context.held;
    const shut = !installed(held, plugin) || this.context.unread;
    const vendor = vendorIn(plugin, this.context.language);
    const priced = how.priced;
    const at = (words: string): string => (how.place === undefined ? words : `${how.place} ${words}`);
    return series.flatMap((one): readonly Child[] => {
      const key = `${plugin.id}:${one.name}`;
      const locked = shut || one.listed === true;
      const latest = one.versions[0];
      const version = versionInUse(one);
      if (latest === undefined || version === undefined) return [];
      const many = one.versions.length > 1;
      const hits = how.found?.get(key);
      const open = many && (hits !== undefined ? !this.#lists.folded.has(at(key)) : this.context.openSeries.has(key));
      const name = h("span", { class: "pl-mname" }, h("strong", {}, one.name), one.pinned !== undefined && h("span", { class: "pl-chip" }, this.#say("pl.mt.pinnedChip")));
      const gone = one.gone === undefined ? "" : h("span", { class: "quiet pl-msub" }, this.#say("pl.mt.pinGone", { version: one.gone }));
      const radio = (pin: Version | undefined): HTMLElement => h("td", { class: "pl-tick" }, h("input", { type: "radio", name: at(`v-${key}`), checked: one.pinned === pin?.id ? true : undefined, disabled: locked ? true : undefined,
        "aria-label": pin?.name ?? this.#say("pl.mt.latest"), "data-focus": at(`pin ${key} ${pin?.id ?? ""}`), onchange: () => void this.#act(() => backend.pinSeries(plugin.id, one.name, pin?.id)).then(() => placed(this.element, at(`pin ${key} ${pin?.id ?? ""}`))?.focus()) }));
      const disclose = (): void => {
        this.#refused = undefined;
        const set = hits !== undefined ? this.#lists.folded : this.context.openSeries;
        const which = hits !== undefined ? at(key) : key;
        if (set.has(which)) set.delete(which); else set.add(which);
        this.again();
        placed(this.element, at(`open ${key}`))?.focus();
      };
      const refused = this.#refused !== undefined && this.#refused.key === key && this.#refused.place === how.place ? this.#refused.why : undefined;
      return [
        h("tr", {},
          h("td", { class: "pl-tick" }, h("input", { type: "checkbox", checked: one.inChat ? true : undefined, disabled: locked ? true : undefined, "aria-label": this.#say("chat.named", { act: this.#say("pl.mt.use"), name: one.name }), "data-focus": at(`tick ${key}`),
            onchange: (event) => {
              // An untick in the chat's part takes its row away: the keyboard goes to the next series, then the previous, then the line
              // that says none is chosen.
              const boxes = [...(event.target as HTMLElement).closest("tbody")!.querySelectorAll<HTMLInputElement>("input[type=checkbox][data-focus]")].map((box) => box.dataset["focus"]!);
              const n = boxes.indexOf(at(`tick ${key}`));
              const near = [...boxes.slice(n + 1), ...boxes.slice(0, Math.max(n, 0)).reverse(), ...(how.place === undefined ? [] : [at("none")])];
              void this.#act(() => this.#tick(plugin, one.name, (event.target as HTMLInputElement).checked, how.place)).then(() => this.#afterTick(plugin, at(`tick ${key}`), near));
            } })),
          h("td", {},
            many ? h("button", { type: "button", class: "pl-disclose", "aria-expanded": String(open), "data-focus": at(`open ${key}`), onclick: disclose },
              name, h("span", { class: "pl-caret", "aria-hidden": "true" }, open ? "▴" : "▾")) : name,
            h("span", { class: "quiet pl-msub" }, how.maker === true && one.maker !== undefined ? this.#say("pl.mt.ofMaker", { version: version.name, maker: one.maker.name }) : version.name), gone),
          ...this.#versionCells(plugin, version, priced)),
        ...(open ? [
          hits === undefined && h("tr", { class: "pl-version" }, radio(undefined), h("td", { colspan: this.#columns(priced, false) }, h("span", { class: "pl-mname" }, this.#say("pl.mt.latest")), h("span", { class: "quiet pl-msub" }, this.#say("pl.mt.latestNote", { name: latest.name, vendor: one.maker?.name ?? vendor })))),
          // A version another way serves than the one the series is on names that way beside it, as the page's tag.
          ...(hits ?? one.versions).map((each) => {
            const way = servingWay(held, plugin, each);
            const other = way !== undefined && way !== servingWay(held, plugin, version);
            return h("tr", { class: "pl-version" }, radio(each), h("td", {}, h("span", { class: "pl-mname" }, each.name, other && h("span", { class: "pl-tag" }, this.#say(wayWord(plugin, way))))), ...this.#versionCells(plugin, each, priced));
          }),
        ] : []),
        refused !== undefined && h("tr", { class: "or-held" }, h("td", { colspan: this.#columns(priced, true) }, this.#refusal(refused))),
      ];
    });
  }

  /** Why a tick was refused, in the words the page says it in: chat holds five vendors, with the way to the page that makes room, or five of this one's series. */
  #refusal(why: TickRefused): HTMLElement {
    return h("p", { class: "pl-fact vc-fact" }, ...(why === "many" ? [this.#say("chat.seriesCap", { max: CARD_PLACES })]
      : [this.#say("card.full", { count: CARD_PLACES }), " ", h("a", { href: href.models }, `${this.#say("pl.mo.chooseVendors")} ›`)]));
  }

  /**
   * A host's list, whose series run to hundreds and are many makers': the signed tab's heading, line and table in two parts. The series
   * in chat come first, as the list has them, with their count against the five the card shows of a vendor, so the tab opens on what the
   * card lists. Under them, every series, by maker: each maker a row that opens to its series, all closed when the tab opens, with a
   * search over them all that opens the makers it finds. A tick refused stands under its row, where the seller pressed.
   */
  #longList(plugin: Plugin, series: readonly Series[], place: string, heading: "h2" | "h3"): readonly Child[] {
    const vendor = plugin.model!.vendor;
    const listed = series.filter((one) => versionInUse(one) !== undefined);
    const ticked = listed.filter((one) => one.inChat);
    const priced = priceColumn(this.context.held, plugin, ticked);
    return [
      h("section", { class: "or-part", "aria-label": this.#say("pl.mt.chat") },
        h(heading, { class: "or-head" }, this.#say("pl.mt.chat"), h("span", { class: "count" }, this.#say("chat.places", { n: ticked.length, max: CARD_PLACES }))),
        h("div", { class: "pl-model-rows" }, this.#fullLine(plugin), h("p", { class: "quiet" }, this.#say("pl.mt.seriesLine")),
          ticked.length === 0 ? h("p", { class: "quiet or-none", tabindex: "-1", "data-focus": `${place}-in none` }, this.#say("pl.mo.noneChosen", { vendor }))
            : h("table", { class: "pl-table pl-models pl-series or-table" }, h("thead", {}, this.#seriesHeadRow(priced, true)), h("tbody", {}, ...this.#seriesRows(plugin, ticked, { priced, place: `${place}-in`, maker: true }))))),
      h("section", { class: "or-part", "aria-label": this.#say("pl.mt.allSeries") },
        h(heading, { class: "or-head" }, this.#say("pl.mt.allSeries"), h("span", { class: "count" }, String(listed.length))),
        ...this.#search(plugin, listed, place, {})),
    ];
  }

  /**
   * Every series by maker, in one table under the signed heads. A maker is a row that opens to its series, closed when the list is first
   * drawn; a search keeps the makers it finds, each open on what it found, and a maker shut during a search stays shut until the words
   * change. Bare, with no ticks, as an Overview lists what a vendor not yet reached offers: each series by its version in use, or by the
   * versions a search found it by.
   */
  #makerTable(plugin: Plugin, series: readonly Series[], place: string, how: { readonly bare?: boolean }): HTMLElement {
    const words = sought(this.#lists.sought.get(place) ?? "");
    const groups = byMaker(series).map((group) => ({ ...group, series: words === "" ? group.series : group.series.filter((one) => finds(one, words, this.context.held.catalogue.words)) })).filter((group) => group.series.length > 0);
    if (groups.length === 0) return h("p", { class: "quiet or-none", tabindex: "-1", "data-focus": `${place} nothing` }, this.#say("pl.mt.noMatch", { q: words }));
    const priced = priceColumn(this.context.held, plugin, series);
    const bare = how.bare === true;
    return h("table", { class: bare ? "pl-table pl-models or-table or-bare" : "pl-table pl-models pl-series or-table" }, h("thead", {}, this.#seriesHeadRow(priced, !bare)),
      ...groups.map(({ maker, series: shown }) => {
        const key = `${place} ${maker.id}`;
        const open = words === "" ? this.#lists.open.has(key) : !this.#lists.shut.has(key);
        const toggle = (): void => {
          this.#refused = undefined;
          const set = words === "" ? this.#lists.open : this.#lists.shut;
          if (set.has(key)) set.delete(key); else set.add(key);
          this.again();
          placed(this.element, `${place} maker ${maker.id}`)?.focus();
        };
        return h("tbody", { class: "or-group" },
          h("tr", { class: "or-maker" }, h("th", { colspan: this.#columns(priced, !bare), scope: "rowgroup" },
            h("button", { type: "button", class: "pl-disclose or-maker-name", "aria-expanded": String(open), "aria-label": `${maker.name} ${this.#say("pl.mt.seriesCount", { n: shown.length })}`, "data-focus": `${place} maker ${maker.id}`, onclick: toggle },
              h("strong", {}, maker.name), h("span", { class: "quiet or-count" }, this.#say("pl.mt.seriesCount", { n: shown.length })), h("span", { class: "pl-caret", "aria-hidden": "true" }, open ? "▴" : "▾")))),
          ...(!open ? [] : bare ? shown.flatMap((one) => {
            const hits = foundVersions(one, words, this.context.held.catalogue.words);
            return (hits.length > 0 ? hits : [versionInUse(one)!]).map((version) => h("tr", {}, h("td", {}, h("span", { class: "pl-mname" }, h("strong", {}, version.name))), ...this.#versionCells(plugin, version, priced)));
          }) : this.#seriesRows(plugin, shown, { priced, place, found: new Map(shown.flatMap((one) => { const hits = foundVersions(one, words, this.context.held.catalogue.words); return hits.length > 0 ? [[`${plugin.id}:${one.name}`, hits] as const] : []; })) })));
      }));
  }

  /**
   * The search over every series of a host's, and the list under it. Typing draws again only that list, so the field keeps its words, its
   * caret and an input method's unfinished letters; once the typing stops, what it found is said once.
   */
  #search(plugin: Plugin, series: readonly Series[], place: string, how: { readonly bare?: boolean }): readonly [HTMLElement, HTMLElement] {
    const field = h("input", { type: "search", class: "pl-search", placeholder: this.#say("pl.mt.search"), "aria-label": this.#say("pl.mt.search"), "aria-controls": `${place}-results`,
      autocomplete: "off", spellcheck: "false", "data-focus": `${place} search` });
    field.value = this.#lists.sought.get(place) ?? "";
    const results = h("div", { class: how.bare === true ? "or-results" : "pl-model-rows or-results", id: `${place}-results` }, this.#makerTable(plugin, series, place, how));
    const update = (): void => {
      // An input method's last letters arrive as an input and then its end: the words have not changed, and what was shut stays shut.
      if (field.value === (this.#lists.sought.get(place) ?? "")) return;
      this.#lists.sought.set(place, field.value);
      this.#lists.shut.clear();
      this.#lists.folded.clear();
      this.#refused = undefined;
      fill(results, this.#makerTable(plugin, series, place, how));
      this.#endSearch();
      this.#found = { place, timer: setTimeout(() => {
        this.#found = undefined;
        const words = sought(field.value);
        if (words === "") return;
        const n = series.filter((one) => finds(one, words, this.context.held.catalogue.words)).length;
        this.context.announce?.(n === 0 ? this.#say("pl.mt.noMatch", { q: words }) : this.#say("pl.mt.found", { n }));
      }, FOUND_AFTER_MS) };
    };
    field.addEventListener("input", (event) => { if (!(event as InputEvent).isComposing) update(); });
    field.addEventListener("compositionend", update);
    return [h("label", { class: "pl-searchbox or-search" }, searchMark(), field), results];
  }


  /**
   * A model plugin's Settings: each way it offers, connected or not, with the one sentence that says which cx uses first; the order
   * itself where more than one is connected; and where the chat's vendors are chosen. A vendor not installed draws the same, holding no
   * way yet, and its tab disables every change (`#ahead`).
   */
  #modelSettings(plugin: Plugin): readonly Child[] {
    const held = this.context.held;
    if (this.context.unread) return [];
    // Before install the form is the installed one, holding no way yet: the balance is no way until then, and nothing is paid to order.
    const has = modelOf(held, plugin) !== undefined;
    const model = modelOf(held, plugin) ?? { id: plugin.id, enabled: false, ways: [] };
    const vendor = vendorIn(plugin, this.context.language);
    // Only the ids the platform's own lists name: a way the world does not list is not drawn, and Connected is the world's answer.
    const accounts = this.context.held.accounts ?? this.#modelReads?.accounts ?? [];
    const states = this.#wayStates(plugin);
    const backend = this.context.backend;
    // Where the ways a vendor holds are not stored, they are read: the balance where the platform serves it, the key where one is saved.
    const stored = this.context.features.modelPlugins;
    const store = (ways: readonly Way[]): Promise<void> => (stored ? backend.setModelWays(plugin.id, ways) : Promise.resolve());
    const setWays = (ways: readonly Way[]) => this.#act(() => store(ways));
    const without = (way: Way): readonly Way[] => model.ways.filter((one) => one !== way);
    // A kind of way stays stored while another credential of that kind still holds for the maker.
    const withoutDoor = (door: Door): readonly Way[] => (states.some((one) => one !== door && one.way === door.way && one.on) ? model.ways : without(door.way));
    const label = (way: Way): string => {
      const door = way === "key" ? keyDoor(held, plugin) : undefined;
      return door !== undefined ? this.#say("pl.way.providerKey", { provider: door }) : this.#say(wayWord(plugin, way));
    };
    const nameOf = (door: Door): string => (door.place === "way-account" ? signInName(plugin, this.context.language) : PROVIDERS[door.provider!]?.name ?? door.provider!);
    const holds = (way: Way, provider: string): boolean => states.some((one) => one.way === way && one.provider === provider && one.on);
    const control = (door: Door): readonly Child[] => {
      const { way, on, place } = door;
      const provider = door.provider!;
      const button = (word: string, press: () => Promise<unknown>, primary = false, at = place, removes = false): HTMLElement => this.#waits.ring(`way ${plugin.id} ${at}`, h("button", { type: "button", class: primary ? "primary" : undefined, "data-focus": at, "data-removes": removes ? true : undefined, onclick: this.#waits.press(`way ${plugin.id} ${at}`, press) }, word));
      if (way === "platform") return [stored && has && (on ? button(this.#say("pl.ms.platformStop"), () => setWays(without(way))) : button(this.#say("pl.ms.platformUse"), () => setWays([...model.ways, way]), true))];
      const name = nameOf(door);
      if (way === "account") {
        const account = accounts.find((one) => one.id === provider)!;
        const signingIn = this.#signIn?.account === provider ? this.#signIn : undefined;
        if (on) return [button(this.#say("pl.ms.signOut"), () => this.#act(async () => { await backend.signOut(provider); await store(withoutDoor(door)); }, this.#say("signIn.outSaid", { name })).then((done) => { if (done) placed(this.element, place)?.focus(); }), false, place === "way-account" ? "way-sign-out" : `${place}-sign-out`, true)];
        // The press waits until the sign-in's first step comes; while its card is open the row's press is the card's Cancel.
        return stepped(signingIn) ? [] : [button(this.#say("pl.ms.signIn", { vendor: name }), () => this.#beginSignIn(plugin, account, place, () => (makesKey(provider) ? store(["key", ...without("key")]) : store(["account", ...without("account")]))), true)];
      }
      // Remove key holds a place of its own, as on a source's key: the keyboard a save leaves is on the word that the key is saved.
      const forget = place === "way-key" ? "way-forget" : `${place}-forget`;
      const entry = `${place}-field`;
      if (on) return [button(this.#say("pl.ms.forget"), () => this.#act(async () => { await backend.removeOwnKey(provider); await store(withoutDoor(door)); }).then((done) => { if (done) placed(this.element, entry)?.focus(); }), false, forget, true)];
      // What was typed stays in the field through every draw until a save of it succeeds, so a refusal leaves it there to correct.
      const typed = `${plugin.id}\u0000${provider}`;
      const holder = this.#say("pl.ms.keyPh", { vendor: place !== "way-key" ? name : vendor });
      const field = h("input", { type: "password", class: "pl-key", placeholder: holder, "aria-label": holder, autocomplete: "off", "data-focus": entry, size: String(holdsWords(holder)) });
      field.value = this.#typed.get(typed) ?? "";
      field.addEventListener("input", () => { this.#typed.set(typed, field.value); });
      const keyNote = h("p", { class: "quiet pl-field-note", role: "status" });
      const save = async (): Promise<void> => {
        const value = field.value.trim();
        if (value === "") { keyNote.textContent = this.#say("pl.st.keyEmpty"); field.focus(); return; }
        // The row's focused "Key saved." is the one word; it is told elsewhere only to a seller who has left the page.
        const at = here();
        await this.#act(async () => { await backend.saveOwnKey(provider, value); this.#typed.delete(typed); await store([way, ...without(way)]); await this.#tickVendor(provider); },
          () => (here() !== at ? this.#say("pl.ms.keySaved") : undefined));
      };
      const saving = button(this.#say("pl.ms.save"), save, true);
      // Enter presses Save from where Save stands, so the redraw lands the keyboard on the row's "Key saved." as a press of Save does.
      field.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); saving.focus({ preventScroll: true }); void this.#waits.run(`way ${plugin.id} ${place}`, save, saving); } });
      return [field, saving, keyNote];
    };
    // A key and a sign-in that are one credential at the provider replace each other: each row says so while the other is held.
    const goes = (door: Door): string | undefined => {
      if (door.provider === undefined || door.on || !states.some((one) => one !== door && one.provider === door.provider)) return undefined;
      return door.way === "account" && holds("key", door.provider) ? this.#say("signIn.keyGoes") : door.way === "key" && holds("account", door.provider) ? this.#say("signIn.signInGoes", { name: nameOf({ ...door, way: "account", place: states.find((one) => one.way === "account" && one.provider === door.provider)!.place }) }) : undefined;
    };
    // A way's name, who bills it under the name, and at the right what it is now with the control that changes it; a sign-in's card or its last word under it.
    const row = (door: Door): HTMLElement => {
      const { way, on, place } = door;
      const account = way === "account" ? accounts.find((one) => one.id === door.provider) : undefined;
      const signingIn = account !== undefined && this.#signIn?.account === account.id ? this.#signIn : undefined;
      return h("li", { id: place }, h("div", { class: "pl-row pl-way-row" },
        h("span", { class: "pl-row-text" }, h("strong", {}, this.#doorLabel(plugin, door)), h("span", { class: "quiet" }, ...this.#doorBill(plugin, door)), goes(door) !== undefined && h("span", { class: "quiet" }, goes(door))),
        h("span", { class: "pl-way-act" }, on && h("span", { class: "quiet", ...(way === "platform" ? {} : { tabindex: "-1", "data-focus": place }) }, this.#say(way === "key" ? "pl.ms.keySaved" : way === "account" ? "pl.ms.signedIn" : "pl.ms.connected")), ...control(door))),
        stepped(signingIn) && this.#card(signingIn),
        account !== undefined && !on && signingIn === undefined && this.#lastLine(account, nameOf(door)));
    };
    // The order names what pays: only connected ways are counted, and moving one keeps the rest of the stored order behind it.
    const paying = connectedWays(held, plugin);
    const resting = model.ways.filter((way) => !paying.includes(way));
    const up = (n: number): Promise<boolean> => { const next = [...paying]; [next[n - 1], next[n]] = [next[n]!, next[n - 1]!]; return setWays([...next, ...resting]); };
    const order = stored && paying.length > 1 && h("section", { class: "pl-setting" }, h("h2", {}, this.#say("pl.ms.order")), h("ol", { class: "pl-list pl-order" }, ...paying.map((way, n) => h("li", {}, h("div", { class: "pl-row" },
      h("span", { class: "pl-order-n" }, String(n + 1)), h("span", { class: "pl-row-text" }, h("strong", {}, label(way))),
      n > 0 && this.#waits.ring(`order ${plugin.id} ${n}`, h("button", { type: "button", class: "pl-up", "data-focus": `up-${n}`, "aria-label": `${this.#say("pl.ms.up")}: ${label(way)}`, title: this.#say("pl.ms.up"), onclick: this.#waits.press(`order ${plugin.id} ${n}`, () => up(n)) }, "↑")))))));
    // With one way set up its row already says it is the one, 已登录 or 已连接; the sentence stays where two or more are, the one line
    // naming which cx uses first, and for a vendor turned off, which no row says.
    const sentence = stored && has && paying.length > 0 && (paying.length > 1 || !model.enabled) ? this.#order(plugin) : "";
    return [
      h("section", { class: "pl-setting" }, h("h2", {}, this.#say("pl.ms.connect")), sentence !== "" && h("p", {}, sentence), h("ul", { class: "pl-list pl-way-list" }, ...states.map(row))),
      order,
      h("section", { class: "pl-setting" }, this.#chooseVendors()),
    ];
  }

  /** The page is no longer drawn: a sign-in under way ends, as it lives in its vendor's Settings alone, and its card goes with it. */
  leave(): void {
    this.#toSettings = undefined;
    this.#unmark();
    this.#endSearch();
    if (this.#signIn === undefined) return;
    this.#signIn.stop.abort();
    this.#signIn = undefined;
    this.again();
  }

  /** Draws the page again from what it read, the keyboard staying on the control it was on where the new drawing has its place. */
  #redraw(): void {
    const active = globalThis.document?.activeElement;
    const place = globalThis.document !== undefined && active instanceof HTMLElement && this.element.contains(active) ? active.getAttribute("data-focus") : null;
    const top = place === null ? undefined : (active as HTMLElement).getBoundingClientRect().top;
    this.again();
    const back = place === null ? undefined : placed(this.element, place);
    if (back !== undefined) refocus(back, top);
  }

  /**
   * Begins a sign-in at the account. The row's press, at `place`, waits until the flow's first step comes, and the card opens under the
   * row with it, in the press's place: each step after is drawn into the card as it comes, and the keyboard, where it waited on the press,
   * goes to the card's first control. Signed in, the way is stored where ways are and the vendor takes a free place on the model card;
   * ended otherwise, before its first step or after, the card closes and its last word stands under the row. Settles when the press
   * waits no more: the first step came, or the sign-in ended.
   */
  #beginSignIn(plugin: Plugin, account: Account, place: string, store: () => Promise<void>): Promise<void> {
    const backend = this.context.backend;
    this.#signIn?.stop.abort();
    const at: SignInAt = { account: account.id, stop: new AbortController(), card: { name: signInName(plugin, this.context.language), typed: "", sending: false, steps: stepsIn(plugin, this.context.language) } };
    this.#signIn = at;
    if (this.#lastWord?.account === account.id) this.#lastWord = undefined;
    // A mouse press need not focus the button (Safari and Firefox on macOS do not): where the keyboard was at the press, and still is, is
    // the press's place too.
    const focusOf = (): string | null | undefined => {
      const active = globalThis.document?.activeElement;
      return active !== undefined && active !== null && active instanceof HTMLElement && this.element.contains(active) ? active.getAttribute("data-focus") : undefined;
    };
    const pressedFrom = focusOf();
    this.#redraw();
    let waited: () => void = () => undefined;
    const waits = new Promise<void>((resolve) => { waited = resolve; });
    const onPress = (): boolean => {
      const active = globalThis.document?.activeElement ?? null;
      const at = focusOf();
      return active === null || active === globalThis.document?.body || (at !== undefined && at !== null && (at === place || at === pressedFrom));
    };
    const inCard = (): boolean => placed(this.element, "sign-in")?.contains(globalThis.document?.activeElement ?? null) === true;
    // At its end the press gives the keyboard back only where it held it, on the press or in its card; a press that held nothing moves
    // nothing, and two absent places never read as one.
    const holding = (): string | undefined => {
      if (inCard()) return focusOf() ?? "sign-in";
      const now = focusOf();
      return now === place ? now : undefined;
    };
    const giveBack = (from: string | undefined): void => {
      if (from === undefined) return;
      // Still on its control, or let go with the card the drawing took away; anywhere else the person put it, it stays.
      const active = globalThis.document?.activeElement ?? null;
      if (focusOf() === from || active === null || active === globalThis.document?.body) placed(this.element, place)?.focus();
    };
    const heard = (step: SignInStep): void => {
      if (this.#signIn !== at) return;
      const first = !stepped(at);
      const waiting = first && onPress();
      at.card = step.kind === "ask" ? { ...at.card, ask: step } : { ...at.card, link: step };
      this.#redraw();
      if (!first) return;
      waited();
      // The card's first control takes the keyboard: the link where the person goes before pasting back, the field where nothing comes before it.
      const card = placed(this.element, "sign-in");
      if (waiting) (card?.querySelector<HTMLElement>("[data-focus=sign-in-go], [data-focus=sign-in-field]") ?? card)?.focus({ preventScroll: true });
    };
    void backend.signIn(account.id, { heard, signal: at.stop.signal }).then(
      async () => {
        // Whatever ended it, the press waits no more.
        waited();
        if (this.#signIn !== at) return;
        const from = holding();
        this.#signIn = undefined;
        await this.#act(async () => { await store(); await this.#tickVendor(account.id); }, this.#say("signIn.said", { name: at.card.name }));
        // Read after the save: a keyboard the person moved while it was written stays where they put it.
        giveBack(from);
      },
      (error: unknown) => {
        waited();
        if (this.#signIn !== at) return;
        const from = holding();
        this.#signIn = undefined;
        const ended = error instanceof SignInEnded ? error : new SignInEnded("unavailable");
        this.#lastWord = ended.reason === "cancelled" ? undefined : { account: account.id, reason: ended.reason, ...(ended.words === undefined ? {} : { words: ended.words }), ...(ended.minutes === undefined ? {} : { minutes: ended.minutes }) };
        // Drawn keeping the keyboard on the control it was on, where the person moved it while the press waited.
        this.#redraw();
        // The last word is said once, as it is drawn.
        const line = this.element.querySelector(`[id="${place}"] .pl-last`);
        if (line !== null) this.context.announce?.(line.textContent ?? "");
        giveBack(from);
      });
    return waits;
  }

  /** The card of the sign-in under way: what is typed is kept for the next drawing, and a send that is not taken says so in the card. */
  #card(at: SignInAt): HTMLElement {
    const backend = this.context.backend;
    const set = (card: Partial<SignInCard>): void => { at.card = { ...at.card, ...card }; };
    const send = async (id: string, answer: DialogAnswer): Promise<boolean> => {
      set({ sending: true, note: undefined });
      this.#redraw();
      const taken = await backend.answerSignIn(at.account, id, answer).catch(() => false);
      // A taken answer's question is gone from the card: its key is let go here, with nothing to draw back.
      if (taken) this.#waits.release(`dialog ${id}`);
      if (this.#signIn !== at) return taken;
      set({ sending: false, ...(taken ? { ask: undefined } : { note: "unsent" as const }) });
      this.#redraw();
      if (!taken) placed(this.element, "sign-in-field")?.focus();
      return taken;
    };
    const card = signInCard(at.card, {
      say: (key, values) => this.#say(key, values),
      typed: (value) => set({ typed: value }),
      submit: () => {
        const shape = shapeOf(at.card);
        const value = at.card.typed.trim();
        if (shape === undefined) return;
        // A domain may be blank, for github.com; one that is not GitHub Enterprise Cloud's is not sent.
        if (shape === "domain" && badDomain(value) !== undefined) { set({ note: "domain" }); this.#redraw(); placed(this.element, "sign-in-field")?.focus(); return; }
        if (value === "" && shape !== "domain") { set({ note: "empty" }); this.#redraw(); placed(this.element, "sign-in-field")?.focus(); return; }
        // An address from elsewhere is said on the card and not sent, the sign-in kept open for the one the browser stopped on.
        const stop = at.card.link?.kind === "link" ? at.card.link.stop : undefined;
        if (shape === "address" && stop !== undefined && !stopsAt(value, stop)) { set({ note: "elsewhere" }); this.#redraw(); placed(this.element, "sign-in-field")?.focus(); return; }
        const asked = at.card.ask?.dialog;
        if (asked?.method !== "input") { set({ note: "unsent" }); this.#redraw(); return; }
        void send(asked.id, { value });
      },
      cancel: () => at.stop.abort(),
      dialog: { say: (key) => this.#say(key), answer: send, waits: this.#waits },
    });
    card.setAttribute("data-focus", "sign-in");
    return card;
  }

  /**
   * The last word on a sign-in at the account that ended without success, inset under its row: one sentence that names nobody, and under
   * it, quoted, the flow's own words where it gave any. A refusal, a bad paste and one that could not run are failures; one that ended
   * since, one turned away for now and one that timed out are facts. A sign-in that ended since is said from the account's own record.
   */
  #lastLine(account: Account, name: string): HTMLElement | false {
    const last: Omit<LastWord, "reason"> & { readonly reason: LastWord["reason"] | "ended" } | undefined = this.#lastWord?.account === account.id ? this.#lastWord
      : account.ended !== undefined ? { account: account.id, reason: "ended", words: account.ended } : undefined;
    if (last === undefined || last.reason === "cancelled") return false;
    const sentence = last.reason === "refused" ? this.#say("signIn.refused") : last.reason === "ended" ? this.#say("signIn.ended", { name })
      : last.reason === "busy" ? this.#say("signIn.busy", { name }) : last.reason === "crowded" ? this.#say("signIn.crowded") : last.reason === "too_often" ? this.#say("signIn.tooOften")
        : last.reason === "timed_out" ? this.#say("signIn.timedOut", { n: last.minutes ?? 0 }) : last.reason === "bad_paste" ? this.#say("signIn.badPaste") : this.#say("signIn.unavailable", { name });
    const failed = last.reason === "refused" || last.reason === "bad_paste" || last.reason === "unavailable";
    const words = last.reason === "refused" || last.reason === "ended" ? last.words : undefined;
    return h("p", { class: failed ? "pl-failed pl-failed-row pl-last" : "pl-fact pl-fact-row pl-last" },
      h("span", { class: failed ? "pl-failed-text" : undefined }, sentence), words !== undefined && " ",
      words !== undefined && h("span", { class: "pl-last-words", lang: /[㐀-鿿]/.test(words) ? "zh-CN" : "en" }, this.#say("signIn.quoted", { words })));
  }

  /**
   * A vendor just signed in to takes a free place on the model card, as a key just saved does on the models' page, in the one write
   * 加入对话 makes, so the page draws it once that write is answered; a tick it cannot record changes nothing. A vendor with a card takes the place with the series its row on the Models in chat page lists, up to five, and only
   * while none of its series is ticked; an install chooses none. With chat full nothing is said now, and the vendor's row on the page says
   * it. A provider with no card of its own ticks nothing.
   */
  async #tickVendor(provider: string): Promise<void> {
    const backend = this.context.backend;
    const card = PROVIDERS[provider]?.card;
    if (card === undefined) return;
    try {
      const [series, offer] = await Promise.all([backend.series().then((all) => all[card] ?? []), backend.chatOffer()]);
      if (offer?.places.includes(card) !== false) return;
      const names = firstFive(series).map((one) => one.name);
      if (names.length > 0) await backend.addToChat(card, names);
    } catch { /* the sign-in stands; the person ticks a series on the vendor's Models tab */ }
  }

  /**
   * What a card or a press on the header did is said in the page's toast, as a list says it: a line under the header would push the tabs
   * down. With no toast to say it in, the line under the header says it.
   */
  #cards(): CardContext {
    const tell = this.context.tell;
    return { ...cardsFor(this.context, (work, told, failed, about) => this.#act(work, tell === undefined || told === "" ? told : () => { tell(told); return undefined; }, failed, about)), returnTo: () => this.element.querySelector?.<HTMLElement>(".pl-more") };
  }

  /**
   * Installs a plugin and everything it builds on, sources turned on; the install card stands in front where it has something to say.
   * Done, the keyboard lands on the control that took Install's place: the header's switch, or ⋮.
   */
  async #install(plugin: Plugin, own = false): Promise<boolean> {
    if (own && unconnected(this.context.held, plugin)) this.#toSettings = plugin.id;
    const done = this.#installed(await install(this.#cards(), plugin));
    if (!done && this.#toSettings === plugin.id) this.#toSettings = undefined;
    this.#settingsOnceFillable();
    return done;
  }
  /**
   * A source that must be connected, installed from its own page's header, opens its Settings once they can be filled — installed, or
   * its install written down — where the seller still stands on that page; a tab they moved to since, or a page left, ends it. Its
   * Settings tab takes the keyboard, as a tab pressed does.
   */
  #settingsOnceFillable(): void {
    const at = this.#at, pending = this.#toSettings;
    if (pending === undefined) return;
    if (at === undefined || at.plugin.id !== pending || this.element.isConnected === false) { this.#toSettings = undefined; return; }
    if (!installed(this.context.held, at.plugin) && this.context.queued?.(at.plugin) === undefined) return;
    this.#toSettings = undefined;
    if (at.tab === "settings" || !tabsOf(at.plugin, this.context.held, this.context.features).includes("settings")) return;
    location.hash = `${href.item(at.plugin)}/settings`;
  }
  /**
   * A bundle's press keeps the keyboard where it was pressed: on ✓ once it lands, which holds the press's place, so a failure the
   * computer answers later puts it on its line's try; on that try where the press itself failed.
   */
  async #installBundle(bundle: Bundle): Promise<boolean> {
    const done = await install(this.#cards(), bundle);
    const at = done ? this.#tool(".pl-done") : this.element.querySelector?.<HTMLElement>(".pl-failed .pl-again") ?? undefined;
    if (at === undefined) return this.#installed(done);
    at.focus();
    return done;
  }
  /**
   * A failure leaves the keyboard on the control that was pressed, Install again, so a second press is one key away; where the header
   * holds no Install, on the failure's own try.
   */
  #installed(done: boolean): boolean {
    (done ? this.#tool("[role=switch]", ".pl-more") : this.#tool("button.primary") ?? this.element.querySelector?.<HTMLElement>(".pl-failed .pl-again"))?.focus();
    this.#land();
    return done;
  }

  /**
   * An answer can rule out the control that was pressed, which is then drawn no longer: the keyboard it had goes to the control beside
   * it, or to the way back where the record's page gave way.
   */
  #land(): void {
    const page = globalThis.document;
    if (page === undefined || (page.activeElement !== null && page.activeElement !== page.body && page.activeElement.isConnected)) return;
    (this.#tool("[role=switch]", ".pl-more", "button.primary") ?? this.element.querySelector?.<HTMLElement>(".back a"))?.focus();
  }

  /** A failed click tried again from its line, by the first press's own road: a removal asks its card again; the keyboard stays on the line's try. */
  async #again(item: Plugin | Bundle, failed: Failed): Promise<void> {
    // An update is tried again as Update is pressed: the page keeps the keyboard on its line.
    if (failed.act === "update") { if (!isBundle(item)) this.context.update?.([item], `update ${item.id}`); return; }
    const done = failed.act === "remove" ? await this.#remove(item) : await again(this.#cards(), item, failed);
    (done ? this.#tool("[role=switch]", ".pl-more") : this.element.querySelector?.<HTMLElement>(".pl-failed .pl-again"))?.focus();
    this.#land();
  }

  /** Every removal lands on Yours, which says what was removed; a failure stays here and says what was not. */
  async #remove(item: Plugin | Bundle): Promise<boolean> {
    const cards = cardsFor(this.context, (work, told, failed, about) => {
      // A result that arrives after the seller left moves nothing: its line shows where they are.
      const at = here();
      const fail = async (): Promise<false> => {
        // Here, the failure stands on the record in brick; a seller who left is told where they are.
        const left = here() !== at && this.context.tell !== undefined;
        if (!left) this.#note = about === undefined ? failed : undefined;
        await this.context.reload();
        if (left) this.context.tell?.(failed, about, true);
        return false;
      };
      const landed = async (said: string): Promise<true> => {
        this.#note = undefined;
        if (here() !== at && this.context.tell !== undefined) { if (said !== "") this.context.tell(said); }
        else if (this.context.land !== undefined) this.context.land(said); else location.hash = this.context.back.href;
        await this.context.reload();
        return true;
      };
      if (about === undefined) return work().then(() => landed(told), fail);
      // Written down, the removal lands on Yours at once, asleep or awake; what is said of it waits for cx's computer, and a failure then stands on the record.
      return new Promise<boolean>((resolve) => {
        let written = false;
        this.context.doing.track(about, work, () => { written = true; void landed("").then(resolve); }).then(async (how) => {
          if (!written && how === "unsaid") { await this.context.reload(); resolve(false); return; }
          if (!written) resolve(await landed("")); else if (how === "done" || how === "unsaid") await this.context.reload();
          const said = endSaid(how, told);
          if (said !== "") this.context.tell?.(said);
        }, async () => { if (!written) { resolve(await fail()); return; } await this.context.reload(); this.context.tell?.(failed, about, true); });
      });
    });
    const done = await remove({ ...cards, switched: (plugin) => !this.context.doing.facts(plugin).has("single_file"), returnTo: () => this.element.querySelector?.<HTMLElement>(".pl-more") }, item);
    if (!done) this.#land();
    return done;
  }

  async #turn(plugin: Plugin, on: boolean): Promise<void> {
    await (on ? turnOn(this.#cards(), plugin) : turnOff(this.#cards(), plugin));
    this.#land();
  }

  /**
   * A template's sentence is put in the composer, the caret after it, for the person to send, or not; a send sends what the box says.
   * On a record not installed yet, it is installed first, as its + installs it. A press sends nothing.
   */
  async #tryPrompt(plugin: Plugin, prompt: Prompt): Promise<void> {
    if (this.context.unread) return;
    if (!installed(this.context.held, plugin) && !(await this.#install(plugin))) return;
    const sentence = this.#words(prompt.about);
    this.context.ask(sentence, [sentence.length, sentence.length]);
  }

  /**
   * Does one thing, then reads the world again; a word of what happened is drawn with the page the reload draws, until the next action.
   * A failure says the action's own failed line, a failed save the not-saved one. Answers whether the thing was done.
   */
  async #act(work: () => Promise<void | "unsaid">, told?: StringKey | string | (() => string | undefined), failed?: string, about?: About): Promise<boolean> {
    const at = here();
    const words = (): string | undefined => (typeof told === "function" ? told() : told === undefined || told === "" ? undefined : told.startsWith("pl.") ? this.#say(told as StringKey) : told);
    const notSaved = failed ?? this.#say("pl.st.notSaved");
    if (about === undefined) return work().then(() => this.#answered(true, words(), undefined, at), () => this.#answered(false, notSaved, undefined, at));
    // A click is answered once it is written down, asleep or awake; what is said of it waits for its end, and a failure then stands on its record.
    const late = (said: string | undefined): void => {
      if (said === undefined || said === "") return;
      if (this.context.tell !== undefined) this.context.tell(said);
      else { this.#note = said; void this.context.reload(); }
    };
    return new Promise<boolean>((resolve) => {
      let written = false;
      this.context.doing.track(about, work, () => { written = true; void this.#answered(true, undefined, about, at).then(resolve); }).then(async (how) => {
        if (!written && how === "unsaid") { await this.context.reload(); resolve(false); return; }
        // Said as soon as it is known: an install's or an update's sentence is its write's, never the list's read after it.
        if (written) late(how === "done" ? words() : "");
        // An install is answered at its write, which `#answered` already read the world after: it has no end of its own to read again for.
        if (!written) resolve(await this.#answered(true, undefined, about, at)); else if ((how === "done" || how === "unsaid") && about.act !== "install") await this.context.reload();
        if (!written) late(how === "done" ? words() : "");
      }, async () => { const answered = this.#answered(false, notSaved, about, at); if (!written) resolve(await answered); else await answered; });
    });
  }

  /** What the page draws once an act is answered: `said` is its word, under the header or, where the seller left, where they are. */
  async #answered(done: boolean, said: string | undefined, about: About | undefined, at: string | undefined): Promise<boolean> {
    // Left before the answer: it is said where the seller is, and this page keeps nothing of it. A failure is said over the world as the click left it.
    if (here() !== at && this.context.tell !== undefined) {
      this.#note = undefined;
      await this.context.reload();
      if (said !== undefined) this.context.tell(said, done ? undefined : about, !done);
      return done;
    }
    // A failed click on a record stands on the record, in brick; the quiet line is for what was done.
    this.#note = !done && about !== undefined ? undefined : said;
    await this.context.reload();
    return done;
  }

}

/**
 * A README npm cut short at its bound, without the block the cut ran through: the text to its last blank line, and before a code
 * block left open there.
 */
export function uncut(text: string): string {
  const at = text.lastIndexOf("\n\n");
  const kept = at === -1 ? "" : text.slice(0, at);
  const fences = [...kept.matchAll(/^ {0,3}(```|~~~)/gm)];
  return fences.length % 2 === 1 ? kept.slice(0, fences.at(-1)!.index).trimEnd() : kept;
}

/** Letters and digits of a name, its scope left out, as a heading that says the name again is told from one that says more. */
const bareName = (words: string): string => words.toLowerCase().replace(/^@[^/]+\//, "").replace(/[^a-z0-9]/g, "");

/** The words a README's link out carries for a screen reader, in the page's language, whatever language the README is in. */
type Outside = { readonly words: string; readonly lang: string };

/**
 * A package's README as the page draws it: its markdown as text and headings, never its markup, its first heading left out where it
 * only says the package's name again. Where `base` says where the package's files are served, a link or picture written against them
 * resolves there, as pi.dev draws them, and a picture served there is drawn; no other picture is fetched. A link is kept only where it
 * names a web address in full, since one written against the package's own files would otherwise open a page of this site. In a plugin's
 * Overview (`packages`), a link to a package's page on npm opens that package's page here, in place, as the page's own links do.
 */
function readme(text: string, name: string, outside: Outside, { base, repository, packages = false }: { readonly base?: string | undefined; readonly repository?: string | undefined; readonly packages?: boolean } = {}): HTMLElement {
  const holder = h("div", { class: "markdown pl-readme", ...authored(text) });
  holder.innerHTML = readmeHtml(text, { base, repository });
  // A first heading that only says the plugin's name again goes: the page's title, just above, says it.
  const first = holder.firstElementChild;
  if (first !== null && first !== undefined && /^H[1-4]$/.test(first.tagName) && bareName(first.textContent ?? "") === bareName(name)) first.remove();
  for (const anchor of holder.querySelectorAll?.("a") ?? []) {
    const npm = packages ? npmPageOf(anchor.getAttribute("href") ?? "") : undefined;
    if (npm !== undefined) { anchor.setAttribute("href", href.npm(npm)); continue; }
    // Each other link opens a new tab and says so to a screen reader, as round 27's links out do.
    if (/^https?:\/\//.test(anchor.getAttribute("href") ?? "")) { anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; anchor.append(h("span", { class: "pl-sr", lang: outside.lang }, outside.words)); }
    else anchor.replaceWith(...anchor.childNodes);
  }
  // A table wider than the column scrolls inside its own frame, which the keyboard can reach; it is named by its own headings.
  for (const table of holder.querySelectorAll?.("table") ?? []) {
    const frame = h("div", { class: "pl-readme-table", tabindex: "0", role: "group", "aria-label": [...table.querySelectorAll("th")].map((one) => one.textContent?.trim() ?? "").filter((one) => one !== "").join(", ") });
    table.replaceWith(frame);
    frame.append(table);
  }
  return holder;
}


