import { describe, expect, it } from "vitest";
import { VENDOR_WORDS, WORDS } from "./door-words.js";

describe("the door's words", () => {
  it("say Log in in English, never Sign in, and the Chinese 登录", () => {
    expect([VENDOR_WORDS.en.signIn.start.titleCombined, VENDOR_WORDS.zh.signIn.start.titleCombined]).toEqual(["Log in to {{applicationName}}", "登录 {{applicationName}}"]);
    const english = JSON.stringify([Object.values(WORDS).map((one) => one.en), VENDOR_WORDS.en]);
    expect(english).not.toMatch(/\bsign(ing|ed)? in\b|sign-in/i);
  });
  it("print no start subtitle, no code-screen subtitle and no other-ways lead, and the shorter lines, in both languages", () => {
    const lines = (language: "zh" | "en") => {
      const words = VENDOR_WORDS[language];
      return [words.signIn.start.subtitleCombined, words.signIn.emailCode.subtitle, words.signUp.emailCode.subtitle, words.signIn.alternativeMethods.actionText,
        words.signIn.emailCode.resendButton, words.signUp.emailCode.resendButton, words.footerActionLink__useAnotherMethod, words.signIn.alternativeMethods.title, words.unstable__errors.oauth_access_denied];
    };
    expect(lines("zh")).toEqual(["", "", "", "", "重新发送", "重新发送", "其他方式", "其他方式", "Google 登录未完成。"]);
    expect(lines("en")).toEqual(["", "", "", "", "Resend", "Resend", "Other ways", "Other ways", "Google login was not completed."]);
  });
});
