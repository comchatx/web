import type { Dialog, DialogAnswer } from "../shared/dialog.js";
import { answersValue, CONFIRM_FORM, confirmedValue, readAnswersValue, readConfirmedValue, type AskForm, type AskRecord, type OptionAnswer, type OptionForm } from "../shared/option-form.js";
import { fill, h } from "./dom.js";
import { hideTipWithin, tip } from "./forms.js";
import { icon } from "./spend-chart.js";
import type { StringKey } from "./strings.js";

type Say = (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;
export type OptionCard = Extract<Dialog, { method: "input" }> & { readonly form: OptionForm };

export type OptionPorts = {
  readonly say: Say;
  /** Sends the answer; false when it did not reach pi, and the card is given back as the seller left it. */
  readonly answer: (id: string, answer: DialogAnswer) => Promise<boolean>;
  /** The askings whose answer is on its way, kept by the page that draws the cards: a card asked again while its answer goes is drawn going. */
  readonly going: Set<string>;
  /** Tells a screen reader what became of a card that left. */
  readonly told: (words: string) => void;
  /** Whether the keys that press the main button are ⌘ and Enter, as on a Mac, or Ctrl and Enter. */
  readonly mac: boolean;
  /** The account the page is signed in as: what is chosen is kept under it, so another account on this tab finds none of it. */
  readonly account: () => string | undefined;
};

/** What the seller has chosen in a question: options by their place, and the last row's own words, which count while that row is chosen. */
type Picked = { picked: Set<number>; other: boolean; typed: string };

const KEPT = "cmx-ask:";
const keyOf = (account: string | undefined, ask: string): string | undefined => (account === undefined ? undefined : `${KEPT}${account}:${ask}`);

/** What was chosen in a card, kept in this tab by the account and the asking: a reload, or the card asked again, shows it on the first page. */
function kept(key: string | undefined, form: OptionForm): Picked[] {
  let read: unknown;
  try { read = key === undefined ? null : JSON.parse(sessionStorage.getItem(key) ?? "null"); } catch { read = null; }
  const rows = Array.isArray(read) ? read : [];
  return form.questions.map((question, at) => {
    const row: unknown = rows[at];
    const one = typeof row === "object" && row !== null ? row as { picked?: unknown; other?: unknown; typed?: unknown } : {};
    const picked = Array.isArray(one.picked) ? one.picked.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < question.options.length) : [];
    return { picked: new Set(question.several === true ? picked : picked.slice(0, 1)), other: one.other === true && question.own !== false, typed: typeof one.typed === "string" ? one.typed : "" };
  });
}

function keep(key: string | undefined, picks: readonly Picked[]): void {
  if (key === undefined) return;
  try { sessionStorage.setItem(key, JSON.stringify(picks.map((one) => ({ picked: [...one.picked], other: one.other, typed: one.typed })))); } catch { /* a tab that keeps nothing shows the card as asked */ }
}

/** Forgets what was chosen in a card that was answered. */
function forget(key: string | undefined): void {
  if (key === undefined) return;
  try { sessionStorage.removeItem(key); } catch { /* nothing was kept */ }
}

const wrote = (one: Picked): boolean => one.other && one.typed.trim() !== "";
const has = (one: Picked): boolean => one.picked.size > 0 || wrote(one);

/** A question's answer as it goes: the options chosen, by name in the card's order, and the seller's own words; null where it has neither. */
function answerOf(form: OptionForm, at: number, one: Picked): OptionAnswer {
  if (!has(one)) return null;
  const chosen = [...one.picked].sort((a, b) => a - b).map((n) => form.questions[at]!.options[n]!.name);
  return wrote(one) ? { chosen, own: one.typed.trim() } : { chosen };
}

/**
 * An option card: a package's question, or several, that cx does not wait on. The question stands at the head, with which one of how many
 * and the way to the one before and after where there are several; a row an option, a ring before it where one answer is taken and a box
 * where several are, its name and under it the package's line; a last row for the seller's own words, whose field stands under it once it
 * is chosen; at the foot Skip, which passes the question in front, and the main button with its keys, which goes on to the next question
 * and on the last page sends them all. Nothing goes before that one press; a card with nothing answered is declined.
 */
