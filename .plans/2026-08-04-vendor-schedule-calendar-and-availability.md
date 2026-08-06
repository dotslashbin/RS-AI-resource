# Vendor schedule page: calendar markers, live slot availability, clearer create CTA

**Date:** 2026-08-04
**App / scope:** `vendor/` only — `lib/utils.ts`, `components/schedule/ScheduleCalendar/`, `components/schedule/DayDetailPanel/`, `components/schedule/SchedulePage/`, `lib/types.ts`, `services/bookings.service.ts`
**Status:** ✅ **COMPLETE (2026-08-04)** — all five items shipped and browser-verified.
28 unit tests + 22 Playwright tests green.

> Three reported issues on the vendor Schedule page. #1 turned out to be a real bug
> with a precise cause, not a polish item — and a second, larger one behind it.
> Optimise for: the calendar tells the truth about when a schedule actually runs.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "command I1").

---

## 0. Scope

**In scope** — the vendor Schedule page: calendar markers, per-day slot
availability, and the create-schedule CTA.

**Out of scope**

- **`booker` and `command`.** Single-app change, no approval gate.
- **The vendor *Calendar* page** (`components/calendar/CalendarPage/`) — a separate,
  still-mock surface (`portals.md`). It shares `getDots`, so B1 improves it
  incidentally, but wiring it to the DB is its own job.
- **Schema.** Nothing here needs a migration; every column required already exists.

---

## 1. What was reported, and what is actually wrong

### 1.1 The reported symptom is real and the cause is exact

> "whenever I create a schedule, the calendar does not show the dot"

**`lib/utils.ts:255-264` — `getDots()` matches three hardcoded category strings:**

```ts
if (ss.some(s => s.category === "offering"))   dots.push("#6366f1")
if (ss.some(s => s.category === "lesson"))     dots.push("#f59e0b")
if (ss.some(s => s.category === "other"))      dots.push("#10b981")
if (bs.length > 0)                             dots.push("#3b82f6")   // bookings
```

`OfferingCategory` is **vendor-defined free text** — `lib/types.ts:17` says so in
its own comment: *"vendor-defined free-text category (was offering|lesson|other)"*.
The type was widened; `getDots` never followed.

Queried against the live database, the categories actually in use are:

```
class · Rental · rental · session · Manual Service
```

**Zero overlap with the three it tests for.** A schedule can therefore *never*
produce a dot. Only bookings do — which is why the calendar looks half-alive rather
than dead, and why this reads as "sometimes it doesn't work".

### 1.2 The larger bug behind it

Fixing the colours alone would make the calendar mark the **wrong days**.
`lib/utils.ts:96-101` decides which schedules fall on a day:

```ts
const dow = new Date(calYear, calMonth, day).getDay()
const di = dow === 0 ? 6 : dow - 1                       // 0=Sun..6=Sat → 0=Mon..6=Sun ✓
return schedules.filter(s => s.date === ds || (s.repeat !== "none" && s.days.includes(di)))
```

The day-of-week conversion is **correct** (checked — a real candidate for a bug, and
it is not one). Everything else is wrong:

| Defect | Consequence |
|---|---|
| No `start_date` lower bound | A weekly schedule starting 25 Apr marks matching weekdays in **January**, and every month before it exists |
| `biweekly` treated as weekly | Marks every week instead of every other |
| `monthly` treated as weekly | Marks every matching weekday in the month |
| `end_date` ignored (new column) | Marks days after availability has ended, forever |
| Date-granular schedules unhandled | `repeat: "none"` + no `days` ⇒ marked only on their single `start_date`, never across their range |

**This rule already exists correctly in two other places** — `isOccurrence()` in
`booker/services/schedules.service.ts` and `check_booking_placement()` in
`20260803000005`. The vendor calendar is the third copy and the only wrong one.

### 1.3 Verified — not the cause

- **Data refresh.** `useSchedulePage.handleSave` awaits `refresh()`, which re-fetches
  and re-renders. Creating a schedule *does* update state.
