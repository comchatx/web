import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CATALOGUE } from "./canned-catalogue.js";
import { type Plugin } from "./catalogue.js";
import { Doing, doingName, endSaid, factWords, failureWords, switching, type Failed } from "./plugins-doing.js";
import { toastStay } from "./forms.js";
import { ASLEEP, Refused, UNENDED } from "./plugins-clicks.js";
import type { Held } from "./plugins-model.js";

const plugin = (id: string): Plugin => CATALOGUE.plugins.find((one) => one.id === id)!;
const say = (key: string, values?: Readonly<Record<string, string | number>>): string => (values === undefined ? key : `${key}${JSON.stringify(values)}`);
const list = (names: readonly string[]): string => names.join("+");
/** The packages listed, each by the source its record installs from where the record names one. */
const held = (packages: readonly string[]): Held => ({ catalogue: CATALOGUE, packages: packages.map((name) => ({ name, version: "1", source: CATALOGUE.plugins.find((one) => one.box?.package === name)?.box?.source ?? name })), sources: [], models: [], onImage: [] }) as unknown as Held;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it("draws a click busy from the click to the answer, the same however long it runs, and says nothing of a success", async () => {
  const doing = new Doing();
  const drawn = vi.fn();
  doing.changed = drawn;
  let answer!: () => void;
  const out = doing.track({ item: plugin("cx-topics"), act: "install" }, () => new Promise<void>((resolve) => { answer = resolve; }));
  expect(doing.busy(plugin("cx-topics"))).toEqual({ act: "install" });
  expect(doing.busy(plugin("cx-sources"))).toBeUndefined();
  // Minutes on, it is drawn as it was at the press: no clock and no word that it runs long.
  await vi.advanceTimersByTimeAsync(240_000);
  expect(doing.busy(plugin("cx-topics"))).toEqual({ act: "install" });
  expect(drawn).toHaveBeenCalledTimes(1);
  answer();
  expect(await out).toBe("done");
  expect(doing.busy(plugin("cx-topics"))).toBeUndefined();
  expect(doing.failed(plugin("cx-topics"))).toBeUndefined();
});

it("keeps a failure with its reason and counts the tries in a row, hides it while the next try runs, and forgets it on leaving", async () => {
  const doing = new Doing();
  const item = plugin("cx-topics");
  await expect(doing.track({ item, act: "install", parts: [item] }, async () => { throw new Error("pi_failed"); })).rejects.toThrow("pi_failed");
  expect(doing.failed(item)).toEqual({ act: "install", reason: "pi_failed", tries: 1, parts: [item], seen: 0 });
  let refuse!: (error: Error) => void;
  const second = doing.track({ item, act: "install" }, () => new Promise<void>((_, reject) => { refuse = reject; }));
  expect(doing.failed(item)).toBeUndefined();
  refuse(new Error("answered 503"));
  await expect(second).rejects.toThrow();
  // A second try does only what the first left, and its line still names every part the click was for.
  expect(doing.failed(item)).toEqual({ act: "install", reason: undefined, tries: 2, parts: [item], seen: 0 });
  await expect(doing.track({ item, act: "off" }, async () => { throw new Error("pi_failed"); })).rejects.toThrow();
  expect(doing.failed(item)).toMatchObject({ act: "off", reason: "pi_failed", tries: 1 });
  doing.leave();
  expect(doing.failed(item)).toBeUndefined();
});

it("holds an answer that is a fact about the plugin as a fact, not as a failure to count or try again", async () => {
  const doing = new Doing();
  const item = plugin("cx-topics");
  await expect(doing.track({ item, act: "off" }, async () => { throw new Error("pi_failed"); })).rejects.toThrow();
  await expect(doing.track({ item, act: "off" }, async () => { throw new Error("single_file"); })).rejects.toThrow("single_file");
  expect(doing.failed(item)).toBeUndefined();
  expect([...doing.facts(item)]).toEqual(["single_file"]);
  expect(doing.facts(plugin("cx-sources")).size).toBe(0);
  // Only the answer that the plugin is gone keeps its record, for the one line at its address once no list names it.
  expect(doing.gone("#/plugins/p/cx-topics")).toBeUndefined();
  await expect(doing.track({ item, act: "off" }, async () => { throw new Error("not_listed"); })).rejects.toThrow();
  expect(doing.gone("#/plugins/p/cx-topics")).toBe(item);
  // An install answered, either way, takes the answer that it was gone with it, and leaves what else the page heard.
  await expect(doing.track({ item, act: "install" }, async () => { throw new Error("pi_failed"); })).rejects.toThrow();
  expect([...doing.facts(item)]).toEqual(["single_file"]);
  expect(doing.gone("#/plugins/p/cx-topics")).toBeUndefined();
  await expect(doing.track({ item, act: "off" }, async () => { throw new Error("not_listed"); })).rejects.toThrow();
  await doing.track({ item, act: "install" }, async () => undefined);
  expect([...doing.facts(item)]).toEqual(["single_file"]);
  await expect(doing.track({ item, act: "off" }, async () => { throw new Error("not_listed"); })).rejects.toThrow();
  doing.leave();
  expect(doing.facts(item).size).toBe(0);
  expect(doing.gone("#/plugins/p/cx-topics")).toBeUndefined();
});

