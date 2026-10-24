/*
 * booker-mobile-spacing-colours — the screens. THIS FILE IS THE WORK; everything else is scaffolding.
 *
 * Previews `prototypes/prompts/2026-10-23-booker-mobile-spacing-colours.md` for
 * `.plans/2026-10-23-booker-mobile-spacing-colours.md`: division-tile label colours in both
 * themes, and a tighter phone layout for the Home hero ("What do you need today?") and the
 * "Browse by division" widget.
 *
 * ⚠️ THE "CURRENT" VIEWS ARE RECONSTRUCTIONS, not screenshots. They copy the values in
 * `booker/components/home/{HomePage,HomeSection,DivisionStrip}/*.module.css` and
 * `booker/components/location/LocationChip/LocationChip.module.css` as of 2026-10-23. The real
 * screens are the committed baselines `booker/visual-tests/pilot.spec.ts-snapshots/
 * home-narrow-{light,dark}-chromium-linux.png` — compare against those, not against memory.
 *
 * ⚠️ ONE MARKUP, TWO VARIANTS: `data-variant="current|proposed"` on `.hp`. Every proposed
 * difference is a CSS rule in preview.css keyed on that attribute, so the diff between the
 * two columns is exactly the diff the plan proposes.
 *
 * ⚠️ `@container`, NOT `@media`, in the preview. The app switches at `@media (max-width:
 * 640px)`; here each frame is its own inline-size container, so a 390px frame can sit beside
 * another on a 1280px screen and still take the phone rules. Same threshold, same rules.
 *
 * Fixtures are INVENTED. Division slugs/labels are booker's own (`lib/divisions.ts`); there are
 * no vendor or customer rows here at all.
 */
"use strict";

