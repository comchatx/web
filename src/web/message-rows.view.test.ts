// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageRows, stopIcon, type MessageRowsPorts, type RowOf } from "./message-rows.js";
import { QuoteBox } from "./quote-box.js";
import { markWords, QuotePick, selected, wordsIn } from "./quote-pick.js";
import { opening, type Held, type Quote } from "./quote.js";
import { text } from "./strings.js";

const EPOCH = "e".repeat(32);
const TIME = new Date(2026, 8, 14, 10, 12).getTime();

function rows(extra: Partial<MessageRowsPorts> = {}): { readonly rows: MessageRows; readonly ports: { [K in "quote" | "jump" | "copy" | "announce" | "cancel" | "sendNow"]: ReturnType<typeof vi.fn> }; readonly timers: (() => void)[] } {
  const ports = { quote: vi.fn(), jump: vi.fn(), copy: vi.fn(), announce: vi.fn(), cancel: vi.fn(), sendNow: vi.fn() };
  const timers: (() => void)[] = [];
  return { rows: new MessageRows({ say: (key, values) => text("en", key, values), clock: () => "10:12", fullDate: () => "Sep 14, 2026, 10:12", said: () => ({ when: "Mon, Sep 14, 10:12" }), saidFar: async () => undefined, grew: () => undefined, later: (_, then) => { timers.push(then); }, ...ports, ...extra }), ports, timers };
}
const yours = (extra: Partial<RowOf> = {}): RowOf => ({ who: "you", key: `${EPOCH}:12`, entryId: "a1b2c3d4", time: TIME, words: () => "How many days of stock are left?", first: true, ...extra });
const cxs = (extra: Partial<RowOf> = {}): RowOf => ({ who: "cx", key: `${EPOCH}:14`, entryId: "0f9e8d7c", time: TIME, words: () => "412 units are available.", first: true, ...extra });
/** What the set's tip says over a control a pointer rests on, and that no screen reader hears it. */
const tipOf = (control: Element): readonly (string | undefined)[] => {
  control.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
  const tip = document.querySelector<HTMLElement>(".f-tip");
  const read = tip === null || tip.hidden ? [] : [tip.getAttribute("aria-hidden") ?? undefined, tip.textContent ?? undefined];
  control.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
  return read;
};
/** What each thing in a row reads as: a control's name, or the words shown, less the word over them. */
const labels = (row: HTMLElement): readonly string[] => [...row.children].map((child) => (child instanceof HTMLButtonElement ? child.getAttribute("aria-label") ?? "" : child.firstChild?.textContent ?? ""));
const key = (target: HTMLElement, name: string, more: KeyboardEventInit = {}): KeyboardEvent => { const event = new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...more }); target.dispatchEvent(event); return event; };
/** A message's article in the page, with what the rows drew in it. */
function article(...children: readonly (HTMLElement | undefined)[]): HTMLElement {
  const holder = document.createElement("article");
  holder.append(...children.filter((child): child is HTMLElement => child !== undefined));
  document.body.append(holder);
  return holder;
}

afterEach(() => { document.body.replaceChildren(); });

describe("the mark of the control that stops cx", () => {
  it("is a filled square in a ring of its own, both centred in the mark: the ring is an outline round the square, whose side is over a third of the mark's", () => {
    const mark = stopIcon();
    const [ring, square, ...more] = [...mark.querySelectorAll("path")];
    expect([more, ring!.getAttribute("class"), square!.getAttribute("class"), mark.getAttribute("viewBox")]).toEqual([[], null, "solid", "0 0 24 24"]);
    const [, x, y, side] = /^M([\d.]+) ([\d.]+)h([\d.]+)v\3h-\3z$/.exec(square!.getAttribute("d")!)!.map(Number);
    expect([x, y]).toEqual([(24 - side!) / 2, (24 - side!) / 2]);
    expect(side).toBeGreaterThan(8 - 0.001);
    const [, cx, top, radius] = /^M([\d.]+) ([\d.]+)a([\d.]+) \3 0 1 0 0 [\d.]+a\3 \3 0 1 0 0-[\d.]+z$/.exec(ring!.getAttribute("d")!)!.map(Number);
    expect([cx, top! + radius!]).toEqual([12, 12]);
    // The ring clears the square's corners.
    expect(radius!).toBeGreaterThan((side! / 2) * Math.SQRT2 + 1.7);
  });
});

