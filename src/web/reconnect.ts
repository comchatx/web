/** What the page does once a stream has ended: connect again at once, after a wait, not until the person asks, or not at all — the box is asleep. */
export type Next = { readonly kind: "now" } | { readonly kind: "later"; readonly ms: number } | { readonly kind: "asleep" } | { readonly kind: "hold" };

const WAITS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;
/** The status routing answers for a box with no binding, which the relay's `end` carries. */
const BOX_NOT_RUNNING = 409;

const wait = (failures: number): number => WAITS[Math.min(Math.max(0, failures), WAITS.length - 1)]!;

/**
 * `reason` is the platform's `end` frame, or undefined for a connection that broke without one; `status` is routing's answer the frame
 * carries; `failures` counts the connections in a row that ended before the box was heard. A stream that reached its age is the platform
 * asking for the session to be verified again, and is answered at once. A `life_conflict` is a disagreement the next connection meets
 * again at the same place, so it waits for the person. A box routing says is not running (`box_unavailable` with its 409) is asleep, and
 * only the person's next message, or cx, opens it: the page does not. A `box_ended` — the box's stream stopped — and a `box_unavailable`
 * routing could not answer for say nothing of sleep, so they are asked again as a broken connection is, and the next connection's
 * routing answer decides. Anything else waits longer each time it repeats. The box's own word that it sleeps is the caller's to read.
 */
export function afterEnd(reason: string | undefined, failures: number, status?: number): Next {
  if (reason === "life_conflict") return { kind: "hold" };
  if (reason === "max_age") return { kind: "now" };
  if (reason === "box_unavailable" && status === BOX_NOT_RUNNING) return { kind: "asleep" };
  return { kind: "later", ms: wait(failures) };
}
