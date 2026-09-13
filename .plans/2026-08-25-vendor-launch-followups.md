# Vendor launch — outstanding follow-ups

**Date:** 2026-08-25
**App / scope:** `vendor`, `command`, `backbone`, Play Console, `ezzy.ph`
**Status:** DRAFT — holding document. **2026-09-12 (closed):** F5, F7, F9, F11, C2, C3 ✅ and F10 closed via `.plans/2026-09-12-vendor-kiosk-hardening.md` (COMPLETE). Earlier the same day they were unparked into `.plans/2026-09-12-vendor-kiosk-hardening.md`; F15 added. **Reviewed 2026-09-12:** L2 and F3 are resolved
(✅, evidence at each); L3 re-verified still broken; F2 partly overtaken; F5–F14, C2, C3
carried in from `.plans/2026-09-12-vendor-bookings-details-search-and-kiosk-guide.md`.
Originally the successor to `.plans/2026-08-21-vendor-account-deletion.md` (COMPLETE).

> One-line framing: everything left over once vendor account deletion shipped — one live
> verification that has never run, one pre-existing bug that silently affects vendors today,
> and the test-coverage debt that made both harder to find than they should have been.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** L# = launch blocker, F# = follow-up, C# = cosmetic. Numbers are
> plan-local. Items carried from another plan keep a reference to their origin.

---

## Where this came from

`.plans/2026-08-21-vendor-account-deletion.md` shipped account closure across `backbone`,
`vendor`, `command`, `ezzy-vendor-mobile` and `ezzy.ph` between 2026-08-21 and 2026-08-25.
Everything in that plan is done and committed.

Three categories were deliberately left out of it, and are gathered here so the reasoning
survives:

1. **Verification that needs a running stack** — the plan could type-check, unit-test and
   database-verify, but never exercised a route over HTTP with a real session.
2. **Pre-existing defects found while working** — reported at the time, not fixed, because
   fixing them inside a feature plan is how scope quietly doubles.
3. **Test-coverage debt** — two apps, two different gaps, and it is why (2) went unnoticed.

**A second source was added on 2026-09-12:** everything left ⏸ PARKED when
`.plans/2026-09-12-vendor-bookings-details-search-and-kiosk-guide.md` (bookings search +
details modal, kiosk documents, guide Kiosk tab) closed. Those are **F5–F14, C2, C3**, each
keeping its origin id ("bookings F#") and the unblock condition it was parked with. Parking is
a decision, not a gap: moving an item here does not schedule it.

⚠️ **The user owns L1 and L2** and has said so explicitly. Everything else is unassigned.

---

## LAUNCH BLOCKERS

### L1 — No route has ever run over HTTP with a session ⬜ TODO — **user-owned**
**Owner:** the user, who is running this during testing.
**Review 2026-09-12:** still open — **confirmed by the user on 2026-09-12: "L1 hasn't been run
yet, leave it open."** Stays ⬜ and user-owned. Note that L2's un-evidenced staging RLS re-check
was folded into this pass.

Every route in the closure feature is type-checked, unit-tested, and — for the destructive
sequence — verified step by step against the local database. **None has been called from a
browser with a real session.** Three things in particular have never executed:

| Never run | Why it matters |
|---|---|
| **B5 step 5 — the email wait** | `execute.server.ts` writes the confirmation, then polls `notification_emails` for `sent`/`failed` before deleting the auth user. If that ordering is wrong the email silently never sends: `notifications` cascades from `profiles`, and the Edge Function resolves the recipient from `profiles`/`auth.users`. **No error is raised in the failure case** — that is the whole reason the wait exists |
| **I9 — `SIGNED_OUT`** | `auth.admin.deleteUser` invalidates refresh tokens but leaves the issued access JWT valid. supabase-js should emit `SIGNED_OUT` when the pre-expiry refresh fails; nothing offline can prove it does in this app |
| **I4 — the co-admin fan-out** | Needs a vendor with two administrators. No fixture has one |

**What a full pass looks like:** sign in as a vendor-admin → Settings → Close account →
submit → confirm the acknowledgement email arrives → check Command's Closures queue shows it
→ execute → confirm the completion email arrives **before** the account disappears → confirm
the co-admin was notified → for `vendor_only`, sign in again and confirm the "closed at your
request" message (I8) rather than "contact support".

