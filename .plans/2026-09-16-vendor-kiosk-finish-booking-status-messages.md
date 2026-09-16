# Kiosk "Finish a booking": explain a found booking instead of "Nothing found"

**Date:** 2026-09-16
**App / scope:** `vendor/` — kiosk close-out lookup (`app/api/kiosk/close-out/route.ts`, `lib/kioskCloseOut.ts`, `components/kiosk/KioskCloseOut/`), guide copy, `architecture/booking-flow.md`
**Status:** IN PROGRESS — all decisions resolved 2026-09-16. **COMPLETE (2026-09-16).** I1–I3 and I5 ✅, I4 ✖ (D5), F2 written, full vendor suite 179/179, staging check reported passed by the user, vendor code shipped in `version-0.55.1` (`95d0aa9`). Still open: F3 (user's call) and committing the root-repo docs/plans.

> A tester paid for a kiosk booking, went to **Finish a booking**, typed the reference and was told
> *"Nothing found waiting on you. Please check the number…"* The booking existed; it was simply
> `confirmed`, not yet marked done. This plan makes the lookup **recognise** any matching kiosk
> booking and **say where it stands**, while the rules for who may complete a booking stay exactly
> as they are. It is a usability fix, not a status-machine change.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** I# = Important, D# = Decision, F# = Finding. Numbers are plan-local;
> "mobile I4" means `.plans/2026-09-03-vendor-mobile-kiosk-mode.md` I4.

**Out of scope — must not change:** `closeOutTarget` (`lib/kioskCloseOut.ts:26-30`), the confirm
route (`app/api/kiosk/close-out/confirm/route.ts`), the database transition rules
(`20260829000004_kiosk_customer_close_out.sql`), and any migration. Also out: booker, command,
`ezzy-vendor-mobile` (see F2), and reminding vendors to mark bookings done (F3).

---

## Findings (investigation 2026-09-16)

### The staging case, confirmed against the code
- **Row:** `7b588d11-…`, `booked_via = kiosk`, `session`, `confirmed`, `is_paid = true`; only
  transition `pending → confirmed` by a non-customer (the vendor approving).
- **Why it was not found:** `close-out/route.ts:42-49` loads only this vendor's kiosk bookings
  **with `status in ('in_progress','fulfilled')`**. A `confirmed` row is never read, so matching never
  sees it. The reference itself was fine — `matchesIdentifier` (`lib/kioskCloseOut.ts:60-75`)
  matches a booking id by **prefix**.
- **Expected sequence (session):** vendor approves (`pending → confirmed`) → vendor **Mark as done**
  (`confirmed → fulfilled`, vendor or Command only) → customer **Yes, all done** at the kiosk
  (`fulfilled → completed`). Rentals: vendor **Hand over** (`→ in_progress`) → customer
  **I've returned it** (`→ returned`) → vendor **Got it back** (`→ completed`).
- **Nothing advances a `confirmed` booking on its own.** The only scheduled job,
  `auto_acknowledge_bookings()` (`20260801000006`, date gate `20260801000009`), handles
  `fulfilled`/`returned` after 3 days.

### What this means for the patch
- **Completion rules are already enforced in two places, independent of the lookup.** The confirm
  route derives the target from the stored status (`closeOutTarget` → only `fulfilled` and
  `in_progress` have one; everything else gets 409), and the database trigger refuses any other
  transition. Widening what the **lookup shows** cannot widen what a customer can **do**.
- **No migration.** The lookup reads with the service-role client (`lib/supabase/admin.ts`), and
  every status already exists (`bookings_status_values`: pending, confirmed, fulfilled, in_progress,
  returned, completed, disputed, cancelled, refunded).
- **Your four messages cover four of nine statuses.** `in_progress` already has its action;
  `returned`, `disputed`, `cancelled` and `refunded` need wording too (D1).
- ⚠️ **"Confirmed" differs by shape.** "Once the vendor marks the service as done" is right for a
  session and wrong for a rental, which moves on at **Hand over**. The route must return the
  booking's `fulfilment_pattern` (D1).
- ⚠️ **An unpaid `pending` booking exists and would be misdescribed.** The kiosk inserts the booking
  as `pending` **before** payment (`kiosk/booking/route.ts:178`); a customer who abandons PayMongo
  leaves a `pending`, `is_paid = false` row that nothing cleans up. "Awaiting vendor approval" would
  be false for it. The route must also return `is_paid` (D4).
- ⚠️ **Widening the query would silently truncate.** Today's filter keeps the result set tiny. Adding
  `completed`/`cancelled`/`refunded` reads the vendor's **entire kiosk history** on every lookup, and
  an unpaged PostgREST select stops at 1000 rows **without an error** — a regular customer's newest
  booking would then vanish at random, which is this bug again. So terminal statuses need a recency
  window (D3) **and** the read must go through `fetchAllPages` (`lib/pagedFetch.ts`), treating an
  incomplete read as an error, not as "not found".
- **Privacy rule already written into the route** (`close-out/route.ts:6-15`): never a roster, and
  return "nothing that would matter if the person reading the screen is not its owner". Showing a
  *not-yet-happened* booking's date and time to whoever types a phone number is new exposure (D2).
- **Tests:** `lib/kioskCloseOut.test.ts` — 16/16 pass today (baseline 2026-09-16). No gallery
  fixture or screenshot covers `KioskCloseOut`.

---

## IMPORTANT

### I1 — The lookup recognises every matching kiosk booking and classifies it  ✅ DONE (2026-09-16)
<!-- 2026-09-16 Stage 1. Executed: lib/kioskCloseOut.ts gained `CloseOutStage`, `closeOutStage()`,
`stageShowsSchedule()`, `ACTIVE_STATUSES`, `TERMINAL_STATUSES`, `TERMINAL_WINDOW_DAYS = 7`,
`terminalCutoff()`; `closeOutTarget` has no removed or changed lines (git diff). close-out/route.ts
now reads through `fetchAllPages` with `.or("status.in.(active…),and(status.in.(terminal…),
status_changed_at.gte.\"<cutoff>\")")`, ordered status_changed_at desc + id; an error OR an
incomplete read returns 500; matches carry `stage`, keep `status` for the unchanged kiosk component
until Stage 2, and include bookedDate/startTime only when `stageShowsSchedule` (D2). `ready` sorts
first (stable sort keeps newest-first within groups). Confirm route and migrations untouched.
Verified (machine): tsc 0; eslint clean on the three files; lint 34 problems, same files; npm test
458/458. The new filter was sent to the REAL local PostgREST with the public anon key: it parsed and
resolved every column and embed, stopping only at `42501 permission denied for table bookings`
(anon has no grant) — while a deliberately broken filter returned PGRST100 (parse) and an unknown
column returned 42703, proving analysis runs before the permission check.
NOT yet verified: the route executed end-to-end with a real vendor-admin session (a browser mock
cannot reach it — it runs server-side against Supabase). That is the staging check in Verification;
I1 stays 🔄 until it runs.
✅ 2026-09-16: the user reported local testing good and the staging check complete, after deploying
vendor `version-0.55.1` (`95d0aa9`). The detailed per-step results were not itemised in chat. -->
**Files:** `vendor/lib/kioskCloseOut.ts` (new pure function), `vendor/app/api/kiosk/close-out/route.ts:42-73`
**Fix approach:**
- **`lib/kioskCloseOut.ts`:** add `closeOutStage(status, pattern, isPaid)` returning one of a closed
  set — `awaiting_payment`, `awaiting_approval`, `confirmed_session`, `confirmed_custody`,
  `ready` (fulfilled or in_progress: the existing action), `returned`, `on_hold`, `completed`,
  `cancelled`, `refunded`. Pure, next to `closeOutTarget`, which is **not modified**.
- **Route:** select adds `fulfilment_pattern, is_paid, status_changed_at`; the status filter becomes
  "any active status, or a terminal status changed within the D3 window" (one PostgREST `or`);
  read through `fetchAllPages`, and if the read is incomplete return 500 "Could not look that up"
  rather than a short list. Matching (`matchesIdentifier`) is unchanged. Each match returns
  `id, offeringName, stage`, plus `bookedDate`/`startTime` **only where D2 allows**.
- Order: `ready` first (the thing they came to do), then the rest newest first.
**Component separation:** logic in `lib/` and the route; no UI here.
**Verify:** unit truth table (I3); route behaviour via the script in Verification.

### I2 — The kiosk shows each booking's situation, and a truthful empty state  ✅ DONE (2026-09-16)
<!-- ✅ DONE 2026-09-16 (Stage 2). Executed: useKioskCloseOut.ts — `CloseOutMatch` now carries
`stage` (+ `status`, and bookedDate/startTime only for `ready`); a `MESSAGE` table (D1 copy, the
user's four verbatim) beside the unchanged `ACTION`; `toItem()` resolves each match to an action
(ready only) OR a message, never both; the hook exposes `items`; `confirm` now takes the id.
KioskCloseOut.tsx renders `c.items`: action cards unchanged (name, status tag, date · time, button);
message cards show name + message with an Info icon, no button, no date/time; the dropped-match line
(`if (!a) return null`) is gone; empty state now "We couldn't find a booking for that number or
reference. Please check it, or see the front desk." KioskCloseOut.module.css: `.matchMessage`.
DEVIATION: the plan said Stage 2 would drop the route's `status` field; it is KEPT, because `ready`
spans fulfilled and in_progress and the button's wording depends on which. It reveals nothing
`stage` does not; the route comment now says so.
Verified (machine): tsc 0; eslint clean on the component and route; lint 34, same files; npm test
458/458; `playwright test -g kiosk` 16/16 (no baseline touches this screen). Browser script
s8-closeout.cjs on the real /kiosk (faked session, lookup response mocked) with one booking per stage:
all 11 found; exactly the two `ready` cards have a button ("Yes, all done", "I've returned it") and a
date/time; the nine others show the exact D1 sentence, 0 buttons, no date/time; tapping "Yes, all
done" posted confirm with that booking's id and showed "Thanks — that's all done."; an empty result
shows the new sentence and not the old one. Screenshot s8-closeout-all-stages.png. -->
**Files:** `vendor/components/kiosk/KioskCloseOut/useKioskCloseOut.ts:28-40` (`ACTION` → stage copy),
`KioskCloseOut.tsx:48-85`, `KioskCloseOut.module.css`
**Fix approach:**
- The hook maps `stage` → `{ message }` or `{ action }` (D1 copy). `ready` keeps today's button
  and wording exactly (**Yes, all done** / **I've returned it**); every other stage renders the card
  with the offering name and the message, **no button**.
- The render currently drops any match without an action (`if (!a) return null`); that line goes.
- **Empty state** (now genuinely nothing matched): "We couldn't find a booking for that number or
  reference. Please check it, or see the front desk."
- The bottom note ("Hand anything you borrowed…") stays.
**Component separation:** `.tsx` stays a pure render layer (reads `c.matches[i].message|action`);
the stage→copy table lives in the hook module, beside the existing `ACTION`; a non-actionable card
style (muted message line) goes in `KioskCloseOut.module.css`. No inline styles.
**Verify:** script (the I4 fixture was aborted, D5).

### I3 — Tests prove the new mapping and that completion rules did not move  ✅ DONE (2026-09-16)
<!-- ✅ DONE 2026-09-16. lib/kioskCloseOut.test.ts: +6 tests — the full stage table (all 9 statuses,
both shapes, paid/unpaid, unknown → null); "`ready` exactly when closeOutTarget allows an action"
across every status × shape × payment (the coupling that keeps completion rules unchanged); unpaid
pending never "awaiting approval"; date/time only for `ready`; every status searched exactly once
(active ∪ terminal = the 9 in bookings_status_values); cutoff = 7 days. The three existing
closeOutTarget tests are untouched. `node --test lib/kioskCloseOut.test.ts` 22/22; `npm test` 458/458. -->
**File:** `vendor/lib/kioskCloseOut.test.ts`
- A truth table for `closeOutStage` over all 9 statuses × 2 patterns × paid/unpaid where relevant.
- The existing `closeOutTarget` tests stay **untouched and passing** — the proof that only
  `fulfilled` and `in_progress` can be closed.
**Verify:** `npm test` (machine).

### I4 — Gallery fixture for every stage  ✖ ABORTED (2026-09-16) — user decision D5: no screenshot this time; the Stage 1–2 scripts cover the states instead
**Files:** `vendor/app/ui-gallery/page.tsx` (new mode `kioskcloseout`, one card per stage),
`vendor/visual-tests/pilot.spec.ts` (registered only after you approve the screenshot — registering
is accepting the baseline).
Today nothing machine-checks this public-facing screen, and it is about to gain ten states. Requires
the component to render from supplied state, which the hook split already allows.
**Verify:** candidate screenshots for your review; then scoped baseline + two stable re-runs.

### I5 — Copy and docs  ✅ DONE (2026-09-16)
<!-- ✅ DONE 2026-09-16 (Stage 3). guideItems.ts "Finish a booking": the button appears only after the
vendor marks the session done or hands the item over; before that the kiosk says where the booking
stands (awaiting approval, confirmed, not yet paid), and a booking completed or cancelled in the last 7
days says so. Source note updated (closeOutStage, 7-day window). architecture/booking-flow.md →
"Closing a kiosk booking": new paragraph + status→message table, the unchanged completion rule, the
7-day paged read, date/time only for actionable bookings, and the no-vendor-reminder gap (F3).
Verified (machine): tsc 0; eslint clean on guideItems.ts; guide modal Playwright test 1/1 (no
assertion covers this line — checked). -->
- `components/dashboard/GuideModal/guideItems.ts` "Finish a booking": a booking can be finished
  once the vendor has marked it done (session) or handed it over (rental); before that the kiosk
  tells the customer where it stands.
- `architecture/booking-flow.md` → "Closing a kiosk booking": the lookup recognises every kiosk
  booking (terminal ones within the D3 window), classifies it, and still only `fulfilled` /
  `in_progress` can be acted on.

---

## DECISIONS
<!-- No item may execute while an OPEN: line remains. -->
- **D1 — the message for each status** → **the table below, as proposed** (resolved 2026-09-16, user). The user's four are kept word for word (★):

  | Status | Shape / paid | Kiosk shows |
  |---|---|---|
  | `pending` | paid ★ | "Your booking is awaiting vendor approval." |
  | `pending` | **unpaid** | "This booking hasn't been paid. Please see the front desk." (see D4) |
  | `confirmed` | session ★ | "Your booking is confirmed. Once the vendor marks the service as done, you can finish it here." |
  | `confirmed` | rental | "Your booking is confirmed. Once the vendor hands it over, you can return it here." |
  | `fulfilled` | session ★ | existing **Yes, all done** action |
  | `in_progress` | rental | existing **I've returned it** action (unchanged) |
  | `returned` | rental | "You've returned it. The vendor will confirm they got it back." |
  | `completed` | ★ | "This booking has already been completed." |
  | `disputed` | — | "This booking is on hold. Please see the front desk." |
  | `cancelled` | — | "This booking was cancelled." |
  | `refunded` | — | "This booking was cancelled and refunded." |

- **D2 — show date and time on cards that have no action?** → **B: no, offering name and message
  only** (resolved 2026-09-16, user) — anyone who types a phone number would otherwise learn when that person is
  next due at the venue, which the route's own rule forbids; the actionable cards keep date and time
  as today. · A: show them on every card (easier to tell two bookings apart).
- **D3 — how far back do completed / cancelled / refunded bookings show?** → **7 days by
  `status_changed_at`** (resolved 2026-09-16, user; I had recommended 30). Shorter window, smaller read;
  a customer asking about something older than a week is sent to the front desk by the empty state.
- **D4 — unpaid `pending` bookings.** → **show "hasn't been paid"** (resolved 2026-09-16, user) — true, and it
  tells an abandoned-payment customer what happened · hide them (treat as not found).
- **D5 — add the `kioskcloseout` gallery screenshot (I4)?** → **No, script checks only** (resolved
  2026-09-16, user: "no need for a screenshot this time, I'll make an exception"). I4 is ✖ ABORTED.

## FINDINGS (no action here)
- **F1 — the tester's expectation.** "Finish a booking" is a completion step, not a general booking
  lookup; this plan keeps that meaning and only stops it from denying a booking exists.
- **F2 — mobile parity.** Mobile I4 (kiosk close-out) is still ⬜. When built it should use the same
  stages and copy. Note to be added to the mobile plan when this ships.
  ✅ **DONE 2026-09-16**: written into `.plans/2026-09-03-vendor-mobile-kiosk-mode.md` (an "Evidence and
  Corrections" bullet and an I4 "Carry forward from web" block). ⚠️ It flags a **response-contract
  change** on the shared route — `stage` added, `bookedDate`/`startTime` now optional — which mobile
  must build against. Checked: mobile `src/` has no `close-out` call yet, so nothing breaks today.
- **F3 — nothing reminds the vendor.** A `confirmed` session that is never marked done stays that way
  forever and its payout stays held. This plan tells the customer why; it does not prompt the vendor.
  Candidate for the vendor launch follow-ups if you want it tracked.

## Execution order
1. **I1 + I3** — the stage function and its tests first, then the route (after D1, D3, D4, D2).
2. **I2** — the kiosk rendering.
3. ~~I4~~ — aborted (D5).
3. **I5** — guide and architecture doc.
5. Full vendor Playwright suite; note in the mobile plan (F2). ✅ 2026-09-16 — suite 179 passed, 0 failed
   (exit 0, unpiped, log in vendor node_modules/.cache/s9/pw-full.log), no baseline changes; F2 written.

## Verification
**Machine-verifiable**
- `closeOutStage` truth table; existing `closeOutTarget` tests unchanged and passing; grep shows
  `closeOutTarget`, the confirm route and migrations untouched (`git diff --stat`).
- `tsc`, lint (no new problems vs the current 34), unit tests, full Playwright suite.
- Script against the real `/kiosk` (faked session, mocked rows) for each status × identifier type:
  the right message; a button only for `fulfilled` / `in_progress`; no date or time on non-actionable
  cards (if D2 = B); a terminal booking older than the window is not shown; an **incomplete paged
  read** yields an error, not an empty result; tapping an action on `fulfilled` still completes, and a
  forged confirm call for a `confirmed` booking still gets 409.
**Needs a live environment** — ✅ reported complete by the user on staging, 2026-09-16 (vendor `version-0.55.1`).
- Staging: the tester's booking `7b588d11-…` (still `confirmed`) shows the confirmed-session message
  by reference and by phone; after the vendor taps **Mark as done** it shows **Yes, all done**; after
  that, "already completed".
