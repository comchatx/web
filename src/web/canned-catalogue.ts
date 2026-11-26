import makers from "./canned/makers.json" with { type: "json" };
import ours from "./canned/ours.json" with { type: "json" };
import s3 from "./canned/s3-storage.json" with { type: "json" };
import type { NpmPackage } from "./backend.js";
import { OFFICIAL_BUNDLES, type OfficialBundle } from "../shared/bundles.js";
import { catalogueWith, type Catalogue } from "./catalogue.js";
import { cardWords, type CardWords } from "../shared/maker-words.js";

/**
 * Ours as the preview's npm holds them (`canned/ours.json`): the packages of this repository as they publish, and the other five as
 * their repositories would publish them, each with its `comchatx` field. A test holds this repository's to their own `package.json`.
 */
export const OURS: readonly NpmPackage[] = ours.packages as readonly NpmPackage[];
/**
 * cx-s3-storage as npm holds the version the root pins (`canned/s3-storage.json`, its entry in `canned/ours.json` with its own date):
 * the package the `s3_*` states draw.
 */
export const FIELDS_OURS: readonly NpmPackage[] = s3.packages as readonly NpmPackage[];
/**
 * Model makers' packages as the preview's npm holds them (`canned/makers.json`), invented, figures and dates alike, so the Models shelf
 * draws a maker card's package facts and links: no maker's package is pinned to a published one.
 */
export const MAKERS: readonly NpmPackage[] = makers.packages as readonly NpmPackage[];
/**
 * Each card's words as the preview's npm holds them: the `comchatx` fields of `MAKERS`, and of the other provider packages that carry
 * words (`fields` in `canned/makers.json`), whose facts the preview draws on no card.
 */
export const WORDS: CardWords = cardWords([...MAKERS, ...Object.entries(makers.fields).map(([name, comchatx]) => ({ name, comchatx }))]);

/** The official bundles the preview's platform serves: the code's (`shared/bundles.ts`), and no other. */
export const OFFICIAL: readonly OfficialBundle[] = OFFICIAL_BUNDLES;

/** The catalogue the preview and the tests draw: the repository's, with ours and the makers' packages as the preview's npm holds them, and the official bundles. */
export const CATALOGUE: Catalogue = catalogueWith([...OURS, ...MAKERS], OFFICIAL, undefined, WORDS);
