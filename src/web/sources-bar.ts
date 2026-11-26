import { formatTotal, type Source } from "./backend.js";
import type { Money } from "../shared/money.js";
import type { CxMotion, CxScene } from "./cx.js";
import { h, svg } from "./dom.js";
import { hideTipWithin, redrawTip, tip } from "./forms.js";
import { faceAt, SourcesBarModel, type Hold } from "./sources-bar-model.js";
import type { Say } from "./stream-view.js";

export type SourcesBarPorts = {
  readonly say: Say;
  readonly motion: CxMotion;
  /** Platform units in the page's money. */
  readonly money: (units: number) => string;
  /** A month's total, as every month total on the page is drawn: two places. A purchase keeps the money's own precision. */
  readonly total?: (units: number) => string;
  readonly href: (source: string) => string;
  /** A source's name as the Plugins page writes it, where the catalogue has a plugin for it; else its supplier's name is written. */
  readonly name?: (source: string) => string | undefined;
  readonly scene: () => CxScene;
  readonly reduced: () => boolean;
  /** What cx does for the rows changed on its own clock: the page draws cx again. */
  readonly changed: () => void;
};

/** The month figure a source row carries, as the app wires it into `total`: the page's two-place rule, less than a cent where it is not nothing. */
export const rowTotal = (say: Say, money: Money, language: string) => (units: number): string => formatTotal(units, money, language, (amount, owed) => say(owed ? "pl.lessThanOwed" : "pl.lessThan", { amount }));

// The sweep (ruled 2026-09-28): a hard edge with a 1 px line riding it over the middle half of the row, the foreground at 55 %; when a new
// source takes the row, the words behind the line glide the last 6 px into place on the way back.
const SWEEP = Object.freeze({ inset: "24%", width: 1, alpha: 0.55, glide: 6 });
// The receipt as it leaves its row, in px, turning into the one in cx's hand; the receipt is 27 of its own units wide.
const START_W = 18;
const SLIP_W = 27;

type Face = { readonly root: HTMLElement; readonly mark: HTMLElement; readonly name: HTMLElement; readonly month: HTMLElement };
type Place = { readonly item: HTMLLIElement; readonly link: HTMLAnchorElement; readonly base: Face; readonly over: Face; readonly hair: HTMLElement };

const face = (kind: "base" | "over"): Face => {
  const mark = h("span", { class: "mark", "aria-hidden": "true" });
  const name = h("span", { class: "name" });
  const month = h("span", { class: "month money" });
  return { root: h("span", { class: `face ${kind}`, ...(kind === "over" ? { "aria-hidden": "true" } : {}) }, mark, name, month), mark, name, month };
};
const initial = (supplier: string): string => [...supplier.trim()][0]?.toUpperCase() ?? "";
const mask = (element: HTMLElement, value: string): void => { element.style.maskImage = value; element.style.setProperty("-webkit-mask-image", value); };
const matrix = (m: DOMMatrixReadOnly): string => `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map((value) => value.toFixed(4)).join(" ")})`;

/**
 * The sidebar's source rows under the Plugins entry, their own element beside it — one element, one target, so a row lights and opens alone
 * — and the receipt that flies from a row to cx. Each row is a link to its source's page: its initial and name, and what was settled at
 * it this month. The rows and every purchase's moment are `SourcesBarModel`'s; this draws them.
 */
export class SourcesBar {
  readonly element = h("ul", { class: "rows" });
  /** Over the whole page, never a target: the receipt on its way to cx. */
  readonly flight = svg("svg", { class: "flight", "aria-hidden": "true", focusable: "false" });
  readonly #slip = svg("g");
  readonly #model: SourcesBarModel;
  readonly #places: Place[] = [];
  #sources: readonly Source[] = [];
  #frame = 0;
  #held = "";

