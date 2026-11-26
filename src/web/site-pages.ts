/** The official site's pages the product links to, in each language; the door's fine print and the settings window share them. */
export type SitePages = { readonly terms: string; readonly privacy: string };
const SITE = "https://www.comchatx.com";
export const SITE_PAGES: Readonly<Record<"zh" | "en", SitePages>> = Object.freeze({
  zh: Object.freeze({ terms: `${SITE}/terms/`, privacy: `${SITE}/privacy/` }),
  en: Object.freeze({ terms: `${SITE}/en/terms/`, privacy: `${SITE}/en/privacy/` }),
});
