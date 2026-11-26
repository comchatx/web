import { describe, expect, it, vi } from "vitest";
import type { Account, Model, Models, Provider } from "./backend.js";
import { NO_VIEW, Picks, afterPick, afterRead, drawnPick, sentPick, SLOTS, cardView, droppedName, glyphSpec, label, modelRows, openingLevel, pickLine, paidBy, paidManyWays, rows, shownModels, shownOnCard, sourceOf, tickedWith, toggled, vendorOf, vendorSlots, type ModelRow, type Row, type Slot, type Shown, type SlotModel, type Source } from "./model-card.js";
import { EMPTY, reduce } from "./stream-model.js";
import { WORDS } from "./canned-catalogue.js";

const say = (key: string, values?: Readonly<Record<string, string | number>>): string => `${key}${values === undefined ? "" : JSON.stringify(values)}`;
const model = (provider: string, id: string, name: string, extra: Partial<Model> = {}): Model => ({ provider, id, name, ...extra });
const provider = (id: string, name: string, ownKey: boolean): Provider => ({ id, name, ownKey, platformKey: false, models: [], rates: [] } as unknown as Provider);
const account = (id: string, name: string, signedIn: boolean): Account => ({ id, name, signedIn, models: [] });
const offer = (one: Model, source: Source = "platform"): SlotModel => ({ ...one, source });
const modelsOf = (level: readonly Row[]): readonly ModelRow[] => level.filter((row): row is ModelRow => row.kind === "model");

/** The platform's aggregator serving two vendors, and the person's own key at one of those vendors and an account at a third. */
const platform = [
  model("balance", "minimax/minimax-m3", "MiniMax: MiniMax M3", { aggregator: true }),
  model("balance", "anthropic/claude-sonnet-5", "Anthropic: Claude Sonnet 5", { aggregator: true }),
  model("balance", "anthropic/claude-opus-5.5", "Anthropic: Claude Opus 5.5", { aggregator: true }),
];
const own = [
  model("anthropic", "claude-opus-5.5", "Claude Opus 5.5", { via: "own key" }),
  model("anthropic", "claude-3-haiku", "Claude 3 Haiku", { via: "own key" }),
  model("openai", "gpt-6-sol", "GPT-6 Sol", { via: "ChatGPT account" }),
  model("openai", "gpt-6-luna", "GPT-6 Luna", { via: "ChatGPT account" }),
];
const providers = [provider("anthropic", "Anthropic", true), provider("openai", "OpenAI", false), provider("openrouter", "OpenRouter", false)];
const accounts = [account("openai", "ChatGPT", true)];
const models = (current: Models["current"], available: readonly Model[] = [...own, ...platform], fallback: Models["default"] = { provider: "balance", id: "minimax/minimax-m3" }): Models => ({ current, available, default: fallback });

describe("a model's vendor", () => {
  it("is the maker an aggregator names ahead of the id and the name, else the provider under its own name", () => {
    expect(vendorOf(platform[1]!, () => undefined, WORDS)).toEqual({ id: "anthropic", name: "Claude", model: "Claude Sonnet 5" });
    expect(vendorOf(model("balance", "Vendor/model", "just a name", { aggregator: true }), () => undefined, WORDS)).toEqual({ id: "vendor", name: "vendor", model: "just a name" });
    expect(vendorOf(own[0]!, (id) => (id === "anthropic" ? "Anthropic" : undefined), WORDS)).toEqual({ id: "anthropic", name: "Claude", model: "Claude Opus 5.5" });
    expect(vendorOf(model("Custom", "x", "X"), () => undefined, WORDS)).toEqual({ id: "custom", name: "Custom", model: "X" });
  });
  it("is the card pi's registry puts the model on, by the card's name: the maker's on the balance or its own provider, a host's own on the host's key", () => {
    expect(vendorOf(model("groq", "openai/gpt-oss-120b", "GPT OSS 120B"), (id) => (id === "groq" ? "Groq" : undefined), WORDS)).toEqual({ id: "groq", name: "Groq", model: "GPT OSS 120B" });
    expect(vendorOf(model("openrouter", "anthropic/claude-sonnet-5", "Anthropic: Claude Sonnet 5"), () => "OpenRouter", WORDS)).toEqual({ id: "openrouter", name: "OpenRouter", model: "Claude Sonnet 5" });
    expect(vendorOf(model("balance", "deepseek/deepseek-v4-flash", "DeepSeek: DeepSeek V4 Flash"), () => undefined, WORDS)).toEqual({ id: "deepseek", name: "DeepSeek", model: "DeepSeek V4 Flash" });
    expect(vendorOf(model("kimi-coding", "k3", "Kimi K3"), () => "Kimi Code", WORDS)).toEqual({ id: "moonshotai", name: "Kimi", model: "Kimi K3" });
    // A model no card is the maker of is its provider's.
    expect(vendorOf(model("groq", "llama-3.3-70b-versatile", "Llama 3.3 70B"), () => "Groq", WORDS)).toEqual({ id: "groq", name: "Groq", model: "Llama 3.3 70B" });
    const groq = vendorSlots(models(undefined, [model("groq", "openai/gpt-oss-120b", "GPT OSS 120B", { via: "Groq" }), own[2]!]), [...providers, provider("groq", "Groq", true)], accounts, WORDS);
    expect(groq.map((slot) => [slot.id, slot.models.map((one) => [one.id, one.through])])).toEqual([["groq", [["openai/gpt-oss-120b", undefined]]], ["openai", [["gpt-6-sol", undefined]]], ["anthropic", []]]);
  });
  it("offers every vendor the person holds a key for before the box answers, whether or not its models can be listed yet; a first tick keeps it", () => {
    const held = [provider("google", "Google", true), provider("xai", "xAI", true), provider("openrouter", "OpenRouter", false)];
    // A key's maker is its card: pi's `xai` is the card `x-ai`, named as the card is.
    const asleep = models(undefined, [model("google", "gemini-3.6-pro", "Gemini 3.6 Pro", { via: "Google" })]);
    const slots = vendorSlots(asleep, held, [], WORDS);
    expect(slots.map((slot) => [slot.id, slot.name, slot.onCard, slot.waiting === true])).toEqual([["google", "Gemini", true, false], ["x-ai", "Grok", true, true]]);
    expect(toggled(slots, undefined, "google", false)).toEqual(["x-ai"]);
    const level = rows(cardView(asleep, held, [], WORDS, undefined), { vendor: "x-ai" });
    expect(level[1]).toEqual({ kind: "waiting" });
    expect(level.filter((row) => row.kind === "model")).toEqual([]);
  });
});

