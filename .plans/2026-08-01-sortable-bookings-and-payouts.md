# Sorting — vendor bookings, booker bookings, Command payouts

**Date:** 2026-08-01
**App / scope:** `command` (payouts table), `vendor` (bookings list), `booker` (bookings list)
**Status:** COMPLETE (2026-08-01) — B1 ✅ · I1 ✅ · I2 ✅ · I3 ✅. No open decisions.

> Let users reorder the three booking/payout lists. Optimize for: reuse the
> sortable-table pattern that already exists rather than inventing a second one,
> and do not force a table onto surfaces that are not tables.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "dual-ack I21").

**Out of scope:** server-side sorting, pagination, `BookingStatusWidget` (a
top-4 dashboard summary, not a list to reorder), and Command's Transactions page
(already sortable, and still mock data — see dual-ack D7).

---

## Investigation record — only one of the three is a table

The request says "sortable columns". That maps onto exactly one surface.

| Surface | What it actually renders | Current ordering |
|---|---|---|
| **Command Payouts** | a real `<table>` with `<thead>` (`PayoutsPage.tsx:95-140`) | server-side `.order()` — `created_at` asc, or `released_at` desc for owed-back |
| **Vendor Bookings** | `sp-card` containing flex rows (`BookingsPage.tsx:44-46` → `BookingRow`) — **no columns, no header row** | hardcoded `bookedDate + startTime` ascending (`useBookings.ts:10`) |
| **Booker Bookings** | `db-card` containing `BookingCard`s (`DashboardPage.tsx:53-55`) — **no columns** | **none at all** — raw service order (`created_at` desc) |

### ✅ Already handled — do not build a sorting mechanism

`command/components/ui/SortableColumnHeader/` already exists: a `<th>` that
renders the label, a direction chevron, and calls `onSort(col)`. It is paired
with `sortCol` / `sortDir` / `sortBy` state in
`components/transactions/TransactionsPage/useTransactions.ts:17-18,48`.

**Command Payouts should reuse it verbatim** — same app, same `components/ui/`,
already styled for both themes. Writing a second sorting component would be the
mistake here.

### The design tension this creates

`SortableColumnHeader` renders a `<th>`, so it only functions inside a table.
Vendor and booker have no columns to click, so "sortable columns" cannot be
delivered there without first converting those lists into tables — and that is a
bad trade:

- **Vendor's row** carries an avatar, stacked name/contact/date lines, a status
  pill, a countdown, up to three wrapping action buttons, and an inline expansion
  rendered *beneath* the row (reject reason, flag reason, unpaid confirm). Tables
  handle wrapping action clusters and full-width sub-rows badly, and this one is
  already responsive.
- **Booker's card** is a customer-facing surface in a mobile-first PWA. A data
  table is the wrong idiom on a phone.

**Recommendation: real sortable columns for Command Payouts; a compact sort
control above the list for vendor and booker.** Same capability, appropriate
affordance. Recorded as an OPEN decision rather than assumed, because it differs
from the request as worded.

### ⚠️ Finding — sorting client-side over a silently truncated set

`getPayouts` / `getOwedBack` (`command/services/payouts.service.ts:68,90`) have
**no `.limit()`**, and PostgREST caps every response at `max_rows = 1000`
(`backbone/supabase/config.toml:18`) — signalled as HTTP 206, which supabase-js
does **not** surface as an error.

Today that only means the page shows at most 1000 payouts. **Once sorting is
client-side it becomes worse:** the user sorts by "highest payout" and sees the
largest of an arbitrary 1000-row slice, presented as though it were the largest
overall. Silently wrong beats visibly missing.

`vendor/services/transactions.service.ts:47-56` already solved exactly this —
explicit paging plus a comparison against the exact count. **Covered by B1**,
which must land with or before the sorting.

---

## BLOCKERS

### B1 — Payouts sorting would sort a silently truncated set  ✅ DONE
**File:** `command/services/payouts.service.ts:60-72` (`getPayouts`), `:84-96` (`getOwedBack`)

Detail above. This is a blocker rather than an "important" because it converts an
existing quiet limitation into an actively misleading one: a sorted view implies
"these are the top N of everything", which would be false.

**Fix approach:** mirror the pattern already proven in
`vendor/services/transactions.service.ts` — request an exact count, page in
`PAGE_SIZE` chunks up to a `MAX_ROWS` ceiling, and return an
`incomplete: boolean` the page surfaces rather than hides. Do **not** invent a new
approach; that file's comment block explains the 206 behaviour and is the
reference.

**Coupling:** must ship **with or before I1**. Sorting on truncated data is worse
than not sorting.

