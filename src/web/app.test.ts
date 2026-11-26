import { expect, it } from "vitest";
import { current } from "./app.js";

it("marks the sidebar's entry for the page that is open, and no other", () => {
  expect(current("#/plugins", "#/plugins")).toBe("page");
  // A card stands over the page it was opened on: the page is still the one open.
  expect(current("#/plugins", "#/plugins?card=upload:t:-")).toBe("page");
  expect(current("#/plugins", "#/plugins/p/keepa?card=remove:p:keepa")).toBe("page");
  expect(current("#/plugins", "#/?card=upload:t:-")).toBeUndefined();
  expect(current("#/plugins", "#/plugins/source/keepa")).toBe("page");
  expect(current("#/plugins", "#/")).toBeUndefined();
  expect(current("#/plugins", "#/settings")).toBeUndefined();
  expect(current("#/plugins", "#/pluginsx")).toBeUndefined();
});
