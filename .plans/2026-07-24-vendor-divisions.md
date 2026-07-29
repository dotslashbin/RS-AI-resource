# Vendor Divisions

**Date:** 2026-07-24
**App / scope:** `backbone` (migration), `vendor` (registration Step 1), `command` (Divisions CRUD + vendor assignment)
**Status:** COMPLETE (executed and verified 2026-07-24) — but see the branch-state warning immediately below: the migration is **not merged**, so the shipped code is currently running against a schema that lacks the table.

> ⚠️ **I1's migration is stranded on an unmerged branch (found 2026-07-27).** `backbone/supabase/migrations/20260724000004_divisions.sql` exists **only** on `feature/division_assoc_reg` — not merged into `develop`, `master`, or `feature/vendor_transactions`. The *app* side was merged (command's divisions commit `eebebff` is on `develop` and later branches), so every app that reads `divisions` is live against a schema where the table does not exist. After a `supabase db reset` on any branch but that one:
> - `GET /rest/v1/divisions` → `PGRST205` "Could not find the table 'public.divisions' in the schema cache" — Command's Divisions CRUD tab is dead.
> - `GET /rest/v1/vendors?select=…,divisions(name)` → `PGRST200` no relationship — **Command's whole Vendors page fails**, not just I6's badge, because `vendors.service.ts:8` selects `division_id, divisions(name)`. Create/update vendor also writes a `division_id` column that doesn't exist.
> - Vendor portal: `/api/divisions` returns nothing, so registration Step 1's division Combobox is empty and blocks progression; `profile.service.ts`'s `divisions(name)` join fails on Vendor Profile.
>
> **Fix:** merge or cherry-pick `feature/division_assoc_reg` in `backbone`, then `supabase db reset`. It carries three files — the migration, `seed.sql` (assigns divisions to the seeded vendors), and `package.json`. The committed branch tips merge cleanly (checked with `git merge-tree`), but `seed.sql` may hold uncommitted work from other plans, which git will refuse to overwrite — commit or stash first.
>
> Nothing is wrong with this plan's *execution*: all of I1–I6 were built and verified as recorded. This is purely a branch-integration gap, recorded here because the plan's own I1 note ("applied via `supabase db reset`, 13 seed rows verified") was true on that branch and reads as though the migration is generally available.

> 🔺 **ESCALATED 2026-07-29 — this is no longer hypothetical.** Re-verified during a
> cross-plan staleness audit, and the gap now reaches the **hosted** project
> (`fbxbwnfeimzhgxpshdpa`), which is what `ezzy-vendor-mobile` runs against and what any
> deployed web app would use:
>
> - `GET /rest/v1/divisions` → `PGRST205` "Could not find the table `public.divisions`"
> - `GET /rest/v1/vendors?select=name,division_id` → `42703` "column `vendors.division_id`
>   does not exist"
>
> Meanwhile the **app side is merged and live**: `vendor` on `develop` references divisions
> across nine files (`app/api/divisions/route.ts`, `app/api/auth/register/route.ts`,
> `services/divisions.service.ts`, `services/profile.service.ts`, `lib/types.ts`,
> `lib/kycDraft.ts`, `components/auth/LoginPage/*`, `components/profile/ProfilePage/*`).
> `backbone` is currently on `feature/vendor_mobile_dev`, which does not carry the migration;
> it exists only on `feature/division_assoc_reg` (commit `7da7bb8`).
>
> **Consequence:** vendor self-registration against the hosted project is broken, not
> degraded — Step 1's division select cannot populate and the register route writes a column
> that does not exist. Command's Vendors page fails on the `divisions(name)` join.
>
> `architecture/schema.md` documents `divisions`, `vendors.division_id` and migration
> `20260724000004_divisions.sql` as though all three are present. That is accurate to the
> intended state and **wrong about the current one** — see the caveat added there 2026-07-29.
>
> This needs a `backbone` branch merge plus a `supabase db push` to hosted. Both are approval
> gates, so neither was done as part of the audit.

> Add a `divisions` lookup table (the 13 Ezzy business-vertical brands: EzzyDrive,
> EzzyCare, EzzyWell, EzzyCourt, EzzyFood, EzzyRide, EzzyHome, EzzyPets, EzzyLaw,
> EzzyPark, EzzyLearn, EzzyWork, EzzyStay) and associate every vendor with exactly
> one. Vendors pick their division during self-registration; Command has full CRUD
> over the lookup table and can (re)assign any vendor's division at any time. This
> plan covers only the association — filters, promotions, and any other feature
> that later reads `vendors.division_id` are explicitly out of scope.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local.

