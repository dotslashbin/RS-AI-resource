# Platform Pivot — Execution Plan (vendor / booker / Bookdeck)

**Date:** 2026-06-18
**Scope:** backbone + booker + vendor + command + architecture docs
**Status:** DRAFT — execution plan, **not yet approved to run**. Decisions are locked in the scoping doc.
**Decisions reference:** `.plans/2026-06-12-platform-pivot-vendor-booker.md` (D1–D6 all resolved). This file is the *how*; that file is the *why*.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> Everything below is ⬜ TODO. No code changes yet beyond the folder/git rename (P2 partial).

---

## Strategy (from D5a — pre-launch re-baseline)
No prod exists; local Supabase is reset-rebuilt. So we **edit the existing 22 migrations in place** to use the new names directly (no `ALTER … RENAME` migrations), update `seed.sql`, then `supabase db reset` to rebuild from scratch.
> ⚠️ **Conscious override:** AGENTS.md says "never edit an applied migration." That rule protects shared/prod schemas. It is **deliberately waived here** because the only environment is a resettable local DB and there is no prod data — re-baselining is far cleaner than 20 rename-migrations. Re-affirm this is still true at execution time (no prod provisioned).

## Branch/git
Each app is its own repo (`booker`, `vendor`, `command`) + `backbone`. Do the pivot on a dedicated branch per repo (e.g. `pivot/vendor-booker`) cut from `feature/api_hardening`. Backbone + all three apps must land together (types regen couples them).

---

## P1 — Backbone DB re-baseline  ⬜ TODO  ⚠️ highest risk (RLS)
Edit migrations in place, reseed, reset, regen types. Identifiers confirmed 2026-06-18.

**Renames / changes:**
1. **Lookup seeds** (`20260504000001_lookup_tables.sql`): `portals` `'academy'→'vendor'`, `'learner'→'booker'` (ids 1/2 unchanged); `roles` `'academy-admin'→'vendor-admin'` (id 4 unchanged).
2. **Core tables** (`20260504000002_schema.sql`): `academies → vendors`; `lto_accred_no → accreditation_no` + **drop NOT NULL** (D3a); `academy_members → vendor_members` with `academy_id → vendor_id`; de-driving comments.
3. **Helper fns** (`20260504000002`): `is_academy_member → is_vendor_member`, `has_academy_role → has_vendor_role` — and **every call site** in RLS.
4. **RLS** (`20260504000003_rls.sql` + `20260515000001_learner_academy_read_policy.sql`): every policy referencing the renamed tables/fns and portal values `'academy'`/`'learner'`.
5. **Offerings** (`20260506000001_offerings.sql`): **drop `offering_categories` table + its RLS + seed** (D3b); `offerings.category_id (FK) → category text`; `offerings.academy_id → vendor_id`. Keep `code` (drop driving seed in seed.sql), `requirements`, `duration`.
6. **Staff** (`20260507000001_instructors.sql`): `instructors → staff`, `academy_id → vendor_id`, `instructor_specialties → staff_specialties` (`instructor_id → staff_id`); `check_instructor_specialty_academy → check_staff_specialty_vendor`.
7. **Schedules** (`20260507000002_schedules.sql`): `academy_id → vendor_id`, `instructor_id → staff_id`, `examiner_name → contact_name`, `examiner_phone → contact_phone` (D3d); `check_schedule_academy → check_schedule_vendor`.
8. **Bookings** (`20260507000004` + `…0003/0005/0006`): `academy_id → vendor_id`; `check_booking_consistency` updated; `booking_documents` / `booking_status_log` reviewed for academy refs.
9. **Vendor approval** (`20260511000001_academy_approval.sql`): `academy_status_log → vendor_status_log`; `prevent_academy_status_self_update → prevent_vendor_status_self_update`; `validate_academy_status_transition → validate_vendor_status_transition`; `log_academy_status_change → log_vendor_status_change`.
10. **Profile/region fields** (`20260513000001`, `20260516000001`): retarget to `vendors`.
11. **Notifications** (`20260525000001` settings + `20260525000003` triggers): type key `academy_pending_approval → vendor_pending_approval` (DB value); `notify_on_new_booking`/`notify_on_booking_status_change` reference `vendor_members`/`'vendor-admin'`; portal values `'academy'→'vendor'`, `'learner'→'booker'`; `data` keys `academy_name → vendor_name`.
12. **Seed** (`seed.sql`): full reseed — vendors/booker/staff, free-text `category` on offerings, drop TDC/PDC/MDC (use neutral example codes), de-driving names; `accreditation_no` left blank on some vendors to exercise the optional path.
13. `supabase db reset` → `supabase gen types typescript` → commit regenerated types into each app.

**🔒 GATE P1 — RLS re-verification (security, blocking):** re-run the original backbone audit against the new names — booker cannot self-escalate role/portal/membership or self-activate; vendor-scoped reads/writes intact; cross-portal isolation holds; all 18 SECURITY DEFINER fns still pin `search_path`. Do not start P2 sign-off until this passes.

