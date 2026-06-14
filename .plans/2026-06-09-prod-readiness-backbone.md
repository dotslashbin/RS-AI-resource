# Production Readiness — Backbone (Supabase DB) + Shared Infra

**Date:** 2026-06-09
**App:** `./backbone` + deployment/infra
**Status:** TRIAGED — nothing executed. Blocked on: B1 depth decision (⏸ PARKED), schema/storage approvals (B3, I1, I2), and deferred SMTP/deployment work. No privilege-escalation blockers found in the audit.

> A full RLS/trigger audit found **no privilege-escalation blockers**: all 19 tables have RLS, all 18 SECURITY DEFINER functions pin `search_path`, and a learner cannot self-grant a role/portal/academy-membership or self-activate. The items below are the remaining gaps plus the shared infra work that gates all three apps.

> **Legend:** B# = Blocker, I# = Important. **These numbers are plan-local** — backbone I1 is *not* the same as command I1 or academy I1. Always qualify cross-plan references by app (e.g. "command I1", "backbone B3").

---

## BLOCKERS (must fix before launch)

### B1 — No DB constraint linking `is_paid` to a real payment  ⏸ PARKED (2026-06-12)
> **Pinned:** enforcement-depth decision deferred by the user. **Unblocks when:** the user picks CHECK-only / trigger-only / both.
> **Finding to carry forward:** the CHECK alone is *weak* — `payment_reference` is set at checkout **start** (`create-session:48`), not at payment, so an academy-admin can still flip `is_paid` on any started booking (CHECK passes). The real invariant ("only the service-role webhook sets `is_paid`") needs a column-guard trigger keyed on `auth.uid() IS NULL`. Recommendation leaned **both** (trigger + CHECK). No code until resolved.

**File:** `bookings` table (`20260507000004` + `20260518000001`)

`is_paid` is meant to be set only by the PayMongo webhook (service role). But nothing in the DB enforces that. Any booking-updater (an academy-admin via the UPDATE policy, or a buggy/compromised path) could set `is_paid = true` with `price_paid = 0` and no `payment_reference`. This is the DB-layer backstop to the learner create-session fix (learner B1).

**Fix approach — new migration:**
```sql
alter table public.bookings
  add constraint bookings_paid_requires_reference
  check (is_paid = false or payment_reference is not null);
```
**Decision point (PINNED — see PARKED note above):** CHECK-only / trigger-only / both. ⚠️ Superseded recommendation: the earlier "CHECK for MVP" lean was **revised after verification** — the CHECK alone is weak (`payment_reference` is set at checkout start, not payment), so the lean is now **both** (column-guard trigger keyed on `auth.uid() IS NULL` as the real control + CHECK as a declarative backstop). Awaiting the user's pick.

> ⚠️ Approval gate: this is a schema change (new migration + `supabase gen types`). Needs explicit go-ahead per AGENTS.md before writing.

### B2 — Auth SMTP (Resend) — gates all three portals ⚠️ SHARED
**Supabase project config, not a migration.**

**Provider DECIDED: Resend** (2026-06-12). Supabase's built-in mailer is not for production (heavily rate-limited, dev-only), so a custom SMTP provider is required; Resend is the chosen one (see `production-costs.md`).

New users (command-invited) have no password and must use reset; academy + learner have "Forgot Password." **Without production SMTP, invites and all password resets are dead platform-wide.** Today the only emails in the system are Supabase Auth's own: `resetPasswordForEmail` (all three portals) + `email_confirm` on user creation — there is **no app-level email code anywhere** (verified 2026-06-12).

**Fix approach:** Point Supabase Auth → SMTP at Resend (verified sender domain, e.g. `noreply@<domain>`). Set invite + reset templates. Verify the reset-redeem flow (Supabase-hosted redeem page is fine for MVP) and the redirect URL allow-list includes prod domains. Test end-to-end from each portal. New secret: `RESEND_API_KEY` if/when app-level email is added — **server-only**, same handling rule as `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_`).

> **Impact on recent hardening: NONE (verified 2026-06-12).** Resend is the delivery mechanism for Supabase Auth emails, configured at the project level — it does not touch any hardened file (payment integrity, session cleanup, settings, error boundaries, de-brand). The removed `admin@alpha-laguna.com` (academy B1) was a *display* fallback, not a sender.
>
> **Forward synergy (not a conflict):** if app-level transactional emails are added later (e.g. "payment confirmed" via the Resend API), trigger them from the PayMongo webhook *after* the **learner I4** `is_paid` false→true transition guard so replays don't double-email; gate by `notification_type_settings.is_enabled` if they mirror notifications.

### B3 — Non-empty CHECK constraints on `academies.name` / `lto_accred_no`
**Backs academy B2.** The columns are `NOT NULL` but permit empty/whitespace-only strings, and `academies` has **two write paths** (academy self-register route + Command SchoolFormModal). DB-layer checks defend both; route-layer validation alone leaves the Command path open.

**Drafted migration** — `backbone/supabase/migrations/20260612000001_academies_nonempty_checks.sql`:
```sql
-- Non-empty CHECK constraints on academies.name / lto_accred_no.
-- Columns are NOT NULL but that permits empty/whitespace-only strings.
-- Two write paths reach this table (academy self-register route + Command
-- SchoolFormModal); these checks defend both at the DB layer.
-- Uses `~ '\S'` (>=1 non-whitespace char) so tabs/newlines-only are rejected.
-- Email format intentionally NOT constrained — login emails are validated by
-- Supabase Auth (GoTrue); academies.email is non-critical contact info and
-- Postgres email-regex is unreliable.
-- Must run after: 20260504000002 (academies table)

alter table public.academies
  add constraint academies_name_not_blank
    check (name ~ '\S');

alter table public.academies
  add constraint academies_lto_accred_no_not_blank
    check (lto_accred_no ~ '\S');

comment on constraint academies_name_not_blank on public.academies is
  'Rejects empty or whitespace-only school names. Enforced for all write paths.';
comment on constraint academies_lto_accred_no_not_blank on public.academies is
  'Rejects empty or whitespace-only LTO accreditation numbers.';
```

