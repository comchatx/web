import type { AccountMoney, Backend, Me, MoneyLot, Spaces, Terms } from "./backend.js";
import { accountGroup, firstLetter, inUseName, switchable } from "./account-switch.js";
import { BillingView, type BillingBackend } from "./billing-page.js";
import { CreateOrg, orgPlan, SEATS } from "./create-org.js";
import { inviteStep } from "./invite-step.js";
import { fill, h, svg, type Child } from "./dom.js";
import { hideTipWithin, menu, ORDER, tip } from "./forms.js";
// cx is a classic script that sets one global; imported here so the bundle carries it (`cx.d.ts`).
import "./cx.js";
import type { DoorLanguage } from "./door-words.js";
import { Paying } from "./paying.js";
import { roadSay, type RoadSay } from "./road-words.js";
import { writer } from "./settings-words.js";
import { SITE_PAGES } from "./site-pages.js";
import { text } from "./strings.js";
import { WAIT_MS } from "./visit.js";
import type { PlatformBackend } from "./platform-backend.js";
import { LINE_MAX, SHOPS, WANTS, type SurveyAnswers } from "../shared/survey.js";
import { DOOR_PATH, type InvitationLink } from "../shared/door.js";

/**
 * The road from the sign-in card to the chat page, one person's (the signed prototype `spike/signup-flow`): 创建账户 with the terms, the
 * plans with the trial, the name, and two questions whose 开始使用, or 跳过, sets the computer up. Where a person stands on it is read each
 * time the page loads, never kept: a computer set up is the chat page; without one, terms not agreed to are the terms page, a member goes
 * on to the name, and anyone else meets the plans, then the name and the questions. Inside one page load the presses move the person on.
 */
export type RoadBackend = Pick<PlatformBackend, "me" | "accountMoney" | "acceptTerms" | "setName" | "startBox" | "leave" | "spaces" | "use" | "acceptInvitation" | "declineInvitation"> & BillingBackend & Pick<Backend, "returned" | "features" | "terms" | "invite" | "seatsPrice">;
export type RoadPorts = {
  readonly backend: RoadBackend;
  readonly language: DoorLanguage;
  /** This year, as the browser's calendar has it: a day in it is written without its year. */
  readonly year: number;
  /** Leaves the road for another address of this origin: the chat page, or the door. */
  readonly go: (path: string) => void;
  /** 跳过 on the plans after a trial: the chat page takes the road's place for its next load alone. */
  readonly skip: () => void;
  /** cx as the door draws it beside its name, a fresh copy each time. */
  readonly cx: () => Node;
  /** The tab's own store, where a payment asked for is kept across a way that leaves the page, as 账单 keeps it. */
  readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined;
  /** The payment session the provider sent the person back from, where the page was opened from one. */
  readonly checkout?: string;
  /** What the chat page's `/me` said of the invitation's link the person followed, handed on with the move, since that read let it go. */
  readonly link?: InvitationLink;
  /**
   * 账单's address on the chat page, where 调整方案 there opened the plans page: the page's way back, and where 订阅 takes a person with a
   * computer. Without it a person with a computer is on the chat page.
   */
  readonly billing?: string;
  /** The door's work sign-in, its code right: the page that names the organisation, under that sign-in. */
  readonly create?: true;
  /** An organisation just made, in its session: the step that invites, with the seats paid for and whether a work sign-in made it. */
  readonly created?: { readonly seats: number; readonly work: boolean };
};
type SignedIn = Extract<Me, { kind: "signed_in" }>;

