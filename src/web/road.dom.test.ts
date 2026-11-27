// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AccountMoney, type Features, type InviteAnswer, type Me, type MoneyLot, type PayAnswer, type PayForm, type Returned, type Spaces, type Terms } from "./backend.js";
import { dollars } from "../shared/money.js";
import { cannedSpaces } from "./canned-spaces.js";
import { PlatformBackend } from "./platform-backend.js";
import { openRoad, type RoadBackend, type RoadPorts } from "./road.js";
import { roadSay } from "./road-words.js";
import { WAIT_MS } from "./visit.js";
import { DOOR_PATH } from "../shared/door.js";
import type { SurveyAnswers } from "../shared/survey.js";

const UNITS = 1_000_000;
const me = (more: Partial<Extract<Me, { kind: "signed_in" }>> = {}): Me => ({
  kind: "signed_in", account: "a1", email: "chen@example.com", name: undefined, box: "pending", balance: undefined, money: dollars(UNITS), spending: undefined, terms: false, ...more,
});
const lot = (more: Partial<MoneyLot> = {}): MoneyLot => ({ kind: "sign_up", landed_on: "2026-11-13", units: UNITS, remainder: UNITS, used: 0, ends_on: "2026-11-20", days_left: 7, ...more });
const money = (state: AccountMoney["state"], lots: readonly MoneyLot[] = [], more: Partial<AccountMoney> = {}): AccountMoney => ({
  state, figure: 0, model_figure: 0, debt: 0, blocks: { given: 0, paid: 0 }, lots, warning: { below: 0, low: false, model_low: false },
  renewal: { price: 10 * UNITS, takes: 0, short: 0 }, next_period: { last_day: "2026-12-12", renews_on: "2026-12-13" }, ...more,
});

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

const tab = (): Pick<Storage, "getItem" | "setItem" | "removeItem"> => {
  const kept = new Map<string, string>();
  return { getItem: (key) => kept.get(key) ?? null, setItem: (key, value) => { kept.set(key, value); }, removeItem: (key) => { kept.delete(key); } };
};

type Read = {
  me?: Me; money?: AccountMoney | Error; language?: "zh" | "en"; spaces?: Spaces; spacesRead?: () => Promise<Spaces | undefined>;
  storage?: ReturnType<typeof tab>; checkout?: string; billing?: string; pay?: () => Promise<PayAnswer>; form?: () => Promise<PayForm>; returned?: Returned;
  /** Answers to the account's read, one each in turn, the last standing: a failure is thrown. */
  reads?: readonly (Me | Error | (() => Promise<Me>))[];
  /** `/terms`, unread where absent; whether the page takes payments; a session the platform would not make; the door's work sign-in, or an organisation just made. */
  terms?: Terms; checkoutOff?: true; payInFails?: true; create?: true; created?: { readonly seats: number; readonly work: boolean };
  /** Answers to the payment's read, as `reads`. */
  returns?: readonly (Returned | Error | (() => Promise<Returned>))[];
};
const inTurn = <T>(answers: readonly (T | Error | (() => Promise<T>))[] | undefined, fallback: () => T) => {
  let at = 0;
  return async (): Promise<T> => {
    if (answers === undefined) return fallback();
    const answer = answers[Math.min(at++, answers.length - 1)]!;
    if (answer instanceof Error) throw answer;
    return typeof answer === "function" ? (answer as () => Promise<T>)() : answer;
  };
};
function road(read: Read = {}) {
  const backend = {
    me: vi.fn(inTurn(read.reads, () => read.me ?? me())),
    accountMoney: vi.fn(async () => { const answer = read.money ?? money("trial", [lot()]); if (answer instanceof Error) throw answer; return answer; }),
    terms: vi.fn(async (): Promise<Terms> => { if (read.terms === undefined) throw new Error("/terms unread"); return read.terms; }),
    invite: vi.fn(async (emails: readonly string[]): Promise<InviteAnswer> => ({ sent: emails, refused: [], full: [], known: [] })),
    seatsPrice: vi.fn(async (seats: number) => ({ due: seats * 20 * UNITS, at: 1 })),
    acceptTerms: vi.fn(async (_news: boolean) => {}),
    setName: vi.fn(async (_name: string) => {}),
    startBox: vi.fn(async (_answers?: SurveyAnswers) => true),
    leave: vi.fn(async () => "ended" as const),
    payIn: vi.fn(async (_ask: unknown, _way: string) => { if (read.payInFails === true) throw new Error("/billing/checkout answered 502"); return "cs_1_secret_x"; }),
    payForm: vi.fn(read.form ?? (async () => ({ total: { text: "$10.00", minor: 1_000 }, mount: async () => undefined, pay: read.pay ?? (async () => ({ state: "paid" as const })) }))),
    returned: vi.fn(inTurn(read.returns, () => read.returned ?? { state: "unpaid" })),
    features: { checkout: read.checkoutOff !== true, bringYourOwn: true } as Features,
    spaces: vi.fn(read.spacesRead ?? (async () => read.spaces)),
    use: vi.fn(async (_organization: string | null, _landing?: string) => {}),
  };
  const root = document.createElement("div");
  document.body.append(root);
  const ports: RoadPorts = { backend: backend as unknown as RoadBackend, language: read.language ?? "zh", year: 2026, go: vi.fn(), skip: vi.fn(), cx: () => document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    storage: read.storage ?? tab(), ...(read.checkout === undefined ? {} : { checkout: read.checkout }), ...(read.billing === undefined ? {} : { billing: read.billing }),
    ...(read.create === undefined ? {} : { create: read.create }), ...(read.created === undefined ? {} : { created: read.created }) };
  const opened = openRoad(root, ports);
  const button = (words: string): HTMLButtonElement => [...root.querySelectorAll("button")].find((one) => plain(one) === words || one.getAttribute("aria-label") === words)!;
  const settled = async (): Promise<void> => { await opened; for (let i = 0; i < 10; i += 1) await Promise.resolve(); };
  return { root, backend, ports, button, settled };
}
/** The trial taken where the plans stand, the name typed and sent, and the page it opens on drawn. */
const named = async ({ root, settled }: Pick<ReturnType<typeof road>, "root" | "settled">, name = "陈静"): Promise<void> => {
  await settled();
  root.querySelector<HTMLButtonElement>(".trial button")?.click();
  await settled();
  const field = root.querySelector<HTMLInputElement>("#call")!;
  field.value = name;
  field.dispatchEvent(new Event("input"));
  root.querySelector("form")!.requestSubmit();
  await settled();
  await flush();
};
const flush = async (): Promise<void> => { for (let i = 0; i < 60; i += 1) await Promise.resolve(); };
/** The card a read that has not come back draws: its lines in order, and whether anything on the page can be pressed or a plan is drawn. */
const waits = (root: HTMLElement): readonly unknown[] => [[...root.querySelectorAll(".road-waits .cl-card > *")].map((one) => plain(one)),
  [...root.querySelectorAll(".road-waits [role=status]")].map((one) => plain(one)), root.querySelectorAll("button, input, a").length, root.querySelectorAll(".plan").length];
let hidden = false;
const looked = (now: boolean): void => { hidden = !now; document.dispatchEvent(new Event("visibilitychange")); };
const slow = (): void => {
  hidden = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
};
afterEach(() => { vi.useRealTimers(); hidden = false; });
const plain = (node: Element | null | undefined): string => (node?.textContent ?? "").replace(/[ ⁠]/g, (one) => (one === " " ? " " : ""));

