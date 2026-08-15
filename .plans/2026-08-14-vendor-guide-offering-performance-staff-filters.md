# Vendor — Getting Started guide rewrite, offering performance, staff filters

**Date:** 2026-08-14
**Last revised:** 2026-08-14 — added I8 (staff on the offering card) and I9 (staff
fetch error handling); recorded the gap-review pass in "Plan review".
**App / scope:** `vendor/` only
**Status:** COMPLETE — all six stages executed and all nine items ✅ (2026-08-14).
I1's three live checks were run against the local database through RLS and passed;
see the item for the figures and the negative control. Outstanding work is recorded
under DEFERRED and in I10 — none of it blocks what shipped.

> Four vendor-UX changes: rewrite the Getting Started guide to match what the app
> actually does today, give each offering a small financial performance modal, show
> which staff are assigned to each offering, and add status filtering to Staff.
> Theme to optimise: **say the true thing simply**, reusing the filtering, modal and
> financial-summing patterns already in the app.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Deferred; numbers are
> plan-local — qualify cross-plan references by app (e.g. "command I1").

---

## Scope

**In scope:** `vendor/` — the Getting Started guide content and tab structure, a new
per-offering performance modal, the assigned-staff list on each offering card, and
status filtering on the Staff page.

**Explicitly out of scope:**
- `booker/`, `command/`, `backbone/` — untouched. **No schema change is required**
  (see I1: every figure comes from existing tables, columns and RLS policies), so
  no migration and no approval gate on the data layer.
- `ezzy-vendor-mobile/` — it carries its own guide copy
  (`ezzy-vendor-mobile/src/components/dashboard/GuideCard/guideItems.ts`). It will
  drift from the web guide after this work; recorded as **D1**, not fixed here.

**No blockers were found.** Everything below is IMPORTANT-tier feature work.

---

## Investigation findings (verified in code, not assumed)

Read before planning; each claim carries its `file:line`.

### Where offering money actually comes from

| Question asked | Answer found in code |
|---|---|
| Where does the financial data live? | `booking_transactions` — `backbone/supabase/migrations/20260725000002_booking_transactions.sql`. One row **per booking**, `booking_id` is `unique`. |
| When is a row written? | Only by the `bookings_create_transaction` trigger on `is_paid` false→true. An abandoned or failed payment never produces a row. |
| Must a booking have a status to count? | The ledger stores **no** status. `payout_status` is the authoritative money state, moved by `sync_booking_payout_status()` (`20260801000003:63-95`): `completed` → `releasable`; `disputed` → back to `held`; `cancelled`/`refunded` → `reversed` **unless already `released`**. |
| Do refunds/cancellations affect it? | Yes — via `reversed`. ⚠️ `reversed` means *the vendor will not be paid*; it says nothing about the booker being refunded (`20260801000003:30-31`). Never label it "Refunded". |
| Fees/taxes? | Platform fee only, snapshotted at payment time; `platform_fee_amount + payout_amount = amount_paid` exactly, by construction in the trigger. No tax concept exists. |
| Is there an existing aggregate API? | No per-offering one. `getFinancialsForRange` (`vendor/services/transactions.service.ts:196`) aggregates by **date range**, not by offering. The summing itself is already factored out and unit-tested in `vendor/lib/financials.ts`. |
| Is there an offering column on the ledger? | **No.** Offering must be reached through `bookings.offering_id`. |

**Consequence:** the modal reuses `summariseFinancials` (`lib/financials.ts:72`)
verbatim. The only new logic is *which rows to fetch* — no second copy of the
money rules.

### How staff attach to offerings (for I8)

- **The join table is `staff_specialties`** — `backbone/supabase/migrations/20260507000001_staff.sql:117-124`,
  primary key `(staff_id, offering_id)`. So the relationship is many-to-many and
  **one person can cover several offerings** — the guide claim in I5 is true by
  construction, not by convention.
- **A vendor-match trigger already guards it** (`:159-160`): the offering must
  belong to the same vendor as the staff member. No cross-vendor leak is possible.
- **RLS and grants already exist** (`:166-190`, `20260620000001:57`). Reading it
  needs nothing new.
- **The data is already in memory.** `useAppShell.ts:267` fetches `getStaff` once
  per vendor and the shell holds it; `staff.service.ts:47-49` already joins
  `staff_specialties(offerings(code))` into `Staff.specs`. `AppShell.tsx:93` just
  does not pass `staff` to `OfferingsPage` yet, though it passes it to StaffPage
  (`:88`) and SchedulePage (`:87`). **I8 therefore needs zero new queries** — the
  same "derive from what the shell already holds" move as `bookingCounts`
  (`useOfferingsPage.ts:30-32`).
- ⚠️ **`Staff.specs` holds offering CODES, not ids.** Codes are unique per vendor
  (`offerings_vendor_code_unique`, `20260506000001:31`) so matching on them is
  unambiguous *at a point in time*, and `ScheduleFormModal.tsx:50` already matches
  that way. But see **Design note C** — matching by code has a live staleness bug
  on this particular page, and I8 must not reuse that pattern.
- **Only active staff can be scheduled** — `ScheduleFormModal.tsx:50` filters
  `status === "active"` *and* matching specialties. This is why I8 renders status.

### Existing patterns to reuse

- **Paging is mandatory, not optional.** `lib/pagedFetch.ts` exists because
  PostgREST caps responses at 1000 rows and signals it with a 206 that supabase-js
  does not surface as an error; one measured vendor's payout was understated 19.7%
  (`lib/pagedFetch.ts:6-10`). Any new ledger query goes through `fetchAllPages`.
- **Stable sort on paged reads** — `.order("created_at").order("id")`
  (`transactions.service.ts:131-133`); without the tiebreaker rows duplicate or
  vanish across page boundaries.
- **Inner-join filtering** — filtering an embedded resource needs `!inner` or the
  parent rows are not excluded. Precedent in the ecosystem:
  `booker/services/schedules.service.ts:44`, `booker/services/vendors.service.ts:40`.
- **Modals** — two shapes exist. `ModalOverlay` (`components/ui/ModalOverlay/`),
  used by `OfferingFormModal.tsx:21`-ish and `StaffFormModal.tsx:21`, is a bare
  click-out backdrop with **no focus trap, no Escape, no scroll lock**. `GuideModal`
  uses Radix Dialog and says outright why (`GuideModal.tsx:12-25`): the packages
  were already dependencies, Radix supplies the focus trap and Escape handling, and
  converting the three form modals is separate work. See **Design note A**.
- **Filters** — three different filter idioms are live: `FilterTabs`
  (`components/ui/FilterTabs/FilterTabs.tsx`, currently only rendered by
  `app/ui-gallery/page.tsx:373`), an inline hand-rolled copy of the same markup in
  `BookingsPage.tsx:40-59`, and rounded pills in `OfferingsPage.tsx:41-47`. See
  **Design note B**.
- **Money formatting** — `fmtPeso` (`lib/utils.ts:163`), `0` decimals for summary
  cards, `2` for line items. One formatter; do not add another.

### Guide-accuracy audit — what is currently wrong

Current items: `vendor/components/dashboard/GuideModal/guideItems.ts:22-66`.

| Existing copy | Verdict |
|---|---|
| "Offerings & Staff" as one item | Understates both, and the ask splits them. |
| "only active staff can be assigned to schedules" | **True** — `ScheduleFormModal.tsx:50` filters `status === "active"` *and* matching specialties. Keep, and reuse in the Staff section. |
| "Assign an staff and set a max capacity" (Schedule) | Grammar defect; also "max capacity" is now `capacity_per_slot`-shaped. Reword. |
| Bookings: "confirmed, completed, and cancelled … use the filters" | Stale. There are nine statuses grouped into six filter tabs (`lib/utils.ts:65-74`) plus a service-date range and four sort options (`useBookings.ts:20-27`). "Track completion rates over time" describes nothing that exists. |
| No Dashboard section | Missing, and the dashboard is the landing page with the app's most confusable control (one Period, two clocks). |
| No Transactions section | Missing entirely. |

### Facts the new guide copy must get right (all verified)

- One Period control drives Operations **and** Earnings, but they count on
  different clocks: `bookedDate` (booked FOR) vs `created_at` (money received) —
  `useDashboardPage.ts:14-24`, `useFinancialSummary.ts:44-50`.
- Pending Approvals and Today's Schedule deliberately **ignore** the Period, and
  navigate carrying no range (`DashboardPage.tsx:55-79`). Only Completed and the
  Earnings cards carry it (`DashboardPage.tsx:87`, `:100`).