export function optionCard(dialog: OptionCard, ports: OptionPorts): HTMLElement {
  const { form } = dialog;
  const total = form.questions.length;
  const key = (): string | undefined => keyOf(ports.account(), form.ask);
  const picks = kept(key(), form);
  const id = `ask-${dialog.id}`;
  let at = 0;
  let unsent = false;
  const going = (): boolean => ports.going.has(form.ask);
  const last = (): boolean => at >= total - 1;
  const card = h("form", { class: "dialog dialog-select oc", "data-dialog": dialog.id, "data-ask": form.ask, "aria-labelledby": `${id}-title` });
  card.addEventListener("submit", (event) => event.preventDefault());
  card.addEventListener("keydown", (event) => {
    const key = event as KeyboardEvent;
    if (key.key === "Enter" && (key.ctrlKey || key.metaKey) && !key.isComposing && key.keyCode !== 229) { key.preventDefault(); go("main"); }
  });

  const focus = (name: string): void => { card.querySelector<HTMLElement>(`[data-focus="${id} ${name}"]`)?.focus(); };
  const redraw = (name?: string): void => {
    // A redraw the seller did not cause leaves the keyboard where it was in the card.
    const held = name ?? (card.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset["focus"]?.slice(id.length + 1) : undefined);
    draw();
    if (held !== undefined) focus(held);
  };
  const send = (answer: DialogAnswer, from: string): void => {
    if (going()) return;
    ports.going.add(form.ask);
    unsent = false;
    redraw(from);
    const answered = "value" in answer;
    void ports.answer(dialog.id, answer).then((taken) => {
      if (taken) { forget(key()); ports.told(ports.say(answered ? "board.handed" : "form.skipped")); return; }
      ports.going.delete(form.ask);
      unsent = true;
      redraw();
    });
  };
  const submit = (from: string): void => {
    const answers = form.questions.map((_, n) => answerOf(form, n, picks[n]!));
    send(answers.every((one) => one === null) ? { cancelled: true } : { value: answersValue(answers) }, from);
  };
  const turn = (by: number, from: string): void => {
    if (going()) return;
    at = Math.max(0, Math.min(at + by, total - 1));
    redraw(from);
  };
  function go(from: string): void {
    if (going() || !has(picks[at]!)) return;
    if (last()) submit(from); else turn(1, from);
  }
  const changed = (from: string): void => { keep(key(), picks); redraw(from); };
  const pick = (n: number): void => {
    if (going()) return;
    const one = picks[at]!;
    if (form.questions[at]!.several === true) { if (!one.picked.delete(n)) one.picked.add(n); }
    else { one.picked = new Set([n]); one.other = false; }
    changed(`o${n}`);
  };
  const pickOther = (on: boolean): void => {
    if (going()) return;
    const one = picks[at]!;
    one.other = on;
    if (on && form.questions[at]!.several !== true) one.picked = new Set();
    changed(on ? "own" : "other");
  };
  const skip = (): void => {
    if (going()) return;
    picks[at] = { picked: new Set(), other: false, typed: picks[at]!.typed };
    keep(key(), picks);
    if (!last()) turn(1, "skip"); else submit("skip");
  };

  const caps = (): HTMLElement => h("span", { class: "oc-keys", "aria-hidden": "true" }, ...(ports.mac ? ["⌘", "↵"] : ["Ctrl", "↵"]).map((cap) => h("kbd", {}, cap)));
  function draw(): void {
    const question = form.questions[at]!;
    const one = picks[at]!;
    const held = going();
    const off = (is: boolean): string | undefined => (is ? "true" : undefined);
    const move = (by: number, key: "ask.previous" | "ask.next", path: string, name: string): HTMLElement =>
      tip(h("button", { type: "button", class: "sw-close", "aria-disabled": off(held || at + by < 0 || at + by >= total), "data-focus": `${id} ${name}`, "aria-label": ports.say(key), onclick: () => turn(by, name) }, icon(path)), ports.say(key));
    const heading = h("p", { class: "dialog-title", id: `${id}-title`, dir: "auto" }, total > 1 && h("span", { class: "oc-said" }, `${ports.say("ask.positionSaid", { n: at + 1, total })} `), question.words);
    const kind = question.several === true ? "checkbox" : "radio";
    const mark = (checked: boolean, name: string, change: (event: Event) => void): HTMLInputElement => {
      const input = h("input", { type: kind, name: `${id}-${at}`, "data-focus": `${id} ${name}`, onchange: change });
      input.checked = checked;
      input.disabled = held;
      return input;
    };
    const rows = question.options.map((option, n) => h("label", { class: "oc-row" }, mark(one.picked.has(n), `o${n}`, () => pick(n)),
      h("span", { class: "oc-words", dir: "auto" }, h("b", {}, option.name), option.line !== undefined && h("small", {}, option.line))));
    let field: HTMLInputElement | undefined;
    if (question.own !== false && one.other) {
      const own = h("input", { type: "text", class: "oc-own", dir: "auto", autocomplete: "off", "data-focus": `${id} own`, "aria-label": ports.say("ask.otherNamed", { question: question.words }) });
      own.value = one.typed;
      own.disabled = held;
      own.addEventListener("input", () => {
        one.typed = own.value;
        keep(key(), picks);
        // Typing mends only what it changes outside the field, so the field keeps the keyboard and what is being typed.
        const main = card.querySelector("[data-main]");
        if (held || !has(one)) main?.setAttribute("aria-disabled", "true"); else main?.removeAttribute("aria-disabled");
      });
      own.addEventListener("keydown", (event) => {
        const key = event as KeyboardEvent;
        // An input method's Enter is its own: Safari ends the composition first and reports that Enter as 229, not as composing.
        if (key.key === "Enter" && !key.isComposing && key.keyCode !== 229 && !key.ctrlKey && !key.metaKey) { key.preventDefault(); go(last() ? "own" : "main"); }
      });
      field = own;
    }
    const other = question.own === false ? undefined : h("div", { class: "oc-other" },
      h("label", { class: "oc-row" }, mark(one.other, "other", (event) => pickOther((event.target as HTMLInputElement).checked)), h("span", { class: "oc-words" }, h("b", {}, ports.say("ask.other")))), field);
    const main = h("button", { type: "button", class: held ? "f-btn oc-going" : "f-btn primary", "data-main": "", "data-focus": `${id} main`, "aria-disabled": off(held || !has(one)), "aria-busy": off(held),
      "aria-keyshortcuts": ports.mac ? "Meta+Enter" : "Control+Enter", onclick: () => go("main") }, ports.say(last() ? "ask.submit" : "ask.next"), caps());
    // Who opens a float closes it: a pager's tip is closed before the pager is drawn again.
    hideTipWithin(card);
    fill(card,
      h("div", { class: "oc-head" }, heading, total > 1 && h("div", { class: "oc-pager" }, move(-1, "ask.previous", PREVIOUS, "previous"),
        h("span", { class: "oc-at", "aria-hidden": "true" }, ports.say("ask.position", { n: at + 1, total })), move(1, "ask.next", NEXT, "next"))),
      h("fieldset", { class: "dialog-controls" },
        h("div", { class: "oc-rows", role: question.several === true ? "group" : "radiogroup", "aria-labelledby": `${id}-title` }, ...rows, other),
        h("div", { class: "dialog-acts oc-foot" }, h("button", { type: "button", class: "f-btn", "aria-disabled": off(held), "data-focus": `${id} skip`, onclick: skip }, ports.say("dialog.skip")), main)),
      unsent && h("p", { class: "quiet dialog-unsent", role: "status" }, ports.say("dialog.unsent")));
  }
  draw();
  return card;
}

