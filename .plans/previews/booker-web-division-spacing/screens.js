/*
 * booker-web-division-spacing — the screens. THIS FILE IS THE WORK; everything else is scaffolding.
 *
 * For `.plans/2026-10-24-booker-banner-carousel.md` I9: tighten "Browse by division" on the WEB
 * (above 640px) the way `.plans/2026-10-23-booker-mobile-spacing-colours.md` I2/I3 did on a phone —
 * remove the invisible box around each logo and trim the gaps, WITHOUT resizing the logos.
 *
 * ⚠️ BOTH COLUMNS ARE RECONSTRUCTIONS. "Current" copies `booker/components/home/DivisionStrip/
 * DivisionStrip.module.css` and `HomeSection.module.css` as of 2026-10-24; the real screen is the
 * committed baseline `booker/visual-tests/pilot.spec.ts-snapshots/home-light-chromium-linux.png`.
 * "Proposed" differs ONLY by the rules under `[data-variant="proposed"]` in preview.css, so the diff
 * between the columns is exactly the diff the plan proposes.
 *
 * ⚠️ `@container`, NOT `@media`: each frame is its own inline-size container with the app's 640px
 * threshold, so a frame takes the desktop or phone rules by ITS width, not the window's.
 *
 * Fixtures are INVENTED; division slugs/labels are booker's own (`lib/divisions.ts`). The banner is
 * the carousel preview's labelled placeholder, there only to show what sits under the widget now.
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

  const divisions = () => `
    <section class="sec" data-tone="divisions" aria-label="Browse by division">
      <div class="db-shelf-head head"><span class="db-shelf-pipe"></span>
        <h2 class="title">Browse by division</h2><span class="meta">Every category we book for</span>
        <span class="spacer"></span><span class="link">Open Explore</span></div>
      <div class="body"><div class="strip" role="group" aria-label="Divisions">${each(DIVISIONS, ([slug, label]) => `
        <button type="button" class="tile"><span class="tileDisc"><span class="tileIcon"><img src="./logos/${slug}.png" alt=""></span></span><span class="tileName">${label}</span></button>`)}
      </div><div class="dots" aria-hidden="true"><span class="dot dotOn"></span><span class="dot"></span></div></div>
    </section>`;

  /* The promotions carousel as shipped (PromoCarousel.module.css), static — context only. */
  const banner = () => `
    <section class="pc" aria-label="Promotions">
      <div class="pc-track"><img class="pc-img" src="./art/promo-a.svg" alt="Illustrative placeholder banner" width="1800" height="600"></div>
      <div class="pc-controls">
        <button type="button" class="pc-btn" aria-label="Previous promotion" aria-disabled="true">${icon("left", 18)}</button>
        <span class="pc-dots" aria-hidden="true"><span class="pc-dot is-on"></span><span class="pc-dot"></span><span class="pc-dot"></span></span>
        <button type="button" class="pc-btn" aria-label="Next promotion">${icon("right", 18)}</button>
      </div>
    </section>`;

  const page = (variant) => `<div class="hp-frame"><div class="hp" data-variant="${variant}">${divisions()}${banner()}</div></div>`;

  /* Revised 2026-10-24 after review ("still a lot of space"): two tighter options. */
  const VARIANTS = ["current", "a", "b"];
  const LABEL = { current: "Current", a: "Option A · 10 per row", b: "Option B · all 13 in one row" };
  const tag = (variant) => variant === "current"
    ? '<span class="tag tag-recon">Current · reconstruction</span>'
    : `<span class="tag tag-prop">${LABEL[variant]}</span>`;

  const intro = (h, s) => `<header class="pg"><h1 class="pg-h">${esc(h)}</h1><p class="pg-s">${s}</p></header>`;

  const ROWS = [
    ["gap", "Logo → label (visible gap)"],
    ["logo", "Logo size (unchanged on purpose)"],
    ["tile", "Tile tap target (w × h)"],
    ["pitch", "Logo to logo, horizontally (centre to centre)"],
    ["cols", "Tiles per row"],
    ["widget", "“Browse by division” widget height"],
    ["banner", "Top of the promotions banner (from widget top)"],
  ];
  const PAIRS = new Set(["tile", "logo"]);
  const table = () => `
    <table class="meas">
      <thead><tr><th>Measured live in this preview</th>${each(VARIANTS, (v) => `<th>${esc(LABEL[v])}</th>`)}</tr></thead>
      <tbody>${each(ROWS, ([k, l]) => `<tr><th>${esc(l)}</th>${each(VARIANTS, (v) => `<td data-m="${v}-${k}">…</td>`)}</tr>`)}</tbody>
    </table>`;

  /* Reads rendered boxes and writes TEXT only — never a style (CSP). First frame of each variant. */
  function measure(root) {
    const vals = {};
    root.querySelectorAll(".hp").forEach((hp) => {
      const v = hp.dataset.variant;
      if (vals[v]) return;
      const r = (el) => el.getBoundingClientRect();
      const tiles = [...hp.querySelectorAll(".tile")];
      const tile = tiles[0];
      const img = tile.querySelector("img");
      const name = tile.querySelector(".tileName");
      const fs = parseFloat(getComputedStyle(name).fontSize);
      const lh = parseFloat(getComputedStyle(name).lineHeight) || fs * 1.5;
      const firstTop = r(tile).top;
      const widget = hp.querySelector('[data-tone="divisions"]');
      vals[v] = {
        gap: r(name).top + (lh - fs) / 2 - r(img).bottom,
        logo: [r(img).width, r(img).height],
        tile: [r(tile).width, r(tile).height],
        cols: tiles.filter((t) => Math.abs(r(t).top - firstTop) < 2).length,
        pitch: r(tiles[1]).left - r(tiles[0]).left,
        widget: r(widget).height,
        banner: r(hp.querySelector(".pc")).top - r(widget).top,
      };
    });
    const set = (k, t) => { const el = root.querySelector(`[data-m="${k}"]`); if (el) el.textContent = t; };
    const px = (n) => `${Math.round(n)}px`;
    for (const v of VARIANTS) {
      if (!vals[v]) continue;
      for (const [k] of ROWS) {
        const x = vals[v][k];
        let t = PAIRS.has(k) ? `${Math.round(x[0])} × ${Math.round(x[1])}` : k === "cols" ? String(x) : px(x);
        if (v !== "current" && vals.current && !PAIRS.has(k) && k !== "cols") {
          const d = Math.round(x - vals.current[k]);
          if (d !== 0) t += ` (${d > 0 ? "+" : ""}${d})`;
        }
        set(`${v}-${k}`, t);
      }
    }
  }

  const WIDTHS = [700, 900];

  window.PREVIEW_SCREENS = [
    {
      id: "compare",
      label: "1 · Current vs options A and B — web (above 640px)",
      render: () => `
        ${intro("“Browse by division” on the web: current vs two tighter options",
          "Both options put the label right under its logo (the invisible box around each 46px logo goes 84 → 48px, the gap under it 9 → 4px) and pack the logos closer side by side by narrowing the columns. <b>A</b>: 88px columns — 10 per row, 3 on the second. <b>B</b>: 68px columns — all 13 on one row at full width. <b>The logos stay 46px.</b> Below 640px nothing changes. Numbers are measured from the rendered frames.")}
        ${table()}
        <div class="stack">${each(VARIANTS, (v) => `<div class="col">${tag(v)}${page(v)}</div>`)}</div>`,
      mount: measure,
    },
    {
      id: "widths",
      label: "2 · Options A and B at 700 and 900px",
      render: () => `
        ${intro("Options A and B, near the breakpoint",
          "Frames 700px and 900px wide — tablet and small-laptop widths, still on the web rules. Columns wrap by their minimum width, so the second row holds whatever is left over. In a window narrower than a frame, the frame shrinks and may cross 640px into the phone layout, which this change does not touch.")}
        <div class="wf-grid">${each(["a", "b"], (v) => each(WIDTHS, (w) => `
          <figure class="wf" data-w="${w}"><figcaption class="wf-cap"><b>${w}px</b> · ${esc(LABEL[v])}</figcaption>${page(v)}</figure>`))}
        </div>`,
    },
  ];
})();
