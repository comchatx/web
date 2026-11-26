// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import type { DialogAnswer } from "../shared/dialog.js";
import type { SignInStep } from "../shared/sign-in.js";
import { FIRST_RELEASE, SignInEnded, type Account, type Backend, type Features, type Me, type SignInPorts } from "./backend.js";
import { cardWords } from "../shared/maker-words.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { makerRecords } from "./catalogue.js";
import { stepsIn } from "./plugins-model.js";
import { PluginsPage } from "./plugins-page.js";
import { appRegion, listOf } from "./plugins-test-kit.js";
import { signInCard, type SignInCard, type SignInCardPorts } from "./sign-in-card.js";
import { text, type StringKey } from "./strings.js";

const say = (key: StringKey, values?: Readonly<Record<string, string | number>>): string => text("en", key, values);
const MARKUP = '<img src=x onerror="alert(1)"><b>WXYZ</b>';
const STOP = "http://127.0.0.1:1455/auth/callback";
const ADDRESS: SignInStep = { kind: "link", id: "openai:1", url: "https://auth.openai.com/oauth/authorize?state=s", minutes: 5, paste: "address", stop: STOP };
const ASK_ADDRESS: SignInStep = { kind: "ask", masked: false, paste: "address", dialog: { id: "openai:2", method: "input", title: "Paste the authorization code (or full redirect URL):" } };
const CODE: SignInStep = { kind: "link", id: "anthropic:1", url: "https://claude.ai/oauth/authorize?state=s", minutes: 15, paste: "code" };
const DEVICE: SignInStep = { kind: "code", id: "kimi:1", code: "WXYZ-1234", url: "https://www.kimi.com/code/authorize_device?user_code=WXYZ-1234", minutes: 15 };

afterEach(() => { document.body.replaceChildren(); });

/** The card alone, its ports counted. */
function drawn(card: Partial<SignInCard>) {
  const calls: string[] = [];
  const ports: SignInCardPorts = {
    say, typed: (value) => calls.push(`typed ${value}`), submit: () => calls.push("submit"), cancel: () => calls.push("cancel"),
    dialog: { say, answer: async (id: string, answer: DialogAnswer) => { calls.push(`answer ${id} ${JSON.stringify(answer)}`); return true; } },
  };
  const element = signInCard({ name: "ChatGPT", typed: "", sending: false, ...card }, ports);
  document.body.replaceChildren(element);
  const parts = (): string[] => [...element.querySelectorAll("p, input, a, button, code")].map((one) =>
    one.tagName === "INPUT" ? `input ${(one as HTMLInputElement).type} ${(one as HTMLInputElement).placeholder}` : `${one.tagName.toLowerCase()} ${one.textContent ?? ""}`);
  return { element, calls, parts };
}

const ONE_CARD = [
  "p Finish signing in within 5 minutes.",
  "a Sign in at auth.openai.com",
  "p After you sign in, the browser stops on a page that won't open. That means the sign-in worked.",
  "p Copy the whole address from the address bar, then come back and paste it here.",
  "input text Paste the address", "button Sign in", "button Cancel", "p "];

it("draws a sign-in that takes its address back as one card from its opening, with the platform's words where its package declares none: the limit, three numbered steps, Sign in and Cancel", () => {
  const { element, parts } = drawn({ link: ADDRESS, ask: ASK_ADDRESS });
  expect(parts()).toEqual(ONE_CARD);
  expect([...element.querySelectorAll(".dialog-acts > button")].map((one) => [one.textContent, one.className]), "the set's buttons").toEqual([["Sign in", "f-btn primary"], ["Cancel", "f-btn"]]);
  const steps = [...element.querySelectorAll("ol.sign-in-steps > li")];
  expect(steps.map((step) => [...step.children].map((one) => one.tagName.toLowerCase() + (one.className === "" ? "" : `.${one.className.split(" ")[0]}`))))
    .toEqual([["a.button"], ["p", "div.sign-in-stop"], ["p", "input"]]);
  const go = element.querySelector("a")!;
  expect([go.getAttribute("href"), go.target, go.rel]).toEqual([ADDRESS.kind === "link" ? ADDRESS.url : "", "_blank", "noopener noreferrer"]);
  // The page the browser stops on: a picture a screen reader skips, its address selected, with nothing in it to press or type in.
  const picture = element.querySelector<HTMLElement>(".sign-in-stop")!;
  expect([picture.getAttribute("aria-hidden"), picture.querySelector(".sign-in-stop-selected")!.textContent, picture.querySelectorAll("a, button, input").length, picture.querySelector("svg.pl-icon") !== null])
    .toEqual(["true", "http://127.0.0.1:1455/auth/callback?code=…", 0, true]);
  // The field is described by the step over it; nothing is in bold.
  expect([element.querySelector("input")!.getAttribute("aria-describedby"), element.querySelector("#sign-in-step-3")!.textContent, element.querySelector("strong")])
    .toEqual(["sign-in-step-3 sign-in-note", "Copy the whole address from the address bar, then come back and paste it here.", null]);
  expect(element.getAttribute("aria-label")).toBe("Sign in to ChatGPT");
  // pi's own words on the way are not drawn: the card says the step.
  expect(element.textContent).not.toContain("redirect URL");
  const zh = signInCard({ name: "ChatGPT", typed: "", sending: false, link: ADDRESS, ask: ASK_ADDRESS }, { say: (key, values) => text("zh", key, values), typed: () => {}, submit: () => {}, cancel: () => {}, dialog: { say, answer: async () => true } });
  expect([...zh.querySelectorAll("li > p")].map((one) => one.textContent)).toEqual(["登录后，浏览器会停在一个无法打开的页面，这表示登录已成功。", "复制地址栏里的完整网址，回到这里粘贴。"]);
});

