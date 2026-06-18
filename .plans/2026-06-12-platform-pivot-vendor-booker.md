# Platform Pivot — Generalize to a Vendor/Booker Marketplace

**Date:** 2026-06-12
**Scope:** all apps + backbone + architecture docs
**Status:** DECISIONS LOCKED — all resolved (**D1–D6**, 2026-06-18). Brand = **Bookdeck** (`bookdeck.com`, pending `.com` check). **Execution plan drafted → `.plans/2026-06-18-platform-pivot-execution.md`** (awaiting approval to run). Folder/git rename done; no other code changes yet.

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
| booker app (was learner) | 19 | 4 |
| vendor app (was academy) | 1 | 42 |
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

### D1 — Rename DB tables, or only the portal/role labels?  ✅ RESOLVED (2026-06-17) — FULL RENAME
**Decision: full table rename.** `academies → vendors`, `academy_members → vendor_members`, `has_academy_role → has_vendor_role`, plus every RLS policy / FK / helper / service query / generated type. Justified by D5a (pre-launch, no data → cheapest moment; baked into fresh migrations). Avoids the schema carrying the old domain name permanently.

### D2 — Role rename `academy-admin → vendor-admin`?  ✅ RESOLVED (2026-06-17) — YES
**Decision: rename.** Update the `roles` seed, the `academy_members`(→`vendor_members`)`.role_id in (3,4)` check, `has_academy_role`(→`has_vendor_role`) calls, and access-verification services. Security-sensitive → ships with a full RLS re-verification.

### D3 — What happens to domain-specific fields?  ✅ RESOLVED (2026-06-17)

**D3a — `lto_accred_no` → rename + make optional.** `lto_accred_no (NOT NULL)` → **`accreditation_no` (nullable)** on `vendors`. Vendors with a license record it; court-rental types leave it blank.
> Coupling: vendor register validation (academy/vendor **B2**) — the `ltoNo` field becomes **optional** (drop the required check). Backbone **B3** drops its `lto_accred_no` non-blank CHECK; keep only the `name` non-blank CHECK.

**D3b — `offering_categories` → vendor-defined free-text.** Drop the `offering_categories` lookup table; `offerings.category_id (FK)` → **`offerings.category (text)`**, vendor-typed.
> ⚠️ Bigger than it looks — blast radius: remove the `offering_categories` table + its RLS read policy; drop the `offerings.category_id` FK and add a `category text` column; **app-side** the fixed colour-coding (exam=blue/lesson=green/other=amber in booker Step 1, vendor offerings badges, `EXAM_CODE_STYLE`/category style constants) must become free-text-driven (hash-to-colour, or a neutral chip). Booker Step-1 grouping/filtering by category loses its fixed set. Decide a colour strategy during execution.

