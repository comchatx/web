import type { Backend, Day, Organization, Seats } from "./backend.js";
import { h, type Child } from "./dom.js";
import { dialog } from "./forms.js";
import { seatsStep } from "./seats-step.js";
import type { Writer } from "./settings-words.js";
import type { Say } from "./stream-view.js";
import { Waits } from "./waiting.js";

/** What 组织 asks of the platform. */
export type OrgBackend = Pick<Backend, "renameOrganization" | "deleteAccount" | "seatsPrice" | "setSeats">;
export type OrgPorts = {
  readonly backend: OrgBackend; readonly say: Say;
  /** The organization as this opening's read of `/me` holds it, and the balance its 账单 reads. */
  readonly organization: () => Organization | undefined; readonly figure: () => number | undefined;
  /** Draws the pane again, the keyboard back on the control `key` names. */
  readonly redraw: (key?: string) => void;
  /** Where the window's addresses start: 账单 is linked from the line that holds 删除组织. */
  readonly base: string;
  /** 更新银行卡, while a failed charge is tried again: 账单's card form. */
  readonly updateCard: (from: string) => void;
  /** 账单's 已更新 for a card replaced from the control `at` names. */
  readonly cardSaid: (at: string) => HTMLElement | undefined;
  /** The organization was deleted. */
  readonly deleted: (name: string) => void;
  /** Where a question over the window is put. */
  readonly home: () => HTMLElement;
  /** A seat's monthly price as the platform serves it, and the period's last day; each unread where the platform gave none. */
  readonly seatPrice: () => number | undefined; readonly lastDay: () => Day | undefined;
  /** 购买席位's second step, 账单's card form: `back` is the count again, `paid` the sum the card paid, or none where it was not said paid. */
  readonly buy: (seats: number, w: Writer, back: () => void, paid: (units: number | undefined) => void) => void;
  /** The account read again, once the count has changed. */
  readonly reread: () => Promise<void>;
  /** Opens an address of the window: 账单, where a declined card is mended. */
  readonly go: (hash: string) => void;
};

/** An organization's name: one to fifty characters once trimmed, as the platform takes it. */
export const NAME_MOST = 50;

/** Whether the seats hold the organization: while they renew, or a failed charge is tried again, it is not deleted. */
/** 删除组织 is pressed only once the seats' renewal is cancelled or no seat is held: a seat state not read holds it as the renewing ones do. */
const holding = (seats: Seats | undefined): boolean => seats?.state !== "cancelling" && seats?.state !== "none";

/**
 * 组织设置's 组织, as the seats sheet draws it: the name, its 更新 opening the field and 保存 closing it; 席位总数 in its five states; and
 * 删除组织, held while the seats hold the organization, and asked by typing the name.
 */
export class OrgPage {
  /** The name's field is open, holding what is typed. */
  #naming: string | undefined;
  /** What the last press of the row answered: the name kept, or a move that did not go through. */
  #said: { readonly what: "renamed" | "updated" | "failed"; readonly at: string } | undefined;
  /** The count 管理席位's answer says is held, drawn until the account's reread brings the count it holds now. */
  #answered: number | undefined;
  /** A purchase the provider confirmed paid in 购买席位's card form at this opening: its sum is said once at the head of the page it was paid from. */
  #paid: number | undefined;
  /** A name kept at this opening, before its read of `/me` holds it. */
  #renamed: string | undefined;
  readonly #waits = new Waits(() => this.ports.home());
  constructor(readonly ports: OrgPorts) {}

  /** An opening meets 组织 closed: no field open and nothing said. */
  begin(): void {
    this.#naming = undefined;
    this.#said = undefined;
    this.#renamed = undefined;
    this.#paid = undefined;
  }

  /** 已支付 at the head of the page the seats were paid from, said once. */
  paidLead(w: Writer): readonly HTMLElement[] {
    const paid = this.#paid;
    if (paid === undefined) return [];
    this.#paid = undefined;
    return [h("div", { class: "sw-leads" }, h("p", { class: "sw-lead answer", role: "status" }, this.ports.say("seats.paid", { amount: w.money(paid) })))];
  }