- Bookings' red badges count over the **unfiltered** array on purpose
  (`useBookings.ts:79-84`).
- Transactions: date range is applied **server-side**; search and offering are
  applied **client-side within the fetched range** (`useTransactionsPage.ts:20-27`).
- Struck-through amounts mean not-counted, with two distinct reasons
  (`lib/utils.ts:154-159`, rendered `TransactionRow.tsx:16,52`).
- Printing renders every filtered row, not just the current page
  (`architecture/conventions.md:477`).
- Inactive offerings drop out of the booker wizard; a duration granularity flip is
  blocked while schedules use the offering (`useOfferingsPage.ts:58-79`).

---

## IMPORTANT

### I1 — Per-offering ledger query  ✅ DONE (2026-08-14)
**File:** `vendor/services/transactions.service.ts` (new export, ~after `:238`)

No API today returns money for one offering; the Transactions page's offering
filter is client-side over `offeringName` (`useTransactionsPage.ts:132`) — free
text a vendor can rename, which would silently re-attribute history. Same trap
`bookingCounts.ts:26-29` already documents.

**Fix approach:** add

```ts
export async function getOfferingFinancials(
  vendorId: string,
  offeringId: string,
): Promise<FinancialsResult>
```

mirroring `getFinancialsForRange` (`:196-238`) exactly, differing only in the
predicate:

- `.select("amount_paid, platform_fee_amount, payout_amount, payout_status, bookings!inner(offering_id)", { count: "exact" })`
- `.eq("vendor_id", vendorId)` and `.eq("bookings.offering_id", offeringId)`
- `!inner` is **load-bearing** — without it PostgREST filters the embedded object
  but still returns the parent row, so every one of the vendor's transactions
  would be summed for every offering.
- Same `fetchAllPages`, same `.order("created_at").order("id")` tiebreaker, same
  `{ ...ZERO_TOTALS, complete: false, error }` failure shape so the modal can
  render "—" rather than an authoritative ₱ 0.
- No date range: **all time** (Decision D-b).
- Keyed on `offering_id`, never `offeringCode`.

**Risk surface:** read-only; RLS already scopes `booking_transactions` to the
vendor's own rows (`20260725000002`, "vendor admins select own
booking_transactions") and the embedded `bookings` read is the same one the
Transactions page already performs. No new exposure, no new grant.

**⚠️ This function cannot be unit-tested** — it imports `@/lib/supabase/client`,
which is exactly why the summing lives in `lib/financials.ts` instead
(`financials.ts:3-7`). Its correctness therefore rests entirely on the live check
below; do not let a green `npm test` stand in for it.

**Verification:** machine — `npx tsc --noEmit`. Needs-live-environment, and all
three are required:
1. **`!inner` really excludes** — an offering's Gross must not equal the vendor's
   whole-ledger Gross. Check against a vendor with at least two offerings that both
   have payments; a missing `!inner` shows both cards the same total.
2. **The `count: "exact"` respects the embedded filter** — if the server counts
   unfiltered rows, `fetchAllPages`'s completeness logic (`pagedFetch.ts:96,111`)
   would report `complete: false` on a complete result and the caption would claim
   partial data. Compare `total` against the row count actually returned.
3. **Cross-check the figure** against the Transactions page filtered to the same
   offering — comparing Gross against that page's *row set*, not against its
   summary card, which is computed on a narrower payable-only basis
   (`useTransactionsPage.ts:146-156`).

<!-- ✅ DONE (2026-08-14) -->
**Written 2026-08-14** as `getOfferingFinancials(vendorId, offeringId)` in
`services/transactions.service.ts`, exactly as specified: `bookings!inner`,
filtered on `offering_id`, no date range, `fetchAllPages` with the
`created_at`/`id` stable sort, `{ ...ZERO_TOTALS, complete: false, error }` on
failure, sums delegated to `summariseFinancials`.

**Was held at 🔄 until 2026-08-14**, deliberately: the code compiled and built, but
every claim that actually mattered — that `!inner` excludes other offerings' rows,
and that `count: "exact"` respects the embedded filter — was unverifiable without a
live database, and marking it DONE on a green `tsc` would have been exactly the
"should work" the status model exists to prevent. It has since been verified; the
results are below.

**What raises confidence short of that:** the `!inner` + `.eq("embedded.column", …)`
shape is not novel here — `booker/services/schedules.service.ts:44,48` uses the
identical construction in production (`offerings!inner(...)` +
`.eq("offerings.code", …)`). That is a precedent for the *syntax*, not proof for
*this* query: different table, and no existing call in any app combines an embedded
filter with `count: "exact"`, which is the specific interaction check 2 targets.

<!-- ✅ DONE (2026-08-14) — live-verified against the local Supabase -->
**All three checks RUN and PASSED (2026-08-14), against the local database, over
HTTP, through RLS as a real signed-in vendor-admin** (`marco@bookdeck.com`) — not
via psql and not via `service_role`, so the policy path is included in the result.
Vendor `10000000-…-0001` holds 35 transactions totalling ₱35,660 across four
offerings with payments.

| Check | Result |
|---|---|
| 1. `!inner` excludes other offerings' rows | **Pass.** COACH 17 rows/₱20,400 · COURT 16/₱13,600 · BIKE 1/₱810 — each matches the SQL ground truth exactly, and none returns the vendor-wide 35/₱35,660. |
| 2. `count: "exact"` respects the embedded filter | **Pass.** `Content-Range: 0-16/17` for COACH — the count is the FILTERED total, not 35. So `fetchAllPages` computes `complete = 17 >= 17 = true` and the caption does not falsely claim partial data. |
| 3. Figures cross-check | **Pass.** Per-offering gross over the API equals the per-offering `sum(amount_paid)` computed directly in Postgres. |

**Negative control, and this is the part worth keeping.** The same request with
`bookings(...)` instead of `bookings!inner(...)` returns **35 rows / ₱35,660** for
BIKE — the entire vendor ledger — instead of 1 / ₱810. The `!inner` is therefore
demonstrably load-bearing rather than incidental: without it every offering shows
identical totals, and nothing in the type system, the build or the test suite would
have objected. Re-run that comparison if the select string is ever edited.

**Verified:** the three checks above · `npx tsc --noEmit` clean · `npm run build`
compiled · no new lint findings.
**Still not covered by automation:** the query itself remains unit-untestable (it
imports the Supabase client), and no seeded vendor exceeds the 1000-row page size,
so `fetchAllPages`' multi-page path is exercised only by `pagedFetch.test.ts`, never
end to end.

### I2 — `payableCount` on `FinancialTotals`  ✅ DONE (2026-08-14)
**File:** `vendor/lib/financials.ts:40-101`, `vendor/lib/financials.test.ts:81`

The modal's caption states how many bookings are completed. `summariseFinancials`
already walks every row and already applies `isPayable` (`:89`) but only exposes
`countedRows` (non-reversed) — not the payable count.

**Fix approach:** additive only.
- `FinancialTotals` (`:40-55`): add `/** Rows counted in `payout` — the completed-and-payable ones. */ payableCount: number`.
- `ZERO_TOTALS` (`:57-60`): add `payableCount: 0`.
- In the loop (`:89`): `if (isPayable(row.payoutStatus)) { payoutC += …; payableCount++ }`.
- Extend the "payable split" test block (`financials.test.ts:81`) to assert the
  count alongside the existing sums.

**Rejected alternative:** counting payable rows inside the new service function.
That would put the payable rule in a second place; `lib/financials.ts:20-27`
exists precisely so the ledger's summing rules live once. Existing consumers
(`FinancialSummary.tsx`, `useFinancialSummary.ts`) read named fields and are
unaffected by an added one.

**Verification:** machine — `npm test` (node --test over `lib/**/*.test.ts`).

<!-- ✅ DONE (2026-08-14) -->
**Executed 2026-08-14.** Field added to `FinancialTotals` and `ZERO_TOTALS`,
incremented in the payable branch of the reducer. Three new tests in the
"payable split" block: `payableCount` ≠ `countedRows` when rows are held, a
reversed row is never payable, and everything-held gives `payableCount: 0` with
`onHold === net`.

**One consumer the plan did not name.** Making the field required broke two
hardcoded `FinancialTotals` literals in `app/ui-gallery/page.tsx:228,242` — caught
by `tsc`, which is exactly the safety net a required field is for. Both were given
values that are *internally coherent* rather than merely type-satisfying (19 of 24
rows payable, matching the payout/net ratio; and `payableCount = countedRows` in
the variant that sets `onHold: 0`). A fixture that contradicts itself is worse than
none, because I3 will read these same numbers.