(function () {
  const { esc, icon, each } = window.PV;

  /* `booker/lib/divisions.ts` → DIVISIONS, in order. `label` is what booker prints. */
  const DIVISIONS = [
    { slug: "ezzy-court", label: "Court" }, { slug: "ezzy-care", label: "Care" },
    { slug: "ezzy-well", label: "Well" },   { slug: "ezzy-drive", label: "Drive" },
    { slug: "ezzy-pets", label: "Pets" },   { slug: "ezzy-food", label: "Food" },
    { slug: "ezzy-home", label: "Home" },   { slug: "ezzy-ride", label: "Ride" },
    { slug: "ezzy-learn", label: "Learn" }, { slug: "ezzy-stay", label: "Stay" },
    { slug: "ezzy-work", label: "Work" },   { slug: "ezzy-park", label: "Park" },
    { slug: "ezzy-law", label: "Law" },
  ];

  /*
   * Current `--div-*-label` (light, dark) and the WCAG ratio each measures on the surface the
   * label actually sits on: `--db-sub-bg` over `--db-card-bg` over the page gradient (dark:
   * worst of the three stops). Computed 2026-10-23 from `booker/app/globals.css`; the script
   * is in the plan's Verification section. Light: #f8fafc, opaque.
   * Food / Stay / Ride have no derived label and fall back to their `-fg` pair.
   */
  const CURRENT = {
    "ezzy-court": ["#025afb", 5.20, "#2c75fc", 3.51], "ezzy-care": ["#0b2d85", 11.61, "#667cb3", 3.54],
    "ezzy-well": ["#5c736e", 4.86, "#75918b", 4.29],  "ezzy-drive": ["#026add", 4.89, "#137bed", 3.53],
    "ezzy-pets": ["#b0533e", 4.83, "#f47356", 5.17],  "ezzy-food": ["#b91c1c", 6.18, "#fca5a5", 7.69],
    "ezzy-home": ["#1b252e", 14.86, "#787e84", 3.56], "ezzy-ride": ["#0369a1", 5.67, "#7dd3fc", 8.75],
    "ezzy-learn": ["#035848", 8.05, "#4b877c", 3.51], "ezzy-stay": ["#3f5573", 7.28, "#a8c0dc", 7.81],
    "ezzy-work": ["#b15401", 4.85, "#fd7802", 5.46],  "ezzy-park": ["#ce330a", 4.89, "#ed3b0c", 3.64],
    "ezzy-law": ["#85694d", 4.87, "#c69d73", 5.89],
  };

  /*
   * The location chip, in the three forms `LocationChip.tsx` renders: unset, a city, and a
   * barangay + city (the long one, which truncates). A real <button>, so the runner's 44px
   * check measures it — the proposed pill is SMALLER TO THE EYE but its box stays 44px tall.
   */
  const CHIPS = {
    unset: `<button type="button" class="chip unset">${icon("pin", 15)}<span class="city">Set your location</span></button>`,
    city: `<button type="button" class="chip">${icon("pin", 15)}<span class="place">Makati City</span><span class="cdot">·</span><span class="change">Change</span></button>`,
    long: `<button type="button" class="chip">${icon("pin", 15)}<span class="place">Bagong Silangan · Quezon City</span><span class="cdot">·</span><span class="change">Change</span></button>`,
  };

  /* Static parts of a Home column. Spans, not buttons, for everything this plan does not
     resize, so the runner's 44px check speaks to the tiles and the chip — README → Limits. */
  const hero = (chip = "unset") => `
    <section class="hero">
      <div>
        <h1 class="heading">What do you need today?</h1>
        <p class="sub">Pick a division below, or search a service or vendor by name.</p>
      </div>
      <div class="heroActions">
        <div class="search">
          <span class="searchPh">Search a service or vendor</span>
          <span class="searchGo">${icon("search", 16)}</span>
        </div>
      </div>
      ${CHIPS[chip]}
    </section>`;

  const tiles = () => each(DIVISIONS, (d) => `
    <button type="button" class="tile" data-division="${esc(d.slug)}">
      <span class="tileDisc"><span class="tileIcon"><img src="./logos/${esc(d.slug)}.png" alt="" aria-hidden="true"></span></span>
      <span class="tileName">${esc(d.label)}</span>
    </button>`);

  const divisions = () => `
    <section class="sec" data-tone="divisions" aria-label="Browse by division">
      <div class="db-shelf-head head"><span class="db-shelf-pipe"></span>
        <h2 class="title">Browse by division</h2><span class="meta">Every category we book for</span>
        <span class="spacer"></span><span class="link">Open Explore</span></div>
      <div class="body">
        <div class="strip" role="group" aria-label="Divisions">${tiles()}</div>
        <div class="dots" aria-hidden="true"><span class="dot dotOn"></span><span class="dot"></span></div>
      </div>
    </section>`;

  /* The next shelf, header only — it is here to show how far it moves up, nothing else. */
  const next = () => `
    <section class="sec next" data-tone="near" aria-label="Near you">
      <div class="db-shelf-head head"><span class="db-shelf-pipe"></span>
        <h2 class="title">Near you</h2><span class="spacer"></span><span class="link">See all</span></div>
      <div class="body"><div class="nextStub"></div></div>
    </section>`;

  const column = (variant) => `
    <div class="hp-frame"><div class="hp" data-variant="${variant}">${hero()}${divisions()}${next()}</div></div>`;

  const tag = (variant) => variant === "current"
    ? '<span class="tag tag-recon">Current · reconstruction</span>'
    : '<span class="tag tag-prop">Proposed</span>';

  const intro = (h, s) => `<header class="pg"><h1 class="pg-h">${esc(h)}</h1><p class="pg-s">${s}</p></header>`;

  /* Measurement slots, filled by `measure()` after render. */
  const ROWS = [
    ["hero", "Hero (“What do you need today?”) height"],
    ["div", "Division widget height"],
    ["gap", "Logo → label (visible ink gap)"],
    ["tile", "Tile tap target (w × h)"],
    ["pill", "Location chip: visible pill height"],
    ["chip", "Location chip: tap box (w × h)"],
    ["next", "Top of the next shelf (from page top)"],
  ];
  const PAIRS = new Set(["tile", "chip"]);
  const table = () => `
    <table class="meas">
      <thead><tr><th>Measured in this preview</th><th>Current</th><th>Proposed</th><th>Δ</th></tr></thead>
      <tbody>${each(ROWS, ([k, l]) => `
        <tr><th>${esc(l)}</th><td data-m="current-${k}">…</td><td data-m="proposed-${k}">…</td><td data-m="delta-${k}">…</td></tr>`)}
      </tbody>
    </table>`;

  /*
   * Reads the rendered boxes and writes numbers as TEXT — no style is ever set (CSP). Runs on
   * the first frame of each variant present; desktop-width frames report desktop values, which
   * is the point of the "desktop unchanged" check.
   */
  function measure(root) {
    const vals = {};
    root.querySelectorAll(".hp").forEach((hp) => {
      const v = hp.dataset.variant;
      if (vals[v]) return;
      const r = (el) => el.getBoundingClientRect();
      const top = r(hp).top;
      const tile = hp.querySelector(".tile");
      const img = tile.querySelector("img");
      const name = tile.querySelector(".tileName");
      /* The art is drawn `object-fit: contain` in a square box, so ink starts at the box edge
         for these square PNGs. The label's ink starts at its line box top + half-leading. */
      const nameBox = r(name);
      const fs = parseFloat(getComputedStyle(name).fontSize);
      const lh = parseFloat(getComputedStyle(name).lineHeight) || fs * 1.5;
      /* The proposed pill is painted inside transparent top/bottom borders, so what the eye
         sees is the box minus those borders; the tap box is the whole element. */
      const chip = hp.querySelector(".chip");
      const cs = getComputedStyle(chip);
      vals[v] = {
        hero: r(hp.querySelector(".hero")).height,
        div: r(hp.querySelector('[data-tone="divisions"]')).height,
        gap: nameBox.top + (lh - fs) / 2 - r(img).bottom,
        tile: [r(tile).width, r(tile).height],
        pill: r(chip).height - (cs.borderTopColor === "rgba(0, 0, 0, 0)" ? parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth) : 0),
        chip: [r(chip).width, r(chip).height],
        next: r(hp.querySelector(".next")).top - top,
      };
    });
    const set = (k, t) => { const el = root.querySelector(`[data-m="${k}"]`); if (el) el.textContent = t; };
    const px = (n) => `${Math.round(n)}px`;
    for (const v of ["current", "proposed"]) {
      if (!vals[v]) continue;
      for (const [k] of ROWS) set(`${v}-${k}`, PAIRS.has(k) ? `${Math.round(vals[v][k][0])} × ${Math.round(vals[v][k][1])}` : px(vals[v][k]));
    }
    if (vals.current && vals.proposed) {
      for (const [k] of ROWS) {
        if (PAIRS.has(k)) { set(`delta-${k}`, "≥ 44 × 44 kept"); continue; }
        const d = vals.proposed[k] - vals.current[k];
        set(`delta-${k}`, `${d > 0 ? "+" : ""}${Math.round(d)}px`);
      }
    }
  }

  const compare = (cls) => `
    <div class="cmp ${cls}">
      ${each(["current", "proposed"], (v) => `<div class="cmp-col">${tag(v)}${column(v)}</div>`)}
    </div>`;

  /* ── Label colour key ─────────────────────────────────────────────────────────────── */
  const ratio = (n) => `<span class="ratio${n < 4.5 ? " is-fail" : ""}">${n.toFixed(2)}:1</span>`;
  const labelRows = () => each(DIVISIONS, (d) => {
    const [l, lr, dk, dr] = CURRENT[d.slug];
    return `
      <tr data-division="${esc(d.slug)}">
        <th><span class="key-logo"><img src="./logos/${esc(d.slug)}.png" alt="" aria-hidden="true"></span></th>
        <td><span class="tileName key-cur">${esc(d.label)}</span>
          <code class="only-light">${l}</code><code class="only-dark">${dk}</code></td>
        <td><span class="only-light">${ratio(lr)}</span><span class="only-dark">${ratio(dr)}</span></td>
        <td><span class="tileName key-new">${esc(d.label)}</span></td>
        <td><span class="only-light">${ratio(17.06)}</span><span class="only-dark">${ratio(13.32)}</span></td>
      </tr>`;
  });

  window.PREVIEW_SCREENS = [
    {
      id: "compare",
      label: "1 · Phone: current vs proposed (390px)",
      render: () => intro("Home on a phone — current vs proposed",
        "Two 390px frames from one markup. Left copies today's stylesheet values; right applies the plan's mobile-only rules and the label colour. "
        + "The table is measured live from the two frames. Swipe the division rows sideways to reach every division.")
        + table() + compare("cmp-390"),
      mount: measure,
    },
    {
      id: "current",
      label: "2 · Current (reconstruction) at this viewport",
      render: () => intro("Current — reconstruction",
        "Today's values at the viewport you opened. At desktop width this is the wrapping grid; under 640px, the two-row scroller. "
        + "Real reference: <code>booker/visual-tests/pilot.spec.ts-snapshots/home-narrow-*.png</code>.")
        + `<div class="solo">${tag("current")}${column("current")}</div>`,
    },
    {
      id: "proposed",
      label: "3 · Proposed at this viewport",
      render: () => intro("Proposed",
        "At desktop width only the label colour differs from screen 2 — every spacing rule is inside the 640px breakpoint. Under 640px, the tighter layout.")
        + `<div class="solo">${tag("proposed")}${column("proposed")}</div>`,
    },
    {
      id: "labels",
      label: "4 · Label colours and contrast",
      render: () => intro("Division label colours",
        "Light: one readable ink for every label (<code>--db-strong</code> #0f172a) — no longer each logo’s own colour. "
        + "Dark: the logos are displayed as WHITE silhouettes (<code>.db-mark</code> = <code>brightness(0) invert(1)</code>), so the label follows white, "
        + "not the division brand colour. Ratios are against the real surface: section body over card over page (dark: worst gradient stop). "
        + "Red = under 4.5:1.")
        + `<div class="keywrap"><table class="key">
            <thead><tr><th>Logo as displayed</th><th>Current label</th><th>Contrast</th><th>Proposed label</th><th>Contrast</th></tr></thead>
            <tbody>${labelRows()}</tbody></table></div>
          <aside class="d1">
            <h2 class="d1-h">Decision D1 — which white in dark?</h2>
            <div class="d1-row">
              <div class="d1-opt"><span class="d1-swatch" data-opt="a">Court Well Pets</span>
                <p><b>A · <code>--db-strong</code> (#f1f5f9)</b> — recommended. Existing token, flips to #0f172a in light, so one rule covers both themes. 13.32:1. Differs from the #ffffff logo by 1.10:1 — not distinguishable at 10px.</p></div>
              <div class="d1-opt"><span class="d1-swatch" data-opt="b">Court Well Pets</span>
                <p><b>B · exact #ffffff</b> — a literal match to the logo. 14.59:1. Needs a new dark-only token (booker does not hard-code hex in a module).</p></div>
            </div>
          </aside>`,
    },
    {
      id: "narrow",
      label: "5 · Narrow phone (320px)",
      render: () => intro("Narrow phone — 320px",
        "The smallest width booker’s own audits cover. Check the heading wrap, the location chip, label truncation and that the strip still scrolls instead of overflowing.")
        + table() + compare("cmp-320"),
      mount: measure,
    },
    {
      id: "chips",
      label: "6 · Location chip, all three states (390px)",
      render: () => intro("Location chip — unset, a city, a long barangay",
        "Hero only, at phone width. Proposed: the sub-line is gone and the chip is drawn as a 32px pill — "
        + "12px text, 13px pin — inside a box that is still 44px tall, so it looks smaller without becoming harder to tap. "
        + "Long names still truncate before <b>Change</b>.")
        + `<div class="cmp cmp-390">${each(["current", "proposed"], (v) => `<div class="cmp-col">${tag(v)}${each(["unset", "city", "long"], (c) =>
          `<div class="hp-frame chips-frame"><div class="hp" data-variant="${v}">${hero(c)}</div></div>`)}</div>`)}</div>`,
    },
  ];
})();
