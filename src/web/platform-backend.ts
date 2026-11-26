import { CARD_PLACES, PICK_HEADER, RULE_SEEN, readCardChoices, readPendingPick, readPickOutcome, type CardChoices, type PendingPick, type PickOutcome, type Way } from "../shared/card-choices.js";
import type { SurveyAnswers } from "../shared/survey.js";
import { inWayOrder, waysOf } from "../shared/next-ways.js";
import { type Spaces, type Size, type Offered, type Usage, type UsageBar, type UsageSpan, USAGE_SPANS, ComputerPending, FIRST_RELEASE, HELP, IDLE_MINUTES, readCatalogued, readMachine, readModels, Refused, SignInEnded, type SignInPorts, type Words, type HeldBundle, type BundleState, type ConnectionCheck, type FieldsCheck, type GrantAccount, type Account, type Backend, type BoardViewer, type OpenedFrom, type OpenRead, type Balance, type RowThinking, type Carried, type CheckoutAsk, type Coupon, type Invitations, type EarlierPart, type FoundRow, type HistoryRow, type ListPart, type Stretch, type Features, type Left, type Me, type Model, type Models, type OnImage, type Opened, type Parts, type Package, type PackageList, type Awake, type AwakeRow, type Click, type ClickEnd, type Written, type Provider, type Readme, type Source, type SourceMonth, type Spending, type ModelPlugin, type AccountMoney, type ByKind, type LotKind, type MoneyLot, type RecordEntry, type SpanId, type SpanSpending, type Subscription, type SavedCard, type Payment, type Payments, type Terms, type PayForm, type PayWay, SPANS_CALENDAR, SPANS_NOW, type SeriesByVendor, type Returned, type Series, type Version, type ChatOffer, NPM_KINDS, type NpmKind, type NpmOrder, type NpmList, type NpmListed, type NpmPackage, type NpmSection, NotRunning, Unopened, type HeldMessage, type BoardRead, type BoardPageRead, type BoardTabAsk, BoardRefused, type Device, type Organization, type Seats, SEATS_STATES } from "./backend.js";
import { dollars } from "../shared/money.js";
import { makerOf, PROVIDERS } from "../shared/model-makers.js";
import { keyProvidersOf, platformPaysFor } from "../shared/provider-packages.js";
import { cardSeries, plainName, modelName } from "../shared/model-series.js";
import { chatCard, isTicked, pinGone, pinOf, withoutVendor, withPin, withTick, withTicks, type ChatSeries, type TickRefused } from "./chat-card.js";
import type { StreamEvent } from "./stream-model.js";
import { DOOR_KEY, DOOR_PATH, type DoorReason } from "../shared/door.js";
import { OFFICIAL_BUNDLES, type OfficialBundle } from "../shared/bundles.js";
import { readDrawnMark } from "../shared/drawn-mark.js";
import { catalogueWith, sourceWords, type Catalogue } from "./catalogue.js";
import type { CardWords } from "../shared/maker-words.js";
import { isThinkingLevel, readWaitingEntry, sendableSource } from "../shared/package-request.js";
import { BOARD_TAB, readBoardFiles, readBoardLabel, readBoardPart, readFileHead, readOpenedFiles, readPageMaker, type BoardFileRow, type OpenedFile } from "../shared/board.js";
import { base64 } from "./file-uploads.js";
import type { DialogAnswer } from "../shared/dialog.js";
import { readSignInFrame, type SignInEnd } from "../shared/sign-in.js";
import { readShipped } from "../shared/shipped.js";
import { UPLOAD_VERB } from "../shared/upload.js";
import { httpsAddress } from "../shared/https-address.js";

/** The part of the browser's `EventSource` the page uses; a test hands in its own. */
export type EventSourceLike = {
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  onerror: ((event: Event) => void) | null;
  close(): void;
};

export type PlatformPorts = {
  readonly fetch: typeof fetch;
  readonly eventSource: (url: string) => EventSourceLike;
  /** Names this tab to `POST /command`. */
  readonly clientId: string;
  /** Leaves the pages for an address. */
  readonly go: (url: string) => void;
  /** A mark that outlives the round trip a sign-out takes to renew the session: set before it leaves, taken when the pages are back. */
  /** The mark a sign-out leaves across the session's renewal: `everywhere` where it ends every session of the account. */
  readonly leaving: { readonly set: (everywhere?: true) => void; readonly take: () => boolean | "everywhere" };
  /** What the composer held when a 401 found the person signed out and the page went to its door; taken once, when the pages are loaded. */
  readonly renewing: { readonly set: (carried: string) => void; readonly take: () => string | undefined };
  /**
   * The session token, asked of the identity SDK through the page's port before each request: it answers from its cache or fetches a new
   * one, and writes the session cookie the request then carries. One that throws or answers nothing leaves the request as it was.
   */
  readonly token?: () => Promise<unknown> | undefined;
  /** Whether the vendor's SDK still holds a session: after a fresh token, a 401 where it holds none is a sign-out. */
  readonly session?: () => boolean;
  /** The person's photo as the vendor's SDK holds it, setting it, and word of a change, through the page's port; none where it is not there. */
  readonly photo?: () => string | undefined;
  readonly setPhoto?: (file: Blob | null) => Promise<void>;
  readonly watchPhoto?: (changed: () => void) => void;
  /** The accounts the sign-in holds, and the switch between them, asked of the identity SDK through the page's ports. */
  readonly spaces?: () => Promise<Spaces | undefined>;
  readonly use?: (organization: string | null) => Promise<unknown>;
  /** The mark a switch of account leaves for the next load: set before the pages start again, taken when they are back. */
  readonly switching?: { readonly set: () => void; readonly take: () => boolean };
  readonly now?: () => number;
  /** The seller's time zone, which every read that sums or dates is asked in; the browser's own unless a test names one. */
  readonly zone?: () => string;
  /** The platform marked the page it served as asked with a session. */
  readonly signedInHint?: () => boolean;
  /** The handle `/payment.js` puts on the page for the provider's form; the page's own unless a test names one. */
  readonly payment?: () => { readonly open: (secret: string) => Promise<PayForm> } | undefined;
  /** The second site the page at `/` names, where a board's page is drawn; none, no page is drawn. */
  readonly pagesOrigin?: string;
};

/** A checkout is offered where the platform says money can be paid in. */
const PAYING: Features = Object.freeze({ ...FIRST_RELEASE, checkout: true });
/** The events of `GET /stream` the page reads; `end` is read apart, since it closes the connection. */
const FRAMES = ["life", "entry", "entries", "delta", "ui_request", "dialogs", "dialog_ended", "sleep", "turn", "compaction", "charge", "charges", "board"] as const;
/** The platform's own test source; production's gate does not serve it, and a person is never shown it. */
const TEST_SOURCE = "cx-fixture";
/** A provider as the platform lists it; for one the person holds a key at, the models the platform's catalogue lists there. */
type ProviderPresence = { readonly id: string; readonly name: string; readonly own_key: boolean; readonly signed_in: boolean; readonly models: readonly Model[] };
/** `GET /model-providers` as read: the providers a key is held for, and the ones pi signs in to. */
/** How the account reaches a provider it holds: by its key where one is held, since the gate reads a key first, else by its sign-in. */
const heldAs = (one: ProviderPresence): "key" | "account" => (one.own_key ? "key" : "account");
type Presence = { readonly providers: readonly ProviderPresence[]; readonly accounts: readonly Account[] };

/** The `data` of each event of a stream the platform itself writes: one line of JSON an event, a blank line after it, and nothing else but comments. */
async function* eventData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      pending += decoder.decode(value, { stream: true });
      for (let end = pending.indexOf("\n\n"); end !== -1; end = pending.indexOf("\n\n")) {
        const data = pending.slice(0, end).split("\n").find((line) => line.startsWith("data: "));
        pending = pending.slice(end + 2);
        if (data !== undefined) yield data.slice(6);
      }
    }
  } finally { void reader.cancel().catch(() => undefined); }
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
/** A row or line of a list read: a place, a time, and for a row a title or `null`. */
const placed = (value: unknown): value is Record<string, unknown> & { at: string; time: number; title: string | null } =>
  record(value) && typeof value["at"] === "string" && count(value["time"]) && (!("title" in value) || value["title"] === null || typeof value["title"] === "string");
const parse = (text: string): unknown => { try { return JSON.parse(text) as unknown; } catch { return undefined; } };
const word = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);
const offered = (): Promise<never> => Promise.reject(new Error("not offered on this platform"));
/** What a request that left the page never answers: the page is going, and nothing it would say about the request is true. */
const gone = (): Promise<never> => new Promise<never>(() => undefined);

/** The message of a prompt or a steer, as `POST /command` carries it; a 401 to it means the relay never had it. */
function spoken(body: RequestInit["body"]): string | undefined {
  const command = typeof body === "string" ? parse(body) : undefined;
  const inner = record(command) ? command["command"] : undefined;
  return record(inner) && (inner["type"] === "prompt" || inner["type"] === "steer") && typeof inner["message"] === "string" ? inner["message"] : undefined;
}

function readCarried(text: string): Carried {
  const value = parse(text);
  if (!record(value) || typeof value["draft"] !== "string") return { draft: "" };
  return { draft: value["draft"], ...(typeof value["unsent"] === "string" ? { unsent: value["unsent"] } : {}) };
}


/** An answer whose body is not read: dropping it is a courtesy, and a body that errs while it is dropped says nothing about the open. */
const drop = async (answer: Response): Promise<void> => { await answer.body?.cancel().catch(() => undefined); };
/**
 * The vendor asked for its token: a promise to wait on, its rejection caught, or nothing to wait for where no port, no SDK or a throw
 * answers, so the request then goes in the same tick. The call and the reading of what it answered are guarded alike: a failure in
 * either sends the request without waiting.
 */
const asked = (token: (() => Promise<unknown> | undefined) | undefined): Promise<unknown> | undefined => {
  if (token === undefined) return undefined;
  try {
    const answer = token();
    return typeof (answer as { readonly then?: unknown } | undefined)?.then === "function" ? Promise.resolve(answer).catch(() => undefined) : undefined;
  } catch { return undefined; }
};
const refusedZone = async (answer: Response): Promise<boolean> => ((await answer.clone().json().catch(() => undefined)) as { readonly error?: unknown } | undefined)?.error === "time_zone";

/** A `/command` answer's JSON, read whole; one that cannot be read is empty. */
async function answerBody(answer: Response): Promise<Record<string, unknown>> {
  const value = parse(await answer.text().catch(() => ""));
  return record(value) ? value : {};
}

function readBalance(value: unknown): Balance | undefined {
  if (!record(value) || !count(value["available"]) || !count(value["open_floor"]) || typeof value["can_open"] !== "boolean") return undefined;
  return { available: value["available"], open_floor: value["open_floor"], can_open: value["can_open"] };
}

/** A message the platform keeps for the box, as `/me` lists it; one that breaks the shape is left out. */
const readHeld = (value: unknown): HeldMessage | undefined =>
  record(value) && typeof value["id"] === "string" && typeof value["message"] === "string" && typeof value["at"] === "number"
    ? { id: value["id"], message: value["message"], at: value["at"], ...(typeof value["refused"] === "string" ? { refused: value["refused"] } : {}) }
    : undefined;

/**
 * What an open that was not made came to: admission's 409 and its verdict, which the relay passes on as `{ kind: "refused", reason }`,
 * or anything else, which failed past admission or short of it.
 */
/** The box's own refusals for its state, as management and the steward answer them and the platform passes them on. */
const notRunning = (status: number, body: Record<string, unknown>): boolean =>
  (status === 409 && (body["error"] === "box_not_running" || body["error"] === "box_closing")) || (status === 503 && body["error"] === "management_unavailable" && body["at"] === "control_unavailable");

function unopened(status: number, body: Record<string, unknown>): Unopened["opened"] {
  const reason = word(body["reason"]);
  if (status === 409 && body["kind"] === "refused" && reason !== undefined) return { kind: "refused", reason };
  return { kind: "failed", step: "box", status, reason: reason ?? word(body["error"]) ?? word(body["kind"]) };
}

function readMonth(value: unknown): Spending | undefined {
  if (!record(value) || !count(value["credited"]) || !record(value["spent"])) return undefined;
  const { model, sources, box_time: boxTime, box_storage: boxStorage } = value["spent"];
  return count(model) && count(sources) && count(boxTime) && count(boxStorage) ? { credited: value["credited"], spent: { model, sources, boxTime, boxStorage } } : undefined;
}

const day = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const LOT_KINDS: readonly LotKind[] = ["included", "top_up", "reward", "sign_up"];
const lotKind = (value: unknown): value is LotKind => LOT_KINDS.some((kind) => kind === value);
const FREE_WHYS = ["trial_ended", "membership_ended"] as const;
const STEPS: readonly SpanSpending["step"][] = ["minute", "five_minutes", "hour", "day", "month"];
const SPEND_KINDS = ["model", "source", "box_time", "box_storage"] as const;
/** A read of 用量 or 账单 that breaks its shape is no answer: the page says it could not be read, never a figure it made up. */
const unreadable = (path: string): Error => new Error(`${path} unreadable`);

function readMoneyLot(value: unknown): MoneyLot | undefined {
  if (!record(value) || !lotKind(value["kind"]) || !day(value["landed_on"]) || !day(value["ends_on"])) return undefined;
  const { units, remainder, used, days_left: daysLeft } = value;
  const invited = value["invited"];
  return count(units) && count(remainder) && count(used) && count(daysLeft) ? {
    kind: value["kind"], landed_on: value["landed_on"], units, remainder, used, ends_on: value["ends_on"], days_left: daysLeft,
    ...(record(invited) ? { invited: typeof invited["by"] === "string" && invited["by"] !== "" ? { by: invited["by"] } : {} } : {}),
  } : undefined;
}

/** `/account/sessions`, a device refused where its id or a day is missing: a row with no id could not be signed out. */
export function readDevices(value: unknown): readonly Device[] {
  const fail = (): never => { throw unreadable("/account/sessions"); };
  if (!record(value) || !Array.isArray(value["sessions"])) return fail();
  const text = (one: unknown): string | undefined => (typeof one === "string" && one.trim() !== "" ? one : undefined);
  const day = (one: unknown): number => { const at = typeof one === "string" ? Date.parse(one) : NaN; return Number.isFinite(at) ? at : fail(); };
  return value["sessions"].map((one: unknown): Device => {
    if (!record(one) || text(one["id"]) === undefined) return fail();
    const named = Object.fromEntries((["device", "browser", "city", "country"] as const).flatMap((key) => { const got = text(one[key]); return got === undefined ? [] : [[key, got]]; }));
    return { id: text(one["id"])!, signedInAt: day(one["signed_in_at"]), activeAt: day(one["active_at"]), current: one["current"] === true, mobile: one["mobile"] === true, ...named };
  });
}

