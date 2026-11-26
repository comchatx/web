/**
 * The line beside cx's desk while cx works: what cx is doing now, by the name of the step's card said as a step under way, and the time
 * since that began. Pure: what the stream holds, read the way the stream draws it (`answer` in `chat-model.ts`), so the line and the
 * cards never say two things. The clock is the page's, kept by `LineClock`.
 */
import { isOptionCard } from "../shared/dialog.js";
import { answer, type Name } from "./chat-model.js";
import { queuedAtRest, type Item, type StreamState } from "./stream-model.js";
import type { StringKey } from "./strings.js";

/** A value the sentence holds, as the card holds it; `file` is a path that may give way to its file's own name. */
export type LineValue = { readonly text: string; readonly file?: true; readonly package?: string };

export type Line = {
  /** What the line is about: its time counts from when this first showed, and a line with the same `id` keeps its time. */
  readonly id: string;
  readonly key: StringKey;
  readonly values: Readonly<Record<string, LineValue>>;
  /** Shows the time since it began. */
  readonly timed: boolean;
  /** The drawn place a press brings the page to (`data-step` in the stream), or none: words only. */
  readonly target: string | undefined;
  /** A card whose own 已运行 clock the time reads, so the two show one number. */
  readonly card: string | undefined;
};

/** What the line reads: the live stream, whether pi is at work, whether the computer is starting, and the install or update it runs. */
export type LineInput = {
  readonly stream: StreamState;
  readonly atWork: boolean;
  readonly starting: boolean;
  /** A start the page read from the account and did not make: when it began is not known, so the line counts nothing. */
  readonly untimed?: boolean;
  /** The seller's switch-off, from its press until it answers: what waits — a message sent meanwhile too — waits behind it. */
  readonly closing?: boolean;
  readonly installing?: { readonly name: string; readonly act: "install" | "update" } | undefined;
  /** cx's computer is on: a message held there waits behind its plugins' changes, never for a start. */
  readonly on?: boolean;
  /** The name the Plugins page gives the plugin a package is, by the package's npm name; none for a package no plugin listed is. */
  readonly skillPlugin?: (pkg: string) => string | undefined;
};

/** The thing the line says, `keep` for a step pi has not named yet (its card says 「…」), or nothing: the turn is over. */
export type LineNow = Line | "keep" | undefined;

const words = (id: string, key: StringKey, extra: Partial<Pick<Line, "values" | "timed" | "target" | "card">> = {}): Line =>
  ({ id, key, values: extra.values ?? {}, timed: extra.timed ?? false, target: extra.target, card: extra.card });

/** A step under way: its card's own `step.*` name as `line.now.*`. */
export function underWay(name: Extract<Name, { readonly key: StringKey }>): Pick<Line, "key" | "values"> {
  const values: Record<string, LineValue> = {};
  for (const [at, value] of Object.entries(name.values)) values[at] = { text: value.text, ...(value.file === undefined ? {} : { file: true as const }), ...(value.package === undefined ? {} : { package: value.package }) };
  return { key: `line.now.${name.key.slice("step.".length)}` as StringKey, values };
}

const isUser = (item: Item): boolean => item.kind === "user" && !(item.pending && item.queued === true);

/** The seller message the line is said for: the latest pi has taken or is about to, not one queued behind the run. */
// A message the page sent and pi's record of it are one message: the record keeps the key of the echo it took the place of.
export const sentOf = (stream: StreamState): string => {
  const mine = stream.items.findLast(isUser);
  return `sent:${mine?.kind === "user" ? (mine.echo ?? mine.key) : ""}`;
};

/** The install or update cx's computer runs, by its name: where a message waits behind it (as ruled), and with none waiting, while no turn runs. */
const installs = (installing: NonNullable<LineInput["installing"]>): Line =>
  words(`${installing.act}:${installing.name}`, installing.act === "update" ? "line.updating" : "line.installing", { values: { name: { text: installing.name } }, timed: true });

/**
 * Whether the line's words say work under way, and so carry the forms' moving light (`.f-working`): every sentence the line says while its
 * dot breathes but a question waiting for the seller, which is not cx at work.
 */
export const atWork = (line: Pick<Line, "key">): boolean => line.key !== "line.asking";

export function lineOf(input: LineInput): LineNow {
  const said = lineNow(input);
  // A skill is named as the Plugins page names the plugin whose package the read lies in; one outside a listed plugin keeps its own name.
  const pkg = said !== undefined && said !== "keep" && said.key === "line.now.readSkill" ? said.values["name"]?.package : undefined;
  const plugin = pkg === undefined ? undefined : input.skillPlugin?.(pkg);
  return plugin === undefined || said === undefined || said === "keep" ? said : { ...said, values: { ...said.values, name: { text: plugin } } };
}