describe("where the road opens", () => {
  it("sends an account whose computer is set up to the chat page, and a signed-out person to the door, drawing nothing", async () => {
    const set = road({ me: me({ box: "provisioned" }) });
    await set.settled();
    const out = road({ me: { kind: "signed_out" } });
    await out.settled();
    expect([set.ports.go, out.ports.go].map((go) => vi.mocked(go).mock.calls)).toEqual([[["/"]], [[DOOR_PATH]]]);
    expect([set.root.childElementCount, out.root.childElementCount]).toEqual([0, 0]);
  });

  it("opens on the terms until they are agreed to, on the plans after, and on the name for a member", async () => {
    const { terms: _unsaid, ...unsaid } = me() as Extract<Me, { kind: "signed_in" }>;
    const terms = road({ me: unsaid });
    await terms.settled();
    const plans = road({ me: me({ terms: true }) });
    await plans.settled();
    const member = road({ me: me({ terms: true }), money: money("member") });
    await member.settled();
    expect([terms, plans, member].map(({ root }) => plain(root.querySelector("h1")))).toEqual(["创建账户", "选择方案", "开始之前，怎么称呼你？"]);
  });
});

describe("an account read that does not come back", () => {
  const refused = (): PlatformBackend => new PlatformBackend({ fetch: async () => { throw new TypeError("Failed to fetch"); }, eventSource: () => { throw new Error("no stream here"); }, clientId: "road",
    go: () => undefined, leaving: { set: () => undefined, take: () => false }, renewing: { set: () => undefined, take: () => undefined } });

  it("says it cannot connect in the road's card, with nothing to press, reads again after the chat page's wait, and goes on to the road's step: a thrown read and a refused fetch", async () => {
    for (const failure of [new Error("/me answered 503"), () => refused().me()]) {
      slow();
      const { root, backend } = road({ reads: [failure, me({ terms: true })] });
      await flush();
      expect(waits(root)).toEqual([["无法连接", "正在重新连接"], ["无法连接"], 0, 0]);
      await vi.advanceTimersByTimeAsync(WAIT_MS - 1);
      expect(backend.me).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await flush();
      expect([backend.me.mock.calls.length, plain(root.querySelector("h1")), root.querySelector(".road-waits")]).toEqual([2, "选择方案", null]);
      vi.useRealTimers();
      document.body.replaceChildren();
    }
  });

  it("goes on reading while the read keeps failing, in English too, and still sends a signed-out person to the door", async () => {
    slow();
    const { root, backend, ports } = road({ reads: [new Error("down"), new Error("down"), { kind: "signed_out" }], language: "en" });
    await flush();
    expect(waits(root)).toEqual([["Can't connect", "Reconnecting"], ["Can't connect"], 0, 0]);
    await vi.advanceTimersByTimeAsync(WAIT_MS);
    expect([backend.me.mock.calls.length, vi.mocked(ports.go).mock.calls]).toEqual([2, []]);
    await vi.advanceTimersByTimeAsync(WAIT_MS);
    await flush();
    expect([backend.me.mock.calls.length, vi.mocked(ports.go).mock.calls]).toEqual([3, [[DOOR_PATH]]]);
  });

  it("asks again after its wait while the page is hidden, as the chat page does", async () => {
    slow();
    const { root, backend } = road({ reads: [new Error("down"), me({ terms: true }), me({ terms: true })] });
    await flush();
    looked(false);
    await vi.advanceTimersByTimeAsync(WAIT_MS - 1);
    expect(backend.me).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect([backend.me.mock.calls.length, plain(root.querySelector("h1"))]).toEqual([2, "选择方案"]);
  });
});

describe("the terms", () => {
  it("refuses 创建账户 without the first tick, saying why on the tick, which takes the keyboard; ticked, it writes both ticks and opens the plans", async () => {
    const { root, backend, button, settled } = road();
    await settled();
    const agree = root.querySelector<HTMLInputElement>("#agree")!;
    const missed = root.querySelector<HTMLElement>("#terms-bad")!;
    expect([missed.hidden, plain(root.querySelector("label[for=agree]"))]).toEqual([true, "我已阅读并同意《服务条款》（在新标签页打开）和《隐私政策》（在新标签页打开）"]);
    expect([...root.querySelectorAll<HTMLAnchorElement>("label[for=agree] a")].map((link) => [link.href, link.target])).toEqual([["https://www.comchatx.com/terms/", "_blank"], ["https://www.comchatx.com/privacy/", "_blank"]]);
    button("创建账户").click();
    expect([missed.hidden, plain(missed), agree.getAttribute("aria-invalid"), agree.getAttribute("aria-describedby"), document.activeElement === agree, backend.acceptTerms.mock.calls.length]).toEqual([false, "请先同意《服务条款》和《隐私政策》。", "true", "terms-bad", true, 0]);
    agree.click();
    expect([missed.hidden, agree.hasAttribute("aria-invalid")]).toEqual([true, false]);
    root.querySelector<HTMLInputElement>("#news")!.click();
    button("创建账户").click();
    await settled();
    expect([backend.acceptTerms.mock.calls, plain(root.querySelector("h1"))]).toEqual([[[true]], "选择方案"]);
  });

  it("names the address verified under the card, and 使用其他邮箱 signs this one out", async () => {
    const { root, backend, button, settled } = road({ language: "en" });
    await settled();
    expect(plain(root.querySelector(".road-foot p"))).toBe("Email verified as chen@example.com");
    button("Use a different email").click();
    expect(backend.leave).toHaveBeenCalledTimes(1);
  });

  it("says a write that did not go through under the press, which may be pressed again", async () => {
    const { root, backend, button, settled } = road();
    backend.acceptTerms.mockRejectedValueOnce(new Error("/account/terms answered 503"));
    await settled();
    root.querySelector<HTMLInputElement>("#agree")!.click();
    button("创建账户").click();
    await settled();
    const failed = root.querySelector<HTMLElement>(".road-card .road-bad.is-alone")!;
    expect([failed.hidden, plain(failed), button("创建账户").disabled, plain(root.querySelector("h1"))]).toEqual([false, "没有成功，请重试。", false, "创建账户"]);
    button("创建账户").click();
    await settled();
    expect([backend.acceptTerms.mock.calls.length, plain(root.querySelector("h1"))]).toEqual([2, "选择方案"]);
  });
});

describe("the plans", () => {
  it("says the account's own trial: what is left of its lot, its last day, and who invited the person, as the record masks them", async () => {
    const { root, button, settled } = road({ me: me({ terms: true }), money: money("trial", [lot({ units: 5 * UNITS, remainder: 5 * UNITS, invited: { by: "wan***@example.com" } })]) });
    await settled();
    expect(plain(root.querySelector(".trial-words"))).toBe("你有 $5.00 试用余额，11 月 20 日到期wan***@example.com 邀请你使用 ComChatX");
    expect([root.querySelectorAll(".plan").length, plain(root.querySelector(".plan-note")), root.querySelector(".road-sub"), root.querySelector(".road-skip")]).toEqual([2, "每月，$10.00 全部计入余额，当期有效", null, null]);
    button("试用 ComChatX").click();
    expect(plain(root.querySelector("h1"))).toBe("开始之前，怎么称呼你？");
  });

  it("names no one for a lot no invitation brought, in English", async () => {
    const { root, settled } = road({ me: me({ terms: true }), language: "en" });
    await settled();
    expect([plain(root.querySelector(".trial-words")), root.querySelector(".road-by")]).toEqual(["You have $1.00 of trial balance until Nov 20", null]);
  });

  it("after a trial, says it ended, offers no trial, and 跳过 opens the chat page for that load alone", async () => {
    const { root, ports, button, settled } = road({ me: me({ terms: true }), money: money("free", [], { free: { why: "trial_ended", ended_on: "2026-11-20" } }) });
    await settled();
    expect([plain(root.querySelector(".road-sub")), root.querySelector(".trial"), root.querySelectorAll(".plan").length]).toEqual(["试用已结束", null, 2]);
    button("跳过").click();
    expect([vi.mocked(ports.skip).mock.calls.length, vi.mocked(ports.go).mock.calls]).toEqual([1, [["/"]]]);
  });
});

