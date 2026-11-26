import type { NpmListed } from "./backend.js";
import type { Mark, OnNpm, Plugin, Section } from "./catalogue.js";
import { h, type Child } from "./dom.js";
import { isNpmPackageName } from "../shared/organization.js";
import type { Language, StringKey } from "./strings.js";

type Say = (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;

/**
 * The npm name a source names, `npm:<name>` with or without a version after it, as written; none for a source that is not npm's or names
 * nothing. Whether npm takes the name is the platform's to answer.
 */
export function npmNameOf(source: string): string | undefined {
  if (!source.startsWith("npm:")) return undefined;
  const rest = source.slice(4);
  const at = rest.indexOf("@", rest.startsWith("@") ? 1 : 0);
  const name = at === -1 ? rest : rest.slice(0, at);
  return name === "" ? undefined : name;
}

/**
 * What a package made for ComChatX by someone else says of itself in its `comchatx` field, read as ours are read (`declaredBy`): its
 * shelf, its mark and the Chinese of its line. A package npm finds by the keyword `comchatx` that gives no field declares nothing.
 */
export type Declared = { readonly section?: Section; readonly mark?: Mark; readonly zh?: string };

/**
 * A package of pi's gallery as a plugin the page installs: by the name npm knows it by, from npm with no version, made by whoever npm
 * says published it, and in its author's words in every language. Its page is the gallery's, `#/plugins/n/<name>`. What npm's list says
 * of it, where the page has its entry, is its card's facts and links. `made` is what one made for ComChatX declares, which lists it among
 * ComChatX's plugins: its shelf, its mark and its line's Chinese; with none it is a pi package, on 扩展, in npm's words.
 */
export function galleryPlugin(listed: Pick<NpmListed, "name"> & Partial<NpmListed>, made?: Declared): Plugin {
  const english = listed.description ?? "";
  return {
    id: `~${listed.name}`, name: listed.name, author: listed.author ?? "", section: made?.section ?? "extensions", about: { en: english, zh: made?.zh ?? english }, builds: [],
    box: { package: listed.name, skills: [], source: `npm:${listed.name}` }, npm: listed.name,
    ...(made?.mark === undefined ? {} : { mark: made.mark }),
    ...(listed.kinds === undefined ? {} : { onNpm: onNpm(listed as NpmListed) }),
    ...(made === undefined ? {} : { comchatx: true as const }),
    ...(made?.zh === undefined ? {} : { declaredZh: made.zh }),
  };
}
const onNpm = (listed: NpmListed): OnNpm => ({
  name: listed.name, kinds: listed.kinds, ...(listed.downloads === undefined ? {} : { downloads: listed.downloads }), ...(listed.updated === "" ? {} : { published: listed.updated }),
  ...(listed.repository === undefined ? {} : { repository: listed.repository }),
  ...(listed.homepage === undefined ? {} : { homepage: listed.homepage }),
});

/**
 * A record the page holds of a gallery package, with what the gallery's own record of it says: npm's facts and links, and what one made
 * for ComChatX declares. Its id, its package, what it builds on and what it is installed as stay the held record's, and so do its words
 * where it states any.
 */
export function withGallery(held: Plugin, built: Plugin): Plugin {
  const made = built.comchatx === true;
  return {
    ...held, author: held.author === "" ? built.author : held.author,
    about: held.about.en === "" && held.about.zh === "" ? built.about : built.declaredZh !== undefined ? { ...held.about, zh: built.declaredZh } : held.about,
    ...(made ? { section: built.section, comchatx: true as const } : {}),
    ...(built.declaredZh === undefined ? {} : { declaredZh: built.declaredZh }),
    ...(held.mark === undefined && built.mark !== undefined ? { mark: built.mark } : {}),
    ...(held.onNpm === undefined && built.onNpm !== undefined ? { onNpm: built.onNpm } : {}),
  };
}

const oneDecimal = (x: number): string => { const fixed = (Math.round(x * 10) / 10).toFixed(1); return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed; };
/** Last month's downloads as each language rounds a count: 762K and 1.6M, 76.2 万 and 162 万. */
export function downloadsWord(n: number, language: Language): string {
  if (language === "zh") return n < 10_000 ? String(n) : n < 1_000_000 ? `${oneDecimal(n / 10_000)} 万` : `${Math.round(n / 10_000)} 万`;
  // 999,500 and up round to a thousand thousands, so they are read in millions: 1M, never 1000K.
  return n < 1_000 ? String(n) : n < 10_000 ? `${oneDecimal(n / 1_000)}K` : n < 999_500 ? `${Math.round(n / 1_000)}K` : `${oneDecimal(n / 1_000_000)}M`;
}

/** The language words an author wrote are in, read from the words as round 27 reads them: Chinese, English, or "" where it cannot say. */
export function langOf(text: string): string {
  if ((text.match(/[\u3400-\u9fff]/g) ?? []).length > text.length * 0.05) return "zh-CN";
  const letters = text.match(/\p{L}/gu) ?? [];
  return letters.filter((letter) => /\p{Script=Latin}/u.test(letter)).length >= letters.length * 0.9 ? "en" : "";
}
/** Words a package's author wrote keep their own language and direction, never the page's. */
export const authored = (text: string): { readonly lang: string; readonly dir: "auto" } => ({ lang: langOf(text), dir: "auto" });
/** A third party's initial: its name without its scope or `pi-`, so pi-web-access draws W. */
export const thirdInitial = (name: string): string => [...name.trim().replace(/^@[^/]+\//, "").replace(/^pi-/, "")][0]?.toUpperCase() ?? "";

/** The mark a third-party plugin carries wherever it is drawn: its card, its row in Yours and its page's head. */
export const thirdMark = (say: Say): HTMLElement => h("span", { class: "pl-chip" }, say("pl.third.mark"));

/**
 * What npm says of a package beside its words: who published it, on its own page the version, how many used it last month and how
 * long ago it was published. A line breaks between two facts, never inside one, and each fact holds the dot after it, so a dot ends a
 * line rather than starting the next.
 */
export function npmFacts(say: Say, language: Language, facts: { readonly author?: string | undefined; readonly version?: string | undefined; readonly downloads?: number | undefined; readonly when?: string | undefined }): readonly Child[] {
  const parts = [
    h("span", { class: "pl-npm-whole" }, facts.author === undefined || facts.author === "" ? say("pl.own.by") : say("pl.by", { name: facts.author })),
    facts.version !== undefined && facts.version !== "" ? h("span", { class: "pl-npm-whole" }, facts.version) : undefined,
    facts.downloads !== undefined ? h("span", { class: "pl-npm-fact" }, say("pl.npm.downloads", { n: downloadsWord(facts.downloads, language) })) : undefined,
    facts.when !== undefined ? h("span", { class: "pl-npm-fact" }, say("pl.head.updated", { when: facts.when })) : undefined,
  ].filter((one): one is HTMLElement => one !== undefined);
  parts.slice(0, -1).forEach((one) => one.append(" ·"));
  return parts.flatMap((one, at) => (at > 0 ? [" ", one] : [one]));
}

/** The address of npm's own page for a package. */
export const npmUrl = (name: string): string => `https://www.npmjs.com/package/${name}`;
/**
 * The package an address names where it is that package's page on npm, as `npmUrl` writes it or without `www.`, with nothing after the
 * name but a slash, and the name one npm takes by its own rule; none for any other address, a version's or a file's under it included.
 */
export function npmPageOf(address: string): string | undefined {
  const name = /^https:\/\/(?:www\.)?npmjs\.com\/package\/((?:@[^/?#]+\/)?[^/?#]+)\/?$/.exec(address)?.[1];
  return name !== undefined && isNpmPackageName(name, "old") ? name : undefined;
}
