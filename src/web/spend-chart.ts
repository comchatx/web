import { SPANS_CALENDAR, SPANS_NOW, type Day, type SpanId, type SpanSpending, type SpendKind, type Step } from "./backend.js";
import { h, svg } from "./dom.js";
import { menu, tip } from "./forms.js";
import type { Say } from "./stream-view.js";
import { addDays, daysFrom, parts, type Writer } from "./settings-words.js";

/** One bar of a span: the part of the calendar it holds, as the platform names a bar that spent, its name, its mark on the scale, and whether it is today. */
export type Bin = { readonly key: string; readonly name: string; readonly tick: string; readonly now: boolean };
/** A span as the chart draws it: its bars, how many of them have begun, its dates, and each bar's total as served. */
export type View = { readonly bins: readonly Bin[]; readonly through: number; readonly range: string; readonly totals: readonly number[] };
export type By = "total" | "plugin" | "kind";
/** A part of every bar: a line, a kind, the lines folded into 其他, or the total. `byBin` is what it spent in each bar. */
export type Series = {
  readonly cls: string; readonly name: string; readonly units: number; readonly byBin: readonly number[];
  readonly kind?: SpendKind | "other"; readonly line?: number;
  /** The lines 其他 folds, each with what it spent in each bar. */
  readonly rest?: readonly { readonly line: number; readonly units: number; readonly byBin: readonly number[] }[];
};

const STEP_MINUTES: Readonly<Record<Exclude<Step, "day" | "month">, number>> = { minute: 1, five_minutes: 5, hour: 60 };
/** How long each span that ends now runs, as the platform's span of that name does. */
const RUNS_MINUTES: Readonly<Partial<Record<SpanId, number>>> = { m15: 15, m30: 30, h1: 60, h3: 180, h24: 24 * 60, h48: 48 * 60 };
const HOUR = 3_600_000;
const wall = (day: Day, clock = "00:00"): number => { const [y, m, d] = parts(day); return Date.UTC(y, m - 1, d, Number(clock.slice(0, 2)), Number(clock.slice(3, 5))); };
const clocks = new Map<string, Intl.DateTimeFormat>();
/** An instant as a zone's clock reads it, `YYYY-MM-DDTHH:MM`. */
export function wallOf(at: number, zone: string): string {
  const clock = clocks.get(zone) ?? new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  clocks.set(zone, clock);
  const part = Object.fromEntries(clock.formatToParts(at).map((one) => [one.type, one.value]));
  return `${part["year"]}-${part["month"]}-${part["day"]}T${part["hour"]}:${part["minute"]}`;
}
const offsetAt = (at: number, zone: string): number => { const read = wallOf(at, zone); return wall(read.slice(0, 10), read.slice(11, 16)) - Math.floor(at / 60_000) * 60_000; };
/** The instants a zone's clock reads a day and a minute at: none where the clock skips it, two where it goes back over it. */
function instantsOf(day: Day, clock: string, zone: string): readonly number[] {
  const read = wall(day, clock), text = `${day}T${clock}`;
  return [...new Set([offsetAt(read - 14 * HOUR, zone), offsetAt(read + 14 * HOUR, zone)].map((offset) => read - offset))].filter((at) => wallOf(at, zone) === text).sort((a, b) => a - b);
}
/** The first instant of the hour an instant falls in, as the zone's clock counts its hours. */
const hourOf = (at: number, zone: string): number => at - (((at + offsetAt(at, zone)) % HOUR) + HOUR) % HOUR;
/** The zone the browser's clock reads, which the window's reads are asked in. */
export const browserZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;
/**
 * A bar the platform served, by the part of the calendar it holds: under a day the instant it begins, which its stamp names with the
 * offset it was read at, so an hour the clock repeats is two bars; else its day, else its month.
 */
export const barKey = (at: string, step: Step): string => (step === "day" ? at.slice(0, 10) : step === "month" ? at.slice(0, 7) : String(Date.parse(at)));

/**
 * The bars of a span, from the days and minutes the platform answered with and the browser's own now: a bar for each minute, five
 * minutes, hour, day or month of the span, those still to come drawn empty, and on the scale the marks each span keeps.
 */
