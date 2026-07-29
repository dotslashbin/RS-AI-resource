# Platform Pivot — Execution Plan (vendor / booker / Bookdeck)

**Date:** 2026-06-18
**Scope:** backbone + booker + vendor + command + architecture docs
**Status:** ✅ EXECUTED (2026-06-18) — P1–P4 + D4 + seed-content pass all DONE and build/grep-verified. **P5 (env/deploy) ⬜ deferred** to launch (gated on `bookdeck.com`). Outstanding user action: **`supabase db reset`** to load the P1b category change, P4 renamed migration files, the rewritten seed, and the API-role-grants fix (`20260620000001`, see Post-pivot fix below) — no `gen types` needed for the seed/grants themselves.
**Decisions reference:** `.plans/2026-06-12-platform-pivot-vendor-booker.md` (D1–D6 all resolved). This file is the *how*; that file is the *why*.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.

---

## Strategy (from D5a — pre-launch re-baseline)
No prod exists; local Supabase is reset-rebuilt. So we **edit the existing 22 migrations in place** to use the new names directly (no `ALTER … RENAME` migrations), update `seed.sql`, then `supabase db reset` to rebuild from scratch.
> ⚠️ **Conscious override:** AGENTS.md says "never edit an applied migration." That rule protects shared/prod schemas. It is **deliberately waived here** because the only environment is a resettable local DB and there is no prod data — re-baselining is far cleaner than 20 rename-migrations. Re-affirm this is still true at execution time (no prod provisioned).
> 📌 **Mechanic (read literally):** every "rename"/"drop" below means **edit the original `CREATE`/`INSERT`/policy statement in place** (or delete it) — **never add a new `ALTER … RENAME` / `DROP` migration.** The migration set still numbers 22 after this work; we change their contents, not their count.

