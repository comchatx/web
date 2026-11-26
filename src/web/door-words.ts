/** The door's two languages: Chinese first, and the door opens in it unless the person's address or last choice names English. */
export const DOOR_LANGUAGES = Object.freeze(["zh", "en"] as const);
export type DoorLanguage = (typeof DOOR_LANGUAGES)[number];
/** Where the product keeps the language a person chose; the door writes its page's language there, and its first script reads it. */
export const LANGUAGE_KEY = "cmx-language";
export const SUPPORT = "support@comchatx.com";

/** Ours: the page around the vendor's card. Each `{name}` is filled from what the platform answered. */
export const WORDS = Object.freeze({
  "note.invited": { zh: "{who} 邀请你使用 ComChatX", en: "{who} invited you to ComChatX" },
  "note.invited.past": { zh: "注册可获得 {direct} 试用余额，{days} 天内有效。", en: "Signing up gives you {direct} of trial balance, good for {days} days." },
  "note.lapsed": { zh: "该邀请链接已失效", en: "This invitation link no longer works" },
  "note.signed-out": { zh: "你已退出登录。", en: "You've signed out." },
  "note.signed-out-all": { zh: "你已在所有设备上退出登录。", en: "You've signed out on every device." },
  "note.expired": { zh: "登录已过期，请重新登录。", en: "Your login has expired. Log in again." },
  "note.deleted": { zh: "账户已删除。", en: "Account deleted." },
  legal: { zh: "继续即表示你同意{terms}和{privacy}。", en: "By continuing, you agree to the {terms} and the {privacy}." },
  "legal.terms": { zh: "《服务条款》", en: "Terms of Service" },
  "legal.privacy": { zh: "《隐私政策》", en: "Privacy Policy" },
  "legal.newTab": { zh: "（在新标签页打开）", en: " (Opens in a new tab)" },
  "card.failed": { zh: "登录框加载失败，请刷新页面。", en: "The login card didn't load. Reload the page." },
} as const);
export type WordKey = keyof typeof WORDS;

// A space between Chinese and Latin text is kept from breaking, as the drawing sets it; in English a number stays with its unit.
const TIES = /(?<=[㐀-鿿）}》]) (?=[A-Za-z0-9$−{《])|(?<=[A-Za-z0-9%.}]) (?=[㐀-鿿（{《])/g;
export const tie = (language: DoorLanguage, words: string): string =>
  (language === "zh" ? words.replace(TIES, " ") : words.replace(/(\d) (?=(?:days?|minutes?)\b)/g, "$1 ")).replace(/ (\d{1,2}:\d{2}) /g, " $1 ");
// On the door, a Chinese word of two characters before a tied Latin word stays whole with it, so 「使用 ComChatX」 never breaks inside 使用.
const WORD_BEFORE_LATIN = /(?<=[㐀-鿿])(?=[㐀-鿿]\u00a0[A-Za-z0-9$])/g;
export const say = (language: DoorLanguage, key: WordKey, values: Readonly<Record<string, string | number>> = {}): string => {
  const said = tie(language, WORDS[key][language].replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole)));
  return language === "zh" ? said.replace(WORD_BEFORE_LATIN, "\u2060") : said;
};

/**
 * The vendor's words, in its own localization keys, one object per language, passed whole. A key left out falls back to the vendor's
 * English; an empty one blanks the line. Error keys are looked up as `<code>__<param>`, then `<code>`, whether or not the vendor's type lists
 * them: the first screen's field is the param `identifier`, which the door answers itself since it takes the browser's own check off the form.
 */
