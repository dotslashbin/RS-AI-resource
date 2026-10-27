/*
 * booker-home-divisions-layout — the screens. THIS FILE IS THE WORK; everything else is scaffolding.
 *
 * Previews `prototypes/prompts/2026-10-25-booker-home-divisions-layout.md` for
 * `.plans/2026-10-25-booker-home-divisions-layout.md`. Four proposals:
 *   1. light mode only: every division mark and label in "Browse by division" drawn in #034afc;
 *   2. about 10px of VISIBLE space between a mark and its label, both themes, both widths;
 *   3. phone only: one sideways-scrolling row instead of two;
 *   4. both widths: search → promotions carousel → divisions → everything else.
 *
 * ⚠️ THE "CURRENT" SCREENS ARE A RECONSTRUCTION, not a screenshot. They copy the values in
 * `booker/components/home/{HomePage,HomeSection,DivisionStrip,PromoCarousel}/*.module.css` as
 * of 2026-10-25. The real screens are the committed baselines
 * `booker/visual-tests/pilot.spec.ts-snapshots/homepromo-*.png`.
 *
 * ⚠️ `@container vp`, NOT `@media`, for the page. Each `.vp` frame is one inline-size container
 * standing in for a viewport, so a 320px frame can sit beside a 768px one on one screen and still
 * take the phone rules. On the full-page screens `.vp` is the window's width, so it matches the
 * app's `@media (max-width: 640px)` / `(min-width: 1024px)` there.
 *
 * ⚠️ THE BLUE IS AN SVG FILTER ON THE <img>, exactly as proposed for the app (plan D1): a
 * `feFlood` + `feComposite in=SourceAlpha` keeps each mark's alpha and replaces its colour.
 * No mask and no canvas read happen in the page, so the logos stay plain `./logos/*.png`.
 *
 * Fixtures are INVENTED. Division slugs and labels are booker's own (`lib/divisions.ts`); the
 * "Book again" and "In progress" rows match the gallery's fixture names, not real rows. Artwork
 * in `./art/` is the banner-carousel preview's labelled placeholder.
 */
"use strict";

