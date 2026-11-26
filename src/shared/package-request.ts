import { ENTRY_FILE, PERSON, entryTime } from "./board.js";
import { readPendingPick, type PendingPick } from "./card-choices.js";
/** What can be asked of a box's packages: two reads, pi's install, update and remove, and a package switched off and back on. */
export const PACKAGE_OPS = ["list", "readme", "install", "update", "remove", "off", "on"] as const;
export type PackageOp = (typeof PACKAGE_OPS)[number];
export type PackageRequest = { readonly op: "list" } | { readonly op: Exclude<PackageOp, "list">; readonly source: string };

export const MAX_SOURCE_CHARS = 4096;

/** One small process of the box reads two files: a read that has not ended by now is no read. */
export const LISTS_BOUND_MS = 10_000;
/**
 * A list runs at most three children, pi's list and the settings look twice, each such a read: past this the box ends it `timed_out`
 * rather than holding the next read behind it. The platform's wait for a list is derived from it.
 */
export const LIST_OP_BOUND_MS = 3 * LISTS_BOUND_MS;

/**
 * No process takes a NUL in an argument, and pi's list is read by its lines: a source holding a control character names nothing pi can be
 * asked about. Nor does half a surrogate pair, which no `jsonb` holds and which JSON writes as six bytes where the row's bound counts three.
 */
const CONTROL = /[\u0000-\u001f\u007f]/;

/** A string a click can name a package by: what every op but `list` takes, and what a row the platform keeps or the page draws holds. */
export const sendableSource = (source: unknown): source is string =>
  typeof source === "string" && source.trim() !== "" && source.length <= MAX_SOURCE_CHARS && !CONTROL.test(source) && source.isWellFormed();

/** `{op, source}` and nothing else: `list` names no source, every other op names one, which is pi's to read. */
export function readPackageRequest(body: unknown): PackageRequest | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  const record = body as Record<string, unknown>;
  const op = record["op"];
  if (typeof op !== "string" || !(PACKAGE_OPS as readonly string[]).includes(op)) return undefined;
  if (Object.keys(record).some(key => key !== "op" && key !== "source")) return undefined;
  const source = record["source"];
  if (op === "list") return source === undefined ? { op } : undefined;
  if (!sendableSource(source)) return undefined;
  return { op: op as Exclude<PackageOp, "list">, source };
}

/**
 * What a seller did to a box that could not take it at once, waiting in the account's row until the box says how it ended: a change to
 * the box's packages, the model picked, the thinking level chosen, a board entry marked, whether the box stays awake when idle, or the
 * account's keys or sign-ins changed. `id` names one entry among every platform instance and the box.
 */
export type WaitingEntry =
  | { readonly id: string; readonly op: Exclude<PackageOp, "list" | "readme">; readonly source: string }
  /** A model picked: `person` names whose pi takes it, the account's id; a pick written before a box held a session per person names none. */
  | ({ readonly id: string; readonly op: "model"; readonly person?: string } & PendingPick)
  /**
   * The seller marked a board entry read, dismissed it, answered it with 交给 cx, or took the message that answered it back: the box moves
   * the person's file to `done/` with how, and its answer, or back to `todo/` (`parts/cx-board.md`). `modified` is the entry's time as the
   * page read it, so with the file it is the entry's key, the cursor's `<modified>/<name>`: an end names the version it ends, and a new file
   * cx writes at the same path is another entry.
   */
  | ({ readonly id: string; readonly op: "board"; readonly person: string } & BoardMark)
  /**
   * The seller chose pi's thinking level: the box sets it on a running pi and writes it as the tenant's default, as a pick its model.
   * `person` names whose pi takes it, as a pick's does; one written before a box held a session per person names none.
   */
  | { readonly id: string; readonly op: "thinking"; readonly level: ThinkingLevel; readonly person?: string }
  /** An old page's press of 保持开机: the box ends it unchanged and writes nothing, since the switch is the platform's (`parts/settings-files.md` §5). */
  | { readonly id: string; readonly op: "awake"; readonly on: boolean }
  /**
   * The account's keys or sign-ins changed: the box reads what it reaches again, as its open does, once no run is going, and writes the
   * session's models again where that changed. It carries nothing; a later one replaces it in the row.
   */
  | { readonly id: string; readonly op: "reread" };
export type WaitingChange = WaitingEntry extends infer Entry ? Entry extends { readonly id: string } ? Omit<Entry, "id"> : never : never;