it("opens the facts heard in answer to a turning off with the source's first fact, once, and those heard of any other click with nothing", async () => {
  const doing = new Doing();
  const keepa = plugin("keepa");
  const gate = (enabled: boolean): Held => ({ ...held(["keepa"]), sources: [{ name: "keepa", enabled }] }) as unknown as Held;
  await expect(doing.track({ item: keepa, act: "on" }, async () => { throw new Error("not_listed"); })).rejects.toThrow();
  expect([doing.stopped(keepa), factWords(say, "en", gate(true), keepa, doing.facts(keepa), doing.stopped(keepa))]).toEqual([false, "pl.why.gone"]);
  await expect(doing.track({ item: keepa, act: "off" }, async () => { throw new Error("single_file"); })).rejects.toThrow();
  expect(doing.stopped(keepa)).toBe(true);
  expect(factWords(say, "en", gate(false), keepa, doing.facts(keepa), true)).toBe('pl.fail.sourceOff{"name":"Keepa API"} pl.why.gone pl.why.file{"name":"Keepa API"}');
  // A gate that still has the source on did not take the switch, and a plugin that sells none has no such fact.
  expect(factWords(say, "en", gate(true), keepa, doing.facts(keepa), true)).toBe("pl.why.gone pl.why.fileOnly");
  // One file that cannot be switched says the way back to buying only where the press stopped it; elsewhere, its limit.
  expect(factWords(say, "en", gate(false), plugin("cx-topics"), new Set(["single_file"]), true)).toBe("pl.why.fileOnly");
  expect(factWords(say, "en", gate(false), keepa, new Set(["single_file"]))).toBe("pl.why.fileOnly");
  expect(factWords(say, "en", gate(false), keepa, new Set(["single_file"]), true)).toBe('pl.fail.sourceOff{"name":"Keepa API"} pl.why.file{"name":"Keepa API"}');
  doing.leave();
  expect(doing.stopped(keepa)).toBe(false);
});