it("takes the keyboard to each step's heading as the step is drawn, the terms, the plans, back to them, and each question; the name's field holds it on the name", async () => {
  const { root, button, settled } = road();
  await settled();
  const focused = (): string => { const one = document.activeElement as HTMLElement; return one.tagName === "H1" ? `h1 ${plain(one)}` : one.id || one.tagName; };
  const seen = [focused()];
  root.querySelector<HTMLInputElement>("#agree")!.click();
  button("创建账户").click();
  await settled();
  seen.push(focused());
  button("订阅").click();
  await settled();
  button("返回").click();
  await settled();
  seen.push(focused());
  button("试用 ComChatX").click();
  await settled();
  await flush();
  seen.push(focused());
  await named({ root, settled });
  seen.push(focused());
  button("继续").click();
  await settled();
  seen.push(focused());
  button("返回").click();
  await settled();
  seen.push(focused());
  expect(seen).toEqual(["h1 创建账户", "h1 选择方案", "h1 选择方案", "call", "h1 选择你的身份，让我更好地帮你 可多选", "h1 想让我帮你做什么？可多选", "h1 选择你的身份，让我更好地帮你 可多选"]);
});

it("names the terms box by its whole sentence, and each option by its words, in either language", async () => {
  for (const language of ["zh", "en"] as const) {
    const terms = road({ language });
    await terms.settled();
    const agree = terms.root.querySelector<HTMLInputElement>("#agree")!;
    const shown = terms.root.querySelector("label[for='agree']")!.cloneNode(true) as HTMLElement;
    for (const unseen of shown.querySelectorAll(".door-unseen")) unseen.remove();
    const label = plain(shown).replaceAll("\u2060", "");
    const asked = road({ language, me: me({ terms: true }) });
    await named(asked);
    const blocks = [...asked.root.querySelectorAll<HTMLInputElement>(".f-block input[type='checkbox']")].map((one) => [one.value, plain(one.closest("label"))]);
    expect([agree.getAttribute("aria-label"), blocks.length, blocks.every(([key, words]) => words !== "" && words !== key)], language).toEqual([label, 7, true]);
    terms.root.remove();
    asked.root.remove();
  }
});

describe("the plans as 调整方案 in 账单 opens them", () => {
  const BILLING = "/#/settings/billing";
  const opened = async (account: AccountMoney, language: "zh" | "en" = "zh") => {
    const at = road({ me: me({ box: "provisioned", terms: true }), money: account, billing: BILLING, language });
    await at.settled();
    return at;
  };
  it("draws the plans for a person with a computer, past the road: no trial strip, no 跳过, and the way back to 账单 at the head", async () => {
    const { root, ports } = await opened(money("trial", [lot()]));
    expect([plain(root.querySelector("h1")), root.querySelector(".trial"), root.querySelector(".road-skip"), root.querySelector(".road-sub")]).toEqual(["选择方案", null, null, null]);
    const back = root.querySelector<HTMLAnchorElement>(".road-head .plan-back")!;
    expect([plain(back), back.getAttribute("href"), plain(root.querySelector(".road-head .wordmark"))]).toEqual(["← 账单", BILLING, "ComChatX"]);
    expect(vi.mocked(ports.go).mock.calls).toEqual([]);
  });
  it("says 当前方案 where Pro's press stands for one who holds Pro, off and asking nothing", async () => {
    const { root, ports, backend } = await opened(money("member"));
    const press = root.querySelector<HTMLButtonElement>(".plan .btn")!;
    expect([plain(press), press.getAttribute("aria-disabled"), press.classList.contains("btn-primary")]).toEqual(["当前方案", "true", false]);
    press.click();
    expect([vi.mocked(ports.go).mock.calls, backend.payIn.mock.calls.length]).toEqual([[], 0]);
  });
  it("offers 订阅 on a trial and 恢复订阅 once Pro ended, each opening 账单's 订阅", async () => {
    const trial = await opened(money("trial", [lot()]));
    const lapsed = await opened(money("free", [], { free: { why: "membership_ended", ended_on: "2026-11-20" } }), "en");
    for (const at of [trial, lapsed]) at.root.querySelector<HTMLButtonElement>(".plan .btn")!.click();
    expect([trial, lapsed].map(({ root }) => plain(root.querySelector(".plan .btn")))).toEqual(["订阅", "Resume"]);
    expect([trial, lapsed].map(({ ports }) => vi.mocked(ports.go).mock.calls)).toEqual([[[`${BILLING}/subscribe`]], [[`${BILLING}/subscribe`]]]);
  });
});

describe("a press made by keyboard", () => {
  // Chrome takes the focus off a control that is switched off, so a press that waits keeps the keyboard only on a button that is not.
  const held = (button: HTMLButtonElement): readonly unknown[] => [document.activeElement === button, button.disabled, button.getAttribute("aria-disabled")];
  const pressed = async (button: HTMLButtonElement, settled: () => Promise<void>, refuse: (error: Error) => void): Promise<readonly (readonly unknown[])[]> => {
    button.focus();
    button.click();
    await settled();
    const waiting = held(button);
    refuse(new Error("refused"));
    await settled();
    return [waiting, held(button)];
  };
  const after = [[true, false, "true"], [true, false, null]];

  it("keeps 创建账户 focused through its wait and after it failed, so Enter presses it again", async () => {
    const { root, backend, button, settled } = road();
    let refuse: (error: Error) => void = () => undefined;
    backend.acceptTerms.mockImplementationOnce(() => new Promise((_done, no) => { refuse = no; }));
    await settled();
    root.querySelector<HTMLInputElement>("#agree")!.click();
    expect(await pressed(button("创建账户"), settled, (error) => refuse(error))).toEqual(after);
  });

  for (const which of ["开始使用", "跳过"] as const) {
    it(`keeps ${which} focused through its wait and after it failed, so Enter presses it again`, async () => {
      const { root, backend, button, settled } = road({ me: me({ terms: true }) });
      let refuse: (error: Error) => void = () => undefined;
      backend.startBox.mockImplementationOnce(() => new Promise((_done, no) => { refuse = no; }));
      await named({ root, settled });
      if (which === "开始使用") { button("继续").click(); await settled(); }
      expect(await pressed(button(which), settled, (error) => refuse(error))).toEqual(after);
    });
  }

  it("draws 开始使用 busy from its press, a ring over its word's room, until its request ends, and as it was once that failed", async () => {
    const { root, backend, button, settled } = road({ me: me({ terms: true }) });
    let refuse: (error: Error) => void = () => undefined;
    backend.startBox.mockImplementation(() => new Promise((_done, no) => { refuse = no; }));
    await named({ root, settled });
    button("继续").click();
    await settled();
    const go = button("开始使用");
    // Its name as a screen reader reads it: the label, else the words not hidden under the ring.
    const heardAs = (one: HTMLButtonElement): string => one.getAttribute("aria-label") ?? [...one.childNodes].filter((node) => !(node instanceof HTMLElement && (node.classList.contains("f-word") && one.classList.contains("busy") || node.getAttribute("aria-hidden") === "true"))).map((node) => node.textContent).join("");
    const ring = (one: HTMLButtonElement): readonly unknown[] => [one.classList.contains("busy"), one.getAttribute("aria-busy"), one.querySelectorAll(".f-spin").length, heardAs(one)];
    go.click();
    await settled();
    const waiting = ring(go);
    refuse(new Error("refused"));
    await settled();
    expect([waiting, ring(go)]).toEqual([[true, "true", 1, "开始使用"], [false, null, 0, "开始使用"]]);
  });
});

