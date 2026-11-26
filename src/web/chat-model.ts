/**
 * What the stream draws for each record, built on pi 0.87.1's interactive mode (`modes/interactive/components/` and
 * `core/tools/renderers/` in the pinned package): which records are drawn at all, a message's text and runs of thinking, where it stopped,
 * and a tool call's card — which pi draws as its step, what it returned, and how many lines show until the card is opened. What pi's output
 * holds is drawn as it came; the words around it — a step's plain name, how long it took, the folds — are the page's own. Pure: no DOM,
 * no clock; the page's words are named by key and said by the view.
 */
import { askedHere, failureWords, plainStop, stepStopped, STOP_TEXTS, type Block, type Item } from "./stream-model.js";
import type { StringKey } from "./strings.js";
import { fileName } from "./board-files.js";
import { BOARD_ROOT, BOARD_TAB, boardFilePath, PERSON } from "../shared/board.js";
import { markdownText } from "../shared/markdown.js";
import { TOO_LONG_ENTRY } from "../shared/too-long.js";
import { readWayMoved, WAY_MOVED_ENTRY, type Door } from "../shared/way-moves.js";

/** The page's words by key, or the session's own words as they came; `quiet` ones are drawn in the quiet colour, not their place's. */
export type Words = { readonly key: StringKey; readonly values?: Readonly<Record<string, string | number>> } | { readonly text: string; readonly quiet?: true };

/** The role of a piece of a line a step returned: output, an error, a diff's lines. */
export type Tone = "output" | "muted" | "error" | "added" | "removed" | "context";
/** `mark` is a changed word inside a changed line. */
export type Span = { readonly text: string; readonly tone: Tone; readonly mark?: boolean };
export type Line = readonly Span[];

/**
 * Lines a card holds and how many of them show while it is shut, from which end: the hint counts the rest, after them (`more`) or above
 * them (`earlier`). `markdown` lines are a file's text, drawn as an answer's markdown is.
 */
export type Fold = { readonly lines: readonly Line[]; readonly keep: number; readonly from: "start" | "end"; readonly hint: "more" | "earlier"; readonly markdown?: true };

/** A value the call gave, placed in the step's name as it came: a file the view may make a way to. */
/** `package`: the npm package a skill read lies in, by its own path; none for a skill outside any package. */
export type Value = { readonly text: string; readonly file?: string; readonly package?: string };
/** A step's plain name: the page's words by key with the call's own values in them, or a name as it came — a tool the page has no words for, or one whose name has not arrived. */
export type Name = { readonly key: StringKey; readonly values: Readonly<Record<string, Value>> } | { readonly text: string };

export type ToolCard = {
  /** The card's place in the view's memory: the call's id once it has one. */
  readonly key: string;
  /** `stopped`: the person stopped the message before this step ran, which is not a failure. */
  readonly state: "pending" | "success" | "error" | "stopped";
  readonly name: Name;
  /** The shorter name a shut read of a skill or an agents file takes, as pi's compact header does. */
  readonly shutName: Name | undefined;
  /** The call's own settings, after its name in plain words. */
  readonly settings: readonly Words[];
  /** The tool said the step failed. */
  readonly failed: boolean;
  /** The command a step runs, line by line: the first shows, the rest are behind the card's fold. */
  readonly command: readonly string[] | undefined;
  /** The arguments as JSON, for a tool with no renderer here, and only once they are whole. */
  readonly json: string | undefined;
  readonly body: Fold | undefined;
  /** Words after the body in the error colour. */
  readonly note: Words | undefined;
  /** How long it ran is shown: a command's alone. */
  readonly timed: boolean;
  /** The board card a write made: the chat draws it as the card's row once the card is read (`parts/board-page.md` §1). */
  readonly card?: BoardCard;
  /** The board cards the calls this one made wrote, as pi records them: each drawn as its row under the step once read. */
  readonly cards?: readonly BoardCard[];
  /** While the step runs, what a call it made is doing now where the page has words for it: a skill it reads. */
  readonly now?: Extract<Name, { readonly key: StringKey }>;
};

/** A card on a board, by its tab and its path in that tab; `person` where a path named whose board it is, else the signed-in person's. */
export type BoardCard = { readonly person?: string; readonly tab: string; readonly file: string };

