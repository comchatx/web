import type { Balance, Opened } from "./backend.js";
import type { StringKey } from "./strings.js";

/**
 * What the page knows of the person's computer. `awake` is the box heard on the page's connection; `waking` is an open the person asked
 * for, in flight or done and not yet heard; `asleep` is a connection that found the box gone, or an open that did not bring it up; `unknown`
 * is a page that has not yet heard either way.
 */
export type Box = "unknown" | "asleep" | "waking" | "awake";

/** cx's five states, as `cx.js` draws them. */
export type CxState = "sleeping" | "waking" | "ready" | "analysing" | "writing";

/**
 * Whether the composer takes a message: not while the person's computer is still being set up, nor while their balance is below the
 * floor an open needs. The conversation ends on the person's turn only while it does.
 */
export const takesMessages = (box: "provisioned" | "pending", balance: Balance | undefined): boolean => box !== "pending" && balance?.can_open !== false;

/** What an open came to when it did not open the box, in the platform's own terms: a refusal with its reason, or a step that failed. */
export type Blocked = Exclude<Opened, { readonly kind: "open" } | { readonly kind: "opening" }>;

/**
 * The status line's colour is what it says: brick (`held`) for what the person may have to act on, and quiet for a line that says nothing.
 */
export function lineTone(said: StringKey | undefined): "status" | "status held" {
  return said === undefined ? "status" : "status held";
}
