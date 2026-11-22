# Affiliate feature — plan 1 of 3: the data layer

**Date:** 2026-11-14
**App / scope:** `backbone/` (five migrations, one SQL test file, `seed.sql`, the
`send-notification-email` Edge Function) and **one file in `vendor/`**
(`lib/referralLookup.ts` + a test). ⚠️ **Cross-app:** backbone + vendor ship together (P5
approved this split). No `command/`, `affiliate/` or `booker/` code changes.
**Status:** IN PROGRESS — approved 2026-11-15; stage 1 ✅ verified locally 2026-11-21 (M1–M7, T1
105/105); stage 2 ✅ (E1, deno 42/42); stage 3 ✅ (V1; L1 parked);
stage 4 (staging) next — release: staging ⬜ · production ⬜

> The database half of the affiliate feature: who can read what, the commission ledger, the
> referral-code history, payout details and withdrawals, plus the settings that switch it all
> on. Theme to optimise: **every peso traceable, every rule in the database, nothing switched
> on by a migration.** Plan 1 must be safe to release alone: with the tax rate and the minimum
> unset (Q41, Q45) it calculates nothing and allows no withdrawal.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** M# = migration · E# = Edge Function item · V# = vendor item ·
> T# = test item · L# = local seed item · D# = decision · F# = finding (verified fact) ·
> R# = read-only pre-check the user runs · S# / P# = staging / production release step.
> Q# and P5/P6 refer to the **discovery log** (`2026-11-02-affiliate-dashboard-discovery.md`);
> "command F2" etc. refer to the Command preview's README findings. All other numbers are
> local to this plan.

Predecessors: `2026-09-17-affiliate-referral-codes-interim.md` (attribution, live since
2026-09-19), `2026-11-02-affiliate-app-setup.md` (COMPLETE), the discovery log (closed
2026-11-14). Successors: plan 2 (`command/`), plan 3 (`affiliate/`), not yet written.

---

## ▶ RESUME HERE (updated 2026-11-21, end of stage 3)

- **Done so far:** planning and approval (2026-11-14/15). **Stage 1 ✅ (2026-11-21):** M1–M6
  plus the corrective **M7** (`20261121000001_fix_referral_code_verdict.sql`, F19) applied locally
  by the user; **T1 105/105 PASS**, `db lint` clean, the share plan's `public_offering_rpc_test.sql`
  6/6 after M6 (its F15). T1 harness defects fixed along the way (F20). One cosmetic warning (F21).
- **Live where:** local — M1–M7 applied · staging — none of this plan (at `20261117000001`) ·
  production — none of this plan (at `20261117000001`).
- **Files:** `backbone` branch `feature/affiliate_portal_groundwork` (rebased onto `develop`,
  `54ffbf0`). M1–M6 and T1 are in commit `50bcdd9`; **M7 and the T1 fixes are uncommitted**
  (the user commits).
- **Stage 2 ✅ (2026-11-21):** E1 — the receipt template, registry entry, five types; `deno test`
  42/42 (F22). Uncommitted in `backbone/` (the user commits). Live local send not run (F22).
- **Stage 3 ✅ (2026-11-21):** V1 done (vendor tests 609/609, lint and tsc clean; real
  function checked by SQL). L1 ⏸ parked to plan 3 by the user (F23). V1 is **uncommitted** on
  vendor branch `release/version-0.62.1` (which also carries someone else's `AGENTS.md` edit):
  move it to a feature branch before committing.
- **Next:** **stage 4 — staging release** (all 👤): first F18 step 2 on staging
  (`npx supabase migration list --remote`; only `20261118000001`–`06` and `20261121000001`
  pending), check `functions deploy` flags under CLI 3.2.0, then S1 `db push --remote`, S2 deploy
  `send-notification-email`, S3 deploy vendor, S4 staging checks. ⛔ Order: migrations before the
  vendor deploy (safe-pause table). Do **not** run `migration repair` or `--include-all`.
- **Watch out for:**
  - `booking_transactions.payout_status` is **not** a usable commission signal: it stays
    `released` when a released booking is later refunded or disputed (F1). Commission keys on
    `bookings.status`, priced from `booking_transactions`.
  - Deploy order on each environment is **migrations → Edge Function → vendor**. A vendor
    build with the new lookup on a database without `resolve_referral_code()` silently stops
    crediting **every** referral (safe-pause table, Release).
  - Setting the affiliate tax rate is a **one-way switch**: it stamps the go-live time and
    cannot be cleared afterwards (M1, D1). Do not set it on production in this plan.
  - The user applies every migration (memory: user runs migrations).

---

## Scope

**In:** the `affiliate` portal row and its email switch; affiliates reading their own rows and
a limited vendor view (Q12); the commission ledger with its status log and adjustments (Q2,
Q4a–c, Q4e, Q5, Q7, Q8, Q11, Q20, Q24, Q25, Q34–Q36, Q41, Q42); referral-code history and the change functions (Q16, Q22 as amended by D4); affiliate payout methods (Q17, Q26,
Q32); withdrawals (Q42–Q50); the tax-rate, default-rate and minimum settings (Q34, Q35, Q45);
the five new notification types and the receipt email (Q38, Q49); attribution-change
functions (Q18, Q19, see D8); the vendor lookup so old codes resolve (F11 of the discovery log).

**Out (plan 2, `command/`):** every Command screen — Affiliates section, withdrawals queue,
payout-details entry and the decrypting "show full details" route, Settings card, rate override
and staff flag dialogs, attribution dialogs, the Users-page `affiliate` portal chip and
`PORTAL_URL_AFFILIATE`, the set-password invite (Q10), the pre-launch import (Q39), removing
the "old links stop working" warning (Q16d), mapping the new database errors to messages.
**Out (plan 3, `affiliate/`):** every affiliate screen, the hand-written TypeScript interfaces
for the new tables and functions, the notification panel. **Out entirely:** the 7-day refund
policy (P2, parked by the user), the "unusual patterns" report (Q21), affiliate self-entry of
payout details (Q17), PESONet files for affiliates (Q33, superseded).

## Assumptions (stated, not confirmed)

1. **Production data is like local**: a handful of affiliates, `vendor_referrals` snapshots
   that match each affiliate's current code. R2 checks it; if wrong, M2's backfill changes.
2. **Nobody has been granted an `affiliate` portal by SQL** on any environment. It cannot
   exist yet (no portal row), so this holds by construction until M1.
3. **The affiliate app is not deployed to production** (setup plan: local + repo only), so
   granting the portal on production in this plan would open nothing usable. Plan 3 deploys it.
4. **Staging may have the tax rate set during S4** (to exercise the ledger); that permanently
   stamps staging's go-live time. Production is left unset. The user decides at S4.

---

## Findings (verified 2026-11-14)

### F1 — `payout_status` cannot drive commission  📝
`sync_booking_payout_status()` (`backbone/supabase/migrations/20260801000003_booking_payout_status.sql:63-96`)
never downgrades `released`: a booking refunded or disputed after the vendor was paid keeps
`payout_status = 'released'`. A commission trigger on `payout_status` would miss exactly the
refund-after-payment case that Q4a (write-off) is about. **So commission hangs off
`bookings.status` transitions (AFTER UPDATE trigger), and is keyed and priced from the
`booking_transactions` row** — never the webhook, never `payout_status`. "The booking
completed" = the transition into `bookings.status = 'completed'` (any actor: booker, vendor,
the hourly auto-acknowledge job, Command). The 7-day clock reads a snapshot `earned_at` written
on the line at that moment, not `bookings.status_changed_at`, which moves again on any later
transition.

### F2 — The new trigger can link to the booking's status-log row  📝
AFTER ROW triggers fire alphabetically. `bookings_log_status_change`
(`20260516000006_booking_status_log.sql:82`) sorts before the proposed
`bookings_sync_affiliate_commission`, so the `booking_status_log` row for the same transition
already exists and its id can be stored on the commission status log (Q20: "write-offs linked
to their refund"). `booking_status_log_booking_id_idx` exists (checked on local DB).

### F3 — Any active user can already read active vendors' full rows  ⚠️ pre-existing
`20260515000001_booker_vendor_read_policy.sql:11-17` gates the booker browsing policy on
`is_active()` alone, so an affiliate with a session can read active vendors' phone and email
through the raw API. `auth-and-roles.md:419-424` records this as an accepted residual risk, but
Q12 says affiliates see **no vendor contact details**, and affiliates now get sessions by
design. Plan 1 does not widen it (affiliates read vendors only through `affiliate_my_vendors()`)
and does not fix it (the fix changes the booker browsing policy: cross-app). → **D15**.

### F4 — Command's existing code routes keep working, with one degraded message
`command/app/api/affiliates/route.ts:178-185` (POST) maps `23505` to "code taken" when the
message contains `referral_code`; PATCH (`:221-223`) maps any `23505` to it. M2's registry
primary key is named `affiliate_referral_codes_referral_code_pkey`, so a code reserved to
someone else surfaces as the same "taken" message on both routes. (There is no blocked-word
error since D4.)

### F5 — Plan 1's portal row is not grantable from Command's UI
Command's portal list is a constant (`command/lib/constants.ts`, used by `UserModal` /
`UserToolbar`), not a query, so the `affiliate` portal appears nowhere in Command until plan 2.
Plan 1 is inert for access.

### F6 — The email function sends new types before any redeploy, but generically
`lib/templates/registry.ts:14-16` falls back to `renderGeneric` for any unknown type, and
`types.ts:5-13` says the union is documentation only. Four of the five new types are fine as
generic (title + body). The **completed-withdrawal receipt** needs a bespoke template (Q49
"with the receipt"), so the function must be redeployed before the first withdrawal is
completed (which cannot happen before plan 2 anyway).

### F7 — Email and push switches treat a missing portal row differently
`settingsGate.ts:220-221`: missing `notification_email_settings` row → email **enabled**.
`schema.md` (`notification_push_settings`): missing row → push **disabled**. M1 inserts an
email row (so Command's switch page can show it); no push row (the affiliate portal has no
mobile app).

### F8 — `notifications.portal` is an FK to `portals(name)`
So the portal row must exist before any affiliate notification is inserted. M1 runs first.

### F9 — Local data has no history collisions
Local DB (read-only, 2026-11-14): codes `NINA2026`, `LIZA2026`; the one `vendor_referrals` row
uses `NINA2026` and its owner matches. Production is checked by R2.

### F10 — Corrections record their actor
`correct_booking_transaction()` writes `corrected_by = auth.uid()`
(`20260911000002_payout_corrections.sql:200`), so a BEFORE INSERT trigger on
`booking_transaction_corrections` can enforce Q8 (no fee correction on your own commission)
without editing that function.

### F11 — Commission amounts are tiny, so rounding rules matter
At 1% of the after-tax fee, a ₱100 booking earns ₱0.10 and a ₱10 booking ₱0.01. The plan
rounds twice, to the centavo, matching the approved preview: after-tax fee
`round(fee × (100 − tax) / 100, 2)`, then share `round(after_tax × rate / 100, 2)`. ₱1,600 →
fee ₱176.00 → ₱154.88 (12% tax) → ₱1.55. A share that rounds to ₱0.00 still gets its line
(Q20: one line per paid booking).

### F12 — The vendor lookup is one call site
`resolveReferralCode()` is called only from `vendor/app/api/auth/register/route.ts:91`. Its
fail-soft contract (`vendor/lib/referralLookup.ts:12-21`) is kept.

---

### F13 — The partial index does not cover adjustment lines' FK  ✅ DONE (written into M4, 2026-11-18)
`affiliate_commissions_one_per_transaction` is `where kind = 'earned'`, so it cannot serve the
`transaction_id` lookup that the `on delete restrict` FK needs for adjustment lines (and
manual lines have no transaction). M4 adds a full `affiliate_commissions_transaction_idx`.
Verified statically only; T1 does not test index use.

