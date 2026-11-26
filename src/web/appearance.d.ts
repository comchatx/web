/**
 * The page's appearance as `site/appearance.js` declares it on the page: a classic script in <head>, loaded before the stylesheets so
 * the first paint is in the chosen set, which sets `data-theme` on <html> and this one global.
 */
export type Appearance = "system" | "light" | "dark";

declare global {
  var CmxAppearance: { readonly read: () => Appearance; readonly choose: (appearance: Appearance) => void } | undefined;
}
