# Vendor: booking counts on offerings, and a Sunday-first calendar

**Date:** 2026-08-04
**App / scope:** `vendor/` + `booker/` (see D1) — `lib/constants.ts`, `lib/utils.ts`, `components/offerings/`, `components/schedule/`, `components/calendar/`, `services/bookings.service.ts`, `lib/types.ts`
**Status:** ✅ **COMPLETE (2026-08-04)** — all four items shipped and verified.
**Cross-app** (vendor + booker) per D1, approved by the user.
`tsc` 0 and `build` 0 in both apps; **39 vendor unit tests** green.

> Two small-sounding requests. #1 needs a key the vendor `Booking` type has never
> carried. #2 looks purely cosmetic and is not — the weekday array is load-bearing.
> Optimise for: not silently corrupting which days a schedule runs on.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "command I1").

---

## 0. Scope

**In scope** — the vendor Offerings cards (booking counts) and the vendor calendar's
week start.

**Out of scope**

- **Schema.** No migration; every column needed already exists.
- **`command`.** It has no calendar and no offerings surface.
- **`booker`'s offering cards.** D1 covers the *week start* only; booking counts are
  a vendor-side concept and mean nothing to a booker.
- **Making the count clickable** (filtering Bookings by offering). A plausible next
  step, deliberately not assumed — the ask was to *display* it.

---

## 1. BLOCKERS

### B1 — Offerings cannot count bookings: no key links them  ✅ DONE (2026-08-04)
**File:** `vendor/lib/types.ts:30-57` (`Booking`), `vendor/services/bookings.service.ts:34`, `vendor/components/layout/AppShell/AppShell.tsx:87`, `vendor/components/offerings/OfferingsPage/OfferingsPage.tsx:12`

Two independent gaps, both required before a count can be shown:

1. **`OfferingsPage` receives only `vendorId`** (`:12`, mounted at `AppShell:87`). It
   has no bookings. `AppShell` **does** hold them — it already passes `bookings` to
   dashboard, bookings and schedule (`:79-81`) — so this is a prop, not a fetch.
2. **`Booking` has no `offeringId`.** It carries `offeringName` and `offeringCode`
   only (`types.ts:37`, mapped at `bookings.service.ts:34` from an
   `offerings(name, code)` join). There is no id to group by.

> **Do not group by `offeringCode`.** It is unique per vendor *today*, but it is
> vendor-editable free text — renaming a code would silently re-attribute history.
> `offering_id` is the actual foreign key and is already on the row; it is simply
> not selected.

**This is the third time this plan family has hit the same shape**: the vendor
`Booking` type was built for the bookings list and has been missing a key every time
something new asked a question of it — `endTime`/`endDate` (I1), `scheduleId` (I1),
now `offeringId`. Worth noticing as a pattern rather than patching a fourth time in
isolation; see §4.

**Fix approach:**
1. Add `offering_id` to the select and `offeringId` to `Booking` + mapper.
2. Pass `bookings` from `AppShell` into `OfferingsPage`.
3. Count in `useOfferingsPage` (a `Map<offeringId, number>`), render on the card.

**No new query** — same reasoning as the day panel: the shell already holds every
booking for the vendor, so asking the database again would re-fetch memory.

**Which bookings count?** See **I1** — this is a product question, not a mechanical
one, and getting it wrong makes the number misleading rather than merely wrong.

**Component separation:** counting lives in `useOfferingsPage.ts`;
`OfferingCard.tsx` gains a prop and stays a pure render layer. It has no hook today
and does not need one — it remains stateless.

**✅ Executed 2026-08-04.** `offering_id` added to the select, `offeringId` to
`Booking` + mapper. `AppShell` passes `bookings` to `OfferingsPage`; counting is a
`useMemo` in `useOfferingsPage`; `OfferingCard` takes a `bookingCount` prop. New
`lib/bookingCounts.ts` (own module — `node --test` cannot resolve `@/`).

**Verified:** 7 unit tests, including that two offerings sharing a `code` are still
counted separately — the regression that grouping-by-code would cause.

---

### B2 — Changing the week start would silently corrupt schedules  ✅ DONE (2026-08-04)
**File:** `vendor/lib/constants.ts:10` (`WD_SHORT`), `vendor/components/schedule/ScheduleFormModal/ScheduleFormModal.tsx:201-206`, `vendor/lib/utils.ts:92` (`buildCalCells`)

