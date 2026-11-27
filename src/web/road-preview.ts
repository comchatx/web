import type { AccountMoney, Me, PayAnswer, PayForm, Returned } from "./backend.js";
import { dollars } from "../shared/money.js";
import { openRoad, type RoadBackend } from "./road.js";
import { cannedSpaces } from "./canned-spaces.js";
import { SWITCHED } from "./session-ports.js";
import { INVITATION_PARAM, invitationLinkOf } from "../shared/door.js";

// The road from the terms to the chat page over invented account data, no platform behind it: `road.html?state=<state>&lang=zh|en`
// opens it where the state names, and presses through the road's own controls to the state's press. A press that fails answers after
// half a second, so its wait is seen. A read that does not come back: `open-unread` and `return-unread` never answer, `return-wait` is
// still out, and `open-back` and `return-back` fail once and answer at the read after (the chat page's ten seconds). The payment provider's fields are the preview's placeholder; no provider is reached.
// `from-billing`, `from-billing-trial` and `from-billing-lapsed` are the plans page as 调整方案 in a person's 账单 opens it, for one
// who holds Pro, one on a trial and one whose Pro ended: its way back and its 订阅 go to the canned chat page's 账单.
const STATES = ["terms", "terms-fail", "plans", "plans-ended", "from-billing", "from-billing-trial", "from-billing-lapsed", "plans-invited", "plans-invited-used", "card", "card-once-alipay", "card-wait", "card-declined",
  "card-unread", "unpaid", "name", "name-fail", "name-paid", "ask", "ask-some", "ask-back", "ask-next", "ask-next-some", "ask-wait", "ask-failed",
  "open-unread", "open-back", "return-wait", "return-unread", "return-back", "invite", "invite-own", "invite-full", "invite-other", "invite-gone", "handed",
  "create-name", "create-noname", "create-seats", "create-adjust", "create-most", "create-wait", "create-declined", "create-failed", "created", "work", "work-public"] as const;
type State = (typeof STATES)[number];

const query = new URLSearchParams(location.search);
const state: State = STATES.find((one) => one === query.get("state")) ?? "terms";
const language = query.get("lang") === "en" ? "en" : "zh";
document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
const UNITS = 1_000_000;
const INVITER = "wa***@example.com";

// An organisation's invitation: `invite` meets its card after the terms, `invite-own` and `invite-full` with a computer of the person's own
// (the second answered 已满 on 接受邀请), `invite-other` and `invite-gone` a link for another address or gone.
const INVITED = { id: "orginv_preview", organization: { id: "org_preview_1", name: language === "zh" ? "示例贸易" : "Example Trading" }, role: "member", inviter: language === "zh" ? "王伟" : "Wang Wei" };
const invite = state === "invite-other" ? { invited: [], invitationLink: "elsewhere" } : state === "invite-gone" ? { invited: [], invitationLink: "gone" } : state.startsWith("invite") ? { invited: [INVITED] } : {};
// The pages that make an organisation, from the plans page 调整方案 opens, by its 组织 card: `create-name` (`&mail=work` as the door's work
// sign-in lands on it), `create-noname`, `create-seats` (`&n=` the count the order holds), `create-adjust` (`&n=`), `create-most`, and the
// press answered `create-wait` (never), `create-declined` or `create-failed` (no session); `created` (`&n=`, `&mail=work`) the step that
// invites, in the organisation's session; `work` and `work-public` the work address for an account on a public mailbox.
const creating = state.startsWith("create-") || state.startsWith("work");
const workMail = query.get("mail") === "work";
const madeSeats = Number(query.get("n") ?? "2");
const fromBilling = state.startsWith("from-billing") || creating;
const me = { kind: "signed_in", account: "a1", email: "chen@example.com", box: state === "invite-own" || state === "invite-full" || state === "invite-gone" || state === "handed" || fromBilling ? "provisioned" : "pending", money: dollars(UNITS),
  terms: !state.startsWith("terms") && state !== "invite", ...invite, ...(state.startsWith("work") ? { email: "chen@qq.com", publicMailbox: true } : workMail ? { email: "chen@trading.example" } : {}),
  ...(state === "created" ? { organization: { id: "org_preview_new", role: "admin", name: language === "zh" ? "示例贸易" : "Example Trading" } } : {}) } as unknown as Me;