/** `/account/money`, every field the page draws read as served, and the answer refused where one is not. */
export function readAccountMoney(value: unknown): AccountMoney {
  const fail = unreadable("/account/money");
  if (!record(value) || !["member", "trial", "free"].includes(value["state"] as string)) throw fail;
  const { figure, model_figure: modelFigure, debt, blocks, lots, member, free, warning, renewal, next_period: next } = value;
  if (!count(figure) || !count(modelFigure) || !count(debt) || !record(blocks) || !count(blocks["given"]) || !count(blocks["paid"]) || !Array.isArray(lots)) throw fail;
  if (!record(warning) || !count(warning["below"]) || typeof warning["low"] !== "boolean" || typeof warning["model_low"] !== "boolean") throw fail;
  const withTopUp = record(renewal) ? renewal["with_top_up"] : undefined;
  if (withTopUp !== undefined && !(record(withTopUp) && count(withTopUp["takes"]) && count(withTopUp["short"]))) throw fail;
  // An organisation's renewal is sent without its price where the vendor gave none: the answer's other facts stand.
  if (!record(renewal) || (renewal["price"] !== undefined && !count(renewal["price"])) || !count(renewal["takes"]) || !count(renewal["short"]) || !record(next) || !day(next["last_day"]) || !day(next["renews_on"])) throw fail;
  const read = lots.map(readMoneyLot);
  if (read.some((lot) => lot === undefined)) throw fail;
  if (member !== undefined && (!record(member) || !day(member["last_day"]) || !day(member["renews_on"]))) throw fail;
  const why = record(free) ? FREE_WHYS.find((one) => one === free["why"]) : undefined;
  return {
    state: value["state"] as AccountMoney["state"], figure, model_figure: modelFigure, debt, blocks: { given: blocks["given"], paid: blocks["paid"] }, lots: read as MoneyLot[],
    ...(record(member) ? { member: { last_day: member["last_day"] as string, renews_on: member["renews_on"] as string, ...(typeof member["switch"] === "boolean" ? { switch: member["switch"] } : {}) } } : {}),
    ...(record(free) ? { free: { ...(why === undefined ? {} : { why }), ...(day(free["ended_on"]) ? { ended_on: free["ended_on"] } : {}) } } : {}),
    warning: { below: warning["below"], low: warning["low"], model_low: warning["model_low"] },
    renewal: { ...(count(renewal["price"]) ? { price: renewal["price"] } : {}), takes: renewal["takes"] as number, short: renewal["short"], ...(record(withTopUp) ? { with_top_up: { takes: withTopUp["takes"] as number, short: withTopUp["short"] as number } } : {}) },
    next_period: { last_day: next["last_day"], renews_on: next["renews_on"] },
  };
}


/** `/me`'s seats of an organization: a fact that does not read as one is left out, as the platform leaves out one it could not read. */
export function readSeats(value: unknown): Seats | undefined {
  if (!record(value) || !count(value["least"]) || !count(value["most"])) return undefined;
  const state = SEATS_STATES.find((one) => one === value["state"]);
  const next = value["next_period"];
  return {
    least: value["least"], most: value["most"], ...(count(value["in_use"]) ? { inUse: value["in_use"] } : {}), ...(state === undefined ? {} : { state }),
    ...(count(value["this_period"]) ? { thisPeriod: value["this_period"] } : {}),
    ...(record(next) && count(next["seats"]) && day(next["from"]) ? { nextPeriod: { seats: next["seats"], from: next["from"] } } : {}),
    ...(day(value["on"]) ? { on: value["on"] } : {}),
  };
}
/** The organization `/me` names, where the session has one active. */
const organizationOf = (value: unknown): { readonly organization?: Organization } => {
  if (!record(value) || word(value["id"]) === undefined) return {};
  const role = value["role"] === "admin" || value["role"] === "member" ? value["role"] : undefined;
  const seats = readSeats(value["seats"]);
  return { organization: { id: value["id"] as string, ...(role === undefined ? {} : { role }), ...(word(value["name"]) === undefined ? {} : { name: value["name"] as string }), ...(seats === undefined ? {} : { seats }) } };
};
/** `/billing/subscription`: a status, and for a charge being tried again its next try, whole or not at all. */
export function readSubscription(value: unknown): Subscription {
  const status = record(value) ? (["none", "active", "cancelling", "retrying"] as const).find((one) => one === value["status"]) : undefined;
  if (status === undefined) throw unreadable("/billing/subscription");
  const retry = (value as Record<string, unknown>)["retry"];
  if (retry === undefined) return { status };
  if (!record(retry) || !day(retry["on"]) || !count(retry["amount"]) || !day(retry["first_day"]) || !day(retry["last_day"])) throw unreadable("/billing/subscription");
  return { status, retry: { on: retry["on"], amount: retry["amount"], first_day: retry["first_day"], last_day: retry["last_day"] } };
}
export function readCards(value: unknown): readonly SavedCard[] {
  const cards = record(value) && Array.isArray(value["cards"]) ? value["cards"] as unknown[] : undefined;
  const read = cards?.map((one) => (record(one) && word(one["id"]) !== undefined && typeof one["brand"] === "string" && typeof one["last4"] === "string" && count(one["exp_month"]) && count(one["exp_year"]) && typeof one["default"] === "boolean"
    ? { id: one["id"] as string, brand: one["brand"], last4: one["last4"], exp_month: one["exp_month"], exp_year: one["exp_year"], default: one["default"] } : undefined));
  if (read === undefined || read.some((one) => one === undefined)) throw unreadable("/billing/cards");
  return read as SavedCard[];
}
export function readPayments(value: unknown): Payments {
  const rows = record(value) && Array.isArray(value["payments"]) && typeof value["more"] === "boolean" ? value["payments"] as unknown[] : undefined;
  const read = rows?.map((one): Payment | undefined => (record(one) && day(one["on"]) && (one["kind"] === "membership" || one["kind"] === "top_up" || one["kind"] === "seats") && count(one["amount"]) && count(one["debt_repaid"])
    ? { on: one["on"], kind: one["kind"], amount: one["amount"], debt_repaid: one["debt_repaid"], ...(word(one["way"]) === undefined ? {} : { way: one["way"] as string }), ...(word(one["receipt"]) === undefined ? {} : { receipt: one["receipt"] as string }), ...(word(one["pdf"]) === undefined ? {} : { pdf: one["pdf"] as string }) } : undefined));
  if (read === undefined || read.some((one) => one === undefined)) throw unreadable("/billing/payments");
  const { more, total, next } = value as Record<string, unknown>;
  // A page that says there are more names where they go on from, and counts at least what it holds.
  if (!count(total) || total < read!.length || (more === true) !== (word(next) !== undefined)) throw unreadable("/billing/payments");
  return { payments: read as Payment[], more: more as boolean, total, ...(more === true ? { next: next as string } : {}) };
}
export function readReturned(value: unknown): Returned {
  const state = record(value) ? (["paid", "unpaid"] as const).find((one) => one === value["state"]) : undefined;
  const credited = record(value) ? value["credited"] : undefined;
  if (state === undefined) throw unreadable("/billing/return");
  if (credited === undefined) return { state };
  const kind = record(credited) ? (["membership", "top_up", "seats"] as const).find((one) => one === credited["kind"]) : undefined;
  if (state !== "paid" || !record(credited) || kind === undefined || !count(credited["amount"]) || !count(credited["debt_repaid"]) || credited["debt_repaid"] > credited["amount"]) throw unreadable("/billing/return");
  return { state, credited: { kind, amount: credited["amount"], debt_repaid: credited["debt_repaid"] } };
}
export function readTerms(value: unknown): Terms {
  const fail = unreadable("/terms");
  if (!record(value) || !record(value["trial"])) throw fail;
  const { units_per_dollar: perDollar, price, top_up_from: from, paid_months: months, trial, friends, reward, reward_window_days: window, promotion_last_day: last } = value as Record<string, unknown> & { trial: Record<string, unknown> };
  if (![perDollar, price, from, months, trial["direct"], trial["invited"], trial["days"], friends, reward, window].every(count) || (last !== undefined && !day(last))) throw fail;
  return {
    units_per_dollar: perDollar as number, price: price as number, top_up_from: from as number, paid_months: months as number,
    trial: { direct: trial["direct"] as number, invited: trial["invited"] as number, days: trial["days"] as number },
    friends: friends as number, reward: reward as number, reward_window_days: window as number, ...(last === undefined ? {} : { promotion_last_day: last as string }),
  };
}

export function readInvitations(value: unknown): Invitations {
  const fail = unreadable("/invitations");
  if (!record(value) || !Array.isArray(value["coupons"]) || (value["link"] !== undefined && word(value["link"]) === undefined)) throw fail;
  const days = ["signed_up_on", "reward_by", "rewarded_on", "reward_ends_on"] as const;
  const coupons = value["coupons"].map((one): Coupon => {
    if (!record(one) || !day(one["signed_up_on"]) || !["waiting", "landed", "none"].includes(one["reward"] as string)) throw fail;
    if (days.some((key) => one[key] !== undefined && !day(one[key])) || (one["friend"] !== undefined && word(one["friend"]) === undefined)) throw fail;
    if (one["slot"] !== undefined && !(Number.isSafeInteger(one["slot"]) && (one["slot"] as number) > 0)) throw fail;
    return {
      ...(one["slot"] === undefined ? {} : { slot: one["slot"] as number }),
      signed_up_on: one["signed_up_on"], reward: one["reward"] as Coupon["reward"],
      ...(one["friend"] === undefined ? {} : { friend: one["friend"] as string }),
      ...Object.fromEntries(days.slice(1).filter((key) => one[key] !== undefined).map((key) => [key, one[key]])),
    };
  });
  return { ...(value["link"] === undefined ? {} : { link: value["link"] as string }), coupons };
}

function readByKind(value: unknown): ByKind | undefined {
  if (!record(value)) return undefined;
  const { model, source, box_time: boxTime, box_storage: boxStorage } = value;
  return count(model) && count(source) && count(boxTime) && count(boxStorage) ? { model, source, box_time: boxTime, box_storage: boxStorage } : undefined;
}

/** `/account/spending`, refused whole where a line or a bar breaks its shape: a chart missing a bar would read as a span that spent less. */
/** How a bar names the part of the calendar it holds: under a day, its first instant with the offset it was read at; else its day or its month. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/u;
const STAMPED: Readonly<Record<SpanSpending["step"], RegExp>> = { minute: INSTANT, five_minutes: INSTANT, hour: INSTANT, day: /^\d{4}-\d{2}-\d{2}$/u, month: /^\d{4}-\d{2}$/u };
export function readSpanSpending(value: unknown): SpanSpending {
  const fail = unreadable("/account/spending");
  if (!record(value)) throw fail;
  const span = [...SPANS_NOW, ...SPANS_CALENDAR].find((one) => one === value["span"]);
  const step = STEPS.find((one) => one === value["step"]);
  const kinds = readByKind(value["kinds"]);
  const { first_day: first, last_day: last, from, to, total, lines, other, bars } = value;
  if (span === undefined || step === undefined || kinds === undefined || !day(first) || !day(last) || !count(total) || !Array.isArray(lines) || !Array.isArray(bars)) throw fail;
  const clock = (one: unknown): one is string => typeof one === "string" && /^\d{2}:\d{2}$/.test(one);
  if ((from !== undefined || to !== undefined) && !(clock(from) && clock(to))) throw fail;
  const readLines = lines.map((line: unknown) => (record(line) && SPEND_KINDS.some((kind) => kind === line["kind"]) && count(line["units"]) && (line["name"] === undefined || typeof line["name"] === "string")
    ? { kind: line["kind"] as SpanSpending["lines"][number]["kind"], ...(typeof line["name"] === "string" ? { name: line["name"] } : {}), units: line["units"] } : undefined));
  if (readLines.some((line) => line === undefined)) throw fail;
  if (other !== undefined && (!record(other) || !count(other["from"]) || !count(other["units"]))) throw fail;
  const readBars = bars.map((bar: unknown) => {
    if (!record(bar) || typeof bar["at"] !== "string" || !STAMPED[step].test(bar["at"]) || !count(bar["total"]) || !Array.isArray(bar["lines"])) return undefined;
    const barKinds = readByKind(bar["kinds"]);
    const parts = bar["lines"].map((part: unknown) => (record(part) && count(part["line"]) && Number.isInteger(part["line"]) && part["line"] >= 0 && part["line"] < lines.length && count(part["units"]) ? { line: part["line"], units: part["units"] } : undefined));
    return barKinds === undefined || parts.some((part) => part === undefined) ? undefined : { at: bar["at"], total: bar["total"], kinds: barKinds, lines: parts as { line: number; units: number }[] };
  });
  if (readBars.some((bar) => bar === undefined)) throw fail;
  return {
    span, step, first_day: first, last_day: last, ...(clock(from) && clock(to) ? { from, to } : {}), total, kinds,
    lines: readLines as SpanSpending["lines"], ...(record(other) ? { other: { from: other["from"] as number, units: other["units"] as number } } : {}), bars: readBars as SpanSpending["bars"],
  };
}

/** `/account/record`, an entry that breaks its shape refusing the record: a missing entry would be a lot the seller held and cannot find. */
export function readRecord(value: unknown): readonly RecordEntry[] {
  const fail = unreadable("/account/record");
  if (!record(value) || !Array.isArray(value["entries"])) throw fail;
  return value["entries"].map((entry: unknown): RecordEntry => {
    if (!record(entry) || !lotKind(entry["kind"]) || !day(entry["landed_on"]) || !count(entry["units"]) || !count(entry["debt_repaid"]) || typeof entry["paid_from_balance"] !== "boolean") throw fail;
    const { invited, done } = entry;
    if (done !== undefined && (!record(done) || (done["how"] !== "used_up" && done["how"] !== "ended") || !day(done["on"]) || !count(done["left"]))) throw fail;
    return {
      kind: entry["kind"], landed_on: entry["landed_on"], units: entry["units"], debt_repaid: entry["debt_repaid"], paid_from_balance: entry["paid_from_balance"],
      ...(record(invited) ? { invited: typeof invited["by"] === "string" ? { by: invited["by"] } : {} } : {}),
      ...(record(done) ? { done: { how: done["how"] as "used_up" | "ended", on: done["on"] as string, left: done["left"] as number } } : {}),
    };
  });
}

/** A source's month from `/sources`, only as the platform gave it: a figure that is not one is no month, never a zero. */
function monthOf(value: unknown): { readonly month?: SourceMonth } {
  if (!record(value) || !count(value["since"]) || !count(value["spent"])) return {};
  const lastAt = count(value["last_at"]) ? { lastAt: value["last_at"] } : {};
  const native = typeof value["native_amount"] === "number" && value["native_amount"] >= 0 && typeof value["native_unit"] === "string" && value["native_unit"] !== ""
    ? { native: { amount: value["native_amount"], unit: value["native_unit"] } } : {};
  return { month: { since: value["since"], spent: value["spent"], ...lastAt, ...native } };
}

function readSource(value: unknown, catalogue: Catalogue): Source | undefined {
  if (!record(value) || typeof value["source"] !== "string" || typeof value["supplier"] !== "string" || typeof value["enabled"] !== "boolean" || !record(value["cost"])) return undefined;
  const { native_unit: nativeUnit, conversion, per_aspect: perAspect } = value["cost"];
  if (typeof nativeUnit !== "string" || !record(conversion) || !count(conversion["platform_units"]) || !count(conversion["per_native_units"]) || conversion["per_native_units"] <= 0 || !record(perAspect)) return undefined;
  const name = value["source"];
  const supplier = value["supplier"];
  const words = sourceWords(catalogue, name);
  const plain = { en: supplier, zh: supplier };
  return {
    name, supplier, nativeUnit, enabled: value["enabled"], spent: 0, ...monthOf(value["month"]),
    ...(conversion["platform_units"] === 0 ? {} : { unitsPerNative: conversion["platform_units"] / conversion["per_native_units"] }),
    aspects: conversion["platform_units"] === 0 ? [] : Object.entries(perAspect).flatMap(([aspect, native]) => (count(native) ? [{ aspect, native, ...(words?.aspects[aspect] === undefined ? {} : { words: words.aspects[aspect] }) }] : [])),
    about: words?.about ?? plain, description: words?.description ?? plain,
    ...ownOf(value),
    ...keyOf(value, conversion["platform_units"] !== 0),
  };
}

/**
 * A key the person may pay with in place of the balance: a source with a price on the balance that declares one field of its own, held
 * where the gate's list says that field is saved.
 */
function keyOf(value: Record<string, unknown>, priced: boolean): Pick<Source, "ownKey"> {
  const { fields, connections, checks_fields: checksFields } = value;
  if (!priced || connections !== undefined || checksFields === true || !record(fields)) return {};
  const held = Object.values(fields);
  return held.length === 1 && typeof held[0] === "boolean" ? { ownKey: { held: held[0] } } : {};
}

