# Backbone drift audit — architecture vs. actual migrations

**Date:** 2026-07-23
**App / scope:** `backbone/supabase/migrations/` cross-checked against `architecture/*.md`
**Status:** IN PROGRESS — B1, B2, I1, I2 ✅ DONE (fixes landed 2026-07-24; **statuses were
stale and corrected 2026-07-28** during a cross-plan audit). Remaining: I3 (accepted, not
actionable) and I4 (`pg_net` schema).

> Audit of the entire migration history against the documented architecture
> (`schema.md`, `auth-and-roles.md`, `conventions.md`, `portals.md`,
> `vendor-kyc.md`, `booking-flow.md`, `overview.md`) using the `supabase-exp`
> skill (§1 doc-drift check + §3-10 best-practice pass). Read-only audit —
> no migrations existed before this plan; all fixes below are proposed, not applied.
>
> **2026-07-24 update:** extended with a production-readiness pass (app code
> cross-checked against schema, not just docs-vs-migrations) after confirming
> the linked remote Supabase project (`fbxbwnfeimzhgxpshdpa`) is scratch/
> throwaway. That pass surfaced two real BLOCKER-tier bugs (B1, B2) — added
> below with resolved decisions. Migration consolidation (33 files → ~7) was
> also investigated and confirmed safe given the scratch remote, but is
> deliberately **deferred to its own follow-up plan** (see DECISIONS) rather
> than folded into this one.
>
> **2026-07-24 execution:** B1 (app code), B2, I1, I2 implemented — see each
> item's inline status. One additional gap found while reviewing
> `backbone/supabase/seed.sql` per request (not part of the original audit
> scope): the 3 seeded vendors predate `20260722000001_vendor_address_fields.sql`
> / `20260722000002_vendor_barangay_strict.sql` and had blank structured
> address fields. Fixed in the same session — see SEED DATA below.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local.

---

## Method note

All 8 architecture docs and all 31 migration files were read in full
(chronological order), building an actual-state model (every table's RLS
policies + grants, every `SECURITY DEFINER` function's `search_path`, every FK's
index/cascade behaviour, Storage bucket policies) and diffing it against the
docs' claims. Every finding below was independently re-verified against the
cited file:line and doc:section before being recorded here — nothing is
carried forward on trust alone.

**Result (doc-drift pass):** documentation is unusually well-synced with
schema. No BLOCKER-tier *drift* found — every RLS-enabled table's grants
matched its policies and the `auth-and-roles.md` three-layer model, with one
exception (I1, below).

**Result (production-readiness pass, added 2026-07-24):** a separate,
broader pass cross-checking app code against schema (not just docs against
migrations) surfaced two real BLOCKER-tier bugs — B1 and B2, below — plus
two more IMPORTANT items (I3, I4) and a manual pre-launch checklist for
things that can't be verified from this repo.

---

## BLOCKERS

### B1 — Hard-deleting a user or vendor breaks once bookings exist  ✅ DONE
<!-- Re-verified 2026-07-28 during a staleness audit; the item was still marked IN PROGRESS. -->
**✅ DONE — verified 2026-07-28 by reading both call sites.** Both delete paths now pre-check
`bookings` and refuse with a message that names the count and points at suspension instead:
`command/app/api/users/route.ts` DELETE counts on `booker_id`, and
`command/hooks/mutations/vendors/useDeleteVendor.ts` counts on `vendor_id`. No raw
FK-violation can reach the UI. Verification was source-read only — not exercised against a
live DB with real bookings.
**Files:** `command/app/api/users/route.ts:72-85` (DELETE handler),
`command/hooks/mutations/vendors/useDeleteVendor.ts:1-10`
**Schema:** `backbone/supabase/migrations/20260507000004_bookings.sql:22-25` —
`bookings.booker_id`, `schedule_id`, `vendor_id`, `offering_id` are all
`ON DELETE RESTRICT` (deliberate — "booking history must not be lost", per
the column comments on those same lines).

