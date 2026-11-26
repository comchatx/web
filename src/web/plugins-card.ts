import { vendorIn, type OnNpm, type Plugin } from "./catalogue.js";
import { h, svg, type Child } from "./dom.js";
import { LINES, LOGOS } from "./plugin-marks.js";
import { downloadsWord, npmUrl } from "./plugins-npm.js";
import type { Language, StringKey } from "./strings.js";

type Say = (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;

/** What a card's two lines under its words read: the page's words, its language, and how long ago a moment was. */
export type CardWords = { readonly say: Say; readonly language: Language; readonly ago: (iso: string) => string | undefined };

/** A pi package of pi's own gallery, not one made for ComChatX: its mark is pi's. */
export const isPiPackage = (plugin: Plugin): boolean => plugin.npm !== undefined && plugin.comchatx !== true;

/** The mark pi.dev draws for a package that declares no image of its own, pi's own, in the text's colour. */
export function piMark(): SVGSVGElement {
  const logo = LOGOS["pi"]!;
  const drawn = svg("svg", { viewBox: logo.viewBox, fill: "currentColor", "aria-hidden": "true" });
  // The mark is the repository's own drawing, never a package's words.
  drawn.innerHTML = logo.body;
  return drawn;
}

/**
 * Where the maker's name stands in a phrase, as its own part: on a card it is the part that gives way first, cut with …, and the words
 * around it (「出品」, "by", 「来自」) stand whole beside it. A Chinese name sits against Chinese words, as `say()` sets one: 「小米出品」.
 */
function named(say: Say, key: "pl.by", slot: "name", name: string): HTMLElement {
  const [before = "", after = ""] = say(key, { [slot]: "\u0000" }).split("\u0000");
  const joinedAfter = /\p{Script=Han}$/u.test(name) && /^ ?\p{Script=Han}/u.test(after);
  const joinedBefore = /^\p{Script=Han}/u.test(name) && /\p{Script=Han} ?$/u.test(before);
  const maker = h("span", { class: ["pl-made-name", joinedBefore && "pl-made-joined-before", joinedAfter && "pl-made-joined"].filter(Boolean).join(" ") }, name);
  return h("span", { class: "pl-whole pl-made" }, joinedBefore ? before.replace(/ $/, "") : before, maker, joinedAfter ? after.replace(/^ /, "") : after);
}

/**
 * A card's facts, one line: who made it, then, where npm holds its package, how many used it last month and how long ago its version
 * was published. Each fact holds the dot after it, and where the line runs short the maker's name gives way first, then the age; the downloads stay whole.
 */
export function factsLine(words: CardWords, plugin: Plugin): HTMLElement {
  const { say } = words;
  const npm = plugin.onNpm;
  const when = npm?.published === undefined ? undefined : words.ago(npm.published);
  const facts = [
    plugin.author === "" ? h("span", { class: "pl-whole pl-made" }, say("pl.own.by")) : named(say, "pl.by", "name", plugin.author),
    npm?.downloads !== undefined && h("span", { class: "pl-figure" }, say("pl.npm.downloads", { n: downloadsWord(npm.downloads, words.language) })),
    when !== undefined && h("span", { class: "pl-figure" }, say("pl.head.updated", { when })),
  ].filter((one): one is HTMLElement => typeof one === "object");
  facts.slice(0, -1).forEach((one) => one.append(" ·"));
  return h("span", { class: "pl-meta pl-facts" }, h("span", { class: "pl-facts-text" }, ...facts.flatMap((one, at) => (at > 0 ? [" ", one] : [one]))));
}

/** Whether a model's own name already says where it comes from: its maker's, DeepSeek, or its maker's with a word after it, Mistral AI. */
export function namesMaker(plugin: Plugin, language: Language): boolean {
  if (plugin.model === undefined) return false;
  const [maker, name] = [vendorIn(plugin, language).toLowerCase(), plugin.name.toLowerCase()];
  return maker === name || maker.startsWith(`${name} `);
}

/** A repository's issues page, where a person tells its maker what went wrong: GitHub's alone is known. */
export function issuesOf(repository: string | undefined): string | undefined {
  if (repository === undefined) return undefined;
  let url: URL;
  try { url = new URL(repository); } catch { return undefined; }
  const [owner, name] = url.pathname.split("/").filter((part) => part !== "");
  return url.host === "github.com" && owner !== undefined && name !== undefined ? `https://github.com/${owner}/${name}/issues` : undefined;
}

/** A link out of the page: its mark and its word, its name saying it opens in a new tab; on a card, where its word may be hidden, the word is its title too. */
export function out(say: Say, link: OutLink, titled: boolean): HTMLElement {
  const words = say(link.word);
  return h("a", { class: "pl-out", href: link.to, target: "_blank", rel: "noopener noreferrer", ...(titled ? { title: words } : {}) }, drawn(link.mark), h("span", { class: "pl-word" }, words), h("span", { class: "pl-sr" }, say("pl.third.outside")));
}
const drawn = (name: string): SVGSVGElement => {
  const logo = LOGOS[name];
  if (logo !== undefined) {
    const one = svg("svg", { viewBox: logo.viewBox, fill: "currentColor", "aria-hidden": "true" });
    one.innerHTML = logo.body;
    return one;
  }
  return svg("svg", { viewBox: "0 0 24 24", class: "pl-icon", "aria-hidden": "true" }, svg("path", { d: LINES[name] ?? "" }));
};

/** One way out of the page to a plugin's own places: its mark, its word, where it goes. */
export type OutLink = { readonly mark: string; readonly word: StringKey; readonly to: string };

/**
 * A plugin's links out, the one list every surface draws, in this order: npm's page where npm holds it, the repository, GitHub's or
 * another's, the package's own website where one is given that is not its repository, and 反馈 to a GitHub repository's issues. Each
 * address is held to https once, where the gallery reads it (`src/platform/npm-gallery.ts`).
 */
export function outLinks(npm: string | undefined, source: string | undefined, homepage?: string): readonly OutLink[] {
  const issues = issuesOf(source);
  return [
    npm !== undefined && { mark: "npm", word: "pl.third.npm", to: npmUrl(npm) },
    source !== undefined && { mark: issues !== undefined ? "github" : "code", word: issues !== undefined ? "pl.third.github" : "pl.third.source", to: source },
    homepage !== undefined && homepage !== source && { mark: "globe", word: "pl.third.home", to: homepage },
    issues !== undefined && { mark: "flag", word: "pl.third.report", to: issues },
  ].filter((one): one is OutLink => one !== false);
}

/** A plugin page's links (sheet 3c): the plugin's `outLinks`, their words always shown. */
export function pageLinks(say: Say, links: readonly OutLink[]): HTMLElement | undefined {
  return links.length === 0 ? undefined : h("p", { class: "pl-outs pl-page-links" }, ...links.map((one) => out(say, one, false)));
}

/**
 * A card's links, after pi.dev's: the plugin's `outLinks` where npm holds the package, its website left to its page; then the marks
 * that say whose it is, that it pays and that it is off, at the line's end, never cut.
 */
export function linksLine(say: Say, npm: OnNpm | undefined, marks: readonly Child[]): HTMLElement {
  const shown = marks.filter((one) => typeof one === "object" && one !== null);
  return h("span", { class: "pl-links" },
    npm !== undefined && h("span", { class: "pl-outs" }, ...outLinks(npm.name, npm.repository).map((one) => out(say, one, true))),
    shown.length > 0 && h("span", { class: "pl-marks" }, ...shown));
}
