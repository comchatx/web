import type { Bundle, Plugin } from "./catalogue.js";
import { fill, h, placed, type Child } from "./dom.js";
import { hideTipWithin, switchButton, tip, toast } from "./forms.js";
import { href, installPlan, installed, installsWith, membersOf, newerOf, packageOf, pressOf, type Held, type Item } from "./plugins-model.js";
import { installRow, standsWords, type QueueRow, type RowHead } from "./plugins-queue.js";
import { cardRow, iconAct, PATHS } from "./plugins-row.js";
import { usedByMark } from "./plugins-cards.js";
import { icon } from "./spend-chart.js";
import type { Say } from "./stream-view.js";
import type { Language } from "./strings.js";

/** What the card reads and does, given by the Plugins page from the world it read last. */
export type FeatureWorld = {
  readonly held: Held;
  readonly rows: readonly QueueRow[];
  /** The plugins the Plugins page counts as having a new version, less those in the queue. */
  readonly updates: readonly Plugin[];
  /** cx is answering: an update waits for the answer to end. */
  readonly answering: boolean;
  /** cx's computer is off: an update waits for it to start. */
  readonly asleep: boolean;
  readonly head: (plugin: Plugin, focus: string) => RowHead;
  readonly tile: (item: Item) => HTMLElement;
  readonly name: (item: Item) => string;
  readonly list: (names: readonly string[]) => string;
  /** Answers whether the platform admitted the press. */
  readonly install: (bundle: Bundle, off: readonly string[], agreed: readonly string[]) => Promise<boolean>;
  /** Answers whether the platform admitted any of it. */
  readonly update: (plugins: readonly Plugin[]) => Promise<boolean>;
  readonly cancel: (row: QueueRow) => Promise<void>;
  /** A bundle's page was left: its members are the account's as shown. */
  readonly shown: (bundle: Bundle) => Promise<void>;
};

export type FeaturePage = { readonly kind: "gain"; readonly bundle: Bundle; readonly gained: readonly Plugin[] } | { readonly kind: "update"; readonly plugins: readonly Plugin[] };

const MOST = 3;

/**
 * The members of a held bundle the account has not been shown and has not installed. A record from before the platform kept what was
 * shown has no list and gains nothing; the platform writes today's members into it at the next read.
 */
export function gainedOf(held: Held, bundle: Bundle): readonly Plugin[] {
  const shown = pressOf(held, bundle)?.shown;
  if (shown === undefined) return [];
  return membersOf(held, bundle).filter((plugin) => plugin.model === undefined && plugin.box !== undefined && !installed(held, plugin) && !shown.includes(plugin.box.package));
}

/** The card's pages, in its order: each held bundle that gained plugins, then the update page. */
export function pagesOf(world: Pick<FeatureWorld, "held" | "updates">): readonly FeaturePage[] {
  const gains = world.held.catalogue.bundles.flatMap((bundle): readonly FeaturePage[] => {
    const gained = gainedOf(world.held, bundle);
    return gained.length === 0 ? [] : [{ kind: "gain", bundle, gained }];
  });
  return world.updates.length === 0 ? gains : [...gains, { kind: "update", plugins: world.updates }];
}

/** The day a card was put away, kept in the browser: the whole card shows once a day. */
export const FEATURE_DAY_KEY = "cx.feature-card.day";
export const today = (now: Date = new Date()): string => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
/** The one condition: the card was not put away today. */
export function featureDue(storage: Pick<Storage, "getItem"> | undefined, day: string = today()): boolean {
  try { return storage?.getItem(FEATURE_DAY_KEY) !== day; } catch { return true; }
}
export function putAway(storage: Pick<Storage, "setItem"> | undefined, day: string = today()): void {
  try { storage?.setItem(FEATURE_DAY_KEY, day); } catch { /* a browser that keeps nothing shows the card at the next opening */ }
}

type Ports = {
  readonly say: Say;
  readonly language: () => Language;
  /** The card left: the message box takes the keyboard where the card had it. */
  readonly left: (focused: boolean) => void;
};

/** One row as the page last drew it: sent is the press the page made, so a row the queue no longer holds is done or back to its switch. */
type Sent = { readonly act: "install" | "update"; readonly plugins: ReadonlySet<string> };

