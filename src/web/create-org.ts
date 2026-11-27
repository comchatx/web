import type { Backend, Me } from "./backend.js";
import { h, svg, type Child } from "./dom.js";
import { NAME_MOST } from "./org-page.js";
import { cardForm } from "./pay-step.js";
import { sessionOf } from "./paying.js";
import type { RoadSay } from "./road-words.js";
import { seatCount, type SeatsPast } from "./seats-step.js";
import type { Writer } from "./settings-words.js";
import type { Say } from "./stream-view.js";
import { WAIT_MS } from "./visit.js";
import { createdPath } from "../shared/door.js";
import { isPublicMailbox } from "../shared/public-mailbox.js";

/** The seats an organisation holds, as the platform bounds them (`src/platform/billing.ts`, `SEATS`). */
export const SEATS = Object.freeze({ least: 2, most: 20 });

const ORG_ICON = ["M3 27.5 12 23.5l9 4v9l-9 4-9-4v-9Z", "M3 27.5 12 31.5l9-4M12 31.5v9", "M23 27.5 32 23.5l9 4v9l-9 4-9-4v-9Z", "M23 27.5 32 31.5l9-4M32 31.5v9", "M13 12.5 22 8.5l9 4v9l-9 4-9-4v-9Z", "M13 12.5 22 16.5l9-4M22 16.5v9"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateBackend = Pick<Backend, "payIn" | "payForm" | "returned" | "use" | "leave">;
export type CreatePorts = {
  readonly backend: CreateBackend;
  readonly say: RoadSay;
  readonly write: Writer;
  /** A seat's monthly price, from `/terms`; the lines that print it are left out where it was not read. */
  readonly price: () => number | undefined;
  readonly me: Extract<Me, { kind: "signed_in" }>;
  /** The product's own words, for the provider's form. */
  readonly words: Say;
  /** The page around a step: its main, and its head with ← at its start. */
  readonly page: (main: readonly Child[], head: readonly Child[]) => void;
  /** The road's card around a step. */
  readonly card: (main: readonly Child[]) => void;
  readonly cardBox: (...inside: readonly Child[]) => HTMLElement;
  /** The plans page the pages were opened from. */
  readonly plans: () => void;
  /** The sign-in is the one a work address was signed in with from another, the organisation's own. */
  readonly work: boolean;
};

const tick = (): SVGSVGElement => svg("svg", { viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false" }, svg("path", { d: "M3.5 8.5l3 3 6-7" }));
const tail = (said: string): readonly Child[] => { const cut = /^(.*?)(当期有效|valid for the period)$/.exec(said); return cut === null ? [said] : [cut[1]!, h("span", { class: "nowrap" }, cut[2]!)]; };
const later = (): Promise<void> => new Promise((done) => { setTimeout(done, WAIT_MS); });

/**
 * The 组织 card beside Pro on the plans page (`spike/hive-create`): its price a seat's, from `/terms`, what an organisation holds, and
 * 创建组织, which opens the pages that make one.
 */
export function orgPlan(say: RoadSay, write: Writer, price: number | undefined, create: () => void): HTMLElement {
  const list = (...lines: readonly string[]): HTMLElement => h("ul", { class: "plan-list", role: "list" }, ...lines.map((line) => h("li", {}, tick(), h("span", {}, line))));
  return h("article", { class: "plan", "aria-labelledby": "plan-org" },
    svg("svg", { class: "plan-icon", viewBox: "0 0 44 44", "aria-hidden": "true", focusable: "false" },
      svg("g", { fill: "none", stroke: "currentColor", "stroke-width": "1.25", "stroke-linejoin": "round", "stroke-linecap": "round" }, ...ORG_ICON.map((d) => svg("path", { d })))),
    h("h3", { class: "plan-name", id: "plan-org" }, say("fork.org.name")),
    price !== undefined && h("p", { class: "plan-price" }, write.money(price)),
    price !== undefined && h("p", { class: "plan-note" }, ...tail(say("fork.org.note", { price: write.money(price) }))),
    h("button", { type: "button", class: "btn btn-primary btn-block", "data-key": "create-org", onclick: create }, say("fork.org.go")),
    h("p", { class: "plan-fine" }),
    h("hr", { class: "plan-rule" }),
    h("div", {}, list(say("fork.org.l.shared"), say("fork.org.l.invite"), say("fork.org.l.money"), say("fork.org.l.range", { least: SEATS.least, most: SEATS.most }))));
}

/**
 * The pages that make an organisation (the signed creation pages, Claude's two): its name on a page of its own, then the seats, the
 * order and the payment on one page. For an address the platform calls a public mailbox a step stands first: a work address, and the
 * door's code sent to it. Nothing is made until the payment lands: once the provider says paid, the page waits for the platform to name
 * the organisation, then the browser switches into it, where the step that invites stands.
 */
export class CreateOrg {
  #name = "";
  #seats: number = SEATS.least;
  constructor(readonly ports: CreatePorts) {}

  /** 创建组织 on the plans page: the work address first where the address in use is a public mailbox. */
  start(): void { if (this.ports.me.publicMailbox === true) this.work(); else this.name(); }

  /** The step for a public mailbox: a work address, refused where it is one too; the code is the door's, under the address given. */
  work(): void {
    const { say } = this.ports;
    const field = h("input", { class: "cl-formFieldInput", id: "work-email", type: "text", inputmode: "email", autocomplete: "email", spellcheck: "false" });
    const bad = h("p", { class: "road-bad is-alone", id: "work-bad", role: "alert", hidden: true });
    const failed = h("p", { class: "road-bad is-alone", role: "alert", hidden: true }, say("pl.toastNotDone"));
    const tell = (words: string | undefined): void => {
      bad.hidden = words === undefined;
      bad.textContent = words ?? "";
      if (words === undefined) { field.removeAttribute("aria-invalid"); field.removeAttribute("aria-describedby"); return; }
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", "work-bad");
    };
    const go: HTMLButtonElement = h("button", { type: "button", class: "cl-formButtonPrimary", "data-key": "work-go", onclick: () => {
      const value = field.value.trim();
      const refused = value === "" ? say("door.emailMissed") : !EMAIL.test(value) ? say("door.emailBad") : isPublicMailbox(value) ? say("work.public") : undefined;
      tell(refused);
      if (refused !== undefined) { field.focus(); return; }
      failed.hidden = true;
      go.disabled = true;
      go.textContent = say("sw.cardWait");
      // This sign-in ends, and the door signs the person in under the work address; its code right, the door opens the name page.
      void this.ports.backend.leave(false, { work: value }).catch(() => { go.disabled = false; go.textContent = say("door.continue"); failed.hidden = false; });
    } }, say("door.continue"));
    field.addEventListener("input", () => tell(undefined));
    field.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); go.click(); } });
    this.ports.card([this.ports.cardBox(
      h("div", { class: "cl-header" }, h("h1", { class: "cl-headerTitle" }, say("pay.org.title")), h("p", { class: "cl-headerSubtitle" }, say("work.lead"))),
      h("div", { class: "cl-formField" }, h("label", { class: "cl-formFieldLabel", for: "work-email" }, say("work.email")), field, bad),
      h("p", { class: "road-words is-quiet" }, say("work.note")),
      failed, go,
      h("div", { class: "cl-backRow" }, h("button", { type: "button", class: "cl-backLink road-link", onclick: () => this.ports.plans() }, say("back"))))]);
  }

  /** The head of Claude's pages: ← at its start, the wordmark, and beside it what `beside` holds. */
  #head(back: () => void, beside?: HTMLElement): readonly Child[] {
    const arrow = svg("svg", { class: "icon", viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" }, svg("path", { d: "M19 12H5M11 18l-6-6 6-6" }));
    return [h("button", { type: "button", class: "road-back-arrow", "data-key": "back", "aria-label": this.ports.say("back"), onclick: back }, arrow),
      h("span", { class: "road-brand" }, h("span", { class: "wordmark" }, "ComChatX"), beside)];
  }

  #step(column: readonly Child[], back: () => void, beside?: HTMLElement): void {
    this.ports.page([h("div", { class: "road-column door-column road-step" }, ...column)], this.#head(back, beside));
  }

  /** The name, a page of its own; the name typed stands in the head beside the wordmark. 继续 with the field empty says so under it. */
  name(): void {
    const { say } = this.ports;
    const field = h("input", { class: "cl-formFieldInput", id: "org-name", type: "text", autocomplete: "organization", maxlength: String(NAME_MOST), "data-key": "org-name" });
    field.value = this.#name;
    const bad = h("p", { class: "road-bad is-alone", id: "org-bad", role: "alert", hidden: true }, say("pay.org.nameMissed"));
    const echo = h("span", { class: "road-brand-org", "aria-hidden": "true" });
    const paint = (): void => { const value = field.value.trim(); echo.textContent = value; echo.hidden = value === ""; };
    const press = (): void => {
      const value = field.value.trim();
      if (value === "") { bad.hidden = false; field.setAttribute("aria-invalid", "true"); field.setAttribute("aria-describedby", "org-bad"); field.focus(); return; }
      this.#name = value;
      this.seats();
    };
    field.addEventListener("input", () => {
      this.#name = field.value.trim();
      paint();
      if (field.value.trim() !== "") { bad.hidden = true; field.removeAttribute("aria-invalid"); field.removeAttribute("aria-describedby"); }
    });
    field.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); press(); } });
    paint();
    this.#step([
      h("div", { class: "road-step-head" }, h("h1", { class: "cl-headerTitle" }, say("pay.org.title")), h("p", { class: "road-words is-quiet" }, say("pay.org.lead", { most: SEATS.most }))),
      h("div", { class: "cl-formField" }, h("label", { class: "cl-formFieldLabel", for: "org-name" }, say("pay.org.name")), field, bad),
      h("button", { type: "button", class: "cl-formButtonPrimary road-press-fit", "data-key": "name-go", onclick: press }, say("door.continue")),
    ], () => this.ports.plans(), echo);
  }

  /**
   * The seats, the order and the payment, one page. The order is a line of two seats until 调整席位数 turns it into the count: − and +,
   * and a number typed, held to the bounds once the field is left. The provider's fields are asked for the count shown, and again
   * when it changes. Paid, the page waits for the organisation, then switches into it.
   */
  seats(): void {
    const { say, write, backend } = this.ports;
    const price = this.ports.price();
    const { least, most } = SEATS;
    let n = this.#seats, adjusting = false, refused: SeatsPast, waiting = false;
    const sum = (count: number): string => (price === undefined ? "" : write.money(count * price));
    const stepped = seatCount({ least, most, from: n, say,
      field: { class: "cl-formFieldInput road-count", "data-key": "seats-count", "aria-labelledby": "seats-label", "aria-describedby": "seats-each seats-notes" },
      button: (which) => ({ "data-step": which }),
      changed: (past) => { n = stepped.now(); refused = past; paint(); if (!stepped.typing()) form(); } });
    const { field: count, fewer, more } = stepped;
    const notes = h("div", { class: "road-notes", id: "seats-notes", role: "status" });
    const lineCount = h("span", {}), lineSum = h("span", { class: "road-sum" }), totalSum = h("span", { class: "road-sum" });
    const each = (id?: string): HTMLElement | false => price !== undefined && h("p", { class: "road-words is-quiet", ...(id === undefined ? {} : { id }) }, say("hive.seats.each", { price: write.money(price) }));
    const adjust = h("button", { type: "button", class: "btn road-adjust", "data-key": "adjust", onclick: () => { adjusting = true; paint(); count.focus(); } }, say("hive.order.adjust"));
    const line = h("div", { class: "road-tally" }, h("div", { class: "road-sumline" }, lineCount, lineSum), each(), adjust);
    const stepper = h("div", { class: "road-seats" },
      h("div", {}, h("p", { class: "cl-formFieldLabel", id: "seats-label" }, say("hive.seats.count")), each("seats-each")),
      h("div", { class: "road-stepper", role: "group", "aria-labelledby": "seats-label" }, fewer, count, more));
    const payBox = h("div", { class: "road-fields road-pay" });
    // The line of no refunds stands over the press, as the signed page draws it: the form's press is moved under it, the same node.
    const fine = h("p", { class: "road-fine is-start" }, say("hive.seats.noRefund"));
    const press = h("div", { class: "road-pay" });
    // Paid, the page is the payment's until the organisation is named: nothing on it, ← too, can ask another.
    let paid = false;
    const back = (): void => { if (!waiting && !paid) { this.#seats = n; this.name(); } };
    let asked = 0;
    let shownFor: number | undefined;
    // The provider's fields for the count shown: a new session for each count, the last one asked the one drawn. A session asked and not
    // paid makes nothing and lapses at the provider.
    const form = (): void => {
      if (shownFor === n) return;
      shownFor = n;
      const mine = ++asked;
      const secret = backend.payIn({ kind: "seats", seats: n, name: this.#name }, "card");
      payBox.replaceChildren();
      press.replaceChildren();
      secret.catch(() => {
        if (mine !== asked) return;
        shownFor = undefined;
        // The organisation was not made and nothing was paid: main's sentence, and the press asks again with everything kept.
        payBox.replaceChildren(h("p", { class: "road-bad is-alone", role: "alert" }, say("pl.toastNotDone")));
        press.replaceChildren(h("button", { type: "button", class: "cl-formButtonPrimary", "data-key": "card-yes", onclick: () => { form(); } }, payWord()));
      });
      const bought = n;
      const body = cardForm({ kind: "card", host: payBox, pressing: (on) => { waiting = on || paid; paint(); } }, this.ports.words, (got) => backend.payForm(got), {
        secret, pays: true, payWord: payWord(),
        done: (answer) => {
          if (answer === "open") return;
          paid = true;
          waiting = true;
          void secret.then((got) => this.#wait(sessionOf(got), bought, press));
        },
      });
      press.replaceChildren(...[body.querySelector(".pl-card-acts")].filter((one): one is Element => one !== null));
    };
    const payWord = (): string => say("hive.seats.pay", { n, amount: sum(n) }).replace(/\s+$/, "");
    const paint = (): void => {
      line.hidden = adjusting;
      stepper.hidden = !adjusting;
      lineCount.textContent = say("hive.order.seats", { count: n });
      lineSum.textContent = totalSum.textContent = sum(n);
      stepped.paint(waiting);
      adjust.disabled = waiting;
      notes.replaceChildren(...(adjusting && refused === "most" ? [h("p", { class: "road-words is-quiet" }, say("seats.most", { n: most }))] : []));
      const yes = press.querySelector<HTMLButtonElement>("[data-key='card-yes']");
      if (yes !== null && !waiting) yes.textContent = payWord();
    };
    paint();
    this.#step([
      h("div", { class: "road-step-head" }, h("h1", { class: "cl-headerTitle" }, say("hive.seats.title")), h("p", { class: "road-words is-quiet" }, say("hive.seats.lead", { least }))),
      h("section", { class: "road-box", "aria-labelledby": "order-title" },
        h("h2", { class: "road-box-title", id: "order-title" }, say("hive.order.title")),
        line, stepper, notes,
        h("hr", { class: "road-rule" }),
        h("div", { class: "road-sumline road-total" }, h("span", {}, say("hive.order.total")), totalSum),
        price !== undefined && h("hr", { class: "road-rule" }),
        price !== undefined && h("p", { class: "road-words is-quiet" }, say("hive.seats.brings", { amount: write.money(price) }))),
      h("section", { class: "road-box", "aria-labelledby": "pay-title" },
        h("h2", { class: "road-box-title", id: "pay-title" }, say("sw.g.method")),
        payBox, fine, press),
    ], back);
    form();
  }

  /**
   * Paid: the press holds its wait while the platform makes the organisation, read again until it names it; then the browser switches
   * into it, at the step that invites. A read that fails is read again, as the road reads a payment it came back from, and so is a
   * switch refused once the organisation is named.
   */
  async #wait(session: string, seats: number, box: HTMLElement): Promise<void> {
    const { say, backend } = this.ports;
    for (const one of document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(".road-step button, .road-step input, .road-back-arrow")) one.disabled = true;
    const yes = box.querySelector<HTMLButtonElement>("[data-key='card-yes']");
    if (yes !== null) { yes.textContent = say("sw.cardWait"); yes.classList.add("cl-button", "cl-loading"); }
    for (;;) {
      const answer = await backend.returned(session).catch(() => undefined);
      if (answer?.organization !== undefined && answer.organization !== "pending") {
        const moved = await backend.use(answer.organization, createdPath(seats, this.ports.work)).then(() => true, () => false);
        if (moved) return;
      }
      await later();
    }
  }
}
