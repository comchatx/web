import { describe, expect, it } from "vitest";
import { SEEN_PREFIX, SeenBoards } from "./board-seen.js";

const storage = (held = new Map<string, string>(), refuse = false) => ({
  held,
  read: (key: string) => held.get(key) ?? null,
  write: (key: string, value: string) => { if (refuse) throw new Error("full"); held.set(key, value); },
  remove: (key: string) => { held.delete(key); },
});

describe("what the seller has seen of the base's own boards", () => {
  const read = (seen: SeenBoards, boards: Record<string, number>, live = true, listed: readonly string[] = Object.keys(boards)): void => seen.readOf(listed, live, new Map(Object.entries(boards)));

  it("takes a board listed at the visit's first read from the box as seen as it stands, and holds newer cards fresh until the seller sees them", () => {
    const store = storage();
    const seen = new SeenBoards(store, () => "acct-1");
    read(seen, { Reports: 5 });
    expect([seen.fresh("Reports", 5), seen.fresh("Reports", 9)]).toEqual([false, true]);
    expect([seen.saw("Reports", 9), seen.fresh("Reports", 9), seen.saw("Reports", 9)]).toEqual([true, false, false]);
    expect(JSON.parse(store.held.get(`${SEEN_PREFIX}acct-1`)!)).toEqual({ Reports: 9 });
  });

  it("keeps no mark and draws no dot for a board until its cards are read from the running box: a kept read, or a read that failed, marks nothing (V2, V3)", () => {
    const store = storage();
    const seen = new SeenBoards(store, () => "acct-1");
    // A sleeping box: the kept read lists the boards and reads none of them.
    read(seen, {}, false, ["Reports", "Notes"]);
    expect([seen.fresh("Reports", 5), seen.saw("Reports", 5), store.held.has(`${SEEN_PREFIX}acct-1`)]).toEqual([false, false, false]);
    // The box wakes and Notes' own read fails; then it comes back. Each is seen as it stands at its first read.
    read(seen, { Reports: 5 }, true, ["Reports", "Notes"]);
    read(seen, { Reports: 5, Notes: 7 }, true, ["Reports", "Notes"]);
    expect([seen.fresh("Reports", 5), seen.fresh("Notes", 7), JSON.parse(store.held.get(`${SEEN_PREFIX}acct-1`)!)]).toEqual([false, false, { Reports: 5, Notes: 7 }]);
  });

  it("gives a board first listed after the visit's first read from the box nothing seen: a file in it is fresh, an empty one has no dot (V1)", () => {
    const store = storage();
    const seen = new SeenBoards(store, () => "acct-1");
    read(seen, { Reports: 5 });
    read(seen, { Reports: 5, Late: 9, Empty: 0 });
    expect([seen.fresh("Reports", 5), seen.fresh("Late", 9), seen.fresh("Empty", 0), seen.fresh("Empty", 3)]).toEqual([false, true, false, true]);
    expect(JSON.parse(store.held.get(`${SEEN_PREFIX}acct-1`)!)).toEqual({ Reports: 5, Late: 0, Empty: 0 });
  });

  it("keeps the marks for each account, compares a mark already held, carries a renamed board's mark, and lets go of a board that is gone", () => {
    const store = storage(new Map([[`${SEEN_PREFIX}acct-1`, JSON.stringify({ Reports: 5, Watch: 3, Bad: "x" })]]));
    let account: string | undefined = "acct-1";
    const seen = new SeenBoards(store, () => account);
    read(seen, { Reports: 6, Bad: 1 });
    expect([seen.fresh("Reports", 6), seen.fresh("Bad", 1)]).toEqual([true, false]);
    seen.moved("Reports", "Weekly");
    seen.moved("Nowhere", "Else");
    expect(seen.fresh("Weekly", 6)).toBe(true);
    seen.only(new Set(["Weekly", "Bad"]));
    seen.only(new Set(["Weekly", "Bad"]));
    expect(JSON.parse(store.held.get(`${SEEN_PREFIX}acct-1`)!)).toEqual({ Weekly: 5, Bad: 1 });
    account = "acct-2";
    expect(seen.fresh("Weekly", 99)).toBe(false);
    account = undefined;
    read(seen, { Weekly: 1 });
    expect([seen.fresh("Weekly", 1), seen.saw("Weekly", 2), store.held.has(`${SEEN_PREFIX}undefined`)]).toEqual([false, true, false]);
  });

  it("keeps the marks for the visit where the browser refuses to keep them, or holds what it cannot read", () => {
    const seen = new SeenBoards(storage(new Map([[`${SEEN_PREFIX}acct-1`, "{not json"]]), true), () => "acct-1");
    read(seen, { Reports: 5 });
    expect([seen.fresh("Reports", 5), seen.fresh("Reports", 7), seen.saw("Reports", 7), seen.fresh("Reports", 7)]).toEqual([false, true, true, false]);
    const none = new SeenBoards(undefined, () => "acct-1");
    read(none, { Reports: 5 });
    expect([none.fresh("Reports", 5), none.fresh("Reports", 6)]).toEqual([false, true]);
  });
});
