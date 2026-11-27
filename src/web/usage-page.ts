import { type AccountMoney, type Backend, type Features, type Me, type Models, type MoneyLot, type RecordEntry, type SpanId, type SpanSpending, type Subscription, type Terms } from "./backend.js";
import { h, type Child } from "./dom.js";
import { choice } from "./forms.js";
import { drawChart, seriesOf, spanMenu, styled, viewOf, type By } from "./spend-chart.js";
import { localDay, tie, type Writer } from "./settings-words.js";
import type { Paying } from "./paying.js";
import type { Say } from "./stream-view.js";
import { SITE_PAGES } from "./site-pages.js";
import type { StringKey } from "./strings.js";

type SignedIn = Extract<Me, { kind: "signed_in" }>;
/** One read of the account the Settings window's opening makes: 用量 draws from all of them, 账单 and the sheet from those they draw. */
export type UsageRead = "money" | "me" | "subscription" | "record" | "spending" | "models" | "terms";
/** What one opening of the window read: each read alone, `undefined` where it could not be read or has not answered. */
export type UsageReads = {
  readonly money: AccountMoney | undefined; readonly me: SignedIn | undefined; readonly subscription: Subscription | undefined;
  readonly record: readonly RecordEntry[] | undefined; readonly spending: SpanSpending | undefined; readonly models: Models | undefined;
  readonly states: (kind: "vendor" | "source", id: string) => string | undefined;
  /** Read at every opening: the trial's figure the line under the balance promises, and the fee a period paid from the balance cost. */
  readonly terms: Terms | undefined;
};
export type UsagePorts = {
  readonly backend: Backend; readonly say: Say; readonly features: () => Features;
  /** The Plugins page's address and name for what a line spent on: a model's vendor by its provider id, a data source by its name. */
  readonly plugin: (kind: "vendor" | "source", id: string) => { readonly href: string; readonly name: string } | undefined;
  /** Where no record names it, what the rest of the app calls it: a source by its row's name in the sidebar. */
  readonly name?: (kind: "vendor" | "source", id: string) => string | undefined;
  /** Whether the account is offered the invitation sheet: the last reward's part leads there. */
  readonly inviting: () => boolean;
  /** What the Plugins page says beside each plugin's name, read afresh at the opening. */
  readonly states: () => Promise<(kind: "vendor" | "source", id: string) => string | undefined>;
  /** Draws the pane again, the keyboard back on the control `key` names, brought into view where `reveal` asks. */
  readonly redraw: (key?: string, reveal?: boolean) => void;
  /** Whether the window shows 用量 now. */
  readonly shown: () => boolean;
  /** The payment the seller has come back from, whose answer leads the page while it stands. */
  readonly paying: Paying;
};

/** A lot near its end says the days left; a list shows its first rows and folds the rest. */
const SOON_DAYS = 7;
const SHOWN = 3;
const DEFAULT_SPAN: SpanId = "mo1";
/** The spans that end before today: what they spent is settled. */
const PAST_SPANS: readonly SpanId[] = ["yesterday", "lastWeek", "lastMonth", "lastYear"];

/**
 * 用量: the balance opened up into the lots it is made of, what a span spent and on what, and the record of the money that came without a
 * payment. Every figure is a field the platform served at this opening; a failed read of the money or the spending says so where its
 * figures would stand, while the record, the terms and the models draw no line of their own when theirs fails.
 */
export class UsagePage {
  #reads: UsageReads | undefined;
  #span: SpanId = DEFAULT_SPAN;
  #by: By = "plugin";
  #record = false;
  /** A span wholly past, as last read today: what it spent no longer moves, so a read of it that fails draws this one. */
  readonly #past = new Map<SpanId, { readonly day: string; readonly spending: SpanSpending }>();
  constructor(readonly ports: UsagePorts) {}

