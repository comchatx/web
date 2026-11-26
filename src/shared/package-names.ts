export const NPM_SCOPE = "@comchatx";

/**
 * The names our organization published bare before the scope's rule (ruled 2026-10-20), as the organization's list holds them: npm lets
 * no one else publish under one, so each is ours as the scope is. A package of ours published from now is scoped.
 */
const PUBLISHED_BARE: readonly string[] = Object.freeze(["cx-sources", "cx-keepa", "cx-amazon-sp-api", "cx-amazon-seller", "cx-feishu", "cx-listing-playbook"]);

/**
 * Whether an npm name is ours, the one answer the box, the platform and the page give: the scope, which only our organization can
 * publish under, or a name it published bare. The box routes a package's MCP source with the tenant's credentials only for one.
 */
export const isOurs = (name: string): boolean => name.startsWith(`${NPM_SCOPE}/`) || PUBLISHED_BARE.includes(name);

/**
 * cx Core Bundle, what a new account starts with, in the order its first open installs them, each by its npm name: who cx is, then
 * Topics, then the board's base and its to-do and question module, then pi-web-access, which searches and reads the web with no key, then
 * billion-context, which keeps a long conversation inside a small context by compressing what came before. The platform writes one
 * install of each, `npm:` and its name with no version, into the account's waiting list when it makes the account's row, and never
 * again, so a seller who removes one keeps it removed.
 */
export const DEFAULT_PACKAGES: readonly string[] = Object.freeze(["@comchatx/cx-assistant", "@comchatx/cx-topics", "@comchatx/cx-board", "@comchatx/cx-board-tasks", "pi-web-access", "billion-context"]);

/** The source a default's install names: the registry's current version, as every other `npm:` record names it. */
export const defaultSource = (name: string): string => `npm:${name}`;
