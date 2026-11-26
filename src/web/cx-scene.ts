import type { Blocked, Box, CxState } from "./box-state.js";
import type { CxDot, CxReason, CxSignals } from "./cx.js";
import { lastSaid, queuedAtRest, type StreamState } from "./stream-model.js";
import type { StringKey } from "./strings.js";

/**
 * What the answer is doing while pi is at work, from the last block of what pi is writing — a message sent while it works waits below that
 * and changes nothing: a message sent and nothing back yet, the model thinking, a
 * step running, text arriving. A tool whose message has landed runs before the next message begins, so a turn
 * stays at work between them. A summary of the chat running is analysing, whatever came before it.
 */
export type Turn = "none" | "reading" | "thinking" | "analysing" | "writing";

export function turnOf(stream: StreamState, atWork: boolean): Turn {
  if (!atWork || queuedAtRest(stream)) return "none";
  // A summary running is the work, whatever the entry before it holds: an answer, one that failed empty, or nothing.
  if (stream.tidying) return "analysing";
  const last = lastSaid(stream.items);
  if (last === undefined || last.kind === "user") return "reading";
  if (last.kind !== "assistant") return "analysing";
  const block = last.blocks.at(-1);
  if (block === undefined) return "reading";
  if (block.kind === "thinking") return last.draft ? "thinking" : "analysing";
  // A finished answer leaves cx writing into the turn's end, rather than turning to analysing between the answer's entry and the turn's
  // end. A reconnect mid-turn draws cx writing until the next frame.
  if (block.kind === "text") return "writing";
  return "analysing";
}

/**
 * What the corner knows of cx and its computer, one at a time; each decides the drawing, both cards and what cx says as it begins.
 * `unknown` is a computer the page has not read yet; out of reach is two, by what was last heard.
 */
export type Kind = "unknown" | "off" | "starting" | "on" | "working" | "refused" | "failed" | "balance" | "unreachable" | "unreachableAsleep";

/** What a card can offer. An action that cannot run now is not in the card. */
export type Act = "on" | "off" | "stopOff" | "retry" | "stop" | "compact" | "help";
export const ACT_WORDS = { on: "cx.on", off: "cx.off", stopOff: "cx.stopOff", retry: "cx.retry", stop: "composer.stop", compact: "cx.compact", help: "menu.help" } as const satisfies Record<Act, StringKey>;

export type Said = { readonly key: StringKey; readonly values?: Readonly<Record<string, string | number>> };
/** What a click on one of the two opens: one line saying what that one is doing now, and what can be done now. */
export type Card = { readonly title: Said; readonly acts: readonly Act[] };

/** The box's last minute before its sleep, when cx yawns and the card's title says so in its own words. The page holds no other threshold. */
export const MINUTE_MS = 60_000;

export type SceneInput = {
  /** The seller's restart is under way, from its press until the account is read again: both targets say so, and offer nothing. */
  readonly restarting?: boolean;
  /** The seller's switch-off is under way, from its press until it answers: the computer says so, offers nothing, and cx sleeps. */
  readonly switchingOff?: boolean;
  /** `/me` says the account has no computer: it reached the page only by 跳过 on the road's plans after its trial. */
  readonly pending: boolean;
  readonly box: Box;
  readonly closing: boolean;
  readonly stream: StreamState;
  /** pi at work for the person: from a message sent until its turn ends, and while any turn runs. */
  readonly atWork: boolean;
  /** What the last open came to, while it was not an open. */
  readonly refusal: Blocked | undefined;
  /** `/me` says the balance is under the floor an open needs. */
  readonly floor: boolean;
  /** The platform is out of reach: the account could not be read, or the stream is being asked for again. */
  readonly unreachable: boolean;
  /** Something asked of the box from a card has not answered yet. */
  readonly asking: boolean;
  /** Less than one whole unit of the account's currency is left. */
  readonly low: boolean;
  readonly typing: boolean;
  /** The composer's length. */
  readonly draft: number;
  /** When the box last said it will sleep, and the time now. */
  readonly sleepDueAt: number | undefined;
  readonly now: number;
  /** A new version waits on a computer kept on: it takes it only at a restart. */
  readonly newer?: boolean;
};

export type Scene = {
  readonly kind: Kind;
  readonly state: CxState;
  readonly signals: Omit<CxSignals, "lang" | "catching" | "receipt">;
  /** cx away from its desk, beside the answer's last line: from the first thing back until nothing is at work. It reads the message sent at its desk. */
  readonly out: boolean;
  readonly cards: { readonly computer: Card; readonly cx: Card };
  /** Out of reach with the computer last heard on: `cx.js` draws its no-signal glyph on a dark screen only, so the page lays a mark over the lit one. */
  readonly mark: boolean;
  /** The kind what cx says reads: a box never heard, out of reach, speaks as one heard on does, so a break says 「正在重新连接」 however early. */
  readonly speaks: Kind;
};

