# Booker — free (₱0) offerings, end to end

**Date:** 2026-11-11
**App / scope:** booker/ (wizard, Activity, Payments, Home rules, `services/bookings.service.ts`) **plus one backbone migration** (approval gate, see D1). Vendor, command and both mobile apps are read-only reference.
**Status:** COMPLETE (2026-11-11) — release: staging ✅ · production ✅ (both green by the user's checks; local fully machine- and E2E-verified)

> A booker who books a ₱0 offering should get what a kiosk customer gets: the booking is
> settled when it is created, PayMongo is never called, and every screen says "Free"
> instead of "Unpaid ₱0". The database decides what is free. The browser never does.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** F# = finding (from the investigation), R# = read-only pre-check,
> B# = blocker, I# = important, D# = decision, S# / P# = staging / production release step.
> Numbers are plan-local. Cross-plan refs are qualified, e.g. "vendor-kiosk-hardening H1a".

---

## ▶ RESUME HERE (updated 2026-11-11, plan CLOSED)
- **Done:** every stage ✅ — local, staging, production. Commits: booker `a40cd5c`, backbone `62b9aa7`.
- **Live where:** local ✅ · staging ✅ · production ✅.
- **Next:** nothing in this plan. F14, F15, F17 live on as `2026-11-04-booker-followups.md` F2–F4.
  Vendor launch follow-up F15 ("booker cannot book a ₱0 offering") carries an "addressed" note;
  its status is the user's to close.
- **Watch out for:**
  - **F1 is a live security hole on every environment today.** It is not caused by free
    offerings, but this plan's fix closes it. Do not ship the booker UI change without B1.
  - The new trigger reads `price_paid`, which another BEFORE INSERT trigger computes. **Its
    name decides the order** (F7).
  - The ledger trigger fires on UPDATE only. Settling a free booking must happen **at
    insert**, never with a later UPDATE, or a ₱0 ledger row appears (F8).

---

## Findings (investigation, 2026-11-11)

### F1 — A booker can insert their own booking as paid, today  ✅ closed on local (2026-11-11, R1 rerun); staging/production still open until the release
**Severity: escalate. Pre-existing, on every environment.**
- Grant: `authenticated` has table-wide `INSERT` on `bookings`
  (`backbone/supabase/migrations/20260620000001_api_role_grants.sql:61`). No column-level
  revoke exists anywhere. Checked on local: 22 insertable columns, `is_paid` among them.
- RLS: `"bookers can insert bookings"` checks only `booker_id = auth.uid() and is_active()`
  (`20260507000004_bookings.sql:132-138`). No column guard.
- Triggers: the BEFORE INSERT triggers are `bookings_check_consistency` and
  `bookings_check_placement`. Neither reads or writes `is_paid`. Checked on local with
  `pg_proc.prosrc ilike '%is_paid%'` across every trigger function on `bookings`: none of
  the insert-time functions mention it.
- **Result:** a signed-in booker can send `POST /rest/v1/bookings` with `is_paid: true` for
  an ₱850 offering. The row is stored as paid. No ledger row is written (inserts never fire
  the ledger trigger, F8), so the vendor sees a "Paid" booking and is never paid for it.
  The same request can also set `payment_reference`, `status` (e.g. `confirmed`, skipping
  the vendor's approval, because the status-transition trigger is BEFORE UPDATE only) and
  `booked_via = 'kiosk'`.
- `price_paid` is **already safe**: `check_booking_consistency()` overwrites it on insert
  with `offering.price × quantity` and pins it on update
  (`20260828000001_schedule_window_minutes_expand.sql`, latest body).
- ✅ **Reproduced 2026-11-11 (R1):** as seed booker `…0011`, an ₱850 booking inserted with
  `is_paid: true, status: 'confirmed', booked_via: 'kiosk', payment_reference: 'forged'` was stored
  exactly so (`850.00 | t | forged | confirmed | kiosk`). Rolled back.

### F2 — "Free" means price 0, and that is the same as total 0
`price_paid = offerings.price × quantity` (trigger above), `bookings_quantity_check` is
`quantity > 0`, and `offerings_price_nonnegative` is `price >= 0`. So the total is 0 **only**
when the list price is 0. One test answers both questions: `price_paid = 0` on the stored row.

### F3 — Where the price comes from at booking time
- Server: the trigger in F2, at insert. This is the only price that counts.
- Browser: `offering.price` from the offering page. The wizard uses it for display only:
  the button label (`BookingWizard.tsx:134`, `price × quantity`) and the Total on Review,
  Pay and Confirmation (`Step6Confirm.tsx:46`, `StepPayment.tsx:27`,
  `BookingConfirmation.tsx:33`, which show the **unit** price, see F11).
- `createBooking` deliberately sends no price (`services/bookings.service.ts:53-56`) and
  today selects only `id` back (`:58`).

### F4 — Why the reported booking failed
`useBookingWizard.ts:240` always calls `/api/payment/create-session`. That route derives the
amount from the row and refuses a ₱0 one (`app/api/payment/create-session/route.ts:55-56`,
400 "Invalid booking amount"). The wizard then shows the "saved but not paid" toast and the
confirmation together (`useBookingWizard.ts:284-290`). The booking stays `is_paid = false`.

### F5 — Every booker surface that assumes payment
| Surface | File:line | Today for a ₱0 booking | Needs |
|---|---|---|---|
| Wizard steps | `lib/constants.ts:113` `WIZARD_STEPS` | Schedule → Documents → Review → **Pay** | no Pay step when free |
| Wizard button | `BookingWizard.tsx:132-135` | "Proceed to payment", then "Pay ₱ 0.00" | "Confirm booking" on Review |
| Pay step | `StepPayment.tsx` | "Complete Payment … Secured by PayMongo" | never shown when free |
| Submit | `useBookingWizard.ts:240-291` | calls create-session, 400, red toast | skip the call, no toast |
| Confirmation | `BookingConfirmation.tsx:21-33` | "Booking Confirmed!", Total ₱0 | "Booking submitted", Total "Free" (kiosk wording) |
| Needs you | `lib/homeRules.ts:32`, `NeedsYouCard.tsx:60-64` | "Payment not received yet" | not listed |
| List chip | `lib/utils.ts:80` `showPaymentPending`, `BookingList.tsx:102`, `BookingDetailModal.tsx:64` | "· Payment pending" | no chip |
| Up next | `useUpNextCard.ts:45`, `UpNextCard.tsx:43` | nothing (unpaid) | "· Free" |
| Detail amount | `BookingDetailModal.tsx:107-108` | "Amount ₱ 0.00" | "Price · Free" |
| Pay now | `lib/bookerActions.ts:157-175` `canPay` | shown, fails with the same 400 | hidden |
| Cancel | `lib/bookerActions.ts:80-107` + RPC `booker_cancel_booking` | works today (unpaid). **Breaks once settled** (F9) | must keep working |
| Refund request | `lib/bookerActions.ts:129-139` + `raise_booking_dispute` | hidden (unpaid). **Appears once settled** | hidden: nothing to refund |
| Payments state/totals | `lib/payments.ts:17-72`, `lib/paymentsFilter.ts:93-120` | "Unpaid ₱ 0.00", counted under Unpaid | D3 |
| Receipt | `PaymentReceipt.tsx:32-46` | "Unpaid … We have not received this payment" | D3 |
| CSV / print | `lib/paymentsCsv.ts:66-67`, `PaymentsPrintView.tsx:69-70` | "Unpaid", 0 | D3 |
| Payment-return banner | `useAppShell.ts:397-412`, `lib/paymentReturn.ts` | not reached (no PayMongo) | nothing |

### F6 — Kiosk free bookings already look wrong in booker
A kiosk customer who later signs in to booker sees their free kiosk booking (`is_paid = true`,
₱0) in Payments as **"Paid ₱ 0.00 — Paid through Ezzy checkout"**, which is untrue. The same
fix (key "free" on `price_paid = 0`) corrects it. No kiosk code changes.

### F7 — Trigger order is alphabetical, and it matters here
BEFORE INSERT triggers on `bookings` fire by name: `bookings_check_consistency` (computes
`price_paid`) → `bookings_check_placement`. A new trigger that reads `price_paid` must sort
**after** `bookings_check_consistency`. `bookings_settle_on_insert` does (`s` > `c`). The
precedent for writing this down is `20260803000005`'s header on `bookings_check_placement`.

### F8 — Ledger, payout, emails for a free booker booking
- **Ledger / payout:** `bookings_create_transaction` is `AFTER UPDATE OF is_paid … when new.is_paid`
  (`20260725000002_booking_transactions.sql:148-151`, body last replaced in `20261110000001`).
  An insert with `is_paid = true` writes **no** ledger row, so nothing in vendor Transactions
  or Command payouts. Identical to the kiosk (vendor-kiosk-hardening H1a). Cancelling it later:
  `bookings_sync_payout_status` updates the booking's ledger row, and there is none, so nothing
  happens. Correct.
- **Emails / notifications:**
  - `new_booking` to the vendor's admins fires on insert (`notify_on_new_booking`), same as a
    paid booking. ✔
  - `payment_confirmed` to the vendor is written only by the webhook
    (`app/api/payment/webhook/route.ts:193-221`). A free booking never reaches it, so the
    vendor is not told "payment confirmed". Correct: nothing was paid. Same as the kiosk.
  - `booking_confirmed` to the booker fires when the vendor confirms (status trigger), same as
    a paid booking. ✔
  - The kiosk needed a hand-written confirmation (H1b) because the kiosk customer otherwise
    gets nothing. A **paid booker booking gets no email at payment time either** (the webhook's
    second audience is kiosk-only, `route.ts:223-238`), so booker needs **no** new email.
- **Abandoned-checkout cleanup** (`architecture/booker-abandoned-checkout-cleanup.md:27,53-56`)
  already excludes `price_paid = 0`. It never touches a free booking, settled or not. ✔
- **Vendor screens:** `BookingDetailsModal.tsx:189-214` keys on `pricePaid === 0` ("Free",
  "No payment needed") for any origin. ✔ `useBookingActions.ts:99` shows an *unpaid* warning
  for `!isPaid` once a booking is past pending. Settling free bookings (B1) avoids it for new
  ones. Legacy stuck rows still trigger it on the vendor side: out of scope, F12.

### F9 — A settled free booking can't be cancelled by its booker without a DB change
`booker_cancel_booking()` refuses any `is_paid` booking with hint
`paid_requires_refund_request` (`20261003000001_booker_refunds_and_cancellation.sql:219-223`).
Once B1 settles free bookings, a booker could only "cancel" by filing a ₱0 refund request to
Command. The kiosk never hit this because kiosk customers don't use booker's cancel.
**Fix:** treat a booking as paid for this check only when `is_paid and price_paid > 0` (B2).
The matching client rule is `cancelBlockedReason` (`lib/bookerActions.ts:84`).

### F10 — The refund RPC would accept a ₱0 refund request
`raise_booking_dispute(..., 'refund_request')` requires `is_paid` (`20261003000001:302` onward)
and does not look at the price. Harmless (Command resolves it), so the plan hides it in the
client only. D4.

### F11 — Pre-existing: Review, Pay and Confirmation show the unit price, not the total
`Step6Confirm.tsx:46`, `StepPayment.tsx:27`, `BookingConfirmation.tsx:33` print
`offering.price`. The button prints `offering.price * quantity` (`BookingWizard.tsx:134`), and
PayMongo charges `price_paid` (the total). With quantity 2 the screen says ₱500 and the
button says Pay ₱1,000. Not caused by free offerings. D5.

### F12 — Out of scope, recorded only
- Vendor `useBookingActions.ts:99` unpaid warning for legacy ₱0 rows (vendor app).
- `ezzy-booker-mobile` has its own `lib/payments.ts` / `homeRules.ts` (mock data build). It will
  need the same free branch when it goes live. Parity follow-up for that plan.
- Explore, Home cards and the offering page print "₱ 0.00" for a free offering
  (`OfferingResultCard.tsx`, `PopularCardRow.tsx`, `OpenTodayCard.tsx`, `NearYouShelf.tsx`,
  `useOfferingPage.ts`). Cosmetic; a "Free" label there is a separate, small change.
- The paid path's confirmation also says "Booking Confirmed!" while the booking is still
  `pending`. Only reached when payment setup fails. Not changed here except the free variant.

### F13 — Another plan's unapplied migration sits in the same folder  ✅ handled for stage 1 (2026-11-11): user stashed both files (`stash@{0}` on backbone); renumbering still owed by the kiosk plan
`backbone/supabase/migrations/20261110000001_paid_after_cancel_ledger.sql` and
`supabase/tests/paid_after_cancel_ledger_test.sql` are untracked and **not applied** on local
(`migration list`, 2026-11-11). They belong to the paused plan
`.plans/2026-11-10-vendor-kiosk-qrph-in-app-payment.md` (B7). `migration up`, `db push` and
`db reset` apply **every** pending file, and there is no single-file option, so stage 1 would
apply it too.
- Plan for stage 1: the user stashes those two files (exact command recorded in chat
  2026-11-11), applies this plan's migration, and pops the stash afterwards.
- ⚠️ **Consequence for the kiosk plan:** `20261110000001` then sorts **before** an applied
  `20261111000001`. Before it is applied anywhere, renumber it to a timestamp after this plan's
  migration (allowed, since it is applied nowhere; precedent: the `20260829000003` renumber).
  Otherwise local needs `migration up --include-all` and staging `db push --include-all`.

---

### F14 — Home's "pick up where you left off" card shows four steps for a free draft  ⏸ MOVED (2026-11-11) → `2026-11-04-booker-followups.md` F2, at the user's call
`components/activity/InProgressCard/InProgressCard.tsx:48` maps `WIZARD_STEPS` (four) against the saved draft's `step`. The draft doesn't record whether the offering is free, so a free draft at Review shows "Review" with a fourth "Pay" dot still ahead. Cosmetic, and the copy ("You reached Review") is right. Unblocks if the user wants it: store the step list (or a `free` flag) in the draft. Not changed here.

### F15 — The detail modal's timeline says "payment released to vendor" on a free booking  ⏸ MOVED (2026-11-11) → `2026-11-04-booker-followups.md` F3, at the user's call
`lib/bookingTimeline.ts:36` labels the last step "Completed — Closed — payment released to vendor" for every booking. A free booking has no payment to release. Seen in the new `bookingdetailfree` baseline. Small and outside I1–I6 as written, so not changed. Unblocks on the user's say: a free variant ("Closed") keyed on `isFree`.

### F16 — The offering page promised a Pay step on a free offering  ✅ DONE (2026-11-11)
Found during the stage 4 run: `OfferingPage.tsx:226` always said "Next: upload what the vendor asks for, review, then pay. The vendor confirms after payment." `useOfferingPage.ts` now returns `nextNote`, free-aware; the `.tsx` renders it. Verified live on local: the free page reads "…then review and confirm. It's free, so there's nothing to pay. The vendor confirms your booking.", the paid page unchanged. tsc clean, 333/333 unit, lint unchanged at 18. No baseline covers this page (the `offeringphotos` mode is never baselined).

### F17 — Observed, not caused by this plan: dates and slots follow the BROWSER's time zone  ⏸ MOVED (2026-11-11) → `2026-11-04-booker-followups.md` F4, at the user's call (they named "F16", which is already ✅; F17 was the third parked item)
The headless browser on this machine runs US Eastern. `fmtDate` (`lib/utils.ts:31`) renders a `booked_date` of 2026-11-11 as "Nov 10" there, and the offering page offered 2026-11-11 2:00 PM when it was already 02:39 on 12 Nov in Manila. A Philippine booker (UTC+8) sees neither. Pre-existing and not investigated; noted so it isn't mistaken for a regression. Unblocks if bookers outside UTC+8 matter.

### F18 — Pre-existing, found by the user's local test: booker books an after-midnight slot on the wrong day  ✅ DONE (2026-11-11, user said "fix it now")
**Reported 2026-11-11:** ben@bookdeck.com booking "Cooking class" (₱0, Citywide Sports Center) at
2026-11-11 2:00 AM → "Booking failed. Please try again.", `POST /rest/v1/bookings` 400.
**Cause (reproduced as Ben in a rolled-back transaction):** `ERROR: This schedule does not start
until 2026-11-11` from `check_booking_placement()`. The schedule opens 23:00 with an 840-minute
window (23:00 → 13:00 next day) from 2026-11-11. Booker lists the 02:00 slot under the date the
window OPENS, and `slotInstant()` (`services/schedules.service.ts:150`) knows it really starts the
next day. But the wizard sends `bookedDate: date` (`useBookingWizard.ts:201`), the OPENING date.
The database reads `booked_date` as the date the booking STARTS, so it maps 11-11 02:00 to the
window that opened 11-10 23:00, which is before the schedule's start.
**Not caused by free offerings:** the same slot fails identically with the offering priced at ₱500;
Ben's free booking at 11-11 23:00 and 11-12 02:00 both insert and settle (`is_paid = t`, ₱0). All rolled back.
**Worse than the error:** on any later date the same mismatch does not error. It silently books the
slot ONE DAY EARLIER than the booker chose (the previous night's window). Vendor's kiosk already
stores the real date (`ownDate`, `vendor/components/kiosk/KioskBooking/useKioskBooking.ts:243`).
**Fix (booker only, no database change):**
- `lib/slots.ts`: new pure `slotStartDate(occurrenceDate, windowStart, slotStart)`; the one copy of
  the rule. `slotInstant()` (`services/schedules.service.ts`) now uses it instead of its own copy.
- `useBookingWizard.ts`: derives `bookedDate` (the slot's start date; `date` stays the calendar
  cell the booker picked) and sends it to `createBooking`. `BookingWizard.tsx` shows it on
  Review, Pay and the confirmation.
- `useOfferingPage.ts`: the slot's day label is its start date ("Thu, Nov 12 12:00 AM", not
  "Wed, Nov 11 12:00 AM"); `date` stays the window's date for the wizard.
- Booker's occupancy count already expected the next-day date (`schedules.service.ts:270-273`),
  so it now agrees with what is stored.
**Verified:** failing test first (`slotStartDate` missing), then 3 new cases in `lib/slots.test.ts`
(before/after midnight, month and year rollover, a midnight-opening window); `npm test` 336/336;
tsc clean; lint unchanged at 18. **Live on local, as Ben** (user's dev server on :3001, local
Supabase): slots listed "Wed, Nov 11 11:00 PM | Thu, Nov 12 12:00 AM | …", picked Thu 12:00 AM,
Review "2026-11-12", insert **201**, "Booking submitted", 0 payment calls; stored
`2026-11-12 00:00–01:00`, `pending`, `is_paid = t`, ₱0, 0 ledger rows, 1 document. ⚠️ That booking
is real local data on Ben's account.
**Visual suite after this fix ✅ (2026-11-11):** run by a background Codex session at the user's
request (test-only prompt: no snapshot updates, no edits, no git writes). Playwright's own log:
`209 passed (10.0m)`, `EXIT=0`; working tree unchanged by the run. Committed by the user as booker
`a40cd5c` "Free (₱0) offerings fix" on `develop` (49 files, +408/−88, 20 baselines).

## Read-only pre-checks

### R1 — Reproduce F1 on local, rolled back  ✅ DONE (2026-11-11) — before: `850.00 | t | forged | confirmed | kiosk`; after the user applied `20261111000001` locally: `850.00 | f | (null) | pending | booker`. Both rolled back.
As an authenticated booker in a transaction that ends in `rollback`: insert a booking on a
priced offering with `is_paid: true`, and read back `is_paid`. Expect `true` today. Rerun after
B1 is applied locally: expect `false`. Check the triggers first (memory: test-db-mutations).
`notify_on_new_booking` writes a notification row, which the rollback removes.

### R2 — Existing stuck ₱0 bookings on staging  ⬜ TODO (👤 runs it, read-only)
I have no staging credentials and must not handle them. The user runs this in the staging SQL
editor (or through the read-only role, `architecture/staging-readonly-role.md`):
```sql
-- Free booker bookings, by state. Read-only.
select b.booked_via, b.is_paid, b.status, count(*) as n,
       min(b.created_at) as first_seen, max(b.created_at) as last_seen
from   public.bookings b
where  b.price_paid = 0
group  by 1, 2, 3
order  by 1, 2, 3;

-- Free bookings that do have a ledger row (expected: none).
select b.id, b.booked_via, b.is_paid, t.id as transaction_id
from   public.bookings b
join   public.booking_transactions t on t.booking_id = b.id
where  b.price_paid = 0;

-- The reported booking (2026-11-12 11:00, EZZYTECH IT Solutions).
select b.id, b.status, b.is_paid, b.price_paid, b.payment_reference, b.booked_via
from   public.bookings b
join   public.vendors v on v.id = b.vendor_id
where  v.name ilike '%EZZYTECH%' and b.booked_date = '2026-11-12' and b.start_time = '11:00';
```
**Proposal for what it finds (D6, nothing is fixed by this plan):**
- Rows with `booked_via = 'booker'`, `is_paid = false`, `price_paid = 0`: **leave them.** The
  booker UI change keys "free" on `price_paid = 0`, so they render as free (no Pay now, not in
  Needs you, cancellable, because the cancel RPC already allows unpaid bookings). Flipping
  `is_paid` with an UPDATE would fire the ledger trigger and write a ₱0 ledger row (F8), so a
  data fix is worse than the problem.
- If the ledger query returns rows, stop and report: that would mean something settled a free
  booking by UPDATE.

---

## BLOCKERS

### B1 — Settle at insert in the database, for signed-in callers  ✅ DONE on local (2026-11-11) — user applied `20261111000001`; trigger present; B3 6/6 PASS for real; R1 rerun stores the forged booking unpaid; live E2E free booking stored `is_paid = t`, no ledger row (stage 4).
**File:** new `backbone/supabase/migrations/20261111000001_booker_insert_settlement.sql`
(latest is `20261110000001`; re-check before writing).
Closes F1 and settles free bookings. The booker app sends nothing new: the database derives
`is_paid` from its own `price_paid`. A booker can't mark a priced booking paid, whatever they send.
```sql
-- Draft, not yet a file. D2 (2026-11-11): status and booked_via are pinned too.
create or replace function public.settle_booking_on_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- System actors have no JWT subject: the kiosk route (service_role), seed and pg_cron.
  -- They keep the values they send. The kiosk already settles its own free bookings
  -- (vendor/lib/kioskFreeBooking.ts) and that path is unchanged.
  if auth.uid() is null then
    return new;
  end if;

  -- price_paid was derived by bookings_check_consistency, which sorts before this
  -- trigger by name. ⚠️ Renaming either trigger can reorder them.
  -- Settled at INSERT so the ledger trigger (AFTER UPDATE OF is_paid) never fires:
  -- a free booking writes no ₱0 ledger row, exactly like a free kiosk booking.
  new.is_paid           := coalesce(new.price_paid = 0, false);
  new.payment_reference := null;
  new.status            := 'pending';   -- D2
  new.booked_via        := 'booker';    -- D2
  return new;
end;
$$;

comment on function public.settle_booking_on_insert() is
  'BEFORE INSERT on bookings, for signed-in callers only: is_paid is derived (true only when the trigger-derived price_paid is 0) and payment_reference is cleared, whatever the client sent. Closes a hole where the INSERT policy had no column guard. Must sort after bookings_check_consistency.';

create trigger bookings_settle_on_insert
  before insert on public.bookings
  for each row
  execute function public.settle_booking_on_insert();
```
- `security invoker` on purpose: it only edits `NEW`, so it needs no privilege.
- **Blast radius.** Data: no existing row is touched or revalidated. Lock: `create trigger`
  takes a brief `SHARE ROW EXCLUSIVE` on `bookings`, milliseconds on this size. Downstream:
  the booker web insert is the only JWT insert path (vendor and command insert only through
  the kiosk's service-role route; both mobile apps don't insert bookings directly). No type
  change. Reversible: `drop trigger bookings_settle_on_insert on public.bookings; drop function public.settle_booking_on_insert();`.
- Coupled with B2 (same migration file): without B2, a newly settled free booking can't be
  cancelled by its booker (F9).

### B2 — Cancel RPC: "paid" means paid and priced  ✅ DONE on local (2026-11-11) — B3 cases 4/5 PASS for real; live E2E: the booker cancelled a settled free booking from the detail modal → `cancelled`, `is_paid` still t, no ledger row.
Body derived from the `20261003000001` text by script with exactly two substitutions; `diff` against the original shows only those lines.
**File:** same migration. `create or replace function public.booker_cancel_booking(uuid)`,
reproducing the **current** body from `20261003000001:190-…` exactly, with two changes:
- `select id, booker_id, status, is_paid, price_paid, booked_date, start_time into b …`
- `if b.is_paid and b.price_paid > 0 then raise … hint = 'paid_requires_refund_request'`
Grants and `comment on function` restated as in the original. Before writing, diff the
reproduced body against the live one (`pg_get_functiondef` on local) so nothing else drifts.
Blast radius: function replace only, instant, no data. Reverse by re-running the old body.

### B3 — SQL test for B1 + B2  ✅ DONE (2026-11-11) — 6/6 PASS against the applied migration (exit 0). Existing suites `booking_transitions`, `auto_acknowledge`, `withholding_and_corrections`, `payout_statements` all exit 0 against it too.
Regression: `booking_transitions`, `auto_acknowledge`, `withholding_and_corrections` and `payout_statements` tests all exit 0 with the migration in the same rolled-back transaction.
**File:** new `backbone/supabase/tests/booker_insert_settlement_test.sql`, following
`paid_after_cancel_ledger_test.sql` (one transaction, `rollback` at the end). Cases:
1. Booker inserts a priced booking with `is_paid: true, payment_reference: 'x'` → stored
   `is_paid = false`, `payment_reference is null`.
2. Booker inserts a ₱0 booking with `is_paid: false` → stored `is_paid = true`, and
   **no `booking_transactions` row**.
3. Service-role (no JWT) insert with `is_paid: true` on ₱0 → unchanged (kiosk path).
4. Booker cancels their settled ₱0 booking → `cancelled`, still no ledger row.
5. Booker cancels a paid priced booking → still refused with `paid_requires_refund_request`.
6. A webhook-style UPDATE `is_paid false → true` on a priced booking still writes one ledger row.
7. (D2) Booker insert with `status: 'confirmed', booked_via: 'kiosk'` → stored `pending` / `booker`.

---

## IMPORTANT (booker/ only)

### I1 — One rule for "free"  ✅ DONE (2026-11-11) — `isFree()` in `lib/payments.ts`, keyed on `Number(pricePaid) === 0`; tests in `payments.test.ts`. Machine-verified: `npx tsc --noEmit` clean, `npm test` 333/333, `npm run lint` 18 problems = the pre-existing 18, none in a changed file.
**File:** `lib/payments.ts` (it is already "the ONE place that decides" money, line 1-3).
Add `isFree(b: Pick<Booking, "pricePaid">): boolean` → `Number(b.pricePaid) === 0`. Keyed on the
stored price only, **not** on `isPaid`, so the legacy unpaid ₱0 rows (R2) and the kiosk's
settled ones (F6) both read as free. Pure, unit-tested in `lib/payments.test.ts`.
- ⚠️ `toBooking()` maps `price_paid ?? 0` (`services/bookings.service.ts:151`), so a null price
  would read as **free**. It can't be null today: the insert trigger always sets it, and local
  has 0 null rows (checked 2026-11-11). Note it in `isFree`'s comment rather than change the
  mapper. `Number()` covers a `numeric` that arrives as a string (the kiosk module's caveat).

### I2 — Action and Home rules use it  ✅ DONE (2026-11-11) — `payBlockedReason`/`refundBlockedReason` return `"free"`, `cancelBlockedReason` is "paid" only when paid and priced, `homeRules` never asks a free booking for payment, `showPaymentPending` takes the price (both callers updated). Existing fixtures now carry `pricePaid: 850` so they test what they tested before; free cases added for both shapes (settled / legacy unpaid). Machine-verified: `npx tsc --noEmit` clean, `npm test` 333/333, `npm run lint` 18 problems = the pre-existing 18, none in a changed file.
⚠️ `lib/utils.ts` writes the test out (`Number(pricePaid) === 0`) instead of importing `isFree`: `payments.ts` re-exports `fmtPeso` from `utils.ts`, so the import would be a cycle, and `@/` paths don't resolve under `node --test`.
- `lib/bookerActions.ts`: `payBlockedReason` returns `"free"` first; `cancelBlockedReason`
  returns `"paid"` only when `isPaid && !isFree` (mirrors B2); `refundBlockedReason` returns
  `"free"` (D4). The `Pick<>` types grow `pricePaid`; callers pass a full `Booking` already.
- `lib/homeRules.ts:32`: a free booking never yields `"payment"`.
- `lib/utils.ts:80` `showPaymentPending`: add the price, return false when free. Two callers
  (`BookingList.tsx:102`, `BookingDetailModal.tsx:64`).
- Tests: the existing `*.test.ts` beside each file gain free cases, including a free
  booking with `isPaid = false` (legacy) and `isPaid = true` (settled).

### I3 — `createBooking` returns what the database decided  ✅ DONE (2026-11-11) — selects `id, price_paid` and returns `free` (a null price is never free). `is_paid` is not read back: the free decision is the price, which is right before and after the migration (safe-pause table). Machine-verified: `npx tsc --noEmit` clean, `npm test` 333/333, `npm run lint` 18 problems = the pre-existing 18, none in a changed file.
**File:** `services/bookings.service.ts:42-65`. `.select("id, is_paid, price_paid")` (the
booker's own SELECT policy covers it) and return `{ id, result, free }`, where
`free = Number(price_paid) === 0` (PostgREST may send `numeric` as a string, as the kiosk
module notes). Still sends no price and no `is_paid`. That stays true and the comment says so.

### I4 — Wizard: no Pay step, no PayMongo, honest confirmation  ✅ DONE (2026-11-11, machine-verified; live check ⬜ stage 4). Machine-verified 2026-11-11: tsc clean, `npm test` 333/333, lint = pre-existing 18 (the 5 in touched files are on untouched lines), Playwright full suite **209 passed, exit 0**. 8 existing baselines moved on purpose (`bookingconfirm`, `step6`, `steppay`: total now `₱ 850.00` from `fmtPeso`; `payments`: the new Free chip; diffs inspected, nothing else moved) and 12 new ones recorded for the six `*free` modes, reviewed by eye. Live check is stage 4 (L1–L4).
Built: `useBookingWizard.ts` derives `steps` (`FREE_WIZARD_STEPS` = `WIZARD_STEPS` without "Pay"), `lastStep`, `nextLabel` ("Confirm booking" on a free Review), `totalLabel` ("Free" or `fmtPeso(price × quantity)`, D5) and `doneFree` (from `createBooking`'s `free`). When `free`, it skips `/api/payment/create-session` and the toast. `LAST_STEP` export removed (its only importer now reads `lastStep` from the hook). `BookingWizard.tsx` renders `nextLabel` instead of building it inline. `Step6Confirm`, `StepPayment`, `BookingConfirmation` take `totalLabel` (and `free` for the confirmation: "Booking submitted" / "<vendor> will confirm your booking. There is nothing to pay.") and stay pure display. Gallery modes `bookingstepperfree`, `step6free`, `bookingconfirmfree` added.
**Files:** `useBookingWizard.ts`, `BookingWizard.tsx`, `BookingConfirmation.tsx`,
`Step6Confirm.tsx`.
- **Display** decision from the offering on screen: `priceIsZero = offering.price === 0`. The
  hook exposes `steps` (`WIZARD_STEPS` without `"Pay"` when free), `lastStep`, and
  `nextLabel` ("Next" / "Proceed to payment" / "Pay ₱x" / **"Confirm booking"**), so the
  `.tsx` stops building the label inline. `WIZARD_STEPS` stays the single source; the free
  list is derived from it.
- **Settlement** decision from I3's `free` (the database). After uploads and
  `onBookingConfirmed()`: if `free`, skip `/api/payment/create-session`, no toast, `setDone(true)`.
  Otherwise the existing PayMongo path, unchanged.
- The two can disagree only if the vendor edits the price mid-booking. Both directions are
  safe because the database settles: screen free + DB priced → `free` is false, goes to
  PayMongo as a normal paid booking; screen priced + DB free → `free` is true, skips PayMongo,
  shows the free confirmation. Unlike the kiosk, no correction UPDATE is needed (B1 decides
  in the same statement). Comment this in the hook.
- `BookingConfirmation` gets a `free` prop: title **"Booking submitted"**, line "<vendor>
  will confirm your booking.", Total **"Free"**. Paid wording unchanged. Review's Total
  shows "Free" when `priceIsZero`.
- Component separation: `BookingConfirmation`, `Step6Confirm` and `StepPayment` are pure display
  (props only, no state) and stay so; the new values arrive as props. All state and the label
  logic live in `useBookingWizard.ts`. No new inline `style={{}}`; Tailwind classes as today.

### I5 — Activity: detail, Up next  ✅ DONE (2026-11-11, machine-verified; live check ⬜ stage 4). Machine-verified 2026-11-11: tsc clean, `npm test` 333/333, lint = pre-existing 18 (the 5 in touched files are on untouched lines), Playwright full suite **209 passed, exit 0**. 8 existing baselines moved on purpose (`bookingconfirm`, `step6`, `steppay`: total now `₱ 850.00` from `fmtPeso`; `payments`: the new Free chip; diffs inspected, nothing else moved) and 12 new ones recorded for the six `*free` modes, reviewed by eye. Live check is stage 4 (L1–L4).
Built: `useBookingDetailModal` exposes `free`; the modal's amount row reads "Price · Free". `useUpNextCard` exposes `free` (in `UpNextView` and `NONE`); the card shows "· Free" instead of "· Paid". Gallery modes `upnextfree`, `bookingdetailfree`, `paymentsfree` (with a `FREE_BOOKING` fixture kept out of `BOOKINGS`, so no existing baseline moves for fixture reasons).
- `BookingDetailModal.tsx:107-108`: when free, `<dt>Price</dt><dd>Free</dd>`. The hook
  (`useBookingDetailModal.ts`) exposes `free`. Pay now is already gated by `payable`
  (I2), refund by `canRequestRefund` (I2), cancel by `canCancel` (I2 + B2).
- `useUpNextCard.ts:45` exposes `free`; `UpNextCard.tsx:43` renders "· Free" instead of
  "· Paid" for it.

### I6 — Payments  ✅ DONE (2026-11-11) — fifth `PaymentState "free"` (checked after cancelled/refunded), copy "Free" / "This booking is free. There was nothing to pay.", `countByState`, `STATE_OPTIONS` + `stateCounts` (Free chip), chip colour `--st-confirmed-*` in `PaymentReceipt.module.css` and `PaymentMonthGroup.module.css`. CSV and print view follow through `PAYMENT_STATE_COPY`. Amounts stay numeric ("₱ 0.00" beside a "Free" chip), a deliberate change from the D3 note's "Free instead of ₱ 0.00": the chip already says Free, and the CSV amount must stay a number. Machine-verified: `npx tsc --noEmit` clean, `npm test` 333/333, `npm run lint` 18 problems = the pre-existing 18, none in a changed file. Visual check is in stage 3.
~~Option (a), not chosen:~~ leave free bookings out of Payments. Filter them out where
Payments builds its rows (`lib/paymentsFilter.ts`, the `scoped` list at `:93-120`), so the list,
counts, totals, receipt, CSV and print view all follow from one line. Activity still lists
them. Unit test in `lib/paymentsFilter.test.ts`. **Chosen (D3 b, 2026-11-11):** a fifth
`PaymentState "free"` with label "Free", note "No payment needed.", excluded from both totals,
and every `Record<PaymentState, …>` and the CSV extended.

---

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains — see §7. -->
- **D1 — approach** → **(a) DB trigger B1 + cancel fix B2, then the booker UI** (resolved 2026-11-11). Vendor does not use a migration: the kiosk settles in its own service-role route. Booker inserts from the browser, so the database has to do the same job. The trigger returns early when there is no signed-in user, so the kiosk route (vendor web and vendor mobile both call `/api/kiosk/booking`) is unchanged. No other app inserts bookings (grep 2026-11-11: vendor mobile's `bookings` calls are reads only).
- **D2 — pin `status` and `booked_via` too** → **yes** (resolved 2026-11-11). Uncomment both lines in B1; B3 gains a case: a booker insert with `status: 'confirmed', booked_via: 'kiosk'` is stored as `pending` / `booker`.
- **D3 — free bookings in Payments** → **(b) show them as "Free"** (resolved 2026-11-11). I6 takes its (b) shape: a fifth `PaymentState "free"`, checked **before** paid/due in `paymentState` (cancelled and refunded still win), label "Free", note "No payment needed.", excluded from `paidTotal` and `dueTotal`, its own count and filter option, and every `Record<PaymentState, …>`, the CSV and the print view extended. Receipt shows "Free" instead of "₱ 0.00".
- **D4 — ₱0 refund request** → **(a) hide it in booker only** (resolved 2026-11-11). `raise_booking_dispute` unchanged.
- **D5 — unit price vs total** → **(a) fix in I4** (resolved 2026-11-11): Review, Pay and Confirmation show `price × quantity`.
- **D6 — legacy stuck ₱0 rows** → **(a) leave them** (resolved 2026-11-11). I1 shows them as free and they stay cancellable. No data fix.

## Plan review (2026-11-11): gaps checked
- **Weak implementations this wording blocks:** deciding "free" from `offering.price` in the
  browser and sending `is_paid` (I3 and I4 forbid it: display from the screen, settlement from
  the DB row only); settling by a later UPDATE (writes a ₱0 ledger row, F8); a trigger name
  that sorts before `bookings_check_consistency` (F7); replacing `booker_cancel_booking` from
  memory instead of the live body (B2 requires a diff).
- **Wizard draft:** the saved draft stores `step`, but nothing restores it
  (`useBookingWizard.ts:45` always starts at 1), so a 3-step free wizard can't resume on a
  step that doesn't exist. Nothing to do.
- **`create-session` route:** left as is. With Pay now hidden for free bookings it has no free
  caller. Its 400 for ₱0 stays as the backstop.
- **Component separation:** stated per component in I4/I5. No new component; no `.module.css` needed.
- **Release path:** staging before production, production last, no production step earlier.

## DEFERRED / COSMETIC
- F12 items: vendor unpaid warning on legacy rows, booker-mobile parity, "Free" on Explore/Home
  cards, the paid path's "Booking Confirmed!" wording. Each is outside this plan's scope or app.

---

## Execution order
1. **Stage 1 — backbone (gated by D1/D2/D4):** R1 (baseline) → write B1 + B2 in one migration
   and B3's test → 👤 user applies it locally (`npx supabase migration up`) and runs B3 → 🤖 rerun R1.
2. **Stage 2 — booker logic:** I1, I2, I3, I6. `npx tsc --noEmit`, `npm run lint`, `npm test`.
3. **Stage 3 — booker UI:** I4, I5. Same checks, plus the visual suite for the wizard and
   Activity fixtures (`npm run test:visual`). New baselines only for the intended changes.
4. **Stage 4 — local end to end:** 👤 create a ₱0 offering in the local vendor app, then book it
   from booker (Verification L1–L4).
5. **Stage 5 — staging release** (below). R2 runs here, before S1.
6. **Stage 6 — production release**, always last.

### Safe-pause states (DB and app deploy independently)
| DB | Booker app | Free booking | Paid booking | Safe? |
|---|---|---|---|---|
| old | old | today's bug (red toast, unpaid) | normal | ✔ (status quo) |
| **new** | old | settled at insert; old app still calls create-session → 400 → red toast, but Activity shows it right as long as the booking is paid | normal; F1 closed | ✔ |
| old | **new** | app skips PayMongo (DB `price_paid = 0`); row stays unpaid but every booker screen reads it as free (I1); cancel works | normal | ✔ |
| new | new | target | normal | ✔ |
Every in-between state is safe, so the default order (DB first, then app) holds with no
special recovery.

## Release (§12)
### Staging (production untouched throughout)
| # | Who | Step | Check |
|---|---|---|---|
| S0 | 👤 | R2 read-only queries on staging | results pasted into this plan |
| S1 | 👤 | `npx supabase migration list --linked` → `npx supabase db push` (linked = staging) | ⛔ only `20261111000001` pending |
| S2 | — | Edge Functions / secrets / env vars | none in this plan |
| S3 | 👤 | Deploy booker to staging | — |
| S4 | 👤 + 🤖 | Staging checks V1–V6 | ⛔ all green |

⛔ **Staging fully green before anything touches production.**

### Production (last stage)
| # | Who | Step | Check |
|---|---|---|---|
| P1 | 👤 | Parity: `migration list --project-ref <prod>` vs staging | ⛔ prod = staging minus `20261111000001` |
| P2 | 👤 | `npx supabase db push --project-ref <prod>` | ⛔ trigger present: `select tgname from pg_trigger where tgname = 'bookings_settle_on_insert'` |
| P3 | 👤 | Vercel **Promote** the exact booker staging deployment tested in S4 | — |
| P4 | 👤 + 🤖 | Production checks: V1 with a real ₱0 offering if one exists, else V5 only | ⛔ all green |

## Verification
**Machine (local):**
- B3 SQL test passes (👤 runs it; 🤖 reads the output). R1 shows `false` after B1.
- `npx tsc --noEmit`, `npm run lint` (no new errors over the pre-existing count), `npm test`
  with the new free cases in `payments`, `bookerActions`, `homeRules`, `paymentsFilter`.
- `grep` booker for `create-session`: still two callers, both behind a free check or `canPay`.
- Visual suite: only the intended fixtures change.

**Live, local (L) then staging (V):**
- L1/V1 — Book a ₱0 offering: no Pay step, button says "Confirm booking", **no PayMongo page**,
  no red toast, confirmation says "Booking submitted · Free".
- L2/V2 — DB row: `is_paid = true`, `price_paid = 0`, `payment_reference is null`, no
  `booking_transactions` row.
- L3/V3 — Activity: not in Needs you, no "Payment pending", detail says "Price · Free", no Pay
  now, no refund request, **Cancel works**. Payments: listed as "Free", outside both totals, Free filter count right.
- L4/V4 — Vendor sees it as "Free · No payment needed", receives the new-booking notification,
  no "payment confirmed"; confirming it sends the booker "Booking Confirmed".
- V5 — A paid offering still goes to PayMongo, the webhook settles it, and one ledger row is written.
- V6 — A kiosk free booking still works as before (vendor-kiosk-hardening checks), and in booker
  Payments it now shows "Free" instead of "Paid ₱ 0.00".

## Stage 4 — local end-to-end results (2026-11-11)  ✅ DONE (local)
Driven through the real booker UI (Playwright, headless, `next dev` on :3210) against the **local**
Supabase only. `booker/.env.local` was checked first: `NEXT_PUBLIC_SUPABASE_URL` host is
`127.0.0.1:54321`. `/api/payment/create-session` was intercepted in the browser, so PayMongo was
never contacted. Seed booker Sofia Bautista (`…0011`), seed vendor Summit Athletics Club (`…0003`).
- **Fixtures added to the local DB** (ids start `e2e0…`): offerings `E2E Free Consult` (₱0,
  `EZFREE`) and `E2E Paid Session` (₱500, `EZPAID`), one weekly schedule each. Bookings made by the
  run: free @ 2026-11-11 14:00 (cancelled by the booker), free @ 15:00 (confirmed by the vendor),
  paid @ 14:00 (pending, unpaid). Left in place for the user to look at; a cleanup script was
  written to the session scratchpad (`e2e_cleanup.sql`) and not run.
- **L1 ✅** Free: stepper has 3 steps, labels Next → Next → **Confirm booking**, **0** calls to
  create-session, confirmation **"Booking submitted"**, Total **Free**, no "saved but not paid"
  toast. Paid control: 4 steps, … → Proceed to payment → **Pay ₱ 500.00**, **1** call to
  create-session (intercepted), redirect followed.
- **L2 ✅** Free row: `pending`, `is_paid = t`, `price_paid = 0.00`, no reference, `booker`,
  **0 ledger rows**, `new_booking` → vendor admins. Paid row: `is_paid = f`, ₱500, 0 ledger rows.
- **L3 ✅** Activity: Needs you lists only "Payment not received yet · EZPAID"; the free row has no
  "Payment pending"; detail shows **Price · Free**, no Pay now, no refund request, **Cancel booking**,
  and cancelling it worked (`cancelled`, still settled, 0 ledger rows). Payments: chips
  Paid 5 · Unpaid 1 · **Free 1** · Cancelled 1; row "₱ 0.00 · Free"; receipt "Free — This booking
  is free. There was nothing to pay."
- **L4 ✅ (database level)** Vendor-admin `…0008` confirmed the free booking (as that user's
  JWT): `confirmed`, still settled, 0 ledger rows, `booking_confirmed` → booker. The vendor app's
  screen was not driven; it keys "Free / No payment needed" on `pricePaid === 0`
  (`vendor/.../BookingDetailsModal.tsx:189-191`), unchanged and already live for kiosk bookings.
- Not covered locally: the PayMongo webhook (cannot reach localhost; memory: paymongo-webhook-localhost).
  The ledger-on-payment path is covered by B3 case 6.

## Docs
**Docs:** `architecture/schema.md` (migration-history row for `20261111000001`; the third BEFORE INSERT trigger and its name order; `is_paid` settled at insert for free bookings) · `architecture/auth-and-roles.md` (insert guard on `bookings`; `booker_cancel_booking` "unpaid or free") · `architecture/booking-flow.md` (flow overview's free branch; `booked_date` is the slot's start date; new "Free offerings" section) · `architecture/portals.md` (booker wizard 3 steps when free; kiosk section's stale "booker cannot book ₱0" line) · `booker/AGENTS.md` (wizard step count) · `.plans/2026-11-04-booker-followups.md` (F2–F4 added) · `.plans/2026-08-25-vendor-launch-followups.md` (F15 "addressed" note, status untouched)

