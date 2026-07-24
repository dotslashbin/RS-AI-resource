# Vendor app — code review / hardening audit

**Date:** 2026-07-22
**App / scope:** `./vendor` only. Audit/investigation only — **no code changed.** Findings are queued for the user to tackle one at a time later, not executed as part of this plan.
**Status:** DRAFT — investigation complete. Nothing approved for execution yet.

> **Goal:** act as a reviewer on the existing vendor codebase — find real bugs, correctness gaps, and reliability issues (not style nits), grounded in `file:line`, so they can be triaged and fixed one by one.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Deferred/cosmetic; numbers are plan-local.

---

## Method

- `npx tsc --noEmit` — **clean, zero errors.** Used as the baseline machine-verifiable signal.
- `npx eslint .` — **currently broken** in this app (see D2) — could not be used as a signal.
- Read every service (`services/*.ts`), every page-level hook (`use*Page.ts`, `use*Form.ts`), the Supabase client/server/admin/proxy layers, the AppShell orchestration hook (realtime + session), and the layout/dashboard components. Cross-checked several client-side assumptions against the actual RLS policies in `backbone/supabase/migrations/` rather than assuming — two suspected issues (unscoped booking updates, unscoped notification mutations) turned out to be safe because RLS is the real authorization boundary; **dropped as false alarms**, not included below.
- Also ruled out as false alarms: `proxy.ts` (looked like broken/misnamed middleware — verified it's the correct Next.js 16 convention replacing `middleware.ts`) and the `"Josh demo app"` / `"ang.demo.app.ni.josh"` fallback branding in `lib/constants.ts` (looked like leftover placeholder text — verified all three apps in the workspace use the same joke-branding convention consistently, so it's an intentional personal choice, not drift from `.plans/2026-07-14-app-name-env-var.md`'s original "Bookdeck" fallback).

---

## BLOCKERS

### B1 — Offering price silently truncated to whole pesos  ⬜ TODO
**File:** `components/offerings/OfferingFormModal/useOfferingForm.ts:52`

```ts
price: parseInt(ofPrice) || 0,
```

`offerings.price` is `numeric(10,2)` (`backbone/supabase/migrations/20260506000001_offerings.sql:23`) — a real decimal currency column. The price `<input type="number">` (`OfferingFormModal.tsx:67`) has no `step`/pattern restriction, so a vendor can type `"850.50"`. `parseInt("850.50")` returns `850` — the 50 centavos is silently dropped, no rounding, no warning. Every offering priced with centavos (completely normal PH pricing, e.g. ₱99.99, ₱1,499.50) saves wrong, silently, on every single save.
**Fix approach:** `parseFloat(ofPrice) || 0`, or `Math.round(parseFloat(ofPrice) * 100) / 100` if you want to guard against more than 2 decimal places.
**Verification:** machine-verifiable via a quick unit check (`parseFloat("850.50") === 850.5`); manual — save an offering at ₱850.50 and confirm it persists with cents intact.

### B2 — Vendor Calendar opens on a hardcoded month/year, not today  ⬜ TODO
**File:** `components/calendar/CalendarPage/useCalendarPage.ts:9-10`

```ts
const [calMonth, setCalMonth] = useState(3)     // April, 0-indexed
const [calYear, setCalYear]   = useState(2026)
```

Hardcoded to April 2026 — clearly a leftover dev/demo value. The sibling hook for the Schedule page (`components/schedule/SchedulePage/useSchedule.ts:6-7`) does this correctly: `useState(now.getMonth())` / `useState(now.getFullYear())`. Concrete, already-live impact: **today is 2026-07-22**, so the Calendar page currently opens three months behind, every time, for every vendor, until they manually click "next" repeatedly.
**Fix approach:** mirror `useSchedule.ts` — derive initial state from `new Date()`.
**Verification:** machine-verifiable (read the diff); manual — open Calendar and confirm it opens on the current month.

### B3 — Editing a Schedule loses/blocks the Offering selection, and fixing it wipes the assigned staff  ⬜ TODO
**File:** `components/schedule/ScheduleFormModal/useScheduleForm.ts:16-27` (hydration effect), `:29-35` (`selectOffering`)

The effect that seeds form state from `editSched` sets date/time/end/days/repeat/staff/max/title — but never sets `sfOffering`. `sfOffering` starts `null` and there's no lookup from `editSched.offeringId` into the `offerings` prop to hydrate it. Concrete repro:
1. Vendor opens "Edit Schedule" on an existing schedule that has staff assigned.
2. The Offering picker shows nothing selected → `canSave = !!sfOffering && ...` (`ScheduleFormModal.tsx:48`) is `false` → **Save Changes is disabled**, with no visible explanation.
3. Vendor clicks the (correct, same) offering pill to fix it → `selectOffering` (`useScheduleForm.ts:34`) unconditionally runs `setSfInst("")` → the previously-assigned staff member is silently cleared.
4. Vendor saves → staff assignment is lost.

**Fix approach:** hydrate `sfOffering` in the `editSched` effect (look it up from a passed-in `offerings` list by `editSched.offeringId`); make `selectOffering`'s staff reset conditional on the offering actually changing (skip the reset when re-selecting the same offering that was already hydrated).
**Verification:** manual — edit a schedule with an assigned staff member; confirm the offering is pre-selected, Save is enabled immediately, and the staff assignment survives a save without being touched.

### B4 — `updateStaff` can permanently wipe specialties on a transient failure  ⬜ TODO
**File:** `services/staff.service.ts:129-159`

Order of operations: update the staff row → **delete all existing `staff_specialties` rows** (`:148`) → resolve new specialty codes to offering ids (`:150`) → insert the new rows (`:152-157`). There is no transaction (no RPC), so if `resolveSpecialtyIds` or the subsequent insert fails *after* the delete has already succeeded (a transient network/Supabase error — genuinely possible, not exotic), the staff member's specialties are gone, permanently, while the function returns an error and the UI shows `toast.error(...)` implying the save simply didn't happen. The perceived failure and the actual (partial) data loss don't match.
**Fix approach:** either wrap the three steps in a Postgres function/RPC (real transaction), or reorder to insert-then-delete-stale (insert new rows first, delete only the ones no longer needed) so a failure never leaves zero specialties as an intermediate state.
**Verification:** needs a live environment — simulate a failure between delete and insert (e.g. temporarily break `resolveSpecialtyIds`) and confirm specialties are no longer at risk of full loss.

---

## IMPORTANT

### I1 — Dashboard's quick-reject is a destructive one-click action with no reason and no confirmation  ⬜ TODO
**File:** `components/dashboard/PendingApprovalsCard/PendingApprovalsCard.tsx:37`

```tsx
<button onClick={() => rejectB(b.id, "")} ...>✕</button>
```

The full Bookings page's equivalent action (`components/bookings/BookingRow/BookingRow.tsx:39-69`, backed by `useBookingRow.ts`) opens an inline reason textarea with explicit "Confirm Reject" / "Cancel" buttons before calling `rejectB`. The Dashboard card skips all of that — a single accidental click instantly cancels the booking with a permanently blank `rejection_reason`, no undo. Same underlying action (`rejectBooking`), inconsistent gating.
**Fix approach:** either route the Dashboard card's reject button through the same confirm+reason flow, or at minimum add a confirmation step before calling `rejectB`.
**Verification:** manual — click reject from the Dashboard card and confirm it no longer fires immediately without a reason/confirmation.

### I2 — Inconsistent, silent error handling across list-fetch functions  ⬜ TODO
**Files:** `services/bookings.service.ts:36-62` (`getBookings`), `services/staff.service.ts:80-89` (`getStaff`), `services/notifications.service.ts:7-23` (`getNotifications`) — all swallow the Supabase error and return `[]`, indistinguishable from "genuinely no rows." Contrast with `services/offerings.service.ts:30-39` and `services/schedules.service.ts:54-65`, which correctly return `{ data, error }` and let the caller show a real error state.
**Fix approach:** bring the three swallowing functions in line with the `{data, error}` convention already established elsewhere in the same file set; surface a toast/error state in the consuming hooks (`useAppShell.ts`, `useKycStatusPage.ts` isn't affected, notification panel) the same way `useOfferingsPage.ts`/`useSchedulePage.ts` already do.
**Verification:** manual — force a query error (e.g. temporarily revoke a grant locally) and confirm the UI now distinguishes "failed to load" from "empty."

### I3 — `resolveSpecialtyIds` silently drops unmatched specialty codes  ⬜ TODO
**File:** `services/staff.service.ts:68-78`

Queries `offerings` `.in("code", specs)` and returns whatever matched — no check that the returned count matches `specs.length`. If a staff member's saved specialty code no longer matches any offering (renamed code, deleted offering), it's dropped from what gets written with zero warning to the vendor at save time.
**Fix approach:** compare resolved count to `specs.length`; if they differ, surface which codes didn't resolve (either block the save with a message, or warn-and-proceed — a decision for whoever picks this up).
**Verification:** manual — rename an offering's code after a staff member is assigned to it as a specialty, then save that staff member's profile unchanged; confirm the vendor is told the specialty was dropped.

### I4 — `notifications.service.ts` mutations discard the actual error  ⬜ TODO
**File:** `services/notifications.service.ts` — `setReadStatus`, `markAllAsRead`, `archiveNotification`, `archiveAllRead`, `deleteNotification` all return bare `boolean`, throwing away `error.message`. Every other mutation service in this app (`offerings.service.ts`, `schedules.service.ts`, `staff.service.ts`) returns `{error: string | null}`. Callers in `useAppShell.ts` (`:315-361`) can only show a generic `"Failed to ..."` toast with no specifics, and there's no way to distinguish an RLS denial from a network blip from a genuine server error.
**Fix approach:** change the five functions to return `{error: string | null}` to match the rest of the codebase; update the five call sites in `useAppShell.ts` accordingly (small, mechanical).
**Verification:** machine-verifiable (`tsc --noEmit` after the signature change propagates); manual — force one of these to fail and confirm the toast now shows a specific message.

### I5 — `vendor/lib/supabase/server.ts` is dead code  ⬜ TODO
**File:** `lib/supabase/server.ts`

Confirmed via a full-repo grep for `supabase/server` and for `next/headers`/`cookies()` usage — **nothing in the vendor app imports this file.** This app is a pure client-rendered SPA (`app/page.tsx` renders one client component tree, `AppShell`); there's no server component or route handler that reads the user's session cookie. `proxy.ts` (D1) also produces no consumer for the session it refreshes.
**Fix approach:** remove it, unless it's intentionally kept as scaffolding for a future SSR page — if so, a one-line comment saying so would save the next reviewer from re-flagging it.
**Verification:** machine-verifiable — `tsc --noEmit` + a repo-wide grep confirming zero remaining references before deletion.

---

## DEFERRED / COSMETIC

- **D1 — `proxy.ts` may be doing useless work.** Verified it's the correct Next.js 16 `middleware.ts` replacement (not a bug — see Method). It calls `supabase.auth.getUser()` on every matched request purely to refresh/sync the session cookie, but per I5, nothing server-side in this SPA currently reads that cookie. Likely harmless (small per-request latency, no functional impact) and may be intentional future-proofing for an eventual SSR page — confirm intent rather than assume; not worth acting on alone.
- **D2 — `npm run lint` is broken.** `npx eslint .` throws `TypeError: Converting circular structure to JSON` from inside `@eslint/eslintrc`'s config validator (react plugin config has a circular reference it can't stringify for its error formatter). `tsc --noEmit` was used as the substitute signal for this review, but lint should be fixed so it's usable as an actual gate again — likely an ESLint 9 flat-config / `eslint-config-next` version mismatch, worth a focused look on its own.
- **D3 — Deactivated offerings' specialties are invisible (not lost) in the Staff edit form.** `components/staff/StaffFormModal/useStaffForm.ts:36` only fetches `status === "active"` offerings for the specialty checkboxes. A specialty tied to a since-deactivated offering survives saves untouched (confirmed — I3's `resolveSpecialtyIds` doesn't filter by `is_active`), but a vendor can't see or remove it from the edit UI until the offering is reactivated. Minor, not data-lossy.
- **D4 — Sidebar hardcodes "Admin Account."** `components/layout/Sidebar/Sidebar.tsx:101` shows the literal string "Admin Account" under the user's email, regardless of who's actually signed in. Purely cosmetic.
- **D5 — Booking approve/reject has no optimistic-concurrency guard.** `services/bookings.service.ts:64-79` (`approveBooking`/`rejectBooking`) update by `id` alone, with no `.eq("status", "pending")` guard. Two concurrent actions (two tabs, or a stale UI after another admin already acted) can silently overwrite each other with no conflict signal. Low real-world likelihood for a single-vendor-admin flow, but a one-line `.eq("status", "pending")` + checking `count`/`error` would close it cheaply if picked up.

---

## Execution order (for when these are picked up)

Not being executed now — ordering here is a starting suggestion for later, by independence and risk:

1. **B1, B2** — one-line fixes, fully independent, no coupling to anything else. Do these first.
2. **B3** — independent, contained to `useScheduleForm.ts`/`ScheduleFormModal.tsx`.
3. **I1** — independent, contained to `PendingApprovalsCard.tsx` (possibly reusing `useBookingRow`'s reason-prompt pattern).
4. **B4, I3** — coupled: both touch `staff.service.ts`'s specialty-resolution path; worth doing together since I3's fix (surfacing unmatched codes) interacts with how B4's reordering handles partial failures.
5. **I2, I4** — coupled: both are "bring error handling in line with the rest of the codebase" — same shape of change, touch overlapping files (`useAppShell.ts`), best batched.
6. **I5** — independent, trivial (delete + verify no references), but do it after confirming D1's intent (if `proxy.ts`/session-refresh is meant to stay for future SSR, keep `server.ts` and document why instead of deleting).
7. **D1–D5** — no urgency; pick up opportunistically.

## Verification

- **Machine-verifiable:** B1 (unit-level arithmetic check), B2/I5 (`tsc --noEmit` + diff read), I2/I4 (`tsc --noEmit` after signature changes propagate).
- **Needs a live environment:** B3, B4, I1, I3, D5 — all require exercising the actual UI/DB (form flows, forced-failure simulation, concurrent actions) to confirm.
