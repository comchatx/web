// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { Click, ClickEnd, PackageList } from "./backend.js";
import type { Plugin } from "./catalogue.js";
import { h } from "./dom.js";
import { failedUnder, failureUnder, noteWaited, queueOf, queueRow, queueSection, rowKey, runningRow, standsWords, updateQueued, type QueueContext, type QueueRow } from "./plugins-queue.js";
import { text, type StringKey } from "./strings.js";

const plugin = (id: string, name = id): Plugin => ({ id, name, author: "ComChatX", section: "extensions", about: { en: "", zh: "" }, builds: [], box: { package: id, source: `npm:${id}`, skills: [] } } as unknown as Plugin);
const PLUGINS = ["lw", "kp", "pdf"].map((id) => plugin(id));
const of = (source: string): Plugin | undefined => PLUGINS.find((one) => `npm:${one.id}` === source);
const click = (id: string, op: Click["op"] = "install"): Click => ({ id: `e-${id}-${op}`, op, source: `npm:${id}` });
const end = (id: string, at: number, op: ClickEnd["op"] = "install", ok = false): ClickEnd => ({ op, source: `npm:${id}`, ok, reason: "pi_failed", detail: "npm error code ETIMEDOUT", at });
const list = (more: Partial<PackageList>): PackageList => ({ packages: [{ name: "pdf", version: "1.0.0", source: "npm:pdf" } as never], onImage: [], asleep: false, waiting: [], ends: [], ...more });
const at = (rows: readonly QueueRow[]): readonly string[] => rows.map((row) => `${row.plugin.id} ${row.act} ${row.stands}`);
const idle = { power: "on", answering: false } as const;

describe("where each row of the queue stands", () => {
  it("waits for a computer that sleeps, every row, as cx's card says it sleeps, whatever the list keeps", () => {
    const waiting = [click("lw"), click("kp")];
    expect(at(queueOf(list({ waiting }), of, { ...idle, power: "off" as const }))).toEqual(["lw install wait", "kp install wait"]);
    expect(at(queueOf(list({ asleep: true, waiting }), of, { ...idle, power: "off" as const }))).toEqual(["lw install wait", "kp install wait"]);
  });
  it("runs the first on a computer that is on, the rest waiting their turn, in the row's order", () => {
    expect(at(queueOf(list({ waiting: [click("kp"), click("lw"), click("pdf", "update")] }), of, idle))).toEqual(["kp install running", "lw install turn", "pdf update turn"]);
  });
  it("waits for cx's answer to end, every row, while cx answers", () => {
    expect(at(queueOf(list({ waiting: [click("kp"), click("lw")] }), of, { ...idle, answering: true }))).toEqual(["kp install after", "lw install after"]);
  });
  it("runs none of them while the computer starts, and the first once it is on, as on a computer that was on", () => {
    const waiting = [click("lw"), click("kp")];
    expect(at(queueOf(list({ waiting }), of, { ...idle, power: "starting" }))).toEqual(["lw install wait", "kp install wait"]);
    expect(at(queueOf(list({ waiting }), of, { ...idle, power: "off" }))).toEqual(["lw install wait", "kp install wait"]);
    expect(at(queueOf(list({ waiting }), of, idle))).toEqual(["lw install running", "kp install turn"]);
  });
  it("runs none of them while a click ahead of the queue, a switch, is the computer's first", () => {
    expect(at(queueOf(list({ waiting: [click("pdf", "off"), click("lw")] }), of, idle))).toEqual(["lw install turn"]);
  });
  it("draws failures first, oldest first, and no failure of a source something waits on again", () => {
    const rows = queueOf(list({ waiting: [click("lw")], ends: [end("pdf", 9, "update"), end("kp", 3), end("lw", 1), end("pdf", 2, "on")] }), of, idle);
    expect(at(rows)).toEqual(["kp install failed", "pdf update failed", "lw install running"]);
    expect(rows[0]!.detail).toBe("npm error code ETIMEDOUT");
  });
  it("draws no failed update of a package no longer installed, nor a click done, nor anything of a list that says nothing of clicks", () => {
    const installed = (source: string): boolean => source === "npm:pdf";
    expect(at(queueOf(list({ ends: [end("kp", 2, "update"), end("pdf", 3, "update"), end("lw", 4, "install", true)] }), of, { ...idle, installed }))).toEqual(["pdf update failed"]);
    expect(queueOf({ packages: [], onImage: [], asleep: false }, of, idle)).toEqual([]);
    expect(queueOf(undefined, of, idle)).toEqual([]);
  });
  it("names the row running, and an update in the queue, failed or not", () => {
    const rows = queueOf(list({ waiting: [click("kp"), click("pdf", "update")], ends: [end("lw", 1, "update")] }), of, idle);
    expect([runningRow(rows)?.plugin.id, updateQueued(rows, plugin("pdf")), updateQueued(rows, plugin("lw")), updateQueued(rows, plugin("kp"))]).toEqual(["kp", true, true, false]);
  });
});

