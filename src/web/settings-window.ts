import { AccountPages, inviting, type ReadyPort } from "./account-pages.js";
import type { Appearance } from "./appearance.js";
import { isMember, type Backend, type Features, type Me } from "./backend.js";
import { fill, h } from "./dom.js";
import { CROSS, icon } from "./spend-chart.js";
import { scrimCloses, tip } from "./forms.js";
import { tie, writer } from "./settings-words.js";
import type { Language } from "./strings.js";
import type { Say } from "./stream-view.js";
import { BILLING_PAGES, BillingView, type BillingPage } from "./billing-page.js";
import { Paying } from "./paying.js";
import { UsagePage, type UsageRead } from "./usage-page.js";
import { OrgPage } from "./org-page.js";
import { MembersPage } from "./members-page.js";
import { ComputerSection, type Power } from "./computer-section.js";
import { bar, block, rowsFor, skeleton, type Twelfths, type Rows } from "./waiting.js";

type SignedIn = Extract<Me, { kind: "signed_in" }>;
/** How long the page under a closed window may take to draw, and draw again, where the keyboard lands. */
/** The window's sections, in the order its side lists them. */
export const SECTIONS = ["account", "general", "billing", "usage", "computer"] as const;
export type Section = (typeof SECTIONS)[number];
/**
 * Whose window it is: a person's 设置, or 组织设置, its peer, which an organization's admin opens for the organization the session has
 * active. The organization's 账单 and 用量 are the person's pages, reading the session's account, which is the organization's.
 */
export type WindowKind = "person" | "organization";
/** 组织设置's sections, in the order its side lists them. */
export const ORGANIZATION_SECTIONS = ["org", "members", "billing", "usage"] as const;
/** What the window shows: a section, or the invitation sheet, the window without its side. */
export type Place = Section | "org" | "members" | "invite";
/** Where each window's addresses start. */
export const PREFIX: Readonly<Record<WindowKind, string>> = { person: "#/settings", organization: "#/organization" };
/** The addresses of the sections a section took the place of: the old settings page's parts and the window's old sections keep reaching the window. */
const SECTION_OF: Readonly<Record<string, Section>> = {
  account: "account", general: "general", language: "general", appearance: "general", notifications: "general", billing: "billing", balance: "billing", usage: "usage", spending: "usage", computer: "computer",
};
/** The old 条款's parts, at the page of 账单 whose rules each held; a part no page of 账单 linked to, and 条款 itself, reach 通用. */
const TERMS_FROM: Readonly<Record<string, BillingPage | "billing">> = { lots: "top-up", plan: "subscribe", cancel: "billing" };
export const SHEET = "#/invite";

/**
 * What a history entry of the window holds: the page under it, and whether the window's own opening made the entry, so closing takes
 * that step back. A window reached by its address made none, and closing rewrites its entry to the page under it.
 */
export type WindowEntry = { readonly settingsWindow: { readonly under: string; readonly stepped: boolean } };
const entryOf = (state: unknown): WindowEntry["settingsWindow"] | undefined => {
  const held = (state as Partial<WindowEntry> | null)?.settingsWindow;
  return typeof held?.under === "string" && typeof held.stepped === "boolean" ? held : undefined;
};
const ADDRESS: Readonly<Record<WindowKind, RegExp>> = {
  person: /^#\/settings(?:\/([a-z-]+)(?:\/([a-z-]+))?)?\/?$/, organization: /^#\/organization(?:\/([a-z-]+)(?:\/([a-z-]+))?)?\/?$/,
};

/** Whether an address is the person's window: a section, or the invitation sheet. */
export const windowAddress = (hash: string): boolean => hash.startsWith(PREFIX.person) || hash === SHEET;
/** Whether an address is 组织设置's. */
export const organizationAddress = (hash: string): boolean => ADDRESS.organization.test(hash);
/**
 * The section an address names: the window's own address, and a part the window does not know, the first; the sheet's own address, the
 * sheet, which the person's window alone holds.
 */
export function sectionOf(hash: string, kind: WindowKind = "person"): Place | undefined {
  if (kind === "person" && hash === SHEET) return "invite";
  const got = ADDRESS[kind].exec(hash);
  if (got === null) return undefined;
  if (kind === "organization") return ORGANIZATION_SECTIONS.find((one) => one === got[1]) ?? ORGANIZATION_SECTIONS[0];
  if (got[1] === "terms") return got[2] !== undefined && Object.hasOwn(TERMS_FROM, got[2]) ? "billing" : "general";
  return got[1] === undefined ? SECTIONS[0] : SECTION_OF[got[1]] ?? SECTIONS[0];
}
/** The page inside 账单 an address names, 充值 or 订阅; none for the section itself. */
export function pageOf(hash: string, kind: WindowKind = "person"): BillingPage | undefined {
  const got = ADDRESS[kind].exec(hash);
  if (got === null || sectionOf(hash, kind) !== "billing") return undefined;
  const named = got[1] === "terms" ? TERMS_FROM[got[2]!] : got[2];
  return BILLING_PAGES.find((one) => one === named);
}
/** The span an address opens 用量 on: `#/settings/usage/month` is 本月, which the computer's window links to; none for any other. */
export function spanOf(hash: string, kind: WindowKind = "person"): "month" | undefined {
  const got = ADDRESS[kind].exec(hash);
  return got !== null && sectionOf(hash, kind) === "usage" && got[2] === "month" ? "month" : undefined;
}
/** The row an address opens 「cx 的电脑」 at, which the computer's window links its parts to; none for the section itself. */
export function rowOf(hash: string): "size" | "storage" | undefined {
  const got = ADDRESS.person.exec(hash);
  return got !== null && sectionOf(hash) === "computer" && (got[2] === "size" || got[2] === "storage") ? got[2] : undefined;
}
/** The page a window is drawn over: the one its entry remembers, else the chat. Never a window itself. */
export function underOf(state: unknown): string {
  const under = entryOf(state)?.under;
  return under === undefined || windowAddress(under) || organizationAddress(under) ? "#/" : under;
}

