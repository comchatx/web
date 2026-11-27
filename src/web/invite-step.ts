import { InvitationsLimited, SeatsRefused, type Backend, type MemberRole, type SeatsPrice } from "./backend.js";
import { h, type Child } from "./dom.js";
import { dialog, select } from "./forms.js";
import type { Writer } from "./settings-words.js";
import type { Say } from "./stream-view.js";

export type InviteAsk = {
  readonly backend: Pick<Backend, "invite" | "seatsPrice">; readonly say: Say; readonly w: Writer;
  readonly home: HTMLElement; readonly opener: HTMLElement;
  /** The seats this period holds, those not held by a member or an invitation, and the most an organization has. */
  readonly held: number; readonly left: number; readonly most: number;
  /** The addresses already a member's or waiting, said and skipped. */
  readonly known: readonly string[];
  /** A seat's monthly price and the period's last day, for the seats' sentence; unread, it is left out. */
  readonly price: number | undefined; readonly lastDay: string | undefined;
  readonly toCard: () => void;
  /** Invitations went out, as many as `sent`; `closed` where the step closed, else it stands over the page. */
  readonly sent: (answer: { readonly sent: number }, closed: boolean) => void;
};

/** How a typed or pasted list is split: commas, spaces, lines and their Chinese marks; the same address twice is once. */
export const addressesIn = (typed: string): readonly string[] =>
  [...new Set(typed.split(/[\s,，;；、]+/).map((one) => one.trim()).filter((one) => one !== "").map((one) => one.toLowerCase()))];
