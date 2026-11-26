// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { TOO_LONG_ENTRY } from "../shared/too-long.js";
import { WAY_MOVED_ENTRY, wayUsedUpMessage } from "../shared/way-moves.js";
import { EMPTY, reduce, type StreamEvent, type StreamState } from "./stream-model.js";
import { StreamView } from "./stream-view.js";
import { fromBoard } from "./board-message.js";
import { text } from "./strings.js";
import { h } from "./dom.js";
import { tip } from "./forms.js";

const EPOCH = "a".repeat(32);
const entry = (seq: number, body: Record<string, unknown>): StreamEvent => ({ event: "entry", id: `${EPOCH}:${seq}`, data: { epoch: EPOCH, seq, body } });
const state = (...events: StreamEvent[]): StreamState => events.reduce(reduce, EMPTY);
const view = (): StreamView => {
  const page = new StreamView({ say: (key, values) => text("en", key, values), now: () => 0, day: () => "Today" });
  document.body.append(page.element);
  return page;
};
const refusal = `403 ${JSON.stringify({ error: { code: "way_used_up", message: wayUsedUpMessage({ way: "key", provider: "openai" }, [{ way: "platform", provider: "balance" }], "openai") } })}`;
const failed = (errorMessage: string): StreamEvent => entry(1, { form: "message", role: "assistant", content: [], stopReason: "error", errorMessage });

afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); });

it("draws a provider's error that copies a refusal's words as that provider's error, its own text whole", () => {
  vi.useFakeTimers();
  const raw = `403 ${JSON.stringify({ error: { message: `Original vendor detail: ${wayUsedUpMessage({ way: "key", provider: "openai" }, [{ way: "platform", provider: "balance" }], "openai")}` } })}`;
  const page = view();
  page.update(state(failed(raw)));
  expect(page.element.textContent).toContain(raw);
  expect(page.element.textContent).not.toContain(text("en", "stream.wayUsedUp"));
});

it("says the way ran out once the steward's line records the move it made, past the model change, and drops the proxy's text then", () => {
  vi.useFakeTimers();
  const page = view();
  const before = [failed(refusal)];
  page.update(state(...before));
  expect(page.element.textContent).toContain(refusal);
  page.update(state(...before, entry(2, { form: "model_change", provider: "openrouter", modelId: "openai/gpt-6-luna" }),
    entry(3, { form: "custom", customType: WAY_MOVED_ENTRY, data: { from: { way: "key", provider: "openai" }, to: { way: "platform", provider: "balance" } } })));
  expect(page.element.textContent).toContain(text("en", "stream.wayUsedUp"));
  expect(page.element.textContent).not.toContain(refusal);
  expect([...page.element.querySelectorAll(".moved")].map((line) => line.textContent)).toEqual(["Your OpenAI API key has run out of credit. Your next message uses your balance."]);
});

it("ties no move back across the seller's own message: the error before it keeps its own text", () => {
  vi.useFakeTimers();
  const page = view();
  page.update(state(failed(refusal), entry(2, { form: "message", role: "user", content: [{ type: "text", text: "Try again" }] }),
    entry(3, { form: "custom", customType: WAY_MOVED_ENTRY, data: { from: { way: "key", provider: "openai" }, to: { way: "platform", provider: "balance" } } })));
  expect(page.element.textContent).toContain("Try again");
  expect(page.element.textContent).toContain(refusal);
  expect(page.element.textContent).not.toContain(text("en", "stream.wayUsedUp"));
});

