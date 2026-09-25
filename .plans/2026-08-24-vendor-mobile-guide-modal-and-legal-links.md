# Ezzy Vendor Mobile — guide modal and legal-link parity

**Date:** 2026-08-24
**App / scope:** `ezzy-vendor-mobile` only. `vendor` is read as the reference for
guide content and legal URLs; no `vendor`, `command`, `backbone`, or `ezzy.ph`
implementation happens in this plan.
**Status:** COMPLETE (2026-09-24) — Stage 4: the user confirmed the guide popup and legal links on an Android device. Last recorded: IN PROGRESS — stages 1-3 code-complete and machine-verified on 2026-08-24;
Android device visual/link verification remains open in Stage 4.

> One-line framing: bring the mobile vendor guide and Settings legal links back into
> parity with the vendor portal/account-deletion work, while removing the inline
> guide card from the dashboard so the main screen stays focused on live operations.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = blocker for this requested change, I# = important,
> D# = decision. Numbers are plan-local.

---

## Findings

### F1 — The vendor account-deletion plan did include the guide-modal update ✅ VERIFIED
**Source:** `.plans/2026-08-21-vendor-account-deletion.md:1192`

The update exists as **I18 — The Getting Started guide never mentioned closing an account**,
marked ✅ DONE. It added a **Closing Your Account** section to
`vendor/components/dashboard/GuideModal/guideItems.ts`, and the plan records its claims:
Settings entry point, scope choice, typed confirmation, cancellation until completion,
30-day completion wording, eligibility blockers, sole-admin handling, and what is deleted vs
kept.

The vendor guide item itself is at
`vendor/components/dashboard/GuideModal/guideItems.ts:130`. Its important constraints are:
one-word `tabLabel: "Closing"` and slate `#64748b`, not red, so closure reads as a normal
right rather than a warning state.

### F2 — Mobile already has the deletion/privacy repoint, but not the full legal-link set
**Files:** `ezzy-vendor-mobile/src/lib/constants.ts:40`,
`ezzy-vendor-mobile/src/components/settings/SettingsList.tsx:150`

The mobile app already has unconditional `PRIVACY_POLICY_URL` and
`ACCOUNT_DELETION_URL` constants, and Settings renders privacy + deletion links without the
`EXPO_PUBLIC_VENDOR_PORTAL_URL` gate. That closes the narrow 08-21 Stage C mobile gap.

What is still missing after the newer vendor legal update:
- Terms of Use
- Acceptable Use Policy
- Cookie Policy
- Refund & Cancellation Policy
- Payment Policy

The canonical display list to copy/adapt is `vendor/lib/legal.ts:43`: seven policy links,
including `Account & Data Deletion` at `/account-data-deletion/` and `Payment Policy` at
`/payment-policy/` (singular).

### F3 — Mobile guide is still an inline dashboard card
**Files:** `ezzy-vendor-mobile/src/components/dashboard/DashboardView.tsx:219`,
`ezzy-vendor-mobile/src/components/dashboard/GuideCard/GuideCard.tsx:30`

The current guide is rendered inline inside dashboard scroll content, between the stats and
the approval preview. The dashboard route already owns guide state and has a header
`GuideAction` (`app/(app)/dashboard.tsx:17`), so the clean migration is to keep that entry
point and swap the body from inline card to modal.

### F4 — Existing mobile modal pattern covers sheets; the guide wants a full-screen modal
**Files:** `ActionInfoSheet.tsx:50`, `RejectReasonSheet.tsx:59`,
`hooks/useBottomInset.ts:30`

The app already uses `Modal` + transparent backdrop + bottom sheet for short explanatory and
destructive-adjacent surfaces. That pattern is useful precedent for lifecycle and dismissal
(`onRequestClose`, explicit close, `useBottomInset({ tabBar: false })`), but the guide is
longer than those sheets and should not be squeezed into a small centred dialog.

**Recommendation after review (2026-08-24):** implement the guide as a full-screen modal
surface with a header and scrollable body. It still opens as a popup over the dashboard and
consumes no dashboard layout space, but it gives long help content room to breathe and behaves
better at large text sizes than a centred dialog.

---

## BLOCKERS

### B1 — Settings legal links must match the updated legal policy list 🔄 IN PROGRESS (2026-08-24)
**Files:** `src/lib/constants.ts:40`, `src/components/settings/SettingsList/useSettingsList.ts:5`,
`src/components/settings/SettingsList/SettingsList.tsx:122`

**Gap:** Settings only exposes Privacy Policy and Delete Account. The vendor legal list now
publishes seven policy links (`vendor/lib/legal.ts:43`), including Cookie Policy and Payment
Policy. Mobile should show the same policy set because stores and users treat Settings as
the in-app legal surface.