function lineNow(input: LineInput): LineNow {
  if (input.closing === true) return words("closing", "cw.closing", { timed: true });
  if (input.starting && input.untimed === true) return words("starting", "line.starting");
  if (input.starting) return words("starting", "line.starting", { timed: true });
  const stream = input.stream;
  // With no turn running, the computer says what it does: a turn's own line wins while one runs.
  if (!input.atWork || queuedAtRest(stream)) return input.installing === undefined ? undefined : installs(input.installing);
  if (stream.tidying) return words("tidying", "line.tidying", { timed: true });
  // The earliest question waiting, wherever the page draws it: its card in the chat, or at the head of 待处理 on the board. An option
  // card does not hold cx, and the line says what cx does.
  const asked = stream.dialogs.find((one) => !isOptionCard(one));
  if (asked !== undefined) return words(`asking:${asked.id}`, "line.asking", { target: `dialog:${asked.id}` });
  const from = stream.items.findLastIndex(isUser);
  const tail = stream.items.slice(from + 1);
  const last = tail.findLast((item): item is Extract<Item, { kind: "assistant" }> => item.kind === "assistant");
  const sent = sentOf(stream);
  const mine = stream.items[from];
  // A message pi has not taken waits behind the install or update cx's computer runs, whether the platform keeps it or the computer holds
  // it; one the platform keeps waits for cx's computer, which has not handed it to pi: nothing of it is being read yet.
  if (last === undefined && mine?.kind === "user" && mine.pending && input.installing !== undefined) return installs(input.installing);
  if (last === undefined && mine?.kind === "user" && mine.pending && mine.held === true && input.on !== true) return words(sent, "line.starting", { timed: true });
  if (last === undefined) return words(sent, "line.sent", { timed: true });
  const drawn = answer(last);
  // pi runs a message's steps at once: the line names the one that began first, and moves on when it ends.
  const running = drawn.tools.find((card) => card.state === "pending");
  if (running !== undefined) {
    // A package's tool goes by its code name, which no seller reads: the line names no step it has no words for, and stays where it was.
    // A skill a script reads is said as a skill read is, while the script runs.
    if (running.key.startsWith("tool:") && running.now !== undefined) return { id: `${running.key}:now`, ...underWay(running.now), timed: true, target: running.key, card: undefined };
    if (!running.key.startsWith("tool:") || "text" in running.name) return "keep";
    // The step's own name where its card has a shorter one: a skill read is said by the skill, as its card says it, not by its file's path.
    const name = running.shutName ?? running.name;
    return { id: running.key, ...underWay("key" in name ? name : running.name), timed: true, target: running.key, card: running.timed ? running.key : undefined };
  }
  if (last.draft) {
    const end = last.blocks.at(-1);
    if (end?.kind === "tool_call") return "keep";
    const pieces = drawn.pieces;
    const piece = pieces.at(-1);
    // pi's next message in the same turn, nothing in it yet: the line stays where the last one left it, and says the message is being
    // read only before pi's first word of the turn.
    if (piece === undefined) return tail.some((item) => item.kind === "assistant" && item !== last) ? "keep" : words(sent, "line.sent", { timed: true });
    if (piece.kind === "thinking") {
      const at = pieces.filter((one) => one.kind === "thinking").length - 1;
      const target = `${last.key}:thinking:${at}`;
      return words(target, "line.thinking", { timed: true, target });
    }
    return words(`${last.key}:answer`, "line.answering", { timed: true, target: last.key });
  }
  const ended = drawn.tools.at(-1);
  if (ended !== undefined) return words(`result:${last.key}`, drawn.tools.length > 1 ? "line.results" : "line.result", { timed: true, target: ended.key });
  // The answer is written and the turn has not been heard to end: the line stays on the answer until it does.
  return words(`${last.key}:answer`, "line.answering", { timed: true, target: last.key });
}

/** When each thing the line said first showed, on the page's clock: a line keeps its time while its `id` stays. */
export class LineClock {
  #id: string | undefined;
  #since = 0;
  #last: Line | undefined;
  #work: { readonly line: Line; readonly since: number; readonly sent: string | undefined } | undefined;
  #sent: string | undefined;

  /**
   * The line to draw now and when its time began: `keep` holds the last one, a start counts from `startedAt` where the page knows it,
   * and a command reads its card's own clock. A wait whose question is answered is not kept: the line goes back to the work it held
   * before the wait, its time with it, or says 正在处理 where it held none. A line is kept only within the seller message it was said for
   * (`sent`, from `sentOf`): across a new one it says 正在处理 until cx's first step for it.
   */
  at(now: LineNow, time: number, ports: { readonly startedAt?: number | undefined; readonly cardFrom?: ((key: string) => number | undefined) | undefined; readonly sent?: string | undefined }): { readonly line: Line; readonly since: number } | undefined {
    let line = now === "keep" ? this.#last : now;
    if (now === "keep" && line !== undefined && ports.sent !== undefined && this.#sent !== undefined && ports.sent !== this.#sent) line = words(ports.sent, "line.sent", { timed: true });
    this.#sent = ports.sent;
    if (now === "keep" && line !== undefined && !atWork(line)) {
      // The work held is the message's it was said for: a wait drawn first under a new message goes back to none of the earlier one's.
      const work = this.#work !== undefined && this.#work.sent === ports.sent ? this.#work : { line: words(ports.sent ?? "asked", "line.sent", { timed: true }), since: time };
      line = work.line;
      if (line.id !== this.#id) { this.#id = line.id; this.#since = work.since; }
    }
    if (line === undefined) { this.#id = undefined; this.#last = undefined; this.#work = undefined; return undefined; }
    if (line.id !== this.#id) { this.#id = line.id; this.#since = time; }
    this.#last = line;
    if (atWork(line)) this.#work = { line, since: this.#since, sent: ports.sent };
    const card = line.card === undefined ? undefined : ports.cardFrom?.(line.card);
    const since = card ?? (line.id === "starting" && ports.startedAt !== undefined ? Math.min(ports.startedAt, this.#since) : this.#since);
    return { line, since };
  }
}