### F14 — Trigger and helper functions that write restricted tables must be SECURITY DEFINER  ✅ DONE (written, 2026-11-18)
The plan names SECURITY DEFINER for the Command and affiliate functions, not for the trigger
functions (`affiliate_referral_code_guard`/`_record` in M2; the booking and correction triggers
and the notification helpers in M4). Their tables have no write grant for any API role, so
without definer rights a `service_role` write to `affiliates` would fail inside the trigger.
All are written as definer with `set search_path = public`. Confirm in T1 and on apply.

### F15 — Choices the drafts left open, for review (not decisions)  📝 for review
Made while writing the SQL, where the plan is silent or only sketches the behaviour:
(a) `affiliate_commission_resting_status` returns `held` for any booking status other than
completed, disputed, refunded or cancelled (the cautious default). (b) `command_open_withdrawal`
notifies the affiliate with the "received" message; the plan did not say. (c) `credit_vendor_referral`
requires an active referrer, the same rule as the M5 move. (d) Notification titles were written
here (the plan gives bodies only); the completed-receipt body uses `payout_statement_peso()`, so it
reads "₱ 5.85" (with a space) rather than the plan's illustrative "₱5.85". (e) Helpers added that
the plan does not name: `affiliate_assert_affiliate_caller`, `affiliate_normalise_code`,
`affiliate_lock_claimable_lines`, `affiliate_move_lines`, `affiliate_notify_affiliate` and
`affiliate_notify_command_admins`. (f) A CHECK on the commission status log's `to_status`.
(g) `affiliate_my_vendors` shows `referral_code` only while the caller is the current referrer.
(h) `set_affiliate_terms` and `set_affiliate_payout_method` are replaced in M4 (the plan's
intent), keeping their grants. Each is small; the user can overrule any of them.