const say = (key: StringKey, values?: Readonly<Record<string, string | number>>): string => text("zh", key, values);

it("says where a row stands in one line for each state, an install's and an update's by their verbs", () => {
  const row = (stands: QueueRow["stands"], act: QueueRow["act"]): QueueRow => ({ plugin: plugin("kp"), act, stands, source: "npm:kp" });
  const states = ["wait", "after", "turn", "running", "failed"] as const;
  expect(states.map((one) => standsWords(say, row(one, "install")))).toEqual(["cx 的电脑开启后安装。", "cx 回答结束后安装。", "等待安装", "正在安装", "安装失败。"]);
  expect(states.map((one) => standsWords(say, row(one, "update")))).toEqual(["cx 的电脑开启后更新。", "cx 回答结束后更新。", "等待更新", "正在更新", "更新失败。"]);
});

describe("a row of the queue", () => {
  const context = () => {
    const cancel = vi.fn<(row: QueueRow) => void>();
    const retry = vi.fn<(row: QueueRow) => void>();
    const made: QueueContext = { say, language: "en", head: (one, focus) => ({ tile: document.createElement("span"), name: h("span", { class: "pl-row-name" }, h("a", { class: "pl-row-link", "data-focus": focus }, one.name)), line: "by Jev" }), cancel, retry };
    return { ...made, cancel, retry };
  };
  // What stands at a row's end: the state, by its ring or its mark and its word, then each control by its name and whether it takes a press.
  const ends = (row: HTMLElement): readonly string[] => [...row.querySelectorAll(".pl-row-end > *")].map((one) =>
    one.matches(".pl-q-state") ? `${one.querySelector(".pl-spin.pl-still") !== null ? "still" : one.querySelector(".pl-spin") !== null ? "ring" : "alert"} ${one.textContent}`
      : `${one.getAttribute("aria-label")}${(one as HTMLButtonElement).disabled ? " (off)" : ""}`);
  it("is one line under its name and ends in a still ring, its word and ×, which takes its click back, while it waits", () => {
    const made = context();
    const row = queueRow(made, { plugin: plugin("kp", "Keyword planner"), act: "install", stands: "turn", source: "npm:kp", id: "e1" });
    expect([row.querySelector(".pl-row-line")?.textContent, ends(row), row.querySelector(".pl-row-link")?.getAttribute("data-focus")]).toEqual(["by Jev", ["still 等待安装", "取消安装 Keyword planner"], "queue install npm:kp"]);
    row.querySelector<HTMLButtonElement>(".pl-row-end button")!.click();
    expect(made.cancel).toHaveBeenCalledTimes(1);
    const off = queueRow(made, { plugin: plugin("kp", "Keyword planner"), act: "install", stands: "wait", source: "npm:kp", id: "e1" });
    expect(ends(off)).toEqual(["still cx 的电脑开启后安装。", "取消安装 Keyword planner"]);
  });
  it("turns the ring while it runs, its × in its place and taking no press", () => {
    const row = queueRow(context(), { plugin: plugin("kp", "Keyword planner"), act: "update", stands: "running", source: "npm:kp", id: "e1" });
    expect([ends(row), row.querySelector(".pl-q-state")?.getAttribute("role")]).toEqual([["ring 正在更新", "取消更新 Keyword planner (off)"], "status"]);
  });
  it("says a failure as 安装失败。 by the alert mark with no reason, and ends in the retry mark and ×", () => {
    const made = context();
    const row = queueRow(made, { plugin: plugin("kp", "Keyword planner"), act: "install", stands: "failed", source: "npm:kp", detail: "npm error code E404" });
    expect([ends(row), row.querySelector(".pl-q-state")?.getAttribute("role"), row.textContent?.includes("E404")]).toEqual([["alert 安装失败。", "重试安装 Keyword planner", "取消安装 Keyword planner"], "alert", false]);
    const [again, cross] = [...row.querySelectorAll<HTMLButtonElement>(".pl-row-end button")];
    again!.click();
    expect([made.retry.mock.calls.length, made.cancel.mock.calls.length, again!.dataset["focus"], cross!.dataset["focus"]]).toEqual([1, 0, "retry install npm:kp", "cancel install npm:kp"]);
  });
  it("is drawn in a section of its own, its count beside its heading, and nowhere where the queue holds nothing", () => {
    const rows: readonly QueueRow[] = [{ plugin: plugin("kp"), act: "install", stands: "running", source: "npm:kp", id: "1" }, { plugin: plugin("lw"), act: "install", stands: "turn", source: "npm:lw", id: "2" }];
    const section = queueSection(context(), rows)!;
    expect([section.id, section.querySelector("h2")?.textContent, section.querySelectorAll("li").length]).toEqual(["queue", "队列2", 2]);
    expect(queueSection(context(), [])).toBeUndefined();
  });
});

