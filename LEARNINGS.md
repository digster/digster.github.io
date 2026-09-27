# Learnings

Things this codebase has cost us once already. Read before touching the tag
palette or writing a browser test against it.

## Colour

- **Distinctness is bounded by the treatment, not by the spacing.** Three
  passes at the tag palette were spent spreading hues further apart while the
  chip stayed *coloured text on white*. That treatment forces every colour to
  clear AA as ink on paper, which confines the whole set to a thin, muted
  shell of the gamut, and inside that shell yellow, green and teal collapse
  toward grey however the hues are spaced. Colouring the block instead and
  reversing the label out of it doubled the closest-pair distance (0.077 →
  0.157 in Oklab) *and* multiplied the area carrying the colour. When a
  palette will not separate, question the constraint before the algorithm.
- **Even spacing is not maximum separation.** Evenly spaced hues are only
  optimal if the space is a circle. The usable space here is a 3-D volume with
  ragged edges (gamut on one side, a contrast floor on the other), and picking
  points by maximising the smallest pairwise distance inside it beats spacing
  a wheel by roughly 2×. Farthest-point seeding plus swap refinement converges
  in a few passes and takes ~16 ms for 13 colours — but only after the search
  loops compare *squared* distances; `Math.hypot` in the inner loop cost 70 ms
  on its own.
- **Alphabetical order will still look like a gradient.** Even a
  well-separated set reads as one ramp if consecutive chips happen to be
  hue-neighbours. Order the palette so each colour is far from the one before
  it, not just far from all of them on average.

## OKLCH colours

- **Chromium clips out-of-gamut OKLCH; it does not gamut-map it.** Ask for
  `oklch(0.42 0.19 42.7)` — well outside sRGB — and CSS Color 4 says to reduce
  chroma while holding lightness and hue, which would give `#822f00`. Chromium
  clips per channel instead and paints `#980000`: a different hue, a different
  lightness, a different colour. Engines that follow the spec paint the first
  one. **So an over-ambitious chroma is not a palette, it is a different
  palette per browser.** Keep `--tag-c` at or just under what sRGB holds for
  the tightest hue in the wheel (≈0.086 at L 0.50, ≈0.122 at L 0.76 — the
  binding hue is around 209° in the dark half of the range and 264° in the
  light half). A designed palette optimised on the assumption of spec-correct
  gamut mapping measured *worse* in the browser than the one it replaced.
- **The sRGB gamut is the reason hue alone cannot separate many tags.** There
  is no room for a saturated yellow, green or teal at a lightness dark enough
  to read on white, so those hues collapse toward grey however far apart their
  hue angles are. Separation there has to come from lightness, which the gamut
  cannot squeeze.
- **Emitting hex sidesteps the clipping trap entirely.** Deciding the palette
  in Oklab in JS and shipping `#rrggbb` (via a gamut-checked
  `oklchToHex()`) means no engine ever has to improvise: the browser is handed
  a colour it can paint exactly. The rule below still applies to any *new*
  `oklch()` written by hand in CSS.
- **An odd vocabulary cannot alternate around a ring.** Any two-colouring of an
  odd cycle has one monochromatic edge, and with 13 tags in 13 hue slots that
  edge — the alphabetically first and last tag — was the closest pair in the
  whole palette and capped every attempt to improve it. Rounding the slot count
  up to even and leaving the spare slot empty puts a gap at the seam instead.

## Testing colour in a browser

- **Never parse a computed colour as a string.** Chromium returns
  `getComputedStyle(el).color` for an OKLCH value *in OKLCH*
  (`"oklch(0.48 0.11 66.4)"`). An rgb regex reads `0.48, 0.11, 66.4` as an RGB
  triple and produces confident nonsense. Paint the value into a 1×1 canvas and
  read `getImageData` — that also applies the browser's real gamut mapping,
  which is the whole point.
- **Composite semi-transparent values over the page background.** The chip wash
  is `oklch(… / 0.12)`. Painting it onto a black canvas base and then measuring
  contrast against it invents figures (a 5.0:1 chip read as 2.7:1). Fill the
  canvas with `getComputedStyle(document.body).backgroundColor` first.
- **A fill and its label must be measured against each other, not against the
  page.** With solid chips the label's backdrop is the chip, so the contrast
  that matters is label-vs-fill; the page only decides whether the *block*
  is visible at all (a separate, much lower, floor).