describe("the 订阅 card", () => {
  const card = async (read: Read = {}) => {
    const at = road({ me: me({ terms: true }), ...read });
    await at.settled();
    at.button("订阅").click();
    await at.settled();
    return at;
  };
  const yes = (root: HTMLElement): HTMLButtonElement => root.querySelector<HTMLButtonElement>("[data-key='card-yes']")!;

  it("is a card on the road: Pro and its price, then 订阅's own choice, rows and the provider's form, with no step over the window and no 取消; 返回 is the plans", async () => {
    const { root, backend, button, settled } = await card();
    expect([plain(root.querySelector("h1")), plain(root.querySelector(".road-order-line")), plain(root.querySelector(".road-words"))]).toEqual(["订阅", "Pro$10.00 每月", "每月，$10.00 全部计入余额，当期有效"]);
    expect([...root.querySelectorAll(".road-pay .sw-row")].map((row) => plain(row))).toEqual(["支付方式银行卡", "续费日每月 13 日", "今天支付 $10.00，此后每月自动从银行卡扣款 $10.00。"]);
    expect([root.querySelector("dialog"), root.querySelector("[data-key='card-no']"), root.querySelectorAll(".road-pay .sw-card-box").length, plain(yes(root)), plain(root.querySelector(".sw-refund"))]).toEqual([null, null, 1, "支付 $10.00", "Pro 费用不退款。"]);
    expect([backend.payIn.mock.calls, backend.payForm.mock.calls]).toEqual([[[{ kind: "subscription" }, "card"]], [["cs_1_secret_x"]]]);
    button("返回").click();
    await settled();
    expect(plain(root.querySelector("h1"))).toBe("选择方案");
  });

  it("draws the card again for a choice, as the pane does, and asks the form for what is chosen: 单月 by Alipay is a period paid that way", async () => {
    const { root, backend, settled } = await card();
    root.querySelector<HTMLInputElement>("[data-key='buy:once']")!.click();
    await settled();
    root.querySelector<HTMLInputElement>("[data-key='pay:alipay']")!.click();
    await settled();
    expect([plain(root.querySelector("h1")), backend.payIn.mock.calls.at(-1), root.querySelectorAll(".road-pay .sw-card-box").length]).toEqual(["订阅", [{ kind: "period" }, "alipay"], 1]);
  });

  it("holds the choices and 返回 while a payment confirms, so no second form can be paid beside it, and frees them at a refusal", async () => {
    let answer: (said: PayAnswer) => void = () => undefined;
    const { root, backend, button, settled } = await card({ pay: () => new Promise<PayAnswer>((given) => { answer = given; }) });
    const held = (): boolean[] => [...root.querySelectorAll<HTMLButtonElement>(".road-pay .f-seg > button"), button("返回")].map((one) => one.disabled);
    yes(root).click();
    await settled();
    const pressed = held();
    answer({ state: "refused", code: "card_declined" });
    await settled();
    expect([pressed, held(), backend.payIn.mock.calls.length]).toEqual([[true, true, true], [false, false, false], 1]);
  });

  it("keeps the keyboard on the option chosen, as 账单 does, so a second arrow on 购买方式 or 支付方式 changes the choice again", async () => {
    const { root, backend, settled } = await card();
    const option = (key: string): HTMLButtonElement => root.querySelector<HTMLButtonElement>(`[data-key='${key}']`)!;
    // An arrow key on a group of options checks the next one and fires its change, as a press on it does; with no option focused it does nothing.
    const arrow = async (): Promise<void> => { (document.activeElement as HTMLElement | null)?.closest(".f-seg")?.querySelector<HTMLElement>("[aria-checked='false']")?.click(); await settled(); };
    const focused = (): string | undefined => (document.activeElement as HTMLElement | null)?.dataset["key"];
    option("buy:card").focus();
    await arrow();
    const once = focused();
    await arrow();
    const back = focused();
    await arrow();
    option("pay:alipay").focus();
    await arrow();
    expect([once, back, focused(), option("buy:once").getAttribute("aria-checked") === "true", backend.payIn.mock.calls.at(-1)]).toEqual(["buy:once", "buy:card", "pay:card", true, [{ kind: "period" }, "card"]]);
  });

  it("goes on to the name once the provider says paid, with what was paid at its head in its own box", async () => {
    const { root, settled } = await card();
    yes(root).click();
    await settled();
    expect([plain(root.querySelector(".road-question")), plain(root.querySelector(".road-ask .sw-lead"))]).toEqual(["开始之前，怎么称呼你？", "已支付 $10.00。Pro 生效可能需要几分钟，生效后余额会更新。"]);
    // In the prototype's box (road.css, .road-paid), still the word the person is told.
    expect([root.querySelector(".road-ask .sw-lead")?.classList.contains("road-paid"), root.querySelector(".road-ask .sw-lead")?.getAttribute("role")]).toEqual([true, "status"]);
  });

  it("keeps a declined card in the card, saying so under the fields, and says a form it could not open is unread, each announced as the road's own failure line is", async () => {
    const declined = await card({ pay: async () => ({ state: "refused", code: "card_declined" }) });
    yes(declined.root).click();
    await declined.settled();
    const unread = await card({ form: async () => { throw new Error("payment form unavailable"); } });
    expect([plain(declined.root.querySelector("h1")), declined.root.querySelector<HTMLElement>("#sw-card-bad")!.hidden, plain(declined.root.querySelector("#sw-card-bad"))]).toEqual(["订阅", false, "银行卡未通过验证，请核对卡片信息或更换银行卡。"]);
    expect([plain(unread.root.querySelector(".road-pay .sw-card-bad:not([hidden])")), yes(unread.root).hidden]).toEqual(["暂时无法获取", true]);
    expect([declined.root.querySelector("#sw-card-bad")?.getAttribute("role"), unread.root.querySelector(".road-pay .sw-card-bad:not([hidden])")?.getAttribute("role")]).toEqual(["alert", "alert"]);
  });

  it("says the account's money unread in the card, where the form has nothing to ask, and 返回 still stands", async () => {
    const { root, backend, button, settled } = await card({ money: new Error("/account/money answered 503") });
    expect([plain(root.querySelector(".road-pay")), backend.payIn.mock.calls.length]).toEqual(["暂时无法获取", 0]);
    button("返回").click();
    await settled();
    expect(plain(root.querySelector("h1"))).toBe("选择方案");
  });

  it("opens an unpaid return on what was being bought and the way: 单月 by Alipay comes back as 单月 by Alipay, and asks the platform for that", async () => {
    const storage = tab();
    const left = await card({ storage, pay: () => new Promise<PayAnswer>(() => undefined) });
    left.root.querySelector<HTMLInputElement>("[data-key='buy:once']")!.click();
    await left.settled();
    left.root.querySelector<HTMLInputElement>("[data-key='pay:alipay']")!.click();
    await left.settled();
    yes(left.root).click();
    await left.settled();
    const back = road({ me: me({ terms: true }), storage, checkout: "cs_1", returned: { state: "unpaid" } });
    await back.settled();
    const checked = [...back.root.querySelectorAll<HTMLElement>(".road-pay .f-seg [aria-checked='true']")].map((one) => one.dataset["key"]);
    expect([plain(back.root.querySelector(".road-pay .sw-lead")), checked, back.backend.payIn.mock.calls]).toEqual(["付款未完成，未扣款", ["buy:once", "pay:alipay"], [[{ kind: "period" }, "alipay"]]]);
  });

  it("keeps 单月 when only the way is changed after an unpaid return, either way round, and asks the platform for that period the new way", async () => {
    for (const [first, then] of [["alipay", "card"], ["card", "alipay"]] as const) {
      const storage = tab();
      const left = await card({ storage, pay: () => new Promise<PayAnswer>(() => undefined) });
      left.root.querySelector<HTMLInputElement>("[data-key='buy:once']")!.click();
      await left.settled();
      left.root.querySelector<HTMLInputElement>(`[data-key='pay:${first}']`)!.click();
      await left.settled();
      yes(left.root).click();
      await left.settled();
      const back = road({ me: me({ terms: true }), storage, checkout: "cs_1", returned: { state: "unpaid" } });
      await back.settled();
      back.root.querySelector<HTMLInputElement>(`[data-key='pay:${then}']`)!.click();
      await back.settled();
      const checked = [...back.root.querySelectorAll<HTMLElement>(".road-pay .f-seg [aria-checked='true']")].map((one) => one.dataset["key"]);
      expect([checked, back.backend.payIn.mock.calls.at(-1)]).toEqual([["buy:once", `pay:${then}`], [{ kind: "period" }, then]]);
    }
  });

  it("reads a way that left the page on coming back: unpaid to the card, which says so, and paid to the name, which says what the ledger credited", async () => {
    const storage = tab();
    const left = await card({ storage, pay: () => new Promise<PayAnswer>(() => undefined) });
    yes(left.root).click();
    await left.settled();
    const unpaid = road({ me: me({ terms: true }), storage, checkout: "cs_1", returned: { state: "unpaid" } });
    await unpaid.settled();
    expect([plain(unpaid.root.querySelector("h1")), plain(unpaid.root.querySelector(".road-pay .sw-lead"))]).toEqual(["订阅", "付款未完成，未扣款"]);
    unpaid.button("返回").click();
    const again = await card({ storage, pay: () => new Promise<PayAnswer>(() => undefined) });
    yes(again.root).click();
    await again.settled();
    const paid = road({ me: me({ terms: true }), storage, checkout: "cs_1", returned: { state: "paid", credited: { kind: "membership", amount: 10 * UNITS, debt_repaid: 0 } } });
    await paid.settled();
    expect([plain(paid.root.querySelector(".road-question")), plain(paid.root.querySelector(".road-ask .sw-lead"))]).toEqual(["开始之前，怎么称呼你？", "Pro 已生效，本期赠送 $10.00 已到账"]);
  });

  it("says it is confirming the payment while its answer is read, and, the read failing, that it cannot confirm yet and not to pay again, drawing no plans; read again, paid goes to the name", async () => {
    let fail: (error: Error) => void = () => undefined;
    const held = (): Promise<Returned> => new Promise((_, refuse) => { fail = refuse; });
    slow();
    const { root, backend } = road({ me: me({ terms: true }), storage: tab(), checkout: "cs_1", returns: [held, { state: "paid", credited: { kind: "membership", amount: 10 * UNITS, debt_repaid: 0 } }] });
    await flush();
    expect(waits(root)).toEqual([["正在确认付款", ""], ["正在确认付款"], 0, 0]);
    fail(new Error("/billing/return answered 502"));
    await flush();
    expect(waits(root)).toEqual([["暂时无法确认付款", "如已支付，请勿重复支付。付款确认后，本页会更新。", "正在重新连接"], ["暂时无法确认付款"], 0, 0]);
    expect([...root.querySelectorAll(".road-more .road-whole")].map((one) => plain(one))).toEqual(["如已支付，请勿重复支付。", "付款确认后，本页会更新。"]);
    await vi.advanceTimersByTimeAsync(WAIT_MS);
    await flush();
    expect([backend.returned.mock.calls.length, plain(root.querySelector(".road-question")), plain(root.querySelector(".road-ask .sw-lead"))]).toEqual([2, "开始之前，怎么称呼你？", "Pro 已生效，本期赠送 $10.00 已到账"]);
  });

  it("keeps saying it cannot confirm while the read fails, in English, and goes to the card it was asked from once the answer is unpaid", async () => {
    const storage = tab();
    const left = await card({ storage, pay: () => new Promise<PayAnswer>(() => undefined) });
    yes(left.root).click();
    await left.settled();
    slow();
    const back = road({ me: me({ terms: true }), storage, checkout: "cs_1", language: "en", returns: [new Error("down"), new Error("down"), { state: "unpaid" }] });
    await flush();
    const unread = [["We can't confirm your payment yet", "If you've already paid, don't pay again. This page updates once the payment is confirmed.", "Reconnecting"], ["We can't confirm your payment yet"], 0, 0];
    expect(waits(back.root)).toEqual(unread);
    await vi.advanceTimersByTimeAsync(WAIT_MS);
    await flush();
    expect([back.backend.returned.mock.calls.length, waits(back.root)]).toEqual([2, unread]);
    await vi.advanceTimersByTimeAsync(WAIT_MS);
    await flush();
    expect([back.backend.returned.mock.calls.length, plain(back.root.querySelector("h1")), plain(back.root.querySelector(".road-pay .sw-lead"))]).toEqual([3, "Subscribe", "Payment not completed. Nothing was charged."]);
  });

  it("names what the ledger credited for a session the tab no longer keeps, as the chat page leaves it once it has said so: a plan as a plan, a top-up as a top-up", async () => {
    const said = [];
    for (const kind of ["membership", "top_up"] as const) {
      const paid = road({ me: me({ terms: true }), storage: tab(), checkout: "cs_1", returned: { state: "paid", credited: { kind, amount: 10 * UNITS, debt_repaid: 0 } } });
      await paid.settled();
      said.push(plain(paid.root.querySelector(".road-ask .sw-lead")));
    }
    expect(said).toEqual(["Pro 已生效，本期赠送 $10.00 已到账", "充值 $10.00 已到账"]);
  });
});

