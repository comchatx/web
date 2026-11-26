// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "./cx.js";
import { ComputerWindow, countdown, span, typedMinutes, windowActs, type WindowAct, type WindowView } from "./computer-window.js";
import { text, type Language } from "./strings.js";

const VIEW: WindowView = {
  kind: "on", left: 9.5 * 60_000, asking: false, awake: { on: false, minutes: 10 }, newer: false, hour: "$0.02", month: "$1.86", since: "Today, 14:02", plugins: 12, parts: undefined, size: { kind: "shared", cpus: 1, memoryMb: 1024 },
  state: "ready", dot: "ready", reason: undefined, lang: "en",
};

type Made = { readonly window: ComputerWindow; readonly does: string[]; readonly written: (readonly [boolean, number])[]; readonly closed: boolean[]; answer: (ok: boolean) => void };

/** The window over a page of its own, open on a view; `held` keeps each write waiting until the test answers it. */
function made(view: Partial<WindowView> = {}, language: Language = "en", held = false): Made {
  const does: string[] = [], written: (readonly [boolean, number])[] = [], closed: boolean[] = [];
  const waiting: ((ok: boolean) => void)[] = [];
  const window = new ComputerWindow({
    say: (key, values) => text(language, key, values), does: (act) => does.push(act), close: (back) => closed.push(back),
    setAwake: (on, minutes) => { written.push([on, minutes]); return held ? new Promise<void>((done, refused) => waiting.push((ok) => (ok ? done() : refused(new Error("503"))))) : Promise.resolve(); },
    links: { usage: "#/settings/usage/month", plugins: "#/plugins", help: "mailto:support@comchatx.com", size: "#/settings/computer/size", storage: "#/settings/computer/storage" },
  });
  document.body.append(window.element);
  window.update({ ...VIEW, lang: language, ...view });
  window.open();
  return { window, does, written, closed, answer: (ok) => waiting.shift()?.(ok) };
}
const at = (selector: string): HTMLElement => document.querySelector<HTMLElement>(selector)!;
const option = (what: string): HTMLElement => at(`[data-key='auto-${what}']`);
const chosen = (): string | undefined => document.querySelector("[role=radiogroup] [aria-checked='true']")?.getAttribute("data-key")?.slice(5);
const help = (): string | undefined => document.querySelector("#cw-auto-help")?.textContent ?? undefined;
const settle = (): Promise<void> => new Promise((done) => setTimeout(done, 0));
const typeIn = (words: string): void => {
  const field = at(".cw-num") as HTMLInputElement;
  field.value = words;
  field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
};

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe("the window of cx's computer", () => {
  it("draws on as signed: the parts by name and size, 开机时间, the money row, 插件 and 自动关机 on the account's time, then at its foot the band with its two presses, its state and time", () => {
    made({}, "zh");
    expect([at(".cw-name").textContent, at(".cw-state").textContent, at(".cw-when").textContent, [...document.querySelectorAll("[data-act]")].map((one) => one.textContent)])
      .toEqual(["cx 的电脑", "已开机", "9 分钟后关机", ["关机", "重启"]]);
    expect([...document.querySelectorAll(".cw-main > li")].map((row) => row.textContent)).toEqual([
      "处理器 1 核 ›内存 1 GB ›存储 ›", "开机时间Today, 14:02", "每小时 $0.02本月 $1.86 ›", "插件已安装 12 个 ›", "自动关机永不10 分钟30 分钟1 小时自定义",
    ]);
    // The band is the window's foot, outside the rows' scroller: the presses first, then the state, then the picture.
    expect([...at(".cw").children].map((one) => one.className)).toEqual(["cw-bar", "cw-body", "cw-head cw-foot"]);
    expect([...at(".cw-foot").querySelectorAll(".cw-acts, .cw-say, .cw-pic")].map((one) => one.className)).toEqual(["cw-acts", "cw-say", "cw-pic"]);
    // Tab walks as it reads: the close mark, the three parts, 本月, 插件, 自动关机, then the presses (sheet 2).
    const stops = [...at(".cw").querySelectorAll<HTMLElement>("button:not([tabindex='-1']), a")].map((one) => one.getAttribute("data-key") ?? one.getAttribute("data-act"));
    expect(stops).toEqual(["close", "part-cpu", "part-memory", "part-storage", "usage", "plugins", "auto-10", "off", "restart"]);
    expect([chosen(), at(".cw").getAttribute("role"), at(".cw").getAttribute("aria-labelledby"), document.activeElement === at(".cw")]).toEqual(["10", "dialog", "cw-name", true]);
    // The month links to 用量 on 本月, the plugins to the Plugins page.
    expect([at("[data-key='usage']").getAttribute("href"), at("[data-key='plugins']").getAttribute("href")]).toEqual(["#/settings/usage/month", "#/plugins"]);
  });

  it("makes the whole 插件 row one link to the Plugins page, its name and its count inside it, one stop for the keyboard, and closes the window on it", () => {
    const one = made({}, "zh");
    const row = at("[data-key='plugins']").closest("li")!;
    expect([row.children.length, row.firstElementChild === at("[data-key='plugins']"), at("[data-key='plugins']").textContent]).toEqual([1, true, "插件已安装 12 个 ›"]);
    expect([...row.querySelectorAll("a, button, input, [tabindex]")]).toHaveLength(1);
    at("[data-key='plugins']").click();
    expect(one.closed).toEqual([false]);
    // Unread, the row is the same link with its name alone.
    document.body.replaceChildren();
    made({ plugins: undefined }, "zh");
    expect([at("[data-key='plugins']").textContent, at("[data-key='plugins']").getAttribute("href")]).toEqual(["插件 ›", "#/plugins"]);
  });

  it("draws each part's figure the platform read as a bar and a percent, named in words; the processor and the memory only while it runs", () => {
    const parts = { cpu: 12, memory: 40, storageGb: 6, storage: 31 };
    const drawn = () => [...document.querySelectorAll<HTMLElement>(".cw-part")].map((part) =>
      [part.textContent, part.getAttribute("aria-label"), part.querySelector<HTMLElement>(".bar > span")?.style.width]);
    made({ parts }, "zh");
    expect(drawn()).toEqual([
      ["处理器 1 核 ›12%", "处理器已用 12% (1 核)，在设置中打开 cx 的电脑", "12%"], ["内存 1 GB ›40%", "内存已用 40% (1 GB)，在设置中打开 cx 的电脑", "40%"],
      ["存储 6 GB ›31%", "存储已用 31% (6 GB)，在设置中打开 cx 的电脑", "31%"],
    ]);
    document.body.replaceChildren();
    // Each bar warns from 80% and fails from 90%, from the platform's own figure.
    made({ parts: { cpu: 79, memory: 92, storageGb: 6, storage: 95 } });
    expect([...document.querySelectorAll(".cw-part")].map((part) => part.className)).toEqual(["cw-part cz-go", "cw-part cz-go failed", "cw-part cz-go failed"]);
    document.body.replaceChildren();
    made({ parts: { cpu: 80, memory: 89 } });
    expect([...document.querySelectorAll(".cw-part")].map((part) => part.className)).toEqual(["cw-part cz-go warned", "cw-part cz-go warned", "cw-part cz-go"]);
    document.body.replaceChildren();
    // Off, the storage keeps the figure the platform read of it; the processor and the memory have none.
    made({ kind: "off", parts });
    expect(drawn()).toEqual([
      ["Processor 1 core ›", "Processor 1 core. Open cx's computer in Settings", undefined], ["Memory 1 GB ›", "Memory 1 GB. Open cx's computer in Settings", undefined],
      ["Storage 6 GB ›31%", "Storage, 31% used (6 GB). Open cx's computer in Settings", "31%"],
    ]);
    document.body.replaceChildren();
    // A storage whose size was not read is named alone, with its figure where that was read; a larger size is the account's.
    made({ parts: { storage: 8 }, size: { kind: "performance", cpus: 2, memoryMb: 4096 } });
    expect(drawn()).toEqual([["Processor 2 cores ›", "Processor 2 cores. Open cx's computer in Settings", undefined], ["Memory 4 GB ›", "Memory 4 GB. Open cx's computer in Settings", undefined],
      ["Storage ›8%", "Storage, 8% used. Open cx's computer in Settings", "8%"]]);
  });

  it("says 升级配置 beside the figure of a part read at 90% and over, inside its link, one at most and memory first, where a larger size is offered", () => {
    const hinted = (): (string | null | undefined)[][] => [...document.querySelectorAll<HTMLElement>(".cw-part")]
      .filter((part) => part.querySelector("[data-key='bigger']") !== null)
      .map((part) => [part.dataset["key"], part.querySelector(".cw-part-name")?.textContent, part.getAttribute("aria-label")]);
    const each = (parts: { readonly cpu: number; readonly memory: number }, more: Partial<WindowView> = {}): (string | null | undefined)[][] => {
      document.body.replaceChildren();
      made({ larger: true, parts: { ...parts, storageGb: 6, storage: 95 }, ...more }, "zh");
      return hinted();
    };
    // on-full: the memory at 93%, its hint beside its figure and named with it; no line of its own, no link but the part's.
    expect(each({ cpu: 12, memory: 93 })).toEqual([["part-memory", "内存 1 GB ›升级配置", "内存已用 93% (1 GB)，升级配置，在设置中打开 cx 的电脑"]]);
    expect(document.querySelectorAll(".cw-parts a, .cw-parts button")).toHaveLength(3);
    // on-full-cpu: the processor at 96%.
    expect(each({ cpu: 96, memory: 40 }).map(([key]) => key)).toEqual(["part-cpu"]);
    // on-mixed: the processor warns at 85%, the memory is red at 93%: the memory's alone.
    expect(each({ cpu: 85, memory: 93 }).map(([key]) => key)).toEqual(["part-memory"]);
    // Both red: one hint, the memory's. 89% is not red; storage full never has one.
    expect(each({ cpu: 100, memory: 100 }).map(([key]) => key)).toEqual(["part-memory"]);
    expect(each({ cpu: 89, memory: 89 })).toEqual([]);
    // on-full-largest, and an organisation's computer that is offered no size: the bars red, no hint.
    expect(each({ cpu: 100, memory: 100 }, { larger: false })).toEqual([]);
    expect(document.querySelectorAll(".cw-part.failed")).toHaveLength(3);
    expect(each({ cpu: 100, memory: 100 }, { larger: undefined })).toEqual([]);
    // Off, no part runs, so none.
    expect(each({ cpu: 100, memory: 100 }, { kind: "off" })).toEqual([]);
    // In English, beside the figure as well.
    document.body.replaceChildren();
    made({ larger: true, parts: { cpu: 96, memory: 40 } });
    expect(hinted()).toEqual([["part-cpu", "Processor 1 core ›Upgrade size", "Processor, 96% used (1 core), Upgrade size. Open cx's computer in Settings"]]);
  });

  it("colours the storage's bar by the same rule as the other two, at 80% and 90%, and never gives it 升级配置, on or off, at any size", () => {
    const storage = (share: number, more: Partial<WindowView> = {}): (string | boolean | undefined)[] => {
      document.body.replaceChildren();
      made({ larger: true, parts: { cpu: 12, memory: 40, storageGb: 6, storage: share }, ...more }, "zh");
      const part = document.querySelector<HTMLElement>("[data-key='part-storage']");
      return [part?.className, part?.querySelector("[data-key='bigger']") !== null, part?.querySelector(".cw-value")?.className ?? part?.lastElementChild?.className];
    };
    const figure = storage(31)[2];
    expect([79, 80, 89, 90, 100].map((share) => storage(share).slice(0, 2))).toEqual([
      ["cw-part cz-go", false], ["cw-part cz-go warned", false], ["cw-part cz-go warned", false], ["cw-part cz-go failed", false], ["cw-part cz-go failed", false]]);
    // The figure keeps its colour: the class that colours it is the bar's part, not the figure's.
    expect(storage(100)[2]).toBe(figure);
    // All three red: one hint, the memory's.
    document.body.replaceChildren();
    made({ larger: true, parts: { cpu: 100, memory: 100, storageGb: 6, storage: 100 } }, "zh");
    expect([...document.querySelectorAll(".cw-part.failed")]).toHaveLength(3);
    expect([...document.querySelectorAll<HTMLElement>("[data-key='bigger']")].map((hint) => hint.closest<HTMLElement>(".cw-part")?.dataset["key"])).toEqual(["part-memory"]);
    // Off: the storage keeps its read figure and its colour, still with no hint; nor on the largest size or an organisation's computer.
    expect(storage(93, { kind: "off" }).slice(0, 2)).toEqual(["cw-part cz-go failed", false]);
    expect(storage(93, { larger: false }).slice(0, 2)).toEqual(["cw-part cz-go failed", false]);
    expect(storage(93, { larger: undefined }).slice(0, 2)).toEqual(["cw-part cz-go failed", false]);
  });

  it("leads each part to its row of 「cx 的电脑」 in Settings: the processor and the memory to 配置, the storage to 存储, and closes as it goes", () => {
    const { closed } = made({ parts: { cpu: 12, memory: 40, storageGb: 6, storage: 31 } }, "zh");
    expect([...document.querySelectorAll<HTMLAnchorElement>("a.cw-part")].map((part) => [part.dataset["key"], part.getAttribute("href")])).toEqual([
      ["part-cpu", "#/settings/computer/size"], ["part-memory", "#/settings/computer/size"], ["part-storage", "#/settings/computer/storage"],
    ]);
    document.querySelector<HTMLAnchorElement>("[data-key='part-storage']")!.addEventListener("click", (event) => event.preventDefault());
    document.querySelector<HTMLAnchorElement>("[data-key='part-storage']")!.click();
    expect(closed).toEqual([false]);
  });


  it("offers what can be pressed in each state, and nothing while something asked has not answered", () => {
    const kinds = ["on", "working", "off", "balance", "starting", "restarting", "closing", "failed", "refused", "unknown", "unreachable", "unreachableAsleep"] as const;
    expect(Object.fromEntries(kinds.map((kind) => [kind, windowActs(kind, false).join()]))).toEqual({
      on: "off,restart", working: "stopOff,stopRestart", off: "on", balance: "", starting: "", restarting: "", closing: "on", failed: "retry,help", refused: "retry,help", unknown: "", unreachable: "", unreachableAsleep: "",
    });
    expect(windowActs("on", true)).toEqual([]);
    const { does } = made({ kind: "working" });
    for (const one of document.querySelectorAll<HTMLElement>("[data-act]")) one.click();
    expect(does).toEqual<WindowAct[]>(["stopOff", "stopRestart"]);
  });

  it("says 正在关机 while the computer switches off, with 开机 in its place taking no press, and the same key pressable once it is off, the focus kept on it", () => {
    const one = made({ kind: "closing", asking: true, left: undefined, state: "sleeping", dot: "starting" }, "zh");
    const key = at("[data-act='on']");
    expect([at(".cw-state").textContent, at(".cw-when").textContent, key.textContent, key.getAttribute("aria-disabled"), key.className, key.hasAttribute("disabled")]).toEqual(["正在关机", "", "开机", "true", "f-btn primary", false]);
    key.focus();
    key.click();
    expect(one.does).toEqual([]);
    one.window.update({ ...VIEW, lang: "zh", kind: "off", left: undefined, state: "sleeping", dot: "asleep" });
    const now = at("[data-act='on']");
    expect([at(".cw-state").textContent, now.getAttribute("aria-disabled"), document.activeElement === now]).toEqual(["已关机", null, true]);
    now.click();
    expect(one.does).toEqual(["on"]);
  });

  it("says the time left in the window's own words, an hour and more in hours and minutes, the last minute alone, and nothing kept on or off", () => {
    const say = (key: Parameters<typeof text>[1], values?: Readonly<Record<string, string | number>>): string => text("en", key, values);
    expect([5, 45, 60, 120, 90, 480].map((n) => span(n, say))).toEqual(["5 min", "45 min", "1 hr", "2 hr", "1 hr 30 min", "8 hr"]);
    expect([countdown("on", 44.2 * 60_000, say), countdown("on", 60_000, say), countdown("on", undefined, say), countdown("off", 600_000, say)])
      .toEqual(["Switches off in 44 min", "Switches off in under a minute", "", ""]);
  });

  it("draws the state alone, with no rows, out of reach", () => {
    for (const kind of ["unreachable"] as const) {
      made({ kind }, "zh");
      expect([at(".cw-state").textContent, document.querySelectorAll(".cw-main > li").length], kind).toEqual(["正在重新连接", 0]);
      document.body.replaceChildren();
    }
  });

  it("writes 永不 and a time with no line under either (ruled 2026-11-13); a choice stands chosen while it is written", async () => {
    const one = made({}, "zh", true);
    option("never").click();
    expect([one.written, chosen(), help()]).toEqual([[[true, 10]], "never", undefined]);
    one.answer(true);
    await settle();
    one.window.update({ ...VIEW, lang: "zh", awake: { on: true, minutes: 10 } });
    option("30").click();
    expect([one.written.at(-1), chosen(), help()]).toEqual([[false, 30], "30", undefined]);
  });

  it("goes back to the time in force and says so where the platform did not write a choice down", async () => {
    const one = made({}, "en", true);
    option("60").click();
    one.answer(false);
    await settle();
    expect([chosen(), help()]).toEqual(["10", text("en", "sw.moveFailed")]);
  });

  it("opens 自定义 on the time in force, takes a typed time on Enter, and refuses one outside 5 to 480 in words, the time in force kept", async () => {
    const one = made({ awake: { on: false, minutes: 30 } }, "zh");
    option("custom").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    option("custom").click();
    const field = (): HTMLInputElement => at(".cw-num") as HTMLInputElement;
    expect([field().value, document.activeElement === field(), one.written]).toEqual(["30", true, []]);
    for (const wrong of ["2", "481", "4.5", "ten", ""]) {
      typeIn(wrong);
      expect([help(), field().getAttribute("aria-invalid"), one.written], wrong).toEqual(["请输入 5 到 480 之间的分钟数。", "true", []]);
    }
    typeIn("45");
    await settle();
    expect([one.written, help(), field().getAttribute("aria-invalid")]).toEqual([[[false, 45]], undefined, null]);
    // A time no option offers opens on 自定义, holding it.
    document.body.replaceChildren();
    made({ awake: { on: false, minutes: 45 } });
    expect([chosen(), (at(".cw-num") as HTMLInputElement).value]).toEqual(["custom", "45"]);
    expect([typedMinutes(" 5 "), typedMinutes("480"), typedMinutes("0480"), typedMinutes("4")]).toEqual([5, 480, undefined, undefined]);
  });

  it("drops words not entered, and the warning about them, where the next drawing has no field: an answer saying 永不, the reconnecting view", () => {
    for (const away of [{ awake: { on: true, minutes: 30 } }, { kind: "unreachable" as const }]) {
      const one = made({ awake: { on: false, minutes: 30 } }, "zh");
      option("custom").click();
      typeIn("4");
      expect(help()).toBe("请输入 5 到 480 之间的分钟数。");
      one.window.update({ ...VIEW, lang: "zh", awake: { on: false, minutes: 30 }, ...away });
      expect([document.querySelector(".cw-num"), help() ?? null], JSON.stringify(away)).toEqual([null, null]);
      one.window.update({ ...VIEW, lang: "zh", awake: { on: false, minutes: 30 } });
      expect([chosen(), help(), one.written], JSON.stringify(away)).toEqual(["30", undefined, []]);
      document.body.replaceChildren();
    }
  });

  it("takes a typed time as the seller leaves a field still on the page, not again what Enter took, and nothing from a field a redraw took away", async () => {
    const one = made({ awake: { on: false, minutes: 30 } });
    option("custom").click();
    const field = at(".cw-num") as HTMLInputElement;
    field.dispatchEvent(new FocusEvent("focus"));
    field.value = "45";
    field.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    typeIn("50");
    field.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    expect(one.written).toEqual([[false, 45], [false, 50]]);
    // Taken away as a redraw takes it, the field's change still comes: what is in it is dropped.
    const gone = at(".cw-num") as HTMLInputElement;
    gone.dispatchEvent(new FocusEvent("focus"));
    gone.value = "6";
    gone.addEventListener("change", () => gone.closest("li")!.remove(), { once: true, capture: true });
    gone.dispatchEvent(new Event("change", { bubbles: true }));
    gone.dispatchEvent(new FocusEvent("blur"));
    await settle();
    expect(one.written).toHaveLength(2);
  });

  it("reaches 自定义 by the arrows without entering its field: the options are one group of radios, one Tab stop", () => {
    made({}, "zh");
    const radios = [...document.querySelectorAll<HTMLElement>("[role=radiogroup] [role=radio]")];
    expect([radios.length, radios.filter((one) => one.tabIndex === 0).length, at("[role=radiogroup]").getAttribute("aria-label")]).toEqual([5, 1, "自动关机"]);
    option("10").focus();
    option("10").dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
    expect([chosen(), document.activeElement === option("custom"), document.querySelector(".cw-num") !== null]).toEqual(["custom", true, true]);
  });

  it("says nothing under a choice made while the computer is off (ruled 2026-11-13: a note that it takes effect at the next start says nothing)", async () => {
    const one = made({ kind: "off", left: undefined }, "zh");
    option("30").click();
    await settle();
    expect([one.written, help()]).toEqual([[[false, 30]], undefined]);
  });

  it("stands the month's link alone where the month is not read, and no price where the platform names none", () => {
    made({ month: undefined, hour: undefined }, "zh");
    const money = [...document.querySelectorAll(".cw-main > li")].at(-3)!;
    expect([money.querySelector(".cw-text")!.textContent, money.querySelector("a")!.textContent]).toEqual(["", "用量 ›"]);
  });

  it("says 每小时 $0 where the computer costs nothing: off, out of balance, failed, refused; the price while it switches on or off", () => {
    const rate = (): string => [...document.querySelectorAll(".cw-main > li")].at(-3)!.querySelector(".cw-text")!.textContent ?? "";
    for (const [kind, said] of [["off", "每小时 $0"], ["balance", "每小时 $0"], ["failed", "每小时 $0"], ["refused", "每小时 $0"], ["closing", "每小时 $0.02"], ["starting", "每小时 $0.02"], ["on", "每小时 $0.02"]] as const) {
      document.body.replaceChildren();
      made({ kind }, "zh");
      expect([kind, rate()]).toEqual([kind, said]);
    }
  });

  it("says a new version waits in the band, under the state beside 重启, on a computer kept on that runs, and on no other", () => {
    made({ newer: true, awake: { on: true, minutes: 10 } }, "zh");
    // Ruled 2026-11-13: no row of its own; it stands where other computers say when they switch off.
    expect([at(".cw-say .cw-newer").hidden, at(".cw-say .cw-newer").textContent, at(".cw-when").hidden]).toEqual([false, "有新版本，重启后生效。", true]);
    expect(at(".cw-main").textContent).not.toContain("有新版本");
    expect(at(".cw-foot").textContent).toContain("重启");
    for (const view of [{ newer: true }, { newer: true, awake: { on: true, minutes: 10 }, kind: "off" as const }]) {
      document.body.replaceChildren();
      made(view, "zh");
      expect([at(".cw-newer").hidden, at(".cw-newer").textContent]).toEqual([true, ""]);
    }
  });

  it("closes on its close mark with the focus back, and on a link without", () => {
    const one = made();
    at(".sw-close").click();
    at("[data-key='usage']").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(one.closed).toEqual([true, false]);
  });
});
