import { tie, WORDS as DOOR_WORDS, type DoorLanguage } from "./door-words.js";
import { text, type StringKey } from "./strings.js";

/**
 * The road's own words, from sign-up to the chat page: each a key of the signed prototype (`spike/signup-flow`, its README's table as
 * the designer's third sheet left it), entered as signed. The door's and the product's lines the road reuses are read from their own tables.
 */
export const ROAD_WORDS = Object.freeze({
  "terms.title": { zh: "创建账户", en: "Let's create your account" },
  "terms.sub": { zh: "请确认以下事项", en: "A few things for you to review" },
  "terms.agree": { zh: "我已阅读并同意{terms}和{privacy}", en: "I agree to ComChatX's {terms} and {privacy}." },
  "terms.news": { zh: "接收不定期的推广邮件和通知，可随时退订", en: "Subscribe to occasional promotional emails and notifications. You can opt out any time." },
  "terms.go": { zh: "创建账户", en: "Create account" },
  "terms.missed": { zh: "请先同意《服务条款》和《隐私政策》。", en: "Accept the Terms of Service and the Privacy Policy first." },
  "foot.verified": { zh: "邮箱 {email} 已验证", en: "Email verified as {email}" },
  "foot.other": { zh: "使用其他邮箱", en: "Use a different email" },
  "fork.title": { zh: "选择方案", en: "Explore plans" },
  "fork.line": { zh: "你有 {amount} 试用余额，{day}到期", en: "You have {amount} of trial balance until {day}" },
  "fork.trial.go": { zh: "试用 ComChatX", en: "Try ComChatX" },
  "fork.ended": { zh: "试用已结束", en: "Your trial has ended" },
  "fork.notNow": { zh: "跳过", en: "Skip" },
  "plan.pro.note": { zh: "每月，$10.00 全部计入余额，当期有效", en: "Per month, all $10.00 added to your balance, valid for the period" },
  "plan.pro.go": { zh: "订阅", en: "Subscribe" },
  "plan.pro.fine": { zh: "随时取消自动续费", en: "Cancel auto-renewal anytime" },
  "plan.l.sources": { zh: "全部数据源", en: "Every data source" },
  "plan.l.models": { zh: "市面上的主流模型", en: "The leading models on the market" },
  "plan.l.safe": { zh: "独立且安全的运行环境", en: "An isolated, secure environment" },
  "plan.l.plugins": { zh: "所有可安装的插件", en: "Every plugin you can install" },
  "plan.l.topUp": { zh: "按需充值", en: "Top up as you need" },
  "plan.l.invite": { zh: "邀请好友，前 3 位可得 $5.00 试用余额", en: "Invite friends; your first 3 each get $5.00 of trial balance" },
  "plan.any": { zh: "所有账户都可以：", en: "Any account can:" },
  "plan.l.store": { zh: "连接店铺", en: "Connect your store" },
  "plan.l.own": { zh: "接入自己的模型 API 或订阅", en: "Connect your own model API key or subscription" },
  "name.ask": { zh: "开始之前，怎么称呼你？", en: "Before we get started, what should I call you?" },
  "name.go": { zh: "继续", en: "Continue" },
  "pick.go": { zh: "开始使用", en: "Let's go" },
  "ask.hello": { zh: "你好，{name}！我是 cx。", en: "Welcome, {name}! I'm cx." },
  "ask.shops": { zh: "选择你的身份，让我更好地帮你", en: "Choose what describes you so I can help you better." },
  "ask.many": { zh: "可多选", en: "Select all that apply" },
  "ask.shop.amazonSeller": { zh: "亚马逊卖家", en: "Amazon seller" },
  "ask.shop.solo": { zh: "一个人开店", en: "Solo seller" },
  "ask.shop.bestbuy": { zh: "Best Buy 卖家", en: "Best Buy seller" },
  "ask.shop.agent": { zh: "Agent 开发者", en: "Agent developer" },
  "ask.shop.shopify": { zh: "Shopify 独立站卖家", en: "Shopify store owner" },
  "ask.shop.other": { zh: "其他平台的卖家", en: "Other marketplace seller" },
  "ask.shop.none": { zh: "还没开店", en: "Not selling yet" },
  "ask.next.ask": { zh: "想让我帮你做什么？", en: "What would you like me to help with?" },
  "ask.next.listing": { zh: "找出 listing 卖不动的原因", en: "Find why a listing won't sell" },
  "ask.next.ads": { zh: "管好广告花费", en: "Keep ad spend in check" },
  "ask.next.restock": { zh: "按时补货", en: "Restock on time" },
  "ask.next.profit": { zh: "算清每个商品赚了多少", en: "See what each product earns" },
  "ask.next.claims": { zh: "追回亚马逊该赔的钱", en: "Claim what Amazon owes me" },
  "ask.next.rivals": { zh: "盯着竞品的价格和排名", en: "Watch rivals' prices" },
  "ask.next.media": { zh: "生成商品图片和视频", en: "Product images and videos" },
  "ask.line": { zh: "还有什么要补充的吗？", en: "Anything else to add?" },
  "back": { zh: "返回", en: "Back" },
} as const);
export type RoadKey = keyof typeof ROAD_WORDS;
type DoorKey = "note.invited" | "legal.terms" | "legal.privacy" | "legal.newTab";
type BuildKey = Extract<StringKey, "pl.toastNotDone" | "status.unreachable" | "status.reconnecting" | "road.payChecking" | "road.payUnread" | "road.payOnce">;
const BUILD_KEYS: ReadonlySet<string> = new Set<BuildKey>(["pl.toastNotDone", "status.unreachable", "status.reconnecting", "road.payChecking", "road.payUnread", "road.payOnce"]);
export type RoadSay = (key: RoadKey | DoorKey | BuildKey, values?: Readonly<Record<string, string | number>>) => string;

// Words a Chinese line must not turn inside, as the door holds 「使用 ComChatX」 whole.
const WHOLE = ["使用 ComChatX", "邀请你", "其他邮箱", "创建", "账户", "确认", "事项", "阅读", "同意", "可随时退订", "接收", "不定期", "推广", "邮件", "通知", "退订", "怎么称呼你", "选择", "身份", "让我更好地帮你", "到期", "服务条款", "隐私政策"];

/**
 * A line of the road in one language. A line written for a Latin value takes no space where the value is Chinese (「王伟邀请你…」); the
 * spaces between Chinese and Latin text do not break, but an address may turn before or after it; and the words above stay whole.
 */
export const roadSay = (language: DoorLanguage): RoadSay => (key, values = {}) => {
  if (BUILD_KEYS.has(key)) return text(language, key as BuildKey, values);
  const row: { readonly zh: string; readonly en: string } = key in ROAD_WORDS ? ROAD_WORDS[key as RoadKey] : DOOR_WORDS[key as DoorKey];
  let said = row[language].replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
  if (language === "en") return tie(language, said);
  said = tie(language, said.replace(/(?<=[㐀-鿿]) (?=[㐀-鿿])/g, ""));
  for (const value of Object.values(values)) if (String(value).includes("@")) said = said.split(` ${value}`).join(` ${value}`).split(`${value} `).join(`${value} `);
  for (const whole of WHOLE) said = said.split(whole).join(whole.replace(/(?<=[㐀-鿿])(?=[㐀-鿿])/g, "⁠"));
  return said;
};
