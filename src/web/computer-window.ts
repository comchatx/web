import { IDLE_MINUTES, type Awake, type Parts, type Size } from "./backend.js";
import type { CxDot, CxReason, CxState } from "./cx.js";
import { MINUTE_MS, type Kind } from "./cx-scene.js";
import { fill, h, type Child } from "./dom.js";
import { bar, block, skeleton } from "./waiting.js";
import { CROSS, icon } from "./spend-chart.js";
import { choice, tip } from "./forms.js";
import { levelOf } from "./computer-section.js";
import type { StringKey } from "./strings.js";

type Say = (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;

/** What the window shows: the corner's kind, with a restart or a switch-off the page asked for and has not heard the end of. */
export type WindowKind = Kind | "restarting" | "closing";
/** What the window's band offers; help is a link. */
export type WindowAct = "on" | "off" | "restart" | "stopOff" | "stopRestart" | "retry" | "help";
const ACT_WORDS = { on: "cx.on", off: "cx.off", restart: "sw.restart", stopOff: "cx.stopOff", stopRestart: "sw.stopRestart", retry: "cx.retry", help: "menu.help" } as const satisfies Record<WindowAct, StringKey>;

export type WindowView = {
  readonly kind: WindowKind;
  /** How long until the computer switches itself off, as it last told the page; none where none is due. */
  readonly left: number | undefined;
  /** Something asked of the computer from a surface has not answered yet: nothing more is offered meanwhile. */
  readonly asking: boolean;
  /** 永不 and the idle minutes as the account holds them; none where they could not be read, which draws the time every account starts on. */
  readonly awake: Awake | undefined;
  /** The computer runs an image older than the platform's. */
  readonly newer: boolean;
  /** The price an hour, the month's figure and when the computer was switched on, each drawn as words; none where the platform said none. */
  readonly hour: string | undefined;
  readonly month: string | undefined;
  readonly since: string | undefined;
  readonly plugins: number | undefined;
  /** What the platform read of the parts; a figure it did not read is not drawn, and the storage's size unread leaves its name alone. */
  readonly parts: Parts | undefined;
  /** The size the computer starts at, as the account holds it; none where the account was not read. */
  readonly size?: Size | undefined;
  /** A larger size than `size` is offered; false on the largest and where none is offered, an organisation's computer. */
  readonly larger?: boolean | undefined;
  /** The parts are being read: a figure not held is drawn as the shape of its bar and its percentage until the read answers. */
  readonly reading?: boolean;
  /** The scene's drawing, for the picture of the computer. */
  readonly state: CxState;
  readonly dot: CxDot;
  readonly reason: CxReason | undefined;
  readonly lang: "en" | "zh";
};

export type WindowPorts = {
  readonly say: Say;
  readonly does: (act: Exclude<WindowAct, "help">) => void;
  /** Writes 永不 or a time for the account; rejects where it was not written down. */
  readonly setAwake: (on: boolean, minutes: number) => Promise<void>;
  readonly close: (back: boolean) => void;
  /** `size` and `storage` are 「cx 的电脑」 in Settings at the row a part's name leads to. */
  readonly links: { readonly usage: string; readonly plugins: string; readonly help: string; readonly size: string; readonly storage: string };
};

/** The kinds in which the computer runs, so its count, its restart and its switched-on time mean something. */
const RUNS: ReadonlySet<WindowKind> = new Set(["on", "working"]);
/** The kinds in which the computer is off and costs nothing, so its rate reads $0 (ruled 2026-11-13). */
const COSTS_NOTHING: ReadonlySet<WindowKind> = new Set(["off", "balance", "failed", "refused"]);
/** The kinds the window says nothing more of than its state: the page does not know the computer. */
const BARE: ReadonlySet<WindowKind> = new Set(["unknown", "unreachable", "unreachableAsleep"]);

/** What the band says the computer is doing, in the window's own words where the window has them. */
function stateWord(kind: WindowKind): StringKey {
  switch (kind) {
    case "on": return "cw.on";
    case "working": return "cx.computer.working";
    case "starting": return "cw.starting";
    case "restarting": return "sw.restarting";
    case "closing": return "cw.closing";
    case "failed": return "cx.say.failed";
    case "refused": return "cx.say.refused";
    case "unknown": case "unreachable": case "unreachableAsleep": return "status.reconnecting";
    case "off": case "balance": return "cw.off";
  }
}

/**
 * What can be pressed now. Under the floor the computer cannot be switched on, so the window says its state and nothing more. While it
 * switches off, 开机 stands where 关机 stood and takes no press until the computer is off (`heldActs`).
 */
export function windowActs(kind: WindowKind, asking: boolean): readonly WindowAct[] {
  if (kind === "closing") return ["on"];
  if (asking) return [];
  switch (kind) {
    case "on": return ["off", "restart"];
    case "working": return ["stopOff", "stopRestart"];
    case "off": return ["on"];
    case "failed": case "refused": return ["retry", "help"];
    default: return [];
  }
}

/** The presses drawn and not taken: 开机 while the computer switches off (ruled 2026-11-13, sheet 1's B). */
const heldActs = (kind: WindowKind): ReadonlySet<WindowAct> => new Set(kind === "closing" ? ["on"] : []);

/** A length of idle time in the language's own units: minutes under an hour, hours, or hours and minutes. */
export function span(minutes: number, say: Say): string {
  return minutes < 60 ? say("cw.min", { n: minutes }) : minutes % 60 === 0 ? say("cw.hr", { n: minutes / 60 }) : say("cw.hrMin", { h: Math.floor(minutes / 60), m: minutes % 60 });
}

/** Under the state while the computer is on and idle: when it switches off, as the computer last told the page, the last minute in its own words. */
export function countdown(kind: WindowKind, left: number | undefined, say: Say): string {
  if (kind !== "on" || left === undefined) return "";
  return left <= MINUTE_MS ? say("cw.offSoon") : say("cw.offIn", { t: span(Math.floor(left / MINUTE_MS), say) });
}

/** A typed time: whole minutes in the range a seller may type, else none. */
export function typedMinutes(raw: string): number | undefined {
  const words = raw.trim();
  const n = /^\d{1,3}$/.test(words) ? Number(words) : NaN;
  return n >= IDLE_MINUTES.least && n <= IDLE_MINUTES.most ? n : undefined;
}

type Choice = "never" | "custom" | number;

/**
 * The window of cx's computer: a title bar, rows as wide as the window — the three parts, 开机时间, the money row, 插件 and 自动关机 — and
 * at its foot, outside the rows' scroll, the band: the presses, the state, the picture. 自动关机 is one group of options: 永不 is keep awake, a time is the
 * account's idle minutes, 自定义 a time typed there. A choice is written at once and stands as chosen while it is written; one not
 * written goes back to the one in force and says so.
 */
export class ComputerWindow {
  readonly element = h("div", { class: "cw", id: "cw", role: "dialog", tabindex: "-1", "aria-labelledby": "cw-name", hidden: true });
  readonly #name = h("h2", { class: "cw-name", id: "cw-name" });
  readonly #close: HTMLButtonElement = tip(h("button", { type: "button", class: "sw-close", "data-key": "close", onclick: () => this.ports.close(true) }, icon(CROSS)), () => [this.#close.getAttribute("aria-label") ?? ""]);
  readonly #pic = h("div", { class: "cw-pic", "aria-hidden": "true", inert: true });
  readonly #state = h("p", { class: "cw-state", role: "status" });
  readonly #when = h("p", { class: "cw-when" });
  /** A computer kept on takes a new version only at a restart: said in the band under its state, beside 重启 (ruled 2026-11-13). */
  readonly #newer = h("p", { class: "cw-newer", role: "status", hidden: true });
  readonly #acts = h("div", { class: "cw-acts" });
  readonly #rows = h("ul", { class: "cw-main" });
  readonly #body = h("div", { class: "cw-body" }, this.#rows);
  /** The band is the window's foot, outside the rows' scroller: the presses at the left, nearest the icon that opened it, the picture at the right. */
  readonly #foot = h("div", { class: "cw-head cw-foot" }, h("div", { class: "cw-press" }, this.#acts, h("div", { class: "cw-say" }, this.#state, this.#when, this.#newer)), this.#pic);
  #picture: ReturnType<typeof CxCharacter.mount> | undefined;
  #view: WindowView | undefined;
  #offered: string | undefined;
  /** The option chosen while it is written, the time typed and refused, and a choice that was not written down. */
  #choosing: { readonly on: boolean; readonly minutes: number } | undefined;
  #custom = false;
  #typed: string | undefined;
  #failed = false;
  /** 自定义 was pressed, not reached by the arrows: the press goes on into its field. */
  /** What Enter last took from the field, so leaving it after does not take the same time again. */
  #committed: string | undefined;
  /** The field is being left with a time typed: the browser has taken its focus already and is moving it on. */
  #leaving = false;

  constructor(readonly ports: WindowPorts) {
    this.element.append(h("div", { class: "cw-bar" }, this.#name, this.#close), this.#body, this.#foot);
  }

  get opened(): boolean { return !this.element.hidden; }

  /** Opens with the focus on the window, as a dialog does; Tab walks its presses and its options from there. */
  open(): void {
    if (this.#view === undefined) return;
    this.element.hidden = false;
    this.#draw();
    this.element.focus({ preventScroll: true });
  }

  close(): void {
    if (this.element.hidden) return;
    this.element.hidden = true;
    // Shut, its status says nothing, so a screen reader is not left on a state that has moved on.
    this.#state.textContent = "";
    this.#newer.textContent = "";
    this.#custom = false;
    this.#typed = undefined;
    this.#failed = false;
    this.#picture?.destroy();
    this.#picture = undefined;
  }

  update(view: WindowView): void {
    this.#view = view;
    if (this.opened) this.#draw();
  }

  /** What the group shows: the choice being written, else the account's; ten minutes where nothing could be read, as every account starts. */
  #held(): { readonly on: boolean; readonly minutes: number } {
    const awake = this.#view?.awake;
    return this.#choosing ?? { on: awake?.on ?? awake?.waiting ?? false, minutes: awake?.minutes ?? IDLE_MINUTES.first };
  }

  #chosen(): Choice {
    const held = this.#held();
    if (held.on) return "never";
    return this.#custom || !(IDLE_MINUTES.offered as readonly number[]).includes(held.minutes) ? "custom" : held.minutes;
  }

  #draw(): void {
    const view = this.#view;
    if (view === undefined) return;
    const say = this.ports.say;
    this.#name.textContent = say("sw.computer");
    this.#close.setAttribute("aria-label", say("sw.closeSheet"));
    this.#state.textContent = say(stateWord(view.kind));
    this.#state.classList.toggle("bad", view.kind === "failed");
    const waits = this.#held().on && view.newer && RUNS.has(view.kind);
    this.#when.textContent = waits ? "" : countdown(view.kind, view.left, say);
    this.#when.hidden = waits;
    this.#newer.hidden = !waits;
    this.#newer.textContent = waits ? say("sw.newer") : "";
    this.#drawActs(view);
    this.#drawPicture(view);
    const focused = document.activeElement instanceof HTMLElement && this.#rows.contains(document.activeElement) ? document.activeElement.getAttribute("data-key") : null;
    // A drawing with no typed field drops what was typed in it and not entered, and with it the line about its range.
    if (BARE.has(view.kind) || this.#chosen() !== "custom") { this.#typed = undefined; this.#custom = false; }
    const rows = BARE.has(view.kind) ? [] : this.#rowsOf(view).filter((one): one is HTMLElement => one instanceof HTMLElement);
    // With no rows, the window is its title bar and its band.
    this.#body.hidden = rows.length === 0;
    // The typed field is the seller's until they leave it: a redraw keeps its row, its words and its caret, and changes only the line
    // under it and its marks.
    const kept = focused === "auto-typed" || this.#leaving ? this.#rows.querySelector<HTMLElement>(".cw-auto") : null;
    const fresh = rows.find((one) => one.classList.contains("cw-auto"));
    if (kept !== null && fresh?.querySelector(".cw-num") != null) {
      this.#patch(kept, fresh);
      // A row drawn the same stays the node it was, so a Tab leaving the field reaches the control the browser chose before the draw.
      const old = [...this.#rows.children];
      const next = rows.map((one) => (one === fresh ? kept : old.find((was) => was !== kept && was.isEqualNode(one)) ?? one));
      for (const was of old) if (!next.includes(was)) was.remove();
      next.forEach((one, at) => { if (this.#rows.children[at] !== one) this.#rows.insertBefore(one, this.#rows.children[at] ?? null); });
      return;
    }
    fill(this.#rows, ...rows);
    if (focused !== null) [...this.#rows.querySelectorAll<HTMLElement>("[data-key]")].find((one) => one.getAttribute("data-key") === focused)?.focus({ preventScroll: true });
  }

  /** The row of 自动关机 kept while its field is typed in, given the line under it and the marks a fresh drawing has. */
  #patch(kept: HTMLElement, fresh: HTMLElement): void {
    const field = kept.querySelector<HTMLInputElement>(".cw-num")!, drawn = fresh.querySelector<HTMLInputElement>(".cw-num")!;
    for (const name of ["aria-invalid", "aria-describedby"]) { const value = drawn.getAttribute(name); if (value === null) field.removeAttribute(name); else field.setAttribute(name, value); }
    const group = kept.querySelector(".f-seg")!, drawnGroup = fresh.querySelector(".f-seg")!;
    const described = drawnGroup.getAttribute("aria-describedby");
    if (described === null) group.removeAttribute("aria-describedby"); else group.setAttribute("aria-describedby", described);
    kept.querySelector("#cw-auto-help")?.remove();
    const help = fresh.querySelector("#cw-auto-help");
    if (help !== null) kept.append(help);
  }

  /** The presses are made again only when they change, so a change of words leaves the focus where it was. */
  #drawActs(view: WindowView): void {
    const acts = windowActs(view.kind, view.asking);
    const held = heldActs(view.kind);
    const offered = acts.map((act) => (held.has(act) ? `${act}:held` : act)).join();
    if (offered !== this.#offered) {
      const focused = document.activeElement instanceof HTMLElement && this.#acts.contains(document.activeElement) ? document.activeElement.getAttribute("data-act") : null;
      this.#offered = offered;
      fill(this.#acts, ...acts.map((act) => act === "help"
        ? h("a", { class: "f-btn", href: this.ports.links.help, "data-act": act, onclick: () => this.ports.close(true) })
        // A held press keeps its place and the focus, says it is not available now, and does nothing.
        : held.has(act) ? h("button", { type: "button", class: "f-btn primary", "data-act": act, "aria-disabled": "true" })
        : h("button", { type: "button", class: act === "on" ? "f-btn primary" : "f-btn", "data-act": act, onclick: () => this.ports.does(act) })));
      // The focus stays on a press drawn again in its place — 开机 taking its press once the computer is off — and else goes to the window.
      const again = focused === null ? null : this.#acts.querySelector<HTMLElement>(`[data-act="${focused}"]`);
      if (again !== null) again.focus({ preventScroll: true });
      else if (focused !== null) this.element.focus({ preventScroll: true });
    }
    // The address as words to copy beside Get help, as the account menu prints it: not every seller has a mail program that opens.
    const address = this.ports.links.help.replace(/^mailto:/, "");
    for (const one of this.#acts.querySelectorAll<HTMLElement>("[data-act]")) {
      const act = one.getAttribute("data-act") as WindowAct;
      const words = this.ports.say(ACT_WORDS[act]);
      if (act !== "help" || address === this.ports.links.help) { if (one.textContent !== words) one.textContent = words; }
      else if (one.textContent !== `${words} ${address}`) fill(one, `${words} `, h("span", { class: "quiet" }, address));
    }
  }

  /** The computer drawn as on the chat box, cx left out: the scene's own drawing, scaled so the computer's box fills the frame. */
  #drawPicture(view: WindowView): void {
    this.#picture ??= CxCharacter.mount(this.#pic, { size: 30, state: "ready", scene: true, motion: "still" });
    const state: CxState = RUNS.has(view.kind) ? "ready" : view.state;
    if (this.#picture.state !== state) this.#picture.set(state);
    this.#picture.scene?.update({ lang: view.lang, dot: view.dot, reason: view.reason, sleepy: view.kind === "on" && view.left !== undefined && view.left <= MINUTE_MS, text: RUNS.has(view.kind) ? 60 : 0 });
    this.fit();
  }

  /** Places the picture in its frame; called again once the window is laid out. */
  fit(): void {
    const drawing = this.#picture?.element;
    if (drawing === undefined || this.element.hidden) return;
    const box = CxCharacter.TARGETS.computer, view = drawing.viewBox.baseVal, frame = this.#pic.getBoundingClientRect();
    drawing.style.transform = "none";
    const whole = drawing.getBoundingClientRect();
    const k0 = whole.width / (view?.width || 1);
    if (!(k0 > 0) || frame.width === 0) return;
    const k = Math.min(frame.width / box.w, frame.height / box.h) * 0.94;
    drawing.style.clipPath = `inset(${(box.y - view.y) * k0}px ${whole.width - (box.x + box.w - view.x) * k0}px ${whole.height - (box.y + box.h - view.y) * k0}px ${(box.x + 6 - view.x) * k0}px)`;
    drawing.style.transform = `translate(${(frame.width - box.w * k) / 2 - (box.x - view.x) * k}px, ${(frame.height - box.h * k) / 2 - (box.y - view.y) * k}px) scale(${k / k0})`;
  }

  #rowsOf(view: WindowView): readonly Child[] {
    const say = this.ports.say;
    const runs = RUNS.has(view.kind), parts = view.parts;
    // A part read at 90% and over carries 「升级配置」 beside its figure where a larger size is offered: one at most, memory before the processor.
    const tight = (share: number | undefined): boolean => share !== undefined && levelOf(share) === "failed";
    const up = !runs || view.larger !== true ? undefined : tight(parts?.memory) ? "memory" : tight(parts?.cpu) ? "cpu" : undefined;
    const held = this.#held();
    const chosen = this.#chosen();
    const refused = this.#typed !== undefined;
    const help: readonly Child[] = [
      refused ? h("span", { role: "alert" }, say("cw.range", { least: IDLE_MINUTES.least, most: IDLE_MINUTES.most })) : undefined,
      this.#failed && !refused ? h("span", { role: "status" }, say("sw.moveFailed")) : undefined,
    ].filter((one) => one !== undefined).flatMap((one, at) => (at === 0 ? [one] : [" ", one]));
    // 自定义, once chosen, holds its typed time inside its pill, the unit after it; a press goes on into the field, the arrows pass by it.
    const values: readonly Choice[] = ["never", ...IDLE_MINUTES.offered, "custom"];
    const typing = chosen === "custom"
      ? h("input", { type: "text", class: "cw-num", inputmode: "numeric", maxlength: "3", "data-key": "auto-typed", "aria-label": say("cw.typed"), "aria-invalid": refused ? "true" : undefined, "aria-describedby": refused ? "cw-auto-help" : undefined,
          value: this.#typed ?? String(held.minutes),
          // Enter takes the time where it is typed; leaving the field takes it too, but not again what Enter took.
          onfocus: () => { this.#committed = undefined; },
          onchange: (event: Event) => {
            const raw = (event.target as HTMLInputElement).value;
            if (raw === this.#committed) return;
            // Until the focus has landed where the seller sent it, every draw keeps the rows it would move; then the window is drawn whole.
            this.#leaving = true;
            setTimeout(() => { this.#leaving = false; if (this.opened) this.#draw(); });
            // A field a redraw takes off the page fires its change while still attached, so the time is taken once that draw is done,
            // and only from a field still on the page: a field taken away commits nothing.
            const field = event.target as HTMLInputElement;
            queueMicrotask(() => { if (field.isConnected) this.#type(raw); });
          },
          onkeydown: (event: Event) => { if ((event as KeyboardEvent).key !== "Enter") return; event.preventDefault(); this.#committed = (event.target as HTMLInputElement).value; this.#type(this.#committed); },
          // Left with nothing new typed, the row is drawn whole again once the focus has landed.
          onblur: () => { setTimeout(() => { if (this.opened && !this.#leaving) this.#draw(); }); } }) : undefined;
    const auto = choice({ label: say("cw.auto"), held: values.indexOf(chosen),
      values: values.map((what) => ({ key: `auto-${what}`, name: what === "never" ? say("cw.never") : what === "custom" ? say("cw.custom") : span(what, say),
        ...(what === "custom" && typing !== undefined ? { shown: h("span", { "aria-hidden": "true" }, say("cw.unit")), field: typing } : {}) })),
      take: (index, by) => this.#pick(values[index]!, by === "press") });
    if (help.length > 0) auto.element.setAttribute("aria-describedby", "cw-auto-help");
    const link = (key: string, href: string, ...words: readonly Child[]): HTMLElement => h("a", { class: "cw-value f-link", href, "data-key": key, onclick: () => this.ports.close(false) }, h("span", {}, ...words, " ›"));
    return [
      // Each part's name and size, then how full it is as a bar and a figure: the processor and the memory only while the computer runs.
      h("li", { class: "cw-row cw-parts" }, this.#part("cw.cpu", view.size === undefined ? undefined : view.size.cpus === 1 ? say("cw.core1") : say("cw.cores", { n: String(view.size.cpus) }), runs ? parts?.cpu : undefined, runs && view.reading === true, "cpu", up === "cpu" ? view.lang : undefined),
        this.#part("cw.memory", view.size === undefined ? undefined : `${view.size.memoryMb / 1024} GB`, runs ? parts?.memory : undefined, runs && view.reading === true, "memory", up === "memory" ? view.lang : undefined),
        this.#part("cw.storage", parts?.storageGb === undefined ? undefined : `${parts.storageGb.toLocaleString("en-US")} GB`, parts?.storage, view.reading === true, "storage")),
      runs && view.since !== undefined && h("li", { class: "cw-row" }, h("span", { class: "cw-text" }, say("cw.since")), h("span", { class: "cw-value" }, view.since)),
      // The computer's money: its price an hour, and what it has cost this month as 用量 reads it. Unread, the way to 用量 stands alone.
      // Off, it costs nothing now, and says so; while it switches off or on, the price stands.
      h("li", { class: "cw-row" }, h("span", { class: "cw-text" }, ...(COSTS_NOTHING.has(view.kind) ? this.#around("cw.rate", "price", "$0") : view.hour === undefined ? [] : this.#around("cw.rate", "price", view.hour))),
        link("usage", this.ports.links.usage, ...(view.month === undefined ? [say("sw.sec.usage")] : this.#around("cw.month", "amount", view.month)))),
      // The whole row is the way to the Plugins page: one link, as large as what it names, read as one stop.
      h("li", { class: "cw-row" }, h("a", { class: "cw-row-link", href: this.ports.links.plugins, "data-key": "plugins", onclick: () => this.ports.close(false) },
        h("span", { class: "cw-text" }, say("nav.plugins")),
        h("span", { class: "cw-value" }, view.plugins === undefined ? "" : say("cw.installed", { n: view.plugins.toLocaleString("en-US") }), " ›"))),
      // What is set by hand stands last, directly above the band's presses.
      h("li", { class: "cw-row cw-auto" }, h("p", { class: "cw-text", id: "cw-auto" }, say("cw.auto")),
        auto.element,
        help.length > 0 && h("p", { class: refused || this.#failed ? "cw-help bad" : "cw-help", id: "cw-auto-help" }, ...help)),
    ];
  }

  /** A part as the platform read it, its name and figure a link to the row of Settings that holds it. */
  #part(key: StringKey, size: string | undefined, used: number | undefined, reading: boolean, go: "cpu" | "memory" | "storage", bigger?: "en" | "zh"): HTMLElement {
    const say = this.ports.say;
    const name = say(key);
    const reads = used === undefined ? (size === undefined ? name : `${name} ${size}`) : `${say("cw.used", { name, n: String(used) })}${size === undefined ? "" : ` (${size})`}`;
    // A figure not held while the read is out: its bar and its percentage are the shape, each in its own size, so nothing moves when it lands.
    const shape = used === undefined && reading ? skeleton(undefined, block(h("span", { class: "bar" })), h("span", { class: "cw-value" }, bar(12, "small"))) : undefined;
    const level = h("span");
    level.style.width = `${used ?? 0}%`;
    return h("a", { class: ["cw-part cz-go", levelOf(used)].filter(Boolean).join(" "), href: go === "storage" ? this.ports.links.storage : this.ports.links.size, "data-key": `part-${go}`,
      "aria-label": say("cz.partGo", { reading: bigger === undefined ? reads : `${reads}${bigger === "zh" ? "，" : ", "}${say("cw.bigger")}` }), onclick: () => this.ports.close(false) },
      h("span", { class: "cw-part-name" }, name, " ", h("span", { class: "cw-spec" }, ...(size === undefined ? [] : [size, " "]), "›"), bigger !== undefined && h("span", { class: "cz-up", "data-key": "bigger" }, say("cw.bigger"))),
      used !== undefined && h("span", { class: "bar", "aria-hidden": "true" }, level), used !== undefined && h("span", { class: "cw-value" }, `${used}%`), shape);
  }

  /** A sentence with its figure in money's colour, the words around it the language's own. */
  #around(key: StringKey, name: string, figure: string): readonly Child[] {
    const [before = "", after = ""] = this.ports.say(key, { [name]: "\u0000" }).split("\u0000");
    return [before, h("span", { class: "money" }, figure), after];
  }

  #pick(what: Choice, pressed: boolean): void {
    this.#typed = undefined;
    if (what === "custom") {
      // 自定义 holds the time in force until one is typed; a press goes on into its field, the arrows pass through it.
      this.#custom = true;
      this.#draw();
      if (pressed) { const field = this.#rows.querySelector<HTMLInputElement>(".cw-num"); field?.focus({ preventScroll: true }); field?.select(); }
      return;
    }
    this.#custom = false;
    const held = this.#held();
    void this.#write(what === "never" ? { on: true, minutes: held.minutes } : { on: false, minutes: what });
  }

  /** A typed time takes effect on Enter or on leaving the field; outside the range the time in force stays, and the line says the range. */
  #type(raw: string): void {
    const minutes = typedMinutes(raw);
    // A time left typed as the window closed is taken where it is one; words that are not one go with the window.
    if (minutes === undefined && !this.opened) return;
    if (minutes === undefined) { this.#typed = raw; this.#draw(); return; }
    this.#typed = undefined;
    void this.#write({ on: false, minutes });
  }

  async #write(choice: { readonly on: boolean; readonly minutes: number }): Promise<void> {
    this.#choosing = choice;
    this.#failed = false;
    this.#draw();
    const written = await this.ports.setAwake(choice.on, choice.minutes).then(() => true, () => false);
    if (this.#choosing !== choice) return;
    this.#choosing = undefined;
    this.#failed = !written;
    if (!written) this.#custom = false;
    if (this.opened) this.#draw();
  }
}