/**
 * What a connection's last check reached, as `/sources` lists it: each by its id, its name, its country as the gate keeps it, and the
 * region whose host listed it where the gate names one; one without a country or an id is left out.
 */
const accountsOf = (listed: readonly unknown[]): readonly GrantAccount[] => listed.flatMap((one) =>
  record(one) && typeof one["country"] === "string" && /^[A-Z]{2}$/.test(one["country"]) && typeof one["id"] === "string" && one["id"] !== ""
    ? [{ country: one["country"], profile: one["id"], name: typeof one["name"] === "string" ? one["name"] : "", ...(typeof one["region"] === "string" && one["region"] !== "" ? { region: one["region"] } : {}) }] : []);

/** What `/sources` lists a source takes as the person's own: its fields' presence, its stores and the regions one may be saved for. */
/**
 * The fields route's answer, read by its shape: `{ok: true}` alone; a check that did not pass, its reason one of the gate's, its words a
 * string and the gate's own message one where given; a field the gate refused, named by a field's word, with the gate's sentence; a
 * field not saved, with the gate's. Anything else is no answer of the route's.
 */
function readFieldsAnswer(status: number, body: unknown): FieldsCheck | undefined {
  if (!record(body)) return undefined;
  const keys = Object.keys(body).sort().join();
  if (status === 200 && keys === "ok" && body["ok"] === true) return { ok: true };
  if (status === 200 && body["ok"] === false && (keys === "ok,reason,words" || keys === "message,ok,reason,words")) {
    const { reason, words, message } = body;
    if ((reason !== "provider_unavailable" && reason !== "provider_rate_limit") || typeof words !== "string" || (message !== undefined && typeof message !== "string")) return undefined;
    // A check that ended at the gate, a wait past its bound, carries the gate's words where the supplier gave none.
    return { ok: false, words: words !== "" ? words : message ?? "" };
  }
  if (status === 400 && keys === "error,field,message" && body["error"] === "field_refused" && typeof body["field"] === "string" && /^[a-z][a-z0-9_]{0,31}$/.test(body["field"]) && typeof body["message"] === "string") return { ok: false, field: body["field"], words: body["message"] };
  if (status === 409 && keys === "error,message" && body["error"] === "key_required" && typeof body["message"] === "string") return { ok: false, words: "", missing: true };
  return undefined;
}

function ownOf(value: Record<string, unknown>): Pick<Source, "fields" | "connections" | "connectionFields" | "regions" | "checksFields" | "secretFields" | "grants" | "paired" | "pairs"> {
  const { fields, connections, connection_fields: connectionFields, regions, checks_fields: checksFields, secret_fields: secretFields, grants, paired, pairs } = value;
  const shown = (one: unknown): one is Record<string, string> => record(one) && Object.values(one).every((held) => typeof held === "string" && held !== "");
  const named = (one: unknown): one is string => typeof one === "string" && one !== "";
  return {
    ...(record(fields) && Object.values(fields).every((held) => typeof held === "boolean") ? { fields: { ...fields as Record<string, boolean> } } : {}),
    // A store with no region yet, or a source's one grant, is listed with none.
    ...(Array.isArray(connections) ? { connections: connections.flatMap((one) => (record(one) && named(one["store"]) && (one["region"] === undefined || named(one["region"])) ? [{
      store: one["store"], ...(named(one["region"]) ? { region: one["region"] } : {}), ...(Array.isArray(one["reached"]) ? { accounts: accountsOf(one["reached"]) } : {}),
      ...(named(one["pair"]) ? { pair: one["pair"] } : {}), ...(Array.isArray(one["silent"]) ? { silent: one["silent"].filter(named) } : {}), ...(one["refused"] === true ? { refused: true as const } : {}),
    }] : [])) } : {}),
    // The fields a connection is saved with, each with whether it is secret, as the source's manifest declares them.
    ...(Array.isArray(connectionFields) ? { connectionFields: connectionFields.flatMap((one) => (record(one) && named(one["name"]) && typeof one["secret"] === "boolean" ? [{ name: one["name"], secret: one["secret"] }] : [])) } : {}),
    ...(grants === true ? { grants: true as const } : {}),
    // A paired source lists its pairs; a pair whose shown fields do not read is listed with none, so its connections still stand under it.
    ...(paired === true && Array.isArray(pairs) ? { paired: true as const, pairs: pairs.flatMap((one) => (record(one) && named(one["name"]) ? [{ name: one["name"], fields: shown(one["fields"]) ? { ...one["fields"] } : {} }] : [])) } : {}),
    ...(Array.isArray(regions) ? { regions: regions.filter(named) } : {}),
    ...(checksFields === true ? { checksFields: true as const } : {}),
    ...(Array.isArray(secretFields) ? { secretFields: secretFields.filter(named) } : {}),
  };
}

const CLICK_OPS: readonly Click["op"][] = ["install", "remove", "off", "on", "update"];

/** A package of ours as `/plugins/ours` gives it: its page's facts, its README, and its `comchatx` field as the page reads it (`ourRecord`). */
/** Words in both languages, each a string with something in it. */
const bothWords = (value: unknown): Words | undefined => (record(value) && typeof value["en"] === "string" && typeof value["zh"] === "string" && value["en"].trim() !== "" && value["zh"].trim() !== "" ? { en: value["en"], zh: value["zh"] } : undefined);
/** An official bundle as `GET /plugins/bundles` gives one; one missing a field the page draws is left out. */
function readOfficial(value: unknown): OfficialBundle | undefined {
  if (!record(value) || typeof value["id"] !== "string" || typeof value["name"] !== "string" || value["name"].trim() === "" || !Array.isArray(value["members"]) || !value["members"].every((one) => typeof one === "string")) return undefined;
  const about = bothWords(value["about"]);
  const description = bothWords(value["description"]);
  if (about === undefined || description === undefined) return undefined;
  const drawnMark = readDrawnMark(value["mark"]);
  return { id: value["id"], name: value["name"], ...(typeof value["nameZh"] === "string" && value["nameZh"].trim() !== "" ? { nameZh: value["nameZh"] } : {}), ...(drawnMark === undefined ? {} : { mark: drawnMark }), about, description, members: value["members"] as string[] };
}

/** What a package depends on that is a plugin, by npm name, each as the platform sent it. */
const usesOf = (value: unknown): readonly string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : []);

function readOurs(value: unknown): NpmPackage | undefined {
  const listed = readListed(value);
  if (listed === undefined || !record(value) || typeof value["version"] !== "string" || typeof value["readme"] !== "string") return undefined;
  const field = value["comchatx"];
  const repository = value["repository"];
  return {
    ...listed, version: value["version"], ...repositoryAt(repository), readme: value["readme"], readme_cut: value["readme_cut"] === true, ours: true, ...(value["library"] === true ? { library: true as const } : {}),
    ...(record(field) ? { comchatx: field } : {}), shipped: readShipped(value["shipped"]), uses: usesOf(value["uses"]),
  };
}

/** The list as the page holds it. A row or an entry that breaks its shape is left out, never the list; a field the platform left out is left out here. */
/** A package's repository where it is an https address, whatever case its scheme is written in; nothing otherwise. */
const repositoryAt = (value: unknown): { readonly repository?: string } => { const repository = httpsAddress(value); return repository === undefined ? {} : { repository }; };
/** A package of the gallery as the platform answers it; one that does not read so is not drawn. */
function readListed(value: unknown): NpmListed | undefined {
  if (!record(value)) return undefined;
  const { name, description, kinds, author, downloads, updated, repository, homepage } = value;
  if (typeof name !== "string" || typeof description !== "string" || typeof updated !== "string" || !Array.isArray(kinds)) return undefined;
  return {
    name, description, updated, kinds: NPM_KINDS.filter((kind) => kinds.includes(kind)),
    ...(typeof author === "string" ? { author } : {}), ...(count(downloads) && downloads >= 0 ? { downloads } : {}),
    ...repositoryAt(repository),
    ...(typeof homepage === "string" ? { homepage } : {}),
  };
}
/** A click's entry with the row's waiting list its answer gave beside it. */
const written = (click: Click, waiting: readonly Click[] | undefined): Written => (waiting === undefined ? click : { ...click, waiting });
/** The account row's waiting clicks as an answer gives them, a model pick's, a card's, a board's, a thinking level's and a reread's entries left out; none where the answer gave no list. */
const rowOf = (value: unknown): readonly Click[] | undefined => (Array.isArray(value)
  ? value.flatMap((one): Click[] => { const entry = readWaitingEntry(one); return entry === undefined || entry.op === "model" || entry.op === "board" || entry.op === "thinking" || entry.op === "awake" || entry.op === "reread" ? [] : [entry]; }) : undefined);

/** The card choices' answer: the choices, the pick waiting, and what the account's list says of the thinking level. */
type ChoicesRecord = { readonly choices: CardChoices | undefined; readonly pending: PendingPick | undefined; readonly thinking: RowThinking; readonly awake: Awake | undefined; readonly said?: SaidModel };
/** The model and the level the box last answered in use, as the platform keeps them. */
type SaidModel = { readonly provider: string; readonly id: string; readonly name?: string; readonly level?: string };
const readSaidModel = (said: unknown): SaidModel | undefined => !record(said) || typeof said["provider"] !== "string" || typeof said["id"] !== "string" ? undefined : {
  provider: said["provider"], id: said["id"], ...(typeof said["name"] === "string" ? { name: said["name"] } : {}), ...(typeof said["level"] === "string" ? { level: said["level"] } : {}),
};
/** The thinking level's entry and end as the platform says them; a part that does not read is none. */
const readRowThinking = (waiting: unknown, end: unknown): RowThinking => ({
  ...(record(waiting) && waiting["op"] === "thinking" && typeof waiting["id"] === "string" && isThinkingLevel(waiting["level"]) ? { waiting: { id: waiting["id"], level: waiting["level"] } } : {}),
  ...(record(end) && isThinkingLevel(end["level"]) && typeof end["ok"] === "boolean" ? { end: { level: end["level"], ok: end["ok"], ...(typeof end["reason"] === "string" ? { reason: end["reason"] } : {}) } } : {}),
});
/** 保持开机 as a list answer gives it: the computer's last word, the switch still waiting and the last one refused. */
const awakeWaiting = (row: unknown): boolean | undefined => (Array.isArray(row) ? row.flatMap((one) => { const entry = readWaitingEntry(one); return entry?.op === "awake" ? [entry.on] : []; }).at(-1) : undefined);
/** The account's idle minutes as the platform says them: a whole number in the range a seller may type, else none. */
const idleMinutes = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value >= IDLE_MINUTES.least && value <= IDLE_MINUTES.most ? value : undefined;
/** When the running computer was switched on, as `/me` says it. */
const onSinceOf = (value: unknown): { readonly onSince?: number } => {
  const at = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(at) ? { onSince: at } : {};
};
/** The computer's parts as `/me` says them: each figure a whole number in its range, else that figure is none. */
const partsOf = (value: unknown): { readonly parts?: Parts } => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const said = value as Readonly<Record<string, unknown>>;
  const share = (figure: unknown): figure is number => typeof figure === "number" && Number.isInteger(figure) && figure >= 0 && figure <= 100;
  const size = said["storage_gb"];
  const parts: Parts = { ...(share(said["cpu_pct"]) ? { cpu: said["cpu_pct"] } : {}), ...(share(said["ram_pct"]) ? { memory: said["ram_pct"] } : {}),
    ...(typeof size === "number" && Number.isSafeInteger(size) && size > 0 ? { storageGb: size } : {}), ...(share(said["storage_pct"]) ? { storage: said["storage_pct"] } : {}) };
  return Object.keys(parts).length === 0 ? {} : { parts };
};
/** A size as the platform names it, else none. */
const sizeOf = (value: unknown): Size | undefined => {
  if (!record(value)) return undefined;
  const { cpu_kind: kind, cpus, memory_mb: memoryMb } = value;
  return (kind === "shared" || kind === "performance") && Number.isSafeInteger(cpus) && (cpus as number) > 0 && Number.isSafeInteger(memoryMb) && (memoryMb as number) > 0
    ? { kind, cpus: cpus as number, memoryMb: memoryMb as number } : undefined;
};
const unitsOf = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined);
/** The computer's size and the sizes on offer, as `/me` says them. */
const sizesOf = (body: Readonly<Record<string, unknown>>): { readonly size?: Size; readonly sizes?: readonly Offered[] } => {
  const size = sizeOf(body["box_size"]);
  const offered = Array.isArray(body["box_sizes"]) ? body["box_sizes"].flatMap((one): Offered[] => {
    const shape = sizeOf(one), hourUnits = record(one) ? unitsOf(one["hour_units"]) : undefined;
    return shape === undefined || hourUnits === undefined ? [] : [{ ...shape, hourUnits }];
  }) : undefined;
  return { ...(size === undefined ? {} : { size }), ...(offered === undefined ? {} : { sizes: offered }) };
};
const usageShare = (figure: unknown): figure is number => typeof figure === "number" && Number.isFinite(figure) && figure >= 0 && figure <= 100;
/** `/computer/usage` as the page draws it; throws where the answer is not one. */
export function readUsage(body: unknown): Usage {
  if (!record(body) || !(USAGE_SPANS as readonly unknown[]).includes(body["span"]) || !Number.isSafeInteger(body["step_s"]) || !Array.isArray(body["bars"])) throw new Error("/computer/usage answered no usage");
  const bars = body["bars"].map((bar): UsageBar => {
    if (!record(bar) || typeof bar["at"] !== "number" || !Number.isFinite(bar["at"])) throw new Error("/computer/usage answered no usage");
    return { at: bar["at"] * 1000, ...(usageShare(bar["cpu_pct"]) ? { cpu: bar["cpu_pct"] } : {}), ...(usageShare(bar["ram_pct"]) ? { memory: bar["ram_pct"] } : {}), ...(usageShare(bar["storage_pct"]) ? { storage: bar["storage_pct"] } : {}) };
  });
  return { span: body["span"] as UsageSpan, stepS: body["step_s"] as number, bars };
}
function awakeOf(body: Readonly<Record<string, unknown>>): { readonly awake?: Awake } {
  const waiting = awakeWaiting(body["waiting"]);
  const refused = Array.isArray(body["ends"]) && body["ends"].some((one) => record(one) && one["op"] === "awake" && one["ok"] === false);
  const minutes = idleMinutes(body["minutes"]);
  const awake: Awake = { ...(typeof body["awake"] === "boolean" ? { on: body["awake"] } : {}), ...(waiting === undefined ? {} : { waiting }), ...(refused ? { refused: true as const } : {}), ...(minutes === undefined ? {} : { minutes }) };
  return Object.keys(awake).length === 0 ? {} : { awake };
}

/**
 * Why a read of the gallery failed, as the platform says it: npm not answered, the platform's own guard declining to ask npm now
 * (`npm_busy`, which is no failure of npm's), or a name npm does not know.
 */
async function npmRefusal(answer: Response, path: string, named = false): Promise<Error> {
  const body = await answer.json().catch(() => undefined) as unknown;
  const code = record(body) ? body["error"] : undefined;
  // A name the platform refuses as no name npm takes is one npm holds no package by.
  const unknown = (answer.status === 404 && code === "unknown_package") || (named && answer.status === 400 && code === "malformed");
  return new Error(unknown ? "unknown_package" : answer.status === 503 ? (code === "npm_busy" ? "npm_busy" : "npm_unreachable") : `${path} answered ${answer.status}`);
}

