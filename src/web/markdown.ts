import MarkdownIt from "markdown-it";
import { h } from "./dom.js";
import { markdownHtml } from "../shared/markdown.js";
import type { FileNames } from "./paths.js";

export { markdownHtml };

type Token = ReturnType<InstanceType<typeof MarkdownIt>["parse"]>[number];

// A README's pictures are read as pictures, inline or by reference, and its HTML as HTML, so that markdown-it alone says what each is
// and each is dropped from the parse: no picture is rendered but the plugin's own, its package's or its GitHub repository's, both asked of
// the package's CDN (`pictureAt`), so no other is fetched, and none is left
// behind as a link to its address; no HTML is rendered as markup, and code, which the parse never reads as HTML, keeps every character.
const readmeMarkdown = new MarkdownIt({ html: true, linkify: true, breaks: true });
/**
 * An HTML block's words, as markdown-it's own inline parse finds them between the tags it reads: a text token is the author's words,
 * whatever characters it holds.
 */
function blockWords(content: string): string {
  let words = "";
  for (const token of readmeMarkdown.parseInline(content, {})[0]?.children ?? []) {
    if (token.type === "softbreak" || token.type === "hardbreak") words += " ";
    else if (token.type === "text" || token.type === "code_inline") words += token.content;
  }
  return words.replace(/\s+/g, " ").trim();
}
readmeMarkdown.renderer.rules.html_block = (tokens, at) => {
  const words = blockWords(tokens[at]!.content);
  return words === "" ? "" : `<p>${readmeMarkdown.utils.escapeHtml(words)}</p>\n`;
};
/** A video GitHub plays in place, its address alone in a paragraph: a page outside GitHub has nothing to play. */
const VIDEO = /^<?https:\/\/github\.com\/user-attachments\/assets\/[^\s<>]+>?$/;

const worded = (tokens: readonly Token[]): boolean => tokens.some((token) => token.type === "image" || ((token.type === "text" || token.type === "code_inline") && token.content.trim() !== ""));

/** npm's CDN, which serves a package's files and a GitHub repository's: the one host a README's pictures are drawn from, as the pages' policy admits. */
export const PICTURE_HOST = "https://cdn.jsdelivr.net/";

/** Where a README's pictures may come from: the package's files at `base`, and its own repository where npm names one on GitHub. */
export type Pictures = { readonly base?: string | undefined; readonly repository?: string | undefined };

/** `owner/name` of a repository on GitHub, as `https://github.com/owner/name`; none for another host. */
const githubOf = (repository: string | undefined): string | undefined => /^https:\/\/github\.com\/([^/\s]+\/[^/\s#?]+?)(?:\.git)?\/?$/i.exec(repository ?? "")?.[1];

/** The package a files address on the CDN is of, `name` or `@scope/name`, whatever its version; none for another address. */
const packageOf = (address: string): string | undefined => /^https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[^/@]+\/)?[^/@]+)(?:@[^/]*)?\//.exec(address)?.[1];

/**
 * A picture's address as the page draws it, or none: one of the package's own files on its CDN, and one in the package's own GitHub
 * repository, which is asked of the same CDN by its road for a repository (`/gh/<owner>/<name>@<ref>/<path>`, jsDelivr's README,
 * "GitHub"). The host is not enough: another package's file on the same CDN, or a path that climbs out of the package, is not the
 * plugin's own and is not fetched, nor is a picture on any other site.
 */
