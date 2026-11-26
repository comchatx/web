import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ownValues, themeNames } from "./theme.mjs";

const site = (name: string): string => readFileSync(new URL(`./site/${name}`, import.meta.url), "utf8");
const bare = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");
/** A selector list's selectors, split at its own commas and not at those inside a `:not(…)` or an `:is(…)`. */
const each = (list: string): readonly string[] => {
  const out: string[] = [];
  let depth = 0, from = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === "(") depth++;
    else if (list[i] === ")") depth--;
    else if (list[i] === "," && depth === 0) { out.push(list.slice(from, i).trim()); from = i + 1; }
  }
  return [...out, list.slice(from).trim()];
};
/** Every rule of a sheet as [selector, body], outside an at-rule's braces as inside them. */
const rules = (css: string): readonly (readonly [string, string])[] =>
  [...bare(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1]!.trim().replace(/\s+/g, " "), m[2]!.trim()] as const);

const FIELDS = [
  "input.tab-rename", '.dialog input:not([type="radio"], [type="checkbox"])', ".dialog textarea",
  ".cl-formFieldInput", ".cl-otpCodeFieldInput", ".road-name input", ".composer", ".pl-searchbox", ".sw-amount",
  ".pl-key", ".pl-store-field", ".pl-fieldrow > input", '.pl-field input[type="text"]',
];
const PAGES = ["app.css", "door.css", "road.css", "pay.css"];

it("draws every field a person types in by one set of rules, which the chat page, the sign-in card and the road read after their own sheets", () => {
  for (const page of ["index.html", "login.html", "login.en.html", "start.html"]) {
    const sheets = [...site(page).matchAll(/<link rel="stylesheet" href="\.\/([^"]+)">/g)].map((m) => m[1]);
    expect(sheets.at(-1), page).toBe("forms.css");
  }
  const form = rules(site("forms.css"));
  const of = (selectors: readonly string[]): string => form.find(([selector]) => selectors.every((one) => each(selector).includes(one)))?.[1] ?? "";
  expect(of(FIELDS)).toBe("border: 1px solid var(--edge); border-radius: var(--radius); background: var(--raised); outline: none; box-shadow: none;");
  // With the caret in it, the mark lies over the box's own edge and inward, so nothing beside the field is touched.
  const caret = [
    "input.tab-rename:focus-visible", '.cl-otpCodeFieldInput[data-focus-within="true"]', ".road-name input:focus-visible",
    ".composer:focus-within", ".pl-searchbox:focus-within", ".sw-amount:has(:focus-visible)",
    ".pl-key:focus-visible", ".pl-store-field:focus-visible", ".pl-fieldrow > input:focus-visible", '.pl-field input[type="text"]:focus-visible',
  ];
  expect(of(caret)).toBe("border-color: var(--act); outline: 2px solid var(--act); outline-offset: -2px;");
  expect(of(['input.tab-rename[aria-invalid="true"]', '.cl-otpCodeFieldInput[data-feedback="error"]', '.road-name input[aria-invalid="true"]'])).toBe("border-color: var(--bad); outline-color: var(--bad);");
  expect(of(["input.tab-rename:disabled", ".cl-formFieldInput:disabled", ".road-name input:disabled", ".composer:has(textarea:disabled)"])).toBe("border-color: var(--line); background: var(--wash); color: var(--quiet); cursor: default;");
  expect(form).toContainEqual([".composer", "border-radius: var(--radius-large);"]);
  // Every value is the theme's.
  expect(ownValues("forms.css", site("forms.css"))).toEqual([]);
  const names = themeNames(site("theme.css"));
  // Beside the theme's: the shade under a pointer, which app.css sets per ground and a page without app.css reads as the float's, and the
  // choice's pill, placed by forms.ts.
  const own = new Set(["--shade", "--f-x", "--f-w"]);
  expect([...bare(site("forms.css")).matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]!).filter((name) => !names.has(name) && !own.has(name))).toEqual([]);
  expect(bare(site("forms.css")).match(/var\(--shade\)/g)).toBeNull();
});

it("draws each control of the set once, under its own name, as the signed set does", () => {
  const form = rules(site("forms.css"));
  const body = (selector: string): string => form.find(([one]) => one === selector)?.[1] ?? "";
  const at = (selector: string): number => form.findIndex(([one]) => one === selector);
  // Every rule of the set is under an `f-` name, so no older rule of a page reaches it, and none of them under a bare `.card`.
  const set = form.slice(at("a.f-link"));
  expect(set.length).toBeGreaterThan(80);
  for (const [selector] of set) expect(each(selector).every((one) => /\.f-|@|^\d|^to$|^from$/.test(one)), selector).toBe(true);
  // Hidden is the one way a tip goes: after every kind of tip, so none outweighs it.
  expect(body(".f-tip[hidden]")).toBe("display: none;");
  expect(at(".f-tip[hidden]")).toBeGreaterThan(Math.max(...form.map(([one], n) => (one.startsWith(".f-tip") && one !== ".f-tip[hidden]" ? n : -1))));
  // A plain button is a hairline on the ground one step in, and one step further on a card.
  expect(body(".f-btn")).toContain("border: 1px solid var(--line);");
  expect(body(".f-btn")).toContain("background: var(--hover);");
  expect(body(".f-card .f-btn")).toBe("background: var(--float-hover);");
  expect(body(".f-card")).toContain("background: var(--hover);");
  // The choice: a track with no outline on the wash, the held value a pill on --held that slides over the quick motion, still under reduced motion.
  expect(body(".f-seg")).toContain("border: none;");
  expect(body(".f-seg")).toContain("background: var(--wash);");
  expect(body(".f-pill")).toContain("background: var(--held);");
  expect(body(".f-pill")).toContain("transition: transform var(--motion-quick) var(--ease), width var(--motion-quick) var(--ease);");
  expect(bare(site("forms.css"))).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.f-pill \{ transition: none; \} \}/);
  expect(bare(site("forms.css"))).toMatch(/@media not \(min-width: 22\.5rem\) \{ \.f-seg > button \{ padding: 0 var\(--space-3\); \} \}/);
  // Search, one way: the wash, no edge.
  expect(body(".f-search")).toContain("border: none;");
  expect(body(".f-search")).toContain("background: var(--wash);");
  // The app's own pages draw no `.card` of their own any more.
  expect(rules(site("app.css")).filter(([selector]) => each(selector).some((one) => /(^|[ >])\.card([ .:[]|$)/.test(one)))).toEqual([]);
});