export type WindowPorts = {
  readonly backend: Backend; readonly say: Say; readonly language: () => Language; readonly features: () => Features;
  readonly me: () => SignedIn | undefined;
  /** Where cx's computer stands as the app has it. */
  readonly power: () => Power;
  /** Whether 「cx 的电脑」 is shown: while it is and the computer is on, the page reads the processor and the memory again. */
  readonly watch?: (on: boolean) => void;
  readonly setLanguage: (language: Language) => void;
  readonly appearance: () => Appearance; readonly setAppearance: (appearance: Appearance) => void;
  readonly ready: ReadyPort;
  readonly signOutEverywhere: () => Promise<unknown>;
  /** This browser signs out, as the account menu's 退出登录 does. */
  readonly signOutHere: () => Promise<unknown>;
  /** A name saved in 账户, or its photo changed: the corner draws what the account holds now. */
  readonly changed: (name?: string) => void;
  /** The account's deletion was asked for. */
  readonly deleted: () => void;
  /** Whose window this is; a person's where none is named. */
  readonly kind?: WindowKind;
  /** 组织设置's organization was deleted: the page goes back to the person's own account. */
  readonly organizationDeleted?: (name: string) => void;
  /** The plans page, which 调整方案 on a person's 账单 opens; none where the page has no such page. */
  readonly plans?: () => void;
  readonly plugin: (kind: "vendor" | "source", id: string) => { readonly href: string; readonly name: string } | undefined;
  /** What the rest of the app calls a thing a line spent on, where no record page names it. */
  readonly name?: (kind: "vendor" | "source", id: string) => string | undefined;
  /** What the Plugins page says beside each plugin's name, read afresh at the opening. */
  readonly states: () => Promise<(kind: "vendor" | "source", id: string) => string | undefined>;
  /** The page moved: it draws what the address now holds. */
  readonly moved: () => void;
  /** Where the window is put: the page it stands over. A page taken down takes its window with it. */
  readonly home: HTMLElement;
  /** Where the keyboard goes back to when what opened the window no longer stands: the account button, or the sidebar's opener where the sidebar is folded away. */
  readonly returnTo: () => HTMLElement | undefined;
  readonly history?: History;
  /** Where a payment waiting on the ledger is kept for the tab; the browser's session storage where none is given. */
  readonly paying?: Paying;
  /** A payment the ledger has: the page behind the window reads the account again and draws what it holds. */
  readonly credited?: () => void;
};
/** A card or Alipay payment lands within seconds of its answer: the window reads again at this pace until the ledger has it. */
export const PAYING_READ_MS = 5_000;
/** A status emptied and then written a moment later is heard as a change. */
const HEARD_MS = 120;
/** How long a line said to a screen reader stays before it is taken away, as the page's own (`app.ts`). */
const HEARD_FOR_MS = 1500;

/** A settings row not read yet: its label, its help, and the control at its end. */
const rowShape = (label: Twelfths, help: Twelfths | undefined): HTMLElement => h("li", { class: "sw-row" },
  h("div", { class: "sw-text" }, h("p", { class: "sw-label" }, bar(label)), help !== undefined && h("p", { class: "sw-help" }, bar(help, "small"))), h("div", { class: "sw-ctl" }, bar("word")));
/** A group of rows not read yet, under its heading. */
const groupShape = (rows: readonly (readonly [Twelfths, Twelfths | undefined])[]): HTMLElement => h("section", { class: "sw-group" },
  h("div", { class: "sw-head" }, h("div", {}, bar("word"))), h("ul", { class: "sw-rows" }, ...rows.map(([label, help]) => rowShape(label, help))));
/** A list's group not read yet: as many rows as this browser drew there last, and no group where it drew none. */
const listShape = (list: Rows): HTMLElement | undefined => {
  const rows = rowsFor(list);
  return rows === 0 ? undefined : groupShape(Array.from({ length: rows }, () => [4, 5] as const));
};
/** The balance at a page's top, not read yet: its name and its figure. */
const topShape = (): HTMLElement => h("div", { class: "sw-top opens" }, h("p", {}, bar(2, "small")), h("div", { class: "sw-top-line" }, h("p", { class: "sw-figure" }, bar("word", "display"))));

