// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { EMPTY, reduce, sent, stamped, waitsForBox, type StreamEvent, type StreamState } from "./stream-model.js";
import { StreamView, type StreamViewPorts } from "./stream-view.js";
import { text } from "./strings.js";

// What stands under a message the person sent, by the key of the echo pi's record of it took the place of: the chat's word on an install
// the message waited for that failed (as ruled). The view draws what the port gives and draws it again when the port's stamp changes,
// and nothing under a message still waiting.
const E = "e".repeat(32);
const said = (seq: number, words: string, at: number): StreamEvent => ({ event: "entry", id: `${E}:${seq}`, data: { epoch: E, seq, body: { form: "message", role: "user", content: words, timestamp: at } } });

it("draws under pi's record of a message what stands under its echo, kept or held by the box, and draws it again only when that changes", async () => {
  let under: Readonly<Record<string, string>> = { "sent-0": "Keyword planner was not installed.", "sent-1": "Product PDF was not installed." };
  let drawn = 0;
  const beneath: StreamViewPorts["beneath"] = {
    stamp: (key) => under[key] ?? "",
    draw: (key) => { drawn++; return under[key] === undefined ? [] : [Object.assign(document.createElement("div"), { className: "pl-failed pl-failed-chat", textContent: under[key] })]; },
  };
  const page = new StreamView({ say: (key, values) => text("en", key, values), now: () => 0, day: () => "Today", beneath });
  document.body.replaceChildren(page.element);
  // What stands after each message, as a block of its own: nothing of it is inside what the person wrote.
  const lines = (): readonly (string | undefined)[] => [...page.element.querySelectorAll(".item.user")].map((one) => {
    expect(one.querySelector(".pl-failed-chat")).toBeNull();
    const next = one.nextElementSibling;
    return next?.matches(".item-under") === true ? next.querySelector(".pl-failed-chat")?.textContent ?? "" : undefined;
  });
  // One message the platform kept for a computer that was off, one the computer held until its clicks ended, and one from another tab.
  let now: StreamState = reduce(EMPTY, { event: "life", data: { kind: "life", epoch: E } });
  now = waitsForBox(sent(now, "Check the listing", 100), "sent-0");
  now = stamped(sent(now, "Write the bullets", 150), "sent-1", 150);
  page.update(now);
  // Still waiting: nothing is drawn under either.
  expect(lines()).toEqual([undefined, undefined]);
  now = [said(1, "Check the listing", 140), said(2, "Write the bullets", 160), said(3, "From the other tab", 170)].reduce(reduce, now);
  page.update(now);
  expect(lines()).toEqual(["Keyword planner was not installed.", "Product PDF was not installed.", undefined]);
  // Drawn again with nothing changed under it, a message keeps its drawing.
  const before = drawn;
  page.update(now);
  expect(drawn).toBe(before);
  // The install landed: its line goes.
  under = { "sent-1": "Product PDF was not installed." };
  page.update(now);
  expect(lines()).toEqual([undefined, "Product PDF was not installed.", undefined]);
});
