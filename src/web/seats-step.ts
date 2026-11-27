import { SeatsRefused, type Backend, type Day, type Seats, type SeatsPrice } from "./backend.js";
import { h, type Child } from "./dom.js";
import { dialog } from "./forms.js";
import type { Writer } from "./settings-words.js";
import type { Say } from "./stream-view.js";

/** What the step asks of the platform: a raise's price before it is made, and the count set. */
export type SeatsBackend = Pick<Backend, "seatsPrice" | "setSeats">;
export type SeatsAsk = {
  readonly backend: SeatsBackend; readonly say: Say; readonly w: Writer;
  /** Where the step stands, over the window. */
  readonly home: HTMLElement;
  /** The seats as `/me` holds them; an organization with no seats buys them. */
  readonly seats: Seats;
  /** A seat's monthly price as the platform serves it; unread, the lines that print it are left out. */
  readonly price: number | undefined;
  /** The period's last day, which an added seat's credit lasts until; unread, the sentence that names it is left out. */
  readonly lastDay: Day | undefined;
  /** The count from which the step starts again, as a 返回 from the card left it. */
  readonly from?: number;
  /** The control the step was opened from, which takes the keyboard back as it closes. */
  readonly opener: HTMLElement;
  /** An organization with no seats pays in 账单's card form, the step's second; it is handed the count. */
  readonly buy: (seats: number) => void;
  /** The count changed: the seats the platform answers it holds after. The answer carries no charge, so nothing is said as paid. */
  readonly done: (answer: { readonly seats: number }) => void;
  /** 更新银行卡, beside a declined card: 账单, where the card is. */
  readonly toCard: () => void;
};

/** Where a count pressed or typed past a bound was held: at the least or at the most. */
export type SeatsPast = "least" | "most" | undefined;
/** One count of seats, typed or stepped; the seats sheet and the page that makes an organisation draw it, each in its own classes. */
export type SeatCount = { readonly field: HTMLInputElement; readonly fewer: HTMLButtonElement; readonly more: HTMLButtonElement; readonly now: () => number; readonly typing: () => boolean; readonly paint: (waiting: boolean) => void };
/**
 * The count and its − and +: a number the organization can have counts at once; one past a bound stays in the field while it is typed, and
 * is held to the bound once the field is left or Enter is pressed, as − and + and the arrows hold it. An emptied field takes the count
 * back. `changed` hears every change, with the bound a count was held to.
 */
export function seatCount(ask: {
  readonly least: number; readonly most: number; readonly from: number; readonly say: (key: "hive.seats.fewer" | "hive.seats.more") => string;
  readonly field: Readonly<Record<string, string>>; readonly button: (which: "fewer" | "more") => Readonly<Record<string, string>>;
  readonly changed: (past: SeatsPast) => void;
}): SeatCount {
  const { least, most } = ask;
  let to = ask.from;
  // What the field holds while it is not a count the organization can have: nothing, or a number past a bound.
  let typing: string | undefined;
  const clamp = (n: number): void => {
    to = n < least ? least : n > most ? most : n;
    typing = undefined;
    ask.changed(n < least ? "least" : n > most ? "most" : undefined);
  };
  const typed = (): number => (typing === undefined || typing === "" ? to : Number(typing));
  // The count and its two presses are the same nodes through every painting, so a number being typed keeps its place.
  const field = h("input", { type: "text", role: "spinbutton", inputmode: "numeric", autocomplete: "off", maxlength: "3", "aria-valuemin": String(least), "aria-valuemax": String(most), ...ask.field });
  field.addEventListener("input", () => {
    const digits = field.value.replace(/\D/g, "");
    if (digits !== field.value) field.value = digits;
    const n = Number(digits);
    if (digits !== "" && n >= least && n <= most) { to = n; typing = undefined; } else typing = digits;
    ask.changed(undefined);
  });
  field.addEventListener("blur", () => { if (typing !== undefined) clamp(typed()); });
  // The field holds three figures at most, so a figure typed takes the count's place: the count is selected as the field is entered.
  let entered = false;
  field.addEventListener("focus", () => { entered = true; field.select(); });
  field.addEventListener("mouseup", (event) => { if (entered) { event.preventDefault(); entered = false; } });
  field.addEventListener("keydown", (event) => {
    entered = false;
    if (event.key === "Enter") { event.preventDefault(); if (typing !== undefined) clamp(typed()); field.select(); }
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); clamp(typed() + (event.key === "ArrowUp" ? 1 : -1)); field.select(); }
  });
  const fewer = h("button", { type: "button", ...ask.button("fewer"), "aria-label": ask.say("hive.seats.fewer"), onclick: () => clamp(typed() - 1) }, "−");
  const more = h("button", { type: "button", ...ask.button("more"), "aria-label": ask.say("hive.seats.more"), onclick: () => clamp(typed() + 1) }, "+");
  const paint = (waiting: boolean): void => {
    if (typing === undefined && field.value !== String(to)) field.value = String(to);
    field.setAttribute("aria-valuenow", String(to));
    field.disabled = waiting;
    for (const [button, off] of [[fewer, to <= least], [more, to >= most]] as const) {
      button.disabled = waiting;
      if (off) button.setAttribute("aria-disabled", "true"); else button.removeAttribute("aria-disabled");
    }
  };
  return { field, fewer, more, now: () => to, typing: () => typing !== undefined, paint };
}

