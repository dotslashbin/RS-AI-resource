# Command — Payouts page redesign (buckets, search, filters, grouped release, print)

**Date:** 2026-09-10
**App / scope:** `command/` only — `components/payouts/**`, `services/payouts.service.ts`, `app/ui-gallery/page.tsx`, plus **one new read-only RPC** in `backbone/supabase/migrations/`
**Status:** COMPLETE (2026-09-10) — one live-environment check outstanding, see Verification

> Turn the Payouts table into a payout *run*: see what is owed at a glance, narrow it,
> pay one vendor or one booking without hunting through checkboxes, and print what you
> paid. Optimize for the real job — one bank transfer per vendor, recorded afterwards.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision; numbers are
> plan-local — qualify cross-plan references by app (e.g. "command I1").

**Approved preview:** https://claude.ai/code/artifact/f2abc8f3-03d6-4cb0-b14b-15b1aa517f0b
(Option B — vendor groups — chosen 2026-09-10. The preview is the visual contract for
this plan; where the plan and the preview disagree, the plan wins and the preview is
stale.)

---

## Scope

**In scope.** The Command Payouts page only: bucket filter cards with counts and money,
search, a filter panel, sortable columns, vendor-grouped release rows, per-row and
per-vendor "mark as paid", the existing bulk multi-select, a filter-aware print/PDF view,
and the four UI states. One new `SECURITY DEFINER` **read-only** function for bucket
totals. Doc updates in `architecture/portals.md`.

**Explicitly out of scope.**

- `booker`, `vendor`, `ezzy-booker-mobile`, `ezzy-vendor-mobile` — **no files touched.**
- `release_booking_payouts(uuid[])` — unchanged. Single-row release is the same RPC with
  a one-element array; it already skips rows that are no longer `releasable`.
- Any table, column, index, constraint, RLS policy or grant change on
  `booking_transactions` or `bookings`.
- A payout rail. Nothing in this plan moves money (see B4).
- Server-side filtering and pagination (see DEFERRED).

**Cross-app check.** The new RPC lives in the shared `backbone/` project, so it is
*visible* to every app, but nothing outside `command/` calls it and no existing object
is modified. This is the one item behind an approval gate — see B1.

---

## What the code does today (verified by reading, not assumed)

| Fact | Evidence |
|---|---|
| The whole page is one render layer + one hook | `components/payouts/PayoutsPage/PayoutsPage.tsx:1-158`, `usePayoutsPage.ts:1-144` |
| Four tabs, fetched one at a time on tab change | `usePayoutsPage.ts:74-85` (`load()`), `PAYOUT_TABS` at `:53-58` |
| Sorting is client-side over the fetched set, with a per-tab default | `usePayoutsPage.ts:20-27` (`DEFAULT_SORT`), `:36-50` (`compare`) |
| Numbers sort numerically and nulls sink — deliberately, not by accident | `usePayoutsPage.ts:29-35` comment |
| Selection + bulk release exist; there is no single-row action | `PayoutsPage.tsx:88-99`, `usePayoutsPage.ts:118-140` |
| **There is no search and no filter of any kind** | absent from both files |
| Fetch is paged to an exact count, ceiling 10,000, and reports incompleteness | `services/payouts.service.ts:39-46`, `:118-147` |
| "Owed back" = `released` **+** booking `refunded`/`cancelled`, not `reversed` | `services/payouts.service.ts:104-110` |
| `SortableColumnHeader` is a `<th onClick>` — no button, no `aria-sort` | `components/ui/SortableColumnHeader/SortableColumnHeader.tsx:17-30` |
| It is shared with the mock Transactions table and the gallery | `components/transactions/TransactionTable/TransactionTable.tsx`, `app/ui-gallery/page.tsx` |
| `command` has **no committed screenshot baselines** — both specs are behavioural | `visual-tests/closures.spec.ts`, `visual-tests/seo.spec.ts` |
| The index is `(vendor_id, payout_status)` — leading column is the vendor | `backbone/supabase/migrations/20260801000003_booking_payout_status.sql:38-39` |
| A proven print pattern already exists in the workspace (read-only reference) | `vendor/components/transactions/TransactionPrintView/TransactionPrintView.tsx`, `vendor/.../useTransactionsPage.ts:216-227` |

