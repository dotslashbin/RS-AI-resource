# Vendor Payout Sums by Date Range

**Date:** 2026-07-28
**App / scope:** `vendor` (Transactions page, Dashboard stat cards) — no schema change, no other app
**Status:** ✅ COMPLETE — B1–B3, I1–I4 and G1–G9 all executed and verified 2026-07-28 (37 automated browser checks across four suites, all passing; `tsc --noEmit` clean). Nothing outstanding except the inherited real-device mobile print-to-PDF gap, which this plan never claimed to close.

> Make "how much payout did I accumulate between these two dates" a question the vendor
> portal answers **visibly, correctly at any volume, and identically on screen and on paper**.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local — qualify
> cross-plan refs by app (e.g. "vendor I1"). This plan's predecessor is
> `.plans/2026-07-25-vendor-transactions-platform-fee.md`, referenced below as "the txn plan".

---

## Predecessor check: was the txn plan fully executed?

**Yes — verified against the code and a live browser today (2026-07-28), not taken on trust.**

`2026-07-25-vendor-transactions-platform-fee.md` is marked `✅ COMPLETE` and every item (B1, I1–I8,
R1–R7) carries a DONE marker with verification notes. Spot-checks confirm the claims are real:

| Claim | Verification today |
|---|---|
| Two migrations + trigger exist | `20260725000001`, `20260725000002`, `20260726000001` applied to local DB; 40 ledger rows present |
| Vendor Transactions page shipped | All 6 components present under `vendor/components/transactions/`, committed (`04630de`) |
| `isPayable` de-duplicated (R3) | Single `PAYABLE_BY_STATUS` in `vendor/lib/utils.ts:64-74`, both call sites use it |
| `pending` excluded from payout (R6) | `PAYABLE_BY_STATUS.pending = false` — confirmed |
| Paged fetch with exact count (R1) | `transactions.service.ts:86-109` — batched `.range()`, `count: "exact"`, id tiebreaker |
| Transactions is sidebar-only (R7) | Not in `TabBar.tsx` `TABS`, not in `MAIN_TAB_PAGES` |

The vendor working tree is **clean** — nothing half-finished. The only outstanding item the txn
plan itself names is real-device mobile print-to-PDF (unchanged, still unverified, still out of
scope here).

---

## Premise correction — read this before the items

**The request states the summaries do not reflect the table's date filter. On the current code,
they do.** This was measured, not reasoned about:

Ground truth from SQL (Citywide Sports Center, payable = `confirmed`/`completed` only):

| Scope | Rows | Collected | Fee | Payout |
|---|---|---|---|---|
| All time | 32 | ₱21,750.00 | ₱2,610.00 | **₱19,140.00** |
| Paid 2026-07-01 → 2026-07-23 | 6 | ₱3,550.00 | ₱426.00 | **₱3,124.00** |

Live browser (Playwright, `npm run dev` :3000, `jose@bookdeck.com`), reading the actual cards:

```
BEFORE: Collected ₱ 21,750 "27 of 32 transactions · all time"
        Total Payout ₱ 19,140 "Excludes 5 pending/cancelled/refunded"    Showing 1–10 of 32

AFTER : Collected ₱ 3,550  "5 of 6 transactions · in current filter"
        Total Payout ₱ 3,124  "Excludes 1 pending/cancelled/refunded"    Showing 1–6 of 6
```

Both match SQL exactly. Structurally this cannot drift: `useTransactionsPage.ts:86-96` derives
`totals` from the same `filtered` array (`:56-75`) that feeds the table, and the date predicate
(`:68-72`) is inside that one `filtered` memo.

**So the mechanism works. What is genuinely missing is that nothing on screen ever says which
dates produced the number.** The card caption reads only "in current filter" in 11px grey; the
*printed* report states "Paid 2026-07-01 to 2026-07-23" but the screen never does. Combined with
the date inputs being hidden behind a collapsed "Filters" toggle (`TransactionsPage.tsx:138`,
`showFilters` starts `false`), a vendor can reasonably look at this page and conclude the range
does not drive the totals. That is a real defect in the product even though the arithmetic is
right — and it is what this plan's I1/I2 fix.

Beneath that, the investigation turned up **three defects that are real bugs, not perception**:
B1, B2 and B3 below.

---

## Second ask — is the filtered list the same as what gets printed?

