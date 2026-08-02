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

## First, find out what has actually drifted

Do this before choosing a command. It is read-only, takes seconds, and repeatedly
turns out to contradict what you assumed:

```bash
cd backbone
npx supabase migration list --linked
```

Each row pairs the local migration with its remote counterpart; an **empty
`remote`** means not yet applied. Reading it beats guessing — on 2026-08-02 this
showed staging was behind by exactly the nine `20260801*` fulfilment migrations
and nothing else, while `20260724000004_divisions.sql` — which `schema.md` had
warned was stranded on a feature branch and missing from hosted — was in fact
already applied. That one command replaced two wrong assumptions.

If the gap is only migrations and you want to keep remote data, you want `db push`.
Reach for `db reset` only when you also want `seed.sql`'s dataset and accept losing
what is there.

---

## What ships in migrations vs what lives in seed

This split is deliberate and load-bearing. Verified 2026-08-01 and re-confirmed
2026-08-02: `seed.sql` inserts into **none** of the config or lookup tables —
`divisions` included, which is why the lookup arrives from `db push` alone and
needs no seed run.

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

Passwords are **distinct per account** — not one shared password (corrected
2026-08-02; this table previously claimed everyone shared `DevSeed@pass1`).

| Account | Password | | Account | Password |
|---|---|---|---|---|
| `root@bookdeck.com` | `Bookdeck@root1` | | `clara@` | `DevSeed@pass6` |
| `marco@` | `DevSeed@pass1` | | `dante@` | `DevSeed@pass7` |
| `liza@` | `DevSeed@pass2` | | `pia@` | `DevSeed@pass8` |
| `jun@` | `DevSeed@pass3` | | `gab@` | `DevSeed@pass9` |
| `ana@` | `DevSeed@pass4` | | `sofia@` | `DevSeed@pass10` |
| `rico@` | `DevSeed@pass5` | | `jose@` | `DevSeed@pass11` |
| | | | `maria@` | `DevSeed@pass12` |
| | | | `ben@` | `DevSeed@pass13` |
| | | | `carla@` | `DevSeed@pass14` |
| | | | `dino@` | `DevSeed@pass15` |

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

## Why "it worked locally" predicts nothing about hosted

The local stack is not a smaller copy of hosted. Every divergence below has bitten
this project at least once, and all four were confirmed here rather than assumed.
When a remote run fails and the local one passed, start with this list.

| Divergence | Local | Hosted | Symptom |
|---|---|---|---|
| **Session `search_path`** | `"$user", public, extensions` — so unqualified `gen_salt`/`crypt` resolve | seeding role lacks `extensions` | `42883 function … does not exist` |
| **Extension availability** | CLI image ships them; migrations just `create extension` | must be enabled in the dashboard first | chain dies mid-migration, project left half-applied |
| **`auth` schema on reset** | dropped and rebuilt with everything else | managed, often **preserved** | duplicate key on `auth.users` |
| **Backfills in migrations** | reset applies them to *empty* tables, so they no-op | run against real rows | logic never exercised locally ships broken |

The generalisable rule: **schema-qualify anything that lives outside `public`.** A
bare function name is a bet on the caller's `search_path`, and that bet is only
safe in the environment you happened to test in. This applies to `pgcrypto`
(`crypt`, `gen_salt`, `digest`, `hmac`), and to any future extension function used
from `seed.sql` or a migration.

The last row is the sneakiest, because nothing errors — the local reset simply
never runs the backfill. If a migration carries one, test it with
`npx supabase migration up --local` against a seeded database, not only via reset.

---

## Staging — deliberate fresh start

Use when you want staging to mirror local exactly, and you accept losing
everything currently in it.

> Proven end-to-end against hosted on **2026-08-02** — every step below, including
> both recoveries, reflects an actual run rather than an intended one.

### 1. Enable `pg_cron` in the dashboard FIRST

**Database → Extensions → pg_cron.**

`20260801000006` runs `create extension if not exists pg_cron` and
`cron.schedule(...)`. That migration is written to **fail loudly** rather than
silently ship without the auto-acknowledge job — so if the extension is
unavailable, the reset dies partway through the chain and leaves the project
half-migrated. Enabling it first makes the `if not exists` a no-op.

This is the single most likely step to go wrong, and the only one whose failure is
messy rather than clean.

**The dashboard will ask you for a schema and offer only `pg_catalog`. That is
correct — accept it.** `pg_cron`'s control file declares `schema = pg_catalog` with
`relocatable = false`, so the extension fixes its own placement and there is
nothing else to choose. (Contrast `pg_net`, which *is* relocatable and sits in
`public` — that one gives a real dropdown.)

That registration is bookkeeping, not object placement. pg_cron's install script
creates its own `cron` schema and puts everything there — `cron.job`,
`cron.job_run_details`, and 7 functions including `cron.schedule()`. So the
`cron.schedule(...)` call in `20260801000006` resolves normally. Choosing
`pg_catalog` does **not** put `cron.job` in `pg_catalog`.

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

### Recovery — `function gen_salt(unknown) does not exist` (SQLSTATE 42883)

Hit on the **hosted** seed run, 2026-08-02. `gen_salt` and `crypt` are `pgcrypto`
functions, and on Supabase — hosted *and* local — `pgcrypto` installs into the
**`extensions`** schema, not `public`:

```
extname  | schema
pgcrypto | extensions
```

Locally the seed worked only because the CLI's session `search_path` is
`"$user", public, extensions`, so bare `gen_salt` still resolved. The role the CLI
seeds with against hosted does not carry `extensions` on its path, so the same SQL
fails there. **A seed that passes locally proves nothing about hosted for anything
pgcrypto-backed.**

Fixed by schema-qualifying all 16 call sites in `seed.sql`:

```sql
extensions.crypt('DevSeed@pass1', extensions.gen_salt('bf'))
```

This is portable — it resolves in both environments, whereas patching
`search_path` only papers over the role difference. Migrations were checked and
use **no** pgcrypto functions, so `db push` was never affected; this was
seed-only. Apply the same qualification to any future `crypt`/`gen_salt`/`digest`/
`hmac` use.

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