### Two defects found during investigation

Both are pre-existing and both become *worse* the moment the bucket cards start showing
money, which is why they are blockers rather than follow-ups.

1. **`payout_status = 'reversed'` appears on no tab at all.** The four tabs cover
   `releasable`, `held`, `released`, and owed-back. Reversed payouts are invisible in
   Command today. → **B2**
2. **The "Paid" tab double-counts.** Owed-back rows are `released`, so they appear on
   both "Paid" and "Owed back". Harmless while tabs showed no totals; a silent double
   count of pesos once they do. → **B2**

---

## BLOCKERS

### B1 — Bucket totals need one exact aggregate, not five fetches ✅ DONE (2026-09-10) · **APPROVAL GATE**

**Files:** new `backbone/supabase/migrations/20260910000001_command_payout_bucket_totals.sql`;
consumed in `command/services/payouts.service.ts`.

The redesign puts a count **and** a peso total on all five bucket cards. The page fetches
one bucket at a time (`usePayoutsPage.ts:74-85`), so today it cannot know the other four.
PostgREST cannot `sum()`, so the honest options were counts-only or an aggregate RPC.
**Decision D1 chose the RPC** — see DECISIONS.

**Exact change, to be written only after approval:**

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Command payout bucket totals (READ ONLY)
--
-- The Payouts page shows a count and a peso total per bucket. It fetches one
-- bucket at a time and PostgREST cannot aggregate, so without this the page
-- would either issue five queries or show totals it had not actually summed.
--
-- SECURITY DEFINER for the same reason release_booking_payouts is: the caller
-- is Command staff reading across every vendor. Raises rather than returning an
-- empty set on a failed check — a silent ₱ 0 on a money screen is worse than an
-- error. Read-only: no table is written, no schema object is altered.
--
-- The CASE is the single source of bucket membership: a released payout whose
-- booking was refunded or cancelled is classified 'owed_back' and NOT
-- 'released', so the five totals are disjoint and can be added up (D2).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.command_payout_bucket_totals()
returns table (bucket text, payout_count bigint, payout_total numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_portal_member('command')
          and (public.has_role('admin') or public.has_role('root'))) then
    raise exception 'Only Ezzy staff can read payout totals';
  end if;

  return query
  with classified as (
    select
      case
        when t.payout_status = 'released'
             and b.status in ('refunded', 'cancelled') then 'owed_back'
        else t.payout_status
      end          as b_key,
      t.payout_amount as amt
    from public.booking_transactions t
    join public.bookings b on b.id = t.booking_id
  )
  select c.b_key, count(*)::bigint, coalesce(sum(c.amt), 0)::numeric
  from classified c
  group by c.b_key;
end;
$$;

comment on function public.command_payout_bucket_totals() is
  'Command-only. Exact count and payout sum per bucket (held / releasable / released / reversed / owed_back). Read-only. Buckets are disjoint: a released payout on a refunded or cancelled booking counts ONLY as owed_back.';