---

## Scope

**In scope:**
- New `divisions` lookup table (seeded with the 13 divisions from the screenshot), RLS + grants.
- `vendors.division_id` FK column (nullable, `ON DELETE RESTRICT`).
- Vendor portal: division `<select>` added to registration Step 1 ("Business details"), required.
- Command: new "Divisions" admin page (full CRUD: add/edit/soft-disable) under Settings.
- Command: division `<select>` added to `VendorFormModal` so an admin can set/change any vendor's division at any time (independent of registration).
- Read-only division display on Command's `VendorCard` and the vendor portal's Vendor Profile page (I6 — added on review; see below).
- Architecture doc updates (`overview.md`, `schema.md`, `portals.md`) to reflect the new table and retract the "no vendor groups" invariant.

**Explicitly out of scope (deferred to later plans):**
- Booker-facing filters by division.
- Any promotion feature that reads division.
- Per-branch division assignment — `vendors.branches` is a count (`smallint`), not individual rows; there is no `vendor_branches` table today (see `schema.md:203-210`). Associating the vendor covers all its branches by construction; a dedicated `vendor_branches` table (with its own `division_id`, if branches ever need independent divisions) is future work, not part of this plan.
- Backfilling `division_id` for vendors that already exist in the DB before this ships — Command assigns those manually via the updated `VendorFormModal` as needed; no bulk migration script.

