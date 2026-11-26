import { describe, expect, it } from "vitest";
import { COUNTS_PREFIX, iconName, PageCounts } from "./board-counts.js";
import { text } from "./strings.js";

const store = () => {
  const held = new Map<string, string>();
  return { held, read: (key: string) => held.get(key) ?? null, write: (key: string, value: string) => { held.set(key, value); }, remove: (key: string) => { held.delete(key); } };
};

describe("the numbers pages give the board's icon", () => {
  it("keeps each tab's number and words for the account, a zero as none, and loads them before a page runs again", () => {
    const kept = store();
    let account: string | undefined = "acct-1";
    const counts = new PageCounts(kept, () => account);
    expect([counts.set("待办", 6, "6 条待处理"), counts.set("待办", 6, "6 条待处理"), counts.set("补货", 2, undefined)]).toEqual([true, false, true]);
    expect(JSON.parse(kept.held.get(`${COUNTS_PREFIX}acct-1`)!)).toEqual({ 待办: [6, "6 条待处理"], 补货: [2] });
    expect(new PageCounts(kept, () => "acct-1").all(["补货", "待办", "Notes"])).toEqual([{ tab: "补货", n: 2 }, { tab: "待办", n: 6, words: "6 条待处理" }]);
    expect([counts.set("补货", 0, undefined), counts.set("Notes", 0, undefined)]).toEqual([true, false]);
    // A tab whose page went takes its number with it; the last number gone leaves no key.
    expect([counts.only(new Set(["待办"])), counts.only(new Set())]).toEqual([false, true]);
    expect(kept.held.has(`${COUNTS_PREFIX}acct-1`)).toBe(false);
    // Another account has numbers of its own; none signed in keeps none.
    account = "acct-2";
    expect(counts.of("待办")).toBeUndefined();
    account = undefined;
    expect([counts.set("待办", 1, undefined), counts.of("待办")?.n]).toEqual([true, 1]);
    expect([...kept.held.keys()]).toEqual([]);
  });

  it("reads past a kept copy it cannot read, and draws on where the browser refuses to keep one", () => {
    const kept = store();
    kept.held.set(`${COUNTS_PREFIX}acct-1`, JSON.stringify({ a: [0], b: ["2"], c: [3, ""], d: 4, e: [5, "五"] }));
    expect(new PageCounts(kept, () => "acct-1").all(["a", "b", "c", "d", "e"])).toEqual([{ tab: "c", n: 3 }, { tab: "e", n: 5, words: "五" }]);
    kept.held.set(`${COUNTS_PREFIX}acct-2`, "{not json");
    expect(new PageCounts(kept, () => "acct-2").all(["a"])).toEqual([]);
    const refusing = new PageCounts({ read: () => null, write: () => { throw new Error("full"); }, remove: () => { throw new Error("full"); } }, () => "acct-1");
    expect([refusing.set("a", 1, undefined), refusing.of("a")?.n]).toEqual([true, 1]);
  });

  it("names the icon as built with no page's number, else by the pages' words, else 看板，有新内容", () => {
    for (const lang of ["zh", "en"] as const) {
      const say = (key: "board.board" | "board.boardPending" | "frame.boardNew", values?: Readonly<Record<string, number>>): string => text(lang, key, values);
      const comma = lang === "zh" ? "，" : ", ";
      expect([iconName(0, [], say, comma), iconName(3, [], say, comma)]).toEqual([text(lang, "board.board"), text(lang, "board.boardPending", { n: 3 })]);
      expect(iconName(0, [{ n: 6, words: "6 条待处理" }, { n: 2 }, { n: 1, words: "1 个补货" }], say, comma)).toBe([text(lang, "board.board"), "6 条待处理", "1 个补货"].join(comma));
      expect([iconName(0, [{ n: 2 }], say, comma), iconName(3, [{ n: 2 }], say, comma), iconName(3, [{ n: 2, words: "2 个" }], say, comma)]).toEqual([text(lang, "frame.boardNew"), text(lang, "board.boardPending", { n: 3 }), [text(lang, "board.boardPending", { n: 3 }), "2 个"].join(comma)]);
    }
    expect(text("zh", "frame.boardNew")).toBe("看板，有新内容");
  });
});
