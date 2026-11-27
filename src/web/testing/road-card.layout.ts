import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { type AccountMoney, type Me, type PayAnswer } from "../backend.js";
import { dollars } from "../../shared/money.js";
import { openRoad, type RoadBackend } from "../road.js";
import { browser } from "./browser.js";

// The road drawn by its own code in the stand-in DOM, its markup laid out by Chrome under the start page's stylesheets in their order, in
// Chinese at a phone's 320: 订阅's card, the name after a payment went through, and the terms while 创建账户 waits on the platform.
const SITE = join(process.cwd(), "src/web/site");
const SHEETS = ["theme.css", "www/assets/css/base.css", "www/assets/css/chrome.css", "www/assets/css/sign-in.css", "www/assets/css/pricing.css", "door.css", "pay.css", "road.css", "forms.css"];
const UNITS = 1_000_000;
const me = (terms: boolean): Me => ({ kind: "signed_in", account: "a1", email: "chen@example.com", name: undefined, box: "pending", balance: undefined, money: dollars(UNITS), spending: undefined, terms });
const money = { state: "trial", figure: 0, model_figure: 0, debt: 0, blocks: { given: 0, paid: 0 }, warning: { below: 0, low: false, model_low: false },
  lots: [{ kind: "sign_up", landed_on: "2026-11-13", units: UNITS, remainder: UNITS, used: 0, ends_on: "2026-11-20", days_left: 7 }],
  renewal: { price: 10 * UNITS, takes: 0, short: 0 }, next_period: { last_day: "2026-12-12", renews_on: "2026-12-13" } } as AccountMoney;
const never = new Promise<never>(() => undefined);

let chrome: Awaited<ReturnType<typeof browser>>;
const scratch = mkdtempSync(join(tmpdir(), "cmx-road-card-"));
beforeAll(async () => { chrome = await browser(); });
afterAll(async () => { await chrome.close(); rmSync(scratch, { recursive: true, force: true }); });

async function drawn(terms: boolean, walk: (root: HTMLElement) => Promise<void>, pay: () => Promise<PayAnswer> = () => never, start: () => Promise<boolean> = async () => true): Promise<string> {
  const backend = {
    me: async () => me(terms), accountMoney: async () => money, acceptTerms: () => never, setName: async () => undefined,
    startBox: start, leave: async () => "ended" as const, features: { checkout: true }, returned: async () => ({ state: "unpaid" as const }), payIn: async () => "cs_1_secret_x",
    payForm: async () => ({ total: { text: "$10.00", minor: 1_000 }, mount: async () => undefined, pay }),
    spaces: async () => undefined,
  } as unknown as RoadBackend;
  const root = document.createElement("div");
  root.id = "road";
  document.body.append(root);
  await openRoad(root, { backend, language: "zh", year: 2026, go: vi.fn(), skip: vi.fn(), cx: () => document.createElementNS("http://www.w3.org/2000/svg", "svg"), storage: sessionStorage });
  await walk(root);
  const html = root.outerHTML;
  root.remove();
  return html;
}
const settled = async (): Promise<void> => { for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0)); };
const button = (root: HTMLElement, selector: string): HTMLButtonElement => root.querySelector<HTMLButtonElement>(selector)!;

async function laid<T>(markup: string, name: string, reading: string): Promise<T> {
  const file = join(scratch, `${name}.html`);
  const links = SHEETS.map((sheet) => `<link rel="stylesheet" href="${pathToFileURL(join(SITE, sheet)).href}">`).join("");
  writeFileSync(file, `<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8">${links}</head><body class="theme-app" data-page="login">${markup}</body></html>`);
  await chrome.open(file, 320, 900);
  return chrome.evaluate<T>(reading);
}

it("breaks the card's plan sentence at its comma at 320, as the plans page does, so 余额 stays whole", async () => {
  const markup = await drawn(true, async (root) => { await settled(); button(root, ".plan .btn-primary").click(); await settled(); });
  const tops = await laid<readonly number[]>(markup, "card", `(() => {
    const line = document.querySelector(".road-words"), text = line.textContent, range = document.createRange();
    const top = (at) => { const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT); let left = at, node; while ((node = walker.nextNode()) && left >= node.length) left -= node.length; range.setStart(node, left); range.setEnd(node, left + 1); return Math.round(range.getBoundingClientRect().top); };
    const at = text.indexOf("余额");
    return [top(at), top(at + 1), top(text.indexOf("当期有效"))];
  })()`);
  expect(tops[0]).toBe(tops[1]);
  expect(tops[2]).toBeGreaterThan(tops[1]!);
});

