// What the tutorial's walks read off the page in Chrome, as scripts the page runs: one reading for every walk.

export type Box = readonly [left: number, top: number, right: number, bottom: number];

export type Read = { readonly title: string | null; readonly band: string; readonly px: number; readonly words: readonly string[]; readonly bare: number; readonly keyIn: boolean; readonly key?: Box | null; readonly figure?: Box; readonly bubble?: Box; readonly squeezed?: boolean; readonly held?: boolean };
/** Where the step stands: its title, the band given (the chat's foot or the Plugins page's top or foot), the words cx and its bubble lie on, how many they would lie on with no band, and whether the key is wholly in the window. */
export const READ = (selector: string): string => `(() => {
  const bubble = document.querySelector(".cx-bubble.teach");
  const title = bubble?.querySelector(".teach-title")?.textContent ?? null;
  // A sidebar entry's key is the button that opens the sidebar where it is shut.
  const key = ${JSON.stringify(selector)}.split(" || ").map((one) => document.querySelector(one)).find((el) => el && el.getClientRects().length > 0) ?? null;
  if (!bubble || !title) return { title, band: "", px: 0, words: [], bare: 0, keyIn: false };
  const parts = [document.querySelector(".cx-slot svg .cx-paper").getBoundingClientRect(), bubble.getBoundingClientRect()];
  const mine = (el) => el.closest(".cx-place, .cx-bubble, .ripple, .cx-slot") !== null;
  const modal = document.querySelector("dialog:modal");
  // Within 2 px, as the placement keeps clear (guide-place.ts).
  const hit = (a, b) => Math.min(a.right + 2, b.right) - Math.max(a.left - 2, b.left) > 0.5 && Math.min(a.bottom + 2, b.bottom) - Math.max(a.top - 2, b.top) > 0.5;
  const words = () => {
    const found = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!n.nodeValue.trim() || mine(el) || (modal && !modal.contains(el)) || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      range.selectNodeContents(n);
      let seen = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
      for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
        if (!/(auto|scroll|hidden)/.test(getComputedStyle(up).overflowY)) continue;
        const u = up.getBoundingClientRect();
        seen = { left: Math.max(seen.left, u.left), top: Math.max(seen.top, u.top), right: Math.min(seen.right, u.right), bottom: Math.min(seen.bottom, u.bottom) };
      }
      for (const r of range.getClientRects()) {
        const c = { left: Math.max(r.left, seen.left), top: Math.max(r.top, seen.top), right: Math.min(r.right, seen.right), bottom: Math.min(r.bottom, seen.bottom) };
        if (c.right - c.left < 1 || c.bottom - c.top < 1) continue;
        if (parts.some((p) => hit(p, c))) found.push(n.nodeValue.trim().slice(0, 16));
      }
    }
    // Presses and pictures weigh as words do in the placement (guide-place.ts), the key apart.
    for (const el of document.querySelectorAll("button, a[href], input, textarea, select, img, [role=img], [tabindex]:not([tabindex='-1'])")) {
      if (el === key || el.contains(key) || mine(el) || (modal && !modal.contains(el)) || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width >= 1 && r.height >= 1 && r.bottom > 0 && r.top < innerHeight && parts.some((p) => hit(p, r))) found.push("<" + el.tagName.toLowerCase() + ">");
    }
    return [...new Set(found)];
  };
  const hosts = [document.querySelector("main .scroller"), document.querySelector("main:has(> .pl-page)")].filter(Boolean);
  let band = ""; let px = 0;
  for (const h of hosts) for (const side of ["Top", "Bottom"]) { const v = parseFloat(h.style["margin" + side]) || 0; if (v > 0) { band = (h.matches("main") ? "plugins " : "chat ") + (side === "Top" ? "top" : "foot"); px = v; } }
  const now = words();
  let bare = 0;
  if (px > 0) {
    const kept = hosts.map((h) => [h, h.style.marginTop, h.style.marginBottom]);
    for (const [h] of kept) { h.style.marginTop = ""; h.style.marginBottom = ""; }
    bare = words().length;
    for (const [h, t, b] of kept) { h.style.marginTop = t; h.style.marginBottom = b; }
  }
  // The key wholly inside the window and every scroller round it (the page that gives way among them), and the top thing at its middle.
  const k = key?.getBoundingClientRect();
  // The place to fill in is a mark without ink that takes no pointer: it is in view where it lies inside the message box.
  const inBox = (k) => { const t = document.querySelector(".composer textarea").getBoundingClientRect(); return k.width > 0 && k.left >= t.left && k.right <= t.right && k.top >= t.top && k.bottom <= t.bottom; };
  let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  for (let up = key?.parentElement; up && up !== document.body; up = up.parentElement) {
    if (!/(auto|scroll|hidden)/.test(getComputedStyle(up).overflowX + getComputedStyle(up).overflowY)) continue;
    const u = up.getBoundingClientRect();
    clip = { left: Math.max(clip.left, u.left), top: Math.max(clip.top, u.top), right: Math.min(clip.right, u.right), bottom: Math.min(clip.bottom, u.bottom) };
  }
  const keyIn = !!k && k.top >= clip.top - 0.5 && k.left >= clip.left - 0.5 && k.bottom <= clip.bottom + 0.5 && k.right <= clip.right + 0.5 && (key.matches(".cx-fill") ? inBox(k) : document.elementsFromPoint(k.left + k.width / 2, k.top + k.height / 2).includes(key));
  const box = (r) => [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
  return { title, band, px, words: now, bare, keyIn, key: k ? box(k) : null, figure: box(parts[0]), bubble: box(parts[1]), squeezed: bubble.dataset.squeezed === "true", held: bubble.classList.contains("hold") };
})()`;

/**
 * cx's hand at the key `selector` finds: how far its fingertip stops from the key's edge, whether it is held short, whether the key's
 * tooltip is up, and whether any point of the arm lies on it. None while cx points at nothing.
 */
export const HAND = (selector: string): string => `(() => {
  const g = document.querySelector(".cx-slot .cx-point");
  const finger = g?.querySelector("path:nth-of-type(2)");
  if (!finger || getComputedStyle(g).display === "none") return null;
  const k = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
  const end = finger.getPointAtLength(finger.getTotalLength());
  const p = new DOMPoint(end.x, end.y).matrixTransform(finger.getScreenCTM());
  const tip = document.querySelector(".f-tip")?.getBoundingClientRect() ?? null;
  const on = tip !== null && [...g.querySelectorAll("path")].some((path) => { const m = path.getScreenCTM(); for (let d = 0; d <= path.getTotalLength(); d += 1) { const q = path.getPointAtLength(d); const c = new DOMPoint(q.x, q.y).matrixTransform(m); if (c.x > tip.left && c.x < tip.right && c.y > tip.top && c.y < tip.bottom) return true; } return false; });
  return { gap: Math.hypot(Math.max(0, k.left - p.x, p.x - k.right), Math.max(0, k.top - p.y, p.y - k.bottom)), short: g.hasAttribute("data-short"), tip: tip !== null, on };
})()`;