**Verified:** `npm test` 132/132 (up from 129) · `npx tsc --noEmit` clean ·
`npm run build` compiled successfully. Nothing needs a live environment — this is
a pure function with unit coverage.

### I3 — `OfferingPerformanceModal`  ✅ DONE (2026-08-14)
**Files (new):** `vendor/components/offerings/OfferingPerformanceModal/OfferingPerformanceModal.tsx`
and `useOfferingPerformance.ts`

**Component-separation compliance (stated, not assumed —
`.claude/skills/component-separation/SKILL.md`):**
- `useOfferingPerformance.ts` owns **all** state: the fetch, the loading flag, the
  error, the request-sequence guard, and the derived average. Mirrors
  `useFinancialSummary.ts`.
- `OfferingPerformanceModal.tsx` is a pure render layer — no `useState`,
  no `useEffect`, no business logic.
- Styling is Tailwind + `sp-*` tokens, matching `OfferingFormModal`/`GuideModal`.
  No `.module.css` needed (no awkward geometry — `conventions.md:472` reserves
  modules for that). The only inline `style` permitted is the data-driven category
  colour already used on `OfferingCard.tsx:28`, if the header carries the code chip.

**Content (Decision D-a), all time, one fetch on open:**

| Tile | Value | Sub-label |
|---|---|---|
| Gross income | `totals.gross` | `{countedRows} payments` |
| Net income | `totals.net` | `after platform fee` |
| Paid bookings | `totals.countedRows` | `payments received` |
| Avg per booking | `gross / countedRows` | `across paid bookings` |

Caption beneath, assembled from the same totals — required, not decorative, for
the same reason `useFinancialSummary.ts:114-131` requires one: these figures use a
basis the Transactions page does not share, and unlabelled they look like a
contradiction.

- `"{payableCount} completed · {fmtPeso(onHold,0)} net still on hold"` (drop the
  second clause when `onHold === 0`)
- `"Excludes {reversedCount} reversed payout(s)"` — only when `> 0`
- `"All time"` always
- `"figures cover part of this period only"` when `complete === false`

⚠️ **The word "net" in that first line is load-bearing — do not drop it as
clutter.** `onHold` is `net − payout` (`financials.ts:98`), so it is an
**after-fee** figure, while the tile it sits beneath is **Gross**. Unqualified,
"₱23,400 still on hold" invites the reader to subtract it from the gross headline,
which is wrong by the platform fee. `FinancialSummary.tsx:103-104` gets away with
the bare phrasing because there it sits under the Payout card, whose value is
already net-basis; here the neighbour is different, so the label has to do the work
the position no longer does. "Net" is the right word rather than "after fee"
because the dashboard already labels that figure "Net Income · After platform fee"
— same vocabulary, one surface to the next.

**Guards, copied from the patterns that earned them:**
- Loading and error render `"—"`, never `₱ 0` (`FinancialSummary.tsx:38`).
- `countedRows === 0` → an empty state ("No payments yet for this offering"), not a
  `₱ 0 / 0 / NaN` grid. **The average must never divide by zero.**
- A `reqSeq` ref guard as in `useFinancialSummary.ts:57` — cheap, and the modal can
  be reopened on a different offering before the first fetch lands.

**Verification:** machine — `tsc --noEmit`, lint, plus a `/ui-gallery` tile (I7)
giving the visual suite light+dark coverage. Needs-live-environment — an offering
with zero payments, one with held-only payments, and one with a reversed row.

<!-- ✅ DONE (2026-08-14) -->
**Executed 2026-08-14.** `useOfferingPerformance.ts` + `OfferingPerformanceModal.tsx`
created. Radix Dialog per Design note A; four `sp-sub` tiles (the in-card stat
pattern `StaffCard.tsx:55` already uses — nesting `sp-card` inside the modal's own
`sp-card` would have been the wrong reuse); Tailwind colour utilities rather than
the inline `style={{ color }}` StaffCard uses, so the render layer carries no
inline styles at all.

**Two departures from the written item, both deliberate:**
1. **The component is pure and the hook is called by the page**, rather than the
   component calling its own hook. This mirrors `FinancialSummary` /
   `useFinancialSummary` exactly, and `OfferingsPage.tsx` now calls two hooks the
   way `DashboardPage.tsx:34,40` does. The reason is I7: a component that fetches
   its own data can only be shown to the visual suite in its empty state, whereas
   a pure one can be handed fixture totals and give real coverage of the populated
   state. `useOfferingPerformance` takes a **nullable** `offeringId` so the page can
   call it unconditionally without breaking the rules of hooks.
2. **A fifth state, `reversed-only`, was added** — not in the plan. The plan's
   empty state keyed on `countedRows === 0`, which is also true for an offering
   whose every payment was reversed. Telling that vendor "No payments yet" would be
   false: it sold, and the payouts were reversed. `PerformanceState` now
   discriminates `loading | error | empty | reversed-only | ready`, and the average
   is only ever computed under `ready`, which is exactly `countedRows > 0` — the
   divide-by-zero cannot be reached.

**Verified:** `npx tsc --noEmit` clean · `npm run build` compiled · `npm test`
132/132 · `npx eslint components/offerings/OfferingPerformanceModal` reports
nothing.
**Not verified — no live environment:** every state except by construction. The
modal's own states are covered from I7 onward, and the query feeding it (I1) was
live-verified on 2026-08-14.

### I4 — "Performance" action on the offering card  ✅ DONE (2026-08-14)
**Files:** `vendor/components/offerings/OfferingCard/OfferingCard.tsx:90-97`,
`vendor/components/offerings/OfferingsPage/OfferingsPage.tsx:56-67`,
`vendor/components/offerings/OfferingsPage/useOfferingsPage.ts`

**Fix approach:**
- `OfferingCard`: one new prop `onViewPerformance: () => void`, rendered as a third
  button in the existing action row alongside Edit and Delete, styled as the Edit
  button is (bordered, transparent) with a `BarChart3` icon. Label **"Performance"**
  (Decision D-d). The card stays a pure display component — it gains a callback,
  not state. Delete-confirm branch (`:82-88`) is untouched, so the destructive
  confirmation still owns the row when active.
- Three buttons is the established density: `StaffCard.tsx:80-90` already renders
  Edit + Schedule + icon-only Delete. If the row gets tight at the narrowest
  breakpoint, Delete drops to icon-only exactly as StaffCard does — no new pattern.
- `useOfferingsPage`: one new piece of state, `perfTarget: Offering | null`, with
  `openPerformance(o)` / `closePerformance()`. It does **not** touch `oModal`, which
  is the add/edit form's discriminator — overloading it would let the form and the
  performance modal open together.
- `OfferingsPage`: render `{perfTarget && <OfferingPerformanceModal … />}` beside
  the existing `{oModal && …}` block (`:77-86`).
- **No financial data is added to the card itself**, per the ask. The existing
  live-booking badge (`OfferingCard.tsx:35-39`) stays as it is.

**Verification:** machine — `tsc --noEmit`, `/ui-gallery` offering tiles re-render.
Needs-live-environment — open/close, and confirm the delete-confirm state and the
performance modal cannot both be active.

<!-- ✅ DONE (2026-08-14) -->
**Executed 2026-08-14.** `onViewPerformance` added to `OfferingCard` as a required
prop; `perfTarget` / `openPerformance` / `closePerformance` added to
`useOfferingsPage` **separately from `oModal`**, so the form and the performance
modal cannot open together. `OfferingsPage` renders the modal beside the existing
form-modal block.

**Responsive handling the plan left open.** The plan said Delete would drop to
icon-only "if the row gets tight". Instead the **new** button's label is hidden
below `sm` (`hidden sm:inline`) and the button keeps an accessible name via
`aria-label`. That keeps the two long-standing actions unchanged at every width —
the new arrival absorbs the constraint it introduced, rather than degrading Delete,
whose text is the safeguard on a destructive action.

**Verified:** `npx tsc --noEmit` clean (it caught all three `/ui-gallery`
`OfferingCard` tiles missing the required prop, as intended) · `npm run build`
compiled · no new lint findings.
**Not verified — no live environment:** open/close behaviour and the
delete-confirm/modal mutual exclusion, which is guaranteed by construction (two
independent state slots, and the delete-confirm branch replaces the action row) but
not exercised.