**Verification:** live environment only, by definition.

### L2 — Migrations are on local only ✅ DONE (resolved by later deploys, recorded 2026-09-12) — **user-owned**
<!-- ✅ 2026-09-12 — Overtaken, not executed from this plan. Migrations apply in order, and both
     hosted environments now carry later ones: `.plans/2026-09-11-command-payout-details-withholding-ezzy-fee.md`
     is "shipped to production" with `20260911*`, and the user confirmed on 2026-09-12 that
     staging's migrations are intact after deploying the bookings/kiosk work (`20260829*`).
     Both therefore include `20260821000001/2`. NOT evidenced: the RLS role re-check against
     staging that this item also asked for — fold it into L1's live pass. The agent did not
     run `supabase migration list --linked` itself. -->
**Owner:** the user. Migrations are never applied by the agent in this repo.

`20260821000001_account_deletion_requests.sql` and
`20260821000002_account_deletion_notification_types.sql` exist and are verified on the local
database (10 behavioural RLS tests). **Neither has reached staging or production.**

```bash
cd backbone
supabase db push
supabase migration list --linked   # confirm both 20260821* applied
```

⚠️ The `backbone` CLI is linked to **staging**, not production. Production is a second pass.
Re-run the RLS checks against staging after applying — the local seed is not staging's shape,
and the helpers read real membership rows.

**Carried from:** account-deletion plan I10.

### L3 — Command's KYC emails to vendors have never sent ⬜ TODO — **pre-existing bug**
**File:** `command/services/kyc-admin.service.ts:118-150` (`notifyVendorOfReview`, browser `createClient()` at `:123`, insert inside the `try`)
**Re-verified 2026-09-12 — still broken:** the function still inserts into `notifications`
with the browser client, and no migration since `20260620000001` grants `authenticated`
INSERT on `notifications` or adds an INSERT policy.

`notifyVendorOfReview()` inserts into `notifications` using the **browser** client.
`20260620000001_api_role_grants.sql:66` grants `authenticated` **select, update, delete** —
no insert — and no INSERT policy exists. The insert cannot succeed.

The surrounding `try/catch` never fires either: PostgREST returns an error *object* rather
than throwing, so the failure is discarded silently.

**Consequence, today:** every vendor whose KYC packet Command approves or rejects is told
nothing. The `kyc_approved` / `kyc_rejected` notification types have existed since
`20260808000001`; nothing has ever used them successfully.

**Why this is a launch blocker and not a follow-up:** vendor onboarding is the flow being
launched, and this is the message that tells an applicant whether they got in.

**Fix approach:** a small service-role route, mirroring
`command/app/api/users/route.ts`'s shape. The notification bodies already exist and are
correct — only the write path is wrong. Roughly one route file plus a service change.

**Verification:** machine-verifiable that the route exists and type-checks; **needs a live
environment** to prove an email actually arrives. Fold into L1's pass if the timing works.

**Carried from:** account-deletion plan I5 (reported there, deliberately not fixed).

---

## FOLLOW-UPS

### F1 — Put the deletion URL in Play Console ⬜ TODO
Data safety form → account-deletion field → **`https://ezzy.ph/account-data-deletion/`**.

⚠️ **Not `/legal-policies/`.** That page carries the same text, but it is a single scrolling
document with all seven policies inline, the deletion section is **sixth**, and the section
anchors are auto-generated hashes (`id="05ca377"`) that change when the page is re-edited —
so there is nothing stable to link to. A reviewer opening it lands on the Privacy Policy.

The form is editable independently of the app binary; changes are reviewed with the next
Data safety submission. Deferred by the user, 2026-08-23.

### F2 — `command` has no visual regression suite ⬜ TODO — **pre-existing**
**Review 2026-09-12 — partly overtaken:** `command/visual-tests/` now also has
`payouts.spec.ts` and `settings-withholding.spec.ts` (behavioural, from the 2026-09-10/11
payout plans), and the config is on port 3300 / `localhost`. What is still true is the gap
below: **no `pilot.spec.ts` and zero snapshots**, so no pixel coverage anywhere in Command.

`command/visual-tests/` contains `seo.spec.ts` and (since 2026-08-23) `closures.spec.ts`.
There is **no `pilot.spec.ts` and there are no snapshots**, so every Command surface — Users,
Vendors, Payouts, Flags, Closures — has zero pixel coverage.

