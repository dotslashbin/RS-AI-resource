# Vendor Bookings — Pagination, Contacts Cap, and Realtime Cost

**Date:** 2026-08-11
**App / scope:** `vendor/` only (Bookdeck Vendor). No changes to `booker`, `command`, `backbone`, or the mobile apps.
**Status:** ✅ COMPLETE (2026-08-11). All items executed and verified live.

> `getBookings` is silently capped at 1000 rows by PostgREST, exactly as
> `getPayoutForRange` was. Fix the truncation, fix the silent-failure contract that
> hides it, fix the same cap on the booker-contacts RPC, and make realtime stop
> refetching the whole history — because paginating without that turns every
> booking event into N round trips.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app and plan (e.g. "dashboard plan B1").

---

## Scope

**In scope:** `vendor/services/bookings.service.ts`,
`vendor/services/transactions.service.ts` (the shared RPC only),
`vendor/components/layout/AppShell/useAppShell.ts`, and whatever minimal surface
is needed to report incomplete data.

**Explicitly out of scope:** the six surfaces that consume the bookings array
(Dashboard, Bookings, Schedule, Calendar, Offerings) — none of their logic
changes; `getStaff` / `getSchedules` / `getOfferings`; the same unbounded pattern
in `booker` and `command` (decision D3 — deliberately left as a follow-up audit,
and cross-app work needs its own approval).

**Predecessor:** this is item **C1** of
`.plans/2026-08-10-vendor-dashboard-ux-enhancements.md`, raised there but
deliberately not taken. That plan's B1 fixed the identical bug in
`getPayoutForRange` and **measured its cost**, which is why this one can state the
impact rather than estimate it.

---

## Investigation findings (verified in code, 2026-08-11)

| # | Finding | Location |
|---|---|---|
| F1 | `getBookings` issues one unbounded `select` — no `.range()`, no `count`. PostgREST caps it at `max_rows` and returns HTTP 206, which supabase-js does **not** surface as an error. | `services/bookings.service.ts:51-78` (query at `:57-66`) |
| F2 | `max_rows = 1000` is confirmed in the project's own config, not assumed. | `backbone/supabase/config.toml:18` |
| F3 | **The cost is measured, not theorised.** Under the dashboard plan's B1, a live vendor with 1,253 in-range transactions returned `Content-Range: 0-999/1253` and a total understated by **₱29,680 — 19.7%** — with no error raised. `bookings` is the same query shape against a table that grows faster. | dashboard plan B1, verified 2026-08-11 |
| F4 | The array feeds **six** surfaces from one shell-level fetch: Dashboard (3 widgets), Bookings, Schedule, Calendar, Offerings. Truncation is therefore not one wrong number but a consistent under-count everywhere at once. | `components/layout/AppShell/AppShell.tsx:84-92` |
| F5 | `getBookings` **swallows every error**: `if (bookingsRes.error \|\| !bookingsRes.data) return []`. A network failure, an RLS denial and a genuinely empty vendor are indistinguishable to all six surfaces. `useAppShell` calls `.then(setBookings)` with no error path. | `services/bookings.service.ts:70`, `useAppShell.ts:216` |
| F6 | Sibling services already return a richer contract — `getSchedules` and `getOfferings` return `{ data, error }`. `getBookings` and `getStaff` do not. The fix aligns with a pattern that already exists rather than inventing one. | `services/schedules.service.ts:66`, `services/offerings.service.ts:35` |
| F7 | **Realtime refetches the entire history.** The INSERT handler always calls `getBookings()`; the UPDATE handler patches in place when the row is known and otherwise falls back to a full `getBookings()`. Its comment justifies this with *"New bookings are rare enough per vendor"* — a justification that weakens as a vendor grows and that pagination would make unbounded. | `useAppShell.ts:236` (INSERT), `:269` (UPDATE fallback), comment at `:232-235` |
| F8 | The UPDATE handler **already** does the right thing for known rows — an in-place patch of the mutable columns. Only the unknown-row branch and INSERT need a targeted fetch, so the design extends existing behaviour rather than replacing it. | `useAppShell.ts:247-271` |
| F9 | `get_booker_contacts` is `STABLE SECURITY DEFINER` returning `TABLE(booker_id, full_name, email, phone)` — **one row per distinct booker**, gated on `has_vendor_role(p_vendor_id,'vendor-admin')`. PostgREST treats it as a collection (the response carries `Content-Range`), so `max_rows` applies to it as well. | verified against the live DB, `pg_get_functiondef`, 2026-08-11 |
| F10 | That RPC is called **unbounded from two places**: `getBookings` and `getTransactions`. The dashboard plan's B1 paginated the transactions query but **left this RPC untouched** — so that fix is incomplete in a way this plan closes. | `bookings.service.ts:67`, `transactions.service.ts:106` |
| F11 | The two caps have **different thresholds**: bookings truncate past 1000 *bookings*, contacts past 1000 *distinct bookers*. A vendor with 5,000 bookings from 800 customers hits the first and not the second. They must be reasoned about separately. | F1 + F9 |
| F12 | `getTransactions` already reports `contactsFailed` separately from `error`, on the grounds that money figures stay correct while names go blank. That precedent is the right shape for reporting a **truncated** contact list too. | `transactions.service.ts:78-95` |

