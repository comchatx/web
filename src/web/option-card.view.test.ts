// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import type { DialogAnswer } from "../shared/dialog.js";
import { CONFIRM_FORM, OPTION_FORM, confirmedValue, type OptionForm } from "../shared/option-form.js";
import { confirmCard, optionCard, type OptionCard, type YesNo } from "./option-card.js";
import { EMPTY, letGo, reduce, type StreamEvent, type StreamState } from "./stream-model.js";
import { StreamView, type StreamViewPorts } from "./stream-view.js";
import { hideTip } from "./forms.js";
import { text } from "./strings.js";

const say: StreamViewPorts["say"] = (key, values) => text("en", key, values);
const settle = async (): Promise<void> => { for (let round = 0; round < 10; round++) await Promise.resolve(); };
afterEach(() => { sessionStorage.clear(); });

const SHIP = { words: "How should this lot ship?", options: [{ name: "By sea", line: "About 35 days" }, { name: "By air", line: "About 8 days" }] };
const COLOURS = { words: "Which colours go in this lot?", several: true as const, options: [{ name: "Blue" }, { name: "Grey" }, { name: "Black" }] };
const HOUSE = { words: "Which warehouse?", options: [{ name: "East coast" }, { name: "West coast" }] };
const form = (...questions: OptionForm["questions"]): OptionForm => ({ form: OPTION_FORM, ask: "restock", questions });
const dialog = (shape: OptionForm, id = "d-1"): OptionCard => ({ id, method: "input", title: shape.questions[0]!.words, placeholder: JSON.stringify(shape), form: shape });

/** A card whose answers are written down, each waiting for the test to say whether pi took it. */
function card(shape: OptionForm, id = "d-1", going = new Set<string>(), account: string | null = "acct-a") {
  const sent: DialogAnswer[] = [];
  const taken: ((taken: boolean) => void)[] = [];
  const told: string[] = [];
  const element = optionCard(dialog(shape, id), { say, going, mac: false, account: () => account ?? undefined, told: (words) => told.push(words), answer: (_, answer) => { sent.push(answer); return new Promise((done) => { taken.push(done); }); } });
  document.body.replaceChildren(element);
  const button = (words: string): HTMLButtonElement => [...element.querySelectorAll("button")].find((one) => one.textContent?.startsWith(words) === true)!;
  const row = (name: string): HTMLInputElement => [...element.querySelectorAll<HTMLLabelElement>(".oc-row")].find((one) => one.textContent?.startsWith(name) === true)!.querySelector("input")!;
  const choose = (name: string): void => { row(name).click(); };
  const main = (): HTMLButtonElement => element.querySelector<HTMLButtonElement>("[data-main]")!;
  const title = (): string => element.querySelector(".dialog-title")!.textContent ?? "";
  return { element, sent, taken, told, button, row, choose, main, title, value: () => JSON.parse((sent[0] as { value: string }).value) as unknown };
}

it("draws a one-answer question as a ring a row, each with its line, a last row for the seller's own words, Skip and Submit taking no press until something is chosen", () => {
  const one = card(form(SHIP));
  expect(one.title()).toBe("How should this lot ship?");
  expect([...one.element.querySelectorAll(".oc-row")].map((row) => row.textContent)).toEqual(["By seaAbout 35 days", "By airAbout 8 days", "Another answer"]);
  expect([...one.element.querySelectorAll<HTMLInputElement>(".oc-row > input")].map((mark) => mark.type)).toEqual(["radio", "radio", "radio"]);
  expect(one.element.querySelector(".oc-pager")).toBeNull();
  expect([one.button("Skip").textContent, one.main().textContent, one.main().getAttribute("aria-disabled")]).toEqual(["Skip", "SubmitCtrl↵", "true"]);
  // The set's buttons, which `forms-frame.layout.ts` reads in Chrome by that class.
  expect([one.button("Skip").className, one.main().className]).toEqual(["f-btn", "f-btn primary"]);
  one.main().click();
  expect(one.sent).toEqual([]);
  one.choose("By sea"); one.choose("By air");
  expect([one.row("By sea").checked, one.row("By air").checked, one.main().getAttribute("aria-disabled")]).toEqual([false, true, null]);
  expect(one.sent).toEqual([]);
  one.main().click();
  expect(one.value()).toEqual({ form: OPTION_FORM, answers: [{ chosen: ["By air"] }] });
});

