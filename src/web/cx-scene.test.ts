import { describe, expect, it } from "vitest";
import type { Blocked } from "./box-state.js";
import { ACT_WORDS, begins, kindOf, MINUTE_MS, scene, turnOf, type Card, type Kind, type SceneInput } from "./cx-scene.js";
import { EMPTY, type Block, type Item, type StreamState } from "./stream-model.js";
import { text } from "./strings.js";

const user = (words: string): Item => ({ kind: "user", key: "u", text: words, pending: false, at: undefined });
const answer = (blocks: readonly Block[], draft = true): Item => ({ kind: "assistant", key: "a", blocks, draft, stopReason: undefined, errorMessage: undefined });
const tool = (command: string, done = false): Block => ({ kind: "tool_call", id: "t", name: "bash", args: { command }, argsText: "", partial: undefined, result: done ? { text: "ok", isError: false } : undefined });
const at = (items: readonly Item[], turn: boolean | undefined = true): StreamState => ({ ...EMPTY, items, turn });
/** What the answer is doing when pi is at work exactly while the stream's turn runs. */
const turnIn = (stream: StreamState) => turnOf(stream, stream.turn === true);
const NOW = 1_000_000;
const awake: SceneInput = {
  pending: false, box: "awake", closing: false, stream: at([], false), atWork: false, refusal: undefined, floor: false, unreachable: false, asking: false, low: false,
  typing: false, draft: 0, sleepDueAt: undefined, now: NOW,
};
const asleep: SceneInput = { ...awake, box: "asleep" };
const working = (items: readonly Item[]): SceneInput => ({ ...awake, stream: at(items), atWork: true });
const refused = (reason: string): Blocked => ({ kind: "refused", reason });
const failed = (status: number | undefined, reason?: string, step: "box" | "session" = "box"): Blocked => ({ kind: "failed", step, status, reason });
const said = (card: Card, language: "en" | "zh" = "zh") => [text(language, card.title.key, card.title.values), ...card.acts.map((act) => text(language, ACT_WORDS[act]))];
const KINDS: readonly Kind[] = ["unknown", "off", "starting", "on", "working", "refused", "failed", "balance", "unreachable", "unreachableAsleep"];

describe("what the answer is doing, from the stream's last block", () => {
  it("is nothing while pi is not at work, whatever the stream holds", () => {
    expect(turnIn(at([user("hi"), answer([{ kind: "text", text: "draft" }])], false))).toBe("none");
    expect(turnOf({ ...EMPTY, items: [user("hi")], turn: undefined }, false)).toBe("none");
  });

  it("reads a message sent before the box has named its turn: pi is at work from the send", () => {
    expect(turnOf({ ...EMPTY, items: [user("hi")], turn: undefined }, true)).toBe("reading");
    expect(turnOf(at([user("hi")], false), true)).toBe("reading");
  });

  it("reads the message sent until something comes back, thinks, writes, and analyses while any step runs, whatever its command buys", () => {
    expect(turnIn(at([user("hi")]))).toBe("reading");
    expect(turnIn(at([user("hi"), answer([])]))).toBe("reading");
    expect(turnIn(at([user("hi"), answer([{ kind: "thinking", text: "hmm" }])]))).toBe("thinking");
    expect(turnIn(at([user("hi"), answer([{ kind: "thinking", text: "hmm" }, { kind: "text", text: "So" }])]))).toBe("writing");
    expect(turnIn(at([user("hi"), answer([tool("cx get amazon/de/B0MADEUPA4/price-history")], false)]))).toBe("analysing");
    expect(turnIn(at([user("hi"), answer([tool("  cx get keepa/x")])]))).toBe("analysing");
  });

  it("calls any other running tool, a tool done before the next message, and a landed thought analysing", () => {
    expect(turnIn(at([user("hi"), answer([tool("ls -la")], false)]))).toBe("analysing");
    expect(turnIn(at([user("hi"), answer([tool("cx getter x")], false)]))).toBe("analysing");
    expect(turnIn(at([user("hi"), answer([tool("cx get a/b", true)], false)]))).toBe("analysing");
    expect(turnIn(at([user("hi"), answer([{ kind: "thinking", text: "hmm" }], false)]))).toBe("analysing");
    expect(turnIn(at([user("hi"), { kind: "tool_result", key: "r", toolName: "bash", result: { text: "", isError: false } }]))).toBe("analysing");
  });
});

