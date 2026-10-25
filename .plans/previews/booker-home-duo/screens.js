/*
 * booker-home-duo — the screens. THIS FILE IS THE WORK; everything else is scaffolding.
 *
 * For `.plans/2026-10-24-booker-banner-carousel.md` I11 + I12 (proposed 2026-10-24):
 *   I11 — web: "Browse by division" takes 2/3 of the row and "Book again" moves up beside it in
 *         the remaining 1/3 (≥1024px); stacked below that; divisions full width when there is no
 *         booking history.
 *   I12 — phone: the division strip shows 5 columns per page instead of 4.
 *
 * ⚠️ RECONSTRUCTIONS. "Now" copies booker's module CSS as of 2026-10-24 INCLUDING the rebuilt I9
 * (centred rows of at most seven 72px tiles). "Proposed" differs only by the rules keyed on
 * `[data-variant="proposed"]` in preview.css.
 *
 * ⚠️ `@container`, not `@media`: each frame is a container named `hp`, with the app's 640px
 * phone threshold and the proposal's 1024px side-by-side threshold applied to the FRAME width.
 *
 * Fixtures are INVENTED: booking rows reuse the gallery's fictional names; division slugs/labels
 * are booker's own. The banner is the carousel preview's labelled placeholder.
 */
"use strict";