### I5 — Rewrite the Getting Started guide  ✅ DONE (2026-08-14)
**Files:** `vendor/components/dashboard/GuideModal/guideItems.ts:22-66` (content),
`vendor/components/dashboard/GuideModal/GuideModal.tsx` (tip copy only),
`vendor/visual-tests/pilot.spec.ts:481-511` (assertions)

**Structure — 7 tabs** (Decision D-c). Approvals folds into Bookings, because
approving is done from the Bookings "Needs you" filter and that section is being
rewritten around the filters anyway. "Completing" stays its own tab because it
renders the shared `BOOKING_ACTIONS` glossary — the copy that tells a vendor when
they get paid — and burying it inside Bookings hides it.

Tab order matches the app's own navigation order. **The exact `tabLabel` strings**,
fixed here so nobody invents sentence-length ones (`guideItems.ts:8-14` records that
long labels overflowed the strip and clipped the last tab with no indication):

| # | `tabLabel` | Panel `title` |
|---|---|---|
| 1 | `Dashboard` | Your Dashboard |
| 2 | `Bookings` | Bookings |
| 3 | `Offerings` | Offerings |
| 4 | `Staff` | Staff |
| 5 | `Schedule` | Schedule Management |
| 6 | `Transactions` | Transactions |
| 7 | `Completing` | Completing a Booking |

**No change to `GuideModal.tsx` is needed at all.** The tab strip already scrolls
horizontally rather than wrapping (`GuideModal.tsx:71-77`), the panel already
scrolls independently (`:67-68`), the `actions` glossary list already exists
(`:108-119`), and the default tab is derived as `GUIDE_ITEMS[0].title` (`:69`) so
it follows the array. **This item edits `guideItems.ts` and the tests, nothing else.**

**The bottom Tip stays verbatim** (`GuideModal.tsx:136-138`). It was re-checked in
this audit and is still true (`ScheduleFormModal.tsx:50` enforces exactly what it
claims), and `pilot.spec.ts:505` asserts its text. Changing it would break that
assertion for no gain.

**Content.** Every claim below was verified in the audit above; the `actions`
glossary is used where a section carries several distinct controls, which is what
it was added for (`guideItems.ts:17-19`).

1. **Dashboard** — one Period control, two clocks, and which widgets ignore it.
   Glossary: Pending Approvals (live queue, ignores the Period, opens Bookings on
   "Needs you"), Today's Schedule (always today, opens the Calendar), Completed
   (follows the Period, opens Bookings on "Done" **with the same dates already
   applied**), Earnings cards (payments received in the Period; any of them opens
   Transactions **with the same dates already applied**).
2. **Bookings** — what the area is for; the badges count outstanding work across
   all dates and never shrink because of a filter. Glossary: the six filter tabs in
   `lib/utils.ts:67-74` wording — Needs you / Active / Done / Issues / Closed — plus
   "Service date" naming its clock explicitly against Transactions'.
3. **Offerings** — what an offering is (bookable thing: name, code, price, duration
   unit, requirements) and that inactive ones leave the booker's wizard. Glossary:
   Active/Inactive pill, **Performance** (the new modal), Edit (incl. the
   granularity-flip block), and **Staff** — the card lists who is assigned (I8),
   assignment itself happens from the Staff page via specialties, and one person can
   cover several offerings.
4. **Staff** — the people who deliver offerings; schedules are assigned to a person,
   so status matters. Glossary: Specialties (which offerings they can be booked
   for, many per person), Active (assignable to schedules — `ScheduleFormModal.tsx:50`),
   On Leave (temporarily unavailable, keeps their specialties), Inactive (kept for
   history), and the new status Filter (I6).
5. **Schedule** — existing item, reworded: fix "an staff", and describe capacity in
   the terms the form now uses.
6. **Transactions** — the paid-bookings ledger. Glossary: Date range (payment date,
   **and this is what a dashboard Earnings card hands over**), Offering, Search
   (both narrow *within* the selected dates — `useTransactionsPage.ts:20-27`),
   struck-through rows (held = not yet, reversed = not ever — the two reasons from
   `lib/utils.ts:154-159`; **never call reversed a refund**), and Print (every
   filtered row, not just the current page).
7. **Completing** — unchanged. Keeps deriving from `BOOKING_ACTIONS` filtered to
   `stage === "fulfilment"` (`guideItems.ts:62-64`). **Do not inline this copy.**

**Concision guard:** each `body` stays one short paragraph, and each glossary entry
one line. Sections without several distinct controls (Schedule) get no glossary.

**Test updates required — the guide is behaviourally tested:**
- `pilot.spec.ts:481` `toHaveCount(5)` → `7`.
- `:482` default selected tab `"Approvals"` → `"Dashboard"`.
- `:486-490` arrow-key walk → the new first three tabs.
- `:508` the reachability loop's tab-name list → the seven new labels.
- `:493-503` (the "Completing" glossary must not leak approval actions) stays
  as-is — that rule is unchanged and is the assertion most worth keeping.
- The `guide-light`/`guide-dark` snapshots will change and must be regenerated
  deliberately, not with a blanket `--update-snapshots` across the suite.

**Verification:** machine — `npx playwright test -g "guide"` after regenerating the
two guide snapshots. Needs-human — a read-through for truthfulness; the entire
point of this item is that the guide currently says things the app does not do.

<!-- ✅ DONE (2026-08-14) -->
**Executed 2026-08-14.** `guideItems.ts` rewritten to the seven tabs in the table
above, with the glossary used on five of them. "Completing" still derives from
`BOOKING_ACTIONS` filtered to `stage === "fulfilment"` — not inlined. Tip left
verbatim, as specified.

**⚠️ The plan was wrong that `GuideModal.tsx` needed no change — the screenshot
proved it.** Seven tabs overflow the 560px dialog at every width, so the seventh
rendered as a hard-clipped "Com" with nothing indicating the strip scrolls. That is
*exactly* the defect `guideItems.ts:8-14` records from the five-tab version, and
the plan reasoned "the strip already scrolls, so seven is fine" without checking
what a scrolled-and-clipped strip looks like. A right-edge fade mask (28px, with
the `-webkit-` prefix) now makes the cut read as "more this way". **Caught only by
opening the regenerated PNG** — every assertion, including the seven-tab count,
passed while it looked broken. Worth remembering: `toHaveCount(7)` cannot see
clipping.

**Test coverage strengthened beyond the plan.** The plan only required updating the
existing assertions to the new labels. Three content assertions were added, on the
claims most likely to rot: the Dashboard panel's "booked FOR" two-clocks
explanation, the Transactions panel's "payment was received" clock, and the Staff
panel carrying "On Leave" and "Specialties". A stale guide otherwise fails silently
in every way a test can see.

**Verified:** `npx playwright test -g "getting started guide"` — 1 passed (7 tabs,
arrow-key walk, the approval-actions-must-not-leak rule, all seven panels
reachable, and the new content assertions) · both guide baselines regenerated and
passing · `npx tsc --noEmit` clean · **the light baseline was inspected by eye**,
which is what found the clipping.
**Note on baselines:** `visual-tests/pilot.spec.ts-snapshots/*.png` is gitignored
(`.gitignore:53`), so these are local-only and will regenerate on another machine.
**Not verified — needs a human:** a full read-through of the copy for truthfulness.
Every claim was checked against `file:line` while writing, but that is the author
checking their own work.

### I6 — Staff status filter  ✅ DONE (2026-08-14)
**Files:** `vendor/components/staff/StaffPage/useStaffPage.ts:14,19`,
`vendor/components/staff/StaffPage/StaffPage.tsx:25-51`

The status model already exists and is three-valued — `StaffStatus = "active" |
"on-leave" | "inactive"` (`lib/types.ts:16`), stored as `active | on_leave |
inactive` and mapped at the service boundary (`staff.service.ts:25-33`). **No new
status concept is introduced.** `StaffStatBar.tsx:10-15` already counts all three.

**Fix approach:**
- `useStaffPage`: add `statusFilter: "all" | StaffStatus`, default `"all"`
  (Decision: All is the default — the page has always shown everyone, and a
  default that hides staff on first load would read as data loss). Compose with the
  existing search rather than replacing it: `filtInst` filters on status **and**
  name.
- `StaffPage`: render `<FilterTabs>` from `components/ui/FilterTabs/FilterTabs.tsx`
  with `All · Active · On Leave · Inactive`, placed between the search row and
  `StaffStatBar` (Design note B).
