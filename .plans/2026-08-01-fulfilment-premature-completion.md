# Fulfilment — premature completion and payment visibility

**Date:** 2026-08-01
**App / scope:** `backbone` (auto-acknowledge gate), `vendor` (unpaid confirm step), `booker` (payment visibility)
**Status:** COMPLETE (2026-08-01) — B1 ✅ · I1 ✅ · I2 ✅. No open decisions.

> Three defects found while manually testing the dual-acknowledgement flow. They
> share one theme: **a booking can be driven to `completed` — and its payout
> released — before the thing being paid for has actually happened or been paid
> for.** Optimize for: no payout becomes releasable without real evidence of
> delivery.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "dual-ack I12").

---

## Investigation record

Verified on the live local stack against a real test booking
(`7af98185-…`, Phone Rental, `custody`, `confirmed`, `booked_date 2026-08-18`,
`is_paid false`).

**No date gate exists anywhere.** Checked all three places one could live:

| Layer | Result |
|---|---|
| Vendor action logic (`useBookingRow.ts:15-20`) | Keys on `(status, fulfilment_pattern)` only — **no date check** |
| `validate_booking_status_transition()` | **No date check** (confirmed via `pg_get_functiondef`) |
| `auto_acknowledge_bookings()` | **No date check** — only `status` + `status_changed_at` |

**The exploit that falls out.** On the **session** path only:

1. Vendor confirms a booking dated three weeks out.
2. Vendor immediately taps **Mark as done** → `fulfilled`.
3. Booker ignores it (reasonably — nothing has happened yet).
4. **Three days later `auto_acknowledge_bookings()` promotes it to `completed`**,
   `sync_booking_payout_status` flips the payout to `releasable`.

The vendor is owed money for a service still weeks away, with no human ever
agreeing to it. **Custody is accidentally immune** — nothing auto-advances out of
`in_progress`, so the booker must actively say they returned the item. The
vulnerability is created by the 3-day timer, not by the vendor's action.

---

## BLOCKERS

### B1 — The 3-day timer can complete a booking before its service date  ✅ DONE
**File:** `backbone/supabase/migrations/20260801000006_auto_acknowledge_bookings.sql`
(new migration; that one is applied and must not be edited)

**Fix approach — gate the TIMER, not the vendor's action.** This is the key
judgement in this plan, so the reasoning is recorded rather than assumed:

Blocking `confirmed → fulfilled` before `booked_date` was the obvious fix and is
the **wrong** one. Early handover is legitimate — a customer collects a rental the
evening before, a vendor delivers a service ahead of schedule by agreement — and
blocking it strands those bookings with no exit. The exploit does not need the
vendor's early action; it needs the **timer completing without the booker**.

So: the timer refuses to auto-complete a `fulfilled` booking whose service date has
not passed. A vendor may still mark done early; the booker may still confirm early
(which is a genuine two-party agreement and fine). Only the *unattended* path is
closed.

```sql
-- inside the `due` CTE of auto_acknowledge_bookings()
where  status in ('fulfilled', 'returned')
  and  status_changed_at < now() - interval '3 days'
  and  (
        -- `returned` needs no date gate: the BOOKER has already stated the item
        -- came back, which is direct evidence the booking happened. Only
        -- `fulfilled` is a unilateral vendor claim, so only it waits for the
        -- service date to pass.
        status = 'returned'
        or booked_date <= (now() at time zone 'Asia/Manila')::date
       )
```

**Timezone:** `booked_date` is a `date` and the platform is PH-facing, so the
comparison uses the Asia/Manila calendar date, matching `toPhDate()` /
`phDayStart()` in `vendor/lib/utils.ts`. Using bare `current_date` (UTC in the
container) would be up to 8 hours out — conservative rather than dangerous, but
wrong, and wrong in a way that only misbehaves near midnight.

**Blast radius:**
- *Data* — none. Function replacement only; no table touched.
- *Behaviour* — a `fulfilled` booking dated in the future stops auto-completing. It
  resumes being eligible the day after its service date. Nothing already
  `completed` changes.
- *Existing rows* — the local DB has one `fulfilled` booking from seed; its
  `booked_date` is in the past, so it stays eligible.
- *Reversibility* — restore the previous function body from `…000006`.

**Approval gate:** schema change (function replacement).

**Verification:** extend `backbone/supabase/tests/booking_transitions_test.sql`, or
a sibling script — a `fulfilled` booking dated tomorrow with `status_changed_at`
5 days ago must **not** be promoted; the same booking dated yesterday **must** be.
Machine-verifiable.