describe("which of its kinds the corner is in", () => {
  it("is under the floor for an account without a computer, a start while one is asked, and unknown for a box not read, whatever else is known", () => {
    for (const box of ["unknown", "asleep", "waking", "awake"] as const) expect(kindOf({ ...awake, box, pending: true })).toBe("balance");
    expect(kindOf({ ...asleep, box: "waking", refusal: refused("global_limit"), floor: true, unreachable: true })).toBe("starting");
    // Asleep is never drawn for a box the page has not read: not under the floor, not out of reach, not after a refusal.
    expect(kindOf({ ...asleep, box: "unknown", refusal: refused("balance"), floor: true, unreachable: true })).toBe("unknown");
  });

  it("is on or working for a box heard awake, off for one asleep or going to sleep, and out of reach by what was last heard", () => {
    expect([kindOf(awake), kindOf(working([user("hi")])), kindOf(asleep), kindOf({ ...awake, closing: true })]).toEqual(["on", "working", "off", "off"]);
    expect([kindOf({ ...awake, unreachable: true }), kindOf({ ...working([user("hi")]), unreachable: true }), kindOf({ ...asleep, unreachable: true })]).toEqual(["unreachable", "unreachable", "unreachableAsleep"]);
  });

  it("draws cx at rest at its desk out of reach, whatever the turn last heard was doing", () => {
    const writing = working([user("hi"), { kind: "assistant", key: "a", blocks: [{ kind: "text", text: "Point 1." }], draft: true, stopReason: undefined, errorMessage: undefined }]);
    const drawn = (input: SceneInput): readonly unknown[] => { const one = scene(input); return [one.state, one.out, one.signals.reading, one.signals.thinking, one.signals.dot, one.mark]; };
    expect(scene(writing).out).toBe(true);
    for (const input of [writing, working([user("hi")]), awake]) expect(drawn({ ...input, unreachable: true })).toEqual(["ready", false, false, false, "heard", true]);
  });

  it("ends a start in the one kind its answer names: the balance, the platform full or the box's day of egress spent, an account without a computer, no answer at all, and anything else a failure", () => {
    expect(["balance", "global_limit", "organisation_limit", "egress", "volume_capacity", "generation_exhausted"].map((reason) => kindOf({ ...asleep, refusal: refused(reason) })))
      .toEqual(["balance", "refused", "refused", "refused", "failed", "failed"]);
    expect(kindOf({ ...asleep, refusal: failed(409, "box_pending") })).toBe("balance");
    expect([kindOf({ ...asleep, refusal: failed(503, "indeterminate") }), kindOf({ ...asleep, refusal: failed(500, "box is closing", "session") })]).toEqual(["failed", "failed"]);
    expect(kindOf({ ...asleep, refusal: failed(undefined) })).toBe("unreachableAsleep");
    expect(kindOf({ ...asleep, floor: true, refusal: refused("global_limit") })).toBe("balance");
    // What an open came to is about a sleeping box: one heard awake since is on.
    expect(kindOf({ ...awake, refusal: refused("global_limit"), floor: true })).toBe("on");
  });
});

