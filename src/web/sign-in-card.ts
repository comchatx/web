import type { SignInStepKind } from "../shared/maker-words.js";
import { badDomain, type SignInStep } from "../shared/sign-in.js";
import { dialogCard, type DialogPorts } from "./dialog-card.js";
import { h, svg } from "./dom.js";
import { ringed } from "./waiting.js";
import type { StringKey } from "./strings.js";

type Link = Extract<SignInStep, { kind: "link" | "code" }>;
type Ask = Extract<SignInStep, { kind: "ask" }>;
export type SignInNote = "empty" | "unsent" | "domain" | "elsewhere";
/** A step of the card as its package declares it, its sentence in the page's language. */
export type CardStep = { readonly kind: SignInStepKind; readonly line?: string };

/** A sign-in under way as its card draws it: the link or code it gave, the question it waits on, what was typed and the line under the presses. */
export type SignInCard = {
  readonly name: string;
  readonly link?: Link;
  readonly ask?: Ask | undefined;
  readonly typed: string;
  readonly note?: SignInNote | undefined;
  /** An answer is on its way: the presses wait for it. */
  readonly sending: boolean;
  /** The steps the vendor's package declares, drawn in place of the platform's own once the flow has given its link. */
  readonly steps?: readonly CardStep[] | undefined;
};