/** The card a path names: a Markdown file in a tab of a person's board, `/tenant/board/<person>/<tab>/<file>.md`; nothing for any other path. */
export function boardCard(path: string): BoardCard | undefined {
  const parts = path.replace(/^(?:\/tenant\/|\.\/)/, "").split("/");
  if (parts.length < 4 || parts[0] !== BOARD_ROOT || !PERSON.test(parts[1]!) || !BOARD_TAB.test(parts[2]!)) return undefined;
  const file = parts.slice(3).join("/");
  return /\.md$/i.test(file) && boardFilePath(file) ? { person: parts[1]!, tab: parts[2]!, file } : undefined;
}

/** A piece of a message: its text, or a run of its thinking. */
export type Piece = { readonly kind: "text" | "thinking"; readonly markdown: string };

/**
 * One message as pi draws it: its text and thinking in order, where it stopped, then a card for each tool call, and after them what a
 * stop that left them unrun said past the stop itself.
 */
/** `stopped`: the person stopped the message, which is said in ink, not as a failure. */
export type Answer = { readonly pieces: readonly Piece[]; readonly stop: readonly Words[]; readonly stopped: boolean; readonly tools: readonly ToolCard[]; /** Whether the stop is the conversation's length, which the page says in its words, the vendor's folded under them. */ readonly tooLong: boolean };

/**
 * A record pi draws: a summary card, an extension's message, the person's own command; and the page's own line where the chat moved off
 * a used-up way to the seller's next, or stopped there with no next way its card keeps.
 * Every other record is drawn by nobody.
 */
export type Note =
  | { readonly kind: "moved"; readonly from: Door; readonly to?: Door }
  | { readonly kind: "summary"; readonly title: StringKey; readonly markdown: string }
  | { readonly kind: "message"; readonly head: string; readonly markdown: string }
  | { readonly kind: "shell"; readonly command: readonly string[]; readonly body: Fold | undefined; readonly status: { readonly words: Words; readonly tone: "warning" | "error" } | undefined };

/** The person's message: a skill pi read in for it, drawn as its own card, and their words after it. */
export type Said = { readonly skill: { readonly name: string; readonly content: string } | undefined; readonly text: string | undefined };

type Call = Extract<Block, { kind: "tool_call" }>;
type Args = Readonly<Record<string, unknown>>;

