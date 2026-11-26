import type { Dialog, DialogAnswer, Notice } from "../shared/dialog.js";
import type { Item } from "./stream-model.js";
import { h } from "./dom.js";
import { Waits } from "./waiting.js";
import type { StringKey } from "./strings.js";

export type DialogPorts = {
  readonly say: (key: StringKey) => string;
  /** Sends the person's answer; false when it did not reach pi, and the card takes another. */
  readonly answer: (id: string, answer: DialogAnswer) => Promise<boolean>;
  /**
   * The waits of the page that draws the card, so a card drawn anew while its answer goes is drawn as still sending. Without them the
   * card holds its own.
   */
  readonly waits?: Waits;
};

/**
 * A dialog as a card the person answers in place: a select's options each a button, an input's one field, an editor's text area; a
 * confirm is the yes-or-no card (`option-card.ts` `confirmCard`). The words are the package's own and are drawn as text. One answer
 * goes at a time; while it goes the card takes no other, and one that did not arrive is said under it with the card as the person left
 * it. Every dialog here can be skipped by its Skip, which pi reads as no answer. Escape is the page's, not the card's: while a turn runs
 * it is Stop, which lets each waiting question go unanswered before it stops the turn; at rest it does nothing to a card. `masked`
 * hides what is typed in an input, which only a provider's sign-in asks for.
 */
export function dialogCard(dialog: Dialog, ports: DialogPorts, masked = false): HTMLElement {
  const unsent = h("p", { class: "quiet dialog-unsent", role: "status", hidden: true }, ports.say("dialog.unsent"));
  const controls = h("fieldset", { class: "dialog-controls" });
  const key = `dialog ${dialog.id}`;
  let card!: HTMLElement;
  const waits = ports.waits ?? new Waits(() => card);
  // The answer's press turns, and every other press of the card is marked as taking none, and takes none: until the page lets a
  // taken answer's dialog go, or until one that did not reach pi gives the card back as the person left it.
  const send = (answer: DialogAnswer, pressed: HTMLElement): void => {
    if (waits.has(key)) return;
    unsent.hidden = true;
    void waits.run(key, () => ports.answer(dialog.id, answer).then((taken) => {
      if (taken) return "held";
      unsent.hidden = false;
      return undefined;
    }), undefined, pressed.dataset["answer"] ?? "");
    drawWaiting(card, waits);
  };
  // Each answer and the field have a place the page's redraw gives the keyboard back to.
  const button = (words: string, answer: DialogAnswer, which: string, primary = false): HTMLElement => {
    const press: HTMLElement = h("button", { type: "button", class: primary ? "primary" : undefined, "data-answer": which, "data-focus": `${key} ${which}`, onclick: () => send(answer, press) }, words);
    return press;
  };
  const skip = button(ports.say("dialog.skip"), { cancelled: true }, "skip");
  const sendPress = h("button", { type: "submit", class: "primary", "data-answer": "send", "data-focus": `${key} send` }, ports.say("composer.send"));
  const named = dialog.title === "" ? undefined : dialog.title;
  const field = dialog.method === "input" ? h("input", { type: masked ? "password" : "text", autocomplete: masked ? "off" : undefined, "aria-label": named, placeholder: dialog.placeholder, "data-focus": `${key} field` })
    : dialog.method === "editor" ? h("textarea", { "aria-label": named, rows: "6", "data-focus": `${key} field` }) : undefined;
  if (field !== undefined && dialog.method === "editor") field.value = dialog.prefill ?? "";
  if (dialog.method === "select") controls.append(h("div", { class: "dialog-options" }, ...dialog.options.map((option, n) => button(option, { value: option }, `option ${n}`))), h("div", { class: "dialog-acts" }, skip));
  else controls.append(field!, h("div", { class: "dialog-acts" }, sendPress, skip));
  card = h("form", { class: `dialog dialog-${dialog.method}`, "data-dialog": dialog.id, "data-method": dialog.method, "aria-label": named,
    onsubmit: (event) => { event.preventDefault(); if (field !== undefined) send({ value: field.value }, sendPress); } },
    dialog.title !== "" && h("p", { class: "dialog-title" }, dialog.title),
    controls, unsent);
  drawWaiting(card, waits);
  return card;
}

/** A dialog card's controls as its answer stands in `waits`: while one is out the pressed answer turns, and the rest and the field take none. */
function drawWaiting(card: HTMLElement, waits: Waits): void {
  const key = `dialog ${card.getAttribute("data-dialog") ?? ""}`;
  for (const one of card.querySelectorAll<HTMLElement>("button[data-answer], input, textarea")) {
    if (one.dataset["answer"] !== undefined && one.dataset["answer"] === waits.detail(key)) waits.ring(key, one);
    else waits.hold(key, one);
  }
}

/**
 * A question that let cx go, folded where its card stood, as a finished step is drawn: its title, then what went — the choice or the
 * words — or 未作答 where nothing did. It takes no press: an answer given later is a message. A confirm's fold is the yes-or-no card's rows.
 */
export function askedRecord(asked: Extract<Item, { kind: "asked" }>, say: (key: StringKey) => string): HTMLElement {
  const answer = asked.answer;
  const said = "value" in answer ? answer.value : undefined;
  return h("div", { class: "dialog-record", "data-dialog": asked.key.slice("asked-".length) },
    asked.title !== "" && h("span", { class: "dialog-title", dir: "auto" }, asked.title),
    said === undefined ? h("span", { class: "board-when" }, say("dialog.unanswered")) : h("span", { class: "board-said", dir: "auto" }, said));
}

/** A package's word to the person: one line, in the tone the package gave it, fading out as the time it stands for ends. */
export function noticeLine(notice: Notice, standsMs: number): HTMLElement {
  const line = h("p", { class: `dialog-notice ${notice.tone}`, role: notice.tone === "error" ? "alert" : "status", "data-notice": notice.id }, notice.message);
  // The pages' content security policy drops a style attribute and leaves the CSSOM alone.
  line.style.animationDuration = `${standsMs}ms`;
  return line;
}
