// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import type { Dialog, DialogAnswer } from "../shared/dialog.js";
import { dialogCard, noticeLine } from "./dialog-card.js";
import { Waits } from "./waiting.js";
import { EMPTY, NOTICE_MS, closed, reduce, type StreamEvent, type StreamState } from "./stream-model.js";
import { StreamView, type StreamViewPorts } from "./stream-view.js";
import { text, type Language } from "./strings.js";

const say: StreamViewPorts["say"] = (key, values) => text("en", key, values);
const settle = async (): Promise<void> => { for (let round = 0; round < 10; round++) await Promise.resolve(); };
/** A card whose answers are written down, each waiting for the test to say whether the box took it. */
function card(dialog: Dialog) {
  const sent: DialogAnswer[] = [];
  const taken: ((taken: boolean) => void)[] = [];
  const element = dialogCard(dialog, { say, answer: (id, answer) => { expect(id).toBe(dialog.id); sent.push(answer); return new Promise((done) => { taken.push(done); }); } });
  // A form outside the document is not submitted by its button.
  document.body.replaceChildren(element);
  const buttons = (): HTMLButtonElement[] => [...element.querySelectorAll("button")];
  return { element, sent, taken, buttons, press: (words: string) => buttons().find((button) => button.textContent === words)!.click(), names: () => buttons().map((button) => button.textContent) };
}

it("draws a select as its title and one button a choice, answered with the choice pressed, and skipped as no answer", () => {
  const select = card({ id: "d", method: "select", title: "Allow this command?", options: ["Allow", "Block"] });
  expect(select.element.querySelector(".dialog-title")?.textContent).toBe("Allow this command?");
  expect(select.names()).toEqual(["Allow", "Block", "Skip"]);
  select.press("Block");
  expect(select.sent).toEqual([{ value: "Block" }]);
  const skipped = card({ id: "d", method: "select", title: "Allow this command?", options: ["Allow", "Block"] });
  skipped.press("Skip");
  expect(skipped.sent).toEqual([{ cancelled: true }]);
});

it("draws an input as one field and an editor as a text area holding what the package put in it, each sent as the person left it", () => {
  const input = card({ id: "d", method: "input", title: "Name the draft", placeholder: "listing-v2" });
  const field = input.element.querySelector("input")!;
  expect([field.type, field.placeholder, field.getAttribute("aria-label"), input.element.querySelectorAll("input, textarea").length, input.names()]).toEqual(["text", "listing-v2", "Name the draft", 1, ["Send", "Skip"]]);
  field.value = "spring listing";
  // Enter in the field sends, as the button does.
  input.element.dispatchEvent(new Event("submit", { cancelable: true }));
  expect(input.sent).toEqual([{ value: "spring listing" }]);
  const editor = card({ id: "d", method: "editor", title: "Edit the reply", prefill: "Dear buyer,\n" });
  const area = editor.element.querySelector("textarea")!;
  expect([area.value, editor.element.querySelectorAll("input, textarea").length]).toEqual(["Dear buyer,\n", 1]);
  area.value = "Dear buyer,\nIt ships Monday.";
  editor.press("Send");
  expect(editor.sent).toEqual([{ value: "Dear buyer,\nIt ships Monday." }]);
  const skipped = card({ id: "d", method: "editor", title: "Edit the reply" });
  skipped.press("Skip");
  expect(skipped.sent).toEqual([{ cancelled: true }]);
});

it("takes one answer at a time, turning the pressed answer while the rest take none, and says under the card when one did not get there, with the card as the person left it", async () => {
  const input = card({ id: "d", method: "input", title: "Name the draft" });
  const field = input.element.querySelector("input")!;
  const [send, skip] = input.buttons() as [HTMLButtonElement, HTMLButtonElement, ...HTMLButtonElement[]];
  const unsent = input.element.querySelector<HTMLElement>(".dialog-unsent")!;
  // The pressed answer's ring and name, the other press's mark, whether the field takes typing, and the line under the card.
  const state = () => [send.getAttribute("aria-busy"), send.querySelector(".pl-spin") !== null, send.getAttribute("aria-label"), skip.getAttribute("aria-disabled"), field.readOnly, unsent.hidden];
  field.value = "spring listing";
  expect(state()).toEqual([null, false, null, null, false, true]);
  input.press("Send");
  expect(state()).toEqual(["true", true, "Send", "true", true, true]);
  // While it goes, neither press is a second answer.
  skip.click();
  input.element.dispatchEvent(new Event("submit", { cancelable: true }));
  expect(input.sent.length).toBe(1);
  input.taken[0]!(false);
  await settle();
  expect([...state(), unsent.textContent, field.value, send.textContent]).toEqual([null, false, null, null, false, false, "Your answer was not sent.", "spring listing", "Send"]);
  input.press("Send");
  expect(state()).toEqual(["true", true, "Send", "true", true, true]);
  input.taken[1]!(true);
  await settle();
  // Taken: the card stays as it was sent until the page lets its dialog go.
  expect([...state(), input.sent.length]).toEqual(["true", true, "Send", "true", true, true, 2]);
});

