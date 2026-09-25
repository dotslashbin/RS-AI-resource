> # ✖ SUPERSEDED — DO NOT WORK FROM THIS FILE
>
> **Superseded 2026-08-27** by `.plans/2026-08-27-overnight-schedule-windows.md`, after
> the decision to fix the midnight limitation with a refactor rather than an interim
> workaround.
>
> | This plan | Where it went |
> |---|---|
> | B1 (double-submit) | overnight **B8** — sequenced FIRST, ships on its own |
> | I1 (save feedback) | overnight **I4** |
> | I2 (duplicate/overlap check) | overnight **I5** — rewritten for the new window model |
> | B3 (unique index) | overnight **B9** — key now uses `window_minutes` |
> | B4 (cleanup SQL) | overnight **B10** — verified SQL carried over verbatim |
> | I4 ("Ends at midnight") | ✖ **retired** — the refactor makes it unnecessary (overnight B7) |
> | B2 / I3 (booker) | still parked for their own `booker` plan |
>
> Kept only as the record of the original investigation. Nothing here is scheduled.

# Vendor — Duplicate Schedules on the Schedule Page

**Date:** 2026-08-27
**App / scope:** `vendor/` (schedule page + form) and `backbone/` (one migration).
`booker/` findings are recorded here but **parked to their own plan** — see B2 and I3.
Overnight-window support is **not in scope** — split out to
`.plans/2026-08-27-overnight-schedule-windows.md`.
**Status:** ✖ ABORTED — superseded by `.plans/2026-08-27-overnight-schedule-windows.md` (2026-08-27). Last recorded: DRAFT — all decisions resolved (2026-08-27); awaiting execution approval.

> One-line framing: the vendor's Schedule day panel showed the same schedule three
> times. This plan establishes why, and what stops it recurring — optimising for
> "a schedule cannot be created twice by accident", not for a display patch.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "command I1").

---

## What was reported

Three identical `court 1 rental` cards (10:00 – 12:09, Weekly, one booking at a time)
plus one genuine `court 1 rental` card (10:00 – 23:00), all on Saturday 29 August, after
clicking a future day that the schedule runs on.

---

## Investigation — what was ruled out first

Each of these was checked in code before the cause below was accepted, because each
would have implied a completely different fix.

| Hypothesis | Verdict | Evidence |
|---|---|---|
| The day panel renders one row several times | **False alarm** | `DayDetailPanel.tsx:80` maps `withAvailability`, built from `getSchedsForDay` (`vendor/lib/utils.ts:111-114`), which is a `.filter()` — a filter cannot emit an element twice. |
| Clicking a day triggers a fetch that appends | **False alarm** | `ScheduleCalendar.tsx:59` — `onSelectDay` is `setSelDay`, pure state. No I/O on the click path. |
| Shell state accumulates schedules | **False alarm** | Both writers replace the array wholesale: `useAppShell.ts:342` and `useSchedulePage.ts:113`. The only additive write is a `.filter()` on delete (`useSchedulePage.ts:157`). |
| The PostgREST embed duplicates rows | **False alarm** | `offerings(...)` in `vendor/services/schedules.service.ts:70` is a to-one embed; it nests, it does not multiply rows. |
| Something else writes `schedules` | **False alarm** | Grep across `booker`, `command`, `vendor`, both Expo apps and `backbone/supabase`: the only application INSERT into `schedules` anywhere is `vendor/services/schedules.service.ts:85`. |
| `12:09` is a computed/rounded end time | **False alarm — test data** | `ScheduleFormModal.tsx:209-213` is a bare `<input type="time">`. Nothing derives an end time. Not a bug; do not chase it. |

**Therefore the three cards are three real rows in `schedules`**, and they were created
by the create path being invoked three times.

The local Supabase DB holds seed data only and no `court 1 rental`, so the affected rows
are in the environment the tester used — B4 cleans them up there.

---

## BLOCKERS

### B1 — The schedule form's Save button fires an INSERT per click, with no in-flight guard  ⬜ TODO

