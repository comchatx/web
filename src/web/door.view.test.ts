// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { STYLE_NONCE_META } from "../shared/door.js";
import { noteFor, openDoor, readInvitation, screenOf, type DoorWindow } from "./door.js";
import { VENDOR_WORDS, LANGUAGE_KEY, say } from "./door-words.js";
import { preferredLanguage } from "./strings.js";

const BODY = /<body[^>]*>([\s\S]*)<\/body>/.exec(readFileSync(join(import.meta.dirname, "site", "login.html"), "utf8"))![1]!;
// The platform still serves the trial: the door has it to hand and says nothing of it.
const TERMS = { units_per_dollar: 1_000_000, trial: { direct: 1_000_000, invited: 5_000_000, days: 7 } };
// 8:00 in whatever zone the test runs in: the hour is the person's own.

const freshPage = (): void => { document.body.innerHTML = BODY; };
beforeEach(freshPage);
afterEach(() => { document.head.replaceChildren(); document.body.replaceChildren(); localStorage.clear(); delete document.documentElement.dataset.theme; document.documentElement.lang = "zh-CN"; });
/** The page the platform serves for the language, as the build writes it: the same body, the `lang` its `<html>` carries. */
const pageIn = (language: "zh" | "en"): void => { document.documentElement.lang = language === "zh" ? "zh-CN" : "en"; };

type Vendor = { load: ReturnType<typeof vi.fn>; mountSignIn: ReturnType<typeof vi.fn>; unmountSignIn: ReturnType<typeof vi.fn> };
const vendorOf = (): Vendor => ({ load: vi.fn(async () => undefined), mountSignIn: vi.fn(), unmountSignIn: vi.fn() });
const answer = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Options = { search?: string; door?: Response | Error; vendor?: Vendor | undefined; ui?: unknown };
function doorWindow(options: Options = {}) {
  const location = { pathname: "/login", search: options.search ?? "", hash: "", reload: vi.fn() };
  const history = { state: null, replaceState: vi.fn((_state: unknown, _title: string, to: string) => { const url = new URL(to, "https://x.example"); location.search = url.search; location.hash = url.hash; }) };
  const fetch = vi.fn(async (path: string) => {
    const said = path === "/door" ? options.door ?? answer(200, {}) : path === "/terms?tz=UTC" ? answer(200, TERMS) : answer(404, {});
    if (said instanceof Error) throw said;
    return said;
  });
  const win = Object.assign(Object.create(window) as DoorWindow, {
    document, location, history, fetch, localStorage,
    addEventListener: window.addEventListener.bind(window), getComputedStyle: window.getComputedStyle.bind(window), MutationObserver: window.MutationObserver,
    Clerk: "vendor" in options ? options.vendor : vendorOf(), __internal_ClerkUICtor: "ui" in options ? options.ui : class {},
  });
  return { win, location, history, fetch };
}
const text = (id: string): string => document.getElementById(id)!.textContent ?? "";
const hashTo = (location: { hash: string }, hash: string): void => { location.hash = hash; window.dispatchEvent(new Event("hashchange")); };
const loaded = (vendor: Vendor): Record<string, unknown> => vendor.load.mock.calls[0]![0] as Record<string, unknown>;

/** Every leaf's path in a localization object. */
const leaves = (node: unknown, at = ""): string[] =>
  typeof node === "object" && node !== null ? Object.entries(node).flatMap(([key, value]) => leaves(value, at === "" ? key : `${at}.${key}`)) : [at];