- **Day-of-week encoding.** Correct, as above.
- **The service worker.** Unrelated to this; see the 2026-08-04 SW plan.

---

## 2. BLOCKERS

### B1 — `getDots` tests categories that no longer exist  ✅ DONE (2026-08-04)
**File:** `vendor/lib/utils.ts:255-264`

See §1.1. Schedules never mark the calendar.

**Fix approach:** Stop enumerating a fixed vocabulary. Derive one dot per distinct
category present that day, coloured via the existing **`catColor()`**
(`lib/utils.ts:77`) — which already has a neutral `?? "#64748b"` fallback and is what
the Offerings page uses, so the calendar and the cards finally agree on colour.

⚠️ **`catColor` carries the same stale map** (`offering|lesson|other`) but degrades
to slate instead of vanishing. Leave its behaviour alone here — changing the palette
is D1, and B1 must not silently become a redesign.

**🔄 Executed 2026-08-04.** `getDots` is replaced by **`getDayMarkers()`**, returning
`{ dots, scheduleCount, bookingCount, label }` — the label being I3's non-colour
signal. Dots derive from the distinct categories present, coloured by `catColor()`.
The booking dot is now **guaranteed a slot** when present; truncation drops
categories. Covered by 7 new tests in `lib/dayMarkers.test.ts`, including every real
category from the database.

`components/calendar/CalendarPage` (still mock, out of scope) got a **call-site-only**
update so the rename compiles — no behaviour change there.

**Three toolchain corrections made along the way**, none of them anticipated:
1. `lib/utils.ts` imported via the `@/` alias, which `node --test` cannot resolve —
   switched to relative. Identical under tsc and webpack.
2. Its `isOccurrence` import then needed an explicit **`.ts` extension**: type-only
   imports are erased by type-stripping, value imports are not. `npm run build`
   exit 0 confirms Next accepts it.
3. This is what the repo's own rule — *"pure logic that needs a test must live in its
   own module"* — is actually protecting against. Recorded because the next testable
   helper added to `vendor/lib` will hit the same three.

**NOT verified:** that a dot appears on screen. The Playwright suite could not run —
its `webServer` tries to claim a port while a dev server is already up, and killing
the user's server to test is not a trade worth making.

**Depends on B2**: colouring the right dots on the wrong days is not a fix.

**Clarified 2026-08-04 (pre-execution review) — the cap was unspecified.**
`getDots` ends `dots.slice(0, 3)` (`lib/utils.ts:270`). With free-text categories a
busy day can carry five or more distinct ones, and the booking dot is currently
**last in the array**, so it is the first thing truncation drops. That is backwards:
"someone booked this day" outranks "a fourth category exists".

Rule to implement: **the booking dot is always included when present**; category dots
fill the remaining slots, capped at **3 total**. Visual order is unchanged
(categories, then booking) — only truncation priority changes.

---

### B2 — Occurrence logic on the calendar is wrong in five ways  ✅ DONE (2026-08-04)
**File:** `vendor/lib/utils.ts:96-101` (`getSchedsForDay`)

See §1.2 for the table. Most visible: schedules marked in months **before they
start**.

**Fix approach:** Port the correct rule rather than patching cases. Add
`lib/occurrence.ts` exporting `isOccurrence(schedule, date)`, mirroring
`booker/services/schedules.service.ts:63-93` and the DB's
`check_booking_placement()`, extended for `end_date` and the date-granular branch
(inside `start_date..end_date` ⇒ every date occurs). `getSchedsForDay` becomes a
filter over it.

**This makes a fourth copy of one rule.** Justified only because the alternative —
importing across app boundaries — is forbidden by `AGENTS.md`, and the DB copy is
plpgsql. **The file must say so at the top**, naming its three siblings, exactly as
`lib/duration.ts` and `lib/slots.ts` already do.

**Component separation:** pure module, no React. Unit-testable without a Supabase
client, following `bookingErrors.ts` / `transactionTotals.ts`.

