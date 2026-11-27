/**
 * The queue: the installs and updates that wait their turn on cx's computer, first in Yours while it holds anything (ruled 2026-11-10).
 * What it holds is the platform's list, never the page's memory of a press: each install or update the account's row still keeps, in
 * the row's order, and each failure the computer reported that the list keeps until 重试 or 取消. Where each stands is read from that
 * order and the computer's state, as the computer runs one at a time, in the list's order, when no answer of cx's is going.
 */
import { nameIn, type Plugin } from "./catalogue.js";
import type { Click, ClickEnd, PackageList } from "./backend.js";
import { h, type Child } from "./dom.js";
import { piWords } from "./plugins-cards.js";
import { iconAct, rowIcon } from "./plugins-row.js";
import { spinner } from "./waiting.js";
import type { Language, StringKey } from "./strings.js";

type Say = (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;

/** Waiting for cx's computer to start, for cx's answer to end, for its turn behind the one running; running; or failed. */
export type Stands = "wait" | "after" | "turn" | "running" | "failed";
export type QueueAct = "install" | "update";
/** One row: the plugin, the act, where it stands, the entry's id while it waits, and npm's words where it failed. */
export type QueueRow = { readonly plugin: Plugin; readonly act: QueueAct; readonly stands: Stands; readonly source: string; readonly id?: string; readonly detail?: string };

/** cx's computer as cx's card holds it: off (or closing), starting, or on. */
export type Power = "off" | "starting" | "on";
/** What the queue reads beside the list: cx's computer as cx's card holds it, whether an answer of cx's is going, and whether a source is installed. */
export type Computer = { readonly power: Power; readonly answering: boolean; readonly installed?: (source: string) => boolean };

export const queued = (op: Click["op"]): op is QueueAct => op === "install" || op === "update";

/**
 * The rows, failures first, oldest first, then what waits in the row's order. On a computer that sleeps every row waits for it; while
 * it starts, the one it said it runs runs and the rest wait their turn, and with nothing said yet every row still waits for it; on, the
 * first runs and the rest wait their turn, unless cx is answering, when every row waits for the answer to end. A failure the list keeps
 * for a source that something waits on again is that click's, and is not drawn; nor is a failed update of a package no longer installed,
 * which has nothing to update.
 */
export function queueOf(list: PackageList | undefined, of: (source: string) => Plugin | undefined, computer: Computer): readonly QueueRow[] {
  if (list?.waiting === undefined) return [];
  const waits = list.waiting.filter((one): one is Click & { readonly op: QueueAct } => queued(one.op));
  const failures = (list.ends ?? []).filter((end): end is ClickEnd & { readonly op: QueueAct } => !end.ok && queued(end.op) && !waits.some((one) => one.source === end.source) && (end.op !== "update" || computer.installed?.(end.source) !== false)).sort((a, b) => a.at - b.at);
  const rows: QueueRow[] = [];
  for (const end of failures) {
    const plugin = of(end.source);
    if (plugin !== undefined) rows.push({ plugin, act: end.op, stands: "failed", source: end.source, ...(end.detail === undefined ? {} : { detail: end.detail }) });
  }
  // A click the list names ahead of the queue's — a pick, a switch — runs before them: the first of the queue runs only once nothing is ahead of it.
  const ahead = list.waiting.length > 0 && !queued(list.waiting[0]!.op);
  waits.forEach((click, place) => {
    const plugin = of(click.source);
    if (plugin === undefined) return;
    // Off or starting, nothing runs yet: a start names no plugin, and what waits runs once the computer is on.
    const stands: Stands = computer.power !== "on" ? "wait"
      : computer.answering ? "after"
      : place === 0 && !ahead ? "running" : "turn";
    rows.push({ plugin, act: click.op, stands, source: click.source, id: click.id });
  });
  return rows;
}

/** The row a plugin's install stands at in the queue, failed or not: what Discover's card draws in ✓'s place. */
export const installRow = (rows: readonly QueueRow[], plugin: Plugin): QueueRow | undefined => rows.find((row) => row.act === "install" && row.plugin.id === plugin.id);
/** Whether a plugin's update is in the queue, waiting or failed: its row there holds its presses, and its shelf's row offers no Update. */
export const updateQueued = (rows: readonly QueueRow[], plugin: Plugin): boolean => rows.some((row) => row.act === "update" && row.plugin.id === plugin.id);
/**
 * Whether Update is held back for a plugin: its update is in the queue, waiting or failed, or ended well beside a list the platform
 * answered from the account's row while changes wait, whose packages still name the version before it. The next list cx's computer
 * answers itself names the new one.
 */
export const updateHeld = (list: PackageList | undefined, rows: readonly QueueRow[], plugin: Plugin, source: string | undefined): boolean =>
  updateQueued(rows, plugin) || (list?.asleep === true && (list.ends ?? []).some((end) => end.op === "update" && end.ok && end.source === source));
/** The row cx's computer runs, for the line above the message box. */
export const runningRow = (rows: readonly QueueRow[]): QueueRow | undefined => rows.find((row) => row.stands === "running");

/** A row's line: where it stands, one line for one state, the same for an install and an update but for its verb. */
export function standsWords(say: Say, row: QueueRow): string {
  const update = row.act === "update";
  switch (row.stands) {
    case "wait": return say(update ? "pl.updateQueued" : "pl.installQueued");
    case "after": return say(update ? "pl.updateAfterAnswer" : "pl.installAfterAnswer");
    case "turn": return say(update ? "pl.q.turnUpdate" : "pl.q.turnInstall");
    case "running": return say(update ? "pl.q.updating" : "pl.q.installing");
    case "failed": return say(update ? "pl.fail.updateHere" : "pl.fail.installHere");
  }
}

/** A plugin row's head as the page draws it on a shelf: its tile, its name, which is the row's link, with the marks beside it, and its line. */
export type RowHead = { readonly tile: Child; readonly name: HTMLElement; readonly line: string };
/** What a queue row is drawn with: the words, the head a shelf's row of the plugin has, and the two presses. */
export type QueueContext = {
  readonly say: Say;
  readonly language: Language;
  readonly head: (plugin: Plugin, focus: string) => RowHead;
  readonly cancel: (row: QueueRow) => void;
  readonly retry: (row: QueueRow) => void;
  /** A member of an organization: what fails is theirs to take back, never to try again, and what waits is the admin's to cancel. */
  readonly member?: boolean;
};

/** Where the keyboard is put on a row's end: 取消 by the row's source, 重试 beside it. */
export const cancelPlace = (row: QueueRow): string => `cancel ${row.act} ${row.source}`;
export const retryPlace = (row: QueueRow): string => `retry ${row.act} ${row.source}`;

/**
 * A failed install or update in the page's words under a message on the chat: the plugin's sentence and npm's words quoted. While a 重试
 * runs, it keeps the sentence alone. The queue's row says the failure without its reason.
 */
export function failedLine(say: Say, language: Language, row: QueueRow): HTMLElement {
  const failed = row.stands === "failed";
  const named = say(row.act === "update" ? "pl.fail.update" : "pl.fail.install", { name: nameIn(row.plugin, language) });
  const words = failed && row.detail !== undefined && row.detail.trim() !== "" ? say("signIn.quoted", { words: piWords(row.detail) }) : "";
  return h("span", { class: "pl-failed-text", role: failed ? "alert" : "status" },
    named, words !== "" && " ", words !== "" && h("span", { class: "pl-failed-words", lang: "en" }, words));
}

/** 重试 under a message on the chat. */
function retryButton(say: Say, language: Language, row: QueueRow, retry: () => void): HTMLElement {
  return h("button", { type: "button", class: "pl-again", "aria-label": say(row.act === "update" ? "pl.q.retryUpdate" : "pl.q.retryInstall", { name: nameIn(row.plugin, language) }), onclick: retry }, say("pl.tryAgain"));
}

/**
 * A row of the queue, one row's height as every row of 我的 (sheet 1, ruled 2026-11-13): the head a shelf's row of the plugin has, and at its
 * end where it stands. Waiting, a still ring and its word, and ×, which takes it back. Running, the ring turns and × keeps its place and
 * takes no press: nothing stops an install under way but the computer's close. Failed, the alert mark and 「安装失败。」, with no reason, then
 * the retry mark and ×.
 */
export function queueRow(context: QueueContext, row: QueueRow): HTMLElement {
  const { say, language } = context;
  const update = row.act === "update";
  const name = nameIn(row.plugin, language);
  const cancel = iconAct("close", say(update ? "pl.q.cancelUpdate" : "pl.q.cancelInstall", { name }), () => context.cancel(row), { off: row.stands === "running", focus: cancelPlace(row) });
  const word = (words: string): HTMLElement => h("span", { class: "pl-q-state-word" }, words);
  const end: readonly Child[] = row.stands === "failed"
    ? [h("span", { class: "pl-q-state pl-q-state-bad", role: "alert" }, rowIcon("alert"), word(say(update ? "pl.fail.updateHere" : "pl.fail.installHere"))),
      context.member !== true && iconAct("again", say(update ? "pl.q.retryUpdate" : "pl.q.retryInstall", { name }), () => context.retry(row), { focus: retryPlace(row) }), cancel]
    : [h("span", { class: "pl-q-state", role: row.stands === "running" ? "status" : undefined }, h("span", { class: row.stands === "running" ? "pl-spin" : "pl-spin pl-still", "aria-hidden": "true" }), word(standsWords(say, row))), (context.member !== true || row.stands === "running") && cancel];
  const head = context.head(row.plugin, `queue ${row.act} ${row.source}`);
  return h("li", { class: "pl-row-item pl-q-row", "data-source": row.source },
    h("div", { class: "pl-row" }, head.tile,
      h("span", { class: "pl-row-text" }, head.name, h("span", { class: "quiet pl-row-line" }, head.line))),
    h("span", { class: "pl-row-end f-marks" }, ...end));
}

/** The queue's section, first in Yours, with its count as every shelf's; nothing where it holds nothing. */
export function queueSection(context: QueueContext, rows: readonly QueueRow[]): HTMLElement | undefined {
  if (rows.length === 0) return undefined;
  return h("section", { class: "pl-shelf pl-queue", id: "queue" },
    h("div", { class: "pl-shelf-head" }, h("h2", {}, context.say("pl.q.queue"), h("span", { class: "count" }, String(rows.length)))),
    h("ul", { class: "pl-list pl-rows" }, ...rows.map((row) => queueRow(context, row))));
}

/** A row's own name across its clicks: 重试 makes a new click, and the row it makes is the same row to the seller. */
export const rowKey = (row: Pick<QueueRow, "act" | "source">): string => `${row.act} ${row.source}`;

/**
 * Notes, at a drawing, what each message still waiting for pi waits behind: every row of the queue that has not failed, by the key of the
 * message's echo, which pi's record of it keeps. Rows seen failed are kept as such until they leave the queue, so a 重试 pressed for one
 * is still said under the message while it runs again.
 */
export function noteWaited(waited: Map<string, Set<string>>, seenFailed: Set<string>, rows: readonly QueueRow[], held: readonly string[]): void {
  const keys = new Set(rows.map(rowKey));
  for (const key of [...seenFailed]) if (!keys.has(key)) seenFailed.delete(key);
  for (const row of rows) if (row.stands === "failed") seenFailed.add(rowKey(row));
  const ahead = rows.filter((row) => row.stands !== "failed").map(rowKey);
  if (ahead.length === 0) return;
  for (const said of held) waited.set(said, new Set([...(waited.get(said) ?? []), ...ahead]));
}

/**
 * What the chat says under a message that waited behind the queue (as ruled): each install or update it waited for that failed, with
 * 重试; one 重试 was pressed for here while it runs again; nothing once it lands or is taken back.
 */
export function failedUnder(rows: readonly QueueRow[], waited: ReadonlySet<string>, retried: ReadonlySet<string>): readonly QueueRow[] {
  return rows.filter((row) => waited.has(rowKey(row)) && (row.stands === "failed" || retried.has(rowKey(row))));
}

/**
 * What the chat says under a message: the failure line the queue's row draws, in the page's failure block, with 重试, whose place
 * turns the ring while it runs again.
 */
export function failureUnder(say: Say, language: Language, row: QueueRow, retry: (() => void) | undefined): HTMLElement {
  const update = row.act === "update";
  // A member tries nothing again: the line says what failed, and the admin installs.
  return h("div", { class: "pl-failed pl-failed-chat", "data-for": rowKey(row) }, failedLine(say, language, row),
    retry !== undefined && h("span", { class: "pl-failed-acts" }, row.stands === "failed" ? retryButton(say, language, row, retry)
      : h("button", { type: "button", class: "pl-again pl-busy pl-hold", "aria-disabled": "true", "aria-busy": "true", "aria-label": say(update ? "pl.doing.updateName" : "pl.doing.installName", { name: nameIn(row.plugin, language) }) },
        h("span", { class: "pl-hold-word", "aria-hidden": "true" }, say("pl.tryAgain")), spinner())));
}