**Files:**
- `vendor/components/schedule/ScheduleFormModal/ScheduleFormModal.tsx:276` — `disabled={!canSave}` is the *only* disable condition.
- `vendor/components/schedule/ScheduleFormModal/ScheduleFormModal.tsx:21` — `onSave` is typed `=> void`, so the modal cannot await it and has nothing to key a pending state off.
- `vendor/components/schedule/ScheduleFormModal/ScheduleFormModal.tsx:55-70` — `handleSave` guards on `canSave` only, then calls `onSave` and returns immediately.
- `vendor/components/schedule/SchedulePage/useSchedulePage.ts:121-151` — the real handler is `async`.
- `vendor/components/schedule/SchedulePage/useSchedulePage.ts:144` → `createSchedule` (`vendor/services/schedules.service.ts:79-105`), then `:147` `await refresh()` (a *second* full round-trip, `:113`), and only then `:150` `setShowSF(false)`.

The modal therefore stays mounted, and its Save button stays enabled, for **two network
round-trips** after the first click. Every click in that window is another INSERT. There
is no unique constraint on `schedules` (`backbone/supabase/migrations/20260507000002_schedules.sql:18-40`
— confirmed as deliberate at `vendor/lib/offeringSchedules.ts:5-9`), so all of them
succeed. Three clicks, three rows — exactly what the screenshot shows.

**Fix approach:** an in-flight latch owned by the hook that owns the async work
(`useSchedulePage`), surfaced to the modal as a `saving` prop that drives `disabled`,
`aria-busy` and the button content. Correctness comes from a `useRef` latch checked and
set synchronously at the top of `handleSave`; the `useState` flag exists for rendering
only. (`disabled` alone is *nearly* sufficient because React flushes state between
discrete events — the ref removes the "nearly".)

**Existing pattern to follow, not invent:** `usePayoutDetailsCard.ts:69` (`const [saving, setSaving]`),
`:158` (`if (saving) return`), `:175`/`:177` (set around the await), and
`PayoutDetailsCard.tsx:137-140` (`disabled={saving}` + `{saving ? "Saving…" : …}`).
The only deviation is the ref, and the reason is that this mutation creates inventory
rather than overwriting a single row.

**Acceptance criterion — the button must be genuinely unclickable, not merely styled
as such.** Three things together, and the plan is not satisfied by any two:
1. `disabled` is set on the native `<button>` for the whole in-flight window (native
   `disabled` is what suppresses the click event and removes the tab stop — a
   `cursor-not-allowed` class or an early `return` inside `onClick` is *not* this, and a
   `<div role="button">` would not be either).
2. The ref latch rejects a second `handleSave` even if one did somehow arrive, so
   correctness does not rest on a render having committed.
3. The disabled styling keys off the same effective condition, so it never *looks*
   available while inert (I1).

Verification is behavioural, not visual: with the network throttled, three fast clicks
must produce exactly one row.

**Cancel must be disabled too** (`ScheduleFormModal.tsx:275`). Otherwise the vendor can
dismiss the modal mid-INSERT; the row still lands, and it lands with no form left on
screen to explain where it came from.

**component-separation:** no new component. `useSchedulePage.ts` gains state and returns
`saving`; `SchedulePage.tsx` passes it through; `ScheduleFormModal.tsx` gains a
`saving: boolean` prop consumed in the existing `disabled`/content expressions — render
layer only, no new state, no new inline style. `onSave`'s type changes to
`=> void | Promise<void>` so the contract stops lying about being synchronous.

---

### B2 — Two schedules that overlap on one offering are two independent capacity buckets, so the same physical slot can be sold twice  ⏸ PARKED (2026-08-27)

**Why parked:** D2 resolved to option (c) — warn in the vendor form now (I2), and fix the
booker's capacity model in its own plan. This is a `booker/` change and AGENTS.md gates
work touching more than one app in a single task.
**Unblock condition:** a new plan, `booker` scope, covering the capacity-bucket change
below plus I3. Nothing in *this* plan resolves B2; I2 and B3 only stop new instances of
the condition being created.

**Files:**
- `booker/services/schedules.service.ts:132-149` — `getSlotsForDate` collects slots from every occurring schedule, then dedupes by start time: *"Two schedules can offer the same start time; the first wins."*
- `booker/services/schedules.service.ts:39-48` — the schedules query has **no `.order()`**, so "the first" is whatever Postgres returned that page load (this is I3).
- `booker/components/booking/steps/Step3Schedule/useStep3Schedule.ts:52-54` — occupancy is fetched only for the ids of the **surviving** slots.
- `booker/services/schedules.service.ts:189-201` — `remainingForSlot` counts only bookings whose `schedule_id` matches the winning slot's schedule.
- `check_booking_placement()` (`20260803000005`) locks and counts **per `schedule_id`**.

