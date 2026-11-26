import { expect, it } from "vitest";
import { markdownHtml } from "./markdown.js";

it("keeps a single newline in the model's text as a line break, as pi's markdown does", () => {
  expect(markdownHtml("first line\nsecond line")).toBe("<p>first line<br>\nsecond line</p>\n");
  expect(markdownHtml("Revenue by week:\n- a\n- b")).toBe("<p>Revenue by week:</p>\n<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n");
});

it("shows raw HTML in the model's text — a stray `</think>` too — as the text it is, as pi does", () => {
  expect(markdownHtml("done</think>\n\nanswer")).toBe("<p>done&lt;/think&gt;</p>\n<p>answer</p>\n");
  expect(markdownHtml("<b>bold</b>")).toBe("<p>&lt;b&gt;bold&lt;/b&gt;</p>\n");
});

it("draws no image, whose address is fetched the moment it shows", () => {
  expect(markdownHtml("![x](https://example.com/x.png)")).not.toContain("<img");
});
