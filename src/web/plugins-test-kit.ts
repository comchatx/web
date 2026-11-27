import type { Power } from "./plugins-queue.js";
import type { BundleState, Click, HeldBundle, NpmPackage, Package, PackageList, Written } from "./backend.js";
import { OURS } from "./canned-catalogue.js";

/** npm's read of a package of ours at a version, as the preview answers it: the one version's files the preview holds stand for any. */
export async function oursAt(name: string, version?: string): Promise<NpmPackage> {
  const one = OURS.find((pkg) => pkg.name === name);
  if (one === undefined) throw new Error("unknown_package");
  return { ...one, ...(version === undefined ? {} : { version }) };
}

/** The app's one region for a screen reader, on the document as the app keeps it: the page's `announce` port, writing there. */
export function appRegion(): (words: string) => void {
  const region = document.createElement("span");
  region.className = "unseen";
  region.setAttribute("role", "status");
  document.body.append(region);
  return (words) => { region.textContent = words; };
}

/** A list as an awake computer's platform answers it, with nothing waiting and nothing ended unless the test says so. */
export const listOf = (packages: readonly Package[], more: Partial<PackageList> = {}): PackageList => ({ packages, onImage: [], asleep: false, waiting: [], ends: [], ...more });

/**
 * The package half of a backend, for the page's tests: a click is answered with its entry and the row's waiting list as the write left
 * it, and, unless the test holds it, ended on the
 * list at once — done, with the list changed as the click asked, or failed with `fail`'s reason and pi's words in `detail`. `refuse` is a click refused before
 * anything is written down. An update takes the package to its version in `newest`. A bundle's press or its Remove is a click per source,
 * all refused or all written down, with the account's record of what the presses brought (`pressed`), as the platform's row keeps it.
 * The test moves `world.list` for anything else.
 */