it("moves the keyboard to the field on the link's press, by a click, a middle click or Enter's click, and changes nothing drawn", () => {
  for (const press of [new MouseEvent("click", { bubbles: true, cancelable: true }), new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true })]) {
    const { element, calls, parts } = drawn({ link: ADDRESS, ask: ASK_ADDRESS });
    const go = element.querySelector("a")!;
    go.focus();
    go.addEventListener(press.type, (event) => event.preventDefault(), { once: true });
    expect(go.dispatchEvent(press)).toBe(false);
    expect([document.activeElement, parts(), calls], press.type).toEqual([element.querySelector("input"), ONE_CARD, []]);
  }
  const right = drawn({ link: ADDRESS, ask: ASK_ADDRESS });
  const go = right.element.querySelector("a")!;
  go.focus();
  go.dispatchEvent(new MouseEvent("auxclick", { button: 2, bubbles: true }));
  expect([document.activeElement, right.calls]).toEqual([go, []]);
});

it("draws the steps a package declares, in its order and its words as text, each kind by what the flow gave, in place of the platform's", () => {
  const declared = drawn({ link: ADDRESS, ask: ASK_ADDRESS, steps: [{ kind: "address", line: MARKUP }, { kind: "link" }, { kind: "field", line: "Paste it." }] });
  expect(declared.parts()).toEqual(["p Finish signing in within 5 minutes.", `p ${MARKUP}`, "a Sign in at auth.openai.com", "p Paste it.", "input text Paste the address", "button Sign in", "button Cancel", "p "]);
  expect([declared.element.querySelector("img"), declared.element.querySelector("b"), declared.element.querySelector("li:first-child .sign-in-stop") !== null]).toEqual([null, null, true]);
  // A step with no sentence is its part alone, and the field it holds is described by the line under the presses.
  const bare = drawn({ link: ADDRESS, ask: ASK_ADDRESS, steps: [{ kind: "link" }, { kind: "field" }] });
  expect([bare.parts(), bare.element.querySelector("input")!.getAttribute("aria-describedby")])
    .toEqual([["p Finish signing in within 5 minutes.", "a Sign in at auth.openai.com", "input text Paste the address", "button Sign in", "button Cancel", "p "], "sign-in-note"]);
  // A code to carry is drawn with Copy under its step; a field the flow does not wait on, and the press with it, are not drawn.
  const device = drawn({ link: { kind: "code", id: "kimi:1", code: "WXYZ", url: "https://www.kimi.com/code/authorize_device", minutes: 15 }, steps: [{ kind: "show", line: "Your code:" }, { kind: "link" }, { kind: "field", line: "Come back." }] });
  expect(device.parts()).toEqual(["p Finish signing in within 15 minutes.", "p Your code:", "code WXYZ", "button Copy", "a Enter the code at www.kimi.com", "p Come back.", "button Cancel", "p "]);
  device.element.querySelector<HTMLButtonElement>("[data-focus=sign-in-copy]")!.click();
  expect(device.element.querySelector("[data-focus=sign-in-copy]")!.textContent).toBe(say("signIn.copied"));
  // A code pasted back keeps its own press and no limit, as the platform draws it.
  expect(drawn({ link: CODE, steps: [{ kind: "link", line: "Get it." }, { kind: "field" }] }).parts())
    .toEqual(["p Get it.", "a Get the code at claude.ai", "input text Paste the code", "button Sign in", "button Cancel", "p "]);
  // Before the flow's link, the platform's own card stands.
  expect(drawn({ ask: DOMAIN, steps: [{ kind: "link" }] }).element.querySelector("ol")).toBeNull();
});

const GPT_STEPS = { steps: [{ kind: "link" }, { kind: "address", words: { en: "The page that won't open is the sign-in working.", zh: "打不开的页面就是登录成功。" } }, { kind: "field", words: { en: "Bring its address back here.", zh: "把它的网址带回这里。" } }] };

it.each([
  ["declares its steps", { signIn: GPT_STEPS }, "en", ["The page that won't open is the sign-in working.", "Bring its address back here."]],
  ["declares its steps, read in Chinese", { signIn: GPT_STEPS }, "zh", ["打不开的页面就是登录成功。", "把它的网址带回这里。"]],
  ["declares none", { plans: ["ChatGPT"] }, "en", ["After you sign in, the browser stops on a page that won't open. That means the sign-in worked.", "Copy the whole address from the address bar, then come back and paste it here."]],
  ["declares a step of a kind the card has not", { signIn: { steps: [...GPT_STEPS.steps, { kind: "picture", words: { en: "x", zh: "x" } }] } }, "en", ["After you sign in, the browser stops on a page that won't open. That means the sign-in worked.", "Copy the whole address from the address bar, then come back and paste it here."]],
  ["declares a step in one language", { signIn: { steps: [{ kind: "link" }, { kind: "address", words: { en: "Only English." } }] } }, "en", ["After you sign in, the browser stops on a page that won't open. That means the sign-in worked.", "Copy the whole address from the address bar, then come back and paste it here."]],
] as const)("draws ChatGPT's card from the package of a vendor that %s", (_, comchatx, language, lines) => {
  const gpt = makerRecords(cardWords([{ name: "@comchatx/openai", comchatx }])).find((one) => one.id === "openai")!;
  const card = signInCard({ name: "ChatGPT", typed: "", sending: false, link: ADDRESS, ask: ASK_ADDRESS, steps: stepsIn(gpt, language) }, { say: (key, values) => text(language, key, values), typed: () => {}, submit: () => {}, cancel: () => {}, dialog: { say, answer: async () => true } });
  expect([[...card.querySelectorAll("li > p")].map((one) => one.textContent), card.querySelectorAll("li").length, card.querySelector("li:nth-child(2) .sign-in-stop") !== null]).toEqual([lines, 3, true]);
});