/**
 * Which of its kinds the corner is in. A box not read yet is `unknown` whatever else is known, so asleep is never drawn for it; a start
 * is a start for as long as the open is asked; what an open came to is read only while the box sleeps. A box going to sleep is asleep
 * already. An account without a computer is drawn as a trial that ended under the floor is, beside the same line by the message box.
 */
export function kindOf(input: Pick<SceneInput, "pending" | "box" | "closing" | "atWork" | "refusal" | "floor" | "unreachable">): Kind {
  if (input.pending) return "balance";
  if (input.box === "waking") return "starting";
  if (input.box === "unknown") return "unknown";
  if (input.box === "awake" && !input.closing) return input.unreachable ? "unreachable" : input.atWork ? "working" : "on";
  if (input.unreachable) return "unreachableAsleep";
  if (input.floor) return "balance";
  const refusal = input.refusal;
  if (refusal === undefined) return "off";
  if (refusal.kind === "refused") return refusal.reason === "balance" ? "balance" : refusal.reason === "global_limit" || refusal.reason === "organisation_limit" || refusal.reason === "egress" ? "refused" : "failed";
  return refusal.status === undefined ? "unreachableAsleep" : refusal.reason === "box_pending" ? "balance" : "failed";
}

/** How long a word of cx's stays: a moment, for as long as its state lasts, or until the person types, clicks or sends. */
export type Stay = "moment" | "state" | "act";

/**
 * What cx says as a kind begins, from the kind before it. A start is said on the line beside cx's desk, not by cx; that it came up is said only after one; a
 * start that did not happen is said until the person acts; out of reach is said once, whichever of its two it moves between. Nothing is
 * said of a kind the corner was already in, so a return to the tab says nothing, nor while cx works or as the computer goes off.
 */
export function begins(was: Kind | undefined, now: Kind): { readonly key: StringKey; readonly stays: Stay } | undefined {
  if (was === now) return undefined;
  switch (now) {
    case "on": return was === "starting" ? { key: "cx.say.ready", stays: "moment" } : undefined;
    case "unreachable": case "unreachableAsleep": return was === "unreachable" || was === "unreachableAsleep" ? undefined : { key: "status.reconnecting", stays: "moment" };
    case "refused": case "failed": case "balance": return { key: `cx.say.${now}`, stays: "act" };
    default: return undefined;
  }
}

const RECONNECTING: Card = { title: { key: "status.reconnecting" }, acts: [] };
const AGAIN: readonly Act[] = ["retry", "help"];

/**
 * The computer's card. On and idle its title says when the computer switches itself off, as the computer last told the page: whole
 * minutes rounded down, the last minute in its own words, and no time where no sleep is due. Under the floor it cannot be switched on,
 * so the card says its state and money stays out of it.
 */
function computerCard(kind: Kind, asking: boolean, left: number | undefined, newer: boolean): Card {
  switch (kind) {
    case "unknown": case "unreachable": case "unreachableAsleep": return RECONNECTING;
    case "off": return { title: { key: "cx.computer.off" }, acts: ["on"] };
    case "balance": return { title: { key: "cx.computer.off" }, acts: [] };
    case "starting": return { title: { key: "cx.computer.starting" }, acts: [] };
    case "working": return { title: { key: "cx.computer.working" }, acts: ["stopOff"] };
    case "refused": return { title: { key: "cx.computer.refused" }, acts: AGAIN };
    case "failed": return { title: { key: "cx.computer.failed" }, acts: AGAIN };
    case "on": {
      const minutes = Math.floor((left ?? 0) / MINUTE_MS);
      // The last minute is the yawn's, its edge included: cx is sleepy from a minute left, and the card says what the yawn says.
      // An hour and more is said as the computer's window says it, in hours and minutes.
      // A computer kept on with a new version waiting says so for as long as it waits; it has no time to switching off.
      const title: Said = newer ? { key: "cx.computer.onNewer" } : left === undefined ? { key: "cx.computer.on" } : left <= MINUTE_MS ? { key: "cx.computer.onSoon" } : minutes === 1 ? { key: "cx.computer.onIn1" }
        : minutes < 60 ? { key: "cx.computer.onIn", values: { n: minutes } } : minutes % 60 === 0 ? { key: "cx.computer.onInHr", values: { h: minutes / 60 } }
        : { key: "cx.computer.onInHrMin", values: { h: Math.floor(minutes / 60), m: minutes % 60 } };
      return { title, acts: asking ? [] : ["off"] };
    }
  }
}