revoke execute on function public.command_payout_bucket_totals() from public, anon;
grant  execute on function public.command_payout_bucket_totals() to authenticated, service_role;
```

**Blast radius**

- **Data** — none. No row is read into a write path, no row is modified, no existing
  value is validated or rewritten. Nothing can fail on existing data.
- **Lock / performance** — `create or replace function` takes a momentary lock on the
  function only; no table lock, no rewrite. At runtime it is a full scan of
  `booking_transactions` joined to `bookings`. The existing index is
  `(vendor_id, payout_status)`, whose leading column is the vendor, so it **will not**
  serve this global group-by. That is fine at current volume (low thousands of rows,
  single-digit milliseconds); it is not fine forever. Threshold and remedy recorded in
  DEFERRED so the next person does not have to rediscover it.
- **Downstream** — one hand-written interface added to `payouts.service.ts` (this repo
  hand-writes types; there is no `supabase gen types`). No other app calls it.
- **Reversibility** — `drop function public.command_payout_bucket_totals();`. The page
  then shows counts from the row fetch and no cross-bucket totals; nothing else breaks.
- **Applying it** — the migration file is **written but not applied**. Per the standing
  rule, the user runs migrations (local and hosted) themselves.

✅ **DONE (2026-09-10)** — `backbone/supabase/migrations/20260910000001_command_payout_bucket_totals.sql`
written exactly as drafted above, and `getBucketTotals()` added to
`command/services/payouts.service.ts` with a hand-written `BucketTotals` interface.
**Verified:** type-check + build clean; the service maps the RPC's rows and falls back
to zeroed totals with an error string rather than throwing.
⚠️ **NOT APPLIED.** The file is written; running it against local or hosted Supabase is
the user's to do. Everything under "needs live DB" in Verification is blocked on that.

### B2 — Make the five buckets disjoint and complete ✅ DONE (2026-09-10)

**Files:** `services/payouts.service.ts:88-110`, `components/payouts/PayoutsPage/usePayoutsPage.ts:53-58`.

Two defects, one fix. Resolved by **D2** and **D3**.

- Add a fifth bucket, **Reversed** (`payout_status = 'reversed'`), served by the existing
  `getPayouts("reversed")` — the service already accepts it (`PayoutStatus` at
  `payouts.service.ts:3` includes `reversed`); only the tab list omits it.
- **"Paid" must exclude owed-back rows.** Do this **client-side**, by dropping rows whose
  `bookingStatus` is `refunded` or `cancelled` from the `released` result. `bookingStatus`
  is already on `PayoutRow` (`payouts.service.ts:20`), so no query change is needed, and
  this deliberately avoids PostgREST embedded-filter semantics — an embedded filter
  without `!inner` returns the parent row with a **null embed** rather than excluding it,
  which is the trap `getOwedBack()` already works around at `:145`.

> **Under-specification guard.** Filtering client-side makes the server's `count: exact`
> (`payouts.service.ts:130`) an over-count for the "Paid" bucket. The count shown on the
> card **must** come from `command_payout_bucket_totals()` (B1), which classifies with the
> same CASE. The server count stays in use for one purpose only: deciding whether the
> fetch was truncated (`complete` at `:150`). An implementation that displays the raw
> server count on the Paid card satisfies the sentence above and is still wrong.

**Wording constraint (non-negotiable).** `architecture/portals.md:531` — `reversed` means
the **vendor** will not be paid and says nothing about whether the booker was refunded.
The bucket is labelled **"Reversed"** with the blurb *"The vendor will not be paid on
these. It does not mean the customer was refunded — there is no refund mechanism."*
It must never be labelled "Refunded" anywhere.

### B3 — The print view must be a second render of the full filtered set ✅ DONE (2026-09-10)

**File:** new `components/payouts/PayoutPrintView/`.

`window.print()` serialises the DOM exactly as it stands; it does not re-render. Under
Option B, rows sit inside **collapsible** vendor groups, and a collapsed group is
`display: none` — printing the on-screen tree would silently omit whole vendors from a
document that gets filed and reconciled against a bank statement. So `PayoutPrintView`
takes the **full filtered row set** as a prop and renders it flat, independent of what is
expanded on screen. Same reasoning, and same shape, as
`vendor/components/transactions/TransactionPrintView/TransactionPrintView.tsx` (read-only
reference — that app is not modified).

The printed sheet carries, per the preview: bucket name, a human-readable description of
every active filter and the search term, the sort column and direction, "N of M rows", an
Asia/Manila generated-at stamp, per-vendor subtotal rows on the *Ready to pay* bucket, a
grand total, and the "records a disbursement, does not move money" notice.

**Warnings print too.** If the fetch was truncated (`complete === false`) or errored, that
notice is rendered **into the sheet** as bordered text, not colour — browsers drop
backgrounds when printing, and the PDF is the worst place to lose the note that the totals
are understated.

**Timestamp ordering.** Stamp `printedAt` into state, then call `window.print()` in an
effect on the *next* commit. Calling it in the same tick prints the previous render, i.e.
a sheet with no timestamp. (`vendor/.../useTransactionsPage.ts:216-227` hit exactly this.)

### B4 — The "this does not move money" notice stays, on screen and on paper ✅ DONE (2026-09-10)

**File:** `PayoutsPage.tsx:44-49` today.

There is no payout rail (`architecture/portals.md:606`). The redesign compresses the
existing amber warning into a tighter single strip, but it is **not** collapsible, not
dismissible, and not moved below the fold, and it is reproduced on the printed sheet. A
"modern" pass that quietly deletes the one sentence stopping someone believing the button
sent a bank transfer is a failed pass.

---

## IMPORTANT

### I1 — Split the page per the component-separation convention ✅ DONE (2026-09-10)

`PayoutsPage.tsx` is 158 lines carrying tabs, a warning, a summary bar, a table and an
IIFE that builds the header row (`:100-124`). Everything this plan adds would land on top
of that. The page becomes a composition; **every** new component states below how
render / hook / style separation is satisfied, as the convention requires.

| Component (new dir under `components/payouts/`) | Render | Hook | Style |
|---|---|---|---|
| `PayoutsPage/PayoutsPage.tsx` | composes children, maps rows | `usePayoutsPage.ts` (data, tab, selection, release) + `usePayoutFilters.ts` (search, filters, sort, derived rows) | `PayoutsPage.module.css` |
| `PayoutBucketCards/` | pure display — props: buckets, active key, `onSelect` | none needed | `.module.css` |
| `PayoutToolbar/` | pure display — search value, filter toggle, sort control, print button | none — state lives in `usePayoutFilters` | `.module.css` |
| `PayoutFilterPanel/` | pure display — mirrors `TransactionFilterPanel` | none | `.module.css` |
| `PayoutFilterChips/` | pure display — active filters + per-chip clear | none | `.module.css` |
| `PayoutSelectionBar/` | pure display — count, total, bulk action | none | `.module.css` |
| `PayoutVendorGroup/` | header + rows | `usePayoutVendorGroup.ts` — collapse state, group confirm state | `.module.css` |
| `PayoutRow/` | one row | `usePayoutRow.ts` — inline "Record as paid?" confirm state | `.module.css` |
| `PayoutTable/` | the sortable grid used by the four non-release buckets | none — sort handlers come from the page hook | `.module.css` |
| `PayoutPrintView/` | pure display — see B3 | none | `.module.css` (all inside `@media print`) |

**Why two hooks on the page, not one.** Data/lifecycle (fetch, tab, selection, release)
and view refinement (search, filters, sort) change for different reasons and are tested
differently. One hook doing both is the current file's problem repeated at a larger size.

**No static inline `style={{}}`** in any `.tsx`. The preview's per-bucket hue is passed as
a CSS custom property on a `className`-styled element — a genuinely dynamic one-off value,
which the convention permits — not as a static style object.

### I2 — Make sortable columns keyboard-reachable ✅ DONE (2026-09-10)

**File:** `components/ui/SortableColumnHeader/SortableColumnHeader.tsx:17-30`.

Today the header is `<th onClick={...}>` with no `<button>`, no `tabIndex` and no
`aria-sort`: the column cannot be sorted from the keyboard and a screen reader is not told
the direction. This plan makes column sorting a headline feature, so it fixes the
component rather than replicating the gap: wrap the label in a real `<button>` and put
`aria-sort="ascending" | "descending"` on the `<th>`.

**Blast radius:** shared with `components/transactions/TransactionTable/TransactionTable.tsx`
and `app/ui-gallery/page.tsx`. Both gain the fix for free; neither needs edits. There are
**no committed screenshot baselines in `command`** (`visual-tests/` holds two behavioural
specs only), so nothing to regenerate.

### I3 — Search, filter panel and active-filter chips ✅ DONE (2026-09-10)

Follow the established pair `components/transactions/TransactionToolbar` +
`TransactionFilterPanel`, reusing `components/ui/SearchInput` verbatim.

- **Search** across vendor name, offering name and service date — client-side over the
  fetched bucket, case-insensitive, debounce-free (the set is already in memory).
- **Filters:** vendor (select, options derived from loaded rows), paid-from / paid-until
  (Asia/Manila day bounds — a raw UTC compare files a 07:00 PH payment under the previous
  day), min / max vendor payout.
- **Chips** for each active filter with individual clear, plus Reset, plus a count badge
  on the Filters toggle so a narrowed view is never mistaken for an empty ledger.

### I4 — Vendor-grouped rows on "Ready to pay" ✅ DONE (2026-09-10)

The chosen layout (D4). On `releasable` only, rows group by vendor: group header carries
the vendor, payout count, **group total**, a select-all-in-group toggle and a
`Mark N paid` action; rows collapse under it. The other four buckets keep the sortable
grid — they are read for audit, not paid from, and grouping there would add a click for
nothing.

Group order and within-group order both follow the active sort, so the sort control and
the column strip mean the same thing in both layouts.

### I5 — Mark one payout paid, without checkboxes ✅ DONE (2026-09-10)

**Files:** `PayoutRow/`, `PayoutVendorGroup/`, `usePayoutsPage.ts:118-140`.

Each releasable row gets a `Mark paid` button that expands **in place** into
*"Record as paid? Yes / No"*. Vendor group headers get the same treatment for
`Mark N paid`. Both call the existing `releasePayouts()` with the relevant ids — one
element for a row, N for a group. **No RPC change**: `release_booking_payouts` is bulk by
design and skips rows that are no longer `releasable` rather than failing the batch
(`20260801000008_payout_release_and_override.sql:14-18, 38-41`).

The inline confirm is not decoration. There is no un-release RPC; recording a payout is
one-way, so a single click on a money row is the wrong affordance. The existing
multi-select + selection-bar bulk path is unchanged and still present.

Report what actually moved, not what was requested — the existing `released !== selected`
toast at `usePayoutsPage.ts:130-136` already does this and must survive the refactor.

### I6 — All four states, on the new surface ✅ DONE (2026-09-10)

Loading is a skeleton, not a bare "Loading…" line. Empty distinguishes *"nothing in this
bucket"* from *"nothing matches your filters"* and, in the second case, keeps the controls
on screen with a Clear filters action — keying the empty state off the filtered rows alone
strands the user on a card with no way to widen the view. Error names what failed and says
plainly that nothing below is real data. The truncation banner
(`PayoutsPage.tsx:69-75`) stays, with its existing wording.

### I7 — `/ui-gallery` fixture + a behavioural spec ✅ DONE (2026-09-10)

`PayoutsPage` fetches its own data (`usePayoutsPage.ts:74-85`), so it cannot be dropped
into the gallery as-is. **Do not invert the page's data flow just to test it.** Mount the
*presentational* components — `PayoutBucketCards`, `PayoutVendorGroup`, `PayoutTable`,
`PayoutPrintView` — under `?mode=payouts` with fixture props, which is what the split in
I1 makes possible.

New `visual-tests/payouts.spec.ts`, behavioural in the style of `closures.spec.ts`:

1. `Mark N paid` on a group demands a confirmation before anything is recorded.
2. `PayoutPrintView` contains a row for a vendor whose group is **collapsed** on screen —
   the B3 regression guard, and the one a screenshot would never catch.
3. The Reversed bucket is labelled "Reversed" and the string "Refunded" appears nowhere in
   it (B2's wording constraint).

### I9 — `PayoutGroupColumns`, discovered during execution ✅ DONE (2026-09-10)

**File:** `components/payouts/PayoutGroupColumns/`.

Not anticipated by the plan. D5 asked for sortable columns in **both** layouts, but the
grouped release layout has no `<table>` and therefore no `<th>` for
`SortableColumnHeader` to attach to. Rather than reinstate a table on the release
surface or silently drop sorting there, the strip is its own pure-display component
sitting above the groups, driving the **same** sort state the audit table uses, and
carrying the select-all a `<thead>` checkbox would otherwise hold.

**Separation:** render `.tsx` + `.module.css`, no hook — it holds no state.
**Coupling to watch:** its grid tracks mirror `PayoutRow.module.css` exactly, including
the 780px breakpoint where the "Customer paid" column drops. If one changes, the labels
stop sitting above the cells they name. A comment on both files says so.
**Verified:** build + type-check clean; sorting exercised through the gallery fixture.

### I10 — Two rendering defects found in browser review ✅ DONE (2026-09-10)

Found by the user running the page, not by any check this plan had listed — worth
recording, because both were invisible to the build, the type-checker and the suite.

1. **`PayoutGroupColumns` had a fourth label, "Paid", sitting above the action column.**
   The row grid is `check | booking | gross | payout | action` and has no payment-date
   cell — the date lives in the booking's sub-line — so the label read as a column
   header for the "Mark paid" buttons. Removed; the strip now labels three tracks and
   leaves the checkbox and action tracks blank. Sorting by payment date is still on the
   toolbar's sort control, so nothing was lost.
2. **Service dates rendered raw ISO** (`Service 2026-04-27`) while every other date on
   the page was formatted. `bookings.booked_date` is a date column and was being printed
   as-is — the pre-redesign page did the same, so this is inherited, not introduced, but
   it looks like a bug beside `24 Apr 2026`. Now `fmtPhDate` in `PayoutRow`,
   `PayoutTable` and `PayoutPrintView`.

**Verified:** build + full suite (11/11) green after both.

### I11 — Spacing pass ✅ DONE (2026-09-10)

The layout was correct but cramped in the browser — tighter than the approved preview,
because the preview's paddings were written against its own type scale rather than the
app's. Raised across the payout surface: page band gap 14→20px; bucket card padding
13/15/14/18→17/18/18/21 with the internal gap 3→6px; list header 12/16→15/20; group
header 11/16→15/20; row 9/16/9/18→13/20/13/22; column strip 8/16/8/18→11/20/11/22; audit
table cells 11/16→14/20; selection bar 11/16→14/20; filter panel 16→20 with a 12→14 grid
gap; skeleton and empty state given more room.

**Coupling preserved:** `PayoutGroupColumns.module.css` and `PayoutRow.module.css` still
share identical grid tracks and horizontal padding, including the 780px breakpoint. They
have to, or the labels stop sitting above the cells they name.

### I12 — The band spacing was on the wrong element ✅ DONE (2026-09-10)

**File:** `components/payouts/PayoutsPage/PayoutsPage.module.css:1`.

I11's spacing pass raised `.wrap`'s gap to 20px — and it had **no effect on anything the
user could see**, because `.wrap` has exactly two children: the `.printHide` wrapper and
`PayoutPrintView`. Every visible band — intro, the no-rail notice, the bucket cards, the
blurb, the toolbar, the filter panel, the chips, the list card — is a child of
`.printHide`, which was a plain block `div` with no flex context. AppShell's global reset
(`AppShell.tsx:62`) zeroes every margin, so those bands rendered flush against each other
no matter what `.wrap` said.

**Fix:** the flex column and its gap move to `.printHide`; `.wrap` keeps only the column
direction. A comment on the rule says why, so re-nesting the screen content one level
deeper doesn't silently reintroduce it.

**Verified:** compiled CSS inspected in `.next` —
`…__printHide{flex-direction:column;gap:20px;display:flex}` alongside the print-media
`display:none!important`. Build clean; full suite 11/11.

**Process note, because it is the real lesson.** I11 was reported as verified on the
strength of grepping the declarations out of the source files. The declarations were
genuinely there — they were attached to an element with no children to space. Confirming
that a rule exists is not confirming that it applies. The gallery fixture does not mount
`PayoutsPage` itself (see I7's reasoning), so nothing in the suite would have caught this;
it took a browser. Layout changes to this page need a browser check before they are called
done.

### I8 — Update the docs ✅ DONE (2026-09-10)

`architecture/portals.md:528-531` ("Payouts Page") — rewrite for five buckets, the totals
RPC, search/filters, grouped release, single-row release and print. Record that "Paid" now
excludes owed-back rows and why. Add the RPC to the Command feature table at `:594`.

Also fix the stale reference in `app/ui-gallery/page.tsx:5` to `visual-tests/pilot.spec.ts`,
which does not exist in `command`.

✅ **DONE (2026-09-10).** Four documents touched:
- `architecture/portals.md` — "Payouts Page" section rewritten (both defects named as defects,
  the disjointness rule, the grouped-vs-table split, the confirm gate, the print reasoning);
  Command feature table row updated.
- `architecture/schema.md` — `20260910000001` added to the migration table, and
  `command_payout_bucket_totals()` documented beside the fulfilment RPCs as an explicitly
  **read-only** companion rather than a fifth writer.
- `app/ui-gallery/page.tsx` — stale `pilot.spec.ts` reference corrected.
- This plan file.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line remains. None do. -->

- **D1 — How do the bucket cards get their totals?** → **Aggregate RPC**
  (resolved 2026-09-10, user) — exact, one round trip, and the same CASE that defines
  bucket membership defines the totals, so the cards and the lists cannot disagree.
  Rejected: four count-only queries with money on the active card only (cheaper, no gate,
  but the page then shows counts and money in different places for no reason the user can
  see).
- **D2 — "Paid" double-counts owed-back rows.** → **Exclude owed-back from "Paid"**
  (resolved 2026-09-10, user) — every payout lands in exactly one bucket and the five
  totals can be added up. Accepted cost: a released-then-refunded payout no longer appears
  under "Paid". Implemented per B2, including the count-source guard.
- **D3 — `reversed` payouts are invisible.** → **Add a fifth bucket, "Reversed"**
  (resolved 2026-09-10, user) — closes a real blind spot while the bucket row is being
  rebuilt anyway. Wording constrained by `architecture/portals.md:531` (see B2).
- **D4 — Row layout.** → **Option B, vendor groups** (resolved 2026-09-10, user, from the
  preview) — a payout run is one transfer per vendor, so the group total and a single
  `Mark N paid` match the actual job. Option A (restyled data grid) is retained for the
  four audit buckets.
- **D5 — Columns sortable, and how.** → **Both** (resolved 2026-09-10, user) — real
  sortable column headers on the grid (via the fixed `SortableColumnHeader`, I2) *and* a
  column strip above the grouped rows, both driving one sort state, because the grouped
  layout has no `<thead>` to hang headers on.
- **D6 — Print scope.** → **The full active filter set, flat, with vendor subtotals on
  Ready to pay** (resolved 2026-09-10, user + preview) — see B3.
- **D7 — Filtering client-side or server-side?** → **Client-side, within the fetched
  bucket** (resolved 2026-09-10, plan author) — matches how the page already sorts
  (`usePayoutsPage.ts:88-91`) and keeps this change to one app with no query rewrite. The
  honest limit: past the 10,000-row ceiling, narrowing cannot recover rows that were never
  fetched. The existing truncation banner already says so, and the bucket totals from B1
  are exact regardless of the ceiling — so the *money* is never understated even when the
  list is. Revisit with the DEFERRED server-side item if the ledger grows.

---

## DEFERRED / COSMETIC

- **Server-side filtering and pagination.** Acceptable now: the ceiling is 10,000 rows per
  bucket, the truncation banner is honest about hitting it, and B1's totals stay exact
  above it. Revisit when a single bucket routinely exceeds the ceiling.
- **An index for the totals aggregate.** `booking_transactions_payout_status_idx` is
  `(vendor_id, payout_status)` and cannot serve a global group-by. Adding
  `(payout_status)` is a schema change and its own approval gate, and it is not warranted
  at current volume. Trigger to revisit: `command_payout_bucket_totals()` exceeding ~200 ms.
- **CSV export.** The toolbar has room and `TransactionToolbar` has a (non-functional)
  Export button. Not requested; print/PDF covers the filing case.
- **Payout rail.** Out of scope and unchanged — `architecture/portals.md:606, 618`.
- **`app/ui-gallery/page.tsx:5` names a spec that does not exist.** Cosmetic; folded into
  I8 rather than fixed silently.

---

## Execution order

> **Executed 2026-09-10 under an "execute all the stages" override.** The stages below are
> the plan as approved. In execution, stage 1 (the split) was written directly in its final
> shape rather than as a behaviour-preserving intermediate that stages 3–6 would immediately
> overwrite — the intermediate would have been discarded unverified, so verification was run
> once against the end state instead. Every other stage ran in the order given. **The stage 2
> approval gate was not waived**: the migration file was written, and applying it remains the
> user's action.

1. **Split, no behaviour change** — I1. Decompose the page into the components above with
   their hooks and stylesheets, preserving today's exact behaviour. Verifiable on its own:
   the page still loads four buckets, sorts, selects and bulk-releases identically.
2. **The RPC** — B1. ⚠️ **Approval gate**: the migration file is written only after the
   user approves the SQL above, and is **applied by the user**, never by the agent.
3. **Correct the buckets** — B2, depending on stage 2 for the exact counts. Fifth bucket,
   Paid excludes owed-back, counts sourced from the RPC.
4. **The new chrome** — I3 (search, filters, chips), I2 (accessible sortable headers),
   D5's column strip.
5. **Release ergonomics** — I4 (vendor groups) then I5 (row and group confirm). I5 depends
   on I4's group header existing.
6. **Print** — B3, which needs the filtered set from stage 4 and the grouping from stage 5
   to be meaningful.
7. **Safety, states and proof** — B4, I6, I7.
8. **Docs** — I8.

**Coupled batches.** Stages 2 and 3 ship together — a fifth bucket card with no total, or
a total that disagrees with its list, is worse than today's page. Stages 4–6 may land
separately from each other.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| I1 | `npm run build` and `npx tsc --noEmit` clean; `npm run lint` clean | machine |
| I1 | Every new dir has `.tsx` + `.module.css`, and a `use*.ts` wherever state exists; `grep -rn "style={{" components/payouts` returns only dynamic values | machine |
| B1 | Function created; `select * from command_payout_bucket_totals();` returns five bucket rows whose counts match `select payout_status, count(*) ... group by 1` adjusted by the owed-back CASE | **needs live DB** |
| B1 | Called as a non-Command user, it raises rather than returning rows | **needs live DB** |
| B2 | Card totals sum to the all-rows total; no row id appears in two buckets | **needs live DB** |
| B2 | `grep -rin "refunded" components/payouts` shows no reversed-bucket label | machine |
| B3 | Playwright: print view contains a collapsed group's rows (`visual-tests/payouts.spec.ts`) | machine |
| B3 | Actual browser print preview shows the header, filter description, subtotals and warnings | **needs browser** |
| B4 | The notice renders on screen and inside `PayoutPrintView` | machine (spec assertion) |
| I2 | Tab to a column header, press Enter, sort changes; `aria-sort` flips | machine (spec assertion) |
| I3 | Filters narrow the list and chips clear individually | machine (spec assertion) |
| I5 | Group `Mark N paid` requires confirmation before the RPC is called | machine (spec assertion) |
| I5 | A real single-row release marks exactly one row and the toast reports what moved | **needs live DB** |
| I6 | All four states render; the filtered-empty state keeps its controls | machine (gallery fixture) |
| I7 | `npx playwright test visual-tests/payouts.spec.ts` passes — full output, never piped through `tail` | machine |

### What was actually run (2026-09-10)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run build` | ✅ clean — 15 static pages generated |
| `npm run lint` | ✅ no new errors. 20 pre-existing `any` errors remain in `users.service.ts`, `vendors.service.ts`, `kyc-admin.service.ts` and `commandAuth.server.ts` — untouched by this work and **not** fixed, since they are outside its scope |
| `npx playwright test` (full suite, 11 tests) | ✅ 11 passed — 6 new in `visual-tests/payouts.spec.ts`, plus `closures.spec.ts` and `seo.spec.ts` still green after the shared `SortableColumnHeader` change |
| `grep -rn "style={{" components/payouts` | ✅ no matches — no inline style objects in any payout render layer |
| Every new component dir has `.tsx` + `.module.css`, and a `use*.ts` where state exists | ✅ verified by listing; `PayoutRow` and `PayoutVendorGroup` are the two with hooks |