it("says the way ran out and the chat stopped once the steward's line records that the seller's card keeps no next way, in either language", () => {
  vi.useFakeTimers();
  const stopped = [failed(refusal), entry(2, { form: "custom", customType: WAY_MOVED_ENTRY, data: { from: { way: "key", provider: "openai" } } })];
  const page = view();
  page.update(state(...stopped));
  expect(page.element.textContent).toContain(text("en", "stream.wayUsedUp"));
  expect(page.element.textContent).not.toContain(refusal);
  expect([...page.element.querySelectorAll(".moved")].map((line) => line.textContent)).toEqual(["Your OpenAI API key has run out of credit, and no other way you keep for this model is left."]);
  const zh = new StreamView({ say: (key, values) => text("zh", key, values), now: () => 0, day: () => "今天" });
  zh.update(state(...stopped));
  expect([...zh.element.querySelectorAll(".moved")].map((line) => line.textContent)).toEqual(["你的 OpenAI API Key 额度用完了，这个模型没有其他可用的接入方式。"]);
});

it("says a turn pi gave up on for its length in the page's words, offers the model card, and folds the vendor's text; any other failure stays as built", () => {
  const choose = vi.fn();
  const page = new StreamView({ say: (key, values) => text("zh", key, values), now: () => 0, day: () => "今天", chooseModel: choose, modelName: ({ provider, id }) => (provider === "balance" && id === "google/gemini-3.6-flash" ? "Gemini 3.6 Flash" : id) });
  const refused = entry(1, { form: "message", role: "assistant", content: [], stopReason: "error", errorMessage: "400 {too long}", provider: "balance", model: "google/gemini-3.6-flash" });
  // Before pi gives up, and for any refusal pi has not judged, the stop is as built, whatever its text says.
  page.update(state(refused));
  expect(page.element.querySelector(".stop")!.textContent).toBe("出错，已停止400 {too long}");
  expect(page.element.querySelector(".stop-ways")).toBeNull();
  page.update(state(refused, entry(2, { form: "custom", customType: TOO_LONG_ENTRY })));
  expect(page.element.querySelector(".stop")!.textContent).toBe("对话长度已超出 Gemini 3.6 Flash 的上限。");
  page.element.querySelector<HTMLButtonElement>(".stop-ways button")!.click();
  expect(page.element.querySelector(".stop-ways")!.textContent).toBe("选择模型");
  expect(choose).toHaveBeenCalledOnce();
  const fold = page.element.querySelector<HTMLButtonElement>(".fold")!;
  const raw = page.element.querySelector<HTMLElement>("pre.stop-raw")!;
  expect([fold.textContent, fold.getAttribute("aria-expanded"), raw.hidden, raw.textContent]).toEqual(["展开详情", "false", true, "400 {too long}"]);
  fold.click();
  expect([fold.textContent, fold.getAttribute("aria-expanded"), raw.hidden]).toEqual(["收起", "true", false]);
});

it("says the latest message is in view exactly while the box of the last item shown meets the view's, the day line and a hidden item not counted", () => {
  const page = new StreamView({ say: (key, values) => text("en", key, values), now: () => 0, day: () => "Today" });
  // Outside a view, or in one not laid out, nothing lies out of sight.
  expect(page.latestSeen()).toBe(true);
  const scroller = document.createElement("div");
  scroller.append(page.element);
  document.body.append(scroller);
  expect(page.latestSeen()).toBe(true);
  let client = 0;
  Object.defineProperty(scroller, "clientHeight", { get: () => client, configurable: true });
  scroller.getBoundingClientRect = (): DOMRect => new DOMRect(0, 100, 800, client);
  client = 600;
  // Nothing drawn: nothing out of sight.
  expect(page.latestSeen()).toBe(true);
  page.update(state(entry(1, { form: "message", role: "user", content: "Check the listing", timestamp: 1 }), entry(2, { form: "message", role: "assistant", content: [{ form: "text", text: "Done." }], stopReason: "stop" })));
  const [asked, answered] = [...page.element.querySelectorAll<HTMLElement>(".item")];
  let at = 0;
  answered!.getBoundingClientRect = (): DOMRect => new DOMRect(0, at, 800, 50);
  asked!.getBoundingClientRect = (): DOMRect => new DOMRect(0, 0, 800, 50);
  // The view stands from 100 to 700: a box from 51 to 101 meets it, one ending at 100 does not; one starting at 699 does, at 700 does not.
  const seen = (top: number): boolean => { at = top; return page.latestSeen(); };
  expect([seen(50), seen(51), seen(400), seen(699), seen(700)]).toEqual([false, true, true, true, false]);
  // A hidden last item is passed over for the one before it, which stands above the view here.
  answered!.hidden = true;
  expect(page.latestSeen()).toBe(false);
  // The day line over the first message is never the latest: with both messages hidden, nothing shown lies out of sight.
  asked!.hidden = true;
  expect([page.element.querySelector(".day-line")?.textContent, page.latestSeen()]).toEqual(["Today", true]);
});