/** What a section of the window draws while its reads are out: its own frame, its groups and rows as they stand once read. */
function paneShape(section: Place, page: BillingPage | undefined, word: string): HTMLElement {
  switch (section) {
    case "account": return skeleton(word, groupShape([[2, 7], [4, undefined]]), groupShape([[6, 4], [6, 4], [6, 4]]), groupShape([[8, undefined]]));
    case "general": return skeleton(word, groupShape([[3, 7]]), groupShape([[2, 6]]), groupShape([[3, 5], [4, undefined]]));
    case "usage": return skeleton(word, topShape(), groupShape([[4, 3]]),
      h("section", { class: "sw-group" }, h("div", { class: "sw-head" }, h("div", {}, bar("word")), h("div", { class: "sw-ctl" }, bar("word"))),
        h("div", { class: "sw-sum" }, h("div", {}, h("p", {}, bar("word", "small")), h("p", { class: "sw-figure month" }, bar("word", "title")))), h("div", { class: "sw-chart" }, h("span", {}), block(h("div", { class: "sw-plot" })))));
    case "billing": return page === "top-up" || page === "subscribe"
      ? skeleton(word, h("div", { class: "sw-title-line" }, h("div", { class: "sw-title" }, bar("word", "title"))), groupShape([[4, 7], [4, 7], [4, 7]]))
      : skeleton(word, topShape(), groupShape([[4, 8], [3, undefined]]), groupShape([[4, 6], [5, undefined]]), listShape("payments"));
    case "org": return skeleton(word, groupShape([[4, undefined]]), groupShape([[3, 6]]), groupShape([[8, undefined]]));
    case "members": return skeleton(word, groupShape([[6, 3], [6, 3]]));
    case "computer": return skeleton(word, h("section", { class: "sw-group cz-loads" }, h("div", {}, bar("word")), h("div", { class: "cz-load-grid" }, ...[0, 1, 2].map(() => block(h("div", { class: "cz-load f-card" }))))), groupShape([[2, 6], [2, 10]]));
    case "invite": return skeleton(word, h("div", { class: "sw-title" }, bar(4, "title")), h("p", { class: "sw-help" }, bar(12, "small"), bar(8, "small")), groupShape([[5, 7], [4, undefined]]), listShape("invited"));
  }
}

/** A read of the window's: each of the account's own, a payment's answer, the cards and payments, the invitations. */
type Read = UsageRead | "settle" | "billing" | "invitations" | "devices" | "computer" | "members";
/**
 * What a section draws from: it stands as its shape until these answer. 通用 draws at once; 账户 waits for its devices and for what
 * holds its deletion, and its Delete question reads the balance. 账单 draws no spending and no record, which are 用量's.
 */
const NEEDS: Readonly<Record<Place, readonly Read[]>> = {
  account: ["money", "subscription", "devices"],
  general: [],
  // 组织 draws the organization from the opening's own read of `/me`, names the balance its deletion takes, and a seat's price in its step.
  org: ["me", "money", "terms"],
  // 成员 draws the provider's members and invitations; 添加成员's seats are priced with the period's last day and a seat's price.
  members: ["me", "money", "terms", "members"],
  usage: ["money", "me", "subscription", "record", "spending", "models", "terms", "settle", "invitations"],
  billing: ["money", "me", "subscription", "models", "terms", "settle", "billing"],
  invite: ["money", "subscription", "terms", "invitations"],
  computer: ["me", "computer"],
};

/**
 * Settings as a window over the page: the sections down its side, a close mark in a band of its own, and the section's pane. Each opening
 * is its own history entry over the page it was opened from, and reads the account afresh; a section chosen inside it takes the entry's
 * place. Closing takes the opening's step back, so Back and the close mark land on the same page.
 */
export class SettingsWindow {
  readonly element: HTMLDialogElement;
  readonly #nav = h("nav", { class: "sw-nav" });
  readonly #pane = h("div", { class: "sw-pane", role: "region", tabindex: "-1" });
  readonly #close: HTMLButtonElement;
  /** What a screen reader hears of a change the pane shows and says nothing of: a photo kept or removed, a device signed out. */
  readonly #heard = h("p", { class: "sw-hidden", role: "status", "aria-live": "polite", "data-key": "heard" });
  /** The name 账户 last saved, which the session's token carries only from its next renewal. */
  #named: string | undefined;
  readonly #side: HTMLElement;
  readonly #usage: UsagePage;
  readonly #computer: ComputerSection;
  readonly #billing: BillingView;
  readonly #account: AccountPages;
  readonly #org: OrgPage;
  readonly #members: MembersPage;
  readonly paying: Paying;
  #section: Place | undefined;
  #page: BillingPage | undefined;
  /** The opening's reads, each started when a section that draws it is first shown and kept for the window's life. */
  readonly #reads = new Map<Read, Promise<void>>();
  /** The opening's reads that have answered. */
  readonly #done = new Set<Read>();
  /** The window was opened from the page, not come back to by Back or Forward. */
  #fresh = false;
  /** The account as the page last read it while 「cx 的电脑」 is shown, newer than the opening's own read. */
  #watched: SignedIn | undefined;
  #power: Power | undefined;
  /** Where the keyboard lands after a move the window made: a page asked for from the pane lands on the pane; anything else, on the section's link. */
  #landing: "pane" | undefined;
  /** Where the window was when it was last closed: come back to, it is there still. */
  #left: { readonly section: Place; readonly page: string | undefined; readonly top: number } | undefined;
  /** The page of the window the sheet was opened from: closing the sheet goes back to it. */
  #sheetBack: string | undefined;
  /** What the keyboard was on when the window opened, and the page it opened over. */
  #openedFrom: { readonly by: Element | null; readonly heading: boolean; readonly under: string } | undefined;
  /** The address of the line whose own click or Enter is closing the window, onto that line's page. */
  #followed: string | undefined;
  /** Every string the window draws, written once: a Chinese line keeps a figure, a name and an amount with the words beside them. */
  readonly #say: Say;
  /** The next read of the account while a payment's answer stands. */
  #payingRead: ReturnType<typeof setTimeout> | undefined;

