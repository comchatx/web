import type { Words } from "./backend.js";
import type { Bundle, Plugin } from "./catalogue.js";
import { fill, h, placed, type Child } from "./dom.js";
import { hideTipWithin, switchButton, tip, toast } from "./forms.js";
import { href, installPlan, installed, installsWith, isThird, membersOf, mine, newerOf, packageOf, pressOf, YOURS_SHELVES, type Held, type Item } from "./plugins-model.js";
import { thirdMark } from "./plugins-npm.js";
import { installRow, standsWords, type QueueRow, type RowHead } from "./plugins-queue.js";
import { cardRow, iconAct, rowIcon } from "./plugins-row.js";
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
  /** A record's words in the page's language. */
  readonly words: (words: Words) => string;
  /** A sentence goes into the message box, unsent; words the person already wrote there stay. */
  readonly ask: (sentence: string) => void;
};

export type FeaturePage = { readonly kind: "gain"; readonly bundle: Bundle; readonly gained: readonly Plugin[] } | { readonly kind: "update"; readonly plugins: readonly Plugin[] }
  | { readonly kind: "try"; readonly plugin: Plugin };

const REDUCED = "(prefers-reduced-motion: reduce)";
const MOST = 3;
/** The close's ×, drawn in `icon`'s 16-unit box as the signed card draws it; the plus on the cover is a row's, in its 24-unit box. */
const CLOSE = "M4 4l8 8M12 4l-8 8";

/**
 * The members of a held bundle the account has not been shown and has not installed. A record from before the platform kept what was
 * shown has no list and gains nothing; the platform writes today's members into it at the next read.
 */
export function gainedOf(held: Held, bundle: Bundle): readonly Plugin[] {
  const shown = pressOf(held, bundle)?.shown;
  if (shown === undefined) return [];
  return membersOf(held, bundle).filter((plugin) => plugin.model === undefined && plugin.box !== undefined && !installed(held, plugin) && !shown.includes(plugin.box.package));
}

/** The plugins the last page goes round, a day each: those installed that ship sentences to try, in the order 我的 lists them. */
export function lapOf(held: Held): readonly Plugin[] {
  return YOURS_SHELVES.all.filter((shelf) => shelf !== "bundles").flatMap((shelf) => mine(held, shelf) as readonly Plugin[]).filter((plugin) => (plugin.box?.prompts ?? []).length > 0);
}

/** The day's plugin of the lap: the one after the plugin the last card put away showed, else the first. */
export function dayPlugin(held: Held, last: string | undefined): Plugin | undefined {
  const lap = lapOf(held);
  const at = lap.findIndex((plugin) => plugin.id === last);
  return lap[(at + 1) % Math.max(lap.length, 1)];
}

/** The card's pages, in its order: each held bundle that gained plugins, the update page, then the day's plugin's page. */
export function pagesOf(world: Pick<FeatureWorld, "held" | "updates">, last?: string): readonly FeaturePage[] {
  const gains = world.held.catalogue.bundles.flatMap((bundle): readonly FeaturePage[] => {
    const gained = gainedOf(world.held, bundle);
    return gained.length === 0 ? [] : [{ kind: "gain", bundle, gained }];
  });
  const plugin = dayPlugin(world.held, last);
  return [...gains, ...(world.updates.length === 0 ? [] : [{ kind: "update", plugins: world.updates } as const]), ...(plugin === undefined ? [] : [{ kind: "try", plugin } as const])];
}