const PREVIOUS = "M10 4l-4 4 4 4";
const NEXT = "M6 4l4 4-4 4";

/** The rows an answered option card leaves, a question a row: its words, and under them its answers, the seller's own words first, or 未作答. */
export function optionRows(questions: readonly { readonly words: string }[], answers: readonly OptionAnswer[], say: Say, joiner: string): HTMLElement {
  return h("div", { class: "oc-done" }, ...questions.map((question, at) => {
    const answer = answers[at] ?? null;
    return h("div", { class: "oc-done-row" }, h("span", { class: "oc-done-q", dir: "auto" }, question.words),
      h("span", { class: "oc-done-a", dir: "auto" }, answer === null ? say("dialog.unanswered") : [...(answer.own === undefined ? [] : [answer.own]), ...answer.chosen].join(joiner)));
  }));
}

/** An option card's fold, before its package's record of it arrives: what 提交 sent, or every question 未作答 where the card was declined. */
export function foldedAnswers(form: OptionForm, answer: DialogAnswer): readonly OptionAnswer[] {
  const read = "value" in answer ? readAnswersValue(answer.value) : undefined;
  return read ?? form.questions.map(() => null);
}

/** A yes or a no as the rows a card left show it: one row, what was asked, and under it 是 or 否, or 未作答. */
const yesNo = (title: string, confirmed: boolean | undefined, say: Say): HTMLElement =>
  optionRows([{ words: title }], [confirmed === undefined ? null : { chosen: [say(confirmed ? "dialog.yes" : "dialog.no")] }], say, "");

/** The rows a card of either form left, before its package's record arrives: what was sent. */
export function formRows(form: AskForm, answer: DialogAnswer, say: Say, joiner: string): HTMLElement {
  if (form.form === CONFIRM_FORM) return yesNo(form.title, "value" in answer ? readConfirmedValue(answer.value) : undefined, say);
  return optionRows(form.questions, foldedAnswers(form, answer), say, joiner);
}

