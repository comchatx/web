import { BoardRefused, ComputerPending, MONEY_AS, type Account, type Awake, type AccountMoney, type Backend, type ChatOffer, type Me, type OpenedFrom, type Models, type Parts, type Provider, type RowThinking, type Source, type Spaces, type Subscription } from "./backend.js";
import { formatMoney } from "../shared/money.js";
import type { DoorReason } from "../shared/door.js";
import type { PickOutcome } from "../shared/card-choices.js";
import { readCard, TASKS_TAB, type CardRow } from "../shared/board.js";
import { fileName } from "./board-files.js";
import { THINKING_REFUSED } from "../shared/package-request.js";
import { lineTone } from "./box-state.js";
import { balanceLine, closedLine, linked, type BoxLine } from "./box-words.js";
// cx is a classic script that sets one global; imported here so the bundle carries it (`cx.d.ts`).
import "./cx.js";
import { ACT_WORDS, begins, kindOf, MINUTE_MS, scene, type Act, type Said as Word, type Scene, type Stay } from "./cx-scene.js";
import { fill, h, keep, keepAttribute, svg, type Child } from "./dom.js";
import { chevron, giveBack, hideTipWithin, menu, tip, toast } from "./forms.js";
import { accountGroup, inUseName, switchable } from "./account-switch.js";

/** A control named by its `aria-label`, whose drawn tip says that name as it stands when shown (`forms.ts`); it carries no `title`. */
const named = <T extends HTMLElement>(control: T): T => tip(control, () => [control.getAttribute("aria-label") ?? ""]);
import { perFrame } from "./frame.js";
import { pickLine, ModelCard, NO_VIEW, Picks, afterPick, afterRead, cardView, drawnPick, droppedName, shownModels, within, type Choice, type Level, type PickAnswer, type SeriesPick, type Shown } from "./model-card.js";
import { cardOf, href, othersHref, route as catalogueRoute, withoutCard } from "./plugins-model.js";
import { packageNamed } from "./catalogue.js";
import type { CardWords } from "../shared/maker-words.js";
import { HOME, PENDING_AGAIN_MS, PluginsPage } from "./plugins-page.js";
import { FeatureCard, featureDue, pagesOf, putAway } from "./feature-card.js";
import { failedUnder, failureUnder, noteWaited, rowKey, type QueueRow } from "./plugins-queue.js";
import { ignoreHeld, twice } from "./press.js";
import { organizationAddress, SettingsWindow, sectionOf, underOf, windowAddress, type WindowPorts } from "./settings-window.js";
import { writer, type Writer } from "./settings-words.js";
import { SourcesBar, rowTotal } from "./sources-bar.js";
import { PurchaseNews } from "./purchase-reports.js";
import { SourcesReads } from "./sources-reads.js";
import { contextFill, type ContextFill } from "./context-usage.js";
import { clockTime, dayAndTime, dayName, fullDate, rowTime } from "./days.js";
import { ComputerWindow, type WindowAct, type WindowView } from "./computer-window.js";
import { BoardColumn } from "./board-column.js";
import { fromBoard, readFromBoard, unmarked } from "./board-message.js";
import { BoardDoor } from "./board-door.js";
import type { FrameAsks } from "./board-frame.js";
import { saveFile } from "./page-save.js";
import { BoardView } from "./board-view.js";
import { offOf } from "./board-off.js";
import { FileUploads, type FileCard, type UploadWhy } from "./file-uploads.js";
import { addIcon, MessageRows, sendIcon, stopIcon, type Said } from "./message-rows.js";
import { sentWith, unquoted, type Quote } from "./quote.js";
import { fileSaid, QuoteBox } from "./quote-box.js";
import { SlashList } from "./slash-list.js";
import { clamped, lastThinkingRecord, PI_DEFAULT, ThinkingCard, type Thinking } from "./thinking-level.js";
import { markWords, QuotePick, wordsIn } from "./quote-pick.js";
import { HistoryView } from "./history-view.js";
import { earlier, EMPTY, joined, lastSeq, later, stretch, TurnEnds, type Item, type StreamEvent, type StreamState } from "./stream-model.js";
import { StreamView, type Say } from "./stream-view.js";
import { LineClock, atWork, lineOf, sentOf, type Line } from "./step-line.js";
import { stepTime, type BoardCard } from "./chat-model.js";
import { preferredLanguage, sayAround, text, type Language, type StringKey } from "./strings.js";
import { Visit, type Asked, type Connection } from "./visit.js";
import { avatar, inviting, type ReadyPort } from "./account-pages.js";
import { ownModel } from "./usage-page.js";
import { messageBox } from "../shared/message-box.js";

type SignedIn = Extract<Me, { kind: "signed_in" }>;
const LANGUAGE_KEY = "cmx-language";
/** Models that name none: the row of a first glance whose own models answer was another life's, until this life's answer comes. */
const NO_MODELS: Models = Object.freeze({ current: undefined, available: Object.freeze([]) });
const SIDEBAR_KEY = "cmx-sidebar";
/** The life the page last showed, kept per origin so a reload or a reopened tab asks the store for it at once (`placeWord`). */
const PLACE_KEY = "cmx-place";
const READY_KEY = "cmx-answer-ready";
/** When cx last said that a new version waits, per account: one value in this browser, so two accounts here never share it. */
const NEWER_KEY = "cmx-newer-said";
/** cx says it once, and not again for this long (sheet 1). */
const NEWER_AGAIN_MS = 7 * 24 * 60 * 60 * 1000;
/** How long words said for a screen reader alone stay in the page. */
const HEARD_MS = 1500;
/** How often the processor and the memory are read while cx's computer is shown and on: the supplier samples them as often. */
const LOAD_EVERY_MS = 15_000;
/** Narrower than this the sidebar lies over the page and starts closed: tool output, tables and code need the width. */
const WIDE = "(min-width: 56rem)";

type Glance = { readonly sources: readonly Source[]; readonly models: Models; readonly providers: readonly Provider[] | undefined; readonly accounts: readonly Account[]; readonly ticked: readonly string[] | undefined; readonly offer?: ChatOffer | undefined; readonly pending: Choice | undefined; readonly taken?: Choice | undefined };
/** cx's size above the composer: the sidebar size of the character spike. */
const CX_SIZE = 30;
/** How long cx keeps typing after the person's last keystroke. */
const TYPING_MS = 1200;
/** How long cx says what a person can do nothing about, and for the balance gone under one unit, said once. */
const READY_WORD_MS = 4000;
const ASKED_WORDS = { compact: "cx.compact", close: "cx.off" } as const satisfies Record<Asked, string>;
const CX_TARGETS = ["computer", "cx"] as const;
type CxTarget = (typeof CX_TARGETS)[number];
/** A card stands this far from the target it opened from, and from the window's edge. */
const CARD_GAP = 6;
const CARD_EDGE = 8;
/** What the computer's window reads as it opens: 永不 and the idle minutes, the month's figure in units, and the plugins installed. */
/** What the computer's window read at an opening, `opened` the count of that opening. */
/** `rate` is the hourly price of the account answer the window last took its parts from: `units` absent where that answer had none. */
type ComputerRead = { readonly opened?: number; readonly awake?: Awake; readonly month?: number; readonly plugins?: number; readonly parts?: Parts; readonly rate?: { readonly units?: number }; readonly reading?: boolean };
/** The least height the computer's window keeps where the room over the computer is shorter: its body scrolls within it. */
const WINDOW_LEAST = 160;
/** How far left of cx its card stands, as the signed prototype places it. */
const CC_TAIL = 8;
/** The gap between the model's or the level's card and the card it rises over: the stylesheet's `--space-3`. */
const MENU_GAP = 6;
/** The least room, in the line's ems, the status row's words keep beside Back to latest: a little more than "Running a command 8 sec ›". */
const LINE_ROOM_EMS = 15;
/** How long what is open over cx follows it frame by frame after cx is sent somewhere: a hop and the glide after it. */
const FOLLOW_MS = 1500;
/** How far a finger goes down the screen, at the top of the stream, before it is a reach for what came earlier rather than a tap. */
const SWIPE_PX = 12;
/** A field the key is typed into, where an arrow moves the caret and not the stream. */
const typesIn = (target: EventTarget | null): boolean => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
/** Whether the keyboard brought the focus: a pointer's press, or a card that closed, leaves one that says nothing. */
const byKeyboard = (target: Element): boolean => { try { return target.matches(":focus-visible"); } catch { return false; } };
const noSignal = (): SVGElement => svg("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round" },
  svg("path", { d: "M3 7.2a7 7 0 0 1 10 0M5.2 9.6a4 4 0 0 1 5.6 0" }), svg("circle", { cx: "8", cy: "12", r: "0.9", fill: "currentColor", stroke: "none" }), svg("path", { class: "cx-nosignal-cross", d: "M3 3l10 10" }));

/**
 * One surface and a way in: the stream with its composer is the product, settings is the one page behind it, and the sidebar holds entries
 * and state to glance at — never a form, and never a list of conversations, because there is one stream. The route is the address's
 * fragment, so the pages stay plain files the platform serves from its own origin with no route of its own per page.
 */
/** The room past a screen a far stretch reaches below the place gone to, so the place opens the view with no line of the end showing. */
const FILL_MARGIN = 48;

/** The side a card's picture is drawn at, twice over for a sharp screen. */
const THUMBNAIL_PX = 96;
/**
 * A small copy of an image file for its card, as a `data:` address: the page's policy draws images from itself and `data:` alone, and a
 * copy this size costs little however large the file. None where the browser cannot read the picture.
 */
async function thumbnail(file: File): Promise<string | undefined> {
  if (typeof createImageBitmap !== "function") return undefined;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, THUMBNAIL_PX / Math.min(bitmap.width, bitmap.height));
  const canvas = h("canvas", { width: String(Math.max(1, Math.round(bitmap.width * scale))), height: String(Math.max(1, Math.round(bitmap.height * scale))) });
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/png");
}
/** Where the pages send an account without a computer: the road, unless 跳过 on it left its word for this page load. */
export type RoadTurn = { readonly skipped: boolean; go(checkout?: string): void };

/**
 * What a refusal of pi's says, as one line of at most `PI_WORDS` characters: pi's words are drawn as pi wrote them, in English — except
 * that a package's command that threw hands pi its own message, which can be in any language and is still marked English.
 */
const PI_WORDS = 160;
export const piWords = (words: string | undefined): string | undefined => {
  const line = words?.replace(/\s+/g, " ").trim();
  if (line === undefined || line === "") return undefined;
  return line.length <= PI_WORDS ? line : `${line.slice(0, PI_WORDS - 1).trimEnd()}…`;
};

/** A card the chat holds: its row as last read, the file's time it was read at, whether it was read, and how often a write told it since. */
type HeldCard = { row: CardRow | undefined; modified?: number | undefined; state: "new" | "read" | "failed"; told: number };

/** Where a deleted organization's name waits for the person's own page, across the switch's load. */
const GONE_KEY = "cmx-organization-deleted";