**Yes for rows and totals; no for warnings.** Verified in the same run, with the date range
applied:

- screen `Showing 1–6 of 6`; print view `tbody` rows = **6**. Identical.
- print header restates the filter: `Paid 2026-07-01 to 2026-07-23 · 6 transactions`.
- print totals `₱3,550 / −₱426 / ₱3,124` — byte-identical to the on-screen cards and to SQL.
- under `emulateMedia({ media: "print" })` the screen table is hidden and the print table renders.

This holds by construction: `TransactionsPage.tsx:206-212` passes `rows={filtered}` (never `paged`)
and the *same* `totals` object the cards receive. There is one gap — **B3** — where the two
surfaces genuinely diverge, and it is the dangerous direction: paper omits a warning screen shows.

---

## BLOCKERS

### B1 — Dashboard "Monthly Revenue" is a hardcoded literal  ✅ DONE (2026-07-28)
**File:** `vendor/components/dashboard/DashboardPage/DashboardPage.tsx:33`

```tsx
<StatCard label="Monthly Revenue" value="₱ 4,550" sub="Apr 2026" ... />
```

`₱ 4,550` and `Apr 2026` are **string literals**. `useDashboardPage.ts` fetches nothing at all —
it only manages the guide panel's localStorage flag. So every vendor, on every login, on every
date, is shown the same invented revenue figure presented with the same visual weight as the real
`pendingCount` beside it. This is fabricated money on a financial surface, and it is the most
likely thing behind the report that summaries ignore the date — this card ignores *everything*.

**Fix approach:** relabel the card **"Monthly Payout"** (decision G7 — a net-of-fee figure must not
sit under a gross "Revenue" label) and compute it from the ledger. Reuse the existing data path
rather than inventing one — `getTransactions(vendorId)` already returns every row with
`transactionDate` and `status`; sum `payoutAmount` over `isPayable(status)` rows whose
`toPhDate(transactionDate)` falls in the current PH month. Prefer a narrow
`getMonthlyPayout(vendorId, phMonth)` in `transactions.service.ts` that queries with the same PH
day-boundary bounds B2 introduces, so the dashboard does not pull the vendor's full ledger just to
render one card. Label the month from the actual PH month, not a literal. `DashboardPage` gains a
`vendorId` prop from `AppShell.tsx:79,89`; the fetch belongs in `useDashboardPage.ts`, which is
where the render/hook split requires it.

**Component-separation check:** `DashboardPage.tsx` stays a pure render layer; the new fetch,
loading and error state go in `useDashboardPage.ts`, which already exists. `StatCard` is untouched
pure display. No new component, no new CSS.

### B2 — The truncation banner gives advice that cannot work  ✅ DONE (2026-07-28)
**Files:** `vendor/services/transactions.service.ts:79-124`, `vendor/components/transactions/TransactionsPage/TransactionsPage.tsx:76-85`

When the fetch hits its 10,000-row ceiling the page renders:

> "Showing the N most recent of M transactions. The totals below cover only those — **narrow the
> date range for an accurate figure.**"

`getTransactions(vendorId)` takes **no date parameters**. Narrowing the date range filters the
already-truncated array client-side (`useTransactionsPage.ts:68-72`) and never refetches, so the
missing rows can never be recovered. Following the banner's instruction produces a *smaller* wrong
number and a confident-looking "in current filter" caption over it. The banner does not merely
fail to help — it actively directs the user toward a figure it has just told them is incomplete.

**Fix approach (decided — push the date range into the query):** give `getTransactions` optional
`{ from, to }` PH-date bounds and apply them server-side, so the fetch returns the range rather
than the newest 10,000 of all time. Then the banner's advice becomes true, and a large vendor's
date-range payout is correct instead of subset-correct.

PH has **no DST** and is a fixed UTC+8, so the boundary conversion is exact and needs no library:

```ts
// inclusive start of the `from` PH day; exclusive start of the day AFTER `to`
.gte("created_at", `${from}T00:00:00+08:00`)
.lt ("created_at", `${nextPhDay(to)}T00:00:00+08:00`)
```

The `lt`-next-day form is mandatory, not stylistic — `lte` against a bare date coerces to that
day's `00:00` and silently drops every payment made *during* the `to` day. This is the same
off-by-one the txn plan's I6 called out for the client-side path.

