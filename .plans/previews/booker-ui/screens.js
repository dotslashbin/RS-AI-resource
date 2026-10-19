/*
 * booker-ui — the screens. THIS FILE IS THE WORK; everything else is scaffolding.
 *
 * Previews the UI requests in `prototypes/prompts/2026-10-18-booker-ui-preview.md`:
 * division-mark sizing, circle-free marks, the new EzzyRide asset, offering-card photos with
 * a logo-only badge, and the narrow-screen bottom nav + two-row division scroller.
 *
 * ⚠️ FIXTURES ARE INVENTED. Every vendor, offering, price and count below is made up, and the
 * "photos" are CSS gradients, not photographs — see `.ph` in `preview.css`. Nothing here is a
 * real vendor or customer row, and nothing here is evidence that live photo data renders.
 *
 * ⚠️ No inline `style=""` anywhere: the CSP blocks it. Dynamic values are `data-` attributes
 * mapped in `preview.css`.
 */
"use strict";

(function () {
  const { esc, each } = window.PV;

  /* Served over http(s) rather than opened as a file: label the page. One class toggle, no
     style written — see the banner in index.html. */
  if (window.location.protocol !== "file:") document.documentElement.classList.add("is-web");

  /* ── Fixtures ───────────────────────────────────────────────────────────────────────── */

  /*
   * The thirteen divisions, in `booker/lib/divisions.ts` → DIVISIONS order (the order Home's
   * grid and Explore's chips show them). `label` is what booker PRINTS — "Care", not
   * "EzzyCare" — per `divisionLabel()`; `name` is the canonical name the monogram is built
   * from. `fill` is the measured opaque-box ratio; see the `[data-slug]` block in preview.css.
   */
  const DIVISIONS = [
    { slug: "ezzy-court", name: "EzzyCourt", label: "Court", fill: 0.949 },
    { slug: "ezzy-care",  name: "EzzyCare",  label: "Care",  fill: 0.961 },
    { slug: "ezzy-well",  name: "EzzyWell",  label: "Well",  fill: 0.961 },
    { slug: "ezzy-drive", name: "EzzyDrive", label: "Drive", fill: 0.574 },
    { slug: "ezzy-pets",  name: "EzzyPets",  label: "Pets",  fill: 0.957 },
    { slug: "ezzy-food",  name: "EzzyFood",  label: "Food",  fill: 0.977 },
    { slug: "ezzy-home",  name: "EzzyHome",  label: "Home",  fill: 0.969 },
    { slug: "ezzy-ride",  name: "EzzyRide",  label: "Ride",  fill: 1.000 },
    { slug: "ezzy-learn", name: "EzzyLearn", label: "Learn", fill: 0.850 },
    { slug: "ezzy-stay",  name: "EzzyStay",  label: "Stay",  fill: 0.973 },
    { slug: "ezzy-work",  name: "EzzyWork",  label: "Work",  fill: 0.990 },
    { slug: "ezzy-park",  name: "EzzyPark",  label: "Park",  fill: 0.984 },
    { slug: "ezzy-law",   name: "EzzyLaw",   label: "Law",   fill: 0.980 },
  ];

  /** The four marks that are near-black line art and vanish off their tint. Measured. */
  const DARK_MARKS = new Set(["ezzy-food", "ezzy-home", "ezzy-care", "ezzy-learn"]);

  /*
   * ⚠️ HOW MUCH OF EACH MARK IS ACTUALLY LEGIBLE ON WHITE — the share of its opaque ink that
   * clears 3:1 against a white card. Measured 2026-10-19.
   *
   * ⚠️ AN EARLIER VERSION OF THIS SCREEN USED THE MARK'S *DOMINANT* COLOUR AND WAS WRONG. By
   * that metric EzzyPark scored 1.01:1 and was called invisible — but the dominant colour was
   * its baked near-white PLATE, not its glyph, and the red "P" reads perfectly well. Share of
   * legible ink is the honest measure: it asks whether there is enough dark pixel to see.
   */
  const LEGIBLE = {
    "ezzy-law": 0.0, "ezzy-stay": 0.0, "ezzy-pets": 0.2, "ezzy-work": 39.3,
    "ezzy-park": 40.4, "ezzy-home": 99.2, "ezzy-well": 99.9, "ezzy-care": 100,
    "ezzy-court": 100, "ezzy-drive": 100, "ezzy-food": 100, "ezzy-learn": 100,
    "ezzy-ride": 100,
  };
  const band = (v) => (v < 5 ? "hard" : v < 50 ? "soft" : "ok");

  const OFFERINGS = [
    { id: "o1", name: "Half-court, hourly",      vendor: "Northside Courts",   city: "Davao City",  price: "₱ 850 / hr",  div: "ezzy-court", demo: "light" },
    { id: "o2", name: "Deep clean, 2 bedrooms",  vendor: "Tidy House Co.",     city: "Davao City",  price: "₱ 1,450",     div: "ezzy-home",  demo: "dark"  },
    { id: "o3", name: "Full groom, medium dog",  vendor: "Paws & Claws",       city: "Tagum City",  price: "₱ 620",       div: "ezzy-pets",  demo: "busy"  },
    { id: "o4", name: "Driving lesson, 90 min",  vendor: "Mindanao Driving",   city: "Davao City",  price: "₱ 1,100",     div: "ezzy-drive", demo: null    },
    { id: "o5", name: "Van rental, whole day",   vendor: "Southbound Rentals", city: "Panabo City", price: "₱ 3,200",     div: "ezzy-ride",  demo: null    },
    { id: "o6", name: "Lechon tray, 25 pax",     vendor: "Kusina Marikit",     city: "Davao City",  price: "₱ 4,800",     div: "ezzy-food",  demo: "light" },
  ];

  const byId = (id) => OFFERINGS.find((o) => o.id === id);

  /* ── Mark helpers ───────────────────────────────────────────────────────────────────── */

  const logo = (slug) => `./logos/${slug}.png`;

  /** The CURRENT treatment: the mark on its tinted disc, art at a flat 66%. */
  const discNow = (d, sm) => `
    <span class="disc${sm ? " disc-sm" : ""} now" data-division="${esc(d.slug)}" data-slug="${esc(d.slug)}">
      <img class="art" src="${logo(d.slug)}" alt="" aria-hidden="true">
    </span>`;

  /** The PROPOSED treatment: same disc, art sized so the INK is a constant share. */
  const discFixed = (d, sm) => `
    <span class="disc${sm ? " disc-sm" : ""}" data-division="${esc(d.slug)}" data-slug="${esc(d.slug)}">
      <img class="art" src="${logo(d.slug)}" alt="" aria-hidden="true">
    </span>`;

  /** Circle-free, as a plain <img>: keeps the logo's colours; four of them die in dark. */
  const bareImg = (d) => `
    <span class="bare" data-division="${esc(d.slug)}" data-slug="${esc(d.slug)}">
      <img class="art" src="${logo(d.slug)}" alt="" aria-hidden="true">
    </span>`;

  /** Circle-free, mask-painted: survives dark, but flattens the logo to one ink. */
  const bareMask = (d, cls) => `
    <span class="bare${cls ? ` ${cls}` : ""}" data-division="${esc(d.slug)}" data-slug="${esc(d.slug)}">
      <span class="mask" data-slug="${esc(d.slug)}"></span>
    </span>`;

  /**
   * THE CHOSEN TREATMENT: colour image in light, mask-painted silhouette in dark.
   * Both are in the DOM and CSS shows one, so the two states cannot drift apart.
   */
  const hybrid = (d) => `
    <span class="bare hybrid" data-division="${esc(d.slug)}" data-slug="${esc(d.slug)}">
      <img class="art h-img" src="${logo(d.slug)}" alt="" aria-hidden="true">
      <span class="mask h-mask" data-slug="${esc(d.slug)}"></span>
    </span>`;

  const markGrid = (render, figure) => `
    <div class="marks">
      ${each(DIVISIONS, (d) => `
        <div class="mk">
          ${render(d)}
          <span class="mk-name">${esc(d.label)}</span>
          ${figure ? `<span class="mk-fig">${figure(d)}</span>` : ""}
        </div>`)}
    </div>`;

  /* ── Card helpers ───────────────────────────────────────────────────────────────────── */

  /**
   * The image area of an offering card.
   *
   * `state` is the whole point of this preview:
   *   photo   — an uploaded photo exists → show it
   *   fallback— none exists → the division's mark on its tint
   *   broken  — the photo's URL fails → what the booker actually sees
   *
   * `badge` adds the PROPOSED logo-only stamp at the bottom right.
   */
  const cardImg = (o, { state = "photo", badge = false, size = "" } = {}) => {
    const inner =
      state === "photo"
        ? `<span class="ph" data-demo="${esc(o.demo || "light")}"></span><span class="ph-tag">DEMO</span>`
        : state === "broken"
          ? `<span class="ocard-broken"><span>Image unavailable</span></span>`
          : `<span class="ocard-fb">${discFixed({ slug: o.div }, true)}</span>`;

    /* ⚠️ The badge is the LOGO ONLY — no division name. The name belongs to the search
       result's footer, which this preview shows unchanged as the reference. */
    const stamp = badge
      ? `<span class="ocard-badge" data-division="${esc(o.div)}" data-slug="${esc(o.div)}">
           <img class="art" src="${logo(o.div)}" alt="" aria-hidden="true">
         </span>`
      : "";

    return `<span class="ocard-img"${size ? ` data-size="${esc(size)}"` : ""} data-division="${esc(o.div)}">${inner}${stamp}</span>`;
  };

  const card = (o, opts) => `
    <div class="ocard" data-division="${esc(o.div)}">
      ${cardImg(o, opts)}
      <span class="ocard-b">
        <span class="ocard-t">${esc(o.name)}</span>
        <span class="ocard-v">${esc(o.vendor)} · ${esc(o.city)}</span>
        <span class="ocard-f"><span class="ocard-p">${esc(o.price)}</span></span>
      </span>
    </div>`;

  /** One "Popular this month" row. `photo` switches the art box between the two rules. */
  const popRow = (o, rank, { photo = false } = {}) => `
    <div class="prow" data-division="${esc(o.div)}" data-slug="${esc(o.div)}">
      <span class="prow-art"${photo && o.demo ? ' data-has="photo"' : ""}>
        ${photo && o.demo
          ? `<span class="ph" data-demo="${esc(o.demo)}"></span>`
          : `<img class="art" src="${logo(o.div)}" alt="" aria-hidden="true">`}
      </span>
      <span class="prow-b">
        <span class="prow-t">${esc(o.name)}</span>
        <span class="prow-v">${esc(o.vendor)}</span>
        <span class="prow-f">
          <span class="prow-rank">${rank}</span>
          <span class="prow-p">${esc(o.price)}</span>
          <span class="prow-n">34 bookings</span>
        </span>
      </span>
    </div>`;

  /* ── The division strip ─────────────────────────────────────────────────────────────── */

  const divisionStrip = () => `
    <div class="bd-wrap">
      <div class="bd-scroll" tabindex="0" role="group" aria-label="Browse by division, scrolls sideways">
        ${each(DIVISIONS, (d) => `
          <button type="button" class="bd-tile" data-division="${esc(d.slug)}" data-slug="${esc(d.slug)}">
            <span class="disc disc-sm"><img class="art" src="${logo(d.slug)}" alt="" aria-hidden="true"></span>
            <span class="bd-name">${esc(d.label)}</span>
          </button>`)}
      </div>
      <div class="bd-ind" aria-hidden="true"></div>
      <span class="bd-live" role="status" aria-live="polite"></span>
    </div>`;

  /**
   * Build the dots and keep them in step with the real scroll position.
   *
   * ⚠️ Class toggles only — never a written style — because `style-src 'self'` blocks an
   * inline style and `el.style.x = y` is how a progress thumb would have to be driven.
   */
  function mountStrip(root) {
    const sc = root.querySelector(".bd-scroll");
    const ind = root.querySelector(".bd-ind");
    const live = root.querySelector(".bd-live");
    if (!sc || !ind) return;

    function pages() {
      return Math.max(1, Math.ceil(sc.scrollWidth / Math.max(1, sc.clientWidth)));
    }

    function paint() {
      const n = ind.children.length;
      if (!n) return;
      const max = sc.scrollWidth - sc.clientWidth;
      const i = max > 0 ? Math.round((sc.scrollLeft / max) * (n - 1)) : 0;
      Array.prototype.forEach.call(ind.children, (dot, k) => dot.classList.toggle("is-on", k === i));
      if (live) live.textContent = `Divisions, page ${i + 1} of ${n}`;
    }

    function build() {
      const n = pages();
      if (ind.children.length !== n) {
        ind.textContent = "";
        for (let i = 0; i < n; i++) {
          const dot = document.createElement("span");
          dot.className = "bd-dot";
          ind.appendChild(dot);
        }
      }
      paint();
    }

    sc.addEventListener("scroll", paint, { passive: true });

    /*
     * The page count depends on the viewport, so it has to survive a resize. A listener on
     * `window` would outlive this screen (the controller replaces `#root`'s innerHTML), so
     * this observes an element INSIDE root and disconnects itself once that element is gone.
     */
    if (typeof ResizeObserver === "function") {
      const ro = new ResizeObserver(() => {
        if (!document.contains(sc)) { ro.disconnect(); return; }
        build();
      });
      ro.observe(sc);
    }

    build();
  }

  /* ── The responsive shell ───────────────────────────────────────────────────────────── */

  const TABS = [
    { id: "home", label: "Home" },
    { id: "explore", label: "Explore" },
    { id: "activity", label: "Activity" },
    { id: "payments", label: "Payments" },
  ];

  /*
   * ⚠️ ONE tab set, rendered twice, with CSS deciding which is visible — never two menus on
   * screen at once. `.tabs-top` hides at 640px exactly as `.tabs-bottom` appears, so the
   * request's "avoid duplicate visible menus" holds by construction rather than by remembering.
   */
  const bottomBar = (active) => `
    <nav class="tabs-bottom" aria-label="Main">
      <div class="pvnav">
        ${each(TABS, (t) => `
          <button type="button" class="pvnav-tab"${t.id === active ? ' aria-current="page"' : ""}>
            <span class="pvnav-dot" aria-hidden="true"></span>${esc(t.label)}
          </button>`)}
      </div>
    </nav>`;

  const shell = (body, { active = "home", bottomnav = true } = {}) => `
    <div class="shell">
      ${PVA.topbar({ search: false })}
      <div class="tabs-top">${PVA.tabs(active)}</div>
      <div class="pg"${bottomnav ? ' data-bottomnav="on"' : ""}>${body}</div>
      ${bottomnav ? bottomBar(active) : ""}
    </div>`;

  const head = (h, s) => `<h1 class="pg-h">${esc(h)}</h1><p class="pg-s">${s}</p>`;
  const col = (flag, title, sub, body, attr) => `
    <div class="col" data-flag="${esc(flag)}"${attr || ""}>
      <span class="tag" data-flag="${esc(flag)}">${flag === "now" ? "Before" : flag === "new" ? "Proposed" : flag === "ship" ? "Shipped" : "Problem"}</span>
      <p class="col-h">${esc(title)}</p>
      <p class="col-s">${sub}</p>
      ${body}
    </div>`;

  /* ── Screens ────────────────────────────────────────────────────────────────────────── */

  window.PREVIEW_SCREENS = [
    {
      id: "marks",
      label: "1 \u00b7 Division marks \u2014 circle-free, per theme",
      render: () => `<div class="pg">
        ${head("Division marks", `<b>SHIPPED 2026-10-19 \u2014 circle-free is in the app.</b> The chosen treatment: a <b>colour image in light</b>, a <b>mask-painted silhouette in dark</b>. <b>Switch this screen between light and dark</b> \u2014 column 2 changes technique, not just colour.`)}
        <p class="note">\u26a0\ufe0f <b>The app ships the dark silhouette as <code>filter: brightness(0) invert(1)</code> on the image, not as a CSS mask.</b> Rendered side by side the two are indistinguishable; the filter keeps <code>next/image</code> optimising, which matters because the new EzzyRide PNG is 716 KB and a <code>mask-image: url()</code> fetches it raw. This screen still uses the mask because a <code>file://</code> preview has no image optimiser \u2014 the <i>design</i> is identical.<br><br>The circle is CSS, not artwork \u2014 <code>HomePage.module.css:161</code> draws a <code>border-radius: 999px</code> disc filled with <code>--division-tile</code>, so removing it changes no file in <code>public/division-icons/</code>.</p>
        <div class="cmp">
          ${col("now", "On the tinted disc", "What ships today, in both themes.", markGrid(discFixed))}
          ${col("new", "Circle-free hybrid \u2014 proposed", "Image in light, silhouette in dark. The silhouette follows the surface's text colour, so the four near-black marks survive dark mode without their tint.", markGrid(hybrid), ' data-ink="theme"')}
        </div>
        <div class="sect">
          <p class="sect-h">\u26a0\ufe0f The cost in LIGHT mode \u2014 three marks wash out on white</p>
          <p class="note"><b>The tint was protecting light mode too, not just dark.</b> The figure under each mark is the share of its ink that clears <b>3:1 on white</b>. <b>Law 0%, Stay 0%, Pets 0.2%</b> \u2014 those three have essentially no legible ink once the tint goes. Park (40%) and Work (39%) read fine. These marks are decorative with a text label beside them, so WCAG\u2019s 3:1 for <i>meaningful</i> graphics is arguable \u2014 but Law and Stay are visibly faint and that is the judgment call.<br><br>\u26a0\ufe0f <b>An earlier version of this screen called EzzyPark invisible at 1.01:1. That was wrong</b> \u2014 it measured Park\u2019s baked white plate rather than its red \u201cP\u201d. Park\u2019s real problem is in DARK: its mask includes that plate, so the silhouette is a filled tile rather than open line art. Switch themes and compare it with its neighbours.</p>
          <div class="white-card">
            ${each(DIVISIONS, (d) => `
              <div class="mk hybrid" data-division="${esc(d.slug)}" data-slug="${esc(d.slug)}">
                <span class="bare"><img class="art" src="${logo(d.slug)}" alt="" aria-hidden="true"></span>
                <span class="mk-name">${esc(d.label)}</span>
                <span class="ratio" data-fail="${band(LEGIBLE[d.slug])}">${LEGIBLE[d.slug]}% legible</span>
              </div>`)}
          </div>
        </div>
        <p class="note"><b>EzzyRide was replaced on 2026-10-19 and is now an ordinary mark.</b> The old file was a solid disc (fill 1.000, 79% ink, multi-colour) and needed its own plate blanked; the new one is 2000\u00d72000 single-colour line art \u2014 fill 0.871, 33% ink, 99% one colour \u2014 so every override built for the old one comes out. See screen 3.</p>
      </div>`,
    },

    {
      id: "size",
      label: "2 · EzzyDrive — why it looks smaller, and the fix",
      render: () => {
        const drive = DIVISIONS.find((d) => d.slug === "ezzy-drive");
        const learn = DIVISIONS.find((d) => d.slug === "ezzy-learn");
        const peers = DIVISIONS.filter((d) => ["ezzy-court", "ezzy-pets", "ezzy-work"].includes(d.slug));
        return `<div class="pg">
          ${head("EzzyDrive's apparent size", `<b>SHIPPED 2026-10-18 — this screen is now the record of what changed.</b> Drive <b>was</b> smaller, and equal <code>width</code>/<code>height</code> could not fix it. Every mark is drawn at a flat 66% of its box (<code>DivisionIcon.module.css</code> → <code>.art</code>), but Drive's artwork only fills <b>57.4%</b> of its own 512×512 canvas — the rest is transparent padding. Its ink therefore lands at 0.66 × 0.574 = <b>38%</b> of the box while its neighbours land near 64%.`)}
          <p class="note"><b>Measured, not estimated.</b> Each PNG's opaque bounding box was read from a Chromium canvas (<code>getImageData</code>, alpha &gt; 10). Drive 290×294 of 512×512 = 0.574. The other eleven sit between 0.949 and 0.990. <b>Learn is a second, milder outlier at 0.850</b> — the request named only Drive, but the same rule catches both.</p>
          <div class="cmp">
            ${col("now", "Before — one flat 66%", "Drive read as roughly 59% the size of its neighbours. Nothing was wrong with the file; the sizing rule ignored its padding.", `<div class="marks">
              ${each([peers[0], drive, peers[1], learn, peers[2]], (d) => `<div class="mk">${discNow(d)}<span class="mk-name">${esc(d.label)}</span><span class="mk-fig">ink ${(0.66 * d.fill * 100).toFixed(0)}%</span></div>`)}
            </div>`)}
            ${col("ship", "Shipped — size by ink, not by canvas", "Each mark is scaled so its <i>opaque</i> area is a constant share of the box. In the app this is <code>--division-art</code> in the one <code>[data-division]</code> map (drive 1.69, learn 1.14), applied as a <code>transform</code> and as <code>mask-size</code> across all five mark surfaces.", `<div class="marks">
              ${each([peers[0], drive, peers[1], learn, peers[2]], (d) => `<div class="mk">${discFixed(d)}<span class="mk-name">${esc(d.label)}</span><span class="mk-fig">ink 62%</span></div>`)}
            </div>`)}
          </div>
          <div class="sect">
            <p class="sect-h">All thirteen, normalised</p>
            ${markGrid(discFixed, (d) => `fill ${(d.fill * 100).toFixed(1)}%`)}
          </div>
          <p class="note"><b>One loose end worth your decision.</b> <code>booker/public/division-icons/</code> contains <code>EzzyDrive_site_Logo.png:Zone.Identifier</code> — a 25-byte Windows download marker — but <b>no <code>EzzyDrive_site_Logo.png</code></b>. It looks like a replacement Drive logo was copied in and the image itself did not land. If you meant to swap the asset, the scaling above may be solving a problem a better file would remove.</p>
        </div>`;
      },
    },

    {
      id: "ride",
      label: "3 · EzzyRide — the new asset, and what it breaks",
      render: () => {
        const ride = { slug: "ezzy-ride", name: "EzzyRide", label: "Ride", fill: 1.0 };
        const peer = DIVISIONS.find((d) => d.slug === "ezzy-court");
        return `<div class="pg">
          ${head("EzzyRide", `<b>SHIPPED 2026-10-18 — wired, and its disc problem fixed.</b> <b>The asset exists.</b> <code>booker/public/division-icons/ezzy-ride.png</code>, 256×256, added today. It is the only division that previously had no file, so booker renders the monogram <b>"ER"</b> for it everywhere.`)}
          <p class="note"><b>The trap this sat in, now closed.</b> A file on disk was never enough: <code>lib/divisionIcon.ts</code> resolves a bundled mark from a hardcoded <code>BUNDLED</code> set, and <code>ezzy-ride</code> was missing from it — so the PNG was added and <i>nothing changed on screen</i>. Adding a logo is two steps, and the second is a <b>code</b> change. The slug was wired in on 2026-10-18 and the set now carries all thirteen.</p>
          <div class="cmp">
            ${col("now", "Before — the monogram", "No file was resolvable, so the two-letter mark was what every surface drew.", `<div class="marks"><div class="mk">
              <span class="disc" data-division="ezzy-ride"><span class="ocard-badge-mono">ER</span></span>
              <span class="mk-name">Ride</span></div></div>`)}
            ${col("ship", "Shipped", "Resolved like every other division — and with our plate blanked, so its own disc takes the footprint instead of sitting inside a second one.", `<div class="marks"><div class="mk">${discFixed(ride)}<span class="mk-name">Ride</span></div></div>`)}
          </div>
          <p class="note"><b>⚠️ It is not shaped like the other twelve.</b> The other marks are loose line art on transparency — their opaque pixels fill 25–45% of the canvas. EzzyRide is a <b>solid blue disc, edge to edge, 79% ink</b>: its circle is baked into the file. So "the same treatment as the other divisions" does not transfer cleanly, and the three places it shows are three different problems.</p>
          <div class="cmp-3">
            ${col("bad", "Before — on our tinted plate", "A blue circle inside a pale blue one. On the Home tile this was a bullseye: an 84px pale circle around a 46px solid one.", `<div class="marks"><div class="mk">${discNow(ride)}<span class="mk-name">Ride</span></div><div class="mk">${discFixed(peer)}<span class="mk-name">${esc(peer.label)} (for comparison)</span></div></div>`)}
            ${col("ship", "Shipped — our plate blanked", "<code>--division-plate: transparent</code> plus <code>--division-art-box: 100%</code>, so the file\'s own disc takes the footprint our plate would have had. The tile still matches its neighbours instead of looking sparse.", `<div class="marks"><div class="mk">${discFixed(ride)}<span class="mk-name">Ride</span></div><div class="mk">${discFixed(peer)}<span class="mk-name">${esc(peer.label)} (for comparison)</span></div></div>`)}
            ${col("bad", "Before — mask-painted", "On the four mask surfaces the mask IS a filled disc, so the car and pin knocked out of it vanished and the chip became a featureless dot. Fixed by painting the real image under the mask (<code>--division-mark-art</code>).", `<div class="marks"><div class="mk">${bareMask(ride, "now")}<span class="mk-name">Ride (before)</span></div><div class="mk">${bareMask(ride)}<span class="mk-name">Ride (shipped)</span></div></div>`)}
          </div>
          <p class="note"><b>EzzyPark carries the same kind of baked-in background</b> — an opaque near-white rounded plate. ⚠️ <b>But it is NOT a visible defect in the app</b>, and an earlier version of this preview wrongly said it was: checked against the app's own dark baseline, the plate hides against the light tint it sits on, because <code>--division-tile</code> deliberately does not flip in dark mode. It becomes visible only if those tints are ever removed (F5), which is <b>parked</b>. Nothing was changed for Park.</p>
        </div>`;
      },
    },

    {
      id: "cards",
      label: "4 · Offering cards — photo, fallback, failure",
      render: () => `<div class="pg">
        ${head("Offering cards", `The rule you asked for: <b>use the uploaded photo when there is one; fall back to the division mark only when there is not</b>. Plus the logo-only badge inside the rounded image area.`)}
        <p class="note"><span class="demo-tag">Demo</span> &nbsp;The images below are <b>CSS gradients, not photographs</b>. They are here to test whether one badge treatment stays legible over a light, a dark and a busy image — they are not evidence that live photo data renders.</p>
        <div class="sect">
          <p class="sect-h">Same offering, both treatments</p>
          <div class="cmp">
            ${col("now", "Today", "An offering with a photo still shows it on the card surfaces that have the plumbing — but with no division mark anywhere on the image.", card(byId("o1"), { state: "photo", badge: false, size: "lg" }))}
            ${col("new", "Proposed", "Photo, plus the division's mark stamped bottom-right. <b>No division name</b> — the name stays on the search result's footer, which this preview leaves alone.", card(byId("o1"), { state: "photo", badge: true, size: "lg" }))}
          </div>
        </div>
        <div class="sect">
          <p class="sect-h">The badge over a light, a dark and a busy image</p>
          <div class="cmp-3">
            ${col("new", "Light image", "The plate's hairline border is what separates it from a pale photo.", card(byId("o1"), { state: "photo", badge: true }))}
            ${col("new", "Dark image", "The opaque plate is why a near-black mark survives here.", card(byId("o2"), { state: "photo", badge: true }))}
            ${col("new", "Busy image", "The worst case, and the reason the plate is opaque rather than a tint.", card(byId("o3"), { state: "photo", badge: true }))}
          </div>
        </div>
        <div class="sect">
          <p class="sect-h">No photo, and a photo that fails</p>
          <div class="cmp-3">
            ${col("now", "Fallback — today", "The division's mark on its tint. This is correct behaviour and stays.", card(byId("o4"), { state: "fallback", badge: false }))}
            ${col("new", "Fallback — proposed", "Unchanged. <b>The badge is deliberately absent</b>: stamping the mark onto an image that is already the mark would draw it twice.", card(byId("o4"), { state: "fallback", badge: false }))}
            ${col("bad", "Broken image — today", "A photo row exists but its file does not load. There is no <code>onerror</code> fallback, so the card shows an empty box rather than reverting to the division mark.", card(byId("o6"), { state: "broken", badge: true }))}
          </div>
        </div>
        <p class="note"><b>The reference, unchanged.</b> The search result's footer names the division beside its mark. The request points at it as the model for the <i>mark</i>, not as permission to change it — so it is shown here exactly as it ships:
          <span class="reffoot" data-division="ezzy-court" data-slug="ezzy-court"><span class="reffoot-mark"></span><span class="reffoot-n">Court</span></span>
        </p>
      </div>`,
    },

    {
      id: "popular",
      label: "5 · Popular this month — the reported case",
      render: () => `<div class="pg">
        ${head("Popular this month", `The section you reported: it shows a division logo even when the offering has an uploaded picture.`)}
        <p class="note"><b>⚠️ This is not a fallback bug — the photo is never asked for.</b> <code>PopularCardRow.tsx</code> takes <code>{ card, rank, onOpen }</code> and has <b>no photo prop at all</b>; <code>usePopularShelf</code> never calls <code>getCoverPhotos</code>. So the division mark is not losing a race with a missing image — the component cannot render a photo under any data. The same is true of <code>ShelfCard</code>, which draws <b>"Near you"</b> and <b>"Vendors in your city"</b>. Only <b>"Available today"</b> (<code>OpenTodayCard</code>) and the Explore result card fetch covers today.</p>
        <div class="cmp">
          ${col("now", "Today", "The mark on its tint, for every row, regardless of what the offering has uploaded.", `<div class="sect">
            ${popRow(byId("o1"), 1)}${popRow(byId("o2"), 2)}${popRow(byId("o3"), 3)}
          </div>`)}
          ${col("new", "Proposed", "Photo where one exists; the mark where none does. Rows 1–3 have photos; row 4 does not and is unchanged.", `<div class="sect">
            ${popRow(byId("o1"), 1, { photo: true })}${popRow(byId("o2"), 2, { photo: true })}${popRow(byId("o3"), 3, { photo: true })}${popRow(byId("o4"), 4, { photo: true })}
          </div>`)}
        </div>
        <p class="note"><b>What this costs, so the decision is informed.</b> Three surfaces need photo plumbing added — <code>PopularShelf</code>, <code>NearYouShelf</code> and the <code>ShelfCard</code> they share — each meaning a <code>getCoverPhotos</code> call in the hook and a new prop on the card. "Vendors in your city" is the odd one: its rows are <b>vendors</b>, not offerings, so there is no offering photo to fetch and it would keep the mark.</p>
      </div>`,
    },

    {
      id: "divisions",
      label: "6 · Browse by division — two rows, scrolling",
      render: () => `<div class="pg">
        ${head("Browse by division", `Two rows that scroll sideways, with a centred position indicator. <b>Drag it, flick it, or tab into it and use the arrow keys</b> — the dots below follow the real scroll position.`)}
        <p class="note"><b>⚠️ This reverses a decision the code records.</b> <code>HomePage.module.css:289</code> currently sets <code>repeat(4, …)</code> below 640px with the comment "<i>Four across on a phone, so every division is still visible without scrolling the grid</i>" — thirteen divisions in four rows, nothing hidden. The two-row scroller trades that for a shorter page, at the cost of putting roughly half the divisions off-screen behind a gesture. Worth confirming you want that trade before it is built.</p>
        <div class="sect">
          <p class="sect-h">The scroller</p>
          ${divisionStrip()}
        </div>
        <p class="note"><b>Reachability.</b> Every division stays reachable: the strip takes keyboard focus as one group and scrolls with the arrow keys, each tile is a real <code>&lt;button&gt;</code> in tab order, and the live region announces "page <i>n</i> of <i>m</i>" as it moves. The dots are a class toggle rather than a sliding bar — the preview's CSP blocks the inline style a continuously-positioned thumb would need.</p>
        <p class="note"><b>Above 640px nothing changes.</b> The wider layout keeps today's wrapping grid — <code>repeat(auto-fill, minmax(128px, 1fr))</code>. Resize this window past 640px to confirm the desktop arrangement is untouched.</p>
      </div>`,
      mount: mountStrip,
    },

    {
      id: "home",
      label: "7 · Home — everything together",
      render: () => shell(`
        ${head("Home", `Every change at once, in place. <b>Narrow the window past 640px</b> and the four tabs move from under the top bar to a fixed bottom bar.`)}
        <div class="sect">
          <p class="sect-h">Browse by division</p>
          ${divisionStrip()}
        </div>
        <div class="sect">
          <p class="sect-h">Near you · Davao City</p>
          <div class="cmp-3">
            ${card(byId("o1"), { state: "photo", badge: true })}
            ${card(byId("o4"), { state: "fallback", badge: false })}
            ${card(byId("o3"), { state: "photo", badge: true })}
          </div>
        </div>
        <div class="sect">
          <p class="sect-h">Popular this month</p>
          ${popRow(byId("o2"), 1, { photo: true })}
          ${popRow(byId("o5"), 2, { photo: true })}
        </div>
        <div class="sect">
          <p class="sect-h">Available today</p>
          <div class="cmp-3">
            ${card(byId("o6"), { state: "photo", badge: true })}
            ${card(byId("o5"), { state: "fallback", badge: false })}
          </div>
        </div>
        <p class="note"><span class="demo-tag">Demo</span> &nbsp;Images are CSS gradients. Vendors, prices and booking counts are invented.</p>
      `, { active: "home", bottomnav: true }),
      mount: mountStrip,
    },
  ];
})();
