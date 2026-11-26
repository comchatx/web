// @vitest-environment node
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { build } from "esbuild";
import { afterAll, beforeAll, expect, it } from "vitest";
import { browser } from "./browser.js";

// The chat's message box in Chrome, with real keys: Enter with Ctrl, ⌘ or Alt, Shift held or not, breaks the line over a selection and
// sends nothing, and the browser's own Undo brings the selection back, as it does after Shift+Enter.
const ENTRY = `import { messageBox } from "../../shared/message-box.ts";
window.sent = [];
const { field } = messageBox(document, { send: () => { window.sent.push(field.value); } });
document.body.append(field);`;

let server: Server;
let chrome: Awaited<ReturnType<typeof browser>>;
let origin = "";
beforeAll(async () => {
  const bundle = (await build({ stdin: { contents: ENTRY, resolveDir: join(process.cwd(), "src/web/testing"), loader: "ts" }, bundle: true, format: "esm", write: false })).outputFiles[0]!.text;
  server = createServer((request, response) => {
    if (request.url === "/box.js") { response.writeHead(200, { "content-type": "text/javascript" }).end(bundle); return; }
    response.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module" src="/box.js"></script></body></html>`);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  chrome = await browser();
}, 60_000);
afterAll(async () => { await chrome?.close(); await new Promise((done) => server.close(done)); });

// CDP's modifiers: Alt 1, Ctrl 2, ⌘ 4, Shift 8.
const HELD = [["Shift", 8], ["Ctrl", 2], ["⌘", 4], ["Alt", 1], ["Ctrl+Shift", 10], ["⌘+Shift", 12], ["Alt+Shift", 9], ["all four", 15]] as const;

it("breaks the line over a selection at Enter with Ctrl, ⌘ or Alt, Shift held or not, sends nothing, and Undo brings the selection back", async () => {
  await chrome.open(`${origin}/`, 700, 400);
  const seen: unknown[] = [];
  for (const [name, held] of HELD) {
    await chrome.evaluate(`(() => { const field = document.querySelector("textarea"); field.focus(); field.value = "Only Germany"; field.setSelectionRange(5, 12); return true; })()`);
    await chrome.key("Enter", held);
    const broken = await chrome.evaluate<[string, number]>(`[document.querySelector("textarea").value, document.querySelector("textarea").selectionStart]`);
    await chrome.evaluate(`document.execCommand("undo")`);
    const undone = await chrome.evaluate<[string, string]>(`(() => { const field = document.querySelector("textarea"); return [field.value, field.value.slice(field.selectionStart, field.selectionEnd)]; })()`);
    seen.push([name, broken, undone]);
  }
  expect([seen, await chrome.evaluate("window.sent")]).toEqual([HELD.map(([name]) => [name, ["Only \n", 6], ["Only Germany", "Germany"]]), []]);
}, 60_000);
