import { describe, expect, it } from "vitest";
import { contextFill } from "./context-usage.js";

const stats = (contextUsage: unknown) => ({ type: "response", command: "get_session_stats", success: true, data: { tokens: { total: 1 }, contextUsage } });

describe("how full cx's context is, from pi's answer to get_session_stats", () => {
  it("is pi's percent, whole and within 0 to 100", () => {
    expect([62.4, 62.5, 0, 100, 103.2, -1].map((percent) => contextFill(stats({ tokens: 1, contextWindow: 2, percent })))).toEqual([62, 63, 0, 100, 100, 0]);
  });
  it("is summarised where pi says no figure yet, right after a compaction", () => {
    expect(contextFill(stats({ tokens: null, contextWindow: 200_000, percent: null }))).toBeNull();
  });
  it("is unknown for an answer with no figure, a refusal, or anything else", () => {
    for (const answer of [stats(undefined), stats({ tokens: 1 }), stats({ percent: "62" }), stats({ percent: Number.NaN }), { type: "response", success: false, error: "Unknown command" }, { success: true }, undefined, null, "x"]) {
      expect(contextFill(answer), JSON.stringify(answer)).toBeUndefined();
    }
  });
});