**✅ Executed 2026-08-04.** New `lib/occurrence.ts` (`isOccurrence` + `parseLocalDate`)
and `lib/occurrence.test.ts`; `getSchedsForDay` is now a filter over it.

**Date-granular discriminator:** `!s.time`. `start_time` is NULL exactly when the
offering is booked by whole days (`20260803000002`), and `check_booking_placement()`
enforces that invariant — so no `duration_unit` had to be carried onto the vendor's
`Schedule` type just to ask the question.

**Correction to this plan's own premise:** it said the module would be testable
"following `bookingErrors.ts` / `transactionTotals.ts`". Those are **mobile** files —
`vendor` had **no test infrastructure at all** (scripts were `dev`/`build`/`start`/`lint`,
zero `.test.ts`). Added a zero-dependency `npm test` (`node --test
--experimental-strip-types`), matching mobile. First attempt excluded tests from
`tsconfig`, which would have left them unchecked; switched to mobile's
`allowImportingTsExtensions: true` so they stay inside `tsc --noEmit`.

**Verified.** `tsc` 0 · `npm test` **11/11** · `npm run build` 0.
The tests cover all five original defects, and one asserts agreement with a ported
copy of the booker's `isOccurrence` across **365 consecutive dates × 4 recurrences** —
the drift alarm for a rule that now lives in four places.

**Also run against the live database's real rows**, including the user's own
test data:

| Schedule | Result |
|---|---|
| `House Rental` (date-granular, 10–17 Aug) | marks **all 8 dates** — previously only its start date |
| `Red Racket Rental` (weekly, starts 4 Aug) | **0 days in July** — previously marked every Tue–Sat |
| `Red Racket Rental`, first week | 4–8 Aug, the five listed weekdays |
| `Fitness Assessment` (biweekly) | 1, 11, 15, 25 May — **alternate** weeks, previously every week |

---

## 3. IMPORTANT

### I1 — Slot availability is not wired to bookings  ✅ DONE (2026-08-04)
**File:** `vendor/components/schedule/DayDetailPanel/DayDetailPanel.tsx:59` (renders `capacityLabel(s)`), `vendor/services/bookings.service.ts:34`, `vendor/lib/types.ts:39`

Reported issue #2. The panel currently states *capacity* ("Up to 5 per slot") — a
static property of the schedule. It never says how much is **left**.

**The data is already on the wire and thrown away.** `services/bookings.service.ts:56`
selects `start_time, end_time, end_date, quantity`, and `DbRow` declares them
(`:17,19`) — but the mapper only maps `startTime` (`:34`), and `Booking`
(`lib/types.ts:39`) only declares `startTime`. So the span arrives and is discarded.

**`SchedulePage` already receives every booking for the vendor** (`SchedulePage.tsx:15,21`)
and already passes them to the calendar (`:97`). It does **not** pass them to
`DayDetailPanel`.

⚠️ **Clarified 2026-08-04 (pre-execution review) — as originally written this item
was UNBUILDABLE, and the obvious way to satisfy its wording anyway was the bug this
whole epic removed.**

`Schedule` (`lib/types.ts:99-116`) carries `time`, `end` and `max` but **no
duration**, and `services/schedules.service.ts:65` selects
`offerings(name, category)` — not the duration columns. D2(a)'s per-slot list needs
slot boundaries, and a boundary is *window ÷ duration*. With no duration there are no
boundaries, and the tempting shortcut is to render one row per schedule treating the
whole window as a single slot — exactly the "a schedule is one bookable thing"
model this work replaced.

**Fix approach — no new query, but one extra join column.**
1. Extend the select to `offerings(name, category, duration_minutes, duration_unit)`
   and carry `durationMinutes`/`durationUnit` on `Schedule`. Mirrors the booker's
   I10 fix, which needed the same data for the same reason.
2. Add `endTime` to `Booking` and its mapper (already selected, currently discarded).
3. Pass `bookings` into `DayDetailPanel`; compute per-slot occupancy in memory for
   the selected day, deriving boundaries with `lib/slots.ts`'s `slotsInWindow()` —
   the same function the schedule form's preview already uses.

