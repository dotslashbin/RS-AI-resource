# Mobile UI Polish: Transactions, Booking Navigation, and Flow Footer

**Date:** 2026-09-23  
**App / scope:** `ezzy-vendor-mobile` and `ezzy-booker-mobile`  
**Status:** IN PROGRESS

> Resolve the confirmed mobile spacing and navigation affordances before release, while preserving the existing booking data, controls, and visual system.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.  
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local — qualify cross-plan references by app.

---

## Scope and boundaries

**In scope:**

- A 16pt visual break between the Vendor Transactions date/search controls and the summary widgets.
- A subtle, explicit “Back to bookings” navigation link above the existing Vendor booking detail content.
- A transparent, borderless Booker booking-flow footer so its existing action buttons sit seamlessly over the existing page background.

**Out of scope:** booking-detail cards, fields, data, button labels, booking actions, navigation behaviour, theme tokens, backend/schema/RLS work, dependencies, and background art. The background-art exploration is deliberately parked below.

**Cross-app coupling:** this is one release-polish batch across two independent mobile app repositories. The changes have no runtime dependency on one another. **Execution approval:** granted by the user on 2026-09-23 (“continue to completion”); code implementation is complete, with device verification still outstanding.

## Investigation record

- The Transactions filter toolbar and summary cards are adjacent in the scrolling `RefreshableList` header; the `StaleBanner` is conditionally rendered between them. The gap must therefore belong immediately before the summary section, not inside the filter itself, so the populated and stale-data states retain the same hierarchy.
- The booking-detail route is already a nested Expo Router `Stack` (`bookings/_layout.tsx:4`); iOS edge-swipe back remains platform navigation. The missing element is a visible return path in the detail content, not a replacement navigation system.
- The Booker action container is one shared footer for every ready, unbooked booking-flow step. Its opaque `panelBg` and top border are the rectangle described in the report. Changing this one style treats the existing actions consistently; it does not alter their labels or booking logic.
- Payment-status audit (2026-09-23): `KioskCheckout` starts a 60-second five-second poll after browser return (`useKioskCheckout.ts:78-85,156-160`) and refreshes once when the app becomes active (`:87-93`), but it has no continuing background status worker. The displayed “Check payment status” action (`KioskCheckout.tsx:98`) is the only on-screen recovery after that bounded polling window or a receipt-read failure (`useKioskCheckout.ts:70-76`).
- `architecture/conventions.md:785-800` requires theme-aware `makeStyles(tokens)` factories for static React Native styles. All three target components already follow that convention; no new component, hook, abstraction, or asset is justified.
- Baseline (2026-09-23): `npm test` passed (Vendor 25/25, Booker 16/16); `npx tsc --noEmit` passed in both app directories. No relevant component-level tests exist because these are static visual-layout changes.

## BLOCKERS

None identified. These are presentation-only changes with no schema, RLS, auth, permission, or data exposure impact.

## IMPORTANT

### I1 — Separate Vendor Transactions controls from summary widgets  ✅ DONE (2026-09-23)

**Implementation note (2026-09-23):** Added the `spacing.lg` summary-section separation in `TransactionsView`. Vendor `npx tsc --noEmit`, `npm test` (25/25), `npm run lint`, and Android `npx expo export --platform android` passed; user visually accepted S1 after device review.

**Files:** `ezzy-vendor-mobile/src/components/transactions/TransactionsView/TransactionsView.tsx:24-49`; `ezzy-vendor-mobile/src/components/transactions/TransactionsView/TransactionsView.styles.ts:5-13`

The filter toolbar is immediately followed by a conditional stale-state notice and then `TransactionSummaryCards`; with no stale notice, the date/search card visually touches the “Collected” and “Your payout” cards. This makes controls and read-only totals read as a single block.

**Fix approach:** wrap only `TransactionSummaryCards` in a styled section with `spacing.lg` (16pt) top separation. The gap is after a visible stale banner when one exists and directly after the filter card otherwise. Do not change the toolbar, summary-card layout, transactions list, or list-header identity.

**Component separation:** modify the existing `TransactionsView` render layer and its existing `makeStyles(tokens)` file only; state, queries, and handlers remain in `useTransactionsView` unchanged.

**Verification:** machine — Vendor `npx tsc --noEmit`, `npm test`, and `npm run lint`; live — Android and iOS screenshots in light/dark themes, populated and stale/error states, confirming a 16pt break without search focus loss or header remounting.

### I2 — Add a subtle explicit return path on Vendor booking detail  ✅ DONE (2026-09-23)

**Implementation note (2026-09-23):** Added the existing `s.goBack` route as a 44pt, theme-aware chevron-and-label link before the unchanged detail content. Vendor `npx tsc --noEmit`, `npm test` (25/25), `npm run lint`, and Android `npx expo export --platform android` passed; user visually accepted S2 after device review. VoiceOver and TalkBack verification remain advisable before release.