it("draws each card a script wrote, as pi records it, as the card's row under the script's step; none for a write that failed or whose path pi left out", () => {
  const calls = [{ id: "c1/1", name: "write", status: "ok", arguments: { path: "board/acct-1/收件箱/restock.md", content: "x" } }, { id: "c1/2", name: "write", status: "error", arguments: { path: "board/acct-1/收件箱/denied.md" } },
    { id: "c1/3", name: "write", status: "ok", argumentsBytes: 9000 }, { id: "c1/4", name: "read", status: "ok", arguments: { path: "board/acct-1/收件箱/read.md" } }];
  const events = [entry(1, { form: "message", role: "user", content: "Restock?" }),
    entry(2, { form: "message", role: "assistant", content: [{ form: "tool_call", id: "c1", name: "codemode", arguments: { code: "…" } }], stopReason: "toolUse" }),
    entry(3, { form: "message", role: "tool_result", toolCallId: "c1", toolName: "codemode", content: [{ form: "text", text: "ok" }], isError: false, nestedCalls: { calls, complete: false } })];
  let rows: Readonly<Record<string, { readonly title: string; readonly state: "toAnswer" | "answered" }>> = {};
  const page = new StreamView({ say: (key, values) => text("en", key, values), now: () => 0, day: () => "Today", card: ({ tab, file }) => rows[`${tab}/${file}`] });
  document.body.append(page.element);
  const drawn = (): readonly (string | null)[] => [...page.element.querySelectorAll(".told-card .told-title")].map((one) => one.textContent);
  page.update(state(...events));
  expect([drawn(), page.element.querySelectorAll(".tool").length]).toEqual([[], 1]);
  rows = { "收件箱/restock.md": { title: "Restock?", state: "toAnswer" }, "收件箱/denied.md": { title: "Denied", state: "toAnswer" }, "收件箱/read.md": { title: "Read", state: "toAnswer" } };
  page.update(state(...events));
  // The script's step stands, and the row under it.
  expect([drawn(), page.element.querySelectorAll(".tool").length]).toEqual([["Restock?"], 1]);
  page.element.remove();
});

it("draws the row of a card a script wrote even where the script failed after the write: the write's own record says it was written", () => {
  const calls = [{ id: "c1/1", name: "write", status: "ok", arguments: { path: "board/acct-1/收件箱/restock.md", content: "x" } }];
  const events = [entry(1, { form: "message", role: "user", content: "Restock?" }),
    entry(2, { form: "message", role: "assistant", content: [{ form: "tool_call", id: "c1", name: "codemode", arguments: { code: "…" } }], stopReason: "toolUse" }),
    entry(3, { form: "message", role: "tool_result", toolCallId: "c1", toolName: "codemode", content: [{ form: "text", text: "Error: after the write" }], isError: true, nestedCalls: { calls, complete: true } })];
  const page = new StreamView({ say: (key, values) => text("en", key, values), now: () => 0, day: () => "Today", card: () => ({ title: "Restock?", state: "toAnswer" }) });
  document.body.append(page.element);
  page.update(state(...events));
  // The script's one step stands as failed, and the card it wrote has its row under it.
  expect([[...page.element.querySelectorAll(".told-card .told-title")].map((one) => one.textContent), page.element.querySelector(".tool")?.className]).toEqual([["Restock?"], "tool error"]);
  page.element.remove();
});

