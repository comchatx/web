import { SESSION_CHANGED, SESSION_PORTS } from "../shared/session-mark.js";
import type { Spaces } from "./backend.js";

type SessionPorts = {
  readonly token?: () => Promise<unknown> | undefined;
  readonly session?: () => boolean;
  readonly spaces?: () => Promise<Spaces | undefined>;
  readonly use?: (organization: string | null) => Promise<unknown>;
  readonly photo?: () => unknown;
  readonly setPhoto?: (file: Blob | null) => Promise<unknown>;
};
export type PagePorts = {
  readonly token: () => Promise<unknown> | undefined;
  readonly session: () => boolean;
  readonly spaces: () => Promise<Spaces | undefined>;
  readonly use: (organization: string | null) => Promise<unknown>;
  readonly photo: () => string | undefined;
  readonly setPhoto: (file: Blob | null) => Promise<void>;
  readonly watchPhoto: (changed: () => void) => void;
};

/** Where a switch of account leaves its word for the next load, which takes it and gives the keyboard back to the corner. */
export const SWITCHED = "cmx-switched";

/**
 * The page's identity ports, from the global the platform's session script sets: read when each is called, since that script runs after
 * the pages' own. Where it is not there, the token port answers nothing at once, so the request is not held, no session stands, no photo
 * is held and a photo set is refused; the accounts and the switch wait for it until the document has been read, and past that hold no
 * account and switch nothing.
 */
export function sessionPorts(scope: object = globalThis): PagePorts {
  const ports = (): SessionPorts | undefined => (scope as Record<string, SessionPorts | undefined>)[SESSION_PORTS];
  // The session script is deferred after the pages' own, which wire these ports while the document is still being read: every deferred
  // script has run, or failed, by the document's DOMContentLoaded, so a read of the accounts asked before the script waits for that and
  // meets the SDK whatever their order, and no frame or picture still loading holds it.
  const window = scope as { readonly document?: Document; readonly addEventListener?: Window["addEventListener"] };
  const read: Promise<unknown> = window.document === undefined || window.document.readyState === "complete"
    ? Promise.resolve() : new Promise((done) => window.addEventListener?.("DOMContentLoaded", done, { once: true }));
  const published = async (): Promise<SessionPorts | undefined> => {
    if (ports() === undefined) await read;
    return ports();
  };
  return {
    token: () => ports()?.token?.(),
    session: () => ports()?.session?.() === true,
    spaces: async () => await (await published())?.spaces?.(),
    use: async (organization) => await (await published())?.use?.(organization),
    photo: () => { const url = ports()?.photo?.(); return typeof url === "string" && url.startsWith("https://") ? url : undefined; },
    setPhoto: async (file) => { const set = ports()?.setPhoto; if (set === undefined) throw new Error("no identity script"); await set(file); },
    watchPhoto: (changed) => { (scope as Partial<EventTarget>).addEventListener?.(SESSION_CHANGED, () => changed()); },
  };
}
