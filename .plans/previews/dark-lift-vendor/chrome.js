/*
 * vendor — app-specific preview chrome. Synced into each preview as `chrome.js`; edit here.
 * Generic helpers (button, header, footer, split, card, field) live in `base.js` as `window.PV`.
 *
 * Extracted from the two vendor previews that already existed, where each of these was
 * hand-written: the dashboard shell behind a modal (`offering-wizard`), the modal/phone-sheet
 * frame (same), and the kiosk brand bar and staff footer (`vendor-checkout`).
 *
 * ⚠️ Classic script, not a module — see `controller.js`. Assigns `window.PVA`.
 */
"use strict";

window.PVA = (function () {
  const { esc, icon, each } = window.PV;

  const NAV = ["Dashboard", "Bookings", "Schedule", "Offerings", "Staff", "Transactions", "Settings"];

  /**
   * The dashboard shell a modal or page opens over. `active` lights one nav item.
   * `aria-hidden` on purpose when something is layered above it.
   */
  const shell = (body, { active = "Offerings", inert = false } = {}) => `
    <div class="sp-page vsh"${inert ? ' aria-hidden="true"' : ""}>
      <nav class="sp-sidebar vsh-nav">
        <p class="vsh-brand">Ezzy <span>Vendor</span></p>
        ${each(NAV, (n) => `<p class="vsh-navitem${n === active ? " nav-active" : ""}">${esc(n)}</p>`)}
      </nav>
      <div class="vsh-main">
        <div class="sp-topbar vsh-topbar">
          <span class="vsh-topbar-title">${esc(active)}</span>
          <span class="sp-pill vsh-topbar-pill">Sample Studio</span>
        </div>
        <div class="vsh-body">${body}</div>
      </div>
    </div>`;

  /**
   * A modal: a centred 520px card above 640px, a full-screen sheet below.
   * ⚠️ The sheet uses `--sp-modal-bg`, which is opaque `#0a0f1a` in dark on purpose — a
   * translucent sheet over a dark page does not hide what is behind it.
   */
  const modal = (body) => `
    <div class="vmodal-scrim">
      <div class="vmodal" role="dialog" aria-modal="true" aria-label="Preview dialog">${body}</div>
    </div>`;

  /** The kiosk brand bar — a customer-facing surface, so it names the vendor, not the staff. */
  const kioskBar = (vendor = "Sample Studio") => `
    <header class="sp-topbar kbar">
      <div class="kbar-brand">
        <span class="kbar-mark" aria-hidden="true">${esc(vendor.slice(0, 1))}</span>
        <div>
          <p class="kbar-name">${esc(vendor)}</p>
          <p class="kbar-sub">Self-service booking</p>
        </div>
      </div>
      <span class="sp-pill kbar-pill">Kiosk</span>
    </header>`;

  /** A step rail — the KYC wizard's pattern, reused by the offering wizard. */
  const steps = (titles, current) => `
    <div class="vsteps">
      <p class="vsteps-count">Step ${current + 1} of ${titles.length}</p>
      <p class="vsteps-title">${esc(titles[current])}</p>
      <div class="vsteps-bar" role="progressbar" aria-valuenow="${current + 1}" aria-valuemin="1" aria-valuemax="${titles.length}">
        ${each(titles, (_, i) => `<span class="vsteps-seg${i <= current ? " is-on" : ""}"></span>`)}
      </div>
    </div>`;

  return { shell, modal, kioskBar, steps, NAV, icon };
})();
