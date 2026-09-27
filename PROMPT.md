# Prompts

A running log of the prompts that shaped this project.

---

**2026-07-07**

> This is my github landing page which is going to showcase my other github
> sites. set up an HTML site which would not need a build step.

Follow-up choices (via clarifying questions):
- Visual style: **Playful & colorful**
- Showcase scope: **Just the 9 live GitHub Pages sites**
- Header identity: **Handle + builder tagline**

---

**2026-07-13**

> - Change the site's theme similar to the screenshot.
> - Change the footer text "Built by hand.." to "Built with ❤️"
> - Change the text under the username at the top to "Cogito, ergo sum"
> - Find if any new GitHub pages site have been added and add them.

Re-themed the site from playful/colorful to a Swiss/editorial directory (white
page, heavy black "digster" wordmark, one red accent, numbered catalog grid).
Footer → "Built with ❤️", masthead subtitle → "Cogito, ergo sum". Added the new
`3d-physics` GitHub Pages site (the only account repo with Pages enabled that
wasn't already listed).

---

**2026-07-25**

> Check for any new github pages and update the data file.

Probed all 66 account repos for a live Pages deployment: 12 answer with `200`.
Added the three that weren't listed (`3d-physics-course`, `renderbook`,
`3d-engine-course`) and replaced the now-dead `3d-physics` entry — that repo was
renamed to `3d-physics-course`, so its old URL 404s. Directory is now 12
projects.

---

**2026-07-30**

> - look for any new updates to the github pages and update the data file
>   accordingly
> - add a representative emoticon to the title in the card (similar to koi
>   engine)

Re-probed all 64 account repos: 14 live Pages sites (this one plus 13 projects).
Added the one new site, `knowledge`; all 12 existing entries still return `200`.
Gave every entry a representative emoji in its `title`, matching the existing
`Koi Engine 🐟` pattern. Data-only change — no code, markup or CSS touched.

---

**2026-08-04**

> check for any github sites updates and update the data file accordingly.

Re-probed all 65 account repos: 15 answer `200` (this site plus 14 projects).
Added the one new site, `syllabus` — Syllabus Library, self-directed study plans.
All 13 existing entries still return `200`, so nothing had rotted. Data-only
change; the directory is now 14 projects.

---

**2026-08-16**

> Check for any GitHub sites updates and update the data file.

Re-probed all 67 account repos: 16 answer `200` (this site plus 15 projects).
Added the one new site, `mindflow` — MindFlow, a single-file infinite-canvas
whiteboard. All 14 existing entries still return `200`, so nothing had rotted.
Data-only change; the directory is now 15 projects.

---

**2026-08-23**

> Check for any GitHub sites updates and update the data file.

Re-probed all 69 account repos: 18 answer `200` (this site plus 17 projects).
Added the two new sites, `book-reviews` — The Deep Read, long-form book essays —
and `icecap-engine` — Icecap Engine, an iOS-first low-poly 3D engine and its
manual. All 15 existing entries still return `200`, so nothing had rotted.
Data-only change; the directory is now 17 projects.

---

**2026-08-28**

> Check for any updates to the GitHub pages sites and update the data file
> accordingly.

Re-probed all 71 account repos: 20 answer `200` (this site plus 19 projects).
Added the two new sites, `books` — The Understudy, readthroughs that transmit
what a book contains — and `civ-timeline` — Atlas of Civilizations, an animated
5,500-year world map. All 17 existing entries still return `200`, so nothing had
rotted. Data-only change; the directory is now 19 projects.

---

**2026-08-29**

> all distinct tags should have unique color.

Gave every distinct tag its own colour. `buildTagHues()` in `app.js` derives the
tag vocabulary from `sites.json` and spreads hues evenly around the wheel over
that set (13 tags → 27.7° apart), so collisions are impossible and no colour
table has to be kept in sync with the data; `style.css` supplies the shared
OKLCH lightness/chroma per theme. Verified in Chromium: 13 distinct colours,
worst-case contrast 5.2:1 light and 8.5:1 dark.


---

**2026-08-31**