/** The addresses a CSV file holds, read in the page: whatever stands where an address can, in any column. Nothing is uploaded. */
export const addressesOf = (file: string): readonly string[] => [...new Set((file.match(/[^\s,;"'<>()]+@[^\s,;"'<>()]+/g) ?? []).map((one) => one.toLowerCase()))];

/** The step inside a card of a page, as the card that follows an organisation's making holds it: no title of its own, and the card's way on beside its press. */
export type InvitePlace = { readonly host: HTMLElement; readonly skip: HTMLElement };

type Run = undefined | "wait" | "declined" | "failed" | "limit" | "refused";

/**
 * 添加成员, Claude's Add member in our step: the seats left under its title; 邮箱 and 上传 CSV over a field for one address or several,
 * typed, pasted or read from a file; the role they are sent with, each role's line under its name; what is already a member's or waiting
 * said under it, and skipped. Where the addresses outnumber the seats left, the seats missing are bought here with 管理席位's sums and its
 * 确认并购买, one press buying them and sending; past the most, that step's line stands and the press is off. What the provider will not
 * take stays in the field, said under it, and the rest are sent.
 */
export function inviteStep(ask: InviteAsk): HTMLDialogElement;
export function inviteStep(ask: InviteAsk, place: InvitePlace): HTMLElement;
export function inviteStep(ask: InviteAsk, place?: InvitePlace): HTMLElement {
  const { say, w } = ask;
  let run: Run;
  let refused: readonly string[] = [];
  let role: MemberRole = "member";
  let left = ask.left, held = ask.held;
  const known = new Set(ask.known.map((one) => one.toLowerCase()));
  // The platform's quote for the count the addresses need, none where they need no seat: read when that need changes to a count that can
  // be bought, and only then; an answer for a count no longer asked is let go. One that could not be read stays so until the count changes
  // or the step opens again, never read again for an edit within one count.
  let quote: { readonly count: number; readonly price?: SeatsPrice | "failed" } | undefined;
  const field = h("textarea", { class: "iv-field", id: "iv-field", rows: "3", "data-key": "addresses", placeholder: say("inv.hint"), spellcheck: "false", autocomplete: "off", autocapitalize: "off", "aria-describedby": "iv-left iv-notes" });
  const leftLine = h("p", { class: "f-line iv-left", id: "iv-left" });
  const file = h("input", { type: "file", accept: ".csv,text/csv", hidden: true, tabindex: "-1" });
  const upload = h("button", { type: "button", class: "f-quiet", "data-key": "upload", onclick: () => file.click() }, say("inv.upload"));
  const kinds = ["member", "admin"] as const;
  const pick = select({ label: say("inv.role"), held: 0, start: true, values: kinds.map((kind) => say(`inv.role.${kind}`)), helps: kinds.map((kind) => say(`inv.role.${kind}Help`)),
    take: (index) => { role = kinds[index] ?? "member"; } });
  pick.button.dataset["key"] = "role";
  const notes = h("div", { class: "iv-notes", id: "iv-notes" });
  const body = h("div", { class: "st-body" });
  // In a card the press is the card's, across it, and the card's way on stands under it.
  const acts = h("div", { class: place === undefined ? "f-acts" : "road-acts" });
  const inside = [leftLine,
    h("div", { class: "iv-name" }, h("label", { for: "iv-field" }, say("inv.email")), upload, file), field,
    h("div", { class: "iv-pick" }, h("span", {}, say("inv.role")), pick.button), notes, body, acts];
  const box = place === undefined
    ? h("dialog", { class: "f-dialog st-step iv-step", "aria-labelledby": "iv-title", "data-key": "invite-step" }, h("h2", { id: "iv-title" }, say("members.invite")), ...inside)
    : h("div", { class: "iv-step is-card", "data-key": "invite-step" }, ...inside);
  // The dialog closes; in a card the page the card is on moves on.
  const close = (): void => { if (box instanceof HTMLDialogElement) box.close(); };
  box.addEventListener("close", () => { pick.close(false); box.remove(); });

  const sort = (): { readonly known: readonly string[]; readonly fresh: readonly string[] } => {
    const all = addressesIn(field.value);
    return { known: all.filter((one) => known.has(one)), fresh: all.filter((one) => !known.has(one)) };
  };
  const priced = (count: number): void => {
    if (quote?.count === count) return;
    quote = { count };
    const asked = quote;
    void ask.backend.seatsPrice(count).then((price) => { if (quote === asked) { quote = { count, price }; paint(); } }, () => { if (quote === asked) { quote = { count, price: "failed" }; paint(); } });
  };
  const sums = (rows: readonly (readonly [string, string] | false)[]): HTMLElement =>
    h("dl", { class: "st-sums" }, ...rows.filter((row): row is readonly [string, string] => row !== false).map(([name, value]) => h("div", {}, h("dt", {}, name), h("dd", {}, value))));
  const paint = (focus?: string): void => {
    const sorted = sort(), need = Math.max(0, sorted.fresh.length - left), waiting = run === "wait";
    const over = held + need > ask.most, buy = need > 0 && !over;
    if (buy) priced(held + need); else quote = undefined;
    const price = buy && quote?.count === held + need ? quote.price : undefined;
    const reading = buy && price === undefined;
    leftLine.textContent = left === 1 ? say("inv.left1") : say("inv.left", { n: String(left) });
    const lines: Child[] = [];
    if (sorted.known.length === 1) lines.push(h("p", {}, say("inv.known", { email: sorted.known[0]! })));
    else if (sorted.known.length > 1) lines.push(h("p", {}, say("inv.skipped", { n: String(sorted.known.length) })));
    if (left === 0 && sorted.fresh.length === 0) lines.push(h("p", {}, say("inv.none")));
    else if (need > 0) lines.push(h("p", {}, sorted.fresh.length === 1 ? say("inv.shortOne") : need === 1 ? say("inv.short1", { n: String(sorted.fresh.length) }) : say("inv.short", { n: String(sorted.fresh.length), more: String(need) })));
    if (over) lines.push(h("p", {}, say("seats.most", { n: String(ask.most) })));
    if (run === "failed") lines.push(h("p", { class: "f-line bad", role: "alert" }, say("inv.failed")));
    if (run === "limit") lines.push(h("p", { class: "f-line bad", role: "alert" }, say("inv.limit")));
    if (run === "refused") lines.push(...refused.map((one) => h("p", { class: "f-line bad", role: "alert" }, say("inv.refused", { email: one }))));
    notes.replaceChildren(...lines.filter((one): one is HTMLElement => one instanceof HTMLElement));
    // The seats missing, bought here: 管理席位's second step, its sums, its line and its press, as the platform prices them.
    const read = price !== undefined && price !== "failed" ? price : undefined;
    body.replaceChildren(...[
      buy && sums([[say("seats.now"), String(held)], [say("seats.after"), String(held + need)], [say("seats.dueToday"), read === undefined ? "" : w.money(read.due)],
        read?.next !== undefined && [say("seats.next"), say("seats.nextSum", { amount: w.money(read.next) })]]),
      buy && read !== undefined && ask.lastDay !== undefined && h("p", { class: "quiet st-help" }, say("seats.addHelp", { amount: w.money(read.due), day: w.dayName(ask.lastDay) })),
      buy && price === "failed" && h("p", { class: "sw-card-bad", role: "alert" }, say("sw.moveFailed")),
      buy && run === "declined" && h("p", { class: "sw-card-bad", role: "alert" }, say("sw.cardDeclined"), " ",
        h("a", { href: "#", class: "f-link", "data-key": "to-card", onclick: (event: Event) => { event.preventDefault(); close(); ask.toCard(); } }, say("sw.updateCard"))),
    ].filter((one): one is HTMLElement => one instanceof HTMLElement));
    const words = waiting ? say("sw.cardWait") : buy ? say("seats.confirm") : say("members.invite");
    // The press drawn again keeps the keyboard where it was on it, as when its quote lands.
    const kept = acts.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset["key"] : undefined;
    acts.replaceChildren(...[
      place === undefined && h("button", { type: "button", class: "f-btn", "data-key": "no", disabled: waiting, onclick: () => close() }, say("sw.cardCancel")),
      // While the quote is read the press is busy, as forms.css draws it, and does nothing: it never buys at another count's sum.
      reading && !waiting
        ? h("button", { type: "button", class: "f-btn primary busy", "data-key": "yes", "aria-busy": "true", "aria-disabled": "true" }, h("span", { class: "f-word" }, words), h("span", { class: "f-spin", "aria-hidden": "true" }))
        : h("button", { type: "button", class: "f-btn primary", "data-key": "yes", disabled: waiting || sorted.fresh.length === 0 || over || (buy && read === undefined), onclick: () => { void send(); } }, words),
      place?.skip].filter((one): one is HTMLElement => one instanceof HTMLElement));
    field.readOnly = waiting;
    upload.disabled = waiting;
    pick.button.disabled = waiting;
    if (focus === undefined && kept !== undefined) acts.querySelector<HTMLElement>(`[data-key='${kept}']`)?.focus();
    if (focus !== undefined) (box.querySelector<HTMLElement>(`[data-key='${focus}']:not(:disabled)`) ?? field).focus();
  };
  const send = async (): Promise<void> => {
    const { fresh } = sort(), need = Math.max(0, fresh.length - left);
    const price = need > 0 && quote?.count === held + need ? quote.price : undefined;
    if (need > 0 && (price === undefined || price === "failed")) return;
    run = "wait"; refused = [];
    paint("yes");
    try {
      // The quote the admin confirmed is what is bought: its count and its moment, the press off until it is read.
      const answer = await ask.backend.invite(fresh, role, need > 0 && price !== undefined && price !== "failed" ? { seats: held + need, at: price.at } : undefined);
      // The seats are the count the platform answers it holds; its answer says nothing of a charge, so nothing here says paid.
      if (answer.seats !== undefined) { left += answer.seats.seats - held; held = answer.seats.seats; }
      for (const one of [...answer.sent, ...answer.known]) known.add(one.toLowerCase());
      left = Math.max(0, left - answer.sent.length);
      const kept = [...answer.refused, ...answer.full];
      if (kept.length === 0) {
        close();
        ask.sent({ sent: answer.sent.length }, true);
        return;
      }
      // What the provider would not take stays in the field and is said under it; the rest were sent, said at the page's head.
      refused = kept; run = "refused";
      field.value = kept.join(", ");
      if (answer.sent.length > 0 || answer.seats !== undefined) ask.sent({ sent: answer.sent.length }, false);
      paint("addresses");
    } catch (error) {
      run = error instanceof SeatsRefused ? (error.reason === "declined" ? "declined" : "failed") : error instanceof InvitationsLimited ? "limit" : "failed";
      paint(run === "declined" ? "yes" : "addresses");
    }
  };
  file.addEventListener("change", () => {
    const chosen = file.files?.[0];
    if (chosen === undefined) return;
    void chosen.text().then((text) => {
      const now = new Set(addressesIn(field.value)), added = addressesOf(text).filter((one) => !now.has(one));
      field.value = [field.value.trim().replace(/[,，;；、]$/, ""), ...added].filter((one) => one !== "").join(", ");
      file.value = ""; run = undefined; refused = [];
      paint("addresses");
    }, () => { file.value = ""; });
  });
  field.addEventListener("input", () => { if (run !== "wait") { run = undefined; refused = []; } paint(); });
  paint();
  if (!(box instanceof HTMLDialogElement)) { place!.host.append(box); return box; }
  ask.home.append(box);
  // A press waiting holds the step open, its answer drawn where it was asked.
  dialog(box, field, () => run === "wait")(ask.opener);
  return box;
}
