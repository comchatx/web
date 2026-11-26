// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { piWords } from "./plugins-cards.js";
import { ago, uncut } from "./plugins-item.js";
import { pictureAt, readmeHtml } from "./markdown.js";
import type { Child } from "./dom.js";
import { downloadsWord, galleryPlugin, npmFacts, npmNameOf, npmUrl, thirdMark } from "./plugins-npm.js";
import { text, type StringKey } from "./strings.js";

const say = (key: StringKey, values?: Readonly<Record<string, string | number>>): string => text("en", key, values);
const zh = (key: StringKey, values?: Readonly<Record<string, string | number>>): string => text("zh", key, values);
const line = (parts: readonly Child[]): string => { const holder = document.createElement("p"); holder.append(...parts.filter((one): one is Node | string => one !== undefined && one !== false)); return holder.textContent ?? ""; };

it("takes the npm name a source names with or without a version, as written, and none from a source that is not npm's or names nothing", () => {
  const long = "x".repeat(215);
  expect(["npm:pi-web-access", "npm:pi-web-access@0.42.0", "npm:@comchatx/cx-topics", "npm:@comchatx/cx-topics@1.0.0", "npm:Upper", "npm:@other/_x@1.0.0", `npm:${long}`].map(npmNameOf))
    .toEqual(["pi-web-access", "pi-web-access", "@comchatx/cx-topics", "@comchatx/cx-topics", "Upper", "@other/_x", long]);
  // Whether npm takes a name is the platform's answer, never the page's.
  expect(["git:github.com/a/b", "/opt/comchatx/packages/x", "npm:"].map(npmNameOf)).toEqual([undefined, undefined, undefined]);
});

it("makes a gallery package a plugin installed from npm at the registry's current, in its author's words in every language, at npm's name", () => {
  expect(galleryPlugin({ name: "pi-cron", description: "Runs on a schedule.", author: "Bac" })).toEqual({
    id: "~pi-cron", name: "pi-cron", author: "Bac", section: "extensions", about: { en: "Runs on a schedule.", zh: "Runs on a schedule." }, builds: [],
    box: { package: "pi-cron", skills: [], source: "npm:pi-cron" }, npm: "pi-cron",
  });
  // A name alone, as an address gives it before npm answers: nobody is named and nothing said.
  expect([galleryPlugin({ name: "pi-cron" }).author, galleryPlugin({ name: "pi-cron" }).about]).toEqual(["", { en: "", zh: "" }]);
  expect(npmUrl("@comchatx/cx-topics")).toBe("https://www.npmjs.com/package/@comchatx/cx-topics");
});

it("rounds last month's downloads as each language counts, never to a thousand thousands", () => {
  expect([0, 999, 1_000, 1_049, 9_999, 10_000, 762_066, 999_499, 999_500, 1_618_815].map((n) => downloadsWord(n, "en"))).toEqual(["0", "999", "1K", "1K", "10K", "10K", "762K", "999K", "1M", "1.6M"]);
  expect([9_999, 10_000, 762_066, 1_618_815].map((n) => downloadsWord(n, "zh"))).toEqual(["9999", "1 万", "76.2 万", "162 万"]);
});

it("says npm's facts with the dot after each, the version only where it is given, and the mark a third party's plugin carries", () => {
  expect(line(npmFacts(say, "en", { author: "Nico Bailon", version: "0.42.0", downloads: 762_066, when: "8 days ago" }))).toBe("by Nico Bailon · 0.42.0 · 762K downloads a month · updated 8 days ago");
  const parts = npmFacts(say, "en", { author: "", downloads: 3 }).filter((one): one is HTMLElement => typeof one !== "string");
  expect(parts.map((one) => [one.className, one.textContent])).toEqual([["pl-npm-whole", "Author not stated ·"], ["pl-npm-fact", "3 downloads a month"]]);
  expect(line(npmFacts(say, "en", {}))).toBe("Author not stated");
  expect([thirdMark(say).className, thirdMark(say).textContent]).toEqual(["pl-chip", "Third-party plugin"]);
});

