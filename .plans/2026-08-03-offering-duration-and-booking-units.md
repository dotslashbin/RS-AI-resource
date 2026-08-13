# Offering duration, schedule availability, and booking units

**Date:** 2026-08-03
**App / scope:** `backbone/` (schema), `vendor/` (offering + schedule forms), `booker/` (wizard steps 1/3/5/6), `ezzy-vendor-mobile/` (display only)
**Status:** ✅ **COMPLETE (2026-08-04)**, with one shortfall found later — all 6 stages,
all 9 blockers, and 15 of 17 important items. Two were out of scope and carried forward:
**I14 has since been ✅ fixed (2026-08-11)**; **I15's `command` arm is the only thing still
open** here, and is also tracked as F15 of
`.plans/2026-08-11-crossapp-unbounded-query-truncation.md`. Nothing else in this plan
needs revisiting.

⚠️ **Amended 2026-08-07:** a documentation audit found the **booker's date-granular render
arm was never built**, so a `day`/`week`/`month` offering cannot be booked at all. It is
not a regression — it was never shipped, and no check here covered it. Added as a third
item under "Carried forward" at the end; read that before trusting the claim below that
"the booker wizard [is] granularity-driven".

<details><summary>Prior status line</summary>

**Stages 0–5 ✅. All 9 blockers and 14 of 15 important items done.** Duration is enforced, slots are real and derived, capacity means one thing,
`price_paid` is server-derived, both the vendor form and the booker wizard are
granularity-driven, and mobile renders each booking's own span.
**Remaining: Stage 6 (docs) only** — no migrations, no approval gates, no app code.
`db reset` 0; `tsc` 0 in all three apps; `build` 0 in both web apps; `expo lint`,
`npm test` (95/95) and `expo export` 0 on mobile; **19 browser tests green**
(17 vendor, 2 booker); every trigger behaviour verified live against the DB.
**Not verified:** the mobile change on a device, and nothing at all on iOS.

</details>