export function viewOf(answer: SpanSpending, now: number, say: Say, w: Writer): View {
  const { span, step, first_day: first, last_day: last } = answer;
  const zone = answer.zone ?? browserZone();
  const today = wallOf(now, zone).slice(0, 10);
  let bins: Bin[];
  let range: string;
  if (step === "minute" || step === "five_minutes" || step === "hour") {
    const size = STEP_MINUTES[step] * 60_000;
    const within = answer.from !== undefined && answer.to !== undefined;
    // The span's ends as the zone's clock reads them; where a clock goes back over one, the first pair as far apart as the span is long is
    // taken, so a short span wholly in the hour's second run is drawn from its first: the bars still land in their own bins.
    const firstAt = (day: Day): number => instantsOf(day, "00:00", zone)[0] ?? wall(day) - offsetAt(wall(day), zone);
    const [since, until] = ((): readonly [number, number] => {
      if (!within) return [firstAt(first), firstAt(addDays(last, 1)) - 1];
      const starts = instantsOf(first, answer.from!, zone), ends = instantsOf(last, answer.to!, zone), runs = (RUNS_MINUTES[span] ?? 0) * 60_000;
      const both = starts.flatMap((one) => ends.filter((end) => end - one === runs).map((end) => [one, end] as const))[0];
      return both ?? [starts[0] ?? wall(first, answer.from) - offsetAt(wall(first, answer.from), zone), ends.at(-1) ?? wall(last, answer.to) - offsetAt(wall(last, answer.to), zone)];
    })();
    const binOf = (at: number): number => (step === "hour" ? hourOf(at, zone) : Math.floor(at / size) * size);
    // Every bar served has its bin, whatever the span's ends read.
    const placed = answer.bars.map((bar) => Date.parse(bar.at)).filter((at) => Number.isFinite(at));
    const start = binOf(Math.min(since, ...placed)), end = binOf(Math.max(until, ...placed));
    const every = span === "m15" || span === "m30" ? 5 : span === "h1" ? 15 : span === "h3" ? 30 : span === "h48" ? 6 * 60 : 3 * 60;
    const crosses = span === "h24" || span === "h48";
    bins = [];
    for (let at = start; at <= end; at = binOf(at + size)) {
      const read = wallOf(at, zone), key = String(at), day = read.slice(0, 10), hour = Number(read.slice(11, 13)), minute = Number(read.slice(14, 16));
      const onClock = hour * 60 + minute;
      const name = step === "minute" ? w.at(day, hour, minute) : w.between(w.at(day, hour, minute), w.clock(Math.floor((onClock + size / 60_000) / 60), (onClock + size / 60_000) % 60));
      const [, m, d] = parts(day);
      const tick = onClock % every !== 0 ? "" : crosses && onClock === 0 ? `${m}/${d}` : w.clock(hour, minute);
      bins.push({ key, name, tick, now: false });
    }
    const from = (clock: string): [number, number] => [Number(clock.slice(0, 2)), Number(clock.slice(3, 5))];
    range = !within ? w.dayName(first)
      : first === last && !crosses ? w.between(w.at(first, ...from(answer.from!)), w.clock(...from(answer.to!)))
      : w.between(w.at(first, ...from(answer.from!)), w.at(last, ...from(answer.to!)));
  } else if (step === "day") {
    const n = daysFrom(first, last) + 1, at = daysFrom(first, today);
    const month = span === "month" || span === "lastMonth";
    const days = Array.from({ length: n }, (_, k) => addDays(first, k));
    const named = days.map((day, k) => !month && (k === 0 || parts(day)[2] === 1));
    bins = days.map((day, k) => {
      const [, m, d] = parts(day);
      const tick = k === at ? say("sw.today") : n === 7 ? (named[k] ? `${m}/${d}` : String(d)) : at >= 0 && Math.abs(k - at) <= 2 ? ""
        : month ? (k === 0 || ((k + 1) % 5 === 0 && k + 1 < n) || k + 1 === 30 ? String(k + 1) : "")
        : named[k] ? `${m}/${d}` : d % 5 === 0 && !named.slice(Math.max(0, k - 2), k + 3).includes(true) ? String(d) : "";
      return { key: day, name: w.dayName(day), tick, now: k === at };
    });
    range = month ? w.monthName(...(parts(first).slice(0, 2) as [number, number])) : w.daysBetween(first, last);
  } else {
    const months: { key: string; from: Day; to: Day }[] = [];
    for (let [y, m] = parts(first); `${y}-${String(m).padStart(2, "0")}` <= last.slice(0, 7); m === 12 ? (y += 1, m = 1) : (m += 1)) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const whole = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1);
      months.push({ key, from: `${key}-01` < first ? first : `${key}-01`, to: whole > last ? last : whole });
    }
    const crossYear = months[0]!.key.slice(0, 4) !== months.at(-1)!.key.slice(0, 4);
    const january = months.map((one) => crossYear && one.key.endsWith("-01"));
    bins = months.map((one, k) => {
      const [y, m] = parts(`${one.key}-01`);
      const whole = one.from.endsWith("-01") && one.to === addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1);
      const current = one.key === today.slice(0, 7);
      const tick = january[k] ? w.yearName(y) : months.length > 12 && (k % 2 === 1 || january.slice(Math.max(0, k - 2), k + 3).includes(true)) ? "" : w.monthShort(m);
      return { key: one.key, name: whole || current ? w.monthName(y, m) : w.daysBetween(one.from, one.to), tick, now: false };
    });
    range = span === "year" || span === "lastYear" ? w.yearName(parts(first)[0]) : w.daysBetween(first, last);
  }
  const begun = (key: string): boolean => (step === "day" ? key <= today : step === "month" ? key <= today.slice(0, 7) : Number(key) <= now);
  const through = bins.filter((bin) => begun(bin.key)).length;
  const served = new Map(answer.bars.map((bar) => [barKey(bar.at, step), bar.total]));
  return { bins, through, range, totals: bins.map((bin) => served.get(bin.key) ?? 0) };
}