**One assertion had to be corrected during the run, not the code.** The first version of the
collapsed-group print test asserted `getByText(...)` had count 0 after collapsing, and failed:
the print view holds its own copy of that row in the DOM at all times, which is the entire
point of it being a second render. Scoping the screen assertion to the group's `<section>`
and the print assertion to `data-testid="payout-print-view"` fixed it. An unscoped assertion
there would have passed whether or not the collapse worked.

### Still outstanding — needs a live database

All of these are blocked on **the user applying `20260910000001`**; none can be checked from
the working tree:

- `command_payout_bucket_totals()` returns five bucket rows, and its counts reconcile against
  a manual `group by` adjusted for the owed-back CASE.
- Called as a non-Command user, it raises rather than returning rows.
- Card totals sum to the all-rows total, and no transaction id appears in two buckets.
- A real single-row release marks exactly one row, and the toast reports what actually moved.
- Browser print preview: header, filter description, vendor subtotals, warnings.

Until then the page renders with `totalsError` set: the cards show "Total unavailable" rather
than ₱ 0, and the counts fall back to the fetched set. That degradation is deliberate — a
confident zero on a money screen is the failure this whole design was trying to avoid — but
it does mean **the page is not finished until the migration is applied**.

Nothing is marked ✅ on "it should work".
