import { expect, it } from "vitest";
import { CARD_IDS, CARDS, isTenantBase } from "../shared/model-makers.js";
import { DEFAULT_PACKAGES } from "../shared/package-names.js";
import { modelPluginsWith, NOT_PACKAGES } from "../shared/plugin-builds.js";
import type { NpmPackage } from "./backend.js";
import { OFFICIAL, OURS } from "./canned-catalogue.js";
import { ESSENTIALS_ID } from "../shared/bundles.js";
import { catalogueWith } from "./catalogue.js";
import { installPlan, type Held } from "./plugins-model.js";

// A new account's first sign-in seeds the model plugins that install with its first packages; cx Core Bundle's press on the page
// installs the same ones, both read and walked by `src/shared/plugin-builds.ts`.

const pressed = (ours: readonly NpmPackage[]): readonly string[] => {
  const catalogue = catalogueWith(ours, OFFICIAL, () => {});
  const held: Held = { catalogue, packages: [], sources: [], models: [], onImage: [] };
  const essentials = catalogue.bundles.find((one) => one.id === ESSENTIALS_ID)!;
  return installPlan(held, essentials).todo.filter((plugin) => plugin.model !== undefined).map((plugin) => plugin.id);
};
const seeded = (ours: readonly NpmPackage[]): readonly string[] => modelPluginsWith(ours, DEFAULT_PACKAGES);

it("seeds a new account the model plugins cx Core Bundle's press installs, over the preview's records of ours", () => {
  expect(seeded(OURS)).toEqual(["jev"]);
  expect(seeded(OURS)).toEqual(pressed(OURS));
});

it("seeds the model plugin a first package reaches through another of ours, as the press does", () => {
  // Topics → cx-listing-playbook, given here what the playbook does not build on today: Jev.
  const indirect = OURS.map((one) => (one.name === "@comchatx/cx-topics" ? { ...one, comchatx: { ...one.comchatx, builds: ["cx-listing-playbook"] } }
    : one.name === "cx-listing-playbook" ? { ...one, comchatx: { ...one.comchatx, builds: [{ on: "jev", need: "required" }] } } : one));
  expect(pressed(indirect)).toEqual(["jev"]);
  expect(seeded(indirect)).toEqual(pressed(indirect));
});

it("seeds nothing where no first package reaches a model plugin, as the press installs none", () => {
  const none = OURS.map((one) => (one.name === "@comchatx/cx-topics" ? { ...one, comchatx: { ...one.comchatx, builds: [] } } : one));
  expect([seeded(none), pressed(none)]).toEqual([[], []]);
});

it("names as records that are no package the page's own: Jev and the makers' cards, the relay's among them, which the page draws apart", () => {
  const catalogue = catalogueWith(OURS, OFFICIAL, () => {});
  const apart = CARD_IDS.filter((id) => CARDS[id]!.providers.some(isTenantBase));
  expect(apart).toEqual(["relay"]);
  expect([...catalogue.plugins.filter((plugin) => plugin.model !== undefined).map((plugin) => plugin.id), ...apart].sort()).toEqual([...NOT_PACKAGES].sort());
});

/** Topics building on cx-listing-playbook, with `change` made to the records it names. */
const chain = (change: (one: NpmPackage) => NpmPackage): readonly NpmPackage[] =>
  OURS.map((one) => (one.name === "@comchatx/cx-topics" ? { ...one, comchatx: { ...one.comchatx, builds: ["cx-listing-playbook"] } } : one)).map(change);

it("reads a record whose builds do not read under its source's id and its dependencies, so the press reaches Jev through it as the seed does", () => {
  // Topics → cx-listing-playbook, a source `playbook-alias` whose `builds` does not read → Schedule, by its dependency → Jev.
  const ours = chain((one) => (one.name === "cx-listing-playbook" ? { ...one, uses: ["@comchatx/cx-schedule"], comchatx: { ...one.comchatx, source: { name: "playbook-alias", aspects: {} }, builds: "bad" } }
    : one.name === "@comchatx/cx-schedule" ? { ...one, comchatx: { ...one.comchatx, builds: ["jev"] } } : one));
  expect(seeded(ours)).toEqual(["jev"]);
  expect(pressed(ours)).toEqual(seeded(ours));
  expect(catalogueWith(ours, OFFICIAL, () => {}).plugins.find((plugin) => plugin.box?.package === "cx-listing-playbook")?.id).toBe("playbook-alias");
});

it("keeps a link whose why is in one language, leaving the words out, so the press installs what the seed does", () => {
  const ours = OURS.map((one) => (one.name === "@comchatx/cx-topics" ? { ...one, comchatx: { ...one.comchatx, builds: [{ on: "jev", why: { en: "Only English" } }] } } : one));
  expect(seeded(ours)).toEqual(["jev"]);
  expect(pressed(ours)).toEqual(seeded(ours));
  expect(catalogueWith(ours, OFFICIAL, () => {}).plugins.find((plugin) => plugin.id === "cx-topics")?.builds).toEqual([{ on: "jev", need: "required" }]);
});

it("keeps a record's links where its name does not read, so the press installs what the seed does", () => {
  const ours = OURS.map((one) => (one.name === "@comchatx/cx-topics" ? { ...one, comchatx: { ...one.comchatx, name: "", builds: ["jev"] } } : one));
  expect(seeded(ours)).toEqual(["jev"]);
  expect(pressed(ours)).toEqual(seeded(ours));
});

it("draws no link to a provider's package a plugin of ours depends on, holds no stand-in record of it, and presses cx Core Bundle as without it", () => {
  // As npm serves Conversation Titles: it depends on `@comchatx/typesafe`, which the list of ours does not carry.
  const served = OURS.map((one) => (one.name === "@comchatx/cx-topics" ? { ...one, uses: [...one.uses, "@comchatx/typesafe"] } : one));
  const plan = (ours: readonly NpmPackage[]) => {
    const catalogue = catalogueWith(ours, OFFICIAL, () => {});
    const essentials = catalogue.bundles.find((one) => one.id === ESSENTIALS_ID)!;
    return { catalogue, todo: installPlan({ catalogue, packages: [], sources: [], models: [], onImage: [] }, essentials).todo.map((plugin) => plugin.id) };
  };
  const drawn = plan(served);
  const without = plan(OURS);
  expect(drawn.catalogue.plugins.find((plugin) => plugin.id === "cx-topics")!.builds).toEqual(without.catalogue.plugins.find((plugin) => plugin.id === "cx-topics")!.builds);
  expect(drawn.catalogue.plugins.filter((plugin) => plugin.npm === "@comchatx/typesafe" || plugin.box?.package === "@comchatx/typesafe").map((plugin) => plugin.id)).toEqual([]);
  expect([drawn.todo, seeded(served)]).toEqual([without.todo, seeded(OURS)]);
});
