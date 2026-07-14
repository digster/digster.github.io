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

- **One accent, not per-topic color.** The design is monochrome (black ink on
  white, inverted for dark) with a single red `--accent`. There is no per-card
  hue logic; every accent comes from the token block. To restyle, edit the
  tokens on `:root` / `[data-theme="dark"]` in `style.css`.
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
| Deploy            | Push to the default branch — GitHub Pages redeploys root  |

## Why these decisions

- **JSON data file over hard-coded HTML:** lets the gallery grow by editing one
  file; keeps presentation and content separate.
- **JSON over live GitHub API calls:** the API can't reliably tell which repos
  have Pages enabled from the client, and unauthenticated calls are rate-limited.
  A curated file is faster, offline-friendly, and fully under the author's control.
