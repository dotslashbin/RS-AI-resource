# Ezzy Vendor Mobile — Unbounded Query Truncation

**Date:** 2026-08-11
**App / scope:** `ezzy-vendor-mobile/` only. **Not** a cross-app change — see F7.
**Status:** IN PROGRESS — **Stage 1 (B1 + I1 + I2) code complete 2026-08-14**,
machine-verified, **live and device verification outstanding**. Stage 2 (B2,
contacts) not started.

> Two queries in the mobile vendor app are unbounded and silently capped at 1000
> rows by PostgREST. One of them is the monthly revenue figure. Fix both, using
> the app's own existing conventions rather than porting the web fix.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "vendor bookings plan B1").

---

## Scope

**In scope:** `src/services/dashboard.service.ts`,
`src/services/bookings.service.ts`, `src/hooks/useBookingsQuery.ts`, and the
dashboard revenue card.

**Explicitly out of scope:** `backbone/` — **investigated and clean, see F6/F7**;
`ezzy-booker-mobile` (**zero query sites — scaffold only**, F8); everything already
bounded in this app (F2–F4); `vendor/`, `booker/` and `command/`, which have their
own plans.

**This plan is deliberately small.** The investigation found far less than the
initial sweep suggested — three of the six flagged sites were false positives and
one was a downgrade. Two real defects remain, and padding the plan to look
proportionate to the investigation would misrepresent the work.

---

## Investigation findings (each verified by reading the file, 2026-08-11)

**Method note.** A `grep`-based sweep flagged six sites in this app. **Three were
false positives and one a downgrade** — a chain-matching heuristic cannot see a
`.range()` that sits on its own line after `.order()`, nor tell a `head: true`
count from a row fetch. Every item below was confirmed by opening the file.

| # | Finding | Location |
|---|---|---|
| F1 | **`getMonthlyRevenue` is unbounded** — selects `payout_amount, payout_status` over a date range with no `.range()` and no count, then sums. This is byte-for-byte the defect fixed in the web app as `getPayoutForRange`. | `src/services/dashboard.service.ts:60-70` |
| F1a | **Its cost is measured, not estimated.** The identical web query, against 1,253 rows in range, returned `Content-Range: 0-999/1253` and understated the total by **₱29,680 — 19.7%** — with no error raised to supabase-js. | vendor dashboard plan B1, verified live 2026-08-11 |
| F2 | **FALSE ALARM — `countBookingsWithStatuses`.** Uses `count: "exact", head: true`. A head request returns **no rows at all**, so `max_rows` cannot apply. Its own comment explains it is a count query precisely so badges do not under-report. | `src/services/bookings.service.ts:157-171` |
| F3 | **FALSE ALARM — `getTransactionTotals`.** Already bounded: `.range(0, TOTALS_MAX_ROWS - 1)` with `TOTALS_MAX_ROWS = 2000`, and it already returns `complete: totalCount <= TOTALS_MAX_ROWS`. **This is the pattern the rest of this plan should follow.** | `src/services/transactions.service.ts:27,150-171` |
| F4 | **FALSE ALARM — `getUnreadCount`.** `head: true` count-only, same as F2. | `src/services/notifications.service.ts:47-58` |
| F5 | **DOWNGRADE — `getUserVendors`.** Unbounded, but filtered to `user_id = <the signed-in user>`; a person belongs to a handful of vendors. Not a near-term risk. Named so it is not silently omitted; not fixed. | `src/services/vendor.service.ts:18-31` |
| F6 | **`getBookerContacts` is unbounded** — a bare `.rpc()` with no paging. The RPC returns a TABLE, which PostgREST treats as a collection, so `max_rows` applies. Its threshold is **one row per DISTINCT BOOKER**, not per booking. | `src/services/bookings.service.ts:91-100` |
| F7 | **`backbone` is clean — no items, and therefore this is NOT a cross-app change.** Two things were checked. (a) `get_booker_contacts` is the **only** set-returning function `authenticated` may execute, so the entire system's RPC-cap exposure is that one function. (b) Both Edge Functions operate per-user: `tokenRepo.forUser(userId, portal)` fetches one person's device tokens, and `recipientResolver.resolve(userId)` uses `.maybeSingle()`. Neither can approach 1000 rows. | live DB `pg_proc` query; `backbone/supabase/functions/send-push-notification/lib/tokenRepo.ts:16-26`, `send-notification-email/lib/recipientResolver.ts:12-22` |
| F8 | **`ezzy-booker-mobile` has zero `.from()` call sites** — scaffold only, as AGENTS.md states. Genuinely unaffected, not merely unexamined. | `ezzy-booker-mobile/src` |
| F9 | **This app already pages deliberately.** Bookings use infinite scroll (`getBookingsPage`, `BOOKINGS_PAGE_SIZE`) with a `created_at, id` stable sort, and badges use count queries rather than filtering an in-memory array — the code comment explicitly contrasts this with the web portal, which "fetches every booking". Loading every contact at once (F6) is the one place that philosophy is broken. | `src/services/bookings.service.ts:110-145,150-156` |
| F10 | **Contacts are fetched once, whole, and cached.** `useBookingsQuery` calls `getBookerContacts(vendorId)` as its own query and passes the resulting `Map` into every `getBookingsPage` call. So the cap is hit in one place and the consequence — blank names — appears on every page. | `src/hooks/useBookingsQuery.ts:61`, `bookings.service.ts:110-114` |
| F11 | **The app has a unit-test harness**, unlike `booker` and `command`: `node --experimental-strip-types --test "src/**/*.test.ts"`, with existing examples beside the services (`transactionTotals.test.ts`, `bookingErrors.test.ts`). Reducers here are testable without a Supabase client. | `package.json`; `src/services/*.test.ts` |