`route.ts:81` calls `supabase.auth.admin.deleteUser(id)` directly; `useDeleteVendor.ts:6`
calls `.from("vendors").delete()` directly. Neither pre-checks for existing
bookings. The first booker or vendor that has ever transacted will make
both delete actions fail with a raw Postgres FK-violation error surfaced
verbatim to the admin (`route.ts:82` returns `error.message` unmodified).
This is a real, shipped admin action that breaks on the common case, not a
hypothetical — confirmed by reading both call sites directly.

**Decision (resolved 2026-07-24):** block proactively. Before attempting
delete, count existing bookings for that user/vendor; if any exist, refuse
with a clear message pointing to the existing suspend/deactivate
(`status_id`) flow instead of attempting the delete and surfacing a raw
error. Rejected alternative: catch-and-translate the FK-violation after a
failed delete attempt — same end state for the admin, but does the wasted
delete attempt first and requires mapping Postgres error codes instead of a
simple pre-check.

**Fix approach — app-layer only, no schema/migration change:**

`command/app/api/users/route.ts` — insert before line 80 (`const supabase = createAdminClient()`
already exists above; add the check right after it, before the `deleteUser` call):
```ts
const { count } = await supabase
  .from("bookings")
  .select("id", { count: "exact", head: true })
  .eq("booker_id", id)
if (count) {
  return NextResponse.json(
    { error: `This user has ${count} booking(s) on record and cannot be deleted. Suspend the account instead to preserve booking history.` },
    { status: 400 }
  )
}
```

`command/hooks/mutations/vendors/useDeleteVendor.ts` — insert before the
existing delete call (line 6):
```ts
const { count } = await supabase
  .from("bookings")
  .select("id", { count: "exact", head: true })
  .eq("vendor_id", id)
if (count) {
  return { error: `This vendor has ${count} booking(s) on record and cannot be deleted. Suspend the vendor instead to preserve booking history.` }
}
```
- **Data:** none touched; read-only count query added.
- **Lock/perf:** negligible — one indexed count query (`bookings_booker_id_idx` /
  `bookings_vendor_id_idx` already exist per `20260507000004_bookings.sql:47-50`)
  before the existing delete attempt.
- **Downstream:** none — no schema, RLS, grant, or type change. Pure app code.
- **Reversibility:** trivial revert (remove the added block).

**Follow-up found during live testing (2026-07-24):** user ran `supabase db
reset`, attempted to delete "Citywide Sports Center" (seeded with 2
bookings), and saw a generic "Failed to delete vendor, please try again."
instead of the specific message above. Root cause: the *hook* returned the
correct message, but the *calling* components discarded it —
`command/components/vendors/VendorsPage/useVendors.ts:67` and
`command/components/users/UsersPage/useUsers.ts:74` both showed a hardcoded
generic `toast.error(...)` instead of the returned `error` string. Fixed:
both now do `toast.error(error)`. `command` re-type-checked clean (exit 0).
Create/update/status toasts in the same files were left untouched — same
generic pattern, but out of scope for B1.

<!-- 🔄 IN PROGRESS (2026-07-24) — implemented + one follow-up bug found via
     live testing and fixed (see above). Not yet ✅ DONE: user has not yet
     re-confirmed the corrected message actually appears on screen. -->

### B2 — `check_booking_capacity()` has an unmitigated TOCTOU race — concurrent bookings can overbook  ✅ DONE
<!-- Re-verified 2026-07-28 during a staleness audit; the item was still marked IN PROGRESS. -->
**✅ DONE (migration `20260724000003_booking_capacity_lock.sql`) — verified 2026-07-28 by
reading the migration.** `check_booking_capacity()` now takes `select max_capacity … for
update` on the `schedules` row before counting, so concurrent inserts for the same
`(schedule_id, booked_date)` serialise on that row lock and the second sees the first's
committed count. Verification was source-read only — **no concurrent-insert test was run**, so
the race is closed by construction rather than by demonstration.
**File:** `backbone/supabase/migrations/20260516000002_booking_capacity_trigger.sql:11-39`
**App:** `booker/services/bookings.service.ts` — plain `.insert(...)`, confirmed
no app-level locking either.