it("takes several answers in a box a row, in the card's order, and the seller's own words beside them, sent with Ctrl+Enter as with the button", () => {
  const one = card(form(COLOURS));
  expect([...one.element.querySelectorAll<HTMLInputElement>(".oc-row > input")].map((mark) => mark.type)).toEqual(["checkbox", "checkbox", "checkbox", "checkbox"]);
  one.choose("Grey"); one.choose("Blue"); one.choose("Black"); one.choose("Black");
  one.choose("Another answer");
  const own = one.element.querySelector<HTMLInputElement>(".oc-own")!;
  expect([own.getAttribute("aria-label"), document.activeElement]).toEqual(["Another answer to “Which colours go in this lot?”", own]);
  own.value = "  50 of the new green "; own.dispatchEvent(new Event("input"));
  one.element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
  expect(one.value()).toEqual({ form: OPTION_FORM, answers: [{ chosen: ["Blue", "Grey"], own: "50 of the new green" }] });
});

it("takes the seller's own words alone as a one-answer question's answer, the field's Enter sending, a chosen option given up for them", () => {
  const one = card(form(SHIP));
  one.choose("By sea");
  one.choose("Another answer");
  expect(one.row("By sea").checked).toBe(false);
  const own = one.element.querySelector<HTMLInputElement>(".oc-own")!;
  expect(one.main().getAttribute("aria-disabled")).toBe("true");
  own.value = "Air for 200 first"; own.dispatchEvent(new Event("input"));
  // Typing mends the main button and leaves the field the one being typed into.
  expect([one.main().getAttribute("aria-disabled"), one.element.querySelector(".oc-own")]).toEqual([null, own]);
  own.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  expect(one.value()).toEqual({ form: OPTION_FORM, answers: [{ chosen: [], own: "Air for 200 first" }] });
});

/** An input method's Enter as Safari reports it once the composition has ended: key code 229, not composing. */
const imeEnter = (init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, "keyCode", { value: 229 });
  return event;
};

it("leaves an input method's Enter, as Safari reports it, to the input method: in the own words' field and with Ctrl on the card, nothing goes", () => {
  const one = card(form(SHIP));
  one.choose("Another answer");
  const own = one.element.querySelector<HTMLInputElement>(".oc-own")!;
  own.value = "空运"; own.dispatchEvent(new Event("input"));
  own.dispatchEvent(imeEnter());
  own.dispatchEvent(imeEnter({ ctrlKey: true }));
  expect(one.sent).toEqual([]);
  own.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  expect(one.value()).toEqual({ form: OPTION_FORM, answers: [{ chosen: [], own: "空运" }] });
});

it("pages through several questions, keeps each one's answer going back, passes one with Skip, and sends them all with one Submit", () => {
  const one = card(form(SHIP, COLOURS, HOUSE));
  const at = (): string => one.element.querySelector(".oc-at")!.textContent ?? "";
  expect([at(), one.title(), one.main().textContent]).toEqual(["1 of 3", "Question 1 of 3: How should this lot ship?", "Next questionCtrl↵"]);
  const previous = one.element.querySelector<HTMLButtonElement>("[aria-label='Previous question']")!;
  expect(previous.getAttribute("aria-disabled")).toBe("true");
  one.choose("By air");
  one.main().click();
  expect([at(), one.sent]).toEqual(["2 of 3", []]);
  one.choose("Blue");
  one.element.querySelector<HTMLButtonElement>("[aria-label='Previous question']")!.click();
  expect([at(), one.row("By air").checked]).toEqual(["1 of 3", true]);
  one.element.querySelector<HTMLButtonElement>("[aria-label='Next question']")!.click();
  expect(one.row("Blue").checked).toBe(true);
  // Skip passes the question in front, whatever was chosen in it.
  one.button("Skip").click();
  expect([at(), one.main().textContent, one.main().getAttribute("aria-disabled")]).toEqual(["3 of 3", "SubmitCtrl↵", "true"]);
  one.choose("West coast");
  one.main().click();
  expect(one.sent).toHaveLength(1);
  expect(one.value()).toEqual({ form: OPTION_FORM, answers: [{ chosen: ["By air"] }, null, { chosen: ["West coast"] }] });
});

