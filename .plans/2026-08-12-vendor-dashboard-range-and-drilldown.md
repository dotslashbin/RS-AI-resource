# Vendor dashboard — shared date range + widget drill-down

**Date:** 2026-08-12
**App / scope:** `vendor/` only. No backbone migration, no command, no booker, no mobile.
**Status:** COMPLETE (2026-08-14). All 8 stages executed and verified; every blocker and important item closed. Two cosmetic items parked (C1, C3) and one deferred question recorded (`getBookings` range). Nothing outstanding blocks use.

> Give the dashboard one calendar-based date range, and make every widget a
> doorway into the page that owns its detail — carrying the range with it.
> Optimise for **one range, honestly labelled on two different clocks**, and for
> a navigation mechanism the app can keep using, not a one-off prop.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision; numbers are
> plan-local — qualify cross-plan refs by app (e.g. "command I1").

---

## Read this first (written for a cold session)

Five facts decide the whole design. All were verified in the code today.

1. **Vendor is a single-page app.** There is no router navigation. `useAppShell.ts:107`
   holds `useState<PageId>("dashboard")` and `:375` is the entire navigation
   system: `const goPage = (p: PageId) => { setPage(p); setSideOpen(false) }`.
   Only two routes exist — `/` and `/ui-gallery`. So "persist filters across
   navigation" is trivial in shell state, and there is **no URL to carry state in
   unless one is introduced** (→ D1).

2. **The one URL-param precedent argues against `useSearchParams()`.**
   `useLoginPage.ts:90-112` reads `window.location.search` inside an effect on
   purpose, documenting that `useSearchParams()` opts the route into dynamic
   rendering unless wrapped in `<Suspense>`, and that its one advantage —
   reacting to the query changing — "is worth nothing in an app with no router
   navigation". Any URL work here must follow that precedent, not overturn it
   silently.

3. **The two dashboard groups run on different clocks, and the code says so out
   loud.** `useDashboardPage.ts:22-26` and `useFinancialSummary.ts:56-59` both
   state that Operations filters `booking.bookedDate` (the day a session is booked
   *for*) while Earnings filters `booking_transactions.created_at` (the day money
   was *paid*), and that "one shared selector across both groups would assert an
   equivalence the data does not support." The request is for one shared control.
   That is a direct conflict with a documented decision (→ D2).

4. **Bookings are shell-wide shared state.** `getBookings(vendorId)`
   (`bookings.service.ts:80`) takes no range and pages the vendor's whole booking
   set into `useAppShell`. `AppShell.tsx:85-93` hands that same array to
   Dashboard, Bookings, Schedule, Calendar and Offerings. Scoping the *fetch* to a
   date range would starve the calendar and the trends card. Bookings filtering is
   therefore **client-side** (→ D4).

5. **Transactions already does the server-side half.** `useTransactionsPage.ts:69-92`
   fetches per range with a debounce + `reqSeq` guard, and
   `transactions.service.ts:125-126` / `:211-212` apply `gte(from)` /
   `lt(nextPhDay(to))` server-side. Transactions needs a **seed value**, not new
   query support.

---

## Findings

| # | Finding | Location |
|---|---------|----------|
| F1 | Navigation is a bare `setPage`, with no way to carry any payload. `onNavigateBookings: () => goPage("bookings")` is passed as a zero-arg callback from two places. Extending this once, properly, serves every future drill-down. | `useAppShell.ts:375`; `AppShell.tsx:85,113` |
| F2 | **BookingsPage has no date filter at all** — only a status tab group (`bFilter`) and a sort `<select>`. Its header comment enumerates what was deliberately excluded (amount, status sorting); a date range is not among the rejected items, so adding one contradicts nothing. | `useBookings.ts:46-56` |
| F3 | `TransactionDateRange.tsx` is a complete, working range control: 4 presets, two native `<input type="date">` fields with `min`/`max` cross-constraints, a clear button, a live-region label, and a `busy` state. It is a **pure display component with no hook** — the shape the dashboard control should copy. | `components/transactions/TransactionDateRange/` |
| F4 | Native `<input type="date">` *is* the calendar picker in this codebase. The only date library present is `date-fns@3.6.0`; there is no `react-day-picker`, and `components/ui/` has no Calendar or Popover primitive. A custom calendar means a new dependency (approval gate) plus a popover, focus trap and keyboard grid to own. | `package.json:32`; `ls components/ui/` |
| F5 | `previousPeriod()` already handles **arbitrary** ranges, not just the three presets: whole calendar months step back a month, everything else steps back by its own inclusive length. So the "vs previous" deltas survive a custom range with no maths changes — but the hard-coded `VS_LABEL` strings do not. | `lib/utils.ts:254-290`; `useFinancialSummary.ts:22-26` |
| F6 | Two of the three Operations widgets are **deliberately period-independent**. Pending Approvals is "a live queue, not a historical count… hiding a pending request because it falls outside the selected range would hide work the vendor still has to do" (`useDashboardPage.ts:54-57`), and Today's Schedule is today by definition (`:63`). Only `completedCount` is range-driven. A design where every widget blindly carries the global range would regress F6 (→ I3). | `useDashboardPage.ts:54-67` |
| F7 | Both hooks already guard against out-of-order responses (`reqSeq` in `useFinancialSummary.ts:67` and `useTransactionsPage.ts:67`), and `useFinancialSummary` stamps each result with the range it was fetched for so figures can never be captioned with another period's label (`:36-51`). Widening the range from three presets to any range does not weaken these — they key off the range values, not the preset name. | both hooks |
| F8 | The bookings array is capped at `DEFAULT_MAX_ROWS = 10_000` with a `complete` flag surfaced as `bookingsStatus` (`useAppShell.ts:58-64,125`). A client-side date filter over a truncated array silently under-reports — the same family as the truncation bug fixed in the three completed plans of 2026-08-11. `BookingsPage` currently renders no incompleteness notice (→ I4). | `lib/pagedFetch.ts:50`; `useAppShell.ts:58-64` |
| F9 | **No backend, API, RPC, migration or RLS change is required by this plan.** Transactions and Earnings already take a range server-side; Bookings filters client-side by design (F4/D4). This is worth stating explicitly because the request asked for it — the answer is genuinely "none". | F5 above, `transactions.service.ts:99,196` |

---

## UX behaviour (the specification)

### The range control

One control, at the top of the dashboard, above both sections — replacing the two
separate Day/Week/Month `FilterTabs` groups that exist today
(`DashboardPage.tsx:40-46, 69-75`).

- **Presets:** Today · Last 7 days · This month · Last 30 days · This year.
  Backed by the existing `phDayRange()`, `phWeekRange()`, `phMonthRange(0)`,
  `phLastNDays(30)`, `phYearRange()` — no new date maths.
- **Custom:** two native date fields, "From" and "To", each opening the platform
  calendar. `max={to}` on From and `min={from}` on To, exactly as
  `TransactionDateRange.tsx:79,93` does — this makes an inverted range
  *unselectable* rather than validated after the fact.