With the reported data — schedule A `10:00–23:00 cap 1` and duplicates B/C/D
`10:00–12:09 cap 1`, all on the same weekdays — the 10:00 slot resolves to whichever row
the DB happened to return first. A booking already held on B is invisible on a load where
A wins, and the trigger, counting A's bucket, accepts a second booking for the same hour
on the same court.

This is not caused by B1; B1 just made it easy to reach. It is a property of any two
overlapping schedules on one offering, which the code currently treats as legitimate.

**Direction for the follow-up plan:** one capacity bucket per *offering-slot*, not per
schedule — i.e. occupancy and the placement trigger both keyed on
`(offering_id, booked_date, start_time)` rather than `schedule_id`. That is a
booking-flow and trigger change, and it must not be attempted as a side-effect here.

---

### B3 — `schedules` has no uniqueness guard, so nothing outside the browser stops a duplicate rule  ⬜ TODO — **APPROVAL GATE (schema change)**

**File:** `backbone/supabase/migrations/20260507000002_schedules.sql:18-40` (no unique
constraint), and the deliberate-absence note at `vendor/lib/offeringSchedules.ts:5-9`.

B1's latch lives in one browser tab. It does not cover a second tab, a retry after a
flaky response, a second device, or the two Expo apps if they ever gain a schedule form.
Per D1 this adds the backstop.

**Exact change (do not write the migration file until execution is approved):**

```sql
-- backbone/supabase/migrations/20260828000001_schedules_no_duplicate_rule.sql

-- One availability RULE may exist once per vendor. Two identical active rules are
-- never meaningful: they derive the same slots (booker/services/schedules.service.ts
-- dedupes them to one) while presenting the DB's placement trigger with two separate
-- capacity buckets, which is how the same hour gets sold twice. See B2.
create unique index schedules_no_duplicate_rule
  on public.schedules (
    vendor_id, offering_id, staff_id,
    start_date, end_date, start_time, end_time,
    days_of_week, recurrence
  )
  nulls not distinct
  where is_active;

comment on index public.schedules_no_duplicate_rule is
  'One active availability rule per vendor. Excludes title and capacity_per_slot — '
  'both are attributes OF a rule, not part of its identity. NULLS NOT DISTINCT because '
  'staff_id, end_date, start_time and end_time are all legitimately NULL and would '
  'otherwise compare distinct, letting date-granular rules duplicate freely.';
```

**Verified, not assumed** (2026-08-27, local DB, inside a rolled-back transaction):
the index creates cleanly against the live schema; an INSERT of a byte-identical active
row raised `23505` with `end_date` shown as `null` in the key — confirming
`nulls not distinct` does the job — and it was rejected **even though the title
differed**, which is the behaviour D1a intends.

**Why `nulls not distinct` rather than the `coalesce` sentinels used for
`bookings_no_duplicate`** (`architecture/schema.md:637`): that index has one nullable
column; this one has four, and `staff_id` is a `uuid` with no natural sentinel value.
Four invented magic constants would be worse than the PG15+ feature that exists for
exactly this. The database is PostgreSQL 17.6 — confirmed.

**Blast radius:**
- **Data** — validates every existing `schedules` row at creation. **It will fail
  outright while duplicate groups exist**, which is why B4 must land first.
- **Lock / performance** — `ACCESS EXCLUSIVE` on `schedules` for the duration of a
  single index build on a small table; milliseconds. Not worth `concurrently`, which
  cannot run inside the migration transaction anyway.
- **Downstream** — no type regen (this repo hand-writes interfaces). One app-code
  consequence: `createSchedule` (`vendor/services/schedules.service.ts:103`) currently
  surfaces `error.message` raw, so a rejected duplicate would show the vendor a Postgres
  string. It must map `23505` to plain English, exactly as `deleteSchedule` already maps
  `23503` at `:136`. **That mapping ships in the same batch as this migration** — see
  the coupling note in the execution order.
- **Reversibility** — `drop index public.schedules_no_duplicate_rule;`.
- **Grants/RLS** — none needed. This is an index on an existing table, not a new table.