**Claim carried into execution, NOT yet verified:** that `max_rows` truncates this
particular RPC in practice. F9 establishes that PostgREST treats it as a
collection, which is the mechanism, but the local vendor has ~14 distinct bookers
and the service-role probe returns 0 rows (the function is gated on the *calling*
user's vendor role, and service-role has no `auth.uid()`). Proving the cap needs
>1000 seeded bookers under a real vendor-admin session — see the Verification
section. **Do not mark B3 done on the mechanism argument alone.**

**Architecture cross-check:** `architecture/schema.md` and
`architecture/conventions.md` were checked. **No schema change is required** — the
RPC fix is client-side paging over an existing function, not a redefinition. No
migration, no approval gate on the data layer.

---

## BLOCKERS

### B1 — `getBookings` silently truncates at 1000 rows  ✅ DONE (2026-08-11)
**File:** `services/bookings.service.ts:51-78`

The core defect, and the direct sibling of the dashboard plan's B1. Every surface
in F4 under-reports at once: pending approvals a vendor must action, completed
counts, calendar entries, per-offering booking counts.

**Fix approach:** paginate with the same loop `getTransactions` already proves —
`PAGE_SIZE`/`MAX_ROWS`/`count: "exact"`, and a stable sort. **The current
`.order("created_at", { ascending: false })` is not a stable sort on its own**:
two bookings can share a timestamp and ties reorder between requests, which
duplicates or drops rows across page boundaries. Add `.order("id")` as the
tiebreaker, exactly as `transactions.service.ts:136-137` does.

Extract the loop rather than copy-pasting a third time — see I4.

**Verification:** 🔄 **Code complete 2026-08-11; behaviour above 1000 rows not yet
observed.** `getBookings` now pages through `fetchAllPages` with `count: "exact"`
and the `created_at, id` stable sort. `tsc`, `next build`, `npm test` (90/90) and
lint all clean; lint is unchanged at the 36 pre-existing problems, so this adds none.

**Live smoke test passed** against the real vendor (35 bookings, well under a
page): the dashboard's Operations counts render correctly and the Bookings surface
loads, so the paged path works for the ordinary case.

✅ **Verified live 2026-08-11 (Stage 4).** Seeded 1,250 bookings, taking the vendor
to **1,285 in range** — past the cap. The dashboard read **Pending 250** and
**Completed 1001**, matching SQL ground truth exactly, over **two** paged requests.

**The stable sort was tested at its worst case, not assumed.** Every seeded row was
given an **identical `created_at`**, so ordering fell entirely to the `id`
tiebreaker. Counts matching exactly is therefore proof that ties neither duplicate
nor drop rows across the page boundary — the failure this item's fix exists to
prevent.

---

### B2 — `getBookings` reports failure as "no bookings"  ✅ DONE (2026-08-11)
**File:** `services/bookings.service.ts:70`, `useAppShell.ts:216`

`return []` on error means a dropped connection renders as an empty dashboard,
an empty calendar and **zero pending approvals** — a vendor is actively told there
is no work waiting. This is arguably worse than the truncation, because
truncation at least degrades proportionally.

It is a blocker *for this plan* specifically: `complete: false` has nowhere to go
while the function can only return a bare array, so B1 cannot report its own
limits without B2.

**Fix approach (decision D2):** return
`{ data: Booking[]; error: string \| null; complete: boolean; contactsComplete: boolean }`,
matching `getSchedules`/`getOfferings` (F6) plus the completeness flags. Update
the three call sites in `useAppShell.ts:216, 236, 269`.

**Verification:** ✅ **Done 2026-08-11, including the live failure path.** Stage 2
implemented the contract; Stage 3 made the shell consume it (I3) and put it on
screen (I2). Stage 4 forced a real failure by aborting only the bookings request
after login: the shell rendered **"Bookings could not be loaded — Counts and lists
on this page are not showing your real data"**, the partial-data notice was
correctly suppressed (a failure outranks partial), and the Pending Approvals card's
`0` now arrives with an explanation instead of reading as "no work waiting".

**Coupling:** ships with B1. A contract change without the pagination is churn; the
pagination without the contract cannot report truncation.

---

### B3 — `get_booker_contacts` is capped at 1000 distinct bookers  ✅ DONE (2026-08-11)
**File:** `bookings.service.ts:67`, `transactions.service.ts:106`

Both callers invoke it unbounded (F10). Past 1000 distinct bookers the merge map
is short, so affected bookings render **blank name, email and phone**, and
search-by-booker silently matches nothing — on the Bookings page *and* the
Transactions page. The failure is invisible: the rows still appear, just anonymous.

**Fix approach:** page the RPC through the same helper as B1 —
`supabase.rpc(...).range(from, to)` is supported, so this needs no SQL change and
no migration. Report `contactsComplete: false` rather than folding it into
`error`, following the precedent at F12: the bookings themselves are still
correct, so this is partial degradation, not failure.

**Blast radius:** touches `transactions.service.ts`, which is outside the bookings
flow. That file's `contactsFailed` flag stays as it is; a new `contactsComplete`
sits beside it. The Transactions page is otherwise untouched.

**Verification:** 🔄 **Mechanism now verified live 2026-08-11; the cap itself is not.**
Extracted to `services/bookerContacts.service.ts` — one copy, used by both
`getBookings` and `getTransactions`, so the cap cannot be fixed in one and
forgotten in the other. Returns `{ byId, complete, failed }`, keeping truncation
distinct from failure per F12.

**Verified against the running database with a real vendor-admin JWT**, issuing
exactly the request `.rpc(...).order("booker_id").range(from, to)` produces:

| Window | Content-Range | Rows returned |
|---|---|---|
| `offset=0&limit=2` | `0-1/4` | first two bookers |
| `offset=2&limit=2` | `2-3/4` | next two, no overlap or gap |
| `offset=0&limit=1000` | `0-3/4` | all four |

So the RPC **does** honour paging, consecutive windows partition the set cleanly,
and `Content-Range` reports the true total whatever the window — which is what
lets the helper detect truncation. F9's "mechanism only" caveat is now discharged
for the paging; what remains unproven is behaviour past 1000 distinct bookers.

**Correction — a false finding I nearly recorded.** My first probe sent a `Range`
header and got all four rows back, which looked like "PostgREST ignores paging on
RPC". That was my test being wrong: `postgrest-js` `.range()` sets **`offset` and
`limit` query parameters**, not the `Range` header
(`node_modules/@supabase/postgrest-js/dist/index.mjs:922-928`). Retested with the
parameters the client actually sends, it works. Recorded because the wrong version
would have killed this item's approach for no reason.

✅ **Verified live 2026-08-11 (Stage 4).** The same seed gave each new booking a
**distinct booker**, taking the vendor to **1,254 distinct bookers** — past the
cap. The RPC issued **two** pages (`offset=0&limit=1000` then
`offset=1000&limit=1000`) and `contactsComplete` stayed true, so no notice
appeared. Unpaged, 1,254 bookers would have truncated at 1,000 and the "some
customer names could not be loaded" notice would have fired.

**The seed was cheaper than feared** — the plan warned this might be
disproportionate and worth parking. It was not, because `handle_new_user()` on
`auth.users` creates the matching `profiles` row automatically, so seeding bookers
meant inserting `auth.users` with an email and `raw_user_meta_data` and letting
the existing trigger do the rest.

---

## IMPORTANT

### I1 — Realtime must stop refetching the whole history  ✅ DONE (2026-08-11)
**File:** `useAppShell.ts:236` (INSERT), `:269` (UPDATE fallback)

Today each full refetch is bounded at 1000 rows by the very bug B1 removes. **B1
therefore makes this worse**: a vendor with 20,000 bookings would issue 20
sequential paged requests on every booking insert. Shipping B1 without this is a
correctness fix that buys a performance regression.

**Fix approach (decision D1):** add `getBooking(id)` — the same select and the same
single-booker contact lookup, for one row — and use it in both places:
- INSERT: fetch the one new booking and prepend it.
- UPDATE fallback: fetch the one unknown booking and insert it.

The existing in-place patch for known rows (F8) is **left exactly as it is**; this
only replaces the two full-refetch escape hatches.

The comment at `:232-235` justifying the refetch ("the payload lacks the joined
display fields… a refetch is the only correct way to build the full row") is
correct about *why* a fetch is needed and wrong only about its *scope* — update it
rather than delete it, so the reasoning survives.

**Coupling:** ships with B1. Order within the batch does not matter; shipping B1
alone does.

**Verification:** ✅ **Done 2026-08-11, measured live.** Added
`getBooking(vendorId, id)` and `getBookerContact(vendorId, bookerId)`; both
realtime escape hatches now use them. The in-place patch for known rows (F8) was
left untouched.

Verified by counting requests in a logged-in browser while a booking was
**actually inserted** into the running database:

| Moment | Requests |
|---|---|
| Initial load | 2 — one bookings page, one contacts page (`offset=0&limit=1000`) |
| **After a live INSERT** | **2** — `bookings?select=…` for the one row, and `rpc/get_booker_contacts?booker_id=eq.<one booker>` |

No re-page. The new pending booking appeared in the live queue, confirming the row
was fetched, merged and prepended. Test data removed; 0 rows left.

**Enabling discovery:** the RPC accepts a server-side filter on its returned
TABLE (`.eq("booker_id", …)`), verified live. Without that, a single new booking
would have had to re-page every customer the vendor has ever had, and this item
would have needed a different design.

---

### I2 — Decide and honour the ceiling  ✅ DONE (2026-08-11)
**File:** `services/bookings.service.ts`

`getTransactions` stops at `MAX_ROWS = 10_000` and reports `complete: false`. For a
payment ledger that ceiling is generous; for bookings it is reachable by a busy
vendor over a few years, and the consequence is a **silently short array feeding
six surfaces**.

**Fix approach:** keep an explicit ceiling — an unbounded loop is worse, since it
would hang the shell on login for a very large vendor — but treat reaching it as a
reportable state, not a silent stop. Surface `complete: false` once at shell level
rather than in each of the six surfaces: the array is shell-level state, so the
warning belongs beside it.

**Sub-question resolved (2026-08-11): the ceiling stays at 10,000.** Reasoning
recorded rather than left implicit — it matches `getTransactions`, so the two
services fail at the same point rather than in ways a reader has to memorise; and
10,000 rows already represents a heavy shell-level load, so raising it trades a
truncation the UI now *reports* for a login that silently gets slower. Revisit
only with a real number for what a large vendor accumulates, which local data
cannot supply.

**Verification:** ✅ **Done 2026-08-11.** `complete: false` now reaches the screen
via `DataNotice`, rendered once at shell level above the page content — the
bookings array is shell state feeding six surfaces, so its limits are stated once
rather than six times or not at all.

**Component separation:** `DataNotice.tsx` is a **pure display component** — no
state, effects, handlers, or non-trivial styling — so it ships as a `.tsx` only,
the documented exception. The flags live in `useAppShell` beside the data.

✅ **Ceiling behaviour verified live 2026-08-11.** Seeded to **11,285 bookings**
against the 10,000 ceiling: the client issued exactly **ten** paged requests and
stopped, the counts were a subset (227 / 896 against a true 250 / 1001) — and the
shell displayed **"Showing part of your data"**, which is the whole point. Short
data, reported as short.

**Machine-verified** by a new `pilot.spec.ts` block plus `datanotice` light/dark
baselines: failure and partial states carry different copy and different roles
(`alert` vs `status`), truncated bookings and missing contacts say different
things — conflating them would tell a vendor their totals are wrong when only
names are — and the all-clear state renders **nothing at all**. Confirmed silent
on a healthy live load.

**Note for whoever writes the next gallery test:** an unscoped
`getByRole("alert")` also matches Next's dev overlay. Scope role assertions to the
component under test.

---

### I3 — Update the three `useAppShell` call sites  ✅ DONE (2026-08-11)
**File:** `useAppShell.ts:216, 236, 269`

Mechanical consequence of B2's contract change, listed separately so it is not
forgotten inside a service-layer item.

- `:216` initial load → destructure `{ data, error, complete, contactsComplete }`
- `:236` INSERT → replaced by `getBooking(id)` (I1)
- `:269` UPDATE fallback → replaced by `getBooking(id)` (I1)

`setBookings([])` on vendor deselect (`:208-213`) stays as-is: that is a genuine
"no vendor selected" state, not a failure.

**Component separation:** `useAppShell.ts` is already a hook; no `.tsx` gains
logic. Any incompleteness banner (I2) must be a pure display component with no
state of its own.

**Verification:** ✅ **Done 2026-08-11.** The initial load now consumes
`{ data, error, complete, contactsComplete }` into a `BookingsStatus` beside the
array; the other two call sites were replaced by `getBooking` (I1). Vendor
deselect resets the status rather than leaving a stale failure on screen — no
vendor is not a failure. `tsc`, `next build`, `npm test` (90/90) clean; lint
unchanged at the 36 pre-existing problems.

**B2 is now genuinely closed by this**, not merely contract-shaped: an error
reaches a surface instead of rendering as an empty dashboard.

---

### I4 — Extract the paging loop instead of copying it a third time  ✅ DONE (2026-08-11)
**File:** new `lib/pagedFetch.ts`, `services/transactions.service.ts:117-154`, `services/bookings.service.ts`

The identical loop would then exist in three places: `getTransactions`,
`getFinancialsForRange`, and now `getBookings` — plus a fourth shape for the RPC.
Three copies of a loop whose *whole purpose* is to not get the boundary wrong is
how one copy quietly drifts.

**Fix approach:** a small generic helper taking a page-fetching callback and
returning `{ rows, complete }`. It must be a **pure module** importable by
`node --test` — the same constraint `lib/bookingCounts.ts` and `lib/financials.ts`
already record, since `node --test` has no bundler and cannot resolve
`@/lib/supabase/client`. That makes the boundary logic unit-testable for the first
time.

**Scope note (added 2026-08-11):** this helper is **vendor-local and stays that way**. `booker` and `command` are separate git repositories with no shared build tooling (AGENTS.md), so nothing here is importable by them, and neither has a test harness to prove a helper with. The cross-app plan therefore follows each app's own precedent instead — see its I2.

**Judgement call, stated rather than assumed:** this is the one item here that is
refactoring rather than fixing, and the simplicity-first rule says not to abstract
for its own sake. It earns its place because there are **already two** copies
before this plan adds a third, and because extracting it is what makes the
off-by-one boundary testable without a database. If execution finds the helper
needs more than about 30 lines or sprouts options, that is the signal to abandon
it and copy the loop — record that here if so.

**Verification:** ✅ **Done 2026-08-11.** `lib/pagedFetch.ts` — `fetchAllPages`,
taking a `fetchPage(from, to)` callback and returning `{ rows, complete, error }`.
It knows nothing about Supabase, so callers adapt their own response shape.
No callers were changed; this stage adds the module only.

**Machine-verified:** 15 new cases in `lib/pagedFetch.test.ts`, all passing
(suite 73 → 88). `tsc --noEmit` and `next build` clean. `npm run lint` unchanged
at 36 pre-existing problems — the new files add none.

**The tests were mutation-checked rather than assumed to have teeth.** Three
deliberate breakages were introduced and all were caught:

| Mutation | Failures |
|---|---|
| Treat any short page as complete (the naive rule) | 2 |
| Off-by-one in the requested window (`from + pageSize`) | 9 |
| Return the rows gathered so far on error | 1 |

**Improvement over the loop it replaces.** `getTransactions` does
`totalCount = res.count ?? rows.length`, so a **null count silently claims
completeness**. The helper keeps the count authoritative when present and only
falls back to the short-page signal when the caller asked for no count —
so a server whose own `max_rows` sat below `pageSize` reports `complete: false`
instead of quietly truncating. That case is covered by a test.

⚠️ **Over the stated threshold, kept deliberately.** The helper is **39 executable
lines**, not "about 30". Recording it because this item's own abandon condition
said to. Judged still worth keeping: 12 of those lines are three plain interface
declarations and the actual logic is ~23 lines with one 3-line predicate. The
threshold existed to stop this becoming a complicated abstraction, and it has not
— the two options it takes (`pageSize`, `maxRows`) are the two constants the
original loop already had. Had it needed branching per caller, the answer would
have been to abandon it.

**Carried into Stage 2 — do not lose this.** The helper does not pay for itself
until the **existing** loops use it. `getTransactions` (`transactions.service.ts:117-154`)
and `getFinancialsForRange` (`:196-…`) must be migrated onto it in Stage 2, or the
result is a helper plus two copies, which is worse than the two copies alone.

---

## DECISIONS

<!-- No item may execute while an OPEN: line remains. -->

- **D1 — How to fix, given six surfaces and realtime refetches** → **Paginate + targeted realtime** (resolved 2026-08-11) — pagination for correctness, `getBooking(id)` so a booking event costs one row rather than N pages. No surface changes and no count semantics change, which the time-window option would have forced on the Offerings and Calendar pages.
- **D2 — Error contract** → **`{ data, error, complete, contactsComplete }`** (resolved 2026-08-11) — aligns with `getSchedules`/`getOfferings` (F6) and gives `complete` somewhere to live. Fixes the silent-failure defect (B2) in the same change.
- **D3 — Scope** → **`getBookings` + the contacts RPC, vendor only** (resolved 2026-08-11) — closes both truncation points including the one the dashboard plan's B1 left open (F10), while staying a single-app task so no cross-app gate applies. `booker` and `command` are left for a separate audit.

**No open decisions.** Clear to proceed to execution approval.

---

## DEFERRED / COSMETIC

- **C1 — `getStaff` embeds `schedules(bookings(status))`.** Booking rows are pulled a second time through a nested embed (`staff.service.ts:83`). PostgREST applies limits per parent row for embeds rather than via top-level `max_rows`, so this is **probably** not a truncation bug — but I have not verified it, and it is a second path by which booking data reaches the client. Worth its own look; explicitly not investigated here rather than silently assumed safe.
- **C2 — `getStaff` swallows errors too** (`staff.service.ts:80`), the same defect as B2. Out of scope because staff lists are small and the failure is far less consequential than "you have no bookings". Fix it when `getStaff` is next touched.
- **C3 — the same unbounded pattern across `booker` and `command`.** ➡️ **Now planned: `.plans/2026-08-11-crossapp-unbounded-query-truncation.md`** (created 2026-08-11). That investigation corrected two things stated here: `command/payouts.service.ts` is **already paginated**, and `command/oversight.service.ts` is not affected (its list is deliberately `.limit(50)`, the rest are `head: true` count-only). Four real sites remain across the two apps.

---

## Execution order

Cadence is one stage at a time, per `.claude/skills/developerboss/SKILL.md`.

**Stage 1 — the paging helper.** I4 ✅. — ✅ **COMPLETE 2026-08-11**
Pure module plus unit tests, no callers changed. Fully `npm test`-verifiable and
lands the boundary logic before anything depends on it.
*Blocks: Stages 2 and 3.*

**Stage 2 — bookings service.** B1 🔄, B2 🔄, B3 🔄, migrations ✅. — ✅ **COMPLETE 2026-08-11.** All three carry live-verification debt into Stage 4 by design; the code is written and machine-verified.
Pagination, the new contract, and the RPC paging. Coupled: B1 cannot report
truncation without B2, and B3 shares the helper.
*Depends on: Stage 1.*

**Stage 3 — shell wiring and realtime.** I1 ✅, I3 ✅, I2 ✅, B2 ✅. — ✅ **COMPLETE 2026-08-11**
Call sites, `getBooking(id)`, and the incompleteness surface. **Must ship in the
same batch as Stage 2** — Stage 2 alone makes the realtime refetch unbounded (I1).

**Stage 4 — live verification and cleanup.** The whole plan. — ✅ **COMPLETE 2026-08-11**
Seed, verify against ground truth, remove the seed data, update this file.

**Coupled batches:** Stage 2 + Stage 3 must land together. Stage 1 is independently
safe to ship.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| I4 | Unit tests for the paging boundary: exact multiple of a page, one row over, empty, single short page, and the ceiling | ✅ `npm test` |
| B1 | Seed >1000 bookings for one vendor; the app's counts match SQL ground truth | ⚠️ live |
| B1 | Stable sort: two bookings sharing `created_at` appear exactly once across a page boundary | ⚠️ live |
| B2 | Force a failure (block the request); UI shows an error, **not** an empty dashboard | ⚠️ live |
| B3 | Seed >1000 **distinct bookers**; booker names populate past the 1000th | ⚠️ live |
| I1 | Insert one booking with the app open; observe **one** request, not a full re-page | ⚠️ live |
| I2 | Force the ceiling; the shell reports incompleteness rather than silently short data | ⚠️ live |
| I3 | `tsc --noEmit`, `npm run lint` — both clean and both now actually runnable | ✅ machine |
| All | `npx playwright test` — no new failures beyond the known `loginreset` pair (dashboard plan C5) | ✅ machine |

**Live methodology — proven, not invented.** The dashboard plan's B1 established
it on 2026-08-11: seed tagged rows in a **single transaction** with
`alter table … disable trigger user` inside it, so any failure rolls the disable
back and cannot leave triggers off; tag rows via a sentinel (`notes =
'…-TEST'`); verify against SQL ground truth *and* through the real UI; then remove
with one cascade delete and confirm the row counts, orphan count and trigger count
return to baseline.

**Two traps that cost time last run, recorded so they don't again:**
- `bookings_no_duplicate` is a unique **index** on `(booker_id, schedule_id,
  booked_date, coalesce(start_time,'00:00'))` and is enforced even with triggers
  disabled. Seeded rows need a distinct `start_time` per row.
- **B3 needs >1000 distinct `profiles` rows**, not just bookings — a far heavier
  seed than B1's, and it touches `auth.users`. Size this before starting; if it
  proves disproportionate, park B3 with that reason stated rather than quietly
  downgrading it to a mechanism argument.

**Known limit:** I2's ceiling behaviour can be verified by temporarily lowering
`MAX_ROWS` in a scratch build, but the *right value* for it cannot be settled from
local data (see I2).


---

## Closing state (2026-08-11)

**Overall status: ✅ COMPLETE.** Every item DONE and verified live. Nothing parked
or aborted.

**Shipped:** a unit-tested paging helper (`lib/pagedFetch.ts`) that is now the only
paging loop in the app; `getBookings` paged and returning
`{ data, error, complete, contactsComplete }`; the booker-contacts RPC paged once
in a shared module used by both bookings and transactions; realtime reduced from a
full re-page to a single-row fetch; and a shell-level `DataNotice` that reports
truncation and failure instead of letting either pass as fact.

**Live verification performed** against local Supabase, all on 2026-08-11:

| Check | Result |
|---|---|
| B1 — 1,285 bookings past the cap | Pending 250 / Completed 1001, matching SQL exactly, over 2 pages |
| B1 — stable sort under maximum tie pressure | Identical `created_at` on every row; no duplicates, no drops |
| B3 — 1,254 distinct bookers past the cap | RPC issued 2 pages; contacts complete |
| I1 — realtime insert | 2 requests (one row + one contact), no re-page |
| I2 — 11,285 bookings against a 10,000 ceiling | 10 pages then stop, and the shell says the data is partial |
| B2 — forced failure | Error notice shown, partial notice suppressed |

**Machine verification:** `tsc --noEmit`, `npm test` (90/90), `next build`,
`npm run lint` (unchanged at the 36 pre-existing problems — this work adds none),
`npx playwright test` (70 passed).

**Database left exactly as found:** 18 auth users, 18 profiles, 47 bookings, zero
orphaned rows, all triggers enabled.

**A mistake worth recording.** The first seeding attempt inserted 2,500 junk
`auth.users` rows. The cause: `on_auth_user_created` auto-creates a `profiles` row,
so the `where not exists` guard in my profiles insert matched nothing while the
users insert committed — and because the statement "succeeded", psql exited 0 and
nothing looked wrong. It was caught by checking row counts rather than trusting the
exit code, and removed with a predicate verified first (2,500 rows, no email, no
bookings, no vendor memberships; the 18 originals all have emails). **Lesson for
the cross-app plan's seeding: check inserted row COUNTS, not just exit status, and
look for `auth`-schema triggers before seeding users.**

**Still open, unchanged by this plan:** `loginreset-light` / `loginreset-dark`
remain deliberately failing (dashboard plan C5), and the lint backlog (dashboard
plan C4) is untouched. The cross-app equivalents of this work are planned
separately in `.plans/2026-08-11-crossapp-unbounded-query-truncation.md`.