- **Active preset is reflected, not remembered.** The selected preset is derived
  by comparing the current `{from,to}` against each preset's range, so editing a
  date field to something that happens to equal "This month" lights that preset
  up, and the preset chips and the date fields can never disagree.
- **Always populated.** The dashboard range is never empty (→ I2). The reset
  affordance reads "This month" (the default), not "All time".
- **One live-region label** states the applied range in words, reusing
  `fmtPhDateRange`.

### What the range means in each section

This is the honest answer to F3 in "Read this first", and it must appear on
screen, not just in this document:

- **Operations** — "Bookings serviced <range>" (filters `bookedDate`).
- **Earnings** — "Payments received <range>" (filters `created_at`).

Same dates, two clocks, each named where it applies. The existing Earnings
caption (`useFinancialSummary.ts:132-141`) already carries the basis disclosure
and gets the clock sentence prepended.

### Widget clicks

Every widget becomes a keyboard-operable button that navigates to the page owning
its detail, carrying **the filter it actually represents** — not the global range
blindly (F6):

| Widget | Destination | Carries |
|--------|-------------|---------|
| Pending Approvals | Bookings | status `needs_you`, **no date range** — it is a live queue (F6) |
| Today's Schedule | Calendar | today, not the range — it is today by definition (F6) |
| Completed | Bookings | status `done` + the range, on `bookedDate` |
| Gross | Transactions | the range, on `created_at` |
| Net | Transactions | the range, on `created_at` |
| Payout | Transactions | the range + payout view emphasis, on `created_at` |

Each clickable card announces its destination to assistive tech
(`aria-label="Completed — 24 bookings. View in Bookings."`), and the two cards
that deliberately drop the range say so in their sub-label, which already exists
for exactly this reason ("Live queue", the date).

### After arrival

The destination page opens with the filter **visible and populated**, never
silently applied — a filtered list that looks unfiltered is the defect this whole
design is most likely to produce. The destination's range control shows the
carried dates, and the user can clear or change it there without affecting the
dashboard.

---

## BLOCKERS

### B1 — Navigation cannot carry a payload  ✅ DONE (2026-08-14)

> Implemented in Stage 2. The one-shot mechanism landed **simpler than planned**:
> no sequence counter and no consume-callback are needed, because the shell swaps
> page components on navigation, so every arrival is a fresh mount that can seed
> its own `useState` directly. `goPage` clears `arrival` whenever it is called
> without an intent, which is what stops a stale range re-applying on a later
> visit via the sidebar. Verified by type-check; the live click-through check
> belongs to Stages 4–6, which are what actually pass an intent.

**File:** `vendor/components/layout/AppShell/useAppShell.ts:375`, `:68`

`goPage(p: PageId)` sets a page and nothing else. Six widgets need to hand the
destination a filter at the moment they navigate.

**Fix approach:** introduce a typed, one-shot **arrival intent**.

```ts
// lib/types.ts
export interface PageIntent {
  range?:  PhDateRange
  status?: BookingFilterKey   // Bookings only
}
```

`goPage(p: PageId, intent?: PageIntent)` stores the intent in shell state
alongside the page. Destination pages receive it as an `arrival` prop and consume
it **once, on mount / on identity change**, seeding their own local filter state —
after which the page owns its filters and the intent is inert. This is deliberately
*not* a shared filter store: two pages sharing one mutable range would make
clearing the filter on Bookings silently change Transactions.

**Why one-shot matters:** without it, navigating Dashboard → Bookings → Dashboard →
Bookings re-applies a stale range over whatever the user set on Bookings in
between.

**Verification:** machine — type-check proves every `goPage` call site still
compiles (the parameter is optional, so existing calls are untouched). Live —
click each widget, confirm the destination filter matches the table.

---

### B2 — Two range selectors must become one without asserting a false equivalence  ✅ DONE (2026-08-14)

> Both `FilterTabs` groups replaced by one `DashboardDateRange`. `OpsRange`,
> `OPS_RANGE_OPTIONS`, `EarningsRange`, `EARNINGS_RANGE_OPTIONS`, `PERIOD_LABEL`
> and `VS_LABEL` all deleted; wording now derives from the range itself via
> `rangeLabel` / `vsLabelFor`, the latter branching on the same `isWholeMonth`
> predicate `previousPeriod` uses so the label cannot claim "vs last month" for a
> comparison against 17 days. `useFinancialSummary`'s staleness stamp changed from
> a preset name to the `from`/`to` dates, since an arbitrary range has no name.
> **The two rationale comments were rewritten, not deleted** — both now state that
> one control is safe *because* each section names its clock, and that removing
> the captions reinstates the objection.

**Files:** `vendor/components/dashboard/DashboardPage/useDashboardPage.ts:22-26,32,38-52`;
`vendor/components/dashboard/FinancialSummary/useFinancialSummary.ts:7-26,56-59,61,69-73,146-147`

Both hooks own their own `"day" | "week" | "month"` state and both carry a comment
explaining why they must not share one. The request requires one control. Merging
them badly re-introduces exactly the confusion those comments were written to
prevent.

**Fix approach:** the range moves **up** to the shell (owned by `useAppShell`, so
it survives navigation), and both hooks take `range: PhDateRange` as an argument
instead of owning `OpsRange` / `EarningsRange`.

- Delete `OpsRange`, `OPS_RANGE_OPTIONS`, `EarningsRange`, `EARNINGS_RANGE_OPTIONS`
  and the `PERIOD_LABEL` / `VS_LABEL` lookup tables — all three-value enums that
  an arbitrary range makes meaningless.
- Replace `VS_LABEL` with a derived label: "vs last month" when
  `isWholeMonth(range)`, otherwise "vs previous period" (F5). `isWholeMonth` is
  currently private in `lib/utils.ts:255` and must be exported.
- **Rewrite the two comment blocks** rather than deleting them. They document a
  real property of the data that has not gone away; what changes is the
  resolution — from "two controls" to "one control, two clocks, each labelled".
  A silently deleted rationale is how the next session re-litigates this.

**Verification:** machine — `npm test` (the `phRanges` and `financials` suites
must still pass untouched); type-check. Live — set a custom range, confirm
Operations and Earnings both move and each states its own clock.

---

### B3 — Clickable cards must be real buttons  ✅ DONE (2026-08-14)

> `StatCard.action?: {onClick, label}` added; the root renders `<button type="button">`
> when supplied and an unchanged `<div>` when not. The destination is announced via
> a `.sr-only` span appended to the card's own text rather than an `aria-label`,
> which would have *replaced* the figure it describes.
>
> ⚠️ **Regression found and fixed during this stage:** a `<button>` vertically
> centres its content through an anonymous internal box, and the grid stretches
> these cards to a common height — so Gross Income, whose sub-label is one line
> while its neighbours wrap to two, rendered **8.2px lower** than the rest of its
> row. `display: block` does NOT remove that box; an explicit
> `flex flex-col justify-start` does. Measured before (36 vs 27.8) and after
> (all seven cards at 27.8 label / 63 value). The class carries a warning comment.
>
> Verified live: 6 buttons present with correct destinations, Today's Schedule
> still a `<div>`, all 6 keyboard-focusable, and Enter **and** Space each fire —
> 12 activations from 6 buttons.
**File:** `vendor/components/ui/StatCard/StatCard.tsx:35-56`