/** The rows a package's record of either form is drawn as. */
export function recordRows(record: AskRecord, say: Say, joiner: string): HTMLElement {
  return record.form === CONFIRM_FORM ? yesNo(record.title, record.confirmed, say) : optionRows(record.questions, record.answers, say, joiner);
}

/** A `confirm` pi waits on, folded: the same rows, from pi's own answer. */
export const confirmRows = (title: string, answer: DialogAnswer, say: Say): HTMLElement => yesNo(title, "confirmed" in answer ? answer.confirmed : undefined, say);

/** What a yes-or-no card asks: a package's proposal, under its asking, or a `confirm` pi waits on, under its dialog's id alone. */
export type YesNo = { readonly id: string; readonly title: string; readonly message?: string; readonly ask?: string };

/**
 * The confirm card: one thing proposed for a yes or a no. What is proposed stands on the band at the head, what will happen under it,
 * and at the foot 否 and then 是 with its keys, at the right. Nothing goes before one press; while it goes the pressed button turns and
 * the other takes none, and one that did not reach pi gives the card back, saying so. Escape is not the card's: it stays the page's Stop.
 */
export function confirmCard(asked: YesNo, ports: Omit<OptionPorts, "account">): HTMLElement {
  const key = asked.ask ?? `dialog ${asked.id}`;
  const id = `ask-${asked.id}`;
  let unsent = false;
  let pressed: "yes" | "no" | undefined;
  const going = (): boolean => ports.going.has(key);
  const card = h("form", { class: "dialog dialog-confirm oc oc-confirm", "data-dialog": asked.id, "data-method": "confirm", ...(asked.ask === undefined ? {} : { "data-ask": asked.ask }), "aria-labelledby": `${id}-title`,
    ...(asked.message === undefined ? {} : { "aria-describedby": `${id}-message` }) });
  card.addEventListener("submit", (event) => event.preventDefault());
  card.addEventListener("keydown", (event) => {
    const press = event as KeyboardEvent;
    if (press.key === "Enter" && (press.ctrlKey || press.metaKey) && !press.isComposing && press.keyCode !== 229) { press.preventDefault(); send(true); }
  });
  const send = (confirmed: boolean): void => {
    if (going()) return;
    ports.going.add(key);
    pressed = confirmed ? "yes" : "no";
    unsent = false;
    redraw();
    const answer: DialogAnswer = asked.ask === undefined ? { confirmed } : { value: confirmedValue(confirmed) };
    void ports.answer(asked.id, answer).then((taken) => {
      if (taken) { ports.told(ports.say("board.handed")); return; }
      ports.going.delete(key);
      unsent = true;
      redraw();
    });
  };
  // A redraw keeps the keyboard on the button it was on, where it was in the card.
  const redraw = (): void => {
    const on = card.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset["answer"] : undefined;
    draw();
    if (on !== undefined) card.querySelector<HTMLElement>(`[data-answer="${on}"]`)?.focus();
  };
  const caps = (): HTMLElement => h("span", { class: "oc-keys", "aria-hidden": "true" }, ...(ports.mac ? ["⌘", "↵"] : ["Ctrl", "↵"]).map((cap) => h("kbd", {}, cap)));
  function draw(): void {
    const held = going();
    const off = (is: boolean): string | undefined => (is ? "true" : undefined);
    const press = (which: "yes" | "no", primary: boolean): HTMLElement => h("button", { type: "button", class: held && pressed === which ? "f-btn oc-going" : primary ? "f-btn primary" : "f-btn", "data-answer": which,
      "aria-disabled": off(held), "aria-busy": off(held && pressed === which), ...(primary ? { "aria-keyshortcuts": ports.mac ? "Meta+Enter" : "Control+Enter" } : {}), onclick: () => send(which === "yes") },
      ports.say(which === "yes" ? "dialog.yes" : "dialog.no"), primary && caps());
    fill(card,
      h("div", { class: "oc-head" }, h("p", { class: "dialog-title", id: `${id}-title`, dir: "auto" }, asked.title)),
      asked.message !== undefined && h("p", { class: "dialog-message", id: `${id}-message`, dir: "auto" }, asked.message),
      h("fieldset", { class: "dialog-controls" }, h("div", { class: "dialog-acts oc-foot" }, press("no", false), press("yes", true))),
      unsent && h("p", { class: "quiet dialog-unsent", role: "status" }, ports.say("dialog.unsent")));
  }
  draw();
  return card;
}
