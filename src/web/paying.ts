import type { AccountMoney, Backend } from "./backend.js";
import { h } from "./dom.js";
import type { Writer } from "./settings-words.js";
import type { Say } from "./stream-view.js";
import { amount, around } from "./usage-page.js";

/** How 订阅 was bought: by the month renewed on a card, or one month, and the way that month is paid. */
export type Chose = { readonly buy: "card" | "once"; readonly pay: "balance" | "alipay" | "card" };
/**
 * What a payment was for: a membership or a top-up, the units it asked, and the page it was asked from; for 订阅, how it was bought, so a
 * payment that comes back unpaid opens the form on the same purchase.
 */
export type Paid = { readonly what: "plan" | "topUp"; readonly units: number; readonly page: "subscribe" | "top-up"; readonly chose?: Chose };
/**
 * A payment the seller made and the ledger is yet to credit, as the browser keeps it for the tab: a way that leaves the page comes back
 * to a page that remembers nothing else. What it brought is the platform's word on its own session, never the newest payment listed.
 */
type Held = Paid & {
  readonly session: string; readonly how: "asked" | "paid" | "credited"; readonly amount?: number; readonly owed?: number; readonly balance?: true;
  /** Taken back from the browser: a hint that a payment may be on its way, whose sum the tab no longer vouches for. */
  readonly restored?: true;
};
/** What the browser keeps: the payment asked for, and whose account asked it. */
type Kept = Paid & { readonly session: string; readonly account: string };
const SESSION = /^cs_[A-Za-z0-9_]{1,200}$/;
const keptOf = (raw: string | null, account: string): Kept | undefined => {
  let kept: unknown;
  try { kept = JSON.parse(raw ?? "null"); } catch { return undefined; }
  if (typeof kept !== "object" || kept === null || Array.isArray(kept)) return undefined;
  const { what, units, page, session, account: whose, chose } = kept as Record<string, unknown>;
  const whole = (what === "plan" || what === "topUp") && (page === "subscribe" || page === "top-up") && Number.isSafeInteger(units) && (units as number) >= 0
    && typeof session === "string" && SESSION.test(session) && whose === account;
  const how = chose as Partial<Chose> | null | undefined;
  const bought = typeof how === "object" && how !== null && (how.buy === "card" || how.buy === "once") && (how.pay === "balance" || how.pay === "alipay" || how.pay === "card")
    ? { chose: { buy: how.buy, pay: how.pay } } : {};
  return whole ? { what, units: units as number, page, session, account, ...bought } : undefined;
};
const KEY = "cmx-paying";
/** A payment session's id is what its secret is made from, before the secret's own part. */
export const sessionOf = (secret: string): string => secret.split("_secret_")[0]!;

/**
 * The payment the seller has come back from, read at each opening while its answer stands: the provider's word through the platform —
 * paid, or not — and then the ledger's: the sum the platform says it credited under that session's own key, never a payment matched by
 * its sum or its place in the list. Once credited the answer is said at that opening and no longer kept.
 */
export class Paying {
  #held: Held | undefined;
  /** A payment that came back unpaid, for the page it was asked from to say so; 账单 says it of a session this tab did not ask for. */
  #unpaid: Paid["page"] | "billing" | undefined;
  /** How the payment that came back unpaid was bought, for its form to open on. */
  #unpaidChose: Chose | undefined;
  /** The unpaid word has been drawn: the next move or opening drops it. */
  #unpaidDrawn = false;
  /** The seller came back from the provider's page, and the page the answer is said on is still to be gone to. */
  #returning = false;
  #unread = false;
  /** What the browser kept is read once the signed-in account is known, at the first opening. */
  #restored = false;
  /** The session the provider sent the seller back from, still to be weighed against what the browser kept. */
  #back: string | undefined;
  /**
   * `credited` is told whenever the ledger has a payment: the page behind the window reads the account again. `account` is whose
   * account is signed in: what the browser kept for another account, or kept in a shape no tab writes, is dropped.
   */
  constructor(readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined, readonly credited: () => void = () => undefined,
    readonly account: () => string | undefined = () => undefined) {}