it("stands the word that a payment went through in its own box over cx, smaller than the question, as the prototype draws it", async () => {
  const markup = await drawn(true, async (root) => {
    await settled(); button(root, ".plan .btn-primary").click(); await settled(); button(root, "[data-key='card-yes']").click(); await settled();
  }, async () => ({ state: "paid" }));
  const read = await laid<readonly unknown[]>(markup, "paid", `(() => {
    const paid = getComputedStyle(document.querySelector(".road-ask .sw-lead")), asked = getComputedStyle(document.querySelector(".road-question"));
    return [paid.borderTopStyle, paid.borderTopWidth, parseFloat(paid.fontSize) < parseFloat(asked.fontSize)];
  })()`);
  expect(read).toEqual(["solid", "1px", true]);
});

it("draws 创建账户 while it waits on the platform as a button that is off, though it keeps the keyboard", async () => {
  const markup = await drawn(false, async (root) => { await settled(); root.querySelector<HTMLInputElement>("#agree")!.click(); button(root, ".cl-formButtonPrimary").click(); await settled(); });
  const read = await laid<readonly (readonly string[])[]>(markup, "terms", `(() => {
    const waiting = document.querySelector(".cl-formButtonPrimary"), off = waiting.cloneNode(true);
    off.removeAttribute("aria-disabled"); off.disabled = true; waiting.after(off);
    const look = (one) => { const style = getComputedStyle(one); return [style.backgroundColor, style.color, style.borderTopColor, style.cursor]; };
    return [[waiting.getAttribute("aria-disabled") ?? "", String(waiting.disabled)], look(waiting), look(off)];
  })()`);
  expect(read[0]).toEqual(["true", "false"]);
  expect(read[1]).toEqual(read[2]);
});

it("draws 开始使用 under the pointer and held down while it waits as it is drawn busy, with the forms' busy colours and none of an off button's", async () => {
  const markup = await drawn(true, async (root) => {
    await settled();
    button(root, ".trial button").click();
    await settled();
    const field = root.querySelector<HTMLInputElement>("#call")!;
    field.value = "陈静";
    field.dispatchEvent(new Event("input"));
    root.querySelector("form")!.requestSubmit();
    await settled();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((one) => one.textContent === "继续")!.click();
    await settled();
    [...root.querySelectorAll<HTMLButtonElement>("button.road-go")].find((one) => one.textContent === "开始使用")!.click();
    await settled();
  }, () => never, () => never);
  const look = `(() => { const go = document.querySelector(".road-go.busy"), style = getComputedStyle(go);
    return [go.matches(":active"), style.backgroundColor, style.color, style.borderTopColor]; })()`;
  const rest = await laid<readonly (string | boolean)[]>(markup, "busy", look);
  // Under the pointer first, then pressed and held there.
  const [x, y] = await chrome.evaluate<readonly number[]>(`(() => { const box = document.querySelector(".road-go.busy").getBoundingClientRect(); return [box.x + box.width / 2, box.y + box.height / 2]; })()`);
  await chrome.point(x!, y!);
  const over = await chrome.evaluate<readonly (string | boolean)[]>(look);
  await chrome.hold(x!, y!);
  const held = await chrome.evaluate<readonly (string | boolean)[]>(look);
  // The forms' busy paint, read off a bare busy button of theirs on the same page, and an off button's, read off the road's own.
  const forms = await chrome.evaluate<readonly string[]>(`(() => { const one = document.createElement("button"); one.className = "f-btn busy"; document.body.append(one);
    const style = getComputedStyle(one); return [style.backgroundColor, style.color, style.borderTopColor]; })()`);
  const off = await chrome.evaluate<readonly string[]>(`(() => { const one = document.createElement("button"); one.className = "road-go"; one.setAttribute("aria-disabled", "true"); document.body.append(one);
    const style = getComputedStyle(one); return [style.backgroundColor, style.color, style.borderTopColor]; })()`);
  expect([rest[0], held[0]]).toEqual([false, true]);
  expect([rest.slice(1), over.slice(1), held.slice(1)]).toEqual([forms, forms, forms]);
  expect(held.slice(1)).not.toEqual(off);
});