(function () {
  const { esc, icon, each } = window.PV;

  /* `DIVISIONS` order from booker/lib/divisions.ts:45–58. Never a hardcoded count elsewhere. */
  const DIVISIONS = [
    ["ezzy-court", "Court"], ["ezzy-care", "Care"], ["ezzy-well", "Well"], ["ezzy-drive", "Drive"],
    ["ezzy-pets", "Pets"], ["ezzy-food", "Food"], ["ezzy-home", "Home"], ["ezzy-ride", "Ride"],
    ["ezzy-learn", "Learn"], ["ezzy-stay", "Stay"], ["ezzy-work", "Work"], ["ezzy-park", "Park"],
    ["ezzy-law", "Law"],
  ];

  const SLIDES = ["./art/promo-a.svg", "./art/promo-b.svg", "./art/promo-c.svg"];

  /* The filter the proposal adds to DivisionStrip, once per document. `flood-color` comes from
     CSS (`.ink-flood`), so the hex lives in the stylesheet, not the markup. */
  const inkDefs = () => `
    <svg class="ink-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="division-strip-ink" color-interpolation-filters="sRGB">
        <feFlood class="ink-flood"/><feComposite in2="SourceAlpha" operator="in"/>
      </filter>
    </svg>`;

  /* Screen 10: one filter per dark-mode blue. Same technique as I2; flood colours in preview.css. */
  const DARKINK = [
    ["", "Approved plan", "light #034afc · dark white silhouettes (.db-mark)"],
    ["exact", "A · #034afc in both themes", "the light-mode blue, kept in dark"],
    ["lift", "B · #4f7dff in both themes", "the same hue, a step lighter"],
    ["soft", "C · #7aa2ff in both themes", "lighter again"],
    ["sky", "D · #93b4ff in both themes", "light, airy blue"],
    ["mist", "E · #b3cbff in both themes", "the lightest"],
  ];
  const DARKINK_HEX = { exact: "#034afc", lift: "#4f7dff", soft: "#7aa2ff", sky: "#93b4ff", mist: "#b3cbff" };
  const darkInkDefs = () => `
    <svg class="ink-defs" width="0" height="0" aria-hidden="true" focusable="false">${each(DARKINK.slice(1), ([k]) => `
      <filter id="division-ink-${k}" color-interpolation-filters="sRGB">
        <feFlood class="ink-flood-${k}"/><feComposite in2="SourceAlpha" operator="in"/>
      </filter>`)}
    </svg>`;

  /* ── The page (reconstruction around the proposal) ────────────────────────────────────── */

  const hero = () => `
    <section class="hero" data-order="search">
      <div><h1 class="heading">What do you need today?</h1>
        <p class="sub">Pick a division below, or search a service or vendor by name.</p></div>
      <div class="search"><span class="searchPh">Search a service or vendor</span><span class="searchGo">${icon("search", 16)}</span></div>
      <span class="chip">${icon("pin", 14)}<span>Set your location</span></span>
    </section>`;

  const inProgress = () => `
    <div class="prog" data-order="progress"><span class="progDot"></span>
      <span class="progBody"><span class="progTitle">In progress</span>
      <span class="progText">1-Hour Court Rental · Acme Sports Center</span></span>${icon("right", 16)}</div>`;

  /* The shipped PromoCarousel, drawn static: one 3:1 slide, ‹ dots › under it. Not a new carousel. */
  const carousel = () => `
    <section class="pc" data-order="promos" aria-label="Promotions">
      <div class="pc-track"><img class="pc-img" src="${SLIDES[0]}" alt="Illustrative placeholder promotion" width="1800" height="600"></div>
      <div class="pc-controls" aria-hidden="true">
        <span class="pc-btn is-off">${icon("left", 18)}</span>
        <span class="pc-dots"><span class="pc-dot is-on"></span><span class="pc-dot"></span><span class="pc-dot"></span></span>
        <span class="pc-btn">${icon("right", 18)}</span>
      </div>
    </section>`;

  /*
   * "Browse by division". `variant`: "current" | "proposed". Tiles are real <button>s so the
   * runner's 44×44 check covers them; the scroller is a focusable group, as in the app.
   */
  /* `icons`: "" = today's PNG marks, "mono" / "brand" = the 3D set (icons3d.js, plan I8). */
  /* `alias`: draw another drawing for a slug (the `court` screen's alternatives). */
  const strip = (variant, icons = "", darkInk = "", alias = {}) => `
    <div class="wrap" data-variant="${variant}"${icons ? ` data-icons="${icons}"` : ""}${darkInk ? ` data-darkink="${darkInk}"` : ""}>
      <div class="strip" role="group" aria-label="Browse by division" tabindex="0">${each(DIVISIONS, ([slug, label]) => `
        <button type="button" class="tile" data-division="${slug}">
          <span class="tileDisc"><span class="tileIcon">${icons ? ICONS3D.svg(alias[slug] || slug, icons) : `<img src="./logos/${slug}.png" alt="" width="46" height="46">`}</span></span>
          <span class="tileName">${label}</span>
        </button>`)}
      </div>
      <div class="dots" aria-hidden="true"></div>
      <span class="live" role="status" aria-live="polite"></span>
      ${variant === "proposed" ? `<p class="hintNote" aria-hidden="true"><span class="hintTag">Preview note</span>
        The <b>half-cut tile</b> at the right edge says “more this way”; the <b>dots</b> say which page you are on. Swipe ← to see the rest.</p>` : ""}
    </div>`;

  const divisions = (variant, icons = "", darkInk = "", alias = {}) => `
    <section class="sec" data-tone="divisions" data-order="divisions">
      <div class="db-shelf-head head"><span class="db-shelf-pipe"></span>
        <h2 class="title">Browse by division</h2><span class="meta">Every category we book for</span>
        <span class="spacer"></span><span class="link">Open Explore</span></div>
      <div class="body">${strip(variant, icons, darkInk, alias)}</div>
    </section>`;

  /* `again`: which header accent to draw (screen 6). Omitted = today's brown. */
  const bookAgain = (again = "") => `
    <section class="sec" data-tone="again"${again ? ` data-again="${again}"` : ""}>
      <div class="db-shelf-head head"><span class="db-shelf-pipe"></span><h2 class="title">Book again</h2></div>
      <div class="body"><div class="again"><span class="againBadge">DIV</span>
        <span class="againMain"><span class="againTitle">Intro Dive Session</span>
        <span class="againMeta">Coastal Dive Co · Last Apr 19, 2026</span></span>${icon("right", 16)}</div></div>
    </section>`;

  const duo = (variant, again = "", icons = "") => `
    <div class="duo"><div class="duoMain">${divisions(variant, icons)}</div><div class="duoSide">${bookAgain(again)}</div></div>`;

  /* Screen 6's options. Values live in preview.css (`[data-again]`); this is the label list only. */
  const AGAIN = [
    ["", "Today · brown", "--div-ezzy-work-deep #8e4301, the same in both themes"],
    ["honey", "Previous pick · Honey", "light #b7791f · dark #f2c14e"],
    ["emerald", "A · Emerald (booker's existing green)", "light #047857 · dark #10b981 — the --st-confirmed-fg pair"],
    ["green", "B · Leaf green", "light #15803d · dark #4ade80"],
    ["forest", "C · Soft forest", "light #3f7d3a · dark #86c97f"],
    ["sky", "D · Sky blue", "light #0284c7 · dark #38bdf8"],
    ["cornflower", "E · Cornflower", "light #3b82f6 · dark #93c5fd"],
    ["powder", "F · Powder blue (lightest)", "light #60a5fa · dark #bfdbfe"],
  ];

  /* Screen 9's sample "Near you" cards: ShelfCard draws a 44px division mark (ShelfCard.tsx:63). */
  const NEAR = [
    ["ezzy-court", "1-Hour Court Rental", "Acme Sports Center"],
    ["ezzy-pets", "Full Grooming", "Paws & Co"],
    ["ezzy-food", "Catering for 20", "Kusina Mia"],
  ];
  const mark = (slug, icons) => icons ? ICONS3D.svg(slug, icons)
    : `<img src="./logos/${slug}.png" alt="" width="44" height="44">`;
  const nearCards = (icons) => `
    <section class="sec" data-tone="near">
      <div class="db-shelf-head head"><span class="db-shelf-pipe"></span><h2 class="title">Near you</h2></div>
      <div class="body"><div class="d9cards">${each(NEAR, ([slug, title, vendor]) => `
        <div class="d9card"><span class="d9mark">${mark(slug, icons)}</span>
          <span class="d9main"><span class="d9title">${esc(title)}</span>
          <span class="d9meta">${esc(vendor)} · Next slot 3:00 PM</span></span></div>`)}
      </div></div>
    </section>`;

  /* Screen 9: D9's choices. [key, name, what it means, strip icons, card icons]. */
  const D9 = [
    ["a-mono", "A · 3D everywhere — blue (light #034afc, dark #93b4ff)",
      "Every division mark on Home becomes the 3D set: the strip and the shop cards (Near you, Popular, Open today). Blue #034afc on a light page, the lighter #93b4ff on a dark one.", "mono", "mono"],
    ["a-brand", "A · 3D everywhere — brand colours",
      "The same, but each division keeps its own logo colour.", "brand", "brand"],
    ["b", "B · Keep today's logos",
      "No 3D. The strip shows the PNG logos in blue in light mode (this plan's I2); the cards keep each logo's own colours.", "", ""],
    ["c", "C · 3D only in “Browse by division”",
      "The strip uses the 3D set in blue; the cards keep today's PNG logos. Two icon styles on one page.", "mono", ""],
  ];

  const stubShelf = (title, tone) => `
    <section class="sec" data-tone="${tone}" data-order="rest">
      <div class="db-shelf-head head"><span class="db-shelf-pipe"></span><h2 class="title">${esc(title)}</h2></div>
      <div class="body"><div class="stubCards"><span></span><span></span><span></span></div></div>
    </section>`;

  const rest = () => stubShelf("Near you", "near") + stubShelf("Available today", "today");

  const ord = (n, text) => `<p class="ord"><span class="ordN">${n}</span>${esc(text)}</p>`;

  const currentPage = () => `
    <div class="hp">
      ${hero()}${inProgress()}
      ${duo("current")}
      ${carousel()}
      ${rest()}
    </div>`;

  /* `notes` false = the clean full page (screen 11): no numbered preview notes. */
  const proposedPage = (notes = true, icons = "") => {
    const n = (k, text) => notes ? ord(k, text) : "";
    return `
    <div class="hp">
      ${n(1, "Search — unchanged")}${hero()}
      ${n("·", "In progress — only while a booking is running; stays under search (plan D3)")}${inProgress()}
      ${n(2, "Promotions — the existing PromoCarousel, moved up")}${carousel()}
      ${n(3, "Browse by division (+ Book again beside it from 1024px) — moved down one")}${duo("proposed", "powder", icons)}
      ${n(4, "Everything else — same relative order")}${rest()}
    </div>`;
  };

  const intro = (tagText, h, s, alt = false) => `
    <header class="pg"><span class="tag${alt ? " tag-alt" : ""}">${esc(tagText)}</span>
      <h1 class="pg-h">${esc(h)}</h1><p class="pg-s">${s}</p></header>`;

  /* ── Behaviour: a plain-DOM sketch of `useDivisionStrip` (pages + page from scrollLeft) ── */

  function wireStrip(wrap) {
    const el = wrap.querySelector(".strip");
    const dots = wrap.querySelector(".dots");
    const live = wrap.querySelector(".live");
    let pages = 0, page = -1;
    function measure() {
      if (!el.isConnected) return false;
      const w = el.clientWidth;
      const nextPages = w > 0 ? Math.max(1, Math.ceil(el.scrollWidth / w)) : 1;
      const max = el.scrollWidth - w;
      const nextPage = max > 0 ? Math.round((el.scrollLeft / max) * (nextPages - 1)) : 0;
      /* Preview furniture: the hint bracket hides once there is nothing left to scroll to. */
      wrap.toggleAttribute("data-end", max > 0 && el.scrollLeft >= max - 1);
      if (nextPages !== pages) {
        pages = nextPages;
        dots.innerHTML = pages > 1 ? Array.from({ length: pages }, () => '<span class="dot"></span>').join("") : "";
        page = -1;
      }
      if (nextPage !== page) {
        page = nextPage;
        dots.querySelectorAll(".dot").forEach((d, i) => d.classList.toggle("dotOn", i === page));
        live.textContent = pages > 1 ? `Divisions, page ${page + 1} of ${pages}` : "";
      }
      return true;
    }
    el.addEventListener("scroll", measure, { passive: true });
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => { if (!measure()) ro.disconnect(); });
      ro.observe(el);
    }
    measure();
    if (wrap.closest("[data-at-end]")) { el.scrollLeft = el.scrollWidth; measure(); }
  }

  /* Tiles do not navigate in a preview; say what the app would do instead. */
  function wireTiles(root) {
    const out = root.querySelector(".pv-out");
    root.addEventListener("click", (e) => {
      const t = e.target.closest(".tile");
      if (t && out) out.textContent = `Would open Explore filtered to ${t.dataset.division} (onExploreDivision) — unchanged behaviour. Preview tiles are inert.`;
    });
  }

  function mountAll(root) {
    ICONS3D.fit(root);
    root.querySelectorAll(".wrap").forEach(wireStrip);
    wireTiles(root);
  }

  const out = () => `<p class="pv-out" role="status">Preview: division tiles are inert — click one to see what it would do.</p>`;

  /* ── Colour/contrast helpers for the swatch screen (computed from the rendered styles) ── */

  const lum = ([r, g, b]) => {
    const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

  /* ── Screens ─────────────────────────────────────────────────────────────────────────── */

  const WIDTHS = [320, 360, 390, 640, 768];

  window.PREVIEW_SCREENS = [
    {
      id: "current",
      label: "1 · Current Home — RECONSTRUCTION (today's order)",
      render: () => `
        ${PVA.topbar({ search: false })}${PVA.tabs("home")}
        ${intro("Reconstruction · current",
          "Today's Home, rebuilt from booker's module CSS",
          "Search → divisions (with Book again) → promotions → the rest. Logos in their own colours on light, white silhouettes on dark; two rows that scroll on a phone. Compare with the committed <code>homepromo-*</code> baselines, not with this page.", true)}
        <div class="vp">${currentPage()}</div>${out()}`,
      mount: mountAll,
    },
    {
      id: "proposed",
      label: "2 · Proposed Home — search → promotions → divisions",
      render: () => `
        ${inkDefs()}${PVA.topbar({ search: false })}${PVA.tabs("home")}
        ${intro("Proposal",
          "Proposed Home",
          "Numbered notes mark the new order. Light: division marks <b>#034afc</b>, labels black. Dark: white marks, white labels (the approved plan; screen 11 shows blue marks in dark). Phone: one row that scrolls sideways — swipe, or focus the row and use ← →. The numbered notes are preview furniture, not design.")}
        <div class="vp">${proposedPage()}</div>${out()}`,
      mount: mountAll,
    },
    {
      id: "divisions",
      label: "3 · Divisions close-up — current vs proposed, phone strip at start and end",
      render: () => `
        ${inkDefs()}
        ${intro("Close-up", "The division section, before and after",
          "Desktop layout is unchanged apart from colour. The phone frames are 390px viewports; the last frame is pre-scrolled to the end to show <b>Law</b>, the 13th division, is reachable. Gap figures are measured from pixels by <code>measure.mjs</code> — see the README.")}
        <div class="cmp">
          <figure class="cmpCell"><figcaption class="cap"><b>Current</b> · desktop (reconstruction)</figcaption>
            <div class="vp vp-desk">${divisions("current")}</div></figure>
          <figure class="cmpCell"><figcaption class="cap"><b>Proposed</b> · desktop — same wrap, blue in light</figcaption>
            <div class="vp vp-desk">${divisions("proposed")}</div></figure>
        </div>
        <div class="cmp cmp-phone">
          <figure class="cmpCell"><figcaption class="cap"><b>Current</b> · phone, two rows (reconstruction)</figcaption>
            <div class="vp vp-phone"><div class="hp hp-tight">${divisions("current")}</div></div></figure>
          <figure class="cmpCell"><figcaption class="cap"><b>Proposed</b> · phone, one row — at the start</figcaption>
            <div class="vp vp-phone"><div class="hp hp-tight">${divisions("proposed")}</div></div></figure>
          <figure class="cmpCell" data-at-end><figcaption class="cap"><b>Proposed</b> · phone — scrolled to the end</figcaption>
            <div class="vp vp-phone"><div class="hp hp-tight">${divisions("proposed")}</div></div></figure>
        </div>${out()}`,
      mount: mountAll,
    },
    {
      id: "widths",
      label: "4 · Widths — 320 / 360 / 390 / 640 / 768, proposed order",
      render: () => `
        ${inkDefs()}
        ${intro("Width checks", "Narrow phone to tablet",
          "Each frame stands for a viewport of the labelled width and shows the top of the proposed Home. ≤640px takes the phone rules (one row); 768px keeps the wrapping rows with Book again stacked under divisions. Measured sizes print live; on a narrow window the wider frames shrink to fit and the figures follow.")}
        <div class="wf-grid">${each(WIDTHS, (w) => `
          <figure class="wf" data-w="${w}"><figcaption class="cap"><b>${w}px</b> · <span data-m>…</span></figcaption>
            <div class="vp"><div class="hp">${hero()}${carousel()}${duo("proposed", "powder")}</div></div></figure>`)}
        </div>`,
      mount: (root) => {
        mountAll(root);
        root.querySelectorAll(".wf").forEach((f) => {
          const s = f.querySelector(".strip");
          const tiles = Array.from(s.querySelectorAll(".tile"));
          const rows = new Set(tiles.map((t) => Math.round(t.offsetTop))).size;
          const minW = Math.min(...tiles.map((t) => t.getBoundingClientRect().width));
          const vp = f.querySelector(".vp").getBoundingClientRect().width;
          f.querySelector("[data-m]").textContent =
            `frame ${Math.round(vp)}px · ${rows} row${rows > 1 ? "s" : ""} · narrowest tile ${Math.round(minW)}px · ${s.scrollWidth > s.clientWidth ? "scrolls" : "fits"}`;
        });
      },
    },
    {
      id: "colour",
      label: "5 · Colour — #034afc swatch, contrast, every mark",
      render: () => `
        ${inkDefs()}
        ${intro("Colour", "The light-mode blue, and what it does to each mark",
          "Left: the mark as shipped today (own colours in light, white silhouette in dark). Right: the proposal (blue silhouette in light, unchanged in dark). Labels are black in light since 2026-10-26 (plan I7). Contrast figures are computed from the rendered colours. Switch the theme to see dark is untouched.")}
        <div class="sw">
          <div class="swChip"><span class="swInk"></span><code>#034afc</code></div>
          <p class="swNote" data-contrast>…</p>
        </div>
        <div class="marks">${each(DIVISIONS, ([slug, label]) => `
          <div class="markRow${slug === "ezzy-park" ? " is-flag" : ""}" data-division="${slug}">
            <span class="markName">${label}</span>
            <span class="wrap" data-variant="current"><span class="tileIcon tileIcon-lg"><img src="./logos/${slug}.png" alt="" width="64" height="64"></span></span>
            ${icon("right", 14)}
            <span class="wrap" data-variant="proposed"><span class="tileIcon tileIcon-lg"><img src="./logos/${slug}.png" alt="" width="64" height="64"></span></span>
            ${slug === "ezzy-park" ? '<span class="markFlag">F3: light gains a frame — see README</span>' : ""}
          </div>`)}
        </div>`,
      mount: (root) => {
        const name = document.createElement("span");
        name.className = "tileName";
        root.querySelector('.wrap[data-variant="proposed"]').appendChild(name);
        const ink = rgb(getComputedStyle(name).color);
        const body = rgb(getComputedStyle(document.documentElement).getPropertyValue("--db-sub-bg").trim().startsWith("#")
          ? hexRgb(getComputedStyle(document.documentElement).getPropertyValue("--db-sub-bg").trim()) : "0,0,0");
        name.remove();
        const dark = document.documentElement.classList.contains("dark");
        root.querySelector("[data-contrast]").textContent = dark
          ? `Dark mode: labels stay --db-strong (rgb ${ink.join(", ")}) and marks stay white silhouettes — the blue is not applied.`
          : `Label ink rgb(${ink.join(", ")}) on the section body rgb(${body.join(", ")}): ${ratio(ink, body).toFixed(2)}:1 · on white: ${ratio(ink, [255, 255, 255]).toFixed(2)}:1. AA needs 4.5:1 for 10–12px text.`;
      },
    },
    {
      id: "again",
      label: "6 · Book again header — brown, Honey, greens, lighter blues",
      render: () => `
        ${inkDefs()}
        ${intro("Option", "“Book again” header colour",
          "Only the header accent changes: the pipe beside the title, the faint wash, and the arcs and strokes at the right. The title text stays the page ink. Each row shows the proposed divisions + Book again pair at desktop width (stacked on a phone). The figure under each option is the pipe's contrast against the card, measured from the rendered colour.")}
        <div class="againGrid">${each(AGAIN, ([key, name, vals]) => `
          <figure class="againOpt"><figcaption class="cap"><b>${esc(name)}</b> · ${esc(vals)} · <span data-pipe></span></figcaption>
            <div class="vp"><div class="hp hp-tight">${duo("proposed", key)}</div></div></figure>`)}
        </div>`,
      mount: (root) => {
        mountAll(root);
        const dark = document.documentElement.classList.contains("dark");
        /* The card as painted: white in light; in dark ~5.5% white over the page's #0b1020. */
        const card = dark ? [24, 29, 44] : [255, 255, 255];
        root.querySelectorAll(".againOpt").forEach((f) => {
          const pipe = rgb(getComputedStyle(f.querySelector('[data-tone="again"] .db-shelf-pipe')).backgroundColor);
          const r = ratio(pipe, card);
          f.querySelector("[data-pipe]").textContent = `pipe ${r.toFixed(2)}:1 on the card${r < 3 ? " (under 3:1)" : ""}`;
        });
      },
    },
    {
      id: "icons3d",
      label: "7 · 3D icons — the set, mono and brand colours",
      render: () => `
        ${intro("Exploration · preview only", "Soft 3D division icons",
          "Object icons in the manner of Uber's service icons: matte, flat-shaded solids with softened edges and a soft ground shadow — no gloss, no shine. <b>Mono</b> is blue: #034afc on a light page and the lighter #93b4ff on a dark one (switch the theme). <b>Brand</b> uses each division's own logo colour. These are generated stand-ins to judge the direction, not production art — see the README.")}
        <h2 class="pg-h2">Mono — ${"<span class=\"onlyLight\">blue on white</span><span class=\"onlyDark\">lighter blue #93b4ff on dark</span>"}</h2>
        <div class="i3grid">${each(DIVISIONS, ([slug, label]) => `<figure class="i3cell"><span class="i3big">${ICONS3D.svg(slug, "mono")}</span><figcaption>${label}</figcaption></figure>`)}</div>
        <h2 class="pg-h2">Brand colours</h2>
        <div class="i3grid">${each(DIVISIONS, ([slug, label]) => `<figure class="i3cell"><span class="i3big">${ICONS3D.svg(slug, "brand")}</span><figcaption>${label}</figcaption></figure>`)}</div>`,
      mount: mountAll,
    },
    {
      id: "icons3d-strip",
      label: "8 · 3D icons in “Browse by division” — desktop and phone",
      render: () => `
        ${intro("Exploration · preview only", "The 3D icons at real size",
          "The same section as screen 2 (left-aligned rows, black labels in light, the tighter gap), with the PNG marks swapped for the 3D set — 46px on desktop, 32px on a phone, where small detail disappears first.")}
        <div class="cmp">
          <figure class="cmpCell"><figcaption class="cap"><b>Mono</b> · desktop</figcaption><div class="vp vp-desk">${divisions("proposed", "mono")}</div></figure>
          <figure class="cmpCell"><figcaption class="cap"><b>Brand colours</b> · desktop</figcaption><div class="vp vp-desk">${divisions("proposed", "brand")}</div></figure>
        </div>
        <div class="cmp cmp-phone">
          <figure class="cmpCell"><figcaption class="cap"><b>Mono</b> · phone</figcaption><div class="vp vp-phone"><div class="hp hp-tight">${divisions("proposed", "mono")}</div></div></figure>
          <figure class="cmpCell"><figcaption class="cap"><b>Brand colours</b> · phone</figcaption><div class="vp vp-phone"><div class="hp hp-tight">${divisions("proposed", "brand")}</div></div></figure>
        </div>${out()}`,
      mount: mountAll,
    },
    {
      id: "darkblue",
      label: "10 · Blue logos in both themes, lighter shades (PNG, not 3D)",
      render: () => `
        ${inkDefs()}${darkInkDefs()}
        ${intro("Option · preview only", "Blue division logos, lighter shades, light and dark",
          "Each option uses ONE blue for the PNG logos in both themes. Labels stay black in light and white in dark. Switch the theme in the bar at the bottom. The figures are the logo colour's contrast against the section in light and the card in dark; 3:1 is the usual minimum for an icon. Lighter blues read better in dark and fade in light.")}
        <div class="againGrid">${each(DARKINK, ([key, name, what]) => `
          <figure class="againOpt" data-darkopt="${key}"><figcaption class="cap"><b>${esc(name)}</b> — ${esc(what)} · <span data-inkc></span></figcaption>
            <div class="cmp">
              <div class="vp vp-desk">${divisions("proposed", "", key)}</div>
              <div class="vp vp-phone"><div class="hp hp-tight">${divisions("proposed", "", key)}</div></div>
            </div></figure>`)}
        </div>${out()}`,
      mount: (root) => {
        mountAll(root);
        /* Light: the section body (#f8fafc); dark: the card as painted (~5.5% white over #0b1020). */
        const body = [248, 250, 252], card = [24, 29, 44];
        const toRgb = (h) => h.match(/\w\w/g).map((x) => parseInt(x, 16));
        const fmt = (r) => `${r.toFixed(2)}:1${r < 3 ? " (under 3:1)" : ""}`;
        root.querySelectorAll("[data-darkopt]").forEach((f) => {
          const k = f.dataset.darkopt, c = f.querySelector("[data-inkc]");
          const light = toRgb(k ? DARKINK_HEX[k] : "#034afc"), dark = k ? light : [255, 255, 255];
          c.textContent = `logo light ${fmt(ratio(light, body))} · dark ${fmt(ratio(dark, card))}`;
        });
      },
    },
    {
      id: "fullpage",
      label: "11 · Full Home — light #034afc, dark lighter blue (D14-F)",
      render: () => `
        ${inkDefs()}${darkInkDefs()}${PVA.topbar({ search: false })}${PVA.tabs("home")}
        <div class="fpBar"><span class="fpText"><b>Division logos:</b> light <code>#034afc</code> · dark <code data-fp-hex>#93b4ff</code></span>
          <span class="fpPicks" role="group" aria-label="Dark-mode logo blue">${each([["soft", "C #7aa2ff"], ["sky", "D #93b4ff"], ["mist", "E #b3cbff"]], ([k, t]) => `
            <button type="button" class="fpPick" data-pick="${k}" aria-pressed="${k === "sky"}">${esc(t)}</button>`)}</span>
          <span class="fpHint">Pick applies in dark mode; switch the theme in the bar at the bottom.</span></div>
        <div class="vp fpPage">${proposedPage(false)}</div>${out()}`,
      mount: (root) => {
        mountAll(root);
        const HEX = { soft: "#7aa2ff", sky: "#93b4ff", mist: "#b3cbff" };
        const set = (k) => {
          root.querySelectorAll('.wrap[data-variant="proposed"]').forEach((w) => { w.dataset.darkonly = k; });
          root.querySelectorAll("[data-pick]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pick === k)));
          root.querySelector("[data-fp-hex]").textContent = HEX[k];
        };
        root.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => set(b.dataset.pick)));
        set("sky");
      },
    },
    ...[["fullpage-3d-brand", "12 · Full Home — 3D icons, brand colours, 30% bigger", "brand",
          "Each division in its own logo colour; in dark the four near-black brands are lifted (README F9)."],
        ["fullpage-3d-mono", "13 · Full Home — 3D icons, blue (dark: lighter #93b4ff), 30% bigger", "mono",
          "Blue #034afc on the light page; on the dark page the lighter blue #93b4ff (the PNG option D, screen 11), not white."]].map(([id, label, set, note]) => ({
      id, label,
      render: () => `
        ${inkDefs()}${PVA.topbar({ search: false })}${PVA.tabs("home")}
        <div class="fpBar"><span class="fpText"><b>3D division icons, ${set === "brand" ? "brand colours" : "blue"}:</b> ${esc(note)}
          Drawn 30% bigger: 60px on desktop (was 46), 42px on a phone (was 32). Generated stand-ins, not final art (D9).</span></div>
        <div class="vp fpPage" data-big3d>${proposedPage(false, set)}</div>${out()}`,
      mount: mountAll,
    })),
    {
      id: "fullpage-3d-phones",
      label: "14 · Full Home on a phone — 3D icons, brand and blue, 30% bigger",
      render: () => `
        ${inkDefs()}
        <div class="fpBar"><span class="fpText"><b>Phone (390px), both 3D colourways:</b> brand colours on the left, blue on the right
          (dark: the lighter blue #93b4ff). Icons 42px (was 32). Switch light / dark in the bar at the bottom; swipe or scroll the division row sideways.</span></div>
        <div class="fpPhones">
          <figure class="cmpCell"><figcaption class="cap"><b>Brand colours</b> · phone</figcaption><div class="vp vp-phone fpPage" data-big3d>${proposedPage(false, "brand")}</div></figure>
          <figure class="cmpCell"><figcaption class="cap"><b>Blue</b> · phone</figcaption><div class="vp vp-phone fpPage" data-big3d>${proposedPage(false, "mono")}</div></figure>
        </div>${out()}`,
      mount: mountAll,
    },
    {
      id: "court",
      label: "15 · Court icon — options (E pickleball paddle chosen)",
      render: () => {
        const OPTS = [["ezzy-court-v2", "Before · basketball (v2)"], ["ezzy-court-e", "E · Pickleball paddle — CHOSEN"], ["ezzy-court-a", "A · Tennis ball (chosen first, replaced)"], ["ezzy-court-b", "B · Pickleball"],
          ["ezzy-court-c", "C · Shuttlecock"], ["ezzy-court-d", "D · Court with a ball"]];
        return `
        ${inkDefs()}
        ${intro("Choice · preview only", "Court icon — pick a look",
          "Only the Court icon. Four alternatives to the basketball, in the same matte 3D style as the other twelve. Blue at 84px, 60px (desktop) and 42px (phone), then brand colour at 60 and 42px. Below, each one in the phone strip next to the other icons. Switch the theme for dark.")}
        <div class="courtGrid courtGrid-5">
          <span></span><span class="cap"><b>Blue 84</b></span><span class="cap"><b>Blue 60</b></span><span class="cap"><b>Blue 42</b></span><span class="cap"><b>Brand 60</b></span><span class="cap"><b>Brand 42</b></span>
          ${each(OPTS, ([slug, name]) => `<span class="cap"><b>${esc(name)}</b></span>${each([["84", "mono"], ["60", "mono"], ["42", "mono"], ["60", "brand"], ["42", "brand"]], ([sz, set]) => `<span class="courtBox" data-s="${sz}">${ICONS3D.svg(slug, set)}</span>`)}`)}
        </div>
        <h2 class="pg-h2">In the phone strip (blue)</h2>
        <div class="courtStrips">${each(OPTS, ([slug, name]) => `
          <figure class="cmpCell"><figcaption class="cap"><b>${esc(name)}</b></figcaption>
            <div class="vp vp-phone fpPage" data-big3d><div class="hp hp-tight">${divisions("proposed", "mono", "", { "ezzy-court": slug })}</div></div></figure>`)}
        </div>${out()}`;
      },
      mount: mountAll,
    },
    {
      id: "d9",
      label: "9 · D9 — where the 3D icons would go (choices)",
      render: () => `
        ${inkDefs()}
        ${intro("Decision D9 · preview only", "Where would the 3D icons go?",
          "Each option shows “Browse by division” and, under it, a sample of the shop cards that also draw a division mark (ShelfCard, schematic). Switch the theme to see light and dark. The 3D icons are generated stand-ins; whichever you pick would be drawn as real artwork in a separate plan.")}
        <div class="againGrid">${each(D9, ([key, name, what, stripIcons, cardIcons]) => `
          <figure class="againOpt" data-d9="${key}"><figcaption class="cap"><b>${esc(name)}</b> — ${esc(what)}</figcaption>
            <div class="vp vp-desk d9frame"><div class="hp hp-tight">${divisions("proposed", stripIcons)}${nearCards(cardIcons)}</div></div></figure>`)}
        </div>${out()}`,
      mount: mountAll,
    },
  ];

  function hexRgb(h) {
    const v = h.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)).join(",");
  }
})();
