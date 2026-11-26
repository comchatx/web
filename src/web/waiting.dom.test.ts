// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { h } from "./dom.js";
import { ringed, Waits } from "./waiting.js";

/** A promise the test answers or fails. */
function held() {
  let answer!: () => void, fail!: (error: Error) => void;
  const promise = new Promise<void>((resolve, reject) => { answer = resolve; fail = reject; });
  return { promise, answer, fail };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
/** What a control draws: busy, marked as taking no press, its name, a ring in it or beside it, and the words it shows. */
const looks = (control: HTMLElement) => ({
  busy: control.getAttribute("aria-busy"), disabled: control.getAttribute("aria-disabled"), name: control.getAttribute("aria-label"),
  ring: control.querySelector(".pl-spin") !== null || control.nextElementSibling?.classList.contains("pl-spin") === true,
  words: control.querySelector(".pl-hold-word")?.textContent ?? control.textContent,
});
const AT_REST = { busy: null, disabled: null, name: null, ring: false, words: "Save" };
const WAITING = { busy: "true", disabled: "true", name: "Save", ring: true, words: "Save" };

/** A page that owns one operation, `save`, and draws its control from what is out. */
function page(act: () => Promise<unknown>, tag: "button" | "select" = "button") {
  const box = h("div", {});
  document.body.replaceChildren(box);
  const draw = (): void => {
    const control = tag === "button" ? h("button", { type: "button", class: "primary", onclick: waits.press("save", act) }, "Save")
      : h("select", { "aria-label": "Reuse", onchange: () => { void waits.run("save", act, control); } }, h("option", { value: "1" }, "1 day"));
    box.replaceChildren(control);
    waits.ring("save", control);
  };
  const waits = new Waits(() => box);
  draw();
  return { box, waits, draw, control: (): HTMLElement => box.firstElementChild as HTMLElement };
}

it("turns the pressed button until its answer, its words kept unseen as its name, and draws the one drawn then at rest", async () => {
  const answer = held();
  const at = page(vi.fn(() => answer.promise));
  const button = at.control();
  button.focus();
  expect(looks(button)).toEqual(AT_REST);
  button.click();
  expect([looks(button), button.className, button.querySelector(".pl-hold-word")?.getAttribute("aria-hidden")]).toEqual([WAITING, "primary pl-busy pl-hold", "true"]);
  // The press is not disabled: the keyboard stays on it.
  expect([button.hasAttribute("disabled"), document.activeElement === button]).toEqual([false, true]);
  answer.answer();
  await settle();
  expect([at.control() === button, at.waits.has("save"), looks(button), button.className, button.childNodes.length, button.hasAttribute("data-wait")]).toEqual([true, false, AT_REST, "primary", 1, false]);
});

it("takes a second press while it waits as none, on the control pressed or one drawn anew, and one after the answer as a new press", async () => {
  const answers = [held(), held()];
  let n = 0;
  const act = vi.fn(() => answers[n++]!.promise);
  const at = page(act);
  at.control().click();
  at.control().click();
  at.draw();
  expect(looks(at.control())).toEqual(WAITING);
  at.control().click();
  expect(act).toHaveBeenCalledTimes(1);
  answers[0]!.answer();
  await settle();
  at.control().click();
  expect([act.mock.calls.length, looks(at.control())]).toEqual([2, WAITING]);
  answers[1]!.answer();
  await settle();
  expect(looks(at.control())).toEqual(AT_REST);
});

it("lets the key go and draws the control at rest when the press fails, and leaves the failure to the page", async () => {
  const answer = held();
  const button = h("button", { type: "button", "aria-label": "Save the key" }, "Save");
  document.body.replaceChildren(button);
  const waits = new Waits(() => document.body);
  const out = waits.run("save", () => answer.promise, button);
  // A name the control had of its own stays.
  expect(looks(button)).toEqual({ ...WAITING, name: "Save the key" });
  answer.fail(new Error("refused"));
  await expect(out).rejects.toThrow("refused");
  expect([waits.has("save"), looks(button)]).toEqual([false, { ...AT_REST, name: "Save the key" }]);
});

it("turns a field's ring beside it, since a field holds none, and the page drawn anew holds none", async () => {
  const answer = held();
  const at = page(() => answer.promise, "select");
  at.control().dispatchEvent(new Event("change"));
  expect([at.control().getAttribute("aria-busy"), at.control().nextElementSibling?.className, at.box.children.length]).toEqual(["true", "pl-spin pl-beside", 2]);
  answer.answer();
  await settle();
  expect([at.control().getAttribute("aria-busy"), at.box.children.length]).toEqual([null, 1]);
});

it("draws a control waiting from its page's own state, and leaves alone one already drawn so", () => {
  const button = h("button", { type: "button" }, "More");
  ringed(button, true);
  ringed(button, true);
  expect([button.querySelectorAll(".pl-spin").length, button.querySelectorAll(".pl-hold-word").length]).toEqual([1, 1]);
  ringed(button, false);
  ringed(button, false);
  expect([button.textContent, button.getAttribute("aria-busy"), button.className]).toEqual(["More", null, ""]);
});

it("runs a press no event carries, and draws no ring for it", async () => {
  const act = vi.fn(async () => undefined);
  new Waits(() => undefined).press("save", act)();
  await settle();
  expect(act).toHaveBeenCalledTimes(1);
});

it("draws another operation's control as it is, and holds only the keys that are out", async () => {
  const answer = held();
  const at = page(() => answer.promise);
  at.control().click();
  expect([looks(at.waits.ring("other", h("button", {}, "Save"))), at.waits.has("other")]).toEqual([AT_REST, false]);
  answer.answer();
  await settle();
  expect([at.waits.has("save"), at.waits.detail("save")]).toEqual([false, undefined]);
});

it("draws only what is drawn now at rest when a key goes: a control drawn anew, the others held with it, and nothing of another key", async () => {
  const answer = held();
  const box = h("div", {});
  document.body.replaceChildren(box);
  const waits = new Waits(() => box);
  const run = waits.run("dialog d", () => answer.promise, undefined, "yes");
  const draw = (): readonly HTMLElement[] => {
    const parts = [waits.ring("dialog d", h("button", {}, "Save")), waits.hold("dialog d", h("button", {}, "No")), waits.hold("dialog d", h("input", {}))];
    box.replaceChildren(...parts, waits.ring("other", h("button", {}, "Other")));
    return parts;
  };
  const first = draw();
  const [yes, no, field] = draw();
  expect([looks(yes!).busy, no!.getAttribute("aria-disabled"), (field as HTMLInputElement).readOnly]).toEqual(["true", "true", true]);
  answer.answer();
  await run;
  expect([looks(yes!), no!.getAttribute("aria-disabled"), (field as HTMLInputElement).readOnly, box.querySelectorAll("[data-wait]").length]).toEqual([AT_REST, null, false, 0]);
  // The first drawing, no longer on the page, is not touched.
  expect(first[0]!.getAttribute("aria-busy")).toBe("true");
});

it("leaves another operation's controls waiting when one settles", async () => {
  const [one, two] = [held(), held()];
  const box = h("div", {});
  document.body.replaceChildren(box);
  const waits = new Waits(() => box);
  const first = h("button", {}, "Save");
  const second = h("button", {}, "Save");
  box.replaceChildren(first, second);
  const runs = [waits.run("one", () => one.promise, first), waits.run("two", () => two.promise, second)];
  one.answer();
  await runs[0];
  expect([looks(first), looks(second)]).toEqual([AT_REST, WAITING]);
  two.answer();
  await runs[1];
  expect(looks(second)).toEqual(AT_REST);
});

it("keeps an operation out while its act says its answer is held, until the owner lets it go", async () => {
  const box = h("div", {});
  document.body.replaceChildren(box);
  const waits = new Waits(() => box);
  await waits.run("dialog d", async () => "held", undefined, "yes");
  const yes = waits.ring("dialog d", h("button", {}, "Save"));
  box.replaceChildren(yes);
  expect([waits.has("dialog d"), waits.detail("dialog d"), looks(yes).busy]).toEqual([true, "yes", "true"]);
  waits.release("dialog d");
  expect([waits.has("dialog d"), looks(yes)]).toEqual([false, AT_REST]);
  // A key let go while its answer is out is not let go again when the answer comes, whatever is out under it by then.
  const answer = held();
  const out = waits.run("save", () => answer.promise);
  waits.release("save");
  const again = waits.run("save", async () => "held");
  answer.answer();
  await out;
  await again;
  expect(waits.has("save")).toBe(true);
});

it("stops every ring where motion is reduced, the one beside a field included", () => {
  const css = readFileSync(join(import.meta.dirname, "site", "app.css"), "utf8");
  const stops = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{ ([^{]*) \{ animation: none; \} \}/g)].flatMap((one) => one[1]!.split(",").map((selector) => selector.trim()));
  expect(stops).toEqual(expect.arrayContaining(["button.pl-hold .pl-spin", ".pl-spin.pl-beside"]));
});

