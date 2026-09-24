# Ezzy Vendor Mobile: kiosk welcome and action-bar polish

**Date:** 2026-09-24  
**App / scope:** `ezzy-vendor-mobile` kiosk mode only.  
**Status:** IN PROGRESS

> Make the customer-details and agreements continuation areas blend with the kiosk gradient, and make the kiosk welcome choices follow the existing vendor-web card treatment.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.  
> **Numbering legend:** B# = blocker, I# = important item; S# = execution stage. Numbers are plan-local.

---

## Scope and boundaries

**In:** the native kiosk customer-details/agreements continuation area and its welcome-screen choice cards in `ezzy-vendor-mobile`.

**Out:** the web `vendor` app, booking/availability/payment behaviour, text-entry validation, checkout/receipt layouts, data services, schema/RLS, dependencies, and device-lockdown policy.

**Data/security assessment:** presentation-only. Existing customer-data lifetime, agreement gating, payment browser handoff, idle reset, and kiosk containment must remain unchanged. No database, API, permissions, or secrets are involved.

## Findings

- **F1 — the normal-flow catalogue action area is the correct native precedent.** `ezzy-vendor-mobile/src/components/kiosk/KioskCatalogue/KioskCatalogue.styles.ts:34-38` gives its booking summary no background, border, blur, or overlay, allowing the kiosk gradient to remain continuous while ensuring the final selectable item cannot be hidden.
- **F2 — the customer-details action area already has the requested style staged, but is unverified user work.** The staged change at `ezzy-vendor-mobile/src/components/kiosk/KioskCustomerForm/KioskCustomerForm.styles.ts:16` changes the action bar from `modalBg` plus divider to transparent/no divider. It must be preserved and visually checked; do not overwrite or claim it as newly implemented without ownership confirmation.
- **F3 — agreements uses the customer form's enclosing action area.** `KioskCustomerForm.tsx:23-47` renders `KioskAgreements` inside its scroll region and one shared Continue bar beneath it, so correcting/validating the parent action bar covers both requested screens without duplicating styles in `KioskAgreements`.
- **F4 — the vendor-web welcome pattern is explicit and portable.** `vendor/components/kiosk/KioskShell/KioskShell.tsx:124-148` uses `CalendarDays` and `CheckCircle2`, with the exact supporting copy: “Pick a service, choose a time and pay here.” and “Return an item or confirm your session is done.” Its `KioskShell.module.css:76-109` establishes large, icon-led, touch-first cards: primary blue gradient for booking and a neutral secondary card for close-out.
- **F5 — the mobile welcome currently uses generic full-width buttons.** `ezzy-vendor-mobile/src/components/kiosk/KioskShell/KioskShell.tsx:47-50` renders `PrimaryButton` instances only. `KioskShell.styles.ts:17-18` has a centred welcome layout but no choice-card styling. The existing shell hook already owns the callbacks at `useKioskShell.ts:125-126`.
- **F6 — the current branch contains unrelated staged work.** `git status` shows staged edits in BookingDetail, TransactionsView, and KioskCheckout, in addition to the customer-form action-bar change. This plan must stage/commit only its explicit kiosk files and never reset, amend, or reformat those unrelated edits.

## BLOCKERS

### B1 — Confirm staged customer-details action-bar ownership  ✅ DONE (2026-09-24)
**Files:** `ezzy-vendor-mobile/src/components/kiosk/KioskCustomerForm/KioskCustomerForm.styles.ts:16`; current staged index

**Gap:** The exact change required by I1 is already staged in a working tree that also contains unrelated work. It is not safe to alter, unstage, or include it in a new implementation batch without knowing whether it is part of this request.

**Fix approach:** Get the user's confirmation that the staged transparent/no-divider customer action bar belongs to this kiosk polish. If confirmed, preserve it as the starting point and validate it; if not, leave it untouched and ask for a clean branch or a user-provided commit boundary.

**Risk / guardrail:** Never use `reset`, `checkout`, broad `git add`, or amend another change to resolve this. This is a working-tree boundary, not a code defect.

**Resolved / verified:** User confirmed on 2026-09-24 that the staged transparent/no-divider customer action bar belongs to this kiosk polish. It remains protected as plan-owned work; the unrelated staged edits remain out of scope.

## IMPORTANT

### I1 — Continuous gradient at customer-details and agreements continuation  🔄 IN PROGRESS (2026-09-24)
**Files:** `ezzy-vendor-mobile/src/components/kiosk/KioskCustomerForm/KioskCustomerForm.tsx:23-47`; `ezzy-vendor-mobile/src/components/kiosk/KioskCustomerForm/KioskCustomerForm.styles.ts:5-16`; reference `ezzy-vendor-mobile/src/components/kiosk/KioskCatalogue/KioskCatalogue.styles.ts:34-38`

**Gap:** A filled, divided bottom container on the details/agreements steps interrupts the kiosk gradient and reads as a rectangle, unlike the already-approved offering/time action area.

**Fix approach:** Retain the shared parent action area in normal flex flow, remove its static background and divider, and keep only sufficient top/safe-area padding. Do not add a floating overlay, blur, opacity layer, or scroll listener. The `KioskCustomerForm.tsx` render layer remains declarative; no hook or data-service change is needed; static styles remain in `KioskCustomerForm.styles.ts`.

**Risk / guardrail:** Continue remains an explicit 44pt+ target, keyboard-safe, and reachable after scrolling long agreement text. Agreement state, document opening, error copy, and continuation gating are unchanged.

