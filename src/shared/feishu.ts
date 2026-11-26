/** The start of every Feishu custom bot's webhook address; the bot's token follows it. */
export const FEISHU_HOOK_PREFIX = "https://open.feishu.cn/open-apis/bot/v2/hook/";
/** The token's letters and bound; the account row's check is the same. */
const FEISHU_HOOK = /^https:\/\/open\.feishu\.cn\/open-apis\/bot\/v2\/hook\/[A-Za-z0-9_-]{1,128}$/;

/** The package whose Settings save the address, and which hands it to pi-channels. */
export const FEISHU_PACKAGE = "cx-feishu";

/** A Feishu bot's webhook address, or undefined for anything else, the empty string included. */
export function readFeishuHook(value: unknown): string | undefined {
  return typeof value === "string" && FEISHU_HOOK.test(value) ? value : undefined;
}

/**
 * pi-channels' section of pi's settings for one bot: a webhook adapter and the route cx-feishu's skill names. pi-channels reads it from
 * the agent directory's `settings.json`.
 */
export function channelsSection(hook: string): Readonly<Record<string, unknown>> {
  return { adapters: { feishu: { type: "webhook" } }, routes: { team: { adapter: "feishu", recipient: hook } } };
}