it("says of a failure what did not happen and why, and something new the second time", () => {
  const parts = [plugin("cx-sources"), plugin("cx-topics")];
  const failed = (over: Partial<Failed>): Failed => ({ act: "install", reason: "pi_failed", tries: 1, parts, seen: 0, ...over });
  // Some of its parts in or none, an install the platform refused says it was not installed: what cx's computer ran is the queue's to say.
  for (const some of [["cx-sources"], []]) expect(failureWords(say, "en", list, held(some), plugin("cx-topics"), failed({}))).toEqual({ on: false, both: false, what: 'pl.fail.install{"name":"Chat Chapters"}', why: "pl.why.failed", retry: true, repeated: undefined });
  expect(failureWords(say, "en", list, held(["cx-sources"]), plugin("cx-topics"), failed({ tries: 2, reason: undefined }))).toMatchObject({ why: undefined, retry: true, repeated: 'pl.fail.again{"count":2}' });
  // A reason no second try changes offers none.
  for (const reason of ["single_file", "not_listed"] as const) expect(failureWords(say, "en", list, held([]), plugin("cx-topics"), failed({ act: "remove", reason })).retry).toBe(false);
  for (const reason of ["pi_failed", "timed_out", "box_unreachable", "waiting_full", "sources_unavailable"] as const) expect(failureWords(say, "en", list, held([]), plugin("cx-topics"), failed({ reason })).retry).toBe(true);
  expect(failureWords(say, "en", list, held([]), plugin("cx-topics"), failed({ reason: "waiting_full" })).why).toBe("pl.why.full");
  expect(failureWords(say, "en", list, held([]), plugin("cx-topics"), failed({ reason: "sources_unavailable" })).why).toBe("pl.why.source");

  // A plugin that sells a source: the click switched the source before it failed, and the line says both things that are now true.
  const keepa = plugin("keepa");
  // The package as the failed click left it: not there for an install, off for a turning on, on otherwise.
  const gated = (enabled: boolean, act: Failed["act"], done: boolean): Held => {
    const there = act === "install" ? done : act === "remove" ? !done : true;
    const on = act === "on" ? done : act === "off" ? !done : true;
    return { ...held([]), packages: there ? [{ name: "cx-keepa", version: "1", source: "npm:cx-keepa", enabled: on }] : [], sources: [{ name: "keepa", enabled }] } as unknown as Held;
  };
  const words = (act: Failed["act"], enabled: boolean, reason: Failed["reason"] = "pi_failed", done = false) => { const said = failureWords(say, "en", list, gated(enabled, act, done), keepa, failed({ act, reason, parts: [] })); return [said.what, said.why, said.retry]; };
  expect(words("off", false)).toEqual(['pl.fail.sourceOff{"name":"Keepa API"} pl.unfinished.off', undefined, true]);
  expect(words("remove", false)).toEqual(['pl.fail.sourceOff{"name":"Keepa API"} pl.unfinished.remove', undefined, true]);
  expect(words("install", true, "timed_out")).toEqual(['pl.fail.sourceOn{"name":"Keepa API"} pl.unfinished.install', "pl.why.long", true]);
  expect(words("on", true, undefined)).toEqual(['pl.fail.sourceOn{"name":"Keepa API"} pl.unfinished.on', undefined, true]);
  // The row was full after the gate took the switch.
  expect(words("off", false, "waiting_full")).toEqual(['pl.fail.sourceOff{"name":"Keepa API"} pl.unfinished.off', "pl.why.full", true]);
  // Only the reason the second fact already says is left out after the two facts; every other follows them.
  expect([words("off", false)[1], words("remove", false, "timed_out")[1], words("on", true, "box_unreachable")[1]]).toEqual([undefined, "pl.why.long", "pl.why.unreached"]);
  // The gate did not take the switch: one thing is true, that nothing changed.
  expect(words("off", true, "sources_unavailable")).toEqual(['pl.fail.off{"name":"Keepa API"}', "pl.why.source", true]);
  expect(words("install", false, "sources_unavailable")).toEqual(['pl.fail.install{"name":"Keepa API"}', "pl.why.source", true]);
  // Nor did it where the flag already stood as the click asked, from a try before.
  expect(words("off", false, "sources_unavailable")).toEqual(['pl.fail.off{"name":"Keepa API"}', "pl.why.source", true]);
  // The plugin already is what the click wanted: nothing is unfinished to say.
  for (const [act, enabled] of [["off", false], ["install", true], ["remove", false]] as const) expect(words(act, enabled, "pi_failed", true)[0]).toBe(`pl.fail.${act}{"name":"Keepa API"}`);
  // A turn-on that left the plugin on, its source and its package both, says that it is on and nothing else: whatever the answer was,
  // nothing failed for the seller, so there is no reason, no second try and no count.
  for (const reason of ["pi_failed", "waiting_full", "timed_out", undefined] as const) {
    expect(failureWords(say, "en", list, gated(true, "on", true), keepa, failed({ act: "on", reason, parts: [], tries: 3 })))
      .toEqual({ on: true, both: false, what: 'pl.fail.stillOn{"name":"Keepa API"}', why: undefined, retry: false, repeated: undefined });
  }
  // The gate on and the package still off is the two facts, with the count; the gate off is the one place the plugin was not turned on.
  expect(failureWords(say, "en", list, gated(true, "on", false), keepa, failed({ act: "on", parts: [], tries: 2 }))).toMatchObject({ on: false, both: true, retry: true, repeated: 'pl.fail.again{"count":2}' });
  expect(failureWords(say, "en", list, gated(false, "on", false), keepa, failed({ act: "on", reason: "sources_unavailable", parts: [] }))).toMatchObject({ on: false, both: false, what: 'pl.fail.on{"name":"Keepa API"}', why: "pl.why.source", retry: true });
  expect(failureWords(say, "en", list, gated(false, "on", true), keepa, failed({ act: "on", reason: "sources_unavailable", parts: [] }))).toMatchObject({ on: false, what: 'pl.fail.on{"name":"Keepa API"}' });
  // A plugin with no source reads its package alone.
  const tidy = (enabled: boolean): Held => ({ ...held([]), packages: [{ name: "cx-topics", version: "1", source: "npm:@comchatx/cx-topics", enabled }] }) as unknown as Held;
  expect([failureWords(say, "en", list, tidy(true), plugin("cx-topics"), failed({ act: "on", parts: [] })).on, failureWords(say, "en", list, tidy(false), plugin("cx-topics"), failed({ act: "on", parts: [] })).what]).toEqual([true, 'pl.fail.on{"name":"Chat Chapters"}']);
  // A source the gate does not list has no state to say.
  expect(failureWords(say, "en", list, held(["keepa"]), keepa, failed({ act: "off", parts: [] })).what).toBe('pl.fail.off{"name":"Keepa API"}');

  // A turning off refused as one file says the way back where the gate took the switch, and the limit where it did not.
  expect([true, false].map((enabled) => failureWords(say, "en", list, gated(enabled, "off", false), keepa, failed({ act: "off", reason: "single_file", parts: [] })).why)).toEqual(["pl.why.fileOnly", 'pl.why.file{"name":"Keepa API"}']);
});