it("counts how long ago npm last saw a package published in minutes for an hour, hours for a day, days for a month, then months for a year, then years", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  const at = (days: number): string => new Date(now - days * 86_400_000).toISOString();
  const minutes = (n: number): string => new Date(now - n * 60_000).toISOString();
  expect([0, 7, 59, 60, 23 * 60 + 59].map((n) => ago(minutes(n), now, "en", say))).toEqual(["1m ago", "7m ago", "59m ago", "1h ago", "23h ago"]);
  expect([ago(minutes(7), now, "zh", zh), ago(minutes(120), now, "zh", zh)]).toEqual(["7 分钟前", "2 小时前"]);
  expect([1, 2, 29, 30, 59, 364, 365, 800].map((days) => ago(at(days), now, "en", say))).toEqual(["yesterday", "2 days ago", "29 days ago", "1 month ago", "1 month ago", "12 months ago", "1 year ago", "2 years ago"]);
  expect(ago(at(90), now, "zh", say)).toBe("3 个月前");
  expect(ago("not a day", now, "en", say)).toBeUndefined();
});

it("drops the last block of a README npm cut, and an open fence with it, so no half sentence or open code stands at its end", () => {
  expect(uncut("# pi-web-access\n\nSearches the web.\n\n## Install\n\nRun pi ins")).toBe("# pi-web-access\n\nSearches the web.\n\n## Install");
  expect(uncut("# x\n\nWords.\n\n```bash\npi install npm:x\n\nnpm run bu")).toBe("# x\n\nWords.");
  expect(uncut("# x\n\n```bash\nrun\n```\n\nhalf")).toBe("# x\n\n```bash\nrun\n```");
  expect(uncut("one block cut short")).toBe("");
});

it("puts pi's words on one line, and keeps the end of them where they run long, from a whole word", () => {
  expect(piWords("npm error code E404\n  npm error 404 Not Found\n")).toBe("npm error code E404 npm error 404 Not Found");
  const long = `${"word ".repeat(200)}the end`;
  const kept = piWords(long);
  expect([kept.startsWith("…word"), kept.endsWith("the end"), kept.length <= 401]).toEqual([true, true, true]);
});

it("leaves a README's HTML, pictures, badges and GitHub's videos out, inline or by reference, keeps an HTML block's words, and draws code as written", () => {
  const text = [
    '<p align="center">', '  <img src="banner.png" width="1100">', "</p>", "",
    '<div>Fast <b>search</b><!-- note --></div>', "",
    "[![npm](https://img.shields.io/npm/v/x)](https://npmjs.com/x) [![MIT](https://img.shields.io/x)](https://x)", "",
    "Run `<name>` with ![logo](a.png)the <kbd>Tab</kbd> [docs](https://x.dev).", "",
    "https://github.com/user-attachments/assets/cac6a17a-1eeb", "",
    // The review's forms: a picture by reference, and a badge whose picture and link are both by reference.
    "Before ![ref][r] after.", "", "[![badge][bimg]][burl]", "", "Built [![badge][bimg]][burl] daily.", "",
    "[r]: https://evil.example/b.png", "[bimg]: https://img.shields.io/x.svg", "[burl]: https://npm.example/x", "",
    "```html", "<p>kept</p>", "", "![kept](x.png)", "```", "", "    <i>indented code</i>",
  ].join("\n");
  const drawn = document.createElement("div");
  drawn.innerHTML = readmeHtml(text);
  expect([...drawn.children].map((one) => `${one.tagName} ${one.textContent!.trim()}`)).toEqual([
    "P Fast search", "P Run <name> with the Tab docs.", "P Before after.", "P Built daily.",
    "PRE <p>kept</p>\n\n![kept](x.png)", "PRE <i>indented code</i>",
  ]);
  expect([drawn.querySelectorAll("img").length, [...drawn.querySelectorAll("a")].map((one) => one.getAttribute("href"))]).toEqual([0, ["https://x.dev"]]);
});

it("lets markdown-it alone say what is HTML: a tag whose attribute holds a `>`, a summary and a comment leave no fragment drawn as words", () => {
  const text = [
    '<p align="center"><img src="x" title="a > b"> Tagline</p>', "",
    "<details>", "<summary>More</summary>", "", "Body.", "", "</details>", "",
    "Words <b>bold</b> more <!-- a", "b --> end.",
  ].join("\n");
  const drawn = document.createElement("div");
  drawn.innerHTML = readmeHtml(text);
  expect([...drawn.children].map((one) => `${one.tagName} ${one.textContent!.trim()}`)).toEqual(["P Tagline", "P More", "P Body.", "P Words bold more end."]);
});