/**
 * cx's card: what cx is doing and what is cx's alone. While cx works it can be stopped; at rest with its computer on, its context can be
 * summarised. Switching the computer on, retrying and help are the computer's, never cx's. Out of reach with the computer last heard on,
 * the page does not know cx is ready, so it says the one thing it knows.
 */
function cxCard(kind: Kind, asking: boolean): Card {
  switch (kind) {
    case "unknown": case "unreachable": return RECONNECTING;
    case "off": case "balance": case "unreachableAsleep": case "refused": case "failed": return { title: { key: "cx.asleep" }, acts: [] };
    case "starting": return { title: { key: "cx.waking" }, acts: [] };
    case "working": return { title: { key: "cx.working" }, acts: ["stop"] };
    case "on": return { title: { key: "cx.ready" }, acts: asking ? [] : ["compact"] };
  }
}

const SLEEPING: ReadonlySet<Kind> = new Set(["off", "refused", "failed", "balance", "unreachableAsleep"]);
const REASONS: Partial<Record<Kind, CxReason>> = { balance: "balance", refused: "seats", failed: "failed", unreachableAsleep: "unreachable" };

/**
 * cx at its computer, from signals the page already has (the design ruled 2026-09-24): the computer is the box — dark asleep, coming on
 * while it opens, lit awake, a glyph for a start that did not happen — and its power light the box's reading; cx types while the person
 * types, reads the message sent, thinks, and yawns in the last minute before the box's own sleep. What is drawn is what was last heard:
 * a box not heard since the page was hidden is drawn as it was, and one the page has never read is a dark screen with cx at rest. A
 * click on either of the two only ever opens its card, in every kind.
 */
/** A restart, as the computer's window says it: the computer 正在重启…, cx waking, as at a start. */
const RESTARTING = { computer: { title: { key: "sw.restarting" }, acts: [] }, cx: { title: { key: "cx.waking" }, acts: [] } } as const satisfies Scene["cards"];
/** A switch-off, as the computer's window says it: the computer 正在关机, cx asleep already. */
const SWITCHING_OFF = { computer: { title: { key: "cx.computer.closing" }, acts: [] }, cx: { title: { key: "cx.asleep" }, acts: [] } } as const satisfies Scene["cards"];

export function scene(input: SceneInput): Scene {
  const kind = kindOf(input);
  if (input.switchingOff === true && input.restarting !== true) return switchingOff(kind, input);
  // Out of reach, the turn is not known to go on: cx is drawn at rest at its desk, whatever it was doing when the platform was last heard.
  const turn = kind === "on" || kind === "working" ? turnOf(input.stream, input.atWork) : "none";
  const state: CxState = kind === "starting" ? "waking" : SLEEPING.has(kind) ? "sleeping"
    : turn === "writing" ? "writing" : turn === "analysing" ? "analysing" : "ready";
  const dot: CxDot = kind === "starting" ? "starting" : SLEEPING.has(kind) ? "asleep"
    : kind === "unknown" || kind === "unreachable" ? "heard" : turn !== "none" ? "working" : "ready";
  const free = kind === "on";
  const left = input.sleepDueAt === undefined ? undefined : input.sleepDueAt - input.now;
  const sleepy = free && !input.typing && left !== undefined && left <= MINUTE_MS;
  const typing = free && input.typing;
  const last = lastSaid(input.stream.items);
  const sent = turn === "reading" && last?.kind === "user" ? last.text.length : 0;
  const text = last?.kind === "assistant" ? last.blocks.reduce((sum, block) => sum + (block.kind === "text" ? block.text.length : 0), 0) : 0;
  return {
    kind, state,
    signals: {
      reason: REASONS[kind], dot, heard: kind === "unknown", low: input.low, sleepy, typing,
      reading: turn === "reading", thinking: turn === "thinking",
      draft: turn === "reading" ? sent : free ? input.draft : 0, text,
    },
    out: turn !== "none" && turn !== "reading",
    cards: input.restarting === true ? RESTARTING : { computer: computerCard(kind, input.asking, left, input.newer === true), cx: cxCard(kind, input.asking) },
    mark: kind === "unreachable",
    speaks: kind === "unknown" && input.unreachable ? "unreachable" : kind,
  };
}

/** cx asleep at a computer that is going dark: its power light the one a start shows, as the window draws it (sheet 1, 正在关机). */
function switchingOff(kind: Kind, input: SceneInput): Scene {
  return {
    kind, state: "sleeping",
    signals: { reason: undefined, dot: "starting", heard: false, low: input.low, sleepy: false, typing: false, reading: false, thinking: false, draft: 0, text: 0 },
    out: false, cards: SWITCHING_OFF, mark: false, speaks: kind,
  };
}
