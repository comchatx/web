// main's src/web/site/appearance.js at 76300278a, copied whole and unchanged below this line, so the site follows the seller's
// appearance as the product does (brief 2026-10-22-57, correction 5). To follow main, copy the file again; never edit the copy.
// The page's appearance: the theme's light or dark set, chosen by one setting this browser keeps — follow the system (the default),
// light or dark. A classic script linked in <head> before the stylesheets, so the first paint is already in the chosen set; the
// settings page reads and changes the setting through the one global this file sets.
(function () {
  "use strict";
  var KEY = "cmx-appearance";
  var CHOICES = ["system", "light", "dark"];
  var dark = window.matchMedia("(prefers-color-scheme: dark)");
  // What was chosen on this page, for a browser that keeps nothing.
  var held = null;
  var read = function () {
    var kept = held;
    try { kept = localStorage.getItem(KEY); } catch (e) { /* the choice held on this page */ }
    return CHOICES.indexOf(kept) >= 0 ? kept : "system";
  };
  var apply = function () {
    var chosen = read();
    document.documentElement.setAttribute("data-theme", chosen === "system" ? (dark.matches ? "dark" : "light") : chosen);
  };
  dark.addEventListener("change", apply);
  // Another tab of the page that changed the setting changes this one too.
  window.addEventListener("storage", function (event) { if (event.key === KEY) apply(); });
  apply();
  globalThis.CmxAppearance = Object.freeze({
    read: read,
    choose: function (chosen) {
      if (CHOICES.indexOf(chosen) < 0) return;
      held = chosen;
      try { localStorage.setItem(KEY, chosen); } catch (e) { /* held on this page alone */ }
      apply();
    },
  });
})();
