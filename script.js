const header = document.querySelector(".site-header");
const navToggle = document.querySelector(".nav-toggle");
const navLinks = [...document.querySelectorAll(".site-nav a")];
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

const storageKey = "portfolioEditorDataV2";
const dataFile = "portfolio-data.json";
const editModeEnabled = location.protocol === "file:" || new URLSearchParams(location.search).has("edit");
const editLauncher = document.querySelector(".edit-launcher");
const editor = document.querySelector(".portfolio-editor");
const editorPanel = document.querySelector(".editor-panel");
const editorFields = document.querySelector("#editor-fields");
const editorClose = document.querySelector(".editor-close");

document.getElementById("year").textContent = new Date().getFullYear();

navToggle.addEventListener("click", () => {
  const isOpen = header.classList.toggle("nav-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    header.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      navLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
      });
    });
  },
  {
    rootMargin: "-35% 0px -55% 0px",
    threshold: 0,
  }
);

sections.forEach((section) => observer.observe(section));

const text = (selector) => document.querySelector(selector)?.textContent.trim() || "";
const listText = (selector) => [...document.querySelectorAll(selector)].map((item) => item.textContent.trim());

const defaultPortfolioData = {
  site: {
    ownerName: text(".brand-copy strong"),
    englishName: "",
    brandSubtitle: text(".brand-copy small"),
    heroEyebrow: text(".intro-copy .eyebrow"),
    lead: text(".intro-copy .lead"),
    about: document.querySelector(".intro-copy > p:not(.eyebrow):not(.lead)")?.textContent.trim() || "",
    roles: listText(".role-strip span"),
    profileImage: "assets/profile.jpg",
    profileImages: [
      "assets/profile.jpg",
      "assets/profile2.jpg",
      "assets/profile3.jpg"
    ],
    portraitCaption: text(".portrait-frame figcaption"),
    footerQuote: text(".site-footer > span:last-child"),
  },
  stats: [...document.querySelectorAll(".stats-band div")].map((item) => ({
    number: item.querySelector("strong")?.textContent.trim() || "",
    label: item.querySelector("span")?.textContent.trim() || "",
  })),
  sections: {
    worksTitle: text("#works .section-heading h2"),
    worksIntro: text("#works .section-heading p:last-child"),
    shortMvTitle: text("#short-mv .section-heading h2"),
    shortMvIntro: text("#short-mv .section-heading p:last-child"),
    photoTitle: text("#photo .section-heading h2"),
    photoIntro: text("#photo .section-heading p:last-child"),
    btsTitle: text("#bts .section-heading h2"),
    btsIntro: text("#bts .section-heading p:last-child"),
    skillsTitle: text("#skills .section-heading h2"),
    contactTitle: text("#contact .section-heading h2"),
  },
  works: [],
  shortMv: [],
  photoGallery: [],
  resources: {
    photo: [],
    bts: [],
  },
  skills: [...document.querySelectorAll(".skill-panel")].map((panel) => ({
    title: panel.querySelector("h3")?.textContent.trim() || "",
    description: panel.querySelector("p")?.textContent.trim() || "",
    logo: "",
  })),
  contacts: [...document.querySelectorAll(".contact-card")].map((card) => ({
    label: card.querySelector("strong")?.textContent.trim() || "",
    value: card.querySelector("span")?.textContent.trim() || "",
    href: card.getAttribute("href") || "",
  })),
};

let publishedPortfolioData = {};
let portfolioData = mergeData(defaultPortfolioData, {});

function loadSavedData() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function loadBundledData() {
  return window.PORTFOLIO_DATA || {};
}

async function loadPublishedData() {
  try {
    const response = await fetch(dataFile, { cache: "no-store" });
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  }
}

function mergeData(base, override) {
  if (Array.isArray(base)) {
    const overrideArray = Array.isArray(override) ? override : [];
    const length = Math.max(base.length, overrideArray.length);
    return Array.from({ length }, (_, index) => mergeData(base[index], overrideArray[index]));
  }

  if (!base || typeof base !== "object") {
    return override ?? base;
  }

  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return structuredClone(base);
  }

  const keys = new Set([...Object.keys(base), ...Object.keys(override)]);
  return Object.fromEntries(
    [...keys].map((key) => [key, mergeData(base[key], override[key])])
  );
}

function getPath(path) {
  return path.split(".").reduce((current, key) => current?.[key], portfolioData);
}

