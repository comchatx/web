import { describe, expect, it } from "vitest";
import { UPLOAD_MAX_BYTES, UPLOAD_PIECE_BYTES, UPLOAD_VERB } from "../shared/upload.js";
import { NotRunning } from "./backend.js";
import { base64, FileUploads, type FileCard, type UploadWhy } from "./file-uploads.js";
import { fileSaid } from "./quote-box.js";
import { text } from "./strings.js";

type Command = Readonly<Record<string, unknown>>;
const ok = (data?: unknown): unknown => ({ type: "response", command: UPLOAD_VERB, success: true, ...(data === undefined ? {} : { data }) });
const no = (error: string, data?: unknown): unknown => ({ type: "response", command: UPLOAD_VERB, success: false, error, ...(data === undefined ? {} : { data }) });
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A box that takes files as the steward does, its answers open to a test's change. */
function box(taken: readonly string[] = []) {
  const asked: Command[] = [];
  const tree = new Set(taken);
  const going = new Map<string, { name: string; received: number }>();
  let n = 0;
  const said: { told: FileCard[][]; changed: number; woken: number; opened: number; notThere: number } = { told: [], changed: 0, woken: 0, opened: 0, notThere: 0 };
  // One open at a time, whoever asks, as the page's visit shares it; each one answered is the box found up again.
  let opening: Promise<boolean> | undefined;
  let found = 0;
  const state = { awake: true, starts: true, answer: undefined as ((command: Command) => unknown) | undefined, why: undefined as UploadWhy | undefined };
  const steward = (command: Command): unknown => {
    const one = going.get(String(command["upload"]));
    switch (command["op"]) {
      case "begin": { const upload = `u${++n}`; going.set(upload, { name: String(command["name"]), received: 0 }); return ok({ upload }); }
      case "piece": one!.received += Buffer.from(String(command["data"]), "base64").byteLength; return ok({ received: one!.received });
      case "end": { let name = one!.name; for (let k = 2; tree.has(name); k++) name = `${one!.name} (${k})`; tree.add(name); return ok({ name }); }
      default: return ok();
    }
  };
  const uploads = new FileUploads({
    command: async (command) => { asked.push(command); await tick(); return state.answer?.(command) ?? steward(command); },
    wake: async () => {
      if (state.awake) return true;
      said.woken++;
      return opening ??= (async () => { said.opened++; await tick(); if (state.starts) { state.awake = true; found++; } return state.awake; })().finally(() => { opening = undefined; });
    },
    why: () => state.why,
    found: () => found,
    notThere: (under) => { said.notThere++; if (under === found) state.awake = false; },
    changed: () => { said.changed++; },
    tell: (cards) => { said.told.push(cards.map((card) => ({ ...card }))); },
    picture: async (file) => { pictured.push(file.name); if (file.name === "broken.png") throw new Error("not a picture"); return file.name === "blank.png" ? undefined : `data:${file.name}`; },
  });
  const pictured: string[] = [];
  const ops = (): readonly string[] => asked.map((command) => String(command["op"]));
  const settled = async (): Promise<void> => { for (let turn = 0; turn < 10_000 && uploads.cards.some((card) => card.state === "uploading"); turn++) await tick(); };
  return { uploads, asked, ops, said, state, tree, pictured, settled };
}
const file = (name: string, bytes: number, type = "text/plain"): File => new File([new Uint8Array(bytes).fill(7)], name, { type });
const states = (uploads: FileUploads): readonly string[] => uploads.cards.map((card) => card.state);