describe("the chat's word under a message that waited behind the queue", () => {
  const row = (id: string, stands: QueueRow["stands"]): QueueRow => ({ plugin: plugin(id, id.toUpperCase()), act: "install", stands, source: `npm:${id}`, ...(stands === "failed" ? { detail: "npm error code E404" } : { id }) });
  it("notes what each held message waits behind, and says under it only what of that failed, or runs again after failing", () => {
    const waited = new Map<string, Set<string>>();
    const seen = new Set<string>();
    noteWaited(waited, seen, [row("kp", "running"), row("lw", "turn")], ["sent-0"]);
    // A failure that came before the message is not what it waited for; a message sent later waits behind what is there then.
    noteWaited(waited, seen, [row("kp", "failed"), row("lw", "running")], ["sent-1"]);
    expect([[...waited.get("sent-0")!], [...waited.get("sent-1")!], [...seen]]).toEqual([["install npm:kp", "install npm:lw"], ["install npm:lw"], ["install npm:kp"]]);
    expect(failedUnder([row("kp", "failed"), row("lw", "running")], waited.get("sent-0")!, seen).map(rowKey)).toEqual(["install npm:kp"]);
    expect(failedUnder([row("kp", "failed")], waited.get("sent-1")!, seen)).toEqual([]);
    // 重试 pressed: it runs again, and the line stays with the ring; landed, the row leaves the queue and the line goes.
    noteWaited(waited, seen, [row("kp", "running")], []);
    expect(failedUnder([row("kp", "running")], waited.get("sent-0")!, seen).map(rowKey)).toEqual(["install npm:kp"]);
    noteWaited(waited, seen, [], []);
    expect([failedUnder([], waited.get("sent-0")!, seen), [...seen]]).toEqual([[], []]);
  });
  it("draws the failure with npm's words and 重试, whose place turns the ring while it runs again", () => {
    const retry = vi.fn();
    const failed = failureUnder(say, "en", row("kp", "failed"), retry);
    expect([failed.querySelector(".pl-failed-text")?.textContent, failed.querySelector(".pl-failed-text")?.getAttribute("role"), failed.querySelector("button")?.getAttribute("aria-label")]).toEqual(["KP 安装失败。 “npm error code E404”", "alert", "重试安装 KP"]);
    failed.querySelector("button")!.click();
    expect(retry).toHaveBeenCalledTimes(1);
    const running = failureUnder(say, "en", row("kp", "running"), retry);
    const ring = running.querySelector("button")!;
    expect([ring.getAttribute("aria-busy"), ring.getAttribute("aria-label"), ring.querySelector(".pl-spin") !== null, running.querySelector(".pl-failed-text")?.getAttribute("role")]).toEqual(["true", "正在安装 KP…", true, "status"]);
  });
});