/**
 * The parts each bar is drawn in. By plugin, each line the platform names apart is one, the strongest at the foot, and the lines it
 * folds are one more, 其他; by type, the kinds, the most first; by total, the bar alone.
 */
export function seriesOf(answer: SpanSpending, view: View, by: By, lineName: (line: number) => string, say: Say): readonly Series[] {
  const keys = view.bins.map((bin) => bin.key);
  const bars = new Map(answer.bars.map((bar) => [barKey(bar.at, answer.step), bar]));
  const each = (part: (bar: SpanSpending["bars"][number]) => number): number[] => keys.map((key) => { const bar = bars.get(key); return bar === undefined ? 0 : part(bar); });
  if (by === "total") return [{ cls: "s0", name: say("sw.total"), units: answer.total, byBin: view.totals }];
  if (by === "kind") {
    return (["model", "source", "box_time", "box_storage"] as const).map((kind) => ({ kind, name: say(kind === "box_time" ? "sw.computer" : kind === "box_storage" ? "sw.computerDisk" : `sw.class.${kind}`), units: answer.kinds[kind], byBin: each((bar) => bar.kinds[kind]) }))
      .filter((one) => one.units > 0).sort((a, b) => b.units - a.units).map((one, at) => ({ ...one, cls: `s${at + 1}` }));
  }
  const of = (line: number): number[] => each((bar) => bar.lines.filter((part) => part.line === line).reduce((sum, part) => sum + part.units, 0));
  const folds = answer.other?.from ?? answer.lines.length;
  const own: Series[] = answer.lines.slice(0, folds).map((line, at) => ({ cls: `s${at + 1}`, name: lineName(at), units: line.units, kind: line.kind, line: at, byBin: of(at) }));
  if (answer.other === undefined) return own;
  const rest = answer.lines.slice(folds).map((line, at) => ({ line: folds + at, units: line.units, byBin: of(folds + at) }));
  return [...own, { cls: `s${own.length + 1}`, name: say("sw.other"), units: answer.other.units, kind: "other", byBin: keys.map((_, bin) => rest.reduce((sum, line) => sum + line.byBin[bin]!, 0)), rest }];
}

/** The scale's step: the first of these that twice over holds the tallest bar, so the scale reads 0, the step and twice it. */
const STEPS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75].flatMap((one) => [one, one * 10, one * 100, one * 1000, one * 10000, one * 100000]).sort((a, b) => a - b);
export const scaleOf = (tallest: number, unitsPerMinor: number): number => {
  const steps = STEPS.map((dollars) => Math.round(dollars * 100) * unitsPerMinor);
  return steps.find((one) => one * 2 >= tallest) ?? steps.at(-1)!;
};
/** A bar's parts that a tip names, with a shared part's own lines under it where the tip holds them all. */
const HOLDS = 10;

