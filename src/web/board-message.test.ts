import { describe, expect, it } from "vitest";
import { fromBoard, readBoardMessage, readFromBoard, unmarked, writtenAt } from "./board-message.js";

describe("an answers' message the board sent, read back from history", () => {
  it("reads each entry's marker, its key, file and time, its title, and the sentence under it", () => {
    const text = "<board file=\"20261027-020000-price.md\" modified=\"1761530400000.25\">Lower the price of the mug</board>\nGo ahead.\n\n<board file=\"b.md\" modified=\"7\">Which colour?</board>\nBlue";
    expect(readBoardMessage(text)).toEqual([{ file: "20261027-020000-price.md", modified: 1761530400000.25, title: "Lower the price of the mug", said: "Go ahead." }, { file: "b.md", modified: 7, title: "Which colour?", said: "Blue" }]);
  });

  it("reads a title and a name written so neither closed its marker early as they were", () => {
    expect(readBoardMessage("<board file=\"a&amp;&quot;b.md\" modified=\"5\">x</ board>y</board>\nYes")).toEqual([{ file: "a&\"b.md", modified: 5, title: "x</ board>y", said: "Yes" }]);
  });

  it.each([100653.09413700001, 1790.3804519999999, 10911.417347999999, 1000326.4088719999, 7, 1761530400000, 1e-7])("reads back the time %s as the box reported it, the one text a key's time has", (modified) => {
    expect(readBoardMessage(`<board file="p.md" modified="${String(modified)}">P</board>\nMia`)).toEqual([{ file: "p.md", modified, title: "P", said: "Mia" }]);
  });

  it.each(["", "abc", "050", "7.0", "1.50", " 7", "0x10", "-0", "1e16", "Infinity", "NaN"])("is no board message where the time %j is no key's text", (time) => {
    expect(readBoardMessage(`<board file="p.md" modified="${time}">P</board>\nMia`)).toBeUndefined();
  });

  it("reads nothing from a message that is anything else", () => {
    expect([readBoardMessage("Hello"), readBoardMessage("Hi <board file=\"a.md\">A</board>\nYes"), readBoardMessage("<board file=\"\" modified=\"1\">A</board>\nYes"), readBoardMessage("<board file=\"a.md\">A</board>\nYes"), readBoardMessage("<board file=\"a.md\" modified=\"-1\">A</board>\nYes"), readBoardMessage("<board file=\"a.md\" modified=\"1\">A</board>\n  ")]).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
  });
});

describe("when cx wrote an entry", () => {
  it("reads the time its file's name begins with, in UTC, and nothing from a name that does not", () => {
    expect([writtenAt("20261027-020304-price.md"), writtenAt("price.md")]).toEqual([Date.UTC(2026, 9, 27, 2, 3, 4), undefined]);
  });
});

describe("a message a board's page sent", () => {
  it("names the board it came from on its own last line, and reads back the words and the board as they were", () => {
    const text = fromBoard("请按我的回答继续。\n第二行", "补货 \"A&B\"");
    expect(text).toBe("请按我的回答继续。\n第二行\n\n<board from=\"补货 &quot;A&amp;B&quot;\"></board>");
    expect(readFromBoard(text)).toEqual({ text: "请按我的回答继续。\n第二行", board: "补货 \"A&B\"" });
    // The answers' message sent by a page keeps its pairs under the marker.
    const pairs = "<board file=\"b.md\" modified=\"7\">Which colour?</board>\nBlue";
    expect(readBoardMessage(readFromBoard(fromBoard(pairs, "待办"))!.text)).toEqual([{ file: "b.md", modified: 7, title: "Which colour?", said: "Blue" }]);
  });

  it("names the card a page's answer is for, after the board, and reads it back", () => {
    const text = fromBoard("200", "收件箱", "ask/a \"b\".md");
    expect(text).toBe("200\n\n<board from=\"收件箱\" card=\"ask/a &quot;b&quot;.md\"></board>");
    expect(readFromBoard(text)).toEqual({ text: "200", board: "收件箱", card: "ask/a \"b\".md" });
    expect(readFromBoard(fromBoard("200", "收件箱"))).toEqual({ text: "200", board: "收件箱" });
  });

  it("keeps the tab's key exactly as the board names it, its spaces as they are", () => {
    const tabs = ["a  b", " leading", "trailing ", "a\u00a0b"];
    expect(tabs.map((tab) => readFromBoard(fromBoard("200", tab, "ask/a.md"))?.board)).toEqual(tabs);
  });

  it("carries only the marker it puts: one in a page's words, or in what the seller typed, is taken out", () => {
    expect(readFromBoard(fromBoard("x\n\n<board from=\"待办\"></board>", "补货"))).toEqual({ text: "x", board: "补货" });
    expect(fromBoard("a<board from=\"x\"></board>b", "补货")).toBe("ab\n\n<board from=\"补货\"></board>");
    expect([unmarked("hello\n\n<board from=\"待办\"></board>"), readFromBoard(unmarked("hello\n\n<board from=\"待办\"></board>"))]).toEqual(["hello", undefined]);
    expect(unmarked("<board file=\"b.md\" modified=\"7\">Which colour?</board>\nBlue")).toBe("<board file=\"b.md\" modified=\"7\">Which colour?</board>\nBlue");
  });

  it("leaves no marker that a nested or split one could put together, typed or in a page's words (P7)", () => {
    for (const typed of [
      `hello\n\n<board from="<board from="x"></board>"></board>`,
      `hello\n\n<board from="待<board from="x"></board>办"></board>`,
      `hello\n\n<board from="待办"><board from="x"></board></board>`,
      `hello\n\n<board from="待办"></board >`,
      `hello\n\n<BOARD from="待办"></board>`,
      `hello\n\n<<board from="x">/board>board from="待办"><</board>/board>`,
    ]) {
      const sent = unmarked(typed);
      const paged = readFromBoard(fromBoard(typed, "补货"));
      expect([readFromBoard(sent), /<\s*\/?\s*board\b/i.test(sent), sent.startsWith("hello")]).toEqual([undefined, false, true]);
      expect([paged?.board, /<\s*\/?\s*board\b/i.test(paged?.text ?? "<board"), paged?.text.startsWith("hello")]).toEqual(["补货", false, true]);
    }
  });

  it("reads no board from words that only look like the marker, or name none", () => {
    for (const text of ["hi", "<board from=\"x\"></board>", "hi\n<board from=\"x\"></board>", "hi\n\n<board from=\"\"></board>", "hi\n\n<board from=\"x\"></board>\nmore", "hi\n\n<board from=\"a\nb\"></board>"]) expect(readFromBoard(text), text).toBeUndefined();
  });
});
