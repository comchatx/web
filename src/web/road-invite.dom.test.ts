// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AccountMoney, type Features, type InvitedTo, type Me } from "./backend.js";
import { dollars } from "../shared/money.js";
import { openRoad, type RoadBackend, type RoadPorts } from "./road.js";

// The organisation's invitation card on the road, in each case the person meets it: new to ComChatX after the terms, or with a
// computer of their own back from the door; the link for another address or gone; the organisation full by then.
const UNITS = 1_000_000;
const INVITED: InvitedTo = { id: "orginv_1", organization: { id: "org_1", name: "Example Trading" }, role: "member", inviter: "Wang Wei" };
const me = (more: Partial<Extract<Me, { kind: "signed_in" }>> = {}): Me => ({
  kind: "signed_in", account: "a1", email: "zhao@trading.example", name: undefined, box: "pending", balance: undefined, money: dollars(UNITS), spending: undefined, terms: true, invited: [INVITED], ...more,
});
const money = (): AccountMoney => ({
  state: "trial", figure: 0, model_figure: 0, debt: 0, blocks: { given: 0, paid: 0 }, lots: [], warning: { below: 0, low: false, model_low: false },
  renewal: { price: 10 * UNITS, takes: 0, short: 0 }, next_period: { last_day: "2026-12-12", renews_on: "2026-12-13" },
});

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

function road(person: Me, accept: "accepted" | "full" | "gone" = "accepted", language: "zh" | "en" = "zh") {
  const backend = {
    me: vi.fn(async () => person),
    accountMoney: vi.fn(async () => money()),
    terms: vi.fn(async (): Promise<never> => { throw new Error("/terms unread"); }),
    acceptTerms: vi.fn(async (_news: boolean) => {}),
    setName: vi.fn(async (_name: string) => {}),
    startBox: vi.fn(async () => true),
    leave: vi.fn(async () => "ended" as const),
    returned: vi.fn(async () => ({ state: "unpaid" as const })),
    features: { checkout: true, bringYourOwn: true } as Features,
    spaces: vi.fn(async () => undefined),
    use: vi.fn(async (_organization: string | null) => {}),
    acceptInvitation: vi.fn(async (_id: string) => accept),
    declineInvitation: vi.fn(async (_id: string) => {}),
  };
  const root = document.createElement("div");
  document.body.append(root);
  const ports: RoadPorts = { backend: backend as unknown as RoadBackend, language, year: 2026, go: vi.fn(), skip: vi.fn(), cx: () => document.createElementNS("http://www.w3.org/2000/svg", "svg"), storage: undefined };
  const opened = openRoad(root, ports);
  const settled = async (): Promise<void> => { await opened; for (let i = 0; i < 10; i += 1) await Promise.resolve(); };
  const button = (words: string): HTMLButtonElement => [...root.querySelectorAll("button")].find((one) => plain(one) === words)!;
  return { root, backend, ports, settled, button };
}
const plain = (from: Element | null): string => (from?.textContent ?? "").replace(/[ ⁠]/g, (one) => (one === " " ? " " : "")).trim();
const card = (root: HTMLElement): readonly string[] => [...root.querySelectorAll(".cl-card h1, .cl-card p:not([hidden]), .cl-card button")].map((one) => plain(one)).filter((one) => one !== "");

