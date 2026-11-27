import type { Money } from "../shared/money.js";
import type { StreamEvent } from "./stream-model.js";
import type { DoorReason, DoorWork } from "../shared/door.js";
import type { Language } from "./strings.js";
import type { PendingPick, PickOutcome } from "../shared/card-choices.js";
import type { Catalogue, Way } from "./catalogue.js";
import type { DialogAnswer } from "../shared/dialog.js";
import type { SignInStep } from "../shared/sign-in.js";
import type { TickRefused } from "./chat-card.js";
import type { Maker } from "../shared/model-series.js";
import type { Shipped as Files } from "../shared/shipped.js";
import type { BoardEntry, BoardFileRow, BoardLabel, OpenedFile, PageMaker } from "../shared/board.js";

/**
 * The computer's parts as the platform read them from Fly, each figure left out where it read none: the processor's and the memory's
 * use while the computer runs, in whole percent, and the storage's size in GB and use in whole percent.
 */
export type Parts = { readonly cpu?: number; readonly memory?: number; readonly storageGb?: number; readonly storage?: number };

/** A size the computer runs at, as the platform names it: its processor kind, its cores and its memory. */
export type Size = { readonly kind: "shared" | "performance"; readonly cpus: number; readonly memoryMb: number };
/** A size a person can choose, with what an hour of it costs in the platform's units. */
export type Offered = Size & { readonly hourUnits: number };
export const USAGE_SPANS = ["m15", "m30", "h1", "h3", "h24", "h48", "d7"] as const;
export type UsageSpan = (typeof USAGE_SPANS)[number];
/** One bar of a usage chart: the step that ended at `at` (milliseconds), each part's average share there, absent where the computer was off. */
export type UsageBar = { readonly at: number; readonly cpu?: number; readonly memory?: number; readonly storage?: number };
export type Usage = { readonly span: UsageSpan; readonly stepS: number; readonly bars: readonly UsageBar[] };

export type { PendingPick };

/** `GET /me`'s balance as the platform answers it, in platform units; an organization's member is given no `available`. */
export type Balance = { readonly available?: number; readonly open_floor: number; readonly can_open: boolean };

/**
 * `GET /me` read once: the box, the balance, how units read as money and the month's spending. Settings and the sidebar draw from this one
 * answer; a month the ledger could not give is absent, never zero.
 */
/** The platform's word on the box's Machine: none running, one on its way up, or one started. */
export type Machine = "off" | "starting" | "on";
const MACHINES: readonly string[] = ["off", "starting", "on"];
export const readMachine = (value: unknown): Machine | undefined => (typeof value === "string" && MACHINES.includes(value) ? value as Machine : undefined);

/**
 * The accounts one sign-in holds, as the identity provider keeps them: each organisation the person is in, by its id and name, and the one
 * in use, `null` for the person's own account. Which account a request acts on is the provider's session's alone; the page reads it here.
 */
export type Spaces = { readonly active: string | null; readonly organizations: readonly { readonly id: string; readonly name: string }[] };

export type Me =
  | {
      readonly kind: "signed_in";
      /** The account's own id: what the page keeps its place in the stream under, so another account in this browser never inherits it. */
      readonly account: string;
      /** Who is signed in, as the identity vendor holds them; absent when the platform could not say. */
      readonly email: string | undefined;
      readonly name: string | undefined;
      /** The address is a public mailbox, as the platform judges it: an organisation is made under a work address. */
      readonly publicMailbox?: true;
      /** Whether the person has agreed to the terms, read for an account without a computer alone; absent where the platform did not say. */
      readonly terms?: boolean;
      /** The account's tutorial is closed: by 跳过, its last step or a leave, or because the account was here before the tutorial came. */
      readonly guideClosed?: true;
      /** Whether the box's Machine runs, as the platform read it for this answer; absent when it could not say. */
      readonly machine?: Machine | undefined;
      /** The Machine runs an image older than the platform's: a computer kept on takes the new one only when restarted. */
      readonly newer?: true;
      /** When the running computer was switched on, in milliseconds; absent while it is off or where the platform could not say. */
      readonly onSince?: number;
      /** What Fly says of the computer's parts, for its window; absent where the platform read none. */
      readonly parts?: Parts;
      /** What an hour of the computer costs, in the platform's units (decision D230); absent where the platform names none. */
      readonly hourUnits?: number;
      /** The size the computer runs at, and the sizes a person can choose; `sizes` is absent for an organisation's shared computer. */
      readonly size?: Size;
      readonly sizes?: readonly Offered[];
      readonly box: "provisioned" | "pending"; readonly balance: Balance | undefined; readonly money: Money; readonly spending: Spending | undefined;
      /** The messages the platform keeps for the box, which was not there to take them, in the order written; absent when it could not say. */
      readonly held?: readonly HeldMessage[];
      /** The organization the session has active, where it has one; absent for a person's own session. */
      readonly organization?: Organization;
      /**
       * The invitations waiting on the person, read while their account has no computer yet or an invitation's link is carried; and
       * the carried link's own, where it is not among them: waiting on another address, or gone.
       */
      readonly invited?: readonly InvitedTo[];
      readonly invitationLink?: "elsewhere" | "gone";
    }
  | { readonly kind: "signed_out" };

/** What an organization's seats are doing: renewing, cut at the renewal, cancelled, a failed charge tried again, or none held. */
export const SEATS_STATES = ["seats", "cut_pending", "cancelling", "retrying", "none"] as const;
export type SeatsState = (typeof SEATS_STATES)[number];
/**
 * An organization's seats as `/me` reads them: the bounds, the count in use, this period's count and the next period's where a cut waits,
 * and the state with the day its sentence names. A fact the platform could not read is absent.
 */
export type Seats = {
  readonly least: number; readonly most: number; readonly inUse?: number; readonly state?: SeatsState; readonly thisPeriod?: number;
  readonly nextPeriod?: { readonly seats: number; readonly from: Day }; readonly on?: Day;
};
/** The organization a session has active: its id, the asker's role, its name and its seats, each absent where the platform could not say. */
export type Organization = { readonly id: string; readonly role?: "admin" | "member"; readonly name?: string; readonly seats?: Seats };
/** The asker is a member of the organization in use, not its admin: what only the admin changes is not offered, and they are told whom to ask. */
export const isMember = (me: { readonly organization?: Organization } | undefined): boolean => me?.organization?.role === "member";

/**
 * What opening the box and its session came to. A refusal is admission's verdict with its reason — the box did not start, or, for a box
 * already running, the attach was refused and the box runs on. A failure is anything past admission or short of an answer: `status` is
 * absent when no answer came, and `reason` is the platform's word for it where it gave one.
 */
/**
 * A message the platform keeps for the box until the box takes it: its id there, its words, and when it was written. One that ended
 * without pi taking it — pi refused it, or the computer will not start — is `refused`, with pi's words, empty where there are none.
 */
export type HeldMessage = { readonly id: string; readonly message: string; readonly at: number; readonly refused?: string };

export type Opened =
  /** `dropped` names, as `<provider>/<model>`, a default of the person's the box took out because pi no longer finds that model. */
  | { readonly kind: "open"; readonly dropped?: string }
  /** The box's session is being opened by another ask: not open yet, and the start goes on. */
  | { readonly kind: "opening" }
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "failed"; readonly step: "box" | "session"; readonly status: number | undefined; readonly reason: string | undefined };

/**
 * What the world behind the pages offers. The canned preview shows every page drawn; the platform offers what it has a route for, and a
 * page with nothing behind it is not shown there.
 */
/** What a checkout is asked for: a membership that renews, one period of it, or whole dollars topped up. */
export type CheckoutAsk = { readonly kind: "subscription" | "period" } | { readonly kind: "top_up"; readonly dollars: number } | { readonly kind: "seats"; readonly seats: number; readonly name?: string };
/**
 * What a change of an organization's seats costs, as the vendor previews it, in units: today's charge, the next bill's total, and the
 * instant priced. The next total is left out while a cut already waits for the renewal.
 */
