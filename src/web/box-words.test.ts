import { describe, expect, it } from "vitest";
import type { AccountMoney, Balance, Organization, SeatsState, Subscription } from "./backend.js";
import { balanceLine, closedLine, type BoxLine, type BoxReads } from "./box-words.js";
import { canOpen, moneyOf, subscriptionOf, type MoneyWorld } from "./canned-money.js";
import { writer } from "./settings-words.js";
import { text, type Language, type StringKey } from "./strings.js";

const NOW = new Date(2026, 8, 28, 12).getTime();
const UNITS = { currency: "USD", unitsPerMinor: 10_000 } as const;

const readsOf = (world: MoneyWorld, more: Partial<BoxReads> = {}): BoxReads => {
  const money = moneyOf(world, NOW)!;
  const balance: Balance = { available: money.figure, open_floor: 100_000, can_open: canOpen(money) };
  const subscription: Subscription = subscriptionOf(world, NOW);
  return { box: "provisioned", balance, checkout: true, money, subscription, waiting: false, starting: false, own: false, ...more };
};
/** A line as the page reads it: the sentence, with the braced words named and where they lead. */
const read = (line: BoxLine | undefined, language: Language = "zh"): string | undefined => {
  if (line === undefined) return undefined;
  const say = (key: StringKey, values?: Readonly<Record<string, string | number>>): string => text(language, key, values);
  const words = say(line.key, line.values).replace(/\u00a0/g, " ");
  return line.href === undefined ? words : `${words} → ${line.href}`;
};
const w = (language: Language = "zh") => writer({ language, say: (key, values) => text(language, key, values), money: UNITS, year: 2026 });
const closed = (reads: BoxReads, language: Language = "zh"): string | undefined =>
  read(closedLine(reads, w(language)), language);
const over = (reads: BoxReads, language: Language = "zh"): string | undefined => read(balanceLine(reads, w(language)), language);

