/* =========================================================================
   digster.github.io — arrange mode (?edit)
   The owner's tool for putting the catalog in a personal order.

   Loaded only when the page is opened with `?edit` (app.js imports it on
   demand), so visitors never download it. Every card gets a grip that can
   be dragged (mouse, touch, pen) or driven with the keyboard. Each move is
   handed to app.js's saveOrder(), which keeps the order in this browser's
   localStorage; app.js applies it on every visit. sites.json is never
   touched.
   ========================================================================= */

let ctx = null;          // { grid, defaultOrder, lockFilters, saveOrder } from app.js
let drag = null;         // live pointer drag, or null
let storageOk = true;    // false once the browser has refused a write
const ui = {};           // toolbar, drop slot and live-region handles

const HINT_ID = "editor-hint";
const DRAG_THRESHOLD = 4;  // px of travel before a press becomes a drag
const EDGE = 56;           // px from the viewport edge where auto-scroll starts
const MAX_SCROLL = 18;     // px per frame, top auto-scroll speed

function entries() { return Array.from(ctx.grid.querySelectorAll(".entry")); }
function currentOrder() { return entries().map(function (el) { return el.dataset.name; }); }
function isDefaultOrder() { return currentOrder().join("\n") === ctx.defaultOrder.join("\n"); }
function titleOf(entry) { return entry.querySelector(".entry__title").textContent; }
function pad2(n) { return String(n).padStart(2, "0"); }
function prefersReducedMotion() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

// Columns in the live grid (3 / 2 / 1 with the breakpoints), so Up/Down
// move a card one *row*, the way the grid looks, not one slot.
function columnCount() {
  return getComputedStyle(ctx.grid).gridTemplateColumns.split(" ").filter(Boolean).length || 1;
}

/* =====================================================================
   Moving entries
   ===================================================================== */

