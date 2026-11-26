import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { openDoor, type DoorWindow } from "../door.js";
import { browser } from "./browser.js";

// The door drawn by its own code, the vendor a stand-in that draws nothing, on a new account's code screen, where the door writes the help
// line under the card; its markup laid out by Chrome under the sign-in page's stylesheets in their order, at a phone's 320, in both themes.
const SITE = join(process.cwd(), "src/web/site");
const PAGE = readFileSync(join(SITE, "login.html"), "utf8");
const SHEETS = [...PAGE.matchAll(/<link rel="stylesheet" href="\.\/([^"]+)">/g)].map((m) => m[1]!);
const BODY = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)![1]!.replace(/<script[\s\S]*?<\/script>/g, "");

let chrome: Awaited<ReturnType<typeof browser>>;
const scratch = mkdtempSync(join(tmpdir(), "cmx-door-links-"));
beforeAll(async () => { chrome = await browser(); });
afterAll(async () => { await chrome.close(); rmSync(scratch, { recursive: true, force: true }); });

async function helpScreen(): Promise<string> {
  document.body.innerHTML = BODY;
  const location = { pathname: "/login", search: "", hash: "", reload: vi.fn() };
  const history = { state: null, replaceState: vi.fn() };
  const fetch = vi.fn(async (path: string) => new Response("{}", { status: path === "/door" ? 200 : 404, headers: { "content-type": "application/json" } }));
  const win = Object.assign(Object.create(window) as DoorWindow, {
    document, location, history, fetch, localStorage,
    addEventListener: window.addEventListener.bind(window), getComputedStyle: window.getComputedStyle.bind(window), MutationObserver: window.MutationObserver,
    open: vi.fn(() => null), setInterval: (run: () => void, ms: number) => setInterval(run, ms), clearInterval: (id: number) => clearInterval(id), setTimeout: (run: () => void, ms: number) => setTimeout(run, ms),
    Clerk: { load: vi.fn(async () => undefined), mountSignIn: vi.fn(), unmountSignIn: vi.fn() }, __internal_ClerkUICtor: class {},
  });
  await openDoor(win).mount();
  location.hash = "#/create/verify-email-address";
  window.dispatchEvent(new Event("hashchange"));
  expect(document.querySelector("#door-under .door-help a")).not.toBeNull();
  const html = document.body.innerHTML;
  document.body.replaceChildren();
  return html;
}

for (const theme of ["light", "dark"] as const) {
  it(`draws the help line's address as every link is drawn, no underline at rest or under the pointer and the page's ground under it, ${theme}`, async () => {
    const markup = await helpScreen();
    const file = join(scratch, `help-${theme}.html`);
    const links = SHEETS.map((sheet) => `<link rel="stylesheet" href="${pathToFileURL(join(SITE, sheet)).href}">`).join("");
    writeFileSync(file, `<!doctype html><html lang="zh-CN" data-theme="${theme}"><head><meta charset="utf-8">${links}</head><body class="theme-app" data-page="login">${markup}</body></html>`);
    await chrome.open(file, 320, 900);
    const read = `(() => { const style = getComputedStyle(document.querySelector(".door-help a")); return [style.textDecorationLine, style.backgroundColor]; })()`;
    const [x, y] = await chrome.evaluate<readonly [number, number]>(`(() => { const box = document.querySelector(".door-help a").getClientRects()[0]; return [box.x + box.width / 2, box.y + box.height / 2]; })()`);
    const ground = await chrome.evaluate<string>(`(() => { const probe = document.createElement("i"); probe.style.color = "var(--float-hover)"; document.body.append(probe); const value = getComputedStyle(probe).color; probe.remove(); return value; })()`);
    expect((await chrome.evaluate<readonly string[]>(read))[0], "at rest").toBe("none");
    await chrome.point(x, y);
    expect(await chrome.evaluate(read), "under the pointer").toEqual(["none", ground]);
  });
  // The foot's 获取帮助 is the vendor's to draw; it is stood in by an anchor of the class the vendor gives it, in the card's place.
  it(`draws the foot's option as every link is drawn, ${theme}`, async () => {
    const markup = (await helpScreen()).replace('id="door-card"></div>', 'id="door-card"><div class="cl-footerAction"><a class="cl-footerActionLink" href="#">获取帮助</a></div></div>');
    const file = join(scratch, `foot-${theme}.html`);
    const links = SHEETS.map((sheet) => `<link rel="stylesheet" href="${pathToFileURL(join(SITE, sheet)).href}">`).join("");
    writeFileSync(file, `<!doctype html><html lang="zh-CN" data-theme="${theme}"><head><meta charset="utf-8">${links}</head><body class="theme-app" data-page="login">${markup}</body></html>`);
    await chrome.open(file, 320, 900);
    const read = `(() => { const style = getComputedStyle(document.querySelector(".cl-footerActionLink")); return [style.textDecorationLine, style.backgroundColor]; })()`;
    const [x, y] = await chrome.evaluate<readonly [number, number]>(`(() => { const box = document.querySelector(".cl-footerActionLink").getClientRects()[0]; return [box.x + box.width / 2, box.y + box.height / 2]; })()`);
    const ground = await chrome.evaluate<string>(`(() => { const probe = document.createElement("i"); probe.style.color = "var(--float-hover)"; document.body.append(probe); const value = getComputedStyle(probe).color; probe.remove(); return value; })()`);
    expect((await chrome.evaluate<readonly string[]>(read))[0], "at rest").toBe("none");
    await chrome.point(x, y);
    expect(await chrome.evaluate(read), "under the pointer").toEqual(["none", ground]);
  });
}