  /** A span's spending, read; a span wholly past that cannot be read stays as it was last read today. */
  #spending(span: SpanId): Promise<SpanSpending | undefined> {
    const day = localDay(this.ports.backend.now());
    return this.ports.backend.spending(span).then((spending) => {
      if (PAST_SPANS.includes(span)) this.#past.set(span, { day, spending });
      return spending;
    }, () => { const kept = this.#past.get(span); return kept?.day === day ? kept.spending : undefined; });
  }

  get reads(): UsageReads | undefined { return this.#reads; }

  /**
   * An opening starts with nothing read, and an answer still out lands where it arrives. An opening from the page starts on the past
   * month, as the window shows it at its first opening; Back or Forward into the window is the same opening going on, and keeps the
   * span, the grouping and the record's fold.
   */
  begin(fresh = true, span: SpanId = DEFAULT_SPAN): void {
    this.#statesRead = false;
    if (fresh) {
      this.#span = span;
      this.#by = "plugin";
      this.#record = false;
    }
    this.#reads = { money: undefined, me: undefined, subscription: undefined, record: undefined, spending: undefined, models: undefined, states: () => undefined, terms: undefined };
  }

  /** The window closed: what its opening still has out lands nowhere until the next opening. */
  end(): void { this.#reads = undefined; }

  /** One of the opening's reads, asked once by the window for every pane and question of the opening that draws from it. */
  read(read: UsageRead): Promise<void> {
    const { backend } = this.ports;
    const quiet = <T>(value: Promise<T>): Promise<T | undefined> => value.catch(() => undefined);
    if (read === "spending") {
      const span = this.#span;
      // The span changes with its answer, as a pick's does, so the two are never apart.
      return this.#spending(span).then((spending) => {
        if (this.#reads === undefined) return;
        this.#span = span;
        this.#reads = { ...this.#reads, spending };
      });
    }
    const asking: Promise<UsageReads[Exclude<UsageRead, "spending">]> = read === "money" ? quiet(backend.accountMoney())
      : read === "me" ? quiet(backend.me()).then((me) => me?.kind === "signed_in" ? me : undefined)
      : read === "subscription" ? quiet(backend.subscription()) : read === "record" ? quiet(backend.record())
      : read === "models" ? quiet(backend.models()) : quiet(backend.terms());
    return asking.then((value) => {
      if (this.#reads === undefined) return;
      this.#reads = { ...this.#reads, [read]: value };
    });
  }

  #statesRead = false;

  /**
   * What the Plugins page says beside each plugin, read once an opening shows 用量: it is the whole of that page's reads, so 用量 draws
   * without it, as 账单 never needs it, and the words come in beside each line when it answers.
   */
  readStates(): void {
    if (this.#statesRead) return;
    this.#statesRead = true;
    void this.ports.states().then((said) => {
      if (this.#reads === undefined) return;
      this.#reads = { ...this.#reads, states: said };
      if (this.ports.shown()) this.ports.redraw();
    }, () => undefined);
  }

  /** The account again after a move made in the window: what the money, the account and the membership hold now, the view kept. */
  async reread(): Promise<void> {
    const { backend } = this.ports;
    const quiet = <T>(read: Promise<T>): Promise<T | undefined> => read.catch(() => undefined);
    const [money, me, subscription, record] = await Promise.all([quiet(backend.accountMoney()), quiet(backend.me()), quiet(backend.subscription()), quiet(backend.record())]);
    if (this.#reads === undefined) return;
    this.#reads = { ...this.#reads, money, me: me?.kind === "signed_in" ? me : undefined, subscription, record };
  }

  /**
   * Another section was chosen: 用量 is met again as an opening meets it, on the past month, by plugin, the record folded. The past
   * month's spending is read now, and 用量 is drawn again if it is shown by the time it answers.
   */
  leave(): void {
    this.#by = "plugin";
    this.#record = false;
    if (this.#span === DEFAULT_SPAN) return;
    // As a pick does, the span changes with its answer, so the two are never apart.
    void this.#spending(DEFAULT_SPAN).then((spending) => {
      if (this.#reads === undefined) return;
      this.#span = DEFAULT_SPAN;
      this.#reads = { ...this.#reads, spending };
      if (this.ports.shown()) this.ports.redraw();
    });
  }

  /**
   * Another span is read when chosen, and takes effect when it answers: until then the menu, the total, the range, the bars and the
   * download all name the span the held answer is for. One that fails is drawn as unread under the span it asked for, but a span wholly
   * past that was read today, which stays as it was.
   */
  async #pick(span: SpanId): Promise<void> {
    const spending = await this.#spending(span);
    if (this.#reads === undefined) return;
    this.#span = span;
    this.#reads = { ...this.#reads, spending };
    this.ports.redraw("span");
  }

  draw(w: Writer): readonly Child[] {
    const reads = this.#reads;
    if (reads === undefined) return [];
    return [...this.#top(reads, w), ...this.#lots(reads, w), ...this.#spent(reads, w), ...this.#history(reads, w)];
  }

  /** A member's own 用量: their spending alone, with no money of the organization's (Claude's help: "This page shows only your own usage."). */
  spent(w: Writer): readonly Child[] {
    const reads = this.#reads;
    return reads === undefined ? [] : this.#spent(reads, w);
  }


  #top(reads: UsageReads, w: Writer): readonly Child[] {
    const say = this.ports.say;
    const money = reads.money;
    const quietLine = (words: readonly Child[] | string): HTMLElement => h("p", { class: "sw-help quiet" }, ...(typeof words === "string" ? [words] : words));
    if (money === undefined) {
      return [h("div", { class: "sw-top opens" }, h("p", { class: "quiet" }, say("sw.balance")), h("div", { class: "sw-top-line" }, h("p", { class: "sw-figure unread" }, say("sw.unread"))), quietLine(say("sw.retry")))];
    }
    const own = ownModel(reads);
    const figure = own !== undefined ? money.model_figure : money.figure;
    return [h("div", { class: "sw-top opens" }, ...this.ports.paying.lead(w, this.ports.say), ...leadsOf(reads, money, own !== undefined, w, this.ports.say, this.ports.paying),
      h("p", { class: "quiet" }, say("sw.balance")),
      h("div", { class: "sw-top-line" }, h("p", { class: "sw-figure" }, amount(figure, w)), termsLink(say, w, "sw.lotsRules", "balance")),
      money.debt > 0 && quietLine(around(say, "sw.debtHelp", "amount", amount(money.debt, w))))];
  }

  #lots(reads: UsageReads, w: Writer): readonly Child[] {
    const say = this.ports.say;
    const money = reads.money;
    if (money === undefined) return [];
    const endsLine = (lot: MoneyLot): string => {
      const day = w.dayName(lot.ends_on);
      if (lot.kind === "included") return say("sw.lotIncludedEnds", { day });
      if (lot.kind === "sign_up") return say("sw.lotEnds", { day });
      return lot.days_left === 0 ? say("sw.lotEndsToday") : lot.days_left <= SOON_DAYS ? say("sw.lotEndsSoon", { day, span: say(lot.days_left === 1 ? "sw.day" : "sw.days", { n: lot.days_left }) }) : say("sw.lotEnds", { day });
    };
    const given = money.lots.filter((lot) => lot.kind !== "top_up");
    // Where the period's credit is used up and the next period will start, the credit's place says when the next comes and how much.
    // An organisation's renewal sent without its price has no amount to say: its credit's place is not drawn.
    const next = money.renewal.price;
    const renews = next !== undefined && money.state === "member" && money.member !== undefined && !given.some((lot) => lot.kind === "included")
      && (reads.subscription?.status === "active" || (money.member.switch === true && money.renewal.short === 0));
    const parts: readonly (MoneyLot | "next")[] = renews ? ["next", ...given] : given;
    const lastReward = given.findLast((lot) => lot.kind === "reward");
    const part = (one: MoneyLot | "next", at: number, alone: boolean): HTMLElement => {
      const id = `sw-lot-${at}`;
      // The rewards lead to the sheet they come from.
      const more = one === lastReward && this.ports.inviting();
      const name = h("div", { class: alone ? "sw-head" : "sw-sublot-head" }, h(alone ? "h3" : "h4", { id }, say(one === "next" ? "sw.lot.included" : `sw.lot.${one.kind}`)), one !== "next" && amount(one.remainder, w, "sw-amount-cell"));
      return h(alone ? "section" : "div", { class: `${alone ? "sw-group sw-lot" : "sw-sublot"}${one === "next" ? " sw-next" : ""}`, "aria-labelledby": alone ? id : undefined }, name,
        ...(one === "next" ? [h("p", { class: "sw-lot-line quiet" }, say("sw.lotIncludedNext", { day: w.dayName(money.member!.renews_on), amount: w.money(next!) }))] : [
          h("div", { class: "sw-meter", "aria-hidden": "true" }, one.used > 0 && styled(h("i"), { width: `${((one.used / one.units) * 100).toFixed(2)}%` })),
          h("p", { class: "sw-lot-line quiet" }, h("span", {}, endsLine(one)), h("span", {}, ...around(say, "sw.lotUsed", "used", amount(one.used, w), {}, { whole: amount(one.units, w) })))]),
        more && h("p", { class: "sw-lot-more" }, h("a", { class: "sw-link", href: "#/invite", "data-key": "to-invite" }, say("sw.invite"))));
    };
    const givenBlock = parts.length === 1 ? part(parts[0]!, 0, true) : parts.length > 1 && h("section", { class: "sw-group sw-lot sw-given", "aria-labelledby": "sw-g-given" },
      h("div", { class: "sw-head" }, h("h3", { id: "sw-g-given" }, say("sw.lotsGiven")), amount(money.blocks.given, w, "sw-amount-cell")),
      ...parts.map((one, at) => part(one, at, false)));
    // Money paid in is a block of its own under one total and names no day; a lot within a week of its end says so on a line of its own.
    const paid = money.lots.filter((lot) => lot.kind === "top_up"), soon = paid.filter((lot) => lot.days_left <= SOON_DAYS);
    const paidBlock = paid.length > 0 && h("section", { class: `sw-group sw-lot${soon.length > 0 ? " sw-lots" : ""}`, "aria-labelledby": "sw-g-paid" },
      h("div", { class: "sw-head" }, h("h3", { id: "sw-g-paid" }, say("sw.lot.top_up")), amount(money.blocks.paid, w, "sw-amount-cell")),
      soon.length > 0 && h("ul", { class: "sw-rows" }, ...soon.map((lot) => row(endsLine(lot), undefined, amount(lot.remainder, w, "sw-amount-cell")))));
    return [givenBlock, paidBlock];
  }

  /** 花费: a span, its total and a bar for each of its minutes, hours, days or months, the window opening on the past month. */
  #spent(reads: UsageReads, w: Writer): readonly Child[] {
    const { say, backend } = this.ports;
    const answer = reads.spending;
    const span = this.#span;
    // An account that has never spent is shown what will be listed here, with no span to choose and nothing to download.
    if (neverSpent(reads.money, backend.now())) {
      return [h("section", { class: "sw-group sw-spent", "aria-labelledby": "sw-g-spending" },
        h("div", { class: "sw-head" }, h("h3", { id: "sw-g-spending" }, say("sw.spending")), h("div", { class: "sw-ctl" }, h("span", { class: "sw-value" }, say(`sw.span.${DEFAULT_SPAN}`)))),
        h("div", { class: "sw-sum" }, h("div", {}, h("p", { class: "quiet" }, say("sw.total")), h("p", { class: "sw-figure month" }, amount(answer?.total ?? 0, w)))),
        h("div", { class: "sw-empty" }, h("p", {}, say("sw.noSpending")), h("p", { class: "quiet" }, say("sw.noSpendingFill"))))];
    }
    // An account that began today has one span to show, printed, not offered.
    const head = h("div", { class: "sw-head" }, h("h3", { id: "sw-g-spending" }, say("sw.spending")), h("div", { class: "sw-ctl" },
      beganToday(reads.money, backend.now()) ? h("span", { class: "sw-value" }, say(`sw.span.${span}`)) : spanMenu(span, say, w.comma, (next) => { void this.#pick(next); })));
    const view = answer === undefined ? undefined : viewOf(answer, backend.now(), say, w);
    const sum = (by?: HTMLElement): HTMLElement => h("div", { class: "sw-sum" }, h("div", {}, h("p", { class: "quiet" }, say("sw.total")),
      answer === undefined ? h("p", { class: "sw-figure unread" }, say("sw.unread")) : h("p", { class: "sw-figure month" }, amount(answer.total, w)),
      view !== undefined && h("p", { class: "sw-span-range quiet" }, view.range)), by);
    const body = (): readonly Child[] => {
      if (answer === undefined || view === undefined) return [sum(), h("p", { class: "sw-help quiet" }, say("sw.retry"))];
      if (answer.total === 0) return [sum(), h("div", { class: "sw-empty" }, h("p", { class: "quiet" }, say("sw.noSpendingSpan")))];
      const name = (line: number): string => this.#lineName(answer, line);
      const series = seriesOf(answer, view, this.#by, name, say);
      const chart = drawChart(view, series, this.#by, { say, w, unitsPerMinor: w.unitsPerMinor, step: answer.step }, name);
      const only = (cls: string | undefined) => (): void => { if (cls === undefined) delete chart.dataset["only"]; else chart.dataset["only"] = cls; };
      const lineOf = (cls: string | undefined, label: string, units: number, quiet: string | undefined, href: string | undefined, key: string): HTMLElement => {
        const inner = [h("span", { class: `sw-swatch${cls === undefined ? "" : ` ${cls}`}`, "aria-hidden": "true" }),
          h("div", { class: "sw-text" }, h("p", { class: "sw-label" }, h("bdi", { class: "sw-line-name" }, tie(w.language, label)), href !== undefined && h("span", { class: "sw-go", "aria-hidden": "true" }, "›")), quiet !== undefined && h("p", { class: "sw-help quiet" }, quiet),
            // The computer's time is where it is said that a schedule keeps it on, and that time is charged.
            key === "kind:box_time" || (key.startsWith("line:") && answer.lines[Number(key.slice(5))]?.kind === "box_time") ? h("p", { class: "sw-help quiet", "data-key": "kept-on" }, say("sw.byTimeKept")) : undefined),
          amount(units, w, "sw-amount-cell")];
        const events = { onmouseenter: only(cls), onmouseleave: only(undefined), onfocusin: only(cls), onfocusout: only(undefined) };
        return h("li", {}, href !== undefined ? h("a", { class: "sw-line", href, "data-key": key, ...events }, ...inner) : h("div", { class: "sw-line", ...events }, ...inner));
      };
      // A line's kind is followed by what the Plugins page says of its plugin: removed, off, not connected.
      // cx's computer is debited for its time and for what it sends: its line names nothing more.
      const quietOf = (line: number): string | undefined => {
        const one = answer.lines[line]!;
        if (one.kind === "box_time" || one.kind === "box_storage") return undefined;
        const state = one.name === undefined ? undefined : reads.states(one.kind === "model" ? "vendor" : "source", one.name);
        return state === undefined ? say(`sw.kind.${one.kind}`) : `${say(`sw.kind.${one.kind}`)}\u00a0· ${state}`;
      };
      const lines = this.#by === "total" ? undefined : h("ul", { class: "sw-lines", "aria-label": say(`sw.by.${this.#by}`) },
        ...(this.#by === "kind" ? series.map((one) => lineOf(one.cls, one.name, one.units, undefined, undefined, `kind:${one.kind}`))
          : series.flatMap((one) => one.rest !== undefined
            ? [lineOf(one.cls, one.name, one.units, say("sw.otherHelp", { n: one.rest.length }), undefined, "other"), ...one.rest.map((line) => lineOf(undefined, name(line.line), line.units, quietOf(line.line), this.#href(answer, line.line), `line:${line.line}`))]
            : [lineOf(one.cls, one.name, one.units, quietOf(one.line!), this.#href(answer, one.line!), `line:${one.line}`)])));
      const views = ["total", "plugin", "kind"] as const;
      const by = choice({ label: say("sw.view"), values: views.map((value) => ({ name: say(`sw.by.${value}`), key: `by:${value}` })), held: views.indexOf(this.#by),
        take: (index) => { const value = views[index]!; this.#by = value; this.ports.redraw(`by:${value}`); } }).element;
      return [sum(by), chart, lines];
    };
    const spent = h("section", { class: "sw-group sw-spent", "aria-labelledby": "sw-g-spending" }, head, ...body());
    const foot = answer !== undefined && answer.total > 0 && h("div", { class: "sw-foot" },
      h("a", { class: "f-btn sw-btn", href: backend.spendingFile(span), download: "", "data-key": "span-download", "aria-label": say("sw.downloadSpanName", { span: say(`sw.span.${span}`) }) }, say("sw.downloadSpan")));
    return [spent, foot];
  }

  #lineName(answer: SpanSpending, line: number): string {
    const one = answer.lines[line]!;
    if (one.kind === "box_time") return this.ports.say("sw.computer");
    if (one.kind === "box_storage") return this.ports.say("sw.computerDisk");
    if (one.name === undefined) return this.ports.say(`sw.class.${one.kind}`);
    const kind = one.kind === "model" ? "vendor" : "source";
    return this.ports.plugin(kind, one.name)?.name ?? this.ports.name?.(kind, one.name) ?? one.name;
  }

  /** A line opens its plugin's page: a source's on its Usage where the Plugins page draws one, a model's as it opens by itself, since it has none. */
  #href(answer: SpanSpending, line: number): string | undefined {
    const one = answer.lines[line]!;
    if (one.kind === "box_time" || one.kind === "box_storage" || one.name === undefined) return undefined;
    const plugin = this.ports.plugin(one.kind === "model" ? "vendor" : "source", one.name);
    if (plugin === undefined) return undefined;
    return plugin.href;
  }

  /**
   * 余额记录: the money that arrived without a payment and what became of every lot that is gone, newest first. Each entry says where its
   * money came from and went: who invited, the part that went to a debt, a period's fee the balance paid.
   */
  #history(reads: UsageReads, w: Writer): readonly Child[] {
    const { say, backend } = this.ports;
    const entries = reads.record;
    if (entries === undefined || entries.length === 0) return [];
    // The record is a read of its own: the fee it names stands where the balance could not be read.
    const price = reads.terms?.price;
    const gone = (entry: RecordEntry): string | undefined => {
      const done = entry.done;
      if (done === undefined) return undefined;
      const day = w.dayName(done.on);
      return done.left <= 0 ? say("sw.entryUsed", { day }) : say(entry.kind === "included" ? "sw.entryCleared" : "sw.entryExpired", { day, left: w.money(done.left) });
    };
    const line = (entry: RecordEntry): readonly Child[] => [w.dayName(entry.landed_on),
      entry.invited?.by !== undefined && `\u00a0· ${say("sw.entryInviter", { who: entry.invited.by })}`,
      ...(entry.debt_repaid > 0 ? ["\u00a0· ", ...around(say, "sw.entryOwed", "owed", amount(entry.debt_repaid, w))] : []),
      ...(entry.paid_from_balance && price !== undefined ? ["\u00a0· ", ...around(say, "sw.entryFeeBalance", "price", amount(price, w))] : []),
      gone(entry) !== undefined && `\u00a0· ${gone(entry)}`];
    const shown = this.#record ? entries : entries.slice(0, SHOWN);
    const fold = entries.length > SHOWN && h("p", { class: "sw-more quiet" }, h("button", { type: "button", class: "sw-link", "data-key": "record-more", "aria-expanded": String(this.#record),
      onclick: () => { this.#record = !this.#record; this.ports.redraw("record-more", true); } }, this.#record ? say("sw.showLess") : say("sw.seeAll", { n: entries.length })));
    return [
      h("section", { class: "sw-group", "aria-labelledby": "sw-g-record" }, h("div", { class: "sw-head" }, h("h3", { id: "sw-g-record" }, say("sw.record"))),
        h("ul", { class: "sw-rows" }, ...shown.map((entry) => row(say(`sw.entry.${entry.kind}`), line(entry), amount(entry.units, w, "sw-amount-cell")))), fold),
      h("div", { class: "sw-foot" }, h("a", { class: "f-btn sw-btn", href: backend.recordFile(), download: "", "data-key": "record-download" }, say("sw.downloadRecord"))),
    ];
  }
}

/** The model in use is another than the default: the figure is the one that model can draw on. */
export function ownModel(reads: Pick<UsageReads, "models">): { readonly name: string } | undefined {
  const current = reads.models?.current, fallback = reads.models?.default;
  return current === undefined || fallback === undefined || (current.provider === fallback.provider && current.id === fallback.id) ? undefined : { name: current.name ?? current.id };
}

/**
 * What leads 用量 and 账单 alike, after a payment's answer: why a free account cannot go on, else that the balance cannot open cx's
 * computer, else the warning. A sign-up turned away has no line here: every direct sign-up is given its trial, so no day's places are
 * spoken of. A membership paid for and yet to start is not told it has none, and a warning stands down while a payment's answer stands.
 */
export function leadsOf(reads: Pick<UsageReads, "me" | "subscription">, money: AccountMoney, own: boolean, w: Writer, say: Say, paying: Paying, seats = false): readonly HTMLElement[] {
  const lead = (cls: string, words: string): HTMLElement => h("p", { class: `sw-lead ${cls}` }, words);
  if (money.state === "free") {
    if (paying.starting) return [];
    const why = money.free?.why;
    if (why === "trial_ended") return [lead("floor", say("sw.leadTrialOver"))];
    if (why === "membership_ended" && money.free?.ended_on !== undefined) {
      const day = { day: w.dayName(money.free.ended_on) };
      // An organization's lead is its seats' failed charge, as `/me`'s seat state alone says it; with no seats 账单 says so in its plan row.
      if (seats) return reads.me?.organization?.seats?.state === "retrying" ? [lead("floor", say("bill.leadFailed", day))] : [];
      return [lead("floor", say(reads.subscription?.status === "retrying" ? "sw.leadLapsedFailed" : "sw.leadLapsed", day))];
    }
    return [];
  }
  if (paying.waiting) return [];
  if (reads.me?.balance?.can_open === false) return [lead("floor", say("sw.warnFloor"))];
  if (own ? money.warning.model_low : money.warning.low) return [lead("low", say("sw.warnLow", { amount: w.money(money.warning.below) }))];
  return [];
}

/** An account that has never spent, as `/account/money` says it: one whose only lot is today's sign-up lot, untouched. */
export function neverSpent(money: AccountMoney | undefined, now: number): boolean {
  if (money === undefined) return false;
  return beganToday(money, now) && money.lots[0]!.used === 0;
}

/** An account whose one lot is the sign-up's, landed today. */
function beganToday(money: AccountMoney | undefined, now: number): boolean {
  const [only, ...rest] = money?.lots ?? [];
  return only !== undefined && rest.length === 0 && only.kind === "sign_up" && only.landed_on === localDay(now);
}

/** A part of the site's terms page by its anchor's name, the same in each language. */
export type TermsPart = "balance" | "pro" | "top-ups" | "invitations";
/** The way to a rule's own words on the site's terms page, in the window's language, opened beside the window. */
export const termsLink = (say: Say, w: Writer, words: StringKey, part: TermsPart, key = "rules"): HTMLElement =>
  h("a", { class: "sw-link meta", href: `${SITE_PAGES[w.language].terms}#${part}`, target: "_blank", rel: "noopener", "data-key": key },
    say(words), "\u00a0↗", h("span", { class: "sw-hidden" }, say("sw.newTab")));
/** Money's face is for the seller's own money: held, arrived, spent or about to go. */
export const amount = (units: number, w: Writer, cls = ""): HTMLElement => h("span", { class: `money ${cls}`.trim() }, w.money(units));
/** A sentence with its amounts drawn as money, its other values as words: the words are split at each drawn value's place. */
export function around(say: Say, key: Parameters<Say>[0], drawn: string, value: HTMLElement, words: Readonly<Record<string, string>> = {}, more: Readonly<Record<string, HTMLElement>> = {}): readonly Child[] {
  const drawnValues = new Map<string, HTMLElement>([[drawn, value], ...Object.entries(more)]);
  const marks = Object.fromEntries([...drawnValues.keys()].map((name) => [name, `\u0000${name}\u0000`]));
  return say(key, { ...words, ...marks }).split("\u0000").map((piece, at) => (at % 2 === 1 ? drawnValues.get(piece)! : piece)).filter((piece) => piece !== "");
}
const row = (label: string, help: readonly Child[] | undefined, ctl: HTMLElement): HTMLElement => h("li", { class: "sw-row" },
  h("div", { class: "sw-text" }, h("p", { class: "sw-label" }, label), help !== undefined && h("p", { class: "sw-help quiet" }, ...help)), h("div", { class: "sw-ctl" }, ctl));
/** Now on the browser's clock, to the minute, as a bar under a day is named. */