describe("where a model comes from", () => {
  it("is the platform's without a credential of the person's, their key ahead of their account with one", () => {
    expect(sourceOf(platform[0]!, providers, accounts)).toBe("platform");
    expect(sourceOf(own[0]!, providers, accounts)).toBe("key");
    expect(sourceOf(own[2]!, providers, accounts)).toBe("account");
    expect(sourceOf(own[2]!, providers, [])).toBe("key");
  });
  it("is the credential a model's record names, where it names one, whatever the provider's own records hold", () => {
    expect(sourceOf({ ...own[0]!, own: "account" }, providers, accounts)).toBe("account");
    expect(sourceOf({ ...own[2]!, own: "key" }, [], accounts)).toBe("key");
    expect(sourceOf({ ...platform[0]!, own: "key" }, providers, accounts)).toBe("platform");
  });
});

describe("the vendor slots", () => {
  const slots = vendorSlots(models(undefined), providers, accounts, WORDS);
  it("hold every vendor once, the person's first in the order their models are listed, then the platform's, each tagged with the person's own way to it", () => {
    expect(slots.map((slot) => [slot.id, slot.name, slot.source])).toEqual([["anthropic", "Claude", "key"], ["openai", "GPT", "account"], ["minimax", "MiniMax", "platform"]]);
  });
  it("list every record the box reports of a vendor, the person's and the platform's side by side in the order listed, each with the way it is paid", () => {
    expect(slots[0]!.models.map((one) => [`${one.provider}/${one.id}`, one.source, one.through])).toEqual([
      ["anthropic/claude-opus-5.5", "key", undefined],
      ["anthropic/claude-3-haiku", "key", undefined],
      ["balance/anthropic/claude-sonnet-5", "platform", "balance"],
      ["balance/anthropic/claude-opus-5.5", "platform", "balance"],
    ]);
    expect(slots[1]!.models.map((one) => [one.id, one.source])).toEqual([["gpt-6-sol", "account"], ["gpt-6-luna", "account"]]);
    expect(slots[2]!.models.map((one) => [one.id, one.source, one.through])).toEqual([["minimax/minimax-m3", "platform", "balance"]]);
    // A vendor paid more than one way names each row's way; one paid a single way leaves that to its own tag.
    expect(slots.map((slot) => paidManyWays(slot))).toEqual([true, false, false]);
    expect(slots[0]!.models.map((one) => paidBy(one, say))).toEqual(["card.key", "card.key", "card.platform", "card.platform"]);
  });
  it("list the platform's models of a vendor the person has no credential for", () => {
    const platformOnly = vendorSlots(models(undefined, platform), providers, accounts, WORDS);
    expect(platformOnly.map((slot) => [slot.id, slot.source, slot.models.length])).toEqual([["minimax", "platform", 1], ["anthropic", "platform", 2]]);
  });
  it("list a model a host's key reaches on the host's own card, never the maker's beside the maker's key, with the tick on the record the session is on", () => {
    const keys = [provider("anthropic", "Anthropic", true), provider("openrouter", "OpenRouter", true)];
    const both = [
      model("openrouter", "anthropic/claude-opus-5.5", "Anthropic: Claude Opus 5.5", { via: "OpenRouter", aggregator: true }),
      model("anthropic", "claude-opus-5-5", "Claude Opus 5.5", { via: "Anthropic" }),
    ];
    const view = cardView(models({ provider: "openrouter", id: "anthropic/claude-opus-5.5" }, both, undefined), keys, [], WORDS);
    expect(view.slots.map((slot) => [slot.id, slot.source, slot.models.length])).toEqual([["openrouter", "key", 1], ["anthropic", "key", 1]]);
    const listed = (vendor: string) => modelsOf(rows(view, { vendor })).map((row) => [`${row.model.provider}/${row.model.id}`, row.inUse, paidBy(row.model, say)]);
    expect([listed("openrouter"), listed("anthropic")]).toEqual([[["openrouter/anthropic/claude-opus-5.5", true, "card.key"]], [["anthropic/claude-opus-5-5", false, "card.key"]]]);
    expect(rows(view, "vendors")[1]).toMatchObject({ kind: "vendor", slot: { id: "openrouter" }, inUse: true });
  });
  it("list two models of one name as two rows: a row is a record, not a name", () => {
    const keys = [provider("vercel-ai-gateway", "Vercel AI Gateway", true), provider("mistral", "Mistral", true)];
    const named = [
      model("vercel-ai-gateway", "openai/gpt-5.2", "GPT 5.2", { via: "Vercel AI Gateway" }),
      model("vercel-ai-gateway", "openai/gpt-5.2-pro", "GPT 5.2", { via: "Vercel AI Gateway" }),
      model("mistral", "devstral-2512", "Devstral 2", { via: "Mistral" }),
      model("mistral", "devstral-latest", "Devstral 2", { via: "Mistral" }),
    ];
    const view = cardView(models({ provider: "vercel-ai-gateway", id: "openai/gpt-5.2-pro" }, named, undefined), keys, [], WORDS);
    expect(view.slots.map((slot) => [slot.id, slot.models.map((one) => one.id)])).toEqual([["vercel-ai-gateway", ["openai/gpt-5.2", "openai/gpt-5.2-pro"]], ["mistralai", ["devstral-2512", "devstral-latest"]]]);
    expect(modelsOf(rows(view, { vendor: "vercel-ai-gateway" })).map((row) => [row.model.id, row.inUse, row.tagged])).toEqual([["openai/gpt-5.2", false, false], ["openai/gpt-5.2-pro", true, false]]);
    expect(modelsOf(rows(view, { vendor: "mistralai" })).map((row) => row.model.id)).toEqual(["devstral-2512", "devstral-latest"]);
  });
  it("are empty with nothing on offer", () => {
    expect(vendorSlots(models(undefined, []), [], [], WORDS)).toEqual([]);
  });
});

describe("what the card shows of a slot", () => {
  const slot = (count: number, onCard: boolean): Slot => ({ id: "v", name: "V", source: "platform", onCard, models: Array.from({ length: count }, (_, at) => offer(model("p", `m${at}`, `M${at}`))) });
  it("is up to five models of a vendor on the card, and none of one off it", () => {
    expect(shownOnCard(slot(3, true))).toBe(3);
    expect(shownOnCard(slot(SLOTS + 2, true))).toBe(SLOTS);
    expect(shownOnCard(slot(2, false))).toBe(0);
  });
});

