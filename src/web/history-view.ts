import type { Backend, FoundRow, HistoryRow, Span } from "./backend.js";
import { dayKey, dayName } from "./days.js";
import { fill, h, type Child } from "./dom.js";
import { hideTipWithin, searchBox, tip } from "./forms.js";
import { found, HISTORY_EMPTY, linesOf, listed, newestShown, opened, seqOf, SHOWN, shown, spanOf, toggled, unplaced, type HistoryState } from "./history-model.js";
import type { StreamState } from "./stream-model.js";
import type { Say } from "./stream-view.js";
import type { Language, StringKey } from "./strings.js";
import { bar, keepRows, rowsFor, skeleton } from "./waiting.js";

/** A row's whole words, which it may cut to one line: a drawn tip shows them, wrapping, where it does cut them, and nothing where it does not. */
const cut = <T extends HTMLElement>(row: T, words: string): T => tip(row, () => { const name = row.querySelector<HTMLElement>(".row-name") ?? row; return name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1 ? [words] : []; });

/** Rows of History not read yet, each a title's line in the list's own row; the list's line, not the shape, says what it waits on. */
const rowsShape = (rows: number): HTMLElement => skeleton(undefined, h("ul", {}, ...Array.from({ length: rows }, (_, at) => h("li", {}, h("p", { class: "history-row result" }, bar(at % 2 === 0 ? 10 : 7, "small"))))));

export type HistoryPorts = {
  readonly backend: Pick<Backend, "topics" | "search">;
  readonly say: Say;
  readonly language: () => Language;
  readonly now: () => number;
  /** The live view: its titles and the person's messages join the rows read. */
  readonly live: () => StreamState;
  /** The place the reader went to from the list, while the page shows it; none at the latest message. */
  readonly reading: () => string | undefined;
  /** Go to a place in the conversation. */
  readonly jump: (place: string) => void;
  /** Whether the page shows the chat at its latest message: the entry that goes there is then the current one. */
  readonly latest: () => boolean;
  /** The entry to the chat pressed: the chat at its latest message. */
  readonly toChat: () => void;
};

/** The pause after the last key before a search asks the platform. */
export const SEARCH_WAIT_MS = 300;
/** The most a search may hold: the platform's own bound on `q`, so no search the box takes is refused. */
export const SEARCH_MAX = 100;
/** How near the top of the open list the reader is when the part before is asked for. */
const NEAR_TOP_PX = 40;

/** The search box's name among History's focus: it is the one control with no row's key. */
const SEARCH_KEY = "\u0000search";

/**
 * The sidebar's History: its heading, drawn as the Plugins entry is, opens the whole list in the sidebar with a search above it; shut,
 * the five newest rows show, the newest at the bottom. A row is its title; the row the reader went to opens to the person's messages in
 * it, one row at a time, and shuts when its title is pressed again. The heading and the search stay where they are and the list scrolls under them, its earlier parts read as the
 * reader reaches its top. Every redraw keeps the control a key is on, by its name, and the list's place.
 */
export class HistoryView {
  readonly element = h("nav", { class: "contents history" });
  readonly #heading = h("h2", {});
  readonly #searchBox = h("input", { type: "search", class: "history-search", autocomplete: "off", spellcheck: "false", maxlength: String(SEARCH_MAX) });
  readonly #searchField = searchBox(this.#searchBox);
  readonly #list = h("div", { class: "history-list" });
  /**
   * What a search came to, said to a screen reader once as it changes: the words shown in the list are not read out as they redraw.
   * What it found is the one line a sighted reader has for it too, so the count shows under the search box; its other words stand in
   * the list already and stay unseen here.
   */
  readonly #said = h("p", { class: "unseen", "aria-live": "polite" });
  /**
   * The list's scroll as last seen while it showed. A hidden list reads 0 for its scroll, and a list put back after being hidden starts
   * at 0: what it gives back is this, until it shows again.
   */
  #seenTop = 0;
  #hidden = false;
  #state: HistoryState = HISTORY_EMPTY;
  #epoch: string | undefined;
  #asking: ReturnType<typeof setTimeout> | undefined;
  /** The latest read of the list and of a search: a reply to an earlier one never replaces a later one's. */
  #listRead = 0;
  /** The messages whose live titles History has read again for, once each, in the life it shows. */
  #readFor = new Set<string>();
  #searchRead = 0;
  /** Rows drawn so far, so a title that arrives settles in once; none before the first draw. */
  #drawn: Set<string> | undefined;
  #wasReading = false;
  /** What the last draw was drawn from: a stream event that changes none of it — a word of cx's answer — draws nothing. */
  #drawnFrom: readonly unknown[] = [];
  /** The row last brought into view in the list: a row is revealed when it becomes the one read, not on every draw after. */
  #revealed: string | undefined;
  /** Whether the shut list stands at its newest: it opens there, and keeps the reader's own scroll once they move it. */
  #shutAtNewest = true;

