import { BOARD_READ_MAX_BYTES } from "../shared/board.js";
import { BoardRefused } from "./backend.js";
import { h } from "./dom.js";

/**
 * A file a board's page hands the seller (`parts/board-page.md` §1), saved from the app's own origin: its words as UTF-8 under the name the
 * page gave, at most `BOARD_READ_MAX_BYTES`, `BoardRefused("too_large")` over it. The browser saves it as it saves any download.
 */
export function saveFile(name: string, text: string): void {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > BOARD_READ_MAX_BYTES) throw new BoardRefused("too_large");
  saveBlob(name, new Blob([bytes], { type: "application/octet-stream" }));
}

/** A file the board holds, saved under its name as the browser saves any download. */
export function saveBlob(name: string, blob: Blob): void {
  const address = URL.createObjectURL(blob);
  const link = h("a", { href: address, download: name, hidden: true });
  document.body.append(link);
  link.click();
  link.remove();
  // The browser has taken the file once the press's download began; the address is let go a while after, never while it is read.
  setTimeout(() => URL.revokeObjectURL(address), 60_000);
}