it("loads the vendor with its UI, the response's nonce, the language's words and its styles in a layer, and mounts one card for both ways in", async () => {
  const vendor = vendorOf();
  const ui = class {};
  document.head.innerHTML = `<meta name="${STYLE_NONCE_META}" content="AAAAAAAAAAAAAAAAAAAAAA==">`;
  document.documentElement.dataset.theme = "dark";
  await openDoor(doorWindow({ vendor, ui }).win).mount();
  expect(vendor.load.mock.calls).toEqual([[{ ui: { ClerkUI: ui }, nonce: "AAAAAAAAAAAAAAAAAAAAAA==", localization: VENDOR_WORDS.zh, appearance: { theme: "simple", cssLayerName: "vendor" }, signInUrl: "/login", signUpUrl: "/login" }]]);
  const [[node, props]] = vendor.mountSignIn.mock.calls as [[HTMLElement, Record<string, unknown>]];
  expect(node).toBe(document.getElementById("door-card"));
  expect(props).toMatchObject({ withSignUp: true, routing: "hash", oauthFlow: "popup", fallbackRedirectUrl: "/", signUpFallbackRedirectUrl: "/start", appearance: { options: { socialButtonsPlacement: "top" }, captcha: { theme: "dark", language: "zh-cn", size: "compact" } } });
  expect(props.appearance).not.toHaveProperty("layout");
  // The foot's option is a link as the door's others are: the vendor is asked for no underline, at rest or under the pointer.
  expect((props.appearance as { elements: { footerActionLink: unknown } }).elements.footerActionLink).toMatchObject({ textDecoration: "none" });
  expect(JSON.stringify((props.appearance as { elements: unknown }).elements)).not.toMatch(/underline|textDecorationThickness/);
});

it("sends no way to sign in or up off this origin: every address the vendor is given is the door's or the app's own path", async () => {
  const vendor = vendorOf();
  await openDoor(doorWindow({ vendor }).win).mount();
  const given = [loaded(vendor), vendor.mountSignIn.mock.calls[0]![1] as Record<string, unknown>].flatMap((options) => Object.entries(options));
  const addresses = given.filter(([key]) => /url$/i.test(key));
  expect(addresses.map(([key]) => key).sort()).toEqual(["fallbackRedirectUrl", "signInUrl", "signUpFallbackRedirectUrl", "signUpUrl"]);
  for (const [, address] of addresses) expect(address).toMatch(/^\/(login|start)?$/);
});

it("passes the Chinese door every key the drawing's Chinese holds, and the English door the same keys", async () => {
  const vendor = vendorOf();
  await openDoor(doorWindow({ vendor }).win).mount();
  expect(leaves(loaded(vendor).localization)).toEqual(leaves(VENDOR_WORDS.zh));
  expect(leaves(VENDOR_WORDS.zh)).toHaveLength(47);
  expect(leaves(VENDOR_WORDS.en)).toEqual(leaves(VENDOR_WORDS.zh));
  pageIn("en");
  const english = vendorOf();
  await openDoor(doorWindow({ vendor: english }).win).mount();
  expect(loaded(english).localization).toBe(VENDOR_WORDS.en);
});

it("opens with the keyboard in the card's first field once it is drawn, and only then", async () => {
  const vendor = vendorOf();
  const field = (): HTMLInputElement => Object.assign(document.createElement("input"), { className: "cl-formFieldInput" });
  vendor.mountSignIn.mockImplementation((node: HTMLElement) => { node.append(field()); });
  await openDoor(doorWindow({ vendor }).win).mount();
  await vi.waitFor(() => expect(document.activeElement).toBe(document.querySelector("#door-card input")));
  document.getElementById("door-card")!.append(field());
  await new Promise((settle) => setTimeout(settle, 0));
  expect(document.activeElement).toBe(document.querySelector("#door-card input"));
});

it("leaves the keyboard where the person put it before the card was drawn", async () => {
  const vendor = vendorOf();
  vendor.mountSignIn.mockImplementation((node: HTMLElement) => { node.append(Object.assign(document.createElement("input"), { className: "cl-formFieldInput" })); });
  const door = openDoor(doorWindow({ vendor }).win);
  document.querySelector<HTMLButtonElement>(".lang-switch button")!.focus();
  await door.mount();
  await new Promise((settle) => setTimeout(settle, 0));
  expect(document.activeElement).toBe(document.querySelector(".lang-switch button"));
});