(function () {
  const { esc, icon, each } = window.PV;

  const DIVISIONS = [
    ["ezzy-court", "Court"], ["ezzy-care", "Care"], ["ezzy-well", "Well"], ["ezzy-drive", "Drive"],
    ["ezzy-pets", "Pets"], ["ezzy-food", "Food"], ["ezzy-home", "Home"], ["ezzy-ride", "Ride"],
    ["ezzy-learn", "Learn"], ["ezzy-stay", "Stay"], ["ezzy-work", "Work"], ["ezzy-park", "Park"],
    ["ezzy-law", "Law"],
  ];

  /* Up to three rows — `bookAgain(bookings, limit = 3)` in lib/homeRules.ts. Invented. */
  const AGAIN = [
    ["DIV", "Intro Dive Session", "Coastal Dive Co · Last Apr 19, 2026"],
    ["CRT", "1-Hour Court Rental", "Acme Sports Center · Last Apr 2, 2026"],
    ["SPA", "Thermal Pool — Half Day", "Calamba Springs · Last Mar 15, 2026"],
  ];

  const head = (title, meta, link) => `
    <div class="db-shelf-head head"><span class="db-shelf-pipe"></span>
      <h2 class="title">${esc(title)}</h2>${meta ? `<span class="meta">${esc(meta)}</span>` : ""}
      <span class="spacer"></span>${link ? `<span class="link">${esc(link)}</span>` : ""}</div>`;

  const divisions = () => `
    <section class="sec" data-tone="divisions" aria-label="Browse by division">
      ${head("Browse by division", "Every category we book for", "Open Explore")}
      <div class="body"><div class="strip" role="group" aria-label="Divisions">${each(DIVISIONS, ([slug, label]) => `
        <button type="button" class="tile"><span class="tileDisc"><span class="tileIcon"><img src="./logos/${slug}.png" alt=""></span></span><span class="tileName">${label}</span></button>`)}
      </div><div class="dots" aria-hidden="true"><span class="dot dotOn"></span><span class="dot"></span></div></div>
    </section>`;

  const again = (n) => n === 0 ? "" : `
    <section class="sec" data-tone="again" aria-label="Book again">
      ${head("Book again", "Things you have booked before")}
      <div class="body"><div class="list">${each(AGAIN.slice(0, n), ([code, name, meta]) => `
        <button type="button" class="row"><span class="badge">${esc(code)}</span>
          <span class="main"><span class="offering">${esc(name)}</span><span class="rmeta">${esc(meta)}</span></span>${icon("right", 16)}</button>`)}
      </div></div>
    </section>`;

  const banner = () => `
    <section class="pc" aria-label="Promotions">
      <div class="pc-track"><img class="pc-img" src="./art/promo-a.svg" alt="Illustrative placeholder banner" width="1800" height="600"></div>
      <div class="pc-controls">
        <button type="button" class="pc-btn" aria-label="Previous promotion" aria-disabled="true">${icon("left", 18)}</button>
        <span class="pc-dots" aria-hidden="true"><span class="pc-dot is-on"></span><span class="pc-dot"></span><span class="pc-dot"></span></span>
        <button type="button" class="pc-btn" aria-label="Next promotion">${icon("right", 18)}</button>
      </div>
    </section>`;

  const near = () => `<section class="sec" data-tone="near" aria-label="Near you">${head("Near you", "", "See all")}<div class="body"><div class="stub"></div></div></section>`;

  /*
   * NOW: Book again sits low on the page (after Available today, before Vendors).
   * PROPOSED: a `.duo` row right after the in-progress strip; `.duoSide:empty` collapses when
   * BookAgainCard renders null.
   */
  const page = (variant, n = 3) => variant === "now"
    ? `<div class="hp" data-variant="now">${divisions()}${banner()}${near()}${again(n)}</div>`
    : `<div class="hp" data-variant="proposed"><div class="duo"><div class="duoMain">${divisions()}</div><div class="duoSide">${again(n)}</div></div>${banner()}${near()}</div>`;

  const frame = (inner, w) => `<figure class="wf"${w ? ` data-w="${w}"` : ""}><div class="hp-frame">${inner}</div></figure>`;
  const tag = (t, prop) => `<span class="tag ${prop ? "tag-prop" : "tag-recon"}">${esc(t)}</span>`;
  const intro = (h, s) => `<header class="pg"><h1 class="pg-h">${esc(h)}</h1><p class="pg-s">${s}</p></header>`;

  /* Live measurements written as TEXT into [data-m] slots — never a style (CSP). */
  function measure(root) {
    root.querySelectorAll(".wf").forEach((f) => {
      const out = f.querySelector("[data-m]");
      if (!out) return;
      const r = (e) => e.getBoundingClientRect();
      const strip = f.querySelector(".strip");
      const tiles = [...strip.querySelectorAll(".tile")];
      const sr = r(strip);
      const visible = tiles.filter((t) => r(t).right <= sr.right + 1 && r(t).top - r(tiles[0]).top < 2).length;
      const clipped = tiles.filter((t) => { const n = t.querySelector(".tileName"); return n.scrollWidth > n.clientWidth; }).length;
      const parts = [`tile ${Math.round(r(tiles[0]).width)}px`, `${visible} visible per row`, `${clipped} labels clipped`];
      const main = f.querySelector(".duoMain"), side = f.querySelector(".duoSide .sec");
      if (main && side && Math.abs(r(main).top - r(side).top) < 2) {
        parts.push(`split ${Math.round(r(main).width)} | ${Math.round(r(side).width)}px`, `heights ${Math.round(r(main).height)} / ${Math.round(r(side).height)}px`);
      }
      out.textContent = parts.join(" · ");
    });
  }

  window.PREVIEW_SCREENS = [
    {
      id: "desktop",
      label: "1 · Web — now vs proposed (2/3 divisions, 1/3 Book again)",
      render: () => `
        ${intro("Web: divisions and Book again side by side",
          "Proposed: from 1024px wide, “Browse by division” takes 2/3 of the row and “Book again” moves up from lower on the page into the remaining 1/3. Both cards stretch to the same height. The 2/3 column still fits the centred 7 + 6 rows, so there is little empty space at its sides. Below the pair: promotions, then the rest of Home unchanged.")}
        <div class="stack">
          <div>${tag("Now · reconstruction (I9 as rebuilt)")}${frame(page("now"))}</div>
          <div>${tag("Proposed", true)}<figure class="wf"><p class="cap"><span data-m></span></p><div class="hp-frame">${page("proposed")}</div></figure></div>
        </div>`,
      mount: measure,
    },
    {
      id: "states",
      label: "2 · Web states — 1 row, no history, 900px stacked",
      render: () => `
        ${intro("Proposed: how the pair behaves",
          "One Book again row: the card stretches to match divisions, so the pair stays a clean block. No booking history: Book again renders nothing and divisions takes the full width — no empty third. At 900px (below 1024): the two stack, Book again directly under divisions.")}
        <div class="stack">
          <div>${tag("1 Book again row", true)}<figure class="wf"><p class="cap"><span data-m></span></p><div class="hp-frame">${page("proposed", 1)}</div></figure></div>
          <div>${tag("No booking history", true)}<figure class="wf"><p class="cap"><span data-m></span></p><div class="hp-frame">${page("proposed", 0)}</div></figure></div>
          <div>${tag("900px — stacked", true)}<figure class="wf" data-w="900"><p class="cap"><span data-m></span></p><div class="hp-frame">${page("proposed", 3)}</div></figure></div>
        </div>`,
      mount: measure,
    },
    {
      id: "phone",
      label: "3 · Phone — 4 vs 5 columns per page (390 and 320px)",
      render: () => `
        ${intro("Phone: five columns per page",
          "The division strip still scrolls sideways in two rows; each page now shows 5 columns instead of 4. Columns are a fifth of the strip's width (minus 6px gaps), so it is exactly 5 at any phone width — and still ≥ 44px wide at 320px. Book again now sits directly under divisions on a phone too (one page order for every width).")}
        <div class="phones">${each([390, 320], (w) => `
          <div>${tag(`Now · ${w}px`)}<figure class="wf" data-w="${w}"><p class="cap"><span data-m></span></p><div class="hp-frame">${page("now", 2)}</div></figure></div>
          <div>${tag(`Proposed · ${w}px`, true)}<figure class="wf" data-w="${w}"><p class="cap"><span data-m></span></p><div class="hp-frame">${page("proposed", 2)}</div></figure></div>`)}
        </div>`,
      mount: measure,
    },
  ];
})();