export class App {
  language: Language;
  readonly #visit: Visit;
  #me: Me | undefined;
  /** The account's money as `/account/money` said at the last read of the account, and a lapsed account's membership as the provider holds it. */
  #money: AccountMoney | undefined;
  #subscription: Subscription | undefined;
  /** The account is offered the invitation sheet, as its last read said: a member, or a lapsed account with a friend's reward to come. */
  #inviting = false;
  /** Browser notifications when an answer is ready, the person's choice kept by this browser. */
  readonly #ready: ReadyPort = {
    on: () => { try { return localStorage.getItem(READY_KEY) === "on"; } catch { return false; } },
    set: (on) => { try { if (on) localStorage.setItem(READY_KEY, "on"); else localStorage.removeItem(READY_KEY); } catch { /* the choice is not kept */ } },
    permission: () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
    ask: () => Notification.requestPermission(),
  };
  readonly #turnEnds = new TurnEnds();
  #glance: Glance | undefined;
  /** Each card's words as the catalogue's makers' packages give them, by which the model card and the stream name a maker; none until it answers. */
  #makers: CardWords = {};
  /**
   * pi's last word of its level and the levels its model takes, as the models answer or the box's end of a level brought them, with pi's
   * last record of a level the page had then, which a later record is drawn over. Kept while the box sleeps, as the model card keeps what it offered.
   */
  #thinkingWord: { readonly level: string; readonly levels: readonly string[]; readonly seen: string | undefined; readonly on?: { readonly provider: string; readonly id: string } } | undefined;
  /** The person's press: its level from the click, and the entry of the account's list it became once the platform answered. */
  #thinkingPress: { readonly level: string; readonly id?: string; readonly ended?: true } | undefined;
  /** What the account's list says of the thinking level, as last read with the pending pick. */
  #thinkingRow: RowThinking = {};
  /** The box refused the person's last press, its entry ended so: said under the model line, awake, until the next press. */
  #thinkingKept = false;
  /** Each press and each settling of one: a read of the list begun before the latest says nothing of the press now, and is dropped. */
  #thinkingTurn = 0;
  /** Each wake of the box and each life it begins: a models answer asked before the latest is another pi's, and is dropped. */
  #lives = 0;
  /** The newest models answer taken, with the wake or life it answers for: a first glance read across a later one draws it. */
  #modelsTaken: { readonly lives: number; readonly models: Models } | undefined;
  #thinkingNext: string | undefined;
  #thinkingSending: Promise<void> | undefined;
  #accountAsked = 0;
  #accountTaken = 0;
  /** The account this page was drawn for: what it holds is theirs. */
  #person: string | undefined;
  /** The platform said the page was asked with a session: its frame is drawn before the account answers. */
  readonly #presumed: boolean;
  /** The first place the view held when the page last looked whether the person is at the top. */
  #fromSeen: number | undefined;
  readonly #picks = new Picks((pick) => this.backend.pick(pick), (pick, answer) => this.#picked(pick, answer));
  #sidebarOpen: boolean;
  /** The corner's button and the account menu it opens, the set's menu (`forms.ts`): one each for the page's life, so a redraw keeps them. */
  readonly #accountButton = tip(h("button", { type: "button", class: "account-button" }), () => [this.#accountWho]);
  readonly #accountList = h("div", { class: "f-menu account-menu", role: "menu" });
  readonly #accountMenu = menu(this.#accountButton, this.#accountList, { order: ["above", "below"] });
  /** Who the corner names in full, the email where there is one: the button's tip. */
  #accountWho = "";
  /** The accounts this sign-in holds, as the provider last said: a person in an organisation switches between them in the corner's menu. */
  #spaces: Spaces | undefined;
  /** These pages were started by a switch of account: the keyboard goes back to the corner once it is drawn. */
  #switched: boolean;
  /** What the menu's rows were drawn from: rows are drawn again only when it changes, so the keyboard's row stays under a redraw. */
  #accountRows = "";
  get #menuOpen(): boolean { return !this.#accountList.hidden; }
  #leaveFailed = false;
  #unsent = false;
  /** pi's own words for the message it refused, drawn after the line that says it was not sent, at most a line's worth. */
  #unsentWhy: string | undefined;
  /** A stretch of the conversation read from a far place, drawn in place of the live view while the reader is there. */
  #away: { readonly state: StreamState; readonly later: boolean } | undefined;
  /** The place a jump waits on, while its stretch is read. */
  #jumping: string | undefined;
  /** The place a jump could not read: said where its stretch would be, with a way to ask again. */
  #jumpFailed: string | undefined;
  /** Where the page itself last scrolled the conversation to: a scroll event that finds it there is the page's, not the reader's. */
  #pageTop: number | undefined;
  /** The place the reader went to from History, until they are back at the latest message. */
  #reading: string | undefined;
  /** Whether History last drew its entry to the chat as current: a change from it draws History again. */
  #currentDrawn = false;
  /** Which read of the far stretch is on its way: what follows it, or what comes before it. */
  #awayReading: "later" | "earlier" | undefined;
  /** Each jump's turn: an answer for a jump since replaced, or left for the latest, is dropped. */
  #jumps = 0;
  readonly #wide = window.matchMedia(WIDE);
  readonly #say: Say = (key, values) => text(this.language, key, values);
  readonly #sidebar = h("aside", { class: "sidebar" });
  readonly #backdrop = h("div", { class: "backdrop", onclick: () => this.#setSidebar(false) });
  readonly #opener = named(h("button", { type: "button", class: "sidebar-open", onclick: () => this.#setSidebar(true) }, "☰"));
  /** The sidebar's close, one for the page's life: a redraw of the sidebar keeps it, and the tip it shows. */
  readonly #closer = named(h("button", { type: "button", class: "sidebar-close", onclick: () => this.#setSidebar(false) }, "‹"));
  readonly #history: HistoryView;
  /** Back to the latest message, under the conversation's view while it shows, in room of its own so it never lies over the words. */
  readonly #toLatest = h("button", { type: "button", class: "to-latest", onclick: () => { this.#backToLatest(); } });
  readonly #latestSlot = h("div", { class: "latest-slot" }, this.#toLatest);
  readonly #foot = h("div", { class: "sidebar-foot" });
  readonly #main = h("main", {});
  /** The chat's top: the sidebar's opener while the sidebar is closed, and the column's page icons at its right end while the board shows. */
  readonly #chatTop = h("div", { class: "page-top" }, this.#opener);
  readonly #page = h("div", { class: "page" }, this.#chatTop, this.#main);
  readonly #board: BoardView;
  /** The board's names the stream was last drawn with. */
  #namesDrawn: ReadonlyMap<string, unknown> | undefined;
  readonly #column: BoardColumn;
  /** The board cards the chat draws rows for, as last read: `fresh` until the board's files change, or a page writes the card. */
  /** The chat's board cards by tab, then by file: each as last read, at the file's time its tab's list gave, and how often it was told since. */
  readonly #cardRows = new Map<string, Map<string, HeldCard>>();
  /** The tabs whose cards are being read, and those told to read again once that read is done. */
  readonly #cardTabs = new Map<string, { again: boolean }>();
  /** The door a page asks through for its board to be shown. */
  readonly #door = new BoardDoor();
  /** Whether the column is being opened by a page's ask, not by the seller. */
  #doorOpening = false;
  /** Whether cx was at work when the visit last changed. */
  #wasRunning = false;
  /**
   * cx at its computer above the composer at its left edge. Each of the two is a target that opens the one card: a line saying what
   * that one is doing now and, under a rule, what can be done now. What cx says is in its bubble, and a hover's label is the card's title.
   */
  readonly #cxSlot = h("span", { class: "cx-slot" });
  /** cx's word, and the status a screen reader hears: always in the tree, so a word written into it is spoken; with nothing to show it is out of sight. */
  readonly #cxBubble = h("span", { class: "cx-bubble quiet", role: "status" });
  readonly #cxTip = h("div", { class: "cx-tip", hidden: true });
  readonly #cxMark = h("span", { class: "cx-nosignal", "aria-hidden": "true", hidden: true }, noSignal());
  readonly #cxPlace = h("div", { class: "cx-place" }, this.#cxSlot, this.#cxBubble, this.#cxMark, this.#cxTip);
  readonly #cx = CxCharacter.mount(this.#cxSlot, { size: CX_SIZE, state: "sleeping", scene: true });
  /** The window of cx's computer, which a press on the computer opens, and what it reads as it opens. */
  readonly #computer: ComputerWindow;
  #computerRead: ComputerRead = {};
  /** 「cx 的电脑」 is shown in Settings. */
  #sectionWatched = false;
  #loadTimer: ReturnType<typeof setTimeout> | undefined;
  #computerAsk = 0;
  /** A restart asked from the window that has not ended: the window says the computer is restarting. */
  #restarting = false;
  /** The seller's switch-off, from its press until it answers: the window says 正在关机, and 开机 takes no press until it is off. */
  #switchingOff = false;
  /** The sources bought from most recently, under the sidebar's Plugins entry, and the receipt a purchase sends from its row to cx. */
  readonly #bar = new SourcesBar({
    say: (key, values) => this.#say(key, values),
    motion: CxCharacter.MOTION,
    money: (units) => (this.#me?.kind === "signed_in" ? formatMoney(units, this.#me.money, MONEY_AS) : ""),
    total: (units) => (this.#me?.kind === "signed_in" ? rowTotal((key, values) => this.#say(key, values), this.#me.money, MONEY_AS)(units) : ""),
    // A row opens what it counts: the month's spending in Settings.
    href: () => "#/settings/usage",
    name: (source) => this.#catalogue.nameFor("source", source),
    scene: () => this.#cx.scene!,
    reduced: () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    changed: () => this.#drawCx(),
  });
  /** The reads of `/sources`, a refresh's and the rows' after a `cx get` ends, each answer applied as it comes. */
  readonly #sourcesReads = new SourcesReads(() => this.backend.sources(), (sources) => {
    if (this.#glance !== undefined) this.#glance = { ...this.#glance, sources };
    this.#bar.sources(sources);
  });
  /** The account's reads at a turn's end; `#readAccount` draws the newest answer taken. */
  readonly #accountReads = new SourcesReads(async () => {
    const me = await this.#readAccount();
    if (me === undefined) throw new Error("no account");
    return me;
  }, () => this.draw());
  readonly #news = new PurchaseNews({
    sources: () => void this.#sourcesReads.refresh(),
    account: () => void this.#accountReads.refresh(),
    held: () => this.#windowed,
  });
  #scene: Scene | undefined;
  /** The target whose card is open, and the one whose label shows. */
  #opened: CxTarget | undefined;
  #tipped: CxTarget | undefined;
  /** The actions the card holds as drawn: they are the same elements until they change, so the focus on one outlasts a change of words. */
  #offered: string | undefined;
  /** What cx is saying, how it goes, and when a word that goes by itself does. */
  #said: { readonly key: StringKey; readonly stays: Stay; readonly until: number } | undefined;
  #typing: ReturnType<typeof setTimeout> | undefined;
  #wasOut = false;
  #following = 0;
  #cxTimer: ReturnType<typeof setTimeout> | undefined;
  /** When the armed redraw falls due, and what the bubble last said: a draw that changes neither leaves them, so a stream delta rewrites no live region. */
  #cxDue: number | undefined;
  #bubbleSaid: string | undefined;
  /** That a new version waits is being said in this page, and the seller has answered it: pressed it, typed, opened a card or restarted. */
  #newerSaying = false;
  #newerHushed = false;
  /** 永不 as the account holds it was asked of the platform for the new version's word, before any opening of the window read it. */
  #keptAsked = false;
  /** cx placed beside the last line once per frame, however many deltas, scrolls and resizes ask for it within one. */
  readonly #placeSoon = perFrame((then) => requestAnimationFrame(then), () => this.#placeCx());
  readonly #statusText = h("span", { class: "status-text", role: "status" });
  // The line beside cx's desk while cx works: a way to the step's card while it names one, words alone while it names none. The time and
  // › are the eye's: the card says the time, and a ticking second would read the line out again.
  readonly #lineWords = h("span", { class: "step-words" });
  readonly #lineTime = h("span", { class: "step-time", "aria-hidden": "true" });
  readonly #lineGo = h("span", { class: "step-go", "aria-hidden": "true" });
  readonly #lineDot = h("span", { class: "dot", "aria-hidden": "true" });
  readonly #lineButton = h("button", { type: "button", class: "step-line", hidden: true, onclick: () => this.#toStep() });
  readonly #lineText = h("span", { class: "step-line", hidden: true });
  readonly #lineClock = new LineClock();
  #lineNow: { readonly line: Line; readonly since: number } | undefined;
  #lineTicker: ReturnType<typeof setInterval> | undefined;
  /** When the computer's start began, on the page's clock: at Send for a message that woke it, or at 开机. */
  #startedAt: number | undefined;
  /** Whether the line was last drawn for a computer that starts, and whether a start was drawn whose end the list has not been read at. */
  #lineStarting = false;
  #startSeen = false;
  /** The installs and updates each message the platform held waited behind, by when it was said; and those of them seen failed (4A). */
  readonly #waitedBehind = new Map<string, Set<string>>();
  readonly #seenFailed = new Set<string>();
  /** Why the message box takes no message, first on the line beside cx in the box's ink; the box below it stays one to write in. */
  readonly #closed = h("p", { class: "status-reason", hidden: true });
  readonly #statusWords = h("div", { class: "status-words" }, this.#closed, this.#statusText, this.#lineButton, this.#lineText);
  readonly #status = h("div", { class: "status" }, this.#cxPlace, this.#statusWords);
  readonly #draft = h("textarea", { rows: "2" });
  /** The one control at the message box's edge. It is one element for as long as the page lives, so the focus on it outlasts every drawing. */
  readonly #control = named(h("button", { type: "button", class: "control", onclick: (event) => this.#press(event) }));
  readonly #dayWords = (): { readonly today: string; readonly yesterday: string } => ({ today: this.#say("stream.today"), yesterday: this.#say("stream.yesterday") });
  readonly #quoteBox = new QuoteBox({
    say: this.#say, draft: this.#draft,
    when: (time) => dayAndTime(time, Date.now(), this.language, this.#dayWords()),
    changed: () => { this.#streamView.resized(); this.#placeSoon(); this.#drawControl(); },
    files: { cards: () => this.#uploads.cards, remove: (id) => this.#uploads.remove(id), retry: (id) => this.#uploads.retry(id) },
  });
  /**
   * The / list: pi's `get_commands` while cx's computer runs, and while it sleeps the Plugins page's list, so typing / wakes nothing. A
   * skill shows the words a seller reads for it on Plugins, found by the package pi names as its source; a command the catalogue has no
   * words for shows pi's own, which are English.
   */
  readonly #slash = new SlashList({
    say: this.#say, draft: this.#draft,
    awake: () => this.#visit.awake,
    // The package list is read beside it, so a skill's words are found for a record that names its package and not its source.
    commands: async () => (await Promise.all([this.backend.command({ type: "get_commands" }), this.#catalogue.readPackages().catch(() => undefined)]))[0],
    line: ({ name, description, source }) => {
      const skill = /^skill:(.+)$/.exec(name)?.[1];
      const words = skill === undefined || source === undefined ? undefined : this.#catalogue.skillWords(source, skill)?.[this.language];
      return words !== undefined ? { name, about: words } : description !== undefined ? { name, about: description, lang: "en" } : { name };
    },
    asleep: () => this.#catalogue.skillsHeld(),
    picked: () => this.#drawControl(),
  });
  /** Whether cx's computer ran when the / list was last drawn: a change asks an open list again. */
  #slashAwake = false;
  /** The files in the message box, each going up to the top of the seller's files as it is added. */
  readonly #uploads = new FileUploads({
    command: (command) => this.backend.command(command),
    wake: () => this.#visit.wake(),
    why: () => this.#offWhy(),
    found: () => this.#visit.found,
    notThere: (found) => this.#visit.notThere(found),
    changed: () => { this.#quoteBox.draw(); this.#streamView.resized(); this.#placeSoon(); this.#drawControl(); },
    tell: (cards) => this.#tellFiles(cards),
    picture: (file) => thumbnail(file),
  });
  readonly #picker = h("input", { type: "file", multiple: true, hidden: true, tabindex: "-1", "aria-hidden": "true" });
  /** + at the box's lower left: a press opens the system's file picker. */
  readonly #add = named(h("button", { type: "button", class: "add f-icon", onclick: () => this.#picker.click() }, addIcon()));
  /** Over the box while files are dragged over the conversation. */
  readonly #dropSaid = h("p", { class: "drop-said", hidden: true });
  #dragging = 0;
  /** Words for a screen reader alone: what a control did, said once. */
  readonly #announce = h("span", { class: "unseen", role: "status" });
  /** The closed box's sentence as last drawn, empty for an open box; unset until an account is first drawn. */
  #closedSaid: StringKey | "" | undefined;
  readonly #farQuoted = new Map<string, Promise<Extract<Item, { kind: "user" | "assistant" }> | undefined>>();
  readonly #rows = new MessageRows({
    say: this.#say, clock: (time) => rowTime(time, Date.now(), this.language, this.#dayWords()), fullDate: (time) => fullDate(time, this.language),
    said: (quote) => this.#saidBy(this.#itemAt(quote.at)),
    saidFar: async (quote) => this.#saidBy(await this.#quotedFar(quote.at)),
    grew: () => this.#streamView.resized(),
    quote: (quote) => this.#quoteBox.add(quote),
    jump: (quote) => { void this.#jumpToQuote(quote); },
    copy: (words) => { void navigator.clipboard?.writeText(words).catch(() => undefined); },
    cancel: (key) => { void this.#visit.withdraw(key); },
    // The control goes with pi's record of the message, so the focus moves now to where the next thing is written.
    sendNow: () => { this.#toBox(); void this.#visit.stop("now"); },
    announce: (words) => { this.#announce.textContent = words; },
    later: (ms, then) => { setTimeout(then, ms); },
  });
  readonly #composer = h("form", { class: "composer" }, this.#slash.element, this.#quoteBox.element, this.#draft, this.#dropSaid, h("div", { class: "composer-row" }, this.#add, this.#picker, this.#control));
  /** The model card under the composer's right edge: the plugins page is where its vendors are set, so `others` goes there — to the vendors' page from the vendors, to the vendor's own models from its models. */
  readonly #card = new ModelCard({
    say: this.#say,
    choose: (provider, modelId, platform, series) => this.#choose(provider, modelId, platform, series),
    others: (vendor) => { location.hash = othersHref(vendor, vendor === undefined ? undefined : this.#catalogue.hrefFor("vendor", vendor)); },
  });
  // A refused pick is said here, under the line it corrects, whatever the status line says.
  readonly #pickSaid = h("p", { class: "pick-said", role: "status" });
  /** The thinking level beside the model: a press goes to the account's list for the box, as a pick does, and the button says the level drawn. */
  readonly #thinkingCard = new ThinkingCard({ say: this.#say, choose: (level) => this.#chooseThinking(level) });
  readonly #thinkingSaid = h("p", { class: "pick-said", role: "status" });
  readonly #aiNote = h("p", { class: "cc-note" });
  /**
   * cx's card: what cx is doing, and what a seller sets about cx, in one place. A press on cx opens it, with cx's face and a tail; its
   * title is cx's state and, while cx works, Stop stands beside it. Its rows, from what cx is doing now to what is set once: how full
   * the context is, with Summarise while cx is at rest, while the computer is on; the model, as the control that opens the model card;
   * the thinking level, where the model takes more than one; what the computer answered a pick under the row it was made in; and at the
   * foot, quiet, the note that cx is an AI. Nothing of it stands under the message box.
   */
  readonly #ccFace = h("span", { class: "cc-face", "aria-hidden": "true", inert: true });
  /** cx's face in the card's head, there only while the card is open: a shut card draws nothing and runs no motion. */
  #ccFaceCx: ReturnType<typeof CxCharacter.mount> | undefined;
  readonly #ccTitle = h("p", { class: "cc-title", id: "cc-title", role: "status" });
  readonly #ccHeadActs = h("span", { class: "cc-acts" });
  readonly #ccContextWords = h("span", { class: "cc-text" });
  readonly #ccFill = h("span");
  readonly #ccContextActs = h("span", { class: "cc-acts" });
  readonly #ccContext = h("li", { class: "cc-row cc-context" }, this.#ccContextWords, this.#ccContextActs);
  readonly #ccModelName = h("span", { class: "cc-text" });
  readonly #ccLevelName = h("span", { class: "cc-text" });
  /** 模型 and 思考强度 are each one press, the row whole: the name at its left, what is chosen at its right, the list opening on the row. */
  readonly #ccModel = h("li", { class: "cc-row cc-pick" }, this.#card.element);
  readonly #ccModelSaid = h("li", { class: "cc-row cc-said" }, this.#pickSaid);
  readonly #ccLevel = h("li", { class: "cc-row cc-pick" });
  readonly #ccLevelSaid = h("li", { class: "cc-row cc-said" }, this.#thinkingSaid);
  readonly #ccRows = h("ul", { class: "cc-rows" });
  readonly #ccHead = h("div", { class: "cc-head" }, this.#ccHeadActs, this.#ccTitle, this.#ccFace);
  readonly #ccCard = h("div", { class: "cc-card", id: "cc-card", role: "dialog", tabindex: "-1", "aria-labelledby": "cc-title", hidden: true });
  /** How cx's card was last laid out, so it is moved only when that changes. */
  #ccArranged: string | undefined;
  /** How full the context is, as pi last answered while cx's card was open; `undefined` until it answers with a figure. */
  #context: ContextFill;
  /** The newest read of it: an older answer that lands after a newer ask is not drawn. */
  #contextAsk = 0;
  /** What the figure was read after: the compactions heard and whether cx was at work. A change while the card is open reads it again. */
  #contextAfter: string | undefined;
  /** Whether the press under way landed in a card or on a target, as read before it acted. */
  #pressedIn = false;
  /** The focus was in cx's card as what it offers changed: it stays in the card if the action it was on is gone. */
  #refocus = false;
  /** The models the box last offered, in this page's memory only, so a sleeping box's card offers what it offered awake. */
  readonly #streamView: StreamView;
  readonly #pick: QuotePick;
  readonly #scroller = h("div", { class: "scroller" });
  readonly #bottom = h("footer", { class: "bottom" }, this.#status, this.#composer);
  readonly #window: SettingsWindow;
  /** 组织设置, the person's window's peer, which the admin of the organization in use opens. */
  readonly #organizationWindow: SettingsWindow;
  readonly #catalogue: PluginsPage;
  /** The card of what is new in the seller's plugins: asked once at the page's first opening of the conversation, put away for the day. */
  #feature: FeatureCard | undefined;
  #featureAsked = false;
  #focusDraft = false;
  /** The stretch of the composer's words to select when it takes the focus: an example's first gap, so the person types over it. */
  #draftSelect: readonly [number, number] | undefined;
  /** What the composer holds when it is empty and untouched; the canned preview names the next recorded message here. */
  suggestion: () => string | undefined = () => undefined;

  constructor(readonly root: HTMLElement, readonly backend: Backend, readonly road?: RoadTurn) {
    this.language = preferredLanguage(localStorage.getItem(LANGUAGE_KEY), navigator.languages);
    this.#switched = backend.switched();
    // A switch was pressed in the open sidebar, and the pages it starts open it again to give the keyboard back to the corner.
    this.#sidebarOpen = this.#switched || (this.#wide.matches && localStorage.getItem(SIDEBAR_KEY) !== "closed");
    this.#presumed = backend.signedInHint();
    this.#streamView = new StreamView({
      say: this.#say,
      language: () => this.language,
      account: () => (this.#me?.kind === "signed_in" ? this.#me.account : undefined),
      card: (card) => this.#cardRow(card),
      openCard: (card) => this.#openBoardCard(card),
      beneath: {
        stamp: (said) => this.#under(said).map((row) => `${rowKey(row)}:${row.stands}`).join(","),
        draw: (said) => this.#under(said).map((row) => failureUnder(this.#say, this.language, row, () => { void this.#catalogue.retry(row); })),
      },
      modelName: ({ provider, id }) => droppedName(`${provider}/${id}`, this.#glance?.models.available ?? []),
      makers: () => this.#makers,
      chooseModel: () => this.#chooseModel(),
      ...(backend.boardOpen === undefined ? {} : { openFile: (path: string) => this.#openFile(path, "chat") }),
      now: () => Date.now(),
      // The line's seconds are the card's: it is drawn again each time the card's are, from what the card drew.
      ticked: () => { if (this.#lineNow !== undefined) this.#fillLine(Date.now()); },
      day: (time) => dayName(time, Date.now(), this.language, this.#dayWords()),
      answer: (id, answer) => this.#visit.answer(id, answer),
      reachable: () => !this.#visit.unreachable && this.#visit.connection !== "reconnecting",
      holds: (key) => this.#visit.holds(key),
      late: (key) => this.#visit.late(key),
      rows: this.#rows,
    });
    this.#pick = new QuotePick({
      main: this.#page, scroller: this.#scroller,
      words: () => ({ quote: this.#say("quote.quote"), selection: this.#say("quote.selection") }),
      soon: (then) => { requestAnimationFrame(then); },
      quote: ({ key, words }) => {
        const item = this.#itemAt(key);
        if (item?.kind === "assistant" && item.entryId !== undefined) this.#quoteBox.add({ entry: item.entryId, at: key, words, who: "cx", time: item.at });
      },
    });
    this.#page.append(this.#pick.element, this.#announce);
    this.#history = new HistoryView({
      backend, say: this.#say, language: () => this.language, now: () => Date.now(),
      live: () => this.stream,
      reading: () => this.#reading,
      jump: (place) => { void this.#jump(place); },
      latest: () => (this.#currentDrawn = this.#current),
      toChat: () => { this.#toChat(); },
    });
    const me = (): SignedIn | undefined => (this.#me?.kind === "signed_in" ? this.#me : undefined);
    this.#board = new BoardView({
      backend, say: this.#say, now: () => backend.now(),
      time: (time) => rowTime(time, backend.now(), this.language, this.#dayWords()), clock: clockTime,
      day: (time) => dayName(time, backend.now(), this.language, this.#dayWords()),
      changed: () => this.#boardChanged(),
      store: {
        keys: () => Array.from({ length: localStorage.length }, (_, n) => localStorage.key(n)).flatMap((key) => (key === null ? [] : [key])),
        read: (key) => localStorage.getItem(key), write: (key, value) => localStorage.setItem(key, value), remove: (key) => localStorage.removeItem(key),
      },
      account: () => me()?.account,
      ...(backend.boardOpen === undefined ? {} : { openFile: (path: string, from: OpenedFrom) => this.#openFile(path, from) }),
      ...(backend.pagesOrigin === undefined || backend.boardPage === undefined ? {} : { frame: { origin: backend.pagesOrigin, read: (tab: string) => backend.boardPage!(tab), asks: this.#pageAsks(), plugin: (npm: string) => this.#catalogue.packageName(npm) } }),
      chose: (tab) => this.#door.chose(tab),
      pressed: (tab) => { if (this.#column.open) this.#door.pressed(tab); },
      inSight: () => this.#column.open,
      computer: {
        off: () => offOf(this.#scene?.kind),
        // The seller's 开机 or 重试 on the board is the start cx's card gives.
        wake: () => { void this.#visit.wake().then(() => this.draw()); },
        help: backend.links.help,
        floor: () => { const line = this.#boxLine(); return line === undefined ? [] : this.#linked(line); },
      },
    }, () => this.language);
    this.#column = new BoardColumn({
      say: this.#say, top: this.#chatTop, chat: this.#page, root,
      sidebarWidth: () => (this.#sidebarOpen && this.#wide.matches ? this.#sidebar.offsetWidth : 0),
      opening: () => { if (!this.#wide.matches && this.#sidebarOpen) { this.#sidebarOpen = false; this.draw(); } },
      changed: () => this.#boardChanged(),
      store: { read: (key) => localStorage.getItem(key), write: (key, value) => localStorage.setItem(key, value) },
      moved: (open) => {
        // The seller's own opening gives the board shown its door back; their closing shuts the door of a board an ask showed unpressed.
        if (!this.#doorOpening) { if (open) this.#door.opened(this.#board.tab); else this.#door.closed(); }
      },
      landing: () => this.#board.landing,
    }, this.#board.head, this.#board.page);
    // Words already in the message box are the person's: they stay, and only the cursor moves there.
    const ask = (words: string, select?: readonly [number, number]): void => {
      const empty = this.#draft.value.trim() === "";
      this.#intoBox(empty ? words : this.#draft.value, empty ? select : undefined);
    };
    // A change to the account's packages can change whether History shows titles, so History is read again with it.
    this.#catalogue = new PluginsPage({ say: this.#say, language: () => this.language, backend, me, changed: (updated) => { void this.#history.reread(); void this.#board.read(); if (updated !== undefined) this.#board.updated(updated); return this.refresh(false); }, ask, announce: (words) => { this.#announce.textContent = words; }, glanced: () => this.#drawSidebar(),
      starting: () => this.#me?.kind === "signed_in" && this.#me.box !== "pending" && this.#visit.box === "waking",
      answering: () => this.#visit.running, power: () => (this.#visit.box === "asleep" || (this.#visit.box === "awake" && this.#visit.closing) ? "off" : this.#visit.box === "waking" ? "starting" : "on"), listRead: () => { this.#drawLine(this.#lineStarting, Date.now()); if (this.route === "stream") this.#updateStream(); } });
    void backend.catalogue().then((catalogue) => { this.#makers = catalogue.words; this.#drawComposer(); }, () => undefined);
    // The identity provider's script says when it has loaded, and when what it holds of the person changes: the corner draws its photo.
    backend.watchPhoto(() => { if (this.#me?.kind === "signed_in") this.draw(); });
    const windowPorts: WindowPorts = {
      backend, say: this.#say, language: () => this.language, features: () => backend.features, me, moved: () => this.#moved(), home: root,
      power: () => (this.#visit.box === "asleep" ? "off" : this.#visit.box === "waking" ? "starting" : this.#visit.box === "awake" && this.#visit.closing ? "closing" : "on"),
      watch: (on) => { this.#sectionWatched = on; this.#watchLoad(); },
      setLanguage: (language) => this.setLanguage(language),
      appearance: () => globalThis.CmxAppearance?.read() ?? "system", setAppearance: (appearance) => globalThis.CmxAppearance?.choose(appearance),
      ready: this.#ready, signOutEverywhere: () => this.#leave(true), signOutHere: () => this.#signOut(),
      // A name saved is the corner's at once; the photo the identity provider holds is read again as the corner is drawn.
      changed: (name) => { if (name !== undefined && this.#me?.kind === "signed_in") this.#me = { ...this.#me, name }; this.draw(); },
      // The deleted seller's door says the account is deleted, not that they signed out.
      deleted: () => { void this.#leave(false, "deleted"); },
      plugin: (kind, id) => { const at = this.#catalogue.hrefFor(kind, id), name = this.#catalogue.nameFor(kind, id); return at === undefined || name === undefined ? undefined : { href: at, name }; },
      name: (kind, id) => (kind === "source" ? this.#bar.nameOf(id) : undefined),
      states: () => this.#catalogue.states(),
      // A credit can open the message box: the account is read again as sending reads it, not only as the page draws it.
      credited: () => void this.refresh(false),
      returnTo: () => (this.#sidebarOpen ? this.#foot.querySelector<HTMLElement>(".account-button") ?? undefined : this.#opener),
    };
    this.#window = new SettingsWindow(windowPorts);
    // A deleted organization is left for the person's own account, by the switch's own road, and the chat says which one went.
    this.#organizationWindow = new SettingsWindow({ ...windowPorts, kind: "organization", paying: this.#window.paying,
      organizationDeleted: (name) => { try { sessionStorage.setItem(GONE_KEY, name); } catch { /* the notice is lost, nothing else */ } void this.backend.use(null).catch(() => undefined); } });
    // The payment provider sends a seller back to `?checkout=<session>`: the window opens on the 账单 of the account in use, which reads
    // that session's answer. Which account that is is known once `/me` answers (`#drawWindow`).
    const back = new URL(location.href);
    const session = back.searchParams.get("checkout");
    if (session !== null) {
      back.searchParams.delete("checkout");
      history.replaceState(null, "", `${back.pathname}${back.search}#/settings/billing`);
      this.#paidBack = true;
      if (session !== "") { this.#window.paying.cameBack(session); this.#cameBack = session; }
    }
    this.#visit = new Visit({
      backend, now: () => Date.now(),
      account: () => this.#readAccount(),
      glance: () => { void this.#readGlance().then(() => this.draw()); void this.#board.read(); },
      board: (said) => {
        // Every page that lives hears that the board's files changed, as the board reads them again, and the chat's rows read their cards again.
        if (said === "board") { this.#board.filesChanged(); this.#staleCards(); }
        void this.#board.read();
      },
      later: (ms, then) => { const timer = setTimeout(then, ms); return () => clearTimeout(timer); },
      place: { read: () => localStorage.getItem(PLACE_KEY), write: (word) => localStorage.setItem(PLACE_KEY, word) },
      // A turn's end comes as a change of the whole visit, not of the stream: each change is looked at for it.
      changed: (what) => {
        const running = this.#visit.running;
        if (!running && this.#wasRunning) this.#catalogue.settled();
        this.#wasRunning = running;
        this.#answered(); if (what === "stream") this.#drawStream(); else this.draw();
        this.#noticeWaits();
        this.#window.followPower();
        this.#watchLoad();
      },
      heard: () => { this.#lives++; void this.#readModels(); if (this.route === "plugins") this.#catalogue.heard(); },
      life: () => { this.#lives++; void this.#readModels(); },
      spoke: () => { void this.#readThinkingRow(); },
      // A message follows the person's last choice of model: it waits until every pick they made has reached the platform.
      beforeSend: () => Promise.all([this.#picks.idle(), within(this.#thinkingSending, this.#picks.boundMs)]).then(() => undefined),
      droppedLine: (model) => this.#say("card.defaultDropped", { model: droppedName(model, this.#glance?.models.available ?? []) }),
      giveBack: (given, how, why) => {
        // A board's page's message comes back as its words, without the marker naming the board.
        const messages = given.map((message) => readFromBoard(message)?.text ?? message);
        const held = this.#draft.value;
        // A message comes back as the person wrote it: its quotes to their cards, its words to the message box. The message is the
        // record of what was not sent, so its markers are the quotes; whose words and when are the quoted entry's, read from where a
        // sent quote's time is.
        for (const message of messages) for (const quote of unquoted(message).quotes) this.#returned(quote);
        for (const message of messages) this.#uploads.returned(unquoted(message).files);
        this.#draft.value = [...messages.map((message) => unquoted(message).text).filter((words) => words !== ""), ...(held === "" ? [] : [held])].join("\n\n");
        // One the person took back themselves was not lost: nothing is said of it, and they go on writing it. One that came back
        // because the computer did not start is cx's to say, and the status line says nothing of it.
        if (how !== "asked") { this.#unsent = this.#visit.blocked === undefined; this.#unsentWhy = this.#unsent ? piWords(why) : undefined; return; }
        this.#toBox();
        this.#draft.setSelectionRange(this.#draft.value.length, this.#draft.value.length);
      },
    });
    backend.hold(() => this.#draft.value);
    backend.onPickOutcome((outcome) => this.#pickOutcome(outcome));
    this.#computer = new ComputerWindow({
      say: this.#say, does: (act) => this.#computerDoes(act), setAwake: (on, minutes) => this.#setAwake(on, minutes), close: (back) => this.#shutCard(back),
      links: { usage: "#/settings/usage/month", plugins: href.home("yours"), help: backend.links.help, size: "#/settings/computer/size", storage: "#/settings/computer/storage" },
    });
    this.#cxPlace.append(this.#ccCard, this.#computer.element);
    // The window keeps its foot over the computer: a line that comes or goes inside it while it is open moves its top, never its foot.
    new ResizeObserver(() => { if (this.#computer.opened && this.#opened === "computer") this.#overWindow(); }).observe(this.#computer.element);
    // A press in cx's card may open or shut the model's or the level's card: it is fitted to the window once drawn.
    this.#ccCard.addEventListener("click", () => requestAnimationFrame(() => this.#placeOver()));
    this.#card.element.classList.add("cc-model");
    this.#thinkingCard.element.classList.add("cc-model");
    this.#card.lead(this.#ccModelName);
    this.#thinkingCard.lead(this.#ccLevelName);
    this.#arrangeCard();
    this.#wireCx();
    this.#draft.addEventListener("input", () => { this.#slash.read(); this.#typed(); this.#drawControl(); this.#noticeWaits(); if (this.#hushNewer()) this.#drawCx(); });
    this.#scroller.addEventListener("scroll", () => {
      // A scroll the page made — a reveal, a first draw, a fill — reads nothing on; only the reader's own does.
      const byReader = this.#scroller.scrollTop !== this.#pageTop;
      this.#pageTop = undefined;
      this.#streamView.scrolled(); this.#placeSoon(); this.#atTop(byReader); this.#atBottom(byReader); this.#drawLatest();
    }, { passive: true });
    // At the top no scroll event comes, so a reach upward — the wheel, a finger drawn down the screen, or the keys that move up — is the
    // reader's scroll up. A swipe asks once, however far it goes; keys count where they move the stream, not in a field that takes them.
    this.#scroller.addEventListener("wheel", (event) => { if (event.deltaY < 0 && this.#scroller.scrollTop < 40) this.#atTop(); }, { passive: true });
    let swipeFrom: number | undefined;
    this.#scroller.addEventListener("touchstart", (event) => { swipeFrom = event.touches.length === 1 ? event.touches[0]!.clientY : undefined; }, { passive: true });
    this.#scroller.addEventListener("touchmove", (event) => {
      const at = event.touches.length === 1 ? event.touches[0]!.clientY : undefined;
      if (swipeFrom === undefined || at === undefined || at - swipeFrom < SWIPE_PX || this.#scroller.scrollTop >= 40) return;
      swipeFrom = undefined;
      this.#atTop();
    }, { passive: true });
    this.#scroller.addEventListener("keydown", (event) => {
      if (["PageUp", "ArrowUp", "Home"].includes(event.key) && !typesIn(event.target) && this.#scroller.scrollTop < 40) this.#atTop();
    });
    // The second press of a double-click on a message taken back falls on whatever moved under the pointer: it selects no word there
    // and takes no focus from the message box.
    this.#scroller.addEventListener("mousedown", (event) => { if (this.#rows.takenBack) event.preventDefault(); });
    window.addEventListener("resize", () => { this.#placeBack(); this.#placeSoon(); }, { passive: true });
    this.#scroller.append(this.#streamView.element);
    // One watch for every change of the stream's box — its own content, or the room the frame leaves it — so the latest stays in view.
    // Quote on a selection follows the view as it follows the selection: a view made smaller or larger places it again.
    const resized = new ResizeObserver(() => { this.#streamView.resized(); this.#pageMoved(); this.#pick.place(); });
    resized.observe(this.#scroller);
    resized.observe(this.#streamView.element);
    // A reason of more than one line stands higher over the conversation's foot, so the foot leaves it that much more room.
    new ResizeObserver(() => this.#roomForReason()).observe(this.#closed);
    this.#composer.addEventListener("submit", (event) => { event.preventDefault(); this.#send(); });
    this.#wireFiles();
    // A key held down is one send, and none where it was pressed on a control that then moved the focus here: its repeats send nothing.
    messageBox(document, { field: this.#draft, send: () => this.#send(), before: (event) => this.#slash.key(event) });
    // The control changes from Send to Stop under the key that pressed it: held, that key sends once and stops nothing.
    ignoreHeld(this.#control);
    this.#sidebar.addEventListener("click", (event) => { if (!this.#wide.matches && event.target instanceof Element && event.target.closest("a") !== null) this.#setSidebar(false); });
    // A window that turns narrow, as a phone does when the page is laid out after it opened, starts the sidebar closed, as a narrow load does.
    this.#wide.addEventListener("change", () => { this.#sidebarOpen = this.#wide.matches && localStorage.getItem(SIDEBAR_KEY) !== "closed"; this.draw(); });
    root.append(this.#sidebar, this.#backdrop, this.#page, this.#column.divider, this.#column.backdrop, this.#column.element, this.#bar.flight);
    // Any click is the person acting, and what cx said before it goes as the click begins: what the click itself brings about — a
    // start that fails at once — is said after it and stays.
    document.addEventListener("click", () => this.#hush(), true);
    // cx's card closes on a click anywhere else and on Escape; the account menu closes itself (`forms.ts`).
    document.addEventListener("click", () => { if (this.#opened !== undefined && !this.#pressedIn) this.#shutCard(false); });
    // A press is judged by where it landed before anything under it acts: a card that redraws under it — the model's button, a vendor's
    // step to its models, a level chosen — has taken the node it landed on out of the page by the time the press bubbles here.
    document.addEventListener("click", (event) => { this.#pressedIn = this.#inCx(event.target); }, true);
    document.addEventListener("keydown", (event) => {
      // A page whose element has left the document stops nothing: the key is the page's that is there.
      if (event.key !== "Escape" || !root.isConnected) return;
      // Escape is first the key of whatever is open: a menu, a card, a search box, a dialog, the sidebar over a narrow page or Quote on a
      // selection that takes it leaves cx at work. What took it on its own element says so by preventing the default; the rest is read
      // here before it is closed. cx's card and its computer's are read with them: they open while cx works too.
      const over = !this.#wide.matches && this.#sidebarOpen;
      const quoted = this.#pick.took(event);
      const modelOpen = this.#card.opened || this.#thinkingCard.opened;
      // History's search box holding words is open wherever the focus is: this Escape clears it as its own does, and the focus stays.
      const searched = !event.defaultPrevented && !quoted && !this.#menuOpen && !modelOpen && this.#sidebarOpen && this.#history.clearWords();
      const carded = this.#opened !== undefined;
      // The board's sheet over the chat closes; beside the chat, an Escape inside the board stops nothing.
      const boarded = !event.defaultPrevented && !quoted && !searched && !this.#menuOpen && !modelOpen && !carded && !over && this.#column.took(event);
      const taken = event.defaultPrevented || quoted || searched || this.#menuOpen || modelOpen || carded || over || boarded || document.querySelector("dialog[open]") !== null;
      // The sidebar lying over a narrow page closes as its backdrop closes it, and the button that opens it again takes the focus.
      if (over && !searched && !event.defaultPrevented && !this.#menuOpen) { this.#setSidebar(false); giveBack(this.#opener); }
      // An Escape with the model card or the level's open over cx's card closes that one alone, and cx's card stays: one with the focus
      // inside it has closed it already, and says so by preventing the key's default.
      if (carded && !modelOpen && !(event.defaultPrevented && this.#ccCard.contains(event.target as Node))) this.#shutCard(true);
      this.#tip(undefined);
      // The model card and the thinking level's hear the key only from inside themselves: open with the focus on their line, they close here.
      if (this.#card.opened) this.#card.close();
      if (this.#thinkingCard.opened) this.#thinkingCard.close();
      // A key held down is one Stop, and the Escape that ends an input method's composition is the composition's (229 is how a browser
      // that has already ended it reports that key).
      if (taken || event.repeat || event.isComposing || event.keyCode === 229 || this.route !== "stream" || !this.#visit.stoppable) return;
      event.preventDefault();
      this.#stop();
    });
    // A page taken down draws nothing more: the address is the page that stands now.
    window.addEventListener("hashchange", () => { if (root.isConnected) this.#moved(); });
    // A link to settings anywhere on the page opens the window over the page it is on, as the menu's 设置 does.
    root.addEventListener("click", (event) => {
      const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href^='#/settings'], a[href^='#/organization']");
      if (link === null || link === undefined || event.defaultPrevented || this.#window.element.contains(link) || this.#organizationWindow.element.contains(link)) return;
      event.preventDefault();
      const href = link.getAttribute("href")!;
      (organizationAddress(href) ? this.#organizationWindow : this.#window).open(href);
    });
    // Shown again, a page whose box was last heard asleep catches up on what happened meanwhile.
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.#visit.show(); });
  }

  /** The board read and opened: the preview draws its states so. */
  async showBoard(): Promise<void> {
    await this.#board.read();
    this.#column.set(true);
  }

  /** What the stream holds: the preview draws a recording into it. */
  get stream(): StreamState { return this.#visit.stream; }
  get connection(): Connection { return this.#visit.connection; }
  set connection(connection: Connection) { this.#visit.connection = connection; }

  #moved(): void { this.#pick.hide(); if (this.route !== "plugins") this.#catalogue.leave(); this.draw(); this.#showPage(); }
  /** Settings is a window over the page: its address holds the window, and its entry the page under it. */
  get #windowed(): boolean { return windowAddress(location.hash) || organizationAddress(location.hash); }
  /** The address of the page drawn in the main area: under the settings window, the page the window was opened over. */
  get #pageHash(): string { return this.#windowed ? underOf(history.state) : location.hash; }
  get route(): "stream" | "plugins" { return this.#pageHash.startsWith("#/plugins") ? "plugins" : "stream"; }

  setLanguage(language: Language): void {
    this.language = language;
    localStorage.setItem(LANGUAGE_KEY, language);
    this.#streamView.redraw();
    this.draw();
  }

  #setSidebar(open: boolean): void {
    this.#sidebarOpen = open;
    if (open && !this.#wide.matches && this.#column.open) this.#column.set(false);
    // Only a choice made with room for it is a preference; on a narrow screen the sidebar is opened for one look and closes again.
    if (this.#wide.matches) localStorage.setItem(SIDEBAR_KEY, open ? "open" : "closed");
    this.draw();
    // Opened on a narrow screen, the sidebar takes the focus from the button that opened it: the row being read, or History's heading.
    if (open && !this.#wide.matches) this.#history.focusIn();
  }

  /**
   * Reads the account and connects the stream from the page's place: the earlier exchange is on screen at once, and a box that runs speaks
   * on the same connection. Nothing here opens the box: the person's first message does, or cx clicked.
   */
  async start(): Promise<void> {
    const carried = this.backend.carried();
    if (carried !== undefined) { this.#draft.value = carried.draft; if (carried.unsent !== undefined) this.#visit.resend(carried.unsent); }
    this.#showPage();
    // Back from renewing the session only to sign out: that is all this visit does. A sign-out that failed is said, and the person, still
    // signed in, goes on with the visit.
    if (this.backend.leaving()) {
      // A visit back only to sign out stays here: the road would take the page away before the sign-out ends.
      this.#leavingVisit = true;
      await this.refresh(); await this.#leave(); if (!this.#leaveFailed) return;
    }
    this.draw();
    this.#tellGone();
    await this.#visit.look();
  }

  /** An organization deleted before the switch's load is said once, on the person's own page. */
  #tellGone(): void {
    let name: string | null = null;
    try { name = sessionStorage.getItem(GONE_KEY); sessionStorage.removeItem(GONE_KEY); } catch { return; }
    if (name === null) return;
    const notice = toast();
    this.root.append(notice.element);
    notice.tell(this.#say("orgs.deleted", { org: name }));
  }

  #showPage(): void {
    if (this.route === "plugins") this.#showPlugins();
  }

  /**
   * What the sidebar and the composer show at a glance; one that could not be read leaves what was read before. The models are read on
   * their own, so no field waits on them: the row draws the models already drawn, else the answer the current wake or life took, else none
   * until that life's read answers, which then writes it as any models answer does.
   */
  async #readGlance(): Promise<void> {
    const mark = this.#picks.mark;
    const turn = this.#thinkingTurn;
    const lives = this.#lives;
    void this.#readModels();
    // The sources bar and the sidebar's Plugins dot draw their own reads as they answer: the card and the composer row wait for neither.
    void this.#sourcesReads.refresh();
    void this.#catalogue.glance().then(() => this.#drawSidebar(), () => undefined);
    try {
      const [providers, accounts, ticked, pending, offer, thinking] = await Promise.all([
        this.backend.providers().catch(() => this.#glance?.providers), this.backend.accounts().catch(() => this.#glance?.accounts ?? []),
        this.backend.vendors().catch(() => this.#glance?.ticked), this.backend.pendingPick().catch(() => this.#glance?.pending),
        this.backend.chatOffer().catch(() => this.#glance?.offer), this.backend.pendingThinking().catch(() => undefined),
      ]);
      // The newest answer applied, which a later read may have given while the rest of the glance was still coming.
      const sources = this.#sourcesReads.latest ?? this.#glance?.sources ?? [];
      const taken = this.#modelsTaken?.lives === this.#lives ? this.#modelsTaken.models : undefined;
      this.#glance = afterRead(this.#glance, { sources, models: this.#glance?.models ?? taken ?? NO_MODELS, providers, accounts, ticked, pending: drawnPick(pending, offer), offer }, mark !== this.#picks.mark);
      // Asked of a pi the box has since left or woken from, the level is not drawn; the read the wake began answers for the pi there is.
      if (lives === this.#lives && thinking !== undefined) this.#thinkingRead(thinking, turn);
    } catch { /* the last glance stands */ }
  }

  /**
   * The account alone, for a reconnect: a lapsed session is renewed from `/me`'s 401, and nothing else needs reading again. The visit
   * holds the same answer, so the composer's Send, its message box and the floor's refusal read one account whichever read brought it.
   */
  #leavingVisit = false;
  /** The payment session the provider sent the person back from: an account still on the road reads its answer there. */
  #cameBack: string | undefined;
  /** The provider's return is waiting for `/me` to say whose 账单 it lands on. */
  #paidBack = false;
  async #readAccount(): Promise<Me | undefined> {
    const order = ++this.#accountAsked;
    try {
      // The accounts the sign-in holds wait on the identity SDK, which may load late or never: the account and the stream do not wait on
      // them, and the corner draws them when they come, unless a newer account read was taken first.
      const spaces = this.backend.spaces().catch(() => undefined);
      const [me, money] = await Promise.all([this.backend.me(), this.backend.accountMoney().catch(() => undefined)]);
      // An answer older than one already taken would draw a balance that has since moved.
      if (order < this.#accountTaken) return this.#me;
      this.#accountTaken = order;
      // Another person signed in on this browser, as in another tab: all the page holds is the last one's, so it starts again as them.
      if (me.kind === "signed_in" && (this.#person ??= me.account) !== me.account) { this.backend.again(); return await new Promise<never>(() => {}); }
      this.#me = me;
      // An account without a computer is on the road to it, unless the person skipped it for this page load (`road.ts`).
      if (me.kind === "signed_in" && me.box === "pending" && this.road?.skipped === false && !this.#leavingVisit) this.road.go(this.#cameBack);
      this.#visit.me = me;
      this.#money = money;
      void spaces.then((held) => {
        if (order !== this.#accountTaken || JSON.stringify(held) === JSON.stringify(this.#spaces)) return;
        this.#spaces = held;
        this.draw();
      });
      this.#inviting = inviting(money);
      const lapsed = money?.state === "free" && money.free?.why === "membership_ended";
      if (!lapsed) {
        this.#subscription = undefined;
        return me;
      }
      // A lapsed account's membership draws only the composer's line: the account answers without it, the stream connecting meanwhile,
      // and it draws when it answers, unless a newer account read was taken first.
      void this.backend.subscription().catch(() => undefined).then((subscription) => {
        if (order !== this.#accountTaken) return;
        this.#subscription = subscription;
        this.draw();
      });
      return me;
    } catch {
      return undefined;
    }
  }

  /**
   * A message applied the pending pick: pi now runs on it, or refused it and stays on its model. The page drops its copy of the pick and
   * says a refusal; a pick taken reads the models again for pi's level on it.
   */
  #pickOutcome(outcome: PickOutcome): void {
    const glance = this.#glance;
    const pick = glance?.pending;
    if (glance !== undefined && pick !== undefined) {
      const models = outcome === "taken" ? { ...glance.models, current: { provider: pick.provider, id: pick.modelId } } : glance.models;
      this.#glance = outcome === "taken" ? { ...glance, models, pending: undefined, taken: pick } : { ...glance, models, pending: undefined };
    }
    if (this.#picks.heard(outcome) || pick !== undefined) this.#drawComposer();
    if (outcome === "taken" && this.#visit.awake) void this.#readModels();
  }

  /** A box just heard answers for its own models, which a read while it slept could not ask. */
  async #readModels(): Promise<void> {
    const mark = this.#picks.mark;
    const turn = this.#thinkingTurn;
    const lives = this.#lives;
    const read = await Promise.all([this.backend.models(), this.backend.pendingPick().catch(() => this.#glance?.pending), this.backend.chatOffer().catch(() => this.#glance?.offer), this.backend.pendingThinking().catch(() => undefined)]).catch(() => undefined);
    // A read refused leaves the row as it was; one asked of a pi the box has since left or woken from answers for none: the read the wake
    // began answers for the pi there is.
    if (read === undefined || lives !== this.#lives) return;
    const [models, pending, offer, thinking] = read;
    this.#modelsTaken = { lives, models };
    if (this.#glance !== undefined) this.#glance = afterRead(this.#glance, { ...this.#glance, models, pending: drawnPick(pending, offer), offer }, mark !== this.#picks.mark);
    this.#thinkingAnswer(models);
    if (thinking !== undefined) this.#thinkingRead(thinking, turn);
    this.#drawComposer();
  }

  /**
   * The level and its levels come with the models answer; one that names no level, as a read while the box sleeps, leaves the last. A level
   * without a usable set is still the box's word, with no levels to offer, so no selector is drawn until an answer brings a set.
   */
  #thinkingAnswer(models: Models): void {
    if (models.thinkingLevel === undefined) return;
    const on = models.current === undefined ? {} : { on: { provider: models.current.provider, id: models.current.id } };
    this.#thinkingWord = { level: models.thinkingLevel, levels: models.thinkingLevels ?? [], seen: lastThinkingRecord(this.#visit.stream.items)?.key, ...on };
  }

  /** What the account's list says of the thinking level, read alone: the box said it ended an entry. */
  async #readThinkingRow(): Promise<void> {
    const turn = this.#thinkingTurn;
    const row = await this.backend.pendingThinking().catch(() => undefined);
    if (row === undefined) return;
    this.#thinkingRead(row, turn);
    this.#drawComposer();
  }

  /**
   * The list read: a press whose entry has left it was ended by the box. pi refused it, which is said, its level as it was; otherwise pi's
   * word of its level is the models answer's, read again for it, and the press stands until that answer comes. The end says nothing of the
   * level drawn: pi may have moved since. A read begun before the latest press, or before its answer named its entry, changes nothing.
   */
  #thinkingRead(row: RowThinking, turn: number): void {
    if (turn !== this.#thinkingTurn) return;
    this.#thinkingRow = row;
    const press = this.#thinkingPress;
    if (press?.id === undefined || press.ended === true || row.waiting?.id === press.id) return;
    this.#thinkingTurn++;
    if (row.end?.reason === THINKING_REFUSED) {
      this.#thinkingPress = undefined;
      this.#thinkingKept = true;
      return;
    }
    const ended = { ...press, ended: true as const };
    this.#thinkingPress = ended;
    void this.#readModels().catch(() => {}).then(() => {
      if (this.#thinkingPress === ended) this.#thinkingPress = undefined;
      this.#drawComposer();
    });
  }

  /**
   * The level as drawn, awake or asleep, as the model card draws its model: a level waiting in the account's list, the person's own press
   * first, over pi's word of it — the models answer's, or pi's later record — with the levels from the answer, and clamped to them as pi
   * clamps a level to the model's, so the page draws the level pi will run.
   */
  #thinkingDrawn(levels: readonly string[] | undefined, named: { readonly provider: string; readonly id: string } | undefined): { readonly thinking: Thinking; readonly kept: boolean } | undefined {
    // pi's word is of the model it runs; while the card names another, a pick waiting, the levels are that model's record's.
    const live = this.#thinkingWord;
    const word = live !== undefined && (live.on === undefined || named === undefined || (live.on.provider === named.provider && live.on.id === named.id)) ? live : this.#thinkingGuess(levels) ?? live;
    if (word === undefined) return undefined;
    const waiting = this.#thinkingPress?.level ?? this.#thinkingRow.waiting?.level;
    const record = lastThinkingRecord(this.#visit.stream.items);
    const said = record !== undefined && record.key !== word.seen ? record.level : word.level;
    const level = waiting ?? said;
    return { thinking: { level: clamped(level, word.levels) ?? level, levels: word.levels }, kept: waiting === undefined && this.#thinkingKept && this.#visit.awake };
  }

  /**
   * Before any box has said its level on this page, asleep or not yet answering, the level pi would start on: the one the box last wrote
   * as the account's default (the settings file, which a sleeping box cannot be asked, holds the level of the last entry it ended ok),
   * else pi's own default, clamped to the model in use, among pi's levels on that model from the box's catalogue. The box's own level
   * takes its place when it comes, with or without a set.
   */
  #thinkingGuess(levels: readonly string[] | undefined): { readonly level: string; readonly levels: readonly string[]; readonly seen: undefined } | undefined {
    if (levels === undefined) return undefined;
    const end = this.#thinkingRow.end;
    const level = clamped(end?.ok === true ? end.level : PI_DEFAULT, levels);
    return level === undefined ? undefined : { level, levels, seen: undefined };
  }

  /**
   * One press: the level is drawn at once and goes to the platform, which keeps it in the account's list for the box, as a pick: one at a
   * time, the latest replacing any not yet sent, and a message waits for it. A press the platform did not take leaves the level as it was.
   */
  #chooseThinking(level: string): void {
    this.#thinkingKept = false;
    this.#thinkingPress = { level };
    this.#thinkingTurn++;
    this.#thinkingNext = level;
    this.#thinkingSending ??= this.#sendThinking();
    this.#drawComposer();
  }

  async #sendThinking(): Promise<void> {
    for (let level = this.#thinkingNext; level !== undefined; level = this.#thinkingNext) {
      this.#thinkingNext = undefined;
      const press = this.#thinkingPress;
      const entry = await this.backend.chooseThinking(level).catch(() => undefined);
      if (this.#thinkingPress === press) {
        this.#thinkingPress = entry === undefined ? undefined : { level, id: entry.id };
        this.#thinkingTurn++;
        // The box may have ended it before the answer came: the list says so.
        void this.#readThinkingRow();
      }
      this.#drawComposer();
    }
    this.#thinkingSending = undefined;
  }

  /** The answer to the person's last pick corrects the line. */
  #picked(pick: Choice, answer: PickAnswer): void {
    if (this.#glance !== undefined) this.#glance = afterPick(this.#glance, pick, answer);
    // pi on another model is at another level, which comes with the models answer.
    if (answer === "taken" && this.#visit.awake) void this.#readModels();
    this.#drawComposer();
  }

  /** Reads the account again: the balance, the box, whether anyone is signed in, and what the sidebar and the composer show at a glance. */
  async refresh(pages = true): Promise<void> {
    const me = await this.#readAccount();
    this.#visit.unreachable = me === undefined;
    // Out of reach is read again until the platform answers, as the visit's own look reads it.
    if (me === undefined) void this.#visit.look();
    // The account answered, the glance and the Plugins page read side by side, each drawn as it answers.
    const glance = me?.kind === "signed_in" ? this.#readGlance().then(() => this.draw()) : undefined;
    const page = me !== undefined && pages && this.route === "plugins" ? this.#catalogue.load().then(() => this.draw()) : undefined;
    this.draw();
    await Promise.all([glance, page]);
  }

  #showPlugins(): void {
    const named = catalogueRoute(this.#pageHash) ?? HOME;
    // No card stands over the page where the chat's models are chosen.
    if (named.kind === "chat" && !this.#windowed && cardOf(location.hash) !== undefined) history.replaceState(history.state, "", withoutCard(location.hash));
    this.#catalogue.show(named);
  }

  /** A new connection from the page's place. */
  connect(): void { this.#visit.connect(); }

  /** A frame of the stream, as the preview draws a recording. */
  receive(event: StreamEvent): void { this.#visit.receive(event); }

  #cxTarget(name: CxTarget): SVGElement & HTMLOrSVGElement { return this.#cx.scene!.targets[name] as SVGElement & HTMLOrSVGElement; }

  #inCard(node: Node): boolean { return this.#ccCard.contains(node) || this.#computer.element.contains(node); }

  #inCx(node: EventTarget | null): boolean { return node instanceof Node && (this.#inCard(node) || this.#cxBubble.contains(node) || CX_TARGETS.some((name) => this.#cxTarget(name) === node)); }

  /**
   * The computer and cx are each a target, and a click, Enter or Space on either only ever opens its card: nothing is switched by the
   * press itself. The keys act as they come up and a held key does nothing, so the key that opens a card is released before the focus
   * lands on an action and chooses nothing there. A hover, or a focus the keyboard brought, shows the card's title where the card opens.
   */
  #wireCx(): void {
    let armed: CxTarget | undefined;
    const pressed = (event: Event): boolean => { const key = (event as KeyboardEvent).key; return key === "Enter" || key === " "; };
    for (const name of CX_TARGETS) {
      const target = this.#cxTarget(name);
      target.addEventListener("mouseenter", () => this.#tip(name));
      target.addEventListener("mouseleave", () => this.#tip(undefined));
      target.addEventListener("focus", () => { if (byKeyboard(target)) this.#tip(name); });
      target.addEventListener("blur", () => { armed = undefined; this.#tip(undefined); });
      target.addEventListener("click", () => this.#toggleCard(name));
      target.addEventListener("keydown", (event) => { if (!pressed(event)) return; event.preventDefault(); if (!(event as KeyboardEvent).repeat) armed = name; });
      target.addEventListener("keyup", (event) => { if (!pressed(event) || armed !== name) return; armed = undefined; this.#toggleCard(name); });
    }
    // The focus taken somewhere else closes the card, the other target included, and stays where it was put, a Tab out of the card as much
    // as a click; one that only went nowhere, as a redraw or a pointer's press makes it, does not, nor one on the target the card opened
    // from, whose own press closes it.
    document.addEventListener("focusout", (event) => {
      const to = event.relatedTarget;
      if (this.#opened === undefined || !this.#inCx(event.target) || !(to instanceof Node) || this.#inCard(to) || to === this.#cxTarget(this.#opened)) return;
      this.#shutCard(false);
    });
  }

  #tip(name: CxTarget | undefined): void {
    if (this.#tipped === name) return;
    this.#tipped = name;
    this.#drawTip();
    this.#placeOver();
  }

  #toggleCard(name: CxTarget): void { if (this.#opened === name) this.#shutCard(true); else this.#openCard(name); }

  /**
   * A card opens with the focus on its first action; one with nothing to do leaves the focus on its target, and its line is read out.
   * cx's card takes the focus itself, as a dialog does, and Tab walks its controls from there.
   */
  #openCard(name: CxTarget): void {
    this.#said = this.#said?.stays === "act" ? undefined : this.#said;
    this.#hushNewer();
    this.#opened = name;
    this.#tipped = undefined;
    // The draw reads the figure: nothing has been read for this opening.
    this.#contextAfter = undefined;
    // The window's reads start before its first drawing, so that drawing holds nothing an earlier opening was answered.
    const computer = this.#surface(name) === this.#computer.element;
    if (computer) this.#readComputer();
    this.#drawCx();
    if (this.#surface(name) === this.#ccCard) { this.#ccCard.focus({ preventScroll: true }); return; }
    if (computer) { this.#computer.open(); this.#placeOver(); this.#watchLoad(); }
  }

  /**
   * How full the context is, asked of pi while cx's card is open and the computer is on: as the card opens, and again once a compaction
   * or a turn has ended. The figure last read stays drawn until the next read answers, and an answer with no figure leaves none; only the
   * newest read is drawn.
   */
  #readContext(): void {
    const drawn = this.#scene;
    if (this.#opened !== "cx" || (drawn?.kind !== "on" && drawn?.kind !== "working")) return;
    this.#contextAfter = `${this.#visit.compactions} ${this.#visit.atWork}`;
    const ask = ++this.#contextAsk;
    void this.backend.command({ type: "get_session_stats" }).then(contextFill, () => undefined).then((context) => {
      if (ask !== this.#contextAsk || this.#opened !== "cx") return;
      this.#context = context;
      this.#drawCard();
    });
  }

  /**
   * What the computer's window reads as it opens, beside what the page holds: 永不 and the idle minutes as the account holds them, the
   * month's figure as 用量 reads it under 本月, and how many plugins are installed. A read that fails leaves its part unsaid.
   */
  #readComputer(): void {
    // One count orders the window's asks: each opening and each change of the idle setting takes the next. The idle setting is drawn
    // from the newest ask's answer alone, so an older read or change cannot replace a newer one; the month and the plugins only from
    // the opening still shown.
    // What the last opening read stays drawn while this one's reads are on their way, and an answer that reads the same draws nothing.
    // The parts held are drawn too, the window's last else the page's own account read's, until this opening's read of them answers.
    const ask = ++this.#computerAsk;
    const me = this.#me?.kind === "signed_in" ? this.#me : undefined;
    const held = this.#computerRead.parts ?? me?.parts;
    this.#computerRead = { ...this.#computerRead, ...(held === undefined ? {} : { parts: this.#asRuns(held) }), opened: ask, reading: true };
    this.#restartComing = false;
    const took = (part: ComputerRead): void => {
      if (this.#computerRead.opened !== ask || (part.awake !== undefined && ask !== this.#computerAsk)) return;
      const read = { ...this.#computerRead, ...part };
      if (JSON.stringify(read) === JSON.stringify(this.#computerRead)) return;
      this.#computerRead = read;
      this.#drawCard();
      this.#placeOver();
    };
    void this.backend.keptAwake().then((awake) => took(awake === undefined ? {} : { awake }), () => undefined);
    void this.backend.spending("month").then((spent) => took({ month: spent.kinds.box_time + spent.kinds.box_storage }), () => undefined);
    // A computer up before its tree is the model user's answers that it is not yet, and is asked again as the Plugins page asks it, for
    // as long as this opening is shown.
    const plugins = (): void => {
      void this.backend.packages().then((list) => took({ plugins: list.packages.length }), (error: unknown) => {
        if (!(error instanceof ComputerPending)) return;
        setTimeout(() => { if (this.#computerRead.opened === ask && this.#opened === "computer") plugins(); }, PENDING_AGAIN_MS);
      });
    };
    plugins();
    // The parts as Fly says them now: the page's own account read may be from before the computer was switched on.
    this.#partsFrom(this.backend.me());
  }

  /** The computer's state as the open window last saw it; none while the window is shut. */
  #windowBox: Visit["box"] | undefined;
  /** Counts the reads the window takes its parts from: an answer is taken only if no later read was asked. */
  #partsAsk = 0;
  /** A restart under way until its computer is next seen running: the restart reads the account itself, so that coming on reads nothing more. */
  #restartComing = false;

  /** The processor's and the memory's figures are a running computer's alone: one asleep or starting keeps only its storage's. */
  #asRuns(parts: Parts): Parts {
    if (this.#visit.box !== "asleep" && this.#visit.box !== "waking") return parts;
    const { cpu: _cpu, memory: _memory, ...kept } = parts;
    return kept;
  }

  /**
   * The parts from an account read, taken while the same opening shows and no later read of them was asked; a read with none leaves
   * what the window holds. The hourly price is that same answer's alone, and an answer with none clears the one shown.
   */
  #partsFrom(read: Promise<Me | undefined>): void {
    const opened = this.#computerRead.opened, order = ++this.#partsAsk;
    const done = (): void => { if (this.#computerRead.opened === opened && order === this.#partsAsk) this.#computerRead = { ...this.#computerRead, reading: false }; };
    void read.then((me) => {
      if (me?.kind !== "signed_in" || this.#computerRead.opened !== opened) { done(); this.#drawCard(); return; }
      if (order === this.#partsAsk) this.#computerRead = { ...this.#computerRead, ...(me.parts === undefined ? {} : { parts: this.#asRuns(me.parts) }), rate: me.hourUnits === undefined ? {} : { units: me.hourUnits } };
      done();
      // Drawn even with no parts: the same answer brings 开机时间.
      this.#drawCard();
      this.#placeOver();
    }, () => { done(); this.#drawCard(); });
  }

  /**
   * The open window follows its computer: one that goes to sleep keeps its storage's figure and drops the processor's and the memory's,
   * and one that comes on — from asleep or waking to awake, not back from a lost connection or a first read — is read once then, which
   * also brings 开机时间. A restart reads the account itself, however long its computer takes to be seen running.
   */
  #followComputer(): void {
    const box = this.#visit.box, was = this.#windowBox;
    this.#windowBox = box;
    const parts = this.#computerRead.parts;
    if ((box === "asleep" || box === "waking") && (parts?.cpu !== undefined || parts?.memory !== undefined)) this.#computerRead = { ...this.#computerRead, parts: this.#asRuns(parts) };
    if (box !== "awake" || (was !== "asleep" && was !== "waking")) return;
    if (this.#restartComing) this.#restartComing = false;
    else this.#partsFrom(this.#readAccount());
  }

  /**
   * While cx's computer is shown, in its window or in Settings, and it is on, the account is read again on the supplier's beat for the
   * processor's and the memory's figures. This one place decides the beat for both: it is asked again whenever the visit changes, the
   * window opens or Settings shows or leaves the section, so the beat starts when the computer comes on with either shown and stops
   * when neither is shown or the computer is not on.
   */
  #watchLoad(): void {
    const shown = (): { readonly window: boolean; readonly any: boolean } => {
      const window = this.#computer.opened && this.#opened === "computer";
      return { window, any: (window || this.#sectionWatched) && this.#visit.box === "awake" && !this.#visit.closing };
    };
    if (!shown().any) { clearTimeout(this.#loadTimer); this.#loadTimer = undefined; return; }
    if (this.#loadTimer !== undefined) return;
    const tick = (): void => {
      const now = shown();
      if (!now.any) { this.#loadTimer = undefined; return; }
      const read = this.#readAccount();
      if (now.window) this.#partsFrom(read);
      void read.then((me) => { if (me?.kind === "signed_in" && this.#sectionWatched) this.#window.watched(me); }, () => undefined);
      this.#loadTimer = setTimeout(tick, LOAD_EVERY_MS);
    };
    this.#loadTimer = setTimeout(tick, LOAD_EVERY_MS);
  }

  #windowView(drawn: Scene): WindowView {
    const me = this.#me?.kind === "signed_in" ? this.#me : undefined;
    // Money as 用量 prints it, so the month's figure reads here as it does there.
    const now = this.backend.now();
    const w = me === undefined ? undefined : writer({ language: this.language, say: this.#say, money: me.money, year: new Date(now).getFullYear() });
    const money = (units: number | undefined): string | undefined => (w === undefined || units === undefined ? undefined : w.money(units));
    const due = this.#visit.sleepDueAt;
    return {
      kind: this.#restarting ? "restarting" : this.#switchingOff ? "closing" : drawn.kind, left: due === undefined ? undefined : due - Date.now(), asking: this.#visit.asked !== undefined,
      awake: this.#computerRead.awake, newer: me?.newer === true, hour: money(this.#computerRead.rate?.units), month: money(this.#computerRead.month),
      // The day and the time with a space between them in both languages, as the window's signed line reads: "Today 14:02".
      since: me?.onSince === undefined ? undefined : `${dayName(me.onSince, now, this.language, this.#dayWords())} ${clockTime(me.onSince)}`,
      plugins: this.#computerRead.plugins, parts: this.#computerRead.parts, size: me?.size, larger: me?.size !== undefined && me.sizes?.some((one) => one.cpus > me.size!.cpus || one.memoryMb > me.size!.memoryMb) === true, reading: this.#computerRead.reading === true, state: drawn.state, dot: drawn.signals.dot, reason: drawn.signals.reason, lang: this.language,
    };
  }

  /** A press in the window: a restart is the window's to watch until it ends; the rest are the card's actions. */
  #computerDoes(act: Exclude<WindowAct, "help">): void {
    if (act === "restart" || act === "stopRestart") { void this.#restart(); return; }
    const visit = this.#visit;
    if (act === "off" || act === "stopOff") { void this.#switchOff(act); return; }
    void visit.wake().then(() => this.draw());
  }

  /** 关机 or 停止并关机, said as one span from the press to the answer, whatever the computer says on the way (it goes dark before it answers). */
  async #switchOff(act: "off" | "stopOff"): Promise<void> {
    if (this.#switchingOff) return;
    this.#switchingOff = true;
    this.#drawCx();
    await (act === "off" ? this.#visit.sleep() : this.#visit.stopAndSleep()).catch(() => undefined);
    this.#switchingOff = false;
    this.draw();
  }

  /** The account is read again once the computer is back: it says then whether it runs the platform's image, and since when. */
  async #restart(): Promise<boolean> {
    if (this.#restarting) return false;
    this.#restarting = true;
    this.#hushNewer();
    this.#restartComing = this.#windowBox !== undefined;
    this.#drawCx();
    const on = await this.#visit.restart().catch(() => false);
    // A restart that left its computer asleep brings nothing on: a start pressed after it is the window's to read.
    if (this.#visit.box === "asleep") this.#restartComing = false;
    const read = this.#readAccount();
    this.#partsFrom(read);
    await read;
    this.#restarting = false;
    this.draw();
    return on;
  }

  /** 永不 or a time, written for the account; the window then holds what the platform answered. */
  async #setAwake(on: boolean, minutes: number): Promise<void> {
    const ask = ++this.#computerAsk;
    const row = await this.backend.setAwake(on, minutes);
    if (ask !== this.#computerAsk) return;
    const awake: Awake = { ...this.#computerRead.awake, ...(row?.on === undefined ? { on } : { on: row.on }), minutes: row?.minutes ?? minutes };
    this.#computerRead = { ...this.#computerRead, awake };
    this.#drawCard();
  }

  /**
   * The computer's window stands over the chat, its left edge with the desk's, its foot just over the computer, never past the window's
   * edges and never over the message box: where the room above is short, its body scrolls within it.
   */
  #overWindow(): void {
    const node = this.#computer.element;
    const at = this.#cxTarget("computer").getBoundingClientRect();
    node.style.maxHeight = `${Math.max(WINDOW_LEAST, at.top - CARD_GAP - CARD_EDGE)}px`;
    const left = this.#status.getBoundingClientRect().left;
    node.style.left = `${Math.max(CARD_EDGE, Math.min(left, innerWidth - node.offsetWidth - CARD_EDGE))}px`;
    node.style.top = `${Math.max(CARD_EDGE, at.top - CARD_GAP - node.offsetHeight)}px`;
    this.#computer.fit();
  }

  /** Opens the model card from cx's card, which opens first: the control lives on its row. */
  #chooseModel(): void {
    if (this.#opened !== "cx") this.#openCard("cx");
    this.#card.open();
    this.#fitMenus();
  }

  /** The model's or the level's card rises over cx's card where the window has room above it, and covers the card where it has not. */
  #fitMenus(): void {
    const menu = this.#ccCard.querySelector<HTMLElement>(".open > .mp-card");
    const above = this.#ccCard.getBoundingClientRect().top - CARD_EDGE - MENU_GAP;
    this.#ccCard.classList.toggle("low", menu !== null && menu.scrollHeight > above);
  }

  /** Closed by the person's own key or choice, the focus goes back to the target the card opened from; closed by a click or a focus elsewhere, it stays where they put it. */
  #shutCard(back: boolean): void {
    const name = this.#opened;
    if (name === undefined) return;
    this.#opened = undefined;
    // The model card and the level's close with cx's card; the context's figure stays drawn and is asked again at the next opening.
    if (this.#card.opened) this.#card.close();
    if (this.#thinkingCard.opened) this.#thinkingCard.close();
    this.#computer.close();
    this.#computerAsk++;
    this.#contextAsk++;
    this.#drawCx();
    if (back) this.#cxTarget(name).focus({ preventScroll: true });
  }

  /** What cx said of a start that did not happen goes when the person does something: types, clicks or sends. */
  #hush(): void {
    if (this.#said?.stays !== "act") return;
    this.#said = undefined;
    this.#drawCx();
  }

  /** cx says again that the page is reconnecting: a Send met a platform out of reach. */
  #sayReconnecting(): void {
    this.#said = { key: "status.reconnecting", stays: "moment", until: Date.now() + READY_WORD_MS };
    this.#drawCx();
  }

  /** A keystroke in the composer: cx's next hand strikes, and it types on until the person has stopped a moment. */
  #typed(): void {
    this.#hush();
    clearTimeout(this.#typing);
    this.#typing = setTimeout(() => { this.#typing = undefined; this.#drawCx(); }, TYPING_MS);
    this.#drawCx();
    if (this.#scene?.signals.typing === true) this.#cx.scene!.tap();
  }

  /** An action chosen from a card: the card closes, the focus goes back to its target, and the page draws again when the box has answered. Help is a link, and goes where the account menu's goes. */
  #does(act: Exclude<Act, "help">): void {
    const visit = this.#visit;
    // A tidy is watched on cx's card: it stays open, its first row changed in place as the tidy runs and ends.
    if (act !== "compact") this.#shutCard(true);
    const done: Promise<unknown> = act === "on" || act === "retry" ? visit.wake() : act === "off" ? visit.sleep() : act === "stopOff" ? visit.stopAndSleep() : act === "stop" ? visit.stop() : visit.compact();
    void done.then(() => this.draw());
  }

  #words(said: Word): string { return this.#say(said.key, said.values); }

  /**
   * cx at its computer, from what the page already knows (`scene`): the drawing, each target's card, and what cx says as a kind begins.
   * A word that goes by itself lasts a few seconds, and the page draws again at its end and as each minute of the computer's time left
   * passes. An open card whose actions the new drawing changes closes, so a press does what its label said when it was aimed; where
   * only its words change it stays.
   */
  /** Why cx's computer is off as the corner reads it, in the words the page prints for each cause; nothing where it has none. */
  #offWhy(): UploadWhy | undefined {
    const visit = this.#visit;
    const me = this.#me?.kind === "signed_in" ? this.#me : undefined;
    const kind = kindOf({ pending: me?.box === "pending", box: visit.box, closing: visit.closing, atWork: visit.atWork, refusal: visit.blocked, floor: me?.balance?.can_open === false, unreachable: visit.unreachable || visit.connection === "reconnecting" });
    return kind === "balance" ? "cx.say.balance" : kind === "unreachable" || kind === "unreachableAsleep" ? "status.unreachable" : kind === "refused" ? "cx.say.refused" : kind === "failed" ? "cx.say.failed" : undefined;
  }

  #drawCx(): void {
    const visit = this.#visit;
    const me = this.#me?.kind === "signed_in" ? this.#me : undefined;
    const balance = me?.balance;
    const now = Date.now();
    const low = balance !== undefined && me !== undefined && balance.available < 100 * me.money.unitsPerMinor;
    const was = this.#scene;
    const drawn = scene({
      pending: me?.box === "pending", box: visit.box, closing: visit.closing, stream: visit.stream, atWork: visit.atWork, refusal: visit.blocked,
      floor: balance?.can_open === false, unreachable: visit.unreachable || visit.connection === "reconnecting", asking: visit.asked !== undefined,
      low, typing: this.#typing !== undefined, draft: this.#draft.value.length, sleepDueAt: visit.sleepDueAt, now, restarting: this.#restarting, switchingOff: this.#switchingOff,
      newer: this.#newerWaits(me),
    });
    this.#scene = drawn;
    // The board's place follows the computer: drawn again as it goes off or changes how it is off, and read again as it comes on. The
    // visit can speak before the board is made.
    const board = this.#board as BoardView | undefined;
    if (board !== undefined && offOf(was?.kind) !== offOf(drawn.kind)) { if (offOf(drawn.kind) === undefined) void board.read(); else board.draw(); }
    if (was?.speaks !== drawn.speaks) {
      const word = begins(was?.speaks, drawn.speaks);
      this.#said = word === undefined ? undefined : { ...word, until: word.stays === "moment" ? now + READY_WORD_MS : Infinity };
    }
    // Nothing is said in the computer's last minute before its own sleep: a word already up ends as the minute begins. Nor while the
    // line beside cx says why the box takes no message: it is said there once.
    const last = drawn.kind === "on" && visit.sleepDueAt !== undefined && visit.sleepDueAt - now <= MINUTE_MS;
    if (this.#said !== undefined && (now >= this.#said.until || last || this.#boxLine() !== undefined)) this.#said = undefined;
    // The computer's card closes when what it offers changes, the focus back on its target. cx's card is a dialog the seller reads: it
    // stays, its rows changed in place, and an action that went from under the focus leaves the focus on the card.
    const opened = this.#opened;
    if (opened !== undefined && was !== undefined && was.cards[opened].acts.join() !== drawn.cards[opened].acts.join()) {
      const held = document.activeElement !== null && this.#inCard(document.activeElement);
      // The computer's window is read as cx's card is: it stays, its presses changed in place, and keeps its own focus.
      if (this.#surface(opened) === this.#ccCard) this.#refocus = held;
      else if (this.#surface(opened) !== this.#computer.element) {
        this.#opened = undefined;
        if (held) this.#cxTarget(opened).focus({ preventScroll: true });
      }
    }
    // A purchase holds cx at work, watching the rows, the hand up as the receipt nears, reading it once landed, however the turn goes on.
    const hold = this.#bar.hold();
    const state = hold.busy && drawn.kind !== "unreachable" && (drawn.state === "ready" || drawn.state === "writing") ? "analysing" : drawn.state;
    if (this.#cx.state !== state) this.#cx.set(state);
    this.#cx.scene!.update({ ...drawn.signals, receipt: hold.receipt, catching: hold.catching, lang: this.language });
    const said = this.#said;
    // What cx says as a kind begins comes first; at rest at its desk with nothing else to say, cx says a new version waits, as a way to
    // the computer's window. Not while the box takes no message, whose reason stands beside cx: the saying is not spent then.
    const newer = said === undefined && !drawn.out && drawn.kind === "on" && this.#boxLine() === undefined && this.#saysNewer(me, now);
    const words = newer ? `newer:${this.#say("cx.say.newer")}` : said === undefined ? "" : this.#say(said.key);
    if (words !== this.#bubbleSaid) {
      this.#bubbleSaid = words;
      if (newer) fill(this.#cxBubble, h("button", { type: "button", "data-key": "newer", onclick: () => this.#openCard("computer") },
        h("span", {}, this.#say("cx.say.newer")), h("span", { class: "step-go", "aria-hidden": "true" }, "›")));
      else fill(this.#cxBubble, words);
    }
    this.#cxBubble.classList.toggle("go", newer);
    this.#cxBubble.classList.toggle("quiet", !newer && (said === undefined || drawn.out));
    keep(this.#cxMark, "hidden", !drawn.mark);
    for (const name of CX_TARGETS) {
      const target = this.#cxTarget(name);
      keepAttribute(target, "aria-controls", this.#surface(name).id);
      keepAttribute(target, "aria-label", this.#words(drawn.cards[name].title));
      keepAttribute(target, "aria-expanded", this.#opened === name ? "true" : "false");
    }
    this.#drawCard();
    // A compaction or a turn that ended while cx's card is open changes the figure: it is read again.
    if (this.#opened === "cx" && this.#contextAfter !== `${visit.compactions} ${visit.atWork}`) this.#readContext();
    this.#drawTip();
    this.#drawLine(drawn.kind === "starting", now);
    this.#placeSoon();
    this.#placeOver();
    this.#arm(now);
  }

  /**
   * A new version waits on a computer kept on, which takes it only at a restart (decision D227: nothing restarts it for the seller). 永不
   * is asked of the platform once, when the computer is on and a version waits, unless an opening of the window has read it already.
   */
  #newerWaits(me: SignedIn | undefined): boolean {
    if (me?.newer !== true) return false;
    const awake = this.#computerRead.awake;
    if (awake === undefined) {
      if (!this.#keptAsked && this.#visit.box === "awake") {
        this.#keptAsked = true;
        void this.backend.keptAwake().then((read) => {
          // It fills a value no one has read: one the window read, or the seller set, meanwhile is newer than this answer.
          if (read === undefined || this.#computerRead.awake !== undefined) return;
          this.#computerRead = { ...this.#computerRead, awake: read };
          this.#drawCx();
        }, () => undefined);
      }
      return false;
    }
    return (awake.on ?? awake.waiting ?? false) === true;
  }

  /**
   * cx says it once while it is at rest and not again for seven days: the first saying is written down for the account, and in this page
   * it stays said, through cx's work, until the seller answers it.
   */
  #saysNewer(me: SignedIn | undefined, now: number): boolean {
    if (this.#newerHushed || me === undefined || !this.#newerWaits(me)) return false;
    if (this.#newerSaying) return true;
    const key = `${NEWER_KEY}:${me.account}`;
    if (now - Number(localStorage.getItem(key)) < NEWER_AGAIN_MS) return false;
    localStorage.setItem(key, String(now));
    this.#newerSaying = true;
    return true;
  }

  /** The seller answered what cx said of the new version: it goes, and is not said again in this page. Whether it was being said. */
  #hushNewer(): boolean {
    const was = this.#newerSaying && !this.#newerHushed;
    if (this.#newerSaying) this.#newerHushed = true;
    return was;
  }

  /** What a target's press opens: cx's own card, or the computer's window. */
  #surface(name: CxTarget): HTMLElement {
    return name === "cx" ? this.#ccCard : this.#computer.element;
  }

  /** The acts drawn for a card, each a button but help, a link; they are made again only when they change. */
  #act(act: Act): HTMLElement {
    return act === "help"
      ? h("a", { href: this.backend.links.help, "data-act": act, onclick: () => this.#shutCard(true) })
      : act === "compact" ? tip(h("button", { type: "button", "data-act": act, onclick: () => this.#does(act) }), () => [this.#say("cx.compactHint")])
      : h("button", { type: "button", "data-act": act, onclick: () => this.#does(act) });
  }

  /** The open card, filled for its target. Its actions are drawn again only when they change, so a change of words leaves the focus on the action it was on. */
  #drawCard(): void {
    const name = this.#opened;
    const drawn = this.#scene;
    const surface = name === undefined ? undefined : this.#surface(name);
    this.#cxPlace.classList.toggle("open", surface !== undefined);
    this.#cxPlace.classList.toggle("cc", surface === this.#ccCard);
    keep(this.#ccCard, "hidden", surface !== this.#ccCard);
    if (surface !== this.#computer.element) this.#computer.close();
    else if (drawn !== undefined) { this.#followComputer(); this.#computer.update(this.#windowView(drawn)); }
    if (surface !== this.#computer.element) this.#windowBox = undefined;
    if (surface !== this.#ccCard && this.#ccFaceCx !== undefined) { this.#ccFaceCx.destroy(); this.#ccFaceCx = undefined; }
    // A shut card says nothing: its status would go on reading the state it was opened on.
    if (name === undefined || drawn === undefined) { this.#offered = undefined; this.#ccTitle.textContent = ""; return; }
    const card = drawn.cards[name];
    if (surface === this.#ccCard) this.#drawCxCard(drawn, card.acts);
  }

  /**
   * cx's card, as its rows stand now. Stop stands beside the title while cx works; the context's row stands while the computer is on, its
   * figure as pi last answered it, and Summarise at its end while cx is at rest. The model, the level and the note stand in every state.
   */
  #drawCxCard(drawn: Scene, acts: readonly Act[]): void {
    keep(this.#ccTitle, "textContent", this.#words(drawn.cards.cx.title));
    this.#ccFaceCx ??= CxCharacter.mount(this.#ccFace, { size: CX_SIZE, state: drawn.state });
    if (this.#ccFaceCx.state !== drawn.state) this.#ccFaceCx.set(drawn.state);
    // Right after a tidy the row says so alone, as the signed frame does: pi would refuse a second until the context has a figure again.
    const tidied = this.#context === null;
    const head = acts.filter((act) => act !== "compact"), tail = acts.filter((act) => act === "compact" && !tidied);
    const offered = `cc ${head.join()} ${tail.join()}`;
    if (offered !== this.#offered) {
      this.#offered = offered;
      fill(this.#ccHeadActs, ...head.map((act) => this.#act(act)));
      this.#arrangeCard();
      // 整理上下文 carries a tip: it is closed before the button is made again.
      hideTipWithin(this.#ccContextActs);
      fill(this.#ccContextActs, ...tail.map((act) => this.#act(act)));
    }
    if (this.#refocus && !this.#ccCard.contains(document.activeElement)) this.#ccCard.focus({ preventScroll: true });
    this.#refocus = false;
    this.#actWords(this.#ccCard);
    const runs = drawn.kind === "on" || drawn.kind === "working";
    keep(this.#ccContext, "hidden", !runs);
    // pi's figure, summarised right after a compaction, and nothing where pi gave none: no figure is guessed.
    const context = this.#context;
    const shown = `${this.language} ${String(context)}`;
    if (this.#ccContextWords.dataset["shown"] !== shown) {
      this.#ccContextWords.dataset["shown"] = shown;
      fill(this.#ccContextWords, ...(context === undefined ? [] : context === null ? [this.#say("cc.tidied")]
        : [this.#say("cc.context", { n: context }), h("span", { class: "bar", "aria-hidden": "true" }, this.#ccFill)]));
      // A property, not an attribute: the page's policy refuses inline style attributes.
      this.#ccFill.style.width = `${context ?? 0}%`;
    }
  }

  /**
   * cx's card laid out from the icon that opened it: what is pressed nearest it, 模型 nearest of all, then 思考强度, then the context;
   * what is read beyond them. Over the icon the rows run upward from the foot, the head and the note at the top; with 停止 to press
   * there, the head is the foot. Under the icon (cx out beside its answer) the head is at the top with 停止, and the rows run downward.
   */
  #arrangeCard(): void {
    const under = this.#ccCard.classList.contains("under");
    const foot = !under && this.#ccHeadActs.childElementCount > 0;
    const arranged = `${under} ${foot}`;
    if (arranged === this.#ccArranged) return;
    this.#ccArranged = arranged;
    const held = document.activeElement;
    const near = [this.#ccModel, this.#ccModelSaid, this.#ccLevel, this.#ccLevelSaid];
    const up = [this.#ccContext, this.#ccLevel, this.#ccLevelSaid, this.#ccModel, this.#ccModelSaid];
    this.#ccRows.replaceChildren(...(under ? [...near, this.#ccContext] : up));
    this.#ccCard.classList.toggle("head-foot", foot);
    this.#ccCard.replaceChildren(...(under ? [this.#ccHead, this.#ccRows, this.#aiNote] : foot ? [this.#aiNote, this.#ccRows, this.#ccHead] : [this.#ccHead, this.#aiNote, this.#ccRows]));
    // Moving a node takes the focus from it: it goes back where it was.
    if (held instanceof HTMLElement && held !== document.activeElement && this.#ccCard.contains(held)) held.focus({ preventScroll: true });
  }

  /** Each act's words, in the page's language. */
  #actWords(within: HTMLElement): void {
    for (const one of within.querySelectorAll<HTMLElement>("[data-act]")) {
      const act = one.dataset["act"] as Act;
      const words = this.#say(ACT_WORDS[act]);
      // The address as words to copy, as the account menu prints it: not every seller has a mail program that opens.
      const address = this.backend.links.help.replace(/^mailto:/, "");
      if (act !== "help" || address === this.backend.links.help) keep(one, "textContent", words);
      else if (one.textContent !== `${words}${address}`) fill(one, words, h("span", { class: "quiet" }, address));
    }
  }

  /**
   * The label a hover or the keyboard's focus shows: the card's title, where the card would open. It has no tail, since cx is not the
   * one speaking, and cx says nothing while it shows — but a word that stays until the person acts is shown in the label's place for as
   * long as it stays: a card chosen with the keyboard leaves the focus on its target, and what the choice came to is said where the eye is.
   */
  #drawTip(): void {
    const name = this.#tipped;
    // While cx's word is a press it keeps its place: no label over either target (the signed prototype's `showTip`).
    const shown = name !== undefined && this.#opened === undefined && this.#scene !== undefined && !this.#cxBubble.classList.contains("go");
    this.#cxTip.hidden = !shown;
    this.#cxPlace.classList.toggle("tipped", shown);
    const said = shown && this.#said?.stays === "act" ? this.#said : undefined;
    // The bubble is the status a screen reader hears: under a label that carries its word it leaves the eye and stays for the ear.
    this.#cxPlace.classList.toggle("said", said !== undefined);
    if (shown) this.#cxTip.textContent = said !== undefined ? this.#say(said.key) : this.#words(this.#scene!.cards[name].title);
  }

  get #cxOut(): boolean { return this.#cx.element.getAttribute("data-away") === "true"; }

  /** Whether the margin between the conversation's view and its column holds cx's card whole. */
  #marginHolds(): boolean {
    const stream = this.#streamView.element;
    const column = stream.getBoundingClientRect().left + (parseFloat(getComputedStyle(stream).paddingLeft) || 0);
    return column - this.#scroller.getBoundingClientRect().left >= this.#surface("cx").offsetWidth + 2 * CARD_EDGE;
  }

  /**
   * Over its target, left edges together, under it where there is no room above, never past the window's edge. For cx beside the
   * answer, under cx, where no words are: wholly in the margin where the margin holds it, else over the conversation, as the computer's
   * window lies.
   */
  #over(node: HTMLElement, name: CxTarget): void {
    const box = this.#cxTarget(name).getBoundingClientRect();
    // cx's card stands a little left of cx, so its tail, inset from the card's edge, points at cx.
    const at = node === this.#ccCard ? { top: box.top, bottom: box.bottom, left: box.left - CC_TAIL } : box;
    const within = (left: number): number => Math.max(CARD_EDGE, Math.min(left, innerWidth - node.offsetWidth - CARD_EDGE));
    if (name === "cx" && this.#cxOut) {
      const view = this.#scroller.getBoundingClientRect();
      const stream = this.#streamView.element;
      const column = stream.getBoundingClientRect().left + (parseFloat(getComputedStyle(stream).paddingLeft) || 0);
      const left = node !== this.#cxTip && this.#marginHolds() ? Math.min(at.left, column - CARD_EDGE - node.offsetWidth) : at.left;
      const under = at.bottom + CARD_GAP;
      const below = under + node.offsetHeight <= view.bottom;
      node.style.left = `${Math.max(view.left + CARD_EDGE, within(left))}px`;
      node.style.top = `${below ? under : at.top - CARD_GAP - node.offsetHeight}px`;
      // cx's card grows out of cx: its tail points up at cx from under it, down at it from above.
      if (node === this.#ccCard) this.#underIcon(below);
      return;
    }
    // At the desk, the label and the card above cx and above its computer stand at one height: over the higher of the two.
    const ceiling = Math.min(...CX_TARGETS.map((one) => this.#cxTarget(one).getBoundingClientRect().top));
    const top = ceiling - CARD_GAP - node.offsetHeight;
    node.style.left = `${within(at.left)}px`;
    node.style.top = `${top < CARD_GAP ? at.bottom + CARD_GAP : top}px`;
    if (node === this.#ccCard) this.#underIcon(top < CARD_GAP);
  }

  /** cx's card under its icon or over it: its tail turns, and its rows are laid out again from the icon (`#arrangeCard`). */
  #underIcon(under: boolean): void {
    if (this.#ccCard.classList.contains("under") === under) return;
    this.#ccCard.classList.toggle("under", under);
    this.#arrangeCard();
  }

  #placeOver(): void {
    if (this.#opened !== undefined && this.#surface(this.#opened) === this.#computer.element) this.#overWindow();
    else if (this.#opened !== undefined) this.#over(this.#surface(this.#opened), this.#opened);
    this.#fitMenus();
    if (this.#tipped !== undefined && !this.#cxTip.hidden) this.#over(this.#cxTip, this.#tipped);
    if (this.#cxMark.hidden) return;
    const at = this.#cxTarget("computer").getBoundingClientRect();
    const place = this.#cxPlace.getBoundingClientRect();
    this.#cxMark.style.left = `${at.right - place.left - 12}px`;
    this.#cxMark.style.top = `${at.top - place.top - 4}px`;
  }

  /** cx hops and glides for a moment after it is sent somewhere: what is open over it follows it frame by frame until it has arrived. */
  #follow(): void {
    cancelAnimationFrame(this.#following);
    const until = performance.now() + FOLLOW_MS;
    const frame = (): void => {
      this.#placeOver();
      if (performance.now() < until && (this.#opened !== undefined || this.#tipped !== undefined)) this.#following = requestAnimationFrame(frame);
    };
    frame();
  }

  /**
   * While the answer is produced cx stands beside its last line, left of the answer, and scrolls with it. Run in the frame the
   * stream's draw, a scroll or a resize asks for — never on a timer.
   */
  /**
   * The line cx was last placed beside, where it stood on screen and in the stream: when it stands at the same place in the stream, only a
   * scroll moved it, and cx moves with it as one piece; when the stream itself changed, cx glides to the new place.
   */
  #placedBy: { readonly y: number; readonly inStream: number } | undefined;

  /** How far a scroll alone moved the line since cx was last placed beside it: nothing when the line moved in the stream. */
  #scrolledBy(y: number): number {
    const before = this.#placedBy;
    return before !== undefined && Math.abs(y + this.#scroller.scrollTop - before.inStream) < 0.5 ? y - before.y : 0;
  }

  #placeCx(): void {
    const drawn = this.#scene;
    if (drawn === undefined) return;
    // cx is out beside its line only while that line stands in the conversation's view with room under cx's figure; while the reader is
    // away from the latest message, or the line nears the view's foot, is out of it below or has gone out above it, cx works at its computer. So it goes out and comes
    // back by a hop drawn whole in the view, never through the view's foot or behind the message box. Once home, it goes back out only when
    // the line has come in by twice that room, so a scroll that stops at the edge does not send it back and forth.
    const view = this.#scroller.getBoundingClientRect();
    const line = !drawn.out || this.route !== "stream" || !this.#toLatest.hidden ? undefined : this.#streamView.lastLine();
    const scene = this.#cx.scene!;
    const beside = line !== undefined && line.top >= view.top && line.y <= view.bottom - scene.reach(line.start, view.left) * (this.#placedBy === undefined ? 2 : 1);
    const out = beside ? scene.away({ y: line.y, start: line.start, left: view.left, top: view.top, bottom: view.bottom, shift: this.#scrolledBy(line.y) }) : scene.away(null);
    this.#placedBy = beside ? { y: line.y, inStream: line.y + this.#scroller.scrollTop } : undefined;
    const moved = out !== this.#wasOut;
    this.#wasOut = out;
    // cx's target goes where cx goes, so no leave is heard for a pointer that rested on it: the label ends here.
    if (moved) this.#tip(undefined);
    // cx carried out of the conversation's view by the reader's scroll takes its card with it: a card is never left over the message box.
    if (this.#opened === "cx" && out) {
      const at = this.#cxTarget("cx").getBoundingClientRect();
      if (at.top >= view.bottom || at.bottom <= view.top) this.#shutCard(false);
    }
    this.#placeOver();
    if (out || moved) this.#follow();
  }

  /** The next moment the scene changes by the clock alone: the end of a word that goes by itself, or the next minute of the computer's time left. */
  #arm(now: number): void {
    const due = this.#visit.sleepDueAt;
    const minute = due === undefined || due <= now ? Infinity : now + ((due - now) % MINUTE_MS || MINUTE_MS);
    const next = Math.min(this.#said?.until ?? Infinity, minute);
    if (next === this.#cxDue) return;
    clearTimeout(this.#cxTimer);
    this.#cxDue = next;
    if (Number.isFinite(next)) this.#cxTimer = setTimeout(() => { this.#cxDue = undefined; this.#drawCx(); }, next - now + 20);
  }

  /**
   * A message pi has not taken waits behind what the queue holds as it is drawn, whether the platform keeps it for a computer that is
   * off or the computer holds it until its clicks end: what of that fails is said under the message.
   */
  #noteWaited(): void {
    const waiting = this.#visit.stream.items.flatMap((item) => (item.kind === "user" && item.pending ? [item.key] : []));
    noteWaited(this.#waitedBehind, this.#seenFailed, this.#catalogue.queue(), waiting);
  }
  /** What the chat says under a message that waited behind the queue, by its echo's key. */
  #under(said: string): readonly QueueRow[] {
    const waited = this.#waitedBehind.get(said);
    return waited === undefined ? [] : failedUnder(this.#catalogue.queue(), waited, this.#seenFailed);
  }

  /**
   * The line: what cx is doing now and for how long, from the stream the cards are drawn from (`step-line.ts`). It ticks each second
   * while it shows a time, and goes when the turn ends.
   */
  #drawLine(starting: boolean, now: number): void {
    const visit = this.#visit;
    this.#lineStarting = starting;
    if (!starting) this.#startedAt = undefined;
    else if (this.#startedAt === undefined) {
      // A message that woke the computer counts the start from its Send.
      const sent = visit.stream.items.filter((item) => item.kind === "user" && item.pending).map((item) => (item.kind === "user" ? item.at : undefined)).filter((at): at is number => at !== undefined);
      this.#startedAt = Math.min(now, ...sent);
    }
    // A start names no plugin: once it is over, the list is read, so what waited is drawn running as on a computer that was already on.
    if (starting) this.#startSeen = true;
    else if (this.#startSeen) { this.#startSeen = false; this.#catalogue.settled(); }
    this.#noteWaited();
    const said = lineOf({ stream: visit.stream, atWork: visit.atWork, starting, untimed: visit.startUntimed, closing: this.#switchingOff, installing: this.#catalogue.installing(), on: visit.box === "awake" && !visit.closing,
      skillPlugin: (pkg) => packageNamed(this.#catalogue.held.catalogue.plugins, pkg, this.language) });
    this.#lineNow = this.#lineClock.at(said, now, { startedAt: this.#startedAt, cardFrom: (key) => this.#streamView.cardFrom(key), sent: sentOf(visit.stream) });
    this.#fillLine(now);
    // A line reading a card's clock turns on the card's tick; any other time, on its own.
    const card = this.#lineNow?.line.card;
    const ticks = this.#lineNow !== undefined && this.#lineNow.line.timed && (card === undefined || this.#streamView.cardRan(card) === undefined);
    if (ticks && this.#lineTicker === undefined) this.#lineTicker = setInterval(() => this.#fillLine(Date.now()), 1000);
    if (!ticks && this.#lineTicker !== undefined) { clearInterval(this.#lineTicker); this.#lineTicker = undefined; }
  }

  #fillLine(now: number): void {
    const shown = this.#lineNow;
    const going = shown?.line.target !== undefined;
    const on = going ? this.#lineButton : this.#lineText;
    const other = going ? this.#lineText : this.#lineButton;
    // A line that goes from under the focus leaves it in the message box, where the next key is typed.
    if (shown === undefined || other.hidden === false) { if (this.#lineButton === document.activeElement) this.#toBox(); }
    if (shown === undefined) { this.#lineButton.hidden = true; this.#lineText.hidden = true; return; }
    other.hidden = true;
    if (on.firstChild !== this.#lineDot || on.childNodes.length !== 4) fill(on, this.#lineDot, this.#lineWords, this.#lineTime, this.#lineGo);
    const { line, since } = shown;
    const ran = line.card === undefined ? undefined : this.#streamView.cardRan(line.card);
    const time = line.timed ? stepTime(ran ?? now - since, false).time : undefined;
    keep(this.#lineTime, "textContent", time === undefined || !("key" in time) ? "" : this.#say(time.key, time.values));
    keep(this.#lineGo, "textContent", going ? "›" : "");
    on.hidden = false;
    const whole = this.#say(line.key, Object.fromEntries(Object.entries(line.values).map(([at, value]) => [at, value.text])));
    keep(this.#lineWords, "textContent", whole);
    this.#lineWords.classList.toggle("f-working", atWork(line));
    // Where the whole sentence does not fit, a path gives way to its file's own name first; then the words end in an ellipsis.
    if (this.#lineWords.scrollWidth > this.#lineWords.clientWidth) {
      const short = Object.fromEntries(Object.entries(line.values).map(([at, value]) => {
        const parts = value.text.split("/").filter((part) => part !== "");
        return [at, value.file === true && parts.length > 1 ? `…/${parts.at(-1)}` : value.text];
      }));
      keep(this.#lineWords, "textContent", this.#say(line.key, short));
    }
  }

  /** The line pressed: the page goes to the step's card as it lands on a message, and the focus goes with it. */
  #toStep(): void {
    const target = this.#lineNow?.line.target;
    if (target === undefined) return;
    // The line says the live turn: from a far stretch the press goes back to the live view, as 「回到最新」 does, and lands there.
    let landed = this.#streamView.revealStep(target);
    if (!landed && this.#faraway) { this.#toLive(); landed = this.#streamView.revealStep(target); }
    if (landed) this.#pageMoved();
  }

  /** Signs out here, or on every device; a refusal is left to the caller, as this device's row in 账户 says its own. */
  async #signOut(everywhere = false, landing?: DoorReason): Promise<void> {
    this.#leaveFailed = false;
    this.#accountMenu.close(false);
    this.draw();
    // The next person on this browser finds nothing of the last one's place, though no other account could have resumed it; one still signed in, whose sign-out went to renew the session first, keeps it.
    if (await this.backend.leave(everywhere, landing) === "ended") { try { localStorage.removeItem(PLACE_KEY); } catch { /* nothing kept to clear */ } }
  }

  /**
   * Signs out from the account menu, or from every device in the window's 账户; one that did not finish is said under the menu, the
   * sidebar open so it is seen, and the menu's item is the retry.
   */
  async #leave(everywhere = false, landing?: DoorReason): Promise<void> {
    try {
      await this.#signOut(everywhere, landing);
    } catch {
      this.#leaveFailed = true;
      this.#sidebarOpen = true;
      this.draw();
    }
  }

  /**
   * A turn that ends while the person is on another tab is told by the browser, where they asked for it and the browser allows it. Its
   * tag is the record's place at the end, the same on every page that heard the turn, so the browser shows one notice for it.
   */
  #answered(): void {
    if (!this.#turnEnds.seen(this.#visit.stream)) return;
    if (document.hidden && this.#ready.on() && this.#ready.permission() === "granted") new Notification(this.#say("app.name"), { body: this.#say("sw.ready"), tag: `turn ${this.#visit.stream.cursor ?? ""}` });
  }

  /** Choosing a place in the contents moves the page there; from another page that means going back to the stream first. */
  /**
   * The conversation at a place: at once when the view holds it; otherwise its stretch is read, said as it is waited on, and drawn in
   * place of the live view, which goes on taking the turn under way. A stretch that reaches the latest joins it. On a narrow screen the
   * sidebar closes and the button that opens it again takes the focus.
   */
  async #jump(place: string): Promise<void> {
    const token = ++this.#jumps;
    this.#handOff();
    // A move by pushState fires no hashchange, so leaving the Plugins page ends its sign-in here.
    if (this.route !== "stream") { this.#catalogue.leave(); history.pushState(null, "", "#/"); }
    this.#reading = place;
    // A read of the stretch the reader leaves is no longer waited on, whichever way they go.
    this.#awayReading = undefined;
    this.#jumpFailed = undefined;
    const holds = (state: StreamState): boolean => state.items.some((item) => item.key === place);
    if (this.#away !== undefined && holds(this.#away.state)) { this.draw(); this.#landed(place); return; }
    if (holds(this.stream)) { this.#leaveStretch(); this.draw(); this.#landed(place); return; }
    this.#away = undefined;
    this.#jumping = place;
    this.draw();
    const answer = await this.backend.historyAt(place).catch(() => undefined);
    if (token !== this.#jumps) return;
    this.#jumping = undefined;
    // A stretch that could not be read is said where it would stand, with the same Try again History's own failed read offers.
    if (answer === undefined) { this.#jumpFailed = place; this.draw(); return; }
    const away = stretch(answer);
    const met = joined(this.stream, away);
    this.#streamView.loaded();
    if (met !== this.stream) this.#visit.stream = met;
    else this.#away = { state: away, later: answer.later };
    this.draw();
    await this.#fillBelow(place, token);
    if (token !== this.#jumps) return;
    this.#landed(place);
  }

  /** A stored message or answer the page holds, by its place: in the stretch it shows, or in the live view behind it. */
  #itemAt(place: string): Extract<Item, { kind: "user" | "assistant" }> | undefined {
    const held = (state: StreamState | undefined): Item | undefined => state?.items.find((item) => item.key === place);
    const item = held(this.#away?.state) ?? held(this.stream);
    return item?.kind === "user" || item?.kind === "assistant" ? item : undefined;
  }

  /** A quote of a message that came back takes its card again: whose words and when from the entry the page holds, otherwise from one read of where it is stored. */
  #returned(quote: Quote): void {
    const held = this.#itemAt(quote.at);
    this.#quoteBox.add({ ...quote, who: held === undefined ? undefined : held.kind === "user" ? "you" : "cx", time: held?.at });
    if (held === undefined) void this.#quotedFar(quote.at).then((far) => { if (far !== undefined) this.#quoteBox.know(quote, far.kind === "user" ? "you" : "cx", far.at); });
  }

  #saidBy(item: Extract<Item, { kind: "user" | "assistant" }> | undefined): Said | undefined {
    return item === undefined ? undefined : { when: item.at === undefined ? undefined : dayAndTime(item.at, Date.now(), this.language, this.#dayWords()) };
  }

  /**
   * A quoted message of this life the page does not hold, read from where it is stored, once: a sent quote says when its words were
   * said, and a card that came back whose they are, however far back they are. A read that failed is asked again by the next draw.
   */
  #quotedFar(place: string): Promise<Extract<Item, { kind: "user" | "assistant" }> | undefined> {
    const epoch = this.stream.epoch ?? this.#away?.state.epoch;
    if (epoch === undefined || !place.startsWith(`${epoch}:`) || !/^\d+$/.test(place.slice(epoch.length + 1))) return Promise.resolve(undefined);
    const asked = this.#farQuoted.get(place);
    if (asked !== undefined) return asked;
    const read = this.backend.historyAt(place).then((answer) => {
      const item = stretch(answer).items.find((one) => one.key === place);
      return item?.kind === "user" || item?.kind === "assistant" ? item : undefined;
    }, () => { this.#farQuoted.delete(place); return undefined; });
    this.#farQuoted.set(place, read);
    return read;
  }

  /**
   * A sent quote pressed: the page goes to what was quoted — a message of the seller's, or the words of an answer, which are marked
   * there for a moment.
   */
  async #jumpToQuote(quote: Quote): Promise<void> {
    await this.#jump(quote.at);
    if (this.#reading !== quote.at) return;
    const landed = this.#streamView.elementOf(quote.at);
    if (landed === undefined) return;
    // The focus goes where the page went, to the landed message's one Tab stop: the next key acts where the eye is.
    landed.querySelector<HTMLElement>('[data-rove][tabindex="0"]')?.focus({ preventScroll: true });
    const words = this.#itemAt(quote.at)?.kind === "assistant" ? wordsIn(landed, quote.words) : undefined;
    if (words === undefined) return;
    this.#streamView.toWords(quote.at, words);
    this.#pageMoved();
    this.#drawLatest();
    this.#placeSoon();
    // The words marked are the mark: the answer around them carries none. A browser that marks no words leaves the answer's own.
    if (markWords(landed, quote.words, (ms, then) => { setTimeout(then, ms); })) this.#streamView.unmark(quote.at);
  }

  /** A far stretch reaches at least a screen below the place gone to, so the place can open the view: the parts after it come with it. */
  async #fillBelow(place: string, token: number): Promise<void> {
    for (let away = this.#away; away !== undefined && away.later && away.state.epoch !== undefined && this.#streamView.below(place) < this.#scroller.clientHeight + FILL_MARGIN; away = this.#away) {
      const answer = await this.backend.historyAt(`${away.state.epoch}:${lastSeq(away.state) + 1}`).catch(() => undefined);
      if (token !== this.#jumps || this.#away !== away || answer === undefined) return;
      const on = later(away.state, answer);
      const met = joined(this.stream, on);
      this.#streamView.loaded();
      if (met !== this.stream) { this.#visit.stream = met; this.#away = undefined; }
      else this.#away = { state: on, later: answer.later };
      this.draw();
    }
  }

  /** The conversation shown at the place a jump went to, and what stands beside it drawn for where the reader now is. */
  #landed(place: string): void {
    this.#streamView.reveal(place);
    this.#pageMoved();
    this.#drawLatest();
    this.#history.draw();
    this.#placeSoon();
  }

  /** A press in the sidebar on a narrow screen: the sidebar closes and the button that opens it again takes the focus. */
  #handOff(): boolean {
    if (this.#wide.matches || !this.#sidebarOpen) return false;
    this.#sidebarOpen = false;
    queueMicrotask(() => giveBack(this.#opener));
    return true;
  }

  /** The entry to the chat pressed: its link goes to the chat page, and the chat shows its latest message. */
  #toChat(): void {
    this.#handOff();
    if (this.#current) this.draw();
    else this.#toLive();
  }

  /** The reader back at the latest message: the far stretch goes, and the message box takes the focus. */
  #backToLatest(): void {
    this.#toLive();
    this.#draft.focus({ preventScroll: true });
  }

  /** Whether the page draws a far stretch, or is on its way to one, rather than the live view. */
  get #faraway(): boolean { return this.#away !== undefined || this.#jumping !== undefined || this.#jumpFailed !== undefined; }

  /**
   * Whether Back to latest shows: a far stretch, its wait, or the live view scrolled back so that the latest lies more than a screen
   * below what the reader sees. History's entry to the chat does not follow it, but the latest message's own box (`#current`).
   */
  get #behind(): boolean {
    const below = this.#scroller.scrollHeight - this.#scroller.scrollTop - this.#scroller.clientHeight;
    return this.#faraway || (this.#scroller.clientHeight > 0 && below > this.#scroller.clientHeight);
  }

  /**
   * Whether History's entry to the chat is current: the chat shows, nothing is being read from History, and the latest message is where
   * the reader sees it, its box meeting the view's. Back to latest keeps its own wider threshold.
   */
  get #current(): boolean { return this.route === "stream" && this.#reading === undefined && !this.#faraway && this.#streamView.latestSeen(); }

  /** The live view drawn again in place of a far stretch. */
  #toLive(): void {
    this.#leaveStretch();
    this.#reading = undefined;
    this.#streamView.toLatest();
    this.draw();
  }

  /** The far stretch, its wait and its reads let go: the live view is what the page draws, its items loaded rather than news. */
  #leaveStretch(): void {
    if (this.#away !== undefined || this.#jumping !== undefined || this.#jumpFailed !== undefined) this.#streamView.loaded();
    this.#jumps++;
    this.#away = undefined;
    this.#jumping = undefined;
    this.#jumpFailed = undefined;
    this.#awayReading = undefined;
  }

  /** The page scrolled the conversation itself: the scroll event that follows is not the reader reaching an edge. */
  #pageMoved(): void { this.#pageTop = this.#scroller.scrollTop; }

  /** The reader at the end of a far stretch with more stored after it: what follows is read, and a stretch that meets the latest joins it. */
  async #readOn(): Promise<void> {
    const away = this.#away;
    if (away === undefined || !away.later || this.#awayReading !== undefined || away.state.epoch === undefined) return;
    this.#awayReading = "later";
    // The line saying what follows is on its way comes into view under the place the reader is at; the place itself does not move.
    this.#streamView.hold();
    this.#drawStream();
    const answer = await this.backend.historyAt(`${away.state.epoch}:${lastSeq(away.state) + 1}`).catch(() => undefined);
    if (this.#away !== away) { this.#settleRead("later"); return; }
    this.#awayReading = undefined;
    if (answer !== undefined) {
      const on = later(away.state, answer);
      const met = joined(this.stream, on);
      this.#streamView.hold();
      this.#streamView.loaded();
      if (met !== this.stream) { this.#visit.stream = met; this.#away = undefined; }
      else this.#away = { state: on, later: answer.later };
    }
    this.#drawStream();
  }

  /** The reader at the top of a far stretch with more stored before it: the part before is read, as for the live view. */
  async #readUp(): Promise<void> {
    const away = this.#away;
    if (away === undefined || !away.state.earlier || this.#awayReading !== undefined || away.state.epoch === undefined || away.state.from === undefined) return;
    this.#awayReading = "earlier";
    this.#drawStream();
    const answer = await this.backend.history(away.state.epoch, away.state.from).catch(() => undefined);
    if (this.#away !== away) { this.#settleRead("earlier"); return; }
    this.#awayReading = undefined;
    if (answer !== undefined) this.#away = { ...away, state: earlier(away.state, answer) };
    this.#drawStream();
  }

  /** A read whose stretch was replaced meanwhile — by the fill below a jump, or a jump — waits on nothing: its line goes. */
  #settleRead(read: "later" | "earlier"): void {
    if (this.#awayReading !== read) return;
    this.#awayReading = undefined;
    this.#drawStream();
  }

  /** What the conversation's view draws: the wait for a jump or its failure, the far stretch the reader is in, or the live view. */
  get #shown(): StreamState { return this.#jumping !== undefined || this.#jumpFailed !== undefined ? { ...EMPTY, epoch: this.stream.epoch } : this.#away?.state ?? this.stream; }

  /** The preview starts a recording over: what the stream held goes, and what the page knows of the box stays. */
  clearStream(): void {
    this.#leaveStretch();
    this.#reading = undefined;
    this.#history.forget();
    this.#quoteBox.clear();
    this.#uploads.clear();
    this.#pick.hide();
    this.#visit.stream = EMPTY;
    this.#streamView.reset();
    this.draw();
  }

  /** Sends what the box holds, or a sample given whole, which leaves the box, its quotes and its files as they are. */
  #send(sample?: string): void {
    const quotes = sample === undefined ? this.#quoteBox.quotes : [];
    const files = this.#uploads;
    const cards = sample === undefined ? files.cards.length : 0;
    // Quotes and files are a message with or without words of the person's own; the suggestion is sent only for a box that holds none.
    const words = unmarked(sample ?? (this.#draft.value.trim() === "" && quotes.length === 0 && cards === 0 ? this.suggestion() ?? "" : this.#draft.value));
    if (sentWith(quotes, words) === "" && cards === 0) return;
    // A box that takes no message keeps what it holds: Enter sends nothing, and the line beside cx says why.
    if (this.#boxLine() !== undefined) return;
    this.#hush();
    this.#shutCard(false);
    // A sample that cannot go now waits in an empty box, as a message of the person's own would; a box with their words keeps them.
    const keep = (): void => { if (sample !== undefined && this.#draft.value.trim() === "") { this.#draft.value = sample; this.#drawControl(); } };
    // Out of reach, or before the computer is first read, a message cannot go: it stays in the box, no start is drawn and cx says again
    // that the page is reconnecting, whichever of the account and the stream is being asked for again. An account not read is asked for now.
    const kind = this.#scene?.kind;
    if (kind === "unreachable" || kind === "unreachableAsleep" || kind === "unknown") {
      keep();
      this.#sayReconnecting();
      if (this.#visit.unreachable) void this.#visit.look();
      return;
    }
    // A start that was refused or failed is asked for again, and the message stays in the box until a computer is there to take it:
    // nothing waits in the conversation for a start that is not happening.
    if (kind === "refused" || kind === "failed") { keep(); void this.#visit.wake(); return; }
    // A message names a file only once it is whole in the seller's files: Send is off until then. A sample names none.
    if (sample === undefined && !files.ready) return;
    const message = sentWith(quotes, words, sample === undefined ? files.names : []);
    if (sample === undefined) {
      this.#unsent = false;
      this.#unsentWhy = undefined;
      this.#draft.value = "";
      this.#slash.close();
      this.#quoteBox.clear();
      this.#uploads.clear();
    }
    // A message sent from a far stretch brings the view back to the latest message, where it and its answer are.
    if (this.#away !== undefined || this.#jumping !== undefined || this.#jumpFailed !== undefined) { this.#leaveStretch(); this.#reading = undefined; this.#streamView.toLatest(); this.draw(); }
    // The chat's box is one of the two ways a question lets cx go: the message goes once each waiting question is let go unanswered.
    void this.#visit.send(message, true);
  }

  /** + opens the picker; a paste with files and no words adds them; files dropped on the conversation or the box join it. */
  #wireFiles(): void {
    this.#picker.addEventListener("change", () => { this.#uploads.add([...(this.#picker.files ?? [])]); this.#picker.value = ""; this.#filesAdded(); });
    // Words on the clipboard are pasted as words, and win: a range copied from a spreadsheet carries a picture of itself beside its text.
    this.#draft.addEventListener("paste", (event) => {
      const files = [...(event.clipboardData?.files ?? [])];
      if (files.length === 0 || event.clipboardData?.types.includes("text/plain") === true) return;
      event.preventDefault();
      this.#uploads.add(files, (file) => this.#pastedName(file));
      this.#filesAdded();
    });
    const carries = (event: DragEvent): boolean => [...(event.dataTransfer?.types ?? [])].includes("Files");
    const takes = (): boolean => this.route === "stream" && this.#composer.isConnected;
    const dropping = (on: boolean): void => { this.#composer.classList.toggle("dropping", on); this.#dropSaid.hidden = !on; };
    this.#main.addEventListener("dragenter", (event) => { if (!carries(event) || !takes()) return; event.preventDefault(); this.#dragging += 1; dropping(true); });
    this.#main.addEventListener("dragover", (event) => { if (!carries(event) || !takes()) return; event.preventDefault(); event.stopPropagation(); event.dataTransfer!.dropEffect = "copy"; });
    this.#main.addEventListener("dragleave", (event) => { if (!carries(event)) return; this.#dragging = Math.max(0, this.#dragging - 1); if (this.#dragging === 0) dropping(false); });
    this.#main.addEventListener("drop", (event) => {
      if (!carries(event)) return;
      event.preventDefault();
      this.#dragging = 0;
      dropping(false);
      if (!takes()) return;
      event.stopPropagation();
      this.#uploads.add([...(event.dataTransfer?.files ?? [])]);
      this.#filesAdded();
    });
    // Anywhere else, a file dropped is not opened in the page's place.
    document.addEventListener("dragover", (event) => { if (carries(event)) { event.preventDefault(); event.dataTransfer!.dropEffect = "none"; } });
    document.addEventListener("drop", (event) => { if (carries(event)) event.preventDefault(); });
  }

  /** Files joined the cards: the newest is in view and the message box keeps the focus. */
  #filesAdded(): void {
    const cards = this.#quoteBox.element.querySelector(".cards");
    if (cards !== null) cards.scrollLeft = cards.scrollWidth;
    this.#draft.focus({ preventScroll: true });
  }

  /** A pasted picture has no name of its own: it takes the moment it was pasted, as a screenshot does, so two pastes never share one. */
  #pastedName(file: File): string {
    if (file.name !== "" && file.name !== "image.png") return file.name;
    const at = new Date();
    const two = (n: number): string => String(n).padStart(2, "0");
    const when = `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}.${two(at.getMinutes())}.${two(at.getSeconds())}`;
    const dot = file.name.lastIndexOf(".");
    return `${this.#say("composer.pasted", { when })}${dot > 0 ? file.name.slice(dot) : ".png"}`;
  }

  /** A file that cannot go, or that took another name, is said as it happens: the box keeps the focus, and its cards are not read again. */
  #tellFiles(cards: readonly FileCard[]): void {
    if (cards.length === 0) return;
    this.#hear(cards.map((card) => this.#say("composer.fileNote", { name: card.saved ?? card.name, said: fileSaid(card, this.#say) ?? "" })).join(this.language === "zh" ? "；" : "; "));
  }

  #drawStream(): void {
    if (this.route === "stream") { this.#updateStream(); this.#drawComposer(); this.#newPart(); }
    this.#drawContents();
    this.#drawBar();
  }

  #updateStream(): void {
    const failed = this.#jumpFailed;
    const held = document.activeElement?.closest(".wait-actions, .dialog") != null;
    this.#streamView.update(this.#shown, this.#waiting(), this.#awayReading === "later", failed === undefined ? undefined : () => { void this.#jump(failed); });
    // A waiting message's controls go when pi records it or it is taken back, and a dialog's card when it is answered: the focus they
    // held goes to the message box, not to nothing.
    if (held && (document.activeElement === null || document.activeElement === document.body)) this.#toBox();
    // A drawing that left the selection behind leaves Quote behind with it.
    this.#pick.place();
    this.#pageMoved();
    this.#drawLatest();
  }

  /**
   * Back to latest shows whenever the latest message is not on the page — a far stretch, its wait — or lies more than a screen below
   * what the reader sees, however they got there.
   */
  #drawLatest(): void {
    const away = this.#behind;
    // Its arrow alone, its name said to a screen reader only, and nothing said over it.
    fill(this.#toLatest, h("span", { class: "unseen" }, this.#say("stream.backToLatest")), h("span", { "aria-hidden": "true" }, "↓"));
    // cx works at its computer while this control shows, so its showing or going moves cx.
    const turned = this.#toLatest.hidden === away;
    if (turned) this.#placeSoon();
    this.#toLatest.hidden = !away;
    // History draws its entry to the chat anew when the arrow turns, and when the latest message comes into view or leaves it.
    if (turned || this.#current !== this.#currentDrawn) this.#history.draw();
    this.#placeBack();
  }

  /**
   * Back to latest floats on the status row's foot, just above the message box, and the row's words end the row's own gap before it.
   * Where that would leave them less than `LINE_ROOM_EMS` of the line's ems, the control floats just over the row instead and the words
   * keep the row. Read on each draw, not at a width, since the words' room is the row's.
   */
  #placeBack(): void {
    const set = (style: CSSStyleDeclaration, name: "padding-right" | "bottom", value: string): void => { if (style.getPropertyValue(name) !== value) style.setProperty(name, value); };
    set(this.#status.style, "padding-right", "");
    set(this.#toLatest.style, "bottom", "");
    if (!this.#toLatest.hidden) {
      const row = this.#status.getBoundingClientRect(), words = this.#statusWords.getBoundingClientRect(), back = this.#toLatest.getBoundingClientRect();
      const style = getComputedStyle(this.#status);
      const end = back.left - (Number.parseFloat(style.columnGap) || 0);
      if (end - words.left >= LINE_ROOM_EMS * Number.parseFloat(style.fontSize)) set(this.#status.style, "padding-right", `${row.right - end}px`);
      else set(this.#toLatest.style, "bottom", `calc(var(--space-1) + ${this.#status.offsetHeight}px + var(--space-2))`);
    }
    if (this.#lineNow !== undefined) this.#fillLine(Date.now());
  }

  /** What the conversation's place says while it waits: the stream not yet answered, or the part before the one it holds being read. */
  #waiting(): "stream" | "earlier" | undefined {
    const me = this.#me;
    if (this.#jumpFailed !== undefined) return undefined;
    if (this.#jumping !== undefined) return "stream";
    if (me === undefined ? this.#presumed && !this.#visit.unreachable : me.kind === "signed_in" && me.box !== "pending" && !this.#visit.answered) return "stream";
    if (this.#away !== undefined) return this.#awayReading === "earlier" ? "earlier" : undefined;
    return this.#visit.loadingEarlier ? "earlier" : undefined;
  }

  /** The person at the top of the stream, with more stored before it: the part before is asked for; a far stretch's only by the reader's scroll. */
  #atTop(byReader = true): void {
    if (this.#away !== undefined) { if (byReader && this.route === "stream" && this.#scroller.scrollTop < 40) void this.#readUp(); return; }
    if (this.#jumping === undefined && this.#reachedTop()) void this.#visit.loadEarlier();
  }

  /** The reader at the bottom: a far stretch reads on, and a reader back at the latest message is no longer reading from History. */
  #atBottom(byReader: boolean): void {
    if (this.route !== "stream" || !this.#streamView.edges().bottom) return;
    if (this.#away !== undefined) { if (byReader) void this.#readOn(); return; }
    if (this.#reading !== undefined && this.#jumping === undefined) { this.#reading = undefined; this.#drawLatest(); this.#history.draw(); }
  }

  #reachedTop(): boolean { return this.route === "stream" && this.#scroller.scrollTop < 40 && this.stream.earlier; }

  /** A part the stream did not hold before arrived: one that leaves the person at the top — it fills no screen — asks for the one before. */
  #newPart(): void {
    if (this.stream.from === this.#fromSeen) return;
    this.#fromSeen = this.stream.from;
    this.#atTop();
  }

  /**
   * The source rows against the stream: a turn's charge told live, or the end of a turn the page saw run, is the moment to read the
   * account and the sources once (`PurchaseNews`); the rows draw the figures `/sources` answers and sum none of their own. `force` draws
   * them again for the page's words or money.
   */
  #drawBar(force = false): void {
    if (this.#me?.kind !== "signed_in") return;
    // A turn's end is seen from the first, before the sidebar's first answer: no turn the page saw ends unread.
    this.#news.stream(this.stream);
    if (force && this.#glance !== undefined) this.#bar.draw();
  }

  /**
   * The board's frame (`parts/cx-board.md`): shown while the account's packages hold cx-board and a person is signed in, its icon at the
   * chat's top right with the count of what waits, and the column beside the chat or over it.
   */
  #drawBoard(): void {
    const column = this.#column;
    const bare = this.root.classList.contains("bare");
    column.install(!bare && this.#me?.kind === "signed_in" && this.#board.shown === true);
    // The column is shown before the board in it is drawn, so what the board hands the keyboard to can take it: the page's draw
    // clears the root's classes first.
    this.root.classList.toggle("board-shown", column.installed && column.open);
    // The board shown in the open column is drawn first: what it shows is seen, and the icon's dot follows.
    if (column.open) this.#board.draw();
    column.draw(this.#board.count, this.#board.countName, this.#board.fresh);
    this.root.classList.toggle("resizing", column.dragging);
    this.root.classList.toggle("gliding", column.gliding);
    // With the sidebar shown there is no opener and no row above the chat: the icons stand at the chat's top right, and the chat's top
    // fades under them as its foot fades under the message box.
    const opener = bare || this.#sidebarOpen;
    this.#chatTop.hidden = opener && !column.installed;
    this.#chatTop.classList.toggle("floats", opener);
    // In full screen, the column beside the chat, the chat's top is out of sight with the chat, so the sidebar's opener stands at the head's start.
    const openerHome = column.full && column.beside ? this.#board.head : this.#chatTop;
    if (this.#opener.parentElement !== openerHome) {
      const held = document.activeElement === this.#opener;
      openerHome.prepend(this.#opener);
      if (held) giveBack(this.#opener);
    }
    // Lying over the chat, the column is the one thing to reach until it is closed. Dragged over the chat beside the sidebar, the part of
    // the chat still in sight stays in reach (ruled 2026-11-12).
    this.#page.inert = column.over || column.full;
    this.#sidebar.inert = column.over;
  }

  /** The board or its column changed: the frame is drawn again. */
  #boardChanged(): void {
    this.#noticeWaits();
    this.#drawBoard();
    // A message a page sent names its board as the board does: the stream takes the names a read brought, each row drawn again only if its name changed.
    if (this.#board.names !== this.#namesDrawn) { this.#namesDrawn = this.#board.names; if (this.route === "stream") this.#updateStream(); }
    if (this.route === "stream" && this.#me?.kind === "signed_in") this.#drawComposer();
  }

  /** A page's ask that waited for an empty message box, or for room beside the chat, opens the column once it has either. */
  #noticeWaits(): void {
    const asked = this.#column.installed ? this.#door.typed({ open: this.#column.open, beside: !this.#column.covers, empty: this.#draft.value.trim() === "" }) : undefined;
    if (asked !== undefined) this.#openAsked(asked);
  }

  /**
   * What a page may ask of the board around it (`parts/board-page.md` §1): a sentence after the message box's words, a message sent as the
   * seller's own and naming its board, its own tab's files, and its board shown through the door. Its number is the board's to keep.
   */
  #pageAsks(): FrameAsks {
    const backend = this.backend;
    const refused = (): Promise<never> => Promise.reject(new BoardRefused("unavailable"));
    return {
      draft: (_tab, text) => this.#draftFromPage(text),
      send: (tab, text, card) => this.#sendFromPage(tab, text, card),
      files: (tab) => backend.boardFiles?.(tab) ?? refused(),
      read: (tab, file) => backend.boardFile?.(tab, file) ?? refused(),
      write: (tab, file, text) => (backend.boardWrite?.(tab, file, text) ?? refused()).then((done) => { this.#wroteCard(tab, file, text, done.modified); return done; }),
      count: () => {},
      show: (tab, name) => this.#showAsked(tab, name),
      open: (tab, path) => this.#openFile(path, tab === TASKS_TAB ? "card" : "page"),
      save: (tab, name, from) => this.#saveFromPage(tab, name, from),
      pressed: (tab) => { if (this.#column.open && this.#board.tab === tab) this.#door.pressed(tab); },
    };
  }

  /** A press reaches this page from inside a page's frame as from anywhere in it: a page's draft and send need one. */
  #pressed(): boolean {
    return (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation?.isActive === true;
  }

  /**
   * A file a page hands the seller, at their press: the words it gave, or one of its own tab's files as the board reads it, saved by the
   * app under the page's name for it. With no press it is refused and nothing is read.
   */
  async #saveFromPage(tab: string, name: string, from: { readonly text: string } | { readonly file: string }): Promise<"saved"> {
    if (!this.#pressed()) throw new BoardRefused("no_press");
    const text = "text" in from ? from.text : await (this.backend.boardFile?.(tab, from.file) ?? Promise.reject(new BoardRefused("unavailable")));
    saveFile(name, text);
    return "saved";
  }

  /**
   * A page's sentence, at the seller's press, lands after any words in the message box, the keyboard with it, and nothing is sent: full
   * screen is left, and a sheet over the chat closes, so the sentence is seen. With no press it is refused, and the route, the keyboard and
   * the message box are left as they were.
   */
  #draftFromPage(text: string): void {
    if (!this.#pressed()) throw new BoardRefused("no_press");
    const held = this.#draft.value.replace(/\s+$/, "");
    this.#column.setFull(false);
    if (this.#column.over) this.#column.set(false);
    this.#intoBox(held === "" ? text : `${held}\n${text}`);
  }

  /**
   * The one way words are put in the message box with the keyboard there, the Plugins page's ask and a page's draft alike: the selection
   * given, else the cursor after the words, on the chat now or once the chat is drawn again.
   */
  #intoBox(words: string, select?: readonly [number, number]): void {
    this.#draft.value = words;
    this.#drawControl();
    if (this.route !== "stream") { this.#draftSelect = select; this.#focusDraft = true; location.hash = "#/"; return; }
    const [from, to] = select ?? [words.length, words.length];
    this.#draft.focus({ preventScroll: true });
    this.#draft.setSelectionRange(from, to);
  }

  /**
   * A page's message, sent as the seller's own through the ordinary send, naming the board it came from; the proxy lets it through only at
   * a real press, and this page's own activation is asked too: with none it is refused. One that cannot go now, at a press, is a draft.
   */
  #sendFromPage(tab: string, text: string, card?: string): "sent" | "drafted" {
    if (!this.#pressed()) throw new BoardRefused("no_press");
    if (!this.#sendBoard(fromBoard(text, tab, card))) { this.#draftFromPage(text); return "drafted"; }
    // An answer sent from a card leaves the board open where it lies over the chat (18 A); any other message closes it, so it is seen.
    if (card === undefined && this.#column.over && !this.#column.full) this.#column.set(false);
    return "sent";
  }

  /**
   * A board card's row as last read, for the signed-in person's own board only: a path on anyone else's stays the step that wrote it. A
   * card not yet read has its tab read; one whose read was refused or failed waits for the board's next change.
   */
  #cardRow(card: BoardCard): CardRow | undefined {
    const me = this.#me?.kind === "signed_in" ? this.#me.account : undefined;
    if (card.person !== undefined && card.person !== me) return undefined;
    const tab = this.#cardRows.get(card.tab) ?? new Map<string, HeldCard>();
    this.#cardRows.set(card.tab, tab);
    const held = tab.get(card.file) ?? { row: undefined, state: "new", told: 0 };
    tab.set(card.file, held);
    if (held.state === "new") this.#readCards(card.tab);
    return held.row;
  }

  /**
   * One rule for reading the chat's cards: a tab's list says each file's time, and only a card not read, whose read failed, or whose file's
   * time is not the one it was read at is read again. A change told while a tab is read reads it again once that read is done, and a card met meanwhile is read then.
   */
  #readCards(tab: string, told = false): void {
    const reading = this.#cardTabs.get(tab);
    if (reading !== undefined) { reading.again ||= told; return; }
    const { boardFiles, boardFile } = this.backend;
    const held = this.#cardRows.get(tab);
    if (boardFiles === undefined || boardFile === undefined || held === undefined) return;
    const now = { again: false };
    this.#cardTabs.set(tab, now);
    void (async () => {
      const listed = await boardFiles.call(this.backend, tab).then((rows) => new Map(rows.map((one) => [one.file, one.modified] as const)), () => undefined);
      let changed = false;
      await Promise.all([...held].map(async ([file, card]) => {
        const told = card.told;
        const modified = listed?.get(file);
        if (listed === undefined) { if (card.state === "new") card.state = "failed"; return; }
        if (card.state === "read" && card.modified === modified) return;
        const text = modified === undefined ? null : await boardFile.call(this.backend, tab, file).catch(() => undefined);
        if (card.told !== told) return;
        if (text === undefined) { card.state = "failed"; return; }
        const row = text === null ? undefined : readCard(file, text);
        changed ||= row?.title !== card.row?.title || row?.state !== card.row?.state;
        Object.assign(card, { row, modified, state: "read" });
      }));
      this.#cardTabs.delete(tab);
      if (changed) this.#drawStream();
      if (now.again || [...held.values()].some((card) => card.state === "new")) this.#readCards(tab);
    })();
  }

  /** The board's files changed: every tab the chat holds a card of is read again by the one rule. */
  #staleCards(): void {
    for (const tab of this.#cardRows.keys()) this.#readCards(tab, true);
  }

  /** A page wrote a card: its row is the words written, at the time the write gave, and a read out for it then is not kept. */
  #wroteCard(tab: string, file: string, text: string, modified: number): void {
    const card = this.#cardRows.get(tab)?.get(file);
    if (card === undefined) return;
    Object.assign(card, { row: readCard(file, text), modified, state: "read", told: card.told + 1 });
    this.#drawStream();
  }

  /** The board opened at a card a row of the chat names. */
  #openBoardCard(card: BoardCard): void {
    if (!this.#column.installed) return;
    this.#column.set(true);
    this.#board.focusCard(card.tab, card.file);
  }

  /** A page's ask for its board to be shown, through the door. */
  #showAsked(tab: string, name: string): void {
    if (!this.#column.installed) return;
    const open = this.#column.open;
    const answer = this.#door.ask(tab, name, { open, shown: open ? this.#board.tab : undefined, beside: !this.#column.covers, empty: this.#draft.value.trim() === "", keyboard: this.#column.element.contains(document.activeElement) });
    if (answer === "open" || answer === "go") this.#openAsked(tab);
    // Kept waiting or refused, the asking board is marked until the seller opens it: its tab's dot, the icon's number or dot.
    else if (answer === "wait" || answer === "refused") this.#board.doorMarked(tab);
  }

  /**
   * The column opened, or gone to, on the board a page asked for: never by the seller's hand, so it changes no door. Beside the chat the
   * keyboard stays where it was; under a sheet it goes to the board's icon, where the icon's own press would leave it. A screen reader is
   * told the board opened.
   */
  #openAsked(tab: string): void { this.#columnTo(() => this.#board.showTab(tab), this.#say("frame.boardShown", { name: this.#board.label(tab) })); }

  /**
   * A file cx named, pressed in the chat, on a card or on a page: shown on its own tab of the board, the column opened as for a page's
   * ask, and said. Where the account's packages show no board there is no tab to make, and the press does nothing.
   */
  #openFile(path: string, from: OpenedFrom): void {
    if (!this.#column.installed) return;
    this.#columnTo(() => this.#board.openFile(path, from), this.#say("frame.fileShown", { name: fileName(path) }));
  }

  #columnTo(show: () => void, said: string): void {
    const held = document.activeElement;
    show();
    if (!this.#column.open) { this.#doorOpening = true; try { this.#column.set(true); } finally { this.#doorOpening = false; } }
    if (this.#column.over) this.#column.icon.focus({ preventScroll: true });
    else if (held instanceof HTMLElement && held !== document.body && document.activeElement !== held) held.focus({ preventScroll: true });
    this.#announce.textContent = said;
  }

  /**
   * The message a board's page sends, as the message box sends one: false, and it is drafted instead, where the box cannot take a message now —
   * out of reach, before the computer is first read, or a start that was refused or failed, which is asked for again.
   */
  #sendBoard(message: string): boolean {
    const kind = this.#scene?.kind;
    if (kind === "unreachable" || kind === "unreachableAsleep" || kind === "unknown") {
      this.#sayReconnecting();
      if (this.#visit.unreachable) void this.#visit.look();
      return false;
    }
    if (kind === "refused" || kind === "failed") { void this.#visit.wake(); return false; }
    this.#hush();
    this.#shutCard(false);
    if (this.#away !== undefined || this.#jumping !== undefined || this.#jumpFailed !== undefined) { this.#leaveStretch(); this.#reading = undefined; this.#streamView.toLatest(); this.draw(); }
    void this.#visit.send(message);
    return true;
  }

  draw(): void {
    document.documentElement.lang = this.language === "zh" ? "zh-Hans" : "en";
    const say = this.#say;
    const me = this.#me;
    // Before the account answers, the platform's word that the page was asked with a session draws the frame; nothing else does.
    const framed = me?.kind === "signed_in" || (me === undefined && this.#presumed && !this.#visit.unreachable);
    this.root.className = !framed ? "app bare" : this.#sidebarOpen ? "app sidebar-shown" : "app";
    this.#drawBoard();
    this.#opener.setAttribute("aria-label", say("nav.openSidebar"));
    this.#drawSidebar();
    this.#drawContents();
    this.#drawBar(true);
    this.#drawWindow();
    // A first answer that never came — the platform unreachable, or its ledger out, which `/me` answers 503 — is said, not left blank.
    if (me === undefined && !framed) { this.#main.replaceChildren(...(this.#visit.unreachable ? [h("p", { class: "signed-out", role: "status" }, say("status.unreachable"))] : [])); return; }
    if (me === undefined) {
      // The Plugins page's frame needs no read: it stands, over its one loading line, from the first draw.
      if (this.route === "plugins") { if (this.#catalogue.element.parentElement !== this.#main) this.#main.replaceChildren(this.#catalogue.element); this.#catalogue.draw(); return; }
      if (this.route !== "stream") { this.#main.replaceChildren(); return; }
      this.#streamView.show(this.#main, this.#latestSlot, this.#bottom);
      this.#updateStream();
      this.#drawComposer();
      return;
    }
    if (me.kind === "signed_out") { this.#main.replaceChildren(h("p", { class: "signed-out" }, say("signedOut.notice"), " ", h("a", { href: this.backend.links.signIn }, say("signedOut.link")))); return; }
    if (this.route === "plugins") {
      const page = this.#catalogue;
      if (page.element.parentElement !== this.#main || page.unasked) { this.#main.replaceChildren(page.element); void page.load().then(() => this.#showPlugins()); }
      page.draw();
      return;
    }
    this.#streamView.show(this.#main, this.#latestSlot, this.#bottom);
    this.#updateStream();
    this.#drawComposer();
    this.#drawFeature();
    this.#newPart();
    // Words a page put in the composer land with the cursor after them, once the composer is on the page again.
    if (this.#focusDraft) { const [from, to] = this.#draftSelect ?? [this.#draft.value.length, this.#draft.value.length]; this.#focusDraft = false; this.#draftSelect = undefined; this.#draft.focus(); this.#draft.setSelectionRange(from, to); }
  }

  /**
   * The settings window stands where the address names it and a person is signed in, and nowhere else; 组织设置 likewise, for the admin of
   * the organization in use alone. Anyone else who types its address is shown the chat.
   */
  #drawWindow(): void {
    const me = this.#me?.kind === "signed_in" ? this.#me : undefined;
    if (me !== undefined && this.#paidBack) {
      this.#paidBack = false;
      if (me.organization?.role === "admin" && location.hash === "#/settings/billing") history.replaceState(null, "", "#/organization/billing");
    }
    if (me !== undefined && organizationAddress(location.hash) && me.organization?.role !== "admin") { history.replaceState(null, "", "#/"); this.#moved(); return; }
    const section = me !== undefined && windowAddress(location.hash) ? sectionOf(location.hash) : undefined;
    if (section !== undefined || this.#window.showing) void this.#window.show(section);
    const organization = me !== undefined && organizationAddress(location.hash) ? sectionOf(location.hash, "organization") : undefined;
    if (organization !== undefined || this.#organizationWindow.showing) void this.#organizationWindow.show(organization);
  }

  #drawSidebar(): void {
    const say = this.#say;
    const me = this.#me;
    // Before the account and the glance answer, the frame's fixed parts: the figures are filled as their reads return.
    const presumed = me === undefined && this.#presumed && !this.#visit.unreachable;
    if (me?.kind !== "signed_in" && !presumed) { this.#sidebar.replaceChildren(); return; }
    // A redraw moves the foot, and the account's button and its menu with it: the keyboard on either stays where it was, and an open
    // menu stays open over the page.
    const onButton = this.#accountButton === document.activeElement;
    const inMenu = this.#accountList.contains(document.activeElement) ? document.activeElement as HTMLElement : undefined;
    this.#closer.setAttribute("aria-label", say("nav.closeSidebar"));
    const place = this.#history.holdPlace();
    fill(this.#sidebar,
      h("div", { class: "sidebar-head" }, h("a", { class: "brand", href: "#/", onclick: () => { if (this.#handOff()) this.draw(); } }, say("app.name")), this.#closer),
      this.#history.element,
      h("nav", { class: "entries", "aria-label": say("nav.plugins") },
        h("a", { class: "entry", href: "#/plugins", "aria-current": current("#/plugins", this.#pageHash) },
          h("span", { class: "entry-name" }, say("nav.plugins"), ...this.#catalogue.newDot())),
        // The rows are the entry's sibling, not inside its link: one element, one target, so a row lights and opens its source alone.
        this.#bar.element),
      me?.kind === "signed_in" ? this.#drawFoot(me) : this.#foot);
    place();
    if (onButton) this.#accountButton.focus();
    if (this.#switched && me?.kind === "signed_in") { this.#switched = false; giveBack(this.#accountButton); }
    // A row the keyboard was on that the redraw replaced has left the page: the open menu closes by its own close and hands the keyboard
    // to its button; a row still drawn keeps it.
    if (inMenu?.isConnected === true) inMenu.focus();
    else if (inMenu !== undefined) this.#accountMenu.close(true);
  }

  /**
   * The corner is the account: who is signed in, and a menu from it — settings, the invitation sheet where the account is offered it,
   * help and signing out. The balance is not here: it is in Settings, and the line over the message box says when it runs low.
   * Language is a setting, not an item. A person in an organisation reads under their name the account in use, and finds in the menu
   * each organisation and then their own account, the one in use ticked: a press on another switches to it, and the pages start again
   * in it. Every person's corner ends in the chevron, the whole corner the press.
   */
  #drawFoot(me: SignedIn): HTMLElement {
    const say = this.#say;
    const who = me.name ?? me.email ?? say("account.signedIn");
    const help = this.backend.links.help;
    const spaces = switchable(this.#spaces);
    const inUse = spaces === undefined ? undefined : inUseName(spaces, say("space.own"));
    const admin = me.organization?.role === "admin";
    const rows = JSON.stringify([this.language, me.email, this.#inviting, help, who, spaces, admin]);
    if (rows !== this.#accountRows) {
      this.#accountRows = rows;
      const row = (href: string, words: Child, act: (event: Event) => void): HTMLElement => h("a", { class: "f-menu-row", role: "menuitem", tabindex: "-1", href, onclick: act }, words);
      fill(this.#accountList,
        me.email !== undefined && h("p", { class: "quiet menu-email" }, me.email),
        spaces !== undefined && accountGroup({ spaces, own: say("space.own"), who, label: say("space.switch"), use: (id) => { void this.backend.use(id).catch(() => undefined); } }),
        spaces !== undefined && h("div", { class: "f-menu-rule", role: "separator" }),
        row("#/settings", h("span", { class: "f-words" }, say("menu.settings")), (event) => { event.preventDefault(); this.#window.open(); }),
        admin && row("#/organization", h("span", { class: "f-words" }, say("osw.title")), (event) => { event.preventDefault(); this.#organizationWindow.open(); }),
        this.#inviting && row("#/invite", h("span", { class: "f-words" }, say("menu.invite")), (event) => { event.preventDefault(); this.#window.open("#/invite"); }),
        // Help keeps the address it writes to on its one line, quiet after its word.
        row(help, h("span", { class: "f-words" }, say("menu.help"), " ", h("span", { class: "quiet" }, help.replace(/^mailto:/, ""))), () => undefined),
        h("button", { type: "button", class: "f-menu-row", role: "menuitem", tabindex: "-1", onclick: () => { void this.#leave(); } }, h("span", { class: "f-words" }, say("menu.logOut"))));
      this.#accountList.setAttribute("aria-label", say("menu.label"));
    }
    fill(this.#accountButton,
      avatar(who, this.backend.photo()),
      h("span", { class: "who" }, h("span", { class: "name" }, who), inUse !== undefined && h("span", { class: "space" }, inUse)),
      chevron());
    this.#accountWho = me.email ?? who;
    this.#accountButton.setAttribute("aria-label", [who, inUse, me.email === who ? undefined : me.email].filter((one) => one !== undefined).join(" "));
    fill(this.#foot, this.#leaveFailed && h("p", { class: "marker failed", role: "status" }, say("status.signOutFailed")), this.#accountButton, this.#accountList);
    return this.#foot;
  }

  /** History, for the life the live view is in, with what the live view adds since its last read. */
  #drawContents(): void {
    this.#history.follow();
    this.#history.draw();
  }

  #drawComposer(): void {
    const say = this.#say;
    const me = this.#me;
    if (me === undefined && this.#presumed) { this.#drawComposerUnknown(); return; }
    if (me?.kind !== "signed_in") return;
    const visit = this.#visit;
    const failed = visit.failed;
    const { reads, w } = this.#boxReads(me);
    const line = closedLine(reads, w);
    const closed = line?.key;
    // The line says only what neither card nor cx says: a conversation that stopped updating, a message not sent, and an action from a
    // card that did not finish. Why a start did not happen is cx's bubble and the cards'.
    const said: StringKey | undefined = visit.connection === "held" ? "status.conflict" : this.#unsent ? "status.unsent" : failed !== undefined ? "cx.failed" : undefined;
    if (said === "status.conflict") fill(this.#statusText, say(said), " ", h("button", { type: "button", onclick: () => this.#visit.retry() }, say("status.retry")));
    else if (said === "cx.failed" && failed !== undefined) fill(this.#statusText, say(said, { action: say(ASKED_WORDS[failed]) }));
    else if (said === "status.unsent" && this.#unsentWhy !== undefined) {
      const [before, words, after] = sayAround(say, "status.piSaid", { words: this.#unsentWhy }, "words");
      // A Chinese sentence ends on its own full stop and takes no space after it.
      fill(this.#statusText, say(said), this.language === "zh" ? "" : " ", h("span", { class: "pi-words" }, before, h("span", { lang: "en" }, words), after));
    }
    else if (said !== undefined) fill(this.#statusText, say(said));
    else { const over = balanceLine(reads, w); fill(this.#statusText, ...(over === undefined ? [] : this.#linked(over))); }
    this.#status.className = lineTone(said);
    // Why the box takes no message stands first on the line, save behind a conversation that stopped updating: its 重试 is what mends the page.
    const after = said === "status.conflict";
    if (after !== (this.#statusText.nextElementSibling === this.#closed)) { if (after) this.#statusText.after(this.#closed); else this.#statusText.before(this.#closed); }
    this.#drawCx();
    // The floor and a box not set up keep the person from sending, never from writing: the box takes words and files, and Send stays off.
    this.#draft.placeholder = this.suggestion() ?? say("composer.placeholder");
    this.#draft.setAttribute("aria-label", say("composer.placeholder"));
    this.#closed.hidden = closed === undefined;
    fill(this.#closed, ...(line === undefined ? [] : this.#linked(line)));
    // A box that closes under a person on the page, or closes for another reason, says its line once; a page that opens closed is
    // read where the line stands.
    if (this.#closedSaid !== undefined && closed !== undefined && closed !== this.#closedSaid) this.#hear(this.#closed.textContent ?? "");
    this.#closedSaid = closed ?? "";
    if (visit.awake !== this.#slashAwake) { this.#slashAwake = visit.awake; this.#slash.again(); }
    this.#drawModel();
    this.#quoteBox.draw();
    this.#drawControl();
  }

  #roomForReason(): void {
    const style = getComputedStyle(this.#closed);
    const more = this.#closed.hidden ? 0 : Math.max(0, Math.floor(this.#closed.offsetHeight - parseFloat(style.lineHeight) - parseFloat(style.paddingBottom)));
    this.#streamView.element.style.paddingBottom = more > 0 ? `calc(var(--space-9) + ${more}px)` : "";
    // Padding is outside the box a resize observation reads: the view keeps its place, at the bottom staying there, as for any resize.
    this.#streamView.resized();
  }

  /** What the lines by the message box are read from, for the account signed in. */
  #boxReads(me: Extract<Me, { kind: "signed_in" }>): { readonly reads: Parameters<typeof closedLine>[0]; readonly w: Writer } {
    const w = writer({ language: this.language, say: this.#say, money: me.money, year: new Date(this.backend.now()).getFullYear() });
    const reads = { box: me.box, balance: me.balance, checkout: this.backend.features.checkout, money: this.#money, subscription: this.#subscription,
      waiting: this.#window.paying.waiting, starting: this.#window.paying.starting, own: this.#glance !== undefined && ownModel({ models: this.#glance.models }) !== undefined,
      unreachable: this.#visit.unreachable, ...(me.organization === undefined ? {} : { organization: me.organization }) };
    return { reads, w };
  }

  /** The line that stands where the message box was, if the box takes no message: the board's place says the same under the floor. */
  #boxLine(): BoxLine | undefined {
    const me = this.#me;
    if (me?.kind !== "signed_in") return undefined;
    const { reads, w } = this.#boxReads(me);
    return closedLine(reads, w);
  }

  /** Says words once to a screen reader and takes them away again, so a reader that walks the page meets the line where it stands and not a second time. */
  #hear(words: string): void {
    this.#announce.textContent = words;
    setTimeout(() => { if (this.#announce.textContent === words) this.#announce.textContent = ""; }, HEARD_MS);
  }

  /** A line by the message box as drawn: its braced words, where it has a way on, are the link there, inside the one sentence. */
  #linked(line: BoxLine): readonly (string | HTMLElement)[] { return linked(this.#say(line.key, line.values), line.href); }

  /**
   * The one control: with something to send it is Send, whether cx works or rests; with nothing to send it is Stop while cx works and
   * Send, off, at rest. A message box that takes no message has nothing to send, so a turn still running there can be stopped.
   */
  #drawControl(): void {
    const me = this.#me;
    const open = this.#visit.canOpen;
    const files = this.#uploads;
    const holds = this.#draft.value.trim() !== "" || this.#quoteBox.quotes.length > 0 || files.cards.length > 0 || this.suggestion() !== undefined;
    // Send waits for every file to be whole in the seller's files.
    const sends = open && holds && files.ready;
    // A box holding something it cannot send yet keeps Send, off: Stop is the control only where there is nothing to send.
    const does = !(open && holds) && me?.kind === "signed_in" && this.#visit.stoppable ? "stop" : "send";
    const control = this.#control;
    if (control.dataset["does"] !== does) {
      control.dataset["does"] = does;
      control.classList.toggle("primary", does === "send");
      fill(control, does === "stop" ? stopIcon() : sendIcon());
    }
    const name = this.#say(does === "stop" ? "composer.stop" : "composer.send");
    const add = this.#say("composer.addFiles");
    this.#add.setAttribute("aria-label", add);
    this.#dropSaid.textContent = this.#say("composer.drop");
    control.setAttribute("aria-label", name);
    const off = does === "send" && !sends;
    // A control that goes off under the focus would leave the focus on nothing: it goes to the message box, where the next key is typed.
    if (off && document.activeElement === control) this.#draft.focus({ preventScroll: true });
    control.disabled = off;
  }

  /**
   * The control changes from Send to Stop under the pointer that pressed it, and a first Stop leaves it Stop: the second press of a
   * double-click would do the other thing to what the first just did, so it does nothing.
   */
  #press(event: Event): void {
    if (twice(event)) return;
    if (this.#control.dataset["does"] === "stop") this.#stop();
    else this.#send();
  }

  /** The message box's Stop. Out of reach it goes once all the same, and cx says again that the page is reconnecting, as on a Send. */
  #stop(): void {
    const kind = this.#scene?.kind;
    if (kind === "unreachable" || kind === "unreachableAsleep" || kind === "unknown") this.#sayReconnecting();
    void this.#visit.stop();
  }

  /** The focus of a control that is gone goes to the message box, which takes words whether or not it takes a message. */
  #toBox(): void { this.#draft.focus({ preventScroll: true }); }

  /**
   * The feature card stands at the end of the conversation from the first opening of it that is not under an answer running, while it
   * was not put away today; it reads the Plugins page's world once, and after a press each redraw shows how the queue moved.
   */
  #drawFeature(): void {
    const card = this.#feature;
    if (card !== undefined) {
      const world = this.#catalogue.feature();
      if (world !== undefined && card.open) card.update(world);
      this.#streamView.feature(card.element);
      return;
    }
    // The opening is read once the stream has said whether a turn runs: a box heard asleep runs none; an awake one says so in its first turn frame.
    const visit = this.#visit;
    if (this.#featureAsked || !(visit.box === "asleep" || (visit.box === "awake" && visit.stream.turn !== undefined))) return;
    this.#featureAsked = true;
    if (visit.running || !featureDue(localStorage)) return;
    void this.#catalogue.load().then(() => {
      const world = this.#catalogue.feature();
      if (world === undefined || this.#visit.running || this.#feature !== undefined) return;
      const pages = pagesOf(world);
      if (pages.length === 0) return;
      this.#feature = new FeatureCard({ say: this.#say, language: () => this.language, left: (focused) => { putAway(localStorage); if (focused) this.#toBox(); } }, world, pages);
      if (this.route === "stream") this.#streamView.feature(this.#feature.element);
    });
  }

  /** The composer before the account answers: the person may write, and nothing is sent until the page knows whom for. */
  #drawComposerUnknown(): void {
    const say = this.#say;
    fill(this.#statusText);
    this.#status.className = "status";
    this.#drawCx();
    this.#draft.placeholder = this.suggestion() ?? say("composer.placeholder");
    this.#draft.setAttribute("aria-label", say("composer.placeholder"));
    this.#drawModel();
    this.#drawControl();
  }

  /**
   * A choice is shown at the click and goes to the platform, which gives it to a running box or keeps it for the next message; its
   * answer only corrects the line. Picks go one at a time and the last stands: one made while another is on its way replaces any not yet sent.
   */
  #choose(provider: string, modelId: string, platform?: boolean, series?: SeriesPick): void {
    void this.#picks.choose(provider, modelId, platform, series);
    this.#drawComposer();
  }

  #shownModels(models: Models, pending: Choice | undefined): Shown | undefined {
    return shownModels(models, { awake: this.#visit.awake, picked: this.#picks.held, pending, stream: this.#visit.stream, heard: this.#visit.answered, taken: this.#glance?.taken });
  }

  #drawModel(): void {
    const glance = this.#glance;
    const shown = glance === undefined ? undefined : this.#shownModels(glance.models, glance.pending);
    const view = glance === undefined || shown === undefined ? NO_VIEW : cardView(shown, glance.providers ?? [], glance.accounts, this.#makers, glance.ticked, this.#picks.byName, glance.offer);
    this.#card.update(view, this.language);
    this.#aiNote.textContent = this.#say("composer.aiNote");
    this.#ccModelName.textContent = this.#say("model.title");
    this.#ccLevelName.textContent = this.#say("cc.level");
    const said = pickLine(this.#picks.failed, view, this.#say);
    this.#pickSaid.textContent = said ?? "";
    this.#pickSaid.hidden = said === undefined;
    const current = view.current;
    const inUse = current === undefined ? undefined : view.slots.flatMap((slot) => slot.models).find((model) => model.provider === current.provider && model.id === current.id);
    // The model the box will run on, as the card names it, the platform's default where it names none: pi's levels on it are its record's.
    const named = shown?.current ?? shown?.default;
    const levels = named === undefined ? undefined : [...(shown?.available ?? []), ...(glance?.offer?.models ?? [])].find((model) => model.provider === named.provider && model.id === named.id)?.thinkingLevels;
    const drawn = this.#thinkingDrawn(levels, named);
    this.#thinkingCard.update({ thinking: drawn?.thinking, way: inUse?.source === "account" ? "signedIn" : "paid" }, this.language);
    // A model with one level has no 思考强度 row: no control chooses nothing.
    const selector = this.#thinkingCard.element;
    if (selector.hidden) selector.remove(); else if (selector.parentElement !== this.#ccLevel) this.#ccLevel.append(selector);
    keep(this.#ccLevel, "hidden", selector.hidden);
    const kept = drawn?.kept === true ? this.#say("thinking.kept", { level: drawn.thinking.level }) : undefined;
    this.#thinkingSaid.textContent = kept ?? "";
    this.#thinkingSaid.hidden = kept === undefined;
  }

  /** Opens the card on a level: the preview names one in its address so each state is one screenshot. */
  showCard(level: Level): void {
    if (this.#opened !== "cx") this.#openCard("cx");
    this.#card.show(level);
  }
}

/** A sidebar entry names the page that is open, as the board draws it. */
export function current(entry: string, hash: string): "page" | undefined {
  const page = hash.split("?")[0]!;
  return page === entry || page.startsWith(`${entry}/`) ? "page" : undefined;
}