describe("the name and the questions", () => {
  const blocks = (root: HTMLElement): HTMLInputElement[] => [...root.querySelectorAll<HTMLInputElement>(".f-block input")];
  const choose = (root: HTMLElement, ...words: readonly string[]): void => {
    for (const box of blocks(root)) if (words.includes(plain(box.closest("label")))) box.click();
  };
  const cx = (root: HTMLElement): string | null | undefined => root.querySelector(".road-cx-holder .road-cx")?.getAttribute("data-state");

  it("asks the name with its arrow off until something is typed, writes it trimmed, and greets the person by it with cx waving", async () => {
    const { root, backend, button, settled } = road({ me: me({ terms: true }) });
    await settled();
    button("试用 ComChatX").click();
    await settled();
    const field = root.querySelector<HTMLInputElement>("#call")!;
    expect([button("继续").disabled, document.activeElement === field]).toEqual([true, true]);
    field.value = "  陈静 ";
    field.dispatchEvent(new Event("input"));
    expect(button("继续").disabled).toBe(false);
    root.querySelector("form")!.requestSubmit();
    await settled();
    expect([backend.setName.mock.calls, plain(root.querySelector("#ask-hello")), plain(root.querySelector("h1")), cx(root), backend.startBox.mock.calls.length])
      .toEqual([[["陈静"]], "你好，陈静！我是 cx。", "选择你的身份，让我更好地帮你 可多选", "greeting", 0]);
    expect(blocks(root).map((one) => plain(one.closest("label")))).toEqual(["亚马逊卖家", "一个人开店", "Best Buy 卖家", "Agent 开发者", "Shopify 独立站卖家", "其他平台的卖家", "还没开店"]);
  });

  it("asks a seller whose Pro credit has landed, as anyone: the name's press opens the questions and sets no computer up", async () => {
    const { root, backend, settled } = road({ me: me({ terms: true }), money: money("member") });
    await named({ root, settled });
    expect([backend.setName.mock.calls, blocks(root).length, plain(root.querySelector("h1")), backend.startBox.mock.calls.length]).toEqual([[["陈静"]], 7, "选择你的身份，让我更好地帮你 可多选", 0]);
  });

  it("ends the cx a page replaces: after 返回 then 继续 it changes no more, whether its next frame was coming or it waited to blink", async () => {
    const seen: unknown[] = [];
    for (const [when, wait] of [["a frame coming", 0], ["waiting to blink", 100]] as const) {
      // The page's frames run on the test's clock, as its timers do.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
      vi.stubGlobal("requestAnimationFrame", (next: FrameRequestCallback) => setTimeout(() => next(performance.now()), 16));
      vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
      const { root, button, settled } = road({ me: me({ terms: true }) });
      await named({ root, settled });
      button("继续").click();
      await settled();
      button("返回").click();
      await settled();
      vi.advanceTimersByTime(wait);
      const old = root.querySelector(".road-cx")!;
      button("继续").click();
      await settled();
      const changes = (node: Element): MutationObserver => { const watch = new MutationObserver(() => undefined); watch.observe(node, { attributes: true, childList: true, subtree: true, characterData: true }); return watch; };
      const [before, after] = [changes(old), changes(root.querySelector(".road-cx")!)];
      vi.advanceTimersByTime(12_000);
      seen.push([when, before.takeRecords().length, after.takeRecords().length > 0]);
      vi.unstubAllGlobals();
      vi.useRealTimers();
      document.body.replaceChildren();
    }
    expect(seen).toEqual([["a frame coming", 0, true], ["waiting to blink", 0, true]]);
  });

  it("carries the first page's answers on, brings them back with 返回 and cx standing, and 开始使用 sends both pages' answers in the list's order and the line trimmed", async () => {
    const { root, backend, ports, button, settled } = road({ me: me({ terms: true }), language: "en" });
    await named({ root, settled }, "Chen Jing");
    choose(root, "Shopify store owner", "Amazon seller");
    button("Continue").click();
    await settled();
    expect([plain(root.querySelector("h1")), cx(root), blocks(root).some((one) => one.checked)]).toEqual(["What would you like me to help with? Select all that apply", "analysing", false]);
    choose(root, "Claim what Amazon owes me");
    const line = root.querySelector<HTMLInputElement>("#ask-line")!;
    expect([line.maxLength, plain(root.querySelector("label[for='ask-line']"))]).toEqual([100, "Anything else to add?"]);
    line.value = "  More reports ";
    line.dispatchEvent(new Event("input"));
    button("Back").click();
    await settled();
    expect([cx(root), blocks(root).filter((one) => one.checked).map((one) => one.value)]).toEqual(["ready", ["amazonSeller", "shopify"]]);
    button("Continue").click();
    await settled();
    expect([blocks(root).filter((one) => one.checked).map((one) => one.value), root.querySelector<HTMLInputElement>("#ask-line")!.value]).toEqual([["claims"], "  More reports "]);
    button("Let's go").click();
    await settled();
    expect([backend.startBox.mock.calls, vi.mocked(ports.go).mock.calls]).toEqual([[[{ shops: ["amazonSeller", "shopify"], wants: ["claims"], line: "More reports" }]], [["/"]]]);
  });

  it("sends nothing for 跳过, nor for 开始使用 with nothing answered, and sets the computer up either way", async () => {
    const skipped = road({ me: me({ terms: true }) });
    await named(skipped);
    choose(skipped.root, "还没开店");
    skipped.button("跳过").click();
    await skipped.settled();
    const unanswered = road({ me: me({ terms: true }) });
    await named(unanswered);
    unanswered.button("继续").click();
    await unanswered.settled();
    unanswered.root.querySelector<HTMLInputElement>("#ask-line")!.value = "   ";
    unanswered.root.querySelector<HTMLInputElement>("#ask-line")!.dispatchEvent(new Event("input"));
    unanswered.button("开始使用").click();
    await unanswered.settled();
    expect([skipped, unanswered].map(({ backend, ports }) => [backend.startBox.mock.calls, vi.mocked(ports.go).mock.calls])).toEqual([[[[undefined]], [["/"]]], [[[undefined]], [["/"]]]]);
  });

  it("keeps every choice and the line through a press that failed, says so under them, and sends them all when pressed again", async () => {
    const { root, backend, ports, button, settled } = road({ me: me({ terms: true }) });
    backend.startBox.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("offline"));
    await named({ root, settled });
    choose(root, "亚马逊卖家");
    button("继续").click();
    await settled();
    choose(root, "管好广告花费", "按时补货");
    const line = root.querySelector<HTMLInputElement>("#ask-line")!;
    line.value = "更多报表";
    line.dispatchEvent(new Event("input"));
    const failed = root.querySelector<HTMLElement>(".road-bad")!;
    for (let n = 0; n < 2; n += 1) {
      button("开始使用").click();
      await settled();
      expect([failed.hidden, plain(failed), blocks(root).filter((one) => one.checked).map((one) => one.value), line.value, vi.mocked(ports.go).mock.calls.length]).toEqual([false, "没有成功，请重试。", ["ads", "restock"], "更多报表", 0]);
    }
    button("开始使用").click();
    await settled();
    const sent = { shops: ["amazonSeller"], wants: ["ads", "restock"], line: "更多报表" };
    expect([backend.startBox.mock.calls, failed.hidden, vi.mocked(ports.go).mock.calls]).toEqual([[[sent], [sent], [sent]], true, [["/"]]]);
  });

  it("chooses an option with Enter as with Space, and Enter on an option presses nothing", async () => {
    const { root, backend, button, settled } = road({ me: me({ terms: true }) });
    await named({ root, settled });
    const box = blocks(root)[2]!;
    for (let n = 0; n < 3; n += 1) box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    button("继续").click();
    await settled();
    button("返回").click();
    await settled();
    expect([blocks(root).filter((one) => one.checked).map((one) => one.value), plain(root.querySelector("h1")), backend.startBox.mock.calls.length]).toEqual([["bestbuy"], "选择你的身份，让我更好地帮你 可多选", 0]);
  });

  it("draws cx still under reduced motion, its greeting's frame, asking for no frame after", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    let frames = 0;
    vi.stubGlobal("requestAnimationFrame", () => { frames += 1; return 0; });
    const { root, settled } = road({ me: me({ terms: true }) });
    await named({ root, settled });
    expect([cx(root), root.querySelector(".road-cx")!.getAttribute("aria-hidden"), frames]).toEqual(["greeting", "true", 0]);
    vi.unstubAllGlobals();
  });
});

