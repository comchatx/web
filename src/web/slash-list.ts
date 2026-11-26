import { RELOAD_COMMAND } from "../shared/reload-command.js";
import { fill, h } from "./dom.js";
import type { StringKey } from "./strings.js";

type Say = (key: StringKey) => string;

/** The commands pi lists that are the platform's own: the list leaves them out by name. */
export const PLATFORM_COMMANDS: readonly string[] = Object.freeze([RELOAD_COMMAND]);

/** A command as pi's `get_commands` names it: its description is pi's, written for the model, and `source` is the package's as listed. */
export type Command = { readonly name: string; readonly description?: string; readonly source?: string };
/** A line of the list: the name a pick writes, and the words shown for it with their language where it is not the page's. */
export type Line = { readonly name: string; readonly about?: string; readonly lang?: string };

export type SlashListPorts = {
  readonly say: Say;
  /** The message box: it keeps the focus while the list is open and points at the shaded line. */
  readonly draft: HTMLTextAreaElement;
  /** cx's computer runs: only then is `get_commands` asked, and nothing is woken for it. */
  readonly awake: () => boolean;
  /** pi's answer to `get_commands`. */
  readonly commands: () => Promise<unknown>;
  /** The line shown for a command, in the page's language as it is drawn. */
  readonly line: (command: Command) => Line;
  /** While cx's computer sleeps: the Plugins page's list, read from what the platform records, waking nothing. */
  readonly asleep: () => Promise<readonly Command[]>;
  /** The box's words changed by a pick. */
  readonly picked: () => void;
};

/** The commands in pi's answer to `get_commands`, in pi's order, less the platform's own; an answer that cannot be read lists none. */
export function readCommands(answer: unknown): readonly Command[] {
  const data = typeof answer === "object" && answer !== null ? (answer as { readonly data?: { readonly commands?: unknown } }).data : undefined;
  const commands = Array.isArray(data?.commands) ? (data.commands as readonly unknown[]) : [];
  return commands.flatMap((one) => {
    if (typeof one !== "object" || one === null) return [];
    const { name, description, sourceInfo } = one as { readonly name?: unknown; readonly description?: unknown; readonly sourceInfo?: { readonly source?: unknown } };
    if (typeof name !== "string" || name === "" || PLATFORM_COMMANDS.includes(name)) return [];
    const source = typeof sourceInfo === "object" && sourceInfo !== null ? sourceInfo.source : undefined;
    return [{ name, ...(typeof description === "string" && description.trim() !== "" ? { description: description.trim() } : {}), ...(typeof source === "string" && source !== "" ? { source } : {}) }];
  });
}

/** How well typed letters fit a name, lower is better: its start, a stretch inside it, or its letters in order; undefined when they do not. */
export function fit(typed: string, name: string): number | undefined {
  const t = typed.toLowerCase();
  const n = name.toLowerCase();
  if (n.startsWith(t)) return 1;
  const at = n.indexOf(t);
  if (at >= 0) return 2 + at / (n.length + 1);
  let next = 0;
  for (const letter of n) if (letter === t[next]) next += 1;
  return next === t.length ? 3 : undefined;
}

/** The lines narrowed by what is typed, best fit first and otherwise in the list's order. `skill:` narrows only typed from the start. */
export function narrowed<T extends { readonly name: string }>(typed: string, lines: readonly T[]): readonly T[] {
  return lines
    .map((line, at) => ({ line, at, score: line.name.toLowerCase().startsWith(typed.toLowerCase()) ? 1 : fit(typed, line.name.replace(/^skill:/, "")) }))
    .filter((one): one is { line: T; at: number; score: number } => one.score !== undefined)
    .sort((a, b) => a.score - b.score || a.at - b.at)
    .map((one) => one.line);
}

/** The name typed after a / that starts the box, up to the caret: the list is open only there, and only before a space. */
export function typedName(value: string, caret: number): string | undefined {
  const before = value.slice(0, caret).trimStart();
  return before.startsWith("/") && !/\s/.test(before) ? before.slice(1) : undefined;
}

/**
 * The / list over the message box: what cx can be asked by name, read once each time the list opens — pi's `get_commands` while cx's
 * computer runs, and while it sleeps the Plugins page's list, so typing / wakes nothing. The box keeps the focus; the arrows, Enter, Tab
 * and Escape are the list's while it is open.
 */
export class SlashList {
  readonly element = h("div", { class: "slash", id: "slash-list", role: "listbox", hidden: true });
  #typed: string | undefined;
  /** The box's words when Escape closed the list: it stays closed until they change. */
  #shut: string | undefined;
  #active = 0;
  #names: readonly Command[] | undefined;
  #asking = 0;
  #found: readonly Command[] = [];

