// The door's first script, a classic one linked first in <head>, so it runs before the page draws. It does what the site's pages do
// inline, which the door's policy refuses: the script is on, ?still asks for a picture with nothing moving, and the first page of a
// visit lets the header come down into place (the site's chrome.css). And the language comes with the visitor: an address that names
// none opens the door in the language this person chose last (cmx-language, as the product keeps it), else in Chinese where the
// browser's first language is Chinese and in English otherwise: the product's own rule (preferredLanguage in strings.ts, which
// door.view.test.ts runs beside this over one table). Only the door's language menu keeps a language (door.ts).
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");
  var query = new URLSearchParams(location.search);
  if (query.has("still")) root.classList.add("still");
  try { if (!sessionStorage.getItem("cmx-site-entered")) { sessionStorage.setItem("cmx-site-entered", "1"); root.classList.add("enter"); } }
  catch (e) { root.classList.add("enter"); }
  if (query.has("lang")) return;
  var kept = null;
  try { kept = localStorage.getItem("cmx-language"); } catch (e) { /* a browser that keeps nothing opens in the browser's language */ }
  var chosen = kept === "en" || kept === "zh";
  var first = (typeof navigator === "object" && navigator.languages && navigator.languages[0]) || "";
  var wanted = chosen ? kept : String(first).toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  var page = root.lang === "en" ? "en" : "zh";
  if (wanted === page) return;
  query.set("lang", wanted);
  location.replace(location.pathname + "?" + query.toString() + location.hash);
})();
