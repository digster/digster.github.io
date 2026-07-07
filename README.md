# digster.github.io

A colorful little hub that showcases my live GitHub Pages projects — games,
graphics experiments, learning tools and more. It's a **plain static site with
no build step**: just HTML, CSS and a sprinkle of vanilla JavaScript, served
straight from the repo root by GitHub Pages.

🔗 **Live:** https://digster.github.io/

## What's inside

```
index.html          → page structure (hero + search + card grid)
assets/style.css     → all styling & theming (light/dark via CSS custom properties)
assets/app.js        → loads the data, renders cards, search + tag filter, theme toggle
data/sites.json      → the list of showcased sites — THE file you edit to add/remove
.nojekyll            → tells GitHub Pages to serve files as-is (no Jekyll processing)
```

The page reads `data/sites.json` at runtime and renders one card per entry, so
the content is fully data-driven — no code changes needed to update the gallery.

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
| `name`        | Short slug (used for search + as a color seed).                   |
| `title`       | Card heading (emoji welcome).                                     |
| `description` | One sentence shown on the card.                                   |
| `url`         | The live site to link to (the **Visit site** button).            |
| `repo`        | The GitHub repository (the **Source** button).                    |
| `tags`        | Topics; the **first tag** decides the card's accent color.       |

Each card's color is derived from its first tag, so the grid stays a varied,
consistent mosaic automatically. Commit, push, and GitHub Pages redeploys.

## Local preview

`fetch()` needs to be served over HTTP (not opened via `file://`), so run any
static server from the repo root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Features

- 🎨 Playful, colorful design with a per-topic accent on every card
- 🌗 Light/dark theme toggle (remembers your choice, respects your OS default)
- 🔎 Live search + click-a-tag filtering
- ♿ Accessible (semantic HTML, keyboard-friendly, respects reduced motion)
- ⚡ Zero dependencies, zero build step, zero external requests

## License

[MIT](LICENSE) © digster
