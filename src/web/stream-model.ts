import { DIALOG_ENDED, isOptionCard, readDialogAnswer, readUiRequest, type Dialog, type DialogAnswer, type Notice } from "../shared/dialog.js";
import { readOptionRecord, type AskForm } from "../shared/option-form.js";
import { readWayUsedUp } from "../shared/way-moves.js";
import { isGuideLine, type GuideLine } from "./guide-lines.js";

/** One event of `GET /stream` as the platform sends it: the event's name, its parsed data, and an entry's id, `<epoch>:<seq>`. */
export type StreamEvent = { readonly event: string; readonly data: unknown; readonly id?: string };

export type ToolResult = { readonly text: string; readonly isError: boolean };
/** A call a tool made to another tool: the tool, the path it was given where it was given one, and whether it ended well. */
export type Nested = { readonly name: string; readonly path?: string; readonly ok?: true };
const nestedOf = (value: unknown): Nested => {
  const one = record(value) ? value : {};
  const args = record(one["arguments"]) ? one["arguments"] : record(one["args"]) ? one["args"] : {};
  const path = args["file_path"] ?? args["path"] ?? one["path"];
  return { name: word(one["name"]), ...(typeof path === "string" ? { path } : {}), ...(one["status"] === "ok" ? { ok: true as const } : {}) };
};

/**
 * That a turn bought something, as the gate settled it and the box counted it, by the entry it names, the turn's last. `live` is a charge
 * the box told this page as the turn ended, not one read with what is stored: the moment the account and the sources are read again.
 */
export type Charge = { readonly seq: number; readonly live?: true };

/**
 * A draft's block this page did not hear whole: its start was before the connection, or a reconnect cut it. It takes no delta, since one
 * would join across what was missed, and is made whole by its end or by pi's record; an empty one holds a place whatever its kind.
 */
type Cut = { readonly cut?: true };

export type Block =
  | ({ readonly kind: "text"; readonly text: string } & Cut)
  | ({ readonly kind: "thinking"; readonly text: string } & Cut)
  | ({
      readonly kind: "tool_call";
      readonly id: string;
      readonly name: string;
      /** pi's parsed arguments once the call is whole; while it streams, the text so far. */
      readonly args: Readonly<Record<string, unknown>> | undefined;
      readonly argsText: string;
      /** Output so far while the tool runs. */
      readonly partial: string | undefined;
      readonly result: ToolResult | undefined;
      /**
       * The calls this one made to other tools, as pi records them (`nestedCalls` on its result): each by its tool and the path it was
       * given, `ok` once it ended well. While the call runs, the ones the box said had begun, in the order they began.
       */
      readonly nested?: readonly Nested[];
      /** Left without a result by a Stop before the run reached it. */
      readonly unreached?: true;
    } & Cut)
  | { readonly kind: "other"; readonly form: string; readonly raw: unknown };

export type Item =
  | {
      readonly kind: "user";
      readonly key: string;
      /** pi's id for the entry, once it has landed: what a title names and a quote carries. */
      readonly entryId?: string;
      readonly text: string;
      readonly pending: boolean;
      /** When it was said, in epoch milliseconds: pi's own record once the entry has landed. */
      readonly at: number | undefined;
      /** An echo's moment on the box's clock: when the box passed it to pi, which stamps its record of it then or later. */
      readonly sentAt?: number | undefined;
      /** An echo sent while pi was at work: pi holds it until the answer under way reaches a turn's end, so that answer grows above it. */
      readonly queued?: true;
      /** An echo the platform keeps for the box, which was not there to take it, and sends once the box is up, in the order written. */
      readonly held?: true;
      /** pi's record of a message this page sent: the key of the echo whose place it took. */
      readonly echo?: string;
    }
  | {
      readonly kind: "assistant";
      readonly key: string;
      /** pi's id for the entry, once it has landed. */
      readonly entryId?: string;
      readonly blocks: readonly Block[];
      /**
       * When the answer ended, in epoch milliseconds, once the entry has landed: pi's `timestamp` marks when the request started and its
       * `durationMs` how long the response took from then; a message without `durationMs` keeps its `timestamp`.
       */
      readonly at?: number;
      /** Still arriving as deltas: no entry has landed for it yet. */
      readonly draft: boolean;
      readonly stopReason: string | undefined;
      readonly errorMessage: string | undefined;
      /** The model that wrote it, as pi recorded it, once the entry has landed. */
      readonly model?: { readonly provider: string; readonly id: string };
      /** A draft kept across a reconnect: it goes once no turn runs and its message has not come. */
      readonly kept?: true;
    }
  | { readonly kind: "tool_result"; readonly key: string; readonly toolName: string; readonly result: ToolResult }
  | { readonly kind: "record"; readonly key: string; readonly form: string; readonly body: Readonly<Record<string, unknown>> }
  /**
   * A package's question that let cx go, folded where its card stood: its title and what went to pi. The page's own, as pi's interactive
   * mode keeps a dialog's outcome in the conversation; pi's record holds none, so a reload or another life draws it no more.
   */
  | { readonly kind: "asked"; readonly key: string; readonly title: string; readonly method: Dialog["method"]; readonly answer: DialogAnswer; readonly form?: AskForm }
  /** Where a question pi still waits on stands, in the order asked: its card is drawn there, and folds there. */
  | { readonly kind: "asking"; readonly key: string; readonly id: string }
  /**
   * A line cx says for the tutorial: the page's own, which pi never sees, the box never keeps and no model writes. It lives for the
   * visit, across another life, and a reload draws it no more. Its words are the line's in the page's language, with its values; while
   * it grows, `shown` is how many of its characters are drawn, and once it has ended there is none.
   */
  | { readonly kind: "guide"; readonly key: string; readonly line: GuideLine; readonly values: Readonly<Record<string, string>>; readonly shown: number | undefined };