it("mounts the card again in the other set when the scheme flips", async () => {
  const vendor = vendorOf();
  document.documentElement.dataset.theme = "light";
  await openDoor(doorWindow({ vendor }).win).mount();
  document.documentElement.dataset.theme = "dark";
  await new Promise((settle) => setTimeout(settle, 0));
  expect(vendor.unmountSignIn).toHaveBeenCalledWith(document.getElementById("door-card"));
  expect(vendor.mountSignIn.mock.calls.map(([, props]) => (props as { appearance: { captcha: { theme: string } } }).appearance.captcha.theme)).toEqual(["light", "dark"]);
});

it("leaves one line in the card's place, and nothing else, when a vendor script was blocked or its load failed", async () => {
  for (const options of [{ vendor: undefined }, { ui: undefined }, { vendor: { ...vendorOf(), load: vi.fn(async () => { throw new Error("offline"); }) } }]) {
    freshPage();
    await openDoor(doorWindow(options).win).mount();
    expect(document.getElementById("door-card")!.innerHTML).toBe(`<p class="door-failed">${say("zh", "card.failed")}</p>`);
  }
});

it("holds nothing in the card's place while the card loads: no line, spinner or picture before the vendor mounts", () => {
  openDoor(doorWindow().win);
  expect(document.getElementById("door-card")!.childNodes).toHaveLength(0);
});

const START = readFileSync(join(import.meta.dirname, "site", "door-start.js"), "utf8");
/**
 * A visit to the door's address in a browser whose languages are `browser`, holding `kept`: the platform serves the page `?lang=` names,
 * the door's first script moves it where it moves it, and the door opens on the page it lands on. What the page speaks, and what is kept.
 */
function visit(address: string, kept: string | null, browser: readonly string[]): { readonly page: "zh" | "en"; readonly kept: string | null } {
  localStorage.clear();
  if (kept !== null) localStorage.setItem(LANGUAGE_KEY, kept);
  return land(address, browser);
}
/** The same from wherever this browser stands, keeping what it holds. */
function land(address: string, browser: readonly string[]): { readonly page: "zh" | "en"; readonly kept: string | null } {
  let at = new URL(address, "https://comchatx.com");
  for (let hops = 0; hops < 3; hops += 1) {
    const served = at.searchParams.get("lang") === "en" ? "en" : "zh";
    let moved: string | undefined;
    runInNewContext(START, {
      URLSearchParams, navigator: { languages: browser },
      document: { documentElement: { lang: served === "en" ? "en" : "zh-CN", classList: { add: () => undefined } } },
      location: { pathname: at.pathname, search: at.search, hash: at.hash, replace: (to: string) => { moved = to; } },
      localStorage, sessionStorage: { getItem: () => "1", setItem: () => undefined },
    });
    if (moved !== undefined) { at = new URL(moved, at); continue; }
    freshPage();
    pageIn(served);
    return { page: openDoor(doorWindow({ search: at.search }).win).language, kept: localStorage.getItem(LANGUAGE_KEY) };
  }
  throw new Error("the door's first script moved the page more than once");
}
const STARTS = [[null, ["zh-CN"]], [null, ["en-US"]], ["zh", ["en-US"]], ["en", ["zh-CN"]]] as const;

it("opens the door at an address that names no language as the product opens, the person's own choice else the browser's first language, and keeps nothing", () => {
  // [kept before, the browser's languages, the page, kept after]
  const table: readonly (readonly [string | null, readonly string[], "zh" | "en", string | null])[] = [
    [null, ["zh-CN", "en"], "zh", null],
    [null, ["zh-TW"], "zh", null],
    [null, ["en-US", "zh-CN"], "en", null],
    [null, ["ja"], "en", null],
    [null, [], "en", null],
    ["en", ["zh-CN"], "en", "en"],
    ["zh", ["en-US"], "zh", "zh"],
  ];
  const opened = table.map(([kept, browser]) => {
    const seen = visit("/login", kept, browser);
    // The app's own rule, read as the app reads it, over what the door left.
    return [kept, browser, seen.page, seen.kept, preferredLanguage(seen.kept, browser)];
  });
  expect(opened).toEqual(table.map(([kept, browser, page, after]) => [kept, browser, page, after, page]));
});

