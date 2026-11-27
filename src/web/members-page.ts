import { dots } from "./account-pages.js";
import type { Backend, Member, MemberRole, Members, Organization, WaitingInvitation } from "./backend.js";
import { h, svg, type Child } from "./dom.js";
import { choice, giveBack, menu, menuRow, searchBox, select, tip, toast } from "./forms.js";
import { inviteStep } from "./invite-step.js";
import { confirmStep } from "./pay-step.js";
import { localDay, type Writer } from "./settings-words.js";
import type { Say } from "./stream-view.js";
import { Waits } from "./waiting.js";

/** What 成员 asks of the platform. */
export type MembersBackend = Pick<Backend, "members" | "membersFile" | "invite" | "resendInvitation" | "revokeInvitation" | "seatsPrice">;
export type MembersPorts = {
  readonly backend: MembersBackend; readonly say: Say;
  /** The organization as this opening's read of `/me` holds it: the asker's role and the seats. */
  readonly organization: () => Organization | undefined;
  /** A seat's monthly price and the period's last day, for the seats bought in 添加成员; unread, the lines that print them are left out. */
  readonly price: () => number | undefined; readonly lastDay: () => string | undefined;
  /** Draws the pane again, the keyboard back on the control `key` names. */
  readonly redraw: (key?: string) => void;
  /** Reads `/me` again, so the seats bought are the ones held. */
  readonly reread: () => Promise<void>;
  /** 更新银行卡, beside a declined card: 账单, where the card is. */
  readonly toCard: () => void;
  /** Where a step or a line over the window is put. */
  readonly home: () => HTMLElement;
  readonly history: () => History;
};

/** Rows a page of the list holds; the foot pages past them. */
const PAGE = 20;
const ROLES = ["all", "admin", "member"] as const;
type Tab = "members" | "pending";

/**
 * 组织设置's 成员, as the members sheet draws it after Claude's members page: 导出 CSV and 添加成员 at its head; the tabs 已加入
 * and 待接受, the role's filter and the search, which narrow the tab in view; the members' table, each name over its address, and the
 * invitations waiting, each with its address, role, sender and lapsing day, and its ⋮ always in sight; a foot that pages by twenty.
 */
export class MembersPage {
  #read: Members | undefined;
  #tab: Tab = "members";
  #filter: (typeof ROLES)[number] = "all";
  #search = "";
  #page = 1;
  /** What 添加成员 did, said at the page's head once: how many were sent. */
  #lead: { readonly sent?: number } | undefined;
  /** The rows and the foot, drawn again alone as the search, the filter or the page changes, so the search keeps the words being typed. */
  readonly #panel = h("div", { class: "iv-panel", id: "iv-panel", role: "tabpanel" });
  readonly #input = h("input", { type: "search", class: "iv-search-words", "data-key": "search", autocomplete: "off", spellcheck: "false" });
  readonly #told = toast();
  readonly #waits = new Waits(() => this.ports.home());
  #w: Writer | undefined;
  constructor(readonly ports: MembersPorts) {
    this.#input.addEventListener("input", () => { this.#search = this.#input.value; this.#page = 1; this.#drawPanel(); });
  }

  /** An opening meets 成员 on 已加入, nothing narrowed and nothing said. */
  begin(): void {
    this.#read = undefined;
    this.#tab = "members";
    this.#filter = "all";
    this.#search = "";
    this.#page = 1;
    this.#lead = undefined;
  }
  /** The members and invitations, read for this opening; unread, the page says so. */
  async read(): Promise<void> {
    this.#read = await this.ports.backend.members().catch(() => undefined);
  }