describe("what a message cx has not read carries under it", () => {
  it("is Cancel and edit message and, only while a turn runs, Send now, each a mark with its word over it in both languages, named by the glossary's words and its message's opening words, and asks the page for what it says", () => {
    const { rows: drawn, ports } = rows();
    const both = drawn.waiting({ key: "sent-3", now: true, cancel: true, words: () => "Keep it short, and cite the rows you read from." });
    expect(both.className).toBe("actions wait-actions");
    const [cancel, now, ...more] = [...both.querySelectorAll("button")];
    expect(more).toEqual([]);
    expect([cancel!.getAttribute("aria-label"), cancel!.hasAttribute("title"), tipOf(cancel!), cancel!.querySelectorAll("svg.icon[aria-hidden=true] path").length]).toEqual(["Cancel and edit message “Keep it short, and cite the…”", false, ["true", "Cancel and edit message"], 2]);
    // Send now is an arrow rising to a bar.
    expect([now!.getAttribute("aria-label"), now!.hasAttribute("title"), tipOf(now!), [...now!.querySelectorAll("svg.icon path")].map((path) => path.getAttribute("d"))]).toEqual(["Send now “Keep it short, and cite the…”", false, ["true", "Send now"], ["M6 4.5h12", "M12 20V9", "M7.5 13.5L12 9l4.5 4.5"]]);
    cancel!.click();
    expect([ports.cancel.mock.calls, ports.sendNow.mock.calls]).toEqual([[["sent-3"]], []]);
    now!.click();
    expect(ports.sendNow.mock.calls).toEqual([[]]);
    const alone = drawn.waiting({ key: "sent-4", now: false, cancel: true, words: () => "And the logs." });
    expect([...alone.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"))).toEqual(["Cancel and edit message “And the logs.”"]);
    // Out of the platform's reach, a message the box already passed on can be neither taken back nor read now: it carries nothing.
    const held = drawn.waiting({ key: "sent-6", now: false, cancel: false, words: () => "And the logs." });
    expect([held.className, held.querySelectorAll("button").length]).toEqual(["actions wait-actions", 0]);
    // A message of quotes alone has no words to be named by: the glossary's stand alone.
    const wordless = drawn.waiting({ key: "sent-5", now: true, cancel: true, words: () => "" });
    expect([...wordless.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"))).toEqual(["Cancel and edit message", "Send now"]);
    const zh = new MessageRows({ ...drawn.ports, say: (key, values) => text("zh", key, values) }).waiting({ key: "sent-3", now: true, cancel: true, words: () => "简短一点" });
    expect([...zh.querySelectorAll("button")].map((button) => [button.getAttribute("aria-label"), tipOf(button)[1]])).toEqual([["撤回并编辑消息“简短一点”", text("zh", "stream.cancelEdit")], ["立即发送“简短一点”", "立即发送"]]);
  });

  it("presses once under a key held down: the repeats of the key that pressed a control are not its presses, for the focus has gone to the message box by then", () => {
    const { rows: drawn } = rows();
    const both = drawn.waiting({ key: "sent-3", now: true, cancel: true, words: () => "Keep it short." });
    for (const button of both.querySelectorAll("button")) {
      expect(["Enter", " "].map((pressed) => [key(button, pressed).defaultPrevented, key(button, pressed, { repeat: true }).defaultPrevented])).toEqual([[false, true], [false, true]]);
    }
  });

  it("takes one press of a double-click, and takes back no second message for a moment after one: the next one waiting has moved up under the pointer by then", () => {
    const { rows: drawn, ports, timers } = rows();
    const first = drawn.waiting({ key: "sent-3", now: true, cancel: true, words: () => "Keep it short." });
    const second = drawn.waiting({ key: "sent-4", now: true, cancel: true, words: () => "Add a title." });
    const click = (button: Element, detail: number): void => { button.dispatchEvent(new MouseEvent("click", { detail, bubbles: true, cancelable: true })); };
    const down = (button: Element, detail: number): boolean => { const event = new MouseEvent("mousedown", { detail, bubbles: true, cancelable: true }); button.dispatchEvent(event); return event.defaultPrevented; };
    expect(down(first.querySelector(".cancel-edit")!, 1)).toBe(false);
    click(first.querySelector(".cancel-edit")!, 1);
    // The press that takes nothing back takes no focus from the message box either.
    expect([down(second.querySelector(".cancel-edit")!, 2), down(second.querySelector(".cancel-edit")!, 1)]).toEqual([true, true]);
    click(second.querySelector(".cancel-edit")!, 2);
    // A pointer that moved between its two presses counts each as a first.
    click(second.querySelector(".cancel-edit")!, 1);
    expect(ports.cancel.mock.calls).toEqual([["sent-3"]]);
    timers.splice(0).forEach((then) => then());
    expect([down(second.querySelector(".cancel-edit")!, 2), down(second.querySelector(".cancel-edit")!, 1)]).toEqual([true, false]);
    click(second.querySelector(".cancel-edit")!, 2);
    expect(ports.cancel.mock.calls).toEqual([["sent-3"]]);
    // A key's press and a script's count nothing.
    second.querySelector<HTMLButtonElement>(".cancel-edit")!.click();
    expect(ports.cancel.mock.calls).toEqual([["sent-3"], ["sent-4"]]);
    click(first.querySelector(".send-now")!, 1);
    click(first.querySelector(".send-now")!, 2);
    expect(ports.sendNow.mock.calls.length).toBe(1);
  });

  it("is two Tab stops, Cancel and edit message then Send now, in a group named by the message's words; no arrow key moves between them, and the message's quotes keep their own stop", () => {
    const { rows: drawn } = rows();
    const plain = drawn.waiting({ key: "sent-3", now: true, cancel: true, words: () => "Keep it short." });
    article(plain);
    const [cancel, now] = [...plain.querySelectorAll<HTMLElement>("button")];
    expect([plain.getAttribute("role"), plain.getAttribute("aria-label")]).toEqual(["group", "Keep it short."]);
    expect([cancel!.tabIndex, now!.tabIndex, cancel!.hasAttribute("data-rove"), now!.hasAttribute("data-rove")]).toEqual([0, 0, false, false]);
    cancel!.focus();
    expect(key(cancel!, "ArrowRight").defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(cancel);
    const refs = drawn.quoted([{ entry: "a1b2c3d4", at: `${EPOCH}:12`, words: "How many days" }]);
    const under = drawn.waiting({ key: "sent-4", now: true, cancel: true, words: () => "And the logs." });
    article(refs, under);
    expect([...under.querySelectorAll<HTMLElement>("button")].map((button) => button.tabIndex)).toEqual([0, 0]);
    const ref = refs!.querySelector<HTMLElement>("button")!;
    expect(ref.tabIndex).toBe(0);
    // A message of quotes alone names its group by nothing: each control's own name stands.
    expect(drawn.waiting({ key: "sent-5", now: true, cancel: true, words: () => "" }).hasAttribute("aria-label")).toBe(false);
  });
});

describe("the row under a message", () => {
  it("reads outward from the message: a seller's its time, Quote and Copy; an answer's Copy and its time", () => {
    const { rows: drawn } = rows();
    const seller = drawn.under(yours());
    expect(seller.className).toBe("actions user-actions");
    expect(labels(seller)).toEqual(["10:12", "Quote your message “How many days of stock are…”", "Copy"]);
    // Each control is a mark alone, its word over it; the time takes no press, and its word is the moment in full.
    expect([...seller.children].map((child) => [child.tagName, tipOf(child)])).toEqual([["TIME", ["true", "Sep 14, 2026, 10:12"]], ["BUTTON", ["true", "Quote"]], ["BUTTON", ["true", "Copy"]]]);
    expect(seller.querySelector("time")!.getAttribute("datetime")).toBe(new Date(TIME).toISOString());
    expect([...seller.querySelectorAll("button")].some((button) => button.hasAttribute("title") || button.querySelector(":scope > span:not(.tip)") !== null)).toBe(false);
    const answer = drawn.under(cxs());
    expect(answer.className).toBe("actions answer-actions");
    expect(labels(answer)).toEqual(["Copy", "10:12"]);
    // An answer is quoted by selecting its words: its row offers no Quote.
    expect(answer.querySelectorAll("button")).toHaveLength(1);
  });

  it("quotes a seller's message whole, with pi's id for it, its place, and when it was said", () => {
    const { rows: drawn, ports } = rows();
    drawn.under(yours()).querySelector<HTMLButtonElement>(".quote")!.click();
    expect(ports.quote).toHaveBeenCalledWith({ entry: "a1b2c3d4", at: `${EPOCH}:12`, words: "How many days of stock are left?", who: "you", time: TIME });
  });

  it("offers no Quote on a message pi's id has not reached, and Copy is then its Tab stop", () => {
    const row = rows().rows.under(yours({ entryId: undefined }));
    expect(labels(row)).toEqual(["10:12", "Copy"]);
    expect(row.querySelector<HTMLButtonElement>("button")!.tabIndex).toBe(0);
  });

  it("copies the message's words, says Copied to the eye and to a screen reader, and goes back to Copy after a moment", () => {
    const { rows: drawn, ports, timers } = rows();
    const copy = drawn.under(cxs()).querySelector<HTMLButtonElement>("button")!;
    copy.click();
    expect(ports.copy).toHaveBeenCalledWith("412 units are available.");
    expect([copy.getAttribute("aria-label"), tipOf(copy)[1]]).toEqual(["Copied", "Copied"]);
    expect(ports.announce).toHaveBeenLastCalledWith("Copied");
    timers.forEach((then) => then());
    expect([copy.getAttribute("aria-label"), tipOf(copy)[1]]).toEqual(["Copy", "Copy"]);
    expect(ports.announce).toHaveBeenLastCalledWith("");
  });

  it("is one Tab stop per message: the arrow keys move between Quote and Copy, and the stop follows the focus", () => {
    const holder = article(rows().rows.under(yours()));
    const [quote, copy] = [...holder.querySelectorAll<HTMLButtonElement>("button")];
    expect([quote!.tabIndex, copy!.tabIndex]).toEqual([0, -1]);
    quote!.focus();
    expect(key(quote!, "ArrowRight").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(copy);
    expect([quote!.tabIndex, copy!.tabIndex]).toEqual([-1, 0]);
    key(copy!, "ArrowRight");
    expect(document.activeElement).toBe(quote);
    key(quote!, "ArrowLeft");
    expect(document.activeElement).toBe(copy);
    // A key that moves nothing is left to the page.
    expect(key(copy!, "Enter").defaultPrevented).toBe(false);
  });
});

describe("the quotes of a sent message", () => {
  const QUOTES: readonly Quote[] = [{ entry: "a1b2c3d4", at: `${EPOCH}:12`, words: "How many days of stock are left?" }, { entry: "0f9e8d7c", at: `${EPOCH}:14`, words: "412 units are available." }];

  it("stack over the message, each with its words and when they were said, and a press goes to where it was said", () => {
    const { rows: drawn, ports } = rows();
    const refs = drawn.quoted(QUOTES)!;
    expect([...refs.querySelectorAll(".quote-ref")].map((ref) => [ref.querySelector(".excerpt")!.textContent, ref.querySelector(".when")!.textContent])).toEqual([
      ["How many days of stock are left?", "Mon, Sep 14, 10:12"], ["412 units are available.", "Mon, Sep 14, 10:12"]]);
    // Each is named by what it draws, the words and their time, and by nothing said over them.
    expect([...refs.querySelectorAll("button")].map((ref) => [ref.hasAttribute("aria-label"), ref.hasAttribute("title"), ref.textContent])).toEqual([
      [false, false, "How many days of stock are left?Mon, Sep 14, 10:12"], [false, false, "412 units are available.Mon, Sep 14, 10:12"]]);
    refs.querySelectorAll<HTMLButtonElement>("button")[1]!.click();
    expect(ports.jump).toHaveBeenCalledWith(QUOTES[1]);
    expect(drawn.quoted([])).toBeUndefined();
  });

  it("take when from a read of a message the page does not hold, say neither when it cannot be read, and make no control of a quote that names no place", async () => {
    const grew = vi.fn();
    const { rows: read } = rows({ said: () => undefined, saidFar: async () => ({ when: "Wed, Sep 30, 10:20" }), grew });
    const far = read.quoted([QUOTES[1]!])!;
    expect(far.querySelector(".when")).toBeNull();
    await Promise.resolve();
    expect([far.querySelector(".when")!.textContent, far.querySelector("button")!.getAttribute("aria-label")]).toEqual(["Wed, Sep 30, 10:20", null]);
    expect(grew).toHaveBeenCalledTimes(1);

    const { rows: drawn } = rows({ said: () => undefined, grew });
    const refs = drawn.quoted([QUOTES[0]!, { entry: "x", at: "", words: "words alone" }])!;
    await Promise.resolve();
    expect([refs.querySelector(".when"), refs.querySelector("button")!.getAttribute("aria-label")]).toEqual([null, null]);
    expect(grew).toHaveBeenCalledTimes(1);
    expect(refs.querySelectorAll("button")).toHaveLength(1);
    expect(refs.children[1]!.textContent).toBe("words alone");
  });

  it("say nothing over a quote read late, on hover or to a screen reader: it is named by its words and their time alone", async () => {
    const { rows: read } = rows({ said: () => undefined, saidFar: async () => ({ when: "Wed, Sep 30, 10:20" }) });
    const far = read.quoted([QUOTES[1]!])!;
    await Promise.resolve();
    const ref = far.querySelector("button")!;
    expect([ref.textContent, ref.hasAttribute("aria-label")]).toEqual(["412 units are available.Wed, Sep 30, 10:20", false]);
    expect(far.querySelectorAll("[title], [aria-label], [aria-description]")).toHaveLength(0);
  });

  it("join the message's row as its one Tab stop: the first quote takes it, and the arrows go on into the row and round", () => {
    const { rows: drawn } = rows();
    const holder = article(drawn.quoted(QUOTES), drawn.under(yours({ first: false })));
    const stops = [...holder.querySelectorAll<HTMLButtonElement>("button")];
    expect(stops.map((stop) => stop.tabIndex)).toEqual([0, -1, -1, -1]);
    stops[0]!.focus();
    key(stops[0]!, "ArrowDown"); key(stops[1]!, "ArrowDown");
    expect(document.activeElement).toBe(stops[2]);
    expect(stops.map((stop) => stop.tabIndex)).toEqual([-1, -1, 0, -1]);
    key(stops[2]!, "ArrowUp");
    expect(document.activeElement).toBe(stops[1]);
  });
});

describe("the quotes waiting in the message box", () => {
  const YOURS: Held = { entry: "a1b2c3d4", at: `${EPOCH}:12`, words: "How many days of stock are left?", who: "you", time: TIME };
  const CXS: Held = { entry: "0f9e8d7c", at: `${EPOCH}:14`, words: "412 units are available and 96 are on their way in.", who: "cx", time: TIME };
  function box(): { readonly box: QuoteBox; readonly draft: HTMLTextAreaElement; readonly changed: ReturnType<typeof vi.fn> } {
    const draft = document.createElement("textarea");
    const changed = vi.fn();
    const held = new QuoteBox({ say: (key, values) => text("en", key, values), when: () => "Mon, Sep 14, 10:12", draft, changed });
    document.body.append(held.element, draft);
    return { box: held, draft, changed };
  }

  it("names each card for a screen reader as a group of its quote, by the quote's first words", () => {
    const { box: held } = box();
    held.add({ ...CXS, who: "cx", time: TIME });
    const card = held.element.querySelector(".quote-card")!;
    expect([card.getAttribute("role"), card.getAttribute("aria-label")]).toEqual(["group", `Quote “${opening(CXS.words)}”`]);
  });

  it("takes back a quote whose entry is not at hand with its words alone, and whose words and when once they are known", () => {
    const { box: held, draft } = box();
    const said = (): string => draft.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)!.textContent).join(" | ");
    held.add({ ...CXS, who: undefined, time: undefined });
    expect([...held.element.querySelectorAll(".quote-card .excerpt")].map((card) => card.textContent)).toEqual([CXS.words]);
    expect([held.element.querySelector(".quote-card .when"), said()]).toEqual([null, CXS.words]);
    held.know(CXS, "cx", TIME);
    expect([held.element.querySelector(".quote-card .when")!.textContent, said()]).toEqual(["Mon, Sep 14, 10:12", `${CXS.words}Mon, Sep 14, 10:12`]);
    // What is known already is not told again.
    held.know(CXS, "you", undefined);
    expect(said()).toContain("Mon, Sep 14, 10:12");
    expect(held.quotes).toEqual([{ entry: CXS.entry, at: CXS.at, words: CXS.words }]);
  });

  it("leaves a card drawn as it is when what it holds is learned again, so words selected in it stay selected", () => {
    const { box: held } = box();
    held.add(CXS);
    const body = held.element.querySelector(".quote-body")!;
    const range = document.createRange();
    range.selectNodeContents(body);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    held.know(CXS, "you", undefined);
    expect([held.element.querySelector(".quote-body"), body.isConnected, document.getSelection()!.toString()]).toEqual([body, true, `${CXS.words}Mon, Sep 14, 10:12`]);
  });

  it("keeps the focus on a card's remove control when the cards are drawn again with the page, the same cards", () => {
    const { box: held } = box();
    held.add(YOURS); held.add(CXS);
    const removes = (): HTMLButtonElement[] => [...held.element.querySelectorAll<HTMLButtonElement>(".remove")];
    removes()[1]!.focus();
    held.draw();
    expect(document.activeElement).toBe(removes()[1]);
    expect(removes()[1]!.isConnected).toBe(true);
  });

  it("is no room at all until a quote joins, then a card each with the words, when they were said, and a way out", () => {
    const { box: held, draft, changed } = box();
    held.draw();
    expect(held.element.hidden).toBe(true);
    held.add(YOURS); held.add(CXS);
    expect(held.element.hidden).toBe(false);
    expect([...held.element.querySelectorAll(".quote-card")].map((card) => [card.querySelector(".excerpt")!.textContent, card.querySelector(".when")!.textContent, card.querySelector("button")!.getAttribute("aria-label")])).toEqual([
      ["How many days of stock are left?", "Mon, Sep 14, 10:12", "Remove quote “How many days of stock are…”"],
      ["412 units are available and 96 are on their way in.", "Mon, Sep 14, 10:12", "Remove quote “412 units are available and 96…”"]]);
    expect(document.activeElement).toBe(draft);
    expect(changed).toHaveBeenCalledTimes(2);
    expect(held.quotes).toEqual([{ entry: YOURS.entry, at: YOURS.at, words: YOURS.words }, { entry: CXS.entry, at: CXS.at, words: CXS.words }]);
  });

  it("describes the message box by what the cards draw, the words and their time, with no sentence said over them and nothing hidden from a screen reader", () => {
    const { box: held, draft } = box();
    held.add(YOURS); held.add(CXS);
    const described = draft.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)!);
    expect(described).toEqual([...held.element.querySelectorAll(".quote-body")]);
    expect(described.map((body) => [body.hasAttribute("aria-hidden"), body.textContent])).toEqual([[false, `${YOURS.words}Mon, Sep 14, 10:12`], [false, `${CXS.words}Mon, Sep 14, 10:12`]]);
    expect([held.element.querySelector(".unseen"), held.element.textContent!.includes("Quoting")]).toEqual([null, false]);
  });

  it("says nothing over a card on hover: the one tip is the remove control's own name, and nothing carries a title", () => {
    const { box: held } = box();
    held.add(YOURS); held.add({ ...CXS, who: undefined, time: undefined });
    held.know(CXS, "cx", TIME);
    expect(held.element.querySelectorAll("[title]")).toHaveLength(0);
    expect([...held.element.querySelectorAll(".quote-card")].map((card) => tipOf(card))).toEqual([[], []]);
    expect([...held.element.querySelectorAll(".remove")].map((remove) => tipOf(remove)[1])).toEqual(["Remove quote “How many days of stock are…”", "Remove quote “412 units are available and 96…”"]);
  });

  it("holds the same words of the same message once, and loses a card to its ×, the message box keeping the focus", () => {
    const { box: held, draft } = box();
    held.add(YOURS); held.add(YOURS); held.add(CXS);
    expect(held.element.querySelectorAll(".quote-card")).toHaveLength(2);
    held.element.querySelector<HTMLButtonElement>(".remove")!.click();
    expect(held.quotes.map((quote) => quote.entry)).toEqual([CXS.entry]);
    expect(document.activeElement).toBe(draft);
    held.element.querySelector<HTMLButtonElement>(".remove")!.click();
    expect(held.element.hidden).toBe(true);
    expect(draft.hasAttribute("aria-describedby")).toBe(false);
  });

  it("goes with the message it was sent in", () => {
    const { box: held, changed } = box();
    held.add(CXS);
    held.clear();
    expect([held.quotes, held.element.hidden, held.element.childElementCount]).toEqual([[], true, 0]);
    changed.mockClear();
    held.clear();
    expect(changed).not.toHaveBeenCalled();
  });
});

describe("words selected in the conversation", () => {
  /** A conversation of a seller's message and two answers, the first with a step's card and its thinking beside its words. */
  function conversation(): HTMLElement {
    const scroller = document.createElement("div");
    scroller.innerHTML = `
      <article class="item user" data-key="${EPOCH}:1"><div class="said"><div class="markdown"><p id="mine">Mine to say.</p></div></div></article>
      <article class="item assistant" data-key="${EPOCH}:2"><div class="thinking"><div class="markdown"><p id="thought">A thought.</p></div></div><div class="markdown"><p id="one">First answer, first sentence.</p><p id="two">Second   paragraph
        here.</p></div><div class="tool success"><pre id="step">step output</pre></div><div class="actions answer-actions"><span id="when">10:12</span></div></article>
      <article class="item assistant" data-key="${EPOCH}:3"><div class="markdown"><p id="three">Another answer.</p></div></article>
      <article class="item assistant draft" data-key="draft-4"><div class="markdown"><p id="draft">Still being written.</p></div></article>`;
    document.body.append(scroller);
    return scroller;
  }
  const select = (from: string, to: string, fromAt = 0, toAt?: number): Selection => {
    const selection = getSelection()!;
    const start = document.getElementById(from)!.firstChild!, end = document.getElementById(to)!.firstChild!;
    const range = document.createRange();
    range.setStart(start, fromAt);
    range.setEnd(end, toAt ?? end.textContent!.length);
    selection.removeAllRanges();
    selection.addRange(range);
    return selection;
  };
  const picked = (scroller: HTMLElement, selection: Selection): unknown => { const found = selected(scroller, selection); return found === undefined ? undefined : { key: found.key, words: found.words }; };

  it("are a quote of the answer they lie in, as the reader sees them, runs of white space as one", () => {
    const scroller = conversation();
    expect(picked(scroller, select("one", "one", 6, 12))).toEqual({ key: `${EPOCH}:2`, words: "answer" });
    expect(picked(scroller, select("one", "two", 14))).toEqual({ key: `${EPOCH}:2`, words: "first sentence.Second paragraph here." });
  });

  it("are cut to the one answer's text they begin in, whichever way they were drawn, and are nothing to quote when begun outside an answer's text", () => {
    const scroller = conversation();
    expect(picked(scroller, select("two", "three", 0))).toMatchObject({ key: `${EPOCH}:2` });
    expect((picked(scroller, select("two", "three", 0)) as { words: string }).words).not.toContain("Another");
    // Drawn upward across two answers: it began in the lower one, and that one's part is the quote.
    const three = document.getElementById("three")!.firstChild!, two = document.getElementById("two")!.firstChild!;
    getSelection()!.setBaseAndExtent(three, 7, two, 0);
    expect(picked(scroller, getSelection()!)).toEqual({ key: `${EPOCH}:3`, words: "Another" });
    // Begun in a seller's message or a step and ended in an answer.
    expect(picked(scroller, select("mine", "one", 0, 5))).toBeUndefined();
    expect(picked(scroller, select("step", "three", 0, 7))).toBeUndefined();
  });

  it("float nothing in a seller's message, a step, thinking, a row, or an answer still being written, nor for no selection", () => {
    const scroller = conversation();
    for (const id of ["mine", "step", "thought", "when", "draft"]) expect(picked(scroller, select(id, id))).toBeUndefined();
    getSelection()!.removeAllRanges();
    expect(selected(scroller, getSelection())).toBeUndefined();
    expect(selected(scroller, null)).toBeUndefined();
  });

  it("are nothing to a conversation they do not lie in", () => {
    const scroller = conversation();
    expect(selected(document.createElement("div"), select("one", "one"))).toBeUndefined();
    expect(selected(scroller, select("one", "one"))).toBeDefined();
  });

  it("are found whole in the answer a sent quote returns to, across bold, a link and two paragraphs, and words that only begin alike are not them", () => {
    const scroller = document.createElement("div");
    scroller.innerHTML = `<article class="item assistant" data-key="${EPOCH}:9"><div class="markdown"><p>The remaining stock is thin this week, so order now.</p><p>The remaining <strong>412 units</strong> are <a href="#">available</a> today.</p><p>Next   paragraph
      begins here.</p></div></article>`;
    document.body.append(scroller);
    const answer = scroller.querySelector<HTMLElement>("article")!;
    const found = (words: string): string | undefined => wordsIn(answer, words)?.toString().replace(/\s+/g, " ");
    expect(found("The remaining 412 units are available")).toBe("The remaining 412 units are available");
    // The same opening 24 characters stand earlier, before other words.
    expect(wordsIn(answer, "The remaining 412 units are available")!.startContainer.parentElement!.closest("p")).toBe(answer.querySelectorAll("p")[1]);
    expect(found("available today.Next paragraph begins")).toBe("available today.Next paragraph begins");
    expect(found("412 units")).toBe("412 units");
    expect(found("The remaining 412 units are sold")).toBeUndefined();
    expect(found("   ")).toBeUndefined();
  });

  it("are marked for a moment in the answer a sent quote returns to, where the browser can mark", () => {
    const scroller = conversation();
    const answer = scroller.querySelector<HTMLElement>(`[data-key="${EPOCH}:2"]`)!;
    const held = new Map<string, unknown>();
    const marked: Range[] = [];
    vi.stubGlobal("CSS", { highlights: held });
    vi.stubGlobal("Highlight", class { constructor(range: Range) { marked.push(range); } });
    const timers: (() => void)[] = [];
    expect(markWords(answer, "first sentence.", (_, then) => { timers.push(then); })).toBe(true);
    expect(marked[0]!.toString()).toBe("first sentence.");
    expect(held.has("quoted")).toBe(true);
    timers.forEach((then) => then());
    expect(held.has("quoted")).toBe(false);
    // Words of its thinking or of a step are not the answer's.
    expect(markWords(answer, "A thought.", () => undefined)).toBe(false);
    vi.unstubAllGlobals();
    expect(markWords(answer, "first sentence.", () => undefined)).toBe(false);
  });
});

describe("Quote on a selection", () => {
  /** A page of one answer with the control floating in it, the answer's first sentence selected. */
  function page(): { readonly pick: QuotePick & { readonly scroller: HTMLElement }; readonly quote: ReturnType<typeof vi.fn>; readonly scroller: HTMLElement; readonly other: HTMLButtonElement } {
    const main = document.createElement("main"), scroller = document.createElement("div"), other = document.createElement("button");
    scroller.innerHTML = `<article class="item assistant" data-key="${EPOCH}:2"><div class="markdown"><p id="said">412 units are available.</p></div></article>`;
    scroller.getBoundingClientRect = (): DOMRect => new DOMRect(0, 0, 800, 600);
    const quote = vi.fn();
    const pick = new QuotePick({ main, scroller, words: () => ({ quote: "Quote", selection: "Quote the selected words" }), quote, soon: (then) => then() });
    main.append(scroller, other, pick.element);
    document.body.append(main);
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("said")!);
    // The stand-in DOM lays nothing out: a selection's lines are read as one box.
    Range.prototype.getClientRects = function (): DOMRectList { return [new DOMRect(40, 120, 200, 20)] as unknown as DOMRectList; };
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    pick.place();
    return { pick: Object.assign(pick, { scroller }), quote, scroller, other };
  }
  const tab = (shift = false): KeyboardEvent => { const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: shift, bubbles: true, cancelable: true }); (document.activeElement ?? document.body).dispatchEvent(event); return event; };

  it("floats while an answer's words are selected, says what it quotes, and quotes them once pressed", () => {
    const { pick, quote } = page();
    expect(pick.element.hidden).toBe(false);
    expect([pick.element.textContent, pick.element.getAttribute("aria-label")]).toEqual(["Quote", "Quote the selected words"]);
    pick.element.click();
    expect(quote).toHaveBeenCalledWith({ key: `${EPOCH}:2`, words: "412 units are available." });
    expect([pick.element.hidden, getSelection()!.isCollapsed]).toEqual([true, true]);
  });

  it("is a pointer's control: no Tab stop, Tab passes it by, and a press on it takes neither the focus nor the selection", () => {
    const { pick, other } = page();
    expect(pick.element.tabIndex).toBe(-1);
    other.focus();
    expect([tab().defaultPrevented, tab(true).defaultPrevented]).toEqual([false, false]);
    expect([document.activeElement, pick.element.hidden]).toEqual([other, false]);
    const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    pick.element.dispatchEvent(press);
    expect([press.defaultPrevented, getSelection()!.isCollapsed]).toEqual([true, false]);
  });

  it("comes back when the selected words scroll back into view; after Escape it stays away while that selection stands, whatever is scrolled or drawn, takes no second Escape, and comes back with a change of the selection", () => {
    const { pick, scroller } = page();
    const view = scroller.getBoundingClientRect;
    scroller.getBoundingClientRect = (): DOMRect => new DOMRect(0, 300, 800, 400);
    scroller.dispatchEvent(new Event("scroll"));
    expect(pick.element.hidden).toBe(true);
    scroller.getBoundingClientRect = view;
    scroller.dispatchEvent(new Event("scroll"));
    expect(pick.element.hidden).toBe(false);
    const escape = (): boolean => { const event = new KeyboardEvent("keydown", { key: "Escape" }); document.dispatchEvent(event); return pick.took(event); };
    expect([escape(), pick.element.hidden]).toEqual([true, true]);
    scroller.dispatchEvent(new Event("scroll"));
    pick.place();
    expect([pick.element.hidden, escape()]).toEqual([true, false]);
    document.dispatchEvent(new Event("selectionchange"));
    expect(pick.element.hidden).toBe(false);
  });

  it("goes on Escape, when the selection goes, and when the selected words scroll out of the conversation's view", () => {
    const first = page();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(first.pick.element.hidden).toBe(true);
    document.body.replaceChildren();
    const second = page();
    getSelection()!.removeAllRanges();
    second.pick.place();
    expect(second.pick.element.hidden).toBe(true);
    document.body.replaceChildren();
    const third = page();
    third.scroller.getBoundingClientRect = (): DOMRect => new DOMRect(0, 300, 800, 400);
    third.scroller.dispatchEvent(new Event("scroll"));
    expect(third.pick.element.hidden).toBe(true);
  });
});

describe("an answers' message the board once sent, from history", () => {
  const pairs = [{ file: "20261027-020304-price.md", modified: 1, title: "Lower the price", said: "Go ahead." }, { file: "colour.md", modified: 2, title: "Which colour?", said: "Blue" }];

  it("quotes each entry it answers as words alone, with when cx wrote it, the seller's sentence under it", () => {
    const drawn = article(rows().rows.board(pairs));
    expect([drawn.querySelectorAll("button").length, [...drawn.querySelectorAll("div.quote-ref")].map((ref) => [ref.querySelector(".excerpt")!.textContent, ref.querySelector(".when")?.textContent])]).toEqual([0, [["Lower the price", "10:12"], ["Which colour?", undefined]]]);
    expect([...drawn.querySelectorAll(".board-sent-pair > p")].map((one) => one.textContent)).toEqual(["Go ahead.", "Blue"]);
  });
});