**Architecture doc update required:** `architecture/schema.md:549` and
`vendor/lib/offeringSchedules.ts:5-9` both currently record the *absence* of uniqueness
on `schedules` as deliberate. Both must be amended in the same change, or the next reader
is misled by the project's own source of truth.

---

### B4 — Duplicate rows already exist in the tester's environment  ⬜ TODO — **user-run; hard prerequisite for B3**

Per D3 option (b). `bookings.schedule_id` is `ON DELETE RESTRICT`
(`backbone/supabase/migrations/20260507000004_bookings.sql:23`), so a duplicate that has
already taken a booking cannot be deleted — and the vendor UI offers no deactivate
control, so `is_active = false` is not reachable from the app either. Hence SQL, not the
UI, and `is_active = false` rather than `DELETE`.

Deactivating is safe for any bookings the row holds: `check_booking_placement()` is
INSERT-only (`architecture/schema.md:647`) and a booking snapshots its own span rather
than joining `schedules` (`:639`), so existing bookings stay valid, confirmable and
completable.

**All four statements below were executed against the local DB on 2026-08-27 inside a
transaction that seeded two synthetic duplicates and was then rolled back.** Q1 found the
group, Q3 deactivated exactly the right two rows, Q4 returned 0. Nothing was applied.

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

⚠️ **If any group shows live bookings on more than one row, stop.** Q3 keeps a single row
per group, so the other row's bookings would vanish from the vendor's day panel (which
renders active schedules only). That case needs a human decision about which schedule the
bookings belong to; it is not a scripted cleanup.

**Q3 — deactivate the redundant copies.** Keeps the row holding the most live bookings,
tie-broken by oldest, so the cleanup never hides a booked schedule in favour of an empty
one:
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

`partition by` treats NULLs as equal, which is what makes this agree with B3's
`nulls not distinct` index. The two must keep matching column lists — if one changes, so
does the other, or the cleanup will leave behind exactly the rows the index then rejects.

**Q4 — must return 0 before B3 is applied:**
```sql
select count(*) as remaining_groups from (
  select 1 from public.schedules where is_active
  group by vendor_id, offering_id, staff_id, start_date, end_date,
           start_time, end_time, days_of_week, recurrence
  having count(*) > 1) t;
```

**This plan does not run any of the above, on any environment.** They are handed over for
the user to execute.

---

## IMPORTANT

### I1 — A save gives no feedback at all, which is *why* the button was clicked three times  ⬜ TODO

**File:** `vendor/components/schedule/SchedulePage/useSchedulePage.ts:141-151`, rendered at
`vendor/components/schedule/ScheduleFormModal/ScheduleFormModal.tsx:275-278`.

`toast.error` fires on failure; there is no `toast.success`, no pending state, and the
modal deliberately waits for `await refresh()` before closing. To the vendor, a
successful save looks identical to a dead button for one to two seconds on a remote
Supabase. B1 is the defect; this is the thing that made a human produce three of them.

**Feedback is a text label, not a spinner** — see D4. The button reads "Saving…" while
the insert is in flight, and is genuinely inert for that whole window.

**The inertness is the point, and it is B1's `disabled` + ref latch that delivers it —
not the label.** The label only explains why nothing is happening. Ship the label without
B1 and duplicates still get created, under a caption.

**Fix approach, on the Save button (`ScheduleFormModal.tsx:276-278`):**
- `disabled={!canSave || saving}` on the existing native `<button>`. A native `disabled`
  button dispatches no click event and is removed from the tab order, so this is what
  makes it literally unclickable rather than merely styled as such.
- `aria-busy={saving}`, so assistive tech announces the pending state the label shows.
- Label becomes `saving ? "Saving…" : editSched ? "Save Changes" : "Save Schedule"`.
- ⚠️ **The `clsx` ternary at `:276` currently keys off `canSave` alone**
  (`canSave ? "cursor-pointer" : "opacity-50 cursor-not-allowed"`). It must key off the
  *effective* disabled state — `canSave && !saving` — or the button will sit there fully
  opaque with a pointer cursor while it is inert, which is the exact "looks clickable,
  isn't" state that invites the second click.
- Cancel (`:275`) disabled while `saving` — see B1.
- `toast.success` on create and update in `useSchedulePage.ts`, matching
  `usePayoutDetailsCard.ts:196`.