`StatCard`'s root is a `<div>`. An `onClick` on a `<div>` is invisible to the
keyboard and unannounced to a screen reader — six primary navigation entry points
would be mouse-only.

**Fix approach:** add an optional prop; when present the root renders as
`<button type="button" className="… text-left w-full">` with a `focus-visible`
ring and a hover affordance; when absent the component renders byte-identically to
today.

```ts
/** Omitted on every existing call site, which therefore render exactly as before. */
action?: { onClick: () => void; label: string }   // `label` is the aria-label
```

This mirrors how `delta?` was added to this same component
(`StatCard.tsx:31-32`) — optional, additive, existing call sites untouched.

⚠️ StatCard contains no nested interactive elements, so a button root is safe.
Anything later added inside it must stay non-interactive.

**Component separation:** StatCard remains a **pure display component** — no
state, no effects, the handler is passed in. It stays a lone `.tsx` with no
companion hook, which is the documented exception in
`.claude/skills/component-separation/SKILL.md`. Styling stays in Tailwind `sp-*`
tokens, consistent with the file today.

**Verification:** machine — visual baselines for the `dashboard` and `grid` modes.
Live — tab to each card, activate with Enter and Space, confirm the screen-reader
name states the destination.

---

### B4 — Bookings has nowhere to put the arriving range  ✅ DONE (2026-08-14)

