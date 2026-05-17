# Database Schema

All schema lives in `./backbone/supabase/migrations/`. Migrations are applied in filename order and must never be edited after being applied — create a new migration instead.

---

## Migration History

| File | Description |
|------|-------------|
| `20260504000001_lookup_tables.sql` | Seed data: `statuses`, `portals`, `roles` |
| `20260504000002_schema.sql` | Core tables: `profiles`, `user_portals`, `user_roles`, `academies`, `academy_members` + all RLS helper functions |
| `20260504000003_rls.sql` | RLS policies for core tables |
| `20260506000001_offerings.sql` | `offering_categories`, `offerings` |
| `20260507000001_instructors.sql` | `instructors` |
| `20260507000002_schedules.sql` | `schedules` (with recurrence model) |
| `20260507000004_bookings.sql` | `bookings`, `booking_documents` |
| `20260511000001_academy_approval.sql` | Fields/policies supporting academy approval flow |
| `20260513000001_academy_profile_fields.sql` | Additional profile fields for academy portal |
| `20260515000001_learner_academy_read_policy.sql` | RLS: allows active learners to read active academies |
| `20260515000002_offerings_requirements_jsonb.sql` | Converts `offerings.requirements` from `text[]` to `jsonb` (`[{id, label, required}]`) |
| `20260515000003_profiles_phone.sql` | Adds `phone` column to `profiles` |
| `20260516000001_academies_region_branches.sql` | Adds `region` (text) and `branches` (smallint) to `academies` for Command portal use |
| `20260516000002_booking_capacity_trigger.sql` | `check_booking_capacity()` BEFORE INSERT trigger — blocks overbooking against `schedules.max_capacity` |
| `20260516000003_booking_unique_and_rejection.sql` | `UNIQUE (learner_id, schedule_id, booked_date)` constraint; adds `rejection_reason text` column |
| `20260516000004_booking_status_transition.sql` | `validate_booking_status_transition()` BEFORE UPDATE trigger — enforces directed state transitions |
| `20260516000005_booking_cancelled_by.sql` | Adds `cancelled_by uuid → profiles` column to `bookings` |
| `20260516000006_booking_status_log.sql` | `booking_status_log` table + AFTER UPDATE trigger + RLS; immutable audit trail of status changes |

---

## Entity Relationship Overview

```
auth.users
    │
    └─── profiles (1:1)
              │
              ├─── user_portals ────────► portals
              ├─── user_roles ──────────► roles
              └─── academy_members ─────► academies ──► statuses
                                              │
                                         offerings ──► offering_categories
                                              │
                                         schedules ──► instructors
                                              │
                                         bookings
                                              │
                                         booking_documents
```

---

## Tables

### `statuses`
Shared lifecycle-state lookup. Seeded once; not user-editable.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `smallint` | PK, identity |
| `name` | `text` | `active` (1), `suspended` (2), `pending_activation` (3) |

Used by: `profiles.status_id`, `academies.status_id`

---

### `portals`
Lookup of the three application portals. Seeded once; not user-editable.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `smallint` | PK, identity |
| `name` | `text` | `academy` (1), `learner` (2), `command` (3) |

---

### `roles`
Platform-wide and academy-scoped role types. Seeded once; not user-editable.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `smallint` | PK, identity |
| `name` | `text` | `root` (1), `admin` (2), `member` (3), `academy-admin` (4) |

`root` and `admin` are platform-wide (used in `user_roles`). `member` is used in `user_roles` for standard portal users. `academy-admin` is used exclusively in `academy_members` — it is scoped to a specific academy.

---

### `profiles`
One-to-one extension of `auth.users`. Created automatically on signup via the `handle_new_user()` trigger.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK, FK → `auth.users` ON DELETE CASCADE |
| `full_name` | `text` | |
| `email` | `text` | Kept in sync with `auth.users.email` via trigger |
| `notes` | `text` | Internal notes (Command use) |
| `status_id` | `smallint` | FK → `statuses`. Default `3` (pending_activation) |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

> A user is only considered active when `status_id = 1`. All RLS policies for authenticated data access check `public.is_active()` first. Only Command admins may change `status_id`.

---

### `user_portals`
Junction table: which portals a user has access to. Without a row here, a user cannot log in to that portal.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `uuid` | FK → `profiles` ON DELETE CASCADE |
| `portal_id` | `smallint` | FK → `portals` ON DELETE CASCADE |
| `granted_at` | `timestamptz` | |

