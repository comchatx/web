import { describe, expect, it } from "vitest";
import { begins, heldOfPartTwo, partTwo, questionFor, skipFrom, stepFor, type PartTwo, type Seen, type Step } from "./guide-road.js";
import { STRINGS, type StringKey } from "./strings.js";

const AT_START: Seen = { page: "chat", view: "other", installCard: false, opened: undefined, power: "off", some: false, card: undefined, item: undefined, settings: false, keepa: false, seller: false, store: false };
const seen = (over: Partial<Seen>): Seen => ({ ...AT_START, ...over });

describe("the tutorial's first part", () => {
  it("begins only where 1.1 stands: the chat, nothing open, the computer off and nothing installed", () => {
    expect(begins(AT_START)).toBe(true);
    expect([seen({ page: "plugins" }), seen({ opened: "computer" }), seen({ power: "starting" }), seen({ some: true })].map(begins)).toEqual([false, false, false, false]);
  });

  it("walks 1.1 to 1.11 on the seller's presses, a start of the computer taking as long as a first one does", () => {
    const walk: readonly (readonly [Seen, boolean, Step | "ended"])[] = [
      [AT_START, false, "1.1"],
      [AT_START, true, "1.2"],
      [seen({ opened: "computer" }), true, "1.3"],
      [seen({ opened: "computer", power: "starting" }), true, "1.4"],
      [seen({ page: "plugins", power: "starting" }), true, "1.5"],
      [seen({ page: "plugins", installCard: true, power: "starting" }), true, "1.6"],
      [seen({ page: "plugins", power: "starting", some: true }), true, "1.7"],
      [seen({ page: "plugins", view: "yours", power: "starting", some: true }), true, "1.8"],
      [seen({ power: "starting", some: true }), true, "1.9"],
      [seen({ opened: "cx", power: "starting", some: true }), true, "1.10"],
      // cx's card shut while the computer starts: the road waits at 1.10 for it.
      [seen({ power: "starting", some: true }), true, "1.10"],
      [seen({ power: "on", some: true }), true, "1.11"],
    ];
    let at: Step | "ended" = "1.1";
    for (const [now, awake, next] of walk) {
      at = stepFor(at as Step, now, awake);
      expect(at).toBe(next);
    }
  });

  it("goes back to the step that asked when its press is taken back: the window shut, the install card cancelled", () => {
    expect(stepFor("1.3", AT_START, true)).toBe("1.2");
    expect(stepFor("1.6", seen({ page: "plugins", power: "starting" }), true)).toBe("1.5");
  });

  it("asks the first question once the computer is on at the chat, its window open or not, and waits for it while cx's card is open", () => {
    expect(stepFor("1.9", seen({ power: "on", some: true }), true)).toBe("1.11");
    expect(stepFor("1.9", seen({ opened: "computer", power: "on", some: true }), true)).toBe("1.11");
    expect(stepFor("1.10", seen({ opened: "cx", power: "on", some: true }), true)).toBe("1.10");
    expect(stepFor("1.10", seen({ page: "plugins", power: "on", some: true }), true)).toBe("1.10");
  });

  it("moves on from the first question only by what the seller sends or skips, and 插件 pressed after the answer is part two's beginning, at the step the Plugins page shows", () => {
    for (const at of ["1.11", "1.12"] as const) expect(stepFor(at, seen({ page: "plugins", power: "on", some: true }), true)).toBe(at);
    for (const at of ["1.13", "1.11′"] as const) {
      expect(stepFor(at, seen({ power: "on", some: true }), true)).toBe(at);
      expect(stepFor(at, seen({ page: "plugins", power: "on", some: true }), true)).toBe("2.1");
      expect(stepFor(at, seen({ page: "plugins", power: "on", some: true, keepa: true }), true)).toBe("2.3");
    }
  });

  it("takes the computer's own start where the seller found its window another way: the next step is the one the page shows", () => {
    expect(stepFor("1.2", seen({ power: "starting" }), true)).toBe("1.4");
    expect(stepFor("1.4", seen({ power: "starting", some: true }), true)).toBe("1.9");
  });

  it("closes the tutorial for good from 跳过 at the opening, from a later step goes to cx at its desk, from there to the wait for the computer, past the first question, then to the end", () => {
    expect((["1.1", "1.2", "1.3"] as const).map((at) => skipFrom(at))).toEqual(["closed", "closed", "closed"]);
    expect((["1.4", "1.5", "1.6", "1.7", "1.8"] as const).map((at) => skipFrom(at))).toEqual(["1.9", "1.9", "1.9", "1.9", "1.9"]);
    expect((["1.9", "1.10"] as const).map((at) => skipFrom(at))).toEqual(["1.10", "1.10"]);
    expect(skipFrom("1.11")).toBe("1.11′");
    expect((["1.12", "1.13", "1.11′"] as const).map((at) => skipFrom(at))).toEqual(["ended", "ended", "ended"]);
  });
});