> `useBookings(bookings, arrival?)` now holds `dateRange: PhDateRange | null`
> (null = every date, this page's normal state) and `bFilter`, **both seeded from
> the arrival intent via lazy `useState` initialisers** — the whole one-shot
> mechanism, since navigation remounts the page. One predicate added to the
> existing `filtBkgs` memo, filtering `bookedDate`: the same clock Operations
> counts on, so a range carried from Completed selects exactly what it counted.
> `badgeFor`'s counts stay on the **unfiltered** array, now with a comment saying
> why.
>
> **Verified end-to-end against local Supabase** (signed in as `marco@bookdeck.com`,
> TINDAHAN VENDOR): dashboard set to "This year" (2026-01-01 → 2026-12-31) with
> Completed = 11 → clicking it landed on Bookings with the identical range, the
> "Done" tab active, and **"11 records"** — widget count and destination row count
> matching exactly.
**Files:** `vendor/components/bookings/BookingsPage/useBookings.ts:45-56`;
`BookingsPage.tsx:8-16`

The page has no date filter (F2), so a carried range currently has nothing to
apply itself to.

**Fix approach:** add `dateFrom` / `dateTo` state to `useBookings`, seeded from
the arrival intent, and one more `.filter()` predicate on `b.bookedDate` inside
the existing `filtBkgs` `useMemo` — client-side, per D4/F4. Render the same
`DashboardDateRange` control (D3) above the status tabs so the applied filter is
visible and clearable.

⚠️ `badgeFor`'s `needsYouCount` / `issuesCount` (`useBookings.ts:60-61`) are
computed from the **unfiltered** `bookings` array and must stay that way — badging
"3 need you" when a date range hides two of them tells a vendor there is less work
than there is. Same principle as F6.

**Verification:** machine — a `node --test` case per predicate if the filter is
extracted to `lib/`; type-check. Live — click Completed with a narrow range,
confirm the row count matches the widget's number exactly.

---

## IMPORTANT

### I1 — The two range clocks must be stated on screen  ✅ DONE (2026-08-14)

> Operations renders `Bookings serviced <range>` via a new `opsCaption` from
> `useDashboardPage`; Earnings prepends `Payments received <range>` to its existing
> basis caption. The Earnings clock is stated even while loading or after a failed
> fetch — which dates the figures count by is a property of the section, not of
> whether a request succeeded. Both confirmed present in the rendered fixture.
**Files:** `DashboardPage.tsx:36,66`; `useFinancialSummary.ts:132-141`

Covered in the UX section; called out as its own item because it is the single
thing that makes B2 acceptable rather than a regression. Without it, one control
over two clocks is precisely the false equivalence the existing comments warn
about.

**Fix approach:** section captions — Operations "Bookings serviced <range>",
Earnings "Payments received <range>" prepended to the existing basis caption.
`DashboardSection` already accepts a `caption` prop; Operations does not currently
pass one.

---

### I2 — Clearing the dashboard range must reset, not empty  ✅ DONE (2026-08-14)

> **Simpler than planned: there is no separate reset button.** The plan called for
> a reset control labelled with the default it restores — but "This month" is
> already one of the five presets and *is* that default, so a second control doing
> the same thing would only add a way to reach an invalid state. The range type is
> non-nullable `PhDateRange` throughout, and `rangeWithFrom`/`rangeWithTo` return
> the original object for an empty value, so the empty state is unreachable rather
> than merely discouraged. Recorded because the deviation is deliberate.


An empty range on the Transactions page means "all time", which is a legitimate
view there. On the dashboard it is not: an all-time Completed count under a period
heading, and an all-time Gross with a "vs previous period" delta computed against
nothing, is the exact defect `.plans/2026-08-10-vendor-dashboard-ux-enhancements.md`
was written to fix.

**Fix approach:** the dashboard range is non-nullable — `PhDateRange`, never
`null`. The reset control sets it back to `phMonthRange(0)` and is labelled with
the default it restores. The **destination** pages keep their own clearing
semantics (Transactions can still go to all-time), because there the range is a
filter over a list, not the basis of a headline figure.

---

### I3 — Two widgets must NOT carry the range  ✅ DONE (2026-08-14)

> Pending Approvals navigates with `{ status: "needs_you" }` and **no range** — the
> count is unfiltered, so the destination must be too, or the card and the list
> disagree. Today's Schedule carries nothing (see I6). Both carry a comment at the
> call site explaining the omission, since "forgot to pass the range" and
> "deliberately withheld it" look identical in code.
**File:** `useDashboardPage.ts:54-67`

Pending Approvals and Today's Schedule are period-independent by documented
decision (F6). Making them carry the global range would hide pending work outside
the selected dates — a correctness regression dressed as a feature.

**Fix approach:** per the widget table above. Pending Approvals carries
`{ status: "needs_you" }` with no range; Today's Schedule carries today. The
intent type makes this expressible because `range` is optional — this is the main
reason `PageIntent` is a shape rather than a bare `PhDateRange`.

---

### I4 — A client-side date filter over a truncated array under-reports silently  ✖ ABORTED (2026-08-14) — already handled

> **The finding was wrong.** It claimed "`BookingsPage` currently renders no
> incompleteness notice". It does not need to: `AppShell.tsx:132-139` already
> renders `<DataNotice>` **above `pageContent`**, so the notice appears on every
> page including Bookings. `DataNotice`'s own header comment says exactly this —
> "Rendered at shell level rather than per page because the bookings array is
> shell-level state feeding six surfaces… saying it once above the content beats
> repeating it in six places".
>
> Building the planned per-page notice would have produced a **duplicate** notice
> on Bookings. Nothing to do; the truncation guard the item wanted is already in
> place and covers the new date filter for free.
**File:** `useAppShell.ts:58-64,125`; `BookingsPage.tsx`

`bookingsStatus.complete` is already computed and already false past 10,000
bookings (F8), but `BookingsPage` renders no notice. Adding a date filter makes
this materially worse: today an incomplete array shows a long list that *looks*
long, whereas a narrow range over a truncated array can show a confidently short
list that is simply wrong.

**Fix approach:** render the existing `DataNotice` component
(`components/layout/DataNotice/DataNotice.tsx`, built for this in the 2026-08-11
work) on BookingsPage when `bookingsStatus.complete === false`, wired through from
the shell. Small, and it reuses a component that already exists for exactly this.

---

### I6 — The calendar opens on a hardcoded April 2026  ✅ DONE (2026-08-14, folded in on request)
**File:** `vendor/components/calendar/CalendarPage/useCalendarPage.ts:9-10`

```ts
const [calMonth, setCalMonth] = useState(3)      // April, always
const [calYear,  setCalYear]  = useState(2026)   // 2026, always
```

Nothing corrects these — there is no effect syncing them to the current date, and
`today` (`:13`) is used only to highlight a cell, not to choose the month. **The
calendar therefore always opens on April 2026** regardless of the real date.

**Pre-existing and unrelated to this plan** — found while wiring Stage 4, not
caused by it. It is recorded here because it *blocks* one widget: "Today's
Schedule" should drill into the calendar, but doing so today would land a vendor
four months away from the date the card itself prints. Shipping that is worse than
leaving the card inert, so the card is **deliberately not clickable** and carries a
comment pointing here.

**Fixed:** both now derive from `phToday()` via lazy initialisers. The
today-highlight was ALSO wrong in the same way and had to move with them — it read
`new Date()` (device-local) while the month became PH-based, so on a timezone
boundary day the calendar would have opened on a month whose highlighted "today"
was not in view. `today: Date` was replaced by an `isToday(day)` predicate
returned from the hook, which also moves that comparison out of the render layer.

**Verified live:** `/ui-gallery?mode=calendar` now reads **"August 2026"** with day
14 present (was "April 2026"). "Today's Schedule" is consequently now clickable and
navigates to the calendar.

⚠️ **The `calendar` visual baseline is now stale** and must be regenerated in
Stage 8 — it was captured showing April 2026.

---

### I5 — `/ui-gallery` fixture and visual baselines  ✅ DONE (2026-08-14)

> Clickable `StatCard` added to the gallery tile. The dashboard fixture became a
> module-scope `DashboardFixture` component holding **real range state**: it was
> passing `onRangeChange={noop}`, which silently turned every preset click into a
> no-op — the interactive assertions could never have failed. Seeded to a fixed
> range so the screenshot stays deterministic.
>
> Three spec tests were **rewritten, not re-baselined**, because they asserted the
> two-selector design that Stage 3 removed:
> - `the range selector drives Completed and nothing else` — now drives the single
>   control, and additionally asserts there is exactly **one** presets group, so a
>   second selector cannot quietly reappear.
> - **New** `both widget groups follow the one control, on their own clocks` — the
>   inverse of the old assertion, plus both clock captions.
> - `B3 — the dashboard fixture stays offline` — now asserts the Gross card does
>   **not** contain "Collected" (I7).
> - `calendar-day` — walks back four months to reach the fixture's April bookings,
>   since I6 made the calendar open on the current month.
>
> **Final state: 73/73 Playwright tests pass on a clean run** (not a `-u` run,
> which always passes).
**Files:** `vendor/app/ui-gallery/page.tsx:119-121,324-328`;
`vendor/visual-tests/pilot.spec.ts:9`

The gallery renders `DashboardPage` with an **empty `vendorId` to keep the fixture
offline** (`page.tsx:119-121`) — the new control must not break that guard, and
the range must be injectable so the fixture is deterministic rather than reading
"today".

**Fix approach:** add a clickable `StatCard` to the existing StatCard tile; pass a
fixed range into the dashboard fixture. Regenerate the `dashboard`, `grid` and
`bookings` baselines (light and dark) as the last step, after the UI has settled —
per the recorded discipline, not once per stage.

⚠️ `pilot.spec.ts:20-23` notes that `dashboard` and `bookings` baselines already
render today's date and are on a frozen clock. Do not re-derive that; it works.

---

## DECISIONS

<!-- All resolved 2026-08-12. No OPEN lines remain — the §7 execution gate is clear. -->

- **D1 — where does the filter live across navigation?** → **shell state as the
  source of truth + a shallow URL mirror** (resolved 2026-08-12).

  Shell state drives everything. On mount, `window.location.search` is parsed once
  inside an effect to seed page + range — the *identical* technique and rationale
  as `useLoginPage.ts:90-112`. On change, `history.replaceState` writes
  `?page=&from=&to=&status=` back without a navigation. Deep links work, refresh
  survives, no router is introduced, and the existing precedent is followed rather
  than contradicted.

  Known cost, accepted: `replaceState` gives no back-button history. A back button
  that steps through every date keystroke would be worse than none.

  **Rejected: introducing a real router.** Considered explicitly and declined —
  see the deferred item below for what it would have bought and what it would have
  cost, so this is not re-litigated from scratch next time.

- **D2 — one range control, or keep two?** → **one control, two clocks, each
  labelled** (resolved 2026-08-12).

  `useDashboardPage.ts:22-26` warns that a shared selector "would assert an
  equivalence the data does not support". That concern is about an *unlabelled*
  shared period; naming each section's clock (I1) states the difference instead of
  hiding it. Both comment blocks are rewritten to record this resolution rather
  than deleted (B2) — a silently removed rationale is how this gets re-argued.

- **D3 — native date inputs or a custom calendar popover?** → **native
  `<input type="date">`** (resolved 2026-08-12).

  Matches `TransactionDateRange.tsx:75-97`. It opens the real platform calendar,
  carries `min`/`max` invalid-range prevention for free, is already styled via
  `sp-input`, is accessible and localised without work, and adds no dependency.
  `react-day-picker` would be an approval gate plus a popover/focus-trap primitive
  `components/ui/` does not have, and would leave the app with two different date
  pickers unless Transactions were migrated too.

- **D4 — Bookings filtering, client-side or server-side?** → **client-side over
  the shell's existing array** (resolved 2026-08-12).

  `getBookings` feeds five pages (F4); scoping the fetch would starve the calendar,
  trends card and offerings. Costs one extra `.filter()` in a memo that already
  exists.

  ⚠️ **I4 is therefore mandatory, not optional** — the incompleteness notice is
  what keeps client-side filtering honest past the 10,000-row cap.

---

## IMPORTANT (continued)

### I7 — The drill-down makes two correct-but-different totals one click apart  ✅ DONE (2026-08-14, option (b))
**Files:** `lib/financials.ts:20-27` (the documented basis difference);
`components/dashboard/FinancialSummary/FinancialSummary.tsx`

Measured on real data during Stage 6, range 2026-06-01 → 2026-07-31:

| Surface | Figure | Basis |
|---|---|---|
| Dashboard "Gross Income" | **₱21,000** | all non-reversed rows — 21 of 25 |
| Transactions "Collected" | **₱7,000** | payable rows only — 7 of 25 |

**Both are correct.** Reconciled arithmetically: 9×₱1,200 + 12×₱850 = ₱21,000 over
21 rows, and 3×₱1,200 + 4×₱850 = ₱7,000 over 7. This is exactly the basis
difference `lib/financials.ts:20-27` already documents, and both surfaces already
state their basis.

**What changed is the distance.** Before this plan, comparing the two required
navigating manually. Now a vendor clicks ₱21,000 and lands on ₱7,000 — the
`financials.ts` warning ("the two screens look like they disagree for no reason")
becomes a one-click journey rather than a theoretical risk.

**Not a defect in this plan's code** — no figure changed. But the drill-down is
what makes it prominent, so it belongs here.

**Options:** (a) leave it — both bases are stated, and the Transactions card does
say "7 of 25 transactions"; (b) make the Gross card's sub-label name its basis more
loudly ("all payments received, incl. held"); (c) have arrival from an earnings
widget land Transactions on a matching basis, which is a bigger change and would
make Transactions behave differently depending on how it was reached — **not
recommended**.

Recommendation: **(b)** — cheapest, and it fixes the wording rather than the
numbers.

**Resolved (b), 2026-08-14.** The sharpest part was a word collision, not the
figures: BOTH screens labelled their headline "Collected" while showing different
numbers. The dashboard's Gross sub-label is now **"All payments, incl. held"**, so
the two surfaces no longer share a term. No figure changed, and the reasoning is
recorded at the call site in `FinancialSummary.tsx` with the measured example.

---

## DEFERRED / COSMETIC

### C3 — The calendar's month arrows have no accessible name  ⏸ PARKED (2026-08-14)
**File:** `vendor/components/calendar/CalendarPage/CalendarPage.tsx:24,28`

Both are icon-only `<button>`s wrapping a bare `ChevronLeft`/`ChevronRight` with no
`aria-label` — unnamed to a screen reader, and selectable in tests only by
position (which `calendar-day` now relies on). Noticed while fixing I6 in the same
file.

**Not fixed**, deliberately: adding aria-labels is a real improvement but is
outside this plan's scope, and this session already has a recorded instance of
exactly that kind of drive-by change being caught and reverted. One-line fix when
someone is next in this file for its own reasons.

### C4 — Hydration warning in the dashboard fixture  ⏸ PARKED (2026-08-14)
**File:** dev fixture only — `app/ui-gallery/page.tsx` under `page.clock.setFixedTime`

The visual suite logs "Hydration failed because the server rendered text didn't
match the client". Cause: Playwright freezes the clock **client-side only**, so the
server prerenders `todayLabel` with the real date and the client re-renders with
the frozen one. `todayLabel` is unchanged code, so this is not introduced here —
but note `rangeLabel`/`presetFor` now read the clock too, which would produce the
same warning on a month boundary (server in September, client frozen in August).

**Harmless**: dev-only, in a fixture that 404s in production, and React recovers by
regenerating the tree. All 73 tests pass regardless. Worth knowing before anyone
chases it as a product bug.

### C1 — Two presets can describe the same window  ⏸ PARKED (2026-08-14, accepted)
**File:** `vendor/lib/dashboardRange.ts` — `presetFor`

Found while building Stage 1 and confirmed by enumerating a 400-day span: on the
last day of every 30-day month — **30 Apr, 30 Jun, 30 Sep, 30 Nov** — "This month"
and "Last 30 days" produce byte-identical ranges. `presetFor` returns the first
match, so clicking "Last 30 days" lights "This month" on those four days a year.

**Accepted, not fixed.** The window shown is exactly what was asked for; only the
chip differs. Disambiguating would require storing the selected preset as its own
state, which is precisely the drift `presetFor` is derived to prevent — a bad
trade for a cosmetic difference on four days. Documented at the function and
pinned by a test asserting the array ordering that decides the tie, so reordering
`DASHBOARD_PRESETS` cannot change it silently.

**Relevant to Stage 3:** if the chips ever gain a "custom" indicator, this is the
case that makes "no preset is lit" and "two presets match" different states.

### C2 — Module named `parseAppParams`, not `parseRangeParams`  ✅ DONE (2026-08-14)

The plan specified `parseRangeParams` / `serialiseRangeParams`. Implemented as
`parseAppParams` / `serialiseAppParams` because they also carry `page` and
`status`, not only the range — the original names would have understated what the
functions own. Recorded so later stages use the real names.

---

## DEFERRED

### A server-side date range on `getBookings`  ⏸ PARKED (2026-08-12)

Asked directly: is it worth adding a date range to `getBookings`, possibly as
backbone work, so `command`, `vendor` and mobile could all use it later?
**Not yet** — but the answer is recorded because the reasoning is not obvious.

**Backbone is not the gate.** A date range needs no migration, RPC or grant:
`.gte("booked_date", …).lte("booked_date", …)` works today under existing RLS.
Two proofs in the codebase already — `transactions.service.ts:125-126` filters
dates server-side, and `command`'s `oversight.service.ts:48` date-filters the
`bookings` table itself with `.lt("status_changed_at", cutoff)`. There is no
bookings RPC in `backbone/supabase/migrations/` and none is needed.

**"Shared so all three apps benefit" does not apply the way it looks.** Services
are copied and adapted per app, never imported — the only shared layer is the
database. So a backbone artifact only pays off if it lives *in* the DB:

- **An RPC** — rejected. RLS already permits the query directly; an RPC adds a
  second access path to secure and maintain for no new capability.
- **A composite index** `bookings (vendor_id, booked_date)` — the one genuinely
  shared artifact, and it does **not** exist: `20260507000004_bookings.sql:47-51`
  has single-column `vendor_id`, `booker_id`, `schedule_id`, `offering_id` plus a
  partial `where status = 'pending'`. Indexing for a query nobody issues is
  speculative; `bookings_vendor_id_idx` plus a filter is adequate at current
  volumes.

**The real cost is in the vendor shell, not the database.** `getBookings` feeds
five consumers from one array (`AppShell.tsx:85-93`), so *using* a range forces
the one-array-vs-per-page-fetching restructure D4 declined.

**Unblock condition — do it when either fires:**

1. A vendor's booking count approaches the 10,000 `DEFAULT_MAX_ROWS` ceiling, so
   the I4 notice starts firing in production rather than in theory.
2. A feature needs a window the shell does not hold — a bookings report or export
   over an arbitrary historical range.

**The shape it should take when that day comes**, so it is a short job:
`getBookings(vendorId, range?: DateRange)`, mirroring `getTransactions(vendorId, range?)`
(`transactions.service.ts:99`) rather than inventing a second convention; the
composite index in the **same batch** as the first server-side caller; each app
copies it as they each copied `fetchAllPages`.

### Introducing a real router  ✖ ABORTED (2026-08-12) — for this plan

Evaluated against the code, not in the abstract. **Decision: do not do it**, here
or as a follow-on, until a trigger below actually fires.

**Why it was declined:**

- The SPA shell is a **documented ecosystem convention**, not an accident:
  `architecture/conventions.md:16` — "page.tsx — Single-page SPA shell (all
  routing is internal state)". All three web apps have exactly `app/page.tsx` +
  `app/ui-gallery/page.tsx`. Routing vendor alone splits one pattern into two.
  The user's own framing (2026-08-12): *these apps are not meant to share a page
  that way anyway* — the portals are separate products, not routes of one site.