// What a card that waits on a read draws, read the same way off the prototype (`spike/road-read-fails`): the card's box, and for each of
// its lines the text, how many lines it takes and its height; each Chinese sentence held whole takes one line; nothing is wider than the window.
const WAITS_READING = `(() => {
  const lines = (one) => Math.round(one.getBoundingClientRect().height / parseFloat(getComputedStyle(one).lineHeight));
  const card = document.querySelector(".cl-cardBox").getBoundingClientRect();
  return {
    card: [Math.round(card.width), Math.round(card.height)],
    lines: [...document.querySelectorAll(".cl-card > *")].map((one) => [one.textContent.trim(), lines(one), Math.round(one.getBoundingClientRect().height)]),
    whole: [...document.querySelectorAll(".road-whole, .rf-hold")].map(lines),
    fits: document.documentElement.scrollWidth <= innerWidth,
  };
})()`;
type WaitsRead = { readonly card: readonly number[]; readonly lines: readonly (readonly [string, number, number])[]; readonly whole: readonly number[]; readonly fits: boolean };

async function waiting(state: "open-unread" | "return-unread", language: "zh" | "en"): Promise<string> {
  const unread = async (): Promise<never> => { throw new Error("unreachable"); };
  const backend = { spaces: async () => undefined, me: state === "open-unread" ? unread : async () => me(true), accountMoney: async () => money, returned: unread, features: { checkout: true } } as unknown as RoadBackend;
  sessionStorage.setItem("cmx-paying", JSON.stringify({ what: "plan", units: 10 * UNITS, page: "subscribe", session: "cs_1", account: "a1" }));
  const root = document.createElement("div");
  root.id = "road";
  document.body.append(root);
  void openRoad(root, { backend, language, year: 2026, go: vi.fn(), skip: vi.fn(), cx: () => document.createElementNS("http://www.w3.org/2000/svg", "svg"), storage: sessionStorage, checkout: "cs_1" });
  await settled();
  const html = root.outerHTML;
  root.remove();
  sessionStorage.clear();
  return html;
}

async function laidAt(markup: string, name: string, language: "zh" | "en", width: number): Promise<WaitsRead> {
  const file = join(scratch, `${name}.html`);
  const links = SHEETS.map((sheet) => `<link rel="stylesheet" href="${pathToFileURL(join(SITE, sheet)).href}">`).join("");
  writeFileSync(file, `<!doctype html><html lang="${language === "zh" ? "zh-CN" : "en"}" data-theme="light"><head><meta charset="utf-8">${links}</head><body class="theme-app" data-page="login">${markup}</body></html>`);
  await chrome.open(file, width, 900);
  return chrome.evaluate<WaitsRead>(WAITS_READING);
}

// Read off the prototype at 213714bbe (app.html, light theme) by this same reading: the card's width and height, each line's count and height.
const PROTOTYPE: readonly (readonly ["open-unread" | "return-unread", "zh" | "en", number, readonly number[], readonly (readonly number[])[], readonly number[]])[] = [
  ["open-unread", "zh", 320, [256, 100], [[1, 22], [1, 20]], []],
  ["open-unread", "zh", 1280, [480, 116], [[1, 22], [1, 20]], []],
  ["open-unread", "en", 320, [256, 100], [[1, 22], [1, 20]], []],
  ["open-unread", "en", 1280, [480, 116], [[1, 22], [1, 20]], []],
  ["return-unread", "zh", 320, [256, 147], [[1, 22], [2, 39], [1, 20]], [1, 1]],
  ["return-unread", "zh", 1280, [480, 143], [[1, 22], [1, 20], [1, 20]], [1, 1]],
  ["return-unread", "en", 320, [256, 188], [[2, 44], [3, 59], [1, 20]], []],
  ["return-unread", "en", 1280, [480, 163], [[1, 22], [2, 39], [1, 20]], []],
];

it("draws the card that cannot connect, and the one that cannot confirm a payment, as the prototype does at 320 and 1280 in both languages", async () => {
  for (const [state, language, width, card, lines, whole] of PROTOTYPE) {
    const read = await laidAt(await waiting(state, language), `${state}-${language}-${width}`, language, width);
    expect([read.card, read.lines.map(([, count, height]) => [count, height]), read.whole, read.fits], `${state} ${language} ${width}`).toEqual([card, lines, whole, true]);
  }
});

