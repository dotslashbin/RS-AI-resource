# Ezzy Vendor Mobile: kiosk visual parity

**Date:** 2026-09-20  
**App / scope:** `ezzy-vendor-mobile` kiosk mode only.  
**Status:** COMPLETE

> Bring the native kiosk visually close to the existing vendor-web kiosk while retaining deliberate native interaction, accessibility, and performance behaviour.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.  
> **Numbering legend:** I# = important implementation item; S# = execution stage. Numbers are plan-local.

---

## Scope and boundaries

**In:** kiosk page ground and surfaces, the availability-refresh control, payment review summary, and payment confirmation receipt in `ezzy-vendor-mobile`.

**Out:** web `vendor` changes, schema/API/service changes, checkout behaviour, payment-provider copy/methods, new dependencies, and device-lockdown policy.

**Data/security assessment:** presentation-only. The existing kiosk services, Supabase access boundaries, browser payment handoff, session handling, and persisted kiosk mode remain unchanged. No schema or RLS work is required.

## Approved decisions

- **D1 — visual direction** → **Web-faithful native adaptation** (resolved 2026-09-20). Use the web kiosk's light/dark page gradients, blue mark and primary-action gradients, card elevation, borders, and summary hierarchy. The native header remains neutral rather than the exploratory preview's full-blue header; the web kiosk puts its gradient on the mark/actions, not the header.
- **D2 — refresh placement** → **Top, icon-only control** (resolved 2026-09-20). It appears in the catalogue/time-step heading, outside the bottom Continue action area. It has a 44pt minimum hit target, an accessible `Refresh availability` label/hint, disabled/busy state, and no hover-only explanation.
- **D3 — payments** → **Centred elevated containers** (resolved 2026-09-20). The review and confirmation data use matching summary/receipt cards. Existing ₱ formatting and the free-booking path remain authoritative; no payment-method list or stale provider promise is introduced.
- **D4 — platform navigation** → **Keep explicit kiosk controls** (resolved 2026-09-20). The current in-flow Back control remains the route back on iOS. Android hardware Back stays suppressed by the kiosk shell, so customers cannot escape kiosk context; this pass does not change that safety behaviour.
- **D5 — kiosk hierarchy refinement** → **Approved and implemented** (resolved 2026-09-20; final Android visual acceptance 2026-09-21). Remove the header rule; increase kiosk welcome actions from 80pt to 88pt; use a compact 44pt-minimum offering-card Choose action; and leave the normal-flow booking-summary/action area fully transparent so it blends into the kiosk ground rather than becoming a separate dock. This preserves a ≥44pt touch target, avoids dependencies, and keeps the shared-button variants limited to the kiosk call sites.

---

## Findings

- **F1 — the required visual primitives already exist.** `src/theme/tokens.ts:1-11` explicitly ports web values and models gradients and platform shadows; `btnPrimary` is the web's `#2563eb → #1d4ed8` gradient at `:101-105`. `expo-linear-gradient` is already installed and used by the existing `PrimaryButton`, so no dependency approval is needed.
- **F2 — the kiosk ignores the page gradient today.** `KioskShell.styles.ts:4` uses a flat `modalBg` root even though the common screen shell already renders theme page gradients. The kiosk needs a themed `LinearGradient` root without changing its safe-area, idle, or payment-handoff logic at `KioskShell.tsx:14-50`.
- **F3 — the text refresh is in the wrong action hierarchy.** `KioskCatalogue.tsx:100-108` puts `Refresh availability` beside Continue in the bottom bar. This competes with the irreversible forward action; the heading at `:29-34` is the correct context. Existing `retryAvailability` and its busy state remain the handler/source of truth.
- **F4 — payment detail lacks the web's summary container.** Review data is a flat sequence at `KioskCheckout.tsx:16-24`; confirmation data is only partly grouped at `:31-47`. Web kiosk review/receipt uses the shared card structure documented by `vendor/components/kiosk/KioskBooking/KioskBooking.module.css:338-358`.
- **F5 — current kiosk rendering already follows the project split.** `KioskShell`, `KioskCatalogue`, and `KioskCheckout` render from their co-located hooks and styles. Modified components keep `.tsx` render-only, retain their hooks for behaviour, and keep static style additions in `.styles.ts`; no component or service abstraction is needed.

---

## IMPORTANT