const lot = { kind: "sign_up", landed_on: "2026-11-13", units: UNITS, remainder: UNITS, used: 0, ends_on: "2026-11-20", days_left: 7,
  ...(state === "plans-invited" ? { units: 5 * UNITS, remainder: 5 * UNITS, invited: { by: INVITER } } : state === "plans-invited-used" ? { invited: { by: INVITER } } : {}) };
const trial = { state: "trial", figure: 0, model_figure: 0, debt: 0, blocks: { given: 0, paid: 0 }, warning: { below: 0, low: false, model_low: false },
  lots: [lot], renewal: { price: 10 * UNITS, takes: 0, short: 0 }, next_period: { last_day: "2026-12-12", renews_on: "2026-12-13" } };
const member = (state.startsWith("name") && state !== "name-paid") || state === "from-billing" || creating;
const money = (state === "from-billing-lapsed" ? { ...trial, state: "free", lots: [], free: { why: "membership_ended", ended_on: "2026-11-20" } } : state === "plans-ended" ? { ...trial, state: "free", lots: [], free: { why: "trial_ended", ended_on: "2026-11-20" } } : member ? { ...trial, state: "member" } : trial) as unknown as AccountMoney;

const never = new Promise<never>(() => undefined);
const later = <T>(answer: () => T): Promise<T> => new Promise((settle, refuse) => setTimeout(() => { try { settle(answer()); } catch (error) { refuse(error); } }, 500));
const refused = (why: string) => (): never => { throw new Error(why); };
const form = (secret: string): PayForm => ({
  total: { text: "$10.00", minor: 1000 },
  mount: async (box) => { box.replaceChildren(Object.assign(document.createElement("p"), { className: "tool-note", textContent: `Preview. The payment provider draws ${secret.includes("alipay") ? "Alipay's row" : "the card fields"} here; nothing is wired.` })); },
  pay: () => (state === "card-declined" ? later((): PayAnswer => ({ state: "refused", code: "card_declined" })) : state === "name-paid" ? later((): PayAnswer => ({ state: "paid" })) : never),
});
let reads = 0;
// A person in organisations, ?orgs=1 to 16, on their own account, which has no computer: the plans page's head switches back, and a
// press on an organisation opens the chat preview in it, with the switch's mark, as the platform's pages start again.
const orgs = Number(query.get("orgs"));
const spaces = Number.isInteger(orgs) && orgs >= 1 && orgs <= 16 ? cannedSpaces(orgs, null) : undefined;
const backend = {
  spaces: async () => spaces,
  use: async (organization: string | null, landing?: string) => {
    if (organization === null) return;
    if (landing !== undefined) { location.assign(`./road.html?state=created&lang=${language}&n=${new URLSearchParams(landing.split("?")[1]).get("created")}${workMail ? "&mail=work" : ""}`); return; }
    sessionStorage.setItem(SWITCHED, "1");
    location.assign(`./index.html?lang=${language}&orgs=${orgs}&in=${organization}&own=road`);
  },
  me: async () => { if (state === "open-unread" || (state === "open-back" && reads++ === 0)) throw new Error("/me unreachable"); return me; },
  accountMoney: async () => money,
  acceptTerms: () => later(state === "terms-fail" ? refused("refused") : () => undefined),
  setName: () => later(state === "name-fail" ? refused("refused") : () => undefined),
  startBox: () => (state === "ask-wait" ? never : later(state === "ask-failed" ? refused("refused") : () => true)),
  // The door's work sign-in, its code taken as right: the name page under the work address.
  leave: async (_everywhere?: boolean, landing?: unknown) => { if (typeof landing === "object" && landing !== null) location.assign(`./road.html?state=create-name&mail=work&lang=${language}`); return "ended" as const; },
  terms: async () => ({ units_per_dollar: UNITS, price: 10 * UNITS, top_up_from: 10, paid_months: 1, trial: { direct: UNITS, invited: 5 * UNITS, days: 7 }, friends: 3, reward: 5 * UNITS, reward_window_days: 30, seat_price: 20 * UNITS }),
  invite: (emails: readonly string[]) => later(() => ({ sent: emails, refused: [], full: [], known: [] })),
  seatsPrice: (seats: number) => later(() => ({ due: seats * 20 * UNITS, at: 1 })),
  acceptInvitation: () => later(() => (state === "invite-full" ? "full" : "accepted")),
  declineInvitation: () => later(() => undefined),
  features: { checkout: true },
  returned: async (): Promise<Returned> => {
    if (state === "return-wait") return never;
    if (state === "return-unread" || (state === "return-back" && reads++ === 0)) throw new Error("/billing/return unreachable");
    if (creating) return reads++ === 0 ? { state: "paid", organization: "pending" } : { state: "paid", organization: "org_preview_new" };
    return state === "return-back" ? { state: "paid", credited: { kind: "membership", amount: 10 * UNITS, debt_repaid: 0 } } : { state: "unpaid" };
  },
  payIn: async (ask: { readonly kind: string; readonly seats?: number }, way: string) => {
    if (state === "create-failed") throw new Error("/billing/checkout answered 502");
    return ask.kind === "seats" ? `cs_preview_seats_${ask.seats}_secret_x` : `cs_preview_${way}`;
  },
  payForm: async (secret: string) => {
    if (state === "card-unread") throw new Error("payment form unavailable");
    const seats = /^cs_preview_seats_(\d+)/.exec(secret)?.[1];
    if (seats === undefined) return form(secret);
    const minor = Number(seats) * 2000;
    return { ...form(secret), total: { text: `$${(minor / 100).toFixed(2)}`, minor },
      pay: () => (state === "create-declined" ? later((): PayAnswer => ({ state: "refused", code: "card_declined" })) : state === "create-wait" ? never : later((): PayAnswer => ({ state: "paid" }))) };
  },
} as unknown as RoadBackend;