// FLIP: record where everything is drawn, apply the DOM change, then play
// each card from its old spot to its new one. `first` is read while any
// earlier FLIP is still running, so a card in mid-flight changes course
// smoothly instead of jumping. The dragged card is excluded; it follows
// the pointer instead.
function flip(mutate, exclude) {
  const animate = !prefersReducedMotion();
  const list = entries().filter(function (el) { return el !== exclude; });
  const first = animate ? list.map(function (el) { return el.getBoundingClientRect(); }) : null;
  mutate();
  if (!animate) return;
  list.forEach(function (el) { el.getAnimations().forEach(function (a) { a.cancel(); }); });
  const last = list.map(function (el) { return el.getBoundingClientRect(); });
  list.forEach(function (el, i) {
    const dx = first[i].left - last[i].left;
    const dy = first[i].top - last[i].top;
    if (!dx && !dy) return;
    el.animate(
      [{ transform: "translate(" + dx + "px, " + dy + "px)" }, { transform: "none" }],
      { duration: 220, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" }
    );
  });
}

// Put `entry` at 0-based `index`, clamped to the catalog. Real DOM order
// changes (never CSS `order`), so Tab order and screen readers follow what
// is on screen.
//
// The entry itself is never detached: its neighbours are moved around it
// instead. Detaching a node, even to re-insert it a moment later, silently
// releases its pointer capture and drops its focus, which would strand a
// drag mid-gesture and lose the keyboard user's place.
// Returns true when anything moved.
function moveEntryTo(entry, index, exclude) {
  const list = entries();
  const from = list.indexOf(entry);
  const to = Math.max(0, Math.min(list.length - 1, index));
  if (from === to) return false;
  flip(function () {
    if (to < from) {
      // Everything in [to, from) hops over to just after the entry.
      for (let i = from - 1; i >= to; i--) entry.after(list[i]);
    } else {
      // Everything in (from, to] hops over to just before it.
      for (let i = from + 1; i <= to; i++) entry.before(list[i]);
    }
  }, exclude || null);
  renumber();
  return true;
}

// Re-append every entry in the given slug order (reset, cancelled drag).
function applyOrder(names, exclude) {
  const byName = new Map(entries().map(function (el) { return [el.dataset.name, el]; }));
  flip(function () {
    names.forEach(function (name) {
      const el = byName.get(name);
      if (el) ctx.grid.appendChild(el);
    });
  }, exclude || null);
  renumber();
}

// Numbers are positions: 01 is whatever comes first.
function renumber() {
  entries().forEach(function (el, i) {
    el.querySelector(".entry__num").textContent = pad2(i + 1);
  });
}

// Hand the current order to app.js to keep, and reflect the result.
function persist() {
  storageOk = ctx.saveOrder(currentOrder());
  refreshStatus();
}

function announcePosition(entry) {
  const list = entries();
  announce(titleOf(entry) + ", position " + (list.indexOf(entry) + 1) + " of " + list.length);
}

/* ---- Keyboard: arrows on the grip ------------------------------------- */
function onHandleKey(event, entry) {
  if (drag) {
    if (event.key === "Escape") { event.preventDefault(); endDrag(true); }
    return;
  }
  const list = entries();
  const from = list.indexOf(entry);
  const cols = columnCount();
  const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
  let to;
  if (event.key in steps) to = from + steps[event.key];
  else if (event.key === "Home") to = 0;
  else if (event.key === "End") to = list.length - 1;
  else return;
  event.preventDefault();
  if (!moveEntryTo(entry, to)) return;
  persist();
  // Focus never left the grip (the entry is not detached); just keep the
  // card on screen as it travels.
  entry.scrollIntoView({ block: "nearest" });
  announcePosition(entry);
}

/* ---- Pointer drag (mouse, touch, pen) ----------------------------------
   The grabbed card follows the pointer via a transform while its real node
   is moved to wherever the pointer is, so the rest of the grid makes room
   live. Hit-testing uses offsetLeft/offsetTop, which ignore transforms, so
   cards in the middle of a FLIP animation don't make targets jitter. */
function onPointerDown(event, entry, handle) {
  if (event.button !== 0 || drag) return;
  event.preventDefault();   // no text selection, no native image drag
  entry.getAnimations().forEach(function (a) { a.cancel(); });
  handle.setPointerCapture(event.pointerId);
  const rect = entry.getBoundingClientRect();
  drag = {
    entry: entry,
    handle: handle,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    x: event.clientX,
    y: event.clientY,
    grabX: event.clientX - rect.left,
    grabY: event.clientY - rect.top,
    startOrder: currentOrder(),
    lastSwap: null,
    armTop: false,      // auto-scroll zones, armed once the pointer has
    armBottom: false,   // been outside them (see autoScroll)
    active: false,
    raf: 0,
  };
  // Listen on window rather than the grip: captured events still bubble up
  // to it, and if capture is ever lost the drag still ends cleanly.
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
}

function onPointerMove(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag.x = event.clientX;
  drag.y = event.clientY;
  if (!drag.active) {
    if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < DRAG_THRESHOLD) return;
    drag.active = true;
    drag.entry.classList.add("is-dragging");
    document.body.classList.add("is-dragging");
    ui.slot.hidden = false;
    drag.raf = requestAnimationFrame(autoScroll);
  }
  followPointer();
}

function onPointerUp(event) {
  if (drag && event.pointerId === drag.pointerId) endDrag(false);
}
function onPointerCancel(event) {
  if (drag && event.pointerId === drag.pointerId) endDrag(true);
}

function followPointer() {
  reorderUnderPointer();
  const box = ctx.grid.getBoundingClientRect();
  const el = drag.entry;
  const dx = drag.x - drag.grabX - (box.left + el.offsetLeft);
  const dy = drag.y - drag.grabY - (box.top + el.offsetTop);
  el.style.transform = "translate(" + dx + "px, " + dy + "px)";
  placeSlot();
}

