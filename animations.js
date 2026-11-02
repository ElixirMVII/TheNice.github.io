/* ==========================================================================
   Animation layer
   1. Intro: multiplayer cursors fly in -> design-canvas wireframe of the
      hero (rulers, guides, selection frames) -> page "builds" itself.
   2. Hero text/photo build-in.
   3. Cursor swarm that flies to whatever is being built.
   4. Scroll build: blocks are drawn as wireframes then filled in, and are
      dismantled as they leave the screen. Count-up stats, progress bar.
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
    setTimeout(registerHero, 2400);
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
     3. Cursor swarm — a shared pool of cursors that fly over to whatever
        is being built or dismantled, like collaborators in a design file.
     ------------------------------------------------------------------------ */
  const swarmLayer = el("div", "fx-swarm");
  swarmLayer.setAttribute("aria-hidden", "true");
  const swarm = [];

  function initSwarm() {
    document.body.appendChild(swarmLayer);
    const count = finePointer ? 12 : 6;
    for (let i = 0; i < count; i += 1) {
      const person = CURSOR_PEOPLE[i % CURSOR_PEOPLE.length];
      const node = makeCursor(person, swarmLayer, i < 3);
      swarm.push({ node, busyUntil: 0, idleTimer: 0, x: -60, y: rand(0, window.innerHeight) });
      node.style.transform = `translate(-60px, ${swarm[i].y}px)`;
    }
  }

  function flyCursor(c, x, y, duration) {
    c.x = x;
    c.y = y;
    c.node.classList.add("is-on");
    moveCursor(c.node, x, y, duration);
  }

  function claimCursors(n, duration) {
    const now = performance.now();
    const free = swarm.filter((c) => c.busyUntil < now).sort((a, b) => a.busyUntil - b.busyUntil);
    const picked = free.slice(0, n);
    picked.forEach((c) => {
      c.busyUntil = now + duration;
      clearTimeout(c.idleTimer);
      if (!c.node.classList.contains("is-on")) {
        // Enter from the nearest side edge
        const fromLeft = Math.random() < 0.5;
        c.x = fromLeft ? -40 : window.innerWidth + 40;
        c.y = rand(window.innerHeight * 0.2, window.innerHeight);
        c.node.style.transition = "none";
        c.node.style.transform = `translate(${c.x}px, ${c.y}px)`;
        void c.node.offsetWidth;
      }
    });
    return picked;
  }

  function releaseCursor(c) {
    // Hover around briefly, then fade out
    flyCursor(c, c.x + rand(-60, 60), c.y + rand(-40, 50), 900);
    c.idleTimer = setTimeout(() => c.node.classList.remove("is-on"), 1300);
  }

  /* ------------------------------------------------------------------------
     4. Scroll build: each block is drawn as a wireframe (outline, handles,
        placeholder) by the cursor swarm, then the real content wipes in.
        Blocks that leave the top of the screen get dismantled, and rebuild
        when you scroll back.
     ------------------------------------------------------------------------ */
  const BUILD_SELECTORS = [
    ".section-heading",
    ".stats-band > div",
    ".skill-panel",
    ".work-card",
    ".yt-show-header",
    ".yt-thumb-card",
    ".social-thumb-card",
    ".yt-show-toggle",
    ".photo-gallery-item",
    ".contact-card",
  ].join(",");

  const frameLayer = el("div", "fx-frames");
  frameLayer.setAttribute("aria-hidden", "true");

  function layerName(node) {
    const heading = node.querySelector("h2, h3, strong, .yt-thumb-label");
    const label = heading ? heading.textContent.trim().replace(/\s+/g, " ") : "";
    const kind = node.querySelector("img") ? "Frame" : "Text";
    if (!label) return node.querySelector("img") ? "Image" : "Group";
    return `${kind} · ${label.length > 22 ? `${label.slice(0, 22)}…` : label}`;
  }

  function drawFrame(node, { placeholder, outlineOnly }) {
    const r = node.getBoundingClientRect();
    const frame = el("div", `fx-bframe${placeholder ? " has-media" : ""}${outlineOnly ? " is-outline" : ""}`, frameLayer);
    Object.assign(frame.style, {
      left: `${r.left + window.scrollX}px`,
      top: `${r.top + window.scrollY}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    el("span", "fx-bframe__fill", frame);
    for (let i = 0; i < 4; i += 1) el("span", "fx-handle", frame);
    if (!outlineOnly) {
      const name = el("span", "fx-layer-name", frame);
      name.textContent = layerName(node);
      const size = el("span", "fx-size", frame);
      size.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
    }
    return { frame, r };
  }

  const states = new WeakMap(); // node -> "hidden" | "building" | "built" | "unbuilding"
  let batchCount = 0;
  let batchTimer = 0;

  function nextDelay() {
    const delay = Math.min(batchCount, 10) * 110;
    batchCount += 1;
    clearTimeout(batchTimer);
    batchTimer = setTimeout(() => (batchCount = 0), 120);
    return delay;
  }

  function finishAnimation(node, cls, done) {
    const handler = (event) => {
      if (event.target !== node) return;
      node.removeEventListener("animationend", handler);
      node.classList.remove(cls);
      done();
    };
    node.addEventListener("animationend", handler);
  }

  function build(node) {
    const state = states.get(node);
    if (state === "built" || state === "building") return;
    states.set(node, "building");
    node.classList.remove("fx-unbuilding");
    const delay = nextDelay();

    setTimeout(() => {
      if (states.get(node) !== "building") return;
      const hasMedia = !!node.querySelector("img, .skill-logo");
      const { frame, r } = drawFrame(node, { placeholder: hasMedia });
      requestAnimationFrame(() => frame.classList.add("is-drawn"));

      // Two cursors grab the corners and drag the frame out
      const helpers = claimCursors(r.width > 260 ? 2 : 1, 1500);
      helpers.forEach((c, i) => {
        flyCursor(c, i ? r.right - 10 : r.left - 4, i ? r.top + 6 : r.top - 4, 380);
        setTimeout(() => flyCursor(c, i ? r.left + r.width * 0.3 : r.right - 6, r.bottom - 6, 520), 360);
        setTimeout(() => releaseCursor(c), 1000);
      });

      setTimeout(() => {
        if (states.get(node) !== "building") return frame.remove();
        node.classList.remove("fx-hidden");
        node.classList.add("fx-building");
        frame.classList.add("is-filled");
        finishAnimation(node, "fx-building", () => states.get(node) === "building" && states.set(node, "built"));
        const stat = node.matches(".stats-band > div") && node.querySelector("strong");
        if (stat) countUp(stat);
      }, 420);

      setTimeout(() => frame.classList.add("is-gone"), 1150);
      setTimeout(() => frame.remove(), 1600);
    }, delay);
  }

  function unbuild(node, direction) {
    const state = states.get(node);
    if (state === "hidden" || state === "unbuilding") return;
    if (state === "building") {
      // Never finished building: just hide again
      node.classList.remove("fx-building");
      node.classList.add("fx-hidden");
      states.set(node, "hidden");
      return;
    }
    states.set(node, "unbuilding");
    const { frame, r } = drawFrame(node, { outlineOnly: true });
    frame.classList.add("is-drawn");
    node.style.setProperty("--fx-out", direction === "up" ? "inset(0 0 100% 0)" : "inset(100% 0 0 0)");
    node.classList.add("fx-unbuilding");
    const [helper] = claimCursors(1, 900);
    if (helper) {
      flyCursor(helper, r.left + r.width * 0.5, direction === "up" ? r.top + 8 : r.bottom - 12, 320);
      setTimeout(() => releaseCursor(helper), 500);
    }
    finishAnimation(node, "fx-unbuilding", () => {
      if (states.get(node) !== "unbuilding") return;
      node.classList.add("fx-hidden");
      states.set(node, "hidden");
    });
    setTimeout(() => frame.classList.add("is-gone"), 250);
    setTimeout(() => frame.remove(), 700);
  }

  // The active zone excludes the strip under the sticky header, so things are
  // dismantled as they slide up beneath it.
  const buildObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const node = entry.target;
        if (entry.isIntersecting) build(node);
        else if (entry.boundingClientRect.height > 0) unbuild(node, entry.boundingClientRect.top < 0 ? "up" : "down");
      });
    },
    { rootMargin: "-14% 0px -4% 0px", threshold: 0 }
  );

  function registerBuilders(scope = document) {
    const nodes = [...scope.querySelectorAll(BUILD_SELECTORS)];
    if (scope instanceof Element && scope.matches(BUILD_SELECTORS)) nodes.unshift(scope);
    nodes.forEach((node) => {
      if (states.has(node)) return;
      // Don't nest builders inside other builders
      const parent = node.parentElement && node.parentElement.closest(BUILD_SELECTORS);
      if (parent) return;
      states.set(node, "hidden");
      node.classList.add("fx-hidden");
      buildObserver.observe(node);
    });
  }

  // Hero items join after their intro animation, already built
  function registerHero() {
    root.classList.add("fx-hero-done");
    document.querySelectorAll(".intro-copy > *, .portrait-frame").forEach((node) => {
      if (states.has(node)) return;
      states.set(node, "built");
      buildObserver.observe(node);
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
      mutations.forEach((mutation) =>
        mutation.addedNodes.forEach((added) => {
          if (added.nodeType === 1) registerBuilders(added);
        })
      );
    }).observe(main, { childList: true, subtree: true });
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
  document.body.appendChild(frameLayer);
  initSwarm();
  registerBuilders();
  watchDynamicContent();
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