export type SeatsPrice = { readonly due: number; readonly next?: number; readonly at: number };
/** The seats an invitation buys first: the count and the moment of the quote the admin confirmed, as `seatsPrice` read it. */
export type SeatsBuy = { readonly seats: number; readonly at: number };
/** A count of seats set: the count held now, and the count a cut sets for the renewal. */
export type SeatsSet = { readonly seats: number; readonly next?: number };
/** Why the platform did not change the count, which stays as it was: `declined`, `seats_limit`, `seats_taken`, `no_subscription`, `cancelling` or `retrying`. */
export class SeatsRefused extends Error {
  constructor(readonly reason: string) { super(reason); }
}
/** An invitation waiting on the signed-in person: the organization it is to, the role, and who sent it. */
export type InvitedTo = { readonly id: string; readonly organization: { readonly id: string; readonly name: string }; readonly role: MemberRole; readonly inviter?: string };
/** An organization's two roles, as its admin sends an invitation with one. */
export type MemberRole = "admin" | "member";
/** A member of the organization, as the identity provider holds them: a name where they gave one, their address, their role. */
export type Member = { readonly name?: string; readonly email?: string; readonly role: MemberRole };
/** An invitation not yet answered: its address, the role it was sent with, who sent it, when it lapses (ms), and its link, read by the admin alone. */
export type WaitingInvitation = { readonly id: string; readonly email: string; readonly role: MemberRole; readonly inviter?: string; readonly expires: number; readonly url?: string };
export type Members = { readonly members: readonly Member[]; readonly invitations: readonly WaitingInvitation[] };
/** What an admin's invitations answered: the addresses sent, refused by the provider, past the organization's bound, and already a member's or waiting. */
/** What an invitation did; `seats`, where seats were asked for and something was left to send, is the count the platform holds after: it says nothing of a charge. */
export type InviteAnswer = { readonly sent: readonly string[]; readonly refused: readonly string[]; readonly full: readonly string[]; readonly known: readonly string[]; readonly seats?: SeatsSet };
/** The provider's limit of invitations for the day, passed on by its code. */
export class InvitationsLimited extends Error {
  constructor() { super("invitations_limited"); }
}
/** How a payment is made in the page: by card, or by Alipay, which leaves the page for its own and comes back. */
export type PayWay = "card" | "alipay";
export type Features = {
  /** Paying in; without it credit is granted by whoever invited the person. */
  readonly checkout: boolean;
  /** A person's own model account or key. */
  readonly bringYourOwn: boolean;
  /** Ticking which vendors take the model card's five places; without it the card takes the first five as they are listed. */
  readonly vendorTicks: boolean;
  /** Bundles: the shelf that offers them, and holding one. */
  readonly bundles: boolean;
  /** A model vendor as a plugin of its own: its install, its switch, its ways and its sign-in. Without it the models keep the page they have. */
  readonly modelPlugins: boolean;
  /** A source's Settings: what `/sources` lists it takes as the person's own — the fields and the stores of Amazon SP-API. */
  readonly sourceSettings: boolean;
  /** A source's own key beside the balance, where the source declares one field of its own and a price on the balance. */
  readonly sourceKeys: boolean;
  /** Handing cx's computer a package of the person's own, as a file or a link, to check and install. */
  readonly uploadPlugin: boolean;
};
export const EVERYTHING: Features = Object.freeze({ checkout: true, bringYourOwn: true, vendorTicks: true, bundles: true, modelPlugins: true, sourceSettings: true, sourceKeys: true, uploadPlugin: true });
/**
 * The Plugins page's first live release: the page, and of its controls only those a route stands behind today — a package's install,
 * removal and switch, which is a source's switch too; the official bundles, a bundle's press and its Remove; Amazon SP-API's stores, connected and removed on its Settings, and a source's own fields saved and checked on its; a source's own key saved and removed on its, paying in place of the balance; a source's spending,
 * from the platform's ledger; a model vendor's install, switch, ways and series; on the models' own page, the vendor ticks and a person's
 * own key.
 */
export const FIRST_RELEASE: Features = Object.freeze({ checkout: false, bringYourOwn: true, vendorTicks: true, bundles: true, modelPlugins: true, sourceSettings: true, sourceKeys: true, uploadPlugin: false });

/** A day in the seller's calendar, `YYYY-MM-DD`, as the platform prints it. */
export type Day = string;
export type LotKind = "included" | "top_up" | "reward" | "sign_up";
/** A lot that has not ended, the earliest to end first: what it landed with, what is left, what it paid, and its last day. */
/** `invited` marks an invited account's sign-up lot, with the inviter's address masked where the platform could read it. */
export type MoneyLot = { readonly kind: LotKind; readonly landed_on: Day; readonly units: number; readonly remainder: number; readonly used: number; readonly ends_on: Day; readonly days_left: number; readonly invited?: { readonly by?: string } };
export type FreeWhy = "trial_ended" | "membership_ended";
/**
 * `GET /account/money` as the platform answers it, from the ledger alone: which of the three the account is, the figure and the figure a
 * model other than the default can draw on, the debt, the two blocks and their lots, a member's period, why a free account stopped, the
 * warning, what a period costs and carries and what a renewal from the balance would be short, and the days of the period it would land.
 */
export type AccountMoney = {
  readonly state: "member" | "trial" | "free";
  readonly figure: number; readonly model_figure: number; readonly debt: number;
  readonly blocks: { readonly given: number; readonly paid: number };
  readonly lots: readonly MoneyLot[];
  readonly member?: { readonly last_day: Day; readonly renews_on: Day; readonly switch?: boolean };
  readonly free?: { readonly why?: FreeWhy; readonly ended_on?: Day };
  readonly warning: { readonly below: number; readonly low: boolean; readonly model_low: boolean };
  /**
   * A renewal from the balance: the price, what it would take of the top-up and reward lots and what it would be short; asked with a
   * top-up, the same with that top-up landed now, and what of it the renewal would take.
   */
  readonly renewal: { readonly price?: number; readonly takes: number; readonly short: number; readonly with_top_up?: { readonly takes: number; readonly short: number } };
  readonly next_period: { readonly last_day: Day; readonly renews_on: Day };
};
/** An account's money whose renewal is priced: a person's always is; an organisation's is where the vendor gave its seats' price. */
export type Priced = AccountMoney & { readonly renewal: AccountMoney["renewal"] & { readonly price: number } };
export const priced = (money: AccountMoney): money is Priced => money.renewal.price !== undefined;
/**
 * The membership as the payment provider holds it; `none` too where the platform names no billing. A charge being tried again says the
 * day of its next try, its sum and the first and last days of the period it pays for.
 */
export type Subscription = {
  readonly status: "none" | "active" | "cancelling" | "retrying";
  readonly retry?: { readonly on: Day; readonly amount: number; readonly first_day: Day; readonly last_day: Day };
};
/**
 * A device the account is signed in on: one of its sessions at the identity provider, with the day it signed in and its last activity
 * in milliseconds, `current` the one this browser holds; its kind, browser and place absent where the provider holds none.
 */
export type Device = {
  readonly id: string; readonly signedInAt: number; readonly activeAt: number; readonly current: boolean; readonly mobile: boolean;
  readonly device?: string; readonly browser?: string; readonly city?: string; readonly country?: string;
};
/** A card the payment provider keeps for the account, the one that pays first marked. */
export type SavedCard = { readonly id: string; readonly brand: string; readonly last4: string; readonly exp_month: number; readonly exp_year: number; readonly default: boolean };
/** A payment the ledger was credited for, newest first: how it was paid, its receipt and a period's invoice PDF, where the provider could say. */
export type Payment = { readonly on: Day; readonly kind: "membership" | "top_up" | "seats"; readonly amount: number; readonly debt_repaid: number; readonly way?: string; readonly receipt?: string; readonly pdf?: string };
/** A page of payments: `total` counts them all, and `next`, where there are more, is where the next page goes on from. */
export type Payments = { readonly payments: readonly Payment[]; readonly more: boolean; readonly total: number; readonly next?: string };
/** The platform's word on a session come back to: paid or not, and, once the ledger holds this payment's own credit, what it brought. */
/** A payment session's answer; one that makes an organisation names it once made, `pending` until then. */
export type Returned = { readonly state: "paid" | "unpaid"; readonly organization?: string; readonly credited?: { readonly kind: "membership" | "top_up" | "seats"; readonly amount: number; readonly debt_repaid: number } };
/** The figures 条款 prints, served to anyone: what a membership costs, the least top-up, and what a sign-up and an invitation bring. */
export type Terms = {
  readonly units_per_dollar: number; readonly price: number; readonly top_up_from: number; readonly paid_months: number;
  readonly trial: { readonly direct: number; readonly invited: number; readonly days: number };
  readonly friends: number; readonly reward: number; readonly reward_window_days: number; readonly promotion_last_day?: Day;
  /** A seat's monthly price, which is also what a seat brings a month; the lines that print it are left out where none is sent. */
  readonly seat_price?: number;
};
/**
 * A friend an invitation brought, as `/invitations` serves it: the coupon it took, absent for a friend past the coupons, who had the
 * direct trial; the friend's address masked where the platform knows it; and whether the reward is still to be earned (by `reward_by`),
 * arrived, or will not come.
 */
