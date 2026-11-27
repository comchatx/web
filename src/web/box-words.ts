import type { AccountMoney, Balance, Organization, Subscription } from "./backend.js";
import { takesMessages } from "./box-state.js";
import { h } from "./dom.js";
import type { Writer } from "./settings-words.js";
import type { StringKey } from "./strings.js";

/** A line by the message box, as the settings window words it: a sentence whose {braced} words are the one way on, a link to where they lead. */
export type BoxLine = { readonly key: StringKey; readonly values?: Readonly<Record<string, string>>; readonly href?: string };

/** What the lines read: the account's money and membership as the window reads them, and a payment the window holds. */
export type BoxReads = {
  readonly box: "provisioned" | "pending"; readonly balance: Balance | undefined; readonly checkout: boolean;
  readonly money: AccountMoney | undefined; readonly subscription: Subscription | undefined;
  /** A payment paid for and yet to arrive, and whether it is a membership. */
  readonly waiting: boolean; readonly starting: boolean;
  /** The model in view is not the default one: the warning is the one that model's figure is under. */
  readonly own: boolean;
  /** Whether the platform is out of reach. */
  readonly unreachable?: boolean;
  /** The organization the session has active, where it has one: its admin is shown 组织设置's way on, a member whom to ask. */
  readonly organization?: Organization;
};

const BILLING = "#/settings/billing", TOP_UP = "#/settings/billing/top-up";
/** 订阅, where a line's way to a membership leads. */
export const OFFER = "#/settings/billing/subscribe";
const ORGANIZATION_BILLING = "#/organization/billing", ORGANIZATION_TOP_UP = "#/organization/billing/top-up", ORGANIZATION_SEATS = "#/organization/org/seats";

/** A line as drawn: its braced words, where it has a way on, are the link there, inside the one sentence. */
export const linked = (said: string, href: string | undefined): readonly (string | HTMLElement)[] => {
  const [before = "", words, after = ""] = said.split(/\{([^}]+)\}/);
  return words === undefined || href === undefined ? [said] : [before, h("a", { href }, words), after];
};

/**
 * Why the message box takes no message, said where the person would type: no computer yet, which only 跳过 on the road leaves, as a trial
 * that ended; a free account under the floor, by why it stopped; any other under it, by the
 * way on the account has; a payment on its way, with no way on. Where the money could not be read, the floor alone says it. With the
 * platform out of reach, what the page last read of the account may no longer hold, so the line says only that it cannot connect, in the
 * status line's own words.
 */
export function closedLine(reads: BoxReads, w: Writer): BoxLine | undefined {
  const { money, balance } = reads;
  if (!takesMessages(reads.box, balance) && reads.unreachable === true) return { key: "status.unreachable" };
  const short: BoxLine = reads.checkout ? { key: "box.closedPay", href: TOP_UP } : { key: "composer.closedShort" };
  // An account without a computer reaches this page only by 跳过 on the road's plans after its trial: it reads what a free account
  // whose trial ended reads, with the way to 订阅.
  if (reads.box === "pending") return { key: "box.closedFree", href: OFFER };
  if (balance?.can_open !== false) return undefined;
  if (reads.organization !== undefined) return organizationLine(reads, reads.organization, w);
  if (money === undefined) return short;
  if (money.state === "free") {
    if (reads.starting) return { key: "box.closedStarting" };
    const why = money.free?.why;
    const retry = reads.subscription?.status === "retrying" ? reads.subscription.retry : undefined;
    if (why === "membership_ended" && retry !== undefined) return { key: "box.closedRetry", values: { day: w.dayName(retry.on) }, href: BILLING };
    if (why === "membership_ended") return { key: "box.closedLapsed", href: OFFER };
    if (why === "trial_ended") return { key: "box.closedFree", href: OFFER };
    // An account a sign-up turned away is any free account with nothing to draw on: every direct sign-up is given its trial, so no day's places are spoken of.
    return { key: "box.closedShut", href: OFFER };
  }
  if (money.state === "trial") return { key: "box.closedTrial", href: OFFER };
  if (reads.waiting) return { key: "box.closedPaid" };
  return reads.checkout ? { key: "box.closedPay", href: TOP_UP } : { key: "composer.closedShort" };
}

/**
 * Why an organization's message box takes no message, by what its seats are doing: a failed charge tried again, or the balance used up
 * while seats are held, or no seats at all. Its admin is given the way on in 组织设置, 购买席位's step for no seats; a member is told to ask
 * the admin.
 */
function organizationLine(reads: BoxReads, organization: Organization, w: Writer): BoxLine | undefined {
  const admin = organization.role === "admin";
  const state = organization.seats?.state;
  // `/me`'s seat state alone decides the line: in retry, the day of the next try is the subscription's where its answer is that same
  // retry, else the seats', and with neither read the line is said without one. An earlier retry answer turns no other state into one.
  if (state === "retrying") {
    if (!admin) return { key: "box.closedRetryMember" };
    const on = (reads.subscription?.status === "retrying" ? reads.subscription.retry?.on : undefined) ?? organization.seats?.on;
    return on === undefined ? { key: "box.closedRetryPlain", href: ORGANIZATION_BILLING } : { key: "box.closedRetry", values: { day: w.dayName(on) }, href: ORGANIZATION_BILLING };
  }
  if (state === "none") return admin ? { key: "box.closedSeats", href: ORGANIZATION_SEATS } : { key: "box.closedSeatsMember" };
  return admin ? { key: "box.closedPay", href: ORGANIZATION_TOP_UP } : { key: "box.closedPayMember" };
}

/**
 * The line over an open message box: the warning, with the way to the balance, for any account; a trial's end is read on 用量 with its
 * lots. A warning stands down while a payment is on its way. In an organization the admin's way is 组织设置 › 账单, where its other money
 * lines lead; a member is not warned, as Claude tells a member only once the organization is out.
 */
export function balanceLine(reads: BoxReads, w: Writer): BoxLine | undefined {
  const { money } = reads;
  if (money === undefined || reads.box === "pending" || reads.balance?.can_open === false || reads.organization?.role === "member") return undefined;
  const href = reads.organization === undefined ? BILLING : ORGANIZATION_BILLING;
  return !reads.waiting && (reads.own ? money.warning.model_low : money.warning.low) ? { key: "box.low", values: { amount: w.money(money.warning.below) }, href } : undefined;
}
