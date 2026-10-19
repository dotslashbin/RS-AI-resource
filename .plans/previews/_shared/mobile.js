/*
 * mobile (Expo / React Native) — app-specific preview chrome. Synced as `chrome.js`.
 * Generic helpers live in `base.js` as `window.PV`.
 *
 * Pair this with `_shared/vendor.css` or `_shared/booker.css` for colour:
 * `ezzy-vendor-mobile/src/theme/tokens.ts:1–5` ports the vendor web `--sp-*` values VERBATIM
 * "so the two clients stay visually identical", so mobile needs no palette of its own.
 *
 * ⚠️⚠️ THREE WEB EFFECTS HAVE NO REACT NATIVE EQUIVALENT (`tokens.ts:7–11`):
 *   gradients   → `expo-linear-gradient`
 *   blur        → `expo-blur`
 *   box-shadow  → per-platform shadow objects via `shadow()`
 * An HTML mock renders all three for free, so a preview can win approval for something RN
 * cannot produce without extra packages and per-platform work. The runner FAILS a mobile
 * preview that uses `filter`/`backdrop-filter`, a multi-layer `box-shadow`, or a
 * `linear-gradient` on an element not marked `data-rn="linear-gradient"` — and that marker is
 * only legitimate when the README names the package that delivers it.
 *
 * ⚠️ Classic script, not a module — see `controller.js`. Assigns `window.PVA`.
 */
"use strict";

window.PVA = (function () {
  const { esc, icon, each } = window.PV;

  /*
   * Safe-area insets. The heights live in `mobile.css` (`.mdev-status`, `.mdev-home`) because
   * the preview CSP is `style-src 'self'` and blocks an inline `style=""`; these constants are
   * exported for a screen that needs to reason about the numbers.
   *
   * ⚠️ Hard numbers, not `env(safe-area-inset-*)`: in a desktop Chromium viewport those all
   * resolve to 0, which would hide the one layout risk a phone preview exists to show. Values
   * are the iPhone 14 class figures matching the 390×844 viewport the runner uses — keep them
   * in step with `mobile.css`.
   */
  const INSET = { top: 47, bottom: 34 };

  /**
   * The device frame: status bar, body, home indicator. Wrap every mobile screen in this —
   * without it the mock shows 844px of usable height that no phone has.
   */
  const device = (body, { platform = "ios" } = {}) => `
    <div class="mdev" data-platform="${esc(platform)}">
      <div class="mdev-status" aria-hidden="true">
        <span class="mdev-time">9:41</span>
        <span class="mdev-icons">${icon("phone", 13)}</span>
      </div>
      <div class="mdev-body">${body}</div>
      <div class="mdev-home" aria-hidden="true">
        <span class="mdev-bar"></span>
      </div>
    </div>`;

  /**
   * A native stack header. `back` renders the platform's back affordance — iOS shows a
   * chevron with the previous title, Android a plain arrow, and they are not interchangeable.
   */
  const navHeader = (title, { back = "", platform = "ios" } = {}) => `
    <header class="mnav" data-platform="${esc(platform)}">
      ${back
        ? `<button type="button" class="mnav-back" data-goto="${esc(back)}" aria-label="Back">
             ${icon("left", 20)}${platform === "ios" ? '<span class="mnav-back-label">Back</span>' : ""}
           </button>`
        : '<span class="mnav-spacer"></span>'}
      <h1 class="mnav-title">${esc(title)}</h1>
      <span class="mnav-spacer"></span>
    </header>`;

  /**
   * A bottom tab bar. ⚠️ It sits ABOVE the home indicator, not under it — a tab bar flush to
   * the bottom edge is unreachable on a gesture-navigation phone.
   */
  const tabBar = (tabs, active) => `
    <nav class="mtabs" role="tablist">
      ${each(tabs, (t) => `
        <button type="button" class="mtab${t.id === active ? " is-on" : ""}" role="tab"
          aria-selected="${t.id === active}"${t.goto ? ` data-goto="${esc(t.goto)}"` : ""}>
          ${icon(t.icon || "home", 20)}<span class="mtab-label">${esc(t.label)}</span>
        </button>`)}
    </nav>`;

  /**
   * A scrollable screen body between the header and the tab bar.
   * `scroll` only marks the region — the mock does not simulate momentum or overscroll.
   */
  const screenBody = (body) => `<main class="mbody">${body}</main>`;

  return { device, navHeader, tabBar, screenBody, INSET, icon };
})();