The trigger does `select count(*) ... where schedule_id = ... and booked_date = ...`
then compares against `max_capacity`, with no `SELECT ... FOR UPDATE`, no
exclusion constraint, no serializable isolation. Two concurrent booking
requests for the last slot on the same `(schedule_id, booked_date)` can both
pass the count check before either commits, both insert successfully, and
the schedule ends up overbooked past `max_capacity` — the one invariant this
trigger exists to enforce.

**Fix approach — new migration, `CREATE OR REPLACE FUNCTION`
per the established pattern for function fixes (e.g. `20260716161916_remote_schema.sql`):**
```sql
-- File: 20260724000003_booking_capacity_lock.sql (created 2026-07-24 — filename
-- date corrected from the earlier 20260723 draft to the actual creation date)
create or replace function public.check_booking_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max   int;
  v_count int;
begin
  -- Lock the schedule row for the duration of this check so a concurrent
  -- insert for the same schedule can't read a stale count before this one
  -- commits (the TOCTOU race this trigger existed to prevent but didn't).
  select max_capacity
  into   v_max
  from   public.schedules
  where  id = new.schedule_id
  for update;

  select count(*)
  into   v_count
  from   public.bookings
  where  schedule_id = new.schedule_id
    and  booked_date = new.booked_date
    and  status in ('pending', 'confirmed');

  if v_count >= v_max then
    raise exception 'Schedule is fully booked for this date (capacity: %)', v_max;
  end if;

  return new;
end;
$$;
```
- **Data:** no rewrite; function redefinition only.
- **Lock/perf:** the `for update` lock is held on the `schedules` row for the
  duration of the inserting transaction — this serializes *all* concurrent
  booking inserts against the same schedule (across all dates of that
  recurring schedule, not just the same date), trading a small amount of
  concurrency for correctness. Acceptable given booking volume; call out if
  a single popular schedule ever sees high concurrent booking traffic.
- **Downstream:** none — same function signature/trigger, no app code or
  type change.
- **Reversibility:** re-run the original `CREATE OR REPLACE FUNCTION` body
  from `20260516000002_booking_capacity_trigger.sql` in a new migration.
- **Verification:** needs a live-environment test — fire two concurrent
  inserts at the last available slot for the same schedule/date (e.g. two
  parallel `psql` sessions or a small script) and confirm exactly one
  succeeds. Not verifiable by static read alone.

<!-- 🔄 IN PROGRESS (2026-07-24) — migration file created exactly as drafted
     above. Not yet ✅ DONE: not yet applied via `supabase db reset` (user is
     running that step) and no live concurrency test has been performed. -->

## IMPORTANT