export type StreamState = {
  readonly items: readonly Item[];
  /** The life the view holds; a `life` frame that names another clears it. */
  readonly epoch: string | undefined;
  /**
   * The id of the last entry shown, `<epoch>:0` in a new life, or `<epoch>:newest` in a kept life shown no entry yet: what a reconnect
   * resumes from, never read apart.
   */
  readonly cursor: string | undefined;
  /** The first place the view holds in its life, when the platform gave the newest part of it; what the part before is asked from. */
  readonly from: number | undefined;
  /** Stored entries lie before the first the view holds. */
  readonly earlier: boolean;
  /**
   * pi's last record of a model change in the life up to the newest part's first chunk, as the platform named it with that part: what the
   * record says when the part the view holds has no record of its own.
   */
  readonly model: { readonly provider: string; readonly id: string } | undefined;
  /** Why the platform ended the stream, when it has. */
  readonly ended: string | undefined;
  readonly sent: number;
  /** Whether pi is at work, in the box's own words: unknown until the box has said it on this connection. */
  readonly turn: boolean | undefined;
  /** pi writes the summary of the conversation: the box's word, which a reconnect or another life does not keep. */
  readonly tidying: boolean;
  /** How many times the connection broke and was taken up again: what ran across a break was not heard whole. */
  readonly breaks: number;
  /** The charges of the turns in the life the view holds, by the place each names, in order. */
  readonly charges: readonly Charge[];
  /** The titles in the parts the view holds, the latest per message: each shown as it arrives, whether or not a turn runs. */
  readonly titles: readonly Title[];
  /** The dialogs a package asked that pi may still wait on, in the order asked: no entry records one, and no life or part holds it. */
  readonly dialogs: readonly Dialog[];
  /** What a package said to the person in passing, until the page lets each go. */
  readonly notices: readonly Notice[];
};

/** cx's title on the person's message that began a piece of work: pi's id for that message, and the title; none when it was cleared. */
export type Title = { readonly target: string; readonly title: string | undefined };

/** The id of the page's own notice that the box dropped the person's default; pi's notices come by the box's ids, never this one. */
export const DROPPED_NOTICE = "cx:default-dropped";

export const EMPTY: StreamState = Object.freeze({ items: Object.freeze([]), epoch: undefined, cursor: undefined, from: undefined, earlier: false, model: undefined, ended: undefined, sent: 0, turn: undefined, tidying: false, breaks: 0, charges: Object.freeze([]), titles: Object.freeze([]), dialogs: Object.freeze([]), notices: Object.freeze([]) });

/** The cursor of a page with no place in any life: the newest part of the one the platform names. */
export const NEWEST = "newest";

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const word = (value: unknown): string => (typeof value === "string" ? value : "");

// A box whose steward predates the owned forms still sends pi's own `type: "text"` blocks; the page reads both shapes. Text blocks join
// as pi's interactive mode joins them: a person's message run together, a tool's result and a package's message a line apart.
const contentText = (content: unknown, between: "" | "\n"): string =>
  typeof content === "string" ? content : Array.isArray(content) ? content.filter((part) => record(part) && (part["form"] === "text" || part["type"] === "text")).map((part) => word((part as Record<string, unknown>)["text"])).join(between) : "";

const entryBlock = (part: unknown): Block => {
  if (!record(part)) return { kind: "other", form: "unknown", raw: part };
  if (part["form"] === "text") return { kind: "text", text: word(part["text"]) };
  if (part["form"] === "thinking") return { kind: "thinking", text: word(part["thinking"]) };
  if (part["form"] === "tool_call") {
    const args = record(part["arguments"]) ? part["arguments"] : undefined;
    return { kind: "tool_call", id: word(part["id"]), name: word(part["name"]), args, argsText: args === undefined ? "" : JSON.stringify(args), partial: undefined, result: undefined };
  }
  return { kind: "other", form: word(part["form"]), raw: part };
};

const blockText = (block: Block): string => (block.kind === "text" || block.kind === "thinking" ? block.text : block.kind === "tool_call" ? block.argsText : "");

/** A draft is the entry's beginning when, block for block, it is the same kind and its text opens the entry's. */
const opens = (draft: readonly Block[], entry: readonly Block[]): boolean =>
  draft.length <= entry.length && draft.every((block, at) => (placeHolder(block) || block.kind === entry[at]!.kind) && (block.kind === "tool_call" || blockText(entry[at]!).startsWith(blockText(block))));

const placeHolder = (block: Block): boolean => block.kind === "text" && block.cut === true && block.text === "";

const withToolCall = (items: readonly Item[], id: string, change: (block: Extract<Block, { kind: "tool_call" }>) => Block): readonly Item[] | undefined => {
  for (let at = items.length - 1; at >= 0; at--) {
    const item = items[at]!;
    if (item.kind !== "assistant") continue;
    const index = item.blocks.findIndex((block) => block.kind === "tool_call" && block.id === id);
    if (index === -1) continue;
    const blocks = item.blocks.map((block, i) => (i === index && block.kind === "tool_call" ? change(block) : block));
    return items.map((other, i) => (i === at ? { ...item, blocks } : other));
  }
  return undefined;
};

/**
 * Entries arrive in the session's order, and only when a turn ends — after the deltas of the turn they record. One that takes no echo's
 * or draft's place therefore belongs before everything still waiting for its own entry.
 */
const landed = (items: readonly Item[], item: Item): readonly Item[] => {
  const waiting = items.findIndex((other) => (other.kind === "user" && other.pending) || (other.kind === "assistant" && other.draft));
  return waiting === -1 ? [...items, item] : [...items.slice(0, waiting), item, ...items.slice(waiting)];
};

/**
 * A record the page knows is reduced to its display fields; one it does not know keeps its payload, so a record type a later pi adds is
 * held, never lost — whether it is drawn is the view's, as pi draws it. System and tool snapshots never reach here: the translator
 * removes them before an entry is stored or streamed.
 */
export function recordForView(form: string, body: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  if (form === "model_change") return { provider: word(body["provider"]), modelId: word(body["modelId"]) };
  if (form === "thinking_level_change") return { thinkingLevel: word(body["thinkingLevel"]) };
  if (form === "compaction" || form === "branch_summary") return { summary: word(body["summary"]) };
  if (form === "custom_message" && body["display"] === true) {
    const options = readOptionRecord(body["details"]);
    const type = typeof body["customType"] === "string" ? { customType: body["customType"] } : {};
    return { display: true, content: contentText(body["content"], "\n"), ...type, ...(options === undefined ? {} : { options }) };
  }
  if (form === "bash_execution") return { command: word(body["command"]), output: word(body["output"]), cancelled: body["cancelled"] === true, exitCode: typeof body["exitCode"] === "number" ? body["exitCode"] : undefined };
  if (form === "custom_message") return undefined;
  return body;
}

/** A life as the relay names one: 32 lowercase hexadecimal characters. */
const EPOCH = /^[0-9a-f]{32}$/;

