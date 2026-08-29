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
index.html ──loads──▶ assets/app.js ──renders──▶ <section id="grid"> cards
     │                     │
     │ links              │ reads/writes
     ▼                     ▼
assets/style.css     localStorage["theme"]  (persisted light/dark)
```

1. **`index.html`** — semantic shell: a `<header class="masthead">` (wordmark +
   avatar, theme toggle, "Project Index" label and search), an empty
   `<section id="grid">` that JS fills, and a footer. It also contains a tiny
   **inline no-flash theme script** in `<head>` that sets `data-theme` on
   `<html>` before first paint.
2. **`data/sites.json`** — an array of site objects
   (`name`, `title`, `description`, `url`, `repo`, `tags`). This is the only file
   you edit to change what the gallery shows.
3. **`assets/app.js`** — fetches the JSON, builds one card DOM node per entry,
   and wires up interactivity. It is an IIFE, no globals leak.
4. **`assets/style.css`** — all presentation. Theming is done entirely with CSS
   custom properties; `[data-theme="dark"]` overrides the token values.

## Key conventions (project-specific)

- **One accent everywhere, one hue per tag.** The design is monochrome (black
  ink on white, inverted for dark) with a single red `--accent`. Tag chips are
  the one deliberate exception: **every distinct tag renders in its own
  colour**, so a topic is recognisable before it is read. There is still no
  per-*card* hue logic — a card takes its colour only from the chips it
  happens to carry. To restyle, edit the tokens on `:root` /
  `[data-theme="dark"]` in `style.css`.
- **Tag colours are derived, never listed.** `buildTagHues()` in `app.js`
  collects the distinct tags across `sites.json`, sorts them, and spreads hues
  evenly around the 360° wheel over that set — 13 tags today land 27.7° apart.
  Two things follow, and both are the reason it is done this way rather than
  with a tag→colour table: **collisions are impossible** (n tags, n slots), and
  the palette re-spaces itself when the vocabulary changes, so adding a tag to
  the data needs no code edit. The trade is that colours shift when a *new*
  tag appears — the vocabulary, not the individual tag, is what fixes a hue.
  Sorting keeps it deterministic: the same tag set always yields the same
  colours.
- **Only the hue varies; lightness and chroma are tokens.** `app.js` writes
  `--tag-hue` onto each chip and nothing else; `--tag-l` / `--tag-c` in
  `style.css` supply the rest, per theme. Colours are authored in **OKLCH**
  precisely so that this split works — hue can rotate the whole way round at
  fixed lightness without any chip reading heavier or louder than its
  neighbours, and a single pair of values holds the contrast line for every
  hue at once (measured in-browser: worst case 5.2:1 light, 8.5:1 dark, both
  past WCAG AA). Keep new chip styling inside `oklch(var(--tag-lch) …)` so the
  ink, border and background wash can't drift apart.
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
| Check tag colours | Load the page and confirm each chip's `--tag-hue` differs; contrast is measured against `--bg` in both themes |
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
