// The plans block's tabs, which the login page shows too, and the pricing page's FAQ topics and compare table. The module
// pricing keeps this file.
(() => {
  const { zh, reduced, $, $$ } = window.SC;

  // ── Tabs: Claude's segmented toggles. On the login page one thumb slides to the tab chosen, as claude.ai/login's does: it takes
  // the new tab's place at once and plays back from the old one, 200 ms on claude.ai's curve. ──
  const glide = document.body.dataset.page === "login";
  for (const list of $$("[role=tablist]")) {
    const tabs = $$("[role=tab]", list);
    const chosen = () => tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
    let thumb;
    const place = (tab) => { thumb.style.width = `${tab.offsetWidth}px`; thumb.style.transform = `translateX(${tab.offsetLeft}px)`; };
    if (glide) {
      thumb = document.createElement("span");
      thumb.className = "tab-thumb";
      thumb.setAttribute("aria-hidden", "true");
      list.classList.add("has-thumb");
      list.prepend(thumb);
      place(chosen());
      new ResizeObserver(() => place(chosen())).observe(list);
    }
    const select = (tab, focus) => {
      const from = thumb && chosen();
      const x = from?.offsetLeft, width = from?.offsetWidth;
      for (const other of tabs) {
        const isChosen = other === tab;
        other.setAttribute("aria-selected", String(isChosen));
        other.tabIndex = isChosen ? 0 : -1;
        const panel = document.getElementById(other.getAttribute("aria-controls"));
        if (panel) panel.hidden = !isChosen;
      }
      if (thumb && from && from !== tab) {
        place(tab);
        for (const running of thumb.getAnimations()) running.cancel();
        if (!reduced()) thumb.animate([{ transform: `translateX(${x}px) scaleX(${width / tab.offsetWidth})` }, { transform: `translateX(${tab.offsetLeft}px) scaleX(1)` }], { duration: 200, easing: "cubic-bezier(.32, .72, 0, 1)" });
      }
      if (focus) tab.focus();
    };
    for (const tab of tabs) {
      tab.addEventListener("click", () => select(tab, false));
      tab.addEventListener("keydown", (event) => {
        const at = tabs.indexOf(tab);
        const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(tabs[(next + tabs.length) % tabs.length], true);
      });
    }
  }

  // ── Topics that don't fit: Claude keeps the chosen tab and puts the others behind "…" ──
  for (const more of $$("[data-more]")) {
    const box = more.closest(".tabs");
    const list = $("[role=tablist]", box);
    const button = $(".tabs-more-button", more);
    const menu = $(".tabs-more-menu", more);
    const close = (returnFocus) => {
      if (!menu.classList.contains("is-open")) return;
      menu.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      if (returnFocus) button.focus();
    };
    const open = () => {
      menu.replaceChildren(...$$("[role=tab]", list).filter((tab) => tab.getAttribute("aria-selected") !== "true").map((tab) => {
        const item = document.createElement("li");
        const choice = document.createElement("button");
        choice.type = "button";
        choice.textContent = tab.textContent;
        choice.addEventListener("click", () => { close(false); tab.click(); tab.focus(); });
        item.append(choice);
        return item;
      }));
      menu.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
    };
    button.addEventListener("click", (event) => { event.stopPropagation(); menu.classList.contains("is-open") ? close(false) : open(); });
    more.addEventListener("keydown", (event) => { if (event.key === "Escape") close(true); });
    more.addEventListener("focusout", (event) => { if (!more.contains(event.relatedTarget)) close(false); });
    document.addEventListener("click", (event) => { if (!more.contains(event.target)) close(false); });
    const fit = () => {
      box.classList.remove("is-collapsed");
      const collapse = list.scrollWidth > box.clientWidth;
      box.classList.toggle("is-collapsed", collapse);
      if (!collapse) close(false);
    };
    new ResizeObserver(fit).observe(box.parentElement);
    fit();
  }

  // ── The compare table: groups that fold, a search over its rows, and notes that open on a tap ──
  const compare = $("[data-compare]");
  if (compare) {
    for (const head of $$(".compare-group-head", compare)) {
      head.addEventListener("click", () => {
        const opening = head.getAttribute("aria-expanded") !== "true";
        head.setAttribute("aria-expanded", String(opening));
        document.getElementById(head.getAttribute("aria-controls")).hidden = !opening;
      });
    }
    const filter = $("[data-filter]", compare);
    filter.addEventListener("input", () => {
      const words = filter.value.trim().toLowerCase();
      let shown = 0;
      for (const group of $$(".compare-group", compare)) {
        let inGroup = 0;
        for (const row of $$(".compare-row", group)) {
          const match = !words || row.firstElementChild.textContent.toLowerCase().includes(words);
          row.hidden = !match;
          if (match) inGroup++;
        }
        group.hidden = inGroup === 0;
        if (words && inGroup) { const head = $(".compare-group-head", group); head.setAttribute("aria-expanded", "true"); document.getElementById(head.getAttribute("aria-controls")).hidden = false; }
        shown += inGroup;
      }
      const empty = $("[data-empty]", compare);
      empty.hidden = shown > 0;
      $("[data-found]", compare).textContent = !words ? "" : shown ? (zh ? `找到 ${shown} 项` : `${shown} found`) : empty.textContent;
    });
    for (const info of $$(".info", compare)) {
      const button = $("button", info);
      button.addEventListener("click", (event) => { event.stopPropagation(); info.classList.toggle("is-open"); });
      info.addEventListener("keydown", (event) => { if (event.key === "Escape") info.classList.remove("is-open"); });
      button.addEventListener("blur", () => info.classList.remove("is-open"));
    }
  }
})();
