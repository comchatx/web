import { describe, expect, it } from "vitest";
import type { CardChoices } from "../shared/card-choices.js";
import { chatCard, chatFull, pinGone, places, versionOf, withoutVendor, withPin, withTick, withTicks, type ChatSeries } from "./chat-card.js";

type V = { readonly id: string };
const series = (id: string, ...versions: readonly string[]): ChatSeries<V> => ({ id, name: id, versions: versions.map((one) => ({ id: one })) });
const SERIES: Readonly<Record<string, readonly ChatSeries<V>[]>> = {
  anthropic: [series("opus", "opus-5.5", "opus-5"), series("haiku", "haiku-5")],
  openai: [1, 2, 3, 4, 5, 6].map((at) => series(`gpt-${at}`, `gpt-${at}.1`)),
  google: [series("gemini", "gemini-3")], deepseek: [series("v", "v4")], moonshotai: [series("kimi", "k3")], qwen: [series("qwen", "q3")],
};
const on = (...cards: readonly string[]) => Object.fromEntries(cards.map((card) => [card, { on: true, ways: ["platform" as const] }]));
const EMPTY: CardChoices = { vendors: [], models: {}, plugins: on("anthropic", "openai", "google", "deepseek", "moonshotai", "qwen") };
const tick = (choices: CardChoices, card: string, id: string, ticked = true): CardChoices => {
  const next = withTick(choices, card, id, ticked);
  if (typeof next === "string") throw new Error(next);
  return next;
};
const rows = (choices: CardChoices) => chatCard(choices, SERIES).rows.map((row) => `${row.card}:${row.version.id}`);