export type Coupon = {
  readonly slot?: number; readonly friend?: string; readonly signed_up_on: Day; readonly reward_by?: Day;
  readonly reward: "waiting" | "landed" | "none"; readonly rewarded_on?: Day; readonly reward_ends_on?: Day;
};
/** The account's invitation link while it is a member, and the friends it brought, newest news first. */
export type Invitations = { readonly link?: string; readonly coupons: readonly Coupon[] };
/** The payment provider's word on a payment or a card confirmed in the page. */
export type PayAnswer = { readonly state: "paid" | "saved" | "checking" | "open" } | { readonly state: "refused"; readonly code: string };
/** The element a form's fields are drawn into, named by what is asked of it: this module is also read where there is no page. */
export type FormBox = { replaceChildren(...nodes: unknown[]): void };
/** The provider's form for one session: the total it will take, as it prints it, its fields drawn into a box, and the confirm. */
export type PayForm = {
  readonly total: { readonly text: string; readonly minor: number };
  mount(box: FormBox): Promise<void>;
  /** Confirms with a saved card's id, or with what the fields hold; a way that leaves the page leaves before any answer. */
  pay(card?: string): Promise<PayAnswer>;
};
/** The spans 用量's spending is read by, in the menu's order: those that end now, then the calendar's. */
export const SPANS_NOW = ["m15", "m30", "h1", "h3", "h24", "h48", "d7", "mo1", "y1"] as const;
export const SPANS_CALENDAR = ["today", "yesterday", "week", "lastWeek", "month", "lastMonth", "year", "lastYear"] as const;
export type SpanId = (typeof SPANS_NOW)[number] | (typeof SPANS_CALENDAR)[number];
export type Step = "minute" | "five_minutes" | "hour" | "day" | "month";
export type SpendKind = "model" | "source" | "box_time" | "box_storage";
export type ByKind = Readonly<Record<SpendKind, number>>;
/** A line of a span's spending: a model's provider, a data source by its name, or cx's computer; a model whose provider was not known has no name. */
export type SpendLine = { readonly kind: SpendKind; readonly name?: string; readonly units: number };
/**
 * `GET /account/spending` as the platform answers it: the span's days, and under a day its minutes on the seller's clock; the total, by
 * kind and by line, the most first; `other` where the lines from its `from` on fold into 其他; and each part of the span that spent, by its `at`.
 */
export type SpanSpending = {
  readonly span: SpanId; readonly step: Step; readonly first_day: Day; readonly last_day: Day; readonly from?: string; readonly to?: string;
  /** The zone the answer was asked in, where the browser's own was refused: its days and clocks are that zone's. Not served; the asker knows it. */
  readonly zone?: string;
  readonly total: number; readonly kinds: ByKind;
  readonly lines: readonly SpendLine[];
  readonly other?: { readonly from: number; readonly units: number };
  readonly bars: readonly { readonly at: string; readonly total: number; readonly kinds: ByKind; readonly lines: readonly { readonly line: number; readonly units: number }[] }[];
};
/** One entry of 余额记录 as the platform answers it, newest first: a lot that came with no payment, or a top-up once it is gone. */
export type RecordEntry = {
  readonly kind: LotKind; readonly landed_on: Day; readonly units: number; readonly debt_repaid: number; readonly paid_from_balance: boolean;
  readonly invited?: { readonly by?: string };
  readonly done?: { readonly how: "used_up" | "ended"; readonly on: Day; readonly left: number };
};

/**
 * One source's calendar month as the ledger has it: the month's first instant, the platform units settled, the last settlement's time,
 * and the supplier's own figure where every settlement that month stated one in the same unit.
 */
export type SourceMonth = { readonly since: number; readonly spent: number; readonly lastAt?: number; readonly native?: { readonly amount: number; readonly unit: string } };

/**
 * What a plugin says of itself to a person deciding whether to turn it on: a line for its card, and the fuller account behind it. They
 * are the plugin's words, not the interface's, so they arrive as data — with a column per language, as the interface's own table has.
 */
export type Words = Readonly<Record<Language, string>>;
export type Told = { readonly about: Words; readonly description: Words };

export type Source = Told & {
  readonly name: string;
  readonly supplier: string;
  readonly nativeUnit: string;
  /** Platform units per native unit: the source's one conversion. Absent for a source that costs nothing, whose price is not drawn. */
  readonly unitsPerNative?: number;
  /** What one request of each kind costs, in native units, as the source's manifest declares it. */
  readonly aspects: readonly { readonly aspect: string; readonly native: number; /** The kind of request in a person's words, where the pages hold them. */ readonly words?: Words }[];
  readonly enabled: boolean;
  /** Platform units this tenant has spent at the source. */
  readonly spent: number;
  /** What was settled at the source this calendar month, from the ledger; absent where the platform could not read it. */
  readonly month?: SourceMonth;
  /**
   * What the source's manifest states and `GET /sources` does not carry yet: its version and how old each kind of purchase may be.
   * Each is drawn only where the answer has it.
   */
  readonly version?: string;
  readonly freshness?: Readonly<Record<string, string>>;
  /** The most one raw request beyond the declared kinds may cost, in native units, as the manifest bounds it. */
  readonly rawBound?: number;
  /** Paying with the person's own account at the supplier, where the source offers it; whether a key is held. A held key is never read back. */
  readonly ownKey?: { readonly held: boolean };
  /** The fields the source takes as the person's own, as `/sources` lists them, each with whether it is saved; never a value. */
  readonly fields?: Readonly<Record<string, boolean>>;
  /**
   * The person's connections at a source that takes them, each a store's name and its region, as `/sources` lists them: no region for a
   * store whose region Amazon has not answered yet, and none for a source's one grant, which every region takes.
   */
  readonly connections?: readonly StoreConnection[];
  /** The fields a connection is saved with, each with whether it is secret, as the source declares them. */
  readonly connectionFields?: readonly { readonly name: string; readonly secret: boolean }[];
  /** The regions a connection may be saved for, in the source's order. */
  readonly regions?: readonly string[];
  /** A source with no stores whose own fields one read checks, which turns it on where it passes: its Settings save them in one form. */
  readonly checksFields?: true;
  /** Those of such a source's fields that are secret: typed hidden. */
  readonly secretFields?: readonly string[];
  /** Present where the source's connections are grants, every region's, each reaching the accounts Amazon lists, and naming no store. */
  readonly grants?: true;
  /** Present where the source's own fields are held as client pairs, any number to the account, each connection under one. */
  readonly paired?: true;
  /** At such a source, the pairs held, `first` first, each by the name the platform made and the values of its fields that are not secret. */
  readonly pairs?: readonly SourcePair[];
};
/** A client pair as `/sources` lists it: its name, never shown, and the value of each of its fields that is not secret, such as its Client identifier. */
export type SourcePair = { readonly name: string; readonly fields: Readonly<Record<string, string>> };
/** The pair a connection of a paired source belongs to where `/sources` names none: the account's first. */
export const FIRST_PAIR = "first";
/**
 * One thing a connection's last check reached, as the platform lists it: its country as ISO 3166 names it, its id at the supplier, its
 * name there, and the region whose host listed it where the gate names one; a store's reach is its own region's.
 */
export type GrantAccount = { readonly country: string; readonly profile: string; readonly name: string; readonly region?: string };
/**
 * A connection as `/sources` lists it; a source's one grant with the accounts its last check listed, where the gate kept them, the regions
 * whose host did not answer that check, and whether Amazon refused it. At a paired source, the pair it belongs to, where not the first.
 */
export type StoreConnection = {
  readonly store: string; readonly region?: string; readonly accounts?: readonly GrantAccount[];
  readonly pair?: string; readonly silent?: readonly string[]; readonly refused?: true;
};
/**
 * What the supplier said to the one read a saved connection is checked with: that it works, or its refusal in its own words. `none` is
 * a connection that works and reaches nothing in any region.
 */
export type ConnectionCheck = { readonly ok: true; /** The name the platform made for the connection, where it made one. */ readonly connection?: string } | { readonly ok: false; readonly words: string; readonly none?: true };
/**
 * What a save of a source's own fields came to: the check passed; the supplier refused it, in its words; the gate refused one field's
 * value by its rule, `field` naming it, in the gate's words, which name the field and never the value; or a field is not saved yet.
 */
export type FieldsCheck = { readonly ok: true } | { readonly ok: false; readonly words: string; readonly field?: string; readonly missing?: true };

/**
 * This month's money: the credit that landed in the month — the base the low-balance warnings are a share of — and what was spent,
 * by what it was spent on.
 */
/** `boxStorage` is what the computer's disk was debited, a day at a time, apart from the time it ran. An organization's member is given their own model and source spending alone: no credit, hours or storage. */
export type Spending = { readonly credited?: number; readonly spent: { readonly model: number; readonly sources: number; readonly boxTime?: number; readonly boxStorage?: number } };

/**
 * `via` names the person's own credential a model comes through; a model without one is the platform's. `aggregator` says its provider
 * serves other makers' models and names the maker ahead of the model id, as the box's catalogue marks the provider.
 */