**Architecture cross-check.** `.claude/skills/mobile-dev/SKILL.md` was applied.
Two of its rules shape this plan: services and types are **copied and adapted
across repos, never imported** (so the web app's `lib/pagedFetch.ts` is not
available here and must not be reached for), and anything touching `backbone` or a
web app would be an approval gate — F7 establishes that this does not.
**No schema change is required.**

---

## BLOCKERS

### B1 — Monthly revenue is silently understated  🔄 CODE COMPLETE (2026-08-14) — machine-verified, live check outstanding
**File:** `src/services/dashboard.service.ts:60-70`

The dashboard's revenue figure sums an unbounded select. Past 1000 transactions in
the month the number is quietly wrong, and the same query on web was measured
understating by 19.7% (F1a). A vendor reading a revenue figure on their phone has
no way to tell it is short.

**Fix approach:** follow `getTransactionTotals` in this same app (F3) — it already
solves exactly this problem two files away. Add `.range(0, MAX - 1)`, request
`count: "exact"`, and return `complete` alongside the total. Do **not** port the
web app's `fetchAllPages`: it cannot be imported across repos, and this app's own
convention is a bounded window plus an honest flag, which suits a phone better
than pulling every row.

**Reuse the existing constant** rather than inventing a second ceiling — or, if
the revenue window genuinely needs a different bound from the transactions list,
say why in the code. Two unexplained ceilings in one app is how they drift.

**Verification:** live, against >1000 seeded transactions in one month.

**⚠️ Coupling added 2026-08-14 — this item now blocks another plan.**
`.plans/2026-08-14-mobile-vendor-dashboard-range-and-drilldown.md` adds a selectable
period to the dashboard, including 3- and 12-month windows over **this same query**,
which multiplies the row count and widens the understatement. Its **D5** resolved
that this B1 ships **first, as its own change**, and it sits as Stage 0 of that
plan's execution order. So: do not let that plan start ahead of this item, and when
fixing B1, expect the caller signature to gain a `DateWindow` shortly afterwards —
keep the bound and the `complete` flag independent of the window's size.