**Single-source-of-truth requirement (do not skip):** once the date bound is applied server-side,
**remove the client-side date predicate** from `useTransactionsPage.ts:68-72`. Leaving both means
the same business rule lives in two places in two forms — exactly the defect the txn plan's R3
spent an item eliminating. Keep `toPhDate` for display; the *filter* must have one home.

**Coupling:** `search` and `offering` stay client-side over the fetched range — that is coherent
(server scopes the range, client narrows within it) and must be stated in a comment so a later
reader does not "fix" the asymmetry by moving one of them.

**Refetch state:** changing a date now triggers I/O. The totals must not display the previous
range's figures next to the new range's label while a refetch is in flight — show the existing
loading treatment and suppress stale totals. A mismatched label and number here is the same class
of lie B2 is fixing.

### B3 — A truncated or degraded export prints with no warning on paper  ✅ DONE (2026-07-28)
**File:** `vendor/components/transactions/TransactionPrintView/TransactionPrintView.tsx:30-43`

`TransactionPrintView` receives `vendorName`, `rows`, `filterSummary`, `printedAt`, `totals` — and
**not** `incomplete` or `contactsError`. Both warnings are rendered only inside the
`print:hidden` screen wrapper (`TransactionsPage.tsx:76-98`).

So a vendor whose ledger exceeded the fetch ceiling sees an amber "totals cover only those" banner
on screen, hits Print, and gets a clean PDF stating a payout total with **no indication it is
short**. The PDF is the artifact most likely to be filed, emailed to an accountant, or reconciled
against a bank statement — i.e. the warning is dropped from precisely the surface where being
wrong costs the most. This is also the one place the screen and printed views genuinely disagree,
which is the second half of the ask.

**Fix approach:** pass `incomplete` (and `contactsError`) into `TransactionPrintView` and render
them as a plain printed note near the totals — text, not colour, matching the component's existing
"status as a word, not a colour" rule for print. B2 reduces how often `incomplete` can occur but
does not eliminate it (a single range can still exceed the ceiling), so this is still required
after B2 lands.

---

## IMPORTANT

### I1 — The active date range is never stated on screen  ✅ DONE (2026-07-28)
**Files:** `vendor/components/transactions/TransactionSummaryCards/TransactionSummaryCards.tsx:29-33`, `TransactionsPage.tsx:100-108`

`scope` renders as the bare string `"in current filter"`. The printed report already does this
properly — `filterSummary` (`useTransactionsPage.ts:126-134`) produces "Paid 2026-07-01 to
2026-07-23". The screen has that exact string available and does not use it.

**Fix approach:** pass `filterSummary` (or a date-only variant) into `TransactionSummaryCards` and
render the real range in the caption instead of "in current filter". Keep "all time" when no range
is set. This is the smallest change that makes the cards self-describing, and it reuses an
existing derived value rather than computing a second one.

**Component-separation check:** `TransactionSummaryCards.tsx` stays pure display — one more prop,
no state. Sub-caption text is composed in the hook, beside `filterSummary`, not in the render layer.

### I2 — Date range is hidden behind a collapsed Filters toggle, with no presets  ✅ DONE (2026-07-28)
**File:** `vendor/components/transactions/TransactionsPage.tsx:116-150`, `TransactionFilters.tsx:44-70`

`showFilters` starts `false`, so on load the page shows summary cards and a table with **no
visible date control**. The stated use case — define a start and end date, see accumulated payout
— is the page's primary job, and it is currently two clicks and a scroll below the answer.

**Fix approach:**
- Lift a date-range control **above** the summary cards, so the input and the number it drives are
  adjacent and the causal link is visible without discovering the panel.
- Add presets: **This month · Last month · Last 30 days · This year · Custom**. Payout questions
  are overwhelmingly month-boundary questions; presets remove the two-input dance for the common
  case and make the feature self-demonstrating on first load.
- Presets compute PH-local boundaries via the same helper B2 introduces — one date-boundary
  implementation, not a second one for presets.
- Leave offering + search in the existing collapsible panel; only the date range is promoted.