  constructor(readonly ports: HistoryPorts) {
    this.element.append(this.#heading, this.#searchField, this.#said, this.#list);
    this.#searchBox.addEventListener("input", () => { this.#search(this.#searchBox.value); });
    // Escape clears the words first, then shuts the list and gives the heading that opened it the focus.
    this.#searchBox.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (this.clearWords()) return;
      this.#set({ ...this.#state, full: false, search: undefined });
      this.#heading.querySelector("button")?.focus();
    });
    this.#list.addEventListener("scroll", () => {
      if (this.#list.clientHeight === 0) return;
      this.#seenTop = this.#list.scrollTop;
      this.#noteNewest();
      if (this.#list.scrollTop < NEAR_TOP_PX) void this.#earlier();
    });
  }

  get state(): HistoryState { return this.#state; }

  /** A search box that holds words gives them up and shows the list again; said back is whether it held any. */
  clearWords(): boolean {
    if (!this.#state.full || this.#searchBox.value === "") return false;
    this.#searchBox.value = "";
    this.#search("");
    return true;
  }

  /** Forgets the list: the next draw reads it again. The preview starts a recording over with it. */
  forget(): void {
    clearTimeout(this.#asking);
    this.#listRead++;
    this.#searchRead++;
    this.#epoch = undefined;
    this.#state = { ...HISTORY_EMPTY, full: this.#state.full };
    this.#searchBox.value = "";
    this.#drawn = undefined;
    this.#drawnFrom = [];
  }

  /**
   * The list's first part read again for the life it shows, the rows standing meanwhile, and a search in progress asked again: a change
   * to the account's packages can change whether titles show, and what a fresh read would show is what History shows. An answer of
   * another life, or none, changes nothing.
   */
  async reread(): Promise<void> {
    const epoch = this.#epoch;
    if (epoch === undefined) return;
    const read = ++this.#listRead;
    const search = this.#state.search;
    if (search !== undefined) {
      clearTimeout(this.#asking);
      this.#set({ ...this.#state, search: { words: search.words, rows: [], next: undefined, loading: "first", failed: false } });
      void this.#ask(search.words);
    }
    const part = await this.ports.backend.topics(epoch).then(ofLife(epoch)).catch(() => undefined);
    if (part === undefined || epoch !== this.#epoch || read !== this.#listRead) return;
    this.#set(listed(this.#state, part, true));
  }

  /**
   * The list for the life the live view is in, read once per life; nothing before the view knows its life. A live title on a message
   * neither a row nor the live view holds has the list read again, once for that message, since no row can take it before.
   */
  follow(): void {
    const live = this.ports.live();
    const epoch = live.epoch;
    if (epoch === undefined) return;
    if (epoch === this.#epoch) {
      if (!this.#state.read || this.#state.loading !== undefined || !this.#state.titled) return;
      const fresh = unplaced(this.#state.rows, live).filter((target) => !this.#readFor.has(target));
      if (fresh.length === 0) return;
      for (const target of fresh) this.#readFor.add(target);
      void this.reread();
      return;
    }
    this.#epoch = epoch;
    this.#readFor = new Set();
    this.#state = { ...HISTORY_EMPTY, full: this.#state.full };
    this.#drawn = undefined;
    void this.#first();
  }

  /** The list's first part, asked of the live view's life; an answer of another life is dropped and asked again, once. */
  async #first(again = true): Promise<void> {
    const epoch = this.#epoch;
    if (epoch === undefined) return;
    const read = ++this.#listRead;
    this.#set({ ...this.#state, loading: "first", failed: false });
    const part = await this.ports.backend.topics(epoch).catch(() => undefined);
    if (epoch !== this.#epoch || read !== this.#listRead) return;
    if (part !== undefined && part.epoch !== epoch && again) { void this.#first(false); return; }
    this.#set(part === undefined || part.epoch !== epoch ? { ...this.#state, loading: undefined, failed: true } : listed(this.#state, part, true));
  }

  /** The part before what the open list shows, as the reader reaches its top; the rows in view keep their place when it comes. */
  async #earlier(): Promise<void> {
    const state = this.#state;
    // A hidden list reads 0 for its scroll and its height, which is neither the reader at its top nor a list too short to scroll.
    if (!state.full || this.#list.clientHeight === 0) return;
    const search = state.search;
    const next = search !== undefined ? search.next : state.next;
    if (next === undefined || state.loading !== undefined || search?.loading !== undefined) return;
    const epoch = this.#epoch;
    if (epoch === undefined) return;
    const read = search !== undefined ? this.#searchRead : this.#listRead;
    // The waiting line shows where the reader is, at the top.
    this.#set(search !== undefined ? { ...state, search: { ...search, loading: "earlier" } } : { ...state, loading: "earlier" });
    this.#list.scrollTop = 0;
    if (search !== undefined) {
      const part = await this.ports.backend.search(epoch, search.words, next).then(ofLife(epoch)).catch(() => undefined);
      if (epoch !== this.#epoch || this.#state.search?.words !== search.words) return;
      // A later read took its place: the waiting line it drew goes, and nothing it brings is kept.
      if (read !== this.#searchRead) { if (this.#state.search.loading === "earlier") this.#set({ ...this.#state, search: { ...this.#state.search, loading: undefined } }); return; }
      this.#keepingPlace(() => { this.#state = part === undefined ? { ...this.#state, search: { ...this.#state.search!, loading: undefined, failed: true } } : found(this.#state, search.words, part, false); });
    } else {
      const part = await this.ports.backend.topics(epoch, next).then(ofLife(epoch)).catch(() => undefined);
      if (epoch !== this.#epoch) return;
      if (read !== this.#listRead) { if (this.#state.loading === "earlier") this.#set({ ...this.#state, loading: undefined }); return; }
      this.#keepingPlace(() => { this.#state = part === undefined ? { ...this.#state, loading: undefined, failed: true } : listed(this.#state, part, false); });
    }
  }

  #keepingPlace(change: () => void): void {
    const fromBottom = this.#list.scrollHeight - this.#list.scrollTop;
    change();
    this.draw(true);
    this.#list.scrollTop = this.#list.scrollHeight - fromBottom;
  }

  #search(value: string): void {
    clearTimeout(this.#asking);
    const words = value.trim();
    if (words === "") { this.#set({ ...this.#state, search: undefined }); this.#toNewest(); return; }
    this.#set({ ...this.#state, search: { words, rows: [], next: undefined, loading: "first", failed: false } });
    this.#asking = setTimeout(() => { void this.#ask(words); }, SEARCH_WAIT_MS);
  }

  async #ask(words: string): Promise<void> {
    const epoch = this.#epoch;
    if (epoch === undefined) return;
    const read = ++this.#searchRead;
    const part = await this.ports.backend.search(epoch, words).then(ofLife(epoch)).catch(() => undefined);
    if (epoch !== this.#epoch || this.#state.search?.words !== words || read !== this.#searchRead) return;
    this.#set(part === undefined ? { ...this.#state, search: { ...this.#state.search, loading: undefined, failed: true } } : found(this.#state, words, part, true));
    this.#toNewest();
  }

  #toggle(): void {
    clearTimeout(this.#asking);
    const full = !this.#state.full;
    this.#searchBox.value = "";
    this.#set({ ...this.#state, full, search: undefined });
    if (full) { this.#toNewest(); this.#searchBox.focus({ preventScroll: true }); }
  }

  /** A shut title, a message or a search's title pressed: the conversation goes there, the row opens, and the row pressed keeps its place on screen. */
  #press(event: Event, at: string, row: string): void {
    // A press brings the row read into view once more, even the one already read.
    this.#revealed = undefined;
    this.#keepingPressed(event, opened(this.#state, row));
    this.ports.jump(at);
  }

  /**
   * A row's list opened or shut, and the conversation left where it is: the row of the messages before the first title on every press,
   * a title on the press that shuts it.
   */
  #fold(event: Event, row: string, open: boolean): void { this.#keepingPressed(event, toggled(this.#state, row, open)); }

  #keepingPressed(event: Event, state: HistoryState): void {
    const pressed = event.currentTarget as HTMLElement;
    pressed.focus({ preventScroll: true });
    const key = pressed.dataset["key"];
    const top = this.#list.clientHeight > 0 ? pressed.getBoundingClientRect().top : undefined;
    this.#set(state);
    const again = key === undefined ? null : this.#list.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
    if (again !== null && top !== undefined) this.#setTop(this.#list.scrollTop + again.getBoundingClientRect().top - top);
  }

  /** The list's state replaced and drawn. The whole list shut, by its heading or by Escape, opens the shut list at its newest again. */
  #set(state: HistoryState): void {
    if (this.#state.full && !state.full) this.#shutAtNewest = true;
    this.#state = state;
    this.draw(true);
  }

  /** The open list starts at its newest row, at the bottom. */
  #toNewest(): void { this.#list.scrollTop = this.#newestTop(); }

  /** Where the list's newest stands: titles at the bottom, messages without titles at the top. */
  #newestTop(): number { return this.#state.titled ? this.#list.scrollHeight : 0; }

  /** The shut list's scroll as it now stands, read as at its newest or not; a hidden list's scroll says nothing. */
  #noteNewest(): void {
    if (this.#state.full || this.#list.clientHeight === 0) return;
    const list = this.#list;
    this.#shutAtNewest = this.#state.titled ? list.scrollTop + list.clientHeight >= list.scrollHeight - 1 : list.scrollTop <= 1;
  }

  /**
   * The list's place and what in History has the focus, to give back once the sidebar it sits in has been put back: taking a list out
   * of the page resets its scroll and drops the focus. The focus goes back by name, to the same row redrawn.
   */
  holdPlace(): () => void {
    const top = this.#top();
    const newest = !this.#state.full && this.#shutAtNewest;
    const active = document.activeElement;
    const key = active === this.#searchBox ? SEARCH_KEY : active instanceof HTMLElement && this.element.contains(active) ? active.dataset["key"] : undefined;
    return () => {
      this.#setTop(newest ? this.#newestTop() : top);
      if (key === undefined || this.element.contains(document.activeElement)) return;
      (key === SEARCH_KEY ? this.#searchBox : this.element.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`))?.focus({ preventScroll: true });
    };
  }

  /** Where the list is scrolled to: as it stands while it shows, as last seen while it is hidden or was since. */
  #top(): number {
    if (this.#list.clientHeight === 0) this.#hidden = true;
    return this.#hidden ? this.#seenTop : this.#list.scrollTop;
  }

  /** Scrolls the list, which a hidden list cannot be: the place is kept for when it shows. */
  #setTop(top: number): void {
    this.#seenTop = top;
    if (this.#list.clientHeight === 0) { this.#hidden = true; return; }
    this.#list.scrollTop = top;
    this.#hidden = false;
    this.#noteNewest();
  }

  /** The row the reader is reading, or the heading with none, or the entry to the chat with neither: where the focus goes as the sidebar opens. */
  focusIn(): void {
    (this.#list.querySelector<HTMLElement>(".history-row[aria-current]") ?? this.#heading.querySelector<HTMLElement>("button") ?? this.#list.querySelector<HTMLElement>(".entry"))?.focus({ preventScroll: true });
  }

  /**
   * Draws the list from its state and the live view. Called on every stream event, it draws only when what it shows could have changed —
   * the rows read, the live view's titles or the person's messages, the place read, the words — so a row pressed while cx writes is
   * not replaced under the pointer. `force` draws regardless.
   */
  draw(force = false): void {
    const live = this.ports.live();
    const from = [this.#state, live.epoch, live.titles, saidKeys(live), this.ports.reading(), this.ports.language(), this.ports.latest()];
    if (!force && from.length === this.#drawnFrom.length && from.every((one, at) => one === this.#drawnFrom[at])) return;
    this.#drawnFrom = from;
    const say = this.ports.say;
    const state = this.#state;
    const held = this.element.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset["key"] : undefined;
    const rows = shown(state.rows, live, state.titled);
    const listTop = this.#top();
    const reading = this.ports.reading();
    const current = reading === undefined ? undefined : rows.find((row) => seqOf(row.at) <= seqOf(reading))?.at;
    const open = state.open ?? current;
    const known = this.#drawn;
    const arriving = known !== undefined && rows.some((row) => !known.has(row.at));
    this.#drawn = new Set(rows.map((row) => row.at));

    const named = rows.length > 0 || state.full;
    fill(this.#heading, named
      // Drawn as the sidebar's Plugins entry is: its shade on hover says it can be pressed; a screen reader hears that it opens.
      ? h("button", { type: "button", class: "entry history-head", "data-key": "head", "aria-expanded": state.full ? "true" : "false", onclick: () => { this.#toggle(); } }, h("span", { class: "entry-name" }, say("history.heading")))
      : say("history.heading"));
    this.#heading.className = named ? "head-entry" : "";
    this.#searchField.hidden = !state.full;
    this.#searchBox.placeholder = say("history.search");
    this.#searchBox.setAttribute("aria-label", say("history.search"));

    const search = state.full ? state.search : undefined;
    const fresh = (row: HistoryRow): boolean => arriving && !known.has(row.at);
    this.element.setAttribute("aria-label", say("history.heading"));
    const loading = (search !== undefined ? search.loading === "earlier" : state.full && state.loading === "earlier") ? say("history.loadingEarlier") : "";
    const outcome = search === undefined ? (!state.read && state.loading === "first" ? say("history.loading") : loading)
      : search.loading === "first" ? say("history.searching") : loading !== "" ? loading : search.failed && search.rows.length === 0 ? say("history.unavailable")
      : search.rows.length === 0 ? say("history.nothingFound") : undefined;
    // A title counts when the platform says its own words hold the searched ones: a row shown only to carry a message that does is
    // not counted, nor is the row of the messages before the first title, which has none.
    const hits = search === undefined ? [] : search.rows.flatMap((row) => row.matched);
    const count = search === undefined || outcome !== undefined ? undefined
      : foundWords(say, search.rows.filter((row) => row.byTitle).length, hits.filter((hit) => hit.who === "seller").length, hits.filter((hit) => hit.who === "cx").length);
    const said = count ?? outcome ?? "";
    if (this.#said.textContent !== said) this.#said.textContent = said;
    this.#said.className = count === undefined ? "unseen" : "history-found";
    // The list's own line says what it waits on; the shape stands where its rows will.
    if (!state.read && state.loading === "first") this.#refill( rowsShape(rowsFor("history")));
    else if (state.failed && rows.length === 0) this.#refill( h("p", { class: "empty" }, say("history.unavailable"), " ", h("button", { type: "button", class: "link", "data-key": "retry", onclick: () => { void this.#first(); } }, say("status.retry"))));
    else if (search !== undefined) this.#drawFound(search.rows, search.words, search.loading, search.failed);
    // A list not yet read is not an empty one: its line waits for the read.
    else if (rows.length === 0) { this.#refill( state.read && h("p", { class: "empty" }, say("history.empty"))); if (state.read) keepRows("history", 0); }
    // Without titles there is nothing to group the messages under: they are the list, newest first.
    else if (!state.titled) {
      const lines = linesOf(rows);
      if (!state.full) keepRows("history", Math.min(lines.length, SHOWN));
      this.#refill( state.full && state.loading === "earlier" && rowsShape(2), h("ul", { class: "history-messages alone" }, ...this.#lines(state.full ? lines : lines.slice(0, SHOWN), state.full, (line) => [
        cut(h("button", { type: "button", "data-key": `line:${line.line.at}`, "aria-current": reading === line.line.at ? "true" : undefined, onclick: (event) => { this.#press(event, line.line.at, line.row); } }, line.line.line), line.line.line)])));
    }
    else {
      const list = state.full ? [...rows].reverse() : newestShown(rows);
      if (!state.full) keepRows("history", list.length);
      this.#refill(
        state.full && state.loading === "earlier" && rowsShape(2),
        h("ul", {}, ...this.#days(list, state.full, (row) => this.#row(row, row.at === open, row.at === current, reading, fresh(row)))));
    }
    // The way to the chat is the list's last row, whatever the list holds, so it stands right after the latest title.
    this.#list.append(this.#chat());
    this.#setTop(!state.full && this.#shutAtNewest ? this.#newestTop() : listTop);
    if (held !== undefined && !this.element.contains(document.activeElement)) this.element.querySelector<HTMLElement>(`[data-key="${CSS.escape(held)}"]`)?.focus({ preventScroll: true });
    // A part shorter than the list's room brings the next with it, so there is always something to scroll up through.
    if (state.full && search === undefined && state.next !== undefined && state.loading === undefined && this.#list.clientHeight > 0 && this.#list.scrollHeight <= this.#list.clientHeight + NEAR_TOP_PX) void this.#earlier();
    // The row being read is in view in the list; with none, a title arriving, or a return to the latest message, shows the newest.
    const row = this.#list.querySelector<HTMLElement>(".history-row[aria-current]");
    if (row !== null && row.dataset["key"] !== this.#revealed) this.#reveal(row);
    else if (row === null && state.full && (arriving || this.#wasReading)) this.#toNewest();
    this.#revealed = row?.dataset["key"];
    this.#wasReading = row !== null;
  }

  /**
   * Rows under their days while the whole list is open; shut, the five rows stand alone. The row of the messages before the first title
   * stands under no day: it says the days it holds itself.
   */
  #days<T extends { readonly time: number; readonly title: string | null }>(rows: readonly T[], days: boolean, draw: (row: T) => readonly Child[]): readonly Child[] {
    let last: string | undefined;
    return rows.flatMap((row) => {
      const day = row.title === null ? undefined : dayKey(row.time);
      const head = days && day !== undefined && day !== last ? h("li", { class: "day" }, h("h3", {}, this.#day(row.time))) : undefined;
      last = day;
      return [head, h("li", {}, ...draw(row))];
    });
  }

  /** Messages listed alone, under their days while the whole list is open. */
  #lines<T extends { readonly line: { readonly time: number } }>(lines: readonly T[], days: boolean, draw: (line: T) => readonly Child[]): readonly Child[] {
    let last: string | undefined;
    return lines.flatMap((line) => {
      const day = dayKey(line.line.time);
      const head = days && day !== last ? h("li", { class: "day" }, h("h3", {}, this.#day(line.line.time))) : undefined;
      last = day;
      return [head, h("li", {}, ...draw(line))];
    });
  }

  #day(time: number): string { return dayName(time, this.ports.now(), this.ports.language(), { today: this.ports.say("stream.today"), yesterday: this.ports.say("stream.yesterday") }); }

  /** The days the messages before the first title fall on: the first and the last, or the one day they share; nothing when no time is known. */
  #daysHeld(row: HistoryRow | undefined): string | undefined {
    return this.#daysOf(row === undefined ? undefined : spanOf(row));
  }

  #daysOf(span: Span | undefined): string | undefined {
    if (span === undefined) return undefined;
    return dayKey(span.from) === dayKey(span.to) ? this.#day(span.from) : this.ports.say("history.days", { from: this.#day(span.from), to: this.#day(span.to) });
  }

  /** What the row of the messages before the first title reads: its name, and under it the days it holds. */
  #untitled(days: string | undefined, name: readonly Child[]): readonly Child[] {
    return days === undefined ? name : [h("span", { class: "row-name" }, ...name), h("span", { class: "row-days" }, days)];
  }

  #row(row: HistoryRow, open: boolean, current: boolean, reading: string | undefined, fresh: boolean): readonly Child[] {
    const title = row.title ?? this.ports.say("history.first");
    const days = row.title === null ? this.#daysHeld(row) : undefined;
    return [
      row.title === null
        // Pressing it opens and shuts its list and moves nothing: the conversation goes where a message in it is pressed.
        ? cut(h("button", { type: "button", class: "history-row untitled", "data-key": `row:${row.at}`, "aria-current": current ? "true" : undefined, "aria-expanded": open ? "true" : "false", onclick: (event) => { this.#fold(event, row.at, open); } }, ...this.#untitled(days, [title])), title)
        // Pressed while open it shuts as the row above does; shut, it opens and the conversation goes to it.
        // The arrival is said once: the mark goes with its motion, or the row would settle in again each time the sidebar is put back.
        : cut(h("button", { type: "button", class: `history-row${fresh ? " arrived" : ""}`, "data-key": `row:${row.at}`, "aria-current": current ? "true" : undefined, "aria-expanded": open ? "true" : "false", onclick: (event) => { if (open) this.#fold(event, row.at, open); else this.#press(event, row.at, row.at); },
            onanimationend: (event) => { (event.currentTarget as HTMLElement).classList.remove("arrived"); }, onanimationcancel: (event) => { (event.currentTarget as HTMLElement).classList.remove("arrived"); } }, title), title),
      open && row.messages.length > 0 && h("ul", { class: "history-messages" }, ...row.messages.map((line) =>
        h("li", {}, cut(h("button", { type: "button", "data-key": `line:${line.at}`, "aria-current": current && reading === line.at ? "true" : undefined, onclick: (event) => { this.#press(event, line.at, row.at); } }, line.line), line.line)))),
    ];
  }

  #drawFound(rows: readonly FoundRow[], words: string, loading: "first" | "earlier" | undefined, failed: boolean): void {
    const say = this.ports.say;
    if (loading === "first") { this.#refill( rowsShape(SHOWN)); return; }
    if (failed && rows.length === 0) { this.#refill( h("p", { class: "empty" }, say("history.unavailable"))); return; }
    if (rows.length === 0) { this.#refill( h("p", { class: "empty" }, say("history.nothingFound"))); return; }
    if (!this.#state.titled) {
      const hits = rows.flatMap((row) => row.matched.map((hit) => ({ line: hit, row: row.at }))).sort((a, b) => seqOf(b.line.at) - seqOf(a.line.at));
      this.#refill(
        loading === "earlier" && rowsShape(2),
        h("ul", { class: "history-messages alone" }, ...this.#lines(hits, true, (hit) => [
          cut(h("button", { type: "button", "data-key": `line:${hit.line.at}`, onclick: (event) => { this.#press(event, hit.line.at, hit.row); } }, ...this.#whose(hit.line.who), ...marked(hit.line.stretch, words)), hit.line.stretch)])));
      return;
    }
    // The days the row of the messages before the first title holds are the platform's to say: the list may not reach that far back.
    this.#refill(
      loading === "earlier" && rowsShape(2),
      h("ul", {}, ...this.#days([...rows].reverse(), true, (row) => {
        const title = row.title ?? say("history.first");
        return [
          row.title === null
            // Among a search's rows its found messages always show, so it has nothing to open: it is a name over them, not a control.
            ? h("p", { class: "history-row result untitled" }, ...this.#untitled(this.#daysOf(row.span), [title]))
            : cut(h("button", { type: "button", class: "history-row result", "data-key": `row:${row.at}`, "aria-expanded": row.matched.length > 0 ? "true" : "false", onclick: (event) => { this.#press(event, row.at, row.at); } }, ...marked(title, words)), title),
          row.matched.length > 0 && h("ul", { class: "history-messages" }, ...row.matched.map((hit) =>
            h("li", {}, cut(h("button", { type: "button", "data-key": `line:${hit.at}`, onclick: (event) => { this.#press(event, hit.at, row.at); } }, ...this.#whose(hit.who), ...marked(hit.stretch, words)), hit.stretch)))),
        ];
      })));
  }

  /** The list drawn again: a tip a row of it shows is closed first, as its row goes. */
  #refill(...rows: readonly Child[]): void {
    hideTipWithin(this.#list);
    fill(this.#list, ...rows);
  }

  /** A found line opens with whose words it holds, the person's or cx's, as `/search` says. */
  #whose(who: "seller" | "cx"): readonly Child[] {
    return [h("span", { class: "whose" }, this.ports.say(who === "cx" ? "history.whoCx" : "history.whoSeller")), " "];
  }

  /** The entry to the chat, drawn as the sidebar's Plugins entry is, current while the chat shows its latest message. */
  #chat(): HTMLElement {
    return h("a", { class: "entry", href: "#/", "data-key": "chat", "aria-current": this.ports.latest() ? "page" : undefined, onclick: () => { this.ports.toChat(); } },
      h("span", { class: "entry-name" }, this.ports.say("nav.chat")));
  }

  /** The row being read and its messages in view in the list: moved as little as it takes, its title at the top when they are taller. */
  #reveal(row: HTMLElement): void {
    if (this.#list.clientHeight === 0) return;
    const block = (row.closest("li") ?? row).getBoundingClientRect();
    const title = row.getBoundingClientRect();
    const room = this.#list.getBoundingClientRect();
    const pad = 8;
    if (title.top < room.top + pad) this.#list.scrollTop -= room.top + pad - title.top;
    else if (block.bottom > room.bottom - pad) this.#list.scrollTop += Math.min(block.bottom - (room.bottom - pad), title.top - (room.top + pad));
    this.#noteNewest();
  }
}

/** An answer of another life than the one asked of is no answer: the page and the platform no longer name the same conversation. */
const ofLife = (epoch: string) => <T extends { readonly epoch: string }>(part: T): T => { if (part.epoch !== epoch) throw new Error("another life"); return part; };

/** The person's messages the live view holds, as one word: it changes when one is sent or a part arrives, not as cx writes. */
const saidKeys = (live: StreamState): string => live.items.filter((item) => item.kind === "user" && !item.pending).map((item) => item.key).join(" ");

/** A line with the searched words marked where they stand, case aside, its spaces read as one as the platform reads them. */
export function marked(line: string, words: string): readonly Child[] {
  const needle = words.replace(/\s+/g, " ").toLowerCase();
  const at = needle === "" ? -1 : line.toLowerCase().indexOf(needle);
  return at < 0 ? [line] : [line.slice(0, at), h("mark", {}, line.slice(at, at + needle.length)), line.slice(at + needle.length)];
}

/** What a search found, counted in titles, the person's messages and cx's answers, each in its own number. */
export function foundWords(say: (key: StringKey, values?: Readonly<Record<string, string | number>>) => string, titles: number, messages: number, answers = 0): string {
  const counted = (count: number, one: StringKey, many: StringKey): string => (count === 1 ? say(one) : say(many, { count }));
  // Only what was found is counted: nothing is said of a kind that has none.
  const kinds = ([[titles, "history.titlesOne", "history.titles"], [messages, "history.messagesOne", "history.messages"], [answers, "history.answersOne", "history.answers"]] as const)
    .filter(([count]) => count > 0).map(([count, one, many]) => counted(count, one, many));
  return kinds.length === 3 ? say("history.foundThree", { first: kinds[0]!, second: kinds[1]!, third: kinds[2]! })
    : kinds.length === 2 ? say("history.foundTwo", { first: kinds[0]!, second: kinds[1]! })
    : say("history.foundOnly", { what: kinds[0] ?? "" });
}
