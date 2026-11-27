import { linked, OFFER } from "./box-words.js";
import { ComputerPending, MONEY_AS, isMember, NO_PACKAGES, NPM_KINDS, NPM_ORDERS, NPM_STEP, formatTotal, type Backend, type Click, type Features, type Me, type NpmListed, type NpmOrder, type NpmPackage, type PackageList, type Provider, type Words } from "./backend.js";
import type { Money } from "../shared/money.js";
import { isOurs } from "../shared/package-names.js";
import { declaredBy, nameIn, vendorIn, type Bundle, type Catalogue, type Plugin } from "./catalogue.js";
import { fill, h, placed, refocus, svg, type Child } from "./dom.js";
import { ART, LINES, LOGOS, ownMark } from "./plugin-marks.js";
import { drawMark } from "./mark-shapes.js";
import { cardWord, PROVIDERS } from "../shared/model-makers.js";
import { failedInstalls, linkedBy, sharedEnds,
  PER_SHELF, SHELVES, cardOf, href, holds, inYours, installed, installsOf, isBundle, matches, membersOf, mine, modelOf, offered,
  needsOf, readsOn, shown, sourceFor, sourceOf, type Filter, type Held, type ChatRoute, type HomeRoute, type Item, type Route, bannerOf, cameWith, route,
  skillsFrom, skillWordsIn, standingSources, connectedWays, drawnCatalogue, openingWays, wayWord, type PlatformModel, type Standing, oursNewest,
  servedVendors, soughtOf, THIRD, YOURS_SHELVES, asAsked, filesMissing, isThird, madeByUs, type Third, type YoursShelf, inOrder, ofKind, type Shelf,
} from "./plugins-model.js";
import { packageProvider, PLUGIN_PROVIDERS } from "../shared/provider-packages.js";
import { factsLine, isPiPackage, linksLine, namesMaker, piMark } from "./plugins-card.js";
import { Doing, doingName, endSaid, failureToast, type About, type Told } from "./plugins-doing.js";
import { hideTipWithin, switchButton, toastStay, type Menu } from "./forms.js";
import { iconAct, moreMenu, rowMark, rowShell } from "./plugins-row.js";
import type { Band } from "./guide-band.js";
import { newDot, offered as updatesOffered, rowUpdate, sendUpdates, updatesLine, type UpdateContext } from "./plugins-update.js";
import type { FeatureWorld } from "./feature-card.js";
import { cancelPlace, installRow, queued, queueOf, queueRow, queueSection, retryPlace, runningRow, updateHeld, type Power, type QueueContext, type RowHead, type QueueRow } from "./plugins-queue.js";
import { Clicks, REREAD_MS, WAIT_BOUND_MS } from "./plugins-clicks.js";
import { ItemPage, ago, recordShape, cardsFor, here, type FailedRow, type ItemContext, type KeptReads, type Tab } from "./plugins-item.js";
import { authored, galleryPlugin, npmNameOf, thirdInitial, thirdMark, withGallery, type Declared } from "./plugins-npm.js";
import { bar, block, busyMark, keepRows, ringed, rowsFor, skeleton, spinner, Waits } from "./waiting.js";
import { again, cardFor, factLine, failureLine, holdRows, install, remove, seekCard, turnOff, turnOn, type CardContext } from "./plugins-cards.js";
import type { Say } from "./stream-view.js";
import type { Language, StringKey } from "./strings.js";

/** Where an address that names no page of these lands: Discover, every shelf. */
export const HOME: Route = { kind: "home", view: "discover", filter: "all" };

/** Discover's third-party list as npm answered it for one kind in one order, read a step at a time; `more` is the next step's read. */
/**
 * A list of the gallery read so far: the packages it draws, and `next`, where the platform's list goes on, which counts every package
 * the platform answered, drawn or not.
 */
type ThirdList = { readonly key: string; readonly packages: readonly NpmListed[]; readonly next: number; readonly total: number; readonly state: "loading" | "ready" | "failed"; readonly more?: "loading" | "failed" };
/**
 * The gallery's packages made for ComChatX by someone else, read whole once a load: few, and listed among ComChatX's own; `declared`
 * is what each one's `comchatx` field says of it, as read; `unread` names those whose page the platform did not answer, read again at
 * the next load and drawn meanwhile as declaring nothing.
 */
type MadeList = { readonly packages: readonly NpmListed[]; readonly declared: ReadonlyMap<string, Declared>; readonly unread: readonly string[]; readonly state: "loading" | "ready" | "failed" };
/** A package that brings a vendor's provider is never a card, on any list and whatever keyword its search entry carries. */
const drawable = (listed: NpmListed): boolean => packageProvider(`npm:${listed.name}`) === undefined;
/** A list of pi's gallery is its kind, its order and the words searched: each is its own list, read from its first step. */
const thirdKey = (third: Third, sought: string): string => `${third.kind}/${third.order}/${sought.trim()}`;

/** The record page drawn, and what it was drawn from, so a redraw the seller did not ask for keeps it whole. */
/** Why the installed list is not known: still on its way, cx's computer not set up yet or off, or a read that failed. */
type ListWhy = "listing" | "pending" | "failed";
type HeldRead = { readonly held: Held; readonly unread: boolean; readonly why: ListWhy | undefined; readonly retry: boolean; readonly listed: boolean; readonly list: PackageList; readonly provided: boolean };
type RecordPage = { readonly key: string; readonly page: ItemPage; readonly held: Held; readonly unread: boolean; readonly language: Language; readonly back: string };

export type PluginsPagePorts = {
  readonly say: Say; readonly language: () => Language; readonly backend: Backend; readonly me: () => Extract<Me, { kind: "signed_in" }> | undefined;
  /** Puts words in the composer, with a stretch of them selected where one is given; the person sends them, or does not. */
  readonly ask: (words: string, select?: readonly [number, number]) => void;
  /** Tells a screen reader alone, in the app's one region for it: a vendor going into chat or out, and a tick refused. */
  readonly announce: (words: string) => void;
  /**
   * Reads the world again after a change, so the sidebar's counts and the sources bar follow; `updated` names, by npm name, each package
   * whose update ended well with it.
   */
  /** Something installed changed; where a queue's entry left it, the packages its list holds are given (`installed`). */
  readonly changed: (updated?: readonly string[], installed?: number) => Promise<void>;
  /** Where a card opens; the document's body unless a test gives another. */
  readonly cards?: () => HTMLElement;
  /** What the sidebar draws of the page — its dot of plugins with a new version — changed with a read that came in after the page was drawn. */
  readonly glanced?: () => void;
  /** cx's computer is starting, as the chat's line says it is: the installed list's place says so while it waits. */
  readonly starting?: () => boolean;
  /** cx is answering: an install or an update waits for the answer to end. */
  readonly answering?: () => boolean;
  /** cx's computer as cx's card holds it: off or starting, every install and update waits for it to be on. */
  readonly power?: () => Power;
  /** A list was read: what the line above the message box names may have changed. */
  readonly listRead?: () => void;
};

/** A line icon from the page's marks, in the text's own colour. */
export function line(name: string): SVGSVGElement | undefined {
  const d = ownMark(LINES, name);
  return d === undefined ? undefined : svg("svg", { viewBox: "0 0 24 24", class: "pl-icon", "aria-hidden": "true" }, svg("path", { d }));
}

/** How many marks have been drawn, so each drawing's own names differ from every other's. */
let drawings = 0;
/** A card not read yet, in a card's own frame and size: the mark, the name, two lines of what it does, the byline. */
const cardShape = (): HTMLElement => h("div", { class: "f-card pl-card pl-card-open" }, block(h("span", { class: "tile" })),
  h("span", { class: "pl-card-text" }, bar(5), h("span", { class: "pl-about" }, bar(12, "small"), bar(8, "small")), h("span", { class: "pl-meta" }, bar(4, "small"))));
/** A shelf's head not read yet: its name, as a shelf's heading is drawn. */
const shelfHead = (): HTMLElement => h("div", { class: "pl-shelf-head" }, h("div", {}, bar("word", "lead")));
/** Discover not read yet: `shelves` shelves, each a full shelf of cards. */
export const cardsShape = (word: string, shelves: number): HTMLElement => skeleton(word, ...Array.from({ length: shelves }, () =>
  h("section", { class: "pl-shelf" }, shelfHead(), h("div", { class: "pl-cards" }, ...Array.from({ length: PER_SHELF }, cardShape)))));
/** A row of Yours not read yet: the mark, the name and its line. */
const rowShape = (): HTMLElement => h("li", {}, h("div", { class: "pl-row" }, block(h("span", { class: "tile" })), h("span", { class: "pl-row-text" }, bar(4), bar(9, "small"))));
/** Yours not read yet: a shelf of as many rows as this browser drew there last. */
export const rowsShape = (word: string): HTMLElement => skeleton(word, h("section", { class: "pl-shelf" }, shelfHead(), h("ul", { class: "pl-list pl-rows" }, ...Array.from({ length: rowsFor("yours") }, rowShape))));

/** A record's mark: its vendor's logo, its line icon or its own drawing, else its initial. */
export function tile(item: Item, big = false, language: Language = "en"): HTMLElement {
  const element = h("span", { class: big ? "tile pl-tile-big" : "tile", "aria-hidden": "true" });
  // A pi package draws pi's own mark: the image its manifest may name is from elsewhere, which the page does not load.
  if (!isBundle(item) && isPiPackage(item)) { element.classList.add("pl-logo"); element.append(piMark()); return element; }
  const mark = item.mark;
  const logo = mark !== undefined && "logo" in mark ? ownMark(LOGOS, mark.logo) : undefined;
  if (logo !== undefined) {
    element.classList.add("pl-logo");
    // The logos are the repository's own drawings, never a record's or a person's words.
    const drawn = svg("svg", { viewBox: logo.viewBox, fill: "currentColor", "fill-rule": logo.fillRule ?? "nonzero" });
    // A mark that names parts of itself (Poolside's mask) names them anew in each drawing, so no drawing reads another's, hidden or gone.
    drawn.innerHTML = logo.body.replaceAll("_R_0_", `_${++drawings}_`);
    element.append(drawn);
    return element;
  }
  if (mark !== undefined && "draw" in mark) {
    element.classList.add("pl-drawn-tile");
    element.append(drawMark(mark));
    return element;
  }
  const drawn = mark !== undefined && "line" in mark ? line(mark.line) : undefined;
  if (drawn !== undefined) element.append(drawn);
  else element.textContent = !isBundle(item) && !madeByUs(item) && (item.npm !== undefined || item.own === true) ? thirdInitial(item.name) : [...nameIn(item, language).trim()][0]?.toUpperCase() ?? "";
  return element;
}

/** How long the mark on the shelf an address landed on stands, as long as the stylesheet takes to fade it. */
const LANDED_MS = 2400;
/**
 * How soon a list cx's computer was not ready to answer is asked again: a computer awake but not yet ready says so at once and is ready
 * moments later, and nothing else tells the page; one that wakes is heard, and asked at once.
 */
export const PENDING_AGAIN_MS = 3_000;
/** The place the list's heading holds, for the keyboard a removal leaves with no card to go to. */
const HEADING = "heading";

/** The place the banner's Install holds, by which the keyboard finds it again. */
const BANNER_ACT = "banner-act";

const EMPTY: Held = { catalogue: { plugins: [], bundles: [], words: {} }, packages: [], onImage: [], sources: [], models: [] };

/**
 * The Plugins page drawn from the catalogue's records: Discover, everything offered, in shelves; and Yours, what the person holds, in
 * the same shelves. A card or a row is one link onto its record's page. What the person holds is read from the backend, each read on
 * its own, so one that fails leaves only its own part empty.
 */
