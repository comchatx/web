/**
 * How full cx's context is, as pi says it in its answer to `get_session_stats` (pi 1.6.1, `contextUsage`): the figure pi itself compacts
 * by. `null` is pi's own word right after a compaction, until its next answer has a figure: the context is summarised. An answer with no
 * figure — no model, no window, a refusal, a box older than the read — is `undefined`, and the card draws no figure for it.
 */
export type ContextFill = number | null | undefined;

export function contextFill(answer: unknown): ContextFill {
  if (typeof answer !== "object" || answer === null) return undefined;
  const reply = answer as { readonly success?: unknown; readonly data?: unknown };
  if (reply.success !== true || typeof reply.data !== "object" || reply.data === null) return undefined;
  const usage = (reply.data as { readonly contextUsage?: unknown }).contextUsage;
  if (typeof usage !== "object" || usage === null) return undefined;
  const percent = (usage as { readonly percent?: unknown }).percent;
  if (percent === null) return null;
  if (typeof percent !== "number" || !Number.isFinite(percent)) return undefined;
  return Math.min(100, Math.max(0, Math.round(percent)));
}