const storage = sessionStorage;
if (state === "unpaid" || state.startsWith("return")) storage.setItem("cmx-paying", JSON.stringify({ what: "plan", units: 10 * UNITS, page: "subscribe", session: "cs_preview", account: "a1", chose: { buy: "once", pay: "alipay" } }));
else storage.removeItem("cmx-paying");
// 跳过 and 开始使用 go to the chat page: the canned preview's, for an account whose computer is not yet set up.
const own = state === "invite-own" || state === "invite-full" || state === "invite-gone" || state === "handed";
const chat = own ? `./index.html?lang=${language}` : `./index.html?state=box_pending&lang=${language}`;
const figure = document.querySelector<HTMLTemplateElement>("#road-cx");
// `handed`: the chat page's move from `/?link=…`, its answer on the address as the live road reads it; this page's own read carries no link.
const handed = invitationLinkOf(query.get(INVITATION_PARAM));
await openRoad(document.querySelector<HTMLElement>("#road")!, {
  ...(state === "create-name" && workMail ? { create: true as const } : {}),
  ...(state === "created" ? { created: { seats: madeSeats, work: workMail } } : {}),
  ...(handed === undefined ? {} : { link: handed }),
  backend, language, year: 2026, go: () => location.assign(chat), skip: () => undefined, storage,
  cx: () => figure?.content.firstElementChild?.cloneNode(true) ?? document.createElement("span"),
  ...(state === "unpaid" || state.startsWith("return") ? { checkout: "cs_preview" } : {}),
  ...(fromBilling ? { billing: `./index.html?lang=${language}&money=${state === "from-billing" ? "member" : state === "from-billing-trial" ? "trial" : "free-lapsed"}#/settings/billing` } : {}),
});