it("draws no row for a card a shell command wrote: the page knows only the command's words, and the step stands", () => {
  const events = [entry(1, { form: "message", role: "user", content: "Restock?" }),
    entry(2, { form: "message", role: "assistant", content: [{ form: "tool_call", id: "c1", name: "bash", arguments: { command: "cat > /tenant/board/acct-1/收件箱/restock.md <<'EOF'\n---\ntitle: Restock?\n---\nEOF" } }], stopReason: "toolUse" }),
    entry(3, { form: "message", role: "tool_result", toolCallId: "c1", toolName: "bash", content: [{ form: "text", text: "" }], isError: false })];
  const page = new StreamView({ say: (key, values) => text("en", key, values), now: () => 0, day: () => "Today", card: () => ({ title: "Restock?", state: "toAnswer" }) });
  document.body.append(page.element);
  page.update(state(...events));
  expect([page.element.querySelectorAll(".told-card").length, page.element.querySelectorAll(".tool").length]).toEqual([0, 1]);
  page.element.remove();
});

it("draws a card cx wrote on a board as the card's row once it is read, by its title and where it stands, with a press that shows it on the board; until then, and for a write that failed, the step as it was", () => {
  vi.useFakeTimers();
  const card = (id: string, path: string) => ({ form: "tool_call", id, name: "write", arguments: { path, content: "---\ntitle: Restock?\nasks: true\n---\nHow many?" } });
  const result = (seq: number, id: string, isError: boolean): StreamEvent => entry(seq, { form: "message", role: "tool_result", toolCallId: id, toolName: "write", content: [{ form: "text", text: isError ? "denied" : "ok" }], isError });
  const events = [entry(1, { form: "message", role: "user", content: "Restock?" }),
    entry(2, { form: "message", role: "assistant", content: [card("c1", "/tenant/board/acct-1/收件箱/ask/restock.md"), card("c2", "/tenant/board/acct-1/收件箱/ask/denied.md")], stopReason: "toolUse" }),
    result(3, "c1", false), result(4, "c2", true)];
  let rows: Readonly<Record<string, { readonly title: string; readonly state: "toAnswer" | "answered" }>> = {};
  const opened: unknown[] = [];
  const page = new StreamView({ say: (key, values) => text("en", key, values), now: () => 0, day: () => "Today",
    card: ({ tab, file }) => rows[`${tab}/${file}`], openCard: (one) => opened.push(one) });
  document.body.append(page.element);
  const drawn = (): readonly (readonly (string | null)[])[] => [...page.element.querySelectorAll(".told-card")].map((one) => [one.querySelector(".told-title")!.textContent, one.querySelector(".told-state")!.textContent, one.getAttribute("aria-label")]);
  page.update(state(...events));
  expect([drawn(), page.element.querySelectorAll(".tool").length]).toEqual([[], 2]);
  rows = { "收件箱/ask/restock.md": { title: "Restock?", state: "toAnswer" }, "收件箱/ask/denied.md": { title: "Denied", state: "toAnswer" } };
  page.update(state(...events));
  expect([drawn(), page.element.querySelectorAll(".tool").length]).toEqual([[["Restock?", "To answer", "Restock?, To answer, show on the board"]], 1]);
  rows = { ...rows, "收件箱/ask/restock.md": { title: "Restock?", state: "answered" } };
  page.update(state(...events));
  expect(drawn()).toEqual([["Restock?", "Answered", "Restock?, Answered, show on the board"]]);
  page.element.querySelector<HTMLButtonElement>(".told-card")!.click();
  expect(opened).toEqual([{ person: "acct-1", tab: "收件箱", file: "ask/restock.md" }]);
});