it("opens the page an address names, the page's own ways in among them, and keeps nothing: the app goes on as it went", () => {
  const ways = [...new Set([...document.querySelectorAll<HTMLAnchorElement>("a.way-in")].map((a) => a.getAttribute("href")!))];
  expect(ways).toEqual(["/login?lang=zh"]);
  for (const address of [...ways, "/login?lang=en", "/login?lang=zh&door=expired"]) {
    for (const [kept, browser] of STARTS) {
      const seen = visit(address, kept, browser);
      expect([address, kept, seen.page, seen.kept, preferredLanguage(seen.kept, browser)])
        .toEqual([address, kept, address.includes("lang=en") ? "en" : "zh", kept, preferredLanguage(kept, browser)]);
    }
  }
});

it("keeps the language pressed on the door's menu, over whatever was kept and whatever the browser says, and the app opens in it", () => {
  for (const [kept, browser] of STARTS) {
    for (const hreflang of ["en", "zh-CN"] as const) {
      const before = visit("/login", kept, browser);
      const pick = document.querySelector<HTMLAnchorElement>(`.lang-menu a[hreflang="${hreflang}"]`)!;
      pick.addEventListener("click", (event) => event.preventDefault(), { once: true });
      pick.click();
      const after = land(pick.getAttribute("href")!, browser);
      const pressed = hreflang === "en" ? "en" : "zh";
      expect([kept, browser, before.kept, after.page, after.kept, preferredLanguage(after.kept, browser)]).toEqual([kept, browser, kept, pressed, pressed, pressed]);
    }
  }
});

it("switches language by the page's own links, each naming its language in the door's address", () => {
  const links = [...document.querySelectorAll<HTMLAnchorElement>(".lang-menu a")].map((a) => [a.getAttribute("hreflang"), a.getAttribute("href")]);
  expect(links).toEqual([["zh-CN", "/login?lang=zh"], ["en", "/login?lang=en"]]);
});

it("draws no sentence about the trial in any state of the door, in either language, and asks for no terms", async () => {
  const BY = "che***@chenhome.example";
  const invitations = [
    [undefined, ["", ""]], [{ state: "open", by: BY }, [`${BY} 邀请你使\u2060用 ComChatX`, `${BY} invited you to ComChatX`]], [{ state: "open" }, ["", ""]],
    [{ state: "lapsed" }, ["该邀请链接已失效", "This invitation link no longer works"]],
  ] as const;
  for (const [invitation, leads] of invitations)
    for (const [index, language] of (["zh", "en"] as const).entries()) {
      freshPage();
      pageIn(language);
      const { win, location, fetch } = doorWindow({ door: answer(200, invitation === undefined ? {} : { invitation }) });
      const door = openDoor(win);
      await door.read;
      await door.mount();
      const label = `${JSON.stringify(invitation)} ${language}`;
      // The words keep a name and what follows it together with no-break spaces.
      expect(text("door-note").replace(/\u00a0/g, " "), label).toBe(leads[index]);
      // What the door says: the page around it is the site's homepage, whose plans and questions are the site's own words.
      for (const hash of ["", "#/create/verify-email-address"]) {
        hashTo(location, hash);
        const page = document.querySelector(".door-column")!.textContent ?? "";
        for (const promise of ["名额", "明日", "8:00", "试用余额", "trial balance", "$", "places"]) expect(page, label).not.toContain(promise);
      }
      expect(fetch.mock.calls.map(([path]) => path), label).toEqual(["/door"]);
    }
  expect(readInvitation({})).toBeUndefined();
});

it("draws a lapsed invitation's note, and nothing for a state the platform does not say: a member's link past its coupons is open", () => {
  expect(readInvitation({ invitation: { state: "used" } })).toBeUndefined();
  expect(noteFor("en", "first", undefined, { state: "lapsed" })).toEqual({ lead: "This invitation link no longer works", status: false });
});