export function clickStub(start: readonly Package[] = []) {
  let made = 0;
  const world: { list: PackageList; hold: boolean; refuse: string | undefined; fail: string | undefined; detail?: string; newest: Readonly<Record<string, string>>; readonly sent: Click[]; pressed: readonly HeldBundle[]; started?: string } = { list: listOf(start), hold: false, refuse: undefined, fail: undefined, newest: {}, sent: [], pressed: [] };
  const nothing = { en: "", zh: "" };
  const end = (click: Click): void => {
    const { op, source } = click;
    const ok = world.fail === undefined;
    const held = world.list.packages;
    const name = source.replace(/^npm:/, "").split("/").at(-1)!;
    const packages = !ok ? held : op === "remove" ? held.filter((one) => one.source !== source)
      : op === "update" ? held.map((one) => (one.source === source ? { ...one, version: world.newest[one.name] ?? one.version } : one))
      : op !== "install" ? held.map((one) => (one.source === source ? { ...one, enabled: op === "on" } : one))
      : held.some((one) => one.source === source) ? held : [...held, { name, version: "1.0.0", source, about: nothing, description: nothing }];
    world.list = {
      ...world.list, packages, waiting: (world.list.waiting ?? []).filter((one) => one.id !== click.id),
      ends: [{ op, source, ok, ...(world.fail === undefined ? {} : { reason: world.fail }), ...(world.detail === undefined ? {} : { detail: world.detail }), at: ++made }, ...(world.list.ends ?? []).filter((one) => one.source !== source)],
    };
  };
  const send = async (op: Click["op"], source: string): Promise<Written> => {
    if (world.refuse !== undefined) throw new Error(world.refuse);
    const click: Click = { id: (++made).toString(16).padStart(16, "0"), op, source };
    world.sent.push(click);
    world.list = { ...world.list, waiting: [...(world.list.waiting ?? []), click], ends: (world.list.ends ?? []).filter((one) => one.source !== source) };
    const waiting = world.list.waiting!;
    if (!world.hold) end(click);
    return { ...click, waiting };
  };
  // Whether the stub's computer sleeps is its list's word here, which the page hears as cx's card says it; a list the test makes unreadable
  // leaves the last word that could be read.
  let sleeps = false;
  return {
    world, end,
    power: (): Power => { try { sleeps = world.list.asleep; } catch { /* the last word stands */ } return sleeps ? "off" : "on"; },
    /** Ends every click still held, in the order sent. */
    release: (): void => { for (const click of world.list.waiting ?? []) end(click); },
    packages: async (): Promise<PackageList> => world.list,
    installPackage: (source: string, installed: boolean): Promise<Written> => send(installed ? "install" : "remove", source),
    setPackage: (source: string, enabled: boolean): Promise<Written> => send(enabled ? "on" : "off", source),
    updatePackage: (source: string): Promise<Written> => send("update", source),
    /** 取消 on a row that waits: taken back while it waits, `started` where the computer has begun the entry named by `world.started`, `gone` where nothing waits by that id. */
    cancelClick: async (id: string): Promise<"cancelled" | "started" | "gone"> => {
      if (world.started === id) return "started";
      if (!(world.list.waiting ?? []).some((one) => one.id === id)) return "gone";
      world.list = { ...world.list, waiting: (world.list.waiting ?? []).filter((one) => one.id !== id) };
      return "cancelled";
    },
    /** 取消 on a failed row: the list keeps the source's end no longer. */
    forgetFailure: async (source: string): Promise<void> => { world.list = { ...world.list, ends: (world.list.ends ?? []).filter((one) => one.ok || one.source !== source) }; },
    pressBundle: async (bundle: string, sources: readonly string[]): Promise<readonly Written[]> => {
      if (world.refuse !== undefined) throw new Error(world.refuse);
      const clicks: Written[] = [];
      for (const source of sources) clicks.push(await send("install", source));
      const had = world.pressed.find((one) => one.bundle === bundle)?.brought ?? [];
      world.pressed = [...world.pressed.filter((one) => one.bundle !== bundle), { bundle, at: made, brought: [...new Set([...had, ...sources.map((source) => source.replace(/^npm:/, ""))])] }];
      return clicks;
    },
    removeBundle: async (bundle: string, sources: readonly string[]): Promise<readonly Written[]> => {
      if (world.refuse !== undefined) throw new Error(world.refuse);
      const clicks: Written[] = [];
      for (const source of sources) clicks.push(await send("remove", source));
      world.pressed = world.pressed.filter((one) => one.bundle !== bundle);
      return clicks;
    },
    bundleState: async (): Promise<BundleState> => ({ held: world.pressed }),
  };
}

/**
 * A box that scrolls, put around a page: the test DOM lays nothing out, so a focus that does not forbid it moves the box to `shown`, as
 * a browser moves a list to bring into view a row that is out of sight. `end` gives every element its own focus back.
 */
export function scrollBox(page: HTMLElement, shown: number): { readonly box: HTMLElement; end(): void } {
  const box = document.createElement("main");
  let top = 0;
  Object.defineProperty(box, "scrollTop", { configurable: true, get: () => top, set: (to: number) => { top = to; } });
  box.scrollTo = ((to?: ScrollToOptions | number) => { top = typeof to === "number" ? to : to?.top ?? top; }) as typeof box.scrollTo;
  page.replaceWith(box);
  box.append(page);
  const own = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (this: HTMLElement, how?: FocusOptions): void {
    if (how?.preventScroll !== true && box.contains(this)) top = shown;
    own.call(this, how);
  };
  return { box, end: () => { HTMLElement.prototype.focus = own; } };
}

/**
 * Four presses on an open card, each down at one point and up at another: on its own padding, from the padding out to the dimmed page,
 * from the dimmed page in, and down and up on the dimmed page. Each reads whether the card still stands. happy-dom's modal does not lay
 * out, so the card is given a place first.
 */
export function scrimPresses(box: HTMLDialogElement): readonly boolean[] {
  Object.defineProperty(box, "getBoundingClientRect", { value: () => ({ left: 100, top: 100, right: 400, bottom: 300, width: 300, height: 200, x: 100, y: 100 }) });
  const press = (from: number, to: number): boolean => {
    box.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: from, clientY: from }));
    box.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: to, clientY: to }));
    return box.open && box.isConnected;
  };
  return [press(120, 120), press(120, 20), press(20, 120), press(20, 20)];
}