describe("the message box's lines, in the settings window's words", () => {
  it("close a free account's box under the floor by why it stopped, the way on its link, and open one its balance passes the floor for", () => {
    const short = { available: 0, open_floor: 100_000, can_open: false };
    expect(closed(readsOf("free"))).toBe("试用已结束，{订阅}后可继续 → #/settings/billing/subscribe");
    expect(closed(readsOf("free-lapsed", { balance: short }))).toBe("Pro 已到期，{恢复订阅}后可继续 → #/settings/billing/subscribe");
    expect(closed(readsOf("free-lapsed", { balance: short }), "en")).toBe("Your Pro plan has expired. {Resume} to continue. → #/settings/billing/subscribe");
    expect(closed(readsOf("free-failed", { balance: short }))).toBe("扣款失败，9 月 30 日将再次尝试扣款；可先{更新银行卡}。 → #/settings/billing");
    expect(closed(readsOf("free-lapsed", { balance: short, starting: true, waiting: true }))).toBe("Pro 生效后可继续");
    // Its lots pay the box as any account's do.
    expect([closed(readsOf("free-lapsed")), closed(readsOf("free-failed"))]).toEqual([undefined, undefined]);
  });

  it("close a balance under the floor by the way on the account has: a top-up, a membership for a trial, nothing while a top-up is on its way", () => {
    const floor = readsOf("member-floor");
    expect(floor.balance?.can_open).toBe(false);
    expect(closed(floor)).toBe("余额不足，{充值}后可继续 → #/settings/billing/top-up");
    expect(closed({ ...floor, waiting: true })).toBe("充值到账后可继续");
    expect(closed({ ...floor, checkout: false })).toBe(text("zh", "composer.closedShort"));
    const trial = readsOf("trial-low");
    expect(closed({ ...trial, balance: { ...trial.balance!, can_open: false } })).toBe("试用余额不足，{订阅}后可继续 → #/settings/billing/subscribe");
    expect(closed(readsOf("member-topup"))).toBeUndefined();
  });

  it("say a trial ended to an account without a computer, and the floor alone where the money could not be read", () => {
    expect(closed(readsOf("free", { box: "pending" }))).toBe("试用已结束，{订阅}后可继续 → #/settings/billing/subscribe");
    const unread = { ...readsOf("member-floor"), money: undefined as AccountMoney | undefined };
    expect(closed(unread)).toBe("余额不足，{充值}后可继续 → #/settings/billing/top-up");
    expect(closed({ ...unread, balance: { available: 1, open_floor: 0, can_open: true } })).toBeUndefined();
  });

  it("warn over an open box at the platform's amount, with the way to 账单, and stand down while a payment is on its way", () => {
    expect(over(readsOf("member-low"))).toBe("余额低于 $1.00 {查看余额} → #/settings/billing");
    expect(over(readsOf("member-low"), "en")).toBe("Balance under $1.00 {See balance} → #/settings/billing");
    expect(over(readsOf("member-low", { waiting: true }))).toBeUndefined();
    expect(over(readsOf("member-topup"))).toBeUndefined();
    expect(over(readsOf("member-floor"))).toBeUndefined();
    expect(over(readsOf("free-lapsed"))).toBeUndefined();
    // One money, one line: a free account its lots open the box for reads the warning a member with the same money reads.
    const low = readsOf("member-low");
    const free = { ...low, money: { ...low.money!, state: "free", free: { why: "membership_ended" } } } as BoxReads;
    expect([over(free), over(free, "en")]).toEqual([over(low), over(low, "en")]);
    expect(over(free)).toBe("余额低于 $1.00 {查看余额} → #/settings/billing");
  });

  it("say nothing of a trial with money to go on, whose end 用量 says with its lots, and warn it by the model in view as any account", () => {
    const trial = readsOf("trial");
    expect([over(trial), over(trial, "en"), over(readsOf("trial-new"))]).toEqual([undefined, undefined, undefined]);
    const money = trial.money!;
    expect(over({ ...trial, money: { ...money, warning: { ...money.warning, low: false, model_low: true } }, own: true })).toMatch(/^余额低于 /);
    expect(over({ ...trial, money: { ...money, warning: { ...money.warning, low: false, model_low: true } }, own: false })).toBeUndefined();
    expect(over(readsOf("trial-low"))).toMatch(/^余额低于 .+ {查看余额} → #\/settings\/billing$/);
  });
});

describe("the message box out of reach", () => {
  it("says only that the page cannot connect where the box is closed, since the account last read may be out of date, and an open box stays open", () => {
    const shut: BoxReads = { ...readsOf("trial"), balance: { available: 5, open_floor: 10, can_open: false } };
    expect([closed({ ...shut, unreachable: true }), closed({ ...shut, box: "pending", unreachable: true }, "en"), closed({ ...readsOf("trial"), unreachable: true })])
      .toEqual(["无法连接", "Can't connect", undefined]);
  });
});

describe("an account without a computer", () => {
  it("reads that its trial ended, with the way to 订阅, whether or not the page takes payments, for it reaches the page only by 跳过", () => {
    const pending = (checkout: boolean): string | undefined => closed({ ...readsOf("trial"), box: "pending", checkout }, "en");
    expect([pending(true), pending(false)]).toEqual(["Your trial has ended. {Subscribe} to continue. → #/settings/billing/subscribe", "Your trial has ended. {Subscribe} to continue. → #/settings/billing/subscribe"]);
  });
});

describe("an organisation's message box", () => {
  const short = { available: 0, open_floor: 100_000, can_open: false };
  const seated = (state: SeatsState, role: "admin" | "member"): Organization => ({ id: "org_1", role, name: "Example Trading", seats: { least: 2, most: 150, inUse: 2, state, thisPeriod: 2 } });
  const shut = (world: MoneyWorld, state: SeatsState, role: "admin" | "member", language: Language = "zh"): string | undefined =>
    closed(readsOf(world, { balance: short, organization: seated(state, role) }), language);
  it("gives the admin the way on in 组织设置, and tells a member to ask the admin, by what the seats are doing", () => {
    expect([shut("free-failed", "retrying", "admin"), shut("free-failed", "retrying", "member")])
      .toEqual(["扣款失败，9 月 30 日将再次尝试扣款；可先{更新银行卡}。 → #/organization/billing", "组织的席位已到期，请联系管理员续费"]);
    expect([shut("member", "seats", "admin"), shut("member", "seats", "member"), shut("member", "seats", "member", "en")])
      .toEqual(["余额不足，{充值}后可继续 → #/organization/billing/top-up", "组织余额不足，请联系管理员充值", "The organisation's balance is too low. Ask your admin to top up."]);
  });
  it("says a retry `/me` names without waiting for the subscription's detail, its day the seats' or none", () => {
    const retrying = (role: "admin" | "member", on?: string): string | undefined => closed(readsOf("member", { balance: short,
      organization: { id: "org_1", role, name: "Example Trading", seats: { least: 2, most: 150, inUse: 2, state: "retrying", thisPeriod: 2, ...(on === undefined ? {} : { on }) } } }));
    expect([retrying("admin", "2026-10-02"), retrying("admin"), retrying("member")]).toEqual([
      "扣款失败，10 月 2 日将再次尝试扣款；可先{更新银行卡}。 → #/organization/billing",
      "扣款失败，将再次尝试扣款；可先{更新银行卡}。 → #/organization/billing",
      "组织的席位已到期，请联系管理员续费"]);
  });
  it("tells a member of an organisation with no seats to ask for them, and gives the admin 购买席位's step", () => {
    expect([shut("free", "none", "member"), shut("free", "none", "admin")]).toEqual(["组织的席位已到期，请联系管理员购买席位", "{购买席位}后可立即使用 → #/organization/org/seats"]);
  });
  it("takes its branch from the seat state `/me` gives: an earlier retry answer turns no other state into a retry", () => {
    // `free-failed` holds a subscription answer in retry, with its next try.
    for (const state of ["none", "cancelling", "cut_pending"] as const) {
      const [admin, member] = [shut("free-failed", state, "admin"), shut("free-failed", state, "member")];
      expect([state, admin?.includes("扣款失败") ?? false, member]).toEqual([state, false, state === "none" ? "组织的席位已到期，请联系管理员购买席位" : "组织余额不足，请联系管理员充值"]);
    }
  });
  it("stays open while the balance passes the floor, whatever the seats are doing", () => {
    expect(closed(readsOf("free-failed", { organization: seated("retrying", "member") }))).toBeUndefined();
  });
  it("warns the admin under the warning with the way to 组织设置 › 账单, and warns a member not at all", () => {
    expect([over(readsOf("member-low", { organization: seated("seats", "admin") })), over(readsOf("member-low", { organization: seated("seats", "admin") }), "en"),
      over(readsOf("member-low", { organization: seated("seats", "member") }))])
      .toEqual(["余额低于 $1.00 {查看余额} → #/organization/billing", "Balance under $1.00 {See balance} → #/organization/billing", undefined]);
  });
});
