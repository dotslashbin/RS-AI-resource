/*
 * booker — app-specific preview chrome. Synced into each preview as `chrome.js`; edit here.
 * Generic helpers (button, header, footer, split, card, field) live in `base.js` as `window.PV`.
 *
 * Extracted from `.plans/previews/near-me/index.html`, where the top bar, the tab strip, the
 * shelf heading and the offering card were each written out once per screen — eleven times
 * over, which is most of why that preview's HTML is 26 KB.
 *
 * ⚠️ Classic script, not a module — see `controller.js`. Assigns `window.PVA`.
 */
"use strict";

window.PVA = (function () {
  const { esc, icon, each } = window.PV;

  /* The four tabs, from `booker/lib/constants.ts` → MAIN_TABS. Booking is NOT a tab: a booking
     starts from an offering page and the wizard keeps Explore lit. */
  const TABS = [
    { id: "home", label: "Home" },
    { id: "explore", label: "Explore" },
    { id: "activity", label: "Activity" },
    { id: "payments", label: "Payments" },
  ];

  /**
   * The top bar. `search` renders the field; it is deliberately absent on Home and Explore,
   * which own a field of their own, and in the wizard, which holds a slot.
   */
  const topbar = ({ search = true } = {}) => `
    <div class="db-topbar btop">
      <p class="btop-brand">Ezzy <span>Booker</span></p>
      ${search
        ? `<div class="db-input btop-search">${icon("search", 15)}<span class="btop-search-ph">Search offerings or vendors</span></div>`
        : '<div class="btop-spacer"></div>'}
      <span class="db-pill btop-acct">${icon("user", 15)}</span>
    </div>`;

  /** The tab strip. `active` takes a tab id. */
  const tabs = (active = "home") => `
    <div class="db-tabbar btabs" role="tablist">
      ${each(TABS, (t) => `
        <span class="btab${t.id === active ? " is-on" : ""}" role="tab"
          aria-selected="${t.id === active}">${esc(t.label)}</span>`)}
    </div>`;

  /**
   * A shelf heading. `accent` names one of the mapped accents, never a raw colour.
   *
   * ⚠️ `data-accent`, NOT an inline `style`, for two reasons. The preview CSP is
   * `style-src 'self'`, which blocks a `style=""` attribute outright — and booker's own rule
   * is that a colour mapping lives in ONE stylesheet keyed by a data attribute, never
   * hand-written per component.
   *
   * ⚠️ ONLY THEME-AWARE ACCENTS ARE OFFERED. `--div-*-deep` is identical in light and dark —
   * it is built for white text on a coloured band — so at this rule's 6–26% alphas it vanishes
   * on a dark surface. booker measured that on the Payments month bar, which is why that one
   * uses `--db-tone-money-fg` and not Home's purple. If a preview needs a division accent,
   * check it in dark first and add the mapping to `_shared/booker.css`.
   */
  const shelf = (title, sub, body, { accent = "popular" } = {}) => `
    <section class="bshelf">
      <div class="db-shelf-head bshelf-head" data-accent="${esc(accent)}">
        <span class="db-shelf-pipe"></span>
        <div>
          <h2 class="bshelf-title">${esc(title)}</h2>
          ${sub ? `<p class="bshelf-sub">${esc(sub)}</p>` : ""}
        </div>
      </div>
      <div class="bshelf-body">${body}</div>
    </section>`;

  /**
   * An offering card.
   *
   * ⚠️ `code` can be SIX characters, not three. booker's visual suite grew a `codebadge`
   * fixture precisely because every other fixture used three and a real "RENTAL" overflowed
   * its tile past 77 green baselines. Use a six-character code in at least one fixture.
   */
  const offeringCard = ({ title, vendor, code, price, city = "" }) => `
    <article class="db-card bcard">
      <div class="bcard-art" aria-hidden="true"><span class="bcard-code">${esc(code)}</span></div>
      <div class="bcard-text">
        <p class="bcard-title">${esc(title)}</p>
        <p class="bcard-vendor">${esc(vendor)}${city ? ` · ${esc(city)}` : ""}</p>
        <p class="bcard-price">${esc(price)}</p>
      </div>
    </article>`;

  /**
   * The location chip.
   *
   * ⚠️ A CITY, never a distance. `vendors` has no coordinates; a city centroid sits ~31 km
   * from downtown Davao, so no kilometre figure may be rendered from one anywhere in booker.
   * The tier LABEL is what tells a booker where a card is from.
   */
  const locationChip = (city, { goto } = {}) => `
    <button type="button" class="db-pill bloc"${goto ? ` data-goto="${esc(goto)}"` : ""}>
      ${icon("pin", 15)}<span>${city ? esc(city) : "Set your location"}</span>
    </button>`;

  return { topbar, tabs, shelf, offeringCard, locationChip, TABS, icon };
})();