PK: `(user_id, portal_id)`

---

### `user_roles`
Platform-wide role assignments. For academy-scoped roles, see `academy_members`.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `uuid` | FK → `profiles` ON DELETE CASCADE |
| `role_id` | `smallint` | FK → `roles` ON DELETE CASCADE |
| `granted_at` | `timestamptz` | |

PK: `(user_id, role_id)`

---

### `academies`
LTO-accredited driving schools. The central entity in the platform.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `name` | `text` | School display name |
| `lto_accred_no` | `text` | LTO accreditation number |
| `year_established` | `smallint` | Optional |
| `address` | `text` | Full street address |
| `phone` | `text` | |
| `email` | `text` | |
| `operating_hours` | `text` | Free-text, e.g. "Mon–Sat 8AM–5PM" |
| `branch` | `text` | Optional display label for a single campus, e.g. `"Main Branch"`. `NULL` means no branch distinction. |
| `region` | `text NOT NULL DEFAULT ''` | Geographic coverage area. Entered by Command admins; not collected during self-registration. |
| `branches` | `smallint NOT NULL DEFAULT 1` | Count of branches. Managed by Command portal only; defaults to `1` for self-registered academies. |
| `status_id` | `smallint` | FK → `statuses`. Default `3` (pending_activation) |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

> Academies default to `pending_activation`. Command admins activate them after verifying the LTO accreditation number. Only active academies are visible in the learner booking flow.

#### Two write paths to `academies`

Two independent forms insert into this table:

| Writer | Location | Fields written |
|--------|----------|----------------|
| Academy self-registration | `academy/app/api/auth/register/route.ts` | `name`, `lto_accred_no`, `year_established`, `address`, `phone`, `email`, `operating_hours` |
| Command admin SchoolFormModal | `command/components/schools/SchoolFormModal` | `name`, `lto_accred_no`, `region`, `branches`, `phone`, `email` |

`region` and `branches` are not collected during self-registration — they default to `''` and `1`. They can be set or updated by Command admins at any time without affecting the academy portal.

#### `branch` vs `branches` — important distinction

| Column | Type | Purpose |
|--------|------|---------|
| `branch` (singular) | `text` nullable | A display label for the campus, e.g. `"Davao Branch"`. Set per-record. Not surfaced in the Command form. |
| `branches` (plural) | `smallint NOT NULL DEFAULT 1` | A count of how many branches the academy has. Set via the Command admin form. |

If per-branch registration (individual branches each with their own name, address, and schedule) is ever needed, the right model is a dedicated `academy_branches` table — not repurposing either of these columns.

**Future fields to consider:** `lat`, `lng` (geographic coordinates for map markers), `logo_path` (Supabase Storage path for school logo), `website`.

---

### `academy_members`
Junction table: user membership in a specific academy with a per-academy role.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `uuid` | FK → `profiles` ON DELETE CASCADE |
| `academy_id` | `uuid` | FK → `academies` ON DELETE CASCADE |
| `role_id` | `smallint` | FK → `roles`. Must be `member` (3) or `academy-admin` (4) |
| `granted_at` | `timestamptz` | |

PK: `(user_id, academy_id)` — one role per user per academy. A user can be a member of multiple academies (different `academy_id` rows).

---

### `offering_categories`
Lookup for offering types. Seeded once; not user-editable.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `smallint` | PK, identity |
| `name` | `text` | `exam` (1), `lesson` (2), `other` (3) |
| `label` | `text` | Display label: `Exam`, `Lesson`, `Other` |

---

### `offerings`
Bookable services defined by an academy. Each academy defines its own offerings independently.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `academy_id` | `uuid` | FK → `academies` ON DELETE CASCADE |
| `category_id` | `smallint` | FK → `offering_categories` ON DELETE RESTRICT |
| `name` | `text` | Display name, e.g. "Theoretical Driving Course" |
| `code` | `text` | Short badge, e.g. `TDC`. Max 6 chars, uppercase. Unique per academy |
| `description` | `text` | |
| `price` | `numeric(10,2)` | Philippine Peso. Non-negative |
| `duration` | `text` | Free-text, e.g. "4 hours" |
| `requirements` | `jsonb` | Array of `{id, label, required}` objects defining documents learners must upload. Default `[]` |
| `is_active` | `boolean` | Default `true`. Inactive offerings hidden from learners |
| `created_by` | `uuid` | FK → `profiles` ON DELETE SET NULL |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