it("marks a card's row with its urgency, says how many questions wait on a card of several, and draws an answer to a card with options as its question and answer rows", () => {
  const card = (id: string, path: string) => ({ form: "tool_call", id, name: "write", arguments: { path, content: "---\ntitle: Ship the next lot?\n---\n" } });
  const events = [entry(1, { form: "message", role: "user", content: "Plan the next lot." }),
    entry(2, { form: "message", role: "assistant", content: [card("c1", "/tenant/board/acct-1/待办/lot.md"), card("c2", "/tenant/board/acct-1/待办/plain.md")], stopReason: "toolUse" }),
    entry(3, { form: "message", role: "tool_result", toolCallId: "c1", toolName: "write", content: [{ form: "text", text: "ok" }], isError: false }),
    entry(4, { form: "message", role: "tool_result", toolCallId: "c2", toolName: "write", content: [{ form: "text", text: "ok" }], isError: false })];
  const asked = { form: "comchatx.options/1", questions: [{ words: "How to ship?" }, { words: "Which sizes?" }, { words: "Where to?" }, { words: "How many?" }] } as const;
  let rows: Readonly<Record<string, unknown>> = { "待办/lot.md": { title: "How to ship?", state: "toAnswer", level: 2, asked }, "待办/plain.md": { title: "Fees rose", state: "toRead" } };
  const page = new StreamView({ say: (key, values) => text("en", key, values), now: () => 0, day: () => "Today", language: () => "en", card: ({ tab, file }) => rows[`${tab}/${file}`] as never });
  document.body.append(page.element);
  const drawn = (): readonly (readonly unknown[])[] => [...page.element.querySelectorAll(".told-card")].map((one) => [one.querySelector(".told-state")!.textContent, one.querySelectorAll(".told-level rect.lit").length, one.querySelector(".told-level") === null]);
  page.update(state(...events));
  expect(drawn()).toEqual([["4 to answer", 2, false], ["To read", 0, true]]);
  expect(page.element.querySelector(".told-level")!.getAttribute("aria-hidden")).toBe("true");
  // The seller's answer, sent from the Inbox naming the card: its question and answer rows alone, on the ground, as an option card answered
  // in the chat leaves them; the card's own row, where cx wrote it, says it is answered.
  rows = { ...rows, "待办/lot.md": { title: "How to ship?", state: "answered", level: 2, asked, answered: { answers: [{ chosen: ["By sea"] }, { chosen: ["10mm", "8mm"] }, null, { chosen: [], own: "800 units" }] }, answer: "How to ship?\nBy sea\n\nWhich sizes?\n10mm, 8mm\n\nWhere to?\nNot answered\n\nHow many?\n800 units" } };
  page.update(state(...events, entry(5, { form: "message", role: "user", content: fromBoard("How to ship?\nBy sea\n\nWhich sizes?\n10mm, 8mm\n\nWhere to?\nNot answered\n\nHow many?\n800 units", "待办", "lot.md") })));
  const answer = [...page.element.querySelectorAll(".item")].at(-1)!;
  expect([answer.className, [...answer.querySelectorAll(".oc-done-row")].map((row) => [...row.children].map((one) => one.textContent)), answer.querySelector(".said, .told-card, .actions")])
    .toEqual(["item asked", [["How to ship?", "By sea"], ["Which sizes?", "10mm, 8mm"], ["Where to?", "Not answered"], ["How many?", "800 units"]], null]);
  expect(page.element.querySelectorAll(".item.user")).toHaveLength(1);
  expect(drawn()[0]).toEqual(["Answered", 2, false]);
  // A yes or a no: its question over 是 or 否.
  rows = { ...rows, "待办/lot.md": { title: "Ship 10 units?", state: "answered", asked: { form: "comchatx.confirm/1", title: "Ship 10 units?" }, answered: { confirmed: true }, answer: "Ship 10 units?\nYes" } };
  page.update(state(...events, entry(5, { form: "message", role: "user", content: fromBoard("Ship 10 units?\nYes", "待办", "lot.md") })));
  expect(page.element.querySelectorAll(".item.user")).toHaveLength(1);
  expect([...[...page.element.querySelectorAll(".item.asked")].at(-1)!.querySelectorAll(".oc-done-row")].map((row) => [...row.children].map((one) => one.textContent))).toEqual([["Ship 10 units?", "Yes"]]);
});