/** A line as the visitor reads it: what the door hid is not read. */
const shown = (node: Element): string => { const copy = node.cloneNode(true) as Element; for (const gone of copy.querySelectorAll("[hidden]")) gone.remove(); return (copy.textContent ?? "").replace(/\s+/g, " ").trim(); };
const trialLines = (): readonly string[] => [shown(document.querySelector(".trial-words")!), shown([...document.querySelectorAll(".faq-a p")].find((one) => /\$1\.00/.test(one.textContent ?? ""))!)];

it("says only the direct trial on a page opened by a member's link past its coupons, its note as for any open link, in both languages", async () => {
  const BY = "wang***@wangshop.example";
  const pages = { zh: BODY, en: /<body[^>]*>([\s\S]*)<\/body>/.exec(readFileSync(join(import.meta.dirname, "site", "login.en.html"), "utf8"))![1]! };
  const said = {
    zh: { invited: ["直接注册送 $1.00 试用余额，通过邀请链接注册送 $5.00，7 天内有效，每个账户只送一次", expect.stringContaining("。直接注册赠 $1.00 试用余额，凭邀请注册赠 $5.00，7 天内有效。")],
      direct: ["注册送 $1.00 试用余额，7 天内有效，每个账户只送一次", expect.stringContaining("。注册赠 $1.00 试用余额，7 天内有效。")] },
    en: { invited: ["$1.00 of trial balance when you sign up directly, or $5.00 through an invitation link, good for 7 days, once per account", expect.stringContaining(" Signing up directly gives you $1.00 of trial balance, and signing up with an invitation gives you $5.00, good for 7 days.")],
      direct: ["$1.00 of trial balance when you sign up, good for 7 days, once per account", expect.stringContaining(" Signing up gives you $1.00 of trial balance, good for 7 days.")] },
  } as const;
  for (const language of ["zh", "en"] as const)
    for (const trial of [undefined, "invited", "direct"] as const) {
      document.body.innerHTML = pages[language];
      pageIn(language);
      const { win } = doorWindow({ door: answer(200, { invitation: { state: "open", by: BY, ...(trial === undefined ? {} : { trial }) } }) });
      await openDoor(win).read;
      expect(trialLines(), `${language} ${trial}`).toEqual(said[language][trial === "direct" ? "direct" : "invited"]);
      const lines = [...document.querySelectorAll("#door-note p")].map((one) => one.textContent);
      const lead = say(language, "note.invited", { who: BY });
      const past = say(language, "note.invited.past", { direct: "$1.00", days: 7 });
      expect(past.replace(/\u2060/g, "").replace(/\u00a0/g, " ")).toBe(language === "zh" ? "注册可获得 $1.00 试用余额，7 天内有效。" : "Signing up gives you $1.00 of trial balance, good for 7 days.");
      expect(lines, `${language} ${trial}`).toEqual(trial === "direct" ? [lead, past] : [lead]);
    }
  // The figures are the platform's: a trial `/terms` does not answer is not said, and the page's lines still drop the invited clause.
  const PAST = answer(200, { invitation: { state: "open", by: BY, trial: "direct" } });
  freshPage();
  pageIn("zh");
  const bigger = doorWindow({ door: PAST });
  bigger.fetch.mockImplementation(async (path: string) => (path === "/door" ? PAST.clone() : answer(200, { units_per_dollar: 1_000_000, trial: { direct: 2_500_000, invited: 9_000_000, days: 14 } })));
  await openDoor(bigger.win).read;
  expect([...document.querySelectorAll("#door-note p")].map((one) => one.textContent)).toEqual([say("zh", "note.invited", { who: BY }), say("zh", "note.invited.past", { direct: "$2.50", days: 14 })]);
  freshPage();
  const unread = doorWindow({ door: PAST.clone() });
  unread.fetch.mockImplementation(async (path: string) => (path === "/door" ? PAST.clone() : answer(503, {})));
  await openDoor(unread.win).read;
  expect([...document.querySelectorAll("#door-note p")].map((one) => one.textContent)).toEqual([say("zh", "note.invited", { who: BY })]);
  expect(trialLines()[0]).toBe("注册送 $1.00 试用余额，7 天内有效，每个账户只送一次");
  // A lapsed link, or none, leaves the page's lines as signed.
  for (const door of [{ invitation: { state: "lapsed", trial: "direct" } }, {}]) {
    freshPage();
    await openDoor(doorWindow({ door: answer(200, door) }).win).read;
    expect(trialLines()).toEqual(said.zh.invited);
  }
  expect(readInvitation({ invitation: { state: "open", trial: "direct" } })).toEqual({ state: "open", direct: true });
  expect(readInvitation({ invitation: { state: "open", trial: "invited" } })).toEqual({ state: "open" });
});