describe("the invitation card", () => {
  it("stands after the terms for a person new to ComChatX: who invites them to what, what the computer holds, 接受邀请 and 拒绝邀请", async () => {
    const at = road(me({ terms: false }));
    await at.settled();
    at.root.querySelector<HTMLInputElement>("#agree")!.click();
    at.button("同意并继续")?.click() ?? at.root.querySelector<HTMLButtonElement>(".cl-formButtonPrimary")!.click();
    await at.settled();
    expect(card(at.root)).toEqual(["邀请你加入 Example Trading", "邀请人：Wang Wei", "组织的电脑里的对话、看板、API Key、登录信息和授权都归组织所有，其他成员的 cx 都能读取或使用。只属于你自己的内容，请放在个人账户。", "接受邀请", "拒绝邀请"]);
    expect(at.root.querySelector(".road-org-mark")?.textContent).toBe("E");
  });

  it("joins by the provider's own call, names the person new to ComChatX, then opens the organisation's chat page", async () => {
    const at = road(me());
    await at.settled();
    at.button("接受邀请").click();
    await at.settled();
    expect(at.backend.acceptInvitation.mock.calls).toEqual([["orginv_1"]]);
    const field = at.root.querySelector<HTMLInputElement>("#call")!;
    field.value = "赵敏";
    field.dispatchEvent(new Event("input"));
    at.root.querySelector("form")!.requestSubmit();
    await at.settled();
    expect([at.backend.setName.mock.calls, at.backend.use.mock.calls, at.backend.startBox.mock.calls]).toEqual([[["赵敏"]], [["org_1"]], []]);
  });

  it("takes one with a computer of their own straight to the organisation's chat page, and a decline back to their own", async () => {
    const joining = road(me({ box: "provisioned" }));
    await joining.settled();
    joining.button("接受邀请").click();
    await joining.settled();
    expect([joining.backend.use.mock.calls, joining.root.querySelector("#call")]).toEqual([[["org_1"]], null]);
    document.body.replaceChildren();
    const declining = road(me({ box: "provisioned" }));
    await declining.settled();
    declining.button("拒绝邀请").click();
    await declining.settled();
    expect([declining.backend.declineInvitation.mock.calls, declining.ports.go]).toEqual([[["orginv_1"]], expect.anything()]);
    expect(vi.mocked(declining.ports.go).mock.calls).toEqual([["/"]]);
  });

  it("goes on as a person alone after a decline, to the plans, where the person is new to ComChatX", async () => {
    const at = road(me());
    await at.settled();
    at.button("拒绝邀请").click();
    await at.settled();
    expect([at.backend.declineInvitation.mock.calls.length, at.root.querySelector(".trial") !== null || at.root.querySelector(".road-plans, .plan") !== null]).toEqual([1, true]);
  });

  it("says the organisation is full where its press stood, with the way on as a person alone", async () => {
    const at = road(me({ box: "provisioned" }), "full");
    await at.settled();
    at.button("接受邀请").click();
    await at.settled();
    expect(card(at.root)).toEqual(["邀请你加入 Example Trading", "邀请人：Wang Wei", "Example Trading的成员数已达上限，暂时无法加入。请联系Wang Wei。", "使用个人账户"]);
    at.button("使用个人账户").click();
    expect(vi.mocked(at.ports.go).mock.calls).toEqual([["/"]]);
  });

  it("says a link for another address with 使用其他邮箱, and a link gone with the way on as a person alone", async () => {
    const other = road(me({ invited: [], invitationLink: "elsewhere" }));
    await other.settled();
    expect(card(other.root)).toEqual(["该邀请无法使用", "当前登录的邮箱是 zhao@trading.example。请使用收到邀请的邮箱登录。", "使用其他邮箱", "使用个人账户"]);
    other.button("使用其他邮箱").click();
    expect(other.backend.leave).toHaveBeenCalledTimes(1);
    document.body.replaceChildren();
    const gone = road(me({ box: "provisioned", invited: [], invitationLink: "gone" }));
    await gone.settled();
    expect(card(gone.root).slice(0, 2)).toEqual(["该邀请无法使用", "当前登录的邮箱是 zhao@trading.example。如果邀请发送至其他邮箱，请使用该邮箱登录。邀请也可能已过期或已撤销。"]);
    gone.button("使用个人账户").click();
    expect(vi.mocked(gone.ports.go).mock.calls).toEqual([["/"]]);
  });

  it("leaves a person with a computer and nothing waiting for the chat page, as before", async () => {
    const at = road(me({ box: "provisioned", invited: [] }));
    await at.settled();
    expect(vi.mocked(at.ports.go).mock.calls).toEqual([["/"]]);
  });

  it("draws the card in English", async () => {
    const at = road(me(), "accepted", "en");
    await at.settled();
    expect(card(at.root).slice(0, 2).concat(card(at.root).slice(-2))).toEqual(["You've been invited to the Example Trading organisation", "Invited by Wang Wei", "Accept invite", "Decline invite"]);
  });
});