function reorderUnderPointer() {
  const box = ctx.grid.getBoundingClientRect();
  const px = drag.x - box.left;
  const py = drag.y - box.top;
  const list = entries();
  const target = list.find(function (el) {
    return el !== drag.entry &&
      px >= el.offsetLeft && px < el.offsetLeft + el.offsetWidth &&
      py >= el.offsetTop && py < el.offsetTop + el.offsetHeight;
  });
  if (!target) return;
  // Rows can change height when a card moves between them, which can slide
  // the card just swapped with back under a still pointer. Don't swap with
  // the same card again until the pointer has actually travelled.
  const last = drag.lastSwap;
  if (last && last.target === target && Math.hypot(drag.x - last.x, drag.y - last.y) < 12) return;
  if (moveEntryTo(drag.entry, list.indexOf(target), drag.entry)) {
    drag.lastSwap = { target: target, x: drag.x, y: drag.y };
  }
}

// The dashed outline marking where the card will land.
function placeSlot() {
  const el = drag.entry;
  const s = ui.slot.style;
  s.left = el.offsetLeft + "px";
  s.top = el.offsetTop + "px";
  s.width = el.offsetWidth + "px";
  s.height = el.offsetHeight + "px";
}

// Scroll while the pointer is held near the top edge or just above the
// toolbar, so a card can travel the whole catalog (on a phone the grid is
// one long column). behavior:"instant" matters: the page sets
// `scroll-behavior: smooth`, which would queue a smooth scroll every frame.
//
// Each zone only arms once the pointer has been outside it: a grip that
// happens to sit low on the screen starts its drag *inside* the bottom
// zone, and without this the page would run away downwards the moment the
// card was picked up, even while it was being dragged up.
function autoScroll() {
  if (!drag || !drag.active) return;
  const top = EDGE;
  const bottom = ui.bar.getBoundingClientRect().top - EDGE;
  if (drag.y >= top) drag.armTop = true;
  if (drag.y <= bottom) drag.armBottom = true;
  let dy = 0;
  if (drag.armTop && drag.y < top) dy = -(top - drag.y);
  else if (drag.armBottom && drag.y > bottom) dy = drag.y - bottom;
  if (dy) {
    window.scrollBy({ top: Math.max(-MAX_SCROLL, Math.min(MAX_SCROLL, dy * 0.35)), behavior: "instant" });
    followPointer();
  }
  drag.raf = requestAnimationFrame(autoScroll);
}

function endDrag(cancel) {
  const d = drag;
  if (!d) return;
  drag = null;
  cancelAnimationFrame(d.raf);
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerCancel);
  if (d.handle.hasPointerCapture(d.pointerId)) d.handle.releasePointerCapture(d.pointerId);
  if (!d.active) return;   // a press on the grip, not a drag

  // Settle the card from wherever it is drawn into its slot.
  const drawn = d.entry.getBoundingClientRect();
  if (cancel) applyOrder(d.startOrder, d.entry);
  d.entry.style.transform = "";
  const slot = d.entry.getBoundingClientRect();
  document.body.classList.remove("is-dragging");
  ui.slot.hidden = true;
  const done = function () { d.entry.classList.remove("is-dragging"); };
  if (prefersReducedMotion()) {
    done();
  } else {
    d.entry.animate(
      [{ transform: "translate(" + (drawn.left - slot.left) + "px, " + (drawn.top - slot.top) + "px)" }, { transform: "none" }],
      { duration: 200, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" }
    ).finished.then(done, done);
  }
  if (!cancel) persist();
  announcePosition(d.entry);
}

/* =====================================================================
   Toolbar
   ===================================================================== */
