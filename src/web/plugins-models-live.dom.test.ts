// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import type { Me } from "./backend.js";
import { PlatformBackend } from "./platform-backend.js";
import { PluginsPage } from "./plugins-page.js";
import { text, type StringKey } from "./strings.js";
import { MAKERS } from "./canned-catalogue.js";

const signedIn = { kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } } as unknown as Extract<Me, { kind: "signed_in" }>;
const ME = { account: { id: "a", email: "ada@example.com" }, tenant: { id: "t" }, box: { id: "b", state: "provisioned" }, balance: { available: 2_500_000, open_floor: 100_000, can_open: true, warning_percent: 20 }, units_per_dollar: 1_000_000, month: { since: 0, until: 1, credited: 5_000_000, spent: { model: 2_000_000, sources: 14, box_time: 499_986, box_storage: 0 } } };

/** The live backend over a platform that holds the seller's own Anthropic key and, where `served`, serves Claude Opus on the balance. */
function live(ways: readonly string[], served = true) {
  const choices = { vendors: ["anthropic"], models: { anthropic: ["~anthropic/claude-opus-latest"] }, plugins: { anthropic: { on: true, ways } } };
  const presence = { providers: [{ id: "anthropic", name: "Anthropic", own_key: true, models: [{ id: "claude-opus-5.5", name: "Claude Opus 5.5" }] }], accounts: [] };
  const fetch = vi.fn(async (path: string | URL | Request) => {
    const route = String(path).split("?")[0];
    if (route === "/me") return Response.json({ ...ME, margin_percent: 30, served_models: served ? [{ provider: "balance", id: "anthropic/claude-opus-5.5", name: "Anthropic: Claude Opus 5.5", price: { input: 5, output: 25 } }] : [] });
    if (route === "/model-providers") return Response.json(presence);
    if (route === "/card-choices") return Response.json({ choices, pending: null });
    return Response.json({ error: "box_unavailable" }, { status: 409 });
  });
  const backend = new PlatformBackend({ fetch: fetch as typeof globalThis.fetch, eventSource: () => { throw new Error("no stream"); }, clientId: "web-tab", go: vi.fn(), leaving: { set: vi.fn(), take: () => false }, renewing: { set: vi.fn(), take: () => undefined }, now: () => 0, zone: () => "UTC" });
  const view = new PluginsPage({ say: (key, values) => text("en", key as StringKey, values), language: () => "en", backend, me: () => signedIn, ask: vi.fn(), announce: vi.fn(), changed: vi.fn(async () => {}) });
  document.body.append(view.element);
  return { view, backend };
}
const settle = async (): Promise<void> => { for (let n = 0; n < 8; n += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };

afterEach(() => { document.body.replaceChildren(); location.hash = ""; });

it("draws on the live backend the balance's price only where the balance serves a series first: none, not $0.00, by the key alone, none where the key comes first, and the price where the balance does", async () => {
  const drawn = async (ways: readonly string[], served = true): Promise<readonly string[]> => {
    const { view, backend } = live(ways, served);
    // The app reads /me before the page, and the balance's prices come with it.
    await backend.me();
    await view.load();
    view.show({ kind: "plugin", id: "anthropic", tab: "models" } as never);
    await settle();
    const table = view.element.querySelector(".pl-series")!;
    const row = [...table.querySelectorAll("tbody tr")].map((one) => [...one.children].map((cell) => cell.textContent ?? "").join("|"));
    document.body.replaceChildren();
    return [[...table.querySelectorAll("thead th")].map((one) => one.textContent).join("|"), ...row];
  };
  expect(await drawn(["key"])).toEqual(["In chat|Model", "|Claude OpusClaude Opus 5.5"]);
  // The key serves Opus first, and the balance pays for it only once the key runs out: no price, and no column for none (「ah——A/A」).
  expect(await drawn(["key", "platform"])).toEqual(["In chat|Model", "|Claude OpusClaude Opus 5.5"]);
  expect(await drawn(["platform", "key"])).toEqual(["In chat|Model|In / out, per M tokens", "|Claude OpusClaude Opus 5.5|$6.50 / $32.50"]);
  expect(await drawn(["platform", "key"], false)).toEqual(["In chat|Model", "|Claude OpusClaude Opus 5.5"]);
});

it("keeps in chat on the live backend a vendor whose only tick no way reaches today, listing no model for it, and takes it out by clearing that tick", async () => {
  let choices: unknown = { vendors: ["anthropic"], models: { anthropic: ["~anthropic/claude-opus-latest"] }, plugins: { anthropic: { on: true, ways: ["key"] } } };
  const presence = { providers: [{ id: "anthropic", name: "Anthropic", own_key: true, models: [{ id: "claude-sonnet-5", name: "Claude Sonnet 5" }] }], accounts: [] };
  const fetch = vi.fn(async (path: string | URL | Request, init?: RequestInit) => {
    const route = String(path).split("?")[0];
    if (route === "/me") return Response.json({ ...ME, margin_percent: 30, served_models: [] });
    if (route === "/model-providers") return Response.json(presence);
    if (route === "/plugins/ours") return Response.json({ packages: MAKERS });
    if (route === "/card-choices" && init?.method === "PUT") { choices = (JSON.parse(String(init.body)) as { choices: unknown }).choices; return Response.json({}); }
    if (route === "/card-choices") return Response.json({ choices, pending: null });
    return Response.json({ error: "box_unavailable" }, { status: 409 });
  });
  const backend = new PlatformBackend({ fetch: fetch as typeof globalThis.fetch, eventSource: () => { throw new Error("no stream"); }, clientId: "web-tab", go: vi.fn(), leaving: { set: vi.fn(), take: () => false }, renewing: { set: vi.fn(), take: () => undefined }, now: () => 0, zone: () => "UTC" });
  const view = new PluginsPage({ say: (key, values) => text("en", key as StringKey, values), language: () => "en", backend, me: () => signedIn, ask: vi.fn(), announce: vi.fn(), changed: vi.fn(async () => {}) });
  document.body.append(view.element);
  await backend.me();
  await view.load();
  view.show({ kind: "chat" });
  await settle();
  const claude = view.element.querySelector<HTMLElement>("ol.pl-list > li[data-vendor=anthropic]");
  // Its row lists no series a way serves, so it names no way (「az——A」).
  expect([view.element.querySelector("#vc-in")?.textContent, claude?.querySelector(".pl-row-text")?.textContent]).toEqual(["Vendors in chat1 of 5", "Claude"]);
  expect([...claude!.querySelectorAll<HTMLElement>("button")].map((one) => one.dataset["focus"])).toEqual(["choose anthropic", "out anthropic"]);
  claude!.querySelector<HTMLElement>("[data-focus='out anthropic']")!.click();
  await settle();
  expect(choices).toMatchObject({ vendors: [], models: { anthropic: [] } });
  expect([view.element.querySelector("#vc-in")?.textContent, view.element.querySelector("[data-focus='add anthropic']") !== null]).toEqual(["Vendors in chat0 of 5", true]);
});
