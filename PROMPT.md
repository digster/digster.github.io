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
