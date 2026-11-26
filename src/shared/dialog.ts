import { readOptionForm, type AskForm } from "./option-form.js";

/** pi's command that answers a dialog: pi reads it and answers nothing, and one naming a dialog it does not wait on changes nothing. */
export const DIALOG_ANSWER = "extension_ui_response";

type Asked = {
  readonly id: string; readonly title: string;
  /**
   * How long pi's own wait has left, after which pi answers for itself and says nothing: the time the package gave, from when pi asked, or
   * the part of it the platform's hold says is left for a page that attaches later. The platform's default wait is never one: it ends
   * the dialog by its own answer, and says so.
   */
  readonly timeout?: number;
};

/** A question a package asks through pi's `ctx.ui`, as pi's RPC mode sends one: pi waits on it for an answer that carries its id. */
export type Dialog =
  | (Asked & { readonly method: "select"; readonly options: readonly string[] })
  | (Asked & { readonly method: "confirm"; readonly message: string })
  /** An input whose placeholder carries the option card's form is drawn as that card (`option-form.ts`), whoever sent it. */
  | (Asked & { readonly method: "input"; readonly placeholder?: string; readonly form?: AskForm })
  | (Asked & { readonly method: "editor"; readonly prefill?: string });

/** A package's word to the person, which waits on nothing. */
export type Notice = { readonly id: string; readonly method: "notify"; readonly message: string; readonly tone: "info" | "warning" | "error" };

/** What pi takes for a dialog: a choice or text, yes or no, or that the person would not say. */
export type DialogAnswer = { readonly value: string } | { readonly confirmed: boolean } | { readonly cancelled: true };

/**
 * How long a dialog the package gave no time waits for the seller: the platform answers it `{ cancelled: true }` then, as Skip would, and
 * a page folds its card as unanswered once the platform says the box took that. A package's own time stands.
 */
export const DIALOG_WAIT_MS = 5 * 60_000;

/** The platform's word on the stream that a dialog it held has ended, by the answer the box took: the seller's, or its own at the wait's end. */
export const DIALOG_ENDED = "dialog_ended";

/** An answer as a page sends it and as the platform names it: exactly one of a choice or text, yes or no, or none. */
export function readDialogAnswer(body: unknown): DialogAnswer | undefined {
  if (!record(body)) return undefined;
  if (body["cancelled"] === true) return { cancelled: true };
  if (typeof body["value"] === "string") return { value: body["value"] };
  if (typeof body["confirmed"] === "boolean") return { confirmed: body["confirmed"] };
  return undefined;
}

/** A form cx does not wait on, an option card's or a confirm card's: it outlives a turn, a message and a sleep (`option-form.ts`). */
export const isOptionCard = (dialog: Dialog): dialog is Extract<Dialog, { method: "input" }> & { readonly form: AskForm } => dialog.method === "input" && dialog.form !== undefined;

/** The longest wait a timer counts; Node runs one given longer out after a millisecond. */
const LONGEST_WAIT_MS = 2 ** 31 - 1;

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const word = (value: unknown): string => (typeof value === "string" ? value : "");
/**
 * A dialog's timeout as pi's timer reads it: pi sets no timer for a timeout that is not truthy, and waits for the answer; Node reads
 * any other as a number and runs out one it cannot count — negative, not a number, or past the longest — after a millisecond. JSON
 * writes `Infinity` as `null`, which reads as none here though pi answered at once.
 */
const piWait = (timeout: unknown): number | undefined => {
  if (!timeout) return undefined;
  const ms = Number(timeout);
  return ms >= 1 && ms <= LONGEST_WAIT_MS ? ms : 1;
};

/**
 * A `ui_request` frame's body read as what the page draws: a dialog, a notice, or nothing — pi's status, widget, title and editor-text
 * requests, which a page has no place for, and any method a later pi adds.
 */
export function readUiRequest(id: unknown, body: unknown): Dialog | Notice | undefined {
  if (typeof id !== "string" || id === "" || !record(body)) return undefined;
  const method = body["method"];
  if (method === "notify") {
    const tone = body["notifyType"];
    return { id, method, message: word(body["message"]), tone: tone === "warning" || tone === "error" ? tone : "info" };
  }
  const timeout = piWait(body["timeout"]);
  const asked: Asked = { id, title: word(body["title"]), ...(timeout === undefined ? {} : { timeout }) };
  if (method === "select") return { ...asked, method, options: Array.isArray(body["options"]) ? body["options"].filter((option): option is string => typeof option === "string") : [] };
  if (method === "confirm") return { ...asked, method, message: word(body["message"]) };
  if (method === "input") {
    const form = readOptionForm(body["placeholder"]);
    return { ...asked, method, ...(typeof body["placeholder"] === "string" ? { placeholder: body["placeholder"] } : {}), ...(form === undefined ? {} : { form }) };
  }
  if (method === "editor") return { ...asked, method, ...(typeof body["prefill"] === "string" ? { prefill: body["prefill"] } : {}) };
  return undefined;
}