**Existing pattern, not a new one:** the label swap plus `disabled` is exactly
`PayoutDetailsCard.tsx:137-140` (`disabled={saving}`, `{saving ? "Saving…" : …}`) and
`DeletionRequestModal.tsx:181` (`{submitting ? "Submitting…" : …}`). No new dependency,
no new component, no approval gate.

**ux-design check** (§4 loading is the one of the four states this surface never had, and
a changed label plus an inert control satisfies it — the skill asks for "spinner,
skeleton, or placeholder … never a blank void", and the void here is the *absence of any
change*, which the label removes; §3 matches the two existing sites above; §5 the text
carries the meaning outright, with `aria-busy` for assistive tech; §7 the simplicity
audit is what D4 turns on). The footer does not reflow: the button is `flex-[2]` of a
fixed row, so its width is unchanged by a label swap.

**component-separation:** render layer only — the `saving` boolean arrives as a prop from
B1's hook. No state, no effect, no logic added to the `.tsx`.

### I2 — The form never checks the schedule being created against the ones that already exist  ⬜ TODO

**Files:** `vendor/components/schedule/ScheduleFormModal/useScheduleForm.ts:123-137`
(`saveBlocker` validates the form against itself only — offering, date, window ordering,
slot fit, weekday selection), and `vendor/components/schedule/SchedulePage/useSchedulePage.ts:143-146`
(create is unconditional).

Nothing tells a vendor that the rule they are about to save already exists, or that it
overlaps one that does. Per D2 option (c) this is the layer that stops B2's condition
being created at all, and it is also what turns B3's raw `23505` into something the
vendor is warned about *before* they press Save rather than after.

**Fix approach:** a pure helper in `vendor/lib/`, unit-tested, following the
`offeringSchedules.ts` pattern exactly (own module because `node --test` has no bundler
and cannot resolve `@/`; `import type … from "./types.ts"` **with** the extension, for the
reason documented at `offeringSchedules.ts:16-25` — dropping the `type` keyword there
breaks the whole `lib/` suite with an error that looks nothing like its cause).

It answers one question — does this draft duplicate, or overlap, an existing active
schedule for the same offering — and returns a discriminated result, not a boolean, so
the two outcomes get the two different treatments D2 requires:

- **identical** → `saveBlocker` refuses. Matches B3's index, so the vendor is stopped by
  the form rather than by a database error. The helper's identity fields **must** be the
  same nine as B3's index; if they drift, the form permits a row the DB then rejects.
- **overlapping but not identical** → an advisory line in the footer, naming the schedule
  it overlaps. Save still proceeds — per D2 this stays legal until B2's follow-up plan
  makes overlap genuinely safe.

Excluding `editSched.id` from the comparison is load-bearing — otherwise editing a
schedule reports it as a duplicate of itself and becomes unsaveable.

### I3 — The booker's schedule query has no deterministic order  ⏸ PARKED (2026-08-27)

**File:** `booker/services/schedules.service.ts:39-48`

`getSlotsForDate`'s "the first wins" is only meaningful if "first" is stable. It is not:
the query has no `.order()`, so which schedule owns a contested start time can differ
between two loads of the same page for the same customer. This is what turns B2 from a
latent modelling gap into an intermittent one.

**Why parked / unblock condition:** same as B2 — `booker` scope, ships with B2's
follow-up plan. Adding an `.order()` alone would make the wrong answer merely
*consistent*, which is not the fix and risks reading as one.

### I4 — A 24-hour operation cannot express its last hour, because `24:00` is unreachable from the form  ⬜ TODO

**Files:** `vendor/components/schedule/ScheduleFormModal/ScheduleFormModal.tsx:209-217`
(the two `<input type="time">` controls) and
`vendor/components/schedule/ScheduleFormModal/useScheduleForm.ts:130-133` (`saveBlocker`).

A vendor open around the clock has to enter `00:00 – 23:59`, because an HTML time input
cannot represent `24:00`. That window yields **23 slots, not 24** — the 23:00–00:00 hour
is unsellable, and `SlotPreview.tsx:32-38` then advises *"Last 59 min unused — end at
23:00 to use the full window"*, so a vendor who follows the form's own guidance discards
the hour permanently. Roughly 4% of a 24-hour vendor's inventory, lost to a control.

