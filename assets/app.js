/* =========================================================================
   digster.github.io — app logic
   Responsibilities:
     1. Load the showcased sites from data/sites.json (single source of truth).
     2. Render a numbered catalog entry per site.
     3. Live text search + click-to-filter tag chips (on each card and in the
        topic row above the catalog), every distinct tag in its own colour.
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
  const tagbarList = document.getElementById("tagbar-list");
  const themeToggle = document.getElementById("theme-toggle");
  const indexCount = document.getElementById("index-count");

  /* ---- Filter state --------------------------------------------------- */
  let query = "";          // current search text (lowercased)
  let activeTag = null;    // currently selected tag, or null

  /* ---- Tag colours ---------------------------------------------------- */
  let vocabulary = [];       // sorted distinct tags, rebuilt on every load
  let tagColors = new Map(); // tag -> { light: {fill,ink}, dark: {fill,ink} }

  /* ---- Small helpers -------------------------------------------------- */
  // Zero-pad a 1-based position to two digits (1 -> "01", 10 -> "10").
  function pad2(n) { return String(n).padStart(2, "0"); }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  /* =====================================================================
     Colour engine — Oklab <-> sRGB (Björn Ottosson's transform).

     Everything about the palette is decided in Oklab because distance there
     is roughly *perceptual* distance: the straight-line gap between two
     Oklab points is how different the two colours look. That gap is the
     quantity buildTagColors() maximises, so it has to be the space we work in.

     Colours leave this section as plain hex, never as a CSS `oklch()`
     value. That is deliberate. An oklch() outside sRGB is clipped per
     channel by Chromium and gamut-mapped per spec by other engines, so one
     declaration paints two different colours depending on the browser (see
     LEARNINGS.md). Mapping into sRGB here, once, makes the palette the same
     everywhere and makes it measurable.
     ===================================================================== */
  function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function linearToSrgb(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }

  // Oklch (lightness 0..1, chroma, hue in degrees) -> linear-light sRGB.
  // Values outside 0..1 mean the colour is outside the sRGB gamut.
  function oklchToLinearRgb(L, chroma, hue) {
    const rad = (hue * Math.PI) / 180;
    const a = chroma * Math.cos(rad);
    const b = chroma * Math.sin(rad);
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
  }

  function inGamut(L, chroma, hue) {
    const rgb = oklchToLinearRgb(L, chroma, hue);
    for (let i = 0; i < 3; i++) if (rgb[i] < -0.0001 || rgb[i] > 1.0001) return false;
    return true;
  }

  // The most chroma sRGB can actually hold at this lightness and hue.
  // Binary search: 18 halvings of a 0.4-wide range is precision to ~1e-6.
  function maxChroma(L, hue) {
    let lo = 0, hi = 0.4;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(L, mid, hue)) lo = mid; else hi = mid;
    }
    return lo;
  }

  function oklchToHex(L, chroma, hue) {
    const rgb = oklchToLinearRgb(L, chroma, hue);
    let hex = "#";
    for (let i = 0; i < 3; i++) {
      const v = Math.round(linearToSrgb(clamp01(rgb[i])) * 255);
      hex += v.toString(16).padStart(2, "0");
    }
    return hex;
  }

  function hexToLinearRgb(hex) {
    return [1, 3, 5].map(function (i) {
      return srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255);
    });
  }

  function hexToOklab(hex) {
    const rgb = hexToLinearRgb(hex);
    const l = Math.cbrt(0.4122214708 * rgb[0] + 0.5363325363 * rgb[1] + 0.0514459929 * rgb[2]);
    const m = Math.cbrt(0.2119034982 * rgb[0] + 0.6806995451 * rgb[1] + 0.1073969566 * rgb[2]);
    const s = Math.cbrt(0.0883024619 * rgb[0] + 0.2817188376 * rgb[1] + 0.6299787005 * rgb[2]);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ];
  }

  // WCAG 2.x contrast ratio between two opaque hex colours.
  function contrast(hexA, hexB) {
    const lum = function (hex) {
      const rgb = hexToLinearRgb(hex);
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    };
    const a = lum(hexA), b = lum(hexB);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  // Perceptual distance between two Oklab colours, squared. The searches
  // below only ever *compare* distances, and skipping the square root there
  // is worth several times the speed in a loop that runs a couple of million
  // times on page load.
  function deltaESq(a, b) {
    const dl = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2];
    return dl * dl + da * da + db * db;
  }
  // The real distance, for the one place that reports a number.
  function deltaE(a, b) { return Math.sqrt(deltaESq(a, b)); }

  /* =====================================================================
     The palette — solved, not tabulated.

     A chip is a filled block of colour with the label reversed out of it.
     That treatment is what makes the palette possible: while the colour was
     the *ink*, every hue had to stay dark enough to read on white, which
     confines the whole set to a thin, muted shell of the gamut where a
     third of the wheel collapses toward grey. Colour the block instead and
     the only rule left is that one of the page's two inks reads on it —
     which opens the deep, the mid and the pale ends of the gamut at once.

     Within that space the colours are chosen by maximising the *smallest*
     perceptual gap in the set (a max-min / farthest-point problem):

       1. Build the candidate colours: a grid of lightness x hue, each at the
          most chroma sRGB holds there (capped, so nothing goes neon),
          keeping only those where a label reaches AA and the block is
          visibly not the page.
       2. Seed with one candidate, then repeatedly add whichever candidate is
          furthest from everything picked so far.
       3. Refine: move each colour, in turn, to wherever it buys the largest
          minimum gap. Stop when a full pass changes nothing.

     Then order the result so that *consecutive* topics are far apart too —
     the vocabulary is alphabetical, and a palette laid out in hue order
     reads as one gradient however far apart its members measure.

     Two properties matter as much as the numbers:

       - Nothing is hard-coded per tag. The palette is derived from the
          vocabulary, so a new tag in sites.json needs no CSS edit; it just
          re-solves for n+1 colours. (The trade, unchanged from before: the
          vocabulary fixes the colours, not the individual tag, so adding a
          topic re-colours the set.)
       - It is deterministic. Same tags in, same colours out, because the
          candidate grid and the search are both fixed.
     ===================================================================== */

  // The two page frames a chip has to live on. `lMin`/`lMax` bound the
  // lightness of the fills on that background: deep-but-not-black on paper,
  // lifted on the dark page so a block never sinks into it.
  const THEMES = {
    light: { paper: "#ffffff", ink: "#111111", lMin: 0.40, lMax: 0.75 },
    dark:  { paper: "#0d0d0d", ink: "#f4f4f4", lMin: 0.46, lMax: 0.78 },
  };
  const CHROMA_CAP = 0.15;        // taste, not gamut: past this it turns neon
  const CHROMA_FLOOR = 0.05;      // below this a fill just reads as grey
  const CHROMA_STEPS = [1, 0.72]; // full strength and a muted tier of each hue
  const MIN_LABEL_CONTRAST = 4.6; // WCAG AA for the label on its own fill
  const MIN_PAPER_CONTRAST = 1.3; // the block must not melt into the page
  const L_STEPS = 10;             // candidate grid: lightness rows...
  const H_STEPS = 72;             // ...and hue columns (5deg apart)
  const REFINE_PASSES = 8;

  // Whichever of the page's two inks reads better on this fill.
  function labelInk(fill, frame) {
    const onInk = contrast(fill, frame.ink);
    const onPaper = contrast(fill, frame.paper);
    return onInk >= onPaper
      ? { hex: frame.ink, ratio: onInk }
      : { hex: frame.paper, ratio: onPaper };
  }

  // Every fill the light theme is allowed to use.
  function buildCandidates() {
    const frame = THEMES.light;
    const out = [];
    for (let i = 0; i < L_STEPS; i++) {
      const L = frame.lMin + ((frame.lMax - frame.lMin) * i) / (L_STEPS - 1);
      for (let j = 0; j < H_STEPS; j++) {
        const hue = (360 * j) / H_STEPS;
        const cap = Math.min(CHROMA_CAP, maxChroma(L, hue));
        for (let k = 0; k < CHROMA_STEPS.length; k++) {
          const chroma = cap * CHROMA_STEPS[k];
          if (chroma < CHROMA_FLOOR) continue;
          const hex = oklchToHex(L, chroma, hue);
          if (labelInk(hex, frame).ratio < MIN_LABEL_CONTRAST) continue;
          if (contrast(hex, frame.paper) < MIN_PAPER_CONTRAST) continue;
          out.push({ L: L, hue: hue, frac: CHROMA_STEPS[k], hex: hex, lab: hexToOklab(hex) });
        }
      }
    }
    return out;
  }

  // Squared distance from one candidate to the nearest colour already
  // picked, ignoring the slot at `skip` (the one being reconsidered).
  function nearest(candidate, picked, skip) {
    let best = Infinity;
    for (let i = 0; i < picked.length; i++) {
      if (i === skip) continue;
      const d = deltaESq(candidate.lab, picked[i].lab);
      if (d < best) best = d;
    }
    return best;
  }

  // Farthest-point seeding, then swap-refinement. Maximises the smallest
  // pairwise gap, which is the number that decides whether the *closest*
  // pair of topics is telling itself apart.
  function maximin(candidates, n) {
    const picked = [candidates[0]];
    while (picked.length < n) {
      let best = candidates[0], bestD = -1;
      for (let i = 0; i < candidates.length; i++) {
        const d = nearest(candidates[i], picked, -1);
        if (d > bestD) { bestD = d; best = candidates[i]; }
      }
      picked.push(best);
    }
    for (let pass = 0; pass < REFINE_PASSES; pass++) {
      let moved = false;
      for (let i = 0; i < picked.length; i++) {
        let best = picked[i], bestD = nearest(picked[i], picked, i);
        for (let j = 0; j < candidates.length; j++) {
          const d = nearest(candidates[j], picked, i);
          if (d > bestD + 1e-6) { bestD = d; best = candidates[j]; }
        }
        if (best !== picked[i]) { picked[i] = best; moved = true; }
      }
      if (!moved) break;
    }
    return picked;
  }

  // Re-order so each colour is as far as possible from the one before it:
  // the row of chips is read left to right, and neighbours that share a hue
  // family look like a gradient even when they measure far apart.
  function spreadOrder(colors) {
    const rest = colors.slice(1);
    const ordered = [colors[0]];
    while (rest.length) {
      const last = ordered[ordered.length - 1];
      let bestIdx = 0, bestD = -1;
      for (let i = 0; i < rest.length; i++) {
        const d = deltaESq(rest[i].lab, last.lab);
        if (d > bestD) { bestD = d; bestIdx = i; }
      }
      ordered.push(rest.splice(bestIdx, 1)[0]);
    }
    return ordered;
  }

  // The dark-theme twin of a fill: same hue, same share of the local chroma
  // ceiling, lightness mapped into the dark band. Keeping hue and chroma
  // fixed is what makes a topic recognisably the same topic in both themes,
  // and mapping lightness affinely preserves the gaps the search bought.
  function darkTwin(stop) {
    const src = THEMES.light, dst = THEMES.dark;
    const t = (stop.L - src.lMin) / (src.lMax - src.lMin);
    let L = dst.lMin + (dst.lMax - dst.lMin) * t;
    // If the mapped lightness lands where neither ink reaches AA, walk it
    // toward whichever ink is already ahead until one does.
    for (let step = 0; step < 14; step++) {
      const chroma = Math.min(CHROMA_CAP, maxChroma(L, stop.hue)) * stop.frac;
      const hex = oklchToHex(L, chroma, stop.hue);
      const ink = labelInk(hex, dst);
      if (ink.ratio >= MIN_LABEL_CONTRAST) return { fill: hex, ink: ink.hex };
      // Contrast with the page's light ink grows as the fill darkens, and
      // with its dark ink as the fill lightens: step away from whichever is
      // already ahead. (Stepping the other way walks into the crossover,
      // where neither ink reads.)
      L = clamp01(L + (ink.hex === dst.ink ? -0.02 : 0.02));
    }
    const chroma = Math.min(CHROMA_CAP, maxChroma(L, stop.hue)) * stop.frac;
    const hex = oklchToHex(L, chroma, stop.hue);
    return { fill: hex, ink: labelInk(hex, dst).hex };
  }

  function buildTagColors(vocab) {
    const colors = new Map();
    if (!vocab.length) return colors;
    const stops = spreadOrder(maximin(buildCandidates(), vocab.length));
    vocab.forEach(function (tag, i) {
      const stop = stops[i];
      colors.set(tag, {
        light: { fill: stop.hex, ink: labelInk(stop.hex, THEMES.light).hex },
        dark: darkTwin(stop),
      });
    });
    return colors;
  }

  function buildVocabulary(sites) {
    const tags = [];
    sites.forEach(function (site) {
      (site.tags || []).forEach(function (tag) {
        if (tags.indexOf(tag) === -1) tags.push(tag);
      });
    });
    return tags.sort();
  }

  // Paint one chip. Both themes' values are written onto the element and
  // style.css picks between them, so flipping the theme never needs a
  // re-render. An unknown tag keeps the CSS fallback (no fill at all).
  const TAG_VARS = ["--tag-light-fill", "--tag-light-ink", "--tag-dark-fill", "--tag-dark-ink"];
  function paintTag(el, tag) {
    const color = tagColors.get(tag);
    if (!color) {
      TAG_VARS.forEach(function (name) { el.style.removeProperty(name); });
      return;
    }
    el.style.setProperty("--tag-light-fill", color.light.fill);
    el.style.setProperty("--tag-light-ink", color.light.ink);
    el.style.setProperty("--tag-dark-fill", color.dark.fill);
    el.style.setProperty("--tag-dark-ink", color.dark.ink);
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
    // Derive the vocabulary and its colours before any chip is built — both
    // createCard() and renderTagbar() read them.
    vocabulary = buildVocabulary(sites);
    tagColors = buildTagColors(vocabulary);

    const fragment = document.createDocumentFragment();
    sites.forEach(function (site, i) { fragment.appendChild(createCard(site, i + 1)); });
    grid.innerHTML = "";
    grid.appendChild(fragment);
    grid.setAttribute("aria-busy", "false");

    renderTagbar();

    // Reflect the catalog size in the "Project Index / NN" label.
    if (indexCount) indexCount.textContent = "/ " + pad2(sites.length);
  }

  /* =====================================================================
     Topic filter row — the whole tag vocabulary, above the catalog.

     The per-card chips only ever show the topics of the cards you can
     already see, so the set of filters was previously undiscoverable: you
     had to spot a chip before you could use it. This row lists every topic
     once, in the same sorted order the colours are derived from, which
     doubles as a legend for the palette.

     Counts follow the search box rather than the catalog total, so the row
     always answers "what would this filter actually give me right now" — and
     a topic the current search cannot reach is disabled rather than removed,
     so the row never reflows under the cursor.
     ===================================================================== */
  let tagbarChips = [];   // [{ tag, button, count }], tag === null for "All"

  function createFilterChip(tag) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = tag === null ? "tag tag--all" : "tag";
    if (tag !== null) {
      button.dataset.tag = tag;
      paintTag(button, tag);
    }

    button.appendChild(document.createTextNode(tag === null ? "All" : "#" + tag));
    const count = document.createElement("span");
    count.className = "tag__count";
    button.appendChild(count);

    button.addEventListener("click", function () {
      if (tag === null) clearTag();
      else toggleTag(tag);
    });

    li.appendChild(button);
    tagbarList.appendChild(li);
    return { tag: tag, button: button, count: count };
  }

  function renderTagbar() {
    if (!tagbarList) return;
    tagbarList.innerHTML = "";
    tagbarChips = [createFilterChip(null)].concat(
      vocabulary.map(function (tag) { return createFilterChip(tag); })
    );
  }

  // Refresh every chip against the counts of the current search.
  function syncTagbar(counts, total) {
    tagbarChips.forEach(function (chip) {
      const isAll = chip.tag === null;
      const n = isAll ? total : (counts.get(chip.tag) || 0);
      const pressed = isAll ? activeTag === null : activeTag === chip.tag;

      chip.count.textContent = String(n);
      chip.button.setAttribute("aria-pressed", String(pressed));
      // Never disable the chip that is currently on, or the filter would
      // become impossible to switch off from the row.
      chip.button.disabled = n === 0 && !pressed;
      chip.button.setAttribute(
        "aria-label",
        (isAll ? "Show all projects" : "Filter by " + chip.tag) +
          " (" + n + (n === 1 ? " project)" : " projects)")
      );
    });
  }

  /* =====================================================================
     Filtering (search text AND selected tag)
     ===================================================================== */
  function applyFilters() {
    const entries = grid.querySelectorAll(".entry");
    const textCounts = new Map();   // tag -> entries the search text alone keeps
    let textMatches = 0;
    let visible = 0;

    entries.forEach(function (entry) {
      const matchesText = !query || entry.dataset.search.includes(query);
      const entryTags = entry.dataset.tags ? entry.dataset.tags.split(",") : [];

      // Tally the topics of everything the *text* matches. Deliberately
      // ignores the active tag: a filter row that counted its own selection
      // would zero out every other topic the moment you picked one.
      if (matchesText) {
        textMatches++;
        entryTags.forEach(function (tag) {
          textCounts.set(tag, (textCounts.get(tag) || 0) + 1);
        });
      }

      const matchesTag = !activeTag || entryTags.indexOf(activeTag) !== -1;
      const show = matchesText && matchesTag;
      entry.hidden = !show;
      if (show) visible++;
    });

    emptyState.hidden = visible !== 0;
    syncTagbar(textCounts, textMatches);

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

  function clearTag() {
    activeTag = null;
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
    clearFilterBtn.addEventListener("click", clearTag);
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