export type ChartPorts = { readonly say: Say; readonly w: Writer; readonly unitsPerMinor: number; readonly step: Step };

/** A bar for each of the span's minutes, hours, days or months, those still to come drawn empty. Each bar is named by its time, and its figures hang under the scale. */
export function drawChart(view: View, series: readonly Series[], by: By, ports: ChartPorts, restName: (line: number) => string): HTMLElement {
  const { say, w } = ports;
  const n = view.bins.length;
  const step = scaleOf(Math.max(0, ...view.totals), ports.unitsPerMinor);
  const chart = h("div", { class: "sw-chart" });
  const columns = { "grid-template-columns": `repeat(${n}, minmax(0, 1fr))` };
  const amount = (units: number): HTMLElement => h("span", { class: "money" }, w.money(units));
  const partsOn = (at: number): { readonly one: Series; under: readonly { readonly line: number; readonly units: number }[] }[] => {
    const parts = by === "total" ? [] : series.filter((one) => one.byBin[at]! > 0).map((one) => ({ one, under: (one.rest ?? []).filter((line) => line.byBin[at]! > 0).map((line) => ({ line: line.line, units: line.byBin[at]! })) }));
    if (parts.reduce((sum, part) => sum + 1 + part.under.length, 0) > HOLDS) for (const part of parts) part.under = [];
    return parts;
  };
  const zh = w.comma === "，";
  const label = (at: number): string => {
    const bin = view.bins[at]!;
    const parts = partsOn(at).map(({ one, under }) => `${one.name} ${w.money(one.byBin[at]!)}${under.length > 0 ? `${zh ? "（" : " ("}${under.map((line) => `${restName(line.line)} ${w.money(line.units)}`).join(w.comma)}${zh ? "）" : ")"}` : ""}`);
    return `${bin.now ? `${say("sw.today")}${w.comma}` : ""}${bin.name}${w.comma}${by === "total" ? "" : `${say("sw.total")} `}${w.money(view.totals[at]!)}${parts.length > 0 ? `${zh ? "；" : "; "}${parts.join(w.comma)}` : ""}`;
  };
  // A bar's reading is said nowhere else: a card under its column, which a tap shows too and the pointer may rest on.
  const reading = (at: number) => (): readonly HTMLElement[] => {
    const parts = partsOn(at);
    return [
      h("p", { class: "sw-read" }, h("span", { class: "name when" }, view.bins[at]!.name), parts.length === 0 && amount(view.totals[at]!)),
      ...parts.flatMap(({ one, under }) => [
        h("p", { class: "sw-read" }, h("span", { class: `sw-swatch ${one.cls}` }), h("span", { class: "name" }, one.name), amount(one.byBin[at]!)),
        ...under.map((line) => h("p", { class: "sw-read" }, h("span", { class: "sw-swatch" }), h("bdi", { class: "name" }, restName(line.line)), amount(line.units)))]),
      ...(parts.length > 0 ? [h("p", { class: "sw-read sum" }, h("span", { class: "name" }, say("sw.total")), amount(view.totals[at]!))] : []),
    ];
  };
  const bars = view.bins.map((_, at) => {
    const sum = view.totals[at]!;
    if (at >= view.through) return h("div", { class: "sw-day", "aria-hidden": "true" });
    return tip(h("div", { class: "sw-day", role: "img", tabindex: at + 1 === view.through ? "0" : "-1", "aria-label": label(at), "data-day": String(at + 1), "data-key": `day:${at + 1}` },
      sum > 0 && styled(h("span", { class: "sw-bar" }, ...series.filter((one) => one.byBin[at]! > 0).map((one) => styled(h("i", { class: one.cls }), { "flex-grow": String(one.byBin[at]) }))), { height: `${((sum / (step * 2)) * 100).toFixed(2)}%` })),
      reading(at), { card: true, says: true, at: "below" });
  });
  const show = (bar: number | undefined): void => { for (const one of bars) one.classList.toggle("at", Number(one.dataset["day"]) === bar); };
  const plot = h("div", { class: "sw-plot", role: "group", "aria-label": `${say(`sw.bins.${ports.step}`)}${w.comma}${view.range}` },
    h("div", { class: "sw-gridlines", "aria-hidden": "true" }, h("i"), h("i"), h("i")), styled(h("div", { class: "sw-days" }, ...bars), columns));
  const dayOf = (target: EventTarget | null): number | undefined => {
    const bar = (target as Element | null)?.closest?.<HTMLElement>("[data-day]");
    return bar === null || bar === undefined ? undefined : Number(bar.dataset["day"]);
  };
  plot.addEventListener("mouseover", (event) => { const bar = dayOf(event.target); if (bar !== undefined) show(bar); });
  plot.addEventListener("mouseleave", () => show(plot.contains(document.activeElement) ? dayOf(document.activeElement) : undefined));
  plot.addEventListener("focusin", (event) => { const bar = dayOf(event.target); if (bar !== undefined) show(bar); });
  plot.addEventListener("focusout", () => show(undefined));
  plot.addEventListener("keydown", (event) => {
    const bar = dayOf(event.target);
    const to = bar === undefined ? undefined : ({ ArrowLeft: bar - 1, ArrowRight: bar + 1, Home: 1, End: view.through } as Readonly<Record<string, number>>)[event.key];
    if (to === undefined) return;
    event.preventDefault();
    const next = Math.min(view.through, Math.max(1, to));
    for (const one of bars) if (one.dataset["day"] !== undefined) one.tabIndex = Number(one.dataset["day"]) === next ? 0 : -1;
    bars[next - 1]!.focus();
  });
  chart.append(
    h("div", { class: "sw-yaxis", "aria-hidden": "true" }, ...[0, 1, 2].map((k) => h("span", {}, w.money(step * k)))), plot,
    styled(h("div", { class: "sw-xaxis", "aria-hidden": "true" }, ...view.bins.map((bin) => h("span", { class: bin.now ? "now" : undefined }, bin.tick))), columns));
  return chart;
}