- **Do not pass `badge`.** `FilterTabs` renders badges in red
  (`FilterTabs.tsx:26-28`), which in this app means "work outstanding"
  (`BookingsPage.tsx:53-55`); a red "4" next to Active would misread as an alert.
  The counts already live in `StaffStatBar` directly below.
- All four tabs render always, including Inactive at zero. `StaffStatBar:13` hides
  its Inactive *stat* at zero, which is right for a stat and wrong for a control —
  a filter that appears and disappears as data changes is not predictable.
- **`StaffStatBar` stays a display, not a control.** Making its cards clickable is
  the tempting reuse (it already counts by status), but it also carries a
  "Total Clients" card that filters nothing, and it hides Inactive at zero — so
  two of its four cards would behave differently from the others. Counts stay in
  the stat bar directly below the tabs; the tabs do the filtering.
- **Empty state (new, and required).** `StaffPage.tsx:37-51` renders a bare grid
  with no zero-result branch. Today that is only reachable by search; a status
  filter makes it trivially reachable. Per I9 this is **three** states, not one —
  "could not load staff" / "no staff yet" / "no staff match this filter", the last
  offering a way to clear. A single "No staff found." would state a falsehood on a
  failed fetch, which is precisely the defect I9 exists to close.
  (`.claude/skills/ux-design/SKILL.md` — state handling.)
- **A card leaving the list on a status toggle is correct, not a bug.** The status
  pill cycles active → on-leave → inactive (`useStaffPage.ts:48-58`), so toggling a
  card while the Active tab is selected removes it from view. Keeping it would show
  a row that contradicts the active filter. Do not "fix" this; the stat bar above
  updates at the same moment, which is the feedback that the change landed.

**Component separation:** all filter state lives in `useStaffPage`; `StaffPage.tsx`
stays a render layer; `FilterTabs` is already a controlled pure component.

**Verification:** machine — `tsc --noEmit`, lint, plus a `/ui-gallery` tile (I7).
Needs-live-environment — filter + search compose, and toggling a card's status pill
(`useStaffPage.ts:48-58`, which cycles active → on-leave → inactive) moves that card
out of a narrowed list rather than leaving a stale row behind.

<!-- ✅ DONE (2026-08-14) -->
**Executed 2026-08-14.** `StaffStatusFilter` + `STAFF_STATUS_FILTERS` +
`statusFilter` / `hasFilters` / `clearFilters` added to `useStaffPage.ts`; the
render layer gained the `FilterTabs` row and the three zero states. Status and
search compose as specified; `StaffStatBar` still receives the **unfiltered**
`staff` so the counts stay a readout of the whole roster.

**Verified:** `npx tsc --noEmit` clean · `npm run build` clean · `npm test`
129/129 · `npx eslint` reports nothing on `components/staff/StaffPage/**` or
`services/staff.service.ts`.
**Not verified — no live environment:** filter × search composition, the
status-toggle-removes-row behaviour, and the rendered appearance of the three zero
states. **These paths also have no automated coverage yet** — `/ui-gallery` renders
`StaffCard` and `StaffStatBar` directly (`:294-298`) but never `StaffPage`, so
nothing exercises the filter row or the zero states until I7. See the addition
recorded on I7.

### I7 — `/ui-gallery` fixtures for the new surfaces  ✅ DONE (2026-08-14)
**File:** `vendor/app/ui-gallery/page.tsx`

The gallery is the visual suite's offline fixture and already carries tiles for
`OfferingCard` (`:161-163`), `StaffCard` (`:296-298`), `StaffStatBar` (`:294`) and
a pinned-open `GuideModal` (`:198-202`). New UI without a tile has no light/dark
coverage.