⚠️ **`.plans/2026-08-16-payout-deferred-followups.md` D4 describes this and is now STALE.**
It says the config *"uses port 3100, colliding with vendor, and still points at 127.0.0.1"*.
Both were fixed on 2026-08-21 — it is port 3300 and `localhost` now. **Correct D4 or point it
here**, or the next reader will go fix something already fixed.

What remains of D4's ask: port the throwaway script into a real `pilot.spec.ts`.

**Carried from:** account-deletion plan I11 + payout plan D4.

### F3 — 29 pre-existing failures in the vendor visual suite ✅ DONE (resolved elsewhere, recorded 2026-09-12)
<!-- ✅ 2026-09-12 — Resolved by `.plans/2026-08-25-vendor-visual-baseline-instability.md`
     (COMPLETE 2026-08-26: 43 failing → 157 passed, EXIT=0; the login family and sidebar were
     diagnosed and re-baselined there, including the legal-links footer this item was holding
     back). Re-confirmed 2026-09-12: full vendor suite **177 passed, EXIT=0**, read unpiped from
     the summary line. The text below is the state on 2026-08-25. -->
`npx playwright test` in `vendor` reports **`29 failed / 123 passed`**, exit 1.

**Failing:** `ui-gallery sidebar` (light + dark), the whole `login-*` group (10),
`login-mobile-info`, and all 12 `payout details` tests.

**Proven pre-existing, not inferred:** with every tracked vendor change of the account-deletion
plan stashed, `-g "ui-gallery sidebar"` fails with the **identical 260-pixel diff** (269 dark).

**Symptoms:** small diffs (ratio 0.01 — drift, not a broken render) plus repeated React
**hydration mismatches** in the dev-server log on `DashboardSection`.

**Leading hypothesis, unconfirmed:** `pilot.spec.ts`'s own header documents that `page.clock`
patches **only the browser, not the Next server**, and that baselines expiring as the real
date advances has bitten this repo twice before. But the 260px sidebar diff is not obviously
date-shaped — diagnose rather than assume.

⚠️ **Blocks a related task:** the 13 `login-*` baselines are also affected by I15's legal-menu
addition (two new links render in the login footer). They were deliberately **not**
re-recorded, because doing so would bake this undiagnosed drift into the baselines alongside
a known-good change. **Diagnose F3 first, then re-record.**

**Carried from:** account-deletion plan I17.

### F4 — Vendor's completion matrix no longer fails fast ⏸ PARKED
Unchanged from `.plans/2026-08-16-payout-deferred-followups.md` **D5** — listed here only so
the test-coverage picture is in one place. **That plan remains its owner**; do not duplicate
the item, and unpark it there.

### F5 — ₱0 offerings fail at kiosk payment, after the customer has done everything ✅ DONE (2026-09-12, hardening H1 — live checks passed)
**→ Unparked 2026-09-12 into `.plans/2026-09-12-vendor-kiosk-hardening.md` Stage 1 (H1a–H1e), which now owns it.** The user chose **(b)-shaped behaviour, not (a)**: free offerings stay bookable and skip the payment step, with the booking settled at creation by the kiosk route. The fix options below are superseded; kept as the record.
**Origin:** bookings F11 (found 2026-09-12). **Unblocks when:** the user wants either fix below.
A ₱0 offering passes kiosk eligibility (`vendor/lib/kioskEligibility.ts:47-75` never checks
price) but `vendor/app/api/kiosk/payment/create-session/route.ts:80-81` refuses any amount
that is not > 0. By then `app/api/kiosk/booking/route.ts` has inserted a `pending` booking and
its acknowledgements, and the customer has typed their details and signed. The guide's Kiosk
tab tells vendors to price kiosk offerings above ₱0 meanwhile.
**Fix options:** (a) small — exclude `price <= 0` in `classifyKioskOfferings` with a launcher
reason, plus a `kioskEligibility.test.ts` case; (b) larger — support free kiosk bookings
(skip payment), a product decision.

