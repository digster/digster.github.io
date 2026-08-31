/* =========================================================================
   digster.github.io — app logic
   Responsibilities:
     1. Load the showcased sites from data/sites.json (single source of truth).
     2. Render a numbered catalog entry per site.
     3. Live text search + click-to-filter tag chips, one colour per tag.
     4. Persisted light/dark theme toggle.
   Vanilla JS, no dependencies, no build step.
   ========================================================================= */
(function () {
  "use strict";

  /* ---- Element handles ------------------------------------------------ */
  const grid = document.getElementById("grid");
  const searchInput = document.getElementById("search");
  const emptyState = document.getElementById("empty");
  const activeFilter = document.getElementById("active-filter");
  const activeFilterTag = document.getElementById("active-filter-tag");
  const clearFilterBtn = document.getElementById("clear-filter");
  const themeToggle = document.getElementById("theme-toggle");
  const indexCount = document.getElementById("index-count");

  /* ---- Filter state --------------------------------------------------- */
  let query = "";          // current search text (lowercased)
  let activeTag = null;    // currently selected tag, or null

  /* ---- Tag colours ---------------------------------------------------- */
  // Rotating the wheel off 0deg keeps the first tag clear of the editorial
  // red used by the accent, so a chip is never mistaken for a link.
  const HUE_OFFSET = 15;
  let tagColors = new Map(); // tag -> { hue, alt }, rebuilt on every load

  /* ---- Small helpers -------------------------------------------------- */
  // Zero-pad a 1-based position to two digits (1 -> "01", 10 -> "10").
  function pad2(n) { return String(n).padStart(2, "0"); }

  /* =====================================================================
     Tag colours — every distinct tag gets a colour of its own.

     The whole tag vocabulary is collected from the data first, then two
     things are derived over that sorted set:

       1. A hue, spread evenly around the 360deg wheel. Collisions are
          impossible (one tag per slot) and the gap between any two tags is
          the widest the vocabulary allows — 13 tags today sit 25.7deg apart.
       2. An alternating lightness band. Every other tag is flagged `alt`,
          which style.css renders at --tag-l-alt instead of --tag-l.

     Hue alone used to be the whole scheme, and it was not enough: sRGB
     cannot hold a saturated yellow, green or teal at a lightness dark enough
     to read on white, so those hues get squeezed toward grey and
     neighbouring topics converge — the closest pair measured 0.043 in Oklab,
     under two just-noticeable differences. Alternating the lightness
     separates neighbours in a dimension the gamut cannot squeeze and takes
     the worst pair to 0.077 light / 0.107 dark. It is free in contrast terms
     because the alternate band moves away from the page background.

     The wheel is divided into an *even* number of slots — the vocabulary
     size rounded up — and the spare slot, if any, is simply left empty. That
     is what lets the alternation close: with 13 tags in 13 slots the first
     and last tag are neighbours in the same band, which was the closest pair
     in the whole palette. Rounding up to 14 puts a gap there instead, so no
     two same-band tags are ever one slot apart.

     Everything stays derived rather than tabulated, which is the point:
     adding a tag to sites.json re-spaces the wheel by itself, with no colour
     table to keep in sync with the data. Sorting the vocabulary keeps that
     deterministic — a given set of tags always produces the same colours.
     ===================================================================== */
  function buildTagColors(sites) {
    const vocabulary = [];
    sites.forEach(function (site) {
      (site.tags || []).forEach(function (tag) {
        if (vocabulary.indexOf(tag) === -1) vocabulary.push(tag);
      });
    });
    vocabulary.sort();

    const colors = new Map();
    // Round the slot count up to even so the light/dark alternation wraps.
    const slots = vocabulary.length + (vocabulary.length % 2);
    const step = 360 / slots;
    vocabulary.forEach(function (tag, i) {
      colors.set(tag, {
        // One decimal is plenty of precision and keeps the inline style short.
        hue: Math.round((HUE_OFFSET + i * step) * 10) % 3600 / 10,
        alt: i % 2 === 1,
      });
    });
    return colors;
  }

  // Paint one chip. Only the hue and the band are per-tag: the lightness and
  // chroma values themselves come from the theme tokens in style.css, so
  // chips stay a family and stay legible when the theme flips. Unknown tags
  // fall back to the CSS default.
  function paintTag(el, tag) {
    const color = tagColors.get(tag);
    if (color) el.style.setProperty("--tag-hue", String(color.hue));
    else el.style.removeProperty("--tag-hue");
    el.classList.toggle("tag--alt", Boolean(color && color.alt));
  }

  /* =====================================================================
     Rendering — one catalog entry per site (number, title, description,
     tag chips and Visit / Source actions).
     ===================================================================== */
  function createCard(site, position) {
    const entry = document.createElement("article");
    entry.className = "entry";

    // Pre-compute a lowercase haystack for fast searching.
    const haystack = [site.title, site.name, site.description, (site.tags || []).join(" ")]
      .join(" ")
      .toLowerCase();
    entry.dataset.search = haystack;
    entry.dataset.tags = (site.tags || []).join(",");

    // Head: index number + title
    const head = document.createElement("div");
    head.className = "entry__head";

    const num = document.createElement("span");
    num.className = "entry__num";
    num.textContent = pad2(position);

    const title = document.createElement("h2");
    title.className = "entry__title";
    title.textContent = site.title;

    head.append(num, title);

    const desc = document.createElement("p");
    desc.className = "entry__desc";
    desc.textContent = site.description;

    const tags = document.createElement("ul");
    tags.className = "entry__tags";
    (site.tags || []).forEach(function (tag) {
      const li = document.createElement("li");
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag";
      chip.dataset.tag = tag;
      chip.textContent = "#" + tag;
      paintTag(chip, tag);
      chip.setAttribute("aria-label", "Filter by " + tag);
      chip.addEventListener("click", function () { toggleTag(tag); });
      li.appendChild(chip);
      tags.appendChild(li);
    });

    const actions = document.createElement("div");
    actions.className = "entry__actions";

    const visit = document.createElement("a");
    visit.className = "entry__visit";
    visit.href = site.url;
    visit.target = "_blank";
    visit.rel = "noopener";
    visit.innerHTML = "Visit site <span aria-hidden=\"true\">→</span>";
    visit.setAttribute("aria-label", "Visit " + site.title);

    const source = document.createElement("a");
    source.className = "entry__source";
    source.href = site.repo;
    source.target = "_blank";
    source.rel = "noopener";
    source.innerHTML = "Source <span aria-hidden=\"true\">↗</span>";
    source.setAttribute("aria-label", site.title + " source on GitHub");

    actions.append(visit, source);
    entry.append(head, desc, tags, actions);
    return entry;
  }

  function render(sites) {
    // Derive the colours before any chip is built — createCard() reads them.
    tagColors = buildTagColors(sites);

    const fragment = document.createDocumentFragment();
    sites.forEach(function (site, i) { fragment.appendChild(createCard(site, i + 1)); });
    grid.innerHTML = "";
    grid.appendChild(fragment);
    grid.setAttribute("aria-busy", "false");

    // Reflect the catalog size in the "Project Index / NN" label.
    if (indexCount) indexCount.textContent = "/ " + pad2(sites.length);
  }

  /* =====================================================================
     Filtering (search text AND selected tag)
     ===================================================================== */
  function applyFilters() {
    const entries = grid.querySelectorAll(".entry");
    let visible = 0;

    entries.forEach(function (entry) {
      const matchesText = !query || entry.dataset.search.includes(query);
      const entryTags = entry.dataset.tags ? entry.dataset.tags.split(",") : [];
      const matchesTag = !activeTag || entryTags.indexOf(activeTag) !== -1;
      const show = matchesText && matchesTag;
      entry.hidden = !show;
      if (show) visible++;
    });

    emptyState.hidden = visible !== 0;

    // Reflect the active tag banner.
    if (activeTag) {
      activeFilterTag.textContent = "#" + activeTag;
      paintTag(activeFilterTag, activeTag);   // banner echoes the chip's colour
      activeFilter.hidden = false;
    } else {
      activeFilter.hidden = true;
    }
  }

  function toggleTag(tag) {
    activeTag = activeTag === tag ? null : tag;
    applyFilters();
  }

  /* =====================================================================
     Theme toggle (persisted). The no-flash boot script in <head> already
     set the initial theme; here we just keep the button in sync and let
     the user switch.
     ===================================================================== */
  function syncToggle(theme) {
    const isDark = theme === "dark";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.querySelector(".theme-toggle__icon").textContent = isDark ? "☀️" : "🌙";
  }

  function initTheme() {
    syncToggle(document.documentElement.getAttribute("data-theme") || "light");
    themeToggle.addEventListener("click", function () {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* storage blocked — ignore */ }
      syncToggle(next);
    });
  }

  /* =====================================================================
     Wire-up
     ===================================================================== */
  function initControls() {
    searchInput.addEventListener("input", function () {
      query = searchInput.value.trim().toLowerCase();
      applyFilters();
    });
    clearFilterBtn.addEventListener("click", function () {
      activeTag = null;
      applyFilters();
    });
  }

  function showLoadError() {
    grid.setAttribute("aria-busy", "false");
    grid.innerHTML =
      '<p class="empty"><span class="empty__emoji" aria-hidden="true">😵‍💫</span>' +
      "Couldn't load the project list. Please refresh.</p>";
  }

  function init() {
    initTheme();
    initControls();

    fetch("data/sites.json", { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (sites) {
        render(sites);
        applyFilters();
      })
      .catch(function (err) {
        console.error("Failed to load sites.json:", err);
        showLoadError();
      });
  }

  init();
})();