Unique constraint: `(academy_id, code)` — a code is unique within an academy but the same code (e.g., TDC) can exist at multiple academies.

> **Note on `requirements`:** A JSONB array of `{id: string, label: string, required: boolean}` objects. Academy admins define these in the offering form; learners see them in Step 4 of the booking wizard and upload a file per item. The `id` is a stable UUID generated when the item is created — it is used as the key in the learner's upload record even if the label is later edited. Items with `required: true` block progression past Step 4 until uploaded; optional items can be skipped.

---

### `instructors`
Driving instructors associated with an academy.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `academy_id` | `uuid` | FK → `academies` ON DELETE CASCADE |
| `full_name` | `text` | |
| `email` | `text` | Optional |
| `phone` | `text` | Optional |
| `license_no` | `text` | Optional instructor license number |
| `specialties` | `text[]` | Array of offering codes they can teach |
| `is_active` | `boolean` | Default `true` |
| `created_by` | `uuid` | FK → `profiles` ON DELETE SET NULL |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

---

### `schedules`
Academy-defined availability slots for a specific offering. Stores a recurrence rule; individual occurrence dates are expanded at application time, not stored.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `academy_id` | `uuid` | FK → `academies` ON DELETE CASCADE |
| `offering_id` | `uuid` | FK → `offerings` ON DELETE RESTRICT |
| `instructor_id` | `uuid` | FK → `instructors` ON DELETE SET NULL. Nullable |
| `title` | `text` | Display label for this schedule slot |
| `start_date` | `date` | When this schedule (or series) starts |
| `start_time` | `time` | Session start time |
| `end_time` | `time` | Session end time. Must be after `start_time` |
| `days_of_week` | `smallint[]` | 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun. Empty for one-time |
| `recurrence` | `text` | `none` / `weekly` / `biweekly` / `monthly` |
| `max_capacity` | `integer` | Max learners per occurrence. Positive |
| `is_active` | `boolean` | Default `true` |
| `examiner_name` | `text` | Optional pre-assigned examiner for this slot |
| `examiner_phone` | `text` | Optional |
| `created_by` | `uuid` | FK → `profiles` ON DELETE SET NULL |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

**Recurrence model:** `none` means a single occurrence on `start_date`. For recurring schedules, `days_of_week` specifies which days of the week the schedule runs, and `recurrence` controls the frequency (every week, every two weeks, or once a month on the same week-of-month as `start_date`). Occurrence expansion is done client-side.

**Integrity:** A cross-academy trigger ensures `offering.academy_id` and `instructor.academy_id` both match `schedule.academy_id`, preventing data mixing between academies.

**Future:** `bookings_count` denormalised column (or a view) to efficiently check capacity; `cancelled_at` for soft-cancellation of a series.

---

### `bookings`
A learner's reservation of a specific schedule occurrence.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `learner_id` | `uuid` | FK → `profiles` ON DELETE RESTRICT |
| `schedule_id` | `uuid` | FK → `schedules` ON DELETE RESTRICT |
| `academy_id` | `uuid` | Denormalised from schedule. FK → `academies` ON DELETE RESTRICT |
| `offering_id` | `uuid` | Denormalised from schedule. FK → `offerings` ON DELETE RESTRICT |
| `booked_date` | `date` | The specific occurrence date selected. App layer validates against recurrence rule |
| `status` | `text` | `pending` / `confirmed` / `completed` / `cancelled` / `refunded`. CHECK constraint enforces allowed values; a BEFORE UPDATE trigger enforces valid transitions |
| `price_paid` | `numeric(10,2)` | Snapshot of offering price at booking time |
| `notes` | `text` | Optional learner/school notes |
| `rejection_reason` | `text NOT NULL DEFAULT ''` | Reason provided by academy when rejecting/cancelling. Empty string if not applicable |
| `cancelled_by` | `uuid` | FK → `profiles` ON DELETE SET NULL. Records which user performed the cancellation or rejection |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

`learner_id` and `schedule_id` use RESTRICT on delete — booking history must be preserved even if a user is deactivated or a schedule is retired.

`academy_id` and `offering_id` are denormalised for efficient RLS filtering. A trigger (`check_booking_consistency`) validates they match the referenced schedule on every insert/update.

**Unique constraint:** `(learner_id, schedule_id, booked_date)` — a learner cannot book the same schedule occurrence twice. Error code `23505` is caught in the learner service and surfaced as `"already_booked"`.

