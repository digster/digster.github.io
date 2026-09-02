# Architecture

## Big picture

`digster.github.io` is the user (root) GitHub Pages site for the `digster`
account. Its single job is to be a **landing page / gallery** linking out to the
account's other live GitHub Pages projects.

It is deliberately a **static, build-less site**: GitHub Pages serves the repo
root directly. There is no framework, bundler, transpiler, or package manager —
opening `index.html` (over a static server) is the whole app. This keeps
deploys instant and the project approachable.

## Components & data flow

```
                data/sites.json  (source of truth)
                        │  fetch() at runtime
                        ▼
index.html ──loads──▶ assets/app.js ──renders──▶ <nav class="tagbar"> chips
     │                     │           └────────────▶ <section id="grid"> cards
     │ links              │ reads/writes
     ▼                     ▼
assets/style.css     localStorage["theme"]  (persisted light/dark)
```

1. **`index.html`** — semantic shell: a `<header class="masthead">` (wordmark +
   avatar, theme toggle, "Project Index" label and search), an empty
   `<nav class="tagbar">` and `<section id="grid">` that JS fills, and a
   footer. It also contains a tiny **inline no-flash theme script** in
   `<head>` that sets `data-theme` on `<html>` before first paint.
2. **`data/sites.json`** — an array of site objects
   (`name`, `title`, `description`, `url`, `repo`, `tags`). This is the only file
   you edit to change what the gallery shows.
3. **`assets/app.js`** — fetches the JSON, derives the tag vocabulary and its
   colours, builds one card DOM node per entry plus the topic filter row, and
   wires up interactivity. It is an IIFE, no globals leak.
4. **`assets/style.css`** — all presentation. Theming is done entirely with CSS
   custom properties; `[data-theme="dark"]` overrides the token values.

## Key conventions (project-specific)

- **One accent everywhere, one colour per tag.** The design is monochrome
  (black ink on white, inverted for dark) with a single red `--accent`. Tag
  chips are the one deliberate exception: **every distinct tag renders in its
  own colour**, so a topic is recognisable before it is read; the topic row
  above the catalog shows that palette in one place. There is still no
  per-*card* colour logic — a card takes its colour only from the chips it
  happens to carry. To restyle, edit the tokens on `:root` /
  `[data-theme="dark"]` in `style.css`.
- **A chip is a filled block, not coloured text.** This is what gives the
  palette its range, so it is a structural decision rather than a stylistic
  one. While the colour was the *ink*, every hue had to stay dark enough to
  read on white, which confines the whole set to a thin, muted shell of the
  gamut — and a third of the wheel (yellow, green, teal) collapses toward grey
  in that shell no matter how the hues are spaced. Colour the block and
  reverse the label out of it, and the only rule left is that one of the
  page's two inks reads on the fill, which opens the deep, mid and pale ends
  of the gamut at once. It also multiplies the *area* carrying the colour,
  which is half of why two chips read as different at a glance.
- **Tag colours are solved, never listed.** `buildTagColors()` in `app.js`
  takes the sorted vocabulary and solves a max-min problem in Oklab: build a
  grid of candidate fills (lightness × hue, each at the most chroma sRGB holds
  there, capped so nothing goes neon), keep the ones where a label reaches AA
  and the block is visibly not the page, then pick n of them so that the
  *smallest* perceptual gap in the set is as large as possible — farthest-point
  seeding followed by swap refinement. Measured in Chromium off painted
  pixels: **closest pair 0.157 light / 0.159 dark in Oklab** (the previous
  hue-wheel scheme managed 0.077 / 0.107). No tag→colour table exists:
  collisions are impossible, and adding a tag to `sites.json` re-solves the
  palette with no code edit. The trade is unchanged — a *new* tag re-colours
  the set, because the vocabulary fixes the colours, not the individual tag.
  Sorting keeps it deterministic: the same tag set always yields the same
  colours.
- **Consecutive topics are ordered apart, too.** `spreadOrder()` re-orders the
  solved set so each colour is as far as possible from the one before it. The
  vocabulary is alphabetical, so without this the row is read in whatever
  order the search happened to produce — and a run of neighbouring hues reads
  as one gradient even when its members measure far apart.
- **Colours are emitted as hex, computed in JS — never as CSS `oklch()`.**
  The palette is *decided* in Oklab (distance there is perceptual distance,
  which is the quantity being maximised) and *shipped* as sRGB hex. That is a
  portability rule: an `oklch()` outside sRGB is clipped per channel by
  Chromium and gamut-mapped per CSS Color 4 by other engines, so one
  declaration paints two different colours depending on the browser. Doing the
  gamut mapping once, in `oklchToHex()`, makes the palette identical
  everywhere and measurable in a canvas. See `LEARNINGS.md`.