The request reads as cosmetic. It is not.

```ts
// lib/constants.ts:10
export const WD_SHORT = ["Mo","Tu","We","Th","Fr","Sa","Su"]
```

**`WD_SHORT` has three consumers, and one uses its INDEX as database data:**

```tsx
// ScheduleFormModal.tsx:201-206 — the days-of-week picker
{WD_SHORT.map((wd, i) => {
  const sel = sfDays.includes(i)
  <button onClick={() => setSfDays(p => sel ? p.filter(x => x !== i) : [...p, i].sort())}>
```

`i` **is** the value written to `schedules.days_of_week`, whose encoding is
`0=Mon … 6=Sun` (`20260507000002`). Reordering the array to Sunday-first without
touching this maps **Sunday → 0**, which the database reads as **Monday**. Every day
a vendor picks shifts, existing rows silently mean something different, and
`isOccurrence` — correct in itself — then marks the wrong days.

**Nothing would fail.** No type error, no constraint violation, no test. The calendar
would simply be wrong, and the cause would look like the occurrence logic rather than
a relabelled array.

Second consumer, also position-sensitive:

```ts
// lib/utils.ts:92 — leading blanks before the 1st
const startOff = (new Date(calYear, calMonth, 1).getDay() + 6) % 7   // Mon-first
```

`getDay()` is `0=Sun…6=Sat`; the `+6 % 7` shifts it to Monday-first. Sunday-first is
plain `getDay()`.

**Fix approach — separate display order from the DB encoding, permanently.**

1. Keep the DB encoding untouched. Add an explicit, ordered list of
   `{ label, dbDow }` pairs rather than relying on array position:
   ```ts
   // Sunday-first for display; dbDow stays the DB's 0=Mon..6=Sun encoding.
   export const WEEKDAYS = [
     { label: "Su", dbDow: 6 }, { label: "Mo", dbDow: 0 }, { label: "Tu", dbDow: 1 },
     { label: "We", dbDow: 2 }, { label: "Th", dbDow: 3 }, { label: "Fr", dbDow: 4 },
     { label: "Sa", dbDow: 5 },
   ]
   ```
   The picker then uses `dbDow`, never the index — so a future reorder is safe by
   construction, which is the actual fix. Renaming away from `WD_SHORT` also forces
   every call site to be revisited rather than silently inheriting new order.
2. `buildCalCells`: `startOff` becomes `new Date(...).getDay()`.
3. `ScheduleCalendar` and `CalendarPage` headers render `WEEKDAYS.map(w => w.label)`.

**Unaffected, verified:** `isOccurrence` (`lib/occurrence.ts`) and
`check_booking_placement()` both work in DB encoding and never see display order.
`dbDowToJs` is likewise unaffected.

**`booker` half (D1b):** `lib/constants.ts:8` `WDAYS` and the offset at
`Step3Schedule.tsx:30`. No picker there, so no encoding risk — but apply the same
`{label, dbDow}` shape anyway so the two apps stay legible to each other, per the
copied-not-shared convention already used by `duration.ts` / `slots.ts`.

**✅ Executed 2026-08-04, both apps.** `WD_SHORT` → `WEEKDAYS` (vendor) and `WDAYS`
reshaped (booker), both `{label, dbDow}` and Sunday-first. The picker now reads
`dbDow`; `startOff`/`startOffset` became plain `getDay()`, which is already
Sunday-first — the old `(… + 6) % 7` was what forced Monday.

**The rename was deliberate.** Keeping `WD_SHORT` would have let every call site
inherit the new order silently; renaming forced each to be revisited.

**Verified:** new `lib/weekdays.test.ts` asserts the display order **and** that
`WEEKDAYS[0]` is `Su` with `dbDow: 6` — explicitly `notEqual(0)`, which is the exact
value the old index-based picker would have written. One case reorders the array and
proves the mapping survives, so a future reorder is safe by construction. Browser
tests confirm the header reads Su…Sa, that April 2026's 1st sits in column 4 (three
leading blanks — Monday-first would have given two), and that the picker still offers
all seven days.

**Unchanged, as required:** the 28 pre-existing unit tests — including `isOccurrence`'s
365-day agreement with the booker — all still pass, confirming display order never
reached the occurrence logic.

---

## 2. IMPORTANT