function setPath(path, value) {
  const keys = path.split(".");
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => current[key], portfolioData);
  target[lastKey] = value;
}

function splitList(value) {
  return value
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLinkList(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label, ...urlParts] = line.split("|").map((part) => part.trim());
      const url = urlParts.join("|").trim();
      return url
        ? { label: label || `ลิงก์ ${index + 1}`, url }
        : { label: `ลิงก์ ${index + 1}`, url: label };
    })
    .filter((item) => item.url);
}

function formatLinkList(links = []) {
  return links.map((link) => `${link.label} | ${link.url}`).join("\n");
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setTextFor(parent, selector, value) {
  const element = parent.querySelector(selector);
  if (element) element.textContent = value;
}

function renderList(containerSelector, items) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.replaceChildren(...items.map((item) => {
    const span = document.createElement("span");
    span.textContent = item;
    return span;
  }));
}

function initialsFromName(name) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return initials || "PF";
}

function createTags(tags = []) {
  return tags.map((tag) => {
    const span = document.createElement("span");
    span.textContent = tag;
    return span;
  });
}

function createLinks(links = []) {
  return links.map((link) => {
    const anchor = document.createElement("a");
    anchor.className = "work-link";
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = link.label;
    return anchor;
  });
}

function createWorkCard(item, index) {
  const card = document.createElement("article");
  card.className = `work-card${item.featured || index === 0 ? " featured" : ""}`;

  const image = document.createElement("img");
  image.src = item.image || "assets/project-editorial.png";
  image.alt = item.title || "Portfolio work";

  const info = document.createElement("div");
  info.className = "work-info";

  const kicker = document.createElement("p");
  kicker.className = "work-kicker";
  kicker.textContent = item.kicker || "Selected Work";

  const title = document.createElement("h3");
  title.textContent = item.title || "Untitled";

  const description = document.createElement("p");
  description.textContent = item.description || "";

  const tagRow = document.createElement("div");
  tagRow.className = "tag-row";
  tagRow.replaceChildren(...createTags(item.tags || []));

  const links = document.createElement("div");
  links.className = "work-links";
  const itemLinks = item.links?.length ? item.links : item.url ? [{ label: "เปิดผลงาน", url: item.url }] : [];
  links.replaceChildren(...createLinks(itemLinks));

  info.append(kicker, title, description, tagRow, links);
  card.append(image, info);
  return card;
}

function renderCardGrid(selector, items) {
  const grid = document.querySelector(selector);
  if (!grid) return;
  grid.replaceChildren(...items.map((item, index) => createWorkCard(item, index)));
}

// ─── YouTube helpers ────────────────────────────────────────────────────────

function getSocialPlatform(url) {
  if (!url) return null;
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/facebook\.com|fb\.com/i.test(url)) return "facebook";
  return null;
}

const SOCIAL_META = {
  tiktok: {
    label: "TikTok",
    color: "#010101",
    accent: "#69C9D0",
    icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="28" height="28"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>`,
  },
  instagram: {
    label: "Instagram",
    color: "#1a0a1e",
    accent: "#E1306C",
    icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="28" height="28"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`,
  },
  facebook: {
    label: "Facebook",
    color: "#0d1e3d",
    accent: "#1877F2",
    icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="28" height="28"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  },
};

function getSocialThumb(platform) {
  const meta = SOCIAL_META[platform];
  if (!meta) return null;
  // สร้าง thumbnail placeholder เป็น SVG data URI
  const svgContent = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='225'><rect width='400' height='225' fill='${meta.color}'/><text x='200' y='120' text-anchor='middle' dominant-baseline='middle' font-size='80' fill='${meta.accent}' font-family='sans-serif'>${platform === 'tiktok' ? '▶' : platform === 'instagram' ? '▶' : '▶'}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
}