// pi's `stripAnsi` (`utils/ansi.js`): an OSC sequence to its terminator, and CSI with the escapes like it.
const ANSI = /\u001B\][\s\S]*?(?:\u0007|\u001B\x5C|\u009C)|[\u001B\u009B][[\]()#;?]*(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]/g;

/**
 * A tool's text as pi draws it (`getTextOutput`): terminal escapes stripped, control characters but tab and newline dropped with the three
 * interlinear annotation marks, carriage returns gone. Anything else stays, so bytes that are no text are drawn as the characters they decode to.
 */
export function cleanOutput(text: string): string {
  let kept = "";
  for (const char of text.replace(ANSI, "")) {
    const code = char.codePointAt(0)!;
    if (code === 0x09 || code === 0x0a || (code > 0x1f && (code < 0xfff9 || code > 0xfffb))) kept += char;
  }
  return kept;
}

const trailingEmptyTrimmed = (lines: readonly string[]): readonly string[] => {
  let end = lines.length;
  while (end > 0 && lines[end - 1] === "") end--;
  return lines.slice(0, end);
};
const plain = (tone: Tone) => (line: string): Line => [{ text: line, tone }];
const outputLines = (text: string): readonly Line[] => (text === "" ? [] : text.split("\n").map(plain("output")));

/** A piece of pi's `str`: a string, nothing for a missing value, and `null` for a value of another type — an invalid argument. */
const str = (value: unknown): string | null => (typeof value === "string" ? value : value === null || value === undefined ? "" : null);
/** A setting as the call gave it — a number, or text — and nothing for a value of another type, which is left out of the step's name. */
const setting = (value: unknown): string | undefined => (typeof value === "number" || (typeof value === "string" && value !== "") ? String(value) : undefined);
const named = (key: StringKey, values: Readonly<Record<string, Value>> = {}): Name => ({ key, values });
const number = (value: number): Value => ({ text: String(value) });
/** A file the step names by its own name, which the view makes a way to by its whole path. */
const fileValue = (path: string, shown = fileName(path)): Value => ({ text: shown, file: path });

/** All of the person's files: where pi searches and lists when no folder is named, the tree it works in. */
const ROOTS: ReadonlySet<string> = new Set(["", ".", "./", "/tenant", "/tenant/"]);

/** A read's name, with the line range pi writes after the path as lines in plain words. */
const readName = (args: Args, shown: (path: string) => string = fileName): Name => {
  const path = str(args["file_path"] ?? args["path"]);
  if (!path) return named("step.readAny");
  const file = fileValue(path, shown(path));
  const offset = args["offset"], limit = args["limit"];
  const from = typeof offset === "number" ? offset : 1;
  if (typeof limit === "number") return named("step.readLines", { file, from: number(from), to: number(from + limit - 1) });
  if (typeof offset === "number") return named("step.readFrom", { file, from: number(from) });
  return named("step.read", { file });
};

const RESOURCES: ReadonlySet<string> = new Set(["AGENTS.override.md", "AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"]);
/** A path as the tenant's own tree names it, which is what pi, working there, writes relative to its cwd. */
const underTenant = (path: string): string => (path.startsWith("/tenant/") ? path.slice("/tenant/".length) : path);

/**
 * A read that is shut names a skill by its directory and an agents file by its place in the person's files, as pi's compact header does;
 * pi's own docs, which it names too, live where the page cannot see.
 */
const compactRead = (args: Args): Name | undefined => {
  const raw = str(args["file_path"] ?? args["path"]);
  if (!raw) return undefined;
  const parts = raw.split("/").filter((part) => part !== "");
  const name = parts.at(-1) ?? "";
  if (name === "SKILL.md") {
    const under = parts.lastIndexOf("node_modules");
    const owner = under < 0 ? undefined : parts[under + 1]?.startsWith("@") === true ? parts.slice(under + 1, under + 3).join("/") : parts[under + 1];
    return named("step.readSkill", { name: { text: parts.at(-2) ?? name, ...(owner === undefined ? {} : { package: owner }) } });
  }
  if (RESOURCES.has(name)) return readName(args, underTenant);
  return undefined;
};

/** A longest common subsequence walk: what two sequences share, and what each alone has, removals before additions in each change. */
function align<T>(before: readonly T[], after: readonly T[]): readonly { readonly kind: "same" | "gone" | "new"; readonly value: T }[] {
  // Beyond this many cells the two are drawn as all gone, then all new: an edit that large is read as a replacement anyway.
  if (before.length * after.length > 250_000) return [...before.map((value) => ({ kind: "gone" as const, value })), ...after.map((value) => ({ kind: "new" as const, value }))];
  const width = after.length + 1;
  const table = new Uint32Array((before.length + 1) * width);
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      table[i * width + j] = before[i] === after[j] ? table[(i + 1) * width + j + 1]! + 1 : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
    }
  }
  const steps: { kind: "same" | "gone" | "new"; value: T }[] = [];
  let gone: { kind: "gone"; value: T }[] = [];
  let added: { kind: "new"; value: T }[] = [];
  const settle = (): void => { steps.push(...gone, ...added); gone = []; added = []; };
  let i = 0, j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) { settle(); steps.push({ kind: "same", value: before[i]! }); i++; j++; }
    else if (j >= after.length || (i < before.length && table[(i + 1) * width + j]! >= table[i * width + j + 1]!)) gone.push({ kind: "gone", value: before[i++]! });
    else added.push({ kind: "new", value: after[j++]! });
  }
  settle();
  return steps;
}

/** One changed line against the line it replaced, word by word: the words that changed are marked, as pi's diff inverts them. */
const wordLines = (before: string, after: string): readonly [Line, Line] => {
  const steps = align(before.split(/(\s+)/), after.split(/(\s+)/));
  const removed: Span[] = [{ text: "- ", tone: "removed" }];
  const added: Span[] = [{ text: "+ ", tone: "added" }];
  for (const step of steps) {
    if (step.value === "") continue;
    if (step.kind !== "new") removed.push({ text: step.value, tone: "removed", ...(step.kind === "gone" && step.value.trim() !== "" ? { mark: true } : {}) });
    if (step.kind !== "gone") added.push({ text: step.value, tone: "added", ...(step.kind === "new" && step.value.trim() !== "" ? { mark: true } : {}) });
  }
  return [removed, added];
};

