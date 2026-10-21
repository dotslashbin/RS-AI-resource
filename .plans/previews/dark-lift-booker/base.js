/*
 * Generic preview helpers — app-independent. Synced into each preview as `base.js`; edit here.
 *
 * These render the `.pv*` classes that `_shared/preview-chrome.css` styles through the
 * `--pv-*` aliases, so nothing in this file knows which app it is previewing. App-specific
 * chrome (sidebars, tab bars, shelves, native headers) lives in `_shared/<app>.js` as
 * `window.PVA`.
 *
 * `button`, `header`, `footer` and `split` are generalised from
 * `.plans/previews/vendor-checkout/preview.js:13–17`; the icon set from
 * `.plans/previews/offering-wizard/preview.js:6–22`, which inlined these `lucide-react` glyph
 * paths because the real apps use them and a preview cannot import the package.
 *
 * ⚠️ Classic script, not a module — see the note in `controller.js`. Assigns `window.PV`.
 */
"use strict";

window.PV = (function () {
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const ICON = {
    x:      '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    plus:   '<path d="M5 12h14"/><path d="M12 5v14"/>',
    trash:  '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    left:   '<path d="m15 18-6-6 6-6"/>',
    right:  '<path d="m9 18 6-6-6-6"/>',
    check:  '<path d="M20 6 9 17l-5-5"/>',
    ok:     '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    alert:  '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    image:  '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    cal:    '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    phone:  '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
    qr:     '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    pin:    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    user:   '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    home:   '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  };

  const icon = (name, size = 14) =>
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">${ICON[name] || ""}</svg>`;

  /*
   * A control. `goto` is picked up by the controller's `[data-goto]` delegation.
   * ⚠️ The 44px floor lives in `chrome.css`, and the runner fails a preview that breaks it
   * (ux-design §5). Pass `reason` on a disabled control — a disabled button with no stated
   * reason is the single most common finding in a design review.
   */
  const button = (label, { goto, primary = false, disabled = false, reason = "" } = {}) =>
    `<button type="button" class="pvb${primary ? " btn-primary" : ""}"${
      goto ? ` data-goto="${esc(goto)}"` : ""
    }${disabled ? " disabled" : ""}${reason ? ` title="${esc(reason)}"` : ""}>${esc(label)}</button>`;

  /** A page or dialog header: optional back arrow, title, subtitle, optional right-hand pill. */
  const header = (title, sub, { back, pill } = {}) => `
    <div class="pvh">
      ${back ? `<button type="button" class="pvh-back" data-goto="${esc(back)}" aria-label="Back">${icon("left", 18)}</button>` : ""}
      <div class="pvh-text">
        <h1 class="pvh-title">${esc(title)}</h1>
        ${sub ? `<p class="pvh-sub">${esc(sub)}</p>` : ""}
      </div>
      ${pill ? `<span class="pvh-pill">${esc(pill)}</span>` : ""}
    </div>`;

  /** A footer note plus actions — the row that usually carries the irreversible button. */
  const footer = (note, actions = "") => `
    <div class="pvf">
      ${note ? `<p class="pvf-note">${esc(note)}</p>` : ""}
      ${actions ? `<div class="pvf-actions">${actions}</div>` : ""}
    </div>`;

  /** Two columns above 860px, stacked below — the summary-beside-content shape. */
  const split = (main, aside) => `
    <div class="pvs">
      <div class="pvs-main">${main}</div>
      ${aside ? `<aside class="pvs-aside">${aside}</aside>` : ""}
    </div>`;

  /** A card. `cls` takes the app's own card class, e.g. `sp-card` or `db-card`. */
  const card = (body, cls = "") => `<div class="pvc ${cls}">${body}</div>`;

  /** A labelled field. Pass `error` to show the invalid state with its reason underneath. */
  const field = (label, value, { placeholder = "", hint = "", error = "", required = false, id = "f", inputCls = "" } = {}) => `
    <div class="pvfield">
      <p class="pvfield-lbl">${esc(label)}${required ? ' <span class="pvfield-req">*</span>' : ""}</p>
      <input class="pvfield-input ${inputCls}${error ? " is-invalid" : ""}" value="${esc(value)}"
        placeholder="${esc(placeholder)}"${error ? ` aria-invalid="true" aria-describedby="${esc(id)}-err"` : ""}>
      ${error
        ? `<p class="pvfield-err" id="${esc(id)}-err">${icon("alert", 12)}<span>${esc(error)}</span></p>`
        : hint ? `<p class="pvfield-hint">${esc(hint)}</p>` : ""}
    </div>`;

  /** Repeat a renderer over a fixture list — the loop every screen ends up writing. */
  const each = (items, fn) => items.map(fn).join("");

  return { esc, icon, button, header, footer, split, card, field, each };
})();