function createSocialLinkCard(link) {
  const platform = getSocialPlatform(link.url);
  const meta = platform ? SOCIAL_META[platform] : null;

  const card = document.createElement("a");
  card.className = "social-thumb-card";
  card.href = link.url;
  card.target = "_blank";
  card.rel = "noreferrer";
  card.setAttribute("aria-label", `เปิด ${link.label} ใน ${meta?.label || "Social Media"}`);
  if (platform) card.dataset.platform = platform;

  const imgWrap = document.createElement("div");
  imgWrap.className = "yt-thumb-wrap social-thumb-wrap";

  // Background gradient ตาม platform
  if (meta) {
    imgWrap.style.background = meta.color;
  }

  // Icon กลาง
  const iconBox = document.createElement("div");
  iconBox.className = "social-platform-icon";
  if (meta) {
    iconBox.style.color = meta.accent;
    iconBox.innerHTML = meta.icon;
  }

  // Play overlay
  const playOverlay = document.createElement("div");
  playOverlay.className = "social-play-overlay";
  playOverlay.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="white"><path d="M8 5v14l11-7z"/></svg>`;

  imgWrap.append(iconBox, playOverlay);

  const label = document.createElement("span");
  label.className = "yt-thumb-label";
  label.textContent = link.label;

  card.append(imgWrap, label);
  return card;
}

function getYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function getYouTubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

// ─── Modal ──────────────────────────────────────────────────────────────────

let ytModal = null;
let ytModalIframe = null;

function ensureModal() {
  if (ytModal) return;
  ytModal = document.createElement("div");
  ytModal.className = "yt-modal";
  ytModal.setAttribute("role", "dialog");
  ytModal.setAttribute("aria-modal", "true");
  ytModal.setAttribute("aria-label", "เล่นวิดีโอ");

  const backdrop = document.createElement("div");
  backdrop.className = "yt-modal-backdrop";
  backdrop.addEventListener("click", closeModal);

  const box = document.createElement("div");
  box.className = "yt-modal-box";

  const closeBtn = document.createElement("button");
  closeBtn.className = "yt-modal-close";
  closeBtn.setAttribute("aria-label", "ปิดวิดีโอ");
  closeBtn.innerHTML = "&#x2715;";
  closeBtn.addEventListener("click", closeModal);

  const iframeWrap = document.createElement("div");
  iframeWrap.className = "yt-modal-iframe-wrap";

  ytModalIframe = document.createElement("iframe");
  ytModalIframe.setAttribute("allowfullscreen", "");
  ytModalIframe.setAttribute("allow", "autoplay; encrypted-media");
  ytModalIframe.setAttribute("frameborder", "0");

  iframeWrap.appendChild(ytModalIframe);
  box.append(closeBtn, iframeWrap);
  ytModal.append(backdrop, box);
  document.body.appendChild(ytModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ytModal.classList.contains("open")) closeModal();
  });
}

function openModal(videoId, startSeconds) {
  ensureModal();
  const startParam = startSeconds ? `&start=${startSeconds}` : "";
  ytModalIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1${startParam}`;
  ytModal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (!ytModal) return;
  ytModal.classList.remove("open");
  ytModalIframe.src = "";
  document.body.style.overflow = "";
}

function getStartSeconds(url) {
  try {
    const u = new URL(url);
    const t = u.searchParams.get("t");
    if (t) return parseInt(t, 10);
    const siHash = url.match(/[?&]t=(\d+)/);
    if (siHash) return parseInt(siHash[1], 10);
  } catch {}
  return 0;
}

// ─── Video thumbnail card ────────────────────────────────────────────────────

function createVideoThumbCard(link) {
  const videoId = getYouTubeId(link.url);
  if (!videoId) return null;

  const card = document.createElement("button");
  card.className = "yt-thumb-card";
  card.setAttribute("aria-label", `เล่น ${link.label}`);

  const imgWrap = document.createElement("div");
  imgWrap.className = "yt-thumb-wrap";

  const img = document.createElement("img");
  img.src = getYouTubeThumbnail(videoId);
  img.alt = link.label;
  img.loading = "lazy";

  const playIcon = document.createElement("div");
  playIcon.className = "yt-play-icon";
  playIcon.innerHTML = `<svg viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg"><path d="M66.52 7.74C65.7 4.7 63.3 2.3 60.28 1.48 54.96 0 34 0 34 0S13.04 0 7.72 1.48C4.7 2.3 2.3 4.7 1.48 7.74 0 13.06 0 24 0 24s0 10.94 1.48 16.26C2.3 43.3 4.7 45.7 7.72 46.52 13.04 48 34 48 34 48s20.96 0 26.28-1.48c3.02-.82 5.42-3.22 6.24-6.26C68 34.94 68 24 68 24s0-10.94-1.48-16.26z" fill="rgba(229,9,20,0.92)"/><path d="M45 24 27 14v20z" fill="#fff"/></svg>`;

  imgWrap.append(img, playIcon);

  const label = document.createElement("span");
  label.className = "yt-thumb-label";
  label.textContent = link.label;

  card.append(imgWrap, label);

  const startSec = getStartSeconds(link.url);
  card.addEventListener("click", () => openModal(videoId, startSec));
  return card;
}