- **Five auth gates sit ahead of the page switch** (`AppShell.tsx:42-84`):
  `isCheckingAuth`, `recoveryMode`, `pendingKycVendorId`, `!loggedIn`,
  `!selectedVendorId`. Each renders *something else instead of* the app. With
  routes each becomes a route-level guard, and `architecture/auth-and-roles.md:502`
  records that these are implicit-flow SPAs with **no `middleware.ts`** and
  client-side sessions — so the guards cannot move to middleware without also
  changing the auth flow.
- Implicit flow puts the recovery token in the **URL hash**, latched by
  `isRecoveryDetected()` at module load. A router manipulating the URL shares
  space with that.
- Nine `PageId`s become nine route folders; Sidebar, TabBar, TopBar and the six
  new widgets all move to `<Link>` / `router.push`.

**What it would have bought** (recorded honestly, so the trade is visible later):

- **The back button.** Today, browser Back from any vendor page exits the app —
  there is no history to traverse. This is the one real loss, and D1(c) does not
  recover it.
- Shareable/bookmarkable URLs for *every* view, not just the dashboard range.
- Deep links from notifications and emails. `AppNotification.data`
  (`lib/types.ts:176`) is the natural carrier, but **no** click-to-navigate
  handling exists in the notification panel today and **no** notification email
  links into the vendor app — so this is speculative, not a present need.