**Fix approach:** replace the two one-off legal URL constants with a copied mobile-local
`LEGAL_LINKS` list matching `vendor/lib/legal.ts`, plus a helper shape suitable for mobile
Settings. Render a dedicated **Legal** section in Settings with all seven policy links.
Keep `Delete account` in the Account section as the red action row, pointing at the same
Account & Data Deletion URL; remove the standalone Privacy row from Account to avoid
duplicating it.

**Component convention:** no new Settings component. `SettingsList.tsx` remains the render
layer; `useSettingsList.ts` owns `openLegalLink` / `openAccountDeletion`; `SettingsList.styles.ts`
is changed only if existing row/card styles cannot support the Legal section cleanly.

**Executed 2026-08-24:** copied the seven-policy legal link list into mobile constants,
rendered a dedicated Settings Legal section, kept Delete account as the red Account action,
and kept all legal/deletion links independent of `EXPO_PUBLIC_VENDOR_PORTAL_URL`.
**Verified (machine):** `tsc --noEmit`, `expo lint`, `npm test`, and Android `expo export`
all pass. **Still open:** tap every Settings legal row on a physical Android build and
confirm each URL opens the expected ezzy.ph page.

### B2 — Mobile guide content must include account closure, adapted to what the phone can do 🔄 IN PROGRESS (2026-08-24)
**File:** `src/components/dashboard/GuideModal/guideItems.ts:50`

**Gap:** The mobile guide has Dashboard, Pending approvals, Bookings, Completing a booking,
Transactions, and Notifications. It does not mention account deletion or the new
`ezzy.ph/account-data-deletion/` path, while the vendor portal guide does.

**Fix approach:** add a mobile-specific **Closing your account** guide item using `DoorOpen`
from `lucide-react-native` and slate `#64748b`. Do not copy the web text verbatim: mobile
does not contain the in-portal closure form. It should say the Settings account-deletion row
opens Ezzy's Account & Data Deletion page, that the vendor portal handles the signed-in
request flow, what blocks closure, and what is deleted versus retained at a high level.
Keep the guide scoped to phone-visible workflows; point to ezzy.ph/vendor portal for the
rest.

**Verification target:** a focused unit/static test should assert the guide contains exactly
one closure item and that its body or actions include the real `/account-data-deletion/`
concept without importing a native module that breaks Node tests. If importing
`guideItems.ts` proves unsafe under `node --test` because of icon imports, skip the test and
record that verification is type/lint/device only.

**Executed 2026-08-24:** added a mobile-specific **Closing your account** guide item with the
real Account & Data Deletion URL, closure blockers, removed data, and retained data. The copy
is intentionally mobile-scoped and does not claim the signed-in closure form exists in the app.
**Verified (machine):** `tsc --noEmit`, `expo lint`, `npm test`, and Android `expo export`
all pass. **Still open:** review the content in the full-screen guide on Android at normal and
large font sizes.

---

## IMPORTANT

### I1 — Convert the dashboard guide from inline card to popup modal 🔄 IN PROGRESS (2026-08-24)
**Files:** `src/app/(app)/dashboard.tsx:17`,
`src/components/dashboard/DashboardView/DashboardView.tsx:219`,
`src/components/dashboard/GuideModal/GuideModal.tsx:17`,
`src/components/dashboard/GuideModal/useGuideModal.ts:13`

**Gap:** The guide consumes dashboard scroll space. The header guide button already exists,
but it currently toggles visibility of a card inside the dashboard content.

**Fix approach:** replace `GuideCard` with a `GuideModal` component backed by the migrated
`useGuideModal` persistence logic. The route continues to own state because it is the common
ancestor of `GuideAction` and `DashboardView`; `DashboardView` no longer receives guide props
or renders the guide wrapper. The modal should use the app's bottom-sheet modal pattern:
`Modal`, transparent backdrop, scrollable content, explicit close action, Android
`onRequestClose`, and bottom inset with `tabBar: false`.

**Component convention:**
- `GuideModal.tsx`: pure render layer for the modal shell/content.
- `useGuideModal.ts`: owns persisted open/hidden state and handlers while preserving the
  existing `ezzy.vendor.guideHidden` storage key.
- `GuideModal.styles.ts`: static styles via `makeStyles(tokens)`.
- `guideItems.ts`: data only, no React state.

**UX constraints:** opening the guide should not scroll the dashboard; the modal overlays it.
The dashboard's primary content becomes stats + approval preview. Dismissal must be available
via hardware back and an explicit button; backdrop dismissal is optional for full-screen modal
presentation. Touch targets stay >= 44pt, content must scroll at large text sizes, and both
light/dark themes need device verification.

**Executed 2026-08-24:** replaced the inline `GuideCard` with a full-screen `GuideModal`,
preserving the old `ezzy.vendor.guideHidden` storage key so dismissed guides do not reappear
just because the surface changed. The modal is opened by the existing header guide button and
uses a scrollable full-screen layout with explicit close and Done actions.
**Verified (machine):** `tsc --noEmit`, `expo lint`, `npm test`, Android `expo export`, and
`rg` confirm no stale `GuideCard` references remain. **Still open:** Android screenshots in
light/dark and largest font size, plus hardware-back dismissal check.

