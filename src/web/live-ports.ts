import { PlatformBackend } from "./platform-backend.js";
import { sessionPorts, SWITCHED } from "./session-ports.js";
import { SIGNED_IN_META } from "../shared/session-mark.js";
import { PAGES_ORIGIN_META } from "../shared/board.js";

const LEAVING = "cmx-leaving";
const RENEWING = "cmx-renewing";

/** The platform as a page it serves from its own origin reaches it: every answer is the platform's, and nothing canned is in the bundle. */
export const liveBackend = (): PlatformBackend => new PlatformBackend({
  fetch: (input, init) => fetch(input, init),
  eventSource: (url) => new EventSource(url),
  clientId: `web-${crypto.randomUUID()}`,
  signedInHint: () => document.querySelector(`meta[name="${SIGNED_IN_META}"]`) !== null,
  // The second site a board's page is drawn on, as the page at `/` names it; a name that is no https origin is none.
  ...((): { pagesOrigin?: string } => {
    const named = document.querySelector<HTMLMetaElement>(`meta[name="${PAGES_ORIGIN_META}"]`)?.content ?? "";
    return URL.canParse(named) && new URL(named).protocol === "https:" && new URL(named).origin === named ? { pagesOrigin: named } : {};
  })(),
  go: (url) => location.assign(url),
  leaving: {
    set: (everywhere) => sessionStorage.setItem(LEAVING, everywhere === true ? "everywhere" : "1"),
    take: () => { const back = sessionStorage.getItem(LEAVING); sessionStorage.removeItem(LEAVING); return back === "everywhere" ? back : back !== null; },
  },
  // The identity ports the session script sets: the session's token before each request, and whether a session stands after a 401.
  ...sessionPorts(),
  switching: {
    set: () => sessionStorage.setItem(SWITCHED, "1"),
    take: () => { const back = sessionStorage.getItem(SWITCHED) !== null; sessionStorage.removeItem(SWITCHED); return back; },
  },
  renewing: {
    set: (carried) => sessionStorage.setItem(RENEWING, carried),
    take: () => { const carried = sessionStorage.getItem(RENEWING) ?? undefined; sessionStorage.removeItem(RENEWING); return carried; },
  },
});

/** Where 跳过 on the road's plans leaves its word for the chat page's next load, which takes it. */
export const ROAD_SKIPPED = "cmx-road-skipped";
