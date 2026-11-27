import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { check, ownValues, PAIRS } from "./theme.mjs";

// `npm run check` runs the generator's check; this runs it where CI runs, so a stale theme or a pair under its floor stops the merge.
it("finds the theme current, every pair at its floor in both sets, and cx and the board holding no colour of their own", () => {
  const { lines, problems } = check();
  expect(problems).toEqual([]);
  expect(lines).toEqual([expect.stringMatching(new RegExp(`^light: ${PAIRS.length} of ${PAIRS.length} pairs pass`)), expect.stringMatching(new RegExp(`^dark : ${PAIRS.length} of ${PAIRS.length} pairs pass`))]);
  expect(PAIRS).toHaveLength(63);
});

it("checks the theme alone where the style board is not, as in the page's public copy", () => {
  const without = check(join(import.meta.dirname, "no-style-board/"));
  expect(without.written.map(([path]) => path.split("/").at(-1))).toEqual(["theme.css"]);
  expect(without.problems).toEqual([]);
});

it("cuts the ground of a row over the page under the pointer from the hover surface as the sidebar's is cut from the frame, with ink and quiet held on it", () => {
  const css = check().written.find(([path]) => path.endsWith("theme.css"))![1];
  const [light, dark] = css.split('[data-theme="dark"] {');
  const read = (block: string, name: string): string => new RegExp(`--${name}: (#[0-9A-F]{6});\\s*/\\* ([^*]*) \\*/`).exec(block)!.slice(1).join(" | ");
  expect(read(light!, "frame-hover")).toMatch(/ \| ink 4\.5% into the frame: /);
  expect(read(light!, "float-hover")).toMatch(/^#E4E2DB \| ink 4\.5% into hover: /);
  expect(read(dark!, "frame-hover")).toMatch(/ \| light ink 6% into the frame: /);
  expect(read(dark!, "float-hover")).toMatch(/^#2F3832 \| light ink 6% into hover: /);
  expect(PAIRS.filter(([, ground]) => ground === "float-hover").map(([text]) => text)).toEqual(["ink", "act-hover", "quiet", "warn"]);
  // A step's block lies on the wash: the ground under the pointer there is cut from it as the page's is from the ground, two steps in.
  expect(read(light!, "step-hover")).toMatch(/^#[0-9A-F]{6} \| ink 4\.5% into wash, twice: /);
  expect(read(dark!, "step-hover")).toMatch(/^#[0-9A-F]{6} \| light ink 6% into wash, twice: /);
  expect(PAIRS.filter(([, ground]) => ground === "step-hover").map(([text]) => text)).toEqual(["ink", "act-hover"]);
});

it("lays anything a person presses on one ground under the pointer, the same name in both themes, since dark's hover is too close to its raised to show", () => {
  const css = readFileSync(join(import.meta.dirname, "site", "app.css"), "utf8");
  const [, dark] = check().written.find(([path]) => path.endsWith("theme.css"))![1].split('[data-theme="dark"] {');
  const value = (name: string): number => parseInt(new RegExp(`--${name}: #([0-9A-F]{6});`).exec(dark!)![1]!, 16);
  // How far apart two greys are: the largest step of one channel.
  const apart = (a: number, b: number): number => Math.max(...[16, 8, 0].map((shift) => Math.abs(((a >> shift) & 255) - ((b >> shift) & 255))));
  expect(apart(value("raised"), value("hover"))).toBeLessThan(4);
  expect(apart(value("raised"), value("float-hover"))).toBeGreaterThanOrEqual(12);
  expect(css).toContain(":root { --shade: var(--float-hover); }");
  expect(css).toContain("\nbutton:hover:not(:disabled, :where(.f-btn, .f-quiet, .f-icon, .f-select, .f-switch, .f-menu-row, .f-seg > button)) { background: var(--shade); }");
  // A quote's remove and retry, the model's trigger and its card's rows, the settings window's close and its linked lines
  // (its menu's rows are the set's, on the float's own ground), cx's go, a tab's close, a message's actions, a link drawn as a button, a way.
  const pressed = [
    ".quoted .remove:hover:not(:disabled)", ".quoted .file-card .retry:hover:not(:disabled)", ".mp-trigger:hover", ".mp-row:hover",
    ".sw-close:hover:not(:disabled)", "a.sw-line:hover", ".cx-bubble.go button:hover:not(:disabled)", ".tab-close:hover:not(:disabled)",
    ".actions button:hover:not(:disabled)", "a.button:hover", ".way:hover",
  ];
  const ground = (selector: string): string | undefined => new RegExp(`(?:^|[{,] )${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^{\n]*\\{ background: var\\((--[a-z-]+)\\);`, "m").exec(css)?.[1];
  for (const selector of pressed) expect(["--shade", "--float-hover"], selector).toContain(ground(selector));
  // No rule under the pointer keeps the lighter ground, and none draws dark apart from light.
  expect(css.match(/^[^{\n]*:hover[^{\n]*\{[^}\n]*background: var\(--hover\)/gm) ?? []).toEqual([]);
  expect(css.match(/^:where\(\[data-theme="dark"\]\).*var\(--float-hover\)/gm) ?? []).toEqual([]);
});

// Every custom property the stylesheet held when the Plugins pages' ground was approved, as literals: a ruled value changes here, in the commit that
// re-rules it, or nowhere. The generator is not read for them, since a table derived from it would follow whatever it wrote.
const RULED = {
  shared: {
   
    "font-ui": "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei UI\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", \"Noto Sans SC\", \"Source Han Sans SC\", sans-serif",
    "font-mono": "ui-monospace, \"SF Mono\", SFMono-Regular, Menlo, Consolas, \"Liberation Mono\", \"Noto Sans Mono\", \"PingFang SC\", \"Microsoft YaHei\", monospace", "size-caption": "0.75rem", "size-small": "0.8125rem",
    "size-body": "0.9375rem", "size-lead": "1.0625rem", "size-title": "1.25rem", "size-display": "1.625rem", "leading-body": "1.65", "leading-small": "1.5", "leading-tight": "1.3", "leading-glyph": "1", "weight-regular": "400",
    "weight-strong": "600", "space-1": "0.125rem", "space-2": "0.25rem", "space-3": "0.375rem", "space-4": "0.5rem", "space-5": "0.75rem", "space-6": "1rem", "space-7": "1.5rem", "space-8": "2rem", "space-9": "3rem",
    "row": "2.2rem", "radius-small": "4px", "radius": "6px", "radius-large": "12px", "radius-round": "999px", "motion-quick": "120ms", "ease": "cubic-bezier(0.2, 0, 0, 1)",
  },
  light: {
    "ground": "#FAF7F0", "raised": "#FDFCF9", "wash": "#EBE9E2", "hover": "#EFECE5", "held": "#FDFCF9", "line": "#D9D8D2", "edge": "#818680", "mark": "#DCDBD4", "ink": "#1B2420", "quiet": "#5E635E", "thinking": "#505652", "frame": "#F1EFE8",
    "frame-hover": "#E6E5DE", "frame-line": "#D9D8D2", "frame-ink": "#1B2420", "frame-quiet": "#616661", "frame-money": "#835A1C", "corner": "#FAF7F0", "act": "#1E4A38", "act-ink": "#FAF7F0", "act-hover": "#1E3E31",
    "act-wash": "#DEE1D8", "step": "#EBE9E2", "step-edge": "#EBE9E2", "live": "#5E635E", "live-wash": "#EBE9E2", "live-edge": "#818680", "money": "#865C1F", "money-wash": "#F1E7D7", "bad": "#A43C33", "bad-wash": "#F5E8E0",
    "bad-line": "#D8A398", "float-edge": "#BEBFB9", "float-shadow": "none", "scrim": "#1B24204D", "logo-forest": "#1E4A38", "logo-sand": "#BE9257", "cx-line": "#1B2420", "cx-forest": "#1E4A38", "cx-forest-shade": "#1E3E31",
    "cx-sand": "#BE9257", "cx-sand-shade": "#866D46", "cx-sand-light": "#EBD9A9", "cx-chalk": "#F3EFE4", "cx-bezel": "#E1DFD9", "cx-bezel-top": "#EDEBE4", "cx-bezel-side": "#CDCDC6", "cx-tube-top": "#E6E4DD",
    "cx-tube-side": "#C3C4BD", "cx-paper": "#F1E7D7", "cx-coin": "#865C1F", "cx-screen-off": "#1B2420", "cx-screen-on": "#FDFCF9", "cx-good": "#1E4A38", "cx-warn": "#688373", "cx-quiet": "#5E635E",
    "cx-accent": "#1B2420", "cx-bad": "#A43C33",
  },
  dark: {
    "ground": "#1B2420", "raised": "#232B27", "wash": "#28302C", "hover": "#252E29", "held": "#3F4641", "line": "#363D38", "edge": "#757971", "mark": "#3A413B", "ink": "#EDE8DC", "quiet": "#A1A298", "thinking": "#ADADA3", "frame": "#171E1A",
    "frame-hover": "#212824", "frame-line": "#363D38", "frame-ink": "#EDE8DC", "frame-quiet": "#8E8F86", "frame-money": "#D8B183", "corner": "#1B2420", "act": "#6CAA8C", "act-ink": "#1B2420", "act-hover": "#8DBA9F",
    "act-wash": "#273B32", "step": "#28302C", "step-edge": "#28302C", "live": "#A1A298", "live-wash": "#28302C", "live-edge": "#757971", "money": "#D8B183", "money-wash": "#32362D", "bad": "#E6867A", "bad-wash": "#312F2A",
    "bad-line": "#714F46", "float-edge": "#4B514B", "float-shadow": "none", "scrim": "#0E110E99", "logo-forest": "#4E8B6F", "logo-sand": "#D8B183", "cx-line": "#EDE8DC", "cx-forest": "#4E8B6F", "cx-forest-shade": "#3A634F",
    "cx-sand": "#D8B183", "cx-sand-shade": "#90785A", "cx-sand-light": "#EBD9A9", "cx-chalk": "#F3EFE4", "cx-bezel": "#383F3A", "cx-bezel-top": "#474D47", "cx-bezel-side": "#2D3530", "cx-tube-top": "#3F4641",
    "cx-tube-side": "#27302B", "cx-paper": "#32362D", "cx-coin": "#D8B183", "cx-screen-off": "#0E110E", "cx-screen-on": "#4F554F", "cx-good": "#6CAA8C", "cx-warn": "#3C6552", "cx-quiet": "#A1A298",
    "cx-accent": "#EDE8DC", "cx-bad": "#E6867A",
  },
} as const;

it("holds every value the theme had when the Plugins pages' ground was approved, in the shared set and in both themes", () => {
  const css = check().written.find(([path]) => path.endsWith("theme.css"))![1];
  const sets = [...css.matchAll(/^([^\n{}\/]*)\{\n(.*?)^\}/gms)].map(([, selector, body]) => [selector!.trim(), Object.fromEntries([...body!.matchAll(/^\s*--([a-z0-9-]+):\s*(.*?);\s*(?:\/\*.*\*\/)?\s*$/gm)].map(([, name, value]) => [name!, value!]))] as const);
  expect(sets.map(([selector]) => selector)).toEqual([":root", ':root, [data-theme="light"]', '[data-theme="dark"]']);
  const [shared, light, dark] = sets.map(([, values]) => values);
  expect(Object.values(RULED).reduce((count, set) => count + Object.keys(set).length, 0)).toBe(146);
  expect(shared).toMatchObject(RULED.shared);
  expect(light).toMatchObject(RULED.light);
  expect(dark).toMatchObject(RULED.dark);
});

it("refuses every way a stylesheet writes a value of its own, and lets the theme's names and the colourless words through", () => {
  const own = (css: string): readonly string[] => ownValues("t.css", css);
  for (const css of [
    "a { color: white; }", "a { background: var(--wash) tomato; }", "a { border: 1px solid Gray; }", "a { box-shadow: 0 0 2px black; }",
    "a { font-size: small; }", "a { font-size: x-large; }", "a { font-size: larger; }",
    "a { border-top-left-radius: 3px; }", "a { border-end-start-radius: 2px; }",
    "a { font-weight: bold; }", "a { font-weight: 500; }", "a { line-height: 1; }", "a { line-height: normal; }",
  ]) expect(own(css), css).toHaveLength(1);
  expect(own("a { color: currentColor; background: transparent; font-weight: var(--weight-strong); line-height: var(--leading-glyph); font-size: inherit; border-top-left-radius: var(--radius); }")).toEqual([]);
  expect(own('a { content: "black, gold"; } .tan { text-align: left; }')).toEqual([]);
});

it("holds the glass's three values agreed, read by the board's place while cx's computer is off and by nothing else, still under reduced motion", () => {
  const css = check().written.find(([path]) => path.endsWith("theme.css"))![1];
  const shared = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
  expect(["glass-blur", "glass-wash", "glass-clear"].map((name) => new RegExp(`--${name}: ([^;]+);`).exec(shared)?.[1])).toEqual(["8px", "50%", "360ms"]);
  const app = readFileSync(join(import.meta.dirname, "site", "app.css"), "utf8");
  const readers = app.split("\n").filter((line) => /var\(--glass-/.test(line));
  expect(readers.length).toBeGreaterThan(0);
  expect(readers.filter((line) => !/board-off|off-glass|under-glass|unglass|off-unglass/.test(line))).toEqual([]);
  expect(app).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^\n]*\.board-body\.unglass > :not\(\.board-off\)[^\n]*animation: none/);
});
