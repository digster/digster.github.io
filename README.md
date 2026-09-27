# digster.github.io

A directory of small web experiments — my live GitHub Pages projects: games,
graphics experiments, learning tools and more, laid out as a numbered editorial
catalog. It's a **plain static site with no build step**: just HTML, CSS and a
sprinkle of vanilla JavaScript, served straight from the repo root by GitHub
Pages.

🔗 **Live:** https://digster.github.io/

## What's inside

```
index.html          → page structure (masthead + search + numbered entry grid)
assets/style.css     → all styling & theming (light/dark via CSS custom properties)
assets/app.js        → loads the data, renders entries + topic row, search + filtering, theme toggle
assets/editor.js     → arrange mode, loaded only at ?edit (your own order, kept in this browser)
data/sites.json      → the list of showcased sites — THE file you edit to add/remove
.nojekyll            → tells GitHub Pages to serve files as-is (no Jekyll processing)
```

The page reads `data/sites.json` at runtime and renders one numbered entry per
object, so the content is fully data-driven — no code changes needed to update
the directory. The "Project Index / NN" count is derived from the array length.

## Adding or editing a site

Open [`data/sites.json`](data/sites.json) and add an object to the array:

```json
{
  "name": "my-project",
  "title": "My Project ✨",
  "description": "A one-line description of what it does.",
  "url": "https://digster.github.io/my-project/",
  "repo": "https://github.com/digster/my-project",
  "tags": ["tools", "interactive"]
}
```

| Field         | Purpose                                                            |
| ------------- | ----------------------------------------------------------------- |
| `name`        | Short slug (used for search).                                     |
| `title`       | Entry heading, ending in one representative emoji (see below).    |
| `description` | One sentence shown under the title.                               |
| `url`         | The live site to link to (the **Visit site** action).            |
| `repo`        | The GitHub repository (the **Source** action).                    |
| `tags`        | Topics; each becomes a clickable `#tag` chip in its own colour, and joins the topic row above the catalog. |

Entries are numbered automatically in array order (`01`, `02`, …), so adding an
object is all it takes. Commit, push, and GitHub Pages redeploys. That array
order is what everyone sees; you can also keep a personal order in your own
browser (below).

**Tag colours are automatic.** Every distinct tag gets a colour of its own,
solved from whatever tag vocabulary `sites.json` contains. Each chip is a
filled block with its label reversed out of it, and `app.js` picks the fills
by maximising the *smallest* perceptual gap between them in Oklab, inside the
colours where a label still clears WCAG AA — so the two most similar topics
are as far apart as the palette allows (0.157 in Oklab today, against 0.077
for the hue-wheel scheme this replaced). Two tags can never collide and adding
a new one needs no CSS. Reuse an existing tag where it fits; a brand-new tag
re-solves the palette and shifts the other colours.

**Filtering.** The topic row above the catalog lists every tag once, with a
count, so the filters are visible without hunting for a chip on some card.
Click a topic to filter, click it again (or **All**) to clear — the chips on
each entry do the same thing. Counts follow the search box, and a topic the
current search can't reach is greyed out rather than removed, so the row never
reflows under the cursor.

**Title emoji:** every `title` ends with a single space and one emoji that hints
at what the project *is* (`Renderbook 🔺`, `3D Physics From Scratch 🎱`) — pick a
subject-specific glyph rather than a generic 🚀, and don't reuse one already in
the list. It lives in the data, not the markup, so no code change is needed.

## Your own listing order (this browser only)

Open **https://digster.github.io/?edit** to arrange the catalog for yourself:

- **Drag** a card by the grip (⋮⋮) beside its title — mouse, touch or pen.
  Hold it near the top of the screen, or just above the toolbar, to scroll.
- **Keyboard:** focus a grip, then ←/→ move one place, ↑/↓ one row, Home/End
  to the first/last position. Escape cancels a drag in progress.
- Every move is saved straight away in this browser's `localStorage`
  (`digster:catalog-order`), and the page uses that order on every visit —
  no `?edit` needed after that. **Reset to default order** clears it;
  **Done** leaves arrange mode. Search and topic filters are off while
  arranging.

It only affects the browser you arranged it in: other people and your other
devices see the `sites.json` order, and clearing site data (or a private
window) brings the default back. A project you add to `sites.json` later shows
up at the end of your order; one you remove simply drops out. Nothing is ever
written to `sites.json`, and visitors never download the editor — it is only
loaded with `?edit`.

To find out which repos actually have a live Pages site (and to catch entries
whose repo was renamed, leaving a dead link behind), probe the URLs rather than
trusting the repo list — `curl -s -o /dev/null -w '%{http_code}' -L
"https://digster.github.io/<repo>/"`; `200` means live, `404` means no Pages.
See [`ARCHITECTURE.md`](ARCHITECTURE.md#auditing-which-repos-have-live-pages).

## Local preview

`fetch()` needs to be served over HTTP (not opened via `file://`), so run any
static server from the repo root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/  (or /?edit to arrange)
```

## Features

- 🗂️ Clean Swiss/editorial design — numbered catalog, hairline rules, one red accent
- 🌗 Light/dark theme toggle (remembers your choice, respects your OS default)
- 🔎 Live search + a clickable topic row with live counts, every tag in its own colour
- ✍️ Arrange the catalog your own way at `?edit` — drag or keyboard, kept in your browser
- ♿ Accessible (semantic HTML, keyboard-friendly, respects reduced motion, and
  every tag label clears WCAG AA contrast on its own fill in both themes —
  measured off painted pixels, not assumed)
- ⚡ Zero dependencies, zero build step, zero external requests

## License

[MIT](LICENSE) © digster
