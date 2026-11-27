import { priced, type AccountMoney, type Backend, type CheckoutAsk, type Features, type LotKind, type Payments, type PayWay, type Priced, type SavedCard, type Seats, type Terms } from "./backend.js";
import { h, type Child } from "./dom.js";
import { choice, switchButton } from "./forms.js";
import { keepRows, ringed, Waits } from "./waiting.js";
import { cardForm, confirmStep, formStep, type FormPlace } from "./pay-step.js";
import type { Paid, Paying } from "./paying.js";
import { parts, type Writer } from "./settings-words.js";
import type { Say } from "./stream-view.js";
import { UNITS_PER_DOLLAR } from "../shared/unit.js";
import { amount, around, leadsOf, ownModel, termsLink, type UsageReads } from "./usage-page.js";

export const BILLING_PAGES = ["top-up", "subscribe"] as const;
export type BillingPage = (typeof BILLING_PAGES)[number];
/** What 账单 and its pages ask of the platform. */
export type BillingBackend = Pick<Backend, "accountMoney" | "cards" | "payments" | "payIn" | "payForm" | "saveCard" | "setRenewal" | "cancelRenewal" | "resumeRenewal" | "renewNow">;
export type BillingPorts = {
  readonly backend: BillingBackend; readonly say: Say; readonly paying: Paying; readonly features: () => Features;
  /** What this opening read of the account, shared with 用量. */
  readonly reads: () => UsageReads | undefined;
  /** Reads the account again after a move, keeping where the seller is. */
  readonly reread: () => Promise<void>;
  /** Draws the pane again, the keyboard back on the control `key` names, brought into view where `reveal` asks. */
  readonly redraw: (key?: string, reveal?: boolean) => void;
  /** Takes the window to one of its addresses, in the entry it stands in. */
  readonly go: (hash: string) => void;
  /** Where a step over the window is put. */
  readonly home: () => HTMLElement;
  /** Where the window's addresses start: a person's 设置, or 组织设置. */
  readonly base: string;
  /** 组织设置's: the organization's seats, which take Pro's place on 账单, and its name. */
  readonly organization?: () => { readonly seats: Seats | undefined; readonly name: string | undefined };
  /** 组织's seats step, opened from the control `at` names, and the sum it paid said once at the head of the page it was paid from. */
  readonly seats?: { readonly ask: (w: Writer, at: string) => void; readonly lead: (w: Writer) => readonly HTMLElement[] };
  /** A person's 账单 where the page has the plans page: 调整方案 on 方案's head opens it. */
  readonly plans?: () => void;
};

/** A long list shows its first rows and folds the rest. */
const SHOWN = 3;
/** The amounts a top-up offers, as multiples of the least a top-up may be. */
const PICKS = [1, 2, 5] as const;
const BRANDS: Readonly<Record<string, string>> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover", jcb: "JCB", unionpay: "UnionPay", diners: "Diners Club" };
/** The money a membership may be paid from: top-up and reward lots, never the included credit or a trial's. */
const PAYS_PLAN: readonly LotKind[] = ["top_up", "reward"];

const GROUPS = { plan: "sw.g.plan", method: "sw.g.method", cancel: "sw.g.cancel", buy: "sw.buy", brings: "sw.planBrings" } as const;
type Said = { readonly what: "methodUpdated" | "methodAdded" | "resumed" | "cancelled" | "off" | "moveFailed"; readonly at: string };
type Way = "card" | "once";
type OncePay = "balance" | PayWay;

/**
 * 账单, and the two pages before a payment, 充值 and 订阅: the membership and what happens at its period's end, the cards the provider keeps,
 * the payments, and the way to end a renewal. A card is paid in the provider's form over the window; Alipay on its own page, which comes
 * back to the window. Every figure is a field the platform served at this opening, or the provider's total for a session.
 */
export class BillingView {
  #cards: readonly SavedCard[] | undefined;
  #payments: Payments | undefined;
  #said: Said | undefined;
  #paysOpen = false;
  /** The rest of the payments are being read, page after page, before the list unfolds; or the last such read failed. */
  #paysReading: "reading" | "failed" | undefined;
  #pick: number | "other" | undefined;
  #other = "";
  #otherBad = false;
  #topUpWay: PayWay | undefined;
  /** The account's money with the picked top-up landed, as the platform works it out; undefined until it answers for that amount. */
  #withTopUp: { readonly dollars: number; readonly money: AccountMoney } | undefined;
  #way: Way | undefined;
  #pay: OncePay | undefined;
  /** A move of the renewal is outstanding. */
  #moving = false;
  readonly #waits = new Waits(() => this.ports.home());
  constructor(readonly ports: BillingPorts) {}

  get #terms(): Terms | undefined { return this.ports.reads()?.terms; }

  /** Each opening that shows 账单 reads the cards and the payments afresh, the terms being 用量's read of the same opening. */
  async open(): Promise<void> {
    const { backend } = this.ports;
    this.forget();
    const quiet = <T>(read: Promise<T>): Promise<T | undefined> => read.catch(() => undefined);
    const [cards, payments] = await Promise.all([quiet(backend.cards()), quiet(backend.payments())]);
    this.#cards = cards === undefined ? undefined : [...cards].sort((a, b) => Number(b.default) - Number(a.default));
    this.#payments = payments;
  }

  /** The cards and payments again after a move; the terms do not move. A payment's answer is the window's to settle, for its opening. */
  async reread(): Promise<void> {
    const { backend } = this.ports;
    const [cards, payments] = await Promise.all([backend.cards().catch(() => undefined), backend.payments().catch(() => undefined)]);
    this.#cards = cards === undefined ? undefined : [...cards].sort((a, b) => Number(b.default) - Number(a.default));
    this.#payments = payments;
  }

