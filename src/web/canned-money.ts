import type { AccountMoney, ByKind, Coupon, Day, Invitations, LotKind, MoneyLot, Payment, PayWay, RecordEntry, SavedCard, SpanId, SpanSpending, SpendKind, Step, Subscription, Terms } from "./backend.js";
import { addDays, daysFrom, localDay } from "./settings-words.js";

/**
 * The preview's accounts for the settings window: the prototype's example states, each answered as the platform's reads would answer it
 * (the money's warning by the platform's own rule, which a test holds against it), dated from the canned clock. Example values live here and in no product code.
 */
export const MONEY_WORLDS = ["member-topup", "member", "member-once", "member-short", "member-cancelled", "member-lots", "member-low", "member-floor", "member-debt", "trial", "trial-new", "trial-low", "free",
  "free-lapsed", "free-failed", "balance-unread", "spending-unread", "worst-many"] as const;
export type MoneyWorld = (typeof MONEY_WORLDS)[number];

const DOLLAR = 1_000_000;
const cents = (n: number): number => Math.round(n * 100) * (DOLLAR / 100);
const PRICE = cents(10);
const SIGN_UP = cents(1);
/** The figures 条款 prints, as the platform serves them. */
export const TERMS: Terms = Object.freeze({
  units_per_dollar: DOLLAR, price: PRICE, top_up_from: cents(10), paid_months: 12, trial: Object.freeze({ direct: cents(1), invited: cents(5), days: 7 }),
  friends: 3, reward: cents(5), reward_window_days: 30,
});
export const monthsOn = (day: Day, n: number): Day => {
  const [y, m, d] = [Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10))];
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
};

/** A credit as a world's ledger holds it: its kind, the day it landed and its dollars; a period its fee the balance paid; a lot's own last day where it is not its kind's. */
type Credit = { readonly kind: LotKind; readonly landed: Day; readonly dollars: number; readonly fromBalance?: true; readonly ends?: Day };
/** A charge: the day it was spent and its dollars, taken as the gate takes it. */
type Charge = { readonly day: Day; readonly dollars: number };
type Shape = {
  readonly state: AccountMoney["state"]; readonly credits: readonly Credit[]; readonly charges: readonly Charge[];
  readonly why?: "trial_ended" | "membership_ended";
  readonly subscription?: Subscription["status"]; readonly cards?: readonly SavedCard[]; readonly payments?: readonly Payment[]; readonly spends?: number;
  readonly unread?: "balance" | "spending"; readonly many?: true;
};
/** A lot as the ledger leaves it: what it holds, the last day it pays, and, once it is gone, how and on which day. */
export type Held = {
  readonly kind: LotKind; readonly landed: Day; readonly units: number; remainder: number; readonly ends: Day; readonly fromBalance: boolean;
  done?: { readonly how: "used_up" | "ended"; readonly on: Day; readonly left: number };
};

/** A lot's last day as the platform sets it: a period's day before it renews, a sign-up lot's week, twelve months for a reward or a top-up. */
const endsOf = (one: Credit): Day =>
  one.ends ?? (one.kind === "included" ? addDays(monthsOn(one.landed, 1), -1) : one.kind === "sign_up" ? addDays(one.landed, 7) : monthsOn(one.landed, 12));

/** The periods back from `first`, a month apart: the n-th lands `n` months before it. */
const periodOf = (first: Day, n: number): Day => monthsOn(first, -n);
const spend = (day: Day, ...dollars: readonly number[]): readonly Charge[] => dollars.map((one) => ({ day, dollars: one }));

/**
 * The three periods before the one that lands on `first`: the last ended with money left, the one before it the balance paid for and
 * used up, and the one before that a card paid for. A top-up landed in that one, paid on once its period's credit was gone, and its last
 * money paid the next period's fee on the day that period landed.
 */
function before(first: Day): { readonly credits: readonly Credit[]; readonly charges: readonly Charge[] } {
  const [p1, p2, p3] = [1, 2, 3].map((n) => periodOf(first, n)) as [Day, Day, Day];
  return {
    credits: [{ kind: "included", landed: p3, dollars: 10 }, { kind: "top_up", landed: addDays(p3, 5), dollars: 20 }, { kind: "included", landed: p2, dollars: 10, fromBalance: true },
      { kind: "included", landed: p1, dollars: 10 }],
    charges: [...spend(addDays(p3, 3), 4), ...spend(addDays(p3, 12), 6), ...spend(addDays(p3, 20), 10), ...spend(addDays(p2, 10), 6), ...spend(addDays(p2, 25), 4),
      ...spend(addDays(p1, 9), 5), ...spend(addDays(p1, 20), 3.65)],
  };
}