// ─── Works section: grouped by show ─────────────────────────────────────────

const collapsedThumbLimit = 6;
const collapsibleThumbThreshold = 8;

function renderWorksSection(works, gridSelector) {
  const grid = document.querySelector(gridSelector || "#works .work-grid");
  if (!grid) return;
  grid.replaceChildren();

  works.forEach((item) => {
    const youtubeLinks = (item.links || []).filter((l) => getYouTubeId(l.url));
    const socialLinks = (item.links || []).filter((l) => !getYouTubeId(l.url) && getSocialPlatform(l.url));
    const otherLinks = (item.links || []).filter((l) => !getYouTubeId(l.url) && !getSocialPlatform(l.url));

    const hasVideoCards = youtubeLinks.length > 0 || socialLinks.length > 0;

    if (!hasVideoCards) {
      // fallback: use original card rendering
      grid.appendChild(createWorkCard(item, grid.children.length));
      return;
    }

    // Group block
    const block = document.createElement("div");
    block.className = "yt-show-block";

    // Header
    const header = document.createElement("div");
    header.className = "yt-show-header";

    const kicker = document.createElement("p");
    kicker.className = "work-kicker";
    kicker.textContent = item.kicker || "";

    const title = document.createElement("h3");
    title.textContent = item.title || "";

    const desc = document.createElement("p");
    desc.className = "yt-show-desc";
    desc.textContent = item.description || "";

    const tagRow = document.createElement("div");
    tagRow.className = "tag-row";
    tagRow.replaceChildren(...createTags(item.tags || []));

    header.append(kicker, title, desc, tagRow);

    if (otherLinks.length) {
      const linkRow = document.createElement("div");
      linkRow.className = "work-links";
      linkRow.replaceChildren(...createLinks(otherLinks));
      header.appendChild(linkRow);
    }

    // Thumbnail grid — YouTube + Social cards เรียงด้วยกัน
    const thumbGrid = document.createElement("div");
    thumbGrid.className = "yt-thumb-grid";

    const thumbCards = [
      ...youtubeLinks.map(createVideoThumbCard).filter(Boolean),
      ...socialLinks.map(createSocialLinkCard).filter(Boolean),
    ];
    thumbGrid.replaceChildren(...thumbCards);

    if (thumbCards.length > collapsibleThumbThreshold) {
      const toggle = document.createElement("button");
      toggle.className = "yt-show-toggle";
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "false");

      const icon = document.createElement("i");
      icon.className = "fa-solid fa-chevron-down";
      icon.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");

      const updateToggle = () => {
        const isExpanded = toggle.getAttribute("aria-expanded") === "true";
        thumbCards.forEach((card, index) => {
          card.hidden = !isExpanded && index >= collapsedThumbLimit;
        });
        label.textContent = isExpanded
          ? "\u0e41\u0e2a\u0e14\u0e07\u0e19\u0e49\u0e2d\u0e22\u0e25\u0e07"
          : "\u0e41\u0e2a\u0e14\u0e07\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14";
        icon.className = `fa-solid ${isExpanded ? "fa-chevron-up" : "fa-chevron-down"}`;
      };

      toggle.append(icon, label);
      toggle.addEventListener("click", () => {
        const isExpanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!isExpanded));
        updateToggle();
      });
      updateToggle();

      block.append(header, thumbGrid, toggle);
    } else {
      block.append(header, thumbGrid);
    }
    grid.appendChild(block);
  });
}

// ─── Photo Gallery + Lightbox ───────────────────────────────────────────────

let photoLightbox = null;
let photoLightboxImg = null;
let photoLightboxCounter = null;
let currentPhotoIndex = 0;
let currentPhotoList = [];

