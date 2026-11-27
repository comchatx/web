import type { Backend, Written } from "./backend.js";
import { nameIn, vendorIn, type Bundle, type Plugin } from "./catalogue.js";
import type { Language } from "./strings.js";
import { h, placed, type Child } from "./dom.js";
import { dialog as modal, switchButton, tip } from "./forms.js";
import { cardRow, rowIcon, rowMark, type TipAt } from "./plugins-row.js";
import type { RowHead } from "./plugins-queue.js";
import { thirdMark } from "./plugins-npm.js";
import { busyMark } from "./waiting.js";
import { madeByUs, cardName, cardOf, chatOn, connected, connectedWays, ownAccount, ownConnected, isBase, keyHeld, href, installPlan, installed, membersOf, isBundle, isOn, needsOf, quietInstall, removePlan, sourceFor, sourceOf, stopsIf, withCard, withoutCard, type Held, type InstallPlan, type InstallRow, type Item, type RemovePlan, type RemoveRow } from "./plugins-model.js";
import type { StringKey } from "./strings.js";
import { factWords, failureWords, sentences, type About, type Doing, type Fact, type Failed } from "./plugins-doing.js";

/** What a card reads and does, given by the page that opens it. */
export type CardContext = {
  readonly held: Held;
  readonly backend: Backend;
  readonly language: Language;
  readonly say: (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;
  readonly list: (names: readonly string[]) => string;
  readonly tile: (item: Item, big?: boolean) => HTMLElement;
  /** A plugin's row as 我的 draws it: its mark, its name, which is its link, with the third party's mark, and its line. */
  readonly head?: (plugin: Plugin) => RowHead;
  /** The person's balance, drawn as money, where `/me` gave one. */
  readonly balance: string | undefined;
  /** Whether the person said "Don't show again" to the rule cx buys by, kept in their card choices so every browser they use knows it. */
  readonly ruleSeen?: () => boolean;
  /** Keeps that they said it. */
  readonly seeRule?: () => void;
  /** Who made a plugin, its version and when it was updated, as its page's header says them. */
  readonly meta: (plugin: Plugin) => string;
  /** Who pays for a source and at what price, in the one sentence every surface uses. */
  readonly payLine: (plugin: Plugin) => string;
  /** What the account's money buys from a plugin's source, where the balance pays it; empty where it does not. */
  readonly scaleLine: (plugin: Plugin) => string;
  /** A source's prices as its Overview draws them: the pay line, the scale, the table and how long a purchase is reused. */
  readonly prices: (plugin: Plugin) => readonly Child[];
  /** Whether a source is paid through the person's own key, so the balance is not named for it. */
  readonly byKey: (plugin: Plugin) => boolean;
  /** A model plugin's price from the balance, in and out per million tokens, and the model it is the price of, where its models are known. */
  readonly modelPrice: (plugin: Plugin) => { readonly model: string; readonly price: string } | undefined;
  /** This month's spend from the balance through a plugin, a source's or a model's, drawn as money, where there was any. */
  readonly spent: (plugin: Plugin) => string | undefined;
  /**
   * Does the work, then reads the world again; answers whether it was done. A click on a record names it, so the record is drawn busy
   * until the platform has written it down, and as the seller asked from then, which is when it is answered done; `told` is said once
   * cx's computer says it is done, and a failure, then or later, is drawn on the record. Without a record, `told` is said once the work
   * is done, and `failed` is the word for a failure.
   */
  readonly run: (work: () => Promise<void | "unsaid">, told: string, failed: string, about?: About) => Promise<boolean>;
  /** Waits for the clicks the platform wrote down to end, as the list says they did; `about` is the record they are written down for. */
  /** A click's end, waited for unless `waits` is false: an install or an update is the queue's from its write, and is answered then. */
  readonly ended: (clicks: readonly Written[], about?: About, waits?: boolean) => Promise<"done" | "unsaid">;
  /** Whether the page draws the plugin's switch; a card names turning it off only where there is one to press. */
  readonly switched?: (plugin: Plugin) => boolean;
  /** Where the dialog is put while it is open. */
  readonly host: () => HTMLElement;
  /** Where the keyboard goes when a card closes with nothing done, where the control that opened it is gone; else that control. */
  readonly returnTo?: () => HTMLElement | null | undefined;
};

export type Card = { readonly act: "install" | "remove"; readonly item: Item } | { readonly act: "off" | "on"; readonly item: Plugin };

/**
 * The card a press opens, by the name the address gives it; undefined where the press asks nothing and is done at once. Every control
 * that opens a card carries this name, so an address opens only the card a press on the page it names would. A bundle that adds a plugin
 * always opens its install card, so a member can be left out (the owner, 2026-11-24).
 */
export function cardFor(held: Held, act: Card["act"], item: Item): string | undefined {
  const kind = isBundle(item) ? "b" : "p";
  if (act === "install") { const plan = installPlan(held, item); return quietInstall(item, plan) && !(isBundle(item) && plan.todo.length > 0) ? undefined : cardName("install", kind, item.id); }
  if (act === "remove") return cardName("remove", kind, item.id);
  if (isBundle(item)) return undefined;
  if (act === "on") return item.source === undefined ? undefined : cardName("enable", "p", item.id);
  return stopsIf(held, item).length === 0 && !chatOn(held, item) ? undefined : cardName("off", "p", item.id);
}

/** The card that is open, by its name. */
export function cardOpen(): string | undefined {
  return globalThis.document?.querySelector?.<HTMLElement>("dialog[data-card]")?.dataset?.["card"];
}
/** The mark a card's own step of the history carries: the address of the page's step under it. */
const OVER = "plCardOver";
const stateOf = (): Readonly<Record<string, unknown>> => { const state: unknown = globalThis.history?.state; return typeof state === "object" && state !== null ? state as Record<string, unknown> : {}; };
/**
 * A card a press opened is one more step of the history, over the page it was opened on, and its step says so — through a reload and
 * a Back to it from a page it linked to; one the address opened is there already.
 */
export function cardShown(name: string | undefined): void {
  const at = globalThis.location?.hash;
  if (name !== undefined && at !== undefined && cardOf(at) !== name) globalThis.history?.pushState?.({ ...stateOf(), [OVER]: at }, "", withCard(at, name));
}
type Entries = { readonly currentEntry: { readonly index: number } | null; entries(): readonly { readonly url: string | null }[] };
/** Whether the step under this one is the page at `page`, where the browser tells its steps; a typed address carries no mark to say so. */
function pageUnder(page: string): boolean {
  const navigation = (globalThis as { readonly navigation?: Entries }).navigation;
  const index = navigation?.currentEntry?.index;
  const under = index === undefined || index < 1 ? undefined : navigation?.entries()[index - 1]?.url;
  if (typeof under !== "string" || globalThis.location === undefined) return false;
  return under === new URL(page, globalThis.location.href).href;
}
/**
 * A card closed where it stands takes its address with it, so one Back after leaves for the page before: a card's own step over the
 * page's is gone back from, as is a typed address's over its own page, and an address that opened one with no step of the page under
 * it becomes the page's own. Answers once the page's address stands; one Back or a link closed has left already.
 */
export function cardShut(name: string | undefined): Promise<void> {
  const at = globalThis.location?.hash;
  if (name === undefined || at === undefined || cardOf(at) !== name) return Promise.resolve();
  const { [OVER]: over, ...state } = stateOf();
  if ((typeof over === "string" ? withoutCard(over) === withoutCard(at) : pageUnder(withoutCard(at))) && typeof globalThis.history?.back === "function") {
    return new Promise((done) => {
      // A Back the browser does not carry out leaves the work waiting no longer than this.
      const late = setTimeout(stand, 1000);
      function stand(): void { clearTimeout(late); globalThis.removeEventListener?.("hashchange", landed); done(); }
      function landed(): void { if (cardOf(globalThis.location?.hash ?? "") !== name) stand(); }
      globalThis.addEventListener?.("hashchange", landed);
      globalThis.history.back();
    });
  }
  globalThis.history?.replaceState?.(state, "", withoutCard(at));
  return Promise.resolve();
}
/**
 * Opens the card an address names, once the page it stands over is drawn: by the control that opens it there. Where nothing drawn
 * opens it — an unknown record, a switch that is not offered, an act already done — the page stands without it and the address
 * names it no longer, in the same step of the history.
 */
export function seekCard(root: ParentNode): void {
  const at = globalThis.location?.hash;
  const name = at === undefined ? undefined : cardOf(at);
  if (at === undefined || name === undefined || cardOpen() === name) return;
  const control = [...root.querySelectorAll<HTMLElement>("[data-card]")].find((one) => one.dataset["card"] === name);
  // The control holds the keyboard as if it had been pressed, so a card closed with nothing done gives it back there.
  control?.focus?.({ preventScroll: true });
  control?.click();
  if (cardOpen() !== name) globalThis.history?.replaceState?.(globalThis.history.state, "", withoutCard(at));
}

const ruleSeen = (context: CardContext): boolean => context.ruleSeen?.() === true;

/** Sends one plugin's install: its model plugin at once; its package as a click, answered with its entry. */
async function sendInstall(context: CardContext, plugin: Plugin): Promise<readonly Written[]> {
  if (plugin.model !== undefined) { await context.backend.installModel(plugin.id, true); return []; }
  return plugin.box !== undefined && !installed(context.held, plugin) ? [await context.backend.installPackage(sourceFor(context.held, plugin)!, true)] : [];
}

/** Switches a plugin: its model plugin at once, else its package by a click, which switches the source it sells with it. */
export async function turn(context: CardContext, plugin: Plugin, on: boolean, about?: About): Promise<void | "unsaid"> {
  if (plugin.model !== undefined) { await context.backend.setModel(plugin.id, on); return undefined; }
  if (plugin.box === undefined) return undefined;
  return orNothing(await context.ended([await context.backend.setPackage(sourceFor(context.held, plugin)!, on)], about));
}
const orNothing = (how: "done" | "unsaid"): void | "unsaid" => (how === "unsaid" ? how : undefined);

/**
 * Every click of one act is sent before any is waited for: a sleeping computer keeps them all, in the order sent, and the act is
 * written down once the last is. Where one is refused, the act is not, and those already written down are read to their end all the
 * same, so the refusal is drawn over the list as they left it.
 */
async function sendAll(context: CardContext, send: (clicks: Written[]) => Promise<void>, about: About, waits = true): Promise<"done" | "unsaid"> {
  const clicks: Written[] = [];
  try { await send(clicks); } catch (error) { await context.ended(clicks, undefined, waits).catch(() => undefined); throw error; }
  return context.ended(clicks, about, waits);
}

/**
 * Installs an item: at once where it has nothing to ask, else behind the install card (sheet 2d), whose rows are what installs with it,
 * each switch the seller's where nothing else in the install needs it. Answers whether it was installed. `agreed` is the paid sources a
 * caller with no card to draw has already agreed to, as a press of the card's Install would: the card is drawn only where the install turns on another.
 * `off` is the rows such a caller's seller switched off, as the card's switches would have.
 */
export function install(context: CardContext, item: Item, agreed?: readonly string[], off: Iterable<string> = []): Promise<boolean> {
  const flips = new Set<string>(off);
  const now = (): InstallPlan => installPlan(context.held, item, flips);
  // Which plugin each click was for: what cx's computer answers of one package is said of that plugin.
  const sent = new Map<string, Plugin>();
  let plan = now();
  const work = async (): Promise<void | "unsaid"> => orNothing(await sendAll(context, async (clicks) => {
    const keep = (plugin: Plugin, made: readonly Written[]): void => { for (const click of made) sent.set(click.source, plugin); clicks.push(...made); };
    if (isBundle(item)) {
      // A bundle's press is one click and nothing moves before the platform admits it: every package on its list the seller left on that
      // it lacks, a needed one first, in one request, each entry drawn on its own plugin. The platform takes only members in it, so each
      // other package goes after it, its own click, and a refused press sends none of them; then the model plugins.
      const listed = membersOf(context.held, item);
      const packages = plan.todo.filter((plugin) => plugin.model === undefined && listed.includes(plugin));
      if (packages.length > 0) {
        const made = await context.backend.pressBundle(item.id, packages.map((plugin) => sourceFor(context.held, plugin)!));
        for (const plugin of packages) keep(plugin, made.filter((click) => click.source === sourceFor(context.held, plugin)));
      }
      for (const plugin of plan.todo.filter((one) => one.model === undefined && !packages.includes(one))) keep(plugin, await sendInstall(context, plugin));
      for (const plugin of plan.todo.filter((one) => one.model !== undefined)) await sendInstall(context, plugin);
      return;
    }
    for (const plugin of plan.todo) keep(plugin, await sendInstall(context, plugin));
    for (const plugin of plan.buying.filter((one) => installed(context.held, one) && !isOn(context.held, one))) keep(plugin, [await context.backend.setPackage(sourceFor(context.held, plugin)!, true)]);
  }, about, false));
  // Every press that sends cx's computer a package says the same once it is written down, whatever the computer is doing; how it ends
  // is the queue's to say. A model plugin alone installs on the platform at once, joins no queue, and is said by its switch alone, as
  // nothing is said when an install lands (ruled 2026-11-10).
  const told = (): string => (plan.todo.some((plugin) => plugin.model === undefined) || plan.buying.some((plugin) => installed(context.held, plugin) && !isOn(context.held, plugin)) ? context.say("pl.q.added") : "");
  const failed = context.say("pl.fail.install", { name: nameIn(item, context.language) });
  const about: About = { item, act: "install", get parts() { return plan.todo; }, partOf: (source) => sent.get(source) };
  if (cardFor(context.held, "install", item) === undefined || (agreed !== undefined && plan.buying.every((plugin) => agreed.includes(plugin.id)))) return context.run(work, told(), failed, about);
  return open(context, item, "pl.c.installTitle", "pl.install", work, told, failed, () => [installBody(context, flips, (next) => { plan = next; }, now)], about, cardFor(context.held, "install", item));
}

/** What a card's rows say to a screen reader when a switch holds: the row's own line says it too. */
const saidLine = (): HTMLElement => h("p", { class: "pl-sr", role: "status", "aria-live": "polite" });

/**
 * The install card's rows (sheet 2d): the third party's one warning where one would be installed, then the plugin pressed and what comes
 * with it, then under 可选 what it can use, each followed while on by what that one requires. A switch the seller turns draws the rows again.
 */
function installBody(context: CardContext, flips: Set<string>, chosen: (plan: InstallPlan) => void, now: () => InstallPlan): HTMLElement {
  const { say } = context;
  const box = h("div", { class: "pl-card-rows" });
  const said = saidLine();
  const draw = (focus?: string): void => {
    const plan = now();
    chosen(plan);
    // A bundle whose every member is switched off installs nothing: its Install is marked off, with no word of its own.
    box.closest?.("dialog")?.querySelector(".pl-card-acts button.primary")?.toggleAttribute("disabled", plan.todo.length === 0);
    const row = (one: InstallRow): HTMLElement => {
      const name = nameIn(one.plugin, context.language);
      const slot = `card switch ${one.plugin.id}`;
      const users = one.users.map((user) => nameIn(user, context.language));
      const why = say("pl.c.comesWith", { names: context.list(users) });
      const end = one.role === "pressed" ? undefined
        : one.role === "held" ? tip(h("span", { class: "pl-done-mark", role: "img", "aria-label": say("pl.installedName", { name }) }, "✓"), say("pl.installedName", { name }))
        : switchButton({ label: say("pl.c.alsoInstall", { name }), on: one.on,
          turn: () => { if (flips.has(one.plugin.id)) flips.delete(one.plugin.id); else flips.add(one.plugin.id); draw(slot); },
          ...(one.role === "locked" ? { refuse: () => refused(drawn, why, said) } : {}) }).element;
      end?.setAttribute("data-focus", slot);
      const drawn = cardRowOf(context, one.plugin, one.role === "locked" && users.length > 0 ? [mark(context, users)] : [], end, [!one.on && "pl-left", one.under && "pl-under"]);
      return drawn;
    };
    box.replaceChildren(...[
      plan.third.length > 0 && h("p", { class: "pl-card-warn" }, rowIcon("alert"), h("span", {}, say("pl.c.thirdIn1"))),
      part(plan.rows.filter((one) => !one.optional).map(row)),
      part(plan.rows.filter((one) => one.optional).map(row), say("pl.dp.optional")),
      said,
    ].filter((one): one is HTMLElement => one !== false && one !== undefined));
    if (focus !== undefined) placed(box, focus)?.focus({ preventScroll: true });
  };
  draw();
  return box;
}

/** A group of a card's rows, under its name where it has one; a group with no row is not drawn. */
const part = (rows: readonly HTMLElement[], label?: string): HTMLElement | undefined =>
  rows.length === 0 ? undefined : h("div", { class: "pl-card-part" }, label !== undefined && h("p", { class: "pl-card-label" }, label), h("ul", { class: "pl-list pl-rows" }, ...rows));

/** Sheet 1's mark of the plugins that cannot work without a row's, on a card; its card stands where the card's room asks. */
export function usedByMark(context: Pick<CardContext, "say" | "language">, names: readonly string[], at: TipAt = "below"): HTMLButtonElement {
  return rowMark("needed", context.say("pl.mark.usedBy"), names, context.language === "zh" ? "、" : ", ", context.language === "zh" ? "：" : ": ", at);
}
const mark = (context: CardContext, names: readonly string[]): HTMLButtonElement => usedByMark(context, names);

/** A switch that holds: its row's second line says why, and so does the card to a screen reader. */
function refused(row: HTMLElement, why: string, said: HTMLElement): void {
  const line = row.querySelector<HTMLElement>(".pl-row-line");
  if (line !== null) line.textContent = why;
  row.classList.add("pl-why");
  said.textContent = why;
}

/** A plugin on a card: the one row (`plugins-row.ts`), with the page's head of it where the page gives one. */
function cardRowOf(context: CardContext, plugin: Plugin, marks: readonly Child[], end: Child, classes: readonly (string | false)[]): HTMLElement {
  const head = context.head?.(plugin) ?? { tile: context.tile(plugin), name: h("span", { class: "pl-row-name" }, h("a", { class: "pl-row-link", href: href.item(plugin) }, h("strong", {}, nameIn(plugin, context.language)))), line: plugin.about[context.language] ?? plugin.about.en ?? "" };
  return cardRow(head, marks, end, classes);
}

/** The rule that cx buys without asking each time, with a way to stop being told it: the press takes the line, and the keyboard it had goes to the card's middle, where the card opened. */
function ruleLine(context: CardContext, words: string): HTMLElement {
  const line = h("p", { class: "pl-rule" }, h("span", {}, words));
  line.append(h("button", { type: "button", class: "pl-more-link", onclick: () => {
    context.seeRule?.();
    const middle = line.closest?.("dialog")?.querySelector<HTMLElement>(".pl-card-body");
    line.remove();
    middle?.focus?.({ preventScroll: true });
  } }, context.say("pl.c.hide")));
  return line;
}

/**
 * Removes an item behind the remove card (sheet 2c): with it go the plugins it requires that nothing else installed requires, unless the
 * seller switches one on; what requires it stays, switched off. A bundle takes its plugins by the same rule. A removal tried again asks its
 * card again. `confirmed` is the box rig's, which has no card to press: the card is not drawn.
 */
export function remove(context: CardContext, item: Item, confirmed = false): Promise<boolean> {
  const flips = new Set<string>();
  const now = (): RemovePlan => removePlan(context.held, item, flips);
  let plan = now();
  // A source's saved key goes only once its removal is done, so a later install starts with none: a removal that failed, waits or ended
  // unsaid deletes no key. A model maker's own keys and sign-ins go in the removal's own write.
  const work = async (): Promise<void | "unsaid"> => {
    const keyed = plan.gone.filter((plugin) => plugin.source !== undefined && keyHeld(context.held, plugin));
    const how = await sendAll(context, async (clicks) => {
      // What cannot work without what goes is switched off first, so nothing that stays runs short of a plugin.
      for (const plugin of plan.off.filter((one) => isOn(context.held, one))) {
        if (plugin.model !== undefined) await context.backend.setModel(plugin.id, false);
        else if (plugin.box !== undefined) clicks.push(await context.backend.setPackage(sourceFor(context.held, plugin)!, false));
      }
      // A bundle's Remove is one click, of its members that go, what needs another first; the platform takes only members in it, so what a
      // member builds on goes after it, each its own click, and a refused Remove sends none of them.
      const packages = isBundle(item) ? plan.gone.filter((plugin) => plugin.model === undefined && plugin.box !== undefined && membersOf(context.held, item).includes(plugin)) : [];
      if (isBundle(item) && packages.length > 0) clicks.push(...await context.backend.removeBundle(item.id, packages.map((plugin) => sourceFor(context.held, plugin)!)));
      for (const plugin of plan.gone) {
        if (plugin.model !== undefined) await context.backend.installModel(plugin.id, false);
        else if (plugin.box !== undefined && !packages.includes(plugin)) clicks.push(await context.backend.installPackage(sourceFor(context.held, plugin)!, false));
      }
    }, about);
    if (how !== "done") return how;
    for (const plugin of keyed) await context.backend.removeSourceKey(plugin.source!.name);
    return undefined;
  };
  const told = context.say("pl.toastRemoved", { name: nameIn(item, context.language) });
  const failed = context.say("pl.toastNotRemoved", { name: nameIn(item, context.language) });
  const about: About = { item, act: "remove", get parts() { return plan.gone; } };
  // A bundle is its plugins, so one whose every plugin stays has nothing a removal could take: its card offers no act.
  const none = isBundle(item) && plan.gone.length === 0;
  if (confirmed) return none ? Promise.resolve(false) : context.run(work, told, failed, about);
  return open(context, item, "pl.c.removeTitle", "pl.c.remove", work, told, failed, () => [...removeSays(context, item), removeBody(context, item, flips, (next) => { plan = next; }, now)], about, cardFor(context.held, "remove", item), undefined, nameIn(item, context.language), none);
}

/** The remove card's one line, where its state has one (sheet 2c): what goes with the plugin that no row shows. */
function removeSays(context: CardContext, item: Item): readonly HTMLElement[] {
  const { say, held } = context;
  if (isBundle(item)) return [];
  return [
    isBase(held, item) && say("pl.c.baseStops"),
    chatOn(held, item) && say("pl.c.chatNone"),
    item.model !== undefined && connectedWays(held, item).some((way) => way !== "platform") && say("pl.c.stopModel", { vendor: vendorIn(item, context.language) }),
    item.source !== undefined && keyHeld(held, item) && say("pl.c.stopKey"),
    connected(held, item) && say("pl.c.connectionsStay"),
    // Nothing offers a plugin the person installed themselves, so its card says how it comes back.
    item.own === true && say("pl.c.ownBack", { name: nameIn(item, context.language) }),
  ].filter((one): one is string => typeof one === "string").map((line) => h("p", {}, line));
}

/** The remove card's rows in their two groups: what the removal takes or leaves of what it requires, then what stays switched off. */
function removeBody(context: CardContext, item: Item, flips: Set<string>, chosen: (plan: RemovePlan) => void, now: () => RemovePlan): HTMLElement {
  const { say } = context;
  const box = h("div", { class: "pl-card-rows" });
  const said = saidLine();
  const names = (plugins: readonly (Plugin | Bundle)[]): string => context.list(plugins.map((one) => nameIn(one, context.language)));
  const draw = (focus?: string): void => {
    const plan = now();
    chosen(plan);
    const row = (one: RemoveRow): HTMLElement => {
      const name = nameIn(one.plugin, context.language);
      const slot = `card switch ${one.plugin.id}`;
      const why = one.role === "off" ? say("pl.c.needsOne", { names: name, name: nameIn(one.lost!, context.language) }) : say("pl.c.stillUsed", { names: names(one.users) });
      const free = one.role === "go" || one.role === "kept";
      const toggle = switchButton({ label: one.role === "off" ? name : say("pl.c.keep", { name }), on: one.role === "kept" || one.role === "stay",
        turn: () => { if (flips.has(one.plugin.id)) flips.delete(one.plugin.id); else flips.add(one.plugin.id); draw(slot); },
        ...(free ? {} : { refuse: () => refused(drawn, why, said) }) }).element;
      toggle.setAttribute("data-focus", slot);
      const drawn = cardRowOf(context, one.plugin, one.users.length > 0 ? [mark(context, one.users.map((user) => nameIn(user, context.language)))] : [], toggle, [one.role === "go" && "pl-left"]);
      return drawn;
    };
    box.replaceChildren(...[
      part(plan.rows.filter((one) => one.role !== "off").map(row), say(isBundle(item) ? "pl.tab.plugins" : "pl.c.rmUses")),
      part(plan.rows.filter((one) => one.role === "off").map(row), say("pl.c.usedBy")),
      said,
    ].filter((one): one is HTMLElement => one !== undefined));
    // A bundle with every plugin kept has nothing to remove, as an install with every plugin off has nothing to install.
    if (isBundle(item)) box.closest?.("dialog")?.querySelector(".pl-card-acts button.primary")?.toggleAttribute("disabled", plan.gone.length === 0);
    if (focus !== undefined) placed(box, focus)?.focus({ preventScroll: true });
  };
  draw();
  return box;
}

/**
 * Turns a plugin off: behind a card where something that is on stops working with it, or the chat is on its models, so the person
 * sees what stops before it does; else at once, with no word said since the switch shows it. Answers whether it is off.
 */
export function turnOff(context: CardContext, plugin: Plugin, confirmed = false): Promise<boolean> {
  const users = stopsIf(context.held, plugin);
  const chat = chatOn(context.held, plugin);
  const about: About = { item: plugin, act: "off" };
  const work = (): Promise<void | "unsaid"> => turn(context, plugin, false, about);
  const told = "";
  const failed = context.say("pl.toastNotOff", { name: nameIn(plugin, context.language) });
  if ((users.length === 0 && !chat) || confirmed) return context.run(work, told, failed, about);
  const base = plugin.box !== undefined && plugin.source === undefined && users.some((user) => user.source !== undefined);
  return open(context, plugin, "pl.c.offTitle", "", work, told, failed, () => [
    plugin.source !== undefined && (!ownAccount(context.held, plugin) || ownConnected(context.held, plugin)) && h("p", {}, ownAccount(context.held, plugin) ? context.say("pl.c.stopBox", { name: nameIn(plugin, context.language) }) : context.say("pl.c.offStops", { name: sourceOf(context.held, plugin)?.supplier ?? nameIn(plugin, context.language) })),
    chat && h("p", {}, context.say("pl.c.chatNone")),
    base && h("p", {}, context.say("pl.c.baseStops")),
    // Only a data source's users lose its data; anything else's stop working.
    users.length > 0 && h("p", {}, context.say(plugin.source !== undefined && !base ? "pl.c.offUsers" : users.length === 1 ? "pl.c.offBaseUser" : "pl.c.offBaseUsers", { names: context.list(users.map((user) => nameIn(user, context.language))) })),
  ], about, cardFor(context.held, "off", plugin), context.say("pl.c.turnOff", { name: nameIn(plugin, context.language) }));
}

/**
 * Turns a plugin on: a source behind a card with its price in view, since it starts buying, and said once done; anything else at once,
 * with no word said since the switch shows it. `confirmed` is the box rig's, which has no card to press: the card is not drawn.
 */
export function turnOn(context: CardContext, plugin: Plugin, confirmed = false): Promise<boolean> {
  const about: About = { item: plugin, act: "on" };
  const work = (): Promise<void | "unsaid"> => turn(context, plugin, true, about);
  const told = plugin.source !== undefined ? context.say("pl.toastOn", { name: nameIn(plugin, context.language) }) : "";
  const failed = context.say("pl.toastNotOn", { name: nameIn(plugin, context.language) });
  if (plugin.source === undefined || confirmed) return context.run(work, told, failed, about);
  // The card names the supplier it starts buying from, and shows every price before the person agrees to pay.
  return open(context, plugin, "pl.c.onTitle", "", work, told, failed, () => [
    ...context.prices(plugin),
    !ruleSeen(context) && ruleLine(context, context.say("pl.c.onRule", { name: nameIn(plugin, context.language) })),
    !context.byKey(plugin) && context.balance !== undefined && h("p", {}, context.say("pl.c.balance", { amount: context.balance })),
  ], about, cardFor(context.held, "on", plugin), context.say("pl.c.turnOn"), context.held.sources.find((one) => one.name === plugin.source?.name)?.supplier);
}

/**
 * One drawing for every card: the item's mark and the question, what it says, what stands with the buttons whatever is scrolled, and Cancel
 * beside the act, or alone where the card has nothing to do. It opens at its title with the keyboard on its middle. Escape and a click outside are Cancel. The address names the card while it is open: Back closes it and
 * stays on the page, and a reload opens it again; closed, it takes its address with it, and the act is done once the page's address stands.
 */
function open(context: CardContext, item: Plugin | Bundle, title: StringKey, act: StringKey | "", work: () => Promise<void | "unsaid">, told: string | (() => string), failed: string,
  body: () => readonly Child[], about: About | undefined, name: string | undefined, actWords?: string, named: string = nameIn(item, context.language), idle = false): Promise<boolean> {
  const before = globalThis.document?.activeElement as HTMLElement | null | undefined;
  return new Promise((resolve) => {
    const dialog = h("dialog", { class: "f-dialog pl-card-dialog", "aria-labelledby": "pl-card-title", tabindex: "-1", "data-card": name });
    let settled = false;
    // An address that names the card no longer, by Back or a link, is Cancel: a card never outlives the address it stands over.
    const left = (): void => { if (name === undefined || cardOf(globalThis.location?.hash ?? "") !== name) close(false); };
    globalThis.addEventListener?.("hashchange", left);
    const close = (done: boolean, here = true): void => {
      if (settled) return;
      settled = true;
      globalThis.removeEventListener?.("hashchange", left);
      dialog.close?.();
      dialog.remove();
      if (here) void cardShut(name);
      // The control that was pressed may be drawn anew under the card, as Back draws the page: the keyboard goes where the page
      // says a closed card's goes, else to the control now at that place.
      const place = before?.dataset?.["focus"];
      if (!done) (before?.isConnected === false ? context.returnTo?.() ?? (place === undefined ? undefined : placed(globalThis.document, place)) ?? before : before)?.focus?.();
      resolve(done);
    };
    // Escape and a press on the dimmed page close the box; the card's own Cancel follows.
    dialog.addEventListener("close", () => close(false));
    // A link in the card goes to its own page from the card's address, so Back from there finds the card again.
    dialog.addEventListener("click", (event) => { if ((event.target as Element | null)?.closest?.("[data-close]")) close(false, false); });
    const cancel = h("button", { type: "button", class: "f-btn", onclick: () => close(false) }, context.say("pl.c.cancel"));
    const body0 = h("div", { class: "pl-card-body", tabindex: "-1" }, ...body());
    const go = h("button", { type: "button", class: "f-btn primary", onclick: async () => {
      go.setAttribute("disabled", "");
      settled = true;
      dialog.close?.();
      dialog.remove();
      globalThis.removeEventListener?.("hashchange", left);
      await cardShut(name);
      resolve(await context.run(work, typeof told === "string" ? told : told(), failed, about));
    } }, actWords ?? context.say(act as StringKey));
    dialog.append(
      h("div", { class: "pl-card-head" }, context.tile(item, true), h("div", { class: "pl-card-headtext" }, h("h2", { id: "pl-card-title" }, context.say(title, { name: named })),
        // A plugin is installed on its maker's name, its version and its date, so the card that asks says them again.
        // A third party's says it is one, as its card, its row and its page's head do; its warning below names who made it.
        about?.act === "install" && !isBundle(item) && h("p", { class: "quiet pl-card-by" }, !madeByUs(item) && (item.npm !== undefined || item.own === true) ? thirdMark(context.say) : context.meta(item)),
        // A bundle is installed on its maker's name too.
        about?.act === "install" && isBundle(item) && item.author !== "" && h("p", { class: "quiet pl-card-by" }, context.say("pl.by", { name: item.author })))),
      body0,
      h("div", { class: "f-acts pl-card-acts" }, cancel, !idle && go),
    );
    context.host().append(dialog);
    // The keyboard is on the card's middle, the part that scrolls, so its keys scroll it and neither button is one key away from a press nobody read.
    modal(dialog, body0)(before ?? body0);
    cardShown(name);
    body0.focus?.({ preventScroll: true });
    body0.scrollTop = 0;
    markCut(body0);
  });
}

/**
 * Says on a card's middle which way it goes on — `data-more` holds `above`, `below` or both while more than is in view lies that way —
 * and says it again as the middle is scrolled and as it or one of its parts changes size.
 */
export function markCut(middle: HTMLElement): void {
  const read = (): void => {
    const more = [middle.scrollTop > 1 && "above", middle.scrollHeight - middle.clientHeight - middle.scrollTop > 1 && "below"].filter((one) => one !== false).join(" ");
    if (more === "") middle.removeAttribute?.("data-more"); else middle.setAttribute?.("data-more", more);
  };
  middle.addEventListener?.("scroll", read, { passive: true });
  if (typeof globalThis.ResizeObserver === "function") { const sized = new globalThis.ResizeObserver(read); for (const one of [middle, ...Array.from(middle.children ?? [])]) sized.observe(one); }
  read();
}

/** The place a needs line's act holds: several plugins can lack the same one, and each line's act is its own. */
export const needPlace = (plugin: Plugin, root: Plugin): string => `need ${plugin.id} ${root.id}`;
/** The place of the try on the failure a needs line's act left under it. */
export const needAgainPlace = (plugin: Plugin, root: Plugin): string => `need-again ${plugin.id} ${root.id}`;

/**
 * What a plugin that is on needs before it works, in the one drawing its page and its Yours row share, each line with the act that
 * clears it: connect a model, or install or turn on a plugin its chain lacks. While a click on that plugin is out or waits, the act
 * gives way to its mark and takes no second change. Nothing where the held reads failed.
 */
export function needsLine(context: Pick<CardContext, "held" | "say" | "language"> & { readonly doing: Pick<Doing, "busy"> }, plugin: Plugin, unread: boolean, acts: { readonly install: (root: Plugin) => void; readonly turnOn: (root: Plugin) => void; readonly under?: (root: Plugin, kind: "gone" | "off") => Child; /** Whether the line that it is not connected is drawn. */ readonly connect?: boolean }, row = false): readonly Child[] {
  if (unread) return [];
  const { say } = context;
  const box = (...children: readonly Child[]): HTMLElement => h("div", { class: row ? "pl-needs pl-needs-row" : "pl-needs", role: "status" }, ...children);
  return needsOf(context.held, plugin).flatMap((needs): readonly Child[] => {
    if (needs.kind === "connect") return acts.connect === false ? [] : [box(h("span", {}, say("pl.need.connect")), h("a", { class: "pl-needs-act", href: `${href.item(plugin)}/settings` }, say("pl.need.connectAct", { name: nameIn(plugin, context.language) })))];
    const root = needs.root;
    const busy = context.doing.busy(root);
    // The press is about another plugin than the one it stands under: what it failed to do is said here, where it was pressed.
    return [box(h("span", {}, needs.kind === "gone" ? say("pl.need.gone", { plugin: nameIn(plugin, context.language), name: nameIn(root, context.language) }) : say("pl.need.off", { name: nameIn(root, context.language) })),
      busy !== undefined ? busyMark(say, context.language, root, busy, "line", needPlace(plugin, root)) : h("button", { type: "button", "data-focus": needPlace(plugin, root), "data-card": cardFor(context.held, needs.kind === "gone" ? "install" : "on", root), onclick: () => (needs.kind === "gone" ? acts.install(root) : acts.turnOn(root)) }, say(needs.kind === "gone" ? "pl.need.install" : "pl.need.turnOn", { name: nameIn(root, context.language) }))),
      acts.under?.(root, needs.kind) ?? false];
  });
}

/**
 * A failed click tried again: the same act on the same record, doing only what is still left to do, asking its card again as the first
 * press did.
 */
export function again(context: CardContext, item: Item, failed: Pick<Failed, "act">): Promise<boolean> {
  const { act } = failed;
  if (act === "install") return install(context, item);
  if (act === "remove") return remove(context, item);
  // An update is tried again by Update's own press, which the page that drew it holds: here it switches nothing.
  if (isBundle(item) || act === "update") return Promise.resolve(false);
  return act === "on" ? turnOn(context, item) : turnOff(context, item, true);
}

/**
 * Where a person asks for help with a failure: the support address as words they can copy, since not every seller has a mail program
 * that opens, and a draft that already names the plugin and says what the page said.
 */
function helpActs(say: CardContext["say"], language: Language, help: string, item: Item, said: string): readonly Child[] {
  const address = help.startsWith("mailto:") ? help.slice("mailto:".length) : undefined;
  const link = address === undefined ? help : `mailto:${address}?subject=${encodeURIComponent(nameIn(item, language))}&body=${encodeURIComponent(said)}`;
  return [h("a", { class: "pl-failed-help", href: link }, say("menu.help")), address !== undefined && h("span", { class: "pl-failed-address" }, address)];
}

/**
 * A failed click's line, in the one drawing a card, a row and a record's page share: what did not happen and why, which parts of a
 * longer install are in, and the step that can change it — Try again where a second try can, named for what it does where it installs
 * the rest, and from the second failure how many times it has failed beside the way to help, which the sentence does not grow by.
 * The sentence alone is announced; its steps follow it as the controls they are.
 */
export function failureLine(context: Pick<CardContext, "held" | "say" | "list" | "language">, item: Item, failed: Failed, acts: { readonly retry: () => void; readonly help: string; readonly retryPlace?: string }, place: "page" | "row" | "card" = "page"): HTMLElement {
  const words = failureWords(context.say, context.language, context.list, context.held, item, failed);
  const said = sentences([words.what, words.why]);
  // Only pi's own words are quoted: what cx's computer or the platform says of a failure is its line, never a quotation beside it.
  const quoted = failed.reason === "pi_failed" && failed.detail !== undefined && failed.detail.trim() !== "" ? piWords(failed.detail) : undefined;
  // Left on, the plugin has one thing to say, in the page's own ink: nothing to try again and nothing to count.
  if (words.on) return h("p", { class: place === "page" ? "pl-fact" : `pl-fact pl-fact-${place}`, role: "status", "data-for": href.item(item) }, said);
  return h("div", { class: place === "page" ? "pl-failed" : `pl-failed pl-failed-${place}`, "data-for": href.item(item) },
    h("span", { class: "pl-failed-text", role: "alert" }, said, quoted !== undefined && " ", quoted !== undefined && h("span", { class: "pl-failed-words", lang: "en" }, context.say("signIn.quoted", { words: quoted }))),
    h("span", { class: "pl-failed-acts" },
      words.retry && h("button", { type: "button", class: "pl-again", "data-focus": acts.retryPlace, onclick: acts.retry }, context.say("pl.tryAgain")),
      ...(words.repeated !== undefined ? [h("span", { class: "pl-failed-count" }, words.repeated), ...helpActs(context.say, context.language, acts.help, item, sentences([said, words.repeated]))] : [])));
}

/** The most of pi's words a failure line quotes: the end of what it wrote, where the error it stopped on is. */
const PI_WORDS = 400;
/** pi's words on one line, the end of them where they run long. */
export function piWords(detail: string): string {
  const one = detail.replace(/\s+/g, " ").trim();
  return one.length <= PI_WORDS ? one : `…${one.slice(-PI_WORDS).replace(/^\S*\s/, "")}`;
}

/** What the page heard a record is, each said once in the page's own ink: nothing failed, so nothing counts and nothing is tried again. */
export function factLine(context: Pick<CardContext, "held" | "say" | "language">, item: Item, facts: ReadonlySet<Fact>, place: "page" | "row" | "card" = "page", stopped = false): Child {
  return facts.size > 0 && h("p", { class: place === "page" ? "pl-fact" : `pl-fact pl-fact-${place}`, role: "status" }, factWords(context.say, context.language, context.held, item, facts, stopped));
}

/**
 * A shelf's cards are all one size, the tallest's, and a line under one card must not change that: the size the cards have without
 * the line is measured and held while the line stands, and its row takes only the room its words need.
 */
export function holdRows(root: ParentNode | undefined): void {
  for (const grid of root?.querySelectorAll?.<HTMLElement>(".pl-cards") ?? []) {
    // Nothing is measured where nothing is laid out.
    if (typeof grid.getBoundingClientRect !== "function" || typeof grid.style?.setProperty !== "function") continue;
    const cards = ([...grid.children] as HTMLElement[]).filter((one) => one.classList.contains("pl-card"));
    const lines = ([...grid.children] as HTMLElement[]).filter((one) => !one.classList.contains("pl-card"));
    grid.style.removeProperty("grid-auto-rows");
    for (const card of cards) card.style.removeProperty("min-height");
    if (lines.length === 0) continue;
    for (const line of lines) line.style.display = "none";
    const height = cards[0]?.getBoundingClientRect().height;
    for (const line of lines) line.style.removeProperty("display");
    if (height === undefined || height === 0) continue;
    for (const card of cards) card.style.setProperty("min-height", `${height}px`);
    grid.style.setProperty("grid-auto-rows", "auto");
  }
}