describe("the vendors the person ticks", () => {
  /** Seven vendors, one model each, all the platform's: more than the card has places for. */
  const seven = ["v1", "v2", "v3", "v4", "v5", "v6", "v7"].map((vendor) => model("balance", `${vendor}/m`, `${vendor.toUpperCase()}: M`, { aggregator: true }));
  const onCard = (slots: readonly Slot[]): readonly string[] => slots.filter((slot) => slot.onCard).map((slot) => slot.id);
  it("with none recorded, leave the card to the first five as they are listed", () => {
    const slots = vendorSlots(models(undefined, seven, undefined), [], [], WORDS);
    expect(onCard(slots)).toEqual(["v1", "v2", "v3", "v4", "v5"]);
    expect(slots.map((slot) => slot.id)).toEqual(["v1", "v2", "v3", "v4", "v5", "v6", "v7"]);
  });
  it("take the card's places in the order ticked and come first, however few; the rest follow off the card as they are listed", () => {
    const slots = vendorSlots(models(undefined, seven, undefined), [], [], WORDS, ["v7", "v2"]);
    expect(onCard(slots)).toEqual(["v7", "v2"]);
    expect(slots.map((slot) => slot.id)).toEqual(["v7", "v2", "v1", "v3", "v4", "v5", "v6"]);
    expect(onCard(vendorSlots(models(undefined, seven, undefined), [], [], WORDS, []))).toEqual([]);
  });
  it("are the vendors the card's first level draws, in their order", () => {
    const view = cardView(models(undefined, seven, undefined), [], [], WORDS, ["v6", "v3"]);
    expect(rows(view, "vendors").map((row) => (row.kind === "vendor" ? row.slot.id : row.kind))).toEqual(["default", "v6", "v3", "others"]);
  });
  it("hold at most five places, once each, as recorded: a ticked vendor with nothing on offer keeps its place, marked unavailable", () => {
    const slots = vendorSlots(models(undefined, seven, undefined), [], [], WORDS, ["gone", "v6", "v6", "v1", "v2", "v3", "v4", "v5"]);
    expect(onCard(slots)).toEqual(["gone", "v6", "v1", "v2", "v3"]);
    expect(slots[0]).toMatchObject({ id: "gone", unavailable: true, models: [] });
    expect(rows(cardView(models(undefined, seven, undefined), [], [], WORDS, ["gone", "v6"]), "vendors").map((row) => (row.kind === "vendor" ? row.slot.id : row.kind))).toEqual(["default", "v6", "others"]);
  });
  it("draw five saved ticks with one no longer offered; unticking it frees a place a new tick then takes", () => {
    const saved = ["v1", "v2", "gone", "v3", "v4"];
    const slots = vendorSlots(models(undefined, seven, undefined), [], [], WORDS, saved);
    expect(slots.filter((slot) => slot.onCard).length).toBe(5);
    expect(toggled(slots, saved, "v5", true)).toEqual(saved);
    const freed = toggled(slots, saved, "gone", false);
    expect(freed).toEqual(["v1", "v2", "v3", "v4"]);
    expect(toggled(vendorSlots(models(undefined, seven, undefined), [], [], WORDS, freed), freed, "v5", true)).toEqual(["v1", "v2", "v3", "v4", "v5"]);
  });
  it("change one at a time from the ticks recorded, or the places as they stand with none: a tick added while a place is free, an untick taken out", () => {
    const listed = vendorSlots(models(undefined, seven, undefined), [], [], WORDS);
    expect(toggled(listed, undefined, "v3", false)).toEqual(["v1", "v2", "v4", "v5"]);
    expect(toggled(listed, undefined, "v6", true)).toEqual(["v1", "v2", "v3", "v4", "v5"]);
    const two = vendorSlots(models(undefined, seven, undefined), [], [], WORDS, ["v7", "v2"]);
    expect(toggled(two, ["v7", "v2"], "v4", true)).toEqual(["v7", "v2", "v4"]);
    expect(toggled(two, ["v7", "v2"], "v7", true)).toEqual(["v7", "v2"]);
  });
  it("keep a ticked vendor with nothing on offer now, and never give its place away: only the person unticks it", () => {
    const recorded = ["gone", "v1"];
    const slots = vendorSlots(models(undefined, seven, undefined), [], [], WORDS, recorded);
    expect(toggled(slots, recorded, "v2", true)).toEqual(["gone", "v1", "v2"]);
    expect(toggled(slots, recorded, "v1", false)).toEqual(["gone"]);
    const full = ["v1", "gone", "v2", "v3", "v4"];
    expect(toggled(vendorSlots(models(undefined, seven, undefined), [], [], WORDS, full), full, "v5", true)).toEqual(full);
  });
  it("change only by the person's own tick while the box sleeps: a full card takes no sixth, and a key added then takes no place", () => {
    const five = ["v1", "v2", "v3", "v4", "v5"];
    // Asleep, the platform stands in with its default alone: none of the five is listed.
    const standIn = vendorSlots(models(undefined, [model("balance", "d/default", "D: Default", { aggregator: true })], undefined), [], [], WORDS, five);
    expect(toggled(standIn, five, "d", true)).toEqual(five);
    const withKey = vendorSlots(models(undefined, [model("balance", "d/default", "D: Default", { aggregator: true })], undefined), [provider("deepseek", "DeepSeek", true)], [], WORDS, five);
    expect(tickedWith(five, withKey, "deepseek")).toEqual(five);
  });
  it("put a newly added credential's one vendor on the card while a place is free, and nothing else", () => {
    const withKey = [...seven.slice(0, 3), model("anthropic", "claude-opus-5.5", "Claude Opus 5.5", { via: "Anthropic" })];
    const keys = [provider("anthropic", "Anthropic", true)];
    const recorded = ["v1"];
    expect(tickedWith(recorded, vendorSlots(models(undefined, withKey, undefined), keys, [], WORDS, recorded), "anthropic")).toEqual(["v1", "anthropic"]);
    expect(tickedWith(undefined, vendorSlots(models(undefined, withKey, undefined), keys, [], WORDS), "anthropic")).toBeUndefined();
    const full = ["v1", "v2", "v3", "v4", "v5"];
    const crowded = [...seven, model("anthropic", "claude-opus-5.5", "Claude Opus 5.5", { via: "Anthropic" })];
    expect(tickedWith(full, vendorSlots(models(undefined, crowded, undefined), keys, [], WORDS, full), "anthropic")).toBe(full);
    // A host's key is a card of its own, whatever makers it serves: the host takes the place.
    const viaAggregator = [...seven.slice(0, 2), ...["x", "y"].map((vendor) => model("openrouter", `${vendor}/m`, `${vendor}: M`, { aggregator: true, via: "OpenRouter" }))];
    expect(tickedWith(recorded, vendorSlots(models(undefined, viaAggregator, undefined), [provider("openrouter", "OpenRouter", true)], [], WORDS, recorded), "openrouter")).toEqual(["v1", "openrouter"]);
    // Before the box lists a key's models, the provider's card is its vendor, a host's own card too.
    const unlisted = vendorSlots(models(undefined, seven.slice(0, 2), undefined), [], [], WORDS, recorded);
    expect(tickedWith(recorded, unlisted, "DeepSeek")).toEqual(["v1", "deepseek"]);
    expect(tickedWith(recorded, unlisted, "openrouter")).toEqual(["v1", "openrouter"]);
  });
});