### I1 — Theme-aware kiosk surface parity  ✅ DONE (2026-09-20)
**Files:** `ezzy-vendor-mobile/src/components/kiosk/KioskShell/KioskShell.tsx:1-52`; `ezzy-vendor-mobile/src/components/kiosk/KioskShell/KioskShell.styles.ts:1-22`; `ezzy-vendor-mobile/src/theme/tokens.ts:52-84`

**Gap:** The kiosk root is flat, while vendor-web kiosk uses a theme-aware diagonal ground and gradient brand/action accents. The mobile token system already represents the equivalent page, primary-gradient, border, and platform-shadow values.

**Fix approach:** Render the root through `LinearGradient` using `tokens.pageBg`, preserve `SafeAreaView`, and refine kiosk static styles to use neutral header/card surfaces, web-derived radii, borders, and platform-shadow tokens. Keep `KioskShell.tsx` as a pure render layer; `useKioskShell.ts` continues to own all state, effects, and handlers.

**Risk / guardrail:** Never put a light-only card/header treatment over the dark gradient. Verify both themes and do not change `BackHandler`, idle reset, browser handoff, or staff exit behaviour.

**Executed / verified:** Replaced the flat kiosk root with the existing theme token's `LinearGradient`, and gave the existing mark the web-equivalent primary-gradient surface. `npx tsc --noEmit`, `npm run lint`, and `npm test` passed (25 tests) on 2026-09-20. User visually verified S1 as good on 2026-09-20.

### I2 — Icon-only availability refresh  ✅ DONE (2026-09-20)
**Files:** `ezzy-vendor-mobile/src/components/kiosk/KioskCatalogue/KioskCatalogue.tsx:29-34,100-108`; `ezzy-vendor-mobile/src/components/kiosk/KioskCatalogue/KioskCatalogue.styles.ts:5-37`; `ezzy-vendor-mobile/src/components/kiosk/KioskCatalogue/useKioskCatalogue.ts:29-73`

**Gap:** The refresh action is text-only and competes with Continue in the bottom action bar.

**Fix approach:** Move the existing `retryAvailability` action to a styled top-of-step icon `Pressable` using `lucide-react-native`, with a `Refresh availability` accessibility label and explanatory hint, busy/disabled state, `accessibilityState`, and ≥44×44pt target. Keep the render layer declarative and the existing hook as the behaviour seam; static styles remain in `KioskCatalogue.styles.ts`.

**Risk / guardrail:** Do not remove the current availability error/loading copy; an icon cannot be the only signal that a refresh is in progress.

**Executed / verified:** Moved the existing refresh callback into the time-step header as a 44pt icon control with busy spinner, disabled state, label, and hint. `npx tsc --noEmit`, `npm run lint`, and `npm test` passed (25 tests) on 2026-09-20. User accepted S2 on 2026-09-20.

### I3 — Review summary card  ✅ DONE (2026-09-20)
**Files:** `ezzy-vendor-mobile/src/components/kiosk/KioskCheckout/KioskCheckout.tsx:14-24`; `ezzy-vendor-mobile/src/components/kiosk/KioskCheckout/KioskCheckout.styles.ts:5-20`

**Gap:** Review fields are visually ungrouped despite the web kiosk's bordered, elevated summary card.

**Fix approach:** Group service, time, quantity/duration, customer details, and estimated total inside a centred card with separated detail rows and a prominent total. Reuse `cardBg`, `cardBdr`, and `cardShadow`; retain the existing signature and final-amount notice. `KioskCheckout.tsx` remains a render layer and `useKioskCheckout.ts` remains unchanged unless a purely presentational derived value is demonstrably missing.

**Risk / guardrail:** Keep the current payment semantics exactly: browser payment remains external, provider methods are not advertised, and free bookings must not look paid.

**Executed / verified:** Grouped the existing review fields and estimated total in a centred, tokenised summary card without changing checkout state or payment behaviour. `npx tsc --noEmit`, `npm run lint`, and `npm test` passed (25 tests) on 2026-09-20. User accepted S3 on 2026-09-20.

### I4 — Confirmation receipt card  ✅ DONE (2026-09-20)
**Files:** `ezzy-vendor-mobile/src/components/kiosk/KioskCheckout/KioskCheckout.tsx:30-47`; `ezzy-vendor-mobile/src/components/kiosk/KioskCheckout/KioskCheckout.styles.ts:16-20`