**Files:** `ezzy-vendor-mobile/src/components/bookings/BookingDetail/BookingDetail.tsx:43-97`; `ezzy-vendor-mobile/src/components/bookings/BookingDetail/BookingDetail.styles.ts:5-74`

The loaded booking detail renders the title and detail cards but no visible route back; `useBookingDetail.ts:26-29` already provides `goBack`, while the current “Back to bookings” button appears only in the error state (`BookingDetail.tsx:25-34`). iOS users can edge-swipe, but that gesture is not self-evident and must not be the sole discoverable return path.

**Fix approach:** insert a compact, borderless left-chevron plus “Back to bookings” Pressable before the existing `ScreenTitle`. Wire it to the existing `s.goBack`, give it a 44pt minimum touch target and an accessible label, and style it using existing theme tokens. Preserve all existing booking cards, values, action bar, error state, and stack gesture behaviour.

**Component separation:** keep handler logic in `useBookingDetail`; the existing `.tsx` only wires `s.goBack` and the existing themed `.styles.ts` owns static link/touch-target styles. No new component or hook is required.

**Verification:** machine — Vendor `npx tsc --noEmit`, `npm test`, and `npm run lint`; live — Android Back gesture/button plus iOS explicit link and native edge-swipe, light/dark themes, largest text size, and VoiceOver/TalkBack. Capture a screenshot before marking done, per the Vendor app’s visual-verification rule.

### I3 — Remove the opaque Booker booking-flow footer panel  🔄 IN PROGRESS (2026-09-23)

**Implementation note (2026-09-23):** The initial removal of `panelBg` and the border did not visually eliminate the footer rectangle in user testing. Revised the style to set an explicit transparent background and zero-width border; the existing LinearGradient parent, safe-area padding, buttons, and handlers remain unchanged. Re-verification is required before this item can be marked done.

**Files:** `ezzy-booker-mobile/src/components/booking/BookingFlow/BookingFlow.tsx:97-114`; `ezzy-booker-mobile/src/components/booking/BookingFlow/BookingFlow.styles.ts:6-19`

Every ready, unbooked flow step renders the same footer over the page `LinearGradient`. Its `backgroundColor: t.panelBg` and `borderTopWidth: 1` create a rectangular bar around the current Continue / payment action. The user-approved treatment is a seamless page background behind the existing controls.

**Fix approach:** remove only the footer’s opaque background and top border, preserving its spacing, safe-area bottom padding, disabled-reason text, button dimensions, Back button, and action handlers. This consistently covers the requested details/review equivalents as well as the other existing booking-flow steps because they share this footer. Do not rename labels or alter payment/booking behaviour.

**Component separation:** no render or hook change is required; update the existing themed `BookingFlow.styles.ts` factory only. The `LinearGradient` remains the parent background, so no new background asset or component is needed.

**Verification:** machine — Booker `npx tsc --noEmit`, `npm test`, and `npm run lint`; live — Android and iOS light/dark screenshots of each ready flow step, keyboard-visible state, safe-area/home-indicator clearance, largest text size, and a disabled Continue state. Confirm the footer is transparent without obscuring content or reducing button contrast.

### I4 — Remove Kiosk “Check payment status” control  ✖ ABORTED (2026-09-23)

**Files investigated:** `ezzy-vendor-mobile/src/components/kiosk/KioskCheckout/KioskCheckout.tsx:95-100`; `ezzy-vendor-mobile/src/components/kiosk/KioskCheckout/useKioskCheckout.ts:70-93,156-164`; `ezzy-vendor-mobile/src/services/kioskPayment.service.ts:19-31`

**Decision:** Do not remove the button. Apple and Google Play do not require this particular status control: both permit external payment methods for the physical services Ezzy books. PayMongo likewise requires no customer-facing polling button; its Hosted Checkout guidance identifies a verified `checkout_session.payment.paid` webhook as the source of truth. However, neither policy allowance nor PayMongo’s webhook contract supplies an alternative client-side recovery path when settlement is delayed or the receipt read fails.

The current button only re-reads the vendor-scoped `bookings.is_paid` truth; it does not trust browser return or expose a PayMongo secret. Removing it would leave a foreground kiosk unable to recover after its 60-second automatic polling period without backgrounding/reopening the app, while copy throughout the flow instructs staff to check again. That is a payment-reliability regression, so the requested removal is rejected.

**Verification:** research — Apple App Review Guideline 3.1.3(e), Google Play Payments Policy §3, and PayMongo Hosted Checkout/Webhooks documentation reviewed on 2026-09-23; code paths opened at the cited lines. No code changed.

### I5 — Modernize Kiosk payment action hierarchy  ✅ DONE (2026-09-23)

**Implementation note (2026-09-23):** Kept Pay with PayMongo / Reopen payment full width and grouped Check payment status plus Done into an equal-width row only when both are actionable. The hook now exposes only display-state booleans; booking creation, receipt reads, polling, and payment handlers are unchanged. Vendor `npx tsc --noEmit`, `npm test` (25/25), `npm run lint`, and Android `npx expo export --platform android` passed; user visually accepted S5 after device review. Live delayed-payment recovery remains advisable before release.