  constructor(readonly ports: SourcesBarPorts) {
    this.#model = new SourcesBarModel(ports.motion);
    this.flight.append(this.#slip);
  }

  /** The rows on screen: in the page and drawn with a width. */
  get visible(): boolean { return this.element.isConnected && this.element.getBoundingClientRect().width > 0; }

  /** One `/sources` answer, applied in the order it was asked: the rows, their figures, and any purchase a figure's rise shows. */
  sources(sources: readonly Source[]): void {
    this.#sources = sources;
    this.#model.sources(sources, () => this.visible, performance.now());
    this.#paint();
  }

  /** The rows again, for the page's words or money changing. */
  draw(): void { if (!this.#model.active) this.#paint(); }

  /** What cx does for the rows now: watching a purchase, reaching for its receipt, or reading it. */
  hold(): Hold { return this.#model.hold(performance.now()); }

  #paint(): void {
    const now = performance.now();
    const rows = this.#model.rows(now);
    const playing = this.#model.playing(now);
    while (this.#places.length < rows.length) this.#places.push(this.#place());
    // The same elements from frame to frame, so a row the person has focused or points at keeps it.
    const items = this.#places.slice(0, rows.length).map((place) => place.item);
    if (items.length !== this.element.children.length || items.some((item, at) => this.element.children[at] !== item)) {
      // Who opens a float closes it: a row taken away takes its tip with it.
      for (const gone of [...this.element.children].filter((item) => !items.includes(item as HTMLLIElement))) hideTipWithin(gone);
      this.element.replaceChildren(...items);
    }
    let renamed = false;
    const say = this.ports.say;
    rows.forEach((name, at) => {
      const place = this.#places[at]!;
      const source = this.#sources.find((one) => one.name === name);
      const supplier = this.#named(name, source);
      const figure = this.#model.figure(name, now);
      const month = figure === undefined ? "" : (this.ports.total ?? this.ports.money)(figure.spent);
      place.link.href = this.ports.href(name);
      const label = month === "" ? supplier : say("nav.sourceMonth", { name: supplier, amount: month });
      if (place.link.getAttribute("aria-label") !== label) { place.link.setAttribute("aria-label", label); renamed = true; }
      place.base.mark.textContent = initial(supplier);
      place.base.name.textContent = supplier;
      place.base.month.textContent = month;
      const shown = playing !== undefined && playing.place === at ? playing : undefined;
      if (shown !== undefined) {
        const bought = this.#sources.find((one) => one.name === shown.purchase.source);
        place.over.mark.textContent = initial(this.#named(shown.purchase.source, bought));
        // The supplier's own figure where every settlement stated one; the money alone where not.
        place.over.name.textContent = shown.purchase.native === undefined ? "" : `+${shown.purchase.native.amount} ${shown.purchase.native.unit}`;
        place.over.month.textContent = this.ports.money(shown.purchase.units);
      }
      const face = shown === undefined ? { phase: "base" as const, u: 0 } : faceAt(shown.t, this.#model.times, this.ports.reduced());
      this.#sweep(place, face.phase, this.ports.motion.ease(face.u), face.phase === "out" && shown?.took !== undefined);
    });
    // A row's name or amount changed under its open tip: the tip reads its words again, on the change and not on every frame.
    if (renamed) redrawTip();
    this.#fly(playing);
    const hold = this.#model.hold(now);
    const key = `${String(hold.catching)}:${String(hold.receipt)}:${String(hold.busy)}`;
    if (key !== this.#held) { this.#held = key; this.ports.changed(); }
    cancelAnimationFrame(this.#frame);
    this.#frame = this.#model.active ? requestAnimationFrame(() => this.#paint()) : 0;
  }

  /** A source's name as its row writes it, for a page that names the same source elsewhere. */
  nameOf(name: string): string { return this.#named(name, this.#sources.find((one) => one.name === name)); }

  #named(name: string, source: Source | undefined): string { return this.ports.name?.(name) ?? source?.supplier ?? name; }

  #place(): Place {
    const base = face("base");
    const over = face("over");
    const hair = h("span", { class: "hair", "aria-hidden": "true" });
    const link: HTMLAnchorElement = tip(h("a", { class: "row" }, base.root, over.root, hair), () => [link.getAttribute("aria-label") ?? ""]);
    return { item: h("li", {}, link), link, base, over, hair };
  }

  /**
   * The edge between a row's two faces, from left to right: going in, the purchase's face shows behind it and the row's own ahead; going back,
   * the row's own returns the same way. Nothing adds a colour: the faces keep the row's ground, type and figures, and the line is the
   * foreground thinned.
   */
  #sweep(place: Place, phase: "base" | "in" | "over" | "out", u: number, glide: boolean): void {
    const { base, over, hair } = place;
    for (const one of [base.root, over.root]) { mask(one, ""); one.style.transform = ""; one.style.visibility = "visible"; }
    hair.style.opacity = "0";
    if (phase === "base") { over.root.style.visibility = "hidden"; return; }
    if (phase === "over") { base.root.style.visibility = "hidden"; return; }
    const [incoming, outgoing] = phase === "in" ? [over.root, base.root] : [base.root, over.root];
    const width = place.link.getBoundingClientRect().width || 240;
    const x = (u * width).toFixed(2);
    mask(incoming, `linear-gradient(90deg, #000 ${x}px, transparent ${x}px)`);
    mask(outgoing, `linear-gradient(90deg, transparent ${x}px, #000 ${x}px)`);
    if (glide) incoming.style.transform = `translateX(${(-(1 - u) * SWEEP.glide).toFixed(2)}px)`;
    hair.style.top = SWEEP.inset;
    hair.style.bottom = SWEEP.inset;
    hair.style.width = `${SWEEP.width}px`;
    hair.style.opacity = (Math.sin(Math.PI * u) * SWEEP.alpha).toFixed(3);
    hair.style.transform = `translateX(${(u * width - SWEEP.width / 2).toFixed(2)}px)`;
  }

  /**
   * The receipt: from the money on the row to cx's hand, on cx's own hop. Each frame it aims at the matrix cx draws its receipt under, so on
   * landing it lies exactly on cx's own, drawn the same way, and stays until cx's is shown; the next frame is cx's alone.
   */
  #fly(playing: ReturnType<SourcesBarModel["playing"]>): void {
    const hide = (): void => { this.flight.style.display = "none"; };
    if (playing === undefined || this.ports.reduced()) { hide(); return; }
    const motion = this.ports.motion;
    const times = this.#model.times;
    const scene = this.ports.scene();
    const raw = (playing.t - times.launch) / motion.hop.dur;
    const parked = raw >= 1 && playing.t < times.land + 2 * motion.blend && !scene.slipShown();
    const target = scene.slipMatrix();
    // It leaves from the purchase's money, or where a purchase shows none — one sum over several sources — from its amount, or its row.
    const over = this.#places[playing.place];
    const from = over === undefined ? undefined : [over.over.month, over.over.name, over.link].map((element) => element.getBoundingClientRect()).find((rect) => rect.width > 0);
    if (raw < 0 || (raw >= 1 && !parked) || target === null || from === undefined || from.width === 0) { hide(); return; }
    if (this.#slip.firstChild === null) this.#slip.append(scene.slip());
    this.flight.style.display = "block";
    if (raw >= 1) { this.#slip.setAttribute("transform", matrix(target)); return; }
    const mid = CxCharacter.SLIP_MID;
    const to = new DOMPoint(mid[0], mid[1]).matrixTransform(target);
    const start = [from.left + from.width / 2, from.top + from.height / 2] as const;
    const scale = [START_W / SLIP_W, Math.hypot(target.a, target.b)] as const;
    const turn = (Math.atan2(target.b, target.a) * 180) / Math.PI;
    const rise = Math.min(motion.hop.riseMax, motion.hop.rise + Math.hypot(to.x - start[0], to.y - start[1]) * motion.hop.perPx);
    const e = motion.ease(raw);
    const x = start[0] + (to.x - start[0]) * e;
    const y = start[1] + (to.y - start[1]) * e - rise * Math.sin(Math.PI * raw);
    this.#slip.setAttribute("transform", matrix(new DOMMatrix().translate(x, y).rotate(turn * e).scale(scale[0] + (scale[1] - scale[0]) * e).translate(-mid[0], -mid[1])));
  }
}
