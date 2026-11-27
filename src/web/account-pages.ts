import type { Appearance } from "./appearance.js";
import { firstLetter } from "./account-switch.js";
import type { Backend, Coupon, Device, Invitations } from "./backend.js";
import { h, svg, type Child } from "./dom.js";
import { choice, giveBack, menu, menuRow, switchButton, tip } from "./forms.js";
import { localDay } from "./settings-words.js";
import { keepRows, Waits } from "./waiting.js";
import { LANGUAGE_NAMES, type Language, type StringKey } from "./strings.js";
import type { Say } from "./stream-view.js";
import { confirmStep } from "./pay-step.js";
import type { Paying } from "./paying.js";
import type { Writer } from "./settings-words.js";
import { SITE_PAGES } from "./site-pages.js";
import { amount, around, termsLink, type UsageReads } from "./usage-page.js";

/**
 * Whether the account is offered the sheet: every account whose balance was read, since the sheet tells a member its link, an account
 * whose Pro ended the friends whose reward can still arrive, and any other what inviting earns. An unread balance tells none of them
 * apart: the sheet gives way to the page behind.
 */
export const inviting = (money: UsageReads["money"]): boolean => money !== undefined;

/** Whether the membership renews when its period ends: by card, or from a balance that holds the price. */
export const renewing = (reads: UsageReads | undefined): boolean => {
  const money = reads?.money;
  return reads?.subscription?.status === "active" || (money?.member?.switch === true && money.renewal.short === 0);
};

/** Browser notifications when an answer is ready: the person's choice, kept by this browser, and what the browser allows. */
export type ReadyPort = {
  readonly on: () => boolean; readonly set: (on: boolean) => void;
  readonly permission: () => NotificationPermission | "unsupported"; readonly ask: () => Promise<NotificationPermission>;
};

export type AccountPorts = {
  readonly backend: Backend; readonly say: Say; readonly language: () => Language; readonly setLanguage: (language: Language) => void;
  /** This browser's display preference, kept by the page's appearance script, not the platform. */
  readonly appearance: () => Appearance; readonly setAppearance: (appearance: Appearance) => void;
  readonly ready: ReadyPort;
  readonly email: () => string | undefined;
  /** The asker is the organization's member: the account is held by the organization, so it is not deleted from here. */
  readonly member?: () => boolean;
  readonly reads: () => UsageReads | undefined;
  /** The balance as this opening read it, read once whichever pane or question asks first. */
  readonly money: () => Promise<UsageReads["money"]>;
  readonly paying: Paying;
  readonly signOutEverywhere: () => Promise<unknown>;
  /** This browser signs out, as the account menu's 退出登录 does: the page goes to the door. */
  readonly signOutHere: () => Promise<unknown>;
  /** The account's deletion was asked for: the page signs out to the door. */
  readonly deleted: () => void;
  /** The name the account is called by now: the one it signed in with, or the one this page last saved. */
  readonly name: () => string | undefined;
  /** A name saved, or the photo changed: the corner draws what the account holds now. */
  readonly changed: (name?: string) => void;
  /** Says words once to a screen reader, where the page shows the change and says nothing of it. */
  readonly hear: (words: string) => void;
  /** Where the window's own steps open. */
  readonly home: () => HTMLElement;
  readonly history: () => History;
  readonly redraw: (key?: string) => void;
  /** Whether 账单 offers this account 订阅 (恢复订阅) now, and the way there. */
  readonly subscribable: () => boolean;
  readonly go: (hash: string) => void;
};

const row = ({ label, help, ctl, id, helpId, stacked }: { readonly label?: Child; readonly help?: Child; readonly ctl?: readonly Child[] | undefined; readonly id?: string; readonly helpId?: string; readonly stacked?: HTMLElement }): HTMLElement =>
  h("li", { class: stacked === undefined ? "sw-row" : "sw-row stacked" }, h("div", { class: "sw-text" }, label !== undefined && h("p", { class: "sw-label", id }, label), help !== undefined && h("p", { class: "sw-help quiet", id: helpId }, help)),
    ctl !== undefined && h("div", { class: "sw-ctl" }, ...ctl), stacked);
const group = (say: Say, title: StringKey | undefined, rows: readonly Child[], rule?: readonly Child[]): HTMLElement => {
  const id = title === undefined ? undefined : `sw-g-${title.slice(3)}`;
  return h("section", { class: "sw-group", "aria-labelledby": id }, title !== undefined && h("div", { class: "sw-head" }, h("h3", { id }, say(title))),
    rule !== undefined && h("p", { class: "sw-rule quiet" }, ...rule), h("ul", { class: "sw-rows" }, ...rows));
};

