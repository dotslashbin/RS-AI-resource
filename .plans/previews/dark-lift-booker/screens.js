/*
 * dark-lift-booker — booker Home, rendered under four dark palettes.
 *
 * Every screen is the SAME markup. Only the `data-opt` on the wrapper changes, and
 * `preview.css` maps each value onto a set of `--db-*` overrides under `.dark` — so light mode
 * is identical in all four on purpose (this proposal changes dark only).
 *
 * ⚠️ The division tile row is here because it is the one place the proposal can break
 * something: the tile LABELS sit on the page and were derived to clear 4.5:1 against the
 * CURRENT dark page with almost no headroom. Lightening the page (A, C) drops five of them
 * under. Each tile shows its measured ratio so the cost is visible, not buried in the README.
 *
 * Fixtures are INVENTED — no real vendor, customer or booking rows.
 */
"use strict";

(function () {
  const { esc, each, icon, button } = window.PV;

  const OPTIONS = [
    { id: "current", label: "Current · as shipped",
      title: "Current — as shipped",
      note: "Cards are 2.8% white over the page: 1.05:1 against it. Containers read as outlines only." },
    { id: "a", label: "A · Brighter base",
      title: "Option A — brighter base",
      note: "Every surface one step lighter; cards stay translucent. Card vs page 1.08:1. Five tile labels fall under 4.5:1 (marked ✗)." },
    { id: "b", label: "B · Lifted containers (recommended)",
      title: "Option B — lifted containers · recommended",
      note: "Page unchanged, so every tile label keeps its ratio. Cards and panels become opaque, lighter surfaces. Card vs page 1.13:1, panels 1.25:1." },
    { id: "c", label: "C · Brighter base + lifted containers (chosen)",
      title: "Option C — brighter base + lifted containers · chosen 2026-10-21",
      note: "Page one step lighter; cards a stronger see-through white (5.5%), so the offering cards inside the shelf stay lighter than the well they sit in. Card vs page 1.13:1, panels 1.29:1. Five tile labels nudged lighter (marked ↑)." },
    { id: "c-solid", label: "C with solid cards · rejected (plan B1)",
      title: "Option C with solid cards — rejected, kept as the record of plan B1",
      note: "As first previewed: opaque #161e31 cards. Look inside the Popular shelf — the offering cards are DARKER than the well around them, so the nesting reads inverted." },
  ];

  /* Ratio of each label on the option's page, worst gradient stop — from
     `.plans/scripts/dark-lift-contrast.mjs`. `c` is after the retune; `fix` marks a retuned label.
     `c-solid` shares C's page and labels, so it reads `c`'s numbers. */
  const TILES = [
    { slug: "court", name: "EzzyCourt", m: "C", r: { current: 4.53, a: 4.27, b: 4.53, c: 4.56 }, fix: true },
    { slug: "care",  name: "EzzyCare",  m: "C", r: { current: 4.58, a: 4.32, b: 4.58, c: 4.60 }, fix: true },
    { slug: "drive", name: "EzzyDrive", m: "D", r: { current: 4.55, a: 4.29, b: 4.55, c: 4.58 }, fix: true },
    { slug: "learn", name: "EzzyLearn", m: "L", r: { current: 4.58, a: 4.32, b: 4.58, c: 4.56 }, fix: true },
    { slug: "home",  name: "EzzyHome",  m: "H", r: { current: 4.52, a: 4.26, b: 4.52, c: 4.61 }, fix: true },
    { slug: "pets",  name: "EzzyPets",  m: "P", r: { current: 6.95, a: 6.55, b: 6.95, c: 6.70 }, fix: false },
  ];

  const OFFERS = [
    { title: "Badminton court · 1 h", vendor: "Sample Sports Hub", code: "BDM", price: "₱350" },
    { title: "Home deep clean", vendor: "Tidy Corner", code: "RENTAL", price: "₱1,800" },
    { title: "Dog grooming", vendor: "Paws & Co.", code: "GRM", price: "₱650" },
  ];

  /*
   * The Popular shelf as the app builds it — NOT `PVA.shelf`, which draws only the heading band.
   * `HomeSection` (booker/components/home/HomeSection) is a card holding a heading and a
   * recessed `--db-sub-bg` well; `PopularCardRow` cards sit in the well and read `--db-card-bg`
   * again. That card-in-a-card is what plan B1 is about, so the preview has to draw it.
   */
  const popularShelf = () => `
    <section class="dl-section" aria-labelledby="shelf-popular">
      <div class="db-shelf-head dl-section-head">
        <span class="db-shelf-pipe" aria-hidden="true"></span>
        <h2 id="shelf-popular" class="dl-section-title">Popular this month</h2>
        <span class="dl-section-meta">Most booked in Davao City</span>
        <span class="dl-spacer"></span>
        <button type="button" class="dl-link">See all</button>
      </div>
      <div class="dl-section-body">
        <div class="dl-pop">
          ${each(OFFERS, (o, i) => `
            <article class="dl-pop-card">
              <span class="dl-pop-art" aria-hidden="true">${esc(o.code)}</span>
              <span class="dl-pop-body">
                <span class="dl-pop-title"><span class="dl-pop-rank">${i + 1}</span>${esc(o.title)}</span>
                <span class="dl-pop-vendor">${esc(o.vendor)}</span>
                <span class="dl-pop-price">${esc(o.price)}</span>
              </span>
            </article>`)}
        </div>
      </div>
    </section>`;

  const banner = (o) => `
    <div class="dl-banner" role="note">
      <p class="dl-banner-title">${esc(o.title)}</p>
      <p class="dl-banner-note">${esc(o.note)} Light mode is unchanged in every option.</p>
    </div>`;

  const tile = (t, opt) => {
    const key = opt === "c-solid" ? "c" : opt;
    const r = t.r[key];
    const mark = r < 4.5 ? " ✗" : key === "c" && t.fix ? " ↑" : "";
    return `
      <div class="dl-tile" data-label="${esc(t.slug)}">
        <span class="dl-tile-box" aria-hidden="true">${esc(t.m)}</span>
        <span class="dl-tile-name">${esc(t.name)}</span>
        <span class="dl-tile-ratio" data-fail="${r < 4.5}">${r.toFixed(2)}:1${mark}</span>
      </div>`;
  };

  const nextBooking = () => `
    <article class="db-card dl-next">
      <div class="dl-card-head">
        <p class="dl-card-title">Your next booking</p>
        <span class="dl-badge" data-st="confirmed">Confirmed</span>
      </div>
      <p class="dl-next-what">Badminton court · 1 h</p>
      <p class="dl-next-who">Sample Sports Hub · Court 2</p>
      <div class="db-sub dl-sub">
        <p><span>${icon("cal", 13)} Sat 24 Oct</span><b>6:00 – 7:00 PM</b></p>
        <p><span>Paid</span><b>₱350.00</b></p>
      </div>
      <div class="dl-actions">${button("Reschedule")}${button("View booking", { primary: true })}</div>
    </article>`;

  const panel = () => `
    <div class="db-panel dl-panel" role="menu" aria-label="Account menu (sample)">
      <p class="dl-card-title">Signed in as Ana R.</p>
      <p class="dl-panel-item">Wallet balance · ₱1,240.00</p>
      <p class="dl-panel-item">2 documents awaiting upload</p>
    </div>`;

  const body = (o) => `
    ${PVA.topbar()}
    ${PVA.tabs("home")}
    <main class="dl-main">
      ${banner(o)}
      <h1 class="dl-hello">Good evening, Ana</h1>
      ${PVA.locationChip("Davao City")}
      <div class="dl-tiles">${each(TILES, (t) => tile(t, o.id))}</div>
      ${popularShelf()}
      <div class="dl-grid">
        <div class="dl-col">${nextBooking()}</div>
        <div class="dl-col dl-col-side">${panel()}</div>
      </div>
    </main>`;

  window.PREVIEW_SCREENS = OPTIONS.map((o) => ({
    id: o.id,
    label: o.label,
    render: () => `<div class="db-page dl" data-opt="${o.id}">${body(o)}</div>`,
  }));
})();