**One cost that turned out not to be real:** shell data and realtime would
survive. App Router layouts persist across sibling route changes, so an
`(app)/layout.tsx` holding `useAppShell` keeps bookings, schedules, staff and the
subscriptions alive.

**Trigger conditions that would justify revisiting** — and if any fires, it should
be an ecosystem-wide plan across all three web apps, not vendor alone:

1. Notification or email deep-linking becomes a real requirement.
2. The missing back button generates actual user complaints.

**D1(c) is a stepping stone, not a detour.** It establishes the URL contract
(`?page=&from=&to=&status=`) and puts parsing/validation in a tested pure function
(`lib/dashboardRange.ts`). Both survive a later router adoption — the migration
becomes "change where the state comes from", not "invent a URL scheme".

⚠️ One honesty note for whoever revisits this: the `useLoginPage.ts:90-112`
argument against `useSearchParams()` is premised on *"an app with no router
navigation"*. Adopting a router removes that premise. It is an argument for not
bothering now, **not** an argument that routing is wrong.

---

## Backend / API / query changes

**None.** Stated explicitly because the request asked (F9):

- **Transactions** — the range is already applied server-side in
  `getTransactions` (`transactions.service.ts:99,125-126`). It needs a seed
  value, not query support.
- **Earnings** — `getFinancialsForRange` already takes an arbitrary
  `{from,to}` (`transactions.service.ts:196-217`) and is already paged against
  the `max_rows` cap. Widening from three presets to any range changes no SQL.
- **Bookings** — client-side by D4, so no query change; `getBookings` is
  untouched.
- No migration, no RLS policy, no RPC, no grant, no hand-written type change
  beyond the new `PageIntent` interface in `lib/types.ts`.

---

## Edge cases

| Case | Handling |
|------|----------|
| **Default range** | `phMonthRange(0)` — "This month". Matches today's default (`useDashboardPage.ts:32`, `useFinancialSummary.ts:61` both default to `"month"`), so the dashboard does not silently change what it shows on the day this ships. |
| **Clearing on the dashboard** | Resets to the default; never empty (I2). |
| **Clearing on a destination** | Allowed and page-local. Transactions returns to all-time; Bookings returns to all dates. Does not propagate back to the dashboard. |
| **from > to** | Unselectable in the UI via `min`/`max` (F3). A URL supplying an inverted range is **rejected, not swapped** — silently reversing a user's dates invents an intent they did not express. Fall back to the default and leave the control showing it. |
| **Malformed / non-existent dates in the URL** (`?from=2026-02-31`, `?from=yesterday`) | Validated on parse: `YYYY-MM-DD` shape *and* a real calendar date (`2026-02-31` passes a regex and must still be rejected). Any failure → default range, no error toast; a bad link is not an error state. |
| **Unknown `?page=` value** | Falls back to `dashboard`. Validated against the `PageId` union, not cast. |
| **Unknown `?status=` value** | Ignored; the page's own default status filter applies. |
| **Future dates** | Legal for Operations — `bookedDate` is routinely in the future, so no clamp to today. Earnings will simply show zero for a future-only range, which is correct, not an error. |
| **Very wide range** (This year) | Already handled: `getFinancialsForRange` pages and reports `complete`, and the caption already says "figures cover part of this period only" (`useFinancialSummary.ts:136`). |
| **Range changed mid-flight** | Already handled by the `reqSeq` guards and the range stamp (F7). No new work — but do not remove them while refactoring B2. |
| **Direct load of a destination with params** (`?page=transactions&from=…&to=…`) | The arrival intent is seeded from the URL exactly as it would be from a widget click. One code path, not two. |
| **Timezone** | Every range is PH calendar dates through the existing `ph*` helpers. No `new Date()` in local time anywhere in the new code — a vendor abroad must still see their own business day (`useDashboardPage.ts:34-36`). |
| **Empty result after arrival** | The destination's existing empty state applies, but must be the *filtered* empty state ("No bookings in this range") with the filter visible — not "No bookings", which reads as a broken account. |
| **Returning to the dashboard** | The range persists (shell state) and the Earnings figures are re-fetched only if the range changed, since the effect keys on `period.from`/`period.to`. |

---

## Component inventory

Per `.claude/skills/component-separation/SKILL.md`, each entry states how the
render/hook split is satisfied — stated, not assumed.