const VISA: SavedCard = { id: "card-1", brand: "visa", last4: "4242", exp_month: 8, exp_year: 2028, default: true };

/** Each world's ledger: the credits as they landed and the charges as they were spent, the way the prototype's states read today. */
function shapeOf(world: MoneyWorld, today: Day): Shape {
  // A member's period landed thirteen days ago; a lapsed or failed membership's ended on the day its free reason names.
  const now = addDays(today, -13);
  const period = (landed: Day, ...more: readonly Credit[]): readonly Credit[] => [{ kind: "included", landed, dollars: 10 }, ...more];
  // A period a card paid is a subscription's invoice, which carries its PDF; a payment made once is a checkout's, with a receipt alone.
  const paid = (kind: Payment["kind"], on: Day, dollars: number, way: string): Payment => ({ on, kind, amount: cents(dollars), debt_repaid: 0, way, receipt: `https://pay.example/receipt/${kind}-${on}`,
    ...(kind === "membership" && way === "card" ? { pdf: `https://pay.example/invoice/${on}.pdf` } : {}) });
  // A card paid this period and the last; the top-up before them paid on, and its last money paid a period's fee.
  const memberPaid = [paid("membership", now, 10, "card"), paid("membership", periodOf(now, 1), 10, "card"), paid("top_up", addDays(periodOf(now, 3), 5), 20, "alipay")];
  const card = [VISA];
  const member = (more: readonly Credit[], charges: readonly Charge[], shape: Omit<Shape, "state" | "credits" | "charges"> = { subscription: "active", cards: card, payments: memberPaid }): Shape => {
    const past = before(now);
    return { state: "member", ...shape, credits: [...past.credits, ...period(now), ...more], charges: [...past.charges, ...charges] };
  };
  const reward: Credit = { kind: "reward", landed: addDays(today, -10), dollars: 5 };
  const topUp: Credit = { kind: "top_up", landed: addDays(today, -4), dollars: 30 };
  const thisPeriod = spend(addDays(today, -3), 4.29);
  const signUp = (ago: number, ...charges: readonly Charge[]): { credits: readonly Credit[]; charges: readonly Charge[] } => ({ credits: [{ kind: "sign_up", landed: addDays(today, -ago), dollars: 1 }], charges });
  switch (world) {
    case "member-topup": return member([reward, topUp], thisPeriod, { subscription: "active", cards: card, payments: [paid("top_up", topUp.landed, 30, "alipay"), ...memberPaid] });
    case "member-once": return member([topUp], thisPeriod, { payments: [paid("top_up", topUp.landed, 30, "alipay"), paid("membership", now, 10, "alipay")] });
    case "member-short": {
      // A top-up bought in the last period, paid on once that period's credit was used up.
      const bought: Credit = { kind: "top_up", landed: addDays(today, -40), dollars: 10 };
      return member([bought], [...spend(addDays(periodOf(now, 1), 25), 1.35), ...spend(addDays(periodOf(now, 1), 27), 3.6), ...thisPeriod],
        { payments: [paid("top_up", bought.landed, 10, "alipay"), paid("membership", now, 10, "alipay")] });
    }
    case "member-cancelled": return member([reward, topUp], thisPeriod, { subscription: "cancelling", cards: card, payments: memberPaid });
    case "member": return member([], thisPeriod);
    case "member-lots": {
      // Two top-ups bought a year ago, one ending today and one in five days, and a year of periods a card paid for under them.
      const first = monthsOn(today, -12), second = monthsOn(addDays(today, 5), -12);
      const periods = Array.from({ length: 12 }, (_, n) => periodOf(now, n + 1));
      return {
        state: "member", subscription: "active", cards: card, payments: memberPaid,
        credits: [...periods.flatMap((landed) => period(landed)), { kind: "top_up", landed: first, dollars: 10 }, { kind: "top_up", landed: second, dollars: 10 }, ...period(now), reward, topUp],
        // Every other period used up; after the second's, a quarter of the oldest top-up.
        charges: [...periods.flatMap((landed, n) => [...spend(addDays(landed, 10), 8), ...(n % 2 === 1 ? spend(addDays(landed, 20), 2) : [])]), ...spend(addDays(periods[1]!, 22), 0.25)],
      };
    }
    case "member-low": return member([{ kind: "top_up", landed: addDays(today, -12), dollars: 20 }], [...spend(addDays(today, -10), 7), ...spend(addDays(today, -6), 3), ...spend(addDays(today, -4), 10), ...spend(addDays(today, -1), 9.14)]);
    case "member-floor": return member([{ kind: "top_up", landed: addDays(today, -12), dollars: 20 }], [...spend(addDays(today, -10), 7), ...spend(addDays(today, -6), 3), ...spend(addDays(today, -4), 10), ...spend(addDays(today, -1), 9.94)]);
    case "member-debt": return member([], [...spend(addDays(today, -10), 7), ...spend(addDays(today, -2), 3.42)]);
    case "trial": return { state: "trial", ...signUp(2, ...spend(addDays(today, -1), 0.38)) };
    case "trial-new": return { state: "trial", spends: 0, ...signUp(0) };
    case "trial-low": return { state: "trial", ...signUp(3, ...spend(addDays(today, -2), 0.5), ...spend(addDays(today, -1), 0.38)) };
    case "free": return { state: "free", why: "trial_ended", ...signUp(10, ...spend(addDays(today, -8), 0.6), ...spend(addDays(today, -5), 0.4)) };
    case "free-lapsed": {
      // The last period ended eight days ago, its credit used up; a top-up bought in the period before, part spent after it.
      const last = monthsOn(addDays(today, -7), -1), past = before(last), bought: Credit = { kind: "top_up", landed: addDays(today, -43), dollars: 50 };
      return {
        state: "free", subscription: "none", why: "membership_ended", payments: [paid("top_up", bought.landed, 50, "alipay"), paid("membership", last, 10, "alipay")],
        credits: [...past.credits, bought, ...period(last)],
        charges: [...past.charges, ...spend(addDays(last, 5), 6), ...spend(addDays(today, -20), 4), ...spend(addDays(today, -15), 20)],
      };
    }
    case "free-failed": {
      // The renewal's charge failed three days ago; a top-up bought in the period that ended, part spent after its credit.
      const last = monthsOn(addDays(today, -2), -1), past = before(last), bought: Credit = { kind: "top_up", landed: addDays(today, -23), dollars: 10 };
      return {
        state: "free", subscription: "retrying", why: "membership_ended", cards: card,
        payments: [paid("top_up", bought.landed, 10, "card"), paid("membership", last, 10, "card"), paid("membership", periodOf(last, 1), 10, "card"), paid("top_up", addDays(periodOf(last, 3), 5), 20, "alipay")],
        credits: [...past.credits, ...period(last, bought)],
        charges: [...past.charges, ...spend(addDays(last, 4), 5), ...spend(addDays(today, -12), 5), ...spend(addDays(today, -8), 3.6)],
      };
    }
    case "balance-unread": return member([], thisPeriod, { unread: "balance" });
    case "spending-unread": return member([reward, topUp], thisPeriod, { subscription: "active", cards: card, payments: memberPaid, unread: "spending" });
    case "worst-many": {
      // A top-up of US$50 each month for a year, the first nearly spent, and the three friends' rewards. Eleven periods back, each used up
      // and the oldest top-up paying on, and one period's fee paid from the balance.
      const topUps = Array.from({ length: 12 }, (_, n): Credit => ({ kind: "top_up", landed: monthsOn(addDays(today, -4), n - 11), dollars: 50 }));
      const rewards = [69, 49, 10].map((ago): Credit => ({ kind: "reward", landed: addDays(today, -ago), dollars: 5 }));
      const periods = Array.from({ length: 11 }, (_, n) => periodOf(now, n + 1));
      return {
        state: "member", subscription: "active", cards: card, payments: memberPaid, many: true,
        credits: [...periods.map((landed, n): Credit => ({ kind: "included", landed, dollars: 10, ...(n === 1 ? { fromBalance: true as const } : {}) })), ...topUps, ...rewards, ...period(now)],
        charges: [...periods.flatMap((landed, n) => [...spend(addDays(landed, 5), 6), ...spend(addDays(landed, 15), 4), ...(n < 8 ? spend(addDays(landed, 20), 4.6) : [])]), ...thisPeriod],
      };
    }
  }
}