  /**
   * 管理席位, or 购买席位 for an organization with none, over the window; `at` is the control it was opened from, which the keyboard comes
   * back to, and which a count set answers beside.
   */
  askSeats(w: Writer, at: string, from?: number): void {
    const seats = this.ports.organization()?.seats;
    if (seats === undefined) return;
    const opener = this.ports.home().querySelector<HTMLElement>(`[data-key='${at}']`) ?? this.ports.home();
    this.#said = undefined;
    seatsStep({ backend: this.ports.backend, say: this.ports.say, w, home: this.ports.home(), seats, price: this.ports.seatPrice(), lastDay: this.ports.lastDay(), opener,
      ...(from === undefined ? {} : { from }),
      buy: (n) => this.ports.buy(n, w, () => this.askSeats(w, at, n), (units) => { this.#paid = units; this.ports.redraw(at); }),
      done: (answer) => {
        // The count is the platform's answer until the reread holds the account's own; whatever a raise charged is the invoice's, under
        // 账单, never the preview's sum.
        this.#said = { what: "updated", at };
        this.#answered = answer.seats;
        void this.ports.reread().then(() => { this.#answered = undefined; this.ports.redraw(at); });
      },
      toCard: () => this.ports.go(`${this.ports.base}/billing`) });
  }

  get #name(): string | undefined { return this.#renamed ?? this.ports.organization()?.name; }

  draw(w: Writer): readonly Child[] {
    const say = this.ports.say;
    const seats = this.ports.organization()?.seats;
    const held = seats?.state !== undefined && seats.state !== "none" ? this.#answered ?? seats.thisPeriod : undefined;
    return [
      ...this.paidLead(w),
      this.#group("name", say("orgs.nameLabel"), [this.#nameRow()]),
      this.#group("seats", held === undefined ? say("seats.g") : `${say("seats.g")} ${say("seats.held", { n: String(held) })}`, [this.#seatsRow(seats, w)]),
      this.#group("delete", say("orgs.delete"), [this.#deleteRow(seats, w)]),
    ];
  }

  #group(id: string, title: string, rows: readonly Child[]): HTMLElement {
    return h("section", { class: "sw-group", "aria-labelledby": `sw-g-org-${id}` }, h("div", { class: "sw-head" }, h("h3", { id: `sw-g-org-${id}` }, title)), h("ul", { class: "sw-rows" }, ...rows));
  }
  #row(label: Child, help: readonly Child[], ctl: readonly Child[], more: { readonly under?: boolean; readonly roomy?: boolean; readonly cls?: string } = {}): HTMLElement {
    return h("li", { class: `sw-row${more.under === true ? " under" : ""}${more.roomy === true ? " roomy" : ""}${more.cls === undefined ? "" : ` ${more.cls}`}` },
      h("div", { class: "sw-text" }, label !== undefined && label !== false && h("p", { class: "sw-label" }, label), ...help.map((line) => h("p", { class: "sw-help quiet" }, line))),
      ctl.length > 0 && h("div", { class: "sw-ctl" }, ...ctl));
  }
  #answer(at: string): HTMLElement | undefined {
    const said = this.#said;
    if (said?.at !== at) return undefined;
    return said.what === "failed" ? h("span", { class: "sw-said asks", role: "status" }, this.ports.say("sw.moveFailed")) : h("span", { class: "sw-said", role: "status" }, this.ports.say("sw.methodUpdated"));
  }

  /** The name and 更新; pressed, the field with the name chosen, and 保存, or Enter, which keeps a new name and closes the field. */
  #nameRow(): HTMLElement {
    const say = this.ports.say;
    if (this.#naming === undefined) {
      return this.#row(this.#name ?? say("sw.unread"), [], [this.#answer("name-update"),
        this.#waits.ring("name", h("button", { type: "button", class: "f-btn sw-btn", "data-key": "name-update", "aria-label": say("orgs.nameUpdateName"), onclick: () => this.#openName() }, say("orgs.nameUpdate")))]);
    }
    const field = h("input", { type: "text", class: "sw-name-field", "data-key": "name-field", value: this.#naming, maxlength: String(NAME_MOST), "aria-labelledby": "sw-g-org-name",
      oninput: () => { this.#naming = field.value; } });
    field.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); void this.#save(); } });
    return this.#row(field, [], [this.#answer("name-update"), this.#waits.ring("name", h("button", { type: "button", class: "f-btn sw-btn", "data-key": "name-save", onclick: () => { void this.#save(); } }, say("sw.cardSave")))]);
  }
  #openName(): void {
    this.#naming = this.#name ?? "";
    this.#said = undefined;
    this.ports.redraw("name-field");
    const field = this.ports.home().querySelector<HTMLInputElement>("[data-key='name-field']");
    field?.select();
  }
  /** A name changed is kept by the platform, then said beside 更新; one left as it was, or emptied, closes the field and says nothing. */
  async #save(): Promise<void> {
    if (this.#naming === undefined || this.#waits.has("name")) return;
    const name = this.#naming.trim();
    if (name === "" || name === this.#name) { this.#naming = undefined; this.ports.redraw("name-update"); return; }
    await this.#waits.run("name", () => this.ports.backend.renameOrganization(name).then((kept) => {
      this.#renamed = kept;
      this.#naming = undefined;
      this.#said = { what: "renamed", at: "name-update" };
    }, () => { this.#said = { what: "failed", at: "name-update" }; }), this.ports.home().querySelector<HTMLElement>("[data-key='name-save']") ?? undefined);
    this.ports.redraw(this.#naming === undefined ? "name-update" : "name-field");
  }

  /** How many seats are in use, and what the seats are doing; a failed charge is mended with a card. */
  #seatsRow(seats: Seats | undefined, w: Writer): HTMLElement {
    const say = this.ports.say;
    // 管理 starts from the count held: with that unread there is nothing to change it from.
    const manage = (): readonly Child[] => seats?.thisPeriod === undefined ? [] : [this.#answer("seats"), h("button", { type: "button", class: "f-btn sw-btn", "data-key": "seats", "aria-label": say("seats.manageName"), onclick: () => this.askSeats(w, "seats") }, say("seats.manage"))];
    if (seats?.state === "none") return this.#row(say("orgs.noSeats"), [say("seats.noneHelp")], [h("button", { type: "button", class: "f-btn primary sw-btn", "data-key": "seats", onclick: () => this.askSeats(w, "seats") }, say("seats.buy"))]);
    const used = seats?.inUse === undefined || seats.state === undefined ? say("sw.unread") : say("seats.used", { n: String(seats.inUse) });
    const day = (on: string | undefined): string => (on === undefined ? "" : w.dayName(on));
    switch (seats?.state) {
      case "cut_pending": return this.#row(used, seats.nextPeriod === undefined ? [] : [say("seats.pending", { day: day(seats.nextPeriod.from) })], manage());
      case "cancelling": return this.#row(used, seats.on === undefined ? [] : [say("sw.plan.cancelled", { day: day(seats.on) })], [], { under: true });
      case "retrying": return this.#row(used, seats.on === undefined ? [] : [say("sw.retryLine", { day: day(seats.on) })],
        [this.ports.cardSaid("card"), h("button", { type: "button", class: "f-btn primary sw-btn", "data-key": "card", onclick: () => this.ports.updateCard("card") }, say("sw.updateCard"))], { under: true });
      case "seats": return this.#row(used, [], manage());
      default: return this.#row(used, [], []);
    }
  }

  /**
   * 删除组织: pressable once the seats' renewal is cancelled or no seat is held; held while the seats renew or a failed charge is tried
   * again, with the reason and 账单 beside it, the button reached by the keyboard and asking nothing.
   */
  #deleteRow(seats: Seats | undefined, w: Writer): HTMLElement {
    const say = this.ports.say;
    if (holding(seats)) {
      // A seat state not read is said as unread, and nothing is offered beside it: the platform decides at the request.
      const unread = seats?.state === undefined;
      const why = h("span", { id: "sw-org-delete-why" }, say(unread ? "sw.unread" : "orgs.deleteCancelFirst"));
      return h("li", { class: "sw-row roomy sw-delete-held" }, h("div", { class: "sw-text" }, h("p", { class: "sw-label sw-help" }, why, !unread && w.comma !== "，" && " ",
        !unread && h("a", { href: `${this.ports.base}/billing`, "data-key": "to-billing", "aria-describedby": "sw-org-delete-why" }, say("sw.sec.billing")))),
        h("div", { class: "sw-ctl" }, h("button", { type: "button", class: "f-btn sw-btn", "data-key": "org-delete", "aria-disabled": "true", "aria-describedby": "sw-org-delete-why" }, say("orgs.delete"))));
    }
    // With the name unread the question cannot ask for it: no 删除组织 is drawn until it is.
    if (this.#name === undefined) return this.#row(say("orgs.deleteHelp"), [], [], { roomy: true });
    return this.#row(say("orgs.deleteHelp"), [], [this.#answer("org-delete"),
      this.#waits.ring("delete", h("button", { type: "button", class: "f-btn sw-btn", "data-key": "org-delete", onclick: () => this.#askDelete(seats, w) }, say("orgs.delete")))], { roomy: true });
  }

  /** The question that deletes: what goes and for whom, the time left on seats still paid for, and the name typed before 删除组织 can be pressed. */
  #askDelete(seats: Seats | undefined, w: Writer): void {
    const say = this.ports.say;
    const name = this.#name;
    if (name === undefined || this.#waits.has("delete")) return;
    this.#said = undefined;
    const figure = this.ports.figure();
    // A balance not read is not written as nothing: the loss is said without a sum, as it is where there is none to lose.
    const lines: string[] = [figure !== undefined && figure > 0 ? say("orgs.deleteWhat", { name, amount: w.money(figure) }) : say("orgs.deleteWhatPlain", { name })];
    if (seats?.state === "cancelling" && seats.thisPeriod !== undefined && seats.on !== undefined) lines.push(say("orgs.deleteLose", { n: String(seats.thisPeriod), day: w.dayName(seats.on) }));
    const field = h("input", { type: "text", class: "sw-name-field", "data-key": "delete-name", "aria-labelledby": "sw-delete-type", autocomplete: "off" });
    const no = h("button", { type: "button", class: "f-btn", "data-key": "step-no", onclick: () => box.close() }, say("sw.notNow"));
    const yes = h("button", { type: "button", class: "f-btn", "data-key": "step-yes", "aria-disabled": "true",
      onclick: () => { if (yes.getAttribute("aria-disabled") === "true") return; box.close(); void this.#delete(name); } }, say("orgs.delete"));
    field.addEventListener("input", () => { yes.setAttribute("aria-disabled", String(field.value.trim() !== name)); });
    const box = h("dialog", { class: "f-dialog", "aria-labelledby": "sw-step-ask", "aria-describedby": "sw-step-what" },
      h("h2", { id: "sw-step-ask" }, say("orgs.deleteAsk", { name })),
      h("div", { id: "sw-step-what" }, ...lines.map((line) => h("p", {}, line))),
      h("label", { class: "f-field-label", id: "sw-delete-type" }, say("orgs.deleteType", { name })), field,
      h("div", { class: "f-acts" }, no, yes));
    box.addEventListener("close", () => box.remove());
    this.ports.home().append(box);
    const opener = this.ports.home().querySelector<HTMLElement>("[data-key='org-delete']");
    dialog(box, field)(opener ?? no);
  }
  async #delete(name: string): Promise<void> {
    await this.#waits.run("delete", () => this.ports.backend.deleteAccount().then(() => this.ports.deleted(name), () => {
      this.#said = { what: "failed", at: "org-delete" };
      this.ports.redraw("org-delete");
    }), this.ports.home().querySelector<HTMLElement>("[data-key='org-delete']") ?? undefined);
  }
}