export type Model = {
  readonly provider: string; readonly id: string; readonly name: string; readonly via?: string; readonly aggregator?: true;
  /** Which of the person's credentials `via` names, where the answer says; without it the provider's own records say. */
  readonly own?: "key" | "account";
  /** The series the model is a version of, where the vendor's models are offered by series. */
  readonly series?: string;
  /** On the card's offer: the id of that series, which a pick of the row names, and whether the person pinned this version of it. */
  readonly seriesId?: string;
  readonly pinned?: true;
  /** What the balance pays for it per million tokens in and out, in platform units, the platform's margin included; absent where the balance does not serve it. */
  readonly price?: { readonly input: number; readonly output: number };
  /** The thinking levels pi offers on it, in pi's order, as the platform works them out from the box's catalogue; absent where it lists none. */
  readonly thinkingLevels?: readonly string[];
};
/** A model a provider serves, and whether the person has it among the models the composer offers. */
export type Served = { readonly id: string; readonly name: string; readonly shown: boolean };
export type Models = {
  readonly current: { readonly provider: string; readonly id: string; readonly name?: string } | undefined;
  readonly available: readonly Model[];
  /** The platform's default model — what a session starts on, and what the card's default row returns to; absent when the platform named none. */
  readonly default?: { readonly provider: string; readonly id: string };
  /** pi's thinking level in the conversation, by pi's own name, as the same `get_state` says it; absent while no pi answered. */
  readonly thinkingLevel?: string;
  /** The levels pi offers for the model in use, in pi's order, as its `get_available_thinking_levels` answers beside that `get_state`. */
  readonly thinkingLevels?: readonly string[];
};
/** What the account's list says of the thinking level: the entry still waiting for the box, and how the box ended the last one. */
export type RowThinking = {
  readonly waiting?: { readonly id: string; readonly level: string };
  readonly end?: { readonly level: string; readonly ok: boolean; readonly reason?: string };
};
/** Whether a model is the platform's default, which the page never names: wherever the page would name that model, it says Default. */
export const isDefault = (model: { readonly provider: string; readonly id: string } | undefined, fallback: Models["default"]): boolean =>
  model !== undefined && fallback !== undefined && model.provider === fallback.provider && model.id === fallback.id;
/**
 * A model provider a person may hold a key of their own for, and the platform may hold one for: a way of showing whose key pays, not a
 * package — nothing here is installed or removed. A held key pays for the provider's models except the configured platform default.
 * A held key is never read back.
 */
export type Provider = {
  readonly id: string; readonly name: string; readonly platformKey: boolean; readonly ownKey: boolean;
  /** The preview's model checklist; the live page offers only models already in pi's available catalog. */
  readonly models: readonly Served[];
  /** What the platform's key charges per million tokens, in platform units, for each model it serves here; none where it serves none. */
  readonly rates: readonly { readonly model: string; readonly input: number; readonly output: number }[];
};
/** A provider a person signs in to with an account of their own there — a subscription — instead of a key. The provider bills it. */
export type Account = {
  readonly id: string; readonly name: string; readonly signedIn: boolean; readonly models: readonly Served[];
  /** What a sign-in here ended with, in the provider's words, until the person signs in again. */
  readonly ended?: string;
};
/** What a sign-in under way hands the page: each step as it comes. `signal` ends the sign-in. */
export type SignInPorts = { readonly heard: (step: SignInStep) => void; readonly signal?: AbortSignal };
/** A message the platform did not keep: the open it asked for it was refused or failed, and this is what that open came to. */
export class Unopened extends Error {
  constructor(readonly opened: Exclude<Opened, { readonly kind: "open" } | { readonly kind: "opening" }>) { super("the open asked for the message was not made"); }
}
/** A command the box was not there to take: not running, closing, or with its control not up yet. pi never saw it. */
export class NotRunning extends Error {
  constructor() { super("the box was not there to take the command"); }
}
/** A command pi answered and refused: `words` are pi's own reason, where it gave one. */
export class Refused extends Error {
  constructor(readonly words?: string) { super("command refused"); }
}
/**
 * A sign-in that did not end signed in, or never began: `busy`, `crowded` and `too_often` are the platform's refusals to begin one.
 * `words` are pi's own for one its flow refused; `minutes` how long one that timed out stood.
 */
export class SignInEnded extends Error {
  constructor(
    readonly reason: "refused" | "cancelled" | "timed_out" | "unavailable" | "bad_paste" | "busy" | "crowded" | "too_often",
    readonly words?: string, readonly minutes?: number,
  ) { super(reason); }
}
/** What a package states of itself and the page reads from it, never from a record: where its code can be read. */
export type Shipped = { readonly home?: string };
/**
 * A package cx's computer lists among the person's own. `source` is the list's own word for it, which every click and the README name
 * it by. A package that states no version has an empty one; one that says nothing of being off is on.
 */
export type Package = Told & Shipped & {
  readonly name: string; readonly version: string; readonly source: string; readonly enabled?: boolean; readonly author?: string;
  /** Listed, and its files are not on cx's computer: pi lists it and loads nothing of it until it is installed again. */
  readonly missing?: true;
};
/** A package the image carries and the person has not installed: the source an install names, and what the package states of itself. */
export type OnImage = Shipped & { readonly name: string; readonly source: string; readonly version?: string };
/** A change to cx's packages as the platform wrote it down: the answer to a click, and what the list says still waits. */
export type Click = { readonly id: string; readonly op: "install" | "remove" | "off" | "on" | "update"; readonly source: string };
/** A click as its write was answered: the entry, and beside it the account row's whole waiting list as the write left it, where the answer carried one. */
export type Written = Click & { readonly waiting?: readonly Click[] };
/** How the last click on a source ended, as the list keeps it until the next click on that source. */
export type ClickEnd = { readonly op: Click["op"]; readonly source: string; readonly ok: boolean; readonly reason?: string; /** pi's own words on a failure: the end of what it wrote to stderr. */ readonly detail?: string; readonly at: number };
/**
 * What cx's computer holds, and what the platform holds beside it. `asleep` is a list the platform kept for a computer that is not
 * there. `waiting` and `ends` are absent where the platform could not read what it keeps: such a list says nothing of any click.
 */
export type PackageList = {
  readonly packages: readonly Package[]; readonly onImage: readonly OnImage[]; readonly asleep: boolean;
  readonly waiting?: readonly Click[]; readonly ends?: readonly ClickEnd[]; readonly awake?: Awake;
};
/**
 * 保持开机 as the list says it: `on`, the account's value as the platform holds it, absent where it could not be read; `waiting`, the
 * value of a switch handed to a computer whose image keeps its own clock and has not yet taken it; `refused`, that it refused the last.
 */
export type Awake = { readonly on?: boolean; readonly waiting?: boolean; readonly refused?: true; readonly minutes?: number };
/** What a press's answer said of the switch: `on`, the value the platform wrote, and the account's idle minutes; nothing is returned for an answer that says none. */
export type AwakeRow = { readonly on?: boolean; readonly waiting?: boolean; readonly minutes?: number };
/** The idle minutes a seller may type, and the times offered as options (decision D227: the platform counts them). */
export const IDLE_MINUTES = { least: 5, most: 480, first: 10, offered: [10, 30, 60] } as const;
/**
 * A bundle the account pressed, as its row keeps it until the bundle's Remove: the bundle's id, when it was last pressed, when it was
 * first pressed, and the npm names of what its presses brought. A plugin the seller had before a press is not in it. `since` equal to
 * `at` says the last press was the bundle's first; a record with no `since` was pressed before. `shown` is the npm names of the members
 * the seller has been shown, by the press or by the feature card; a member past them is new to the seller.
 */
export type HeldBundle = { readonly bundle: string; readonly at: number; readonly since?: number; readonly brought: readonly string[]; readonly shown?: readonly string[] };
/** What `/me` says of the account's bundles: the presses it keeps. */
export type BundleState = { readonly held: readonly HeldBundle[] };
export const NO_PACKAGES: PackageList = Object.freeze({ packages: [], onImage: [], asleep: false });
/** The list was not read because cx's computer is not set up yet — the platform holds it for a free place or for the account's money, or sets it up. */
export class ComputerPending extends Error { constructor() { super("box_pending"); } }
/** A package's README as the package ships it: the file's name and its text. */
export type Readme = { readonly name: string; readonly text: string };

/** pi's kinds of package, as the third-party list filters by them, and the orders the platform sorts that list in. */
export const NPM_KINDS = ["extension", "skill", "prompt"] as const;
export type NpmKind = (typeof NPM_KINDS)[number];
export const NPM_ORDERS = ["downloads", "recent", "name"] as const;
export type NpmOrder = (typeof NPM_ORDERS)[number];
/** What the list route answers at a time, and what "Show 24 more" adds. */
export const NPM_STEP = 24;
/**
 * A package of pi's gallery as npm's search finds it, read by the platform: the words its author wrote, its kinds by its keywords, who
 * published it, last month's downloads where npm counted them, and when it was last published.
 */