describe("the dropped default's name", () => {
  it("names the model as the list does where it still holds it, else by its own id without the platform's route", () => {
    const listed = [{ provider: "balance", id: "moonshotai/kimi-k2.6", name: "MoonshotAI: Kimi K2.6" }];
    expect(droppedName("balance/moonshotai/kimi-k2.6", listed)).toBe("Kimi K2.6");
    expect(droppedName("balance/moonshotai/kimi-k2.6", [])).toBe("moonshotai/kimi-k2.6");
    expect(droppedName("anthropic/claude-opus-5-5", [])).toBe("claude-opus-5-5");
    expect(droppedName("lone", [])).toBe("lone");
  });
});

describe("the card's view", () => {
  it("lists the record's offer where it keeps series, its vendors in their order, and knows the model in use by everything on offer", () => {
    const opus = { ...own[0]!, series: "Claude Opus" };
    const offer = { vendors: ["anthropic"], models: [opus], places: ["anthropic"] };
    const view = cardView(models({ provider: "openai", id: "gpt-6-sol" }), providers, accounts, WORDS, ["openai", "anthropic"], undefined, offer);
    expect(view.slots.map((slot) => [slot.id, slot.name, slot.onCard, slot.models.map((one) => one.id)])).toEqual([["anthropic", "Claude", true, ["claude-opus-5.5"]]]);
    expect(view.current).toMatchObject({ vendor: "openai", vendorName: "GPT", served: true });
    expect(view.byRecord).toBe(true);
    expect(cardView(models(undefined), providers, accounts, WORDS, undefined, undefined, { vendors: [], models: [], places: [] }).slots.filter((slot) => slot.onCard)).toEqual([]);
    expect(cardView(models(undefined), providers, accounts, WORDS)).not.toHaveProperty("byRecord");
  });

  it("names the model in use with its vendor, and holds the default the card returns to by provider and id alone", () => {
    const view = cardView(models({ provider: "anthropic", id: "claude-opus-5.5" }), providers, accounts, WORDS);
    expect(view.current).toEqual({ provider: "anthropic", id: "claude-opus-5.5", name: "Claude Opus 5.5", vendor: "anthropic", vendorName: "Claude", served: true, chosen: false, source: "key" });
    expect(view.default).toEqual({ provider: "balance", id: "minimax/minimax-m3" });
    expect(label(view, say)).toBe("Claude · Claude Opus 5.5");
  });
  it("keeps a session's model that is no longer offered as the one in use, said as not served, under the name the box gave it", () => {
    const view = cardView(models({ provider: "anthropic", id: "removed", name: "Removed" }), providers, accounts, WORDS);
    expect(view.current).toEqual({ provider: "anthropic", id: "removed", name: "Removed", vendor: "anthropic", vendorName: "Claude", served: false, chosen: false });
    expect(cardView(models({ provider: "elsewhere", id: "gone" }), [], [], WORDS).current).toMatchObject({ name: "gone", vendor: "elsewhere", vendorName: "elsewhere", served: false });
  });
  it("has no vendor, no model in use and no default with nothing on offer, and says choose while models are offered and none is in use", () => {
    expect(cardView({ current: undefined, available: [] }, [], [], WORDS)).toEqual(NO_VIEW);
    expect(Object.isFrozen(NO_VIEW)).toBe(true);
    expect(label(cardView(models(undefined), providers, accounts, WORDS), say)).toBe("model.choose");
  });
  it("names the version in use by its own full name on the closed line, where it is offered by series too, under Default as well", () => {
    const bySeries = [...own.map((one) => (one.id === "claude-opus-5.5" ? { ...one, series: "Claude Opus" } : one)), ...platform.map((one) => (one.id === "minimax/minimax-m3" ? { ...one, series: "MiniMax M" } : one))];
    expect(label(cardView(models({ provider: "anthropic", id: "claude-opus-5.5" }, bySeries), providers, accounts, WORDS), say)).toBe("Claude · Claude Opus 5.5");
    expect(label(cardView(models({ provider: "balance", id: "minimax/minimax-m3" }, bySeries), providers, accounts, WORDS), say)).toBe("card.default · MiniMax M3");
    expect(label(cardView(models({ provider: "anthropic", id: "claude-opus-5.5" }), providers, accounts, WORDS), say)).toBe("Claude · Claude Opus 5.5");
  });

  it("says Default with today's model on the line while the Default row's pick is in use, and the name alone once it was picked by name", () => {
    const current = { provider: "balance", id: "minimax/minimax-m3" };
    expect(label(cardView(models(current), providers, accounts, WORDS), say)).toBe("card.default · MiniMax M3");
    // The same model picked by its name is that name, never Default in its place; its vendor's row is the one ticked.
    const byName = cardView(models(current), providers, accounts, WORDS, undefined, current);
    expect(label(byName, say)).toBe("MiniMax · MiniMax M3");
    expect(rows(byName, "vendors").find((row) => row.kind === "default")).toEqual({ kind: "default", inUse: false });
    expect(openingLevel(byName)).toEqual({ vendor: "minimax" });
  });
  it("names the platform's default Default on the line even before the box offers it, and marks it as one no row can choose", () => {
    const view = cardView(models({ provider: "balance", id: "minimax/minimax-m3" }, own), providers, accounts, WORDS);
    expect(view.default).toEqual({ provider: "balance", id: "minimax/minimax-m3", unlisted: true });
    // Before the box lists it the model has only its id, so the line says Default alone.
    expect(label(view, say)).toBe("card.default");
  });
});

