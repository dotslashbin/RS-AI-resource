/*
 * booker-photo-row — the screens. THIS FILE IS THE WORK; everything else is scaffolding.
 *
 * Question under review (user, 2026-10-30): on a phone, the offering cards on Home ("Available
 * today") and Explore put a 112px square photo at the TOP of a taller card, leaving an empty strip
 * under it. The user wants the square photo to fill the left side and the details on the right.
 * Also: when an offering HAS a photo, nothing is drawn on the photo (no division pill, no division
 * logo badge); the pill/logo is only for the no-photo state.
 * Plan: `.plans/2026-10-30-booker-home-square-sidebar-carousel.md` (I5–I7).
 *
 * Cards copied from `OfferingResultCard` (Explore) and `OpenTodayCard` (Home "Available today")
 * as shipped in booker 0.30.x, including their ≤640px row layouts.
 *
 * ⚠️ FIXTURES ARE INVENTED, and the "photos" are hand-drawn SVGs in `./photos/`.
 * ⚠️ No inline `style=""`: the CSP blocks it. Variants are `data-` attributes in preview.css.
 */
"use strict";

(function () {
  const { esc, icon, each } = window.PV;

  /* ── Fixtures ───────────────────────────────────────────────────────────────────────── */

  const PH = {
    court: "./photos/court-landscape.svg",
    dog: "./photos/groom-portrait.svg",
    tray: "./photos/tray-square.svg",
  };

  const EXPLORE = [
    { name: "Half-court, hourly", price: "₱850.00", unit: "/ hr", vendor: "Northside Courts", city: "Davao City", category: "Court rental", div: "ezzy-court", label: "Court", mono: "EC", photo: PH.court },
    { name: "Full groom, medium dog", price: "₱620.00", unit: "", vendor: "Paws & Claws", city: "Tagum City", category: "Grooming", div: "ezzy-pets", label: "Pets", mono: "EP", photo: PH.dog, unbookable: true },
    { name: "Driving lesson, 90 minutes", price: "₱1,100.00", unit: "", vendor: "Mindanao Driving", city: "Davao City", category: "Lessons", div: "ezzy-drive", label: "Drive", mono: "ED", photo: null },
    { name: "Lechon tray, 25 pax", price: "₱4,800.00", unit: "", vendor: "Kusina Marikit", city: "Davao City", category: "Catering", div: "ezzy-food", label: "Food", mono: "EF", photo: PH.tray },
  ];

  const TODAY = [
    { name: "Court Rental", vendor: "Citywide Sports Center", city: "Pila", slot: "09:00 · 2 hours", price: "₱850.00", div: "ezzy-court", mono: "EC", photo: PH.tray },
    { name: "Private Coaching Session", vendor: "Summit Athletics Club", city: "Quezon City", slot: "17:30 · 1 hour", price: "₱1,200.00", div: "ezzy-well", mono: "EW", photo: null },
    { name: "Dental Cleaning", vendor: "Brightsmile Clinic", city: "Cebu City", slot: "09:00 · 45 minutes", price: "₱1,400.00", div: "ezzy-care", mono: "EC", photo: PH.dog },
  ];

  /* ── Cards. `v` is the variant: "today" (as shipped), "fill" (option A), "stretch" (option B). ── */

  const exploreCard = (c, v) => {
    const shipped = v === "today";
    /* Shipped: pill (and "No dates yet") always on the cover. Proposed: on the cover only without a photo. */
    const coverPill = shipped || !c.photo ? `<span class="rc-div">${esc(c.label)}</span>` : "";
    const coverChip = c.unbookable && (shipped || !c.photo) ? '<span class="rc-unbookable">No dates yet</span>' : "";
    const textChip = c.unbookable && !shipped && c.photo ? '<span class="rc-chip">No dates yet</span>' : "";
    return `
      <button type="button" class="rc" data-v="${v}" data-division="${esc(c.div)}">
        <span class="rc-cover">
          ${c.photo
            ? `<img class="rc-photo" src="${esc(c.photo)}" alt="">`
            : `<span class="rc-ph"><span class="rc-ph-ezzy">E</span><span class="rc-ph-rule"></span><span class="rc-ph-mark">${esc(c.mono)}</span></span>`}
          ${coverPill}${coverChip}
        </span>
        <span class="rc-body">
          <span class="rc-top">
            <span class="rc-name">${esc(c.name)}</span>
            <span class="rc-price">${esc(c.price)}${c.unit ? `<span class="rc-unit"> ${esc(c.unit)}</span>` : ""}</span>
          </span>
          <span class="rc-meta">${esc(c.vendor)} · ${esc(c.city)}</span>
          <span class="rc-meta">${esc(c.category)}</span>
          <span class="rc-foot-row">
            <span class="rc-foot"><span class="rc-foot-mono">${esc(c.mono)}</span><span class="rc-foot-name">${esc(c.label)}</span></span>
            ${textChip}
          </span>
        </span>
      </button>`;
  };

  const todayCard = (c, v) => {
    const shipped = v === "today";
    return `
      <button type="button" class="ot" data-v="${v}" data-division="${esc(c.div)}">
        <span class="ot-panel">
          ${c.photo
            ? `<img class="ot-photo" src="${esc(c.photo)}" alt="">`
            : `<span class="ot-mark">${esc(c.mono)}</span>`}
          ${c.photo && shipped ? `<span class="ot-badge">${esc(c.mono)}</span>` : ""}
        </span>
        <span class="ot-body">
          <span class="ot-name">${esc(c.name)}</span>
          <span class="ot-vendor">${esc(c.vendor)} · ${esc(c.city)}</span>
          <span class="ot-slot">${icon("cal", 13)} ${esc(c.slot)}</span>
          <span class="ot-spacer"></span>
          <span class="ot-foot"><span class="ot-price">${esc(c.price)}</span><span class="ot-book">Book</span></span>
        </span>
      </button>`;
  };

  const page = (v, note) => PVA.topbar({ search: false }) + PVA.tabs("home") + `
    <main class="pg" data-v="${v}">
      <p class="pg-note">${esc(note)}</p>
      <h2 class="pg-h">Home · Available today</h2>
      <div class="ot-grid">${each(TODAY, (c) => todayCard(c, v))}</div>
      <h2 class="pg-h">Explore · Services</h2>
      <div class="rc-grid">${each(EXPLORE, (c) => exploreCard(c, v))}</div>
    </main>`;

  window.PREVIEW_SCREENS = [
    { id: "today", label: "1 · Today (0.30.x) — photo at the top, gap below, badges on photos",
      render: () => page("today", "As shipped. Phone: a 112px square at the top of a taller card leaves an empty strip under it. Photos carry a division logo (Home) or the division pill and \"No dates yet\" (Explore).") },
    { id: "fill", label: "2 · Option A — square fills the left side (card height = photo)",
      render: () => page("fill", "Option A. Phone: a 136px square fills the left side top to bottom, and the card is exactly that tall; each text line is one line, ellipsised. Nothing on photos; \"No dates yet\" moves beside the division label. Cards without a photo keep the mark and pill.") },
    { id: "stretch", label: "3 · Option B — photo stretches to the card height (not square)",
      render: () => page("stretch", "Option B. Phone: the 112px-wide photo stretches to the full card height, so it fills the left side but is a tall rectangle, not a square; text wraps as today. Desktop as option A.") },
  ];
})();
