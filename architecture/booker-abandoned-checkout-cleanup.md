# Booker — abandoned-checkout clean-up (manual routine)

**Since:** 2026-10-28 · **Applies to:** production (and staging, when testing)
**Decided by:** `.plans/2026-10-27-booker-v1-pre-release.md` D1 = (a), 2026-10-28
**Retire when:** the shared reservation-expiry fix ships (kiosk checkout plan B4, see "Why this
exists"). Then delete this routine and its pointers in `booking-flow.md` and the core rules.

> A customer who presses **Pay** in booker and walks away from PayMongo leaves a `pending`, unpaid
> booking that **holds its place in the slot for ever**. Nothing expires it. Until the real fix
> ships, a person releases those places **once a day**, through the vendor dashboard.

---

## The routine at a glance

| | |
|---|---|
| **How often** | Daily |
| **Cutoff** | Unpaid for **more than 24 hours** |
| **Only these** | booker bookings · `pending` · `is_paid = false` · price above zero · slot still **in the future** |
| **Find with** | the read-only query below, in the **production** SQL editor |
| **Release with** | **Reject** on the booking in the **vendor dashboard** (never SQL) |
| **Time needed** | a couple of minutes on a quiet day |

---

## Step 1 — find them (read only)

Supabase → **backbone-prod** → SQL Editor. Run:

```sql
-- List unpaid booker bookings holding a future slot for more than 24 hours. Read only.
select b.id                                   as booking_id,
       v.name                                 as vendor,
       o.name                                 as offering,
       b.booked_date,
       b.start_time,
       p.full_name                            as booker,
       b.price_paid,
       b.payment_reference is not null        as reached_paymongo,
       date_trunc('minute', now() - b.created_at) as unpaid_for
from public.bookings b
join public.vendors   v on v.id = b.vendor_id
join public.offerings o on o.id = b.offering_id
left join public.profiles p on p.id = b.booker_id
where b.booked_via = 'booker'
  and b.status = 'pending'
  and b.is_paid = false
  and coalesce(b.price_paid, 0) > 0
  and b.created_at < now() - interval '24 hours'
  and (b.booked_date + coalesce(b.start_time, time '00:00'))
        > (now() at time zone 'Asia/Manila')
order by v.name, b.booked_date, b.start_time;
```

**No rows: done for the day.**

Why each condition is there:
- `booked_via = 'booker'`: kiosk bookings have their own flow and are out of scope.
- `is_paid = false`: ⚠️ a **paid** `pending` booking is a real customer waiting for the vendor to
  confirm. Never release one of those.
- `price_paid > 0`: a free booking is never meant to go through PayMongo.
- **future slot only**: an unpaid booking whose date has passed blocks nobody. Leave it.
- `reached_paymongo`: for information only. `true` = the customer got to PayMongo and left;
  `false` = they never reached the checkout.

## Step 2 — release each one in the vendor dashboard

For each row, someone with **vendor-admin** access to that row's vendor (usually the vendor's own
staff; ask them) does this:

1. Vendor dashboard → **Bookings**.
2. Find the booking: same offering, date, time and customer as the row.
3. Click **Reject**, enter the reason, and confirm.

**Suggested reason** (the customer receives it in a "Booking Rejected" notification):

> Payment was not completed, so this booking has been released. You're welcome to book again.

What Reject does: the booking becomes `cancelled`, with the reason and who cancelled it recorded
(`vendor/services/bookings.service.ts:163`), and the place returns to the slot at once. Command has
no screen for this: its oversight page only covers in-progress bookings.

## Step 3 — confirm

Run the Step 1 query again. The rows you rejected should be gone.

---

## ⚠️ Don'ts

- **Don't cancel with SQL.** The database only lets the customer, the vendor or Command cancel a
  booking (`validate_booking_status_transition`, `20261003000001`). A SQL-editor session is none of
  those, so it is refused, and hand-editing production rows is outside the project's rules anyway.
- **Don't reject a paid booking.** If a row looks wrong, re-run the query rather than trusting an
  old result. A customer may have paid in the meantime.
- **Don't shorten the cutoff below about 30 minutes.** A customer may still be on the PayMongo page.
  24 hours was chosen for a once-a-day check.

## Good to know

- **Until it is rejected, the customer can still pay.** A `pending` unpaid booking has a **Pay now**
  action in booker's Activity (`booking-flow.md` → "Paying a booking that already exists"). This is
  why a held place is a limited harm, and why a 24-hour wait is acceptable.
- **The same customer cannot rebook that exact slot afterwards.** `bookings_no_duplicate` keeps a
  cancelled row's slot key, so their second attempt at the same slot is refused (`23505`). Other
  customers can book it normally. If a customer asks, they need a different time, or vendor/Command
  help.
- **Size at the time of writing (2026-10-28):** staging had 2 abandoned checkouts, both older than
  7 days and neither holding a future slot; production had none (not yet launched).

## Why this exists, and what replaces it

`confirmBooking()` inserts the booking **before** the PayMongo session exists, and nothing expires
an unpaid one. A server-side clean-up job can't simply be added, because the transition rule has no
system actor for `pending → cancelled`.
- The defect: `.plans/2026-10-04-booker-payment-lifecycle.md` B1 (⏸ parked).
- The fix: a shared reservation lifecycle in `.plans/2026-09-29-vendor-kiosk-custom-checkout.md`
  B4, cross-app and schema-gated, vendor kiosk first and booker later (that plan's S5).

When B4 ships for booker, retire this routine.