  /** Seats not held by a member or an invitation waiting, as the provider's bound counts them. */
  get #left(): number {
    const held = this.ports.organization()?.seats?.thisPeriod ?? 0, read = this.#read;
    return Math.max(0, held - (read === undefined ? this.ports.organization()?.seats?.inUse ?? held : read.members.length + read.invitations.length));
  }

  draw(w: Writer): readonly Child[] {
    const say = this.ports.say;
    this.#w = w;
    const seats = this.ports.organization()?.seats;
    // 组织设置 is its admin's. 添加成员 needs a seat bought before: an organization with none buys them on 组织.
    const inviting = seats?.state !== undefined && seats.state !== "none" && this.#read !== undefined;
    const lead = this.#lead;
    if (!this.#told.element.isConnected) this.ports.home().append(this.#told.element);
    const head = h("div", { class: "sw-head" }, h("h3", { id: "sw-g-members" }, say("osw.sec.members")),
      inviting && h("div", { class: "iv-head-acts" },
        h("a", { class: "f-btn sw-btn", "data-key": "export", href: this.ports.backend.membersFile(), download: "members.csv" }, say("inv.export")),
        h("button", { type: "button", class: "f-btn primary sw-btn", "data-key": "invite", onclick: () => this.#invite() }, say("members.invite"))));
    if (this.#read === undefined) return [h("section", { class: "sw-group", "aria-labelledby": "sw-g-members" }, head, h("p", { class: "f-empty", role: "status" }, say("sw.unread")))];
    return [
      lead !== undefined && h("div", { class: "sw-leads" },
        lead.sent !== undefined && h("p", { class: "sw-lead answer", role: "status" }, lead.sent === 1 ? say("inv.sent1") : say("inv.sent", { n: String(lead.sent) }))),
      h("section", { class: "sw-group", "aria-labelledby": "sw-g-members" }, head, this.#bar(), this.#panel),
    ].filter((one): one is HTMLElement => one instanceof HTMLElement);
  }

  /** Over the list, as Claude's: the tabs at the start, the role's filter and the search at the end. */
  #bar(): HTMLElement {
    const say = this.ports.say;
    const tabs = choice({ label: say("osw.sec.members"), role: "tablist", held: this.#tab === "pending" ? 1 : 0,
      values: [{ name: say("inv.tab.members"), key: "tab:members" }, { name: say("inv.tab.pending"), key: "tab:pending" }],
      take: (index) => { this.#tab = index === 1 ? "pending" : "members"; this.#page = 1; this.#drawPanel(); } });
    for (const cell of tabs.element.querySelectorAll("[role=tab]")) cell.setAttribute("aria-controls", "iv-panel");
    const filter = select({ label: say("inv.role"), held: ROLES.indexOf(this.#filter),
      values: ROLES.map((one) => (one === "all" ? say("pl.filter.all") : say(`inv.role.${one}`))),
      take: (index) => { this.#filter = ROLES[index] ?? "all"; this.#page = 1; this.#drawPanel(); } });
    filter.button.dataset["key"] = "filter";
    this.#input.placeholder = say("pl.search");
    this.#input.setAttribute("aria-label", say("pl.search"));
    this.#input.value = this.#search;
    this.#drawPanel();
    return h("div", { class: "iv-bar" }, tabs.element, h("div", { class: "iv-tools" }, filter.button, h("div", { class: "iv-search" }, searchBox(this.#input))));
  }

  #rows(): readonly (Member | WaitingInvitation)[] {
    const read = this.#read;
    if (read === undefined) return [];
    const sought = this.#search.trim().toLowerCase();
    const all: readonly (Member | WaitingInvitation)[] = this.#tab === "pending" ? read.invitations : read.members;
    return all.filter((one) => (this.#filter === "all" || one.role === this.#filter)
      && (sought === "" || [("name" in one ? one.name : undefined), one.email].some((word) => word?.toLowerCase().includes(sought) === true)));
  }
  /** Why the tab in view shows nothing: Claude's five lines. */
  #nothing(): string {
    const say = this.ports.say, sought = this.#search.trim(), pending = this.#tab === "pending";
    if (sought !== "") return say(pending ? "inv.noPendingMatch" : "inv.noMatch", { search: sought });
    if (this.#filter !== "all") return say(pending ? "inv.noPendingFilter" : "inv.noFilter");
    return say("inv.noPending");
  }

  #drawPanel(focus?: string): void {
    const say = this.ports.say, w = this.#w;
    if (w === undefined) return;
    const rows = this.#rows(), pages = Math.max(1, Math.ceil(rows.length / PAGE));
    this.#page = Math.min(this.#page, pages);
    const first = (this.#page - 1) * PAGE, shown = rows.slice(first, first + PAGE);
    const pending = this.#tab === "pending";
    this.#panel.setAttribute("aria-label", say(pending ? "inv.tab.pending" : "inv.tab.members"));
    const heads: readonly (readonly [string, string])[] = pending
      ? [[say("inv.email"), "iv-who"], [say("inv.role"), "iv-role iv-fold"], [say("inv.col.by"), "iv-by iv-fold"], [say("inv.col.expires"), "iv-until iv-fold"]]
      : [[say("inv.col.name"), "iv-who"], [say("inv.role"), "iv-role"]];
    const body = shown.length > 0 ? shown.map((one) => ("id" in one ? this.#waitingRow(one, w) : this.#memberRow(one)))
      : [h("tr", {}, h("td", { class: "iv-nothing", colspan: String(pending ? 5 : 2) }, h("p", { class: "f-empty", role: "status" }, this.#nothing())))];
    this.#panel.replaceChildren(
      h("table", { class: `pl-table iv-table${pending ? " iv-pending" : ""}` },
        h("thead", {}, h("tr", {}, ...heads.map(([words, cls]) => h("th", { scope: "col", class: cls }, words)), pending && h("td", { class: "iv-act" }))),
        h("tbody", {}, ...body)),
      ...(rows.length > 0 ? [this.#foot(first, shown.length, rows.length, pages)] : []));
    if (focus !== undefined) {
      const usable = (key: string | undefined): HTMLElement | undefined => {
        const to = key === undefined ? undefined : this.ports.home().querySelector<HTMLButtonElement>(`[data-key='${CSS.escape(key)}']`);
        return to !== null && to !== undefined && !to.disabled ? to : undefined;
      };
      (usable(focus) ?? usable(focus === "prev" ? "next" : focus === "next" ? "prev" : undefined) ?? usable(`tab:${this.#tab}`))?.focus();
    }
  }

  #memberRow(one: Member): HTMLElement {
    return h("tr", {}, h("td", { class: "iv-who" }, h("p", {}, one.name ?? one.email ?? ""), one.name !== undefined && h("p", { class: "quiet" }, one.email ?? "")),
      h("td", { class: "iv-role" }, this.ports.say(`inv.role.${one.role}`)));
  }
  /** Where the window is too narrow for the columns, a waiting row says its role and its day on a second line, as Claude's own do. */
  #waitingRow(one: WaitingInvitation, w: Writer): HTMLElement {
    const say = this.ports.say, role = say(`inv.role.${one.role}`), day = w.dayName(localDay(one.expires));
    return h("tr", {},
      h("td", { class: "iv-who" }, h("p", {}, one.email), h("p", { class: "quiet iv-sub" }, say("inv.sub", { role, day }))),
      h("td", { class: "iv-role iv-fold" }, role), h("td", { class: "iv-by iv-fold" }, one.inviter ?? ""), h("td", { class: "iv-until iv-fold" }, day),
      h("td", { class: "iv-act" }, this.#more(one)));
  }
  #foot(first: number, count: number, total: number, pages: number): HTMLElement {
    const say = this.ports.say;
    const turn = (by: number): void => { this.#page = Math.min(pages, Math.max(1, this.#page + by)); this.#drawPanel(by < 0 ? "prev" : "next"); };
    const arrow = (d: string): SVGElement => svg("svg", { class: "icon", viewBox: "0 0 16 16", "aria-hidden": "true" }, svg("path", { d }));
    const step = (key: "prev" | "next", d: string, by: number, off: boolean): HTMLElement =>
      tip(h("button", { type: "button", class: "f-icon", "data-key": key, "aria-label": say(`inv.${key}`), disabled: off, onclick: () => turn(by) }, arrow(d)), say(`inv.${key}`));
    return h("div", { class: "iv-foot" },
      h("p", { class: "f-line" }, say("inv.showing", { start: String(first + 1), end: String(first + count), total: String(total) })),
      h("div", { class: "iv-pager" }, step("prev", "M10 4l-4 4 4 4", -1, this.#page <= 1), h("span", { class: "iv-at" }, say("inv.page", { page: String(this.#page), total: String(pages) })),
        step("next", "M6 4l4 4-4 4", 1, this.#page >= pages)));
  }

  /** A waiting row's ⋮, always in sight: 重新发送邀请, 复制邀请链接 where the provider gave its link, and 撤销邀请 after Claude's question. */
  #more(one: WaitingInvitation): HTMLElement {
    const say = this.ports.say, key = `more:${one.email}`, actions = say("inv.actions", { email: one.email });
    const button = this.#waits.ring(key, tip(h("button", { type: "button", class: "f-icon sw-more", "data-key": key, "aria-label": actions }, dots()), actions, { at: "above", end: true }));
    if (this.#waits.has(key)) return button;
    const url = one.url;
    const list = h("div", { class: "f-menu", role: "menu", "aria-label": actions },
      menuRow(say("inv.resend"), () => { opened.close(false); this.#resend(one); }),
      url !== undefined && menuRow(say("inv.copy"), () => { opened.close(true); this.#copy(url); }),
      menuRow(say("inv.revoke"), () => { opened.close(false); this.#askRevoke(one); }));
    const opened = menu(button, list, { end: true });
    return button;
  }
  #control(key: string): HTMLElement | undefined {
    return [...this.ports.home().querySelectorAll<HTMLElement>("[data-key]")].find((one) => one.dataset["key"] === key);
  }
  #tell(words: string, asks = false): void { this.#told.tell(words, asks); }

  #resend(one: WaitingInvitation): void {
    const key = `more:${one.email}`;
    let failed = false;
    void this.#waits.run(key, async () => {
      // Not sent again, the row is left as it stands and the failure is said: the next read shows what the provider holds.
      try { if (await this.ports.backend.resendInvitation(one.id)) await this.read(); else failed = true; } catch { failed = true; }
    }, this.#control(key)).then(() => {
      this.#drawPanel();
      const back = this.#control(key);
      if (back !== undefined && (document.activeElement === document.body || document.activeElement === null)) giveBack(back);
      this.#tell(this.ports.say(failed ? "inv.resendFailed" : "inv.resent"), failed);
    });
  }
  /** The email's link, for the admin to send it another way; it opens only for the address invited. A copy that fails says nothing. */
  #copy(url: string): void {
    void navigator.clipboard?.writeText(url).then(() => { this.#tell(this.ports.say("inv.copied")); }, () => undefined);
  }
  #askRevoke(one: WaitingInvitation): void {
    const say = this.ports.say, key = `more:${one.email}`;
    confirmStep(this.ports.home(), say, {
      ask: say("inv.revokeAsk"), what: [say("inv.revokeWhat", { email: one.email })], yes: say("inv.revoke"), history: this.ports.history(),
      back: () => { const to = this.#control(key); if (to !== undefined) giveBack(to); },
      then: () => { const to = this.#control(key); if (to !== undefined) giveBack(to); this.#revoke(one); },
    });
  }
  #revoke(one: WaitingInvitation): void {
    const key = `more:${one.email}`, at = this.#read?.invitations.indexOf(one) ?? -1;
    let failed = false;
    void this.#waits.run(key, async () => {
      try { await this.ports.backend.revokeInvitation(one.id); await this.read(); } catch { failed = true; }
    }, this.#control(key)).then(async () => {
      if (failed) { this.#drawPanel(key); this.#tell(this.ports.say("sw.moveFailed"), true); return; }
      await this.ports.reread();
      // The row is gone: the keyboard goes on to the next waiting row's ⋮, else the one before it, else the tab that holds the list.
      const left = this.#read?.invitations ?? [];
      const next = left[at] ?? left[at - 1];
      this.ports.redraw(next === undefined ? `tab:${this.#tab}` : `more:${next.email}`);
      this.#tell(this.ports.say("inv.revoked", { email: one.email }));
    });
  }

  /** 添加成员, the step over the window; what it sent stands under 待接受, with how many were sent said at the page's head. */
  #invite(): void {
    const read = this.#read, organization = this.ports.organization(), seats = organization?.seats, w = this.#w;
    if (read === undefined || seats?.thisPeriod === undefined || w === undefined) return;
    const opener = this.#control("invite") ?? this.ports.home();
    inviteStep({
      backend: this.ports.backend, say: this.ports.say, w, home: this.ports.home(), opener,
      held: seats.thisPeriod, left: this.#left, most: seats.most,
      known: [...read.members.flatMap((one) => (one.email === undefined ? [] : [one.email])), ...read.invitations.map((one) => one.email)],
      price: this.ports.price(), lastDay: this.ports.lastDay(),
      toCard: this.ports.toCard,
      // Sent, the page reads its list again behind the step; the step closed, the keyboard goes to 待接受, where the new rows stand.
      sent: async (answer, closed) => {
        await Promise.all([this.read(), this.ports.reread()]);
        this.#lead = answer.sent > 0 ? { sent: answer.sent } : undefined;
        if (answer.sent > 0) { this.#tab = "pending"; this.#search = ""; this.#filter = "all"; this.#page = 1; }
        if (closed) this.ports.redraw(answer.sent > 0 ? "tab:pending" : "invite"); else this.ports.redraw();
      },
    });
  }
}

export type { MemberRole };