it("draws the terms links and the foot's 使用其他邮箱 as the app draws a link: no underline at rest or under the pointer, the page's ground under it", async () => {
  const markup = await drawn(false, settled);
  const file = join(scratch, "links.html");
  const links = SHEETS.map((sheet) => `<link rel="stylesheet" href="${pathToFileURL(join(SITE, sheet)).href}">`).join("");
  writeFileSync(file, `<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8">${links}</head><body class="theme-app" data-page="login">${markup}</body></html>`);
  await chrome.open(file, 320, 900);
  const places = await chrome.evaluate<readonly (readonly [number, number])[]>(`[...document.querySelectorAll(".road-tick a, .road-foot .road-link")].map((one) => { const box = one.getClientRects()[0]; return [box.x + box.width / 2, box.y + box.height / 2]; })`);
  expect(places).toHaveLength(3);
  const read = (at: number): Promise<readonly string[]> => chrome.evaluate(`(() => { const one = document.querySelectorAll(".road-tick a, .road-foot .road-link")[${at}], style = getComputedStyle(one); return [style.textDecorationLine, style.backgroundColor]; })()`);
  const ground = await chrome.evaluate<string>(`(() => { const probe = document.createElement("i"); probe.style.color = "var(--float-hover)"; document.body.append(probe); const value = getComputedStyle(probe).color; probe.remove(); return value; })()`);
  for (const [at, [x, y]] of places.entries()) {
    expect((await read(at))[0], `link ${at} at rest`).toBe("none");
    await chrome.point(x, y);
    expect(await read(at), `link ${at} under the pointer`).toEqual(["none", ground]);
    await chrome.point(0, 0);
  }
});

// Whether each word stands on one line where it is drawn: its characters' boxes share one top. The road's own words carry joiners between
// characters, which this reading passes over.
const WHOLE_READING = (words: readonly (readonly [string, string])[]): string => `(() => {
  const whole = (selector, word) => {
    const holder = document.querySelector(selector);
    if (holder === null) return "missing " + selector;
    const chars = [], walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) for (let at = 0; at < node.length; at += 1) if (node.data[at] !== "\\u2060") chars.push([node, at, node.data[at]]);
    const start = chars.map((one) => one[2]).join("").indexOf(word);
    if (start < 0) return "absent " + word;
    const range = document.createRange();
    const tops = chars.slice(start, start + word.length).map(([node, at]) => { range.setStart(node, at); range.setEnd(node, at + 1); return Math.round(range.getBoundingClientRect().top); });
    return new Set(tops).size === 1;
  };
  return ${JSON.stringify(words)}.map(([selector, word]) => whole(selector, word));
})()`;

async function wordsAt(markup: string, name: string, width: number, words: readonly (readonly [string, string])[]): Promise<readonly unknown[]> {
  const file = join(scratch, `${name}-${width}.html`);
  const links = SHEETS.map((sheet) => `<link rel="stylesheet" href="${pathToFileURL(join(SITE, sheet)).href}">`).join("");
  writeFileSync(file, `<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8">${links}</head><body class="theme-app" data-page="login">${markup}</body></html>`);
  await chrome.open(file, width, 900);
  return chrome.evaluate<readonly unknown[]>(WHOLE_READING(words));
}

it("keeps a title, a date's last word and 账单's words whole on their lines, at 320, 700 and 1280: 《隐私政策》, 到期, 合计满", async () => {
  const terms = await drawn(false, async () => { await settled(); });
  const fork = await drawn(true, async () => { await settled(); });
  const card = await drawn(true, async (root) => { await settled(); button(root, ".plan .btn-primary").click(); await settled(); button(root, "[data-key='buy:once']")?.click(); await settled(); });
  for (const width of [320, 700, 1280]) {
    const read = [
      ...await wordsAt(terms, "terms-words", width, [["label[for='agree']", "隐私政策"], ["label[for='agree']", "服务条款"]]),
      ...await wordsAt(fork, "fork-words", width, [["main", "到期"]]),
      ...await wordsAt(card, "card-words", width, [[".road-pay", "合计满"]]),
    ];
    expect(read, String(width)).toEqual([true, true, true, true]);
  }
});