it("declines a card whose every question was skipped, and sends what was answered when the last is skipped", () => {
  const none = card(form(SHIP, HOUSE));
  none.button("Skip").click(); none.button("Skip").click();
  expect(none.sent).toEqual([{ cancelled: true }]);
  const some = card(form(SHIP, HOUSE), "d-2");
  some.choose("By sea"); some.main().click(); some.button("Skip").click();
  expect(some.value()).toEqual({ form: OPTION_FORM, answers: [{ chosen: ["By sea"] }, null] });
});

it("sends once: while the answer goes every press is off and the main button turns; one that did not reach pi gives the card back as left, saying so", async () => {
  const going = new Set<string>();
  const one = card(form(SHIP), "d-1", going);
  one.choose("By air");
  one.main().click(); one.main().click();
  one.element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }));
  expect(one.sent).toHaveLength(1);
  expect([one.main().className, one.main().getAttribute("aria-busy"), one.button("Skip").getAttribute("aria-disabled"), one.row("By sea").disabled, going.has("restock")]).toEqual(["f-btn oc-going", "true", "true", true, true]);
  one.button("Skip").click(); one.choose("By sea");
  expect([one.sent.length, one.row("By air").checked]).toEqual([1, true]);
  one.taken[0]!(false);
  await settle();
  expect([one.element.querySelector(".dialog-unsent")?.textContent, one.row("By air").checked, one.main().getAttribute("aria-disabled"), going.has("restock")]).toEqual(["Your answer was not sent.", true, null, false]);
  one.main().click();
  one.taken[1]!(true);
  await settle();
  expect([one.sent.length, one.told, going.has("restock")]).toEqual([2, ["Sent to cx"], true]);
});

it("keeps what was chosen in the tab by its asking: a card drawn again, as after a reload, shows it on the first page", () => {
  const before = card(form(SHIP, COLOURS));
  before.choose("By air"); before.main().click(); before.choose("Grey");
  before.choose("Another answer");
  const own = before.element.querySelector<HTMLInputElement>(".oc-own")!;
  own.value = "green"; own.dispatchEvent(new Event("input"));
  const after = card(form(SHIP, COLOURS), "d-9");
  expect([after.element.querySelector(".oc-at")!.textContent, after.row("By air").checked]).toEqual(["1 of 2", true]);
  after.main().click();
  expect([after.row("Grey").checked, after.element.querySelector<HTMLInputElement>(".oc-own")?.value]).toEqual([true, "green"]);
  after.main().click();
  expect(after.value()).toEqual({ form: OPTION_FORM, answers: [{ chosen: ["By air"] }, { chosen: ["Grey"], own: "green" }] });
  // What was kept goes with the answer pi took.
  after.taken[0]!(true);
  return settle().then(() => { expect(sessionStorage.length).toBe(0); });
});