it("draws a link that carries its code as Kimi Code's whole step, and a code its link does not carry as text to copy beside a link to where it is typed", () => {
  const carried = drawn({ link: DEVICE });
  expect(carried.parts()).toEqual(["p Finish signing in within 15 minutes.", "a Sign in at www.kimi.com", "button Cancel", "p "]);
  const apart = drawn({ link: { kind: "code", id: "kimi:1", code: MARKUP, url: "https://www.kimi.com/code/authorize_device", minutes: 15 } });
  expect(apart.parts()).toEqual(["p Finish signing in within 15 minutes.", `code ${MARKUP}`, "button Copy", "a Enter the code at www.kimi.com", "button Cancel", "p "]);
  expect([apart.element.querySelector("img"), apart.element.querySelector("b")]).toEqual([null, null]);
});

it("draws Claude's step as the prototype does, a link to the code and a field for it, with no limit", () => {
  expect(drawn({ link: CODE }).parts()).toEqual(["p Get the code at claude.ai", "a Get the code at claude.ai", "input text Paste the code", "button Sign in", "button Cancel", "p "]);
});

it("draws a masked question as a key field that shows nothing typed and offers nothing remembered, and a choice as a package's question is", () => {
  const secret = drawn({ ask: { kind: "ask", masked: true, dialog: { id: "s:1", method: "input", title: "API key" } } });
  expect(secret.parts()).toEqual(["input password API key", "button Save key", "button Cancel", "p "]);
  expect(secret.element.querySelector("input")!.getAttribute("autocomplete")).toBe("off");
  const choice = drawn({ ask: { kind: "ask", masked: false, dialog: { id: "s:2", method: "select", title: "Which plan?", options: ["Plus", "Pro"] } } });
  expect(choice.element.querySelector(".dialog-options, .dialog")).not.toBeNull();
  expect(choice.element.textContent).toContain("Which plan?");
});

it("keeps what was typed, holds the field and the press while an answer is on its way, and cancels on Escape but not on one that ends a composition", () => {
  const typing = drawn({ link: ADDRESS, ask: ASK_ADDRESS, typed: "https://localhost:1455/auth/callback?code=c" });
  const field = typing.element.querySelector("input")!;
  expect(field.value).toBe("https://localhost:1455/auth/callback?code=c");
  field.value = "x"; field.dispatchEvent(new Event("input"));
  typing.element.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
  field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true }));
  field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(typing.calls).toEqual(["typed x", "submit", "cancel"]);
  const sending = drawn({ link: ADDRESS, ask: ASK_ADDRESS, typed: "x", sending: true });
  // The press turns where it stood, named by its words, and keeps the keyboard; it is not disabled, so the focus stays on it.
  const press = sending.element.querySelector<HTMLButtonElement>("button[type=submit]")!;
  expect([sending.element.querySelector("input")!.readOnly, press.disabled, press.getAttribute("aria-busy"), press.getAttribute("aria-disabled"), press.getAttribute("aria-label"), press.querySelector(".pl-spin") !== null]).toEqual([true, false, "true", "true", "Sign in", true]);
  sending.element.dispatchEvent(new Event("submit", { cancelable: true }));
  expect(sending.calls).toEqual([]);
});

const DOMAIN: Extract<SignInStep, { kind: "ask" }> = { kind: "ask", masked: false, paste: "domain", minutes: 15, dialog: { id: "github-copilot:1", method: "input", title: "" } };

it("draws GitHub Copilot's first step as the domain card: the field's name, the field, the limit, and a press that names where it goes as the domain is typed", () => {
  const { element, parts } = drawn({ name: "GitHub Copilot", ask: DOMAIN });
  expect(parts()).toEqual(["p GitHub Enterprise domain (leave blank for github.com)", "input text company.ghe.com", "p Finish signing in within 15 minutes.", "button Sign in at github.com", "button Cancel", "p "]);
  const field = element.querySelector("input")!;
  const press = (): string => element.querySelector("button[type=submit]")!.textContent ?? "";
  for (const [typed, host] of [["acme.ghe.com", "acme.ghe.com"], ["https://acme.ghe.com/", "acme.ghe.com"], ["evil.example", "github.com"], ["", "github.com"]] as const) {
    field.value = typed;
    field.dispatchEvent(new Event("input"));
    expect(press(), typed).toBe(`Sign in at ${host}`);
  }
  expect(drawn({ ask: DOMAIN, typed: "acme.ghe.com" }).element.querySelector("button[type=submit]")!.textContent).toBe("Sign in at acme.ghe.com");
  expect(drawn({ ask: DOMAIN, note: "domain" }).element.querySelector("p[role=status]")!.textContent).toBe("Enter a domain ending in .ghe.com, or leave it blank for github.com.");
});

it("draws OpenRouter's link, which waits on the vendor alone, as its limit and one row of the press and Cancel", () => {
  const { element, parts } = drawn({ name: "OpenRouter", link: { kind: "link", id: "openrouter:1", url: "https://openrouter.ai/auth?callback_url=x", minutes: 5 } });
  expect(parts()).toEqual(["p Finish signing in within 5 minutes.", "a Sign in at openrouter.ai", "button Cancel", "p "]);
  expect(element.querySelector("a[data-link]")!.parentElement).toBe(element.querySelector("[data-focus=sign-in-cancel]")!.parentElement);
});

