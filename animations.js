/* ==========================================================================
   Animation layer
   1. Intro: multiplayer cursors fly in -> design-canvas wireframe of the
      hero (rulers, guides, selection frames) -> page "builds" itself.
   2. Hero text/photo build-in.
   3. Scroll reveals, once per section, each with its own Figma tool:
      text box typing, marquee select, frame build, auto layout,
      image placement, component duplication. Count-up stats.
   4. Small extras: mouse spotlight on cards, thin scroll progress bar.
   Works with content rendered later by script.js (MutationObserver).
   ========================================================================== */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (min-width: 761px)").matches;

  const CURSOR_PEOPLE = [
    { name: "Editor", color: "#e50914" },
    { name: "Director", color: "#2f8cff" },
    { name: "DOP", color: "#f7b733" },
    { name: "Colorist", color: "#37b6bd" },
    { name: "Motion", color: "#a259ff" },
    { name: "Sound", color: "#1bc47d" },
    { name: "Writer", color: "#ff7262" },
  ];

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const rand = (min, max) => min + Math.random() * (max - min);

  function el(tag, className, parent) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (parent) parent.appendChild(node);
    return node;
  }

  function makeCursor(person, parent, withTag = true) {
    const cursor = el("div", "fx-cursor", parent);
    cursor.innerHTML =
      `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M1 1 L1 15 L5 11.2 L8 17 L10.6 15.8 L7.7 10.2 L13 10.2 Z" ` +
      `fill="${person.color}" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
    if (withTag) {
      const tag = el("span", "fx-cursor__tag", cursor);
      tag.textContent = person.name;
      tag.style.background = person.color;
    }
    return cursor;
  }

  function moveCursor(cursor, x, y, duration = 700, easing = "cubic-bezier(.22,1,.36,1)") {
    cursor.style.transition = `transform ${duration}ms ${easing}`;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  }

  /* ------------------------------------------------------------------------
     1 + 2. Intro and hero build
     ------------------------------------------------------------------------ */
  const heroTargets = [
    { selector: ".intro-copy .eyebrow", name: "Eyebrow" },
    { selector: ".intro-copy h1", name: "Title / H1", accent: true },
    { selector: ".intro-copy .lead", name: "Lead" },
    { selector: ".intro-copy > p:not(.eyebrow):not(.lead)", name: "Body" },
    { selector: ".intro-actions", name: "Buttons" },
    { selector: ".portrait-frame", name: "Portrait.jpg", image: true },
    { selector: ".site-header", name: "Header" },
  ];

  function splitHeroTitle() {
    const h1 = document.querySelector(".intro-copy h1");
    if (!h1 || h1.dataset.fxSplit === h1.textContent) return;
    const textValue = h1.textContent;
    const parts =
      typeof Intl !== "undefined" && Intl.Segmenter
        ? [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(textValue)].map((s) => s.segment)
        : textValue.split(/(\s+)/);
    h1.replaceChildren(
      ...parts.map((part, index) => {
        const span = document.createElement("span");
        span.className = "fx-split-char";
        span.style.setProperty("--fx-c", index);
        span.textContent = part;
        return span;
      })
    );
    h1.setAttribute("aria-label", textValue);
    h1.dataset.fxSplit = h1.textContent;
  }

  let heroStarted = false;
  function playHero() {
    if (heroStarted) return;
    heroStarted = true;
    document.querySelectorAll(".intro-copy > *").forEach((node, index) => node.style.setProperty("--fx-i", index));
    splitHeroTitle();
    root.classList.add("fx-hero-in");
    startReveals();
  }

  function createIntroOverlay() {
    root.classList.add("fx-intro-running");
    const overlay = el("div", "fx-intro", document.body);
    overlay.setAttribute("aria-hidden", "true");
    el("div", "fx-intro__bg", overlay);
    return overlay;
  }

  async function playIntro(overlay) {
    window.scrollTo(0, 0);
    el("div", "fx-ruler fx-ruler--top", overlay);
    el("div", "fx-ruler fx-ruler--left", overlay);
    const skip = el("div", "fx-skip", overlay);
    skip.textContent = "Click to skip";

    let skipped = false;
    const finish = () => {
      if (overlay.classList.contains("is-done")) return;
      overlay.classList.add("is-done");
      root.classList.remove("fx-intro-running");
      playHero();
      setTimeout(() => overlay.remove(), 800);
    };
    const onSkip = () => {
      skipped = true;
      finish();
    };
    overlay.addEventListener("click", onSkip);
    window.addEventListener("keydown", onSkip, { once: true });

    const W = window.innerWidth;
    const H = window.innerHeight;

    // Phase A — cursors swarm in from off-screen and flock around
    const cursors = CURSOR_PEOPLE.slice(0, 5).map((person, index) => {
      const cursor = makeCursor(person, overlay, index < 4);
      const side = index % 4;
      const startX = side === 0 ? -40 : side === 1 ? W + 40 : rand(0, W);
      const startY = side === 2 ? -40 : side === 3 ? H + 40 : rand(0, H);
      cursor.style.transform = `translate(${startX}px, ${startY}px)`;
      return cursor;
    });

    await sleep(80);
    cursors.forEach((cursor, index) => {
      const angle = (index / cursors.length) * Math.PI * 2;
      moveCursor(cursor, W / 2 + Math.cos(angle) * 70 - 9, H * 0.55 + Math.sin(angle) * 40, 750);
    });
    await sleep(700);
    if (skipped) return;
    cursors.forEach((cursor) => moveCursor(cursor, rand(W * 0.15, W * 0.85), rand(H * 0.2, H * 0.85), 600));
    await sleep(350);
    if (skipped) return;

    // Phase B — design canvas: rulers, guides, wireframe frames
    overlay.classList.add("is-canvas");

    const rects = heroTargets
      .map((target) => {
        const node = document.querySelector(target.selector);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4 || rect.top > H || rect.bottom < 0) return null;
        return { ...target, node, rect };
      })
      .filter(Boolean);

    const guides = [];
    rects.slice(0, 4).forEach((item) => {
      const h = el("div", "fx-guide fx-guide--h", overlay);
      h.style.top = `${Math.round(item.rect.top)}px`;
      const v = el("div", "fx-guide fx-guide--v", overlay);
      v.style.left = `${Math.round(item.rect.left)}px`;
      guides.push(h, v);
    });
    guides.forEach((guide, index) => setTimeout(() => guide.classList.add("is-on"), index * 50));

    const frames = rects.map((item) => {
      const frame = el(
        "div",
        `fx-frame${item.image ? " fx-frame--image" : ""}${item.accent ? " fx-frame--accent" : ""}`,
        overlay
      );
      Object.assign(frame.style, {
        left: `${item.rect.left}px`,
        top: `${item.rect.top}px`,
        width: `${item.rect.width}px`,
        height: `${item.rect.height}px`,
      });
      addHandles(frame);
      const label = el("span", "fx-layer-name", frame);
      label.textContent = item.name;
      const size = el("span", "fx-size", frame);
      size.textContent = `${Math.round(item.rect.width)} × ${Math.round(item.rect.height)}`;
      return { frame, node: item.node, rect: item.rect };
    });

    // Each frame is "drawn" by a cursor dragging from its top-left corner
    for (let i = 0; i < frames.length; i += 1) {
      if (skipped) return;
      const { frame, rect } = frames[i];
      const cursor = cursors[i % cursors.length];
      moveCursor(cursor, rect.left, rect.top, 260);
      setTimeout(() => {
        frame.classList.add("is-on");
        moveCursor(cursor, rect.right - 4, rect.bottom - 4, 420);
      }, 220);
      await sleep(150);
    }
    await sleep(500);
    if (skipped) return;

    // Phase C — the real page builds behind the frames (re-measure: images may have loaded)
    frames.forEach(({ frame, node }) => {
      const r = node.getBoundingClientRect();
      Object.assign(frame.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    });
    overlay.classList.add("is-building");
    playHero();
    cursors.forEach((cursor, index) =>
      moveCursor(cursor, index % 2 ? W + 60 : -60, rand(0, H), 900, "cubic-bezier(.55,0,.75,.2)")
    );
    await sleep(900);
    finish();
  }

  /* ------------------------------------------------------------------------
     3. Scroll reveals — every section plays its own Figma tool, once:
          text       : section headings are typed inside a Text box
          marquee    : stats are drag-selected with a selection marquee
          build      : Skills panels are drawn as frames (wireframe -> fill)
          autolayout : video thumbnails spread out of the first card, with
                       pink spacing markers
          place      : photos are placed into grey image placeholders
          component  : contact cards are duplicated from a main component
          media/rise : quieter fallbacks for everything else
     ------------------------------------------------------------------------ */
  const REVEAL_TYPES = [
    [".section-heading", "text"],
    [".stats-band", "marquee"],
    [".skill-panel", "build"],
    [".yt-thumb-grid", "autolayout"],
    [".photo-gallery-item", "place"],
    [".contact-grid", "component"],
    [".work-card", "media"],
    [".yt-show-header, .yt-show-toggle", "rise"],
  ];
  const GROUP_TYPES = new Set(["marquee", "autolayout", "component"]);
  const STAGGER = { build: 220, place: 170 };
  const ALL_REVEALS = REVEAL_TYPES.map(([selector]) => selector).join(",");
  const typeOf = (node) => REVEAL_TYPES.find(([selector]) => node.matches(selector))[1];
  const isVisible = (node) => node.getClientRects().length > 0;

  const frameLayer = el("div", "fx-frames");
  frameLayer.setAttribute("aria-hidden", "true");
  const cursorLayer = el("div", "fx-cursor-layer");
  cursorLayer.setAttribute("aria-hidden", "true");

  /* Overlay helpers (frames live in document coordinates) */
  function overlay(className, r, pad = 0) {
    const node = el("div", `fx-ov ${className}`, frameLayer);
    Object.assign(node.style, {
      left: `${r.left + window.scrollX - pad}px`,
      top: `${r.top + window.scrollY - pad}px`,
      width: `${r.width + pad * 2}px`,
      height: `${r.height + pad * 2}px`,
    });
    return node;
  }

  function addHandles(node) {
    ["tl", "tr", "bl", "br"].forEach((corner) => el("span", `fx-handle fx-handle--${corner}`, node));
    return node;
  }

  function label(node, className, textValue) {
    const tag = el("span", className, node);
    tag.textContent = textValue;
    return tag;
  }

  function fadeOut(node, at) {
    setTimeout(() => node.classList.add("is-gone"), at);
    setTimeout(() => node.remove(), at + 450);
  }

  function animateOnce(node, className, duration) {
    node.classList.remove("fx-pending");
    node.classList.add(className);
    setTimeout(() => node.classList.remove(className), duration);
  }

  /* One named collaborator cursor per tool */
  const helperCursors = {};
  function cursorTo(name, x, y, duration = 400, easing) {
    let c = helperCursors[name];
    if (!c) {
      const person = CURSOR_PEOPLE.find((p) => p.name === name) || CURSOR_PEOPLE[0];
      c = helperCursors[name] = { node: makeCursor(person, cursorLayer), timer: 0 };
    }
    if (!c.node.classList.contains("is-on")) {
      c.node.style.transition = "none";
      c.node.style.transform = `translate(${x - 50}px, ${y + 50}px)`;
      void c.node.offsetWidth;
      c.node.classList.add("is-on");
    }
    moveCursor(c.node, x, y, duration, easing);
    clearTimeout(c.timer);
    c.timer = setTimeout(() => c.node.classList.remove("is-on"), duration + 900);
  }

  function graphemes(value) {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      return [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(value)].length;
    }
    return [...value].length;
  }

  /* text — heading typed inside a Figma text box */
  function playText(node) {
    [...node.children].forEach((child, index) => child.style.setProperty("--fx-i", index));
    const h2 = node.querySelector("h2");
    node.classList.remove("fx-pending");
    if (!h2) {
      animateOnce(node, "fx-in-rise", 1200);
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(h2);
    const tr = range.getBoundingClientRect();
    const hr = h2.getBoundingClientRect();
    const cs = getComputedStyle(h2);
    const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
    const singleLine = tr.height < lineHeight * 1.6;
    const steps = Math.max(1, graphemes(h2.textContent.trim()));
    const duration = Math.round(Math.min(1100, Math.max(450, steps * 55)));
    node.style.setProperty("--fx-type", `${duration}ms`);
    node.style.setProperty("--fx-n", steps);

    const box = addHandles(overlay("fx-textbox", tr, 5));
    const family = cs.fontFamily.split(",")[0].replace(/["']/g, "");
    label(box, "fx-size", `${family} · ${cs.fontWeight} · ${Math.round(parseFloat(cs.fontSize))}`);

    if (singleLine) {
      h2.style.setProperty("--fx-cfrom", `${hr.right - tr.left}px`);
      h2.style.setProperty("--fx-cto", `${hr.right - tr.right}px`);
      h2.classList.add("fx-typing");
      const caret = overlay("fx-caret", { left: tr.left, top: tr.top, width: 2, height: tr.height });
      caret.style.setProperty("--fx-tw", `${tr.width}px`);
      fadeOut(caret, duration + 700);
      cursorTo("Writer", tr.left + 4, tr.top + tr.height * 0.6, 380);
      setTimeout(() => cursorTo("Writer", tr.right + 40, tr.bottom + 24, 600), 420);
    }
    node.classList.add("fx-in-text");
    fadeOut(box, duration + 700);
    setTimeout(() => {
      node.classList.remove("fx-in-text");
      h2.classList.remove("fx-typing");
    }, duration + 1400);
  }

  /* marquee — drag-select the stats, each one appears as it gets selected */
  function playMarquee(group) {
    const items = [...group.children].filter(isVisible);
    const gr = group.getBoundingClientRect();
    const sx = gr.left - 18;
    const sy = gr.top - 14;
    const w = gr.width + 30;
    const h = gr.height + 26;
    const dur = 900;
    const ease = "cubic-bezier(.45,.05,.35,1)";
    const marquee = overlay("fx-marquee", { left: sx, top: sy, width: 0, height: 0 });
    cursorTo("Director", sx, sy, 350);

    setTimeout(() => {
      marquee.style.transition = `width ${dur}ms ${ease}, height ${dur}ms ${ease}, opacity .4s ease`;
      marquee.style.width = `${w}px`;
      marquee.style.height = `${h}px`;
      cursorTo("Director", sx + w, sy + h, dur, ease);

      items.forEach((item) => {
        const r = item.getBoundingClientRect();
        const f = Math.max((r.left + r.width * 0.5 - sx) / w, (r.top + r.height * 0.5 - sy) / h);
        setTimeout(() => {
          animateOnce(item, "fx-pop-in", dur + 1200);
          fadeOut(overlay("fx-select-box", r), dur * (1 - f) + 900);
          const stat = item.querySelector("strong");
          if (stat) countUp(stat);
        }, dur * Math.min(1, Math.max(0, f)));
      });

      setTimeout(() => {
        marquee.classList.add("is-gone");
        setTimeout(() => marquee.remove(), 450);
        const groupBox = addHandles(overlay("fx-group-box", gr, 2));
        label(groupBox, "fx-size", `${items.length} selected`);
        fadeOut(groupBox, 1000);
      }, dur + 60);
    }, 380);
  }

  /* build — Skills panels drawn as frames, then filled */
  function playBuild(node) {
    const r = node.getBoundingClientRect();
    const frame = addHandles(overlay(`fx-bframe${node.querySelector("img, .skill-logo") ? " has-media" : ""}`, r));
    frame.prepend(el("span", "fx-bframe__fill"));
    label(frame, "fx-layer-name", (node.querySelector("h3")?.textContent || "Frame").trim());
    label(frame, "fx-size", `${Math.round(r.width)} × ${Math.round(r.height)}`);
    requestAnimationFrame(() => frame.classList.add("is-drawn"));
    cursorTo("Editor", r.left - 4, r.top - 4, 260);
    setTimeout(() => cursorTo("Editor", r.right - 6, r.bottom - 6, 420), 240);

    setTimeout(() => {
      animateOnce(node, "fx-in-build", 1200);
      frame.classList.add("is-filled");
    }, 380);
    fadeOut(frame, 1000);
  }

  /* autolayout — thumbnails spread out of the first card into the grid */
  function playAutoLayout(grid) {
    const items = [...grid.children].filter(isVisible);
    grid.dataset.fxPlayed = "1";
    if (!items.length) return;
    const gr = grid.getBoundingClientRect();
    const first = items[0].getBoundingClientRect();
    items.forEach((item, index) => {
      const r = item.getBoundingClientRect();
      item.style.setProperty("--fx-dx", `${first.left - r.left}px`);
      item.style.setProperty("--fx-dy", `${first.top - r.top}px`);
      item.style.setProperty("--fx-d", `${index * 70}ms`);
      animateOnce(item, index ? "fx-flip-in" : "fx-pop-in", 1400 + items.length * 70);
    });

    const frame = overlay("fx-autolayout", gr, 6);
    label(frame, "fx-layer-name", `⇉  Auto layout · ${items.length}`);
    fadeOut(frame, 1500 + items.length * 70);
    cursorTo("Motion", first.left + first.width * 0.5, first.top + first.height * 0.5, 350);
    setTimeout(() => cursorTo("Motion", gr.right - 30, first.top + first.height * 0.5, 800), 380);

    const gap = Math.round(parseFloat(getComputedStyle(grid).columnGap) || 0);
    setTimeout(() => {
      const rects = items.map((item) => item.getBoundingClientRect());
      for (let i = 0; i < rects.length - 1; i += 1) {
        const a = rects[i];
        const b = rects[i + 1];
        if (Math.abs(a.top - b.top) > 4 || b.left <= a.right) break;
        const marker = overlay("fx-gap", { left: a.right, top: a.top, width: b.left - a.right, height: a.height });
        label(marker, "fx-gap__label", `${gap}`);
        fadeOut(marker, 1100);
      }
    }, 650 + items.length * 70);
  }

  /* place — grey image placeholder, then the photo is clicked into place */
  const IMAGE_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 18l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  function preparePlace(item) {
    const placeholder = overlay("fx-placeholder", item.getBoundingClientRect());
    placeholder.innerHTML = IMAGE_ICON;
    return placeholder;
  }

  function playPlace(item, placeholder) {
    const r = item.getBoundingClientRect();
    const px = rand(0.3, 0.7) * r.width;
    const py = rand(0.3, 0.7) * r.height;
    cursorTo("DOP", r.left + px, r.top + py, 170);
    setTimeout(() => {
      item.style.setProperty("--fx-px", `${px}px`);
      item.style.setProperty("--fx-py", `${py}px`);
      animateOnce(item, "fx-in-place", 1000);
      fadeOut(placeholder, 120);
      const crop = addHandles(overlay("fx-crop", r));
      label(crop, "fx-size", `${Math.round(r.width)} × ${Math.round(r.height)}`);
      fadeOut(crop, 650);
    }, 180);
  }

  /* component — main component, then Alt-drag duplicates into each slot */
  function playComponent(grid) {
    const items = [...grid.children].filter(isVisible);
    if (!items.length) return;
    const first = items[0].getBoundingClientRect();
    animateOnce(items[0], "fx-pop-in", 1200);
    const main = overlay("fx-component", first, 3);
    label(main, "fx-layer-name", "❖  Main component");
    cursorTo("Colorist", first.left + first.width * 0.5, first.top + first.height * 0.5, 350);

    items.slice(1).forEach((item, index) => {
      const r = item.getBoundingClientRect();
      item.style.setProperty("--fx-dx", `${first.left - r.left}px`);
      item.style.setProperty("--fx-dy", `${first.top - r.top}px`);
      item.style.setProperty("--fx-d", "0ms");
      setTimeout(() => {
        cursorTo("Colorist", first.left + first.width * 0.5, first.top + first.height * 0.5, 120);
        setTimeout(() => cursorTo("Colorist", r.left + r.width * 0.5, r.top + r.height * 0.5, 420), 120);
        animateOnce(item, "fx-flip-in", 1100);
        const instance = overlay("fx-component is-instance", r, 3);
        label(instance, "fx-layer-name", "◇  Instance");
        fadeOut(instance, 1000);
      }, 450 + index * 300);
    });
    fadeOut(main, 650 + items.length * 300);
  }

  function play(node, delay) {
    const type = typeOf(node);
    if (type === "media" || type === "rise") {
      node.style.setProperty("--fx-delay", `${delay}ms`);
      animateOnce(node, `fx-in-${type}`, delay + 1600);
      return;
    }
    // Photos show their placeholder straight away, then fill in turn
    const placeholder = type === "place" ? preparePlace(node) : null;
    setTimeout(() => {
      if (type === "text") playText(node);
      else if (type === "marquee") playMarquee(node);
      else if (type === "build") playBuild(node);
      else if (type === "autolayout") playAutoLayout(node);
      else if (type === "place") playPlace(node, placeholder);
      else if (type === "component") playComponent(node);
    }, delay);
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      let index = 0;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealObserver.unobserve(entry.target);
        // Items that appear together cascade instead of popping at once
        play(entry.target, Math.min(index, 8) * (STAGGER[typeOf(entry.target)] || 90));
        index += 1;
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
  );

  function registerReveals(scope = document) {
    const nodes = [...scope.querySelectorAll(ALL_REVEALS)];
    if (scope instanceof Element && scope.matches(ALL_REVEALS)) nodes.unshift(scope);
    nodes.forEach((node) => {
      if (node.dataset.fxReveal) return;
      // Don't animate something whose parent block is already animating
      if (node.parentElement && node.parentElement.closest(ALL_REVEALS)) return;
      node.dataset.fxReveal = "1";
      // Groups keep their container visible and hide their items
      const hidden = GROUP_TYPES.has(typeOf(node)) ? [...node.children] : [node];
      hidden.forEach((item) => item.classList.add("fx-pending"));
      if (revealsLive) revealObserver.observe(node);
      else revealQueue.push(node);
    });
  }

  // Reveals wait for the intro to finish, so nothing plays behind it
  let revealsLive = false;
  const revealQueue = [];
  function startReveals() {
    if (revealsLive) return;
    revealsLive = true;
    revealQueue.splice(0).forEach((node) => revealObserver.observe(node));
  }

  // Thumbnails revealed later by "show all" pop in instead of staying hidden
  function revealExpanded(cards) {
    cards.forEach((card, index) => {
      card.style.setProperty("--fx-d", `${index * 60}ms`);
      animateOnce(card, "fx-pop-in", 1200 + index * 60);
    });
  }

  function countUp(strong) {
    const original = strong.textContent.trim();
    const match = original.match(/^(\D*)(\d[\d,]*)(.*)$/);
    if (!match) return;
    const [, prefix, digits, suffix] = match;
    const target = Number(digits.replace(/,/g, ""));
    // Years count only the last part so they don't spin from 0
    const from = target > 1900 && target < 2100 ? target - 25 : 0;
    const start = performance.now();
    const duration = 1200;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      strong.textContent = `${prefix}${Math.round(from + (target - from) * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(step);
      else strong.textContent = original;
    };
    requestAnimationFrame(step);
  }

  function watchDynamicContent() {
    const main = document.querySelector("main") || document.body;
    new MutationObserver((mutations) => {
      const expanded = [];
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") {
          const card = mutation.target;
          const grid = card.parentElement;
          if (!card.hidden && card.classList.contains("fx-pending") && grid && grid.dataset.fxPlayed) expanded.push(card);
          return;
        }
        mutation.addedNodes.forEach((added) => {
          if (added.nodeType === 1) registerReveals(added);
        });
      });
      if (expanded.length) revealExpanded(expanded);
    }).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  }

  /* ------------------------------------------------------------------------
     4. Small extras: red spotlight that follows the mouse over cards,
        thin scroll progress bar.
     ------------------------------------------------------------------------ */
  const SPOT_CARDS = ".skill-panel, .contact-card, .work-card";

  function startSpotlight() {
    if (!finePointer) return;
    root.classList.add("fx-hover");
    document.addEventListener(
      "pointermove",
      (event) => {
        const card = event.target.closest && event.target.closest(SPOT_CARDS);
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--fx-mx", `${event.clientX - r.left}px`);
        card.style.setProperty("--fx-my", `${event.clientY - r.top}px`);
      },
      { passive: true }
    );
  }

  function startProgressBar() {
    const bar = el("div", "fx-progress", document.body);
    bar.setAttribute("aria-hidden", "true");
    let queued = false;
    const update = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!queued) {
          queued = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  if (reduceMotion) return;

  root.classList.add("fx-ready");
  document.body.append(frameLayer, cursorLayer);
  registerReveals();
  watchDynamicContent();
  startSpotlight();
  startProgressBar();

  // Play the full intro once per browser session; afterwards just build the hero.
  let seen = false;
  try {
    seen = sessionStorage.getItem("fxIntroSeen") === "1";
    sessionStorage.setItem("fxIntroSeen", "1");
  } catch (error) {
    seen = false;
  }

  const begin = () => {
    // Re-split the title if script.js re-renders it after loading data
    const h1 = document.querySelector(".intro-copy h1");
    if (h1) {
      new MutationObserver(() => {
        if (heroStarted && h1.dataset.fxSplit !== h1.textContent) splitHeroTitle();
      }).observe(h1, { childList: true, characterData: true, subtree: true });
    }
    if (introOverlay) {
      playIntro(introOverlay).catch(() => {
        introOverlay.remove();
        root.classList.remove("fx-intro-running");
        playHero();
      });
    } else {
      playHero();
    }
  };

  // Cover the page right away, then give script.js a moment to render
  // published data so the wireframe frames match the real layout.
  const introOverlay = seen || location.hash ? null : createIntroOverlay();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(begin, 350), { once: true });
  } else {
    setTimeout(begin, 350);
  }

  // Safety net: never leave the hero hidden
  setTimeout(playHero, 9000);
})();