**Executed / verified:** Preserved the user-confirmed staged transparent/no-divider action bar in `KioskCustomerForm.styles.ts`; the shared parent covers both customer-details and agreements. TypeScript, lint, 25 tests, and `git diff --check` passed on 2026-09-24. Android light/dark scrolling and keyboard validation remain S3 work.

### I2 — Vendor-web-equivalent kiosk welcome choices  🔄 IN PROGRESS (2026-09-24)
**Files:** `ezzy-vendor-mobile/src/components/kiosk/KioskShell/KioskShell.tsx:1-50`; `ezzy-vendor-mobile/src/components/kiosk/KioskShell/KioskShell.styles.ts:1-18`; `ezzy-vendor-mobile/src/components/kiosk/KioskShell/useKioskShell.ts:125-126`; reference `vendor/components/kiosk/KioskShell/KioskShell.tsx:124-148`, `vendor/components/kiosk/KioskShell/KioskShell.module.css:76-109`

**Gap:** The native “Book something” and “Finish a booking” controls lack the web kiosk's icon-led hierarchy and explanatory copy, making the two customer jobs less immediately understandable.

**Fix approach:** Replace only the ready-state welcome `PrimaryButton` renderings with two accessible native `Pressable` cards: `CalendarDays` with the existing booking callback and blue primary gradient; `CheckCircle2` with the existing close-out callback and neutral tokenised surface. Use the vendor web's exact labels and supporting messages: “Book something” / “Pick a service, choose a time and pay here.” and “Finish a booking” / “Return an item or confirm your session is done.” Keep card touch targets at least 44pt, use `lucide-react-native` already installed, and adapt the two-column web grid to a vertically stacked mobile layout.

**Risk / guardrail:** Do not duplicate callbacks or move logic into `KioskShell.tsx`; `useKioskShell.ts` remains the sole owner of navigation handlers. Preserve light/dark contrast, font scaling, labels/hints, pressed/disabled feedback, and the existing kiosk unavailable state.

**Executed / verified:** Replaced the two ready-state `PrimaryButton` controls with accessible, vertically stacked `Pressable` cards using `CalendarDays` / `CheckCircle2`, existing hook callbacks, the primary-gradient token, exact vendor-web copy, and co-located themed styles. TypeScript, lint, 25 tests, and `git diff --check` passed on 2026-09-24. Android visual/accessibility validation remains S3 work.

## DECISIONS

- **D1 — staged action-bar change** → **Retain as plan-owned work** (resolved 2026-09-24). The user confirmed it belongs to this kiosk polish; validate it as I1 while leaving unrelated staged edits untouched.
- **D2 — welcome-card visual approval** → **Approved** (resolved 2026-09-24). The user approved the generated light/dark preview of vertically stacked, icon-led cards with the exact vendor-web labels and supporting copy.

All design decisions are resolved. The plan is ready for execution approval.

## DEFERRED / COSMETIC

- **P1 — Checkout action-bar transparency** ⏸ PARKED (2026-09-24) — checkout is explicitly outside this request and has staged work of its own. Unblocked only by a separate user request with a safe working-tree boundary.
- **P2 — Web kiosk changes** ⏸ PARKED (2026-09-24) — web is the visual reference only; the request is mobile-only. Unblocked by a separate, explicit vendor-web request.

## Execution order

1. **S0 — resolve safeguards and visual direction:** B1, D1, D2. ✅ DONE (2026-09-24) — user confirmed staged-change ownership and approved the native welcome-card preview.
2. **S1 — gradient-continuity implementation:** I1. 🔄 IN PROGRESS (2026-09-24) — confirmed static style retained and machine checks passed; the required device visual check is deferred to S3.
3. **S2 — welcome-card implementation:** I2. 🔄 IN PROGRESS (2026-09-24) — cards and themed styles implemented; the required device visual/accessibility check is deferred to S3.
4. **S3 — verification and handoff:** Run machine checks and Android visual acceptance for both themes, large text, TalkBack, safe areas, long agreements, and the primary/secondary choice actions. Report iOS validation honestly if unavailable.

## Verification

- **Machine-verifiable:** `tsc --noEmit`, `npm run lint`, `npm test`, and `git diff --check` from `ezzy-vendor-mobile`; ensure only plan-owned files are staged for its eventual commit.
- **Needs device/live environment:** Android screenshots and interaction checks on customer details, a long agreements document, welcome, unavailable state, light/dark, largest text, safe-area placement, keyboard behaviour, and TalkBack. Verify iOS VoiceOver/navigation if an iOS build/device is available; otherwise record it as deferred.
- **Visual acceptance criteria:** no rectangular action-bar fill/divider on the customer-details or agreements continuation area; final content remains visible and Continue reachable; two welcome cards make booking visually primary but close-out equally discoverable; exact vendor-web supporting messages are present; no behaviour/data change.

## Plan review (2026-09-24)

This plan deliberately does not copy the web's desktop grid or its action bar: native uses a stacked, touch-friendly card layout and a normal-flow transparent continuation area. It avoids an unnecessary shared component because there are exactly two welcome cards in one screen. The plan preserves the app's render/hook/style split: `KioskShell.tsx` stays a pure render layer, `useKioskShell.ts` retains handlers, and all static presentation lives in `KioskShell.styles.ts`; I1 requires static changes only in the customer-form style file.
