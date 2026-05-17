# Booking Hardening

**Reference name:** `booking-hardening`  
**Date:** 2026-05-15  
**Scope:** `./backbone` (schema) · `./academy` (service layer + UI wiring) · `./learner` (service layer)  
**Status:** Planning — not started

---

## Context

The `bookings` and `booking_documents` tables have solid foundations (correct RLS, financial record preservation, denormalized FKs with consistency triggers) but are missing enforcement at the DB and service layers, and the academy portal has zero live wiring to bookings. This plan addresses all 10 identified gaps in priority order.

---

## Checklist

### Priority 1 — Critical (blocks correct behaviour)

- [ ] **#1 — Capacity enforcement (DB trigger)**
  - New migration: `check_booking_capacity()` trigger on `bookings BEFORE INSERT`
  - Counts existing `pending + confirmed` rows for the same `(schedule_id, booked_date)`
  - Raises exception if count `>= schedules.max_capacity`
  - Must be atomic — no app-layer-only check (race condition risk)
  - File: `backbone/supabase/migrations/20260516000001_booking_capacity_trigger.sql`

- [ ] **#2 — Duplicate booking prevention (unique constraint)**
  - New migration: `UNIQUE (learner_id, schedule_id, booked_date)` on `bookings`
  - File: `backbone/supabase/migrations/20260516000002_booking_unique_constraint.sql`
  - Handle the constraint error in `learner/services/bookings.service.ts` → surface "You have already booked this slot."

