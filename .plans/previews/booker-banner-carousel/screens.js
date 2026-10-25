/*
 * booker-banner-carousel — the screens. THIS FILE IS THE WORK; everything else is scaffolding.
 *
 * Previews `prototypes/prompts/2026-10-24-booker-banner-carousel.md` for
 * `.plans/2026-10-24-booker-banner-carousel.md`: a promotional banner carousel placed directly
 * under "Browse by division" on Booker's Home.
 *
 * ⚠️ THE HOME PAGE AROUND THE CAROUSEL IS A RECONSTRUCTION, not a screenshot. Hero, division
 * shelf and the next shelf copy the values in `booker/components/home/{HomePage,HomeSection,
 * DivisionStrip}/*.module.css` as of 2026-10-24 (after the 2026-10-23 spacing plan shipped).
 * The committed baselines `booker/visual-tests/pilot.spec.ts-snapshots/home-*.png` are the
 * real screens. Only the carousel (`.pc*`) is the proposal.
 *
 * ⚠️ `@container`, NOT `@media`, for the page frame. The app switches at `@media (max-width:
 * 640px)`; here each frame is its own inline-size container, so a 320px frame can sit beside a
 * 1080px one on one screen and still take the phone rules. The carousel itself has NO
 * breakpoint at all — that is the design (plan D2): one aspect ratio, one control row.
 *
 * ⚠️ LINKS ARE INERT. Every banner carries its real `href`/`target`/`rel`, so hovering shows the
 * intended destination, but `mount()` cancels the click and prints what WOULD happen. The
 * destinations are `example.com` (RFC 2606 reserved) placeholders, not partner URLs.
 *
 * Fixtures are INVENTED. Artwork in `./art/` is labelled "ILLUSTRATIVE PLACEHOLDER" in the image
 * itself. Division slugs/labels are booker's own (`lib/divisions.ts`); no vendor or customer rows.
 */
"use strict";