### F6 — Editing a document's text does not bump its version ⏸ PARKED
**Origin:** bookings F10 (found 2026-09-12). **Unblocks when:** the user wants the evidence
gap closed. `vendor/services/offeringAttachments.service.ts:193-208` (`updateAttachment`)
patches `title`/`body`/`requires_signature`/`sort_order` and never `version`, while
`booking_acknowledgements` snapshots title and version but **not the text**. After an edit, a
past acceptance cannot show which wording was agreed to.
**Fix options:** bump `version` in the service when `body` changes (app-layer), or a BEFORE
UPDATE trigger (schema change → approval gate). Snapshotting the body onto acknowledgements is
a third, heavier option. The guide deliberately makes no versioning claim until this lands.

### F7 — A failed Approve leaves the button disabled ✅ DONE (2026-09-12, hardening H2 — evidence there)
**→ Unparked 2026-09-12 into `.plans/2026-09-12-vendor-kiosk-hardening.md` H2, which now owns it.**
**Origin:** bookings F9 (found 2026-09-12). **Unblocks when:** the user asks.
`vendor/components/bookings/BookingActions/useBookingActions.ts` sets `approving = true` on
click and never resets it. When `approveB` fails, `useAppShell.ts:660-667` rolls the status
back to `pending` and toasts, but Approve stays greyed until the row (or the details modal)
remounts. Fix: reset `approving` when `b.status` changes or on failure. One line, but it
touches the shared action hook, so re-run the row parity check.

### F8 — `ezzy-vendor-mobile` has none of the 2026-09-12 bookings/kiosk/guide changes ⏸ PARKED
**Origin:** bookings F8. **Unblocks when:** mobile parity is wanted.
No bookings search/short-code filter/latest-first default, no booking details modal (so no way
to see kiosk agreements or signatures on a phone), and its own guide has no Kiosk tab.
**Kiosk parity is NOT this item** — `.plans/2026-09-03-vendor-mobile-kiosk-mode.md` owns it and
carries a 2026-09-12 parity note at I3 (openable documents, 10-minute idle cap). Read
`.claude/skills/mobile-dev/SKILL.md` first; mobile uses `Name.styles.ts`, not CSS modules.

### F9 — The shared `SearchInput` has no accessible label ✅ DONE (2026-09-12, hardening H4 — evidence there)
**→ Unparked 2026-09-12 into `.plans/2026-09-12-vendor-kiosk-hardening.md` H4, which now owns it.**
**Origin:** bookings F12 (found 2026-09-12). **Unblocks when:** an accessibility pass happens.
`vendor/components/ui/SearchInput/SearchInput.tsx:10-21` renders an `<input>` with only a
placeholder, which screen readers fall back to as its name — on Bookings and Transactions.
Fix: an optional `ariaLabel` prop passed by both callers. Touches two pages.

### F10 — Hydration error on the `bookings` gallery fixture ✅ CLOSED (2026-09-12) — diagnosed test-only; accepted and documented by the user's decision (hardening H7/D8)
**→ Unparked 2026-09-12 into `.plans/2026-09-12-vendor-kiosk-hardening.md` H7 (diagnosis first; the fix is decided afterwards), which now owns it.**
**Origin:** bookings F13 (found 2026-09-12). **Unblocks when:** someone investigates, or it
appears on a real page. Every Playwright run logs `Hydration failed because the server rendered
text didn't match the client` for `ui-gallery?mode=bookings`, on the code before and after the
2026-09-12 refactor, so it is pre-existing. Screenshots pass because the client re-renders.
Unconfirmed lead: render-time `Date.now()` in the auto-confirm countdown (the same line lint
flags as `Cannot call impure function during render`, now in `useBookingActions.ts`). Related to
the date-vs-`page.clock` notes in `pilot.spec.ts`. Diagnose; do not assume.

### F11 — Kiosk signature ink colour follows the kiosk's theme ✅ DONE (2026-09-12, hardening H5 — evidence there)
**→ Unparked 2026-09-12 into `.plans/2026-09-12-vendor-kiosk-hardening.md` H5 (normalise to dark-on-white at export; the pad looks unchanged), which now owns it.**
**Origin:** bookings F14 (found 2026-09-12). **Unblocks when:** signatures are used outside the
booking details modal (print, export, email). `vendor/components/kiosk/KioskSignaturePad/useKioskSignaturePad.ts:54-55`
strokes in the canvas's computed text colour on a transparent PNG, so a dark-themed kiosk
stores near-white ink. The modal compensates with a mid-slate ground. Fix at the source: always
stroke a fixed dark ink on an opaque white canvas (changes only new signatures).

