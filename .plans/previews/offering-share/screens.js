/*
 * offering-share — the screens. THIS FILE IS THE WORK; everything else is scaffolding.
 *
 * Booker's public shared-offering view (plan .plans/2026-11-19-offering-share-links.md, D3, D7,
 * D9) and the Share button on the existing signed-in offering page (B3).
 *
 * Layout mirrors `booker/components/explore/OfferingPage/OfferingPage.tsx` + its module CSS:
 * photo banner → chips → title → vendor line → description, with a 300px price rail beside
 * the content above 860px and stacked below it.
 *
 * Fixtures are INVENTED — never real vendor or customer rows.
 */
"use strict";

(function () {
  const { esc, icon } = window.PV;

  /* Icons the shared set lacks (lucide shapes: share-2, clock, link). Attributes only, no style. */
  const svg = (paths, size = 16) =>
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">${paths}</svg>`;
  const shareIc = svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>');
  const clockIc = svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 14);
  const linkIc  = svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>', 40);

  /* One fixture, every screen. D3's public fields only — no code, tagline, fulfilment pattern,
     address, phone, hours, schedules, staff, slots, requirements or agreements. */
  const O = {
    name: "Court B — Hourly Rental",
    category: "Court rental",
    duration: "1 hour",
    price: "₱850",
    per: "/ hour",
    division: "ezzy-court",
    divisionLabel: "Court",
    vendor: "Sample Sports Hub",
    city: "Makati City",
    province: "Metro Manila",
    description:
      "Full-size indoor court with fresh flooring and LED lighting. Bring your own " +
      "racquets or borrow ours at the front desk. Ideal for doubles and practice sessions.",
  };

  /* Signed-out top bar: no tabs, no search, no account menu — there is no session to own them. */
  const publicBar = () => `
    <div class="db-topbar ps-bar">
      <p class="btop-brand">Ezzy <span>Booker</span></p>
      <button type="button" class="db-pill ps-bar-login" data-goto="public">Log in</button>
    </div>`;

  const photo = (withPhoto) => withPhoto
    ? `<div class="ps-photo" role="img" aria-label="Vendor photo of ${esc(O.name)}">
         <span class="ps-photo-tag">Photo (stand-in)</span>
       </div>`
    : `<div class="ps-placeholder" data-division="${esc(O.division)}">No photos yet</div>`;

  const head = () => `
    <div>
      <div class="ps-chips">
        <span class="ps-chip">${esc(O.category)}</span>
        <span class="ps-chip">${clockIc}${esc(O.duration)}</span>
        <span class="ps-chip ps-chip-div" data-division="${esc(O.division)}">${esc(O.divisionLabel)}</span>
      </div>
      <h1 class="ps-title">${esc(O.name)}</h1>
      <p class="ps-vendor">${esc(O.vendor)} · ${esc(O.city)}, ${esc(O.province)}</p>
      <p class="ps-desc">${esc(O.description)}</p>
    </div>`;

  /* The signed-out rail (D9): price + duration, sign-up primary, log-in secondary. */
  const publicRail = () => `
    <aside class="db-card ps-rail">
      <p class="ps-price">${esc(O.price)} <span>${esc(O.per)}</span></p>
      <p class="ps-note">Create a free Ezzy Booker account to see open times and book.</p>
      <button type="button" class="ps-primary" data-goto="public">Sign up to book</button>
      <button type="button" class="ps-secondary" data-goto="public">Already have an account? Log in</button>
      <p class="ps-fine">You'll come back to this offering after you sign up or log in.</p>
    </aside>`;

  const publicPage = (withPhoto) => publicBar() + `
    <main class="ps-page">
      ${photo(withPhoto)}
      <div class="ps-cols ps-cols-public">
        <div class="ps-head">${head()}</div>
        ${publicRail()}
        <section class="db-card ps-where">
          <h2 class="ps-sec">Where</h2>
          <p class="ps-where-name">${esc(O.vendor)}</p>
          <p class="ps-where-meta">${esc(O.city)}, ${esc(O.province)}</p>
          <p class="ps-where-hint">The exact address shows once you're signed in.</p>
        </section>
      </div>
    </main>`;

  /* D7: one neutral message for every unavailable case — never "deleted" vs "inactive". */
  const unavailable = () => publicBar() + `
    <main class="ps-page ps-gone">
      <div class="db-card ps-gone-card">
        <span class="ps-gone-ic">${linkIc}</span>
        <h1 class="ps-gone-title">This offering is no longer available</h1>
        <p class="ps-gone-body">The link may be old, or the vendor may have stopped offering it.
          You can still browse what's on Ezzy Booker.</p>
        <button type="button" class="ps-primary" data-goto="public">Go to Ezzy Booker</button>
      </div>
    </main>`;

  /* B3: the EXISTING signed-in page, with only a Share button added beside "Back to results". */
  const signedIn = () => PVA.topbar() + PVA.tabs("explore") + `
    <main class="ps-page">
      <div class="ps-toolbar">
        <button type="button" class="ps-back">${icon("left", 16)} Back to results</button>
        <button type="button" class="ps-share" aria-label="Share this offering">${shareIc}<span>Share</span></button>
      </div>
      ${photo(true)}
      <div class="ps-cols">
        <div class="ps-main">${head()}
          <section class="db-card ps-where">
            <h2 class="ps-sec">Where</h2>
            <p class="ps-where-name">${esc(O.vendor)}</p>
            <p class="ps-where-meta">12 Example Street, ${esc(O.city)} · 7am–10pm</p>
          </section>
        </div>
        <aside class="db-card ps-rail">
          <p class="ps-price">${esc(O.price)} <span>${esc(O.per)}</span></p>
          <div class="ps-slots">
            <span class="ps-slot">Today 4:00 PM</span><span class="ps-slot">Today 5:00 PM</span>
            <span class="ps-slot">Tue 9:00 AM</span><span class="ps-slot">Tue 10:00 AM</span>
          </div>
          <button type="button" class="ps-primary">Book</button>
        </aside>
      </div>
    </main>
    <div class="ps-toast" role="status">${icon("check", 15)} Link copied — paste it anywhere to share</div>`;

  window.PREVIEW_SCREENS = [
    { id: "public", label: "1 · Shared link, signed out (with photo)", render: () => publicPage(true) },
    { id: "public-nophoto", label: "2 · Shared link, signed out (no photos)", render: () => publicPage(false) },
    { id: "unavailable", label: "3 · Shared link to an unavailable offering", render: unavailable },
    { id: "signedin-share", label: "4 · Signed-in offering page + Share (desktop: link copied)", render: signedIn },
  ];
})();