const LINK = "https://comchatx.example/i/7K2M9QXD";
const FRIENDS = ["wang***@wangshop.example", "li***@lihome.example", "zhao***@zhaotrade.example"] as const;
const LONG_FRIEND = "wang.yoga.purchasing***@a-very-long-subdomain.wangshop-trading-and-logistics-holdings.example";

/**
 * Each world's invitations, the prototype's: a member holds the link; a lapsed account still has the sign-ups its link brought, one of them
 * waiting. `member-cancelled` holds the rows the drawing leaves out: one whose friend's address the platform could not read, one that paid
 * early and earned nothing, and one with an address too long for its row.
 */
export function invitationsOf(world: MoneyWorld, now: number, moved: Moved = {}): Invitations {
  const today = localDay(now);
  const day = (ago: number): Day => addDays(today, -ago);
  const landed = (friend: string | undefined, joined: number, ago: number): Coupon => ({ ...(friend === undefined ? {} : { friend }), signed_up_on: day(joined), reward: "landed", rewarded_on: day(ago), reward_ends_on: addDays(monthsOn(day(ago), 12), -1) });
  const signed = (friend: string, joined: number, reward: "waiting" | "none"): Coupon => ({ friend, signed_up_on: day(joined), reward_by: day(joined - TERMS.reward_window_days), reward });
  const coupons = ((): readonly Coupon[] => {
    switch (world) {
      case "member-topup": case "balance-unread": case "spending-unread": return [signed(FRIENDS[1], 6, "waiting"), landed(FRIENDS[0], 21, 10)];
      case "member-lots": return [landed(FRIENDS[0], 21, 10), signed(FRIENDS[1], 40, "none")];
      case "member-cancelled": return [signed(FRIENDS[2], 3, "none"), landed(undefined, 21, 10), signed(LONG_FRIEND, 25, "waiting")];
      case "worst-many": return [69, 49, 10].map((ago, n) => landed(FRIENDS[n], ago + 12, ago)).reverse();
      case "free-lapsed": case "free-failed": return [signed(FRIENDS[0], 14, "waiting")];
      default: return [];
    }
  })();
  // Every canned friend took a coupon, the oldest the first.
  return { ...(movedShape(world, today, moved).state === "member" ? { link: LINK } : {}), coupons: coupons.map((one, at) => ({ slot: coupons.length - at, ...one })) };
}

