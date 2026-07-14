/* =========================================================================
   digster.github.io — app logic
   Responsibilities:
     1. Load the showcased sites from data/sites.json (single source of truth).
     2. Render a numbered catalog entry per site.
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
  const indexCount = document.getElementById("index-count");

  /* ---- Filter state --------------------------------------------------- */
  let query = "";          // current search text (lowercased)
  let activeTag = null;    // currently selected tag, or null

  /* ---- Small helpers -------------------------------------------------- */
  // Zero-pad a 1-based position to two digits (1 -> "01", 10 -> "10").
  function pad2(n) { return String(n).padStart(2, "0"); }

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
