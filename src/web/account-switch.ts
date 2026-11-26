import type { Spaces } from "./backend.js";
import { h } from "./dom.js";
import { tick, tip } from "./forms.js";

export const firstLetter = (words: string): string => [...words.trim()][0]?.toUpperCase() ?? "";

/** The account in use as a person reads it: the organisation's name, or 个人账户 for their own. */
export const inUseName = (spaces: Spaces, own: string): string => spaces.organizations.find((one) => one.id === spaces.active)?.name ?? own;

/** The accounts worth a switch: a sign-in that holds an organisation, which is always beside the person's own. */
export const switchable = (spaces: Spaces | undefined): Spaces | undefined => (spaces !== undefined && spaces.organizations.length > 0 ? spaces : undefined);

export type AccountGroup = {
  readonly spaces: Spaces;
  /** 个人账户, the own account's row. */
  readonly own: string;
  /** Whose the own account is, the letter of its round mark. */
  readonly who: string;
  /** 切换账户, the group's spoken name. */
  readonly label: string;
  /** Switches to an account not in use: an organisation's id, or `null` for the person's own. */
  readonly use: (organization: string | null) => void;
};

/**
 * The accounts one sign-in holds, as a group of the set's menu (Claude's account menu): each organisation, a square mark of its name's
 * first letter, then the person's own account, a round mark of theirs; the one in use carries the set's tick, and the menu opens on it.
 * A press on the one in use does nothing beyond the menu's closing. A name the row cuts shows whole in a tip. The corner's menu and the
 * plans page's head draw this one group.
 */
export function accountGroup({ spaces, own, who, label, use }: AccountGroup): HTMLElement {
  const row = (id: string | null, name: string, letter: string): HTMLElement => {
    const words = h("span", { class: "f-words" }, name);
    return tip(h("button", { type: "button", class: "f-menu-row", role: "menuitemradio", tabindex: "-1", "aria-checked": String(id === spaces.active),
      onclick: () => { if (id !== spaces.active) use(id); } },
      h("span", { class: id === null ? "f-account-mark person" : "f-account-mark", "aria-hidden": "true" }, firstLetter(letter)), words, tick()),
      () => (words.scrollWidth > words.clientWidth + 1 ? [name] : []));
  };
  return h("div", { class: "f-accounts", role: "group", "aria-label": label },
    ...spaces.organizations.map((one) => row(one.id, one.name, one.name)), row(null, own, who));
}