  constructor(readonly ports: WindowPorts) {
    this.#say = (key, values) => tie(ports.language(), ports.say(key, values));
    // Over the close stands the section's own words, so its tip stands beside it.
    this.#close = tip(h("button", { type: "button", class: "sw-close", "data-key": "close", onclick: () => this.shut() }, icon(CROSS)), () => [this.#close.getAttribute("aria-label") ?? ""], { at: "beside" });
    this.#side = h("div", { class: "sw-side" }, h("div", { class: "sw-band" }, this.#close), this.#pane);
    this.element = h("dialog", { class: "sw", "aria-labelledby": this.#id("name") }, this.#nav, this.#side, this.#heard);
    this.#nav.setAttribute("aria-labelledby", this.#id("name"));
    this.paying = ports.paying ?? new Paying(globalThis.sessionStorage, ports.credited, () => ports.me()?.account);
    const redraw = (key?: string, reveal?: boolean): void => this.#redraw(key, reveal);
    this.#usage = new UsagePage({ backend: ports.backend, say: this.#say, features: ports.features, plugin: ports.plugin, ...(ports.name === undefined ? {} : { name: ports.name }), states: ports.states, paying: this.paying, redraw, inviting: () => this.#inviting, shown: () => this.element.open && this.#section === "usage" });
    this.#computer = new ComputerSection({ backend: ports.backend, say: this.#say, me: () => this.#watched ?? this.#usage.reads?.me, power: ports.power, now: () => ports.backend.now(), redraw,
      shown: () => this.element.open && this.#section === "computer" });
    this.#billing = new BillingView({ backend: ports.backend, say: this.#say, features: ports.features, paying: this.paying, reads: () => this.#usage.reads, redraw, home: () => this.element, base: this.#base,
      ...(this.#kind === "organization" ? { organization: () => ({ seats: this.#usage.reads?.me?.organization?.seats, name: this.#usage.reads?.me?.organization?.name }),
        seats: { ask: (w, at) => this.#org.askSeats(w, at), lead: (w) => this.#org.paidLead(w) } } : ports.plans === undefined ? {} : { plans: ports.plans }),
      reread: async () => { if (await this.#reread()) this.#readWhilePaying(); },
      go: (hash) => this.#go(hash, "pane") });
    this.#account = new AccountPages({ backend: ports.backend, say: this.#say, language: ports.language, appearance: ports.appearance, ready: ports.ready, paying: this.paying, redraw,
      email: () => ports.me()?.email, member: () => isMember(ports.me()), reads: () => this.#usage.reads,
      money: () => this.#need("money").then(() => this.#usage.reads?.money), signOutEverywhere: ports.signOutEverywhere, signOutHere: ports.signOutHere,
      deleted: ports.deleted, home: () => this.element, history: () => this.#history,
      name: () => this.#named ?? ports.me()?.name,
      changed: (name) => { if (name !== undefined) this.#named = name; ports.changed(name); },
      // Said once and taken away again, so a reader that walks the window later meets no stale line.
      hear: (words) => {
        this.#heard.textContent = "";
        setTimeout(() => { this.#heard.textContent = words; setTimeout(() => { if (this.#heard.textContent === words) this.#heard.textContent = ""; }, HEARD_FOR_MS); }, HEARD_MS);
      },
      subscribable: () => this.#billing.offered().includes("subscribe"), go: (hash) => this.#go(hash, "pane"),
      setLanguage: (language) => { ports.setLanguage(language); this.#drawNav(); this.#redraw(`lang:${language}`); },
      setAppearance: (appearance) => { ports.setAppearance(appearance); this.#redraw(`look:${appearance}`); } });
    this.#org = new OrgPage({ backend: ports.backend, say: this.#say, redraw, home: () => this.element, base: this.#base,
      organization: () => this.#usage.reads?.me?.organization, figure: () => this.#usage.reads?.money?.figure,
      updateCard: (from) => this.#billing.updateCard(from), cardSaid: (at) => this.#billing.cardSaid(at),
      seatPrice: () => this.#usage.reads?.terms?.seat_price, lastDay: () => this.#usage.reads?.money?.member?.last_day,
      buy: (n, w, back, paid) => this.#billing.buySeats(n, w, { price: this.#usage.reads?.terms?.seat_price, back, paid }),
      reread: async () => { await this.#reread(); }, go: (hash) => this.#go(hash, "pane"), deleted: (name) => ports.organizationDeleted?.(name) });
    this.#members = new MembersPage({ backend: ports.backend, say: this.#say, redraw, home: () => this.element, history: () => this.#history,
      organization: () => this.#usage.reads?.me?.organization,
      price: () => this.#usage.reads?.terms?.seat_price, lastDay: () => this.#usage.reads?.money?.member?.last_day,
      reread: async () => { await this.#reread(); }, toCard: () => this.#go(`${this.#base}/billing`, "pane") });
    this.#pane.addEventListener("scroll", () => this.#side.classList.toggle("scrolled", this.#pane.scrollTop > 0));
    // Escape closes the window, as a press on the dimmed page does: an open menu takes its own Escape first.
    // The window's own cancel, Escape, shuts it; a file picker's cancel bubbles here too, and is the picker's alone.
    this.element.addEventListener("cancel", (event) => { if (event.target !== this.element) return; event.preventDefault(); this.shut(); });
    scrimCloses(this.element, () => this.shut());
    this.element.addEventListener("click", (event) => {
      const away = (event.target as Element).closest?.<HTMLAnchorElement>(`a[href^='#/']:not([href^='${this.#base}'])`);
      if (away !== null && away !== undefined && this.#pane.contains(away)) this.#followed = away.getAttribute("href") ?? undefined;
      // A section, a page or the sheet chosen inside the window takes its entry's place: Back still leaves the window.
      const link = (event.target as Element).closest?.<HTMLAnchorElement>(`a[href^='${this.#base}'], a[href='${SHEET}']`);
      if (link === null || link === undefined || event.defaultPrevented) return;
      event.preventDefault();
      const href = link.getAttribute("href")!;
      const side = this.#nav.contains(link);
      if (href === SHEET && this.#section !== "invite") this.#sheetBack = location.hash;
      this.#go(href, side ? undefined : "pane");
    });
  }

  /** Any move inside the open window takes its entry's place: the window stays one step, and Back or the close mark leaves it from any page. */
  #go(hash: string, landing?: "pane"): void {
    this.#landing = landing;
    this.#history.replaceState(this.#history.state, "", hash);
    this.ports.moved();
  }

  get #kind(): WindowKind { return this.ports.kind ?? "person"; }
  /** Where this window's addresses start. */
  get #base(): string { return PREFIX[this.#kind]; }
  /** The two windows can both stand in the page, one hidden: each names its own heading and links, so each id answers to one element. */
  #id(of: string): string { return `${this.#kind === "organization" ? "osw" : "sw"}-${of}`; }
  get #sections(): readonly Place[] { return this.#kind === "organization" ? ORGANIZATION_SECTIONS : SECTIONS; }

  get #inviting(): boolean { return inviting(this.#usage.reads?.money); }

  get #history(): History { return this.ports.history ?? globalThis.history; }
  get opened(): boolean { return this.element.open; }

  /** The window stands at a section, whether or not the browser has already closed its dialog on Escape. */
  get showing(): boolean { return this.#section !== undefined; }
  /** The opening's reads, for what is drawn from them. */
  get usage(): UsagePage { return this.#usage; }

  /** Opens the window over the page the address holds now, as an entry of its own. */
  open(hash = `${this.#base}/${this.#sections[0]}`): void {
    const under = windowAddress(location.hash) || organizationAddress(location.hash) ? underOf(this.#history.state) : location.hash === "" ? "#/" : location.hash;
    this.#fresh = true;
    this.#sheetBack = undefined;
    this.#history.pushState({ settingsWindow: { under, stepped: true } } satisfies WindowEntry, "", hash);
    this.ports.moved();
  }

  /**
   * Closing takes back the step that opening made; a window opened by its address made none, and rewrites its own entry. The sheet
   * opened from a page of the window closes back onto that page, in the entry's place.
   */
  shut(): void {
    if (!this.element.open) return;
    if (this.#section === "invite" && this.#sheetBack !== undefined) { const back = this.#sheetBack; this.#sheetBack = undefined; this.#go(back, "pane"); return; }
    const entry = entryOf(this.#history.state);
    if (entry?.stepped === true) { this.#history.back(); return; }
    this.#history.replaceState(null, "", underOf(this.#history.state));
    this.ports.moved();
  }

  /** The sheet is for an account it can serve: any other is shown the page under the window. */
  #refuseSheet(): void {
    this.#history.replaceState(null, "", underOf(this.#history.state));
    this.ports.moved();
  }

  /**
   * The window as the address holds it: drawn, at the section it names, where it names one, and gone where it does not. Coming to an
   * entry of the window is an opening, and an opening reads the account afresh before its pane is drawn.
   */
  /** The page read the account again while 「cx 的电脑」 is shown: its readings are drawn from that answer. */
  watched(me: SignedIn): void {
    this.#watched = me;
    this.#redrawComputer();
  }

  /**
   * The page heard the visit change: where the computer's power changed, 「cx 的电脑」 is drawn again from what it holds, with no read.
   * One not on keeps no processor's or memory's reading, as the computer's window keeps none, so one on again shows none until the beat reads.
   */
  followPower(): void {
    const power = this.ports.power(), was = this.#power;
    this.#power = power;
    if (was === power) return;
    const held = this.#watched ?? this.#usage.reads?.me;
    if (power !== "on" && held?.parts !== undefined) { const { cpu: _cpu, memory: _memory, ...kept } = held.parts; this.#watched = { ...held, parts: kept }; }
    this.#redrawComputer();
  }

  /** 「cx 的电脑」 drawn again where it stands; a change of size asked in its step keeps the cards it was asked from, so the keyboard returns to the one pressed. */
  #redrawComputer(): void {
    if (this.element.open && this.#section === "computer" && this.#ready("computer") && this.element.querySelector("dialog.cz-step[open]") === null) this.#redraw();
  }

  async show(section: Place | undefined): Promise<void> {
    if (section === undefined) {
      // The browser may close the dialog on Escape before Back lands: what the window was showing says it stood.
      const was = this.#section;
      // A closed dialog's pane is laid out no more, and reads no scroll: its place is read while it stands.
      const top = this.#pane.scrollTop;
      this.#section = undefined;
      this.ports.watch?.(false);
      // A step asks within the window: the window gone, its question goes with it, answered by nothing.
      for (const step of this.element.querySelectorAll<HTMLDialogElement>(":scope > dialog.f-dialog:not(.sw-card)")) { step.close(); step.remove(); }
      clearTimeout(this.#payingRead);
      this.#payingRead = undefined;
      if (this.element.open) this.element.close();
      // A closed window keeps nothing in the document: the other window's panes draw the same ids, and each id answers to one element.
      this.element.remove();
      if (was === undefined) return;
      // The opening ends with the window, and the next opening reads afresh; an answer still out lands where it arrives.
      this.#reads.clear();
      this.#done.clear();
      this.#account.end();
      this.#usage.end();
      this.#left = { section: was, page: this.#page, top };
      const from = this.#openedFrom, followed = this.#followed;
      this.#openedFrom = undefined;
      this.#followed = undefined;
      // A line followed lands on its page's heading; any other close, Back, Forward or an address typed, goes back to what opened the window.
      if (followed !== undefined && location.hash === followed) this.#land(() => { const heading = this.#heading(); this.#gaveHeading = heading; return heading; });
      else this.#land(() => this.#opener(from));
      return;
    }
    // A page taken down took its window with it: what the address now holds is another page's to draw.
    if (!this.ports.home.isConnected) { this.#section = undefined; return; }
    // An entry reached without its state — typed, or opened from a link — remembers the chat under it, and is an opening from the page.
    const stateless = entryOf(this.#history.state) === undefined;
    if (stateless) this.#history.replaceState({ settingsWindow: { under: "#/", stepped: false } } satisfies WindowEntry, "");
    const opening = !this.element.open;
    const named = section === "billing" ? pageOf(location.hash, this.#kind) : undefined;
    const page = !opening && this.#ready("billing") ? this.#offered(named) : named;
    const was = this.#section;
    const changed = was !== section, moved = changed || this.#page !== page;
    this.#section = section;
    this.#page = page;
    if (section !== "invite") this.#sheetBack = undefined;
    this.element.classList.toggle("sheet", section === "invite");
    if (opening) {
      this.#followed = undefined;
      const by = document.activeElement === document.body ? null : document.activeElement;
      const given = by !== null && by === this.#gaveHeading;
      this.#gaveHeading = undefined;
      this.#openedFrom = given ? { by: null, heading: false, under: underOf(this.#history.state) }
        : { by, heading: by?.tagName === "H1" && by.closest("main") !== null, under: underOf(this.#history.state) };
      if (this.element.parentElement === null) this.ports.home.append(this.element);
      this.#drawNav();
      this.element.showModal();
      this.#reads.clear();
      this.#done.clear();
      this.#account.begin();
      this.#org.begin();
      this.#members.begin();
      this.#computer.begin();
      this.#watched = undefined;
      this.paying.moved();
      this.paying.opened();
      const left = this.#fresh || stateless || this.#left?.section !== section || this.#left.page !== page ? undefined : this.#left;
      this.#fresh = false;
      // An address that names 本月 opens 用量 on it, from wherever the window was left.
      const span = spanOf(location.hash, this.#kind);
      this.#usage.begin(left === undefined || span !== undefined, span);
      // A payment's answer is read whichever section the window opens on: it may move the window to the page the payment was asked from.
      if (this.paying.holding) void this.#need("settle");
      // The keyboard starts on the open section's name in the side, and Tab goes on into the pane; the sheet starts on what it is for.
      this.#enter(section, () => {
        this.#pane.scrollTop = left?.top ?? 0;
        this.#side.classList.toggle("scrolled", this.#pane.scrollTop > 0);
        const row = rowOf(location.hash);
        if (row !== undefined) this.#computer.land(this.#pane, row);
        else (section === "invite" ? this.#sheetStart() : this.#nav.querySelector<HTMLElement>("[aria-current='page']"))?.focus({ preventScroll: true });
      });
      return;
    }
    // While its reads are out, whether the account is offered the sheet is not known yet: it is judged when they are in.
    if (section === "invite" && this.#ready("invite") && !this.#inviting) { this.#refuseSheet(); return; }
    // A page that gave way to 账单 — 订阅 once the membership is paid — leaves the keyboard on the pane, whichever draw meets it first.
    const landing = this.#landing ?? (named !== page ? "pane" : undefined);
    this.#landing = undefined;
    if (!moved) return;
    this.#billing.forget();
    this.paying.moved();
    if (changed) this.#usage.leave();
    this.#drawNav();
    this.#enter(section, () => {
      this.#pane.scrollTop = 0;
      // Closing the sheet lands on the link it was opened from.
      const from = was === "invite" ? this.#pane.querySelector<HTMLElement>("[data-key='to-invite']") : null;
      const row = rowOf(location.hash);
      if (row !== undefined) { this.#computer.land(this.#pane, row); return; }
      (section === "invite" ? this.#sheetStart() : from ?? (landing === "pane" ? this.#pane : this.#nav.querySelector<HTMLElement>("[aria-current='page']")))?.focus({ preventScroll: true });
    });
  }

  /** Whether what a section draws from has answered. */
  #ready(section: Place): boolean { return NEEDS[section].every((read) => this.#done.has(read)); }

  /** A read of this opening's, started once and kept: a section that needs what another already read does not read it again. */
  #need(read: Read): Promise<void> {
    const held = this.#reads.get(read);
    if (held !== undefined) return held;
    const started = ((): Promise<unknown> => {
      switch (read) {
        // A payment's answer is weighed against the money the window read, and may send the window to the page it was asked from.
        // A window closed by the time its money answers starts no settlement.
        case "settle": return this.#need("money").then(() => (this.element.open ? this.paying.settle(this.ports.backend, this.#usage.reads?.money) : undefined)).then((unpaid) => {
          if (!this.element.open) return;
          if (unpaid !== undefined) this.#go(`${this.#base}/billing/${unpaid}`);
          this.#readWhilePaying();
        });
        case "billing": return this.#billing.open();
        case "invitations": return this.#account.readInvitations();
        case "devices": return this.#account.readDevices();
        case "computer": return this.#computer.read();
        case "members": return this.#members.read();
        default: return this.#usage.read(read);
      }
    })();
    const kept = started.then(() => { this.#done.add(read); }, () => undefined);
    this.#reads.set(read, kept);
    return kept;
  }

  /**
   * The section shown: drawn at once from what the opening has read, or its shape while what it draws from is out, and drawn when that
   * answers if the window still shows it. `arrived` puts the keyboard and the view where the section's drawing leaves them.
   */
  #enter(section: Place, arrived: () => void): void {
    // Leaving 「cx 的电脑」 ends its claim on the beat as it is left, not when the next section has read.
    if (section !== "computer") this.ports.watch?.(false);
    const arrive = (): void => {
      if (section === "invite" && !this.#inviting) { this.#refuseSheet(); return; }
      if (section === "billing") this.#page = this.#offered(this.#page);
      this.ports.watch?.(section === "computer");
      this.#drawPane();
      arrived();
    };
    const reading = this.#ready(section) ? undefined : Promise.all(NEEDS[section].map((read) => this.#need(read)));
    // 用量's words beside each plugin, the Plugins page's whole reads, come in on their own once 用量 is shown.
    if (section === "usage") this.#usage.readStates();
    if (reading === undefined) { arrive(); return; }
    fill(this.#pane, paneShape(section, this.#page, this.#say("stream.loading")));
    void reading.then(() => {
      if (this.element.open && this.#section === section) arrive();
    });
  }

  /** The sheet opens on what it is for: the link to copy, or 订阅 on a free account's card; else on its close mark. */
  #sheetStart(): HTMLElement { return this.#pane.querySelector<HTMLElement>("[data-key='copy-link'], [data-key='subscribe']") ?? this.#close; }
  /**
   * While a payment's answer stands the open window reads the account again on its own, so the figure moves in front of the seller and
   * the answer turns to what arrived; it stops once the ledger has the payment or the window closes.
   */
  #readWhilePaying(): void {
    if (this.#payingRead !== undefined || !this.element.open || !this.paying.waiting) return;
    this.#payingRead = setTimeout(() => {
      void (async () => {
        if (!await this.#reread()) return;
        this.#payingRead = undefined;
        this.#redraw();
        this.#readWhilePaying();
      })();
    }, PAYING_READ_MS);
  }

  /**
   * The account, the cards and the payments read again, then the payment's answer settled with the money it read: each step only while
   * the window is open. Whether it still is when they are done.
   */
  async #reread(): Promise<boolean> {
    await this.#usage.reread();
    if (!this.element.open) return false;
    await this.#billing.reread();
    if (!this.element.open) return false;
    await this.paying.settle(this.ports.backend, this.#usage.reads?.money);
    return this.element.open;
  }

  /** A page the account is not offered gives way to 账单, and the address is rewritten to say so. */
  #offered(page: BillingPage | undefined): BillingPage | undefined {
    if (page === undefined || this.#billing.offered().includes(page)) return page;
    this.#history.replaceState(this.#history.state, "", `${this.#base}/billing`);
    return undefined;
  }

  /** The opening control where it still stands, else where the page says the keyboard goes back to. */
  #opener(from: { readonly by: Element | null; readonly heading: boolean } | undefined): HTMLElement | undefined {
    const stands = (one: Element | null | undefined): one is HTMLElement => one instanceof HTMLElement && one.isConnected && one.closest("[hidden]") === null && !this.element.contains(one);
    if (stands(from?.by)) return from.by;
    // A page's heading drawn again is that page's heading still: the keyboard stood on it, and goes back to it.
    if (from?.heading === true) return this.#heading() ?? this.ports.returnTo();
    return this.ports.returnTo();
  }
  /** The arriving page's heading, made focusable for it. */
  #heading(): HTMLElement | undefined {
    const heading = [...this.ports.home.querySelectorAll<HTMLElement>("main h1")].find((one) => !this.element.contains(one));
    if (heading !== undefined) heading.tabIndex = -1;
    return heading;
  }
  /** The heading the window gave the keyboard as a followed line landed: what opened the window before stays the opener. */
  #gaveHeading: Element | undefined;

  /** The keyboard goes where `find` says once the window has closed: given back once. */
  #land(find: () => HTMLElement | undefined): void {
    queueMicrotask(() => { if (!this.element.open && this.ports.home.isConnected) find()?.focus({ preventScroll: true }); });
  }

  #drawNav(): void {
    const say = this.#say;
    const organization = this.#kind === "organization";
    const close = say(this.#section === "invite" ? "sw.closeSheet" : organization ? "osw.close" : "sw.close");
    this.#close.setAttribute("aria-label", close);
    fill(this.#nav, h("h2", { class: "sw-name", id: this.#id("name") }, say(organization ? "osw.title" : "sw.title")),
      ...this.#sections.map((id) => h("a", { href: `${this.#base}/${id}`, id: this.#id(`link-${id}`), "aria-current": id === this.#section ? "page" : undefined, "data-key": `nav:${id}` },
        say(id === "org" ? "osw.sec.org" : id === "members" ? "osw.sec.members" : `sw.sec.${id as Section}`))));
    // As a sheet the window is named by the sheet's title alone: a name from the hidden side's 设置 would outrank it.
    if (this.#section === "invite") { this.element.removeAttribute("aria-labelledby"); this.element.setAttribute("aria-label", say("sw.invite")); }
    else { this.element.removeAttribute("aria-label"); this.element.setAttribute("aria-labelledby", this.#id("name")); }
  }

  #drawPane(): void {
    const me = this.ports.me();
    const section = this.#section;
    // A section stands as its shape until what it draws from has answered: a read answering for another section draws nothing here.
    if (me === undefined || section === undefined || !this.#ready(section)) return;
    const now = new Date(this.ports.backend.now());
    const w = writer({ language: this.ports.language(), say: this.#say, money: me.money, year: now.getFullYear() });
    this.#pane.setAttribute("aria-labelledby", section === "invite" ? "sw-page-title" : this.#id(`link-${section}`));
    // A member's own 账单 and 用量 hold none of the organization's money, which is its admin's in 组织设置: the plan said to be the
    // organization's, and their own spending.
    const member = this.#kind === "person" && me.organization?.role === "member";
    const drawn = {
      account: () => this.#account.account(w), general: () => this.#account.general(w), org: () => this.#org.draw(w), members: () => this.#members.draw(w),
      billing: () => (member ? [h("p", { class: "sw-lead", "data-key": "org.planManaged" }, this.#say("org.planManaged"))] : this.#billing.draw(this.#page, w)),
      usage: () => (member ? this.#usage.spent(w) : this.#usage.draw(w)), computer: () => this.#computer.draw(w), invite: () => this.#account.invite(w),
    }[section]();
    fill(this.#pane, ...drawn);
    this.#side.classList.toggle("scrolled", this.#pane.scrollTop > 0);
    // `#/organization/org/seats`, the chat's way to 购买席位, opens 组织 with the seats' step over it where the pane offers one.
    if (section === "org" && location.hash === `${this.#base}/org/seats`) {
      this.#history.replaceState(this.#history.state, "", `${this.#base}/org`);
      if (this.#pane.querySelector("[data-key='seats']") !== null) this.#org.askSeats(w, "seats");
    }
  }

  /**
   * Draws the pane again where the reader is: the view stays, and the keyboard goes back to the control it was on. A control that a list
   * unfolding above it pushed out of sight is brought just into view, so its focus ring is seen whole.
   */
  #redraw(key?: string, reveal = false): void {
    const at = this.#pane.scrollTop;
    // A redraw no control asked for, a read answering, keeps the keyboard where it is.
    key ??= this.#pane.contains(document.activeElement) ? (document.activeElement as HTMLElement).closest<HTMLElement>("[data-key]")?.dataset["key"] : undefined;
    this.#drawPane();
    this.#pane.scrollTop = at;
    const control = key === undefined ? undefined : [...this.#pane.querySelectorAll<HTMLElement>("[data-key]")].find((one) => one.dataset["key"] === key);
    control?.focus({ preventScroll: true });
    if (reveal) control?.scrollIntoView({ block: "nearest" });
  }
}
