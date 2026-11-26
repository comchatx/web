import { readUiRequest, type Dialog } from "./dialog.js";
import { PROVIDERS } from "./model-makers.js";

/**
 * The providers whose sign-in the platform runs: a subscription is a way to pay only where it is one of these. They are every sign-in pi
 * offers at the pin but those `NOT_RUN` names (`sign-in.test.ts` holds the two lists to pi's registry).
 */
export const SIGN_INS = Object.freeze(["anthropic", "github-copilot", "kimi-coding", "meta", "openai", "openrouter", "radius", "xai"] as const);
/** pi's sign-ins the platform does not run, and why. */
export const NOT_RUN: Readonly<Record<string, string>> = Object.freeze({
  "openai-codex": "pi's legacy entry for the ChatGPT plan, whose sign-in is OpenAI's own",
});
export type SignIn = (typeof SIGN_INS)[number];
export const runsSignIn = (provider: string): provider is SignIn => (SIGN_INS as readonly string[]).includes(provider);
/**
 * The sign-ins whose flow makes an API key on the person's account, which nothing renews: OpenRouter's. The key is held as one the person
 * pastes is, so such a sign-in is a way to save a key rather than a way of its own.
 */
export const MAKES_KEY: readonly SignIn[] = Object.freeze(["openrouter"]);
export const makesKey = (provider: string): boolean => (MAKES_KEY as readonly string[]).includes(provider);

/**
 * What is wrong with the domain typed for GitHub Copilot's sign-in, or nothing: none, for github.com, or a GitHub Enterprise Cloud
 * domain, read as pi reads it. Any other host would be where pi's flow sends the GitHub token it gets, and where the proxy sends calls.
 */
export function badDomain(typed: string): "not_a_domain" | "not_ghe" | undefined {
  const trimmed = typed.trim();
  if (trimmed === "") return undefined;
  let host: string;
  try { host = (trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`)).hostname; } catch { return "not_a_domain"; }
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.ghe\.com$/.test(host) ? undefined : "not_ghe";
}
/** Whether an address pasted back is at the page a sign-in stops on, compared by origin and path as pi compares it. */
export function stopsAt(pasted: string, stop: string): boolean {
  try {
    const url = new URL(pasted.trim());
    const expected = new URL(stop);
    return url.origin === expected.origin && url.pathname === expected.pathname;
  } catch { return false; }
}
/** A provider whose subscription is a way to pay: the platform runs its sign-in and pi marks that sign-in a subscription. */
export const subscribes = (provider: string): boolean => runsSignIn(provider) && PROVIDERS[provider]?.signIn?.subscription === true;

/**
 * How a provider's sign-in ended: `words` are pi's own for a sign-in its flow refused, and `minutes` how long one that timed out stood.
 * `unavailable` is a sign-in that could not reach its vendor, or could not run here; `bad_paste` an address pasted back that pi would not take.
 */
export type SignInEnd =
  | { readonly state: "signed_in" }
  | { readonly state: "failed"; readonly reason: "refused"; readonly words?: string }
  | { readonly state: "failed"; readonly reason: "timed_out"; readonly minutes: number }
  | { readonly state: "failed"; readonly reason: "cancelled" | "unavailable" | "bad_paste" };

/**
 * What a sign-in sends the page. A step is a dialog frame as a box sends one — `select` and `input` wait for an answer carrying the id —
 * and forms only a sign-in has: an input that is `masked`, or that takes a `paste` (the code, the address, or a GitHub Enterprise
 * domain, which may be left blank); a `link` to open, with the address the browser stops on (`stop`) where that address comes back; and a
 * `code` to type at a `url`. A link and a code say in `minutes` how long the sign-in stands. The last frame says how it ended.
 */
export type SignInFrame = { readonly kind: "ui_request"; readonly id: string; readonly body: Readonly<Record<string, unknown>> } | ({ readonly kind: "sign_in" } & SignInEnd);

export type Paste = "address" | "code" | "domain";
/** A step of a sign-in as the page draws it: a question to answer, a link to open, or a code to type at the provider's page. */
export type SignInStep =
  | { readonly kind: "ask"; readonly dialog: Extract<Dialog, { method: "select" | "input" }>; readonly masked: boolean; readonly paste?: Paste; readonly minutes?: number }
  | { readonly kind: "link"; readonly id: string; readonly url: string; readonly minutes: number; readonly paste?: Exclude<Paste, "domain">; readonly stop?: string }
  | { readonly kind: "code"; readonly id: string; readonly code: string; readonly url: string; readonly minutes: number };

export const stepId = (step: SignInStep): string => (step.kind === "ask" ? step.dialog.id : step.id);

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): number | undefined => (typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined);
/** A link a person is sent to is the provider's own page over https, whoever wrote the frame. */
const https = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  try { return new URL(value).protocol === "https:" ? value : undefined; } catch { return undefined; }
};

/** The address a sign-in's browser stops on, which nothing answers: an http address with no query. */
const address = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  try { const url = new URL(value); return (url.protocol === "http:" || url.protocol === "https:") && url.search === "" && url.hash === "" ? value : undefined; } catch { return undefined; }
};

/**
 * A sign-in's frame read as a step or its end, or nothing. Only this reads a link, a code or a masked field: `readUiRequest`, which
 * reads what a box's packages ask, knows none of the three, so no package draws a sign-in's forms in the conversation.
 */
export function readSignInFrame(frame: unknown): { readonly step: SignInStep } | { readonly end: SignInEnd } | undefined {
  if (!record(frame)) return undefined;
  if (frame["kind"] === "sign_in") {
    if (frame["state"] === "signed_in") return { end: { state: "signed_in" } };
    const reason = frame["reason"];
    if (frame["state"] !== "failed") return undefined;
    if (reason === "refused") return { end: { state: "failed", reason, ...(typeof frame["words"] === "string" && frame["words"] !== "" ? { words: frame["words"] } : {}) } };
    if (reason === "timed_out") { const minutes = count(frame["minutes"]); return minutes === undefined ? undefined : { end: { state: "failed", reason, minutes } }; }
    return reason === "cancelled" || reason === "unavailable" || reason === "bad_paste" ? { end: { state: "failed", reason } } : undefined;
  }
  const id = frame["id"];
  const body = frame["body"];
  if (frame["kind"] !== "ui_request" || typeof id !== "string" || id === "" || !record(body)) return undefined;
  const pasted = body["paste"];
  const paste: { readonly paste?: Paste } = pasted === "address" || pasted === "code" || pasted === "domain" ? { paste: pasted } : {};
  if (body["method"] === "link" || body["method"] === "code") {
    const url = https(body["url"]);
    const minutes = count(body["minutes"]);
    if (url === undefined || minutes === undefined) return undefined;
    if (body["method"] === "link") {
      const stop = pasted === "address" ? address(body["stop"]) : undefined;
      return { step: { kind: "link", id, url, minutes, ...(pasted === "address" || pasted === "code" ? { paste: pasted } : {}), ...(stop === undefined ? {} : { stop }) } };
    }
    return typeof body["code"] === "string" && body["code"] !== "" ? { step: { kind: "code", id, code: body["code"], url, minutes } } : undefined;
  }
  const read = readUiRequest(id, body);
  // A question that begins a sign-in says how long the sign-in stands, as its link would.
  const minutes = count(body["minutes"]);
  return read?.method === "select" || read?.method === "input"
    ? { step: { kind: "ask", dialog: read, masked: read.method === "input" && body["masked"] === true, ...(read.method === "input" ? paste : {}), ...(minutes === undefined ? {} : { minutes }) } } : undefined;
}