/** What the preview's account was moved to in the window: its renewals, its cards, and a period paid from its balance. */
export type Moved = {
  readonly status?: Subscription["status"]; readonly renews?: boolean; readonly cards?: readonly SavedCard[]; readonly renewed?: true;
  /** Payments the provider took in the preview, newest first, each in the ledger as soon as it is paid. */
  readonly landed?: readonly { readonly kind: Payment["kind"]; readonly dollars: number; readonly way: PayWay }[];
};

/**
 * The world as the window moved it, today: a period paid from the balance, then each payment landed, the oldest first. A membership
 * makes the account a member on a period of its own; a top-up pays what is owed as it lands.
 */
function movedShape(world: MoneyWorld, today: Day, moved: Moved): Shape {
  let shape = shapeOf(world, today);
  const member = (fromBalance: boolean): Shape => {
    const { why: _why, ...rest } = shape;
    return { ...rest, state: "member", credits: [...shape.credits, { kind: "included", landed: today, dollars: 10, ...(fromBalance ? { fromBalance: true as const } : {}) }] };
  };
  if (moved.renewed === true) shape = member(true);
  for (const one of [...(moved.landed ?? [])].reverse()) {
    const owed = replay(shape, today).debt;
    const repaid = one.kind === "top_up" ? Math.min(cents(one.dollars), owed) : 0;
    shape = one.kind === "top_up" ? { ...shape, credits: [...shape.credits, { kind: "top_up", landed: today, dollars: one.dollars }] } : member(false);
    shape = { ...shape, payments: [{ on: today, kind: one.kind, amount: cents(one.dollars), debt_repaid: repaid, way: one.way, receipt: "https://pay.example/receipt" }, ...(shape.payments ?? [])] };
  }
  return shape;
}