describe("the tutorial's part two, on the Plugins page", () => {
  const ON = seen({ page: "plugins", power: "on", some: true });
  const two = (over: Partial<Seen>): Seen => ({ ...ON, ...over });

  it("walks 2.1 to 2.7 on the seller's presses: Keepa API's + and its card, Amazon Seller Bundle's + and its card, Amazon SP-API's card, its 设置, and 连接", () => {
    const walk: readonly (readonly [Seen, PartTwo])[] = [
      [ON, "2.1"],
      [two({ card: "p:keepa" }), "2.2"],
      [two({ keepa: true }), "2.3"],
      [two({ keepa: true, card: "b:amazon-seller" }), "2.4"],
      [two({ keepa: true, seller: true }), "2.5"],
      [two({ keepa: true, seller: true, item: "amazon-sp-api" }), "2.6"],
      [two({ keepa: true, seller: true, item: "amazon-sp-api", settings: true }), "2.7"],
      [two({ keepa: true, seller: true, item: "amazon-sp-api", settings: true, store: true }), "2.8"],
    ];
    let at: Step | "ended" = "2.1";
    for (const [now, next] of walk) {
      at = stepFor(at as Step, now, true);
      expect(at).toBe(next);
    }
  });

  it("reads each step from its own plugin's fact: another plugin's card or page moves nothing", () => {
    expect([two({ card: "p:review-lens" }), two({ card: "b:amazon-seller" }), two({ card: "b:comchatx-essentials" }), two({ item: "amazon-sp-api", settings: true })].map(partTwo)).toEqual(["2.1", "2.1", "2.1", "2.1"]);
    expect([two({ keepa: true, card: "p:keepa" }), two({ keepa: true, card: "p:amazon-sp-api" }), two({ keepa: true, item: "amazon-sp-api" })].map(partTwo)).toEqual(["2.3", "2.3", "2.3"]);
    expect([two({ keepa: true, seller: true, item: "keepa" }), two({ keepa: true, seller: true, item: "keepa", settings: true }), two({ keepa: true, seller: true, card: "p:amazon-sp-api" })].map(partTwo)).toEqual(["2.5", "2.5", "2.5"]);
  });

  it("passes a step whose fact already holds: a seller who holds Keepa API stands at 2.3, one who holds the bundle too at 2.5, one whose store is connected at the last scene", () => {
    expect([two({ keepa: true }), two({ keepa: true, seller: true }), two({ seller: true }), two({ keepa: true, seller: true, store: true })].map(partTwo)).toEqual(["2.3", "2.5", "2.1", "2.8"]);
  });

  it("goes back a step when a press is taken back: an install card cancelled, the plugin's page left, its 设置 left", () => {
    expect(stepFor("2.2", ON, true)).toBe("2.1");
    expect(stepFor("2.4", two({ keepa: true }), true)).toBe("2.3");
    expect(stepFor("2.6", two({ keepa: true, seller: true }), true)).toBe("2.5");
    expect(stepFor("2.7", two({ keepa: true, seller: true, item: "amazon-sp-api" }), true)).toBe("2.6");
  });

  const STEPS = ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7"] as const;

  it("stands where part one left it once the seller is back in the chat with nothing of part two held, and at the last scene with any of it held or waiting", () => {
    const chat = (over: Partial<Seen>): Seen => seen({ power: "on", some: true, ...over });
    expect(STEPS.map((at) => stepFor(at, chat({}), true))).toEqual(Array(7).fill("1.13"));
    for (const held of [{ keepa: true }, { seller: true }, { store: true }, { keepa: true, seller: true, store: true }]) expect(STEPS.map((at) => stepFor(at, chat(held), true)), JSON.stringify(held)).toEqual(Array(7).fill("2.8"));
  });

  it("keeps the last scene in the chat, and on the Plugins page with a store connected; short of a store, the Plugins page is part two's step again", () => {
    expect(stepFor("2.8", seen({ power: "on", some: true, keepa: true }), true)).toBe("2.8");
    expect(stepFor("2.8", two({ keepa: true, seller: true, store: true }), true)).toBe("2.8");
    expect(stepFor("2.8", two({ keepa: true }), true)).toBe("2.3");
    expect(stepFor("2.8", two({ keepa: true, seller: true, item: "amazon-sp-api" }), true)).toBe("2.6");
  });

  it("offers the question for what the account holds: Q1 with a store connected, Q1n with Amazon Seller Bundle and no store, Q1k otherwise", () => {
    expect([{ seller: true, store: true }, { seller: false, store: true }, { seller: true, store: false }, { seller: false, store: false }].map(questionFor)).toEqual(["Q1", "Q1", "Q1n", "Q1k"]);
    expect([heldOfPartTwo({ keepa: false, seller: false, store: false }), heldOfPartTwo({ keepa: true, seller: false, store: false }), heldOfPartTwo({ keepa: false, seller: true, store: false }), heldOfPartTwo({ keepa: false, seller: false, store: true })]).toEqual([false, true, true, true]);
  });

  it("goes from 跳过 to the last scene with something of part two held, and closes the tutorial with nothing of it held and at the last scene itself", () => {
    expect(STEPS.map((at) => skipFrom(at, true))).toEqual(Array(7).fill("2.8"));
    expect(STEPS.map((at) => skipFrom(at, false))).toEqual(Array(7).fill("closed"));
    expect([skipFrom("2.8", true), skipFrom("2.8", false)]).toEqual(["closed", "closed"]);
    // Part one's 跳过 is not moved by what is held.
    expect((["1.3", "1.5", "1.9", "1.11", "1.13"] as const).map((at) => skipFrom(at, true))).toEqual(["closed", "1.9", "1.10", "1.11′", "ended"]);
  });
});

