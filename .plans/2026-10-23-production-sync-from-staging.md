# Production sync — bring production level with staging (DB, Edge Function, three web apps)

**Date:** 2026-10-23
**App / scope:** release only — `backbone/` (hosted `db push` + Edge Function deploy) and the
`command`, `booker`, `vendor` Vercel projects (promote staging → production). **No code, no new
migration, no schema design.** Out of scope: the Expo apps (EAS, not Vercel), the untracked
Checkout S2 candidate plans (documentation-only, nothing in `migrations/`), and
`backbone/supabase/pending/retire_release_booking_payouts.sql` (Phase D of the payouts REVISIT
plan — it must **not** ship in this round).
**Status:** IN PROGRESS — Stage 0 (read-only pre-checks): R1–R6 ✅ (2026-10-23), so Stage 0 is
complete. S2 ✅ (2026-10-23): production DB is level with staging. S4 ✅ (all three promoted). S5 ⏸: machine probes pass; near-me Phase 3 and one real paid booking are parked until the user schedules a live test. Stage 4 (S6, S7) is the user's own. S1 and S3 aren't needed (✖). D1–D3 were resolved by the user on 2026-10-23.

> Ship what is on staging to production in the one order that cannot strand a live app: read-only
> checks → backup → `db push` → Edge Function → apps (command → booker → vendor) → align branches.
> Every hosted step is the **user's** to run (migrations, Vercel, credentials); this plan supplies
> the order, the commands and the checks.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** R# = read-only pre-check, S# = execution step, F# = finding; numbers are
> plan-local — qualify cross-plan refs by plan (e.g. "near-me S3d").

---

## Findings from the 2026-10-23 investigation (machine-checked from git, not from hosted)

### F1 — 14 migrations are on backbone `develop` and absent from its `production` branch  ✅ recorded
`git diff --name-status origin/production origin/develop -- supabase/migrations` (after `git fetch`):
`20260911000001` → `20261016000001`, 14 files, all **added**, none modified.
⚠️ **The `production` git branch does not describe the production database.** Other plans record
several of these as already live in production:

| Migration(s) | Recorded as live in production by | Likely state |
|---|---|---|
| `20260911000001`–`03` | payouts withholding plan (2026-09-12) | applied |
| `20260913000001` | payouts REVISIT plan (2026-09-14) | applied |
| `20260917000001` | affiliate referral codes plan (2026-09-19) | applied |
| `20260930000001`, `…02`, `20261001000001` | vendor signup-before-KYC plan (2026-10-01) | applied |
| `20260922000001`, `20260927000001` | — (booker home/search redesign; booker production not shipped) | **probably pending** |
| `20261002000001`, `20261003000001`, `20261004000002` | — (booker search & booking gaps, applied to staging) | **probably pending** |
| `20261016000001` | near-me plan: "production outstanding" | **pending** |

These are expectations only. R1 replaces them with a measurement.

### F2 — Nothing pending in `migrations/` is unsafe for the currently-live apps  ✅ recorded
Read 2026-10-23. The six probably-pending migrations add new things. None of them drops a column
or table, or rewrites existing rows:
- `20261003000001` header: "one new column with a default — no existing row is rewritten". It
  replaces `validate_booking_status_transition()` with a body read from the running database, so
  kiosk close-out (`20260829000004`) is kept.
- `20261016000001` changes `get_popular_offerings` to `p_city_code`. Its only caller is booker
  `develop`; the live production booker (from 2026-09-09) predates the shelf. Per near-me S3d,
  **migration first, deploy second**, or the shelf empties silently (`PGRST202` is caught).
- `20261002000001` creates the `booking-documents` storage bucket from SQL. No dashboard step is
  needed.
