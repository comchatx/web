/**
 * A name in the seller's files is a rule, not a list: valid UTF-8 without control characters or DEL. The one reserved name
 * (build ruling 6): any `.scratch` segment is the envelope's staging. Nothing is reserved at the top level — the box's private
 * area is not under the tree (`sandbox/sync/layout.ts`).
 */
export const RESERVED_SEGMENT = ".scratch";

const CONTROL_OR_DEL = /[\x00-\x1f\x7f]/u;

export const isDomainName = (name: string): boolean => name !== "" && !CONTROL_OR_DEL.test(name);