/**
 * The ledger replayed by the gate's rules, day by day: a lot ends after its last day, with what it holds left; a top-up pays what is owed
 * as it lands; a period whose fee the balance paid takes the price from the top-ups and rewards that end first as it lands; a charge
 * takes the lot that ends first, then the next, and what none holds is owed. A lot emptied is used up on that day.
 */
function replay(shape: Shape, today: Day): { readonly lots: readonly Held[]; readonly debt: number } {
  const credits = [...shape.credits].sort((a, b) => a.landed.localeCompare(b.landed));
  const lots: Held[] = [];
  let debt = 0;
  const draw = (day: Day, units: number, pays: (lot: Held) => boolean): number => {
    let left = units;
    for (const lot of lots.filter((one) => one.done === undefined && one.remainder > 0 && pays(one)).sort((a, b) => a.ends.localeCompare(b.ends) || a.landed.localeCompare(b.landed))) {
      const taken = Math.min(left, lot.remainder);
      lot.remainder -= taken;
      left -= taken;
      if (lot.remainder === 0) lot.done = { how: "used_up", on: day, left: 0 };
      if (left === 0) break;
    }
    return left;
  };
  const first = credits[0]?.landed ?? today;
  for (let day = first; day <= today; day = addDays(day, 1)) {
    for (const lot of lots) if (lot.done === undefined && lot.ends < day) lot.done = { how: "ended", on: lot.ends, left: lot.remainder };
    for (const one of credits.filter((credit) => credit.landed === day)) {
      if (one.fromBalance === true) draw(day, PRICE, (lot) => lot.kind === "top_up" || lot.kind === "reward");
      const repaid = one.kind === "top_up" ? Math.min(cents(one.dollars), debt) : 0;
      debt -= repaid;
      lots.push({ kind: one.kind, landed: one.landed, units: cents(one.dollars) - repaid, remainder: cents(one.dollars) - repaid, ends: endsOf(one), fromBalance: one.fromBalance === true });
    }
    for (const charge of shape.charges.filter((one) => one.day === day)) debt += draw(day, cents(charge.dollars), () => true);
  }
  return { lots, debt };
}

/** Every lot a world's ledger has held, as the replay leaves it: the lots the balance and the record are both cut from. */
export const lotsOf = (world: MoneyWorld, now: number, moved: Moved = {}): readonly Held[] => replay(movedShape(world, localDay(now), moved), localDay(now)).lots;

/** The last day a free account had money it could spend: its membership's last period, else its trial's. */
const endedOn = (lots: readonly Held[], why: Shape["why"]): Day | undefined =>
  why === "membership_ended" ? lots.filter((lot) => lot.kind === "included").at(-1)?.ends : why === "trial_ended" ? lots.find((lot) => lot.kind === "sign_up")?.done?.on : undefined;

export function moneyOf(world: MoneyWorld, now: number, moved: Moved = {}, topUp?: number): AccountMoney | undefined {
  const today = localDay(now);
  const shape = movedShape(world, today, moved);
  if (shape.unread === "balance") return undefined;
  const replayed = replay(shape, today);
  const lots: MoneyLot[] = replayed.lots.filter((one) => one.done === undefined).map((one) => ({
    kind: one.kind, landed_on: one.landed, units: one.units, remainder: one.remainder, used: one.units - one.remainder, ends_on: one.ends, days_left: daysFrom(today, one.ends),
  })).sort((a, b) => a.ends_on.localeCompare(b.ends_on));
  const sum = (kinds: readonly LotKind[]): number => lots.filter((lot) => kinds.includes(lot.kind)).reduce((total, lot) => total + lot.remainder, 0);
  const debt = replayed.debt;
  // What the account owes is taken from the figure, which then reads below nothing.
  const figure = sum(["included", "reward", "sign_up", "top_up"]) - debt;
  const below = shape.state === "trial" ? SIGN_UP / 5 : DOLLAR;
  // A member's period renews a month on from the day it landed, one bought today included; an account with none would start one today.
  const renews = monthsOn(replayed.lots.filter((lot) => lot.kind === "included").at(-1)?.landed ?? today, 1);
  const since = shape.state === "member" ? renews : today;
  const ended = endedOn(replayed.lots, shape.why);
  const payable = sum(["top_up", "reward"]);
  // Every lot pays a model (decision D221), so the figure a model draws on is the whole figure, as the platform serves it.
  const landed = topUp === undefined ? undefined : topUp * DOLLAR - Math.min(topUp * DOLLAR, debt);
  return {
    state: shape.state, figure, model_figure: figure, debt, blocks: { given: sum(["included", "reward", "sign_up"]), paid: sum(["top_up"]) }, lots,
    ...(shape.state === "member" ? { member: { last_day: addDays(renews, -1), renews_on: renews, switch: moved.renews ?? (shape.subscription !== "active" && shape.subscription !== "cancelling") } } : {}),
    ...(shape.why === undefined ? {} : { free: { why: shape.why, ...(ended === undefined ? {} : { ended_on: ended }) } }),
    // The platform's one rule for the warning (`warningFor`): each figure served is low under the same line.
    warning: { below, low: figure < below, model_low: figure < below },
    renewal: {
      price: PRICE, takes: Math.min(PRICE, payable), short: Math.max(0, PRICE - payable),
      ...(landed === undefined ? {} : { with_top_up: { takes: Math.min(landed, Math.max(0, PRICE - payable)), short: Math.max(0, PRICE - payable - landed) } }),
    },
    next_period: { last_day: addDays(monthsOn(since, 1), -1), renews_on: monthsOn(since, 1) },
  };
}