describe("the card as the record draws it", () => {
  it("is Default alone with nothing ticked, or no record", () => {
    expect(chatCard(undefined, SERIES)).toEqual({ vendors: [], rows: [], places: [] });
    expect(chatCard(EMPTY, SERIES)).toEqual({ vendors: [], rows: [], places: [] });
  });

  it("lists only the ticked series, each as the version it is pinned at: Opus ticked and held at Opus 5 is one row, Opus 5", () => {
    const ticked = tick(EMPTY, "anthropic", "opus");
    expect(rows(ticked)).toEqual(["anthropic:opus-5.5"]);
    expect(rows(withPin(ticked, "anthropic", "opus", "opus-5"))).toEqual(["anthropic:opus-5"]);
  });

  it("puts a vendor in chat at its first tick, last, and takes it out at its last untick", () => {
    const both = tick(tick(EMPTY, "anthropic", "opus"), "openai", "gpt-1");
    expect(both.vendors).toEqual(["anthropic", "openai"]);
    expect(chatCard(both, SERIES).vendors).toEqual(["anthropic", "openai"]);
    const second = tick(both, "anthropic", "haiku");
    expect(second.vendors).toEqual(["anthropic", "openai"]);
    expect(tick(second, "anthropic", "opus", false).vendors).toEqual(["anthropic", "openai"]);
    const out = tick(tick(second, "anthropic", "opus", false), "anthropic", "haiku", false);
    expect(out.vendors).toEqual(["openai"]);
    expect(rows(out)).toEqual(["openai:gpt-1.1"]);
  });

  it("keeps a turned-off vendor's place and ticks in the record and puts none of its models in chat", () => {
    const both = tick(tick(EMPTY, "anthropic", "opus"), "openai", "gpt-1");
    const off = { ...both, plugins: { ...both.plugins, anthropic: { on: false, ways: ["platform" as const] } } };
    expect(chatCard(off, SERIES)).toEqual({ vendors: ["openai"], rows: [{ card: "openai", series: SERIES["openai"]![0], version: { id: "gpt-1.1" } }], places: ["anthropic", "openai"] });
    expect(off.vendors).toEqual(["anthropic", "openai"]);
    expect(chatFull(off, "qwen")).toBe(false);
  });

  it("refuses a tick on a sixth vendor, and a sixth series of one vendor, and changes nothing; an untick then makes room", () => {
    const five = ["anthropic:opus", "openai:gpt-1", "google:gemini", "deepseek:v", "moonshotai:kimi"].reduce((held, one) => { const [card, id] = one.split(":"); return tick(held, card!, id!); }, EMPTY);
    expect(five.vendors).toHaveLength(5);
    expect(chatFull(five, "qwen")).toBe(true);
    expect(chatFull(five, "openai")).toBe(false);
    expect(withTick(five, "qwen", "qwen", true)).toBe("full");
    const fifth = [2, 3, 4, 5].reduce((held, at) => tick(held, "openai", `gpt-${at}`), five);
    expect(fifth.models["openai"]).toEqual(["gpt-1", "gpt-2", "gpt-3", "gpt-4", "gpt-5"]);
    expect(withTick(fifth, "openai", "gpt-6", true)).toBe("many");
    expect(withTick(fifth, "openai", "gpt-5", true)).toBe(fifth);
    // Ticked in turn for one write: a refusal answers with the ticks before it kept, and a vendor refused its first takes none.
    expect(withTicks(five, "qwen", ["qwen-a", "qwen-b"])).toEqual([five, "full"]);
    const [four, none] = withTicks(five, "openai", ["gpt-2", "gpt-3", "gpt-4", "gpt-5", "gpt-6"]);
    expect([four.models["openai"], none]).toEqual([["gpt-1", "gpt-2", "gpt-3", "gpt-4", "gpt-5"], "many"]);
    expect(rows(fifth).filter((row) => row.startsWith("openai:"))).toHaveLength(5);
    expect(tick(tick(fifth, "openai", "gpt-1", false), "openai", "gpt-6").models["openai"]).toEqual(["gpt-2", "gpt-3", "gpt-4", "gpt-5", "gpt-6"]);
  });

  it("holds a pin apart from the tick: a pin on an unticked series is kept, and outlasts an untick", () => {
    const pinned = withPin(EMPTY, "anthropic", "opus", "opus-5");
    expect(pinned.pins).toEqual({ anthropic: { opus: "opus-5" } });
    expect(rows(pinned)).toEqual([]);
    const ticked = tick(pinned, "anthropic", "opus");
    expect(rows(ticked)).toEqual(["anthropic:opus-5"]);
    expect(tick(ticked, "anthropic", "opus", false).pins).toEqual({ anthropic: { opus: "opus-5" } });
    expect(withPin(ticked, "anthropic", "opus", undefined).pins).toEqual({});
  });

  it("follows the latest while a pinned version is no longer served, says which one left, and keeps the pin", () => {
    const record = withPin(tick(EMPTY, "anthropic", "opus"), "anthropic", "opus", "opus-4");
    const opus = SERIES["anthropic"]![0]!;
    expect(versionOf(record, "anthropic", opus)).toEqual({ id: "opus-5.5" });
    expect(pinGone(record, "anthropic", opus)).toBe("opus-4");
    expect(pinGone(withPin(record, "anthropic", "opus", "opus-5"), "anthropic", opus)).toBeUndefined();
    expect(rows(record)).toEqual(["anthropic:opus-5.5"]);
    expect(record.pins).toEqual({ anthropic: { opus: "opus-4" } });
  });

  it("keeps a vendor whose ticked series serves nothing today in its place, with no row", () => {
    const record = tick(EMPTY, "anthropic", "opus");
    expect(chatCard(record, { anthropic: [series("opus")] })).toEqual({ vendors: ["anthropic"], rows: [], places: ["anthropic"] });
    expect(chatCard(record, {})).toEqual({ vendors: ["anthropic"], rows: [], places: ["anthropic"] });
  });

  it("gives a plugin not installed no tick, and a place to none but the installed", () => {
    expect(withTick(EMPTY, "x-ai", "grok", true)).toBe(EMPTY);
    const legacy: CardChoices = { ...EMPTY, vendors: ["x-ai", "cohere"] };
    expect(tick(legacy, "anthropic", "opus").vendors).toEqual(["anthropic"]);
    expect(chatCard(legacy, SERIES).vendors).toEqual([]);
  });

  it("gives a place exactly to an installed vendor with a series ticked, on or off, reached or not: one the record lists with no tick holds none", () => {
    const listed: CardChoices = { ...EMPTY, vendors: ["openai", "anthropic", "google", "deepseek", "moonshotai"] };
    expect(places(listed)).toEqual([]);
    expect(chatFull(listed, "qwen")).toBe(false);
    expect(chatCard(listed, SERIES)).toEqual({ vendors: [], rows: [], places: [] });
    const qwen = tick(listed, "qwen", "qwen");
    expect([qwen.vendors, places(qwen)]).toEqual([["qwen"], ["qwen"]]);
    const off = { ...tick(EMPTY, "moonshotai", "gone-series"), plugins: { ...EMPTY.plugins, moonshotai: { on: false, ways: ["platform" as const] } } };
    expect([places(off), chatCard(off, SERIES).vendors]).toEqual([["moonshotai"], []]);
  });

  it("takes a vendor out by clearing every tick of its series, one no way reaches today included, and keeps its pins", () => {
    const record = withPin(tick(tick(EMPTY, "anthropic", "unreached"), "anthropic", "opus"), "anthropic", "opus", "opus-5");
    const out = withoutVendor(record, "anthropic");
    expect([out.vendors, out.models["anthropic"], out.pins, places(out)]).toEqual([[], [], { anthropic: { opus: "opus-5" } }, []]);
    expect(withoutVendor(EMPTY, "anthropic")).toBe(EMPTY);
    const listed: CardChoices = { ...EMPTY, vendors: ["anthropic"] };
    expect(withoutVendor(listed, "anthropic").vendors).toEqual([]);
  });

  it("changes nothing for a tick already held or an untick of a series not ticked", () => {
    const ticked = tick(EMPTY, "anthropic", "opus");
    expect(withTick(ticked, "anthropic", "opus", true)).toBe(ticked);
    expect(withTick(ticked, "anthropic", "haiku", false)).toBe(ticked);
  });
});