it("leaves Escape to the page on a select, input or editor card: the card itself answers nothing to it, and only its Skip skips", () => {
  const press = (target: Element): boolean => { const key = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }); target.dispatchEvent(key); return key.defaultPrevented; };
  const editor = card({ id: "d", method: "editor", title: "Edit the reply", prefill: "Dear buyer," });
  const input = card({ id: "i", method: "input", title: "Name the draft" });
  const select = card({ id: "s", method: "select", title: "Which listing?", options: ["US", "DE"] });
  expect([press(editor.element.querySelector("textarea")!), press(input.element.querySelector("input")!), press(select.element.querySelector("button")!), editor.sent, input.sent, select.sent]).toEqual([false, false, false, [], [], []]);
});

it("names a field by its dialog's title, and gives one with no title no empty name", () => {
  expect(card({ id: "d", method: "input", title: "" }).element.querySelector("input")!.hasAttribute("aria-label")).toBe(false);
  const untitled = card({ id: "d", method: "editor", title: "" });
  expect([untitled.element.querySelector("textarea")!.hasAttribute("aria-label"), untitled.element.hasAttribute("aria-label"), untitled.element.querySelector(".dialog-title")]).toEqual([false, false, null]);
  expect(card({ id: "d", method: "input", title: "Name the draft" }).element.getAttribute("aria-label")).toBe("Name the draft");
});

it("draws a package's words as words, never as markup", () => {
  const select = card({ id: "d", method: "select", title: "<img src=x onerror=alert(1)>", options: ["<b>bold</b>"] });
  expect([select.element.querySelector("img"), select.element.querySelector("b")]).toEqual([null, null]);
  expect(select.element.querySelector(".dialog-title")?.textContent).toBe("<img src=x onerror=alert(1)>");
  expect(noticeLine({ id: "n", method: "notify", message: "<i>fyi</i>", tone: "info" }, NOTICE_MS).querySelector("i")).toBeNull();
  const MARKUP = '<img src=x onerror=alert(1)><script>alert(1)</script><b>bold</b>';
  const editor = card({ id: "d", method: "editor", title: MARKUP, prefill: MARKUP });
  const input = card({ id: "d", method: "input", title: MARKUP, placeholder: MARKUP });
  for (const drawn of [editor, input]) expect(drawn.element.querySelectorAll("img, script, b")).toHaveLength(0);
  expect([editor.element.querySelector("textarea")!.value, editor.element.querySelector("textarea")!.children.length]).toEqual([MARKUP, 0]);
  expect(input.element.querySelector("input")!.placeholder).toBe(MARKUP);
});

it("draws a notice as one line in its tone, announced at once when it is an error, fading over the time it stands", () => {
  const info = noticeLine({ id: "n1", method: "notify", message: "Listing saved to drafts.", tone: "info" }, 8_000);
  const error = noticeLine({ id: "n2", method: "notify", message: "The listing was not saved.", tone: "error" }, 8_000);
  expect([info.textContent, info.getAttribute("role"), info.classList.contains("info"), info.style.animationDuration]).toEqual(["Listing saved to drafts.", "status", true, "8000ms"]);
  expect([error.getAttribute("role"), error.classList.contains("error")]).toEqual(["alert", true]);
});

