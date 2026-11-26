import { vi } from "vitest";

/**
 * happy-dom draws no box and gives every element one. From this call an element has a box where a browser would draw it: in the document,
 * neither it nor an ancestor `[hidden]` or styled `display: none`. The set reads a target no longer drawn by that box.
 */
export function drawnAsABrowserDraws(): void {
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
    return (this.isConnected && this.closest("[hidden]") === null && this.checkVisibility() ? [new DOMRect(0, 0, 10, 10)] : []) as unknown as DOMRectList;
  });
}