export type NpmListed = {
  readonly name: string; readonly description: string; readonly kinds: readonly NpmKind[]; readonly author?: string; readonly downloads?: number; readonly updated: string;
  /** Where its code is, as an https address: its repository, else its homepage. */
  readonly repository?: string;
  /** Its own homepage, an https address, where npm holds one. */
  readonly homepage?: string;
};
/**
 * The gallery's two sections: `comchatx`, a package made for ComChatX by someone else, which its search entry says by the keyword
 * `comchatx`; `pi`, the rest of pi's gallery. Ours are in neither: the catalogue draws them.
 */
export type NpmSection = "pi" | "comchatx";
/** One step of the list: the packages from where it was asked, how many the list holds in all, and when the platform read npm. */
export type NpmList = { readonly packages: readonly NpmListed[]; readonly total: number; readonly read_at: string };
/**
 * A package's own page as npm's record has it: the version, where its code is, its README and whether npm cut that, and whether it is
 * ours; what it ships at that version, read from its files (`shipped`); and `uses`, what it depends on that is a plugin, ours or the
 * gallery's, by npm name.
 */
export type NpmPackage = NpmListed & {
  readonly version: string; readonly readme: string; readonly readme_cut: boolean; readonly ours: boolean;
  /** Its manifest carries no `pi` object, as the platform read it: a library, drawn on no card. */
  readonly library?: true;
  /** Its own `comchatx` field, what the page needs that npm does not say: for ours (`ourRecord`), and for one made for ComChatX by someone else, where it stands (`declaredBy`). */
  readonly comchatx?: Readonly<Record<string, unknown>>;
  readonly shipped: Files;
  readonly uses: readonly string[];
};
/**
 * Why a click on a package did not go through, as the rejection's message: how cx's computer ended it, or what the platform refused it
 * with before writing it down. `box_unreachable` is a platform with no row to write in passing the click on and not reaching the
 * computer. Any other message is a failure with no reason of its own.
 */
export const PACKAGE_REFUSALS = ["pi_failed", "timed_out", "not_listed", "single_file", "readme_too_large", "box_unreachable", "waiting_full", "sources_unavailable"] as const;
export type PackageRefusal = (typeof PACKAGE_REFUSALS)[number];
export const refusalOf = (error: unknown): PackageRefusal | undefined => PACKAGE_REFUSALS.find((one) => error instanceof Error && error.message === one);
/**
 * A model plugin the person has: whether it is on, the ways connected in the order cx uses them (the first that can answer answers), and
 * what the month spent through the person's balance on its models, absent where nothing records it.
 */
/** A model plugin the person holds; one removed this month stays in the answer as `installed: false`, so the month keeps what was spent there. */
export type ModelPlugin = { readonly id: string; readonly enabled: boolean; readonly ways: readonly Way[]; readonly month?: number; readonly installed?: false };
/** A package of the person's own handed to cx's computer: a file, a link pi can install from, or both as the card's two fields hold them. */
export type Upload = { readonly file?: File; readonly link?: string };
/**
 * One version of a chat series: what the balance pays per million tokens in and out, in platform units, where the balance lists it; and
 * the ways that list it, in the order the person's ways are used, the first serving it. A version naming none is listed by every way.
 */
export type Version = { readonly id: string; readonly name: string; readonly input: number; readonly output: number; readonly ways?: readonly Way[] };
/**
 * A vendor's chat series, which a person follows in place of a version. `versions` are newest first, so the first is the latest;
 * `pinned` is the version's id the person holds the series at, absent while it follows the latest. `inChat` says the chat's model picker
 * offers it.
 * `gone` names the version a pin holds that is no longer offered: the series uses its latest meanwhile, and the pin is kept. `maker` is
 * whose series it is, on a host's card such as OpenRouter's, whose series are many makers'.
 */
/**
 * A vendor's chat series. `listed` marks one of the vendor's own catalogue that no way of the person's reaches yet: drawn, never ticked,
 * and on no road a model is chosen by.
 */
export type Series = { readonly name: string; readonly versions: readonly Version[]; readonly inChat: boolean; readonly pinned?: string; readonly gone?: string; readonly maker?: Maker; readonly listed?: true };
/**
 * What chat offers where the record keeps series: the vendors on the card, in their order, and the models their ticked series are on now,
 * each named by its series; and the vendors holding chat's places, the turned-off ones among them.
 */
export type ChatOffer = { readonly vendors: readonly string[]; readonly models: readonly Model[]; readonly places: readonly string[] };
/** Every vendor's chat series by the vendor's plugin id, held or not; a vendor with no series is absent. */
export type SeriesByVendor = Readonly<Record<string, readonly Series[]>>;
/** The version a series is on now: the one pinned, else the latest; none for a series with no version. */
export const versionInUse = (series: Pick<Series, "versions" | "pinned">): Version | undefined => series.versions.find((version) => version.id === series.pinned) ?? series.versions[0];
/** A run of a life's stored entries as the platform gives it: `from` is its first place, and `earlier` says entries lie before it. */
/** The part before what a page holds: its entries, where it begins, whether more is stored before it, and the charges of its turns. */
export type EarlierPart = { readonly epoch: string; readonly entries: readonly unknown[]; readonly from: number; readonly earlier: boolean; readonly charges?: readonly unknown[] };

/** The place of one of the person's messages, when it was said, and its first line. */
export type HistoryLine = { readonly at: string; readonly time: number; readonly line: string };
/** A stretch of the conversation cx titled, from the message that began it; `title: null` is the person's messages before the first title. */
export type HistoryRow = { readonly at: string; readonly id: string; readonly time: number; readonly title: string | null; readonly messages: readonly HistoryLine[] };
/**
 * A stretch whose title, or whose seller's messages or cx's answers, hold the words searched for: each matching message or answer, whose
 * words it holds (`who`), with the words around the match. `byTitle` is the platform's word that the title itself holds them; the page
 * matches nothing a second time.
 */
export type FoundRow = { readonly at: string; readonly id: string; readonly time: number; readonly title: string | null; readonly byTitle: boolean; readonly matched: readonly { readonly who: "seller" | "cx"; readonly at: string; readonly time: number; readonly stretch: string }[]; readonly span?: Span };
/** The first and last time of the seller's messages a row holds, which the platform gives a found row with no title. */
export type Span = { readonly from: number; readonly to: number };
/**
 * Part of a list of one life, newest first: `next` is the place to read on from, and only there when more lies before. No count is given.
 * `titled: false` is the platform's word that the account's packages do not load cx-topics: History is the one row of every message,
 * and no title the live view hears joins it.
 */
export type ListPart<T> = { readonly epoch: string; readonly items: readonly T[]; readonly next?: string; readonly titled?: false };
/** The stretch of a life that holds a place, whether anything is stored after it, and the charges of its turns. */
export type Stretch = EarlierPart & { readonly later: boolean };

/**
 * A part of the board (`parts/cx-board.md`): whether the account's packages show it, and the files of one tab, newest first, with `next`
 * naming where a later part starts. `keptAt` says the part is the one kept from when cx's computer was last asked, while it sleeps.
 */
export type BoardRead = {
  readonly shown: boolean;
  /** The tab the part is of, and the person's tabs by name as the box read them, where it said. */
  readonly tab?: string;
  readonly tabs?: readonly string[];
  /** The tabs that hold a page, and who made each. */
  readonly pages?: BoardPages;
  readonly entries: readonly BoardEntry[];
  readonly next?: string;
  readonly keptAt?: number;
};

/** A tab's page as the platform answers it: its HTML, who made it, and the ready-made elements where the installed base carries them. */
/** A page's ask of its own tab the platform refused, by the platform's word for why: `box_not_running`, `too_large`, `no_file`, … */
export class BoardRefused extends Error {
  /** `now`: the cards a board holds now and the newest one's time, where a delete was refused because it changed since the seller was shown it. */
  constructor(readonly reason: string, readonly now?: { readonly n: number; readonly newest: number }) { super(reason); this.name = "BoardRefused"; }
}
/** A board of the base's own made, renamed or deleted, as `POST /board/tab` takes it; a delete names what the seller was shown it holds. */
export type BoardTabAsk =
  | { readonly op: "make"; readonly tab: string }
  | { readonly op: "rename"; readonly tab: string; readonly to: string }
  | { readonly op: "delete"; readonly tab: string; readonly n: number; readonly newest: number };
/** A file of the tenant tree a viewer draws, as `/board/open` read it: its words, or its bytes in base64 for a viewer that takes them. */
/** `tab` and `file` where the file is a card its tab's own page draws: the page asks for that tab, and names the card by its path in it. */
export type OpenedFileBody = { readonly path: string; readonly name: string; readonly size: number; readonly modified: number; readonly text?: string; readonly bytes?: string; readonly tab?: string; readonly file?: string };
/** A tab's page; `opened` where it draws one file of the tree, a viewer handed it or an HTML file that is the page itself. */
export type BoardPageRead = { readonly html: string; readonly by: PageMaker; readonly kit?: { readonly css: string; readonly js: string }; readonly opened?: OpenedFileBody };
/** Where a file was pressed, as `/board/open` logs it. */
export type OpenedFrom = "chat" | "card" | "page";
/**
 * A file of the tenant tree read for its own tab, as `/board/open` answers: its words or bytes, and the kit for an HTML file that is its
 * own page; too large, with its size and time; gone; cx's computer off; or not read.
 */
