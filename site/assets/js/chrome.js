// The prototype's shared helpers, and the behaviour of the frame around every page: the language menu, the narrow screen's
// menu, the FAQ's questions, things rising into view and titles whose words fade in, and the contact form, which hands its
// message to the seller's own mail program and sends nothing itself. The module chrome keeps this file; sign-in.js and
// pricing.js load after it and take the helpers from window.SC (README.md, "Modules").
(() => {
  const zh = document.documentElement.lang.startsWith("zh");
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const query = new URLSearchParams(location.search);
  const still = query.has("still");
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const busy = (button, on) => { button.classList.toggle("is-busy", on); if (on) button.setAttribute("aria-busy", "true"); else button.removeAttribute("aria-busy"); };
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  window.SC = { zh, reduced, query, still, $, $$, busy, EMAIL };

  // ── Menus that open from a button: the language menu ──
  const menus = [];
  const closeMenus = (except) => { for (const menu of menus) if (menu !== except) menu.close(false); };
  for (const button of $$(".lang-switch > button")) {
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    if (!panel) continue;
    const box = button.parentElement;
    const menu = {
      open() { closeMenus(menu); panel.classList.add("is-open"); button.setAttribute("aria-expanded", "true"); },
      close(returnFocus) { if (!panel.classList.contains("is-open")) return; panel.classList.remove("is-open"); button.setAttribute("aria-expanded", "false"); if (returnFocus) button.focus(); },
      toggle() { panel.classList.contains("is-open") ? menu.close(false) : menu.open(); },
    };
    menus.push(menu);
    button.addEventListener("click", (event) => { event.stopPropagation(); menu.toggle(); });
    box.addEventListener("keydown", (event) => { if (event.key === "Escape") menu.close(true); });
    box.addEventListener("focusout", (event) => { if (!box.contains(event.relatedTarget)) menu.close(false); });
    panel.addEventListener("click", (event) => { if (event.target.closest("a")) menu.close(false); });
  }
  document.addEventListener("click", (event) => { if (!event.target.closest(".lang-switch")) closeMenus(); });

  // ── The narrow screen's menu: a sheet over the page. It opens and closes in the times chrome.css gives it; while it closes it
  //    takes no clicks or focus, and with less motion asked for, or in a picture, it goes at once. ──
  const sheet = $("#mobile-menu");
  const opener = $(".header-row > .menu-toggle");
  if (sheet && opener) {
    const focusable = () => $$("a[href], button:not([disabled])", sheet).filter((element) => element.offsetParent !== null);
    const hide = () => { sheet.hidden = true; sheet.inert = false; sheet.classList.remove("is-closing"); };
    sheet.addEventListener("animationend", (event) => { if (event.target === sheet && event.animationName === "menu-close") hide(); });
    const open = () => { sheet.classList.remove("is-closing"); sheet.inert = false; sheet.hidden = false; opener.setAttribute("aria-expanded", "true"); document.body.style.overflow = "hidden"; $(".menu-close", sheet).focus(); };
    const close = (moving = true) => {
      if (sheet.hidden || sheet.classList.contains("is-closing")) return;
      opener.setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; opener.focus();
      if (moving && !reduced() && !still) { sheet.inert = true; sheet.classList.add("is-closing"); } else hide();
    };
    opener.addEventListener("click", open);
    $(".menu-close", sheet).addEventListener("click", () => close());
    sheet.addEventListener("click", (event) => { if (event.target.closest("a[href]")) { hide(); document.body.style.overflow = ""; opener.setAttribute("aria-expanded", "false"); } });
    sheet.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { close(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    matchMedia("(min-width: 1024px)").addEventListener("change", (event) => { if (event.matches) close(false); });
  }

  // ── Questions that open: the FAQ. base.css opens and closes an answer as claude.com's do. Here an answer gives up the hidden
  //    attribute it has without the script, moves between no height and its own, and is marked shown once it stands open. ──
  for (const button of $$(".faq-button")) {
    const answer = document.getElementById(button.getAttribute("aria-controls"));
    if (!answer) continue;
    const set = (open) => { answer.style.height = ""; answer.classList.toggle("is-open", open); answer.classList.toggle("is-shown", open); };
    set(button.getAttribute("aria-expanded") === "true");
    answer.hidden = false;
    answer.addEventListener("transitionend", (event) => {
      if (event.target === answer && event.propertyName === "height" && answer.classList.contains("is-open")) set(true);
    });
    button.addEventListener("click", () => {
      const opening = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(opening));
      if (reduced() || still) { set(opening); return; }
      if (opening) { answer.classList.add("is-open"); answer.style.height = `${answer.scrollHeight}px`; return; }
      answer.style.height = `${answer.offsetHeight}px`;
      answer.classList.remove("is-shown", "is-open");
      void answer.offsetHeight;
      answer.style.height = "";
    });
  }

  // ── Things rise into place, and a title's words fade in, as they come into view (base.css, "Motion"): each once, when its top
  //    passes the line a fifth of the way up from the window's foot, as claude.com's do. ──
  for (const box of $$("[data-reveal]")) [...box.children].forEach((child, index) => child.style.setProperty("--reveal-index", index));
  for (const title of $$("[data-words]")) {
    title.setAttribute("aria-label", title.textContent.replace(/\s+/g, " ").trim());
    const texts = [];
    for (const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT); walker.nextNode();) texts.push(walker.currentNode);
    let count = 0;
    for (const text of texts) {
      text.replaceWith(...text.data.split(/(\s+)/).filter(Boolean).map((piece) => {
        if (/^\s/.test(piece)) return piece;
        const word = document.createElement("span");
        word.className = "word";
        word.setAttribute("aria-hidden", "true");
        word.style.setProperty("--word-index", count++);
        word.textContent = piece;
        return word;
      }));
    }
    // cx's figure after the word cx joins that word, so the two fade in together.
    for (const figure of title.querySelectorAll("svg")) {
      const word = figure.previousElementSibling;
      if (word?.classList.contains("word")) word.append(figure);
    }
    title.style.setProperty("--word-stagger", `${count > 1 ? 0.2 / (count - 1) : 0}s`);
  }
  const risers = $$(".reveal, [data-reveal], [data-words]");
  if ("IntersectionObserver" in window && !still && !reduced()) {
    const watcher = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("is-in"); watcher.unobserve(entry.target); }
    }, { rootMargin: "0px 0px -20% 0px" });
    for (const element of risers) watcher.observe(element);
  } else for (const element of risers) element.classList.add("is-in");

  // ── Contact sales: the form opens out once a topic is chosen, as Claude's does. Its submit opens the seller's own mail program
  //    on a message to the address beside the button, its subject and body from the fields; the page sends nothing itself
  //    (correction 15). ──
  const contact = $("[data-contact]");
  if (contact) {
    const form = $("form", contact);
    const topic = $("#c-topic", form);
    const more = $("[data-more-fields]", form);
    const mail = $("[data-mail]", form);
    const status = $("[data-status]", contact);
    const WORDS = zh
      ? { topic: "请选择一项。", name: "请填写姓名。", email: "请输入邮箱。", emailBad: "请输入正确的邮箱地址。", message: "请简单说明你的需求。", consent: "请先勾选同意。", sent: "邮件已写好，请在邮件应用中发送。" }
      : { topic: "Choose one.", name: "Enter your full name.", email: "Enter your email.", emailBad: "Enter a valid email address.", message: "Tell us a bit about what you need.", consent: "Tick the box to continue.", sent: "Your email is ready. Send it from your email app." };
    const problem = (field) => {
      if (field.type === "checkbox") return field.checked ? "" : WORDS.consent;
      const value = field.value.trim();
      if (field.type === "email") return !value ? WORDS.email : EMAIL.test(value) ? "" : WORDS.emailBad;
      return value ? "" : WORDS[field.name];
    };
    const check = (field) => {
      const words = problem(field);
      const error = document.getElementById(`${field.id}-error`);
      error.textContent = words;
      error.hidden = !words;
      if (words) field.setAttribute("aria-invalid", "true"); else field.removeAttribute("aria-invalid");
      return !words;
    };
    topic.addEventListener("change", () => { more.hidden = !topic.value; if (topic.value) check(topic); });
    for (const field of $$("[required]", more)) {
      field.addEventListener(field.type === "checkbox" ? "change" : "input", () => { if (field.getAttribute("aria-invalid") === "true") check(field); });
    }
    // A field's label without its required mark: the words the email prints before what the seller wrote.
    const label = (field) => [...$(`label[for="${field.id}"]`, form).childNodes].filter((node) => node.nodeType === 3).map((node) => node.data).join("").trim();
    const said = (field) => field.value.trim();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const fields = [topic, ...(more.hidden ? [] : $$("[required]", more))];
      const wrong = fields.filter((field) => !check(field));
      if (wrong.length) { wrong[0].focus(); return; }
      const colon = zh ? "：" : ": ";
      const [name, email, company, message] = ["#c-name", "#c-email", "#c-company", "#c-message"].map((id) => $(id, form));
      const subject = `${$("#contact-title").textContent.trim()}${colon}${topic.selectedOptions[0].textContent.trim()}`;
      const body = [...[name, email, company].filter(said).map((field) => `${label(field)}${colon}${said(field)}`), "", `${label(message)}${colon.trim()}`, said(message)]
        .join("\n").replace(/\r?\n/g, "\r\n");
      // The submit clicks the address's own link with the message on it, so the mail program opens as it would for that link,
      // and a page that watches clicks sees the message; the link then goes back to the bare address.
      const address = mail.getAttribute("href");
      mail.href = `${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      mail.click();
      mail.href = address;
      status.textContent = WORDS.sent;
    });
  }
})();
