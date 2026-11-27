import domains from "free-email-domains";

/** The free and disposable mailboxes' domains, from `free-email-domains`: the ecosystem's list, which holds QQ, 163, Outlook and Gmail. */
const PUBLIC: ReadonlySet<string> = new Set(domains);

/** Whether an address is at a public mailbox, by its domain after the last `@`, any case. An organization is bought from a work address. */
export const isPublicMailbox = (address: string): boolean => PUBLIC.has(address.slice(address.lastIndexOf("@") + 1).trim().toLowerCase());