/** The kinds of picture the identity provider takes for a photo, and the most it takes. */
export const PHOTO_KINDS = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
export const PHOTO_MOST = 10 * 1000 * 1000;
/** The account's round mark, in the row and in the corner alike: its photo, else the first character of its name. */
export const avatar = (who: string, photo: string | undefined, extra?: string): HTMLElement =>
  h("span", { class: extra === undefined ? "avatar" : `avatar ${extra}`, "aria-hidden": "true" }, photo !== undefined ? h("img", { src: photo, alt: "" }) : firstLetter(who));
/** The mark of a menu of what can be done with a row: three dots, one over another, in the 16 px icon box. */
export const dots = (): SVGElement => svg("svg", { class: "icon", viewBox: "0 0 16 16", "aria-hidden": "true" },
  ...[3.5, 8, 12.5].map((cy) => svg("circle", { cx: "8", cy: String(cy), r: "1.3", fill: "currentColor", stroke: "none" })));
/** This device first, then the newest activity first. */
const newest = (a: Device, b: Device): number => Number(b.current) - Number(a.current) || b.activeAt - a.activeAt;
/** A width under which the table of devices stands as a list, each device a block. */
const LISTED = "(min-width: 48rem)";
const seg = <T extends string>(name: string, label: string, options: readonly (readonly [T, string])[], held: T, pick: (value: T) => void): HTMLElement =>
  choice({ label, values: options.map(([value, words]) => ({ name: words, key: `${name}:${value}` })), held: options.findIndex(([value]) => value === held), take: (index) => pick(options[index]![0]) }).element;

/** 准备好时提醒我's switch, named by its row's label and described by the line under it, which says why where it cannot be turned. */
const readySwitch = (label: string, on: boolean, blocked: boolean, flip: () => void): HTMLButtonElement => {
  const { element } = switchButton({ label, on, off: blocked, turn: flip });
  element.setAttribute("aria-describedby", "sw-ready-help");
  element.dataset["key"] = "ready";
  return element;
};

/** A line whose {words} are the one way on, a link to where they lead. */
const braced = (say: Say, key: StringKey, attributes: Readonly<Record<string, string>>): readonly Child[] => {
  const [before = "", words = "", after = ""] = say(key).split(/\{([^}]+)\}/);
  return [before, h("a", { class: "sw-link", ...attributes }, words), after];
};

/** 通用 and the invitation sheet: what the window reads for them at each opening, and how each is drawn. */
export class AccountPages {
  #invitations: Invitations | undefined;
  #copied: { readonly ok: boolean } | undefined;
  /** The browser refused notifications when asked: the switch stays off and says so. */
  #refused = false;

  constructor(readonly ports: AccountPorts) {}

