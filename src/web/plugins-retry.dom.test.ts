// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { FIRST_RELEASE, type Backend, type Me } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { PluginsPage } from "./plugins-page.js";
import { clickStub } from "./plugins-test-kit.js";
import { text, type StringKey } from "./strings.js";

const pages: PluginsPage[] = [];
afterEach(() => { for (const page of pages.splice(0)) page.leave(); vi.restoreAllMocks(); document.body.replaceChildren(); });

/** A Plugins page on Yours whose list reads fail until `world.fails` is false, each held until `world.hold` resolves where it is set. */
async function failed() {
  const box = clickStub([]);
  const world: { asked: number; fails: boolean; hold?: Promise<void> } = { asked: 0, fails: true };
  const backend = {
    features: FIRST_RELEASE, links: { signIn: "#in", account: "#account", help: "#help" },
    catalogue: async () => CATALOGUE,
    packages: async () => { world.asked++; await world.hold; if (world.fails) throw new Error("box_slow"); return box.packages(); },
    sources: async () => [], models: async () => undefined, accounts: async () => [], providers: async () => [], modelPlugins: async () => [], series: async () => ({}), chatOffer: async () => undefined,
    readme: async () => undefined, now: () => Date.UTC(2026, 10, 5), npmPackages: async () => ({ packages: [], total: 0, read_at: "2026-11-05T00:00:00Z" }),
  } as unknown as Backend;
  const say = (key: StringKey, values?: Record<string, string | number>): string => text("en", key, values);
  const page = new PluginsPage({ backend, language: () => "en", say: (key, values) => say(key as StringKey, values), me: () => ({ kind: "signed_in", money: { currency: "USD", unitsPerMinor: 10_000 } }) as Extract<Me, { kind: "signed_in" }>, ask: () => undefined, announce: () => undefined, changed: async () => undefined });
  pages.push(page); document.body.append(page.element);
  await page.load();
  page.show({ kind: "home", view: "yours", filter: "all" });
  const retry = (): HTMLButtonElement | null => page.element.querySelector<HTMLButtonElement>("button.pl-retry");
  expect([page.element.querySelector(".pl-unread p")?.textContent, retry()?.textContent]).toEqual([say("pl.unread"), say("pl.tryAgain")]);
  return { page, world, retry, say };
}

const settle = async (): Promise<void> => { for (let n = 0; n < 20; n++) await new Promise((done) => { setTimeout(done, 0); }); };

it("keeps Try again under the pointer through a draw the seller did not ask for, so a press begun before it still reads the list again", async () => {
  const { page, world, retry } = await failed();
  const pressed = retry()!;
  const asked = world.asked;
  // cx's computer says something between the press and the release, and the app draws the page again.
  page.draw();
  // The release lands on what is under the pointer now: a click fires only where the press began.
  expect(retry()).toBe(pressed);
  world.fails = false;
  retry()!.click();
  await settle();
  expect(world.asked).toBe(asked + 1);
  expect(page.element.querySelector(".pl-unread")).toBeNull();
});

it("says the list is on its way the moment Try again is pressed, with nothing to press a second time, and asks cx's computer once", async () => {
  const { page, world, retry, say } = await failed();
  const asked = world.asked;
  let answer!: () => void;
  world.hold = new Promise<void>((done) => { answer = done; });
  retry()!.click();
  await settle();
  const loading = (): string[] => [...page.element.querySelectorAll(".pl-body [aria-label], .pl-body [role=status]")].map((one) => one.getAttribute("aria-label") ?? one.textContent ?? "");
  expect([retry(), page.element.querySelector(".pl-unread"), loading()]).toEqual([null, null, expect.arrayContaining([say("stream.loading")])]);
  // A draw while the read is out says the same, and the read out is the one answered.
  page.draw();
  expect([retry(), page.element.querySelector(".pl-unread")]).toEqual([null, null]);
  expect(world.asked).toBe(asked + 1);
  answer();
  await settle();
  // Failed again, the line and its button are back, and the keyboard on it.
  expect([world.asked, document.activeElement]).toEqual([asked + 1, retry()]);
});