export function subscriptionOf(world: MoneyWorld, now: number, moved: Moved = {}): Subscription {
  const today = localDay(now);
  const shape = shapeOf(world, today);
  const status = moved.status ?? shape.subscription ?? "none";
  // A charge tried again is tried in two days, for the month after the one that ended.
  const ended = endedOn(replay(shape, today).lots, shape.why);
  return status === "retrying" && ended !== undefined ? { status, retry: { on: addDays(today, 2), amount: PRICE, first_day: addDays(ended, 1), last_day: addDays(monthsOn(addDays(ended, 1), 1), -1) } } : { status };
}
export const cardsOf = (world: MoneyWorld, now: number, moved: Moved = {}): readonly SavedCard[] => moved.cards ?? shapeOf(world, localDay(now)).cards ?? [];
/** The payments newest first, as the platform lists them. */
export const paymentsOf = (world: MoneyWorld, now: number, moved: Moved = {}): readonly Payment[] =>
  [...(movedShape(world, localDay(now), moved).payments ?? [])].sort((a, b) => b.on.localeCompare(a.on));
/**
 * 余额记录 from the same ledger, by the platform's rules: every lot that came with no payment, and a top-up once it is gone; newest first
 * by the day it was done, else the day it landed.
 */
export const recordOf = (world: MoneyWorld, now: number, moved: Moved = {}): readonly RecordEntry[] => {
  const latest = (one: Held): Day => one.done?.on ?? one.landed;
  return lotsOf(world, now, moved).filter((one) => one.kind !== "top_up" || one.done !== undefined)
    .sort((a, b) => latest(b).localeCompare(latest(a)) || b.landed.localeCompare(a.landed)).map((one) => ({
      kind: one.kind, landed_on: one.landed, units: one.units, debt_repaid: 0, paid_from_balance: one.fromBalance,
      ...(one.done === undefined ? {} : { done: one.done }),
    }));
};
/** The least a box opens on, one floor for every account, as the platform's `minimumBalance` is. */
export const OPEN_FLOOR = cents(0.1);
/** `/me`'s `can_open`, as the platform works it: no free account and no debt, and the floor in what the lots may pay box time with. */
export const canOpen = (money: AccountMoney): boolean => money.debt === 0 && money.figure >= OPEN_FLOOR;

// ---- What a span spent: a seller's working week and day, the same at every opening ----
const WORKDAY: readonly number[] = [0.03, 0.02, 0, 0, 0, 0, 0, 0.1, 0.4, 0.8, 1, 1, 0.6, 0.7, 1, 1, 0.9, 0.8, 0.6, 0.5, 0.7, 0.8, 0.5, 0.2];
const WORKDAY_SUM = WORKDAY.reduce((a, b) => a + b, 0);
const seeded = (key: string): number => { let x = [...key].reduce((sum, mark) => (Math.imul(sum, 31) + mark.codePointAt(0)!) | 0, 7); x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10_000) / 10_000; };
type Line = { readonly kind: SpendKind; readonly name?: string; readonly share: number };
const LINES: readonly Line[] = [{ kind: "model", name: "anthropic", share: 0.52 }, { kind: "model", name: "moonshotai", share: 0.05 }, { kind: "model", name: "z-ai", share: 0.03 }, { kind: "source", name: "keepa", share: 0.2 }, { kind: "box_time", share: 0.15 }, { kind: "box_storage", share: 0.03 }, { kind: "source", name: "cx-review-lens", share: 0.05 }];
/** An account that was never a member has used a model, the computer and one data source, and no more. */
const THIN: readonly Line[] = [LINES[0]!, LINES[3]!, LINES[4]!];
/** Every line names a plugin the preview's catalogue holds, so each opens its page. */
const MANY: readonly Line[] = [...LINES, ...([["model", "openai"], ["model", "google"], ["source", "amazon-sp-api"], ["model", "deepseek"], ["model", "x-ai"], ["model", "minimax"]] as const)
  .map(([kind, name], n): Line => ({ kind, name, share: 0.01 + (n % 4) * 0.004 }))];
