/** The platform's mark on an answer given after the provider accepted the session; the pages count no other as proof that the session is good. */
export const SESSION_HEADER = "x-cmx-session";
/** The platform's mark in the page it serves to a request that carries a session: the page may draw its frame before `/me` answers. */
export const SIGNED_IN_META = "cmx-signed-in";
/**
 * The global the platform's session script sets for the pages: the session token, whether a session stands, and the person's photo, asked
 * of the identity SDK it loads.
 */
export const SESSION_PORTS = "cmxSession";
/** The event the session script dispatches on the page's global whenever the identity SDK says what it holds has changed, once loaded. */
export const SESSION_CHANGED = "cmx-session";