**Capacity trigger:** `check_booking_capacity()` fires BEFORE INSERT and counts existing `pending + confirmed` rows for the same `(schedule_id, booked_date)` against `schedules.max_capacity`. Raises an exception if at capacity.

**Status transition trigger:** `validate_booking_status_transition()` fires BEFORE UPDATE. Allowed transitions: `pending → confirmed|cancelled`, `confirmed → completed|cancelled`, `completed → refunded`. All other transitions raise an exception.

**Audit trigger:** `log_booking_status_change()` fires AFTER UPDATE and writes a row to `booking_status_log` whenever `status` changes.

**Future:** `start_time` snapshot (so if a schedule's time changes, the booking still shows the original time), payment reference ID, rating/review join.

---

### `booking_documents`
Files uploaded by the learner at booking time.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | FK → `bookings` ON DELETE CASCADE |
| `label` | `text` | Document name, e.g. "Valid Government ID" |
| `storage_path` | `text` | Supabase Storage object path |
| `is_required` | `boolean` | Whether this document was required at booking time |
| `uploaded_at` | `timestamptz` | |

Write-once semantics — to replace a document, delete + insert. Only learners may insert documents for their own bookings, and only while the booking is `pending`.

> **Current state:** Document uploads in the learner portal are in-memory only (file metadata stored in React state). Supabase Storage integration and `booking_documents` writes are a planned follow-up task.

---

### `booking_status_log`
Immutable audit trail of every booking status change. Written only by the `log_booking_status_change()` AFTER UPDATE trigger — never by application code directly. No INSERT RLS policy exists for authenticated users.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | FK → `bookings` ON DELETE CASCADE |
| `changed_by` | `uuid` | FK → `profiles` ON DELETE SET NULL. The user whose session triggered the change (via `auth.uid()`) |
| `from_status` | `text` | The status before the update |
| `to_status` | `text` | The status after the update |
| `notes` | `text NOT NULL DEFAULT ''` | Reserved for manual notes; empty in all trigger-written rows |
| `changed_at` | `timestamptz` | Default `now()` |

**RLS:**
- Learners can SELECT rows for their own bookings (`learner_id = auth.uid()`)
- Academy admins can SELECT rows for bookings at their academy
- Command admins/root can SELECT all rows
- No INSERT/UPDATE/DELETE policies for app users — trigger-only writes (executed as service role via `SECURITY DEFINER`)

---

## Delete Behaviour Summary

| Relationship | On Delete |
|-------------|-----------|
| `auth.users` → `profiles` | CASCADE |
| `profiles` → `user_portals`, `user_roles`, `academy_members` | CASCADE |
| `academies` → `offerings`, `instructors`, `schedules` | CASCADE |
| `academies` → `bookings` | RESTRICT |
| `offerings` → `schedules` | RESTRICT |
| `schedules` → `bookings` | RESTRICT |
| `bookings` → `booking_documents` | CASCADE |
| `bookings` → `booking_status_log` | CASCADE |
| Instructor → schedules | SET NULL |
| Profile → offerings, schedules, instructors | SET NULL (created_by) |

RESTRICT is used on relationships where deletion would leave orphaned financial or booking records. SET NULL preserves the record when its creator is removed.

---

## RLS Philosophy

See `auth-roles.md` for the full access control model. Schema-level summary:

- RLS is enabled on every table without exception.
- All RLS policies call one or more of the helper functions (`is_active()`, `is_portal_member()`, `has_role()`, `has_academy_role()`) defined in `20260504000002_schema.sql`. These helpers are `SECURITY DEFINER` to avoid recursion.
- Policies follow the principle of least privilege: read access is only granted to the specific roles that need it, not to `authenticated` broadly (with narrow exceptions for lookup tables and the learner-readable academies policy).

---

## Future Schema Additions

The following tables are anticipated but not yet created. They should follow the same migration and RLS conventions.

| Table | Purpose | Notes |
|-------|---------|-------|
| `wallet_accounts` | Learner wallet balance | One row per learner profile |
| `wallet_transactions` | Credits, debits, booking payments | Immutable ledger rows |
| `notifications` | In-app alerts for learners and academy admins | Status changes, booking confirmations |
| `reviews` | Learner reviews of academies post-booking | One review per completed booking |
| `academy_photos` | Gallery images for academy profiles | Supabase Storage paths |

> When adding these, consider whether they need to be visible across portals and design RLS accordingly before writing the migration.