/** An edit's replacements as pi's diff draws them — context, then what went, then what came — without the file's line numbers, which the page has not read. */
export function editDiff(args: Args): readonly Line[] | undefined {
  const edits: unknown = Array.isArray(args["edits"]) ? args["edits"] : typeof args["oldText"] === "string" ? [{ oldText: args["oldText"], newText: args["newText"] }] : undefined;
  if (!Array.isArray(edits) || edits.length === 0) return undefined;
  if (!edits.every((edit: unknown) => typeof edit === "object" && edit !== null && typeof (edit as Args)["oldText"] === "string" && typeof (edit as Args)["newText"] === "string")) return undefined;
  const lines: Line[] = [];
  (edits as readonly { readonly oldText: string; readonly newText: string }[]).forEach((edit, at) => {
    if (at > 0) lines.push([{ text: "  …", tone: "context" }]);
    const steps = align(edit.oldText.replace(/\r/g, "").split("\n"), edit.newText.replace(/\r/g, "").split("\n"));
    for (let k = 0; k < steps.length; k++) {
      const step = steps[k]!;
      if (step.kind === "same") { lines.push([{ text: `  ${step.value}`, tone: "context" }]); continue; }
      let end = k;
      while (end < steps.length && steps[end]!.kind !== "same") end++;
      const change = steps.slice(k, end);
      const gone = change.filter((one) => one.kind === "gone"), added = change.filter((one) => one.kind === "new");
      if (gone.length === 1 && added.length === 1) lines.push(...wordLines(gone[0]!.value, added[0]!.value));
      else lines.push(...gone.map((one): Line => [{ text: `- ${one.value}`, tone: "removed" }]), ...added.map((one): Line => [{ text: `+ ${one.value}`, tone: "added" }]));
      k = end - 1;
    }
  });
  return lines;
}

/**
 * A step's time line — how long it has run, or took — and the time in it, as a seller says it: in whole seconds, and past an hour in hours
 * and minutes. Under a second the line is whole, its words joined as each language joins them.
 */
export function stepTime(ms: number, done: boolean): { readonly line: StringKey; readonly time: Words | undefined } {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  if (seconds < 1) return { line: done ? "stream.tookUnderSecond" : "stream.elapsedUnderSecond", time: undefined };
  const line = (time: Words) => ({ line: done ? "stream.took" as const : "stream.elapsed" as const, time });
  if (seconds < 60) return line({ key: "time.seconds", values: { seconds } });
  const minutes = Math.floor(seconds / 60), rest = seconds % 60;
  if (minutes < 60) return line(rest === 0 ? { key: "time.minutes", values: { minutes } } : { key: "time.minutesSeconds", values: { minutes, seconds: rest } });
  const hours = Math.floor(minutes / 60), left = minutes % 60;
  return line(left === 0 ? { key: "time.hours", values: { hours } } : { key: "time.hoursMinutes", values: { hours, minutes: left } });
}

/** The lines a card shows, shut or open, and how many the hint counts. */
export function shown(fold: Fold, open: boolean): { readonly lines: readonly Line[]; readonly hidden: number } {
  const hidden = Math.max(0, fold.lines.length - fold.keep);
  if (open || hidden === 0) return { lines: fold.lines, hidden };
  return { lines: fold.from === "end" ? fold.lines.slice(hidden) : fold.lines.slice(0, fold.keep), hidden };
}

/** A command's lines, as the call wrote them; none for a command that is missing or no text. */
const commandLines = (command: string | null): readonly string[] | undefined => (command ? trailingEmptyTrimmed(command.replace(/\r/g, "").split("\n")) : undefined);

/** A search's place: all of the person's files, or a folder or file as the call named it. */
const place = (raw: string): Value | undefined => (ROOTS.has(raw) ? undefined : { text: raw });

/**
 * A tool call's card, built on pi's renderer for that tool; `stopped` is the reason and error of a message that ended before its calls
 * ran, which pi draws on each call it left without a result.
 */