**Files:** `ezzy-vendor-mobile/src/components/kiosk/KioskCheckout/KioskCheckout.tsx:95-100`; `ezzy-vendor-mobile/src/components/kiosk/KioskCheckout/KioskCheckout.styles.ts:32`; `ezzy-vendor-mobile/src/components/common/PrimaryButton/PrimaryButton.tsx:13-34`

After a kiosk booking is created, the action bar renders Pay with PayMongo, Check payment status, and Done as independent full-width rows. This gives recovery and exit actions equal visual weight to the payment action and makes the footer look like an unstructured stack.

**Fix approach:** preserve the existing conditions, handlers, labels, and payment safety flow, but group the actions by intent. Keep Pay with PayMongo / Reopen payment as the only full-width primary action. When both are available, render Check payment status and Done in one equal-width secondary-action row beneath it; each target remains at least 44pt high, labels remain readable at the largest supported text size, and loading prevents duplicate requests exactly as today. If only one secondary action is available, retain its full-width secondary treatment rather than leaving an empty half-row. Do not alter the booking, receipt-read, polling, PayMongo, or Done behaviour.

**Component separation:** modify the existing `KioskCheckout` render layer and its themed `KioskCheckout.styles.ts` only. It wires the existing `s.refresh`/`s.done` handlers; `useKioskCheckout` remains the behaviour and state owner. Reuse `PrimaryButton` unchanged unless its current props prevent a 44pt accessible equal-width row; do not introduce a second button component for one screen.

**Verification:** machine — Vendor `npx tsc --noEmit`, `npm test`, and `npm run lint`; live — Android and iOS screenshots for (1) Pay + Check + Done, (2) Check + Done after browser return, (3) Done-only confirmed receipt, (4) loading/temporary receipt-error state, in light/dark themes and largest text size. Confirm the payment action remains unmistakably primary, all secondary actions are readable/tappable, and the payment recovery route still works.

## DECISIONS

- Transactions spacing → **16pt (`spacing.lg`) before the summary-card section** (resolved 2026-09-23) — approved preview preserves hierarchy without changing the toolbar or cards.
- Booking detail return control → **compact borderless chevron-and-label link** (resolved 2026-09-23) — explicit and accessible, while native iOS edge-swipe and Android Back remain available.
- Booker footer → **transparent and borderless; retain all existing controls and content** (resolved 2026-09-23) — approved preview removes only the unwanted rectangle.
- Kiosk payment-status control → **retain it** (resolved 2026-09-23) — no Apple, Google Play, or PayMongo rule mandates the button, but it is the existing foreground recovery path for delayed or temporarily unreadable payment settlement.
- Kiosk payment action layout → **one primary payment action plus an equal-width secondary row** (resolved 2026-09-23) — preserves recovery and exit controls while giving the payment action clear priority.
- Background art → **not included in this execution plan** (resolved 2026-09-23) — the user has retained the service-illustration exploration as an option, but has not selected it as the product direction.
- Execution → **code implementation approved** (resolved 2026-09-23) — user requested completion; each visual item remains in progress until device verification occurs.

## DEFERRED / COSMETIC

- ⏸ PARKED (2026-09-23) — **Option A: service-illustration background art.** Sparse, flat edge illustrations representing cleaning, barber/wellness, spa, courts, driving, and health on a solid base, with matched light/dark variants. It is intentionally deferred because it changes the broader Booker visual direction, needs separate light/dark and accessibility review, and is not needed to fix the three reported polish issues. **Unblock:** user explicitly selects this option and approves a scoped Booker-only design/implementation plan.

## Execution order

1. **I1 — Vendor Transactions spacing.** Independent and safe once cross-app execution approval is granted.
2. **I2 — Vendor booking-detail return link.** Independent of I1; validate platform navigation after implementation.
3. **I3 — Booker booking-flow footer transparency.** Independent code change, but ship in the same approved cross-app polish batch; run the required Booker flow/device checks.
4. **I4 — no execution.** Keep the Kiosk payment-status control; removal was rejected after store, PayMongo, and code-path review.
5. **I5 — Kiosk payment action hierarchy.** Independent Vendor-only visual change; execute after I4's retained-control decision, then test the payment recovery states.
6. Review screenshots, theme/accessibility results, and plan status before any further visual work. Do not start the parked background-art direction without a new explicit decision.

## Verification limits and release gate

- Static tests and TypeScript compilation validate that the visual edits do not regress compiled code, but cannot validate rendered spacing, transparent backgrounds, touch targets, native gestures, or theme contrast.
- Vendor documentation records that it has not been verified on iOS. I2 cannot be marked complete without the required iOS device/build check, in addition to Android verification.
- Booker is currently a mock-data prototype (`architecture/portals.md:879-882`); the footer change remains UI-only but still needs on-device Android and iOS review before release.
- No dependency, schema, security, or permission approval is required. **Remaining gate:** device verification, not implementation approval, is required before the visual items can be marked DONE.
