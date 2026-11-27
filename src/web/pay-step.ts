import type { PayAnswer, PayForm, SavedCard } from "./backend.js";
import { h, type Child } from "./dom.js";
import { dialog, scrimCloses } from "./forms.js";
import type { Say } from "./stream-view.js";
import { bar, skeleton } from "./waiting.js";

/** A step over the window: asked once, answered by one of its two buttons; Escape and a click beside it are 暂不. */
export function confirmStep(home: HTMLElement, say: Say, { ask, what, rules, yes, then, back, history }: {
  /** The question, and what it does where it says more than the question; a step whose question says it all has no sentence. */
  readonly ask: string; readonly what?: readonly Child[]; readonly yes: string; readonly then: () => void; readonly back: () => void;
  /** The way to the rules of what the step ends, a link after the sentence and not read with it: it opens the site beside the window, and the step stays. */
  readonly rules?: { readonly link: HTMLElement; readonly gap: string };
  /** A step the browser's Back answers as its own 暂不: it stands in an entry of its own, at the window's address, which closing takes back. */
  readonly history?: History;
}): HTMLDialogElement {
  const popped = (): void => { if (step.open) { removeEventListener("popstate", popped); step.close(); step.remove(); back(); } };
  const shut = (after: () => void): void => {
    step.close();
    step.remove();
    if (history !== undefined) { removeEventListener("popstate", popped); if ((history.state as { step?: true } | null)?.step === true) history.back(); }
    after();
  };
  const no = h("button", { type: "button", class: "f-btn", "data-key": "step-no", onclick: () => shut(back) }, say("sw.notNow"));
  // What cannot be undone is not the inviting button: both are outlined, and the sentence that says what goes is read with the question.
  const step = h("dialog", { class: "f-dialog", "aria-labelledby": "sw-step-ask", "aria-describedby": what === undefined ? undefined : "sw-step-what" },
    h("h2", { id: "sw-step-ask" }, ask),
    what !== undefined && h("p", {}, h("span", { id: "sw-step-what" }, ...what), rules?.gap, rules?.link),
    h("div", { class: "f-acts" }, no, h("button", { type: "button", class: "f-btn", "data-key": "step-yes", onclick: () => shut(then) }, yes)));
  step.addEventListener("cancel", (event) => { event.preventDefault(); shut(back); });
  scrimCloses(step, () => shut(back));
  home.append(step);
  step.showModal();
  no.focus();
  if (history !== undefined) {
    history.pushState({ ...(history.state as object | null), step: true }, "", location.href);
    addEventListener("popstate", popped);
  }
  return step;
}

/** The card's fields not read yet, as the provider lays them: the number across, then the expiry and the code side by side. */
const fieldsShape = (word: string): HTMLElement => skeleton(word, bar(3, "small"), bar(12, "lead"), bar(5, "small"), bar(12, "lead"));

export type FormAsk = {
  /** The session's secret, asked of the platform as the form opens. */
  readonly secret: Promise<string>;
  /** A card the account keeps, offered first where a payment can be made with it. */
  readonly saved?: SavedCard; readonly savedName?: string;
  /** Whether the form pays: its button prints the session's total; otherwise it saves a card. */
  readonly pays: boolean;
  /** What the page asked to pay, which the button prints until the provider's own total is read. */
  readonly amount?: string;
  /** Called before the provider is asked to confirm, with the session's secret: a way that leaves the page answers on coming back. */
  readonly asking?: (secret: string) => void;
  /** The provider's answer: paid; a card saved; a payment it has not confirmed yet, `checking`; or the form left open. */
  readonly done: (answer: "paid" | "saved" | "checking" | "open") => void;
  /** The paying button's words at rest, where the payment is named by the sheet's own; otherwise 支付 and the total. */
  readonly payWord?: string;
  /** What stands over the card's choice, drawn again once the provider's own total is read. */
  readonly head?: (total: PayForm["total"] | undefined) => readonly Child[];
};
/**
 * Where the form stands: in a step of ours over the window, with its title and 取消; or in a card of the page, whose own way back stands
 * beside it. A step holds the window while a payment confirms; a card's page is told, as `pressing`, to hold what would draw another form.
 */
export type FormPlace =
  | { readonly kind: "step"; readonly home: HTMLElement; readonly title: string; readonly back: () => void; readonly backWord?: string }
  | { readonly kind: "card"; readonly host: HTMLElement; readonly pressing: (on: boolean) => void };

/**
 * The card form, holding the payment provider's own fields, drawn by `/payment.js` alone, so the seller never leaves the page for a card.
 * It stands where `place` puts it: over the window, as 账单's pages open it, or in a card of a page, as the road's 订阅 holds it. Paying
 * offers the saved card first and another card under it. The provider's answer closes a step where it is accepted or left open, and the
 * form stays where the card is declined.
 */
