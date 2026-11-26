import MarkdownIt from "markdown-it";

type Token = ReturnType<InstanceType<typeof MarkdownIt>["parse"]>[number];

// The model's words never become markup of their own: raw HTML — a stray `</think>` too — is shown as the text it is, as pi shows it.
// A single newline breaks the line, as pi's markdown keeps the model's line breaks. Images are off because an image address is fetched
// the moment it is shown, and a model can be led to write one that carries what it has read to someone else's server.
const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true }).disable("image");

/** The session's markdown as HTML, before any file path in it is made a way to its file. */
export const markdownHtml = (source: string): string => markdown.render(source);

/**
 * The first heading with words that the renderer draws at the top level — never one inside code, a list item or a quote — as its raw inline text and the
 * source lines it spans, start inclusive and end exclusive.
 */
export function firstHeading(source: string): { readonly text: string; readonly lines: readonly [number, number] } | undefined {
  const tokens = markdown.parse(source, {});
  const at = tokens.findIndex((token, n) => token.type === "heading_open" && token.level === 0 && tokens[n + 1]!.content.trim() !== "");
  const map = tokens[at]?.map;
  return map === null || map === undefined ? undefined : { text: tokens[at + 1]!.content, lines: [map[0], map[1]] };
}

/**
 * The words an answer shows once the page draws it, read from the same renderer: the marks markdown draws by are gone, every literal
 * it shows stays — a code span's pipes and underscores, an entity as its character — and each block, line break or code line is a line.
 */
export function markdownText(source: string): string {
  const lines: string[] = [];
  let line = "";
  const end = (): void => { if (line.trim() !== "") lines.push(line.trim()); line = ""; };
  const walk = (tokens: readonly Token[]): void => {
    for (const token of tokens) {
      if (token.children !== null) walk(token.children);
      else if (token.type === "text" || token.type === "code_inline") line += token.content;
      else if (token.type === "softbreak" || token.type === "hardbreak") end();
      else if (token.type === "code_block" || token.type === "fence") { end(); for (const code of token.content.split("\n")) { line = code; end(); } }
      else if (token.type === "th_close" || token.type === "td_close") line += " ";
      else if (token.block && token.nesting === -1) end();
    }
  };
  walk(markdown.parse(source, {}));
  end();
  return lines.join("\n");
}