**🔄 CODE COMPLETE (2026-08-14).** `dashboard.service.ts` `getMonthlyRevenue` now
requests `count: "exact"`, orders `created_at desc` (so the bound is deterministic
rather than whatever PostgREST returned) and applies
`.range(0, TOTALS_MAX_ROWS - 1)`; it returns `complete: totalCount <=
TOTALS_MAX_ROWS` alongside `total` and `available`. `DashboardStats` gained
`revenueComplete`.

Two things done differently from the fix approach above, both narrowing the change
rather than widening it:

1. **The payable reduction was deleted, not bounded.** `getMonthlyRevenue` held its
   own copy of the `payout_status ?? "held"` + `isPayable` rule — a second home for
   the app's highest-consequence arithmetic. It now calls `sumTransactionTotals`
   and takes `.payout`, which is the same figure and is already unit-tested. Cost:
   the select carries `amount_paid` and `platform_fee_amount` too (two numerics per
   row, ≤2000 rows). `RevenueRow` and the now-unused `isPayable` / `PayoutStatus`
   imports went with it.
2. **`TOTALS_MAX_ROWS` was exported from `transactions.service.ts` rather than
   duplicated** — the "reuse the existing constant" instruction taken literally.
   Import direction is `dashboard.service → transactions.service →
   {bookings.service (type-only), transactionTotals}`; **no cycle**, verified by
   grep.

The `error` path still returns `available: false`, now with `complete: true`, so an
unreadable ledger shows one honest state ("unavailable") instead of stacking a
"partial" warning on top of it.

**Verified (machine):** `tsc --noEmit` clean; `npm test` 95/95 pass; `expo lint`
clean. **NOT verified:** the live >1000-row check below — it needs seeded data and
has not been run.

---

### B2 — Booker contacts are capped at 1000 distinct bookers  ⬜ TODO
**File:** `src/services/bookings.service.ts:91-100`, `src/hooks/useBookingsQuery.ts:61`

A bare `.rpc()` with no paging (F6). Past 1000 distinct customers the merge map is
short, so affected bookings render **blank name, email and phone** on every page
(F10). The rows still appear — they are simply anonymous — so nothing looks broken.

**Fix approach (decision D1): fetch contacts per page, not all at once.**
`getBookingsPage` already knows which bookers its ~20 rows belong to, and
server-side filtering on the RPC is **verified working** (`.eq("booker_id", …)`
returns one row; `.in(…)` is the list form). So the page's booker ids become the
filter, and no cap can be reached because no request asks for more than a page.

This also removes a second problem the cap was hiding: a vendor with thousands of
customers currently downloads and holds all of them on a phone, which contradicts
this app's own paging philosophy (F9).

**Consequence to handle, not gloss over:** the contacts query stops being a single
cached fetch, so `useBookingsQuery` needs restructuring — contacts are resolved as
part of loading a page rather than as an independent query. The `contacts`
parameter on `getBookingsPage`/`getBookingById` becomes an implementation detail
of the service rather than something the hook threads through.

**Verification:** live, against >1000 distinct bookers; plus the ordinary case,
where names must still render on page 1.

---

## IMPORTANT

### I1 — Surface the revenue figure's completeness  🔄 CODE COMPLETE (2026-08-14) — device check outstanding
**File:** dashboard revenue card

B1's `complete` flag needs somewhere to go, or it is a flag nobody reads. The
precedent is in this app already: `TransactionSummaryCards.tsx:81` renders a
notice on `totals && !totals.complete`.

**Component separation — RN variant** (`.claude/skills/mobile-dev/SKILL.md`,
stated rather than assumed): the render layer stays a pure `.tsx`; any state or
effect belongs in the companion `use*.ts`; and because React Native has no CSS
modules, **static styling goes in a co-located `*.styles.ts` exporting
`StyleSheet.create({…})`** — not inline. If the existing card already has a styles
file, extend it rather than adding a second.

**Mobile risk surface** (same skill): the notice must survive the app being
backgrounded and resumed with stale data, and must remain legible at the largest
accessibility font — a single-line notice that truncates is worse than none.