**Verification:** seed more than `PAGE_SIZE` transactions locally and assert the
returned count equals the table count; assert the page renders the incomplete
notice when the ceiling is hit. Machine-verifiable via a SQL count comparison.

> **✅ DONE (2026-08-01).** `payouts.service.ts` now pages through a shared
> `fetchPaged(narrow)` helper: `PAGE_SIZE = 1000`, `MAX_ROWS = 10_000`,
> `{ count: "exact" }`, `.range()`, and a `complete` / `totalCount` pair on the
> returned `PayoutsResult`. `getPayouts` and `getOwedBack` both go through it, so
> their filters are applied *before* the range rather than to a pre-truncated set.
> `usePayoutsPage` carries `complete` / `totalCount`; `PayoutsPage` renders a
> notice above the table when the set is short, rather than silently showing a
> subset.
>
> **Copied deliberately from `vendor/services/transactions.service.ts`**, including
> the non-obvious part: **`.order("id")` as a tiebreaker after `created_at`**.
> Timestamps tie, ties reorder between requests, and rows then duplicate or vanish
> across page boundaries. That would have been easy to omit.
>
> **Typing correction made during execution:** the first attempt typed the `narrow`
> callback as the return of `.from()`, which has no `.eq()` — those live on the
> filter builder `.select()` returns. Resolved with an inferred `PayoutQuery` type
> from a `baseQuery()` helper rather than casting to `any`.
>
> **Verified:**
> - `tsc --noEmit` 0, `npm run build` 0.
> - Exact counts match SQL per tab: `held 25/25`, `releasable 9/9`, `reversed 6/6`
>   (`Content-Range` headers confirm `count=exact` is in force).
> - **Multi-page coverage proved against the live API** by simulating the loop at
>   a 10-row page size over the 25 `held` rows: pages returned 10 / 10 / 5 →
>   **25 fetched, 25 distinct**, i.e. no overlap and no gaps, with the short final
>   batch exercising the loop's break condition.
>
> **Not verified — needs a live environment:** the incomplete notice rendering,
> which requires more than 10,000 payouts to trigger naturally.

---

## IMPORTANT

### I1 — Command Payouts: sortable columns  ✅ DONE
**File:** `command/components/payouts/PayoutsPage/{PayoutsPage.tsx,usePayoutsPage.ts}`

The only surface where "sortable columns" is literally the right answer.

**Fix approach:** add `sortCol` / `sortDir` / `sortBy(col)` to `usePayoutsPage`,
mirroring `useTransactions.ts:17-18,48` (click a new column → asc; click the
active column → toggle). Replace the plain `<th>`s in `PayoutsPage.tsx:112-131`
with `SortableColumnHeader` from `@/components/ui/SortableColumnHeader`.

**All columns sortable** — the header component makes each one a single line, and
every column has a defensible use: *Vendor* (group a payout run), *Booking*,
*Paid* (oldest owed first), *Customer paid* / *Ezzy fee* / *Vendor payout*
(largest first), and the trailing *Booking status* / *Released* column.

**Two details the shared comparator must get right**, neither handled by
`useTransactions`'s generic compare:
- **Numeric columns must compare as numbers.** `useTransactions.ts:33-37`
  lowercases strings and otherwise compares with `>` — fine there because its
  mock amounts are numbers, but `payoutAmount` etc. must not fall into string
  comparison, or `₱900` sorts above `₱1,058`.
- **`releasedAt` is nullable.** Decide where nulls land (recommend: always last,
  both directions) rather than letting `undefined` compare arbitrarily.

**Default:** keep the current per-tab ordering as the initial sort so the page
does not change behaviour on load — oldest payment first for the lifecycle tabs,
most recently released first for owed-back.

**Component separation:** state and comparator live in `usePayoutsPage.ts`; the
`.tsx` stays a render layer and gains no `useState`. `SortableColumnHeader` brings
its own `.module.css`.

**Coupling:** blocked by **B1**.

**Verification:** click each header, assert order and chevron direction; confirm
numeric columns order numerically and nulls sort last. Needs-live-environment,
plus a unit-testable comparator if it is extracted.