export function toolCard(call: Call, key: string, stopped: { readonly reason: string | undefined; readonly error: string | undefined; readonly told?: true }): ToolCard {
  const args: Args = call.args ?? {};
  const whole = call.args !== undefined;
  const unran = call.result === undefined && (stopped.reason === "aborted" || stopped.reason === "error");
  // A step the person's Stop cut short, or never reached, is stopped, not failed: pi's abort text is the only mark it has.
  const halted = stepStopped(call);
  const result = call.result ?? (unran ? undefined : call.partial === undefined ? undefined : { text: call.partial, isError: false });
  const failed = call.result?.isError === true && !halted;
  const state = halted || (unran && stopped.reason === "aborted") ? "stopped" : call.result === undefined && !unran ? "pending" : unran || failed ? "error" : "success";
  // What a stopped step returned before the stop, without the abort text the card says in the page's words.
  const text = result === undefined ? "" : halted ? (call.name === "bash" && result.text.trimEnd().endsWith(STOP_TEXTS.bash) ? result.text.trimEnd().slice(0, -STOP_TEXTS.bash.length) : "") : result.text;
  const cleaned = cleanOutput(text);
  type Extra = Partial<Pick<ToolCard, "shutName" | "settings" | "command" | "json" | "note" | "timed" | "card">>;
  // A card written by a call this one made, as pi records it once this one ended; and, while it runs, a skill the latest call it made reads.
  const cards = (call.nested ?? []).flatMap((one) => (one.name === "write" && one.ok === true && one.path !== undefined ? [boardCard(one.path)].filter((made) => made !== undefined) : []));
  const latest = call.result === undefined ? call.nested?.at(-1) : undefined;
  const now = latest?.name === "read" && latest.path !== undefined ? compactRead({ path: latest.path }) : undefined;
  const card = (name: Name, body: Fold | undefined, extra: Extra = {}): ToolCard => ({
    key, state, name, body, failed, shutName: extra.shutName, settings: extra.settings ?? [], command: extra.command, json: extra.json, timed: extra.timed ?? false,
    ...(extra.card === undefined ? {} : { card: extra.card }),
    ...(cards.length === 0 ? {} : { cards }),
    ...(now !== undefined && "key" in now && now.key === "step.readSkill" ? { now } : {}),
    note: halted || (unran && stopped.reason === "aborted") ? { key: "stream.cancelled" } : unran ? (stopped.told === true ? undefined : stopped.error ? { text: stopped.error } : { key: "stream.error" }) : extra.note,
  });
  const fold = (lines: readonly Line[], keep: number, from: Fold["from"] = "start", hint: Fold["hint"] = "more"): Fold | undefined =>
    lines.length === 0 ? undefined : { lines, keep, from, hint };
  const errorNote = failed && cleaned !== "" ? { text: cleaned } : undefined;
  const limit = (at: string): readonly Words[] => { const count = setting(args[at]); return count === undefined ? [] : [{ key: "step.atMost", values: { count } }]; };
  if (call.name === "") return card({ text: "…" }, undefined);
  if (call.name === "bash") {
    const command = str(args["command"]);
    return card(named("step.run"), fold(outputLines(cleaned.trim()), 5, "end", "earlier"), { command: commandLines(command), timed: true });
  }
  if (call.name === "read") {
    return card(readName(args), fold(trailingEmptyTrimmed(cleaned.split("\n")).map(plain("output")), failed ? 10 : 0), { shutName: whole ? compactRead(args) : undefined });
  }
  // What cx read back is the person's own quote, on the page already above its message, in the words handed to cx: the step is its
  // name alone, as the prototype draws it. Only a read that failed says why.
  if (call.name === "quoted") return card(named("step.readQuoted"), failed ? fold(trailingEmptyTrimmed(cleaned.split("\n")).map(plain("output")), 10) : undefined);
  if (call.name === "write") {
    const path = str(args["file_path"] ?? args["path"]);
    const content = str(args["content"]);
    const lines = content ? trailingEmptyTrimmed(content.replace(/\r/g, "").split("\n")).map(plain("output")) : [];
    const body = fold(lines, 10);
    // A Markdown file is drawn as its text reads, by the renderer answers use: drawing it changes no byte of it.
    const markdown = body !== undefined && path !== null && /\.md$/i.test(path) ? { ...body, markdown: true as const } : body;
    const made = path === null ? undefined : boardCard(path);
    return card(path ? named("step.save", { file: fileValue(path) }) : named("step.saveAny"), markdown, { note: errorNote, ...(made === undefined ? {} : { card: made }) });
  }
  if (call.name === "edit") {
    const path = str(args["file_path"] ?? args["path"]);
    const diff = whole ? editDiff(args) : undefined;
    return card(path ? named("step.edit", { file: fileValue(path) }) : named("step.editAny"), diff === undefined ? undefined : fold(diff, diff.length), { note: errorNote });
  }
  // A value that is no text is left out of a step's name, which then reads as its plain name, where pi writes `[invalid arg]`.
  if (call.name === "grep") {
    const pattern = str(args["pattern"]), path = str(args["path"]);
    const glob = str(args["glob"]);
    const settings: readonly Words[] = [...(glob ? [{ key: "step.only" as const, values: { glob } }] : []), ...limit("limit")];
    const where = path === null ? undefined : place(path);
    const name = pattern === null || path === null ? named("step.searchAny")
      : where === undefined ? named("step.searchAll", { pattern: { text: pattern } }) : named("step.search", { file: where, pattern: { text: pattern } });
    return card(name, fold(outputLines(cleaned.trim()), 15), { settings });
  }
  if (call.name === "find") {
    const pattern = str(args["pattern"]), path = str(args["path"]);
    const where = path === null ? undefined : place(path);
    const name = pattern === null || path === null ? named("step.findAny")
      : where === undefined ? named("step.findAll", { pattern: { text: pattern } }) : named("step.find", { folder: where, pattern: { text: pattern } });
    return card(name, fold(outputLines(cleaned.trim()), 20), { settings: limit("limit") });
  }
  if (call.name === "ls") {
    const path = str(args["path"]);
    const where = path === null ? undefined : place(path);
    return card(path === null ? named("step.listAny") : where === undefined ? named("step.listAll") : named("step.list", { folder: where }), fold(outputLines(cleaned.trim()), 20), { settings: limit("limit") });
  }
  return card({ text: call.name }, fold(outputLines(cleaned), 10), { json: whole ? JSON.stringify(args, null, 2) : undefined });
}