describe("the rows", () => {
  const kinds = (level: Parameters<typeof rows>[1], current: Models["current"] = undefined): readonly Row["kind"][] => rows(cardView(models(current), providers, accounts, WORDS), level).map((row) => row.kind);
  it("are as many as the level has, no blank row filling it out: default, the vendors on the card, others", () => {
    expect(kinds("vendors")).toEqual(["default", "vendor", "vendor", "vendor", "others"]);
    expect(rows(cardView(models(undefined), providers, accounts, WORDS), "vendors")[0]).toEqual({ kind: "default", inUse: false });
  });
  it("are as many on a vendor's level: back, its models in the order listed up to five, then others naming the vendor", () => {
    expect(kinds({ vendor: "anthropic" })).toEqual(["back", "model", "model", "model", "model", "others"]);
    const level = rows(cardView(models(undefined), providers, accounts, WORDS), { vendor: "anthropic" });
    expect(level[0]).toMatchObject({ kind: "back", slot: { id: "anthropic" } });
    expect(level.at(-1)).toEqual({ kind: "others", vendor: "anthropic" });
    const many = Array.from({ length: SLOTS + 3 }, (_, at) => model("p", `m${at}`, `M${at}`));
    const level2 = rows(cardView(models(undefined, many, undefined), [], [], WORDS), { vendor: "p" });
    expect(level2.filter((row) => row.kind === "model").map((row) => (row as Extract<Row, { kind: "model" }>).model.id)).toEqual(["m0", "m1", "m2", "m3", "m4"]);
  });
  it("mark the row in use: the default row alone while the default is in use, so no tick names its model; else the vendor, and the model on its level", () => {
    const fallback = { provider: "balance", id: "minimax/minimax-m3" };
    const onDefault = rows(cardView(models(fallback), providers, accounts, WORDS), "vendors");
    expect(onDefault.map((row) => "inUse" in row && row.inUse)).toEqual([true, false, false, false, false]);
    const defaultsVendor = rows(cardView(models(fallback), providers, accounts, WORDS), { vendor: "minimax" });
    expect(modelsOf(defaultsVendor).map((row) => [row.model.id, row.inUse])).toEqual([["minimax/minimax-m3", false]]);
    const onVendor = rows(cardView(models({ provider: "anthropic", id: "claude-3-haiku" }), providers, accounts, WORDS), "vendors");
    expect(onVendor.map((row) => "inUse" in row && row.inUse)).toEqual([false, true, false, false, false]);
    const level = rows(cardView(models({ provider: "anthropic", id: "claude-3-haiku" }), providers, accounts, WORDS), { vendor: "anthropic" });
    expect(level.map((row) => "inUse" in row && row.inUse)).toEqual([false, false, true, false, false, false]);
  });
  it("open on the vendors when the level names a vendor no longer offered", () => {
    expect(kinds({ vendor: "gone" })).toEqual(kinds("vendors"));
  });
});

describe("the model rows", () => {
  it("list every model given for the plugins page, the one in use marked, beyond the five the card shows", () => {
    const seven = Array.from({ length: SLOTS + 2 }, (_, at) => offer(model("x", `m${at}`, `M ${at}`)));
    const all = modelRows(seven, { current: { provider: "x", id: "m3" } }, false);
    expect(all.map((row) => [row.kind, row.model.id, row.inUse, row.tagged])).toEqual(seven.map((one) => ["model", one.id, one.id === "m3", false]));
    expect(modelRows(seven, { current: undefined }, true).every((row) => row.tagged)).toBe(true);
    expect(modelRows(seven, { current: { provider: "x", id: "m3" }, default: { provider: "x", id: "m3" } }, false).map((row) => row.inUse)).toEqual(seven.map(() => false));
    expect(modelRows(seven, { current: { provider: "x", id: "m3" }, default: { provider: "x", id: "m4" } }, false).map((row) => row.inUse)).toEqual(seven.map((one) => one.id === "m3"));
  });
});

describe("a vendor's glyph", () => {
  it("is a shape its id picks, the same every time, and its name's first letter in capitals", () => {
    expect(glyphSpec({ id: "anthropic", name: "anthropic" })).toEqual(glyphSpec({ id: "anthropic", name: "Anthropic" }));
    expect(glyphSpec({ id: "anthropic", name: "anthropic" }).letter).toBe("A");
    expect(glyphSpec({ id: "x", name: "  " }).letter).toBe("?");
    expect(glyphSpec({ id: "kimi", name: "月之暗面" }).letter).toBe("月");
    const shapes = new Set(["anthropic", "openai", "minimax", "moonshot", "zhipu", "google", "deepseek", "xai"].map((id) => glyphSpec({ id, name: id }).shape));
    expect(shapes.size).toBeGreaterThan(1);
  });
});