/**
 * The echo pi's record of a message belongs to: the latest one the box passed on at or before the record's stamp. The page sends one
 * message at a time and pi answers each only once it has stamped its record, so no later message was passed on before an earlier one's
 * record was stamped; an echo pi recorded no message for — an extension's command — takes nothing and is not taken.
 */
const echoOf = (items: readonly Item[], at: number): number => {
  // The platform sends what it kept before anything sent after it, in the order written, on a clock the box's stamp is not read against.
  const first = items.findIndex((item) => item.kind === "user" && item.pending && item.held === true);
  if (first !== -1) return first;
  let found = -1;
  items.forEach((item, index) => {
    if (item.kind !== "user" || !item.pending || item.sentAt === undefined || item.sentAt > at) return;
    const best = items[found];
    if (best === undefined || (best.kind === "user" && (best.sentAt ?? 0) < item.sentAt)) found = index;
  });
  return found;
};

const entryIdOf = (data: Record<string, unknown>): { readonly entryId?: string } => (typeof data["entryId"] === "string" && data["entryId"] !== "" ? { entryId: data["entryId"] } : {});

/** A label pi wrote, as the record keeps it: the entry it names and its title, none when cleared. */
function titleOf(body: Record<string, unknown>): Title | undefined {
  if (body["form"] !== "other" || body["entryType"] !== "label" || !record(body["fields"])) return undefined;
  const { targetId, label } = body["fields"];
  if (typeof targetId !== "string" || targetId === "") return undefined;
  return { target: targetId, title: typeof label === "string" && label.trim() !== "" ? label.trim() : undefined };
}

/** Titles with later ones in: one written again for the same message replaces it, in its place. */
const named = (titles: readonly Title[], later: readonly Title[]): readonly Title[] =>
  later.reduce<readonly Title[]>((held, title) => (held.some((one) => one.target === title.target) ? held.map((one) => (one.target === title.target ? title : one)) : [...held, title]), titles);

function entry(state: StreamState, data: Record<string, unknown>, id: string | undefined): StreamState {
  // The relay sends entries in order within a life, so the last one's id is the place to resume from.
  const key = id ?? `entry-${word(data["entryId"])}`;
  const body = record(data["body"]) ? data["body"] : {};
  const next = { ...state, epoch: typeof data["epoch"] === "string" ? data["epoch"] : state.epoch, cursor: id ?? state.cursor };
  // pi takes a retried attempt and its tool results out of its record with a context edit to null: the page draws them no longer.
  // A seller's message is theirs and stays drawn, whatever pi keeps from it.
  if (body["form"] === "context_edit" && body["replacement"] === null) return { ...next, items: state.items.filter((item) => !(item.kind === "assistant" && item.entryId === body["targetId"])) };
  // Canonical metadata advances the reconnect cursor, but is neither a reply nor a visible chat record; an edit that rewrites is not drawn.
  if (["system", "usage", "context_edit"].includes(word(body["form"]))) return next;
  if (state.items.some((item) => item.key === key)) return next;
  const title = titleOf(body);
  // A title is the record's, not a line of the conversation: it is shown as it arrives, a turn under way or not.
  if (title !== undefined) return { ...next, titles: named(state.titles, [title]) };
  if (body["form"] !== "message") {
    const form = word(body["form"]);
    const visible = recordForView(form, body);
    if (visible === undefined) return next;
    const item: Item = { kind: "record", key, form, body: visible };
    // An answered option card's record takes the place of the card the page left, by its asking.
    const ask = readOptionRecord(visible["options"])?.ask;
    const fold = ask === undefined ? -1 : state.items.findIndex((one) => one.kind === "asked" && one.form?.ask === ask);
    return { ...next, items: fold === -1 ? landed(state.items, item) : state.items.map((one, at) => (at === fold ? item : one)) };
  }
  if (body["role"] === "user") {
    // pi's record of a message this page sent takes its echo's place, in pi's words — a skill, a template or an extension rewrites what
    // was sent — whether the box sends it as it happens or the store brings it in a batch. Any other lands where it arrives.
    const at = typeof body["timestamp"] === "number" ? body["timestamp"] : undefined;
    const echo = at === undefined ? -1 : echoOf(state.items, at);
    // One the platform kept was said when it was written, not when the box could hand it to pi.
    const kept = state.items[echo];
    const said = kept?.kind === "user" && kept.held === true && kept.at !== undefined ? kept.at : at;
    const item: Item = { kind: "user", key, ...entryIdOf(data), text: contentText(body["content"], ""), pending: false, at: said, ...(kept?.kind === "user" ? { echo: kept.key } : {}) };
    return { ...next, items: echo === -1 ? landed(state.items, item) : state.items.map((other, at) => (at === echo ? item : other)) };
  }
  if (body["role"] === "tool_result") {
    const result: ToolResult = { text: contentText(body["content"], "\n"), isError: body["isError"] === true };
    const calls = record(body["nestedCalls"]) && Array.isArray(body["nestedCalls"]["calls"]) ? body["nestedCalls"]["calls"].map(nestedOf) : undefined;
    const attached = withToolCall(state.items, word(body["toolCallId"]), (block) => {
      const { nested: _, ...rest } = block;
      return { ...rest, partial: undefined, result, ...(calls === undefined ? {} : { nested: calls }) };
    });
    return { ...next, items: attached ?? landed(state.items, { kind: "tool_result", key, toolName: word(body["toolName"]), result }) };
  }
  const blocks = Array.isArray(body["content"]) ? body["content"].map(entryBlock) : [];
  const item: Item = { kind: "assistant", key, ...entryIdOf(data), blocks, ...(typeof body["timestamp"] === "number" ? { at: body["timestamp"] + (typeof body["durationMs"] === "number" ? body["durationMs"] : 0) } : {}), draft: false, stopReason: typeof body["stopReason"] === "string" ? body["stopReason"] : undefined, errorMessage: typeof body["errorMessage"] === "string" ? body["errorMessage"] : undefined, ...(typeof body["provider"] === "string" && typeof body["model"] === "string" ? { model: { provider: body["provider"], id: body["model"] } } : {}) };
  const draft = state.items.findIndex((other) => other.kind === "assistant" && other.draft && opens(other.blocks, blocks));
  // An error with nothing written that no Stop made is the box's end of a run whose pi died: it ends the draft that pi never wrote down,
  // which keeps what the page heard of it.
  const died = draft === -1 && blocks.length === 0 && item.stopReason === "error" && !plainStop(item.errorMessage)
    ? state.items.findLastIndex((other) => other.kind === "assistant" && other.draft) : -1;
  const items = died !== -1 ? state.items.map((other, at) => (at === died && other.kind === "assistant" ? { ...item, blocks: other.blocks } : other))
    : draft === -1 ? landed(state.items, item) : state.items.map((other, at) => (at === draft ? item : other));
  return { ...next, items: blocks.length === 0 && item.stopReason === "error" && plainStop(item.errorMessage) ? afterStoppedStep(items, key) : items };
}

