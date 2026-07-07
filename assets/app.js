/* =========================================================================
   digster.github.io — app logic
   Responsibilities:
     1. Load the showcased sites from data/sites.json (single source of truth).
     2. Render a colorful card per site, with a topic-derived accent hue.
     3. Live text search + click-to-filter tag chips.
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

  /* ---- Filter state --------------------------------------------------- */
  let query = "";          // current search text (lowercased)
  let activeTag = null;    // currently selected tag, or null

  /* =====================================================================
     Colour: map a topic tag to a pleasant, intentional hue. Unknown tags
     fall back to a hash so any future tag still gets a stable colour. A
     small per-name nudge keeps sites that share a first tag visually
     distinct, so the grid always reads as a varied mosaic.
     ===================================================================== */
  const TAG_HUES = {
    learning: 265, interactive: 320, gamedev: 22, "c++": 210, tutorial: 175,
    math: 145, graphics: 250, art: 340, research: 190, tools: 35,
    reference: 285, reading: 160, archive: 200,
  };

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0; // keep it a 32-bit int
    }
    return Math.abs(h);
  }

  function hueFor(site) {
    const firstTag = (site.tags && site.tags[0]) || site.name;
    const base = TAG_HUES[firstTag] !== undefined
      ? TAG_HUES[firstTag]
      : hashString(firstTag) % 360;
    const nudge = (hashString(site.name) % 30) - 15; // -15..+14
    return (base + nudge + 360) % 360;
  }

  /* =====================================================================
     Rendering
     ===================================================================== */
  function createCard(site) {
    const card = document.createElement("article");
    card.className = "card";
    card.style.setProperty("--h", String(hueFor(site)));

    // Pre-compute a lowercase haystack for fast searching.
    const haystack = [site.title, site.name, site.description, (site.tags || []).join(" ")]
      .join(" ")
      .toLowerCase();
    card.dataset.search = haystack;
    card.dataset.tags = (site.tags || []).join(",");

    const body = document.createElement("div");

    const title = document.createElement("h2");
    title.className = "card__title";
    title.textContent = site.title;

    const desc = document.createElement("p");
    desc.className = "card__desc";
    desc.textContent = site.description;

    const tags = document.createElement("ul");
    tags.className = "card__tags";
    (site.tags || []).forEach(function (tag) {
      const li = document.createElement("li");
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag";
      chip.dataset.tag = tag;
      chip.textContent = "#" + tag;
      chip.setAttribute("aria-label", "Filter by " + tag);
      chip.addEventListener("click", function () { toggleTag(tag); });
      li.appendChild(chip);
      tags.appendChild(li);
    });

    body.append(title, desc, tags);

    const actions = document.createElement("div");
    actions.className = "card__actions";

    const visit = document.createElement("a");
    visit.className = "btn btn--primary";
    visit.href = site.url;
    visit.target = "_blank";
    visit.rel = "noopener";
    visit.innerHTML = "Visit site <span aria-hidden=\"true\">→</span>";
    visit.setAttribute("aria-label", "Visit " + site.title);

    const source = document.createElement("a");
    source.className = "btn btn--ghost";
    source.href = site.repo;
    source.target = "_blank";
    source.rel = "noopener";
    source.textContent = "Source";
    source.setAttribute("aria-label", site.title + " source on GitHub");

    actions.append(visit, source);
    card.append(body, actions);
    return card;
  }

  function render(sites) {
    const fragment = document.createDocumentFragment();
    sites.forEach(function (site) { fragment.appendChild(createCard(site)); });
    grid.innerHTML = "";
    grid.appendChild(fragment);
    grid.setAttribute("aria-busy", "false");
  }

  /* =====================================================================
     Filtering (search text AND selected tag)
     ===================================================================== */
  function applyFilters() {
    const cards = grid.querySelectorAll(".card");
    let visible = 0;

    cards.forEach(function (card) {
      const matchesText = !query || card.dataset.search.includes(query);
      const cardTags = card.dataset.tags ? card.dataset.tags.split(",") : [];
      const matchesTag = !activeTag || cardTags.indexOf(activeTag) !== -1;
      const show = matchesText && matchesTag;
      card.hidden = !show;
      if (show) visible++;
    });

    emptyState.hidden = visible !== 0;

    // Reflect the active tag banner.
    if (activeTag) {
      activeFilterTag.textContent = "#" + activeTag;
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