(function () {
  const { esc, icon, each } = window.PV;

  /* The plan's example `promoSlides.json`, verbatim in shape — `id`, `imageSrc`, `alt`, `href`. */
  const SLIDES = [
    { id: "court-weekend-2026-11", imageSrc: "./art/promo-a.svg",
      alt: "Weekend court rates from a partner venue — see the offer", href: "https://example.com/promos/court-weekend?utm_source=ezzy-booker" },
    { id: "pet-grooming-week", imageSrc: "./art/promo-b.svg",
      alt: "Pet grooming week — browse participating groomers", href: "https://example.com/promos/pet-grooming" },
    { id: "home-cleaning-bundle", imageSrc: "./art/promo-c.svg",
      alt: "Home cleaning bundle — read the seasonal offer", href: "https://example.com/promos/home-cleaning" },
  ];

  /* Twelve records: enough to prove the indicator switches from dots to a counter (MAX_DOTS 5). */
  const MANY = Array.from({ length: 12 }, (_, i) => {
    const s = SLIDES[i % 3];
    return { ...s, id: `${s.id}-${i + 1}`, alt: `${s.alt} (example ${i + 1} of 12)` };
  });

  const MAX_DOTS = 5;

  const DIVISIONS = [
    ["ezzy-court", "Court"], ["ezzy-care", "Care"], ["ezzy-well", "Well"], ["ezzy-drive", "Drive"],
    ["ezzy-pets", "Pets"], ["ezzy-food", "Food"], ["ezzy-home", "Home"], ["ezzy-ride", "Ride"],
    ["ezzy-learn", "Learn"], ["ezzy-stay", "Stay"], ["ezzy-work", "Work"], ["ezzy-park", "Park"],
    ["ezzy-law", "Law"],
  ];

  /* ── The proposal: PromoCarousel ─────────────────────────────────────────────────────── */

  /*
   * One slide. `failed` renders the image-failure fallback the real hook switches to on the
   * <img>'s `error` event: the same box, the alt text, and the SAME link — the destination is
   * still valid even when the artwork is not.
   */
  const slide = (s, i, n, { failed = false } = {}) => `
    <div class="pc-slide"${n > 1 ? ` role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}"` : ""}
      aria-hidden="${i === 0 ? "false" : "true"}">
      <a class="pc-link${failed ? " pc-fallback" : ""}" href="${esc(s.href)}" target="_blank" rel="noopener noreferrer"
        data-dest="${esc(s.href)}"${i === 0 ? "" : ' tabindex="-1"'}>
        ${failed
          ? `<span class="pc-fb">${icon("image", 22)}<span class="pc-fb-text">${esc(s.alt)}</span></span>`
          : `<img class="pc-img" src="${esc(s.imageSrc)}" alt="${esc(s.alt)}" width="1800" height="600" decoding="async">`}
        <span class="pc-sr">(opens in a new tab)</span>
      </a>
    </div>`;

  /*
   * The carousel. Zero slides → "" (the page closes the gap; no empty block). One slide → a
   * plain linked banner: no carousel role, no controls, no indicator.
   */
  let uid = 0;
  const carousel = (slides, { failIndex = -1, autoplayMock = false } = {}) => {
    const n = slides.length;
    if (n === 0) return "";
    const id = `pc-${++uid}`;
    const track = `<div class="pc-track" id="${id}">${each(slides, (s, i) => slide(s, i, n, { failed: i === failIndex }))}</div>`;
    if (n === 1) return `<section class="pc" aria-label="Promotion">${track}</section>`;
    const pos = n <= MAX_DOTS
      ? `<span class="pc-dots" aria-hidden="true">${each(slides, (_, i) => `<span class="pc-dot${i === 0 ? " is-on" : ""}"></span>`)}</span>`
      : `<span class="pc-count" aria-hidden="true">1 / ${n}</span>`;
    return `
      <section class="pc" aria-roledescription="carousel" aria-label="Promotions" data-count="${n}">
        ${track}
        <div class="pc-controls">
          ${autoplayMock ? `<button type="button" class="pc-btn pc-play" aria-label="Pause promotions">${PAUSE}</button>` : ""}
          <button type="button" class="pc-btn" data-dir="-1" aria-controls="${id}" aria-label="Previous promotion" aria-disabled="true">${icon("left", 18)}</button>
          ${pos}
          <button type="button" class="pc-btn" data-dir="1" aria-controls="${id}" aria-label="Next promotion" aria-disabled="false">${icon("right", 18)}</button>
        </div>
        <span class="pc-sr pc-live" role="status" aria-live="polite"></span>
      </section>`;
  };

  const PAUSE = '<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';

  /*
   * The behaviour `usePromoCarousel` will own, sketched in plain DOM so the preview slides.
   * Native scroll-snap does the swiping (vertical page scroll is never captured); this only
   * keeps index ↔ scroll position, the hidden-slide tab order, the indicator and the live text
   * in step. No `style` is ever written (CSP) — state is attributes and classes.
   */
  function wireCarousel(el, reduce) {
    const track = el.querySelector(".pc-track");
    const slides = Array.from(track.children);
    const n = slides.length;
    if (n < 2) return;
    const prev = el.querySelector('[data-dir="-1"]');
    const next = el.querySelector('[data-dir="1"]');
    const dots = el.querySelectorAll(".pc-dot");
    const count = el.querySelector(".pc-count");
    const live = el.querySelector(".pc-live");
    let index = 0;
    let pending = null;
    let pendingTimer = 0;
    const clamp = (i) => Math.max(0, Math.min(n - 1, i));

    function apply(announce) {
      slides.forEach((s, i) => {
        const on = i === index;
        s.setAttribute("aria-hidden", on ? "false" : "true");
        s.querySelector("a").tabIndex = on ? 0 : -1;
      });
      prev.setAttribute("aria-disabled", String(index === 0));
      next.setAttribute("aria-disabled", String(index === n - 1));
      dots.forEach((d, i) => d.classList.toggle("is-on", i === index));
      if (count) count.textContent = `${index + 1} / ${n}`;
      if (announce) live.textContent = `Promotion ${index + 1} of ${n}`;
    }

    function go(i, focus) {
      const target = clamp(i);
      if (target === index) return;
      index = target;
      pending = target;
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => { pending = null; }, 700);
      track.scrollTo({ left: target * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
      apply(true);
      if (focus) slides[target].querySelector("a").focus({ preventScroll: true });
    }

    /* A swipe (or trackpad scroll) moves the index; a programmatic scroll passing through the
       slides in between must not announce each of them. */
    track.addEventListener("scroll", () => {
      const at = clamp(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
      if (pending !== null) { if (at === pending) pending = null; return; }
      if (at !== index) { index = at; apply(true); }
    }, { passive: true });

    [prev, next].forEach((b) => b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled") === "true") return; // aria-disabled keeps focus on the button
      go(index + Number(b.dataset.dir), false);
    }));

    track.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      go(index + (e.key === "ArrowRight" ? 1 : -1), true);
    });

    /* A width change (rotation, window resize, the 640px crossing) re-pins the current slide,
       so the track never rests between two banners. */
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        if (!track.isConnected) { ro.disconnect(); return; }
        track.scrollLeft = index * track.clientWidth;
      });
      ro.observe(track);
    }
    apply(false);
  }

  /* Inert links: show the destination, never navigate. */
  function wireLinks(root) {
    const out = root.querySelector(".pv-dest");
    const stop = (e) => {
      const a = e.target.closest("a[data-dest]");
      if (!a) return;
      e.preventDefault();
      if (out) out.textContent = `Would open ${a.dataset.dest} in a new tab (target="${a.target}", rel="${a.rel}"). Not navigated: preview links are inert.`;
    };
    root.addEventListener("click", stop);
    root.addEventListener("auxclick", stop);
  }

  function mountAll(root) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.querySelectorAll(".pc").forEach((el) => wireCarousel(el, reduce));
    wireLinks(root);
  }

  /* ── The page around it (reconstruction) ─────────────────────────────────────────────── */

  const hero = () => `
    <section class="hero">
      <div><h1 class="heading">What do you need today?</h1>
        <p class="sub">Pick a division below, or search a service or vendor by name.</p></div>
      <div class="search"><span class="searchPh">Search a service or vendor</span><span class="searchGo">${icon("search", 16)}</span></div>
      <span class="chip">${icon("pin", 14)}<span class="place">Makati City</span><span class="cdot">·</span><span>Change</span></span>
    </section>`;

  const divisions = () => `
    <section class="sec" data-tone="divisions" aria-label="Browse by division">
      <div class="db-shelf-head head"><span class="db-shelf-pipe"></span>
        <h2 class="title">Browse by division</h2><span class="meta">Every category we book for</span>
        <span class="spacer"></span><span class="link">Open Explore</span></div>
      <div class="body"><div class="strip">${each(DIVISIONS, ([slug, label]) => `
        <span class="tile"><span class="tileIcon"><img src="./logos/${slug}.png" alt=""></span><span class="tileName">${label}</span></span>`)}
      </div><div class="sdots" aria-hidden="true"><span class="sdot is-on"></span><span class="sdot"></span></div></div>
    </section>`;

  const nextShelf = () => `
    <section class="sec" data-tone="near" aria-label="Near you">
      <div class="db-shelf-head head"><span class="db-shelf-pipe"></span>
        <h2 class="title">Near you</h2><span class="spacer"></span><span class="link">See all</span></div>
      <div class="body"><div class="nextStub"></div></div>
    </section>`;

  const page = (slides, opts) => `<div class="hp">${hero()}${divisions()}${carousel(slides, opts)}${nextShelf()}</div>`;

  const intro = (h, s) => `<header class="pg"><h1 class="pg-h">${esc(h)}</h1><p class="pg-s">${s}</p></header>`;
  const dest = () => `<p class="pv-dest" role="status">Preview: banner links are inert — click one to see where it would go.</p>`;
  const tag = (t, cls = "") => `<span class="tag ${cls}">${esc(t)}</span>`;

  /* ── Screens ─────────────────────────────────────────────────────────────────────────── */

  const WIDTHS = [320, 360, 390, 768, 1080];

  window.PREVIEW_SCREENS = [
    {
      id: "home",
      label: "1 · Home — the carousel under “Browse by division”",
      render: () => `
        ${PVA.topbar({ search: false })}
        ${intro("Promotions carousel, in place",
          "Three slides from the example JSON. Swipe (touch or trackpad), use ‹ ›, or focus a banner and press ← →. Artwork is an <b>illustrative placeholder</b> at the recommended 3:1. Only the banner block is proposed; the page around it is a reconstruction.")}
        <div class="hp-frame">${page(SLIDES)}</div>
        ${dest()}`,
      mount: mountAll,
    },
    {
      id: "widths",
      label: "2 · Widths — 320 → 1080, one ratio, no breakpoint",
      render: () => `
        ${intro("One component at every width",
          "Each frame is a viewport width; the banner is that width minus AppShell's 20px padding each side, at 3:1. Heights below are measured live from the rendered box, not typed in. On a narrow window the wider frames shrink to fit — the measurement follows.")}
        <div class="wf-grid">${each(WIDTHS, (w) => `
          <figure class="wf" data-w="${w}">
            <figcaption class="wf-cap"><b>${w}px viewport</b> · banner <span data-m="${w}">…</span></figcaption>
            <div class="hp-frame"><div class="hp hp-tight">${carousel(SLIDES)}</div></div>
          </figure>`)}
        </div>
        ${dest()}`,
      mount: (root) => {
        mountAll(root);
        root.querySelectorAll(".wf").forEach((f) => {
          const r = f.querySelector(".pc-track").getBoundingClientRect();
          const out = f.querySelector("[data-m]");
          out.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}px + 52px controls`;
        });
      },
    },
    {
      id: "states",
      label: "3 · States — zero, one, many, image failed, off-ratio",
      render: () => `
        ${intro("Slide-count and failure states",
          "Every state keeps the same reserved 3:1 box, so nothing below it moves when images load or fail.")}
        <div class="st-grid">
          <figure class="st">${tag("0 slides")}
            <figcaption class="st-cap">Renders nothing. “Browse by division” is followed directly by the next shelf at Home's usual 18px gap — no empty promotional block.</figcaption>
            <div class="hp-frame"><div class="hp hp-tight"><div class="stub-sec">Browse by division</div>${carousel([])}<div class="stub-sec">Near you</div></div></div>
          </figure>
          <figure class="st">${tag("1 slide")}
            <figcaption class="st-cap">A single linked banner. No ‹ ›, no indicator, no carousel role — nothing to navigate.</figcaption>
            <div class="hp-frame"><div class="hp hp-tight">${carousel(SLIDES.slice(0, 1))}</div></div>
          </figure>
          <figure class="st">${tag("12 slides")}
            <figcaption class="st-cap">Above ${MAX_DOTS} slides the dots become a “1 / 12” counter, so the row never outgrows a 320px phone. Working.</figcaption>
            <div class="hp-frame"><div class="hp hp-tight">${carousel(MANY)}</div></div>
          </figure>
          <figure class="st">${tag("Image failed")}
            <figcaption class="st-cap">Slide 1's artwork failed to load: the box keeps its size and shows the alt text. The link still works — the destination is valid even when the image is not.</figcaption>
            <div class="hp-frame"><div class="hp hp-tight">${carousel(SLIDES, { failIndex: 0 })}</div></div>
          </figure>
          <figure class="st">${tag("Off-ratio artwork")}
            <figcaption class="st-cap">A 4:3 upload is shown <b>whole</b> (<code>object-fit: contain</code>), letterboxed on the section tint — never cropped. Correct artwork (3:1) fills the box exactly.</figcaption>
            <div class="hp-frame"><div class="hp hp-tight">${carousel([{ ...SLIDES[0], id: "off", imageSrc: "./art/promo-offratio.svg", alt: "Off-ratio example artwork" }, SLIDES[1]])}</div></div>
          </figure>
          <figure class="st">${tag("Only if D1 = autoplay", "tag-alt")}
            <figcaption class="st-cap">Not recommended. If autoplay is chosen, a Pause/Play control leads the row; rotation also pauses on hover, focus and hidden tabs, and never runs under reduced motion. Static mock.</figcaption>
            <div class="hp-frame"><div class="hp hp-tight">${carousel(SLIDES, { autoplayMock: true })}</div></div>
          </figure>
        </div>
        ${dest()}`,
      mount: mountAll,
    },
    {
      id: "links",
      label: "4 · Destinations — what each banner opens (inert)",
      render: () => `
        ${intro("Configured destinations",
          "What the example JSON would render. These values are checked here as text; in the preview the anchors never navigate. In the app the same attributes come from <code>PromoCarousel.tsx</code>, matching booker's existing external links (<code>LegalLinks</code>, directions links).")}
        <div class="lk-wrap"><table class="lk">
          <thead><tr><th>#</th><th>id</th><th>Accessible name (alt)</th><th>href</th><th>Opens</th><th>rel</th></tr></thead>
          <tbody>${each(SLIDES, (s, i) => `
            <tr><td>${i + 1}</td><td><code>${esc(s.id)}</code></td><td>${esc(s.alt)} <i>(opens in a new tab)</i></td>
              <td><code>${esc(s.href)}</code></td><td>New tab</td><td><code>noopener noreferrer</code></td></tr>`)}
          </tbody>
        </table></div>
        <h2 class="pg-h2">Example <code>booker/lib/promoSlides.json</code></h2>
        <pre class="json">${esc(JSON.stringify(SLIDES.map((s) => ({ ...s, imageSrc: s.imageSrc.replace("./art/promo-", "/promos/").replace(".svg", "-v1.jpg") })), null, 2))}</pre>
        <p class="pg-s pg-note">Image paths in the JSON are the app's (<code>/promos/…-v1.jpg</code>, versioned — see plan F2); the preview loads its own local placeholders.</p>`,
    },
  ];
})();