> **✅ DONE (2026-08-01).** `usePayoutsPage` gained `sortCol` / `sortDir` /
> `sortBy` plus a `compare()` helper and a `DEFAULT_SORT` per tab; `PayoutsPage`
> now renders `SortableColumnHeader` for all seven columns.
>
> **Both traps handled and verified by simulation:**
> - **Numeric columns compare numerically** — `120, 900, 1058`, not the string
>   order that would put ₱900 above ₱1,058. `useTransactions`'s generic `a > b`
>   was deliberately *not* reused for this reason.
> - **`releasedAt` nulls sink last in BOTH directions** — a row with no release
>   date is "not applicable", not "earliest".
> - Strings use `localeCompare`, so `acme` sorts among the letters rather than
>   after `Z`.
>
> **Two things added beyond the item as written:**
> - `SortableColumnHeader` gained an optional `align?: "left" | "right"` prop
>   (plus `.thRight` / `.labelRight`). Numeric cells are right-aligned and the
>   label is a flex container, so `text-align` alone does nothing. Additive and
>   defaulted, so the existing Transactions usage is untouched.
> - **Switching tabs resets to that tab's natural order.** Carrying a sort across
>   tabs would leave the page ordered by `releasedAt` on a lifecycle tab where
>   every value is null.
>
> **Verified:** `tsc --noEmit` 0, `npm run build` 0 across all three apps;
> comparator behaviour simulated across numeric / case / null cases.
> **Not verified — needs a browser:** chevron direction and header click targets.

---

### I2 — Vendor bookings: sort control  ✅ DONE
**File:** `vendor/components/bookings/BookingsPage/{BookingsPage.tsx,useBookings.ts}`

Currently fixed at `bookedDate + startTime` ascending (`useBookings.ts:10`), with
no way to change it.

**Fix approach:** add `sortKey` / `sortDir` to the existing `useBookings` hook —
which already owns the filter state, so this is the natural home and needs no new
file. Render a compact control beside the existing filter tabs
(`BookingsPage.tsx:22-40`).

**Sortable by:** service date *(default, unchanged)*, customer name, offering,
status, amount. All five are present on `Booking` and shown in the row except
`pricePaid` — see the decision below on whether to sort by a value the row does
not display.

**Do not convert the list to a table** — reasoning in the investigation record.

**Component separation:** `useBookings.ts` gains the state and the comparator;
`BookingsPage.tsx` stays a render layer. If the control needs more than a `<select>`,
it is a new `components/ui/` component with its own trio, not inline markup.

**Coupling:** touches `BookingsPage.tsx`, which dual-ack **I21** rewrote for the
six grouped filter tabs. Same file, no conflict, but read that item first so the
tab bar is not disturbed.

**Verification:** each option reorders correctly, and the choice survives changing
the filter tab. Needs-live-environment.

> **✅ DONE (2026-08-01).** `useBookings` gained `sort` / `setSort` / `sorts`, a
> `slotTime()` helper and `compareBookings()`; `BookingsPage` renders a `<select>`
> beside the filter tabs. Filter and sort are independent, so changing tab keeps
> the chosen order.
>
> **Four options, direction folded into the key** — *Date — soonest first*
> (default), *Date — latest first*, *Customer A–Z*, *Offering A–Z*. A `<select>`
> is not a clickable column header, so every option a vendor can pick is spelled
> out rather than requiring them to combine a field with a direction.
>
> **Two omissions, both deliberate:**
> - **Amount** — per the decision above.
> - **Status** — the six filter tabs already group by lifecycle, so sorting by it
>   adds nothing, and alphabetical status order is meaningless.
>
> **Default preserves prior behaviour:** soonest-first was the previous fixed
> order, so the page does not reorder itself on load.
>
> **Fixed while here — a label that would have become a lie.** The bar hardcoded
> *"{n} records · sorted by earliest"*. That text is only true until someone uses
> the control, so it now reads *"{n} records"* and the select states the order.
>
> **Verified:** `tsc --noEmit` 0, `npm run build` 0;
> `grep -c useState BookingsPage.tsx` → **0**; comparator simulated across all
> four options — same-day bookings order by start time, and a lowercase customer
> name sorts among the letters rather than after every capitalised one.
> **Not verified — needs a browser:** the select's placement beside the tab bar at
> narrow widths.

---

### I3 — Booker bookings: sort control  ✅ DONE
**File:** `booker/components/dashboard/DashboardPage/{DashboardPage.tsx,useDashboardPage.ts}`

"Current Bookings" renders in raw service order with **no sort and no filter**
(`DashboardPage.tsx:52-56`).

**Fix approach:** add `sortKey` / `sortDir` and the sorted array to the existing
`useDashboardPage` hook, and a small control in the card header beside the
existing "New" button (`DashboardPage.tsx:42-51`).

**Keep this smaller than vendor's.** This is a customer looking at their own
handful of bookings, not an operator working a queue. Recommend **service date**
and **vendor name** only — the two the user actually asked for — rather than
mirroring vendor's five. Adding status/amount here is capability nobody requested
on a surface that benefits from staying quiet.

**Component separation:** `DashboardPage.tsx` currently holds **no** `useState`
(all of it is in `useDashboardPage.ts:17`) — that must stay true.

**Note:** `BookingStatusWidget` is deliberately untouched. It is a top-4 summary
with its own deliberate ordering (unsettled first, then by date), not a list the
user browses.