function readList(body: Readonly<Record<string, unknown>> & { readonly packages: readonly unknown[] }): PackageList {
  const packages: Package[] = [];
  const onImage: OnImage[] = [];
  for (const row of body.packages) {
    // A source no click can name is not drawn: it stays in the seller's own settings, where cx reads and repairs it.
    if (!record(row) || !sendableSource(row["source"])) continue;
    const source = row["source"];
    const name = typeof row["name"] === "string" ? row["name"] : source;
    const version = typeof row["version"] === "string" ? row["version"] : undefined;
    if (row["origin"] === "seller") {
      const said = typeof row["description"] === "string" ? row["description"] : "";
      // `filtered` is pi's word for a package partly loaded: it is on.
      packages.push({ name, version: version ?? "", source, enabled: row["state"] !== "off", ...(typeof row["author"] === "string" ? { author: row["author"] } : {}), ...(row["missing"] === true ? { missing: true as const } : {}), about: { en: said, zh: said }, description: { en: said, zh: said } });
    } else if (row["origin"] === "image") onImage.push({ name, source, ...(version === undefined ? {} : { version }) });
  }
  const waiting = rowOf(body["waiting"]);
  const ends = Array.isArray(body["ends"]) ? body["ends"].flatMap((value): ClickEnd[] => {
    if (!record(value)) return [];
    const { op, source, ok, at, reason, detail } = value;
    const known = CLICK_OPS.find((one) => one === op);
    return known === undefined || typeof source !== "string" || typeof ok !== "boolean" || typeof at !== "number" ? [] : [{ op: known, source, ok, at, ...(typeof reason === "string" ? { reason } : {}), ...(typeof detail === "string" && detail.trim() !== "" ? { detail } : {}) }];
  }) : undefined;
  return { packages, onImage, asleep: typeof body["answered_at"] === "number", ...(waiting === undefined ? {} : { waiting }), ...(ends === undefined ? {} : { ends }), ...awakeOf(body) };
}

/** A model as the ways that list it reach it: the first of them serves it, and the rest take over in their order. */
type Reached = Model & { readonly ways: readonly Way[] };
/** A series' version as its Models tab draws it: the balance's price where the balance lists it, and every way that lists it, in their order. */
const versionOfModel = (model: Reached): Version => ({ id: model.id, name: model.name, input: model.price?.input ?? 0, output: model.price?.output ?? 0, ways: model.ways });
/**
 * What makes two listings one model: their ids, never their names, since two models can carry one name (Vercel's `openai/gpt-5.2` and
 * `openai/gpt-5.2-pro`). Two ids of one provider are two models, as its registry keys them; across providers an id is read after its
 * maker's `vendor/` word, with case, a dot against a hyphen and a dated snapshot's date set aside (`claude-opus-4-5-20251101`,
 * `anthropic/claude-opus-4.5`), and the one may be the other with its maker's word before the version (`kimi-k3`, `k3`).
 */
const idWord = (id: string): string => id.replace(/^~/, "").split("/").pop()!.toLowerCase().replace(/\./g, "-").replace(/-\d{8}$/, "");
const unprefixed = (word: string): string => word.replace(/^[a-z]+-(?=[a-z]*\d)/, "");
const sameModel = (a: Pick<Model, "provider" | "id">, b: Pick<Model, "provider" | "id">): boolean => {
  if (a.provider === b.provider) return a.id === b.id;
  const [one, other] = [idWord(a.id), idWord(b.id)];
  return one === other || one === unprefixed(other) || unprefixed(one) === other;
};

/**
 * The pages' world on the platform's own origin: `/me`, the person's box through `POST /command`, its stream through `GET /stream`, and
 * the person's data sources. Every request is same-origin, carries the session cookie the browser holds, and is never cached. What the
 * trial has no route for is not offered (`features`), and asking for it anyway is refused here without a request.
 */

/** The reads that sum or date, asked in the seller's zone; a route's trip is the route's, whatever zone it was asked in. */
const ZONED: ReadonlySet<string> = new Set(["/me", "/sources", "/account/money", "/account/spending", "/account/record", "/billing/subscription", "/billing/payments", "/terms", "/invitations"]);
const browserZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

