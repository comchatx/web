/** Where the column stands when a page asks for its board to be shown. */
export type DoorState = {
  /** Whether the column is open, and the board it shows. */
  readonly open: boolean;
  readonly shown: string | undefined;
  /** Whether the column, opened now, would stand beside the chat rather than over it. */
  readonly beside: boolean;
  /** Whether the message box holds no words. */
  readonly empty: boolean;
  /** Whether the keyboard is in the column. */
  readonly keyboard: boolean;
};

/**
 * What the board does with an ask: opens the column on the board, goes to it in the open column, waits for an empty message box, refuses
 * it — a door shut, the keyboard in the column, or the board shown an ask's unpressed — or nothing, for a name used or the board shown.
 */
export type DoorAnswer = "open" | "go" | "wait" | "refused" | "none";

/**
 * The door a page asks through for its board to be shown (`parts/board-page.md` §1; round 9, "The door, and what bounds it"), the same for a
 * page of ours and anyone's. The base gives the door; the page decides when, and the seller's own presses bound it:
 * - one name, once: a name a board was shown for opens nothing again, and an ask for the board shown does nothing;
 * - beside the chat it opens at once; where the column would lie over the chat it waits until the message box holds no words;
 * - with another board shown the column goes to the asking board, unless the keyboard is in the column or the board shown is one an ask
 *   showed that the seller has not pressed yet, so two pages cannot take the column from each other in turn;
 * - closed means no: a column an ask opened and the seller closed, or a board an ask showed and the seller left, with no press on it,
 *   shuts that board's door until the seller opens that board by their own press.
 * A seller who opens or shuts the column first lets a waiting opening go, as the board's own notice does.
 */
export class BoardDoor {
  /** The names each board was shown for. */
  readonly #told = new Map<string, Set<string>>();
  /** The boards whose door is shut. */
  readonly #shut = new Set<string>();
  /** The board an ask showed, until the seller presses on it. */
  #asked: string | undefined;
  /** The board whose opening waits for an empty message box. */
  #waits: string | undefined;

  /** A page's ask for its board, by the name of what changed. */
  ask(board: string, name: string, state: DoorState): DoorAnswer {
    const told = this.#told.get(board) ?? new Set<string>();
    this.#told.set(board, told);
    if (told.has(name)) return "none";
    told.add(name);
    if (state.open && state.shown === board) return "none";
    if (this.#shut.has(board) || (state.open && (state.keyboard || (this.#asked !== undefined && this.#asked === state.shown)))) return "refused";
    if (!state.open && !state.beside && !state.empty) { this.#waits = board; return "wait"; }
    this.#asked = board;
    this.#waits = undefined;
    return state.open ? "go" : "open";
  }

  /** The board an opening waits on, if any. */
  get waiting(): string | undefined { return this.#waits; }

  /** The message box or the window changed: the board to open now, where an opening waited and has its room or an empty box. */
  typed(state: Pick<DoorState, "open" | "beside" | "empty">): string | undefined {
    const board = this.#waits;
    if (board === undefined || state.open || !(state.beside || state.empty)) return undefined;
    this.#waits = undefined;
    if (this.#shut.has(board)) return undefined;
    this.#asked = board;
    return board;
  }

  /** A press on the board shown, or the keyboard going into its page: the seller took what the ask showed. */
  pressed(board: string): void { if (this.#asked === board) this.#asked = undefined; }

  /** The seller showed a board by their own press: a board an ask showed and left unpressed shuts its door; the one shown has its door back. */
  chose(board: string): void {
    if (this.#asked !== undefined && this.#asked !== board) this.#shut.add(this.#asked);
    this.#asked = undefined;
    this.#shut.delete(board);
  }

  /** The seller opened the column, on the board shown: its door is given back, and an opening still waiting is let go. */
  opened(board: string | undefined): void {
    this.#waits = undefined;
    if (board !== undefined) { this.#shut.delete(board); if (this.#asked === board) this.#asked = undefined; }
  }

  /** The seller closed the column: a board an ask showed and left unpressed shuts its door, and an opening still waiting is let go. */
  closed(): void {
    this.#waits = undefined;
    if (this.#asked !== undefined) this.#shut.add(this.#asked);
    this.#asked = undefined;
  }

  /** Whether a board's door is shut. */
  shut(board: string): boolean { return this.#shut.has(board); }
}
