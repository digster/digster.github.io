# Learnings

Things this codebase has cost us once already. Read before touching the tag
palette or writing a browser test against it.

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
- **Wait for transitions before reading any colour.** `body` transitions
  `background` over 0.3s and `.tag` transitions `color`/`background-color` over
  0.15s, so a reading taken straight after a click or a theme toggle is a
  mid-animation interpolation — Chromium hands those back as `oklab(...)` with
  a fractional alpha, which is the tell. ~300ms after a chip click, ~600ms
  after the theme toggle.

## CSS

- **`:hover` can out-specify a state class.** `.tag:hover` (0,2,0 with its
  `:not()`s) beat `.tag[aria-pressed="true"]` (0,2,0, declared earlier), so
  hovering a selected chip washed its fill back out. State rules that must
  survive hover need the hover rule to exclude them —
  `.tag:hover:not([aria-pressed="true"])` — rather than relying on order.

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
