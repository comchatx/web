// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardOff, offOf, type Off } from "./board-off.js";
import { h } from "./dom.js";
import { text, type StringKey } from "./strings.js";

afterEach(() => { document.body.replaceChildren(); });

const made = (language: "en" | "zh" = "en") => {
  const wake = vi.fn();
  const place = new BoardOff({ say: (key: StringKey) => text(language, key), wake, help: "mailto:help@example.com", floor: () => [text(language, "box.closedPay").split("{")[0]!, h("a", { href: "#/settings/billing" }, "Top up"), " to continue."] });
  document.body.append(place.element);
  return { place, wake };
};

/** What the place shows and says: the status a screen reader hears, the one line, whether a reader hears it, the press, the help, the shape. */
const reading = (place: BoardOff) => {
  const shown = (selector: string): HTMLElement | undefined => { const one = place.element.querySelector<HTMLElement>(selector)!; return one.hidden || one.closest("[hidden]") !== null ? undefined : one; };
  return {
    said: place.element.querySelector("[role=status]")!.textContent,
    line: shown(".off-line")?.textContent,
    lineHeard: shown(".off-line")?.getAttribute("aria-hidden") !== "true",
    press: shown("button")?.textContent,
    help: shown("a[href^=mailto]")?.textContent,
    shape: shown(".off-shape") !== undefined,
  };
};

describe("the board's place while cx's computer is off", () => {
  it("says each state in the words signed for it, with the press only where the computer can be started", () => {
    const { place } = made();
    const states: Readonly<Record<Off, ReturnType<typeof reading>>> = {
      off: { said: "cx's computer is off", line: "Switch on to see the board", lineHeard: true, press: "Switch on", help: undefined, shape: false },
      starting: { said: "cx's computer is switching on", line: undefined, lineHeard: true, press: undefined, help: undefined, shape: true },
      failed: { said: "cx's computer didn't switch on", line: "Didn't switch on", lineHeard: false, press: "Try again", help: "Get help", shape: false },
      refused: { said: "cx's computer can't switch on right now", line: "Can't switch on right now", lineHeard: false, press: "Try again", help: "Get help", shape: false },
      balance: { said: "cx's computer is off", line: "Balance too low. Top up to continue.", lineHeard: true, press: undefined, help: undefined, shape: false },
      unreachable: { said: "Reconnecting", line: "Reconnecting", lineHeard: false, press: undefined, help: undefined, shape: false },
    };
    for (const [off, expected] of Object.entries(states) as [Off, ReturnType<typeof reading>][]) {
      place.draw(off);
      expect(reading(place), off).toEqual(expected);
      expect(place.element.hidden, off).toBe(false);
    }
    // The floor's way on is the message box's own link, inside the one line.
    place.draw("balance");
    expect(place.element.querySelector(".off-line a")!.getAttribute("href")).toBe("#/settings/billing");
    place.draw(undefined);
    expect([place.element.hidden, place.off]).toEqual([true, undefined]);
  });

  it("speaks the line from the sheet in Chinese, 开机 under it", () => {
    const { place } = made("zh");
    place.draw("off");
    expect(reading(place)).toMatchObject({ said: "cx 的电脑已关机", line: "开机后显示看板", press: "开机" });
  });

  it("starts the computer only on the seller's press, and takes the keyboard on the place itself, never on the press", () => {
    const { place, wake } = made();
    place.draw("off");
    place.focus();
    expect(document.activeElement).toBe(place.element);
    expect(wake).not.toHaveBeenCalled();
    place.element.querySelector<HTMLButtonElement>("button")!.click();
    expect(wake).toHaveBeenCalledTimes(1);
    place.draw("failed");
    place.element.querySelector<HTMLButtonElement>("button")!.click();
    expect(wake).toHaveBeenCalledTimes(2);
  });

  it("reads the corner's kind: on, at work and not read yet draw the board; out of reach while on keeps it", () => {
    expect((["off", "starting", "failed", "refused", "balance", "unreachableAsleep", "on", "working", "unknown", "unreachable", undefined] as const).map(offOf))
      .toEqual(["off", "starting", "failed", "refused", "balance", "unreachable", undefined, undefined, undefined, undefined, undefined]);
  });
  it("lays the glass over the board's shape or over the last board, the line and the press on their own ground, and none where there is no glass", () => {
    const { place } = made();
    const look = () => ({ glass: place.element.classList.contains("glass"), wash: !place.element.querySelector<HTMLElement>(".off-glass")!.hidden, shape: !place.element.querySelector<HTMLElement>(".off-shape")!.hidden, cards: place.element.querySelectorAll(".off-sk-card").length });
    place.draw("off", "shape");
    expect([look(), reading(place).line]).toEqual([{ glass: true, wash: true, shape: true, cards: 12 }, "Switch on to see the board"]);
    place.draw("off", "last");
    expect([look(), place.element.classList.contains("over-last")]).toEqual([{ glass: true, wash: true, shape: false, cards: 12 }, true]);
    place.draw("starting", "shape");
    expect([look(), reading(place).press]).toEqual([{ glass: true, wash: true, shape: true, cards: 12 }, undefined]);
    place.draw("failed", "last");
    expect([look().shape, reading(place).press, reading(place).help]).toEqual([false, "Try again", "Get help"]);
    place.draw("off");
    expect([look(), place.element.classList.contains("over-last")]).toEqual([{ glass: false, wash: false, shape: false, cards: 12 }, false]);
  });
  it("says the computer is on once it is, rather than keeping the last state it said, and says nothing where it said nothing before", () => {
    const { place } = made("zh");
    place.draw(undefined);
    const said = (): string | null => place.element.querySelector("[role=status]")!.textContent;
    expect(said()).toBe("");
    place.draw("starting");
    expect(said()).toBe("cx 的电脑正在开机");
    place.draw(undefined);
    expect([said(), place.element.hidden]).toEqual(["cx 的电脑已开机", true]);
  });

  it("hands the keyboard to the place as the press leaves at the computer's start", () => {
    const { place } = made();
    place.draw("off");
    const go = place.element.querySelector<HTMLButtonElement>("button")!;
    go.focus();
    place.draw("starting");
    expect(document.activeElement).toBe(place.element);
  });

  it("draws 获取帮助 as the outlined button beside 重试, a link to the seller's mail", () => {
    const { place } = made();
    place.draw("failed");
    const help = place.element.querySelector<HTMLAnchorElement>("a[href^=mailto]")!;
    expect([help.className, help.textContent, place.element.querySelector(".off-acts")!.children[0]!.textContent]).toEqual(["button", "Get help", "Try again"]);
    // The outlined button of the page's rows: an edge, no fill, the small size, no underline.
    const rule = /^a\.button \{([^}]*)\}/m.exec(readFileSync(join(process.cwd(), "src/web/site/app.css"), "utf8"))![1]!;
    for (const part of ["border: 1px solid var(--edge)", "font-size: var(--size-small)", "text-decoration: none"]) expect(rule).toContain(part);
  });
});