### I1 — "Number of bookings" is ambiguous, and the wrong answer misleads  ✅ DONE (2026-08-04)
**File:** `vendor/components/offerings/OfferingCard/OfferingCard.tsx`

B1 can count, but *what* it counts is a product decision. `bookings` in the shell is
**every** booking for the vendor, across all nine statuses and all time — so a naive
`length` shows a number that includes cancelled and refunded ones and never goes
down. A vendor reading "12 bookings" on an offering they cancelled 9 of would be
misled, which is worse than showing nothing.

**Fix approach:** Count only bookings that a vendor would call real — exclude
`cancelled` and `refunded`, matching the `HOLDS_A_SPACE` rule already in
`lib/slotAvailability.ts` so the two surfaces cannot disagree. Show nothing at all
when the count is zero (the ask says *"if there are"*).

**Make it obvious** (the ask): a filled badge on the card, not a muted caption —
`ux-design` §2 says visual weight should track importance, and this is the number a
vendor scans for. Reuse the existing badge shape from the offering `code` chip rather
than inventing one.

**Component separation:** derived in `useOfferingsPage.ts`, rendered by
`OfferingCard.tsx` from a prop. Existing Tailwind/`sp-*` tokens, no inline
`style={{}}`, so both themes follow (ux-design §6).

**✅ Executed 2026-08-04.** `isLiveBooking()` excludes `cancelled`/`refunded`,
deliberately the same predicate `slotAvailability.ts` uses so the Offerings page and
the schedule day panel cannot disagree. Rendered as a **filled blue badge** beside
the code/category chips; **nothing renders at zero**.

**Verified:** unit tests cover every live status counting, both dead statuses
excluded, and absent-vs-zero behaving identically. Browser test asserts "3 bookings"
appears and no "0 booking" text exists anywhere.

---

### I2 — The day panel's Delete button has no accessible name  ✅ DONE (2026-08-04)
**File:** `vendor/components/schedule/DayDetailPanel/DayDetailPanel.tsx:127`

```tsx
<button onClick={() => onDeleteRequest(s.id)} className="…"><Trash2 size={10} /></button>
```

Icon-only, no text, no `aria-label` — a screen reader announces "button". Found while
writing the previous plan's I3 tests: an unscoped `getByRole("button")` assertion
failed, and this was the cause, not the calendar.

Pre-existing and a sibling of that item, carried here rather than smuggled into it.
Its neighbour Edit has a text label, so this is the only one on the surface.

**Fix approach:** `aria-label="Delete schedule"`. One line, and it makes the previous
plan's tab-stop test scopeable without a carve-out.

**✅ Executed 2026-08-04.** `aria-label={\`Delete schedule: ${s.title}\`}` — the title
makes it unambiguous when several schedules are listed. Browser test asserts it is
reachable by name **and** that no nameless buttons remain anywhere on the page.

---

## 3. DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->

### D1 — does `booker` get the Sunday-first change too? → **(b) both apps** (resolved 2026-08-04)

Consistency wins: the two calendars would otherwise disagree about what a week looks
like, and the booker's is the one **customers** see. Cross-app, so it is an approval
gate under `AGENTS.md` — satisfied by the user's explicit instruction.

**Verified after the decision — `booker` is materially simpler than `vendor`, and the
difference is the whole reason B2 is a blocker on one side and cosmetic on the other:**

| | `vendor` | `booker` |
|---|---|---|
| Weekday array | `WD_SHORT`, **3 consumers** | `WDAYS`, **1 consumer** (`Step3Schedule.tsx:67`) |
| Index used as DB data | **YES** — `ScheduleFormModal.tsx:201` writes `i` to `days_of_week` | **No** — bookers never create schedules, so there is no picker |
| Week offset | `lib/utils.ts:92` | `Step3Schedule.tsx:30` |

So in `booker` this genuinely *is* a relabel plus an offset. In `vendor` it is not,
and the `{label, dbDow}` shape is what keeps the two from being confused for each
other later.

**Also checked, unaffected:** `getMondayOfWeek` in `booker/services/schedules.service.ts`
computes the reference week for **biweekly parity**, not display. It must stay
Monday-based regardless of what the header shows — changing it would shift which weeks
a biweekly schedule runs on. Recorded because its name invites exactly that mistake.

---

## 4. Observation — not an item, but worth naming