**This is NOT the overnight limitation** — that has its own plan,
`2026-08-27-overnight-schedule-windows.md`. Ending *at* midnight is fully supported
throughout the stack; only continuing *past* it is not. Verified 2026-08-27:

- A `00:00 – 24:00` schedule **inserts cleanly** — `24:00:00` is a valid Postgres `time`
  and satisfies `schedules_end_after_start`.
- `slotsInWindow("00:00","24:00",60)` → **24 starts, last `23:00`**, no remainder.
  `slotsInWindow("00:00","23:59",60)` → 23 starts, 59-minute remainder. That difference
  *is* the reported symptom.
- The boundary is already deliberate elsewhere: `toHHMM` documents *"1440 renders as
  24:00"*, `slotAvailability.ts:73` maps `>= 1440` to `"24:00"`, and the span trigger has
  an explicit `when v_end_min = 1440 then time '24:00:00'` branch
  (`20260803000004:106-109`) precisely because it cannot be built by adding an interval.
- `trimTime` (`vendor/services/schedules.service.ts:42`) round-trips `"24:00:00"` to
  `"24:00"` unchanged.

So no migration, no trigger change, no booker change. **One form, one control.**

**Fix approach — revised 2026-08-27 (see D5a). The defect is that `24:00` is unreachable
as an END TIME, for any start — not merely that "24 hours" is unexpressible.** The
original wording here specified an all-or-nothing "Open 24 hours" toggle setting the pair
`00:00`/`24:00`. That fixes the reported symptom and leaves the defect: a vendor wanting
`22:00 – 24:00` is still forced to `22:00 – 23:59`, which yields **1 slot instead of 2**.

The item is therefore an **"Ends at midnight" checkbox on the End Time field**. Ticked, it
sets `sfEnd = "24:00"` and leaves Start Time alone. It subsumes the 24-hour case — start
`00:00`, tick the box — so this is one control, not two, and *smaller* than the toggle it
replaces.

Still chosen over mapping a user-entered end of `00:00` to `24:00`, for D5's unchanged
reason: this stores the canonical value explicitly and introduces no reinterpretation rule
for the overnight plan to unpick.

⚠️ **The checkbox must replace the End Time input while it is ticked, not merely set it.**
An `<input type="time">` given `value="24:00"` fails HTML value sanitisation and renders
**blank**, so the vendor would see an empty End Time while state holds a correct value.
Show a static `24:00 (midnight)` in its place.

**No new state:** the checkbox is *derived* — `sfEnd === "24:00"` — and its handler sets
`"24:00"` or clears back to `""`. Nothing new to keep in sync.

**Already correct, do not "fix":** `saveBlocker`'s `sfEnd <= sfTime` string comparison
orders `"24:00"` after every valid start (`"24:00" > "23:59" > … > "00:00"` lexically,
because all are zero-padded `HH:MM`), and any window ending `24:00` derives at least one
slot, clearing the `slots.starts.length === 0` rule. The existing validation needs no
change.

**Verified 2026-08-27** that this unlocks the split-window pattern end to end:
`22:00–24:00` and `00:00–02:00` both insert cleanly, and
`slotsInWindow("22:00","24:00",60)` → `[22:00, 23:00]` while
`slotsInWindow("00:00","02:00",60)` → `[00:00, 01:00]` — the four hours of a 22:00–02:00
operation. Against `22:00–23:59` the same call yields only `[22:00]`, which is what the
original wording would have shipped.

**component-separation:** the toggle's derived flag and handler live in `useScheduleForm`;
`ScheduleFormModal.tsx` renders a button and the static line. No state, no logic in the
`.tsx`.

**ux-design:** §1 the job is "say when I stop taking bookings", and midnight is currently
expressible only as a wrong answer; §7 one checkbox on the field it belongs to, and it
removes the misleading
remainder hint rather than adding to it.

### I5 — Windows that cross midnight (overnight operations)  ➜ MOVED (2026-08-27)

Lifted out of this plan into its own document:
**`.plans/2026-08-27-overnight-schedule-windows.md`** (items O1–O4).

Kept as a stub rather than deleted, so the numbering stays stable and anything that
already refers to "I5" still resolves. Nothing about overnight support is in this plan's
scope; I4 below is the 24-hour fix and is **not** a partial version of it — see that
plan's O4.

---

## DECISIONS