- None of them needs a new extension, and none of them has a backfill. (Only `20260911000001` has
  a backfill, and F1 has it as already applied. If R1 says otherwise, take S1's baseline first.)

So **DB first, apps second** is safe in both directions: the old apps run against the new schema,
and the new apps need it.

### F3 — Every RPC the apps call on `develop` exists in a migration  ✅ recorded
Grepped `rpc('…')` across `vendor`, `booker` and `command` on `origin/develop`, excluding tests and
e2e: 14 distinct functions, and each is defined in `backbone/supabase/migrations/`. No app is
waiting on SQL that isn't in the repo.

### F4 — No new required environment variable  ✅ recorded
Compared `process.env.*` names on `origin/production` and `origin/develop` per app. Vendor and
command have no new names. Booker adds `NEXT_PUBLIC_MAP_STYLE_URL` and `…_DARK`, both optional with
defaults (`booker/lib/mapTiles.ts:71-72`), plus `AUDIT_BASE`, which is a local script only. No
Vercel variable needs adding.

### F5 — The app `release/*` branches are stale, and the `production` branches are behind live  ✅ recorded
The newest `release/*` per app dates from July or August (vendor `release/staging-0.32.1` and
command `release/staging-0.20.1` are from 2026-08-10, booker `release/v0.10.1` from 2026-07-21).
`develop` moved on until 2026-10-22. The `production` branches (2026-09-09/10) are older than
releases recorded as live (vendor KYC, 2026-10-01). That is the drift `architecture/overview.md`
warns about: Promote doesn't move the branch. **Staging's actual source commit is therefore
unknown from here**, and R3 measures it.

### F6 — The Edge Function may be behind on production  ✅ recorded
`send-notification-email` last changed on `develop` on 2026-10-01 (`28daf39`, KYC notify), and
`origin/production` lacks the payout-statement template (2026-09-14). Production may already run a
newer deploy than the branch suggests (statements went live on 2026-09-14). R5 checks.

### F7 — The Supabase↔GitHub integration is probably not active, but unconfirmed  ✅ recorded — ⚠️ corrected by R4: it IS connected (to `master`)
`architecture/email-notifications-guide.md:109` says migrations apply automatically on merge to
`master`. But backbone `origin/master` was last updated on 2026-08-02 and lacks migrations that
production has, so the integration can't be what applied them. R4 confirms this before S6 moves any
backbone branch.

### F8 — booker's Production environment tracks `release/v0.14.0`, a branch that doesn't exist  ⬜ TODO (not a blocker)
From the user's Vercel screenshot (2026-10-23). `git ls-remote` shows booker's remote has only
`production` and `release/v0.10.1`; **there's no `release/v0.14.0`**. So booker production
**can't** auto-deploy from git today, and it changes only by Promote. That's harmless for this
round (S4 promotes), but it has three consequences:
- **S6 is bookkeeping only for booker.** Moving booker's `production` branch deploys nothing. The
  `overview.md` trap ("the next push to `production` silently replaces what you promoted")
  **doesn't apply to booker**. It does apply to vendor, whose Production tracks `production`
  (2026-09-19). Command's tracking is still unread.
- ⚠️ **Latent trap:** creating `release/v0.14.0` would deploy it to production. `release/*`
  (staging) matches the same name, so which environment wins is Vercel's call and isn't
  documented here.
- `architecture/overview.md` records the branch mapping for vendor only. Add booker's (and
  command's, once read) in S7.
**Fix direction (your call, after this round):** point booker Production at `production`, like
vendor, or record "promote-only" as deliberate. Not part of this release.

---

## Read-only pre-checks (Stage 0 — the user runs them; nothing changes)

### R1 — Measure migration drift on both projects  ✅ DONE (2026-10-23)
✅ Run by the user. **Staging** has exactly the same migrations as local, with no gaps. On
**production**, the last applied migration is `20261001000001`, and these four are pending (empty
`remote`):
`20261002000001` · `20261003000001` · `20261004000002` · `20261016000001`.
⚠️ **This corrects F1:** `20260922000001` and `20260927000001` were guessed as pending but are
applied. **S2's `--dry-run` must list exactly these four.** Verified from the user's screenshot
of `migration list` (bottom rows; the rows above `20261001000001` were reported as paired).
Production is `--db-url`, with the connection string typed by the user. ⚠️ **Do not re-link.**
`backbone/supabase/.temp/project-ref` is staging (`fbxbwnfeimzhgxpshdpa`, confirmed 2026-10-23).
```bash
cd backbone
npx supabase migration list --linked                          # staging
npx supabase migration list --db-url "<production conn string>"   # production
```
**Pass:** staging shows no empty `remote`. Production's empty `remote` rows are exactly the set S2
will apply. Record that set here before continuing. **If staging has a gap**, stop: staging isn't
what was tested.

### R2 — near-me S3d Phase 0 on production (the overload check)  ✅ DONE (2026-10-23)
✅ **0c passed on production and staging (2026-10-23, run by the user):** both `pgrst_ddl_watch`
(`ddl_command_end`) and `pgrst_drop_watch` (`sql_drop`) are present with `evtenabled = 'O'`
(enabled). PostgREST will reload its schema cache by itself after S2, so **no manual
`notify pgrst` is needed**. All three Phase 0 checks pass, and near-me Phase 1 (S2) is clear to run.
🔄 **0a passed on production (2026-10-23, run by the user):** exactly one row,
`get_popular_offerings(date,date,text,integer)` with `prosecdef = true`. So there's no
hand-applied overload. ⚠️ **This corrects F1:** the function exists, so `20260927000001` is
**already applied** on production, not pending. ⚠️ The old and new versions have the **same type
signature** (`p_city` vs `p_city_code`, both `text`), so 0a can't show whether `20261016000001` is
applied. ✅ **0b is answered by R1:** `20261016000001` has an empty `remote`, so it's not in the
production ledger. **Still to run:** 0c (both `pgrst_*` event triggers present, or a manual `notify pgrst, 'reload schema';` is
needed after S2).
Run near-me S3d **Phase 0** verbatim against production (`.plans/2026-10-14-booker-near-me-discovery.md`,
search `HOSTED APPLY`). The key query:
```sql
select p.oid::regprocedure, p.prosecdef
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_popular_offerings';
```
**Pass:** exactly one row, `(date,date,text,integer)`, **or zero rows** if `20260927000001` is also
pending. More than one row → stop; a hand-applied overload would survive the migration's `drop`.

### R3 — Identify what each staging domain serves, and whether Promote is possible  ✅ DONE (2026-10-23)
✅ **Closed by the user's Vercel screenshot (booker → Project Settings → Environments):**
`staging-booker.ezzy.ph` is the custom `staging` environment (tracks `release/*`) in the **same**
project as Production, so Promote is possible for all three apps. ⚠️ That screenshot also produced
**F8** (booker Production tracks a branch that doesn't exist).

**Run from here over public HTTP (2026-10-23 ~20:40 EDT).** No Vercel CLI and no credentials
were used. What's left needs the Vercel dashboard (bottom of this block).

| App | Staging `dpl` | Production `dpl` (live now) | Supabase in bundle (staging / prod) |
|---|---|---|---|
| command | `dpl_56dKbxE2LjhfX6GECXip3X2Gp1kQ` | `dpl_EcazDfpeoSpi8yKpbyfKax3st6Jy` | `fbxbw…` / `pdkej…` ✅ |
| booker | `dpl_B64zQ4DAmQ6rQzB5Bx6XXob12YHf` | `dpl_4nhsVzmKkaXFR4SDL9v8ut7cut1y` | `fbxbw…` / `pdkej…` ✅ |
| vendor | `dpl_5VQYpfYsY6hqPNKc3tYU8wRw8VHz` | `dpl_5q1Nm1p448d51p35t7bBdo3LvzjL` | `fbxbw…` / `pdkej…` ✅ |

- **No crossed-over deployment.** Each domain's bundle names only its own Supabase project.
- **Staging = the dark-mode-lift release, the newest on `develop`** (command `version-0.34.0`,
  booker `version-0.29.0`, vendor `version-0.60.0`, tagged 2026-10-22). Proven from content, not
  timing: every colour value introduced **only** by the dark-mode-lift commits is in the served
  staging CSS (command 7/7, booker 11/11, vendor 7/7), and production has none of them (1/7,
  0/11, 0/7). The edge-cache ages agree: the staging builds were cached between 10-21 22:43 and
  10-22 04:34, after the 22:29 release commits. `develop` has nothing newer except vendor
  `89d72cd`, which is `AGENTS.md` only. **So staging holds everything on `develop`, and D1
  (promote as-is) ships all of it.**
- **The staging booker bundle has the code that needs the pending migrations** (`p_city_code`,
  `get_unbookable_offerings`, `booker_cancel_booking`). **The production booker bundle has none
  of them**, which backs up F2: the push can't break the live booker.
- **Vercel project layout:** command's staging build advertises `https://command.ezzy.ph` in its
  OG metadata. `resolveSiteUrl()` fell through to `VERCEL_PROJECT_PRODUCTION_URL`, which means
  **staging-command lives in the same Vercel project as production**, so Promote is possible.
  Vendor's staging is in the same project too (`overview.md`, 2026-09-19). **Booker can't be told
  apart this way**: its `NEXT_PUBLIC_APP_URL` is set, so the metadata is its own host either way.
- Side note, not a blocker: staging-command's link previews point at the production host because
  `NEXT_PUBLIC_APP_URL` is unset there. That's harmless (command isn't indexed) and goes away on
  promote.

~~Still needs the dashboard~~ — answered above. Matching the staging deployments' commit SHAs to
the tags in the dashboard is optional; the CSS fingerprint already identifies the release.
Per app (`staging-vendor`, `staging-booker`, `staging-command` — confirm the hostnames):
```bash
H=https://staging-vendor.ezzy.ph; curl -s $H | grep -oE 'dpl=dpl_[A-Za-z0-9]+' | head -1
```
Then, in Vercel, open that deployment and record its **commit SHA and branch**. Also record whether
staging is a **custom environment inside the same project** as production (vendor's is, per
`overview.md`, checked 2026-09-19), or a **separate project** (command and booker were never
checked).
**Pass:** each app has a known SHA. That SHA's code must not be behind `origin/develop` in a way
you didn't intend. Check with `git -C <app> log --oneline <sha>..origin/develop`. If staging is
behind `develop`, decide (D1) whether to ship what staging has, or redeploy staging first and
re-test.

### R4 — Confirm the Supabase↔GitHub integration state  ✅ DONE (2026-10-23)
✅ **Closed by D4.** The "Deploy to production" setting wasn't read, and it doesn't need to be, because nothing will be merged into `master`. ⚠️ It stays a latent trap for anyone who does merge there (see D4).

**2026-10-23, reported by the user:** the integration **is connected**, to the backbone repo,
branch **`master`**. ⚠️ **This corrects F7**, which guessed "not active". Still unknown: **which
project(s)** it's on (production, staging, or both) and whether **"Deploy to production"** is on.
⚠️ **Git shows the integration hasn't deployed anything since 2026-08-02:** `origin/master` is at
`24341e8` (2026-08-02), and its reflog shows no push since. Every migration after that, including
the eight already on production, reached production by some other route (`db push`). So the
2026-09-08 deploy didn't go through this integration, whatever it did.
⚠️ **If "Deploy to production" is on for the production project, merging `develop` into `master`
applies all four pending migrations, with no dry-run.** Rule: **don't touch `master` before S2**.
After S2 a merge has nothing to apply, so S6 can bring `master` up safely.
Note: the integration has nothing to do with **Vercel** environment variables. F4 (no new
variables needed) is the basis for those, not this integration.
Dashboard → production project → Project Settings → Integrations → GitHub. Record whether it's
connected, and which branch it watches. Do this for staging too. **Pass:** its state is written
here. If it's active on a branch S6 would move, that merge **is** a migration apply, so it happens
only after S2, when it's a no-op.

### R5 — Compare the Edge Function version  ✅ DONE (2026-10-23)
✅ **Run from here, read-only, with the user's go-ahead:** `npx --no-install supabase functions list
--project-ref <ref>` (the cached CLI 2.x and the user's existing CLI login; nothing downloaded).

| Function | Production | Staging | Same code? |
|---|---|---|---|
| `send-notification-email` | v10, deployed 2026-09-14 21:43 EDT | v18, deployed 2026-09-14 18:09 EDT | ✅ identical bundle hash `a434e725…` |
| `send-push-notification` | v7, 2026-08-09 | v8, 2026-08-22 | ✅ identical bundle hash `8c81ddda…` |

- Both environments run the **2026-09-14** email function (payout-statement template). `develop`
  changed it twice after that (`c715d2a` on 09-30, `28daf39` on 10-01). The whole diff is **8 lines
  in `types.ts`**: three notification type names added to a TypeScript union, whose own comment
  says *"getRenderer falls back to [the generic template] for any type, so these send correctly
  even before a redeploy."* There's no runtime change, and production already sends the KYC and
  status emails (they went live on 2026-10-01). **So S3 isn't needed.** Production matches what
  staging tested.
- ⚠️ **Known difference, not part of this release:** `send-push-notification` has
  `verify_jwt = true` on production and `false` on staging. This is already recorded in
  `.plans/2026-09-08-email-branding-and-kiosk-confirmation.md`: production push "has never
  worked and could not have" (its secret and Expo token are also absent). The `config.toml` fix
  only takes effect on the next deploy, and turning on production push was **deliberately left
  for its own plan** (user decision 2026-09-09). Don't redeploy it here.
```bash
npx supabase functions list --project-ref <production ref>
```
Compare `send-notification-email`'s updated-at with `2026-10-01` (the last commit, F6). **Pass:**
it was deployed on or after 2026-10-01 → S3 becomes ✖ not needed. Earlier → S3 runs.

### R6 — Confirm a restore point exists  ✅ DONE (2026-10-23)
✅ **Run from here, read-only, with the user's go-ahead:** `npx --no-install supabase backups list
--project-ref <production ref>` at 2026-10-23 20:56 EDT.
- **Daily physical backups, 7 kept, all `COMPLETED`.** The newest is **2026-10-23 20:05 UTC (16:05
  EDT)**, about 5 hours old, so it's inside D3's 24h window. **D3 satisfied: no `db dump` needed.**
- **PITR is off** (`pitr_enabled: false`). A restore therefore goes back to 16:05 EDT, and
  **anything written to production after that is lost**. A restore is also a whole-project
  operation, with downtime. It's the last resort, not the plan for a bad migration: none of the four
  pending migrations rewrites existing data (F2), so a bad one is fixed forward with a new migration
  (S2's rollback notes). If you'd rather have a restore point right before the push, take S2-time
  dumps outside the workspace (they contain customer data).
Dashboard → production → Database → Backups: confirm PITR, or a daily backup within the last 24h.
If there's neither, take a `db dump` (D3). **Pass:** you can name the restore point you'd use.

---

## Execution (Stages 1–6 — the user runs every hosted step)

### S1 — Baseline (only if R1 shows `20260911000001` pending)  ✖ ABORTED (2026-10-23)
✖ Not needed. R1 shows `20260911000001` already applied on production. None of the four pending
migrations has a backfill (F2), so there are no existing rows to take a baseline of.
That migration's backfill acts on real `booking_transactions` rows. Run the three baseline queries
in `architecture/database-reset-and-deploy.md` → "Staging — routine update" against production
and paste the results here. Otherwise mark it ✖ not needed and give R1's result as the reason.

### S2 — `db push` to production  ✅ DONE (2026-10-23)
🔄 **2026-10-23: `db push` run against production by the user** (reported: "migration done, pointed
to the prod db"; the dry-run output wasn't pasted here). That's near-me Phase 1. **Still to verify:**
near-me Phase 2 (2a–2e, production), the `booking-documents` bucket, and `migration list` showing no
empty `remote` on production.

✅ **Phase 2a + 2b passed on production (2026-10-23, run from here with the user's go-ahead)**, via
`npx --no-install supabase db query --linked --project-ref <production ref>`. That goes through the
Management API as `postgres`, so only single plain `SELECT`s were run. `.temp/project-ref` was
checked before and after and still reads staging. ⚠️ Side effect: the CLI printed *"Initialising
login role..."*. It provisions its own temporary login role on the target database for `--linked`
queries. That's standard CLI behaviour, but it is a change on production.
- **2a:** exactly one function, `get_popular_offerings(date,date,text,integer)`, args `p_since date,
  p_until date DEFAULT NULL::date, p_city_code text DEFAULT NULL::text, p_limit integer DEFAULT 8`.
  It's the new shape.
- **2b:** `acl = {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`,
  `security_definer = true`. **There's no `anon` and no PUBLIC entry**, so the revoke took.
- **Independent expectation for 2c–2e (October 2026, the function's predicate re-run against the
  tables):** production has **one** countable booking this month. It's on one offering, in City of
  Manila `133900000`. So `null` should give **1 row, total 1**, and `'133900000'` should give **1
  row, total 1**. ⚠️ With a single booking, the `null` and city arms can't differ, so 2e
  **adds a negative arm**: a real code with no bookings here (`'043422000'`, Pila, which has
  bookings on staging) should give **0 rows**. That's the arm that proves the filter works.
- ✅ **2c–2e passed on production (2026-10-23, run by the user** in the SQL editor, acting as their
  own active root account through `request.jwt.claims` + `set local role authenticated`):
  `null` → 1 row / total 1 · `'133900000'` (Manila) → 1 / 1 · `'043422000'` (Pila) → **0 / 0** ·
  `''` → **ERROR 22023** *"p_city_code is blank — pass null for platform-wide"*. Every arm matches
  the independent expectation, and the Pila arm shows the city filter excludes other cities. The
  first attempt, with the email placeholder left in, raised **42501 not permitted**. That
  incidentally confirms the `is_active()` gate refuses an unidentified caller.
- ✅ **Bucket:** `booking-documents` exists (user, SQL editor, 2026-10-23).
- ✅ **All four in production's ledger** (run from here, one `SELECT`, 2026-10-23):
  `supabase_migrations.schema_migrations` has `20261002000001`, `20261003000001`, `20261004000002`
  and `20261016000001`. Their objects exist too: `booker_cancel_booking`,
  `get_unbookable_offerings`, `raise_booking_dispute`, `resolve_booking_dispute`, and the
  `booking_disputes.kind` column. This stood in for the `migration list` re-check.
```bash
cd backbone
cat supabase/.temp/project-ref        # still staging; we target prod by --db-url only
npx supabase db push --db-url "<production conn string>" --dry-run
npx supabase db push --db-url "<production conn string>"
```
⚠️ Never `--include-seed`, never `db reset`. `pending/` is ignored by the CLI. Leave it there.
**Pass (needs a live environment):**
- the `--dry-run` list equals R1's pending set, no more
- `migration list` against production shows no empty `remote`
- near-me S3d **Phases 1–2** run verbatim on production (grants: no `anon`; the 2c–2e calls are
  the user's, since `claude_ro` is staging-only)
- `select id from storage.buckets where id = 'booking-documents';` returns one row (if
  `20261002000001` was pending)
**Rollback:** there's no down migration for `20261016000001` (near-me S3d Phase 4: recover with a
new migration and revert booker, never by hand-editing). The `202609110000*` rollbacks live in
`backbone/supabase/rollback/`. After any hand rollback, run
`migration repair --status reverted <version>`.

### S3 — Deploy `send-notification-email` (only if R5 says it's behind)  ✖ ABORTED (2026-10-23)
✖ Not needed. R5 shows production runs the same bundle as staging, and the only later change on
`develop` is TypeScript-only (no runtime effect).
```bash
npx supabase functions deploy send-notification-email --project-ref <production ref>
```
**Pass:** `functions list` shows a fresh updated-at, and the next real notification email renders.
That's a live check, normally confirmed by the first KYC or status email after release.

### S4 — Promote the apps, in D2's order (recommended: command → booker → vendor)  ✅ DONE (2026-10-23)
✅ **Promoted by the user, 2026-10-23.** All three were promoted before the probes ran, not one app
at a time as written. That didn't matter, because S2 had already landed, which is the only
ordering that carries risk (F2). Confirmed by S5: every production domain now serves a new
deployment carrying the staging release.
For each app: Promote the staging deployment identified in R3. If the build cache was used, prefer
redeploying with the cache disabled (`overview.md`: `NEXT_PUBLIC_*` is compiled in and survived
an env edit on 2026-08-10). Wait for it to go live, then run S5 for that app **before promoting
the next one**.
- **command first**, so admins can handle KYC and refund requests (`20261003000001`) before booker
  can create them.
- **booker second.** This is near-me S3d's "deploy second". Then run near-me **Phase 3** (a signed-in
  booker sees the Popular shelf, with no 404 on `/rest/v1/rpc/get_popular_offerings`).
- **vendor last.** It depends on nothing the others ship.
If R3 found an app whose staging is a separate Vercel project, it has nothing to promote. Deploy
that app's production environment from the commit R3 recorded, per D1.

### S5 — Post-deploy probes, per app  ⏸ PARKED (2026-10-23) — machine probes ✅, two live checks parked
⏸ **Parked by the user (2026-10-23):** "I can't do those real paid booking test now. We'll do that
later. My only objective is to get these on production, as to not blocking mobile dev." **Why:**
the release goal (production level with staging, so mobile development isn't blocked) is met.
Every machine probe passes, and the database checks passed in S2. **Still unverified on
production:** near-me Phase 3 (the Popular shelf as a signed-in booker) and one real paid
booking. **Unblock:** the user schedules a live test session. Run the two ⬜ items below then.
🔄 **Machine probes run from here over public HTTP, 2026-10-23. All pass.** Two checks remain that
need a live signed-in session (the user's).

| Probe | command.ezzy.ph | booker.ezzy.ph | vendor.ezzy.ph |
|---|---|---|---|
| Serving a new deployment | ✅ `dpl_E3LmQzFsaivS5YtW3qVpW9kcijH9` (was `…Ecaz…`) | ✅ `dpl_EVo3S1Lozh69V6o6hfH7gPg8AEVj` (was `…4nhs…`) | ✅ `dpl_69jq8scRAQE82QR7gzXt7VhSvdvr` (was `…5q1N…`) |
| It's the staging release | ✅ dark-lift CSS 7/7 | ✅ 11/11 | ✅ 7/7 |
| Supabase in bundle + CSP `connect-src` | ✅ production `pdkej…` only | ✅ production only | ✅ production only |
| `localhost:3000` in page + bundle | ✅ 0 | ✅ 0 | ✅ 0 |
| OG/canonical host | ✅ `command.ezzy.ph` | ✅ `booker.ezzy.ph` | ✅ `vendor.ezzy.ph` |
| Webhook secret landed | — | ✅ `400 {"error":"Invalid signature"}` | — |
| Kiosk payment route authenticates first | — | n/a (booker has no kiosk route, `404`) | ✅ see note |
| Code that needs the new migrations | — | ✅ `p_city_code`, `get_unbookable_offerings`, `booker_cancel_booking` in bundle | — |

- **Kiosk note (a finding about the checklist, not the app):** the checklist's bodiless probe gets
  `400 {"error":"Missing bookingId"}` on both production and staging, not the documented `401`.
  The route (`vendor/app/api/kiosk/payment/create-session/route.ts:37`) checks the body shape first,
  which reveals nothing. With a dummy body it returns **`401 {"error":"Not signed in."}`**, before
  any config or DB read. That's the intended order (the comment at `:39-48`). The probe in
  `architecture/production-env-checklist.md` → "Verify after every deploy" should send
  `-H 'content-type: application/json' -d '{"bookingId":"00000000-0000-0000-0000-000000000000","vendorId":"00000000-0000-0000-0000-000000000000"}'`.
  That's the user's to update, under Stage 4 (below).
- ⬜ **near-me Phase 3 (user):** signed in as a booker on `booker.ezzy.ph`, with the location set to
  **City of Manila** (the only city with a countable booking this month, per S2), the Popular shelf
  renders, and the network tab shows **no 404 on `/rest/v1/rpc/get_popular_offerings`**.
- ⬜ **One real paid booking (user):** book, pay, and confirm `is_paid` becomes `true`.
From `architecture/production-env-checklist.md` → "Verify after every deploy", with `$H` named
once per app:
```bash
H=https://<host>; curl -s $H | grep -oE 'dpl=dpl_[A-Za-z0-9]+' | head -1   # = the promoted deployment
curl -s $H/ | grep -c localhost:3000                                         # 0
curl -s $H | grep -oE '/_next/static/chunks/[^"]+\.js' | sort -u | sed "s|^|$H|" \
  | xargs -n1 curl -s | grep -ohE 'https://[a-z]{20}\.supabase\.co' | sort -u  # production ref only
```
- booker: `curl -s -X POST $H/api/payment/webhook` → `{"error":"Invalid signature"}`
- vendor and booker: `curl -s -o /dev/null -w '%{http_code}\n' -X POST $H/api/kiosk/payment/create-session` → `401`
- then the only test that counts: one real booking and payment, with `is_paid` becoming `true`.
**Pass:** every probe matches. The payment test is live-only and the user's.

### S6 — Bring the git branches up to what's live (the user handles git)  ⬜ TODO
👤 **Handed to the user (2026-10-23):** "skip stage 4, I will do that myself". It's not run from here.
⚠️ **Per D4, backbone `master` is NOT moved.** It's the branch the Supabase GitHub integration
watches. Backbone's `production` branch is a different branch, so moving it is bookkeeping only.
For each of `vendor`, `booker`, `command`: move `production` to the SHA promoted in S4. Promote
doesn't move it. For **vendor** (Production tracks `production`), the next push would otherwise
silently replace the live build. For **booker** it's bookkeeping only (F8). For **command**, read
its Production branch tracking first. For `backbone`: move `production` to `develop`. Only after R4 confirms the integration
won't act, or after S2, so any auto-apply is a no-op. Afterwards, confirm with
`git -C <repo> rev-list --left-right --count origin/production...<sha>` → `0 0`.

### S7 — Close the books  ⬜ TODO
👤 **Handed to the user (2026-10-23):** "skip stage 4, I will do that myself". It's not run from here.
- With the user's confirmation, flip near-me (`2026-10-14-booker-near-me-discovery.md`) to COMPLETE.
  Its only open item is the production round, which S2 and S4 carry out.
- Record "production level with staging as of <date>, migrations through `20261016000001`" in the
  `architecture/schema.md` migration history, if it tracks per-environment state. Update
  `overview.md`'s Vercel mapping with what R3 found for command and booker.
- Re-run `python3 scripts/plans-index.py`.

---

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains. -->
- **D1** — What ships per app → **Promote whatever each staging domain serves now** (resolved
  2026-10-23, by the user). It's the tested artefact. Revisit for an app only if R3 shows its
  staging is behind work that must ship.
- **D2** — App order → **command → booker → vendor** (resolved 2026-10-23, by the user). Reasons
  are in S4.
- **D3** — Restore point → **Supabase PITR/daily backup, if R6 confirms one within 24h** (resolved
  2026-10-23, by the user). Take a `db dump` only if R6 finds none.
- **D4** — How changes reach production → **Manual only** (resolved 2026-10-23, by the user): "don't merge anything. I will manually trigger deployments and always just promote a good staging" build. Migrations reach production **only by `db push`** (S2). The apps reach it **only by Vercel Promote** of a tested staging deployment (S4). **Backbone `master` is never merged into**, because the Supabase GitHub integration is connected to it (R4) and a merge could apply migrations with no dry-run.

## DEFERRED / OUT OF SCOPE
- `pending/retire_release_booking_payouts.sql` stays parked until payouts REVISIT C7 is done.
- The Expo apps release through EAS on their own plans.
- Checkout S2 candidate plans are documentation-only, with nothing to deploy.

## Execution order
1. **Stage 0** — R1–R6, read-only, any order. Resolve D1–D3 with their results.
2. **Stage 1** — S1 (if needed), then S2. Stop if any S2 check fails. Nothing has reached the apps
   yet, so the live apps are unaffected (F2).
3. **Stage 2** — S3 (if needed).
4. **Stage 3** — S4 + S5, one app at a time, in D2's order.
5. **Stage 4** — S6, then S7.

## Verification summary
- **Machine-verified here (2026-10-23):** F1–F7 (git diffs, greps, migration headers).
- **Needs a live environment (all the user's):** R1–R6, every S-step pass condition, the
  authenticated Popular-shelf render, and one real paid booking.