- **Both themes are painted onto the chip; CSS picks one.** `paintTag()`
  writes `--tag-light-fill`/`--tag-light-ink` and `--tag-dark-fill`/`--tag-dark-ink`,
  and the `.tag` / `[data-theme="dark"] .tag` rules alias one pair to
  `--tag-fill`/`--tag-ink`. The theme toggle therefore never repaints a chip.
  The dark twin of a fill keeps its hue and its share of the local chroma
  ceiling and only moves in lightness (band 0.40–0.75 → 0.46–0.78), so a topic
  stays recognisably itself across the flip; `darkTwin()` nudges the lightness
  if the mapped value lands in the crossover where neither ink reaches AA.
  `THEMES` in `app.js` carries its own copy of each theme's paper and ink —
  keep it in sync with `--bg`/`--text` in `style.css`.
- **The selected chip rings rather than inverts.** The fills are already
  solid, so there is nothing left to invert into: `[aria-pressed="true"]`
  draws a ring in the page's ink with a gap in the page's paper, which reads
  on every fill. `All` is the exception — no topic, no colour, so it inverts —
  and it is excluded from the ring *by name*, because the ring rule sits later
  in the file and would otherwise win.
- **The topic row is a view of the vocabulary, not a second source of it.**
  `renderTagbar()` builds the row above the catalog from the same sorted
  vocabulary the colours come from, so it doubles as the palette's legend and
  needs no maintenance when `sites.json` grows. Its counts are recomputed in
  `applyFilters()` from the *search text only* — deliberately ignoring the
  active tag, since a row that counted its own selection would zero out every
  other topic the moment you picked one.
- **Titles carry their emoji in the data.** Each `title` in `sites.json` ends
  with one representative emoji; `createCard()` just sets it as `textContent`,
  so there is no icon field, no icon markup and no icon CSS. Distinguishing
  glyphs matter more than decoration — the four "build a 3D thing" entries are
  told apart by 🐟 / 🎱 / 🔺 / ⚙️.
- **The index count is derived.** `render()` sets the "Project Index / NN"
  label from `sites.length`, and entries are numbered `01…NN` in array order —
  both update automatically when `sites.json` changes.
- **Theme is an attribute swap.** Light is the default token set on `:root`;
  dark is `[data-theme="dark"]`. The toggle only flips that attribute and
  persists it. Avoid hard-coding colors outside the token block.
- **No `file://` assumptions.** Because content is loaded with `fetch()`, the
  site must be viewed over HTTP. Local dev = `python3 -m http.server`.
- **`.nojekyll`** is present so GitHub Pages serves files verbatim.
- **No external requests** except the GitHub avatar image in the masthead. Fonts
  are a system grotesque stack; the favicon is an inline SVG data URI. Keep it
  dependency-free.

## Developer workflows

| Task              | How                                                        |
| ----------------- | --------------------------------------------------------- |
| Preview locally   | `python3 -m http.server 8000` then open `localhost:8000`  |
| Add a project     | Append an object to `data/sites.json` (see `README.md`)   |
| Validate the data | `python3 -m json.tool data/sites.json`                    |
| Check tag colours | Paint each chip's computed fill into a 1×1 canvas and read the pixels back (never parse the string); assert distinct fills, the closest Oklab pair, and each label's contrast against its own fill, in both themes |
| Audit live Pages  | Probe each repo's URL (see below) — `200` = live, `404` = no Pages |
| Deploy            | Push to the default branch — GitHub Pages redeploys root  |

### Auditing which repos have live Pages

Don't trust the repo list or the API's `has_pages` flag alone — ask the server
what a visitor would actually get:

```bash
curl -s -o /dev/null -w '%{http_code}' -L "https://digster.github.io/<repo>/"
```

Run it over every repo on the account. This is the canonical check because it
catches all three cases in one pass: **new** Pages sites to add, repos that only
*look* like sites (source-only → `404`), and — importantly — **entries that have
rotted**. A repo rename leaves a listed entry pointing at a dead URL while the
project itself is alive under a new slug, so audit for removals as well as
additions. (`3d-physics` → `3d-physics-course` did exactly this.)

## Why these decisions

- **JSON data file over hard-coded HTML:** lets the gallery grow by editing one
  file; keeps presentation and content separate.
- **JSON over live GitHub API calls:** the API can't reliably tell which repos
  have Pages enabled from the client, and unauthenticated calls are rate-limited.
  A curated file is faster, offline-friendly, and fully under the author's control.