/**
 * 管理席位 and 购买席位, the seats sheet's two steps (§五, §六): one count, typed or stepped, between the seats members and open invitations
 * hold (the least at that) and the most; 下一步; then the sums and the press that pays or sets. A raise is priced by the platform's preview
 * and paid at the instant it priced; a cut is charged nothing and takes the renewal. An organization with no seats pays in the card form.
 */
export function seatsStep(ask: SeatsAsk): HTMLDialogElement {
  const { say, w, seats } = ask;
  const bare = seats.state === "none";
  const held = seats.thisPeriod ?? 0, now = seats.nextPeriod?.seats ?? held;
  const least = Math.max(seats.least, seats.inUse ?? 0), most = seats.most;
  let bound: "taken" | "most" | undefined;
  let confirm = false, waiting = false;
  let price: SeatsPrice | undefined;
  let bad: "declined" | "failed" | undefined;
  const stepped = seatCount({ least, most, from: ask.from ?? (bare ? least : now), say,
    field: { class: "st-num", "data-key": "count", "aria-labelledby": "st-count", "aria-describedby": "st-each st-least st-notes" },
    button: (which) => ({ class: "f-btn", "data-key": which }),
    changed: (past) => { bound = past === "least" && least > seats.least ? "taken" : past === "most" ? "most" : undefined; bad = undefined; paint(); } });
  const { field: num, fewer, more } = stepped;
  const count = h("div", { class: "st-count" },
    h("div", {}, h("p", { class: "st-label", id: "st-count" }, say("hive.seats.count")),
      ask.price !== undefined && h("p", { class: "quiet st-each", id: "st-each" }, say("hive.seats.each", { price: w.money(ask.price) })),
      h("p", { class: "quiet st-each", id: "st-least" }, say("seats.minimum", { least: String(seats.least) }))),
    h("div", { class: "st-stepper", role: "group", "aria-labelledby": "st-count" }, fewer, num, more));
  const notes = h("div", { class: "st-notes", id: "st-notes", role: "status" });
  const body = h("div", { class: "st-body" });
  const acts = h("div", { class: "f-acts" });
  const box = h("dialog", { class: "f-dialog st-step", "aria-labelledby": "st-title" },
    h("h2", { id: "st-title" }, say(bare ? "seats.buy" : "seats.manageName")), count, notes, body, acts);
  box.addEventListener("close", () => box.remove());

  const sums = (rows: readonly (readonly [string, string] | false)[]): HTMLElement =>
    h("dl", { class: "st-sums" }, ...rows.filter((row): row is readonly [string, string] => row !== false).map(([name, value]) => h("div", {}, h("dt", {}, name), h("dd", {}, value))));
  const next = async (): Promise<void> => {
    const to = stepped.now();
    if (bare) { box.close(); ask.buy(to); return; }
    price = undefined;
    if (to === held) { confirm = true; paint("yes"); return; }
    waiting = true; paint("yes");
    try { price = await ask.backend.seatsPrice(to); confirm = true; } catch { bad = "failed"; }
    waiting = false; paint("yes");
  };
  const set = async (): Promise<void> => {
    waiting = true; bad = undefined; paint("yes");
    try {
      const answer = await ask.backend.setSeats(stepped.now(), price?.at);
      box.close();
      ask.done({ seats: answer.seats });
    } catch (error) {
      waiting = false;
      bad = error instanceof SeatsRefused && error.reason === "declined" ? "declined" : "failed";
      paint("yes");
    }
  };
  const paint = (focus?: string): void => {
    const to = stepped.now();
    const changed = (bare || to !== now) && !stepped.typing();
    stepped.paint(waiting);
    count.hidden = confirm; notes.hidden = confirm;
    notes.replaceChildren(...(bound === "taken" ? [h("p", {}, say("seats.taken"))] : bound === "most" ? [h("p", {}, say("seats.most", { n: String(most) }))] : []));
    const raise = to > held;
    const help = !confirm ? undefined : raise ? (price === undefined || ask.lastDay === undefined ? undefined : say("seats.addHelp", { amount: w.money(price.due), day: w.dayName(ask.lastDay) })) : say("seats.dropHelp");
    const declined: Child = bad === "declined" && h("p", { class: "sw-card-bad", role: "alert" }, say("sw.cardDeclined"), " ",
      h("a", { href: "#", class: "f-link", "data-key": "to-card", onclick: (event: Event) => { event.preventDefault(); box.close(); ask.toCard(); } }, say("sw.updateCard")));
    const failed: Child = bad === "failed" && h("p", { class: "sw-card-bad", role: "alert" }, say("sw.moveFailed"));
    body.replaceChildren(...[
      confirm && sums([[say("seats.now"), String(held)], [say("seats.after"), String(to)],
        [say("seats.dueToday"), w.money(price?.due ?? 0)],
        // The next bill is the platform's own figure, drawn where it gives one: none while a cut already waits.
        price?.next !== undefined && [say("seats.next"), say("seats.nextSum", { amount: w.money(price.next) })]]),
      help !== undefined && h("p", { class: "quiet st-help" }, help), declined, failed,
    ].filter((one): one is HTMLElement => one instanceof HTMLElement));
    const no = confirm
      ? h("button", { type: "button", class: "f-btn", "data-key": "no", disabled: waiting, onclick: () => { confirm = false; bad = undefined; paint("yes"); } }, say("seats.back"))
      : h("button", { type: "button", class: "f-btn", "data-key": "no", disabled: waiting, onclick: () => box.close() }, say("sw.cardCancel"));
    const words = waiting && confirm ? say("sw.cardWait") : confirm ? say(raise ? "seats.confirm" : "seats.confirmDrop") : say("seats.nextStep");
    const yes = h("button", { type: "button", class: "f-btn primary", "data-key": "yes", disabled: !changed || waiting, onclick: () => { void (confirm ? set() : next()); } }, words);
    acts.replaceChildren(no, yes);
    if (focus !== undefined) {
      const target = box.querySelector<HTMLButtonElement>(`[data-key='${focus}']`);
      (target !== null && !target.disabled ? target : box.querySelector<HTMLElement>("[data-key='no']"))?.focus();
    }
  };
  paint();
  ask.home.append(box);
  const first = more.getAttribute("aria-disabled") === "true" ? num : more;
  // A press waiting holds the step open, its answer drawn where it was asked.
  dialog(box, first, () => waiting)(ask.opener);
  return box;
}
