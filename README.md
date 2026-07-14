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
assets/app.js        → loads the data, renders entries, search + tag filter, theme toggle
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
| `title`       | Entry heading (emoji welcome).                                    |
| `description` | One sentence shown under the title.                               |
| `url`         | The live site to link to (the **Visit site** action).            |
| `repo`        | The GitHub repository (the **Source** action).                    |
| `tags`        | Topics; each becomes a clickable `#tag` filter chip.             |

Entries are numbered automatically in array order (`01`, `02`, …), so adding an
object is all it takes. Commit, push, and GitHub Pages redeploys.

## Local preview

`fetch()` needs to be served over HTTP (not opened via `file://`), so run any
static server from the repo root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Features

- 🗂️ Clean Swiss/editorial design — numbered catalog, hairline rules, one red accent
- 🌗 Light/dark theme toggle (remembers your choice, respects your OS default)
- 🔎 Live search + click-a-tag filtering
- ♿ Accessible (semantic HTML, keyboard-friendly, respects reduced motion)
- ⚡ Zero dependencies, zero build step, zero external requests

## License

[MIT](LICENSE) © digster