it("draws a click with no end at the bound by the list read after it, with no failure, and answers that it waits", async () => {
  const doing = new Doing();
  const item = plugin("cx-topics");
  expect(await doing.track({ item, act: "install" }, async () => { throw new Error(UNENDED); })).toBe("waits");
  expect([doing.busy(item), doing.failed(item)]).toEqual([undefined, undefined]);
  const sources = plugin("cx-sources");
  expect(await doing.track({ item: sources, act: "off" }, async () => { throw new Error(UNENDED); })).toBe("waits");
  expect([doing.busy(sources), doing.failed(sources)]).toEqual([undefined, undefined]);
  // Leaving the page leaves them: the next opening's list puts back what still waits.
  doing.leave();
  expect(doing.busy(sources)).toBeUndefined();
});

it("keeps pi's own words for a failure, from the click's answer and from an end the list says, and none where pi said nothing", async () => {
  const doing = new Doing();
  const item = plugin("cx-topics");
  const words = "npm error 404 Not Found - GET https://registry.npmjs.org/@comchatx%2fcx-topics";
  await expect(doing.track({ item, act: "install" }, async () => { throw new Refused([{ source: "npm:@comchatx/cx-topics", op: "install", reason: "pi_failed", detail: words }]); })).rejects.toThrow();
  expect(doing.failed(item)).toMatchObject({ reason: "pi_failed", detail: words });
  const sources = plugin("cx-sources");
  doing.heard([], [{ item: sources, act: "off", ok: false, reason: "pi_failed", detail: "pi exited 1", key: "k", at: 3 }]);
  expect(doing.failed(sources)).toMatchObject({ detail: "pi exited 1" });
  await expect(doing.track({ item, act: "install" }, async () => { throw new Error("box_unreachable"); })).rejects.toThrow();
  expect(doing.failed(item)?.detail).toBeUndefined();
});

it("answers a click that ended with no word of how as unsaid, with nothing kept of it", async () => {
  const doing = new Doing();
  const item = plugin("cx-topics");
  expect(await doing.track({ item, act: "remove" }, async () => "unsaid")).toBe("unsaid");
  expect([doing.busy(item), doing.failed(item)]).toEqual([undefined, undefined]);
});

it("draws what the list says waits with no ring: an install's place is the queue's to draw", () => {
  const doing = new Doing();
  const [tidy, sources] = [plugin("cx-topics"), plugin("cx-sources")];
  doing.heard([{ item: tidy, act: "install" }], []);
  expect(doing.busy(tidy)).toBeUndefined();
  doing.heard([{ item: sources, act: "off" }], []);
  expect([doing.busy(tidy), doing.busy(sources)]).toEqual([undefined, undefined]);
});

it("keeps a click under way as it is when the list says it waits, and does not take it for one that waits no longer", async () => {
  const doing = new Doing();
  const item = plugin("cx-topics");
  let answer!: () => void;
  const out = doing.track({ item, act: "install" }, () => new Promise<void>((resolve) => { answer = resolve; }));
  doing.heard([{ item, act: "install" }], []);
  expect(doing.busy(item)?.waits).toBeUndefined();
  doing.heard([], []);
  expect(doing.busy(item)).toMatchObject({ act: "install" });
  answer();
  await out;
});

