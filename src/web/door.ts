import { DOOR_PATH, doorReason, LANGUAGE_PARAM, ROAD_PATH, STYLE_NONCE_META, type DoorReason } from "../shared/door.js";
import { formatShown } from "./backend.js";
import { dollars } from "../shared/money.js";
import { VENDOR_WORDS, LANGUAGE_KEY, SUPPORT, say, type DoorLanguage } from "./door-words.js";
import { SITE_PAGES, type SitePages } from "./site-pages.js";

/** The vendor's browser SDK as the door uses it: the calls its quickstart makes, and nothing of its own types in this bundle. */
type Vendor = {
  load(options: Readonly<Record<string, unknown>>): Promise<unknown>;
  mountSignIn(node: HTMLElement, props: Readonly<Record<string, unknown>>): void;
  unmountSignIn(node: HTMLElement): void;
};
export type DoorWindow = Window & typeof globalThis & { readonly Clerk?: Vendor | undefined; readonly __internal_ClerkUICtor?: unknown };

/** What the door shows only once the product has it: the fine print, with the terms and privacy pages in each language. */
export type DoorPages = SitePages;
export type DoorFeatures = { readonly legal?: Readonly<Record<DoorLanguage, DoorPages>> };
export const FEATURES: DoorFeatures = Object.freeze({ legal: SITE_PAGES });

/**
 * The invitation `GET /door` answers, as the door draws it: an open one says whose it is where the platform could name them, and that
 * it brings the direct trial where its holder's coupons are all taken.
 */
export type DoorInvitation = { readonly state: "open"; readonly by?: string; readonly direct?: true } | { readonly state: "lapsed" };

/**
 * Where in the card the person is, from the address the card keeps its screens in: the first screen, a screen of an account that already
 * exists (its code, its other ways, help), or a screen of an account being made.
 */
