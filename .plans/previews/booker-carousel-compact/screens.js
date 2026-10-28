/*
 * booker-carousel-compact — the screens. THIS FILE IS THE WORK; everything else is scaffolding.
 *
 * Previews `.plans/2026-10-28-booker-carousel-compact-autoplay.md`: smaller controls for Home's
 * promotions carousel, plus autoplay (one slide every 2 seconds, read from `promoSlides.json`).
 *
 * ⚠️ THE PAGE AROUND THE CAROUSEL IS A RECONSTRUCTION. Only the carousel's control treatment is
 * the proposal. The "current" screen copies `booker/components/home/PromoCarousel/
 * PromoCarousel.module.css` as of 2026-10-28 (44px round buttons, 8px gap, dots between).
 *
 * ⚠️ AUTOPLAY RUNS ONLY WHEN YOU OPEN THE FILE. `mount()` skips it under `?chrome=off` (how the
 * runner shoots), so contact sheets are stable and show slide 1. Hover, keyboard focus or the
 * pause button stop it; reduced motion never starts it — the same rules the plan gives the hook.
 *
 * ⚠️ LINKS ARE INERT: `mount()` cancels the click. Destinations are example.com placeholders.
 * Fixtures are INVENTED; the artwork says "ILLUSTRATIVE PLACEHOLDER" in the image itself.
 */
"use strict";