> **Why not a count query like the booker's `getSlotOccupancy`?** Because the booker
> holds only schedules and *must* ask. The vendor shell already fetches every one of
> its bookings, so a query here would re-fetch data sitting in memory. Simplicity
> first — if the vendor list is ever paginated the way mobile is, revisit.

**Availability is per-day**, because a recurring schedule's occupancy differs by
date — which is exactly what the day panel is scoped to.

**Counting rule — must mirror `check_booking_placement()`:** a slot is occupied by
any non-`cancelled`/`refunded` booking whose `[start_time, end_time)` **overlaps** it.
Equality on `start_time` is wrong: a 2-unit booking occupies its second slot too. A
panel that under-counts tells a vendor a slot is free when the database will refuse
it.

**Component separation:** the computation goes in a new `useDayDetailPanel.ts`;
`DayDetailPanel.tsx` stays a pure render layer. It currently has **no hook** — legal
today only because it is stateless. See **D2** for what it should display.

**🔄 Executed 2026-08-04.** New `lib/slotAvailability.ts` (own module, so
`node --test` can load it) and `components/schedule/DayDetailPanel/useDayDetailPanel.ts`.
The panel renders D2(a): one row per derived slot, `09:00–10:00 · 2 of 5 left`, with
`Full` in red at zero. Date-granular schedules render a single "This date" row.

⚠️ **A SECOND data gap this plan also missed.** Beyond the duration gap already
recorded, `Booking` carried **no `scheduleId`** — and `services/bookings.service.ts`
never selected `schedule_id`. Without it a booking cannot be attributed to a schedule
at all, so availability was uncomputable for a second, independent reason. Added
through the type, the select and the mapper.

**Verified:** `tsc` 0 · `npm test` **28/28** · `npm run build` 0. Twelve new tests in
`lib/slotAvailability.test.ts`, the load-bearing ones being:
- a **multi-unit** booking decrements **every** slot it covers (equality on
  `start_time` would leave the second slot looking free, and the DB would then
  refuse it — the exact under-count the header warns about);
- a **date-granular span that started days earlier** still occupies this date;
- cancelled/refunded, other dates and other schedules are all excluded.

**NOT verified:** how it looks. Same Playwright/port collision as B1.

---

### I2 — The create-schedule CTA is easy to miss  ✅ DONE (2026-08-04)
**File:** `vendor/components/schedule/DayDetailPanel/DayDetailPanel.tsx:54`

```tsx
<button onClick={onNew} className="btn-primary px-3 py-[7px] rounded-[10px] text-xs font-bold …">
```

Reported issue #3. `text-xs` with 7px vertical padding is roughly **28px tall** —
under the 44×44 minimum in `.claude/skills/ux-design/SKILL.md` §5, and visually
subordinate to the schedule cards beside it despite being the page's primary action.

**Fix approach:** Enlarge to a full-width primary button with a one-line blurb —
*"Create a schedule for your offering"* — sized ≥44px. Per ux-design §2 this is the
one clear primary action on the surface; per §7 the blurb earns its place only where
it explains something the label cannot, so it belongs in the **empty state** most of
all.

**Component separation:** presentational only; no new state, so no hook is required
for I2 alone. Uses existing `btn-primary` and `sp-*` tokens — **no inline
`style={{}}`**, and no hardcoded colours, so both themes follow automatically
(ux-design §6).

**🔄 Executed 2026-08-04.** Now full-width, `min-h-[44px]`, with the blurb
*"Create a schedule for your offering"* under a "New schedule" label. Moved out of
the header row so it is no longer competing with the date for the same line. The
empty state's "Click + New" copy was updated to match — it pointed at a label that
no longer exists.

---

### I3 — The dots convey meaning by colour alone  ✅ DONE (2026-08-04)
**File:** `vendor/components/schedule/ScheduleCalendar/ScheduleCalendar.tsx:66-69`

```tsx
{dots.map((c, di) => <div key={di} className="size-1 rounded-full" style={{ background: … }} />)}
```