**Fix approach:** add a pinned-open `OfferingPerformanceModal` mode (following the
`GuideModal` fixture's shape) with static totals passed in, and a `FilterTabs` tile
already exists at `:373` — extend the Staff section to render the page's real
filter row instead. The modal fixture must render **without a network call** —
`useFinancialSummary.ts:64` documents that an empty `vendorId` is the gallery's
offline guard, so `useOfferingPerformance` must adopt the same `if (!vendorId)
return` guard or the visual suite stops being deterministic.

**Added 2026-08-14 after Stage 1.** The gallery renders `StaffCard` and
`StaffStatBar` directly (`:294-298`) but **never `StaffPage`**, so I6's filter row
and I9's three zero states currently have no coverage of any kind. This item must
therefore add a `StaffPage`-level fixture, not just a `FilterTabs` tile — with at
least the "could not load" and "no staff match this filter" states pinned, since
those are the two that can silently regress into stating a falsehood.

**Also required, and easy to miss:** I4 and I8 both add **required** props to
`OfferingCard`, so the three existing gallery tiles (`:161-163`) stop compiling
until they pass them. That is the intended safety net, not an obstacle — but the
fixtures must be given *meaningful* values, not `[]` and `noop`: at least one tile
needs assigned staff including a non-active member, and one needs none, or the
snapshots cover neither branch of I8. The `STAFF` fixture at `:115` already has
mixed statuses to draw from.

**Verification:** machine — `npx playwright test` for the new tiles' snapshots.

<!-- ✅ DONE (2026-08-14) -->
**Executed 2026-08-14.** Three new modes — `performance` (the modal pinned open
with fixture totals, i.e. the POPULATED state), `staffpage` (the real page with its
filter row), `staffstates` (the failed-load and no-staff-yet zero states side by
side) — six new baselines. The `OfferingCard` tiles were wired during Stages 3–4
because the required props made them a compile blocker; a separate `OFFERING_STAFF`
fixture keeps the extra people out of the Staff-page baselines.

**The interactive state got a behavioural test instead of a baseline.** "No staff
match this filter" is only reachable by clicking, so a static screenshot cannot
cover it. Two tests were added: the filter narrows the list and explains itself
when nothing matches (with a working Clear filters), and a failed load never
renders as an empty roster.

**A shared component changed, which the plan did not anticipate.** Writing that
test surfaced a real a11y defect: `FilterTabs` had no accessible group name, and
its labels collide with the status pill on every `StaffCard` — "Active" matched
three buttons. `FilterTabs` now takes an **optional** `label` that renders
`role="group"` + `aria-label`, the same construction `DateRangeFilter.tsx:66`
already uses for its preset row. Optional, so the existing call site is untouched.
Found by a test, not by review — the collision is invisible when reading the code.

**One layout fix from looking at the baseline.** `FilterTabs` is `flex`, so as a
direct block child it stretched the full page width, unlike the Bookings bar which
is a flex *item* and hugs its tabs. Wrapped at the StaffPage call site rather than
changing the shared component.

**Verified:** `npx playwright test` — **82 passed, 0 failed** (full suite, run twice:
once to find the two expected `offerings` baseline diffs, once green after
regenerating them) · the `performance`, `staffpage` and `offerings` baselines were
**inspected by eye**, confirming active-first chip ordering, the no-staff branch
rendering nothing, and the delete-confirm card keeping its staff list ·
`npx tsc --noEmit` clean · `npm test` 139/139 · `npm run build` compiled.

### I8 — Show the staff assigned to an offering  ✅ DONE (2026-08-14)
**Files:** `vendor/lib/offeringStaff.ts` + `offeringStaff.test.ts` (new),
`vendor/lib/types.ts:146-157`, `vendor/services/staff.service.ts:13-23,46-66,84`,
`vendor/components/offerings/OfferingCard/OfferingCard.tsx:49-58`,
`vendor/components/offerings/OfferingsPage/OfferingsPage.tsx:14-22,56-67`,
`vendor/components/offerings/OfferingsPage/useOfferingsPage.ts:13,30-32`,
`vendor/components/layout/AppShell/AppShell.tsx:93`

Nothing in the app tells a vendor who can deliver a given offering; the
relationship is only visible and editable from the Staff side
(`StaffFormModal.tsx:36-57`). A vendor looking at an offering has to open Staff and
check each person's specialties one at a time.

**Data path — no new query.** Pass the shell's existing `staff` array into
`OfferingsPage` (`AppShell.tsx:93`), exactly as `bookings` already is, and derive
the mapping in `useOfferingsPage` with a `useMemo` beside `bookingCounts`
(`:30-32`).

**Match on `offering.id`, never on `offering.code` — see Design note C.** This
requires one additive field:
- `staff.service.ts:21` — `staff_specialties: { offerings: { id: string; code: string } | null }[]`
- `staff.service.ts:84` — select `staff_specialties(offerings(id, code))`
- `staff.service.ts:47-49` — build `specIds` alongside the existing `specs`
- `lib/types.ts` `Staff` — add `/** Offering ids this person is qualified for. Kept beside `specs` (codes) because a code can be renamed and an id cannot. */ specIds: string[]`

`specs` is left exactly as it is: `StaffCard.tsx:46-48` renders it as chips and
`ScheduleFormModal.tsx:50` matches on it. **Do not "tidy" those onto `specIds`** —
that is a separate change with its own risk, and the chips genuinely want the code.

**Pure, testable derivation** in `lib/offeringStaff.ts` — own module for the reason
`bookingCounts.ts:14-16` states (`node --test` has no bundler and cannot resolve
`@/`, so anything importing the Supabase client is untestable; import types with an
explicit `.ts` extension):

```ts
/** Staff per offering id, in the order getStaff returned them (created_at). */
export function staffByOffering(staff: Staff[]): Map<string, Staff[]>
```

Sorted so **active staff come first** within each offering — the ones who can
actually be scheduled are the ones a vendor is looking for, and the cap below
would otherwise hide them behind people on leave.

**Render (Decision D-e)** — a `STAFF` block in `OfferingCard.tsx` between the
Price/Duration row (`:49-58`) and Requirements (`:60-79`), using the same
`text-[10px] font-semibold uppercase tracking-[0.8px]` label style as its
neighbours (`:51,55,62`):
- Up to **3** name chips, then a `+N more` chip. No expansion — the card is a
  summary and the Staff page is the full list.
- Non-active staff render muted with their status appended (`Jon Reyes · On leave`),
  because `ScheduleFormModal.tsx:50` will not offer them for a schedule. Status is
  carried by **text, not colour alone**.
- **Renders nothing at all when the list is empty** — "if any", and the same rule
  the booking badge already follows for the same reason (`OfferingCard.tsx:32-34`:
  hidden at zero rather than showing a `0` that reads as failure). This also means a
  slow or failed staff fetch degrades to *silence* rather than to a false "no staff
  assigned" claim. I9 covers making the failure itself visible, once, at the shell.
- ⚠️ **Do not style these chips with `TC` / `TB` from `lib/constants.ts`.** Those
  maps are keyed by offering **code** and `StaffCard.tsx:47` uses them for
  *specialty* chips. These chips are **people**; a person's name is not a key in
  those maps and would silently fall through to the default, giving a chip that
  looks deliberate and is not. Use neutral `sp-*` tokens (`bg-sp-overlay-faint`,
  `text-sp-text`) so light and dark both work — `conventions.md:470` forbids
  hardcoded per-theme colours.
- **Display-only.** No click-through to Staff: `OfferingsPage` has no navigation
  callback from the shell, and wiring one is the same cross-cutting change deferred
  as D2.

**Component separation:** `OfferingCard` stays a pure display component — it
receives `assignedStaff: Staff[]` as a required prop (required, like
`bookingCount`, so the compiler catches every call site) and holds no state. All
derivation is in `useOfferingsPage`; the mapping itself is a pure function in
`lib/`.

**Verification:** machine — `npm test` (new `offeringStaff.test.ts`: empty input,
a person on several offerings, an offering with nobody, active-first ordering, the
`>3` cap); `tsc --noEmit`; gallery snapshots. Needs-live-environment — assign a
person to two offerings from the Staff page and confirm **both** cards update
(`useStaffPage.ts:25` refreshes shell staff, so they should); rename an offering's
code and confirm the chips **stay** (the regression Design note C exists to
prevent).

<!-- ✅ DONE (2026-08-14) -->
**Executed 2026-08-14.** `lib/offeringStaff.ts` + 7 unit tests; `specIds` added to
`Staff` and populated from a single `offerings(id, code)` join so codes and ids
cannot describe different sets; `assignedStaff` derived in `useOfferingsPage`
beside `bookingCounts`; the `STAFF` block rendered on `OfferingCard` with neutral
`sp-*` chips, status in text, a 3-chip cap and an overflow chip; `AppShell.tsx:93`
now passes `staff` to `OfferingsPage`.

**Naming corrected during execution:** the derived map was first called
`staffCounts`, which is wrong — it holds people, not counts. Renamed
`assignedStaff` before it reached a second file.

**The active-first ordering is load-bearing, not cosmetic**, and now has its own
test. With a 3-chip cap, three people on leave would otherwise push the only
schedulable person into "+1 more" — answering "who can deliver this?" with exactly
the names that cannot.

**Gallery fixtures done here rather than deferred to I7**, because the required
prop made them a compile blocker. A separate `OFFERING_STAFF` array was added
rather than extending `STAFF`: the extra people exist to exercise the cap and the
non-active styling, and folding them into the Staff-page fixture would churn the
`StaffStatBar`/`StaffCard` baselines for unrelated reasons. Three tiles now cover
four-assigned-with-overflow, none-assigned, and the delete-confirm state.

**Verified:** `npm test` 139/139 (up from 132; 7 new) · `npx tsc --noEmit` clean —
it caught all three gallery tiles again · `npm run build` compiled · `npx eslint`
reports nothing on the new module, its test, `OfferingCard` or `staff.service.ts`.
**Not verified — no live environment:** that assigning a person from the Staff page
updates both cards, and the code-rename regression Design note C targets. Both need
a signed-in vendor.

### I9 — Staff fetch failures are invisible  ✅ DONE (2026-08-14)
**Files:** `vendor/services/staff.service.ts:80-89`,
`vendor/components/layout/AppShell/useAppShell.ts:158,259-267,605-610`,
`vendor/components/layout/AppShell/AppShell.tsx:88`,
`vendor/components/staff/StaffPage/StaffPage.tsx`

**Found during the gap review of this plan, not requested.** `getStaff` returns a
bare `Staff[]` and swallows every error — `if (error || !data) return []`
(`:87`) — and the shell stores it with `.then(setStaff)` (`useAppShell.ts:267`)
with no loading or error state. Bookings has exactly this covered by
`bookingsStatus`, and the comment there records why (`useAppShell.ts:269-272`): a
failed fetch "previously rendered as *you have no bookings*".

Today the consequence is a silently empty Staff grid. **This plan makes it worse in
two places**: I6 adds an empty state that would state "No staff found." on a failed
fetch — a confident falsehood — and I8's chips would silently vanish from every
offering card.

**Fix approach — minimal, mirroring the bookings precedent, not a rewrite:**
- `getStaff` returns `{ data: Staff[]; error: string | null }`. Two call sites:
  `useAppShell.ts:267` and `useStaffPage.ts:25` (`refresh`).
- Shell holds `staffError: string | null` and returns it, alongside `staff`.
- `StaffPage` renders three distinct zero states, never one: **could not load
  staff** (error), **no staff yet** (loaded, none exist — offer Add Staff), **no
  staff match this filter** (loaded, filtered to nothing — offer to clear).
- No loading flag is added. The shell renders pages before staff resolves and every
  other consumer already tolerates `[]`; a flag would need threading through three
  pages for a sub-second window. The error is the part that lies, so the error is
  the part fixed.

**Coupling:** ships **with I6** (Decision D-f). I6 creates the empty state; this is
what makes it honest. Splitting them means knowingly shipping the falsehood.

**Risk surface:** changes a service signature used in two places — the compiler
finds both. No behaviour change on the success path.

**Verification:** machine — `tsc --noEmit` (proves both call sites updated); lint.
Needs-live-environment — force a failure (offline, or a bad vendor id) and confirm
the Staff page says it could not load rather than showing an empty roster.

<!-- ✅ DONE (2026-08-14) -->
**Executed 2026-08-14.** `getStaff` now returns `StaffResult` (`{ data, error }`);
`useAppShell` holds and returns `staffError`, clearing it on vendor deselection
because "no vendor" is not a failure; `AppShell.tsx:88` passes it to `StaffPage`,
where it is a **required** prop so the compiler enforces the distinction.

**One decision taken during execution, not in the written plan.** The plan named
two `getStaff` call sites but did not say what the *second* one — `refresh()` in
`useStaffPage.ts`, run after every save — should do on failure. Setting
`staffError` there would blank a roster the vendor is looking at because a
**refresh** failed after a **save that succeeded**. It now keeps the existing list
and raises a toast ("Saved, but the staff list could not be refreshed."), leaving
`staffError` to cover the initial load, which is the case where there is nothing
worth keeping. Recorded because the plan's silence here permitted the worse option.

**Verified:** `npx tsc --noEmit` clean (proves both call sites updated) ·
`npm run build` clean · no new lint findings.
**Not verified — no live environment:** the failure path itself. Forcing a real
`getStaff` error needs a signed-in vendor session and a broken request.

### I10 — Seed coverage for the payout lifecycle  ✅ DONE (2026-08-14, not applied)
**File:** `backbone/supabase/seed.sql` — new **Block 9e**

**Found while verifying I1.** A freshly seeded database reaches `held`,
`releasable` and `reversed` but **never `released`** (Block 9d stops short). That
is not cosmetic: `released` is PAYABLE (`PAYABLE_BY_PAYOUT`, `vendor/lib/utils.ts`),
so every surface summing payouts or counting completions — the dashboard's Payout
card, the Transactions totals, and this plan's new `payableCount` — was only ever
exercised against `releasable`. A regression dropping `released` from the payable
set would pass on seeded data.

**Block 9e** releases the oldest releasable payout **per offering, only where that
offering has more than one**, so both states stay represented on the same screen.
Deterministic (ordered by `created_at, id`) and **idempotent** — the
`payout_status = 'releasable'` predicate means a second run is a no-op, so it can
be applied to an existing database without a reset.

It mirrors `release_booking_payouts` (20260801000008) with a direct UPDATE rather
than calling it, because that RPC raises `'Only Ezzy staff can release payouts'`
when there is no JWT and a seed session has none — the same accommodation Block 9d
makes for `sync_booking_payout_status()`. ⚠️ **Keep it in step with 20260801000008.**

**⏸ NOT APPLIED.** Writing DB changes is fine; running them is the user's call
(`supabase db reset` would also destroy the hand-made local data this verification
relied on). Apply standalone with
`docker exec -i supabase_db_<ref> psql -U postgres -d postgres` against the block,
or accept it on the next reset.

**Also delivered (2026-08-14): a hosted-safe demo dataset**, in
`backbone/supabase/demo/demo-seed.sql` + `demo-teardown.sql`. Distinct from both
`seed.sql` (local-only, rebuilds the world) and Block 9e: it is **additive, tagged
and reversible**, attaches to an existing vendor, and touches no row it did not
create. Every row it writes carries the id prefix `de300000-`, which is the only
thing the teardown matches on.

Three things it has to get right, all of which bit during testing:
- **Email.** `notifications_dispatch_email` (20260624000003) calls `net.http_post`
  on every notification INSERT, and the booking triggers create notifications — so
  seeding ~60 bookings on a hosted instance would send real email to real vendor
  admins. The script disables that trigger plus `bookings_notify_new` and
  `bookings_notify_status_change` for the duration. **The first draft documented
  this and did not implement it**; caught on review before it ran anywhere.
- **Placement.** `check_booking_placement` rejects a booker holding two overlapping
  bookings. The first date formula wrapped modularly and put iterations *i* and
  *i+30* on the same booker, schedule and slot. Now monotonic.
- **Fee snapshot.** `platform_fee_percent` is frozen per transaction at payment
  time, so the fee must be set in Command *before* running or every demo row shows
  ₱0 commission permanently. The script says so and deliberately does not change
  that global setting itself.

**Verified** by running the entire script against the local database inside a
transaction ending in `ROLLBACK` — every statement, constraint and trigger
exercised, nothing persisted. Result: 4 offerings (one payment-free, for the
modal's empty state), all six booking statuses non-empty, all four payout states
present per offering, payments spread across four months so the dashboard's
month-on-month deltas resolve, 5 staff across all three statuses, and **0
notifications created**, confirming the trigger suppression works. Trigger states
confirmed restored afterwards.

**Two modal states a database cannot cheaply produce were covered in the gallery
instead**, which is the cheaper and more deterministic home for them: a
`performancereversed` mode plus a behavioural test asserting an all-reversed
offering is **not** reported as having no payments. `empty` and `error` remain
without visual coverage — both are a single line of copy, and the falsehood risk
sits in the reversed case.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line remains. None remain. -->

- **D-a — Which metrics does the performance modal show?** → **Gross / Net / Paid
  bookings / Avg per paid booking, on one basis (all paid, non-reversed), with a
  caption carrying completed count, on-hold amount and reversed exclusions**
  (resolved 2026-08-14). The completed-only alternative is single-basis and simpler
  but shows ₱ 0 / 0 for an offering with ten paid-and-pending bookings, which reads
  as dead when it is selling. The gross-over-completed alternative divides two
  different bases in one number.
  **Amended 2026-08-14** — re-reviewed at the user's request; the metric set stands.
  One defect fixed in the process: the caption's on-hold figure is `net − payout`,
  an after-fee number sitting beneath a gross headline, and was unlabelled. It now
  reads `"… net still on hold"`. See the ⚠️ note under I3 — the same "two bases, one
  surface, no label" trap this option was chosen to avoid had crept into its own
  caption.
- **D-b — What period does the modal cover?** → **All time only** (resolved
  2026-08-14). Lifetime is the natural question for "how is this offering doing",
  and Transactions already offers an offering filter with a date range for period
  analysis. Keeps it to one fetch and no controls.
- **D-c — Guide tab structure?** → **7 tabs; Approvals folds into Bookings**
  (resolved 2026-08-14). Approving happens from the Bookings "Needs you" filter, so
  it belongs in that section; "Completing" stays separate because it carries the
  shared payout glossary.
- **D-d — Card action label?** → **"Performance"** (resolved 2026-08-14). Matches
  the one-word card verbs already in use (Edit, Delete, Schedule); no "View …"
  action exists on any card in the app. Modal title: "Offering Performance".
- **Design note A — modal primitive for I3.** Use **Radix Dialog**, as `GuideModal`
  does, not `ModalOverlay`. `GuideModal.tsx:12-16` already records the reasoning:
  the packages are existing dependencies, Radix supplies the focus trap, Escape and
  scroll lock that `ModalOverlay` lacks, and converting the three existing form
  modals is separate work. A new modal should not be built on the weaker primitive
  to match modals that are themselves pending conversion. Visual parity is kept the
  same way `GuideModal` keeps it — the `sp-card` shell and `sp-pill` close button.
  Not raised as an open question because the codebase already decided it in writing.
- **D-e — How do assigned staff appear on the offering card?** → **Up to 3 name
  chips plus "+N more", non-active muted with their status, nothing rendered when
  empty** (resolved 2026-08-14). Initials-only was rejected because status could
  then be carried by colour alone; a bare count was rejected because it does not
  answer "who", which is the whole question.
- **D-f — Fix the silent staff-fetch failure (I9) now?** → **Yes, ships with I6 in
  Stage 1** (resolved 2026-08-14). I6 introduces an empty state that would otherwise
  state a falsehood on a failed fetch.
- **Design note C — I8 must match on offering `id`, not `code`.** Codes are unique
  per vendor (`offerings_vendor_code_unique`), and `ScheduleFormModal.tsx:50`
  already matches `specs.includes(offering.code)`, so code-matching looks safe and
  is the tempting reuse. **It has a live bug on this exact page.** `Staff.specs` is
  built from a join to `offerings(code)` at shell-fetch time
  (`staff.service.ts:47-49`), while `handleSave` updates the offerings array
  **locally** without refetching staff (`useOfferingsPage.ts:80-82`). So editing an
  offering's code — via the Edit button that sits inches from the new staff block —
  makes every chip vanish until a page reload, with no error and no explanation.
  Matching on `offering.id` is immune: `staff_specialties` is keyed by
  `offering_id` and an id never changes on rename. The cost is one additive
  `specIds` field. Recorded here because a future reader will otherwise "simplify"
  it back to code-matching and reintroduce this.
  *(Rejected alternative: refetch staff after any offering save. Heavier — a network
  round trip on every edit — and it fixes only the case we happened to think of.)*
- **Design note B — filter idiom for I6.** Use the shared **`FilterTabs`**
  component. Three idioms exist (shared `FilterTabs`, an inline copy in
  `BookingsPage`, pills in `OfferingsPage`); `FilterTabs` is the extracted shared
  one and renders identically to the Bookings bar, so Staff gains a filter that
  already looks like the app. Deliberately **not** refactoring Bookings or
  Offerings onto it — out of scope, and AGENTS.md requires surgical changes.
- **Architecture cross-check.** Nothing here diverges from `architecture/schema.md`,
  `conventions.md` or `portals.md`: no schema change, no new table, no RLS or grant
  change, no raw SQL outside migrations, and the render/hook/style split is stated
  per component above.

---

## DEFERRED / COSMETIC

- **D1 — mobile guide drift.** `ezzy-vendor-mobile/src/components/dashboard/GuideCard/guideItems.ts`
  holds its own copy and will not match the web guide after I5. Acceptable for now:
  the mobile app is a separate repo with a different feature surface (it has no
  Offerings or Staff pages), and this plan is scoped to `vendor/`. Unblocks when a
  mobile guide pass is scheduled.
- **D2 — "View transactions for this offering" from the modal.** Attractive, but
  `PageIntent` (`lib/types.ts:71-75`) carries only `range` and `status`, and
  `OfferingsPage` receives no navigation callback from `AppShell.tsx:93`. Adding an
  `offering` field plus shell wiring is a cross-cutting change for a convenience
  link. Revisit after the modal ships and there is evidence vendors want it.
- ~~**D3 — offerings do not list their assigned staff.**~~ ✅ **PROMOTED to I8**
  (2026-08-14) at the user's request. The "needs its own query" reasoning that
  deferred it was **wrong**: the shell already holds the staff array with their
  specialties, so I8 needs no query at all. Record kept because the correction
  matters — the same faulty assumption would defer it again.
- **D5 — `npm run lint` is already red on this repo** (found during Stage 1,
  2026-08-14, pre-existing and untouched). Five `react-hooks/set-state-in-effect`
  errors — four in `useAppShell.ts` (`:185`, `:258`, `:267`, `:374`), one in
  `useStaffForm.ts:27` — plus two warnings. Verified pre-existing by linting
  `git show HEAD:…useAppShell.ts` through `--stdin`: **4 before my change, 4
  after**. Left alone deliberately: they are in effect bodies that predate this
  work, fixing them is a behavioural change to auth and data-loading flow, and it
  is out of this plan's scope. Recorded so a later stage is not blamed for them,
  and so nobody reads "lint clean" into this plan's verification claims — the
  correct claim is *no new findings on the changed files*.
- **D4 — three filter idioms across three pages.** Noted, not fixed. Consolidating
  `BookingsPage.tsx:40-59` and `OfferingsPage.tsx:41-47` onto `FilterTabs` would
  touch two pages this plan otherwise leaves alone.

---

## Execution order

Ordered by dependency, then risk. Each numbered entry is one stage; the default
cadence is **one stage, then report** (`.claude/skills/developerboss/SKILL.md`).

1. ✅ **Stage 1 — Staff status filter + honest staff states (I9 → I6).** Executed
   2026-08-14. I9 first: it
   changes `getStaff`'s signature, and building I6's empty states on the old one
   would mean writing them twice. No new query, no schema. Safe to ship alone.
2. ✅ **Stage 2 — Financial foundation (I2 → I1).** Executed 2026-08-14; I2 ✅, and
   I1 ✅ once its three live checks were run (see the item). `payableCount` first so the query
   returns the field the modal's caption needs, then the offering-scoped query.
   Both are pure data-layer work with unit-test coverage and no UI yet.
3. ✅ **Stage 3 — Performance modal and card action (I3 → I4).** Executed 2026-08-14.
   Depends on Stage 2.
   Modal before the button, so nothing on screen can open a component that does not
   exist yet.
4. ✅ **Stage 4 — Assigned staff on the offering card (I8).** Executed 2026-08-14. Independent of Stages 2–3
   (different data source entirely), but sequenced after them so `OfferingCard`'s
   two prop additions land in two reviewable steps rather than one tangled diff.
   Could be pulled forward to run alongside Stage 1 if the offerings work is wanted
   sooner — it shares no file with I6 or I9.
5. ✅ **Stage 5 — Guide rewrite (I5).** Executed 2026-08-14. Deliberately after the features: the Offerings
   section documents both the "Performance" action (I4) and the assigned-staff list
   (I8), and the Staff section documents the new filter (I6). Writing it earlier
   would ship a guide describing UI that is not there — the exact defect this item
   exists to fix. Includes the `pilot.spec.ts` assertion updates and the two guide
   snapshots.
6. ✅ **Stage 6 — Gallery fixtures (I7).** Executed 2026-08-14. After the components settle, so snapshots are
   taken once rather than regenerated at every stage.

**Coupled, must not be split:**
- I9 + I6 (Stage 1) — the filter creates the empty state; I9 is what stops it lying.
- I2 + I1 (Stage 2) — the field and its only consumer.
- I8's `specIds` addition + its use — a half-landed `Staff` field is dead weight.
- I5 + its test updates — a guide change without the assertion update leaves the
  suite red.

---

## Verification

| Item | Machine-verifiable | Needs a live environment / human |
|---|---|---|
| I1 | `tsc --noEmit`; lint — **no unit test is possible** (imports the Supabase client) | All three checks under I1: `!inner` excludes, `count: "exact"` respects the embedded filter, and the figure cross-checks against Transactions' row set |
| I2 | `npm test` (node --test) | — |
| I3 | `tsc --noEmit`; gallery snapshots | Zero-payment offering (no NaN average), loading and error states showing "—" |
| I4 | `tsc --noEmit`; gallery snapshots | Three-button row at the narrowest breakpoint; delete-confirm vs modal cannot co-occur |
| I5 | `npx playwright test -g "guide"` after deliberate snapshot regeneration | Read-through for truthfulness — the item exists because the current copy is untrue |
| I6 | `tsc --noEmit`; lint; gallery snapshots | Filter × search composition; status toggle removes a card from a narrowed list |
| I7 | `npx playwright test` | — |
| I8 | `npm test` (`offeringStaff.test.ts`); `tsc --noEmit`; gallery snapshots | One person on two offerings updates both cards; **renaming an offering's code leaves the chips intact** (Design note C's regression) |
| I9 | `tsc --noEmit` (proves both call sites updated); lint | Force a staff-fetch failure and confirm the page says so instead of showing an empty roster |

**Whole-plan gate:** `npm run build` in `vendor/` before calling the plan complete.
Per `.claude/skills/plan-authoring/SKILL.md`, nothing is marked ✅ on "should work"
— each ✅ records what was executed and which kind of verification actually ran.

---

## Plan review (2026-08-14)

A deliberate pass over the plan for gaps, under-specification, and places where a
poor implementation could still satisfy the written words (flow steps 3–4). What it
changed:

**Two new work items.** I8 (requested) and I9 (found: the silent staff-fetch
failure, which two other items in this plan would have made worse).

**One factual correction to my own reasoning.** Deferred item D3 claimed the
assigned-staff list "needs its own query". It does not — the shell already holds
staff with their specialties. The item is promoted, and the wrong reasoning is kept
on the record rather than quietly deleted.

**One latent bug caught before it was written.** The obvious implementation of I8 —
matching `specs.includes(offering.code)`, as `ScheduleFormModal.tsx:50` does — would
break the moment a vendor edits an offering's code from the button beside it. See
Design note C. This is the clearest example of an item that could have passed every
documentation rule in the skill and still been bad engineering.

**Six places where the wording permitted a weak implementation, now closed:**
1. I5 said "no structural change" but hedged on the Tip. Now: the Tip is verbatim,
   `GuideModal.tsx` is untouched, and the reason (a test asserts it) is recorded.
2. I5 left the seven `tabLabel` strings to the implementer, the exact mistake
   `guideItems.ts:8-14` documents. Now fixed in a table.
3. I1 could have been read as unit-testable. It is not, and its correctness rests on
   three specific live checks — including the `count: "exact"` behaviour with an
   embedded filter, which if wrong makes the modal claim partial data on a complete
   result.
4. I6's "add an empty state" was one state where three are needed.
5. I6 did not say that a card leaving the list on a status toggle is *correct*,
   inviting someone to "fix" it into showing a row that contradicts the filter.
6. I7 did not say that I4 and I8 break the gallery tiles, nor that the fixtures need
   values exercising both branches rather than empty placeholders.

**Two style traps recorded:** the `TC`/`TB` constant maps are keyed by offering code
and must not be reached for when rendering people (I8), and all new chips and tiles
use `sp-*` tokens rather than hardcoded per-theme colours (`conventions.md:470`).

**Still true after the review:** no schema change, no migration, no RLS or grant
change, no new dependency, and no approval gate on the data layer. Every new read
uses tables, columns and policies that already exist.

**Known limits accepted, not solved:** `getOfferingFinancials` has no automated
coverage (architectural — it touches the Supabase client); the guide's truthfulness
can only be verified by a human read-through; and the mobile guide will drift (D1).