- **Wait for transitions before reading any colour.** `body` transitions
  `background` over 0.3s and `.tag` transitions `color`/`background-color` over
  0.15s, so a reading taken straight after a click or a theme toggle is a
  mid-animation interpolation — Chromium hands those back as `oklab(...)` with
  a fractional alpha, which is the tell. ~300ms after a chip click, ~600ms
  after the theme toggle.

## CSS

- **A later rule of equal specificity wins, so exclude by name.**
  `.tag[aria-pressed="true"]` and `.tag--all[aria-pressed="true"]` are both
  (0,2,0); the generic one sits further down the file and quietly took the
  "All" chip's inversion away. `:not(.tag--all)` on the generic rule is the
  fix — the same shape as the `:hover` trap below.
- **`:hover` can out-specify a state class.** `.tag:hover` (0,2,0 with its
  `:not()`s) beat `.tag[aria-pressed="true"]` (0,2,0, declared earlier), so
  hovering a selected chip washed its fill back out. State rules that must
  survive hover need the hover rule to exclude them —
  `.tag:hover:not([aria-pressed="true"])` — rather than relying on order.

## Arrange mode (`?edit`)

- **Detaching a node releases its pointer capture — and its focus.** The
  first drag implementation re-inserted the dragged card itself
  (`insertBefore(entry, …)`) whenever it crossed another card. That silently
  ended `setPointerCapture`, so after the first swap the grip stopped getting
  `pointermove`/`pointerup`: auto-scroll froze and the drop never landed.
  Move the *neighbours* around the dragged node instead (`moveEntryTo()`); it
  keeps capture and keyboard focus for free. Listening on `window` rather
  than the grip is the belt to those braces.
- **Edge auto-scroll zones must arm, not just exist.** A grip visible in the
  56px band above the toolbar starts its drag *inside* the bottom zone, and a
  naive "pointer is in the zone → scroll" ran the page away downwards while
  the card was being dragged up. Each zone now only activates once the
  pointer has been outside it.
- **`scroll-behavior: smooth` applies to script scrolls too.** `html` has it,
  so a per-frame `window.scrollBy(0, dy)` queues a smooth scroll every frame
  and the auto-scroll crawls. Pass `behavior: "instant"`.
- **Offsets for hit-testing, rects for animation.** Cards mid-FLIP carry a
  transform, so `getBoundingClientRect()` jitters as a drop target;
  `offsetLeft/Top/Width/Height` ignore transforms and give the settled
  layout. (`.grid` gets `position: relative` in arrange mode so offsets are
  relative to it.)
- **All of digster.github.io is one origin.** The root site and every
  `/<repo>/` project share `localStorage` (the `theme` key already leaks
  across them), so keys here are prefixed (`digster:catalog-order`).

## Browser testing with the Playwright MCP (local)

- `browser_run_code_unsafe` runs in a sandbox without `Buffer`, `btoa`,
  `TextEncoder`, `require` or `import()`. Do that work inside the page with
  `page.evaluate`, and read files over HTTP with `page.request.get()`.
- `boundingBox()` happily returns coordinates below the fold, **or under the
  fixed toolbar**. A CDP `Input.dispatchTouchEvent` there hits the wrong
  element and the page just scrolls natively — which looks exactly like an
  auto-scroll bug. Check `document.elementFromPoint(x, y)` is the grip first.
- Screenshots may only be written under the repo; they land in
  `.playwright-mcp/` (git-ignored) — delete it after testing.

## Local dev in this sandbox

- `curl` to `127.0.0.1` needs `--noproxy '*'`, or `HTTPS_PROXY` swallows it and
  returns `000`, which looks exactly like a dead server.
- Playwright is installed globally: import it as
  `import pw from '/opt/node22/lib/node_modules/playwright/index.js'`.
- Scope tag clicks to `#grid .tag[data-tag="…"]` or `#tagbar-list
  .tag[data-tag="…"]` — `#active-filter-tag` also carries `class="tag"`, and
  the same tag now appears in both the topic row and on cards.
- Count visible cards as `#grid .entry:not([hidden])`.
- The masthead avatar (`avatars.githubusercontent.com`) is blocked here, so one
  `ERR_CONNECTION_RESET` console error is expected and is not a regression.