describe("the road's words", () => {
  it("sets a Chinese value against the words beside it, keeps an address free to turn, and holds 使用 ComChatX whole", () => {
    const zh = roadSay("zh");
    expect(zh("note.invited", { who: "王伟" })).toBe("王伟邀\u2060请\u2060你使\u2060用\u00a0ComChatX");
    expect(zh("foot.verified", { email: "chen@example.com" })).toBe("邮箱 chen@example.com 已验证");
    expect(roadSay("en")("ask.hello", { name: "Chen Jing" })).toBe("Welcome, Chen Jing! I'm cx.");
    expect(zh("ask.shop.shopify")).toBe("Shopify\u00a0独立站卖家");
  });
});

describe("the plans page's way back to an organisation", () => {
  const head = (root: HTMLElement): readonly unknown[] => [root.querySelector(".road-head .wordmark")?.textContent, root.querySelector(".road-head .road-space")?.getAttribute("aria-label")];
  const rows = (): readonly unknown[] => [...document.querySelectorAll(".road-head [role=menuitemradio]")].map((row) => [row.querySelector(".f-account-mark")?.className, row.querySelector(".f-words")?.textContent, row.getAttribute("aria-checked")]);

  it("keeps the wordmark at the plans page's head for a person in no organisation", async () => {
    for (const spaces of [undefined, cannedSpaces(0, null)]) {
      const page = road({ me: me({ terms: true }), ...(spaces === undefined ? {} : { spaces }) });
      await page.settled();
      expect([head(page.root), page.root.querySelector(".plan") !== null]).toEqual([["ComChatX", undefined], true]);
      document.body.replaceChildren();
    }
  });

  it("puts the account in use at the head of a person in an organisation, the corner's accounts under it, and a press on an organisation switches to it", async () => {
    const page = road({ me: me({ terms: true, name: "陈静" }), spaces: cannedSpaces(2, null) });
    await page.settled();
    const control = page.root.querySelector<HTMLButtonElement>(".road-head .road-space")!;
    expect([head(page.root), control.querySelector(".road-space-name")?.textContent, control.querySelector(".f-account-mark"), page.root.querySelector(".plan") !== null]).toEqual([[undefined, "切换账户：个人账户"], "个人账户", null, true]);
    control.click();
    expect(rows()).toEqual([["f-account-mark", "Example Trading", "false"], ["f-account-mark", "Example Home", "false"], ["f-account-mark person", "个人账户", "true"]]);
    expect([document.querySelector(".road-head [role=menu]")?.getAttribute("aria-label"), (document.activeElement as HTMLElement).getAttribute("aria-checked")]).toEqual(["切换账户", "true"]);
    document.querySelectorAll<HTMLElement>(".road-head [role=menuitemradio]")[2]!.click();
    expect([page.backend.use.mock.calls, control.getAttribute("aria-expanded")]).toEqual([[], "false"]);
    control.click();
    document.querySelectorAll<HTMLElement>(".road-head [role=menuitemradio]")[0]!.click();
    await page.settled();
    expect(page.backend.use.mock.calls).toEqual([["org_preview_1"]]);
    document.body.replaceChildren();
    const english = road({ me: me({ terms: true }), language: "en", spaces: cannedSpaces(1, null) });
    await english.settled();
    expect(head(english.root)).toEqual([undefined, "Switch account: Personal account"]);
  });

  it("draws the plans page without waiting for the accounts, and puts the way back at its head when the identity SDK gives them", async () => {
    let given!: (spaces: Spaces) => void;
    const page = road({ me: me({ terms: true }), spacesRead: () => new Promise<Spaces | undefined>((resolve) => { given = resolve; }) });
    await page.settled();
    expect([head(page.root), page.root.querySelector(".plan") !== null]).toEqual([["ComChatX", undefined], true]);
    const heading = document.activeElement;
    given(cannedSpaces(1, null));
    await page.settled();
    // The head alone changes: the keyboard stays where the plans page put it.
    expect([head(page.root), page.root.querySelector(".plan") !== null, document.activeElement === heading]).toEqual([[undefined, "切换账户：个人账户"], true, true]);
  });

  it("draws the control on the plans page alone: the terms and the name keep the wordmark", async () => {
    const { terms: _unsaid, ...unsaid } = me() as Extract<Me, { kind: "signed_in" }>;
    const terms = road({ me: unsaid, spaces: cannedSpaces(1, null) });
    await terms.settled();
    const member = road({ me: me({ terms: true }), money: money("member"), spaces: cannedSpaces(1, null) });
    await member.settled();
    expect([head(terms.root), head(member.root)]).toEqual([["ComChatX", undefined], ["ComChatX", undefined]]);
  });
});

