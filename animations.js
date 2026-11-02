/* ==========================================================================
   Animation layer
   1. Intro: multiplayer cursors fly in -> design-canvas wireframe of the
      hero (rulers, guides, selection frames) -> page "builds" itself.
   2. Hero text/photo build-in.
   3. Cursor crowd that trails the visitor's mouse.
   4. Scroll reveals (blur -> sharp + Figma-style selection flash),
      count-up stats, scroll progress bar.
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
    const cursors = CURSOR_PEOPLE.map((person, index) => {
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
      moveCursor(cursor, W / 2 + Math.cos(angle) * 70 - 9, H * 0.55 + Math.sin(angle) * 40, 900);
    });
    await sleep(850);
    if (skipped) return;
    cursors.forEach((cursor) => moveCursor(cursor, rand(W * 0.15, W * 0.85), rand(H * 0.2, H * 0.85), 700));
    await sleep(500);
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
      for (let i = 0; i < 4; i += 1) el("span", "fx-handle", frame);
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
      await sleep(190);
    }
    await sleep(750);
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
     3. Cursor crowd trailing the visitor's mouse
     ------------------------------------------------------------------------ */
  function startCursorCrowd() {
    if (!finePointer) return;
    const layer = el("div", "fx-crowd", document.body);
    layer.setAttribute("aria-hidden", "true");
    const followers = CURSOR_PEOPLE.slice(0, 5).map((person, index) => ({
      node: makeCursor(person, layer, index < 2),
      x: -100,
      y: -100,
      ox: rand(-90, 90),
      oy: rand(-70, 70),
      lag: 0.05 + index * 0.018,
      phase: rand(0, Math.PI * 2),
    }));

    let mouseX = -200;
    let mouseY = -200;
    let lastMove = 0;
    window.addEventListener(
      "mousemove",
      (event) => {
        mouseX = event.clientX;
        mouseY = event.clientY;
        lastMove = performance.now();
        layer.classList.add("is-on");
      },
      { passive: true }
    );
    document.addEventListener("mouseleave", () => layer.classList.remove("is-on"));

    const tick = (now) => {
      if (now - lastMove > 2500) layer.classList.remove("is-on");
      followers.forEach((f) => {
        const wobble = Math.sin(now / 900 + f.phase);
        const tx = mouseX + f.ox + wobble * 14;
        const ty = mouseY + f.oy + Math.cos(now / 1100 + f.phase) * 12;
        f.x += (tx - f.x) * f.lag;
        f.y += (ty - f.y) * f.lag;
        f.node.style.transform = `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px)`;
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------------
     4. Scroll reveals, count-up, progress bar
     ------------------------------------------------------------------------ */
  const REVEAL_SELECTORS = [
    ".section-heading",
    ".stats-band > div",
    ".skill-panel",
    ".work-card",
    ".yt-thumb-card",
    ".social-thumb-card",
    ".yt-show-block",
    ".photo-gallery-item",
    ".contact-card",
    ".site-footer",
  ].join(",");

  const SELECT_FLASH = ".skill-panel, .work-card, .yt-thumb-card, .social-thumb-card, .contact-card";

  function countUp(strong) {
    const original = strong.textContent.trim();
    const match = original.match(/^(\D*)(\d[\d,]*)(.*)$/);
    if (!match || strong.dataset.fxCounted === original) return;
    strong.dataset.fxCounted = original;
    const [, prefix, digits, suffix] = match;
    const target = Number(digits.replace(/,/g, ""));
    // Years count only the last part so they don't spin from 0
    const from = target > 1900 && target < 2100 ? target - 25 : 0;
    const start = performance.now();
    const duration = 1400;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      strong.textContent = `${prefix}${Math.round(from + (target - from) * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(step);
      else strong.textContent = original;
    };
    requestAnimationFrame(step);
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const node = entry.target;
        node.classList.add("is-in");
        revealObserver.unobserve(node);
        const stat = node.matches(".stats-band > div") && node.querySelector("strong");
        if (stat) setTimeout(() => countUp(stat), 200);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );

  function registerReveals(scope = document) {
    const nodes = [...scope.querySelectorAll(REVEAL_SELECTORS)];
    if (scope instanceof Element && scope.matches(REVEAL_SELECTORS)) nodes.unshift(scope);
    nodes.forEach((node) => {
      if (node.dataset.fxReveal) return;
      node.dataset.fxReveal = "1";
      // Stagger siblings in the same grid
      const siblings = node.parentElement ? [...node.parentElement.children] : [node];
      const index = Math.max(0, siblings.indexOf(node));
      node.style.setProperty("--fx-delay", `${Math.min(index, 8) * 70}ms`);
      node.classList.add("fx-reveal");
      if (node.matches(SELECT_FLASH)) node.classList.add("fx-select");
      revealObserver.observe(node);
    });
  }

  function watchDynamicContent() {
    const main = document.querySelector("main") || document.body;
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) =>
        mutation.addedNodes.forEach((added) => {
          if (added.nodeType === 1) registerReveals(added);
        })
      );
    });
    mutationObserver.observe(main, { childList: true, subtree: true });
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
  registerReveals();
  watchDynamicContent();
  startProgressBar();
  startCursorCrowd();

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