- [ ] **#3 — Academy booking service layer**
  - Create `academy/services/bookings.service.ts` with:
    - `getBookings(academyId)` → fetch real `bookings` rows joined with `profiles` (learner name), `offerings` (name, code), `schedules` (start_time)
    - `approveBooking(id)` → UPDATE `status = 'confirmed'`
    - `rejectBooking(id, reason)` → UPDATE `status = 'cancelled'`, set `rejection_reason` (see gap #5)
  - Update academy `Booking` type in `lib/types.ts` to match the real DB shape (replace mock fields `student`, `av`, `paid`, `branch`, `type`)
  - Wire `BookingsPage` and `useBookings` to call `getBookings` on mount
  - Wire `approveB` / `rejectB` to the real service functions
  - Update `BookingRow` to render real DB fields

---

### Priority 2 — Important (needed before production)

- [ ] **#4 — Status transition enforcement (DB trigger)**
  - New migration: `validate_booking_status_transition()` trigger on `bookings BEFORE UPDATE`
  - Allowed transitions:
    - `pending → confirmed`
    - `pending → cancelled`
    - `confirmed → completed`
    - `confirmed → cancelled`
    - `completed → refunded`
    - `cancelled → (terminal)`
    - `refunded → (terminal)`
  - File: `backbone/supabase/migrations/20260516000003_booking_status_transition.sql`

- [ ] **#5 — Rejection/cancellation reason field**
  - New migration: add `rejection_reason text not null default ''` to `bookings`
  - File: included in `20260516000003` or its own `20260516000004`
  - Academy `rejectBooking(id, reason)` sets this field
  - Learner booking detail view surfaces this when `status = 'cancelled'`

- [ ] **#6 — Booking status audit log**
  - New migration: create `booking_status_log` table mirroring `academy_status_log`:
    - `id uuid pk`, `booking_id uuid`, `changed_by uuid`, `from_status text`, `to_status text`, `notes text`, `changed_at timestamptz`
  - Trigger: `log_booking_status_change()` fires `AFTER UPDATE` on `bookings` when `status` changes
  - RLS: learners read their own booking logs; academy reads logs for their bookings; command reads all
  - File: `backbone/supabase/migrations/20260516000005_booking_status_log.sql`

- [ ] **#7 — Learner `getBookings()` service function**
  - Add `getBookings()` to `learner/services/bookings.service.ts`
  - Fetches all `bookings` for `auth.uid()`, joined with `offerings` (name, code, category) and `academies` (name)
  - Wire the learner dashboard to use this instead of seed/mock data

---

### Priority 3 — Moderate (data integrity, not blocking)

- [ ] **#8 — Document–requirement ID linkage**
  - New migration: add `requirement_id text not null default ''` to `booking_documents`
  - Populated when `booking_documents` rows are written (links to `offerings.requirements[].id`)
  - Allows academy to match uploaded files to specific requirements
  - File: included in Supabase Storage wiring migration (deferred — see #10)

- [ ] **#9 — `cancelled_by` field on bookings**
  - New migration: add `cancelled_by uuid references public.profiles(id) on delete set null` to `bookings`
  - Set in the status transition trigger (using `auth.uid()`) when status moves to `cancelled`
  - File: `backbone/supabase/migrations/20260516000006_booking_cancelled_by.sql`

- [ ] **#10 — `status` column consistency (minor, low urgency)**
  - Currently `text` with a CHECK constraint; rest of schema uses FK to `statuses` lookup table
  - Booking statuses (`pending`, `confirmed`, `completed`, `cancelled`, `refunded`) are domain-specific — they do NOT belong in the shared `statuses` table
  - **Decision: leave as-is.** The CHECK constraint is appropriate here. Creating a separate `booking_statuses` lookup table would add a join with no real benefit — these values will not be user-managed. Mark as resolved / won't fix.

---

### Deferred (planned follow-up, not in this plan's scope)

- [ ] **Document uploads to Supabase Storage** — Step 4 currently in-memory; needs Storage bucket policy + `booking_documents` write + `requirement_id` linkage (gap #8)
- [ ] **Wallet / payment integration** — `price_paid` is snapshotted; no digital payment record or deduction flow exists yet
- [ ] **Notifications** — no push/email mechanism when academy approves or rejects; needs a `notifications` table or third-party integration
- [ ] **Capacity display in learner Step 3** — show remaining slots per (schedule, date); needs a query counting bookings per occurrence
- [ ] **Academy map markers** — `academies` has no `lat`/`lng` columns; Leaflet map shows user dot only
- [ ] **Learner cancellation flow** — "Reschedule" / "Cancel" on dashboard are placeholders; needs a status update path scoped to `pending` bookings only

---

## Execution Order (when approved)

Run migrations first, then service layer, then UI:

1. `20260516000001` — capacity trigger
2. `20260516000002` — unique constraint
3. `20260516000003` — status transition trigger + `rejection_reason` column
4. `20260516000004` — booking status log table + trigger + RLS
5. `20260516000005` — `cancelled_by` column
6. Academy `bookings.service.ts` — `getBookings`, `approveBooking`, `rejectBooking`
7. Academy `lib/types.ts` — real `Booking` type
8. Academy `BookingsPage` / `useBookings` / `BookingRow` — wired to live data
9. Learner `bookings.service.ts` — add `getBookings()`
10. Learner dashboard — wire to real bookings data
11. Learner `bookings.service.ts` — handle duplicate booking constraint error message
12. `tsc --noEmit` in both `./academy` and `./learner`
13. Runtime verification — no console errors, approve/reject flow works end-to-end

---

## Approval gates (per AGENTS.md)

Each migration file requires approval before being applied:
- Migrations #1–5 are schema changes → get approval before running `supabase migration up`
- Academy type changes touch both service and UI layers → review before applying

---

## Verification (end state)

| # | Check | Expected |
|---|-------|---------|
| 1 | Book a slot at max capacity, then try to book again | DB raises exception; learner sees error |
| 2 | Same learner books same schedule + date twice | DB raises unique violation; learner sees "already booked" |
| 3 | Academy bookings page | Shows real bookings from DB, not mock data |
| 4 | Academy approves booking | Status → `confirmed`; status log row written |
| 5 | Academy rejects with reason | Status → `cancelled`; `rejection_reason` set; learner sees reason |
| 6 | Invalid status transition attempted | DB trigger raises exception |
| 7 | Learner dashboard | Shows real booking history, not seed data |
| 8 | `tsc --noEmit` (academy + learner) | Zero errors |
| 9 | No runtime console errors | Clean console in both portals |
