# Platform Pivot — Generalize to a Vendor/Booker Marketplace

**Date:** 2026-06-12
**Scope:** all apps + backbone + architecture docs
**Status:** DRAFT / SCOPING — decision recorded, blast radius surveyed. **No execution.** Decisions below must be resolved before an execution plan is written.

> Pivot the platform from a driving-school-specific product into a general booking marketplace: **vendors** create offerings they sell; **bookers** browse and book them; **command** stays the platform ops center. First target vertical beyond driving: businesses renting sports facilities / coaching (pickleball courts, etc.).

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** P# = pivot phase, D# = open decision. Numbers are plan-local.

---

## Decision recorded (2026-06-12)
- **Naming:** `learner → booker`, `academy → vendor`, `command` unchanged.
- Same tech stack. The work is (A) the rename and (B) removing domain constraints — not a rebuild.

---

## Two intertwined efforts
1. **Rename** `learner→booker`, `academy→vendor` everywhere (folders, DB portal values, `PORTAL` constants, RLS, roles, imports, docs).
2. **De-constrain** the domain — strip driving-school/LTO-specific assumptions so the model reads as a generic marketplace.

> **Encouraging finding:** the *core data model is already generic* — `offerings`, `bookings`, `schedules`, `profiles`, `notifications` need no conceptual change. The constraints are concentrated in **naming + domain vocabulary**, not structure.

---

## Blast-radius survey (read-only, 2026-06-12)

**Rename surface — `learner` / `academy` references (accurate counts):**

| Area | `learner` | `academy` |
|---|---|---|
| learner app | 19 | 4 |
| academy app | 1 | 42 |
| command app | 8 | 18 |
| backbone (migrations) | 44 | 176 |
| architecture docs | 61 | 109 |

≈133 `learner` + ≈349 `academy` references. Largest concentrations: **backbone migrations** and **architecture docs**.

**De-constrain surface — domain vocabulary (reliable counts):**
- `driving` ≈ 70 · `exam` ≈ 183 · `instructor` ≈ 242 · `examiner` ≈ 8
- ⚠️ `LTO`/`lto_accred_no` and `TDC`/`PDC`/`MDC` exist (confirmed in DB schema/seed/constants) but a grep-quoting slip undercounted them to 0 in this survey — re-count properly during execution scoping.

**DB-level domain anchors (from `20260504000001` / `20260504000002`):**
- `portals` seed values `'academy'`, `'learner'` → become `'vendor'`, `'booker'`.
- `roles` value `'academy-admin'` → `'vendor-admin'` (decision D2).
- Tables `academies`, `academy_members`; column `lto_accred_no`; comments like *"LTO-accredited driving schools."*
- Offering `code`s (TDC/PDC/MDC) + `offering_categories` (exam/lesson/other) — driving-specific seed/vocabulary.
- `schedules.examiner_name`/`examiner_phone`; `instructors` table.

---

## Open decisions (resolve before execution) 

### D1 — Rename DB tables, or only the portal/role labels?  ⬜ OPEN
`academies`/`academy_members` → `vendors`/`vendor_members`? Renaming tables is correct for clarity but multiplies blast radius (every RLS policy, helper function, FK, service query, generated type). Alternative: keep table names, change only the user-facing `portals.name` values + app naming. **Recommendation lean:** full rename *if* we do it pre-launch (cheap with no data); otherwise label-only. Tied to D5.

### D2 — Role rename `academy-admin → vendor-admin`?  ⬜ OPEN
Touches the `roles` seed, the `academy_members.role_id in (3,4)` check, `has_academy_role()` calls, and access-verification services. Cohesive with the rename but security-sensitive (RLS depends on role names).

### D3 — What happens to domain-specific fields?  ⬜ OPEN
- `lto_accred_no` → generic (`license_no` / `accreditation_no`) or drop/make-optional? (Vendors may not be accredited.)
- Offering `code`s + `offering_categories` (exam/lesson/other) → generic categories, or vendor-defined?
- `instructors` table → `staff` / keep? `schedules.examiner_*` → generic "assigned person"?
- Learner **Leaflet map** — keep (still useful for physical facilities) — likely yes.

### D4 — Domain vocabulary in identifiers vs copy  ⬜ OPEN
~500+ `exam`/`instructor`/`driving` references. Decide how far the rename goes: user-facing **copy** only (cheap, low-risk), or also **code identifiers/variable names** (clean but huge diff). **Recommendation lean:** copy + DB/labels now; identifier-level rename only where it aids clarity, deferred otherwise.

### D5 — Migration strategy ⚠️ intersects prod-readiness  ⬜ OPEN
Migrations are immutable once applied. Two paths:
- **(a) Pre-launch re-baseline:** prod Supabase is **not yet provisioned** (prod-readiness deployment checklist still pending), and there's no prod data. Cheapest possible moment — bake the new names directly into fresh/edited migrations + seed, no `ALTER ... RENAME` churn.
- **(b) Rename migrations:** if any environment already has data to preserve, add new `ALTER TABLE ... RENAME` / data migrations.
**Strong lean: (a)** — pivoting *before* prod launch is dramatically cheaper than after. This makes the pivot time-sensitive relative to the deployment checklist.

---

## Phases (high-level — detailed steps after decisions)
- **P1 — Backbone:** portal values, role names (D2), table/column renames (D1, D3), RLS policies, helper functions, seed, comments. **Re-verify every RLS policy after portal-value changes** (security-critical).
- **P2 — App folders + wiring:** `workspace/learner→booker`, `workspace/academy→vendor`; `PORTAL` constants in the notification services; Realtime filters; import paths; access-verification services.
- **P3 — De-constrain vocabulary (D3/D4):** offering codes/categories, LTO/accreditation fields, instructor/examiner vocabulary, domain copy.
- **P4 — Architecture docs:** rewrite overview/portals/schema/booking-flow/conventions for the generalized model (170 refs).
- **P5 — Env/deploy:** per-app env, Vercel project names, `.env.example`, redirect allow-lists.

---

## Risks & coupling
- **Security:** RLS policies and `PORTAL`/role constants are load-bearing. Any rename must be followed by a full RLS re-verification (mirror the original backbone audit). A typo'd portal value silently breaks access.
- **Don't regress recent hardening:** the `PORTAL = 'learner'|'academy'` constants in the notification services, the `portal=eq.*` Realtime filters, and the caller-gate / payment routes all hardcode portal/role names — they must move in lockstep.
- **Type regen:** any DB rename → `supabase gen types` → app-wide type updates.
- **Sequencing vs prod-readiness:** do the pivot **before** provisioning prod (D5a). The pending deployment checklist should not run until this is decided, or it'll bake in the old names.

---

## Verification (when executed)
- All three apps `npm run build` clean against regenerated types.
- Full RLS re-verification: a booker cannot self-escalate / cross-portal read; vendor scoping intact.
- Grep shows zero stray `learner`/`academy` (and chosen domain terms) in code paths that were meant to change.
- The hardening items (caller gates, payment integrity, notifications fan-out) still pass with the new portal/role names.

---

## Status
- ⬜ Everything. This is a scoping doc only. Next step = resolve D1–D5, then write the execution plan. No code touched.