/** A day's spending in units: a weekend is thin, and now and then a day has nothing. */
const dayUnits = (day: Day): number => {
  const weekday = new Date(`${day}T00:00Z`).getUTCDay(), roll = seeded(day);
  return roll < 0.06 ? 0 : Math.round((weekday === 0 ? 0.12 : weekday === 6 ? 0.45 : 1) * (0.6 + 0.8 * roll) * cents(0.3));
};

const STEP_MS: Readonly<Record<"minute" | "five_minutes" | "hour", number>> = { minute: 60_000, five_minutes: 300_000, hour: 3_600_000 };
const pad = (n: number): string => String(n).padStart(2, "0");
const clockOf = (at: Date): string => `${pad(at.getHours())}:${pad(at.getMinutes())}`;
const offsetOf = (at: Date): string => { const minutes = -at.getTimezoneOffset(); return `${minutes < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`; };
const stampOf = (ms: number): string => { const at = new Date(ms); return `${localDay(ms)}T${clockOf(at)}:00${offsetOf(at)}`; };

/** The span's days and bars as the platform cuts them, on the browser's clock. */
function cut(span: SpanId, now: number): { first: Day; last: Day; step: Step; since: number; until: number; under: boolean } {
  const today = localDay(now);
  const start = (day: Day): number => new Date(`${day}T00:00`).getTime();
  const days = (first: Day, last: Day, step: Step) => ({ first, last, step, since: start(first), until: Math.min(now, start(addDays(last, 1))), under: false });
  const ago: Partial<Record<SpanId, [number, Step]>> = { m15: [15, "minute"], m30: [30, "minute"], h1: [60, "five_minutes"], h3: [180, "five_minutes"], h24: [1440, "hour"], h48: [2880, "hour"] };
  const short = ago[span];
  if (short !== undefined) { const since = now - short[0] * 60_000; return { first: localDay(since), last: today, step: short[1], since, until: now, under: true }; }
  const monday = addDays(today, -((new Date(`${today}T00:00Z`).getUTCDay() + 6) % 7));
  const month = `${today.slice(0, 7)}-01`, lastMonth = monthsOn(month, -1), year = `${today.slice(0, 4)}-01-01`, lastYear = `${Number(today.slice(0, 4)) - 1}-01-01`;
  switch (span) {
    case "d7": return days(addDays(today, -6), today, "day");
    case "mo1": return days(addDays(monthsOn(today, -1), 1), today, "day");
    case "y1": return days(addDays(monthsOn(today, -12), 1), today, "month");
    case "today": return days(today, today, "hour");
    case "yesterday": return days(addDays(today, -1), addDays(today, -1), "hour");
    case "week": return days(monday, addDays(monday, 6), "day");
    case "lastWeek": return days(addDays(monday, -7), addDays(monday, -1), "day");
    case "month": return days(month, addDays(monthsOn(month, 1), -1), "day");
    case "lastMonth": return days(lastMonth, addDays(month, -1), "day");
    case "year": return days(year, `${today.slice(0, 4)}-12-31`, "month");
    default: return days(lastYear, addDays(year, -1), "month");
  }
}