describe("the two cards", () => {
  const cards = (input: SceneInput, language: "en" | "zh" = "zh") => { const drawn = scene(input).cards; return { cx: said(drawn.cx, language), computer: said(drawn.computer, language) }; };

  it("answer in every kind with one line of what each is doing now", () => {
    const inputs: readonly SceneInput[] = [
      { ...asleep, box: "unknown" }, asleep, { ...asleep, box: "waking" }, awake, working([user("hi")]), { ...asleep, refusal: refused("global_limit") },
      { ...asleep, refusal: failed(502) }, { ...asleep, floor: true }, { ...awake, unreachable: true }, { ...asleep, unreachable: true },
    ];
    expect(inputs.map((input) => scene(input).kind)).toEqual(KINDS);
    for (const input of inputs) for (const language of ["en", "zh"] as const) {
      const drawn = cards(input, language);
      for (const line of [...drawn.cx, ...drawn.computer]) expect(line, `${scene(input).kind} ${language}`).not.toMatch(/^$|^cx\.|\{|请稍后再试|try again later/i);
    }
  });

  it("offer the switch where the computer is off, on the computer's card alone, and nothing where it cannot be switched on", () => {
    expect(cards(asleep)).toEqual({ cx: ["cx 休眠中"], computer: ["cx 的电脑已关机", "开机"] });
    expect(cards(asleep, "en")).toEqual({ cx: ["cx is asleep"], computer: ["cx's computer is off", "Switch on"] });
    // Under the floor neither card has an action or a word of money: the closed message box carries both.
    for (const input of [{ ...asleep, floor: true }, { ...asleep, refusal: refused("balance") }]) expect(cards(input)).toEqual({ cx: ["cx 休眠中"], computer: ["cx 的电脑已关机"] });
    for (const language of ["en", "zh"] as const) expect(Object.values(cards({ ...asleep, floor: true }, language)).flat().join(" ")).not.toMatch(/余额|充值|balance|top up|\$/i);
  });

  it("say a start with nothing to press, and draw an account without a computer as under the floor", () => {
    expect(cards({ ...asleep, box: "waking" })).toEqual({ cx: ["cx 唤醒中"], computer: ["cx 的电脑正在开机"] });
    expect(cards({ ...awake, pending: true })).toEqual({ cx: ["cx 休眠中"], computer: ["cx 的电脑已关机"] });
    expect(cards({ ...asleep, refusal: failed(409, "box_pending") })).toEqual({ cx: ["cx 休眠中"], computer: ["cx 的电脑已关机"] });
  });

  it("offer Try again and then Get help on the computer's card where a start did not happen, and none on cx's: no control stands in both", () => {
    expect(cards({ ...asleep, refusal: refused("global_limit") })).toEqual({ cx: ["cx 休眠中"], computer: ["cx 的电脑暂时无法开机", "重试", "获取帮助"] });
    expect(cards({ ...asleep, refusal: failed(502) })).toEqual({ cx: ["cx 休眠中"], computer: ["cx 的电脑开机失败", "重试", "获取帮助"] });
    expect(cards({ ...asleep, refusal: failed(502) }, "en")).toEqual({ cx: ["cx is asleep"], computer: ["cx's computer didn't switch on", "Try again", "Get help"] });
    expect(cards({ ...asleep, refusal: refused("global_limit") }, "en").computer[0]).toBe("cx's computer can't switch on right now");
  });

  it("offer Stop on cx and Stop and switch off on its computer while cx works", () => {
    expect(cards(working([user("hi")]))).toEqual({ cx: ["cx 正在工作", "停止"], computer: ["cx 正在使用电脑", "停止并关机"] });
    expect(cards(working([user("hi")]), "en")).toEqual({ cx: ["cx is working", "Stop"], computer: ["cx is using its computer", "Stop and switch off"] });
  });

  it("say only that the page is reconnecting where it cannot know more, and that cx is asleep where that was last heard", () => {
    for (const input of [{ ...asleep, box: "unknown" as const }, { ...awake, unreachable: true }]) expect(cards(input)).toEqual({ cx: ["正在重新连接"], computer: ["正在重新连接"] });
    expect(cards({ ...asleep, unreachable: true })).toEqual({ cx: ["cx 休眠中"], computer: ["正在重新连接"] });
    expect(cards({ ...asleep, refusal: failed(undefined) }, "en")).toEqual({ cx: ["cx is asleep"], computer: ["Reconnecting"] });
  });

  it("say when the computer switches itself off in whole minutes rounded down, an hour and more in hours, the last minute in its own words, and no time where no sleep is due", () => {
    const title = (left: number | undefined, language: "en" | "zh" = "zh") => cards({ ...awake, sleepDueAt: left === undefined ? undefined : NOW + left }, language).computer;
    expect(title(10 * MINUTE_MS - 1)).toEqual(["cx 的电脑已开机，9 分钟后关机", "关机"]);
    expect(title(2 * MINUTE_MS)).toEqual(["cx 的电脑已开机，2 分钟后关机", "关机"]);
    expect([title(2 * MINUTE_MS - 1)[0], title(MINUTE_MS + 1)[0]]).toEqual(["cx 的电脑已开机，1 分钟后关机", "cx 的电脑已开机，1 分钟后关机"]);
    // A minute left is the yawn's minute: the card says 1 分钟内 from the moment cx is sleepy.
    expect([title(MINUTE_MS)[0], title(MINUTE_MS - 1)[0], title(0)[0], title(-5000)[0]]).toEqual(Array(4).fill("cx 的电脑已开机，1 分钟内关机"));
    expect([title(undefined), title(undefined, "en")]).toEqual([["cx 的电脑已开机", "关机"], ["cx's computer is on", "Switch off"]]);
    expect([title(9.5 * MINUTE_MS, "en")[0], title(1.5 * MINUTE_MS, "en")[0], title(1000, "en")[0]])
      .toEqual(["cx's computer is on for 9 more minutes", "cx's computer is on for 1 more minute", "cx's computer is on for under a minute more"]);
    // An hour and more, which a seller's own idle time reaches, is said in hours and minutes, as the computer's window says it.
    expect([title(60 * MINUTE_MS + 1)[0], title(90.5 * MINUTE_MS)[0], title(480 * MINUTE_MS, "en")[0], title(59.9 * MINUTE_MS)[0]])
      .toEqual(["cx 的电脑已开机，1 小时后关机", "cx 的电脑已开机，1 小时 30 分钟后关机", "cx's computer is on. Switches off in 8 hr", "cx 的电脑已开机，59 分钟后关机"]);
    expect(cards(awake).cx).toEqual(["cx 已就绪", "整理上下文"]);
  });

  it("name a computer kept on with a new version waiting as on with it, and only one that is on", () => {
    expect([cards({ ...awake, newer: true }).computer, cards({ ...awake, newer: true }, "en").computer])
      .toEqual([["cx 的电脑已开机，有新版本", "关机"], ["cx's computer is on. New version available", "Switch off"]]);
    expect(cards({ ...asleep, newer: true }).computer).toEqual(cards(asleep).computer);
  });

  it("say a restart on both, whatever the computer was doing: the computer restarting and cx waking, with nothing offered", () => {
    expect([cards({ ...awake, restarting: true }), cards({ ...awake, restarting: true }, "en")]).toEqual([
      { cx: ["cx 唤醒中"], computer: ["正在重启…"] }, { cx: ["cx is waking up"], computer: ["Restarting…"] },
    ]);
  });

  it("say a switch-off on both until it answers, whatever the box says on the way: the computer switching off, cx asleep, nothing offered, its power light a start's", () => {
    for (const closing of [false, true]) {
      expect([cards({ ...awake, closing, asking: true, switchingOff: true }), cards({ ...awake, closing, asking: true, switchingOff: true }, "en")]).toEqual([
        { cx: ["cx 休眠中"], computer: ["cx 的电脑正在关机"] }, { cx: ["cx is asleep"], computer: ["cx's computer is switching off"] },
      ]);
    }
    const drawn = scene({ ...awake, asking: true, switchingOff: true });
    expect([drawn.state, drawn.signals.dot, drawn.out]).toEqual(["sleeping", "starting", false]);
  });

  it("offer nothing on an idle computer while something asked from a card has not answered", () => {
    expect(cards({ ...awake, asking: true })).toEqual({ cx: ["cx 已就绪"], computer: ["cx 的电脑已开机"] });
  });
});

describe("what cx says as a kind begins", () => {
  it("says nothing of a start, which the line beside cx's desk says, and that the computer came up only after one", () => {
    for (const was of [undefined, "unknown", "off", "refused", "failed", "balance"] as const) expect(begins(was, "starting"), String(was)).toBeUndefined();
    expect(begins("starting", "on")).toEqual({ key: "cx.say.ready", stays: "moment" });
    for (const was of [undefined, "unknown", "off", "working", "unreachable"] as const) expect(begins(was, "on"), String(was)).toBeUndefined();
  });

  it("says a start that did not happen until the person acts", () => {
    expect((["refused", "failed", "balance"] as const).map((now) => begins("starting", now))).toEqual([
      { key: "cx.say.refused", stays: "act" }, { key: "cx.say.failed", stays: "act" }, { key: "cx.say.balance", stays: "act" },
    ]);
    expect((["cx.say.refused", "cx.say.failed", "cx.say.balance", "cx.say.ready"] as const).map((key) => [text("zh", key), text("en", key)])).toEqual([
      ["暂时无法开机", "Can't switch on right now"], ["开机失败", "Didn't switch on"], ["余额不足", "Balance too low"], ["已就绪", "Ready"],
    ]);
  });

  it("says out of reach for a moment, once across its two", () => {
    expect([begins("on", "unreachable"), begins("off", "unreachableAsleep")]).toEqual([{ key: "status.reconnecting", stays: "moment" }, { key: "status.reconnecting", stays: "moment" }]);
    expect([begins("unreachable", "unreachableAsleep"), begins("unreachableAsleep", "unreachable")]).toEqual([undefined, undefined]);
  });

  it("says nothing while cx works, as the computer goes off, before the first reading, or of a kind it was already in", () => {
    for (const was of [undefined, ...KINDS]) for (const now of ["working", "off", "unknown"] as const) expect(begins(was, now), `${was} ${now}`).toBeUndefined();
    for (const kind of KINDS) expect(begins(kind, kind), kind).toBeUndefined();
  });
});

describe("cx at its computer", () => {
  it("draws the computer asleep, coming on and on, with its light", () => {
    expect(scene(asleep)).toMatchObject({ kind: "off", state: "sleeping", signals: { dot: "asleep", reason: undefined, heard: false }, mark: false });
    expect(scene({ ...asleep, box: "waking" })).toMatchObject({ kind: "starting", state: "waking", signals: { dot: "starting", reason: undefined } });
    expect(scene(awake)).toMatchObject({ kind: "on", state: "ready", signals: { dot: "ready", heard: false }, out: false, mark: false });
    expect(scene({ ...awake, pending: true })).toMatchObject({ kind: "balance", state: "sleeping", signals: { dot: "asleep", reason: "balance" } });
  });

  it("draws a box not read yet as a dark screen with cx at rest and the hollow light, never asleep and with no glyph", () => {
    const unread = scene({ ...asleep, box: "unknown", floor: true, refusal: refused("balance"), unreachable: true, low: false });
    expect(unread).toMatchObject({ kind: "unknown", state: "ready", signals: { dot: "heard", heard: true, reason: undefined }, out: false, mark: false });
    // Out of reach before it was ever heard, it is drawn so and speaks as a break does after: 「正在重新连接」.
    expect([unread.speaks, scene({ ...asleep, box: "unknown", low: false }).speaks]).toEqual(["unreachable", "unknown"]);
  });

  it("draws a start that did not happen by its glyph: the coin, the seats, the bang, and no signal", () => {
    expect(scene({ ...asleep, floor: true })).toMatchObject({ state: "sleeping", signals: { reason: "balance" } });
    expect(scene({ ...asleep, refusal: refused("organisation_limit") })).toMatchObject({ state: "sleeping", signals: { reason: "seats" } });
    expect(scene({ ...asleep, refusal: failed(500, undefined, "session") })).toMatchObject({ state: "sleeping", signals: { reason: "failed" } });
    expect(scene({ ...asleep, refusal: refused("generation_exhausted") }).signals.reason).toBe("failed");
    expect(scene({ ...asleep, unreachable: true })).toMatchObject({ state: "sleeping", signals: { reason: "unreachable", dot: "asleep" }, mark: false });
    // A refusal is about opening: an awake box under the floor keeps its screen lit.
    expect(scene({ ...awake, floor: true }).signals.reason).toBeUndefined();
  });

  it("holds the last-heard picture out of reach with the computer on: lit, cx at rest, the hollow light, and the page's own mark", () => {
    expect(scene({ ...awake, unreachable: true })).toMatchObject({ kind: "unreachable", state: "ready", signals: { dot: "heard", heard: false, reason: undefined }, mark: true });
  });

  it("types while the person types and keeps the draft on its screen, only while the computer is on and free", () => {
    expect(scene({ ...awake, typing: true, draft: 12 }).signals).toMatchObject({ typing: true, draft: 12 });
    expect(scene({ ...awake, draft: 12 }).signals).toMatchObject({ typing: false, draft: 12 });
    expect(scene({ ...asleep, typing: true, draft: 12 }).signals).toMatchObject({ typing: false, draft: 0 });
    expect(scene({ ...working([user("hi"), answer([{ kind: "text", text: "So" }])]), typing: true, draft: 12 }).signals).toMatchObject({ typing: false, draft: 0 });
  });

  it("reads the message sent at its desk, and is out beside the answer from the first thing back until nothing is at work", () => {
    expect(scene(working([user("price history")]))).toMatchObject({ kind: "working", state: "ready", signals: { reading: true, draft: 13, dot: "working" }, out: false });
    expect(scene({ ...awake, stream: { ...EMPTY, items: [user("price history")], turn: undefined }, atWork: true })).toMatchObject({ kind: "working", signals: { reading: true, draft: 13, dot: "working" } });
    expect(scene(working([user("hi"), answer([{ kind: "thinking", text: "hmm" }])]))).toMatchObject({ state: "ready", signals: { thinking: true }, out: true });
    expect(scene(working([user("hi"), answer([tool("cx get a/b")], false)]))).toMatchObject({ state: "analysing", signals: { reading: false, thinking: false }, out: true });
    expect(scene(working([user("hi"), answer([{ kind: "text", text: "Four" }])]))).toMatchObject({ state: "writing", signals: { text: 4 }, out: true });
    expect(scene({ ...awake, stream: at([user("hi"), answer([{ kind: "text", text: "Four" }], false)], false) }).out).toBe(false);
  });

  it("keeps its pose when a message is sent while it works: the message waits below the answer", () => {
    const queued: Item = { kind: "user", key: "q", text: "and one more", pending: true, at: undefined, queued: true };
    const writing = [user("hi"), answer([{ kind: "text", text: "Four" }])];
    expect(scene(working([...writing, queued]))).toMatchObject({ state: "writing", signals: { text: 4, reading: false }, out: true });
    expect(turnIn(at([...writing, queued]))).toBe("writing");
    // Asleep or switching on, cx is at its desk however the message was sent.
    expect(scene({ ...working([user("hi")]), box: "waking" }).out).toBe(false);
  });

  it("does not draw cx writing beside a finished answer while a compaction runs after it, and keeps it writing into the turn's end otherwise", () => {
    const finished = [user("hi"), answer([{ kind: "text", text: "Four" }], false)];
    const compacting = { ...at(finished), tidying: true };
    expect(scene({ ...working(finished), stream: compacting }).state).not.toBe("writing");
    expect(turnIn(compacting)).toBe("analysing");
    // Between the answer's entry and the turn's end nothing is analysed: cx does not turn to its rows for a moment before it rests.
    expect(turnIn(at(finished))).toBe("writing");
    expect(scene(working(finished)).state).toBe("writing");
  });

  it("yawns in the box's last minute before sleep, and not while the person types or a turn runs", () => {
    const due = (inMs: number, over: Partial<SceneInput> = {}) => scene({ ...awake, sleepDueAt: NOW + inMs, ...over });
    expect(due(MINUTE_MS + 1).signals.sleepy).toBe(false);
    expect(due(MINUTE_MS).signals.sleepy).toBe(true);
    expect(due(1000, { typing: true }).signals.sleepy).toBe(false);
    expect(due(1000, working([user("hi")])).signals.sleepy).toBe(false);
    expect(scene(awake).signals.sleepy).toBe(false);
  });

  it("keeps the coin on the screen while the balance is under one unit", () => {
    expect(scene({ ...awake, low: true }).signals.low).toBe(true);
    expect(scene(awake).signals.low).toBe(false);
  });
});
