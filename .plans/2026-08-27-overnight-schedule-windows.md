# Overnight Schedule Windows (Crossing Midnight)

**Date:** 2026-08-27 · **Reviewed and re-scoped:** 2026-08-27
**App / scope:** `backbone/` (one constraint, two trigger functions) and **both** web apps
(`vendor/`, `booker/`). Neither Expo app carries slot logic — verified — so the blast
radius stops at two web apps.
**Status:** COMPLETE (2026-08-28) — every blocker and important item is ✅ or explicitly
parked with a reason. All decisions D1–D5 resolved. Both migrations and the unique index
are applied to local, staging and production; both app builds are deployed. Overnight
windows are now creatable, bookable and legible end to end.

**Supersedes** `.plans/2026-08-27-vendor-schedule-duplicates.md` (2026-08-27). Every live
item from that plan is merged here as **B8, B9, B10, I4, I5**; its I4 (the "Ends at
midnight" checkbox) is retired by this refactor — see B7. That file is kept as the
superseded record and should not be worked from.

> One-line framing: a vendor open 23:00–01:00 cannot say so today. The cause is not a
> missing feature — it is that the code does arithmetic on a data type that cannot
> represent "tomorrow". This plan replaces that type. Optimising for making the wrap
> **impossible**, not for relaxing the rule that currently hides it.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local — qualify
> cross-plan refs by app (e.g. "vendor-duplicates I4").

**Split out of** `.plans/2026-08-27-vendor-schedule-duplicates.md` (2026-08-27). That
plan's I4 — making `24:00` reachable — is separate and already in scope there. See B7.

---

## 1. How we got here — the two decisions that produced this limit

The user asked where this was decided. It was two decisions, ten weeks apart, and
**neither was wrong at the time**. The second is the one that made overnight impossible.

### Decision 1 — 2026-05-07, `20260507000002_schedules.sql:37`

```sql
constraint schedules_end_after_start check (end_time > start_time)
```

An ordinary sanity check, written when a schedule was a single bookable thing with
`max_capacity` and **no derived slots at all**. At that point it cost nothing and caught
typos. Nothing depended on it.

### Decision 2 — 2026-08-03, `.plans/2026-08-03-offering-duration-and-booking-units.md`

This is the one. During "gap review #2", gap **G3** (plan line 43) recorded:

> `time + interval` **wraps** (verified: `23:00 + 2h = 01:00`), inverting the range the
> capacity check relies on

Two fixes were available: stop doing arithmetic on `time`, or lean on the 2026-05-07
constraint so the wrap can never arise. The plan chose the second, explicitly (line
1544–1550):

> **M5's window-fit check (V9) must run and pass BEFORE M4 computes `end_time`.** Because
> `schedules_end_after_start` already forbids a window from crossing midnight, a booking
> that fits inside its window provably cannot wrap. The wrap is therefore impossible *by
> construction* — but only if the checks run in that order.

That was a sound call for the goal of the day: it closed a real overselling bug at zero
cost. But it **promoted a free sanity check into a load-bearing invariant**. From that
moment the whole booking model depended on windows never crossing midnight, and
`20260803000002` wrote the dependency into the column comment, `20260803000004:94-101`
into the trigger, and `architecture/schema.md:600` into the documentation.

**Nobody decided "vendors may not trade overnight."** It was inherited, three times over,
from a decision about check ordering.

---

## 2. The actual root cause, in one sentence

**The code adds hours to a `time`, and a `time` is a clock reading with no date attached —
so it wraps at midnight and silently loses the day.**

The fix is not to allow the wrap and then cope with it everywhere. It is to do the
arithmetic on a value that carries the date, which cannot wrap. Verified on the local
instance 2026-08-27:

```
time '23:00' + interval '2 hours'                        →  01:00:00          ← wraps
(date '2026-08-28' + time '23:00') + interval '2 hours'  →  2026-08-29 01:00  ← correct
```

`date + time` yields a `timestamp` in Postgres, and timestamp arithmetic carries the day.
That single change removes the entire class of bug the 2026-08-03 ordering guard exists to
prevent — and removes the need for the guard.

Two further results from the same session, both load-bearing for this plan:

- `tsrange(...) && tsrange(...)` detects overlap **across midnight** correctly, and
  correctly reports *no* overlap for merely adjacent spans. The overlap test needs no
  hand-rolled wrap logic.
- `date '2026-08-28' + time '24:00'` → `2026-08-29 00:00:00`. The `24:00` values the
  duplicates plan's I4 writes normalise into this model for free. See B7.

---

## 3. Recommended approach

Two changes to what is stored, and one change to how everything compares. Each item below
carries a **Plain English** line, as requested.

**The rule that ties it together — CORRECTED 2026-08-28 during stage 3a, having been
disproved by its own test.** The original wording was:

> ~~`booked_date` is always the date the window OPENS.~~

That is **wrong**, and the trigger test caught it. Under it, the 00:00 slot of a Friday
23:00–01:00 window would be stored as `booked_date = Friday, start_time = 00:00`, and
`booked_date + start_time` then resolves to **Friday 00:00 — twenty-four hours before the
booking happens**. No reader could recover the real instant without joining the schedule,
breaking `architecture/schema.md:639` ("a booking describes its own span with no join"),
which the capacity test depends on. The correct rule is two rules:

> **The OCCURRENCE is the date the window opens.**
> **A booking's `booked_date` is the date the booking STARTS.**

They coincide for same-day windows, which is why the distinction never had to exist. The
occurrence is *derived* in `check_booking_placement()` — a start earlier in the clock than
the window opens can only belong to the previous day's window — so the booking stays
self-describing and the Friday-only schedule still refuses a genuine Saturday booking.

**Date-granular offerings (day / week / month) are untouched.** They have no
`start_time`, no window, and their own branch in every function. Nothing in this plan
enters that branch. This was an explicit requirement and it is satisfied by construction,
not by care.

---

## 4. Effect on the other duration units (minute / hour / day / week / month)

Asked directly on 2026-08-27. The plan's claim that date-granular offerings are "untouched
by construction" is **true of the logic and false of the testing** — and there is one place
where the two shapes genuinely meet. Verified by reading each branch.

| Unit | Granularity | Effect |
|---|---|---|
| `minute` | time | Changed with `hour`. A 30-min offering in a `23:00 + 120` window derives `23:00, 23:30, 00:00, 00:30` — correct once B4 works in offsets. |
| `hour` | time | The target of this plan. |
| `day` / `week` / `month` | date | **Logic unchanged.** `start_time` stays NULL, so `window_minutes` stays NULL, and every date-granular branch is entered by `duration_unit`, never by the window. `end_date = booked_date + (duration_minutes/1440 × quantity) − 1` (`20260803000004`) is untouched. |

**Three interactions that are real and must not be waved away:**

**(a) The shared date-bound check is a regression risk — see B2.** It is the one place the
two shapes meet, and this plan changes what it reads.

**(b) "Untouched" does not mean "untested".** Both trigger functions `select … start_time,
end_time …` (`20260803000005:65-69`, `20260803000004:52`) *before* branching on unit.
Dropping `end_time` breaks that fetch for **every** unit, so both functions are rewritten
wholesale and the date-granular path must be **re-tested even though its logic did not
change**. A regression suite that only covers hourly bookings would pass a broken build.

**(c) A new invariant, because `end_date` changes meaning.** Today a non-NULL booking
`end_date` implies date-granular. After B2 it can also mean "an hourly booking that ran
past midnight". Nothing infers granularity that way **today** — `vendor/lib/slotAvailability.ts:53`
and the trigger's date branch (`20260803000005:183-184`) both filter by `schedule_id`
first, so neither can see a time-granular booking — but the trap is now live for the next
person. Write it down and keep it written:

> **Never infer granularity from `end_date`. Read `offerings.duration_unit`.**

`vendor/lib/occurrence.ts`'s `isDateGranular(s)` discriminator (`!s.time`) stays valid:
`start_time` is still NULL exactly for date-granular, and B1's `schedules_window_shape`
constraint is what now guarantees it.

---

## 5. What this refactor does NOT change

Written because the risk in a refactor this size is **unnecessary** change, and because
each of these looks like it ought to need touching. Verified 2026-08-27.

- **`bookings_no_duplicate`** (`20260803000003:80-82`) — `(booker_id, schedule_id,
  booked_date, coalesce(start_time,'00:00'))`. **No change.** `booked_date` is the date the
  window opens and `start_time` is the clock start, so two bookings of one slot still
  collide and two different slots still don't. Adding a date would be change with no defect
  behind it.
- **The historical migrations** `20260803000002/3/4/5`, which all reference
  `schedules.end_time`. They run *before* this plan's migration in timestamp order, so the
  column still exists when they execute. Editing an applied migration is forbidden by
  AGENTS.md and is unnecessary here.
- **`isDateGranular`** (`vendor/lib/occurrence.ts`), discriminating on `!s.time`. Still
  correct: `start_time` remains NULL exactly for date-granular — now *guaranteed* by B1's
  `schedules_window_shape` rather than merely conventional.
- **Recurrence, `days_of_week`, `start_date`/`end_date` bounds, `capacity_per_slot`,
  `staff_id`, `is_active`** — untouched. Occurrence *selection* does not change; only how
  far a window extends from its start.
- **The offering→schedule handoff, realtime, `auto_acknowledge_bookings()`** — none reads a
  window end.
- **`useBookings.ts:31`** — the bookings list already sorts on
  `new Date(bookedDate + "T" + (startTime || "00:00:00"))`. That is a real instant, so a
  Friday 23:00 booking already sorts chronologically correctly once overnight exists. **No
  change**, and it is the pattern B6 should follow elsewhere.
- **`PendingApprovalsCard.tsx:46`** and **`CalendarPage.tsx:60`** (`getBkgsForDay`) — both
  key on `bookedDate` alone, which is the window-open date. Correct under the §3 rule as
  they stand.
- **`resolveScheduleForTime`** (`booker/services/schedules.service.ts:240-247`) — matches on
  slot start, unique within a window under D3's cap. No change.

**A second, stronger reason for D3's 24-hour cap, found in this review.** Without
`window_minutes <= 1440`, consecutive daily occurrences of the *same* schedule would
overlap themselves — a 26-hour window opening Friday 23:00 runs into Saturday's own
occurrence. The capacity trigger counts per `(schedule_id, booked_date)` and would not see
it. The cap keeps occurrences of one schedule disjoint: a correctness property, not merely
the display convenience it was first justified on.

---

## BLOCKERS

### B1 — `schedules` stores a window END, which cannot express "next day"  ✅ DONE (2026-08-28)

> ✅ **DONE (2026-08-28).** Shipped as two migrations per D5's expand/contract:
> `20260828000001` (add `window_minutes`, backfill, temporary sync trigger) and
> `20260828000002` (drop the sync trigger, add the range and shape constraints, drop
> `end_time`). **Both applied to local, staging and production.** The `end_time` column no
> longer exists; a window is a start plus a length, and a length has no midnight to cross.

**Files:** `20260507000002_schedules.sql:37` (the CHECK),
`20260803000002_schedule_availability.sql:41-46` (where it was carried forward and made
null-tolerant), `architecture/schema.md:600`.

`end_time` is a clock reading. `23:00 → 01:00` is indistinguishable from a typo, which is
exactly why the CHECK rejects it.

**Fix approach:** replace the window's end with its **length** — `window_minutes integer`
— and derive the end for display. A length has no midnight to cross, so the invalid state
stops being representable rather than being forbidden.

> **Plain English:** instead of storing *"open 23:00, closes 01:00"* — which sounds like
> it closes two hours before it opens — store *"open 23:00, for 120 minutes"*. There is
> nothing ambiguous about 120 minutes.

- `window_minutes` is NULL exactly when `start_time` is NULL (date-granular), preserving
  the existing two-shapes invariant.
- `check (window_minutes > 0 and window_minutes <= 1440)` — a window may still not exceed
  24 hours. That keeps a slot's clock time unique within its window, which several display
  paths assume.
- `schedules_end_after_start` is **dropped**. It has no meaning once there is no end.
- Backfill: `window_minutes = (end_time - start_time)` in minutes, which is total for
  every existing row precisely because the old CHECK guaranteed `end_time > start_time`.

**Exact change — TWO migrations, per D5's expand/contract.** Neither file is written
until execution is approved.

#### Migration A — *expand*. ✅ **WRITTEN 2026-08-28** as `20260828000001_schedule_window_minutes_expand.sql`.

```sql
-- backbone/supabase/migrations/2026XXXXXXXX01_schedule_window_minutes_expand.sql
-- Ships with B2 + B3's trigger rewrites. Adds NOTHING that breaks the deployed apps:
-- end_time stays, and so does schedules_end_after_start.

alter table public.schedules add column window_minutes integer;

-- Total for every existing row: the old CHECK guaranteed end_time > start_time.
update public.schedules
   set window_minutes = (extract(epoch from (end_time - start_time)) / 60)::int
 where start_time is not null and end_time is not null;

-- ⚠️ TEMPORARY — dropped by Migration B. Keeps the two columns in step while the OLD
-- build (writes end_time) and the NEW build (writes window_minutes) are both live.
create or replace function public.sync_schedule_window()
returns trigger language plpgsql as $$
begin
  if new.start_time is null then          -- date-granular: neither applies
    new.window_minutes := null; new.end_time := null; return new;
  end if;
  if new.window_minutes is null and new.end_time is not null then
    new.window_minutes := (extract(epoch from (new.end_time - new.start_time)) / 60)::int;
  elsif new.end_time is null and new.window_minutes is not null then
    new.end_time := new.start_time + make_interval(mins => new.window_minutes);
  end if;
  return new;
end $$;

create trigger schedules_sync_window
  before insert or update on public.schedules
  for each row execute function public.sync_schedule_window();
```

**Verified 2026-08-28** on the local DB, rolled back. Backfill converted all 9 rows; an
old-build write (`end_time` only) derived `window_minutes = 480`; a new-build write
(`window_minutes` only) derived `end_time`, so the old build still reads a sensible row.

⚠️ **Overnight is NOT available after Migration A, by design.** `schedules_end_after_start`
still stands, so a `23:00 + 120` insert is refused — verified. The feature ships with
Migration B. That is deliberate: A is purely preparatory and changes no behaviour, which is
what makes it safe to deploy alone. **Stage 7's UI must therefore land after B**, which the
execution order already ensures.

#### Migration B — *contract*. ✅ **WRITTEN 2026-08-28** as `20260828000002_schedule_window_minutes_contract.sql`.

> **Verified 2026-08-28** on the local DB, applied and rolled back, with ids looked up
> dynamically: `end_time` gone (0 columns); both constraints present; **an overnight
> `23:00 + 120` schedule ACCEPTED** — refused before this migration; a 2-hour booking from
> Fri 23:00 stored as `end_time 01:00, end_date 2026-05-02`; the covered `00:00` slot then
> refused as *"fully booked (capacity: 1)"*; a 25-hour window refused by the cap; a
> half-populated shape refused by `schedules_window_shape`.
>
> ⚠️ **Testing note, learned the hard way:** the first run of this test hardcoded a seed
> UUID from before the user's `db reset`, which regenerates them. Every `insert … select …
> where id = '…'` matched nothing, inserted zero rows, raised nothing — and the
> exception-handler tests therefore reported PASS-shaped output for assertions that never
> ran. Any `do $$ … exception` block used as a test must assert `row_count`, or a silent
> no-op reads as success.

```sql
-- backbone/supabase/migrations/2026XXXXXXXX02_schedule_window_minutes_contract.sql
-- Run ONLY after both app builds are deployed and verified against Migration A.

drop trigger  if exists schedules_sync_window on public.schedules;
drop function if exists public.sync_schedule_window();

alter table public.schedules
  drop constraint schedules_end_after_start,
  add constraint schedules_window_minutes_range
    check (window_minutes is null or (window_minutes > 0 and window_minutes <= 1440)),
  -- The two-shapes invariant, now stated instead of implied.
  add constraint schedules_window_shape
    check ((start_time is null) = (window_minutes is null));

alter table public.schedules drop column end_time;
```

⚠️ **Dropping the sync trigger is the step most likely to be forgotten**, and it fails
silently: left in place, it would keep writing an `end_time` column that no longer exists
and every schedule write would error. It is the first statement in B for that reason.

⚠️ **Do not add `alter column window_minutes set not null`.** It is NULL for every
date-granular row; `schedules_window_shape` is what enforces the pairing.

**Verified 2026-08-27** on the local DB in a rolled-back transaction, with a synthetic
`00:00–24:00` row added first to test the boundary:

- Backfill converted all 10 time-granular rows correctly, including `00:00–24:00 → 1440`.
- `(start_date + start_time) + make_interval(mins => window_minutes)` derives the right
  end for every row — the all-day row resolves to the **next** midnight.
- The date-granular row satisfied `schedules_window_shape` untouched.
- `23:00 + 120` inserted cleanly and derived an end of `01:00 the next day` — the thing
  that is impossible today.

**Blast radius.** *Data:* rewrites `window_minutes` on every time-granular row; no row can
fail, because the dropped CHECK guaranteed a positive interval. *Lock:* `ACCESS EXCLUSIVE`
on `schedules` for an `ADD COLUMN` + `UPDATE` + `DROP COLUMN` on a small table.
*Downstream, named exhaustively* (gap review 2026-08-27 — the earlier
wording said "every select naming it", which is not a checklist):
**both triggers read `end_time` and break the moment it is dropped** — hence
the coupled batch; plus every `select` naming it in `vendor/services/schedules.service.ts:70`
and `booker/services/schedules.service.ts:42`, ; the two **write** paths
`vendor/services/schedules.service.ts:95` (create) and `:122` (update), which map
`input.end` to `end_time`; and three hand-written interfaces — `ScheduleInput.end`
(`vendor/services/schedules.service.ts:13`), `Schedule.end` (`vendor/lib/types.ts:225`)
and `BookerSchedule.endTime` (`booker/lib/types.ts:113`). AGENTS.md requires these be
updated by hand after any schema change; there is no `supabase gen types` in this repo. *Reversibility:* re-add `end_time`,
backfill it as `start_time + window_minutes`, restore the old CHECK — lossless, because
`window_minutes` carries strictly more information than the column it replaces.

### B2 — `bookings` forces `end_date` to NULL for time-granular, so a span cannot finish tomorrow  ✅ DONE (2026-08-28)

> ✅ **DONE (2026-08-28)** in `20260828000001`. `check_booking_consistency()` computes the
> span on timestamps and sets `end_date` when it finishes the next day; the
> `v_end_min > 1440` wrap guard is deleted as unreachable. A span ending exactly at
> midnight keeps the `24:00` / `end_date NULL` convention.
> **Also removed:** the function no longer selects `schedules.start_time/end_time` — those
> two variables were fetched and **never read**, dead since 20260803000004. That is what
> decouples it from the column being dropped, so it needs no further change in Migration B.
> **The regression this item warned about is fixed and tested:** the schedule-end bound now
> checks the OCCURRENCE for time-granular bookings, not the span.
> **Verified live (rolled-back transaction):** 2-unit booking from Fri 23:00 → `end_time
> 01:00, end_date 2026-05-02`; ordinary same-day booking unchanged (`end_date` null);
> date-granular unchanged.

**File:** `20260803000004_booking_derive_price_and_span.sql:112` — `new.end_date := null;`
and the wrap guard immediately above it at `:98-102`.

The column that would record "this finished the next day" **already exists** and is
deliberately blanked.

**Fix approach:** compute the span as a timestamp, then split it back into
`end_date` + `end_time`. Delete the `v_end_min > 1440` rejection — it becomes unreachable,
because the arithmetic no longer wraps.

> **Plain English:** a booking already has a "finishes on this date" field. Today we wipe
> it for hourly bookings because we assumed they always finish the same day. Stop wiping
> it, and a 23:00 two-hour booking can honestly say it ends at 01:00 *tomorrow*.

A booking ending exactly at midnight needs no special case: `end_time` stays `24:00` with
`end_date` NULL, and `date + time '24:00'` already resolves to the next midnight.

⚠️ **REGRESSION THIS ITEM INTRODUCES — found 2026-08-27, must be fixed in the same
change.** `20260803000005:80` runs **before** the granularity branch, so it applies to
every booking of every unit:

```sql
if v_sched_end is not null and coalesce(new.end_date, new.booked_date) > v_sched_end then
  raise exception 'This schedule ends on %', v_sched_end;
end if;
```

Today `end_date` is always NULL for time-granular, so this reads `booked_date` and is
correct. Once this item populates `end_date`, a 23:00 booking on the schedule's **final**
date has `end_date = booked_date + 1`, trips this check, and is refused with *"This
schedule ends on …"* — a booking that should plainly be allowed. The schedule's `end_date`
bounds which **occurrences** exist, not when a booking may finish.

**Fix:** bound on `new.booked_date` for the time-granular branch, keeping
`coalesce(new.end_date, new.booked_date)` for date-granular, where a multi-day span
genuinely must finish inside the range. Either move the check into both branches or
condition it on `v_dur_unit`.

**Test it explicitly** with a booking on the last day of a bounded schedule. Nothing in
the existing suite covers it, because today it cannot happen.

**Coupling:** must ship with B3. The trigger that writes the span and the trigger that
validates it read the same columns; splitting them leaves one of the two wrong.

### B3 — `check_booking_placement()` compares clock times, so it cannot see across midnight  ✅ DONE (2026-08-28)

> ✅ **DONE (2026-08-28)** in `20260828000001`. All three sites moved to timestamps, plus
> occurrence resolution (see §3's correction). The `select … for update` lock is untouched.
> Capacity candidates are bounded to `booked_date ± 1` — an overnight booking from the
> previous evening can still be running, and nothing further can overlap under the 24-hour
> cap, so the `schedule_id` index stays useful.
> **Verified live (rolled-back transaction), all seven cases including the ones that must
> FAIL:** 2-unit Fri 23:00 accepted and spanning midnight · the 00:00 slot then refused as
> *"fully booked (capacity 1)"* · the following week's 00:00 accepted, so occurrences do not
> bleed · a genuine Saturday 23:00 refused as *"does not run on that day of the week"* ·
> 3 units from 23:00 refused as *"would run past the availability window"* · ordinary
> same-day booking unchanged · date-granular unchanged.

**File:** `20260803000005_booking_slot_and_capacity.sql:144-145` (per-slot capacity) and
`:162-163` (the same-booker overlap test). Both compare `time` values, and `:116-118`
works in minutes from midnight.

Feed this an overnight span today and the range inverts: the capacity test matches
nothing and **passes everything**. That is the silent-overselling failure the 2026-08-03
guard exists to prevent, and it is why B1 cannot ship alone.

**Three sites, not one** (gap review 2026-08-27 — the earlier wording named only the
overlap test and would have let a partial fix pass):

| Site | Today | Why it breaks |
|---|---|---|
| `:122` | `if new.end_time > v_win_end` | Raw `time` comparison. For a 23:00+2h booking, `01:00 > 01:00` is false but `01:00 > 23:00` is *also* false — the window-fit check silently passes anything. |
| `:136-147` | `generate_series(0, v_total_min - v_dur_minutes, v_dur_minutes)` joined on minutes-from-midnight | The per-slot worst-case capacity loop. **This is the multi-unit path** — a 2-unit booking from 23:00 — and it is the user's stated use case. |
| `:162-163` | `b.start_time < new.end_time and b.end_time > new.start_time` | The same-booker overlap test. Inverts across midnight. |

**Fix approach:** build `v_start_ts := new.booked_date + new.start_time` and
`v_end_ts := v_start_ts + make_interval(mins => …)`, and compare with `tsrange … && …`.
The `generate_series` loop keeps its shape — it already works in offsets from the booking
start; only the join predicate moves from minutes-from-midnight to timestamps.
Keep the `select … for update` row lock from `20260724000003` exactly as it is — that is
what closes the TOCTOU race and is unrelated to this change.

> **Plain English:** the guard that stops double-booking currently compares "11pm" with
> "1am" and concludes 1am is earlier, so it thinks nothing overlaps and lets everything
> through. Compare full dates-with-times instead and it gets the right answer.

⚠️ **This is the most dangerous item in the plan.** Its failure mode is not an error — it
is silently selling the same hour twice. It must be the first thing tested and the last
thing trusted.

### B4 — Both copies of `lib/slots.ts` derive slots in minutes-from-midnight  ✅ DONE (2026-08-28)

> ✅ **DONE (2026-08-28)** — added `deriveSlots(windowStart, windowMinutes, duration)` and
> `fitsInWindow(...)` to both copies, working in offsets from the window start. The old
> `slotsInWindow`/`spanFitsWindow` exports remain and now **delegate**, so no caller moved
> (stage 5 switches them and deletes the old pair). Two private helpers carry the display
> rule: `slotClock` wraps (a slot at 1440 is next-day "00:00") while `windowEndClock`
> keeps "24:00" for a window that closes at end of day — rendering that as "00:00" would
> say the window is empty.
> **Verified:** `vendor` 271 tests pass (was 248; +19 slot cases, +4 occurrence);
> `booker` 19 pass; `tsc --noEmit` exit 0 in **both** apps; lint unchanged in both
> (vendor 35→35, booker 23→23, stash-compared); the two `slots.ts` files `diff` clean
> apart from line 14's cross-reference comment.

**Files:** `vendor/lib/slots.ts:48-72` (`slotsInWindow`) and `:81-92`
(`spanFitsWindow`), plus **the byte-identical copy** at `booker/lib/slots.ts` (diffed
2026-08-27: only the comment naming the other file differs). AGENTS.md forbids cross-app
imports, so this is two edits that must stay in lockstep.

`slotsInWindow` computes `span = end - start` and returns empty when that is negative —
which is why an overnight window silently yields zero slots today rather than an error.

**Fix approach:** take `windowMinutes` instead of a window end, and generate slots as
**offsets from the window start**. Clock times are produced only for display, at the end.

⚠️ **Sequencing, decided 2026-08-28 while starting stage 2.** Changing `slotsInWindow`'s
signature in place would break every caller immediately — and those callers read
`schedule.end`, which still exists until Migration B. So this item lands as a **code-level
expand/contract mirroring the database one**: stage 2 *adds* the offset-based
implementation with its tests while leaving the existing export working, and stage 5
switches the callers and deletes the old one. That keeps stage 2 genuinely independently
shippable, which is what the execution order claims for it.

> **Plain English:** stop asking "what time does this slot start" while building the list,
> and ask "how far into the window is it" instead. Convert to a clock time only when it is
> shown to a human. Distances never wrap; clock times do.

### B5 — The occurrence rule has four copies and none of them knows a window can end tomorrow  ✅ DONE (2026-08-28)

> ✅ **DONE (2026-08-28)** — the rule *"`booked_date` is the date the window OPENS"* is now
> written into `vendor/lib/occurrence.ts` and `booker/services/schedules.service.ts`'s
> `isOccurrence`, each stating that occurrence selection is unchanged and that late slots
> must **not** be shifted onto the following day. The booker's copy also points at B12,
> which is where that decision has a consequence for it.
> **No behavioural change was needed** — as the item predicted, a Friday 23:00–01:00
> schedule runs on Fridays and nothing branches on the window end.
> **Verified:** four new fixtures in `vendor/lib/occurrence.test.ts` assert exactly that —
> the overnight schedule occurs on its Fridays, does **not** occur on the Saturdays its
> slots spill into, and still respects both date bounds. 271 tests pass.
> The two remaining copies are the DB trigger (rewritten in stage 3a, where the same note
> goes into the new function) and `ezzy-vendor-mobile`, which still has none.

**Files:** `vendor/lib/occurrence.ts` (whose own header at `:1-25` warns the rule exists in
four places), `booker/services/schedules.service.ts:67-104`, `check_booking_placement()`
`:90-112`, and the vendor form's weekday picker.

**Fix approach:** adopt the §3 rule — **`booked_date` is the date the window opens** — and
change nothing else. A Friday 23:00–01:00 schedule runs on Fridays; its bookings are
Friday bookings. No copy needs new branching; each needs a comment stating the rule so the
next reader does not "fix" it.

> **Plain English:** a bar open Friday 11pm to 1am is running its *Friday* shift, even at
> half past midnight. We file the booking under Friday. That's it — and it happens to be
> how people already think about it.

**This is the item most likely to be under-estimated.** It is not cosmetic: it decides
which occurrence a booking consumes capacity from.

### B6 — The vendor's availability panel and the booker's Step 3 both assume one date  ✅ DONE (2026-08-28)

> ✅ **DONE (2026-08-28).** Both apps now read `window_minutes` and do their arithmetic on
> real instants.
> **Kept deliberately small:** `Schedule.end` / `BookerSchedule.endTime` survive as
> **derived display fields** (`windowEnd(start, windowMinutes)`, new in both `lib/slots.ts`).
> Renaming them instead would have dragged the form, the day panel and the calendar page
> into this stage and moved the visual baselines for a deploy that must not be risky. I1
> and I2 stay separate.
> **Changed:** vendor `lib/types.ts`, `services/schedules.service.ts` (row type, mapper,
> select, both writes via a new `windowMinutesFrom`, and `countBookingsOutsideWindow`
> rewritten off string comparison onto offsets + occurrence resolution),
> `lib/slotAvailability.ts` → `deriveSlots`; booker `lib/types.ts`,
> `services/schedules.service.ts` (row type, mapper, select, `getSlotsForDate`,
> `spanAvailable`, and **`getSlotOccupancy` now queries a TWO-day span** — a booking of a
> post-midnight slot carries the NEXT day's `booked_date`, so a single-date query would
> have missed exactly those and read every such slot as free), `remainingForSlot` keyed on
> epoch instants; plus five vendor and one booker fixture files.
> **Verified:** `tsc --noEmit` exit 0 both apps — and it earned its keep, listing all six
> fixture files that construct a `Schedule`, which is the compiler-enforced checklist D1
> was chosen for. Tests 271 / 19. Lint 35→35 and 23→23. `slots.ts` copies still identical.

**Files:** `vendor/lib/slotAvailability.ts:46,61` (`b.bookedDate === dateStr`, and the
`toMinutes` overlap at `:68-70`), `vendor/lib/utils.ts` (`getBkgsForDay`),
`vendor/services/schedules.service.ts:169-193` (`countBookingsOutsideWindow`, which
compares time strings), and `booker/services/schedules.service.ts:132-149,163-201`
(`getSlotsForDate`, `getSlotOccupancy`, `remainingForSlot`, `spanAvailable`).

**Fix approach:** the same substitution as B3, in TypeScript — compare
`Date`/epoch-millisecond values built from `(bookedDate, startTime)`, not
minutes-from-midnight. `remainingForSlot`'s occupancy map key must gain the date, since a
slot's identity is no longer "schedule + clock time".

**`countBookingsOutsideWindow` is user-facing and specifically wrong.**
`vendor/services/schedules.service.ts:188` does
`b.start_time.slice(0,5) < newStart || b.end_time.slice(0,5) > newEnd` — string comparison
on clock times. It powers the I12 warning *"N upcoming bookings fall outside the new
hours"*. Against an overnight window it reports confident nonsense in both directions:
every booking looks outside, or none does. It moves to the same offset comparison, and its
`newEnd` parameter becomes a window length.

⚠️ **COUPLING — `vendor/services/kiosk.service.ts`.**
`.plans/2026-08-26-vendor-kiosk-mode-and-offering-attachments.md` **I1** creates that file
as a **fifth** copy of the availability rule, porting the same four functions this item
rewrites (`getSlotOccupancy`, `remainingForSlot`, `spanAvailable`,
`resolveScheduleForTime`). If the kiosk plan executes first — which is the recommendation,
see *Sequencing against the kiosk plan* below — **this item's file list gains
`kiosk.service.ts` and its test**. The change is mechanical: the identical substitution
already being applied to booker's four equivalents. It must not be forgotten, because a
kiosk built on minutes-from-midnight will offer overnight slots the database refuses.

> **Plain English:** the screens that show "1 of 1 left" count bookings by clock time
> within a single day. An overnight booking is invisible to them. Count by real points in
> time and it appears where it should.

---

### B8 — The schedule form's Save button fires an INSERT per click  ✅ DONE (2026-08-28)

> ✅ **DONE (2026-08-28)** — `useSchedulePage.ts` gained `saving` state + a `savingRef`
> latch checked/set synchronously before the first `await`, with release in a `finally`
> (four exit paths: confirm cancelled, update failed, create failed, success).
> `SchedulePage.tsx` threads `saving` through; `ScheduleFormModal.tsx` applies
> `disabled={!canSave || saving}`, `aria-busy`, and keys the styling ternary off
> `canSave && !saving`. Cancel disabled too.
> **Verified:** `npx tsc --noEmit` exit 0; `npm test` 248/248 pass; `npm run lint` 35
> problems **both before and after** (stash-compared) — zero introduced.
> **Browser check ✅ confirmed by the user 2026-08-28:** three fast clicks produce exactly
> one row. The item is fully verified — machine and runtime. — *merged in from the duplicates plan, 2026-08-27*

**Files:** `vendor/components/schedule/ScheduleFormModal/ScheduleFormModal.tsx:276`
(`disabled={!canSave}` is the only disable condition), `:21` (`onSave` typed `=> void`, so
the modal cannot await it), `:55-70`; and
`vendor/components/schedule/SchedulePage/useSchedulePage.ts:121-151` — the real handler is
`async`, running an INSERT (`vendor/services/schedules.service.ts:79-105`) **and** a full
refetch (`:113`) before closing the modal at `:150`.

The modal stays mounted and the button stays live for two network round-trips. Every click
in that window is another INSERT. This produced three identical `court 1 rental` rows in
testing — the report that started all of this.

**Independent of the refactor.** It is client-only, touches none of B1–B6's files, and the
duplicate rows it creates are accumulating **now**. See D2.

**Fix approach:** an in-flight latch owned by `useSchedulePage`, passed to the modal as a
`saving` prop. Correctness comes from a `useRef` checked and set synchronously at the top
of the handler; the `useState` flag drives rendering only. Cancel disabled too — otherwise
the vendor dismisses the modal mid-INSERT and the row still lands.

**Acceptance criterion — genuinely unclickable, not merely styled so.** All three, and two
of the three do not satisfy it: (1) native `disabled` on the `<button>` for the whole
in-flight window — that is what suppresses the click event and drops the tab stop, and a
`cursor-not-allowed` class or an early `return` inside `onClick` is *not* this; (2) the ref
latch, so correctness does not rest on a render having committed; (3) the disabled styling
keys off the same effective condition, so it never *looks* available while inert. The
`clsx` ternary at `:276` currently keys off `canSave` alone and must key off
`canSave && !saving`.

**Existing pattern:** `usePayoutDetailsCard.ts:69,158,175-177` and
`PayoutDetailsCard.tsx:137-140`.

**Finding during execution (2026-08-28):** `app/ui-gallery/page.tsx:427,441` also renders
this modal as a static visual-test fixture. The new prop was therefore made **optional,
defaulting to `false`**, leaving the gallery byte-identical so vendor visual baselines do
not move for a change that fixture cannot exercise. `onSave` was widened to
`=> void | Promise<void>`; the gallery's `noop` still satisfies it.

**component-separation:** no new component; the `.tsx` gains a `saving: boolean` prop
consumed in existing expressions. `onSave` becomes `=> void | Promise<void>`.

### B9 — `schedules` has no uniqueness guard  ✅ DONE (2026-08-28) — *written, not applied*

> ✅ **WRITTEN AND LOCALLY VERIFIED (2026-08-28)** as
> `20260828000003_schedules_no_duplicate_rule.sql`, keyed on **`window_minutes`** per B1 —
> the pre-refactor draft named `end_time`, which no longer exists. Re-verified against the
> post-refactor column list as the item required.
>
> **The coupled batch shipped together, as specified:** the index, the `23505` mapping
> (`duplicateRuleMessage` in `vendor/services/schedules.service.ts`, applied to **both**
> create and update — the earlier draft named only create, but an edit can collide too),
> and both doc amendments (`architecture/schema.md` now documents the index under
> `schedules`; `vendor/lib/offeringSchedules.ts` no longer claims there is no unique
> constraint, while keeping its "an offering may have many *different* schedules" point,
> which the index does not affect).
>
> **Verified locally (applied, rolled back), four behaviours:** the index builds against
> real rows; a byte-identical active rule is refused with `23505` **even when the title
> differs** — the D1a decision, proven rather than assumed; a rule differing only in
> `window_minutes` is still allowed; an **inactive** duplicate is allowed, confirming the
> partial `WHERE is_active` predicate.
> `tsc` exit 0 · 271 tests · lint 35→35.
> ⬜ **Not applied anywhere** — user pushes it, and the duplicate pre-flight must return 0
> on each environment first.

**File:** `20260507000002_schedules.sql:18-40`; the deliberate-absence note at
`vendor/lib/offeringSchedules.ts:5-9`.

B8's latch lives in one browser tab. It does not cover a second tab, a retry after a flaky
response, or a second device. Two identical active rules are never meaningful: they derive
the same slots (the booker dedupes them to one) while giving the placement trigger two
separate capacity buckets — which is how the same hour gets sold twice.

**⚠️ Changed by this plan's B1.** The index key drafted in the duplicates plan named
`end_time`. Under `window_minutes` (D1) it must name that column instead:

```sql
create unique index schedules_no_duplicate_rule
  on public.schedules (
    vendor_id, offering_id, staff_id,
    start_date, end_date, start_time, window_minutes,
    days_of_week, recurrence
  )
  nulls not distinct
  where is_active;
```

`title` and `capacity_per_slot` stay **out** of the key: `title` is documented as a display
label (`architecture/schema.md:558`) and carries no scheduling semantics, so including it
would let the same rule exist twice under two names. `staff_id` stays **in** — a different
person delivering the same window is a genuinely different rule.

**Verified 2026-08-27** in a rolled-back transaction, against the *pre-refactor* column
list: the index built cleanly, and a byte-identical active row raised `23505` with
`end_date` shown as `null` in the key — confirming `nulls not distinct` handles the
nullable columns, and that it rejects a duplicate **even when the title differs**. The
column swap to `window_minutes` does not change that behaviour, but **re-verify after B1**.

**Coupling — must ship together:** the index, the `23505` mapping in `createSchedule`
(`vendor/services/schedules.service.ts:103` currently surfaces `error.message` raw, so a
rejected duplicate would show a Postgres string — map it as `deleteSchedule` already maps
`23503` at `:136`), and the `architecture/schema.md:549` +
`vendor/lib/offeringSchedules.ts:5-9` amendments, both of which currently record the
*absence* of uniqueness as deliberate.

**Blast radius:** validates every existing row at creation, so it **fails outright while
duplicates exist** — B10 first. `ACCESS EXCLUSIVE` on a small table for a single index
build. No type regen (hand-written interfaces). Reversible with `drop index`.

### B10 — Duplicate rows already exist in the tester's environment  ✅ DONE (2026-08-28) — *merged in, 2026-08-27*

> ✅ **DONE (2026-08-28)** — user-run across all three environments.
> **local:** Q1 returned no groups — nothing to clean.
> **production:** Q1 returned no groups, as predicted (no approved vendors → no offerings
> → no schedules). Confirmed rather than assumed.
> **staging:** one group of 3 (the `court 1 rental` rows from the original report). The
> booking-safety guard returned nothing and all three showed `live_bookings = 0`, so Q3 ran:
> two rows deactivated, one survivor.
> **Verified:** Q4 returned `0` on staging, and the two retired rows show `is_active =
> false` with a same-day `updated_at`. Local and production need no Q4 — an empty Q1 *is*
> the Q4 condition.
> **Note for later stages:** the Supabase SQL editor reports "Success. No rows returned"
> for any statement without `RETURNING`, which is not a row count. Expect the same message
> on Migration A's backfill; use `RETURNING` or a follow-up `select` when the count matters.

`bookings.schedule_id` is `ON DELETE RESTRICT` (`20260507000004_bookings.sql:23`), so a
duplicate holding a booking cannot be deleted, and the vendor UI offers no deactivate
control. Hence SQL, and `is_active = false` rather than `DELETE`. Deactivating is safe for
bookings the row holds: `check_booking_placement()` is INSERT-only and a booking snapshots
its own span rather than joining `schedules` (`architecture/schema.md:639,647`).

**Run this BEFORE B1's migration**, while the columns are still `start_time`/`end_time` —
that is the form in which all four statements were verified.

**All four were executed on the local DB 2026-08-27 inside a transaction that seeded two
synthetic duplicates and was then rolled back.** Q1 found the group, Q3 deactivated exactly
the right two rows, Q4 returned 0. Nothing was applied.

**Q1 — which groups exist:**
```sql
select vendor_id, offering_id, staff_id, start_date, end_date,
       start_time, end_time, days_of_week, recurrence,
       count(*) as copies, array_agg(id order by created_at) as schedule_ids
from public.schedules
where is_active
group by vendor_id, offering_id, staff_id, start_date, end_date,
         start_time, end_time, days_of_week, recurrence
having count(*) > 1;
```

**Q2 — how live bookings are spread inside each group. Read this before running Q3:**
```sql
with dupes as (
  select id, created_at,
         dense_rank() over (order by vendor_id, offering_id, staff_id, start_date,
                                     end_date, start_time, end_time, days_of_week, recurrence) as grp,
         count(*) over (partition by vendor_id, offering_id, staff_id, start_date,
                                     end_date, start_time, end_time, days_of_week, recurrence) as copies
  from public.schedules where is_active
)
select d.grp, d.id, d.created_at,
       count(b.id) filter (where b.status not in ('cancelled','refunded')) as live_bookings
from dupes d
left join public.bookings b on b.schedule_id = d.id
where d.copies > 1
group by d.grp, d.id, d.created_at
order by d.grp, live_bookings desc, d.created_at;
```

⚠️ **If any group shows live bookings on more than one row, stop.** Q3 keeps one row per
group, so the other row's bookings would vanish from the vendor's day panel, which renders
active schedules only. That needs a human decision, not a scripted cleanup.

**Q3 — deactivate the redundant copies.** Keeps the row holding the most live bookings,
tie-broken by oldest, so cleanup never hides a booked schedule in favour of an empty one:
```sql
with live as (
  select s.id,
         count(b.id) filter (where b.status not in ('cancelled','refunded')) as live_bookings
  from public.schedules s
  left join public.bookings b on b.schedule_id = s.id
  where s.is_active
  group by s.id
),
ranked as (
  select s.id,
         row_number() over (
           partition by s.vendor_id, s.offering_id, s.staff_id, s.start_date,
                        s.end_date, s.start_time, s.end_time, s.days_of_week, s.recurrence
           order by l.live_bookings desc, s.created_at, s.id
         ) as rn
  from public.schedules s
  join live l on l.id = s.id
  where s.is_active
)
update public.schedules s
   set is_active = false
  from ranked r
 where s.id = r.id and r.rn > 1;
```

`partition by` treats NULLs as equal, which is what makes this agree with B9's
`nulls not distinct` index. Keep the two column lists matching.

**Q4 — must return 0 before B9 is applied:**
```sql
select count(*) as remaining_groups from (
  select 1 from public.schedules where is_active
  group by vendor_id, offering_id, staff_id, start_date, end_date,
           start_time, end_time, days_of_week, recurrence
  having count(*) > 1) t;
```

**This plan does not run any of the above, on any environment.**

---

### B11 — `seed.sql` and `demo-seed.sql` insert `end_time`  ✅ DONE (2026-08-28) — *gap review 2026-08-27*

> ✅ **DONE (2026-08-28)** — 8 window pairs in `seed.sql` converted to lengths
> (`'09:00', '11:00'` → `'09:00', 120`) plus its date-granular row's comment, and
> `demo-seed.sql`'s four windows converted to `array[720, 480, 180, 540]`.
> Done in the EXPAND migration rather than the contract one, and safe in both states: under
> Migration A the sync trigger derives `end_time` from `window_minutes`, and after Migration
> B the column is stored directly. **Not touched:** `demo-seed.sql:306`, which is the
> `bookings` insert — that table keeps its `end_time`.
> **Verified 2026-08-28 (user-run, local):** `npx supabase migration up --local` — which
> exercises the backfill against real rows, the thing a reset cannot do — then
> `npx supabase db reset`. Both passed. Post-reset state confirmed: every seeded
> time-granular schedule stores `window_minutes` with `end_time` correctly derived by the
> sync trigger (`start_time + window_minutes = end_time` on all rows), the date-granular
> row has both NULL, and `20260828000001` is recorded in `schema_migrations`.
> Also confirmed: the four `20260826*` kiosk migrations are off the branch, so `db push`
> will send this migration alone.

**Files:** `backbone/supabase/seed.sql:539-540, 573-574, 593-594, 622-624` (four schedule
inserts, one of them the deliberately date-granular row at `:614`) and
`backbone/supabase/demo/demo-seed.sql:239-241, 304`.

`db reset` runs every migration from empty **and then `seed.sql`**
(`architecture/database-reset-and-deploy.md:206`). Seed runs *after* the migration that
drops the column, so it fails on a column that no longer exists — taking the entire local
reset with it, for every developer, immediately.

**This repo has been bitten by exactly this class before:** the kiosk plan's gap review
records `G2 | seed.sql's three bookings inserts supply no start_time → db reset breaks at
Stage 3`. It was found there by a gap review, not by the original plan, which is precisely
why it is written down here.

**Not a risk for the historical migrations.** `20260803000002/3/4/5` also reference
`schedules.end_time`, but they run *before* this plan's migration in timestamp order, so
the column still exists when they execute. **Do not "fix" them** — editing an applied
migration is forbidden (AGENTS.md) and would be wrong anyway.

**Fix approach:** update the four `seed.sql` inserts and the two in `demo-seed.sql` to
supply `window_minutes` instead of `end_time`. The date-granular seed row at `seed.sql:614`
already passes NULL for both times and needs `window_minutes` NULL too — it is the row that
proves `schedules_window_shape` accepts the date-granular shape.

**Coupling:** ships in the **same batch** as B1. A migration that lands without the seed
update leaves `db reset` broken on every machine.

---

### B12 — Post-midnight slots become unreachable at midnight  ✅ DONE (2026-08-28)

> ✅ **DONE (2026-08-28)**, all three requirements met:
> **(1) One cutoff.** `earliestSelectableDate(schedules, now)` exported from the booker
> service, consumed by `getAvailableDaysInMonth`, and handed to the render layer through
> the hook as `earliestDate` so `Step3Schedule.tsx` makes no date comparison of its own.
> **(2) Month boundary.** `isPastMo` keys off `earliest`, not `today`.
> **(3) Past slots filtered** in the hook's `slots` memo via a new `slotInstant()`, which is
> the inverse of the trigger's occurrence resolution and must stay in step with it.
> **Finding — the lint caught a real defect, not a style nit.** The filter first used
> `Date.now()` inside a `useMemo`: impure during render, and the memo would never
> recompute, so a slot expiring while the page sat open stayed on offer. Replaced with a
> `now` state ticking every 60s, which makes expiry actually happen.
> **Accepted behaviour change, as the item predicted:** already-passed slots now disappear
> from the current day too. That closes a pre-existing gap — nothing filtered past times
> within today before.
> **Verified:** type-check, tests, lint parity.
> ⬜ **The three live scenarios (Sat 00:10, the month boundary, the fully-expired window)
> need a browser AND overnight test data.** Migration B is not sufficient on its own: the
> vendor form still refuses `end <= start` (`useScheduleForm.ts:132`), so **no overnight
> schedule can be created through the UI until I2 ships in stage 6**. Until then the only
> way to produce one is a direct SQL insert, which exercises the READ path (day panel,
> booker slot grid) but not the write path. **Verify these properly after stage 6.**

**Files:**
- `booker/services/schedules.service.ts:113-119` — `const today = new Date(); today.setHours(0,0,0,0)` … `if (date < today) continue`, in `getAvailableDaysInMonth`.
- `booker/components/booking/steps/Step3Schedule/Step3Schedule.tsx:39` (`isPast`), `:43` (`pickDay` returns early), `:76` (`off`), `:78` (opacity `0.25`), `:80` (the availability dot).
- `Step3Schedule.tsx:40` (`isPastMo`) — disables backward month navigation.

A Friday `22:00 + 240min` schedule offers `22:00, 23:00, 00:00 (+1), 01:00 (+1)`, all under
**Friday** (§3's rule). The booker excludes any date earlier than today's midnight and
makes it unclickable. So at **Saturday 00:10** a customer wanting the **01:00 slot — fifty
minutes away and plainly in the future** — cannot reach it: the slot lives under Friday,
and Friday is now "past".

⚠️ **This defect is introduced by this plan.** It cannot occur today, because overnight
windows cannot exist. It is not a pre-existing issue this plan inherits — it is one the
refactor creates, which is why it is a blocker rather than a follow-up. For a late-night
venue the unreachable period is exactly when walk-up bookings happen.

**Fix approach (option (a), chosen 2026-08-28 — see D4):** make the cutoff **span-aware
instead of date-based**. A day stays selectable while any slot of its occurrences still
lies in the future, rather than being cut off at its own midnight.

**Three things the implementation must get right — each is a way to satisfy the sentence
above and still be wrong:**

1. **One cutoff, computed once, used by every filter.** Derive *the earliest date the
   calendar may still offer* and use it for `getAvailableDaysInMonth`, `isPast` **and**
   `isPastMo`. Leaving `isPast` to make its own date comparison reintroduces the bug in the
   component after the service is fixed.
2. **The month boundary is a real case, not a curiosity.** At **Saturday 1 August 00:10**,
   the live slot belongs to **Friday 31 July** — the *previous month*. `isPastMo`
   (`:40`) disables the ‹ button whenever `calMonth <= today.getMonth()`, so without this,
   option (a) still fails on the first of every month. The single cutoff from (1) is what
   makes `isPastMo` correct too.
3. **Slots whose start has already passed must stop being offered.** Without this, (a)
   delivers a Friday cell that still lists `22:00` at 00:10 on Saturday — visibly broken,
   and it would read as a bug in the fix. Filter on slot start vs now in
   `useStep3Schedule`'s `slotViews`.

**Note the side effect of (3), deliberately accepted:** the booker does not filter past
times *within today* either (`getSlotsForDate` has no time comparison at all), so today a
customer at 23:30 is still offered today's 09:00 slot. Fixing (3) closes that too. It is a
pre-existing gap and not this plan's to chase, but it cannot be left alone here — (a) is
incoherent without it. Expect the visible change that **already-passed slots stop
appearing on the current day**, which is an improvement but *is* a behaviour change.

**component-separation:** the cutoff and the slot filtering live in
`useStep3Schedule`/the service; `Step3Schedule.tsx` keeps consuming `availableDays` and
`slotViews` as it does now. No logic moves into the render layer.

---

## IMPORTANT

### I1 — A window that ends tomorrow must say so on screen  ✅ DONE (2026-08-28)

> ✅ **DONE (2026-08-28).** New `vendor/lib/scheduleWindow.ts` — `formatWindow`,
> `crossesMidnight`, `formatWindowLength` and `formatScheduleWhen` — with 17 tests.
> `DayDetailPanel` and `CalendarPage` both call `formatScheduleWhen`; the duplicated
> inline formatting is gone, which is what the item asked for.
> **Scope corrected on inspection:** the item listed `BookingRow`, `BookingCard` and
> `BookingDetailModal` too. Those render **only `bookedDate · startTime`** — no end time
> at all — so there is nothing for a `(+1)` to mark. Adding an end would be new UI, not
> this item's job, and a booking's start is unambiguous on its own. **Deliberately left
> alone.**
> `24:00` is rendered unmarked: a window closing at midnight closes at the end of its OWN
> day, and `00:00 (+1)` would read as a different day entirely.

**Files:** `vendor/components/schedule/DayDetailPanel/DayDetailPanel.tsx:17-23`
(`scheduleWhen`), **`vendor/components/calendar/CalendarPage/CalendarPage.tsx:97`**,
`vendor/components/bookings/BookingRow/BookingRow.tsx`,
`booker/components/dashboard/BookingCard/BookingCard.tsx` and `BookingDetailModal.tsx`.

⚠️ **`CalendarPage.tsx:97` was missed until the gap review (2026-08-27).** Vendor has
**two** surfaces that render a schedule window — the Schedule page's day panel *and* a
separate Calendar page — and that line renders `${schedule.time} – ${schedule.end}` inline.
Once `end` is derived rather than stored it needs the same treatment as `scheduleWhen`,
which is an argument for putting the formatter in `vendor/lib/` and having both call it
rather than each formatting inline.

`23:00 – 01:00` with no further marking reads as a data-entry error to a human, which is
precisely why the original CHECK looked reasonable.

**Fix approach:** render the next-day end with an explicit marker — `23:00 – 01:00 (+1)` —
defined once per app beside the other formatters. Display-only; no hook needed, matching
the existing note on `scheduleWhen`.

> **Plain English:** write it the way transport timetables do, so nobody thinks it is a
> typo.

**ux-design:** §5 — the `(+1)` is a text affordance, not colour or position, so it
survives a screen reader and a monochrome print.

### I2 — The vendor form must let a window run past midnight  ✅ DONE (2026-08-28)

> ✅ **DONE (2026-08-28).** `useScheduleForm.ts` — the `sfEnd <= sfTime` blocker is
> **removed, not relaxed**: an end reading earlier than the start is now how an overnight
> window is expressed. Slots derive via `deriveSlots(sfTime, windowLength(sfTime, sfEnd), …)`,
> the same `windowLength` the write path uses, so the preview cannot disagree with what is
> stored.
> **Replacing the guard with something better, not nothing:** a `windowSummary` line renders
> what the vendor just described — *"Runs overnight: 23:00 – 01:00 (+1) · 2 hours"* —
> highlighted when it crosses midnight. Removing the rule means a mistyped end silently
> becomes a 23-hour window; this is what makes the interpretation visible at the moment of
> typing. Equal start and end is a legal 24 hours and says so rather than being guessed at.
> **component-separation:** all logic in the hook; the modal renders a string and a boolean.

**File:** `vendor/components/schedule/ScheduleFormModal/useScheduleForm.ts:130-135` —
`sfEnd <= sfTime ? "End time must be after the start time."`

**Fix approach:** the blocker becomes a window-length check, and the form shows the
derived end with I1's `(+1)` marker as the vendor types. `SlotPreview` needs no change: it
consumes `SlotBreakdown`, which B4 keeps shaped as it is.

**component-separation:** all of it lives in `useScheduleForm`; the modal renders the
derived string. No state or logic moves into the `.tsx`.

### I3 — The documentation states the midnight rule as an invariant in three places  ✅ DONE (2026-08-28)

> ✅ **DONE (2026-08-28)** — `architecture/schema.md`: the `end_time` column row replaced
> with `window_minutes`; `:600`'s "may not cross midnight" paragraph rewritten to record
> that the rule was never a product decision but an inherited sanity check, and why the cap
> at 1440 is a correctness property; `:641`'s wrap note rewritten to say the wrap is now
> *unreachable* rather than avoided; and a new paragraph on `booked_date` vs the occurrence.
> **Not yet done:** `architecture/booking-flow.md`, which describes the booker's Step 3 —
> deferred to stage 5, when that code actually changes, so the doc and the code move
> together.

**Files:** `architecture/schema.md:600` ("A window may not cross midnight … load-bearing")
and `:641` (the `time + interval` wrap note); `architecture/booking-flow.md`;
`20260803000002`'s column comment on `end_time`.

**Coupling:** ships with B1/B3. Leaving these in place would have the project's own source
of truth contradicting the schema — the same coupling the duplicates plan records for its
B3.

---

### I4 — A save gives no feedback, which is *why* the button was clicked three times  ✅ DONE (2026-08-28) — *merged in, 2026-08-27*

> ✅ **DONE (2026-08-28)** — label swaps to `"Saving…"`, `aria-busy={saving}`, Cancel
> inert, and `toast.success("Schedule created." / "Schedule updated.")` on success
> (`isEdit` captured before the branch clears `editSched`). No spinner, per D4.
> **Verified:** type-check, tests, lint parity as above.
> **Browser check ✅ confirmed by the user 2026-08-28:** label, toast and both themes
> render correctly. The item is fully verified.

**File:** `vendor/components/schedule/SchedulePage/useSchedulePage.ts:141-151`, rendered at
`ScheduleFormModal.tsx:275-278`.

`toast.error` fires on failure; there is no `toast.success`, no pending state, and the
modal waits for a full refetch before closing. A successful save looks identical to a dead
button for one to two seconds on a remote Supabase. B8 is the defect; this is what made a
human produce three of them.

**Feedback is a text label, not a spinner** — the user considered a spinner and reversed
that on 2026-08-27. `disabled={!canSave || saving}`, `aria-busy={saving}`, label swaps to
`"Saving…"`, Cancel disabled, `toast.success` on create and update. Pattern:
`PayoutDetailsCard.tsx:137-140`, `DeletionRequestModal.tsx:181`.

**The label does not prevent the second click — B8's latch does.** The label only explains
why nothing is happening. Shipping it without B8 would animate while duplicates were
created.

**component-separation:** render layer only; `saving` arrives as a prop.

### I5 — The form never checks a new schedule against the ones that already exist  ✅ DONE (2026-08-28)

> ✅ **DONE (2026-08-28).** New `vendor/lib/scheduleConflicts.ts` returning a
> discriminated `{ kind: "none" | "identical" | "overlap" }`, with
> `vendor/lib/scheduleConflicts.test.ts` (15 cases). Wired through
> `SchedulePage → ScheduleFormModal → useScheduleForm`; **identical** joins `saveBlocker`,
> **overlap** renders as a separate amber advisory that does not block — D2 option (c).
> **Identity fields mirror `schedules_no_duplicate_rule` exactly**, and the tests pin the
> two that are easy to get wrong: a rule differing ONLY in title, and one differing only in
> capacity, are both still "identical" (D1a), while a different `staff_id` is not.
> `editSched.id` is excluded, so an unchanged edit stays saveable.
> **Overnight is covered, not assumed:** a Fri `23:00+120` window is detected as
> overlapping a Sat `00:00` one, and a Sun `23:00` window wrapping past the end of the
> week overlaps a Monday morning schedule — the circular-week case a minutes-from-midnight
> implementation cannot see.
> **Stated approximation:** recurrence PHASE is ignored, so two biweekly schedules on
> alternate weeks warn although they never co-occur. Safe direction for a warning, and
> documented in the module header rather than left to be discovered.
> **Refactor taken along the way:** `windowLength()` moved from a private function in
> `schedules.service.ts` into both `lib/slots.ts` copies — the write path and the conflict
> check need the identical wrap rule, and a wrap rule duplicated is one that drifts.
> **Verified:** `tsc` exit 0 both apps · vendor 286 tests (was 271) · booker 19 · lint
> 35→35 and 23→23 · `slots.ts` copies still identical.
> ⬜ **Not verified:** the advisory's appearance on screen and in both themes — needs a
> browser.

**Files:** `vendor/components/schedule/ScheduleFormModal/useScheduleForm.ts:123-137`
(`saveBlocker` validates the form against itself only) and `useSchedulePage.ts:143-146`
(create is unconditional).

Stops B9's condition being created at all, and turns a raw `23505` into a warning *before*
Save rather than an error after.

**Fix approach:** a pure helper in `vendor/lib/`, unit-tested, following the
`offeringSchedules.ts` pattern (own module because `node --test` has no bundler and cannot
resolve `@/`; `import type … from "./types.ts"` **with** the extension — dropping the
`type` keyword there breaks the entire `lib/` suite with an error that looks nothing like
its cause). Returns a discriminated result, not a boolean:

- **identical** → `saveBlocker` refuses. Its identity fields **must** match B9's index
  exactly, or the form permits a row the DB then rejects.
- **overlapping but not identical** → advisory line naming the schedule it overlaps; save
  proceeds.

Excluding `editSched.id` from the comparison is load-bearing, or editing a schedule
reports it as a duplicate of itself.

**⚠️ Changed by this plan's B4/B6.** The overlap test must be written in the **new** model
— offsets from the window start, compared as real points in time — not minutes from
midnight. A `23:00–01:00` window overlaps a `00:00–01:00` one on the following day, and a
minutes-from-midnight implementation cannot see it. This is the item the pre-refactor
version of this plan would have got wrong.

---

### F2 — CalendarPage rendered the literal text "null - null" for date-granular schedules  ✅ DONE (2026-08-28) — *found by the visual suite during stage 6*

**File:** `vendor/components/calendar/CalendarPage/CalendarPage.tsx:97`, which formatted
every schedule as `${time} – ${end}`. A date-granular schedule has neither, so the page
showed vendors **`null - null`**.

**Pre-existing, and shipped.** `DayDetailPanel`'s `scheduleWhen` had already learned this —
its own comment records that `null` "used to render as an empty gap here — legal JSX, and
therefore invisible to the type-checker and to every screenshot." The Calendar page never
got the same treatment, and the visual baseline had the wrong text **recorded in it**, so
the suite defended the bug instead of catching it.

Found because I1's change to that line moved 1027 pixels and the diff had to be read.
Fixed properly by extracting the whole rule — window, date range, open-ended — into
`formatScheduleWhen`, so both surfaces share one implementation rather than two inline
ones. Covered by a test asserting the date-granular case renders a range, "never
'null - null'".

**Baseline updated** (`calendar-day-chromium-linux.png`) — 1 of 82, verified by `git status`
before and a clean 158-pass run after.

---

### F1 — `booker` had no unit-test runner at all  ✅ DONE (2026-08-28) — *found during stage 2*

This plan's verification table promised `npm --prefix booker test`. **That script did not
exist**, and `booker/lib/` held no `*.test.ts` — the app's only automated coverage was
Playwright visual tests. The claim was wrong when it was written.

Fixed during stage 2, because `booker/lib/slots.ts` is the arithmetic deciding whether the
booker offers slots the database will refuse, and shipping that on the strength of a `diff`
against a *different repository* is thin — AGENTS.md forbids cross-app imports precisely
because these can drift.

- `booker/package.json` — added `"test": "node --test --experimental-strip-types \"lib/**/*.test.ts\""`,
  identical to vendor's. **No new dependency**: `node --test` is built in, so no approval
  gate was tripped.
- `booker/lib/slots.test.ts` — the vendor suite mirrored.
- `booker/tsconfig.json` — added `allowImportingTsExtensions: true`, carrying vendor's own
  comment. Required because `--experimental-strip-types` needs the `.ts` extension in
  imports; without it `tsc --noEmit` failed with `TS5097`. The two tsconfigs were otherwise
  byte-identical, so this closes a real divergence rather than inventing a setting.

**Verified:** `npm --prefix booker test` → 19 pass; `tsc --noEmit` exit 0; lint 23 → 23.

---

## Options considered and rejected

| Option | Verdict |
|---|---|
| **Drop the CHECK; let `end_time <= start_time` mean "next day"** | ✖ **Rejected.** The cheapest edit and the worst outcome. It removes the guard while leaving the arithmetic that needed guarding, so the inverted-range bug goes from *impossible by construction* to *live in six places*, policed by discipline across two slot libraries, four occurrence copies and two triggers. It optimises for a small diff over a safe one. |
| **Add a `crosses_midnight` boolean** | ✖ **Rejected.** A flag that must agree with the times is a second source of truth, and nothing stops them disagreeing. It also forces a column onto the duplicates plan's unique index (that plan's O5 note) for no benefit `window_minutes` does not already give. |
| **Move `bookings` to `tstzrange` with an exclusion constraint** | ⏸ **Not now — but the right long-term shape.** It would let Postgres enforce non-overlap natively and would also address the per-schedule capacity-bucket flaw (duplicates plan B2). Rejected for this plan on scope: it rewrites the span-pinning logic, the unique index, and every read across three apps, and exclusion constraints do not express "capacity N" without extra work. Revisit if B2's own plan goes ahead. |
| **Keep windows same-day; let bookings overrun the end** | ✖ **Rejected.** The window *is* the advertised availability. A vendor open until 01:00 must be able to say so; overrunning bookings would sell hours the schedule never offered. |

---

## DECISIONS

<!-- No item may execute while any OPEN: line remains. -->

- **D1 — Store `window_minutes`, or keep `end_time` and infer the day?** →
  **`window_minutes`** (resolved 2026-08-27). Makes the broken state unrepresentable
  rather than merely forbidden — the philosophy the codebase already applies
  (`20260803000004:97`, *"the wrap is impossible by construction"*). The rejected
  alternative left an implicit `end <= start means tomorrow` rule to be re-derived
  correctly in six places (two slot libraries, four occurrence copies, two triggers);
  missing one inverts a range and makes the capacity check pass everything.
- **D2 — Does the save-button work fold into this plan?** → **Merged into this document
  as B8 + I4, but sequenced FIRST and shipped on its own** (resolved 2026-08-27). The user
  chose the refactor over an interim fix and asked for the duplicates work to live here.
  Folding the *document* in is right — one source of truth. Folding the *schedule* in is
  not: B8 is client-only, touches none of B1–B6's files, and fixes a defect creating
  duplicate rows now, while this plan may not be scheduled for weeks. Hence stage 0.
- **D3 — Cap a single window at 24 hours?** → **Yes, `window_minutes <= 1440`**
  (resolved 2026-08-27). Keeps each slot's clock time unique within its window, so slot
  identity stays "schedule + clock time" and no display or occupancy key has to carry the
  day. A vendor open longer uses consecutive daily windows. Lifting the cap later is a
  constraint change, not a redesign.

- **D4 — A Friday 22:00–02:00 window's post-midnight slots hang off Friday. What happens
  when Friday itself becomes "past"?** → **Option (a): make the cutoff span-aware**
  (resolved 2026-08-28). Confirmed first that this is *only* about how an overnight window
  is presented — it places **no** restriction on a vendor creating an ordinary
  "Saturdays 00:30–02:30" schedule, which is a same-day window and untouched.
  Rejected: *(b) also surface post-midnight slots under the following day* — one slot
  reachable from two dates, complicating occupancy keys in B6, and it would not remove the
  need for (a) anyway; *(c) accept it* — leaves a future slot unbookable, which is a
  feature regression the refactor itself introduces. Implemented as **B12**.

- **D5 — How does B1 reach hosted without breaking the deployed apps?** →
  **(ii) expand / contract, two migrations** (resolved 2026-08-28).

  **Honest note on the rationale, so nobody later mistakes it for a safety requirement:**
  production currently holds signed-up vendors who are **not approved and have no
  offerings**, therefore **no schedules**. B1's backfill is a no-op there and option (i)
  would have carried near-zero risk. The user chose (ii) explicitly to practise the flow,
  which is a good reason — expand/contract is the technique this schema will need again,
  and rehearsing it while the stakes are nil is cheaper than learning it when they are not.

  **One safety benefit that is real even here:** staging *does* hold schedules, and
  expand/contract lets the backfill and the new code be verified against those rows
  **before anything is dropped**, with a one-line rollback (`drop column window_minutes`)
  if the backfill is wrong. Under (i) the same mistake is only discoverable after
  `end_time` is gone.

**No decision remains OPEN.**
---

## B7 — Items retired by this refactor  ✅ DONE (2026-08-28) — nothing was built, which was the point

The duplicates plan's **I4 — an "Ends at midnight" checkbox** — is ✖ **SUPERSEDED**
(2026-08-27). It existed to make `24:00` reachable so a vendor could express a full day, or
build the split-window workaround by hand. Under `window_minutes` (B1) a 24-hour window is
simply start `00:00`, window `1440`, and an overnight window is stated directly — so the
checkbox has nothing left to do. **Do not build it.**

The `24:00` values it would have written are still handled: `date + time '24:00'` resolves
to the next midnight (verified), so any such rows already in the database convert to
`window_minutes = 1440 − start` with no special case.

Also retired: the **split-window workaround** (formerly O3 — entering `22:00–24:00` plus
`00:00–02:00` on the following weekday). It was only ever a way to live without this
refactor. Vendors on it will have two schedules where one would now do; migrating them is
manual and not in scope, but worth telling them about.

Two findings are **not** retired and are tracked as P1 and P2 below, so they are not lost
in prose.

## PARKED — carried out of this plan, tracked so they are not lost

> Numbered P# to keep them distinct from this plan's own items. Both are `booker` scope,
> and AGENTS.md gates work touching more than one app — so neither belongs here.

### P1 — Two overlapping schedules on one offering are two independent capacity buckets  ⏸ PARKED (2026-08-28)

**Files:** `booker/services/schedules.service.ts` — `getSlotsForDate` dedupes contested
start times ("the first wins"); occupancy is fetched only for surviving slots;
`remainingForSlot` counts only the winning schedule. `check_booking_placement()` locks and
counts per `schedule_id`.

Two schedules whose windows overlap present the trigger with **two separate capacity
buckets for one physical slot**, so the same hour can be sold twice. This is not caused by
the overnight refactor and is not fixed by it.

**What this plan did do:** B9's unique index removes the *identical*-rule case entirely,
and I5 warns the vendor when a new schedule overlaps an existing one. Both reduce how often
the condition arises. Neither resolves it — a vendor may still dismiss the warning.

**Unblock condition:** its own `booker` plan. Direction: one capacity bucket per
*offering-slot* rather than per schedule — i.e. occupancy and the placement trigger keyed
on `(offering_id, booked_date, start_time)` — which is a booking-flow and trigger change,
not a tweak.

### P2 — The booker's schedule query has no deterministic order  ⏸ PARKED (2026-08-28)

**File:** `booker/services/schedules.service.ts:39-48` — the query has no `.order()`.

`getSlotsForDate`'s "the first wins" is only meaningful if "first" is stable. It is not:
which schedule owns a contested start time can differ between two loads of the same page.
That is what turns P1 from a latent modelling gap into an intermittent one.

**Unblock condition:** ships with P1's plan. Adding an `.order()` alone would make the
wrong answer merely *consistent*, which is not a fix and risks reading as one.

---

## Sequencing against the kiosk plan  (added 2026-08-27)

`.plans/2026-08-26-vendor-kiosk-mode-and-offering-attachments.md` is IN PROGRESS with four
migrations **written but not applied**. Verified 2026-08-27:

**At the database level the two plans do not touch.**

| | Kiosk | This plan |
|---|---|---|
| Tables | `offering_attachments`, `booking_acknowledgements` (new); `bookings.booked_via` (new column); `legal_acceptances`; storage policies | `schedules.window_minutes` / drops `end_time`; changes how `bookings.end_date` is populated |
| Functions | `pin_booking_origin()` (new), `validate_booking_status_transition()` (replaced) | `check_booking_consistency()`, `check_booking_placement()` (both rewritten) |

**Zero function overlap.** Trigger co-firing was checked: `bookings_pin_origin` is
`BEFORE UPDATE` (`20260826000003:70-71`) and `bookings_check_placement` is `BEFORE INSERT`,
so they never fire on the same statement. Neither kiosk migration references
`start_time`, `end_time`, `end_date`, `booked_date` or `schedule` — grepped, no matches.

**One ordering requirement:** this plan's migration must be dated **after**
`20260826000004`. Trivially satisfied by any 2026-08-28+ timestamp.

**The real coupling is app code, not schema** — kiosk I1's `kiosk.service.ts`. See B6.

**Recommendation: run the kiosk plan first.** Written-but-unapplied migrations are a
decaying asset — they drift from the schema they assume and from the plan that justifies
them, and the longer they sit the more likely someone applies them without the app code.
The cost of that order is bounded and mechanical (B6 gains one file). The reverse order
parks a half-finished feature behind a multi-week refactor whose stage 3 is the most
dangerous migration either plan contains.

### If the kiosk plan is parked to run this one first (user's stated intent, 2026-08-27)

- ⚠️ **Plain `git stash` will not move those migrations.** All four are **untracked**
  (`??`) in the `backbone` repo, and `git stash` only stashes tracked modifications.
  `git stash -u` would, but a stash is a poor home for reviewed, plan-backed work — the
  same fragility that applies to any untracked file. **Commit them on a branch in
  `backbone`** (currently on `feature/stability_work`) and switch away.
- **The working tree is not the real hazard — `supabase db push` is.** Push applies every
  migration missing from the remote history table
  (`architecture/database-reset-and-deploy.md:16`), so pushing this plan's migration while
  those four sit in the folder sends **all five**. The kiosk plan says "written, not
  applied" deliberately; leaving them in place quietly arms that.
- ⚠️ **Renumber the kiosk migrations when kiosk resumes.** Theirs are `20260826*`; this
  plan's will be `20260828*` or later. If this plan's migration reaches staging or
  production first, the kiosk files are then *older than the latest applied version* — the
  out-of-order case. They are unapplied, so renaming them to a later timestamp is free and
  lossless **now**, and awkward later.

**Two conditions on that recommendation:**
1. **Stage 0 of this plan (B8 + I4) ships first regardless.** Client-only, no migration,
   independent of both plans, and it stops duplicate schedule rows accumulating throughout
   whichever plan runs.
2. **The kiosk plan needs a matching coupling note on its I1** — §9 requires couplings on
   both sides. Not added unilaterally: that plan is another workstream's and IN PROGRESS.

---

## Deployment to hosted  (added 2026-08-28)

### ⚠️ B1 is a BREAKING change for the apps already deployed

Both live apps name `end_time` **explicitly** in their PostgREST select lists:
`vendor/services/schedules.service.ts:70` and `booker/services/schedules.service.ts:44`.
PostgREST validates a select list against its schema cache, so the moment `end_time` is
dropped, **every schedule query in both deployed apps fails** — the vendor Schedule page
and the booker's Step 3 go down together. The old build also *writes* `end_time`
(`schedules.service.ts:95,122`), which would leave `window_minutes` NULL on any row it
creates.

This is not a defect in the design; it is the ordinary cost of dropping a column under
live clients. **D5 resolved it as expand/contract**: `end_time` survives Migration A, both
app builds deploy against it, and only then does Migration B drop it. No deployed build is
ever pointed at a column that has gone.

### Step 0 — ALWAYS local first, for every migration

Before any hosted push:

```bash
cd backbone
npx supabase migration up --local   # applies to the local DB, WHICH HAS ROWS
npx supabase db reset               # then proves the seed files still work
```

Both, in that order, and neither substitutes for the other:

- `migration up --local` runs the migration against a database that already holds
  schedules and bookings. That is the only way a **backfill** (Migration A) or a **new
  CHECK validating existing rows** (Migration B) is genuinely exercised —
  `database-reset-and-deploy.md:219-220,236` records this as a known trap.
- `db reset` rebuilds from empty and then runs `seed.sql`, which is what catches a seed
  file still naming a dropped column.

It is also the cheapest place to click through the apps against the new schema before any
hosted environment sees it.

### Then the runbook — once for staging, then once for production

`backbone` is linked to **`backbone-staging`** (verified 2026-08-27). Production is a
separate linked target and a separate, deliberate pass. **Finish staging entirely before
starting production** — the point of having both is that staging fails first.

Per environment:

| Step | Command / action | Why |
|---|---|---|
| 1 | `npx supabase migration list --linked` | Read-only, seconds. `database-reset-and-deploy.md:38-47` records this contradicting two assumptions at once on 2026-08-02. |
| 2 | Confirm nothing unintended is pending | `db push` applies **every** missing migration. The four `20260826*` kiosk files must be off the branch. |
| 3 | **Run B10's cleanup** | ⚠️ Written against `start_time`/`end_time`. After Migration B those columns are gone and the SQL is invalid. Before, not after. |
| 4 | `npx supabase db push` → **Migration A** | Additive only. Deployed apps keep working; `end_time` still there. |
| 5 | Verify against real rows | `window_minutes` backfilled on every time-granular row; NULL on date-granular; old build still reads and writes normally. |
| 6 | **Deploy vendor + booker builds** | They now read/write `window_minutes`. The sync trigger keeps `end_time` correct meanwhile. |
| 7 | Verify the apps | Schedule page, booker Step 3, create and edit a schedule. Overnight is still refused here — expected, it arrives in step 8. |
| 8 | `npx supabase db push` → **Migration B** | Drops the sync trigger and `end_time`; adds the constraints. **Overnight becomes available at this point.** |
| 9 | Verify overnight end to end | Create `23:00 + 120`, book across midnight, confirm the second booking of a covered slot is refused. |

**Production notes.** It holds signed-up but unapproved vendors, **no offerings, therefore
no schedules** — so step 3 finds nothing, step 5's backfill touches nothing, and step 9 has
to create its own test data. The pass is fast and low-risk; run it anyway, in the same
order, because the habit is the point and because "no schedules" is an assumption worth
having step 1 confirm rather than trusting.

**Rollback.** After Migration A: `drop column window_minutes` — the old build never stopped
working, so nothing else unwinds. After Migration B: forward-only. Re-add `end_time`,
backfill it as `start_time + window_minutes`, restore the CHECK — lossless, because
`window_minutes` carries strictly more information than the column it replaced.

### The backfill only gets exercised on a database with rows

`database-reset-and-deploy.md:219-220,236` warns that a reset applies migrations to empty
tables, so backfills no-op and *"logic never exercised locally ships broken"*. B1 **is** a
backfill. Verify it with `npx supabase migration up --local` against a local database that
already holds schedules — and treat the staging push as the first real test of it.

---

## Execution order

All decisions are resolved (D1 `window_minutes`, D2 stage 0 first, D3 cap at 1440,
D4 span-aware cutoff), so the
gate is now execution approval rather than a pending answer. Cadence is one stage at a time
unless you ask otherwise.

0. ✅ **B8 + I4 — DONE 2026-08-28.** Machine-verified **and** browser-verified by the user.
   *(original rationale)* **ship immediately, ahead of everything.** Client-only, no migration, no
   dependency on the refactor, and it stops duplicate rows being created *while the rest of
   this plan is still being decided*. Blocking a working fix behind a multi-week migration
   would be the wrong trade.
1. ✅ **B10 — DONE 2026-08-28.** Staging cleaned (2 rows retired, Q4 = 0); local and
   production had no duplicates. Prerequisite for B9 satisfied.
2. ✅ **B4 + B5 — DONE 2026-08-28.** Machine-verified in both apps. Nothing user-visible
   changed; no caller moved.
3a. ✅ **DONE 2026-08-28 — B1 Migration A + B2 + B3 + B11 + I3** — *expand*. Schema addition, both trigger
   rewrites, **the seed files** and the docs, in one migration. Changes no behaviour and
   breaks no deployed build: `end_time` and its CHECK both survive. B11 moves with it
   because `db reset` runs seed after migrations.
3b. ✅ **DONE 2026-08-28 — B6 + B12, the app-layer readers.** ⚠️ **REORDERED 2026-08-28.** These sat at stage
   5, *after* the deploy and after Migration B. That was wrong and would have broken
   production: the deployed builds read `end_time`, so deploying at 3b would have shipped
   an unchanged build, and Migration B would then have dropped a column the live apps still
   select. The readers must switch **before** the deploy, not after it.
3c. ✅ **DONE 2026-08-28 — deployed to staging and production, both verified by the user.**
   *(original)* Deploy both app builds (vendor + booker), now reading `window_minutes`. Staging
   first, verify, then production. **This is a stage, not a footnote** — Migration B must
   not run until it is done and verified.
3d. 🔄 **B1 Migration B** — *contract*. **Applied LOCALLY 2026-08-28** (`migration up
   --local`); staging and production in progress.
   **Verified locally beyond the migration itself:** all four app query shapes still
   resolve against the post-drop schema — vendor `getSchedules`, booker
   `getSchedulesForVendor`, booker `getSlotOccupancy`, vendor
   `countBookingsOutsideWindow`. That was the one failure mode dropping `end_time` could
   cause: a service still naming it would 400 every schedule query. None does.
   ⬜ **Not verified:** a human loading the Schedule page and the booker against the final
   schema. The residual risk is a rendering bug, not a query failure — and overnight stays
   unreachable through the UI until I2 (stage 6), so Migration B enables a capability
   nothing can yet exercise. Drops the sync trigger, adds the two constraints,
   drops `end_time`. **This is the migration that turns overnight on.** Staging, verify,
   then production.
4. 🔄 **B9 — written and locally verified 2026-08-28; awaiting the user's push.** **coupled batch:** the unique index (keyed on `window_minutes`, per B1), the
   `23505` mapping, and the doc amendments. After 3d, because its key depends on B1's
   columns; after stage 1, because it cannot build while duplicates exist. **Re-verify the
   index against the post-refactor column list.**
5. ✅ **DONE 2026-08-28 — I5**, the conflict helper, written in the new model. After 4, so its identity fields
   can be copied from the shipped index rather than guessed.
6. ✅ **DONE 2026-08-28 — I1 + I2** — display and the vendor form. Last: until then there is nothing valid to
   show. **Expect vendor visual baselines to move** —
   `visual-tests/pilot.spec.ts` covers schedule screens and both the form and day panel
   change. Regenerate as the last act of this stage, not during it, or the diff hides a
   real regression.

**Direction is deliberate: the live bug first, then pure functions, then the DB, then the
UI.** The trigger is the authority on placement, so the encoding must settle before either
app previews slots — the reverse order means two apps advertising slots the database
refuses.

---

## Verification

The acceptance test is **not** "an overnight schedule saves".

| Item | Check | Kind |
|---|---|---|
| B3 | A 23:00 two-hour booking consumes capacity on **every** slot it covers, and a second booking for any of them is refused. Written as a failing test **before** the fix. | **needs a live environment** (DB) |
| B3 | The same-booker overlap test catches a 23:00–01:00 span against a 00:00–01:00 one. | **needs a live environment** |
| B4 | `npm --prefix vendor test` / `--prefix booker` — `23:00 + 120min` → two slots `[23:00, 00:00]`; `00:00–24:00` still → 24 slots ending `23:00` (protects duplicates-plan I4). | **machine-verifiable** |
| B5 | `vendor/lib/occurrence.test.ts` asserts the same fixture dates the booker uses — the existing guard against the four copies diverging. Extend with an overnight fixture. | **machine-verifiable** |
| B4/B5 | The two `lib/slots.ts` copies remain identical apart from their cross-reference comment (`diff`). | **machine-verifiable** |
| B1/B2 | Backfill leaves every existing row with `window_minutes = old end − old start`, and no row NULL where `start_time` is not. | **needs a live environment** |
| Regression | Date-granular booking flows unchanged end to end — the explicit requirement. | **needs a live environment** |
| B3 | **Multi-unit across midnight** — the stated use case: a 1-hour offering, quantity 2, starting 23:00 in a `23:00 + 120` window. Accepted, consumes BOTH covered slots, and a second booking of either is refused. | **needs a live environment** |
| B2 | A booking on the **last date** of a bounded schedule that ends after midnight is **accepted** — the regression named in B2. | **needs a live environment** |
| B11 | `npx supabase db reset` completes and seeds. The check that catches a dropped column the seed still names. | **needs a live environment** |
| B6 | `countBookingsOutsideWindow` returns a sane count when an overnight window is narrowed. | **needs a live environment** |
| B12 | ⚠️ All three B12 rows below need overnight data, which the vendor form cannot create until **I2 (stage 6)**. Insert a schedule by SQL to check the read path sooner; do the real pass after stage 6. | **blocked on I2** |
| B12 | With a Fri `22:00 + 240` schedule and the clock at **Sat 00:10**: Friday is still selectable, its `01:00` slot is offerable and bookable, and its `22:00`/`23:00` slots are **gone**. | **needs a live environment** |
| B12 | The month-boundary case: clock at **Sat 1 Aug 00:10**, live slot under **Fri 31 Jul** — backward month navigation is permitted and the slot is reachable. | **needs a live environment** |
| B12 | Once the whole window has passed (clock at Sat 02:30), Friday is no longer selectable. | **needs a live environment** |
| B8 | `npm --prefix vendor run build` + `lint`. Then, network throttled, three fast Save clicks on a new schedule must produce **exactly one row** — the acceptance criterion in §B8. | build **machine-verifiable**; the triple-click **needs a live environment** — a type-check cannot see a race |
| I4 | Label reads "Saving…" for the whole in-flight window; Save and Cancel both inert *and* styled inert; success toast fires once; both themes; `aria-busy` present. | **needs a live environment** |
| I5 | `npm --prefix vendor test` — new `lib/scheduleConflicts.test.ts`: exact duplicate, overlap, adjacent-not-overlapping, **an overnight window overlapping the next morning**, different weekdays, different offering, different `staff_id`, date-granular rows, edit-mode self-exclusion. | **machine-verifiable** |
| B10 | Q4 returns 0; Q2 re-run shows no group with live bookings on more than one row. | **needs a live environment** (user-run) |
| B9 | Applies to a database that has been through B10; a deliberate duplicate INSERT raises `23505` and the vendor sees the mapped message, not the Postgres string. | **needs a live environment** (user-run) |

⚠️ **`db reset` will NOT test B1's backfill.** `architecture/database-reset-and-deploy.md:219-220,236`
records this as a known trap: *"reset applies migrations to empty tables, so they no-op …
logic never exercised locally ships broken"*. B1 contains a backfill over every existing
row. Verify it with **`npx supabase migration up --local`** against a database that already
holds schedules — a reset proves only that the SQL parses.

⚠️ A passing build proves nothing here. B3's whole claim is about what the database
refuses, and only the database can answer it.