export class PluginsPage {
  readonly element = h("div", { class: "pl-page" });
  #held: Held = EMPTY;
  /** The world a glance read for the sidebar before the page opened. */
  #glanced: Held | undefined;
  #money: Money | undefined;
  #loaded = false;
  #asked = false;
  /** A read of what the seller holds failed: the page then states nothing about what is held, and Yours offers to read again. */
  #unread = false;
  /** Why the installed list is not known, as the page says it in its place — off or not set up, read again when the page hears the computer —
   * and whether a read that failed is offered again beside it. */
  #why: ListWhy | undefined;
  /** Drawn from the reads answered so far, not yet from all of them: no card an address names is sought on it. */
  #early = false;
  /** The providers are out still: a record drawn from them, a model's or the chat's models page, stands as its shape until they answer. */
  #providing = false;
  #retry = false;
  /** A press of Try again whose read has not ended: the line's place says the list is on its way, and there is nothing in it to press again. */
  #readingAgain = false;
  /**
   * The failure line as last drawn, kept while what it says stands: a draw the seller did not ask for — a word from cx's computer, a read
   * answering — leaves the button under the pointer, so a press begun on it is the click it ends as.
   */
  #unreadKept: { readonly said: string; readonly line: HTMLElement } | undefined;
  #route: Route = HOME;
  #sought = "";
  /** The search the address last named: the same address shown again, as when a card over it closes, leaves what was typed since. */
  #named: string | undefined;
  /** Said after an action that has no page of its own to show, such as + installing a model plugin; announced, and gone after a moment. */
  readonly #toast = h("p", { class: "pl-toast", role: "status" });
  /** The ⋮ menus of the rows drawn now, by their slot. */
  readonly #menus = new Map<string, Menu>();
  #toastTimer: ReturnType<typeof setTimeout> | undefined;
  #toastStay = 0;
  readonly #toastHeld = new Set<"pointer" | "keyboard">();
  /**
   * Where the keyboard goes once it is drawn: a page reached from another one, or from an address typed in, takes it to its title; a
   * record's tab pressed keeps it on that tab.
   */
  #toFocus: "title" | "tab" | undefined;
  /** The last thing the person pressed was a key: a title the page moves to then draws the keyboard's ring, after a pointer's press it does not. */
  #keyed = false;
  /** The person said "Don't show again" to the rule cx buys by: read with their card choices, and taken at the press. */
  #ruleSeen = false;
  readonly #rule = { ruleSeen: (): boolean => this.#ruleSeen, seeRule: (): void => { this.#ruleSeen = true; void this.ports.backend.seeRule().catch(() => undefined); } };
  /** The app showed another page since this one was last shown. */
  #away = true;
  /**
   * The records walked since the last list, in order, and that list: a record's back link names the one before it, or the list. Going
   * back to a record already on the trail cuts the trail there, so back never points forward; a tab change keeps the trail.
   */
  #trail: Route[] = [];
  #list0: HomeRoute | undefined;
  /** The record page now shown and its route's key: a redraw of the same route draws the same page again, so what it read and said is kept. */
  #page: RecordPage | undefined;
  /** The catalogue's records, read once at start, so the sidebar's and the model card's links name a record's own address before the page is opened. */
  #records: Held["catalogue"] | undefined;
  /** The clicks out and the ones that failed, which every drawing of a record reads. */
  readonly #doing = new Doing();
  readonly #waits = new Waits(() => this.element);
  /** npm's answer for each package of someone else's that one of ours installs with it, asked once a page. */
  readonly #npmWords = new Map<string, Promise<NpmPackage | undefined>>();
  /** The names npm's read failed for since the last load: not asked again for an installed package's author until the next load. */
  readonly #npmFailed = new Set<string>();
  /**
   * npm's answers for a name, once in: the package, or that npm holds none by it. The one record of what was read: what fills an
   * installed package's record where the list states nothing of it, and the only ground for saying its author is not stated.
   */
  readonly #npmSaid = new Map<string, NpmPackage | "unknown">();
  /** What npm says each of someone else's installed packages uses, by npm name, from the last read of its newest version: what Update all orders by. */
  readonly #theirUses = new Map<string, readonly string[]>();
  /** npm's newest versions of the installed packages, read after the world the page is drawn from. */
  #newestRead: Promise<void> = Promise.resolve();
  /** What its record pages read of npm by name, kept across them: each tab is a page opened anew. */
  readonly #kept: KeptReads = { ours: new Map(), uses: new Map() };
  readonly #clicks = new Clicks(() => {
    const began = ++this.#heard;
    return this.ports.backend.packages().then((list) => { this.#listed = list; this.#heardAt.set(list, began); return list; });
  }, () => this.#power() === "off");
  /**
   * The platform's words on the account's row in order: each list by when its read began, as the clicks' batches count reads, and the row
   * a write's answer carried by when it came. A world whose list's read began before a write's answer came, which could not know the
   * click, is drawn with that answer's row over it.
   */
  #heard = 0;
  readonly #heardAt = new WeakMap<PackageList, number>();
  #answered: { readonly waiting: readonly Click[]; readonly at: number } | undefined;
  /** The page's loads, numbered as each begins, and the newest drawn: a load that lands after a later one has drawn draws nothing. */
  #loads = 0;
  #drawn = 0;
  /** The account's package list as last read: a record that names no source is matched to its package by it. */
  #listed: PackageList | undefined;
  /** A click's end is waited for once the platform has written it down, which is when its record is drawn as the seller asked; an act with no click is done at once. */
  readonly #ended: CardContext["ended"] = (clicks, about, waits = true) => {
    // Written down, a click is drawn as the seller asked on every surface at once, from the row's waiting list its answer carried: the
    // list read after it settles how it ends.
    const row = clicks.findLast((click) => click.waiting !== undefined)?.waiting;
    if (row !== undefined) { this.#answered = { waiting: row, at: ++this.#heard }; this.#held = { ...this.#held, packages: asAsked(this.#held.packages, row) }; }
    if (about !== undefined && clicks.length > 0) this.#doing.written(about.item);
    return waits ? this.#clicks.ended(clicks) : Promise.resolve("done");
  };
  /** The series unfolded on a vendor's Models tab, each by its plugin and its name, until the page is loaded anew. */
  readonly #openSeries = new Set<string>();
  readonly #chatOpen = new Set<string>();
  /** The shelf of Yours an address landed on: marked while this stands, and brought into view once, when it is first drawn. */
  #landed: { readonly shelf: "models"; seen: boolean; since?: number } | undefined;
  #landedTimer: ReturnType<typeof setTimeout> | undefined;
  #queueTimer: ReturnType<typeof setTimeout> | undefined;
  /** The newest list that said what waits; the entries the queue held at the last read, and since when it has held them unchanged. */
  #worded: PackageList | undefined;
  #queued: readonly QueueRow[] = [];
  #queuedSince = 0;
  #pendingTimer: ReturnType<typeof setTimeout> | undefined;
  /** An address lands once each time the seller comes to it: the reads answering later, or a redraw, show the same address and land nothing. */
  #lands = true;
  /** The vendor an arrival at the chat's models page names, landed on at its first drawing once the page is read. */
  #chatLand: string | undefined;
  /** The record a removal just took, by its address, until the list it lands on is drawn from a read begun after it: the keyboard goes there. */
  #removed: { readonly at: string; read: boolean } | undefined;
  /** Create's menu is open, with the listener that closes it on a click elsewhere: a redraw the seller did not ask for keeps both. */
  #createOpen = false;
  #createAway: ((event: Event) => void) | undefined;
  /** Pi plugins read so far, kept while the seller opens a package from it and comes back. */
  #third: ThirdList | undefined;
  /** The packages made for ComChatX by someone else, read once a load. */
  #made: MadeList | undefined;
  /** Where a list stood when the seller left it for a record: coming back to that list puts it there again, on the record left. */
  #stuckOn: Element | undefined;
  /** A card the address named while the installed list was unread, which the next load that reads the list opens. */
  #seekLater = false;
  #listAt: { readonly key: string; readonly top: number; readonly left: string; readonly sought: string } | undefined;
  constructor(readonly ports: PluginsPagePorts) {
    void ports.backend.catalogue().then((records) => { this.#records = records; }, () => undefined);
    globalThis.document?.addEventListener?.("keydown", () => { this.#keyed = true; }, true);
    globalThis.document?.addEventListener?.("pointerdown", () => { this.#keyed = false; }, true);
    // The control a click replaced is found again by the place it holds, so the keyboard stays where the seller pressed.
    this.#doing.members = (bundle) => membersOf(this.#held, bundle);
    this.#doing.changed = () => { const keep = this.#focused(); this.draw(); if (this.#route.kind === "plugin" || this.#route.kind === "bundle" || this.#route.kind === "chat") this.#page?.page.again(); keep?.(); };
    // A press on the toast does not take the keyboard: it would stay with no one on it.
    this.#toast.addEventListener("mousedown", (event) => event.preventDefault());
    this.#toast.addEventListener("pointerenter", () => this.#hold("pointer", true));
    this.#toast.addEventListener("pointerleave", () => this.#hold("pointer", false));
    this.#toast.addEventListener("focus", () => this.#hold("keyboard", true));
    this.#toast.addEventListener("blur", () => this.#hold("keyboard", false));
    // A window's width changes how tall a card is, so the size held under a line is measured again.
    globalThis.addEventListener?.("resize", () => { holdRows(this.element); this.#barClear(); this.#stick(); });
  }

  get #features(): Features { return this.ports.backend.features; }

  /**
   * The record page's address for a thing the rest of the page names another way: a source by its package name, a vendor by the
   * provider id its models come through. Undefined where no record names it.
   */
  hrefFor(kind: "source" | "vendor", id?: string): string | undefined {
    const plugin = this.#recordFor(kind, id);
    return plugin === undefined ? undefined : href.item(plugin);
  }
  /** The record's own name for what `hrefFor` finds. */
  /** A plugin's or a bundle's name as the page's language names it. */
  #name(one: Plugin | Bundle): string { return nameIn(one, this.ports.language()); }

  /**
   * A package of ours by its card's name in the page's language, from the catalogue the page holds, read at start where the page has not
   * loaded: the board's caption and the line above the message box name it so. A provider's package, which is no card itself, is named by
   * the card it brings (TypeSafe's, Jev). Nothing for a package the catalogue gives no record.
   */
  packageName(npm: string): string | undefined {
    const plugins = (this.#loaded ? this.#held.catalogue : this.#records)?.plugins;
    const provider = packageProvider(`npm:${npm}`);
    const card = provider === undefined ? undefined : PLUGIN_PROVIDERS[provider] ?? PROVIDERS[provider]?.card;
    const record = plugins?.find((one) => one.own !== true && one.box?.package === npm) ?? (card === undefined ? undefined : plugins?.find((one) => one.id === card));
    return record === undefined ? undefined : this.#name(record);
  }

  nameFor(kind: "source" | "vendor", id?: string): string | undefined { const record = this.#recordFor(kind, id); return record === undefined ? undefined : this.#name(record); }
  /**
   * The words a seller reads on Plugins for a skill of the package a source is, where a record is of that package and names it. The
   * package is matched against the newest list read, whether or not the page has been drawn since: a source changed outside Plugins
   * keeps its record's words.
   */
  skillWords(source: string, name: string): Words | undefined {
    const catalogue = this.#records ?? (this.#loaded ? this.#held.catalogue : undefined);
    const list = this.#listed ?? (this.#loaded ? this.#held : undefined);
    if (catalogue === undefined) return undefined;
    return skillWordsIn({ ...EMPTY, catalogue, ...(list === undefined ? {} : { packages: list.packages, onImage: list.onImage }) }, source, name);
  }
  /** The account's package list read again, as the page reads it: it wakes nothing. */
  async readPackages(): Promise<void> { await this.#clicks.read(); }
  /**
   * The page's list of what cx can be asked by name, from the platform's record of the account's packages with every change still
   * waiting played over it, as the catalogue names each package's skills: the list read as the page reads it, which wakes nothing. A
   * package with no record is not in it.
   */
  async skillsHeld(): Promise<readonly { readonly name: string; readonly source: string }[]> {
    const [catalogue, list] = await Promise.all([this.ports.backend.catalogue(), this.#clicks.read()]);
    return skillsFrom({ ...EMPTY, catalogue, packages: list.packages, onImage: list.onImage }, standingSources(list));
  }
  #recordFor(kind: "source" | "vendor", id?: string): Plugin | undefined {
    const records = this.#loaded ? this.#held.catalogue : this.#records;
    return records === undefined ? undefined : recordIn(records, kind, id);
  }

  /**
   * The world the page is drawn from, read afresh; a read that fails leaves its part empty and says so. `early`, where given, is handed
   * the world as soon as the catalogue is in, every part not yet read drawn as not known, and again once every read but the installed
   * list is in: the list is cx's computer's to answer and the slowest read.
   */
  async #readHeld(withAccount = true, early?: (read: HeldRead) => void, newestLater?: (newest: Readonly<Record<string, string>>) => void,
    providedLater?: (provide: (held: Held) => Held) => void): Promise<HeldRead> {
    const backend = this.ports.backend;
    let unread = false;
    const read = <T>(answer: Promise<readonly T[]>): Promise<readonly T[]> => answer.catch(() => { unread = true; return []; });
    // Which of the three the account is decides what a model plugin's page draws; unread, it draws a member's.
    const standing = async (): Promise<{ readonly account: Standing; readonly platformServed?: readonly PlatformModel[] }> => {
      const [money, served] = await Promise.all([backend.accountMoney(), backend.platformModels().catch(() => undefined)]);
      return { account: money.state, ...(served === undefined ? {} : { platformServed: served }) };
    };
    // The page's first world joins a read the sidebar's glance has out: what is installed is asked once a load.
    const listing: Promise<{ readonly list: PackageList; readonly why?: ListWhy }> = (this.#loaded ? this.#clicks.read() : this.#clicks.join()).then((list) => ({ list }), (error: unknown) =>
      ({ list: NO_PACKAGES, why: error instanceof ComputerPending ? "pending" : "failed" }));
    let listed: { readonly list: PackageList; readonly why?: ListWhy } | undefined;
    void listing.then((one) => { listed = one; });
    // The first draw takes the catalogue as it is answered; a bare dependency's words from npm fill its record at the later draws.
    const catalogueRead = backend.catalogue();
    const providing = backend.providers().catch(() => undefined);
    let provided: { readonly providers: readonly Provider[] | undefined } | undefined;
    void providing.then((providers) => { provided = { providers }; });
    const reads = Promise.all([
      catalogueRead.then((answer) => this.#withNpmWords(answer)), read(backend.sources()),
      // What the platform does not offer is not asked for: a read with no route behind it would leave the whole page unread.
      this.#features.modelPlugins ? read(backend.modelPlugins()) : [], backend.models().catch(() => undefined),
      // The providers are a model's record's alone: where they can come in on their own, nothing else waits for them.
      backend.accounts().catch(() => undefined), providedLater === undefined ? providing : undefined,
      backend.series().catch(() => undefined),
      Promise.resolve().then(() => backend.chatOffer()).then((offer) => offer?.places, () => undefined),
      withAccount ? standing().catch(() => undefined) : undefined,
      // What the account's presses brought: unread, Yours keeps only the bundles whose list is whole, and no bundle's Remove is offered.
      this.#features.bundles ? Promise.resolve().then(() => backend.bundleState()).catch(() => undefined) : undefined,
      // Unread, the rule is told again: its "Don't show again" holds once the choices are read.
      Promise.resolve().then(() => backend.ruleSeen()).catch(() => false),
    ] as const);
    // The catalogue alone: what no read has answered yet, the list too, is drawn as not known, so no card says + or ✓ and nothing is said to have failed.
    if (early !== undefined) {
      const catalogue = await catalogueRead.catch(() => undefined);
      if (catalogue !== undefined) {
        const held: Held = { catalogue: drawnCatalogue(catalogue, this.#features, [], [], undefined, [], undefined), packages: [], onImage: [], sources: [], models: [], newest: {}, ...(isMember(this.ports.me()) ? { member: true as const } : {}) };
        early({ held, unread: true, why: "listing", retry: false, listed: false, list: NO_PACKAGES, provided: false });
      }
    }
    const [catalogue, sources, models, served, accounts, , series, chat, account, bundles, ruleSeen] = await reads;
    this.#ruleSeen = ruleSeen;
    const vendorsOf = (providers: readonly Provider[] | undefined): Held["models"] => this.#features.modelPlugins ? models : servedVendors(catalogue, served, providers, accounts);
    if (providedLater !== undefined) {
      void providing.then((providers) => providedLater((held) => ({ ...held, models: vendorsOf(providers), ...(providers === undefined ? {} : { providers }) })));
    }
    const drawn = async (list: PackageList, why: ListWhy | undefined): Promise<HeldRead> => {
      const packages = asAsked(list.packages, list.waiting ?? []);
      return drawnAt(list, why, await this.#newest(catalogue, packages));
    };
    // Every read in, npm's newest versions not yet: no update is offered until npm answers.
    const drawnAt = (list: PackageList, why: ListWhy | undefined, newest: Readonly<Record<string, string>>): HeldRead => {
      // A removal or a switch cx's computer has not done yet is drawn done, as the seller asked: it does it when it wakes.
      const packages = asAsked(list.packages, list.waiting ?? []);
      const providers = provided?.providers;
      const held: Held = { catalogue: drawnCatalogue(catalogue, this.#features, packages, sources, served, list.onImage, accounts), packages, onImage: list.onImage, sources, models: vendorsOf(providers), newest, ...(served === undefined ? {} : { served }), ...(accounts === undefined ? {} : { accounts }), ...(providers === undefined ? {} : { providers }), ...(series === undefined ? {} : { series }), ...(chat === undefined ? {} : { chat }), ...(account === undefined ? {} : account), ...(bundles === undefined ? {} : { pressed: bundles.held }), ...(list.ends === undefined ? {} : { failedInstalls: failedInstalls(list.ends) }), ...(isMember(this.ports.me()) ? { member: true as const } : {}) };
      // A computer that is off or not set up yet is no failure: the list is said to wait for it, and a read that failed beside it is offered again.
      return { held, unread: unread || why !== undefined, why: why ?? (unread ? "failed" : undefined), retry: unread || why === "failed", listed: why === undefined, list, provided: provided !== undefined };
    };
    if (early !== undefined) early(listed === undefined ? drawnAt(NO_PACKAGES, "listing", {}) : drawnAt(listed.list, listed.why, {}));
    const answer = await listing;
    if (newestLater === undefined) return drawn(answer.list, answer.why);
    // npm's newest versions draw only the updates offered: the world is answered with the list, and they come in on their own.
    this.#newestRead = this.#newest(catalogue, asAsked(answer.list.packages, answer.list.waiting ?? [])).then(newestLater, () => undefined);
    return drawnAt(answer.list, answer.why, {});
  }

  /**
   * npm's newest version of each installed package pi fetched from npm by name: ours as the catalogue read them, someone else's by a read
   * of its own. A read npm did not answer offers no update for that package.
   */
  async #newest(catalogue: Held["catalogue"], packages: Held["packages"]): Promise<Readonly<Record<string, string>>> {
    const ours = oursNewest(catalogue);
    // One of ours the catalogue holds no version of is not asked of npm as someone else's: its version comes with ours, read again.
    const theirs = [...new Set(packages.filter((one) => one.source === `npm:${one.name}` && ours[one.name] === undefined && !isOurs(one.name)).map((one) => one.name))];
    const read = await Promise.all(theirs.map((name) => Promise.resolve().then(() => this.ports.backend.npmPackage(name)).then((one) => { this.#theirUses.set(name, one.uses); return [[name, one.version] as const]; }, () => [])));
    return { ...Object.fromEntries(read.flat()), ...ours };
  }

  /** What Update reads and does on this page. */
  #updates(): UpdateContext {
    const rows = this.#rows();
    return { held: this.#held, say: this.ports.say, language: this.ports.language(), list: (names) => this.#list(names), doing: this.#doing, update: (plugins, at) => { void this.#update(plugins, at); }, inQueue: (plugin) => this.#updateHeld(plugin, rows) };
  }

  /**
   * Updates plugins from the control at `at`, which holds the keyboard through the press: each is its own click, written down before any
   * is answered, and each goes to the queue as its own row; the toast says so once. One the platform refused stands on its record.
   */
  /** Answers whether the platform admitted any of the updates. */
  async #update(plugins: readonly Plugin[], at: string): Promise<boolean> {
    const added = await sendUpdates(this.ports.backend, linkedBy(this.#held, this.#theirUses), this.#doing, plugins);
    await this.load();
    void this.ports.changed();
    if (added) this.#tell(this.#say("pl.q.added"));
    // A line gone with what it asked for gives the keyboard to the row it stood under, or on a page to the header; Update all gives it to the first row.
    if (document.activeElement === document.body || document.activeElement === null) (placed(this.element, at) ?? this.#rowOf(plugins[0]!) ?? placed(this.element, HEADING))?.focus({ preventScroll: true });
    return added;
  }

  /** The reminder that plugins have a new version, for the sidebar: from the world the page read last, or before it opened, from a glance. */
  /**
   * cx's answer or the computer's start ended: what the queue says waits for it can have moved, so while it holds a row the list is read
   * again, and the bound on reading it again runs from here.
   */
  settled(): void {
    if (!this.#loaded || this.#rows().length === 0) return;
    this.#queuedSince = Date.now();
    void this.load();
  }

  newDot(): readonly Child[] {
    if (isMember(this.ports.me())) return [];
    const rows = this.#rows();
    return newDot(this.ports.say, this.ports.language(), this.#loaded && !this.#early ? this.#held : this.#glanced ?? (this.#loaded ? this.#held : EMPTY), this.#doing, (plugin) => this.#updateHeld(plugin, rows));
  }

  /**
   * What the sidebar's reminder needs before the page opens: ours from the catalogue, the list, and npm's newest for the rest. A list
   * read while cx's computer sleeps is the platform's kept one, so the glance wakes nothing.
   */
  async glance(): Promise<void> {
    if (this.#loaded || this.ports.me()?.kind !== "signed_in") return;
    const backend = this.ports.backend;
    const [catalogue, list] = await Promise.all([backend.catalogue(), this.#clicks.join()]);
    // An install or an update waiting or running is read as the page reads it, again on its own time until it ends, so the line beside
    // cx names it wherever the seller is.
    if ((list.waiting ?? []).some((click) => queued(click.op))) void this.load();
    const packages = asAsked(list.packages, list.waiting ?? []);
    // An update already asked for is nothing left to press: its package is not counted.
    const asked = new Set((list.waiting ?? []).filter((click) => click.op === "update").map((click) => click.source));
    const newest = Object.entries(await this.#newest(catalogue, packages)).filter(([name]) => !asked.has(`npm:${name}`));
    this.#glanced = { ...EMPTY, catalogue: drawnCatalogue(catalogue, this.#features, packages, [], undefined, list.onImage, undefined), packages, onImage: list.onImage, newest: Object.fromEntries(newest) };
  }

  /**
   * The catalogue with npm's line and author on each package of someone else's that one of ours names only by its npm name, so its row
   * says what it is wherever it is listed. A read that fails leaves the record as named, and is asked again at the next read.
   */
  async #withNpmWords(catalogue: Catalogue): Promise<Catalogue> {
    const bare = catalogue.plugins.filter((plugin) => plugin.npm !== undefined && plugin.id === `~${plugin.npm}` && plugin.author === "" && plugin.about.en === "" && plugin.about.zh === "");
    if (bare.length === 0) return catalogue;
    const read = await Promise.all(bare.map((plugin) => {
      const name = plugin.npm!;
      return this.#npmRead(name);
    }));
    const words = new Map(bare.map((plugin, n) => [plugin.id, read[n]]));
    return { ...catalogue, plugins: catalogue.plugins.map((plugin) => {
      const npm = words.get(plugin.id);
      return npm === undefined ? plugin : withGallery(plugin, galleryPlugin(npm));
    }) };
  }

  /** npm's answer for a name, asked once; a read that fails is forgotten, and asked again at the next read. */
  #npmRead(name: string): Promise<NpmPackage | undefined> {
    if (!this.#npmWords.has(name)) {
      this.#npmWords.set(name, Promise.resolve().then(() => this.ports.backend.npmPackage(name)).then((read) => { this.#npmSaid.set(name, read); this.#npmFailed.delete(name); return read; }, (error: unknown) => {
        this.#npmWords.delete(name);
        // A name npm does not have is npm's answer; any other failure leaves the package unread.
        if (error instanceof Error && error.message === "unknown_package") this.#npmSaid.set(name, "unknown");
        else this.#npmFailed.add(name);
        return undefined;
      }));
    }
    return this.#npmWords.get(name)!;
  }

  /**
   * An installed package from npm whose list entry names no author, as the box's list states none, made by whoever npm says published
   * it, as its install card named them: npm's words fill what the record leaves unsaid, and the page is drawn again once npm answers.
   */
  #withAuthor(plugin: Plugin): Plugin {
    if (plugin.own !== true || plugin.npm === undefined || plugin.author !== "") return plugin;
    const said = this.#npmSaid.get(plugin.npm);
    const name = plugin.npm;
    if (said === "unknown" || (said === undefined && this.#npmFailed.has(name))) return plugin;
    // Answered, with an author or with none, the row is drawn again: until then it says nothing of who made it.
    if (said === undefined) { void this.#npmRead(name).then(() => { if (this.#npmSaid.has(name)) this.draw(); }); return plugin; }
    return withGallery(plugin, galleryPlugin(said));
  }

  /**
   * What the page says beside each plugin's name, from the world read afresh: the settings window's spending lines follow their kind
   * with it. A failed read says nothing.
   */
  async states(): Promise<(kind: "source" | "vendor", id: string) => string | undefined> {
    // The lines name no account's form, so the account is not read for them.
    const { held } = await this.#readHeld(false).catch(() => ({ held: undefined }));
    if (held === undefined) return () => undefined;
    return (kind, id) => { const plugin = recordIn(held.catalogue, kind, id); return plugin === undefined ? undefined : stateOf(held, plugin, (key) => this.#say(key)); };
  }

  /** cx's computer was heard: a list its not being set up yet kept unread is read now. */
  heard(): void {
    if (this.#why === "pending") void this.load();
  }

  async load(): Promise<void> {
    const me = this.ports.me();
    if (me === undefined) return;
    this.#asked = true;
    this.#npmFailed.clear();
    // What the packages made for ComChatX declare places them on Discover, on Yours and on their own pages alike.
    if (this.#made === undefined) void this.#readMade();
    else if (this.#made.state === "ready" && this.#made.unread.length > 0) void this.#readDeclared(this.#made);
    const first = !this.#loaded;
    if (first) this.draw();
    const at = ++this.#loads;
    // A first visit draws Discover and Yours as soon as `backend.catalogue()` answers, waiting on no other read; again once every read but the installed list is in, npm's words for a bare dependency among them, with the list if it has answered; then with the list, which a record's page waits for; and again as npm's newest versions and our packages at their versions answer.
    const early = !first ? undefined : (read: HeldRead): void => {
      if (at <= this.#drawn) return;
      this.#held = read.held;
      [this.#unread, this.#why, this.#retry] = [read.unread, read.why, read.retry];
      this.#money = me.money;
      this.#loaded = true;
      this.#early = true;
      this.draw();
    };
    // What npm says the installed packages' newest versions are, and our own packages at the versions their heads show, draw only the
    // updates offered and a record's words: the page is drawn whole with the list, and each draws again when it answers.
    let newest: Readonly<Record<string, string>> | undefined, whole = false;
    const later = (): void => { if (at !== this.#drawn) return; this.draw(); this.ports.glanced?.(); };
    let provide: ((held: Held) => Held) | undefined;
    const { held, unread, why, retry, listed, list, provided } = await this.#readHeld(true, early, (answer) => {
      newest = answer;
      if (!whole || at !== this.#drawn) return;
      // Read again as before, npm's word changes nothing drawn: the page is not drawn again under the seller.
      const before = this.#held.newest ?? {};
      if (Object.keys(answer).length === Object.keys(before).length && Object.entries(answer).every(([name, version]) => before[name] === version)) return;
      this.#held = { ...this.#held, newest: answer };
      later();
    }, (fill) => {
      provide = fill;
      if (!whole || at !== this.#drawn) return;
      this.#held = fill(this.#held);
      this.#providing = false;
      later();
    });
    if (at < this.#drawn) return;
    this.#drawn = at;
    const answered = this.#answered;
    // Until npm answers this load, its last word on the newest versions stands: a page drawn again keeps the updates it offered.
    const last = newest ?? (this.#loaded && !this.#early ? this.#held.newest : held.newest);
    const read: Held = last === undefined ? held : { ...held, newest: last };
    const kept = answered !== undefined && answered.at > (this.#heardAt.get(list) ?? 0) ? { ...read, packages: asAsked(read.packages, answered.waiting) } : read;
    this.#held = provide === undefined ? kept : provide(kept);
    this.#providing = !provided && provide === undefined;
    whole = true;
    this.#readingAgain = false;
    this.#unread = unread;
    this.#why = why;
    this.#retry = retry;
    this.#money = me.money;
    this.#loaded = true;
    this.#early = false;
    clearTimeout(this.#pendingTimer);
    if (why === "pending") this.#pendingTimer = setTimeout(() => { if (this.#why === "pending" && this.element.isConnected !== false) void this.load(); }, PENDING_AGAIN_MS);
    // A list that carries no word of clicks, and a read that failed, clear nothing and draw nothing of any click.
    let late: readonly About[] = [];
    if (listed && list.waiting !== undefined && list.ends !== undefined) {
      const of = (source: string): Plugin | undefined => this.#held.catalogue.plugins.find((plugin) => sourceFor(this.#held, plugin) === source)
        ?? (npmNameOf(source) === undefined ? undefined : this.#galleryPlugin(npmNameOf(source)!));
      late = this.#doing.heard(
        list.waiting.flatMap((one) => { const item = of(one.source); return item === undefined ? [] : [{ item, act: one.op }]; }),
        sharedEnds(list.ends, this.#held.member === true).flatMap((one) => { const key = `${one.source}\u0000${one.at}`; const item = of(one.source);
          return item === undefined || this.#clicks.said.has(key) ? [] : [{ item, act: one.op, ok: one.ok, reason: one.reason, ...(one.detail === undefined ? {} : { detail: one.detail }), key, at: one.at }]; }));
    }
    if (listed) this.#doing.listed(this.#held);
    if (listed && list.waiting !== undefined) this.#worded = list;
    // An entry that left the queue landed or failed, which changes what the rest of the app reads: the sidebar's counts, the sources bar.
    // An update that left the queue ended well where the list keeps an end of it that did: a click on a source takes its old end away.
    const rows = this.#rows().filter((row) => row.id !== undefined);
    const now = rows.map((row) => row.id!);
    const left = listed ? this.#queued.filter((row) => !now.includes(row.id!)) : [];
    if (left.length > 0) void this.ports.changed(left.flatMap((row) => (row.act === "update" && list.ends?.some((end) => end.op === "update" && end.ok && end.source === row.source) ? npmNameOf(row.source) ?? [] : [])), list.packages.length);
    if (listed && now.join(" ") !== this.#queued.map((row) => row.id).join(" ")) { this.#queued = rows; this.#queuedSince = Date.now(); }
    // cx's computer runs what the queue holds one by one and says each only to a read: on, with something in the queue that has not
    // failed, the list is read again as often as a click of the page's is, until it no longer says so, or until the queue has stood
    // unchanged as long as a click is waited for, when the next opening reads it. Off or starting, nothing runs until it is on, and the
    // start's end reads the list, whether or not anyone looks at the page.
    clearTimeout(this.#queueTimer);
    const runs = this.#power() !== "off" && this.#rows().some((row) => row.stands !== "failed");
    if (listed && runs && Date.now() - this.#queuedSince < WAIT_BOUND_MS) this.#queueTimer = setTimeout(() => { void this.load(); }, REREAD_MS);
    if (listed) this.ports.listRead?.();
    this.draw();
    // A switch the list took whose end then failed, heard in this read, is told once, as a failure told at once is; a line in view that
    // says it already is the telling.
    for (const about of late) this.#tellAway(this.#say(`pl.fail.${about.act}` as StringKey, { name: this.#name(about.item) }), about, true);
    this.#arrive();
    // The world read again after a press opens nothing: only the page's first drawing answers the address it was opened at.
    if (first || this.#seekLater) this.#seek();
    // A load is answered once what came in after the drawing has drawn too.
    await this.#newestRead;
  }

  /**
   * The card the address names is opened once the page under it is drawn whole, its record's own reads answered; until then the
   * address keeps it.
   */
  #seek(): void {
    if (this.#waiting(this.#route) || this.element.isConnected === false) return;
    // A card the address names waits for the installed list, as + and ✓ do: while it is unread or failed, the address keeps the card,
    // and the load that reads it opens it.
    if (this.#unread) { this.#seekLater = cardOf(globalThis.location?.hash ?? "") !== undefined; return; }
    this.#seekLater = false;
    // Shown at another address than the browser's, the page is about to be shown at this one.
    const named = route(globalThis.location?.hash ?? "") ?? HOME;
    if (JSON.stringify(named) !== JSON.stringify(this.#route)) return;
    if (this.#page !== undefined && !this.#page.page.drawn) return;
    seekCard(this.element);
  }

  get held(): Held { return this.#held; }
  /** No read has gone out yet: the page was drawn before the account was known. */
  get unasked(): boolean { return !this.#asked; }

  /** Leaving the Plugins page leaves its search: a seller back from the chat finds every shelf again. */
  /** The band the page gives up at its top or its foot while cx's bubble stands there (guide-band.ts); null for none. */
  giveWay(band: Band | null): void {
    const host = this.element.parentElement;
    if (host === null) return;
    host.style.marginTop = band?.side === "top" ? `${band.px}px` : "";
    host.style.marginBottom = band?.side === "foot" ? `${band.px}px` : "";
  }

  leave(): void { this.giveWay(null); this.#away = true; this.#page?.page.leave(); this.#sought = ""; this.#named = undefined; this.#removed = undefined; this.#doing.leave(); this.#unland(); this.#lands = true; this.#shutCreate(); this.#listAt = undefined; }

  show(route: Route): void {
    // A member chooses no models: the organization's admin does, so the models page's address opens 我的, where they stand.
    if (route.kind === "chat" && isMember(this.ports.me())) {
      globalThis.history?.replaceState(null, "", href.home("yours", "all"));
      this.show({ kind: "home", view: "yours", filter: "all" });
      return;
    }
    const moved = JSON.stringify(route) !== JSON.stringify(this.#route);
    const sought = this.#sought;
    if (route.kind === "home") { this.#trail = []; this.#list0 = route; }
    else {
      const at = this.#trail.findIndex((one) => one.kind === route.kind && (!("id" in one) || !("id" in route) || one.id === route.id));
      this.#trail = at === -1 ? [...this.#trail, route] : [...this.#trail.slice(0, at), route];
    }
    if (moved && (route.kind !== "home" || this.#route.kind !== "home")) this.#sought = "";
    // An address can name what the lists are searched for; typing in the box writes no address.
    const named = route.kind === "home" ? soughtOf(globalThis.location?.hash ?? "") : undefined;
    if (named !== undefined && named !== this.#named) { this.#sought = named; this.#named = named; }
    // A fact that asks nothing was said on the page now left, as a toast would have been: only a line with its try stays.
    const from = this.#route;
    if (moved && from.kind === "home" && route.kind !== "home") this.#listAt = { key: JSON.stringify(from), top: this.element.parentElement?.scrollTop ?? 0, left: "", sought };
    if (moved && from.kind !== "home" && route.kind === "home" && this.#listAt !== undefined) this.#listAt = { ...this.#listAt, left: this.#addressOf(from) };
    // A removal lands on the list by its own rule, which places the keyboard once the list read after it answers.
    const returned = moved && route.kind === "home" && from.kind !== "home" && this.#removed === undefined && this.#listAt?.key === JSON.stringify(route) ? this.#listAt : undefined;
    // Back on the list a record was opened from, its search is as it was left, and so are its results.
    if (returned !== undefined && named === undefined) this.#sought = returned.sought;
    // Another kind or order on the bar is the same page: it does not go back to the top, though its lists start under the bar again.
    const resorted = moved && route.kind === "home" && from.kind === "home" && JSON.stringify({ ...route, third: undefined }) === JSON.stringify({ ...from, third: undefined });
    const left = moved && (route.kind !== from.kind || (route.kind === "home" && from.kind === "home" ? route.view !== from.view : "id" in route && "id" in from && route.id !== from.id));
    if (left) for (const one of this.#linesOf()) if (one.classList.contains("pl-fact")) this.#doing.forget(one.dataset["for"]!);
    this.#route = route;
    // Discover and Yours are two pages; a record's tabs are one page's, and a tab pressed keeps the keyboard.
    const tabbed = moved && !left && (route.kind === "plugin" || route.kind === "bundle") && from.kind === route.kind && route.tab !== from.tab;
    // Each address of the chat's models page is the same page for what is open but a new arrival for the keyboard, as one of another page is.
    const rechat = moved && route.kind === "chat" && from.kind === "chat";
    this.#toFocus = returned !== undefined ? undefined : this.#away || left || rechat ? "title" : tabbed ? "tab" : moved ? undefined : this.#toFocus;
    this.#away = false;
    if (moved) this.#shutCreate();
    if (route.kind === "home" && route.land !== undefined) { if (moved || this.#lands) this.#landed = { shelf: route.land, seen: false }; }
    else this.#unland();
    this.#chatLand = route.kind === "chat" && route.land !== undefined && (moved || this.#lands) ? route.land : moved ? undefined : this.#chatLand;
    this.#lands = false;
    if (route.kind !== "home") this.#removed = undefined;
    this.draw();
    if (returned !== undefined) this.#comeBack(returned);
    else if (moved && !resorted) this.element.parentElement?.scrollTo({ top: 0 });
    else if (resorted) this.#toLists();
    this.#title();
    this.#arrive();
    this.#keyboardLands();
    this.#seek();
  }

  /** Once the bar changes what the page lists, the lists start right under it again, where the page had scrolled past their start. */
  #toLists(): void {
    const scroller = this.element.parentElement;
    const bar = this.element.querySelector<HTMLElement>(".pl-npm-bar");
    const first = bar?.nextElementSibling;
    if (scroller === null || bar === null || first === null || first === undefined) return;
    const top = first.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - bar.offsetHeight - (Number.parseFloat(getComputedStyle(bar).marginBottom) || 0);
    if (scroller.scrollTop > top) scroller.scrollTop = Math.max(0, top);
  }

  /** Back on the list a record was opened from: where it stood, with the keyboard on the record's card or row, or on the title. */
  #comeBack(at: { readonly top: number; readonly left: string }): void {
    this.element.parentElement?.scrollTo({ top: at.top });
    const link = [...this.element.querySelectorAll<HTMLElement>("a.pl-card-name, a.pl-row")].find((one) => one.getAttribute("href") === at.left);
    (link ?? this.element.querySelector<HTMLElement>("h1"))?.focus({ preventScroll: true });
  }
  /** The address of a record's page as a route names it. */
  #addressOf(route: Route): string {
    if (route.kind !== "plugin" && route.kind !== "bundle") return "";
    return route.npm !== undefined ? `#/plugins/n/${encodeURIComponent(route.npm)}` : `#/plugins/${route.kind === "plugin" ? "p" : "b"}/${encodeURIComponent(route.id)}`;
  }

  /**
   * A page arrived at takes the keyboard to its title, and a record's tab pressed to that tab, once drawn: a record's waits for its read.
   * A shelf or a vendor's row an address landed on, and the card a removal lands on, keep it instead.
   */
  #title(): void {
    const to = this.#toFocus;
    if (to === undefined) return;
    if (((this.#route.kind === "home" || this.#route.kind === "chat") && this.#route.land !== undefined) || this.#removed !== undefined) { this.#toFocus = undefined; return; }
    const target = this.element.querySelector?.<HTMLElement>(to === "title" ? "h1" : `.pl-tab[aria-selected="true"]`);
    if (target === null || target === undefined) return;
    this.#toFocus = undefined;
    if (to === "title" && target.getAttribute?.("tabindex") === null) target.setAttribute("tabindex", "-1");
    // The title keeps the focus for a screen reader either way; the ring is the keyboard's.
    if (to === "title" && !this.#keyed) { target.setAttribute?.("data-pointed", ""); target.addEventListener?.("blur", () => target.removeAttribute("data-pointed"), { once: true }); }
    target.focus?.({ preventScroll: true });
  }

  /** Brings the shelf an address landed on into view, once it is drawn; its mark fades and is then taken away. */
  #arrive(): void {
    // A card's ring that stands still goes to the queue, the keyboard on its plugin's row.
    const sought = this.#toQueue;
    if (sought !== undefined && this.#route.kind === "home" && this.#route.view === "yours") {
      const row = placed(this.element, `queue ${sought.act} ${sought.source}`);
      if (row !== undefined) { this.#toQueue = undefined; row.focus({ preventScroll: true }); row.scrollIntoView?.({ block: "nearest" }); }
    }
    const landed = this.#landed;
    if (landed === undefined || landed.seen || !this.#loaded) return;
    landed.seen = true;
    landed.since = Date.now();
    this.element.querySelector?.<HTMLElement>(`section#${landed.shelf}`)?.scrollIntoView?.({ block: "start" });
    this.#landedTimer = setTimeout(() => { this.#unland(); this.element.querySelector?.<HTMLElement>(".pl-landed")?.classList.remove("pl-landed"); }, LANDED_MS);
  }
  #unland(): void { clearTimeout(this.#landedTimer); this.#landed = undefined; }
  /** The queue's row a card's still ring was pressed for, until Yours draws it. */
  #toQueue: QueueRow | undefined;
  /**
   * After a removal the keyboard goes where the page went, never to its top: to the removed record's card where the list draws one,
   * as Discover does, else to the list's heading.
   */
  #keyboardLands(): void {
    const removed = this.#removed;
    if (removed === undefined || !removed.read || this.#route.kind !== "home") return;
    this.#removed = undefined;
    ([...this.element.querySelectorAll<HTMLElement>("a.pl-card-name, a.pl-row")].find((link) => link.getAttribute("href") === removed.at) ?? placed(this.element, HEADING))?.focus({ preventScroll: true });
  }
  /** The landed shelf's list: drawn again while its mark fades, it goes on fading from where it was, not from the start. */
  #fading(list: HTMLElement, shelf: YoursShelf): HTMLElement {
    const since = shelf === this.#landed?.shelf ? this.#landed.since : undefined;
    if (since !== undefined && list.style !== undefined) list.style.animationDelay = `-${Math.max(0, Date.now() - since)}ms`;
    return list;
  }

  #say(key: StringKey, values: Readonly<Record<string, string | number>> = {}): string { return this.ports.say(key, values); }
  #words(words: Readonly<Record<Language, string>>): string { return words[this.ports.language()]; }
  /** A list of names; in Chinese 和 keeps a space beside a name in Latin letters, and a Chinese name sits against it, as round 28's `say()` has it. */
  #list(names: readonly string[]): string {
    if (this.ports.language() !== "zh") return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(names);
    return (names.length < 2 ? names.join("") : `${names.slice(0, -1).join("、")} 和 ${names.at(-1)!}`).replace(/(\p{Script=Han}) (?=\p{Script=Han})/gu, "$1");
  }
  /** Money as the page draws it: two places, under a cent written as less than a cent, in the form that opens a line or, mid-sentence, the lowercase one. */
  #amount(units: number, mid = false): string { return this.#money === undefined ? "" : formatTotal(units, this.#money, MONEY_AS, (amount, owed) => this.#say(owed ? (mid ? "pl.lessThanOwedMid" : "pl.lessThanOwed") : mid ? "pl.lessThanMid" : "pl.lessThan", { amount })); }

  /**
   * Whether a read the route's page draws from is out: the world's, then, for a model's record and the chat's models page, the
   * providers. A record's page stands as its shape meanwhile, and no card the address names is sought on it; a list draws from what has
   * answered.
   */
  #waiting(route: Route): boolean {
    if (!this.#loaded || this.#early) return true;
    return this.#providing && (route.kind === "chat" || (route.kind === "plugin" && this.#plugin(route.id, route.npm)?.model !== undefined));
  }

  draw(): void {
    // Who opens a float closes it: a tip on a row and an open ⋮ are closed by the set's own close before their row is drawn again; a ⋮
    // that was open is opened again on its new row, where the list still holds it, as the record's own ⋮ stays open across a redraw.
    hideTipWithin(this.element);
    const opened = [...this.#menus].find(([slot]) => placed(this.element, slot)?.getAttribute("aria-expanded") === "true")?.[0];
    if (opened !== undefined) this.#menus.get(opened)!.close(true);
    this.#menus.clear();
    this.#drawPage();
    if (opened !== undefined) this.#menus.get(opened)?.open();
  }

  #drawPage(): void {
    const route = this.#route;
    // What needs no read stands while the reads are out, where the record's page will have it: the way back, over the record's shape.
    if (route.kind !== "home" && this.#waiting(route)) { const back = this.#back(); fill(this.element, h("div", { class: "pl-item" }, h("p", { class: "back" }, h("a", { href: back.href }, this.#say("pl.pg.back", { name: back.name }))), recordShape(this.#say("stream.loading")))); return; }
    const keep = this.#focused();
    // An address with nothing at it is no list to go back to.
    if (route.kind === "home" && this.#loaded && !this.#unread && this.#bare(route)) { this.#drop(undefined); this.#list0 = undefined; fill(this.element, ...this.#unknown(), this.#toast); keep?.(); return; }
    // The record page is kept for the way back, but a sign-in lives on its Settings alone: a list ends it.
    if (route.kind === "home") { this.#page?.page.leave(); this.#home(route); this.element.append(this.#toast); holdRows(this.element); this.#barClear(); this.#stick(); keep?.(); return; }
    // A landing puts the keyboard where it lands, over wherever it was.
    if (route.kind === "chat") { if (!this.#chat(route)) keep?.(); return; }
    const held = this.#held;
    const item = route.kind === "plugin" ? this.#plugin(route.id, route.npm) : held.catalogue.bundles.find((one) => one.id === route.id);
    // A plugin cx's computer said it no longer has keeps its address for the one line that says so, though no list names it now.
    const gone = item === undefined && route.kind === "plugin" ? this.#doing.gone(`#/plugins/p/${encodeURIComponent(route.id)}`) : undefined;
    if (gone !== undefined) {
      this.#drop(undefined);
      const back = h("a", { href: "#/plugins" }, `← ${this.#say("nav.plugins")}`);
      fill(this.element, h("p", { class: "back" }, back), factLine({ held, say: this.ports.say, language: this.ports.language() }, gone, new Set(["not_listed"])), this.#toast);
      keep?.();
      // The switch that was pressed is drawn no longer: the keyboard it had goes to the way back.
      const active = globalThis.document?.activeElement;
      if (active === null || active === globalThis.document?.body || active?.isConnected === false) back.focus?.();
      return;
    }
    // One of ours not read whole has no record to draw yet: its address says ours could not be read, and reads them again.
    if (item === undefined && route.kind === "plugin" && route.npm !== undefined && isOurs(route.npm) && held.catalogue.oursRead !== undefined) {
      this.#drop(undefined); fill(this.element, this.#unknown()[0]!, this.#oursUnread(true), this.#toast); keep?.(); return;
    }
    // Under a failed read a record the catalogue names keeps its page, which says the read failed; only an unknown address is nothing.
    if (item === undefined || (!isBundle(item) && !this.#unread && !shown(held, item))) { this.#drop(undefined); fill(this.element, ...this.#unknown(), this.#toast); keep?.(); return; }
    const context = this.#context(item);
    // One record page a route: a redraw the seller did not ask for keeps it whole, typed words, an open menu and focus included, and
    // its reads fire once, when the route is opened; a changed world draws it again from what it already read.
    const key = JSON.stringify(route);
    const tab = (route.tab ?? "overview") as Tab;
    const kept = this.#page?.key === key ? this.#page : undefined;
    const page = kept?.page ?? new ItemPage(context);
    page.context = context;
    this.#drop({ key, page, held: held, unread: this.#unread, language: context.language, back: context.back.href });
    if (this.element.firstChild !== page.element) fill(this.element, page.element, this.#toast);
    if (kept === undefined) {
      if (isBundle(item)) page.drawBundle(item, tab);
      else void page.plugin(item, tab).then(() => { this.#seek(); this.#title(); }, () => undefined);
    } else if (kept.held !== held || kept.unread !== this.#unread || kept.language !== context.language || kept.back !== context.back.href) {
      if (isBundle(item)) page.drawBundle(item, tab);
      else page.drawPlugin(item, tab);
    }
    keep?.();
  }

  /** The scroller keeps the third-party bar's height clear at its top, which grows where the kinds wrap, so a card the keyboard reaches stops under it. */
  #barClear(): void {
    const bar = this.element.querySelector?.<HTMLElement>(".pl-npm-bar");
    const scroller = this.element.parentElement?.style;
    if (scroller !== undefined) scroller.scrollPaddingTop = bar === null || bar === undefined ? "" : `calc(${bar.offsetHeight}px + var(--space-3))`;
  }
  /**
   * The bar is marked (`pl-clear`) while it shares the window's top with the board button, which floats over its corner: from the
   * scroll that brings it into the button's band, before it sticks, it ends clear of the button; at rest it ends with Create and the cards.
   */
  #stick(): void {
    const scroller = this.element.parentElement;
    if (scroller === null) return;
    if (scroller !== this.#stuckOn) { scroller.addEventListener("scroll", () => this.#stick(), { passive: true }); this.#stuckOn = scroller; }
    const bar = this.element.querySelector?.<HTMLElement>(".pl-npm-bar");
    bar?.classList.toggle("pl-clear", clearsBoard(scroller, bar));
  }
  /**
   * A plugin by its record's id, or a package npm lists by its name, whether or not it is installed. An npm address is npm's name alone:
   * a package installed from a path that states the same name is another package, with its own record.
   */
  #plugin(id: string, npm?: string): Plugin | undefined {
    if (npm === undefined) return this.#held.catalogue.plugins.find((one) => one.id === id);
    if (!isOurs(npm)) return this.#galleryPlugin(npm);
    // One of ours at its npm address is its record's page, as its own address draws it, and never npm's page of a stranger's package;
    // with ours read whole, one the catalogue holds no record of is npm's page of it, ComChatX's by its name (`madeByUs`); with ours
    // not read whole, its address says so (`#show`).
    const record = this.#held.catalogue.plugins.find((one) => one.own !== true && (one.onNpm?.name === npm || one.box?.package === npm));
    return record ?? (this.#held.catalogue.oursRead === undefined ? this.#galleryPlugin(npm) : undefined);
  }
  /**
   * A package npm lists as the page installs it, built one way whether or not it is installed: as the list or its name says, with what
   * one made for ComChatX declares, and installed, the record of it the page holds, with those facts.
   */
  #galleryPlugin(name: string, listed?: NpmListed): Plugin {
    const made = this.#made?.packages.find((one) => one.name === name);
    const known = listed ?? made ?? this.#third?.packages.find((one) => one.name === name);
    const built = galleryPlugin(known ?? { name }, made === undefined ? undefined : this.#made!.declared.get(name) ?? {});
    const held = this.#held.catalogue.plugins.find((one) => one.npm === name && href.item(one) === `#/plugins/n/${encodeURIComponent(name)}`);
    return held === undefined ? built : withGallery(this.#withAuthor(held), built);
  }

  /**
   * The world as Yours draws it: each installed package made for ComChatX by someone else as its gallery record says, on the shelf its
   * field declares, and each installed package from npm made by whoever npm says published it.
   */
  #withMade(held: Held): Held {
    const made = this.#made;
    const plugins = held.catalogue.plugins.map((one) => {
      const plugin = this.#withAuthor(one);
      const listed = plugin.npm === undefined ? undefined : made?.packages.find((other) => other.name === plugin.npm);
      return listed === undefined ? plugin : withGallery(plugin, galleryPlugin(listed, made!.declared.get(listed.name) ?? {}));
    });
    return { ...held, catalogue: { ...held.catalogue, plugins } };
  }

  /** The chat's models page: one page a visit, kept across redraws as a record's is; each arrival at an address naming a vendor lands on its row. */
  #chat(route: ChatRoute): boolean {
    const context = this.#context(undefined);
    const key = JSON.stringify(route);
    const kept = this.#page?.key === key ? this.#page : undefined;
    const page = kept?.page ?? new ItemPage(context);
    page.context = context;
    this.#drop({ key, page, held: this.#held, unread: this.#unread, language: context.language, back: context.back.href });
    if (this.element.firstChild !== page.element) fill(this.element, page.element, this.#toast);
    const land = this.#chatLand;
    this.#chatLand = undefined;
    if (land !== undefined) page.land(land);
    else if (kept === undefined) page.drawChat();
    else if (kept.held !== this.#held || kept.unread !== this.#unread || kept.language !== context.language) page.again();
    return land !== undefined;
  }

  /** What a record's page, and the chat's models page, read and act through. */
  #context(item: Item | undefined): ItemContext {
    const held = this.#held;
    return {
      held, queued: (one: Item) => this.#inQueue(one), failedRow: (plugin: Plugin) => this.#failedRow(plugin), inQueue: (plugin: Plugin) => this.#updateHeld(plugin), kept: this.#kept, unread: this.#unread, ...(this.#unread ? { unreadSaid: { key: this.#unreadSaid(), retry: this.#retry } } : {}), backend: this.ports.backend, cards: this.ports.cards, language: this.ports.language(), money: this.#money, ...this.#rule, say: this.ports.say, ask: this.ports.ask,
      reload: async () => { const removed = this.#removed; await this.load(); if (removed !== undefined && removed === this.#removed) { removed.read = true; this.#keyboardLands(); } void this.ports.changed(); }, row: (plugin: Plugin) => this.#row(plugin, plugin.section), tile: (item, big) => tile(item, big, this.ports.language()), back: this.#back(),
      head: (plugin: Plugin) => this.#head(plugin, `card ${href.item(plugin)}`), land: (words: string) => { if (words !== "") this.#tell(words); this.#removed = { at: item === undefined ? href.models : href.item(item), read: false }; const from = this.#list0; location.hash = from?.kind === "home" ? href.home(from.view, from.filter, from.shelf) : "#/plugins"; }, tell: (words: string, about?: About, failed = false) => this.#tellAway(words, about, failed),
      list: (names: readonly string[]) => this.#list(names), ...this.#balance(), doing: this.#doing, features: this.#features, help: this.ports.backend.links.help, openSeries: this.#openSeries, chatOpen: this.#chatOpen, ended: this.#ended,
      announce: this.ports.announce,
      update: (plugins: readonly Plugin[], at: string) => { void this.#update(plugins, at); },
    };
  }

  /** The record page drawn now; one no longer drawn ends what it had under way, as a sign-in lives in its vendor's Settings alone. */
  #drop(next: RecordPage | undefined): void {
    if (this.#page !== undefined && this.#page.page !== next?.page) this.#page.page.leave();
    this.#page = next;
  }

  /**
   * Where the keyboard is on the page, as a way back to it once the page is drawn again: a redraw the seller did not ask for, such as
   * the one on the tab's return, leaves the cursor where it was, in search with its selection, or on the same link or button.
   */
  #focused(): (() => void) | undefined {
    const active = globalThis.document?.activeElement;
    if (active === undefined || active === null || !(active instanceof HTMLElement) || !this.element.contains(active)) return undefined;
    // The toast is one element drawn again in place: a redraw lifts it out and the keyboard with it.
    if (active === this.#toast) return () => { if (globalThis.document.activeElement !== active) active.focus({ preventScroll: true }); };
    const find = (): HTMLElement | null | undefined => {
      if (active instanceof HTMLInputElement && active.getAttribute("data-focus") === null) return this.element.querySelector<HTMLElement>(`input.${active.className.split(" ")[0] ?? ""}`);
      // A control whose words change with what it did, such as Sign in becoming Sign out, is found by the place it holds.
      const place = active.getAttribute("data-focus");
      if (place !== null) return placed(this.element, place);
      const link = active.getAttribute("href"), label = active.getAttribute("aria-label");
      if (link !== null) return [...this.element.querySelectorAll<HTMLElement>("a")].find((one) => one.getAttribute("href") === link && one.className === active.className);
      if (label !== null) return [...this.element.querySelectorAll<HTMLElement>("button")].find((one) => one.getAttribute("aria-label") === label);
      // A button named by its words alone, such as Try again: the same class and the same words.
      if (active instanceof HTMLButtonElement) return [...this.element.querySelectorAll<HTMLElement>("button")].find((one) => one.className === active.className && one.textContent === active.textContent);
      return undefined;
    };
    // A tick or a radio has no selection to put back.
    const at = active instanceof HTMLInputElement && active.type !== "checkbox" && active.type !== "radio" ? [active.selectionStart, active.selectionEnd] as const : undefined;
    const top = active.getBoundingClientRect().top;
    return () => {
      const again = find();
      if (again === null || again === undefined || again === active) return;
      refocus(again, top);
      if (again instanceof HTMLInputElement && at !== undefined) again.setSelectionRange(at[0], at[1]);
    };
  }

  /** The card's name or the row a record is drawn as in a list. */
  #rowOf(item: Item): HTMLAnchorElement | undefined {
    return [...this.element.querySelectorAll<HTMLAnchorElement>("a.pl-card-name, a.pl-row, a.pl-row-link")].find((link) => link.getAttribute("href") === href.item(item));
  }
  /** The lines the page now draws for what a click left: on one plugin, or on any. */
  #linesOf(item?: Item): readonly HTMLElement[] {
    return Array.from(this.element.querySelectorAll?.<HTMLElement>(".pl-failed, .pl-fact") ?? []).filter((one) => (item === undefined ? one.dataset?.["for"] !== undefined : one.dataset?.["for"] === href.item(item)));
  }
  /**
   * Whether a line is whole inside the window as it now stands, and inside every box that scrolls it: one drawn out of sight has told
   * the seller nothing, and a toast says it.
   */
  #seen(line: HTMLElement): boolean {
    const at = line.getBoundingClientRect();
    if (at.top < 0 || at.bottom > (globalThis.innerHeight ?? Infinity)) return false;
    for (let box = line.parentElement; box !== null; box = box.parentElement) {
      if (!/auto|scroll|hidden|clip/.test(globalThis.getComputedStyle?.(box).overflowY ?? "")) continue;
      const within = box.getBoundingClientRect();
      if (at.top < within.top || at.bottom > within.bottom) return false;
    }
    return true;
  }
  /** A failed click's words for a toast, over the world as it now stands. */
  #failureSaid(about: About | undefined, plain: string): Told {
    return failureToast(this.ports.say, this.ports.language(), (names) => this.#list(names), this.#held, about, about === undefined ? undefined : this.#doing.failed(about.item), plain);
  }
  /** Says words in the toast for as long as they take to read; words that report a failure or name an act stay longer. */
  #tell(words: string, asks = false): void {
    // The way to try again closes a toast as one piece: no line ends inside it.
    const act = this.#say("pl.tryAgain"), at = words.length - act.length - 1;
    const [said, tail] = at > 0 && words.slice(at, -1) === act ? [words.slice(0, at), h("span", { class: "pl-toast-act" }, words.slice(at))] : [words, ""];
    // Words that take two lines break where the first sentence ends, the money's fact standing alone on the first; one sentence is evened.
    const end = /^(.+?(?:\.(?= \S)|。(?=\S)))\s*/su.exec(said)?.[1];
    const first = end === undefined ? undefined : h("span", { class: "pl-toast-first" }, end);
    fill(this.#toast, ...(first === undefined ? [said] : [first, said.slice(end!.length)]), tail);
    this.#toast.classList.add("on");
    if (first !== undefined && this.#lines() > 1) first.classList.add("pl-toast-break");
    this.#fit();
    // The keyboard can reach a toast only while it is said.
    this.#toast.tabIndex = 0;
    this.#toastStay = toastStay(words, asks);
    this.#stay();
  }
  /** Words on two lines leave their box at its widest, however short the lines: the box is drawn in to the longer one. */
  #fit(): void {
    const toast = this.#toast;
    const lines = this.#lineBoxes();
    if (lines === undefined || new Set(lines.map((one) => Math.round(one.top))).size < 2) return;
    const around = toast.getBoundingClientRect().width - toast.clientWidth + ["paddingLeft", "paddingRight"].reduce((sum, side) => sum + (parseFloat(getComputedStyle(toast)[side as "paddingLeft"]) || 0), 0);
    toast.style.width = `${Math.ceil(Math.max(...lines.map((one) => one.right)) - Math.min(...lines.map((one) => one.left)) + around) + 1}px`;
  }
  /** The boxes of the toast's words as drawn at the width their words take; nothing where the page cannot measure them. */
  #lineBoxes(): readonly DOMRect[] | undefined {
    const range = globalThis.document?.createRange?.();
    if (range === undefined || typeof range.getClientRects !== "function") return undefined;
    this.#toast.style.width = "";
    range.selectNodeContents(this.#toast);
    return [...range.getClientRects()].filter((one) => one.width > 0);
  }
  #lines(): number { return new Set((this.#lineBoxes() ?? []).map((one) => Math.round(one.top))).size; }
  /** Counts the toast's stay from now; with the pointer or the keyboard on it, it stays. */
  #stay(): void {
    clearTimeout(this.#toastTimer);
    if (this.#toastHeld.size > 0) return;
    this.#toastTimer = setTimeout(() => { this.#toast.classList.remove("on"); this.#toast.removeAttribute("tabindex"); this.#toast.textContent = ""; }, this.#toastStay);
  }
  #hold(by: "pointer" | "keyboard", on: boolean): void {
    if (on) this.#toastHeld.add(by); else this.#toastHeld.delete(by);
    this.#stay();
  }

  /** Where a record's back link goes: the record before it on the trail, named; else the list it was opened from, named as the Plugins page; else Discover. */
  #back(): { readonly href: string; readonly name: string } {
    const from = this.#trail.at(-2) ?? this.#list0;
    // Opened by its address, with no list behind it, a record's way back is Discover, as the signed page has it.
    if (from === undefined) return { href: "#/plugins/discover", name: this.#say("pl.discover") };
    // The way back names the view it goes to, Discover or Yours; the list's kind and order are part of where the seller was, as browser
    // Back keeps them.
    if (from.kind === "home") return { href: from.view === "discover" && from.shelf !== undefined ? href.shelf(from.shelf, from.third?.order ?? THIRD.order) : from.third === undefined ? href.home(from.view, from.filter, from.shelf) : href.third(from.third), name: this.#say(from.view === "yours" ? "pl.yours" : "pl.discover") };
    if (from.kind === "chat") return { href: href.models, name: this.#say("pl.mo.chooseVendors") };
    const item = from.kind === "plugin" ? this.#plugin(from.id, from.npm) : this.#held.catalogue.bundles.find((one) => one.id === from.id);
    if (item === undefined) return { href: "#/plugins/discover", name: this.#say("pl.discover") };
    return { href: `${href.item(item)}${from.tab === undefined ? "" : `/${from.tab}`}`, name: this.#name(item) };
  }


  #home(route: HomeRoute): void {
    const body = h("div", { class: "pl-body" });
    const search = h("input", { type: "search", class: "pl-search", placeholder: this.#say("pl.search"), "aria-label": this.#say("pl.search"), value: this.#sought,
      oninput: (event) => { this.#sought = (event.target as HTMLInputElement).value; fill(body, ...this.#shelves(route)); } });
    const create = this.#held.member === true ? undefined : this.#createMenu();
    fill(this.element,
      h("h1", { tabindex: "-1", "data-focus": HEADING }, this.#say("nav.plugins")),
      h("div", { class: "pl-bar" },
        h("nav", { class: "pl-views", role: "tablist" }, ...(["discover", "yours"] as const).map((view) =>
          h("a", { class: "pl-view", role: "tab", href: href.home(view, route.filter), "aria-selected": String(route.view === view) }, this.#say(view === "discover" ? "pl.discover" : "pl.yours"), ...(view === "yours" ? this.newDot() : [])))),
        h("div", { class: "pl-tools" }, h("label", { class: "pl-searchbox" }, line("search") ?? "", search), create)),
      body);
    fill(body, ...this.#shelves(route));
  }

  /**
   * Create and its menu, holding the ways to make a plugin that have a route: uploading one, greyed, and asking cx; the official bundles
   * are added in code, never here. Opened, the menu takes the keyboard on its first row that takes a press, and the arrows pass the greyed row;
   * Escape, Tab and a click elsewhere close it, and Escape and Tab give the keyboard back to Create. Whether it is open is the page's, so the menu drawn again is open where the one before it was.
   */
  #createMenu(): HTMLElement {
    const item = (glyph: string, words: StringKey, go: () => void): HTMLButtonElement => h("button", { type: "button", role: "menuitem", class: "pl-create-item", onclick: () => { shut(false); go(); } }, line(glyph) ?? "", this.#say(words));
    // Uploading is drawn and not yet offered: its row names no card, so an address that names Upload's loses it in place.
    const greyed = (glyph: string, words: StringKey): HTMLButtonElement => h("button", { type: "button", role: "menuitem", class: "pl-create-item", disabled: true }, line(glyph) ?? "", this.#say(words));
    const items = [
      ...(this.#features.uploadPlugin ? [greyed("upload", "pl.createUpload")] : []),
      item("chat", "pl.createAsk", () => this.ports.ask(this.#say("pl.createDraft"))),
    ];
    const panel = h("div", { class: "pl-menu-list pl-create-list", role: "menu", hidden: !this.#createOpen }, ...items);
    const button = h("button", { type: "button", class: "primary pl-create", "aria-haspopup": "menu", "aria-expanded": String(this.#createOpen), onclick: () => { if (panel.hidden) open(); else shut(true); } },
      line("plus") ?? "", h("span", {}, this.#say("pl.create")), line("chevron") ?? "");
    const wrap = h("div", { class: "pl-menu" }, button, panel);
    const away = (event: Event): void => { if (!(event.target instanceof Node) || !wrap.contains(event.target)) shut(false); };
    const listen = (): void => { this.#shutCreate(); this.#createOpen = true; this.#createAway = away; globalThis.document?.addEventListener("click", away); };
    const pressable = items.filter((one) => !one.disabled);
    const open = (): void => { panel.hidden = false; button.setAttribute("aria-expanded", "true"); listen(); pressable[0]?.focus(); };
    const shut = (back: boolean): void => { panel.hidden = true; button.setAttribute("aria-expanded", "false"); this.#shutCreate(); if (back) button.focus(); };
    // The menu before this one was open: this one's own listener takes its place.
    if (this.#createOpen) listen();
    // The browser gives a press on a row that cannot be pressed no click, yet takes the keyboard from the menu: it stays where it was.
    panel.addEventListener("pointerdown", (event) => { if ((event.target as Element | null)?.closest?.("button:disabled")) event.preventDefault(); });
    panel.addEventListener("keydown", (event) => {
      const at = pressable.indexOf(globalThis.document?.activeElement as HTMLButtonElement);
      if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); shut(true); }
      else if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); pressable[(at + (event.key === "ArrowDown" ? 1 : pressable.length - 1)) % pressable.length]?.focus(); }
      else if (event.key === "Home" || event.key === "End") { event.preventDefault(); pressable[event.key === "Home" ? 0 : pressable.length - 1]?.focus(); }
    });
    return wrap;
  }

  /** Create's menu is open no longer, and nothing listens for the click that would close it. */
  #shutCreate(): void {
    this.#createOpen = false;
    if (this.#createAway !== undefined) globalThis.document?.removeEventListener("click", this.#createAway);
    this.#createAway = undefined;
  }

  /** While the reads are out, the bar stands and the body draws the shelves' shape: Discover's cards, Yours' rows. */
  #shelves(route: HomeRoute): readonly Child[] {
    if (!this.#loaded) return [route.view === "discover" ? cardsShape(this.#say("stream.loading"), route.shelf !== undefined ? 1 : SHELVES[route.filter].length) : rowsShape(this.#say(this.#listing()))];
    return route.view === "discover" ? this.#discover(route) : this.#yours(route.filter);
  }
  /**
   * What is held could not be read: said once, the same on Discover and Yours, with one way to read again; where cx's computer is off, that
   * it shows when the computer starts, with no way to read again, since a read answers the same until then.
   */
  #unreadLine(): HTMLElement {
    // The list on its way is said to a screen reader alone: the cards beside it already stand with neither + nor ✓.
    if (this.#why === "listing" || (this.#readingAgain && this.#waits.has("read-again"))) return skeleton(this.#say(this.#listing()));
    const said = `${this.ports.language()} ${this.#unreadSaid()} ${this.#retry}`;
    if (this.#unreadKept?.said === said) return this.#unreadKept.line;
    // The chat's line for an account without a computer has its way to 订阅, a link as the chat draws it.
    const line = h("div", { class: "pl-empty pl-unread", role: "status" }, h("p", { class: "quiet" }, ...linked(this.#say(this.#unreadSaid()), OFFER)),
      this.#retry && h("button", { type: "button", class: "pl-retry", onclick: this.#waits.press("read-again", () => this.#readAgain()) }, this.#say("pl.tryAgain")));
    this.#unreadKept = { said, line };
    return line;
  }
  /**
   * What stands where the installed list would: that it is on its way; no computer yet, in the words the chat says it in; or that the
   * read failed.
   */
  #unreadSaid(): StringKey {
    switch (this.#why) {
      case "listing": return this.#listing();
      case "pending": return "box.closedFree";
      default: return "pl.unread";
    }
  }
  /** The installed list on its way: while cx's computer starts, in the words the chat's line says it in, since the list waits on it. */
  #listing(): StringKey { return this.ports.starting?.() === true ? "line.starting" : "stream.loading"; }
  /** Try again keeps the seller's place: on itself if the reads fail again, else on the first thing it drew in its place — a computer found off among it. */
  async #readAgain(): Promise<void> {
    // The pressed line goes with its turning button: the list's place says it is on its way until the read ends.
    this.#unreadKept = undefined;
    this.#readingAgain = true;
    this.draw();
    await this.load();
    const into = this.#unread && this.#retry ? this.element.querySelector<HTMLElement>("button.pl-retry") : this.element.querySelector<HTMLElement>(".pl-body a, .pl-body button");
    into?.focus();
  }

  /** Held: a plugin installed, or a bundle the person installed, whatever was removed from under it since. Unknown when what is held could not be read. */
  #whole(item: Item): boolean | undefined {
    if (this.#unread) return undefined;
    return isBundle(item) ? holds(this.#held, item) : installed(this.#held, item);
  }
  /** The plugin a source names, from the catalogue or npm's gallery. */
  #ofSource(source: string): Plugin | undefined {
    return this.#held.catalogue.plugins.find((plugin) => sourceFor(this.#held, plugin) === source) ?? (npmNameOf(source) === undefined ? undefined : this.#galleryPlugin(npmNameOf(source)!));
  }
  /**
   * The queue as the platform last said it; nothing while what is installed is unread. A press's answer carries the row's waiting list as
   * the write left it, which a list whose read began before it could not know: the queue reads that one until a later list comes.
   */
  /** cx's computer: the page's own word on it, never read from a list, which a computer that never answered one keeps none of. */
  #power(): Power { return this.ports.power?.() ?? "on"; }

  /** The list the queue is read from: one that carries no word of clicks says nothing of it, and the last that did stands. */
  #queueList(): PackageList | undefined { return this.#listed?.waiting === undefined ? this.#worded ?? this.#listed : this.#listed; }

  /** Whether Update is held back for a plugin, by the queue and the list it is read from. */
  #updateHeld(plugin: Plugin, rows: readonly QueueRow[] = this.#rows()): boolean { return updateHeld(this.#queueList(), rows, plugin, sourceFor(this.#held, plugin)); }

  #rows(): readonly QueueRow[] {
    const listed = this.#queueList();
    if (this.#unread || listed === undefined) return [];
    const answered = this.#answered;
    const list = answered !== undefined && answered.at > (this.#heardAt.get(listed) ?? 0) ? { ...listed, waiting: answered.waiting } : listed;
    return queueOf(list, (source) => this.#ofSource(source), { power: this.#power(), answering: this.ports.answering?.() ?? false, installed: (source) => listed.packages.some((one) => one.source === source) });
  }
  /** The queue as the newest list says it, for the chat. */
  queue(): readonly QueueRow[] { return this.#rows(); }
  /**
   * What the feature card at the end of the chat reads and does, once the page has read the world whole: the held bundles, the updates
   * Update offers, the queue, and the presses the page's own controls make.
   */
  feature(): FeatureWorld | undefined {
    if (!this.#loaded || this.#early || this.#unread) return undefined;
    return {
      held: this.#held, rows: this.#rows(), updates: updatesOffered(this.#updates()), answering: this.ports.answering?.() ?? false, asleep: this.#power() === "off",
      head: (plugin, focus) => this.#head(plugin, focus), tile: (item) => tile(item, false, this.ports.language()), name: (item) => this.#name(item), list: (names) => this.#list(names),
      install: (bundle, off, agreed) => install(this.#cards(undefined, false, undefined, true), bundle, agreed, off),
      update: async (plugins) => {
        const added = await sendUpdates(this.ports.backend, linkedBy(this.#held, this.#theirUses), this.#doing, plugins);
        void this.load().then(() => this.ports.changed());
        return added;
      },
      cancel: (row) => this.#cancel(row),
      shown: async (bundle) => { await Promise.resolve().then(() => this.ports.backend.showBundle(bundle.id)).catch(() => undefined); },
      words: (words) => this.#words(words), ask: (sentence) => this.ports.ask(sentence, [sentence.length, sentence.length]),
    };
  }
  /** 重试 pressed elsewhere than the page, under a message in the chat. */
  retry(row: QueueRow): Promise<void> { return this.#retryRow(row); }
  /** What cx's computer installs or updates now, for the line above the message box: the queue's running row, by the newest list. */
  installing(): { readonly name: string; readonly act: "install" | "update" } | undefined {
    const row = runningRow(this.#rows());
    return row === undefined ? undefined : { name: (row.plugin.box === undefined ? undefined : this.packageName(row.plugin.box.package)) ?? this.#name(row.plugin), act: row.act };
  }
  #queueContext(): QueueContext {
    return {
      say: this.ports.say, language: this.ports.language(), head: (plugin, focus) => this.#head(plugin, focus),
      cancel: (row) => void this.#cancel(row), retry: (row) => void this.#retryRow(row), member: this.#held.member === true,
    };
  }
  /**
   * 取消: a row that waits takes its click back, a failed one its failure, and the row leaves; nothing is said but to a screen reader,
   * and the keyboard goes to the next row's 取消, else the one before it, else the page's heading. A click the computer has begun stays,
   * drawn as it runs; one the platform could not take back stays as it was.
   */
  async #cancel(row: QueueRow): Promise<void> {
    const rows = this.#rows();
    const at = rows.findIndex((one) => one.act === row.act && one.source === row.source);
    const next = rows[at + 1] ?? rows[at - 1];
    let gone = false;
    try {
      if (row.stands === "failed") { await this.ports.backend.forgetFailure(row.source); gone = true; }
      else if (row.id !== undefined) gone = (await this.ports.backend.cancelClick(row.id)) !== "started";
    } catch { gone = false; }
    await this.load();
    void this.ports.changed();
    if (!gone) { placed(this.element, cancelPlace(row))?.focus({ preventScroll: true }); return; }
    this.ports.announce(this.#say(row.act === "update" ? "pl.q.cancelledUpdate" : "pl.q.cancelledInstall", { name: this.#name(row.plugin) }));
    ((next === undefined ? undefined : placed(this.element, cancelPlace(next))) ?? placed(this.element, HEADING))?.focus({ preventScroll: true });
  }
  /**
   * 重试: a new click, so the row goes to the queue's end and waits its turn as a new press would, and is said as every press is; the
   * keyboard follows it. An install is pressed again as Install is, its card asked again; an update as Update is.
   */
  async #retryRow(row: QueueRow): Promise<void> {
    if (row.act === "install") { await install(this.#cards(row.plugin), row.plugin); (placed(this.element, `queue ${row.act} ${row.source}`) ?? placed(this.element, retryPlace(row)))?.focus({ preventScroll: true }); return; }
    try {
      await this.ports.backend.updatePackage(row.source);
      this.#tell(this.#say("pl.q.added"));
    } catch { /* The row stays failed, its 重试 where it was. */ }
    await this.load();
    void this.ports.changed();
    (placed(this.element, `queue ${row.act} ${row.source}`) ?? placed(this.element, retryPlace(row)))?.focus({ preventScroll: true });
  }
  /** A shelf's count, drawn once the world is read whole: until then what the shelf holds can still change. */
  /** A shelf's count, drawn only once the page holds ours whole: a list still being read is not counted as if it were all. */
  #count(n: number): Child { return !this.#early && this.#held.catalogue.oursRead === undefined && h("span", { class: "count" }, String(n)); }
  /** Where ours could not be read, Discover and Yours say so, with Try again, rather than drawing one of ours as someone else's. */
  #oursUnread(said = this.#held.catalogue.oursRead === "failed"): Child {
    return said && h("div", { class: "pl-empty", role: "status" }, h("p", { class: "quiet" }, this.#say("pl.npm.unreachable")),
      this.#waits.ring("ours-again", h("button", { type: "button", "data-focus": "ours-again", onclick: this.#waits.press("ours-again", () => this.load()) }, this.#say("pl.tryAgain"))));
  }
  #shown(items: readonly Item[]): readonly Item[] { return items.filter((item) => matches(item, this.ports.language(), this.#sought)); }

  /** What an address with nothing at it draws: the way back and the one line. */
  #unknown(): readonly Child[] {
    return [h("p", { class: "back" }, h("a", { href: "#/plugins" }, `← ${this.#say("nav.plugins")}`)), h("p", { class: "quiet" }, this.#say("pl.unknown"))];
  }

  /** A list's address with nothing at it: a filter or a shelf of bundles where none is offered, or shelves of Discover that offer nothing. */
  #bare(route: HomeRoute): boolean {
    if (!this.#features.bundles && (route.filter === "bundles" || route.shelf === "bundles")) return true;
    return route.view === "discover" && (route.shelf !== undefined ? [route.shelf] : SHELVES[route.filter]).every((shelf) => offered(this.#held, shelf).length === 0);
  }

  /** That nothing matches is said of the words typed, and only where some were. */
  #nothing(): HTMLElement {
    const sought = this.#sought.trim();
    return h("div", { class: "pl-empty pl-nomatch" }, h("p", { class: "quiet" }, this.#say("pl.noMatch", { q: sought })),
      h("button", { type: "button", onclick: () => this.ports.ask(this.#say("pl.noMatchDraft", { q: sought })) }, this.#say("pl.noMatchAsk")));
  }

  /**
   * Discover: the page's one bar, then ComChatX's plugins, the banner and the shelves, each showing six cards and a "Show all" for the
   * rest, or under a kind one list; then pi's own plugins npm lists, of the same kind in the same order. A shelf whole is ComChatX's
   * alone and draws no bar. The banner draws only when a bundle is offered.
   */
  #discover(route: HomeRoute): readonly Child[] {
    const bar = route.third ?? THIRD;
    if (this.#made === undefined) void this.#readMade();
    if (route.shelf !== undefined) return this.#shelfWhole(route.shelf, bar);
    const searching = this.#sought.trim() !== "";
    const ours = this.#oursSection(route, bar, searching);
    const piDrawn = route.filter !== "bundles";
    const others = piDrawn ? this.#thirdShown(bar) : [];
    const pi = piDrawn && (others.length > 0 || !searching) ? this.#piSection(bar, others) : false;
    if (ours === false && pi === false) return [this.#unread && this.#unreadLine(), this.#pageBar(bar), searching && this.#nothing()];
    return [this.#unread && this.#unreadLine(), this.#pageBar(bar), ours, pi];
  }

  /**
   * What ComChatX's section offers on a shelf: the catalogue's, and the packages made for ComChatX by someone else, which npm's search
   * entry names by the keyword `comchatx`, each on the shelf its own field declares, Extensions where it declares none.
   */
  #upper(shelf: Shelf): readonly Item[] {
    const made = (this.#made?.packages ?? []).map((listed) => this.#galleryPlugin(listed.name, listed)).filter((plugin) => plugin.section === shelf);
    return [...offered(this.#held, shelf), ...made];
  }

  /**
   * ComChatX's section: under All its shelves, bundles first, each in the bar's order; under a kind one list of the packages pi gives
   * that kind, since a shelf such as Extensions would otherwise hold skills.
   */
  #oursSection(route: HomeRoute, bar: Third, searching: boolean): Child {
    const held = this.#held;
    const card = (item: Item): readonly Child[] => [this.#card(item), ...this.#under(item)];
    const section = (...body: readonly Child[]): HTMLElement => h("section", { class: "pl-section", "aria-labelledby": "pl-sec-ours" }, h("h2", { class: "pl-section-title", id: "pl-sec-ours" }, this.#say("pl.section.ours")), ...body);
    if (bar.kind !== "all") {
      const items = this.#shown(inOrder(SHELVES.plugins.filter((shelf) => shelf !== "models").flatMap((shelf) => this.#upper(shelf)).filter((item) => ofKind(item, bar.kind)), bar.order, this.ports.language()));
      return items.length > 0 && section(h("div", { class: "pl-cards" }, ...items.flatMap(card)));
    }
    const lists = SHELVES[route.filter].map((shelf) => ({ shelf, items: this.#shown(inOrder(this.#upper(shelf), bar.order, this.ports.language())) })).filter((one) => one.items.length > 0);
    const banner = bannerOf(held);
    const showBanner = banner !== undefined && !searching && route.filter !== "plugins";
    const unread = this.#oursUnread();
    if (lists.length === 0 && !showBanner && unread === false) return false;
    return section(
      unread,
      showBanner && this.#banner(banner),
      ...lists.map(({ shelf, items }) => h("section", { class: "pl-shelf" },
        h("div", { class: "pl-shelf-head" },
          h("h3", {}, this.#say(`pl.shelf.${shelf}`), this.#count(items.length)),
          !searching && items.length > PER_SHELF && h("a", { class: "pl-showall", href: href.shelf(shelf, bar.order) }, `${this.#say("pl.showAll")} ›`)),
        h("div", { class: "pl-cards" }, ...(searching ? items : items.slice(0, PER_SHELF)).flatMap(card)))),
    );
  }

  /** One of ComChatX's shelves whole, in the order the bar held when Show all was pressed: one kind of plugin, so it draws no bar. */
  #shelfWhole(shelf: Shelf, bar: Third): readonly Child[] {
    const items = this.#shown(inOrder(this.#upper(shelf), bar.order, this.ports.language()));
    const back = h("p", { class: "back" }, h("a", { href: bar.order === THIRD.order ? "#/plugins/discover" : href.third({ kind: "all", order: bar.order }) }, `← ${this.#say("pl.discover")}`));
    if (items.length === 0) return [back, this.#unread && this.#unreadLine(), this.#sought.trim() !== "" && this.#nothing()];
    return [back, this.#unread && this.#unreadLine(), h("section", { class: "pl-shelf" },
      h("div", { class: "pl-shelf-head" }, h("h2", {}, this.#say(`pl.shelf.${shelf}`), this.#count(items.length))),
      h("div", { class: "pl-cards" }, ...items.flatMap((item) => [this.#card(item), ...this.#under(item)])))];
  }

  /**
   * The page's one bar: pi's kinds and the order, for both sections at once. It stands above both, under the page's head, and stays at
   * the window's top while the page scrolls under it; the head, which Discover and Yours share, keeps search.
   */
  #pageBar(bar: Third): HTMLElement {
    const sort = h("select", { class: "pl-sort", "aria-label": this.#say("pl.npm.sortBy"), "data-focus": "sort", onchange: (event) => { location.hash = href.third({ kind: bar.kind, order: (event.target as HTMLSelectElement).value as NpmOrder }); } },
      ...NPM_ORDERS.map((order) => h("option", { value: order, selected: order === bar.order }, this.#say(`pl.npm.order.${order}`))));
    sort.value = bar.order;
    return h("div", { class: "pl-npm-bar" },
      h("nav", { class: "pl-filters pl-kinds", "aria-label": this.#say("pl.npm.kinds") }, ...(["all", ...NPM_KINDS] as const).map((kind) =>
        h("a", { class: "pl-filter", href: href.third({ kind, order: bar.order }), "aria-current": kind === bar.kind ? "true" : undefined }, this.#say(`pl.npm.kind.${kind}`)))),
      sort);
  }

  /** The packages made for ComChatX by someone else, every step of them; the page is drawn again once they answer. A read that fails draws none, and is read again at the next visit. */
  async #readMade(): Promise<void> {
    this.#made = { packages: [], declared: new Map(), unread: [], state: "loading" };
    const packages: NpmListed[] = [];
    try {
      // The list goes on from where the platform's own answer ended, every package it answered counted, drawn or not.
      for (let next = 0, total = Infinity; next < total;) {
        const read = await this.ports.backend.npmPackages("all", "downloads", next, "comchatx");
        total = read.total;
        if (read.packages.length === 0) break;
        next += read.packages.length;
        packages.push(...read.packages.filter((one) => drawable(one) && !packages.some((had) => had.name === one.name)));
      }
      // The keyword finds them; each one's own field says where it stands.
      const declared = await this.#declarations(packages.map((one) => one.name));
      this.#made = { packages, declared, unread: packages.map((one) => one.name).filter((name) => !declared.has(name)), state: "ready" };
    } catch {
      this.#made = { packages: [], declared: new Map(), unread: [], state: "failed" };
    }
    if (this.#made.packages.length > 0) { this.draw(); if (this.#route.kind === "home" && this.#route.view === "discover") this.#seek(); }
    if (this.#made.state === "failed") this.#made = undefined;
  }

  /**
   * What each package's own field declares, for those whose page the platform answered. A read it refused, busy or failed, is no answer:
   * it is left out, never kept as declaring nothing. The platform paces every read of a package by name.
   */
  async #declarations(names: readonly string[]): Promise<ReadonlyMap<string, Declared>> {
    const read = await Promise.all(names.map((name) => Promise.resolve().then(() => this.ports.backend.npmPackage(name)).then(declaredBy, () => undefined)));
    return new Map(names.flatMap((name, n) => (read[n] === undefined ? [] : [[name, read[n]] as const])));
  }

  /** The declarations a load could not read, read again; the page is drawn again where one answers. */
  async #readDeclared(made: MadeList): Promise<void> {
    const declared = await this.#declarations(made.unread);
    if (this.#made !== made || declared.size === 0) return;
    this.#made = { ...made, declared: new Map([...made.declared, ...declared]), unread: made.unread.filter((name) => !declared.has(name)) };
    this.draw();
  }

  /** Pi plugins read so far for a kind and an order, those the search finds; the first read of them starts here. */
  #thirdShown(third: Third): readonly NpmListed[] {
    if (this.#third?.key !== thirdKey(third, this.#sought)) void this.#readThird(third);
    const language = this.ports.language();
    return (this.#third?.packages ?? []).filter((listed) => matches(galleryPlugin(listed), language, this.#sought));
  }

  /** Reads the list's next step, or its first: a list of another kind or order starts again. The page is drawn again once it answers. */
  async #readThird(third: Third): Promise<void> {
    // A search asks the platform's list for what it finds, shown or not, in the bar's order and by the list's steps.
    const sought = this.#sought.trim();
    const key = thirdKey(third, sought);
    const before = this.#third?.key === key && this.#third.state === "ready" ? this.#third : undefined;
    this.#third = before === undefined ? { key, packages: [], next: 0, total: 0, state: "loading" } : { ...before, more: "loading" };
    if (before !== undefined) this.draw();
    const from = before?.next ?? 0;
    const backend = this.ports.backend;
    const read = await (sought === "" ? backend.npmPackages(third.kind, third.order, from) : backend.npmPackages(third.kind, third.order, from, "pi", sought)).catch(() => undefined);
    if (this.#third?.key !== key) return;
    // The list goes on from where the platform's answer ended, whatever of it is drawn, and ends where the platform has no more.
    const next = read === undefined ? from : from + read.packages.length;
    this.#third = read !== undefined ? { key, packages: [...(before?.packages ?? []), ...read.packages.filter((one) => drawable(one) && !before?.packages.some((had) => had.name === one.name))], next, total: read.packages.length === 0 ? next : read.total, state: "ready" }
      : before === undefined ? { key, packages: [], next: 0, total: 0, state: "failed" } : { ...before, more: "failed" };
    if (this.#route.kind === "home" && this.#route.view === "discover") { this.draw(); this.#seek(); }
  }

  /**
   * Pi plugins, pi's own packages npm lists, of the bar's kind in its order, as cards, and a way to show the next step of them, whose
   * first new card takes the keyboard. A read npm did not answer says so, with Try again.
   */
  #piSection(third: Third, shown: readonly NpmListed[]): HTMLElement {
    const list = this.#third;
    const left = list === undefined || list.state !== "ready" ? 0 : list.total - list.next;
    const again = (place: string): HTMLElement => h("div", { class: "pl-empty", role: "status" }, h("p", { class: "quiet" }, this.#say("pl.npm.unreachable")),
      this.#waits.ring(`third-again ${place}`, h("button", { type: "button", "data-focus": place, onclick: this.#waits.press(`third-again ${place}`, () => { if (list?.more === undefined) this.#third = undefined; return this.#readThird(third); }) }, this.#say("pl.tryAgain"))));
    return h("section", { class: "pl-section pl-third", "aria-labelledby": "pl-sec-pi" },
      h("h2", { class: "pl-section-title", id: "pl-sec-pi" }, this.#say("pl.section.pi")),
      list?.state === "loading" && skeleton(this.#say("stream.loading"), h("div", { class: "pl-cards" }, ...Array.from({ length: PER_SHELF }, cardShape))),
      list?.state === "failed" && again("third-again"),
      shown.length > 0 && h("div", { class: "pl-cards" }, ...shown.flatMap((listed) => { const plugin = this.#galleryPlugin(listed.name, listed); return [this.#card(plugin, "pi"), ...this.#under(plugin)]; })),
      list?.more === "failed" ? again("more-third")
        : left > 0 && h("p", { class: "pl-npm-more" }, this.#moreButton(third, list?.more === "loading", Math.min(NPM_STEP, left))));
  }

  /** 更多 turns while its step is read; the read itself is what draws it so, as the list's own state. */
  #moreButton(third: Third, reading: boolean, count: number): HTMLElement {
    const more = h("button", { type: "button", "data-focus": "more-third", onclick: () => void this.#more(third) }, this.#say("pl.npm.more", { count }));
    ringed(more, reading);
    return more;
  }

  /** The list's next step; the keyboard goes to the first card it adds. */
  async #more(third: Third): Promise<void> {
    if (this.#third?.more === "loading") return;
    const first = this.#third?.packages.length ?? 0;
    await this.#readThird(third);
    const added = this.#third?.packages[first];
    if (added === undefined) return;
    const at = href.item(this.#galleryPlugin(added.name, added));
    [...this.element.querySelectorAll<HTMLElement>("a.pl-card-name")].find((link) => link.getAttribute("href") === at)?.focus();
  }

  #banner(bundle: Bundle): HTMLElement {
    const whole = this.#whole(bundle);
    const busy = this.#doing.busy(bundle);
    return h("section", { class: "pl-banner" },
      h("div", { class: "pl-banner-text" },
        h("p", { class: "quiet" }, this.#say("pl.bannerFrom")),
        h("h2", {}, this.#name(bundle)),
        h("p", {}, this.#words(bundle.about)),
        h("p", { class: "row" },
          whole === true ? h("span", { class: "pl-done" }, ...this.#done(bundle, true))
            // A press installs where the seller stands, as a card's + does; while it is written down the button turns and takes no press.
            : whole === false && this.#held.member !== true && (busy !== undefined
              ? h("button", { type: "button", class: "primary pl-busy", "aria-disabled": "true", "aria-busy": "true", "aria-label": this.#say(`pl.doing.${busy.act}Name`, { name: this.#name(bundle) }), "data-focus": BANNER_ACT }, spinner())
              : h("button", { type: "button", class: "primary", "data-focus": BANNER_ACT, "data-card": cardFor(this.#held, "install", bundle), onclick: () => void install(this.#cards(bundle, false, BANNER_ACT), bundle) }, `+ ${this.#say("pl.install")}`)),
          h("a", { class: "button", href: href.item(bundle) }, this.#say("pl.view")))),
      this.#bannerArt(bundle));
  }

  /** The banner's picture: the bundle's own drawing where its record names one the page holds, else the marks of the plugins on its list. */
  #bannerArt(bundle: Bundle): HTMLElement {
    const art = bundle.art === undefined ? undefined : ART[bundle.art];
    if (art === undefined) return h("div", { class: "pl-banner-tiles", "aria-hidden": "true" }, ...membersOf(this.#held, bundle).map((plugin) => tile(plugin, true, this.ports.language())));
    const drawn = svg("svg", { viewBox: art.viewBox, fill: "none", stroke: "currentColor", "stroke-width": "3", "stroke-linecap": "round", "stroke-linejoin": "round" });
    // The drawings are the repository's own, as the logos are, never a record's or a person's words.
    drawn.innerHTML = art.body;
    return h("div", { class: "pl-banner-art", "aria-hidden": "true" }, drawn);
  }

  /** ✓, named for what is installed; on a card it holds the place its + had, so the keyboard that pressed + stays on it. */
  #done(item: Item, word = false, place?: string): readonly Child[] {
    const name = this.#say("pl.installedName", { name: this.#name(item) });
    return [h("span", { class: "pl-done-mark", role: "img", "aria-label": name, title: name, ...(place === undefined ? {} : { tabindex: "-1", "data-focus": place }) }, "✓"), word && (this.#held.member === true ? h("span", { class: "pl-done-word", "data-key": "org.installedBy" }, this.#say("org.installedBy")) : h("span", { class: "pl-done-word" }, this.#say("pl.installed")))];
  }

  /** npm was asked for a name and has not answered it: the read is still out, or failed since the last load. */
  #authorUnread(name: string): boolean { return !this.#npmSaid.has(name) && (this.#npmWords.has(name) || this.#npmFailed.has(name)); }
  /** Who a card names: a plugin's author; for a model plugin, the vendor its models come from, since the plugin is ComChatX's. */
  #byline(item: Item): string {
    // A package whose npm read is out or failed names no author: only an answer that states none is ground for saying so.
    if (item.author === "") return !isBundle(item) && item.npm !== undefined && this.#authorUnread(item.npm) ? "" : this.#say("pl.own.by");
    return !isBundle(item) && item.model !== undefined ? this.#say("pl.fromVendor", { vendor: vendorIn(item, this.ports.language()) }) : this.#say("pl.by", { name: item.author });
  }
  /** A record's one line; a package that says nothing of itself has none. */
  #about(item: Item): string { return this.#words(item.about); }
  /**
   * A plugin the person installed themselves says so where every other row says who made it: that its files are gone, that it is
   * someone else's, or that ComChatX did not check it. On the one row of 我的 and the queue (sheet 1) 未经检查 is the third party's mark,
   * whose condition it shares, so a package of ours the person installed carries none; the record's lists keep the older chip until they
   * are drawn as signed.
   */
  #own(item: Item, row = false): readonly Child[] {
    if (isBundle(item) || item.own !== true) return [];
    if (!this.#unread && filesMissing(this.#held, item)) return [h("span", { class: "pl-unchecked" }, this.#say("pl.chip.missing"))];
    return isThird(item) ? [thirdMark(this.ports.say)] : row ? [] : [h("span", { class: "pl-unchecked" }, this.#say("pl.own.chip"))];
  }
  /**
   * A row's spend this month: the figure alone, in the money colour, as the sidebar draws it; a screen reader hears the month with it.
   */
  #month(amount: number): HTMLElement {
    const figure = this.#amount(amount);
    return h("span", { class: "pl-month money" }, h("span", { "aria-hidden": "true" }, figure), h("span", { class: "pl-sr" }, this.#say("pl.month", { amount: figure })));
  }
  /**
   * A failed click's line on a card or a row, with the try that asks a card again only for a paid source no card of this tab named. A
   * failed update is its row's own, at the row's end.
   */
  #failedLine(item: Item, place: "row" | "card"): Child {
    const failed = this.#unread ? undefined : this.#doing.failed(item);
    // A failed update is said on its row, which Try again at its end updates again.
    if (failed?.act === "update") return false;
    return failed !== undefined && failureLine({ held: this.#held, say: this.ports.say, language: this.ports.language(), list: (names) => this.#list(names) }, item, failed, { retry: () => void again(this.#cards(item, true), item, failed), help: this.ports.backend.links.help }, place);
  }
  #factLine(item: Item, place: "row" | "card"): Child {
    // That a plugin is gone is said on its own page only: a card or a row that draws it as not installed already says so.
    return !this.#unread && this.#doing.busy(item) === undefined && factLine({ held: this.#held, say: this.ports.say, language: this.ports.language() }, item, new Set([...this.#doing.facts(item)].filter((fact) => fact !== "not_listed")), place, this.#doing.stopped(item));
  }


  /** A record's card. On the Pi section a card wears no tag: the section already says whose it is. */
  /** A member's installed card says, at the end of its foot, who installed it: the organization, whose admin installs. */
  #byOrganization(item: Item): HTMLElement | undefined {
    return this.#held.member === true && this.#whole(item) === true ? h("span", { class: "pl-by-org", "data-key": "org.installedBy" }, this.#say("org.installedBy")) : undefined;
  }

  #card(item: Item, place?: "pi"): HTMLElement {
    if (!isBundle(item)) return this.#packageCard(item, place);
    // A bundle's card is one link, its name's stretched over it by the stylesheet, and + stands above it as a button of its own.
    return h("div", { class: "f-card pl-card pl-card-open" },
      tile(item, false, this.ports.language()),
      h("span", { class: "pl-card-text" },
        h("a", { class: "pl-card-name", href: href.item(item) }, this.#name(item)),
        h("span", { class: "pl-about" }, this.#about(item)),
        h("span", { class: "pl-meta" }, h("span", { class: "pl-by" }, this.#byline(item), ` · ${this.#say("pl.members", { count: installsOf(this.#held, item).length })}`), this.#byOrganization(item))),
      ...this.#act(item));
  }

  /**
   * One card for every package, ours, one made for ComChatX and pi's, after pi.dev's: its mark, its name, its line; then one line of who
   * made it, last month's downloads and how long ago its version was published, and one line of links, npm, the repository and 反馈,
   * which end with the one tag, Third-party plugin, on what ComChatX did not make (ruled 2026-11-13). A model's card is its maker's
   * package's, and its line names the maker. A card that is no package says who makes it and what it uses, in the facts' form, and draws
   * no links' line, but where it holds the tag. Every card is one height, whatever it holds.
   */
  #packageCard(plugin: Plugin, place?: "pi"): HTMLElement {
    const say = this.ports.say;
    const language = this.ports.language();
    const name = h("a", { class: "pl-card-name", href: href.item(plugin) }, this.#name(plugin));
    const about = this.#about(plugin);
    const third = place !== "pi" && !madeByUs(plugin) && (plugin.npm !== undefined || plugin.own === true);
    const words = { say, language, ago: (iso: string) => ago(iso, this.ports.backend.now(), language, say) };
    return h("div", { class: "f-card pl-card pl-card-open pl-card-one" },
      tile(plugin, false, this.ports.language()),
      h("span", { class: "pl-card-text" },
        name,
        h("span", { class: "pl-about", ...(plugin.npm !== undefined && about !== "" ? authored(about) : {}) }, about),
        factsLine(words, plugin, this.#byOrganization(plugin)),
        (plugin.onNpm !== undefined || third) && linksLine(say, plugin.onNpm, [third && thirdMark(say)])),
      ...this.#act(plugin));
  }
  /**
   * A card's +, ✓ or the click still out, standing where + was, in words; ✓ is drawn once the world read again says it is installed, or
   * at once for an install that waits for cx's computer.
   */
  #act(item: Item): readonly Child[] {
    const whole = this.#whole(item);
    const busy = this.#doing.busy(item);
    const name = this.#say("pl.installName", { name: this.#name(item) });
    // While what is installed is still being read, the place of + or ✓ draws its shape, as a card not read yet does.
    const waiting = this.#unread && this.#why === "listing" ? [block(h("span", { class: "pl-act pl-act-shape", "aria-hidden": "true" }))] : [];
    // Where the queue holds the record its corner says so, a bundle's too while what it installs waits; a press still being written down
    // turns its ring. An installed plugin keeps ✓ while it updates: Discover says nothing of a new version (ruled 2026-11-13).
    const queued = whole === true ? undefined : this.#inQueue(item);
    const shown = whole === true && busy?.act === "update" ? undefined : busy;
    return queued !== undefined ? [queued] : shown !== undefined ? [busyMark(this.ports.say, this.ports.language(), item, shown, "card")] : whole === true ? this.#done(item, false, `act ${href.item(item)}`) : whole === false && this.#held.member !== true ? [h("button", { type: "button", class: "pl-act", "aria-label": name, title: name, "data-focus": `act ${href.item(item)}`, "data-card": cardFor(this.#held, "install", item), onclick: () => { void this.#add(item); } }, "+")] : waiting;
  }
  /**
   * A card whose install waits in the queue holds a ring that stands still in ✓'s place, named for the queue and going to its row; while
   * cx's computer runs it, the ring turns. A failed install is + again, with no line: it is not installed, and the queue says so. A
   * bundle's card is drawn so for what it installs. Nothing reads as installed before it lands (ruled 2026-11-09).
   */
  /** A plugin's failed row in the queue, with the queue's own 重试 and ✕, for its page's head. */
  #failedRow(plugin: Plugin): FailedRow | undefined {
    const row = this.#rows().find((one) => one.stands === "failed" && one.plugin.id === plugin.id);
    return row === undefined ? undefined : { row, retry: () => void this.#retryRow(row), cancel: () => void this.#cancel(row) };
  }
  #inQueue(item: Item): HTMLElement | undefined {
    const rows = this.#rows().filter((row) => row.act === "install" && row.stands !== "failed" && (isBundle(item) ? installsOf(this.#held, item).some((plugin) => plugin.id === row.plugin.id) : row.plugin.id === item.id));
    if (rows.length === 0) return undefined;
    if (rows.some((row) => row.stands === "running")) return busyMark(this.ports.say, this.ports.language(), item, { act: "install" }, "card");
    const words = this.#say("pl.q.inQueue", { name: this.#name(item) });
    return h("a", { class: "pl-done-mark pl-queued", href: href.home("yours"), "aria-label": words, title: words, "data-focus": `act ${href.item(item)}`,
      onclick: () => { this.#toQueue = rows[0]!; } }, h("span", { class: "pl-spin pl-still", "aria-hidden": "true" }));
  }
  /**
   * What a click on a card failed to do or found out, as a line of its own under the card's row: the card and its neighbours keep their
   * size. An install the queue holds as failed draws no line: the card is + again, and the queue's row in Yours says it failed (ruled
   * 2026-11-13). A press the platform refused never reached the queue, so its line stays, the one place it is said.
   */
  #under(item: Item): readonly HTMLElement[] {
    return [this.#failedLine(item, "card"), this.#factLine(item, "card")].filter((one): one is HTMLElement => typeof one === "object" && one !== null);
  }


  /** The balance `/me` gave, drawn as money, for the cards that start a payment. */
  #balance(): { readonly balance?: string } {
    const available = this.ports.me()?.balance?.available;
    return available === undefined ? {} : { balance: this.#amount(available, true) };
  }

  /**
   * The cards as Discover and Yours open them: what is done is read again, the sidebar follows, and a toast says what happened. A failure
   * leaves the card on its shelf with the keyboard on +.
   */
  #cards(focus?: Item, retried = false, at?: string, atWrite = false): CardContext {
    // A click on a package that sells a source has switched it by the time it is answered, however it then ends: the sidebar follows a click that waits or failed too.
    const reload = async (): Promise<void> => { await this.load(); void this.ports.changed(); };
    return cardsFor({ held: this.#held, backend: this.ports.backend, cards: this.ports.cards, language: this.ports.language(), money: this.#money, ...this.#rule, say: this.ports.say, list: (names) => this.#list(names), tile: (item, big) => tile(item, big, this.ports.language()), head: (plugin) => this.#head(plugin, `card ${href.item(plugin)}`), ...this.#balance(), ended: this.#ended },
      (work, told, failed, about) => {
        const fail = async (): Promise<false> => {
          // A click on a record leaves its failure on the record, in brick, until it is tried again; a toast would be gone in a moment.
          await reload();
          // The keyboard stays with the failure: on the try the seller just pressed, else on the control they pressed, + or the line's own act.
          const plus = at !== undefined ? placed(this.element, at) : focus === undefined ? undefined : [...this.element.querySelectorAll<HTMLButtonElement>("button.pl-act")].find((button) => button.getAttribute("aria-label") === this.#say("pl.installName", { name: this.#name(focus) }));
          // Several rows can say one plugin's failure, each under its own needs line: the one where the seller pressed is theirs.
          const lines = about === undefined ? [] : this.#linesOf(about.item);
          const line = lines.find((one) => plus?.closest("li")?.contains(one) === true) ?? lines[0];
          // A press made under another record than the one it is about, as a needs line's is, can leave no line in the window, and a row of
          // 我的 draws none: it is said in the toast all the same, and the list stays where the seller put it.
          const other = focus !== undefined && about !== undefined && href.item(focus) !== href.item(about.item);
          if (about === undefined || lines.length === 0 || (other && !lines.some((one) => this.#seen(one)))) { const told = this.#failureSaid(about, failed); this.#tell(told.said, told.asks); }
          // The keyboard goes to the act pressed, or where that act is gone with what it asked for, to the row it stood on.
          ((retried ? line?.querySelector<HTMLElement>("button.pl-again") : undefined) ?? plus ?? (other ? this.#rowOf(focus) : undefined) ?? line?.querySelector<HTMLElement>("button.pl-again"))?.focus({ preventScroll: true });
          if (other) return false;
          // The line stands under its card, which may be at the fold: the line and then the card are brought into view, and no further.
          line?.scrollIntoView?.({ block: "nearest" });
          (line?.closest<HTMLElement>("li") ?? (line?.previousElementSibling as HTMLElement | null | undefined))?.scrollIntoView?.({ block: "nearest" });
          return false;
        };
        const drawn = async (): Promise<true> => {
          await reload();
          // The card or Yours' row was drawn again, its notice gone with what it asked for; the keyboard stays on the card's act, now ✓,
          // or else on the card or the row.
          ((at === undefined ? undefined : placed(this.element, at)) ?? (focus === undefined ? undefined : placed(this.element, `act ${href.item(focus)}`) ?? this.#rowOf(focus)))?.focus({ preventScroll: true });
          return true;
        };
        // A press from the feature card is answered by its write alone, admitted or refused; the reads after it go on behind.
        if (about === undefined) {
          const after = async (): Promise<true> => { const done = await drawn(); if (told !== "") this.#tell(told); return done; };
          return atWrite ? work().then(() => { void after(); return true; }, () => { void fail(); return false; }) : work().then(after, fail);
        }
        // A click is answered once it is written down, asleep or awake; what is said of it waits for its end, and a failure then stands on its record.
        const from = here();
        return new Promise<boolean>((resolve) => {
          let written = false;
          this.#doing.track(about, work, () => { written = true; if (atWrite) resolve(true); void drawn().then(resolve); }).then(async (how) => {
            if (!written && how === "unsaid") { if (atWrite) resolve(false); await reload(); resolve(false); return; }
            // Said as soon as it is known: an install's or an update's sentence is its write's, never the list's read after it.
            const said = endSaid(how, told);
            if (said !== "" && written) this.#tell(said);
            // An install is answered at its write, which `drawn` already read the world after: it has no end of its own to read again for.
            if (!written) resolve(await drawn()); else if ((how === "done" || how === "unsaid") && about.act !== "install") await reload();
            if (said !== "" && !written) this.#tell(said);
          }, async () => {
            if (!written) { if (atWrite) resolve(false); resolve(await fail()); return; }
            await reload();
            // A failure after the write is told once where the seller now is, unless a line in view says it, and the record keeps it: a
            // switch's or a removal's always, since no row of 我的 says it; an install's or an update's only away from where it was pressed, its queue row saying it there.
            if (here() !== from || (about.act !== "install" && about.act !== "update")) this.#tellAway(failed, about, true);
          });
        });
      });
  }

  /**
   * What a click's end is told where the seller now is, once they left the place they clicked: in the toast, unless a line on the page
   * in view already says it. One path for a click begun on any surface.
   */
  #tellAway(words: string, about?: About, failed = false): void {
    if (about !== undefined && this.#linesOf(about.item).some((line) => this.#seen(line))) return;
    const told = this.#failureSaid(about, words);
    this.#tell(told.said, failed && told.asks);
  }

  /** + installs at once what has nothing to tell; anything else opens the install card, which says what installs and what it buys from. */
  async #add(item: Item): Promise<void> {
    await install(this.#cards(item), item);
  }

  /** Yours, in Discover's shelves and order: a row per held bundle and per installed plugin; on, off and remove are on the record's own page. */
  #yours(filter: Filter): readonly Child[] {
    if (this.#made === undefined) void this.#readMade();
    const held = this.#withMade(this.#held);
    if (this.#unread && this.#why === "listing") return [rowsShape(this.#say(this.#listing()))];
    if (this.#unread) return [this.#unreadLine()];
    const none = [h("div", { class: "pl-empty" }, h("p", { class: "quiet" }, this.#say("pl.noneYours")))];
    // What waits in the queue is in it, not on a shelf, until it lands; a bundle joins its shelf once nothing it installs is in the queue.
    const rows = this.#rows();
    const queue = this.#sought.trim() === "" && filter === "all" ? queueSection(this.#queueContext(), rows) : undefined;
    const waiting = (bundle: Bundle): boolean => rows.some((row) => row.act === "install" && row.stands !== "failed" && installsOf(held, bundle).some((plugin) => plugin.id === row.plugin.id));
    // A bundle stays while its members' removals are under way, its row saying so until cx's computer has ended them.
    const removing = (item: Item): boolean => isBundle(item) && this.#doing.busy(item) !== undefined;
    if (held.catalogue.plugins.every((plugin) => !installed(held, plugin)) && held.catalogue.bundles.every((bundle) => !inYours(held, bundle) && !removing(bundle))) { keepRows("yours", 0); return [this.#oursUnread(), ...(queue === undefined ? (held.catalogue.oursRead === "failed" ? [] : none) : [queue])]; }
    const lists = YOURS_SHELVES[filter].map((shelf) => ({ shelf, items: this.#shown(mine(held, shelf, removing)).filter((item) => !isBundle(item) || !waiting(item)) })).filter((one) => one.items.length > 0);
    if (filter === "all" && this.#sought.trim() === "") keepRows("yours", lists.reduce((sum, one) => sum + one.items.length, 0));
    // Something is installed, so a filter that holds none of it draws no sentence: "nothing installed" would be false, and no search was typed to quote.
    if (lists.length === 0) return this.#sought.trim() === "" ? [this.#oursUnread(), queue] : [this.#nothing()];
    // How many have a new version is said atop the whole of Yours, after the queue, not over what a search left.
    return [this.#oursUnread(), queue, this.#sought.trim() === "" && held.member !== true && updatesLine(this.#updates()), ...this.#yoursShelves(lists)];
  }
  #yoursShelves(lists: readonly { readonly shelf: YoursShelf; readonly items: readonly Item[] }[]): readonly Child[] {
    return lists.map(({ shelf, items }) => h("section", { class: shelf === this.#landed?.shelf ? "pl-shelf pl-landed" : "pl-shelf", id: shelf === "models" ? "models" : undefined },
      h("div", { class: "pl-shelf-head" }, h("h2", {}, this.#say(`pl.shelf.${shelf}`), this.#held.catalogue.oursRead === undefined && h("span", { class: "count" }, String(items.length))),
        // Which vendors the card under the message box offers is chosen on the vendors' own page.
        shelf === "models" && this.#held.member !== true && h("a", { class: "pl-showall", href: href.models }, `${this.#say("pl.mo.chooseVendors")} ›`)),
      this.#fading(h("ul", { class: "pl-list pl-rows" }, ...items.map((item) => (isBundle(item) ? this.#bundleRow(item) : this.#row(item, shelf)))), shelf)));
  }


  /**
   * A bundle's row, one row's height in every state: its count is the members that are on, out of every member, or its size where all are
   * on (ruled 2026-11-13); ⋮ holds 移除. While its members' installs or removals are under way, it turns.
   */
  #bundleRow(bundle: Bundle): HTMLElement {
    const all = installsOf(this.#held, bundle);
    const on = all.filter((plugin) => installed(this.#held, plugin) && readsOn(this.#held, plugin));
    const busy = this.#doing.busy(bundle);
    const name = this.#name(bundle);
    return this.#drawRow(bundle, [], [`${this.#say("pl.by", { name: bundle.author })} · ${this.#words(bundle.about)}`],
      [h("span", { class: "pl-count" }, on.length === all.length ? this.#say("pl.members", { count: all.length }) : this.#say("pl.membersSome", { n: on.length, count: all.length })),
        busy !== undefined ? busyMark(this.ports.say, this.ports.language(), bundle, busy, "row") : this.#held.member === true ? [] : this.#moreOf(bundle, name)].flat());
  }

  /**
   * One row of 我的 (sheet 1, ruled 2026-11-13): its tile, its name, which is the link and covers the row, the marks after the name, one
   * line under it, and its end, one row's height whatever it holds. Nothing is drawn under a row: what a plugin lacks but a connection is
   * said on its own page, and a failed install or update is the queue's row.
   */
  #drawRow(item: Item, marks: readonly Child[], line: readonly Child[], end: readonly Child[]): HTMLElement {
    const name = h("span", { class: "pl-row-name" }, h("a", { class: "pl-row-link", href: href.item(item) }, h("strong", {}, this.#name(item))));
    return rowShell(tile(item, false, this.ports.language()), name, marks, line, end);
  }

  /** ⋮ at a row's end: its menu holds 移除, which asks the remove card as the record's own page does. */
  #moreOf(item: Item, name: string): readonly Child[] {
    const slot = `more ${href.item(item)}`;
    const { controls: [button, list], menu } = moreMenu(this.#say("pl.head.more"), this.#say("pl.head.remove"), () => { void remove(this.#cards(item), item); }, slot);
    this.#menus.set(slot, menu);
    const card = cardFor(this.#held, "remove", item);
    if (card !== undefined) (button as HTMLElement).setAttribute("data-card", card);
    (button as HTMLElement).setAttribute("aria-label", `${this.#say("pl.head.more")} ${name}`);
    return [button, list];
  }

  /**
   * A plugin row's head where the queue draws it: its tile, its name, which is the row's link, with the third party's mark or the missing
   * files' fact, and its line; the switch alone says whether it is on (sheet 1). A row of the queue carries no marks: what holds a plugin is said once it is installed.
   */
  #head(plugin: Plugin, focus: string): RowHead {
    return { tile: tile(plugin, false, this.ports.language()),
      name: h("span", { class: "pl-row-name" }, h("a", { class: "pl-row-link", href: href.item(plugin), "data-focus": focus }, h("strong", {}, this.#name(plugin))), ...this.#own(plugin, true)),
      line: this.#line(plugin) };
  }

  /** A row's line: who made it and its sentence; a model's 「{maker} 出品 · {vendor} 提供的模型。」. */
  #line(item: Item): string {
    const language = this.ports.language();
    if (!isBundle(item) && item.model !== undefined) return [this.#say("pl.by", { name: item.author === "" ? "ComChatX" : item.author }), this.#about(item)].join(" · ");
    return [isBundle(item) || !namesMaker(item, language) ? this.#byline(item) : "", this.#about(item)].filter((one) => one !== "").join(" · ");
  }

  /**
   * The marks after an installed plugin's name, on 我的 only: the held bundles it came with, and the installed plugins that cannot work
   * without it, each by a mark whose card names them.
   */
  #marks(plugin: Plugin): readonly Child[] {
    const comma = this.ports.language() === "zh" ? "、" : ", ";
    const colon = this.ports.language() === "zh" ? "：" : ": ";
    const bundles = cameWith(this.#held, plugin).map((bundle) => this.#name(bundle));
    const needers = this.#held.catalogue.plugins.filter((other) => other.id !== plugin.id && installed(this.#held, other) && other.builds.some((link) => link.on === plugin.id && link.need === "required")).map((other) => this.#name(other));
    return [bundles.length > 0 && rowMark("bundle", this.#say("pl.shelf.bundles"), bundles, comma, colon), needers.length > 0 && rowMark("needed", this.#say("pl.mark.usedBy"), needers, comma, colon)].filter((one): one is HTMLButtonElement => one !== false);
  }

  /**
   * A plugin's row: its name, how a model is reached (each way, in cx's order of use), 已关闭 and its two marks; its line, who made it and
   * its sentence, a model's 「{maker} 出品 · {vendor} 提供的模型。」, or, on and not connected, 「尚未连接。」 and the link to its Settings;
   * at its end this month's spend where the balance pays for it, 更新 where a new version waits, the switch and ⋮.
   */
  #row(plugin: Plugin, shelf: YoursShelf): HTMLElement {
    const held = this.#held;
    // A plugin listed on another's page that the queue holds is the queue's row; one not installed ends in + (sheet 3: one row everywhere).
    const queued = this.#unread ? undefined : installRow(this.#rows(), plugin);
    if (queued !== undefined) return queueRow(this.#queueContext(), queued);
    const has = installed(held, plugin);
    const say = this.ports.say;
    const language = this.ports.language();
    const model = modelOf(held, plugin);
    const month = plugin.source !== undefined ? sourceOf(held, plugin)?.month?.spent : model?.month;
    // A new version is Update at the row's end, left of the switch; a failed update is the queue's row.
    const member = held.member === true;
    const update = this.#unread || member ? undefined : rowUpdate(this.#updates(), plugin);
    const busy = this.#doing.busy(plugin);
    const name = this.#name(plugin);
    const ways = openingWays(held, plugin).map((way) => h("span", { class: "pl-tag" }, this.#say(wayWord(plugin, way))));
    const lacks = !this.#unread && needsOf(held, plugin).some((need) => need.kind === "connect");
    const line: readonly Child[] = lacks
      ? [h("span", { class: "pl-row-lack" }, say("pl.need.connect")), ...(member ? [] : [language === "zh" ? "" : " ", h("a", { class: "pl-row-connect f-link", href: `${href.item(plugin)}/settings` }, say("pl.need.connectAct", { name }))])]
      : [plugin.model !== undefined ? [say("pl.by", { name: plugin.author === "" ? "ComChatX" : plugin.author }), this.#about(plugin)].join(" · ")
        : [namesMaker(plugin, language) ? "" : this.#byline(plugin), this.#about(plugin)].filter((one) => one !== "").join(" · ")];
    // A source's month is what `/sources` says was spent at it, drawn for a source with a price; a model's month is its own read.
    const spend = (shelf === "models" || (shelf === "data" && sourceOf(held, plugin)?.unitsPerNative !== undefined)) && month !== undefined && this.#month(month);
    // A model has no switch: it is on while it is installed. A switch whose click is out turns its ring and takes no second change.
    // A member turns nothing: an installed plugin that is off says so where its switch would be.
    const turns = has && plugin.model === undefined && !this.#unread && !member;
    const on = readsOn(held, plugin);
    // After the write the keyboard is back on the switch it pressed, by the slot the switch carries.
    const slot = `switch ${href.item(plugin)}`;
    const toggle = turns && switchButton({ label: name, on, turn: (to) => { void (to ? turnOn(this.#cards(plugin, false, slot), plugin) : turnOff(this.#cards(plugin, false, slot), plugin)); } });
    if (toggle !== false) {
      toggle.element.setAttribute("data-focus", slot);
      // Its name says what is being done while the click is written down, as the record page's switch does.
      if (busy !== undefined && busy.act !== "update") { toggle.busy(true); toggle.element.setAttribute("aria-label", doingName(say, language, plugin, busy)); }
    }
    // Not installed, a removal cx's computer has not ended turns where + stands, as the bundle's head turns, until the list says it ended.
    const waits = has || this.#unread ? undefined : busy ?? this.#doing.pending(plugin);
    // A vendor the platform serves is installed by no route where vendors are not plugins: its row, as its head, holds no control.
    const plus = !has && !this.#unread && waits === undefined && (plugin.model === undefined || this.#features.modelPlugins) && (member ? h("span", { class: "quiet" }, say("pl.side.notInstalled")) : iconAct("plus", say("pl.installName", { name }), () => void this.#add(plugin), { focus: `act ${href.item(plugin)}` }));
    if (plus !== false && !member) { const card = cardFor(held, "install", plugin); if (card !== undefined) plus.setAttribute("data-card", card); }
    const ring = has ? busy : waits;
    return this.#drawRow(plugin, [...this.#own(plugin, true), ...ways, ...this.#marks(plugin)], line,
      [spend, update?.end, ring !== undefined && ring.act !== "update" && !turns && busyMark(say, language, plugin, ring, "row"), toggle !== false && toggle.element, member && has && plugin.model === undefined && !this.#unread && !on && h("span", { class: "quiet" }, say("pl.switch.off")), plus, ...(has && !member ? this.#moreOf(plugin, name) : [])]);
  }
}

/** A charge's record: a source by its name; a model by its maker's card, else, for a provider on no card (TypeSafe's), the one non-chat record its key reaches (Jev). */
const recordIn = (records: Held["catalogue"], kind: "source" | "vendor", id?: string): Plugin | undefined =>
  kind === "source" ? records.plugins.find((one) => one.source?.name === id)
    : id === undefined ? undefined
    : records.plugins.find((one) => one.model !== undefined && one.id === (PROVIDERS[id]?.card ?? cardWord(id)))
      ?? records.plugins.find((one) => one.model?.chat === false && one.model.keys.includes(id));

/** What the page says of a plugin beside its name where the person does not have it working: removed, off, or a model with no way connected. */
const stateOf = (held: Held, plugin: Plugin, say: (key: StringKey) => string): string | undefined =>
  !installed(held, plugin) ? say("pl.mp.removed") : !readsOn(held, plugin) ? say("pl.off")
    : plugin.model !== undefined && connectedWays(held, plugin).length === 0 ? say("pl.mp.notConnected") : undefined;

/**
 * Whether Discover's bar ends clear of the board button: once the page has scrolled and the bar's top stands within the band of the icon
 * row floating over the window's top (`.page-top`, beside the scroller), or with none floating, at the scroller's top. Self-contained,
 * so a real browser's witness runs it as the page does.
 */
export function clearsBoard(scroller: Element, bar: Element): boolean {
  if (scroller.scrollTop <= 0) return false;
  const top = scroller.getBoundingClientRect().top;
  const row = scroller.previousElementSibling;
  const icons = row !== null && row.classList.contains("floats") && !row.hasAttribute("hidden") ? row.querySelector(".page-icons:not([hidden])") : null;
  const band = icons === null ? top + 1 : Math.max(top + 1, icons.getBoundingClientRect().bottom);
  return bar.getBoundingClientRect().top <= band;
}
