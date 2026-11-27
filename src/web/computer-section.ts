import { USAGE_SPANS, type Me, type Offered, type Size, type Usage, type UsageBar, type UsageSpan } from "./backend.js";
import { h, type Child } from "./dom.js";
import { dialog, select, tip } from "./forms.js";
import { localDay, type Writer } from "./settings-words.js";
import { styled } from "./spend-chart.js";
import type { Say } from "./stream-view.js";
import { block } from "./waiting.js";

type SignedIn = Extract<Me, { kind: "signed_in" }>;
/** Where the computer stands as the app has it: a size changes only while it is off. */
export type Power = "on" | "starting" | "closing" | "off";
type Metric = "cpu" | "memory" | "storage";
const METRICS: readonly (readonly [Metric, "cw.cpu" | "cw.memory" | "cw.storage"])[] = [["cpu", "cw.cpu"], ["memory", "cw.memory"], ["storage", "cw.storage"]];

export type ComputerPorts = {
  readonly backend: { readonly computerUsage: (span: UsageSpan) => Promise<Usage>; readonly resize: (size: Size) => Promise<{ readonly size: Size; readonly hourUnits: number }> };
  readonly say: Say;
  readonly me: () => SignedIn | undefined;
  readonly power: () => Power;
  readonly now: () => number;
  /** Draws the pane again, the keyboard back on the control `key` names. */
  readonly redraw: (key?: string) => void;
  /** Whether the window shows this section now. */
  readonly shown: () => boolean;
};

/** A reading's level as the computer window and the charts colour it. */
export const levelOf = (share: number | undefined): string | undefined => (share === undefined ? undefined : share >= 90 ? "failed" : share >= 80 ? "warned" : undefined);
/** A size in the page's words: its cores and its memory, as 1 核 1 GB. */
export const sizeName = (size: Size, say: Say): string =>
  say("cw.sizeOf", { cores: size.cpus === 1 ? say("cw.core1") : say("cw.cores", { n: String(size.cpus) }), memory: `${size.memoryMb / 1024} GB` });
const same = (a: Size, b: Size): boolean => a.cpus === b.cpus && a.memoryMb === b.memoryMb && a.kind === b.kind;

/**
 * Settings › cx's computer: what it has used over a span chosen, and, for a person's own, the size it starts at. Each span is read when
 * chosen and drawn as it answers; a size changes only while the computer is off and has started once.
 */
export class ComputerSection {
  #span: UsageSpan = "d7";
  #usage: Usage | "unread" | undefined;
  /** The size a change took, held over the account's reads until the section's next opening. */
  #held: { readonly size: Size; readonly hourUnits: number } | undefined;
  #saving = false;
  #refused = false;
  /** The platform answered that the computer has never started: held until the next opening. */
  #never = false;
  /** The platform refused a change because the computer is on: the row says so until the next opening. */
  #on = false;
  #done: string | undefined;
  constructor(readonly ports: ComputerPorts) {}