## Rename rule (D4 boundary — applies throughout)
**Rename NOW:** DB schema (tables, columns, types, fns, policies, seed values) + **user-visible copy** (labels, headings, button text, placeholders).
**Defer (D4 sweep):** pure non-visible **code identifiers** — TS type names (e.g. command's `School` type), variable names, internal function names not shown to users.
Example: command's "Schools" page heading/labels → "Vendors" **now**; the `School` type / `useSchools` hook name → **deferred**. The service *query* (`academies→vendors`) is DB-layer → **now**.

## Branch/git
Each app is its own repo (`booker`, `vendor`, `command`) + `backbone`. Do the pivot on a dedicated branch per repo (e.g. `pivot/vendor-booker`) cut from `feature/api_hardening`. Backbone + all three apps must land together (types regen couples them).
> ⚠️ **Pre-req:** commit/merge the outstanding hardening work first, so the pivot branch is cut from a clean, complete base — otherwise those changes risk being lost or conflicting under the rename.

---

## P1 — Backbone DB re-baseline  ✅ DONE (2026-06-18)  ⚠️ was highest risk (RLS)
<!-- Marker corrected 2026-07-28: the plan's own status line already recorded P1–P4 as DONE
     and build/grep-verified; this heading was never flipped. -->
**STAGED (decision 2026-06-18):** **P1a pure rename → RLS gate → P2 app wiring (Stage A)**, *then* **P1b category-model change + its app UI (Stage B)**. Rationale: isolate "did the rename break RLS/builds" from "did the category model change break rendering." Edit migrations in place, reseed, reset, regen types. Identifiers confirmed 2026-06-18.

### P1a — Pure rename (vendor / booker / staff / contact / accreditation)  ✅ DONE (2026-06-18)
> Executed: ordered sed rename across all migrations + seed (incl. `bookings.learner_id→booker_id`), `accreditation_no` NOT NULL dropped, notification type label → "New Vendor Registration", seed auth emails `@roadsafety.ph→@bookdeck.com`, comments/exception messages de-driving'd. `offering_categories`/`category_id` left intact. **`supabase db reset` green.** **GATE P1a PASSED** — live catalog check (0 tables w/o RLS, 0 fns w/o search_path, portals/roles correct) + independent static re-audit (no escalation paths, no dead refs, no collisions, booker_id consistent).
> **Follow-up — seed-content pass  ✅ DONE (2026-06-18):** `seed.sql` rewritten to a generic sports/recreation marketplace — vendors **Citywide Sports Center / Harbor Sports Complex / Summit Athletics Club**, offerings keyed `COURT/COACH/FIT/GROUP`, categories `rental/session/class`, generic requirements/descriptions, root password `DriveBook@root1→Bookdeck@root1`, Harbor left with `accreditation_no = null` to exercise the optional path. Every UUID, status mix, notification fan-out, and the original booked-dates/day-of-week arrays preserved (occurrence validity holds); offering codes ↔ staff-specialty refs and schedule titles ↔ bookings-block selects all cross-checked. **Also cleaned the migration COMMENTS that slipped through P1a** — 5 driving/school/TDC/LTO comment strings + the `"an vendor"→"a vendor"` grammar artifact (8 spots, incl. the `vendor_approval` exception message). `grep` for `driving|school|TDC|PDC|MDC|LTO|academy|examiner|instructor|learner|an vendor` across **migrations + seed** is now empty. **Needs `supabase db reset`** to load (no schema change → no `gen types`).
> **Known cosmetic (optional follow-up):** new seed categories (`rental/session/class`) don't match the fixed colour-map keys in booker/vendor (`offering/lesson/other`), so their chips use the neutral fallback — by design per the P1b/P3 colour decision; align the maps only if coloured chips are wanted.

Everything except the category-model change. `offering_categories` + `offerings.category_id` are **left intact** in P1a.
1. **Lookup seeds** (`20260504000001_lookup_tables.sql`): `portals` `'academy'→'vendor'`, `'learner'→'booker'` (ids 1/2 unchanged); `roles` `'academy-admin'→'vendor-admin'` (id 4 unchanged).
2. **Core tables** (`20260504000002_schema.sql`): `academies → vendors`; `lto_accred_no → accreditation_no` + **drop NOT NULL** (D3a); `academy_members → vendor_members` with `academy_id → vendor_id`; de-driving comments.
3. **Helper fns** (`20260504000002`): `is_academy_member → is_vendor_member`, `has_academy_role → has_vendor_role` — and **every call site** in RLS.
4. **RLS** (`20260504000003_rls.sql` + `20260515000001_learner_academy_read_policy.sql`): every policy referencing the renamed tables/fns and portal values `'academy'`/`'learner'`.
5. **Offerings — rename only** (`20260506000001_offerings.sql`): `offerings.academy_id → vendor_id`. **Leave `offering_categories` + `category_id` untouched** (that's P1b). Keep `code` (drop driving seed in seed.sql), `requirements`, `duration`.
6. **Staff** (`20260507000001_instructors.sql`): `instructors → staff`, `academy_id → vendor_id`, `instructor_specialties → staff_specialties` (`instructor_id → staff_id`); `check_instructor_specialty_academy → check_staff_specialty_vendor`.
7. **Schedules** (`20260507000002_schedules.sql`): `academy_id → vendor_id`, `instructor_id → staff_id`, `examiner_name → contact_name`, `examiner_phone → contact_phone` (D3d); `check_schedule_academy → check_schedule_vendor`.
8. **Bookings** (`20260507000004` + `…0003/0005/0006`): `academy_id → vendor_id`; `check_booking_consistency` updated; `booking_documents` / `booking_status_log` reviewed for academy refs.
9. **Vendor approval** (`20260511000001_academy_approval.sql`): `academy_status_log → vendor_status_log`; `prevent_academy_status_self_update → prevent_vendor_status_self_update`; `validate_academy_status_transition → validate_vendor_status_transition`; `log_academy_status_change → log_vendor_status_change`.
10. **Profile/region fields** (`20260513000001`, `20260516000001`): retarget to `vendors`.
11. **Notifications** (`20260525000001` settings + `20260525000003` triggers): type key `academy_pending_approval → vendor_pending_approval` (DB value); `notify_on_new_booking`/`notify_on_booking_status_change` reference `vendor_members`/`'vendor-admin'`; portal values `'academy'→'vendor'`, `'learner'→'booker'`; `data` keys `academy_name → vendor_name`.
12. **Seed** (`seed.sql`): reseed renamed entities — vendors/booker/staff/contact; **offerings keep `category_id` against the still-intact `offering_categories`** (changes in P1b); drop TDC/PDC/MDC (neutral example codes); de-driving names; **de-brand auth emails** (`*@roadsafety.ph` → `*@bookdeck.com`, or neutral `@example.com`); `accreditation_no` blank on some vendors to exercise the optional path.
13. `supabase db reset` → `supabase gen types typescript` → commit regenerated types into each app.

**🔒 GATE P1a — RLS re-verification (security, blocking): ✅ PASSED (2026-06-18)** — live catalog check (psql) + independent static re-audit, both clean. **method** — a policy re-read/reasoning pass mirroring the original backbone audit (read every policy + SECURITY DEFINER fn against the new names), **plus** a few live cross-portal checks after `db reset` (log in as a seeded booker / vendor-admin / command admin and confirm scoping). Checks: booker cannot self-escalate role/portal/membership or self-activate; vendor-scoped reads/writes intact; cross-portal isolation holds; all 18 SECURITY DEFINER fns still pin `search_path`. Do not proceed past Stage A until this passes.

> **Stage A = P1a + P2 (rename wiring).** After P1a's reset+regen, the apps reference old names → they will not build until P2 is done. So P1a and P2 land together as one coherent stage, ending with all three apps green on the renamed schema, **category model unchanged**.

### P1b — Category model change (D3b)  ✅ DONE — code (2026-06-18)  (Stage B)
> Executed: **backbone** — removed `offering_categories` table+RLS+seed; `offerings.category_id (FK) → category text not null default ''`; seed offerings switched to free-text `category` ('exam'/'lesson'). **booker + vendor** — offerings/schedules services drop the `offering_categories` join and read `category` text; `OfferingCategory` type → `string` (free-text); offering create/update write `category` directly. **Colour strategy decided:** keep existing fixed colour maps (`CATEGORY_STYLE`/`TC`/`TB`) with their existing `?? default` fallback — unknown/custom categories degrade to a neutral chip; no new hash-to-colour code. Both apps build green. **command unaffected** (no offering/category usage).
> **Needs your `supabase db reset` + `gen types`** for the category schema change to take effect locally (build doesn't hit the DB; runtime does).

Done only after Stage A is green. This DB change forces its app-side counterpart in the same stage (build breaks otherwise).
- **Backbone** (`20260506000001_offerings.sql`): remove the `offering_categories` CREATE + RLS + seed statements; replace `offerings.category_id (FK)` with **`category text not null default ''`**. Update `seed.sql` offerings to free-text `category`. `supabase db reset` → `supabase gen types`.
- **App-side (pairs immediately):** the P3 "Offering category UI" bullet — service query change (drop the `offering_categories` join; read `category` text) + the colour strategy (hash-to-colour / neutral chip) in booker Step 1 + vendor offering badges.
- Build-verify all three apps. (Minimal RLS impact — only the removed `offering_categories` read policy.)

**Prod-readiness coupling (update those plans as part of P1):**
- Backbone **B3** CHECK: drop the `lto_accred_no` non-blank check (now optional); keep `name` (`vendors.name`) non-blank.
- Backbone **I1** (uploads storage RLS) will reference `vendor`/`staff` RLS — note for when uploads is built.
- vendor/booker **B2/I6** register validation: `accreditation_no` optional now.

---

## P2 — App wiring (booker, vendor, command)  ✅ DONE (2026-06-18) — Stage A complete
**Per-app status:**
- ✅ **booker DONE (2026-06-18)** — PORTAL `booker`, Realtime filter, `verifyLearnerAccess` portal value→`booker`, service queries (`vendors`/`vendor_id`/`booker_id`), webhook (vendor_members/vendor-admin/portal/data keys), create-session `booker_id`, register portal/source/copy, notif type-key `vendor_pending_approval`. Build green; sweep empty.
- ✅ **vendor DONE (2026-06-18)** — PORTAL `vendor`, Realtime filter, all service queries (`vendors`/`vendor_members`/`staff`/`staff_specialties`/`staff_id`/`vendor_id`/`booker_id`/`accreditation_no` nullable, `examiner_*→contact_*`), register route (portal/role/`vendor_members`/data keys/`source: vendor_admin`/titles+body copy), notif type-key. Build green; sweep empty.
- ✅ **command DONE (2026-06-18)** — `Portal` union + `ALL_PORTALS` + `PORTAL_CFG` keys → `vendor`/`booker` (functional values; UI display derives); schools.service + 3 mutation hooks (`academies→vendors`, `accreditation_no`); notif type-key `vendor_pending_approval` (union + NotificationItem + NotificationSettings map) + the settings portal-label map ("Learner→Booker", "Academy→Vendor"). Build green; sweep empty. *Deferred → "Schools"/"Instructors" display headings + login prose → P3; `School` type/`useSchools`/`getSchools`/`schools.service.ts` filename → D4.*
- *Deferred (D4) both apps: `verify*Access` fn names, `*.service.ts` filenames, `LearnerAcademy`/`Instructor`/`SchoolProfile` types, `academies`/`instructors` local vars, `academyName`/`learnerId` fields, `"instructors"` PageId. Display copy ("School", "Instructors") → P3.*

Per app, after P1 types are regenerated:
1. **`PORTAL` constants** (notification services): booker `'learner'→'booker'`; vendor `'academy'→'vendor'`; command unchanged.
2. **Realtime filters** in the `useAppShell` effects: `portal=eq.learner→booker`, `portal=eq.academy→vendor`.
3. **Access-verification services:** `verifyLearnerAccess → verifyBookerAccess`; academy access → vendor; portal/role checks `'academy'→'vendor'`, `'academy-admin'→'vendor-admin'`, `'learner'→'booker'`.
4. **Service queries** to renamed tables/cols: `academies→vendors`, `academy_members→vendor_members`, `instructors→staff`, `offering_categories` gone (`category` text), `schedules.examiner_*→contact_*`, `*.academy_id→vendor_id`.
5. **Route handlers / payloads:** register routes + webhook notification inserts — portal values, type key `vendor_pending_approval`, `data` keys (`academy_name→vendor_name`, `academy_id→vendor_id`); also update any app-side code that **reads** `notification.data.academy_*` (e.g. notification rendering). `accreditation_no` optional.
6. **Command-specific (the "Schools" surface):** command calls vendors **"schools"** throughout. Per the D4 rule: **now** → user-visible copy ("Schools"→"Vendors", "Register New School"→"Register New Vendor", etc.) + the portal-options list/labels (`ALL_PORTALS`, `PORTAL_CFG`, user-modal portal toggles: `academy→vendor`, `learner→booker`) + service queries (`getSchools` → `academies→vendors` query). **Deferred** → the `School` type, `useSchools`/`SchoolCard`/`SchoolFormModal` identifier names (D4 sweep).
7. **Per-app build-verify** (`npm run build`) after wiring; fix type fallout from regen.

> Do **not** regress hardening: the caller gates (`/api/users`, create-session), payment integrity, notifications fan-out, and the `<Toaster/>` all hardcode portal/role names — confirm each still works with the new values.

---

## P3 — De-constrain vocabulary (copy + DB labels; identifiers deferred per D4)  ✅ DONE (2026-06-18)
> Minor copy finished: vendor "Exam Type Breakdown"→"Category Breakdown", offering-form placeholders (Court Rental/RENT), calendar/schedule legends → generic "Offering"/"Booking", "learners"→"bookers" helper copy.
> **Done (build-verified all 3 apps):** command "Schools"→"Vendors" chrome (nav/cards/txn col); vendor "Instructors"→"Staff" labels + "LTO Accreditation"→"Accreditation / License No." + offerings/guide copy de-academy'd; **category UX rebuilt free-text + dynamic** — OfferingFormModal free-text input + `<datalist>` of distinct categories, OfferingsPage + SchedulePage filters derived from distinct `category` values, booker Step 1 shows the real category text (colour via fixed-map + neutral fallback). `OfferingCategory` type → `string`.
> **Remaining P3 (minor copy):** calendar/schedule colour LEGENDS still list "Exam/Lesson/Other" (decorative); "Exam Type Breakdown" heading; OfferingFormModal placeholder examples ("Theoretical Driving Certificate"/"TDC"); any stray booker dashboard "exam" copy. → finish with P3a or a copy pass.
- **Offering category UI** (D3b fallout) — **DECIDED (2026-06-18): free-text + dynamic, column-sourced.** Category is vendor-typed free text. The offering form is a free-text input with a **datalist/combobox of the distinct values already in the `category` column** (deduped) for reuse. **Filters** (OfferingsPage, SchedulePage) and **labels/legends** are derived from the distinct categories present in loaded data — **no lookup table**, the column is the source. Colours: keep the existing fixed colour map + neutral fallback for unknown categories (known seed categories keep their colour; custom ones get a neutral chip). Replaces all hardcoded `exam`/`lesson`/`other` filter tabs, `<option>`s, and legends.
- **Vendor "Instructors" page → "Staff"** (UI copy; queries already use `staff` from P1).
- **Accreditation label:** "LTO Accreditation No." → "Accreditation / License No. (optional)".
- General user-facing driving copy (exam/driving/LTO) → generic offering vocabulary.
- **Deferred (tracked):** code-identifier sweep (`exam→offering`, `instructor→staff` variable/fn names) — separate later pass per D4.

### P3a — Login screen copy (file-grounded; needs Bookdeck brand)  ✅ DONE (2026-06-18)
> Executed across all three `LoginPage.tsx` (desktop + mobile copies):
> - **booker** — brand "RS Learner"→**Bookdeck**, "Student Portal"→"Booking Portal", `<Car>`→`<CalendarCheck>` icon, "LTO Accredited Platform"→"Book Anything, Anywhere", "Your licence"→"Your next booking", TDC/PDC/MDC + exam/school bullets → generic offering/vendor copy.
> - **vendor** — "Road Safety I.T. Services"→**Bookdeck**, "School Portal"→"Vendor Portal", "Grow your academy"→"Grow your business", instructor/exam/LTO bullets → staff/offerings copy, "Register Your Academy"→"Register Your Business", "Choose your academy"→"Choose your business", "School Name"→"Business Name", "LTO Accreditation No."→"Accreditation / License No.", placeholders → business/`bookdeck.com`.
> - **command** — "Road Safety I.T. Services"→**Bookdeck**, "Academy approval / pending driving school registrations"→"Vendor approval / pending vendor registrations", "academies"→"vendors" copy, `command.roadsafety.ph`→`command.bookdeck.com`, `admin@roadsafety.ph`→`admin@bookdeck.com`.
> All three build green. Login-flow files' code identifiers (`DbAcademy`, `academy` vars, `verify*Access`, `select_academy` LoginView value) deferred per D4.

---

## P4 — Architecture docs  ✅ DONE (2026-06-18)
> Executed across `architecture/{overview,portals,schema,booking-flow,conventions,auth-and-roles}.md`: mechanical entity rename (academy→vendor, learner→booker, instructor→staff, examiner→contact, lto_accred_no→accreditation_no, DriveBook→Bookdeck) — learner/academy/instructor refs now 0; brand prose (RS/Road Safety/School Portal → Bookdeck/Vendor Portal); overview reframed as a vertical-agnostic marketplace; **`offering_categories` table section removed + offerings doc now `category text` free-text** (was factually stale); LTO/driving-course framing → optional accreditation + generic offerings; ER diagram + migration-history table updated; prose de-schooled.
> **Also: renamed the migration FILES to match** — `..._instructors→_staff`, `..._academy_approval→_vendor_approval`, `..._academy_profile_fields→_vendor_profile_fields`, `..._learner_academy_read_policy→_booker_vendor_read_policy`, `..._academies_region_branches→_vendors_region_branches` (doc + disk now consistent). ⚠️ **Needs another `supabase db reset`** — local migration tracking still has the old versions; reset rebuilds from the renamed files.
> Residual "school"/"exam" refs are deferred **code identifiers** (`school`/`exam` wizard vars, `SchoolsPage`, "Choose School" step) → D4 sweep, accurate to current code.

---

## P5 — Env / deploy (mostly deferred with the deployment checklist)  ⬜ TODO
- Per-app `.env.local` / `.env.example` (names only).
- Rename Vercel projects; brand domains `*.bookdeck.com` (after `.com` secured — D6).
- Feeds the prod-readiness deployment checklist (do not run it until the pivot lands — D5 note).

---

## Execution order & gates
1. **Stage A — Rename:** **P1a** backbone rename (edit migrations → reset → regen types) → **🔒 GATE: RLS re-verification** → **P2** app wiring (renames) → build-verify all three apps. Ends green, category model unchanged.
2. **Stage B — Category model:** **P1b** backbone (drop `offering_categories` → `category text`, reset → regen) + its app-side category query/UI (colour strategy) → build-verify.
3. **P3 / P3a** remaining de-constrain + login copy (brand-dependent; `.com` check for live domains only, not blocking copy).
4. **P4** docs.
5. **P5** env/deploy — deferred until launch.

## Open real-world gate
- **`bookdeck.com` availability** (D6) — verify before P5 live-domain work / Resend sender domain. Backup: Bookbase. Not blocking P1–P4.

## Verification (whole pivot)
- All three apps `npm run build` clean against regenerated types.
- RLS re-verification passes (GATE P1).
- `grep -ri "academy\|learner\|lto\|examiner\|school\|driving\|tdc\|pdc\|mdc\|instructor\|exam"` is **empty** across all three apps' `app/components/lib/services/hooks` **and** across `backbone/supabase/{migrations,seed.sql}` — the D4 identifier sweep + seed-content pass closed the formerly-deferred code identifiers and the driving-flavored seed/comments. (Only parent-brand "RS" remains in portal titles — intentional.)
- Hardening still green: caller gates 403 without auth, payment amount server-derived, notifications fan-out to vendor-admins, replay-safe webhook.
- Seed loads; a booker can book a vendor offering end-to-end locally.

## D4 — Code-identifier sweep + driving/school text & graphics  ✅ DONE (2026-06-18)
All three apps swept; each builds green; `grep` for `TDC|PDC|MDC|driving|drivebook|LTO|exam|school|instructor|<Car|academy` across `app/components/lib/services/hooks` is empty in all three.
- **booker** — services `learner.service→booker.service` (`verifyLearnerAccess→verifyBookerAccess`), `academies.service→vendors.service` (`getAcademiesForOffering→getVendorsForOffering`); `Step2School→Step2Vendor`; types `LearnerAcademy→BookerVendor`, `LearnerSchedule→BookerSchedule`; `OFFERING_CODE_STYLE` emptied (free-text, DEFAULT fallback); Sidebar `Car→CalendarCheck`; layout description, "Choose Vendor", `app.bookdeck.com`, globals.css tokens, CLAUDE/AGENTS brand → Bookdeck.
- **vendor** — services `instructors.service→staff.service`, `academy.service→vendor.service`; `components/instructors→components/staff` (Staff* components); types `Instructor→Staff`, `DbAcademy→DbVendor`, `SchoolProfile→VendorProfile`; PageId `instructors→staff`; `students→clients`; removed `ExamType`; `TC/TB` colour maps emptied; `BookingTrendsCard` mock codes neutralized + breakdown derived from data; Sidebar `Car→Store`; layout/Packages copy.
- **command** — `School*→Vendor*` types/components/hooks/files (`SchoolsPage→VendorsPage`, `useSchools→useVendors`, `getSchools→getVendors`, `schools.service→vendors.service`, `hooks/mutations/schools→vendors`, `SchoolTrendsCard→VendorTrendsCard`); `instructors→staff`; PageId `schools→vendors`; `Transaction.student→client`, `.school→.vendor`, `.exam:ExamType→.offering:string`; removed `ExamType`; `EXAM_TYPES→OFFERING_CATEGORIES` (Rentals/Sessions/Classes); `BOOKING_TREND` keys `tdc/pdc/mdc→rentals/sessions/classes`; mock vendor names neutralized; Sidebar `Car→LayoutDashboard`; "Exam Type" filter→"Offering"; accreditation/`drivebook.ph` placeholders.
- **docs** — `architecture/portals.md` `SchoolsPage→VendorsPage`; root `AGENTS.md` workspace tree (learner/academy/api → booker/vendor/backbone), DriveBook/School-Portal/driving descriptions → Bookdeck, migrations path `api/→backbone/`.
- *Note: parent-brand "RS" left intact in portal titles (RS Command / RS Booker) — not a driving/school term.*

## Post-pivot fix — API role table grants  ✅ DONE (2026-06-20)
**Symptom:** root login → command failed with "You do not have access to the Command portal."
**Cause (not the pivot):** the `public`-schema default privileges grant the API roles only `Dxtm` (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN), **no `SELECT`/`INSERT`/`UPDATE`/`DELETE`**, and no migration granted them. PostgREST checks table privileges before RLS, so `verifyCommandAccess`'s self-reads (`profiles`/`user_portals`/`user_roles`) returned `permission denied` → empty → treated as "no access." Affected all logged-in reads platform-wide; command's strict `active + portal + role` gate made it visible. The same broken default also (wrongly) gave `anon`/`authenticated` `TRUNCATE`.
**Fix:** new migration `20260620000001_api_role_grants.sql` (least-privilege, per the intentional-hardening decision): `anon` → no grants (no policy references it); `authenticated` → exactly the operations each table's RLS policies permit (no TRUNCATE); `service_role` → full DML; revokes the inherited `Dxtm` from anon/authenticated and revokes their `public` default privileges so **new tables must grant explicitly**. Validated in a rolled-back txn against the live DB (root check returns active+command+root; anon has nothing; authenticated has no TRUNCATE). **Needs `supabase db reset`** to apply. Documented in `architecture/schema.md` (migration history + RLS Philosophy note) and as an `AGENTS.md` invariant.

## Follow-ups (post-pivot)
- Resume prod-readiness (deployment checklist, backbone `is_paid` depth ⏸, uploads feature) under the new names.