**🔄 CODE COMPLETE (2026-08-14).** A wrapping amber notice renders **below the stat
grid**, not inside the Revenue card: `DashboardView.tsx` (render only, no state
added) with a new `warning` style in `DashboardView.styles.ts` mirroring
`TransactionSummaryCards.styles.ts`'s. No `numberOfLines`, per the accessibility
note above. Copy: *"This month has more payments than can be totalled at once, so
Revenue covers the most recent ones and the real figure is higher."*

Two judgement calls, recorded because either could be re-litigated:
- **Below the grid, not in the card.** A two-line warning inside a 2×2 tile either
  truncates or breaks the row heights that `.plans/2026-07-29-…` D4 fixed.
- **Gated on `revenueAvailable && !revenueComplete`.** An unreadable ledger already
  renders "—" and its own sub-label; stacking a partial warning on it reads as two
  separate faults rather than one.
- **No row count in the copy** — the transactions warning quotes none either, and a
  number would either hardcode the ceiling in the view or pull a service constant
  into the render layer to say something the vendor cannot act on.

**Verified (machine):** `tsc`, `expo lint`, `npm test` all clean. **NOT verified:**
the notice has never been seen on screen — it needs a forced ceiling, and per the
nested `AGENTS.md` no machine check in this repo can see a style that silently does
nothing. The largest-accessibility-font and background/resume checks need a device.

---

### I2 — Cover the reducers with unit tests  ✅ DONE (2026-08-14) — satisfied by reuse, no new test written
**File:** `src/services/*.test.ts`

Unlike `booker` and `command`, this app **can** run unit tests (F11), and
`transactionTotals.test.ts` shows the established shape: the reduction lives in a
plain module so it is testable without a Supabase client.

**Fix approach:** if B1's change introduces or alters a reduction, test it there
rather than only live. Do not build a test harness for the *query* — the paging
and filtering are live-verifiable and mocking Supabase to assert it would test the
mock.

**✅ DONE (2026-08-14) — the condition never triggered, and that is the good
outcome.** B1 introduced no new reduction: it **deleted** the duplicate one and
routed the dashboard through `sumTransactionTotals`, which
`transactionTotals.test.ts` already covers (95/95 pass). The app now has one tested
home for the payable rule instead of two untested-and-one-tested copies. Writing a
second test file for the same arithmetic would have been the wrong response.

The only genuinely new logic is `complete: totalCount <= TOTALS_MAX_ROWS`, which
lives inside a Supabase-coupled function — testing it would mean mocking the
client, which this item explicitly rules out. It is on the live-verification list
instead.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. -->

- **D1 — How to fix the contacts cap** → **Per-page contacts** (resolved 2026-08-11) — filter the RPC by the booker ids of the page just loaded, rather than paging the whole customer list. Fixes the cap and stops a phone holding thousands of rows it will never show, which the "page the RPC" option would have left in place. Accepted cost: restructuring `useBookingsQuery`.
- **D2 — Whether this is a cross-app change** → **No** (resolved 2026-08-11) — `backbone` was investigated and has no items (F7), and no web app is touched. Single-app, so no AGENTS.md cross-app gate. Had backbone needed a change, this would have stopped for approval first.
- **D3 — Whether to reuse the web app's paging helper** → **No** (resolved 2026-08-11) — separate repos with no shared tooling; mobile-dev is explicit that services are copied and adapted, never imported. This app's own `getTransactionTotals` is the pattern to follow.

**No open decisions.**

---

## DEFERRED / COSMETIC