**Component-separation check:** a new `TransactionDateRange/` component. It owns preset buttons and
two date inputs but **no state** — values and handlers stay in `useTransactionsPage`, which needs
them to derive rows and totals (the same reasoning that made `TransactionFilters` hook-free, per
the txn plan's I2 deviation #2). So: controlled presentational component, no companion hook,
Tailwind-first per vendor convention. Preset→date-range maths lives in `lib/utils.ts` beside
`toPhDate`, not in the component.

**⚠ UX check required before building:** per AGENTS.md, `.claude/skills/ux-design/SKILL.md` must
be read and applied — this is a visual/interaction change. Cover all four states and both themes.

### I3 — "Completed This Month" is an all-time count  ✅ DONE (2026-07-28)
**File:** `vendor/components/dashboard/DashboardPage/DashboardPage.tsx:23,32`

```tsx
const completedCount = bookings.filter(b => b.status === "completed").length
```

No date bound at all, but the card is labelled **"Completed This Month"**. Same defect class as
B1 and squarely the theme of this plan: a label claiming a date scope over a sum that has none.

**Adjacent to the approved scope** — it was found while investigating B1, one card to its left, and
is a ~2-line fix. Included as IMPORTANT rather than fixed silently, per AGENTS.md's "mention it
instead of fixing it silently". Say the word if you'd rather it move to a separate task.

**Fix approach:** filter to the current PH month using the same boundary helper, or relabel to
"Completed" if a month scope isn't wanted. Do not leave label and data disagreeing.

### I4 — "Today's Schedule" is pinned to 23 Apr 2026  ✅ DONE (2026-07-28)
**File:** `vendor/components/dashboard/DashboardPage/DashboardPage.tsx:22,31`

`getSchedsForDay(23, 2026, 3, schedules)` with `sub="Apr 23"` — hardcoded date, so "Today's
Schedule" is permanently wrong. Same hardcoded-mock family as B1, found in the same three lines.

**Fix approach:** derive day/month/year from the current PH date. Small, but leaving it while
fixing B1 in the same card row would be odd — the row would go half-real.

---

## Gap review (2026-07-28) — done after the first draft, before approval

A skeptical second pass over the draft, checking the code again rather than re-reading the prose.
**Four of these are defects the plan as written would have *caused* during execution** (G1–G4),
which is worse than an omission. Each is folded into the item it belongs to; they are listed here
so the reasoning survives.

### G1 — B2 would turn the empty state into a dead end  ✅ DONE (2026-07-28)
**Files:** `useTransactionsPage.ts:166`, `TransactionsPage.tsx:51-64`

`isEmpty` is `transactions.length === 0` — the **fetched** array. Once B2 scopes the fetch to a
date range, selecting a range with no payments makes that true, and `TransactionsPage.tsx:51`
early-returns the "No transactions yet" card **before any filter control renders**. Two failures at
once:

1. **Wrong message** — a vendor with 32 transactions who picks Jan 2027 is told "Once a booker
   completes payment … it will appear here", i.e. that they have never been paid.
2. **No way out** — that branch renders no date inputs and no Clear filters button, so the range
   cannot be changed or cleared. The user is stuck until they navigate away or reload.

**Fix approach:** `isEmpty` must keep meaning *"this vendor has never been paid"*, independent of
the active range — derive it from the unfiltered total, not from the range-scoped array. The
empty-range case must fall through to the existing "No matching transactions" + Clear filters
branch (`TransactionsPage.tsx:153-164`), which already handles it correctly today. Verify both
states explicitly: empty vendor (Harbor Sports Complex, 0 transactions) still shows "No
transactions yet"; Citywide with an empty range shows "No matching transactions" **with working
controls**.

### G2 — Range-scoping collapses the offering dropdown  ✅ DONE (2026-07-28)
**File:** `useTransactionsPage.ts:51-54`

`offeringOptions` is derived from the fetched rows. Range-scoping the fetch makes the dropdown's
contents depend on the date range: narrow the range and offerings disappear from the list. If one
was selected, `offering` state keeps its value while the `<select>` has no matching `<option>` —
the control renders blank/first while the filter silently matches nothing, giving an empty table
with no visible cause.

**Fix approach:** decide explicitly and comment it. Either keep the offering list stable (source it
from the vendor's offerings rather than from transactions in range) or reset `offering` to `"all"`
when the selected value leaves the option set. Do not leave state and options able to disagree.

### G3 — Presets need an atomic range setter  ✅ DONE (2026-07-28)
**File:** `useTransactionsPage.ts:115-116`

`changeDateFrom` and `changeDateTo` are separate setters. Under B2 each one triggers a refetch, so
a preset that sets both fires **two requests**, the first for an intermediate range that the user
never chose — and switching from a later range to an earlier one passes through a transient
`from > to`, which fetches an empty set and flashes an empty table.

**Fix approach:** add a single `setDateRange(from, to)` action that sets both in one update; presets
call only that. Keep the individual setters for the two manual inputs.

### G4 — Concurrent range changes can resolve out of order  ✅ DONE (2026-07-28)
**File:** `useTransactionsPage.ts:37-47`

The current effect has no cancellation — it just `setState`s whatever resolves. Today that is nearly
harmless (one fetch per `vendorId`). Under B2 every date edit issues a request, so two can be in
flight and **the slower, older one can land last**, leaving the table and totals showing a range the
user has already moved off while the caption states the new one. That is precisely the
number-disagrees-with-its-label failure this plan exists to remove.

**Fix approach:** guard with a request sequence number or `AbortController` and ignore stale
responses; debounce date input changes so typing does not issue a request per keystroke. Both are
required — debounce alone narrows the window without closing it.

### G5 — Moving the dates out of the panel breaks the Filters toggle styling  ✅ DONE (2026-07-28)
**File:** `useTransactionsPage.ts:109`

`hasPanelFilters = Boolean(offering !== "all" || dateFrom || dateTo)` exists solely to style the
Filters **toggle**. Once I2 promotes the date range above the cards, a date range would light up a
toggle for a panel that no longer contains that control — the *identical* bug R5 already fixed for
the search box in the txn plan. `hasPanelFilters` must drop the date terms and become
offering-only. `hasFilters` (Reset button, "in current filter" caption) keeps all four.

### G6 — Two controls for one piece of state  ✅ DONE (2026-07-28)
**File:** `TransactionFilters.tsx:44-70`

I2 promotes the date range but the draft never said to remove the panel's existing date inputs.
Leaving both gives two controls writing the same state in two places — a duplicate-rule defect of
the same family as R3. **Delete the date inputs from `TransactionFilters`** and shrink its props to
offering + reset; the component keeps its hook-free controlled shape.

### G7 — "Monthly Revenue" label vs. a net payout figure  ✅ RESOLVED (2026-07-28) — fold into B1
Wiring a net-of-fee payout under a gross "Revenue" label would recreate R2's defect. **Decided:
relabel the card to "Monthly Payout"**, matching the Transactions page's "Total Payout" vocabulary
so the two screens reconcile. The card must also state its basis (payable rows only, PH month), the
same caption discipline R2 imposed.

### G8 — The truncation banner is still wrong after B2, just less often  ✅ DONE (2026-07-28)
"Narrow the date range for an accurate figure" becomes actionable after B2 — but not for a user who
has *already* narrowed and still exceeds the ceiling within that range. Reword so it stays true in
both cases (e.g. name the ceiling and advise a shorter range), rather than assuming narrowing always
resolves it.

### G9 — Search semantics change silently  ✅ DONE (2026-07-28)
Search currently matches across the vendor's whole ledger; after B2 it matches **within the selected
range only**. That is defensible and probably desired, but it is a behaviour change and must be
stated in a comment and in the release note, not discovered.

### Verified during this review — gaps that turned out not to exist
- **No new index needed.** `booking_transactions_vendor_created_idx btree (vendor_id, created_at DESC)`
  is present on the live table and exactly serves B2's `eq(vendor_id)` + `created_at` range +
  `order by created_at desc`. Confirms this plan's "no schema change" claim rather than assuming it.
- **`getTransactions` has exactly one consumer** (`useTransactionsPage.ts:40`) — grepped across the
  app. B2's signature change has a contained blast radius; no other page silently inherits
  range-scoping.
- **RLS is unaffected.** The SELECT policy filters on `vendor_id` only
  (`is_active() and has_vendor_role(vendor_id,'vendor-admin')`); adding `created_at` bounds does not
  interact with it. Verified against the live policy definition.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains — see plan-authoring §7. -->

- Treat the summaries/date-range report as discoverability + labelling, or rebuild the summary
  layer? → **Make the range visible + add presets** (resolved 2026-07-28) — the arithmetic was
  measured correct today, so rebuilding would duplicate working logic; the demonstrated gap is
  that the screen never states the range and the control is hidden.
- Client-side date filtering (capped at 10,000 rows) vs. pushing the range into the query?
  → **Push into the query** (resolved 2026-07-28) — makes date-range payout correct at any volume
  and makes B2's banner advice true instead of false.
- Hardcoded dashboard "Monthly Revenue"? → **Wire to real payout data** (resolved 2026-07-28).
- Scope of I3/I4 (adjacent dashboard defects found during B1 investigation) → **included as
  IMPORTANT**, flagged as adjacent rather than folded in silently; say if they should be split out.
- Dashboard card labelled "Monthly Revenue" while showing a net-of-fee payout (G7) → **relabel to
  "Monthly Payout"** (resolved 2026-07-28) — matches the Transactions page's "Total Payout"
  vocabulary so the two screens reconcile, instead of a net figure under a gross label.

No OPEN decisions remain. Execution-ready pending approval.

---

## DEFERRED / COSMETIC

- **Server-side aggregation (SQL `sum()`) instead of summing fetched rows** — a `SUM` over the
  range would make totals exact regardless of row count and drop the ceiling entirely. Not now:
  it needs either an RPC or a view (schema change → approval gate), and B2's range-scoped fetch
  already makes realistic ranges complete. Revisit if a vendor exceeds 10,000 rows *within a
  single range*.
- **Column sorting** — still deferred from the txn plan; unchanged.
- **Realtime refresh of the ledger** — still deferred from the txn plan's I2; a new payment does
  not appear until reload. Unchanged by this work.
- **Mobile real-device print-to-PDF** — still the txn plan's one unverified item. This plan does
  not close it and must not claim to.

---

## Execution order

1. **B2 + G1 + G2 + G4 as one batch** — they must ship together, not sequentially. B2 alone
   introduces the dead-end empty state (G1), the collapsing offering dropdown (G2) and the
   out-of-order responses (G4); landing it without them means knowingly shipping three regressions.
   B2 also introduces the PH day-boundary helper that B1, I2 and I3 all reuse, which is why it goes
   first — one boundary implementation, not four.
2. **B3 + G8** — small, and depends on nothing but B2's `incomplete` semantics staying intact.
3. **I1** then **I2 (with G3, G5, G6)** — I1 is the minimal labelling fix; I2 promotes the control
   and adds presets on top of it. In that order the page is already honest before the layout moves.
   G5/G6 are not optional polish: skipping them leaves two controls writing one state and a toggle
   styled by a control it no longer owns.
4. **B1 (with G7's relabel)**, then **I3** and **I4** — the dashboard card row, done as one batch so
   it does not ship half-real. Depends on B2's helper.
5. Re-verify print/screen parity end to end (see Verification) after I2 changes the filter surface.
6. Update `architecture/portals.md` — vendor Transactions/Dashboard feature notes — **last**, so
   it records what was built and verified.

**Safe-now prefix:** B2 → B3 are independent of any visual decision and can start immediately.

---

## Verification

Reproduce today's baseline first, so a regression is visible rather than inferred. Ports: vendor
dev serves **:3000** (`npm run dev`); :3100 is the Playwright config's own port. Log in as
`jose@bookdeck.com` / `DevSeed@pass11` (single-vendor Citywide admin — no vendor picker).

- **B1** — needs a live environment. Assert the dashboard card equals a SQL-computed current-month
  payable payout for the vendor, that the month label matches the PH month, and that the card reads
  **"Monthly Payout"** (G7). Machine-verifiable half: no string literal peso value remains in
  `DashboardPage.tsx`. Cross-screen check: the dashboard figure must reconcile with the Transactions
  page's Total Payout for the same month range — two screens quoting different numbers for the same
  question is the failure this plan is about.
- **G1 (do this one first, it is the cheapest regression to miss)** — needs a live environment.
  Two states, both asserted: Harbor Sports Complex (0 transactions) still shows "No transactions
  yet"; Citywide with a range matching nothing shows "No matching transactions" **and** a working
  Clear filters control that restores the full set. The second assertion is the one that fails if
  G1 is skipped.
- **G2 / G3 / G4** — needs a live environment. G2: narrowing the range while an offering is selected
  never leaves the select showing a value absent from its options. G3: applying a preset issues
  **one** request, not two, and never passes through `from > to`. G4: scripted rapid range changes
  end with the table, totals and caption all describing the **last** range chosen — the assertion
  that catches a stale response winning.
- **B2** — needs a live environment **plus** a >10,000-row dataset to exercise honestly. The txn
  plan's R1 verification used the cheaper equivalent: temporarily lower the `MAX_ROWS` ceiling to
  force the truncation path, then restore it and confirm no test marker remains. Assert:
  (a) with a range set, the network request carries `created_at` bounds; (b) a payment at 07:00 PH
  on the `to` day is **included** (the `lt`-next-day boundary — this is the off-by-one that would
  otherwise silently drop a day); (c) range totals equal SQL for the same bounds; (d) the client-side
  date predicate is gone (grep `useTransactionsPage.ts`) so the rule has one home.
- **B3** — machine-verifiable via `emulateMedia({ media: "print" })`: with `incomplete` forced, the
  printed DOM contains the incompleteness note. Currently it does not — capture that as the
  failing-before state.
- **I1** — needs a live environment: with `2026-07-01 → 2026-07-23` set, the card caption states
  those dates and no longer reads "in current filter"; with no range it reads "all time".
- **I2** — needs a live environment: each preset produces the SQL-correct payout for its own PH
  boundaries; the range control is visible on first load without opening the panel; all four states
  and both themes render; 390px does not scroll horizontally.
- **I3 / I4** — needs a live environment: counts match SQL for the current PH month / current PH day.
- **Print↔screen parity (the second ask)** — re-run after I2: for at least three filter states
  (none, date range, date range + search), assert printed `tbody` row count == screen
  `Showing … of N`, and that all three printed totals are string-identical to the three cards. This
  passed today at 6 rows / ₱3,550 / ₱426 / ₱3,124; it must still pass after the filter surface moves.

**Baseline captured 2026-07-28 (regression targets):** all-time ₱21,750 / ₱2,610 / ₱19,140 over
32 rows; Jul 1–23 ₱3,550 / ₱426 / ₱3,124 over 6 rows (5 payable).

**Cannot be machine-verified here:** real-device mobile print-to-PDF (inherited gap, unchanged).

---

## Notes carried forward

- **No schema change in this plan** — no migration, no RLS change, no new grant. If server-side
  aggregation is chosen later (see Deferred), that *does* hit the schema approval gate.
- **No new dependency** — PH is fixed UTC+8 with no DST, so date boundaries are exact string
  arithmetic; `date-fns@^3.6.0` is already in `vendor/package.json` if needed.
- **Repo state:** vendor working tree was clean at plan time (HEAD `04630de`). Branching and
  committing remain the user's, per the txn plan's standing decision — execution creates no
  branches and no commits.
- **`backbone` is a separate git repo** on `feature/vendor_transactions`; `divisions` is absent
  from that branch, so a local `db reset` drops it. Pre-existing baseline, not caused by this work
  — recorded so it is not misdiagnosed during verification.

---

## Execution record (2026-07-28)

**All items executed. `npx tsc --noEmit` clean. 37 automated browser checks across four suites, all
passing, against `npm run dev` on :3000 and the live local Supabase.** Every money figure below was
cross-checked against SQL rather than against the UI's own arithmetic.

### Files changed
| File | Items |
|---|---|
| `lib/utils.ts` | PH day arithmetic: `phToday`, `phDayStart`, `nextPhDay`, `addPhDays`, `phMonthRange`, `phLastNDays`, `phYearRange`, `fmtPhDateRange` — one implementation, reused by B1/B2/I2/I3/I4 |
| `services/transactions.service.ts` | B2 (`DateRange`, server-side PH bounds), G1 (`vendorTotalCount`), B1 (`getPayoutForRange`) |
| `components/transactions/TransactionsPage/useTransactionsPage.ts` | B2, G1, G2, G3, G4, G9, I1 (`rangeLabel`, applied-range state) |
| `components/transactions/TransactionsPage/TransactionsPage.tsx` | wiring, G8 banner rewording, B3 props |
| `components/transactions/TransactionDateRange/TransactionDateRange.tsx` | **new** — I2 period control + presets |
| `components/transactions/TransactionFilters/TransactionFilters.tsx` | G6 — date inputs removed, props shrunk to offering + reset |
| `components/transactions/TransactionSummaryCards/TransactionSummaryCards.tsx` | I1 |
| `components/transactions/TransactionPrintView/TransactionPrintView.tsx` | B3 |
| `components/dashboard/DashboardPage/{DashboardPage.tsx,useDashboardPage.ts}` | B1, G7, I3, I4 |
| `components/layout/AppShell/AppShell.tsx` | `vendorId` passed to both `DashboardPage` call sites |
| `app/ui-gallery/page.tsx` | fixture given `vendorId=""` so it stays offline |
| `architecture/portals.md` | new vendor Overview/Dashboard section; Transactions section updated |

### What each verification actually proved
- **B2** — the request carries `created_at=gte…&created_at=lt…`, upper bound `2026-08-01` for a July
  range (next-day-exclusive, the off-by-one that would drop the last day). July totals ₱4,050 /
  ₱486 / ₱3,564 match SQL exactly. A single-day range (`from = to = 2026-07-24`) returns its rows,
  proving both bounds include the whole PH day. The client-side date predicate is gone.
- **G1** — the regression this plan existed to prevent, verified in **both** directions: Harbor
  Sports Complex (0 transactions) still shows "No transactions yet"; Citywide with a 2027 range
  shows "No matching transactions" **with the period control and a working Clear filters button**,
  which restores all 32 rows. Without the fix the second case showed the controls-free card.
- **G2** — with an offering selected and the range moved to one containing none, the `<select>`
  value still has a matching option and the selection is retained.
- **G3** — a preset issues **exactly one** range-scoped request, not two.
- **G4** — three range changes fired ~120ms apart end with the table, totals and caption all
  describing the **last** range chosen (₱3,564, July), so no stale response wins.
- **B3 + G8** — forced by temporarily lowering `MAX_ROWS`/`PAGE_SIZE` to 5 (the txn plan R1
  technique). Screen banner appears with the reworded, actionable advice; the **printed** report
  carries `INCOMPLETE REPORT … 5 of 32 …`, visible under `media: print`. Ceiling restored to
  10,000/1,000 afterwards and confirmed **zero** `TEMP-TEST` markers remain; the full 21-check
  suite was re-run after restoring and still passes.
- **I1** — captions read `01 Jul 2026 – 31 Jul 2026`, and `all time` when unfiltered. The string
  "in current filter" no longer appears.
- **I2** — at 390px there is no horizontal page scroll, the period control is visible without
  opening Filters, and every preset button fits the viewport. Dark mode renders correctly
  (screenshot reviewed).
- **B1 / G7 / I3 / I4** — dashboard reads **Monthly Payout ₱ 3,564** (equals SQL July payout *and*
  the Transactions page's figure for the same month — the two screens reconcile), captioned "after
  platform fee"; **Completed This Month = 3** (July only; the all-time count is 9); **Today's
  Schedule = 29 Jul 2026**, today's PH date. No `₱ 4,550` anywhere.
- **Print parity** — printed row count equals the filtered count and printed totals match the cards,
  re-checked after the filter surface moved.

### Deviations from the plan, and why
1. **`getMonthlyPayout` was implemented as `getPayoutForRange(vendorId, range)`.** The plan named a
   month-specific helper, but the month is just a range and the generic form reuses B2's bounds
   without a second date-handling path. The dashboard passes `phMonthRange(0)`.
2. **`isFiltered` on the summary cards now means search/offering only**, not "any filter". Once the
   caption names the actual dates, counting the date range as "filtered" would have produced
   "01 Jul – 31 Jul 2026 · filtered" for a plain period selection, implying a hidden narrowing that
   isn't there.
3. **Stale totals are handled by sourcing the caption from the applied range rather than by hiding
   numbers.** The plan said to suppress stale totals during a refetch. Deriving `rangeLabel` from
   the range the data was actually fetched with makes the figure and its label describe the same
   fetch *by construction*, which is stronger than blanking values — the forbidden state cannot be
   rendered at all. A dim/`aria-busy` treatment signals the refresh.

### Not done / still open
- **Real-device mobile print-to-PDF** — inherited from the txn plan, untouched, still unverified.
- **Server-side aggregation (SQL `SUM`)** — remains deferred as planned; B2's range-scoping makes
  realistic periods complete, and a `SUM` would need an RPC or view (schema approval gate).
- **Nothing was committed.** All changes are uncommitted working-tree edits in `vendor/` plus
  `architecture/portals.md` and this plan in the parent repo, per the standing decision that
  branching and committing are the user's.