  begin(): void {
    this.#span = "d7";
    this.#usage = undefined;
    this.#held = undefined;
    this.#saving = false;
    this.#refused = false;
    this.#never = false;
    this.#on = false;
    this.#done = undefined;
  }
  read(): Promise<void> { return this.#read(this.#span); }
  async #read(span: UsageSpan): Promise<void> {
    const usage = await this.ports.backend.computerUsage(span).catch(() => "unread" as const);
    if (span !== this.#span) return;
    this.#usage = usage;
  }

  draw(w: Writer): readonly Child[] {
    const me = this.ports.me();
    if (me === undefined) return [];
    return [this.#loads(me, w), this.#rows(me, w)];
  }

  #loads(me: SignedIn, w: Writer): HTMLElement {
    const say = this.ports.say;
    const at = USAGE_SPANS.indexOf(this.#span);
    const span = select({ label: say("sw.spanName"), values: USAGE_SPANS.map((one) => say(`sw.span.${one}`)), held: at, start: true,
      take: (index) => { const next = USAGE_SPANS[index]!; if (next === this.#span) return; this.#span = next; this.#usage = undefined; if (this.ports.shown()) this.ports.redraw("span"); void this.#read(next).then(() => { if (this.ports.shown()) this.ports.redraw("span"); }); } });
    span.button.dataset["key"] = "span";
    const usage = this.#usage;
    const top = h("div", { class: "cz-load-top cz-load-top-left" }, h("span", { class: "cz-select" }, span.button, span.list), usage !== undefined && usage !== "unread" && usage.bars.length > 0 && h("span", { class: "sw-span-name cz-range" }, this.#range(usage, w)));
    const group = h("section", { class: "sw-group cz-loads cz-loads-first", "data-key": "loads" }, top);
    if (usage === "unread") group.append(h("div", { class: "sw-empty", role: "status" }, h("p", {}, say("sw.unread")), h("p", { class: "quiet" }, say("sw.retry"))));
    else if (usage !== undefined && usage.bars.every((bar) => METRICS.every(([metric]) => bar[metric] === undefined))) group.append(h("p", { class: "f-empty" }, say("cw.off")));
    else if (usage !== undefined) group.append(h("div", { class: "cz-load-grid cz-load-rows" }, ...METRICS.map(([metric, title]) => this.#chart(usage, metric, title, me, w))));
    // A span chosen and not yet answered draws the shape the section's first entry draws, not the last span's bars under the new name.
    else group.append(h("div", { class: "cz-load-grid", "data-key": "loads-reading" }, ...METRICS.map(() => block(h("div", { class: "cz-load f-card" })))));
    return group;
  }

  #range(usage: Usage, w: Writer): string {
    const step = usage.stepS * 1000;
    const from = usage.bars[0]!.at - step;
    const to = Math.min(this.ports.now(), usage.bars[usage.bars.length - 1]!.at);
    if (usage.stepS >= 86_400) return w.daysBetween(localDay(from), localDay(to));
    const when = (time: number): string => { const d = new Date(time); return w.at(localDay(time), d.getHours(), d.getMinutes()); };
    const clock = (time: number): string => { const d = new Date(time); return w.clock(d.getHours(), d.getMinutes()); };
    return w.between(when(from), localDay(from) === localDay(to) ? clock(to) : when(to));
  }

  /** A bar's span in words: its day, its minute, or the clock it starts at to the one it ends at. */
  #binName(bar: UsageBar, stepS: number, w: Writer): string {
    const from = bar.at - stepS * 1000;
    const when = (time: number): string => { const d = new Date(time); return w.at(localDay(time), d.getHours(), d.getMinutes()); };
    if (stepS >= 86_400) return w.dayName(localDay(from));
    if (stepS <= 60) return when(from);
    const end = new Date(bar.at);
    return w.between(when(from), w.clock(end.getHours(), end.getMinutes()));
  }

  #chart(usage: Usage, metric: Metric, titleKey: "cw.cpu" | "cw.memory" | "cw.storage", me: SignedIn, w: Writer): HTMLElement {
    const say = this.ports.say;
    const title = say(titleKey);
    const n = usage.bars.length;
    const now = this.ports.power() === "on" ? (metric === "cpu" ? me.parts?.cpu : metric === "memory" ? me.parts?.memory : me.parts?.storage) : undefined;
    // Storage is kept, and billed, while the computer is off: a step with no reading of it draws no bar and says no power.
    const values = usage.bars.map((bar) => bar[metric]);
    const off = metric === "storage" ? "" : say("cw.off");
    const bars = usage.bars.map((bar, at) => {
      const value = values[at];
      const name = this.#binName(bar, usage.stepS, w);
      const words = (): readonly Child[] => [h("p", {}, h("span", { class: "name" }, name), h("span", { class: "cz-read" }, value === undefined ? off : `${value}%`))];
      return tip(h("div", { class: ["sw-day", levelOf(value)].filter(Boolean).join(" "), role: "img", tabindex: at === n - 1 ? "0" : "-1", "data-at": String(at), "data-key": `${metric}:${at}`,
        "aria-label": value === undefined ? `${name}${off === "" ? "" : `${w.comma}${off}`}` : `${name}${w.comma}${say("cw.used", { name: title, n: String(value) })}` },
        value !== undefined && styled(h("span", { class: "sw-bar" }, h("i")), { height: `${value}%` })), words, { card: true, says: true, end: at + 1 > n / 2 });
    });
    const show = (bar: number | undefined): void => { for (const one of bars) one.classList.toggle("at", Number(one.dataset["at"]) === bar); };
    const atOf = (target: EventTarget | null): number | undefined => {
      const bar = (target as Element | null)?.closest?.<HTMLElement>("[data-at]");
      return bar === null || bar === undefined ? undefined : Number(bar.dataset["at"]);
    };
    const plot = h("div", { class: "sw-plot", role: "group", "aria-label": `${title}${w.comma}${say(`sw.span.${usage.span}`)}` },
      h("div", { class: "sw-gridlines", "aria-hidden": "true" }, h("i"), h("i"), h("i")), styled(h("div", { class: "sw-days" }, ...bars), { "grid-template-columns": `repeat(${n}, minmax(0, 1fr))` }));
    plot.addEventListener("mouseover", (event) => show(atOf(event.target)));
    plot.addEventListener("mouseleave", () => show(plot.contains(document.activeElement) ? atOf(document.activeElement) : undefined));
    plot.addEventListener("focusin", (event) => show(atOf(event.target)));
    plot.addEventListener("focusout", () => show(undefined));
    plot.addEventListener("keydown", (event) => {
      const bar = atOf(event.target);
      const to = bar === undefined ? undefined : ({ ArrowLeft: bar - 1, ArrowRight: bar + 1, Home: 0, End: n - 1 } as Readonly<Record<string, number>>)[event.key];
      if (to === undefined) return;
      event.preventDefault();
      const next = Math.min(n - 1, Math.max(0, to));
      for (const one of bars) one.tabIndex = Number(one.dataset["at"]) === next ? 0 : -1;
      bars[next]!.focus();
    });
    return h("section", { class: "cz-load f-card", "data-key": `load-${metric}`, "aria-labelledby": `cz-load-${metric}` },
      h("div", { class: "cz-load-head cz-load-left" }, h("h3", { id: `cz-load-${metric}` }, title), now !== undefined && h("span", { class: ["cz-load-now", levelOf(metric === "storage" ? undefined : now)].filter(Boolean).join(" ") }, `${now}%`)),
      h("div", { class: "sw-chart cz-chart" }, h("div", { class: "sw-yaxis", "aria-hidden": "true" }, h("span", {}, "0"), h("span", {}, "50%"), h("span", {}, "100%")), plot));
  }

  #rows(me: SignedIn, w: Writer): HTMLElement {
    const say = this.ports.say;
    const storage = me.parts?.storageGb;
    return h("section", { class: "sw-group" }, h("ul", { class: "sw-rows" },
      me.sizes !== undefined && this.#sizeRow(me, me.sizes, w),
      h("li", { class: "sw-row", id: "cz-row-disk", tabindex: "-1", "data-key": "storage-row" },
        h("div", { class: "sw-text" }, h("p", { class: "sw-label" }, say("cw.storage")), h("p", { class: "sw-help" }, say("cz.disk"))),
        h("div", { class: "sw-ctl" }, storage !== undefined && h("span", { class: "sw-value" }, `${storage} GB`)))));
  }

  #sizeRow(me: SignedIn, sizes: readonly Offered[], w: Writer): HTMLElement {
    const say = this.ports.say;
    const power = this.ports.power();
    const never = this.#never || me.box === "pending" || (power === "off" && me.machine === undefined);
    const held = this.#held?.size ?? me.size;
    const on = power !== "off" || this.#on;
    const shut = on || never || this.#saving;
    const hourly = (units: number): string => new Intl.NumberFormat("en", { style: "currency", currency: me.money.currency, minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(units / me.money.unitsPerMinor / 100);
    const price = (units: number): HTMLElement => h("span", { class: "cz-price" }, say("cw.rate", { price: hourly(units) }));
    const why = never ? say("cw.sizeNew") : on ? say("cw.sizeOn") : undefined;
    // The sizes are one radio set, as the sheet draws them: the one in force checked, none to be taken while a change is not.
    const card = (size: Offered): HTMLElement => {
      const name = sizeName(size, say);
      const inUse = held !== undefined && same(size, held);
      const radio = h("input", { type: "radio", name: "cz-size", "data-key": `size-${size.cpus}-${size.memoryMb}`, checked: inUse ? true : undefined, disabled: shut ? true : undefined,
        "aria-label": `${inUse ? name : say("cz.changeTo", { size: name })}${w.comma}${say("cw.rate", { price: hourly(size.hourUnits) })}`,
        onchange: (event: Event) => { if (!shut && held !== undefined && !inUse) this.#ask(event.currentTarget as HTMLElement, held, size, sizes, hourly); } }) as HTMLInputElement;
      return h("li", { class: inUse ? "cz-size cz-in-use" : "cz-size" }, h("label", { class: "cz-pick" }, radio, h("span", { class: "cz-name" }, name), price(size.hourUnits)));
    };
    const status = h("p", { class: "unseen", role: "status" });
    if (this.#done !== undefined) { const done = this.#done; this.#done = undefined; setTimeout(() => { status.textContent = done; }, 50); }
    return h("li", { class: "sw-row cz-row", id: "cz-row-size", tabindex: "-1", "data-key": "size-row" },
      h("div", { class: "sw-text" }, h("p", { class: "sw-label", id: "cz-size" }, say("cw.size")),
        this.#refused ? h("p", { class: "sw-said asks cz-refused", role: "status" }, say("sw.moveFailed")) : why !== undefined && h("p", { class: "sw-help quiet", id: "cz-why" }, why)),
      h("ul", { class: "cz-sizes cz-cards cz-picks", role: "radiogroup", "aria-labelledby": "cz-size", "aria-describedby": why === undefined ? undefined : "cz-why", "aria-busy": this.#saving ? "true" : undefined }, ...sizes.map(card)), status);
  }

  /** The step that asks before a change: what the computer is now and what it will be, focus on the way out. */
  #ask(from: HTMLElement, held: Size, to: Offered, sizes: readonly Offered[], hourly: (units: number) => string): void {
    const say = this.ports.say;
    const now = sizes.find((one) => same(one, held));
    const pair = (key: "cz.current" | "cz.new", size: Size, units: number | undefined): HTMLElement => h("div", { class: "cz-pair" }, h("dt", {}, say(key)),
      h("dd", {}, h("span", { class: "cz-name" }, sizeName(size, say))), h("dd", { class: "cz-price" }, units === undefined ? "" : say("cw.rate", { price: hourly(units) })));
    const no = h("button", { type: "button", class: "f-btn", "data-key": "step-no" }, say("sw.notNow"));
    const yes = h("button", { type: "button", class: "f-btn primary", "data-key": "step-yes" }, say("cz.yes"));
    const box = h("dialog", { class: "f-dialog cz-step", "aria-labelledby": "cz-step-ask", "aria-describedby": "cz-step-what" },
      h("h2", { id: "cz-step-ask" }, say("cz.ask")),
      h("dl", { class: "cz-change" }, pair("cz.current", held, now?.hourUnits), pair("cz.new", to, to.hourUnits)),
      h("p", { id: "cz-step-what" }, say("cz.what")), h("div", { class: "f-acts" }, no, yes)) as HTMLDialogElement;
    (from.closest(".sw") ?? document.body).append(box);
    // Left with no change, the set says the size in force again.
    box.addEventListener("close", () => {
      box.remove();
      const kept = from.closest(".cz-sizes")?.querySelector<HTMLInputElement>(`[data-key="size-${held.cpus}-${held.memoryMb}"]`);
      if (!this.#saving && kept !== null && kept !== undefined) kept.checked = true;
    });
    no.onclick = () => box.close();
    yes.onclick = () => {
      this.#saving = true;
      this.#refused = false;
      for (const button of [no, yes]) button.disabled = true;
      yes.setAttribute("aria-busy", "true");
      void this.ports.backend.resize(to).then((took) => {
        this.#held = took;
        this.#done = say("cz.done", { size: sizeName(took.size, say) });
      }, (error: unknown) => {
        const word = error instanceof Error ? error.message : "";
        if (word === "no_machine") this.#never = true;
        else if (word === "not_off") this.#on = true;
        else this.#refused = true;
      }).finally(() => {
        this.#saving = false;
        box.close();
        if (this.ports.shown()) this.ports.redraw("size-row");
      });
    };
    dialog(box, no)(from);
  }

  /** Brings a row into view and gives it the keyboard: 配置 for the processor's and the memory's way in, 存储 for the storage's. */
  land(pane: ParentNode, at: "size" | "storage"): void {
    const row = pane.querySelector<HTMLElement>(at === "size" ? "#cz-row-size" : "#cz-row-disk") ?? pane.querySelector<HTMLElement>("#cz-row-disk");
    row?.scrollIntoView({ block: "nearest" });
    row?.focus({ preventScroll: true });
  }
}