/** The empty message pi writes once a Stop cut its steps short: a call of the message before it that has no result was never reached. */
function afterStoppedStep(items: readonly Item[], key: string): readonly Item[] {
  const at = items.findIndex((item) => item.key === key);
  let above = at - 1;
  while (above >= 0 && items[above]!.kind !== "assistant") above--;
  const before = above >= 0 ? items[above] : undefined;
  if (before === undefined || before.kind !== "assistant" || before.draft) return items;
  const blocks = before.blocks.map((block) => (block.kind === "tool_call" && block.result === undefined ? { ...block, unreached: true as const } : block));
  return items.map((item, place) => (place === above ? { ...before, blocks } : item));
}

/** Where the conversation pi is writing ends: before the echoes pi holds until a turn's end, which stay below what it writes. */
export const beforeQueued = (items: readonly Item[]): number => {
  let at = items.length;
  while (at > 0 && queued(items[at - 1]!)) at--;
  return at;
};

/**
 * Whether an item is one of the stream's messages: what the person and pi said, and the records pi keeps between them. A tutorial line
 * is a row the page draws, never a message. A reader that means a message (the draft a delta goes on, what stands next to what, the
 * latest message) reads through `message` or `messages`; a reader that means a row on the page reads every item.
 */
export const message = (item: Item): boolean => item.kind !== "guide";

/** The stream's messages, in order, without the rows that are not messages. */
export const messages = (items: readonly Item[]): readonly Item[] => items.filter(message);

/** A question's place, open or folded: the page's own, which says nothing of what pi wrote. */
export const askedHere = (item: Item): boolean => item.kind === "asked" || item.kind === "asking";

/** The last thing said where pi writes, above what waits for a turn's end: a question's place is the page's own and says nothing of the turn. */
export const lastSaid = (items: readonly Item[]): Item | undefined => messages(items.slice(0, beforeQueued(items))).findLast((item) => !askedHere(item));

/** A draft's key, never one an item holds: a withdrawn echo or a draft kept across a reconnect leaves the count behind a key in use. */
const freshKey = (items: readonly Item[]): string => {
  let count = items.length;
  while (items.some((item) => item.key === `draft-${count}`)) count++;
  return `draft-${count}`;
};

/** A block made whole: its end or the call's own arguments arrived, so nothing it holds was joined across a gap. */
const whole = <B extends Block>(block: B): B => {
  const { cut: _, ...rest } = block as B & Cut;
  return rest as B;
};

const queued = (item: Item): boolean => item.kind === "user" && item.pending && item.queued === true;

function messageDelta(state: StreamState, body: Record<string, unknown>): StreamState {
  const event = word(body["event"]);
  const index = typeof body["contentIndex"] === "number" ? body["contentIndex"] : 0;
  const queuedAt = beforeQueued(state.items);
  // A question asked after the draft that asked it is the page's own, and so is a tutorial line: the draft goes on in its place above
  // them, and a new message goes below them.
  const last = messages(state.items.slice(0, queuedAt)).findLast((item) => !askedHere(item));
  const current = last !== undefined && last.kind === "assistant" && last.draft ? last : undefined;
  const at = current === undefined ? -1 : state.items.indexOf(current);
  // pi sends no frame for a message's beginning: a block that starts at a position the draft already holds is the next message's.
  const fresh = current === undefined || (event.endsWith("_start") && index < current.blocks.length);
  const draft = fresh ? { kind: "assistant" as const, key: freshKey(state.items), blocks: [] as readonly Block[], draft: true, stopReason: undefined, errorMessage: undefined } : current;
  const blocks = [...draft.blocks];
  const kind = event.startsWith("text") ? "text" : event.startsWith("thinking") ? "thinking" : event.startsWith("toolcall") ? "tool_call" : undefined;
  if (kind === undefined) return state;
  // A block is heard from its start; one whose start was missed holds its place, and so does every block before it this page never heard.
  const started = event.endsWith("_start");
  const empty = (heard: boolean): Block => {
    const cut = heard ? {} : { cut: true as const };
    return kind === "tool_call" ? { kind, id: "", name: "", args: undefined, argsText: "", partial: undefined, result: undefined, ...cut } : { kind, text: "", ...cut };
  };
  while (blocks.length < index) blocks.push({ kind: "text", text: "", cut: true });
  if (blocks.length === index || (placeHolder(blocks[index]!) && kind !== "text")) blocks[index] = empty(started);
  const held = blocks[index]!;
  const delta = word(body["delta"]);
  const ended = event.endsWith("_end");
  if (held.kind === "tool_call") {
    const call = record(body["toolCall"]) ? body["toolCall"] : undefined;
    blocks[index] = call !== undefined ? { ...whole(held), id: word(call["id"]), name: word(call["name"]), args: record(call["arguments"]) ? call["arguments"] : undefined, argsText: record(call["arguments"]) ? JSON.stringify(call["arguments"]) : held.argsText }
      : held.cut ? held : { ...held, argsText: held.argsText + delta };
  } else if (held.kind === "text" || held.kind === "thinking") {
    // The block's end carries its whole text, which also mends a block whose deltas this page did not all hear.
    blocks[index] = ended && typeof body["content"] === "string" ? { ...whole(held), text: body["content"] } : held.cut ? held : { ...held, text: held.text + delta };
  }
  const item: Item = { ...draft, blocks };
  return { ...state, items: fresh ? [...state.items.slice(0, queuedAt), item, ...state.items.slice(queuedAt)] : [...state.items.slice(0, at), item, ...state.items.slice(at + 1)] };
}

/**
 * The view in the life named. Another life is another session: what the view held belongs to none of it, and the new life is served from
 * its start. The person's messages still waiting for their entries are theirs whichever life takes them, so they go on into the new one,
 * and so do the tutorial's lines, which are the visit's; whether pi is at work is the box's, not the life's.
 */
