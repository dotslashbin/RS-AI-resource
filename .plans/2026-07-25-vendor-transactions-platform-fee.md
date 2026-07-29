# Vendor Transaction History + Command Platform Fee Setting

**Date:** 2026-07-25
**App / scope:** `vendor` (new Transactions section), `command` (new Settings tab), `backbone` (schema)
**Status:** ✅ COMPLETE — B1 ✅, I1–I8 ✅ (2026-07-25); review findings R1–R4 ✅ (2026-07-26); R5 ✅, R6 ✅, R7 ✅ (2026-07-27). R6 decided **(b) exclude `pending` until confirmed**; R7 resolved by making Transactions **sidebar-only**. Nothing outstanding except the one gap that cannot be machine-verified here (real-device mobile print-to-PDF) and the pre-existing five-tab strip overflow noted under R7, which this work did not cause.

> **One thing remains genuinely unverified, and cannot be machine-verified here:** real-device print-to-PDF from Android Chrome and iOS Safari (I4). Everything else was confirmed at runtime, including the RLS behaviour B1 could only assert structurally (closed in I1 against the live API).
> **Nothing is committed.** All work is uncommitted working-tree changes across `backbone`, `vendor`, `command`, `.plans/` and `architecture/`, for the user to stage and branch. The two migrations and seed Block 9 *were* applied to the local dev DB with explicit approval; the local DB was left matching `seed.sql` (12% fee, 40 ledger rows).
>
> **The Transactions section will not appear under `next start`.** Discovered 2026-07-27 when the section looked missing: the vendor server on port 3000 was `next start` serving a production build compiled **2026-07-24 22:39**, i.e. before any of this work existed. `next start` serves `.next` as built and never picks up source changes, so the sidebar had no Transactions entry. Use `npm run dev`, or `npm run build` before `npm start`. Nothing was wrong with the code — verified by running an isolated `next dev` on port 3101 from a copy of the app (hardlinked `node_modules`, so the running server's `.next` was never touched), where the entry appears and the page loads.

> Give vendors a printable, searchable/filterable history of paid bookings showing amount paid, platform fee, and payout amount — with the fee percentage globally configured by Command and applied as an immutable snapshot per transaction (not recomputed live), plus payout summaries including an arbitrary date-range total.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local — qualify cross-plan refs by app (e.g. "vendor I1").

---

## Scope

**In scope:**
- `backbone`: `platform_fee_settings` (singleton config row) + `booking_transactions` (immutable per-paid-booking ledger row, written by a DB trigger — no app code touches payment confirmation).
- `command`: new "Platform Fee" tab in Settings to view/edit the global fee percentage.
- `vendor`: new "Transactions" section — searchable/filterable/sortable/paginated table (amount paid, platform fee, payout amount, offering, booker, date, status), summary cards (incl. date-range payout total), and browser-print / export-to-PDF.

**Out of scope (explicitly, per user decisions):**
- Wiring Command's existing mock `TransactionsPage` (platform-wide view) to real data — noted as a cheap natural follow-up in Roadmap below, not built now.
- Actual payout disbursement (moving money to vendors) — this plan only computes and displays the numbers; no payout/withdrawal mechanism exists or is being built.
- Refund money-movement/reconciliation — refunded bookings are reflected in the ledger and excluded from payout totals (see I3), but no reversal/clawback flow is built.
- Native mobile app changes — `vendor` is a browser PWA; "printable ... from browser and mobile" is satisfied by responsive `@media print` CSS working in both desktop and mobile browsers, not a separate mobile build.
- Wallet balance UI (`wallet_accounts`/`wallet_transactions` from schema.md's "Future Schema Additions") — unrelated future feature, not touched.

**Cross-app note:** this touches `vendor`, `command`, and `backbone` in one task — flagged per AGENTS.md's "any change that touches more than one app" approval gate. The schema/trigger change is intentionally designed to avoid touching a *fourth* app (`booker`'s payment webhook) — see B1.

---

## Investigation summary (what already exists)

- `bookings` table (`schema.md`) already has `price_paid numeric(10,2)` (snapshot at booking time) and `is_paid boolean` (flipped `true` by `booker/app/api/payment/webhook/route.ts` on a PayMongo `payment.paid`/`checkout_session.payment.paid` event, guarded to only fire on a genuine `false→true` transition).
- `vendor/services/bookings.service.ts` already has the exact join pattern needed: fetches `bookings` scoped by `vendor_id`, joins `offerings(name, code)` and `schedules(start_time)`, and merges booker contact info via the `get_booker_contacts(p_vendor_id)` RPC (profiles RLS blocks a direct join for vendor-admins). The new transactions service reuses this pattern verbatim.
- `command/components/transactions/*` is a **fully built but unwired** mock feature (`TransactionsPage`, `useTransactions`, `TransactionTable`, `TransactionFilterPanel`, `TransactionSummaryCards`, `TransactionPagination`, `TransactionToolbar`) sourced from `ALL_TXNS`/`genTxns()` in `command/lib/constants.ts`. Its `useTransactions` hook already computes `totalVolume`/`totalFees` **excluding `status === "refunded"`** from the sums — this is the precedent I3 below follows for the vendor page's payout-total exclusion rule.
- `command/components/settings/{DivisionsSettingsPage,NotificationSettingsPage}` establish the Settings-tab pattern: `SettingsPage.tsx` owns a `tab` state (`useSettingsPage.ts`) and renders one of N tab components; each tab is `TabName/{TabName.tsx,useTabName.ts,TabName.module.css}`.
- `vendor/lib/types.ts`'s `PageId` union and `Sidebar.tsx`'s `SIDE_EXTRAS`/`MAIN_TABS` arrays are where a new vendor nav page gets registered; `vendor/components/layout/AppShell/useAppShell.ts` already loads `bookings` for the `selectedVendorId` on mount + Realtime and passes it down as a prop — the same data source the new Transactions page needs, so no new fetch wiring is required at the shell level beyond adding the new transactions-ledger fetch.
- No PDF/print library or `@media print` CSS exists anywhere in the repo today — this is new (see I4 — resolved as browser-native print, no new dependency).
- No singleton/global-config table pattern exists yet; `notification_email_settings` (per-portal keyed, `authenticated` read-all, `admin`/`root` update) is the closest RLS analog and is followed for `platform_fee_settings`.
- Existing SECURITY DEFINER trigger idiom (`notify_on_new_booking`, `log_booking_status_change`) — `AFTER UPDATE`, `security definer`, `set search_path = public` — is the pattern `create_booking_transaction()` follows (B1).

---

## BLOCKERS

### B1 — Schema: `platform_fee_settings` + `booking_transactions` + snapshot trigger  ✅ DONE (2026-07-25)
**Files (created):**
- `backbone/supabase/migrations/20260725000001_platform_fee_settings.sql`
- `backbone/supabase/migrations/20260725000002_booking_transactions.sql`

**Design (per resolved decision: immutable snapshot, not live calculation):**

`platform_fee_settings` — singleton row, Command-editable:

```sql
create table public.platform_fee_settings (
  id                   smallint primary key default 1 check (id = 1),
  fee_percent          numeric(5,2) not null default 0 check (fee_percent >= 0 and fee_percent <= 100),
  updated_by           uuid references public.profiles(id) on delete set null,
  updated_at           timestamptz not null default now()
);

insert into public.platform_fee_settings (id, fee_percent) values (1, 0);

alter table public.platform_fee_settings enable row level security;

create policy "authenticated read platform_fee_settings"
  on public.platform_fee_settings for select
  to authenticated
  using (true);

create policy "command admins update platform_fee_settings"
  on public.platform_fee_settings for update
  to authenticated
  using (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')))
  with check (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')));

grant select, update on public.platform_fee_settings to authenticated;
grant select, insert, update, delete on public.platform_fee_settings to service_role;
```
Single-row UPDATE only for authenticated (never INSERT/DELETE — the row is seed-fixed, mirrors `notification_email_settings`'s "rows are seed-fixed" comment).

**`updated_at` / `updated_by` handling (verified 2026-07-25, previously left as a "confirm during execution" TODO — now resolved):** the existing generic helper is `public.set_updated_at()` (`20260504000002_schema.sql:157`), already used by `profiles`/`vendors`/`offerings`/`schedules`/`bookings`. It sets **only** `new.updated_at = now()` — it does **not** touch `updated_by`. So:
```sql
create trigger platform_fee_settings_set_updated_at
  before update on public.platform_fee_settings
  for each row
  execute function public.set_updated_at();
```
…and `updated_by` is written explicitly by the Command service in its update payload (`{ fee_percent, updated_by: user.id }`, I1). Do **not** write a bespoke trigger to derive `updated_by` from `auth.uid()` — that would invent a new pattern where an ordinary column write does the job, and `auth.uid()` is unavailable to the service-role path anyway.

`booking_transactions` — one immutable row per booking the moment it is first paid:

```sql
create table public.booking_transactions (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null unique references public.bookings(id) on delete cascade,
  vendor_id             uuid not null references public.vendors(id) on delete restrict,
  amount_paid           numeric(10,2) not null,
  platform_fee_percent  numeric(5,2) not null,
  platform_fee_amount   numeric(10,2) not null,
  payout_amount         numeric(10,2) not null,
  created_at            timestamptz not null default now()
);

create index booking_transactions_vendor_created_idx
  on public.booking_transactions(vendor_id, created_at desc);

alter table public.booking_transactions enable row level security;

create policy "vendor admins select own booking_transactions"
  on public.booking_transactions for select
  to authenticated
  using (
    public.is_active()
    and public.has_vendor_role(vendor_id, 'vendor-admin')
  );

create policy "command admins select all booking_transactions"
  on public.booking_transactions for select
  to authenticated
  using (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')));

-- No INSERT/UPDATE/DELETE policy for authenticated — trigger-only writes (SECURITY DEFINER), mirrors booking_status_log.
grant select on public.booking_transactions to authenticated;
grant select, insert, update, delete on public.booking_transactions to service_role;
```

`vendor_id` is denormalised from `bookings.vendor_id` (same rationale as `bookings.vendor_id` itself — efficient RLS filtering without a join). `booking_id unique` enforces the 1:1 relationship and is the idempotency guard against the trigger double-firing.

Snapshot trigger (fires once, at the `is_paid` false→true transition — same transition PayMongo's webhook already guards against replaying):

```sql
create or replace function public.create_booking_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee_percent numeric(5,2);
begin
  select fee_percent into v_fee_percent from public.platform_fee_settings where id = 1;
  v_fee_percent := coalesce(v_fee_percent, 0);

  insert into public.booking_transactions (
    booking_id, vendor_id, amount_paid, platform_fee_percent, platform_fee_amount, payout_amount
  ) values (
    new.id,
    new.vendor_id,
    new.price_paid,
    v_fee_percent,
    round(new.price_paid * v_fee_percent / 100, 2),
    new.price_paid - round(new.price_paid * v_fee_percent / 100, 2)
  )
  on conflict (booking_id) do nothing;  -- extra idempotency belt-and-suspenders alongside the webhook's own false→true guard

  return new;
end;
$$;

create trigger bookings_create_transaction
  after update of is_paid on public.bookings
  for each row
  when (old.is_paid is distinct from new.is_paid and new.is_paid = true)
  execute function public.create_booking_transaction();
```

**Why a trigger instead of editing `booker/app/api/payment/webhook/route.ts`:** keeps this change entirely inside `backbone` — the webhook route already does exactly one atomic thing (`update ... where is_paid = false`) and this trigger fires directly off that same write, so no `booker` app code changes, no fourth app touched, and the behavior is guaranteed even if payment confirmation is ever triggered by a different code path (e.g. a future manual "mark as paid" admin action) since it lives on the table, not the caller.

**Blast radius:**
- **Data:** Pure additive migrations — new tables, no existing table altered, no backfill of historical `bookings` rows into `booking_transactions` (open item, see I5). Zero rows fail.
- **Lock/performance:** `create table` + trivial seed insert; no lock contention on existing tables. The new trigger only fires on the narrow `is_paid` false→true path already gated by the webhook's conditional update — negligible added latency (one extra `select` + `insert` per successful payment).
- **Downstream:** `vendor/services/bookings.service.ts` (or a new sibling `transactions.service.ts`) needs a hand-written `DbBookingTransaction`/`BookingTransaction` interface per the repo's hand-authored-types convention. `command`'s settings service needs a `PlatformFeeSettings` interface.
- **Reversibility:** both tables and the trigger can be dropped cleanly in a corrective migration; no other table references them except `bookings`/`vendors`/`profiles` being referenced *by* them.

**Correction folded in (2026-07-25 review):** the vendor SELECT policy above originally read `using (public.has_vendor_role(vendor_id, 'vendor-admin'))` with **no `is_active()` guard** — a real defect, now fixed. Verified at source: `has_vendor_role()` (`20260504000002_schema.sql:277`) only checks `vendor_members` + role name and does **not** consider profile status, so a **suspended** vendor-admin would have retained read access to financial data. Every comparable vendor-scoped SELECT policy in this schema guards with `is_active()` first — `bookings` (`20260507000004_bookings.sql:114-120`) and `booking_status_log` (`20260516000006_booking_status_log.sql:46-55`). The command-admin policy correctly has no `is_active()` call, matching those same two files (command access is gated by `is_portal_member` + `has_role`), so it is left as-is deliberately, not by omission.

**Fix approach:** create the two migrations above in order, in one batch (booking_transactions' trigger depends on platform_fee_settings existing).

✅ **DONE (2026-07-25).** Both migration files written as drafted (house style: header block, section dividers, `comment on` for every table/non-obvious column, "Must run after" note). Two deliberate deviations from the drafted SQL, both semantically identical: the fee amount is computed into a `v_fee_amount` variable instead of calling `round()` twice, which guarantees `platform_fee_amount + payout_amount = amount_paid` exactly rather than relying on two independent roundings agreeing; and the `set_updated_at()` trigger from the review is included.

**Verified — machine-verifiable, executed against the running local Postgres inside a `BEGIN … ROLLBACK` transaction** (no `db reset`, no mutation; confirmed afterwards that neither table exists and the DB is untouched). 9 checks, all passing:
1. Both migrations apply cleanly in order — every DDL statement succeeds, all referenced helpers/tables resolve.
2. Singleton row seeded at `fee_percent = 0`.
3. Singleton constraint holds — inserting `id = 2` is rejected by `platform_fee_settings_id_check`.
4. **Trigger math:** flipping `is_paid` false→true on the ₱850 seed booking at 12% produced exactly one ledger row — `850.00` paid / `12.00`% / `102.00` fee / `748.00` payout, and `fee + payout = amount_paid` exactly.
5. **Idempotency:** repeating the same update created no second row (count stayed 1) — the `WHEN` clause plus `on conflict do nothing` both hold.
6. **Unpaid bookings produce no ledger row** — 2 unpaid seed bookings, 1 ledger row total. Confirms a failed/abandoned payment never reaches this table.
7. **Snapshot immutability:** changing the global rate to 40% afterwards left the existing row at 12% / ₱748.00 — the entire point of the design, now proven rather than asserted.
8. `set_updated_at()` fired on the settings row.
9. **RLS + grants:** all 4 policies present with correct `cmd`; `authenticated` has `SELECT` on `booking_transactions` and `SELECT,UPDATE` on `platform_fee_settings` (no TRUNCATE), `service_role` full DML, **`anon` has no grants at all** — matches the `20260620000001` invariant.

**Not yet verified (needs a live environment):** RLS behaviour under a *real* authenticated session — the checks above confirm the policies exist and are correctly shaped, but not that a suspended vendor-admin is actually denied. That requires a logged-in browser/session and is covered by I1/I2's verification step.

**Not applied to any database.** The files are untracked working-tree additions only; applying them is the user's call (see the Repo / branch state note — a `db reset` on this backbone branch would drop the `divisions` table, which the local DB currently has).
<!-- superseded status history: ⬜ TODO → ✅ DONE (2026-07-25) -->

---

## IMPORTANT

### I1 — Command: Platform Fee settings tab  ✅ DONE (2026-07-25)
**Files (new):**
- `command/components/settings/PlatformFeeSettingsPage/PlatformFeeSettingsPage.tsx`
- `command/components/settings/PlatformFeeSettingsPage/usePlatformFeeSettingsPage.ts`
- `command/components/settings/PlatformFeeSettingsPage/PlatformFeeSettingsPage.module.css`
- `command/services/platformFeeSettings.service.ts`

**Edit:** `command/components/settings/SettingsPage/SettingsPage.tsx` (add third tab button + render branch), `command/components/settings/SettingsPage/useSettingsPage.ts` (extend `tab` union with `"platformFee"`), `command/lib/types.ts` (add `PlatformFeeSettings` interface).

Follows the `DivisionsSettingsPage`/`useDivisionsSettingsPage` hook-as-controller split exactly (render layer has no state; hook owns fetch/save/loading/error). UI: single numeric percent input (0–100, 2 decimals) + Save button, showing last-updated `updated_at`/`updated_by` (resolve `updated_by` to a display name via a `profiles` join — command admins can already read all `profiles`, no new RPC needed unlike vendor's booker-contact case). Optimistic-or-simple save (loading + toast on error) matching the existing toggle/save patterns in `DivisionsSettingsPage`/`NotificationSettingsPage`.

**Component-separation check (per `.claude/skills/component-separation/SKILL.md`):** `PlatformFeeSettingsPage.tsx` — has a form input + save handler → **needs** `usePlatformFeeSettingsPage.ts` (owns `feePercent`, `loading`, `saving`, `handleSave`). Styling: co-located `.module.css`, matching command's CSS-Modules-first convention (per `conventions.md`'s Styling Conventions).

**Fix approach:** build service (`getPlatformFeeSettings`/`updatePlatformFeeSettings`), hook, render component, wire into `SettingsPage`.

✅ **DONE (2026-07-25).** Created `services/platformFeeSettings.service.ts` and `components/settings/PlatformFeeSettingsPage/{PlatformFeeSettingsPage.tsx,usePlatformFeeSettingsPage.ts,PlatformFeeSettingsPage.module.css}`; edited `SettingsPage.tsx`, `useSettingsPage.ts` (tab union), `lib/types.ts` (`PlatformFeeSettings`). Follows the `DivisionsSettingsPage` hook-as-controller split; CSS Module per command's CSS-Modules-first convention; no inline static styles. `updated_by` is written by the service and `updated_at` by the `set_updated_at()` trigger, exactly as B1 specified.

**Two additions beyond the plan's text, both to prevent a costly misunderstanding:**
1. **A live money-split preview** — "On a ₱1,000 booking the platform keeps ₱120 and the vendor receives ₱880", updating as you type. A bare percentage box invites entering `88` when you meant `12`; showing the split makes that mistake self-evident before saving.
2. **An explicit note that the change is future-only** — the snapshot rule is the whole premise of this feature, and an admin who assumes editing the rate restates historical payouts would draw wrong conclusions from the vendor Transactions page. Stating it in the UI is cheaper than explaining it later.

**Verified — live environment, 29/29 automated browser checks** (Playwright against a real dev server as `jun@bookdeck.com`, a command admin), plus `tsc --noEmit` clean and `npx eslint` clean on all new/changed files:
- Loads the seeded 12% from the DB; shows "Last changed 26m ago by Jun Villanueva".
- **Save gating**: disabled when unchanged, still disabled for an equivalent value (`12` vs `12.00`), enabled only on a genuine change, disabled again after a successful save.
- **Validation**: rejects >100, negative, and empty; `aria-invalid` set for assistive tech; Save blocked while invalid.
- **Cancel** restores the stored rate.
- **Round-trip**: saving 15.5 wrote `15.50` to the DB, recorded `updated_by` = `jun@bookdeck.com`, the `set_updated_at` trigger bumped `updated_at`, and the UI re-read the server value rather than trusting local state.
- **The immutable-snapshot design proven end-to-end through the real UI** — after changing the rate to 15.5%: all 32 existing transactions remained at 12.00% and Citywide's payable payout stayed exactly ₱19,140; then paying a previously-unpaid booking produced a new row at **15.50%** (₱1,200 → ₱186 fee / ₱1,014 payout), leaving the ledger holding both `12.00` and `15.50`. This is the single most important behavioural claim in the plan and it is now demonstrated, not argued.
- Dark mode renders correctly.
- **Local DB restored** afterwards to the seeded state (12.00%, 40 ledger rows) so it still matches `seed.sql`.

**Closed the one security gap B1 left unverified** (B1 could only confirm the policies existed and were correctly shaped, not that they behave). Tested directly against the local PostgREST API with real user tokens:
- A **booker** PATCHing `platform_fee_settings` affected **0 rows** and the rate stayed 12.00; their SELECT on `booking_transactions` returned **0 rows**.
- The **`is_active()` guard added during the plan review** was proven to do real work: the same Citywide vendor-admin read **32 rows while active → 0 rows once suspended → 32 rows after being restored**. Without that guard (as originally drafted) a suspended vendor-admin would have retained access to financial data.
<!-- superseded status history: ⬜ TODO → ✅ DONE (2026-07-25) -->

### I2 — Vendor: Transactions page (table, filters, search, pagination, summaries)  ✅ DONE (2026-07-25)
**Files (new):**
- `vendor/components/transactions/TransactionsPage/TransactionsPage.tsx` + `useTransactionsPage.ts` + `TransactionsPage.module.css` (or Tailwind, per vendor's Tailwind-first convention with CSS Modules reserved for awkward geometry — this page is standard table/card layout, so **Tailwind-first**, matching vendor's existing `BookingsPage` styling approach, not command's CSS-Modules-first approach)
- `vendor/components/transactions/TransactionTable/TransactionTable.tsx` (pure render — column headers + row map)
- `vendor/components/transactions/TransactionRow/TransactionRow.tsx` (pure display component — no state/handlers, exception case per component-separation skill)
- `vendor/components/transactions/TransactionFilters/TransactionFilters.tsx` + `useTransactionFilters.ts` (search box, offering select, date-range pickers)
- `vendor/components/transactions/TransactionSummaryCards/TransactionSummaryCards.tsx` (pure display — receives computed totals as props)
- `vendor/services/transactions.service.ts` (new service file, one per DB domain per `conventions.md`)

**Edit:** `vendor/lib/types.ts` (add `PageId` = `"transactions"`, add `Transaction`/`BookingTransaction` interface), `vendor/components/layout/Sidebar/Sidebar.tsx` (add nav entry to `MAIN_TABS`), `vendor/components/layout/AppShell/AppShell.tsx` + `useAppShell.ts` (fetch transactions for `selectedVendorId` alongside the existing `getBookings`/`getStaff`/`getSchedules` calls, pass down as a prop; case for `"transactions"` page).

**Data shape returned by `transactions.service.ts`'s `getVendorTransactions(vendorId)`:** join `booking_transactions` → `bookings` (for `booked_date`, `status`, `offering_id`, `booker_id`) → `offerings(name, code)`, plus the existing `get_booker_contacts(p_vendor_id)` RPC merge for booker name/email/phone (identical merge pattern already in `bookings.service.ts`'s `getBookings`). One query + one RPC call, same as the existing `getBookings`.

**Table columns:** Date (transaction `created_at` — see I6 for why), Booker, Offering, Amount Paid, Platform Fee, Payout Amount, Status.

**Filters:** free-text search (matches booker name/email/phone + offering name, same `.includes()` pattern as command's mock `useTransactions`), offering select, date range (`from`/`to` against `booking_transactions.created_at`). Sorting on any column (reuse `SortableColumnHeader`-equivalent — vendor doesn't have this component yet; either port a minimal version or a simpler click-to-sort header, vendor's existing tables (`OfferingsPage`, `StaffPage`) don't currently sort — confirm during execution whether sorting is actually needed for v1 or is scope creep beyond "searched or filtered by date, offering name, or booker details" which the user's ask did not explicitly request sorting for. **Recommendation: skip sorting for v1** — the ask was search/filter, not sort; default order is `created_at desc`. Flag as a deferred nice-to-have (see Deferred section).

**Summary cards:** Total Amount Paid, Total Platform Fee, Total Payout — computed over the **currently filtered set** (so setting a date range immediately answers "get the summary of payout amount given a date range" — no separate report UI needed, this is the same filter+summary composition command's mock page already demonstrates). Exclude `refunded` and `cancelled` bookings from the totals (see I3), but still list them in the table with their status visible.

**Component-separation check:** `TransactionsPage.tsx` (state via hook) ✓ needs hook. `TransactionTable.tsx`/`TransactionRow.tsx` (pure render, receives rows as props) — no hook needed, pure display exception. `TransactionFilters.tsx` (owns multiple interdependent filter fields) ✓ needs hook. `TransactionSummaryCards.tsx` (receives computed numbers as props, no state) — pure display exception.

**Live-refresh gap (added 2026-07-25 review):** `useAppShell.ts:180-224` already subscribes to `bookings` INSERT/UPDATE for the selected vendor and refetches bookings on change — but a payment landing (`is_paid` false→true) creates a **`booking_transactions`** row, and nothing refetches *that* table. So a new transaction will not appear on an open Transactions page until a manual reload/navigation. **Accepted for v1, deliberately** — the existing `bookings` UPDATE subscription already fires on exactly the same event, so the cheap fix (if wanted later) is to call the new `getVendorTransactions` alongside the existing `getBookings` in that same handler, rather than adding a second Realtime channel for a new table. Not built now: it adds live-update surface area to a page whose primary use is reviewing *historical* records, and Realtime on a new table would need its own publication entry (`20260718000001_bookings_realtime.sql` pattern). Noted so the absence is a decision, not an oversight.

**Fix approach:** build service → hook → components bottom-up, wire into Sidebar/AppShell last.

✅ **DONE (2026-07-25).** Files created: `services/transactions.service.ts`; `components/transactions/{TransactionsPage/{TransactionsPage.tsx,useTransactionsPage.ts},TransactionTable/TransactionTable.tsx,TransactionRow/TransactionRow.tsx,TransactionFilters/TransactionFilters.tsx,TransactionSummaryCards/TransactionSummaryCards.tsx}`. Edited: `lib/types.ts` (`PageId` + `Transaction`), `lib/utils.ts` (`fmtPeso`, `toPhDate`, `fmtPhDate`), `Sidebar.tsx`, `TabBar.tsx`, `TopBar.tsx`, `AppShell.tsx`. Tailwind-first styling (vendor convention) — no CSS module needed, no inline static styles.

**Three deliberate deviations from the drafted plan, each with a reason:**
1. **The page self-fetches from `vendorId` instead of AppShell fetching and passing `transactions` down.** `OfferingsPage`/`ProfilePage` already establish this pattern for page-local data, and transactions are needed by exactly one page — putting the fetch in the shell would load 40 rows on every login for users who never open it. AppShell's change is now just an import + one `case` line.
2. **`TransactionFilters` has no companion hook.** The plan said it needed one, but on reflection that is wrong: `useTransactionsPage` must own the filter values because it derives the filtered rows and the totals from them. So `TransactionFilters` is a controlled presentational component, exactly like command's hook-free `TransactionFilterPanel`. Still satisfies conventions.md — it holds no state, effects or logic.
3. **No column sorting** — as the plan already decided (default `created_at desc`); the ask was search/filter.

Also had to add `transactions` to `TabBar.tsx`'s `TABS`, which the plan missed: `MAIN_TAB_PAGES` in AppShell decides whether the tab strip *renders*, so listing the page in one but not the other shows the strip with no active tab. A comment now records that coupling.

**Verified — live environment, 31/31 automated browser checks** (Playwright against `npm run dev` on :3100, logged in as `jose@bookdeck.com`, a single-vendor Citywide admin so no vendor picker). Also `npx tsc --noEmit` → clean.
- **Totals**: Total Collected ₱21,750 / Platform Fee ₱2,610 / Total Payout ₱19,140, cross-checked against SQL and internally consistent (19,140 + 2,610 = 21,750).
- **I3 exclusion visibly working**: payout card reads "Excludes 5 refunded/cancelled"; refunded/cancelled rows stay visible with their payout struck through, not hidden.
- **Pagination**: "Showing 1–10 of 32", "Page 1 of 4"; last page shows 31–32 with 2 rows; Next disabled there.
- **Search**: "Carla" → 8 rows, every visible row matches, pagination reset to page 1, and the payout card recalculated to ₱5,060.
- **Date range**: 2026-07-01..2026-07-23 → 7 rows, all inside the range, payout recalculated to ₱3,564 (this is the date-range payout summary the user asked for).
- **Boundary inclusivity (the I6 off-by-one)**: pinning from = to = a single day returns rows, proving both bounds include the whole local day.
- **Filter keys on payment date, not service date** — proved directly, not assumed: every row on the pinned day carries that payment date while its service date differs (seed staggers them 1–5 days).
- **All four UX states**: loading spinner, error state, "No transactions yet" empty state (verified on Harbor, which has 0 transactions), and "No matching transactions" + Clear filters for a filtered-to-zero result.
- **Dark mode** renders without layout break; **390px mobile** stacks the cards and scrolls the table inside its own container with zero horizontal page scroll (`scrollWidth === clientWidth`).

**Seed improvement made while verifying (folded back into I7):** the original Block 9c set the transaction date equal to `booked_date`, so both dates on every row were identical — which made the secondary "Service …" line look redundant *and* made it impossible to prove the filter keys on payment date rather than service date. Block 9c now staggers payment 1–5 days *before* the service date (the real-world order), which is both more realistic and what made the verification above possible.

**Applied to the local DB** (with the user's explicit approval): both migrations + seed Block 9, recorded in `supabase_migrations.schema_migrations` so a later `db push` won't re-run them. Purely additive — `divisions` confirmed still present (13 rows).

**Pre-existing issue found, NOT fixed (out of scope):** `npm run lint` in `vendor` fails inside ESLint's own config loading (`property 'react' closes the circle`). It reproduces on untouched files (`npx eslint lib/constants.ts`) and `booker`/`command` lint fine, so it is a pre-existing problem in vendor's ESLint setup, unrelated to this work. Reported, not silently repaired.
<!-- superseded status history: ⬜ TODO → ✅ DONE (2026-07-25) -->

### I3 — Payout-total exclusion rule for refunded/cancelled  ✅ DONE (2026-07-25) — implemented in I2's `useTransactionsPage` (`NON_PAYABLE` set); browser-verified that the payout card reads "Excludes 5 refunded/cancelled" and that such rows stay visible with a struck-through payout rather than being hidden.
**`refunded` — settled by precedent.** Command's existing `useTransactions.ts:43-45` already excludes `status === "refunded"` from `totalVolume`/`totalFees`; the money went back to the booker, so it plainly must not count toward a vendor payout. No decision needed.

**`cancelled`-after-payment — excluded** (resolved 2026-07-25 by explicit user decision, see Decisions). A booking can be paid via the PayMongo redirect and then rejected/cancelled by the vendor before completion; that path never sets `refunded`, so `cancelled` is a genuinely separate case. **Correction (2026-07-25 review):** this item previously read "decided by precedent" and silently extended the refunded rule to cover `cancelled` too. That overstated the precedent — the existing code only ever excluded `refunded`, and whether a vendor is credited for money collected on a booking they cancelled is a real business rule, not an implementation detail to infer. It was reopened and asked; the answer happened to match, but it is now a decision on the record rather than an assumption.

So the filter excludes `status in ('refunded', 'cancelled')` from the summary totals.

In either resolution, the transaction still appears as a **row in the table** (not hidden) so the vendor sees the full paid-booking history — the decision affects only whether it counts toward the summary totals.

**Why status is joined live, not snapshotted:** `booking_transactions` snapshots the *financial* figures (which must never drift), but `status` is fundamentally a live, mutable property of the booking (`pending→confirmed→completed→refunded`) — freezing it at payment time would show a booking as permanently "confirmed" even after it's later refunded. Status is read via the existing `bookings` join, not stored on `booking_transactions`.

**No payout reversal/negative-adjustment row is created on refund** — out of scope (no payout disbursement system exists yet to reverse). This is a known limitation to state plainly to the user, not silently paper over: if a vendor is later paid out and then a booking is refunded, this system does not yet produce a clawback record. Flagged in Roadmap.
<!-- resolved by precedent 2026-07-25 — no code yet, tracked for the exclusion-filter implementation in I2 -->

### I4 — Print / PDF export (browser + mobile)  ✅ DONE (2026-07-25)
**Resolved approach:** browser-native `window.print()` + a `@media print` stylesheet — **no new dependency** (none exists in the repo today; installing one would hit the AGENTS.md dependency-approval gate for no real benefit here). A "Print / Export PDF" button calls `window.print()`; the print stylesheet hides the sidebar/nav/filter controls/pagination and renders a clean header (vendor name, "Transactions — generated <timestamp>", active date-range filter if any) plus the full **filtered** result set as a table (not just the current on-screen page — pagination is a screen-only UX concern, the printed output must show everything the filters currently select, or exporting a filtered date-range report would silently truncate to 10 rows).

**Mobile browsers:** Android Chrome and iOS Safari both support "Print" → "Save as PDF" from their native share/print sheets; no code differs for mobile vs. desktop beyond the print stylesheet using relative units so it doesn't render off-page on a phone's default print action. This is a real but modest UX risk — mobile print-to-PDF flows are known to have quirks across OS/browser versions (the repo's own PWA rollout notes flag comparable real-device print/PDF-adjacent risk for the PayMongo checkout round-trip) — call this a machine-unverifiable risk (see Verification) rather than claiming full certainty pre-launch.

**Fix approach:** add print button to `TransactionsPage.tsx`, add print-only CSS (either a `@media print` block in the page's stylesheet, or Tailwind's `print:` variant utilities — vendor is Tailwind-first, so prefer `print:hidden` / `print:block` utilities over a bespoke stylesheet where possible, falling back to a small `.module.css` only for the print-specific table layout tweaks the utilities can't express cleanly).

**Mandatory implementation detail (spot-verified 2026-07-25, not just asserted):** `window.print()` does not re-render anything — it prints the DOM exactly as it stands, filtered only by the print stylesheet's visibility rules. Since `TransactionTable` only renders the current *page* of results on screen, `TransactionsPage.tsx` must render the filtered result set **twice**: the existing paginated view (`hidden`/`print:hidden` under print) and a second, unpaginated render of the full filtered array (`hidden` on screen, `print:block` under print). A naive version that just hides the sidebar/filters/pagination and prints the existing paginated table would silently truncate a filtered-date-range export to one page of rows — a real bug, not a cosmetic one, given the user's explicit ask for a printable date-range payout summary.

Verified with a standalone Playwright (headless Chromium, already present in `vendor/node_modules` via `@playwright/test`) spot-check of this exact dual-render pattern before committing to it in the plan: with 8 rows matching a filter and a screen page size of 5, `media: screen` showed 5 rows with nav/filters visible; `media: print` — and an actual generated PDF via `page.pdf()` — showed all 8 filtered rows with nav/filters/pagination hidden and the paginated table hidden. Confirms the technique works in real Chromium print/PDF rendering, not just in theory. (Throwaway test file, not committed to the repo.)

✅ **DONE (2026-07-25).** New: `components/transactions/TransactionPrintView/TransactionPrintView.tsx` (pure display; `hidden print:block`; receives `filtered`, never `paged`). Edited: `TransactionsPage.tsx` (Print button + `print:hidden` on the screen wrapper), `useTransactionsPage.ts` (`requestPrint`, `printedAt`, `filterSummary`), `AppShell.tsx` (passes `vendorName`), `app/globals.css` (`@media print` block), `InstallPrompt.tsx` + `DevVersionBadge.tsx` (`print:hidden`). No new dependency, as planned.

**Deviation from the plan's "prefer Tailwind `print:` utilities":** the shell-level resets went into a single `@media print` block in `globals.css` instead. These are structural resets on *shared* containers — `.sp-page` is `min-height:100vh; display:flex`, `<main>` is `overflow-hidden`, its content div is `overflow-y-auto` — and left alone they silently clip the printed document to one page. Expressing that as `print:` variants would have meant scattering ~8 utility classes across four layout files for rules that are page-structural, not per-component. Component-level show/hide stayed as Tailwind `print:` variants, per convention.

**Verified — live environment, 29/29 automated browser checks** (Playwright, real dev server, real generated PDFs), plus `tsc --noEmit` clean:
- **The core risk is closed:** screen table shows 10 rows; print carries **all 32**, with the paginated table hidden and the print view hidden on screen.
- **Filtered export is honest:** with a date range applied, the print output carries exactly the 7 filtered rows (not 32, not 10), the header states "Paid 2026-07-01 to 2026-07-23", and the totals restate as ₱4,050 / −₱486 / ₱3,564 — independently checked: 7 rows gross ₱4,900 − ₱850 refunded = ₱4,050, ×12% = ₱486, leaving ₱3,564.
- **No clipping:** `<main>` and its content div both compute `overflow: visible` and `.sp-page` computes `display: block` under print media (asserted directly on the fix, not via a height heuristic), and the same DOM rendered at A6 paginates to 3 pages instead of clipping at 1.
- **Chrome removed:** sidebar, topbar, tab strip and dev badge all hidden.
- **Report stands alone:** vendor name, "Transaction History", filter description, transaction count, generated date, all three totals, and an explicit note that totals exclude N refunded/cancelled rows which are still listed. Status prints as a **word**, not a colour, since browsers drop backgrounds by default.
- **Mobile:** at 390px the print output still carries all 32 rows and produces a valid PDF.
- Print button is present and keyboard-focusable.

**Two real bugs found and fixed while verifying (neither was in the plan):**
1. **Pre-existing `selectedVendorName` bug in `useAppShell.ts`.** `handleLoginSuccess` resolved the vendor name from `pendingVendors`, which is only populated for **multi-vendor** users — so a single-vendor admin logging in fresh got `null`, leaving the sidebar on "Vendor Portal" until the next reload (session restore sets it correctly). Pre-existing, but it made the printed financial report say "Vendor" instead of the business name, so it was in scope for I4's correctness rather than a "mention it and move on". Fixed by resolving the name via `getUserVendors()` only on the path that lacks it.
2. **Ctrl/Cmd-P printed an unstamped report.** The timestamp was only set by the Print button, so the very common keyboard path produced a report with no "Generated" date. Now seeded when data loads and refreshed on `beforeprint`, so the stamp is never missing — at worst slightly stale if the browser serialises before React commits.

**Still needs real-device verification (cannot be machine-verified):** actual print-to-PDF from Android Chrome and iOS Safari. Headless Chromium proves the CSS and dual-render are correct, but mobile print sheets vary by OS/browser version. This is the known gap to record in `portals.md` (I8) alongside the existing PWA real-device gaps.
<!-- superseded status history: ⬜ TODO → ✅ DONE (2026-07-25) -->

### I5 — No backfill for bookings paid before this ships  ✅ DONE (2026-07-25) — resolved as "no backfill"; B1's migrations were written with no backfill `insert`, which is the whole of the required work. Verified by construction: `20260725000002` contains no `insert into booking_transactions`, and B1's trigger test confirmed already-paid rows produce no ledger entry without a fresh false→true transition.
Any booking already `is_paid = true` **before** the B1 migration runs will never get a `booking_transactions` row — the trigger only fires on a *new* false→true transition. Those historical payments will be invisible to the new Transactions page and excluded from all summaries.

**Fix approach (pick one, confirm with user before executing B1):**
1. **One-time backfill statement** in the same migration batch: `insert into booking_transactions (...) select id, vendor_id, price_paid, <current fee_percent>, ... from bookings where is_paid = true and id not in (select booking_id from booking_transactions)`. Simple, but retroactively applies **today's** fee percentage to old payments that were made under no fee-policy at all (there is no historical fee_percent to snapshot for them) — an approximation, not a true historical record.
2. **No backfill** — the Transactions page starts empty/from-zero at go-live; only bookings paid after this ships appear. Financially honest (no invented historical fee percentages) but vendors lose visibility into pre-existing paid bookings in this specific view (that data still exists in the `bookings` table itself, just not in the new ledger).

**Resolved:** No backfill (Option 2, resolved 2026-07-25) — the ledger starts clean at go-live; pre-existing paid bookings remain visible in the `bookings` table itself but do not appear in the new Transactions view or its totals. The B1 migration will not include a backfill `insert`.
<!-- on completion: ✅ DONE (YYYY-MM-DD) — what was executed + how verified -->

### I6 — Date semantics: transaction date vs. booked (service) date  ✅ DONE (2026-07-25) — implemented via `toPhDate()` in `lib/utils.ts` + PH-date string comparison in `useTransactionsPage`; browser-verified that both bounds are inclusive of the whole local day and that the filter matches the payment date, not `booked_date`.
Two different dates exist per row: `booking_transactions.created_at` (when payment was confirmed) and `bookings.booked_date` (the scheduled service occurrence, which can be before, on, or after the payment date depending on booking flow timing). The user's ask ("searched or filtered by date") doesn't specify which.

**Resolved:** filter/sort/summarize by **transaction date** (`booking_transactions.created_at`) as the primary date — it's literally a "transaction" history and this is the date PayMongo/the platform actually recorded money movement, which is what "date-range payout summary" should mean financially. `booked_date` is still shown as a secondary column for context but is not the filterable date. Low-stakes implementation clarification, not blocking — flagged here so it isn't silently guessed wrong mid-build.

**Timezone / boundary correctness (added 2026-07-25 review — real off-by-one risk, not theoretical):** `created_at` is `timestamptz` while `<input type="date">` yields a bare `YYYY-MM-DD` string. The platform is PH-facing (UTC+8), so a payment at **07:00 on 21 Jul PH time is 23:00 on 20 Jul UTC** — naive UTC-date comparison files it under the wrong day, and any vendor reconciling a month-end payout total would find it off. Two rules the implementation must follow:
- Compare against an explicit PH-local day boundary, not a raw UTC date — i.e. resolve the `from`/`to` strings to `Asia/Manila` day start/end before querying, rather than passing the bare date string to Postgres and letting it coerce at UTC.
- The `to` bound must be **exclusive of the next day** (`< to + 1 day`), never `<= to` — `<= '2026-07-20'` silently drops every transaction that happened *during* 20 Jul, since a bare date coerces to that day's `00:00`.

Same rule applies to I7's seed backdating, so seeded rows land on the PH day they appear to.
<!-- resolved 2026-07-25 by recommendation, not a user-asked question — cheap to revisit if wrong -->

### I7 — Seed data: enough paid transactions to exercise pagination, filtering, and payout-exclusion  ✅ DONE (2026-07-25)
**File:** `backbone/supabase/seed.sql` (dev-only — the file's own header states it must never run in production)

**Gap:** today's seed data has exactly 3 `bookings` rows (`seed.sql:609-617`) and **none** of them have `is_paid = true`. Even after B1/I1/I2 ship, `booking_transactions` would have **zero rows** on a fresh `db reset` — no pagination to demo, no filter variety, no payout-exclusion example to look at. This needs deliberate new seed data, not a byproduct of the existing bookings block.

**Recipe (parameters below; exact literal INSERT rows to be generated mechanically at execution time, not hand-typed into this plan):**

1. **Seed a non-zero demo fee %** — `update public.platform_fee_settings set fee_percent = 12.00 where id = 1;` placed early in `seed.sql`, before the new bookings block, so the trigger picks up 12% (not the migration's neutral `0` default) when computing seeded transactions. The 12% value belongs only in dev-only `seed.sql`, never in the migration itself — migrations stay environment-neutral.
2. **+3 new dev booker profiles** (`seed.sql` Block 2 pattern — `auth.users` + `profiles` + `user_portals` + `user_roles`, `booker` portal, `member` role, active status), UUIDs `...0014`–`...0016`, so search-by-booker has real variety instead of every row reading "Liza Cruz". Reusing Liza (existing active booker) plus these 3 gives 4 distinct bookers to cycle through.
3. **Citywide Sports Center (`a_alpha`) — the pagination case:** ~31 new bookings cycling through the 4 bookers × the vendor's 4 existing offerings/schedules (COURT/COACH/FIT/GROUP) × distinct `booked_date`s spread over the last ~90 days. Status mix: mostly `completed`/`confirmed` (insert directly at that terminal status — `validate_booking_status_transition()` only gates *UPDATEs*, not the initial INSERT, so no need to walk pending→confirmed→completed manually), plus **3 `refunded`** and **2 `cancelled`-after-payment** rows specifically to give I3's payout-exclusion rule real data to prove correct. Combined with the 1 existing Citywide booking (flipped to paid, see step 5), that's **32 paid transactions** — at an assumed 10-rows/page (matching Command's existing `PER_PAGE = 10` convention; confirm/adjust when I2 sets its actual page size), that's 4 pages (10/10/10/2), a real pagination case.
4. **Summit Athletics Club (`a_right`) — the contrast case:** ~7 new bookings, 2 bookers × 2 offerings (COURT/COACH), mostly `completed`/`confirmed`, 1 `refunded`. Plus the 1 existing Summit booking flipped to paid = **8 paid transactions total** — deliberately under one page, to verify the UI doesn't break/paginate when it doesn't need to.
5. **Harbor Sports Complex (`a_mabuhay`):** left untouched at 0 bookings — deliberately exercises the Transactions page's empty state with no new work required.
6. **Two-step paid-flip (required for the trigger to fire and compute real fee math, not hand-typed numbers):**
   ```sql
   -- all new bookings inserted with is_paid = false (the column default) at whatever
   -- terminal status they need (completed/confirmed/refunded/cancelled)
   insert into public.bookings (...) values (...);

   -- flip false→true in one UPDATE so bookings_create_transaction (B1) fires once per row
   -- and computes platform_fee_amount/payout_amount from the 12% seeded in step 1
   update public.bookings set is_paid = true where id = any(array[<new booking ids>]);
   ```
   Liza's existing `pending` Coaching booking (`b_liza_pdc`) is deliberately **left unpaid** — it should produce **no** `booking_transactions` row, demonstrating the trigger correctly does nothing for an unpaid booking.
7. **Backdate the transaction date** so a date-range filter has something real to narrow: `booking_transactions.created_at` defaults to `now()`, which would cluster every seeded row at the exact seed-run instant. Immediately after step 6, spread them out:
   ```sql
   update public.booking_transactions
   set created_at = now() - (interval '1 day' * <deterministic per-row offset, e.g. row_number() spread over 0-90>)
   where booking_id = <each new booking id>;
   ```
   This direct `UPDATE` is allowed in `seed.sql` despite `booking_transactions` having no authenticated UPDATE policy (B1) — `db reset` seeding runs with elevated privileges, same as the rest of this file's direct inserts into trigger-only tables (e.g. Block 8's `notifications`).

**Blast radius:** dev-only file, explicitly never run in production per its own header — zero production risk. Capacity/uniqueness triggers are respected by construction (distinct `booked_date` per booker×schedule combination; completed/refunded/cancelled rows don't count against `max_capacity` per the existing capacity trigger's `pending+confirmed`-only count, so even incidental date overlap across different statuses is safe). Fully reversible via `supabase db reset`.

**Fix approach:** implement as a new "Block 9" in `seed.sql` (fee override + new booker profiles + Citywide/Summit booking batches + paid-flip + backdate), immediately after the existing Block 7 bookings, following the file's established block-comment-header style.

✅ **DONE (2026-07-25).** Added as Block 9 (9a bookers / 9b bookings / 9c backdate) at the end of `seed.sql`, plus the new bookers and the paid-transaction distribution documented in the file's top header block. Implemented as a `generate_series`-style loop rather than 38 hand-written INSERTs, so the distribution is deterministic and the intent is readable.

**One gap the plan itself missed, found during implementation:** `bookings` has an AFTER INSERT notification trigger (`bookings_notify_new`), so bulk-inserting 38 bookings would have fanned out to Citywide's 3 vendor-admins and buried Block 8's carefully curated 20-row notification set under ~100 junk rows on every `db reset`. Block 9b now disables **that trigger by name** around the insert. Critically **not** `alter table … disable trigger user` (the idiom Block 8 uses for `notifications`) — on `bookings` that would also disable `bookings_check_capacity`, `bookings_check_consistency` and `bookings_create_transaction`, the last being the entire point of the block. Re-enabled immediately after, and verified re-enabled.

**Verified — machine-verifiable, migrations + Block 9 run against the live local Postgres inside `BEGIN … ROLLBACK`** (no `db reset`; DB confirmed untouched afterwards: 0 new tables, 3 bookings, 20 notifications, 13 profiles). 13 checks, all passing:
1. **Row counts exactly as designed** — Citywide 32, Summit 8, Harbor 0.
2. **Pagination** — 32 Citywide rows = 4 pages at 10/page.
3. **Status mix** — Citywide 3 refunded + 2 cancelled (+ 9 completed, 18 confirmed); Summit 1 refunded.
4. **Unpaid stays unpaid** — Liza's pending Coaching booking has 0 ledger rows.
5. **Fee integrity** — every row snapshotted at 12.00%; zero rows where `fee + payout <> amount_paid`.
6. **Dates genuinely spread** — 2026-04-24 → 2026-07-23 across 36 distinct PH days, and exactly 1 distinct time-of-day (14:00 PH), confirming the anchor works and nothing clusters at the seed-run instant.
7. **Booker variety** — 4 distinct bookers at Citywide, so search-by-booker is demonstrable.
8. **Offering + amount variety** — all 4 Citywide offerings represented (COURT ₱850 ×9, COACH ₱1200 ×8, FIT ₱650 ×8, GROUP ₱500 ×7), so the offering filter and amount column both have real spread.
9. **The I3 exclusion rule visibly matters** — Citywide payout ₱22,836 across all rows vs **₱19,140** excluding refunded/cancelled (platform fee earned ₱2,610). A bug in that filter will be obvious rather than subtle.
10. **No notification spam** — 20 notifications before Block 9, 20 after.
11. **Trigger restored** — `bookings_notify_new` is `tgenabled = 'O'` (enabled) after the block.
12. **New bookers** — Ben Alcantara / Carla Jimenez / Dino Pascual all active with phones.
13. **End-to-end shape** — sampled the exact join the vendor page will run (date/booker/offering/status/amount/fee/payout); rows render correctly, e.g. `2026-07-11 | Ben Alcantara | COURT | refunded | 850.00 | 102.00 | 748.00`.

**Not yet verified (needs a live environment):** that the vendor Transactions UI actually paginates and filters against this data — that is I2's own verification step, and it cannot run until I2 exists.

**Not applied to any database.** `seed.sql` is modified in the working tree only; it takes effect on the user's next `supabase db reset` (which will also drop `divisions` on this branch — see Repo / branch state).
<!-- superseded status history: ⬜ TODO → ✅ DONE (2026-07-25) -->

### I8 — Documentation updates (`architecture/*.md`)  ✅ DONE (2026-07-25)
**Files:** `architecture/schema.md`, `architecture/portals.md`

Repo convention requires both, so they are tracked as real work rather than left as an afterthought:
- **`schema.md`** — add `20260725000001_platform_fee_settings.sql` and `20260725000002_booking_transactions.sql` rows to the Migration History table, plus full table entries (columns, RLS, grants, trigger behaviour) for both new tables in the Tables section, matching the level of detail every other table there carries. Also add the two tables to the Entity Relationship Overview diagram and the Delete Behaviour Summary (`bookings → booking_transactions` CASCADE; `vendors → booking_transactions` RESTRICT).
- **`portals.md`** — add the vendor Transactions section to Ezzy Vendor's Current Features, flip its "What Is Live vs Mock" table (the new Transactions row is live; note the **stale "Wallet Page (mock)" entry** described at the bottom of this plan), add the Command Platform Fee settings tab to Ezzy Command's Settings Page section and its live/mock table, and add the I4 mobile-print real-device gap to the vendor Known Gaps list alongside the existing PWA real-device gaps.

⚠️ **Both files currently have uncommitted working-tree changes from the in-flight divisions work** (`git status` at session start: `M architecture/schema.md`, `M architecture/portals.md`). Edit surgically around those existing changes — do not revert, reformat, or "clean up" anything already modified there.

**Fix approach:** do these **last**, after B1/I1/I2/I4/I7 land, so the docs describe what was actually built and verified rather than what was planned.

✅ **DONE (2026-07-25).**

**`schema.md`** — both migrations added to Migration History; full table entries for `platform_fee_settings` and `booking_transactions` (columns, index, write path, RLS, grants) placed as a readable pair before `notification_type_settings`; both added to the ERD; `bookings → booking_transactions` CASCADE, `vendors → booking_transactions` RESTRICT and `platform_fee_settings.updated_by → profiles` SET NULL added to Delete Behaviour Summary. Also recorded three things a future reader would otherwise have to rediscover: that the fee is snapshotted rather than recomputed, that status is deliberately *not* stored on the ledger, and that there is no backfill (with the reason).

**`portals.md`** — vendor Transactions section documented in Current Features; live/mock table updated for both portals; Command's Platform Fee tab documented; cross-portal parity table reworked (the old single "Wallet / Transactions" row was conflating three different things, now split into "Transactions / payouts" and "Platform fee configuration"); roadmaps updated in both portals.

**`conventions.md`** — one addition beyond the plan's stated scope, judged worth it: a Styling Conventions entry for print styles, including an explicit warning that the dual-render on the Transactions page must not be "simplified" into a single render. That collapse is an easy, well-intentioned cleanup that silently reintroduces truncated PDF exports — precisely the class of bug a convention note exists to prevent.

**Two documentation defects corrected while here (both pre-existing, both flagged earlier in this plan):**
1. **`portals.md` documented a vendor "Wallet Page (mock)"** with Balance/Transactions tabs and a `TXNS` constant. No such page, component, or constant exists anywhere in the vendor codebase — stale documentation. Replaced with the real Transactions page, plus an explicit note recording that the Wallet page never existed, so the entry is not "restored" later by someone trusting the old text.
2. **Command's "Transactions page blocked — contingent on `wallet_transactions`"** was no longer true: `booking_transactions` now supplies exactly the platform-wide data that page needs. Re-described as unblocked, with the one real mismatch called out (the mock has a payment-method column the ledger doesn't carry). Also added a note to `schema.md`'s Future Schema Additions that `wallet_transactions` is **not** the same thing as `booking_transactions`, since the similar names invite conflation.

**Also documented a general RLS trap** in `schema.md`'s RLS Philosophy, generalised from B1's defect: `has_vendor_role()`/`is_vendor_member()` do not check whether the caller is active, so every vendor-scoped policy must be written `is_active() and has_vendor_role(...)`. This is the exact mistake the plan review caught, now written down so the next table doesn't repeat it.

**Known gaps recorded** (rather than left implicit): mobile print-to-PDF unverified on real devices; no payout disbursement; and the unreconciled paid-then-cancelled money from the I3 decision.

**Verified — machine-verifiable:** all table blocks in both files have consistent column counts, code fences balanced, new sections present at the expected heading levels. Edits confirmed surgical against the in-flight divisions work: `git diff` deletions were audited line by line, and every removal is one of this plan's intentional replacements — none of the uncommitted divisions changes in `overview.md`/`portals.md`/`conventions.md` were disturbed.
<!-- superseded status history: ⬜ TODO → ✅ DONE (2026-07-25) -->

---

## DECISIONS

- Fee model: immutable snapshot ledger (`booking_transactions` + trigger) vs. live calculation → **Immutable snapshot** (resolved 2026-07-25) — matches existing audit-trail patterns in this schema and avoids historical payout figures shifting under a vendor when Command edits the fee %.
- Command's existing mock Transactions page: wire it up now vs. defer → **Defer** (resolved 2026-07-25) — plan stays scoped to vendor + fee setting; wiring the mock page is flagged as a cheap follow-up in Roadmap since the UI shell already exists and `booking_transactions` will supply exactly the data it needs.
- Backfill historical paid bookings into `booking_transactions` (I5): no backfill vs. approximate backfill using today's fee % → **No backfill** (resolved 2026-07-25) — the ledger starts clean at go-live; inventing a historical fee percentage for pre-policy payments would be misleading.

- Does a paid-then-`cancelled` booking count toward the vendor's payout total? (I3) → **Exclude from payout** (resolved 2026-07-25) — the vendor didn't deliver the service, so they aren't credited; the row still appears in the table with its `cancelled` status. Carries a known consequence, recorded deliberately rather than papered over: the booker was never refunded either (no refund mechanism exists), so that money sits with the platform **unreconciled** — see the new Deferred entry.

- File-touch scope for execution → **`vendor` + `command` + `backbone` code, plus the plan file and `architecture/{schema,portals}.md`** (resolved 2026-07-25). `booker` is touched **zero** times — B1's trigger is anchored to the `bookings.is_paid` column precisely so the PayMongo webhook route needs no changes. Documentation updates are tracked as I8.
- Git branch management → **entirely the user's** (resolved 2026-07-25). Execution must not create, switch, merge, rebase, or commit anything; all work is left as uncommitted working-tree changes for the user to stage and branch. The earlier suggestion to cut a parent-side branch is withdrawn — see the note in Repo / branch state.

All decisions are now resolved — no OPEN items remain. This plan is execution-ready pending your go-ahead.

---

## Follow-up work found in post-execution review (2026-07-26)

A skeptical re-inspection of the shipped code. The plan's own items were all executed and verified; these are **newly discovered defects** in the implementation, not unfinished plan items. Severity-ranked.

### R1 — `getTransactions` is unbounded; >1000 rows silently truncates and understates payouts  ✅ DONE (2026-07-26)
**File:** `vendor/services/transactions.service.ts:48-60`
The query has no `.limit()`/`.range()`, and `backbone/supabase/config.toml:18` sets `max_rows = 1000`. Verified against the live API: PostgREST answers an over-limit request with **HTTP 206 + `Content-Range: 0-4/32`** — *not* an error. `supabase-js` does not treat 206 as a failure, so `error` is `null` and `data` is quietly short.

**Consequence:** the first vendor to exceed 1000 lifetime paid bookings gets a Transactions page whose **Total Collected / Platform Fee / Total Payout are all silently wrong (understated)**, with no warning, and a printed PDF missing rows. This is a payout figure a vendor may reconcile against their bank — silently wrong is the worst failure mode available here.
**Fix approach:** request an exact count (`{ count: "exact" }`), and either page server-side or fetch in explicit `.range()` batches until complete; surface a clear error if the full set can't be retrieved rather than rendering a partial total. Related: the always-mounted print view holds every row in the DOM, so unbounded growth is a render cost too.

✅ **DONE (2026-07-26).** `getTransactions` now pages explicitly with `{ count: "exact" }` in 1000-row batches up to a 10,000-row ceiling, and returns `{ complete, totalCount }`. `useTransactionsPage` exposes an `incomplete` state and the page renders an amber banner naming both counts and telling the user what to do, so a partial dataset can never masquerade as a complete total. Added `.order("id")` as a **tiebreaker**: `created_at` alone is not a stable sort, and ties reorder between requests, which duplicates or drops rows across page boundaries — a second bug that only appears once paging exists.

**Verified with a real >1000-row dataset** (1,200 extra paid bookings generated for Citywide, then deleted; DB confirmed restored):
- The page showed the **true** figures — Collected ₱141,750, Payout ₱124,740 across all 1,232 rows, cards arithmetically consistent, pagination "of 1232".
- **Quantified the bug this fixes:** the old unbounded query would have fetched only the newest 1,000 rows and displayed a payout of **₱88,000 instead of ₱124,740 — understating the vendor by ₱36,740 (29%)**, with no error and no warning.
- **The safety net was exercised, not just written:** temporarily lowering the ceiling to 1,000 produced exactly the intended banner — *"Showing the 1,000 most recent of 1,232 transactions. The totals below cover only those — narrow the date range for an accurate figure."* Ceiling restored to 10,000 afterwards and confirmed no `TEMP-TEST` marker remains.
- Regression-checked against the restored 40-row dataset: 32 rows / 4 pages / ₱21,750 / ₱19,140, no warning, print still carries all 32.

### R2 — "Total Collected" is mislabelled and paired with a contradictory count  ✅ DONE (2026-07-26)
**Files:** `vendor/components/transactions/TransactionSummaryCards/TransactionSummaryCards.tsx:31-38`, `TransactionPrintView.tsx:47-52`
`totals.amountPaid` sums **payable rows only** (excludes refunded/cancelled), but `totals.count` is **all** filtered rows. The card therefore reads "Total Collected ₱21,750 · 32 transactions" when ₱25,950 was actually collected across those 32 (verified in SQL: `gross_all_32 = 25950.00`, `gross_payable_27 = 21750.00`).

So the headline figure and its own sub-label describe different row sets, and "Collected" is the wrong word for a payable-only number — money genuinely was collected on the refunded/cancelled bookings. The same inconsistency is printed onto the PDF, where it is more likely to be reconciled against a statement.
**Fix approach:** make the figure and its count describe the same set. Either label it unambiguously (e.g. "Payable Collected" with "27 of 32 counted"), or show true gross collected and give the excluded amount its own line. Do not just reword the label — the count has to agree with the number above it.

✅ **DONE (2026-07-26).** Kept all three cards on one basis (payable rows only) so `Collected = Platform Fee + Payout` always holds, and made every caption state the basis it was computed from. `totals` now carries `payableCount` alongside `count`; captions read "27 of 32 transactions" / "Deducted from 27 of 32 transactions" when anything is excluded, and collapse to plain "32 transactions" when nothing is. Label shortened to "Collected" — "Total Collected" implied a gross that this figure deliberately isn't. Print view aligned: label matches the screen and the note now reads "Totals cover 6 of 7 transactions — they exclude 1 refunded/cancelled…".

**Verified in-browser at two dataset sizes**, including an explicit arithmetic-consistency assertion (₱21,750 = ₱2,610 + ₱19,140 unfiltered; ₱4,050 = ₱486 + ₱3,564 filtered; ₱141,750 = ₱17,010 + ₱124,740 at 1,232 rows) — so a future change that puts the cards on mixed bases will fail the check rather than quietly mislead.

### R3 — The refunded/cancelled money rule has two independent definitions  ✅ DONE (2026-07-26)
**Files:** `vendor/components/transactions/TransactionsPage/useTransactionsPage.ts:12` (`NON_PAYABLE = new Set(["refunded","cancelled"])`) and `vendor/components/transactions/TransactionRow/TransactionRow.tsx:13` (`t.status !== "refunded" && t.status !== "cancelled"`)
The same business rule — which statuses are non-payable — is written twice, in two files, in two different forms. Change one (say, to also exclude `pending`) and the table strikes through rows that still count in the totals, or vice versa: a visibly self-contradicting financial screen. This is exactly the single-source-of-truth violation the pre-flight SOLID check is meant to catch, and it slipped through.
**Fix approach:** export one predicate (`isPayable(status)`) from a single module and use it in both places. While there, consider typing it against `BookingStatus` exhaustively rather than `Set<string>`, so adding a status forces a decision instead of silently defaulting to payable.

✅ **DONE (2026-07-26).** `isPayable(status)` now lives in `vendor/lib/utils.ts`, backed by an exhaustive `Record<BookingStatus, boolean>` so adding a booking status forces an explicit payable/not decision at compile time instead of silently defaulting. Both call sites use it: `useTransactionsPage`'s totals and `TransactionRow`'s strikethrough. The duplicated `NON_PAYABLE` set and the hand-written status comparison are gone.

**Behaviour deliberately preserved, not "improved":** `pending` remains payable, which is what the original code did. That is a real business question — a booker can pay at booking time before the vendor confirms, so a paid-but-unconfirmed booking currently counts toward payout — but changing it during a de-duplication refactor would have been a silent business-rule change. Flagged instead: see the new open question below.

**Verified in-browser:** every refunded/cancelled row is struck through *and* excluded from the totals, at both dataset sizes, with the cards remaining arithmetically consistent — i.e. the two surfaces provably agree now that they share one predicate.

### R4 — `platform_fee_settings` SELECT is broader than anything needs, and its migration comment says why on false grounds  ✅ DONE (2026-07-26)
**File:** `backbone/supabase/migrations/20260725000001_platform_fee_settings.sql:19-21` and its `authenticated read` policy
The policy grants SELECT to **every authenticated user**, justified in the header comment as "the trigger reads it via SECURITY DEFINER, and both the Command settings UI and the **vendor Transactions page** surface the current rate". Two-thirds of that is wrong:
- the trigger is `SECURITY DEFINER`, so it does **not** need a SELECT policy at all;
- the vendor Transactions page never reads this table — it displays the per-row snapshotted `booking_transactions.platform_fee_percent`. Verified by grep: the only reader in any app is `command/services/platformFeeSettings.service.ts`.

So the sole legitimate reader is Command, yet bookers and vendor staff can read the platform's commission rate. Not a credential leak, and vendors can infer their own rate from their transactions anyway — but bookers have no business seeing it, and `schema.md` states least privilege as the governing philosophy. `notification_email_settings` has the same over-broad grant, so there is precedent — precedent for an over-broad policy is not a justification.
**Fix approach:** narrow SELECT to `is_portal_member('command') and (has_role('admin') or has_role('root'))` in a corrective migration (never edit the applied one), and fix the header comment to state the real reason. Re-verify Command still loads afterwards.

✅ **DONE (2026-07-26).** New migration `20260726000001_platform_fee_settings_rls_tighten.sql`: drops the `authenticated read` policy, adds `command admins read platform_fee_settings` scoped identically to the existing UPDATE policy, and replaces the table comment with an accurate one. The false justification is corrected **in the new migration's header** rather than by editing `20260725000001` — that file was already applied (locally), and AGENTS.md lists "migration files are never edited after being applied" as an invariant. Editing in place was tempting since the table is unreleased and uncommitted, but overriding a stated invariant on my own judgement is not mine to do.

Table-level grants intentionally unchanged: PostgREST checks privileges *before* RLS, so `authenticated` must keep `select, update` for the Command UI to work at all — the RLS policies are what actually scope access.

**Verified against the live API with real tokens** — command-admin reads **1 row**; vendor-admin **0 rows**; booker **0 rows**. Command's settings page still loads the rate (it was re-exercised in the same run).

### R5 — Minor / cosmetic  ✅ DONE (2026-07-27) — 4 fixed, 1 dismissed as a false alarm
- ✅ **Duplicate currency formatter** (2026-07-26) — the local `peso()` is gone; `fmtPeso(n, decimals)` in `lib/utils.ts` is now the single formatter, taking `0` for summary cards and defaulting to `2` for line items.
- ✅ **Filters button reads as active on search alone** (2026-07-27) — the hook now exposes `hasPanelFilters` (offering/date only) alongside `hasFilters` (anything narrowing, search included). The toggle's styling uses the former; Reset and the "in current filter" caption keep the latter, which is what they mean. Browser-verified: typing in the search box leaves the button unstyled; setting a date and collapsing the panel keeps it primary.
- ✅ **Booker-contact RPC failure degrades silently** (2026-07-27) — `getTransactions` now returns `contactsFailed: Boolean(contactsRes.error)` and the page renders an amber banner stating that booker columns are blank and booker search won't match, while saying explicitly that amounts and payouts are unaffected. Keyed off the *error*, not off `contacts.length` — a vendor whose bookers genuinely have no contact rows also yields an empty list, and warning there would cry wolf. Verified by intercepting the RPC and returning HTTP 500: banner appears, money figures stay correct. Scope: `transactions.service.ts` only. `bookings.service.ts` has the same unchecked-RPC pattern and was **left alone** — fixing it means changing a different feature's UI, which is outside this plan.
- ✅ **Command save can display a stale value** (2026-07-27) — when the post-write read-back fails, `handleSave` now adopts the value it knows was written and shows "Saved, but the page couldn't refresh. Reload to confirm." instead of a plain success toast. Verified by letting the PATCH through and forcing only the following GET to 500: the input holds `13.5`, Save correctly goes non-dirty, warning toast shown. Previously it displayed `12` beside a success message and invited a pointless second save.
- ✖ **"Printing from the empty state produces a blank page" — FALSE ALARM** (verified 2026-07-27). The claim assumed the empty state prints nothing because `TransactionPrintView` sits after the `isEmpty` early return. But the empty-state card carries no `print:hidden`, and nothing in the `@media print` block hides it. Measured with `emulateMedia({ media: "print" })` against a genuinely empty vendor (Harbor Sports Complex, 0 transactions): the printed page contains the page title and the "No transactions yet" card, `body.scrollHeight` 240px — a sensible one-page output, not blank. **No code change made.** Recorded here because the original note was wrong, not merely low priority.

### R6 — Should a paid-but-`pending` booking count toward payout?  ✅ DONE (2026-07-27) — decided (b) exclude until confirmed
**File:** `vendor/lib/utils.ts` — `PAYABLE_BY_STATUS.pending`
Centralising the payable rule (R3) made an unexamined assumption explicit: `pending` counted as **payable**, which is what the original code did (`NON_PAYABLE` listed only `refunded`/`cancelled`). R3 preserved it rather than changing a money rule inside a de-duplication refactor, and raised it as a business question.

It is a live scenario, not theoretical: the booker pays via PayMongo at booking time, so `is_paid = true` with `status = 'pending'` happens whenever a vendor hasn't confirmed yet. Payout therefore included money for work the vendor had not even accepted.

**Decision (user, 2026-07-27): (b) exclude until confirmed** — consistent with excluding cancelled. `PAYABLE_BY_STATUS.pending` is now `false`.

Knock-on changes this required, none of which are cosmetic:
- **Exclusion wording.** "Excludes N refunded/cancelled" was now false. Summary card reads "Excludes N pending/cancelled/refunded"; the print note reads "…they exclude N pending, cancelled or refunded transactions, which are still listed below."
- **New `payoutExclusionReason(status)`** beside `PAYABLE_BY_STATUS`, surfaced as a `title` on the struck-through payout. Without it, `pending` and `cancelled` render identically, and a struck-through pending payout reads as "you will never get this" rather than "not yet". Pending says "confirm the booking to include it in your payout"; the others say "this booking was cancelled/refunded".

**Verified in the browser against a purpose-made paid+pending row** (the seed has none, which is exactly why nothing caught this before). Inserted one booking as `pending`/`is_paid = false`, then flipped `is_paid = true` so the real trigger path created the ledger row (₱500 → ₱60 fee → ₱440 payout):
- totals stayed at **₱21,750 collected / ₱19,140 payout** with the basis moving from "27 of 32" to **"27 of 33"** and "Excludes 6" — i.e. the ₱500 was listed but not counted;
- an explicit guard asserted the *old* behaviour's figures (₱22,250 / ₱19,580) are absent, so a regression fails loudly rather than quietly re-including the money;
- the row's payout is `line-through` carrying the pending-specific tooltip;
- `Collected = Fee + Payout` still holds exactly.
Test row and its ledger entry deleted afterwards; DB confirmed back to 41 bookings / 40 transactions / 20 notifications / fee 12.00, all `bookings` triggers enabled.

### R7 — Mobile tab bar: the Transactions tab sat off-screen  ✅ DONE (2026-07-27) — resolved as **sidebar-only**
**Files:** `vendor/components/layout/TabBar/TabBar.tsx`, `vendor/components/layout/AppShell/AppShell.tsx`
Measured at 390 × 844 (2026-07-27): the tab strip had `scrollWidth 760` against `clientWidth 390` with `overflow-x: auto`, and the Transactions tab's box started at **x ≈ 606** — reachable only by horizontally scrolling a strip with no affordance that it scrolls. Not caused by this feature (at ~127px/tab the strip already overflowed at five tabs), but Transactions was appended last, so it was the tab that ended up hidden — plausibly half of why the section looked missing.

**Decision (user, 2026-07-27): move Transactions to the sidebar only.**

Implemented by following the existing **Vendor Profile** precedent rather than inventing a pattern: `profile` already lives in the sidebar's `MAIN_TABS` while being absent from `AppShell`'s `MAIN_TAB_PAGES`, which makes the page render full-width with no strip. So:
- removed the `transactions` entry (and the now-unused `Receipt` import) from `TabBar`'s `TABS`;
- removed `"transactions"` from `MAIN_TAB_PAGES` — **required, not optional**: leaving it in would render the strip on the Transactions page with no tab able to show active, which is precisely the failure the sync comment in `TabBar` warns about;
- left `Sidebar`'s `MAIN_TABS` untouched — the entry is already there, under VENDOR MENU below Staff.

Both comments were rewritten to state the real invariant (every `TABS` id must be in `MAIN_TAB_PAGES`; the converse is intended for sidebar-only pages) and to record the measured width limit, so the next person doesn't re-add a sixth tab.

**Verified in the browser at 390px and 1440px:**
- strip now carries five tabs, no Transactions, on main pages; **zero** `.sp-tabbar` elements on the Transactions page; strip returns intact when navigating back to Overview;
- the sidebar entry is fully inside the 390px viewport (x 10, width 203) instead of at x ≈ 606;
- the page itself is unaffected — ₱21,750 / ₱2,610 / ₱19,140, and print still emits all 33 `<tr>`s (32 data + header) with the strip hidden and a valid A4 PDF at both widths.

**Left alone, deliberately:** the five remaining tabs still overflow 390px (`scrollWidth 626`), so Staff and part of Schedule Maker sit behind the horizontal scroll. That is pre-existing behaviour this change neither caused nor worsened — it only stopped adding to it. Fixing it means redesigning shared chrome (smaller tabs, an overflow item, or a scroll affordance), which is a separate navigation decision.

### Checked and dismissed — false alarms, recorded so they aren't re-raised
- **NULL `price_paid` breaking payment confirmation.** The new trigger runs inside the webhook's `UPDATE` transaction, so an exception there would roll back `is_paid = true` while PayMongo still believes the payment succeeded — a silent desync. But `bookings.price_paid` is `NOT NULL` (verified in `information_schema`), and the two other failure modes are already handled (`coalesce(fee_percent, 0)` for a missing settings row, `on conflict do nothing` for a replay). No action.
- **A plain vendor `member` seeing a misleading "No transactions yet".** `booking_transactions` RLS requires `vendor-admin`, so a `member` would read zero rows and get the empty state rather than an access message — except `vendor.service.ts:36` filters `getUserVendors()` to `vendor-admin`, so a member can never select a vendor or reach the app. Not reachable. No action.
- **Inline `style={{}}` in `TransactionRow.tsx:55`.** Flagged by a literal reading of the no-inline-styles convention, but the values come from `statusStyle(t.status)` — genuinely dynamic, data-driven, one-off — which the convention explicitly permits, and it matches established precedent (booker's `TransactionsPage.tsx:76`, command's `DivisionsSettingsPage.tsx:83`). Not a violation. No action.

---

## DEFERRED / COSMETIC

- **Column sorting** on the vendor Transactions table (I2) — the user's ask specified search/filter, not sort; default `created_at desc` order is acceptable for v1. Cheap to add later by porting `SortableColumnHeader`.
- **Wiring Command's existing mock TransactionsPage** to `booking_transactions` for a platform-wide view — explicitly deferred per user decision; UI already built, just needs a service + real data swap whenever prioritized.
- **Refund clawback / negative-adjustment ledger rows** — no payout disbursement system exists yet to reconcile against, so this is acceptable to leave unbuilt until that system exists.
- **Unreconciled money on paid-then-cancelled bookings** (consequence of the I3 decision) — the booker was charged, the vendor is not credited, and no refund mechanism exists, so that amount currently belongs to neither party in the ledger. Acceptable now because the amounts are small-volume and fully traceable (every such booking has a `booking_transactions` row plus a `cancelled` status and a `booking_status_log` entry naming who cancelled it), so nothing is lost — but this should be resolved when refunds or payout disbursement are built, and is the single most likely source of a "where did my money go" support question in the meantime. **Do not treat as fixed by this plan.**
- **Fee-change audit history** (more than `updated_by`/`updated_at` on the single settings row) — a full `platform_fee_history` log is unnecessary until there's a real need to see past percentages, since `booking_transactions.platform_fee_percent` already preserves the percent that applied to each individual transaction.

---

## Repo / branch state — read before executing (discovered 2026-07-25 review)

`backbone/` is **its own separate git repository** (that is why the parent repo's `.gitignore:6` ignores `backbone/` — the migrations are version-controlled, just not in the parent repo; no migration is "missing" or untracked, an earlier suspicion that turned out to be a **false alarm** on closer inspection).

Current state:

| Repo | Branch |
|------|--------|
| parent (`/home/joshua/RS`, the three apps) | `master` |
| `backbone/` | `feature/vendor_transactions` |

Two consequences that affect execution:

1. **`divisions` is not on this backbone branch.** `20260724000004_divisions.sql` exists only on backbone's unmerged `feature/division_assoc_reg` branch — the current `feature/vendor_transactions` branch ends at `20260724000003_booking_capacity_lock.sql`. Migration **replay order is still correct** whenever the two branches merge (`20260724000004` < `20260725000001`), so this plan's migrations need no renumbering and there is no collision. **But** a `supabase db reset` on the current branch produces a DB with **no `divisions` table and no `vendors.division_id` column**, which will break Command's Divisions settings tab and vendor registration's division picker locally. That is a **pre-existing baseline condition, not caused by this plan** — recorded here so it isn't misdiagnosed as a regression from B1/I7 during verification. `seed.sql` itself never references divisions (grepped), so seeding is unaffected.
2. **Branching and committing are the user's to manage — execution does none of it** (confirmed 2026-07-25). The backbone repo is already on `feature/vendor_transactions` and the parent repo is on `master`, but no git state may be changed during execution: no branch creation/switching, no merges, no commits. All work is left as uncommitted working-tree changes for the user to stage and branch as they see fit. (An earlier draft of this plan recommended cutting a matching parent-side branch — withdrawn at the user's direction.)

---

## Dependencies

**No new dependencies are required anywhere in this plan** — confirmed against the actual repo, not assumed:
- **I4 (print/PDF):** deliberately uses browser-native `window.print()` + `@media print`/Tailwind `print:` utilities instead of a PDF library (e.g. `jspdf`, `react-to-print`) — see I4's rationale. Zero repo precedent for a PDF library and no real benefit over the browser's own print-to-PDF here.
- **I2 (date-range filters):** plain `<input type="date">`, matching Command's existing `TransactionFilterPanel.tsx:31-32` — no date-picker library needed. `date-fns` is already listed in both `vendor/package.json` and `command/package.json` (`^3.6.0`) if any date formatting/math is needed beyond native `Date`/string comparison.
- **B1 (`gen_random_uuid()` in the new tables' PK defaults):** already used unguarded in existing migrations (e.g. `20260504000002_schema.sql:61`) with no explicit `create extension pgcrypto` — the extension is already enabled on the Supabase project. No new extension to enable.

If any implementation step later turns up a real need for a new package, that hits the AGENTS.md "Ask Before" dependency-approval gate and must be raised explicitly before installing — it is not pre-approved by this plan.

---

## Execution order

1. **Resolve the OPEN backfill decision (I5)** — nothing below can start cleanly until this is answered, since it changes the exact contents of the B1 migration.
2. **B1** — write and apply the two migrations (`platform_fee_settings`, `booking_transactions` + trigger). Independent of both apps' code; safe to do first and verify in isolation (insert a test payment transition locally, confirm a row appears).
3. **I7** (seed data) right after B1, before I2's UI work starts — I2 needs real paginated/filterable data to build and manually verify against, not just an empty table. Independent of I1.
4. **I1** (Command fee setting) and **I2** (Vendor transactions page) can proceed in parallel once B1 (and, for I2, I7) are applied — they only share the read-only `platform_fee_settings`/`booking_transactions` schema, no code coupling between the two apps.
5. **I3** (exclusion rule) and **I6** (date semantics) are implementation details inside I2 — not separate work, called out here only so they're not silently guessed wrong mid-build.
6. **I4** (print/PDF) once the table/filter UI in I2 is stable — the print stylesheet targets the final DOM structure.
7. **I8** (documentation) genuinely last — `architecture/{schema,portals}.md` should record what was built and verified, not what was planned.

## Verification

- **B1:** machine-verifiable — migration applies cleanly locally (`supabase db reset` or push), RLS policies confirmed via `select`/`update` as both a vendor-admin and a command-admin test session; trigger fires correctly verified by flipping a test booking's `is_paid` false→true and confirming exactly one `booking_transactions` row appears with correct fee math, and that replaying the same update (already-true→true, blocked by the webhook's own guard) does not double-insert (`on conflict do nothing` belt-and-suspenders).
- **I1:** machine-verifiable (type-check, save round-trip) — needs a live environment to confirm RLS actually blocks a non-admin from updating `platform_fee_settings` (test as a vendor-portal or booker-portal session).
- **I2:** needs a live environment — Playwright or manual browser check that search/filter/date-range narrows the table and summary cards correctly, and that the booker-contact RPC merge produces correct names (mirrors the existing `getBookings` verification path).
- **I3:** machine-verifiable via a unit-style check on the filter/exclusion logic (or manual: create a refunded/cancelled test booking, confirm it's listed but excluded from totals).
- **I4:** needs a live environment, and specifically **real-device** verification — mobile print-to-PDF is exactly the kind of thing that looks fine in a desktop Chrome print-preview and breaks on an actual phone; this cannot be fully machine-verified. Flag as a known gap in `portals.md`'s vendor roadmap the same way the PWA real-device gaps are already flagged there.
- **I7:** machine-verifiable — run `supabase db reset` locally and confirm via SQL: `select vendor_id, count(*) from booking_transactions group by vendor_id;` shows 32 for Citywide, 8 for Summit, 0 for Harbor; confirm the 3 refunded + 2 cancelled Citywide rows exist and are excluded from a manual payout-sum query; confirm `booking_transactions.created_at` values are actually spread (not clustered at one timestamp) via `select min(created_at), max(created_at) from booking_transactions;`. Also needs a live-environment check once I2 exists: load the vendor Transactions page as marco/jose/maria and visually confirm pagination and filters behave against this data.

---

## Documentation note (found during investigation, not fixed here)

`architecture/portals.md`'s vendor section lists a "Wallet Page (mock)" with Balance/Transactions tabs, Total Revenue/Total Payouts summary cards, and a `TXNS` constant. **This does not exist in the current vendor codebase** — no wallet folder, no `TXNS` reference, not in `Sidebar.tsx`'s nav, not in the `PageId` union. It appears to be stale documentation (possibly describing a removed or never-built feature). Not fixing it as part of this plan (unrelated to the ask), but flagging so it doesn't get treated as ground truth — and because this plan's new Transactions page is a better-fitting home for what that stale doc entry was describing anyway.