### I1 — `kyc_document_types` grant doesn't match its own RLS policy  ✅ DONE
<!-- Re-verified 2026-07-28 during a staleness audit; the item was still marked IN PROGRESS. -->
**✅ DONE (migration `20260724000001_kyc_document_types_grant_fix.sql`) — verified 2026-07-28.**
`grant insert, update, delete on public.kyc_document_types to authenticated` now backs the
`for all` RLS policy, so a command admin's write reaches the policy instead of being refused
by table privileges first.
**File:** `backbone/supabase/migrations/20260706000001_vendor_kyc.sql:37-44`
**Doc:** `architecture/schema.md:524` ("RLS: all authenticated users SELECT
… `admin`/`root` manage")

The RLS policy `"command admins write kyc_document_types"` (line 37) is
`for all` — select/insert/update/delete — scoped to command admin/root via
`is_portal_member('command') and (has_role('admin') or has_role('root'))`.
But the table grant (line 43) is `grant select … to authenticated` — no
insert/update/delete grant exists for any role except `service_role`.
PostgREST checks table-level grants *before* RLS is evaluated, so a command
admin's write attempt fails with `permission denied` regardless of role. This
is the exact bug class `20260620000001_api_role_grants.sql` was written to
prevent, recurring in a later migration that didn't cross-reference it.

**Behavior impact:** none today — confirmed no app (`command/`, `vendor/`)
has a code path that writes to this table; `vendor/services/kyc.service.ts`
hardcodes suggestions in TS rather than reading the table. This closes a
latent gap, it does not change any currently-exercised behavior.

**Fix approach — draft SQL (new migration):**
```sql
-- File: 20260724000001_kyc_document_types_grant_fix.sql (filename date
-- corrected from the earlier 20260723 draft to the actual creation date)
grant insert, update, delete on public.kyc_document_types to authenticated;
```
- **Data:** no rewrite; grant-only, instant.
- **Lock/perf:** negligible — grant statements take a brief catalog lock, no
  table lock.
- **Downstream:** none — no TS interface change (grants aren't modeled in
  hand-written interfaces), no app code change required.
- **Reversibility:** `revoke insert, update, delete on public.kyc_document_types from authenticated;`

<!-- 🔄 IN PROGRESS (2026-07-24) — migration file created exactly as drafted.
     Not yet ✅ DONE: not yet applied via `supabase db reset` (user is running
     that step); full behavioral verification (a command admin UI actually
     editing a row) remains deferred as noted below, no such UI exists yet. -->

### I2 — `vendor_members` has no index supporting its vendor_id lookup  ✅ DONE
<!-- Re-verified 2026-07-28 during a staleness audit; the item was still marked IN PROGRESS. -->
**✅ DONE (migration `20260724000002_vendor_members_vendor_id_index.sql`) — verified
2026-07-28.** `vendor_members_vendor_id_idx on public.vendor_members (vendor_id)` now supports
the `vendor_id`-only predicate in `notify_on_new_booking()`, which runs on every booking
insert. Verified by reading the migration; **no `EXPLAIN` was run** to confirm the planner
actually chooses it.
**File:** `backbone/supabase/migrations/20260504000002_schema.sql:85-91` (PK is
`(user_id, vendor_id)`, no other index; confirmed no index added in any later
migration)
**Doc:** none directly — best-practice gap (supabase-exp §6), not doc drift.

`notify_on_new_booking()` (`20260525000003_notification_triggers.sql:58-64`)
runs `where am.vendor_id = new.vendor_id and r.name = 'vendor-admin'` on
**every** `insert into bookings`. The only index on `vendor_members` is the
PK with `user_id` leading, which a `vendor_id`-only predicate can't use
efficiently — every booking insert forces a sequential scan of the table.

**Behavior impact:** none functionally — purely a query-plan/performance
change. No RLS, grant, or result-set change. Booking inserts get faster as
`vendor_members` grows; no app code or type changes needed.

**Fix approach — draft SQL (new migration):**
```sql
-- File: 20260724000002_vendor_members_vendor_id_index.sql (filename date
-- corrected from the earlier 20260723 draft to the actual creation date)
create index vendor_members_vendor_id_idx on public.vendor_members (vendor_id);
```
- **Data:** none touched; index build only.
- **Lock/perf:** plain (non-concurrent) `CREATE INDEX` takes a brief
  `SHARE` lock — blocks writes to `vendor_members` for the build duration.
  Table is small today (early-stage data), so this is sub-second; flagged
  for awareness if `vendor_members` grows much larger before this ships.
- **Downstream:** none.
- **Reversibility:** `drop index public.vendor_members_vendor_id_idx;`

<!-- 🔄 IN PROGRESS (2026-07-24) — migration file created exactly as drafted.
     Not yet ✅ DONE: not yet applied via `supabase db reset` (user is running
     that step) or confirmed via `EXPLAIN` that the planner uses the new index. -->

## SEED DATA (found + fixed 2026-07-24, out of original audit scope)

### S1 — Seeded vendors had blank structured address fields  ✅ DONE (2026-07-24)
**File:** `backbone/supabase/seed.sql` Block 3 (Vendors)

Predates `20260722000001_vendor_address_fields.sql` /
`20260722000002_vendor_barangay_strict.sql`. The insert only set the legacy
`address` column; `address_line1`, `barangay`, `barangay_code`, `city`,
`city_code`, `province`, `province_code`, `zip_code` all defaulted to `''`
(no NOT NULL violation — all have `DEFAULT ''` — but a real gap). Confirmed
`vendor/components/address/AddressFields` reads these fields for the vendor
profile edit screen, so every seeded vendor showed blank address dropdowns
despite `address` holding a full legacy string.

**Fix:** backfilled all 8 structured columns for the 3 seeded vendors
(Citywide Sports Center, Harbor Sports Complex, Summit Athletics Club) using
**real PSGC entries looked up directly from the app's own dataset**
(`vendor/public/ph-address/provinces.json`, `cities.json`,
`barangays/<cityCode>.json`) rather than placeholders — so `city_code` /
`province_code` / `barangay_code` will actually resolve on edit, matching
the column comments' stated purpose. Also recomputed `address` to match
`formatFullAddress()`'s output format for internal consistency, since
seed.sql writes directly and bypasses the app's own recompute-on-write path.

- **Data:** dev/seed only — never runs in production (file's own header:
  "THIS FILE MUST NEVER RUN IN PRODUCTION").
- **Downstream:** none — no schema or type change, seed data only.
- **Verification:** machine-verifiable via `supabase db reset` (confirms the
  insert statement is syntactically valid and the codes are real strings);
  full behavioral verification (opening the vendor profile edit screen for
  each seeded vendor and confirming the dropdowns resolve to the correct
  saved province/city/barangay) needs a live/browser check, not yet run.

### I3 — `notification_emails` has no admin visibility into delivery failures  ⬜ TODO (accepted, not actionable this round)
**Doc:** `architecture/schema.md:510` — "RLS: Enabled with no authenticated
policies — service-role-only operational data... A command-admin SELECT
policy can be added later to surface delivery failures."

Already a documented, deliberate gap — listed here only for completeness of
the production-readiness pass, not a new finding. No action this round;
revisit if/when email-delivery observability becomes a real need.

### I4 — `pg_net` extension lives in `public` schema, not the recommended `extensions` schema  ⬜ TODO
**File:** `backbone/supabase/migrations/20260716161916_remote_schema.sql:1-3`
(`drop extension if exists "pg_net"; create extension if not exists "pg_net" with schema "public";`)

Supabase's own convention keeps extensions out of `public` for namespace
hygiene (avoids cluttering the schema PostgREST exposes). Low actual risk —
`pg_net`'s functions aren't reachable via PostgREST regardless of schema —
but worth fixing opportunistically. Since a fresh consolidated migration set
is planned (see DECISIONS), the cleanest fix is to enable `pg_net` in the
`extensions` schema from the start in that rewrite rather than patching it
here with an `ALTER EXTENSION ... SET SCHEMA`.

<!-- on completion: ✅ DONE (YYYY-MM-DD) — what was executed + how verified -->

## Manual dashboard checklist (not verifiable from this repo)

These cannot be checked from migration files or app code — verify directly
on whichever Supabase project goes to production, before launch:
- Backups / point-in-time recovery enabled
- Auth rate limiting + CAPTCHA on signup
- JWT expiry / refresh-token rotation settings
- SMTP provider configured for Supabase Auth emails (password reset, invite)
  — distinct from the Resend-based notification emails, which already have
  their own setup docs (`email-secrets-setup.md`, `email-sending-domain.md`)
- Redirect URL allow-list populated with real deployed app URLs
  (`email-notifications-guide.md` already flags this as pending)
- Vault secrets (`edge_function_base_url`, the dispatch shared secret)
  actually set on the production project — `dispatch_notification_email()`
  silently no-ops if these are missing, so this is easy to forget at cutover

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains. -->
- One migration file per fix vs. bundling both in one (I1/I2) — **two
  separate files** (resolved 2026-07-23) — they're unrelated concerns (a
  grant vs. an index); matches this repo's existing pattern of single-
  purpose migration files rather than grouping unrelated fixes just because
  they share an audit date.