> **✅ DONE (2026-08-01).** Shipped as
> `20260801000009_auto_acknowledge_date_gate.sql` — a **new** migration; `…000006`
> is applied and was not edited. New sibling test
> `supabase/tests/auto_acknowledge_test.sql`, **8/8 passing**:
>
> | Case | Expected | Result |
> |---|---|---|
> | `fulfilled`, 5d old, service date **+14d** | HELD | ✅ |
> | `fulfilled`, 5d old, service date **tomorrow** | HELD | ✅ |
> | `fulfilled`, 5d old, service date **yesterday** | PROMOTED | ✅ |
> | `fulfilled`, 5d old, service date **today** | PROMOTED | ✅ |
> | `fulfilled`, **1d** old, service date yesterday | HELD | ✅ |
> | `returned`, 5d old, service date **+14d** | PROMOTED | ✅ |
> | `returned`, **1d** old, service date yesterday | HELD | ✅ |
> | `in_progress`, **90d** old | HELD | ✅ |
>
> **The test was proved meaningful, not merely green.** Re-running the +14d case
> against the pre-fix function body (inside a rolled-back transaction) yields
> **PROMOTED — the exploit** — so the test genuinely discriminates between the two
> implementations rather than passing vacuously.
>
> **Harness note:** probes rewrite `booked_date`, which collides with
> `bookings_no_duplicate` UNIQUE `(booker_id, schedule_id, booked_date)` when
> sibling bookings exist. The script therefore reduces the table to one booking
> first. Caught by the first run failing, not by inspection.
>
> **Regression:** 45-cell transition matrix still green; `cron.job` entry intact
> (`auto-acknowledge-bookings @ 0 * * * *`); 42 bookings untouched — both test
> scripts roll back.

---

## IMPORTANT

### I1 — dual-ack I12's confirm step was never built  ✅ DONE
**File:** `vendor/components/bookings/BookingRow/useBookingRow.ts:78`

**This is a correction to a previous claim.** `dual-ack I12` was marked ✅ DONE on
2026-08-01, but only half of it shipped. The item required:

> surface an unmistakable "Not paid" marker … **and require a confirm step** on
> `confirmed → fulfilled` / `confirmed → in_progress` when `is_paid = false`

The marker exists (`unpaidWarning`, `useBookingRow.ts:70`) and renders. The confirm
step does not — `doFulfil` fires straight through:

```ts
const doFulfil = () => { if (fulfil) fulfilB(b.id, fulfil.action) }
```

So a vendor hands over an unpaid booking with a single click and no friction —
which is the half of I12 that actually protects them. The ✅ was overstated: the
verification run only confirmed the chip rendered in the gallery fixture, and never
exercised the interaction.

**Why it matters beyond tidiness:** an unpaid booking produces **no
`booking_transactions` row ever** (the ledger is written by the `is_paid`
false→true trigger). The vendor can complete the entire fulfilment flow and
discover afterwards that no payout exists. Confirmed on the live test booking:
`is_paid = false` → `NO LEDGER ROW`.

**Fix approach:** when `unpaidWarning` is true, `doFulfil` sets a pending-confirm
state instead of firing; the row expands with *"This booking hasn't been paid for.
You won't receive a payout for it. Continue anyway?"* and Continue / Cancel.
**Reuse the existing inline expansion** (`reasonFor`, already generalised for
reject + flag) rather than adding a third idiom or a modal.

**Coupling:** update `dual-ack I12`'s status in
`.plans/2026-07-31-booking-fulfilment-dual-acknowledgement.md` in the same change —
leaving a ✅ that overstates what shipped is the exact failure the status model
exists to prevent.

**Verification:** live — a booking with `is_paid = false` must require two taps to
hand over; one with `is_paid = true` must still be one tap.

> **✅ DONE (2026-08-01).** `useBookingRow.ts` gained `confirmUnpaid` state and
> `needsUnpaidConfirm`; `doFulfil` prompts instead of firing, with
> `confirmUnpaidFulfil` / `cancelUnpaidFulfil` as the two exits.
> `BookingRow.tsx:89-112` renders the confirmation in the **same inline-expansion
> area** as the reason capture — no modal, no third idiom.
>
> **Kept separate from `reasonFor` on purpose:** that field means "which reason is
> being collected" and both its modes need a textarea. This collects a decision,
> not text, so folding it in would have muddied the field's meaning for a small
> saving.
>
> **Narrowed vs the original I12 wording:** applies to the two `confirmed → …`
> moves only, not `returned → completed` — the vendor has already handed over and
> been prompted once by then.
>
> **Verified:** `tsc --noEmit` 0, `npm run build` 0, and the branch simulated
> across 8 `(status, is_paid, pattern)` combinations — paid `confirmed` fires in
> one tap, unpaid `confirmed` prompts, `returned` and `pending` behave as before.
> **Not verified — needs a browser:** the expansion's appearance and copy.
>
> **`dual-ack I12` corrected** in the same change; its ✅ now records that the
> confirm step arrived here rather than there.

---

### I2 — Booker has no signal that payment did not register  ✅ DONE
**File:** `booker/components/dashboard/BookingStatusWidget/BookingStatusWidget.tsx`, `booker/services/bookings.service.ts` (add `is_paid` to the select)

The booker's dashboard shows a booking as **Confirmed** whether or not payment was
ever recorded. In this test the booker completed PayMongo checkout, the redirect
returned normally, and the booking still reads `is_paid = false` — because the
**webhook** is the authoritative confirmation and it cannot reach `localhost`.

