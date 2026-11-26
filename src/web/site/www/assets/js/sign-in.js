// The picture beside the door's card, on the homepage the product serves at comchatx.com/login (the card itself is Clerk's,
// mounted by the product's door), and that page's ways in, which go to the card instead of loading the page again.
// The module sign-in keeps this file.
(() => {
  const { query, still, $, $$ } = window.SC;
  // ── The picture: three examples, each played once with the seller agreeing at once and once with a "why" first, six turns
  // in all. One clock drives it: the lines come and go by --u in sign-in.css, and this script moves the camera, the pointer,
  // the keys and the chat's scroll by the same seconds. Scrolling it out of sight pauses it; a pointer or the keyboard on
  // the page does not, and it has no button of its own (ruled 2026-10-26 and 2026-11-02). ?art-at=<seconds> holds the clock
  // at that moment of the turns, for walking and pictures; ?still and reduced motion hold the first example, answered. ──
  const art = $("[data-art]");
  if (art) {
    // Each turn: its example, whether the seller asks why, its length, when what cx found on its own comes and goes and when
    // the chat's head shows, when each line comes (and goes), what the seller types [click into the box, first key, last key,
    // send, the line typed], where the pointer goes [start, aim, seconds] and when it clicks, where the camera looks [start,
    // view, seconds], when the card and the line to it come and go, when the rest dims, and when cx's new title lands on Amazon,
    // cx itself going along the line with it.
    const FLOWS = [
      { ex: 0, why: false, length: 18,
        parts: { me1: 4, s1: 4.6, s2: 5.3, ans: 6.1, plan: 6.6, acts2: [7.6, 9], done: 9, sum: 15.3 },
        type: [[1.05, 1.4, 3.4, 3.95, "me1"]],
        point: [[.3, "composer"], ["click", 1.05], [3.5, "send", .35], ["click", 3.95], [4.25, "park"], [7.9, "yes2"], ["click", 8.7], [9.3, "out"]],
        cam: [[1.05, "composer"], [4, "rest"], [9.8, "wide"], [12, "card"], [14.4, "rest"]],
        card: [9.9, 14.4], line: [10.9, 14.4], dim: [[12, 14.4]] },
      { ex: 1, why: true, length: 23.4, knock: [.3, 3.3], head: 3.4,
        parts: { s1: 3.7, s2: 4.5, plan: 5.3, acts1: [6.6, 10.15], me2: 10.15, why: 11, acts2: [14.4, 15.7], done: 15.7 },
        type: [[7.7, 8, 9.6, 10.1, "me2"]],
        point: [[2.2, "view"], ["click", 3.15], [3.5, "park"], [6.8, "composer", .8], ["click", 7.7], [9.7, "send", .35], ["click", 10.1], [10.4, "park"], [14.6, "yes2"], ["click", 15.4], [15.9, "out"]],
        cam: [[.45, "knock", 1], [3.3, "rest", .7], [7.7, "composer"], [10.15, "rest"], [11.3, "evidence"], [13.8, "rest"], [16.4, "wide"], [18.4, "card"], [22, "rest"]],
        card: [16.5, 22.4], line: [17.4, 22.4], dim: [[18.4, 22]], lands: 19.4 },
      { ex: 2, why: false, length: 20, knock: [.3, 3.3], head: 3.4,
        parts: { s1: 3.7, s2: 4.5, s3: 5.3, ans: 6.1, plan: 6.8, acts2: [8, 9.4], done: 9.4, sum: 15.4 },
        point: [[2.2, "view"], ["click", 3.15], [3.5, "park"], [7.9, "yes2", .9], ["click", 9.1], [9.7, "out"]],
        cam: [[.45, "knock", 1], [3.3, "rest", .7], [10.1, "wide"], [12.3, "card"], [14.9, "rest"], [16.1, "sum"], [18.7, "rest"]],
        card: [10.2, 15], line: [11.2, 15], dim: [[12.3, 14.9]] },
      { ex: 0, why: true, length: 22,
        parts: { me1: 4, s1: 4.6, s2: 5.3, ans: 6.1, plan: 6.6, acts1: [7.6, 10.75], me2: 10.75, why: 11.5, acts2: [14.6, 15.9], done: 15.9 },
        type: [[1.05, 1.4, 3.4, 3.95, "me1"], [8.7, 9, 10.2, 10.7, "me2"]],
        point: [[.3, "composer"], ["click", 1.05], [3.5, "send", .35], ["click", 3.95], [4.25, "park"], [7.9, "composer"], ["click", 8.7], [10.3, "send", .35], ["click", 10.7], [11, "park"], [14.8, "yes2"], ["click", 15.6], [16.2, "out"]],
        cam: [[1.05, "composer"], [4, "rest"], [8.7, "composer"], [10.75, "rest"], [11.8, "evidence"], [14.1, "rest"], [16.4, "wide"], [18.4, "card"], [20.6, "rest"]],
        card: [16.5, 21], line: [17.4, 21], dim: [[18.4, 20.6]] },
      { ex: 1, why: false, length: 15.7, knock: [.3, 3.3], head: 3.4,
        parts: { s1: 3.7, s2: 4.5, plan: 5.3, acts2: [6.6, 8], done: 8 },
        point: [[2.2, "view"], ["click", 3.15], [3.5, "park"], [6.5, "yes2", .9], ["click", 7.7], [8.2, "out"]],
        cam: [[.45, "knock", 1], [3.3, "rest", .7], [8.7, "wide"], [10.7, "card"], [14.3, "rest"]],
        card: [8.8, 14.7], line: [9.7, 14.7], dim: [[10.7, 14.3]], lands: 11.7 },
      { ex: 2, why: true, length: 22.2, knock: [.3, 3.3], head: 3.4,
        parts: { s1: 3.7, s2: 4.5, s3: 5.3, ans: 6.1, plan: 6.8, acts1: [8, 10.65], me2: 10.65, why: 11.4, acts2: [14.5, 15.8], done: 15.8 },
        type: [[8.9, 9.2, 10.1, 10.6, "me2"]],
        point: [[2.2, "view"], ["click", 3.15], [3.5, "park"], [8, "composer", .8], ["click", 8.9], [10.2, "send", .35], ["click", 10.6], [10.9, "park"], [14.7, "yes2"], ["click", 15.5], [16.1, "out"]],
        cam: [[.45, "knock", 1], [3.3, "rest", .7], [8.9, "composer"], [10.65, "rest"], [11.7, "evidence"], [14, "rest"], [16.5, "wide"], [18.5, "card"], [20.8, "rest"]],
        card: [16.6, 21.2], line: [17.5, 21.2], dim: [[18.5, 20.8]] },
    ];
    const CYCLE = FLOWS.reduce((sum, flow) => sum + flow.length, 0);
    const STILL = 9.6;

    const stage = $("[data-stage]", art);
    const frame = $(".art-window", art);
    const body = $("[data-body]", art);
    const scenes = $$("[data-scene]", art);
    const heads = $$("[data-head]", art);
    const cards = $$("[data-card]", art);
    const pointer = $("[data-pointer]", art);
    const composer = $("[data-composer]", art);
    const input = $('[data-aim="composer"]', art);
    const send = $('[data-aim="send"]', art);
    const typed = $("[data-typed]", art);
    const link = $("[data-link]", art);
    const [curve, dotFrom, dotTo] = [$("path", link), ...$$("circle", link)];
    const figure = $("[data-cx]", art);

    // Claude's curves (base.css), none past its mark: quart out for a zoom in, the field's curve for a zoom out, a pan, the
    // pointer and the scroll.
    const bezier = (x1, y1, x2, y2) => {
      const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
      return (x) => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        let lo = 0, hi = 1;
        for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (at(x1, x2, mid) < x) lo = mid; else hi = mid; }
        return at(y1, y2, (lo + hi) / 2);
      };
    };
    const QUART = bezier(.165, .84, .44, 1);
    const FIELD = bezier(.4, 0, .2, 1);
    const clamp = (x) => Math.min(1, Math.max(0, x));
    const mixNumber = (a, b, k) => a + (b - a) * k;
    const mixPoint = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
    const mixView = (a, b, k) => ({ ...mixPoint(a, b, k), s: a.s * (b.s / a.s) ** k });
    // A value that eases from wherever it stands to each step's value in turn; a step is [start, value, seconds, curve].
    const track = (first, steps, mix) => {
      const from = [];
      steps.forEach((step, i) => {
        const before = steps[i - 1];
        from.push(before ? mix(from[i - 1], before[1], before[3](clamp((step[0] - before[0]) / before[2]))) : first);
      });
      return (u) => {
        let i = steps.length - 1;
        while (i >= 0 && steps[i][0] > u) i--;
        if (i < 0) return first;
        const [start, to, seconds, ease] = steps[i];
        return mix(from[i], to, ease(clamp((u - start) / seconds)));
      };
    };
    const press = (times, u) => Math.max(0, ...times.map((at) => (u < at ? clamp(1 + (u - at) / .06) : clamp(1 - (u - at) / .3))));
    const set = (el, name, value) => (value === undefined ? el.style.removeProperty(name) : el.style.setProperty(name, String(value)));
    const timesOf = (flow, name) => [].concat(flow.parts[name] ?? []);

    // Where everything stands, in em of the stage with the camera at rest, and from that the turn's camera, pointer, keys,
    // scroll and line.
    const measure = (flow) => {
      const scene = scenes[flow.ex];
      const card = flow.card ? cards.find((el) => Number(el.dataset.card) === flow.ex) : undefined;
      const k = Number.parseFloat(getComputedStyle(art).fontSize);
      stage.style.transform = "";
      set(scene, "--scroll", 0);
      const origin = stage.getBoundingClientRect();
      const W = origin.width / k, H = origin.height / k;
      const box = (el, u) => {
        if (u !== undefined) art.style.setProperty("--u", u);
        const r = el.getBoundingClientRect();
        return { x: (r.left - origin.left) / k, y: (r.top - origin.top) / k, w: r.width / k, h: r.height / k };
      };
      const centre = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
      const win = box(frame);
      for (const el of cards) {
        el.style.left = `${win.x + win.w + 2}em`;
        el.style.top = `${win.y + (win.h - el.offsetHeight / k) / 2}em`;
      }
      for (const term of $$("[data-term]", art)) set(term, "--w", `${term.firstElementChild.offsetWidth / Number.parseFloat(getComputedStyle(term).fontSize)}em`);

      // After each line comes or goes, the chat scrolls until its newest line sits at its foot.
      const top = box(scene).y;
      const room = body.clientHeight / k;
      const parts = $$("[data-part]", scene).filter((el) => el.getClientRects().length > 0);
      const moments = [...new Set(Object.values(flow.parts).flat())].sort((a, b) => a - b);
      const scroll = track(0, moments.map((moment) => {
        art.style.setProperty("--u", moment + 1);
        const foot = Math.max(0, ...parts.filter((el) => timesOf(flow, el.dataset.part)[0] <= moment).map((el) => { const b = box(el); return b.y + b.h - top; }));
        return [moment, Math.max(0, foot + 1.25 - room), .6, FIELD];
      }), mixNumber);
      const inChat = (el, u) => { const b = box(el, u); return { ...b, y: b.y - scroll(u) }; };
      // A thing the pointer or the camera goes to is in the chat, which scrolls, or on the turn's card, which does not.
      const find = (name) => $(`[data-aim="${name}"]`, scene) ?? (card ? $(`[data-aim="${name}"]`, card) : null);
      const spotOf = (el, u) => centre(card && card.contains(el) ? box(el, u) : inChat(el, u));

      const away = { x: W + 2, y: H - 6 };
      const AIMS = {
        composer: () => { const b = box(input); return { x: b.x + 2.5, y: b.y + b.h / 2 }; },
        send: () => centre(box(send)),
        park: () => ({ x: win.x + win.w + 3, y: win.y + win.h - 10 }),
        out: () => away,
      };
      const moves = [], clicks = [], presses = new Map();
      let aim = "out";
      for (const step of flow.point ?? []) {
        if (step[0] === "click") {
          clicks.push(step[1]);
          const el = aim === "send" ? send : aim === "composer" ? null : find(aim);
          if (el) presses.set(el, [...(presses.get(el) ?? []), step[1]]);
          continue;
        }
        const [start, name, seconds = .7] = step;
        aim = name;
        const spot = AIMS[name] ? AIMS[name]() : spotOf(find(name), start + seconds);
        moves.push([start, spot, seconds, FIELD]);
      }
      const point = track(away, moves, mixPoint);
      const end = moves.at(-1);
      const shown = (u) => (moves.length ? Math.min(clamp((u - moves[0][0]) / .2), aim === "out" ? clamp((end[0] + end[2] - u) / .25) : 1) : 0);

      const keys = (flow.type ?? []).map(([focus, from, to, sent, name]) => ({ focus, from, to, sent, words: Array.from($(`[data-part="${name}"]`, scene).textContent) }));
      const typing = (u) => {
        const now = keys.find((entry) => entry.focus <= u && u < entry.sent);
        return now ? { focused: true, words: now.words.slice(0, Math.round(now.words.length * clamp((u - now.from) / (now.to - now.from)))).join("") } : { focused: false, words: "" };
      };

      const rest = { x: W / 2, y: H / 2, s: 1 };
      const fit = (b, most, room = .88) => Math.min(most, room * W / b.w, room * H / b.h);
      // A close look inside the window keeps the window filling the frame, wherever it is big enough to.
      const inside = (view) => {
        const [hw, hh] = [W / 2 / view.s, H / 2 / view.s];
        const hold = (v, from, size, half) => (size >= 2 * half ? Math.min(Math.max(v, from + half), from + size - half) : from + size / 2);
        return { x: hold(view.x, win.x, win.w, hw), y: hold(view.y, win.y, win.h, hh), s: view.s };
      };
      const close = (name, most) => (u) => { const b = inChat(find(name), u); return inside({ ...centre(b), s: fit(b, most) }); };
      const VIEWS = {
        rest: () => rest,
        composer: () => inside({ ...centre(box(composer)), s: 1.4 }),
        knock: close("knock", 1.6),
        evidence: close("evidence", 1.6),
        sum: close("sum", 1.5),
        wide: () => {
          const c = box(card, flow.card[0] + 1);
          const b = { x: win.x, y: Math.min(win.y, c.y), w: c.x + c.w - win.x, h: Math.max(win.y + win.h, c.y + c.h) - Math.min(win.y, c.y) };
          return { ...centre(b), s: fit(b, 1, .94) };
        },
        card: () => { const b = box(card, flow.card[0] + 1); return { ...centre(b), s: fit(b, 1.75) }; },
      };
      let was = rest;
      const camera = track(rest, (flow.cam ?? []).map(([start, name, seconds = .9]) => {
        const view = VIEWS[name](start + seconds);
        const step = [start, view, seconds, view.s > was.s + .01 ? QUART : FIELD];
        was = view;
        return step;
      }), mixView);

      let line, cx;
      if (flow.line) {
        const [from, gone] = flow.line;
        art.style.setProperty("--u", from);
        const rects = $('[data-part="done"] > span', scene).getClientRects();
        const last = rects[rects.length - 1];
        const a = { x: (last.right - origin.left) / k + .6, y: (last.top + last.height / 2 - origin.top) / k - scroll(from) };
        const c = box(card, flow.card[0] + 1);
        const b = { x: c.x, y: c.y + c.h / 2 };
        const bend = (b.x - a.x) / 2;
        link.setAttribute("viewBox", `0 0 ${W} ${H}`);
        curve.setAttribute("d", `M${a.x} ${a.y}C${a.x + bend} ${a.y} ${b.x - bend} ${b.y} ${b.x} ${b.y}`);
        for (const [dot, spot] of [[dotFrom, a], [dotTo, b]]) { dot.setAttribute("cx", spot.x); dot.setAttribute("cy", spot.y); }
        line = { from, gone };
        if (flow.lands !== undefined) {
          // cx rides the line's tip as it is drawn, then hops onto the right of Amazon's field, where the title lands.
          const at = (t) => {
            const s = 1 - t;
            return { x: s ** 3 * a.x + 3 * s * s * t * (a.x + bend) + 3 * s * t * t * (b.x - bend) + t ** 3 * b.x, y: (s ** 3 + 3 * s * s * t) * a.y + (3 * s * t * t + t ** 3) * b.y };
          };
          const marks = Array.from({ length: 65 }, (_, i) => at(i / 64));
          const run = marks.map((mark, i) => (i ? Math.hypot(mark.x - marks[i - 1].x, mark.y - marks[i - 1].y) : 0));
          for (let i = 1; i < run.length; i++) run[i] += run[i - 1];
          const along = (share) => {
            const goal = share * run.at(-1);
            const i = Math.max(1, run.findIndex((sum) => sum >= goal));
            return mixPoint(marks[i - 1], marks[i], clamp((goal - run[i - 1]) / (run[i] - run[i - 1] || 1)));
          };
          const field = box($(".amz-field", card), flow.card[0] + 1);
          const stand = { x: field.x + field.w - 2.2, y: field.y + .05 };
          const leave = flow.card[1];
          cx = {
            from,
            leave,
            spot: (u) => {
              if (u < from + .7) return along(FIELD(clamp((u - from) / .7)));
              const hop = FIELD(clamp((u - from - .75) / .5));
              const p = mixPoint(b, stand, hop);
              return { x: p.x + 3 * clamp((u - leave) / .5), y: p.y - Math.sin(hop * Math.PI) * 1.2 };
            },
          };
        }
      }
      const dim = (u) => Math.max(0, ...(flow.dim ?? []).map(([on, off]) => FIELD(clamp((u - on) / .5)) * (1 - FIELD(clamp((u - off) / .5)))));
      return { W, H, scroll, point, clicks, presses, shown, typing, camera, line, dim, cx };
    };

    let now = -1, plan, at = 0;
    // Below the wide layout the hero leaves the picture out, and nothing in it can be measured: it is drawn only while it
    // shows, at the moment its clock stands at.
    const showing = () => art.getClientRects().length > 0;
    const enter = (n) => {
      const flow = FLOWS[n];
      const scene = scenes[flow.ex];
      now = n;
      scenes.forEach((el, i) => el.classList.toggle("is-on", i === flow.ex));
      heads.forEach((el, i) => { el.classList.toggle("is-on", i === flow.ex); set(el, "--a", i === flow.ex ? flow.head : undefined); });
      scene.classList.toggle("is-why", flow.why);
      for (const part of $$("[data-part]", scene)) {
        const [come, go] = timesOf(flow, part.dataset.part);
        set(part, "--a", come);
        set(part, "--z", go);
      }
      for (const knock of $$("[data-knock]", art)) {
        const mine = Boolean(flow.knock) && scene.contains(knock);
        set(knock, "--a", mine ? flow.knock[0] : undefined);
        set(knock, "--z", mine ? flow.knock[1] : undefined);
      }
      for (const card of cards) {
        const mine = Boolean(flow.card) && Number(card.dataset.card) === flow.ex;
        set(card, "--a", mine ? flow.card[0] : undefined);
        set(card, "--z", mine ? flow.card[1] : undefined);
      }
      for (const strip of $$("[data-strip]", art)) set(strip, "--fa", flow.lands);
      for (const el of $$("[data-aim]", art)) el.style.removeProperty("--b");
      plan = measure(flow);
    };
    const render = (t) => {
      at = t;
      if (!showing()) return;
      let n = 0, u = ((t % CYCLE) + CYCLE) % CYCLE;
      while (n < FLOWS.length - 1 && u >= FLOWS[n].length) { u -= FLOWS[n].length; n++; }
      if (n !== now) enter(n);
      const flow = FLOWS[n];
      art.style.setProperty("--u", u.toFixed(3));
      art.style.setProperty("--fade", Math.min(clamp(u / .4), clamp((flow.length - u) / .4)).toFixed(3));
      set(scenes[flow.ex], "--scroll", plan.scroll(u).toFixed(3));
      const view = plan.camera(u);
      const atRest = view.s === 1 && view.x === plan.W / 2 && view.y === plan.H / 2;
      stage.style.transform = atRest ? "" : `translate(${((plan.W / 2 - view.x) * view.s).toFixed(3)}em, ${((plan.H / 2 - view.y) * view.s).toFixed(3)}em) scale(${view.s.toFixed(4)})`;
      const spot = plan.point(u);
      pointer.style.translate = `${spot.x.toFixed(3)}em ${spot.y.toFixed(3)}em`;
      pointer.style.scale = String(1 - .12 * press(plan.clicks, u));
      pointer.style.opacity = plan.shown(u).toFixed(3);
      for (const [el, times] of plan.presses) el.style.setProperty("--b", press(times, u).toFixed(3));
      const keys = plan.typing(u);
      if (typed.textContent !== keys.words) typed.textContent = keys.words;
      composer.classList.toggle("is-focused", keys.focused);
      composer.classList.toggle("has-text", keys.words !== "");
      if (plan.line) {
        const drawn = FIELD(clamp((u - plan.line.from) / .7));
        link.style.opacity = String(u < plan.line.from ? 0 : 1 - clamp((u - plan.line.gone) / .4));
        curve.style.strokeDashoffset = String(1 - drawn);
        dotTo.style.opacity = String(clamp((drawn - .9) * 10));
      } else link.style.opacity = "0";
      art.style.setProperty("--dim", plan.dim(u).toFixed(3));
      if (plan.cx) {
        const place = plan.cx.spot(u);
        figure.style.translate = `${place.x.toFixed(3)}em ${place.y.toFixed(3)}em`;
        figure.style.opacity = (u < plan.cx.from ? 0 : clamp((u - plan.cx.from) / .15) * (1 - clamp((u - plan.cx.leave) / .4))).toFixed(3);
        figure.style.scale = `1 ${(1 - .12 * press([flow.lands], u)).toFixed(3)}`;
        // Amazon's page is white in both schemes, so from mid-hop cx wears the theme's light colours.
        if (u >= plan.cx.from + 1) figure.dataset.theme = "light";
        else delete figure.dataset.theme;
      } else figure.style.opacity = "0";
    };

    const held = Number.parseFloat(query.get("art-at") ?? "");
    const resting = still || window.SC.reduced();
    let clock = 0, last = 0, frameId = 0, away = false;
    const tick = (ms) => {
      if (last) clock += Math.min(.1, (ms - last) / 1000);
      last = ms;
      render(clock);
      frameId = requestAnimationFrame(tick);
    };
    const play = () => { if (!frameId && !away) { last = 0; frameId = requestAnimationFrame(tick); } };
    const stop = () => { cancelAnimationFrame(frameId); frameId = 0; };
    new ResizeObserver(() => {
      if (!showing()) return;
      if (now >= 0) plan = measure(FLOWS[now]);
      render(at);
    }).observe(art);
    if (resting) { art.closest(".hero-media").classList.add("is-still"); render(STILL); }
    else if (Number.isFinite(held)) { art.closest(".hero-media").classList.add("is-held"); render(held); }
    else {
      render(0);
      new IntersectionObserver(([entry]) => { away = !entry.isIntersecting; if (away) stop(); else play(); }).observe(art);
    }
  }

  // ── On the door's page, its own presses and no others. Its five ways in, the links of class way-in (the header's and the
  //    narrow menu's 试用 ComChatX, the plans' 试用 ComChatX and 订阅, and the footer's 登录), go to the card and put the
  //    keyboard in its field; its three ComChatX marks go to the top; neither loads the page again. Every other link is the
  //    browser's, and so is any whose address carries a fragment: the skip link to the content, the language menu, the card's
  //    own links, and a press with a modifier key. Without the script, the ways in load the page as before. ──
  const column = $(".door-column");
  if (column) {
    const motion = () => (window.SC.reduced() || still ? "instant" : "smooth");
    const field = () => $$("input:not([type=hidden]):not([disabled])", column)
      .find((input) => input.tabIndex >= 0 && input.getClientRects().length > 0 && !input.closest("[aria-hidden='true']"));
    document.addEventListener("click", (event) => {
      const anchor = event.target.closest("a.way-in, a.brand, a.footer-logo");
      if (!anchor || anchor.href.includes("#") || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (!anchor.classList.contains("way-in")) {
        window.scrollTo({ top: 0, behavior: motion() });
        const top = $(".header-row > .brand");
        if (top && anchor !== top) top.focus({ preventScroll: true });
        return;
      }
      const box = column.getBoundingClientRect();
      if (box.top < 0 || box.bottom > innerHeight) column.scrollIntoView({ block: "center", behavior: motion() });
      field()?.focus({ preventScroll: true });
    });
  }
})();
