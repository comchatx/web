// The chat's stream alone, as the page draws it, on the real stream model and the site's own styles: a conversation the test writes.
import { EMPTY, reduce, type StreamEvent, type StreamState } from "../stream-model.js";
import { StreamView } from "../stream-view.js";
import { text } from "../strings.js";

const scroller = document.querySelector<HTMLElement>(".scroller")!;
const view = new StreamView({ say: (key, values) => text("en", key, values), now: () => 0, day: () => "Today" });
scroller.append(view.element);
scroller.addEventListener("scroll", () => view.scrolled());
const resized = new ResizeObserver(() => view.resized());
resized.observe(scroller);
resized.observe(view.element);

let state: StreamState = EMPTY;
let seq = 0;
const add = (role: "user" | "assistant", content: string): void => {
  seq++;
  state = reduce(state, { event: "entry", id: `${"a".repeat(32)}:${seq}`, data: { epoch: "a".repeat(32), seq, body: { form: "message", role, content: role === "assistant" ? [{ form: "text", text: content }] : content, stopReason: "stop" } } } as unknown as StreamEvent);
};

/** Questions and answers of four paragraphs each, drawn at once. */
(window as unknown as { fill: (pairs: number) => void }).fill = (pairs) => {
  for (let at = 0; at < pairs; at++) {
    add("user", `Question ${at}`);
    add("assistant", Array.from({ length: 4 }, (_, n) => `Paragraph ${at}.${n}: A seller reads the listing and compares the stock across several marketplaces before deciding what to do next. More detail makes the line wrap a few times.`).join("\n\n"));
  }
  view.update(state);
};

/** A turn the test plays, event by event, as the stream would bring it: each event is reduced and drawn. */
(window as unknown as { feed: (events: readonly unknown[]) => void }).feed = (events) => {
  for (const one of events) {
    const event = one as { event: string; data?: { seq?: number } };
    if (event.event === "entry") seq = Math.max(seq, event.data?.seq ?? 0);
    state = reduce(state, event as StreamEvent);
  }
  view.update(state);
};
(window as unknown as { next: () => number }).next = () => seq + 1;