  draw(page: BillingPage | undefined, w: Writer): readonly Child[] {
    const reads = this.ports.reads();
    if (reads === undefined) return [];
    const money = reads.money;
    // Where the platform takes no payment, 账单 is the membership and the balance, with no way to pay.
    if (!this.#offers) return this.#billing(reads, money, w);
    if (page === "top-up") return this.#topUp(reads, money, w);
    if (page === "subscribe" && money !== undefined && priced(money)) return this.#plan(reads, money, w);
    return this.#billing(reads, money, w);
  }

  /** A move to another page or section meets 账单 as an opening does, short of the reads: no answer, no pick, the record folded. */
  forget(): void {
    this.#said = undefined;
    this.#paysOpen = false;
    this.#paysReading = undefined;
    this.#pick = undefined;
    this.#other = "";
    this.#otherBad = false;
    this.#topUpWay = undefined;
    this.#withTopUp = undefined;
    this.#way = undefined;
    this.#pay = undefined;
  }

  /** The pages the account is offered: none where it pays nothing here, its balance is unread or a membership is starting; 充值 alone for a member or a charge being tried again. */
  offered(): readonly BillingPage[] {
    const reads = this.ports.reads(), money = reads?.money;
    if (!this.#offers || money === undefined || this.ports.paying.starting) return [];
    return money.state === "member" || reads?.subscription?.status === "retrying" ? ["top-up"] : ["top-up", "subscribe"];
  }

  // ---- what the pages share ----

  get #offers(): boolean { return this.ports.features().checkout; }

  #answered(what: Said["what"], at: string): HTMLElement | undefined {
    // A move that failed asks the seller to try again: it is said in ink, and may wrap under its control.
    return this.#said?.what === what && this.#said.at === at ? h("span", { class: what === "moveFailed" ? "sw-said asks" : "sw-said", role: "status" }, this.ports.say(`sw.${what}`)) : undefined;
  }
  /**
   * A move of the account's billing: the account is read again, and the row it was made from answers. A move that fails says so beside
   * the button pressed, which keeps the keyboard.
   */
  async #move(run: () => Promise<void>, said: Said | undefined, key: string, pressed = key): Promise<void> {
    // One move at a time: until it answers, a press of any of the renewal's controls is no second move.
    if (this.#moving) return;
    this.#moving = true;
    // A move submitted goes through after a close, and its answer is said where it arrives. The lock is the move's own.
    // The pressed control turns until the move answers, drawn so by every draw between.
    await this.#waits.run(`move ${pressed}`, async () => {
      try {
        await run();
        this.#said = said;
        await this.ports.reread();
      } catch {
        this.#moving = false;
        this.#said = { what: "moveFailed", at: pressed };
        this.ports.redraw(pressed);
        return;
      }
      this.#moving = false;
      this.ports.redraw(key);
    }, this.ports.home().querySelector<HTMLElement>(`[data-key='${pressed}']`) ?? undefined);
  }
  #button(key: string, words: string, onclick: () => void, more: Readonly<Record<string, string>> = {}): HTMLButtonElement {
    return this.#waits.ring(`move ${key}`, h("button", { type: "button", class: "f-btn sw-btn", "data-key": key, onclick, ...more }, words));
  }
  #row({ label, help, also, ctl, id, helpId, under, roomy, wide, plan }: {
    readonly label?: readonly Child[] | string | undefined; readonly help?: readonly Child[] | string | undefined; readonly also?: readonly Child[] | string | undefined;
    readonly ctl?: readonly Child[] | undefined; readonly id?: string; readonly helpId?: string; readonly under?: boolean; readonly roomy?: boolean; readonly wide?: readonly HTMLElement[]; readonly plan?: boolean;
  }): HTMLElement {
    const words = (value: readonly Child[] | string): readonly Child[] => (typeof value === "string" ? [value] : value);
    return h("li", { class: `sw-row${wide !== undefined && wide.length > 0 ? " stacked" : ""}${roomy === true ? " roomy" : ""}${under === true ? " under" : ""}${plan === true ? " sw-plan" : ""}` },
      h("div", { class: "sw-text" }, label !== undefined && h("p", { class: "sw-label", id }, ...words(label)), help !== undefined && h("p", { class: "sw-help quiet", id: helpId }, ...words(help)),
        also !== undefined && h("p", { class: "sw-help quiet" }, ...words(also))),
      ctl !== undefined && h("div", { class: "sw-ctl" }, ...ctl),
      wide !== undefined && wide.length > 0 && h("div", { class: "sw-wide" }, ...wide));
  }
  #group(title: keyof typeof GROUPS | undefined, rows: readonly Child[], action: readonly Child[] = [], level: "h3" | "h4" = "h3"): HTMLElement {
    const id = title === undefined ? undefined : `sw-g-${title}`;
    return h("section", { class: "sw-group", "aria-labelledby": id }, title !== undefined && h("div", { class: "sw-head" }, h(level, { id }, this.ports.say(GROUPS[title])), ...action),
      h("ul", { class: "sw-rows" }, ...rows));
  }
  #seg<T extends string>(name: string, label: string, options: readonly (readonly [T, string])[], held: T, pick: (value: T) => void): HTMLElement {
    return choice({ label, values: options.map(([value, words]) => ({ name: words, key: `${name}:${value}` })), held: options.findIndex(([value]) => value === held), take: (index) => pick(options[index]![0]) }).element;
  }
  /** The money that may pay a membership, as the lots served hold it, and the kinds of it a price would be taken from, the earliest to end first. */
  #payable(money: Priced): { readonly held: number; readonly takes: readonly LotKind[]; readonly kinds: readonly LotKind[] } {
    const lots = money.lots.filter((lot) => PAYS_PLAN.includes(lot.kind) && lot.remainder > 0);
    const takes: LotKind[] = [];
    let need = money.renewal.price;
    for (const lot of lots) { if (need <= 0) break; need -= lot.remainder; if (!takes.includes(lot.kind)) takes.push(lot.kind); }
    const kinds = [...new Set(lots.map((lot) => lot.kind))];
    return { held: lots.reduce((sum, lot) => sum + lot.remainder, 0), takes, kinds: kinds.length > 0 ? kinds : ["top_up"] };
  }
  #lotNames(kinds: readonly LotKind[], w: Writer): string {
    const say = this.ports.say;
    return kinds.map((kind) => (w.comma === "，" ? say(`sw.lot.${kind}`) : say(`sw.lot.${kind}`).toLowerCase())).join(say("sw.and"));
  }
  #cardName(card: SavedCard): string { return this.ports.say("sw.methodCard", { brand: BRANDS[card.brand] ?? card.brand, last: card.last4 }); }
  #leads(reads: UsageReads, money: AccountMoney | undefined, w: Writer): readonly HTMLElement[] {
    const { say, paying } = this.ports;
    const lead = [...paying.lead(w, say), ...(money === undefined ? [] : leadsOf(reads, money, ownModel(reads) !== undefined, w, say, paying, this.ports.organization !== undefined))];
    return lead.length > 0 ? [h("div", { class: "sw-leads" }, ...lead)] : [];
  }
  #unread(): HTMLElement {
    const say = this.ports.say;
    return h("div", { class: "sw-top opens" }, h("p", { class: "quiet" }, say("sw.balance")), h("div", { class: "sw-top-line" }, h("p", { class: "sw-figure unread" }, say("sw.unread"))), h("p", { class: "sw-help quiet" }, say("sw.retry")));
  }
  /** The way to a membership: 订阅会员 for an account that never held one, 恢复订阅 for one whose membership has expired. */
  #offer(money: AccountMoney, filled: boolean): HTMLElement {
    const lapsed = money.free?.why === "membership_ended";
    return this.#button("subscribe", this.ports.say(lapsed ? "sw.resume" : "sw.subscribe"), () => this.ports.go(`${this.ports.base}/billing/subscribe`), { class: `f-btn sw-btn${filled ? " primary" : ""}` });
  }
  /** The one act while a failed charge is tried again: the card, in the card form, in place of the one that failed. */
  #cardButton(): readonly Child[] {
    return [this.#answered("methodUpdated", "card"), this.#button("card", this.ports.say("sw.updateCard"), () => this.#saveCard(true, "card"), { class: "f-btn primary sw-btn" })];
  }
  /** What the charge being tried again is: the sum and the month it pays for. */
  #retrySum(reads: UsageReads, w: Writer): readonly Child[] {
    const retry = reads.subscription!.retry!;
    return [this.ports.say("sw.retrySum", { price: w.money(retry.amount), span: w.daysBetween(retry.first_day, retry.last_day) })];
  }
  #pageHead(title: "sw.topUp" | "sw.subscribe" | "sw.resume", page: BillingPage, w: Writer, lead: readonly HTMLElement[] = []): readonly Child[] {
    const say = this.ports.say;
    return [h("p", { class: "sw-back" }, h("a", { href: `${this.ports.base}/billing`, "data-key": "back" }, `← ${say("sw.sec.billing")}`)),
      ...lead,
      h("div", { class: "sw-title-line" }, h("h3", { class: "sw-title", id: "sw-page-title" }, say(title)), page === "top-up" && termsLink(say, w, "sw.topUpRules", "top-ups")),
      this.ports.paying.unpaidOn(page) && h("p", { class: "sw-lead answer", role: "status" }, say("sw.backUnpaid"))];
  }
  /** The pay button, and beside it, before any money moves, the one line that says it is not refunded. */
  #payFoot(pay: HTMLElement, line: string): HTMLElement {
    return h("div", { class: "sw-foot" }, h("p", { class: "quiet sw-refund" }, line), pay);
  }

  // ---- 账单 ----

  #billing(reads: UsageReads, money: AccountMoney | undefined, w: Writer): readonly Child[] {
    const { say, paying } = this.ports;
    const offers = this.#offers;
    if (money === undefined) return [...this.#leads(reads, money, w), this.#unread(), ...(offers ? [...this.#methods(w), ...this.#pays(w)] : [])];
    const organization = this.ports.organization?.();
    if (organization !== undefined) return this.#seatsBilling(reads, money, organization.seats, organization.name, w);
    // A person's renewal is always priced; an answer without it reads as one not read.
    if (!priced(money)) return [...this.#leads(reads, money, w), this.#unread(), ...(offers ? [...this.#methods(w), ...this.#pays(w)] : [])];
    const status = reads.subscription?.status;
    const member = money.state === "member", live = member && status === "active", cancelling = member && status === "cancelling";
    const retrying = money.state === "free" && status === "retrying" && reads.subscription?.retry !== undefined;
    const price = w.money(money.renewal.price);
    // A plan that ends prints its last day; one that renews prints the period's boundary, which the charge follows.
    const day = member && money.member !== undefined ? w.dayName(money.member.last_day) : "";
    const next = member && money.member !== undefined ? w.dayName(money.member.renews_on) : "";
    const switchOn = money.member?.switch === true;
    const payable = this.#payable(money);
    const balanceRenews = switchOn && money.renewal.short === 0;
    const holds = money.state === "free" && money.lots.length > 0;
    const warned = !paying.waiting && (money.warning.low || reads.me?.balance?.can_open === false);
    const quiet = (words: readonly Child[] | string): HTMLElement => h("p", { class: "sw-help quiet" }, ...(typeof words === "string" ? [words] : words));
    const byFigure = [money.debt > 0 && quiet(around(say, "sw.debtHelp", "amount", amount(money.debt, w)))].filter((one): one is HTMLElement => one !== false);
    // The figure stands beside the state it pays for, under its name; what the account owes and what its money waits for are read with it, across the row.
    const planRow = (label: string, help?: readonly Child[] | string, also?: readonly Child[] | string, act: readonly Child[] = []): HTMLElement => this.#row({ label, help, also, wide: byFigure, plan: true, under: true,
      ctl: [h("div", { class: "sw-held" }, h("p", { class: "quiet" }, say("sw.balance")), h("p", { class: "sw-figure month" }, amount(money.figure, w))), ...(offers ? act : [])] });
    // A membership paid for and yet to start is not offered again, and has no button. While a charge is tried again the one act is the card.
    const plan = paying.starting ? planRow(say(money.state === "trial" ? "sw.plan.trial" : "sw.plan.starting"), money.state === "trial" ? say("sw.plan.trialStarting") : undefined)
      : money.state === "trial" ? planRow(say("sw.plan.trial"), say(reads.me?.balance?.can_open === false ? "sw.plan.trialFloor" : "sw.plan.trialHelp"), undefined, [this.#offer(money, warned)])
      : retrying ? planRow(say("sw.plan.retrying"), say("sw.retryLine", { day: w.dayName(reads.subscription!.retry!.on) }), this.#retrySum(reads, w), this.#cardButton())
      : money.state === "free" ? planRow(say("sw.plan.none"), holds ? undefined : say(money.free?.why === "membership_ended" ? "sw.plan.noneHelpLapsed" : "sw.plan.noneHelp"),
        undefined, [this.#answered("cancelled", "subscribe"), this.#offer(money, true)])
      : planRow(say("sw.plan.on"),
        live ? say("sw.plan.card", { next, price })
          : cancelling ? say(balanceRenews ? "sw.plan.cancelledRenews" : "sw.plan.cancelled", { day, next, price })
          : say(balanceRenews ? "sw.plan.endsRenews" : "sw.plan.ends", { day, next, price }),
        undefined, [this.#button("topUp", say("sw.topUp"), () => this.ports.go(`${this.ports.base}/billing/top-up`), { class: `f-btn sw-btn${warned ? " primary" : ""}` })]);
    // A member no card renews is renewed from top-up and reward money: the switch, and under it what it would take, or that a top-up is needed first.
    const renewHelp = (): readonly Child[] => {
      const held = money.renewal.takes, names = this.#lotNames(money.renewal.short === 0 ? payable.takes : payable.kinds, w), owing = money.debt > 0;
      const line = switchOn
        ? (money.renewal.short === 0 ? [say("sw.renewTakes", { lots: names, price })] : held === 0 ? [say(owing ? "sw.renewNoneOwing" : "sw.renewNone", { day, price })] : around(say, "sw.renewShort", "held", amount(held, w), { lots: names, price, day }))
        : (money.renewal.short === 0 ? [say("sw.renewOff", { lots: names, price })] : held === 0 ? [say(owing ? "sw.renewOffNoneOwing" : "sw.renewOffNone", { price })] : around(say, "sw.renewOffShort", "held", amount(held, w), { lots: names, price }));
      // Where the figure holds the price and the money that may pay a renewal does not, the line says why, straight after the money it names:
      // the kinds held that never pay one, the included credit and a trial's, a reward being money that does.
      const given = [...new Set(money.lots.filter((lot) => !PAYS_PLAN.includes(lot.kind) && lot.remainder > 0).map((lot) => lot.kind))];
      if (money.renewal.short === 0 || money.figure < money.renewal.price || given.length === 0) return line;
      const called = this.#lotNames(given, w), why = say("sw.renewGiven", { lots: called.charAt(0).toUpperCase() + called.slice(1) });
      const end = w.comma === "，" ? "。" : ". ", gap = w.comma === "，" ? "" : " ";
      const at = line.findIndex((piece) => typeof piece === "string" && piece.includes(end));
      if (at < 0) return [...line, gap, why];
      const piece = line[at] as string, cut = piece.indexOf(end) + end.length;
      return [...line.slice(0, at), piece.slice(0, cut), why, gap, piece.slice(cut), ...line.slice(at + 1)];
    };
    // Turning it off is asked first: the switch stays on until the answer.
    const renew = switchButton({ label: say("sw.renew"), on: switchOn,
      turn: () => { if (switchOn) { renew.set(true); this.#ask("renew", money, w, "renew"); } else void this.#move(() => this.ports.backend.setRenewal(true), undefined, "renew"); } });
    renew.element.setAttribute("aria-describedby", "sw-renew-help");
    renew.element.dataset["key"] = "renew";
    const renewRow = offers && member && !live && this.#row({ label: say("sw.renew"), id: "sw-renew", helpId: "sw-renew-help", help: renewHelp(),
      ctl: [this.#answered("moveFailed", "renew"), this.#waits.ring("move renew", renew.element)] });
    // 取消, last: the way to end a renewal a card or the balance makes, and to end the tries of a failed charge; for a cancelled card renewal, the way back.
    const cancelRow = !offers ? undefined : retrying ? this.#row({ label: say("sw.retryRenew"), ctl: [this.#answered("moveFailed", "cancel"), this.#button("cancel", say("sw.cancelPlan"), () => this.#ask("cancel", money, w, "cancel"))], under: true })
      : !member ? undefined
      : live ? this.#row({ label: say("sw.retryRenew"), ctl: [this.#answered("moveFailed", "cancel") ?? this.#answered("resumed", "cancel"), this.#button("cancel", say("sw.cancelPlan"), () => this.#ask("cancel", money, w, "cancel"))], under: true })
      : cancelling ? this.#row({ label: say("sw.retryRenew"), help: say(balanceRenews ? "sw.plan.resumeHelpRenews" : "sw.plan.resumeHelp", { price }), under: true,
        ctl: [this.#answered("moveFailed", "resume") ?? this.#answered("cancelled", "resume"), this.#button("resume", say("sw.resumeRenewal"), () => { void this.#move(() => this.ports.backend.resumeRenewal(), { what: "resumed", at: "cancel" }, "cancel", "resume"); })] })
      : balanceRenews ? this.#row({ label: say("sw.renew"), ctl: [this.#answered("moveFailed", "cancel"), this.#button("cancel", say("sw.cancelPlan"), () => this.#ask("renew", money, w, "cancel"))], under: true })
      // Ended here, the renewal answers here: 已关闭 where the button was, and the switch above is the way back.
      : this.#said?.what === "off" ? this.#row({ label: say("sw.renew"), ctl: [h("span", { class: "sw-said", tabindex: "-1", "data-key": "cancel" }, say("sw.off"))], under: true }) : undefined;
    // 调整方案 is a person's: in an organisation's session the money read is the organisation's, whose plan is its seats.
    const plans = this.ports.plans;
    const adjust = plans === undefined || !offers || reads.me?.organization !== undefined ? [] : [this.#button("plans", say("sw.plan.adjust"), plans)];
    return [...this.#leads(reads, money, w), this.#group("plan", [plan, renewRow], adjust), ...(offers ? [...this.#methods(w), ...this.#pays(w)] : []), cancelRow !== undefined && this.#group("cancel", [cancelRow])];
  }

  /**
   * An organization's 账单, as the seats sheet draws it: its seats in Pro's place, renewed by card alone, so no switch renews them from the
   * balance; and 取消 that names what the members lose. 充值 stands while seats are held, and a failed charge's one act is the card.
   */
  #seatsBilling(reads: UsageReads, money: AccountMoney, seats: Seats | undefined, name: string | undefined, w: Writer): readonly Child[] {
    const say = this.ports.say;
    const offers = this.#offers;
    // `/me`'s seat state alone says a retry: its sum and its period are the subscription's detail where that answer is the same retry,
    // and left out where not; an earlier retry answer turns no other state into one.
    const retrying = seats?.state === "retrying";
    const detail = retrying && reads.subscription?.status === "retrying" ? reads.subscription.retry : undefined;
    const nextTry = detail?.on ?? seats?.on;
    const held = h("div", { class: "sw-held" }, h("p", { class: "quiet" }, say("sw.balance")), h("p", { class: "sw-figure month" }, amount(money.figure, w)));
    const row = (label: string, help: readonly Child[] | string | undefined, also: readonly Child[] | undefined, act: readonly Child[]): HTMLElement =>
      this.#row({ label, help, also, plan: true, under: true, ctl: [held, ...(offers ? act : [])] });
    const warned = !this.ports.paying.waiting && (money.warning.low || reads.me?.balance?.can_open === false);
    const topUp = [this.#button("topUp", say("sw.topUp"), () => this.ports.go(`${this.ports.base}/billing/top-up`), { class: `f-btn sw-btn${warned ? " primary" : ""}` })];
    const n = seats?.thisPeriod;
    const plan = retrying ? row(say("sw.plan.retrying"), nextTry === undefined ? undefined : say("sw.retryLine", { day: w.dayName(nextTry) }),
      detail === undefined ? undefined : [say("bill.retrySum", { price: w.money(detail.amount), span: w.daysBetween(detail.first_day, detail.last_day) })], this.#cardButton())
      // No paid seat, no top-up: 购买席位 stands where 充值 stood.
      : seats?.state === "none" ? row(say("orgs.noSeats"), say("seats.noneHelp"), undefined, [this.#button("seats", say("seats.buy"), () => this.ports.seats?.ask(w, "seats"), { class: "f-btn primary sw-btn" })])
      // Seats held whose count the vendor did not give are not said to be none.
      : n === undefined ? row(say("sw.unread"), undefined, undefined, topUp)
      : seats?.state === "cancelling" ? row(say("seats.planRow", { n: String(n) }), seats.on === undefined ? undefined : say("sw.plan.cancelled", { day: w.dayName(seats.on) }), undefined, topUp)
      : row(say("seats.planRow", { n: String(n) }), money.member === undefined || money.renewal.price === undefined ? undefined : say("sw.plan.card", { next: w.dayName(money.member.renews_on), price: w.money(money.renewal.price) }), undefined, topUp);
    // The sentence that names the last day and the organisation is not drawn with either missing.
    const ends = (): readonly Child[] => (money.member === undefined || name === undefined ? [] : [say("bill.endWhat", { day: w.dayName(money.member.last_day), org: name })]);
    const cancel = (): void => {
      if (this.#moving) return;
      confirmStep(this.ports.home(), say, { ask: say("sw.cancelAsk"), what: retrying ? [say("bill.cancelRetryWhat")] : ends(),
        rules: { link: termsLink(say, w, "sw.cancelRules", "pro", "step-rules"), gap: w.comma === "，" ? "" : " " },
        yes: say("sw.cancelPlan"), back: () => this.ports.redraw("cancel"),
        then: () => { void this.#move(() => this.ports.backend.cancelRenewal(), { what: "cancelled", at: "resume" }, retrying ? "cancel" : "resume", "cancel"); } });
    };
    const cancelRow = !offers || seats?.state === "none" || (n === undefined && !retrying) ? undefined
      : seats?.state === "cancelling" ? this.#row({ label: say("sw.retryRenew"), help: money.renewal.price === undefined ? undefined : say("sw.plan.resumeHelp", { price: w.money(money.renewal.price) }), under: true,
        ctl: [this.#answered("moveFailed", "resume") ?? this.#answered("cancelled", "resume"), this.#button("resume", say("sw.resumeRenewal"), () => { void this.#move(() => this.ports.backend.resumeRenewal(), { what: "resumed", at: "cancel" }, "cancel", "resume"); })] })
      : this.#row({ label: say("sw.retryRenew"), under: true, ctl: [this.#answered("moveFailed", "cancel") ?? this.#answered("resumed", "cancel"), this.#button("cancel", say("sw.cancelPlan"), cancel)] });
    return [...(this.ports.seats?.lead(w) ?? []), ...this.#leads(reads, money, w), this.#group("plan", [plan]), ...(offers ? [...this.#methods(w), ...this.#pays(w)] : []), cancelRow !== undefined && this.#group("cancel", [cancelRow])];
  }

  /** 付款方式: the cards the provider keeps, the default first. 更新 and 添加付款方式 open the card form; an added card becomes the default. */
  #methods(w: Writer): readonly Child[] {
    const say = this.ports.say;
    const cards = this.#cards;
    if (cards === undefined) return [];
    const row = (card: SavedCard, at: number): HTMLElement => this.#row({ label: [this.#cardName(card), ...(card.default ? ["\u00a0", h("span", { class: "pl-tag" }, say("sw.methodDefault"))] : [])],
      help: say("sw.methodEnds", { day: w.monthName(card.exp_year, card.exp_month) }),
      ctl: at === 0 ? [this.#answered("methodUpdated", "method-update"), this.#button("method-update", say("sw.methodUpdate"), () => this.#saveCard(true, "method-update"), { "aria-label": say("sw.methodUpdateName", { card: this.#cardName(card) }) })] : undefined });
    return [this.#group("method", cards.length === 0 ? [this.#row({ help: say("sw.methodNone") })] : cards.map(row),
      cards.length === 0 ? [] : [this.#answered("methodAdded", "method-add"), this.#button("method-add", say("sw.methodAdd"), () => this.#saveCard(false, "method-add"))])];
  }

  /** 付款记录: each payment the ledger was credited for, a membership's fee or a top-up, newest first, its receipt the one place a seller leaves our pages. */
  #pays(w: Writer): readonly Child[] {
    const say = this.ports.say;
    const paid = this.#payments?.payments ?? [];
    if (this.#payments !== undefined) keepRows("payments", Math.min(paid.length, SHOWN));
    if (paid.length === 0) return [];
    const wayName = (way: string): string => (way === "card" || way === "alipay" ? say(`sw.pay.${way}`) : way === "balance" ? say("sw.balance") : way);
    const shown = this.#paysOpen ? paid : paid.slice(0, SHOWN);
    const total = this.#payments?.total ?? paid.length;
    return [h("section", { class: "sw-group", "aria-labelledby": "sw-g-pays" },
      h("div", { class: "sw-head" }, h("h3", { id: "sw-g-pays" }, say("sw.g.pays"))),
      h("ul", { class: "sw-rows" }, ...shown.map((one, at) => this.#row({ label: say(one.kind === "top_up" ? "sw.entry.top_up" : one.kind === "seats" ? "bill.fee" : "sw.paysFee"),
        help: [w.dayName(one.on), ...(one.way === undefined ? [] : ["\u00a0· ", wayName(one.way)]), ...(one.debt_repaid > 0 ? ["\u00a0· ", say("sw.entryOwed", { owed: w.money(one.debt_repaid) })] : [])],
        // A period's invoice is a file to keep, the vendor's own address with `download`; any other payment's receipt is the vendor's page.
        ctl: [one.pdf !== undefined ? h("a", { class: "sw-link meta", href: one.pdf, download: "", "data-key": `receipt:${at}`, "aria-label": say("sw.invoicePdfName", { day: w.dayName(one.on) }) }, say("sw.invoicePdf"))
          : one.receipt !== undefined && h("a", { class: "sw-link meta", href: one.receipt, target: "_blank", rel: "noopener noreferrer", "data-key": `receipt:${at}`, "aria-label": `${say("sw.receiptName", { day: w.dayName(one.on) })}${say("sw.newTab")}` },
          say("sw.receipt"), h("span", { "aria-hidden": "true" }, "\u00a0↗")), h("span", { class: "sw-amount-cell" }, w.money(one.amount))] }))),
      total > SHOWN && h("p", { class: "sw-more quiet" }, this.#unfolding(h("button", { type: "button", class: "sw-link", "data-key": "pays-more", "aria-expanded": String(this.#paysOpen),
        "aria-describedby": this.#paysReading === "failed" ? "sw-pays-unread" : undefined,
        onclick: () => { void this.#unfold(); } }, this.#paysOpen ? say("sw.showLess") : say("sw.seeAll", { n: total })))),
      this.#paysReading === "failed" && h("p", { class: "sw-help", id: "sw-pays-unread", role: "status" }, say("sw.unread")))];
  }

  /** 查看全部 turns while the payments it unfolds are read. */
  #unfolding(button: HTMLElement): HTMLElement {
    ringed(button, this.#paysReading === "reading");
    return button;
  }

  /** 查看全部 unfolds every payment there is: the pages the platform has not yet served are read first, and the list says so if they cannot be. */
  async #unfold(): Promise<void> {
    if (this.#paysReading === "reading") return;
    if (this.#paysOpen) { this.#paysOpen = false; this.ports.redraw("pays-more", true); return; }
    let payments = this.#payments;
    if (payments?.more === true) { this.#paysReading = "reading"; this.ports.redraw("pays-more", true); }
    while (payments?.more === true && payments.next !== undefined) {
      const page = await this.ports.backend.payments(payments.next).catch(() => undefined);
      // A move or an opening since the press reads its own payments: these are dropped.
      if (this.#paysReading !== "reading") return;
      if (page === undefined) { this.#paysReading = "failed"; this.ports.redraw("pays-more", true); return; }
      payments = { ...page, payments: [...payments.payments, ...page.payments] };
    }
    this.#payments = payments;
    this.#paysReading = undefined;
    this.#paysOpen = true;
    this.ports.redraw("pays-more", true);
  }

  /** The step that asks before a renewal ends: cancelling the card's, turning the balance's off, or paying a month from the balance. */
  #ask(kind: "cancel" | "renew" | "pay", money: Priced, w: Writer, from: string): void {
    if (this.#moving) return;
    const { say, backend } = this.ports;
    const day = money.member === undefined ? "" : w.dayName(money.member.last_day), price = w.money(money.renewal.price);
    const ending = (): readonly Child[] => [say("sw.endWhat", { day })];
    const back = (): void => this.ports.redraw(from);
    if (kind === "pay") {
      const left = this.#payable(money).held - money.renewal.price;
      confirmStep(this.ports.home(), say, { ask: say("sw.payAsk", { amount: price }), what: around(say, "sw.payAskWhat", "price", amount(money.renewal.price, w), { day: w.dayName(money.next_period.last_day) }, { left: amount(left, w) }),
        yes: say("sw.planPayBalance", { amount: price }), back,
        then: () => { void this.#payFromBalance(money); } });
      return;
    }
    const retrying = money.state === "free";
    confirmStep(this.ports.home(), say, {
      ask: say(kind === "cancel" ? "sw.cancelAsk" : "sw.renewAsk"), what: kind === "cancel" && retrying ? [say("sw.cancelRetryWhat")] : ending(),
      rules: { link: termsLink(say, w, "sw.cancelRules", "pro", "step-rules"), gap: w.comma === "，" ? "" : " " },
      yes: say(kind === "cancel" ? "sw.cancelPlan" : "sw.renewOffYes"), back,
      then: () => {
        if (kind === "cancel") void this.#move(() => backend.cancelRenewal(), { what: "cancelled", at: retrying ? "subscribe" : "resume" }, retrying ? "subscribe" : "resume", from);
        else void this.#move(() => backend.setRenewal(false), from === "cancel" ? { what: "off", at: "cancel" } : undefined, from);
      },
    });
  }

  /** 更新银行卡 pressed on another section while a failed charge is tried again: the same card form, answered where it was pressed. */
  updateCard(from: string): void { this.#saveCard(true, from); }
  /**
   * 购买席位's second step (§六): 账单's card form, paying for `seats` seats. Over the card's choice stand today's sum and the next bill's,
   * both the provider's own total, and what a seat brings where its price is read; 返回 is the count again; the button is the sheet's
   * 确认并购买. Answered, the window reads the account again and `paid` is told the sum where the provider said paid, and nothing otherwise.
   */
  buySeats(seats: number, w: Writer, ask: { readonly price: number | undefined; readonly back: () => void; readonly paid: (units: number | undefined) => void }): void {
    const { say, backend } = this.ports;
    const saved = this.#cards?.find((card) => card.default) ?? this.#cards?.[0];
    let units: number | undefined;
    const sums = (total: { readonly text: string; readonly minor: number } | undefined): readonly Child[] => {
      if (total === undefined) return [];
      units = total.minor * (UNITS_PER_DOLLAR / 100);
      return [h("dl", { class: "st-sums" }, ...[[say("seats.dueToday"), total.text], [say("seats.next"), say("seats.nextSum", { amount: total.text })]].map(([name, value]) => h("div", {}, h("dt", {}, name), h("dd", {}, value)))),
        ask.price !== undefined && h("p", { class: "quiet st-help" }, say("hive.seats.brings", { amount: w.money(ask.price) }))];
    };
    const form = cardForm({ kind: "step", home: this.ports.home(), title: say("seats.buy"), back: ask.back, backWord: say("seats.back") }, say, (secret) => backend.payForm(secret), {
      secret: backend.payIn({ kind: "seats", seats }, "card"), pays: true, payWord: say("seats.confirm"), head: sums, ...(saved === undefined ? {} : { saved, savedName: this.#cardName(saved) }),
      done: (answer) => {
        if (answer === "open") { ask.back(); return; }
        // Only the provider's paid is a payment: a card saved, or one it has not confirmed, is read again and said as the read finds it.
        void this.ports.reread().then(() => { ask.paid(answer === "paid" ? units ?? 0 : undefined); });
      },
    });
    form.classList.add("st-step");
  }
  /** 已更新 beside the control a card was replaced from, where that control is drawn by another pane. */
  cardSaid(at: string): HTMLElement | undefined { return this.#answered("methodUpdated", at); }

  /** 更新 and 添加付款方式, and the retrying card's 更新银行卡: the provider's form saves a card, and the row answers where it was pressed. */
  #saveCard(replace: boolean, from: string): void {
    const { say, backend } = this.ports;
    formStep(this.ports.home(), say, (secret) => backend.payForm(secret), {
      title: say(from === "method-add" ? "sw.methodAdd" : "sw.updateCard"), secret: backend.saveCard(replace), pays: false,
      back: () => this.ports.redraw(from),
      done: (answer) => { if (answer === "open") { this.ports.redraw(from); return; } void this.#move(async () => undefined, { what: from === "method-add" ? "methodAdded" : "methodUpdated", at: from }, from); },
    });
  }

  /** A payment in the provider's form: kept before it is confirmed, then answered on 账单, or, left open, on the page it was asked from. */
  #payIn(ask: CheckoutAsk, way: PayWay, paid: Paid, title: "sw.topUp" | "sw.subscribe" | "sw.resume", amount: string, place?: FormPlace): void {
    const { say, backend, paying } = this.ports;
    const saved = way === "card" ? this.#cards?.find((card) => card.default) ?? this.#cards?.[0] : undefined;
    cardForm(place ?? { kind: "step", home: this.ports.home(), title: say(title), back: () => this.ports.redraw("pay") }, say, (secret) => backend.payForm(secret), {
      secret: backend.payIn(ask, way), pays: true, amount, ...(saved === undefined ? {} : { saved, savedName: this.#cardName(saved) }),
      asking: (secret) => paying.asked(paid, secret),
      done: (answer) => {
        paying.answered(answer === "open" ? "unpaid" : "paid");
        if (answer === "open") { this.ports.redraw("pay"); return; }
        void this.ports.reread().then(() => { this.ports.go(`${this.ports.base}/billing`); });
      },
    });
  }

  async #payFromBalance(money: Priced): Promise<void> {
    try {
      await this.ports.backend.renewNow();
      this.ports.paying.paidFromBalance(money.renewal.price);
      await this.ports.reread();
      this.ports.go(`${this.ports.base}/billing`);
    } catch {
      this.#said = { what: "moveFailed", at: "pay" };
      this.ports.redraw("pay");
    }
  }

  // ---- 充值 ----

  #topUp(reads: UsageReads, money: AccountMoney | undefined, w: Writer): readonly Child[] {
    const { say, paying } = this.ports;
    const terms = this.#terms;
    if (money === undefined || terms === undefined) return [...this.#pageHead("sw.topUp", "top-up", w), this.#unread()];
    // Without a membership the page shows the way to one and no more; while a failed charge is tried again that way is the card.
    if (money.state !== "member") {
      const retry = reads.subscription?.status === "retrying" ? reads.subscription.retry : undefined;
      return [...this.#pageHead("sw.topUp", "top-up", w), this.#group(undefined, [retry !== undefined
        ? this.#row({ label: say("sw.topUpNeeds"), help: say("sw.retryLine", { day: w.dayName(retry.on) }), also: this.#retrySum(reads, w), ctl: this.#cardButton(), under: true })
        : this.#row({ label: say("sw.topUpNeeds"), ctl: [this.#offer(money, true)] })])];
    }
    const perDollar = terms.units_per_dollar, from = terms.top_up_from;
    const picks = PICKS.map((times) => from * times);
    const held = this.#pick ?? picks[0]!;
    const picked = held === "other" ? this.#typed(this.#other, from, perDollar) : held;
    const dollars = picked === undefined ? undefined : picked / perDollar;
    if (dollars !== undefined && this.#withTopUp?.dollars !== dollars) void this.#readWith(dollars);
    const after = this.#withTopUp?.dollars === dollars ? this.#withTopUp?.money.renewal.with_top_up : undefined;
    const way = this.#topUpWay ?? (this.#cards !== undefined && this.#cards.length > 0 ? "card" : this.#payments?.payments.find((one) => one.way === "card" || one.way === "alipay")?.way as PayWay | undefined ?? "card");
    const status = reads.subscription?.status, live = status === "active", cancelling = status === "cancelling", switchOn = money.member?.switch === true;
    const next = money.member === undefined ? "" : w.dayName(money.member.renews_on), price = money.renewal.price === undefined ? undefined : w.money(money.renewal.price);
    // What the button pays is read when it is pressed and as the amount is typed, not when the page was drawn.
    const current = (): number | undefined => (held === "other" ? this.#typed(this.#other, from, perDollar) : held);
    const payWords = (): string => { const units = current(); return units === undefined ? say("sw.topUpPayNone") : say("sw.topUpPay", { amount: w.money(units) }); };
    const pay = this.#button("pay", payWords(), () => {
      const units = current();
      if (units === undefined) { this.#otherBad = true; this.ports.redraw("other"); return; }
      this.#payIn({ kind: "top_up", dollars: units / perDollar }, way, { what: "topUp", units, page: "top-up" }, "sw.topUp", w.money(units));
    }, { class: "f-btn primary sw-btn" });
    const field = h("input", { type: "text", inputmode: "numeric", autocomplete: "off", "aria-labelledby": "sw-other", "data-key": "other", value: this.#other });
    const word = h("span", { class: "sw-said", role: "status", id: "sw-other-said" });
    const answer = (): void => {
      word.classList.toggle("asks", this.#otherBad);
      word.textContent = this.#otherBad ? say("sw.pickBad", { from: w.money(from) }) : "";
      if (this.#otherBad) { field.setAttribute("aria-invalid", "true"); field.setAttribute("aria-describedby", "sw-other-said"); } else { field.removeAttribute("aria-invalid"); field.removeAttribute("aria-describedby"); }
    };
    // The field is as wide as what is typed in it, a wide mark counting two, and never under three places.
    const fit = (): void => { field.style.width = `${Math.max(3, [...field.value].reduce((sum, mark) => sum + (mark.codePointAt(0)! > 0xff ? 2 : 1), 0))}ch`; };
    answer();
    fit();
    field.addEventListener("input", () => { this.#other = field.value; this.#otherBad = false; paying.clearUnpaid(); answer(); fit(); pay.textContent = payWords(); });
    field.addEventListener("change", () => { this.#otherBad = field.value.trim() !== "" && this.#typed(field.value, from, perDollar) === undefined; answer(); if (!this.#otherBad) this.ports.redraw("other"); });
    return [...this.#pageHead("sw.topUp", "top-up", w),
      this.#group(undefined, [
        this.#row({ label: say("sw.pick"), ctl: [this.#seg("pick", say("sw.pick"), [...picks.map((units) => [String(units), w.money(units)] as const), ["other", say("sw.pickOther")] as const], String(held),
          (value) => { this.#pick = value === "other" ? "other" : Number(value); this.#otherBad = false; paying.clearUnpaid(); this.ports.redraw(`pick:${value}`); })] }),
        held === "other" && this.#row({ label: say("sw.pickTyped"), id: "sw-other", ctl: [word, h("span", { class: "sw-amount" }, h("span", { "aria-hidden": "true" }, "$"), field)] }),
        this.#row({ label: say("sw.payWay"), ctl: [this.#seg("way", say("sw.payWay"), (["alipay", "card"] as const).map((one) => [one, say(`sw.pay.${one}`)] as const), way,
          (value) => { this.#topUpWay = value; paying.clearUnpaid(); this.ports.redraw(`way:${value}`); })] }),
        // Money told where it moves before the button: what a debt takes of it, and what the renewal takes of it.
        money.debt > 0 && this.#row({ label: say("sw.topUpOwed"), help: say("sw.topUpOwedHelp"), ctl: [amount(money.debt, w, "sw-amount-cell")] }),
        price !== undefined && !live && !cancelling && switchOn && money.renewal.short > 0 && after !== undefined && after.short === 0 && after.takes > 0
          && this.#row({ label: say("sw.topUpRenews", { day: next }), help: say("sw.topUpRenewsHelp", { day: next, price }), ctl: [amount(after.takes, w, "sw-amount-cell")] }),
      ]),
      this.#payFoot(pay, say("sw.topUpNoRefund"))];
  }

  /** What a typed top-up is read as: whole dollars, digits of either width, from the least a top-up may be; undefined where it is not one. */
  #typed(typed: string, from: number, perDollar: number): number | undefined {
    const clean = typed.trim().replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xFF10)).replace(/[．。]/g, ".").replace(/[$＄,，\s]/g, "");
    if (!/^\d{1,7}(\.0{1,2})?$/.test(clean)) return undefined;
    const units = Math.round(Number(clean)) * perDollar;
    return units >= from ? units : undefined;
  }

  /** What a renewal would take with this top-up landed, as the platform works it out: read for each amount the page offers. */
  async #readWith(dollars: number): Promise<void> {
    this.#withTopUp = undefined;
    const money = await this.ports.backend.accountMoney(dollars).catch(() => undefined);
    if (money === undefined || money.renewal.with_top_up === undefined) return;
    this.#withTopUp = { dollars, money };
    this.ports.redraw();
  }

  // ---- 订阅 ----

  /**
   * 订阅's choice of how to buy and its rows, and what a press pays: the parts the pane draws, and the road's card draws the same. `title`
   * is the page's, 恢复订阅 where a membership has ended.
   */
  #planForm(money: Priced, w: Writer) {
    const { say, paying } = this.ports;
    const lapsed = money.free?.why === "membership_ended";
    const priceUnits = money.renewal.price, price = w.money(priceUnits);
    const payable = this.#payable(money);
    // A free account's money pays one month where it holds the price, and stands first.
    const balance = money.state === "free" && money.renewal.short === 0;
    const pays: readonly OncePay[] = balance ? ["balance", "alipay", "card"] : ["alipay", "card"];
    // Back unpaid, the form opens on what was being bought and the way; a press on either choice keeps the other as it is drawn.
    const before = paying.choseBefore("subscribe");
    const way: Way = this.#way ?? before?.buy ?? (balance ? "once" : "card");
    const held = this.#pay ?? before?.pay;
    const pay: OncePay = held !== undefined && pays.includes(held) ? held : pays[0]!;
    const until = w.dayName(money.next_period.last_day);
    const value = (words: string): HTMLElement => h("span", { class: "sw-value" }, words);
    const left = payable.held - priceUnits;
    // The line about the balance's renewal is chosen from what the account will hold once the month is paid.
    const then = pay === "balance" ? left : payable.held;
    const renewLine = pay === "balance"
      ? (then >= priceUnits ? around(say, "sw.balanceRenew", "left", amount(left, w), { day: until, price }) : then > 0 ? around(say, "sw.balanceRenewShort", "left", amount(left, w), { day: until, price }) : [say("sw.onceRenew", { day: until, price })])
      : then >= priceUnits ? [say("sw.onceRenewHeld", { day: until, lots: this.#lotNames(payable.takes, w), price })]
      : then > 0 ? around(say, "sw.onceRenewShort", "held", amount(then, w), { day: until, lots: this.#lotNames(payable.kinds, w), price })
      : [say("sw.onceRenew", { day: until, price })];
    const owes = money.debt > 0 && this.#row({ label: say("sw.topUpOwed"), help: say("sw.planOwedHelp"), ctl: [amount(money.debt, w, "sw-amount-cell")] });
    const renewsDay = parts(money.next_period.renews_on)[2];
    const rows: readonly Child[] = way === "card" ? [
      this.#row({ label: say("sw.payWay"), ctl: [value(say("sw.pay.card"))] }),
      this.#row({ label: say("sw.renewsOn"), ctl: [value(say("sw.renewsOnDay", { d: w.comma === "，" ? String(renewsDay) : ordinal(renewsDay) }))] }),
      this.#row({ label: say("sw.cardToday", { price }) }),
      owes,
    ] : [
      this.#row({ label: say("sw.payWay"), roomy: true, help: pay === "balance" ? around(say, "sw.balanceTakes", "price", amount(priceUnits, w), {}, { left: amount(left, w) }) : undefined,
        ctl: [this.#seg("pay", say("sw.payWay"), pays.map((one) => [one, one === "balance" ? say("sw.pay.balance", { amount: w.money(payable.held) }) : say(`sw.pay.${one}`)] as const), pay,
          (picked) => { this.#way = way; this.#pay = picked; paying.clearUnpaid(); this.ports.redraw(`pay:${picked}`); })] }),
      this.#row({ label: say("sw.until"), ctl: [value(until)] }),
      this.#row({ help: renewLine }),
      owes,
    ];
    const title = lapsed ? "sw.resume" : "sw.subscribe";
    const buy = this.#group("buy", rows, [this.#seg("buy", say("sw.buy"), (["card", "once"] as const).map((one) => [one, say(`sw.buy.${one}`)] as const), way,
      (picked) => { this.#way = picked; this.#pay = pay; paying.clearUnpaid(); this.ports.redraw(`buy:${picked}`); })], "h4");
    const fromBalance = way === "once" && pay === "balance"
      ? this.#button("pay", say("sw.planPayBalance", { amount: price }), () => this.#ask("pay", money, w, "pay"), { class: "f-btn primary sw-btn" }) : undefined;
    const paid: Paid = { what: "plan", units: priceUnits, page: "subscribe", chose: { buy: way, pay: way === "card" ? "card" : pay } };
    // The form's ask and way: 连续包月 is a subscription paid by card; 单月 a period paid the way picked.
    const payIn = (place?: FormPlace): void => this.#payIn(way === "card" ? { kind: "subscription" } : { kind: "period" }, way === "card" ? "card" : pay as PayWay, paid, title, price, place);
    return { lapsed, price, title, buy, fromBalance, payIn } as const;
  }

  #plan(reads: UsageReads, money: Priced, w: Writer): readonly Child[] {
    const { say } = this.ports;
    const { lapsed, price, title, buy, fromBalance, payIn } = this.#planForm(money, w);
    const payButton = fromBalance ?? this.#button("pay", say(lapsed ? "sw.planPayResume" : "sw.planPay", { amount: price }), () => payIn(), { class: "f-btn primary sw-btn" });
    // Only a free account's reason leads 订阅: lapsed, failed, trial over or turned away; no warning about the balance.
    const stop = money.state === "free" ? leadsOf(reads, money, false, w, say, this.ports.paying) : [];
    const terms = this.#terms;
    return [...this.#pageHead(title, "subscribe", w, stop),
      h("div", { class: "sw-top" }, h("p", { class: "quiet" }, say("sw.planEach")), h("div", { class: "sw-top-line" }, h("p", { class: "sw-figure" }, price))),
      buy,
      this.#said?.what === "moveFailed" && this.#said.at === "pay" && h("p", { class: "sw-lead answer", role: "status" }, say("sw.moveFailed")),
      this.#payFoot(payButton, say("sw.planNoRefund")),
      // What the price brings stands under the way to pay it, so the button and every sentence about the charge are on the first screen.
      this.#group("brings", [
        this.#row({ label: say("sw.planUse"), help: say("sw.planUseHelp") }),
        this.#row({ label: say("sw.planCredit", { amount: price }) }),
        this.#row({ label: say("sw.planTopUp") }),
        terms !== undefined && this.#row({ label: say("sw.planInvite"), help: say("sw.planInviteHelp", { n: terms.friends, gift: w.money(terms.trial.invited), days: terms.reward_window_days, reward: w.money(terms.reward) }) }),
      ], [termsLink(say, w, "sw.planRules", "pro")], "h4")];
  }

  /**
   * 订阅's form in a card of another page, the road's: the same choice and rows, and the provider's form standing in the card where the
   * pane has the button that opens it over the window. Paid, the window is sent to 账单 as from the pane; the page that holds the card
   * reads that as its own way on.
   */
  planCard(w: Writer, pressing: (on: boolean) => void): readonly Child[] {
    const money = this.ports.reads()?.money;
    if (money === undefined || !priced(money)) return [];
    const { say, paying } = this.ports;
    const { buy, fromBalance, payIn } = this.#planForm(money, w);
    const host = h("div", { class: "sw-card-in" });
    if (fromBalance === undefined) payIn({ kind: "card", host, pressing });
    return [buy,
      paying.unpaidOn("subscribe") && h("p", { class: "sw-lead answer", role: "status" }, say("sw.backUnpaid")),
      this.#said?.what === "moveFailed" && this.#said.at === "pay" && h("p", { class: "sw-lead answer", role: "status" }, say("sw.moveFailed")),
      fromBalance ?? host,
      h("p", { class: "quiet sw-refund" }, say("sw.planNoRefund"))];
  }
}

const ordinal = (d: number): string => `${d}${d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th"}`;