it("says an empty paste by what the card asks for, and an answer not taken as a failure, under the presses", () => {
  const line = (card: Partial<SignInCard>): readonly unknown[] => {
    const status = drawn(card).element.querySelector<HTMLElement>("p[role=status]")!;
    return [status.textContent ?? "", status.hidden, status.className];
  };
  expect(line({ link: ADDRESS, ask: ASK_ADDRESS, note: "empty" })).toEqual(["Paste the address first.", false, "dialog-line"]);
  expect(line({ link: ADDRESS, ask: ASK_ADDRESS, note: "elsewhere" })).toEqual(["Paste the address that starts with http://127.0.0.1:1455/auth/callback.", false, "dialog-line"]);
  expect(line({ link: CODE, note: "empty" })).toEqual(["Paste the code first.", false, "dialog-line"]);
  expect(line({ link: ADDRESS, note: "unsent" })).toEqual(["Not sent. Try again.", false, "dialog-line failed"]);
  expect(line({ link: ADDRESS })).toEqual(["", true, "dialog-line"]);
});

const signedIn = { kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } } as unknown as Extract<Me, { kind: "signed_in" }>;

/** A first release that serves GPT and Kimi, both installed, whose sign-ins the test steps through by hand, as the platform would answer them. */
function world(over: { accounts?: readonly Account[]; ownKey?: readonly string[]; ticked?: readonly string[]; features?: Features; inChat?: boolean; placed?: true; full?: true; hosts?: readonly string[]; waysGate?: Promise<void> } = {}) {
  const signIns: { readonly account: string; readonly steps: SignInPorts; readonly done: () => void; readonly fail: (error: unknown) => void }[] = [];
  const answers: [string, string, DialogAnswer][] = [];
  const held = {
    accounts: over.accounts ?? [{ id: "openai", name: "OpenAI (ChatGPT subscription)", signedIn: false, models: [] }, { id: "kimi-coding", name: "Kimi Code (subscription)", signedIn: false, models: [] }],
    ownKey: new Set(over.ownKey ?? []), taken: true, ticked: over.ticked ?? ["minimax"],
  };
  const sign = (account: string, on: boolean): void => { held.accounts = held.accounts.map((one) => (one.id === account ? { ...one, signedIn: on } : one)); };
  const backend = {
    features: over.features ?? FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" }, readme: async () => undefined,
    series: async () => ({ openai: [{ name: "GPT Luna", versions: [], inChat: false }, { name: "GPT Sol", versions: [{ id: "gpt-6-sol", name: "GPT-6 Sol", input: 0, output: 0 }], inChat: over.inChat === true }] }),
    chatOffer: async () => ({ vendors: [], models: [], places: over.inChat === true || over.placed === true ? ["openai"] : [] }),
    setSeries: vi.fn(async () => (over.full === true ? "full" : undefined)), addToChat: vi.fn(async () => (over.full === true ? "full" : undefined)), catalogue: async () => CATALOGUE, npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-10-17T00:00:00.000Z" }), npmPackage: async () => { throw new Error("unknown_package"); }, packages: async () => listOf([]), sources: async () => [],
    modelPlugins: async () => [{ id: "openai", enabled: true, ways: ["platform"] }, { id: "moonshotai", enabled: true, ways: ["platform"] }, ...(over.hosts ?? []).map((id) => ({ id, enabled: true, ways: [] }))],
    models: async () => ({
      current: undefined, default: { provider: "minimax", id: "minimax-m3" },
      available: [
        { provider: "minimax", id: "minimax-m3", name: "MiniMax M3" },
        held.accounts.some((one) => one.id === "openai" && one.signedIn) ? { provider: "openai", id: "gpt-6-sol", name: "GPT-6 Sol", via: "ChatGPT" } : { provider: "openai", id: "gpt-6-sol", name: "GPT-6 Sol" },
        { provider: "moonshotai", id: "kimi-k3", name: "Kimi K3" },
      ],
    }),
    providers: async () => ["openai", "moonshotai", ...(over.hosts ?? [])].map((id) => ({ id, name: id, platformKey: true, ownKey: held.ownKey.has(id), models: [], rates: [] })),
    accounts: async () => held.accounts,
    vendors: async () => held.ticked, setVendors: vi.fn(async (ticked: readonly string[]) => { held.ticked = ticked; }),
    now: () => Date.parse("2026-10-15"),
    signIn: vi.fn((account: string, steps: SignInPorts) => new Promise<void>((done, fail) => {
      signIns.push({ account, steps, done: () => { sign(account, true); done(); }, fail });
      steps.signal?.addEventListener("abort", () => fail(new SignInEnded("cancelled")), { once: true });
    })),
    answerSignIn: vi.fn(async (account: string, id: string, answer: DialogAnswer) => { answers.push([account, id, answer]); return held.taken; }),
    signOut: vi.fn(async (account: string) => { sign(account, false); }),
    saveOwnKey: vi.fn(async (provider: string) => { held.ownKey.add(provider); }), removeOwnKey: vi.fn(async (provider: string) => { held.ownKey.delete(provider); }),
    setModelWays: vi.fn(async () => { await over.waysGate; }),
  };
  const view = new PluginsPage({ say: (key, values) => text("en", key as StringKey, values), language: () => "en", backend: backend as unknown as Backend, me: () => signedIn, ask: vi.fn(), announce: appRegion(), changed: async () => {} });
  document.body.append(view.element);
  const row = (way: string): HTMLElement => view.element.querySelector<HTMLElement>(`#way-${way}`)!;
  // A press takes the keyboard, as a click does in a browser.
  const press = (way: string): void => { const button = row(way).querySelector<HTMLButtonElement>(".pl-way-act button")!; button.focus(); button.click(); };
  const card = (): HTMLElement | null => row("account").querySelector<HTMLElement>(".sign-in");
  const last = (): string | undefined => row("account").querySelector(".pl-last")?.textContent ?? undefined;
  return { view, backend, held, signIns, answers, row, press, card, last };
}
const settle = async (): Promise<void> => { for (let n = 0; n < 6; n += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };
async function settings(view: PluginsPage, id = "openai"): Promise<void> {
  await view.load();
  view.show({ kind: "plugin", id, tab: "settings" } as never);
  await settle();
}

it("signs in to ChatGPT from its Settings: the row's press turns until the first step comes, the card opens whole with it in the press's place and takes the keyboard, puts the keyboard in the field once its link is pressed, keeps what is typed through a redraw, checks the address before it sends it, and says it signed in", async () => {
  const one = world();
  await settings(one.view);
  const press = one.row("account").querySelector<HTMLButtonElement>(".pl-way-act button")!;
  expect(press.textContent).toBe("Sign in to ChatGPT");
  press.focus();
  press.click();
  // The press turns in its place, named by its own words, and keeps the keyboard; no card opens before the platform's first step.
  const ring = (): HTMLButtonElement | null => one.row("account").querySelector<HTMLButtonElement>(".pl-way-act button");
  expect([one.backend.signIn.mock.calls.map(([account]) => account), one.card(), ring()!.getAttribute("aria-busy"), ring()!.getAttribute("aria-label"), ring()!.querySelector(".pl-spin") !== null, document.activeElement])
    .toEqual([["openai"], null, "true", "Sign in to ChatGPT", true, ring()]);
  ring()!.click();
  expect(one.backend.signIn).toHaveBeenCalledTimes(1);
  const { steps, done } = one.signIns[0]!;
  steps.heard(ADDRESS);
  steps.heard(ASK_ADDRESS);
  // The card opens whole with the first step, and the keyboard goes from the ring to the card's first control, the vendor's link.
  const field = (): HTMLInputElement => one.card()!.querySelector("input")!;
  const drawnNow = (): string => one.card()!.innerHTML;
  expect([ring(), one.card()!.querySelectorAll("ol > li").length, one.card()!.querySelector(".sign-in-stop") !== null, document.activeElement]).toEqual([null, 3, true, one.card()!.querySelector("a[data-link]")]);
  const before = drawnNow();
  one.card()!.querySelector<HTMLAnchorElement>("a[data-link]")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  await settle();
  // The link's press puts the keyboard in the field and changes nothing drawn: the link stays, to open the vendor's page again.
  expect([drawnNow(), one.card()!.querySelector("a[data-link]") !== null, document.activeElement]).toEqual([before, true, field()]);
  one.card()!.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
  await settle();
  expect([one.answers, one.card()!.querySelector("p[role=status]")!.textContent, one.card()!.querySelector(".sign-in-stop") !== null]).toEqual([[], "Paste the address first.", true]);
  // An address from elsewhere is said on the card and not sent; the sign-in stays open, what is typed kept through the redraw.
  field().value = " https://chatgpt.com/ ";
  field().dispatchEvent(new Event("input"));
  one.card()!.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
  await settle();
  expect([one.answers, one.card()!.querySelector("p[role=status]")!.textContent, field().value, one.card()!.querySelector(".sign-in-stop") !== null, document.activeElement, steps.signal?.aborted])
    .toEqual([[], "Paste the address that starts with http://127.0.0.1:1455/auth/callback.", " https://chatgpt.com/ ", true, field(), false]);
  const pasted = " http://127.0.0.1:1455/auth/callback?code=c&state=s ";
  field().value = pasted;
  field().dispatchEvent(new Event("input"));
  one.held.taken = false;
  one.card()!.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
  await settle();
  expect([one.card()!.querySelector("p[role=status]")!.textContent, field().value]).toEqual(["Not sent. Try again.", pasted]);
  one.held.taken = true;
  one.card()!.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
  await settle();
  expect(one.answers.map(([account, id, answer]) => [account, id, answer])).toEqual([
    ["openai", "openai:2", { value: pasted.trim() }], ["openai", "openai:2", { value: pasted.trim() }]]);
  done();
  await settle();
  expect([one.card(), one.row("account").textContent]).toEqual([null, expect.stringContaining("Signed in.")]);
  expect(one.view.element.textContent).toContain("Signed in to ChatGPT.");
  // The ways are stored: the sign-in joins them first.
  expect(one.backend.setModelWays.mock.calls).toEqual([["openai", ["account", "platform"]]]);
});

it("sends an address at the page the card cannot read further, for the platform to end as a bad paste, and checks nothing where the platform gave no stop address", async () => {
  for (const [link, pasted] of [[ADDRESS, `${STOP}?error=access_denied`], [{ kind: "link", id: "openai:1", url: "https://auth.openai.com/oauth/authorize?state=s", minutes: 5, paste: "address" }, "https://chatgpt.com/"]] as const satisfies readonly (readonly [SignInStep, string])[]) {
    const one = world();
    await settings(one.view);
    one.press("account");
    one.signIns[0]!.steps.heard(link);
    one.signIns[0]!.steps.heard(ASK_ADDRESS);
    one.card()!.querySelector<HTMLAnchorElement>("a[data-link]")!.click();
    await settle();
    const field = one.card()!.querySelector("input")!;
    field.value = pasted;
    field.dispatchEvent(new Event("input"));
    one.card()!.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
    await settle();
    expect(one.answers, pasted).toEqual([["openai", "openai:2", { value: pasted }]]);
  }
});

it("starts the five minutes again on Cancel and a new sign-in: the card begins again, empty", async () => {
  const one = world();
  await settings(one.view);
  one.press("account");
  one.signIns[0]!.steps.heard(ADDRESS);
  one.card()!.querySelector<HTMLAnchorElement>("a[data-link]")!.click();
  await settle();
  one.card()!.querySelector("input")!.value = "typed";
  one.card()!.querySelector("input")!.dispatchEvent(new Event("input"));
  one.card()!.querySelector<HTMLButtonElement>("[data-focus=sign-in-cancel]")!.click();
  await settle();
  expect([one.signIns[0]!.steps.signal?.aborted, one.card(), document.activeElement]).toEqual([true, null, one.row("account").querySelector(".pl-way-act button")]);
  one.press("account");
  one.signIns[1]!.steps.heard(ADDRESS);
  expect([one.card()!.querySelector("a[data-link]") !== null, one.card()!.querySelector("input")!.value]).toEqual([true, ""]);
});

it("follows a mouse press that did not take the keyboard, as Safari's and Firefox's on macOS do not, to the card's first control; at an end it moves nothing it did not hold", async () => {
  const one = world();
  await settings(one.view);
  const heading = one.view.element.querySelector<HTMLElement>("h1")!;
  heading.focus();
  // The press is clicked with the keyboard left on the heading the page focused on arrival.
  one.row("account").querySelector<HTMLButtonElement>(".pl-way-act button")!.click();
  expect(document.activeElement?.getAttribute("data-focus")).toBe("heading");
  one.signIns[0]!.steps.heard(ADDRESS);
  expect(document.activeElement).toBe(one.card()!.querySelector("a[data-link]"));
  one.card()!.querySelector<HTMLButtonElement>("[data-focus=sign-in-cancel]")!.click();
  await settle();
  one.view.element.querySelector<HTMLElement>("h1")!.focus();
  one.row("account").querySelector<HTMLButtonElement>(".pl-way-act button")!.click();
  one.signIns[1]!.fail(new SignInEnded("busy"));
  await settle();
  // The press held nothing and took no first step: the keyboard is left where the browser put it, on the heading.
  expect(document.activeElement?.getAttribute("data-focus")).toBe("heading");
  // Where the person moved the keyboard while the press waited, it stays where they put it.
  one.view.element.querySelector<HTMLElement>("h1")!.focus();
  one.row("account").querySelector<HTMLButtonElement>(".pl-way-act button")!.click();
  const elsewhere = one.view.element.querySelector<HTMLElement>(".pl-tab")!;
  elsewhere.focus();
  one.signIns[2]!.steps.heard(ADDRESS);
  expect([elsewhere.getAttribute("data-focus"), document.activeElement?.getAttribute("data-focus")]).toEqual(["tab overview", "tab overview"]);
});

it("leaves a control outside the page that the person focused while a sign-in with no first step was saved, after a mouse press that held nothing", async () => {
  const saving = Promise.withResolvers<void>();
  const one = world({ waysGate: saving.promise });
  await settings(one.view);
  (document.activeElement as HTMLElement | null)?.blur();
  expect(document.activeElement).toBe(document.body);
  one.row("account").querySelector<HTMLButtonElement>(".pl-way-act button")!.click();
  // Signed in with no step first, as the platform's stream may end; the way's save is held.
  one.signIns[0]!.done();
  await settle();
  const outside = document.body.appendChild(document.createElement("button"));
  outside.focus();
  saving.resolve();
  await settle();
  expect(document.activeElement).toBe(outside);
});

it("leaves the keyboard where the person moved it while the press waited, when the sign-in ends before its first step", async () => {
  // The drawing that says why it ended keeps the keyboard on the control it was on.
  const ended = world();
  await settings(ended.view);
  ended.view.element.querySelector<HTMLElement>("h1")!.focus();
  ended.row("account").querySelector<HTMLButtonElement>(".pl-way-act button")!.click();
  ended.view.element.querySelector<HTMLElement>("[data-focus='tab overview']")!.focus();
  ended.signIns[0]!.fail(new SignInEnded("busy"));
  await settle();
  expect(document.activeElement?.getAttribute("data-focus")).toBe("tab overview");
});

it("leaves the keyboard where the person moved it while a signed-in way was saved, and brings back to the press one the card held", async () => {
  // Signed in, the way is saved; moved while that save was written, the keyboard stays where it was put, not back on the press.
  const saving = Promise.withResolvers<void>();
  const saved = world({ waysGate: saving.promise });
  await settings(saved.view);
  saved.press("account");
  saved.signIns[0]!.steps.heard(ADDRESS);
  expect(document.activeElement).toBe(saved.card()!.querySelector("a[data-link]"));
  saved.signIns[0]!.done();
  await settle();
  saved.view.element.querySelector<HTMLElement>("[data-focus='tab overview']")!.focus();
  saving.resolve();
  await settle();
  expect(document.activeElement?.getAttribute("data-focus")).toBe("tab overview");
  document.body.replaceChildren();
  // Not moved, the keyboard the card held comes back to the press once the save is done.
  const still = world();
  await settings(still.view);
  still.press("account");
  still.signIns[0]!.steps.heard(ADDRESS);
  still.signIns[0]!.done();
  await settle();
  expect(document.activeElement?.getAttribute("data-focus")).toBe("way-account");
});

it("leaves the last word of a sign-in that ended before its first step under the row, the ring gone and the keyboard on the press, said once through the page's status line", async () => {
  const one = world();
  await settings(one.view);
  const press = one.row("account").querySelector<HTMLButtonElement>(".pl-way-act button")!;
  press.focus();
  press.click();
  one.signIns[0]!.fail(new SignInEnded("busy"));
  await settle();
  const again = one.row("account").querySelector<HTMLButtonElement>(".pl-way-act button")!;
  const line = one.row("account").querySelector(".pl-last")!;
  expect([one.card(), line.textContent, line.getAttribute("role"), again.getAttribute("aria-busy"), again.textContent, document.activeElement])
    .toEqual([null, "Another ChatGPT sign-in is under way. Try again in a few minutes.", null, null, "Sign in to ChatGPT", again]);
  expect(document.querySelector(".unseen[role=status]")!.textContent).toBe("Another ChatGPT sign-in is under way. Try again in a few minutes.");
  // A press after it begins again.
  again.click();
  expect(one.backend.signIn).toHaveBeenCalledTimes(2);
});

it("puts the vendor just signed in to in chat by its first series that serves, where none of its series is ticked; with chat full nothing is said", async () => {
  const signedIn = async (one: ReturnType<typeof world>): Promise<void> => {
    await settings(one.view);
    one.press("account");
    one.signIns[0]!.done();
    await settle();
  };
  const free = world();
  await signedIn(free);
  expect([free.backend.addToChat.mock.calls, free.backend.setSeries.mock.calls, free.backend.setVendors.mock.calls]).toEqual([[["openai", ["GPT Sol"]]], [], []]);
  const ticked = world({ inChat: true });
  await signedIn(ticked);
  expect([ticked.backend.addToChat, ticked.backend.setSeries].map((one) => one.mock.calls.length)).toEqual([0, 0]);
  // A vendor holding its place by a tick no way reaches today has a place already: the sign-in ticks nothing.
  const placed = world({ placed: true });
  await signedIn(placed);
  expect([placed.backend.addToChat, placed.backend.setSeries].map((one) => one.mock.calls.length)).toEqual([0, 0]);
  const full = world({ full: true });
  await signedIn(full);
  expect(full.backend.addToChat.mock.calls).toEqual([["openai", ["GPT Sol"]]]);
  expect(full.view.element.textContent).toContain("Signed in to ChatGPT.");
  expect(full.view.element.textContent).not.toContain("Chat holds");
});

it("says under the row why a sign-in ended, a failure in brick and a fact in grey, quoting the flow's words only for a refusal, and nothing of one cancelled", async () => {
  const one = world();
  await settings(one.view);
  for (const [ended, said, failed] of [
    [new SignInEnded("refused", "ChatGPT authorization failed: access_denied"), "The sign-in didn't succeed. “ChatGPT authorization failed: access_denied”", true],
    [new SignInEnded("bad_paste"), "That isn't the right address. Sign in again, then copy the address in the address bar.", true],
    [new SignInEnded("unavailable"), "You can't sign in to ChatGPT right now. Try again later.", true],
    [new Error("anything else"), "You can't sign in to ChatGPT right now. Try again later.", true],
    [new SignInEnded("timed_out", undefined, 5), "The sign-in wasn't finished within 5 minutes.", false],
    [new SignInEnded("busy"), "Another ChatGPT sign-in is under way. Try again in a few minutes.", false],
    [new SignInEnded("crowded"), "Too many people are signing in right now. Try again in a few minutes.", false],
    [new SignInEnded("too_often"), "Too many sign-ins begun. Try again in a minute.", false],
  ] as const) {
    one.press("account");
    // While a sign-in is under way the row says nothing of the one before.
    expect(one.last()).toBeUndefined();
    one.signIns.at(-1)!.steps.heard(ADDRESS);
    one.signIns.at(-1)!.fail(ended);
    await settle();
    const line = one.row("account").querySelector(".pl-last")!;
    expect([line.textContent, line.classList.contains("pl-failed"), line.classList.contains("pl-fact"), one.card()]).toEqual([said, failed, !failed, null]);
    // The line is said once through the page's status line as it is drawn, not marked a status itself.
    expect([line.getAttribute("role"), document.querySelector(".unseen[role=status]")!.textContent]).toEqual([null, said]);
    expect(document.activeElement).toBe(one.row("account").querySelector(".pl-way-act button"));
  }
  one.press("account");
  one.signIns.at(-1)!.steps.heard(ADDRESS);
  one.card()!.querySelector("a")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await settle();
  expect([one.signIns.at(-1)!.steps.signal?.aborted, one.card(), one.last()]).toEqual([true, null, undefined]);
  expect(one.backend.setVendors).not.toHaveBeenCalled();
});

it("says a sign-in that ended since from the account's own record, quoting pi, until a sign-in begins", async () => {
  const one = world({ accounts: [{ id: "openai", name: "OpenAI (ChatGPT subscription)", signedIn: false, models: [], ended: "OpenAI OAuth token request failed (401): Unauthorized" }] });
  await settings(one.view);
  expect(one.last()).toBe("Your ChatGPT sign-in has ended. “OpenAI OAuth token request failed (401): Unauthorized”");
  expect(one.row("account").querySelector(".pl-last")!.classList.contains("pl-fact")).toBe(true);
  expect(one.row("account").querySelector(".pl-last-words")!.getAttribute("lang")).toBe("en");
  one.press("account");
  expect(one.last()).toBeUndefined();
});

it("says beside each of ChatGPT's ways that the other goes where both are one credential, and nothing for Kimi Code, whose key is another provider's", async () => {
  const keyed = world({ ownKey: ["openai"] });
  await settings(keyed.view);
  expect([keyed.row("account").textContent, keyed.row("key").textContent]).toEqual([expect.stringContaining("Signing in removes your API key."), expect.not.stringContaining("signs you out")]);
  const subscribed = world({ accounts: [{ id: "openai", name: "OpenAI (ChatGPT subscription)", signedIn: true, models: [] }] });
  await settings(subscribed.view);
  expect([subscribed.row("key").textContent, subscribed.row("account").textContent]).toEqual([expect.stringContaining("Saving a key signs you out of ChatGPT."), expect.not.stringContaining("removes your API key")]);
  const kimi = world({ ownKey: ["moonshotai"], accounts: [{ id: "kimi-coding", name: "Kimi Code (subscription)", signedIn: false, models: [] }] });
  await settings(kimi.view, "moonshotai");
  expect(kimi.view.element.querySelector(".pl-way-list")!.textContent).not.toMatch(/removes your API key|signs you out/);
});

it("runs one sign-in at a time and ends it on leaving the Settings, drawing a step that comes after nowhere", async () => {
  const one = world();
  await settings(one.view);
  one.press("account");
  const first = one.signIns[0]!;
  one.view.show({ kind: "plugin", id: "openai", tab: "overview" } as never);
  await settle();
  expect(first.steps.signal?.aborted).toBe(true);
  first.steps.heard(ASK_ADDRESS);
  one.view.show({ kind: "plugin", id: "openai", tab: "settings" } as never);
  await settle();
  expect([one.card(), one.last(), one.row("account").querySelector(".pl-way-act button")!.textContent]).toEqual([null, undefined, "Sign in to ChatGPT"]);
  one.press("account");
  await settings(one.view, "moonshotai");
  expect(one.signIns[1]!.steps.signal?.aborted).toBe(true);
  // Leaving the Plugins page for the chat ends it too, and the record page kept for the way back draws no card.
  await settings(one.view);
  one.press("account");
  one.view.leave();
  expect([one.signIns[2]!.steps.signal?.aborted, one.card()]).toEqual([true, null]);
});

it("signs out of a subscription and says so, the keyboard on the press that signs in again", async () => {
  const one = world({ accounts: [{ id: "openai", name: "OpenAI (ChatGPT subscription)", signedIn: true, models: [] }] });
  await settings(one.view);
  one.row("account").querySelector<HTMLButtonElement>("button[data-focus=way-sign-out]")!.click();
  await settle();
  expect([one.backend.signOut.mock.calls, one.view.element.textContent?.includes("Signed out of ChatGPT."), document.activeElement?.textContent]).toEqual([[["openai"]], true, "Sign in to ChatGPT"]);
});

it("signs in to GitHub Copilot with its domain: a blank one is sent for github.com, and one that is not GitHub Enterprise Cloud's is said and not sent", async () => {
  const one = world({ accounts: [{ id: "github-copilot", name: "GitHub Copilot", signedIn: false, models: [] }], hosts: ["github-copilot"] });
  await settings(one.view, "github-copilot");
  expect([one.row("account").querySelector("strong")!.textContent, one.row("account").querySelector(".pl-row-text .quiet")!.textContent]).toEqual(["Subscription", "Counts against your GitHub Copilot subscription."]);
  one.press("account");
  one.signIns[0]!.steps.heard(DOMAIN);
  const field = one.card()!.querySelector("input")!;
  expect(document.activeElement).toBe(field);
  field.value = "evil.example";
  field.dispatchEvent(new Event("input"));
  one.card()!.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
  await settle();
  expect([one.answers, one.card()!.querySelector("p[role=status]")!.textContent]).toEqual([[], "Enter a domain ending in .ghe.com, or leave it blank for github.com."]);
  const again = one.card()!.querySelector("input")!;
  again.value = "";
  again.dispatchEvent(new Event("input"));
  one.card()!.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
  await settle();
  expect(one.answers).toEqual([["github-copilot", "github-copilot:1", { value: "" }]]);
});

it("draws OpenRouter's sign-in above the key it makes, and stores the key's way when it signs in; Radius's sign-in is a sign-in, not a subscription", async () => {
  const one = world({ accounts: [{ id: "openrouter", name: "OpenRouter OAuth", signedIn: false, models: [] }], hosts: ["openrouter"] });
  await settings(one.view, "openrouter");
  const rows = [...one.view.element.querySelectorAll<HTMLElement>(".pl-way-list > li")].map((li) => [li.id, li.querySelector("strong")!.textContent, li.querySelector(".pl-row-text .quiet")!.textContent]);
  expect(rows).toEqual([
    ["way-account", "Sign in", "Makes an API key on your OpenRouter account. OpenRouter bills your account."],
    ["way-key", "API key", "OpenRouter bills your account."],
  ]);
  one.press("account");
  one.signIns[0]!.done();
  await settle();
  expect(one.backend.setModelWays.mock.calls).toEqual([["openrouter", ["key"]]]);
  const radius = world({ accounts: [{ id: "radius", name: "Radius", signedIn: false, models: [] }], hosts: ["radius"] });
  await settings(radius.view, "radius");
  expect([...radius.view.element.querySelectorAll<HTMLElement>(".pl-way-list > li")].map((li) => [li.id, li.querySelector("strong")!.textContent, li.querySelector(".pl-row-text .quiet")!.textContent])).toEqual([
    ["way-account", "Sign in", "Your Radius organisation decides which models you see."],
    ["way-key", "API key", "Radius bills your account."],
  ]);
  radius.press("account");
  radius.signIns[0]!.done();
  await settle();
  expect(radius.backend.setModelWays.mock.calls).toEqual([["radius", ["account"]]]);
});

it("presses Sign in to xAI on Grok's subscription row, whose plans are two, and to Muse on Meta's", async () => {
  for (const [id, account, press] of [["x-ai", "xai", "Sign in to xAI"], ["meta", "meta", "Sign in to Muse"]] as const) {
    const one = world({ accounts: [{ id: account, name: account, signedIn: false, models: [] }], hosts: [id] });
    await settings(one.view, id);
    expect(one.row("account").querySelector(".pl-way-act button")!.textContent).toBe(press);
  }
});
