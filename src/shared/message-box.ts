/** The send mark's strokes, on a 24-unit square: the chat's control draws them, and so does a page's box. */
export const SEND_MARK: readonly string[] = Object.freeze(["M9 10l-4 4 4 4", "M20 5v6a3 3 0 0 1-3 3H5"]);

/**
 * What the box reads of the page's own nodes, named by shape: this file is read by the platform too, which has no DOM, and a page's
 * frame is handed the function's source. A key event is read for its key, its Shift, Ctrl, ⌘ and Alt, whether an input method is choosing,
 * and its repeat.
 */
type Listener = (event: any) => void;
type BoxNode = { append(...nodes: never[]): void; setAttribute(name: string, value: string): void };
export type BoxField = BoxNode & {
  value: string; rows: number; dir: string; placeholder: string; addEventListener(type: string, listener: Listener): void;
  readonly ownerDocument: { execCommand(command: "insertText", show: false, value: string): boolean };
};
type BoxControl = BoxNode & { type: string; title: string; disabled: boolean; addEventListener(type: string, listener: Listener): void };
export type BoxDocument = {
  createElement(tag: "textarea"): BoxField;
  createElement(tag: "button"): BoxControl;
  createElement(tag: "div"): BoxNode;
  createElementNS(namespace: "http://www.w3.org/2000/svg", tag: string): BoxNode;
};
type BoxKey = { readonly key: string; readonly shiftKey: boolean; readonly ctrlKey: boolean; readonly metaKey: boolean; readonly altKey: boolean; readonly isComposing: boolean; readonly keyCode: number; readonly repeat: boolean; preventDefault(): void };

/** What a message box is given: its field, or the words of a new one, what a send does, and, for a box with a control of its own, that control's name and mark. */
export type MessageBoxGiven = {
  readonly field?: BoxField;
  readonly placeholder?: string;
  readonly send: () => unknown;
  /** Read first on every key in the field: a key it takes is the caller's, and the box does nothing with it. */
  readonly before?: (event: Parameters<Listener>[0]) => boolean;
  readonly control?: { readonly name: string; readonly mark: readonly string[] };
};

/**
 * The chat's message box (`parts/chat-page.md`): several lines, a bare Enter sends, Shift+Enter breaks the line, Enter with Ctrl, ⌘ or Alt,
 * Shift held or not, breaks it too and does nothing else, a held Enter sends once, and nothing is sent while an input method is choosing (`isComposing`, or the key code 229 an input method's Enter carries in Safari). The
 * chat's box, the board's answer field and a board's page each draw theirs by this one function; a page is handed it by its source
 * (`src/platform/pages-proxy.ts`), so it reads nothing from outside itself. With a control, the control is off while the field holds
 * nothing but blanks, as the chat's Send is, and a press on it sends; Enter sends then as the control does, and a blank Enter does nothing.
 */
export function messageBox(doc: BoxDocument, given: MessageBoxGiven): { readonly element: BoxNode; readonly field: BoxField; readonly control: BoxControl | undefined; readonly update: () => void } {
  const field = given.field ?? doc.createElement("textarea");
  if (given.field === undefined) {
    field.rows = 2;
    field.dir = "auto";
    if (given.placeholder !== undefined) field.placeholder = given.placeholder;
  }
  let control: BoxControl | undefined;
  if (given.control !== undefined) {
    control = doc.createElement("button");
    control.type = "button";
    control.setAttribute("aria-label", given.control.name);
    control.title = given.control.name;
    const mark = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    mark.setAttribute("viewBox", "0 0 24 24");
    mark.setAttribute("aria-hidden", "true");
    for (const d of given.control.mark) {
      const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      mark.append(path as never);
    }
    control.append(mark as never);
    control.addEventListener("click", () => { if (field.value.trim() !== "") given.send(); });
  }
  const update = (): void => { if (control !== undefined) control.disabled = field.value.trim() === ""; };
  field.addEventListener("input", update);
  field.addEventListener("keydown", (event: BoxKey) => {
    if (given.before?.(event) === true) return;
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
    // A browser's field breaks the line only at Shift+Enter: with Ctrl, ⌘ or Alt the box breaks it by the browser's own editing, so its
    // Undo brings back a selection the line replaced.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      event.preventDefault();
      field.ownerDocument.execCommand("insertText", false, "\n");
      return;
    }
    if (event.shiftKey) return;
    event.preventDefault();
    // A box with a control of its own sends at Enter only what its control would: nothing while the field holds only blanks.
    if (!event.repeat && (control === undefined || field.value.trim() !== "")) given.send();
  });
  update();
  let element: BoxNode = field;
  if (control !== undefined) {
    element = doc.createElement("div");
    element.append(field as never, control as never);
  }
  return { element, field, control, update };
}
