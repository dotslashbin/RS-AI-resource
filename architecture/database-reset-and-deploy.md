# Database — reset, deploy, and seeding

How schema changes reach each environment, which commands are safe where, and what
`seed.sql` will and will not do to a remote project.

Read this before running anything destructive against a linked project. The
ordering in the staging runbook is not cosmetic — one step out of place leaves a
remote database half-migrated with no automatic rollback.

---

## The two commands, and the difference that matters

| | `supabase db push` | `supabase db reset` |
|---|---|---|
| What it does | Applies migrations **missing from the remote history table** | **Drops and rebuilds** from empty, re-running every migration |
| Runs `seed.sql`? | **No** — opt-in via `--include-seed` | **Yes** by default (`--no-seed` to skip) |
| Destructive? | No | **Yes, totally** |
| Use on production | ✅ this is the only one | ❌ **never** |
| Use on staging | ✅ normal case | ⚠️ only for a deliberate fresh start |
| Use locally | rarely needed | ✅ the normal local loop |

Targeting flags are the same on both: `--local`, `--linked`, or `--db-url <conn>`.

**Production only ever receives `db push`.** There is no supported path where a
hosted production database is reset, and nothing in `seed.sql` should ever reach
one — see below.

---

## What ships in migrations vs what lives in seed

This split is deliberate and load-bearing. Verified 2026-08-01: `seed.sql` inserts
into **none** of the config or lookup tables.

**Shipped by migrations — every environment gets these from `db push` alone:**

| Table | Migration |
|---|---|
| `fulfilment_patterns` (`session`, `custody`) | `20260801000001` |
| `notification_type_settings` (13 rows) | `20260525000001` + `20260801000007` |
| `platform_fee_settings` (single row, **0%**) | `20260725000001` |
| `divisions`, `statuses`, `roles`, `portals` | their own migrations |

So a clean `db push` yields a **fully working schema with an empty dataset**, which
is the correct outcome for a real environment.

**Only in `seed.sql`:** fake vendors, offerings, schedules, 41 bookings, and —
importantly — **`auth.users` rows with known passwords**.

### ⚠️ `seed.sql` writes real login accounts

Three `insert into auth.users` blocks (`seed.sql:53`, `:122`, `:857`) create
sign-in-able accounts:

| Account | Password |
|---|---|
| `root@bookdeck.com` | `Bookdeck@root1` |
| everyone else (`ben@`, `maria@`, `marco@`, …) | `DevSeed@pass1` |

On a **hosted** project these are reachable by anyone who knows the project URL.
That is acceptable for a throwaway staging environment as a *deliberate* decision;
it is never acceptable for production. (The `@bookdeck.com` addresses are also
tracked separately as D3 in `.plans/2026-07-14-app-name-env-var.md`.)

**None of these inserts carry `on conflict` handling.** Running seed against a
database that already holds those users fails on a duplicate key — see recovery
below.

---

## Local — the normal loop

```bash
cd backbone
npx supabase db reset          # migrations from empty, then seed.sql
```

Seeding is on by default: `config.toml` has `[db.seed] enabled = true` with
`sql_paths = ["./seed.sql"]`. There is **no separate seed command to run** — the
reset does it.

To apply new migrations without losing local data:

```bash
npx supabase migration up --local
```

Worth knowing: `migration up` exercises the **backfills** in a migration against
real rows, which a reset never does (a reset applies migrations to empty tables,
then seeds). Both paths are worth testing before a remote deploy.

---

## Staging — deliberate fresh start

Use when you want staging to mirror local exactly, and you accept losing
everything currently in it.

### 1. Enable `pg_cron` in the dashboard FIRST

**Database → Extensions → pg_cron.**

`20260801000006` runs `create extension if not exists pg_cron` and
`cron.schedule(...)`. That migration is written to **fail loudly** rather than
silently ship without the auto-acknowledge job — so if the extension is
unavailable, the reset dies partway through the chain and leaves the project
half-migrated. Enabling it first makes the `if not exists` a no-op.

This is the single most likely step to go wrong, and the only one whose failure is
messy rather than clean.

### 2. Confirm which project you are pointed at

```bash
cat backbone/supabase/.temp/project-ref
```

The next command is irreversible. Check this even when you are sure.

### 3. Reset

```bash
cd backbone
npx supabase db reset --linked
```

Prompts for the database password. Applies every migration from empty, then runs
`seed.sql`.

### 4. Verify — these five queries, not a glance at the UI

```sql
select max(version) from supabase_migrations.schema_migrations;
-- expect the latest migration timestamp

select code from public.fulfilment_patterns order by sort_order;
-- expect: session, custody

select count(*) filter (where status_changed_at is null) as null_ts,
       count(*)                                          as bookings
from public.bookings;
-- expect null_ts = 0

select count(*) as completed_but_held
from public.bookings b
join public.booking_transactions bt on bt.booking_id = b.id
where b.status = 'completed' and bt.payout_status = 'held';
-- expect 0

select jobname, schedule from cron.job;
-- expect: auto-acknowledge-bookings @ 0 * * * *
```

The last two matter most. A non-zero fourth result means seed's **Block 9d** did
not run, and payout views will look broken. An empty `cron.job` means pg_cron
silently did not take, and **nothing will ever auto-acknowledge**.

### 5. Set the platform fee

`platform_fee_settings` seeds at **0%** from its migration — deliberately, so no
migration ever starts charging vendors on its own. `seed.sql` sets a demo 12%.
Confirm the rate through **Command → Settings** rather than assuming.

### 6. Classify rental offerings

Every offering created outside seed defaults to `fulfilment_pattern = 'session'`.
Seed's Block 4b marks `COURT` offerings as `custody`; anything else needs setting
through the vendor offering form before a rental is tested. See dual-acknowledgement
I6.

### Recovery — reset fails on duplicate `auth.users`

Means the reset preserved the managed `auth` schema. Clear the seeded accounts and
re-run:

```sql
delete from auth.users where email like '%@bookdeck.com';
```

```bash
npx supabase db reset --linked
```

Have this ready *before* starting rather than discovering it mid-reset.

---

## Staging — routine update (no data loss)

The normal case once staging exists and holds data you want to keep.

```bash
cd backbone
npx supabase db push --linked --dry-run    # what would apply
npx supabase db push --linked              # apply
```

Do **not** pass `--include-seed`.

**Before pushing to a staging project that holds data**, take a baseline — the
backfills in a migration act on real rows here, unlike a fresh reset:

```sql
select status, count(*) from public.bookings group by status;
select count(*) from public.booking_transactions;
select count(*) from public.offerings;
```

Specifically for the fulfilment migrations: any existing `completed` booking has
its transaction backfilled to `releasable`, which makes those vendors immediately
appear owed money. Know that before, not after.

---

## Production

- **`db push` only.** Never `db reset`, never `--include-seed`.
- Check `.temp/project-ref` before every command.
- Enable `pg_cron` before the first push, for the reason in staging step 1.
- Set `platform_fee_settings.fee_percent` after the first push — it arrives at 0,
  so until it is set the platform earns nothing on every booking.
- Take the baseline queries above before any migration carrying a backfill.

Consider `[db.seed] enabled = false` in a production-facing config profile as
belt-and-braces against an accidental `--include-seed`.

---

## Related

- `schema.md` — table-by-table reference, and the migration table
- `booking-flow.md` — the fulfilment state machine these migrations implement
- `.plans/2026-07-31-booking-fulfilment-dual-acknowledgement.md` — **I24** carries
  the production cutover checklist