it("keeps what was chosen under the account signed in: another account signing in on the tab finds none of it, and sends only its own", () => {
  const a = card(form(SHIP), "d-1", new Set(), "acct-a");
  a.choose("Another answer");
  const own = a.element.querySelector<HTMLInputElement>(".oc-own")!;
  own.value = "PRIVATE_A"; own.dispatchEvent(new Event("input"));
  const b = card(form(SHIP), "d-2", new Set(), "acct-b");
  expect([b.row("By sea").checked, b.row("By air").checked, b.row("Another answer").checked, b.element.querySelector(".oc-own")]).toEqual([false, false, false, null]);
  b.choose("By sea"); b.main().click();
  expect(b.value()).toEqual({ form: OPTION_FORM, answers: [{ chosen: ["By sea"] }] });
  // A, signing in again on the tab, finds what it chose.
  const again = card(form(SHIP), "d-3", new Set(), "acct-a");
  expect(again.element.querySelector<HTMLInputElement>(".oc-own")?.value).toBe("PRIVATE_A");
});

it("keeps nothing while no account is signed in", () => {
  const before = card(form(SHIP), "d-1", new Set(), null);
  before.choose("By air");
  expect(sessionStorage.length).toBe(0);
});

it("draws a question that takes no words of the seller's without the last row", () => {
  const one = card(form({ ...HOUSE, own: false }));
  expect([...one.element.querySelectorAll(".oc-row")].map((row) => row.textContent)).toEqual(["East coast", "West coast"]);
});

const E = "e".repeat(32);
const ask = (id: string, shape: OptionForm): StreamEvent => ({ event: "ui_request", data: { kind: "ui_request", id, body: { form: "ui_request", id, method: "input", title: shape.questions[0]!.words, placeholder: JSON.stringify(shape), timeout: 2 ** 31 - 1 } } });
const plain = (id: string): StreamEvent => ({ event: "ui_request", data: { kind: "ui_request", id, body: { form: "ui_request", id, method: "input", title: "Name the draft", placeholder: "listing-v2" } } });
const said = (seq: number, words: string): StreamEvent => ({ event: "entry", id: `${E}:${seq}`, data: { epoch: E, seq, body: { form: "message", role: "user", content: words } } });
const recorded = (seq: number, details: unknown): StreamEvent => ({ event: "entry", id: `${E}:${seq}`, data: { epoch: E, seq, body: { form: "custom_message", customType: "any-package", display: true, content: "The seller answered.", details } } });
const state = (...events: StreamEvent[]): StreamState => events.reduce(reduce, EMPTY);
const ports = (extra: Partial<StreamViewPorts> = {}): StreamViewPorts => ({ say, now: () => 0, day: () => "Today", answer: async () => true, account: () => "acct-a", ...extra });
const rows = (root: ParentNode): string[][] => [...root.querySelectorAll(".oc-done-row")].map((row) => [...row.children].map((one) => one.textContent ?? ""));

it("draws a dialog carrying the form as the option card at the foot of the conversation, and any other input as it was", () => {
  const page = new StreamView(ports()); document.body.replaceChildren(page.element);
  page.update(state({ event: "life", data: { kind: "life", epoch: E } }, said(1, "plan it"), ask("o-1", form(SHIP)), plain("d-1"), said(2, "and price it")));
  expect([...page.element.querySelectorAll(".stream-dialogs > .oc")].map((one) => one.getAttribute("data-dialog"))).toEqual(["o-1"]);
  const other = page.element.querySelector<HTMLElement>("[data-dialog='d-1']")!;
  expect([other.classList.contains("oc"), other.querySelector("input")!.placeholder, other.parentElement === page.element]).toEqual([false, "listing-v2", true]);
});

it("draws a card for the account the page is signed in as: what another account typed on the tab is not in it, nor in its answer", async () => {
  let account = "acct-a";
  const sent: DialogAnswer[] = [];
  const page = new StreamView(ports({ account: () => account, answer: async (_, answer) => { sent.push(answer); return true; } })); document.body.replaceChildren(page.element);
  const held = state({ event: "life", data: { kind: "life", epoch: E } }, ask("o-1", form(SHIP)));
  page.update(held);
  page.element.querySelector<HTMLLabelElement>(".oc-other .oc-row")!.click();
  const typed = page.element.querySelector<HTMLInputElement>(".oc-own")!;
  typed.value = "PRIVATE_A"; typed.dispatchEvent(new Event("input"));
  // The tab signs A out and B in: a new page, as after the reload, with the same asking.
  account = "acct-b";
  const next = new StreamView(ports({ account: () => account, answer: async (_, answer) => { sent.push(answer); return true; } })); document.body.replaceChildren(next.element);
  next.update(held);
  expect([next.element.querySelector(".oc-own"), next.element.textContent?.includes("PRIVATE_A")]).toEqual([null, false]);
  next.element.querySelector<HTMLInputElement>(".oc-row input")!.click();
  next.element.querySelector<HTMLButtonElement>("[data-main]")!.click();
  await settle();
  expect(sent.map((one) => JSON.parse((one as { value: string }).value) as unknown)).toEqual([{ form: OPTION_FORM, answers: [{ chosen: ["By sea"] }] }]);
});

