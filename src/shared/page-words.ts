/**
 * The Plugins page's words that a refusal from the gate also says, so cx names what the seller sees. `src/web/strings.ts` draws them
 * from here, and the gate reads them here, since nothing outside `src/web` imports it.
 */
export const PAGE_WORDS = Object.freeze({
  "nav.plugins": { en: "Plugins", zh: "插件" },
  "pl.switch.off": { en: "Off", zh: "未开启" },
  "pl.tab.settings": { en: "Settings", zh: "设置" },
  "pl.side.notInstalled": { en: "Not installed", zh: "未安装" },
} as const);

export type PageWord = keyof typeof PAGE_WORDS;