- **D1 — Add a database backstop against exact-duplicate schedules?** → **Yes**
  (resolved 2026-08-27). Implemented as B3, sequenced after B4's cleanup because the
  index cannot be created while duplicate rows exist.
- **D1a — Are `title` and `capacity_per_slot` part of a rule's identity?** → **No, both
  excluded** (resolved 2026-08-27, my call under D1 — flagged to the user as the one
  sub-choice to overrule if they disagree). `title` is documented as a *"Display label"*
  (`architecture/schema.md:558`) and carries no scheduling semantics; including it would
  let the same availability rule exist twice under two names, which is precisely B2's
  double-sell. `capacity_per_slot` is an attribute *of* a rule, not part of which rule it
  is. `staff_id` **is** included — a different person delivering the same window is a
  genuinely different rule. Consequence: two rows differing only in title or capacity are
  now rejected. Verified this is the behaviour the index actually produces (see B3).
- **D2 — Warn or block on a non-identical but overlapping schedule?** → **Option (c):
  warn now, and open a separate plan for the booker's capacity model** (resolved
  2026-08-27). Blocking would forbid arrangements the schema supports (two staff, same
  window). Exact duplicates are blocked outright regardless — B3 and I2.
- **D3 — How are the existing duplicate rows removed?** → **Option (b): user-run
  `UPDATE … SET is_active = false`, keeping one row per group** (resolved 2026-08-27).
  Statements written out and validated in B4. Not `DELETE`, because `ON DELETE RESTRICT`
  blocks any duplicate that has taken a booking.

- **D4 — Spinner on the Save button?** → ✖ **Reversed. Text label only** (asked
  2026-08-27, answered **yes** 2026-08-27, **reversed by the user the same day**). The
  `Loader2` + `animate-spin` treatment specified in the previous revision of I1 is
  withdrawn; I1 now specifies a plain "Saving…" label. Kept on the record rather than
  deleted, because the spinner is the obvious thing to reach for again next time and the
  decision against it should be findable. **Neither version ever provided the
  click-prevention** — that is B1's `disabled` + ref latch in both revisions, and the
  user's follow-up ("ensure that the button is unclickable") is now spelled out
  explicitly in B1 and in I1's first two bullets.

- **D5 — How is `24:00` made reachable (I4), given overnight support may follow?** → **An explicit
  "Open 24 hours" toggle writing `00:00`/`24:00`** (resolved 2026-08-27), *not* the
  smaller alternative of mapping a user-entered end of `00:00` to `24:00`.
  The toggle stores the value the stack already treats as canonical end-of-day, so it
  introduces no new rule for the overnight work to unpick. The `00:00 → 24:00` mapping would instead
  hard-code, in the form layer, the reading *"an end of 00:00 means end of today"* — and
  that is precisely the special case the overnight plan has to generalise, since the usual
  overnight encoding gives `end <= start` the opposite meaning ("next day"). It would have
  to be found and removed as part of that work. The toggle would not. Recorded again at
  the far end, as O4 in `2026-08-27-overnight-schedule-windows.md`.

- **D5a — Refinement of D5 (2026-08-27):** the chosen control is an **"Ends at midnight"
  checkbox on the End Time field**, not the "Open 24 hours" toggle D5 originally described.
  Prompted by the user asking whether the plan permits `22:00–24:00` + `00:00–02:00`; it
  did not, because the toggle only ever produced the pair `00:00`/`24:00`. D5's *reasoning*
  is unchanged and in fact selects this option — store `24:00` explicitly, introduce no
  reinterpretation rule. The checkbox is strictly more general at the same cost, and it
  subsumes the 24-hour case. Recorded rather than silently rewritten, because it corrects
  a scope error in I4: the item had been written against the reported symptom
  ("24-hour operation") rather than the underlying defect (`24:00` unreachable as an end
  time, for any start).

No decision remains OPEN. The plan is clear to be presented for execution approval.

---

## DEFERRED / COSMETIC

- **The same missing in-flight guard on delete and edit** (`useSchedulePage.ts:129`,
  `:141`, `:155`). Both are effectively idempotent — a repeated UPDATE writes the same
  values, and a repeated DELETE of a gone id returns no error — so no data is corrupted.
  Fold into B1 only if free. The one visible wart is that a double-click during edit can
  raise I12's `window.confirm` twice.