### I2 — Clean up stale guide-card assumptions after the modal move 🔄 IN PROGRESS (2026-08-24)
**Files:** `src/components/layout/GuideAction/GuideAction.tsx:20`,
`src/components/dashboard/DashboardView/useDashboardView.ts:39`,
`src/components/dashboard/DashboardView/DashboardView.tsx:210`

**Gap:** Several comments and code paths exist only because a hidden inline card had to be
scrolled into view. Once the guide is a modal, `onGuideLayout`, `scrollRef` guide scrolling,
and comments about the card's dashboard position become stale.

**Fix approach:** remove guide-layout scrolling from `useDashboardView`, simplify the
dashboard route props, and update `GuideAction` wording from expanded/collapsed card
language to modal open/closed language. Keep the single header entry point.

**Executed 2026-08-24:** removed `guideHidden`, `onHideGuide`, `onGuideLayout`, `scrollRef`,
and the scroll-to-guide effect from the dashboard view/hook; updated `GuideAction` to open/close
modal language. **Verified (machine):** `tsc --noEmit`, `expo lint`, `npm test`, Android
`expo export`, and `rg` confirm stale guide-card plumbing is gone. **Still open:** visual
confirmation that the dashboard approval preview now follows the stats directly.

---

## DECISIONS

- **D1 — Modal shape:** use a **full-screen modal**, not a centred dialog and not a
  constrained bottom sheet (resolved 2026-08-24 after user review). A centred dialog is best
  for short confirmation/choice content; this guide is long documentation with action
  glossaries, so a centred box would either be cramped or become a poor scroll surface on
  smaller Android screens. A full-screen modal still satisfies the user's "popup, not inline"
  goal while preserving readable content and large-text behaviour.
- **D2 — Legal Settings layout:** create a dedicated Legal section for the seven policy
  documents, while keeping Delete account as a red Account action. This avoids hiding
  deletion among neutral policy rows while still exposing Account & Data Deletion in the
  policy list.
- **D3 — Account closure guide wording:** mobile describes the phone path and links out;
  it does not promise the signed-in portal closure modal exists inside the app.

---

## DEFERRED / OUT OF SCOPE

- Building native in-app account deletion. The mobile app stays sign-in only and opens the
  public deletion page / vendor portal flow.
- Updating `vendor`, `command`, `backbone`, or `ezzy.ph`. This plan only copies/adapts
  their already-shipped content into mobile.
- iOS device verification remains parked until Apple Developer Program access exists, per
  the existing release-readiness plans.

---

## Execution Order

| Stage | Items | Main files | Gate | Verification |
|---|---|---|---|---|
| **1** | 🔄 B1 — legal links parity | `constants.ts`, `useSettingsList.ts`, `SettingsList.tsx` | None | Machine checks pass; Android link taps pending |
| **2** | 🔄 B2 — add closure guide content | `guideItems.ts` | None | Machine checks pass; Android content review pending |
| **3** | 🔄 I1/I2 — replace inline guide card with full-screen modal | dashboard route/view, `GuideModal/*`, `useGuideModal.ts`, remove stale guide scrolling | Visual/device verification required | Machine checks pass; Android screenshots/back-button checks pending |
| **4** | Final release-readiness verification for this slice | all touched mobile files | Device required | Android smoke: Settings legal links, Account deletion link, guide opens/closes from header, no dashboard space consumed |

---

## Verification Plan

- Machine: `ezzy-vendor-mobile/node_modules/.bin/tsc --noEmit --project ezzy-vendor-mobile/tsconfig.json`
- Machine: `npm --prefix ezzy-vendor-mobile run lint`
- Machine: `npm --prefix ezzy-vendor-mobile test`
- Machine, if route/modal changes warrant it: `npx expo export --platform android` from
  `ezzy-vendor-mobile`
- Device: physical Android dev/preview build, both light and dark themes.
- Device: largest OS font size pass for Settings and Guide modal.
- Device: TalkBack spot-check for modal open/close, Legal rows, and Delete account row.
- Manual URL check: each legal row opens the expected `https://ezzy.ph/.../` URL; no link is
  gated by `EXPO_PUBLIC_VENDOR_PORTAL_URL`.

**Machine verification run 2026-08-24:** `tsc --noEmit` clean; `expo lint` clean;
`npm test` passed 10/10 test files; `npx expo export --platform android --output-dir
/tmp/ezzy-vendor-mobile-export` succeeded.

---

## Review Notes

Stages 1-3 are code-complete and machine-verified. They stay 🔄 IN PROGRESS rather than
✅ DONE until Stage 4 confirms the Android device behaviours that cannot be proven by static
checks: real link opening, full-screen guide readability, theme/font-size rendering, hardware
back dismissal, and dashboard spacing.
