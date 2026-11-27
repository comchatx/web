import { h, svg, type Child } from "./dom.js";
import { redrawTip, tip } from "./forms.js";
import { saveBlob } from "./page-save.js";
import type { StringKey } from "./strings.js";

/** How long a press of 复制 shows its tick, as the chat's row does. */
export const COPIED_MS = 1500;

type Say = (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;

const icon = (...paths: readonly string[]): SVGElement => svg("svg", { class: "icon", viewBox: "0 0 24 24", "aria-hidden": "true" }, ...paths.map((d) => svg("path", { d })));
export const reloadIcon = (): SVGElement => icon("M19.5 12a7.5 7.5 0 1 1-2.2-5.3", "M19.5 4.5v4.5H15");
const copyIcon = (): SVGElement => icon("M9 9h10v11H9z", "M5 15V4h10");
const tickIcon = (): SVGElement => icon("M5 12.5l4.5 4.5L19 7.5");
const downloadIcon = (): SVGElement => icon("M12 4v11", "M7.5 10.5L12 15l4.5-4.5", "M5 19.5h14");

/** An icon button of the row, its word its name and its tip. */
const press = (say: Say, word: StringKey, mark: SVGElement, act: () => void): HTMLButtonElement => {
  const button: HTMLButtonElement = tip(h("button", { type: "button", class: "page-icon f-icon", "aria-label": say(word), onclick: act }, mark), () => [button.getAttribute("aria-label") ?? ""]);
  return button;
};

/** 重新加载, first in the row. */
export const reloadButton = (say: Say, act: () => void): HTMLButtonElement => press(say, "frame.reload", reloadIcon(), act);

/**
 * 复制: what `take` hands the clipboard, then the tick and 已复制 for a moment, to the eye, to the tip and to a screen reader, as the chat's
 * row does. A clipboard that refuses leaves the button as it was.
 */
export function copyButton(say: Say, take: () => Promise<void>, announce: (words: string) => void): HTMLButtonElement {
  let back: ReturnType<typeof setTimeout> | undefined;
  const draw = (mark: SVGElement, word: "quote.copy" | "quote.copied"): void => { button.replaceChildren(mark); button.setAttribute("aria-label", say(word)); redrawTip(); };
  const button = press(say, "quote.copy", copyIcon(), () => {
    void take().then(() => {
      draw(tickIcon(), "quote.copied");
      announce(say("quote.copied"));
      clearTimeout(back);
      back = setTimeout(() => draw(copyIcon(), "quote.copy"), COPIED_MS);
    }, () => {});
  });
  return button;
}

/** 下载: the file, under its own name, as the browser saves any download. */
export const downloadButton = (say: Say, take: () => Promise<{ readonly name: string; readonly blob: Blob }>): HTMLButtonElement =>
  press(say, "board.download", downloadIcon(), () => { void take().then(({ name, blob }) => saveBlob(name, blob), () => {}); });

/**
 * The box of the row, as an address bar is drawn and never pressed or typed in: whose, then which. A path gives up its start so the file's
 * own name stays in sight; a plugin's name gives up its end. The whole of either is its tip.
 */
export function addressBox(first: Child, where: string, path: boolean): HTMLElement {
  const place = h("span", { class: path ? "address-where address-path" : "address-where" }, path ? h("bdi", {}, where) : where);
  tip(place, where);
  return h("div", { class: "address-box" }, first, place);
}

/** Whose page, as the box's first part: cx, a plugin of ours, or a third party's. */
export const addressWho = (words: string): HTMLElement => h("span", { class: "address-who" }, words);

/** A file's bytes, as the box hands them in base64, as a file the browser can take. */
export function bytesOf(base64: string, type = "application/octet-stream"): Blob {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let at = 0; at < raw.length; at++) bytes[at] = raw.charCodeAt(at);
  return new Blob([bytes], { type });
}

/** A picture on the clipboard, as the clipboard takes pictures: drawn again as a PNG where it is another kind. */
export async function copyPicture(blob: Blob): Promise<void> {
  const png = blob.type === "image/png" ? blob : await new Promise<Blob>((done, fail) => {
    void createImageBitmap(blob).then((bitmap) => {
      const canvas = h("canvas", { width: String(bitmap.width), height: String(bitmap.height) }) as HTMLCanvasElement;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
      canvas.toBlob((made) => (made === null ? fail(new Error("no picture")) : done(made)), "image/png");
    }, fail);
  });
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}