export type DoorScreen = "first" | "returning" | "new";
const RETURNING = new Set(["factor-one", "factor-two", "client-trust", "reset-password", "reset-password-success", "choose"]);
export const screenOf = (hash: string): DoorScreen => {
  const route = hash.replace(/^#\/?/, "").split(/[/?]/)[0] ?? "";
  return route === "" ? "first" : RETURNING.has(route) ? "returning" : "new";
};

/** The code screen of an account being made, which the vendor gives no way to its help screen, as it gives the returning one. */
export const codeOfNew = (hash: string): boolean => /^#\/?create\/verify-email-address(?:[/?]|$)/.test(hash);

const record = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null;

export const readInvitation = (body: unknown): DoorInvitation | undefined => {
  const held = record(body) && record(body.invitation) ? body.invitation : undefined;
  if (held?.state === "lapsed") return { state: "lapsed" };
  return held?.state === "open" ? { state: "open", ...(typeof held.by === "string" ? { by: held.by } : {}), ...(held.trial === "direct" ? { direct: true as const } : {}) } : undefined;
};

/** `GET /terms`'s direct trial, as the door says it. */
export type DoorTrial = { readonly direct: string; readonly days: number };

export const readTrial = (body: unknown): DoorTrial | undefined => {
  if (!record(body) || !record(body.trial) || typeof body.units_per_dollar !== "number") return undefined;
  const { direct, days } = body.trial;
  if (typeof direct !== "number" || typeof days !== "number") return undefined;
  // Dollars as the site writes them in both languages: Chinese's own currency form would say US$.
  return { direct: formatShown(direct, dollars(body.units_per_dollar), "en"), days };
};

export type DoorNote = { readonly lead: string; readonly more?: string; readonly status: boolean };

/**
 * The note over the card. Why the person is back stands on the first screen only; a note about the invitation stays over an account being
 * made and goes for one that exists. An open invitation whose inviter the platform could not name has nothing to say. A link past its
 * holder's coupons says under the note the trial it brings, where `/terms` answered it.
 */
export function noteFor(language: DoorLanguage, screen: DoorScreen, reason: DoorReason | undefined, invitation: DoorInvitation | undefined, trial?: DoorTrial): DoorNote | undefined {
  if (reason !== undefined) return screen === "first" ? { lead: say(language, `note.${reason}`), status: true } : undefined;
  if (screen === "returning") return undefined;
  if (invitation?.state === "open") {
    if (invitation.by === undefined) return undefined;
    const more = invitation.direct === true && trial !== undefined ? { more: say(language, "note.invited.past", trial) } : {};
    return { lead: say(language, "note.invited", { who: invitation.by }), ...more, status: false };
  }
  return invitation?.state === "lapsed" ? { lead: say(language, "note.lapsed"), status: false } : undefined;
}

/** The vendor's look from the theme's own values, read when the card is mounted, since the vendor derives its shades from them. */
const THEMED = Object.freeze({
  colorPrimary: "--act", colorPrimaryForeground: "--act-ink", colorDanger: "--bad", colorForeground: "--ink", colorMutedForeground: "--quiet", colorMuted: "--wash",
  colorBackground: "--raised", colorInput: "--raised", colorInputForeground: "--ink", colorBorder: "--edge", colorRing: "--act", colorNeutral: "--ink",
  fontFamily: "--font-ui", borderRadius: "--radius",
} as const);
const themed = (win: DoorWindow): Readonly<Record<string, string>> => {
  const style = win.getComputedStyle(win.document.documentElement);
  return Object.fromEntries(Object.entries(THEMED).flatMap(([name, property]) => { const value = style.getPropertyValue(property).trim(); return value === "" ? [] : [[name, value]]; }));
};

/**
 * The vendor's foot and its ways on, set through the vendor's own element option: the caption's size, the quiet colour and the card's room
 * for its "Secured by" line, and the small type, the action colour and the start of the line for 其他方式's and 获取帮助's rows. The option's
 * styles sit in the vendor's layer, under the site's unlayered `a { color: inherit }`, so a link takes its colour from the row it stands in.
 * What the option does not reach stays as the vendor draws it.
 */
const FOOT = Object.freeze({
  footer: {
    margin: 0, padding: "0 var(--space-8) var(--space-6)", borderTop: "none", background: "none", alignItems: "stretch",
    "& > :first-of-type, & > :not(:first-of-type)": { padding: 0, borderTop: "none" },
    // On 其他方式 the foot holds 获取帮助 over the "Secured by" line, a rule between them with the card's room on both sides.
    "& > :not(:first-of-type)": { marginTop: "var(--space-7)", paddingTop: "var(--space-7)", borderTop: "1px solid var(--line)" },
  },
  footerItem: { color: "var(--quiet)", "& p": { margin: 0, color: "inherit", fontSize: "var(--size-caption)", lineHeight: "var(--leading-small)" } },
  footerAction: { margin: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "flex-start", gap: "var(--space-2)", color: "var(--act)", fontSize: "var(--size-small)", lineHeight: "var(--leading-small)" },
  footerActionText: { color: "var(--quiet)", "&:empty": { display: "none" } },
  footerActionLink: { padding: 0, border: "none", background: "none", fontSize: "inherit", fontWeight: "inherit", lineHeight: "inherit", textDecoration: "none" },
});

// `/terms` sums nothing by day but takes a zone, as every read that could does; the trial the door says is the same in any zone.
const TERMS_PATH = "/terms?tz=UTC";

const read = <T>(win: DoorWindow, path: string, reader: (body: unknown) => T | undefined): Promise<T | undefined> =>
  win.fetch(path, { headers: { accept: "application/json" } }).then((answer) => (answer.ok ? answer.json().then(reader) : undefined)).catch(() => undefined);

const byId = (doc: Document, id: string): HTMLElement => {
  const found = doc.getElementById(id);
  if (found === null) throw new Error(`the door's page has no #${id}`);
  return found;
};

export type Door = {
  readonly language: DoorLanguage;
  /** Settles once `/door` has answered, or failed, and the page says what it said. */
  readonly read: Promise<void>;
  /** Mounts the vendor's card once its scripts have run; one line in the card's place if they did not, or its load failed. */
  readonly mount: () => Promise<void>;
};

/**
 * The page around the vendor's card: its language, the note over the card and the lines under it. The page is built in each language and
 * the door speaks the page's; a press on its language menu keeps the one pressed as the product keeps the person's language, so the
 * product opens in the one chosen here. The reason
 * in the address is read once and dropped from it with everything but the language, so a reload does not say it again.
 */
export function openDoor(win: DoorWindow, features: DoorFeatures = FEATURES): Door {
  const doc = win.document;
  const storage = ((): Storage | undefined => { try { return win.localStorage; } catch { return undefined; } })();
  const language: DoorLanguage = doc.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "zh";
  // Opening keeps nothing: a press on the language menu is the one choice the door keeps, so the product follows the browser until then.
  for (const pick of doc.querySelectorAll<HTMLAnchorElement>(".lang-menu a[hreflang]")) {
    const picked: DoorLanguage = pick.hreflang.toLowerCase().startsWith("en") ? "en" : "zh";
    pick.addEventListener("click", () => { try { storage?.setItem(LANGUAGE_KEY, picked); } catch { /* a browser that keeps nothing opens the product in its default */ } });
  }

  const reason = doorReason(win.location.search);
  if (win.location.search !== "") {
    const named = new URLSearchParams(win.location.search).get(LANGUAGE_PARAM);
    win.history.replaceState(win.history.state, "", `${win.location.pathname}${named === null ? "" : `?${new URLSearchParams({ [LANGUAGE_PARAM]: named })}`}${win.location.hash}`);
  }

  const noteSlot = byId(doc, "door-note");
  const underSlot = byId(doc, "door-under");
  const card = byId(doc, "door-card");
  let invitation: DoorInvitation | undefined;
  let trial: DoorTrial | undefined;
  // The fine print speaks of continuing, so it stands with a card to continue in, never beside the line that the card did not load.
  let cardShown = false;
  const draw = (): void => {
    const screen = screenOf(win.location.hash);
    const note = noteFor(language, screen, reason, invitation, trial);
    const box = note === undefined ? undefined : noteBox(doc, note);
    // A note already standing is left standing, so a status is read out once however often the page is drawn.
    if (box?.outerHTML !== noteSlot.firstElementChild?.outerHTML) noteSlot.replaceChildren(...(box === undefined ? [] : [box]));
    underSlot.replaceChildren(
      ...(screen === "first" && cardShown && features.legal !== undefined ? [legalLine(doc, language, features.legal[language])] : []),
      ...(cardShown && codeOfNew(win.location.hash) ? [helpLine(doc, language)] : []),
    );
  };
  draw();
  win.addEventListener("hashchange", draw);
  const readAll = read(win, "/door", (body) => ({ invitation: readInvitation(body) })).then(async (answered) => {
    invitation = answered?.invitation;
    // A link past its holder's coupons brings the direct trial: the page's trial lines drop the invited one, so every figure on it is this
    // visitor's; and the note says that trial, read from `/terms` for this visitor alone.
    if (invitation?.state !== "open" || invitation.direct !== true) { draw(); return; }
    for (const clause of doc.querySelectorAll<HTMLElement>("[data-invited]")) clause.hidden = true;
    trial = await read(win, TERMS_PATH, readTrial);
    draw();
  });

  const mount = async (): Promise<void> => {
    const vendor = win.Clerk;
    const ui = win.__internal_ClerkUICtor;
    try {
      if (vendor === undefined || ui === undefined) throw new Error("the vendor's script did not run");
      const nonce = doc.querySelector<HTMLMetaElement>(`meta[name="${STYLE_NONCE_META}"]`)?.content;
      // The vendor's own styles sit in a cascade layer, so the door's stylesheet draws the card without a contest of specificity.
      await vendor.load({ ui: { ClerkUI: ui }, ...(nonce === undefined ? {} : { nonce }), localization: VENDOR_WORDS[language], appearance: { theme: "simple", cssLayerName: "vendor" }, signInUrl: DOOR_PATH, signUpUrl: DOOR_PATH });
      // Cloudflare's check is 300 px wide at its "normal" and "flexible" sizes, which stood past a phone's card; where the card's column
      // is narrower than that, it takes its "compact" size.
      const captchaSize = (): "flexible" | "compact" => {
        const root = win.getComputedStyle(doc.documentElement);
        const padding = (parseFloat(root.getPropertyValue("--space-8")) || 0) * (parseFloat(root.fontSize) || 16);
        return card.clientWidth - 2 * padding >= 300 ? "flexible" : "compact";
      };
      // The address the person last sent from the first screen, which the card is mounted again with when they come back to change it.
      let kept = "";
      const props = (): Readonly<Record<string, unknown>> => ({
        ...(kept === "" ? {} : { initialValues: { emailAddress: kept } }),
        // Google opens in its own window beside the door, which stays where it is; "auto" would choose that only inside a frame. An
        // account just made has no computer: it goes to the road, which reads the account before it draws, not through the chat page.
        withSignUp: true, routing: "hash", oauthFlow: "popup", fallbackRedirectUrl: "/", signUpFallbackRedirectUrl: ROAD_PATH,
        appearance: { options: { socialButtonsPlacement: "top" }, variables: themed(win), elements: FOOT, captcha: { theme: doc.documentElement.dataset.theme === "dark" ? "dark" : "light", language: language === "zh" ? "zh-cn" : "en", size: captchaSize() } },
      });
      // The vendor gives its first field no keyboard while a social button stands beside it; the door opens with the keyboard there, once, unless
      // the person already put it elsewhere.
      const keyboardIn = new win.MutationObserver(() => {
        const field = card.querySelector<HTMLInputElement>("input.cl-formFieldInput");
        if (field === null) return;
        keyboardIn.disconnect();
        if (doc.activeElement === null || doc.activeElement === doc.body) field.focus();
      });
      keyboardIn.observe(card, { childList: true, subtree: true });
      // Each screen the vendor draws is set as the page draws it: its title one rank under the page's, and its form answered by the card's
      // own lines, in the page's language, rather than by the browser's bubble in the browser's.
      const asDrawn = (): void => {
        for (const title of card.querySelectorAll(".cl-headerTitle:not([aria-level])")) title.setAttribute("aria-level", "2");
        for (const form of card.querySelectorAll<HTMLFormElement>("form:not([novalidate])")) form.noValidate = true;
      };
      // Back from a code screen, by 修改邮箱 or the browser's back, the vendor opens a first screen with the field empty, or a new account's
      // start: the door opens its own first screen again, from the vendor's own mount, the address in the field.
      // The lines of an earlier refusal, hidden as an address is sent, with their words then; none while nothing is sent.
      let sent: Map<HTMLElement, string> | undefined;
      let waited = false;
      card.addEventListener("submit", () => {
        if (screenOf(win.location.hash) !== "first") return;
        kept = card.querySelector<HTMLInputElement>("input.cl-formFieldInput")?.value.trim() ?? "";
        if (kept === "") return;
        // The vendor may ask its bot check before it answers an address, for seconds: the line of an earlier refusal goes at once, and
        // 继续 reads as waiting until the vendor draws its answer, a screen or a line of its own.
        sent = new Map([...card.querySelectorAll<HTMLElement>(".cl-formFieldErrorText")].map((line) => [line, line.textContent ?? ""]));
        for (const line of sent.keys()) line.hidden = true;
        card.querySelector(".cl-formButtonPrimary")?.setAttribute("aria-disabled", "true");
        waited = false;
      }, true);
      let shown = win.location.hash;
      win.addEventListener("hashchange", () => {
        const from = shown;
        shown = win.location.hash;
        const back = screenOf(shown) === "first" || /^#\/?create\/?$/.test(shown);
        if (!back || screenOf(from) === "first" || kept === "") return;
        win.history.replaceState(win.history.state, "", `${win.location.pathname}${win.location.search}`);
        shown = "";
        vendor.unmountSignIn(card);
        vendor.mountSignIn(card, props());
        draw();
      });
      // The vendor's answer to an address sent: another screen, or its line under the field.
      const answered = (): void => {
        if (sent === undefined) return;
        const hidden = sent;
        // The vendor keeps one line under the field: one hidden that now holds other words is its answer.
        for (const [line, words] of hidden) if ((line.textContent ?? "") !== words) line.hidden = false;
        const first = screenOf(win.location.hash) === "first";
        const refused = card.querySelector(".cl-formFieldErrorText:not([hidden])") !== null;
        // A refusal in the same words is the same line drawn again unchanged: the vendor's own wait ending says it was answered.
        const loading = card.querySelector(".cl-formButtonPrimary.cl-loading") !== null;
        if (loading) waited = true;
        if (first && !refused && (loading || !waited)) return;
        sent = undefined;
        card.querySelector(".cl-formButtonPrimary")?.removeAttribute("aria-disabled");
        if (first && !refused) for (const line of hidden.keys()) line.hidden = false;
      };
      new win.MutationObserver(() => { asDrawn(); answered(); }).observe(card, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
      vendor.mountSignIn(card, props());
      cardShown = true;
      draw();
      // The theme's values were read at the mount; when the scheme flips, the card is mounted again in the other set.
      new win.MutationObserver(() => { vendor.unmountSignIn(card); vendor.mountSignIn(card, props()); }).observe(doc.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } catch {
      cardShown = false;
      draw();
      card.replaceChildren(paragraph(doc, "door-failed", say(language, "card.failed")));
    }
  };
  return { language, read: readAll, mount };
}

/** The help screen's own words under the card, the support address a link to write to it. */
function helpLine(doc: Document, language: DoorLanguage): HTMLParagraphElement {
  const words: string = VENDOR_WORDS[language].signIn.alternativeMethods.getHelp.content;
  const [before = "", after = ""] = words.split(SUPPORT);
  const line = paragraph(doc, "door-help", before);
  const link = doc.createElement("a");
  link.href = `mailto:${SUPPORT}`;
  link.textContent = SUPPORT;
  line.append(link, after);
  return line;
}

function paragraph(doc: Document, className: string, words: string): HTMLParagraphElement {
  const p = doc.createElement("p");
  if (className !== "") p.className = className;
  p.textContent = words;
  return p;
}

function noteBox(doc: Document, note: DoorNote): HTMLElement {
  const box = doc.createElement("div");
  box.className = "door-note";
  if (note.status) box.setAttribute("role", "status");
  box.append(paragraph(doc, "door-note-lead", note.lead), ...(note.more === undefined ? [] : [paragraph(doc, "", note.more)]));
  return box;
}

function legalLine(doc: Document, language: DoorLanguage, pages: DoorPages): HTMLElement {
  const link = (which: "terms" | "privacy"): HTMLAnchorElement => { const a = doc.createElement("a"); a.href = pages[which]; a.target = "_blank"; a.rel = "noopener"; a.textContent = say(language, `legal.${which}`); const told = doc.createElement("span"); told.className = "door-unseen"; told.textContent = say(language, "legal.newTab"); a.append(told); return a; };
  const [before = "", between = "", after = ""] = say(language, "legal").split(/\{terms\}|\{privacy\}/);
  const line = paragraph(doc, "door-legal", "");
  line.append(before, link("terms"), between, link("privacy"), after);
  return line;
}
