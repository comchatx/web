// The page is served under the preview's content policy, which drops a style attribute: the bench's own layout is in its sheet.
// A bench for the set of controls in `forms.ts`, drawn with the site's own sheets, for `forms.layout.ts`: a control in each corner, a
// card, a choice, a select and a dialog with a control at its far edge. No page of the product draws these yet.
import { h } from "../dom.js";
import { choice, dialog, menu, menuRow, select, switchButton, tip, toast } from "../forms.js";

const Q = new URLSearchParams(location.search);
document.documentElement.dataset["theme"] = Q.get("theme") === "dark" ? "dark" : "light";
document.documentElement.lang = Q.get("lang") === "zh" ? "zh-CN" : "en";
const zh = Q.get("lang") === "zh";

const said: string[] = [];
const told = toast();
const corner = (id: string, words: string): HTMLButtonElement => tip(h("button", { id, type: "button", class: "f-icon", "aria-label": words }, "＋"), words);
const near = corner("tip-left", zh ? "添加文件" : "Add files");
const far = corner("tip-right", zh ? "关闭这一页并回到聊天页" : "Close this page and go back to the chat");
const opens = h("button", { id: "menu-button", type: "button", class: "f-btn" }, zh ? "更多" : "More");
const list = h("div", { id: "menu", class: "f-menu", role: "menu", "aria-label": zh ? "更多" : "More" },
  ...["Settings", "Usage", "Sign out"].map((name) => menuRow(name, () => said.push(name))));
menu(opens, list, { end: true });
const sort = select({ label: "Sort", values: ["Most used", "Newest", "Name", "Recently updated"], held: 0, take: (index) => said.push(`sort ${index}`) });
sort.button.id = "select";
const spans = ["15 minutes", "30 minutes", "1 hour", "3 hours", "24 hours", "48 hours", "7 days", "1 month", "1 year", "Today", "Yesterday", "This week", "Last week", "This month", "Last month", "This year", "Last year"];
const long = select({ label: "Span", values: spans, held: 4, take: (index) => said.push(`span ${index}`) });
long.button.id = "long";
const look = choice({ label: "Appearance", values: [{ name: zh ? "跟随系统" : "System" }, { name: zh ? "浅色" : "Light" }, { name: zh ? "深色" : "Dark" }], held: 1, take: (index) => said.push(`look ${index}`) });
look.element.id = "choice";
const kinds = choice({ label: "Kinds", values: ["All", "Extensions", "Skills", "Prompts"].map((name) => ({ name })), held: 0, take: () => {} });
kinds.element.id = "kinds";
const on = switchButton({ label: "Keepa", on: false, turn: (value) => said.push(`switch ${value}`) });
on.element.id = "switch";

const back = h("button", { id: "back", type: "button", class: "f-btn" }, zh ? "取消" : "Cancel");
const reading = tip(h("button", { id: "reading", type: "button", class: "f-quiet" }, zh ? "余额" : "Balance"),
  () => [h("p", {}, zh ? "余额 ¥40.00" : "Balance ¥40.00"), h("p", {}, zh ? "本月已用 ¥12.40" : "Used this month ¥12.40")], { card: true, says: true });
const go = h("button", { id: "go", type: "button", class: "f-btn primary", onclick: () => { box.close(); told.tell(zh ? "已移除。" : "Removed."); } }, zh ? "移除" : "Remove");
const box = h("dialog", { id: "dialog", class: "f-dialog", "aria-labelledby": "dialog-title" },
  h("h2", { id: "dialog-title" }, zh ? "移除 Keepa？" : "Remove Keepa?"), reading, h("p", {}, zh ? "cx 将不能再用它。" : "cx can no longer use it."), h("div", { class: "f-acts" }, back, go)) as HTMLDialogElement;
const open = dialog(box, back);
const opener = h("button", { id: "opener", type: "button", class: "f-btn", onclick: (event) => open(event.currentTarget as HTMLElement) }, zh ? "移除" : "Remove");
// Each control in the states the app's own button rules once reached: off and busy, which no pointer over them changes.
const states = h("div", { id: "states", class: "f-marks" },
  h("button", { id: "off-primary", type: "button", class: "f-btn primary", "aria-disabled": "true" }, zh ? "移除" : "Remove"),
  h("button", { id: "busy-primary", type: "button", class: "f-btn primary busy", "aria-busy": "true" }, h("span", { class: "f-word" }, zh ? "移除" : "Remove")),
  h("button", { id: "off-icon", type: "button", class: "f-icon", disabled: true, "aria-label": zh ? "更多" : "More" }, "＋"),
  h("button", { id: "off-select", type: "button", class: "f-select", disabled: true }, zh ? "最常用" : "Most used"),
  h("button", { id: "off-switch", type: "button", class: "f-switch", role: "switch", "aria-checked": "false", disabled: true, "aria-label": "Keepa" }, h("i", {})));
const card = h("div", { id: "card", class: "f-card" }, h("strong", {}, "Keepa"), h("div", {}, h("button", { id: "plain", type: "button", class: "f-btn" }, zh ? "更新" : "Update")));

document.body.append(near, far, h("main", {},
  h("button", { id: "plain-page", type: "button", class: "f-btn" }, zh ? "取消" : "Cancel"), card, states, look.element, kinds.element, sort.button, long.button, on.element, opener), opens, list, sort.list, long.list, box, told.element);
// A tipped control the test puts in a row of its own, to take away or hide from a script while its tip shows.
const tipped = (id: string): HTMLButtonElement => {
  const button = tip(h("button", { id, type: "button", class: "f-btn" }, id), zh ? "全屏" : "Full screen");
  document.querySelector("main")!.prepend(h("div", { id: `${id}-row` }, button));
  return button;
};
Object.assign(window, { __said: said, __tipped: tipped, __ready: true });