function inLife(state: StreamState, epoch: string): StreamState {
  if (epoch === state.epoch) return state;
  const waiting = state.items.filter((item) => (item.kind === "user" && item.pending) || item.kind === "guide");
  // The page's word that the box dropped a default is said of the start that brings the new life.
  const told = state.notices.filter((one) => one.id === DROPPED_NOTICE);
  return { ...EMPTY, sent: state.sent, turn: state.turn, epoch, cursor: `${epoch}:0`, items: waiting, notices: told };
}

/** Projects canonical entries into chat display fields; hidden metadata still advances the reconnect cursor. */
export function reduce(state: StreamState, incoming: StreamEvent): StreamState {
  const next = step(state, incoming);
  return next.dialogs === state.dialogs ? next : placed(next);
}

function step(state: StreamState, incoming: StreamEvent): StreamState {
  const data = record(incoming.data) ? incoming.data : {};
  if (incoming.event === "entry" || incoming.event === "entries") {
    const folded = incoming.event === "entry" ? entry(state, data, incoming.id) : batch(state, data);
    return folded.turn === false ? kept(folded) : folded;
  }
  if (incoming.event === "turn") {
    const running = data["running"];
    if (typeof running !== "boolean") return state;
    // The box says no turn runs only after the turn's entries, whether a connection reaches it or a turn ends live: nothing more of a
    // kept draft's message comes. A turn that starts after it is another message.
    // A dialog holds its turn open or was left behind by it: the end of a turn heard running takes every one, as the platform's hold does.
    // An option card does not hold cx: it stays past the turn, for as long as pi waits on it, whatever its answer's way meanwhile.
    const over = !running && state.turn === true;
    const outlive = over ? state.dialogs.filter(isOptionCard) : state.dialogs;
    const next = { ...state, turn: running, ...(outlive.length !== state.dialogs.length ? { dialogs: outlive } : {}) };
    return !running || state.turn === false ? kept(next) : next;
  }
  if (incoming.event === "ui_request") return asked(state, data);
  if (incoming.event === "dialogs") return data["epoch"] === state.epoch && Array.isArray(data["open"]) ? open(state, data["open"]) : state;
  // The platform's word that a dialog it held ended, by the answer the box took: the card folds by that answer, whoever gave it.
  if (incoming.event === DIALOG_ENDED) {
    const answer = readDialogAnswer(data["answer"]);
    return data["epoch"] === state.epoch && typeof data["id"] === "string" && answer !== undefined ? letGo(state, data["id"], answer) : state;
  }
  // pi goes with a box that goes to sleep, and what it waited on with it. An option card stands: its package asks it again when the
  // computer is next on, and the card asked again takes its place.
  if (incoming.event === "sleep") {
    const standing = state.dialogs.filter(isOptionCard);
    return data["dueInMs"] === 0 && standing.length !== state.dialogs.length ? { ...state, dialogs: standing } : state;
  }
  if (incoming.event === "charge") {
    if (data["epoch"] !== state.epoch) return state;
    return charged(state, [data], true);
  }
  if (incoming.event === "charges") return data["epoch"] === state.epoch && Array.isArray(data["charges"]) ? charged(state, data["charges"], false) : state;
  if (incoming.event === "compaction") {
    const running = data["running"];
    return typeof running === "boolean" && running !== state.tidying ? { ...state, tidying: running } : state;
  }
  if (incoming.event === "life") {
    const epoch = data["epoch"];
    return typeof epoch === "string" && EPOCH.test(epoch) ? inLife(state, epoch) : state;
  }
  if (incoming.event === "end") return { ...state, ended: word(data["reason"]) };
  if (incoming.event !== "delta" || !record(data["body"])) return state;
  const body = data["body"];
  if (body["form"] === "message_delta") return messageDelta(state, body);
  if (body["form"] === "tool_delta" && record(body["nested"])) {
    const begun = nestedOf(body["nested"]);
    return { ...state, items: withToolCall(state.items, word(body["toolCallId"]), (block) => (block.result === undefined ? { ...block, nested: [...(block.nested ?? []), begun] } : block)) ?? state.items };
  }
  if (body["form"] === "tool_delta") {
    const partial = record(body["partial"]) ? contentText(body["partial"]["content"], "\n") : "";
    return { ...state, items: withToolCall(state.items, word(body["toolCallId"]), (block) => ({ ...block, partial })) ?? state.items };
  }
  return state;
}

/** A package's request as the box sent it: a dialog or a notice is held once, by its id, and any other request draws nothing. */
function asked(state: StreamState, data: Record<string, unknown>): StreamState {
  const read = readUiRequest(data["id"], data["body"]);
  if (read === undefined) return state;
  if (read.method === "notify") return state.notices.some((one) => one.id === read.id) ? state : { ...state, notices: [...state.notices, read] };
  return state.dialogs.some((one) => one.id === read.id) || hasFold(state, read.id) ? state : { ...state, dialogs: withAsked(state.dialogs, [read]) };
}

/**
 * Dialogs heard added to those held, in the order asked: an option card asked again — the same asking, from another start of the computer
 * — takes the place of the card that stood for it.
 */
function withAsked(held: readonly Dialog[], heard: readonly Dialog[]): readonly Dialog[] {
  let all = held;
  for (const one of heard) {
    const at = isOptionCard(one) ? all.findIndex((other) => isOptionCard(other) && other.form.ask === one.form.ask) : -1;
    all = at === -1 ? [...all, one] : all.map((other, place) => (place === at ? one : other));
  }
  return all;
}

/**
 * Whether the page folded a dialog already: by what it sent at the turn's end, the platform's word or an acknowledgement. A frame that
 * names it again — the recording's lag behind what this page heard — opens nothing: one id, one card, one outcome.
 */
const hasFold = (state: StreamState, id: string): boolean => state.items.some((item) => item.kind === "asked" && item.key === `asked-${id}`);

/**
 * The dialogs the platform holds open as a connection reaches the box: the page takes the ones it was not attached to hear. It lets go
 * of none for not being named — the platform's hold can lose a dialog pi still waits on, and a card for one pi has let go costs a press
 * that pi ignores, where a card taken away leaves pi waiting on an answer nobody can give.
 */
function open(state: StreamState, named: readonly unknown[]): StreamState {
  const unheard = named.flatMap((one): Dialog[] => {
    const read = record(one) ? readUiRequest(one["id"], one["body"]) : undefined;
    return read === undefined || read.method === "notify" || state.dialogs.some((held) => held.id === read.id) || hasFold(state, read.id) ? [] : [read];
  });
  return unheard.length === 0 ? state : { ...state, dialogs: withAsked(state.dialogs, unheard) };
}