/** Sizes the page works out are set through the style object: the page's policy refuses a `style` attribute. */
export function styled<T extends HTMLElement>(element: T, properties: Readonly<Record<string, string>>): T {
  for (const [name, value] of Object.entries(properties)) element.style.setProperty(name, value);
  return element;
}

export const icon = (path: string, cls = "icon"): SVGElement => svg("svg", { class: cls, viewBox: "0 0 16 16", "aria-hidden": "true" }, svg("path", { d: path }));
export const CHEVRON = "M4 6l4 4 4-4";
export const TICK = "M3.5 8.5l3 3 6-7";
export const CROSS = "M4 4l8 8M12 4l-8 8";

/**
 * The span's menu, after OpenRouter's: the spans that end now, then the calendar's two by two. Its button is the span's words and a
 * chevron, its list the set's menu, long, so it scrolls inside itself, the held span ticked at its row's end; the keys follow the two columns the calendar's spans are printed in. Choosing a span closes it.
 */
export function spanMenu(held: SpanId, say: Say, comma: string, pick: (span: SpanId) => void): HTMLElement {
  const row = (key: SpanId): HTMLElement => h("button", { type: "button", class: "f-menu-row", role: "option", tabindex: "-1", id: `sw-span-${key}`, "aria-selected": String(key === held), "data-value": key, onclick: () => pick(key) },
    h("span", { class: "f-words" }, say(`sw.span.${key}`)), icon(TICK, "icon f-tick"));
  const list = h("div", { class: "f-menu f-list sw-spans", role: "listbox", "aria-label": say("sw.spanName") },
    ...SPANS_NOW.map(row), h("div", { class: "sw-span-grid", role: "group", "aria-label": say("sw.spanCalendar") }, ...SPANS_CALENDAR.map(row)));
  const name = say(`sw.span.${held}`);
  const opener = h("button", { type: "button", class: "f-select", "aria-label": `${name}${comma}${say("sw.spanName")}`, "data-key": "span" }, h("span", { class: "sw-menu-words" }, name), icon(CHEVRON));
  // The list stands beside its button, so a pane drawn again takes it away with the button.
  menu(opener, list, { end: true, columns: 2 });
  return h("span", { class: "sw-span-menu" }, opener, list);
}