const ids = (plugins: readonly Plugin[]): string => plugins.map((one) => one.id).join(" ");

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
/** The plugin whose page the last card put away showed, kept in the browser: the next day's is the one after it. */
export const FEATURE_LAP_KEY = "cx.feature-card.lap";
export function lastShown(storage: Pick<Storage, "getItem"> | undefined): string | undefined {
  try { return storage?.getItem(FEATURE_LAP_KEY) ?? undefined; } catch { return undefined; }
}
export function keepShown(storage: Pick<Storage, "setItem"> | undefined, pages: readonly FeaturePage[]): void {
  const page = pages.at(-1);
  if (page?.kind !== "try") return;
  try { storage?.setItem(FEATURE_LAP_KEY, page.plugin.id); } catch { /* the same plugin's page comes again */ }
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
  #pages: readonly FeaturePage[];
  readonly #off: Map<number, Set<string>> = new Map();
  readonly #sent: Map<number, Sent> = new Map();
  readonly #left = new Set<number>();
  #world: FeatureWorld;
  #at = 0;
  /** The page whose press is with the platform: its act waits for the answer. */
  #pressed: number | undefined;

  constructor(readonly ports: Ports, world: FeatureWorld, pages: readonly FeaturePage[] = pagesOf(world)) {
    this.#world = world;
    this.#pages = pages;
    this.#card = h("form", { class: "dialog oc fd", "data-zone": "", "aria-labelledby": "fd-title-0", onsubmit: (event: Event) => event.preventDefault() });
    this.element = h("div", { class: "fd-slot" }, this.#card, this.#told.element);
    this.#draw();
  }

  get pages(): readonly FeaturePage[] { return this.#pages; }

  /**
   * The world moved: each page sent redraws its rows' ends from the queue, and while the card is open the update page not yet pressed
   * offers the updates the world has, none where every one is done, which leaves the card where it was its only page, and one again
   * where an update comes back. A page pressed is its press's: its rows stay what it sent.
   */
  update(world: FeatureWorld): void {
    const before = this.#moved(this.#world);
    this.#world = world;
    const at = this.#pages.findIndex((page) => page.kind === "update");
    const offered = this.#pages[at];
    const own = offered !== undefined && (this.#sent.has(at) || this.#pressed === at);
    if (!own && ids(offered?.kind === "update" ? offered.plugins : []) !== ids(world.updates)) {
      // The update page stands between the bundles' pages and the last page; the page in view stays in view where it is still drawn,
      // and a dot holding the keyboard keeps it at its page's new place, or gives it to the dot of the page in view where its page went.
      const shown = this.#pages[this.#at];
      const dot = /^fd dot (\d+)$/.exec(this.#held() ?? "");
      const focused = dot === null ? undefined : this.#pages[Number(dot[1])];
      const last = this.#pages.filter((page) => page.kind === "try");
      this.#pages = [...this.#pages.filter((page) => page.kind === "gain"), ...(world.updates.length === 0 ? [] : [{ kind: "update", plugins: world.updates } as const]), ...last];
      if (this.#pages.length === 0) { this.#leave(""); return; }
      this.#at = shown?.kind === "try" ? this.#pages.length - 1 : Math.min(this.#at, this.#pages.length - 1);
      // The update page is made anew from each offer: there is one at most, so it is the same page by its kind.
      const kept = focused?.kind === "update" ? this.#pages.findIndex((page) => page.kind === "update") : focused === undefined ? -1 : this.#pages.indexOf(focused);
      this.#draw(true, dot === null ? undefined : `fd dot ${kept >= 0 ? kept : this.#at}`);
      return;
    }
    if (this.#sent.size > 0 && this.#moved(world) !== before) this.#draw(true);
  }

  /** What a sent row's end reads: the queue's rows, and what is installed at which version. */
  #moved(world: FeatureWorld): string {
    return JSON.stringify([world.rows.map((row) => [row.act, row.plugin.id, row.stands]), world.held.packages.map((one) => [one.source, one.version])]);
  }

  #say(key: Parameters<Say>[0], values?: Parameters<Say>[1]): string { return this.ports.say(key, values); }

  /** The address of the card's control that holds the keyboard; none where the keyboard is outside the card. */
  #held(): string | undefined {
    const active = document.activeElement;
    return active !== null && this.#card.contains(active) ? active.closest("[data-focus]")?.getAttribute("data-focus") ?? undefined : undefined;
  }

  /**
   * `keep`: the keyboard stays on the control it was on, or on `to`; where the drawing has no such control, on the close. A keyboard
   * outside the card stays where it is.
   */
  #draw(keep = false, to?: string): void {
    const held = keep ? this.#held() : undefined;
    const focus = held === undefined ? undefined : to ?? held;
    hideTipWithin(this.#card);
    const total = this.#pages.length;
    const close = tip(h("button", { type: "button", class: "sw-close fd-close", "data-focus": "fd close", "aria-label": this.#say("sw.closeSheet"), onclick: () => this.#leave("") }, icon(CLOSE)), this.#say("sw.closeSheet"), { at: "above" });
    const dots = total < 2 ? undefined : h("div", { class: "fd-dots" }, ...this.#pages.map((_, n) =>
      h("button", { type: "button", class: "fd-dot", "data-focus": `fd dot ${n}`, "aria-label": this.#say("fd.goTo", { n: n + 1 }), "aria-current": n === this.#at ? "page" : undefined, onclick: () => this.#turn(n, `fd dot ${n}`) },
        n === this.#at ? h("span", { class: "fd-fill", "aria-hidden": "true" }) : undefined)));
    const pages = this.#pages.map((page, n) => this.#page(page, n));
    this.#card.setAttribute("aria-labelledby", `fd-title-${this.#at}`);
    const said = h("span", { class: "ir-said oc-said", role: "status" });
    fill(this.#card, h("div", { class: "fd-top" }, close), dots, h("div", { class: "fd-pages" }, ...pages), this.#foot(said));
    if (focus !== undefined) (placed(this.#card, focus) ?? placed(this.#card, "fd close"))?.focus({ preventScroll: true });
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
    const title = page.kind === "try"
      ? h("p", { class: "dialog-title fd-title", id: `fd-title-${n}` }, position, h("span", { class: "fd-nameline" }, h("a", { class: "fd-bundle", href: href.item(page.plugin), "data-focus": "fd name", tabindex: current ? undefined : "-1" }, h("strong", {}, this.#world.name(page.plugin))), isThird(page.plugin) && thirdMark(this.ports.say)))
      : page.kind === "gain"
      ? h("p", { class: "dialog-title fd-title", id: `fd-title-${n}` }, position, h("a", { class: "fd-bundle", href: href.item(page.bundle), tabindex: current ? undefined : "-1" }, h("strong", {}, this.#world.name(page.bundle))), h("small", { class: "quiet fd-fresh" }, this.#say("fd.fresh")))
      : h("p", { class: "dialog-title fd-title", id: `fd-title-${n}` }, position, h("span", { class: "fd-bundle" }, h("strong", {}, page.plugins.length > 1 ? this.#say("pl.updatesLine", { count: page.plugins.length }) : this.#say("pl.updateHere"))));
    const cover = page.kind === "try" ? [this.#world.tile(page.plugin)]
      : page.kind === "gain"
      ? [this.#world.tile(page.bundle), h("span", { class: "fd-plus" }, rowIcon("plus")), ...page.gained.slice(0, MOST - 1).map((plugin) => this.#world.tile(plugin))]
      : page.plugins.slice(0, MOST).map((plugin) => this.#world.tile(plugin));
    const rows = h("ul", { class: "pl-list pl-rows ir-rows" }, ...(page.kind === "try" ? this.#tryRows(page, current) : page.kind === "gain" ? this.#gainRows(page, n) : this.#updateRows(page, n)));
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

  /**
   * The plugin's first three sentences, main's Try it presses: one goes into the message box, unsent, and the card leaves for the day.
   * The rest are on the plugin's own page, which 查看详情 opens.
   */
  #tryRows(page: Extract<FeaturePage, { kind: "try" }>, current: boolean): readonly HTMLElement[] {
    return (page.plugin.box?.prompts ?? []).slice(0, MOST).map((prompt, which) => {
      const sentence = this.#world.words(prompt.about);
      return h("li", {}, h("button", { type: "button", class: "fd-try", "data-focus": `fd try ${which}`, tabindex: current ? undefined : "-1",
        onclick: () => { this.#world.ask(sentence); this.#leave("", false); } }, h("span", { class: "fd-try-mark", "aria-hidden": "true" }, "›"), h("span", { class: "fd-try-words" }, sentence)));
    });
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
    if (this.#sent.has(n) || page.kind === "try") return [];
    if (page.kind === "gain") return this.#planOf(page, n).plan.todo;
    const off = this.#offOf(n);
    return page.plugins.filter((plugin) => !off.has(plugin.id));
  }

  #foot(said: HTMLElement): HTMLElement {
    const page = this.#pages[this.#at]!;
    const todo = this.#todo(this.#at);
    const main = page.kind === "try"
      ? h("a", { class: "f-btn primary fd-details", href: href.item(page.plugin), "data-focus": "fd main", onclick: () => this.#leave("", false) }, this.#say("fd.details"))
      : todo.length === 0 ? undefined : h("button", { type: "button", class: "f-btn primary", "data-focus": "fd main", "aria-disabled": this.#pressed !== undefined ? "true" : undefined, "aria-busy": this.#pressed !== undefined ? "true" : undefined,
      onclick: (event: Event) => { if ((event.currentTarget as HTMLElement).getAttribute("aria-disabled") !== "true") void this.#act(); } }, this.#say(page.kind === "gain" ? "pl.install" : "pl.update"));
    return h("div", { class: "dialog-acts oc-foot fd-foot" }, said,
      h("button", { type: "button", class: "f-btn", "data-focus": "fd skip", onclick: () => this.#onward("form.skipped", "") }, this.#say("dialog.skip")), main);
  }

  /**
   * 安装 or 更新 sends the page's plan and waits for the platform's answer. Admitted, the page is sent and the card goes on, saying what
   * the queue does with it; refused whole, the page is the latest offer's again, kept as it was where that offer has not changed, says it
   * was not installed or updated, and marks nothing shown.
   */
  async #act(): Promise<void> {
    const n = this.#at;
    const page = this.#pages[n]!;
    if (page.kind === "try") return;
    const primary = (): HTMLButtonElement | null => this.#card.querySelector<HTMLButtonElement>(".fd-foot .f-btn.primary");
    this.#pressed = n;
    primary()?.setAttribute("aria-disabled", "true");
    primary()?.setAttribute("aria-busy", "true");
    const plugins = this.#todo(n);
    const admitted = page.kind === "gain"
      ? await (({ off, plan }) => this.#world.install(page.bundle, off, plan.buying.map((plugin) => plugin.id)))(this.#planOf(page, n))
      : await this.#world.update(plugins);
    this.#pressed = undefined;
    // Refused, the page is the offer's again, the one last read; where that offer is the page's still, the primary drawn now is let go,
    // the one pressed where it still stands, so the focus stays on it.
    if (!admitted) {
      const pages = this.#pages;
      this.update(this.#world);
      if (this.#pages === pages) { primary()?.removeAttribute("aria-disabled"); primary()?.removeAttribute("aria-busy"); }
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
    const next = this.#pages[this.#at + 1]!;
    this.#turn(this.#at + 1, between === "" || (next.kind !== "try" && this.#todo(this.#at + 1).length === 0) ? "fd skip" : "fd main");
  }

  /**
   * The page turns and the chat stays where it was scrolled: the keyboard lands where it was meant to if that is wholly in view, else on
   * the page's dot, else on the close.
   */
  #turn(n: number, focus: string): void {
    const from = this.#fill()?.getBoundingClientRect().left;
    this.#at = n;
    this.#draw();
    const lands = [placed(this.#card, focus), this.#dot() ?? undefined].find((one) => one !== undefined && this.#seen(one)) ?? placed(this.#card, "fd close");
    lands?.focus({ preventScroll: true });
    this.#slide(from);
  }

  /** Wholly inside the chat's view and above the fade at its foot, which is as tall as the stream's own foot; outside a chat, the window's. */
  #seen(one: HTMLElement): boolean {
    const view = this.element.closest(".scroller")?.getBoundingClientRect();
    const fade = view === undefined ? 0 : Number.parseFloat(getComputedStyle(this.element.closest(".stream") ?? this.element).paddingBottom) || 0;
    const at = one.getBoundingClientRect();
    return at.top >= Math.max(view?.top ?? 0, 0) && at.bottom <= Math.min(view?.bottom ?? innerHeight, innerHeight) - fade;
  }

  #dot(): HTMLElement | null { return this.#card.querySelector<HTMLElement>('.fd-dot[aria-current="page"]'); }
  #fill(): HTMLElement | null { return this.#card.querySelector<HTMLElement>(".fd-fill"); }

  /**
   * The fill slides from the page left to the page turned to, past the dots between, in the theme's travel and its curve; every ring
   * stays where it is, the one turned to empty until the fill reaches it. Under reduced motion the fill is simply there. The pages
   * share one height, so the card itself never moves.
   */
  #slide(from: number | undefined): void {
    const fill = this.#fill();
    if (from === undefined || fill === null || typeof fill.animate !== "function" || globalThis.matchMedia?.(REDUCED).matches === true) return;
    const by = from - fill.getBoundingClientRect().left;
    if (by === 0) return;
    const style = getComputedStyle(this.#card);
    fill.animate([{ transform: `translateX(${by}px)` }, { transform: "none" }],
      { duration: Number.parseFloat(style.getPropertyValue("--motion-travel")), easing: style.getPropertyValue("--ease").trim() });
  }

  /** A bundle's page left by 安装, 跳过 or the close marks its members shown. */
  #mark(n: number): void {
    const page = this.#pages[n];
    if (page?.kind !== "gain" || this.#left.has(n)) return;
    this.#left.add(n);
    void this.#world.shown(page.bundle);
  }

  /** `toBox` false: the press that ends the card puts the keyboard where it goes itself, the message box or the plugin's page. */
  #leave(words: string, toBox = true): void {
    this.#mark(this.#at);
    const focused = toBox && this.#card.contains(document.activeElement);
    hideTipWithin(this.#card);
    this.#card.remove();
    if (words !== "") this.#told.tell(words);
    this.ports.left(focused);
  }

  get open(): boolean { return this.#card.parentElement !== null; }
}
