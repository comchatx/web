import { describe, expect, it } from "vitest";
import { GUIDE_LINES, GUIDE_LINKS, guideLength, guideMarkdown, guidePieces, isGuideLine, type GuideLine } from "./guide-lines.js";
import { STRINGS, text } from "./strings.js";
import { route } from "./plugins-model.js";

// The lines as signed: spikes/first-run/lines.js at 68bcad4ba (branch spike/first-run), copied whole, its curly apostrophes as written.
const SIGNED: Readonly<Record<GuideLine, { readonly zh: string; readonly en: string }>> = {
  T1: { zh: "{name}，你好，我是 cx，你的亚马逊运营助手。", en: "Hey {name}, I'm cx, your Amazon store assistant." },
  T1n: { zh: "{name}，你好，我是 cx，你的运营助手。", en: "Hey {name}, I'm cx, your store assistant." },
  T2: { zh: "很高兴认识你。我很想进一步了解你经营店铺的方式。我们先把我的电脑和要用的插件准备好，每一步点哪里，我都会指给你看。", en: "Nice to meet you. I’d love to learn more about the way you run your store. Let’s get my computer and the plugins I work with ready first, and I’ll show you where to click at each step." },
  T6: { zh: "电脑开好了。发送下面这条消息即可开始。", en: "My computer is on. Send the message below to get started." },
  S1: { zh: "我的 20000 毫安充电宝在亚马逊美国站如何改进和优化？", en: "How can I improve my 20,000 mAh power bank on Amazon US?" },
  A1: { zh: "先说几点不看数据也成立的：\n1. 标题开头写清容量和输出功率，例如「20000mAh，22.5W 快充」，买家搜的就是这些词。\n2. 加一张标出接口和尺寸的图。\n3. 差评里最常提的问题，比如重量和充电时长，放在五点描述的前面回答。", en: "A few points hold without any data:\n1. Start the title with the capacity and output, such as \"20,000 mAh, 22.5 W fast charging\": those are the words buyers search for.\n2. Add an image that marks the ports and the size.\n3. Answer what reviews complain about most, such as weight or charging time, in your first bullet points." },
  A2: { zh: "要针对你这款给出具体建议，数据还不够：建议安装 Keepa 数据接口，补上它和竞品的价格、排名走势；连接你的亚马逊店铺后，我还能读到销量和广告，做更细的策略，并直接替你执行。", en: "To give advice for your own power bank, I need more data. Install Keepa API for its and its competitors' price and rank history. Once your Amazon store is connected, I can read its sales and ads, plan in more detail and make the changes for you." },
  T7: { zh: "我们先去「插件」安装 {Keepa 数据接口}，再装 {亚马逊卖家整合包}，最后在 {亚马逊卖家接口} 里连接你的店铺。", en: "Let's go to Plugins and install {Keepa API}, then {Amazon Seller Bundle}, and last connect your store in {Amazon SP-API}." },
  T10: { zh: "一切就绪。发送这个问题后，我就开始正式分析你的商品。", en: "You’re all set. Once you send this question, I’ll start a real analysis of your product." },
};
const straight = (words: string): string => words.replaceAll("’", "'");

describe("the tutorial's lines", () => {
  it("are the signed words, word for word in both languages, with the English apostrophes straight", () => {
    expect(Object.keys(GUIDE_LINES)).toEqual(Object.keys(SIGNED));
    for (const line of Object.keys(SIGNED) as GuideLine[]) {
      expect(STRINGS[GUIDE_LINES[line]], line).toEqual({ en: straight(SIGNED[line].en), zh: SIGNED[line].zh });
    }
  });

  it("knows its own names and no other", () => {
    expect([isGuideLine("T7"), isGuideLine("T10"), isGuideLine("T9"), isGuideLine("toString"), isGuideLine(7)]).toEqual([true, true, false, false, false]);
  });

  it("opens each plugin a line names on that plugin's own page", () => {
    expect(Object.fromEntries(Object.entries(GUIDE_LINKS).map(([words, to]) => [words, route(to)]))).toEqual({
      "Keepa 数据接口": { kind: "plugin", id: expect.stringMatching(/cx-keepa$/), npm: "cx-keepa" },
      "Keepa API": { kind: "plugin", id: expect.stringMatching(/cx-keepa$/), npm: "cx-keepa" },
      "亚马逊卖家整合包": { kind: "bundle", id: "amazon-seller" },
      "Amazon Seller Bundle": { kind: "bundle", id: "amazon-seller" },
      "亚马逊卖家接口": { kind: "plugin", id: expect.stringMatching(/cx-amazon-sp-api$/), npm: "cx-amazon-sp-api" },
      "Amazon SP-API": { kind: "plugin", id: expect.stringMatching(/cx-amazon-sp-api$/), npm: "cx-amazon-sp-api" },
    });
    for (const language of ["en", "zh"] as const) {
      const named = guidePieces(text(language, "guide.t7")).filter((piece) => piece.href !== undefined).map((piece) => piece.words);
      expect(named, language).toHaveLength(3);
    }
  });
});