it("leaves the rows of an answered card where it stood, as it was sent and then as its package recorded it, the own words first and a passed question unanswered", () => {
  const page = new StreamView(ports({ language: () => "zh" })); document.body.replaceChildren(page.element);
  let held = state({ event: "life", data: { kind: "life", epoch: E } }, said(1, "plan it"), ask("o-1", form(SHIP, COLOURS, HOUSE)));
  page.update(held);
  const value = { form: OPTION_FORM, answers: [{ chosen: ["By air"] }, { chosen: ["Blue", "Grey"], own: "green" }, null] };
  held = letGo(held, "o-1", { value: JSON.stringify(value) });
  page.update(held);
  expect(page.element.querySelector(".stream-dialogs > .oc")).toBeNull();
  const answered = [["How should this lot ship?", "By air"], ["Which colours go in this lot?", "green、Blue、Grey"], ["Which warehouse?", "Not answered"]];
  expect(rows(page.element)).toEqual(answered);
  held = reduce(held, recorded(2, { ...value, ask: "restock", questions: [SHIP, COLOURS, HOUSE].map(({ words }) => ({ words })) }));
  page.update(held);
  expect([page.element.querySelectorAll(".oc-done").length, rows(page.element)]).toEqual([1, answered]);
  expect(page.element.textContent).not.toContain("The seller answered.");
});

it("leaves every question unanswered for a declined card, and draws a record read after a reload as its rows", () => {
  const page = new StreamView(ports()); document.body.replaceChildren(page.element);
  const held = letGo(state({ event: "life", data: { kind: "life", epoch: E } }, ask("o-1", form(SHIP, HOUSE))), "o-1", { cancelled: true });
  page.update(held);
  expect(rows(page.element)).toEqual([["How should this lot ship?", "Not answered"], ["Which warehouse?", "Not answered"]]);
  const again = new StreamView(ports()); document.body.replaceChildren(again.element);
  again.update(state({ event: "life", data: { kind: "life", epoch: E } }, recorded(1, { form: OPTION_FORM, ask: "restock", questions: [{ words: "How should this lot ship?" }], answers: [{ chosen: ["By sea"] }] })));
  expect(rows(again.element)).toEqual([["How should this lot ship?", "By sea"]]);
});

/** A yes-or-no card whose answers are written down, each waiting for the test to say whether pi took it. */
function yesNo(asked: YesNo, mac = false) {
  const sent: DialogAnswer[] = [];
  const taken: ((taken: boolean) => void)[] = [];
  const told: string[] = [];
  const element = confirmCard(asked, { say, going: new Set(), mac, told: (words) => told.push(words), answer: (_, answer) => { sent.push(answer); return new Promise((done) => { taken.push(done); }); } });
  document.body.replaceChildren(element);
  const press = (which: "yes" | "no"): HTMLButtonElement => element.querySelector<HTMLButtonElement>(`[data-answer="${which}"]`)!;
  const key = (init: KeyboardEventInit): boolean => { const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }); press("no").dispatchEvent(event); return event.defaultPrevented; };
  return { element, sent, taken, told, press, key };
}
const PROPOSAL: YesNo = { id: "c-1", ask: "listing-1", title: "Publish this listing?", message: "It goes live on Amazon US." };