- B1 delete-UX approach — **block proactively with a pre-check, point to
  suspend** (resolved 2026-07-24) — see B1 for the rejected alternative
  (catch-and-translate) and rationale.
- Migration consolidation sequencing — **fix B2 + I1 + I2 now as small
  incremental migrations; do the full 33→~7 file squash as a separate
  follow-up plan later** (resolved 2026-07-24). Rejected alternative:
  squash first and bake all fixes into the consolidated files in one pass —
  more total work in one sitting and higher risk of a subtle mistake in a
  large rewrite. The remote project is confirmed scratch/throwaway, so the
  squash itself remains safe whenever it's picked up; it's sequencing, not
  safety, that was in question.

No further open decisions — B1, B2, I1, and I2 are all resolved and
implemented (2026-07-24); only the (separate, future) consolidation plan
remains unstarted by design. S1 (seed data) was an additional in-session
finding, fixed the same day with no open decision (dev-only data, single
reasonable fix).

## DEFERRED / COSMETIC

- **C1 — `vendor_status_log` has an unusable INSERT grant.** Grant migration
  (`20260620000001_api_role_grants.sql:52`) gives `authenticated` an INSERT
  grant on `vendor_status_log`, but the only INSERT policy
  (`20260511000001_vendor_approval.sql:94-96`) is `with check (false)` —
  deny-all; writes happen via a `SECURITY DEFINER` trigger instead. Fails
  closed, so no security impact — acceptable to leave; only worth tidying if
  this migration is ever touched for another reason.