// W9 and W10 as signed: spikes/first-run/lines.js at 68bcad4ba (branch spike/first-run), copied whole.
const SIGNED = {
  W9: { zh: { title: "你的问题", lines: ["发送后，我在电脑上查资料，在对话里回答。"], press: "点击「发送」" }, en: { title: "Your question", lines: ["Once sent, I research on my computer and answer in the chat."], press: "Click Send" } },
  W10: { zh: { title: "数据源", lines: ["网上搜不到的数据，比如竞品的价格和排名走势，要靠数据源插件。", "有了它们，我的判断才有数据撑着。"], press: "去「插件」" }, en: { title: "Data sources", lines: ["Data you can't find on the web, like competitors' price and rank history, comes from data-source plugins.", "With them, my calls rest on data."], press: "Go to Plugins" } },
} as const;

describe("the first question's bubbles", () => {
  it("are W9 and W10 as signed, title, each line and press, in both languages", () => {
    for (const [name, n] of [["W9", 9], ["W10", 10]] as const) {
      for (const language of ["zh", "en"] as const) {
        const of = (part: string): string | undefined => STRINGS[`guide.w${n}.${part}` as StringKey]?.[language];
        const lines = ["line1", "line2", "line3"].map(of).filter((line) => line !== undefined);
        expect({ title: of("title"), lines, press: of("press") }, `${name} ${language}`).toEqual(SIGNED[name][language]);
      }
    }
  });
});