export type OpenRead =
  | { readonly kind: "file"; readonly size: number; readonly modified: number; readonly text?: string; readonly bytes?: string; readonly kit?: { readonly css: string; readonly js: string } }
  | { readonly kind: "large"; readonly size: number; readonly modified: number }
  | { readonly kind: "gone" | "off" | "unreadable" };
/** The page a package declares for a kind of file, as `/board/viewer` answers; `bytes` where it takes the file's bytes. */
export type BoardViewer = { readonly html: string; readonly by: PageMaker; readonly kit?: { readonly css: string; readonly js: string }; readonly bytes?: true };
/** Which tabs hold a page, as a part of the board says, and who made each. */
/** The tabs that hold a page: each by its maker, and by the name in each language its package gives it, where it gives one. */
export type BoardPages = readonly { readonly tab: string; readonly by: PageMaker; readonly name?: BoardLabel }[];

/** What the composer held when the page left to renew the session: its text, and a message the platform refused for the lapsed session. */
export type Carried = { readonly draft: string; readonly unsent?: string };
/** How a sign-out went: the session ended and the browser is being sent on, or the pages left to renew the session first and post again on return, the person still signed in. */
export type Left = "ended" | "renewing";

/**
 * Everything the pages ask of the world. The canned backend answers from recordings and placeholders; the platform backend is the
 * next segment's, and each method without a platform route today is a route that segment owes.
 */
