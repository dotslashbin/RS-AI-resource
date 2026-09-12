# Payouts — details modal, Withholding Tax (saved at payment, configurable), corrections, Ezzy fee on Ready to pay

**Date:** 2026-09-11
**App / scope:** `command/`; **two migrations**, one SQL test and two hand-run rollback scripts in `backbone/supabase/`; docs in `architecture/`. **No vendor or booker code is touched by the plan itself**, but commission corrections are **visible to vendors** (see "Vendor impact"), and one unrelated vendor bug surfaced during staging testing and was fixed separately (see "AD-HOC", AH1).
**Status:** ✅ **COMPLETE (2026-09-12) — shipped to production.**

All eight build stages, all three migrations, and the full rollout are done. Every item is
✅ except **I11, deliberately ✖ ABORTED** (narrow-screen cosmetic defect on a desktop-only
portal — reasoning recorded under I11; the defect is still in the code by choice).

**How it was proven, in order:** local (three migrations; SQL 63/63, 45/45, 8/8; unit
79/79; 19 behavioural specs) → **staging, all nine U2 steps** including a real kiosk
payment and a live payout correction reaching the vendor apps → **production** (migrations
pushed, check script **16/16 PASS**, Command deployed, rate confirmed at 1% / 50%, and the
smoke check passed on a real payment). U0 ✅: the accountant confirmed 1% of 50% of the
post-commission payout, so the shipped defaults are the intended values.

Gates cleared: schema (B1, B4, B6), security (I2/I3 bank details, B6), vendor-visible data
change (B4/I8 — proven live, not only by test).

**Also fixed along the way:** **AH1**, an unrelated kiosk custody close-out bug this
plan's staging testing uncovered — every custody close-out had been broken since the kiosk
shipped. Fixed in `vendor/` and confirmed live. See "AD-HOC".

**Known and accepted:** existing paid payouts were backfilled with withholding that was
never deducted from a real transfer (D8, your call). The A6 rollback rehearsal was never
run — optional by design, and moot now the path is live.

> What this plan adds to the Payouts page:
> - a row-click details modal: the printed ledger's fields plus where the vendor is paid
> - a Withholding Tax **calculated and saved by the database at payment**, configured in
>   Command next to the commission
> - net "to transfer" figures everywhere staff read a transfer amount
> - a Command-only, reasoned, **logged correction** of a payout's saved commission and
>   withholding
> - a sortable Ezzy fee column on Ready to pay
>
> The theme to optimise: every money figure has one definition and one stored value.
> A stored value changes only through a correction that says who, when, why, and from
> what to what.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision, U# = a step **you**
> run, AH# = **ad-hoc** — found while testing this plan but outside its scope, and fixed
> in another repo. Numbers are plan-local. "payouts-redesign X" means item X of
> `.plans/2026-09-10-command-payouts-redesign.md`.

> **Revision history (all 2026-09-11).**
> 1. Draft: withholding computed in Command at read time.
> 2. D6 revised: withholding saved by the DB at payment; D9 made the rate configurable.
> 3. This revision:
>    - payment-path safeguards (B5): shared SQL functions, `plpgsql_check`, rollback
>      scripts, parity check, production smoke check
>    - a confirmation on the withholding settings save (I5)
>    - payout corrections (B4, I8; D14–D16)
>    - the vendor-impact answer
>
> 4. The order-of-execution checklist below was added for the user's reference.
>
> Earlier decisions are kept below with their history.

---

## ▶ ORDER OF EXECUTION — the one sequence to follow

**This is the single source of truth for order.** Each step says who does it and links to
the detail.

**Legend:** 🤖 = I do it · 👤 = you do it · ⛔ = **stop point**: do not go further
until it holds.

### The four rules that prevent a mess
1. **Every environment gets the migrations before it gets the new Command code.** A
   Command build containing stage 3 or later must never run against a database that
   lacks **both** `20260911000001` and `20260911000002`. If it does, Payouts and Settings
   fail to load.
2. **Keep the Command work on `feature/taxes_and_modal_payouts`.** Do not merge it into
   the branch Vercel builds **production** from until step C6.
3. **Local → staging → production. Never skip one.**
4. **Hosted databases only get `db push`.** Never `db reset` on staging or production
   (`architecture/database-reset-and-deploy.md:14-25`).