it("leaves no page's sheet a box or a ring of its own for a field, and draws a cell of a few values' mark inside the cell", () => {
  // A rule names a field where one of its selectors ends on the field itself, in any state, and not on something inside it.
  const KEYS = [".tab-rename", ".history-search", ".dialog input", ".dialog textarea", ".cl-formFieldInput", ".cl-otpCodeFieldInput", ".road-name input", ".composer", ".pl-searchbox", ".sw-amount", ".pl-key", ".pl-store-field", ".pl-fieldrow > input", ".pl-field input"];
  const named = (selector: string): boolean => each(selector).some((one) => KEYS.some((key) => {
    const at = one.lastIndexOf(key);
    return at >= 0 && (key.includes(" ") ? at === 0 : !/[ >+~]/.test(one.slice(at))) && /^($|[:[.])/.test(one.slice(at + key.length));
  }));
  for (const page of PAGES) for (const [selector, body] of rules(site(page))) {
    // The message box's dashed edge while a file is held over it is a drop's mark, not a state of the field.
    if (!named(selector) || selector.startsWith(".composer.dropping")) continue;
    expect(body, `${page}: ${selector}`).not.toMatch(/(^|; )(border|border-radius|background|outline|outline-offset):/);
    expect(body, `${page}: ${selector}`).not.toMatch(/(^|; )border-color: var\(--(act|bad)\)/);
  }
  expect(rules(site("forms.css"))).toContainEqual([".f-seg > button:focus-visible", "outline: 2px solid var(--act); outline-offset: -2px;"]);
});

it("underlines nothing, at rest or under the pointer, and lays words a person presses on the one ground two pixels past them", () => {
  for (const page of PAGES) expect(bare(site(page)), page).not.toMatch(/underline|text-decoration-(style|thickness)/);
  const app = rules(site("app.css"));
  expect(app).toContainEqual(["a", "color: var(--act); text-decoration: none;"]);
  // One ground, one step into the ground a thing lies on: the page's, the sidebar's, a step's block.
  expect(app).toContainEqual([":root", "--shade: var(--float-hover);"]);
  expect(app).toContainEqual([".sidebar", "--shade: var(--frame-hover);"]);
  expect(app).toContainEqual([".tool, .shell", "--shade: var(--step-hover); font-size: var(--size-small); line-height: var(--leading-small);"]);
  expect(app).toContainEqual(["button:hover:not(:disabled, :where(.f-btn, .f-quiet, .f-icon, .f-select, .f-switch, .f-menu-row, .f-seg > button))", "background: var(--shade);"]);
  const words = app.find(([selector]) => selector.includes(".note-head:hover:not(:disabled)") && selector.includes('a:not([class]):not(:where([role="menuitem"], .sw-nav a)):hover'));
  for (const place of [".tool .more:hover:not(:disabled)", "button.step-line:hover:not(:disabled)", ".fold:hover:not(:disabled)",
    "button.sw-link:hover:not(:disabled)", ".contents.history .empty .link:hover:not(:disabled)", "a.pl-inline:hover", ".pl-showall:hover", ".pl-out:hover", ".vc-name:hover"]) {
    expect(each(words![0]), place).toContain(place);
  }
  expect(words?.[1]).toBe("border-radius: var(--radius-small); background: var(--shade); box-shadow: 0 0 0 var(--space-1) var(--shade); -webkit-box-decoration-break: clone; box-decoration-break: clone;");
  // A step's quiet words turn to ink on it, and a link to the colour for what a person acts on under the pointer.
  expect(app).toContainEqual([".tool .more:hover:not(:disabled), .shell .more:hover:not(:disabled)", "color: var(--ink);"]);
  // The sign-in card's links and the road's take the page's ground, as their pages lie on the page's ground alone.
  expect(rules(site("door.css")).find(([selector]) => selector === ".cl-formResendCodeLink:hover:not(:disabled), .cl-backLink:hover, .cl-footerActionLink:hover, .door-help a:hover")?.[1]).toContain("background: var(--float-hover); box-shadow: 0 0 0 var(--space-1) var(--float-hover);");
  for (const [sheet, selector] of [["road.css", ".road-link:hover:not(:disabled)"], ["road.css", ".road-tick a:hover"], ["door.css", ".door-legal a:hover"]]) {
    expect(rules(site(sheet!)).find(([one]) => one === selector)?.[1], selector).toContain("background: var(--float-hover); box-shadow: 0 0 0 var(--space-1) var(--float-hover);");
  }
  // The road and the sign-in page read no app.css, so their bare links say no underline themselves, against the browser's own.
  expect(rules(site("road.css")).find(([one]) => one === ".road-tick a")?.[1]).toContain("text-decoration: none;");
  expect(rules(site("door.css")).find(([one]) => one === ".door-legal a")?.[1]).toContain("text-decoration: none;");
});