- **`OfferingFormModal` has the identical double-submit shape** —
  `OfferingFormModal.tsx:245` (`disabled={!canSave}` only), `useOfferingForm.ts:69-84`
  (synchronous `handleSave`), `useOfferingsPage.ts:106-112` (async, awaits
  `createOffering`). Same defect class as B1, so a vendor can create duplicate
  *offerings* the same way. Out of scope — the user scoped this to schedules — but it
  should not have to be discovered a second time from scratch.
- **Identical cards are indistinguishable in the day panel** (`DayDetailPanel.tsx:86-141`).
  Real, but harmless in the duplicate case precisely because the rows *are* identical: it
  does not matter which one the vendor deletes. Not worth adding an id or a timestamp to
  the card for it.
- **No deactivate control in the vendor UI.** `is_active` is reachable only by SQL, which
  is why B4 is user-run. Worth a control eventually; not needed to close this plan.

---

## Execution order

Cadence is one stage at a time unless the user asks otherwise.

1. **B1 + I1 together** (§B1, §I1). The root cause and the feedback that stops a human
   producing it. Same three files, and I1's "Saving…" label and disabled styling both key
   off B1's `saving` flag, so splitting them would mean touching the same lines twice. Independent of everything
   below — safe to start immediately on approval.
2. **I4** (§I4). One form, one control, no migration and nothing downstream — the
   smallest and safest item here. Independent of everything else; it may equally be
   pulled forward into stage 1, since it touches the same modal B1/I1 already open.
3. **I2** (§I2). Pure helper plus its unit tests. Depends on nothing in 1–2, but its
   identity-field list must be written to match B3's index exactly.
4. **B4** (§B4) — user-run, on the affected environment. Q1 → Q2 → *read Q2* → Q3 → Q4.
   Hard prerequisite for 5.
5. **B3** (§B3) — **coupled batch, must ship together:** the migration, the `23505`
   mapping in `createSchedule` (`vendor/services/schedules.service.ts:103`), and the
   `architecture/schema.md:549` + `vendor/lib/offeringSchedules.ts:5-9` amendments.
   Shipping the index without the mapping shows vendors a raw Postgres error; shipping it
   without the doc edits leaves the project's own source of truth contradicting the
   schema. Blocked on 4 returning 0 from Q4.
6. **B2 + I3** — separate `booker` plan, not this one. Overnight windows have already
   been split out to `.plans/2026-08-27-overnight-schedule-windows.md`.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| B1 | `npm --prefix vendor run build` + `npm --prefix vendor run lint`. Then, with the network throttled, click Save three times fast on a new schedule and confirm exactly one row lands — the acceptance criterion in §B1. | build/lint **machine-verifiable**; the triple-click **needs a live environment** — this is the actual claim, and a type-check cannot see a race. |
| I1 | Label reads "Saving…" for the whole in-flight window; Save and Cancel both inert *and* styled inert; success toast fires once; both themes; `aria-busy` present. | **needs a live environment** |
| I2 | `npm --prefix vendor test` — new `lib/scheduleConflicts.test.ts` covering: exact duplicate, overlap, adjacent-but-not-overlapping windows, different weekdays, different offering, different `staff_id`, date-granular rows, and edit-mode self-exclusion. | **machine-verifiable** |
| B4 | Q4 returns 0. Q2 re-run shows no group with live bookings on more than one row. | **needs a live environment** (user-run) |
| B3 | Migration applies to a database that has been through B4; a deliberate duplicate INSERT raises `23505` and the vendor sees the mapped message, not the Postgres string. | **needs a live environment** (user-run) — *the index SQL itself is already verified against the real schema, see B3* |
| I4 | `npm --prefix vendor test` — extend the slot tests with `00:00–24:00` → 24 starts ending `23:00`; `00:00–23:59` → 23 + a 59-minute remainder; **and `22:00–24:00` → `[22:00, 23:00]`**, which is the case the original wording would have missed. Then in the app: tick the box on a `22:00` start, save, reopen, and confirm it round-trips as `24:00` with the End Time field never blank. | tests **machine-verifiable**; the round-trip **needs a live environment** |
| B2 / I3 | Deferred to their own plan. Overnight: see `2026-08-27-overnight-schedule-windows.md`. | — |

Nothing here may be marked ✅ on the strength of a passing build alone: B1's whole claim
is about a runtime race, and the build cannot see it.