The vendor `Booking` type has now been missing a key **three times in a row**:
`endTime`/`endDate`, then `scheduleId`, now `offeringId`. Each was selected-and-
discarded or never selected, and each was found only when a new surface asked. The
type was shaped for one screen and is now feeding four.

Not proposing a refactor — there is no evidence a bigger change is warranted, and
adding one field per real need is the simplest correct thing. Recorded so that a
**fourth** occurrence is read as a pattern rather than another one-off.

---

## 5. Execution order

1. **I2** — one line, no decision, no dependency. Safe now.
2. **B1 + I1** — the booking count. Independent of the calendar work; I1 decides what
   B1's number means, so they ship together.
3. **B2** — week start, **both apps**. No longer blocked; D1 resolved.
   Do `vendor` first (where the encoding trap lives and the tests are), then
   `booker` (a relabel plus one offset).

---

## 6. Verification

| Item | Check | Kind |
|---|---|---|
| B1 | An offering with bookings shows a count; one with none shows nothing | unit test on the counting map + **browser** |
| B1 | Count groups by `offeringId`, not code — renaming a code does not move history | unit test |
| I1 | Cancelled/refunded excluded; agrees with `slotAvailability`'s rule | unit test |
| **B2** | **The days-of-week picker still writes the same `days_of_week` values it did before the reorder** | **unit test — the whole point; a screenshot cannot see this** |
| B2 | Calendar header reads Su…Sa; the 1st lands under the right column across several months | **browser**, both apps |
| B2 | `booker` Step 3 calendar matches `vendor`'s week start | **browser** |
| B2 | Biweekly schedules still run on the same weeks (`getMondayOfWeek` untouched) | existing unit tests |
| B2 | `isOccurrence` output is unchanged by the reorder | existing 28 unit tests must stay green |
| I2 | Delete button has an accessible name | **browser** (Playwright role query) |
| All | `tsc`, `npm test`, `npm run build` | machine |

⚠️ **`npm run lint` is unavailable in `vendor`** — pre-existing config circularity
(`.plans/2026-08-03-offering-duration-and-booking-units.md` I14). Do not claim a lint
pass.

**Playwright is runnable again** (the dev-server port collision cleared on
2026-08-04); the previous plan's five outstanding browser checks were completed then,
so the suite stands at 22 passing and is the baseline this plan must not break.


---

## 7. Execution record — 2026-08-04

All four items shipped. Files changed:

**`vendor`** — `lib/constants.ts` (`WD_SHORT` → `WEEKDAYS`), `lib/utils.ts`,
`lib/types.ts`, `services/bookings.service.ts`, `components/layout/AppShell/AppShell.tsx`,
`components/offerings/OfferingsPage/{OfferingsPage.tsx,useOfferingsPage.ts}`,
`components/offerings/OfferingCard/OfferingCard.tsx`,
`components/schedule/{ScheduleCalendar,ScheduleFormModal,DayDetailPanel}/…`,
`components/calendar/CalendarPage/CalendarPage.tsx`, `app/ui-gallery/page.tsx`,
`visual-tests/pilot.spec.ts`. New: `lib/bookingCounts.ts`, `lib/bookingCounts.test.ts`,
`lib/weekdays.test.ts`.

**`booker`** — `lib/constants.ts`, `components/booking/steps/Step3Schedule/Step3Schedule.tsx`.

**Verification:** `tsc` 0 and `npm run build` 0 in **both** apps; **39 vendor unit
tests**; **27 Playwright tests**.

### ⚠️ Observed flakiness — recorded, not dismissed

One full-suite run failed 3 of 27 — the last three tests in the file (`B2`'s column
assertion, `B2`'s picker, and `B1/I1`'s badge). The same tests passed **in isolation
before that run, as a 4-test subset after it, and 27/27 on a clean full run**.

Most plausible cause is first-compile latency: `next dev` compiles routes on demand,
and that run followed an interrupted backgrounded suite that had left a server
contending for the port. The assertions use `waitForLoadState("networkidle")` and then
assert immediately, which is fine once a route is warm and marginal when it is not.

**Not chased further because the product code is not implicated** — the three
assertions are pure DOM reads against components whose logic is separately covered by
unit tests. But it is real, it will recur, and the honest fix if it does is an explicit
wait on a rendered element rather than `networkidle`. Anyone seeing a red run here
should re-run before investigating the component.