/** pi's thinking levels by pi's own names, lowest first: `ThinkingLevel` in `@earendil-works/pi-agent-core`, the scale its clamp walks. */
export const THINKING_LEVELS = Object.freeze(["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const);
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];
export const isThinkingLevel = (value: unknown): value is ThinkingLevel => (THINKING_LEVELS as readonly unknown[]).includes(value);
/** The reason of a thinking level's end when pi did not take it, or the box's image takes no such entry: pi stays at its level. */
export const THINKING_REFUSED = "thinking_refused";

/** What a click on the board does to an entry: done one way, or back to what waits (`undone`), as a message taken back puts it. */
export const BOARD_CLICKS = ["read", "dismissed", "answered", "undone"] as const;
export type BoardClick = (typeof BOARD_CLICKS)[number];
/** The longest answer an entry keeps: what the seller typed, or an option's words; a hand of the row bounds it (`package-request.test.ts`). */
export const BOARD_ANSWER_CHARS = 3000;
/**
 * One click on one entry, named by its key, its file and its time as the page read it: an answer goes with `answered` and with nothing
 * else.
 */
export type BoardMark = { readonly file: string; readonly modified: number; readonly done: BoardClick; readonly answer?: string };

/** A click on the board as the page sends it or the row keeps it, or nothing when it breaks the shape. */
export function readBoardMark(value: Readonly<Record<string, unknown>>): BoardMark | undefined {
  const { file, modified, done, answer } = value;
  if (typeof file !== "string" || !ENTRY_FILE.test(file) || !entryTime(modified) || !BOARD_CLICKS.includes(done as BoardClick)) return undefined;
  if (done !== "answered") return answer === undefined ? { file, modified, done: done as BoardClick } : undefined;
  // No control character but a line's end or a tab, which JSON writes six bytes long: the hop's bound counts three a character.
  return typeof answer === "string" && answer.trim() !== "" && answer.length <= BOARD_ANSWER_CHARS && answer.isWellFormed() && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(answer) ? { file, modified, done, answer } : undefined;
}

/** The reason of a pick's end when pi took the model and the tenant's default was not written: this session is on the model, a new chat is not. */
export const DEFAULT_UNWRITTEN = "default_unwritten";
/**
 * How the box ended an entry: done, with whether anything changed — for a board click that moved a file, the moved file's key as the box
 * read it (`moved`) — or not done, with the box's reason and pi's words where it gave any.
 */
export type EntryEnd = { readonly id: string; readonly ok: true; readonly changed?: boolean; readonly moved?: { readonly modified: number; readonly name: string } } | { readonly id: string; readonly ok: false; readonly reason: string; readonly detail?: string };

/**
 * The row's waiting entries as handed to a box: `wait` asks for the answer once the box has run what it can run now. `withdraw` names
 * entries the seller took back: the box drops each it holds and has not started, and runs none of them if handed it later.
 */
export type EntriesRequest = { readonly op: "entries"; readonly entries: readonly WaitingEntry[]; readonly wait: boolean; readonly withdraw?: readonly string[] };
/**
 * What a box answers a hand: the ends it holds for the entries handed, and which of them it still holds unrun; to a hand that withdraws,
 * which ids it dropped (`withdrawn`), one it is running or has ended being none of them.
 */
export type EntriesAnswer = { readonly ok: true; readonly ended: readonly EntryEnd[]; readonly waiting: readonly string[]; readonly withdrawn?: readonly string[] };

/**
 * A hand is the whole row in one request, so the row's length is what the hop to the box carries: routing admits 1,000,000 bytes with
 * the request's headers counted, and the longest source is 4,096 code units of three bytes each. Sixty-four of those are under 800,000
 * bytes (`package-request.test.ts` holds the sum to the two constants).
 */
export const MAX_WAITING_ENTRIES = 64;
const ENTRY_ID = /^[0-9a-f]{16}$/;
export { entryTime };

/** An entry as stored or handed, or nothing when it breaks the shape. */
export function readWaitingEntry(value: unknown): WaitingEntry | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { id, op, source, provider, modelId, series, person, file, modified, done, answer, level, on } = value as Record<string, unknown>;
  if (typeof id !== "string" || !ENTRY_ID.test(id)) return undefined;
  if (op === "thinking") {
    if (!isThinkingLevel(level) || (person !== undefined && (typeof person !== "string" || !PERSON.test(person)))) return undefined;
    return { id, op, level, ...(person === undefined ? {} : { person }) };
  }
  if (op === "awake") return typeof on === "boolean" ? { id, op, on } : undefined;
  if (op === "reread") return { id, op };
  if (op === "board") {
    const mark = readBoardMark({ file, modified, done, ...(answer === undefined ? {} : { answer }) });
    return typeof person === "string" && PERSON.test(person) && mark !== undefined ? { id, op, person, ...mark } : undefined;
  }
  if (op === "model") {
    const pick = readPendingPick({ provider, ...(modelId === undefined ? {} : { modelId }), ...(series === undefined ? {} : { series }) });
    if (pick === undefined || (person !== undefined && (typeof person !== "string" || !PERSON.test(person)))) return undefined;
    return { id, op, ...(person === undefined ? {} : { person }), ...pick };
  }
  const request = readPackageRequest({ op, source });
  return request === undefined || request.op === "list" || request.op === "readme" ? undefined : { id, op: request.op, source: request.source };
}