**Decisions already resolved with you (2026-07-24):**
- Cardinality: **one division per vendor** — single FK column, not a junction table.
- Registration: **required** at Step 1, blocking progression. Column stays nullable at the DB level (pre-existing vendors, and so a delayed frontend deploy can't violate a NOT NULL).
- Command CRUD UI: **new page under Settings**, alongside Notification Type Settings.
- Division delete: **blocked while in use** (`ON DELETE RESTRICT`) + an `is_active` soft-disable flag as the actual "remove from circulation" action.

---

## Investigation summary (what the code currently does)

- `vendors` table (`schema.md:159-213`) has no category/vertical column today. `region` (free text, Command-only) and `branch`/`branches` (label / count) are unrelated concepts — division is orthogonal to both.
- Two write paths into `vendors` (`schema.md:192-201`): vendor self-registration (`vendor/app/api/auth/register/route.ts`) and Command's vendor form. Both need to write `division_id` going forward.
- **Vendor registration**: `vendor/app/api/auth/register/route.ts` (181 lines) — multipart Route Handler, atomic with rollback. Step 1 fields are collected in `vendor/components/auth/LoginPage/LoginPage.tsx` (lines 298-310) + `useLoginPage.ts` (`handleDetailsContinue`, lines 210-225), which gates progression on required-field validation — the same place `division` needs to slot in. The route inserts `vendors` at lines 113-126; `division_id` joins that insert.
- **Command CRUD precedent**: no lookup-table CRUD UI exists in `command` yet. `NotificationSettingsPage`/`useNotificationSettingsPage.ts` (hook+tsx split) is the closest shape — fetches a table via a `services/*.service.ts` function, renders rows, optimistic update — but it only toggles `is_enabled` on pre-seeded rows; it has no add/delete UI. The Divisions admin page will be the **first** full add/edit/disable lookup-table surface in this codebase — follow the hook/tsx split and service-file pattern, but the CRUD affordances (add-row form, delete/disable action) are new, not copied.
- **Command vendor assignment**: `command/components/vendors/VendorFormModal/{VendorFormModal.tsx, useVendorForm.ts}` (hook+tsx split) currently edits `name`, `region`, `contact`, `email`, `accred`, `branches`, `status` (`status` is a hardcoded `<select>` of two literals, not table-fetched). Mutations go through `command/hooks/mutations/vendors/{useCreateVendor,useUpdateVendor,useDeleteVendor}.ts`, which look up `statuses.id` by name inline. The division field follows the same shape as the existing `status` select, but sourced from the new `divisions` table instead of a hardcoded list.
- **RLS/grants precedent**: lookup tables in this codebase are `authenticated`-read (no `anon` — confirmed in `20260620000001_api_role_grants.sql`; even the booker vendor-browse policy at `20260515000001_booker_vendor_read_policy.sql` is scoped to `authenticated`, not `anon`). Command-managed lookup tables (`notification_type_settings`, `kyc_document_types`) grant `admin`/`root` write via RLS, and — per the `kyc_document_types_grant_fix` migration — **the table-level GRANT must explicitly include every operation the RLS policy allows**, or writes 403 regardless of RLS. `divisions` needs `select` for `authenticated`, and `insert/update/delete` for `authenticated` (gated by RLS to admin/root) from day one, avoiding a repeat of that grant-gap bug.
- **Housekeeping note (found, not fixed here):** `schema.md:199` and the "Two write paths to `vendors`" table still reference `command/components/schools/SchoolFormModal` — that path no longer exists; the real component is `command/components/vendors/VendorFormModal`. Flagging per Surgical Changes (mention, don't silently fix) — worth a one-line correction whenever `schema.md` is next touched; this plan's own doc-update step (I5) will fix it as it's touching this doc anyway.

**Architecture-doc conflict (resolved, not open):** `overview.md:125` states *"Multi-tenancy beyond vendors... There is no concept of regions, franchises, or vendor groups beyond the individual vendor record."* This plan directly changes that. Per plan-authoring §7 this would normally be a hard-gating decision point, but the user's request is explicitly to add this vendor-grouping concept — so the resolution is: **update the doc**, not avoid the feature. Tracked as I3 below, not left silently contradicted.

---

## BLOCKERS

*(None — this is additive: new table, new nullable column, new UI surfaces. Nothing existing breaks before the frontend changes ship.)*

## IMPORTANT

### I1 — `divisions` lookup table + `vendors.division_id`  ✅ DONE
**File:** new migration `backbone/supabase/migrations/20260724000004_divisions.sql`

**Schema (draft — approval gate, do not run until you say go). Verified against the raw migration SQL (not just `schema.md`'s summary) — see the review note below the block:**

```sql
create table public.divisions (
  id         smallint primary key generated always as identity,
  name       text not null unique,          -- e.g. "EzzyDrive"
  slug       text not null unique,          -- e.g. "ezzy-drive" (future filter URLs)
  sort_order smallint not null default 0,   -- display order, matches the source menu
  is_active  boolean not null default true, -- soft-disable; hides from new selection
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table  public.divisions is 'Ezzy business-vertical taxonomy (EzzyDrive, EzzyCare, ...). Seeded; full CRUD by Command admins. Every vendor is associated with exactly one.';
comment on column public.divisions.slug is 'Kebab-case identifier, derived from name at creation. Stable — referenced by future filter URLs; treat as immutable after creation even though the column itself isn''t DB-enforced immutable.';
comment on column public.divisions.is_active is 'Soft-disable. false hides the division from new vendor selection (app-layer filter, not RLS) without breaking existing vendor associations.';

create trigger set_divisions_updated_at
  before update on public.divisions
  for each row execute function public.set_updated_at();

insert into public.divisions (name, slug, sort_order) values
  ('EzzyDrive', 'ezzy-drive', 1),
  ('EzzyCare',  'ezzy-care',  2),
  ('EzzyWell',  'ezzy-well',  3),
  ('EzzyCourt', 'ezzy-court', 4),
  ('EzzyFood',  'ezzy-food',  5),
  ('EzzyRide',  'ezzy-ride',  6),
  ('EzzyHome',  'ezzy-home',  7),
  ('EzzyPets',  'ezzy-pets',  8),
  ('EzzyLaw',   'ezzy-law',   9),
  ('EzzyPark',  'ezzy-park', 10),
  ('EzzyLearn', 'ezzy-learn',11),
  ('EzzyWork',  'ezzy-work', 12),
  ('EzzyStay',  'ezzy-stay', 13);

alter table public.vendors
  add column division_id smallint references public.divisions(id) on delete restrict;

comment on column public.vendors.division_id is 'The Ezzy business-vertical division this vendor belongs to. Nullable — NULL for vendors that existed before this column shipped; required going forward at self-registration.';

create index vendors_division_id_idx on public.vendors(division_id);

alter table public.divisions enable row level security;

create policy "authenticated can read divisions"
  on public.divisions for select
  to authenticated
  using (true);

create policy "command admin or root can manage divisions"
  on public.divisions for all
  to authenticated
  using      (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')))
  with check (public.is_portal_member('command') and (public.has_role('admin') or public.has_role('root')));

grant select                          on public.divisions to authenticated;
grant insert, update, delete          on public.divisions to authenticated;
grant select, insert, update, delete  on public.divisions to service_role;
```

**Corrections made from the first draft, verified against actual migration SQL (not just `schema.md`'s prose summary):**
- `has_role('admin','root')` **is not a valid call** — `has_role(role_name text)` takes one argument (confirmed in `20260504000002_schema.sql:242`). Every existing "admin or root" policy in this repo spells it out as `(public.has_role('admin') or public.has_role('root'))` (confirmed across `20260504000003_rls.sql`, `20260624000001_notification_email_settings.sql`, and — the closest sibling table — `20260706000001_vendor_kyc.sql:37-41`'s `kyc_document_types` write policy, which this migration now mirrors exactly).
- The read policy originally used `using (public.is_active())` — wrong function for the intent. `is_active()` (no args) checks whether the **calling user's profile** is active; it says nothing about a division row's own `is_active` flag, and the column name collision made this look like row-filtering when it wasn't. Fixed to `using (true)`, matching the exact precedent of every other lookup table read policy in this repo (`statuses`, `portals`, `roles`, `kyc_document_types`, `notification_type_settings` — all plain `using (true)` for authenticated select). "Hide inactive divisions from new selection" is enforced app-side (I2's `getActiveDivisions()` filters `is_active = true`), the same way `kyc_document_types.applies_to` filtering is app-side, not RLS-side — Command's own CRUD page still needs to see disabled rows to re-enable them, which a row-level `is_active` filter would have blocked.
- **Added:** `create index vendors_division_id_idx` — every other FK column in this schema is indexed (Postgres does not auto-index FKs), and this repo already had to retroactively add exactly this kind of missing index once before (`20260724000002_vendor_members_vendor_id_index.sql`). Missing here would repeat that gap.
- **Added:** `comment on table`/`comment on column` statements — a real, consistently-followed convention (16 existing migration files use them; the first draft had none).
- **Added:** the actual `updated_at` trigger statement (confirmed function name `public.set_updated_at()` exists at `20260504000002_schema.sql:157`) — the first draft only had a comment placeholder, not real SQL.
- **Fixed filename** to the concrete next sequence number (`...000004`; last used was `20260724000003_booking_capacity_lock.sql`) instead of a placeholder.
- **Grant check:** confirmed `insert, update, delete` to `authenticated` is included in *this same migration* — the sibling `kyc_document_types` migration originally shipped without it and needed a follow-up grant-fix migration a month later (`20260724000001_kyc_document_types_grant_fix.sql`). This draft avoids repeating that gap.

**Blast radius (§8):**
- **Data:** additive only — new table with 13 seed rows; new nullable column on `vendors` (existing rows get `NULL`, no rewrite failures possible).
- **Lock/performance:** `ALTER TABLE ... ADD COLUMN` with no default and nullable is a metadata-only change in Postgres (no table rewrite, near-instant lock). Adding the FK constraint does require a validation scan of `vendors`, and building the new index scans the table once — both fast at this table's current size, but note for whoever applies this to hosted: `CREATE INDEX` (not `CONCURRENTLY`) takes a brief write lock on `vendors`. Acceptable at current scale; call out explicitly if `vendors` ever grows large enough for this to matter.
- **Downstream:** the hand-written `Vendor` interface needs `division_id` added in both `vendor/lib/types.ts:142` and `command/lib/types.ts:20`. **Note on `command`:** its `Vendor` interface is a display-shaped type (`short`, `staff`, `joined`, `rating`, `totalBookings`, `revenue` — several of these are still cosmetic/mock fields, not raw DB columns), so this also means updating whatever `DbRow` → `Vendor` mapping function `command/services/vendors.service.ts` uses (per `conventions.md`'s Row Mapping pattern) — not just the interface declaration. A new `services/divisions.service.ts` (or equivalent) is needed in both `vendor` and `command` to fetch the list.
- **Reversibility:** `DROP INDEX vendors_division_id_idx; ALTER TABLE vendors DROP COLUMN division_id; DROP TABLE divisions;` — clean rollback, no other table references `divisions` yet.

**Fix approach:** Apply exactly as drafted above pending final review.

✅ DONE (2026-07-24) — Migration applied via `supabase db reset` against the local stack. Verified: 13 seed rows present with correct sort order; FK + `vendors_division_id_idx` index exist (`\d`); RLS policies and table grants match the draft exactly (`\dp`). Live RLS behavior additionally verified against the running local PostgREST (not just structural inspection): a fresh authenticated non-admin user can `SELECT` divisions but gets `42501` (RLS violation) on `INSERT`; a user granted command `admin` role successfully inserts. All test users/rows cleaned up afterward.

---

### I2 — Vendor registration: division select in Step 1  ✅ DONE
**File:** `vendor/components/auth/LoginPage/LoginPage.tsx:298-310`, `vendor/components/auth/LoginPage/useLoginPage.ts:210-225`, `vendor/app/api/auth/register/route.ts:113-126`, `vendor/app/api/divisions/route.ts` (new — public GET, added post-hoc, see bug note below)

Add a required `division_id` select to the "Business details" step, alongside `vendorName`/address/phone. `handleDetailsContinue` gates progression — add division to its required-field check the same way the other Step 1 fields are validated. The atomic register route needs the new field added to its accepted body and to the `vendors` insert (following the existing pattern at lines 113-126); validate it's a real, `is_active` division id server-side before insert (never trust the client value blindly, per `conventions.md`'s Route Handler rules — though this is the public self-registration exception, input is still validated before writes).

**Fix approach:** Fetch divisions via a new `vendor/services/divisions.service.ts` (`getActiveDivisions()`, mirrors `notifications-admin.service.ts`'s plain-select pattern), render as a `<select>` in Step 1, thread the chosen id through `useLoginPage`'s form state into the multipart POST body.

✅ DONE (2026-07-24) — Implemented: `divisions.service.ts` (`getActiveDivisions`), `RegForm.divisionId` threaded through `useLoginPage` (draft persistence bumped to `kycDraft` v3, resume-step gate, `handleDetailsContinue` validation), select added to `LoginPage.tsx` Step 1, `kyc.service.ts`/`submitKyc` and the register route updated. Verified live against the running dev server + local Supabase (not just type-checked): `curl` multipart POSTs to `/api/auth/register` confirmed (a) a valid active division id succeeds and the resulting `vendors` row has the correct `division_id` (joined and checked via `psql`), (b) a missing `divisionId` is rejected with 400 before any user is created, (c) a nonexistent division id (999) is rejected with "Invalid division.", (d) a disabled (`is_active=false`) division id is also rejected — confirming the server-side re-validation (not just trusting the client) actually works, not merely present in the diff. No orphaned `auth.users` rows from the rejected attempts. `next build` and `tsc --noEmit` both clean for the `vendor` app.

**Styling follow-up (2026-07-24):** the Division field was first built as a plain native `<select>` — functionally correct but visually inconsistent with Province/City/Barangay, which all use the shared `Combobox` component (`components/ui/Combobox/Combobox.tsx`, Radix Popover-based, styled input + chevron + panel). Swapped to `<Combobox>`, mirroring `AddressFields`/`useAddressFields.ts`'s exact pattern: option-shaping (`{value, label}[]`) moved into the hook (`useLoginPage.ts`'s `divisionOptions`, not computed inline in the `.tsx`, matching `useAddressFields.ts`'s `provinceOptions`), field wrapped in the same `dark` class AddressFields uses (so the shared `--sp-*` CSS variables resolve the same dark-theme values), and the label/required-asterisk markup reuses `AddressFields.module.css`'s `.label`/`.req` classes directly rather than duplicating them — this field is genuinely the same visual language as the address fields, not just similar. Re-verified with Playwright against the live dev server: label typography, closed-state input, and the opened popover panel all now render identically to Province/City/Barangay (screenshots confirmed), zero console errors.

**Bug found after this was first marked DONE (2026-07-24, same day) — the browser-level check I'd skipped would have caught it immediately:** `getActiveDivisions()` originally queried `divisions` directly from the browser Supabase client. Registration Step 1 is shown to a **not-yet-authenticated** visitor (no account exists until the whole KYC flow submits) — so that query ran as `anon`, which has **zero table grants** in this schema (`20260620000001_api_role_grants.sql` — a deliberate, rigorously-maintained invariant, not an oversight). Result: two silent 401s and an empty dropdown (only the "Select a division" placeholder), confirmed via a real Playwright run against the user's own dev server, console errors included. The existing `kyc_document_types` suggestions sidestep this same problem by being a hardcoded frontend constant (`KYC_SUGGESTIONS`) rather than a live query — not an option here, since Command needs live CRUD over divisions and a hardcoded list would silently go stale. **Fix:** new `vendor/app/api/divisions/route.ts` — a public GET Route Handler using `createAdminClient()` (service role), mirroring how `/api/auth/register` itself is already the established public/anonymous exception to "no admin client from the client." `getActiveDivisions()` now calls this route instead of querying Supabase directly. Re-verified with a fresh Playwright run against the same live dev server: all 13 options render, zero console errors, screenshot confirms the Division field renders correctly in Step 1 between ZIP Code and Phone.

---

### I3 — Command: Divisions admin page (full CRUD)  ✅ DONE
**File:** new `command/components/settings/DivisionsSettingsPage/{DivisionsSettingsPage.tsx, useDivisionsSettingsPage.ts}`, new `command/services/divisions.service.ts` (or `command/hooks/mutations/divisions/*` for mutations, matching the vendors mutation-hook precedent)

New page under the Settings sidebar section, next to Notification Type Settings. Table of all divisions (name, slug, sort_order, is_active toggle), an "Add division" form/modal, and per-row edit + disable (not hard delete from the UI — hard delete stays possible directly in the DB only if genuinely unused, but the UI action is disable). Admin/root only, matching `NotificationSettingsPage`'s access gate.

**Gap found on review (resolved 2026-07-24):** the "Add division" form needs a `slug` value and the plan didn't specify where it comes from — a poor implementation could let the admin free-type it, risking inconsistent or duplicate-ish slugs (e.g. `"Ezzy Drive"` → `ezzy drive` with a space, or two different casings of the same word). **Resolved: auto-derive `slug` from `name`** client-side (kebab-case) at creation time, treated as immutable afterward — consistent with the column comment describing it as stable, future-filter-URL-facing.

**Fix approach:** Hook owns fetch/add/edit/disable + optimistic update (mirroring `useNotificationSettingsPage.ts`'s revert-on-error pattern); `.tsx` is pure render. This is the first true add/edit/disable lookup-table UI in the codebase — no exact copy-paste precedent exists, build it following the established hook/service conventions rather than inventing new ones.

✅ DONE (2026-07-24) — Implemented as `command/components/settings/DivisionsSettingsPage` (hook+tsx split) plus `command/services/divisions.service.ts` (`getDivisions`/`createDivision`/`updateDivision`/`setDivisionActive`) and a `slugify()` helper in `lib/utils.ts`. Placement resolved via a `SettingsPage` tab wrapper (Notification Types / Divisions) mounted at the existing single `page === "settings"` route — the sidebar had only one Settings entry with no existing sub-nav, so this was the minimal way to genuinely place it "under Settings" without restructuring the sidebar; sidebar label changed from "Notification Settings" to "Settings" accordingly. Verified: `tsc --noEmit` and `next build` clean for `command`. RLS backing this page's add/edit/disable actions was verified live via PostgREST (see I1's note) using the exact same policy. **Not verified live in a browser** — the tab switch, add-division-with-auto-slug flow, and inline rename UI were not clicked through manually; only compiled/typechecked.

---

### I4 — Command: assign/change a vendor's division  ✅ DONE
**File:** `command/components/vendors/VendorFormModal/{VendorFormModal.tsx:17-23,41-53, useVendorForm.ts}`, `command/hooks/mutations/vendors/{useCreateVendor.ts, useUpdateVendor.ts}`

Add a division `<select>` to `VendorFormModal`, sourced from the `divisions` table (same fetch as I3, or a shared lightweight `useDivisions()` hook consumed by both), following the same shape as the existing `status` select. `useCreateVendor`/`useUpdateVendor` write `division_id` on create/update, same as they currently resolve `statuses.id` by name.

**Gap found on review (resolved 2026-07-24):** `VendorFormModal` drives **both** Command's own "Add vendor" flow (portals.md: Command can add a vendor directly — `name`, `accreditation_no`, `region`, `branches`, `phone`, `email` — a path independent of vendor self-registration) and the edit flow. The original draft only considered the edit case. **Resolved: division is required on both create and edit** — no vendor is ever created, via either path, without one.

**Fix approach:** Add the field to the modal's form state and the two mutation hooks' payloads (covering create and edit), marked required on both. Select still needs an explicit "— unassigned —" option to represent `NULL` on **pre-existing** vendors from before this migration (the only legitimate source of `NULL` going forward) — those get backfilled by Command opening the edit modal, not by a bulk script (see Deferred). No new component needed — this is an addition to an existing, already hook/render-separated component.

✅ DONE (2026-07-24) — `useVendorForm` fetches all divisions (active + disabled, disabled ones labeled "(disabled)" in the option) and exposes `divisionId`; `VendorFormModal` renders the select with a blank "Select a division" placeholder (covers the legacy-`NULL` case) and gates the Save button on a non-empty selection (`canSave`), covering both `mode="add"` and `mode="edit"`. `useCreateVendor`/`useUpdateVendor` write `division_id`; `VendorsPage.handleSave` and `useVendors.toggleStatus` updated to pass it through. Verified: `tsc --noEmit` and `next build` clean.

**Browser-verified (2026-07-24, follow-up):** logged into the running command dev server as a temporary admin test user (created + torn down via the local Supabase admin API) and opened Edit Profile on a seeded vendor via Playwright. The Division field renders with the same `rs-input`/select styling as the existing Status field (screenshot confirmed), lists all 13 divisions, and correctly pre-selects the vendor's current division ("EzzyCourt", value `4`) — confirming `populate()` reads `divisionId` correctly on open, not just on save.

---

### I6 — Read-only division display  ✅ DONE
**File:** `command/components/vendors/VendorCard` (or wherever the Vendors grid renders each vendor — the Explore pass on this plan confirmed VendorsPage renders a card grid, not a table), `vendor/components/*` vendor-profile surface (per `portals.md`, the fully-wired Vendor Profile page — name/address/phone/etc.)

**Gap found on review (resolved 2026-07-24 — in scope):** the plan as first drafted only covered *setting* the division (I2 at registration, I4 in the edit modal) — nothing displays it back. Without this, a Command admin can assign a division in the edit modal but can't see it at a glance while browsing the Vendors grid, and a vendor who picked a division at registration has no way to ever see what it's set to (Command is the only one who can change it, but the vendor should still be able to see it).

**Fix approach:** Add the division name as a read-only label on `VendorCard` (Command) and on the Vendor Profile page (vendor portal, read-only — only Command can change it, consistent with how `region`/`branches` are already Command-only fields shown read-only or not at all in the vendor portal today).

✅ DONE (2026-07-24) — `VendorCard` shows the division as a badge next to the region/status chips (falls back to "Unassigned" — mapped in `vendors.service.ts`). `vendor/services/profile.service.ts` now joins `divisions(name)` and exposes `divisionName` on `VendorProfile`; `ProfilePage.tsx` renders it as a plain, always-non-editable paragraph (deliberately *not* routed through the shared `Field` component, so it stays read-only even while the rest of the form is in edit mode) — `updateVendorProfile`'s write payload still lists fields explicitly and was not touched, so there's no path for a vendor to write it back. Verified: `tsc --noEmit` and `next build` clean for both apps.

**Browser-verified (2026-07-24, follow-up) — command side:** `VendorCard`'s division badge confirmed live via Playwright against the running command dev server (screenshot) — all 3 seeded vendors show their correct badge (EzzyCourt, EzzyCourt, EzzyWell), styled as a distinct indigo pill next to the region/status chips.

**Browser-verified (2026-07-24, follow-up) — vendor portal side:** logged into the running vendor dev server as a temporary vendor-admin test user (linked to the seeded Citywide Sports Center vendor, created + torn down via the local Supabase admin API). Confirmed "DIVISION: EzzyCourt" renders correctly in the Basic Information card. Also confirmed the read-only intent actually holds under load: clicked "Edit Profile" and verified every *other* field (name, tagline, phone, email, address, description, etc.) turned into an editable input while Division stayed a plain text label with zero surrounding input/select/textarea — so a vendor genuinely cannot edit it, even while the rest of the form is in edit mode, not just by omission from the update payload. Both this and the command-side checks together close out the last outstanding gap from I6's original verification note.

---

### I5 — Architecture doc updates  ✅ DONE
**File:** `architecture/overview.md:125`, `architecture/schema.md` (new `divisions` table entry + `vendors` row + migration history + retire stale `SchoolFormModal` reference at line 199), `architecture/portals.md` (note division field in vendor registration + command capabilities)

Retract the "no vendor groups" line in `overview.md`, document the new table/column in `schema.md` per its existing per-table format, and correct the stale `SchoolFormModal` → `VendorFormModal` reference while this doc is being touched anyway.

**Fix approach:** Follow existing doc structure/tone exactly; this is documentation only, no approval gate.

✅ DONE (2026-07-24) — `overview.md` retracts the "no vendor groups" line and explains divisions as a flat grouping. `schema.md` gets a new `divisions` table entry, the ERD updated, the `vendors` column table updated, the migration-history row added, and the stale `SchoolFormModal` reference corrected to `VendorFormModal` (found during the earlier review pass). `portals.md` documents the Step 1 division pick + profile display in the vendor section, and the new Settings tabs (Notification Types / Divisions) plus updated Vendors Page description in the command section. Verified: proofread against the actual shipped code (file paths, component names, and behavior described all cross-checked against what was actually written in I1–I4/I6), no runtime check applicable.

---

## DECISIONS

- Cardinality (one division vs many per vendor) → **one, single FK column** (resolved 2026-07-24) — matches the request's wording and existing FK-column conventions (`status_id`); avoids join overhead for a need that hasn't materialized yet.
- Registration requirement → **required, blocking Step 1 progression; column nullable at DB level** (resolved 2026-07-24) — new vendors must pick one; existing/legacy vendors and any deploy-order gap stay valid at the DB layer.
- Command CRUD placement → **new page under Settings** (resolved 2026-07-24) — consistent with Notification Type Settings' existing IA slot for admin-only lookup-table management.
- Division delete semantics → **`ON DELETE RESTRICT` + `is_active` soft-disable** (resolved 2026-07-24) — prevents an accidental mass-orphan of vendors; disabling (not deleting) is the real "retire a division" action.

**Found during this review pass, now resolved (2026-07-24):**
- I4 — Command's manual "Add vendor" form → **required, same rule as self-registration** — no vendor is ever created without a division, via either path.
- I3 — new division's `slug` → **auto-derived from `name`** client-side (kebab-case), treated as immutable after creation.
- I6 — read-only division display (Command `VendorCard` + vendor portal Profile page) → **in scope for this plan**, not deferred.

No open decisions remain — all items resolved, this plan is ready to move to execution once you give final approval.

## DEFERRED / COSMETIC

- Booker-facing filters by division — explicit follow-up feature, not this plan.
- Promotion features keyed on division — explicit follow-up feature, not this plan.
- Bulk backfill of `division_id` for pre-existing vendors — Command assigns manually via I4 as needed; no script justified for what's likely a small existing vendor count.
- Per-branch division assignment (`vendor_branches` table) — no such table exists today; out of scope until per-branch registration itself becomes a real requirement (see `schema.md:210`).

## Execution order

1. **I1** (migration) — must land first; everything else depends on the table + column existing. Also update the hand-written `Vendor` TypeScript interfaces in `vendor` and `command` immediately after, per the "types are hand-written" invariant.
2. **I2** and **I4** are independent of each other once I1 lands (different apps) — safe to do in either order or in parallel.
3. **I3** is independent of I2/I4 (different app, different concern) — safe in parallel, but the "add division" flow in I3 has no urgency to land before I2/I4 as long as the 13 seeded divisions from I1 already exist for vendors/Command to select from.
4. **I6** depends on I2 and I4 landing first (needs `division_id` actually being set somewhere to display) — do after both, before I5.
5. **I5** last — documents the shipped state accurately rather than a moving target.

## Verification

- **I1:** machine-verifiable — run migration locally (`supabase db reset` or equivalent), confirm 13 seed rows, confirm the FK + its index exist, confirm RLS policies exist, confirm `authenticated` can `select` divisions and only admin/root can write (test via `service_role` bypass check + an authenticated non-admin session getting denied).
- **I2:** needs a live environment — run the vendor registration wizard end-to-end locally, confirm Step 1 blocks without a division selected, confirm the submitted vendor row has the correct `division_id`. **Done twice** — server contract via `curl`, then the actual Step 1 dropdown via a real Playwright browser session against the running dev server (screenshot + zero console errors) once the anon-access bug above was found and fixed. The first "DONE" note undersold this — a browser check would have caught the bug immediately instead of the user finding it.
- **I3:** needs a live environment — log in to command as admin/root, add a division and confirm its slug auto-derives correctly from the name, edit/disable a division, confirm a non-admin/root command session cannot reach the page or mutate (RLS-backed, but worth a UI-level smoke check too).
- **I4:** needs a live environment — both flows: create a new vendor via Command and confirm division is required (can't submit without one), and edit an existing vendor's division and confirm it persists and the vendor list reflects it.
- **I6:** needs a live environment — confirm the division name renders correctly on `VendorCard` and the vendor's own Profile page, and that a `NULL`/unassigned vendor shows a sensible placeholder rather than blank/undefined.
- **I5:** machine-verifiable — proofread diff against actual shipped schema/UI, no runtime check needed.
