# Supabase Production Setup

Status: **Executed** — production stood up on 2026-08-10. Retained as the runbook for
the next project (a second staging, a rebuild, a recovery).
Last reviewed: 2026-08-10

## What actually happened, 2026-08-10

Production is **`pdkejyjidrfxksaczvfy`**. The previous project,
**`fbxbwnfeimzhgxpshdpa`**, now serves as staging. Domain mapping is in
`overview.md` → "Environments".

Done and verified:

| Step | Outcome |
|---|---|
| `db push --linked` | 28 pending migrations applied; **58/58 now applied, 0 pending** |
| Ordering | All pending migrations sorted *after* the last applied one, so **no `--include-all`** was needed |
| Sample data | None. `db push` reported `seeds: []` — `seed.sql` is wired to `db reset` only, which is never run here |
| Lookup rows | All arrive via migrations: `statuses`/`roles`/`portals`, `divisions`, `notification_type_settings`, `kyc_document_types`, `platform_fee_settings` |
| Extensions | `pg_net` and `supabase_vault` were **already installed** by an earlier applied migration; only `pg_cron` was new |
| Edge Functions | `send-notification-email` and `send-push-notification` both ACTIVE (v4); email function correctly at `verify_jwt: false` |
| Auth SMTP | Resend configured, `no-reply@ezzy.ph` — confirmed by a real recovery email |
| Root user | `bootstrap-root.mjs` run; password set through the recovery flow |

Corrections to what this guide assumed:

- **The project was not empty.** 30 migrations were already applied before the first
  `db push`. Every table was still at zero rows, so the backfills in the pending set were
  no-ops — but "fresh project" and "no data" are different claims, and only the second
  was true.
- **`supabase config` has no read command,** only `push`. There is no CLI way to inspect
  hosted auth settings; they must be read in the dashboard. And **never run
  `config push`** — see the warning in `overview.md`.
- Several dashboard pages moved. SMTP is now **Authentication → Emails → SMTP Settings**;
  the rate limit is its own page, **Authentication → Rate Limits**; URL config is
  **Authentication → URL Configuration**. Vault is not in the Extensions list because it
  is always-on and managed.

**Still open on production** (not blockers for the current state, but do them before
opening vendor sign-ups):

- `enable_signup` is still **true** — measured via the public `/auth/v1/settings`. Anyone
  with the anon key can call `auth.signUp()` and create rows outside the registration
  routes. Safe to turn off: all three registration paths use `auth.admin.createUser`,
  which the flag does not gate, and no app calls `auth.signUp()` (verified by grep across
  all five clients).
- `platform_fee_settings.fee_percent` arrives at **0** — the platform earns nothing until
  it is set.
- `minimum_password_length` and leaked-password protection are unverified; the settings
  endpoint does not expose them.

This guide covers setting up a separate production Supabase project for the RS
ecosystem. It assumes the production project already exists and is separate from
local, staging, and any development Supabase project.

The goal is:

- apply the existing `backbone` migrations to the production database
- confirm exactly which required reference/configuration rows are created by
  migrations
- avoid loading any development fixture data into production
- create the first Command root user
- configure the hosted apps and mobile builds to point at production safely

This guide does not change the schema. Any schema change still needs a new
migration and the normal approval gate.

## Hard Rules

- Run production database commands from `backbone/`, not the workspace root.
- Use `supabase db push` for production migrations.
- Do not run `supabase db reset --linked` against production.
- Do not run `supabase db push --include-seed` against production.
- Do not run `backbone/supabase/seed.sql` against production.
- Do not commit Supabase access tokens, database passwords, anon keys, service
  role keys, or any other secret.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only. It must never be added
  to a mobile app, `EXPO_PUBLIC_*`, or client-side web code.

Official CLI references:

- `supabase link`: https://supabase.com/docs/reference/cli/supabase-link
- `supabase db push`: https://supabase.com/docs/reference/cli/supabase-db-push
- seeding behaviour: https://supabase.com/docs/guides/local-development/seeding-your-database

## What Migrations Seed