it("draws a proposal as the signed card: what is proposed on the band, what will happen under it, 否 and then 是 with its keys at the foot", () => {
  const one = yesNo(PROPOSAL, true);
  const names = [...one.element.querySelectorAll(".oc-foot > button")].map((button) => [button.getAttribute("data-answer"), button.firstChild?.textContent, button.querySelector(".oc-keys")?.textContent ?? null]);
  expect([one.element.querySelector(".oc-head > .dialog-title")?.textContent, one.element.querySelector(".oc-head + .dialog-message")?.textContent, names]).toEqual(["Publish this listing?", "It goes live on Amazon US.", [["no", "No", null], ["yes", "Yes", "⌘↵"]]]);
  expect([one.element.classList.contains("oc-confirm"), one.element.classList.contains("oc"), one.press("yes").getAttribute("aria-keyshortcuts"), one.element.getAttribute("aria-describedby")]).toEqual([true, true, "Meta+Enter", "ask-c-1-message"]);
  expect([one.press("no").className, one.press("yes").className], "the set's buttons").toEqual(["f-btn", "f-btn primary"]);
  const bare = yesNo({ id: "c-2", ask: "x", title: "Publish?" });
  expect([bare.element.querySelector(".dialog-message"), bare.element.hasAttribute("aria-describedby"), bare.press("yes").querySelector(".oc-keys")?.textContent]).toEqual([null, false, "Ctrl↵"]);
});

it("sends a proposal's answer as the form's value and a confirm pi waits on as pi's own, 否 as a no", () => {
  const proposal = yesNo(PROPOSAL);
  proposal.press("no").click();
  const awaited = yesNo({ id: "d-1", title: "Overwrite notes.md?" });
  awaited.press("yes").click();
  expect([proposal.sent, awaited.sent]).toEqual([[{ value: confirmedValue(false) }], [{ confirmed: true }]]);
});

it("draws a package's words as words, never as markup, and sends nothing on a submit alone, proposed or awaited", () => {
  const MARKUP = "<img src=x onerror=alert(1)><script>alert(1)</script><b>bold</b>";
  for (const asked of [{ id: "c-3", ask: "x", title: MARKUP, message: MARKUP }, { id: "d-3", title: MARKUP, message: MARKUP }] satisfies YesNo[]) {
    const one = yesNo(asked);
    const parts = [one.element.querySelector(".dialog-title")!, one.element.querySelector(".dialog-message")!];
    expect(parts.map((part) => [part.textContent, part.children.length])).toEqual([[MARKUP, 0], [MARKUP, 0]]);
    const submit = new Event("submit", { cancelable: true });
    one.element.dispatchEvent(submit);
    expect([submit.defaultPrevented, one.sent]).toEqual([true, []]);
  }
});

it("takes ⌘ or Ctrl and ↵ in the card as 是, and leaves Escape to the page as its Stop", () => {
  const one = yesNo(PROPOSAL);
  expect([one.key({ key: "Escape" }), one.sent]).toEqual([false, []]);
  expect([one.key({ key: "Enter" }), one.key({ key: "Enter", ctrlKey: true, isComposing: true }), one.sent]).toEqual([false, false, []]);
  expect([one.key({ key: "Enter", metaKey: true }), one.sent]).toEqual([true, [{ value: confirmedValue(true) }]]);
});

it("leaves an input method's ⌘ or Ctrl and ↵, as Safari reports it, to the input method on a yes-or-no card", () => {
  const one = yesNo(PROPOSAL);
  const event = imeEnter({ metaKey: true });
  one.press("no").dispatchEvent(event);
  expect([event.defaultPrevented, one.sent]).toEqual([false, []]);
});