it("draws a failed end the list keeps once in a tab, on the record it names, and takes it away when the list keeps it no longer; an install's or an update's is the queue's", () => {
  const doing = new Doing();
  const item = plugin("cx-topics");
  for (const act of ["install", "update"] as const) {
    doing.heard([], [{ item, act, ok: false, reason: "pi_failed", key: "s\u00004", at: 4 }]);
    expect(doing.failed(item)).toBeUndefined();
  }
  const end = { item, act: "remove" as const, ok: false, reason: "pi_failed", key: "s\u00005", at: 5 };
  doing.heard([], [end]);
  expect(doing.failed(item)).toEqual({ act: "remove", reason: "pi_failed", tries: 1, parts: [], seen: 5, end: "s\u00005" });
  // The seller walked away from it: the same end is not drawn again in this tab.
  doing.leave();
  doing.heard([], [end]);
  expect(doing.failed(item)).toBeUndefined();
  // A later click on the source took the end out of the list, and the line goes with it.
  const next = { ...end, key: "s\u00009", at: 9, reason: "some word of pi's" };
  doing.heard([], [next]);
  expect(doing.failed(item)).toMatchObject({ reason: undefined, end: "s\u00009" });
  doing.heard([], []);
  expect(doing.failed(item)).toBeUndefined();
});

it("holds a failed end that is a fact as a fact, and draws no failed end over a click under way or a failure already drawn", async () => {
  const doing = new Doing();
  const [tidy, sources] = [plugin("cx-topics"), plugin("cx-sources")];
  doing.heard([], [{ item: tidy, act: "off", ok: false, reason: "single_file", key: "a", at: 1 }]);
  expect([doing.failed(tidy), [...doing.facts(tidy)]]).toEqual([undefined, ["single_file"]]);
  await expect(doing.track({ item: sources, act: "off" }, async () => { throw new Error("pi_failed"); })).rejects.toThrow();
  doing.heard([], [{ item: sources, act: "install", ok: false, reason: "timed_out", key: "b", at: 2 }]);
  expect(doing.failed(sources)).toMatchObject({ act: "off", reason: "pi_failed" });
});

it("takes a failure this page drew for its own click away once the list says an end done it had not said before, by the list's own clock", async () => {
  const doing = new Doing();
  const item = plugin("cx-topics");
  const before = { item, act: "install" as const, ok: true, reason: undefined, key: "a", at: 5000 };
  doing.heard([], [before]);
  await expect(doing.track({ item, act: "off" }, async () => { throw new Error("sources_unavailable"); })).rejects.toThrow();
  // The end the list already said is older than the failure, by the one clock both are read on.
  doing.heard([], [before]);
  expect(doing.failed(item)).toMatchObject({ act: "off", seen: 5000 });
  doing.heard([], [{ ...before, act: "on", key: "b", at: 5001 }]);
  expect(doing.failed(item)).toBeUndefined();
});

it("keeps a click that waits drawn on its record while anything it was for still waits, though the list names the record itself nowhere", async () => {
  const doing = new Doing();
  const bundle = CATALOGUE.bundles[0]!;
  const [tidy, sources] = [plugin("cx-topics"), plugin("cx-sources")];
  expect(await doing.track({ item: bundle, act: "install", parts: [sources, tidy] }, async () => { throw new Error(UNENDED); })).toBe("waits");
  doing.heard([{ item: sources, act: "install" }, { item: tidy, act: "install" }], []);
  // A bundle's install that waits reads as installing, never as installed ahead of its plugins.
  expect([doing.busy(bundle), doing.busy(tidy)]).toEqual([{ act: "install" }, undefined]);
  doing.heard([{ item: tidy, act: "install" }], []);
  expect(doing.busy(bundle)).toEqual({ act: "install" });
  doing.heard([], []);
  expect(doing.busy(bundle)).toBeUndefined();
  // A click on it made anew is its own: what the last one was for holds no mark for it.
  expect(await doing.track({ item: bundle, act: "remove" }, async () => { throw new Error(UNENDED); })).toBe("waits");
  doing.heard([{ item: tidy, act: "install" }], []);
  expect(doing.busy(bundle)).toBeUndefined();
});