export function spendingOf(world: MoneyWorld, span: SpanId, now: number): SpanSpending | undefined {
  const shape = shapeOf(world, localDay(now));
  if (shape.unread === "spending" && span !== "lastMonth") return undefined;
  const today = localDay(now);
  const replayed = replay(shape, today).lots;
  const signUp = replayed.find((lot) => lot.kind === "sign_up");
  const lines = shape.many ? MANY : shape.state === "trial" || shape.why === "trial_ended" ? THIN : LINES;
  const { first, last, step, since, until, under } = cut(span, now);
  const quiet = shape.spends === 0;
  // What a free account spent ends on the day it stopped; a trial's begins the day it signed up, and is what its lot has used.
  const from = signUp?.landed, to = endedOn(replayed, shape.why);
  const days: number[] = [];
  for (let day = from ?? first; from !== undefined && day <= (to ?? today); day = addDays(day, 1)) days.push(dayUnits(day));
  const used = signUp === undefined ? undefined : signUp.units - signUp.remainder;
  const whole = days.reduce((a, b) => a + b, 0);
  const dayOf = (day: Day): number => {
    if ((from !== undefined && day < from) || (to !== undefined && day > to)) return 0;
    if (used === undefined || from === undefined || whole === 0) return dayUnits(day);
    const at = daysFrom(from, day), before = days.slice(0, at).reduce((a, b) => a + b, 0);
    return Math.round(((before + days[at]!) * used) / whole) - Math.round((before * used) / whole);
  };
  // Each bar's units, by the day's spending spread over its working hours and, under an hour, over a few of its minutes.
  const bars: { at: string; units: number }[] = [];
  if (step === "day" || step === "month") {
    for (let day = first; day <= last && new Date(`${day}T00:00`).getTime() < until; day = addDays(day, 1)) {
      const units = quiet ? 0 : dayOf(day);
      const at = step === "day" ? day : day.slice(0, 7);
      const held = bars.at(-1);
      if (held !== undefined && held.at === at) held.units += units; else bars.push({ at, units });
    }
  } else {
    const size = STEP_MS[step];
    for (let at = Math.floor(since / size) * size; at < until; at += size) {
      const hour = new Date(at).getHours(), day = localDay(at);
      const inHour = quiet ? 0 : dayOf(day) * (WORKDAY[hour]! / WORKDAY_SUM) * (0.5 + seeded(`${day}${hour}`));
      const units = step === "hour" ? inHour : seeded(stampOf(at)) < 0.3 ? inHour * (size / 3_600_000) * 3.3 : 0;
      bars.push({ at: stampOf(at), units: Math.round(units) });
    }
  }
  const spent = bars.filter((bar) => bar.units > 0);
  // Each bar split over the lines, a line now and then sitting a bar out.
  const split = spent.map((bar) => {
    const weights = lines.map((line, k) => (k > 2 && seeded(`${bar.at}${k}`) < 0.5 ? 0 : line.share * (0.6 + 0.8 * seeded(`${bar.at}:${k}`))));
    const whole = weights.reduce((a, b) => a + b, 0);
    const parts = weights.map((one) => Math.floor((bar.units * one) / whole));
    parts[0]! += bar.units - parts.reduce((a, b) => a + b, 0);
    return parts;
  });
  const totals = lines.map((_, k) => split.reduce((sum, parts) => sum + parts[k]!, 0));
  const order = lines.map((_, k) => k).filter((k) => totals[k]! > 0).sort((a, b) => totals[b]! - totals[a]!);
  const kindsOf = (parts: readonly number[]): ByKind => ({ model: 0, source: 0, box_time: 0, box_storage: 0, ...Object.fromEntries((["model", "source", "box_time", "box_storage"] as const).map((kind) => [kind, parts.reduce((sum, units, k) => sum + (lines[k]!.kind === kind ? units : 0), 0)])) });
  const total = spent.reduce((sum, bar) => sum + bar.units, 0);
  const folds = order.length > 6 ? 5 : undefined;
  return {
    span, step, first_day: first, last_day: last, ...(under ? { from: clockOf(new Date(since)), to: clockOf(new Date(until)) } : {}), total, kinds: kindsOf(totals),
    lines: order.map((k) => ({ kind: lines[k]!.kind, ...(lines[k]!.name === undefined ? {} : { name: lines[k]!.name }), units: totals[k]! })),
    ...(folds === undefined ? {} : { other: { from: folds, units: order.slice(folds).reduce((sum, k) => sum + totals[k]!, 0) } }),
    bars: spent.map((bar, b) => ({ at: bar.at, total: bar.units, kinds: kindsOf(split[b]!), lines: order.flatMap((k, line) => (split[b]![k]! > 0 ? [{ line, units: split[b]![k]! }] : [])) })),
  };
}