A 4px unlabelled dot whose only information is its colour. That fails ux-design §5
("don't use colour alone") and WCAG 1.4.1, and there is no legend anywhere on the
calendar — so even a vendor who *can* distinguish the colours has nothing telling
them what they mean.

The cell is also a `<div>` with an `onClick` (`:53-54`) — not keyboard reachable,
failing §5's last bullet.

**Fix approach:** Give each cell an `aria-label` / `title` naming what is on that day
("2 schedules, 1 booking"), and make the cell a real `<button>`. A visible legend is
D1's business, since it depends on what the markers end up meaning.

**Clarified 2026-08-04 (pre-execution review) — the blank cells.**
`ScheduleCalendar.tsx:57` renders the leading/trailing grid blanks as `opacity-0`
divs. Converting cells to `<button>` **without excluding those** would add invisible
focusable elements, so a keyboard user tabs through empty boxes — fixing an
accessibility failure by introducing a worse one. Blank cells stay inert: no button,
no tab stop, `aria-hidden`.

**Note the inline `style` is legitimate here** — the colour is a genuinely dynamic
per-dot value, which is the documented exception in `component-separation`.

**🔄 Executed 2026-08-04 (with B1).** Cells are now `<button type="button">` with
`aria-label`/`title` reading e.g. *"27 — 2 schedules, 1 booking"*, plus `aria-pressed`
for the selected day. Grid-padding cells return early as inert `aria-hidden` divs, so
they add no tab stops.

**NOT verified:** the screen-reader pass. Needs a browser.

---

## 4. DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->

### D1 — what should a calendar marker show? → **(a) one dot per distinct category, coloured by `catColor()`** (resolved 2026-08-04)

The smallest change that fixes the reported bug, and it makes the calendar
consistent with the Offerings cards, which already colour by `catColor()`.

Rejected: a single neutral dot (loses the at-a-glance mix), a count badge (answers a
different question and drops category entirely), occupancy heat (duplicates what the
day panel answers per-day, and tint-alone is a fresh colour-only problem).

Research basis: Apple/iOS Calendar uses a dot for "something exists"; Google Calendar
month view uses labelled chips where width allows. The vendor cells are ~40px, so
chips would need a layout change — out of scope here.

⚠️ **Known, accepted cost.** `catColor()` maps only `offering|lesson|other` and falls
back to slate. With the categories actually in use — `Rental`, `rental`, `session`,
`class`, `Manual Service` — **only one maps**, so most days will show slate dots and
colour will carry far less than it appears to. That is precisely why **I3 is not
optional**: the text alternative is what makes the marker legible, not the colour.
See §6 for the palette follow-up, deliberately kept out of this plan.

### D2 — how should availability read in the day panel? → **(a) per-slot list** (resolved 2026-08-04)

`09:00–10:00 · 2 of 5 left`, one row per derived slot. Matches what the booker now
shows, so the two apps describe the same slot identically — which matters when a
vendor is on the phone to a customer looking at the other one. It also shows *which*
slots are full, which is the actionable part.

Rejected: a per-schedule summary (hides which slots are taken), and
summary-with-expand (adds interaction state the panel does not otherwise need).

**Accepted cost:** a long window at a short duration is a long list — 09:00–17:00
hourly is 8 rows per schedule. If that becomes unwieldy in practice, collapsing to
D2(c) is additive and nothing here has to be undone.

---

## 5. Best-practice notes carried into the items

- **Never colour-only** (ux-design §5, WCAG 1.4.1) → I3.
- **44×44 minimum touch target** (§5) → I2, and the calendar cells themselves
  (~40px, noted in I3).
- **All four states** (§4) — the day panel has *populated* and *empty*; a failed
  bookings fetch currently renders as "nothing booked", the same silent-empty class
  of bug as the SW plan's I1. Noted in §6 as follow-up, not smuggled in here.
- **One rule, one place** — the occurrence logic is about to exist in four copies
  (B2). Each must name the others, or they drift.

---

## 6. Deferred / follow-up