  #keep(held: Held | undefined): void {
    const credited = held?.how === "credited" && this.#held?.how !== "credited";
    this.#held = held;
    if (credited) this.credited();
    const account = this.account();
    // Only what was asked is kept, never the provider's word or the ledger's: a page that comes back asks the platform again.
    const kept: Kept | undefined = held === undefined || held.how === "credited" || held.balance === true || account === undefined ? undefined
      : { what: held.what, units: held.units, page: held.page, session: held.session, account, ...(held.chose === undefined ? {} : { chose: held.chose }) };
    try { if (kept === undefined) this.storage?.removeItem(KEY); else this.storage?.setItem(KEY, JSON.stringify(kept)); } catch { /* a browser that keeps nothing keeps the answer for this page alone */ }
  }

  #restore(): void {
    if (this.#restored) return;
    const account = this.account();
    if (account === undefined) return;
    this.#restored = true;
    if (this.#held === undefined) {
      let raw: string | null = null;
      try { raw = this.storage?.getItem(KEY) ?? null; } catch { raw = null; }
      const kept = keptOf(raw, account);
      if (kept !== undefined) this.#held = { what: kept.what, units: kept.units, page: kept.page, session: kept.session, how: "asked", restored: true, ...(kept.chose === undefined ? {} : { chose: kept.chose }) };
      else if (raw !== null) try { this.storage?.removeItem(KEY); } catch { /* nothing kept to drop */ }
    }
    const back = this.#back;
    this.#back = undefined;
    // A session this tab did not keep: the platform still answers for it, and for what it brought.
    if (back !== undefined && this.#held?.session !== back) this.#keep({ what: "topUp", units: 0, page: "top-up", session: back, how: "asked" });
  }

  /** A payment about to be confirmed: kept before the provider answers, since a way that leaves the page answers on coming back. */
  asked(paid: Paid, secret: string): void { this.clearUnpaid(); this.#keep({ ...paid, session: sessionOf(secret), how: "asked" }); }
  /** The provider's word in the page. */
  answered(state: "paid" | "unpaid"): void {
    if (this.#held === undefined) return;
    if (state === "paid") this.#keep({ ...this.#held, how: "paid" }); else { this.#unpaid = this.#held.units === 0 ? "billing" : this.#held.page; this.#unpaidChose = this.#held.chose; this.#unpaidDrawn = false; this.#keep(undefined); }
  }
  /** A period paid from the balance: the ledger has it at once. */
  paidFromBalance(price: number): void { this.clearUnpaid(); this.#keep({ what: "plan", units: price, page: "subscribe", session: "", how: "credited", balance: true }); }
  /** Coming back to the page at `?checkout=`: the session the provider sent the seller back from. */
  cameBack(session: string): void {
    this.#returning = true;
    this.#back = session;
    this.#restored = false;
  }

  /**
   * Reads the payment's answer at an opening: the platform's word on the session — paid or not, and once the ledger holds this payment's
   * own credit, what it brought. Once credited, the answer stands however often it is read, until the next opening (`opened`).
   */
  async settle(backend: Pick<Backend, "returned">, money: AccountMoney | undefined): Promise<Paid["page"] | undefined> {
    this.#restore();
    const held = this.#held;
    const returning = this.#returning;
    this.#returning = false;
    this.#unread = false;
    if (held === undefined) return undefined;
    if (held.how === "credited" && held.amount !== undefined) return undefined;
    if (held.balance === true) {
      const included = money?.lots.filter((lot) => lot.kind === "included").at(-1);
      this.#keep({ ...held, how: "credited", amount: included?.units ?? held.units });
      return undefined;
    }
    const answer = await backend.returned(held.session).catch(() => undefined);
    // A read that failed is kept as one, and the next read is still a coming back.
    if (answer === undefined) { this.#unread = true; this.#returning = returning; return undefined; }
    if (this.#held !== held) return undefined;
    // A payment the provider called paid in the page and the platform does not yet is a way still settling: it is waited for.
    if (answer.state === "unpaid" && held.how === "asked") {
      this.answered("unpaid");
      // Back without paying, the seller is taken to the page the payment was asked from, which says so.
      return returning && this.#unpaid !== "billing" ? this.#unpaid : undefined;
    }
    // What was paid is the ledger's word, not the tab's: a session this tab did not keep is a plan or a top-up as the ledger credited it.
    if (answer.state === "paid" && answer.credited !== undefined) this.#keep({ ...held, what: answer.credited.kind === "membership" ? "plan" : "topUp", how: "credited", amount: answer.credited.amount, owed: answer.credited.debt_repaid });
    else if (answer.state === "paid" && held.how === "asked") this.answered("paid");
    return undefined;
  }

  /** A window opens: a payment credited at an earlier opening is no longer said. */
  opened(): void {
    this.#restore();
    if (this.#held?.how === "credited" && this.#held.amount !== undefined) this.#keep(undefined);
  }

  /** A payment the ledger has yet to credit: while its answer stands, the page asks for no more money and warns of nothing. */
  /** The last read of a payment's answer failed: nothing is known of it. */
  get unread(): boolean { return this.#unread; }
  /** A payment is held for this tab, or the seller came back from one: an opening reads its answer, whichever section it opens on. */
  get holding(): boolean { this.#restore(); return this.#held !== undefined || this.#returning; }
  /** A payment the provider or the ledger has called paid, credited or not. */
  get paid(): boolean { return this.#held !== undefined && this.#held.how !== "asked"; }
  get waiting(): boolean { return this.#held !== undefined && this.#held.how === "paid"; }
  /** A membership paid for and yet to start. */
  get starting(): boolean { return this.waiting && this.#held?.what === "plan"; }
  /** The page a payment came back unpaid to, once: it says so there. */
  unpaidOn(page: Paid["page"]): boolean { if (this.#unpaid !== page) return false; this.#unpaidDrawn = true; return true; }
  /** The seller picked again: the word on the last payment goes. */
  clearUnpaid(): void { this.#unpaid = undefined; this.#unpaidChose = undefined; this.#unpaidDrawn = false; }
  /** How the payment `page` asked for, and that came back unpaid, was bought, while its word stands. */
  choseBefore(page: Paid["page"]): Chose | undefined { return this.#unpaid === page ? this.#unpaidChose : undefined; }
  /** A move inside the window, or an opening: an unpaid word already drawn goes, and one still to be drawn on the page it is going to stays. */
  moved(): void { if (this.#unpaidDrawn) this.clearUnpaid(); }

  /** The answer that leads the pane, in the record's words where the payment paid off what was owed. */
  lead(w: Writer, say: Say): readonly HTMLElement[] {
    const held = this.#held;
    if (held === undefined && this.#unpaid === "billing") { this.#unpaidDrawn = true; return [h("p", { class: "sw-lead answer", role: "status" }, say("sw.backUnpaid"))]; }
    // A payment paid by a session this tab did not ask for has no sum to say until the ledger has it.
    if (held === undefined || held.how === "asked" || (held.how === "paid" && (held.units === 0 || held.restored === true))) return [];
    const arrived = amount(held.amount ?? held.units, w);
    const words = held.how === "paid" ? around(say, held.what === "plan" ? "sw.backPaidPlan" : "sw.backPaidTopUp", "amount", amount(held.units, w))
      : held.balance === true ? around(say, "sw.backCreditedPlanBalance", "amount", arrived, {}, { price: amount(held.units, w) })
      : around(say, held.what === "plan" ? "sw.backCreditedPlan" : "sw.backCreditedTopUp", "amount", arrived);
    const owed = held.how === "credited" && (held.owed ?? 0) > 0 ? [w.comma === "，" ? "，" : "; ", ...around(say, "sw.entryOwed", "owed", amount(held.owed!, w))] : [];
    return [h("p", { class: "sw-lead answer", role: "status" }, ...words, ...owed)];
  }
}