export const VENDOR_WORDS = Object.freeze({
  zh: {
    locale: "zh-CN",
    formFieldLabel__emailAddress: "邮箱",
    formFieldInputPlaceholder__emailAddress: "",
    formFieldInput__emailAddress_format: "请输入完整的邮箱地址，例如 name@example.com",
    formButtonPrimary: "继续",
    dividerText: "或",
    socialButtonsBlockButton: "使用 {{provider|titleize}} 账号登录",
    lastAuthenticationStrategy: "上次使用",
    backButton: "返回",
    footerActionLink__useAnotherMethod: "其他方式",
    identityPreviewEditButton__emailAddress: "修改邮箱",
    signIn: {
      start: { titleCombined: "登录 {{applicationName}}", subtitleCombined: "" },
      emailCode: { title: "输入验证码", subtitle: "", formTitle: "验证码", resendButton: "重新发送" },
      alternativeMethods: {
        title: "其他方式",
        subtitle: "",
        actionText: "",
        actionLink: "获取帮助",
        getHelp: { title: "获取帮助", content: `请发邮件至 ${SUPPORT}，并注明登录邮箱。`, blockButton__emailSupport: "发邮件联系客服" },
      },
    },
    signUp: {
      start: { title: "注册 {{applicationName}}", titleCombined: "注册 {{applicationName}}", subtitle: "", subtitleCombined: "", actionText: "已有账号？", actionLink: "登录" },
      emailCode: { title: "输入验证码", subtitle: "", formTitle: "验证码", formSubtitle: "", resendButton: "重新发送" },
      legalConsent: {
        continue: { title: "服务条款与隐私政策", subtitle: "" },
        checkbox: { label__termsOfServiceAndPrivacyPolicy: '我已阅读并同意{{ termsOfServiceLink || link("《服务条款》") }}和{{ privacyPolicyLink || link("《隐私政策》") }}' },
      },
    },
    unstable__errors: {
      form_param_nil__identifier: "请输入邮箱。",
      form_param_format_invalid__identifier: "请输入正确的邮箱地址。",
      form_param_format_invalid__email_address: "请输入正确的邮箱地址。",
      form_code_incorrect: "验证码错误。如已重新发送，请输入最新邮件中的验证码。",
      verification_expired: "验证码已过期，请重新发送。",
      verification_failed: "错误次数过多，请重新发送验证码。",
      too_many_requests: "操作过于频繁，请稍后再试。",
      oauth_access_denied: "Google 登录未完成。",
      captcha_invalid: "安全验证未通过，请刷新页面后重试。",
    },
  },
  en: {
    locale: "en-US",
    formFieldLabel__emailAddress: "Email",
    formFieldInputPlaceholder__emailAddress: "",
    formFieldInput__emailAddress_format: "Enter a full email address, like name@example.com",
    formButtonPrimary: "Continue",
    dividerText: "or",
    socialButtonsBlockButton: "Continue with {{provider|titleize}}",
    lastAuthenticationStrategy: "Last used",
    backButton: "Back",
    footerActionLink__useAnotherMethod: "Other ways",
    identityPreviewEditButton__emailAddress: "Change email",
    signIn: {
      start: { titleCombined: "Log in to {{applicationName}}", subtitleCombined: "" },
      emailCode: { title: "Enter the code", subtitle: "", formTitle: "Code", resendButton: "Resend" },
      alternativeMethods: {
        title: "Other ways",
        subtitle: "",
        actionText: "",
        actionLink: "Get help",
        getHelp: { title: "Get help", content: `Email ${SUPPORT} and include the address you log in with.`, blockButton__emailSupport: "Email support" },
      },
    },
    signUp: {
      start: { title: "Sign up for {{applicationName}}", titleCombined: "Sign up for {{applicationName}}", subtitle: "", subtitleCombined: "", actionText: "Have an account?", actionLink: "Log in" },
      emailCode: { title: "Enter the code", subtitle: "", formTitle: "Code", formSubtitle: "", resendButton: "Resend" },
      legalConsent: {
        continue: { title: "Terms and privacy", subtitle: "" },
        checkbox: { label__termsOfServiceAndPrivacyPolicy: 'I have read and accept the {{ termsOfServiceLink || link("Terms of Service") }} and the {{ privacyPolicyLink || link("Privacy Policy") }}' },
      },
    },
    unstable__errors: {
      form_param_nil__identifier: "Enter your email.",
      form_param_format_invalid__identifier: "Enter a valid email address.",
      form_param_format_invalid__email_address: "Enter a valid email address.",
      form_code_incorrect: "Incorrect code. If you asked for a new one, enter the code from the latest email.",
      verification_expired: "This code has expired. Resend it to get a new one.",
      verification_failed: "Too many incorrect codes. Resend the code to try again.",
      too_many_requests: "Too many attempts. Wait a moment and try again.",
      oauth_access_denied: "Google login was not completed.",
      captcha_invalid: "The security check failed. Reload the page and try again.",
    },
  },
} as const);
