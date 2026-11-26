// @vitest-environment happy-dom
import { expect, it } from "vitest";
import type { Source } from "./backend.js";
import { CATALOGUE } from "./canned-catalogue.js";
import { SourcesBar } from "./sources-bar.js";

const MOTION = { blend: 0.35, wipe: 0.55, hold: 0.5, read: 1.6, hop: { dur: 0.62, rise: 0, perPx: 0, riseMax: 0 }, ease: (u: number) => u };
const source = (name: string, supplier: string): Source => ({ name, supplier, nativeUnit: "requests", aspects: [], enabled: true, spent: 0 }) as unknown as Source;

it("names a source's row as the Plugins page does where the catalogue has a plugin for it, and by its supplier where not", () => {
  const bar = new SourcesBar({
    say: (key, values) => `${key}${JSON.stringify(values)}`, motion: MOTION, money: () => "", href: () => "#/plugins",
    name: (name) => CATALOGUE.plugins.find((one) => one.source?.name === name)?.name, scene: () => undefined as never, reduced: () => true, changed: () => {},
  });
  bar.sources([source("amazon-sp-api", "Amazon-SP-API"), source("unlisted", "Someone Else")]);
  expect([...bar.element.querySelectorAll(".face.base .name")].map((one) => one.textContent)).toEqual(["Amazon SP-API", "Someone Else"]);
  expect([...bar.element.querySelectorAll(".face.base .mark")].map((one) => one.textContent)).toEqual(["A", "S"]);
});

it("reads a row's open tip again when its name changes, and takes the tip away with a row that goes", () => {
  const bar = new SourcesBar({ say: (key, values) => `${key}${JSON.stringify(values)}`, motion: MOTION, money: () => "", href: () => "#/plugins", scene: () => undefined as never, reduced: () => true, changed: () => {} });
  document.body.append(bar.element);
  const shown = (): string | undefined => { const box = document.querySelector<HTMLElement>(".f-tip"); return box === null || box.hidden ? undefined : box.textContent ?? ""; };
  const rows = (): HTMLElement[] => [...bar.element.querySelectorAll<HTMLElement>("a.row")];
  bar.sources([source("one", "First"), source("two", "Second")]);
  rows()[0]!.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
  expect(shown()).toBe("First");
  bar.sources([source("one", "Renamed"), source("two", "Second")]);
  expect(shown()).toBe("Renamed");
  rows()[1]!.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
  expect(shown()).toBe("Second");
  bar.sources([source("one", "Renamed")]);
  expect([rows().length, shown()]).toEqual([1, undefined]);
  document.body.replaceChildren();
});