- **The vendor *Calendar* page is still mock.** B1/B2 fix the shared helpers it
  imports, so it will behave better, but it is not wired to the database and this
  plan does not wire it.
- **A failed bookings fetch renders as an empty day.** Same defect as the SW plan's
  I1, in a different surface. Worth folding into that plan's I2 audit rather than
  duplicating here.
- **`catColor` / `catBg` still carry the dead `offering|lesson|other` map**, so under
  D1(a) most categories render slate. Two ways out if the dots prove too samey in
  use: seed the map from the vendor's actual distinct categories, or assign a colour
  by hashing the category string (stable, no vocabulary, no maintenance). **Neither
  is in this plan** — D1 chose the minimal fix, I3 supplies the legibility, and a
  palette redesign should be its own decision rather than smuggled into a bug fix.

---

## 7. Execution order

1. **B2** — correct occurrence logic. Everything visual depends on it being right;
   fixing dots first would just render wrong days in better colours. **Needs D1
   only in so far as D1 might change what is marked** — the rule itself is
   decision-independent, so this can start first.
2. **B1** — dot derivation. **Blocked on D1.**
3. **I3** — accessibility, ships with B1 because it is the mitigation for whatever
   D1 chooses.
4. **I1** — slot availability. **Blocked on D2.** Independent of B1/B2/I3.
5. **I2** — the CTA. Independent of everything; safe to do at any point.

---

## 8. Verification

| Item | Check | Kind |
|---|---|---|
| B2 | A weekly schedule starting 25 Apr marks **no** day in March; a biweekly one marks alternate weeks; a `GEAR`-style date-granular one marks every day in its range | **live** (browser) + unit tests on `isOccurrence` |
| B2 | Unit test asserts vendor's `isOccurrence` agrees with the booker's on the same fixture dates | machine (`node --test`-style pure module) |
| B1 | Create a schedule for a `Rental` offering; a dot appears on its days | **live** (browser) |
| I1 | With capacity 5 and 2 bookings on one slot, the panel reads 3 left; a **2-unit** booking decrements **both** slots it covers | **live** (browser + DB) |
| I2 | Button ≥44px; blurb present; empty state reads sensibly | **live** (browser) |
| I3 | Cell is keyboard-focusable and announces its contents | **live** (browser + screen reader) |
| All | `npx tsc --noEmit` and `npm run build` clean | machine |

⚠️ **`npm run lint` is unavailable in `vendor`** (pre-existing config circularity —
`.plans/2026-08-03-offering-duration-and-booking-units.md` I14). Do not claim a lint
pass on this work.

⚠️ **Visual items need a browser, not a type-check.** Playwright fixtures exist for
`schedule` and `scheduleform` modes (`/ui-gallery`); extend them rather than
verifying by eye.


---

## 9. Browser verification — run 2026-08-04

The dev-server port collision cleared, so the outstanding checks ran. **5 new
Playwright tests, all passing**, in `visual-tests/pilot.spec.ts`:

| Test | Proves |
|---|---|
| B1 — a schedule marks its day | day 23 renders with an `aria-label` naming its schedules |
| I3 — cells announce their contents | `aria-label` present, cell is keyboard-focusable |
| I3 — blanks add no tab stops | exactly **30** focusable cells in April 2026 |
| I1 — per-slot availability | `09:00–10:00` renders, and shows **Full** where a fixture booking occupies it |
| I2 — CTA is prominent | blurb present, measured height **≥ 44px** |

Full suite: **22 passing** (17 pre-existing + 5 new). A fixture booking gained a real
`scheduleId`/span so the occupancy path is genuinely exercised rather than trivially
reading "all free".

**Found while writing these — out of scope, recorded not fixed.** An unscoped
`getByRole("button")` failed, and the cause was not the calendar: the day panel's
**icon-only Delete button** (`DayDetailPanel.tsx:127`) has **no accessible name**, so
a screen reader announces only "button". Real, pre-existing, and a sibling of I3 —
carried into the next plan rather than smuggled in here.