const E = "e".repeat(32);
const ask = (id: string, body: Record<string, unknown>): StreamEvent => ({ event: "ui_request", data: { kind: "ui_request", id, body: { form: "ui_request", id, ...body } } });
const said = (seq: number, words: string): StreamEvent => ({ event: "entry", id: `${E}:${seq}`, data: { epoch: E, seq, body: { form: "message", role: "user", content: words } } });
const state = (...events: StreamEvent[]): StreamState => events.reduce(reduce, EMPTY);
const ports = (extra: Partial<StreamViewPorts> = {}): StreamViewPorts => ({ say, now: () => 0, day: () => "Today", answer: async () => true, ...extra });
const order = (page: StreamView): string[] => [...page.element.children].map((child) => (child instanceof HTMLElement && child.dataset["dialog"] !== undefined ? `dialog ${child.dataset["dialog"]}` : child.classList.contains("item") ? `item ${child.textContent.trim()}` : child.className))
  .filter((name) => name.startsWith("item") || name.startsWith("dialog") || name === "stream-dialogs" || name === "stream-tail");

it("draws what a package asks where it was asked, in the order asked, what comes after it below it, and what was said in passing after the last item", () => {
  const page = new StreamView(ports()); document.body.replaceChildren(page.element);
  let held = state({ event: "life", data: { kind: "life", epoch: E } }, said(1, "list it"), ask("d-1", { method: "confirm", title: "Overwrite?", message: "notes.md already exists." }), ask("n-1", { method: "notify", message: "Draft saved." }), ask("d-2", { method: "input", title: "Name the draft" }));
  page.update(held);
  expect(order(page)).toEqual(["item list it", "dialog d-1", "dialog d-2", "stream-dialogs", "stream-tail"]);
  expect([...page.element.querySelectorAll(".stream-dialogs > *")].map((one) => `notice ${one.getAttribute("data-notice")}`)).toEqual(["notice n-1"]);
  // A conversation is in the order things were said: what comes after a question stands below it.
  held = reduce(held, said(2, "and price it"));
  page.update(held);
  expect(order(page)).toEqual(["item list it", "dialog d-1", "dialog d-2", "item and price it", "stream-dialogs", "stream-tail"]);
});

it("keeps a card the page still holds as the person left it — the text typed, the caret's field — through every redraw, and takes away the one let go", () => {
  const sent: unknown[] = [];
  const page = new StreamView(ports({ answer: async (id, answer) => { sent.push([id, answer]); return true; } })); document.body.replaceChildren(page.element);
  let held = state({ event: "life", data: { kind: "life", epoch: E } }, said(1, "list it"), ask("d-1", { method: "input", title: "Name the draft" }), ask("d-2", { method: "confirm", title: "Overwrite?", message: "" }));
  page.update(held);
  const field = page.element.querySelector<HTMLInputElement>("[data-dialog='d-1'] input")!;
  field.focus(); field.value = "spring li";
  held = reduce(reduce(held, said(2, "and price it")), ask("d-3", { method: "select", title: "Which?", options: ["a"] }));
  page.update(held);
  // A card in its place is not put in again: a browser takes the focus from a node it moves.
  const cards = page.element.querySelector(".stream-dialogs")!;
  const moved = [vi.spyOn(cards, "insertBefore"), vi.spyOn(page.element, "insertBefore")];
  page.update(held);
  expect(moved.map((spy) => spy.mock.calls.length)).toEqual([0, 0]);
  expect([page.element.querySelector("[data-dialog='d-1'] input"), document.activeElement, field.value]).toEqual([field, field, "spring li"]);
  // The answer goes through the page's port with the card's id.
  page.element.querySelector<HTMLElement>("[data-dialog='d-2'] [data-answer='yes']")!.click();
  expect(sent).toEqual([["d-2", { confirmed: true }]]);
  held = closed(held, "d-2");
  page.update(held);
  expect([...page.element.querySelectorAll("[data-dialog]")].map((one) => one.getAttribute("data-dialog"))).toEqual(["d-1", "d-3"]);
  expect([page.element.querySelector("[data-dialog='d-1'] input"), document.activeElement]).toEqual([field, field]);
  // The same id asked again after it was let go is a new card, empty.
  held = reduce(closed(held, "d-1"), ask("d-1", { method: "input", title: "Name the draft" }));
  page.update(held);
  expect(page.element.querySelector<HTMLInputElement>("[data-dialog='d-1'] input")!.value).toBe("");
  page.reset(); page.update(EMPTY);
  expect(page.element.querySelectorAll("[data-dialog], [data-notice]")).toHaveLength(0);
});

