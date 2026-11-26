import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { OPTION_FORM } from "../../shared/option-form.js";
import { EMPTY, letGo, reduce, type StreamEvent, type StreamState } from "../stream-model.js";
import { StreamView } from "../stream-view.js";
import { text } from "../strings.js";
import { browser } from "./browser.js";

// The option card laid out by a real browser in the site's own stylesheets: the room over the card, waiting and left once answered.
const read = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");
let chrome: Awaited<ReturnType<typeof browser>>;
const scratch = mkdtempSync(join(tmpdir(), "cmx-option-card-"));
beforeAll(async () => { chrome = await browser(); });
afterAll(async () => { await chrome.close(); rmSync(scratch, { recursive: true, force: true }); });

const E = "e".repeat(32);
const FORM = { form: OPTION_FORM, ask: "ship", questions: [{ words: "这一批怎么运？", options: [{ name: "海运", line: "约 35 天到仓" }, { name: "空运", line: "约 8 天到仓" }] }] };
const asked: StreamState = [
  { event: "life", data: { kind: "life", epoch: E } },
  { event: "entry", id: `${E}:1`, data: { epoch: E, seq: 1, body: { form: "message", role: "user", content: "帮我做一份补货计划。" } } },
  { event: "entry", id: `${E}:2`, data: { epoch: E, seq: 2, body: { form: "message", role: "assistant", content: [{ form: "text", text: "补货计划先按海运做了一版：800 件，预计 35 天到仓。" }], stopReason: "stop" } } },
  { event: "ui_request", data: { kind: "ui_request", id: "o-1", body: { form: "ui_request", id: "o-1", method: "input", title: FORM.questions[0]!.words, placeholder: JSON.stringify(FORM), timeout: 2 ** 31 - 1 } } },
].reduce((state, event) => reduce(state, event as StreamEvent), EMPTY);

/** The room between the card, waiting or left, and what is drawn above it, in a window of `width`. */
async function room(state: StreamState, width: number): Promise<number> {
  const view = new StreamView({ say: (key, values) => text("zh", key, values), now: () => 0, day: () => "今天", answer: async () => true, language: () => "zh" });
  view.update(state);
  const file = join(scratch, `room-${width}-${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(file, `<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><style>${read("src/web/site/theme.css")}\n${read("src/web/site/pay.css")}\n${read("src/web/site/app.css")}</style></head><body>${view.element.outerHTML}</body></html>`);
  await chrome.open(file, width, 800);
  return chrome.evaluate<number>(`(() => {
    const card = document.querySelector(".stream-dialogs > .oc, .stream > .dialog.oc") ?? document.querySelector(".oc-done");
    let place = card.closest(".stream > *"), above = place.previousElementSibling;
    while (above !== null && above.getBoundingClientRect().height === 0) above = above.previousElementSibling;
    return Math.round(card.getBoundingClientRect().top - above.getBoundingClientRect().bottom);
  })()`);
}

for (const width of [1280, 320]) {
  it(`keeps the room over the card when it folds, answered or skipped, at ${width} px`, async () => {
    const waiting = await room(asked, width);
    const answered = await room(letGo(asked, "o-1", { value: JSON.stringify({ form: OPTION_FORM, answers: [{ chosen: ["空运"] }] }) }), width);
    const skipped = await room(letGo(asked, "o-1", { cancelled: true }), width);
    expect([waiting, answered, skipped]).toEqual([24, 24, 24]);
  });
}

// A yes-or-no question pi waits on stands where it was asked, by the same room as the card at the foot.
const awaited: StreamState = [
  { event: "life", data: { kind: "life", epoch: E } },
  { event: "entry", id: `${E}:1`, data: { epoch: E, seq: 1, body: { form: "message", role: "user", content: "把 YM-10-BLU 降到 US$29.99。" } } },
  { event: "entry", id: `${E}:2`, data: { epoch: E, seq: 2, body: { form: "message", role: "assistant", content: [{ form: "text", text: "改价之前先问你一声。" }] } } },
  { event: "ui_request", data: { kind: "ui_request", id: "c-1", body: { form: "ui_request", id: "c-1", method: "confirm", title: "允许改价吗？", message: "US$32.99 → US$29.99" } } },
].reduce((state, event) => reduce(state, event as StreamEvent), EMPTY);
for (const width of [1280, 320]) {
  it(`keeps the room over a yes-or-no question pi waits on, asked and answered, at ${width} px`, async () => {
    expect([await room(awaited, width), await room(letGo(awaited, "c-1", { confirmed: false }), width)]).toEqual([24, 24]);
  });
}

it("keeps two cards left one after another as close as two that wait", async () => {
  const two = [{ event: "ui_request", data: { kind: "ui_request", id: "o-2", body: { form: "ui_request", id: "o-2", method: "input", title: "发往哪个仓？", placeholder: JSON.stringify({ ...FORM, ask: "house", questions: [{ words: "发往哪个仓？", options: [{ name: "美东仓" }] }] }), timeout: 2 ** 31 - 1 } } }].reduce((state, event) => reduce(state, event as StreamEvent), asked);
  const view = new StreamView({ say: (key, values) => text("zh", key, values), now: () => 0, day: () => "今天", answer: async () => true });
  const gap = async (state: StreamState, selector: string): Promise<number> => {
    view.reset(); view.update(state);
    const file = join(scratch, `two-${Math.random().toString(36).slice(2)}.html`);
    writeFileSync(file, `<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><style>${read("src/web/site/theme.css")}\n${read("src/web/site/pay.css")}\n${read("src/web/site/app.css")}</style></head><body>${view.element.outerHTML}</body></html>`);
    await chrome.open(file, 1280, 800);
    return chrome.evaluate<number>(`(() => { const [a, b] = document.querySelectorAll(${JSON.stringify(selector)}); return Math.round(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom); })()`);
  };
  const left = letGo(letGo(two, "o-1", { cancelled: true }), "o-2", { cancelled: true });
  expect([await gap(two, ".stream-dialogs > .oc"), await gap(left, ".oc-done")]).toEqual([12, 12]);
});