/**
 * A message's text and runs of thinking in order, as pi's assistant message draws them: blank text drawn by nobody, and a run of
 * consecutive thinking blocks one piece.
 */
export function pieces(blocks: readonly Block[]): readonly Piece[] {
  const drawn: Piece[] = [];
  for (let at = 0; at < blocks.length; at++) {
    const block = blocks[at]!;
    if (block.kind === "text" && block.text.trim() !== "") drawn.push({ kind: "text", markdown: block.text.trim() });
    if (block.kind !== "thinking") continue;
    const parts: string[] = [];
    for (; at < blocks.length; at++) {
      const next = blocks[at]!;
      if (next.kind !== "thinking") break;
      if (next.text.trim() !== "") parts.push(next.text.trim());
    }
    at--;
    if (parts.length > 0) drawn.push({ kind: "thinking", markdown: parts.join("\n\n") });
  }
  return drawn;
}

/** A message the person stopped: cut short while it was written, or the empty one pi writes after the steps a Stop cut short. */
export const stoppedMessage = (item: Extract<Item, { kind: "assistant" }>): boolean =>
  item.stopReason === "aborted" || (item.stopReason === "error" && item.blocks.length === 0 && plainStop(item.errorMessage));

/**
 * Where a message stopped, in the error colour: cut short, or — with no tool call to carry it — stopped or failed. A stop is said in the
 * page's words alone, whatever text pi's stack gave with it; a failure says its own text after them.
 */
export function stop(item: Extract<Item, { kind: "assistant" }>, moved = false, tooLong?: string): readonly Words[] {
  if (item.stopReason === "length") return [{ key: "stream.truncated" }];
  if (item.blocks.some((block) => block.kind === "tool_call")) return [];
  // A Stop, and the empty message an earlier pi wrote as an error after the steps a Stop cut short, end the turn in Stopped, never in pi's text.
  if (stoppedMessage(item)) return [{ key: "stream.cancelled" }];
  if (item.stopReason === "error") {
    if (tooLong !== undefined) return [{ key: "stream.tooLong", values: { model: tooLong } }];
    const key = failureWords(item.errorMessage, moved);
    // A used-up way's refusal and a balance-off one are the proxy's machine text: the page's words say it, and for a used-up way the line
    // after the answer names the ways.
    return key === "stream.wayUsedUp" || key === "stream.balanceOff" ? [{ key }] : [{ key }, ...(item.errorMessage ? [{ text: item.errorMessage }] : [])];
  }
  return [];
}