Your expectation is mostly correct: production migrations seed only data that is
required for the app to boot and enforce its foreign-key/configuration contracts.
That includes lookup tables such as divisions, but it is slightly broader than
lookup tables.

The existing migrations seed these production-safe rows:

| Area | Table/object | Seeded values |
| --- | --- | --- |
| Core lookups | `public.statuses` | `active`, `suspended`, `pending_activation` |
| Core lookups | `public.portals` | `vendor`, `booker`, `command` |
| Core lookups | `public.roles` | `root`, `admin`, `member`, `vendor-admin` |
| Divisions | `public.divisions` | `EzzyDrive`, `EzzyCare`, `EzzyWell`, `EzzyCourt`, `EzzyFood`, `EzzyRide`, `EzzyHome`, `EzzyPets`, `EzzyLaw`, `EzzyPark`, `EzzyLearn`, `EzzyWork`, `EzzyStay` |
| Fulfilment | `public.fulfilment_patterns` | `session`, `custody` |
| Notifications | `public.notification_type_settings` | 16 enabled notification types: booking lifecycle, payment, registration, fulfilment, dispute, and vendor KYC lifecycle types |
| Email controls | `public.notification_email_settings` | one enabled email switch per portal |
| Push controls | `public.notification_push_settings` | one enabled push switch per portal |
| Fees | `public.platform_fee_settings` | singleton row with `fee_percent = 0` |
| KYC guidance | `public.kyc_document_types` | `business_permit`, `registration`, `authorized_rep_id`, `government_id`, `selfie_with_id`, `proof_of_address` |
| Storage | `storage.buckets` | private `vendor-kyc` bucket |
| Realtime | `supabase_realtime` publication | `notifications` and `bookings` tables |
| Scheduling | `cron.job` | hourly `auto-acknowledge-bookings` job |
| Extensions | database extensions | migrations require/enable `pg_net`, `supabase_vault`, and `pg_cron` usage |

The migrations do not seed production users, vendors, offerings, staff,
schedules, bookings, payments, notifications, KYC submissions, storage files, or
wallet/transaction history.

## What `seed.sql` Contains

`backbone/supabase/seed.sql` is development fixture data only. Its header says it
must never run in production.

It creates hardcoded local/dev auth accounts, fake vendors, vendor members,
offerings, staff, schedules, bookings, payments, notifications, and other demo
records. This data is useful for local reset workflows only.

In this repo, local `supabase db reset` runs migrations and then `seed.sql`
because `backbone/supabase/config.toml` has seeding enabled. Hosted production
does not run `seed.sql` when you use plain `supabase db push`.

## Preflight

Before touching production:

1. Confirm the production Supabase project ref.
2. Confirm you have Supabase dashboard owner/admin access.
3. Confirm the production project is empty or intentionally ready to receive all
   migrations.
4. Confirm production URLs for:
   - Command web app
   - Vendor web app
   - Booker web app
   - mobile deep links, if password reset or auth handoff will use them
5. Confirm production email sending is ready enough for root password recovery.
   The preferred root bootstrap script creates the root auth user without a
   password, so password recovery must work.
6. Confirm `pg_cron` is available/enabled in the production project before
   pushing migrations. The migration that schedules auto-acknowledgement depends
   on it.

Useful production URL placeholders:

```text
COMMAND_URL=https://<command-production-domain>
VENDOR_URL=https://<vendor-production-domain>
BOOKER_URL=https://<booker-production-domain>
SUPABASE_URL=https://<production-project-ref>.supabase.co
```

## Configure Supabase Auth URLs

In the production Supabase dashboard, configure Auth URL settings before
creating the root user.

Set the Site URL to the primary production app that should receive generic auth
links. Command is the safest default because the first user is a Command root:

```text
https://<command-production-domain>
```

Add exact redirect URLs for every production app flow that Supabase Auth may
redirect to. At minimum, include the production web origins or the specific
callback/reset URLs your apps use:

```text
https://<command-production-domain>/*
https://<vendor-production-domain>/*
https://<booker-production-domain>/*
```