**D3c — `instructors` → rename to `staff`.** `instructors → staff`, `instructor_id → staff_id`, `instructor_specialties → staff_specialties`, plus FKs, RLS policies, the `check_instructor_specialty_academy` / academy-consistency triggers, the instructors service + vendor "Instructors" page + schedule form picker. Stays optional (slots without staff are fine). (Overrides D4's defer-identifiers lean for this specific table — chosen now, consistent with D1 pre-launch full-rename.)

**D3d — `schedules.examiner_*` → generic contact.** `examiner_name → contact_name`, `examiner_phone → contact_phone` (nullable). Per-slot point of contact for any vertical.

**Unchanged (already generic — confirmed):** `offerings.code` (keep field, drop TDC/PDC/MDC seed), `offerings.requirements`, `offerings.duration`, booker **Leaflet map** (kept — useful for physical venues).

### D4 — Domain vocabulary in identifiers vs copy  ✅ RESOLVED (2026-06-17) — COPY + DB LABELS NOW, DEFER IDENTIFIERS
**Decision: rename user-facing copy + DB values/labels now; defer code identifiers** (`exam`/`instructor`/`driving` variable & function names) to a later cleanup pass. Keeps the visible product correct while avoiding a ~500-ref diff that would collide with the still-pending hardening/uploads work. Track the deferred identifier sweep as a follow-up.

### D6 — Platform brand identity  ✅ RESOLVED (2026-06-18) — "Bookdeck" (pending .com check)
**Decision: brand = Bookdeck**, domain **`bookdeck.com`**. Neutral/vertical-agnostic compound, chosen for `.com` realism. ⚠️ **Pending live `.com` availability verification** — if `bookdeck.com` is taken, fall back to a same-shortlist alternate (suggested backup: **Bookbase**). Replaces "Road Safety I.T. Services" / "RS Road Safety network" / `roadsafety.ph` everywhere.

**Cascade (what this unblocks / touches):**
- **P3a** login copy + email/domain placeholders across all three apps (`command.roadsafety.ph` → `command.bookdeck.com`, `admin@roadsafety.ph` → `admin@bookdeck.com`, etc.).
- Deployment checklist (`.plans/2026-06-09-prod-readiness-backbone.md`): prod domains, Supabase Auth redirect allow-list, Resend **sender domain**.
- `production-costs.md` domain-registration line.
- Per-app metadata `title`/brand strings.

### D5 — Migration strategy ⚠️ intersects prod-readiness  ✅ RESOLVED (2026-06-12) — PATH (a), PRE-LAUNCH RE-BASELINE
Migrations are immutable once applied. Two paths:
- **(a) Pre-launch re-baseline:** prod Supabase is **not yet provisioned** (prod-readiness deployment checklist still pending), and there's no prod data. Cheapest possible moment — bake the new names directly into fresh/edited migrations + seed, no `ALTER ... RENAME` churn.
- **(b) Rename migrations:** if any environment already has data to preserve, add new `ALTER TABLE ... RENAME` / data migrations.
**Strong lean: (a)** — pivoting *before* prod launch is dramatically cheaper than after. This makes the pivot time-sensitive relative to the deployment checklist.

> **User decision (2026-06-12):** will **not** provision production before the pivot → path **(a)** confirmed. Bake `vendor`/`booker` (and any de-constrain renames) directly into fresh/edited migrations + seed; no `ALTER … RENAME` churn, no prod-data migration.
> **Checklist coupling:** in `.plans/2026-06-09-prod-readiness-backbone.md` → SHARED DEPLOYMENT CHECKLIST, these items change post-pivot: #3 seeds portal values `'academy'`/`'learner'` → `'vendor'`/`'booker'`; #6 "prod *learner* URL" → "prod *booker* URL"; #2 migration count grows. **Do not run the deployment checklist until the pivot lands.**

---

## Phases (high-level — detailed steps after decisions)
- **P1 — Backbone:** portal values, role names (D2), table/column renames (D1, D3), RLS policies, helper functions, seed, comments. **Re-verify every RLS policy after portal-value changes** (security-critical).
- **P2 — App folders + wiring:** ✅ **folder + git rename DONE (2026-06-16):** `learner→booker`, `academy→vendor` directories renamed and GitHub repos renamed (`thumbtaper/{booker,vendor}.git`); both on `feature/api_hardening`, healthy. No code broke — imports use the `@/` alias, not folder names. ⬜ **Remaining:** `PORTAL` constants in the notification services; Realtime `portal=eq.*` filters; access-verification services; any `command` reference to the other apps' URLs.
- **P3 — De-constrain vocabulary (D3/D4):** offering codes/categories, LTO/accreditation fields, instructor/examiner vocabulary, domain copy.
  - **P3a — Login screen marketing copy (high-visibility, often missed).** Each login page hardcodes driving-school selling copy on the left info panel, and it is **duplicated within the same file** (desktop panel + mobile info view → ~2 edits per string). Grounded references (2026-06-15):
    - `booker/components/auth/LoginPage/LoginPage.tsx` (was `learner/`) — "LTO Accredited Platform" (L46/L109); "Book exams at LTO-accredited schools near you…" (L55/L115); feature bullets "Book TDC, PDC, and MDC in minutes" / "Choose your exam type…" / "Track your booking status…" (L59–62, L117+); "Book your first exam in minutes." (L210).
    - `vendor/components/auth/LoginPage/LoginPage.tsx` (was `academy/`) — "LTO Accredited Platform" (L46/L105); "…one smart portal built for Philippine driving schools." (L55); "Build recurring exam slots and assign instructors" (L60/L113); "LTO-compliant / Fully aligned with Philippine exam requirements" (L61/L114); register placeholders "Alpha Laguna Driving Academy" + "LTO Accreditation No." (L248–249, ties to D3).
    - `command/components/auth/LoginPage/LoginPage.tsx` — "Academy approval / Review and activate pending driving school registrations" (L59/L106) — both a rename *and* de-constrain.
    - New generalized copy depends on **D6 (brand)**. Write it once the brand + offering vocabulary are settled; remember to update **both** the desktop and mobile copies in each file.
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