export function pictureAt(written: string, pictures: Pictures): string | undefined {
  const relative = againstFiles(written, pictures.base);
  if (relative !== undefined) return relative.startsWith(pictures.base!) ? relative : undefined;
  const address = asParsed(written);
  if (address === undefined) return undefined;
  const mine = pictures.base === undefined ? undefined : packageOf(pictures.base);
  if (mine !== undefined && packageOf(address) === mine) return address;
  const own = githubOf(pictures.repository);
  if (own === undefined) return undefined;
  if (address.toLowerCase().startsWith(`${PICTURE_HOST}gh/${own.toLowerCase()}@`)) return address;
  const raw = /^https:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/([^/]+)\/([^?#]+)$/.exec(address)
    ?? /^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:raw|blob)\/([^/]+)\/([^?#]+)(?:\?raw=true)?$/.exec(address);
  if (raw === null || raw[1]!.toLowerCase() !== own.toLowerCase()) return undefined;
  return `${PICTURE_HOST}gh/${own}@${raw[2]}/${raw[3]}`;
}

/** An address in full as the browser will ask for it, its `..` steps taken: what is checked is what is fetched. */
const asParsed = (address: string): string | undefined => { try { return new URL(address).href; } catch { return undefined; } };

const MarkdownToken = new readmeMarkdown.core.State("", readmeMarkdown, {}).Token;

/** A picture as Markdown's own would be, at the address `pictureAt` admitted, as it was admitted: nothing parses it again. */
function pictureToken(src: string, alt: string): Token {
  const picture = new MarkdownToken("image", "img", 0);
  picture.attrs = [["src", src], ["alt", ""]];
  picture.children = readmeMarkdown.parseInline(alt, {})[0]?.children ?? [];
  picture.content = alt;
  return picture;
}

/** An `<img>` tag's address and words, where the tag is one picture and nothing else. */
const IMG = /^<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>$/i;
const altOf = (tag: string): string => /\balt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? "";

/** An address written against the package's own files, resolved at `base`, its root at the package's; none for an address in full, or an anchor. */
function againstFiles(address: string, base: string | undefined): string | undefined {
  if (base === undefined || address === "" || /^[a-z][a-z0-9+.-]*:/i.test(address) || address.startsWith("//") || address.startsWith("#")) return undefined;
  try { return new URL(address.replace(/^\/+/, ""), base).href; } catch { return undefined; }
}

/** Where a token was dropped from a line: the words either side close up, and nothing of it is drawn. */
const GONE = Symbol("gone");
/** Where a picture was dropped: as `GONE`, and a link it leaves with no words is a badge. */
const PICTURE = Symbol("picture");
/** Where a link that held a picture and no words, a badge, was dropped: as `GONE`, and a label naming it alone goes with it. */
const BADGE = Symbol("badge");
type Kept = Token | typeof GONE | typeof PICTURE | typeof BADGE;

/**
 * The inline tokens a README keeps: a picture only where the package's CDN serves it, at its full address, a link written against the
 * package's files at theirs, and no HTML. A link that holds no words once its pictures are gone goes with them, and so does
 * what the gap would leave: the second of two spaces, and a label (「Docs: 」) that named only a badge that went.
 */
function withoutPictures(children: readonly Token[], pictures: Pictures): Token[] {
  const kept = children.map((token): Kept => {
    if (token.type === "html_inline") {
      // An <img> of the plugin's own is the one tag read: as the picture Markdown would have written.
      const img = IMG.exec(token.content.trim());
      const src = img === null ? undefined : pictureAt(img[1]!, pictures);
      if (src === undefined) return img === null ? GONE : PICTURE;
      return pictureToken(src, altOf(img![0]));
    }
    const field = token.type === "image" ? "src" : token.type === "link_open" ? "href" : undefined;
    if (field === undefined) return token;
    const written = String(token.attrGet(field) ?? "");
    if (token.type === "image") {
      const src = pictureAt(written, pictures);
      if (src === undefined) return PICTURE;
      token.attrSet(field, src);
      return token;
    }
    token.attrSet(field, againstFiles(written, pictures.base) ?? written);
    return token;
  });
  const linked: Kept[] = [];
  const opened: number[] = [];
  for (const token of kept) {
    if (typeof token !== "symbol" && token.type === "link_open") opened.push(linked.length);
    if (typeof token !== "symbol" && token.type === "link_close") {
      const at = opened.pop();
      const inside = at === undefined ? [] : linked.slice(at + 1);
      if (at !== undefined && !worded(inside.filter((one): one is Token => typeof one !== "symbol"))) { linked.length = at; linked.push(inside.includes(PICTURE) ? BADGE : GONE); continue; }
    }
    linked.push(token);
  }
  return closedUp(linked);
}

/** A label that names what follows it on its line: the words after the last sentence's end, up to a colon that ends them. */
const LABEL = /(?:^|(?<=[.!?。！？]\s*))[^.!?。！？]*[:：]\s*$/;

/** Whether nothing but spaces stands from `from` to the end of the line. */
function endsLine(tokens: readonly Kept[], from: number): boolean {
  for (const token of tokens.slice(from)) {
    if (typeof token === "symbol" || (token.type === "text" && token.content.trim() === "")) continue;
    return token.type === "softbreak" || token.type === "hardbreak";
  }
  return true;
}

/**
 * A line's tokens with each gap closed: a space either side of one becomes one space, and a label before a badge that ends its line goes.
 * Only the inline decides: a label before a dropped tag or a picture alone, or one whose words follow in the next block, stays.
 */
function closedUp(tokens: readonly Kept[]): Token[] {
  const out: Token[] = [];
  let gap = false;
  tokens.forEach((token, at) => {
    if (typeof token === "symbol") {
      const label = out.at(-1);
      if (token === BADGE && label?.type === "text" && LABEL.test(label.content) && endsLine(tokens, at + 1)) label.content = label.content.replace(LABEL, "");
      gap = true;
      return;
    }
    const before = out.at(-1);
    if (gap && token.type === "text" && (before === undefined || before.type === "softbreak" || before.type === "hardbreak" || (before.type === "text" && /\s$/.test(before.content)))) token.content = token.content.trimStart();
    gap = false;
    out.push(token);
  });
  const last = out.at(-1);
  if (last?.type === "text") last.content = last.content.trimEnd();
  return out.filter((token) => token.type !== "text" || token.content !== "");
}

/**
 * A README's markdown as HTML with its HTML, its pictures, the links that held only pictures and GitHub's videos left out, and its code
 * as written; where `base` says where the package's files are served, its pictures served there are kept and what it writes against
 * those files resolves there.
 */
export function readmeHtml(source: string, pictures: Pictures = {}): string {
  const env = {};
  const tokens = readmeMarkdown.parse(source, env).flatMap((token) => pictured(token, pictures));
  for (const token of tokens) if (token.type === "inline" && token.children !== null) token.children = withoutPictures(token.children, pictures);
  // A paragraph that held only pictures or HTML goes whole, as does a video's, and an HTML block with no words, before any shell is weighed.
  const kept: Token[] = [];
  for (let at = 0; at < tokens.length; at += 1) {
    const [open, inline, close] = [tokens[at]!, tokens[at + 1], tokens[at + 2]];
    if (open.type === "html_block" && blockWords(open.content) === "") continue;
    if (open.type === "paragraph_open" && inline?.type === "inline" && close?.type === "paragraph_close" && (!worded(inline.children ?? []) || VIDEO.test(inline.content.trim()))) { at += 2; continue; }
    kept.push(open);
  }
  return readmeMarkdown.renderer.render(withoutShells(kept), readmeMarkdown.options, env);
}

/**
 * An HTML block of the plugin's own pictures and no words, as a README centres its banner (`<p align="center"><img …></p>`): a paragraph
 * of those pictures, read as Markdown's would be. Any other HTML block stays as it was.
 */
function pictured(token: Token, pictures: Pictures): readonly Token[] {
  if (token.type !== "html_block" || blockWords(token.content) !== "") return [token];
  const tags = token.content.match(/<img\b[^>]*>/gi) ?? [];
  const drawn = tags.map((tag) => ({ src: IMG.exec(tag) === null ? undefined : pictureAt(IMG.exec(tag)![1]!, pictures), alt: altOf(tag) })).filter((one): one is { src: string; alt: string } => one.src !== undefined);
  if (drawn.length === 0) return [token];
  const open = new MarkdownToken("paragraph_open", "p", 1);
  const inline = new MarkdownToken("inline", "", 0);
  const close = new MarkdownToken("paragraph_close", "p", -1);
  open.block = close.block = inline.block = true;
  inline.content = drawn.map((one) => one.alt).join(" ");
  inline.children = drawn.flatMap((one, at) => [...(at > 0 ? [Object.assign(new MarkdownToken("text", "", 0), { content: " " })] : []), pictureToken(one.src, one.alt)]);
  return [open, inline, close];
}

/** The span of tokens from an opening one at `at` to its close, by nesting. */
function spanEnd(tokens: readonly Token[], at: number): number {
  let depth = 0;
  for (let end = at; end < tokens.length; end += 1) {
    depth += tokens[end]!.nesting;
    if (depth === 0) return end;
  }
  return tokens.length - 1;
}

/**
 * What the dropped parts leave empty goes with them: a list item that holds nothing, a list of no items, a table row whose every cell is
 * empty, and a table with nothing in it. A cell stays, even empty, so its row's cells keep their columns.
 */
function withoutShells(tokens: readonly Token[]): Token[] {
  const out: Token[] = [];
  for (let at = 0; at < tokens.length; at += 1) {
    const token = tokens[at]!;
    const end = token.nesting === 1 ? spanEnd(tokens, at) : at;
    const inner = withoutShells(tokens.slice(at + 1, end));
    const empty = (token.type === "list_item_open" || token.type === "bullet_list_open" || token.type === "ordered_list_open" || token.type === "tbody_open" || token.type === "thead_open" || token.type === "table_open") && inner.length === 0;
    const blankRow = token.type === "tr_open" && !inner.some((one) => one.type === "inline" && worded(one.children ?? []));
    const headless = token.type === "table_open" && !inner.some((one) => one.type === "tbody_open") && !inner.some((one) => one.type === "inline" && worded(one.children ?? []));
    if (token.nesting === 1) {
      if (!empty && !blankRow && !headless) out.push(token, ...inner, tokens[end]!);
      at = end;
      continue;
    }
    out.push(token);
  }
  return out;
}

/** The files the board lists, and the file box a file named among them is drawn as. */
export type PathLink = { readonly names: FileNames; readonly box: (path: string) => HTMLElement };

const SKIPPED = new Set(["A", "PRE"]);

function linkPaths(root: Node, link: PathLink): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) texts.push(node as Text);
  for (const node of texts) {
    let inside: Node | null = node.parentNode;
    let skip = false;
    for (; inside !== null && inside !== root; inside = inside.parentNode) if (SKIPPED.has(inside.nodeName)) skip = true;
    if (skip) continue;
    const parent = node.parentNode;
    // Only a span of inline code that is one listed file is the file box: cx marks a file so, and prose stays words.
    if (parent === null || parent.nodeName !== "CODE" || parent.childNodes.length !== 1) continue;
    const path = link.names.whole(node.data);
    if (path !== undefined) node.replaceWith(link.box(path));
  }
}

/** The session's markdown as elements, each span of inline code that is one file the board lists drawn as the file box; prose, a link and a code block stay as written; no link, no box. */
export function renderMarkdown(source: string, link: PathLink | undefined): HTMLElement {
  const holder = h("div", { class: "markdown" });
  holder.innerHTML = markdownHtml(source);
  for (const anchor of holder.querySelectorAll("a")) { anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; }
  if (link !== undefined) linkPaths(holder, link);
  return holder;
}