function ensurePhotoLightbox() {
  if (photoLightbox) return;
  photoLightbox = document.createElement("div");
  photoLightbox.className = "photo-lightbox";
  photoLightbox.setAttribute("role", "dialog");
  photoLightbox.setAttribute("aria-modal", "true");
  photoLightbox.setAttribute("aria-label", "ดูภาพขยาย");

  const backdrop = document.createElement("div");
  backdrop.className = "photo-lightbox-backdrop";
  backdrop.addEventListener("click", closePhotoLightbox);

  const content = document.createElement("div");
  content.className = "photo-lightbox-content";

  const closeBtn = document.createElement("button");
  closeBtn.className = "photo-lightbox-close";
  closeBtn.setAttribute("aria-label", "ปิด");
  closeBtn.innerHTML = "&#x2715;";
  closeBtn.addEventListener("click", closePhotoLightbox);

  const prevBtn = document.createElement("button");
  prevBtn.className = "photo-lightbox-nav photo-lightbox-prev";
  prevBtn.setAttribute("aria-label", "ภาพก่อนหน้า");
  prevBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="28" height="28"><polyline points="15 18 9 12 15 6"/></svg>`;
  prevBtn.addEventListener("click", () => navigatePhoto(-1));

  const nextBtn = document.createElement("button");
  nextBtn.className = "photo-lightbox-nav photo-lightbox-next";
  nextBtn.setAttribute("aria-label", "ภาพถัดไป");
  nextBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="28" height="28"><polyline points="9 18 15 12 9 6"/></svg>`;
  nextBtn.addEventListener("click", () => navigatePhoto(1));

  photoLightboxImg = document.createElement("img");
  photoLightboxImg.className = "photo-lightbox-img";
  photoLightboxImg.alt = "ภาพขยาย";

  photoLightboxCounter = document.createElement("span");
  photoLightboxCounter.className = "photo-lightbox-counter";

  content.append(closeBtn, prevBtn, photoLightboxImg, nextBtn, photoLightboxCounter);
  photoLightbox.append(backdrop, content);
  document.body.appendChild(photoLightbox);

  document.addEventListener("keydown", (e) => {
    if (!photoLightbox.classList.contains("open")) return;
    if (e.key === "Escape") closePhotoLightbox();
    if (e.key === "ArrowLeft") navigatePhoto(-1);
    if (e.key === "ArrowRight") navigatePhoto(1);
  });
}