/**
 * One message as pi draws it. A call's card is kept under its id, which it has once it is whole, else under its place in the message. A
 * Stop that left steps unrun is said on each of their cards, and a failure on the first.
 */
/** cx naming its work is not a step of the answer: what it named is a row of History, shown as it arrives. */
const UNDRAWN: ReadonlySet<string> = new Set(["topic"]);

/** How many quotes a card reads: none for any other step. */
const quotedCount = (card: ToolCard): number =>
  "key" in card.name && card.name.key === "step.readQuoted" ? 1 : "key" in card.name && card.name.key === "step.readQuotedMany" ? Number(card.name.values["count"]?.text ?? 0) : 0;

const WORST = ["success", "pending", "stopped", "error"] as const;

/** cx reads every quote of a message one after another: however many, they are one step on the page, in the worst state any of them reached. */
function readTogether(card: ToolCard, next: ToolCard): ToolCard {
  const lines = [...(card.body?.lines ?? []), ...(next.body?.lines ?? [])];
  const body = card.body ?? next.body;
  return {
    ...card, name: named("step.readQuotedMany", { count: number(quotedCount(card) + 1) }), failed: card.failed || next.failed, note: card.note ?? next.note,
    state: WORST[Math.max(WORST.indexOf(card.state), WORST.indexOf(next.state))]!, body: body === undefined ? undefined : { ...body, lines, keep: Math.max(card.body?.keep ?? 0, next.body?.keep ?? 0) },
  };
}

export function answer(item: Extract<Item, { kind: "assistant" }>, moved = false, tooLong?: string): Answer {
  const stopped = { reason: item.stopReason, error: item.errorMessage };
  // A failure that left several steps unrun is said once, on the first of them; the others are drawn failed and say nothing more.
  let told = false;
  const tools = item.blocks.reduce<readonly ToolCard[]>((cards, block, at) => {
    if (block.kind !== "tool_call" || UNDRAWN.has(block.name)) return cards;
    const unrun = block.result === undefined && item.stopReason === "error" && !item.draft;
    const card = toolCard(block, block.id === "" ? `${item.key}:${at}` : `tool:${block.id}`, unrun && told ? { ...stopped, told: true } : stopped);
    told ||= unrun;
    const before = cards.at(-1);
    return block.name === "quoted" && before !== undefined && quotedCount(before) > 0 ? [...cards.slice(0, -1), readTogether(before, card)] : [...cards, card];
  }, []);
  const stops = stop(item, moved, tooLong);
  return { pieces: pieces(item.blocks), stop: stops, stopped: stoppedMessage(item), tools, tooLong: stops.some((words) => "key" in words && words.key === "stream.tooLong") };
}