- **C1 — `getUserVendors` is unbounded** (F5). Filtered to the signed-in user's own memberships, so a handful of rows. Fix it if the file is touched for another reason.
- **C2 — `ezzy-booker-mobile`** (F8). Nothing to do until it grows a data layer; worth re-checking when it does, since it will most likely copy this app's services.
- **C3 — the ceiling.** ✅ **Resolved better than planned (2026-08-14):** there is still exactly **one** `TOTALS_MAX_ROWS`. B1 exported the existing constant from `transactions.service.ts` and imported it rather than declaring a second. The original "if a third arrives" trigger now means: *if a third call site needs it*, move it out of `transactions.service.ts` into a shared module rather than importing a service for a number.
- **C4 — dashboard parity with web vendor will diverge** — ✅ superseded 2026-08-14 by `.plans/2026-08-14-mobile-vendor-dashboard-range-and-drilldown.md`, which plans the port. ⚠️ **That plan is BLOCKED on B1 above** (its D5): it lets a vendor select a 12-month window over the unbounded `getMonthlyRevenue`, making this truncation worse. Fix B1 first. Original note follows. (noted 2026-08-12). `.plans/2026-08-12-vendor-dashboard-range-and-drilldown.md` gives web vendor an arbitrary date range picker plus clickable drill-down widgets, while this app's `dashboard.service.ts:51` `getMonthlyRevenue(vendorId, from, to)` stays a fixed monthly window with no picker and no navigation. Product-consistency gap only — the repos are independent and services are copied, never imported, so nothing breaks. Fold parity in here if it is wanted, rather than into the web plan.

---

## Execution order

Cadence is one stage at a time, per `.claude/skills/developerboss/SKILL.md`.
Committed inside `ezzy-vendor-mobile/`, which is its own git repository.

**Stage 1 — revenue (B1 + I1 + I2).** 🔄 Code complete 2026-08-14.
Self-contained, follows an existing in-app pattern, and carries the money defect.
No hook restructuring, so it can ship on its own. Files touched:
`src/services/dashboard.service.ts`, `src/services/transactions.service.ts` (one
`export`), `src/components/dashboard/DashboardView/DashboardView.tsx` and
`.styles.ts`. Not committed.

**Stage 2 — contacts (B2).**
Larger and riskier: it changes how `useBookingsQuery` composes its queries. Second
because Stage 1 delivers the more serious defect with less disruption.

**Stage 3 — live verification.** Both stages, per the table below.

**Not coupled.** Unlike the vendor web plan, these two stages touch different
files and either can ship alone.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| B1 | Seed >1000 transactions in one month; the dashboard figure matches SQL ground truth | ⚠️ live |
| B1 / I1 | Force the ceiling; the card reports partial rather than showing a short total as final | ⚠️ live |
| B2 | Seed >1000 distinct bookers; names render on a page whose bookers sort past the 1000th | ⚠️ live |
| B2 | Ordinary case: names still render on page 1, and scrolling to page 2 resolves its own | ⚠️ live |
| I1 | Notice legible at the largest accessibility font; survives background/resume | ⚠️ live, device |
| I2 | `npm test` | ✅ machine |
| All | `npx tsc --noEmit`, `npm run lint` (`expo lint` — confirm it runs before promising it) | ✅ machine |

**Live methodology — proven 2026-08-11** on the vendor web plan and reusable:
seed inside a **single transaction** with `alter table … disable trigger user`
*inside* it, so a failure rolls the disable back; tag rows with a sentinel; verify
against SQL ground truth **and** through the running app; then remove with one
scoped delete and confirm row counts, orphan counts and trigger counts return to
baseline.

**Two traps already paid for, recorded so they are not paid for twice:**
- **Check inserted row COUNTS, not the exit code.** A seed that reports success can
  insert nothing: `on_auth_user_created` on `auth.users` auto-creates the
  `profiles` row, so a `where not exists` guard silently matches nothing while the
  users insert commits. That cost 2,500 junk rows before it was noticed.
- **Unique indexes are enforced even with triggers disabled.** Check each target
  table's unique constraints before generating rows.

**Device caveat:** everything above except I1 can be verified in a simulator
against local Supabase. The accessibility-font and background/resume checks in I1
want a real device, and should be reported as unverified if one is not used —
not quietly folded into "tested on the simulator".