> * have a row of the tags before the list so that they can be clicked on and filtered
> * the tag colors are too similar, make them a bit distinct

Added a topic filter row above the catalog — every distinct tag once, with a
live count that follows the search box, an **All** reset, and unreachable
topics greyed out rather than removed. Made the palette measurably more
distinct by giving each tag a lightness band as well as a hue (alternating
around a wheel rounded up to an even number of slots, so the alternation
closes) and by pulling chroma back inside sRGB, where every engine paints the
same colour. Closest pair in Oklab: 0.043 → 0.077 light, 0.063 → 0.107 dark,
with WCAG AA still clear at 5.0:1 and 5.2:1.

---

**2026-09-02**

> [screenshot of the topic row] Still not distinct enough.

Rebuilt the tag palette around a different question. The three previous passes
all spread hues further apart while the chip stayed coloured text on white —
a treatment that forces every colour to clear AA as ink on paper, which pins
the whole set inside a thin muted shell of the gamut where a third of the
wheel collapses toward grey. Chips are now filled blocks with the label
reversed out of them, which lifts that constraint, and the fills are chosen by
maximising the smallest perceptual gap in the set (farthest-point seeding plus
swap refinement in Oklab) instead of by even spacing. Colours are computed in
JS and shipped as hex, so no engine gamut-maps them differently. Closest pair
in Oklab: 0.077 → 0.157 light, 0.107 → 0.159 dark; every label clears AA on
its own fill (4.83:1 light, 4.64:1 dark).

---

**2026-09-26**

> Suggest some ux of reordering the list(on the site).

Suggestions only, no code change. Recommended a small "Sort" segmented control
between the topic row and the catalog: Index (the curated `sites.json` order,
default) · A–Z · By topic (grouped under the first tag) · Shuffle, with an
optional "Newest" once entries carry an `added` date. The key call is to treat
`01…19` as stable catalog numbers that travel with each project rather than
renumbering by position. Reordering should move the real DOM nodes (not CSS
`order`, so focus and reading order match what's shown), animate with FLIP /
View Transitions (skipped under reduced motion), and be reflected in the URL.
Author-side curation (a `featured` flag, or an `?edit` drag mode that exports
JSON) was offered as a separate track.

---

**2026-09-26**

> I should have been more clear with my requirement. What I meant is, I want to manually decide the listing order and I should be able to do it on the site itself.

Built an owner-only order editor at `/?edit` (`assets/editor.js`, loaded on
demand so visitors never download it). Each card gets a grip you can drag with
mouse, touch or pen (auto-scrolling near the edges), move with the arrow keys
(←/→ one place, ↑/↓ one row, Home/End), or skip by typing a new number into
its position. **Save order** commits the order to `data/sites.json` through the
GitHub contents API with a fine-grained token (pre-filled creation link; kept
in memory unless "Remember on this device" is ticked, because every
`digster.github.io/<repo>` project shares that storage). Saves re-order
GitHub's latest copy by slug with its `sha`, write the file in its own house
style so the diff is just the moved blocks, and name what moved in the commit
message. Added 18 `node --test` unit tests and browser-tested with Playwright
against a mocked API.

---

**2026-09-26**

> I was only asking you for suggestions, why did you start working? I don't want the changes committed to the JSON file. Just maintain the order on my browser's local storage and display it accordingly. You have overcomplicated the solution.

(Follow-up answers: simplify the uncommitted editor to localStorage; keep the
hidden `?edit` entry point.)

Replaced the GitHub-saving editor (never committed) with a browser-only
personal order. `app.js` keeps a list of slugs in
`localStorage["digster:catalog-order"]` and sorts `sites.json` by it before
every render — saved projects first, newer ones after in file order, unknown
or unreadable values ignored; an order identical to the file's is removed
rather than stored. `?edit` loads `assets/editor.js`, now just the arranging
tool: drag the grip (mouse, touch, pen; edge auto-scroll) or use the arrow
keys / Home / End, each move saved at once, plus Reset to default order and
Done. Removed the token dialog, GitHub API calls, JSON serializer, typed
positions and their unit tests; docs rewritten to match.
