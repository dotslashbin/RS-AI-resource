/*
 * offering-photo-square — the screens. THIS FILE IS THE WORK; everything else is scaffolding.
 *
 * Question under review (rescoped 2026-10-30): what do Explore's offering result cards look like
 * with a SQUARE cover instead of today's 118px band? Only `OfferingResultCard` changes; the
 * offering page and every other photo surface stay as they are.
 * Plan: `.plans/2026-10-30-booker-offering-photo-square.md`.
 *
 * The card copied here is `booker/components/explore/OfferingResultCard/` (cover with division
 * pill and optional "No dates yet" chip → name + price → vendor · city → category → division
 * footer). The grid is Explore's `.serviceGrid` (`ExplorePage.module.css:246`):
 * `repeat(auto-fill, minmax(230px, 1fr))` inside a 980px page. VendorPage uses the same grid.
 *
 * ⚠️ FIXTURES ARE INVENTED. The vendors, offerings and prices are made up, and the "photos"
 * are hand-drawn SVGs in `./photos/`, each with its subject near an edge so a crop is visible.
 *
 * ⚠️ No inline `style=""`: the CSP blocks it. Variants are `data-` attributes in preview.css.
 */
"use strict";

(function () {
  const { esc, each } = window.PV;

  /* ── Fixtures ───────────────────────────────────────────────────────────────────────── */

  const PHOTOS = {
    landscape: { src: "./photos/court-landscape.svg", ratio: "3:2" },
    portrait:  { src: "./photos/groom-portrait.svg",  ratio: "4:5" },
    square:    { src: "./photos/tray-square.svg",     ratio: "1:1" },
  };

  /* Six cards: every shape of upload, the no-photo placeholder, and the "No dates yet" chip.
     `mono` stands in for the division's mask-painted mark (see README → Limits). */
  const CARDS = [
    { name: "Half-court, hourly",     price: "₱850", unit: "/ hour",  vendor: "Northside Courts",   city: "Davao City",  category: "Basketball",     div: "ezzy-court", label: "Court", mono: "EC", photo: "landscape" },
    { name: "Full groom, medium dog", price: "₱620", unit: "/ visit", vendor: "Paws & Claws",       city: "Tagum City",  category: "Grooming",       div: "ezzy-pets",  label: "Pets",  mono: "EP", photo: "portrait"  },
    { name: "Lechon tray, 25 pax",    price: "₱4,800", unit: "",      vendor: "Kusina Marikit",     city: "Davao City",  category: "Catering",       div: "ezzy-food",  label: "Food",  mono: "EF", photo: "square"    },
    { name: "Driving lesson, 90 min", price: "₱1,100", unit: "",      vendor: "Mindanao Driving",   city: "Davao City",  category: "Lessons",        div: "ezzy-drive", label: "Drive", mono: "ED", photo: null        },
    { name: "Van rental, whole day",  price: "₱3,200", unit: "/ day", vendor: "Southbound Rentals", city: "Panabo City", category: "Vehicle rental", div: "ezzy-ride",  label: "Ride",  mono: "ER", photo: "landscape", unbookable: true },
    { name: "Document notarisation",  price: "₱500", unit: "",        vendor: "Corner Legal Co",    city: "Davao City",  category: "Legal",          div: "none",       label: "Other", mono: "—",  photo: null        },
  ];

  /* ── The card ───────────────────────────────────────────────────────────────────────── */

  /** `fit` is cover (crop) or contain (whole photo), for the crop screen only. */
  const cover = (c, fit) => c.photo
    ? `<img class="rc-photo" data-fit="${esc(fit)}" src="${esc(PHOTOS[c.photo].src)}" alt="">`
    : `<span class="rc-ph"><span class="rc-ph-ezzy">E</span><span class="rc-ph-rule"></span><span class="rc-ph-mark">${esc(c.mono)}</span></span>`;

  const card = (c, { fit = "cover" } = {}) => `
    <button type="button" class="rc" data-division="${esc(c.div)}">
      <span class="rc-cover">
        ${cover(c, fit)}
        <span class="rc-div">${esc(c.label)}</span>
        ${c.unbookable ? '<span class="rc-unbookable">No dates yet</span>' : ""}
      </span>
      <span class="rc-text">
        <span class="rc-body">
          <span class="rc-top">
            <span class="rc-name">${esc(c.name)}</span>
            <span class="rc-price">${esc(c.price)}${c.unit ? `<span class="rc-unit"> ${esc(c.unit)}</span>` : ""}</span>
          </span>
          <span class="rc-meta">${esc(c.vendor)} · ${esc(c.city)}</span>
          <span class="rc-meta">${esc(c.category)}</span>
        </span>
        <span class="rc-foot"><span class="rc-foot-mono">${esc(c.mono)}</span><span class="rc-foot-name">${esc(c.label)}</span></span>
      </span>
    </button>`;

  /** Explore's results section. `variant` drives the cover shape and the phone layout. */
  const explore = (variant, note) => PVA.topbar({ search: false }) + PVA.tabs("explore") + `
    <main class="ex-page">
      <p class="ex-note">${esc(note)}</p>
      <div class="ex-head"><h2 class="ex-title">Services</h2><span class="ex-count">6 results</span></div>
      <div class="ex-grid" data-variant="${esc(variant)}">${each(CARDS, (c) => card(c))}</div>
    </main>`;

  /* ── Cover vs contain, at card size ─────────────────────────────────────────────────── */

  const crop = () => PVA.topbar({ search: false }) + PVA.tabs("explore") + `
    <main class="ex-page">
      <p class="ex-note">The same three uploads in a square card. Top row: cover (fill the square and crop the overflow,
        as every booker photo does today). Bottom row: contain (the whole photo on the division tint).
        Each drawing has its subject near an edge, so the crop is visible.</p>
      <div class="ex-grid" data-variant="square" data-crop="1">
        ${each(CARDS.slice(0, 3), (c) => card(c, { fit: "cover" }))}
        ${each(CARDS.slice(0, 3), (c) => card(c, { fit: "contain" }))}
      </div>
    </main>`;

  window.PREVIEW_SCREENS = [
    { id: "today",       label: "1 · Today — 118px band",                       render: () => explore("band",   "Today: a 118px band across the card, cropping every upload to a wide strip.") },
    { id: "square",      label: "2 · Option A — square, phone: one column",     render: () => explore("square", "Option A: square cover. On a phone, one full-width card per row.") },
    { id: "square-2up",  label: "3 · Option B — square, phone: two columns",    render: () => explore("square-2up", "Option B: square cover. On a phone, two cards per row. Desktop is identical to A.") },
    { id: "square-row",  label: "4 · Option C — square, phone: thumbnail row",  render: () => explore("square-row", "Option C: square cover. On a phone, a square thumbnail beside the text. Desktop is identical to A.") },
    { id: "crop",        label: "5 · Cover vs contain, per upload shape",       render: crop },
  ];
})();