export interface Backend {
  readonly features: Features;
  me(): Promise<Me>;
  /**
   * Makes the person's box and its session ready to be streamed and commanded, or says why not. `carrying` names the message waiting on
   * the open, when there is one: a 401 carries it through the renewal as a message whose own command was refused.
   */
  open(carrying?: () => string | undefined): Promise<Opened>;
  /**
   * Puts the person's box to sleep by its own close; `busy` while pi is at work, which the box refuses; `unanswered` when the request ended
   * with no word from the box (the platform's 502 `box_unreachable`, or the connection ending), so a close it began may still run; rejects
   * when the platform answered that no close was made.
   */
  close(): Promise<"closed" | "busy" | "unanswered">;
  /**
   * Restarts the person's box on the platform's image: the box's own close, then the open, both on the platform, so a page that leaves
   * meanwhile still finds it on. `busy` while pi is at work; rejects when the restart did not end with the box on.
   */
  restart(): Promise<"restarted" | "busy">;
  /**
   * Opens the stream from a cursor; the return closes it. `broken` is called once when the connection fails without the platform's `end`
   * frame; after it, and after an `end`, this connection hears nothing more.
   */
  stream(since: string | undefined, listener: (event: StreamEvent) => void, broken: () => void): () => void;
  /** The part of a life stored before a place in it: the chunk that ends just before it, oldest first; no entries when none is earlier. */
  history(epoch: string, before: number): Promise<EarlierPart>;
  /** The stretch of the life that holds a place, `<epoch>:<seq>`: the chunk it falls in, or what is stored past the last chunk, within the newest part's bound. */
  historyAt(place: string): Promise<Stretch>;
  /** A life's titled stretches before a place, newest first: the newest when none is named. The answer names the life it is of. */
  topics(epoch: string, before?: string): Promise<ListPart<HistoryRow>>;
  /** A life's stretches whose titles, or whose seller's messages or cx's answers, hold the words, newest first, each match saying whose words. */
  search(epoch: string, words: string, before?: string): Promise<ListPart<FoundRow>>;
  /** A part of the board's place, the newest when none is named. Rejects when no part can be read: cx's computer asleep with none kept, or the platform's failure. */
  /** A part of a tab of the board: 待办 where none is named. */
  board(before?: string, tab?: string): Promise<BoardRead>;
  /**
   * Where a board's page is drawn, the second site the platform names: absent, no page is drawn, and a board that holds one is drawn as
   * its cards (`parts/board-page.md` §1).
   */
  readonly pagesOrigin?: string | undefined;
  /** A tab's page, who made it and the ready-made elements, as `GET /board/page` answers it; rejects where there is none or it cannot be read. */
  boardPage?(tab: string): Promise<BoardPageRead>;
  /** A file of the tenant tree, read where it is for its own tab (`GET /board/open`); `bytes` for a viewer that takes them. */
  boardOpen?(path: string, from: OpenedFrom, bytes: boolean): Promise<OpenRead>;
  /** The viewer an installed package declares for a kind of file, or none, which the board draws as its own row; rejects where unread. */
  boardViewer?(kind: string): Promise<BoardViewer | undefined>;
  /** The open files' sizes and times (`GET /board/opened`); rejects where unread. */
  boardOpened?(paths: readonly string[]): Promise<readonly OpenedFile[]>;
  /** A page's own tab's files, as `GET /board/files` answers them; rejects with `BoardRefused` naming why. */
  boardFiles?(tab: string): Promise<readonly BoardFileRow[]>;
  /** One file of a page's own tab, its words, as `GET /board/file` answers it; rejects with `BoardRefused` naming why. */
  boardFile?(tab: string, file: string): Promise<string>;
  /** One file written in a page's own tab, as `POST /board/write` does it; rejects with `BoardRefused` naming why, the box asleep among them. */
  boardWrite?(tab: string, file: string, text: string): Promise<{ readonly modified: number; readonly size: number }>;
  /** A board of the base's own made, renamed or deleted on a running box (`POST /board/tab`); rejects with `BoardRefused` naming why. */
  boardTab?(ask: BoardTabAsk): Promise<void>;
  /** Whether the page came with the platform's word that the request carried a session: the frame is drawn before the account answers. */
  signedInHint(): boolean;
  /**
   * A pi command, as `POST /command` takes it; pi's answer, with the moment the box passed a message on (`sentAt`) when it was one, or
   * `{ held }` for a message the platform keeps for a box that was not there. Rejects with `Unopened` when the open asked for it was not made.
   * `hold` is the page's id for a message, under which the platform keeps it if the box is not there.
   */
  command(command: Readonly<Record<string, unknown>>, hold?: string): Promise<unknown>;
  /** Takes a message the platform keeps out of its keeping: `back` when it was still there, `taken` when the box had taken it. */
  takeBack(id: string): Promise<"back" | "taken">;
  sources(): Promise<readonly Source[]>;
  models(): Promise<Models>;
  /** The models the platform's key serves this account, as `/me`'s `served_models` names them: all a trial's balance pays for. */
  platformModels(): Promise<readonly { readonly provider: string; readonly id: string }[]>;
  /** Rejects when the platform's list of keys cannot be read, so a caller keeps what it last read or says the list is unknown. */
  providers(): Promise<readonly Provider[]>;
  saveOwnKey(provider: string, key: string): Promise<void>;
  removeOwnKey(provider: string): Promise<void>;
  accounts(): Promise<readonly Account[]>;
  /** Resolves signed in; rejects with `SignInEnded` otherwise. A sign-in that asks the person anything is heard through `steps`. */
  signIn(account: string, steps?: SignInPorts): Promise<void>;
  /** The person's answer to a step of the sign-in under way at the account; false when it was not taken. */
  answerSignIn(account: string, id: string, answer: DialogAnswer): Promise<boolean>;
  signOut(account: string): Promise<void>;
  /** Whether the composer offers a model of a provider the person brought, by the way they brought it. */
  showModel(way: "key" | "account", provider: string, model: string, shown: boolean): Promise<void>;
  /**
   * The vendors the person ticked for the model card's places, in the order ticked; none recorded — never ticked, or no record to read —
   * leaves the card to the first five as they are listed.
   */
  vendors(): Promise<readonly string[] | undefined>;
  /** Records the ticked vendors, at most five, in their order. */
  setVendors(vendors: readonly string[]): Promise<void>;
  /** Whether the person said "Don't show again" to the rule cx buys by, as their card choices keep it. */
  ruleSeen(): Promise<boolean>;
  /** Keeps in the person's card choices that they need not be told the rule again. */
  seeRule(): Promise<void>;
  /** The model chosen and not yet taken by pi, kept by the platform for the next message; none when nothing waits. */
  pendingPick(): Promise<PendingPick | undefined>;
  /**
   * Chooses a model: a running box takes it (`taken`); otherwise the platform keeps it for the next message (`pending`), and no box is
   * woken for it. Rejects with `model_not_allowed` for a model the account may not use, `model_refused` when pi would not switch, and
   * otherwise with the failure.
   */
  pick(pick: PendingPick): Promise<"taken" | "pending">;
  /** Hears what became of a pending pick at a message, which the platform hands to the box first: `taken`, or the refusal's code. */
  onPickOutcome(listener: (outcome: PickOutcome) => void): void;
  /** The thinking level waiting in the account's list, and the end the box last gave one, read with the pending pick. */
  pendingThinking(): Promise<RowThinking>;
  /** 保持开机 as the account's row holds it, read with the pending pick and never from cx's computer; none where the row could not be read. */
  keptAwake(): Promise<Awake | undefined>;
  /** Chooses pi's thinking level: the platform keeps it in the account's list for the box, whatever the box is doing, and answers the entry it became. */
  chooseThinking(level: string): Promise<{ readonly id: string; readonly level: string }>;
  /**
   * The list. Rejects where no list can be read — with the computer's own reason where it answered that it could not list, else with
   * the platform's word or the status.
   */
  packages(): Promise<PackageList>;
  /** The plugins and bundles offered: the repository's catalogue, and in the preview its examples beside it. */
  catalogue(): Promise<Catalogue>;
  /** Hands cx's computer a package of the person's own to check and install, and answers the name cx's computer lists it by. */
  uploadPlugin(upload: Upload): Promise<string>;
  /**
   * Asks for a package to be installed or removed, by the source the list names it by, and answers the entry the platform wrote down:
   * the change itself is said by a later list. Rejects with a `PackageRefusal` as its message where the refusal has a reason of its own.
   */
  installPackage(source: string, installed: boolean): Promise<Written>;
  /**
   * A bundle's press, one click: an install of each source, a needed one before what needs it, each one of the bundle's members, written
   * down whole or not at all with the account's record of what the press brought. Answers the entries; refused as an install is.
   */
  pressBundle(bundle: string, sources: readonly string[]): Promise<readonly Written[]>;
  /** A bundle's Remove, one click: a remove of each source, each one of the bundle's members, whatever its presses brought. Answered and refused as a press is. */
  removeBundle(bundle: string, sources: readonly string[]): Promise<readonly Written[]>;
  /** What `/me` says of the account's bundles; rejects where it could not be read. */
  bundleState(): Promise<BundleState>;
  /** Marks a held bundle's members of today as shown to the seller, once its feature card's page was left. */
  showBundle(bundle: string): Promise<void>;
  /** Asks for a package to be switched on or off; answered and refused as an install is. */
  setPackage(source: string, enabled: boolean): Promise<Written>;
  /** Asks pi to update a package to npm's newest version, as `pi update` does; answered and refused as an install is. */
  updatePackage(source: string): Promise<Written>;
  /**
   * 取消 in the queue: takes a waiting click back by its id. `started` where cx's computer runs it or has ended it, `gone` where nothing
   * waits by that id; rejects where the platform or the computer cannot say, the click left as it was.
   */
  cancelClick(id: string): Promise<"cancelled" | "started" | "gone">;
  /** 取消 on a failed row: the failure the list keeps for a source leaves it, with no click written. */
  forgetFailure(source: string): Promise<void>;
  /** A package's README by its source, none where it ships none; rejects with `readme_too_large` for one too large to carry. */
  readme(source: string): Promise<Readme | undefined>;
  /**
   * One step of pi's gallery, of a kind or all, in an order, from a place in it, narrowed to the packages a search's words find where
   * `sought` is given; rejects with `npm_unreachable` where no list is to hand.
   */
  npmPackages(kind: NpmKind | "all", order: NpmOrder, from: number, section?: NpmSection, sought?: string): Promise<NpmList>;
  /** One package of pi's gallery by its npm name, at its newest version or at `version`; rejects with `unknown_package`, `npm_unreachable` where npm did not answer, or `npm_busy` where the platform did not ask npm now. */
  npmPackage(name: string, version?: string): Promise<NpmPackage>;
  modelPlugins(): Promise<readonly ModelPlugin[]>;
  installModel(id: string, installed: boolean): Promise<void>;
  setModel(id: string, enabled: boolean): Promise<void>;
  /** The ways a model plugin is reached, in cx's order of use. */
  setModelWays(id: string, ways: readonly Way[]): Promise<void>;
  /** The Feishu bot cx posts to, the empty string where the seller has none; the account's row is the record. */
  feishu(): Promise<string>;
  /** Saves the bot's webhook address; a box reads it at its next start. Rejects with the platform's word, `malformed` for no address of a bot. */
  saveFeishu(hook: string): Promise<void>;
  removeFeishu(): Promise<void>;
  /** A source's own key, where the source declares one field of its own: saved and checked as `saveSourceFields` does, a refusal rejecting with the gate's words. */
  saveSourceKey(name: string, key: string): Promise<void>;
  /** Clears every field the source takes as the person's own and turns it off. */
  removeSourceKey(name: string): Promise<void>;
  /**
   * Saves the fields given of a source that `checksFields`, each trimmed, in the given order, then asks its one check, which turns the
   * source on where it passes. A field saved before a refusal stays saved. Nothing saved is read back.
   */
  saveSourceFields(name: string, fields: Readonly<Record<string, string>>): Promise<FieldsCheck>;
  removeConnection(name: string, store: string): Promise<void>;
  /**
   * At a paired source: a new client pair with its first connection, in one request, each saved under a name the platform makes, then the
   * check; what does not pass is removed again, the pair with it. Answers the check; a pair not saved is a refusal with no words. Nothing
   * saved is read back.
   */
  addPair(name: string, sent: { readonly fields: Readonly<Record<string, string>>; readonly connection: Readonly<Record<string, string>> }): Promise<ConnectionCheck>;
  /** At a paired source: a connection under a pair the account holds, saved under a name the platform makes, then the check; the pair's fields are not sent again. */
  connectUnder(name: string, pair: string, connection: Readonly<Record<string, string>>): Promise<ConnectionCheck>;
  /** At a paired source: a pair removed with every connection under it. */
  removePair(name: string, pair: string): Promise<void>;
  series(): Promise<SeriesByVendor>;
  /** What the card offers, from the record's ticks and pins; none where the backend keeps no series, and the card reads vendor ticks. */
  chatOffer(): Promise<ChatOffer | undefined>;
  /** Puts a series of a held vendor in the chat's model picker, or takes it out; `full` where five other vendors hold the card's places. */
  setSeries(id: string, series: string, inChat: boolean): Promise<TickRefused | undefined>;
  /** Puts a held vendor in chat with these series, by their names, in one write; `full` where five other vendors hold the card's places. */
  addToChat(id: string, series: readonly string[]): Promise<TickRefused | undefined>;
  /** Takes a vendor out of chat: every tick of its series is cleared, one its ways no longer reach included; its pins are kept. */
  takeOut(id: string): Promise<void>;
  /** Holds a series at one of its versions, by the version's id; none follows the latest again. */
  pinSeries(id: string, series: string, version: string | undefined): Promise<void>;
  /** The moment the pages count days from: the clock, and in the preview the day its example world stands on. */
  now(): number;
  /** Ends the person's session with the platform, or every session of the account, and leaves the pages, or leaves to renew the session first; rejects when the session may not have ended. */
  /** Signs out, here or everywhere, and goes to the door, which says why by the sign-out's reason, or by `landing` where one is named. */
  /** Ends the sign-in; the door says why, or, given a work address, signs the person in under it (`DoorWork`). */
  leave(everywhere?: boolean, landing?: DoorReason | DoorWork): Promise<Left>;
  /** Leaves the pages for their own address, to start again as whoever is signed in now. */
  again(): void;
  /** The accounts this sign-in holds; none where the provider cannot say. */
  spaces(): Promise<Spaces | undefined>;
  /** Makes an organisation, or the person's own account (`null`), the one in use, then starts the pages again in it, as `again` does. */
  /** Switches the session to an organisation, or to the person's own; the page starts again there, or at `landing`. */
  use(organization: string | null, landing?: string): Promise<void>;
  /** Whether these pages were started by a switch of account; asking spends it. */
  switched(): boolean;
  /** Whether the pages are back from renewing the session only to sign out again; asking spends it. */
  leaving(): boolean;
  /** Names what the composer holds, for the backend to carry through a round trip that renews the session. */
  hold(draft: () => string): void;
  /** What the composer held when the page last left to renew the session; asking spends it. */
  carried(): Carried | undefined;
  readonly links: { readonly signIn: string; readonly help: string };
  /** The account's money as the ledger has it, every day in the seller's zone; asked with a top-up's dollars, its renewal with that top-up landed. Rejects where it could not be read. */
  accountMoney(topUp?: number): Promise<AccountMoney>;
  /** The membership as the payment provider holds it; rejects where it could not be read. */
  subscription(): Promise<Subscription>;
  /** What a span spent, summed by the seller's calendar; rejects where it could not be read. */
  spending(span: SpanId): Promise<SpanSpending>;
  /** The computer's processor, memory and storage over a span; rejects where they could not be read. */
  computerUsage(span: UsageSpan): Promise<Usage>;
  /** Sets the size the computer starts at next, answering the size it now has and its hourly cost; rejects where it was not changed. */
  resize(size: Size): Promise<{ readonly size: Size; readonly hourUnits: number }>;
  /** 余额记录; rejects where it could not be read. */
  record(): Promise<readonly RecordEntry[]>;
  /** Where a span's charges, and the record, are downloaded from, as files a spreadsheet opens. */
  spendingFile(span: SpanId): string;
  recordFile(): string;
  /** The figures of 条款; rejects where they could not be read. */
  terms(): Promise<Terms>;
  /** The account's invitation link and the sign-ups its coupons brought; rejects where they could not be read. */
  invitations(): Promise<Invitations>;
  /**
   * 保持开机 set, with the idle minutes beside it where a time is chosen: written down for cx's computer, which writes it into the tenant's
   * settings file now or at its next start; rejects where it was not written down.
   */
  setAwake(on: boolean, minutes?: number): Promise<AwakeRow | undefined>;
  /**
   * Asks for the account's deletion, which the platform carries out after; rejects where it was not asked. The session stays to be signed
   * out.
   */
  deleteAccount(): Promise<void>;
  /** Renames the organization the session has active, as its admin; the name kept, or a rejection where it was not. */
  renameOrganization(name: string): Promise<string>;
  /** The organization's members and its invitations not yet answered; rejects where they could not be read. */
  members(): Promise<Members>;
  /** Where the admin downloads the members, each one's name, address and role, as a file a spreadsheet opens. */
  membersFile(): string;
  /**
   * Invites the addresses with a role, as the admin. Where `seats` is given the organization's seats are bought up to it first, by the
   * seats' own road; a purchase refused rejects with `SeatsRefused` and sends nothing, the provider's day's limit with `InvitationsLimited`.
   */
  invite(emails: readonly string[], role: MemberRole, buy?: SeatsBuy): Promise<InviteAnswer>;
  /** Sends a waiting invitation again, a new one for the same address and role: true where the provider sent it; rejects where it failed. */
  resendInvitation(id: string): Promise<boolean>;
  /** Takes a waiting invitation back; rejects where it was not. */
  revokeInvitation(id: string): Promise<void>;
  /** The invited person's 接受邀请, by the identity provider's own call: joined, the organization full, or the invitation gone. */
  acceptInvitation(id: string): Promise<"accepted" | "full" | "gone">;
  /** The invited person's 拒绝邀请: the invitation is taken off, and its seat is free; rejects where it was not. */
  declineInvitation(id: string): Promise<void>;
  /** What a change to `seats` costs before it is made; rejects with `SeatsRefused` where the seats' state refuses one. */
  seatsPrice(seats: number): Promise<SeatsPrice>;
  /**
   * Sets the organization's count: a raise is paid now, at `at` where a price read gave one; a cut takes the renewal. Rejects with
   * `SeatsRefused` where the platform did not change it.
   */
  setSeats(seats: number, at?: number): Promise<SeatsSet>;
  /** What the person asked to be called, which the identity provider keeps as their name; rejects where it was not kept. */
  setName(name: string): Promise<void>;
  /** Closes the account's tutorial for good; rejects where the platform did not keep it. */
  closeGuide(): Promise<void>;
  /** The devices the account is signed in on, this browser's first; rejects where the platform could not read them. */
  devices(): Promise<readonly Device[]>;
  /** Signs one of the account's own devices out; rejects where it was not. */
  endDevice(id: string): Promise<void>;
  /** The person's photo as the identity provider holds it, where they set one and its script has loaded. */
  photo(): string | undefined;
  /** Sets the person's photo at the identity provider, or removes it for `null`; rejects where it was not taken. */
  setPhoto(file: Blob | null): Promise<void>;
  /** Calls `changed` whenever the identity provider's script says what it holds of the person has changed, as when it has loaded. */
  watchPhoto(changed: () => void): void;
  /** The cards the provider keeps for the account; none where the platform names no billing. */
  cards(): Promise<readonly SavedCard[]>;
  /** The payments the ledger was credited for, newest first: the first page, or the page after the place `after` names. */
  payments(after?: string): Promise<Payments>;
  /** A payment session for the provider's form in the page, paid the way asked: its secret. Rejects with the platform's refusal. */
  payIn(ask: CheckoutAsk, way: PayWay): Promise<string>;
  /** A session that saves a card, in place of the one that pays now where `replace` asks: its secret. */
  saveCard(replace: boolean): Promise<string>;
  /** The provider's form for a session's secret. */
  payForm(secret: string): Promise<PayForm>;
  /** Whether a session the account made was paid, by the provider's word, and what the ledger credited for it once it has. */
  returned(session: string): Promise<Returned>;
  /** Ends the card's renewal at the period's end, or a charge being tried again now. */
  cancelRenewal(): Promise<void>;
  /** Undoes a cancellation at the period's end. */
  resumeRenewal(): Promise<void>;
  /** Pays a period now from the account's own money. */
  renewNow(): Promise<void>;
  /** The account's switch for renewing from its balance. */
  setRenewal(on: boolean): Promise<void>;
}