function buildToolbar() {
  const bar = document.createElement("div");
  bar.className = "editor-bar";
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", "Arrange the catalog");

  const inner = document.createElement("div");
  inner.className = "editor-bar__inner";

  const label = document.createElement("p");
  label.className = "editor-bar__label u-label";
  label.textContent = "Arranging";

  const status = document.createElement("p");
  status.className = "editor-bar__status";

  const hint = document.createElement("p");
  hint.id = HINT_ID;
  hint.className = "u-sr-only";
  hint.textContent = "Drag to reorder, or use the arrow keys. Home and End jump to the first and last position.";

  // One polite live region for positions after a move and for reset.
  const announcer = document.createElement("p");
  announcer.className = "u-sr-only";
  announcer.setAttribute("aria-live", "polite");

  const actions = document.createElement("div");
  actions.className = "editor-bar__actions";

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "editor-btn";
  reset.textContent = "Reset to default order";
  reset.addEventListener("click", function () {
    applyOrder(ctx.defaultOrder);
    persist();
    announce("Back to the default order");
  });

  const done = document.createElement("a");
  done.className = "editor-btn";
  done.href = window.location.pathname;   // the same page without ?edit
  done.textContent = "Done";

  actions.append(reset, done);
  inner.append(label, status, actions, hint, announcer);
  bar.appendChild(inner);
  document.body.appendChild(bar);

  // The page keeps room for the toolbar at the bottom (style.css reads this
  // variable). Measured rather than guessed: the bar wraps onto more lines
  // on a phone, and a fixed allowance would hide the footer.
  new ResizeObserver(function () {
    document.documentElement.style.setProperty("--editor-bar-h", bar.offsetHeight + "px");
  }).observe(bar);

  ui.bar = bar;
  ui.status = status;
  ui.reset = reset;
  ui.announcer = announcer;
}

function refreshStatus() {
  const custom = !isDefaultOrder();
  ui.reset.hidden = !custom;
  ui.status.dataset.tone = storageOk ? "" : "error";
  if (!storageOk) {
    ui.status.textContent = "Couldn't save. This browser is blocking site storage, so the order will reset on reload.";
  } else if (custom) {
    ui.status.textContent = "Your order is saved in this browser.";
  } else {
    ui.status.textContent = "Default order. Drag a grip or use the arrow keys to rearrange.";
  }
}

function announce(text) {
  // Clear first so the same sentence twice in a row is still spoken.
  ui.announcer.textContent = "";
  window.setTimeout(function () { ui.announcer.textContent = text; }, 30);
}

/* ---- Per-entry grip ---------------------------------------------------- */
function gripIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 10 16");
  svg.setAttribute("width", "10");
  svg.setAttribute("height", "16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  [[3, 3], [7, 3], [3, 8], [7, 8], [3, 13], [7, 13]].forEach(function (p) {
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", p[0]);
    dot.setAttribute("cy", p[1]);
    dot.setAttribute("r", "1.4");
    dot.setAttribute("fill", "currentColor");
    svg.appendChild(dot);
  });
  return svg;
}

function addGrip(entry) {
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "entry__handle";
  handle.setAttribute("aria-label", "Move " + titleOf(entry));
  handle.setAttribute("aria-describedby", HINT_ID);
  handle.appendChild(gripIcon());
  handle.addEventListener("keydown", function (event) { onHandleKey(event, entry); });
  handle.addEventListener("pointerdown", function (event) { onPointerDown(event, entry, handle); });
  entry.querySelector(".entry__head").appendChild(handle);
}

/* =====================================================================
   Entry point, called by app.js once the catalog has rendered.
     context.grid          the #grid section holding the .entry cards
     context.defaultOrder  slugs in sites.json order (for Reset)
     context.lockFilters   switches search and topic filters off, so every
                           project is visible while arranging
     context.saveOrder     keeps an order (array of slugs) in localStorage;
                           returns false if the browser refuses
   ===================================================================== */
export function startEditor(context) {
  ctx = context;
  ctx.lockFilters();
  document.body.classList.add("is-editing");

  const slot = document.createElement("div");
  slot.className = "drop-slot";
  slot.hidden = true;
  slot.setAttribute("aria-hidden", "true");
  ctx.grid.appendChild(slot);
  ui.slot = slot;

  buildToolbar();
  entries().forEach(addGrip);
  refreshStatus();

  // Escape cancels a drag from anywhere, not only from the focused grip.
  document.addEventListener("keydown", function (event) {
    if (drag && event.key === "Escape") { event.preventDefault(); endDrag(true); }
  });
}
