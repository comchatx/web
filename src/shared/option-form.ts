/**
 * The option card's form: one asking of one or several questions, each with options, that a package puts in front of the seller without
 * holding cx. It rides pi's `input` dialog, as the JSON of its placeholder, and comes back as that dialog's one value; the page draws it as
 * the option card for any package that sends it. `OPTION_FORM` is the mark that tells it from any other input. A package that answers the
 * seller's answers to cx writes them as a custom message whose `details` are an `OptionRecord`, and the page draws that as the card left.
 */
export const OPTION_FORM = "comchatx.options/1";
/**
 * The confirm card's form: one thing proposed for a yes or a no, which cx does not wait on either. It rides the same `input`, under the
 * same `ask` and the same rules; only the card drawn differs. 是 or 否 comes back as `{ form, confirmed }`, and a package's record of it
 * is a `ConfirmRecord`.
 */
export const CONFIRM_FORM = "comchatx.confirm/1";

export type OptionChoice = { readonly name: string; readonly line?: string };
export type OptionQuestion = {
  readonly words: string;
  readonly options: readonly OptionChoice[];
  /** Several answers: a box before each option. Without it one answer, a ring before each. */
  readonly several?: true;
  /** No last row for the seller's own words. Without it every question ends in one, as signed. */
  readonly own?: false;
};
export type OptionForm = {
  readonly form: typeof OPTION_FORM;
  /** The package's name for this asking: the same when it asks it again in another start of the computer. */
  readonly ask: string;
  readonly questions: readonly OptionQuestion[];
};
export type ConfirmForm = {
  readonly form: typeof CONFIRM_FORM;
  readonly ask: string;
  /** What is proposed, as the band at the card's head says it. */
  readonly title: string;
  /** What will happen, under the band; absent, the card has the band and its two buttons alone. */
  readonly message?: string;
};
/** Either form a package asks without holding cx: the one marker every rule keys on. */
export type AskForm = OptionForm | ConfirmForm;
/** A question's answer: the options chosen, by name, in the card's order, and the seller's own words; null for one passed with Skip. */
export type OptionAnswer = { readonly chosen: readonly string[]; readonly own?: string } | null;
/** What 提交 sends as the input's value: an answer a question, in order. A card with nothing answered is declined instead. */
export type OptionAnswers = { readonly form: typeof OPTION_FORM; readonly answers: readonly OptionAnswer[] };
/** The conversation's record of an answered asking, as a package writes it into the custom message's `details`. */
export type OptionRecord = { readonly form: typeof OPTION_FORM; readonly ask: string; readonly questions: readonly { readonly words: string }[]; readonly answers: readonly OptionAnswer[] };
/** The conversation's record of a proposal answered, as a package writes it. */
export type ConfirmRecord = { readonly form: typeof CONFIRM_FORM; readonly ask: string; readonly title: string; readonly confirmed: boolean };
export type AskRecord = OptionRecord | ConfirmRecord;

const record = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const parsed = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as unknown; } catch { return undefined; }
};

function choice(value: unknown): OptionChoice | undefined {
  if (!record(value) || !text(value["name"])) return undefined;
  return text(value["line"]) ? { name: value["name"], line: value["line"] } : { name: value["name"] };
}

function question(value: unknown): OptionQuestion | undefined {
  if (!record(value) || !text(value["words"]) || !Array.isArray(value["options"])) return undefined;
  const options = value["options"].map(choice);
  if (options.length === 0 || options.some((one) => one === undefined)) return undefined;
  return { words: value["words"], options: options as OptionChoice[], ...(value["several"] === true ? { several: true } : {}), ...(value["own"] === false ? { own: false } : {}) };
}

/** An input's placeholder read as either form: one that does not read whole, or carries another mark, is no form, and the input is drawn as it is. */
export function readOptionForm(value: unknown): AskForm | undefined {
  const form = parsed(value);
  if (record(form) && form["form"] === CONFIRM_FORM && text(form["ask"]) && text(form["title"])) {
    return { form: CONFIRM_FORM, ask: form["ask"], title: form["title"], ...(text(form["message"]) ? { message: form["message"] } : {}) };
  }
  if (!record(form) || form["form"] !== OPTION_FORM || !text(form["ask"]) || !Array.isArray(form["questions"])) return undefined;
  const questions = form["questions"].map(question);
  if (questions.length === 0 || questions.some((one) => one === undefined)) return undefined;
  return { form: OPTION_FORM, ask: form["ask"], questions: questions as OptionQuestion[] };
}

function answer(value: unknown): OptionAnswer | undefined {
  if (value === null) return null;
  if (!record(value) || !Array.isArray(value["chosen"]) || !value["chosen"].every((one) => typeof one === "string")) return undefined;
  return typeof value["own"] === "string" ? { chosen: value["chosen"] as string[], own: value["own"] } : { chosen: value["chosen"] as string[] };
}

/** A custom message's details read as the record of an answered asking, of either form; anything else is not one. */
export function readOptionRecord(value: unknown): AskRecord | undefined {
  if (record(value) && value["form"] === CONFIRM_FORM && text(value["ask"]) && typeof value["title"] === "string" && typeof value["confirmed"] === "boolean") {
    return { form: CONFIRM_FORM, ask: value["ask"], title: value["title"], confirmed: value["confirmed"] };
  }
  if (!record(value) || value["form"] !== OPTION_FORM || !text(value["ask"]) || !Array.isArray(value["questions"]) || !Array.isArray(value["answers"])) return undefined;
  const questions = value["questions"].map((one) => (record(one) && typeof one["words"] === "string" ? { words: one["words"] } : undefined));
  const answers = value["answers"].map(answer);
  if (questions.some((one) => one === undefined) || answers.some((one) => one === undefined) || answers.length !== questions.length) return undefined;
  return { form: OPTION_FORM, ask: value["ask"], questions: questions as { words: string }[], answers: answers as OptionAnswer[] };
}

/** The input's value 提交 sends. */
export const answersValue = (answers: readonly OptionAnswer[]): string => JSON.stringify({ form: OPTION_FORM, answers } satisfies OptionAnswers);

/** The value 提交 sent read back: what the card left shows before the package's record of it arrives. */
export function readAnswersValue(value: string): readonly OptionAnswer[] | undefined {
  const read = parsed(value);
  if (!record(read) || read["form"] !== OPTION_FORM || !Array.isArray(read["answers"])) return undefined;
  const answers = read["answers"].map(answer);
  return answers.some((one) => one === undefined) ? undefined : answers as OptionAnswer[];
}

/** The input's value 是 or 否 sends. */
export const confirmedValue = (confirmed: boolean): string => JSON.stringify({ form: CONFIRM_FORM, confirmed });

/** The value 是 or 否 sent read back. */
export function readConfirmedValue(value: string): boolean | undefined {
  const read = parsed(value);
  return record(read) && read["form"] === CONFIRM_FORM && typeof read["confirmed"] === "boolean" ? read["confirmed"] : undefined;
}