export function cardForm(place: FormPlace, say: Say, opening: (secret: string) => Promise<PayForm>, ask: FormAsk): HTMLElement {
  // Until the provider's form is asked for, the box holds the fields' shape at their height; the provider's own loader draws in it after.
  const box = h("div", { class: "sw-card-box", role: "group", "aria-label": say("sw.cardFields"), tabindex: "0", "data-key": "card-box" }, fieldsShape(say("stream.loading")));
  let form: PayForm | undefined, secret: string | undefined, failed = false, other = ask.saved === undefined, bad = false, wait = true, pressed = false, shutting = false;
  const step = place.kind === "step";
  const shut = (after: () => void): void => { if (step) { shutting = true; (holder as HTMLDialogElement).close(); holder.remove(); } after(); };
  const radios = ask.saved === undefined ? [] : (([["saved", ask.savedName ?? ""], ["other", say("sw.cardOther")]] as const).map(([value, words]) => {
    const radio = h("input", { type: "radio", name: "card-which", value, "data-key": `card-which:${value}`, onchange: () => { other = value === "other"; bad = false; draw(`card-which:${value}`); } });
    return { value, radio, label: h("label", { class: "f-pick" }, radio, words) };
  }));
  const which = ask.saved !== undefined && h("div", { class: "sw-card-which", role: "radiogroup", "aria-label": say("sw.cardWhich") }, ...radios.map((one) => one.label));
  const unread = h("p", { class: "sw-card-bad", role: "alert", hidden: true }, say("sw.unread"));
  const declined = h("p", { class: "sw-card-bad", id: "sw-card-bad", role: "alert", hidden: true }, say("sw.cardDeclined"));
  const no = step ? h("button", { type: "button", class: "f-btn", "data-key": "card-no", onclick: () => shut(place.back) }, place.backWord ?? say("sw.cardCancel")) : undefined;
  const head = h("div", { class: "sw-card-head" });
  const yes = h("button", { type: "button", class: "f-btn primary", "data-key": "card-yes", onclick: () => { void submit(); } });
  const body = h("div", { class: "sw-card-body" }, ask.head !== undefined && head, which, unread, box, declined, h("div", { class: step ? "f-acts" : "row pl-card-acts" }, no, yes));
  const holder = step ? h("dialog", { class: "f-dialog sw-card", "aria-labelledby": "sw-card-title" }, h("h2", { id: "sw-card-title" }, place.title), body) : body;
  // Every node is built once and only its attributes and words change: the provider's fields live in a frame inside the box, and a
  // frame taken out of the page, even for a moment, loses what it holds.
  const draw = (focus?: string): void => {
    if (ask.head !== undefined) head.replaceChildren(...ask.head(form?.total).filter((one): one is HTMLElement => one instanceof HTMLElement));
    const said = bad ? "sw-card-bad" : undefined;
    for (const [node, describe] of [[box, said], ...(which ? [[which, other ? undefined : said] as const] : [])] as const) {
      if (describe === undefined) node.removeAttribute("aria-describedby"); else node.setAttribute("aria-describedby", describe);
    }
    for (const { value, radio } of radios) { radio.checked = (value === "other") === other; radio.disabled = wait; }
    unread.hidden = !failed;
    box.hidden = failed || !other;
    declined.hidden = !bad;
    if (no !== undefined) no.disabled = wait && form !== undefined;
    // A form that could not be opened has nothing to pay or save: it says it is unread, and a step offers only 取消.
    yes.hidden = failed;
    yes.disabled = wait || failed;
    // The button is at rest while the form opens; it turns only for a press, and then says it is being processed.
    yes.textContent = pressed ? say("sw.cardWait") : !ask.pays ? say("sw.cardSave") : ask.payWord ?? say("sw.cardPay", { amount: form?.total.text ?? ask.amount ?? "" });
    if (focus !== undefined) body.querySelector<HTMLElement>(`[data-key='${focus}']`)?.focus();
  };
  const submit = async (): Promise<void> => {
    if (form === undefined || secret === undefined) return;
    wait = true;
    pressed = true;
    bad = false;
    draw();
    if (place.kind === "card") place.pressing(true);
    ask.asking?.(secret);
    const answer: PayAnswer = await form.pay(other ? undefined : ask.saved?.id).catch((): PayAnswer => ({ state: "refused", code: "unavailable" }));
    wait = false;
    pressed = false;
    if (place.kind === "card") place.pressing(false);
    if (answer.state === "refused") { bad = true; draw(other ? "card-box" : "card-which:saved"); return; }
    // A form in a card is left as it stands: the page it is on moves on.
    if (!step) draw();
    shut(() => ask.done(answer.state));
  };
  if (place.kind === "step") {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : place.home;
    // The forms' dialog, held while a payment confirms: Escape or the dimmed page otherwise closes it, and that close is the way back.
    holder.addEventListener("close", () => { if (!shutting) { holder.remove(); place.back(); } });
    place.home.append(holder);
    draw();
    dialog(holder as HTMLDialogElement, no!, () => wait && form !== undefined)(opener);
  } else {
    place.host.append(holder);
    draw();
  }
  void (async () => {
    try {
      secret = await ask.secret;
      form = await opening(secret);
      // The provider draws into an empty box, and its loader takes the shape's place until its fields are in.
      box.replaceChildren();
      await form.mount(box);
      wait = false;
    } catch { failed = true; wait = false; box.replaceChildren(); }
    // A step takes the keyboard to what it asks; a card leaves it where the person is.
    draw(!step ? undefined : failed ? "card-no" : ask.saved !== undefined ? "card-which:saved" : "card-box");
  })();
  return holder;
}

/** The card form in a step of ours over the window. */
export const formStep = (home: HTMLElement, say: Say, opening: (secret: string) => Promise<PayForm>, { title, back, ...ask }: FormAsk & { readonly title: string; readonly back: () => void }): HTMLDialogElement =>
  cardForm({ kind: "step", home, title, back }, say, opening, ask) as HTMLDialogElement;