it("keeps an invitation's note over an account being made and drops it for one that exists", async () => {
  const { win, location } = doorWindow({ door: answer(200, { invitation: { state: "lapsed" } }) });
  await openDoor(win).read;
  expect(text("door-note")).toBe("该邀请链接已失效");
  hashTo(location, "#/create/verify-email-address");
  expect(text("door-note")).toBe("该邀请链接已失效");
  hashTo(location, "#/factor-one");
  expect(text("door-note")).toBe("");
  expect([screenOf(""), screenOf("#/"), screenOf("#/factor-two?x=1"), screenOf("#/sso-callback")]).toEqual(["first", "first", "returning", "new"]);
});

it("says why the person is back once, as a status, on the first screen only, and drops it from the address", async () => {
  for (const [reason, words] of [["signed-out", "你已退出登录。"], ["signed-out-all", "你已在所有设备上退出登录。"], ["expired", "登录已过期，请重新登录。"], ["deleted", "账户已删除。"]] as const) {
    freshPage();
    const { win, location, history } = doorWindow({ search: `?door=${reason}` });
    const door = openDoor(win);
    const said = document.querySelector("#door-note [role=status]");
    await door.read;
    expect(document.querySelector("#door-note [role=status]")).toBe(said);
    expect(history.replaceState).toHaveBeenCalledWith(null, "", "/login");
    expect(document.querySelector("#door-note [role=status]")?.textContent).toBe(words);
    expect(text("door-under")).toBe("");
    hashTo(location, "#/factor-one");
    expect(text("door-note")).toBe("");
  }
});

it("keeps the language the address names when it drops the reason, so a reload opens the same page", () => {
  const { win, history } = doorWindow({ search: "?door=expired&lang=en&other=1" });
  openDoor(win);
  expect(history.replaceState).toHaveBeenCalledWith(null, "", "/login?lang=en");
});

it("says no note when the platform did not answer", async () => {
  for (const door of [new Error("offline"), answer(503, {}), answer(200, { invitation: { state: "unknown" } })]) {
    freshPage();
    await openDoor(doorWindow({ door }).win).read;
    expect(text("door-note")).toBe("");
  }
  expect(readInvitation(null)).toBeUndefined();
});