In production the window is seconds, so this is not primarily a local-dev concern:
a genuinely failed or unconfirmed payment currently looks identical to a paid one
from the booker's side, and the first they'd learn otherwise is a dispute.

**Resolved 2026-08-01 → option (a), the quiet chip.**

**Verification:** live — a booking with `is_paid = false` shows the chosen
treatment; flipping `is_paid = true` clears it.

> **✅ DONE (2026-08-01).** `Booking.isPaid` added to `booker/lib/types.ts:58` and
> selected in `services/bookings.service.ts`. One shared predicate,
> `showPaymentPending(isPaid, status)` in `lib/utils.ts`, drives all three
> surfaces so they cannot disagree: the dashboard widget (inline after the date),
> `BookingCard`, and `BookingDetailModal` (under the status badge).
>
> **Deliberately shown on `pending` too** — unlike the vendor's equivalent, which
> excludes it. A pending unpaid booking is exactly the case where the BOOKER most
> needs to know: they abandoned checkout and can still fix it. Hidden on
> `cancelled` / `refunded`, where it is only noise.
>
> **Kept genuinely quiet:** body-text colour at 80% opacity, no icon, no border,
> no colour. It is information, not an alarm — the normal case is that it clears
> within seconds of the webhook arriving.
>
> **Verified:** `tsc --noEmit` 0; `npm run build` 0 across booker, vendor and
> command; fixture `b2` carries `isPaid: false` so the chip renders in
> `/ui-gallery`. **Not verified — needs a browser:** that it reads as quiet rather
> than alarming at real size.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. B1 and I1 are unaffected. -->

- Where to gate premature completion → **the auto-acknowledge timer, not the
  vendor's action** (resolved 2026-08-01) — blocking early handover would break
  legitimate flows and strand bookings; the exploit only exists because the timer
  completes *unattended*. Recorded in B1 with the full reasoning.
- Whether `returned` also needs a date gate → **no** (resolved 2026-08-01) — the
  booker stating the item came back is direct evidence the booking happened.
  Only `fulfilled` is a unilateral vendor claim.

- I2: how visible should an unconfirmed payment be to the booker? → **(a) a quiet
  "Payment pending" chip** (resolved 2026-08-01) — honest without alarming, and
  correct for a state that is normally momentary. Options as offered:
  - **(a) A quiet "Payment pending" chip** beside the status, disappearing once
    `is_paid` is true. *Recommended* — honest, low-noise, and correct for a state
    that is normally momentary.
  - **(b) Chip plus an explanatory line** ("We haven't received confirmation from
    your payment provider yet"). More reassuring if it persists; more alarming
    during the normal few-second window.
  - **(c) Nothing** — treat it as purely transient and rely on the vendor noticing.
    Cheapest, but leaves a genuinely failed payment invisible to the person who
    made it.

---

## DEFERRED / COSMETIC

- **Local webhook delivery (ngrok).** Not a defect. Toggle `is_paid` directly for
  testing — it fires the same `bookings_create_transaction` trigger the webhook
  does, because that trigger is deliberately anchored to the **column**, not to the
  webhook (see `20260725000002`'s header). See the note at the end of this plan.

---

## Execution order

1. **B1** ✅ — done 2026-08-01.
2. **I1** ✅ — done 2026-08-01.
3. **I2** ✅ — done 2026-08-01.

B1 and I1 are independent of each other and can be done in either order.

---

## Verification

| Item | How | Kind |
|---|---|---|
| B1 | SQL test: `fulfilled` + future `booked_date` + 5-day-old `status_changed_at` → **not** promoted; same with a past date → promoted | machine-verifiable |
| B1 (regression) | Existing 45-cell transition matrix still green | machine-verifiable |
| I1 | Unpaid booking needs two taps; paid booking needs one | needs-live-environment |
| I1 (plan) | `dual-ack I12` no longer claims a confirm step that does not exist | machine-verifiable (grep) |
| I2 | `tsc` + `build`; one shared predicate drives all three surfaces; fixture `b2` renders it | machine-verifiable; visual weight needs-live-environment |

---

## Appendix — toggling `is_paid` for local testing

The PayMongo webhook cannot reach `localhost`, so `is_paid` stays `false` after a
sandbox payment. Flip it directly:

```sql
update public.bookings
   set is_paid = true
 where id = '<booking-id>'
   and is_paid = false;      -- the guard matters: the trigger fires only on false -> true
```

This is **not** a hack. `bookings_create_transaction` fires `AFTER UPDATE OF is_paid`
guarded by `old.is_paid is distinct from new.is_paid and new.is_paid = true` — the
exact write the webhook performs — so a manual flip produces a real ledger row with
the correct fee snapshot.

**Verified 2026-08-01** on the live test booking (inside a rolled-back transaction):

| | |
|---|---|
| `payout_status` | `held` |
| `amount_paid` | 1203.00 |
| `platform_fee_amount` | 144.36 |
| `payout_amount` | 1058.64 |

Keep the `and is_paid = false` guard: re-running without it is harmless (the
trigger's `when` clause and the `on conflict do nothing` both stop a duplicate),
but the guard makes the intent explicit and matches the webhook's own statement.