describe("the organisation's pages", () => {
  const TERMS: Terms = { units_per_dollar: UNITS, price: 10 * UNITS, top_up_from: 10, paid_months: 1, trial: { direct: UNITS, invited: 5 * UNITS, days: 7 }, friends: 3,
    reward: 5 * UNITS, reward_window_days: 30, seat_price: 20 * UNITS };
  const opened = async (read: Read = {}) => {
    const at = road({ me: me({ terms: true, box: "provisioned" }), billing: "/#/settings/billing", terms: TERMS, money: money("member"), ...read });
    await at.settled();
    return at;
  };
  const named = async (at: Awaited<ReturnType<typeof opened>>, name = "示例贸易"): Promise<void> => {
    at.root.querySelector<HTMLButtonElement>("[data-key='create-org']")!.click();
    const field = at.root.querySelector<HTMLInputElement>("#org-name")!;
    field.value = name;
    field.dispatchEvent(new Event("input"));
    at.root.querySelector<HTMLButtonElement>("[data-key='name-go']")!.click();
    await flush();
  };
  const count = (root: HTMLElement): HTMLInputElement => root.querySelector<HTMLInputElement>("[data-key='seats-count']")!;

  it("draws 组织 beside Pro, a seat's price from /terms, where the page takes payments, and nothing of it where it does not", async () => {
    const { root } = await opened();
    const org = root.querySelector("[aria-labelledby='plan-org']")!;
    expect([plain(org.querySelector(".plan-name")), plain(org.querySelector(".plan-price")), plain(org.querySelector(".plan-note")), [...org.querySelectorAll("li")].map(plain)])
      .toEqual(["组织", "$20.00", "每个席位每月，$20.00 全部计入组织余额，当期有效", ["成员共用 cx 的电脑", "通过邮件邀请成员", "余额和账单归组织所有", "适合 2 至 20 人的团队"]]);
    expect(root.querySelector(".plans")!.classList.contains("is-one")).toBe(false);
    const off = await opened({ checkoutOff: true });
    expect([off.root.querySelector("[aria-labelledby='plan-org']"), off.root.querySelector(".plans")!.classList.contains("is-one")]).toEqual([null, true]);
  });

  it("asks the name on a page of its own: refused empty, held to 50 characters, echoed in the head, and ← back to the plans", async () => {
    const { root, button } = await opened();
    root.querySelector<HTMLButtonElement>("[data-key='create-org']")!.click();
    expect([plain(root.querySelector("h1")), root.querySelector("#org-name")!.getAttribute("maxlength"), root.querySelector(".road-head")!.classList.contains("has-back")]).toEqual(["创建组织", "50", true]);
    button("继续").click();
    const field = root.querySelector<HTMLInputElement>("#org-name")!;
    expect([plain(root.querySelector("#org-bad")), field.getAttribute("aria-invalid"), document.activeElement]).toEqual(["请输入组织名称。", "true", field]);
    field.value = " 示例贸易 ";
    field.dispatchEvent(new Event("input"));
    expect([root.querySelector<HTMLElement>("#org-bad")!.hidden, plain(root.querySelector(".road-brand-org"))]).toEqual([true, "示例贸易"]);
    button("返回").click();
    expect(plain(root.querySelector("h1"))).toBe("选择方案");
  });

  it("opens the seats on two in the order's line, and 调整席位数 on the count: held to 2 and 20 as it is pressed or typed", async () => {
    const at = await opened();
    await named(at);
    const { root, backend } = at;
    expect([plain(root.querySelector("h1")), plain(root.querySelector(".road-tally .road-sumline")), plain(root.querySelector(".road-total")), root.querySelector<HTMLElement>(".road-seats")!.hidden])
      .toEqual(["选择席位数", "2 个席位$40.00", "今日应付总额$40.00", true]);
    expect(backend.payIn.mock.calls).toEqual([[{ kind: "seats", seats: 2, name: "示例贸易" }, "card"]]);
    root.querySelector<HTMLButtonElement>("[data-key='adjust']")!.click();
    const fewer = root.querySelector<HTMLButtonElement>("[data-step='fewer']")!, more = root.querySelector<HTMLButtonElement>("[data-step='more']")!;
    expect([root.querySelector<HTMLElement>(".road-tally")!.hidden, fewer.getAttribute("aria-disabled"), document.activeElement]).toEqual([true, "true", count(root)]);
    more.click();
    expect([count(root).value, plain(root.querySelector(".road-total")), backend.payIn.mock.calls.at(-1)]).toEqual(["3", "今日应付总额$60.00", [{ kind: "seats", seats: 3, name: "示例贸易" }, "card"]]);
    count(root).value = "200";
    count(root).dispatchEvent(new Event("input"));
    expect(count(root).value).toBe("200");
    count(root).dispatchEvent(new Event("blur"));
    expect([count(root).value, plain(root.querySelector("#seats-notes")), more.getAttribute("aria-disabled")]).toEqual(["20", "组织最多可有 20 个席位。", "true"]);
    root.querySelector<HTMLButtonElement>("[data-key='back']")!.click();
    expect(root.querySelector<HTMLInputElement>("#org-name")!.value).toBe("示例贸易");
    root.querySelector<HTMLButtonElement>("[data-key='name-go']")!.click();
    expect([plain(root.querySelector(".road-tally .road-sumline")), root.querySelector<HTMLElement>(".road-seats")!.hidden]).toEqual(["20 个席位$400.00", true]);
  });

  it("makes nothing until the payment lands: paid, it waits for the platform to name the organisation, then switches into it at the step that invites", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const at = await opened({ returns: [{ state: "paid", organization: "pending" }, { state: "paid", organization: "org_9" }] });
    await named(at);
    const yes = at.root.querySelector<HTMLButtonElement>("[data-key='card-yes']")!;
    expect(plain(yes)).toBe("购买 2 个席位 $40.00");
    yes.click();
    await flush();
    expect([plain(yes), yes.disabled, at.backend.use.mock.calls]).toEqual(["正在处理…", true, []]);
    // Paid, ← asks nothing more: the page is the payment's until the organisation is named.
    at.root.querySelector<HTMLButtonElement>("[data-key='back']")!.click();
    expect([at.root.querySelector<HTMLButtonElement>("[data-key='back']")!.disabled, plain(at.root.querySelector("h1")), at.backend.payIn.mock.calls.length]).toEqual([true, "选择席位数", 1]);
    await vi.advanceTimersByTimeAsync(WAIT_MS);
    await flush();
    expect([at.backend.returned.mock.calls, at.backend.use.mock.calls]).toEqual([[["cs_1"], ["cs_1"]], [["org_9", "/start?created=2"]]]);
  });

  it("asks a switch refused once the organisation is named again with the next read, and then moves the seller into it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const unhandled: unknown[] = [];
    const heard = (reason: unknown): void => { unhandled.push(reason); };
    process.on("unhandledRejection", heard);
    try {
      const at = await opened({ returns: [{ state: "paid", organization: "org_9" }] });
      at.backend.use.mockRejectedValueOnce(new Error("switch refused"));
      await named(at);
      at.root.querySelector<HTMLButtonElement>("[data-key='card-yes']")!.click();
      await flush();
      expect(at.backend.use.mock.calls.length).toBe(1);
      await vi.advanceTimersByTimeAsync(WAIT_MS);
      await flush();
      expect([at.backend.returned.mock.calls.length, at.backend.use.mock.calls, unhandled]).toEqual([2, [["org_9", "/start?created=2"], ["org_9", "/start?created=2"]], []]);
    } finally { process.off("unhandledRejection", heard); }
  });

  it("says a declined card in the payment box and makes nothing; a session it could not ask says main's sentence, everything kept, and asks again", async () => {
    const declined = await opened({ pay: async () => ({ state: "refused", code: "card_declined" }) });
    await named(declined);
    declined.root.querySelector<HTMLButtonElement>("[data-key='card-yes']")!.click();
    await flush();
    expect([plain(declined.root.querySelector("#sw-card-bad")), declined.backend.returned.mock.calls.length, declined.backend.use.mock.calls.length]).toEqual(["银行卡未通过验证，请核对卡片信息或更换银行卡。", 0, 0]);
    const failed = await opened({ payInFails: true });
    await named(failed);
    expect([plain(failed.root.querySelector(".road-fields .road-bad")), plain(failed.root.querySelector(".road-tally .road-sumline"))]).toEqual(["没有成功，请重试。", "2 个席位$40.00"]);
    failed.root.querySelector<HTMLButtonElement>("[data-key='card-yes']")!.click();
    await flush();
    expect(failed.backend.payIn.mock.calls.length).toBe(2);
  });

  it("asks an account on a public mailbox for a work address first, refuses another public one, and signs in under the work address at the door", async () => {
    const { root, backend, button } = await opened({ me: me({ terms: true, box: "provisioned", email: "chen@qq.com", publicMailbox: true }) });
    root.querySelector<HTMLButtonElement>("[data-key='create-org']")!.click();
    expect([plain(root.querySelector("h1")), plain(root.querySelector(".cl-headerSubtitle"))]).toEqual(["创建组织", "输入工作邮箱即可开始，我们会向这个邮箱发送验证码。"]);
    const field = root.querySelector<HTMLInputElement>("#work-email")!;
    for (const [typed, said] of [["", "请输入邮箱。"], ["wang@trading", "请输入正确的邮箱地址。"], ["chen@gmail.com", "创建组织需要工作邮箱，请换成公司邮箱。"]] as const) {
      field.value = typed;
      button("继续").click();
      expect([plain(root.querySelector("#work-bad")), field.getAttribute("aria-invalid")]).toEqual([said, "true"]);
    }
    field.value = "chen@trading.example";
    field.dispatchEvent(new Event("input"));
    button("继续").click();
    expect(backend.leave.mock.calls).toEqual([[false, { work: "chen@trading.example" }]]);
  });

  it("opens the name page for the door's work sign-in, and greets the admin of the organisation just made with 添加成员 in its card", async () => {
    const work = road({ me: me({ terms: true, box: "provisioned", email: "chen@trading.example" }), create: true, terms: TERMS });
    await work.settled();
    expect(work.root.querySelector("#org-name")).not.toBeNull();
    const made = road({ me: me({ box: "provisioned", organization: { id: "org_9", role: "admin", name: "示例贸易" } }), created: { seats: 2, work: true }, terms: TERMS });
    await made.settled();
    await flush();
    const card = made.root.querySelector(".cl-card")!;
    expect([plain(card.querySelector(".road-paid")), plain(card.querySelector("h1")), plain(card.querySelector(".iv-left")), plain(card.querySelector(".road-fine"))])
      .toEqual(["已支付 $40.00。", "邀请成员加入示例贸易", "剩余 1 个席位", "对话、文件、插件和余额仍留在个人邮箱的账户里。之后要查看，用那个邮箱重新登录即可。"]);
    const field = card.querySelector<HTMLTextAreaElement>("#iv-field")!;
    field.value = "sun@trading.example";
    field.dispatchEvent(new Event("input"));
    card.querySelector<HTMLButtonElement>("[data-key='yes']")!.click();
    await flush();
    expect([made.backend.invite.mock.calls[0]?.[0], vi.mocked(made.ports.go).mock.calls]).toEqual([["sun@trading.example"], [["/"]]]);
    // The switch not read yet: the page waits and reads again, and draws no plans to pay twice.
    const unswitched = road({ me: me({ terms: true }), created: { seats: 2, work: false }, terms: TERMS });
    await flush();
    expect([plain(unswitched.root.querySelector(".road-waits [role=status]")), unswitched.root.querySelector(".plan")]).toEqual(["正在确认付款", null]);
    const skipped = road({ me: me({ box: "provisioned", organization: { id: "org_9", role: "admin", name: "示例贸易" } }), created: { seats: 2, work: false }, terms: TERMS });
    await skipped.settled();
    expect(plain(skipped.root.querySelector(".road-fine"))).toBe("个人账户保持不变，可随时与示例贸易相互切换。");
    skipped.button("跳过").click();
    expect(vi.mocked(skipped.ports.go).mock.calls).toEqual([["/"]]);
  });
});
