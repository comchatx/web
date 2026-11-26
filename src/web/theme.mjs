#!/usr/bin/env node
// The product's theme, written from the four brand colours and their dark-ground column, which are the four below and nothing else.
//
//   node src/web/theme.mjs          writes site/theme.css, and the style board's sheet-data.js under spikes/style/; prints the ratios
//   node src/web/theme.mjs --check  writes nothing; fails if a written file is stale, a pair misses its floor, cx.js holds a colour of
//                                   its own, or a board file holds a colour, size, radius, slant or face of its own
//
// Every colour is derived here and nowhere else: site/theme.css is the one file the pages, cx and the style board read.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ---- colour arithmetic: sRGB hex, OKLab and OKLCH, WCAG 2 contrast ----
const channels = (hex) => { const n = parseInt(hex.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255); };
const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const gamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const luminance = (hex) => { const [r, g, b] = channels(hex).map(linear); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const toLab = (hex) => {
  const [r, g, b] = channels(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const fromLab = ([L, A, B]) => {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return toHex([4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(gamma));
};
/** `a` moved toward `b` by `t`, in OKLab, so a tint keeps the hue it comes from. */
const mix = (a, b, t) => { const A = toLab(a), B = toLab(b); return fromLab(A.map((v, i) => v + (B[i] - v) * t)); };
/** `a` moved toward `b` by `t` in sRGB, as CSS's `color-mix(in srgb, …)` draws it: the signed prototypes mixed so. */
const mixRgb = (a, b, t) => { const A = channels(a), B = channels(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
const oklch = (L, C, H) => fromLab([L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)]);
const lch = (hex) => { const [L, a, b] = toLab(hex); return { L, C: Math.hypot(a, b), H: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 }; };
/** `hex` seen through at `alpha`: the same colour with an alpha byte, for what lies over the page and lets it show. */
const alpha = (hex, a) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0").toUpperCase()}`;
const bisect = (make, grounds, target) => {
  let lo = 0, hi = 1;
  for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (grounds.every((g) => ratio(make(mid), g) >= target)) hi = mid; else lo = mid; }
  if (!grounds.every((g) => ratio(make(hi), g) >= target)) throw new Error(`no colour on the line reaches ${target}:1`);
  return make(hi);
};
/** The least of `b` mixed into `a` that reads at `target` on every one of `grounds`: the quietest colour that still passes. */
const reach = (a, b, grounds, target) => bisect((t) => mix(a, b, t), grounds, target);
/** `hex` at its own hue and chroma, darkened until it reads at `target` on every one of `grounds`. */
const deepen = (hex, grounds, target) => { const { L, C, H } = lch(hex); return bisect((t) => oklch(L * (1 - t), C, H), grounds, target); };
/** `hex` at its own hue and chroma, lightened until it reads at `target` on every one of `grounds`. */
const lighten = (hex, grounds, target) => { const { L, C, H } = lch(hex); return bisect((t) => oklch(L + (1 - L) * t, C, H), grounds, target); };

// ---- the brand: the logo's colours on a light ground, and on a dark one ----
const LIGHT = Object.freeze({ paper: "#FAF7F0", ink: "#1B2420", forest: "#1E4A38", sand: "#BE9257" });
const DARK = Object.freeze({ paper: "#0E110E", ink: "#EDE8DC", forest: "#4E8B6F", sand: "#D8B183" });
// The one job no brand colour can carry is an error: forest is what a person acts on, sand is money, ink is everything else. Brick:
// sand's warmth turned toward red, at a chroma near the brand's own.
const ERROR = Object.freeze({ light: oklch(0.5, 0.14, 28), dark: oklch(0.72, 0.12, 28) });
// cx's own props from src/web/cx.js, part of its figure and so kept: the pencil's wood and its chalk.
const CX_PROPS = Object.freeze({ sandLight: "#EBD9A9", chalk: "#F3EFE4" });

// The floors: body text 4.5:1; large text, a control's outline and a drawn mark 3:1 (WCAG 2.2 AA, 1.4.3 and 1.4.11).
const BODY = 4.5, LARGE = 3;

// A was chosen on 2026-09-29; B (forest) and C (cx at work) are round 1's, in the history of this directory.
export const DIRECTION = Object.freeze({ name: "A, paper and ink", idea: "Paper ground and ink text; forest is only what a person acts on, and sand is only money." });
const THEMES = Object.freeze(["light", "dark"]);

/** The theme in light or dark: every token by its job, as [value, how it was derived]; the second is written beside the value in theme.css and shown on the sheet. */
function tokens(theme) {
  const t = {};
  const set = (name, value, how) => { if (t[name]) throw new Error(`${theme}: ${name} set twice`); t[name] = [value, how]; return value; };
  const v = (name) => { if (!t[name]) throw new Error(`${theme}: ${name} read before it is set`); return t[name][0]; };
  const light = theme === "light";
  const P = light ? LIGHT.paper : LIGHT.ink;          // the ground
  const I = light ? LIGHT.ink : DARK.ink;             // the text
  const F = light ? LIGHT.forest : DARK.forest;       // the logo's forest for this ground
  const S = light ? LIGHT.sand : DARK.sand;           // the logo's sand for this ground
  const err = light ? ERROR.light : ERROR.dark;
  const toward = light ? "ink" : "light ink";
  const into = light ? "paper" : "ink";

  // The page
  set("ground", P, light ? "paper" : "ink: the dark ground starts at the brand's ink, not at black");
  set("raised", light ? mix(P, "#FFFFFF", 0.6) : mix(P, I, 0.045), light ? "paper lifted 60% toward white" : "light ink 4.5% into ink");
  set("wash", mix(P, I, light ? 0.06 : 0.075), `${toward} ${light ? 6 : 7.5}% into ${into}`);
  set("hover", mix(P, I, light ? 0.045 : 0.06), `${toward} ${light ? 4.5 : 6}% into ${into}`);
  // The value a choice holds: its pill on the wash. On paper it is the raised surface; on a dark ground a raised one would sit darker than
  // the wash, so it is lifted past it (ruled 2026-11-19).
  set("held", light ? v("raised") : mix(P, I, 0.2), light ? "raised: the value a choice holds, its pill on the wash" : "light ink 20% into ink: the value a choice holds, its pill a step lighter than the wash");
  set("line", mix(P, I, light ? 0.13 : 0.15), `${toward} ${light ? 13 : 15}% into ${into}: a rule, and every bar's track`);
  set("mark", mix(P, I, light ? 0.12 : 0.17), `${toward} ${light ? 12 : 17}% into ${into}: a word a step changed`);
  set("ink", I, light ? "ink" : "the logo's ink on a dark ground (§8.2)");

  // What a person acts on: a button, a link, the focus ring, selected text, a switch that is on
  if (light) {
    set("act", F, "forest");
    set("act-ink", P, "paper");
    set("act-hover", mix(F, I, 0.3), "ink 30% into forest");
    set("act-wash", mix(P, F, 0.12), "forest 12% into paper: selected text");
  } else {
    set("act", lighten(F, [v("ground"), v("raised"), v("wash"), v("hover")], BODY + 0.5), "the logo's dark-ground forest, lightened until it reads 5:1 on the ground, raised, wash and hover");
    set("act-ink", P, "ink");
    set("act-hover", mix(v("act"), I, 0.25), "light ink 25% into act");
    set("act-wash", mix(P, F, 0.24), "the dark-ground forest 24% into ink: selected text");
  }

  // A step, running or finished, is the page's wash; work under way is said in words, not colour
  set("step", v("wash"), "wash");
  set("step-edge", v("wash"), "wash: a finished step has no edge");
  set("live-wash", v("wash"), "wash: a running step keeps the step's ground");
  const stepIn = light ? 0.045 : 0.06;
  set("step-hover", mix(mix(v("wash"), I, stepIn), I, stepIn), `${toward} ${light ? 4.5 : 6}% into wash, twice: the ground under the pointer on a step`);

  // Money: the person's own money, and nothing else. Spend figures and the balance, the receipt, the cost bars, and a price
  // on the product's own controls; an amount inside an answer's text is ink.
  set("money-wash", mix(P, S, light ? 0.16 : 0.14), `${light ? "sand 16% into paper" : "the dark-ground sand 14% into ink"}`);
  // Failure: the one hue the brand does not have, for what failed and may need the person to act. A warning is not a failure: a step
  // the person stopped says so in ink, and a wait that ends by itself is quiet.
  set("bad", err, `brick, oklch(${light ? "0.50 0.14" : "0.72 0.12"} 28): the one new hue, for a job no brand colour carries`);
  set("bad-wash", mix(P, err, light ? 0.08 : 0.12), `brick ${light ? 8 : 12}% into ${into}`);
  set("bad-line", mix(P, err, 0.45), `brick 45% into ${into}`);

  // The page's quiet text, and every colour whose floor depends on the grounds it sits on
  const grounds = ["ground", "raised", "wash", "hover", "step", "live-wash", "bad-wash", "act-wash"].map(v);
  set("quiet", reach(P, I, grounds, BODY + 0.1), `the least ${toward} in ${into} that reads 4.6:1 on every ground it sits on`);
  // Thinking is read in full, never folded, so it reads at 7:1 (AAA), above the quiet colour, and a step back from the answer's ink.
  set("thinking", reach(P, I, [v("ground")], 7), `the least ${toward} in ${into} that reads 7:1 on the ground: read in full, so above quiet, and a step back from ink`);
  set("edge", reach(P, I, [v("ground"), v("raised"), v("wash")], LARGE + 0.05), `the least ${toward} in ${into} that outlines a control at 3:1 on every ground a control sits on`);
  set("float-edge", mix(P, I, light ? 0.24 : 0.26), `${toward} ${light ? 24 : 26}% into ${into}: the outline of what lies over the page, in a shadow's place`);
  set("live", v("quiet"), "quiet: work under way is said in words, not colour");
  set("live-edge", v("edge"), "edge: the running step is the one with an outline");
  set("money", light ? deepen(S, [v("ground"), v("raised"), v("wash"), v("money-wash")], BODY + 0.3) : S,
    light ? "sand's own hue and chroma, darkened until it reads 4.8:1 on every ground money sits on" : "the logo's sand on a dark ground (§8.2)");
  // A spending bar's parts are strengths of money's colour, since money is the one colour for the person's money and none is for a
  // category: the strongest at the foot, each 3:1 on the settings window's ground. Past three, a part is money hatched.
  set("money-bar-1", mixRgb(v("money"), v("ink"), 0.55), "ink 55% into money: a spending bar's foot");
  set("money-bar-2", light ? v("money") : mixRgb(v("raised"), v("money"), 0.78), light ? "money: a spending bar's second part" : "money 78% into raised: a spending bar's second part");
  set("money-bar-3", mixRgb(v("raised"), v("money"), light ? 0.75 : 0.55), `money ${light ? 75 : 55}% into raised: a spending bar's third part`);

  // The frame: the sidebar, a shade off the page
  const frame = mix(P, light ? I : DARK.paper, light ? 0.035 : 0.3);
  set("frame", frame, light ? "ink 3.5% into paper" : "ink 30% toward the logo's dark ground, still near ink");
  set("frame-hover", mix(frame, I, light ? 0.045 : 0.06), `${toward} ${light ? 4.5 : 6}% into the frame: a row under the pointer, and the page you are on`);
  set("frame-line", v("line"), "line");
  set("frame-ink", I, toward);
  set("frame-quiet", reach(frame, I, [v("frame"), v("frame-hover")], BODY + 0.1), `the least ${toward} in the frame that reads 4.6:1`);
  set("frame-money", light ? deepen(S, [v("frame"), v("frame-hover")], BODY + 0.3) : S, light ? "sand's hue, darkened until it reads 4.8:1 on the frame" : "the logo's sand on a dark ground (§8.2)");
  set("corner", P, "ground: cx sits on the page");

  // Over the page: a menu or cx's bubble, drawn by its outline; a dialog, over the page it stops
  set("float-hover", mix(v("hover"), I, light ? 0.045 : 0.06), `${toward} ${light ? 4.5 : 6}% into hover: a row under the pointer in a menu or a list of ticks, and the ground under the pointer app-wide on anything a person can press`);
  set("float-shadow", "none", "none: what lies over the page is drawn by its outline");
  set("scrim", light ? alpha(I, 0.3) : alpha(DARK.paper, 0.6), light ? "ink at 30%: the page under a dialog, still seen" : "the logo's dark ground at 60%: the page under a dialog, still seen");

  // The logo, as §8.2 draws it: its light-ground colours on paper, its dark-ground colours on a dark ground
  set("logo-forest", light ? LIGHT.forest : DARK.forest, light ? "the logo (§8.2)" : "the logo on a dark ground (§8.2)");
  set("logo-sand", light ? LIGHT.sand : DARK.sand, light ? "the logo (§8.2)" : "the logo on a dark ground (§8.2)");

  // cx and its computer: the colours cx.js reads. cx's figure keeps the brand's two halves; the computer is drawn from the page's greys.
  const base = v("corner");
  const halves = light ? LIGHT : DARK;
  const shadeTo = light ? LIGHT.ink : DARK.paper;
  set("cx-line", I, `${toward}: cx's pencil`);
  set("cx-forest", halves.forest, light ? "the logo's forest" : "the logo's forest on a dark ground (§8.2)");
  set("cx-forest-shade", mix(halves.forest, shadeTo, 0.3), "cx's forest 30% toward the darkest brand colour");
  set("cx-sand", halves.sand, light ? "the logo's sand" : "the logo's sand on a dark ground (§8.2)");
  set("cx-sand-shade", mix(halves.sand, shadeTo, 0.32), "cx's sand 32% toward the darkest brand colour");
  set("cx-sand-light", CX_PROPS.sandLight, "cx's pencil wood (cx.js)");
  set("cx-chalk", CX_PROPS.chalk, "cx's chalk (cx.js)");
  const shade = (k, why) => set(`cx-${why}`, mix(base, I, k), `${toward} ${Math.round(k * 100)}% into ${into}`);
  if (light) {
    shade(0.1, "bezel"); shade(0.05, "bezel-top"); shade(0.18, "bezel-side"); shade(0.08, "tube-top"); shade(0.22, "tube-side");
  } else {
    shade(0.16, "bezel"); shade(0.24, "bezel-top"); shade(0.1, "bezel-side"); shade(0.2, "tube-top"); shade(0.07, "tube-side");
  }
  set("cx-paper", v("money-wash"), "money-wash: the receipt cx reads is money");
  set("cx-coin", v("money"), "money: the coin cx's screen shows when the balance is too low");
  set("cx-screen-off", light ? I : DARK.paper, light ? "ink: the screen dark" : "the logo's dark ground: the screen dark");
  set("cx-screen-on", light ? v("raised") : mix(P, I, 0.28), light ? "raised: the screen lit" : "light ink 28% into ink: the screen lit");
  set("cx-good", v("act"), "act: the computer is a control");
  set("cx-warn", mix(F, P, 0.35), "forest toward the ground: the light while the computer comes on");
  set("cx-quiet", v("quiet"), "quiet");
  set("cx-accent", I, `${toward}: the marks on cx's screen`);
  set("cx-bad", v("bad"), "bad: a refusal's cross");
  return t;
}

// The order tokens are written in, grouped by job; a token missing from a set, or set and not listed, is a bug in `tokens`.
const ORDER = Object.freeze([
  ["The page", ["ground", "raised", "wash", "hover", "held", "line", "edge", "mark", "ink", "quiet"]],
  ["Thinking: the model's own voice, upright and in full, never folded", ["thinking"]],
  ["The frame: the sidebar, and cx's corner", ["frame", "frame-hover", "frame-line", "frame-ink", "frame-quiet", "frame-money", "corner"]],
  ["What a person acts on: buttons, links, focus, selected text, a switch that is on", ["act", "act-ink", "act-hover", "act-wash"]],
  ["A step, and work under way", ["step", "step-edge", "step-hover", "live", "live-wash", "live-edge"]],
  ["Money: the person's own money, and nothing else", ["money", "money-wash", "money-bar-1", "money-bar-2", "money-bar-3"]],
  ["Failure: what failed and may need the person to act; a warning is not one", ["bad", "bad-wash", "bad-line"]],
  ["Over the page: a menu, cx's bubble, a dialog", ["float-edge", "float-hover", "float-shadow", "scrim"]],
  ["The logo", ["logo-forest", "logo-sand"]],
  ["cx and its computer: what cx.js reads", ["cx-line", "cx-forest", "cx-forest-shade", "cx-sand", "cx-sand-shade", "cx-sand-light", "cx-chalk", "cx-bezel", "cx-bezel-top", "cx-bezel-side", "cx-tube-top", "cx-tube-side", "cx-paper", "cx-coin", "cx-screen-off", "cx-screen-on", "cx-good", "cx-warn", "cx-quiet", "cx-accent", "cx-bad"]],
]);

/** Every pair of a text or mark and the ground it is drawn on, as the board draws them: [foreground, ground, floor, where]. */
export const PAIRS = Object.freeze([
  ["ink", "ground", BODY, "an answer's text; a page's title; a purchase; Stopped under the person's own command"],
  ["ink", "wash", BODY, "the person's message; a code block; a table's head; the banner"],
  ["ink", "raised", BODY, "the message box; a menu; a card; the install card; cx's bubble"],
  ["ink", "hover", BODY, "a row under the pointer"],
  ["ink", "held", BODY, "the value a choice holds: Appearance, a span of time, the Discover view chosen"],
  ["ink", "step", BODY, "a finished step's name; Stopped on a step the person stopped"],
  ["ink", "live-wash", BODY, "a running step's name"],
  ["ink", "bad-wash", BODY, "a failed step's name"],
  ["ink", "mark", BODY, "a word a step changed"],
  ["ink", "act-wash", BODY, "selected text"],
  ["thinking", "ground", BODY, "thinking, in full"],
  ["thinking", "wash", BODY, "code inside thinking"],
  ["quiet", "ground", BODY, "the Thinking label; a status line said quietly; a tab not chosen; a purchase's time"],
  ["quiet", "raised", BODY, "the message box's placeholder; a menu's hint; a card's author; the Off tag; a price's words; Don't show again"],
  ["quiet", "wash", BODY, "the banner's kicker; Installed and Send while they cannot be pressed"],
  ["quiet", "hover", BODY, "a hint under the pointer"],
  ["ink", "float-hover", BODY, "anything a person can press, under the pointer"],
  ["act-hover", "float-hover", BODY, "a link under the pointer"],
  ["ink", "step-hover", BODY, "a step's words under the pointer"],
  ["act-hover", "step-hover", BODY, "a link in a step under the pointer"],
  ["quiet", "float-hover", BODY, "a row's second line, in a menu or a list of ticks, under the pointer"],
  ["quiet", "step", BODY, "a finished step's command and output; a saved file's body"],
  ["quiet", "live-wash", BODY, "a running step's command"],
  ["quiet", "bad-wash", BODY, "a failed step's error, as pi returned it"],
  ["live", "live-wash", BODY, "Running for 4 sec"],
  ["live", "ground", BODY, "the status line while cx works"],
  ["frame-ink", "frame", BODY, "the sidebar's text"],
  ["frame-ink", "frame-hover", BODY, "a sidebar row under the pointer, or the page you are on"],
  ["frame-quiet", "frame", BODY, "the sidebar's date and counts"],
  ["frame-quiet", "frame-hover", BODY, "a count under the pointer"],
  ["frame-money", "frame", BODY, "a data source's figure this month; the balance"],
  ["frame-money", "frame-hover", BODY, "a data source's figure on the page you are on"],
  ["act", "ground", BODY, "a link: ← Plugins, All spending this month, See balance"],
  ["act", "raised", LARGE, "the focus ring on a card, a menu or the install card"],
  ["act", "held", LARGE, "the focus ring on the value a choice holds"],
  ["act", "step", BODY, "a file named in a finished step"],
  ["act", "live-wash", BODY, "a file named in a running step"],
  ["act-ink", "act", BODY, "Send, Create, Install"],
  ["act-ink", "act-hover", BODY, "the same under the pointer"],
  ["act", "ground", LARGE, "a button's shape; a switch that is on; the focus ring"],
  ["money", "money-wash", BODY, "a figure on the money wash"],
  ["money", "ground", BODY, "the month's figure; a purchase's cost; the line that warns of the balance"],
  ["money", "raised", BODY, "a price and the balance in the install card"],
  ["money", "line", LARGE, "a bar of money on its track: the credit bar, a warned bar, a lot's bar in Settings"],
  ["quiet", "line", LARGE, "a bar on its track: the computer's three, cx's card, the model picker, a Plugins usage bar"],
  ["bad", "line", LARGE, "a failed bar on its track"],
  ["money-bar-1", "raised", LARGE, "a spending bar's foot in the settings window"],
  ["money-bar-2", "raised", LARGE, "a spending bar's second part in the settings window"],
  ["money-bar-3", "raised", LARGE, "a spending bar's third part in the settings window"],
  ["ink", "line", LARGE, "a Plugins usage bar on its track, under the pointer or the keyboard"],
  ["ink", "ground", LARGE, "a day's bar on a Usage tab: the month's shape, its amounts in money's colour beside it"],
  ["bad", "bad-wash", BODY, "Failed"],
  ["bad", "ground", BODY, "a status line that says something failed"],
  ["edge", "ground", LARGE, "the outline of a control, and of the running step"],
  ["edge", "raised", LARGE, "an outline on the message box, the search box or a card's +; a switch that is off"],
  ["edge", "wash", LARGE, "the outline of a control on the banner: View"],
  ["live-edge", "ground", LARGE, "the running step's outline"],
  ["cx-line", "corner", LARGE, "cx's pencil on its corner"],
]);

const SCALES = `/* ---- The scales: one set for light and dark ---- */
:root {
  /* Type. System faces only: the platform's UI face for Latin, PingFang SC and the platform's CJK faces for Chinese, a page's title
     included; the system monospace for code and figures. No web font is loaded. */
  --font-ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", sans-serif;
  --font-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", "Noto Sans Mono", "PingFang SC", "Microsoft YaHei", monospace;
  /* Six sizes, in rem of the browser's own 16px. */
  --size-caption: 0.75rem;   /* 12px: a tag, a column head, the fine print */
  --size-small: 0.8125rem;   /* 13px: the sidebar, a step, the status line, the model card, a card's text, a table */
  --size-body: 0.9375rem;    /* 15px: the conversation; a card's name; a tab */
  --size-lead: 1.0625rem;    /* 17px: the wordmark; a heading in an answer; a section's name; a dialog's title */
  --size-title: 1.25rem;     /* 20px: a section's title; the banner's name; the month's figure */
  --size-display: 1.625rem;  /* 26px: a page's title */
  --leading-body: 1.65;
  --leading-small: 1.5;
  --leading-tight: 1.3;
  --leading-glyph: 1;        /* one glyph centred in its mark */
  --weight-regular: 400;
  --weight-strong: 600;
  /* Spacing, on a 4px step with a 2px and a 6px for tight rows. */
  --space-1: 0.125rem;  /* 2px */
  --space-2: 0.25rem;   /* 4px */
  --space-3: 0.375rem;  /* 6px */
  --space-4: 0.5rem;    /* 8px */
  --space-5: 0.75rem;   /* 12px */
  --space-6: 1rem;      /* 16px */
  --space-7: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-9: 3rem;      /* 48px */
  /* A row of a menu or a list: the model card's rows, the plugins' rows. */
  --row: 2.2rem;
  /* Radii: a tag, a control, a surface; round only for the avatar, a switch and a dot. */
  --radius-small: 4px;
  --radius: 6px;
  --radius-large: 12px;
  --radius-round: 999px;
  /* Motion: one quick settle, never a bounce. */
  --motion-quick: 120ms;
  --ease: cubic-bezier(0.2, 0, 0, 1);
  /* The glass over the board while cx's computer is off (ruled 2026-11-12): how far it blurs what lies under it, how much of the
     ground it lays over it (half that while the computer starts), and how long it takes to clear as the board comes. */
  --glass-blur: 8px;
  --glass-wash: 50%;
  --glass-clear: 360ms;
}
`;

function css(sets) {
  const blocks = THEMES.map((theme) => {
    const t = sets[theme];
    const selector = theme === "light" ? `:root, [data-theme="light"]` : `[data-theme="dark"]`;
    const lines = [`/* ---- ${DIRECTION.name}, ${theme} ---- */`, `${selector} {`, `  color-scheme: ${theme};`];
    for (const [group, names] of ORDER) {
      lines.push(`  /* ${group} */`);
      for (const n of names) {
        if (!t[n]) throw new Error(`${theme}: ${n} is not set`);
        lines.push(`${`  --${n}: ${t[n][0]};`.padEnd(30)} /* ${t[n][1]} */`);
      }
    }
    const extra = Object.keys(t).filter((n) => !ORDER.some(([, names]) => names.includes(n)));
    if (extra.length) throw new Error(`${theme}: set but not written: ${extra.join(", ")}`);
    lines.push("}");
    return lines.join("\n");
  });
  return `/*
 * The theme, ${DIRECTION.name}: ${DIRECTION.idea.charAt(0).toLowerCase()}${DIRECTION.idea.slice(1)}
 * Final: signed off on 2026-09-29, after four rounds on the style board (spikes/style/).
 * Colours named by their job, a type scale of six sizes, a spacing scale and a radius set, which the pages, cx and the board read,
 * and nothing else holds. Light and dark are two value sets under the same names: light on :root, dark on [data-theme="dark"], and
 * either on any element that names it. Switching theme swaps these values and nothing else.
 * Written by theme.mjs from the four brand colours it holds; change them or the derivation there, not here.
 */
${SCALES}
${blocks.join("\n\n")}
`;
}

/** The sheet's data: each theme's values and their derivations, and the pairs, as a classic script (opens from file://). */
function sheetData(sets) {
  const values = Object.fromEntries(THEMES.map((theme) => [theme, Object.fromEntries(Object.entries(sets[theme]))]));
  const data = { direction: DIRECTION, groups: ORDER, pairs: PAIRS, values };
  return `// Written by theme.mjs: what the sheet shows beside the values it reads back off the page. Not read by any drawing.\nglobalThis.StyleSheetData = Object.freeze(${JSON.stringify(data)});\n`;
}

// ---- cx: src/web/cx.js reads every colour from the theme's cx-* names; what it keeps as drawn is its props, the same on any ground ----
// The magnifier's glass and its glint, the pencil's cut wood.
const CX_KEPT = Object.freeze(["rgba(255,255,255,0.55)", "rgba(255,255,255,0.22)", "#FFFFFF", "#E8D9B5"]);
function cxOwn(text) {
  const code = text.replace(/\/\/[^\n]*/g, "");
  const left = [...code.matchAll(/#[0-9A-Fa-f]{6}\b|rgba?\([^)]*\)|\bvar\(--cx-[a-z-]+,/g)].map((m) => m[0]).filter((s) => !CX_KEPT.includes(s));
  return left.map((s) => `src/web/cx.js: a colour of its own, ${JSON.stringify(s)}`);
}

// ---- the board's own files hold no colour, size, radius or face: everything they draw comes from the theme ----
const BOARD_FILES = Object.freeze(["index.html", "board.css", "board.js", "content.js"]);
/**
 * CSS's named colours: a value a stylesheet could hold of its own. `transparent` and `currentColor` name no colour and stay allowed, and
 * so does a quoted SVG attribute, which on the board is a mask's coverage (`fill: "white"` shows, `"black"` hides), never a colour seen.
 */
const NAMED = Object.freeze("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(" "));
const OWN = Object.freeze([
  [/#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?(?:[0-9A-Fa-f]{2})?\b(?![,\d])/g, "a hex colour"],
  [/\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix)\(/g, "a colour function"],
  [new RegExp(`\\b(?:[a-z-]*color|background|border|outline|fill|stroke|[a-z-]*shadow|caret-color|accent-color)[a-z-]*:\\s*[^;{}"]*?(?<![\\w"-])(?:${NAMED.join("|")})(?![\\w-])`, "gi"), "a named colour"],
  [/\bfont-size:\s*(?:[\d.]|(?:xx?x?-)?(?:small|medium|large)\b|smaller\b|larger\b)/g, "a font size of its own"],
  [/\bborder(?:-(?:top|bottom|start|end))?(?:-(?:left|right|start|end))?-radius:\s*[\d.]/g, "a radius of its own"],
  [/\bfont-weight:\s*(?:[\d.]|bold|bolder|lighter|normal)/g, "a weight of its own"],
  [/\bline-height:\s*(?:[\d.]|normal)/g, "a line height of its own"],
  [/\bfont-style:\s*(?:italic|oblique)/g, "a slant, which nothing on the board takes"],
  [/\bfont-family:(?!\s*var\(--font-)/g, "a face of its own"],
  [/\bfont:(?!\s*inherit\s*;)(?![^;]*var\(--font-)/g, "a face of its own, in the font shorthand"],
]);
/** What a stylesheet or script holds of its own, where it should read the theme's names. */
export function ownValues(name, text) {
  const found = [];
  const body = name.endsWith(".js") ? text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "") : text.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [pattern, what] of OWN) for (const m of body.matchAll(pattern)) found.push(`${name}: ${what}, ${JSON.stringify(m[0])}`);
  return found;
}

function measure(sets) {
  const rows = [];
  for (const theme of THEMES) {
    const t = sets[theme];
    for (const [fg, bg, floor, where] of PAIRS) {
      if (!t[fg] || !t[bg]) throw new Error(`pair ${fg} on ${bg}: unknown token`);
      rows.push({ theme, fg, bg, floor, where, value: ratio(t[fg][0], t[bg][0]) });
    }
  }
  return rows;
}

/** The names theme.css sets: the only custom properties a page's stylesheet reads. */
export const themeNames = (text) => new Set([...text.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]));

const at = (path) => fileURLToPath(new URL(path, import.meta.url));
const BOARD_DIR = at("../../spikes/style/");

/** The files the generator writes, the ratios it prints, and every problem --check finds; writes nothing. The style board is written and
 * read only where it is: the public copy of the page has no `spikes/`. */
export function check(board = BOARD_DIR) {
  const onBoard = existsSync(board);
  const BOARD = (name) => `${board}${name}`;
  const sets = Object.fromEntries(THEMES.map((theme) => [theme, tokens(theme)]));
  const written = [[at("site/theme.css"), css(sets)], ...(onBoard ? [[BOARD("sheet-data.js"), sheetData(sets)]] : [])];
  const problems = [];
  for (const [path, body] of written) {
    let now = "";
    try { now = readFileSync(path, "utf8"); } catch { /* missing is stale */ }
    if (now !== body) problems.push(`${path} is stale: run node src/web/theme.mjs`);
  }
  problems.push(...cxOwn(readFileSync(at("cx.js"), "utf8")));
  if (onBoard) for (const name of BOARD_FILES) problems.push(...ownValues(name, readFileSync(BOARD(name), "utf8")));
  const rows = measure(sets);
  const lines = THEMES.map((theme) => {
    const mine = rows.filter((r) => r.theme === theme);
    const low = mine.reduce((m, r) => (r.value / r.floor < m.value / m.floor ? r : m));
    const passing = mine.filter((r) => r.value >= r.floor).length;
    return `${theme.padEnd(5)}: ${passing} of ${mine.length} pairs pass; closest to its floor: --${low.fg} on --${low.bg} ${low.value.toFixed(2)}:1 (floor ${low.floor})`;
  });
  for (const r of rows.filter((r) => r.value < r.floor)) problems.push(`${r.theme}: --${r.fg} on --${r.bg} is ${r.value.toFixed(2)}:1, under ${r.floor} (${r.where})`);
  return { written, lines, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { written, lines, problems } = check();
  if (!process.argv.includes("--check")) for (const [path, body] of written) writeFileSync(path, body);
  for (const line of lines) console.log(line);
  // Written just now, a stale file is not a problem; everything else is.
  const left = process.argv.includes("--check") ? problems : problems.filter((p) => !p.endsWith("is stale: run node src/web/theme.mjs"));
  for (const p of left) console.error(`  ${p}`);
  if (left.length) process.exitCode = 1;
}
