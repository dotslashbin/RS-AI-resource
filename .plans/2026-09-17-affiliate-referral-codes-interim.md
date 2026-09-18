# Affiliate Referral Codes — Interim (vendor signup attribution)

**Date:** 2026-09-17
**App / scope:** `backbone/` (migration) · `command/` (create Affiliate users) · `vendor/` (signup captures a referral code)
**Status:** IN PROGRESS — approved 2026-09-17. S1 files written; awaiting your apply and the
S1.3 checks. S2–S4 not started.

> Give Command a way to create **Affiliate** users who each own a unique referral
> code, let vendor signup capture that code from a `?ref=` link, store who referred
> each vendor, and report on it with one SQL query. Build only the parts the future
> affiliate portal will reuse. Build nothing we would have to undo.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** S# = execution stage, B#/I# = items inside this plan,
> D# = decision. Numbers are plan-local; qualify cross-plan refs by app.

> ⚠️ **Approval gates in play:** schema change (new role, 2 tables, RLS, grants),
> security-related change (who can sign in), and **three apps in one task**
> (`backbone` + `command` + `vendor`). Each app is committed in its own repo.

---

## Scope

**In:** Affiliate role · `affiliates` table with an admin-typed referral code ·
Command can create Affiliates · `?ref=` link captured at vendor signup ·
server-side validation · `vendor_referrals` attribution table · export SQL.

**Out (this phase):** affiliate login/portal/dashboard, commissions, payouts,
analytics UI, self-service, managing multiple codes or links per affiliate,
editing a code after creation, attributing vendors that Command creates by hand
(`VendorFormModal`), changing attribution after signup, and any mobile work.
`ezzy-vendor-mobile` has no registration screen (`src/app/` has sign-in only),
so it has nothing to change.

---

## Simplest Flow

**End to end**

```
Creating the Affiliate
  Command admin → Users → Add User → role "Affiliate", name, email,
  referral code TYPED BY THE ADMIN (e.g. JUAN2026), no portals
        │
Storing the code
  POST /api/users → checks the code is free → creates the user → saves the code
  in affiliates → toast + the user's detail view show the code and the share link
        │
Sharing the referral URL
  admin (or, later, the affiliate) shares  https://vendor.ezzy.ph/?ref=JUAN2026
        │
Vendor signup
  vendor opens link → registration opens at step 1 → the code rides along
  INVISIBLY (no field on the form) → steps 1–6 exactly as they are today → Submit
        │
Storing the attribution
  register route looks the code up → valid + affiliate active → creates the
  user + vendor + vendor_referrals row in one rollback-safe request
        │
Reporting
  ops runs the export SQL (below) → one row per referred vendor → into a spreadsheet
```

**Signup without a referral**
```
vendor opens https://vendor.ezzy.ph/ → registers normally
→ vendor created → NO vendor_referrals row → not in the report
```

**Signup with a valid referral**
```
?ref=JUAN2026 → code carried invisibly through the wizard → Submit
→ server checks: code exists AND the affiliate's profile is active
→ vendor created → vendor_referrals row written → shows up in the report
```

**Signup with an invalid referral** (D2 — silently ignored)
```
?ref=JUAN206 (typo), or a code belonging to a suspended affiliate
→ the wizard behaves identically; the vendor sees nothing and is never blocked
→ Submit succeeds → vendor created → NO vendor_referrals row is saved
→ the vendor simply does not appear in the report
```

> ⚠️ **Accepted consequence of D2 + D4:** a mistyped or stale link is invisible to
> everyone — the vendor, the affiliate and Command — until someone runs the export
> and notices a vendor missing. Mitigations: codes are admin-chosen and memorable,
> Command shows the full share link for copying, and the register route logs a
> warning whenever a `ref` was present but did not resolve, so it is diagnosable
> after the fact.

---

## Findings from investigation (what the design is built on)

These were checked in the code, not assumed.

1. **There is no `/vendor/signup` route.** The vendor app is a single-route SPA.
   Registration is a 6-step wizard inside the login screen at `/`
   (`vendor/components/auth/LoginPage/`). Deep links already work there:
   `/?division=<slug>` opens registration at step 1 with the division filled in
   (`vendor/lib/divisionDeepLink.ts`, applied in `useLoginPage.ts:106-164`).
   **`?ref=` should use exactly the same method.**
2. **Query params must be read when the module loads.** `AppShell` rewrites the
   query string before `LoginPage` mounts and drops any param it doesn't recognise.
   `divisionDeepLink.ts:1-25` explains why reading it any later fails. A `ref`
   param read in a React effect would already be gone.
3. **Roles are rows in `roles`** (`20260504000001_lookup_tables.sql:41`, ids 1–4,
   identity). Platform roles go in `user_roles`, which has no role constraint.
   `vendor_members` is limited to roles 3 and 4 (`20260504000002_schema.sql:98`),
   and that doesn't change.
4. **Portal membership is the login gate.** Each portal refuses a user with no
   `user_portals` row for it: vendor `verifyVendorAccess`
   (`vendor/services/vendor-access.service.ts:64-65`), command
   `verifyCommandAccess` (`command/services/command.service.ts:19-20`, which also
   needs admin or root), and booker `verifyBookerAccess`. An Affiliate with **no
   portals** is refused everywhere without any Affiliate-specific check.
5. **Command-created users have no password.** The set-password email only goes
   out if the user has a portal (`command/app/api/users/route.ts:108-125` →
   `resolvePortalOrigin`). An Affiliate with no portals gets no email, so by
   default it has no way to sign in.
6. **A leftover risk:** the Affiliate could still use *Forgot Password* on any
   portal, set a password, and get a valid Supabase session. The portal gate
   then signs them out. With the raw JWT, RLS would still let an active user
   with no portals read **active vendors** (`20260515000001`, gated only by
   `is_active()`), plus the lookup tables and `divisions`. That is public
   catalogue data. Accepted — see D3.
7. **The referral can't be a column on `vendors`.** The `vendors` UPDATE policy
   lets a vendor-admin update their **whole row**
   (`20260504000003_rls.sql:159-162`), so a vendor could change or erase their own
   `referred_by`. A separate table with no write grant for `authenticated` avoids
   that. It also gives commission fields a place to go later.
8. **Command's Users page would show an Affiliate as "Member".**
   `command/services/users.service.ts:57-61` only recognises root, admin and
   member and falls back to `"member"`. `UserRole` (`command/lib/types.ts:3`) and
   `ALL_ROLES` (`command/lib/constants.ts:35`) only list those three.
9. **There is no "owner" column for a vendor.** A vendor can have several
   `vendor-admin` members, and payout statements email all of them
   (`20260913000001_payout_statements.sql:266-273`). But the registering user's
   membership is always the first one written for a self-registered vendor
   (`register/route.ts`, step 4). **Primary vendor user = the vendor-admin with the
   earliest `vendor_members.granted_at`** (ties broken by `user_id`). The export
   query uses this definition.
10. **The email check blocks self-referral by email.** `isEmailAvailable` reads
    `profiles` (`vendor/lib/emailAvailability.ts`). An Affiliate's email already
    has a profile, so an affiliate cannot register a vendor with their own email.
    That is acceptable for now.
