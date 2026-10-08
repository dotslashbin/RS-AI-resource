# Vendor checkout visual previews

**Date:** 2026-10-07 · **Approval record updated:** 2026-10-08 · **Scope:** S3 visual design subset only; not a live checkout implementation. Desktop and existing phone visuals accepted by user; application components deferred until explicit user resumption/approval.

Open [index.html](index.html) directly in a browser. Use the **Screen** and **Theme** controls to review thirteen fixed states. No web server is needed. Query parameters can select a state, e.g. `index.html?screen=qr&theme=dark`.

## Design fit and package approval

The design follows `vendor/app/globals.css`, `KioskShell.module.css` and `KioskBooking.module.css`: existing blue primary gradient, light/dark kiosk grounds, theme-aware cards, system sans font, 18px card radii and touch-first controls. It deliberately has no dashboard sidebar; this is a customer-facing kiosk.

**Additional packages required: none.** Every preview footer says so. Outline icons can use the existing `lucide-react` package when implemented. QR Ph uses the provider-returned image in production; no QR-generation package is proposed. The large QR icon here is intentionally labelled **PREVIEW ONLY**, not scannable. No external fonts, provider logos, assets, CDN or network resources are loaded. Any later design needing a package must be labelled at the affected element and separately approved before installation.

## State coverage

1. Explicit QR Ph / GCash method choice (D33), no automatic QR generation.
2. Preparation/loading, separate from the payment countdown.
3. QR display and same-payment status check; no renew-QR button.
4. GCash handoff notice; external GCash UI is not included.
5. Checking payment after return; no success from return alone.
6. Verified payment received / submitted, still awaiting vendor confirmation.
7. Server-verified release; new booking requires fresh availability.
8. Verified late-payment exception, no booking resurrection or refund promise.
9. Offline/unknown; do not pay again, preserve original deadline.
10. Privacy reset waiting for server confirmation; no next-customer bypass.
11. Other-tab in-use view with no customer details.
12. Staff recovery confirmation, intentionally no real password input or reset.
13. Verified free-booking receipt, no provider action.

## Limits and implementation boundary

All state selectors/buttons simulate snapshots. Cancel jumps to an example released state; in production it must request guarded cancellation and handle pending/rejected/lost-response outcomes. Start a new booking returns to the sample method-choice screen only as a preview shortcut; production goes through a new availability/booking flow. Back here is preview navigation, not a verified history/resume implementation. The GCash button never opens a provider URL. Timers are fixed illustrative server-snapshot values, not actual clocks.

No customer PII, secrets, storage, database, auth, booking writes, Supabase, provider calls, email or app imports exist here. Preview privacy views do not prove real cross-tab privacy, stale-request invalidation or offline recovery. X4-tab remains parked and a release gate. Desktop and existing phone presentation were explicitly accepted by the user; component implementation is deferred by user direction. This is not new backend product approval, runtime verification or a frozen API contract.

Separate `index.html` (shell), `preview.css` (styles) and `preview.js` (fixed fixture controller). These are standalone documents, not React components. Later app implementation must retain the plan's per-component render/controller-hook/CSS-module boundaries. No preview file is imported by Vendor, Booker, Command or Backbone.

## Verification

**2026-10-07 results:** Node syntax checks and `git diff --check` passed. Browser verification passed 26 theme/state combinations and 18 responsive combinations at 1024×768, 768×1024 and 390×844. Verified control sizes, kiosk chrome bounds, privacy-screen copy, mock method/GCash-return/reset navigation and disabled staff verification; no page errors or external HTTP requests. A wrapped preview-toolbar/footer clipping issue was found and fixed before the successful rerun. Method-choice/light and QR/dark screenshots were visually inspected. Browser launch initially failed under sandbox restrictions, then succeeded with approval.

| Screenshot | Light | Dark |
|---|---|---|
| Method choice | [Light](choice-light.png) | [Dark](choice-dark.png) |
| QR Ph | [Light](qr-light.png) | [Dark](qr-dark.png) |
| GCash handoff | [Light](gcash-light.png) | [Dark](gcash-dark.png) |
| Payment received | [Light](received-light.png) | [Dark](received-dark.png) |

## Phone / responsive PWA previews

User accepted the desktop visuals on 2026-10-07, requested phone previews, then explicitly accepted the existing mobile look; the approval record was reconciled on 2026-10-08. These are the same Vendor web layout at a 390×844 CSS-pixel viewport, not the Expo native app. Full-page images show scrolling content; viewport images show only what is visible before scrolling, including the design-only selector bar. This bar is not production kiosk chrome.

| Phone screenshot | Light | Dark |
|---|---|---|
| Method choice, full page | [Light](choice-mobile-light.png) | [Dark](choice-mobile-dark.png) |
| Method choice, initial viewport | [Light](choice-mobile-light-viewport.png) | [Dark](choice-mobile-dark-viewport.png) |
| QR Ph, full page | [Light](qr-mobile-light.png) | [Dark](qr-mobile-dark.png) |
| QR Ph, initial viewport | [Light](qr-mobile-light-viewport.png) | [Dark](qr-mobile-dark-viewport.png) |
| GCash handoff | [Light](gcash-mobile-light.png) | [Dark](gcash-mobile-dark.png) |
| Payment received | [Light](received-mobile-light.png) | [Dark](received-mobile-dark.png) |
| Offline | [Light](offline-mobile-light.png) | [Dark](offline-mobile-dark.png) |
| Privacy reset | [Light](reset-mobile-light.png) | [Dark](reset-mobile-dark.png) |

**Verification (2026-10-07):** rerun passed the previous 26 desktop and 18 responsive checks plus 78 phone theme/state combinations across 360×800, 390×844 and 430×932. No horizontal overflow or sub-44px controls, page errors or external HTTP requests. Generated sixteen phone screenshots (twelve full-page and four viewport) in addition to eight desktop screenshots. Visually inspected method-choice/light and QR/dark full-page phone images. No CSS, application code or package changes made in this phone-preview pass.

**UX finding, S3-P3 TODO:** the current stacked summary requires scrolling before payment choices and much of the QR. Even without the preview selector bar, the full summary consumes substantial phone height. Recommend a compact service/time/amount summary on narrow screens, with the method/QR action brought forward; preserve the approved desktop layout. User accepted the existing mobile look, not this proposed redesign. Keep the finding open for user disposition; no compact-summary implementation is approved or performed. QR scanning here assumes a separate phone; a customer viewing the PWA on their own phone should consider the separate GCash option. No claim that same-phone QR import is supported.

These are local Chromium responsive screenshots, not an installed-PWA test. Real iOS/Android standalone viewport/safe areas, keyboard behaviour, service-worker caching, GCash app/browser handoff and kiosk hardware remain unverified.

`node .plans/previews/vendor-checkout/verify.cjs` uses Vendor's already-installed Playwright and local Chromium. It renders both themes, checks viewport overflow/touch targets/chrome, exercises mock navigation, checks privacy-screen text, rejects external HTTP requests and produces twenty-four PNGs. Browser execution may need sandbox approval; it does not start/restart a service or install anything.

Automated layout checks are not an accessibility certification or production payment proof. Real QR scanning, colour-contrast certification, focus/screen-reader usability, production-build history/cache, actual tablet behaviour and backend enforcement remain unverified. App typecheck/lint/full suites are not required to validate these standalone documents; no application files changed.