describe("the model the card shows while the box sleeps", () => {
  const change = (provider: string, modelId: string) => ({ kind: "record" as const, key: `${provider}/${modelId}`, form: "model_change", body: { provider, modelId } });
  const platform = { provider: "balance", id: "minimax/minimax-m3", name: "minimax/minimax-m3" };
  const heardModel = { provider: "anthropic", id: "claude-opus-5.5", name: "Claude Opus 5.5" };
  const asked = { current: undefined, available: [platform], default: { provider: "balance", id: "minimax/minimax-m3" } };
  const shown = (...args: Parameters<typeof shownModels>): Shown => shownModels(...args)!;
  it("is pi's last record while the box sleeps, over the models the backend offers; a pick the platform keeps for the next message is shown as chosen", () => {
    const items = [change("balance", "minimax/minimax-m3"), change("anthropic", "claude-opus-5.5")];
    expect(shownModels(asked, { awake: false, pending: undefined, stream: { ...EMPTY, items }, heard: true })).toEqual({ ...asked, current: { provider: "anthropic", id: "claude-opus-5.5" } });
    expect(shownModels(asked, { awake: false, pending: { provider: "balance", modelId: "minimax/minimax-m3" }, stream: { ...EMPTY, items }, heard: true }))
      .toEqual({ ...asked, current: { provider: "balance", id: "minimax/minimax-m3" }, chosen: true });
    // A life the page holds no record of names no model: the person's pick may be in a part not loaded.
    expect(shown(asked, { awake: false, pending: undefined, stream: { ...EMPTY, epoch: "e1", items: [] }, heard: true }).current).toBeUndefined();
  });
  it("is the model the box last answered, as the platform keeps it, where the stream names none; pi's record and a waiting pick outrank it, and an account with none kept whose box never answered is on the default", () => {
    const kept = { ...asked, current: { provider: "anthropic", id: "claude-opus-5.5", name: "Claude Opus 5.5" } };
    const life = { ...EMPTY, epoch: "e1", items: [] };
    expect(shown(kept, { awake: false, pending: undefined, stream: life, heard: true }).current).toEqual(kept.current);
    expect(shown(kept, { awake: false, pending: undefined, stream: { ...life, items: [change("balance", "minimax/minimax-m3")] }, heard: true }).current).toEqual({ provider: "balance", id: "minimax/minimax-m3" });
    expect(shown(kept, { awake: false, pending: { provider: "balance", modelId: "minimax/minimax-m3" }, stream: life, heard: true })).toMatchObject({ current: { provider: "balance", id: "minimax/minimax-m3" }, chosen: true });
    const fresh = cardView(shown(asked, { awake: false, pending: undefined, stream: EMPTY, heard: true }), [], [], WORDS);
    expect(label(fresh, (key: string) => key)).toBe("card.default");
  });
  it("is the platform's default, the Default row in use, where the stream answered that the box has never had a life: a new account sends on it unpressed", () => {
    const say = (key: string): string => key;
    const fresh = shown(asked, { awake: false, pending: undefined, stream: EMPTY, heard: true });
    expect(fresh.current).toEqual({ provider: "balance", id: "minimax/minimax-m3" });
    const view = cardView(fresh, [], [], WORDS);
    // The default named only by its id is Default alone, as the line says it before the box lists it.
    expect(label(view, say)).toBe("card.default");
    expect(rows(view, "vendors")[0]).toEqual({ kind: "default", inUse: true });
    // A pick the person made still outranks it, and a platform that names no default leaves the line to say Choose a model.
    expect(shown(asked, { awake: false, pending: { provider: "anthropic", modelId: "claude-opus-5.5" }, stream: EMPTY, heard: true }).current).toEqual({ provider: "anthropic", id: "claude-opus-5.5" });
    expect(shown({ current: undefined, available: [platform] }, { awake: false, pending: undefined, stream: EMPTY, heard: true }).current).toBeUndefined();
  });
  it("is pi's last record of the whole conversation, whichever parts are loaded: one in an earlier part is read as the platform named it with the newest", () => {
    const newest = { ...EMPTY, items: [], from: 24, earlier: true, model: { provider: "anthropic", id: "claude-opus-5.5" } };
    expect(shown(asked, { awake: false, pending: undefined, stream: newest, heard: true }).current).toEqual({ provider: "anthropic", id: "claude-opus-5.5" });
    // A record in the part the page holds is later than any before it.
    expect(shown(asked, { awake: false, pending: undefined, stream: { ...newest, items: [change("balance", "minimax/minimax-m3")] }, heard: true }).current).toEqual({ provider: "balance", id: "minimax/minimax-m3" });
  });
  it("says nothing asleep until the stream has answered, since the page says no model it has not read", () => {
    expect(shownModels(asked, { awake: false, pending: undefined, stream: EMPTY, heard: false })).toBeUndefined();
    expect(shown(asked, { awake: false, pending: { provider: "balance", modelId: "minimax/minimax-m3" }, stream: EMPTY, heard: false }).chosen).toBe(true);
  });
  it("is what pi says while the box answers and nothing is pending", () => {
    const awake = { current: heardModel, available: [heardModel, platform] };
    expect(shownModels(awake, { awake: true, pending: undefined, stream: { ...EMPTY, items: [change("balance", "x")] }, heard: true })).toBe(awake);
  });
  it("keeps, as the box wakes, the model the stream last said until a read made since it woke names one", () => {
    const slept = { current: undefined, available: [heardModel, platform] };
    expect(shownModels(slept, { awake: true, pending: undefined, stream: { ...EMPTY, items: [change("balance", "x")] }, heard: true })).toEqual({ ...slept, current: { provider: "balance", id: "x" } });
    expect(shownModels(slept, { awake: true, pending: undefined, stream: EMPTY, heard: false })).toBeUndefined();
  });
  it("keeps the model it named asleep while the box wakes and pi has not yet said what it runs on, so the line says one name and never Choose a model", () => {
    const items = [change("anthropic", "claude-opus-5.5")];
    const waking = { current: undefined, available: [heardModel, platform] };
    const say = (key: string): string => key;
    const asleep = label(cardView(shown(waking, { awake: false, pending: undefined, stream: { ...EMPTY, items }, heard: true }), [], [], WORDS), say);
    const woken = label(cardView(shown(waking, { awake: true, pending: undefined, stream: { ...EMPTY, items }, heard: true }), [], [], WORDS), say);
    expect([asleep, woken]).toEqual(["Claude · Claude Opus 5.5", "Claude · Claude Opus 5.5"]);
    expect(shown(waking, { awake: true, pending: undefined, stream: EMPTY, heard: false, taken: { provider: "anthropic", modelId: "claude-opus-5.5" } }).current).toEqual({ provider: "anthropic", id: "claude-opus-5.5" });
  });
  it("item 1: draws a pending pick as chosen awake or asleep, since pi has not taken it yet, and pi's model once none waits", () => {
    const awake = { current: heardModel, available: [heardModel, platform] };
    const pending = { provider: "balance", modelId: "minimax/minimax-m3" };
    const say = (key: string, values?: Readonly<Record<string, string | number>>) => key === "card.chosenLine" ? `${values?.["model"]} (chosen)` : key;
    expect(label(cardView(shown(asked, { awake: false, pending, stream: { ...EMPTY, items: [] }, heard: true }), [], [], WORDS), say)).toBe("card.default (chosen)");
    // A pending pick the box has not listed has only its id: Default alone, said as chosen.
    expect(shownModels(awake, { awake: true, pending, stream: { ...EMPTY, items: [] }, heard: true })).toEqual({ ...awake, current: { provider: "balance", id: "minimax/minimax-m3" }, chosen: true });
    expect(label(cardView(shown(awake, { awake: true, pending, stream: { ...EMPTY, items: [] }, heard: true }), [], [], WORDS), say)).toBe("MiniMax · minimax/minimax-m3 (chosen)");
    expect(label(cardView(shown(awake, { awake: true, pending: undefined, stream: { ...EMPTY, items: [] }, heard: true }), [], [], WORDS), say)).toBe("Claude · Claude Opus 5.5");
  });
  it("item 1: draws the person's pick at the click as its answer will: in use while the box is awake, chosen while it sleeps, over any pending pick and any record", () => {
    const awake = { current: heardModel, available: [heardModel, platform] };
    const picked = { provider: "anthropic", modelId: "claude-opus-5.5" };
    const pending = { provider: "balance", modelId: "minimax/minimax-m3" };
    const say = (key: string, values?: Readonly<Record<string, string | number>>) => key === "card.chosenLine" ? `${values?.["model"]} (chosen)` : key;
    expect(label(cardView(shown({ ...awake, current: platform }, { awake: true, picked, pending: undefined, stream: EMPTY, heard: true }), [], [], WORDS), say)).toBe("Claude · Claude Opus 5.5");
    expect(label(cardView(shown(asked, { awake: false, picked, pending, stream: { ...EMPTY, items: [change("balance", "x")] }, heard: true }), [], [], WORDS), say)).toBe("Claude · claude-opus-5.5 (chosen)");
    // Before the stream answers the page names no model of the record's, but the person's own pick it does.
    expect(shown(asked, { awake: false, picked, pending: undefined, stream: EMPTY, heard: false }).current).toEqual({ provider: "anthropic", id: "claude-opus-5.5" });
  });
  it("draws the card on a sleeping box, the default ticked on the default's record", () => {
    const view = cardView(shown(asked, { awake: false, pending: undefined, stream: { ...EMPTY, items: [change("balance", "minimax/minimax-m3")] }, heard: true }), [], [], WORDS, undefined);
    expect(view.current).toMatchObject({ provider: "balance", id: "minimax/minimax-m3" });
    expect(view.default).toBeDefined();
  });
});