const names = (value: unknown): value is string[] => Array.isArray(value) && value.every((name) => typeof name === "string");
export class PlatformBackend implements Backend {
  /** Whether the platform names billing, as `/me` last said; until it has, nothing is offered. */
  #billing = false;
  get features(): Features { return this.#billing ? PAYING : FIRST_RELEASE; }
  readonly links = Object.freeze({ signIn: DOOR_PATH, help: HELP });
  #renewed: boolean | "everywhere" = false;
  readonly #now: () => number;
  #carried: Carried | undefined;
  #leaving = false;
  #unsent: string | undefined;
  #draft: () => string = () => "";
  /** The models the platform's key serves, as `/me` last named them; pi lists every model it could reach, and that list is not the platform's. */
  #served: readonly (Omit<Model, "name"> & { readonly name?: string })[] | undefined;
  /** The model a session starts on, as `/me` last named it: the card's default row returns to it. */
  #default: { readonly provider: string; readonly id: string } | undefined;
  #presence: Promise<Presence | undefined> | undefined;
  #modelsReading: Promise<Models> | undefined;
  #recordReading: Promise<ChoicesRecord> | undefined;
  #writing: Promise<void> = Promise.resolve();
  /**
   * The one ordering rule for every read of the card's state: a write of the record, a pick, and a pick's outcome said on a command's
   * answer each move this on, and a read that began before it moved is read again, so no answer older than a change the page made is drawn.
   */
  #generation = 0;
  #moved(): void { this.#generation += 1; this.#modelsReading = this.#modelsFresh = this.#recordReading = this.#recordFresh = undefined; }
  async #fresh<T>(read: () => Promise<T>): Promise<T> {
    for (;;) { const at = this.#generation; const value = await read(); if (at === this.#generation) return value; }
  }
  constructor(readonly ports: PlatformPorts) {
    const carried = ports.renewing.take();
    this.#now = ports.now ?? Date.now;
    this.#carried = carried === undefined ? undefined : readCarried(carried);
  }

  /**
   * The vendor's session token lives a minute, and its SDK renews it on a timer a hidden tab may not run; so before each request the page
   * asks the SDK for its token, which answers from its cache or fetches a new one and writes the cookie the request carries (ruled
   * 2026-11-04). A 401 after that is read from the vendor's own state: where it holds no session the person is signed out, and the page
   * goes to its door with what the composer held — and a message whose own command was refused so, since the platform refuses before the
   * relay has it; a message whose answer the page did not wait for is not carried, since it may have arrived. Where the vendor still holds a
   * session, the 401 is that route's refusal, and the read's.
   */
  async #call(path: string, init: RequestInit = {}, renewable = true, carrying?: () => string | undefined): Promise<Response> {
    const send = (to: string): Promise<Response> => this.ports.fetch(to, { ...init, credentials: "same-origin", cache: "no-store", redirect: init.redirect ?? "error" });
    // Each fetch on a route the page may renew asks the vendor first, the UTC fallback's too, and waits only on a promise: with no vendor
    // standing at the call, the request goes in the same tick, as it always did; a call that throws, rejects or answers nothing leaves the
    // request as it was.
    const token = renewable ? this.ports.token : undefined;
    const ask = (to: string): Promise<Response> => { const waiting = asked(token); return waiting === undefined ? send(to) : waiting.then(() => send(to)); };
    const zone = ZONED.has(path.split("?")[0]!) ? (this.ports.zone ?? browserZone)() : undefined;
    const zoned = (name: string): string => `${path}${path.includes("?") ? "&" : "?"}tz=${encodeURIComponent(name)}`;
    let answer = await ask(zone === undefined ? path : zoned(zone));
    // A zone the platform's runtime cannot read is asked once more in UTC, the charter's fixed zone for times, and that answer is the read's.
    if (zone !== undefined && zone !== "UTC" && answer.status === 400 && await refusedZone(answer)) { await drop(answer); answer = await ask(zoned("UTC")); this.#inUtc.add(answer); }
    if (!renewable || answer.status !== 401 || this.ports.session === undefined || this.ports.session()) return answer;
    await drop(answer);
    // A message waiting on an open the platform refused so is carried as one whose own command was refused: neither reached the relay.
    const unsent = path === "/command" ? spoken(init.body) ?? carrying?.() : undefined;
    if (this.#leaving && unsent === undefined) return gone();
    this.#unsent = unsent ?? this.#unsent;
    this.ports.renewing.set(JSON.stringify({ draft: this.#draft(), ...(this.#unsent === undefined ? {} : { unsent: this.#unsent }) }));
    if (!this.#leaving) { this.#leaving = true; this.ports.go(this.links.signIn); }
    return gone();
  }
  async #post(body: Readonly<Record<string, unknown>>, carrying?: () => string | undefined, signal?: AbortSignal): Promise<Response> {
    const answer = await this.#call("/command", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id: this.ports.clientId, ...body }), ...(signal === undefined ? {} : { signal }) }, true, carrying);
    // The platform says on the answer to a command that runs the model what became of a pick no answer said before it.
    const outcome = readPickOutcome(answer.headers.get(PICK_HEADER));
    if (outcome !== undefined) { this.#moved(); this.#pickOutcome?.(outcome); }
    return answer;
  }
  #pickOutcome: ((outcome: PickOutcome) => void) | undefined;
  onPickOutcome(listener: (outcome: PickOutcome) => void): void { this.#pickOutcome = listener; }
  /** A pi command and pi's own answer to it. */
  async #ask(command: Readonly<Record<string, unknown>>, hold?: string): Promise<unknown> {
    const answer = await this.#post({ command, ...(hold === undefined ? {} : { hold_id: hold }) });
    if (!answer.ok) {
      const body = await answerBody(answer);
      if (body["unopened"] === true) throw new Unopened(unopened(answer.status, body));
      // Read so on an upload alone, which waits for the box and goes again: every other command keeps its answer as it was.
      if (command["type"] === UPLOAD_VERB && notRunning(answer.status, body)) throw new NotRunning();
      throw new Error(`command answered ${answer.status}`);
    }
    const body = await answer.json() as unknown;
    if (record(body) && body["success"] === false) throw new Refused(typeof body["error"] === "string" && body["error"].trim() !== "" ? body["error"] : undefined);
    return body;
  }

  async me(): Promise<Me> {
    this.#presence = undefined;
    const answer = await this.#call("/me");
    if (answer.status === 401) { await drop(answer); return { kind: "signed_out" }; }
    // An account whose deletion was asked for is served nothing more; its session is ended, and the page goes to the door as any sign-out's.
    if (answer.status === 410) { await drop(answer); await this.leave().catch(() => undefined); return { kind: "signed_out" }; }
    if (!answer.ok) { await drop(answer); throw new Error(`/me answered ${answer.status}`); }
    const body = await answer.json() as unknown;
    if (!record(body) || !record(body["box"]) || !count(body["units_per_dollar"]) || body["units_per_dollar"] <= 0) throw new Error("/me unreadable");
    const state = body["box"]["state"];
    const served = body["served_models"];
    // A price is drawn only as the seller pays it: with the margin the platform names, and none where it names none.
    const margin = count(body["margin_percent"]) && body["margin_percent"] >= 0 ? body["margin_percent"] : undefined;
    const perMillion = (model: Record<string, unknown>): Model["price"] | undefined => {
      const price = model["price"];
      if (margin === undefined || !record(price) || !count(price["input"]) || !count(price["output"])) return undefined;
      const paid = (dollarsPerMillion: number): number => Math.ceil(Number((dollarsPerMillion * (body["units_per_dollar"] as number) * (100 + margin) / 100).toFixed(6)));
      return { input: paid(price["input"]), output: paid(price["output"]) };
    };
    this.#served = Array.isArray(served) ? served.flatMap((model) => {
      if (!record(model) || typeof model["provider"] !== "string" || typeof model["id"] !== "string") return [];
      const price = perMillion(model);
      return [{ provider: model["provider"], id: model["id"], ...(typeof model["name"] === "string" ? { name: model["name"] } : {}), ...readCatalogued(model), ...(price === undefined ? {} : { price }) }];
    }) : undefined;
    const named = body["default_model"];
    this.#default = record(named) && typeof named["provider"] === "string" && typeof named["id"] === "string" ? { provider: named["provider"], id: named["id"] } : undefined;
    const account = record(body["account"]) ? body["account"] : {};
    this.#billing = body["billing"] === true;
    return {
      kind: "signed_in", account: word(account["id"]) ?? "", email: word(account["email"]), name: word(account["name"]), ...(typeof account["terms"] === "boolean" ? { terms: account["terms"] } : {}),
      box: state === "provisioned" ? "provisioned" : "pending", machine: readMachine(body["box"]["machine"]), ...(body["box"]["newer"] === true ? { newer: true } : {}), ...onSinceOf(body["box"]["on_since"]), ...partsOf(body["box"]["parts"]),
      ...(typeof body["box_hour_units"] === "number" && Number.isFinite(body["box_hour_units"]) && body["box_hour_units"] >= 0 ? { hourUnits: body["box_hour_units"] } : {}), balance: readBalance(body["balance"]),
      money: dollars(body["units_per_dollar"]), spending: readMonth(body["month"]), ...sizesOf(body),
      ...(Array.isArray(body["held_messages"]) ? { held: body["held_messages"].flatMap((one) => readHeld(one) ?? []) } : {}),
      ...organizationOf(body["organization"]),
    };
  }

  /**
   * Admission refuses with 409 and its verdict, which the relay passes on as `{ kind: "refused", reason }`; anything else that is not an
   * open — the platform's own answer before the box, the routing step's, a 5xx, or no answer at all — failed past admission or short of it.
   */
  async open(carrying?: () => string | undefined): Promise<Opened> {
    const zone = (this.ports.zone ?? browserZone)();
    let box = await this.#post({ box: "open", tz: zone }, carrying).catch(() => undefined);
    // The box's clock follows the seller's zone; one the platform cannot read opens the box in UTC, as a read that dates is asked again.
    if (box !== undefined && zone !== "UTC" && box.status === 400 && await refusedZone(box)) { await drop(box); box = await this.#post({ box: "open", tz: "UTC" }, carrying).catch(() => undefined); }
    if (box === undefined) return { kind: "failed", step: "box", status: undefined, reason: undefined };
    if (!box.ok) return unopened(box.status, await answerBody(box));
    const dropped = word((await answerBody(box))["default_dropped"]);
    const open: Opened = dropped === undefined ? { kind: "open" } : { kind: "open", dropped };
    const session = await this.#post({ session: "open" }, carrying).catch(() => undefined);
    if (session === undefined) return { kind: "failed", step: "session", status: undefined, reason: undefined };
    if (session.ok) { await drop(session); return open; }
    const body = await answerBody(session);
    const error = word(body["error"]);
    // A second open of a session that is open is refused by the box as an error; for the page it is the session it wanted. One still
    // being opened is not open yet.
    if (session.status === 500 && error !== undefined && /already opening$/.test(error)) return { kind: "opening" };
    if (session.status === 500 && error !== undefined && /already open$/.test(error)) return open;
    return { kind: "failed", step: "session", status: session.status, reason: error };
  }

  async takeBack(id: string): Promise<"back" | "taken"> {
    const answer = await this.#post({ take_back: id });
    const body = answer.ok ? (await drop(answer), {}) : await answerBody(answer);
    if (answer.ok) return "back";
    if (answer.status === 409 && body["error"] === "taken") return "taken";
    throw new Error(`take-back answered ${answer.status}`);
  }

  async cancelClick(id: string): Promise<"cancelled" | "started" | "gone"> {
    const answer = await this.#post({ cancel: { entry: id } });
    const body = answer.ok ? (await drop(answer), {}) : await answerBody(answer);
    if (answer.ok) return "cancelled";
    if (answer.status === 409 && (body["error"] === "started" || body["error"] === "gone")) return body["error"];
    throw new Error(`cancel answered ${answer.status}`);
  }

  async forgetFailure(source: string): Promise<void> {
    const answer = await this.#post({ cancel: { failed: source } });
    const body = answer.ok ? (await drop(answer), {}) : await answerBody(answer);
    // One no longer kept is gone already, which is what was asked.
    if (!answer.ok && !(answer.status === 409 && body["error"] === "gone")) throw new Error(`cancel answered ${answer.status}`);
  }

  async restart(): Promise<"restarted" | "busy"> {
    const answer = await this.#post({ box: "restart", tz: (this.ports.zone ?? browserZone)() });
    const body = answer.ok ? (await drop(answer), {}) : await answerBody(answer);
    if (answer.status === 409 && body["error"] === "busy") return "busy";
    if (!answer.ok) throw new Error(`restart answered ${answer.status}`);
    return "restarted";
  }

  async close(): Promise<"closed" | "busy"> {
    const answer = await this.#post({ box: "close" });
    const body = answer.ok ? (await drop(answer), {}) : await answerBody(answer);
    if (answer.status === 409 && body["error"] === "busy") return "busy";
    if (!answer.ok) throw new Error(`close answered ${answer.status}`);
    return "closed";
  }

  /** A connection of its own every time: the browser's own reconnect would send the last entry's id and never `<epoch>:0`, which only the page knows. */
  stream(since: string | undefined, listener: (event: StreamEvent) => void, broken: () => void): () => void {
    const source = this.ports.eventSource(since === undefined ? "/stream" : `/stream?since=${encodeURIComponent(since)}`);
    let over = false;
    const close = (): void => { over = true; source.close(); };
    for (const name of FRAMES) {
      source.addEventListener(name, (event) => {
        if (over) return;
        // A new life's pi is another pi: a models read shared from before it answers for the last one, so the next caller asks anew.
        if (name === "life") this.#modelsReading = this.#modelsFresh = undefined;
        // The browser keeps the last id it was sent for every later event; only an entry's own id, or a batch's, is a place to resume from.
        listener({ event: name, data: parse(event.data), ...((name === "entry" || name === "entries") && event.lastEventId !== "" ? { id: event.lastEventId } : {}) });
      });
    }
    source.addEventListener("end", (event) => { if (over) return; close(); listener({ event: "end", data: parse(event.data) }); });
    source.onerror = () => { if (over) return; close(); broken(); };
    return close;
  }

  command(command: Readonly<Record<string, unknown>>, hold?: string): Promise<unknown> {
    return this.#ask(command, hold);
  }

  /**
   * The box is the one source of the model in use and of the models pi offers. When it does not answer it names no model in use, and
   * what can be chosen is what the platform itself knows: the models it serves, and at each vendor the person holds a key for, the models
   * its catalogue lists there — read afresh, so a key removed takes its models with it. The page keeps no offer of its own.
   * Only pi's currently available models are offered: new providers enter pi's catalog on the next session open. The served models stay
   * on the platform's key; every other offered model needs a held provider key. The page never moves a session's model behind the person:
   * a model that can no longer be served stays the current one, drawn as it is, and the call on it is refused with its reason.
   */
  models(): Promise<Models> {
    if (this.#modelsFresh !== undefined) return this.#modelsFresh;
    const fresh: Promise<Models> = this.#fresh(() => this.#modelsOnce()).finally(() => { if (this.#modelsFresh === fresh) this.#modelsFresh = undefined; });
    return this.#modelsFresh = fresh;
  }
  #modelsFresh: Promise<Models> | undefined;
  #modelsOnce(): Promise<Models> {
    if (this.#modelsReading !== undefined) return this.#modelsReading;
    const reading: Promise<Models> = this.#readModels().finally(() => { if (this.#modelsReading === reading) this.#modelsReading = undefined; });
    return this.#modelsReading = reading;
  }

  async platformModels(): Promise<readonly { readonly provider: string; readonly id: string }[]> {
    if (this.#served === undefined && (await this.me()).kind === "signed_out") throw new Error("/me answered 401");
    if (this.#served === undefined) throw new Error("/me named no served models");
    return this.#served.map(({ provider, id }) => ({ provider, id }));
  }

  async #readModels(): Promise<Models> {
    const [models, providers] = await Promise.all([
      Promise.all([this.#ask({ type: "get_state" }), this.#ask({ type: "get_available_models" })]).then(async ([state, available]) => readModels({
        get_state: state, get_available_models: available,
        // The levels come in the same answer, asked of the pi that named a level, so the level and its choices are one read's.
        ...(typeof (state as { readonly data?: { readonly thinkingLevel?: unknown } } | undefined)?.data?.thinkingLevel === "string" ? { get_available_thinking_levels: await this.#ask({ type: "get_available_thinking_levels" }).catch(() => undefined) } : {}),
      }), () => undefined),
      this.#providerPresence(),
    ]);
    const served = this.#served ?? [];
    const fallback = this.#default === undefined ? {} : { default: this.#default };
    if (models === undefined) {
      const platformOwn = served.map((one) => ({ ...one, name: one.name ?? one.id }));
      const brought = (providers ?? []).filter((one) => one.own_key || one.signed_in).flatMap((one) => one.models.map((model) => ({ ...model, via: one.name, own: heldAs(one) })));
      const available = [...brought.filter((model) => !platformOwn.some((one) => one.provider === model.provider && one.id === model.id)), ...platformOwn];
      // What the box last answered in use, kept by the platform, names the model and the level while it does not answer.
      const said = (await this.#record().catch(() => undefined))?.said;
      const levels = said === undefined ? undefined : available.find((one) => one.provider === said.provider && one.id === said.id)?.thinkingLevels;
      return {
        current: said === undefined ? undefined : { provider: said.provider, id: said.id, ...(said.name === undefined ? {} : { name: said.name }) }, available, ...fallback,
        ...(said?.level === undefined || levels === undefined ? {} : { thinkingLevel: said.level, thinkingLevels: levels }),
      };
    }
    // A served model is named and priced as `/me` names it, whether pi listed it or not: one name, the box awake or asleep.
    const platform = served.map((one) => { const listed = models.available.find((model) => one.provider === model.provider && one.id === model.id); return { ...listed, ...one, name: one.name ?? listed?.name ?? one.id }; });
    const thinking = { ...(models.thinkingLevel === undefined ? {} : { thinkingLevel: models.thinkingLevel }), ...(models.thinkingLevels === undefined ? {} : { thinkingLevels: models.thinkingLevels }) };
    if (providers === undefined) return { current: models.current, available: platform, ...fallback, ...thinking };
    const availableModels = models.available.flatMap((model) => {
      const serving = served.find((one) => one.provider === model.provider && one.id === model.id);
      if (serving !== undefined) return [{ ...model, ...serving, name: serving.name ?? model.name }];
      const own = providers.find((one) => one.id === model.provider && (one.own_key || one.signed_in));
      return own === undefined ? [] : [{ ...model, via: own.name, own: heldAs(own) }];
    });
    const available = [...availableModels, ...platform.filter((one) => !availableModels.some((model) => model.provider === one.provider && model.id === one.id))];
    return { current: models.current, available, ...fallback, ...thinking };
  }

  #held(): Promise<Presence | undefined> {
    return this.#presence ??= this.#readPresence().catch(() => undefined);
  }

  async #providerPresence(): Promise<readonly ProviderPresence[] | undefined> {
    return (await this.#held())?.providers;
  }

  async #readPresence(): Promise<Presence> {
    const answer = await this.#call("/model-providers");
    if (!answer.ok) { await answer.body?.cancel(); throw new Error(`providers answered ${answer.status}`); }
    const body = await answer.json() as unknown;
    if (!record(body) || !Array.isArray(body["providers"])) throw new Error("providers unreadable");
    const providers = body["providers"].map((value) => {
      if (!record(value) || typeof value["id"] !== "string" || typeof value["name"] !== "string" || typeof value["own_key"] !== "boolean") throw new Error("providers unreadable");
      const id = value["id"];
      const listed = Array.isArray(value["models"]) ? value["models"] : [];
      const models = listed.flatMap((model: unknown) => (record(model) && typeof model["id"] === "string" && typeof model["name"] === "string" ? [{ provider: id, id: model["id"], name: model["name"], ...readCatalogued(model) }] : []));
      return { id, name: value["name"], own_key: value["own_key"], signed_in: value["signed_in"] === true, models };
    });
    // A platform that runs no sign-in lists none, and the page offers none.
    const accounts = (Array.isArray(body["accounts"]) ? body["accounts"] : []).flatMap((value: unknown): Account[] => {
      if (!record(value) || typeof value["id"] !== "string" || typeof value["name"] !== "string") return [];
      const ended = value["state"] === "signed_out" && typeof value["words"] === "string" ? value["words"] : undefined;
      return [{ id: value["id"], name: value["name"], signedIn: value["state"] === "signed_in", models: [], ...(ended === undefined ? {} : { ended }) }];
    });
    return { providers, accounts };
  }

  async providers(): Promise<readonly Provider[]> {
    const providers = await this.#providerPresence();
    if (providers === undefined) throw new Error("providers unavailable");
    return providers.map(({ id, name, own_key }) => ({ id, name, platformKey: this.#served?.some((model) => model.provider === id) ?? false, ownKey: own_key, models: [], rates: [] }));
  }

  async #ownKey(provider: string, method: "PUT" | "DELETE", value?: string): Promise<void> {
    const answer = await this.#call(`/model-providers/${encodeURIComponent(provider)}/credential`, {
      method, headers: { "content-type": "application/json" }, ...(method === "PUT" ? { body: JSON.stringify({ value }) } : {}),
    }).finally(() => { this.#presence = undefined; });
    if (answer.status === 400) {
      const body = await answer.json().catch(() => undefined) as unknown;
      const code = record(body) ? body["error"] : undefined;
      throw new Error(code === "invalid_api_key" || code === "unknown_provider" || code === "malformed" ? code : "key_change_failed");
    }
    await answer.body?.cancel();
    if (!answer.ok) throw new Error(`key change answered ${answer.status}`);
  }

  saveOwnKey(provider: string, key: string): Promise<void> { return this.#ownKey(provider, "PUT", key); }
  removeOwnKey(provider: string): Promise<void> { return this.#ownKey(provider, "DELETE"); }

  async history(epoch: string, before: number): Promise<EarlierPart> {
    const answer = await this.#call(`/history?before=${encodeURIComponent(`${epoch}:${before}`)}`);
    if (!answer.ok) { await drop(answer); throw new Error(`/history answered ${answer.status}`); }
    const body = await answer.json() as unknown;
    if (!record(body) || body["epoch"] !== epoch || !Array.isArray(body["entries"]) || !count(body["from"]) || typeof body["earlier"] !== "boolean") throw new Error("/history unreadable");
    return { epoch, entries: body["entries"], from: body["from"], earlier: body["earlier"], ...(Array.isArray(body["charges"]) ? { charges: body["charges"] } : {}) };
  }

  async historyAt(place: string): Promise<Stretch> {
    const answer = await this.#call(`/history?at=${encodeURIComponent(place)}`);
    if (!answer.ok) { await drop(answer); throw new Error(`/history answered ${answer.status}`); }
    const body = await answer.json() as unknown;
    if (!record(body) || body["epoch"] !== place.slice(0, place.lastIndexOf(":")) || !Array.isArray(body["entries"]) || !count(body["from"]) || typeof body["earlier"] !== "boolean" || typeof body["later"] !== "boolean") throw new Error("/history unreadable");
    return { epoch: body["epoch"], entries: body["entries"], from: body["from"], earlier: body["earlier"], later: body["later"], ...(Array.isArray(body["charges"]) ? { charges: body["charges"] } : {}) };
  }

  async #list<T>(path: string, params: Readonly<Record<string, string | undefined>>, row: (value: unknown) => T | undefined): Promise<ListPart<T>> {
    const query = new URLSearchParams(Object.entries(params).filter((pair): pair is [string, string] => pair[1] !== undefined));
    const answer = await this.#call(`${path}${query.size > 0 ? `?${query}` : ""}`);
    if (!answer.ok) { await drop(answer); throw new Error(`${path} answered ${answer.status}`); }
    const body = await answer.json() as unknown;
    if (!record(body) || typeof body["epoch"] !== "string" || !Array.isArray(body["items"]) || (body["next"] !== undefined && typeof body["next"] !== "string")) throw new Error(`${path} unreadable`);
    const items = body["items"].map(row);
    if (items.some((item) => item === undefined)) throw new Error(`${path} unreadable`);
    return { epoch: body["epoch"], items: items as T[], ...(typeof body["next"] === "string" ? { next: body["next"] } : {}), ...(body["titled"] === false ? { titled: false as const } : {}) };
  }

  topics(epoch: string, before?: string): Promise<ListPart<HistoryRow>> {
    return this.#list("/topics", before === undefined ? { epoch } : { before }, (value) => {
      if (!placed(value) || typeof value["id"] !== "string" || !Array.isArray(value["messages"])) return undefined;
      const messages = value["messages"].filter((line): line is Record<string, unknown> & { at: string; time: number; line: string } => placed(line) && typeof line["line"] === "string");
      return messages.length === value["messages"].length ? { at: value["at"], id: value["id"], time: value["time"], title: value["title"], messages: messages.map(({ at, time, line }) => ({ at, time, line })) } : undefined;
    });
  }

  async board(before?: string, tab?: string): Promise<BoardRead> {
    const answer = await this.#call(`/board?${new URLSearchParams({ ...(tab === undefined ? {} : { tab }), ...(before === undefined ? {} : { before }) })}`);
    if (!answer.ok) { await drop(answer); throw new Error(`/board answered ${answer.status}`); }
    const body = await answer.json() as unknown;
    const part = record(body) && body["shown"] === true ? readBoardPart(body) : undefined;
    if (!record(body) || typeof body["shown"] !== "boolean" || (body["shown"] && part === undefined)) throw unreadable("/board");
    const tabOf = typeof body["tab"] === "string" && BOARD_TAB.test(body["tab"]) ? body["tab"] : undefined;
    const pages = Array.isArray(body["pages"]) ? body["pages"].flatMap((one) => { const by = record(one) && typeof one["tab"] === "string" && BOARD_TAB.test(one["tab"]) ? readPageMaker(one["by"]) : undefined; const name = by === undefined ? undefined : readBoardLabel((one as Record<string, unknown>)["name"]); return by === undefined ? [] : [{ tab: (one as Record<string, unknown>)["tab"] as string, by, ...(name === undefined ? {} : { name }) }]; }) : undefined;
    return { shown: body["shown"], ...(tabOf === undefined ? {} : { tab: tabOf }), ...(part?.tabs === undefined ? {} : { tabs: part.tabs }), ...(pages === undefined ? {} : { pages }), entries: part?.entries ?? [], ...(part?.next === undefined ? {} : { next: part.next }), ...(typeof body["kept_at"] === "number" ? { keptAt: body["kept_at"] } : {}) };
  }

  get pagesOrigin(): string | undefined { return this.ports.pagesOrigin; }

  async boardPage(tab: string): Promise<BoardPageRead> {
    const answer = await this.#call(`/board/page?${new URLSearchParams({ tab })}`);
    if (!answer.ok) { await drop(answer); throw new Error(`/board/page answered ${answer.status}`); }
    // The page's head line, then the page as written (`parts/cx-board.md` §3); an answer cut short breaks the read, and the page did not load.
    const text = await answer.text();
    const at = text.indexOf("\n");
    let head: unknown;
    try { head = at === -1 ? undefined : JSON.parse(text.slice(0, at)); } catch { head = undefined; }
    const by = record(head) ? readPageMaker(head["by"]) : undefined;
    const kit = record(head) ? head["kit"] : undefined;
    if (by === undefined || (kit !== undefined && (!record(kit) || typeof kit["css"] !== "string" || typeof kit["js"] !== "string"))) throw unreadable("/board/page");
    return { html: text.slice(at + 1), by, ...(kit === undefined ? {} : { kit: { css: kit["css"] as string, js: kit["js"] as string } }) };
  }

  async boardOpen(path: string, from: OpenedFrom, bytes: boolean): Promise<OpenRead> {
    const answer = await this.#call(`/board/open?${new URLSearchParams({ path, from, ...(bytes ? { as: "bytes" } : {}) })}`);
    if (answer.ok) {
      // The file's head line, then the file as written (`parts/cx-board.md` §3); an answer cut short breaks the read, and the file did not read.
      const all = await answer.arrayBuffer().then((one) => new Uint8Array(one), () => undefined);
      const at = all?.indexOf(0x0a) ?? -1;
      let parsed: unknown;
      try { parsed = all === undefined || at === -1 ? undefined : JSON.parse(new TextDecoder().decode(all.subarray(0, at))); } catch { parsed = undefined; }
      const head = readFileHead(parsed);
      if (all === undefined || head === undefined) return { kind: "unreadable" };
      const rest = all.subarray(at + 1);
      return { kind: "file", ...head, ...(bytes ? { bytes: await base64(new Blob([rest])) } : { text: new TextDecoder().decode(rest) }) };
    }
    const body = await answer.json().catch(() => undefined) as unknown;
    const facts = record(body) && Number.isSafeInteger(body["size"]) && typeof body["modified"] === "number" ? { size: body["size"] as number, modified: body["modified"] } : undefined;
    const error = record(body) ? body["error"] : undefined;
    // Only a box on an image older than the read's stream refuses a file for its size.
    if (answer.status === 413 && facts !== undefined) return { kind: "large", ...facts };
    if (answer.status === 404 && error === "no_file") return { kind: "gone" };
    if (answer.status === 503 && error === "box_not_running") return { kind: "off" };
    return { kind: "unreadable" };
  }


  async boardViewer(kind: string): Promise<BoardViewer | undefined> {
    const answer = await this.#call(`/board/viewer?${new URLSearchParams({ kind })}`);
    const body = await answer.json().catch(() => undefined) as unknown;
    if (answer.status === 404 && record(body) && body["error"] === "no_viewer") return undefined;
    // The viewer lives on cx's computer too: one that is off is said as the file's own read says it.
    if (answer.status === 503 && record(body) && body["error"] === "box_not_running") throw new BoardRefused("box_not_running");
    const by = record(body) ? readPageMaker(body["by"]) : undefined;
    const kit = record(body) ? body["kit"] : undefined;
    if (!answer.ok || !record(body) || typeof body["html"] !== "string" || by === undefined || (kit !== undefined && (!record(kit) || typeof kit["css"] !== "string" || typeof kit["js"] !== "string"))) throw unreadable("/board/viewer");
    return { html: body["html"], by, ...(kit === undefined ? {} : { kit: { css: kit["css"] as string, js: kit["js"] as string } }), ...(body["bytes"] === true ? { bytes: true } : {}) };
  }

  async boardOpened(paths: readonly string[]): Promise<readonly OpenedFile[]> {
    const query = new URLSearchParams();
    for (const path of paths) query.append("path", path);
    const files = readOpenedFiles(await this.#boardAsk(await this.#call(`/board/opened?${query}`)));
    if (files === undefined) throw new BoardRefused("unreadable");
    return files;
  }

  async boardFiles(tab: string): Promise<readonly BoardFileRow[]> {
    const body = await this.#boardAsk(await this.#call(`/board/files?${new URLSearchParams({ tab })}`));
    const files = readBoardFiles(body);
    if (files === undefined) throw new BoardRefused("unreadable");
    return files;
  }

  async boardFile(tab: string, file: string): Promise<string> {
    const answer = await this.#call(`/board/file?${new URLSearchParams({ tab, file })}`);
    if (!answer.ok) await this.#boardAsk(answer);
    // A head line, then the file's words as written (`parts/cx-board.md` §3); an answer cut short breaks the read.
    const text = await answer.text().catch(() => undefined);
    const at = text?.indexOf("\n") ?? -1;
    if (text === undefined || at === -1) throw new BoardRefused("unreadable");
    return text.slice(at + 1);
  }

  async boardWrite(tab: string, file: string, text: string): Promise<{ readonly modified: number; readonly size: number }> {
    const body = await this.#boardAsk(await this.#call("/board/write", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tab, file, text }) }));
    if (!record(body) || typeof body["modified"] !== "number" || typeof body["size"] !== "number") throw new BoardRefused("unreadable");
    return { modified: body["modified"], size: body["size"] };
  }

  async boardTab(ask: BoardTabAsk): Promise<void> {
    await this.#boardAsk(await this.#call("/board/tab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ask) }));
  }

  /** A page's ask answered: its body, or `BoardRefused` with the platform's word for why, and a board's count now where it says one. */
  async #boardAsk(answer: Response): Promise<unknown> {
    const body = await answer.json().catch(() => undefined) as unknown;
    if (answer.ok) return body;
    const now = record(body) && Number.isSafeInteger(body["n"]) && typeof body["newest"] === "number" ? { n: body["n"] as number, newest: body["newest"] } : undefined;
    throw new BoardRefused(record(body) && typeof body["error"] === "string" ? body["error"] : `status_${answer.status}`, now);
  }

  search(epoch: string, words: string, before?: string): Promise<ListPart<FoundRow>> {
    return this.#list("/search", before === undefined ? { q: words, epoch } : { q: words, before }, (value) => {
      if (!placed(value) || typeof value["id"] !== "string" || !Array.isArray(value["matched"])) return undefined;
      const matched = value["matched"].filter((hit): hit is Record<string, unknown> & { who: "seller" | "cx"; at: string; time: number; stretch: string } => placed(hit) && typeof hit["stretch"] === "string" && (hit["who"] === "seller" || hit["who"] === "cx"));
      const span = value["span"];
      const spans = record(span) && typeof span["from"] === "number" && typeof span["to"] === "number" && span["from"] <= span["to"] ? { span: { from: span["from"], to: span["to"] } } : {};
      return matched.length === value["matched"].length ? { at: value["at"], id: value["id"], time: value["time"], title: value["title"], byTitle: value["byTitle"] === true, matched: matched.map(({ who, at, time, stretch }) => ({ who, at, time, stretch })), ...spans } : undefined;
    });
  }

  signedInHint(): boolean { return this.ports.signedInHint?.() ?? false; }

  async sources(): Promise<readonly Source[]> {
    const [answer, catalogue] = await Promise.all([this.#call("/sources"), this.catalogue()]);
    if (!answer.ok) { await drop(answer); throw new Error(`/sources answered ${answer.status}`); }
    const body = await answer.json() as unknown;
    if (!record(body) || !Array.isArray(body["sources"])) throw new Error("/sources unreadable");
    return body["sources"].flatMap((value) => { const source = readSource(value, catalogue); return source === undefined || source.name === TEST_SOURCE ? [] : [source]; });
  }



  /**
   * Signing out is a post the platform answers by ending the session and sending the browser to the door, whose address says which
   * sign-out it was; the page then goes there. A session whose token lapsed is renewed first by the platform's round trip, once, and the
   * pages post again when they are back; any other answer is a sign-out that did not finish, and the person may still be signed in.
   */
  again(): void { this.ports.go("/"); }

  async spaces(): Promise<Spaces | undefined> { return await this.ports.spaces?.(); }

  async use(organization: string | null): Promise<void> {
    await this.ports.use?.(organization);
    this.ports.switching?.set();
    this.again();
  }

  switched(): boolean { return this.ports.switching?.take() === true; }

  async leave(everywhere = false, landing?: DoorReason): Promise<Left> {
    const renewed = this.#renewed;
    this.#renewed = false;
    const all = everywhere || renewed === "everywhere";
    const answer = await this.#call("/sign-out", { method: "POST", redirect: "follow", ...(all ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ everywhere: true }) } : {}) }, false);
    await drop(answer);
    // Only the reason is taken from where the answer was sent; the page goes to its own door whatever origin the address named.
    if (answer.redirected) { this.ports.go(`${this.links.signIn}${landing === undefined ? new URL(answer.url).search : `?${DOOR_KEY}=${landing}`}`); return "ended"; }
    if (answer.status === 409 && renewed === false) { this.ports.leaving.set(...(all ? [true as const] : [])); this.ports.go("/refresh"); return "renewing"; }
    throw new Error(`sign-out answered ${answer.status}`);
  }

  leaving(): boolean {
    this.#renewed = this.ports.leaving.take();
    return this.#renewed !== false;
  }

  hold(draft: () => string): void { this.#draft = draft; }

  carried(): Carried | undefined {
    const carried = this.#carried;
    this.#carried = undefined;
    return carried;
  }

  /** The list, as long as the platform takes to answer it: the platform holds the one clock on it, and answers `box_slow` when it lapses. */
  async packages(): Promise<PackageList> {
    const answer = await this.#post({ package: { op: "list" } });
    const body = await answer.json().catch(() => undefined) as unknown;
    if (answer.status === 200 && record(body) && body["ok"] === true && Array.isArray(body["packages"])) return readList({ ...body, packages: body["packages"] });
    // The computer's own word for why it could not list, or the platform's that it did not answer in time.
    if ((answer.status === 200 || answer.status === 504) && record(body) && body["ok"] === false && typeof body["reason"] === "string") throw new Error(body["reason"]);
    if (answer.status === 409 && record(body) && body["error"] === "box_pending") throw new ComputerPending();
    throw new Error(record(body) && typeof body["error"] === "string" ? body["error"] : `packages answered ${answer.status}`);
  }
  async #click(op: Click["op"], source: string): Promise<Written> {
    const answer = await this.#post({ package: { op, source } });
    const body = await answer.json().catch(() => undefined) as unknown;
    const entry = answer.status === 202 && record(body) ? readWaitingEntry(body["waiting"]) : undefined;
    if (entry !== undefined && entry.op !== "model" && entry.op === op) return written(entry, record(body) ? rowOf(body["row_waiting"]) : undefined);
    const code = record(body) ? body["error"] : undefined;
    if ((answer.status === 409 && code === "waiting_full") || (answer.status === 503 && code === "sources_unavailable") || (answer.status === 502 && code === "box_unreachable")) throw new Error(code);
    throw new Error(`click answered ${answer.status}`);
  }
  installPackage(source: string, installed: boolean): Promise<Written> { return this.#click(installed ? "install" : "remove", source); }
  /** A bundle's press or its Remove, one request: its answer is every entry it wrote, one per source, in the order sent. */
  async #bundleClick(key: "press" | "bundle_remove", bundle: string, sources: readonly string[]): Promise<readonly Written[]> {
    const answer = await this.#post({ [key]: { bundle, sources } });
    const body = await answer.json().catch(() => undefined) as unknown;
    const op = key === "press" ? "install" : "remove";
    const entries = answer.status === 202 && record(body) && Array.isArray(body["waiting"]) ? body["waiting"].map((value) => readWaitingEntry(value)) : undefined;
    const clicks = entries?.flatMap((entry) => (entry !== undefined && entry.op === op ? [entry] : []));
    if (clicks !== undefined && clicks.length === sources.length && clicks.every((click, n) => click.source === sources[n])) { const row = record(body) ? rowOf(body["row_waiting"]) : undefined; return clicks.map((click) => written(click, row)); }
    const code = record(body) ? body["error"] : undefined;
    if ((answer.status === 409 && (code === "waiting_full")) || (answer.status === 503 && code === "sources_unavailable") || (answer.status === 502 && code === "box_unreachable")) throw new Error(code);
    throw new Error(`click answered ${answer.status}`);
  }
  pressBundle(bundle: string, sources: readonly string[]): Promise<readonly Written[]> { return this.#bundleClick("press", bundle, sources); }
  removeBundle(bundle: string, sources: readonly string[]): Promise<readonly Written[]> { return this.#bundleClick("bundle_remove", bundle, sources); }
  /** `/me` read for its bundle fields alone: a record it cannot read is none, and a mark it does not state is not held. */
  async bundleState(): Promise<BundleState> {
    const answer = await this.#call("/me");
    if (!answer.ok) { await drop(answer); throw new Error(`/me answered ${answer.status}`); }
    const body = await answer.json().catch(() => undefined) as unknown;
    if (!record(body)) throw new Error("/me unreadable");
    const held = Array.isArray(body["held_bundles"]) ? body["held_bundles"].flatMap((one): HeldBundle[] => (record(one) && typeof one["bundle"] === "string" && count(one["at"]) && Array.isArray(one["brought"]) && one["brought"].every((name) => typeof name === "string")
      ? [{ bundle: one["bundle"], at: one["at"], ...(count(one["since"]) ? { since: one["since"] } : {}), brought: one["brought"] as string[], ...(names(one["shown"]) ? { shown: one["shown"] } : {}) }] : [])) : [];
    return { held };
  }
  async showBundle(bundle: string): Promise<void> {
    const answer = await this.#post({ bundle_shown: { bundle } });
    await drop(answer);
    if (!answer.ok) throw new Error(`bundle_shown answered ${answer.status}`);
  }
  setPackage(source: string, enabled: boolean): Promise<Written> { return this.#click(enabled ? "on" : "off", source); }
  updatePackage(source: string): Promise<Written> { return this.#click("update", source); }
  async readme(source: string): Promise<Readme | undefined> {
    const answer = await this.#post({ package: { op: "readme", source } });
    const body = await answer.json().catch(() => undefined) as unknown;
    if (answer.status === 200 && record(body)) {
      const readme = body["readme"];
      if (body["ok"] === true && readme === null) return undefined;
      if (body["ok"] === true && record(readme) && typeof readme["name"] === "string" && typeof readme["text"] === "string") return { name: readme["name"], text: readme["text"] };
      if (body["ok"] === false && body["reason"] === "readme_too_large") throw new Error("readme_too_large");
    }
    throw new Error(`readme answered ${answer.status}`);
  }
  async npmPackages(kind: NpmKind | "all", order: NpmOrder, from: number, section: NpmSection = "pi", sought?: string): Promise<NpmList> {
    const words = sought?.trim() ?? "";
    const answer = await this.#call(`/plugins/npm?kind=${kind}&order=${order}&from=${from}${section === "pi" ? "" : `&section=${section}`}${words === "" ? "" : `&q=${encodeURIComponent(words)}`}`);
    if (!answer.ok) throw await npmRefusal(answer, "/plugins/npm");
    const body = await answer.json().catch(() => undefined) as unknown;
    if (!record(body) || !Array.isArray(body["packages"]) || !count(body["total"]) || typeof body["read_at"] !== "string") throw unreadable("/plugins/npm");
    return { packages: body["packages"].flatMap((one) => readListed(one) ?? []), total: body["total"], read_at: body["read_at"] };
  }
  async npmPackage(name: string, version?: string): Promise<NpmPackage> {
    // The scope's slash stays a slash: the route reads the name as written. A `.` or `..` part is never sent: the URL folds it before
    // any server sees it, so the ask would leave this route. Such a name is none npm takes, and is answered as the platform answers those.
    const parts = name.split("/");
    if (parts.some((part) => part === "." || part === "..")) throw new Error("unknown_package");
    const answer = await this.#call(`/plugins/npm/${parts.map((part) => encodeURIComponent(part)).join("/")}${version === undefined ? "" : `?version=${encodeURIComponent(version)}`}`);
    if (!answer.ok) throw await npmRefusal(answer, "/plugins/npm/", true);
    const body = await answer.json().catch(() => undefined) as unknown;
    const listed = readListed(body);
    if (listed === undefined || !record(body) || typeof body["version"] !== "string" || typeof body["readme"] !== "string" || typeof body["readme_cut"] !== "boolean" || typeof body["ours"] !== "boolean") throw unreadable("/plugins/npm/");
    const repository = body["repository"];
    // Its own `comchatx` field is kept whoever made it: one made for ComChatX by someone else declares its shelf there, as ours do.
    const field = body["comchatx"];
    return { ...listed, version: body["version"], readme: body["readme"], readme_cut: body["readme_cut"], ours: body["ours"], ...repositoryAt(repository), ...(record(field) ? { comchatx: field } : {}), shipped: readShipped(body["shipped"]), uses: usesOf(body["uses"]) };
  }
  async accounts(): Promise<readonly Account[]> { return (await this.#held())?.accounts ?? []; }
  /** The platform runs the sign-in and answers with its steps as a stream, which ends with how the sign-in ended; one that ends unsaid did not sign in. */
  async signIn(account: string, steps?: SignInPorts): Promise<void> {
    const cancelled = (): boolean => steps?.signal?.aborted === true;
    const answer = await this.#call(`/model-providers/${encodeURIComponent(account)}/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}", ...(steps?.signal === undefined ? {} : { signal: steps.signal }),
    }).catch(() => undefined);
    if (answer === undefined) throw new SignInEnded(cancelled() ? "cancelled" : "unavailable");
    if (!answer.ok || answer.body === null) {
      const body = await answer.json().catch(() => undefined) as unknown;
      const code = record(body) ? body["error"] : undefined;
      throw new SignInEnded(code === "busy" || code === "crowded" || code === "too_often" ? code : "unavailable");
    }
    let end: SignInEnd | undefined;
    try {
      for await (const data of eventData(answer.body)) {
        let frame: unknown;
        try { frame = JSON.parse(data); } catch { continue; }
        const read = readSignInFrame(frame);
        if (read === undefined) continue;
        if ("step" in read) steps?.heard(read.step); else end = read.end;
      }
    } catch { /* A stream that broke ended unsaid. */ } finally { this.#presence = undefined; }
    if (end?.state === "signed_in") return;
    if (end === undefined) throw new SignInEnded(cancelled() ? "cancelled" : "unavailable");
    throw new SignInEnded(end.reason, end.reason === "refused" ? end.words : undefined, end.reason === "timed_out" ? end.minutes : undefined);
  }
  async answerSignIn(account: string, id: string, answer: DialogAnswer): Promise<boolean> {
    if ("confirmed" in answer) return false;
    const taken = await this.#call(`/model-providers/${encodeURIComponent(account)}/login/answer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...answer }) });
    await taken.body?.cancel();
    return taken.ok;
  }
  async signOut(account: string): Promise<void> {
    const answer = await this.#call(`/model-providers/${encodeURIComponent(account)}/login`, { method: "DELETE" }).finally(() => { this.#presence = undefined; });
    await answer.body?.cancel();
    if (!answer.ok) throw new Error(`sign out answered ${answer.status}`);
  }
  showModel(): Promise<void> { return offered(); }
  /**
   * The person's card choices, kept at the gate, and the pick and the thinking level waiting in the account's list: one answer of the
   * platform's, read once for the reads made together.
   */
  #record(): Promise<ChoicesRecord> {
    if (this.#recordFresh !== undefined) return this.#recordFresh;
    const fresh: Promise<ChoicesRecord> =
      this.#fresh(() => this.#recordOnce()).finally(() => { if (this.#recordFresh === fresh) this.#recordFresh = undefined; });
    return this.#recordFresh = fresh;
  }
  #recordFresh: Promise<ChoicesRecord> | undefined;
  #recordOnce(): Promise<ChoicesRecord> {
    if (this.#recordReading !== undefined) return this.#recordReading;
    const reading: Promise<ChoicesRecord> =
      this.#readRecord().finally(() => { if (this.#recordReading === reading) this.#recordReading = undefined; });
    return this.#recordReading = reading;
  }
  async #readRecord(): Promise<ChoicesRecord> {
    const answer = await this.#call("/card-choices");
    if (!answer.ok) { await drop(answer); throw new Error(`card choices answered ${answer.status}`); }
    const body = await answer.json().catch(() => undefined) as unknown;
    if (!record(body) || !("choices" in body) || !("pending" in body)) throw new Error("card choices unreadable");
    const choices = body["choices"] === null ? undefined : readCardChoices(body["choices"]);
    const pending = body["pending"] === null ? undefined : readPendingPick(body["pending"]);
    if ((body["choices"] !== null && choices === undefined) || (body["pending"] !== null && pending === undefined)) throw new Error("card choices unreadable");
    const said = readSaidModel(body["said_model"]);
    return { choices, pending, thinking: readRowThinking(body["thinking"], body["thinking_end"]), awake: record(body["awake"]) ? awakeOf(body["awake"]).awake ?? {} : undefined, ...(said === undefined ? {} : { said }) };
  }
  async #choices(): Promise<CardChoices | undefined> { return (await this.#record()).choices; }
  async vendors(): Promise<readonly string[] | undefined> { return (await this.#choices())?.vendors; }
  async pendingPick(): Promise<PendingPick | undefined> { return (await this.#record()).pending; }
  async pendingThinking(): Promise<RowThinking> { return (await this.#record()).thinking; }
  async keptAwake(): Promise<Awake | undefined> { return (await this.#record()).awake; }
  async chooseThinking(level: string): Promise<{ readonly id: string; readonly level: string }> {
    this.#moved();
    const answer = await this.#call("/thinking-level", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ level }) }).finally(() => this.#moved());
    const body = await answer.json().catch(() => undefined) as unknown;
    const waiting = answer.ok && record(body) ? readRowThinking(body["waiting"], null).waiting : undefined;
    if (waiting === undefined) throw new Error(`thinking level answered ${answer.status}`);
    return waiting;
  }
  async pick(pick: PendingPick): Promise<"taken" | "pending"> {
    this.#moved();
    const answer = await this.#call("/model-pick", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(pick) }).finally(() => this.#moved());
    const body = await answer.json().catch(() => undefined) as unknown;
    if (answer.ok && record(body) && (body["state"] === "taken" || body["state"] === "pending")) return body["state"];
    const code = record(body) ? body["error"] : undefined;
    throw new Error(code === "model_not_allowed" || code === "model_refused" ? code : `pick answered ${answer.status}`);
  }
  /** The record is one: the vendors are written beside everything else it already holds. */
  async setVendors(vendors: readonly string[]): Promise<void> {
    await this.#change((held) => ({ ...held, vendors: [...new Set(vendors)].slice(0, CARD_PLACES) }));
  }
  async ruleSeen(): Promise<boolean> { return (await this.#choices())?.seen?.[RULE_SEEN] !== undefined; }
  async seeRule(): Promise<void> {
    await this.#change((held) => (held.seen?.[RULE_SEEN] !== undefined ? held : { ...held, seen: { ...held.seen, [RULE_SEEN]: [] } }));
  }
  /**
   * Every write of the record, one after another: each reads the record as the last write left it, changes it, and puts it whole, with the
   * providers whose keys and sign-ins go in the same write. A read that began before a write is never answered with what it read.
   */
  #change(change: (held: CardChoices) => CardChoices, forget: readonly string[] = []): Promise<void> {
    const write = this.#writing.catch(() => undefined).then(async () => {
      const held = (await this.#readRecord()).choices ?? { vendors: [], models: {} };
      const next = change(held);
      if (next === held && forget.length === 0) return;
      this.#moved();
      const answer = await this.#call("/card-choices", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(forget.length === 0 ? { choices: next } : { choices: next, forget }) });
      await answer.body?.cancel();
      if (!answer.ok) throw new Error(`card choices answered ${answer.status}`);
    }).finally(() => this.#moved());
    this.#writing = write;
    return write;
  }
  #ours: Promise<Catalogue> | undefined;
  /** The last catalogue the platform answered, which a read that fails after it does not take away. */
  #oursKnown: Catalogue | undefined;
  /**
   * The catalogue with ours as npm holds them, read once a page while the platform's answer is whole: the platform keeps npm's read, so a
   * page asks it once. An answer that is not whole is drawn as `partial`, and the next ask reads again. Where it could not be read, the
   * last answer stands, else none of ours as `failed`; the console says why, and the next ask reads again.
   */
  catalogue(): Promise<Catalogue> {
    this.#ours ??= Promise.all([this.#call("/plugins/ours").then(async (answer) => {
      const body = answer.ok ? await answer.json().catch(() => undefined) as unknown : undefined;
      if (!record(body) || !Array.isArray(body["packages"])) throw unreadable("/plugins/ours");
      return { ours: body["packages"].flatMap((one) => readOurs(one) ?? []), whole: body["whole"] !== false };
    }), this.#official()]).then(([{ ours, whole }, official]) => {
      const catalogue = catalogueWith(ours, official);
      if (whole) { this.#oursKnown = catalogue; return catalogue; }
      this.#ours = undefined;
      this.#oursKnown = { ...catalogue, oursRead: "partial" };
      return this.#oursKnown;
    }).catch((error: unknown) => {
      console.warn("Plugins: ours could not be read:", error);
      this.#ours = undefined;
      return this.#oursKnown ?? { ...catalogueWith([]), oursRead: "failed" };
    });
    return this.#ours;
  }
  /**
   * The official bundles as the platform serves them, in its order; where it does not answer, or answers what cannot be read, the code's
   * own list, which is the one the platform serves (`shared/bundles.ts`).
   */
  async #official(): Promise<readonly OfficialBundle[]> {
    const answer = await this.#call("/plugins/bundles").catch(() => undefined);
    if (answer?.ok !== true) { if (answer !== undefined) await drop(answer); return OFFICIAL_BUNDLES; }
    const body = await answer.json().catch(() => undefined) as unknown;
    return record(body) && Array.isArray(body["bundles"]) ? body["bundles"].flatMap((one) => readOfficial(one) ?? []) : OFFICIAL_BUNDLES;
  }
  // What the Plugins page reads and the platform has no route for yet: the features keep each control that needs one undrawn here.
  uploadPlugin(): Promise<string> { return offered(); }
  /** The model plugins the person installed, from the one record the card's choices are kept in. */
  async modelPlugins(): Promise<readonly ModelPlugin[]> {
    return Object.entries((await this.#choices())?.plugins ?? {}).map(([id, plugin]) => ({ id, enabled: plugin.on, ways: plugin.ways }));
  }
  /**
   * Installs a maker's plugin on, reached first by the person's own key or sign-in where one is held there and then by the balance where it
   * reaches the card — never a host's own, which the person's key there alone reaches —, with
   * no series ticked; the series that exist now are not news. Removing it takes its ticks and its place on the card, and in the same write the person's keys
   * and sign-ins at the maker's own providers: a host's reach other makers too, so they stay.
   */
  async installModel(id: string, installed: boolean): Promise<void> {
    if (!installed) {
      await this.#change((held) => {
        const { [id]: _plugin, ...plugins } = held.plugins ?? {};
        const { [id]: _models, ...models } = held.models;
        const { [id]: _seen, ...seen } = held.seen ?? {};
        const { [id]: _pins, ...pins } = held.pins ?? {};
        return { vendors: held.vendors.filter((one) => one !== id), models, pins, plugins, seen };
      }, keyProvidersOf(id));
      this.#presence = undefined;
      return;
    }
    const presence = await this.#held();
    const providers = keyProvidersOf(id);
    const ways: Way[] = [
      ...(presence?.providers.some((one) => providers.includes(one.id) && one.own_key) === true ? ["key" as const] : []),
      ...(presence?.accounts.some((one) => providers.includes(one.id) && one.signedIn) === true ? ["account" as const] : []),
      ...(platformPaysFor(id) ? ["platform" as const] : []),
    ];
    // An install chooses nothing for the seller: the vendor's series wait unticked, and a key saved or a sign-in made ticks them.
    await this.#change((held) => (held.plugins?.[id] !== undefined ? held
      : { ...held, plugins: { ...held.plugins, [id]: { on: true, ways } } }));
  }
  async setModel(id: string, enabled: boolean): Promise<void> {
    await this.#change((held) => (held.plugins?.[id] === undefined ? held : { ...held, plugins: { ...held.plugins, [id]: { ...held.plugins[id]!, on: enabled } } }));
  }
  async setModelWays(id: string, ways: readonly Way[]): Promise<void> {
    await this.#change((held) => (held.plugins?.[id] === undefined ? held : { ...held, plugins: { ...held.plugins, [id]: { ...held.plugins[id]!, ways: [...new Set(ways)] } } }));
  }
  /** The key is the one field the source declares as the person's own, saved and checked as a form of one field; a refusal rejects with the gate's words, or the platform's word. */
  async saveSourceKey(name: string, key: string): Promise<void> {
    const own = Object.keys((await this.sources()).find((source) => source.name === name)?.fields ?? {});
    if (own.length !== 1) throw new Error("unknown_field");
    const check = await this.saveSourceFields(name, { [own[0]!]: key });
    if (!check.ok) throw new Error(check.words === "" ? (check.missing === true ? "key_required" : "refused") : check.words);
  }
  /** Answered `{}` and nothing else; a refusal rejects with the platform's word, and any other answer as unread. */
  async removeSourceKey(name: string): Promise<void> {
    const answer = await this.#call(`/sources/${encodeURIComponent(name)}/fields`, { method: "DELETE" });
    const body = await answer.json().catch(() => undefined) as unknown;
    if (answer.status === 200 && record(body) && Object.keys(body).length === 0) return;
    throw new Error(!answer.ok && record(body) && typeof body["error"] === "string" ? body["error"] : `fields removal answered ${answer.status}`);
  }
  /**
   * One request: the platform saves each field at the gate and asks the source's check. The gate's refusal of a value names the field, in
   * its words; a field not saved yet is said by the page's own line; any other refusal rejects with the platform's word.
   */
  async saveSourceFields(name: string, fields: Readonly<Record<string, string>>): Promise<FieldsCheck> {
    const answer = await this.#call(`/sources/${encodeURIComponent(name)}/fields`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ fields }) });
    const body = await answer.json().catch(() => undefined) as unknown;
    const read = readFieldsAnswer(answer.status, body);
    if (read !== undefined) return read;
    throw new Error(!answer.ok && record(body) && typeof body["error"] === "string" ? body["error"] : `fields answered ${answer.status}`);
  }
  async removeConnection(name: string, store: string): Promise<void> {
    await this.#own(`/sources/${encodeURIComponent(name)}/connections/${encodeURIComponent(store)}`, "DELETE");
  }
  /**
   * One connect's request and its answer: the supplier's, or no words for a pair not saved, with the name the platform made for the
   * connection where it made one; any other answer rejects, with the platform's word where it gave one.
   */
  async #connect(path: string, sent: unknown): Promise<ConnectionCheck> {
    const answer = await this.#call(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sent) });
    const body = await answer.json().catch(() => undefined) as unknown;
    // The gate's words on a missing saved field are not Amazon's: the page says its refusal line alone.
    if (answer.status === 409 && record(body) && body["error"] === "key_required") return { ok: false, words: "" };
    if (answer.ok && record(body) && typeof body["ok"] === "boolean") {
      if (!body["ok"]) return { ok: false, words: typeof body["words"] === "string" ? body["words"] : "", ...(body["reason"] === "no_profiles" ? { none: true as const } : {}) };
      return { ok: true, ...(typeof body["connection"] === "string" && body["connection"] !== "" ? { connection: body["connection"] } : {}) };
    }
    throw new Error(!answer.ok && record(body) && typeof body["error"] === "string" ? body["error"] : `connect answered ${answer.status}`);
  }
  addPair(name: string, sent: { readonly fields: Readonly<Record<string, string>>; readonly connection: Readonly<Record<string, string>> }): Promise<ConnectionCheck> {
    return this.#connect(`/sources/${encodeURIComponent(name)}/pairs/new`, sent);
  }
  connectUnder(name: string, pair: string, connection: Readonly<Record<string, string>>): Promise<ConnectionCheck> {
    return this.#connect(`/sources/${encodeURIComponent(name)}/connections/new/connect`, { pair, connection });
  }
  async removePair(name: string, pair: string): Promise<void> {
    await this.#own(`/sources/${encodeURIComponent(name)}/pairs/${encodeURIComponent(pair)}`, "DELETE");
  }
  async feishu(): Promise<string> {
    const answer = await this.#call("/account/feishu");
    const body = await answer.json().catch(() => undefined) as unknown;
    if (!answer.ok || !record(body) || typeof body["hook"] !== "string") throw new Error(`feishu answered ${answer.status}`);
    return body["hook"];
  }
  saveFeishu(hook: string): Promise<void> { return this.#own("/account/feishu", "PUT", { hook }); }
  removeFeishu(): Promise<void> { return this.#own("/account/feishu", "DELETE"); }
  /** A write of the person's own, at a source or on the account: answered with nothing, or refused with the platform's word as the message. */
  async #own(path: string, method: "PUT" | "DELETE", body?: Readonly<Record<string, string>>): Promise<void> {
    const answer = await this.#call(path, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (answer.ok) { await answer.body?.cancel(); return; }
    const said = await answer.json().catch(() => undefined) as unknown;
    throw new Error(record(said) && typeof said["error"] === "string" ? said["error"] : `${method} ${path.split("/").slice(0, 3).join("/")} answered ${answer.status}`);
  }
  /**
   * Every maker's chat series among the models the person can reach now, each version once with every way that lists it, in the order
   * of use, the balance's price on it where the balance lists it. A tick and a pin are the record's, kept apart; a pin whose version is
   * no longer served is said, and the series uses its latest.
   */
  async series(): Promise<SeriesByVendor> {
    const [models, choices, { words }, providers] = await Promise.all([this.models(), this.#choices(), this.catalogue(), this.#providerPresence()]);
    const reached = this.#grouped(models.available, choices, words);
    // A vendor no way of the person's reaches lists the catalogue its provider names, every series of it shut until a key or a sign-in opens
    // it: looked at, not reached, so grouped apart from the ways an install keeps, and shown wherever what is reached lists nothing.
    const unreached = (providers ?? []).filter((one) => !one.own_key && !one.signed_in)
      .flatMap((one) => one.models.map((model) => ({ ...model, via: one.name, own: PROVIDERS[one.id]?.key === false ? "account" as const : "key" as const })));
    const listed = this.#grouped(unreached, undefined, words).filter(([card]) => !reached.some(([one, groups]) => one === card && groups.length > 0)).map(([card, groups]) =>
      [card, groups.map((group): Series => ({ name: group.name, versions: group.versions.map(versionOfModel), inChat: false, listed: true, ...(group.maker === undefined ? {} : { maker: group.maker }) }))] as const);
    return Object.fromEntries([...reached.map(([card, groups]) => {
      return [card, groups.map((group): Series => {
        const pinned = pinOf(choices, card, group.id);
        const gone = pinGone(choices, card, group);
        return {
          name: group.name, versions: group.versions.map(versionOfModel), inChat: isTicked(choices, card, group.id),
          ...(pinned === undefined || gone !== undefined ? {} : { pinned }), ...(gone === undefined ? {} : { gone: this.#nameOf(models.available, gone) }),
          ...(group.maker === undefined ? {} : { maker: group.maker }),
        };
      })] as const;
    }), ...listed]);
  }
  /** What the card offers: the record's ticked series, each as the version it is on now and reached by the plugin's first way to it. */
  async chatOffer(): Promise<ChatOffer> {
    const [models, choices, { words }] = await Promise.all([this.models(), this.#choices(), this.catalogue()]);
    const card = chatCard(choices, Object.fromEntries(this.#grouped(models.available, choices, words)));
    return { vendors: card.vendors, models: card.rows.map((row) => { const { ways: _, ...model } = row.version; return { ...model, series: row.series.name, seriesId: row.series.id, ...(pinOf(choices, row.card, row.series.id) === row.version.id ? { pinned: true as const } : {}) }; }), places: card.places };
  }
  /** A version's name where any way still lists it, else its id: a pin's version that left may be listed nowhere. */
  #nameOf(available: readonly Model[], id: string): string {
    const listed = available.find((model) => model.id === id);
    return listed === undefined ? id : plainName(listed.name);
  }
  /**
   * A card's series as the person reaches them: each version once, however many ways list it and however each spells it, as the model
   * the first of the plugin's ways serves it by, named as pi names it where a way of the person's own lists it, carrying the balance's
   * price where the balance lists it and every way that lists it, in their order. An installed plugin is reached by its ways alone; one
   * not installed shows every series a way reaches. A series is named past the plans its card's words give (`cardSeries`).
   */
  #grouped(available: readonly Model[], choices: CardChoices | undefined, words: CardWords): readonly (readonly [string, readonly ChatSeries<Reached>[]])[] {
    const byCard = new Map<string, Model[]>();
    for (const model of available) { const card = makerOf(model.provider, model.id); if (card !== undefined) (byCard.get(card) ?? byCard.set(card, []).get(card)!).push(model); }
    return [...byCard].map(([card, models]) => {
      const wayOf = (model: Model): Way => (model.via === undefined ? "platform" : model.own ?? "key");
      const merged: { model: Model; members: Model[]; ways: Way[]; name: string; own: boolean; price: Model["price"] }[] = [];
      for (const model of inWayOrder(models, waysOf(choices, card), wayOf)) {
        const own = model.via !== undefined;
        const found = merged.find((one) => one.members.every((member) => member.provider !== model.provider) && one.members.some((member) => sameModel(member, model)));
        const entry = found ?? merged[merged.push({ model, members: [], ways: [], name: plainName(modelName(model)), own, price: undefined }) - 1]!;
        entry.members.push(model);
        if (!entry.ways.includes(wayOf(model))) entry.ways.push(wayOf(model));
        if (own && !entry.own) { entry.name = plainName(modelName(model)); entry.own = true; }
        if (!own && model.price !== undefined) entry.price = model.price;
      }
      const reached = merged.map((entry): Reached => {
        const { price: _, ...model } = entry.model;
        return { ...model, name: entry.name, ...(entry.price === undefined ? {} : { price: entry.price }), ways: Object.freeze([...entry.ways]) };
      });
      return [card, cardSeries(card, reached, words[card]?.plans)] as const;
    });
  }
  /** The series of a card by its name: its id, from the series the person reaches now. */
  async #seriesNamed(card: string, name: string): Promise<string | undefined> {
    const [models, choices, { words }] = await Promise.all([this.models(), this.#choices(), this.catalogue()]);
    return this.#grouped(models.available, choices, words).find(([one]) => one === card)?.[1].find((one) => one.name === name)?.id;
  }
  async setSeries(id: string, series: string, inChat: boolean): Promise<TickRefused | undefined> {
    const named = await this.#seriesNamed(id, series);
    if (named === undefined) return undefined;
    let refused: TickRefused | undefined;
    await this.#change((held) => { const next = withTick(held, id, named, inChat); refused = typeof next === "string" ? next : undefined; return typeof next === "string" ? held : next; });
    return refused;
  }
  /** Each series named from one read of what the person reaches, and all of them ticked in one write of the record. */
  async addToChat(id: string, series: readonly string[]): Promise<TickRefused | undefined> {
    const [models, choices, { words }] = await Promise.all([this.models(), this.#choices(), this.catalogue()]);
    const groups = this.#grouped(models.available, choices, words).find(([one]) => one === id)?.[1] ?? [];
    const named = series.flatMap((name) => groups.find((one) => one.name === name)?.id ?? []);
    if (named.length === 0) return undefined;
    let refused: TickRefused | undefined;
    await this.#change((held) => { const [next, why] = withTicks(held, id, named); refused = why; return next; });
    return refused;
  }
  async takeOut(id: string): Promise<void> { await this.#change((held) => withoutVendor(held, id)); }
  async pinSeries(id: string, series: string, version: string | undefined): Promise<void> {
    const [models, choices, { words }] = await Promise.all([this.models(), this.#choices(), this.catalogue()]);
    const group = this.#grouped(models.available, choices, words).find(([one]) => one === id)?.[1].find((one) => one.name === series);
    if (group === undefined || (version !== undefined && !group.versions.some((one) => one.id === version))) return;
    await this.#change((held) => withPin(held, id, group.id, version));
  }
  now(): number { return this.#now(); }

  /** The answers read in UTC because the platform could not read the browser's zone. */
  readonly #inUtc = new WeakSet<Response>();
  async #read<T>(path: string, reader: (value: unknown) => T): Promise<T> {
    const answer = await this.#call(path);
    if (!answer.ok) { await drop(answer); throw new Error(`${path.split("?")[0]!} answered ${answer.status}`); }
    return reader(await answer.json().catch(() => undefined));
  }
  accountMoney(topUp?: number): Promise<AccountMoney> { return this.#read(topUp === undefined ? "/account/money" : `/account/money?top_up=${topUp}`, readAccountMoney); }
  terms(): Promise<Terms> { return this.#read("/terms", readTerms); }
  invitations(): Promise<Invitations> { return this.#read("/invitations", readInvitations); }
  async setAwake(on: boolean, minutes?: number): Promise<AwakeRow | undefined> {
    const answer = await this.#call("/account/awake", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(minutes === undefined ? { on } : { on, minutes }) });
    if (answer.status !== 200) { await drop(answer); throw new Error(`/account/awake answered ${answer.status}`); }
    const body: unknown = await answer.json().catch(() => undefined);
    const kept = record(body) ? idleMinutes(body["minutes"]) : undefined;
    return record(body) && typeof body["awake"] === "boolean" ? { on: body["awake"], ...(kept === undefined ? {} : { minutes: kept }) } : undefined;
  }
  async deleteAccount(): Promise<void> {
    const answer = await this.#call("/account/delete", { method: "POST" });
    await drop(answer);
    if (!answer.ok) throw new Error(`/account/delete answered ${answer.status}`);
  }
  async renameOrganization(name: string): Promise<string> {
    const answer = await this.#call("/organization/name", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const body: unknown = await answer.json().catch(() => undefined);
    if (!answer.ok || !record(body) || word(body["name"]) === undefined) throw new Error(`/organization/name answered ${answer.status}`);
    return body["name"] as string;
  }
  /** The road's 创建账户: the terms agreed to, and whether the person takes the promotional email. */
  acceptTerms(news: boolean): Promise<void> { return this.#write("/account/terms", { news }); }
  /** What the person asked to be called, which the identity provider keeps as their name. */
  setName(name: string): Promise<void> { return this.#write("/account/name", { name }); }
  devices(): Promise<readonly Device[]> { return this.#read("/account/sessions", readDevices); }
  endDevice(id: string): Promise<void> { return this.#write("/account/sessions/end", { id }); }
  photo(): string | undefined { return this.ports.photo?.(); }
  async setPhoto(file: Blob | null): Promise<void> {
    if (this.ports.setPhoto === undefined) throw new Error("no identity script");
    await this.ports.setPhoto(file);
  }
  watchPhoto(changed: () => void): void { this.ports.watchPhoto?.(changed); }
  /**
   * 开始使用 or 跳过: the survey's answers where any were given, and the computer set up with Essentials; whether it was.
   * A computer held for the account's money or the platform's limit, or one whose setting up failed, is a press that did not go through,
   * as is one that was never answered.
   */
  async startBox(answers?: SurveyAnswers): Promise<boolean> {
    const answer = await this.#call("/account/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(answers === undefined ? {} : { answers }) }).catch(() => undefined);
    if (answer === undefined) return false;
    await drop(answer);
    return answer.ok;
  }
  async #write(path: string, body: Readonly<Record<string, unknown>>): Promise<void> {
    const answer = await this.#call(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    await drop(answer);
    if (!answer.ok) throw new Error(`${path} answered ${answer.status}`);
  }
  /** A platform without billing has no subscription to read, and none is held. */
  async subscription(): Promise<Subscription> {
    if (!this.#billing) return { status: "none" };
    return this.#read("/billing/subscription", readSubscription);
  }
  /** A platform without billing keeps no card and took no payment. */
  async cards(): Promise<readonly SavedCard[]> { return this.#billing ? this.#read("/billing/cards", readCards) : []; }
  async payments(after?: string): Promise<Payments> {
    if (!this.#billing) return { payments: [], more: false, total: 0 };
    return this.#read(after === undefined ? "/billing/payments" : `/billing/payments?after=${encodeURIComponent(after)}`, readPayments);
  }
  async payIn(ask: CheckoutAsk, way: PayWay): Promise<string> { return this.#secret("/billing/checkout", { ...ask, way }); }
  async saveCard(replace: boolean): Promise<string> { return this.#secret("/billing/card", { replace }); }
  async payForm(secret: string): Promise<PayForm> {
    const handle = (this.ports.payment ?? (() => (globalThis as { readonly cmxPayment?: { readonly open: (secret: string) => Promise<PayForm> } }).cmxPayment))();
    if (handle === undefined) throw new Error("payment form unavailable");
    return handle.open(secret);
  }
  async returned(session: string): Promise<Returned> { return this.#read(`/billing/return?session=${encodeURIComponent(session)}`, readReturned); }
  cancelRenewal(): Promise<void> { return this.#move("/billing/cancel", "POST", {}); }
  resumeRenewal(): Promise<void> { return this.#move("/billing/resume", "POST", {}); }
  renewNow(): Promise<void> { return this.#move("/billing/renew-now", "POST", {}); }
  setRenewal(on: boolean): Promise<void> { return this.#move("/billing/renewal", "PUT", { from_balance: on }); }
  /** A move of the account's billing: refused here where the platform names none, and with the platform's own word where it refuses. */
  async #move(path: string, method: string, body: object): Promise<void> {
    if (!this.#billing) return offered();
    const answer = await this.#call(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const read = await answerBody(answer);
    if (!answer.ok) throw new Error(word(read["error"]) ?? `${path} answered ${answer.status}`);
  }
  async #secret(path: string, body: object): Promise<string> {
    if (!this.#billing) return offered();
    const answer = await this.#call(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const read = await answerBody(answer);
    const secret = word(read["client_secret"]);
    if (!answer.ok || secret === undefined) throw new Error(word(read["error"]) ?? `${path} answered ${answer.status}`);
    return secret;
  }
  async spending(span: SpanId): Promise<SpanSpending> {
    const path = `/account/spending?span=${span}`;
    const answer = await this.#call(path);
    if (!answer.ok) { await drop(answer); throw new Error(`/account/spending answered ${answer.status}`); }
    const read = readSpanSpending(await answer.json().catch(() => undefined));
    // Its days and clocks are the zone it was asked in: UTC where the browser's was refused.
    return this.#inUtc.has(answer) ? { ...read, zone: "UTC" } : read;
  }
  record(): Promise<readonly RecordEntry[]> { return this.#read("/account/record", readRecord); }
  computerUsage(span: UsageSpan): Promise<Usage> { return this.#read(`/computer/usage?span=${span}`, readUsage); }
  async resize(size: Size): Promise<{ readonly size: Size; readonly hourUnits: number }> {
    const answer = await this.#call("/computer/size", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ cpus: size.cpus, memory_mb: size.memoryMb }) });
    const read = await answerBody(answer);
    const now = sizeOf(read["box_size"]), hourUnits = unitsOf(read["box_hour_units"]);
    if (!answer.ok || now === undefined || hourUnits === undefined) throw new Error(word(read["error"]) ?? `/computer/size answered ${answer.status}`);
    return { size: now, hourUnits };
  }
  spendingFile(span: SpanId): string { return `/account/spending.csv?span=${span}&tz=${encodeURIComponent((this.ports.zone ?? browserZone)())}`; }
  recordFile(): string { return `/account/record.csv?tz=${encodeURIComponent((this.ports.zone ?? browserZone)())}`; }
}