(function () {
  const { esc, each } = window.PV;

  const SLIDES = [
    { id: "court", art: "a", alt: "Weekend court rates — see the offer", href: "https://example.com/promos/court" },
    { id: "pets", art: "b", alt: "Pet grooming week — browse groomers", href: "https://example.com/promos/pets" },
    { id: "home", art: "c", alt: "Home cleaning bundle — read the offer", href: "https://example.com/promos/home" },
  ];

  /* Lucide paths (chevron-left/right, pause, play), the set booker already ships. */
  const svg = (paths, size) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICON = {
    prev: '<path d="m15 18-6-6 6-6"/>',
    next: '<path d="m9 18 6-6-6-6"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  };

  const slide = (s, i) => `
    <div class="cc-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${SLIDES.length}"
      aria-hidden="${i === 0 ? "false" : "true"}">
      <a class="cc-link" href="${esc(s.href)}" target="_blank" rel="noopener noreferrer"${i === 0 ? "" : ' tabindex="-1"'}>
        <picture class="cc-picture">
          <source media="(max-width: 640px)" srcset="./art/promo-${s.art}-mobile.svg">
          <img class="cc-img" src="./art/promo-${s.art}.svg" alt="${esc(s.alt)}" width="1800" height="600">
        </picture>
      </a>
    </div>`;

  const dots = (cls = "") => `
    <span class="cc-dots ${cls}" aria-hidden="true">
      ${each(SLIDES, (_, i) => `<span class="cc-dot${i === 0 ? " is-on" : ""}"></span>`)}
    </span>`;

  /* Every control's HIT AREA is 44×44 (ux-design §5, runner check 5); `.cc-face` is what you see. */
  const btn = (kind, label, cls, iconSize = 16) => `
    <button type="button" class="cc-btn ${cls}" data-act="${kind}" aria-label="${esc(label)}"
      ${kind === "pause" ? 'aria-pressed="false"' : ""}${kind === "prev" ? ' aria-disabled="false"' : ""}>
      <span class="cc-face">${svg(ICON[kind], iconSize)}</span>
    </button>`;

  const pauseBtn = (cls) => btn("pause", "Pause promotions", cls);

  /* The variants. Each returns the controls markup and where it sits. */
  const VARIANTS = {
    current: () => `
      <div class="cc-row cc-row-current">
        <button type="button" class="cc-round" data-act="prev" aria-label="Previous promotion">${svg(ICON.prev, 18)}</button>
        ${dots()}
        <button type="button" class="cc-round" data-act="next" aria-label="Next promotion">${svg(ICON.next, 18)}</button>
      </div>`,
    overlay: () => `
      ${btn("prev", "Previous promotion", "cc-edge cc-edge-l")}
      ${btn("next", "Next promotion", "cc-edge cc-edge-r")}
      <div class="cc-pill">${pauseBtn("cc-in-pill")}${dots("cc-dots-light")}</div>`,
    slim: () => `
      ${btn("prev", "Previous promotion", "cc-edge cc-edge-l")}
      ${btn("next", "Next promotion", "cc-edge cc-edge-r")}
      ${pauseBtn("cc-corner")}`,
    corner: () => `
      <div class="cc-pill cc-pill-corner">
        ${btn("prev", "Previous promotion", "cc-in-pill")}
        ${dots("cc-dots-light")}
        ${pauseBtn("cc-in-pill")}
        ${btn("next", "Next promotion", "cc-in-pill")}
      </div>`,
  };

  /*
   * One carousel. Overlay controls sit in `.cc-stage` (positioned over the art); the "current"
   * row and the slim dot strip sit BELOW it — that is the space being measured.
   */
  const carousel = (variant) => `
    <section class="cc-carousel" data-variant="${variant}" aria-roledescription="carousel" aria-label="Promotions">
      <div class="cc-stage">
        <div class="cc-track">${each(SLIDES, slide)}</div>
        ${variant === "current" ? "" : VARIANTS[variant]()}
      </div>
      ${variant === "current" ? VARIANTS.current() : ""}
      ${variant === "slim" ? `<div class="cc-strip">${dots()}</div>` : ""}
      <span class="cc-sr" role="status" aria-live="polite"></span>
    </section>`;

  const NOTES = {
    current: ["Today", "52px under the banner: two 44px round buttons and the dots, 8px gap."],
    overlay: ["A · Overlay", "0px added. ‹ › on the art's side edges; pause + dots in a small pill, bottom centre."],
    slim: ["B · Slim strip", "≈14px added: dots only under the banner. ‹ › on the edges, pause in the top-right corner."],
    corner: ["C · Corner pill", "0px added. Every control in one pill in the bottom-right corner of the art."],
  };

  const page = (variant) => `
    ${PVA.topbar({ search: false })}
    ${PVA.tabs("home")}
    <main class="cc-page">
      <div class="db-card cc-hero"><div class="db-input cc-search">Search offerings or vendors</div></div>
      ${carousel(variant)}
      <p class="cc-note"><strong>${esc(NOTES[variant][0])}</strong> — ${esc(NOTES[variant][1])}</p>
      ${PVA.shelf("Browse by division", "", `<div class="cc-tiles">${each([1, 2, 3, 4, 5, 6], () => '<span class="cc-tile"></span>')}</div>`)}
    </main>`;

  /* ── Autoplay + controls, for the file:// review only ──────────────────────────────────── */
  const INTERVAL_MS = 2000; // the plan's `autoplaySeconds: 2` (D4)
  const mount = (root) => {
    const section = root.querySelector(".cc-carousel");
    const track = root.querySelector(".cc-track");
    const live = root.querySelector(".cc-sr");
    if (!section || !track) return;
    let index = 0;
    let paused = false;
    let hovering = false;
    let focused = false;

    const render = () => {
      root.querySelectorAll(".cc-dots").forEach((d) =>
        d.querySelectorAll(".cc-dot").forEach((dot, i) => dot.classList.toggle("is-on", i === index)));
      track.querySelectorAll(".cc-slide").forEach((s, i) => {
        s.setAttribute("aria-hidden", String(i !== index));
        const a = s.querySelector("a");
        if (i === index) a.removeAttribute("tabindex"); else a.setAttribute("tabindex", "-1");
      });
    };
    const goTo = (next, { announce }) => {
      index = (next + SLIDES.length) % SLIDES.length;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      track.scrollTo({ left: index * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
      render();
      /* Autoplay does NOT announce: a live region firing every second is noise (plan I3). */
      if (announce) live.textContent = `Promotion ${index + 1} of ${SLIDES.length}`;
    };
    const setPaused = (p) => {
      paused = p;
      root.querySelectorAll('[data-act="pause"]').forEach((b) => {
        b.setAttribute("aria-pressed", String(p));
        b.setAttribute("aria-label", p ? "Play promotions" : "Pause promotions");
        b.querySelector(".cc-face").innerHTML = svg(p ? ICON.play : ICON.pause, 16);
      });
    };

    section.addEventListener("click", (e) => {
      if (e.target.closest("a")) { e.preventDefault(); return; }
      const b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "pause") setPaused(!paused);
      /* A manual move stops autoplay for good — the booker has taken over. */
      if (b.dataset.act === "prev") { setPaused(true); goTo(index - 1, { announce: true }); }
      if (b.dataset.act === "next") { setPaused(true); goTo(index + 1, { announce: true }); }
    });
    section.addEventListener("pointerenter", () => { hovering = true; });
    section.addEventListener("pointerleave", () => { hovering = false; });
    section.addEventListener("focusin", () => { focused = true; });
    section.addEventListener("focusout", (e) => { focused = section.contains(e.relatedTarget); });

    const shooting = new URLSearchParams(location.search).get("chrome") === "off";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (shooting) return;
    if (reduce) { setPaused(true); return; }
    const timer = window.setInterval(() => {
      if (!document.contains(section)) { window.clearInterval(timer); return; }
      if (paused || hovering || focused || document.hidden) return;
      goTo(index + 1, { announce: false });
    }, INTERVAL_MS);
  };

  window.PREVIEW_SCREENS = [
    { id: "current", label: "Today · controls row under the banner (reference)", render: () => page("current"), mount },
    { id: "overlay", label: "A · Overlay: edge arrows + pause/dots pill", render: () => page("overlay"), mount },
    { id: "slim", label: "B · Slim strip: dots under, arrows + pause on the art", render: () => page("slim"), mount },
    { id: "corner", label: "C · Corner pill: all controls bottom-right", render: () => page("corner"), mount },
  ];
})();