describe("the person's picks", () => {
  it("go one at a time: five quick picks send the first and then the fifth, which stands", async () => {
    const sent: string[] = [];
    let release: () => void = () => undefined;
    const settled = vi.fn();
    const picks = new Picks(({ provider, modelId }) => {
      sent.push(`${provider}/${modelId}`);
      return sent.length === 1 ? new Promise<"taken">((resolve) => { release = () => resolve("taken"); }) : Promise.resolve("taken" as const);
    }, settled);
    const done = picks.choose("p", "m1");
    for (const n of [2, 3, 4, 5]) void picks.choose("p", `m${n}`);
    let idle = false;
    void picks.idle().then(() => { idle = true; });
    await Promise.resolve();
    expect(idle).toBe(false);
    expect(sent).toEqual(["p/m1"]);
    release();
    await done;
    expect(sent).toEqual(["p/m1", "p/m5"]);
    await picks.idle();
    // Both answers are given, in order: the first says where the computer went, the fifth where it stands.
    expect(settled.mock.calls).toEqual([[{ provider: "p", modelId: "m1" }, "taken"], [{ provider: "p", modelId: "m5" }, "taken"]]);
    expect(picks.failed).toBeUndefined();
  });

  it("name the model an earlier pick moved the computer to when a later pick is refused", async () => {
    let glance = { models: models({ provider: "openai", id: "gpt-6-sol" }), pending: undefined };
    let release: () => void = () => undefined;
    const picks = new Picks(({ modelId }) => modelId === "claude-opus-5.5"
      ? new Promise<"taken">((resolve) => { release = () => resolve("taken"); })
      : Promise.reject(new Error("model_refused")), (pick, answer) => { glance = afterPick(glance, pick, answer); });
    const done = picks.choose("anthropic", "claude-opus-5.5");
    void picks.choose("openai", "gpt-6-luna");
    expect(picks.held).toEqual({ provider: "openai", modelId: "gpt-6-luna" });
    release();
    await done;
    expect(picks.failed).toBe("model.pickRefused");
    expect(pickLine(picks.failed, cardView(glance.models, providers, accounts, WORDS), say)).toBe('model.pickRefused{"model":"Claude · Claude Opus 5.5"}');
  });

  it("item 1: hold the newest pick from the click until its answer, and count every pick, so a read begun before one knows it is older", async () => {
    let answer: (state: "pending") => void = () => undefined;
    const answered = vi.fn();
    const picks = new Picks(() => new Promise<"pending">((resolve) => { answer = resolve; }), answered);
    expect(picks.held).toBeUndefined();
    const done = picks.choose("p", "m1");
    expect(picks.held).toEqual({ provider: "p", modelId: "m1" });
    expect(picks.made).toBe(1);
    answer("pending");
    await done;
    expect(picks.held).toBeUndefined();
    expect(answered).toHaveBeenCalledWith({ provider: "p", modelId: "m1" }, "pending");
    const failing = new Picks(async () => { throw new Error("model_refused"); }, answered);
    await failing.choose("p", "m2");
    // A refusal lets go of the pick, so the line goes back to what the record says, in the refusal's words.
    expect(failing.held).toBeUndefined();
    expect(answered).toHaveBeenLastCalledWith({ provider: "p", modelId: "m2" }, undefined);
    expect(failing.failed).toBe("model.pickRefused");
  });

  it("remember the model last picked by name, and forget it at a pick of the Default row", async () => {
    const picks = new Picks(async () => "taken" as const, () => undefined);
    void picks.choose("openrouter", "minimax/minimax-m3");
    expect(picks.byName).toEqual({ provider: "openrouter", id: "minimax/minimax-m3" });
    void picks.choose("openrouter", "minimax/minimax-m3", true);
    expect(picks.byName).toBeUndefined();
  });

  it("say the last pick's failure by its code, and a refusal the platform said on a command's answer, until the next pick", async () => {
    const picks = new Picks(async ({ modelId }) => { throw new Error(modelId); }, () => undefined);
    for (const [code, words] of [["model_refused", "model.pickRefused"], ["box_unreachable", "model.pickFailed"], ["model_not_allowed", "model.notAllowed"]] as const) {
      await picks.choose("p", code);
      expect(picks.failed).toBe(words);
    }
    // A refusal said on a message's answer stands until the next pick, which clears it.
    expect(picks.heard("model_refused")).toBe(true);
    expect(picks.failed).toBe("model.pickRefused");
    void picks.choose("p", "again");
    expect(picks.failed).toBeUndefined();
  });

  it("say a refused pick under the model's row, naming the model the computer kept, and the refusal with words of its own in those words", () => {
    const view = cardView(models({ provider: "anthropic", id: "claude-opus-5.5" }), providers, accounts, WORDS);
    expect(pickLine(undefined, view, say)).toBeUndefined();
    expect(pickLine("model.pickFailed", view, say)).toBe('model.pickFailed{"model":"Claude · Claude Opus 5.5"}');
    // The model kept is named plainly, never as a pick still to be taken.
    expect(pickLine("model.pickFailed", { ...view, current: { ...view.current!, chosen: true } }, say)).toBe('model.pickFailed{"model":"Claude · Claude Opus 5.5"}');
    // pi's refusal asks for another model; a pick that never reached the computer asks to try again.
    expect(pickLine("model.pickRefused", view, say)).toBe('model.pickRefused{"model":"Claude · Claude Opus 5.5"}');
    expect(pickLine("model.notAllowed", view, say)).toBe("model.notAllowed");
  });

  it("item 3: say a refusal once, with nothing read again: the same refusal heard twice changes nothing, and a pick pi took clears it", () => {
    const settled = vi.fn();
    const picks = new Picks(async () => "taken" as const, settled);
    expect(picks.heard("model_not_allowed")).toBe(true);
    expect(picks.heard("model_not_allowed")).toBe(false);
    expect(picks.failed).toBe("model.notAllowed");
    expect(picks.heard("taken")).toBe(true);
    expect(picks.failed).toBeUndefined();
    expect(settled).not.toHaveBeenCalled();
  });

  it("item 1: the newest pick outranks a read begun before it, and its answer is written into what the page holds", () => {
    const before = { current: { provider: "openrouter", id: "old" }, available: [] };
    const held = { models: { current: { provider: "anthropic", id: "new" }, available: [] }, pending: undefined, sources: 1 };
    const read = { models: before, pending: undefined, sources: 2 };
    // The read's other figures land; what it says of the model does not, since the person picked while it was on its way.
    expect(afterRead(held, read, true)).toEqual({ ...read, models: held.models, taken: undefined });
    expect(afterRead(held, read, false)).toEqual({ ...read, taken: undefined });
    const pick = { provider: "anthropic", modelId: "claude-opus-5.5" };
    expect(afterPick(read, pick, "taken")).toEqual({ ...read, models: { ...before, current: { provider: "anthropic", id: "claude-opus-5.5" } }, taken: pick });
    expect(afterPick(read, pick, "pending")).toEqual({ ...read, pending: pick });
    expect(afterPick(read, pick, undefined)).toBe(read);
  });

  describe("correction 3 item 1: a taken pick stands until a later answer, whatever the page has heard of the box", () => {
    const recorded = { provider: "google", modelId: "gemini-3.6-flash" };
    const models = { current: { provider: "google", id: "gemini-3.6-flash" }, available: [] };
    // The record's last model is the old one: a page back from a hidden tab has not heard the box, so it does not count it awake.
    const stream = reduce(EMPTY, { event: "entries", data: { kind: "entries", epoch: "e".repeat(32), entries: [{ epoch: "e".repeat(32), seq: 1, entryId: "m1", body: { form: "model_change", provider: recorded.provider, modelId: recorded.modelId } }] } });
    const unheard = { awake: false, pending: undefined, stream, heard: true };
    type Held = { readonly models: Models; readonly pending: undefined; readonly taken?: { readonly provider: string; readonly modelId: string } | undefined };
    const start: Held = { models, pending: undefined };

    it("shows the taken model, not the record's last, on a page that does not count the box awake", () => {
      const pick = { provider: "google", modelId: "gemini-3.1-pro-preview" };
      const held = afterPick(start, pick, "taken");
      expect(shownModels(held.models, { ...unheard, taken: held.taken })?.current).toEqual({ provider: "google", id: "gemini-3.1-pro-preview" });
      // Without what the platform said it took, the record's last model is drawn: the fault the designer saw.
      expect(shownModels(held.models, unheard)?.current).toEqual(models.current);
    });

    it("keeps it through a read shown after the hidden tab, begun before or after the answer", async () => {
      const pick = { provider: "google", modelId: "gemini-3.1-pro-preview" };
      let answered: (answer: "taken") => void = () => undefined;
      const picks = new Picks(() => new Promise((resolve) => { answered = resolve; }), () => undefined);
      const markBefore = picks.mark;
      void picks.choose(pick.provider, pick.modelId);
      const markClick = picks.mark;
      answered("taken");
      await Promise.resolve(); await Promise.resolve();
      expect([markBefore !== picks.mark, markClick !== picks.mark]).toEqual([true, true]);
      const held = afterPick(start, pick, "taken");
      // A read begun between the click and the answer brings the old model: it is older than the answer, so it does not land.
      const early = afterRead(held, start, markClick !== picks.mark);
      expect([early.models.current, early.taken]).toEqual([{ provider: "google", id: "gemini-3.1-pro-preview" }, pick]);
      // One begun after it lands its figures, and the taken pick still outranks the record while the box is unheard.
      const late = afterRead(held, start, false);
      expect(shownModels(late.models, { ...unheard, taken: late.taken })?.current).toEqual({ provider: "google", id: "gemini-3.1-pro-preview" });
    });

    it("ends on the second of two picks in a row", () => {
      const first = { provider: "google", modelId: "gemini-3.8-flash" };
      const second = { provider: "google", modelId: "gemini-3.1-pro-preview" };
      const held = afterPick(afterPick(start, first, "taken"), second, "taken");
      expect(shownModels(held.models, { ...unheard, taken: held.taken })?.current).toEqual({ provider: "google", id: "gemini-3.1-pro-preview" });
    });
  });

  it("item 4: let a message go at the call bound while a pick has stalled on its way to the platform", async () => {
    vi.useFakeTimers();
    try {
      const picks = new Picks(() => new Promise<never>(() => undefined), () => undefined, 10_000);
      void picks.choose("p", "stalled");
      let gone = false;
      void picks.idle().then(() => { gone = true; });
      await vi.advanceTimersByTimeAsync(9_999);
      expect(gone).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(gone).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});

describe("a pick of a series", () => {
  const opus = "~anthropic/claude-opus-latest";
  it("goes to the platform as its series, with the version only where the person pinned it, and a row of no series as its model", async () => {
    const sent: unknown[] = [];
    const picks = new Picks(async (pick) => { sent.push(pick); return "pending" as const; }, () => undefined);
    await picks.choose("anthropic", "claude-opus-5.5", false, { id: opus, pinned: false });
    await picks.choose("anthropic", "claude-opus-5", false, { id: opus, pinned: true });
    await picks.choose("balance", "minimax/minimax-m3", true);
    expect(sent).toEqual([{ provider: "anthropic", series: opus }, { provider: "anthropic", series: opus, modelId: "claude-opus-5" }, { provider: "balance", modelId: "minimax/minimax-m3" }]);
    expect(sentPick({ provider: "anthropic", modelId: "claude-opus-5.5", series: opus })).toEqual({ provider: "anthropic", series: opus });
  });
  it("is drawn as the version it names, else as the version the card offers its series on through its provider, else not at all", () => {
    const offer = { vendors: ["anthropic"], places: ["anthropic"], models: [{ provider: "anthropic", id: "claude-opus-5.5", name: "Claude Opus 5.5", series: "Claude Opus", seriesId: opus }] };
    expect(drawnPick({ provider: "anthropic", series: opus }, offer)).toEqual({ provider: "anthropic", modelId: "claude-opus-5.5", series: opus });
    expect(drawnPick({ provider: "anthropic", series: opus, modelId: "claude-opus-5" }, offer)).toEqual({ provider: "anthropic", modelId: "claude-opus-5", series: opus, pinned: true });
    expect(drawnPick({ provider: "openrouter", series: opus }, offer)).toBeUndefined();
    expect(drawnPick({ provider: "balance", modelId: "minimax/minimax-m3" }, undefined)).toEqual({ provider: "balance", modelId: "minimax/minimax-m3" });
  });
});