**Prod-readiness coupling (update those plans as part of P1):**
- Backbone **B3** CHECK: drop the `lto_accred_no` non-blank check (now optional); keep `name` (`vendors.name`) non-blank.
- Backbone **I1** (uploads storage RLS) will reference `vendor`/`staff` RLS — note for when uploads is built.
- vendor/booker **B2/I6** register validation: `accreditation_no` optional now.

---

## P2 — App wiring (booker, vendor, command)  ⬜ TODO
Per app, after P1 types are regenerated:
1. **`PORTAL` constants** (notification services): booker `'learner'→'booker'`; vendor `'academy'→'vendor'`; command unchanged.
2. **Realtime filters** in the `useAppShell` effects: `portal=eq.learner→booker`, `portal=eq.academy→vendor`.
3. **Access-verification services:** `verifyLearnerAccess → verifyBookerAccess`; academy access → vendor; portal/role checks `'academy'→'vendor'`, `'academy-admin'→'vendor-admin'`, `'learner'→'booker'`.
4. **Service queries** to renamed tables/cols: `academies→vendors`, `academy_members→vendor_members`, `instructors→staff`, `offering_categories` gone (`category` text), `schedules.examiner_*→contact_*`, `*.academy_id→vendor_id`.
5. **Route handlers / payloads:** register routes + webhook notification inserts — portal values, type key `vendor_pending_approval`, `data` keys, `accreditation_no` optional.
6. **Per-app build-verify** (`npm run build`) after wiring; fix type fallout from regen.

> Do **not** regress hardening: the caller gates (`/api/users`, create-session), payment integrity, notifications fan-out, and the `<Toaster/>` all hardcode portal/role names — confirm each still works with the new values.

---

## P3 — De-constrain vocabulary (copy + DB labels; identifiers deferred per D4)  ⬜ TODO
- **Offering category UI** (D3b fallout): category is now free-text → replace fixed colour-coding (`EXAM_CODE_STYLE`/category style maps in booker Step 1, vendor offering badges) with a hash-to-colour or neutral chip. **Decide colour strategy here.**
- **Vendor "Instructors" page → "Staff"** (UI copy; queries already use `staff` from P1).
- **Accreditation label:** "LTO Accreditation No." → "Accreditation / License No. (optional)".
- General user-facing driving copy (exam/driving/LTO) → generic offering vocabulary.
- **Deferred (tracked):** code-identifier sweep (`exam→offering`, `instructor→staff` variable/fn names) — separate later pass per D4.

### P3a — Login screen copy (file-grounded; needs Bookdeck brand)  ⬜ TODO
Rewrite **both** the desktop panel and mobile info view in each of `booker/`, `vendor/`, `command/`'s `components/auth/LoginPage/LoginPage.tsx` (refs enumerated in the scoping doc's P3a). Use **Bookdeck** branding and generic offering copy; replace `roadsafety.ph` placeholders with `bookdeck.com`.

---

## P4 — Architecture docs  ⬜ TODO
Rewrite `architecture/{overview,portals,schema,booking-flow,conventions}.md` for the generalized vendor/booker/Bookdeck model (≈170 refs): rename, drop driving framing, update the schema doc for `vendors`/`staff`/free-text `category`/`accreditation_no`/`contact_*`, update the ER diagram and table list.

---

## P5 — Env / deploy (mostly deferred with the deployment checklist)  ⬜ TODO
- Per-app `.env.local` / `.env.example` (names only).
- Rename Vercel projects; brand domains `*.bookdeck.com` (after `.com` secured — D6).
- Feeds the prod-readiness deployment checklist (do not run it until the pivot lands — D5 note).

---

## Execution order & gates
1. **P1** backbone (edit migrations → reset → regen types) → **GATE: RLS re-verification**.
2. **P2** app wiring, build-verify each app.
3. **P3 / P3a** de-constrain + login copy (brand-dependent; `.com` check for live domains only, not blocking copy).
4. **P4** docs.
5. **P5** env/deploy — deferred until launch.

## Open real-world gate
- **`bookdeck.com` availability** (D6) — verify before P5 live-domain work / Resend sender domain. Backup: Bookbase. Not blocking P1–P4.

## Verification (whole pivot)
- All three apps `npm run build` clean against regenerated types.
- RLS re-verification passes (GATE P1).
- `grep -ri "academy\|learner\|lto\|examiner\|instructor"` shows only intentionally-deferred identifier hits (D4) — no stray DB/portal/role/table refs.
- Hardening still green: caller gates 403 without auth, payment amount server-derived, notifications fan-out to vendor-admins, replay-safe webhook.
- Seed loads; a booker can book a vendor offering end-to-end locally.

## Follow-ups (post-pivot)
- D4 code-identifier sweep (`exam`/`instructor`/`driving` variable & fn names).
- Resume prod-readiness (deployment checklist, backbone `is_paid` depth ⏸, uploads feature) under the new names.
