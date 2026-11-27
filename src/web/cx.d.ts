/**
 * cx as `cx.js` declares it on the page — the analyst's character, five states and a greeting played once, mounted into a container at a size; with `scene: true`
 * at a desk with its computer, reading the scene's signals. The file is the character spike's own, kept here so the platform's build,
 * which copies `src/` alone, can carry it; the spikes load it from here. It stays a classic script, so the spikes open from `file://`:
 * the page imports it for the one global it sets, not for an export, since a `.js` file under this package is a module to the bundler
 * and the script exports nothing as one.
 */
export type CxBox = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
export type CxState = "sleeping" | "waking" | "ready" | "analysing" | "writing" | "greeting";
/** Why an open was refused, as the computer's screen draws it. */
export type CxReason = "balance" | "seats" | "unreachable" | "failed";
/** The computer's power light. */
export type CxDot = "ready" | "working" | "starting" | "asleep" | "heard" | "none";
/** What the scene reads besides the state: each a signal the page already has. */
export type CxSignals = {
  readonly reason: CxReason | undefined;
  readonly dot: CxDot;
  readonly lang: "en" | "zh";
  readonly typing: boolean;
  readonly reading: boolean;
  readonly receipt: boolean;
  readonly catching: false | "watch" | "reach";
  readonly thinking: boolean;
  readonly sleepy: boolean;
  readonly low: boolean;
  readonly heard: boolean;
  readonly draft: number;
  readonly text: number;
};
/** Beside what cx stands while it is away from its desk, in client px: the line's middle and start, the stream's view, and how far a scroll moved the line since cx was last placed. */
export type CxPoint = { readonly y: number; readonly start: number; readonly left: number; readonly top: number; readonly bottom: number; readonly shift?: number };
/** A box in client px. */
export type CxEdges = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
export type CxRect = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
/** What cx's hand points at: a key on the page, its own computer's screen, or its own middle. */
export type CxPointing = "key" | "screen" | "self";
export type CxScene = {
  update(signals: Partial<CxSignals>): void;
  /** A keystroke in the composer: the next hand strikes. */
  tap(): void;
  /** Sends cx beside the line, or home with `null`; whether cx is out. */
  away(point: CxPoint | null): boolean;
  /**
   * Sends cx to a place on the page, the box its body fills there in client px (which gives the size it is drawn at), or home with `null`;
   * it hops there in an arc and `then` runs once it has landed. While it stands at a place, `away` does not move it. Whether cx is out.
   */
  goTo(place: CxRect | null, then?: () => void): boolean;
  /**
   * cx's hand points at the key whose box `key` gives each frame, once cx has landed; `null` puts the resting arm back. Where its way to
   * the key lies over a box `clear` gives (a word, a press, a picture, the key's tooltip; in client px), the hand reaches less far, aimed.
   */
  point(key: (() => CxRect | null) | CxRect | null, how?: CxPointing, clear?: () => readonly CxEdges[]): void;
  /** How far below its line's middle cx's figure reaches out beside a line beginning at `start` in a view whose left edge is `left`, in client px. */
  reach(start: number, left: number): number;
  readonly targets: { readonly computer: SVGElement; readonly cx: SVGElement };
  readonly model: CxSignals;
  /** From the receipt's own units to client px: where cx holds its receipt, or would, so something drawn with `slip()` under it lies on cx's own. */
  slipMatrix(): DOMMatrix | null;
  /** Whether cx's receipt is drawn in its hand now. */
  slipShown(): boolean;
  /** The receipt as cx holds it, at cx's own line weight. */
  slip(): SVGGElement;
};
/** One motion vocabulary for cx and for what reaches it, in seconds; `hop` is the arc cx jumps along, and a bought file flies along. */
export type CxMotion = {
  readonly blend: number; readonly wipe: number; readonly hold: number; readonly read: number;
  readonly hop: { readonly dur: number; readonly rise: number; readonly perPx: number; readonly riseMax: number };
  ease(u: number): number;
};
export type CxOptions = { readonly size?: number; readonly state?: CxState; readonly motion?: "auto" | "still"; readonly stillAt?: number; readonly scene?: boolean; readonly lang?: "en" | "zh" };
export type CxHandle = { readonly element: SVGSVGElement; readonly state: CxState; readonly size: number; readonly scene: CxScene | undefined; set(state: CxState): void; resize(size: number): void; destroy(): void };
export type CxComponent = {
  readonly STATES: readonly CxState[];
  readonly REASONS: readonly CxReason[];
  readonly MARK_W: number;
  /** The body alone, its paper's two rings, in its own units from its middle: what a place `goTo` is given is the box of. */
  readonly BODY_BOX: CxBox;
  readonly BOX: CxBox;
  /** The scene's viewBox: the desk, its computer and cx at its seat. */
  readonly SCENE_BOX: CxBox;
  /** Every point the computer is drawn through, in scene units. */
  readonly COMPUTER_PTS: readonly (readonly [number, number])[];
  /** The two click targets in scene units; cx's ends where the computer's begins. */
  readonly TARGETS: { readonly computer: CxBox; readonly cx: CxBox };
  /** Which target a point in scene units falls on: the topmost that holds it, in the order the targets are drawn. */
  hit(x: number, y: number): "computer" | "cx" | undefined;
  readonly MOTION: CxMotion;
  /** The receipt's middle in its own units. */
  readonly SLIP_MID: readonly [number, number];
  mount(container: Element, options?: CxOptions): CxHandle;
};
declare global {
  const CxCharacter: CxComponent;
}
