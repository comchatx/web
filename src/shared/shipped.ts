/**
 * What a pi package ships to say of itself, read from its files at one version: its READMEs, the skills and prompt templates pi loads
 * from it, as pi 1.4.0 finds and lists them (`src/platform/pi-resources.ts` decides which, on the platform). The page draws a
 * package's Overview, Skills and Try it from this, never from words written about it elsewhere.
 */

/** A skill as pi lists it: the name a session knows it by and the description pi decides by. */
export type ShippedSkill = { readonly name: string; readonly description: string };
/** A prompt template: run as `/<name>`; `hint` is its `argument-hint`, where it asks for words after the name. */
export type ShippedPrompt = { readonly name: string; readonly description: string; readonly hint?: string };
/** The parts the page draws from a package's files; one the platform could not read is named in `unread`. */
export const SHIPPED_PARTS = ["readme", "skills", "prompts"] as const;
export type ShippedPart = (typeof SHIPPED_PARTS)[number];
/**
 * A package's files as the page reads them: `readme` is `README.md` and `readme_zh` its Chinese, each absent where the package ships
 * none; a part the platform could not read (a README past the version read's 1 MiB, another file past `SHIPPED_TEXT_BYTES`, or the CDN
 * not answering) is named in `unread`.
 */
export type Shipped = {
  readonly readme?: string;
  readonly readme_zh?: string;
  readonly skills: readonly ShippedSkill[];
  readonly prompts: readonly ShippedPrompt[];
  readonly unread: readonly ShippedPart[];
};
/** Nothing read: a package whose files could not be listed. */
export const UNREAD: Shipped = Object.freeze({ skills: Object.freeze([]), prompts: Object.freeze([]), unread: SHIPPED_PARTS });

/** The most of one `SKILL.md`, template or ignore file a read takes: one past it is not read, and its part is said unread. */
export const SHIPPED_TEXT_BYTES = 64 * 1024;
/** The most skills, and the most templates, read of one package: each is a file fetched. */
export const SHIPPED_MOST = 32;

/** Where npm's CDN serves a package's files at a version; a README's relative links and pictures resolve here, as pi.dev draws them. */
export const cdnBase = (name: string, version: string): string => `https://cdn.jsdelivr.net/npm/${name}@${version}/`;

/** The README pi.dev and npm draw, at the package's root, and its Chinese: `README.zh-CN.md`, else `README.zh.md`, else `README.zh-TW.md`. */
export function readmePaths(files: readonly string[]): { readonly en?: string; readonly zh?: string } {
  const at = (rule: RegExp): string | undefined => files.find((path) => rule.test(path));
  const en = at(/^readme(?:\.md|\.markdown)?$/i);
  const zh = at(/^readme\.zh-cn\.md$/i) ?? at(/^readme\.zh\.md$/i) ?? at(/^readme\.zh-tw\.md$/i);
  return { ...(en === undefined ? {} : { en }), ...(zh === undefined ? {} : { zh }) };
}

const isText = (value: unknown): value is string => typeof value === "string";
const fieldsOf = (value: unknown): Readonly<Record<string, unknown>> | undefined => (typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined);

/**
 * What a page holds of a package's files as the platform answers them: an entry that breaks its shape is left out, and an answer that
 * is no such record at all is nothing read, so the page says so rather than drawing a package with no skills.
 */
export function readShipped(value: unknown): Shipped {
  const given = fieldsOf(value);
  if (given === undefined || !Array.isArray(given["skills"]) || !Array.isArray(given["prompts"]) || !Array.isArray(given["unread"])) return UNREAD;
  const skills = given["skills"].flatMap((one): ShippedSkill[] => { const skill = fieldsOf(one); return isText(skill?.["name"]) && isText(skill["description"]) && skill["name"] !== "" ? [{ name: skill["name"], description: skill["description"] }] : []; });
  // A template is sent as `/<name>`: a name with a space or a slash in it would send other words, so it is not offered.
  const prompts = given["prompts"].flatMap((one): ShippedPrompt[] => { const prompt = fieldsOf(one); return isText(prompt?.["name"]) && /^[^\s/]+$/.test(prompt["name"]) && isText(prompt["description"]) ? [{ name: prompt["name"], description: prompt["description"], ...(isText(prompt["hint"]) ? { hint: prompt["hint"] } : {}) }] : []; });
  return Object.freeze({
    ...(isText(given["readme"]) ? { readme: given["readme"] } : {}), ...(isText(given["readme_zh"]) ? { readme_zh: given["readme_zh"] } : {}),
    skills: Object.freeze(skills), prompts: Object.freeze(prompts), unread: Object.freeze(SHIPPED_PARTS.filter((part) => (given["unread"] as unknown[]).includes(part))),
  });
}
