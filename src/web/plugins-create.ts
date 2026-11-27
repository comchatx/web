import type { Backend } from "./backend.js";
import { h, type Child } from "./dom.js";
import { dialog as modal } from "./forms.js";
import { cardShown, cardShut, markCut } from "./plugins-cards.js";
import { cardName, cardOf } from "./plugins-model.js";
import type { StringKey } from "./strings.js";
import { ringed } from "./waiting.js";

/** Create's upload card, by the name the address gives it. */
export const UPLOAD_CARD = cardName("upload", "t", "-");

/** What Create's card reads and does, given by the page that opens it. */
export type CreateContext = {
  readonly backend: Pick<Backend, "uploadPlugin">;
  readonly say: (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;
  /** Where the dialog is put while it is open. */
  readonly host: () => HTMLElement;
  /** Where the keyboard goes when a card closes: Create, as the page draws it then. */
  readonly returnTo: () => HTMLElement | null | undefined;
  /** An upload is in, under the name cx's computer lists it by: the page reads the world again and says so. */
  readonly uploaded: (name: string) => Promise<void>;
};

/**
 * One frame for Create's cards: the title, the form in the part that scrolls, and Cancel beside the act. The card stays open while
 * its press is out, since nothing on the page stands for what is being made: a refusal is a line in the card that stays until the next
 * press, with the keyboard back on the act. Escape, a click outside and an address that names the card no longer are Cancel, except
 * while the press is out. The address names the card while it is open: Back closes it and stays on the page, a reload opens it again;
 * closed, it takes its address with it.
 */
function frame(context: CreateContext, name: string, title: StringKey, body: readonly Child[], act: HTMLButtonElement, failed: StringKey, work: () => Promise<(() => Promise<void>) | undefined>): HTMLDialogElement {
  const dialog = h("dialog", { class: "f-dialog pl-card-dialog pl-tool-dialog", "aria-labelledby": "pl-card-title", tabindex: "-1", "data-card": name });
  const line = h("p", { class: "pl-failed pl-tool-failed", role: "alert" });
  let out = false;
  let settled = false;
  // Back closes the card on the page it stood over, where the keyboard goes back to Create as after Cancel.
  const left = (): void => { if (cardOf(globalThis.location?.hash ?? "") !== name && !out) { void close(); context.returnTo()?.focus?.(); } };
  const close = (): Promise<void> => {
    if (out || settled) return Promise.resolve();
    settled = true;
    globalThis.removeEventListener?.("hashchange", left);
    dialog.close?.();
    dialog.remove();
    return cardShut(name);
  };
  const cancel = h("button", { type: "button", class: "f-btn", onclick: () => { void close(); context.returnTo()?.focus?.(); } }, context.say("pl.c.cancel"));
  globalThis.addEventListener?.("hashchange", left);
  // Escape and a press on the dimmed page close the box, as Cancel does; neither while the press is out.
  dialog.addEventListener("close", () => { if (!settled) cancel.click(); });
  act.addEventListener("click", async () => {
    if (out || act.disabled) return;
    line.textContent = "";
    let after: (() => Promise<void>) | undefined;
    out = true;
    ringed(act, true);
    cancel.disabled = true;
    try { after = await work(); } catch { line.textContent = context.say(failed); }
    out = false;
    ringed(act, false);
    cancel.disabled = false;
    if (after === undefined) { if (line.textContent !== "") act.focus?.(); return; }
    await close();
    await after();
  });
  const middle = h("div", { class: "pl-card-body", tabindex: "-1" }, ...body);
  dialog.append(h("h2", { id: "pl-card-title", class: "pl-tool-title" }, context.say(title)), middle, line, h("div", { class: "f-acts pl-card-acts" }, cancel, act));
  context.host().append(dialog);
  modal(dialog, middle, () => out)(context.returnTo() ?? middle);
  cardShown(name);
  middle.focus?.({ preventScroll: true });
  markCut(middle);
  return dialog;
}

/**
 * Upload a plugin: a file or a link, either enough. With neither the card says so and keeps the keyboard in the link's field; with both,
 * both are handed over.
 */
export function uploadCard(context: CreateContext): HTMLDialogElement {
  const { say } = context;
  const file = h("input", { type: "file", accept: ".tgz,.zip" });
  const link = h("input", { type: "text", placeholder: say("pl.up.linkHint"), spellcheck: "false", autocomplete: "off" });
  const note = h("p", { class: "quiet pl-field-note", role: "status" });
  const clear = (): void => { note.textContent = ""; };
  file.addEventListener("change", clear);
  link.addEventListener("input", clear);
  const act = h("button", { type: "button", class: "f-btn primary" }, say("pl.up.go"));
  return frame(context, UPLOAD_CARD, "pl.up.title", [
    h("label", { class: "pl-field" }, h("span", {}, say("pl.up.file")), file),
    h("p", { class: "quiet pl-or" }, say("pl.up.or")),
    h("label", { class: "pl-field" }, h("span", {}, say("pl.up.link")), link),
    note,
    h("p", {}, say("pl.up.trust")),
    h("p", { class: "quiet" }, say("pl.up.only")),
  ], act, "pl.up.failed", async () => {
    const chosen = file.files?.[0];
    const where = link.value.trim();
    if (chosen === undefined && where === "") { note.textContent = say("pl.up.empty"); link.focus(); return undefined; }
    const name = await context.backend.uploadPlugin({ ...(chosen === undefined ? {} : { file: chosen }), ...(where === "" ? {} : { link: where }) });
    return () => context.uploaded(name);
  });
}