**Gap:** The success details do not use the web receipt's clear record-like container and hierarchy.

**Fix approach:** Keep the success icon/copy centred, then enclose reference, offering, date/time, payment state, and amount in the matching receipt card. Preserve the existing failed/refunded/not-confirmed messages and live-region behaviour. Static styles stay co-located; checkout state and payment polling remain in `useKioskCheckout.ts`.

**Risk / guardrail:** A payment status read failure must remain visibly different from a successful receipt. Do not substitute unknown information with a plausible amount or status.

**Executed / verified:** Grouped confirmation and non-confirmed receipt data in the matching tokenised card, with Free still rendered instead of ₱0. `npx tsc --noEmit`, `npm run lint`, and `npm test` passed (25 tests) on 2026-09-20. User accepted S3 on 2026-09-20.

### I5 — Android native-quality visual verification  ✅ DONE (2026-09-21)
**Files:** all I1–I4 targets

**Gap:** Existing app guidance records that visual code can pass machine checks while being overridden or clipped on device.

**Fix approach:** Verify Android tablet/phone layout, light/dark themes, Android Back containment, safe-area placement, 44pt targets, largest practical OS text scale, and availability states. Keep effects out of render and do not add list-wide blur/animation that risks frame drops.

**Risk / guardrail:** Android evidence does not prove iOS correctness. Keep iOS release validation explicitly deferred in the app-local verification record.

**Executed / verified:** User reported Android accessibility, text-scale, safe-area, containment, and performance validation complete through 2026-09-20, then visually accepted the final kiosk-surface refinements on 2026-09-21. The app's `KIOSK-VERIFICATION.md` records iOS acceptance as deferred; this visual-parity plan does not mark iOS as passed.

### I6 — Kiosk chrome and action hierarchy refinement  ✅ DONE (2026-09-21)
**Files:** `ezzy-vendor-mobile/src/components/kiosk/KioskShell/KioskShell.styles.ts:9-24`; `ezzy-vendor-mobile/src/components/kiosk/KioskCatalogue/KioskCatalogue.tsx:11-26,113-121`; `ezzy-vendor-mobile/src/components/kiosk/KioskCatalogue/KioskCatalogue.styles.ts:12-41`; `ezzy-vendor-mobile/src/components/common/PrimaryButton/PrimaryButton.tsx:7-89`; `ezzy-vendor-mobile/src/components/common/PrimaryButton/PrimaryButton.styles.ts:7-65`; reference pattern `ezzy-vendor-mobile/src/components/layout/TabBarBackground/TabBarBackground.tsx:1-27`

**Gap:** The thin header border visually bisects the compact kiosk header. The catalogue action bar's opaque fill and border read as a separate panel while scrolling. The welcome actions are the kiosk's primary entry points but need slightly more presence; the offering-card Choose actions carry less weight but appear too tall.

**Fix approach:** Remove the kiosk header rule. Retain normal flow and use a fully transparent booking-summary/action area, so the final scroll item is never obscured and no tinted rectangle divides the gradient. Increase the kiosk-only large `PrimaryButton` height to 88pt; add a compact 44pt-minimum primary-button size for offering-card Choose only. Keep `KioskShell`, `KioskCatalogue`, and `PrimaryButton` render-only, retain their existing hooks unchanged, and put static styles in their co-located `.styles.ts` files.

**Risk / guardrail:** Do not make the dock overlay the scroll content, so no selectable offering can be hidden. Preserve contrast in light/dark, the 44pt minimum target, and the current action bar's dynamic safe-area padding.

**Executed / verified:** Applied the exact vendor-web kiosk ground colours in `useKioskShell.ts`; added restrained code-only fallback image tiles in `useKioskCatalogue.ts`; removed the header divider; set welcome actions to 88pt and Choose actions to compact 44pt minimum; and removed the action-area tint/blur so it is fully transparent in normal flow. `tsc --noEmit`, lint, and 25 tests passed during implementation; the user visually accepted the final result on Android on 2026-09-21. Merged in mobile commit `496ad28`.

---

## DEFERRED / COSMETIC

