# Backbone Migration Review Notes

Date: 2026-05-12

Scope: static review of `backbone/supabase/migrations/*.sql`. No migrations were executed and no Supabase local reset was run.

## Summary

The migration set is broadly coherent and RLS is enabled on the application tables, but several policies and constraints leave important security and data-integrity checks to application code. Before learner booking, academy suspension, command administration, or document upload flows become production-critical, these should be addressed with new migrations rather than editing applied migration files.

## Findings To Revisit

### High: Suspended command admins still have DB-level admin access

Most command policies check:

- `public.is_portal_member('command')`
- `public.has_role('admin')` or `public.has_role('root')`

They generally do not also require `public.is_active()`. The app may sign suspended users out, but RLS should not rely on app-only enforcement.

Representative files:

- `backbone/supabase/migrations/20260504000003_rls.sql`
- `backbone/supabase/migrations/20260506000001_offerings.sql`
- `backbone/supabase/migrations/20260507000001_instructors.sql`
- `backbone/supabase/migrations/20260507000002_schedules.sql`
- `backbone/supabase/migrations/20260507000004_bookings.sql`
- `backbone/supabase/migrations/20260511000001_academy_approval.sql`

Likely fix: add a helper such as `public.is_command_admin()` / `public.is_command_root()` that includes active status, command portal membership, and role checks, then replace repeated policy expressions in a new migration.

### High: Suspended academies can remain learner-visible

Learner-facing read policies check active offerings, schedules, or instructors, plus the user's active profile status, but they do not check whether the owning academy itself is active.

Affected areas:

- Active offerings read policy
- Active schedules read policy
- Active instructors read policy

Likely fix: add an academy-status helper such as `public.is_academy_active(uuid)` and require it in learner-facing select policies and booking insert checks.

### High: Booking inserts trust client-supplied financial and availability data

`public.bookings` accepts `price_paid` from the client and only enforces `price_paid >= 0`. The insert policy only requires `learner_id = auth.uid()` and active user status.

Missing or app-only constraints include:

- learner must have learner portal access
- academy must be active
- schedule and offering must be active
- selected date must be a valid occurrence for the schedule recurrence
- capacity must not be exceeded
- duplicate booking prevention for the same learner/schedule/date
- price should be derived from the offering or a server-side RPC, not trusted from the browser

Representative file:

- `backbone/supabase/migrations/20260507000004_bookings.sql`

Likely fix: move booking creation behind an RPC or server-side route using service-role only where appropriate, or add stronger DB triggers/checks and RLS policies.

### High/Medium: Booking document Storage policies are missing

`booking_documents.storage_path` stores object paths and comments say access is controlled separately by Supabase Storage policies, but no migration creates a bucket or policies for `storage.objects`.

Representative file:

- `backbone/supabase/migrations/20260507000004_bookings.sql`

Likely fix: create the expected bucket and `storage.objects` RLS policies in a migration, keeping object paths tied to `booking_documents` and booking ownership.

### Medium: Lookup IDs are hard-coded

The schema and app rely on numeric lookup IDs that happen to match initial insert order:

- `profiles.status_id default 3`
- `academies.status_id default 3`
- `academy_members.role_id in (3, 4)`
- academy app `CATEGORY_IDS = { exam: 1, lesson: 2, other: 3 }`

This is brittle if lookup rows are reseeded, manually altered, or migrated differently.

Representative files:

- `backbone/supabase/migrations/20260504000002_schema.sql`
- `academy/services/offerings.service.ts`

Likely fix: prefer lookup by `name`, helper functions, stable enum types, or DB defaults/functions that resolve IDs by name.

### Medium/Low: `user_roles` does not enforce platform-role scope

Comments say `academy-admin` should only be used in `academy_members`, but `user_roles` can currently reference any `roles.id`, including `academy-admin`.

Representative file:

- `backbone/supabase/migrations/20260504000002_schema.sql`

Likely fix: add a constraint or trigger preventing `academy-admin` in `user_roles`, ideally without relying on hard-coded role IDs.

### Low: Schedule weekday arrays are not range-checked

`schedules.days_of_week` comments define `0=Mon` through `6=Sun`, but the constraint only requires a non-empty array for recurring schedules. Invalid values can be inserted.

Representative file:

- `backbone/supabase/migrations/20260507000002_schedules.sql`

Likely fix: add a check that all entries are between `0` and `6`, and consider preventing duplicates if the application expects set semantics.

## Follow-Up Checklist

- [ ] Decide whether to add shared RLS helper functions for command admin/root access.
- [ ] Add active academy checks to learner-facing data access.
- [ ] Design booking creation flow so price, capacity, active status, and recurrence validity are enforced server-side.
- [ ] Add Storage bucket and `storage.objects` policies for booking documents.
- [ ] Remove or isolate hard-coded lookup ID assumptions.
- [ ] Add role-scope enforcement for `user_roles`.
- [ ] Add `days_of_week` value validation.
- [ ] Run `supabase db reset` locally after follow-up migrations are written.
- [ ] Regenerate Supabase TypeScript types after schema changes.
