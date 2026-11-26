import { expect, it, vi } from "vitest";
import { PurchaseNews } from "./purchase-reports.js";
import { SourcesReads } from "./sources-reads.js";
import { EMPTY, reduce, TurnEnds, type StreamEvent, type StreamState } from "./stream-model.js";

it("reads again after a read that fails or an apply that throws: the last answer stands, the error is reported, and a later read applies", async () => {
  const applied: number[] = [];
  const report = vi.fn();
  let next: () => Promise<number> = async () => 1;
  const reads = new SourcesReads(() => next(), (value) => { if (value === 1) throw new Error("drawing failed"); applied.push(value); }, report);
  await reads.refresh();
  next = async () => { throw new Error("down"); };
  await reads.refresh();
  const standing = reads.latest;
  next = async () => 2;
  await reads.refresh();
  expect([standing, reads.latest, applied, report.mock.calls.length]).toEqual([1, 2, [2], 1]);
});

const life = "a".repeat(32);
const said = (seq: number): StreamEvent => ({ event: "entry", id: `${life}:${seq}`, data: { kind: "entry", epoch: life, seq, entryId: `e${seq}`, body: { form: "message", role: "assistant", content: [{ type: "text", text: "ok" }], stopReason: "stop" } } });
const charge = (seq: number, units: number): StreamEvent => ({ event: "charge", data: { kind: "charge", epoch: life, seq, units, sources: [{ source: "keepa", units }] } });
const play = (events: readonly StreamEvent[]): StreamState => events.reduce(reduce, EMPTY);

it("reads the sources and the account once for each turn's charge the box tells the page live, and for nothing read with what is stored", () => {
  const sources = vi.fn();
  const account = vi.fn();
  const news = new PurchaseNews({ sources, account });
  // A reload: the newest part arrives with its charges, which were told before.
  const opened = play([{ event: "entries", data: { kind: "entries", epoch: life, entries: [said(1).data, said(2).data], from: 1, earlier: false, charges: [{ epoch: life, seq: 2, units: 9, sources: [{ source: "keepa", units: 9 }] }] } }]);
  news.stream(opened);
  news.stream(opened);
  expect([sources.mock.calls.length, account.mock.calls.length]).toEqual([0, 0]);
  // A turn ends live with what it bought: one read of each, however often the page draws it.
  const live = [said(3), charge(3, 12)].reduce(reduce, opened);
  news.stream(live);
  news.stream(live);
  expect([sources.mock.calls.length, account.mock.calls.length]).toEqual([1, 1]);
  // A turn that bought nothing sends no charge, and one at zero is none: nothing to read.
  news.stream([said(4), charge(4, 0)].reduce(reduce, live));
  expect([sources.mock.calls.length, account.mock.calls.length]).toEqual([1, 1]);
});

it("keeps a place stored with its charge as stored when the same place's charge then comes live, and reads nothing for it", () => {
  // The mutation this holds against: a place charged from what is stored, then told live, keeping only live's mark. The purchase was
  // read with the stored part already, so a live mark would read the account and the sources a second time for it.
  const sources = vi.fn();
  const account = vi.fn();
  const news = new PurchaseNews({ sources, account });
  const opened = play([{ event: "entries", data: { kind: "entries", epoch: life, entries: [said(1).data, said(2).data], from: 1, earlier: false, charges: [{ epoch: life, seq: 2, units: 9, sources: [{ source: "keepa", units: 9 }] }] } }]);
  news.stream(opened);
  const told = reduce(opened, charge(2, 9));
  news.stream(told);
  expect([told.charges, sources.mock.calls.length, account.mock.calls.length]).toEqual([[{ seq: 2 }], 0, 0]);
  // A place first told live, then stored again by a resume, stays live and is read once.
  const fresh = reduce(told, charge(3, 4));
  news.stream(fresh);
  const resumed = reduce(fresh, { event: "charges", data: { kind: "charges", epoch: life, charges: [{ epoch: life, seq: 3, units: 4, sources: [{ source: "keepa", units: 4 }] }] } });
  news.stream(resumed);
  expect([resumed.charges, sources.mock.calls.length, account.mock.calls.length]).toEqual([[{ seq: 2 }, { seq: 3, live: true }], 1, 1]);
});

const turn = (running: boolean): StreamEvent => ({ event: "turn", data: { kind: "turn", running } });

it("reads the sources and the account once at the end of a turn the page saw run, which a model's charge alone never reports", () => {
  const sources = vi.fn();
  const account = vi.fn();
  const news = new PurchaseNews({ sources, account });
  const opened = play([{ event: "entries", data: { kind: "entries", epoch: life, entries: [said(1).data], from: 1, earlier: false } }, turn(false)]);
  // A connection says no turn runs: nothing ended under the page.
  news.stream(opened);
  const running = [turn(true), said(2)].reduce(reduce, opened);
  news.stream(running);
  expect([sources.mock.calls.length, account.mock.calls.length]).toEqual([0, 0]);
  const over = [turn(false)].reduce(reduce, running);
  news.stream(over);
  news.stream(over);
  expect([sources.mock.calls.length, account.mock.calls.length]).toEqual([1, 1]);
  // A turn that ends with its charge told in the same draw is one read.
  const bought = [turn(true), said(3), charge(3, 12), turn(false)].reduce(reduce, over);
  news.stream(bought);
  expect([sources.mock.calls.length, account.mock.calls.length]).toEqual([2, 2]);
});

it("reads at a turn's end exactly where the page's one reader of it sees one: a break, a new life and a turn never seen running are none", () => {
  const at = (epoch: string | undefined, turn: boolean | undefined): StreamState => ({ ...EMPTY, epoch, turn });
  const walk = [at("a", false), at("a", true), at("a", true), at("a", undefined), at("a", true), at("a", false), at("a", false), at("a", true), at("b", false), at(undefined, false), at(undefined, true), at(undefined, false)];
  const ends = new TurnEnds();
  const sources = vi.fn();
  const news = new PurchaseNews({ sources, account: vi.fn() });
  const read = walk.map((one) => { const before = sources.mock.calls.length; news.stream(one); return sources.mock.calls.length > before; });
  expect(read).toEqual(walk.map((one) => ends.seen(one)));
  expect(read.filter(Boolean)).toHaveLength(2);
});

it("keeps a turn's end while the settings window stands, and reads once as it closes", () => {
  const sources = vi.fn();
  const account = vi.fn();
  let standing = true;
  const news = new PurchaseNews({ sources, account, held: () => standing });
  const running = play([{ event: "entries", data: { kind: "entries", epoch: life, entries: [said(1).data], from: 1, earlier: false } }, turn(true)]);
  news.stream(running);
  const over = [turn(false)].reduce(reduce, running);
  news.stream(over);
  const again = [turn(true), said(2), charge(2, 5), turn(false)].reduce(reduce, over);
  news.stream(again);
  expect([sources.mock.calls.length, account.mock.calls.length]).toEqual([0, 0]);
  standing = false;
  news.stream(again);
  news.stream(again);
  expect([sources.mock.calls.length, account.mock.calls.length]).toEqual([1, 1]);
});
