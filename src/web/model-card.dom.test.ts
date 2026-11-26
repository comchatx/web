// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { hideTip } from "./forms.js";
import { ModelCard, type CardView } from "./model-card.js";
import { text } from "./strings.js";
import { drawnAsABrowserDraws } from "./testing/drawn.js";

afterEach(() => { hideTip(); document.body.replaceChildren(); vi.restoreAllMocks(); });
const shown = (): string | undefined => { const box = document.querySelector<HTMLElement>(".f-tip"); return box === null || box.hidden ? undefined : box.textContent ?? ""; };
const CURRENT = { provider: "anthropic", id: "opus", name: "Claude Opus 5.5", vendor: "anthropic", vendorName: "Anthropic", served: true, chosen: false } as const;
const PLAIN: CardView = { slots: [], current: CURRENT, default: undefined };
const PICKER: CardView = { ...PLAIN, byRecord: true };

it("takes the plain name's label away at the next move or key once the picker replaced it, with no close of its own, and the event goes on", () => {
  drawnAsABrowserDraws();
  const card = new ModelCard({ say: (key, values) => text("en", key, values), choose: () => {}, others: () => {} });
  document.body.append(card.element);
  const further = vi.fn();
  document.addEventListener("keydown", further);
  for (const next of [() => window.dispatchEvent(new PointerEvent("pointermove")), () => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }))]) {
    card.update(PLAIN, "en");
    const plain = card.element.querySelector<HTMLElement>(".model-label")!;
    plain.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    expect(shown()).toBe("Model");
    card.update(PICKER, "en");
    expect([plain.isConnected, card.element.querySelector(".mp-trigger") !== null, shown()], "the picker in, the label still up until the seller's next move").toEqual([false, true, "Model"]);
    next();
    expect(shown()).toBeUndefined();
  }
  expect(further, "the key went on to the page").toHaveBeenCalledOnce();
  document.removeEventListener("keydown", further);
});