it("turns the pressed button while the answer goes, the other taking no press, and gives the card back saying so when it did not reach pi", async () => {
  const one = yesNo(PROPOSAL);
  const look = (): unknown[] => [one.press("yes").className, one.press("yes").getAttribute("aria-busy"), one.press("no").getAttribute("aria-disabled"), one.element.querySelector(".dialog-unsent")?.textContent ?? null];
  one.press("yes").click();
  expect(look()).toEqual(["f-btn oc-going", "true", "true", null]);
  one.press("no").click();
  expect(one.sent).toHaveLength(1);
  one.taken[0]!(false);
  await settle();
  expect(look()).toEqual(["f-btn primary", null, null, "Your answer was not sent."]);
  one.press("no").click();
  one.taken[1]!(true);
  await settle();
  expect([one.sent, one.told]).toEqual([[{ value: confirmedValue(true) }, { value: confirmedValue(false) }], [say("board.handed")]]);
});

const proposed = (id: string, extra: Record<string, unknown> = {}): StreamEvent => ({ event: "ui_request", data: { kind: "ui_request", id, body: { form: "ui_request", id, method: "input", title: "Publish this listing?", placeholder: JSON.stringify({ form: CONFIRM_FORM, ask: "listing-1", title: "Publish this listing?", ...extra }), timeout: 2 ** 31 - 1 } } });
const confirmAsked = (id: string): StreamEvent => ({ event: "ui_request", data: { kind: "ui_request", id, body: { form: "ui_request", id, method: "confirm", title: "Overwrite notes.md?", message: "" } } });

it("stands a proposal at the foot with the option cards, past the turn's end, and leaves one row once answered, then its package's record in its place", () => {
  const page = new StreamView(ports({ language: () => "zh" })); document.body.replaceChildren(page.element);
  let held = state({ event: "life", data: { kind: "life", epoch: E } }, { event: "turn", data: { kind: "turn", running: true } }, said(1, "list it"), ask("o-1", form(SHIP)), proposed("c-1"), { event: "turn", data: { kind: "turn", running: false } });
  page.update(held);
  expect([...page.element.querySelectorAll(".stream-dialogs > .oc")].map((one) => [one.getAttribute("data-dialog"), one.classList.contains("oc-confirm")])).toEqual([["o-1", false], ["c-1", true]]);
  held = letGo(held, "c-1", { value: confirmedValue(true) });
  page.update(held);
  expect(rows(page.element)).toEqual([["Publish this listing?", "Yes"]]);
  held = reduce(held, recorded(2, { form: CONFIRM_FORM, ask: "listing-1", title: "Publish this listing?", confirmed: true }));
  page.update(held);
  expect([page.element.querySelectorAll(".oc-done").length, rows(page.element)]).toEqual([1, [["Publish this listing?", "Yes"]]]);
});

it("draws a confirm pi waits on as the same card where it was asked, and folds it to the same rows", () => {
  const page = new StreamView(ports()); document.body.replaceChildren(page.element);
  let held = state({ event: "life", data: { kind: "life", epoch: E } }, said(1, "save it"), confirmAsked("d-1"));
  page.update(held);
  const card = page.element.querySelector<HTMLElement>("[data-dialog='d-1']")!;
  expect([card.classList.contains("oc-confirm"), card.parentElement === page.element, page.element.querySelector(".stream-dialogs > .oc-confirm"), card.querySelector(".dialog-message")]).toEqual([true, true, null, null]);
  held = letGo(held, "d-1", { confirmed: false });
  page.update(held);
  expect(rows(page.element)).toEqual([["Overwrite notes.md?", "No"]]);
});


it("takes a pager's tip away when the card draws itself again, as a pick draws it, so no tip stands over a pager that has gone", () => {
  const two = card(form(SHIP, HOUSE));
  const shown = (): string | undefined => { const box = document.querySelector<HTMLElement>(".f-tip"); return box === null || box.hidden ? undefined : box.textContent ?? ""; };
  const next = (): HTMLElement => two.element.querySelector<HTMLElement>(".oc-pager button:last-child")!;
  next().dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
  expect(shown()).toBe("Next question");
  const before = next();
  two.choose("By sea");
  expect([before.isConnected, shown()]).toEqual([false, undefined]);
  hideTip();
});