**Revised 2026-08-03 (gap review #1).** A pass against the code found seven gaps in
this plan's own coverage, two of which were defects *in the plan* rather than in the
product: **B7** (the seed breaks at Stage 1/2, so the stage order was wrong) and the
**per-slot capacity rule** in M5 (a naive overlap count is incorrect once D7 allows
multi-slot bookings). Added B6, B7, I6–I11 and decisions D7, D8.

**Revised 2026-08-03 (gap review #2 — readiness check).** Nine further gaps, folded in:

| | Gap | Resolution |
|---|---|---|
| G1 | All three apps read a booking's time from a `schedules` join, so every booking of a schedule would show the same time | **New blocker B8**; old I5 rescoped and demoted |
| G2 | `seed.sql`'s three `bookings` inserts supply no `start_time` → `db reset` breaks at **Stage 3** | **B7** gained a third arm |
| G3 | `time + interval` **wraps** (verified: `23:00 + 2h = 01:00`), inverting the range the capacity check relies on | **M4** — ordering guard + a 23:00 test case (V20) |
| G4 | `Step3Schedule/` has no companion hook; D7/I9 add state | **I4** — required shape stated |
| G5 | `quantity` was not pinned, so it could drift from the price computed from it | **M4** + V19 |
| G6 | Mode invariants weren't in the trigger spec | **M5** + V18 |
| G7 | No migration filenames or ordering | **§7** preamble |
| G8 | Grants/RLS position unstated | **§7** preamble — nothing to do, with the reasoning |
| G9 | Same booker could hold overlapping spans when capacity > 1 | **M5** + V17 |

Net effect on shape: **Stage 3 is now the widest stage** — backbone, vendor, booker and
mobile move together. Nothing else changed order.

**Revised 2026-08-03 (gap review #3 — course-of-action check).** Three further items,
folded into existing stages; **no restructuring**. A de-risking option for Stage 3 was
raised and **deferred by the user** — Stage 3 stays a single four-repo batch.

| | Gap | Resolution | Stage |
|---|---|---|---|
| G10 | M4/M5 never state trigger **timing**, and the two triggers they touch need *different* ones. Uniform-and-wrong makes every booking on an edited schedule un-actionable | **New blocker B9** | 3 |
| G11 | Narrowing a schedule window silently orphans bookings already sold — the schedule-side mirror of I8 | **New I12** (warn, don't block) | 4a |
| G12 | M3 left pre-migration bookings with NULL `start_time`, which M5's overlap check skips → silent overbooking | **M3** gained a backfill | 2 |

Also struck: Stage 5's "blocked on the mobile repo's uncommitted work" — repo state is
the user's to sequence, not a plan constraint.

> Give the platform a **bookable unit**. Today duration is declared on the offering,
> availability is declared on the schedule, and nothing connects them — so a
> "1 hour" offering happily sells a 3-hour window to 5 people at once. Optimise for:
> the vendor configures two numbers and the system derives the rest.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "vendor I1").

> **Cross-plan coupling.** `.plans/2026-08-02-web-apps-production-launch-readiness.md`
> is **📌 PINNED** and its unpin note says the user is "fixing something else first,
> then returning here with that fix in hand". **This plan is that fix.** Its unpin
> checklist requires re-verifying every `file:line` anchor afterwards — this plan
> changes `booker/services/bookings.service.ts`, `booker/app/api/payment/create-session/route.ts`,
> and both vendor forms, so those anchors **will** move. Fold the result back in
> before that plan executes.

---

## 0. Scope

**In scope**

- A structured, normalised offering duration replacing free-text `offerings.duration`.
- A real **bookable unit** — derived, never stored — and the DB enforcement that a
  booking must land on one.
- Fixing what `schedules.max_capacity` means.
- Multi-day span bookings (D1).
- Per-unit pricing (D3), which also closes a client-controlled `price_paid` hole.
- The two vendor forms and the three booker wizard steps that consume all of it.

**Out of scope**

- **Resource identity.** "Which of my 3 courts did they get?" — capacity says *how
  many*, never *which one*. A `vendor_resources` table is the right model if that is
  ever needed; nothing here blocks it.
- **Per-slot pricing.** Peak/off-peak rates, weekend surcharges. `offerings.price`
  stays one number per unit.
- **`fulfilment_pattern`.** Untouched. See §1.3 — granularity is a *separate axis*
  and must not be folded into it.
- **Booking cancellation/reschedule**, still unbuilt, still out.
- **`command`**. Verified it renders no offering or schedule UI — `grep -rn "duration"
  command/` hits only `Sidebar.tsx` (a CSS transition). No work needed there.

---

## 1. Diagnosis

### 1.1 The flaw, stated once

**Three concepts are collapsed into two tables, and the one that matters does not
exist at all.**

| Concept | Where it lives today | Problem |
|---|---|---|
| How long one unit of service lasts | `offerings.duration` — free text | Unparsed by anything. Display copy. |
| When the vendor is available | `schedules.start_time`–`end_time` | Treated as *the* bookable thing, not a window |
| **What one booker actually reserves** | **nowhere** | **This is the missing abstraction** |
| How many bookings share it | `schedules.max_capacity` | Overloaded; means different things per offering |

Because the **bookable unit** does not exist:

- duration cannot be enforced — there is nothing to enforce it *against*;
- a schedule window is never subdivided, so one occurrence = one bookable thing
  regardless of how long the offering claims to be;
- `bookings` stores **no time at all** (`booked_date date` only, `20260507000004:29`),
  so two bookings of the same schedule on the same date are indistinguishable;
- `max_capacity` becomes the *only* thing preventing a double-booking, which forces
  it to mean "seats" for a class and "how many people may simultaneously hold this
  one court" for a rental.

### 1.2 The project's own seed data demonstrates it

Not hypothetical — `backbone/supabase/seed.sql`:

| Offering | `duration` | Its schedule | `max_capacity` | What actually happens |
|---|---|---|---|---|
| `GROUP` "Beginner Group Class" (`seed.sql:359`) | **'1 hour'** | **14:00–17:00** (`seed.sql:553`) | 5 | Offering says 1h, schedule says 3h. Booker sees one button, "2:00 PM", and books *the occurrence*. Nothing says whether they get 1h or 3h. |
| `COURT` "Court Rental" (`seed.sql:337`) | '2 hours' | 09:00–11:00 (`seed.sql:532`) | **20** | 20 bookers simultaneously hold one court. |
| `COACH` "Private Coaching" (`seed.sql:344`) | '3 hours' | 13:00–16:00 (`seed.sql:539`) | **8** | "Private" coaching, 8 at once. |

The `GROUP` row is the clean proof: **the two durations disagree and no layer
notices.**

### 1.3 The axis that is genuinely missing

The right discriminator is **what the booker consumes**, and it is *not* the same
axis as `fulfilment_pattern`:

| | `session` | `custody` |
|---|---|---|
| **time**-granular | a 1-hour lesson | a 2-hour court booking |
| **date**-granular | a 3-day training course | a 3-night hotel stay, a 5-day car hire |

All four cells are real. `20260801000001_fulfilment_patterns.sql:6-13` explicitly
warns against conflating "fulfilment shape" with other axes — reusing
`fulfilment_pattern` for granularity would repeat exactly the mistake that
migration was written to correct. **Granularity is a new, orthogonal property.**

### 1.4 Two live defects found while investigating

Independent of the redesign, present today:

- **End Time is optional in the form but `NOT NULL` in the DB.**
  `ScheduleFormModal.tsx:48` — `canSave = !!sfOffering && sfDate.trim() && sfTime.trim()`.
  `sfEnd` is not checked, and `schedules.service.ts:81` passes `end_time: input.end`
  straight through. Leaving End Time blank sends `''` into a `time not null` column
  → Postgres `22007`, surfaced raw via `error.message`. → **B5**
- **A recurring schedule with no days selected violates a CHECK.**
  `schedules_days_when_recurring` (`20260507000002:41`) requires
  `cardinality(days_of_week) > 0` when `recurrence <> 'none'`. The form lets you pick
  "Weekly" and select no days. Same raw-error path. → **B5**

### 1.5 A security finding, in scope because the fix subsumes it

**`price_paid` is set by the client.** `booker/services/bookings.service.ts:32`
inserts `price_paid: params.pricePaid` from wizard state, and the insert RLS policy
(`20260507000004`) checks only `booker_id = auth.uid() and is_active()` — no column
guard. `create-session/route.ts:41` then derives the PayMongo amount from that same
row and is documented as safe ("the amount is authoritative from the DB",
`booking-flow.md:181`).

That is half true: the *route* refuses the request body, but the *row it trusts* was
written by the client. A booker can insert `price_paid: 1` and pay ₱1 for an ₱850
booking; `booking_transactions` then records ₱1 as the vendor's revenue.

The same file already knows this is the rule — its comment at line 88 says loosening
the UPDATE policy "would expose `price_paid` and `is_paid` to booker writes". The
INSERT path was simply never given the same treatment. **D3's per-unit pricing
requires `price_paid` to be server-derived anyway, so B4 closes this as a side
effect rather than as separate work.**

---

## 2. Recommended architecture

### 2.1 The one idea

> **A schedule stops being a bookable thing and becomes an availability rule.
> The bookable unit is derived from `window ÷ offering duration`.**

The vendor configures **availability** and **duration**. The system derives
**slots**. Nobody types a duration twice.

```
offering:  duration = 1 hour                 ← the unit
schedule:  available 09:00–17:00, Mon/Wed/Fri ← the window
                     │
                     ▼  derived, never stored
slots:     09:00  10:00  11:00  12:00  13:00  14:00  15:00  16:00
                     │
                     ▼  capacity_per_slot = 1
booking:   2026-08-10 10:00–11:00
```

### 2.2 "Slots" — the verdict

The user asked whether slots stay, get renamed, or go. The answer is **none of the
three exactly**:

- **As a stored row: removed.** A `schedules` row stops being "a slot". Its own
  migration header already miscalls it one (`20260507000002:4` — "availability
  slots"); it is an availability *rule*.
- **As a derived concept: introduced properly.** Slots become real, computed,
  countable things that a booking must land on — which is what makes duration
  enforceable.
- **As a word in the UI: kept.** Bookers understand "slot". Vendors never configure
  one.

D2 chose **derived over materialised**: no `schedule_slots` table, no `pg_cron`
generator, no rolling horizon, no regeneration-and-reconciliation when a vendor
edits a window. It also keeps the documented design ("occurrence dates are expanded
at query/application time", `schema.md` → `schedules`) rather than contradicting it.

### 2.3 Manual vs derived — the split the user asked for

| Vendor types it | System derives it |
|---|---|
| Duration: `1` + `hour` | `duration_minutes = 60` |
| | Granularity (`time` vs `date`) — from the unit |
| | Which form to show — hourly UI or date-range UI |
| Availability window `09:00`–`17:00` | The slot list `09:00 … 16:00` |
| | Slot count (`8 slots`), shown live as they type |
| Repeat + days | Occurrence dates |
| Capacity per slot (default `1`) | |
| Price per unit | `price_paid = price × quantity` |
| | `end_time` / `end_date` of a booking |
| | Remaining spaces per slot |

### 2.4 Storage: one normalised number, many renderings

D-requirement: *"24 hours displayed as 1 day"*. Two columns carry it:

- `duration_minutes integer` — **the single normalised truth.** All arithmetic uses
  this and only this.
- `duration_unit text` — **the vendor's chosen frame**, for rendering *and* to
  resolve the ambiguity minutes alone cannot: `1440` is "1 day" (date-granular) or
  "24 hours" (time-granular) and only the vendor knows which.

`duration_unit` therefore does two jobs, which is why there is **no separate
granularity column and no lookup table**:

```
granularity(unit) = minute | hour        → 'time'
                    day | week | month   → 'date'
```

I deliberately diverge from the `fulfilment_patterns` lookup-table idiom here.
That table justified itself (`20260801000001:14-23`) on "adding a shape later is an
INSERT plus a trigger branch". Granularity has no third value — either the booker
picks a time of day or they do not — so a `CHECK` is the honest shape and a lookup
table would be ceremony. **This divergence is recorded as D6.**

---

## 3. BLOCKERS

### B1 — `offerings` has no enforceable duration  ✅ DONE (2026-08-03)
**File:** `backbone/supabase/migrations/20260506000001_offerings.sql:28` (`duration text not null default ''`), consumed at `vendor/components/offerings/OfferingFormModal/OfferingFormModal.tsx:88`, rendered at `booker/components/booking/steps/Step1Offering/Step1Offering.tsx:62`

Free text. Nothing parses it; nothing validates it against the schedule. It is the
declared half of a duration the schedule silently overrides.

**Fix approach:** Replace with `duration_minutes integer` + `duration_unit text`.
Exact SQL in §7 (M1). Backfill by parsing, then `DROP COLUMN duration` — D4 confirmed
pre-launch so no compatibility window is needed.

**Component separation:** `useOfferingForm.ts` already exists and owns all state;
the new unit picker adds `ofDurationValue` / `ofDurationUnit` there. `OfferingFormModal.tsx`
stays a pure render layer — the derived preview string comes from the hook, not from
JSX arithmetic.

**✅ Executed 2026-08-03 (Stage 1).** Migration `20260803000001_offering_duration_units.sql`
applied. Files changed:

| File | Change |
|---|---|
| `backbone/.../20260803000001_*.sql` | new — the two columns, backfill, notice loop, `drop column duration` |
| `backbone/supabase/seed.sql` | 3 column lists + 9 offering rows → `duration_minutes`/`duration_unit` |
| `vendor/lib/duration.ts` · `booker/lib/duration.ts` | new — `UNIT_MINUTES`, `formatDuration`, `durationQty`, `isDateGranular`. **Copied, not shared** (AGENTS.md forbids cross-app imports) |
| `vendor/lib/types.ts` · `booker/lib/types.ts` | `duration: string` → `durationMinutes` + `durationUnit` |
| both `services/offerings.service.ts` | row type, mapper, `select`, and (vendor) insert/update |
| `vendor/.../useOfferingForm.ts` | qty+unit state, `durationLabel`, `durationNote`, `canSave` |
| `vendor/.../OfferingFormModal.tsx` | number + unit picker, live label, per-unit price suffix |
| `vendor/.../OfferingCard.tsx` · `booker/.../Step1Offering.tsx` | render via `formatDuration` |
| both `app/ui-gallery/page.tsx` | fixtures; vendor gains a **date-granular** offering (`CAR`) and an `offeringform` mode |
| `vendor/visual-tests/pilot.spec.ts` | 4 behavioural tests for the picker |

**Verified.** `supabase db reset` exit 0, `NOTICE: all rows parsed cleanly`.
`tsc` 0 and `npm run build` 0 in **both** apps. **8/8 Playwright tests green**
(4 for B5, 4 new for the picker — default 1 hour, pluralisation, unit switching,
per-unit price label, and the 30-day month note).

⚠️ **The backfill is NOT exercised by `db reset`** — migrations run *before* seed, so it
ran against zero rows. Its logic was verified separately by running the parser over
literals: `1 hour→60`, `90 mins→90`, `1 month→43200 (month)` — **not 60/hour, confirming
the ordering trap is closed** — `3 months→129600`, `2 weeks→20160`, `half day→1440` (and
correctly reported as defaulted, having no digit).

---

### B2 — `schedules.max_capacity` is overloaded and defaults to 20  ✅ DONE (2026-08-03)
**File:** `20260507000002_schedules.sql:31` (`max_capacity integer not null default 20`), form at `vendor/components/schedule/ScheduleFormModal/ScheduleFormModal.tsx:196` ("Max Clients"), default at `useScheduleForm.ts:14` (`"20"`)

Means "seats" for a class and "simultaneous holders of one asset" for a rental, and
defaults to 20 for both. Because the window is never subdivided, it is also the only
thing preventing a double-booking — one column doing two unrelated jobs.

**Fix approach:** Rename to `capacity_per_slot`, **default `1`**, and relabel per
granularity: *"How many can book each slot?"* (time) / *"How many can book at once?"*
(date). Once slots exist, this column does exactly one job — sharing — and 1 is the
safe default for every offering shape. Exact SQL in §7 (M2).

**Coupling:** the label change is meaningless until B3 ships the slot concept; ship
B2 and B3 together.

**✅ Executed 2026-08-03 (Stage 2)** via `20260803000002_schedule_availability.sql`.
Renamed, default 1, constraint renamed to match, form label "Max Clients" →
"Bookings per slot", form default 20 → 1, `parseInt(sfMax) || 20` → `|| 1`, and
`DayDetailPanel` now says *"One booking at a time"* rather than "Max 1 clients".

⚠️ **A coupling this plan had mis-scheduled, found during execution.**
`check_booking_capacity()` reads `max_capacity` **inside its plpgsql body**, and
plpgsql resolves column names at *runtime*, not at definition time. The plan's M2
listed the trigger under "Downstream" and deferred it to M5 in Stage 3 — which would
have left **every booking insert failing** with `column "max_capacity" does not exist`
for the whole gap between Stage 2 and Stage 3, contradicting this stage's own promise
that "behaviour is unchanged and nothing can regress".

M2 therefore carries a `create or replace` of the function: `20260724000003`'s body
verbatim with the column renamed, **preserving both the `for update` row lock** (the
TOCTOU fix) **and the exact `'Schedule is fully booked for this date'` message**, which
`booker/services/bookings.service.ts:39` string-matches to map the failure to `"full"`.

**Verified live:** with `capacity_per_slot = 1`, the first insert succeeded and the
second was refused with the preserved phrase.

---

### B3 — No bookable unit: `bookings` stores no time  ✅ DONE (2026-08-03)
**File:** `20260507000004_bookings.sql:29` (`booked_date date not null`, no time column); capacity trigger `20260724000003_booking_capacity_lock.sql`; slot generation `booker/services/schedules.service.ts:112-117`

`getTimesForDate()` returns *one entry per schedule*, not per hour —
`schedules.filter(isOccurrence).map(s => s.startTime)`. So the booker's "time slots"
are the start times of different schedules. A single 09:00–17:00 schedule yields
exactly one button. `endTime` and `maxCapacity` are mapped in
`booker/services/schedules.service.ts:22,25` and **rendered nowhere** — verified by
grep across `booker/components/`.

**Fix approach:** Add `start_time`, `end_time`, `end_date`, `quantity` to `bookings`,
all trigger-derived and pinned (same discipline as `fulfilment_pattern`,
`20260801000001:97-118`). Add a slot-legality trigger. Rewrite the capacity trigger
as an overlap check. Rewrite `getTimesForDate()` to subdivide the window. Exact SQL
in §7 (M3–M5).

**Coupling:** requires B1 (duration must exist to divide by) and B2 (capacity must
mean one thing). Ships as one batch: **B1 + B2 + B3 + B4**.

**🔄 Schema half executed 2026-08-03 (Stage 2)** via `20260803000003_booking_units.sql`:
`start_time`, `end_time`, `end_date`, `quantity` added; `bookings_no_duplicate` widened
from a 3-column constraint to a unique **index** including
`coalesce(start_time, '00:00')` — the coalesce is load-bearing, since NULLs compare
distinct and date-granular rows would otherwise duplicate freely. Kept the same name so
`23505 → "already_booked"` still maps.

**The behavioural half (M4/M5 triggers) is Stage 3.** Nothing writes or validates these
columns yet.

⚠️ **The backfill did not run locally, and that is expected, not a defect.**
`supabase db reset` applies migrations *before* `seed.sql`, so M3's `UPDATE` saw zero
bookings — the 41 seeded rows are created afterwards and land with NULL times. The
statement itself was verified by running it directly against those rows: **41 updated,
0 left inconsistent.** The migration's backfill is correct and matters for any database
where bookings predate it; locally the fix is **B7's third arm** (seed bookings must
supply `start_time`), which is Stage 3 work. Until then a local DB carries 41
NULL-time bookings, which is harmless now — the current capacity trigger counts by
`(schedule_id, booked_date)` and ignores times — but **must not reach Stage 3**, where
the overlap check would silently skip them.

---

### B4 — `price_paid` is client-controlled  ✅ DONE (2026-08-03)
**File:** `booker/services/bookings.service.ts:32`; insert policy `20260507000004` ("bookers can insert bookings", no column guard); trusted downstream at `booker/app/api/payment/create-session/route.ts:41`

See §1.5. A tampered client underpays, and `booking_transactions` records the
tampered figure as vendor revenue.

**Fix approach:** Derive `price_paid` in `check_booking_consistency()` as
`offering.price × new.quantity` on INSERT, and pin it against UPDATE — the trigger
already runs `BEFORE INSERT OR UPDATE` and already fetches the offering, so this is
an extension, not a fourth trigger (the precedent `20260801000001:100` sets
explicitly). Drop `pricePaid` from `CreateBookingParams`. Implements D3's per-unit
pricing in the same stroke. Exact SQL in §7 (M4).

**Verification note:** this is the one item with a *security* claim, so it needs a
live check — insert a booking with a forged `price_paid` via the anon client and
confirm the stored value is the computed one.

**✅ Executed 2026-08-03 (Stage 3)** via `20260803000004_booking_derive_price_and_span.sql`.
`check_booking_consistency()` now derives `price_paid = offering.price * quantity` on
INSERT and pins it (with `quantity`, `start_time`, `end_time`, `end_date`) on UPDATE.
`booker/services/bookings.service.ts` no longer sends `price_paid` at all;
`useBookingWizard.ts` sends `startTime` + `quantity` instead.

**Verified live — the forgery test:** inserted a booking with `price_paid = 1` against
an offering priced 100. **Stored value: 100.00.** Span computed 09:00–10:00.
Pinning verified separately: `price_paid`, `quantity` and the span each raise on UPDATE.

`create-session/route.ts` needed no change — it already read from the DB, and that
value is now trustworthy rather than client-authored.

---

### B5 — Two form states produce raw Postgres errors  ✅ DONE (2026-08-03)
**File:** `vendor/components/schedule/ScheduleFormModal/ScheduleFormModal.tsx:48`

See §1.4. Blank End Time → `22007`; recurring with zero days → CHECK violation. Both
surface as `error.message` through `SchedulePage`.

**Fix approach:** Extend `canSave` — require `sfEnd` when the offering is
time-granular, and `sfDays.length > 0` when `sfRep !== "none"`. Pure app-layer
guard; the DB constraints stay as the backstop. **Ship this first** — it is
independent of every other item, needs no migration, and is a live bug.

**🔄 Executed 2026-08-03 (Stage 0).** Changed:

- `useScheduleForm.ts` — added `saveBlocker: string | null` + `canSave`, moved off the
  `.tsx`. Returns a *message*, not a bare boolean, because a silently disabled button
  is only marginally better than the raw driver error it replaces.
- `ScheduleFormModal.tsx` — consumes both from the hook (the local `canSave` at the old
  `:48` is gone), and renders `saveBlocker` above the footer buttons.

**Scope note — a third rule was added beyond the two this item named.** `schedules`
also carries `schedules_end_after_start check (end_time > start_time)`, which was the
same raw-error path through the same field. Guarding blank-end-time while leaving
end-before-start throwing would have been a half-fix, so `sfEnd <= sfTime` is included.
Times are `<input type="time">` values ("HH:MM", zero-padded), so string comparison
orders them correctly.

**Why this cannot over-block:** every rule mirrors a constraint that already exists on
`schedules`, so the guard can only narrow the form to what the database already
accepts. Any state it now blocks was previously a guaranteed failure at the DB.

**✅ DONE (2026-08-03).** Machine: `npx tsc --noEmit` 0, `npm run build` 0.
**Browser: 4/4 Playwright tests green** against the real component — blank end time,
end-before-start, and recurring-with-no-days each show their message with Save
disabled, **plus a negative control** (a complete one-time schedule leaves Save
*enabled*). The control matters: without it the three guard tests would pass equally
well on a button that is simply always dead.

Getting there required I13 (fixture) and I15 (the harness could not hydrate at all).

---

### B6 — A NULL `start_time` crashes both apps' schedule mappers  ✅ DONE (2026-08-03)
**File:** `vendor/services/schedules.service.ts:33-34,45-46` (`trimTime(t) => t.slice(0,5)`); `booker/services/schedules.service.ts:21-22` (`row.start_time.slice(0, 5)`)

M2 makes `start_time`/`end_time` nullable so date-granular schedules can exist without
a time of day. **The moment the first such row is created, every schedule read in both
apps throws** `TypeError: Cannot read properties of null (reading 'slice')` — not a
degraded display, a thrown exception inside the service, which takes down the vendor
Schedules page and the booker's Step 3 entirely.

This is the single highest-risk consequence of M2 and it is invisible until runtime:
the columns are typed `string` in both `DbRow` interfaces, so **`tsc` will not catch
it**. Nullable columns must be typed `string | null` in the same change.

**Fix approach:** Widen both `DbRow` interfaces to `string | null`, make `trimTime`
total (`(t: string | null) => t?.slice(0,5) ?? null`), and let `Schedule.time`/`.end`
and `BookerSchedule.startTime`/`.endTime` be nullable. TypeScript then forces every
consumer to be revisited — which is exactly what surfaces I6.

**Coupling:** must ship **in the same batch as M2**. A migration that lands without
this is a live crash.

**✅ Executed 2026-08-03 (Stage 2).** Both `DbRow` interfaces widened to
`string | null`, `trimTime` made total, and `Schedule.time/.end` +
`BookerSchedule.startTime/.endTime` made nullable. That did exactly what this item
predicted — `tsc` then enumerated every consumer:

| Flagged | Fix |
|---|---|
| `vendor/app/ui-gallery/page.tsx:70` | fixtures need `endDate`; added a date-granular `s3` |
| `vendor/.../useScheduleForm.ts:19,20` | `editSched.time ?? ""` — hidden fields expect a string |
| `booker/app/ui-gallery/page.tsx:81-83` | `maxCapacity` → `capacityPerSlot`, `endDate` |
| `booker/services/schedules.service.ts:118` | `getTimesForDate` returned `(string\|null)[]` — now type-guarded, so a date-granular schedule cannot contribute a null "slot" the booker could click |

**The one it could NOT flag** is exactly the one I6 exists for: `{s.time}` renders
`null` as an empty gap in JSX without complaint. Fixed by hand, asserted by test.

---

### B7 — `seed.sql` breaks at Stages 1, 2 **and** 3 — the plan's own ordering was wrong  ✅ DONE (2026-08-03)
**File:** `backbone/supabase/seed.sql:335,367,392` (inserts `duration`), `:529,563` (inserts `max_capacity`); `booker/app/ui-gallery/page.tsx:64,72,81-83`; `vendor/app/ui-gallery/page.tsx:62-63,67-68`

`seed.sql` inserts `duration` into `offerings` and `max_capacity` into `schedules`.
M1 drops the first; M2 renames the second. **`supabase db reset` fails immediately
after either migration** — which is the command used to test every subsequent stage.

§10 originally scheduled the seed under "Stage 6 — docs". That is wrong: the seed is
not documentation, it is the test fixture every later stage depends on. The
`ui-gallery` fixtures in both apps are the same class of problem — they are typed
against `Offering` / `Schedule` / `BookerSchedule`, so the type changes in B1/B6 break
`tsc` (and the visual-baseline page) at build time.

**And a third break at Stage 3.** `seed.sql` has **three** `insert into public.bookings`
sites (`:634` explicit, plus generated loops at `:970` and `:996`) and **none supplies
`start_time`**. Stage 3's slot-legality trigger (M5) rejects a time-granular booking
with a NULL start, so `db reset` fails there too. This is the same defect as the two
above; the first gap review only caught Stages 1 and 2.

**✅ All three arms executed** (Stage 1 offerings, Stage 2 schedules, Stage 3 bookings
— 2026-08-03). `supabase db reset` exits 0 after each stage. The Stage 3 arm turned out
larger than "add `start_time`": see I3 for why the booking loops had to be rewritten to
generate real occurrence dates.

**Fix approach:** Move the seed and fixture updates **into the stage that breaks them**:

| Stage | Seed / fixture work |
|---|---|
| 1 (M1) | `seed.sql` offering inserts (`:335,367,392`) + both `ui-gallery` offering fixtures |
| 2 (M2) | `seed.sql` schedule inserts (`:529,563`) + both `ui-gallery` schedule fixtures |
| **3 (M4/M5)** | **all three `seed.sql` booking sites (`:634,970,996`) gain `start_time` (and `quantity` where >1)** |

Re-seed the demo data to model *correct* configurations, since the current rows encode
the exact bug this plan removes (`GROUP`: 1-hour offering, 3-hour window — see §1.2)
and would otherwise re-seed it into every fresh database. Add one date-granular
offering + schedule + booking so that path has fixture coverage at all.

**Note on seeded `price_paid`:** the booking sites pass explicit prices (`850.00`
etc.). M4 makes `price_paid` trigger-computed, so those values are **silently
overwritten** rather than rejected. Not an error, but the seed's numbers must be made
to agree with `offering.price × quantity` or the demo data will look inconsistent to
anyone reading the file.

---

### B8 — All three apps read a booking's time from the schedule, not the booking  ✅ DONE (2026-08-03)
**File:** `vendor/services/bookings.service.ts:16,31,54` · `booker/services/bookings.service.ts:55,66,77` · `ezzy-vendor-mobile/src/services/bookings.service.ts:33,44,70`

Every client resolves a booking's time the same way — join the schedule, take its
start:

```ts
schedules: { start_time: string } | null      // the row type
schedules(start_time)                          // the select
startTime: row.schedules?.start_time ?? ""     // the mapper
```

That is correct **only while a schedule has exactly one bookable time**, which is the
assumption this entire plan removes. After M3 the authoritative value is the booking's
own pinned `start_time`/`end_time`. Leaving the join in place produces two failures:

1. **Every booking of a schedule displays the same time**, whichever slot was actually
   booked. A vendor looking at eight bookings across a 09:00–17:00 window sees "09:00"
   eight times. This is a *wrong-information* bug on a confirmed booking, not a
   cosmetic one — and it defeats the entire purpose of introducing slots.
2. **Date-granular schedules have NULL `start_time`**, so `?? ""` renders a blank time
   in all three apps.

**Fix approach:** Select `start_time, end_time, end_date, quantity` from `bookings`
itself and drop `start_time` from the `schedules(...)` join in all three services.
The booking already carries the pinned truth (M3/M4) — this is deleting a join, not
adding one, so it is also a small read-path saving.

**Coupling — ships with Stage 3, not later.** The moment M3/M4 land, the join is
stale. All three apps must move in the same batch. `command` is **clear** — verified
no `schedules` or `offerings` reads in any of its services.

**Why this was missed first time round:** the original I5 reasoned from `portals.md`
("mobile does not edit offerings or schedules") and concluded the exposure was display
only. That was true about *editing* and irrelevant to *reading*. A documented scope
boundary is not a substitute for grepping the read path.

**✅ Executed 2026-08-03 (Stage 3).** All three services now select
`start_time, end_time, end_date, quantity` from `bookings` and the
`schedules(start_time)` join is gone from every one of them. `tsc` 0 in all three
(including `ezzy-vendor-mobile`, which has its own toolchain).

---

### B9 — Trigger timing: the two triggers on `bookings` need *different* timings  ✅ DONE (2026-08-03)
**File:** `20260507000004_bookings.sql:95-98` (`bookings_check_consistency` — `before insert or update`) · `20260516000002_booking_capacity_trigger.sql:41-44` (`bookings_check_capacity` — `before insert`)

M4 and M5 never state their trigger timing. The two existing triggers they extend and
replace sit next to each other on the same table with **deliberately different**
timings, and copying one onto the other is the likely mistake:

| Trigger | Timing | Why |
|---|---|---|
| `bookings_check_consistency` (M4 extends) | `BEFORE INSERT OR UPDATE` | It must **pin** `price_paid`/`quantity`/`end_time`/`end_date` on UPDATE — that is the whole point of pinning |
| `bookings_check_capacity` (M5 replaces) | **`BEFORE INSERT` only** | Verified in the migration body |

**The failure if M5 is written `INSERT OR UPDATE`:** every status change re-validates
the booking against the schedule *as it is now*. A vendor who later narrows a window,
changes days-of-week, or shortens availability makes every existing booking on that
schedule **un-updatable** — it can no longer be confirmed, completed, cancelled, or
even `disputed`, and `auto_acknowledge_bookings()` starts raising on its hourly run.
Nothing in the UI would explain why; the booking simply refuses every action.

This is not hypothetical: `update public.bookings set status` is issued by
`acknowledge_booking()`, `raise_booking_dispute()`, `resolve_booking_dispute()`,
`admin_override_booking_status()`, `auto_acknowledge_bookings()`, the PayMongo
webhook, and both vendor clients. All seven pass through whatever timing M5 declares.

**Fix approach:** State it explicitly in both migrations —

```sql
create trigger bookings_check_capacity      before insert on public.bookings ...
create trigger bookings_check_slot_legality before insert on public.bookings ...
-- consistency stays: before insert or update  (pinning needs UPDATE)
```

A booking's span is pinned at insert (M4), so re-checking legality on UPDATE could
only ever punish a booking for a schedule edit it did not make. **Bookings already
sold are honoured against the schedule as it was, which is also the correct product
behaviour** — see I12 for the vendor-facing half.

**Verification:** narrow a schedule's window, then confirm and complete an existing
booking that no longer fits. Both must succeed. **Live** (DB) — a type-check cannot
see trigger timing, and daytime happy-path testing will never hit it.

**✅ Executed 2026-08-03 (Stage 3).** Timings as specified: `bookings_check_consistency`
stays `BEFORE INSERT OR UPDATE` (pinning needs UPDATE); the placement/capacity trigger
is `BEFORE INSERT` only.

⚠️ **A second ordering hazard this item did not anticipate, found during execution.**
Postgres fires BEFORE ROW triggers in **alphabetical order of trigger name**, and the
existing capacity trigger was called `bookings_check_capacity` — which sorts *before*
`bookings_check_consistency`. Since the consistency trigger is what computes
`end_time`/`end_date`, keeping that name would have run every capacity and slot check
against a **NULL span**. The replacement is therefore named
**`bookings_check_placement`** ("pl" > "co"), and the old trigger and function are
dropped. The dependency is now documented in the migration header, because a future
rename would silently reintroduce it.

**Verified live:** narrowed a schedule's window to 12:00 *and* changed its weekday,
leaving an existing 09:00 Monday booking doubly illegal — `pending → confirmed` and a
`notes` edit both still succeeded. Confirmed order in `pg_trigger`:
`bookings_check_consistency` then `bookings_check_placement`.

---

## 4. IMPORTANT

### I1 — Vendor schedule form shows hourly UI for date-based offerings  ✅ DONE (2026-08-04)
**File:** `vendor/components/schedule/ScheduleFormModal/ScheduleFormModal.tsx:143-158` (Start/End Time), `:162-176` (Days of Week)

The user's stated intuition. Once granularity exists the form must switch modes.

**Fix approach:** Branch on `sfOffering.durationUnit`. Time-granular → today's
window + repeat + days. Date-granular → a start/end **date range**, no time inputs,
no repeat, no days. Selecting the offering drives everything.

**Component separation:** the branch is a `granularity` value computed in
`useScheduleForm.ts` and consumed as a prop-like flag; `ScheduleFormModal.tsx`
renders one of two field groups. Extract each group into its own component
(`TimeWindowFields` / `DateRangeFields`) — both are pure display given props, so
neither needs a hook. Neither carries inline `style={{}}`; existing Tailwind
utilities and `sp-*` tokens cover it.

**Explicitly required, not just implied by "branch":**

| Offering is… | Fields shown | Fields **hidden and cleared** |
|---|---|---|
| time-granular (`minute`/`hour`) | Start date · Start time · End time · Repeat · Days of week · Capacity | `end_date` |
| date-granular (`day`/`week`/`month`) | Available-from date · Available-until date · Capacity | `start_time`, `end_time`, `recurrence`, `days_of_week` |

"Hidden" is not sufficient on its own — the hidden fields must be **cleared in state**,
not merely unrendered, or a mode switch submits stale values that M5's trigger then
rejects with a message about a field the vendor cannot see. See I7.

**✅ Executed 2026-08-04 (Stage 4a).** `useScheduleForm` derives `dateGranular` from
the offering's `durationUnit` (never asked), and `ScheduleFormModal` renders one of
two field groups. New: `lib/slots.ts` (the derived-unit arithmetic, mirroring
`check_booking_placement()`), `components/schedule/SlotPreview/` (pure display, no
hook — everything it shows is computed in the form hook), plus `endDate` threaded
through `ScheduleInput` and both service writes with `"" → NULL`.

The hook also now takes `offerings` so an **edit** resolves its offering and opens in
the right mode — without that, editing a saved date-based schedule opened in hourly
mode, which the `scheduleformdate` fixture and its test now guard.

**Verified:** 6 Playwright tests — hourly controls present for `RENT`, entirely absent
for `CAR`, edit-opens-in-day-mode, slot preview with remainder text, sub-unit window
refused with a reason, and I7's round-trip (hourly → date → hourly leaves the time
fields **empty**, proving the state was cleared rather than hidden).

---

### I7 — Switching the offering mid-form leaves stale state from the other mode  ✅ DONE (2026-08-04)
**File:** `vendor/components/schedule/ScheduleFormModal/useScheduleForm.ts:29-35`

`selectOffering()` currently resets **only** `sfInst` (staff). A vendor who picks
`COURT` (hourly), types `09:00`–`17:00`, then switches to `CAR` (daily) still carries
`sfTime`/`sfEnd`/`sfRep`/`sfDays` in state. The form hides those inputs (I1) but
`handleSave` at `ScheduleFormModal.tsx:52-62` still sends them, so a date-granular
schedule is written with a stale time window — precisely the "two sources of truth"
class of bug this whole plan exists to remove.

The mirror case is worse: switching *daily → hourly* leaves `sfEnd` empty, and B5's
new required-End-Time guard then blocks save with no visible cause, because the field
was blank the whole time in a mode that never showed it.

**Fix approach:** In `selectOffering`, when the new offering's granularity differs
from the previous one, clear the fields that belong to the abandoned mode. Keep
`sfDate` (a start date is meaningful in both). This is hook-layer state logic — it
belongs in `useScheduleForm.ts`, not in the component.

**Verification:** pick hourly → fill times → switch to daily → save; assert the row
has NULL `start_time`/`end_time` and empty `days_of_week`. **Live** (browser + DB) —
no type check can see this.

---

### I8 — Changing an offering's duration unit orphans its existing schedules  ✅ DONE (2026-08-04)
**File:** `vendor/components/offerings/OfferingFormModal/useOfferingForm.ts:46-60` (`handleSave`)

The reverse direction of I7, and it has no UI at all today. An offering edited from
`hour` → `day` flips granularity, and **every schedule already attached to it becomes
structurally invalid**: its `start_time`/`end_time` now describe a window nothing
reads, it has no `end_date`, and it derives zero slots. The schedules stay `is_active`
and simply stop producing bookable slots — a silent outage the vendor discovers when
bookings stop arriving.

§9 covers the *bookings* side of a duration change (they pin their own span, so they
are safe). It does **not** cover the schedules side. That was a genuine hole.

**Fix approach:** On save, if `duration_unit`'s granularity changed and the offering
has any schedule, block with a clear explanation naming the count — *"3 schedules use
this offering's hourly setup. Change them to date ranges first, or create a new
offering."* Blocking is right rather than cascading: silently rewriting a vendor's
schedules is worse than refusing, and there is no correct automatic translation from
"09:00–17:00 weekly" to a date range.

A *within*-granularity change (1 hour → 2 hours) stays allowed — it only changes the
slot count, which the preview (I2) shows immediately.

**Verification:** **live** — create offering + schedule, attempt the unit flip, assert
refusal and the count in the message.

**✅ Executed 2026-08-04 (Stage 4a).** In `useOfferingsPage.ts`'s `handleSave`, gated on
`isDateGranular(before) !== isDateGranular(after)` and backed by
`countSchedulesForOffering()`. Blocks with the count and names the fix. A change
*within* a granularity (1 hour → 2 hours) stays allowed, since it only moves the slot
count — which I2's preview now shows immediately.

---

### I12 — Narrowing a schedule window silently orphans bookings already sold  ✅ DONE (2026-08-04)
**File:** `vendor/components/schedule/ScheduleFormModal/ScheduleFormModal.tsx:50-63` (`handleSave`), `vendor/services/schedules.service.ts:92-111` (`updateSchedule`)

The schedule-side mirror of I8, and the gap B9 exposes. A vendor editing a window from
09:00–17:00 down to 12:00–17:00 — or dropping Monday from `days_of_week`, or pulling
`end_date` earlier — invalidates every booking already sold outside the new bounds.

B9 settles the *data* question correctly: triggers are INSERT-only, so those bookings
survive, stay honoured, and remain actionable. What is missing is the *vendor* half —
nothing tells them they just did it. They find out when a booker arrives at 09:00 for
a slot the schedule no longer advertises.

**Fix approach:** On save, if the edit narrows the window, removes a day, or pulls
`end_date` in, count future non-cancelled bookings that fall outside the new bounds
and confirm before writing: *"2 bookings on Mon 11 Aug at 09:00 fall outside the new
hours. They stay valid and you must still honour them. Continue?"*

**Warn, do not block** — deliberately the opposite of I8. I8 blocks because a
granularity flip leaves schedules structurally meaningless with no correct automatic
translation. Here the schedule stays perfectly valid; the vendor is making a legitimate
business change and only needs to know what it costs them. Blocking would stop them
ever shortening their hours.

**Component separation:** the count and the narrowing comparison live in
`useScheduleForm.ts`; the confirm dialog is the existing modal pattern. No new state
in the `.tsx`.

**✅ Executed 2026-08-04 (Stage 4a).** Landed in `useSchedulePage.ts`'s `handleSave`
rather than the form hook — that is where the edit is committed and where the
schedule id is known. `countBookingsOutsideWindow()` (new, in
`services/schedules.service.ts`) counts future non-cancelled bookings falling outside
the proposed hours or weekdays; a non-zero count prompts before saving. **Warns, does
not block** — the deliberate opposite of I8.

**Verification:** **live** — sell a 09:00 booking, narrow the window to 12:00, assert
the warning names it and that the booking is still confirmable afterwards (which is
B9's check from the other side).

---

### I2 — No live slot preview, so the vendor cannot see what they built  ✅ DONE (2026-08-04)
**File:** new component under `vendor/components/schedule/`

The "mindless configuration" requirement. Typing 09:00–17:00 against a 1-hour
offering should immediately show *"8 slots — 09:00, 10:00, … 16:00"*, and a
remainder should be visible, not silent.

**Fix approach:** `SlotPreview/` with `SlotPreview.tsx` (pure render) +
`useSlotPreview.ts` (computes the boundary list and the remainder from window +
duration). The same pure function backs the DB trigger's arithmetic and the booker's
slot list — extract it to `vendor/lib/slots.ts` and mirror it in `booker/lib/slots.ts`
(copied, not imported — cross-app import is forbidden by `AGENTS.md`).

---

### I3 — Recurrence validity is app-layer only  ✅ DONE (2026-08-03)
**File:** `20260507000004_bookings.sql:32` comment — "Must be a valid occurrence of the schedule's recurrence rule (**enforced at app layer**)"; the only implementation is `booker/services/schedules.service.ts:63-93`

A crafted insert can book a date the schedule never runs on. Pre-existing, and B3's
slot-legality trigger is the natural place to close it.

**Fix approach:** Fold occurrence validation into the same trigger as slot legality
— it already needs the schedule row. Port `isOccurrence()` to plpgsql.

**✅ Executed 2026-08-03 (Stage 3)** inside `check_booking_placement()`. Handles
`none` (must equal `start_date`), weekday membership, `biweekly` parity and `monthly`
week-of-month. **Verified live:** a Tuesday insert against a Mon/Wed/Fri schedule is
refused with *"This schedule does not run on that day of the week"*.

**Consequence for `seed.sql`, which the plan had not foreseen:** the seed's booking
loops stepped back by a flat 3 or 5 days per iteration, landing on arbitrary weekdays
that the database now rejects. They also drew from *all* of a vendor's schedules —
including a `none` one (accepts exactly its own `start_date`) and a `biweekly` one
(every other week), neither of which can absorb a loop of arbitrary dates. Both loops
now filter to `recurrence = 'weekly'`, index modulo the array length, and pick from a
generated list of that schedule's real occurrence dates.

**Risk noted:** this is the one item that duplicates non-trivial logic across TS and
SQL. Accepted because the DB is the only place a forged insert can be stopped, and
the rule is stable (it has not changed since `20260507000002`). Both copies get the
same test dates.

---

### I4 — Booker never sees duration, end time, or remaining spaces  ✅ DONE (2026-08-04)
**File:** `booker/components/booking/steps/Step3Schedule/Step3Schedule.tsx:105` (renders `{t}` only); `booker/lib/types.ts:106,109`

`endTime` and `maxCapacity` are fetched and discarded. A booker picks "2:00 PM" with
no idea whether that is one hour or three, or how many spaces are left.

**Fix approach:** Render each slot as start–end, and a per-slot remaining count from
a booking-count query. Add the **quantity control** D7 requires, with the greying rule
spelled out in §6.4: a start slot is selectable only if *every* slot the quantity would
cover has room — checking only the first slot is the likely wrong implementation. Step
5/6 show the quantity and the computed `price × quantity` total.

**Shared arithmetic:** the "does this span fit" predicate must be the same function
that backs I2's preview and mirror M5's trigger. Three implementations of one rule is
how they drift; extract it once per app (§4 I2) and test all of them against the same
fixture cases, including §7 M5's counterexample.

**Component separation — `Step3Schedule` currently violates it and this work makes
that unavoidable.** `booker/components/booking/steps/Step3Schedule/` contains a bare
`Step3Schedule.tsx` with **no companion hook** — it works today only because the step
is stateless, driven entirely by props from `useBookingWizard`. D7's quantity control
and I9's two-mode branch both introduce local state and derived values, which the
component-separation skill requires to live in a hook.

Required shape (matching `Step4Documents/`, the one step that already does this):

```
Step3Schedule/
  Step3Schedule.tsx      pure render — no useState, no arithmetic in JSX
  useStep3Schedule.ts    quantity state, granularity branch, slot list,
                         per-slot remaining, the "does this span fit" predicate
```

Do **not** push this state up into `useBookingWizard.ts` instead — it is already the
largest hook in the app and owns cross-step state; slot mechanics are local to step 3.
The two mode-specific field groups (`SlotGrid` / `DateRangePicker`) are pure display
given props and need no hooks of their own, mirroring I1's split on the vendor side.

**Coupling:** the remaining-count query is new load on `bookings`; it needs the
`(schedule_id, booked_date)` index that already exists (`bookings_schedule_id_idx`
covers the leading column; add a composite if the query plan warrants it — measure,
do not pre-optimise).

**✅ Executed 2026-08-04 (Stage 4b).** New `useStep3Schedule.ts` — the companion hook
this step never had (G4). Slots render as **start–end with a per-slot "N left"**, and a
quantity control appears once more than one unit fits.

**The greying rule is the part most likely to be got wrong**, so it is centralised:
`spanAvailable()` walks **every** slot the chosen quantity would cover and requires
room in all of them, mirroring the trigger's worst-case-slot rule. Checking only the
start slot would offer spans the database then refuses at the final step.

Occupancy is fetched asynchronously; until it lands every slot reads as available.
That is the safe direction — the DB refuses an overbooking regardless, whereas greying
out a free slot on a slow network would block a legitimate booking.

Steps 5 and 6 and the Pay button now show **price × quantity**, matching what M4
computes. `handleSelectTime` resets quantity to 1, so a value chosen for a previous
slot cannot ride along into one it does not fit.

---

### I6 — Vendor schedule display assumes a time and "Max N clients"  ✅ DONE (2026-08-03)
**File:** `vendor/components/schedule/DayDetailPanel/DayDetailPanel.tsx:56` (`{s.time}{s.end ? ...}`), `:59` (`👥 Max {s.max} clients`), `:93` (`{s.time} · {s.repeat}`)

Surfaced by B6's nullable types. A date-granular schedule renders `null · one-time`
and "Max 1 clients" — the second being the same overloaded-capacity wording B2
removes, still present in a second place.

**Fix approach:** Branch the rendering: time-granular shows `09:00 – 17:00 · weekly`,
date-granular shows `01 Aug – 31 Dec`. Replace the capacity line with the granularity-
appropriate wording from B2. `DayDetailPanel` is a pure display component (no state,
no effects) and stays one — the branch is on props it already receives.

**Also check at execution time:** `ScheduleCalendar.tsx` and `SchedulePage.tsx` showed
no direct `.time`/`.max` access in the grep, but `vendor/lib/utils.ts:96`
(`getSchedsForDay`) filters by day-of-week — date-granular schedules have an empty
`days_of_week`, so they will **never** appear on the calendar. Confirm and fix in the
same pass.

---

### I9 — Booker Step 3 has no availability algorithm for date-granular offerings  ✅ DONE (2026-08-04)
**File:** `booker/services/schedules.service.ts:63-93` (`isOccurrence`), `:95-110` (`getAvailableDaysInMonth`), `:112-117` (`getTimesForDate`), `:119-127` (`resolveScheduleForTime`)

Every one of these functions is built on recurrence + time-of-day. §6.4 said
date-granular offerings "get a range picker and a quantity" — that sentence hid a
whole second algorithm, and left as written it would permit a wrong implementation
that satisfies the plan. Closing that here.

For a date-granular schedule, a date is available when **all** hold:
1. `date >= schedules.start_date` and (`end_date is null` or `date <= end_date`);
2. `recurrence`/`days_of_week` are ignored entirely — they are NULL/empty by I1;
3. the date is not already at `capacity_per_slot` across **overlapping** bookings —
   note this is a *range* overlap, not an equality test, since an existing 3-day
   booking consumes capacity on all three of its dates.

Point 3 is the one a naive implementation gets wrong: `booked_date = X` misses a
booking that *spans* X. The query must be `booked_date <= X and end_date >= X`.

**Fix approach:** Add `getAvailableDateRange()` + `getRemainingForDate()` alongside
the existing time-based functions rather than overloading them — the two modes share
no logic, and a single function with a granularity flag would be harder to read than
two honest ones. Step 3 picks the pair by granularity.

**✅ Executed 2026-08-04 (Stage 4b).** `isOccurrence()` now short-circuits for
date-granular schedules — recurrence and days-of-week do not apply to them, their
availability **is** the date range — and honours `endDate` for both modes, which it
previously ignored entirely. `getSlotsForDate()` skips them, so a date-based offering
yields no time buttons at all (asserted). `getDateRange()` exposes the bookable span.

Point 3 of this item (overlap, not equality) is enforced by `getSlotOccupancy()` +
`remainingForSlot()`, which count by span overlap — an existing multi-unit booking
consumes every slot it covers, not only its start.

**Coupling:** the capacity numbers this renders must agree with M5's trigger. Same
overlap semantics, stated once here and once in SQL — assert both against the same
fixture dates.

---

### I10 — Step 3 must use the *booked vendor's* duration, not the deduped card's  ✅ DONE (2026-08-04)
**File:** `booker/components/booking/BookingWizard/useBookingWizard.ts:12-25` (`dedupeByCode`), `booker/services/schedules.service.ts:29-44` (`getSchedulesForVendor`)

D8 splits Step 1 cards by granularity, so the *form mode* is now always right. It does
not make the *duration value* right: two vendors can both offer `COURT` at hourly
granularity with **1-hour and 2-hour** units. `dedupeByCode` keeps whichever is
cheaper, and Step 3 derives its slot grid by dividing the window by that duration.

Consequence: the booker is shown slots at the wrong boundaries, taps one, and M5's
slot-legality trigger rejects the insert. A wrong grid is not cosmetic — it makes the
booking unfinishable, and the error arrives at the last step.

**Fix approach:** Return `duration_minutes` and `duration_unit` **per schedule** from
`getSchedulesForVendor()` — it already `!inner` joins `offerings` to filter on code
(`:37`), so this is two more columns in an existing select, no extra round trip. Step 3
derives slots from the schedule's own duration. The deduped Step 1 offering keeps its
browse-only role.

**Note — accepted, not fixed (D8):** the *price* shown in steps 3–6 still comes from
the deduped card and can belong to another vendor. That is pre-existing, was called out
in D8's options, and the user accepted it. Recorded in §13.

**✅ Executed 2026-08-04 (Stage 4b).** `getSchedulesForVendor()` now selects
`duration_minutes, duration_unit` through the `!inner` join it already had — two extra
columns, no extra round trip — and `BookerSchedule` carries them per schedule. Step 3
derives its grid from **the schedule's own** duration, so two vendors sharing a code
with different durations can no longer produce a grid the trigger rejects.

D8's card split also landed: `dedupeByCode` keys on `(code, granularity)`, so an hourly
and a day-based `COURT` are separate browse cards and the wizard can never open in the
wrong mode. `multiPriceCodes` stays keyed by code alone — the "from ₱X" prefix is a
per-code question about price spread.

---

### I11 — `ui-gallery` fixtures in both apps break at build time  ✅ DONE (2026-08-03)
**File:** `booker/app/ui-gallery/page.tsx:64,72` (`duration: "1 hour"`), `:81-83` (`maxCapacity`); `vendor/app/ui-gallery/page.tsx:62-63` (`duration`), `:67-68` (`max:`)

Typed against `Offering` / `Schedule` / `BookerSchedule`, so B1's and B6's type changes
break `tsc` and the visual-baseline page. Folded into B7's staging so the build never
sits broken between stages.

**Fix approach:** Update fixtures in lockstep with the type change, and **add a
date-granular fixture to each** — otherwise the new form mode and the new Step 3
branch have no visual baseline at all.

---

### I13 — `ScheduleFormModal` cannot be driven by any test  ✅ DONE (2026-08-03)
**File:** `vendor/app/ui-gallery/page.tsx:121-126` (schedule mode renders only `ScheduleCalendar` + `DayDetailPanel`) · `vendor/visual-tests/pilot.spec.ts:19,28,38`

**Found during Stage 0 (2026-08-03).** B5's verification calls for a browser check, and
there is no way to perform one:

- The visual suite **never authenticates** — every test is `page.goto("/ui-gallery?...")`.
  The `"login"` mode renders the *login component* as a fixture; it does not log in.
- `ScheduleFormModal` is **absent from `/ui-gallery`**. Schedule mode mounts the
  calendar and the day panel only.

So the form that owns schedule creation — the centre of this entire plan, and the thing
Stages 4a's I1/I2/I7/I8/I12 all rewrite — has **no automated coverage of any kind**, and
no cheap manual path either short of standing up auth against local Supabase.

This blocks honest verification of B5 now and of four Stage 4a items later.

**Fix approach:** Add a `schedulform` mode to `vendor/app/ui-gallery/page.tsx` mounting
`ScheduleFormModal` with the existing `OFFERINGS`/`STAFF` fixtures, plus one date-granular
offering once B1 lands. Then B5's check is a Playwright assertion on the blocker text, and
Stage 4a gets a baseline for the two-mode form.

**Moved to Stage 1 (2026-08-03, user's call).** Originally filed "before Stage 4a"; it
belongs at the front instead. It is the only thing that can close B5's outstanding
browser check, it needs **no migration**, and Stage 4a rewrites this modal five ways
(I1/I2/I7/I8/I12) — building all of that blind and hand-checking at the end is how I7's
mode-switch bug ships twice.

**Coupling:** overlaps **I11** (which already updates gallery fixtures for the type
changes). The base fixture lands now; the date-granular offering fixture is added when
B1's columns exist, in the same file.

**✅ Executed 2026-08-03 (Stage 1).** `app/ui-gallery/page.tsx` gains a `scheduleform`
mode mounting `ScheduleFormModal` with the existing `OFFERINGS`/`STAFF` fixtures and
`editSched={null}` (the create path, i.e. the empty-state validation B5 guards).
`visual-tests/pilot.spec.ts` gains a **behavioural** `describe` block, not a screenshot
case — a pixel baseline would pass just as happily on a silently disabled button, and
what B5 is actually about is the vendor being *told why*.

**Still to add when B1 lands:** a date-granular offering fixture, for Stage 4a's I1/I7
two-mode form. Noted on I11.

---

### I15 — Playwright harness pointed at `127.0.0.1`, so React never hydrated  ✅ DONE in `vendor` + `booker` (2026-08-04) · ⬜ TODO in `command`

⚠️ **The `command` half was independently rediscovered on 2026-08-11** while
verifying the cross-app pagination work, and cost time before anyone realised it
was already documented here. `command/playwright.config.ts:18` still has
`baseURL: "http://127.0.0.1:3100"`; the page loads but renders nothing and the HMR
websocket fails. `http://localhost:3100` works. Recorded there as **F15** of
`.plans/2026-08-11-crossapp-unbounded-query-truncation.md`. It was worked around
per-test rather than fixed, so **this item is still genuinely open** — and now has
a second witness.
**File:** `vendor/playwright.config.ts:19,26` (fixed) · `booker/playwright.config.ts:18,25` · `command/playwright.config.ts:18,25` (both still affected)

**Found during Stage 1 (2026-08-03), pre-existing.** The first run of I13's tests failed
on all four cases. The cause was not the tests: **the page rendered but React never
hydrated**, so no `onClick` fired anywhere. Probed directly — after clicking the offering
button, its style was unchanged, the Category chip never appeared, the title never
auto-filled, and `saveBlocker` stayed on its first message.

The console showed Next refusing its own dev resources:

```
⚠ Blocked cross-origin request to Next.js dev resource /_next/webpack-hmr from "127.0.0.1"
WebSocket connection to 'ws://127.0.0.1:3100/_next/webpack-hmr' failed
```

This is a **known property of this WSL2 machine**, already documented in
`architecture/email-notifications-guide.md` and `email-local-run-quickstart.md`: over
`127.0.0.1` a Next dev server renders fine but client-side effects silently fail; over
`localhost` it works. The Playwright config used `127.0.0.1`.

**Why it went unnoticed:** the suite is almost entirely *screenshot* tests, which do not
need hydration. Only two existing tests interact (`calendar-day` clicks a day,
`login-mobile-info` clicks a toggle) — **both have been silently exercising dead HTML**,
and their baselines were recorded in that state. Baseline PNGs are gitignored in all
three apps, so nothing ever surfaced a diff.

**Fix applied (vendor only):** `baseURL` and `webServer.url` → `http://localhost:3100`.
Re-probed: the click now flips the button style, renders the Category chip, fills the
title, and advances the blocker. All four B5 tests then passed.

**✅ `booker` fixed 2026-08-04 (Stage 4b)** — same one-line change; its Step 3 tests
could not have run otherwise. **⬜ `command` still carries the defect**
(`playwright.config.ts:18,25`, `127.0.0.1:3100`). Left alone deliberately: this plan
never touches `command`, and any interactive baseline recorded there before the fix is
worthless. Worth folding into whatever next touches that app.

---

### I14 — `npm run lint` is broken repo-wide in `vendor`  ✅ DONE (2026-08-11)
**File:** `vendor/eslint.config.mjs` (via `@eslint/eslintrc` config-array-factory)

**Found during Stage 0 (2026-08-03), pre-existing — not caused by this plan.** Both
`npm run lint` and `npx eslint <any file>` abort while *loading* config, before reading
a single source file:

```
Converting circular structure to JSON
  property 'flat' -> object with constructor 'Object'
  property 'plugins' -> object with constructor 'Object'
  --- property 'react' closes the circle
```

Confirmed structural rather than code-related: `npx eslint lib/utils.ts` — a file this
plan never touches — fails identically.

**Consequence for this plan:** lint was **not available as a verification tool** for any
stage. `tsc --noEmit` and `npm run build` both work and are what every ✅ here rests on;
no item should claim a lint check until this is fixed.

✅ **FIXED 2026-08-11** — root cause was exactly as diagnosed here (structural, in
config loading). `eslint-config-next` 16 ships **flat** config, but
`eslint.config.mjs` wrapped it in `FlatCompat`, the eslintrc→flat bridge. That
validated a flat array against the legacy schema and failed; ESLint then crashed
*formatting* the error via `JSON.stringify(error.data)`, which contains
eslint-plugin-react's circular rule graph — hence the misleading
"Converting circular structure to JSON" with a stack that never named a config file.
Fixed by importing the flat configs directly. `booker` was fixed the same way;
`command` needed the **opposite** treatment (it is on eslint-config-next **15**,
which is eslintrc-style, so FlatCompat is correct there) and only lacked an
`ignores` block. All three now run: vendor 36, booker 24, command 27 pre-existing
problems. **Lint is available as a verification tool again.**

**Fix approach:** Out of scope for this plan — it is a toolchain defect, not a duration
one. Recorded so no later stage claims a lint pass it cannot have run. Worth its own
small task.

---

### I5 — `ezzy-vendor-mobile` booking display  ✅ DONE (2026-08-04, Android-verifiable checks only)
**File:** `ezzy-vendor-mobile/src/` — booking list and detail

**Rescoped 2026-08-03 (gap review).** This item originally claimed mobile's exposure
was "display only… small". That was wrong in kind, not just in size: mobile reads a
booking's time from a **schedule join**, which is the same defect as the two web apps.
That half is now **B8**, a blocker, and ships with Stage 3.

What remains here is genuinely mobile-only and cosmetic: once B8 supplies the real
columns, render the *span* (`09:00–11:00`, or `10–12 Aug`) rather than a bare start,
and make sure a multi-day booking reads sensibly in the list row's cramped layout.

**✅ Executed 2026-08-04 (Stage 5).** `lib/types.ts` gains `endTime`/`endDate`/
`quantity`; the service mapper fills them (B8 had already added them to the select);
`lib/format.ts` gains `fmtBookingSpan()` + `bookingDayCount()`, and both
`BookingListItem` and `BookingDetail` render the span. The detail label switches
between "Date & time" and "Dates" by shape, and appends "(N days)" for a multi-day
booking.

`fmtBookingSpan` deliberately falls back to the bare date when a booking carries no
span — that is what a pre-migration row looks like, and a phone cannot be recompiled
by a migration. Same reasoning as the `?? UNKNOWN_TYPE` rule in this app's AGENTS.md.

**Verified (machine only):** `tsc` 0, `expo lint` 0, `npm test` **95/95** (4 new
covering both shapes and the legacy fallback), `expo export --platform android` 0.

⚠️ **NOT verified on a device, and not on iOS at all.** This app's own AGENTS.md is
explicit that no machine check in the repo can see a style silently overridden by a
library default, and that visual work needs a screenshot before it is called fixed.
This change is text-content rather than layout, which lowers but does not remove that
risk. **iOS has never been built** — the project holds no Apple Developer membership.

**Note:** `ezzy-vendor-mobile` has **uncommitted work in progress** from
`.plans/2026-08-03-vendor-mobile-action-ui-and-guide.md` (four items coded, pending a
device screenshot). Do not start I5 until that plan's changes are committed, or the
two will tangle in the same files.

---

## 5. DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->

- **D1 — Multi-day spans?** → **Yes, full spans** (resolved 2026-08-03) — one booking
  may occupy a date range. `bookings` gains `end_date` + `quantity`; capacity becomes
  an overlap check. Rationale: EzzyStay and EzzyDrive are unmodellable without it,
  and the overlap logic is written once either way.
- **D2 — Derived or materialised slots?** → **Derived, no new table** (resolved
  2026-08-03) — slot boundaries are arithmetic. Avoids a `pg_cron` generator, a
  rolling horizon, and regeneration-vs-existing-bookings reconciliation on every
  schedule edit; preserves the documented derived-recurrence design.
- **D3 — Price per unit or per booking?** → **Per unit × quantity** (resolved
  2026-08-03) — `price_paid` becomes trigger-computed, which also closes B4.
- **D4 — Live vendor data?** → **Pre-launch, dev/test only** (resolved 2026-08-03) —
  migration may parse-backfill and `DROP COLUMN duration` in one batch, no
  compatibility window. Cross-checked against
  `.plans/2026-08-02-web-apps-production-launch-readiness.md`, which is still DRAFT
  and pinned.
- **D6 — `CHECK` instead of a lookup table for `duration_unit`?** →
  **`CHECK`** (resolved 2026-08-03, recorded rather than asked) — diverges from the
  `fulfilment_patterns` / `divisions` idiom. That idiom exists so a *third* value can
  be added without an ALTER; granularity is exhaustive by construction. Recorded here
  because §7 of the plan-authoring skill treats divergence from an established
  pattern as a decision, not a silent choice. **Reversible** — promoting it to a
  lookup later is additive.

- **D5 — how is a `month` duration defined?** → **`month` = exactly 30 days
  (43,200 minutes)** (resolved 2026-08-03) — months are not a fixed number of minutes
  (28–31 days), so `duration_minutes` cannot represent a calendar month honestly.
  Fixing it at 30 days keeps all slot and overlap arithmetic exact and matches how
  Postgres itself converts `interval → epoch`. Rejected: dropping `month` (loses a
  unit that was explicitly wanted), and storing `interval` (handles calendar months
  natively but `'1 mon'` and `'30 days'` compare unequal, which would infect every
  overlap query in B3).
  - **Consequence to surface in the UI, not bury:** the offering form must state
    *"1 month = 30 days"* next to the unit picker. A 1-month rental starting 31 Jan
    ends 1 Mar. This is defensible arithmetic but counter-intuitive, so it is
    labelled at the point of entry rather than discovered at the point of booking.
  - **Unblocks:** B1's `duration_unit` CHECK list, and therefore the plan.
- **D7 — May a time-granular booking span consecutive slots?** → **Yes, the booker
  picks a quantity** (resolved 2026-08-03) — `quantity > 1` applies to time-granular
  bookings, not only to multi-day spans. Consequences, all now written into the plan:
  M5's capacity check must be **per covered slot** rather than a single overlap count
  (§7 M5 — the naive version rejects legal bookings); Step 3 gains a quantity control
  and must grey out spans where *any* covered slot is full (I4); V11 restated in §8.
- **D8 — Mixed granularity behind one offering code across vendors?** → **Split the
  Step 1 cards by `(code, granularity)`** (resolved 2026-08-03) — an hourly `COURT` and
  a daily `COURT` appear as separate browse cards, so the wizard can never open the
  wrong form mode. Rejected: re-resolving the offering after vendor selection (larger
  change to the wizard's data flow than this plan should carry). **Knowingly accepted
  cost:** the price shown in steps 3–6 can still come from another vendor's offering —
  pre-existing, stated in the option, recorded in §14. Note this decision fixes the
  *mode* only; the *duration value* still needed fixing, which is **I10**.

---

## 6. Revised form design

### 6.1 Offering form

```
Duration *        [  1  ] [ hour  ▾ ]        ← replaces the free-text box
                  ↳ "One booking = 1 hour"    ← derived, live
                  ↳ units: minute · hour · day · week · month

Price *           ₱ [ 850 ]  per hour         ← unit label derived from duration
```

When `month` is selected the form states the D5 convention inline — at the point of
entry, not at the point of booking:

```
Duration *        [  1  ] [ month ▾ ]
                  ↳ "One booking = 1 month (30 days)"
                  ↳ ⓘ A month is counted as 30 days, so a booking
                     starting 31 Jan ends 1 Mar.
```

`fulfilment_pattern` stays exactly where it is — a separate picker, unchanged.

### 6.2 Schedule form — time-granular offering

```
Offering          [ COURT ] [ COACH ] [ FIT ]     ← drives everything below
                  ↳ "COURT — 1 hour per booking"

Repeating         [One-time] [Weekly] [Bi-weekly] [Monthly]
Start date        [ 2026-08-10 ]
Days of week      [M][T][W][T][F][S][S]           ← required when repeating (B5)

Available from    [ 09:00 ]  to  [ 17:00 ]        ← End Time now required (B5)
                  ┌──────────────────────────────────────┐
                  │ 8 slots · 09:00 10:00 11:00 12:00    │  ← I2, live
                  │           13:00 14:00 15:00 16:00    │
                  └──────────────────────────────────────┘

How many can book each slot?  [ 1 ]               ← was "Max Clients", default 20
```

With a remainder, the preview says so plainly:
`7 slots · 09:00 … 15:00 · last 30 min unused — end at 16:00 to use it`.

### 6.3 Schedule form — date-granular offering

No time inputs, no repeat, no days-of-week:

```
Offering          [ ROOM ] [ CAR ]
                  ↳ "CAR — 1 day per booking"

Available from    [ 2026-08-01 ]  to  [ 2026-12-31 ]
How many can book at once?    [ 1 ]
```

### 6.4 Booker, step 3

**Time-granular** — a slot grid plus a quantity (D7):

```
Fri 10 Aug        How many? [ 2 ▾ ]         ← 1 … max that still fits

  [ 09:00–10:00 · 1 left ]  [ 10:00–11:00 ]  [ 11:00–12:00 · Full ]
                                              ↑ greyed: quantity 2 from
                                                11:00 would cover a full slot
  ↳ selected 09:00–11:00 · 2 × ₱850 = ₱1,700
```

The greying rule is the one an implementation is most likely to get wrong: a start
slot is selectable only if **every** slot the chosen quantity would cover has room —
not merely the first one. Same rule as M5's trigger, and it must be the same
arithmetic (§9's shared pure function).

**Date-granular** — a range, no times:

```
From [ 10 Aug ]  to  [ 12 Aug ]     ← 3 days
  ↳ 3 days × ₱850 = ₱2,550
  ↳ unavailable dates disabled in the picker (I9)
```

---

## 7. Schema changes — ⚠️ APPROVAL GATE

> Per `AGENTS.md`: schema change **and** a change touching more than one app.
> **Nothing below is written until the user says go.** All decisions are closed —
> D5 fixed the `duration_unit` CHECK list below at five values, with `month` = 30 days.

**Migration files — five, in this order.** Repo convention is a
`YYYYMMDDHHMMSS_name.sql` timestamp prefix (`20260801000001` … `20260801000009` is the
most recent run). Ordering is not cosmetic: M3 depends on M2's rename, M4 and M5
depend on M3's columns.

| # | Filename | Stage |
|---|---|---|
| M1 | `20260803000001_offering_duration_units.sql` | 1 |
| M2 | `20260803000002_schedule_availability.sql` | 2 |
| M3 | `20260803000003_booking_units.sql` | 2 |
| M4 | `20260803000004_booking_derive_price_and_span.sql` | 3 |
| M5 | `20260803000005_booking_slot_and_capacity.sql` | 3 |

**RLS and grants — deliberately nothing to do, and here is why.** `AGENTS.md` makes
table-level `GRANT`s an invariant for *new tables*; this plan adds **no table**. Postgres
grants are table-level, not column-level, in this schema (`20260620000001_api_role_grants.sql`
grants whole-table DML), so columns added to `offerings`, `schedules` and `bookings`
inherit the existing grants automatically. No RLS policy references any column this plan
touches — every policy keys on `vendor_id`, `booker_id` or a helper function — so **no
policy needs rewriting**. Two consequences worth stating rather than assuming:

- The new booking columns are **writable by the booker** as far as grants and RLS are
  concerned. They are protected by the **trigger** (M4 computes and pins them), not by
  RLS. That is the same mechanism `fulfilment_pattern` already relies on, and it is
  why B4's verification is a live forgery attempt rather than a policy review.
- `bookings` is in the `supabase_realtime` publication (`20260718000001`). New columns
  flow into the payload automatically; both web apps' handlers patch `status` by name
  and ignore unknown fields, so no subscription changes are needed.

### M1 — `offerings`: structured duration

```sql
alter table public.offerings
  add column duration_minutes integer not null default 60
    check (duration_minutes > 0),
  add column duration_unit text not null default 'hour'
    check (duration_unit in ('minute','hour','day','week','month'));

comment on column public.offerings.duration_minutes is
  'Length of ONE bookable unit, normalised to minutes. The single source of truth for all slot and overlap arithmetic. Unit multipliers: minute=1, hour=60, day=1440, week=10080, month=43200 (D5 — a month is fixed at 30 days, because a calendar month has no honest minute count; the offering form states this at the point of entry).';

comment on column public.offerings.duration_unit is
  'The frame the vendor chose, e.g. 1440 minutes entered as ''day'' renders "1 day" while entered as ''hour'' renders "24 hours". Does double duty: it is also the granularity discriminator — minute|hour => the booker picks a time of day (time-granular); day|week|month => the booker picks whole dates (date-granular). Deliberately a CHECK and not a lookup table, unlike fulfilment_patterns — see D6 in the plan.';

-- Backfill from the free text. Pre-launch (D4), so a best-effort parse plus a
-- reported fallback is acceptable; nothing here is a real vendor's data.
--
-- ⚠️ ORDER IS LOAD-BEARING. 'month' contains an 'h', so an unanchored hour test
-- must come AFTER the month test or "1 month" backfills as 1 hour. Likewise
-- 'minute' must be tested before any bare 'm'. Tested longest-token-first.
update public.offerings set
  duration_unit = case
    when duration ~* 'mon'          then 'month'
    when duration ~* 'min'          then 'minute'
    when duration ~* 'w'            then 'week'
    when duration ~* 'd'            then 'day'
    when duration ~* 'h'            then 'hour'
    else 'hour' end
where true;

update public.offerings set
  duration_minutes = coalesce(
    nullif((regexp_match(duration, '(\d+)'))[1], '')::int, 1
  ) * case duration_unit
        when 'minute' then 1
        when 'hour'   then 60
        when 'day'    then 1440
        when 'week'   then 10080
        when 'month'  then 43200   -- D5: fixed 30 days
      end;

-- Report what could not be parsed, so defaulted rows are reviewed rather than
-- silently shipped. A migration that guesses must say where it guessed.
do $$
declare r record;
begin
  for r in
    select id, name, duration from public.offerings
    where duration !~ '\d'                              -- no number at all
       or duration !~* '(mon|min|w|d|h)'                -- no recognisable unit
  loop
    raise notice 'offerings.duration unparsed -> defaulted: id=% name=% raw=%',
      r.id, r.name, quote_literal(r.duration);
  end loop;
end $$;

alter table public.offerings drop column duration;
```

**Blast radius.** *Data:* rewrites every `offerings` row; the seed's
`'1 hour'`/`'2 hours'`/`'3 hours'` all parse; anything unparseable silently becomes
1 hour — **the migration must `RAISE NOTICE` the ids it defaulted** so they can be
reviewed. *Lock:* `ACCESS EXCLUSIVE` for the ALTERs, trivial at current size.
*Downstream:* `vendor/services/offerings.service.ts:10,25,36`,
`booker/services/offerings.service.ts`, both `lib/types.ts`, and the two render sites
— all must land in the same batch or the build breaks. *Reversibility:* re-add
`duration text` and rebuild it from the two new columns; no information is lost that
the vendor cannot re-enter.

### M2 — `schedules`: capacity rename + availability end date

```sql
alter table public.schedules
  rename column max_capacity to capacity_per_slot;

alter table public.schedules
  alter column capacity_per_slot set default 1,
  add column end_date date,                       -- availability bound; NULL = open-ended
  alter column start_time drop not null,          -- NULL for date-granular
  alter column end_time   drop not null;

alter table public.schedules
  drop constraint schedules_end_after_start,
  add constraint schedules_end_after_start
    check (start_time is null or end_time is null or end_time > start_time),
  add constraint schedules_end_date_after_start
    check (end_date is null or end_date >= start_date);
```

**Blast radius.** *Data:* no row rewrite (rename + default are metadata-only;
dropping NOT NULL is metadata-only). Existing rows keep their capacity value — the
new default of 1 applies only to future inserts, so **no existing schedule silently
tightens**. *Lock:* brief `ACCESS EXCLUSIVE`; the re-added CHECK scans the table.
*Downstream:* `max_capacity` is referenced in `vendor/services/schedules.service.ts:26,50,84,108`,
`booker/services/schedules.service.ts:12,25,37`, and the capacity trigger (M5) —
a rename breaks all of them at once, which is the point: nothing compiles until every
site is updated. *Reversibility:* rename back; the two new nullable columns drop cleanly.

### M3 — `bookings`: the unit

```sql
alter table public.bookings
  add column start_time time,                     -- NULL for date-granular
  add column end_time   time,
  add column end_date   date,                     -- NULL for time-granular
  add column quantity   integer not null default 1 check (quantity > 0);

-- A booker may now hold several slots on one date, so the old constraint is wrong.
alter table public.bookings drop constraint bookings_no_duplicate;
create unique index bookings_no_duplicate
  on public.bookings (booker_id, schedule_id, booked_date,
                      coalesce(start_time, '00:00:00'::time));

-- Backfill existing bookings from their schedule. Without this, any pre-migration
-- row keeps a NULL start_time and M5's overlap check SKIPS it — undercounting
-- occupancy, which shows up as overbooking rather than as an error.
-- D4 says the data is dev-only, but the migration must leave the database
-- self-consistent regardless of what rows happen to be present.
update public.bookings b
   set start_time = s.start_time,
       end_time   = s.end_time
  from public.schedules s
 where s.id = b.schedule_id
   and b.start_time is null
   and s.start_time is not null;
```

**Blast radius.** *Data:* new columns are NULL/defaulted on existing rows — the
backfill for those is "they are legacy single-slot bookings", which the coalesce in
the index handles. *Note the `coalesce`:* a plain 4-column unique would let
date-granular duplicates through, since NULLs compare distinct. *Lock:* the unique
index build takes `SHARE`; use `CREATE UNIQUE INDEX CONCURRENTLY` if `bookings` is
ever large — it is not today. *Downstream:* `error.code === "23505"` →
`"already_booked"` still works (a unique *index* raises the same SQLSTATE).
*Reversibility:* drop the four columns and restore the original constraint.

### M4 — derive `price_paid` and the booking span

Extends `check_booking_consistency()` rather than adding a trigger — it already runs
`BEFORE INSERT OR UPDATE` and already fetches the offering, following the precedent
its own body sets (`20260801000001:100`).

```sql
-- On INSERT, compute from the offering (clients supply none of these):
--   price_paid = offering.price * quantity            (D3, closes B4)
--   time-granular: end_time = start_time + (duration_minutes * quantity) * interval '1 min'
--   date-granular: end_date = booked_date + (duration_minutes/1440 * quantity) - 1
--
-- On UPDATE, PIN all four — price_paid, quantity, end_time, end_date — raising if
-- changed, exactly as fulfilment_pattern is pinned (20260801000001:110-116).
--   quantity must be pinned TOO, not just price_paid: an unpinned quantity drifts
--   away from the price computed from it, and price is the field that gets paid.
-- Full body written at execution time.
```

⚠️ **`time + interval` WRAPS SILENTLY — verified, not assumed.** Run against the
local instance on 2026-08-03:

```
select time '23:00' + interval '2 hours';   →  01:00:00
select time '09:00' + interval '2 hours';   →  11:00:00
```

So a late booking whose span crosses midnight yields `end_time < start_time` — an
**inverted range**, which makes M5's `[start_time, end_time)` overlap test match
nothing and the capacity check pass everything. The guard is ordering, not arithmetic:

> **M5's window-fit check (V9) must run and pass BEFORE M4 computes `end_time`.**
> Because `schedules_end_after_start` already forbids a window from crossing midnight,
> a booking that fits inside its window provably cannot wrap. The wrap is therefore
> impossible *by construction* — but only if the checks run in that order. A body that
> computes `end_time` first and validates after is silently wrong, and no test with
> daytime fixtures will catch it.

**Test it explicitly** with a 23:00 start (§12), not just the 09:00 cases.

**Blast radius.** *Data:* none on existing rows (trigger fires on new writes only).
*Downstream:* `booker/services/bookings.service.ts` must stop sending `price_paid`;
`create-session/route.ts:41` needs no change (it already reads from the DB, and now
that value is trustworthy). *Reversibility:* `CREATE OR REPLACE` back to the
`20260801000001` body.

### M5 — capacity as an overlap check

Replaces `check_booking_capacity()` (`20260724000003`). Keeps the `FOR UPDATE` row
lock that closed the TOCTOU race — **that lock must survive this rewrite**; losing it
silently reopens a fixed bug.

⚠️ **The obvious implementation is wrong.** "Count bookings overlapping the new one,
reject if `>= capacity_per_slot`" is incorrect once D7 permits multi-slot bookings.
Counterexample, `capacity_per_slot = 2`, 1-hour units:

```
existing:  A books 09:00–10:00      B books 10:00–11:00
new:       C books 09:00–11:00      (quantity 2)

naive overlap count = 2 (A and B)  →  2 >= 2  →  REJECTED
reality:  slot 09:00 holds {A, C} = 2 ✓
          slot 10:00 holds {B, C} = 2 ✓      →  should be ALLOWED
```

The check is **per covered slot**, not per booking:

```sql
-- time-granular: for EACH unit-slot the new booking covers, count existing
--   bookings on (schedule_id, booked_date) overlapping THAT slot;
--   reject if any single slot would exceed capacity_per_slot.
--   (generate_series over the covered boundaries, or an aggregate max().)
--
-- date-granular: same shape over dates —
--   for EACH date in [booked_date, end_date], count bookings where
--   booked_date <= d and end_date >= d; reject if any exceeds capacity.
--   NOTE: equality on booked_date is WRONG here; an existing 3-day booking
--   consumes capacity on all three of its dates (mirrors I9 point 3).
--
-- Retains: select ... for update on the schedules row BEFORE counting.
```

**The `FOR UPDATE` lock is load-bearing and must survive this rewrite.** It is what
`20260724000003_booking_capacity_lock.sql` added to close a TOCTOU race where two
concurrent inserts for the last space both passed. Dropping it while restructuring the
query silently reopens a bug someone already fixed — see §12's concurrency check.

**The slot-legality trigger must also assert the mode invariants** (V7), which the
first draft left implicit — a trigger that only checks boundaries would let a
malformed row through that the form can no longer produce but a direct insert can:

```sql
-- time-granular offering  →  start_time NOT NULL, end_date IS NULL
-- date-granular offering  →  start_time IS NULL, end_time IS NULL,
--                            schedules.recurrence = 'none',
--                            cardinality(schedules.days_of_week) = 0
-- Order: assert mode + window fit (V9) FIRST, then compute (see M4's wrap warning).
```

**Same-booker overlap (V17).** The unique index (M3) only catches an *identical*
`(booker, schedule, date, start_time)`. With `capacity_per_slot > 1` the same booker
can still hold two *overlapping* ranges — booking 09:00–11:00 and 10:00–11:00 — which
is nonsense rather than fraud. Reject it in the same trigger: if any existing
non-cancelled booking by this booker on this schedule overlaps the new span, raise.
Cheap to add here, and there is no other layer that can see it.

Plus a **new** slot-legality trigger (also covering I3):

```sql
-- time-granular: (start_time - window_start) must be a whole multiple of the unit
--                duration, and start_time + duration*quantity <= window_end
-- date-granular: booked_date >= schedules.start_date
--                and (end_date <= schedules.end_date or end_date is null)
-- both:          booked_date must be a real occurrence of the recurrence rule (I3)
```

**Blast radius.** *Data:* none — validation only, on new writes. *Lock:* unchanged
(`FOR UPDATE` on one `schedules` row). *Downstream:* the booker's `"full"` result
maps on `error.message?.includes("fully booked")`
(`booker/services/bookings.service.ts:39`) — **keep that exact phrase** in the raised
message or the error mapping silently degrades to a generic failure. *Reversibility:*
`CREATE OR REPLACE` back; drop the new trigger.

---

## 8. Validation rules

| # | Rule | Enforced where |
|---|---|---|
| V1 | `duration_minutes > 0` | CHECK (M1) |
| V2 | `duration_unit` in the allowed set | CHECK (M1) |
| V2b | `duration_minutes` is a whole multiple of its unit (60 for hour, 1440 day, 10080 week, 43200 month) | Form — the number+unit picker can only produce multiples; **not** a CHECK, since a cross-column CHECK here would block nothing the form can emit |
| V3 | Time-granular schedule: `end_time > start_time`, both present | CHECK (M2) + form (B5) |
| V4 | Time-granular schedule: window ≥ one unit | Form (blocks save) + trigger |
| V5 | Window remainder is **allowed**, shown, and unbookable | Form preview (I2) — *not* blocked; forcing exact multiples would reject 09:00–17:30 for a 1h offering, which is a legitimate thing to want |
| V6 | Recurring schedule needs ≥ 1 day-of-week | CHECK (existing) + form (B5) |
| V7 | Date-granular schedule: no times, no days, no recurrence | Form (I1) + trigger (M5) |
| V8 | Booking start lands on a legal slot boundary | Trigger (M5) |
| V9 | Booking fits inside the window | Trigger (M5) |
| V10 | Booked date is a real occurrence | Trigger (M5) — closes I3 |
| V11 | **Every slot/date a booking covers** independently ≤ `capacity_per_slot` | Trigger (M5), row-locked. **Not** a single overlap count — see the counterexample in §7 M5 |
| V11b | Booker UI greys out any start slot where the chosen quantity would cover a full slot | Form (I4), using the same shared function as V11 |
| V15 | Hidden mode fields are **cleared in state**, not just unrendered, on granularity switch | Hook (I7) |
| V16 | An offering's granularity cannot change while schedules reference it | Form (I8) — blocked with a count, not cascaded |
| V17 | The same booker cannot hold two **overlapping** spans on one schedule | Trigger (M5) — the unique index only catches identical starts |
| V18 | Mode invariants: time-granular ⇒ `start_time` present + `end_date` NULL; date-granular ⇒ times NULL, `recurrence = 'none'`, `days_of_week` empty | Trigger (M5) + form (I1) |
| V19 | `quantity`, `price_paid`, `end_time`, `end_date` are immutable after insert | Trigger (M4) — pinning `price_paid` alone lets quantity drift from the price computed from it |
| V20 | A booking's span never wraps past midnight | Ordering, not arithmetic — V9 runs **before** M4 computes `end_time`; see §7 M4's verified wrap note |
| V21 | Slot legality and capacity are checked on **INSERT only**; consistency/pinning on **INSERT OR UPDATE** | Trigger declarations (B9) — wrong timing makes every booking on an edited schedule un-actionable |
| V22 | Pre-migration bookings get `start_time`/`end_time` backfilled from their schedule | M3 backfill — an unbackfilled NULL is skipped by the overlap check, i.e. silent overbooking |
| V23 | Narrowing a window warns with a count and proceeds; it does **not** block, and existing bookings stay actionable | Form (I12) + B9's INSERT-only timing |
| V12 | `capacity_per_slot >= 1` | CHECK (M2) |
| V13 | `price_paid = price × quantity`, client-supplied value ignored | Trigger (M4) — closes B4 |
| V14 | One booker cannot hold the same slot twice | Unique index (M3) |

**Layering.** App-layer validation lands **first** (B5 alone, no migration), so the
DB constraints arrive as a backstop against a *already-guarded* client rather than as
the first line of defence — the ordering `plan-authoring` §9 asks for.

---

## 9. Tradeoffs and edge cases

- **Duration change on a live offering.** Editing 1h → 2h silently halves every
  future schedule's slot count and can strand in-flight bookings mid-window.
  *Mitigation:* bookings pin their own `start_time`/`end_time`/`price_paid` at insert
  (M3/M4), so existing bookings never move. The vendor form must **warn** when
  changing duration on an offering with future bookings. Same reasoning as the
  `fulfilment_pattern` snapshot (`20260801000001:82-90`).
- **Window remainder.** 09:00–17:30 at 1h = 8 slots + 30 idle minutes. Shown, not
  blocked (V5).
- **DST.** Asia/Manila does not observe DST, so slot arithmetic is safe today. If the
  platform ever leaves PH this becomes real and `time` columns stop being sufficient.
  Recorded, not solved.
- **Overnight windows.** 22:00–02:00 is currently impossible (`end_time > start_time`)
  and stays impossible. Out of scope; a real gap for EzzyStay night shifts.
- **Month = 30 days** (D5, settled) — a "1 month" rental starting 31 Jan ends 1 Mar.
  Defensible arithmetic, counter-intuitive result, so it is **labelled in the
  offering form at the point of entry** (§6.1) rather than left for a booker to
  discover. The alternative — a true calendar month — would make `duration_minutes`
  a lie and force `interval` comparison semantics into every overlap query.
  If a vendor genuinely needs calendar-month billing later, that is a *pricing*
  feature, not a duration one, and does not reopen this.
- **Capacity vs resource identity.** `capacity_per_slot = 3` means "3 bookings may
  overlap", not "court A, B, C". Assigning a specific resource is out of scope (§0).
- **Timezone of `booked_date`.** Unchanged — still a bare `date`, still interpreted
  as PH. The existing `toPhDate` convention applies.
- **Two implementations of `isOccurrence`** (TS + plpgsql) after I3. Accepted with
  eyes open — see I3's risk note.
- **Derived slots cost a query per date** to show remaining capacity (I4). At current
  volumes this is nothing; at scale it is the first thing that would justify
  revisiting D2.

---

## 10. Migration strategy

D4 confirmed pre-launch, so this is **one batch, no compatibility window** — but the
batch is large and the pieces are mutually dependent.

**Stage 0 — B5 alone.** Pure app-layer form guards. No migration, no coupling, fixes
a live bug. Ship and verify independently.

**Stage 1 — M1 + offering form + both offering services + types + `seed.sql` offerings
+ both `ui-gallery` offering fixtures (B7, I11).** Duration becomes structured.
Nothing consumes it as a unit yet, so the system still behaves exactly as today; this
stage is purely "the data is now trustworthy". **The seed and fixtures move with the
migration, not to the end** — `db reset` is how every later stage is tested, so it
cannot be left broken.

**Stage 2 — M2 + M3 (schema) + B6 (nullable types) + I6 + `seed.sql` schedules +
schedule fixtures.** Columns and constraints land. Triggers not yet rewritten, so
behaviour is unchanged — **except** that B6 must ship here, because M2's nullable
`start_time` is a live crash in both apps' mappers the moment a date-granular schedule
exists. Widening the types forces every consumer to be revisited, which is what
surfaces I6.

**Stage 3 — M4 + M5 (the triggers, with B9's timings) + booker `createBooking` + B8
(all three apps' booking reads) + `seed.sql` booking inserts (B7's third arm).** The
behavioural cutover, and the riskiest stage: `price_paid` becomes derived and slot
legality starts being enforced. Must be verified against a live DB before proceeding.

**B9 is part of writing M4/M5, not a follow-up.** The timings are a property of the
`CREATE TRIGGER` statements themselves — `before insert` for capacity and slot
legality, `before insert or update` for consistency. Getting them uniform is the
single most damaging mistake available in this stage, because it breaks every status
transition on any schedule that is ever edited afterwards.

**This is the widest stage, and it cannot be narrowed** — the moment M3/M4 pin a time
onto the booking, the schedule-join read in all three clients is stale (B8), and the
seed's booking inserts stop satisfying the trigger (B7). Backbone, vendor, booker and
mobile all move together here. Everything else in the plan is one or two apps.

**Stage 4 — vendor schedule form (I1, I2, I7, I8, I12) + booker steps 1/3/5/6 (I4, I9,
I10, D8's card split).** The UX the whole plan exists for, and the largest stage.
Split it: **4a** = vendor form (I1/I2/I7/I8/I12), **4b** = booker (I4/I9/I10/D8).
4a and 4b are independent of each other.

**Stage 5 — `ezzy-vendor-mobile` display (I5).** Sequencing against the mobile repo's
in-flight work is the user's call, not a plan constraint.

**Stage 6 — docs. ✅ DONE 2026-08-04.**
- `schema.md` — five migration-history rows; `offerings` duration note **replaced**
  (it described the old free-text model); `schedules` rewritten as an availability
  rule with the two-shape table and the midnight constraint's real purpose;
  `bookings` gains the span columns, the immutability rule, the wrap guard, and the
  placement trigger — including why its **name and timing** are load-bearing.
- `booking-flow.md` — Step 3 rewritten (derived slots, quantity, occupancy by
  overlap, per-schedule duration, the date-granular mode); `createBooking` params;
  the security note corrected, since it previously called the payment path safe when
  the row it trusted was client-written.
- `portals.md` — the "duration asked for twice" gap struck as resolved; both forms
  re-described; Step 1/3 rows updated.
- `overview.md` — a Regional/Domain entry for duration and booking units.

**Rollback.** Each stage is independently reversible (per-migration notes in §7).
Stage 3 is the point of no easy return — after it, bookings carry derived prices.

---

## 11. Execution order

Cadence is **one stage at a time** per `developerboss`, unless the user asks for a
range.

1. **Stage 0 — B5.** Independent, safe now — no migration, no coupling, fixes a live bug.
2. **Stage 1 — B1** + seed/fixture half of **B7**, **I11**.
3. **Stage 2 — B2 + B3 schema** (M2 + M3) + **B6** + **I6** + seed/fixture half of **B7**.
   *B6 is not optional here — M2 without it is a runtime crash in both apps.*
4. **Stage 3 — B3 triggers + B4 + B8 + B9 + I3** (M4 + M5 + booker service + all three
   apps' booking reads + seed bookings). Coupled batch — **backbone, vendor, booker and
   mobile move together**; none can ship apart. **Point of no easy return.**
   *B9 (trigger timings) is written as part of M4/M5, not after them.*
5. **Stage 4a — I1 + I2 + I7 + I8 + I12** (vendor forms).
6. **Stage 4b — I4 + I9 + I10 + D8** (booker wizard). Independent of 4a.
7. **Stage 5 — I5** (mobile). Sequencing vs the mobile repo's in-flight work is the
   user's call.
8. **Stage 6 — docs.**

---

## 12. Verification

| Item | How | Kind |
|---|---|---|
| B5 | Save a schedule with blank End Time and with Weekly+no-days; expect a form-level message, no Postgres error | **live** (browser) |
| B1 | `npx tsc --noEmit` in `vendor` + `booker`; migration `RAISE NOTICE` list reviewed for defaulted rows | machine + **live** |
| B1 (D5) | After backfill, assert no row has `duration_unit = 'hour'` where the old text matched `mon` — the ordering trap in M1's regex. Seed's `'1 hour'`/`'2 hours'`/`'3 hours'` → 60/120/180 | **live** (DB) |
| B2 | Existing seed schedules keep their capacity; a new schedule defaults to 1 | **live** (DB) |
| B3 | A 09:00–17:00 window on a 1h offering yields 8 booker buttons; booking 09:30 is rejected by the trigger | **live** (DB + browser) |
| B4 | Forge `price_paid: 1` through the anon client; assert the stored value is `price × quantity` | **live** — security claim, must not be assumed |
| I1 | A date-granular offering shows no time inputs | **live** (browser) |
| I2 | Preview count matches the trigger's arithmetic for the same inputs — assert on the shared pure function | machine (unit test) |
| I3 | Insert a booking for a date the recurrence excludes; expect rejection | **live** (DB) |
| I4 | Slot shows start–end and a remaining count that decrements after a booking | **live** (browser) |
| I5 | Android build renders a multi-day booking's span | **live** (device) — Android only; iOS has never been built |
| V11 | Two concurrent inserts for the last space; exactly one succeeds | **live** — the `FOR UPDATE` lock must be re-proven after M5 rewrites the function |
| V11 (multi-slot) | Reproduce §7 M5's counterexample exactly — capacity 2, A 09–10, B 10–11, then C 09–11 — and assert C is **accepted**. A naive overlap count rejects it | **live** (DB) — this is the specific defect the rewrite must not reintroduce |
| B6 | Create a date-granular schedule, then load the vendor Schedules page and booker Step 3; assert no `TypeError` | **live** — `tsc` cannot see this unless the `DbRow` types are widened, so widen them *and* run the page |
| B7 | `supabase db reset` succeeds after **each** of Stages 1, 2 **and 3** — not just at the end. Stage 3 is the one the first gap review missed | machine |
| B8 | Book two different slots of one schedule; assert the vendor list, booker dashboard **and** the mobile list each show *different* times. Then load a date-granular booking and assert no blank time | **live** (browser + Android device) |
| V19 | Attempt to UPDATE a booking's `quantity` and `price_paid`; assert both raise | **live** (DB) |
| V20 | Book a 23:00 slot with quantity 2 against a window ending 23:59; assert rejection (not a wrapped `01:00` `end_time`). **Daytime fixtures cannot catch this** | **live** (DB) — the wrap is verified real, see §7 M4 |
| V17 | Same booker books 09:00–11:00 then 10:00–11:00 with capacity 2; assert the second is rejected | **live** (DB) |
| V18 | Direct insert of a date-granular booking carrying a `start_time`; assert rejection | **live** (DB) |
| B9 / V21 | Narrow a schedule's window, then confirm **and** complete an existing booking that no longer fits. Both must succeed. Then let `auto_acknowledge_bookings()` run against it | **live** (DB) — trigger timing is invisible to `tsc` and to happy-path testing |
| V22 | After M3, assert no `bookings` row has NULL `start_time` where its schedule has one | **live** (DB) |
| I12 / V23 | Sell a 09:00 booking, narrow the window to 12:00; assert the warning names the count and the save still proceeds | **live** (browser) |
| I6 | A date-granular schedule renders `01 Aug – 31 Dec`, not `null · one-time`; confirm it appears on the calendar at all (`getSchedsForDay` filters by day-of-week) | **live** (browser) |
| I7 | Pick hourly → fill times → switch to daily → save; assert NULL `start_time`/`end_time` and empty `days_of_week` in the row | **live** (browser + DB) |
| I8 | With a schedule attached, flip the offering's unit hour → day; assert refusal naming the schedule count | **live** (browser) |
| I9 | A 3-day booking consumes capacity on all three dates — assert the middle date shows reduced availability | **live** (DB + browser) |
| I10 | Two vendors, same code, same granularity, different durations; assert Step 3's grid uses the *selected vendor's* duration and the booking inserts without trigger rejection | **live** (browser + DB) |
| I11 | `npx tsc --noEmit` in both apps; `/ui-gallery` renders both granularities | machine + **live** |

**Machine-verifiable:** type-checks, the shared slot function's unit tests, grep for
remaining `max_capacity` / `duration` references.
**Needs a live environment:** every trigger, the capacity race, the price-forgery
test, and all UI. **No item here may be marked ✅ on a type-check alone.**

---

## 13. Knowingly accepted, not fixed

- **Cross-vendor price display in steps 3–6.** `dedupeByCode`
  (`useBookingWizard.ts:12-25`) keeps the cheapest offering per code, so the price
  carried into later steps can belong to a different vendor than the one being booked.
  D8 chose card-splitting over re-resolution, which fixes the *granularity* mismatch
  (the dangerous one — wrong form mode) and leaves this. Pre-existing, partly masked
  by the "from ₱X" prefix, and **unrelated to duration** — it would be equally true
  today. I10 separately ensures the *duration* used for slot arithmetic is always the
  booked vendor's, so no booking becomes unfinishable because of it.
- **Staff double-booking across schedules.** A staff member assigned to two schedules
  with overlapping windows can be booked twice at once. Pre-existing; `schedules.staff_id`
  has never been checked for conflicts. Out of scope — it is a resource-conflict
  feature, not a duration one.

---

## 14. Follow-ups discovered, not in scope

- `booker/CLAUDE.md` is **stale** — it describes Next.js 15.1, a "single-page SPA
  pattern", `lib/utils.ts` as the only lib file, and "no environment variables
  required for the current feature set". The app is on Next 16 with PayMongo keys,
  Supabase env vars, and a full `services/` layer. Not touched here (out of scope),
  but it will mislead the next session that reads it.
- **Overnight availability windows** (22:00–02:00) remain impossible — see §9.
- **Per-slot pricing** (peak/off-peak) — the structured duration makes this newly
  feasible; no work planned.

---

## 15. Carried forward — open, and deliberately not fixed here

The first is **this plan's own shortfall**, found during the 2026-08-07 documentation
audit. The other two are **pre-existing and unrelated to duration**. Recorded so they are
not rediscovered as new, and so no future stage claims a check it cannot run.

- **⚠️ The booker's date-granular render arm was never built — this plan's status line
  overstates it.** "Both the vendor form and the booker wizard are granularity-driven" is
  half true: detection shipped, the UI did not. `useStep3Schedule.ts:39,63,90` detects the
  mode and returns `dateRange`, but `Step3Schedule.tsx:26` never destructures it, so
  `slotViews` is empty (`:42`) and the panel renders *"No time slots available for this
  date."* (`Step3Schedule.tsx:101-102`). `canNext` (`useBookingWizard.ts:116`) requires
  `!!time`, which nothing sets in this mode — **a day/week/month offering cannot be booked
  at all.** I5's mobile arm and B8 are unaffected; this is booker-only.
  `visual-tests/pilot.spec.ts:78` is green because it asserts only the *absence* of slots,
  never that the step can be passed — so no check here ever covered it. The fix is a render
  arm plus a `canNext` widening, and needs its own plan.
- **I14 — `npm run lint` is broken repo-wide in `vendor`.** A config circularity in
  `@eslint/eslintrc` aborts before any source file is read; `npx eslint lib/utils.ts`
  fails identically. **Lint was therefore never available as a verification tool for
  any stage of this plan** — every ✅ here rests on `tsc`, `npm run build`, `db reset`,
  Playwright, or a live DB check. Worth its own small task.
- **I15 (`command` arm) — that app's Playwright harness still points at
  `127.0.0.1`.** On this machine Next refuses its own dev resources over that host, so
  the page renders but React never hydrates and no `onClick` fires. `vendor` and
  `booker` are fixed; `command` is untouched because this plan never went near it. Any
  interactive baseline recorded there before the fix is worthless.

## 16. What shipped

The flaw this plan opened with — *"offering duration, schedule setup and booking
capacity are mixed together"* — is closed end to end:

| Before | After |
|---|---|
| `offerings.duration` free text, parsed by nothing | `duration_minutes` + `duration_unit`, enforced |
| Schedule window never subdivided | Slots **derived** as window ÷ duration, one rule in three places |
| `bookings` stored no time at all | Each booking carries its own pinned span and quantity |
| `max_capacity` meant two things, defaulted to 20 | `capacity_per_slot`, one meaning, defaults to 1 |
| Recurrence validity enforced only in TypeScript | Enforced in the database |
| `price_paid` written by the client | Derived as `price × quantity` and pinned |
| Vendor typed a duration twice, neither enforced | Typed once; the form switches shape by unit |
| Booker saw one button per schedule, no length, no capacity | Real slot grid with start–end, spaces left, and a quantity picker |

**Verification actually run:** `supabase db reset` 0 after every schema stage; `tsc` 0
in all three apps; `npm run build` 0 in both web apps; `expo lint` / `npm test` (95/95) /
`expo export` 0 on mobile; **19 Playwright tests** (17 vendor, 2 booker); and every
trigger behaviour — price forgery, the multi-slot capacity counterexample, the midnight
wrap, slot boundaries, occurrence validity, same-booker overlap, immutability, and
trigger ordering — exercised live against the database.

**Not verified:** the mobile change on a physical device, and **nothing at all on iOS**
(no Apple Developer membership). I8 and I12 are type-checked and reviewed but not
browser-tested, because the gallery fixtures cannot express "an offering that has
schedules" or "a schedule that has future bookings".