it("draws a shape a place passes as one busy region: its words a screen reader's alone, its bars drawn and hidden from it", async () => {
  const { bar, block, skeleton } = await import("./waiting.js");
  const shape = skeleton("Loading", h("div", { class: "pl-card" }, block(h("span", { class: "tile" }, "K")), bar(6), bar("word", "small")));
  document.body.replaceChildren(shape);
  expect([shape.getAttribute("aria-busy"), shape.querySelector("[role='status']")?.textContent, shape.querySelector("[role='status']")?.className, shape.querySelector(".sk-shape")?.getAttribute("aria-hidden")]).toEqual(["true", "Loading", "unseen", "true"]);
  // The bars are the content's lines, each the height of its text and a share of its line; a block keeps the frame it was given and holds nothing.
  expect([...shape.querySelectorAll(".sk-bar")].map((one) => one.className)).toEqual(["sk-bar sk-body sk-w6", "sk-bar sk-small sk-word"]);
  expect([shape.querySelector(".tile")?.className, shape.querySelector(".tile")?.textContent]).toEqual(["tile sk-block", ""]);
  // A place whose own line says what it waits on draws the shape with no words of its own.
  expect(skeleton(undefined, bar(3)).querySelector("[role='status']")).toBeNull();
});

it("breathes the shapes with the working dot, in step across the page, and stands them lit where motion is reduced", async () => {
  const { bar, block, BREATH_MS } = await import("./waiting.js");
  const css = readFileSync(join(import.meta.dirname, "site", "app.css"), "utf8");
  const rule = (selector: string): string => css.match(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{[^}]*\\}`, "m"))?.[0] ?? "";
  // The dot's own keyframes and period, and no other motion.
  expect(rule(".step-line .dot")).toContain("animation: step-breathe 1.6s linear infinite;");
  expect(rule(".sk-bar, .sk-block")).toBe(".sk-bar, .sk-block { animation: step-breathe 1.6s linear infinite; }");
  expect(BREATH_MS).toBe(1_600);
  expect(css).not.toMatch(/@keyframes sk-/);
  // Under reduced motion the shapes stand at the dot's resting depth, lit, as the dot does.
  expect(css).toContain("@media (prefers-reduced-motion: reduce) { .sk-bar, .sk-block { animation: none; } }");
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.step-line \.dot \{ animation: none; \}/);
  // Shapes drawn at different moments are set to the point of the breath the clock is at, so they rise and fall together.
  const clock = vi.spyOn(performance, "now").mockReturnValue(4_000);
  const first = bar(4);
  clock.mockReturnValue(4_900);
  const later = block(h("span", { class: "tile" }));
  clock.mockRestore();
  expect([first.style.animationDelay, later.style.animationDelay]).toEqual(["-800ms", "-100ms"]);
  // A bar inside a filled box rides with the box and is not drawn over it.
  expect(rule(".sk-block .sk-bar")).toContain("visibility: hidden; animation: none;");
  expect(rule(".sk, .sk-shape")).toContain("display: contents;");
});

it("sets every drawn shape of the conversation's own shape at the clock's point of the breath, its messages' bubbles with its answers' lines", async () => {
  const { streamShape } = await import("./stream-view.js");
  const clock = vi.spyOn(performance, "now").mockReturnValue(800);
  const shape = streamShape("Loading");
  clock.mockRestore();
  document.body.replaceChildren(shape);
  // What breathes: the bubbles, and the answers' bars outside them; a bar inside a bubble only sizes it.
  const drawn = [...shape.querySelectorAll<HTMLElement>(".sk-block, .sk-bar")].filter((one) => one.parentElement?.closest(".sk-block") === null);
  expect([shape.querySelectorAll(".item.user.sk-block").length, drawn.length, [...new Set(drawn.map((one) => one.style.animationDelay))]]).toEqual([2, 7, ["-800ms"]]);
});

it("holds a shape unseen in its room until its read has been out half a second, so a read that answers sooner draws no shape", async () => {
  vi.useFakeTimers();
  try {
    const { bar, skeleton, SHAPE_AFTER_MS } = await import("./waiting.js");
    const css = readFileSync(join(import.meta.dirname, "site", "app.css"), "utf8");
    expect([SHAPE_AFTER_MS, css.includes(".sk-wait > .sk-shape { visibility: hidden; }")]).toEqual([500, true]);
    const room = h("div", {});
    const shape = skeleton("Loading", bar(6));
    room.replaceChildren(shape);
    vi.advanceTimersByTime(SHAPE_AFTER_MS - 1);
    expect(shape.classList.contains("sk-wait")).toBe(true);
    // The read answers inside the half second: its content takes the room and no shape was ever seen.
    room.replaceChildren(h("p", {}, "Keepa"));
    vi.advanceTimersByTime(1);
    expect([room.querySelector(".sk"), shape.isConnected]).toEqual([null, false]);
    // A read still out at half a second shows its shape, the words for a screen reader standing from the first.
    const slow = skeleton("Loading", bar(6));
    expect(slow.querySelector("[role='status']")?.textContent).toBe("Loading");
    vi.advanceTimersByTime(SHAPE_AFTER_MS);
    expect(slow.classList.contains("sk-wait")).toBe(false);
  } finally { vi.useRealTimers(); }
});

it("keeps a length that has stood a second however often it is drawn again in that second", async () => {
  vi.useFakeTimers();
  localStorage.clear();
  try {
    const { keepRows, rowsFor } = await import("./waiting.js");
    for (const at of [0, 400, 800, 1200, 1600]) { vi.setSystemTime(at); keepRows("history", 4); if (at < 1600) vi.advanceTimersByTime(400); }
    // Drawn at 0, 400, 800, 1200 and 1600 ms, four rows all along: kept at one second.
    expect([localStorage.getItem("cmx-rows-history"), rowsFor("history")]).toEqual(["4", 4]);
    // A length that changes starts the moment again.
    keepRows("history", 6);
    vi.advanceTimersByTime(999);
    keepRows("history", 5);
    vi.advanceTimersByTime(999);
    expect(rowsFor("history")).toBe(4);
    vi.advanceTimersByTime(1);
    expect(rowsFor("history")).toBe(5);
  } finally { vi.useRealTimers(); localStorage.clear(); }
});

it("draws as many rows as this browser drew there last, three on a first visit, at most eight, and keeps only the number once it has stood", async () => {
  vi.useFakeTimers();
  localStorage.clear();
  try {
    const { FIRST_ROWS, MOST_ROWS, ROWS_STAND_MS, keepRows, rowsFor } = await import("./waiting.js");
    expect([FIRST_ROWS, MOST_ROWS, rowsFor("yours"), rowsFor("history")]).toEqual([3, 8, 3, 3]);
    keepRows("history", 2);
    vi.advanceTimersByTime(ROWS_STAND_MS - 1);
    // A length that has not stood is not kept, and a new one starts the moment again.
    keepRows("history", 5);
    vi.advanceTimersByTime(ROWS_STAND_MS - 1);
    expect(localStorage.getItem("cmx-rows-history")).toBeNull();
    vi.advanceTimersByTime(1);
    keepRows("yours", 30);
    keepRows("payments", 0);
    vi.advanceTimersByTime(ROWS_STAND_MS);
    expect([rowsFor("history"), rowsFor("yours"), rowsFor("payments")]).toEqual([5, 8, 0]);
    // One key per list, each holding a number and nothing a row said.
    expect(Object.fromEntries(Object.entries(localStorage))).toEqual({ "cmx-rows-history": "5", "cmx-rows-yours": "8", "cmx-rows-payments": "0" });
    localStorage.setItem("cmx-rows-invited", "Keepa");
    expect(rowsFor("invited")).toBe(3);
  } finally { vi.useRealTimers(); localStorage.clear(); }
});