describe("a line in runs", () => {
  it("makes each braced name a link and takes the space out where Chinese meets Chinese, as copy rule 5 does", () => {
    expect(guidePieces(text("zh", "guide.t7"))).toEqual([
      { words: "我们先去「插件」安装 " }, { words: "Keepa 数据接口", href: "#/plugins/n/cx-keepa" },
      { words: "，再装" }, { words: "亚马逊卖家整合包", href: "#/plugins/b/amazon-seller" },
      { words: "，最后在" }, { words: "亚马逊卖家接口", href: "#/plugins/n/cx-amazon-sp-api" }, { words: "里连接你的店铺。" },
    ]);
    expect(guidePieces(text("en", "guide.t7")).map((piece) => piece.words).join("")).toBe("Let's go to Plugins and install Keepa API, then Amazon Seller Bundle, and last connect your store in Amazon SP-API.");
  });

  it("leaves a brace it does not know as written", () => {
    expect(guidePieces("Install {Something Else} now.")).toEqual([{ words: "Install {Something Else} now." }]);
  });

  it("grows character by character, a link's words cut where the line is, and is whole once ended", () => {
    const pieces = guidePieces(text("en", "guide.t7"));
    expect(guideMarkdown(pieces, 33).source).toBe("Let's go to Plugins and install [K](#/plugins/n/cx-keepa)");
    expect(guideMarkdown(pieces, 0).source).toBe("");
    expect(guideMarkdown(pieces, guideLength(pieces))).toEqual(guideMarkdown(pieces));
    expect(guideMarkdown(guidePieces("你好，世界"), 3).source).toBe("你好，");
  });

  it("reads links from the signed words only: a value that names one, or braces one, is a value", () => {
    for (const name of ["Keepa API", "{Keepa API}"]) {
      const pieces = guidePieces(text("en", "guide.t1"), { name });
      expect(pieces).toEqual([{ words: "Hey " }, { words: name, value: true }, { words: ", I'm cx, your Amazon store assistant." }]);
      expect(guideMarkdown(pieces).source).toBe("Hey \uE000, I'm cx, your Amazon store assistant.");
    }
  });

  it("keeps a signed link that link, whatever key the values hold: T7 with a value named after a link draws all three links", () => {
    for (const language of ["zh", "en"] as const) {
      const signed = text(language, "guide.t7");
      const links = guidePieces(signed).filter((piece) => piece.href !== undefined);
      const values = Object.fromEntries([["name", "Sam"], ...links.map((piece) => [piece.words, "Sam"])]);
      expect(guidePieces(signed, values), language).toEqual(guidePieces(signed));
      expect(guidePieces(signed, { name: "Sam", "Keepa API": "Sam" }).filter((piece) => piece.href !== undefined)).toHaveLength(3);
    }
  });

  it("holds a value apart from the markdown, as far as the line has grown, counting its characters", () => {
    const pieces = guidePieces(text("zh", "guide.t1"), { name: "1. Li" });
    expect(guideMarkdown(pieces)).toEqual({ source: "\uE000，你好，我是 cx，你的亚马逊运营助手。", values: ["1. Li"] });
    expect(guideMarkdown(pieces, 3)).toEqual({ source: "\uE000", values: ["1. "] });
    expect(guideLength(pieces)).toBe(5 + [..."，你好，我是 cx，你的亚马逊运营助手。"].length);
  });

  it("trims the space where a Chinese value meets Chinese words, as text does", () => {
    const signed = "我是 {name} 的助手";
    expect(guidePieces(signed, { name: "小林" }).map((piece) => piece.words).join("")).toBe("我是小林的助手");
    expect(guidePieces(signed, { name: "Sam" }).map((piece) => piece.words).join("")).toBe("我是 Sam 的助手");
  });
});