/**
 * The card at the end of the conversation, above the message box: a cover, the pages a few dots turn, and 跳过 with the page's own act.
 * A page sent stays drawn as the queue moves, reached again by its dot.
 */
export class FeatureCard {
  readonly element: HTMLElement;
  readonly #card: HTMLElement;
  readonly #told = toast();
  readonly #pages: readonly FeaturePage[];
  readonly #off: Map<number, Set<string>> = new Map();
  readonly #sent: Map<number, Sent> = new Map();
  readonly #left = new Set<number>();
  #world: FeatureWorld;
  #at = 0;
  /** A page's press is with the platform: its act waits for the answer. */
  #pressing = false;

  constructor(readonly ports: Ports, world: FeatureWorld, pages: readonly FeaturePage[] = pagesOf(world)) {
    this.#world = world;
    this.#pages = pages;
    this.#card = h("form", { class: "dialog oc fd", "aria-labelledby": "fd-title-0", onsubmit: (event: Event) => event.preventDefault() });
    this.element = h("div", { class: "fd-slot" }, this.#card, this.#told.element);
    this.#draw();
  }

  get pages(): readonly FeaturePage[] { return this.#pages; }

  /** The world moved: each page sent redraws its rows' ends from the queue. */
  update(world: FeatureWorld): void {
    const before = this.#moved(this.#world);
    this.#world = world;
    if (this.#sent.size > 0 && this.#moved(world) !== before) this.#draw(true);
  }

  /** What a sent row's end reads: the queue's rows, and what is installed at which version. */
  #moved(world: FeatureWorld): string {
    return JSON.stringify([world.rows.map((row) => [row.act, row.plugin.id, row.stands]), world.held.packages.map((one) => [one.source, one.version])]);
  }

  #say(key: Parameters<Say>[0], values?: Parameters<Say>[1]): string { return this.ports.say(key, values); }

  #draw(keep = false): void {
    const focus = keep ? document.activeElement?.closest("[data-focus]")?.getAttribute("data-focus") ?? undefined : undefined;
    hideTipWithin(this.#card);
    const total = this.#pages.length;
    const close = tip(h("button", { type: "button", class: "sw-close fd-close", "data-focus": "fd close", "aria-label": this.#say("sw.closeSheet"), onclick: () => this.#leave("") }, icon(PATHS.close)), this.#say("sw.closeSheet"), { at: "above" });
    const dots = total < 2 ? undefined : h("div", { class: "fd-dots" }, ...this.#pages.map((_, n) =>
      h("button", { type: "button", class: "fd-dot", "data-focus": `fd dot ${n}`, "aria-label": this.#say("fd.goTo", { n: n + 1 }), "aria-current": n === this.#at ? "page" : undefined, onclick: () => this.#turn(n, `fd dot ${n}`) })));
    const pages = this.#pages.map((page, n) => this.#page(page, n));
    this.#card.setAttribute("aria-labelledby", `fd-title-${this.#at}`);
    const said = h("span", { class: "ir-said oc-said", role: "status" });
    fill(this.#card, h("div", { class: "fd-top" }, close), dots, h("div", { class: "fd-pages" }, ...pages), this.#foot(said));
    if (focus !== undefined) placed(this.#card, focus)?.focus({ preventScroll: true });
    setTimeout(() => this.#fit());
  }

  /** A list that scrolls is a stop of its own, named by its page's title, so the keyboard can scroll it. */
  #fit(): void {
    this.#card.querySelectorAll<HTMLElement>(".fd-page").forEach((page, n) => {
      const box = page.querySelector<HTMLElement>(".ir-box");
      if (box === null) return;
      if (n === this.#at && box.scrollHeight > box.clientHeight + 1) {
        box.tabIndex = 0; box.setAttribute("role", "group"); box.setAttribute("aria-label", page.querySelector(".fd-title")?.textContent?.trim() ?? "");
      } else { box.removeAttribute("tabindex"); box.removeAttribute("role"); box.removeAttribute("aria-label"); }
    });
  }

  #page(page: FeaturePage, n: number): HTMLElement {
    const current = n === this.#at;
    const position = this.#pages.length > 1 ? h("span", { class: "oc-said" }, `${this.#say("fd.page", { n: n + 1, total: this.#pages.length })} `) : undefined;
    const title = page.kind === "gain"
      ? h("p", { class: "dialog-title fd-title", id: `fd-title-${n}` }, position, h("a", { class: "fd-bundle", href: href.item(page.bundle), tabindex: current ? undefined : "-1" }, h("strong", {}, this.#world.name(page.bundle))), h("small", { class: "quiet fd-fresh" }, this.#say("fd.fresh")))
      : h("p", { class: "dialog-title fd-title", id: `fd-title-${n}` }, position, h("span", { class: "fd-bundle" }, h("strong", {}, page.plugins.length > 1 ? this.#say("pl.updatesLine", { count: page.plugins.length }) : this.#say("pl.updateHere"))));
    const cover = page.kind === "gain"
      ? [this.#world.tile(page.bundle), h("span", { class: "fd-plus" }, icon(PATHS.plus)), ...page.gained.slice(0, MOST - 1).map((plugin) => this.#world.tile(plugin))]
      : page.plugins.slice(0, MOST).map((plugin) => this.#world.tile(plugin));
    const rows = h("ul", { class: "pl-list pl-rows ir-rows" }, ...(page.kind === "gain" ? this.#gainRows(page, n) : this.#updateRows(page, n)));
    const box = h("div", { class: "ir-box" }, rows);
    return h("section", { class: "fd-page", inert: !current, "aria-hidden": current ? undefined : "true" },
      h("div", { class: "fd-cover", "aria-hidden": "true" }, ...cover),
      h("div", { class: "fd-phead" }, title),
      h("div", { class: "fd-body" }, box));
  }

  #offOf(n: number): Set<string> {
    let off = this.#off.get(n);
    if (off === undefined) { off = new Set(); this.#off.set(n, off); }
    return off;
  }

  /**
   * The plan the Plugins page sends for a bundle's page, drawn as it is sent: its roots are the offered members left on, every other
   * plugin the bundle would bring switched off, so what one of those needs comes only where a member left on needs it too.
   */
  #planOf(page: Extract<FeaturePage, { kind: "gain" }>, n: number) {
    const off = this.#offOf(n);
    const roots = new Set(page.gained.filter((plugin) => !off.has(plugin.id)).map((plugin) => plugin.id));
    const flips = installsWith(this.#world.held, membersOf(this.#world.held, page.bundle)).filter((plugin) => !roots.has(plugin.id) && !installed(this.#world.held, plugin)).map((plugin) => plugin.id);
    return { off: flips, plan: installPlan(this.#world.held, page.bundle, new Set(flips)) };
  }

  /**
   * The rows the plan selects, every one in its order: each offered member, and what a member left on brings that the seller lacks, held
   * on. Once sent, the page draws what its press sent.
   */
  #gainRows(page: Extract<FeaturePage, { kind: "gain" }>, n: number): readonly HTMLElement[] {
    const { plan } = this.#planOf(page, n);
    const gained = new Set(page.gained.map((plugin) => plugin.id));
    const sent = this.#sent.get(n)?.plugins;
    return plan.rows.filter((row) => (sent === undefined ? gained.has(row.plugin.id) || (row.on && row.role !== "held") : sent.has(row.plugin.id)))
      .map((row) => this.#row(n, row.plugin, "install", row.role === "locked" ? row.users.map((user) => this.#world.name(user)) : [], !gained.has(row.plugin.id)));
  }

  #updateRows(page: Extract<FeaturePage, { kind: "update" }>, n: number): readonly HTMLElement[] {
    return page.plugins.map((plugin) => this.#row(n, plugin, "update", [], false));
  }

  /** A row: `users` are the plugins left on that cannot work without it, so it is held on, marked and said by them. */
  #row(n: number, plugin: Plugin, act: "install" | "update", users: readonly string[], kid: boolean): HTMLElement {
    const focus = `fd ${n} ${plugin.id}`;
    const held = users.length > 0;
    const head = this.#world.head(plugin, `${focus} link`);
    if (n !== this.#at) head.name.querySelectorAll("a").forEach((link) => link.setAttribute("tabindex", "-1"));
    const sent = this.#sent.get(n)?.plugins.has(plugin.id) === true;
    if (held && !sent) head.name.append(usedByMark({ say: this.ports.say, language: this.ports.language() }, users, "above"));
    const line = held ? this.#say("pl.c.comesWith", { names: this.#world.list(users) }) : act === "update" ? undefined : head.line;
    const versions = act === "update" ? this.#versions(plugin) : undefined;
    const end = document.createDocumentFragment();
    end.append(...this.#end(n, plugin, act, held, focus).filter((one): one is Node | string => one !== undefined && one !== false));
    const out = !held && !sent && this.#offOf(n).has(plugin.id);
    const row = cardRow({ ...head, line: line ?? "" }, [], end, [...(kid ? ["pl-under"] : []), ...(out ? ["fd-out"] : [])]);
    const versionLine = row.querySelector<HTMLElement>(".pl-row-line");
    if (versions !== undefined && versionLine !== null) fill(versionLine, ...versions);
    return row;
  }

  #versions(plugin: Plugin): readonly Child[] {
    const from = packageOf(this.#world.held, plugin)?.version ?? "";
    const to = newerOf(this.#world.held, plugin) ?? "";
    return [h("bdi", {}, from), h("span", { "aria-hidden": "true" }, " → "), h("span", { class: "oc-said" }, this.#say("sw.to")), h("bdi", {}, to)];
  }

  #end(n: number, plugin: Plugin, act: "install" | "update", held: boolean, focus: string): readonly Child[] {
    const sent = this.#sent.get(n);
    if (sent?.plugins.has(plugin.id) === true) {
      const row = this.#world.rows.find((one) => one.act === act && one.plugin.id === plugin.id) ?? (act === "install" ? installRow(this.#world.rows, plugin) : undefined);
      if (row !== undefined && row.stands !== "failed") {
        const running = row.stands === "running";
        const cancel = iconAct("close", this.#say(act === "install" ? "pl.q.cancelInstall" : "pl.q.cancelUpdate", { name: this.#world.name(plugin) }), () => void this.#world.cancel(row), { off: running, focus: `${focus} cancel`, at: "beside" });
        return [h("span", { class: "pl-q-state", role: running ? "status" : undefined }, h("span", { class: running ? "pl-spin" : "pl-spin pl-still", "aria-hidden": "true" }), h("span", { class: "pl-q-state-word" }, standsWords(this.ports.say, row))), cancel];
      }
      const done = act === "install" ? installed(this.#world.held, plugin) : newerOf(this.#world.held, plugin) === undefined;
      if (done) return [tip(h("span", { class: "pl-done-mark", role: "img", "aria-label": this.#say("pl.installedName", { name: this.#world.name(plugin) }) }, "✓"), this.#say("pl.installedName", { name: this.#world.name(plugin) }))];
    }
    const off = this.#offOf(n);
    const control = switchButton({
      label: this.#world.name(plugin), on: held || !off.has(plugin.id),
      turn: (on) => { if (on) off.delete(plugin.id); else off.add(plugin.id); this.#draw(true); },
      ...(held ? { refuse: () => this.#refuse(focus) } : {}),
    });
    control.element.setAttribute("data-focus", focus);
    return [control.element];
  }

  /** A row a switched-on plugin needs holds: its line already says why, and the card says it again to a screen reader. */
  #refuse(focus: string): void {
    const line = placed(this.#card, focus)?.closest("li")?.querySelector(".pl-row-line")?.textContent ?? "";
    const said = this.#card.querySelector<HTMLElement>(".ir-said");
    if (said !== null) { said.textContent = ""; setTimeout(() => { said.textContent = line; }, 50); }
  }

  /** What a page's act sends: a bundle's plan, or each update row on; nothing once sent. */
  #todo(n: number): readonly Plugin[] {
    const page = this.#pages[n]!;
    if (this.#sent.has(n)) return [];
    if (page.kind === "gain") return this.#planOf(page, n).plan.todo;
    const off = this.#offOf(n);
    return page.plugins.filter((plugin) => !off.has(plugin.id));
  }

  #foot(said: HTMLElement): HTMLElement {
    const page = this.#pages[this.#at]!;
    const todo = this.#todo(this.#at);
    const main = todo.length === 0 ? undefined : h("button", { type: "button", class: "f-btn primary", "data-focus": "fd main", "aria-disabled": this.#pressing ? "true" : undefined, "aria-busy": this.#pressing ? "true" : undefined,
      onclick: (event: Event) => { if ((event.currentTarget as HTMLElement).getAttribute("aria-disabled") !== "true") void this.#act(); } }, this.#say(page.kind === "gain" ? "pl.install" : "pl.update"));
    return h("div", { class: "dialog-acts oc-foot fd-foot" }, said,
      h("button", { type: "button", class: "f-btn", "data-focus": "fd skip", onclick: () => this.#onward("form.skipped", "") }, this.#say("dialog.skip")), main);
  }

  /**
   * 安装 or 更新 sends the page's plan and waits for the platform's answer. Admitted, the page is sent and the card goes on, saying what
   * the queue does with it; refused whole, the page stays as it was, says it was not installed or updated, and marks nothing shown.
   */
  async #act(): Promise<void> {
    const n = this.#at;
    const page = this.#pages[n]!;
    const primary = (): HTMLButtonElement | null => this.#card.querySelector<HTMLButtonElement>(".fd-foot .f-btn.primary");
    this.#pressing = true;
    primary()?.setAttribute("aria-disabled", "true");
    primary()?.setAttribute("aria-busy", "true");
    const plugins = this.#todo(n);
    const admitted = page.kind === "gain"
      ? await (({ off, plan }) => this.#world.install(page.bundle, off, plan.buying.map((plugin) => plugin.id)))(this.#planOf(page, n))
      : await this.#world.update(plugins);
    this.#pressing = false;
    // Refused, the primary drawn now is let go, the one pressed where it still stands, so the focus stays on it.
    if (!admitted) {
      primary()?.removeAttribute("aria-disabled");
      primary()?.removeAttribute("aria-busy");
      this.#told.tell(page.kind === "gain" ? this.#say("pl.fail.install", { name: this.#world.name(page.bundle) }) : this.#say("pl.fail.updateHere"));
      return;
    }
    this.#sent.set(n, { act: page.kind === "gain" ? "install" : "update", plugins: new Set(plugins.map((plugin) => plugin.id)) });
    const words = page.kind === "gain" ? "pl.q.added" : this.#world.asleep ? "pl.updateQueued" : this.#world.answering ? "pl.updateAfterAnswer" : "pl.q.added";
    if (n === this.#at) { this.#onward(words, words); return; }
    // The seller turned to another page while the write was out: the answer marks the page pressed and draws its rows, and the page in view stays.
    this.#mark(n);
    this.#told.tell(this.#say(words));
    this.#draw(true);
  }

  /** 安装, 更新 and 跳过 go on to the next page; on the last one the card leaves, saying what the last press did. */
  #onward(last: Parameters<Say>[0], between: Parameters<Say>[0] | ""): void {
    this.#mark(this.#at);
    if (this.#at + 1 >= this.#pages.length) { this.#leave(this.#say(last)); return; }
    if (between !== "") this.#told.tell(this.#say(between));
    this.#turn(this.#at + 1, between === "" || this.#todo(this.#at + 1).length === 0 ? "fd skip" : "fd main");
  }

  #turn(n: number, focus: string): void {
    this.#at = n;
    this.#draw();
    placed(this.#card, focus)?.focus({ preventScroll: true });
  }

  /** A bundle's page left by 安装, 跳过 or the close marks its members shown. */
  #mark(n: number): void {
    const page = this.#pages[n];
    if (page?.kind !== "gain" || this.#left.has(n)) return;
    this.#left.add(n);
    void this.#world.shown(page.bundle);
  }

  #leave(words: string): void {
    this.#mark(this.#at);
    const focused = this.#card.contains(document.activeElement);
    hideTipWithin(this.#card);
    this.#card.remove();
    if (words !== "") this.#told.tell(words);
    this.ports.left(focused);
  }

  get open(): boolean { return this.#card.parentElement !== null; }
}