it("draws the rows only for the message whose words the card saved as its answer; any other answer naming the card stands as its words", () => {
  const card = { form: "tool_call", id: "c1", name: "write", arguments: { path: "/tenant/board/acct-1/待办/lot.md", content: "---\ntitle: Ship?\n---\n" } };
  const wrote = [entry(1, { form: "message", role: "assistant", content: [card], stopReason: "toolUse" }), entry(2, { form: "message", role: "tool_result", toolCallId: "c1", toolName: "write", content: [{ form: "text", text: "ok" }], isError: false })];
  const said = (seq: number, words: string) => entry(seq, { form: "message", role: "user", content: fromBoard(words, "待办", "lot.md") });
  const asked = (words: string) => ({ form: "comchatx.options/1", questions: [{ words }] });
  const look = (row: unknown, ...answers: readonly ReturnType<typeof entry>[]): readonly unknown[] => {
    const page = new StreamView({ say: (key, values) => text("en", key, values), now: () => 0, day: () => "Today", language: () => "en", card: () => row as never });
    page.update(state(...wrote, ...answers));
    return [...page.element.querySelectorAll(".item.user, .item.asked")].map((one) => one.classList.contains("asked")
      ? ["rows", ...[...one.querySelectorAll(".oc-done-row")].map((row) => [...row.children].map((part) => part.textContent))]
      : ["words", one.querySelector(".said .markdown")?.textContent?.trim()]);
  };
  // Answered twice, the later answer saved: the earlier keeps its own words, the later stands as its rows.
  expect.soft(look({ title: "Ship?", state: "answered", asked: asked("Ship?"), answered: { answers: [{ chosen: ["B"] }] }, answer: "Ship?\nB" }, said(3, "Ship?\nA"), said(4, "Ship?\nB")))
    .toEqual([["words", "Ship?\nA"], ["rows", ["Ship?", "B"]]]);
  // The form replaced after the answer, a new answer saved for the new questions: the old answer is not drawn as the new form's.
  expect.soft(look({ title: "Ship?", state: "answered", asked: asked("Which port?"), answered: { answers: [{ chosen: ["LGB8"] }] }, answer: "Which port?\nLGB8" }, said(3, "Ship?\nBy sea")))
    .toEqual([["words", "Ship?\nBy sea"]]);
  // A text answer first, the options answered later: the text answer keeps its words.
  expect.soft(look({ title: "Ship?", state: "answered", asked: asked("Ship?"), answered: { answers: [{ chosen: ["By sea"] }] }, answer: "Ship?\nBy sea" }, said(3, "Hold it a week."), said(4, "Ship?\nBy sea")))
    .toEqual([["words", "Hold it a week."], ["rows", ["Ship?", "By sea"]]]);
});

it("takes a message mark's tip away as the stream draws that message again or lets it go, so no tip stands over a mark that has left", () => {
  const user = entry(1, { form: "message", role: "user", content: "Check the stock" });
  const answer = (words: string): StreamEvent => entry(2, { form: "message", role: "assistant", content: [{ form: "text", text: words }], stopReason: "stop" });
  const page = view();
  const shown = (): boolean => document.querySelector<HTMLElement>(".f-tip")?.hidden === false;
  // A mark with a tip inside the drawn answer, as its row's copy is: the pointer rests on it.
  const rest = (): void => {
    const mark = tip(h("button", { "aria-label": "Copy" }), "Copy");
    [...page.element.querySelectorAll("article.item")].at(-1)!.append(mark);
    mark.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
  };
  page.update(state(user, answer("Stock is low.")));
  rest();
  expect(shown()).toBe(true);
  page.update(state(user, answer("Stock is low in two marketplaces.")));
  expect(shown()).toBe(false);
  rest();
  page.redraw();
  expect(shown()).toBe(false);
});