it("leaves no shell where a picture went: no empty list item, row or table, no second space, and no label that named a badge alone", () => {
  const text = [
    "- ![pic](https://x.example/p.png)", "- item", "",
    "- ![pic](https://x.example/p.png)", "", "Between.", "",
    "| a | b |", "|---|---|", "| ![p](https://x.example/p.png) | c |", "| ![p](https://x.example/p.png) | ![q](https://x.example/q.png) |", "",
    "| ![p](https://x.example/p.png) | ![q](https://x.example/q.png) |", "|---|---|", "| [![b](https://x.example/b.svg)](https://x.example) | x |", "",
    "Before ![p](https://x.example/p.png) after.", "",
    "Docs: [![badge](https://x.example/b.svg)](https://docs.example)", "",
    "文档：[![badge](https://x.example/b.svg)](https://docs.example)", "",
    "Read it. Docs: [![badge](https://x.example/b.svg)](https://docs.example)", "Next line.", "",
    "Install: [![badge](https://x.example/b.svg)](https://docs.example) then run it.",
  ].join("\n");
  const drawn = document.createElement("div");
  drawn.innerHTML = readmeHtml(text);
  expect([...drawn.children].map((one) => `${one.tagName} ${one.textContent!.replace(/\s+/g, " ").trim()}`)).toEqual([
    "UL item", "P Between.", "TABLE a b c", "TABLE x", "P Before after.", "P Read it. Next line.", "P Install: then run it.",
  ]);
  // A cell stays where it stood, empty, so the row's other cells keep their columns.
  expect([...drawn.querySelectorAll("table")[0]!.querySelectorAll("tbody td")].map((cell) => cell.textContent)).toEqual(["", "c"]);
  expect(drawn.innerHTML).not.toMatch(/ {2}|<li><\/li>/);
});

it("keeps the words markdown-it read as text inside an HTML block, an entity's or an escape's `<` among them", () => {
  for (const line of ["Use &lt;name&gt; for the placeholder.", "Use \\<name> for the placeholder."]) {
    const drawn = document.createElement("div");
    drawn.innerHTML = readmeHtml(["<div>", line, "</div>"].join("\n"));
    expect([...drawn.children].map((one) => `${one.tagName} ${one.textContent}`), line).toEqual(["P Use <name> for the placeholder."]);
  }
});

it("keeps a label whose own line lost no badge: one before a dropped tag, or a picture alone, and the block after it", () => {
  const fence = ["```sh", "npm install x", "```"];
  for (const text of [["Install:<br>", "", ...fence], ["Install:<br>", "", "Run npm install x."], ["Install: ![badge](https://x.example/b.svg)", "", ...fence]]) {
    const drawn = document.createElement("div");
    drawn.innerHTML = readmeHtml(text.join("\n"));
    expect(drawn.children[0]?.outerHTML, text[0]).toBe("<p>Install:</p>");
  }
});

it("keeps a label before a wordless link that held no picture, and closes a line around a badge with words after it", () => {
  for (const [text, drawn] of [
    ["Install: [](https://x.example)", "<p>Install:</p>"],
    ["Install: [<br>](https://x.example)", "<p>Install:</p>"],
    ["See: [![b](https://x.example/b.svg)](https://x.example) the docs.", "<p>See: the docs.</p>"],
  ] as const) {
    const holder = document.createElement("div");
    holder.innerHTML = readmeHtml(text);
    expect(holder.innerHTML.trim(), text).toBe(drawn);
  }
});

it("leaves no list item that held only an HTML picture", () => {
  const drawn = document.createElement("div");
  drawn.innerHTML = readmeHtml(['- <img src="https://x.example/p.png">', "- Useful"].join("\n"));
  expect([...drawn.querySelectorAll("li")].map((item) => item.textContent!.trim())).toEqual(["Useful"]);
});

it("draws a paragraph that is only inline code, and a link whose words are all code, as words", () => {
  const drawn = document.createElement("div");
  drawn.innerHTML = readmeHtml(["`npm install x`", "", "[`x`](https://x.example)"].join("\n"));
  expect([[...drawn.children].map((one) => one.innerHTML), drawn.querySelector("a")?.getAttribute("href")]).toEqual([["<code>npm install x</code>", '<a href="https://x.example"><code>x</code></a>'], "https://x.example"]);
});

it("keeps every character of code whatever its fence's or span's length, and leaves HTML out only where it is not code", () => {
  const text = ["````md", "```html", "<p>kept</p>", "```", "````", "", "A span ``<b>kept</b>`` and <b>bold</b>."].join("\n");
  const drawn = document.createElement("div");
  drawn.innerHTML = readmeHtml(text);
  expect([...drawn.children].map((one) => `${one.tagName} ${one.textContent!.trim()}`)).toEqual(["PRE ```html\n<p>kept</p>\n```", "P A span <b>kept</b> and bold."]);
  expect([drawn.querySelectorAll("b").length, drawn.querySelector("p code")!.textContent]).toEqual([0, "<b>kept</b>"]);
});