const SKILL = /^<skill name="([^"]+)" location="([^"]+)">\n([\s\S]*?)\n<\/skill>(?:\n\n([\s\S]+))?$/;

/** The person's message as pi draws it: a skill block pi read in for them is its own card, and their words follow it. */
export function said(text: string): Said {
  const skill = SKILL.exec(text);
  if (skill === null) return { skill: undefined, text: text === "" ? undefined : text };
  return { skill: { name: skill[1]!, content: skill[3]! }, text: skill[4]?.trim() || undefined };
}

/**
 * A record as pi draws it, or nothing where pi draws nothing: a compaction or a branch summary is a marker that opens on its summary, an
 * extension's message a marker headed by its own first line that opens on its content, as pi-subagents folds its notices, and the
 * person's own command a step with its last twenty lines. A model or thinking-level change, and every form pi has no drawing for, are
 * not drawn.
 */
export function note(form: string, body: Readonly<Record<string, unknown>>): Note | undefined {
  const words = (value: unknown): string => (typeof value === "string" ? value : "");
  if (form === "compaction") return { kind: "summary", title: "stream.compacted", markdown: words(body["summary"]) };
  if (form === "branch_summary") return { kind: "summary", title: "stream.branchSummary", markdown: words(body["summary"]) };
  if (form === "custom_message" && body["display"] === true) {
    const markdown = words(body["content"]);
    return { kind: "message", head: markdownText(markdown).split("\n")[0]!, markdown };
  }
  if (form === "custom" && body["customType"] === WAY_MOVED_ENTRY) {
    const move = readWayMoved(body["data"]);
    // The balance is one door: a move from it to itself is no move. The balance stops no turn as a used-up way: the proxy refuses it otherwise.
    return move === undefined || (move.from.way === "platform" && (move.to === undefined || move.to.way === "platform")) ? undefined : { kind: "moved", ...move };
  }
  if (form === "bash_execution") {
    const output = cleanOutput(words(body["output"]).replace(/\r\n?/g, "\n"));
    const lines = output === "" ? [] : output.split("\n").map(plain("muted"));
    const exit = body["exitCode"];
    const status = body["cancelled"] === true ? { words: { key: "stream.cancelled" as const }, tone: "warning" as const }
      : typeof exit === "number" && exit !== 0 ? { words: { key: "stream.failed" as const }, tone: "error" as const } : undefined;
    const command = words(body["command"]);
    return { kind: "shell", command: commandLines(command) ?? [], body: lines.length === 0 ? undefined : { lines, keep: 20, from: "end", hint: "earlier" }, status };
  }
  return undefined;
}

/**
 * The messages a turn ended on where the steward then recorded the move it made off a used-up way: each the last answer before a move's
 * line, past the model change and any other record between them. Only these say the way ran out; the steward moves only on the
 * platform's vouched refusal, so a provider's error that copies its words says what it said.
 */
export const movedAnswers = (items: readonly Item[]): ReadonlySet<string> => answersBefore(items, (form, body) => note(form, body)?.kind === "moved");

/** The messages pi gave up on after a vendor refused them for their length: each the last answer before the steward's record of it. */
export const tooLongAnswers = (items: readonly Item[]): ReadonlySet<string> => answersBefore(items, (form, body) => form === "custom" && body["customType"] === TOO_LONG_ENTRY);

/**
 * The stops a step already says: each empty message pi writes after the steps a Stop cut short, where a card of the message before it
 * says Stopped and that message itself ran to its calls. A message stopped itself said its own stop on its cards, so an empty message
 * after it is a later Stop's, and says it. One stop says 「已停止」 once, on the step it stopped, or below the text where it stopped none
 * (ruled 2026-10-01).
 */
export const stopsOnSteps = (items: readonly Item[]): ReadonlySet<string> => {
  const keys = new Set<string>();
  items.forEach((item, at) => {
    if (item.kind !== "assistant" || !stoppedMessage(item) || item.blocks.some((block) => block.kind === "tool_call") || pieces(item.blocks).length > 0) return;
    const before = items.slice(0, at).findLast((other) => other.kind === "assistant");
    if (before?.kind === "assistant" && !stoppedMessage(before) && answer(before).tools.some((card) => card.state === "stopped")) keys.add(item.key);
  });
  return keys;
};

function answersBefore(items: readonly Item[], marks: (form: string, body: Readonly<Record<string, unknown>>) => boolean): ReadonlySet<string> {
  const keys = new Set<string>();
  items.forEach((item, at) => {
    if (item.kind !== "record" || !marks(item.form, item.body)) return;
    for (let back = at - 1; back >= 0; back--) {
      const before = items[back]!;
      if (before.kind === "assistant") { keys.add(before.key); return; }
      if (before.kind !== "record") return;
    }
  });
  return keys;
}

/**
 * The person's last message when pi took it inside a turn — after a step's result, as it takes one sent while it works — and a Stop then
 * took hold before any answer: nothing follows it but the empty message pi writes after a stop, and pi reads it with the next message the
 * person sends. A message that opened its own turn and was stopped is the person's own stop, not one kept. Its key, or `undefined`.
 */
export function heldForNext(all: readonly Item[]): string | undefined {
  const items = all.filter((item) => !askedHere(item));
  let at = items.length - 1;
  while (at >= 0) {
    const item = items[at]!;
    if (item.kind !== "assistant" || item.blocks.length > 0 || !stoppedMessage(item)) break;
    at--;
  }
  const held = items[at];
  const before = items[at - 1];
  const inTurn = before?.kind === "tool_result" || (before?.kind === "assistant" && before.stopReason === "toolUse");
  return at < items.length - 1 && held?.kind === "user" && !held.pending && inTurn ? held.key : undefined;
}