**Verification:** both options reorder; `DashboardPage.tsx` still contains no
`useState`. Machine-verifiable (grep) + needs-live-environment.

> **✅ DONE (2026-08-01).** `useDashboardPage(bookings)` now owns `sort`,
> `setSort`, `sorts` and a memoised `sortedBookings`; `DashboardPage` renders a
> `<select>` beside the "New" button and maps `sortedBookings`.
>
> **Three options, not five** — Newest first *(default)*, Oldest first, Vendor A–Z.
> Held to the two fields requested rather than mirroring vendor's list, per the
> item's own reasoning: this is a customer with a handful of bookings, not an
> operator working a queue.
>
> **Default preserves prior behaviour:** the list was previously in raw service
> order, which is `created_at desc`, so "Newest first" keeps it looking the same
> on load.
>
> **The control is hidden when there is ≤1 booking** — a sort selector above a
> single row is noise.
>
> **Verified:** `tsc --noEmit` 0, `npm run build` 0;
> `grep -c useState DashboardPage.tsx` → **0**, so the render layer stayed pure;
> sort logic simulated across all three options including mixed-case vendor names.
> **Not verified — needs a browser:** the select's appearance in the card header.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains — see §7. -->

- Vendor and booker have no columns — what affordance? → **(a) a compact sort
  control above each list** (resolved 2026-08-01) — delivers the capability
  without restructuring two responsive, action-heavy layouts; Command Payouts
  still gets real sortable columns because it genuinely is a table. Options as
  offered:
  - **(a) A compact sort control above each list** *(recommended)* — a `<select>`
    or small segmented control. Delivers the capability without restructuring two
    responsive, action-heavy layouts. Command Payouts still gets real sortable
    columns, since it genuinely is a table.
  - **(b) Convert both lists to real tables** so all three surfaces share the
    `SortableColumnHeader` pattern. Most literal reading of the request and the
    most consistent result — but it is a substantial rewrite of `BookingRow`
    (avatar, stacked text, wrapping buttons, inline expansions) and of a
    mobile-first customer card, and would need its own responsive design pass.
  - **(c) Command Payouts only** — do the surface that is already a table and
    leave the other two alone. Smallest change; leaves the vendor's list stuck on
    a fixed order, which is the complaint that started this.

- Should vendor sort by amount (`pricePaid`), which the row does not display? →
  **(a) No — sort only by what is visible** (resolved 2026-08-01). An order the
  user cannot verify by looking reads as a bug rather than a sort. Options as
  offered:
  - **(a) No — sort only by what is visible** *(recommended)*: date, customer,
    offering, status. Sorting by an invisible value produces an order the user
    cannot verify by looking, which reads as a bug.
  - **(b) Yes, and show the amount** — add a price to `BookingRow` so the sort is
    checkable. Genuinely useful for a vendor, but it is a layout change to a row
    that is already dense, so it deserves to be a deliberate choice.
  - **(c) Yes, without showing it** — cheapest, and the option I would argue
    against for the reason in (a).

---

## DEFERRED / COSMETIC

- **Server-side sorting.** Not worth it at this scale: vendor and booker load a
  single user's or vendor's bookings, and Payouts is bounded by B1's ceiling.
  Client-side sorting over an already-complete set is simpler and instant.
  **Unblock condition:** B1's ceiling is being hit in practice.
- **Persisting the chosen sort** across reloads. No existing preference-storage
  pattern in these apps, and the default order is sensible on each surface.
- **`BookingStatusWidget`** — see I3's note.
- **Command Transactions page** — already sortable, and still mock data (dual-ack
  **D7**). Wiring it to real data is that item's job, not this plan's.

---

## Execution order

1. **B1** ✅ — done 2026-08-01.
2. **I1** ✅ — done 2026-08-01.
3. **I3** ✅ — done 2026-08-01.
4. **I2** ✅ — done 2026-08-01.

---

## Verification

| Item | How | Kind |
|---|---|---|
| B1 | Seed > `PAGE_SIZE` rows; returned count must equal the SQL count; incomplete notice renders at the ceiling | machine-verifiable |
| I1 | Every header sorts and toggles; numeric columns compare numerically; null `releasedAt` sorts last | needs-live-environment |
| I2 | ✅ Comparator simulated (4 options, same-day tiebreak, mixed case); `grep -c useState` → 0; tsc + build 0 | machine-verified; placement needs-live-environment |
| I3 | Both options reorder; `DashboardPage.tsx` still holds no `useState` | grep + needs-live-environment |
| All | `tsc --noEmit`, `npm run build`, and regenerated visual baselines for any app whose fixture changes | machine-verifiable |