it("draws a picture in the plugin's own GitHub repository through the CDN's road for a repository, and none from another repository or site", () => {
  const pictures = { base: "https://cdn.jsdelivr.net/npm/pi-subagents@0.89.0/", repository: "https://github.com/nicobailon/pi-subagents" };
  const sources = (text: string): readonly (string | null)[] => { const drawn = document.createElement("div"); drawn.innerHTML = readmeHtml(text, pictures); return [...drawn.querySelectorAll("img")].map((one) => one.getAttribute("src")); };
  expect(sources("![Banner](https://raw.githubusercontent.com/nicobailon/pi-subagents/main/banner.png)")).toEqual(["https://cdn.jsdelivr.net/gh/nicobailon/pi-subagents@main/banner.png"]);
  expect(sources("![Flow](https://github.com/NicoBailon/pi-subagents/blob/9f1c2d3/docs/flow.svg?raw=true)")).toEqual(["https://cdn.jsdelivr.net/gh/nicobailon/pi-subagents@9f1c2d3/docs/flow.svg"]);
  // As a README centres its banner: an HTML block of the plugin's own picture and no words, and an <img> among words.
  expect(sources('<p align="center"><img src="https://raw.githubusercontent.com/nicobailon/pi-subagents/main/banner.png" alt="pi-subagents" width="1100"></p>')).toEqual(["https://cdn.jsdelivr.net/gh/nicobailon/pi-subagents@main/banner.png"]);
  expect(sources('See <img src="https://raw.githubusercontent.com/nicobailon/pi-subagents/main/a.png"> here.')).toEqual(["https://cdn.jsdelivr.net/gh/nicobailon/pi-subagents@main/a.png"]);
  // Its own package's files are drawn as before; a picture of another repository, a badge's site or the CDN with no package are not.
  expect(sources("![Logo](logo.png)")).toEqual(["https://cdn.jsdelivr.net/npm/pi-subagents@0.89.0/logo.png"]);
  expect(sources("![x](https://raw.githubusercontent.com/someone/else/main/x.png) ![b](https://img.shields.io/npm/v/pi-subagents)")).toEqual([]);
  // The CDN is not enough: another package's file there, a path that climbs out of the package, or another repository's road, is not drawn.
  expect(sources("![a](https://cdn.jsdelivr.net/npm/other-plugin@1.0.0/a.png) ![b](../../other-plugin@1.0.0/b.png) ![c](../c.png) ![d](https://cdn.jsdelivr.net/npm/pi-subagents@0.89.0/../other-plugin@1.0.0/d.png) ![e](https://cdn.jsdelivr.net/gh/someone/else@main/e.png)")).toEqual([]);
  expect(sources("![a](https://cdn.jsdelivr.net/npm/pi-subagents@latest/a.png) ![b](docs/../b.png) ![c](https://cdn.jsdelivr.net/gh/nicobailon/pi-subagents@main/c.png)")).toEqual(["https://cdn.jsdelivr.net/npm/pi-subagents@latest/a.png", "https://cdn.jsdelivr.net/npm/pi-subagents@0.89.0/b.png", "https://cdn.jsdelivr.net/gh/nicobailon/pi-subagents@main/c.png"]);
  // An <img>, inline or as a block, is drawn at the address that was admitted, character for character: an entity in it is not read again
  // into a path that moves where the path's edge is.
  for (const written of ["icons&sol;logo.png", "&period;&period;&sol;&period;&period;&sol;other-plugin@1.0.0&sol;x.png"]) {
    const admitted = pictureAt(written, pictures);
    expect(sources(`See <img src="${written}"> here.`)).toEqual(admitted === undefined ? [] : [admitted]);
    expect(sources(`<p align="center"><img src="${written}" alt="Logo"></p>`)).toEqual(admitted === undefined ? [] : [admitted]);
  }
  expect(pictureAt("icons&sol;logo.png", pictures)).toBe("https://cdn.jsdelivr.net/npm/pi-subagents@0.89.0/icons&sol;logo.png");
  const none = document.createElement("div");
  none.innerHTML = readmeHtml("![Banner](https://raw.githubusercontent.com/nicobailon/pi-subagents/main/banner.png)", { repository: "https://gitlab.com/nicobailon/pi-subagents" });
  expect(none.querySelectorAll("img")).toHaveLength(0);
});