**Blast radius (verified):**
- **Data:** safe. `ADD CONSTRAINT CHECK` validates all existing rows on apply and aborts if any fail. All 3 seeded academies have non-empty `name`/`lto_accred_no` → clean. No backfill.
- **Lock:** brief `ACCESS EXCLUSIVE` + full table scan to validate — milliseconds at MVP scale. (At large scale, split into `ADD ... NOT VALID` + `VALIDATE CONSTRAINT`; unnecessary here.)
- **Types:** none — CHECK constraints don't alter generated TS types. No `supabase gen types` churn, no app-code changes.
- **Reversible:** `drop constraint` either name.

**⚠️ Coupling — must batch with command I1.** On a blank value both write paths get Postgres `23514` (check_violation):
- Academy self-register route: caught by the generic catch → "Failed to create academy" (`route.ts:79`). Vague but safe — academy B2's route-layer trim/validation should run first so the user gets a clear message; this CHECK is the backstop.
- **Command SchoolFormModal: mutations don't error-check at all (command I1).** Today the insert appears to succeed in the optimistic UI then silently never persists. This constraint turns command I1 from latent into visible. **Fix command I1 in the same batch**, or Command's school-create UX regresses.

> ⚠️ Approval gate: schema change. Drafted only — needs explicit go-ahead before the file is written.

---

## IMPORTANT (fix at launch or shortly after)

### I1 — Booking-document Storage bucket + policies  ⬜ TODO — REQUIRED (approval gate)
**Promoted from conditional → required (2026-06-12):** learner B3 chose to **wire uploads for real**, so this is now in-scope as **Phase 1** of that feature.

Create a **private** Storage bucket (e.g. `booking-documents`) + Storage RLS:
- Learner: read/write objects under their own booking's path only.
- Academy-admin: read objects for bookings at their academy.
- Command admin/root: read all.

Path convention: `booking-documents/{booking_id}/{doc_id}` (matches the seed `booking_documents.storage_path` style). The learner upload writes here *after* `createBooking` returns the id; `booking_documents` rows link back.

**Coupling:** learner B3 (upload code) ⟷ this (bucket+RLS) ⟷ academy "Document viewing" (Phase 2). Ship the bucket+RLS with the learner upload code.

> ⚠️ Approval gate: Storage bucket creation + RLS policies. Needs explicit go-ahead before creating.

### I2 — Trigger notification bodies have no NULL guards
**File:** `20260525000003_notification_triggers.sql`

If `profiles.full_name`, `offerings.code`, or `academies.name` is NULL, bodies render "null has booked…". Already partially mitigated in app-layer writes (COALESCE to "A learner"), but the DB triggers themselves should `coalesce(...)`. New migration. Low blast radius, cosmetic-but-visible.

---

## DEFERRED / COSMETIC

- Notification trigger re-queries academy-admins per booking — fine at current scale; batch/cache only if volume grows.
- Status-log `with check (false)` insert policies — correct by design; add a clarifying SQL comment.
- Subqueries in `booking_documents` RLS — acceptable performance.

---

## SHARED DEPLOYMENT CHECKLIST (not code — gates launch)

These aren't per-app code changes but must be in place before any app is live:

1. **Hosted Supabase project** — all three `.env.local` currently point at `127.0.0.1:54321`. Provision prod project.
2. **Apply all 22 migrations** to prod, in order.
3. **Seed lookup tables only** (`statuses`, `portals`, `roles`, `offering_categories`, `notification_type_settings`) — NOT the test users/academies from `seed.sql`.
4. **Create real root/admin account(s)** without seed passwords (via Supabase dashboard → user sets password through reset).
5. **Per-app Vercel env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_APP_URL` (prod domain), PayMongo **live** keys + `PAYMONGO_WEBHOOK_SECRET`.
6. **Register PayMongo webhook** against the prod learner URL; capture the new signing secret.
7. **Supabase Auth redirect allow-list** includes all three prod domains.
8. **Resend SMTP** configured in Supabase Auth (verified sender domain + DNS records); `RESEND_API_KEY` (server-only) set if app-level email is added.
9. **`.env.example`** files committed per app (names only, no values) so deployment is reproducible.
10. **Vercel Pro + Supabase Pro** subscribed (see `production-costs.md`) — free tiers pause/ban commercial use.

---

## Proposed Execution Order
> All backbone items are approval-gated (schema/infra) — nothing executed yet.
1. **B3** (`academies` non-empty CHECK) — batch with **command I1** (app error-handling first, then the migration). Drafted; awaiting approval.
2. **B1** (`is_paid` enforcement) — ⏸ PARKED on the depth decision; once chosen, bundle with **I2** (trigger NULL guards) as one migration batch.
3. **I1** (Storage bucket + RLS) — **required** (learner B3 chose to wire uploads); ships with the learner upload code as Phase 1.
4. **B2 + deployment checklist** — infra/SMTP; deferred by request, but gates actual launch + end-to-end verification.

## Verification
- B1: attempt `update bookings set is_paid = true where payment_reference is null` → rejected by constraint.
- B2: trigger a password reset from each portal on the prod project → email arrives via Resend → redeem → log in.
- After migrations: `supabase gen types typescript` produces no diff surprises; all three apps `npm run build` clean against prod types.