const tick = (ms = 80): Promise<void> => new Promise((settle) => setTimeout(settle, ms));
const control = <T extends HTMLElement>(selector: string): T | null => document.querySelector<T>(selector);
await tick();
if (state === "terms-fail") { control<HTMLInputElement>("#agree")?.click(); await tick(); control<HTMLButtonElement>(".cl-formButtonPrimary")?.click(); }
if (state.startsWith("card") || state === "name-paid") { control<HTMLButtonElement>(".plan .btn-primary")?.click(); await tick(); }
if (state === "card-once-alipay") { control<HTMLInputElement>("[data-key='buy:once']")?.click(); await tick(); control<HTMLInputElement>("[data-key='pay:alipay']")?.click(); await tick(); }
if (state === "card-wait" || state === "card-declined" || state === "name-paid") { await tick(); control<HTMLButtonElement>("[data-key='card-yes']")?.click(); }
if (state === "name-fail" || state.startsWith("ask")) {
  if (state.startsWith("ask")) { control<HTMLButtonElement>(".trial button")?.click(); await tick(); }
  const field = control<HTMLInputElement>("#call")!;
  field.value = "陈";
  field.dispatchEvent(new Event("input", { bubbles: true }));
  control<HTMLFormElement>("form.road-name")!.requestSubmit();
}
if (state.startsWith("ask")) {
  for (let waited = 0; waited < 4000 && control(".road-asks") === null; waited += 50) await tick(50);
  // A choice is made as a person makes it, by pressing the block: the page holds it across its two questions.
  const choose = (...at: readonly number[]): void => { const blocks = document.querySelectorAll<HTMLInputElement>(".f-block input"); for (const n of at) blocks[n]?.click(); };
  if (state !== "ask") choose(0, 3, 4);
  if (state !== "ask" && state !== "ask-some") {
    control<HTMLButtonElement>(".road-ask-acts .road-go")?.click();
    await tick();
    if (state !== "ask-next") choose(0, 3);
    if (state !== "ask-next") { const line = control<HTMLInputElement>("#ask-line")!; line.value = language === "zh" ? "希望能看懂广告报表" : "I'd like to read my ad reports"; line.dispatchEvent(new Event("input", { bubbles: true })); }
    if (state === "ask-back") control<HTMLButtonElement>(".road-ask-acts .road-link")?.click();
    if (state === "ask-wait" || state === "ask-failed") control<HTMLButtonElement>(".road-ask-acts .road-go")?.click();
  }
}

// The organisation's pages, reached by the presses a seller makes from the plans page.
if (creating && !(state === "create-name" && workMail)) {
  for (let waited = 0; waited < 3000 && control("[data-key='create-org']") === null; waited += 50) await tick(50);
  control<HTMLButtonElement>("[data-key='create-org']")?.click();
  await tick();
}
const typeIn = (field: HTMLInputElement | null, value: string): void => { if (field === null) return; field.value = value; field.dispatchEvent(new Event("input", { bubbles: true })); };
if (state === "work-public") { typeIn(control<HTMLInputElement>("#work-email"), "chen@gmail.com"); control<HTMLButtonElement>("[data-key='work-go']")?.click(); }
if (state.startsWith("create-") && state !== "create-noname") typeIn(control<HTMLInputElement>("#org-name"), language === "zh" ? "示例贸易" : "Example Trading");
if (state === "create-noname") control<HTMLButtonElement>("[data-key='name-go']")?.click();
if (state.startsWith("create-") && state !== "create-name" && state !== "create-noname") {
  control<HTMLButtonElement>("[data-key='name-go']")?.click();
  await tick();
  const n = query.get("n");
  if (state === "create-seats" && n !== null) {
    // The count kept across ← and 继续 stands in the order's line.
    control<HTMLButtonElement>("[data-key='adjust']")?.click();
    typeIn(control<HTMLInputElement>("[data-key='seats-count']"), n);
    control<HTMLButtonElement>("[data-key='back']")?.click();
    await tick();
    control<HTMLButtonElement>("[data-key='name-go']")?.click();
    await tick();
  }
  if (state === "create-adjust" || state === "create-most") {
    control<HTMLButtonElement>("[data-key='adjust']")?.click();
    if (state === "create-most") { typeIn(control<HTMLInputElement>("[data-key='seats-count']"), "20"); control<HTMLButtonElement>("[data-step='more']")?.click(); }
    else if (n !== null) typeIn(control<HTMLInputElement>("[data-key='seats-count']"), n);
  }
  if (state === "create-wait" || state === "create-declined") {
    for (let waited = 0; waited < 3000 && control("[data-key='card-yes']:not(:disabled)") === null; waited += 50) await tick(50);
    control<HTMLButtonElement>("[data-key='card-yes']")?.click();
  }
}