If mobile password reset or auth redirects are supported, add the exact Expo
scheme/deep-link URLs used by each mobile app. Do not guess these values. Check
the app config before adding them.

## Link The CLI To Production

Run these commands from `backbone/`.

```bash
cd backbone
npx supabase login
npx supabase link --project-ref <production-project-ref>
```

Then verify you are linked to the intended project before applying anything:

```bash
npx supabase migration list --linked
```

If you regularly switch between staging and production, treat the linked project
as volatile local state. Re-check it every time before `db push`.

## Dry Run Migrations

Preview the production migration plan:

```bash
npx supabase db push --dry-run
```

Review the pending migrations. For a new production project, the expected result
is that all existing migrations are pending.

Do not add `--include-seed`.

## Apply Migrations

After the dry run looks correct:

```bash
npx supabase db push
```

This applies migrations that are not yet recorded in the hosted project's
`supabase_migrations.schema_migrations` table.

Do not use:

```bash
npx supabase db reset --linked
npx supabase db push --include-seed
```

## Verify Production Data

Run these checks in the Supabase SQL editor after the migration push.

```sql
select max(version) as latest_migration
from supabase_migrations.schema_migrations;

select name from public.statuses order by id;
select name from public.portals order by id;
select name from public.roles order by id;

select name, slug
from public.divisions
order by sort_order, name;

select code, label
from public.fulfilment_patterns
order by sort_order;

select type, is_enabled
from public.notification_type_settings
order by type;

select portal, is_email_enabled
from public.notification_email_settings
order by portal;

select portal, is_push_enabled
from public.notification_push_settings
order by portal;

select id, fee_percent
from public.platform_fee_settings;

select code, label, applies_to
from public.kyc_document_types
order by sort_order, code;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'vendor-kyc';

select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('notifications', 'bookings')
order by tablename;

select jobname, schedule, active
from cron.job
where jobname = 'auto-acknowledge-bookings';
```

Expected row counts:

| Query area | Expected |
| --- | --- |
| `statuses` | 3 |
| `portals` | 3 |
| `roles` | 4 |
| `divisions` | 13 |
| `fulfilment_patterns` | 2 |
| `notification_type_settings` | 16 |
| `notification_email_settings` | 3 |
| `notification_push_settings` | 3 |
| `platform_fee_settings` | 1 |
| `kyc_document_types` | 6 |
| `storage.buckets where id = 'vendor-kyc'` | 1 |
| realtime publication tables | `bookings`, `notifications` |
| `auto-acknowledge-bookings` cron job | 1 active job |

If these checks pass and there are no auth users, vendors, bookings, or demo
records, production has the expected clean baseline.

## Create The First Root User

There are two supported paths. Use one.

### Option A: Bootstrap Script

This is the preferred path when password recovery email is already working. It
creates one confirmed auth user, creates/updates the matching profile, grants the
Command portal, grants the `root` role, and refuses to run if any root already
exists.

Run a dry run first:

```bash
cd backbone
SUPABASE_URL=https://<production-project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<paste-service-role-key-in-shell-only> \
node scripts/bootstrap-root.mjs --email <root-email> --name "<Root Name>" --dry-run
```

Then run it for real:

```bash
cd backbone
SUPABASE_URL=https://<production-project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<paste-service-role-key-in-shell-only> \
node scripts/bootstrap-root.mjs --email <root-email> --name "<Root Name>"
```

After that:

1. Open the production Command app.
2. Use the password recovery flow for `<root-email>`.
3. Set the root user's password.
4. Sign in to Command.
5. Create any additional admins through Command.

Do not write the service role key to a file. Use it only as a one-off shell
environment variable or a secure secret store.

### Option B: Dashboard User Plus SQL Bootstrap

Use this path if you want to create the auth user and password directly in the
Supabase dashboard.

1. In Supabase Dashboard, go to Authentication, then Users.
2. Add a new user.
3. Use the real root email.
4. Auto-confirm the user.
5. Set an initial password in the dashboard.
6. Open `backbone/supabase/bootstrap/production-root.sql`.
7. In the SQL editor, set only the `v_email` and `v_name` values in that script.
8. Run the script.