  constructor(readonly ports: SlashListPorts) {
    const { draft } = ports;
    draft.setAttribute("aria-autocomplete", "list");
    draft.setAttribute("aria-controls", this.element.id);
    for (const name of ["click", "focus"]) draft.addEventListener(name, () => this.read());
    draft.addEventListener("keyup", (event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) this.read(); });
    draft.addEventListener("blur", () => this.close());
  }

  get open(): boolean { return !this.element.hidden; }

  /** Reads what is typed before the caret: a / name at the box's start opens the list, anything else closes it and forgets the answer. */
  read(): void {
    const { draft } = this.ports;
    const typed = document.activeElement === draft ? typedName(draft.value, draft.selectionStart ?? draft.value.length) : undefined;
    if (typed !== this.#typed) this.#active = 0;
    this.#typed = typed;
    if (this.#shut !== undefined && this.#shut !== draft.value) this.#shut = undefined;
    if (typed === undefined) { this.#names = undefined; this.#asking += 1; }
    else if (this.#names === undefined) this.#ask();
    this.#draw();
  }

  close(): void {
    if (this.#typed === undefined && this.#names === undefined) return;
    this.#typed = undefined;
    this.#names = undefined;
    this.#asking += 1;
    this.#draw();
  }

  /** A key in the box while the list is open: whether the list took it. */
  key(event: KeyboardEvent): boolean {
    if (!this.open || event.isComposing || event.keyCode === 229) return false;
    const rows = this.#found.length;
    if (event.key === "Escape") { event.preventDefault(); this.#shut = this.ports.draft.value; this.#draw(); return true; }
    if (rows > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      this.#active = (this.#active + (event.key === "ArrowDown" ? 1 : -1) + rows) % rows;
      this.#draw();
      return true;
    }
    if (rows > 0 && (event.key === "Tab" || (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.altKey)) && !event.shiftKey) { event.preventDefault(); this.#pick(this.#found[this.#active]!); return true; }
    return false;
  }

  /** cx's computer fell asleep or woke: an open list is asked again of what now answers it. */
  again(): void {
    if (this.#names === undefined) return;
    this.#names = undefined;
    if (this.#typed !== undefined) this.#ask();
    this.#draw();
  }

  #ask(): void {
    const asking = ++this.#asking;
    this.#names = [];
    const { ports } = this;
    const commands = ports.awake() ? ports.commands().then(readCommands) : ports.asleep();
    void commands.catch(() => [] as readonly Command[]).then((names) => {
      if (asking !== this.#asking) return;
      this.#names = names;
      this.#draw();
    });
  }

  /** A pick puts `/<name> ` where the typed name was, the caret after its space, and the list closes: what follows is the seller's. */
  #pick({ name }: Command): void {
    const { draft } = this.ports;
    const caret = draft.selectionStart ?? draft.value.length;
    const before = draft.value.slice(0, caret);
    const start = before.length - before.trimStart().length;
    const put = `/${name} `;
    draft.value = `${before.slice(0, start)}${put}${draft.value.slice(caret)}`;
    draft.focus({ preventScroll: true });
    draft.setSelectionRange(start + put.length, start + put.length);
    this.read();
    this.ports.picked();
  }

  #draw(): void {
    const { draft, say } = this.ports;
    const names = this.#names ?? [];
    const open = this.#typed !== undefined && this.#shut === undefined && names.length > 0;
    this.element.hidden = !open;
    this.element.setAttribute("aria-label", say("composer.skills"));
    this.#found = open ? narrowed(this.#typed!, names) : [];
    this.#active = Math.min(this.#active, Math.max(0, this.#found.length - 1));
    if (!open || this.#found.length === 0) {
      draft.removeAttribute("aria-activedescendant");
      fill(this.element, ...(open ? [h("p", { class: "slash-said" }, say("composer.noMatch"))] : []));
      return;
    }
    fill(this.element, ...this.#found.map((command, at) => {
      const line = this.ports.line(command);
      return h("div", {
        class: "slash-row", role: "option", id: `slash-option-${at}`, "aria-selected": String(at === this.#active),
        onmousemove: () => { if (this.#active !== at) { this.#active = at; this.#draw(); } },
        // The focus stays in the message box: a press on a line picks it.
        onmousedown: (event) => event.preventDefault(),
        onclick: () => this.#pick(command),
        // A name is pi's, not the page's language.
      }, h("span", { class: "slash-name", lang: "en", translate: "no" }, `/${line.name}`), line.about !== undefined && h("span", { class: "slash-about", ...(line.lang === undefined ? {} : { lang: line.lang }) }, line.about));
    }));
    draft.setAttribute("aria-activedescendant", `slash-option-${this.#active}`);
    this.element.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
  }
}
