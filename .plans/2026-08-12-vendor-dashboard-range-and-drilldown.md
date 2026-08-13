# Vendor dashboard — shared date range + widget drill-down

**Date:** 2026-08-12
**App / scope:** `vendor/` only. No backbone migration, no command, no booker, no mobile.
**Status:** DRAFT — investigation done; all 4 decisions resolved 2026-08-12. Ready to execute, awaiting go on Stage 1.

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

### B1 — Navigation cannot carry a payload  ⬜ TODO
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

### B2 — Two range selectors must become one without asserting a false equivalence  ⬜ TODO
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

### B3 — Clickable cards must be real buttons  ⬜ TODO
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

### B4 — Bookings has nowhere to put the arriving range  ⬜ TODO
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

### I1 — The two range clocks must be stated on screen  ⬜ TODO
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

### I2 — Clearing the dashboard range must reset, not empty  ⬜ TODO

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

### I3 — Two widgets must NOT carry the range  ⬜ TODO
**File:** `useDashboardPage.ts:54-67`

Pending Approvals and Today's Schedule are period-independent by documented
decision (F6). Making them carry the global range would hide pending work outside
the selected dates — a correctness regression dressed as a feature.

**Fix approach:** per the widget table above. Pending Approvals carries
`{ status: "needs_you" }` with no range; Today's Schedule carries today. The
intent type makes this expressible because `range` is optional — this is the main
reason `PageIntent` is a shape rather than a bare `PhDateRange`.

---

### I4 — A client-side date filter over a truncated array under-reports silently  ⬜ TODO
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

### I5 — `/ui-gallery` fixture and visual baselines  ⬜ TODO
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
| **NEW** `dashboard/DashboardDateRange/DashboardDateRange.tsx` | The shared range control: presets, two native date fields, reset, live label. | **Pure display, `.tsx` only, no hook** — fully controlled, state lives in the shell. Exactly the `TransactionDateRange` precedent (F3). Preset-matching is a pure function imported from `lib/`, not local state. Tailwind `sp-*` tokens only; no inline `style={{}}`. |
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

1. **Stage 1 — range primitives.** `lib/dashboardRange.ts` + tests; export
   `isWholeMonth`. No UI, no behaviour change. Verifiable by `npm test` alone.
2. **Stage 2 — shell plumbing.** `PageIntent`; `dashRange` state; `goPage(p, intent?)`;
   one-shot arrival. Nothing consumes it yet — the app behaves identically. (B1)
3. **Stage 3 — one control on the dashboard.** `DashboardDateRange`; both hooks
   take a range; both `FilterTabs` groups removed; clock captions added. This is
   the visible change. (B2, I1, I2)
4. **Stage 4 — clickable widgets.** `StatCard.action`; six intents wired per the
   widget table, including the two that deliberately omit the range. (B3, I3)
5. **Stage 5 — Bookings destination.** Date filter + arrival seeding +
   `DataNotice`. (B4, I4)
6. **Stage 6 — Transactions destination.** Seed the range from arrival.
   Smallest stage; last of the functional work.
7. **Stage 7 — URL mirror.** Parse on mount, `replaceState` on change, per D1.
   Isolated here on purpose: it touches only `useAppShell` and consumes the Stage 1
   parser, so it can be deferred a release without blocking anything above it.
8. **Stage 8 — fixture + baselines + full verification.** Regenerate visual
   baselines once, at the end. (I5)

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