/** How long a package's word to the person stands in the conversation before the page lets it go. */
export const NOTICE_MS = 8_000;

/** A dialog or a notice the page is done with: said long enough, or a dialog pi no longer waits on that folds into nothing. */
export function closed(state: StreamState, id: string): StreamState {
  if (!state.dialogs.some((one) => one.id === id) && !state.notices.some((one) => one.id === id)) return state;
  return placed({ ...state, dialogs: state.dialogs.filter((one) => one.id !== id), notices: state.notices.filter((one) => one.id !== id) });
}

/**
 * A dialog that let cx go, by the answer that ended it — the seller's, their way out, or the end of its wait: the card leaves the dialogs
 * and its place in the conversation holds it folded, so questions stand in the order asked however they are answered.
 */
export function letGo(state: StreamState, id: string, answer: DialogAnswer): StreamState {
  return foldCard(state, id, answer) ?? state;
}

/** The card of a dialog pi waits on, folded where it stood by an answer; undefined for a dialog the page does not hold. */
function foldCard(state: StreamState, id: string, answer: DialogAnswer): StreamState | undefined {
  const dialog = state.dialogs.find((one) => one.id === id);
  if (dialog === undefined) return undefined;
  const key = `asked-${id}`;
  const fold: Item = { kind: "asked", key, title: dialog.title, method: dialog.method, answer, ...(isOptionCard(dialog) ? { form: dialog.form } : {}) };
  const at = state.items.findIndex((item) => item.kind === "asking" && item.id === id);
  const end = beforeQueued(state.items);
  // An option card whose package's record came first is left as that record: one row a question, whichever arrives first.
  const recorded = isOptionCard(dialog) && state.items.some((item) => item.kind === "record" && readOptionRecord(item.body["options"])?.ask === dialog.form.ask);
  const items = recorded ? state.items : at >= 0 ? [...state.items.slice(0, at), fold, ...state.items.slice(at + 1)]
    : state.items.some((item) => item.key === key) ? state.items : [...state.items.slice(0, end), fold, ...state.items.slice(end)];
  return { ...state, items, dialogs: state.dialogs.filter((one) => one.id !== id) };
}

/**
 * The places of the dialogs pi waits on, kept with what the page holds: one newly heard stands where pi writes next, above what waits
 * for a turn's end, and one pi no longer waits on leaves no place unless it folded.
 */
function placed(state: StreamState): StreamState {
  // An option card has no place in the conversation: it stands under the newest output, and its fold lands where it stood.
  const waiting = new Set(state.dialogs.filter((one) => !isOptionCard(one)).map((one) => one.id));
  const kept = state.items.filter((item) => item.kind !== "asking" || waiting.has(item.id));
  const held = new Set(kept.map((item) => item.key));
  const fresh = state.dialogs.filter((one) => waiting.has(one.id) && !held.has(`asked-${one.id}`)).map((one): Item => ({ kind: "asking", key: `asked-${one.id}`, id: one.id }));
  if (fresh.length === 0 && kept.length === state.items.length) return state;
  const end = beforeQueued(kept);
  return { ...state, items: fresh.length === 0 ? kept : [...kept.slice(0, end), ...fresh, ...kept.slice(end)] };
}

const place = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 1;

/** A life's stored entries folded onto a state, each as a live one would be, in their order. */
const folded = (state: StreamState, epoch: string, entries: readonly unknown[]): StreamState =>
  entries.reduce<StreamState>((held, one) => (record(one) && one["epoch"] === epoch && place(one["seq"]) ? entry(held, one, `${epoch}:${one["seq"]}`) : held), state);

/**
 * What the store holds after the cursor, in one event: every entry goes through the same fold as a live one, and the view is drawn once
 * for all of them. A batch names its life; one that names another starts that life as a `life` frame does, without the box having spoken.
 * A batch with no entry names the life the view is in and says nothing of it is stored past the place the view holds. The newest part of a
 * life also says where it begins and whether anything is stored before it.
 */
function batch(state: StreamState, data: Record<string, unknown>): StreamState {
  const epoch = data["epoch"];
  const entries = data["entries"];
  if (typeof epoch !== "string" || !EPOCH.test(epoch) || !Array.isArray(entries)) return state;
  const entered = inLife(state, epoch);
  const withCharges = (held: StreamState): StreamState => (Array.isArray(data["charges"]) ? charged(held, data["charges"], false) : held);
  if (!place(data["from"])) return withCharges(folded(entered, epoch, entries));
  const named = record(data["model"]) ? data["model"] : {};
  const model = typeof named["provider"] === "string" && named["provider"] !== "" && typeof named["modelId"] === "string" && named["modelId"] !== "" ? { provider: named["provider"], id: named["modelId"] } : undefined;
  return withCharges(folded({ ...entered, from: data["from"], earlier: data["earlier"] === true, model }, epoch, entries));
}

/**
 * The charges a state holds with these added, each once by the place it names, in order. A charge is a whole sum above zero at a place in
 * the life; anything else is not one, and a place already charged keeps what it holds.
 */
function charged(state: StreamState, values: readonly unknown[], live: boolean): StreamState {
  const held = new Set(state.charges.map((charge) => charge.seq));
  const added: Charge[] = [];
  for (const value of values) {
    if (!record(value) || !place(value["seq"]) || held.has(value["seq"])) continue;
    const units = value["units"];
    if (typeof units !== "number" || !Number.isSafeInteger(units) || units <= 0) continue;
    held.add(value["seq"]);
    added.push({ seq: value["seq"], ...(live ? { live: true as const } : {}) });
  }
  return added.length === 0 ? state : { ...state, charges: [...state.charges, ...added].sort((a, b) => a.seq - b.seq) };
}

/**
 * The part of the life stored before the first place the view holds, put before what it holds: folded on its own, since it ends where a
 * person's message begins, and never twice. A part of another life, or one that does not end where the view begins, is not the view's.
 */