it("reads a bundle's state from its members': removing while any removal is out, else installing while an install is, and nothing once cx's computer has ended them", () => {
  const doing = new Doing();
  const bundle = CATALOGUE.bundles[0]!;
  const [tidy, sources] = [plugin("cx-topics"), plugin("cx-sources")];
  doing.members = (one) => (one === bundle ? [sources, tidy] : []);
  doing.heard([{ item: sources, act: "remove" }], []);
  expect([doing.busy(bundle), doing.pending(sources), doing.pending(tidy), doing.busy(sources)]).toEqual([{ act: "remove" }, { act: "remove" }, undefined, undefined]);
  doing.heard([{ item: tidy, act: "install" }], []);
  expect([doing.busy(bundle), doing.pending(tidy)]).toEqual([{ act: "install" }, { act: "install" }]);
  doing.heard([{ item: tidy, act: "install" }, { item: sources, act: "remove" }], []);
  expect(doing.busy(bundle)).toEqual({ act: "remove" });
  doing.heard([], []);
  expect([doing.busy(bundle), doing.pending(bundle)]).toEqual([undefined, undefined]);
  // A switch is no install or removal: the bundle stands as it is.
  doing.heard([{ item: sources, act: "off" }], []);
  expect([doing.busy(bundle), doing.pending(sources)]).toEqual([undefined, undefined]);
});

it("reads a bundle as removing while its own install is still being written down and a member's removal is out or written; the member keeps its own rule", async () => {
  for (const written of [false, true]) {
    const doing = new Doing();
    const bundle = CATALOGUE.bundles[0]!;
    const [tidy, sources] = [plugin("cx-topics"), plugin("cx-sources")];
    doing.members = (one) => (one === bundle ? [sources, tidy] : []);
    let installed!: () => void;
    const install = doing.track({ item: bundle, act: "install", parts: [sources, tidy] }, () => new Promise<void>((done) => { installed = done; }));
    expect(doing.busy(bundle)).toEqual({ act: "install" });
    let removed!: () => void;
    const remove = doing.track({ item: sources, act: "remove" }, () => new Promise<void>((done) => { removed = done; }));
    if (written) doing.written(sources);
    // The member's own: being written down while out, drawn as asked once written; its removal is under way either way.
    expect([written, doing.busy(bundle), doing.pending(bundle), doing.busy(sources), doing.pending(sources)]).toEqual([written, { act: "remove" }, { act: "remove" }, written ? undefined : { act: "remove" }, { act: "remove" }]);
    removed();
    await remove;
    expect(doing.busy(bundle)).toEqual({ act: "install" });
    installed();
    await install;
    expect(doing.busy(bundle)).toBeUndefined();
  }
});

it("names a click being written down for a screen reader by its act and its record, the control saying no words", () => {
  expect(doingName(say, "en", plugin("cx-topics"), { act: "remove" })).toBe(`pl.doing.removeName{"name":"${plugin("cx-topics").name}"}`);
  expect([switching(undefined), switching({ act: "update" }), switching({ act: "off" })]).toEqual([undefined, undefined, "off"]);
});

it("draws a click busy until the platform has written it down and as the seller asked from then, asleep or awake, and runs what follows once", async () => {
  for (const [end, how] of [[undefined, "done"], [ASLEEP, "asleep"]] as const) {
    const doing = new Doing();
    const drawn = vi.fn();
    doing.changed = drawn;
    const item = plugin("cx-topics");
    const wrote = vi.fn();
    let written!: () => void, answer!: () => void;
    const out = doing.track({ item, act: "install" }, async () => {
      await new Promise<void>((resolve) => { written = resolve; });
      doing.written(item);
      doing.written(item);
      await new Promise<void>((resolve, reject) => { answer = () => (end === undefined ? resolve() : reject(new Error(end))); });
    }, wrote);
    await vi.advanceTimersByTimeAsync(0);
    expect([doing.busy(item), wrote.mock.calls.length]).toEqual([{ act: "install" }, 0]);
    written();
    await vi.advanceTimersByTimeAsync(0);
    // Written down: its ring goes, the queue draws it, and nothing yet said of how it ends.
    expect([doing.busy(item), wrote.mock.calls.length, drawn.mock.calls.length]).toEqual([undefined, 1, 2]);
    answer();
    expect(await out).toBe(how);
    expect([doing.busy(item), doing.failed(item)]).toEqual([undefined, undefined]);
  }
});