That SQL script is not a migration. It is an operational bootstrap script for the
first production root. It grants only:

- Command portal access
- `root` platform role
- active profile status

Verify the root user:

```sql
select
  p.email,
  p.full_name,
  s.name as status,
  r.name as role,
  string_agg(po.name, ', ' order by po.name) as portals
from public.profiles p
join public.statuses s on s.id = p.status_id
join public.user_roles ur on ur.user_id = p.id
join public.roles r on r.id = ur.role_id
join public.user_portals up on up.user_id = p.id
join public.portals po on po.id = up.portal_id
where r.name = 'root'
group by p.email, p.full_name, s.name, r.name
order by p.email;
```

After the first root is working, create a second break-glass root or admin using
Command or the manual dashboard/SQL path. The bootstrap script intentionally
refuses to create another root after one exists.

## Configure Runtime Secrets And Environment Variables

For each Vercel app, point production at the production Supabase project:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<production-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production-anon-key>
```

Only server-side web code may receive:

```text
SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>
```

Do not add `SUPABASE_SERVICE_ROLE_KEY` to browser-exposed variables, mobile
variables, or any `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` key.

For Expo/EAS mobile builds, use production mobile environment variables with the
Expo public prefix:

```text
EXPO_PUBLIC_SUPABASE_URL=https://<production-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<production-anon-key>
```

Set these in EAS project/environment configuration, not in committed files.

## Configure Email And Push Delivery

The database migrations create notification tables, switches, and dispatch
triggers, but production delivery still depends on hosted configuration.

Email:

- deploy the `send-notification-email` Edge Function
- set required Supabase function secrets
- set Resend/domain secrets according to the email setup docs
- remove any production email override only when you are ready to send to real
  recipients

Push:

- deploy the `send-push-notification` Edge Function when push is ready for
  production
- configure any required function secrets
- confirm push settings are enabled per portal
- confirm mobile apps register device tokens only after user permission

Related local docs:

- `architecture/email-secrets-setup.md`
- `architecture/email-setup-local-and-remote.md`
- `architecture/email-notifications-guide.md`

## Deploy Apps Against Production

After the database and first root are ready:

1. Configure production environment variables in each Vercel project:
   `command`, `vendor`, and `booker`.
2. Configure production environment variables in each EAS project:
   `ezzy-vendor-mobile` and `ezzy-booker-mobile`.
3. Deploy Command first so the root user can manage production access.
4. Deploy Vendor and Booker after Command is verified.
5. Build mobile apps only after their production env vars and redirect URLs are
   confirmed.

Each app remains its own repo and deployment project. Production Supabase is the
shared backend boundary.

## Smoke Test Checklist

Run the lightest possible production smoke test:

- Command root can recover password and sign in.
- Command can load users, roles, portals, notification settings, and platform fee
  settings.
- Platform fee row exists and is still `0` until intentionally changed.
- Vendor and Booker apps can reach Supabase with production anon credentials.
- Public registration flows work only as intended.
- Vendor KYC bucket exists and is private.
- Notification type settings load in Command.
- Email dispatch is either confirmed working or intentionally held behind an
  override.
- Push dispatch is either confirmed working or intentionally disabled per portal.
- No development users, vendors, bookings, or demo data exist.

## Rollback Notes

For production, rollback should be planned as a forward migration unless the
project is still empty and before go-live. Do not edit already-applied migration
files.

If a migration push fails:

1. Stop.
2. Capture the failing migration name and database error.
3. Do not run `db reset --linked`.
4. Fix with a new migration if anything was already applied.
5. Re-run `npx supabase db push --dry-run` before trying again.

## Review Questions

- Which domain should be the production Auth Site URL: Command only, or another
  app?
- Which exact password reset/callback URLs do the production web apps use?
- Which exact mobile deep links should be allow-listed for EAS builds?
- Should production launch with email override enabled for a short smoke-test
  window?
- Who should be the first root, and who should be the second break-glass root?