function openPhotoLightbox(index) {
  ensurePhotoLightbox();
  currentPhotoIndex = index;
  updateLightboxPhoto();
  photoLightbox.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closePhotoLightbox() {
  if (!photoLightbox) return;
  photoLightbox.classList.remove("open");
  document.body.style.overflow = "";
}

function navigatePhoto(direction) {
  currentPhotoIndex = (currentPhotoIndex + direction + currentPhotoList.length) % currentPhotoList.length;
  updateLightboxPhoto();
}

function updateLightboxPhoto() {
  photoLightboxImg.src = currentPhotoList[currentPhotoIndex];
  photoLightboxCounter.textContent = `${currentPhotoIndex + 1} / ${currentPhotoList.length}`;
}

function renderPhotoGallery(photos) {
  const gallery = document.getElementById("photo-gallery");
  if (!gallery || !photos || !photos.length) return;

  currentPhotoList = photos;
  gallery.replaceChildren();

  photos.forEach((src, index) => {
    const item = document.createElement("button");
    item.className = "photo-gallery-item";
    item.type = "button";
    item.setAttribute("aria-label", `ดูภาพที่ ${index + 1}`);

    const img = document.createElement("img");
    img.src = src;
    img.alt = `ภาพนิ่ง ${index + 1}`;
    img.loading = "lazy";

    const overlay = document.createElement("div");
    overlay.className = "photo-gallery-overlay";
    overlay.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;

    item.append(img, overlay);
    item.addEventListener("click", () => openPhotoLightbox(index));
    gallery.appendChild(item);
  });
}

function renderPortfolio() {
  document.title = `Portfolio | ${portfolioData.site.ownerName || "Your Name"}`;
  setText(".brand-copy strong", portfolioData.site.ownerName);
  setText(".brand-copy small", portfolioData.site.brandSubtitle);
  setText(".brand-mark", initialsFromName(portfolioData.site.englishName || portfolioData.site.ownerName));
  setText(".intro-copy .eyebrow", portfolioData.site.heroEyebrow);
  setText(".intro-copy h1", portfolioData.site.ownerName);
  setText(".intro-copy .lead", portfolioData.site.lead);
  setText(".intro-copy > p:not(.eyebrow):not(.lead)", portfolioData.site.about);
  setText(".portrait-frame figcaption", portfolioData.site.portraitCaption);
  setText(".site-footer > span:last-child", portfolioData.site.footerQuote);
  renderList(".role-strip", portfolioData.site.roles || []);

  renderProfileImages();

  const footerName = document.querySelector(".site-footer > span:first-child");
  if (footerName) {
    footerName.replaceChildren(
      document.createTextNode("© "),
      Object.assign(document.createElement("span"), {
        id: "year",
        textContent: new Date().getFullYear(),
      }),
      document.createTextNode(` ${portfolioData.site.ownerName}`)
    );
  }

  document.querySelectorAll(".stats-band div").forEach((item, index) => {
    const stat = portfolioData.stats[index];
    if (!stat) return;
    item.querySelector("strong").textContent = stat.number;
    item.querySelector("span").textContent = stat.label;
  });

  setText("#works .section-heading h2", portfolioData.sections.worksTitle);
  setText("#works .section-heading p:last-child", portfolioData.sections.worksIntro);
  setText("#short-mv .section-heading h2", portfolioData.sections.shortMvTitle);
  setText("#short-mv .section-heading p:last-child", portfolioData.sections.shortMvIntro);
  setText("#photo .section-heading h2", portfolioData.sections.photoTitle);
  setText("#photo .section-heading p:last-child", portfolioData.sections.photoIntro);
  setText("#bts .section-heading h2", portfolioData.sections.btsTitle);
  setText("#bts .section-heading p:last-child", portfolioData.sections.btsIntro);
  setText("#skills .section-heading h2", portfolioData.sections.skillsTitle);
  setText("#contact .section-heading h2", portfolioData.sections.contactTitle);

  renderWorksSection(portfolioData.works || []);
  renderWorksSection(portfolioData.shortMv || [], "#short-mv .short-mv-grid");
  renderCardGrid("#photo .resource-grid", portfolioData.resources?.photo || []);
  renderCardGrid("#bts .bts-grid", portfolioData.resources?.bts || []);
  renderPhotoGallery(portfolioData.photoGallery || []);

  const skillLayout = document.querySelector(".skill-layout");
  if (skillLayout) {
    skillLayout.replaceChildren(...(portfolioData.skills || []).map((skill) => {
      const panel = document.createElement("div");
      panel.className = "skill-panel";

      if (skill.logo) {
        const logoWrap = document.createElement("div");
        logoWrap.className = "skill-logo";
        const logo = document.createElement("img");
        logo.src = skill.logo;
        logo.alt = skill.title;
        logoWrap.append(logo);
        panel.append(logoWrap);
      }

      const title = document.createElement("h3");
      title.textContent = skill.title;
      const description = document.createElement("p");
      description.textContent = skill.description;
      panel.append(title, description);
      return panel;
    }));
  }

  const contactGrid = document.querySelector(".contact-grid");
  if (contactGrid) {
    const existingIcons = ["fa-envelope", "fa-phone", "fa-square-facebook", "fa-instagram", "fa-line"];
    contactGrid.replaceChildren(...(portfolioData.contacts || []).map((contact, index) => {
      const card = document.createElement("a");
      card.className = "contact-card";
      card.href = contact.href;
      card.target = contact.href?.startsWith("http") ? "_blank" : "";
      card.rel = contact.href?.startsWith("http") ? "noreferrer" : "";

      const icon = document.createElement("i");
      icon.className = `fa-solid ${existingIcons[index] || "fa-link"}`;
      if (contact.icon?.startsWith("fa-")) icon.className = contact.icon;
      icon.setAttribute("aria-hidden", "true");

      const label = document.createElement("strong");
      label.textContent = contact.label;
      const value = document.createElement("span");
      value.textContent = contact.value;
      card.append(icon, label, value);
      return card;
    }));
  }
}

function field(label, path, type = "text") {
  return { label, path, type };
}

function renderProfileImages() {
  const portraitFrame = document.querySelector(".portrait-frame");
  const portrait = portraitFrame?.querySelector("img");
  if (!portraitFrame || !portrait) return;

  const images = portfolioData.site.profileImages?.length
    ? portfolioData.site.profileImages
    : [portfolioData.site.profileImage].filter(Boolean);
  const firstImage = images[0] || "assets/profile.jpg";
  portrait.src = firstImage;
  portrait.alt = portfolioData.site.ownerName;

  let thumbs = portraitFrame.querySelector(".profile-thumbs");
  if (!thumbs) {
    thumbs = document.createElement("div");
    thumbs.className = "profile-thumbs";
    portrait.insertAdjacentElement("afterend", thumbs);
  }

  thumbs.replaceChildren(...images.map((src, index) => {
    const button = document.createElement("button");
    button.className = `profile-thumb${index === 0 ? " active" : ""}`;
    button.type = "button";
    button.setAttribute("aria-label", `ดูรูปโปรไฟล์ ${index + 1}`);

    const image = document.createElement("img");
    image.src = src;
    image.alt = "";
    button.append(image);

    button.addEventListener("click", () => {
      portrait.src = src;
      thumbs.querySelectorAll(".profile-thumb").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });

    return button;
  }));
}

function workFields(basePath) {
  return [
    field("หมวดงาน", `${basePath}.kicker`),
    field("ชื่อกลุ่มผลงาน", `${basePath}.title`),
    field("รายละเอียด", `${basePath}.description`, "textarea"),
    field("Tags คั่นด้วย comma", `${basePath}.tags`, "list"),
    field("ลิงก์หลายรายการ รูปแบบ: ชื่อ | URL", `${basePath}.links`, "linkList"),
    field("รูปภาพ / URL หรือ path", `${basePath}.image`),
  ];
}

function buildEditorGroups() {
  return [
    {
      title: "ข้อมูลหลัก",
      fields: [
        field("ชื่อที่แสดง", "site.ownerName"),
        field("ชื่ออังกฤษ", "site.englishName"),
        field("คำอธิบายใต้ชื่อ", "site.brandSubtitle"),
        field("Eyebrow เหนือชื่อ", "site.heroEyebrow"),
        field("ประโยคแนะนำตัว", "site.lead", "textarea"),
        field("About / ประวัติย่อ", "site.about", "textarea"),
        field("บทบาท / skill chips คั่นด้วย comma", "site.roles", "list"),
        field("รูปโปรไฟล์หลัก / URL หรือ path", "site.profileImage"),
        field("รูปโปรไฟล์หลายรูป คั่นด้วย comma", "site.profileImages", "list"),
        field("คำใต้รูปโปรไฟล์", "site.portraitCaption"),
        field("ข้อความท้ายเว็บ", "site.footerQuote"),
      ],
    },
    {
      title: "ตัวเลขสรุป",
      fields: (portfolioData.stats || []).flatMap((_, index) => [
        field(`ตัวเลข ${index + 1}`, `stats.${index}.number`),
        field(`คำอธิบาย ${index + 1}`, `stats.${index}.label`),
      ]),
    },
    {
      title: "หัวข้อแต่ละส่วน",
      fields: [
        field("หัวข้อถ่ายและตัดต่อ", "sections.worksTitle"),
        field("คำอธิบายถ่ายและตัดต่อ", "sections.worksIntro", "textarea"),
        field("หัวข้อหนังสั้น/MV", "sections.shortMvTitle"),
        field("คำอธิบายหนังสั้น/MV", "sections.shortMvIntro", "textarea"),
        field("หัวข้อภาพนิ่ง", "sections.photoTitle"),
        field("คำอธิบายภาพนิ่ง", "sections.photoIntro", "textarea"),
        field("หัวข้อเบื้องหลัง", "sections.btsTitle"),
        field("คำอธิบายเบื้องหลัง", "sections.btsIntro", "textarea"),
        field("หัวข้อ Skills", "sections.skillsTitle"),
        field("หัวข้อ Contact", "sections.contactTitle"),
      ],
    },
    ...((portfolioData.skills || []).map((_, index) => ({
      title: `Skill ${index + 1}`,
      fields: [
        field(`ชื่อทักษะ ${index + 1}`, `skills.${index}.title`),
        field(`รายละเอียดทักษะ ${index + 1}`, `skills.${index}.description`, "textarea"),
        field(`ไฟล์โลโก้ ${index + 1}`, `skills.${index}.logo`),
      ],
    }))),
    ...((portfolioData.works || []).map((_, index) => ({
      title: `ถ่ายและตัดต่อ ${index + 1}`,
      fields: workFields(`works.${index}`),
    }))),
    ...((portfolioData.shortMv || []).map((_, index) => ({
      title: `หนังสั้น/MV ${index + 1}`,
      fields: workFields(`shortMv.${index}`),
    }))),
    ...((portfolioData.resources?.photo || []).map((_, index) => ({
      title: `ภาพนิ่ง ${index + 1}`,
      fields: workFields(`resources.photo.${index}`),
    }))),
    ...((portfolioData.resources?.bts || []).map((_, index) => ({
      title: `เบื้องหลัง ${index + 1}`,
      fields: workFields(`resources.bts.${index}`),
    }))),
    {
      title: "Contact",
      fields: (portfolioData.contacts || []).flatMap((_, index) => [
        field(`ชื่อช่องทาง ${index + 1}`, `contacts.${index}.label`),
        field(`ข้อความที่แสดง ${index + 1}`, `contacts.${index}.value`),
        field(`ลิงก์ ${index + 1}`, `contacts.${index}.href`),
      ]),
    },
  ];
}

function buildEditor() {
  editorFields.replaceChildren(...buildEditorGroups().map((group, index) => {
    const details = document.createElement("details");
    details.className = "editor-group";
    details.open = index < 2;

    const summary = document.createElement("summary");
    summary.textContent = group.title;
    details.append(summary);

    group.fields.forEach((config) => {
      const wrapper = document.createElement("div");
      wrapper.className = "editor-field";

      const id = `field-${config.path.replaceAll(".", "-")}`;
      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = config.label;

      const input = document.createElement(config.type === "textarea" || config.type === "linkList" ? "textarea" : "input");
      const pathValue = getPath(config.path);
      input.id = id;
      input.name = config.path;
      input.dataset.path = config.path;
      input.dataset.type = config.type;
      input.type = "text";
      input.value = config.type === "linkList"
        ? formatLinkList(pathValue)
        : Array.isArray(pathValue)
          ? pathValue.join(", ")
          : pathValue ?? "";

      wrapper.append(label, input);
      details.append(wrapper);
    });

    return details;
  }));
}

function openEditor() {
  if (!editModeEnabled) return;
  buildEditor();
  editor.classList.add("open");
  editor.setAttribute("aria-hidden", "false");
  editLauncher.setAttribute("aria-expanded", "true");
  editor.querySelector("input, textarea")?.focus();
}

function closeEditor() {
  editor.classList.remove("open");
  editor.setAttribute("aria-hidden", "true");
  editLauncher.setAttribute("aria-expanded", "false");
  editLauncher.focus();
}

function saveData() {
  localStorage.setItem(storageKey, JSON.stringify(portfolioData));
  if (editLauncher.animate) {
    editLauncher.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.12)" },
        { transform: "scale(1)" },
      ],
      { duration: 260, easing: "ease-out" }
    );
  }
}