### F16 — Local database state, read-only (2026-11-18)  ✅ DONE (verified by read)
`supabase_migrations.schema_migrations` latest version `20261111000001`; `portals` = vendor (1),
booker (2), command (3) only; `to_regclass('public.affiliate_withdrawals')` is NULL. So nothing
of stage 1 is applied. The existing seed has affiliates `NINA2026` (nina) and `LIZA2026`, one
referral (vendor 1 → nina), 16 paid confirmed bookings at vendor 1, and one unpaid pending booking.
These are the fixtures T1 relies on.
**Superseded 2026-11-21 (re-read):** the local DB's latest version is now `20261117000001`
(the share plan's migration). Still nothing of stage 1 applied; `portals` unchanged.

### F17 — Verification of stage 1 needs the user's local apply  ✅ DONE (2026-11-21) — user applied M1–M7 locally; T1 105/105, db lint clean, share test 6/6
T1 and `npx supabase db lint` cannot run until M1–M6 are applied locally. Until T1 exits 0, the
migrations and T1 stay 🔄 and stage 1 is not verified. Not run by the agent: any database write
(no `migration up`, `db reset`, psql DDL or DML). Also pending: the status-validator trigger is
disabled inside T1's transaction (its own rules are covered by `booking_transitions_test.sql`).

### F18 — Paused for the offering-share plan: re-check migration order before resuming  🔄 IN PROGRESS (added 2026-11-19)

**Status 2026-11-21:**
- **Step 1 ✅** — rebased: `feature/affiliate_portal_groundwork` is `50bcdd9` on `develop`'s
  `54ffbf0`; folder order `20261117000001`, then `20261118000001`–`06`. Verified by
  `git log` and `ls` 2026-11-21.
- **Step 2 🔄 — local ✅ 2026-11-21** (`migration list`, target local: every version through
  `20261117000001` paired, `20261118000001`–`06` pending, nothing applied-only; rebase also
  re-verified — `develop` = `origin/develop` = merge-base `54ffbf0`, one commit on the branch,
  adding exactly the six migrations and T1, clean tree, no duplicate versions). **Staging and
  production still the user's**, before stage 4: with **CLI 3.2.0** the commands are `npx supabase migration list`
  (local), `--remote` (staging) and `--remote=<prod-ref>` (production). `--linked`, named in
  step 2 below, is no longer listed in 3.2.0. Confirm M1–M6 are unapplied everywhere.
- **Step 3 ✅ / step 4 not needed** — every environment's newest version is `20261117000001`,
  older than `20261118000001`, so no rename (local verified by read; staging and production per
  the share plan's release record, to be confirmed by step 2).
- **Step 5 ✅** (re-read 2026-11-21) — the share migration only adds the definer function
  `get_public_offering(uuid)`: no table, column, policy or grant. Because it is definer, M6's
  narrower `vendors` policy cannot change what it returns. It also notes that this project's
  default privileges grant EXECUTE on new functions **directly** to `anon` and `authenticated`
  (`20261004000002`); checked that M1–M6 revoke from `anon` everywhere, from `authenticated`
  on `resolve_referral_code` and every internal helper, and that the two functions M4
  replaces (`set_affiliate_terms`, `set_affiliate_payout_method`) keep M1/M3's grants under
  `create or replace`.
- **Added by the share plan (its F15):** after applying M1–M6 locally, re-run
  `backbone/supabase/tests/public_offering_rpc_test.sql`.
- **Do not** run `migration repair` or `--include-all`. `stash@{0}` (kiosk-qrph
  `20261110000001`) is unrelated and would need `--include-all` if restored; leave it.
On 2026-11-19 the user committed M1–M6 and T1 (unapplied) on `backbone` branch
`feature/affiliate_portal_groundwork` and paused this plan for
`.plans/2026-11-19-offering-share-links.md`, which adds one migration
(`get_public_offering`) on a branch cut from `develop`. The two sets are independent
(that plan's F15: no shared tables or function names), so only **ordering** can go wrong.
The CLI refuses a file older than the newest applied version unless `--include-all` is passed.

**Before applying M1–M6 anywhere, in this order:**
1. **Rebase this branch onto `develop`** (the user's chosen sequence, 2026-11-19: the share plan
   merges to `develop` and deploys everywhere first). The share plan's migration is
   `20261117000001_public_offering_rpc.sql` (its D11), which sorts before M1–M6, so after the
   rebase the folder order matches every environment's history. M1–M6 only add new files, so
   no conflicts are expected. **Rebase before any `migration` command on this branch.**
   Un-rebased, the folder lacks `20261117000001` while the database has it, the CLI reports it
   remote-only and suggests `migration repair`. Do not repair. If this branch has been pushed
   by then, the rebase needs `git push --force-with-lease` (it had no remote on 2026-11-19).
2. **Find the newest applied version in every environment:** `npx supabase migration list`
   (read the `Target:` line; local by default), `--linked` (= staging) and
   `--project-ref <prod>`. Also confirm M1–M6 are applied **nowhere**. Renaming is only safe
   while that holds.
3. **If every environment's newest applied version is older than `20261118000001`**: nothing
   to do. This is the expected case, since the share plan uses `20261117000001`. Apply as planned.
4. **If any environment has a newer version** (the share plan used `20261119000001`, or
   another plan landed later): rename M1–M6 to fresh versions after the newest one, keeping
   their order and their name suffixes. Do not change their SQL. Then update the version
   references, all of them comments or docs: the `Must run after:` headers in M2–M6, T1's
   header line, and this plan's file list (RESUME HERE, M1–M6 items, Execution order). Grep
   for the old prefix to confirm none remain. (The alternative, `--include-all` with
   `--dry-run` in each environment, also works but leaves the history order different from
   the file order on every environment; renaming is cleaner.)
5. **Re-read M1–M6 against any schema that changed in between**, particularly `vendors`
   policies (M6 replaces "active users can read active vendors") and anything new on
   `vendors`, `bookings` or `booking_transactions`. Then continue with F17: apply locally,
   run T1 and `db lint`.

The rename is mechanical; the user may ask an agent to do steps 4–5. "Regenerating" the SQL
from scratch is **not** recommended: it discards reviewed content for no gain.

### F19 — M2 bug: `referral_code_verdict()` declares `v_held uuid` for a text code  ✅ DONE (2026-11-21) — M7 applied locally by the user; db lint clean, T1's code cases pass
Found by `npx supabase db lint` after the user applied M1–M6 locally (2026-11-21), and confirmed
at runtime by T1 (`invalid input syntax for type uuid: "NINA2026"`, T1 line 618).
`20261118000002_affiliate_referral_codes.sql`, `referral_code_verdict()`: `v_held` is declared
`uuid` but receives `affiliates.referral_code` (text), then is compared with the text `v_code`.
Effect: every code check or change that gets past the "taken" test raises, so
`check_my_referral_code`, `change_my_referral_code` and `change_referral_code` fail for every
free code. M2 is applied (locally only), so it is not edited (core rules): the fix is a new
corrective migration **M7** replacing the function with `v_held text`. **Approved by the user
2026-11-21; written** as `backbone/supabase/migrations/20261121000001_fix_referral_code_verdict.sql`
(60 lines): M2's body copied verbatim, `diff` against M2 shows only `create` → `create or replace`
and `uuid` → `text`; same signature, still no API grant. **Pending:** the user applies it locally,
then T1 and `db lint` are re-run. Not ✅ until T1 exits 0. Staging and production get M1–M7 together,
so the bug never reaches them.

### F20 — T1 harness fixes  ✅ DONE (2026-11-21)
Two defects in `backbone/supabase/tests/affiliate_data_layer_test.sql`, both test-only:
(1) the static step ran `plpgsql_check` on `resolve_referral_code`, a `LANGUAGE sql` function,
which aborted the file on line 272; it is removed from the static list (its behaviour cases
still cover it). (2) `pay()` / `unpay()` ran `enable trigger user`, which also re-enabled the
status validator the fixtures had disabled, so the first `set_status()` failed; each now
disables the validator again. Verified by re-running T1: it now passes both points and stops
only at F19.
Three more test-only defects found once T1 ran to the end (2026-11-21): (3) the payout-details
fixture passed a bare `1` where `set_affiliate_payout_method` takes `smallint`, so the call never
matched and its result was discarded; every withdrawal case after it failed for that one reason
(now `1::smallint`; PostgREST passes typed arguments, so app calls are unaffected). (4) The two
"reads none of another person's rows" RLS cases, run as nina, excluded **root's** id instead of
nina's, so nina's own rows were counted. **Not a leak:** the policies scope to `auth.uid()` and
the "reads her own lines" case passed. (5) The D6 case ran the reject and checked the row in one
statement, which cannot see the function's own change (one snapshot per statement); split in two.
Final run: **105/105 PASS**.
 Also run 2026-11-21: `public_offering_rpc_test.sql` **6/6 PASS** after M1–M6
(share plan F15 ✅); `db lint` reports only F19.

### F21 — Unused variable in `sync_affiliate_commission()`  📝 cosmetic (2026-11-21)
`plpgsql_check` warns `unused variable "v_log_id"` (M4, applied). Harmless; fixing it would need a
migration of its own. Fold into the next migration that touches this function, if any.

### F22 — Stage 2 notes  📝 (2026-11-21)
- **Receipt fixture is captured, not hand-written:** a real `affiliate_withdrawal_completed`
  notification from `command_complete_withdrawal()` on the local DB, in a rolled-back
  transaction (two completed bookings, one manual line, one booking refunded mid-processing →
  one written-off line). Database left unchanged (verified by count).
- **Files:** new `lib/templates/affiliateWithdrawalReceipt.ts`; `registry.ts` (one entry);
  `types.ts` (five types, documentation union); `handler.test.ts` (+11 tests); `README.md` (one
  line). The other four types render generic, as planned.
- **Not run:** a live send through `supabase functions serve` + `local_smtp`. It starts a local
  service, so it waits for the user's go-ahead; the first real check is then staging (S4).
- **Pre-existing, not touched:** `deno lint` flags `jsr:@std/assert@1` on `handler.test.ts:5`
  (`no-import-prefix`); the README's template list already omitted `kioskBookingConfirmed.ts` /
  `payoutStatement.ts` and says generic "covers all 7 types".
- **Tooling slip, disclosed:** a lookup ran `npx --yes deno --version`, which fetched the npm
  `deno` package into npx's cache (outside the workspace). No app changed; `~/.deno/bin/deno`
  (2.9.6) was used for every test.

### F23 — L1 as planned would break tests and write no lines  ✅ resolved by parking L1 (2026-11-21)
Found while starting stage 3 (read of `backbone/supabase/seed.sql` and the SQL tests):
1. The seed inserts bookings **already `completed`** (Block 9b, `seed.sql` ~1325–1375), and
   nina's referral is created last (Block 10, ~1547). The commission trigger fires on a status
   **transition**, so seeding a tax rate would still write **no lines**.
2. T1 asserts the tax rate **starts unset** (`affiliate_data_layer_test.sql:230`), and D1 makes
   the tax rate unclearable once set, so a seeded tax rate breaks T1 after every `db reset`.
3. `payout_statements_test.sql:145` and `withholding_and_corrections_test.sql:129` delete
   ledger rows; a commission line on one would block that (`on delete restrict`).
**Decision (the user, 2026-11-21):** park L1 to plan 3, which adds an opt-in `supabase/demo/`
script for affiliate fixtures and leaves `seed.sql` and the tests untouched. D16's "(a) yes" is
superseded by this. Plan 1 needs no seed fixtures: T1 builds its own.

## Open questions from the discovery log — answered

| Discovery question | Answer |
|---|---|
| Which event is "booking completed"; how it relates to `payout_status`; where the 7-day clock reads | F1: the `bookings.status → completed` transition. `payout_status` is not used. The clock reads `affiliate_commissions.available_at = earned_at + 7 days`, written once on the line. "Available" is derived (`status = 'earned' and available_at <= now()`), so **no cron job** is needed. |
| How go-live (Q36) and the unset tax rate (Q41) gate the first line | M1: `affiliate_commission_live_from` is stamped by a trigger the moment the tax rate is first set, can never change, and a CHECK forbids clearing the tax rate afterwards. A line is written only when the booking's **first** completion happens at or after that time. No completed booking can fall into a gap. → D1, D13 |
| Command F2 / F4 (Start processing drops a line; reject after processing) | They shape plan 1's functions, so they are asked here: **D5, D6**. |
| Paying a suspended affiliate | They cannot sign in, but Command can open a withdrawal on their behalf (`command_open_withdrawal`). Whether the minimum may be waived beyond Q50b's account-closure case → **D7**. |
| The reserved/blocked word list | **None** — the user dropped blocking (D4, 2026-11-15). |
| New notification types, Edge Function redeploy, portal row | M1 (portal + email row), M2/M4 (five types), E1 (receipt template + redeploy). |
| Vendor lookup resolves old codes | V1, via `resolve_referral_code()` from M2. Ships after M2 on each environment. |

---

## The functions plans 2 and 3 will call

Every function below is `SECURITY DEFINER`, `set search_path = public`, `revoke execute … from
public, anon`, then granted as listed. "Affiliate caller" = active profile **and** `affiliate`
portal **and** an `affiliates` row. "Command caller" = active **and** `command` portal **and**
admin or root, **and never acting on their own affiliate account** (Q8; one internal helper,
`affiliate_assert_command_actor()`, enforces both).

| Function | Caller | Migration | Purpose |
|---|---|---|---|
| `affiliate_balance(p_user_id uuid default null)` | affiliate (self) or Command | M4 | The **only** definition of the balance buckets + `withdraw_blocker` |
| `affiliate_my_vendors()` | affiliate | M4 | Q12 vendor list + Q25 earned to date |
| `affiliate_my_upcoming(p_limit int default 100)` | affiliate | M4 | Q4e estimates (no line exists yet) |
| `check_my_referral_code(p_code text)` | affiliate | M2 | Live check for the Settings form |
| `change_my_referral_code(p_code text)` | affiliate | M2 | Q16b self-service change |
| `affiliate_request_withdrawal()` | affiliate | M4 | Q43, Q44, Q46 |
| `affiliate_cancel_withdrawal(p_withdrawal_id uuid)` | affiliate | M4 | Q44, while Requested |
| `set_affiliate_terms(p_user_id, p_rate_percent, p_is_staff)` | Command | M1 | Q7 override, Q48 staff flag |
| `change_referral_code(p_user_id uuid, p_code text)` | Command | M2 | Q16d, no 30-day limit |
| `set_affiliate_payout_method(…)` | Command | M3 | Q17, Q26, Q32 (D9) |
| `command_open_withdrawal(p_user_id, p_reason, p_waive_minimum)` | Command | M4 | command F3, Q50b (D7) |
| `command_start_withdrawal_processing(p_withdrawal_id)` | Command | M4 | Q44, command F2 (D5) |
| `command_complete_withdrawal(p_withdrawal_id, p_transfer_reference)` | Command | M4 | Q44, Q49 receipt |
| `command_reject_withdrawal(p_withdrawal_id, p_reason, p_transfer_failed)` | Command | M4 | Q44, command F4 (D6) |
| `command_record_payroll_payment(p_user_id, p_reference, p_paid_on)` | Command | M4 | Q30, Q48 |
| `command_add_commission_adjustment(p_user_id, p_amount, p_reason)` | Command | M4 | Q36 one-off promise |
| `change_vendor_referrer(p_vendor_id, p_user_id, p_reason)` | Command | M5 | Q18 (D8) |
| `credit_vendor_referral(p_vendor_id, p_user_id, p_reason)` | Command | M5 | Q19 (D8) |
| `resolve_referral_code(p_code text)` | **service_role only** | M2 | V1: the vendor register route |

Plain RLS reads (SELECT only, own rows for the affiliate, all rows for Command):
`affiliates`, `affiliate_referral_codes`, `affiliate_referral_code_changes`,
`affiliate_payout_methods`, `affiliate_commissions`, `affiliate_withdrawals`. Command only:
`affiliate_commission_status_log`, `affiliate_payout_method_log`, `affiliate_payout_view_log`,
`vendor_referral_changes`. The settings stay readable by every authenticated user, as today.
**Nothing an affiliate can read carries booker data**: lines snapshot booking date, amount and
fee; they hold a `transaction_id` (an opaque id the affiliate cannot dereference) and never a
`booking_id`, booker id, name or reference.

---

## MIGRATIONS (each an approval gate — drafted, not written)

Filenames get timestamps after the latest (`20261111000001`) when written, in this order:
`…_affiliate_portal_and_settings`, `…_affiliate_referral_codes`, `…_affiliate_payout_methods`,
`…_affiliate_commissions_and_withdrawals`, `…_vendor_referral_changes`,
`…_vendor_read_requires_booker_portal`. Comments, `comment on`
statements and full error wording are written at execution; the SQL below is the shape to
approve.

### M1 — Affiliate portal, settings, own-row read, terms  ✅ DONE (2026-11-21) — applied locally by the user; verified by T1 105/105 and `db lint` clean (machine, local). Staging and production: not applied.

```sql
-- 1. Portal row (Q6). Expected id 4; nothing may depend on the id.
insert into public.portals (name) values ('affiliate');
-- Email switch row for Command's notification settings (F7). No push row on purpose:
-- a missing push row means "push disabled", and the affiliate portal has no mobile app.
insert into public.notification_email_settings (portal, is_email_enabled) values ('affiliate', true);

-- 2. Settings beside the platform fee (Q34, Q35, Q45; D3).
alter table public.platform_fee_settings
  add column affiliate_tax_percent numeric(5,2)
    constraint platform_fee_settings_affiliate_tax_range
    check (affiliate_tax_percent >= 0 and affiliate_tax_percent < 100),
  add column affiliate_default_rate_percent numeric(5,2) not null default 1.00
    constraint platform_fee_settings_affiliate_rate_range
    check (affiliate_default_rate_percent > 0 and affiliate_default_rate_percent <= 100),
  add column affiliate_min_withdrawal numeric(10,2)
    constraint platform_fee_settings_affiliate_min_positive
    check (affiliate_min_withdrawal > 0),
  add column affiliate_commission_live_from timestamptz,
  -- Q41: once commission is live, the tax rate can be changed but never cleared.
  add constraint platform_fee_settings_affiliate_live_needs_tax
    check (affiliate_commission_live_from is null or affiliate_tax_percent is not null);

-- Go-live is stamped by the database, never typed (D1). Ignores whatever the client sends.
create function public.stamp_affiliate_commission_live_from()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.affiliate_commission_live_from is not null then
    if new.affiliate_commission_live_from is distinct from old.affiliate_commission_live_from then
      raise exception 'The affiliate commission start time cannot be changed once set'
        using errcode = '23514', hint = 'affiliate_live_from_pinned';
    end if;
  else
    new.affiliate_commission_live_from :=
      case when new.affiliate_tax_percent is not null then now() end;
  end if;
  return new;
end $$;

create trigger platform_fee_settings_stamp_affiliate_live_from
  before update on public.platform_fee_settings
  for each row execute function public.stamp_affiliate_commission_live_from();

-- 3. Affiliate terms (Q7, Q48; D12).
alter table public.affiliates
  add column commission_rate_percent numeric(5,2)          -- NULL = the default rate
    constraint affiliates_commission_rate_range
    check (commission_rate_percent >= 0 and commission_rate_percent <= 100),
  add column is_staff boolean not null default false;

-- 4. Affiliates read their own row (Q12). Grants unchanged: authenticated already has SELECT.
create policy "affiliates read their own row"
  on public.affiliates for select to authenticated
  using (user_id = auth.uid() and public.is_active() and public.is_portal_member('affiliate'));

-- 5. One caller check for every Command-side affiliate function (Q8).
create function public.affiliate_assert_command_actor(p_target uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_active() and public.is_portal_member('command')
          and (public.has_role('admin') or public.has_role('root'))) then
    raise exception 'Only Ezzy staff can do this' using errcode = '42501';
  end if;
  if p_target is not null and p_target = auth.uid() then
    raise exception 'You cannot act on your own affiliate account'
      using errcode = '42501', hint = 'affiliate_self_action';
  end if;
end $$;
revoke execute on function public.affiliate_assert_command_actor(uuid)
  from public, anon, authenticated, service_role;   -- internal: called by definer functions only

-- 6. set_affiliate_terms(p_user_id uuid, p_rate_percent numeric, p_is_staff boolean) → void
--    assert_command_actor(p_user_id); affiliates row must exist; refuse p_is_staff = true
--    while the affiliate has an open withdrawal (M4 adds that check when the table exists —
--    see M4 §9, which replaces this function); update the two columns.
--    grant execute to authenticated.
```

**Blast radius.**
- *Data:* adds one `portals` row and one `notification_email_settings` row; four nullable or
  defaulted columns on a one-row table; two columns on `affiliates` (default `false` / NULL).
  No existing row is rewritten or can fail validation (new columns are NULL or the default,
  which satisfy every CHECK).
- *Lock:* `ALTER TABLE` takes ACCESS EXCLUSIVE on `platform_fee_settings` and `affiliates`
  (both tiny, metadata-only adds) for milliseconds.
- *Downstream:* Command's Platform Fee save keeps working: it updates `fee_percent` / the
  withholding pair, and the new trigger leaves `live_from` NULL while the tax is NULL.
  ⚠️ Any reader doing `select *` on `platform_fee_settings` now receives four more fields
  (harmless). Hand-written interfaces: plan 2 (Command settings), plan 3.
- *Reversibility:* before go-live, a down migration drops the trigger, function, policy,
  columns and the two rows. After the tax rate is set, the CHECK is the point: fix forward.

### M2 — Referral-code history, blocked words, code functions  ✅ DONE (2026-11-21) — applied locally by the user; verified by T1 105/105 and `db lint` clean (machine, local). Staging and production: not applied.

```sql
-- 1. (No blocked-word list: D4, 2026-11-15.)

-- 2. Every code ever held — reserved to its holder forever (Q16a).
create table public.affiliate_referral_codes (
  referral_code text
    constraint affiliate_referral_codes_referral_code_pkey primary key   -- name matters: F4
    constraint affiliate_referral_codes_format check (referral_code ~ '^[A-Z0-9]{4,32}$'),
  -- FK to profiles, not affiliates: removing the affiliate capability keeps the codes reserved
  -- to the person (restored if they become an affiliate again); deleting the account nulls it,
  -- which retires the code forever (a NULL owner still blocks reuse).
  user_id       uuid references public.profiles (id) on delete set null,
  first_used_at timestamptz not null default now(),
  source        text not null check (source in ('backfill', 'command', 'affiliate', 'import'))
);
create index affiliate_referral_codes_user_idx on public.affiliate_referral_codes (user_id);

-- 3. Append-only change history Command can read (Q16c).
create table public.affiliate_referral_code_changes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  from_code  text,                       -- NULL = the affiliate's first code
  to_code    text not null,
  source     text not null check (source in ('backfill', 'command', 'affiliate', 'import')),
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index affiliate_referral_code_changes_user_idx
  on public.affiliate_referral_code_changes (user_id, changed_at desc);

-- RLS + grants, both tables: Command admin/root SELECT; the affiliate SELECTs own rows
-- (user_id = auth.uid() and is_active() and is_portal_member('affiliate')).
-- Append-only for everyone, service_role included (core rules; 20260911000003):
revoke all on table public.affiliate_referral_codes, public.affiliate_referral_code_changes
  from anon, authenticated, service_role;
grant select on table public.affiliate_referral_codes, public.affiliate_referral_code_changes
  to authenticated, service_role;
-- Writes: only the trigger below and the backfill, both as the table owner.

-- 4. One guard for EVERY write path to affiliates.referral_code — Command's existing service-
--    role POST/PATCH, the plan-2 import, the self-service function (Q16d: one rule for all).
--    BEFORE: format is already a CHECK (no blocked words, D4); claim the code in the registry (insert … on conflict do nothing), then refuse if its owner is not
--    new.user_id (NULL owner = retired = refused). Switching back to your own old code passes
--    (Q22b).
--    AFTER: write the change row; on UPDATE (not INSERT) and source <> 'import', insert the
--    'affiliate_referral_code_changed' notification (portal 'affiliate') if the type is
--    enabled (Q38; D11).
--    source = current_setting('app.referral_code_source', true), set by the definer functions
--    below; anything unset (Command's legacy service-role routes) records 'command'.
--    changed_by = auth.uid() (NULL from the legacy service-role routes — accepted until plan 2
--    moves Command onto change_referral_code()).
create trigger affiliates_referral_code_guard
  before insert or update of referral_code on public.affiliates
  for each row execute function public.affiliate_referral_code_guard();
create trigger affiliates_referral_code_record
  after insert or update of referral_code on public.affiliates
  for each row execute function public.affiliate_referral_code_record();
--  (A trigger WHEN clause cannot mention OLD on INSERT, so both functions return early on an
--   UPDATE whose code did not change.)

-- 5. Backfill (Q16a for codes already in use). R2 must be clean first.
insert into public.affiliate_referral_codes (referral_code, user_id, first_used_at, source)
select referral_code, user_id, created_at, 'backfill' from public.affiliates;

-- Codes overwritten by Command's PATCH before this migration (discovery F10) survive only as
-- vendor_referrals snapshots. Reserve each to its one historical owner; skip any code already
-- held (its current holder keeps it) or seen with two owners (R2 reports both).
insert into public.affiliate_referral_codes (referral_code, user_id, first_used_at, source)
select vr.referral_code, min(vr.affiliate_user_id::text)::uuid, min(vr.created_at), 'backfill'
from   public.vendor_referrals vr
where  vr.affiliate_user_id is not null
group  by vr.referral_code
having count(distinct vr.affiliate_user_id) = 1
on conflict (referral_code) do nothing;

insert into public.affiliate_referral_code_changes (user_id, from_code, to_code, source, changed_at)
select user_id, null, referral_code, 'backfill', created_at from public.affiliates;

-- 6. Functions.
-- normalise: upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g')) — the same rule as
--   vendor/lib/referralCode.ts:37-39 and Command's copy.
-- resolve_referral_code(p_code text) → uuid  STABLE
--   The affiliate a code credits, or NULL: code in the registry → affiliates row exists →
--   profile active. Old codes resolve to their holder (Q16a). grant execute to service_role ONLY.
-- referral_code_verdict(p_user_id, p_code) → text   (internal, no API grant)
--   'invalid' | 'taken' | 'current' | 'too_soon' | 'ok'. 'too_soon' = a change with
--   source 'affiliate' by this user in the last 30 days (Q16b). Imported, backfilled and
--   Command changes never start the clock (Q22a; D11 note).
-- check_my_referral_code(p_code) → table(verdict text, normalised text, next_change_at timestamptz)
--   affiliate caller. grant authenticated.
-- change_my_referral_code(p_code) → table(referral_code text, next_change_at timestamptz)
--   affiliate caller; verdict must be 'ok'; set_config('app.referral_code_source','affiliate',
--   true); update affiliates. grant authenticated.
-- change_referral_code(p_user_id, p_code) → void
--   assert_command_actor(p_user_id); verdict ignoring 'too_soon'; source 'command'.
--   grant authenticated.

-- 7. Notification type (generic template).
insert into public.notification_type_settings (type, label, description) values
  ('affiliate_referral_code_changed', 'Affiliate Code Changed',
   'Sent to an affiliate when their referral code changes. Old codes keep crediting them.')
on conflict (type) do nothing;
```

**Blast radius.**
- *Data:* backfills one registry row per current code plus each orphaned historical code, and
  one change row per affiliate. Could fail only if two affiliates hold the same current code,
  which `affiliates.referral_code UNIQUE` already forbids.
- *Lock:* `CREATE TRIGGER` on `affiliates` takes SHARE ROW EXCLUSIVE for milliseconds.
- *Downstream:* every write to `affiliates.referral_code` now also writes two tables and can
  raise `23505` (reserved to someone else — Command shows "taken", F4). **V1 depends on `resolve_referral_code()`**:
  migration first, vendor deploy second (safe-pause table). Command's DELETE `/api/affiliates`
  leaves the person's codes reserved (intended).
- *Reversibility:* down migration drops the triggers, functions, three tables and the type
  row; `affiliates` itself is untouched by M2's DDL. Only after V1 is rolled back.

### M3 — Affiliate payout methods  ✅ DONE (2026-11-21) — applied locally by the user; verified by T1 105/105 and `db lint` clean (machine, local). Staging and production: not applied.

Mirrors `vendor_payout_methods` / `_log` / `_view_log` (`20260815000001`, `20260816000001`),
with one difference chosen in D9: writes go through a definer function called **with the
Command admin's own session** from the plan-2 server route that holds the encryption key, not
through a service-role write. That lets the database enforce Q8 and write the masked log in the
same transaction.

```sql
create table public.affiliate_payout_methods (
  -- CASCADE from affiliates: personal data goes with the capability. Command refuses to remove
  -- an affiliate with referrals, so no owed money is ever orphaned by this.
  user_id        uuid primary key references public.affiliates (user_id) on delete cascade,
  method_type    text not null check (method_type in ('bank', 'gcash', 'maya')),
  schema_version smallint not null default 1,
  status         text not null default 'active' check (status in ('active', 'disabled')),
  details_enc    text not null check (details_enc ~ '^v1\.'),   -- AES-256-GCM, app key (Q17)
  display        jsonb not null,  -- { label, masked } only: same CHECK as vendor_payout_methods
  created_by     uuid references public.profiles (id) on delete set null,
  updated_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- + set_updated_at trigger; + the display-shape CHECK copied from 20260815000001.

create table public.affiliate_payout_method_log (     -- masked values only, never ciphertext
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  changed_by uuid references public.profiles (id) on delete set null,
  from_type text, from_display jsonb, to_type text, to_display jsonb,
  identity_confirmation text not null check (char_length(trim(identity_confirmation)) >= 5),  -- Q32
  changed_at timestamptz not null default now()
  -- + the vendor log's two CHECKs (one side non-NULL; masked shape)
);
create index affiliate_payout_method_log_user_idx
  on public.affiliate_payout_method_log (user_id, changed_at desc);

create table public.affiliate_payout_view_log (       -- who decrypted, never what
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  viewed_by uuid references public.profiles (id) on delete set null,
  viewed_at timestamptz not null default now()
);
create index affiliate_payout_view_log_user_idx   on public.affiliate_payout_view_log (user_id, viewed_at desc);
create index affiliate_payout_view_log_viewer_idx on public.affiliate_payout_view_log (viewed_by, viewed_at desc);

-- RLS: methods — the affiliate SELECTs own row (active + affiliate portal); Command SELECT all.
--      logs  — Command SELECT only.
revoke all on table public.affiliate_payout_methods, public.affiliate_payout_method_log,
                    public.affiliate_payout_view_log from anon, authenticated, service_role;
grant select on table public.affiliate_payout_methods, public.affiliate_payout_method_log,
                      public.affiliate_payout_view_log to authenticated, service_role;
-- The plan-2 decrypt route records each view BEFORE returning plaintext (vendor pattern):
grant insert on table public.affiliate_payout_view_log to service_role;

-- set_affiliate_payout_method(p_user_id uuid, p_method_type text, p_schema_version smallint,
--   p_details_enc text, p_display jsonb, p_identity_confirmation text) → void
--   assert_command_actor(p_user_id) (Q8); affiliates row must exist; refuse while that
--   affiliate has a withdrawal in 'processing' (the destination being paid must not move —
--   M4 replaces this function to add the check once the table exists); upsert; write the
--   masked log row in the same transaction. grant authenticated.
```

**Blast radius.** New tables only; nothing existing is read, altered or locked. Downstream:
plan 2's route encrypts with the key Command already holds and calls the function with the
admin's cookie session (`command/lib/commandAuth.server.ts:50-52` already builds that client).
⚠️ The affiliate can read the `details_enc` ciphertext of their own row, exactly as vendors can
(`schema.md`, `vendor_payout_methods` RLS): useless without the server key; plan 3 selects
`display` only. Reversible by dropping the tables while empty.

### M4 — Commission ledger and withdrawals  ✅ DONE (2026-11-21) — applied locally by the user; verified by T1 105/105 and `db lint` clean (machine, local). Staging and production: not applied.

The core migration. Tables first, then the money functions, the booking trigger, the
correction triggers, the read functions, the withdrawal functions, the notification types.

```sql
-- 1. References (Q24). Gaps are fine; uniqueness is what matters.
create sequence public.affiliate_commission_reference_seq start 10001;
create sequence public.affiliate_withdrawal_reference_seq start 1001;

-- 2. Withdrawals (Q42–Q50). One row per request; every transition is a column, set once.
create table public.affiliate_withdrawals (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique
                        default 'W-' || nextval('public.affiliate_withdrawal_reference_seq'),
  affiliate_user_id     uuid references public.profiles (id) on delete set null,
  affiliate_name        text not null default '',   -- snapshots: the record outlives the account
  affiliate_email       text not null default '',
  status                text not null default 'requested'
                        check (status in ('requested', 'processing', 'completed', 'cancelled', 'rejected')),
  requested_amount      numeric(10,2) not null check (requested_amount > 0),
  amount                numeric(10,2),               -- fixed at Start processing (or payroll)
  destination_type      text,                        -- masked snapshot; NULL for payroll
  destination_display   jsonb,
  paid_through_payroll  boolean not null default false,  -- Q30, Q48
  opened_by             uuid references public.profiles (id) on delete set null,
  opened_reason         text not null default '',    -- required when Command opens it (D7)
  minimum_waived        boolean not null default false,  -- account-closure final payout only (Q50b, D7)
  transfer_failed       boolean not null default false,  -- rejected after processing, no money sent (D6)
  processing_started_by uuid references public.profiles (id) on delete set null,
  processing_started_at timestamptz,
  completed_by          uuid references public.profiles (id) on delete set null,
  completed_at          timestamptz,
  transfer_reference    text,                        -- bank/e-wallet or payroll reference
  paid_on               date,                        -- payroll date (Q48)
  rejected_by           uuid references public.profiles (id) on delete set null,
  rejected_at           timestamptz,
  rejection_reason      text,
  cancelled_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Shape checks so a half-recorded transition cannot exist:
  constraint affiliate_withdrawals_completed_shape check (status <> 'completed' or
    (completed_at is not null and amount is not null and amount > 0
     and char_length(trim(coalesce(transfer_reference, ''))) >= 3)),
  constraint affiliate_withdrawals_rejected_shape check (status <> 'rejected' or
    (rejected_at is not null and char_length(trim(coalesce(rejection_reason, ''))) >= 10)),
  constraint affiliate_withdrawals_payroll_shape check (not paid_through_payroll or
    (status = 'completed' and destination_display is null and paid_on is not null)),
  constraint affiliate_withdrawals_waiver_reason check (not minimum_waived or
    char_length(trim(opened_reason)) >= 10),
  constraint affiliate_withdrawals_transfer_failed_shape check (not transfer_failed or
    (status = 'rejected' and processing_started_at is not null))
);
-- One open request per affiliate (Q44). Mirrors account_deletion_requests_one_open_idx.
create unique index affiliate_withdrawals_one_open_idx
  on public.affiliate_withdrawals (affiliate_user_id) where status in ('requested', 'processing');
create index affiliate_withdrawals_queue_idx
  on public.affiliate_withdrawals (created_at) where status in ('requested', 'processing');
create index affiliate_withdrawals_affiliate_idx
  on public.affiliate_withdrawals (affiliate_user_id, created_at desc);
-- + set_updated_at trigger; + indexes on each actor FK (opened_by, processing_started_by,
--   completed_by, rejected_by) — small table, written for completeness at execution.

-- 3. Commission lines (Q20, Q24). Money columns are written once; status/withdrawal_id move
--    only through affiliate_commission_set_status().
create table public.affiliate_commissions (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique
                    default 'C-' || nextval('public.affiliate_commission_reference_seq'),
  kind              text not null check (kind in ('earned', 'adjustment', 'manual')),
  affiliate_user_id uuid references public.profiles (id) on delete set null,
  vendor_id         uuid references public.vendors (id) on delete restrict,
  transaction_id    uuid references public.booking_transactions (id) on delete restrict,
  correction_id     uuid references public.booking_transaction_corrections (id) on delete restrict,
  parent_id         uuid references public.affiliate_commissions (id) on delete restrict,
  line_date         date not null,          -- booking date (earned); correction / entry date otherwise
  amount_paid       numeric(10,2),          -- snapshots (Q12 columns)
  fee_amount        numeric(10,2),          -- for an adjustment: the CORRECTED fee
  tax_percent       numeric(5,2),           -- Q34 snapshot
  after_tax_amount  numeric(10,2),
  rate_percent      numeric(5,2),           -- Q7 snapshot
  amount            numeric(10,2) not null, -- the affiliate's share; negative only for adjustment/manual
  note              text not null default '',
  status            text not null default 'earned'
                    check (status in ('earned', 'held', 'in_withdrawal', 'withdrawn', 'cancelled', 'written_off')),
  withdrawal_id     uuid references public.affiliate_withdrawals (id) on delete restrict,
  earned_at         timestamptz not null default now(),
  available_at      timestamptz not null,   -- Q42: earned_at + 7 days (adjustment: the parent's)
  created_at        timestamptz not null default now(),
  constraint affiliate_commissions_kind_shape check (
       (kind = 'earned'     and transaction_id is not null and correction_id is null and parent_id is null and amount >= 0)
    or (kind = 'adjustment' and transaction_id is not null and correction_id is not null and parent_id is not null)
    or (kind = 'manual'     and transaction_id is null and correction_id is null and char_length(trim(note)) >= 10)),
  -- in_withdrawal / withdrawn / written_off carry their withdrawal (only a withdrawn line is
  -- ever written off); earned / held / cancelled carry none.
  constraint affiliate_commissions_withdrawal_shape check (
    (status in ('in_withdrawal', 'withdrawn', 'written_off')) = (withdrawal_id is not null))
);
create unique index affiliate_commissions_one_per_transaction
  on public.affiliate_commissions (transaction_id) where kind = 'earned';      -- Q20
create unique index affiliate_commissions_one_per_correction
  on public.affiliate_commissions (correction_id) where kind = 'adjustment';  -- Q20, Q4c
create index affiliate_commissions_affiliate_idx
  on public.affiliate_commissions (affiliate_user_id, line_date desc);
create index affiliate_commissions_withdrawal_idx on public.affiliate_commissions (withdrawal_id);
create index affiliate_commissions_vendor_idx     on public.affiliate_commissions (vendor_id);
create index affiliate_commissions_parent_idx     on public.affiliate_commissions (parent_id);
-- (transaction_id and correction_id are covered by the partial uniques for their kinds.)

-- Pin: refuse any UPDATE that changes a column other than status / withdrawal_id, except the
-- FK's own ON DELETE SET NULL of affiliate_user_id. BEFORE UPDATE trigger
-- affiliate_commissions_pin (bookings_pin_origin pattern, 20260829000003).

-- 4. Status log (Q20). Append-only; Command reads it.
create table public.affiliate_commission_status_log (
  id                    uuid primary key default gen_random_uuid(),
  commission_id         uuid not null references public.affiliate_commissions (id) on delete restrict,
  from_status           text,             -- NULL = the line's creation
  to_status             text not null,
  withdrawal_id         uuid references public.affiliate_withdrawals (id) on delete restrict,
  booking_status_log_id uuid references public.booking_status_log (id) on delete restrict,  -- F2
  changed_by            uuid references public.profiles (id) on delete set null,
  note                  text not null default '',
  changed_at            timestamptz not null default now()
);
create index affiliate_commission_status_log_line_idx
  on public.affiliate_commission_status_log (commission_id, changed_at desc);
-- + indexes on withdrawal_id, booking_status_log_id.

-- RLS + grants for the three tables:
--   affiliate_withdrawals, affiliate_commissions: the affiliate SELECTs own rows
--     (affiliate_user_id = auth.uid() and is_active() and is_portal_member('affiliate'));
--     Command SELECT all.
--   affiliate_commission_status_log: Command SELECT only.
revoke all on table public.affiliate_withdrawals, public.affiliate_commissions,
                    public.affiliate_commission_status_log from anon, authenticated, service_role;
grant select on table public.affiliate_withdrawals, public.affiliate_commissions,
                      public.affiliate_commission_status_log to authenticated, service_role;
-- No write grant for anyone: every write is a definer function or trigger (table owner).

-- 5. The money maths — the ONLY definition (pattern: platform_fee_amount(), 20260911000001).
-- affiliate_after_tax_amount(p_fee numeric, p_tax_percent numeric) → numeric  IMMUTABLE
--   round(p_fee * (100 - p_tax_percent) / 100, 2)
-- affiliate_share_amount(p_after_tax numeric, p_rate_percent numeric) → numeric  IMMUTABLE
--   round(p_after_tax * p_rate_percent / 100, 2)
-- Granted to authenticated (pure; lets Command's Settings example use the database's maths).

-- 6. Internal writers (no API grant).
-- affiliate_commission_set_status(p_id, p_to, p_withdrawal_id, p_booking_status_log_id, p_note)
--   the one place a line's status / withdrawal_id changes; writes the status-log row.
-- affiliate_commission_resting_status(p_id) → text
--   where a line rests when it leaves a withdrawal: manual → earned; otherwise by the booking's
--   CURRENT status: completed → earned · disputed → held · refunded/cancelled → cancelled.
-- affiliate_notify_command_admins(p_type, p_title, p_body, p_data)
--   one row per active command-portal admin/root, if the type is enabled (Q49 fan-out).

-- 7. Booking trigger (F1). AFTER UPDATE OF status ON bookings, WHEN old.status IS DISTINCT
--    FROM new.status. Name sorts after bookings_log_status_change (F2). Returns quietly when
--    the booking has no booking_transactions row (free bookings, F5 of the discovery log).
create trigger bookings_sync_affiliate_commission
  after update of status on public.bookings
  for each row when (old.status is distinct from new.status)
  execute function public.sync_affiliate_commission();
```

**What `sync_affiliate_commission()` does** (lock order everywhere: the withdrawal row, then the
lines — the withdrawal functions use the same order, so no deadlock and no stale read):

| Booking moves to | Line state found | Result |
|---|---|---|
| `completed` | no `earned` line, and **all** of: tax rate set; `now() >= live_from`; this is the booking's **first** completion (no earlier `booking_status_log` row to `completed`, D13); the vendor has a `vendor_referrals` row with a non-NULL affiliate; that affiliate has an `affiliates` row and an **active** profile (Q9); the affiliate is **not** a `vendor_members` row of this vendor (Q11) | insert `kind='earned'`: snapshot `booked_date`, `amount_paid`, the transaction's **current** `platform_fee_amount`, tax %, `coalesce(commission_rate_percent, default)`, the two amounts; `earned_at = now()`, `available_at = now() + 7 days`. Staff affiliates earn lines too (Q8: recorded, paid via payroll) |
| `completed` | `held` lines for this transaction | → `earned`, keeping the original `available_at` (D14) |
| `disputed` | `earned` | → `held` (Q4b) |
| `disputed` | `in_withdrawal`, withdrawal **requested** | → `held`, removed from the request (its live amount drops) |
| `disputed` | `in_withdrawal`, withdrawal **processing**; or `withdrawn` | no change (processing has locked the amount; D5) |
| `refunded` / `cancelled` | `earned`, `held`, or `in_withdrawal` in a **requested** withdrawal | → `cancelled` (Q4a: refunded before withdrawal) |
| `refunded` / `cancelled` | `in_withdrawal`, withdrawal **processing** | no change now; settled when the withdrawal completes or is rejected |
| `refunded` / `cancelled` | `withdrawn` | → `written_off`, linked to the `booking_status_log` row (Q4a, Q20) |

Every row above applies to **all** lines of the transaction (the earned line and its
adjustments). Error policy → **D10**.

```sql
-- 8. Corrections (Q4c, Q8). Two triggers on booking_transaction_corrections; the function
--    correct_booking_transaction() is NOT edited (F10).
-- BEFORE INSERT  booking_transaction_corrections_affiliate_guard:
--   refuse when new.corrected_by is the affiliate on this transaction's earned line, or the
--   current referrer of the transaction's vendor (Q8: no fee correction on your own commission).
-- AFTER INSERT   booking_transaction_corrections_affiliate_adjustment:
--   if an earned line exists for new.transaction_id and is not cancelled / written_off:
--     new_share = share(after_tax(new.to_fee_amount, parent.tax_percent), parent.rate_percent)
--     delta     = new_share − (parent.amount + sum of the parent's existing adjustments)
--     if delta <> 0: insert kind='adjustment', parent_id, correction_id, fee_amount =
--       to_fee_amount, amount = delta, line_date = corrected_at::date (Asia/Manila),
--       available_at = parent.available_at, status = 'held' if the parent is held else 'earned'.
--   A negative delta on an already-available parent reduces the available balance at once and
--   may take it below zero, which is carried (Q4-neg, P4).

-- 9. Read functions.
-- affiliate_balance(p_user_id uuid default null) → table(available, not_yet_available, held,
--     in_withdrawal, withdrawn_to_date numeric, minimum numeric, withdraw_blocker text)
--   caller: the affiliate (p_user_id NULL or self) or Command. THE bucket definition:
--     available         = sum(amount) where status = 'earned' and available_at <= now()
--     not_yet_available = sum(amount) where status = 'earned' and available_at >  now()
--     held              = status 'held';  in_withdrawal = status 'in_withdrawal'
--     withdrawn_to_date = status in ('withdrawn', 'written_off')
--   withdraw_blocker (first that applies — the same function the request uses, so the
--   disabled button and the refusal can never disagree):
--     'staff' (Q48) · 'withdrawals_off' (minimum unset, Q45) · 'open_request' (Q44) ·
--     'below_minimum' (incl. nothing available) · 'no_payout_details' (Q46) · NULL = may withdraw
-- affiliate_my_vendors() → table(vendor_id, vendor_name, vendor_status, signed_up_at,
--     activated_at, referral_code, earned_to_date)
--   vendors whose CURRENT referrer is the caller, plus vendors they have lines from (a Q18
--   move keeps past earnings visible). activated_at = first vendor_status_log row to 'active'.
--   earned_to_date = sum(amount) over status in ('earned','in_withdrawal','withdrawn',
--   'written_off') (Q25). No phone, email, address or member names (Q12).
-- affiliate_my_upcoming(p_limit int default 100, max 500) → table(line_date, vendor_name,
--     amount_paid, fee_amount, after_tax_estimate, share_estimate)
--   transactions at the caller's currently referred vendors whose booking is paid and not yet
--   completed (pending / confirmed / fulfilled / in_progress / returned), excluding vendors the
--   caller is a member of (Q11); estimated with TODAY's tax and rate. Returns no rows while the
--   tax rate is unset (Q41). No booking id, no booker field.

-- 10. Withdrawal functions.
-- affiliate_request_withdrawal() → uuid
--   affiliate caller; lock the affiliates row; blocker must be NULL; claim every line with
--   status 'earned' and available_at <= now() (negative adjustments included, so a carried
--   negative nets out — Q4-neg); amount = their sum, must be >= minimum; insert the withdrawal
--   with the masked destination snapshot; lines → 'in_withdrawal'; notify the affiliate
--   ('affiliate_withdrawal_received') and Command admins ('affiliate_withdrawal_requested').
-- affiliate_cancel_withdrawal(p_withdrawal_id) → void
--   owner only; status must be 'requested' (Q44); → 'cancelled'; lines → resting status.
-- command_open_withdrawal(p_user_id, p_reason, p_waive_minimum boolean default false) → uuid
--   command F3 / Q9 / Q50b; Command caller (not self); the affiliate need not be active;
--   staff refused (payroll instead); reason >= 10 chars; available balance must reach the
--   minimum unless p_waive_minimum (account-closure final payout only, D7). Same claim as above.
-- command_start_withdrawal_processing(p_withdrawal_id) → table(requested_amount, amount,
--     lines_removed int)
--   Command caller, not the owner (Q8); 'requested' → 'processing'; amount = sum of the lines
--   still in it; refuse when amount <= 0, or below the minimum unless minimum_waived (D5:
--   staff reject instead); re-snapshot the destination (refuse if no active payout method).
-- command_complete_withdrawal(p_withdrawal_id, p_transfer_reference) → void
--   'processing' → 'completed' (Q44); lines → 'withdrawn'; then any whose booking is now
--   refunded/cancelled → 'written_off' (Q4a); notify the affiliate
--   ('affiliate_withdrawal_completed', data = the receipt, E1).
-- command_reject_withdrawal(p_withdrawal_id, p_reason, p_transfer_failed boolean default false) → void
--   from 'requested'; from 'processing' only with p_transfer_failed = true, recorded on the row
--   (D6); reason >= 10 chars, written for the affiliate;
--   lines → resting status; notify the affiliate ('affiliate_withdrawal_rejected').
-- command_record_payroll_payment(p_user_id, p_reference, p_paid_on date) → uuid
--   staff affiliates only (Q48); claims the available lines; inserts a withdrawal directly as
--   'completed', paid_through_payroll, no destination, no minimum; lines → 'withdrawn'.
--   No email (the Command preview's payroll dialog says so).
-- command_add_commission_adjustment(p_user_id, p_amount, p_reason) → uuid
--   Q36 one-off promise; amount <> 0; kind 'manual', available now, line_date = today (Manila).
-- Replace set_affiliate_terms (M1) and set_affiliate_payout_method (M3) to add their
--   withdrawal checks now that the table exists.
-- All Command functions: grant authenticated. Affiliate functions: grant authenticated.

-- 11. Notification types. Generic template except the receipt (E1).
insert into public.notification_type_settings (type, label, description) values
  ('affiliate_withdrawal_requested', 'Affiliate Withdrawal Requested', 'Sent to Command admins when an affiliate requests a withdrawal.'),
  ('affiliate_withdrawal_received',  'Withdrawal Received',  'Sent to an affiliate when their withdrawal request is received. Processed within 5 business days.'),
  ('affiliate_withdrawal_completed', 'Withdrawal Completed', 'Sent to an affiliate when Ezzy has sent their withdrawal, with the receipt.'),
  ('affiliate_withdrawal_rejected',  'Withdrawal Rejected',  'Sent to an affiliate when Ezzy cannot process their withdrawal, with the reason.')
on conflict (type) do nothing;
```

Message wording (title/body, all built in SQL with `payout_statement_peso()` so the in-app text
and the email match): received — "We received your withdrawal W-1012 of ₱5.85. Ezzy processes
withdrawals within 5 business days." (Q50c); rejected — the reason verbatim; completed — "Ezzy
sent ₱5.85 to BDO ••7890 (W-1012)". The receipt `data`: `{ reference, amount_display,
destination_label, destination_masked, transfer_reference, completed_on_display, lines: [{
reference, line_date_display, vendor_name, amount_display, written_off }] }`. Vendor names and
line references only (Q12, Q24).

**Blast radius.**
- *Data:* new tables start empty. **No backfill** (Q36): the trigger fires only on future
  transitions, and while the tax rate is NULL it writes nothing.
- *Lock:* `CREATE TRIGGER` on `bookings` and on `booking_transaction_corrections` takes SHARE
  ROW EXCLUSIVE on each for milliseconds, briefly queueing writes (payment webhook, status
  changes). Apply outside a busy hour.
- *Downstream — the important part:* a new trigger runs inside **every booking status change**
  (booker acknowledge, vendor actions, the hourly auto-acknowledge job, Command resolve and
  override) and inside every fee correction. If it raises, that write fails (D10). Cost when
  inert: one indexed lookup of `booking_transactions` by `booking_id` and one settings read.
  ⚠️ `transaction_id … on delete restrict` means a booking with a commission line can no
  longer be deleted — `supabase/demo/demo-teardown.sql` must delete demo lines first if a demo
  vendor is ever referred (T1 checks; the same situation as `payout_statement_items`).
  The Q8 guard can refuse a correction Command attempts today, but only for a caller who is a
  referrer, which no current admin is (R2 lists referrers).
- *Reversibility:* before the tax rate is set, a down migration drops everything M4 created.
  After go-live the tables hold financial records: fix forward only.

### M5 — Attribution changes (Q18, Q19)  ✅ DONE (2026-11-21) — applied locally by the user; verified by T1 105/105 and `db lint` clean (machine, local). Staging and production: not applied.

```sql
create table public.vendor_referral_changes (
  id                     uuid primary key default gen_random_uuid(),
  vendor_id              uuid not null references public.vendors (id) on delete cascade,
  kind                   text not null check (kind in ('credit', 'change')),
  from_affiliate_user_id uuid references public.profiles (id) on delete set null,
  to_affiliate_user_id   uuid references public.profiles (id) on delete set null,
  from_code              text,
  to_code                text not null,
  reason                 text not null check (char_length(trim(reason)) >= 10),
  changed_by             uuid references public.profiles (id) on delete set null,
  changed_at             timestamptz not null default now()
);
-- indexes: (vendor_id, changed_at desc), and the three actor FKs.
-- RLS: Command SELECT. Grants: revoke all from anon, authenticated, service_role;
--   grant select to authenticated, service_role.

-- change_vendor_referrer(p_vendor_id, p_user_id, p_reason) → void       (Q18)
--   Command caller; refuse when the caller is the OLD or the NEW affiliate (Q8); the new
--   affiliate must have an affiliates row and an active profile; a vendor_referrals row must
--   exist; update affiliate_user_id and referral_code (the new holder's current code — the
--   log keeps the old one); log 'change'. Forward-only by construction: lines already written
--   keep their affiliate; the next completion goes to the new one.
-- credit_vendor_referral(p_vendor_id, p_user_id, p_reason) → void       (Q19)
--   Command caller, not self; no vendor_referrals row yet; now() <= vendors.created_at +
--   30 days; insert vendor_referrals (created_at = now() = the date credit runs from); log
--   'credit'.
-- grant execute to authenticated.
```

**Blast radius.** New table; `vendor_referrals` gains a second writer (definer functions)
beside the vendor register route. No lock beyond row writes. Reversible while unused.

### M6 — Booker browsing of vendors requires the booker portal (F3, D15)  ✅ DONE (2026-11-21) — applied locally by the user; verified by T1 105/105 and `db lint` clean (machine, local). Staging and production: not applied.
⚠️ **Cross-app RLS change** (approval gate: security + more than one app). Written only after
R3 is clean.

```sql
-- Replaces 20260515000001's policy. Was: any active user reads active vendors. Now: only
-- active users who hold the booker portal (Q12 — affiliates, and any user with no booker
-- portal, see no vendor contact details).
drop policy "active users can read active vendors" on public.vendors;

create policy "active bookers can read active vendors"
  on public.vendors for select
  to authenticated
  using (
    public.is_active()
    and public.is_portal_member('booker')
    and exists (
      select 1 from public.statuses
      where id = vendors.status_id
        and name = 'active'
    )
  );
```

Unchanged and still applying (`20260504000003_rls.sql:134-147`): vendor members read their own
vendor (`is_active() and is_vendor_member(id)`), Command admins read all.

**Blast radius.**
- *Data:* none rewritten.
- *Lock:* `DROP/CREATE POLICY` takes ACCESS EXCLUSIVE on `vendors` for milliseconds, in one
  transaction, so there is no moment with neither policy.
- *Downstream:* any authenticated reader of **other** vendors' rows who lacks the booker portal
  loses them. Known readers (2026-11-15 count of files naming `vendors`): booker 2, vendor 7,
  ezzy-vendor-mobile 3, command 11, affiliate 0, ezzy-booker-mobile 0 (mock data). Booker users
  always hold the booker portal; vendor and command readers are covered by their own policies;
  the kiosk route uses the service role. **R3 confirms each one before M6 is written.** The
  same is-active-only pattern exists on `offerings`, `schedules` and `staff` (booker browsing);
  those carry no contact details, so they are left alone (Q12 concerns vendor contacts) —
  noted, not changed.
- *Reversibility:* a new migration recreating the old policy.

**Coupling:** booker web and booker mobile are unaffected for real bookers; nothing to deploy.
Staging check S4 includes a booker browsing vendors and booking.

---

## OTHER ITEMS

### E1 — `send-notification-email`: five types, one bespoke receipt  ✅ DONE (2026-11-21) — machine-verified: `deno test` **42/42** (31 existing + 11 new) incl. type-check; the live local send is not run (F22)
**Files:** `backbone/supabase/functions/send-notification-email/types.ts:14-60` (add the five
types to the documentation union with a comment block, as for `payout_statement`);
`lib/templates/registry.ts:189-196` (register `affiliate_withdrawal_completed`); new
`lib/templates/affiliateWithdrawalReceipt.ts` modelled on `payoutStatement.ts` (234 lines:
reads display strings from `data`, escapes every value, falls back to generic if `data` is
malformed); tests beside the existing `handler.test.ts` cases; `README.md` type list.
The other four types render generic (F6). **Verify:** `deno test` in the function folder
(machine); a local send through Inbucket/`local_smtp` after T1's fixture completes a
withdrawal (live, local); staging redirect to the override inbox (memory: staging email
override).

### V1 — Vendor lookup resolves old codes  ✅ DONE (2026-11-21) — `lib/referralLookup.ts` now calls `resolve_referral_code()`; new `lib/referralLookup.test.ts` 5/5; vendor `npm test` 609/609, `npm run lint` clean, `tsc --noEmit` clean (machine). Real function checked by SQL as `service_role` in a rolled-back transaction: current and old code → nina, unknown → NULL, `authenticated` cannot execute. Not run: a live signup through the vendor dev server (S4 covers it on staging). ⚠️ Uncommitted on vendor branch `release/version-0.62.1` — move to a feature branch before committing
**File:** `vendor/lib/referralLookup.ts:45-84`. Replace the `affiliates` query and its
named-FK embed with `admin.rpc("resolve_referral_code", { p_code: code })`. Keep: the
normalise/well-formed short-circuit (`:56-59`), the loud `console.error` on an RPC error
(`:67-75`), `null` for every "no", and `referralCode: code` — the code **as used**, which is
what `vendor_referrals.referral_code` snapshots (per-code reporting, discovery Q16 notes).
Remove the now-dead `SELECT` constant, `one()` helper and the PGRST201 comment. Update the
header comment (old codes resolve; the "active" rule now lives in the database function).
New `vendor/lib/referralLookup.test.ts` (node:test, a fake client): current code → id; old
code → id; unknown → null; RPC error → null and logs; malformed → null with no call.
No component, so the render/hook/style rule does not apply. **Verify:** `npm --prefix vendor
test`, `npm --prefix vendor run lint`, `npx --prefix vendor tsc --noEmit -p vendor` (machine);
signup with an old code on staging credits the original affiliate (S4).
**Coupling:** ships **after** M2 on every environment (safe-pause table).

### T1 — `backbone/supabase/tests/affiliate_data_layer_test.sql`  ✅ DONE (2026-11-21) — run locally after M1–M7: **105/105 PASS**, `plpgsql_check` no errors (one warning, F21). Fixed along the way: F20.
Same harness as `withholding_and_corrections_test.sql` (rolled-back transaction, local only,
`plpgsql_check` static pass on every new function, then behaviour with seed identities and
`set local role authenticated` + `request.jwt.claims` to act as each caller). Cases, at least:
- *Gate:* tax NULL → completing a referred booking writes no line; setting tax stamps
  `live_from`; changing `live_from` raises; clearing tax afterwards raises.
- *Lines:* first completion writes one line with the F11 worked example (₱1,600 → ₱1.55);
  second completion after a dispute writes none (D13); vendor member → none (Q11); suspended
  affiliate → none (Q9); no referral → none; free booking → none; override rate used.
- *Lifecycle:* each row of the booking-trigger table, including written-off with its
  `booking_status_log_id`, and the requested-vs-processing difference.
- *Adjustments:* a correction writes one ± line with the right delta; a second correction
  nets against the first; a correction by the referrer is refused (Q8).
- *Withdrawals:* every blocker; request claims exactly the available lines incl. a negative
  adjustment; one open request; cancel; start processing recomputes and refuses below the
  minimum (D5) unless closure-waived (D7); complete writes off a line refunded during
  processing; reject returns lines to their resting status, and after processing only with
  `p_transfer_failed` (D6); on-behalf open below the minimum refused without the waiver; payroll;
  the owner cannot complete/reject their own; notifications rows written with the right
  portal and type.
- *Codes:* reserved to another (old code) → `23505` with
  `referral_code` in the message; switch back to own old code; 30-day limit for self only;
  import/Command do not start the clock; `resolve_referral_code` old → holder, suspended → NULL.
- *Access:* an affiliate reads only own rows in every new table; a booker/vendor reads none;
  `affiliate_my_upcoming` / `affiliate_my_vendors` return no booker or contact columns;
  `service_role` cannot UPDATE/DELETE/TRUNCATE any append-only table (the `20260911000003`
  lesson, asserted with `has_table_privilege`).
- *M6:* an active user with only the `affiliate` portal reads **zero** `vendors` rows; an
  active booker still reads active vendors; a vendor-admin still reads their own vendor
  whatever its status; a Command admin still reads all.
**Verify:** `psql … -f supabase/tests/affiliate_data_layer_test.sql` exits 0 (machine, local).

### L1 — Local seed: affiliate fixtures  ⏸ PARKED (2026-11-21, the user) — moved to plan 3. Why: F23. Unblocks when plan 3 needs a signed-in affiliate with lines; it adds an opt-in `supabase/demo/` script instead of changing `seed.sql`
`backbone/supabase/seed.sql`: grant `nina` the `affiliate` portal; set the local tax rate
(12%, the preview's sample) and minimum (₱5.00) **before** the seed completes its bookings, so
the referred vendor's completed bookings produce lines plans 2 and 3 can develop against.
Local only (seeds never run on hosted projects). **Verify:** `db reset` locally, then T1 and a
count of seeded lines (live, local — the user runs the reset).

---

## DECISIONS
<!-- Hard gate (§7): no item executes while any OPEN line remains. -->

- D1 — How go-live is set (Q36, Q41). → **(a), as recommended** (resolved 2026-11-15, the user: "Accept them all"). (a) **Recommended:** stamped automatically
  the moment the tax rate is first saved, never editable, tax never clearable afterwards (M1).
  One Command screen (the tax rate) switches commission on; no gap is possible. (b) A separate
  go-live date setting that requires the tax rate. More control (e.g. start on the 1st), one
  more field and one more way to get it wrong.
- D2 — Rate rounding. → **(a), as recommended** (resolved 2026-11-15, the user: "Accept them all"). Two-step centavo rounding as in F11 and the approved preview
  (**recommended**), vs one rounding of `fee × (1 − tax) × rate`. They differ by at most ₱0.01
  per line.
- D3 — Where the settings live. → **(a), as recommended** (resolved 2026-11-15, the user: "Accept them all"). (a) **Recommended:** four columns on
  `platform_fee_settings` (single row; Command's Platform Fee tab already edits it; the
  Command preview puts the card there). (b) A new single-row `affiliate_settings` table:
  cleaner separation, a second settings row to read and secure.
- D4 — The blocked-word list (Q22c) → **No blocking: any well-formed code is accepted**
  (resolved 2026-11-15, the user: "no need for blocking, accept codes as it is"). ⚠️
  **Supersedes the blocked/reserved-word half of Q16c and all of Q22c.** Codes still follow the
  format `^[A-Z0-9]{4,32}$`, stay reserved to their holder forever (Q16a) and follow the 30-day
  self-service limit (Q16b). Consequences: M2 has no blocked-word table and no `blocked`
  verdict; R1 is aborted; plan 3 drops the affiliate preview's "Settings · reserved word"
  screen; plan 2 has no blocked-word error to map. The discovery log is updated to match.
- D5 — Start processing when lines have dropped out (command F2) → **Refuse if the amount is
  now below the minimum; staff reject it** (resolved 2026-11-15, revised from the first draft's
  "process the smaller amount", which made the minimum optional in practice).
  `command_start_withdrawal_processing` raises `affiliate_below_minimum` when the recomputed
  amount is under the minimum (unless the withdrawal carries the D7 closure waiver) and always
  when it is ₱0; staff then reject with a reason and the remaining lines return to the
  balance. Lines still leave a *requested* withdrawal the moment their booking is disputed or
  refunded, so the affiliate's screen is always current.
- D6 — Rejecting after processing started (command F4) → **Reject only as "transfer failed"**
  (resolved 2026-11-15, revised: a plain reject after processing could return money that was
  actually sent, so the affiliate could withdraw it twice). Before processing: a plain reject
  with a reason (Q44). After processing: `command_reject_withdrawal(p_withdrawal_id, p_reason,
  p_transfer_failed boolean default false)` refuses unless `p_transfer_failed = true` — staff
  confirm no money left Ezzy — and records `transfer_failed = true` on the row. Same
  `rejected` status; no new state.
- D7 — Command opening a withdrawal for an affiliate who cannot (command F3, Q9, Q50b) →
  **Waive the minimum only on account closure** (resolved 2026-11-15, revised: the first draft
  stretched Q50b to suspended affiliates). `command_open_withdrawal` works for any non-staff
  affiliate, active or suspended, with a reason, once their available balance reaches the
  minimum. `p_waive_minimum = true` is allowed only as an account-closure final payout, reason
  required (≥ 10 chars, recorded in `opened_reason`); the database cannot verify the closure,
  so the reason is the record. A suspended affiliate below the minimum waits. Payout details
  are always required.
- D8 — Attribution changes (Q18, Q19) in this plan? → **(a), as recommended** (resolved 2026-11-15, the user: "Accept them all"). (a) **Recommended: yes, M5.**
  They decide who earns money, so the rules (reason, 30-day window, not-self, the log) belong
  in the database with the rest (Q6); plan 2 only draws the dialogs. (b) Leave them to plan 2
  as a service-role route: one migration fewer here, rules enforced only in Command's code.
- D9 — How payout details are written (Q26). → **(a), as recommended** (resolved 2026-11-15, the user: "Accept them all"). (a) **Recommended:** Command's server
  route encrypts, then calls `set_affiliate_payout_method()` **with the admin's session**, so
  the database refuses self-entry (Q8) and writes the masked log atomically; `service_role`
  gets no write grant at all. (b) Mirror vendor exactly: a service-role upsert from the route;
  Q8 and the log enforced only in route code.
- D10 — If the commission trigger fails. → **(a), as recommended** (resolved 2026-11-15, the user: "Accept them all"). (a) **Recommended: let the error
  propagate**, as `create_booking_transaction()` does: the trigger only writes its own tables,
  every path is covered by T1 and `plpgsql_check`, and a silently missing or uncancelled line is
  a money record that is wrong without anyone knowing. Cost: a bug would block that booking's
  status change until fixed. (b) Catch, `raise warning`, and let the booking change through:
  completions can never be blocked, but a refund could fail to cancel a line unnoticed.
- D11 — When the "code changed" email goes (Q38). → **(a), as recommended** (resolved 2026-11-15, the user: "Accept them all"). (a) **Recommended:** on every
  change except imports — including the affiliate's own, where it doubles as a security notice.
  (b) Only when Command changes it.
- D12 — Recording staff affiliates (Q48). → **(a), as recommended** (resolved 2026-11-15, the user: "Accept them all"). (a) **Recommended:** `affiliates.is_staff`
  boolean set by Command; the Command list's "type" (Partner / Vendor / Booker) is derived in
  plan 2 from vendor membership and portals, since only "staff" changes any rule. (b) A stored
  `affiliate_type` enum.
- D13 — A line only on a booking's FIRST completion. → **(a), as recommended** (resolved 2026-11-15, the user: "Accept them all"). (a) **Recommended:** if a
  booking first completed before go-live (or while the affiliate was suspended) and completes
  again after a dispute, it earns nothing — otherwise disputes become a back door around Q36
  and Q9. (b) Any completion counts if there is no line yet.
- D14 — The 7-day clock after a dispute resolves "completed" (Q4b). → **(a), as recommended** (resolved 2026-11-15, the user: "Accept them all"). (a)
  **Recommended:** the restored line keeps its original date, so it is available at once if
  7 days have passed. (b) Restart 7 days from the resolution.
- D15 — Affiliates can read active vendors' contact details via the raw API (F3) → **Fix in
  plan 1 as M6** (resolved 2026-11-15, revised from "accept for v1", which conflicted with
  Q12). The booker browsing policy on `vendors` is narrowed to active users with the `booker`
  portal, after R3 proves no reader relies on the wider rule. Cross-app RLS change: approval
  gate, ships with plan 1 so it is in place before any affiliate can sign in.
- D16 — Local seed fixtures (L1). → **(a), as recommended** (resolved 2026-11-15, the user: "Accept them all"). (a) **Recommended:** yes, as described. (b) No
  seed change; plans 2 and 3 build their own fixtures.

## DEFERRED / COSMETIC
- **Rate-change audit log.** Q7 snapshots the rate per line, so history is right without one;
  `affiliates.updated_at` records the last change. Add if Command asks who changed a rate.
- **Disabling a payout method** (status `disabled`) has a column but no function: no screen
  needs it in v1 (Q46 only asks "on file").
- **The Q39 import's `source = 'import'`.** The guard reads `app.referral_code_source`; plan 2
  adds a small import function that sets it if the import goes through the database rather
  than a script. The rules (format, blocked, reserved) already apply to any write path.
- **"Unusual patterns" report (Q21)** — after v1, read-only over these tables.

---

## Read-only pre-checks (the user runs them; nothing is changed)

### R1 — Existing codes that contain a proposed blocked word  ✖ ABORTED (2026-11-15)
Nothing to check: D4 dropped the blocked-word list.

### R2 — Historical codes that collide, and who refers  ✖ ABORTED (2026-11-15)
**Not run, by the user's decision:** "we only have a few affiliates now, I can manage not having
a duplicate code." The user keeps codes unique by hand; the recommendation (M2's backfill as
drafted) stands. This is safe even if a collision exists: the backfill skips any code already
held or seen with two owners, so the current holder keeps it and nothing fails. Worst case is a
historical code that is not reserved to anyone, which then fails soft exactly as today. The
admin-referrer half only affects who may correct a fee on that admin's own referrals (Q8). The
queries are kept below in case they are wanted later.
```sql
-- Codes seen with more than one owner, or held now by someone other than the snapshot owner
select vr.referral_code,
       count(distinct vr.affiliate_user_id)                     as owners_in_history,
       bool_or(a.user_id is not null and a.user_id <> vr.affiliate_user_id) as now_held_by_other
from public.vendor_referrals vr
left join public.affiliates a on a.referral_code = vr.referral_code
where vr.affiliate_user_id is not null
group by vr.referral_code
having count(distinct vr.affiliate_user_id) > 1
    or bool_or(a.user_id is not null and a.user_id <> vr.affiliate_user_id);

-- Which Command admins are also referrers (M4's Q8 correction guard would refuse them)
select distinct vr.affiliate_user_id
from public.vendor_referrals vr
join public.user_roles ur on ur.user_id = vr.affiliate_user_id
join public.roles r on r.id = ur.role_id and r.name in ('admin', 'root');
```
Expected: no rows from either. A row from the first means discovery F10 already happened in
that environment and the backfill needs a decision about who keeps the code.

### R3 — Who reads other vendors' rows without the booker portal (before M6)  ✅ DONE (2026-11-15)
**Repo audit done 2026-11-15** (grep of every `from("vendors")` / `vendors(` / `vendors!` in
booker, vendor, ezzy-vendor-mobile, command; each hit opened). Every reader is covered by a
policy M6 keeps:
- **booker** — `services/offerings.service.ts:72` (`vendors!inner`, browsing) and
  `services/bookings.service.ts:120` (vendor embed on the booker's own bookings). The booker
  app's gate requires the `booker` portal (`booker/services/booker.service.ts`, `hasPortal`), so
  every caller passes M6's new policy.
- **vendor / ezzy-vendor-mobile** — `vendor.service.ts:38`, `vendor-access.service.ts:79,151`,
  `lib/payout/authz.server.ts:59`, mobile `vendor.service.ts:29`, `kioskAccess.service.ts:27`
  embed the vendor through the user's own `vendor_members` row; `profile.service.ts:52,66`
  read/update the caller's own vendor by id. All covered by "vendor members read own vendor"
  (any status). `api/kyc/submit`, `api/auth/register`, `api/account-deletion` use the service
  role.
- **command** — all reads under "command admins can read all vendors"; `lib/accountDeletion/
  execute.server.ts` uses the service role.
- **affiliate**, **ezzy-booker-mobile** — no reads (mock data in booker mobile; it will sign in
  with the `booker` portal when wired).
**Result: M6 removes access from no real reader.** The hosted user-count query below is
informational only (it cannot change M6) and was **not run**; it stays here if wanted.
🤖 read-only, in the repo: open every file that queries or embeds `vendors` in booker,
vendor, ezzy-vendor-mobile, command (counts in M6) and confirm each reads either its own
vendor (vendor apps), all vendors as Command, or active vendors as a booker. 👤 on staging and
production, read-only:
```sql
-- Active users who could read vendors today only through the wide policy
select count(*) from public.profiles p
where p.status_id = 1
  and not exists (select 1 from public.user_portals up join public.portals po on po.id = up.portal_id
                  where up.user_id = p.id and po.name in ('booker', 'command'))
  and not exists (select 1 from public.vendor_members vm where vm.user_id = p.id);
```
Expected: the repo audit finds no other reader; the count is the affiliate-only and
portal-less users M6 is meant to shut out.

---

## Execution order

0. **Now:** (decisions resolved, R2 waived, R3 done, 2026-11-15) present the plan for
   approval (flow step 7). Nothing below starts before it.
1. **Stage 1 — migrations + tests (local).** 🤖 write M1–M6 (M5 per D8; M6 after R3) and T1;
   👤 apply locally (`npx supabase migration up` against the local stack, or `db reset`); 🤖 run
   T1 (`plpgsql_check` + behaviour) and `npx supabase db lint`. Gate: T1 exits 0.
2. **Stage 2 — Edge Function (local).** 🤖 E1; `deno test`; a local receipt email through
   `local_smtp` using T1's fixture (or a hand-made notification row).
3. **Stage 3 — vendor lookup + seed (local).** 🤖 V1 (+ test, lint, type-check); L1 (per D16);
   👤 `db reset` locally; 🤖 sign up a vendor locally with an old code (after changing a seeded
   affiliate's code) and confirm the original affiliate is credited.
4. **Stage 4 — staging release** (below). Stops for the user's "staging is green".
5. **Stage 5 — production release** (below). Always last.

Stages 1–3 are independent of production data except R2's outcome (it can change M2's
backfill). Within stage 1, M1 → M2 → M3 → M4 → M5 is a hard order (FKs and function
replacement); M6 is independent and goes last.

## Release (§12)

**Order within each environment, and why:** migrations first (all additive, inert while the
tax rate and minimum are unset), then the Edge Function (new template; unused until plan 2
completes a withdrawal), then the vendor app (needs `resolve_referral_code()`).

**Safe-pause table**

| State | Safe? | Why / recovery |
|---|---|---|
| Migrations applied, old vendor build | ✅ | The old lookup still finds current codes in `affiliates`. Old codes fail soft, exactly as today. |
| New vendor build, migrations **not** applied | ⛔ | `rpc('resolve_referral_code')` errors → fail-soft → **every** referral silently lost (logged as `[vendor/referral] lookup failed`). Recover: apply M2, or roll back the vendor deploy. Never deploy V1 first. |
| Migrations applied, old Edge Function | ✅ | New types render generic (F6). Only the receipt would lose its table, and no withdrawal can complete before plan 2. |
| Migrations applied, tax rate unset | ✅ | No lines, no estimates, no withdrawals. The intended production end state of this plan. |
| Tax rate set (staging only, by choice at S4) | ⚠️ one-way | Stamps `live_from` permanently on that environment. Fine on staging; **do not do it on production in this plan**. |

### Staging (production untouched throughout)
| # | Who | Step | Check |
|---|---|---|---|
| S1 | 👤 | `cd backbone && npx supabase migration list --remote` (CLI 3.2.0; was `--linked`) → `npx supabase db push --remote --dry-run` → `npx supabase db push --remote` (⚠️ 3.2.0: plain `db push` targets **local**) | ⛔ only M1–M7 pending (M7 = F19 fix); after push all seven listed remote |
| S2 | 👤 | `npx supabase functions deploy send-notification-email` (linked = staging) | ⛔ new version in the dashboard |
| S3 | 👤 | Deploy `vendor` to staging (the user's usual Vercel staging deploy) | — |
| S4 | 👤 + 🤖 | Staging checks (Verification → staging) | ⛔ all green |

⛔ **Staging fully green before anything touches production.** A parked staging check needs a
dated user decision here before P1.

### Production (last stage)
| # | Who | Step | Check |
|---|---|---|---|
| P1 | 👤 | Parity: `npx supabase migration list --remote=<prod-ref>` (the `# prod` ref in `backbone/.env`, never re-link) and `--remote` (staging) — CLI 3.2.0 | ⛔ production = staging minus M1–M7; function and vendor versions match what staging tested |
| P2 | 👤 | `npx supabase db push --remote=<prod-ref> --dry-run` → `npx supabase db push --remote=<prod-ref>` (CLI 3.2.0) (outside a busy hour: M4's trigger DDL briefly queues booking writes) | ⛔ M1–M7 listed remote |
| P3 | 👤 | `npx supabase functions deploy send-notification-email --project-ref <prod>` | ⛔ new version visible |
| P4 | 👤 | Vercel **Promote** the exact `vendor` staging deployment tested in S4 | — |
| P5 | 👤 + 🤖 | Production checks (Verification → production) | ⛔ all green |

---

## Verification

**Machine-verifiable (local):** T1 exits 0 (incl. `plpgsql_check` over every new function);
`npx supabase db lint`; `deno test` for E1; vendor `npm test`, `npm run lint`, `tsc --noEmit`;
`python3 scripts/plans-index.py --check`.

**Live, local:** `db reset` with L1; an old-code signup credits the original affiliate; a
receipt email renders in `local_smtp`.

**Live, staging (S4):**
- `select id, name from portals` has `affiliate`; `platform_fee_settings` affiliate columns are
  NULL / 1.00 / NULL / NULL; `notification_email_settings` has the `affiliate` row.
- Command → Settings → Platform Fee still saves the fee (regression: the new trigger and CHECK).
- Complete a booking at a referred vendor → **no** line (tax unset). Correct a fee in Command →
  still works (no line, no adjustment).
- Change a test affiliate's code in Command (legacy PATCH) → registry + change row written, a
  code-changed email reaches the staging override inbox; sign up a vendor on staging with the
  **old** code → `vendor_referrals` credits the original affiliate with the old code snapshotted.
- Optional, the user's call (Assumption 4): set the tax rate and minimum on staging by SQL,
  complete a booking, run one withdrawal end to end as SQL with `request.jwt.claims` for the
  affiliate and an admin, and confirm the three emails arrive.

**Live, production (P5) — read-only plus one harmless probe:** portal row and settings as on
staging (commission **off**); `select public.resolve_referral_code('<a real current code>')`
as `postgres` returns its affiliate; the next real referred signup (or vendor logs) shows
attribution still working. Nothing is set to switch commission on: that is plan 2's job.

**Cannot be verified in plan 1:** any screen (plans 2, 3); real affiliate sessions against RLS
on hosted projects (no affiliate can sign in until plan 2 grants the portal and plan 3 deploys
the app — T1 covers RLS locally with simulated claims).

## Docs
**Docs:** to do at close — `architecture/schema.md` (five migration rows; new tables; the
`platform_fee_settings` columns; trigger notes on `bookings` and
`booking_transaction_corrections`; ER diagram), `architecture/auth-and-roles.md` (portal 4,
affiliates' own-row reads, the function table, update "Affiliates — a capability"),
`architecture/email-notifications-guide.md` (five types, the receipt template),
`architecture/overview.md` / `portals.md` (affiliate portal now has a data layer),
`backbone/supabase/functions/send-notification-email/README.md`.