it("draws the cards it holds again in the new language when the language changes, and what was typed in them goes", () => {
  let language: Language = "en";
  const page = new StreamView(ports({ say: (key, values) => text(language, key, values) })); document.body.replaceChildren(page.element);
  const held = state({ event: "life", data: { kind: "life", epoch: E } }, ask("d-1", { method: "confirm", title: "Overwrite?", message: "" }), ask("d-2", { method: "input", title: "Name the draft" }));
  page.update(held);
  // A button's name, without the keys drawn on it.
  const names = (): string[] => [...page.element.querySelectorAll(".dialog button")].map((button) => button.firstChild?.textContent ?? "");
  expect(names()).toEqual(["No", "Yes", "Send", "Skip"]);
  page.element.querySelector<HTMLInputElement>("[data-dialog='d-2'] input")!.value = "spring li";
  language = "zh";
  page.reset(); page.update(held);
  expect(names()).toEqual((["dialog.no", "dialog.yes", "composer.send", "dialog.skip"] as const).map((key) => text("zh", key)));
  expect(page.element.querySelector<HTMLInputElement>("[data-dialog='d-2'] input")!.value).toBe("");
});

it("draws no dialog on a page that could not answer it, and a notice all the same", () => {
  const page = new StreamView({ say, now: () => 0, day: () => "Today" });
  page.update(state({ event: "life", data: { kind: "life", epoch: E } }, ask("d-1", { method: "confirm", title: "Overwrite?", message: "" }), ask("n-1", { method: "notify", message: "Draft saved." })));
  expect([page.element.querySelectorAll("[data-dialog]").length, page.element.querySelector("[data-notice]")?.textContent]).toEqual([0, "Draft saved."]);
});

it("draws a message Send to cx sent as its entries and sentences, named by its sentences, and any other message as before", () => {
  const under = vi.fn((message: { words: () => string }) => Object.assign(document.createElement("div"), { className: "row", textContent: message.words() }));
  const rows = { board: (pairs: readonly { said: string }[]) => Object.assign(document.createElement("div"), { className: "board-sent", textContent: pairs.map((pair) => pair.said).join("|") }), quoted: () => undefined, filed: () => undefined, under, waiting: under };
  const page = new StreamView(ports({ rows })); document.body.replaceChildren(page.element);
  page.update(state({ event: "life", data: { kind: "life", epoch: E } }, said(1, "<board file=\"a.md\" modified=\"1\">Price</board>\nGo ahead.\n\n<board file=\"b.md\" modified=\"2\">Colour</board>\nBlue"), said(2, "<board file=\"a.md\" modified=\"1\">only a marker</board>")));
  const items = [...page.element.querySelectorAll<HTMLElement>(".item.user")];
  expect(items.map((one) => [one.querySelector(".board-sent")?.textContent, one.querySelector(".row")?.textContent])).toEqual([["Go ahead.|Blue", "Go ahead.\nBlue"], [undefined, "<board file=\"a.md\" modified=\"1\">only a marker</board>"]]);
});

it("draws a card drawn anew while its answer goes as sending, from the page's waits, and gives the card as it stands back whole when the answer is refused", async () => {
  const dialog: Dialog = { id: "d", method: "input", title: "Name?" };
  const box = document.createElement("div");
  document.body.replaceChildren(box);
  const waits = new Waits(() => box);
  const refused = Promise.withResolvers<boolean>();
  const sent: DialogAnswer[] = [];
  const draw = (): HTMLElement => { const element = dialogCard(dialog, { say, answer: (_id, answer) => { sent.push(answer); return refused.promise; }, waits }); box.replaceChildren(element); return element; };
  const first = draw();
  first.querySelector<HTMLInputElement>("input")!.value = "Ada";
  first.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
  const next = draw();
  const looks = (card: HTMLElement) => [card.querySelector("input")!.readOnly, ...[...card.querySelectorAll("button")].map((one) => [one.getAttribute("aria-busy"), one.getAttribute("aria-disabled")])];
  expect(looks(next)).toEqual([true, ["true", "true"], [null, "true"]]);
  next.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
  expect(sent).toEqual([{ value: "Ada" }]);
  refused.resolve(false);
  await settle();
  expect(looks(next)).toEqual([false, [null, null], [null, null]]);
});