function exportData() {
  const file = new Blob([JSON.stringify(portfolioData, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "portfolio-data.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

editLauncher.addEventListener("click", openEditor);
editorClose.addEventListener("click", closeEditor);

editor.addEventListener("click", (event) => {
  if (event.target === editor) closeEditor();
});

editorPanel.addEventListener("input", (event) => {
  const input = event.target;
  if (!input.dataset.path) return;
  const value = input.dataset.type === "list"
    ? splitList(input.value)
    : input.dataset.type === "linkList"
      ? parseLinkList(input.value)
      : input.value;
  setPath(input.dataset.path, value);
  renderPortfolio();
});

editorPanel.addEventListener("submit", (event) => {
  event.preventDefault();
  saveData();
  closeEditor();
});

editorPanel.addEventListener("click", (event) => {
  const action = event.target.closest("[data-editor-action]")?.dataset.editorAction;
  if (action === "export") exportData();
  if (action === "reset" && window.confirm("ล้างข้อมูลที่บันทึกไว้ และกลับไปใช้ข้อความตั้งต้น?")) {
    localStorage.removeItem(storageKey);
    portfolioData = mergeData(defaultPortfolioData, publishedPortfolioData);
    renderPortfolio();
    buildEditor();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && editor.classList.contains("open")) closeEditor();
  if (editModeEnabled && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
    event.preventDefault();
    editor.classList.contains("open") ? closeEditor() : openEditor();
  }
});

async function initializePortfolio() {
  if (!editModeEnabled) {
    editLauncher.hidden = true;
  }

  const bundledPortfolioData = loadBundledData();
  publishedPortfolioData = mergeData(bundledPortfolioData, await loadPublishedData());
  portfolioData = mergeData(
    mergeData(defaultPortfolioData, publishedPortfolioData),
    editModeEnabled ? loadSavedData() : {}
  );
  renderPortfolio();
}

initializePortfolio();