11. **Registration validation lives in one module.** Both routes use it
    (`vendor/lib/registration.ts:17-21`: "if you add a rule, add it here, not in a
    route"), so referral normalising goes there.
12. **No new public endpoint is needed.** D2 + D4 removed the planned
    `check-referral` route, which would have been an unauthenticated
    code-guessing oracle needing its own rate-limit rule (`check-email/route.ts:18`).
    Not adding it is strictly safer.

---

## Gap review (2026-09-17) — what the first draft got wrong or missed

Each was checked in the code. Corrections are folded into the items below; this
section keeps the reasoning.

| # | Gap | Category | Where it landed |
|---|-----|----------|-----------------|
| G1 | **"Type-check will catch every role map" — false.** `ROLE_CFG` is `Record<string, BadgeConfig>` with a `??` fallback (`command/lib/constants.ts:95-99`, `components/ui/RoleBadge/RoleBadge.tsx:9`). A missing `affiliate` entry compiles fine and renders a grey badge reading "affiliate". | Escalate | B1 — explicit `ROLE_CFG` entry |
| G2 | **`useCreateUser` whitelists fields in both directions.** It builds the POST body from six named fields and rebuilds the result object (`command/hooks/mutations/users/useCreateUser.ts:6-27`), so `referralCode` must be added to the body, to `UserFormData` (`lib/types.ts:138-145`) and to the returned object, or it is silently dropped at both ends. | Missed | B1, B4, B6 |
| G3 | **The ui-gallery `User` fixture breaks.** `USERS: User[]` (`command/app/ui-gallery/page.tsx:426`) is a typed literal, so a required `referralCode` on `User` is a compile error there. | Missed | B1 (nullable field + an Affiliate row added to the fixture) |
| G4 | **Command visual baselines: verified NOT affected.** The committed specs cover `mode=vendors`, `payouts`, `markpaid`, `withholding`, `seo` (`command/visual-tests/`), and none render `UserModal`. The gallery has user modes but nothing screenshots them. So the UserModal change adds no baseline churn. | False alarm (good news) | S2 verification note |
| G5 | **`architecture/conventions.md:586-619` was missing from the doc list.** "The shell owns the query string" names the two module-load readers by file; a third one has to be listed there or the next person re-learns it the hard way. | Missed | I1 |
| G6 | **D4 removes the only observable signal.** The `?division=` deep link is regression-tested through the DOM (`vendor/visual-tests/division-deeplink.spec.ts`) because the selected division is *visible*. A hidden referral code has nothing to assert, and `conventions.md:619` records that this exact class of bug (an effect-ordering regression) survived eleven days behind a green suite. | Escalate | **D7 (OPEN)** + B17, B18 |
| G7 | **An Affiliate created as `pending_activation` silently attributes nothing** — B9 requires an active profile. The create form defaults to `active`, but the operator can change it. | Missed | B6 (inline hint) |
| G8 | **Switching an existing user to Affiliate through Edit** would write the role row with no `affiliates` row, producing a role with no code. `useUpdateUser` reconciles roles directly against Supabase (`hooks/mutations/users/useUpdateUser.ts:88-95`), so the UI alone is not a boundary. | Missed | B2 (guard in the shared helper), B7 |
| G9 | **Vendor account closure keeps the referral.** Closure *scrubs* the vendor row and deletes its `vendor_members` (`command/lib/accountDeletion/execute.server.ts:260-321`); it does **not** delete the vendor and does **not** scrub `vendors.name`. So a closed vendor still appears in the report, with its name and blank user columns. Correct behaviour — the referral happened — but it must be documented, not discovered. | Missed | Export SQL notes |
| G10 | **PostgREST embed shape is not guaranteed.** `affiliates(referral_code)` embedded from `profiles` is a one-to-one via the child's PK; supabase-js may hand back an object or a single-element array depending on how the relationship is detected. | Missed | B6 (read it defensively) |
| G11 | **No local seed data for the new tables**, so the export SQL can't be exercised on a fresh `db reset` without hand-writing rows. | Missed | S1.4 |
| G12 | **`vendor/lib` has no `registration.test.ts`**, so the B10 contract change has no existing unit-test home. Claiming "unit tested" without adding one would be a lie. | Missed | B10 verification — a new test file, or an honest "covered live" |

Also re-checked and **confirmed correct**: `useUpdateUser` already applies
`commandAccessError` the way B7 assumes (`:36-38`); the role filter is driven by
`ALL_ROLES` (`components/users/UserToolbar/UserToolbar.tsx:36`), so it picks up
Affiliate for free; `seed.sql` assigns roles through variables, never literal ids,
so a new role id breaks nothing; `set_updated_at()` exists
(`20260504000002_schema.sql:157`); and the vendor login wizard needs **no**
`LoginPage.tsx` change under D4, so `/ui-gallery?mode=loginregister` baselines are
untouched.

---

## Design

### How Affiliate users are represented

- A new **`affiliate` role** row in `roles`, assigned through `user_roles` like
  `member`. It uses the existing role system and needs no new role mechanism.
- Created **with no portals**. That is what blocks login: every existing gate
  already refuses a user without the portal (Finding 4). No
  `if (role === 'affiliate')` login checks anywhere.
- Guardrail so it stays true: `affiliateAccessError(portals, role)` in
  `command/lib/userAccess.ts`, next to the existing `commandAccessError` and in
  the same style. It returns an error if an Affiliate is given any portal. The
  create route, the edit mutation and the form all use it, the same way B7 did
  for Command access.
- `profiles.status_id` stays the on/off switch (D3). **Suspending an Affiliate
  makes their code stop attributing** — the register route requires an active
  affiliate profile. No separate flag.

### How referral codes are stored and generated

New table **`affiliates`**, one row per Affiliate user. When the affiliate portal
is built, this becomes the affiliate record (and later holds payout details,
commission rate, etc.):

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` PK | FK → `profiles(id)` ON DELETE CASCADE |
| `referral_code` | `text NOT NULL UNIQUE` | `CHECK (referral_code ~ '^[A-Z0-9]{4,32}$')` |
| `created_by` | `uuid` | FK → `profiles(id)` ON DELETE SET NULL. The Command admin who created it |
| `created_at` / `updated_at` | `timestamptz` | `set_updated_at()` trigger, as elsewhere |

- **Typed by the Command admin (D1).** The create form has a required "Referral
  code" field when the role is Affiliate. Memorable codes (`JUAN2026`, `EZZYPH01`)
  make a mistyped link less likely, which matters because D2 means a bad code
  fails silently.
- **Normalising:** input is upper-cased and stripped of everything except letters
  and digits before it is stored or looked up. `juan-2026` and ` JUAN 2026 ` both
  become `JUAN2026`. Same forgiving matching as the `?division=` slug.
- **Format:** 4–32 characters, `A–Z` and `0–9` only, enforced by the check
  constraint and pre-validated in the form so the admin gets a clear message
  rather than a database error.
- **Uniqueness:** the `UNIQUE` constraint is the real rule. The create route
  **checks the code is free before creating the auth user**, so the normal
  duplicate case returns "That referral code is already in use — choose another"
  with nothing created. A `23505` from a race is still handled: the just-created
  auth user is deleted and the same message returned.
- **No editing of a code after creation** in this phase (deferred below).
  `vendor_referrals` stores the code used, so this stays true if editing is added.

### How the vendor-to-affiliate relationship is stored

New table **`vendor_referrals`**, one row per referred vendor:

| Column | Type | Notes |
|---|---|---|
| `vendor_id` | `uuid` PK | FK → `vendors(id)` ON DELETE CASCADE. PK = a vendor has at most one referrer |
| `affiliate_user_id` | `uuid NOT NULL` | FK → `affiliates(user_id)` **ON DELETE RESTRICT** (D6) · indexed |
| `referral_code` | `text NOT NULL` | The code as used, normalised. Stored separately so history survives if codes are rotated or split out later |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Time of attribution (= signup) |

It answers every required question: which affiliate (`affiliate_user_id`),
which vendors (`WHERE affiliate_user_id = …`), which code (`referral_code`),
when (`vendors.created_at` / `created_at`), and the primary user (Finding 9).

**A row is written only when the code resolves.** No code, an unknown code, a
suspended affiliate, or a failed lookup all produce the same result: no row,
and registration continues (D2).

### RLS and grants (per `20260620000001_api_role_grants.sql` and the AGENTS.md invariant)

| Table | RLS | `authenticated` grant | `service_role` |
|---|---|---|---|
| `affiliates` | SELECT: Command admin/root (`is_portal_member('command') and (has_role('admin') or has_role('root'))`) | `select` | `select, insert, update, delete` |
| `vendor_referrals` | SELECT: same Command admin/root policy | `select` | `select, insert, update, delete` |

- **No `authenticated` write path on either table.** Codes and attribution are
  written only by service-role routes. Nobody can grant themselves a referral
  from the browser.
- `anon`: no grants.
- Neither table is append-only (ops may need to fix a wrong attribution), so the
  `revoke all … from service_role` pattern from `20260911000003` does not apply.
- Affiliates reading their own rows is **left out on purpose**. It arrives with
  the affiliate portal.

---

## Referral URL

**Sample URLs** (hosts from `command/README.md` → "The `PORTAL_URL_*` trio"):

| Environment | URL |
|---|---|
| Production | `https://vendor.ezzy.ph/?ref=JUAN2026` |
| Staging | `https://staging-vendor.ezzy.ph/?ref=JUAN2026` |
| Local | `http://localhost:3001/?ref=JUAN2026` |
| With a division (both apply) | `https://vendor.ezzy.ph/?division=ezzy-drive&ref=JUAN2026` |

**How it behaves** (a copy of the `?division=` mechanism, Finding 1):

- `vendor/lib/referralDeepLink.ts` reads `ref` **when the module loads** (Finding 2),
  normalises it, and exposes `peekDeepLinkReferral()` / `consumeDeepLinkReferral()`.
  One-shot, so signing out doesn't reopen registration.
- If present on the plain sign-in view, registration opens at step 1 and the code
  is held in wizard state. Recovery and vendor-picker sessions ignore it, exactly
  as they ignore `division`.
- **Hidden (D4).** No field is added to any step, and nothing is shown on the
  review screen. `LoginPage.tsx` is untouched, so there is **no visual change and
  no Playwright baseline to regenerate**.
- The code is saved in the existing `localStorage` draft, so a vendor who opens
  the link and finishes the next day still gets credited (7-day draft TTL). A code
  arriving in the URL beats one restored from the draft.
- The URL value is never trusted: the **register route is the only thing that
  decides** whether a referral is real, by looking up the code and requiring the
  affiliate's profile to be active.
- **Not built:** cookies or cross-visit attribution, click tracking, per-campaign
  codes, short links.

---

## Stages and items

### S1 — Migration  🔄 IN PROGRESS  ·  🔒 approval gate (schema + RLS)

**File (new):** `backbone/supabase/migrations/20260917000001_affiliates_and_vendor_referrals.sql`
✅ **written 2026-09-17.** The DDL below is what shipped; the file additionally carries a
header comment explaining the design. Per standing rule, **you** apply migrations.

```sql
-- Interim affiliate referrals: an `affiliate` role, one referral code per
-- affiliate, and vendor → affiliate attribution captured at self-registration.
-- See .plans/2026-09-17-affiliate-referral-codes-interim.md.

-- ── role ─────────────────────────────────────────────────────────────────────
-- Platform-wide, assigned in user_roles. Affiliates hold NO portal rows, which is
-- what keeps them out of every existing portal until an affiliate portal exists.
insert into public.roles (name) values ('affiliate');

-- ── affiliates ───────────────────────────────────────────────────────────────
create table public.affiliates (
  user_id       uuid        primary key references public.profiles (id) on delete cascade,
  referral_code text        not null unique
                            constraint affiliates_referral_code_format
                            check (referral_code ~ '^[A-Z0-9]{4,32}$'),
  created_by    uuid        references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table  public.affiliates is
  'One row per affiliate user. Written only by command /api/users (service role). Code is chosen by the Command admin.';
comment on column public.affiliates.referral_code is
  'Upper-case A-Z0-9, 4-32 chars. Stored normalised, so the unique index is effectively case-insensitive.';

create trigger set_affiliates_updated_at
  before update on public.affiliates
  for each row execute function public.set_updated_at();

alter table public.affiliates enable row level security;

create policy "command admin or root can read affiliates"
  on public.affiliates for select
  to authenticated
  using (
    public.is_portal_member('command')
    and (public.has_role('admin') or public.has_role('root'))
  );

grant select                         on public.affiliates to authenticated;
grant select, insert, update, delete on public.affiliates to service_role;

-- ── vendor_referrals ─────────────────────────────────────────────────────────
create table public.vendor_referrals (
  vendor_id         uuid        primary key references public.vendors (id) on delete cascade,
  -- RESTRICT: an affiliate with attributed vendors cannot be hard-deleted; the
  -- command DELETE route checks first and tells the operator to suspend instead.
  affiliate_user_id uuid        not null references public.affiliates (user_id) on delete restrict,
  referral_code     text        not null,
  created_at        timestamptz not null default now()
);

comment on table public.vendor_referrals is
  'Which affiliate referred a self-registered vendor. Written only by vendor /api/auth/register (service role), and only when the ?ref= code resolves to an ACTIVE affiliate.';
comment on column public.vendor_referrals.referral_code is
  'The code as used at signup (normalised) — a snapshot, kept even if the affiliate''s code later changes.';

create index vendor_referrals_affiliate_user_id_idx
  on public.vendor_referrals (affiliate_user_id);

alter table public.vendor_referrals enable row level security;

create policy "command admin or root can read vendor referrals"
  on public.vendor_referrals for select
  to authenticated
  using (
    public.is_portal_member('command')
    and (public.has_role('admin') or public.has_role('root'))
  );

grant select                         on public.vendor_referrals to authenticated;
grant select, insert, update, delete on public.vendor_referrals to service_role;
```

**Blast radius**
- **Data:** no existing rows are rewritten or checked. One `roles` row is added.
  Its id will be 5 on a clean chain, but code **always looks roles up by name**,
  never by id (as the register route already does).
- **Locks:** the FKs to `vendors` and `profiles` take a brief
  `SHARE ROW EXCLUSIVE` lock on each. Both tables are small; milliseconds.
- **Downstream:** hand-written types in `command/lib/types.ts`. The `vendor` app
  writes `vendor_referrals` but never reads it, so it needs no new interface.
  Also `architecture/schema.md` and `auth-and-roles.md`.
- **Chain effect:** deleting an Affiliate's auth user cascades to `profiles` and
  then `affiliates`, and the RESTRICT stops it there. That delete **fails** while
  referrals exist. Intended (D6); S2 adds a friendly check before it.
- **Reversible:** yes — see the section below for the exact undo and its two caveats.

#### Reversibility (asked 2026-09-17)

This repo has **no `down` migrations** — migration files are forward-only and are
never edited after being applied. "Reversible" here means: a second migration puts
the database back the way it was, and nothing in the first one is one-way.

```sql
-- Undo migration (write as a NEW file; never edit the applied one).
drop table if exists public.vendor_referrals;
drop table if exists public.affiliates;
delete from public.roles where name = 'affiliate';
```

Two things to know before running it:

1. **Dropping the tables destroys the referral data.** The structure comes back;
   the attribution does not. Before any real referrals exist, the undo is clean.
   Afterwards, dump the two tables first.
2. **`delete from roles` cascades.** `user_roles.role_id` is
   `on delete cascade` (`20260504000002_schema.sql:53`), so deleting the role
   silently removes every Affiliate's role row. That is what you want in a
   rollback, but it happens without a warning. Also, `roles.id` is
   `generated always as identity`: a deleted id is never reused, so re-adding
   `affiliate` later gives it a **different id**, and an environment that rolled
   back would have a different id from one that didn't. Harmless here — **no app
   code anywhere references a role by id** (verified by grep across command,
   vendor and booker; everything looks roles up by name) — but worth knowing
   before someone writes id-based SQL by hand.

Nothing else in the migration is one-way: no column is added to an existing table,
no type is changed, no data is rewritten, and no constraint is applied to existing
rows.

#### Impact on existing production vendors: none (asked 2026-09-17)

Real vendors already signed up in production are untouched, by construction:

- **No existing table is altered.** `vendors`, `profiles`, `user_roles` and
  `vendor_members` keep exactly the columns, constraints and rows they have now.
  The migration only **creates** two empty tables and inserts one lookup row.
- **Nothing is backfilled and nothing is validated against existing rows.** The
  new foreign keys live on the new (empty) tables, so Postgres has no existing
  rows to check. Creating them takes a brief lock on `vendors` and `profiles`
  while the tables are created — milliseconds — and no row scan.
- **Existing vendors simply have no `vendor_referrals` row.** The export query
  inner-joins that table, so they never appear in the referral report. That is the
  intended outcome: past signups carry no referral, and only new ones can.
- **Existing signup behaviour is unchanged.** A registration with no `?ref=` takes
  exactly the path it takes today; the only new work is one extra insert, and only
  when a valid code is present.
- **Nothing existing can gain a referral by accident.** Attribution is written in
  one place — the register route, at the moment the vendor row is created — so
  there is no path that could attach a referral to a vendor that already exists.
  Back-dating an old vendor to an affiliate would be a deliberate manual SQL insert.

**S1.4 — Local seed data** ✅ **DONE (2026-09-17)** ⚠️ **G11** *(same stage, separate file)*:
`backbone/supabase/seed.sql` gains one Affiliate profile + `user_roles` row +
`affiliates` row, and one `vendor_referrals` row against an existing seeded vendor,
so a fresh `db reset` can exercise the export SQL and the Command list. Uses the
existing variable style (never literal role ids). `seed.sql` is local-only and never
runs on a hosted project.

**Verify:** apply locally, then run the S1.3 script below.
*(Needs a live local DB — yours to apply.)*

#### S1.3 verification script (written 2026-09-17 — run after applying)

Connect: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"`
(port from `backbone/supabase/config.toml` `[db]`).

**1 — Structure: role, tables, policies, grants.** Every row should read `PASS`.

```sql
select 'role affiliate exists' as check,
       case when exists (select 1 from public.roles where name = 'affiliate')
            then 'PASS' else 'FAIL' end as result
union all
select 'both tables exist',
       case when (select count(*) from pg_tables
                  where schemaname = 'public'
                    and tablename in ('affiliates','vendor_referrals')) = 2
            then 'PASS' else 'FAIL' end
union all
select 'RLS enabled on both',
       case when (select count(*) from pg_class c
                  join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public'
                    and c.relname in ('affiliates','vendor_referrals')
                    and c.relrowsecurity) = 2
            then 'PASS' else 'FAIL' end
union all
select 'one SELECT policy each',
       case when (select count(*) from pg_policies
                  where schemaname = 'public'
                    and tablename in ('affiliates','vendor_referrals')) = 2
            then 'PASS' else 'FAIL' end
union all
-- anon must hold nothing; authenticated must hold SELECT only (never INSERT/UPDATE/
-- DELETE/TRUNCATE) — this is the layer beneath RLS, and it is what stops a browser
-- session writing a referral even if a policy were ever added by mistake.
select 'anon has no privileges',
       case when (select count(*) from information_schema.role_table_grants
                  where table_schema = 'public'
                    and table_name in ('affiliates','vendor_referrals')
                    and grantee = 'anon') = 0
            then 'PASS' else 'FAIL' end
union all
select 'authenticated has SELECT only',
       case when (select count(*) from information_schema.role_table_grants
                  where table_schema = 'public'
                    and table_name in ('affiliates','vendor_referrals')
                    and grantee = 'authenticated'
                    and privilege_type <> 'SELECT') = 0
            then 'PASS' else 'FAIL' end;
```

**2 — Constraints: the code format and uniqueness actually bite.** Each block
should raise the error named in its comment; `rollback` leaves no trace.

```sql
begin;
-- expect: new row violates check constraint "affiliates_referral_code_format"
insert into public.affiliates (user_id, referral_code)
values ('00000000-0000-0000-0000-000000000003', 'lower2026');
rollback;

begin;
-- expect: new row violates check constraint "affiliates_referral_code_format"  (too short)
insert into public.affiliates (user_id, referral_code)
values ('00000000-0000-0000-0000-000000000003', 'AB1');
rollback;

begin;
-- expect: duplicate key value violates unique constraint "affiliates_referral_code_key"
insert into public.affiliates (user_id, referral_code)
values ('00000000-0000-0000-0000-000000000003', 'NINA2026');
rollback;

begin;
-- expect: update or delete on table "affiliates" violates foreign key constraint
--         (D6 — an affiliate with referrals cannot be deleted)
delete from public.affiliates where referral_code = 'NINA2026';
rollback;
```

**3 — RLS: who can actually read it.** `request.jwt.claims` is what the helper
functions read through `auth.uid()`.

```sql
-- A booker (liza) — no command portal. Expect 0 and 0.
begin;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003"}';
  set local role authenticated;
  select count(*) as affiliates_visible_to_booker     from public.affiliates;
  select count(*) as referrals_visible_to_booker      from public.vendor_referrals;
rollback;

-- A command admin (jun). Expect 1 and 1 on seeded data.
begin;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004"}';
  set local role authenticated;
  select count(*) as affiliates_visible_to_command    from public.affiliates;
  select count(*) as referrals_visible_to_command     from public.vendor_referrals;
rollback;

-- No authenticated write path at all. Expect: permission denied for table affiliates.
begin;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004"}';
  set local role authenticated;
  insert into public.affiliates (user_id, referral_code)
  values ('00000000-0000-0000-0000-000000000003', 'HACK2026');
rollback;
```

**4 — Seed + the export query end to end.** Expect exactly one row: Nina
Villanueva / NINA2026 / Citywide Sports Center, with Marco as the primary vendor
user (earliest `vendor_members.granted_at`). Run the **Export SQL** from the
section below as-is.

```sql
-- Nina exists, is active, and holds NO portal — the whole login story in one row.
select p.full_name, s.name as status, a.referral_code,
       (select count(*) from public.user_portals up where up.user_id = p.id) as portal_count
from   public.affiliates a
join   public.profiles p on p.id = a.user_id
join   public.statuses s on s.id = p.status_id;
-- expect: Nina Villanueva | active | NINA2026 | 0
```

---

### S2 — Command: create Affiliates  ⬜ TODO

**B1 — Role type, list, badge, fixture.**
- `command/lib/types.ts:3` `UserRole` adds `"affiliate"`. `User` adds
  `referralCode: string | null`. `UserFormData` (`:138-145`) adds
  `referralCode: string` (empty for non-Affiliates). `CreateUserResult` adds
  `referralCode?: string` and `referralUrl?: string`.
- `command/lib/constants.ts:35` `ALL_ROLES` adds `"affiliate"` — this also feeds
  the role filter (`UserToolbar.tsx:36`) with no further change.
- ⚠️ **G1:** `ROLE_CFG` (`constants.ts:95-99`) is `Record<string, …>` with a `??`
  fallback in `RoleBadge.tsx:9`, so **the compiler will not flag a missing entry**.
  Add `affiliate: { … label: "Affiliate" }` explicitly, with colours distinct from
  member/admin in both themes.
- ⚠️ **G3:** `command/app/ui-gallery/page.tsx:426` `USERS: User[]` must gain the
  new field, and gets **one Affiliate row** so the badge, table and filter are
  visible in the gallery.

**B2 — Access rules (two of them).** `command/lib/userAccess.ts`, in the same pure,
dependency-free style as `commandAccessError`, with unit tests in
`command/lib/userAccess.test.ts`:
- `affiliateAccessError(portals, role)` → `"Affiliates can't have portal access yet — remove the portals, or pick a different role."`
  when `role === "affiliate"` and any portal is set.
- ⚠️ **G8:** `affiliateRoleChangeError(currentRole, nextRole)` → `"Affiliate accounts must be created from Add User, because they need a referral code. Create a new Affiliate instead."`
  when an edit moves a non-Affiliate **to** `affiliate`, and
  `"An Affiliate's role can't be changed here."` for the reverse. Edits write to
  Supabase straight from the browser (`useUpdateUser.ts:88-95`), so the modal's
  disabled select is an affordance, not a boundary — this is the boundary.

**B3 — Code rule (shared, pure).** New `command/lib/referralCode.ts`:
`normaliseReferralCode(raw)` (strip non-alphanumerics, upper-case),
`isWellFormedReferralCode(code)` (`^[A-Z0-9]{4,32}$`), and
`REFERRAL_CODE_REQUIRED` / `REFERRAL_CODE_FORMAT` / `REFERRAL_CODE_TAKEN`
messages. No `@/` imports, so `node --test` can load it. Test:
`command/lib/referralCode.test.ts` — normalising, the format bound, and agreement
with the DB check constraint.

**B4 — `POST /api/users`** (`command/app/api/users/route.ts:8-127`), in this order:
- `affiliateAccessError(...)` → 400, **before** `createUser`, like B7.
- When `role === "affiliate"`: normalise the submitted code; reject empty or
  malformed with 400; `select 1 from affiliates where referral_code = …` and
  reject a duplicate with `REFERRAL_CODE_TAKEN` — all still **before** `createUser`,
  so the common mistakes create nothing.
- After the role insert, insert into `affiliates`
  (`user_id`, `referral_code`, `created_by: caller.user.id`). On failure —
  including a `23505` from a race — **delete the just-created auth user** and
  return the matching message. An Affiliate without a code can't be repaired
  through Edit, and the account has no other data yet, so this rollback is safe.
  It is limited to the Affiliate branch and changes nothing for other roles.
- Skip the set-password email for Affiliates and return
  `{ error: null, emailStatus: "not_configured", referralCode, referralUrl }`,
  where `referralUrl` is `resolvePortalOrigin(["vendor"]) + "/?ref=" + code`, or
  omitted when that origin isn't configured. `emailStatus` stays in the response
  so existing callers keep parsing it.
- Who may create: admin **and** root (D5); `affiliate` is not in `PRIVILEGED_ROLES`.

**B5 — `DELETE /api/users`** (`route.ts:168-208`): after the bookings check, and
**only when `targetRoleNames` includes `affiliate`** (the route already fetches
them at `:178-183`, so this costs nothing), count `vendor_referrals` where
`affiliate_user_id = id`. Gating it this way keeps every non-Affiliate delete
byte-identical to today — no extra query on the common path. If any exist, 400:
`"This affiliate has N referred vendor(s) and cannot be deleted. Suspend the account instead to preserve referral history."`
Mirrors the bookings message and runs before the FK RESTRICT would fail (D6).

**B6 — Users list and UI.**
- `command/services/users.service.ts:5`: add `affiliates(referral_code)` to `SELECT`;
  lines 57-61 recognise `"affiliate"`; map `referralCode`. ⚠️ **G10:** read the
  embed defensively — `const a = row.affiliates; const code = Array.isArray(a) ? a[0]?.referral_code : a?.referral_code`
  — because a one-to-one embed can arrive as either shape.
- ⚠️ **G2:** `hooks/mutations/users/useCreateUser.ts:6-27` whitelists fields in
  **both** directions: add `referralCode` to the POST body and `referralCode` /
  `referralUrl` to the returned object, or they vanish silently.
- `command/components/users/UsersPage/useUsers.ts:23` `notifyCreated`: when
  `result.referralCode` is set, show
  `"<name> created — referral code <CODE>"` with description
  `"Share <referralUrl>. Affiliates can't sign in yet."` (code only when no URL),
  `duration: 12000`.
- `command/components/users/UserModal/` — form state in `useUserForm.ts`, render
  in `UserModal.tsx`:
  - `useUserForm.ts`: `referralCode` state + setter, cleared by `reset()`,
    populated by `populate()`.
  - Add mode: "Affiliate" in the role select; when chosen, a **required
    "Referral code"** input appears, portal toggles are disabled, and the B2/B3
    messages render in the existing inline `accessError` alert style.
  - ⚠️ **G7:** when the role is Affiliate and the status is not `active`, show an
    inline hint — *"A suspended or pending Affiliate's code won't be attributed to
    new vendor signups."* Same alert style; no new component.
  - View mode: a "Referral code" row when `u.referralCode` is set, plus the share
    link as selectable text.
  - Edit mode for an Affiliate: role, portals and code are read-only (editing a
    code is out of scope). "Affiliate" is not offered for a non-Affiliate, because
    Edit can't create an `affiliates` row.
  - **Component separation:** no new component; all state stays in `useUserForm`,
    `.tsx` stays a render layer, styling reuses `UserModal.module.css`. The UX
    skill is applied when built (label, inline error, disabled affordance, both themes).
- Users page role filter gains "Affiliate" via `ALL_ROLES`.

**B7 — Edit mutation guard.** `command/hooks/mutations/users/useUpdateUser.ts:36-38`
already calls `commandAccessError` there (verified). Add `affiliateAccessError`
**and** `affiliateRoleChangeError` (B2) at the same point, before any reconcile.
The hook needs the user's current role, which `UserFormData` does not carry — pass
the current `User` (or its role) into `updateUser`, since `useUsers` already holds
`usrTarget`.

**Verify:** `npm --prefix command run test` (userAccess, referralCode) · `tsc` ·
lint *(mine)* · **no Playwright baselines are affected — G4 confirmed no committed
spec renders `UserModal`** · *live:* create an Affiliate as admin; duplicate code
refused with nothing created; portal grant blocked in UI and by the route; edit
refuses a role switch into/out of Affiliate; list shows role + code; delete with a
referral refused *(shared — I test locally, you confirm on staging)*.

---

### S3 — Vendor: capture the referral at signup  ⬜ TODO

**B8 — Code rule (vendor copy).** New `vendor/lib/referralCode.ts` (pure, no `@/`
imports): `normaliseReferralCode`, `isWellFormedReferralCode`. Test:
`vendor/lib/referralCode.test.ts`. *(Deliberately duplicated from Command — the
apps share no code, and the DB check constraint is the single source of truth.)*

**B9 — Server lookup.** New `vendor/lib/referralLookup.ts`, following
`lib/emailAvailability.ts`: `resolveReferralCode(admin, code)` returns
`{ affiliateUserId, referralCode } | null`. It selects `affiliates.user_id` by
`referral_code` and requires the joined profile status to be `active`. A malformed
or empty code returns `null` without querying. A query error returns `null` **and
logs a warning** — under D2 a broken lookup must never block a registration, but
it must be diagnosable.

**B10 — Registration contract.** `vendor/lib/registration.ts`:
`RegistrationFields.referralCode`; `readFields` reads `body.referralCode`;
`validateFields` normalises it and returns `referralCode: string | null`,
treating malformed input as **absent, never an error** (D2). Both routes inherit
this (Finding 11).

**B11 — `prepare` route:** no change beyond the shared contract. It creates
nothing, and under D2 there is nothing to refuse.

**B12 — `register` route** (`vendor/app/api/auth/register/route.ts`):
- Resolve the code next to the division check (`:102-104`), before anything is
  created, so the lookup can't half-finish a signup.
- After the `vendor_members` insert (`:217-218`), and **only if it resolved**,
  insert `vendor_referrals { vendor_id, affiliate_user_id, referral_code }`.
  On error, `rollback()` and 500 — the row is cheap and a silent half-success
  here would be a lie in the report.
- If a `ref` was supplied but did not resolve: `console.warn` naming the code,
  and carry on. No error to the vendor (D2).
- The insert stays **before** the consent insert, which must remain the last
  rollback-able step (`:246-256`). The vendor delete in rollback cascades the
  referral row, so `rollback()` needs no change.

**B13 — Client service.** `vendor/services/kyc.service.ts`: add `referralCode` to
`SubmitKycParams.form` and to the `fields` posted. No new client-side check
endpoint (D2/D4 removed it).

**B14 — Deep link.** New `vendor/lib/referralDeepLink.ts`: a copy of
`divisionDeepLink.ts` for `ref` — module-load capture, one-shot peek/consume,
with comments pointing at the division module for the full reasoning. A second
small module beats generalising the first while only two params use this.

**B15 — Wizard hook.** `vendor/components/auth/LoginPage/useLoginPage.ts`:
- `RegForm.referralCode` + `EMPTY_REG` (never rendered — D4).
- Draft save (`:211-214`) includes it in the **saved object**; restore (`:196-207`)
  reads `draft.referralCode ?? ""`. `vendor/lib/kycDraft.ts` gains the optional
  field; no key-version bump, since an older draft simply has no code.
  ⚠️ **Do not add it to the `hasContent` test on `:212`.** That list decides whether
  a draft is written at all. Including the code would make `/?ref=CODE` write a
  `localStorage` draft for a visitor who typed nothing — a new side effect on a
  path that currently has none. Excluded, the behaviour is: no draft until the
  vendor actually types something, and once they do, the code rides along.
- **New effect declared after the draft-restore effect:** when
  `initialView === "login"` and `peekDeepLinkReferral()` is set, store the code,
  open `register` at step 1, then consume. React runs effects in declaration
  order, so the URL beats the draft deterministically — unlike the division apply,
  which wins only because a network round trip makes it land later. Independent
  of the divisions fetch.
- `handleSubmitKyc` (`:546-557`) passes `referralCode`. **`handleDetailsContinue`
  is unchanged** — no per-step check exists under D2.
- **Component separation:** all state stays in the hook; `LoginPage.tsx` is not
  touched at all.

**B16 — Testability seam** ⚠️ **G6 · D7 resolved 2026-09-17.** Under D4 nothing
about the captured code is observable, so the deep link has no DOM signal to
assert — and `conventions.md:619` records that an effect-ordering regression in
exactly this mechanism survived eleven days behind a green suite. Therefore:
render one hidden input on registration step 1,
`<input type="hidden" data-testid="referral-code" value={regForm.referralCode} />`.
It is invisible to the vendor (D4 holds), changes no layout and therefore no
baseline, and gives both Playwright and a support engineer a handle. One line in
`LoginPage.tsx`; state stays in the hook.

**B17 — Deep-link regression spec** (depends on B16). New
`vendor/visual-tests/referral-deeplink.spec.ts`, modelled on the existing
`division-deeplink.spec.ts` (a DOM test, no screenshots, hermetic — `/api/divisions`
route-mocked, no session, so no seeded DB). Asserts: `/?ref=JUAN2026` opens
registration **and** the hidden input holds `JUAN2026`; the query string has been
rewritten by then (the actual point); `?ref=juan-2026` normalises to the same value;
`?ref=` plus `?division=` both apply; and signing out does not re-open registration
(the one-shot consume).

**Verify:** `npm --prefix vendor run test` (referralCode; ⚠️ **G12** — `vendor/lib`
has no `registration.test.ts` today, so B10 either gets a new one or is honestly
reported as covered only by live testing) · `tsc` · lint · `npm --prefix vendor run
test:visual` for the new spec *(mine)* · *live (local):* the three flows above;
`?ref=` + `?division=` together; a
lower-case/hyphenated code still matches; signing out does not reopen
registration; a suspended affiliate's code produces a vendor with no referral row
and no error; forcing the `vendor_referrals` insert to fail leaves no user or
vendor behind *(shared)*.

---

### S4 — Docs, login-block check, report run  ⬜ TODO

**I1 — Architecture docs** *(mine)*: `schema.md` (Migration History, both tables,
ERD, the primary-vendor-user definition, the export SQL); `auth-and-roles.md`
(the `affiliate` role, "no portals is the gate", the D3 outcome and its accepted
residual risk); `portals.md` (a "Referral deep link" paragraph beside the
division one; Affiliate creation on the Command Users page); ⚠️ **G5**
`conventions.md:586-619` ("The shell owns the query string") — it names each
module-load reader by file, and `lib/referralDeepLink.ts` is now the third.

**I2 — Login-block verification** *(yours — needs staging + a mail-reachable
address)*: for a real Affiliate, Forgot Password on vendor, booker and command →
set a password → sign in → each portal refuses and signs out; the mobile vendor
app refuses too. I record the outcome in the plan.

**I3 — Run the export query** *(shared — I run it locally after S3, you run it on
staging/production once deployed)* and confirm one row per referred vendor with
the right primary user.

---

## "No referral code supplied" — exactly what changes (asked 2026-09-17)

The code is **optional everywhere**: optional in the URL, optional in the wizard
(it has no field at all under D4), and never a required field on the server. A
signup with no code walks today's path. Traced step by step:

| Step | With no code | Change vs today |
|---|---|---|
| Landing on `/` | `peekDeepLinkReferral()` returns `""`, the new effect returns immediately, the login view renders as it does now | none |
| Wizard steps 1–6 | no field exists, no validation runs, no per-step check | none |
| Draft auto-save | `hasContent` is unchanged (B15), so a visitor who types nothing still writes nothing | none |
| Submit → `submitKyc` | sends `referralCode: ""` alongside the existing fields | one extra empty string in the JSON body |
| `prepare` route | reads and normalises the field; never refuses on it | no new query, no new failure mode |
| `register` route | `referralCode` normalises to `null`, the lookup is **skipped entirely** (no query), no `vendor_referrals` insert | one boolean check |
| Required-field validation | the code is **not** in the required list in `validateFields` | none |
| KYC, documents, consent, notifications, rollback | untouched | none |
| The vendor afterwards | identical record, identical portal access, identical KYC surface; simply absent from the referral report | none |

**The booker app is not touched at all**, and the mobile apps have no registration
screen.

The only places where shared, non-referral paths change at all:

1. **Command's Users list query** gains an `affiliates(referral_code)` embed, so
   every row carries an extra `null` for non-Affiliates. This is the one shared
   read path in the change; it is verified locally before merge, and the page
   already renders a load-error state if a query fails.
2. **`UserFormData` gains a `referralCode` field**, empty for every other role, and
   the create route ignores it unless the role is `affiliate`.
3. **`DELETE /api/users`** adds a referral count **only for targets holding the
   `affiliate` role** (B5), so ordinary user deletes issue exactly the queries they
   issue today.

Nothing above can change the outcome of a signup that carries no code.

---

## Export SQL (exact — run after S1–S3 ship)

One row per referred vendor. "Vendor user" = the **primary vendor user**, meaning
the earliest-granted `vendor-admin` of that vendor, which is the person who
registered it (Finding 9). Dates shown in Manila time.

```sql
select
  ap.full_name                                                     as affiliate_name,
  ap.email                                                         as affiliate_email,
  vr.referral_code                                                 as referral_code,
  v.name                                                           as vendor_name,
  owner.full_name                                                  as vendor_user_name,
  nullif(trim(owner.email), '')                                    as vendor_user_email,
  to_char(v.created_at at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI') as signed_up_at
from public.vendor_referrals vr
join public.vendors  v  on v.id  = vr.vendor_id
join public.profiles ap on ap.id = vr.affiliate_user_id
left join lateral (
  select p.full_name, p.email
  from   public.vendor_members vm
  join   public.roles    r on r.id = vm.role_id and r.name = 'vendor-admin'
  join   public.profiles p on p.id = vm.user_id
  where  vm.vendor_id = v.id
  order  by vm.granted_at asc, vm.user_id asc
  limit  1
) owner on true
order by ap.full_name, v.created_at;
```

Notes:
- `left join lateral`: a vendor whose admins were all removed still appears, with
  blank user columns.
- `vr.referral_code` is the code **used**. For each affiliate's *current* code,
  join `public.affiliates a on a.user_id = vr.affiliate_user_id`. The two are the
  same until codes can change.
- Runs as `postgres` (SQL editor or psql), bypassing RLS. A Command admin's JWT
  would also see every row through the S1 policies.
- Export: Supabase SQL editor → run → **Download CSV**, or
  `psql … -c "\copy (<query>) to 'referrals.csv' csv header"`.
- ⚠️ **G9 — closed vendors still appear.** Account closure *scrubs* the vendor row
  and deletes its `vendor_members`; it does not delete the vendor and does not
  scrub `vendors.name` (`command/lib/accountDeletion/execute.server.ts:81-105, 260-321`).
  So a closed vendor stays in the report under its real name, with **blank vendor
  user columns** — the referral genuinely happened, and the blank columns are the
  signal that the account is gone. To exclude them, add
  `and v.status_id <> (select id from public.statuses where name = 'suspended')`,
  but note closure reuses `suspended`, so that also hides ordinarily suspended vendors.

---

## DECISIONS

- **D1 — Code generation → admin types it** (resolved 2026-09-17). Memorable codes;
  the form validates format and uniqueness before anything is created. Auto-generation
  is still possible later without a migration.
- **D2 — Invalid code → silently ignored** (resolved 2026-09-17). The vendor is never
  blocked or shown a referral error; **no `vendor_referrals` row is saved** unless the
  code resolves to an active affiliate. Consequence accepted: a bad link is invisible
  until the report is run; the register route logs a warning for diagnosis.
- **D3 — Login block → no portal access is enough** (resolved 2026-09-17). Nothing on
  the Supabase Auth side; suspend the user when needed. Residual risk accepted
  (Finding 6: a Forgot-Password session can read public catalogue data only).
- **D4 — URL code in the form → hidden** (resolved 2026-09-17). No field on any step,
  no review row; the code rides in wizard state and the draft. Removes the signup-form
  UI work and the visual-baseline regeneration entirely.
- **D5 — Who can create Affiliates → admin and root** (resolved 2026-09-17), same as
  `member`, since it grants no access.
- **D6 — Deleting an Affiliate with referrals → blocked, suspend instead**
  (resolved 2026-09-17). FK RESTRICT plus a friendly route check, following the
  existing "user has bookings" rule.
- **D7 — keeping the hidden code testable (G6) → hidden input on step 1**
  (resolved 2026-09-17). `<input type="hidden" data-testid="referral-code">`
  holding the captured code: invisible to the vendor so D4 holds, no layout change
  and therefore no screenshot baselines, one line of JSX, and it gives B17's
  Playwright spec something to assert and support a value to inspect. The
  alternatives were no DOM at all (the spec could then only prove the form opened,
  leaving silent attribution loss undetectable) and showing it read-only on the
  review step (visible to the vendor, reverses part of D4, changes a baseline).

## DEFERRED / COSMETIC
- **Editing a referral code after creation** → deferred; `vendor_referrals` already
  snapshots the code used, so adding it later doesn't break history.
- **Affiliate portal, reading own referrals** → later: add an `affiliate` portal row,
  grant it, and add "own rows" SELECT policies on `affiliates` (`user_id = auth.uid()`)
  and `vendor_referrals` (`affiliate_user_id = auth.uid()`). No table changes.
- **Commissions** → a separate table keyed to `vendor_referrals.vendor_id` (or to
  bookings), with a rate on `affiliates` or per referral. `vendor_referrals` is
  already the join point, so nothing gets restructured.
- **Multiple codes or links per affiliate** → move `affiliates.referral_code` into an
  `affiliate_referral_codes` table; `vendor_referrals.referral_code` keeps historic
  rows meaningful.
- **Command-created vendors with a referrer, and editing attribution** → manual SQL
  for now.
- **Report UI in Command** → replaced by the export SQL this phase.
- **An Affiliate who is also a vendor** → blocked today by the shared-email check
  (Finding 10). Revisit with the portal.

## Execution order
1. **Decisions D1–D7** — ✅ all resolved 2026-09-17. No open decision blocks execution.
2. **S1 migration file** (mine) → you review and apply. 🔒
3. **S2 Command** (B1→B7) — depends on S1. Commit in `command/`.
4. **S3 Vendor** (B8→B17) — depends on S1; live testing wants an Affiliate from S2.
   Commit in `vendor/`.
5. **S4** docs + live checks + report run. Commit in the root repo.
6. Staging/production: **migration first**, then deploy command and vendor.
   ⚠️ **Corrected 2026-09-17 — the earlier wording here was wrong.** It said a vendor
   app deployed before the tables exist "would fail every referred signup". It would
   not: B9 fails soft, so a missing `affiliates` table makes the lookup return
   `null`, and the signup **succeeds with no attribution**. The real risk of the
   wrong order is therefore *silently lost referrals*, not broken registrations —
   quieter, and worse, because nobody notices until the report comes up short.
   Command deployed early is safe in the other direction: creating an Affiliate
   fails outright (no role row, no table), so nothing half-exists.

One stage per turn by default, with a report and the big table after each.

---

## Big table (all todos, ownership and status)

**Owner:** 🤖 = mine (Claude) · 👤 = yours (Joshua) · 🤝 = shared

| ID | Stage | Item | Owner | Status |
|----|-------|------|-------|--------|
| D1–D6 | S0 | Decisions resolved | 👤 | ✅ DONE (2026-09-17) |
| G1–G12 | S0 | Gap review of the draft, folded into the items | 🤖 | ✅ DONE (2026-09-17) — 12 gaps: 11 real, 1 false alarm; all traced to `file:line` |
| D7 | S0 | How the hidden code stays testable | 👤 | ✅ DONE (2026-09-17) — hidden input with a test id |
| — | S0 | Approve this plan for execution | 👤 | ⬜ TODO |
| S1.1 | S1 | Write the migration file (role, `affiliates`, `vendor_referrals`, RLS, grants) | 🤖 | ✅ DONE (2026-09-17) — `20260917000001_…sql`; static check only (quote balance, 18 statements). **Not executed** |
| S1.2 | S1 | Review + apply the migration locally | 👤 | ⬜ TODO |
| S1.3 | S1 | Verify constraints/uniqueness/RLS in psql | 🤝 | ⬜ TODO — script written below; yours to run after applying |
| S1.4 | S1 | Seed an affiliate + referral in `seed.sql` (local only) | 🤖 | ✅ DONE (2026-09-17) — Block 10 + header table in `seed.sql`; **not executed** |
| B1 | S2 | Types, `ALL_ROLES`, **`ROLE_CFG` entry**, `UserFormData`, gallery fixture | 🤖 | ⬜ TODO |
| B2 | S2 | `affiliateAccessError` **+ `affiliateRoleChangeError`** + unit tests | 🤖 | ⬜ TODO |
| B3 | S2 | `command/lib/referralCode.ts` (normalise/validate) + unit tests | 🤖 | ⬜ TODO |
| B4 | S2 | `POST /api/users` — affiliate branch, pre-checks, rollback, share link | 🤖 | ⬜ TODO |
| B5 | S2 | `DELETE /api/users` — refuse deleting an affiliate with referrals | 🤖 | ⬜ TODO |
| B6 | S2 | Users list (defensive embed) + `useCreateUser` passthrough + UserModal (code input, status hint, view row, disabled portals) + toast | 🤖 | ⬜ TODO |
| B7 | S2 | Edit-mutation guards (access + role change) | 🤖 | ⬜ TODO |
| S2.V | S2 | `npm test` + tsc + lint (no Command baselines affected — G4) | 🤖 | ⬜ TODO |
| S2.L | S2 | Live: create/duplicate/portal-block/delete-block in Command | 🤝 | ⬜ TODO |
| B8 | S3 | `vendor/lib/referralCode.ts` + unit tests | 🤖 | ⬜ TODO |
| B9 | S3 | `resolveReferralCode` lookup (active affiliate only, warn-on-error) | 🤖 | ⬜ TODO |
| B10 | S3 | `registration.ts` contract — normalise, malformed = absent | 🤖 | ⬜ TODO |
| B11 | S3 | `prepare` route — inherits contract, no refusal | 🤖 | ⬜ TODO |
| B12 | S3 | `register` route — resolve early, insert attribution, warn on no-match | 🤖 | ⬜ TODO |
| B13 | S3 | `kyc.service.ts` — pass `referralCode` | 🤖 | ⬜ TODO |
| B14 | S3 | `referralDeepLink.ts` — module-load `?ref=` capture | 🤖 | ⬜ TODO |
| B15 | S3 | `useLoginPage.ts` + `kycDraft.ts` — hold code, draft, URL-beats-draft | 🤖 | ⬜ TODO |
| B16 | S3 | Hidden testability input on step 1 (D7a) | 🤖 | ⬜ TODO |
| B17 | S3 | `referral-deeplink.spec.ts` regression test (DOM, hermetic) | 🤖 | ⬜ TODO |
| S3.V | S3 | `npm test` + tsc + lint + the new deep-link spec | 🤖 | ⬜ TODO |
| S3.L | S3 | Live: no-code / valid / invalid / suspended / rollback signups | 🤝 | ⬜ TODO |
| I1 | S4 | Update `schema.md`, `auth-and-roles.md`, `portals.md`, **`conventions.md`** | 🤖 | ⬜ TODO |
| I2 | S4 | Verify Affiliates can't get into vendor/booker/command/mobile | 👤 | ⬜ TODO |
| I3 | S4 | Run the export SQL and sanity-check the rows | 🤝 | ⬜ TODO |
| S4.1 | S4 | Apply migration on staging, then production | 👤 | ⬜ TODO |
| S4.2 | S4 | Deploy command + vendor (after the migration) | 👤 | ⬜ TODO |
| S4.3 | S4 | Commits in `command/`, `vendor/`, root repo | 🤖 | ⬜ TODO |