### F12 — Kiosk bookings arrive `pending` even when paid ⏸ PARKED — **user decision**
**Origin:** bookings F6. **Parked by the user, 2026-09-12: "leave that for now."**
**Unblocks when:** the user decides kiosk bookings should auto-confirm.
`vendor/app/api/kiosk/booking/route.ts:153` inserts `status: "pending"`, and the payment
webhook sets only `is_paid`, so a paid walk-in still waits under **Needs you**. Changing it
touches the booking route and possibly the status trigger, and deserves its own plan. The
guide describes the current behaviour.

### F13 — Latest-first sort puts far-future bookings above today's ⏸ PARKED — **user decision**
**Origin:** bookings F5. **Parked by the user, 2026-09-12: "ignore, do not do anything about it."**
**Unblocks when:** the user raises it. The default sort is now *Date — latest first* on
`bookedDate + startTime` (by request), so a booking months out leads the list and pending
requests may not be at the top of **Needs you**. *Soonest first* remains one pick away.

### F14 — The kiosk shows only the first offering photo ⏸ PARKED — **user decision**
**Origin:** bookings F3. **Accepted by the user, 2026-09-12: "ok with only first for now."**
**Unblocks when:** a kiosk gallery is wanted. Vendors may upload 3 photos
(`MAX_PHOTOS`, `offeringAttachments.service.ts`), but `vendor/components/kiosk/KioskBooking/StepOffering.tsx:33-45`
renders only `photos[0]` and no other step shows photos. The guide says so.

### F15 — The booker app also cannot book a ₱0 offering ⏸ PARKED
**Origin:** found while planning `.plans/2026-09-12-vendor-kiosk-hardening.md` (2026-09-12).
**Unblocks when:** free offerings are wanted in the booker app too (cross-app: `booker/`).
`booker/app/api/payment/create-session/route.ts:55-56` refuses `amount ≤ 0` exactly as the
kiosk route did, and the booker wizard always redirects to payment
(`booker/components/booking/BookingWizard/useBookingWizard.ts:216`). A ₱0 booker booking is
therefore created `pending` and unpaid, then fails at checkout. The kiosk fix (settle at
creation in the server route) is kiosk-only by decision (hardening D2); a booker fix needs its
own route change, or the database-wide rule the user declined for now.

### F16 — Nothing refuses a booking for a time that has already started ⏸ PARKED
**Origin:** found while planning `.plans/2026-09-12-vendor-kiosk-hardening.md` H9 (2026-09-12).
**Unblocks when:** the user wants the rule enforced for every client (schema change → approval gate; cross-app).
`check_booking_placement()` (`20260828000001`) validates window, occurrence, capacity and
overlap but **not** that the start is in the future, and `availabilityForDay`
(`vendor/lib/slotAvailability.ts`) lists every slot of the day. Hardening H9 closes it **for the
kiosk only** (client filter + kiosk route check). Still open: a database-level refusal (for
example `booked_date + start_time` in Asia/Manila must be later than `now()` on INSERT), and
**checking whether the booker app's slot step filters past times** (not investigated).
Mobile clients port the vendor helpers, so they inherit whatever the helpers do.

---

## COSMETIC

### C1 — Closure option ordering on `ezzy.ph` ⬜ TODO
`/account-data-deletion/` §1 lists: *The Business and My Login → My Login Only → The Business
Only*. Reading better: the two common choices adjacent, the conditional one last —
*The Business and My Login → The Business Only → My Login Only*. Nothing is wrong as it
stands.

### C2 — Kiosk document cards at phone width ✅ DONE (2026-09-12, hardening H6 — evidence there)
**→ Unparked 2026-09-12 into `.plans/2026-09-12-vendor-kiosk-hardening.md` H6, which now owns it.**
**Origin:** bookings F15 (found 2026-09-12). **Unblocks when:** the kiosk is expected to run on
a phone. Below ~450px a long document title runs under the "Signature required" tag, and
"I have read and agree" centres and wraps (`.docHead` / `.agree` in
`vendor/components/kiosk/KioskBooking/KioskBooking.module.css`). Pre-existing; kiosks are
tablets, where neither occurs.