it("leaves a newer click on the record drawn as it is when an older one written down ends", async () => {
  const doing = new Doing();
  const item = plugin("cx-topics");
  let answer!: () => void;
  const first = doing.track({ item, act: "install" }, async () => { doing.written(item); await new Promise<void>((resolve) => { answer = resolve; }); });
  await vi.advanceTimersByTimeAsync(0);
  const second = doing.track({ item, act: "remove" }, () => new Promise<void>(() => undefined));
  answer();
  expect(await first).toBe("done");
  expect(doing.busy(item)).toEqual({ act: "remove" });
  void second;
});

it("says once a click ends the act's own words when it is done, and nothing when it waits or ended unsaid", () => {
  expect((["done", "asleep", "waits", "unsaid"] as const).map((how) => endSaid(how, "told"))).toEqual(["told", "", "", ""]);
});

it("keeps a fact heard of a part on that part: an install that heard nothing else is done, and one whose own click failed keeps that failure alone", async () => {
  const doing = new Doing();
  const [tidy, keepa] = [plugin("cx-topics"), plugin("keepa")];
  const about = { item: tidy, act: "install", parts: [tidy], partOf: (source: string) => (source === "k" ? keepa : source === "t" ? tidy : undefined) } as const;
  await expect(doing.track(about, async () => { throw new Refused([{ source: "k", op: "on", reason: "not_listed" }]); })).resolves.toBe("done");
  expect([doing.failed(tidy), [...doing.facts(tidy)], [...doing.facts(keepa)]]).toEqual([undefined, [], ["not_listed"]]);
  await expect(doing.track(about, async () => { throw new Refused([{ source: "k", op: "on", reason: "not_listed" }, { source: "t", op: "install", reason: "timed_out" }]); })).rejects.toThrow();
  expect([doing.failed(tidy)?.reason, [...doing.facts(tidy)]]).toEqual(["timed_out", []]);
  // A fact about the record itself, or one no part is known for, is the record's own as before.
  await expect(doing.track({ item: keepa, act: "off", partOf: () => keepa }, async () => { throw new Refused([{ source: "k", op: "off", reason: "single_file" }]); })).rejects.toThrow();
  expect([...doing.facts(keepa)].sort()).toEqual(["not_listed", "single_file"]);
  await expect(doing.track({ item: tidy, act: "install" }, async () => { throw new Refused([{ source: "x", op: "on", reason: "single_file" }]); })).rejects.toThrow();
  expect([...doing.facts(tidy)]).toEqual(["single_file"]);
});

it("reads a toast's stay from its words: three seconds for a short confirmation, five at least for a failure, longer for more words", () => {
  expect([
    toastStay("Keepa is on.", false),
    toastStay("GPT-6 Terra is in the chat's picker.", false),
    toastStay("Not saved. Try again.", true),
    toastStay("Conversation Titles was not turned off. Try again.", true),
    toastStay("cx has stopped buying from Keepa. cx's computer could not finish turning it off. Try again.", true),
    toastStay("Keepa 已开启。", false),
    toastStay("Conversation Titles 没有关闭成功，请重试。", true),
    toastStay("cx 已停止向 Keepa 购买数据。cx 的电脑未能完成关闭。重试。", true),
  ]).toEqual([3_200, 3_800, 5_000, 5_000, 7_400, 3_200, 5_000, 6_000]);
});

it("hands back a failed switch it heard of first, to be told once: none at its first read, none of a removal's, an install's or an update's, none twice", () => {
  const doing = new Doing();
  const sources = plugin("cx-sources"), topics = plugin("cx-topics");
  // The first read's ends stand on their records: the page was not there when they ended.
  expect(doing.heard([], [{ item: sources, act: "off", ok: false, reason: "pi_failed", key: "a", at: 3 }])).toEqual([]);
  expect(doing.failed(sources)).toMatchObject({ act: "off" });
  const late = { item: topics, act: "on" as const, ok: false, reason: "pi_failed", key: "b", at: 5 };
  expect(doing.heard([], [late, { item: topics, act: "install", ok: false, reason: "pi_failed", key: "c", at: 6 }, { item: sources, act: "remove", ok: false, reason: "pi_failed", key: "d", at: 7 }])).toEqual([{ item: topics, act: "on" }]);
  // Heard again, the same end is not told again.
  expect(doing.heard([], [late])).toEqual([]);
});