/** Where a person asks for help: the support address. No vendor widget is loaded for it. */
export const HELP = "mailto:support@comchatx.com";

/** Money on the Plugins pages is printed one way in both languages, as the chat's model card prints it: the sign alone. */
export const MONEY_AS = "en";

/** An amount as the Plugins page shows it: two decimals at most. A month's total goes through `formatTotal` instead, so a fraction of a cent never reads as $0.00. */
export function formatShown(units: number, money: Money, language: string): string {
  return new Intl.NumberFormat(language, { style: "currency", currency: money.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(units / money.unitsPerMinor / 100);
}

/**
 * A month's total as every surface draws it (ruled 2026-09-30): two places, "$0.00" only for nothing spent, and a non-zero amount under a
 * cent as less than a cent, in the words `less` gives; a sum owed under a cent is less than a cent owed, never less than minus a cent.
 */
export function formatTotal(units: number, money: Money, language: string, less: (amount: string, owed: boolean) => string): string {
  return units !== 0 && Math.abs(units) < money.unitsPerMinor ? less(formatShown(money.unitsPerMinor, money, language), units < 0) : formatShown(units, money, language);
}

/** What the platform put on a model record from the box's catalogue: its provider's aggregator mark and pi's levels on it, only as they can be read. */
export function readCatalogued(model: Readonly<Record<string, unknown>>): Pick<Model, "aggregator" | "thinkingLevels"> {
  const levels = model["thinking_levels"];
  const thinkingLevels = Array.isArray(levels) ? levels.filter((one): one is string => typeof one === "string") : [];
  return { ...(model["aggregator"] === true ? { aggregator: true as const } : {}), ...(thinkingLevels.length > 0 ? { thinkingLevels } : {}) };
}

/** pi's own answers to `get_state` and `get_available_models`, read into the model in use and the models the composer offers. */
export function readModels(answers: { readonly get_state?: unknown; readonly get_available_models?: unknown; readonly get_available_thinking_levels?: unknown }): Models {
  const data = (answer: unknown): Record<string, unknown> => (typeof answer === "object" && answer !== null && typeof (answer as Record<string, unknown>)["data"] === "object" && (answer as Record<string, unknown>)["data"] !== null ? (answer as { data: Record<string, unknown> }).data : {});
  const current = data(answers.get_state)["model"] as { readonly provider?: unknown; readonly id?: unknown; readonly name?: unknown } | null | undefined;
  const listed = data(answers.get_available_models)["models"];
  const thinkingLevel = data(answers.get_state)["thinkingLevel"];
  const levels = data(answers.get_available_thinking_levels)["levels"];
  const thinkingLevels = Array.isArray(levels) ? levels.filter((one): one is string => typeof one === "string") : [];
  return {
    ...(typeof thinkingLevel === "string" ? { thinkingLevel } : {}),
    ...(typeof thinkingLevel === "string" && thinkingLevels.length > 0 ? { thinkingLevels } : {}),
    current: typeof current?.provider === "string" && typeof current.id === "string" ? { provider: current.provider, id: current.id, ...(typeof current.name === "string" ? { name: current.name } : {}) } : undefined,
    available: (Array.isArray(listed) ? listed : []).flatMap((model: Readonly<Record<string, unknown>> | null) =>
      typeof model?.["provider"] === "string" && typeof model["id"] === "string" ? [{ provider: model["provider"], id: model["id"], name: typeof model["name"] === "string" ? model["name"] : model["id"], ...readCatalogued(model) }] : []),
  };
}

export const spentTotal = (spending: Spending): number => spending.spent.model + spending.spent.sources + (spending.spent.boxTime ?? 0) + (spending.spent.boxStorage ?? 0);

/** The share of the month's credit that is gone, as the low-balance rule counts it: from what is left, not from what was spent. */
export function creditUsedPercent(balance: Balance, spending: Spending): number | undefined {
  if (balance.available === undefined || spending.credited === undefined || spending.credited <= 0) return undefined;
  return Math.round(Math.min(1, Math.max(0, 1 - balance.available / spending.credited)) * 100);
}