export function earlier(state: StreamState, answer: { readonly epoch: string; readonly entries: readonly unknown[]; readonly from: number; readonly earlier: boolean; readonly charges?: readonly unknown[] }): StreamState {
  if (answer.epoch !== state.epoch || state.from === undefined) return state;
  const last = answer.entries.at(-1);
  if (answer.entries.length > 0 && !(record(last) && last["seq"] === state.from - 1)) return state;
  if (answer.entries.length === 0) return { ...state, earlier: false };
  const part = folded({ ...EMPTY, epoch: answer.epoch }, answer.epoch, answer.entries);
  const held = new Set(state.items.map((item) => item.key));
  // A part stored before the view is whole: its titles are older than the view's, which keep theirs over any it names again.
  const titles = named(part.titles, state.titles);
  return charged({ ...state, items: [...part.items.filter((item) => !held.has(item.key)), ...state.items], from: answer.from, earlier: answer.earlier, titles }, answer.charges ?? [], false);
}

type Part = { readonly epoch: string; readonly entries: readonly unknown[]; readonly from: number; readonly earlier: boolean; readonly charges?: readonly unknown[] };

/** The place a view's last entry holds, as its sequence number in the life; 0 before any. */
export const lastSeq = (state: StreamState): number => {
  const seq = state.cursor === undefined ? undefined : Number(state.cursor.slice(state.cursor.lastIndexOf(":") + 1));
  return seq !== undefined && Number.isSafeInteger(seq) ? seq : 0;
};

/**
 * A stretch of the life read from a place, held apart from the live view so that a jump never touches the turn the stream carries: its
 * items by the same fold, where it begins, whether more is stored before it, and its titles.
 */
export function stretch(answer: Part): StreamState {
  const part = folded({ ...EMPTY, epoch: answer.epoch }, answer.epoch, answer.entries);
  return charged({ ...part, from: answer.from, earlier: answer.earlier }, answer.charges ?? [], false);
}

/** A stretch with what is stored after it: entries past its last fold on, and one it holds already is not taken twice. */
export function later(state: StreamState, answer: Part): StreamState {
  if (answer.epoch !== state.epoch) return state;
  const after = lastSeq(state);
  const part = folded(state, answer.epoch, answer.entries.filter((one) => record(one) && place(one["seq"]) && one["seq"] > after));
  return charged(part, answer.charges ?? [], false);
}

/**
 * The live view with a stretch that has reached it put before what it holds, as an earlier part would be: the reader keeps every line
 * between, and the stretch is no longer apart. A stretch that has not reached the live view's first entry, or is of another life, leaves it.
 */
export function joined(live: StreamState, away: StreamState): StreamState {
  const from = live.from;
  if (live.epoch === undefined || away.epoch !== live.epoch || from === undefined || away.from === undefined || lastSeq(away) < from - 1) return live;
  const held = new Set(live.items.map((item) => item.key));
  const before = away.items.filter((item) => !held.has(item.key) && seqOfKey(item.key) < from);
  const charges = [...away.charges.filter((charge) => charge.seq < from), ...live.charges];
  return { ...live, items: [...before, ...live.items], from: Math.min(away.from, from), earlier: away.from < from ? away.earlier : live.earlier, titles: named(away.titles, live.titles), charges };
}

const seqOfKey = (key: string): number => { const seq = Number(key.slice(key.lastIndexOf(":") + 1)); return Number.isSafeInteger(seq) ? seq : Number.POSITIVE_INFINITY; };

/**
 * A new connection serves entries from the cursor and deltas from where pi is, never what was said between: a draft keeps what the page
 * heard, each of its blocks cut so nothing joins across the gap, until pi's record of it lands or no turn runs. Whether pi is at work
 * stays as last heard until the box says it again, which a box that is awake does as the connection reaches it: a turn still running
 * keeps its Stop and its line across a new connection.
 */
export function reconnected(state: StreamState): StreamState {
  const items = state.items.map((item) => (item.kind === "assistant" && item.draft ? { ...item, kept: true as const, blocks: item.blocks.map((block) => (block.kind === "other" ? block : { ...block, cut: true as const })) } : item));
  return { ...state, ended: undefined, tidying: false, breaks: state.breaks + 1, items };
}

/** A draft kept across a reconnect whose message has not come, once no turn runs: pi will not write it. */
const kept = (state: StreamState): StreamState =>
  state.items.some((item) => item.kind === "assistant" && item.kept === true) ? { ...state, items: state.items.filter((item) => item.kind !== "assistant" || item.kept !== true) } : state;

/** The life a page last showed an account, as it keeps it across a reload: the account's own, and nobody else's; an account with no id keeps none. */
export const placeWord = (account: string, epoch: string): string | undefined => (account === "" ? undefined : JSON.stringify({ account, epoch }));

/** The kept life for this account, if a well-formed one is kept for it. */
export function readPlace(kept: string | null, account: string): string | undefined {
  let value: unknown;
  try { value = JSON.parse(kept ?? ""); } catch { return undefined; }
  if (!record(value) || value["account"] !== account || account === "") return undefined;
  const epoch = value["epoch"];
  return typeof epoch === "string" && EPOCH.test(epoch) ? epoch : undefined;
}

/** A page that kept its place across a reload: nothing held yet, and the newest part of the life asked for. */
export function resumedAt(epoch: string): StreamState {
  return { ...EMPTY, epoch, cursor: `${epoch}:${NEWEST}` };
}

/** A message this page sent, shown at once: pi's record of it arrives only when the turn it began ends. */
export function sent(state: StreamState, message: string, at: number | undefined = undefined): StreamState {
  const held = working(state) || state.items.some((item) => item.kind === "user" && item.pending);
  const item: Item = { kind: "user", key: `sent-${state.sent}`, text: message, pending: true, at, ...(held ? { queued: true as const } : {}) };
  return { ...state, sent: state.sent + 1, items: [...state.items, item] };
}

/** The box took the message the echo `key` shows and passed it to pi at `sentAt`, on its own clock. */
export function stamped(state: StreamState, key: string, sentAt: number): StreamState {
  return { ...state, items: state.items.map((item) => (item.key === key && item.kind === "user" && item.pending ? { ...item, sentAt } : item)) };
}

/** The echo `key` is a message the platform keeps for the box: pi's record of it is the next of the person's to land. */
export function waitsForBox(state: StreamState, key: string): StreamState {
  return { ...state, items: state.items.map((item) => (item.key === key && item.kind === "user" && item.pending ? { ...item, held: true as const } : item)) };
}

/** The person's message withdrawn before it reached the box — the box would not open — so its words go back to them, not into the stream. */
export function withdrawn(state: StreamState, key: string): StreamState {
  return { ...state, items: state.items.filter((item) => item.key !== key || item.kind !== "user" || !item.pending) };
}

/** Whether a turn is running: the box's word alone, which a page that has not heard it on this connection does not have. */
export const working = (state: StreamState): boolean => state.turn === true;