| Component | Change | Separation |
|-----------|--------|------------|
| **NEW** `ui/DateRangeFilter/DateRangeFilter.tsx` (planned as `dashboard/DashboardDateRange/`) | The shared range control: presets, two native date fields, optional clear, live label. **Moved to `ui/` in Stage 5** once Bookings became a second consumer — a bookings page importing from `dashboard/` is a layering smell. Props gained `onClear?`, `title`, `fromLabel`, `toLabel`, `idPrefix` (two can share a page). | **Pure display, `.tsx` only, no hook** — fully controlled, state lives in the shell. Exactly the `TransactionDateRange` precedent (F3). Preset-matching is a pure function imported from `lib/`, not local state. Tailwind `sp-*` tokens only; no inline `style={{}}`. |
| **NEW** `lib/dashboardRange.ts` | Preset table, `presetFor(range)`, `parseRangeParams(search)`, `serialiseRangeParams(...)`. | Not a component. Lives in `lib/` because it must be unit-testable — `node --test` has no bundler and cannot resolve `@/`, the same reason `financials.ts` and `pagedFetch.ts` are there. |
| **NEW** `lib/dashboardRange.test.ts` | Boundary cases: inverted range, `2026-02-31`, junk, missing params, each preset round-tripping. | — |
| `ui/StatCard/StatCard.tsx` | Optional `action?: {onClick, label}`; button root when present (B3). | Stays a pure display component — handler passed in, no state added. No companion hook. |
| `dashboard/DashboardPage/DashboardPage.tsx` | Drop both `FilterTabs` groups; render `DashboardDateRange`; wire six `action` props; add the Operations caption (I1). | Render layer only — all six intents come from props/hooks; no logic added to the `.tsx`. |
| `dashboard/DashboardPage/useDashboardPage.ts` | Take `range: PhDateRange`; drop `opsRange` state and `OPS_RANGE_OPTIONS`; derive `opsLabel` from the range; rewrite the clock comment (B2). | Hook keeps all derivation. |
| `dashboard/FinancialSummary/useFinancialSummary.ts` | Take `range`; drop `EarningsRange` + both label tables; derive `vsLabel` via exported `isWholeMonth` (F5); prepend the clock sentence to the caption (I1). | Hook keeps fetching, staleness stamping and deltas. |
| `dashboard/FinancialSummary/FinancialSummary.tsx` | Pass per-card `action` through to `StatCard`. | Pure display, unchanged in kind. |
| `layout/AppShell/useAppShell.ts` | `dashRange` state; `goPage(page, intent?)`; one-shot arrival intent; URL seed + mirror (D1c, Stage 7). | Hook — all of it. |
| `layout/AppShell/AppShell.tsx` | Pass `range` + `arrival` into Dashboard, Bookings, Transactions, Calendar. | Render layer only. |
| `bookings/BookingsPage/useBookings.ts` | Date range state seeded from arrival; one predicate added to `filtBkgs`; `badgeFor` counts stay unfiltered (B4). | Hook. |
| `bookings/BookingsPage/BookingsPage.tsx` | Render `DashboardDateRange` above the status tabs; render `DataNotice` when incomplete (I4). | Render layer only. |
| `transactions/TransactionsPage/useTransactionsPage.ts` | Seed `dateFrom`/`dateTo` from arrival instead of `""` (`:50-51`). | Hook. One-line-scale change. |
| `lib/utils.ts` | Export `isWholeMonth` (currently private, `:255`). | Not a component. |
| `lib/types.ts` | Add `PageIntent`. | Not a component. |
| `app/ui-gallery/page.tsx`, `visual-tests/pilot.spec.ts` | Fixture + baselines (I5). | — |

---

## Execution order

Each stage is independently shippable and leaves the app working. Cadence is
**one stage at a time** unless you ask otherwise.

1. **Stage 1 — range primitives.** ✅ DONE (2026-08-14) — `lib/dashboardRange.ts`
   + `lib/dashboardRange.test.ts` (28 cases); `isWholeMonth` exported from
   `lib/utils.ts:254`; `PAGE_IDS` added to `lib/types.ts:34` with `PageId` derived
   from it. Verified machine-only: `npm test` 120/120 pass (92 before), `npx tsc
   --noEmit` clean — which also proves the `PageId` re-derivation compiles at every
   existing call site — and `eslint` clean on all four files. No UI, no behaviour
   change. See C1 for a property found while writing it.
2. **Stage 2 — shell plumbing.** ✅ DONE (2026-08-14) — `PageIntent` added to
   `lib/types.ts`; `dashRange` + `arrival` state, `goPage(p, intent?)` and
   `intentFor(p)` in `useAppShell.ts`; both new pieces of state reset in
   `handleLogout`. Nothing consumes them yet, so the app behaves identically.
   Verified machine-only: `tsc --noEmit` clean — which proves the widened `goPage`
   still satisfies the `onNavigate: (p: PageId) => void` props on Sidebar and
   TabBar — `npm test` 120/120, and `eslint` shows the **same 5 pre-existing
   problems as HEAD** (verified by linting `git show HEAD:` of the file), so the
   backlog was not widened. (B1)
3. **Stage 3 — one control on the dashboard.** ✅ DONE (2026-08-14) —
   `DashboardDateRange.tsx` created; both hooks take `range: PhDateRange`; both
   `FilterTabs` groups and all four range enums/label tables deleted; clock
   captions added to both sections; `AppShell` and the gallery fixture rewired.
   `rangeLabel`, `vsLabelFor`, `rangeWithFrom`, `rangeWithTo` added to
   `lib/dashboardRange.ts` with 7 more tests. Verified: `tsc` clean, `npm test`
   127/127, lint backlog unchanged (3 pre-existing problems, confirmed against
   `git show HEAD:`), and the fixture **rendered and screenshotted in both themes**
   at `/ui-gallery?mode=dashboard` — presets, active state, both captions and both
   date inputs correct; old controls confirmed absent from the HTML.
   **Not verified:** clicking a preset and seeing Earnings refetch — the fixture
   is deliberately offline with `onChange={noop}`, so that needs a signed-in
   vendor. (B2, I1, I2)
4. **Stage 4 — clickable widgets.** ✅ DONE (2026-08-14) — `StatCard.action`
   added; **six** cards wired (Pending Approvals, Completed, and all four earnings
   cards). `DashboardPage`'s `onNavigateBookings: () => void` prop replaced by the
   general `onNavigate: (page, intent?) => void`, which is `goPage` itself.
   Verified: `tsc` clean, `npm test` 127/127, lint backlog unchanged, and a live
   DOM probe confirmed 6 `<button>` cards with the right destinations, Today's
   Schedule still a `<div>`, all six keyboard-focusable, Enter and Space both
   firing, and every card's label/value aligned to the pixel after the centring
   fix. **Not verified:** that a click lands on the destination with the filter
   applied — the destinations do not consume intents until Stages 5–6.

   Three deviations from the widget table, all deliberate:
   - **Platform Fee is clickable too** (table listed only Gross/Net/Payout). All
     four earnings cards read the same ledger over the same period; one inert card
     among three live ones reads as a bug, not as a decision.
   - **"Payout view emphasis" dropped.** TransactionsPage has no payout-only view
     to target — its filters are search, offering and date range — so the intent
     could not express it. Payout drills in on the range like its neighbours.
   - **Today's Schedule left inert**, see I6. (B3, I3)