it("prints the fine print under the first screen once the card stands, linked to the site's pages in the page's language, and none where the feature is off", async () => {
  const { win, location } = doorWindow();
  const door = openDoor(win);
  await door.read;
  expect(document.querySelector(".door-legal")).toBeNull();
  await door.mount();
  const legal = document.querySelector(".door-legal")!;
  expect(legal.textContent).toBe("继续即表示你同意《服务条款》（在新标签页打开）和《隐私政策》（在新标签页打开）。");
  expect([...legal.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["https://www.comchatx.com/terms/", "https://www.comchatx.com/privacy/"]);
  // Both leave the door standing, and say so only to a screen reader.
  expect([...legal.querySelectorAll("a")].map((a) => [a.target, a.rel, a.querySelector(".door-unseen")?.textContent])).toEqual([["_blank", "noopener", "（在新标签页打开）"], ["_blank", "noopener", "（在新标签页打开）"]]);
  hashTo(location, "#/create/verify-email-address");
  expect(document.querySelector(".door-legal")).toBeNull();
  freshPage();
  pageIn("en");
  const english = openDoor(doorWindow().win);
  await english.read;
  await english.mount();
  const englishLine = document.querySelector(".door-legal")!;
  expect(englishLine.textContent).toBe("By continuing, you agree to the Terms of Service (Opens in a new tab) and the Privacy Policy (Opens in a new tab).");
  expect([...englishLine.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["https://www.comchatx.com/en/terms/", "https://www.comchatx.com/en/privacy/"]);
  freshPage();
  const off = openDoor(doorWindow().win, {});
  await off.read;
  await off.mount();
  expect(document.querySelector(".door-legal")).toBeNull();
});

it("keeps the fine print back while the card did not load: it waits with the card", async () => {
  for (const options of [{ vendor: undefined }, { vendor: Object.assign(vendorOf(), { load: vi.fn(async () => { throw new Error("blocked"); }) }) }]) {
    freshPage();
    const door = openDoor(doorWindow(options).win);
    await door.read;
    await door.mount();
    expect(document.querySelector(".door-failed")?.textContent).toBe("登录框加载失败，请刷新页面。");
    expect(document.querySelector(".door-legal")).toBeNull();
  }
});

it("sets each screen the vendor draws one rank under the page's title, and answers its form by the card's own lines rather than the browser's", async () => {
  const vendor = vendorOf();
  const screen = (title: string): string => `<div class="cl-rootBox"><h1 class="cl-headerTitle">${title}</h1><form class="cl-form"><input class="cl-formFieldInput" type="email" required></form></div>`;
  vendor.mountSignIn.mockImplementation((node: HTMLElement) => { node.innerHTML = screen("登录 ComChatX"); });
  await openDoor(doorWindow({ vendor }).win).mount();
  const card = document.getElementById("door-card")!;
  await vi.waitFor(() => expect(card.querySelector(".cl-headerTitle")!.getAttribute("aria-level")).toBe("2"));
  expect(card.querySelector("form")!.noValidate).toBe(true);
  // The next screen is drawn anew, and is set the same way.
  card.innerHTML = screen("输入验证码");
  await vi.waitFor(() => expect(card.querySelector(".cl-headerTitle")!.getAttribute("aria-level")).toBe("2"));
  expect(card.querySelector("form")!.hasAttribute("novalidate")).toBe(true);
});

it("gives Cloudflare's check the card's width where the card has room for it, and its compact size where it has not", async () => {
  for (const [width, size] of [[480, "flexible"], [364, "flexible"], [322, "compact"]] as const) {
    freshPage();
    document.documentElement.style.setProperty("--space-8", "2rem");
    Object.defineProperty(document.getElementById("door-card")!, "clientWidth", { value: width });
    const vendor = vendorOf();
    await openDoor(doorWindow({ vendor }).win).mount();
    expect((vendor.mountSignIn.mock.calls[0]![1] as { appearance: { captcha: { size: string } } }).appearance.captcha.size, String(width)).toBe(size);
  }
  document.documentElement.style.removeProperty("--space-8");
});

it("gives a new account's code screen the way to help the returning one has: the help screen's words under the card, its address a link", async () => {
  const { win, location } = doorWindow();
  await openDoor(win).mount();
  hashTo(location, "#/create/verify-email-address");
  const help = document.querySelector("#door-under .door-help")!;
  expect(help.textContent).toBe(VENDOR_WORDS.zh.signIn.alternativeMethods.getHelp.content);
  expect(help.querySelector("a")?.getAttribute("href")).toBe("mailto:support@comchatx.com");
  for (const hash of ["", "#/factor-one", "#/create"]) {
    hashTo(location, hash);
    expect(document.querySelector(".door-help"), hash).toBeNull();
  }
});

it("opens the first screen again with the address the person sent in it, when they come back from a code screen", async () => {
  const vendor = vendorOf();
  vendor.mountSignIn.mockImplementation((node: HTMLElement, props: { initialValues?: { emailAddress?: string } }) => {
    node.innerHTML = `<form><input class="cl-formFieldInput" value="${props.initialValues?.emailAddress ?? ""}"></form>`;
  });
  const { win, location, history } = doorWindow({ vendor });
  await openDoor(win).mount();
  const send = (address: string): void => {
    document.querySelector<HTMLInputElement>(".cl-formFieldInput")!.value = address;
    document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };
  // Nothing to keep before the person sent an address: the vendor's own first screen stands.
  hashTo(location, "#/factor-one");
  hashTo(location, "");
  expect(vendor.mountSignIn).toHaveBeenCalledTimes(1);
  for (const [code, back] of [["#/factor-one", ""], ["#/create/verify-email-address", "#/create"], ["#/create/verify-email-address", "#/"]] as const) {
    send(" wang.lei@chenhome.example ");
    hashTo(location, code);
    const mounts = vendor.mountSignIn.mock.calls.length;
    hashTo(location, back);
    await new Promise((settle) => setTimeout(settle, 0));
    expect(vendor.unmountSignIn).toHaveBeenCalledTimes(mounts);
    expect(vendor.mountSignIn.mock.calls.at(-1)![1]).toMatchObject({ initialValues: { emailAddress: "wang.lei@chenhome.example" } });
    expect([location.hash, history.replaceState.mock.calls.at(-1)![2]], back).toEqual(["", "/login"]);
    expect(document.querySelector<HTMLInputElement>(".cl-formFieldInput")!.value, back).toBe("wang.lei@chenhome.example");
  }
});

it("answers an address sent at once: the earlier refusal goes and 继续 waits until the vendor's refusal or its next screen", async () => {
  const vendor = vendorOf();
  vendor.mountSignIn.mockImplementation((node: HTMLElement) => {
    node.innerHTML = `<form><input class="cl-formFieldInput"><p class="cl-formFieldErrorText">请输入邮箱。</p><button class="cl-formButtonPrimary">继续</button></form>`;
  });
  const { win, location } = doorWindow({ vendor });
  await openDoor(win).mount();
  const field = document.querySelector<HTMLInputElement>(".cl-formFieldInput")!;
  const button = document.querySelector<HTMLButtonElement>(".cl-formButtonPrimary")!;
  const settle = (): Promise<void> => new Promise((done) => setTimeout(done, 0));
  const send = async (address: string): Promise<void> => {
    field.value = address;
    document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
  };
  const state = (): readonly unknown[] => [[...document.querySelectorAll<HTMLElement>(".cl-formFieldErrorText")].filter((one) => !one.hidden).map((one) => one.textContent), button.getAttribute("aria-disabled")];
  await send("abc");
  const waiting = state();
  // The vendor answers in its one line under the field, its words changed.
  document.querySelector(".cl-formFieldErrorText")!.textContent = "请输入正确的邮箱地址。";
  await settle();
  const refused = state();
  // A refusal in the same words: the vendor draws its own wait and ends it, and its line stands again.
  await send("abc");
  button.classList.add("cl-loading");
  await settle();
  button.classList.remove("cl-loading");
  await settle();
  const again = state();
  await send("wang.lei@chenhome.example");
  hashTo(location, "#/factor-one");
  document.querySelector("form")!.append(document.createElement("div"));
  await settle();
  expect([waiting, refused, again, button.getAttribute("aria-disabled")]).toEqual([
    [[], "true"], [["请输入正确的邮箱地址。"], null], [["请输入正确的邮箱地址。"], null], null]);
});

it("sets the vendor's foot and its ways on through the vendor's own element option", async () => {
  const vendor = vendorOf();
  await openDoor(doorWindow({ vendor }).win).mount();
  const elements = (vendor.mountSignIn.mock.calls[0]![1] as { appearance: { elements: Record<string, unknown> } }).appearance.elements;
  expect(Object.keys(elements).sort()).toEqual(["footer", "footerAction", "footerActionLink", "footerActionText", "footerItem"]);
  expect(elements.footerItem).toMatchObject({ color: "var(--quiet)", "& p": { fontSize: "var(--size-caption)" } });
});