/**
 * A turn's end as the stream states it: its turn seen running, then not, in one life. A stream that breaks or is let go leaves the turn
 * as it last heard it, so a page that stops hearing sees no end; the end comes when the stream says so, once for each turn.
 */
export class TurnEnds {
  #epoch: string | undefined;
  #turn: boolean | undefined;

  /** The stream, as often as it changes: true once, at the change that ends a turn this page saw run. */
  seen(stream: StreamState): boolean {
    if (stream.epoch !== this.#epoch) { this.#epoch = stream.epoch; this.#turn = undefined; }
    const ended = this.#turn === true && stream.turn === false;
    this.#turn = stream.turn;
    return ended;
  }
}

/**
 * The box says no turn runs and no summary of the chat runs, and all the person has on its way waits behind a turn: nothing is being read.
 * What waits is drawn waiting and is the page's to hand on; cx is not drawn reading it, as the message box does not offer to stop it. A
 * summary running is work, whatever waits: it is said and drawn as such.
 */
export const queuedAtRest = (state: StreamState): boolean =>
  state.turn === false && !state.tidying && state.items.some(queued) && !state.items.some((item) => item.kind === "user" && item.pending && item.queued !== true);


/**
 * The texts pi writes for a stop the person made, which a pi upgrade re-reads. A message: pi's interface's `Request was aborted`, its
 * retry helper's and undici's `Request aborted`, and the runtime's `This operation was aborted`, which pi's adapter passes on mid-text and
 * gives the empty message it writes after a stopped step. A step stopped mid-run returns an error: bash its output so far closed by
 * `Command aborted`, every other built-in `Operation aborted` alone; a call pi skipped before its tool ran, bash's too, `Operation aborted`
 * alone. None says anything past the stop itself.
 */
export const STOP_TEXTS = { message: ["Request was aborted", "Request aborted", "This operation was aborted"], bash: "Command aborted", step: "Operation aborted" } as const;

/** A message's error text that says only that the person stopped it. */
export const plainStop = (errorMessage: string | undefined): boolean => errorMessage !== undefined && (STOP_TEXTS.message as readonly string[]).includes(errorMessage);

/** A step the person's Stop cut short: its result is only the abort text pi's tool gives, which marks it, and nothing else does. */
export function stepStopped(call: Extract<Block, { kind: "tool_call" }>): boolean {
  if (call.unreached === true) return true;
  if (call.result?.isError !== true) return false;
  const text = call.result.text.trimEnd();
  return text === STOP_TEXTS.step || (call.name === "bash" && (text === STOP_TEXTS.bash || text.endsWith(`\n${STOP_TEXTS.bash}`)));
}

/**
 * What a failed model call is called on the page. The proxy's refusals reach the page only inside pi's error text, by their codes: a model
 * the platform's key does not serve, a call the balance cannot cover, read as the balance that cannot pay in the words the page already has
 * for it, a call on the balance for a model whose card the seller turned the balance off for, and a way the seller pays by that has run out. A provider can write a refusal's words too, so a way ran out only where the
 * steward recorded the move it made on the platform's vouched refusal (`moved`); anything else is the plain failure.
 */
export const failureWords = (errorMessage: string | undefined, moved: boolean): "stream.modelNotServed" | "stream.balanceOff" | "stream.wayUsedUp" | "cx.say.balance" | "stream.error" =>
  errorMessage === undefined ? "stream.error"
    : errorMessage.includes("model_not_served") ? "stream.modelNotServed"
    : errorMessage.includes("balance_off") ? "stream.balanceOff"
    : /weight_exceeds_budget|in_flight_budget_exhausted/.test(errorMessage) ? "cx.say.balance"
    : moved && readWayUsedUp(errorMessage) !== undefined ? "stream.wayUsedUp" : "stream.error";

/**
 * The model pi last recorded in the conversation: its own record of a model change, read while the box sleeps — in the part the page
 * holds, or else as the platform named it with the newest part, so the answer does not depend on how much is loaded.
 */
export function lastModel(state: StreamState): { readonly provider: string; readonly id: string } | undefined {
  return lastModelRecord(state.items) ?? state.model;
}

/** The model pi last recorded among `items`. */
export function lastModelRecord(items: readonly Item[]): { readonly provider: string; readonly id: string } | undefined {
  for (let at = items.length - 1; at >= 0; at--) {
    const item = items[at]!;
    if (item.kind !== "record" || item.form !== "model_change") continue;
    const provider = item.body["provider"], id = item.body["modelId"];
    if (typeof provider === "string" && typeof id === "string" && provider !== "" && id !== "") return { provider, id };
  }
  return undefined;
}

/**
 * The page's word that cx says a tutorial line, grows it or ends it: never a frame of the platform's, so nothing the box sends draws one.
 * `key` names the line in the visit, `line` which it is, `values` what it says, and `shown` how many characters are drawn while it grows;
 * without `shown` it has ended.
 */
export const CX_SAYS = "cx_says";

export type CxSays = { readonly key: string; readonly line: GuideLine; readonly values?: Readonly<Record<string, string>>; readonly shown?: number };

/** A `cx_says` word as the page gave it, or nothing where it is not one. */
export function readCxSays(data: unknown): CxSays | undefined {
  if (!record(data) || typeof data["key"] !== "string" || data["key"] === "" || !isGuideLine(data["line"])) return undefined;
  const given = record(data["values"]) ? data["values"] : {};
  const values = Object.fromEntries(Object.entries(given).filter((pair): pair is [string, string] => typeof pair[1] === "string"));
  const shown = data["shown"];
  return { key: data["key"], line: data["line"], values, ...(typeof shown === "number" && Number.isSafeInteger(shown) && shown >= 0 ? { shown } : {}) };
}

/**
 * A tutorial line said, grown or ended: one the view holds takes its place, and a new one stands where pi writes next, above what waits
 * for a turn's end.
 */
export function cxSays(state: StreamState, said: CxSays): StreamState {
  const item: Item = { kind: "guide", key: `guide:${said.key}`, line: said.line, values: said.values ?? {}, shown: said.shown };
  const at = state.items.findIndex((one) => one.key === item.key);
  if (at >= 0) return { ...state, items: [...state.items.slice(0, at), item, ...state.items.slice(at + 1)] };
  const end = beforeQueued(state.items);
  return { ...state, items: [...state.items.slice(0, end), item, ...state.items.slice(end)] };
}
