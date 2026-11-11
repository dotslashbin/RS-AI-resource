# Booker — outstanding follow-ups

**Date:** 2026-11-04
**App / scope:** booker/ web only. A holding document for booker problems found during other work and not fixed there.
**Status:** DRAFT — holding document. Each item is reported, not scheduled; the user picks items up into their own plan.

> Where booker findings go when they are outside the plan that found them. Like
> `2026-08-25-vendor-launch-followups.md` for vendor. An item stays open until the user closes it.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** F# = follow-up finding. Numbers are plan-local; cross-plan references are qualified by plan.

Release: none (holding document. Each item ships through the plan that picks it up).

---

## F1 — `npm run lint` fails on the release branch  ⬜ TODO
*Moved here 2026-11-04 from `2026-11-04-booker-portrait-photo-square-cover.md` F3, which found it. Not part of that change.*
**State (measured 2026-11-04 on `release/version-0.30.3`, 0.30.5):** `npm run lint` exits 1 with **18 problems (14 errors,
4 warnings)**. The count matches the "pre-existing 18" recorded by `2026-10-19-booker-circle-free-marks.md`, so it has
been carried at least since then.
**Files:** `app/not-found.tsx` (`<a>` to `/` instead of `<Link>`) · `app/ui-gallery/page.tsx:1163` ("Cannot create
components during render") and `:285` (unused `OFFERINGS`) · `components/auth/LoginPage/useLoginPage.ts:43` ·
`components/booking/BookingWizard/useBookingWizard.ts:64` · `components/booking/steps/Step3Schedule/useStep3Schedule.ts:103`
(three × "setState synchronously within an effect") · `components/booking/steps/Step6Confirm/Step6Confirm.tsx` ·
`components/booking/steps/StepPayment/StepPayment.tsx` · `components/layout/AppShell/useAppShell.ts:168`, `:668` ·
`components/layout/InstallPrompt/InstallPrompt.tsx` · `components/layout/InstallPrompt/useInstallPrompt.ts:37` ·
`components/settings/SettingsPage/useSettingsPage.ts:32` · `services/booker.service.ts`.
**Why it matters:** booker's `AGENTS.md` says `npm run lint` must pass before work is reported complete. While it fails,
a new lint error has no signal, and every plan has to prove its files added nothing (as the portrait-cover plan did by
linting HEAD's `page.tsx` through `git show`).
**Fix direction:** its own plan. Several are the React-hooks "setState in an effect" rule in wizard, login, shell and
settings hooks. Those are behaviour-adjacent and need tests around them, not a mechanical sweep. `vendor`'s
`2026-09-25-vendor-eslint-cleanup.md` is the precedent to follow.
**Verification when picked up:** `npm run lint` exit 0, plus the full `npm test` and `npm run test:visual`.

## F2 — Home's resume card shows four step dots for a free (₱0) draft  ⬜ TODO
*Moved here 2026-11-11 from `2026-11-11-booker-free-offerings.md` F14, which found it. Not part of that change.*
**File:** `components/activity/InProgressCard/InProgressCard.tsx:48` maps `WIZARD_STEPS` (four: Schedule, Documents,
Review, Pay) against the saved draft's `step`. Since that plan, a free offering's wizard has three steps
(`FREE_WIZARD_STEPS` in `useBookingWizard.ts`), but the draft does not record whether the offering is free, so a free
draft at Review still shows a fourth "Pay" dot ahead.
**Why it matters:** cosmetic. The copy ("You reached Review") is right; only the dots promise a Pay step that never comes.
**Fix direction:** store the step list (or a `free` flag) in the wizard draft (`WIZARD_DRAFT_KEY`) and have the card
read it, falling back to four steps for older drafts.
**Verification when picked up:** a gallery mode for a free draft with a baseline; `npm test`, `npm run test:visual`.

## F3 — A free booking's timeline says "payment released to vendor"  ⬜ TODO
*Moved here 2026-11-11 from `2026-11-11-booker-free-offerings.md` F15, which found it. Not part of that change.*
**File:** `lib/bookingTimeline.ts:36` labels the last step "Completed — Closed — payment released to vendor" for every
booking. A free (₱0) booking has no payment to release. Visible in the booking detail modal (baseline
`bookingdetailfree-*`).
**Why it matters:** copy only, but it contradicts "Price · Free" two lines below it.
**Fix direction:** a free variant ("Closed") keyed on `isFree()` from `lib/payments.ts`.
**Verification when picked up:** a unit test in `lib/bookingTimeline.test.ts` (or beside it); refresh the
`bookingdetailfree-*` baselines.

## F4 — Dates and slot lists follow the BROWSER's time zone, not Manila's  ⬜ TODO
*Moved here 2026-11-11 from `2026-11-11-booker-free-offerings.md` F17, which observed it. Pre-existing; not investigated.*
**What was seen:** a headless browser on US Eastern time rendered a `booked_date` of 2026-11-11 as "Nov 10"
(`fmtDate`, `lib/utils.ts:31`, parses a plain date as UTC midnight and formats it in local time), and the offering
page offered 2026-11-11 2:00 PM when it was already 02:39 on 12 Nov in Manila (slot filtering compares against the
device clock). A booker in the Philippines (UTC+8) sees neither.
**Why it matters:** only for bookers or testers outside UTC+8, but it shows a different day than the vendor sees, and
could offer a slot that has already started.
**Fix direction:** format plain dates without a time-zone shift (or in `Asia/Manila`, as `lib/manila.ts` does
elsewhere), and filter slots against Manila time. Audit every `new Date(<plain date>)` in booker first.
**Verification when picked up:** unit tests that pin the time zone (e.g. run with `TZ=America/New_York`), plus a
Playwright check with `timezoneId` set to a non-Manila zone.
