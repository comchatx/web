// The tutorial's road (sheet 9: part one, 1.1–1.13 and 1.11′; part two on the Plugins page, 2.1–2.7; the last scene, 2.8): which step stands, read from what the page
// shows at each draw. Each step is the state the seller's last press left, so the road follows real presses and real answers, never a
// timer of its own beyond 1.1's.

/** Part two's three plugins, by the ids main's catalogue gives them: Keepa API, Amazon Seller Bundle, and Amazon SP-API, where the store connects. */
export const KEEPA_ID = "keepa";
export const SELLER_ID = "amazon-seller";
export const STORE_ID = "amazon-sp-api";

/** What the page shows that the road reads: the page, the Plugins page's view, the open card, cx's computer, and the account's plugins. */
export type Seen = {
  readonly page: "chat" | "plugins" | "other";
  /** On the Plugins page: its home view, 我的 (`yours`) or another, and whether cx Core Bundle's install card is open over it. */
  readonly view: "yours" | "other";
  readonly installCard: boolean;
  /** cx's computer's window, or cx's own card, open at its desk. */
  readonly opened: "computer" | "cx" | undefined;
  readonly power: "off" | "starting" | "on";
  /** Whether the account holds or waits on any package: none at the start; one once cx Core Bundle's press is written. */
  readonly some: boolean;
  /** The install card open over the Plugins page, by what it installs as its address names it (`p:keepa`, `b:amazon-seller`). */
  readonly card: string | undefined;
  /** The plugin whose own page is open, by its id, and whether that page is at its 设置. */
  readonly item: string | undefined;
  readonly settings: boolean;
  /** Part two's facts, each its own plugin's: Keepa API held or waiting, Amazon Seller Bundle held or waiting, a store connected. */
  readonly keepa: boolean;
  readonly seller: boolean;
  readonly store: boolean;
};

export type Step = "1.1" | "1.2" | "1.3" | "1.4" | "1.5" | "1.6" | "1.7" | "1.8" | "1.9" | "1.10" | "1.11" | "1.12" | "1.13" | "1.11′" | PartTwo;
/** Part two's steps on the Plugins page, and the last scene (2.8), which stands in the chat. */
export type PartTwo = "2.1" | "2.2" | "2.3" | "2.4" | "2.5" | "2.6" | "2.7" | "2.8";
/** Where the road is: not begun, at a step, or over on this page (`ended`), or closed for good (`closed`, 跳过 at the opening). */
export type At = Step | "ended" | "closed" | undefined;

/** How long cx sleeps at its desk at 1.1 before it wakes to lead (the prototype's play, 2.5 s). */
export const WAKE_MS = 2_500;

/** The road's first step for a due account: only at the state 1.1 draws, the chat with nothing installed and the computer off. */
export function begins(seen: Seen): boolean {
  return seen.page === "chat" && seen.opened === undefined && seen.power === "off" && !seen.some;
}

/**
 * The step after `at` for what the page shows now; `awake` is whether 1.1's sleep has passed. Each press moves one step on; a step
 * whose press is taken back (a closed window, a cancelled card) goes back to the step that asked for it.
 */
export function stepFor(at: Step, seen: Seen, awake: boolean): Step | "ended" {
  const started = seen.power !== "off";
  const chat = seen.page === "chat";
  switch (at) {
    case "1.1":
    case "1.2":
    case "1.3":
      if (started) return chat ? "1.4" : plugins(seen);
      if (seen.opened === "computer") return "1.3";
      return at === "1.1" && !awake ? "1.1" : "1.2";
    case "1.4":
      return chat ? (seen.some ? "1.9" : "1.4") : plugins(seen);
    case "1.5":
    case "1.6":
    case "1.7":
    case "1.8":
      return chat ? "1.9" : plugins(seen);
    case "1.9":
    case "1.10":
      if (seen.power === "on" && chat && seen.opened !== "cx") return "1.11";
      return seen.opened === "cx" ? "1.10" : at;
    // From the computer on, a step moves on by what the seller sends, or by 跳过; 插件 pressed at part one's end is part two's beginning.
    case "1.11":
    case "1.12":
      return at;
    case "1.13":
    case "1.11′":
      return chat ? at : partTwo(seen);
    // The last scene stays the chat's: on the Plugins page with a store connected nothing leads, and short of one part two's step does.
    case "2.8":
      return chat || seen.store ? "2.8" : partTwo(seen);
    default:
      if (!chat) return partTwo(seen);
      return heldOfPartTwo(seen) ? "2.8" : "1.13";
  }
}

/** Whether the account holds or waits on anything of part two's: Keepa API, Amazon Seller Bundle, or a store connected. */
export const heldOfPartTwo = (seen: Pick<Seen, "keepa" | "seller" | "store">): boolean => seen.keepa || seen.seller || seen.store;

/**
 * The question the last scene offers, by the signed prototype's names, read from what the account holds as the seller stands in the
 * chat: its store's own data with a store connected (Q1), its listing against Keepa's data with Amazon Seller Bundle and no store
 * (Q1n), and what Keepa alone answers otherwise (Q1k).
 */
export function questionFor(seen: Pick<Seen, "seller" | "store">): "Q1" | "Q1n" | "Q1k" {
  return seen.store ? "Q1" : seen.seller ? "Q1n" : "Q1k";
}

/**
 * Part two's step for what the Plugins page shows: Keepa API's + and its install card, Amazon Seller Bundle's + and its card, then
 * Amazon SP-API's card, its page's 设置 and 连接 there. Each is read from its own plugin's fact, so a fact that holds already is passed
 * and another plugin's card moves nothing; a card cancelled or a page left goes back to the step that asked for it. A store connected
 * is the last scene's turn, in the chat.
 */
export function partTwo(seen: Seen): PartTwo {
  if (seen.store) return "2.8";
  if (!seen.keepa) return seen.card === `p:${KEEPA_ID}` ? "2.2" : "2.1";
  if (!seen.seller) return seen.card === `b:${SELLER_ID}` ? "2.4" : "2.3";
  if (seen.item !== STORE_ID) return "2.5";
  return seen.settings ? "2.7" : "2.6";
}

const plugins = (seen: Seen): Step => {
  if (!seen.some) return seen.installCard ? "1.6" : "1.5";
  return seen.view === "yours" ? "1.8" : "1.7";
};

/**
 * Where 跳过 goes from a step: at the opening it closes the tutorial for good; while the computer starts, to cx at its desk, and from there
 * to the wait for the computer (1.10 with its card shut); at the first question, past it (1.11′); after the answer, to the road's end. In
 * part two it goes to the last scene in the chat, for an account that holds (`held`) or waits on something of part two's; with nothing of
 * it held, which only 2.1 and 2.2 can be, and at the last scene itself, it closes the tutorial for good.
 */
export function skipFrom(at: Step, held = false): "closed" | "1.9" | "1.10" | "1.11′" | "2.8" | "ended" {
  if (at === "1.1" || at === "1.2" || at === "1.3" || at === "2.8") return "closed";
  if (at.startsWith("2.")) return held ? "2.8" : "closed";
  if (at === "1.9" || at === "1.10") return "1.10";
  if (at === "1.11") return "1.11′";
  return at === "1.12" || at === "1.13" || at === "1.11′" ? "ended" : "1.9";
}