  get invitations(): Invitations | undefined { return this.#invitations; }

  /** An opening starts afresh: what an earlier one read is dropped. Each part reads its own when the window draws it. */
  begin(): void {
    this.#invitations = undefined;
    this.#copied = undefined;
    this.#deleteFailed = false;
    this.#refused = false;
    this.#devices = undefined;
    this.#endFailed = undefined;
    this.#photoSaid = undefined;
    this.#nameSaid = undefined;
    this.#typed = undefined;
  }

  /** The window closed. */
  end(): void {
    // A Delete question still reading the balance is dropped with its opening; a deletion asked for goes on.
    if (this.#waits.detail("delete") === "money") this.#waits.release("delete");
  }

  /** The invitations, for the sheet and for whether the account is offered it; a read that failed draws as unread. */
  async readInvitations(): Promise<void> {
    this.#invitations = await this.ports.backend.invitations().catch(() => undefined);
  }

  /** 通用: how the window reads, what it tells, then the account's own groups, its deletion last. */
  general(w: Writer): readonly Child[] {
    const { say, ready, backend } = this.ports;
    const address = backend.links.help.replace(/^mailto:/, "");
    const away = (href: string, key: string, words: StringKey): HTMLElement =>
      h("a", { class: "f-btn", href, target: "_blank", rel: "noopener", "data-key": key }, say(words), "\u00a0↗", h("span", { class: "sw-hidden" }, say("sw.newTab")));
    const permission = ready.permission();
    const blocked = permission === "denied" || permission === "unsupported" || this.#refused;
    const on = ready.on() && !blocked && permission === "granted";
    const flip = async (): Promise<void> => {
      if (blocked) return;
      if (on) { ready.set(false); this.ports.redraw("ready"); return; }
      const answer = permission === "granted" ? permission : await ready.ask().catch((): NotificationPermission => "denied");
      this.#refused = answer !== "granted";
      ready.set(answer === "granted");
      this.ports.redraw("ready");
    };
    return [
      group(say, "sw.g.look", [
        row({ label: say("sw.lang"), ctl: [seg("lang", say("sw.lang"), (["zh", "en"] as const).map((one) => [one, LANGUAGE_NAMES[one]] as const), this.ports.language(), (value) => this.ports.setLanguage(value))] }),
        row({ label: say("sw.look"), ctl: [seg("look", say("sw.look"), (["system", "light", "dark"] as const).map((one) => [one, say(`sw.look.${one}`)] as const), this.ports.appearance(), (value) => this.ports.setAppearance(value))] }),
      ]),
      group(say, "sw.g.notify", [
        row({ label: say("sw.ready"), id: "sw-ready", helpId: "sw-ready-help", help: say(blocked ? "sw.readyBlocked" : "sw.readyHelp"),
          ctl: [readySwitch(say("sw.ready"), on, blocked, () => { void flip(); })] }),
      ]),
      group(say, "sw.g.yourData", [row({ label: say("sw.dataHandling"), help: say("sw.dataHandlingHelp"), ctl: [away(SITE_PAGES[w.language].privacy, "privacy", "sw.privacy")] })]),
      group(say, "sw.g.help", [row({ label: say("sw.contact"), ctl: [h("span", { class: "sw-value" }, address), h("a", { class: "f-btn", href: backend.links.help, "data-key": "email-us" }, say("sw.emailUs"))] })]),
    ];
  }

  /** The devices the account is signed in on, read once at the opening that draws 账户; a read that failed draws as unread. */
  async readDevices(): Promise<void> {
    this.#devices = await this.ports.backend.devices().then((list) => [...list].sort(newest), () => "unread" as const);
  }

  /** 账户: the photo and the name cx calls the seller, the devices the account is signed in on, and its deletion, which a member is not offered. */
  account(w: Writer): readonly Child[] {
    const say = this.ports.say;
    return [
      group(say, "sw.g.profile", [this.#photoRow(), this.#nameRow()]),
      h("section", { class: "sw-group sw-devices-group", "aria-labelledby": "sw-g-g.signIn" },
        h("div", { class: "sw-head" }, h("h3", { id: "sw-g-g.signIn" }, say("sw.g.signIn")), this.#signOutAll()),
        this.#devices === "unread" ? h("p", { class: "sw-help quiet" }, say("sw.unread")) : this.#devicesTable(w)),
      ...(this.ports.member?.() === true ? [] : [group(say, "sw.g.deleteAccount", [this.#deleteRow(w)])]),
    ];
  }

  #photoSaid: "sw.avatarTooBig" | "sw.avatarKind" | "sw.avatarFailed" | undefined;
  /**
   * The photo alone at its row's end, a button: with none set a press opens the system's picker for the four kinds, with one set a menu
   * of 上传 and 移除. A file the identity provider would refuse is refused here at once; one it refuses says so in the same place.
   */
  #photoRow(): HTMLElement {
    const { say, backend } = this.ports;
    const kept = backend.photo();
    const pick = h("input", { type: "file", accept: PHOTO_KINDS.join(","), class: "sw-hidden", tabindex: "-1", "aria-hidden": "true", "data-key": "picker" });
    pick.addEventListener("change", () => { const file = pick.files?.[0]; pick.value = ""; if (file !== undefined) void this.#setPhoto(file); });
    const why = this.#photoSaid;
    const line = why !== undefined ? h("p", { class: "sw-help f-line bad", id: "sw-photo-line", role: "alert" }, say(why))
      : h("p", { class: "sw-help quiet", id: "sw-photo-line" }, say("sw.avatarHint"));
    const photo = this.#waits.ring("photo", h("button", { type: "button", class: "sw-photo", "data-key": "photo", "aria-labelledby": "sw-photo-label", "aria-describedby": "sw-photo-line" },
      avatar(this.ports.name() ?? this.ports.email() ?? "", kept)));
    if (!this.#waits.has("photo")) {
      if (kept === undefined) photo.addEventListener("click", () => pick.click());
      else {
        const list = h("div", { class: "f-menu", role: "menu", "aria-labelledby": "sw-photo-label" },
          menuRow(say("sw.upload"), () => pick.click()), menuRow(say("sw.remove"), () => { void this.#setPhoto(null); }));
        menu(photo, list, { end: true });
      }
    }
    return h("li", { class: "sw-row sw-photo-row" },
      h("div", { class: "sw-text" }, h("p", { class: "sw-label", id: "sw-photo-label" }, say("sw.avatar")), line),
      h("div", { class: "sw-ctl" }, pick, photo));
  }

  /** A picture set as the photo, or the photo removed: the photo turns until the identity provider answers, then shows what it holds. */
  async #setPhoto(file: File | null): Promise<void> {
    const { say, backend } = this.ports;
    if (file !== null && !(PHOTO_KINDS as readonly string[]).includes(file.type)) { this.#photoSaid = "sw.avatarKind"; this.ports.redraw(); return; }
    if (file !== null && file.size > PHOTO_MOST) { this.#photoSaid = "sw.avatarTooBig"; this.ports.redraw(); return; }
    this.#photoSaid = undefined;
    const control = this.ports.home().querySelector<HTMLElement>("[data-key='photo']") ?? undefined;
    await this.#waits.run("photo", () => backend.setPhoto(file).then(() => {
      this.ports.hear(say(file === null ? "sw.avatarRemoved" : "sw.avatarKept"));
      this.ports.changed();
    }, () => { if (file !== null) this.#photoSaid = "sw.avatarFailed"; }), control);
    this.ports.redraw();
  }

  #nameSaid: "saved" | "failed" | undefined;
  /** What the seller typed and has not had kept: drawn again as typed. */
  #typed: string | undefined;
  /**
   * The name cx calls the seller, in a field at its row's end with no button: kept when the seller leaves it or presses Enter, with 已保存
   * at its left until they type again. An emptied field takes the kept name back and says nothing.
   */
  #nameRow(): HTMLElement {
    const { say, backend } = this.ports;
    const said = (): HTMLElement => (this.#nameSaid === "failed"
      ? h("span", { class: "sw-said asks f-line bad", id: "sw-name-said", role: "alert" }, say("sw.nameFailed"))
      : h("span", { class: "sw-said", id: "sw-name-said", role: "status" }, this.#nameSaid === "saved" ? say("sw.nameSaved") : ""));
    let word = said();
    // The word beside the field changes in place, so a screen reader hears 已保存; a failure comes in as an alert.
    const show = (): void => {
      if (!word.isConnected) return;
      if (this.#nameSaid === "failed" || word.getAttribute("role") !== "status") { const next = said(); word.replaceWith(next); word = next; }
      else word.textContent = this.#nameSaid === "saved" ? say("sw.nameSaved") : "";
    };
    const field = h("input", { type: "text", id: "sw-name-field", class: "sw-name-field", autocomplete: "nickname", maxlength: "64", spellcheck: "false",
      value: this.#typed ?? this.ports.name() ?? "", "data-key": "name" });
    const keep = (): void => {
      if (!field.isConnected || this.#waits.has("name")) return;
      const kept = this.ports.name() ?? "";
      const typed = field.value.trim();
      if (typed === "") { field.value = kept; this.#typed = undefined; if (this.#nameSaid !== undefined) { this.#nameSaid = undefined; show(); } return; }
      if (typed === kept && this.#nameSaid !== "failed") { field.value = typed; this.#typed = undefined; return; }
      field.value = typed;
      this.#typed = typed;
      void this.#waits.run("name", () => backend.setName(typed).then(() => {
        this.#nameSaid = "saved";
        this.ports.changed(typed);
      }, () => { this.#nameSaid = "failed"; })).then(() => {
        // Typed again meanwhile, the word waits for that, kept in its turn once the seller has left the field.
        const again = field.isConnected && field.value.trim() !== typed;
        if (!again && this.#nameSaid === "saved") this.#typed = undefined;
        if (again && this.#nameSaid === "saved") this.#nameSaid = undefined;
        show();
        if (again && document.activeElement !== field) keep();
      });
    };
    field.addEventListener("input", () => { this.#typed = field.value; if (this.#nameSaid !== undefined) { this.#nameSaid = undefined; show(); } });
    field.addEventListener("blur", keep);
    field.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); keep(); } });
    return h("li", { class: "sw-row roomy sw-name-row" }, h("div", { class: "sw-text" }, h("label", { class: "sw-label", for: "sw-name-field" }, say("sw.callYou"))),
      h("div", { class: "sw-ctl" }, word, field));
  }

  /** 在所有设备上退出登录, on the group's heading line: a press asks first, and its 退出登录 turns the button. */
  #signOutAll(): HTMLElement {
    const say = this.ports.say;
    const button = this.#waits.ring("sign-out", h("button", { type: "button", class: "f-btn sw-btn", "data-key": "sign-out" }, say("sw.signOutAll")));
    button.addEventListener("click", () => {
      if (this.#waits.has("sign-out")) return;
      confirmStep(this.ports.home(), say, { ask: say("sw.allAsk"), yes: say("sw.signOut"), history: this.ports.history(), back: () => this.#giveBack("sign-out"),
        then: () => { this.#giveBack("sign-out"); void this.#waits.run("sign-out", () => this.ports.signOutEverywhere(), this.#control("sign-out")); } });
    });
    return button;
  }

  #devices: readonly Device[] | "unread" | undefined;
  #endFailed: string | undefined;
  #deviceName(device: Device): string {
    const say = this.ports.say;
    if (device.device === undefined && device.browser === undefined) return say("sw.unknownDevice");
    return say("sw.deviceIs", { device: device.device ?? say("sw.unknownDevice"), detail: device.browser ?? "" }).replace(/ · $/u, "");
  }
  /** The table of devices: this one first and tagged, each row's ⋮ a menu of one row, 退出登录. */
  #devicesTable(w: Writer): HTMLElement {
    const say = this.ports.say;
    const list = this.#devices === undefined || this.#devices === "unread" ? [] : this.#devices;
    const today = localDay(this.ports.backend.now());
    const place = (one: Device): string => (one.city === undefined ? say("sw.unknown") : [one.city, one.country].filter((part) => part !== undefined).join(", "));
    const when = (one: Device): string => {
      if (one.current) return say("sw.justNow");
      const at = new Date(one.activeAt);
      return localDay(one.activeAt) === today ? say("sw.todayAt", { time: w.clock(at.getHours(), at.getMinutes()) }) : w.at(localDay(one.activeAt), at.getHours(), at.getMinutes());
    };
    // Under 48rem the table stands as a list, each value under its device with its head before it; the heads are read from the table.
    const headed = (key: StringKey, value: string, cls: string): HTMLElement =>
      h("td", { class: cls }, h("span", { class: "sw-dev-head", "aria-hidden": "true" }, say(key)), h("span", { class: "sw-dev-val" }, value));
    const listed = !globalThis.matchMedia?.(LISTED).matches;
    return h("table", { class: "pl-table sw-devices", "aria-labelledby": "sw-g-g.signIn" },
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, say("sw.col.device")), h("th", { scope: "col" }, say("sw.col.place")),
        h("th", { scope: "col" }, say("sw.col.signedIn")), h("th", { scope: "col" }, say("sw.col.active")), h("td", { "aria-hidden": "true" }))),
      h("tbody", {}, ...list.map((one, at) => h("tr", { class: one.current ? "sw-here" : undefined },
        h("th", { scope: "row", class: "sw-dev" }, h("span", {}, this.#deviceName(one)), one.current && h("span", { class: "f-tag sw-dev-tag" }, say("sw.thisDevice"))),
        headed("sw.col.place", place(one), "sw-dev-place"), headed("sw.col.signedIn", w.dayName(localDay(one.signedInAt)), "sw-dev-signed"), headed("sw.col.active", when(one), "sw-dev-when"),
        // The first device's ⋮ has 在所有设备上退出登录 over it where the table stands as a list: its tip stands beside it.
        h("td", { class: "sw-dev-end" }, ...this.#endControl(one, list, listed && at === 0))))));
  }
  #endControl(device: Device, list: readonly Device[], beside: boolean): readonly Child[] {
    const say = this.ports.say;
    const key = `more:${device.id}`;
    const actions = say("sw.deviceActions", { device: this.#deviceName(device) });
    const more = this.#waits.ring(key, tip(h("button", { type: "button", class: "f-icon sw-more", "data-key": key, "aria-label": actions }, dots()),
      actions, { at: beside ? "beside" : "above", end: true }));
    if (!this.#waits.has(key)) {
      // The menu closes before its step opens, so the step keeps the keyboard.
      const rows = h("div", { class: "f-menu", role: "menu", "aria-label": actions }, menuRow(say("sw.signOut"), () => { opened.close(false); this.#askEnd(device, list); }));
      const opened = menu(more, rows, { end: true });
    }
    return [this.#endFailed === device.id && h("span", { class: "sw-said asks f-line bad", role: "alert" }, say("sw.endFailed")), more];
  }
  /** The step before a device signs out; for this one the page then signs out here and goes to the door. */
  #askEnd(device: Device, list: readonly Device[]): void {
    const say = this.ports.say;
    const key = `more:${device.id}`;
    const name = this.#deviceName(device);
    confirmStep(this.ports.home(), say, {
      ask: say("sw.endAsk", { device: name }), what: [say(device.current ? "sw.endWhatHere" : "sw.endWhatDevice")], yes: say("sw.signOut"),
      history: this.ports.history(), back: () => this.#giveBack(key),
      then: () => {
        // The step's yes leaves the keyboard on the ⋮, which turns until the platform answers.
        this.#giveBack(key);
        this.#endFailed = undefined;
        if (device.current) {
          let failed = false;
          void this.#waits.run(key, () => this.ports.signOutHere().then(undefined, () => { this.#endFailed = device.id; failed = true; }), this.#control(key))
            .then(() => { if (failed) this.ports.redraw(); });
          return;
        }
        let next: string | undefined;
        void this.#waits.run(key, () => this.ports.backend.endDevice(device.id).then(() => {
          // The row goes: a keyboard still on its ⋮ goes on to the next row's, else the one before it.
          const at = list.indexOf(device), after = list[at + 1] ?? list[at - 1];
          if ((document.activeElement as HTMLElement | null)?.dataset?.["key"] === key) next = after === undefined ? "sign-out" : `more:${after.id}`;
          if (this.#devices !== undefined && this.#devices !== "unread") this.#devices = this.#devices.filter((one) => one.id !== device.id);
          this.ports.hear(say("sw.deviceSignedOut", { device: name }));
        }, () => { this.#endFailed = device.id; }), this.#control(key)).then(() => this.ports.redraw(next));
      },
    });
  }

  /** 删除账户: main's row and step while nothing holds the account; while a card subscription holds it, the button grey and why, with 账单. */
  #deleteRow(w: Writer): HTMLElement {
    const say = this.ports.say;
    const reads = this.ports.reads();
    const status = reads?.subscription?.status;
    if (status === "active" || status === "retrying" || status === "cancelling") {
      const last = reads?.money?.member?.last_day;
      const why = h("span", { id: "sw-delete-why" }, status === "cancelling" && last !== undefined ? say("sw.deleteAfter", { day: w.dayName(last) }) : say("sw.deleteCancelFirst"));
      const billing = h("a", { class: "sw-link", href: "#/settings/billing", "data-key": "to-billing", "aria-describedby": "sw-delete-why" }, say("sw.sec.billing"));
      // 账单 follows the sentence straight after 。 in Chinese and after a space in English.
      return h("li", { class: "sw-row roomy" }, h("div", { class: "sw-text" }, h("p", { class: "sw-label sw-help" }, why, w.comma === "，" ? "" : " ", billing)),
        h("div", { class: "sw-ctl" }, h("button", { type: "button", class: "f-btn sw-btn", "data-key": "delete", "aria-disabled": "true", "aria-describedby": "sw-delete-why" }, say("sw.deleteAccount"))));
    }
    return h("li", { class: "sw-row roomy" }, h("div", { class: "sw-text" }, h("p", { class: "sw-label sw-help" }, say("sw.deleteHelp"))),
      h("div", { class: "sw-ctl" }, this.#deleteFailed && h("span", { class: "sw-said asks f-line bad", role: "alert" }, say("sw.deleteFailed")),
        this.#waits.ring("delete", h("button", { type: "button", class: "f-btn sw-btn", "data-key": "delete", onclick: () => { if (!this.#waits.has("delete")) void this.#askDelete(w); } }, say("sw.deleteAccount")))));
  }

  #control(key: string): HTMLElement | undefined {
    return [...this.ports.home().querySelectorAll<HTMLElement>("[data-key]")].find((one) => one.dataset["key"] === key);
  }
  /** The focus back on what opened a step, with no tip: the keyboard did not reach it. */
  #giveBack(key: string): void {
    const control = this.#control(key);
    if (control !== undefined) giveBack(control);
  }

  #deleteFailed = false;
  readonly #waits = new Waits(() => this.ports.home());
  /**
   * The step before the account goes: it names the account by its email and the balance in figures where there is money to lose, whatever
   * the account's state; where the balance is nothing, owed or unread, the word alone. It says nothing of a membership.
   */
  async #askDelete(w: Writer): Promise<void> {
    const { say, backend } = this.ports;
    this.#deleteFailed = false;
    // The balance the step names is the opening's, read when the step is asked for where no pane has read it yet: 通用 draws nothing else of it.
    let figure: number | undefined;
    await this.#waits.run("delete", async () => { figure = (await this.ports.money())?.figure; },
      this.ports.home().querySelector<HTMLElement>("[data-key='delete']") ?? undefined, "money");
    // A question whose window closed while it read opens nothing: the step would stand over the page, or within a window no one sees.
    const home = this.ports.home();
    if (!home.isConnected || (home instanceof HTMLDialogElement && !home.open)) return;
    const email = this.ports.email() ?? "";
    confirmStep(this.ports.home(), say, {
      ask: say("sw.deleteAsk"),
      what: figure !== undefined && figure > 0 ? around(say, "sw.deleteWhat", "amount", amount(figure, w), { email }) : [say("sw.deleteWhatPlain", { email })],
      yes: say("sw.deleteAccount"), back: () => this.ports.redraw("delete"), history: this.ports.history(),
      // The step closes on the press, and 删除账号 turns until the platform answers.
      then: () => {
        void this.#waits.run("delete", () => backend.deleteAccount().then(() => this.ports.deleted(), () => { this.#deleteFailed = true; this.ports.redraw("delete"); }),
          this.ports.home().querySelector<HTMLElement>("[data-key='delete']") ?? undefined);
      },
    });
  }

  /**
   * The invitation sheet: what each side gets, the link and its coupons for a member; for an account whose membership expired, the
   * friends whose reward can still arrive; for any other account, what a member earns and the way to Pro.
   */
  invite(w: Writer): readonly Child[] {
    const say = this.ports.say;
    const reads = this.ports.reads();
    const invitations = this.#invitations;
    const terms = this.ports.reads()?.terms;
    const title = h("h2", { class: "sw-title", id: "sw-page-title" }, say("sw.invite"));
    // Whether the account is a member decides which sheet it is, so an unread account draws neither.
    if (invitations === undefined || terms === undefined || reads?.money === undefined) return [title, h("p", { class: "sw-figure unread" }, say("sw.unread")), h("p", { class: "sw-help quiet" }, say("sw.retry"))];
    const friendRow = (one: Coupon): HTMLElement => row({
      label: one.friend !== undefined ? h("bdi", { class: "sw-friend" }, one.friend) : undefined,
      help: one.reward === "landed" ? say("sw.inviteLanded", { day: w.dayName(one.rewarded_on!), ends: w.dayName(one.reward_ends_on!) })
        : one.reward === "waiting" ? say("sw.inviteUsed", { day: w.dayName(one.signed_up_on), last: w.dayName(one.reward_by!) }) : say("sw.inviteMissed", { day: w.dayName(one.signed_up_on) }),
      ctl: one.reward === "landed" ? [amount(terms.reward, w, "sw-amount-cell")] : undefined,
    });
    const money = reads.money;
    const retrying = reads.subscription?.status === "retrying";
    const space = w.comma === "，" ? "" : " ";
    if (money.state !== "member") {
      const waiting = invitations.coupons.filter((one) => one.reward === "waiting");
      const lapsed = money.free?.why === "membership_ended";
      if (waiting.length === 0) {
        keepRows("invited", 0);
        const first = this.ports.paying.starting ? say(lapsed ? "sw.inviteLapsedStarting" : "sw.inviteFreeStarting")
          : retrying ? say("sw.inviteLapsedRetry") : say(lapsed ? "sw.inviteFreeLapsed" : "sw.inviteFreeFirst");
        // An account whose Pro ended may have taken its coupons already, so its rule is a member's, without the count.
        const how = lapsed ? say("sw.inviteHow", { n: terms.reward_window_days }) : say("sw.inviteFreeHow", { friends: terms.friends, gift: w.money(terms.trial.invited), n: terms.reward_window_days });
        return [
          h("div", { class: "sw-offer" }, h("p", { class: "sw-offer-lead" }, say("sw.inviteFreeLead")), h("p", { class: "sw-offer-figure" }, w.money(terms.reward)), h("p", { class: "quiet" }, say("sw.inviteFreeFoot"))),
          title,
          h("p", { class: "sw-invite-how" }, first, space, how, space, termsLink(say, w, "sw.inviteRules", "invitations")),
          // The way to Pro stands only where 账单 offers it: never while a payment is out.
          this.ports.subscribable() && h("div", { class: "sw-offer-act" }, h("button", { type: "button", class: "f-btn primary sw-btn", "data-key": "subscribe",
            onclick: () => this.ports.go("#/settings/billing/subscribe") }, say(lapsed ? "sw.resume" : "sw.subscribe"))),
        ];
      }
      const rule = this.ports.paying.starting ? [say("sw.inviteLapsedStarting")] : retrying ? [say("sw.inviteLapsedRetry")]
        : braced(say, "sw.inviteLapsed", { href: "#/settings/billing/subscribe", "data-key": "resume" });
      keepRows("invited", waiting.length);
      return [title, group(say, undefined, waiting.map(friendRow), rule)];
    }
    // The coupons are counted from the friends who took one: a friend past them took none, and had the direct trial.
    const left = Math.max(0, terms.friends - invitations.coupons.filter((one) => one.slot !== undefined).length);
    const link = invitations.link;
    const ends = !renewing(reads) && money.member !== undefined;
    const copied = this.#copied;
    const field = h("input", { type: "text", class: "sw-link-field", readonly: true, value: link ?? "", spellcheck: "false", "aria-label": say("sw.inviteLink"), "data-key": "link",
      "aria-describedby": [ends && "sw-link-ends", copied?.ok === false && "sw-copy-said"].filter(Boolean).join(" ") || undefined });
    field.addEventListener("focus", () => field.select());
    field.addEventListener("click", () => field.select());
    // 已复制 is said once the clipboard has taken the link, not before; where it refuses, the link stands selected for the person to copy.
    const copy = (): void => {
      const done = (ok: boolean): void => {
        this.#copied = { ok };
        this.ports.redraw(ok ? "copy-link" : "link");
        if (!ok) document.querySelector<HTMLInputElement>("dialog[open] [data-key='link']")?.select();
      };
      (globalThis.navigator?.clipboard?.writeText(link ?? "") ?? Promise.reject(new Error("no clipboard"))).then(() => done(true), () => done(false));
    };
    const gift = (who: StringKey, figure: number, lot: StringKey): HTMLElement =>
      h("div", { class: "sw-gift-tile" }, h("p", { class: "quiet" }, say(who)), h("p", { class: "sw-gift-figure" }, w.money(figure)), h("p", { class: "quiet" }, say(lot)));
    keepRows("invited", invitations.coupons.length);
    // Past the coupons the link still brings a friend, with the direct trial: the marks stay as a record, all used.
    return [
      h("div", { class: "sw-gift" }, gift("sw.inviteFriendGets", left > 0 ? terms.trial.invited : terms.trial.direct, "sw.lot.sign_up"), gift("sw.inviteYouGet", terms.reward, "sw.lot.reward")),
      title,
      h("p", { class: "sw-invite-how" }, say("sw.inviteHow", { n: terms.reward_window_days }), space, termsLink(say, w, "sw.inviteRules", "invitations")),
      h("div", { class: "sw-marks" }, ...Array.from({ length: terms.friends }, (_, at) => h("span", { class: `sw-mark${at < left ? "" : " used"}`, "aria-hidden": "true" })),
        h("span", { class: "quiet" }, left > 0 ? say("sw.inviteLeft", { n: left, all: terms.friends }) : say("sw.invitePast", { all: terms.friends, gift: w.money(terms.trial.invited) }))),
      ...(link !== undefined ? [h("div", { class: "sw-link-row" }, field, h("button", { type: "button", class: "f-btn primary sw-btn", "data-key": "copy-link", onclick: copy }, say("sw.copyLink"))),
        ends && h("p", { class: "sw-link-ends quiet", id: "sw-link-ends" }, say("sw.inviteEnds", { day: w.dayName(money.member!.last_day) })),
        h("p", { class: `sw-said${copied?.ok === false ? " asks" : ""}`, id: "sw-copy-said", role: "status" }, copied !== undefined && say(copied.ok ? "sw.copied" : "sw.copyFailed"))] : []),
      invitations.coupons.length > 0 && group(say, "sw.invitePeople", invitations.coupons.map(friendRow)),
    ];
  }
}