/** `{op: "entries", entries, wait?}` and nothing else, every entry readable and no id twice. */
export function readEntriesRequest(body: unknown): EntriesRequest | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  const record = body as Record<string, unknown>;
  if (record["op"] !== "entries" || Object.keys(record).some(key => key !== "op" && key !== "entries" && key !== "wait" && key !== "withdraw")) return undefined;
  const { entries: sent, wait, withdraw } = record;
  if (!Array.isArray(sent) || sent.length > MAX_WAITING_ENTRIES || (wait !== undefined && typeof wait !== "boolean")) return undefined;
  const ids = (value: unknown): value is string[] | undefined => value === undefined || (Array.isArray(value) && value.length <= MAX_WAITING_ENTRIES && value.every((id) => typeof id === "string" && ENTRY_ID.test(id)));
  if (!ids(withdraw)) return undefined;
  const entries = sent.flatMap(value => readWaitingEntry(value) ?? []);
  if (entries.length !== sent.length || new Set(entries.map(entry => entry.id)).size !== entries.length) return undefined;
  return { op: "entries", entries, wait: wait === true, ...(withdraw === undefined ? {} : { withdraw }) };
}

/**
 * A string as `jsonb` takes it: half a surrogate pair becomes U+FFFD and a NUL goes, the two things Postgres refuses in a JSON string,
 * and a cut to `max` never ends in half a pair. What the box says is pi's words and a package's own fields, so it is made storable here
 * rather than refused: the row's statement is one for the whole hand, and one string it could not take would keep every entry of it.
 */
export function storable(value: string, max = Infinity): string {
  const whole = value.toWellFormed().replaceAll("\u0000", "");
  const cut = whole.length > max ? whole.slice(0, max) : whole;
  return /[\ud800-\udbff]$/.test(cut) ? cut.slice(0, -1) : cut;
}

/** A value read from JSON with every string in it, and every key, storable. */
export function storableValue(value: unknown): unknown {
  if (typeof value === "string") return storable(value);
  if (Array.isArray(value)) return value.map(storableValue);
  if (typeof value === "object" && value !== null) return Object.fromEntries(Object.entries(value).map(([key, inner]) => [storable(key), storableValue(inner)]));
  return value;
}

const text = (value: unknown, max: number): string | undefined => {
  const kept = typeof value === "string" ? storable(value, max) : "";
  return kept === "" ? undefined : kept;
};

/** A box's answer to a hand, or nothing when it is not one: an end that cannot be read is left out, and its entry stays waiting. */
export function readEntriesAnswer(body: unknown): EntriesAnswer | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  const { ok, ended, waiting, withdrawn } = body as Record<string, unknown>;
  if (ok !== true || !Array.isArray(ended) || !Array.isArray(waiting)) return undefined;
  const ends = ended.flatMap((value): EntryEnd[] => {
    if (typeof value !== "object" || value === null) return [];
    const end = value as Record<string, unknown>;
    if (typeof end["id"] !== "string" || !ENTRY_ID.test(end["id"])) return [];
    const moved = end["moved"] as Record<string, unknown> | null | undefined;
    const key = typeof moved === "object" && moved !== null && entryTime(moved["modified"]) && typeof moved["name"] === "string" && ENTRY_FILE.test(moved["name"]) ? { modified: moved["modified"], name: moved["name"] } : undefined;
    if (end["ok"] === true) return [{ id: end["id"], ok: true, ...(typeof end["changed"] === "boolean" ? { changed: end["changed"] } : {}), ...(key === undefined ? {} : { moved: key }) }];
    const detail = text(end["detail"], 2_000);
    return end["ok"] === false ? [{ id: end["id"], ok: false, reason: text(end["reason"], 200) ?? "failed", ...(detail === undefined ? {} : { detail }) }] : [];
  });
  const ids = (value: unknown): string[] => (Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && ENTRY_ID.test(id)) : []);
  return {
    ok: true, ended: ends, waiting: waiting.filter((id): id is string => typeof id === "string"),
    ...(Array.isArray(withdrawn) ? { withdrawn: ids(withdrawn) } : {}),
  };
}

/** What the box's packages route takes, as the box reads it: a hand of the row or one request. Every hop to the box admits by this reader. */
export const readPackagesBody = (body: unknown): EntriesRequest | PackageRequest | undefined => readEntriesRequest(body) ?? readPackageRequest(body);

/** A bundle's id: what the platform names its record by, and what a press names it by. */
export const BUNDLE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
/**
 * A bundle's press or its Remove, each one click: the bundle, and the sources it installs, a needed one before what needs it, or removes.
 * Written in one statement, a press whole or not at all, with the account's record of what it brought.
 */
export type BundleClick = { readonly op: "press" | "bundle_remove"; readonly bundle: string; readonly sources: readonly string[] };

/** A press's or a Remove's own part, `{bundle, sources}` and nothing else, no source twice. */
export function readBundleClick(op: BundleClick["op"], value: unknown): BundleClick | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.keys(value).some(key => key !== "bundle" && key !== "sources")) return undefined;
  const { bundle, sources } = value as Record<string, unknown>;
  if (typeof bundle !== "string" || !BUNDLE_ID.test(bundle) || !Array.isArray(sources) || sources.length > MAX_WAITING_ENTRIES) return undefined;
  if (!sources.every(sendableSource) || new Set(sources).size !== sources.length) return undefined;
  return { op, bundle, sources };
}