export type SignInCardPorts = {
  readonly say: (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;
  readonly typed: (value: string) => void;
  readonly submit: () => void;
  readonly cancel: () => void;
  /** A question no shape of the card carries, as the conversation's card asks it. */
  readonly dialog: DialogPorts;
};

const host = (url: string): string => new URL(url).host;
type Shape = "address" | "code" | "device" | "secret" | "link" | "domain";

/** Which of the card's shapes a sign-in takes, from what it has sent so far; undefined before it has sent anything the card draws. */
export function shapeOf(card: Pick<SignInCard, "link" | "ask">): Shape | undefined {
  if (card.ask?.dialog.method === "input" && card.ask.paste === "domain") return "domain";
  const paste = card.link?.kind === "link" ? card.link.paste : undefined;
  if (paste !== undefined) return paste;
  if (card.link?.kind === "code") return "device";
  if (card.ask?.dialog.method === "input" && card.ask.masked) return "secret";
  return card.link === undefined ? undefined : "link";
}

/** A page that did not open, drawn as a document crossed. */
const PAGE_OFF = "M7 3h7l5 5v13H7zM14 3v5h5M9.5 12.5l5 5M14.5 12.5l-5 5";

/**
 * The page a sign-in that takes its address back stops on, drawn as a browser window whose address bar holds that page's address, selected as a press on
 * the bar leaves it, over a page that did not open. A picture: a screen reader skips it, since the line over it says what it shows; it
 * says no browser's words, which differ from browser to browser, and nothing in it is pressed or typed in.
 */
const stoppedPage = (stop: string): HTMLElement => h("div", { class: "sign-in-stop", "aria-hidden": "true" },
  h("div", { class: "sign-in-stop-bar" }, h("span", { class: "sign-in-stop-address" }, h("span", { class: "sign-in-stop-selected" }, `${stop}?code=…`))),
  h("div", { class: "sign-in-stop-page" }, svg("svg", { viewBox: "0 0 24 24", class: "pl-icon", "aria-hidden": "true" }, svg("path", { d: PAGE_OFF }))));

const EMPTY: Readonly<Record<Shape, StringKey>> = { address: "signIn.emptyAddress", code: "signIn.emptyCode", secret: "signIn.emptySecret", device: "signIn.emptyCode", link: "signIn.emptyCode", domain: "signIn.badDomain" };
export const emptyNote = (shape: Shape): StringKey => EMPTY[shape];

/**
 * One sign-in's steps as one card under its row, in the order the conversation's questions take: where the card holds a limit, it
 * stands first, since it runs from the card's opening; then where to go, the field where the flow waits on one, and the press and the
 * way out. Once the flow has given its link, a vendor whose package declares its steps is drawn from them, a numbered list in the
 * declared order, each step its sentence over its part; and a sign-in that takes back the address its browser stops on, declared or
 * not, is drawn so with the platform's own sentences: the link, what the page the browser stops on means over that page drawn, and what
 * to copy over the field. The card is whole from its opening: the link's press opens the vendor's page and puts the keyboard in the
 * field, and changes nothing drawn. Otherwise by what the flow sent: a link that carries its own code, or a code to carry beside its
 * link where a link does not; a link, then the code the vendor's page shows, pasted back, with no limit; a domain asked before the
 * code, blank for github.com, its press naming the host it goes to; or a masked field for a secret, named by what it holds. pi's own
 * words on the way are not drawn: the card's say the step. The one way out is Cancel, and Escape in the card is Cancel.
 */
export function signInCard(card: SignInCard, ports: SignInCardPorts): HTMLElement {
  const say = ports.say;
  const shape = shapeOf(card);
  const cancel = h("button", { type: "button", class: "f-btn", "data-focus": "sign-in-cancel", onclick: () => ports.cancel() }, say("signIn.cancel"));
  const go = (words: string, url: string): HTMLElement => h("a", { class: "button", href: url, target: "_blank", rel: "noopener noreferrer", "data-link": "", "data-focus": "sign-in-go" }, words);
  // While an answer is on its way the press turns, keeping the keyboard, and the form takes no other.
  const submit = (words: string): HTMLElement => {
    const press = h("button", { type: "submit", class: "f-btn primary", "data-focus": "sign-in-submit" }, words);
    ringed(press, card.sending);
    return press;
  };
  const limit = (minutes: number): HTMLElement => h("p", { class: "dialog-line" }, say("signIn.limit", { n: minutes }));
  const typed = (kind: "text" | "password", words: string): HTMLInputElement => {
    const field = h("input", { type: kind, placeholder: words, "aria-label": words, autocomplete: "off", spellcheck: "false", "data-focus": "sign-in-field" }) as HTMLInputElement;
    field.value = card.typed;
    field.readOnly = card.sending;
    field.addEventListener("input", () => ports.typed(field.value));
    return field;
  };
  const link = card.link;
  const goWords = (): string => (link === undefined ? "" : link.kind === "code" && !link.url.includes(link.code) ? say("signIn.goDevice", { host: host(link.url) })
    : shape === "code" ? say("signIn.goCode", { host: host(link.url) }) : say("signIn.goSignIn", { host: host(link.url) }));
  const codeBox = (code: string): HTMLElement => {
    const copy = h("button", { type: "button", class: "f-btn", "data-focus": "sign-in-copy", onclick: () => {
      void globalThis.navigator?.clipboard?.writeText(code).catch(() => undefined);
      copy.textContent = say("signIn.copied");
    } }, say("signIn.copy"));
    return h("div", { class: "dialog-code" }, h("code", {}, code), copy);
  };
  const steps = card.steps ?? (shape === "address" ? [{ kind: "link", line: undefined }, { kind: "address", line: say("signIn.addressLine") }, { kind: "field", line: say("signIn.copyAddress") }] as const : undefined);
  let parts: readonly (HTMLElement | false)[];
  if (link !== undefined && steps !== undefined && card.ask?.dialog.method !== "select") {
    const pastes = shape === "address" || shape === "code";
    const waits = pastes && steps.some((step) => step.kind === "field");
    const items = steps.map((step, at) => {
      const id = `sign-in-step-${at + 1}`;
      const line = step.line === undefined ? false : h("p", { id }, step.line);
      if (step.kind === "link") {
        const going = go(goWords(), link.url);
        // The vendor's page opens, and the keyboard waits in the field for what comes back. Enter on a link is its click.
        const toField = (): void => { going.closest("form")?.querySelector<HTMLElement>("[data-focus='sign-in-field']")?.focus({ preventScroll: true }); };
        going.addEventListener("click", toField);
        going.addEventListener("auxclick", (event) => { if ((event as MouseEvent).button === 1) toField(); });
        return h("li", {}, line, going);
      }
      if (step.kind === "address") return h("li", {}, line, link.kind === "link" && link.stop !== undefined && stoppedPage(link.stop));
      if (step.kind === "show") return h("li", {}, line, link.kind === "code" && !link.url.includes(link.code) && codeBox(link.code));
      if (!pastes) return h("li", {}, line);
      const field = typed("text", say(shape === "address" ? "signIn.pasteAddress" : "signIn.pasteCode"));
      field.setAttribute("aria-describedby", line === false ? "sign-in-note" : `${id} sign-in-note`);
      return h("li", {}, line, field);
    });
    parts = [shape !== "code" && limit(link.minutes), h("ol", { class: "sign-in-steps" }, ...items), h("div", { class: "dialog-acts" }, waits && submit(say("signIn.submit")), cancel)];
  } else if (link?.kind === "code") {
    // A link that carries its code is the whole step; a code its link does not carry is drawn to copy and carry there.
    const carried = link.url.includes(link.code);
    parts = [limit(link.minutes), !carried && codeBox(link.code), h("div", { class: "dialog-acts" }, go(goWords(), link.url), cancel)];
  } else if (shape === "code" && link !== undefined) {
    parts = [h("p", {}, go(say("signIn.goCode", { host: host(link.url) }), link.url)), typed("text", say("signIn.pasteCode")),
      h("div", { class: "dialog-acts" }, submit(say("signIn.submit")), cancel)];
  } else if (shape === "domain") {
    // The press names where the sign-in goes, as the field says it: github.com while it is blank or not yet a domain.
    const going = (value: string): string => say("signIn.goSignIn", { host: value.trim() === "" || badDomain(value) !== undefined ? "github.com" : new URL(value.includes("://") ? value.trim() : `https://${value.trim()}`).hostname });
    const field = typed("text", say("signIn.domainPh"));
    field.setAttribute("aria-label", say("signIn.domain"));
    const press = submit(going(card.typed));
    field.addEventListener("input", () => { press.textContent = going(field.value); });
    parts = [h("p", { class: "dialog-line" }, say("signIn.domain")), field, card.ask?.minutes !== undefined && limit(card.ask.minutes), h("div", { class: "dialog-acts" }, press, cancel)];
  } else if (shape === "secret") {
    parts = [typed("password", say("signIn.secret")), h("div", { class: "dialog-acts" }, submit(say("signIn.secretSave")), cancel)];
  } else if (card.ask !== undefined && card.ask.dialog.method === "select") {
    // A choice the platform does not make for the person is asked as a package's choice is; the card's Cancel stays the way out.
    parts = [link !== undefined && h("p", {}, go(say("signIn.goSignIn", { host: host(link.url) }), link.url)), dialogCard(card.ask.dialog, ports.dialog), h("div", { class: "dialog-acts" }, cancel)];
  } else {
    parts = [link !== undefined && limit(link.minutes), h("div", { class: "dialog-acts" }, link !== undefined && go(say("signIn.goSignIn", { host: host(link.url) }), link.url), cancel)];
  }
  const note = card.note === "unsent" ? say("signIn.unsent") : card.note === "domain" ? say("signIn.badDomain") : card.note === "empty" && shape !== undefined ? say(emptyNote(shape))
    : card.note === "elsewhere" && link?.kind === "link" && link.stop !== undefined ? say("signIn.notAddress", { address: link.stop }) : "";
  return h("form", {
    class: "dialog sign-in", role: "group", tabindex: "-1", "aria-label": say("pl.ms.signIn", { vendor: card.name }),
    onsubmit: (event: Event) => { event.preventDefault(); if (!card.sending) ports.submit(); },
    onkeydown: (event: Event) => {
      const key = event as KeyboardEvent;
      if (key.key === "Escape" && !key.isComposing && key.keyCode !== 229) { key.preventDefault(); key.stopPropagation(); ports.cancel(); }
    },
  }, ...parts, h("p", { class: card.note === "unsent" ? "dialog-line failed" : "dialog-line", id: "sign-in-note", role: "status", hidden: note === "" }, note));
}