const PRO_ICON = ["M6 25.5 16 21l10 4.5v10L16 40 6 35.5v-10Z", "M6 25.5 16 30l10-4.5M16 30v10", "M18 14.5 28 10l10 4.5v10L28 29l-10-4.5v-10Z", "M18 14.5 28 19l10-4.5M28 19v10", "M28 6V3", "M23.5 4.5 25 6M32.5 4.5 31 6"];
const icon = (d: string): SVGSVGElement => svg("svg", { viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false" }, svg("path", { d }));
const tick = (): SVGSVGElement => icon("M3.5 8.5l3 3 6-7");
// The door holds a sum with what it is a sum of (「$5.00 试用余额」) and lets the line break before it, and keeps a note's last words whole.
const HELD = /[  ](\$\d+\.\d\d[  ](?:试用余额|of trial balance))/;
const held = (said: string): readonly Child[] => { const cut = said.split(HELD); return cut.length === 3 ? [`${cut[0]!.replace(/⁠/g, "")} `, h("span", { class: "nowrap" }, cut[1]!), cut[2]!] : [said]; };
const tail = (said: string): readonly Child[] => { const cut = /^(.*?)(当期有效|valid for the period)$/.exec(said); return cut === null ? [said] : [cut[1]!, h("span", { class: "nowrap" }, cut[2]!)]; };

/**
 * Opens the road on `root`: reads where the person stands and draws that page, or leaves for the chat page or the door. A read that does
 * not come back is said in the road's card, and read again as the chat page reads again; the next answer draws the road's own step.
 */
export async function openRoad(root: HTMLElement, ports: RoadPorts): Promise<void> {
  const say = roadSay(ports.language);
  // The accounts wait on the identity SDK, which may load late or never: the road does not wait on them, and the plans page's head takes
  // them when they come.
  const spaces = ports.backend.spaces().catch(() => undefined);
  const terms = ports.backend.terms().catch(() => undefined);
  const [read, money] = await Promise.all([ports.backend.me().catch(() => undefined), ports.backend.accountMoney().catch(() => undefined)]);
  if (read === undefined) {
    waitCard(root, [h("p", { class: "road-say", role: "status" }, say("status.unreachable")), doing(say("status.reconnecting"))]);
    await later();
    return openRoad(root, ports);
  }
  if (read.kind === "signed_out") { ports.go(DOOR_PATH); return; }
  const me: SignedIn = ports.link !== undefined && read.invitationLink === undefined ? { ...read, invitationLink: ports.link } : read;
  // An invitation waiting on the person, or the link they followed, is answered on the road's card first: a person with a computer of
  // their own meets it on coming back from the door, and leaves for the chat page after.
  const invited = me.invited?.[0] !== undefined || me.invitationLink !== undefined;
  const paying = new Paying(ports.storage, () => undefined, () => me.account);
  const road = (): Road => new Road(root, ports, me, money, paying, spaces, terms);
  // The organisation just made greets its admin with the step that invites; the work sign-in the door made names its organisation.
  if (ports.created !== undefined && me.organization?.role === "admin") { road().draw("created"); return; }
  // Paid, and the switch into the organisation not yet read: the page waits and reads again, and never offers the plans to pay a second time.
  if (ports.created !== undefined) {
    waitCard(root, [h("p", { class: "road-say", role: "status" }, say("road.payChecking")), h("div", { class: "road-spin", "aria-hidden": "true" }, spinner())]);
    await later();
    return openRoad(root, ports);
  }
  if (ports.create === true && me.organization === undefined) { road().draw("create"); return; }
  if (me.box === "provisioned" && !invited && ports.billing === undefined) { ports.go("/"); return; }
  // 调整方案 in 账单 opens the plans past the road for a person with a computer; an invitation is answered first.
  if (me.box === "provisioned") { road().draw(invited ? "invited" : "plans"); return; }
  if (ports.checkout !== undefined) paying.cameBack(ports.checkout);
  // A payment comes back paid to the name, with what was paid at its head, and unpaid to the card it was asked from, which says so.
  // While its answer is read, and while it cannot be, the card says so and the plans are not drawn: a seller who paid is not asked again.
  if (me.terms === true && paying.holding) waitCard(root, [h("p", { class: "road-say", role: "status" }, say("road.payChecking")), h("div", { class: "road-spin", "aria-hidden": "true" }, spinner())]);
  let back = me.terms === true ? await paying.settle(ports.backend, money) : undefined;
  while (paying.unread && money?.state !== "member" && !paying.paid) {
    const once = say("road.payOnce");
    waitCard(root, [h("p", { class: "road-say", role: "status" }, say("road.payUnread")),
      h("p", { class: "road-more" }, ...(ports.language === "zh" ? once.split(/(?<=。)/).map((one) => h("span", { class: "road-whole" }, one)) : [once])),
      doing(say("status.reconnecting"))]);
    await later();
    back = await paying.settle(ports.backend, money);
  }
  road().draw(me.terms !== true ? "terms" : invited ? "invited" : money?.state === "member" || paying.paid ? "name" : back === "subscribe" ? "pay" : "fork");
}

const spinner = (): HTMLElement => h("span", { class: "cl-spinner", "aria-hidden": "true" });
const doing = (said: string): HTMLElement => h("p", { class: "road-doing" }, spinner(), h("span", {}, said));

/** The road's card alone, saying what the page waits on: nothing on it can be pressed. */
function waitCard(root: HTMLElement, inside: readonly Child[]): void {
  hideTipWithin(root);
  fill(root, h("div", { class: "road" },
    h("header", { class: "road-head" }, h("span", { class: "wordmark" }, "ComChatX")),
    h("main", { class: "road-main is-card", id: "main" },
      h("div", { class: "road-column door-column" }, h("div", { class: "cl-cardBox road-card road-waits" }, h("div", { class: "cl-card" }, ...inside))))));
}

/** The chat page's way of asking again: after its wait, whether or not anyone looks at the page. */
function later(): Promise<void> {
  return new Promise((done) => { setTimeout(done, WAIT_MS); });
}

type Step = "terms" | "invited" | "fork" | "pay" | "name" | "plans" | "create" | "created";

class Road {
  readonly #say: RoadSay;
  readonly #write: ReturnType<typeof writer>;
  readonly #billing: BillingView;
  #name = "";
  #busy = false;
  // What the questions hold while the person goes between their two pages.
  readonly #shops = new Set<string>();
  readonly #wants = new Set<string>();
  #line = "";
  // The cx the questions draw: the one a page replaces is ended by its own lifetime, frame and timer.
  #figure: ReturnType<typeof CxCharacter.mount> | undefined;
  #spaces: Spaces | undefined;
  #step: Step | undefined;
  /** The organization the person just joined, new to ComChatX: the name page leads to its chat page. */
  #joining: string | undefined;
  #termsRead: Terms | undefined;
  readonly #create: CreateOrg;
  constructor(readonly root: HTMLElement, readonly ports: RoadPorts, readonly me: SignedIn, readonly money: AccountMoney | undefined, readonly paying: Paying, spaces: Promise<Spaces | undefined>,
    terms: Promise<Terms | undefined>) {
    // A seat's price prints once `/terms` is read; the plans and the created card, drawn before it, are drawn again with it.
    void terms.then((read) => { this.#termsRead = read; if (read?.seat_price !== undefined && (this.#step === "fork" || this.#step === "plans" || this.#step === "created")) this.draw(this.#step); });
    void spaces.then((held) => {
      this.#spaces = switchable(held);
      const head = this.root.querySelector(".road-head");
      if (this.#step === "fork" && head !== null && this.#spaces !== undefined) fill(head, this.#switch());
    });
    this.#say = roadSay(ports.language);
    const say = (key: Parameters<typeof text>[1], values?: Readonly<Record<string, string | number>>): string => text(ports.language, key, values);
    this.#write = writer({ language: ports.language, say, money: me.money, year: ports.year });
    this.#billing = new BillingView({
      backend: ports.backend, say, paying, features: () => ports.backend.features, home: () => root, base: "#/settings",
      reads: () => ({ money, me, subscription: undefined, record: undefined, spending: undefined, models: undefined, states: () => undefined, terms: undefined }),
      reread: async () => undefined,
      // The form is drawn again after a choice: the choice made keeps the focus, as it does in 账单.
      redraw: (key) => { this.draw("pay"); if (key !== undefined) root.querySelector<HTMLElement>(`[data-key='${key}']`)?.focus(); },
      // The one address 订阅's card sends the window to is 账单, once a payment is made: on the road the name stands there.
      go: () => this.draw("name"),
    });
    const sayApp = (key: Parameters<typeof text>[1], values?: Readonly<Record<string, string | number>>): string => text(ports.language, key, values);
    this.#create = new CreateOrg({
      backend: ports.backend, say: this.#say, words: sayApp, write: this.#write, me, work: ports.create === true,
      price: () => this.#termsRead?.seat_price,
      page: (main, head) => this.#page(main, { head, back: true }),
      card: (main) => this.#page(main, { card: true }),
      cardBox: (...inside) => this.#cardBox(...inside),
      plans: () => this.draw(this.ports.billing === undefined ? "fork" : "plans"),
    });
  }

  draw(step: Step): void {
    this.#step = step;
    if (step === "terms") this.#page(this.#terms(), { card: true, foot: true });
    else if (step === "fork") this.#page(this.#fork(), { head: this.#switch() });
    else if (step === "pay") this.#page(this.#pay(), { card: true });
    else if (step === "invited") this.#invitedPage();
    else if (step === "plans") this.#page(this.#fork(this.ports.billing), { head: this.#back(this.ports.billing!) });
    else if (step === "create") this.#create.start();
    else if (step === "created") this.#created();
    else this.#page(this.#namePage(), {});
  }

  /**
   * The plans page's head for a person in an organisation, where the wordmark stands for anyone else: the account in use, whose own has
   * no computer yet, and the corner's group of accounts under it, so there is a way back; a press switches as the corner's does.
   */
  #switch(): Child {
    const spaces = this.#spaces;
    if (spaces === undefined) return undefined;
    const say = (key: "space.own" | "space.switch"): string => text(this.ports.language, key);
    const name = inUseName(spaces, say("space.own"));
    const who = this.me.name ?? this.me.email ?? "";
    const words = h("span", { class: "road-space-name" }, name);
    const button = tip(h("button", { type: "button", class: "road-space", "aria-label": `${say("space.switch")}${this.ports.language === "zh" ? "：" : ": "}${name}` },
      spaces.active !== null && h("span", { class: "f-account-mark", "aria-hidden": "true" }, firstLetter(name)), words,
      svg("svg", { class: "icon", viewBox: "0 0 24 24", "aria-hidden": "true" }, svg("path", { d: "M8 10l4-4 4 4" }), svg("path", { d: "M8 14l4 4 4-4" }))),
      () => (words.scrollWidth > words.clientWidth + 1 ? [name] : []));
    const list = h("div", { class: "f-menu", role: "menu", "aria-label": say("space.switch") },
      accountGroup({ spaces, own: say("space.own"), who, label: say("space.switch"), use: (id) => { void this.ports.backend.use(id).catch(() => undefined); } }));
    menu(button, list, { order: ORDER.below, end: "centre" });
    return h("div", { class: "road-switch" }, button, list);
  }

  /** The page around every step: the wordmark, the step, and under the terms the address verified with the way to another. */
  #page(main: readonly Child[], { card = false, foot = false, head, back = false }: { readonly card?: boolean; readonly foot?: boolean; readonly head?: Child | readonly Child[]; readonly back?: boolean }): void {
    const say = this.#say;
    const email = this.me.email;
    // A step drawn again takes the tip of the one it replaces with it.
    hideTipWithin(this.root);
    fill(this.root, h("div", { class: "road" },
      h("header", { class: `road-head${back ? " has-back" : ""}` }, ...(Array.isArray(head) ? head : [head ?? h("span", { class: "wordmark" }, "ComChatX")])),
      h("main", { class: `road-main${card ? " is-card" : ""}`, id: "main" }, ...main),
      foot && h("footer", { class: "road-foot" },
        email !== undefined && h("p", {}, ...this.#around("foot.verified", { email: h("b", {}, email) })),
        h("p", {}, h("button", { type: "button", class: "road-link", onclick: () => { void this.ports.backend.leave().catch(() => undefined); } }, say("foot.other"))))));
    // A new step takes the keyboard to its heading, where a screen reader starts reading it; a step that puts it in a control does so after.
    const heading = this.root.querySelector<HTMLElement>("main h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
  }

  /** A line with elements in it: the words around each `{name}` stay text. */
  #around(key: Parameters<RoadSay>[0], parts: Readonly<Record<string, Node>>): readonly Child[] {
    const marked = Object.fromEntries(Object.keys(parts).map((name) => [name, `{${name}}`]));
    return this.#say(key, marked).split(/(\{\w+\})/).map((piece) => {
      const one = /^\{(\w+)\}$/.exec(piece);
      return one !== null && parts[one[1]!] !== undefined ? parts[one[1]!]! : piece.replace(/^ | $/g, " ");
    });
  }

  #cardBox(...inside: readonly Child[]): HTMLElement {
    return h("div", { class: "road-column door-column" }, h("div", { class: "cl-cardBox road-card" }, h("div", { class: "cl-card" }, ...inside)));
  }

  /**
   * A press that waits on the platform: one at a time, its button off meanwhile; a refusal or no answer says so under it, and it may be
   * pressed again. Off is `aria-disabled`, not `disabled`, so the button pressed keeps the keyboard through the wait and after a failure.
   */
  async #pressing(buttons: readonly HTMLButtonElement[], bad: HTMLElement, act: () => Promise<boolean>, ring?: HTMLButtonElement): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    for (const button of buttons) button.setAttribute("aria-disabled", "true");
    // The press that was heard keeps its word's room under a ring until its requests end, and through the page it opens.
    // Its word, unseen under the ring, stays its name.
    if (ring !== undefined) { ring.classList.add("busy"); ring.setAttribute("aria-busy", "true"); ring.setAttribute("aria-label", ring.textContent ?? ""); ring.append(h("span", { class: "f-spin", "aria-hidden": "true" })); }
    const done = await act().catch(() => false);
    this.#busy = false;
    if (done) return;
    for (const button of buttons) button.removeAttribute("aria-disabled");
    if (ring !== undefined) { ring.classList.remove("busy"); ring.removeAttribute("aria-busy"); ring.removeAttribute("aria-label"); ring.querySelector(".f-spin")?.remove(); }
    bad.hidden = false;
  }

  #terms(): readonly Child[] {
    const say = this.#say;
    const language = this.ports.language;
    const missed = h("p", { class: "road-bad", id: "terms-bad", role: "alert", hidden: true }, say("terms.missed"));
    const failed = h("p", { class: "road-bad is-alone", role: "alert", hidden: true }, say("pl.toastNotDone"));
    // The box is named by its whole sentence: a screen reader leaves the links out of a label's words, and read 「我已阅读并同意和」.
    const agree = h("input", { type: "checkbox", class: "cl-formFieldCheckboxInput", id: "agree", "aria-label": say("terms.agree", { terms: say("legal.terms"), privacy: say("legal.privacy") }).replaceAll("\u2060", ""), onchange: () => { if (agree.checked) { missed.hidden = true; agree.removeAttribute("aria-invalid"); agree.removeAttribute("aria-describedby"); } } });
    const news = h("input", { type: "checkbox", class: "cl-formFieldCheckboxInput", id: "news" });
    const outside = (which: "terms" | "privacy"): HTMLElement =>
      h("a", { href: SITE_PAGES[language][which], target: "_blank", rel: "noopener" }, say(`legal.${which}`), h("span", { class: "door-unseen" }, say("legal.newTab")));
    const go: HTMLButtonElement = h("button", { type: "button", class: "cl-formButtonPrimary", onclick: () => {
      if (!agree.checked) {
        missed.hidden = false;
        agree.setAttribute("aria-invalid", "true");
        agree.setAttribute("aria-describedby", "terms-bad");
        agree.focus();
        return;
      }
      failed.hidden = true;
      void this.#pressing([go], failed, async () => {
        await this.ports.backend.acceptTerms(news.checked);
        this.draw(this.me.invited?.[0] !== undefined || this.me.invitationLink !== undefined ? "invited" : this.money?.state === "member" ? "name" : "fork");
        return true;
      });
    } }, say("terms.go"));
    return [
      h("h1", { class: "section-title road-title" }, say("terms.title")),
      h("p", { class: "road-sub" }, say("terms.sub")),
      this.#cardBox(
        h("div", { class: "road-ticks" },
          h("div", { class: "road-tick f-pick" }, agree, h("label", { class: "cl-formFieldCheckboxLabel", for: "agree" }, ...this.#around("terms.agree", { terms: outside("terms"), privacy: outside("privacy") })), missed),
          h("div", { class: "road-tick f-pick" }, news, h("label", { class: "cl-formFieldCheckboxLabel", for: "news" }, say("terms.news")))),
        go, failed),
    ];
  }

  /**
   * The organization's invitation (the road signed on 2026-11-13, its two presses Claude's): who invites the person and to what, what the
   * organization's computer holds, 接受邀请 and 拒绝邀请. A link that waits on another address, or is gone, says so, with the way on as a
   * person alone; an organization full by then says so where its press stood.
   */
  #invitedPage(state?: "full" | "gone"): void {
    const say = this.#say, me = this.me;
    const invitation = me.invited?.[0];
    const link = state ?? (me.invitationLink === undefined && invitation !== undefined ? undefined : me.invitationLink ?? "gone");
    const own = (): void => { if (me.box === "provisioned") this.ports.go("/"); else this.draw(this.money?.state === "member" ? "name" : "fork"); };
    const failed = h("p", { class: "road-bad is-alone", role: "alert", hidden: true }, say("pl.toastNotDone"));
    const primary = (words: string, act: () => void): HTMLButtonElement => h("button", { type: "button", class: "cl-formButtonPrimary", onclick: act }, words);
    const header = (key: "invite.gone"): HTMLElement => h("div", { class: "cl-header" }, h("h1", { class: "cl-headerTitle" }, say(key)));
    if (link === "elsewhere") {
      this.#page([this.#cardBox(header("invite.gone"), h("p", { class: "road-words" }, say("invite.otherWhat", { me: me.email ?? "" })),
        h("div", { class: "road-acts" }, primary(say("foot.other"), () => { void this.ports.backend.leave().catch(() => undefined); }),
          h("button", { type: "button", class: "road-second", onclick: own }, say("invite.own"))))], { card: true });
      return;
    }
    if (link === "gone" || invitation === undefined) {
      this.#page([this.#cardBox(header("invite.gone"), h("p", { class: "road-words" }, say("invite.goneWhat", { me: me.email ?? "" })), primary(say("invite.own"), own))], { card: true, foot: true });
      return;
    }
    const org = invitation.organization.name;
    const top = h("div", { class: "road-org" }, h("span", { class: "road-org-mark", "aria-hidden": "true" }, [...org][0] ?? ""),
      h("div", {}, h("h1", { class: "cl-headerTitle" }, say("invite.title", { org })), invitation.inviter !== undefined && h("p", { class: "road-by" }, say("invite.by", { who: invitation.inviter }))));
    if (state === "full") {
      this.#page([this.#cardBox(top, h("p", { class: "road-words" }, say("invite.full", { org, inviter: invitation.inviter ?? "" })),
        h("button", { type: "button", class: "road-second", onclick: own }, say("invite.own")))], { card: true, foot: true });
      return;
    }
    const go: HTMLButtonElement = primary(say("invite.go"), () => {
      failed.hidden = true;
      void this.#pressing([go, no], failed, async () => {
        const answer = await this.ports.backend.acceptInvitation(invitation.id);
        if (answer !== "accepted") { this.#invitedPage(answer); return true; }
        // One who has an account of their own goes straight to the organization's chat page; one new to ComChatX is named first.
        if (me.box === "provisioned") { await this.ports.backend.use(invitation.organization.id); return true; }
        this.#joining = invitation.organization.id;
        this.draw("name");
        return true;
      });
    });
    const no: HTMLButtonElement = h("button", { type: "button", class: "road-link", onclick: () => {
      failed.hidden = true;
      void this.#pressing([go, no], failed, async () => { await this.ports.backend.declineInvitation(invitation.id); own(); return true; });
    } }, say("invite.no"));
    this.#page([this.#cardBox(top, h("p", { class: "road-words" }, say("invite.shared")), h("div", { class: "road-acts" }, go, no), failed)], { card: true, foot: true });
  }

  /**
   * The step after an organisation is made, in its session (the signed creation pages, with the members sheet's step in the place they left
   * for it): the sum paid, said once; 添加成员's step in the card, the admin holding one of the seats; 跳过 to the organisation's chat page;
   * and where the person's own account is.
   */
  #created(): void {
    const say = this.#say, made = this.ports.created!, name = this.me.organization?.name ?? "";
    const price = this.#termsRead?.seat_price;
    const host = h("div", { class: "road-invite" });
    const skip = h("button", { type: "button", class: "road-link", "data-key": "skip", onclick: () => this.ports.go("/") }, say("fork.notNow"));
    this.#page([this.#cardBox(
      price !== undefined && h("p", { class: "road-paid", role: "status" }, say("pay.org.paid", { amount: this.#write.money(made.seats * price) })),
      h("div", { class: "road-org" }, h("span", { class: "road-org-mark", "aria-hidden": "true" }, [...name][0] ?? ""), h("h1", { class: "cl-headerTitle" }, say("created.title", { org: name }))),
      h("p", { class: "road-words" }, say("created.later")),
      host,
      h("p", { class: "road-fine" }, made.work ? say("created.ownElsewhere") : say("created.ownStays", { org: name })))], { card: true });
    const words = (key: Parameters<typeof text>[1], values?: Readonly<Record<string, string | number>>): string => text(this.ports.language, key, values);
    inviteStep({
      backend: this.ports.backend, say: words, w: this.#write, home: this.root, opener: skip,
      held: made.seats, left: made.seats - 1, most: SEATS.most, known: this.me.email === undefined ? [] : [this.me.email], price, lastDay: undefined,
      toCard: () => this.ports.go("/#/organization/billing"), sent: () => this.ports.go("/"),
    }, { host, skip });
  }

  /** The plans page's head as 账单 opens it: the way back to 账单 at its left edge, in the words 账单's own pages use, and the wordmark. */
  #back(billing: string): readonly Child[] {
    return [h("a", { class: "road-link plan-back", "data-key": "back", href: billing }, `← ${text(this.ports.language, "sw.sec.billing")}`), h("span", { class: "wordmark" }, "ComChatX")];
  }

  /** The account's own sign-up lot, where one still runs: what it holds, its last day, and who invited the person. */
  #lot(): MoneyLot | undefined { return this.money?.lots.find((lot) => lot.kind === "sign_up"); }

  /**
   * The plans. Opened from 账单 (`billing`), the page is past the road: no trial strip, no 跳过, and Pro's press is the person's own —
   * 当前方案, off, for one who holds Pro; 恢复订阅 for one whose Pro ended; else 订阅 — whose 订阅 is 账单's.
   */
  #fork(billing?: string): readonly Child[] {
    const say = this.#say;
    const lot = this.#lot();
    const ended = billing === undefined && this.money !== undefined && this.money.state !== "trial";
    const sw = (key: "plan.current" | "sw.resume"): string => text(this.ports.language, key);
    const holds = this.money?.state === "member", lapsed = this.money?.state === "free" && this.money.free?.why === "membership_ended";
    const go = billing === undefined ? h("button", { type: "button", class: "btn btn-primary btn-block", onclick: () => this.draw("pay") }, say("plan.pro.go"))
      : holds ? h("button", { type: "button", class: "btn btn-block", "aria-disabled": "true" }, sw("plan.current"))
      : h("button", { type: "button", class: "btn btn-primary btn-block", onclick: () => this.ports.go(`${billing}/subscribe`) }, lapsed ? sw("sw.resume") : say("plan.pro.go"));
    // 组织 stands beside Pro where the page takes payments, as Pro's own 订阅 and 账单's 充值 do: without it nothing can make one.
    const org = this.ports.backend.features.checkout && orgPlan(say, this.#write, this.#termsRead?.seat_price, () => this.#create.start());
    const by = lot?.invited?.by;
    const list = (...keys: readonly Parameters<RoadSay>[0][]): HTMLElement => h("ul", { class: "plan-list", role: "list" }, ...keys.map((key) => h("li", {}, tick(), h("span", {}, ...held(say(key))))));
    const pro = h("article", { class: "plan", "aria-labelledby": "plan-pro" },
      svg("svg", { class: "plan-icon", viewBox: "0 0 44 44", "aria-hidden": "true", focusable: "false" },
        svg("g", { fill: "none", stroke: "currentColor", "stroke-width": "1.25", "stroke-linejoin": "round", "stroke-linecap": "round" }, ...PRO_ICON.map((d) => svg("path", { d })))),
      h("h3", { class: "plan-name", id: "plan-pro" }, "Pro"),
      h("p", { class: "plan-price" }, "$10.00"),
      h("p", { class: "plan-note" }, ...tail(say("plan.pro.note"))),
      go,
      h("p", { class: "plan-fine" }, say("plan.pro.fine")),
      h("hr", { class: "plan-rule" }),
      h("div", {}, list("plan.l.sources", "plan.l.models", "plan.l.safe", "plan.l.plugins", "plan.l.topUp", "plan.l.invite"), h("p", { class: "plan-lead" }, say("plan.any")), list("plan.l.store", "plan.l.own")));
    return [
      h("h1", { class: "section-title road-title" }, say("fork.title")),
      ended && h("p", { class: "road-sub" }, say("fork.ended")),
      h("div", { class: "road-plans" },
        !ended && billing === undefined && h("div", { class: "trial" },
          h("p", { class: "trial-words" },
            lot !== undefined && say("fork.line", { amount: this.#write.money(lot.remainder), day: this.#write.dayName(lot.ends_on) }),
            by !== undefined && h("br"), by !== undefined && h("span", { class: "road-by" }, say("note.invited", { who: by }))),
          h("button", { type: "button", class: "btn btn-primary", onclick: () => this.draw("name") }, say("fork.trial.go"))),
        h("div", { class: org === false ? "plans is-one" : "plans" }, pro, org)),
      ended && h("p", { class: "road-skip" }, h("button", { type: "button", class: "road-link", onclick: () => { this.ports.skip(); this.ports.go("/"); } }, say("fork.notNow"))),
    ];
  }

  /** 订阅 as a card on the road: Pro and its price, then the 订阅 pane's own form, whose 支付 goes on to the name; 返回 is the plans. */
  #pay(): readonly Child[] {
    const say = this.#say;
    const sw = (key: Parameters<typeof text>[1]): string => text(this.ports.language, key);
    const money = this.money;
    return [this.#cardBox(
      h("h1", { class: "cl-headerTitle road-pay-title" }, sw("sw.subscribe")),
      h("div", { class: "road-order" },
        h("p", { class: "road-order-line" }, h("b", {}, "Pro"), money?.renewal.price !== undefined && h("span", { class: "road-order-sum" }, `${this.#write.money(money.renewal.price)} `, h("small", {}, sw("sw.planEach")))),
        h("p", { class: "road-words" }, ...tail(say("plan.pro.note")))),
      // Unread, the account's money gives the form nothing to ask: the card says so, and 返回 still stands.
      h("div", { class: "road-pay" }, ...(money === undefined ? [h("p", { class: "sw-card-bad" }, sw("sw.unread"))] : this.#billing.planCard(this.#write, (on) => this.#holding(on)))),
      h("p", { class: "road-back" }, h("button", { type: "button", class: "road-link", onclick: () => { this.paying.clearUnpaid(); this.#billing.forget(); this.draw("fork"); } }, say("back"))))];
  }

  // While a payment confirms, a choice or 返回 would draw a new form that could be paid as well: they wait for its answer.
  #holding(on: boolean): void {
    for (const one of this.root.querySelectorAll<HTMLInputElement | HTMLButtonElement>(".road-pay .f-seg > button, .road-back button")) one.disabled = on;
  }

  #cx(): HTMLElement { return h("div", { class: "road-cx-holder" }, this.ports.cx()); }

  #namePage(): readonly Child[] {
    const say = this.#say;
    const field = h("input", { type: "text", id: "call", autocomplete: "nickname", maxlength: "64", "aria-labelledby": "name-ask" });
    const press: HTMLButtonElement = tip(h("button", { type: "submit", class: "road-go is-icon", "aria-label": say("name.go"), disabled: true }, icon("M8 13V3M3.5 7.5 8 3l4.5 4.5")), say("name.go"));
    const failed = h("p", { class: "road-bad is-alone", role: "alert", hidden: true }, say("pl.toastNotDone"));
    field.addEventListener("input", () => { press.disabled = field.value.trim() === ""; });
    const form = h("form", { class: "road-name", onsubmit: (event) => {
      event.preventDefault();
      const name = field.value.trim();
      if (name === "") return;
      failed.hidden = true;
      void this.#pressing([press], failed, async () => {
        await this.ports.backend.setName(name);
        this.#name = name;
        // Named after joining, the person goes to the organization's chat page: its computer is the organization's.
        if (this.#joining !== undefined) { await this.ports.backend.use(this.#joining); return true; }
        this.#page(this.#ask(false), {});
        return true;
      });
    } }, field, press);
    queueMicrotask(() => field.focus());
    const paid = this.paying.lead(this.#write, (key, values) => text(this.ports.language, key, values));
    for (const line of paid) line.classList.add("road-paid");
    return [h("div", { class: "road-ask" }, ...paid, this.#cx(), h("h1", { class: "road-question", id: "name-ask" }, say("name.ask")), form, failed)];
  }


  /**
   * cx itself, not the door's still drawing, cut to the door's frame and size so nothing around it moves: it waves once on the first
   * question, stands when the person comes back to it, and studies on the second. With reduced motion each is its still frame.
   */
  #liveCx(state: "greeting" | "ready" | "analysing"): HTMLElement {
    const holder = h("div", { class: "road-cx-holder" });
    this.#figure?.destroy();
    this.#figure = CxCharacter.mount(holder, { size: 67.2, state });
    const drawing = this.#figure.element;
    drawing.setAttribute("viewBox", "-78 -40 156 81");
    drawing.setAttribute("focusable", "false");
    drawing.classList.add("road-cx");
    drawing.style.display = "";
    return holder;
  }

  /**
   * The two questions, one a page: who the person is, then what cx should help with and a line of their own. 继续 carries the first on,
   * 返回 brings it back as it was left; 开始使用 sends what is answered and 跳过 sends nothing, and either sets the computer up.
   */
  #ask(second: boolean, back = false): readonly Child[] {
    const say = this.#say;
    const zh = this.ports.language === "zh";
    // Enter on an option chooses it, as Space does: left to the form, it would be the page's press, made with the answers half given.
    const tickOn = (event: Event): void => {
      if ((event as KeyboardEvent).key !== "Enter") return;
      event.preventDefault();
      const box = event.target as HTMLInputElement;
      box.checked = !box.checked;
      box.dispatchEvent(new Event("change", { bubbles: true }));
    };
    // An option is a block with nothing drawn before its words; its tick box is kept, not drawn, for the keyboard and a screen reader.
    const block = (key: string, words: string, held: Set<string>): HTMLElement => {
      const box = h("input", { type: "checkbox", class: "door-unseen", value: key, checked: held.has(key), onkeydown: tickOn,
        onchange: () => { if (box.checked) held.add(key); else held.delete(key); } });
      return h("label", { class: "f-block" }, box, h("span", {}, words));
    };
    // A space stands before 「可多选」, but not after a full-width mark, which holds its own room.
    const many = (question: string): readonly Child[] => [zh && /[？。！]$/.test(question) ? "" : " ", h("span", { class: "road-many" }, say("ask.many"))];
    const group = (id: string, heading: HTMLElement, blocks: readonly HTMLElement[]): HTMLElement =>
      h("fieldset", { class: "road-group", "aria-labelledby": id }, heading, h("div", { class: "road-chips" }, ...blocks));
    const failed = h("p", { class: "road-bad is-alone", role: "alert", hidden: true }, say("pl.toastNotDone"));
    const start = (answers: SurveyAnswers | undefined, pressed?: HTMLButtonElement): void => {
      failed.hidden = true;
      void this.#pressing([go, quiet], failed, async () => {
        const done = await this.ports.backend.startBox(answers);
        if (done) this.ports.go("/");
        return done;
      }, pressed);
    };
    const busy = (): boolean => go.getAttribute("aria-disabled") === "true";
    const line = h("input", { type: "text", id: "ask-line", maxlength: String(LINE_MAX), autocomplete: "off", value: this.#line, oninput: () => { this.#line = line.value; } });
    const go: HTMLButtonElement = h("button", { type: "submit", class: "road-go" }, h("span", { class: "f-word" }, say(second ? "pick.go" : "name.go")));
    const quiet: HTMLButtonElement = h("button", { type: "button", class: "road-link", onclick: () => {
      if (busy()) return;
      if (second) this.#page(this.#ask(false, true), {});
      else start(undefined);
    } }, say(second ? "back" : "fork.notNow"));
    const form = h("form", { class: "road-asks", onsubmit: (event) => {
      event.preventDefault();
      if (busy()) return;
      if (!second) { this.#page(this.#ask(true), {}); return; }
      const said = this.#line.trim();
      const answers: SurveyAnswers = { shops: SHOPS.filter((one) => this.#shops.has(one)), wants: WANTS.filter((one) => this.#wants.has(one)), ...(said === "" ? {} : { line: said }) };
      start(answers.shops.length + answers.wants.length > 0 || said !== "" ? answers : undefined, go);
    } },
      !second && h("div", { class: "road-first" },
        h("p", { class: "road-question", id: "ask-hello" }, say("ask.hello", { name: this.#name })),
        group("ask-shops", h("h1", { class: "road-question", id: "ask-shops", "aria-describedby": "ask-hello" }, say("ask.shops"), ...many(say("ask.shops"))),
          SHOPS.map((one) => block(one, say(`ask.shop.${one}`), this.#shops)))),
      second && group("ask-next", h("h1", { class: "road-question", id: "ask-next" }, say("ask.next.ask"), ...many(say("ask.next.ask"))),
        WANTS.map((one) => block(one, say(`ask.next.${one}`), this.#wants))),
      second && h("div", { class: "road-line" }, h("label", { class: "cl-formFieldLabel", for: "ask-line" }, say("ask.line")), line),
      failed,
      h("div", { class: "road-ask-acts" }, go, quiet));
    return [h("div", { class: "road-ask" }, this.#liveCx(second ? "analysing" : back ? "ready" : "greeting"), form)];
  }
}