- **P1 — Full-blue kiosk header from the exploratory preview** ⏸ PARKED (2026-09-20) — rejected for this pass because it does not match the actual vendor-web kiosk. Unblocked only by a new visual-direction decision.
- **P2 — New shared native `IconButton` component** ⏸ PARKED (2026-09-20) — one kiosk-only action does not justify a reusable abstraction. Unblocked if multiple native call sites need the same variant.
- **P3 — Device-level kiosk lockdown changes** ⏸ PARKED (2026-09-20) — Guided Access/screen pinning are operational/device settings and outside this visual mobile-app scope.
- **P4 — Flat, no-gradient kiosk alternative** ⏸ PARKED (2026-09-20) — exploratory light/dark previews were accepted as a possible future direction but were not selected for this release. Reference: `ezzy-vendor-mobile/KIOSK-DESIGN-REFERENCE.md`. Unblocked by a new user request to revisit that alternative.
- **P5 — iOS visual acceptance** ⏸ PARKED (2026-09-21) — the app-local verification record defers iOS testing; this plan closes the approved Android visual-parity pass only. Unblocked by an iOS development build/device and the equivalent VoiceOver, navigation, safe-area, large-text, and theme checks.

---

## Execution order

1. **S1 — kiosk visual foundation:** I1. Independent presentation work; no data or navigation behaviour changes.
2. **S2 — availability refresh:** I2. Depends on I1's final top-of-step visual hierarchy.
3. **S3 — payment summary and receipt:** I3 and I4 together. They share the same card language and should land in one visual batch.
4. **S4 — verification:** I5. Runs after all visual surfaces are present.
5. **S5 — kiosk chrome refinement:** I6. Implement the approved direction and rerun Android visual verification for its changed surfaces.

Default cadence is one stage at a time. Each stage ends with a file-level summary, actual checks run, screenshots where possible, and this plan's status update.

## Big table

| Done | ID | What | Who | Status | Verification / unblock |
|:-:|---|---|---|---|---|
| ✅ | S0 | Investigate, resolve decisions, and record this mobile-only plan | Mine | ✅ DONE (2026-09-20) | Source inspected at cited lines; preview approved; no open decisions |
| ✅ | S1 / I1 | Kiosk surface gradient, neutral header, web-equivalent card treatment | Mine | ✅ DONE (2026-09-20) | `tsc`, lint, and 25 tests passed; user visually verified |
| ✅ | S2 / I2 | Top icon-only availability refresh | Mine | ✅ DONE (2026-09-20) | `tsc`, lint, and 25 tests passed; user accepted |
| ✅ | S3 / I3–I4 | Review summary and confirmation receipt containers | Mine | ✅ DONE (2026-09-20) | `tsc`, lint, and 25 tests passed; user accepted |
| ✅ | S4 / I5 | Android accessibility, text-scale, safe-area, and performance pass | Mine + Yours | ✅ DONE (2026-09-21) | User acceptance; iOS deliberately deferred in P5 |
| ✅ | S5 / I6 | Remove hard chrome rules; apply the vendor-web kiosk ground and restrained fallback tile; rebalance welcome and Choose button heights; make booking summary fully transparent | Mine + Yours | ✅ DONE (2026-09-21) | `tsc`, lint, 25 tests; user accepted the final Android appearance |
| ✅ | Commit | Review, commit, and merge the kiosk changes | Yours | ✅ DONE (2026-09-21) | Mobile `develop` is clean at merge commit `496ad28` |

## Verification

- **Machine-verifiable:** `npx tsc --noEmit`, `npm run lint`, and `npm test` from `ezzy-vendor-mobile` after code stages.
- **Device/live environment — completed:** User Android visual acceptance covered the final light/dark kiosk surfaces, large text, safe areas, refresh target, availability states, action visibility, and Android Back containment through 2026-09-21.
- **Still outside this completed visual-parity plan:** iOS visual/VoiceOver validation remains deferred (P5), and end-to-end payment/receipt settlement remains open in `ezzy-vendor-mobile/KIOSK-VERIFICATION.md` Stage 6.

## Closure review (2026-09-21)

The merged implementation covers every approved visual-parity item: vendor-web-ground gradients, restrained placeholder tiles, header/action hierarchy, icon-only refresh, payment containers, and responsive native action targets. Android visual acceptance is user-reported and the machine checks recorded above passed. iOS validation and live payment settlement remain explicitly deferred rather than silently being treated as complete.