- **C2 — A few audit-trail FK columns lack a supporting index:**
  `vendor_kyc.reviewed_by`, `bookings.cancelled_by`,
  `booking_status_log.changed_by`, `vendor_status_log.changed_by` (all FK →
  `profiles`). Low query volume today (not filtered on directly by any
  current feature) — defer until a "changes by this admin" report or similar
  feature needs it.

## Execution order
1. **B1** — app-layer only, no migration, no coupling to anything else.
   ✅ Implemented (2026-07-24).
2. **B2, I1, I2** — three independent, small migrations
   (`20260724000001` grant fix, `20260724000002` index, `20260724000003`
   capacity-lock fix). No coupling between them. ✅ Files created (2026-07-24);
   **not yet applied** — user is running `supabase db reset` locally.
3. **S1** — seed.sql address-field backfill. ✅ Implemented (2026-07-24),
   same caveat: not yet applied/verified via `db reset`.
4. I3 — no action (accepted gap). I4 — deferred into the future consolidation
   squash rather than fixed standalone.
5. C1/C2 — no action this round; revisit opportunistically.
6. Migration consolidation (33→~7 files) — explicitly **out of this plan's
   execution scope**; will be its own `.plans/` document when picked up.

## Verification
- **B1:** machine-verifiable — confirm the pre-check query runs before the
  delete call in both files; type-check `command/`. Full behavioral
  verification (attempting to delete a booker/vendor with real bookings and
  seeing the friendly message) needs a live environment.
- **B2:** machine-verifiable that the function was replaced (re-read the
  function body post-migration); the actual race-condition fix needs a
  live-environment concurrency test (two parallel inserts against the same
  schedule/date), not verifiable by static read alone.
- **I1:** machine-verifiable via `psql` — after applying, confirm
  `information_schema.role_table_grants` shows insert/update/delete for
  `authenticated` on `kyc_document_types`. Full behavioral verification
  (a command admin actually editing a row) needs a live environment/UI,
  which doesn't exist yet — deferred until such a UI is built.
- **I2:** machine-verifiable via `EXPLAIN` on the trigger's query before/after
  — confirm the planner switches from `Seq Scan` to `Index Scan` on
  `vendor_members`.
