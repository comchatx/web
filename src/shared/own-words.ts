/** A quote the page put in a seller's message, `<quote entry="…" at="…">words</quote>`: the quoted words are not the seller's own. */
const QUOTE = /<quote\b[^>]*>[\s\S]*?<\/quote>/g;
/** A skill pi wrote into the message when the seller picked one with /: its body is the skill's words, not the seller's. */
const SKILL = /<skill name="[^"]*" location="[^"]*">[\s\S]*?<\/skill>/g;

/** A seller's message's own words: every quote and skill it carries taken out, in whatever order they stand. The topic index and the History list read a message by this one reading. */
export const ownWords = (text: string): string => text.replace(QUOTE, "").replace(SKILL, "").trim();