### C3 — `BookingsPage` never passes `onFlagged` ✅ DONE (2026-09-12, hardening H3 — evidence there)
**→ Unparked 2026-09-12 into `.plans/2026-09-12-vendor-kiosk-hardening.md` H3, which now owns it.**
**Origin:** bookings F7 (noted 2026-09-12, not parked by a decision — carried so it is not lost).
`BookingRow` / the details modal accept `onFlagged` so the caller can refetch after "Something's
wrong", but `BookingsPage` never passes it. Harmless in practice: the Realtime UPDATE patches
`status → disputed`. Only matters if Realtime is ever unavailable for bookings.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. There are none. -->

- **One plan rather than two** (user, 2026-08-25). A split was suggested — feature follow-ups
  separate from test-coverage — because F2/F3 span two source plans and neither owns them.
  The user chose a single document; the sections above keep the separation legible.
- **L3 is a launch blocker, not a follow-up** (2026-08-25). It is a live defect in the
  onboarding flow being launched, not a deferred improvement.
- **This plan also holds the 2026-09-12 bookings/kiosk parked items** (user, 2026-09-12:
  "place them in that plan that contained things to do later"). Chosen over
  `.plans/2026-08-16-payout-deferred-followups.md`, which is scoped to payouts.

---

## Execution order

1. **L2** — migrations to staging. Everything else that touches a live environment needs this.
2. **L1** — the full closure pass. Highest information value per minute spent.
3. **L3** — fix and, if possible, verify inside the same live session as L1.
4. **F3** — diagnose before touching any baseline.
5. **F3 follow-through** — re-record the `login-*` baselines once the drift is understood.
6. **F1** — whenever the Play submission is next touched.
7. **F2** — its own piece of work; the vendor suite is 123 tests, so this is not small.
8. **C1** — any time.
9. **F5, F7, F9, F10, F11, C2, C3** — scheduled 2026-09-12 in `.plans/2026-09-12-vendor-kiosk-hardening.md` (see that plan's execution order).
   **F6, F8, F12–F16** remain unscheduled; each waits on its own unblock condition.
   *(Original note, 2026-09-12:)* **F5–F14, C2, C3** (added 2026-09-12) — unscheduled; each waits on its own unblock condition.
   Cheapest if ever wanted: **F7** (one line) → **F5a** (eligibility rule + test) → **F9**
   (prop on a shared component) → **F6** (service-side version bump) → **F11** → **F10**
   (diagnosis). **F8** and **F12** each need their own plan.

**F2 and F3 are independent of L1–L3** and can start whenever; they need no live environment
beyond a dev server.

---

## Verification

| Item | How | Kind |
|---|---|---|
| L1 | The full pass described above, on a running stack | **live only** |
| L2 | `supabase migration list --linked`; re-run the RLS role checks against staging | live only |
| L3 | `tsc` + the route exists (machine); an email actually arriving (live) | both |
| F1 | The URL resolves 200 and is saved in the Data safety form | manual |
| F2 | A `pilot.spec.ts` exists and passes; snapshots committed | machine |
| F3 | `npx playwright test` in `vendor` exits 0 — **read the summary line and the exit code, never the tail** | machine |
| C1 | Visual check of §1 | manual |
| F5 | `kioskEligibility.test.ts` case for a ₱0 offering; launcher names the reason | machine |
| F6 | Editing a written document's body increments `version`; a new acknowledgement snapshots it | machine + DB |
| F7 | Forced `approveBooking` failure → status back to pending **and** Approve enabled again (row and modal) | browser |
| F8 | Per its future plan; mobile device checks | device |
| F9 | Search inputs expose a real accessible name (`getByRole("textbox", { name })`) | machine |
| F10 | `ui-gallery?mode=bookings` logs no hydration error in a Playwright run | machine |
| F11 | A signature captured on a dark-themed kiosk stores dark ink on white | device |
| F12 / F13 / F14 | Decided per its own plan | — |
| C2 | Kiosk agreements step at 400px: no overlap, label on one line | browser |
| C3 | After "Something's wrong" with Realtime disabled, the row shows the new status | browser |

⚠️ **The F3 verification note is not pedantry.** During the account-deletion plan this suite
was twice reported as green from a tail of the output that read `123 passed`, while the real
summary was `29 failed / 123 passed` thirty lines above. Both reports were wrong.
