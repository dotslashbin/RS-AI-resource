# Production sync — bring production level with staging (DB, Edge Function, three web apps)

**Date:** 2026-10-23
**App / scope:** release only — `backbone/` (hosted `db push` + Edge Function deploy) and the
`command`, `booker`, `vendor` Vercel projects (promote staging → production). **No code, no new
migration, no schema design.** Out of scope: the Expo apps (EAS, not Vercel), the untracked
Checkout S2 candidate plans (documentation-only, nothing in `migrations/`), and
`backbone/supabase/pending/retire_release_booking_payouts.sql` (Phase D of the payouts REVISIT
plan — it must **not** ship in this round).
**Status:** DRAFT — investigated 2026-10-23 from git and the repo only; nothing hosted was queried.
D1–D3 were resolved by the user on 2026-10-23. Ready for Stage 0 (read-only checks, run by the user).

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

### F7 — The Supabase↔GitHub integration is probably not active, but unconfirmed  ✅ recorded
`architecture/email-notifications-guide.md:109` says migrations apply automatically on merge to
`master`. But backbone `origin/master` was last updated on 2026-08-02 and lacks migrations that
production has, so the integration can't be what applied them. R4 confirms this before S6 moves any
backbone branch.

---

## Read-only pre-checks (Stage 0 — the user runs them; nothing changes)

### R1 — Measure migration drift on both projects  ⬜ TODO
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

### R2 — near-me S3d Phase 0 on production (the overload check)  ⬜ TODO
Run near-me S3d **Phase 0** verbatim against production (`.plans/2026-10-14-booker-near-me-discovery.md`,
search `HOSTED APPLY`). The key query:
```sql
select p.oid::regprocedure, p.prosecdef
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_popular_offerings';
```
**Pass:** exactly one row, `(date,date,text,integer)`, **or zero rows** if `20260927000001` is also
pending. More than one row → stop; a hand-applied overload would survive the migration's `drop`.

### R3 — Identify what each staging domain serves, and whether Promote is possible  ⬜ TODO
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

### R4 — Confirm the Supabase↔GitHub integration state  ⬜ TODO
Dashboard → production project → Project Settings → Integrations → GitHub. Record whether it's
connected, and which branch it watches. Do this for staging too. **Pass:** its state is written
here. If it's active on a branch S6 would move, that merge **is** a migration apply, so it happens
only after S2, when it's a no-op.

### R5 — Compare the Edge Function version  ⬜ TODO
```bash
npx supabase functions list --project-ref <production ref>
```
Compare `send-notification-email`'s updated-at with `2026-10-01` (the last commit, F6). **Pass:**
it was deployed on or after 2026-10-01 → S3 becomes ✖ not needed. Earlier → S3 runs.

### R6 — Confirm a restore point exists  ⬜ TODO
Dashboard → production → Database → Backups: confirm PITR, or a daily backup within the last 24h.
If there's neither, take a `db dump` (D3). **Pass:** you can name the restore point you'd use.

---

## Execution (Stages 1–6 — the user runs every hosted step)

### S1 — Baseline (only if R1 shows `20260911000001` pending)  ⬜ TODO
That migration's backfill acts on real `booking_transactions` rows. Run the three baseline queries
in `architecture/database-reset-and-deploy.md` → "Staging — routine update" against production
and paste the results here. Otherwise mark it ✖ not needed and give R1's result as the reason.

### S2 — `db push` to production  ⬜ TODO
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

### S3 — Deploy `send-notification-email` (only if R5 says it's behind)  ⬜ TODO
```bash
npx supabase functions deploy send-notification-email --project-ref <production ref>
```
**Pass:** `functions list` shows a fresh updated-at, and the next real notification email renders.
That's a live check, normally confirmed by the first KYC or status email after release.

### S4 — Promote the apps, in D2's order (recommended: command → booker → vendor)  ⬜ TODO
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

### S5 — Post-deploy probes, per app  ⬜ TODO
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
For each of `vendor`, `booker`, `command`: move `production` to the SHA promoted in S4. Promote
doesn't move it, and the next push to `production` would otherwise silently replace the live
build. For `backbone`: move `production` to `develop`. Only after R4 confirms the integration
won't act, or after S2, so any auto-apply is a no-op. Afterwards, confirm with
`git -C <repo> rev-list --left-right --count origin/production...<sha>` → `0 0`.

### S7 — Close the books  ⬜ TODO
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