### Phase A — Build and prove it locally
| # | Who | Step | Detail |
|---|---|---|---|
| A1 | 🤖 | **Stage 1:** Ezzy fee column. Needs no migration and is safe in any environment. ✅ *Done 2026-09-11: 12/12 tests passed, alignment checked at 900px and 760px* | I1 |
| A2 | 🤖 | **Stage 2:** write both migration files, the SQL test and the rollback scripts in `backbone/`. **Nothing is applied.** ⛔ I stop and hand over. ✅ *Written 2026-09-11: 2 migrations, 1 test, 3 rollback files. Plus, after A3 run 1 found B6: migration `000003` and its rollback file, and the test extended* | B1, B4, B5, B6 |
| A3 | 👤 | **Apply locally:** `npx supabase migration up --local`, then run the three SQL tests. ⛔ **All three pass** → tell me. ✅ *Run 1 (2026-09-11): `000001`+`000002` applied; existing tests 45/45 and 8/8; new test **47/49**, because service_role could UPDATE/DELETE the correction log (B6). Fix `000003` written. **Run 2 (2026-09-11): all three applied; 63/63, 45/45, 8/8, all exit 0*** | U1 |
| A4 | 🤖 | Read-only checks against your local DB (U2 step 4's queries). ✅ *2026-09-11: 46 rows, 0 nulls, 0 mismatches; settings 12/1/50; service_role = INSERT,SELECT on all four logs* | U1 step 3 |
| A5 | 🤖 | **Stages 3 → 8**, one at a time. I report after each, and each next stage waits for your go: 3 net figures + print · 4 settings card · 5 bank-details extract · 6 details modal · 7 corrections · 8 docs. 🔄 *Stage 3 done 2026-09-11 (13/13 Playwright, 79/79 unit, landscape PDF checked). Stage 4 done 2026-09-11 (16/16 Playwright; card checked light, dark and 400px, plus the confirmation). Stage 5 done 2026-09-11 (hook moved verbatim, proved by diff; 16/16). Stage 6 done 2026-09-11 (22/22; focus-restore bug found and fixed). Stage 7 done 2026-09-11 (24/24; stale-closure history bug found and fixed by moving ownership). ✅ *Stage 8 (docs) done 2026-09-12 — schema.md, portals.md, the deploy doc and an AGENTS.md invariant* | "Stage detail" below |
| A6 | 👤 | *(Recommended)* Rehearse the emergency rollback locally. Run rollback **Section A**, confirm flipping a booking to paid still works, then `npx supabase db reset` to return local to the migrated state (**local only**) | B5 |
| A7 | 👤 | Commit and push the `backbone` migration files. A `git push` does **not** apply them. ⚠️ Unless Supabase's GitHub integration is connected to this repo in the dashboard; check that first | — |

### Phase B — Staging (production is untouched throughout)
| # | Who | Step | Detail |
|---|---|---|---|
| B1 | 👤 | `npx supabase migration list --linked`. It shows the migrations waiting to be applied: `20260911000001`, `20260911000002`, `20260911000003`, and `20260910000001` if not yet pushed. **All go in one push**, so no hosted database ever has the B6 gap on the new log | U2.1 |
| B2 | 👤 | *(Optional)* Record `count(*)` and `sum(payout_amount)` for comparison | U2.2 |
| B3 | 👤 | `npx supabase db push`. The CLI is linked to **staging** | U2.3 |
| B4 | 👤 | Run the verification queries. ⛔ **Every result matches** | U2.4 |
| B5 | 👤 | Deploy the Command feature branch to **staging only** | U2.5 |
| B6 | 👤 | A real test payment: its row carries withholding, and booker's logs show no `is_paid write FAILED`. ⛔ **Payment confirmed** | U2.6 |
| B7 | 👤 | Change the rate (the confirmation appears); correct one payout; check the log row and that the vendor apps show the change; put the rate back | U2.7–9 |

⛔ **Staging fully green before anything touches production.**

### Phase C — Production
| # | Who | Step | Detail |
|---|---|---|---|
| C1 | 👤 | Accountant confirms **1% of 50% of the vendor payout after commission**. ⛔ | U0 |
| C2 | 👤 | **Parity check:** production's applied migrations must equal staging's, apart from the two new ones. ⛔ **If they differ, bring production level first** | U3.1 |
| C3 | 👤 | Open `backbone/supabase/rollback/` (the file you'd need first is `20260911000001_withholding_tax.A-emergency.sql`) and **note the time** you push | U3.2 |
| C4 | 👤 | `db push` to production, at a quiet time | U3.3 |
| C5 | 👤 | Run the verification queries on production. ⛔ **Every result matches** | U3.4 |
| C6 | 👤 | **Only now** merge the Command branch into the production branch or deploy it | U3.5 |
| C7 | 👤 | Settings → Platform Fee: confirm or set the real rates **before the next payment** | U3.6 |
| C8 | 👤 | Smoke check: watch booker's logs, and check the first payment's row has withholding | U3.7 |

**If any payment fails after C4:** run `rollback/20260911000001_withholding_tax.A-emergency.sql` ("Section A") immediately. Restoring
the function alone is not enough; Section A also sets the defaults. Then fix the rows it
lists using the correction tool, and tell me.

### Safe and unsafe states: where you can pause, and what breaks
| State | Safe to pause here? | Why |
|---|---|---|
| Migrations applied, Command **not yet** deployed | ✅ **Yes** | Old Command ignores the new columns. Payments quietly start saving withholding; nothing on screen changes |
| Stage 1 deployed alone | ✅ Yes | The Ezzy fee column reads a column that already exists |
| Command (stage 3+) deployed, migrations **missing** | ❌ **No** | Payouts and Settings fail to load. No data is harmed; fix by pushing the migrations or rolling back the deploy |
| Production pushed before staging was proven | ❌ No | A payment-path bug would reach real customers first |
| Rollback function restored **without** Section A's defaults | ❌ No | Every payment still fails: the old insert doesn't fill the new required columns |
| `db reset` on staging or production | ❌ Never | Wipes the hosted data |

---

## Scope

**In scope**

*Database (B1, B4)*
- Two pure SQL functions that define the money maths once.
- Withholding **rate %** and **base %** settings (default 1% / 50%).
- Snapshot columns, a backfill and a generated net column on `booking_transactions`.
- `create_booking_transaction()` snapshots withholding.
- Bucket totals gain withholding and net.
- An append-only correction log plus preview and correct RPCs.

*Command app*
- A withholding settings card with a confirmation on save.
- The Payouts page reads stored values: net "to transfer" everywhere, withholding and
  net in the modal and on print.
- The details modal with masked bank details and reveal, and a correction form inside it.
- The Ezzy fee column.
- Tests and docs.

*Safeguards (B5)*
- Static check of the payment function.
- Rollback scripts.
- Rollout checks for local, staging and production.

**Out of scope**
- Any code in `booker`, `vendor`, `ezzy-booker-mobile`, `ezzy-vendor-mobile`.
- Moving money. There is no payout rail. Staff transfer by hand, and the platform
  records the figures. A correction changes a **record**, never money already sent.
- `/api/vendor-payout` and its audit behaviour: reused unmodified.
- Bulk corrections (D16: one row at a time).
- Telling vendors a correction happened (DEFERRED; cross-app).

> ⚠️ **Approving this plan approves four gated things:**
> - schema changes (B1, B4)
> - decrypted bank details in a second place (I2/I3)
> - a change to the documented rule that the payment ledger never changes (D14)
> - figures vendors can see changing after the fact (B4, "Vendor impact")

---

## Vendor impact (the answer to "will this involve the vendor app?")

**No vendor code changes.** Both vendor apps select payment columns by explicit name
(`vendor/services/transactions.service.ts:46-48, 205, 273`;
`ezzy-vendor-mobile/src/services/transactions.service.ts:58-61, 187`;
`dashboard.service.ts:104`).

**What vendors see:**

| Change | Visible to vendors? |
|---|---|
| New withholding columns | **No.** Neither app selects them, so vendors never see withholding |
| Withholding corrections | **No.** Same reason |
| **Commission corrections** | **Yes.** They change `platform_fee_percent`, `platform_fee_amount` and `payout_amount`, which vendors see: vendor web `TransactionRow.tsx:44-54` (fee, fee %, payout) and its printed statement `TransactionPrintView.tsx:119-120`; vendor mobile `TransactionListItem.tsx:49-77` (payout, "Fee (x%)") and the dashboard totals |

**When vendors see a commission correction:**
- Web: on the next page load.
- Mobile: within 30 seconds of the app coming to the foreground online (`queryClient.ts:26-31`).
- Mobile opened **offline**: up to a day of old figures, because the first page of
  transactions and the dashboard stats are kept on the device for a day
  (`queryClient.ts:15, 58-60`).

**Nothing tells the vendor.** A past payout's fee and amount change with no notice, and
a statement they printed earlier will no longer match. That is recorded as a follow-up
(DEFERRED), not solved here, because solving it is vendor-app work.

---

## What the code does today (verified by reading)

| Fact | Evidence |
|---|---|
| The commission is snapshotted at payment by `create_booking_transaction()`, which is **defined once, never redefined**, and is **the only insert** into `booking_transactions` | `20260725000002_booking_transactions.sql:104-148`; grep of all migrations |
| **The webhook is the only writer of `is_paid = true`, and it answers `200` even when that write fails, so PayMongo does not retry.** A failure in the payment trigger = a charged customer, an unpaid booking, and one line in the booker log | `booker/app/api/payment/webhook/route.ts:100-130`; grep across all apps and migrations |
| `plpgsql` validates column names at **run time**, not at `create function`. `plpgsql_check` is available locally but not installed | `pg_available_extensions` on local DB, 2026-09-11 |
| Seed and demo data reach `booking_transactions` only through the trigger | `seed.sql:850`, `demo/demo-seed.sql:317` |
| `platform_fee_settings` is a singleton: authenticated read, Command admin/root update, table-level grants. No other app reads it | `20260725000001_platform_fee_settings.sql:30-94`; grep |
| Command's staff-only write RPCs check the caller, and overrides require a ≥10-character reason | `20260801000008_payout_release_and_override.sql:19-49, 67-90` |
| Append-only logs grant `select` to authenticated and `select, insert` to service_role, with no update/delete for anyone | `schema.md` → `vendor_payout_method_log` |
| Backfill inside a migration has precedent; only `migration up` against real rows exercises one | `20260801000003:42-57`; `database-reset-and-deploy.md:219-246` |
| Hand-run SQL lives outside `migrations/` (`bootstrap/`, `demo/`) | `database-reset-and-deploy.md:149-152` |
| The CLI in `backbone/` is linked to **staging**; production only ever receives `db push` | `database-reset-and-deploy.md:14-25`; project memory |
| Local DB: 46 ledger rows (3 released), fee 12%, `20260910000001` applied | read-only `psql`, 2026-09-11 |
| DB tests are psql scripts in a rolled-back transaction | `backbone/supabase/tests/auto_acknowledge_test.sql:1-15` |
| Three payout figures say "transfer" and all sum the full vendor payout | `PayoutSelectionBar.tsx:21` ← `PayoutsPage.tsx:61`; `PayoutVendorGroup.tsx:30, 49, 52`; `PayoutPrintView.tsx:132, 139` |
| The Settings → Platform Fee note promises vendors' "existing payout history never changes" | `PlatformFeeSettingsPage.tsx:93-97` |
| The generalised confirm dialog, used for activation too | `components/ui/DeleteConfirmModal/DeleteConfirmModal.tsx:12-24` |
| The audit table has a sortable Ezzy fee column; Ready to pay does not | `PayoutTable.tsx:41, 58` vs `PayoutRow.tsx:37-41`, `PayoutGroupColumns.tsx:34-38` |
| Decrypted bank details: one caller-gated, audited, fail-closed source | `app/api/vendor-payout/route.ts:1-25, 110-122` |
| The masked destination is readable without decrypting | `vendors.service.ts:70-85, 149-152`; `lib/types.ts:45-50` |

---

## BLOCKERS

### B1 — Migration 1: withholding, configurable, snapshotted at payment  ✅ DONE locally (2026-09-11) — applied; SQL test 63/63. Staging and production: U2/U3 · **APPROVAL GATE**
**File:** new `backbone/supabase/migrations/20260911000001_withholding_tax.sql`. Written
after approval; **applied by you** (U1–U3).

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Withholding tax — configurable in Command, snapshotted at payment
--
-- Ezzy withholds tax from what it transfers to a vendor: RATE % of BASE % of the
-- vendor payout (default 1 % of 50 %). Like the platform fee, the rule is set in
-- Command (platform_fee_settings) and SNAPSHOTTED onto booking_transactions when a
-- booking is paid. Records a deduction; moves no money — there is no payout rail.
--
-- The money maths lives in two IMMUTABLE functions used by EVERY path that computes
-- it — this trigger, this backfill, and the correction RPCs (20260911000002) — so
-- the formula exists once and can be checked with a plain SELECT anywhere.
--
-- Defaults are 1.00 / 50.00, NOT 0 — a deliberate departure from fee_percent's
-- default-0 rule (20260725000001): this is a tax obligation the business has set,
-- and a zero default would make every "to transfer" figure overstate the transfer.
--
-- Must run after: 20260725000002, 20260910000001
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. The money maths, defined once ─────────────────────────────────────────
create function public.platform_fee_amount(p_amount_paid numeric, p_fee_percent numeric)
returns numeric language sql immutable parallel safe set search_path = ''
as $$ select round(p_amount_paid * p_fee_percent / 100, 2) $$;

create function public.withholding_amount(p_payout numeric, p_rate_percent numeric, p_base_percent numeric)
returns numeric language sql immutable parallel safe set search_path = ''
as $$ select round(p_payout * p_rate_percent / 100 * p_base_percent / 100, 2) $$;

comment on function public.platform_fee_amount(numeric, numeric) is
  'The platform fee on a payment, rounded to the centavo. The ONLY definition — used by create_booking_transaction() and the correction RPCs.';
comment on function public.withholding_amount(numeric, numeric, numeric) is
  'Withholding on a vendor payout: payout x rate% x base%, rounded to the centavo. The ONLY definition — used by create_booking_transaction(), the backfill and the correction RPCs.';

revoke execute on function public.platform_fee_amount(numeric, numeric)         from public, anon;
revoke execute on function public.withholding_amount(numeric, numeric, numeric) from public, anon;
grant  execute on function public.platform_fee_amount(numeric, numeric)         to authenticated, service_role;
grant  execute on function public.withholding_amount(numeric, numeric, numeric) to authenticated, service_role;

-- ── 1. Settings: two columns on the existing singleton row ───────────────────
-- Existing RLS and table-level grants (20260725000001) already cover new columns.
alter table public.platform_fee_settings
  add column withholding_rate_percent numeric(5,2) not null default 1.00
    check (withholding_rate_percent >= 0 and withholding_rate_percent <= 100),
  add column withholding_base_percent numeric(5,2) not null default 50.00
    check (withholding_base_percent >= 0 and withholding_base_percent <= 100);

comment on column public.platform_fee_settings.withholding_rate_percent is
  'Withholding tax rate (0-100). Snapshotted onto booking_transactions at payment.';
comment on column public.platform_fee_settings.withholding_base_percent is
  'Portion of the vendor payout the rate applies to (0-100; 50 = "half"). Snapshotted with the rate.';
comment on table public.platform_fee_settings is
  'Single-row money policy managed by Command admins: the platform commission and the withholding-tax rule. Both are snapshotted onto booking_transactions at payment time.';

-- ── 2. Ledger columns, nullable until backfilled ─────────────────────────────
alter table public.booking_transactions
  add column withholding_rate_percent numeric(5,2),
  add column withholding_base_percent numeric(5,2),
  add column withholding_amount       numeric(10,2);

-- ── 3. Backfill (paid-out rows included — plan D8) ───────────────────────────
update public.booking_transactions bt
   set withholding_rate_percent = s.withholding_rate_percent,
       withholding_base_percent = s.withholding_base_percent,
       withholding_amount       = public.withholding_amount(bt.payout_amount,
                                    s.withholding_rate_percent, s.withholding_base_percent)
  from public.platform_fee_settings s
 where s.id = 1;

alter table public.booking_transactions
  alter column withholding_rate_percent set not null,
  alter column withholding_base_percent set not null,
  alter column withholding_amount       set not null;

-- Cannot fail on this data: rate and base are <= 100 %, so the rounded amount can
-- never exceed the payout it was taken from.
alter table public.booking_transactions
  add constraint booking_transactions_withholding_within_payout
    check (withholding_amount >= 0 and withholding_amount <= payout_amount);

-- What staff transfer. GENERATED: cannot drift from its inputs.
alter table public.booking_transactions
  add column net_payout_amount numeric(10,2)
    generated always as (payout_amount - withholding_amount) stored;

comment on column public.booking_transactions.withholding_amount is
  'withholding_amount(payout_amount, rate, base), fixed at payment; changed afterwards only by correct_booking_transaction(). A record — the platform transfers nothing.';
comment on column public.booking_transactions.net_payout_amount is
  'payout_amount - withholding_amount: what staff transfer to the vendor. Generated.';

-- ── 4. Snapshot at payment ───────────────────────────────────────────────────
-- 20260725000002's body (never redefined since), with both amounts now computed by
-- the shared functions and the withholding rule read from the SAME settings row.
create or replace function public.create_booking_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee_percent numeric(5,2);
  v_wh_rate     numeric(5,2);
  v_wh_base     numeric(5,2);
  v_fee_amount  numeric(10,2);
  v_payout      numeric(10,2);
begin
  select fee_percent, withholding_rate_percent, withholding_base_percent
    into v_fee_percent, v_wh_rate, v_wh_base
  from   public.platform_fee_settings
  where  id = 1;

  -- Defensive, as for the fee: a missing value must never abort a confirmed payment.
  v_fee_percent := coalesce(v_fee_percent, 0);
  v_wh_rate     := coalesce(v_wh_rate, 0);
  v_wh_base     := coalesce(v_wh_base, 0);

  -- Computed once so platform_fee_amount + payout_amount always equals amount_paid.
  v_fee_amount := public.platform_fee_amount(new.price_paid, v_fee_percent);
  v_payout     := new.price_paid - v_fee_amount;

  insert into public.booking_transactions (
    booking_id, vendor_id, amount_paid,
    platform_fee_percent, platform_fee_amount, payout_amount,
    withholding_rate_percent, withholding_base_percent, withholding_amount
  ) values (
    new.id, new.vendor_id, new.price_paid,
    v_fee_percent, v_fee_amount, v_payout,
    v_wh_rate, v_wh_base, public.withholding_amount(v_payout, v_wh_rate, v_wh_base)
  )
  on conflict (booking_id) do nothing;  -- belt-and-braces beside the webhook's own false->true guard

  return new;
end;
$$;

comment on function public.create_booking_transaction() is
  'Snapshots the platform fee AND the withholding-tax rule onto a new booking_transactions row when a booking is first paid. Fires only on is_paid false -> true. ⚠️ Runs inside the payment webhook''s UPDATE and the webhook does not retry on failure — see plan 2026-09-11 B5 before editing.';

-- ── 5. Bucket totals gain withholding and net ────────────────────────────────
-- Return type changes; CREATE OR REPLACE cannot do that — drop, recreate, re-grant.
drop function public.command_payout_bucket_totals();

create function public.command_payout_bucket_totals()
returns table (bucket text, payout_count bigint, payout_total numeric,
               withholding_total numeric, net_total numeric)
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
      end                  as b_key,
      t.payout_amount      as amt,
      t.withholding_amount as wh,
      t.net_payout_amount  as net
    from public.booking_transactions t
    join public.bookings b on b.id = t.booking_id
  )
  select c.b_key, count(*)::bigint,
         coalesce(sum(c.amt), 0)::numeric,
         coalesce(sum(c.wh),  0)::numeric,
         coalesce(sum(c.net), 0)::numeric
  from classified c
  group by c.b_key;
end;
$$;

comment on function public.command_payout_bucket_totals() is
  'Command-only. Exact count, payout, withholding and net sums per bucket (held / releasable / released / reversed / owed_back). Read-only. Buckets are disjoint: a released payout on a refunded or cancelled booking counts ONLY as owed_back.';

revoke execute on function public.command_payout_bucket_totals() from public, anon;
grant  execute on function public.command_payout_bucket_totals() to authenticated, service_role;
```

**Blast radius**

- **Data.** Every ledger row gains three written values and one generated value. None
  can fail: new columns, a `NOT NULL` source, and a CHECK satisfied by construction.
  The settings row gains 1.00/50.00.
- **Lock / performance.**
  - Metadata-only column adds, row locks for the backfill.
  - `SET NOT NULL` scan and the `STORED` generated column's **table rewrite** both run
    under `ACCESS EXCLUSIVE`. That is milliseconds at current volume.
  - A webhook arriving mid-migration **waits**; it does not fail.
  - One transaction, so the function and the columns never disagree.
- **Payment path.** See **B5**. It is the reason B5 exists.
- **Downstream.**
  - Command types: `PayoutRow`, `BucketTotal`, `PlatformFeeSettings`.
  - **Old Command code works on the new schema; new Command code fails on the old one**,
    hence the deploy order.
  - Vendor apps are unaffected.
  - Seeds go through the trigger.
- **Reversibility.** `rollback/20260911000001_withholding_tax.rollback.sql` (B5).

### B2 — Every "transfer" figure is net of withholding  ✅ DONE (2026-09-12) — built and machine-verified; the list-header label checked and confirmed on the real Payouts page (you, 2026-09-12)
**Files:** `services/payouts.service.ts:195-250`; `PayoutsPage.tsx:51-62, 139-151`;
`PayoutVendorGroup.tsx:30, 49-52` + `.module.css`; `PayoutBucketCards.tsx:6-13, 44-46` +
`.module.css`; new `lib/payout/transfer.ts` + `transfer.test.ts`.

**The rule:**
- *transfer* = Σ stored `net_payout_amount`
- *vendor payout* = Σ `payout_amount`
- no money total on the release surface is unlabelled

`transferTotal(rows: { netPayout: number | null }[])` sums in integer centavos with nulls
skipped. It is the only client-side transfer sum. **Command's payout code contains no
money formula at all**; it only adds up stored values.

| Where | Change |
|---|---|
| Selection bar "₱X to transfer" | `PayoutsPage.tsx:61` → `transferTotal(selectedRows)` |
| Vendor group header | `transferTotal(rows)` "to transfer"; meta `2 payouts · ₱3,168.00 less ₱15.84 withholding` |
| Print subtotal "one transfer" | Net column sum (B3) |
| List head | `Σ payoutAmount` "vendor payout" (matches the card); Ready to pay adds `· ₱Y to transfer` |
| Bucket cards | `BucketTotal` gains `withholding`/`net`; the money line is labelled "vendor payout"; Ready to pay gets `₱X to transfer` from `net_total` |

> **Under-specification guard.** Every "transfer" string under `components/payouts` must
> sit beside `transferTotal(` or `net_total`. Spec #9 asserts header, bar and print agree.

### B3 — Modal and print render one field list; print gains withholding and net  ✅ DONE (2026-09-11) — print half done and checked in a landscape A4 PDF; the modal half consumes it in stage 6
**Files:** new `lib/payout/details.ts`; `PayoutPrintView.tsx:40-42, 92-158` + `.module.css`.

`payoutDetailFields(row, bucket)` returns the ordered list:

> Vendor · Booking · Service date · Paid | Released · Customer paid · Ezzy fee ·
> Vendor payout · Withholding tax · Net payout

It owns the Paid/Released rule, all formatting, and "—" on Reversed (D5).
`payoutDetailLabels(bucket)` supplies the print header.

**Print sheet:**
- `PrintRow` maps over the list.
- Subtotal `colSpan = labels.length − 1`, with `transferTotal(list)` in the last cell.
  **Net payout stays last.**
- The grand total sums the stored per-row values shown.
- 9 columns on A4 portrait. If a money cell wraps in print preview, use
  `@page { size: A4 landscape }`. Payouts is Command's only print surface.

> **Under-specification guard.** Neither the modal nor `PrintRow` formats a payout field
> itself. Spec #2 asserts they agree.

### Stage 3 execution note (2026-09-11) — I4 (service part), B2, B3

**Files (command repo, branch `feature/taxes_and_modal_payouts`, uncommitted):**
- `services/payouts.service.ts`:
  - `SELECT` adds the four stored withholding/net columns
  - `PayoutRow` gains `withholdingRatePercent`, `withholdingBasePercent`, and `withholdingTax` / `netPayout` (the last two `null` on Reversed)
  - `BucketTotal` gains `withholding` / `net` from the RPC
- new `lib/payout/transfer.ts`: `sumPesos`, `transferTotal`, `withholdingTotal`, all summing
  stored values in centavos. **Command contains no withholding formula.**
- new `lib/payout/transfer.test.ts`: 5 cases.
- new `lib/payout/details.ts`: `payoutDetailColumns` / `payoutDetailFields`, the one field list.
- `PayoutsPage.tsx`:
  - the selection bar is fed by `transferTotal`
  - the list header is labelled "vendor payout", plus "to transfer" on Ready to pay
  - the Ready to pay card gets `transfer` from the RPC's `net`
- `PayoutVendorGroup.tsx` / `.module.css`: the big number is `transferTotal`, labelled "to
  transfer", with a meta line of "N payouts · ₱payout less ₱withholding".
- `PayoutBucketCards.tsx` / `.module.css`: the money line is labelled "vendor payout", with an
  optional "₱X to transfer" line.
- `PayoutPrintView.tsx`: rendered from the field list, with Withholding and Net columns,
  subtotals from `transferTotal`, and every money column totalled. It shows "—" where
  nothing applies.
- `PayoutPrintView.module.css`: **`@page { size: A4 landscape }`** (see below).
- `app/ui-gallery/page.tsx`: the rows carry stored-shape withholding and net, the card
  carries `transfer`, and a `PayoutSelectionBar` is fed by `transferTotal`.
- `visual-tests/payouts.spec.ts`: new "every 'transfer' figure is net of withholding, and
  they all agree". It covers the group header and its arithmetic, the selection bar, the
  card, and the print row / subtotal / grand total.

**Deviations from the plan text:**
1. **The print is landscape.** B3 said "portrait first, landscape if it does not fit".
   It did not fit: printed to an A4 PDF, the Net payout column ran past the content edge
   into the margin, and dates broke across three lines. With landscape, all nine columns
   sit on one line inside the content edge.
2. **The service fields are split.** Stage 3 added only the withholding fields.
   `vendorId`, `platformFeePercent` and `payoutMethod` land in stage 6 with the modal
   that needs them, so no field is fetched before something uses it.
3. **The group meta line** changed from "N payouts · one transfer" to "N payouts ·
   ₱payout less ₱withholding". The "to transfer" label on the big number carries the
   meaning, and the printed subtotal still says "one transfer".

**Machine-verified:**
- `npx tsc --noEmit` exit 0.
- `npm run lint`: 25 problems, **none in a touched file**.
- `npm test`: **79/79**, including the 5 new cases.
- `npm run build` exit 0, so `@page` is accepted inside the CSS module.
- `npx playwright test`: **13 passed**, exit 0. The log is kept in
  `command/node_modules/.cache/claude-stage3/pw.log`.
- Grep:
  - every user-visible "to transfer" / "one transfer" is fed by `transferTotal(` or the RPC's `net`
  - no withholding arithmetic in `components/payouts`, `services` or `lib/payout`; the pattern's only hits are doc comments
  - no `style={{`

**Browser-verified:**
- Screenshots at 900px and 760px: the card lines, the group headers
  (₱3,940.20 / ₱3,152.16 to transfer, with their "less withholding" lines), and rows that
  add up.
- A landscape A4 PDF via `page.pdf({ preferCSSPageSize: true })`, i.e. what a browser
  print does: every figure is correct, and the grand total's net is ₱7,092.36 = the sum
  of the net column.

**Outstanding (needs a live, signed-in page):**
- The **list-header label** ("N payouts · ₱X vendor payout · ₱Y to transfer") sits on
  `PayoutsPage`, which the gallery cannot mount (it fetches its own data). It is
  type-checked and builds, but has not been seen rendered. Check it in U2 step 5, or on
  a local signed-in run, before B2 is ✅.

**Lesson recorded:** Playwright empties `test-results/` when a run starts. This stage's
first build and Playwright logs were written there and lost, although both exit codes
(0) survived. Logs now go to `node_modules/.cache/`, and the memory note is updated.

### B4 — Migration 2: payout corrections (reasoned, logged, Command-only)  ✅ DONE locally (2026-09-11) — applied; correction cases in the SQL test pass. Staging and production: U2/U3 · **APPROVAL GATE**
**File:** new `backbone/supabase/migrations/20260911000002_payout_corrections.sql`.

It is separate from B1 so it can be reviewed, and if necessary rolled back, on its own.
**Architecture change (D14):** `booking_transactions` stops being a strictly immutable
ledger. Its money figures can change after payment, but **only** through this RPC, which
requires a reason and logs old and new values **in the same transaction**. No
authenticated write grant is added.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Payout corrections — Command-only, reasoned, logged
--
-- Staff can fix a payout whose saved commission or withholding rule was entered
-- wrongly. Inputs are RATES; every amount is recomputed by platform_fee_amount()
-- and withholding_amount() (20260911000001), so a corrected row still obeys the
-- same rules as one written at payment. Any bucket may be corrected, paid ones
-- included — the log records the payout_status at the time.
--
-- ⚠️ A correction changes a RECORD, not money. Correcting a paid payout does not
--    claw back or top up anything; a wrong transfer is settled by a separate one.
-- ⚠️ Vendor-visible: commission corrections change platform_fee_percent /
--    platform_fee_amount / payout_amount, which vendor web and mobile display.
--    Withholding is not selected by either vendor app.
--
-- Must run after: 20260911000001
-- ─────────────────────────────────────────────────────────────────────────────

create table public.booking_transaction_corrections (
  id                            uuid          primary key default gen_random_uuid(),
  transaction_id                uuid          not null references public.booking_transactions(id) on delete cascade,
  corrected_by                  uuid          references public.profiles(id) on delete set null,
  corrected_at                  timestamptz   not null default now(),
  reason                        text          not null check (char_length(trim(reason)) >= 10),
  payout_status                 text          not null,  -- as it stood when corrected: was it already paid?
  from_fee_percent              numeric(5,2)  not null,
  to_fee_percent                numeric(5,2)  not null,
  from_fee_amount               numeric(10,2) not null,
  to_fee_amount                 numeric(10,2) not null,
  from_payout_amount            numeric(10,2) not null,
  to_payout_amount              numeric(10,2) not null,
  from_withholding_rate_percent numeric(5,2)  not null,
  to_withholding_rate_percent   numeric(5,2)  not null,
  from_withholding_base_percent numeric(5,2)  not null,
  to_withholding_base_percent   numeric(5,2)  not null,
  from_withholding_amount       numeric(10,2) not null,
  to_withholding_amount         numeric(10,2) not null
);

comment on table public.booking_transaction_corrections is
  'Append-only record of every change to a booking_transactions money figure after payment: who, when, why, the payout status at the time, and old -> new values. Written only by correct_booking_transaction().';

create index booking_transaction_corrections_txn_idx
  on public.booking_transaction_corrections (transaction_id, corrected_at desc);

alter table public.booking_transaction_corrections enable row level security;

create policy "command admins read booking_transaction_corrections"
  on public.booking_transaction_corrections for select
  to authenticated
  using (public.is_portal_member('command')
         and (public.has_role('admin') or public.has_role('root')));

-- Append-only, as vendor_payout_method_log: no UPDATE/DELETE for anyone (D15).
grant select         on public.booking_transaction_corrections to authenticated;
grant select, insert on public.booking_transaction_corrections to service_role;

comment on table public.booking_transactions is
  'Per-payment ledger. One row per booking, written by the bookings_create_transaction trigger when a booking is first paid; commission and withholding are snapshotted at that moment. Money figures change afterwards ONLY via correct_booking_transaction(), which requires a reason and logs old and new values to booking_transaction_corrections.';

-- ── Preview: what a correction WOULD save. Read-only, same maths. ───────────
create function public.preview_booking_transaction_correction(
  p_transaction_id uuid, p_fee_percent numeric,
  p_withholding_rate_percent numeric, p_withholding_base_percent numeric)
returns table (fee_amount numeric, payout_amount numeric,
               withholding_amount numeric, net_payout_amount numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_amount numeric(10,2);
  v_fee    numeric(10,2);
  v_payout numeric(10,2);
  v_wh     numeric(10,2);
begin
  if not (public.is_portal_member('command')
          and (public.has_role('admin') or public.has_role('root'))) then
    raise exception 'Only Ezzy staff can correct payouts';
  end if;
  if p_fee_percent not between 0 and 100
     or p_withholding_rate_percent not between 0 and 100
     or p_withholding_base_percent not between 0 and 100 then
    raise exception 'Each percentage must be between 0 and 100';
  end if;

  select t.amount_paid into v_amount from public.booking_transactions t where t.id = p_transaction_id;
  if not found then raise exception 'Payout not found'; end if;

  v_fee    := public.platform_fee_amount(v_amount, round(p_fee_percent, 2));
  v_payout := v_amount - v_fee;
  v_wh     := public.withholding_amount(v_payout, round(p_withholding_rate_percent, 2),
                                                  round(p_withholding_base_percent, 2));
  return query select v_fee, v_payout, v_wh, v_payout - v_wh;
end;
$$;

-- ── Correct: recompute, log, update — one transaction. ───────────────────────
create function public.correct_booking_transaction(
  p_transaction_id uuid, p_fee_percent numeric,
  p_withholding_rate_percent numeric, p_withholding_base_percent numeric,
  p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r        public.booking_transactions%rowtype;
  v_fee_pc numeric(5,2) := round(p_fee_percent, 2);
  v_rate   numeric(5,2) := round(p_withholding_rate_percent, 2);
  v_base   numeric(5,2) := round(p_withholding_base_percent, 2);
  v_fee    numeric(10,2);
  v_payout numeric(10,2);
  v_wh     numeric(10,2);
begin
  if not (public.is_portal_member('command')
          and (public.has_role('admin') or public.has_role('root'))) then
    raise exception 'Only Ezzy staff can correct payouts';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'A correction needs a reason of at least 10 characters';
  end if;
  if v_fee_pc not between 0 and 100 or v_rate not between 0 and 100 or v_base not between 0 and 100 then
    raise exception 'Each percentage must be between 0 and 100';
  end if;

  -- Row lock: a concurrent release waits rather than interleaving with the log write.
  select * into r from public.booking_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Payout not found'; end if;

  if (v_fee_pc, v_rate, v_base)
     = (r.platform_fee_percent, r.withholding_rate_percent, r.withholding_base_percent) then
    raise exception 'Nothing to correct — these are the saved values';
  end if;

  v_fee    := public.platform_fee_amount(r.amount_paid, v_fee_pc);
  v_payout := r.amount_paid - v_fee;
  v_wh     := public.withholding_amount(v_payout, v_rate, v_base);

  insert into public.booking_transaction_corrections (
    transaction_id, corrected_by, reason, payout_status,
    from_fee_percent, to_fee_percent, from_fee_amount, to_fee_amount,
    from_payout_amount, to_payout_amount,
    from_withholding_rate_percent, to_withholding_rate_percent,
    from_withholding_base_percent, to_withholding_base_percent,
    from_withholding_amount, to_withholding_amount
  ) values (
    r.id, auth.uid(), trim(p_reason), r.payout_status,
    r.platform_fee_percent, v_fee_pc, r.platform_fee_amount, v_fee,
    r.payout_amount, v_payout,
    r.withholding_rate_percent, v_rate,
    r.withholding_base_percent, v_base,
    r.withholding_amount, v_wh
  );

  update public.booking_transactions
     set platform_fee_percent     = v_fee_pc,
         platform_fee_amount      = v_fee,
         payout_amount            = v_payout,
         withholding_rate_percent = v_rate,
         withholding_base_percent = v_base,
         withholding_amount       = v_wh
   where id = r.id;
end;
$$;

comment on function public.preview_booking_transaction_correction(uuid, numeric, numeric, numeric) is
  'Command-only, read-only. The figures correct_booking_transaction() WOULD save, computed by the same functions — so what staff review is exactly what is saved.';
comment on function public.correct_booking_transaction(uuid, numeric, numeric, numeric, text) is
  'Command-only. The ONLY way a booking_transactions money figure changes after payment. Recomputes from rates via the shared functions, requires a reason, and logs old -> new values in the same transaction. Records only — moves no money. Commission corrections are visible to vendors.';

revoke execute on function public.preview_booking_transaction_correction(uuid, numeric, numeric, numeric) from public, anon;
revoke execute on function public.correct_booking_transaction(uuid, numeric, numeric, numeric, text)     from public, anon;
grant  execute on function public.preview_booking_transaction_correction(uuid, numeric, numeric, numeric) to authenticated, service_role;
grant  execute on function public.correct_booking_transaction(uuid, numeric, numeric, numeric, text)     to authenticated, service_role;
```

**Blast radius**

- **Data.** Nothing existing is changed. There is a new empty table, new functions, and
  a table comment.
- **Locks.** Negligible.
- **Payment path.** Not touched. The payment trigger never calls these.
- **Downstream.**
  - Command types.
  - **Vendor-visible figures after any commission correction** (see "Vendor impact").
  - Every correction changes bucket totals and printed ledgers immediately.
- **Reversibility.** `rollback/20260911000002_payout_corrections.rollback.sql`.
  ⚠️ **Once any correction has been made, do not drop the log table.** Corrected values
  stay in `booking_transactions`, and the log is the only record of what they were
  before. The rollback script drops the functions only, unless the log is empty.

### B5 — Payment-path safeguards  ✅ DONE (2026-09-12) — local ✅, staging ✅ (a real kiosk payment through to a payout row), production ✅ (check script 16/16 and the smoke check passed). The A6 rollback rehearsal was never run — optional by design, and now moot: the path it de-risked is live and working
**Why it is a blocker.** `create_booking_transaction()` runs inside the webhook's
`UPDATE`, and the webhook answers `200` on failure, so PayMongo never retries
(`route.ts:117-129`).

**The risk.** A bug here means **a charged customer, an unpaid booking, and only a log
line**. No data condition can make it throw (all values `NOT NULL` or coalesced, amounts
bounded ≤ 100%). The remaining risk is **a mistake in the SQL I write**: `plpgsql` checks
column names only at run time.

**Prevent:**
1. **One definition of the maths** (`platform_fee_amount()`, `withholding_amount()` in
   B1). The trigger, backfill and corrections cannot disagree, and the functions can be
   checked in *any* environment, production included, with a side-effect-free
   `select public.withholding_amount(1056, 1, 50); -- 5.28`.
2. **Static check.** The SQL test enables `plpgsql_check` *inside its rolled-back
   transaction*, so nothing is installed permanently. It asserts **zero findings** for
   `create_booking_transaction()` (checked as a trigger on `bookings`),
   `correct_booking_transaction(...)` and `preview_...(...)`. That catches wrong column
   names and types without running a payment.
3. **Run the real path everywhere before production:**
   - locally: the SQL test flips `is_paid` and exercises the trigger
   - on staging: a real test payment (U2)
4. **Migration parity:** staging and production must list the same applied migrations
   before the production push (U3). They drifted once before. With the same migrations,
   a function proven on staging behaves identically on production.

**Recover:** new `backbone/supabase/rollback/`, hand-run like `bootstrap/` and `demo/`,
never read by the CLI.

- **`20260911000001_withholding_tax.rollback.sql`**
  - **Section A, emergency (payments failing):** restore `20260725000002`'s original
    `create_booking_transaction()` body **and**
    `alter column withholding_rate_percent/base/amount set default 0`.
    ⚠️ Restoring the function alone would **still** fail every payment, because the
    old insert doesn't fill the new `NOT NULL` columns.
  - Payments then confirm with 0 withholding. The script ends with the query that lists
    them (`created_at > <incident start> and withholding_rate_percent = 0`), and each is
    fixed afterwards with the correction tool.
  - **Section B, full revert:** drop the net column, the constraint and the three columns;
    drop the settings columns; restore `20260910000001`'s bucket-totals function and its
    grants; drop both maths functions. It ends with a note to run
    `npx supabase migration repair --status reverted 20260911000001`, so a fixed
    migration can be pushed later.
- **`20260911000002_payout_corrections.rollback.sql`** drops the two RPCs. It drops the
  log table **only if it is empty**, and otherwise stops with a message.

**Detect:**
- Watch booker's logs for `[webhook] is_paid write FAILED` around each push.
- The production smoke check (U3) confirms the first payment after the push carries a
  withholding snapshot.

### Stage 2 execution note (2026-09-11) — B1, B4, B5

**Files written (backbone repo, untracked, nothing applied):**
- `supabase/migrations/20260911000001_withholding_tax.sql` (B1)
- `supabase/migrations/20260911000002_payout_corrections.sql` (B4)
- `supabase/tests/withholding_and_corrections_test.sql` (B5 / I6 SQL part):
  - static `plpgsql_check` on all four functions
  - the real payment path, fired through a `pay()` helper that resets any booking to
    unpaid and then marks it paid with triggers on
  - the maths functions, constraints and bucket totals
  - corrections: commission, an already-paid payout, and every rejection
  - preview = correct
  - grants for `authenticated` and `service_role`
- `supabase/rollback/20260911000001_withholding_tax.A-emergency.sql` = **"Section A"**
  everywhere in this plan
- `supabase/rollback/20260911000001_withholding_tax.B-full-revert.sql` = **"Section B"**
- `supabase/rollback/20260911000002_payout_corrections.full-revert.sql`

**Changes from the SQL reviewed above, all for safety:**
1. **The rollback is three files, not sections of one** (D19). Two sections in one file
   can be run together by mistake, and in an emergency that is exactly what happens.
2. **The correction functions validate inputs as unconstrained `numeric`, with explicit
   null checks, before storing.** In the reviewed draft, `numeric(5,2)` locals would
   have turned `1000` into a numeric-overflow error instead of the intended "must be
   0–100", and a null input would have reached a `NOT NULL` column. The test covers
   both.
3. **The preview function's output columns are `new_fee_amount`, `new_payout_amount`,
   `new_withholding_amount`, `new_net_payout_amount`.** Plain names would share
   identifiers with the ledger's columns inside plpgsql.

**Machine-verified (static, nothing executed against a database):**
- `create_booking_transaction()` in **both** rollback files is byte-identical to
  `20260725000002`.
- The bucket-totals function (body, comment and grants) in B-full-revert is identical
  to `20260910000001`.
- The original table comments are restored exactly where each rollback needs them.
- The new payment function differs from the original **only** in the withholding
  additions and the switch to the shared maths functions (diff inspected).
- `config.toml` seeds only `./seed.sql`, so a `db reset` can never run anything in
  `rollback/`. `schema_paths` is empty.
- The migrations sort immediately after `20260910000001`.
- Local `postgres` may create `plpgsql_check` (it is in `supautils.privileged_extensions`,
  v2.8), so the static check runs as written.

**Not verified yet (needs U1):** that both migrations apply, and that the SQL test
passes. Postgres cannot parse a migration without running it, so these are the first
real execution. Nothing in B1, B4 or B5 is ✅ until U1 reports back.

**U1 run 1 (2026-09-11; you applied the migrations, I ran the checks and tests):**
- **Read-only checks, all as expected:**
  - `20260911000001` and `000002` are recorded as applied
  - the settings read 12.00 / 1.00 / 50.00
  - the three snapshot columns are `NOT NULL`, and `net_payout_amount` is `GENERATED ALWAYS`
  - 46 rows, 0 nulls, 0 rows where the stored figures disagree with the maths functions
  - the sums are payout ₱36,516.48, withholding ₱182.58, net ₱36,333.90
  - `withholding_amount(1056,1,50) = 5.28`
  - all six functions are present, and bucket totals returns the five columns
  - the log has RLS on; `authenticated` has SELECT only and `anon` has nothing
  - the CHECK constraint is present
- **`plpgsql_check`: zero findings at any level** on all four functions.
- **`booking_transitions_test.sql`: 45/45. `auto_acknowledge_test.sql`: 8/8.** The
  payment-trigger change broke neither.
- **`withholding_and_corrections_test.sql`: 47/49.** Both failures are real and were
  caught as designed. See B6.

### B6 — The "append-only" audit logs were not append-only  ✅ DONE locally (2026-09-11) — `000003` applied; service_role = INSERT,SELECT on all four; the 14 new grant cases pass. Staging and production: U2/U3 · **APPROVAL GATE (security)**
**Found by:** the stage 2 SQL test, cases 48–49: `service_role` could UPDATE and DELETE
`booking_transaction_corrections`.

**Root cause (escalated beyond this feature):**
- The `public` schema's default privileges give `service_role` **every** privilege
  (`arwdDxtm`) on every table `postgres` creates. `20260620000001:29-33` revoked those
  defaults for `anon` and `authenticated` only.
- A `grant select, insert … to service_role` therefore **adds to** that and removes
  nothing.
- So four logs described as append-only, `schema.md`'s "no UPDATE or DELETE for
  anyone" among them, have let `service_role` UPDATE, DELETE and TRUNCATE:
  - `booking_status_log` (`20260516000006`)
  - `vendor_payout_method_log` (`20260815000001:223`)
  - `vendor_payout_view_log` (`20260816000001:112`)
  - `booking_transaction_corrections` (`20260911000002`)
- D15 had cited the first of these as its precedent.

**Audit before revoking** (2026-09-11). Nothing writes these tables in a way the
revoke would break:
- The only `service_role` writes are two **INSERTs**: `vendor/app/api/payout-method/route.ts:251`
  and `command/app/api/vendor-payout/route.ts:173`. Both are kept.
- `log_booking_status_change()` and `correct_booking_transaction()` are
  `SECURITY DEFINER`, so they write as the owner.
- `ON DELETE CASCADE` runs as the table owner, so account deletion
  (`command/lib/accountDeletion/execute.server.ts`, which touches no log directly) and
  demo teardown are unaffected.
- No migration, edge function (`send-notification-email`, `send-push-notification`) or
  app code UPDATEs, DELETEs or TRUNCATEs any of the four.

**Fix, chosen by you 2026-09-11 (D20):** new migration
`supabase/migrations/20260911000003_audit_logs_append_only.sql`.
- It runs `revoke all … from service_role`, then `grant select, insert … to service_role`,
  on all four tables.
- `revoke all` rather than a list, because local is PG 17.6 with its extra `MAINTAIN`
  privilege, and the hosted versions may differ. `revoke all` is correct on any version.
- **Vendor app:** its payout-method route only INSERTs, and INSERT is kept. **No vendor
  code changes.**

**Rollback:** `supabase/rollback/20260911000003_audit_logs_append_only.full-revert.sql`
grants everything back. If you are also reverting `000002`, run this one first.

**Test extended:**
- TRUNCATE on the correction log is denied.
- UPDATE, DELETE and TRUNCATE on each of the three older logs are denied to `service_role`.
- SELECT and INSERT are still held on all four.

**Blast radius:**
- **Data:** none.
- **Lock:** brief, on the four tables' privileges only.
- **Downstream:** none found (audit above).
- **Reversibility:** the rollback file.

**Verification:** after `migration up --local`, the full SQL test passes, and
`information_schema.role_table_grants` shows `service_role` = `INSERT, SELECT` on all
four.

---

## IMPORTANT

### I1 — Ezzy fee column + sort on Ready to pay  ✅ DONE (2026-09-11) — code, full suite and browser alignment check all passed
**Files:** `PayoutRow.tsx:37-41` + `.module.css:3, 56-61`;
`PayoutGroupColumns.tsx:34-38` + `.module.css:5, 40-43`.

- A muted `−{fmtPeso(row.platformFeeAmount)}` cell, with the strip column
  `{ col: "platformFeeAmount", label: "Ezzy fee", num: true }`. Sorting is already
  wired (`usePayoutFilters.ts:9-12, 70`).
- Both grids change together:
  `24px minmax(0,1fr) 132px 116px 124px` → `24px minmax(0,1fr) 132px 108px 116px 124px`.
- At ≤780px, gross and fee hide together.

**Executed 2026-09-11.** Files changed:
- `PayoutRow.tsx`: fee cell between gross and payout
- `PayoutRow.module.css`: 6-track grid, `.fee`, and the ≤780px rule hiding `.gross, .fee`
- `PayoutGroupColumns.tsx`: "Ezzy fee" column, comment updated to four labels / six tracks
- `PayoutGroupColumns.module.css`: 6-track grid; ≤780px hides children 3 and 4, with a comment mapping them
- `app/ui-gallery/page.tsx`: `PayoutsFixture` runs the real `usePayoutFilters(PAYOUT_ROWS, "releasable")`
- `visual-tests/payouts.spec.ts`: new "the Ezzy fee column is shown and sorts the release layout"

**Machine-verified:**
- `npx tsc --noEmit` exit 0.
- `npm run lint`: 25 problems (20 errors, 5 warnings), **none in a touched file** (grep of the log for the changed paths is empty). The 20 errors are the known pre-existing `any`s.
- `npm run build` exit 0, 15 static pages.
- `npx playwright test`, full suite, unpiped: **12 passed**, exit 0. That is the 11 existing tests plus the new one, which proves the fee cells render (`−₱ 144.00`, `−₱ 288.00`) and that a second click on "Ezzy fee" reverses Acme's rows.
- `grep "style={{" components/payouts`: no matches.

**Side effect, intended:** the fixture now uses the page's default sort (payment date, ascending), so Coastal's group renders before Acme's. No existing assertion depends on group order.

**Browser check, done 2026-09-11.** Screenshots of `/ui-gallery?mode=payouts` from a
throwaway `next dev` on :3300 (stopped afterwards; port confirmed free). Saved in
`command/test-results/i1-alignment/`, which is gitignored.
- **900px light:** the strip reads Booking · Customer paid · **Ezzy fee** · Vendor payout,
  and each label's right edge sits over its column (`−₱ 540.00`, `−₱ 144.00`, `−₱ 288.00`
  under Ezzy fee).
- **760px light:** gross and fee are hidden from both the strip and the rows; Booking and
  Vendor payout stay aligned.
- **900px dark:** the fee uses the muted token and is readable; borders and backgrounds
  follow the theme.

Found during the check and **not caused by I1**, so it is recorded as **I9** rather than
fixed silently.

### I2 — `PayoutDetailModal`  ✅ DONE (2026-09-11) — 22/22; the audit guard and a focus bug both proved by test
**Files:** new `components/payouts/PayoutDetailModal/` containing `.tsx`,
`usePayoutDetailModal.ts` and `.module.css`.

- **Radix Dialog.** Title = offering name, **not** "Payout details". Description =
  vendor · bucket label.
- **Payout section:**
  - `payoutDetailFields` (B3)
  - a caption from the row's stored snapshot: "1% of 50% of the vendor payout, as saved"
  - Net payout emphasised
  - a **"Corrected"** chip when a correction exists
- **"Pay to" section** (D7):
  - masked `row.payoutMethod`: no decrypt, no audit row
  - `null` → "no payout details on file", with the reveal button disabled
  - **Show full details** mounts `<VendorPayoutDetails vendorId>` (I3): one click = one
    audited request
- **Corrections section:**
  - the log for this payout, newest first: who, when, reason, what changed, and whether
    it was already paid at the time
  - loading, empty ("never corrected") and error states
  - a **Correct figures** button switches the body to `PayoutCorrectionForm` (I8)
- **State:** `usePayoutDetailModal` owns `showFull`, `mode` (`view` | `correct`) and the
  corrections fetch. The page mounts the modal with `key={row.id}`, so nothing carries
  over between payouts.
- **Print safety:** `@media print { display: none }`.
- **Separation:** render only; state in the hook; `.module.css` with `--rs-*` tokens;
  no `style={{}}`; works at 400px.

**Executed 2026-09-11 (stage 6, with I4).** New `components/payouts/PayoutDetailModal/`
(`.tsx` + `usePayoutDetailModal.ts` + `.module.css`), mounted by `PayoutsPage` and by the
gallery fixture, both keyed by row id.

**Scope split, as with the service fields:** the modal's **corrections section is stage 7**,
alongside the form that writes to it (I8). Stage 6 delivers the payout fields and the
"Pay to" panel.

**Two defects found by tests, not by looking:**
1. **Focus was lost on close.** Measured: after Escape, `document.activeElement` was
   `<body>`. Radix restores focus as it *closes*, but the page renders this dialog only
   while a row is selected, so clearing the row **unmounts** it and the restore never
   runs — a keyboard user would be dropped at the top of the document. Fixed in
   `usePayoutDetailModal`: remember what was focused on mount and refocus it on unmount
   inside a `requestAnimationFrame` (after React's commit, skipped if the trigger has
   since left the DOM, which happens when the payout was released while the modal was open).
2. **A JSX comment inside `rows.map(...)`** broke `PayoutTable` outright. `tsc` caught it
   before the suite ran; that run's build failure was mine, not flakiness.

**Machine-verified:** `tsc` exit 0 · lint 25 problems, **none in a touched file** ·
`npm test` 79/79 · `npm run build` exit 0 · `npx playwright test` **22 passed**, exit 0 ·
no `details_enc` anywhere in `services`/`components` — masked `display` only · no
`style={{` and no stateful hooks in the modal's render layer.

**Browser-verified** (screenshots): 900px light and dark, 400px, and the no-destination
state. The dialog shows every field, a bolded net payout, the "1% of 50% … as saved when
this booking was paid" caption, and **Pay to: Bank account · BDO Unibank ••••••••7890**.
With no destination it reads "This vendor has no payout details on file." and "Show full
details" is **disabled**.

**The audit guarantee, asserted rather than assumed:** opening a payout makes **zero**
requests to `/api/vendor-payout`; pressing "Show full details" makes **exactly one**.
That is what keeps `vendor_payout_view_log` meaningful (D7).

### I3 — Extract `VendorPayoutDetails` from `VendorPayoutModal` (behaviour-preserving)  ✅ DONE (2026-09-11) — the hook's move proved verbatim by diff; 16/16 Playwright
**Files:**
- new `components/vendors/VendorPayoutDetails/` containing:
  - `VendorPayoutDetails.tsx`: body of `VendorPayoutModal.tsx:59-110`, plus `MASK`
  - `useVendorPayoutDetails.ts`: **moved verbatim** from `useVendorPayoutModal.ts`,
    keeping the ref guard and the deliberate absence of a `cancelled` flag, with both
    comments (`:39-91`)
  - `CopyField.tsx`: moved
  - `.module.css`: body classes moved
- `VendorPayoutModal.tsx` becomes the Dialog shell plus `<VendorPayoutDetails />`.
- `useVendorPayoutModal.ts` is removed with `trash`. *(In execution: **`trash` is not on
  PATH** in this environment, so `git rm` was used instead — a tracked file's content
  stays recoverable from git history.)*

**Executed 2026-09-11 (stage 5).**
- new `components/vendors/VendorPayoutDetails/`: `VendorPayoutDetails.tsx` (the body,
  with `MASK`), `useVendorPayoutDetails.ts`, `CopyField.tsx`, `VendorPayoutDetails.module.css`.
- `VendorPayoutModal.tsx` is now the **dialog shell only** — Radix root, overlay, header,
  then `<VendorPayoutDetails vendorId />`. It holds no state and no hook.
- `VendorPayoutModal.module.css` keeps overlay/card/header/title/subtitle/close; every
  body rule moved, since a non-dialog caller needs those and none of the shell's.

**The "verbatim" claim, proved by diff rather than asserted**
(`git show HEAD:<old> | diff - <new>`):
- **Hook:** the *only* differences are four added comment lines recording the move, and
  `useVendorPayoutModal` → `useVendorPayoutDetails`. The ref guard, the effect, the
  no-`cancelled`-flag reasoning and the copy handler are byte-identical.
- **`CopyField`:** only the stylesheet import path and one added comment.

**Where the audit warning now lives.** `VendorPayoutDetails.tsx` carries it at the top:
mounting the component *is* the decrypt and the audit row, so it must be mounted on a
deliberate human act — never in a list or on navigation. That is the rule stage 6's
"Show full details" button has to honour.

**Machine-verified:** `tsc` exit 0 · lint 25 problems, **none in a touched file** ·
`npm test` 79/79 · `npm run build` exit 0 · `npx playwright test` **16 passed**, exit 0 ·
no stale imports of the old hook or `CopyField` path · no body rules left in the shell
stylesheet · `VendorPayoutDetails` is mounted only by the dialog (stage 6 adds the
second caller).

**Not verified here (needs a live session, unchanged from the plan):** that opening the
Vendors-page dialog still writes exactly one `vendor_payout_view_log` row. The code path
is byte-identical, but the check itself is U2/U3 work.

### I4 — Row click, and the fields Command reads  ✅ DONE (2026-09-11) — withholding fields in stage 3; `vendorId`, `platformFeePercent`, `payoutMethod` and the row click in stage 6
**Files:** `services/payouts.service.ts:18-48, 81-103`; `services/vendors.service.ts:77`
(`export` `toPayoutSummary`); `usePayoutsPage.ts`; `PayoutsPage.tsx:186-226`;
`PayoutVendorGroup.tsx`; `PayoutRow.tsx` + `usePayoutRow.ts` + `.module.css`;
`PayoutTable.tsx` + `.module.css`.

**Service `SELECT`** adds:
- `vendor_id`, `platform_fee_percent`
- `withholding_rate_percent, withholding_base_percent, withholding_amount, net_payout_amount`
- `vendors(name, vendor_payout_methods(method_type, status, display))`: `display` only,
  **never `details_enc`**

**`PayoutRow`** gains:
- `vendorId`, `platformFeePercent`
- `withholdingRatePercent`, `withholdingBasePercent`
- `withholdingTax: number | null`, `netPayout: number | null` (null on Reversed, display
  only)
- `payoutMethod`

**Page state and row click:**
- `detailId` / `openDetail` / `closeDetail`, with a derived `detailRow`.
- `reload()` (rows + totals) is exposed for corrections.
- `load()` clears `detailId`, **except** after a correction: the row is still in the
  bucket, so the modal stays open on its new values.
- Ready to pay rows: `onClick={openFromRow}` ignoring `[data-row-control]`, and a
  handler-less offering `<button>`. No `role="button"` on the row.
- Audit table: `<tr onClick>`, with the booking text in a button and `onOpenRow`
  required.

### I5 — Withholding settings on Settings → Platform Fee, with a confirmation  ✅ DONE (2026-09-11) — 16/16 Playwright; card and confirmation checked in light, dark and at 400px
**Files:** `services/platformFeeSettings.service.ts`, `lib/types.ts:14-18`,
`PlatformFeeSettingsPage.tsx` + `usePlatformFeeSettingsPage.ts`; new
`components/settings/WithholdingTaxSettings/` containing `.tsx`, `use….ts` and
`.module.css`; reuses `components/ui/DeleteConfirmModal`.

**Service and ownership**
- The service reads and writes `withholding_rate_percent`/`withholding_base_percent`,
  plus `updated_by`.
- **The page hook stays the single owner of the settings row.** It gains
  `saveWithholding(rate, base)` and passes `settings` and `saveWithholding` to the card.

**`useWithholdingTaxSettings(settings, onSave)` owns the form:**
- two inputs, 0–100 and 2dp, matching the CHECKs
- a numeric dirty check
- the ₱1,000 example preview (the only client-side copy of the formula, labelled as an
  example, never a stored figure)
- `confirming` state

**Confirmation.** Save opens `DeleteConfirmModal`, the app's generalised confirm, with
`icon`, `confirmLabel="Yes, change it"` and this message:

> Change withholding from **1% of 50%** to **10% of 50%**? Every payment from now on
> will be saved with the new rule. Saved payouts keep their values unless corrected
> from Payouts.

**Only confirming calls `onSave`.**

**Page changes:**
- The note at `:93-97` changes, because its promise is no longer true after D14:
  > Changing these rates affects **future payments only**. Saved payouts keep the rates
  > they were paid under, unless staff correct one from Payouts; every correction is
  > logged.
- The "Last changed … by …" line moves beneath both cards, because they share one
  timestamp.

**Executed 2026-09-11 (stage 4).** Files:
- `lib/types.ts`: `PlatformFeeSettings` gains `withholdingRatePercent` / `withholdingBasePercent`.
- `services/platformFeeSettings.service.ts`: the read selects both columns; new
  `updateWithholdingSettings(rate, base)` writes them **as a pair** with `updated_by` —
  saving half of "1% of 50%" would snapshot a rule nobody chose onto every payment until
  the other half followed.
- `usePlatformFeeSettingsPage.ts`: `saveWithholding` writes, re-reads and toasts. The
  page hook stays the only owner of the row.
- new `components/settings/WithholdingTaxSettings/` — `.tsx` + `useWithholdingTaxSettings.ts`
  + `.module.css`. It takes `settings` and `onSave` as props and **fetches nothing**,
  which is what makes it mountable in the gallery.
- `PlatformFeeSettingsPage.tsx`: renders the card; the intro covers both rules; the
  "last changed" line moved beneath both cards; the note no longer claims payout history
  never changes, because a logged correction can change it.
- `app/ui-gallery/page.tsx`: `?mode=withholding`, with a save that records instead of writing.
- new `visual-tests/settings-withholding.spec.ts`: the example, the range and dirty
  rules, and the confirmation gate.

**Machine-verified:** `tsc` exit 0 · lint 25 problems, **none in a touched file** ·
`npm test` 79/79 · `npm run build` exit 0 · `npx playwright test` **16 passed**, exit 0 ·
no `style={{` and no stateful hooks in the render layer · the card imports no service.

**Browser-verified:** 900px light, 900px dark, 400px (the inputs stack), and the
confirmation naming both rules. The example reads "vendor payout ₱ 880.00 · withheld
₱ 4.40 · transferred ₱ 875.60" at 12% commission.

**Found while checking, logged as I10:** the confirmation reuses `DeleteConfirmModal`,
which is dressed for destruction (red button, red icon tile).

### I6 — Tests  ✅ DONE (2026-09-12) — marker was stale; the work landed across stages 2–8

> Every artifact below exists and passes. The ⬜ was never updated as the stages that
> wrote these tests closed, which is exactly the drift the status model is meant to
> prevent — corrected on 2026-09-12 after re-verifying each file.
>
> - SQL: `backbone/supabase/tests/withholding_and_corrections_test.sql` — **63/63**
>   (stage 2 note), `plpgsql_check` zero findings, plus the 14 grant cases B6 added.
> - Unit: `command/lib/payout/transfer.test.ts` — part of **79/79** (`npm test`,
>   re-run 2026-09-12).
> - Behavioural: `visual-tests/payouts.spec.ts` (16 tests) and
>   `visual-tests/settings-withholding.spec.ts` (3) — 16/16, 22/22 and 24/24 across
>   stages 5, 6 and 8.
> - Gallery fixture: `app/ui-gallery/page.tsx`, including `?mode=withholding`.
>
> The case table below is kept as the record of what each test covers.

**SQL**, new `backbone/supabase/tests/withholding_and_corrections_test.sql`. It follows
`auto_acknowledge_test.sql`: rolled back, with a results table. To impersonate a caller,
follow how `booking_transitions_test.sql` sets one up. Check that first; if it doesn't,
use `set local role authenticated` plus `request.jwt.claims` for a seeded Command admin.

| # | Case |
|---|---|
| 1 | `plpgsql_check` (enabled inside the transaction): zero findings for `create_booking_transaction()` on `bookings`, `correct_booking_transaction`, `preview_booking_transaction_correction` |
| 2 | Settings 12% / 1% / 50%, flip a booking paid → snapshot 1.00/50.00, `withholding_amount = withholding_amount(payout,1,50)`, `net = payout − withholding`, `fee + payout = amount_paid` |
| 3 | Change settings → the #2 row is unchanged; the next payment uses the new rule |
| 4 | Half-centavo boundary: `withholding_amount(1.00, 1, 50) = 0.01` |
| 5 | The CHECK rejects withholding > payout; writing `net_payout_amount` directly is rejected |
| 6 | `command_payout_bucket_totals()`: `net_total = payout_total − withholding_total` per bucket |
| 7 | `correct_…` as Command admin, commission 12 → 10: fee, payout, withholding and net all recomputed; **one** log row with from/to values and `payout_status` |
| 8 | Correcting a **released** row succeeds and logs `payout_status = 'released'` |
| 9 | Rejections: reason < 10 chars; a percentage outside 0–100; no change; unknown id; a non-Command caller |
| 10 | `preview_…` returns exactly what `correct_…` then saves |
| 11 | Direct `UPDATE` on `booking_transactions` as authenticated is still denied; `UPDATE`/`DELETE` on the log is denied to authenticated **and** service_role |

The existing `booking_transitions_test.sql` and `auto_acknowledge_test.sql` must still
pass.

**Unit** (`npm --prefix command test`): `lib/payout/transfer.test.ts`, covering Acme's
two rows → 3152.16, nulls skipped, and centavo summation.

**Gallery fixture** (`app/ui-gallery/page.tsx:63-156`):
- Rows gain the stored-shape fields.
- `PayoutsFixture` runs the real `usePayoutFilters`, mounts `PayoutDetailModal` with fake
  `onPreviewCorrection`/`onSaveCorrection`/`getCorrections`, and adds a
  `PayoutSelectionBar`.
- New `?mode=withholding` mounts `WithholdingTaxSettings` with fixture settings and a
  recording `onSave`.

**Behavioural**, `visual-tests/payouts.spec.ts`:
1. A row click opens the dialog with every field (`t1`: fee ₱144.00, withholding ₱5.28,
   net ₱1,050.72) and the caption.
2. Modal ⇔ print parity on `t1`.
3. Checkbox, Mark paid and No leave the dialog closed.
4. Keyboard: Enter opens; Escape closes and returns focus.
5. Reversed: withholding and net read "—".
6. Ezzy fee sort.
7. **Audit-log guard:** zero `/api/vendor-payout` requests on open, exactly one on
   "Show full details".
8. Coastal: "no payout details", reveal button disabled.
9. Transfer totals agree across the header, bar and print.
13. **Correction:** Review shows the before/after figures from `onPreviewCorrection`.
    Save is disabled until the reason has ≥10 characters. It calls `onSaveCorrection`
    exactly once, with the values reviewed.
14. Changing the commission shows the **vendor-visible** warning. Correcting a released
    row shows the **"changes the record, not the money"** warning.

**Behavioural**, `visual-tests/settings-withholding.spec.ts`:
10. The preview reads "₱880.00 · withheld ₱4.40 · transferred ₱875.60".
11. `101` → error and Save disabled; `1.00` vs `1` → not dirty.
12. Save opens the confirmation naming both the old and new rule; **Cancel calls nothing**;
    confirming calls `onSave(10, 50)` once.

### I7 — Docs  ✅ DONE (2026-09-12)

`architecture/schema.md`:
- migrations `20260911000001`/`000002`
- `platform_fee_settings` ("money policy")
- `booking_transactions`: new columns, generated net, CHECK, **"snapshotted; changed only
  by `correct_booking_transaction()`, which logs"**, replacing "immutable"
- the new `booking_transaction_corrections` table
- the shared maths functions
- the bucket-totals shape

`architecture/portals.md`:
- Settings → Platform Fee (withholding card, confirmation, reworded rule)
- Payouts (modal, corrections, transfer-vs-vendor-payout rule, cards, print, Ezzy fee)
- the feature table, **including the vendor-visible effect of commission corrections**

`architecture/database-reset-and-deploy.md`: the new `rollback/` folder and
`migration repair`.

`architecture/schema.md`, also (B6):
- correct the append-only claims for `booking_status_log`, `vendor_payout_method_log`
  and `vendor_payout_view_log`, which were false until `20260911000003`
- record the trap for the next table: the schema's default privileges give
  `service_role` everything, so an append-only table needs an explicit `revoke all`
  before its grant
- update the AGENTS.md invariant wording if it still implies a grant alone restricts
  `service_role`

**Executed 2026-09-12 (stage 8).** Four documents:

- **`architecture/schema.md`**
  - three migration-table rows (`20260911000001/2/3`), each saying what it does *and why*
  - `platform_fee_settings`: now "money policy", the two withholding columns, and why
    their defaults deliberately break `fee_percent`'s default-0 rule
  - `booking_transactions`: the three snapshot columns and the generated
    `net_payout_amount`, plus an **"Amended 2026-09-11"** note — the figures are no
    longer absolutely immutable, and the rule that replaced immutability is stated
    exactly (Command-only RPC, reason required, logged in the same transaction)
  - new **`booking_transaction_corrections`** section
  - ⚠️ the false "no UPDATE or DELETE for anyone" claims on `vendor_payout_method_log`,
    `vendor_payout_view_log` and `booking_status_log` are **corrected in place** rather
    than quietly rewritten: each now says it was untrue until `20260911000003`, and why
    (a GRANT only adds)
  - the RPC list gains the preview and correct functions, and the totals RPC's new columns
- **`architecture/portals.md`**
  - Payouts Page: withholding, the **vendor payout vs to transfer** rule and where each
    appears, the landscape print, the details modal (including that opening it costs no
    audit row), and corrections — with the vendor-visible warning stated plainly
  - Settings → Platform Fee: rewritten for two rules, the paired save, the confirmation,
    the shared "last changed", and the corrected promise about payout history
  - three new feature-table rows
- **`architecture/database-reset-and-deploy.md`**: a `supabase/rollback/` section listing
  all four scripts, plus the three lessons from writing them (separate emergency from
  full revert; restoring a function is not enough when columns became `NOT NULL`; run
  `migration repair` afterwards)
- **`AGENTS.md`**: a new invariant — **a GRANT only adds; it never restricts** — with the
  append-only recipe (`revoke all` first) and a pointer to the four logs that were wrong.
  The existing bullet is corrected to say the revoked defaults apply to `anon` /
  `authenticated`, which is what made the gap invisible.

**Verified:** every file name, migration and function named in the docs exists on disk
(checked by listing, not from memory).

### I8 — `PayoutCorrectionForm` (one payout at a time)  ✅ DONE (2026-09-11) — 24/24; a stale-closure bug found by test and fixed by moving ownership
**Files:** new `components/payouts/PayoutCorrectionForm/` containing `.tsx`,
`usePayoutCorrectionForm.ts` and `.module.css`; `services/payouts.service.ts`
(`previewPayoutCorrection`, `correctPayout`, `getPayoutCorrections` + interfaces);
`usePayoutsPage.ts` (`previewCorrection`, `saveCorrection` → service + toast + `reload()`).

**Inputs**
- Commission %, withholding rate % and applied-to %, **prefilled from the row's saved
  values**.
- A reason, at least 10 characters.
- Rates only. Amounts are never typed (D16).

**Two steps**
1. **Review** calls the preview RPC and shows a before → after table: Ezzy fee, vendor
   payout, withholding, net. **These are the server's figures, exactly what will be saved.**
2. **Save correction** calls the correct RPC. The page reloads, the modal returns to
   view mode on the new values, and the log gains a row.

**Warnings, shown in the review step:**
- Commission changed: "Vendors see the Ezzy fee and payout for this booking in their
  app. This changes what they see, and they are not notified."
- Payout already paid (`released` / Owed back): "Already marked paid. This changes the
  record, not the money that was sent. If the vendor was paid the wrong amount, settle
  the difference with a separate transfer."

**States:**
- review-loading
- server error shown verbatim (no change, out of range, not permitted)
- saving
- editing any input invalidates a stale review

**Separation:** the form holds no service imports. It receives `onPreview`/`onSave` from
the page hook through the modal, which is what makes it testable in the gallery.
Render + hook + `.module.css`.

**Executed 2026-09-11 (stage 7).** Files:
- `services/payouts.service.ts`: `previewPayoutCorrection`, `correctPayout`,
  `getPayoutCorrections` + their types. RPC error messages are surfaced **verbatim** —
  they are written for a human ("A correction needs a reason of at least 10 characters").
- new `components/payouts/PayoutCorrectionForm/` (`.tsx` + hook + `.module.css`):
  rates only, a reason, then **Review → Save**. Editing any field discards the review, so
  Save can never write figures other than the ones on screen.
- `PayoutDetailModal`: a "Correct figures" button, the correction history, and a
  "Corrected ×" marker in the header.
- `usePayoutsPage`: owns the correction calls **and the history list**; a successful save
  re-reads the row, the totals and the history together.
- `app/ui-gallery/page.tsx`: fake preview/save, a `PAYOUT_RELEASED` row for the
  already-paid warning, and a `correction-saved` marker.
- `visual-tests/payouts.spec.ts`: two tests (below).

**Two defects, both found by tests rather than by looking:**
1. **The history never refreshed after a save** — it said "Never corrected." about a
   payout corrected a second earlier. Instrumented in the browser console, the cause was
   a **stale closure winning the race**:
   ```
   refresh start 3 → loader returns 1 row   ← fresh
   refresh start 4 → loader returns 0 rows  ← stale closure from the pre-save render
   result 3 (1 row) discarded as "superseded"; result 4 (0 rows) written
   ```
   My first fix — ignore any refresh a newer one supersedes — was **backwards**: the
   later call carried the older data.
   **Real fix: ownership.** The modal no longer fetches the history at all; the page hook
   owns it exactly as it owns the rows and the totals, and refreshes it as part of
   saving. No closures, no double fetch, no race. `usePayoutDetailModal` is back to
   `showFull`, `mode` and the focus restore.
2. **Four new lint warnings** from underscore-prefixed unused parameters in the fixture
   (this config does not exempt them). Removed by dropping the parameters — a function
   may take fewer than its type declares.

**Machine-verified:** `tsc` exit 0 · lint **25 problems, the pre-existing baseline, none
in a touched file** · `npm test` 79/79 · `npm run build` exit 0 · `npx playwright test`
**24 passed**, exit 0 · `grep "\[diag\]"` finds nothing — the temporary instrumentation
used to diagnose defect 1 is gone.

**Browser-verified** (screenshots): the empty form, the review step, and the saved state.
The review renders a Now → After table (Ezzy fee ₱144.00 → ₱120.00, vendor payout
₱1,056.00 → ₱1,080.00, withholding ₱5.28 → ₱5.40, **net payout ₱1,050.72 → ₱1,074.60**),
the vendor-visible warning, and Save disabled with "A reason is needed before saving."

**What the tests pin down:**
- the review shows the **server's** figures, not a browser sum of the inputs
- Save stays disabled until the reason is long enough, and nothing is written meanwhile
- the save handler receives exactly the reviewed values
- the vendor-visible warning appears for a commission change and **not** otherwise
- the already-paid warning appears when correcting a released payout

---

### I9 — "Vendor payout" strip label wraps onto two lines (pre-existing, cosmetic)  ✅ DONE (2026-09-11) — fixed on your go, and the fix's own regression caught by measuring
**File:** `components/payouts/PayoutGroupColumns/PayoutGroupColumns.module.css:16-30` (`.btn`).

Found during I1's browser check, at both 900px and 760px. The label "VENDOR PAYOUT"
(uppercase, letter-spaced, plus a chevron) is slightly wider than its 116px track, so it
breaks onto two lines. **Not caused by I1:** that track and the button styles are
unchanged by it.

**Fix direction:** `white-space: nowrap` on `.btn`. The label then extends a few pixels
into the 12px column gap instead of wrapping, and alignment is unchanged because the
button is right-justified. Browser-check at 900px and 760px afterwards.

**Executed 2026-09-11 — in two attempts, and the second only happened because the check
was a measurement rather than a look.**

1. **First attempt:** `white-space: nowrap` on `.btn`. The label went onto one line, and
   the screenshot looked right.
2. **What it actually did:** with wrapping forbidden and the column still 116px, the
   shortfall had to come from somewhere, and the flex item that could give was the
   chevron. Measured in the browser: **Vendor payout's chevron was 2px wide** against
   11px on Booking, Customer paid and Ezzy fee. `scrollWidth === clientWidth`, so
   nothing overflowed and nothing looked wrong — the only marker that the column is
   sortable had quietly shrunk to a sliver.
3. **Fix:** the payout track goes 116px → **132px** in **both**
   `PayoutRow.module.css` and `PayoutGroupColumns.module.css` (normal and ≤780px
   layouts), since the label plus chevron measures ~125px. `.iconActive, .iconIdle`
   also get `flex-shrink: 0`, so a future squeeze overflows visibly instead of eating
   the icon.

**Verified by measurement, not by eye** (`page.evaluate` over the strip's buttons):
- 900px — Booking, Customer paid, Ezzy fee, Vendor payout: **all chevrons 11px**, every
  label inside its own cell.
- 760px — Booking and Vendor payout: **11px**; the other two are hidden by the
  breakpoint, as intended.
- Screenshots at both widths confirm "VENDOR PAYOUT ⌃" on one line above its column.
- `npx playwright test`: **16 passed**, exit 0, after the grid change.

**Accepted cost:** the Booking column gave up 16px, so a row's sub-line can wrap at
900px ("Service 09 Aug 2026 · paid 02 Aug / 2026"). Legible, and the alternative was a
sort control nobody can see. Reclaiming it would mean narrowing the gross or action
column, which is not worth another grid change today.

### I10 — The withholding confirmation is dressed as a destructive action  ✅ DONE (2026-09-11) — option 1, the `tone` prop
**Files:** `components/ui/DeleteConfirmModal/DeleteConfirmModal.module.css:9-22, 50-58`;
used by `WithholdingTaxSettings.tsx`.

Found in stage 4's screenshot of the dialog. D20 chose the app's generalised confirm,
which is styled for deletion: a **red** "Yes, change it" button and a red-tinted icon
tile. Changing a tax rate is not destructive, and the blue `%` icon passed in sits on
that red tile, which reads as a mistake rather than a warning.

The same mismatch already applies to the vendor **activation** confirmation, which
reuses the identical shell — so this is not new, but it is now on a money-settings
screen where "red = about to destroy something" is actively misleading.

**Options**
1. **Add a `tone` prop** (`"danger"` default, `"neutral"` blue) to `DeleteConfirmModal`.
   Touches a shared component with 4 call sites, all of which keep today's look because
   the default is unchanged. **Recommended.**
2. **Drop the custom icon** so it at least matches the red tile. One line; the dialog
   still says "destructive" for a settings change.
3. **Leave it.** Consistent with the activation confirmation, and honest enough:
   the rate does apply to every future payment.

**Executed 2026-09-11 — option 1, on your go.**
- `DeleteConfirmModal` gains `tone?: "danger" | "neutral"`, **defaulting to `danger`**,
  so all four existing call sites (user delete, vendor delete, vendor reinstate, vendor
  activate) keep today's look with no edits.
- `.iconWrapNeutral` / `.confirmNeutral` are declared **after** the defaults, so they win
  at equal specificity.
- `WithholdingTaxSettings` passes `tone="neutral"`.

**Verified:** screenshot of the dialog — blue icon tile, blue `%`, blue "Yes, change it",
no red anywhere. `npx playwright test` **16 passed** (the settings spec drives this
dialog), `tsc` and `build` clean.

**Left alone deliberately:** the vendor **activation** confirmation still uses the red
default. It was not part of this plan, and changing its tone is a judgement about that
flow, not this one.

### I11 — On the release rows, the booking name collapses to zero width below ~430px  ✖ ABORTED (2026-09-12) — option 3, "leave it" (your call)
**Files:** `components/payouts/PayoutRow/PayoutRow.module.css:56-61` (the ≤780px layout).

Measured during stage 6 (`getBoundingClientRect` on the row's booking control):
**900px → 212 × 19. 400px → 0 × 19.** Below the breakpoint the row still reserves fixed
tracks for the payout (132px) and the action button (124px), plus gaps and padding, so
`minmax(0, 1fr)` has nothing left to give the booking name.

**Pre-existing, not caused by this plan.** Before stage 6 the booking name was an
ellipsised `<span>` in the same track — equally invisible at that width. Stage 6 only
made it measurable, because the name is now the keyboard trigger.

**What still works at 400px:** tapping anywhere on the row opens the details, and the
modal itself lays out correctly. What is lost is *reading* which booking a row is, and
the keyboard trigger, on a narrow phone.

**Options**
1. **A second breakpoint** (~560px) that stacks the row: booking name on its own line
   above the figures and the action. Most work, best result. **Recommended if Command is
   used on phones at all.**
2. **Drop the action column to an icon** below ~560px, freeing 90px or so for the name.
3. **Leave it.** Command is an internal desktop ops portal; `architecture/portals.md`
   describes no phone use for it.

⚠️ Whichever is chosen, `PayoutRow.module.css` and `PayoutGroupColumns.module.css` must
change together — their grids mirror each other by hand.

**Resolution (2026-09-12): option 3, aborted deliberately — not forgotten.**
Command is an internal desktop ops portal and `architecture/portals.md` describes no
phone use for it, so the cost falls on a viewport nobody works in. Against that, the fix
means editing two hand-mirrored CSS grids in lockstep, and I9 had already shown what that
costs: the first attempt there squeezed the sort chevron from 11px to 2px, caught only by
measuring. Real regression surface, no user.

**What is still true if this is ever revisited:** the defect is pre-existing and remains
in the code — nothing was changed to close this item. At ≤430px the booking name is
unreadable and the keyboard trigger unreachable; tapping the row still opens the modal,
and the modal itself is correct at 400px. Reopen this item rather than rediscovering it
if Command ever gains a genuine phone use.

## AD-HOC — found while testing this plan, fixed outside its scope

> Items here are **not part of the payouts work**. They are bugs this plan's staging
> testing happened to surface, recorded so the fix is not lost. They live in a different
> repository (`vendor/`) on a different branch, and they ship on their own schedule.

### AH1 — Kiosk custody close-out failed: "actor not permitted"  ✅ DONE (2026-09-12) — vendor app, branch `feature/debug_rental_from_kiosk`
**Repo:** `vendor/` — **not** `command/`, and no migration.
**Found:** staging, 2026-09-12, while testing a kiosk rental for U2. Booking
`77b21422-74da-4a69-8ad8-afab176749d7`. Tapping **"I've returned it"** showed
`Invalid booking status transition: in_progress -> returned (fulfilment_pattern custody,
actor not permitted)`. Caught and displayed, not a crash.

**Root cause (confirmed in the trigger source, not inferred).**
`validate_booking_status_transition()` classifies the actor from `auth.uid()`
(`20260829000004_kiosk_customer_close_out.sql`):

```sql
v_system := auth.uid() is null;
…
elsif old.status = 'fulfilled' then     -- session
  if new.status = 'completed' and (v_booker or v_system or v_command or (v_vendor and new.booked_via = 'kiosk'))
elsif old.status = 'in_progress' then   -- custody
  -- No system branch by design: an asset that never came back must never auto-complete.
  if new.status = 'returned'  and (v_booker or v_command or (v_vendor and new.booked_via = 'kiosk'))
```

`app/api/kiosk/close-out/confirm/route.ts` performed its UPDATE with
`createAdminClient()` — service role, no `auth.uid()` — so every kiosk close-out reached
the trigger as **system**. `fulfilled → completed` allows system, so the **session** flow
worked; `in_progress → returned` does not, so **every custody close-out has been broken
since the kiosk shipped**. The user's own query confirmed the row qualified in every other
respect: `booked_via = kiosk`, `fulfilment_pattern = custody`, `is_paid = true`, kiosk
clause present, and the vendor's own undo/restart transitions (user-scoped client)
succeeding in `booking_status_log`.

**Fix — act as the caller, not as the system.**
| File | Change |
|---|---|
| `vendor/lib/kioskAuth.ts` | `requireVendorAdmin` now also returns `client`: a Supabase client scoped to the caller — the bearer-header client for Expo, the cookie-bound SSR client for web. **Additive**, so `kiosk/booking`, `kiosk/close-out` and `kiosk/payment/create-session` are untouched; they still write with the admin client, which is correct for them (they create a booking on behalf of a customer who is not the caller, where RLS can never be the gate). |
| `vendor/app/api/kiosk/close-out/confirm/route.ts` | The status UPDATE now uses `caller.client`, so `auth.uid()` is the vendor admin and the trigger's `v_vendor and booked_via = 'kiosk'` branch applies. The admin client is kept for the existence read. Adds `.select("id")` and a **rows-affected check** → 403. |
| `vendor/lib/kioskCloseOut.ts` | The target-status rule (`in_progress → returned`, `fulfilled → completed`, else `null`) extracted as `closeOutTarget()` so the two lines that decide whether a payout is released have a test. |
| `vendor/lib/kioskCloseOut.test.ts` | 3 cases: custody goes to `returned` (never straight to `completed`), session goes to `completed`, and all eight other statuses refuse. |

**The rows-affected check is the non-obvious half.** An UPDATE that RLS refuses returns
**zero rows and no error**. Swapping the service-role client for a user-scoped one
without checking the count would have turned a loud, correct failure into a silent 200 —
the kiosk thanking a customer for a close-out that never happened. Bookings RLS does allow
it (`20260507000004_bookings.sql:141-149`, vendor admins may UPDATE their vendor's
bookings), so the check is a guard against a future policy change, not a live path.

**No schema change, and none needed.** The trigger's refusal is correct — the app was
lying about who was acting. Widening the trigger to admit `system` out of `in_progress`
would have deleted the exact safeguard its comment names.

**Verified (machine):** `npx tsc --noEmit` clean · `npm test` **380/380** (3 new) ·
`npm run lint` 35 problems, all pre-existing and none in a touched file (baseline
unchanged) · `npm run build` exit 0, `/api/kiosk/close-out/confirm` present.
**Verified live (staging, 2026-09-12):** a custody kiosk booking closed out end to end —
"I've returned it" moved it to `returned`, the vendor's "Got it back" completed it, and
the payout row appeared in Command with its withholding snapshot. That single run also
proves the close-out fix, the custody branch of the state machine and B1's payment path
in one pass.
**Still unexercised:** the **bearer** branch of the new caller-scoped client, unless the
close-out above was driven from the Expo app rather than the web kiosk. The web kiosk
uses the cookie branch; both were changed, only one is confirmed.

## Your steps

The backfill is **inside migration 1**, so it happens when the migration is applied.
Run commands from `backbone/`.

> ⚠️ **Order, every environment:** migrations first, then the Command build. Old Command
> code runs fine on the new schema; new Command code fails on the old one.

### U0 — Before production  ✅ DONE (2026-09-12) — accountant agrees to the rule as specified
- **Confirm the rule and base with your accountant:** 1% of 50% of the vendor payout
  after commission. Saved values are permanent unless corrected, and corrections to
  paid payouts don't move money.
- **Confirmed 2026-09-12:** the accountant agrees. The shipped defaults
  (`withholding_rate_percent = 1.00`, `withholding_base_percent = 50.00`) are therefore
  the intended production values, and U3 step 6 is a check rather than a change.

### U1 — Local  ✅ DONE (2026-09-11) — all three migrations applied; SQL tests 63/63, 45/45, 8/8
1. `npx supabase migration up --local`. **Not only `db reset`**, which runs the
   backfill against empty tables.
2. Run the tests. All three roll back:
   ```
   PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/tests/<file>
   ```
   Files: `withholding_and_corrections_test.sql`, `booking_transitions_test.sql`,
   `auto_acknowledge_test.sql`.
3. Tell me. I'll run U2 step 4's checks read-only against local and continue.

### U2 — Staging  ✅ DONE (2026-09-12) — all nine steps, confirmed by you

> **Steps 1–6:** migrations pushed, Command deployed, and a real kiosk booking taken all
> the way through to a payout row visible in Command — the payment path B1 and B5 exist
> to protect, exercised for real.
> **Steps 7–9:** the rate change and its confirmation, a live payout correction
> (commission and withholding) matching its review and reaching the vendor apps, and the
> staging rate restored. All reported working.
>
> This clears the last item that could only be proven by a human:
> `correct_booking_transaction()` and the vendor-visible propagation behind D14–D16 had
> been proven by SQL and Playwright, never against a live database. Now both.

> The CLI is **linked to staging** (`fbxbwnfeimzhgxpshdpa`); no output says so.

1. `npx supabase migration list --linked`. Expect `20260911000001` and `000002`
   pending, and `20260910000001` too if it hasn't been pushed.
2. *(Optional)* `select count(*), sum(payout_amount) from booking_transactions;`
3. `npx supabase db push`. The backfill gives every existing staging row 1% of 50%,
   paid ones included (D8).
4. Verify. Each query must return the stated result:
   ```sql
   select fee_percent, withholding_rate_percent, withholding_base_percent
     from platform_fee_settings;                                      -- <fee>, 1.00, 50.00
   select public.withholding_amount(1056, 1, 50);                     -- 5.28
   select count(*) from booking_transactions
    where withholding_amount <> public.withholding_amount(payout_amount,
                                  withholding_rate_percent, withholding_base_percent)
       or net_payout_amount <> payout_amount - withholding_amount;    -- 0
   select count(*), sum(payout_amount) from booking_transactions;    -- same as step 2
   select table_name, string_agg(privilege_type, ',' order by privilege_type)
     from information_schema.role_table_grants
    where grantee = 'service_role' and table_name in ('booking_status_log','vendor_payout_method_log',
          'vendor_payout_view_log','booking_transaction_corrections')
    group by table_name;                                              -- INSERT,SELECT on all four (B6)
   ```
5. Deploy the Command build to staging.
6. **Make a real test payment.** Its row carries the snapshot, and booker's logs show no
   `is_paid write FAILED`.
7. Settings: change the rate. The confirmation appears. The step 6 row keeps its old
   withholding, and the next payment uses the new rate.
8. **Correct one payout** from its modal, commission and withholding. Check:
   - the figures match the review
   - a `booking_transaction_corrections` row exists
   - the vendor web and mobile apps show the new fee and payout for that booking
9. Put the staging rate back if you changed it for the test.

### U3 — Production  ✅ DONE (2026-09-12) — migrations pushed, check script **16/16 PASS on production**, Command deployed, rate confirmed, smoke check passed

> **Use the check script, not the loose queries.** `backbone/supabase/checks/20260911_post_deploy_verification.sql`
> (written 2026-09-12) replaces step 4 below with 16 PASS/FAIL checks plus an INFO row.
> **Paste the whole file into Supabase Studio → SQL Editor and run it**, or use psql:
> ```
> PGPASSWORD=... psql -h <host> -p <port> -U postgres -d postgres \
>   -v ON_ERROR_STOP=1 -f supabase/checks/20260911_post_deploy_verification.sql
> ```
> Read-only, rerunnable, safe on production. **17 rows, 16/16 PASS on local, 2026-09-12**,
> with checks 15–16 covering 47 real rows.
>
> ⚠️ **It is one statement with no psql meta-commands, and must stay that way.** The first
> draft opened with `\pset` and ended with a second `select`. Both break in the SQL Editor:
> `\pset` is a psql-only command, and the editor shows only the LAST result set, which
> would have silently hidden all 16 checks behind the summary. The summary is now row 17
> of the same result.
>
> **Read-only is verified, not assumed:** re-run under `default_transaction_read_only=on`,
> which makes the server reject any write — 16/16 PASS, no error (2026-09-12). A keyword
> scan also finds no write or DDL statement; the only `INSERT`/`UPDATE`/`DELETE` text in
> the file is inside check labels.
>
> ⚠️ **Do NOT move this into `migrations/`.** It is a check, not a change. Anything in
> `migrations/` is applied by `db push` and recorded in the migration history, which would
> permanently desync the environments' migration lists; it also uses psql meta-commands
> (`\pset`) the migration runner does not handle. And migrations are frozen once applied,
> whereas this file should grow as more becomes worth checking. Run it with `psql`.
>
> ⚠️ **Why it exists: production is nearly empty pre-launch.** The two data checks
> (15, 16) pass vacuously against an empty ledger — zero mismatches out of zero rows is
> not evidence. So the script also verifies the *machinery*: both money functions and
> their rounding, the settings singleton reading 1.00/50.00, the four ledger columns,
> the three NOT NULL snapshots, `net_payout_amount` being GENERATED, the CHECK, all five
> routines, the corrections table with RLS, and B6's append-only grants. Its last row
> states outright how many real rows checks 15–16 actually covered, so a vacuous pass
> cannot be mistaken for a meaningful one.
1. **Parity check.** Compare `migration list` for staging and production, inspecting
   production without re-linking, as `database-reset-and-deploy.md` describes. Every
   migration applied on staging must be applied on production, except the two new ones.
   Don't push if they differ; bring production level first.
2. **Have the rollback scripts open** (`backbone/supabase/rollback/`) and know when you
   pushed. That timestamp is Section A's incident start.
3. Push at a quiet time, the way you normally push production (`db push` only).
4. Run the check script above. Expect **16/16 PASS**. Any FAIL: stop, don't deploy the
   Command build, and send me the row — old Command code runs fine on the new schema, so
   not deploying is a safe place to stand while it's diagnosed.
5. Deploy the Command build.
6. Settings → Platform Fee: confirm the rate is 1% / 50%, or set your real values,
   **before the next payment**.
7. **Smoke check.** Watch booker's logs for `[webhook] is_paid write FAILED`. When the
   first payment after the push arrives, check that its row has a withholding snapshot:
   `select created_at, withholding_rate_percent, withholding_amount from booking_transactions order by created_at desc limit 1;`
   A deliberate low-value payment of your own gets certainty sooner. Note that it is a
   real charge, and with no refund mechanism in the system, refunding it is manual in
   PayMongo.
8. **If a payment fails:** run rollback Section A immediately. Payments resume with
   0 withholding. Then fix the listed rows with the correction tool and tell me what the
   log said.

---

## DECISIONS
<!-- None OPEN. -->

- **D1 — Withholding base** → `payout_amount`, the vendor payout after commission
  (2026-09-11, user).
- **D2 — Informational or deducted** → Deducted from the manual transfer; the platform
  only records (2026-09-11, user).
- **D3 — Where it appears** → Modal + printed sheet with totals, not a table column
  (2026-09-11, user).
- **D4 — "Main payouts table"** → Ready to pay; fee and gross hide together at ≤780px
  (2026-09-11, user).
- **D5 — Reversed** → "—" for withholding and net, display only (2026-09-11, user).
- **D6 — Where the calculation lives** → ~~Command only~~ *(superseded 2026-09-11)* →
  **Calculated and saved by the database at payment** (2026-09-11, user).
- **D7 — Bank details** → Masked always; decrypt on "Show full details" (2026-09-11, user).
- **D8 — Already-paid payouts** → Apply to all buckets except Reversed; the backfill
  includes them (2026-09-11, user).
- **D9 — Configurable** → Rate and base, default 1% / 50%, on Settings → Platform Fee
  (2026-09-11, user).
- **D10 — Migration defaults 1.00/50.00, not 0** (2026-09-11, plan author). Override at
  approval to start production at 0; then every "to transfer" figure overstates until
  it is set, and the backfill records 0.
- **D11 — Settings table** → Columns on the existing `platform_fee_settings` singleton
  (2026-09-11, plan author).
- **D12 — Net payout** → Generated `STORED` column (2026-09-11, plan author).
- **D13 — Bucket totals** → The RPC returns withholding and net; Ready to pay's card
  shows "to transfer" (2026-09-11, plan author).
- **D14 — Payout corrections** → **Yes: commission and withholding, any bucket including
  paid ones, one payout at a time** (2026-09-11, user). **Architecture change:** the
  ledger is no longer strictly immutable; money figures change only via the logged,
  reasoned RPC, and the docs change to say so (I7). Accepted consequences:
  - commission corrections are visible to vendors, without notice
  - a corrected paid payout's record no longer shows what was actually transferred
    (the log does)
- **D15 — Correction log grants** → Append-only: `select` for authenticated (RLS: Command
  only); `select, insert` for service_role; no update/delete for anyone (2026-09-11,
  plan author). Follows the documented `vendor_payout_method_log` precedent rather than
  AGENTS.md's general "service_role full DML" rule, because append-only is the point.
  Override at approval if you want the general rule.
  **Revised 2026-09-11:** the precedent it cited was not append-only either. Grants only
  add; the schema's defaults had already given `service_role` everything. D15 is now
  achieved by `20260911000003`'s explicit `revoke all` (B6), not by the grant alone.
- **D16 — What a correction takes** → Rates only (commission %, withholding rate %,
  base %). Amounts are recomputed by the shared functions and previewed by the server
  (2026-09-11, plan author, following D14's chosen option). Hand-typed amounts were the
  rejected alternative.
- **D17 — Safeguards** → B5's prevent/recover/detect set, including the emergency
  rollback that sets defaults rather than just restoring the function (2026-09-11, user
  approved the set; the emergency detail is the plan author's).
- **D18 — Two migrations** → Withholding (`000001`) and corrections (`000002`), so they
  can be reviewed and rolled back separately (2026-09-11, plan author).
- **D19 — Rollback as three files, not sections** → `A-emergency`, `B-full-revert`, and
  the corrections revert (2026-09-11, plan author, during stage 2). A file with two
  sections gets run whole by mistake, and running Section B during an incident would
  destroy every withholding figure.
- **D20 — Fixing the append-only gap (B6)** → **A new migration `20260911000003`, not
  an edit to the already-applied `000002`; and fix all four logs in this plan, not just
  the new one** (2026-09-11, user). The first keeps the rule that applied migrations are
  never edited. The second was approved after the audit found no code that would break.

---

## DEFERRED / COSMETIC
- **Tell vendors when a commission correction changes their payout.** A notification, a
  "corrected" marker, or an explanation on their transaction row. Vendor-app work, so
  its own plan. Until then, vendors see changed figures with no notice (D14).
- **Vendor apps showing withholding and net.** Read-only: select
  `withholding_amount, net_payout_amount`. Cross-app.
- **A "corrected" marker on the printed ledger.** Embed a correction count in the bulk
  query.
- **Optimistic concurrency on corrections.** Two staff correcting the same row at once:
  the second saves over the first. Both are logged with their true `from` values, so
  nothing is hidden; a "values changed since you reviewed" check can come later.
- **A confirmation on the commission rate save**, matching I5. Same exposure, not
  requested.
- **The webhook records a failed payment only in a log.** A reconciliation job for
  paid-but-unconfirmed bookings protects every payment, not just this change. Booker
  plan.
- **Owed back totals stay vendor payout**; the masked "Pay to" line is as of page load;
  release is not blocked for vendors with no payout details; the tab is still labelled
  "Platform Fee".
- **Pre-existing, not touched:** the in-render sample maths in
  `PlatformFeeSettingsPage.tsx:27-29`, `PayoutTable.tsx:26`'s duplicate Paid/Released
  rule, the fixture's static `style={{}}`, and `DeleteConfirmModal`'s inline styles.

---

## Stage detail (Phase A of the ORDER OF EXECUTION)
**The full sequence, including your steps and stop points, is "▶ ORDER OF EXECUTION" at
the top.** This list is only what each of my stages contains. Default cadence: one
stage, then stop and report.

1. **I1**, Ezzy fee column (+ spec #6, fixture on `usePayoutFilters`). No gate.
2. **B1 + B4 + B5 files:** both migrations, the SQL test, both rollback scripts.
   **Stop: you run U1.** Nothing that reads the new columns is written before local has
   them.
3. **I4 (service fields) + B2 + B3, coupled:** screen, cards and print go net together.
   Unit test, specs #2 and #9, print preview.
4. **I5**, withholding settings card + confirmation (+ specs #10–#12).
5. **I3**, extract `VendorPayoutDetails`.
6. **I4 (row click) + I2**, the modal (+ specs #1, #3–#5, #7, #8).
7. **I8**, the correction form (+ specs #13, #14). Needs the modal and migration 2.
8. **I7**, docs.

Then Phases B and C of the ORDER OF EXECUTION, which are yours.

---

## Verification
| Item | Check | Kind |
|---|---|---|
| all | `npx tsc --noEmit`; `npm run lint` (no *new* errors; 20 pre-existing `any`s known); `npm run build` | machine |
| B1/B4/B5 | SQL test (incl. `plpgsql_check` zero findings) + both existing SQL tests pass | **needs live DB** (you, U1) |
| B1 | U2 step 4 queries (local, staging, prod) | **needs live DB** |
| B1/B4 | `information_schema.role_table_grants` for both tables and the log match D15; RPC `execute` grants present | **needs live DB** (read-only) |
| B5 | Rollback Section A run against a **local** copy restores payments (flip `is_paid` succeeds) | **needs live DB** (you, optional but recommended) |
| B5 | Staging test payment; prod smoke check; no `is_paid write FAILED` | **needs live env** (you) |
| B2 | Unit test; "transfer" grep; spec #9 | machine |
| B2 | `grep -rnE "0\.005\|\* ?0\.5\b\|\* ?0\.01\|round\(" command/components/payouts command/services` finds no money formula | machine |
| B3 | Spec #2; print preview fits and adds up | machine + **browser** |
| I1 | Spec #6; labels align at 900px and ≤780px | machine + **browser** |
| I2/I8 | No `style={{` in new dirs; each has `.tsx` + hook + `.module.css`; light/dark at 900px and 400px | machine + **browser** |
| I2/I3 | Spec #7; Vendors page open → exactly one `vendor_payout_view_log` row | machine + **live DB** |
| I5 | Specs #10–#12; a real save updates the row and the shared "last changed" | machine + **live DB** |
| I8 | Specs #13–#14; U2 step 8 (figures match review, log row, vendor apps show the change) | machine + **live env** |
| I6 | Every Playwright suite, full output, never piped through `tail` | machine |