5. **Stage 5 — Bookings destination.** ✅ DONE (2026-08-14) — date filter +
   arrival seeding. `DataNotice` turned out to be unnecessary (I4 was a false
   finding — the shell already renders it above every page). The range control was
   **moved to `components/ui/DateRangeFilter/`** and generalised, since two pages
   now use it; `rangeWithFrom`/`rangeWithTo` widened to accept null. Verified
   end-to-end against local Supabase — see B4. (B4, ~~I4~~)
6. **Stage 6 — Transactions destination.** ✅ DONE (2026-08-14) —
   `useTransactionsPage(vendorId, arrival?)` seeds `dateFrom`/`dateTo` from the
   intent's range; `appliedFrom`/`appliedTo` deliberately NOT seeded (they mean
   "what the loaded data covers", and nothing is loaded at mount — the page
   returns its loading view early, so no caption renders before the fetch lands).
   Only the range is taken; `status` is a bookings filter with no meaning over a
   ledger. No service or query change — the range was already applied server-side.

   **Verified end-to-end:** a CUSTOM dashboard range (2026-06-01 → 2026-07-31,
   chosen so it could not be confused with any page default) carried through a
   Gross Income click to Transactions, which opened on
   "Showing 01 Jun 2026 – 31 Jul 2026" with both date inputs populated. Reaching
   Transactions from the sidebar instead opens on "all time" — the one-shot
   guarantee holds on this page too. Surfaced I7. (last of the functional work)
7. **Stage 7 — URL mirror.** ✅ DONE (2026-08-14) — two effects in `useAppShell`:
   one parses `window.location.search` at mount (seeding page, dashboard range and,
   for a non-dashboard target, an arrival intent — so a hand-built deep link takes
   the same code path as a widget click); one writes `serialiseAppParams` back via
   `history.replaceState`.

   **`from`/`to` are written only while on the dashboard**, because they describe
   the DASHBOARD's period and the shell does not own the destination pages' own
   filters. Writing them elsewhere would produce a URL claiming a filter the
   visible page might not have. Deep links to other pages still WORK on read.

   The `react-hooks/set-state-in-effect` rule is disabled for the seed effect
   only, with the reasoning inline: reading the address bar into state once at
   mount is what effects are for, and the lazy-initialiser shape the rule pushes
   toward is the one ruled out on hydration grounds. The file's four real
   violations remain visible — lint count unchanged at 5.

   **Verified live** against local Supabase:

   | Behaviour | Result |
   |---|---|
   | Range change writes the URL | `?page=dashboard&from=2026-03-01&to=2026-04-15` |
   | Navigating away drops from/to | `?page=transactions` |
   | Reload restores the page | landed on Transactions |
   | Deep link scopes the destination | `?page=transactions&from=2026-06-01&to=2026-07-31` -> both inputs populated |
   | `from=2026-02-31` (impossible date) | fell back to dashboard + default range |
   | `from>to` (inverted) | rejected, NOT swapped -> default range |
   | `?page=admin`, `?page=%%%&from=junk` | fell back to dashboard, no error |
8. **Stage 8 — fixture + baselines + full verification.** ✅ DONE (2026-08-14) —
   see I5. Baselines regenerated for `grid`, `dashboard`, `financials`, `calendar`,
   `calendar-day` (all mine) **and `loginreset`**, which was already stale before
   this plan started: its baseline predates a "Back to Sign In" button that is
   present in committed code (`components/auth/` is unmodified in the working
   tree). ⚠️ `visual-tests/` is **gitignored** (`.gitignore:52`), so these
   baselines are local-only artifacts — there is nothing to commit and nothing was
   shared. `pilot.spec.ts` itself is tracked and IS modified. (I5)

**Dependencies:** 3 and 4 both need 2. 5 and 6 both need 2 and are independent of
each other. 7 needs 1 (the parser) and 2. 8 is last by definition.

---

## Verification

**Machine-verifiable:**
- `npm test` — new `dashboardRange` suite; existing `phRanges`, `financials`,
  `pagedFetch` suites must pass **unchanged** (if B2 forces a change to
  `financials.test.ts`, something has gone wrong).
- `npx tsc --noEmit` after each stage.
- `npm run lint` on changed files — do not widen into the existing 36-item vendor
  lint backlog.
- Visual baselines: `dashboard`, `grid`, `bookings` × light/dark.

**Needs a live environment (browser + seeded vendor):**
- Each of the six widgets navigates to the right page with the right filter shown.
- Pending Approvals still counts every pending booking with a narrow range set —
  the I3 regression check.
- Bookings badge counts stay unfiltered with a range applied — the B4 check.
- Completed's number equals the Bookings row count after arrival, exactly.
- Keyboard: tab to each card, Enter and Space both activate; screen reader
  announces the destination.
- Deep link `?page=transactions&from=2026-07-01&to=2026-07-31` loads Transactions
  already scoped, with the control populated (Stage 7).
- Inverted and malformed URL ranges fall back to the default without an error.
- A vendor with >1,000 transactions in range: Earnings still reports incompleteness
  rather than a short total (the 2026-08-11 regression check).

---

## Out of scope

- Any change to `command`, `booker`, `backbone`, or either mobile app.
- Migrating the Transactions page onto the new control — its "Payout period" card
  is the page's primary control with its own presets and all-time clearing. Once
  both exist, consider unifying; not in this plan.
- Back/forward history for filter changes (D1 uses `replaceState` deliberately).
- Introducing a router — evaluated and declined; see DEFERRED for the trade and
  the trigger conditions that would reopen it.
- Any new date-picker dependency (D3 → native inputs).

---

## Context / provenance

- Builds directly on `.plans/2026-08-10-vendor-dashboard-ux-enhancements.md`
  (COMPLETE) — which created the Operations/Earnings grouping, the financial
  widgets, `lib/financials.ts`, `DashboardSection` and the two range selectors
  this plan merges.
- The 10,000-row cap and `complete` flag referenced in F8/I4 come from
  `.plans/2026-08-11-vendor-bookings-pagination-and-contacts-cap.md` and
  `.plans/2026-08-11-crossapp-unbounded-query-truncation.md` (both COMPLETE).
  `DataNotice` was built there and is reused, not rebuilt.
- The `useSearchParams()` stance quoted in D1 is from
  `.plans/2026-08-10-vendor-division-url-param.md` (COMPLETE), implemented at
  `vendor/components/auth/LoginPage/useLoginPage.ts:90-112`.