describe("the files in the message box", () => {
  it("sends a file the moment it is added, in pieces the box's command bound holds, and names it once it is whole", async () => {
    const { uploads, asked, ops, settled } = box();
    uploads.add([file("cost-sheet.xlsx", UPLOAD_PIECE_BYTES + 10)]);
    expect(states(uploads)).toEqual(["uploading"]);
    expect([uploads.ready, uploads.names]).toEqual([false, []]);
    await settled();
    expect(ops()).toEqual(["begin", "piece", "piece", "end"]);
    expect(asked.filter((command) => command["op"] === "piece").map((command) => command["at"])).toEqual([0, UPLOAD_PIECE_BYTES]);
    expect(asked[0]).toEqual({ type: UPLOAD_VERB, op: "begin", name: "cost-sheet.xlsx", bytes: UPLOAD_PIECE_BYTES + 10 });
    expect([states(uploads), uploads.ready, uploads.names, uploads.cards[0]!.received]).toEqual([["done"], true, ["cost-sheet.xlsx"], UPLOAD_PIECE_BYTES + 10]);
  });

  it("starts cx's computer for a file added while it sleeps, the card going up from the moment it is added, and sends it once the computer runs", async () => {
    const { uploads, ops, state, said, settled } = box();
    state.awake = false;
    uploads.add([file("a.txt", 3), file("b.txt", 2)]);
    expect([states(uploads), ops(), uploads.ready]).toEqual([["uploading", "uploading"], [], false]);
    await settled();
    expect([states(uploads), ops(), uploads.ready, said.woken]).toEqual([["done", "done"], ["begin", "begin", "piece", "piece", "end", "end"], true, 2]);
  });

  it("says on a failed card why cx's computer did not start, in the words the page has for each cause, and only that it failed for anything else", async () => {
    const said: string[][] = [];
    for (const language of ["en", "zh"] as const) {
      const words: string[] = [];
      for (const why of ["cx.say.balance", "status.unreachable", "cx.say.refused", "cx.say.failed", undefined] as const) {
        const { uploads, state, settled } = box();
        state.awake = false;
        state.starts = false;
        state.why = why;
        uploads.add([file("a.txt", 3)]);
        await settled();
        words.push(fileSaid(uploads.cards[0]!, (key, values) => text(language, key, values))!);
      }
      // Anything else, the box failing a piece, says only that it failed.
      const { uploads, state, settled } = box();
      state.why = "cx.say.balance";
      state.answer = (command) => (command["op"] === "end" ? { type: "response", success: false, error: "no" } : undefined);
      uploads.add([file("b.txt", 3)]);
      await settled();
      words.push(fileSaid(uploads.cards[0]!, (key, values) => text(language, key, values))!);
      said.push(words);
    }
    expect(said).toEqual([
      ["Balance too low", "Can't connect", "Can't switch on right now", "Didn't switch on", "Upload failed", "Upload failed"],
      ["余额不足", "无法连接", "暂时无法开机", "开机失败", "上传失败", "上传失败"],
    ]);
  });

  it("fails a file's card when cx's computer does not start, and Try again starts it again", async () => {
    const { uploads, ops, state, said, settled } = box();
    state.awake = false;
    state.starts = false;
    uploads.add([file("a.txt", 3)]);
    await settled();
    expect([states(uploads), ops(), said.told.at(-1)!.map((card) => card.state)]).toEqual([["failed"], [], ["failed"]]);
    state.starts = true;
    uploads.retry(uploads.cards[0]!.id);
    expect(states(uploads)).toEqual(["uploading"]);
    await settled();
    expect([states(uploads), ops(), said.woken]).toEqual([["done"], ["begin", "piece", "end"], 2]);
  });

  describe("a command the box was not there to take", () => {
    /** The box refuses the commands `refuses` picks, as many times as `times` says, the way the platform passes the refusal on. */
    const refusing = (refuses: (command: Command) => boolean, times = 1) => {
      const page = box();
      let left = times;
      page.state.answer = (command) => { if (left > 0 && refuses(command)) { left--; throw new NotRunning(); } return undefined; };
      return page;
    };

    it("starts the box once and sends a file whose begin was refused again from its start", async () => {
      const { uploads, ops, said, settled } = refusing((command) => command["op"] === "begin");
      uploads.add([file("a.txt", 3)]);
      await settled();
      expect([states(uploads), uploads.names, ops(), said.notThere, said.opened, said.told.flat()]).toEqual([["done"], ["a.txt"], ["begin", "begin", "piece", "end"], 1, 1, []]);
    });

    it("fails the file the box refuses again after its one start", async () => {
      const { uploads, ops, said, settled } = refusing((command) => command["op"] === "begin", 2);
      uploads.add([file("a.txt", 3)]);
      await settled();
      expect([states(uploads), ops(), said.notThere, said.opened, said.told.at(-1)!.map((card) => card.state)]).toEqual([["failed"], ["begin", "begin"], 1, 1, ["failed"]]);
    });

    it("sends a file refused in its middle again from its begin, not from the piece, and lets the first upload go", async () => {
      const { uploads, asked, ops, said, settled } = refusing((command) => command["op"] === "piece" && command["at"] === UPLOAD_PIECE_BYTES);
      uploads.add([file("big.bin", UPLOAD_PIECE_BYTES + 10)]);
      await settled();
      expect([states(uploads), said.opened]).toEqual([["done"], 1]);
      expect(ops()).toEqual(["begin", "piece", "piece", "abort", "begin", "piece", "piece", "end"]);
      expect(asked.filter((command) => command["op"] === "abort" || command["op"] === "begin" || command["op"] === "end").map((command) => command["upload"] ?? "-")).toEqual(["-", "u1", "-", "u2"]);
      expect(asked.filter((command) => command["op"] === "piece").map((command) => command["at"])).toEqual([0, UPLOAD_PIECE_BYTES, 0, UPLOAD_PIECE_BYTES]);
    });

    it("starts the box once for three files refused together, and sends all three again", async () => {
      const { uploads, ops, said, settled } = refusing((command) => command["op"] === "begin", 3);
      uploads.add([file("a.png", 3), file("b.png", 4), file("c.png", 5)]);
      expect(ops()).toEqual([]);
      await settled();
      expect([states(uploads), [...uploads.names].sort(), said.notThere, said.opened]).toEqual([["done", "done", "done"], ["a.png", "b.png", "c.png"], 3, 1]);
      expect(ops().filter((op) => op === "begin")).toHaveLength(6);
    });

    it("fails a file at once on any other error, starting nothing", async () => {
      const { uploads, ops, said, state, settled } = box();
      state.answer = (command) => { if (command["op"] === "begin") throw new Error("command answered 500"); return undefined; };
      uploads.add([file("a.txt", 3)]);
      await settled();
      expect([states(uploads), ops(), said.notThere, said.opened]).toEqual([["failed"], ["begin"], 0, 0]);
    });

    it("fails a file the box was not there to finish: only a file not yet whole goes up again", async () => {
      const { uploads, ops, said, settled } = refusing((command) => command["op"] === "end");
      uploads.add([file("a.txt", 3)]);
      await settled();
      expect([states(uploads), ops(), said.notThere, said.opened]).toEqual([["failed"], ["begin", "piece", "end"], 0, 0]);
    });
  });

  it("begins nothing for a card taken out while cx's computer starts", async () => {
    const { uploads, ops, state } = box();
    state.awake = false;
    uploads.add([file("a.txt", 3)]);
    uploads.remove(uploads.cards[0]!.id);
    for (let turn = 0; turn < 20; turn++) await tick();
    expect([uploads.cards, ops(), state.awake]).toEqual([[], [], true]);
  });

  it("keeps a file over the limit as a card that says so, sends none of it, and holds Send back", async () => {
    const { uploads, ops, said, settled } = box();
    uploads.add([file("small.txt", 1)]);
    const large = new File([], "huge.bin");
    Object.defineProperty(large, "size", { value: UPLOAD_MAX_BYTES + 1 });
    uploads.add([large]);
    expect(states(uploads)).toEqual(["uploading", "large"]);
    expect(said.told.at(-1)!.map((card) => card.name)).toEqual(["huge.bin"]);
    await settled();
    expect([ops().filter((op) => op === "begin").length, uploads.ready]).toEqual([1, false]);
  });

  it("says the name a file took when its own was taken, and the message names it so", async () => {
    const { uploads, said, settled } = box(["cost-sheet.xlsx"]);
    uploads.add([file("cost-sheet.xlsx", 4)]);
    await settled();
    expect([uploads.names, said.told.at(-1)!.map((card) => [card.name, card.saved])]).toEqual([["cost-sheet.xlsx (2)"], [["cost-sheet.xlsx", "cost-sheet.xlsx (2)"]]]);
  });

  it("turns a file the box refuses as too large into a card that says so", async () => {
    const { uploads, state, said, settled } = box();
    state.answer = (command) => (command["op"] === "begin" ? no("too_large", { limit: 1 }) : undefined);
    uploads.add([file("a.txt", 3)]);
    await settled();
    expect([states(uploads), said.told.at(-1)!.length]).toEqual([["large"], 1]);
  });

  it("sends a piece again from where the box says its copy stands, three times at most, then the card fails and says so", async () => {
    const run = box();
    let refusals = 1;
    run.state.answer = (command) => (command["op"] === "piece" && refusals-- > 0 ? no("out of order", { received: 0 }) : undefined);
    run.uploads.add([file("a.txt", 3)]);
    await run.settled();
    expect([states(run.uploads), run.ops()]).toEqual([["done"], ["begin", "piece", "piece", "end"]]);

    const stuck = box();
    stuck.state.answer = (command) => (command["op"] === "piece" ? no("out of order", { received: 0 }) : undefined);
    stuck.uploads.add([file("a.txt", 3)]);
    await stuck.settled();
    expect([states(stuck.uploads), stuck.ops().filter((op) => op === "piece").length, stuck.said.told.at(-1)!.map((card) => card.state)]).toEqual([["failed"], 4, ["failed"]]);

    const silent = box();
    silent.state.answer = (command) => (command["op"] === "piece" ? no("a piece carries base64") : undefined);
    silent.uploads.add([file("a.txt", 3)]);
    await silent.settled();
    expect(states(silent.uploads)).toEqual(["failed"]);
  });

  it("fails a card on an answer that says no size, a beginning with no upload or an end with no name, and goes again from the start on Try again", async () => {
    for (const answer of [(command: Command) => (command["op"] === "piece" ? ok({ received: 99 }) : undefined), (command: Command) => (command["op"] === "begin" ? ok() : undefined), (command: Command) => (command["op"] === "end" ? ok() : undefined), () => { throw new Error("/command answered 503"); }]) {
      const { uploads, state, settled, ops } = box();
      state.answer = answer;
      uploads.add([file("a.txt", 3)]);
      await settled();
      expect(states(uploads)).toEqual(["failed"]);
      state.answer = undefined;
      const before = ops().length;
      uploads.retry(uploads.cards[0]!.id);
      await settled();
      expect([states(uploads), ops().slice(before)]).toEqual([["done"], ["begin", "piece", "end"]]);
    }
  });

  it("starts cx's computer again on Try again while it sleeps, and takes no Try again on a card that has not failed", async () => {
    const { uploads, state, settled, ops, said } = box();
    state.answer = () => { throw new Error("gone"); };
    uploads.add([file("a.txt", 3)]);
    await settled();
    state.awake = false;
    state.answer = undefined;
    uploads.retry(uploads.cards[0]!.id);
    expect(states(uploads)).toEqual(["uploading"]);
    const before = ops().length;
    uploads.retry(uploads.cards[0]!.id);
    uploads.retry("file-none");
    await settled();
    expect([states(uploads), ops().slice(before), said.woken]).toEqual([["done"], ["begin", "piece", "end"], 1]);
  });

  it("takes a file out with ×: one still going up stops there, and one already written leaves the seller's files again", async () => {
    const { uploads, asked, settled } = box();
    uploads.add([file("done.txt", 3), file("photo.png", 3, "image/png")]);
    await settled();
    uploads.add([file("going.txt", UPLOAD_PIECE_BYTES * 4)]);
    await tick();
    await tick();
    const [done, photo, going] = uploads.cards;
    uploads.remove(going!.id);
    uploads.remove(done!.id);
    uploads.remove("file-none");
    await settled();
    await tick();
    expect(asked.slice(-2)).toEqual([{ type: UPLOAD_VERB, op: "abort", upload: "u3" }, { type: UPLOAD_VERB, op: "remove", name: "done.txt" }]);
    expect(asked.filter((command) => command["op"] === "piece" && command["upload"] === "u3").length).toBeLessThan(4);
    expect(asked.some((command) => command["op"] === "end" && command["upload"] === "u3")).toBe(false);
    expect([uploads.cards.map((card) => card.name), photo!.image]).toEqual([["photo.png"], "data:photo.png"]);
  });

  it("aborts a file taken out before its beginning is answered, and removes one taken out before its end is", async () => {
    const early = box();
    early.uploads.add([file("a.txt", 3)]);
    while (early.asked.length === 0) await Promise.resolve();
    early.uploads.remove(early.uploads.cards[0]!.id);
    await tick();
    await tick();
    await tick();
    expect(early.asked.at(-1)).toEqual({ type: UPLOAD_VERB, op: "abort", upload: "u1" });

    const late = box();
    let out: (() => void) | undefined;
    late.state.answer = (command) => { if (command["op"] === "end") out?.(); return undefined; };
    late.uploads.add([file("b.txt", 3)]);
    out = () => late.uploads.remove(late.uploads.cards[0]!.id);
    for (let i = 0; i < 8; i++) await tick();
    expect(late.asked.at(-1)).toEqual({ type: UPLOAD_VERB, op: "remove", name: "b.txt" });
    expect(late.uploads.cards).toEqual([]);
  });

  it("puts a returned message's files back as cards already up, once each, and clears the cards, files kept, when the message goes", async () => {
    const { uploads, ops, settled } = box();
    uploads.returned([]);
    uploads.returned(["a.txt", "b c.txt"]);
    uploads.returned(["a.txt"]);
    expect([states(uploads), uploads.names, uploads.ready]).toEqual([["done", "done"], ["a.txt", "b c.txt"], true]);
    uploads.add([file("p.png", 3, "image/png")], () => "Pasted 2026-10-20 07.00.00.png");
    await settled();
    expect(uploads.cards.at(-1)!.name).toBe("Pasted 2026-10-20 07.00.00.png");
    uploads.clear();
    uploads.clear();
    uploads.add([]);
    expect([uploads.cards, ops().includes("remove")]).toEqual([[], false]);
  });

  it("writes a piece in base64 as the box reads it, past the size one call can spread", async () => {
    const bytes = new Uint8Array(0x8000 * 2 + 3).map((_, i) => i % 251);
    expect(await base64(new Blob([bytes]))).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("draws an image file's card with its picture once one is made, and a picture that cannot be made, or comes after the card left, changes nothing", async () => {
    const { uploads, pictured, settled } = box();
    uploads.add([file("a.png", 3, "image/png"), file("broken.png", 3, "image/png"), file("blank.png", 3, "image/png"), file("notes.txt", 3), file("gone.png", 3, "image/png")]);
    uploads.remove(uploads.cards[4]!.id);
    expect(uploads.cards.map((card) => card.image)).toEqual([undefined, undefined, undefined, undefined]);
    await settled();
    expect([uploads.cards.map((card) => card.image), pictured]).toEqual([["data:a.png", undefined, undefined, undefined], ["a.png", "broken.png", "blank.png", "gone.png"]]);
  });
});
