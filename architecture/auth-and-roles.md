# Authentication and Access Control

## Model Summary

Access in this platform has three independent layers, all enforced at the database level:

1. **Active status** — Is this user account active? (`profiles.status_id = 1`)
2. **Portal membership** — Does this user have access to this portal? (row in `user_portals`)
3. **Role** — What can this user do within that portal? (`user_roles` or `academy_members`)

A user can be active and have portal access but no elevated role — that is the default state for learners and academy members. Elevated roles (`admin`, `root`, `academy-admin`) must be explicitly granted.

---

## Authentication

**Supabase Auth is the only authentication mechanism.** Custom auth must never be implemented.

On signup, Supabase Auth creates a row in `auth.users`. A database trigger (`handle_new_user`) immediately creates a matching row in `public.profiles`:

```sql
-- Fires on INSERT to auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

The `profiles` row copies `id`, `full_name` (from `raw_user_meta_data`), and `email`. It sets `status_id = 3` (pending_activation) by default — newly registered users cannot access any live data until a Command admin activates them.

A second trigger (`handle_user_email_update`) keeps `profiles.email` in sync if the user changes their email address in Supabase Auth.

---

## User Lifecycle

There are two onboarding paths depending on the portal:

### Academy self-registration path

The academy portal has a registration form that calls the server-side Route Handler `POST /api/auth/register`. This handler uses the service-role admin client to:

1. Create a confirmed Supabase Auth user (bypasses email verification)
2. Immediately set the user's profile to `status_id = active`
3. Grant `academy` portal access (`user_portals` row)
4. Create the academy record with `status_id = pending_activation`
5. Link the user as `academy-admin` in `academy_members`

**Result:** The user is immediately active and can log in to the School Portal. The *academy itself* remains `pending_activation` until a Command admin reviews and approves it. Until the academy is activated, the school admin can log in but their academy will not appear to learners in the booking flow.

```
Academy self-registration form
    │
    ▼
POST /api/auth/register (service role — bypasses RLS)
    │
    ├─ auth.users row created (confirmed)
    ├─ profiles row: status = active
    ├─ user_portals row: academy portal
    ├─ academies row: status = pending_activation
    └─ academy_members row: academy-admin
    │
    ▼
User can log in immediately
Academy awaits Command admin approval
```

### Learner self-registration path

The learner portal has a registration form that calls the server-side Route Handler `POST /api/register`. This handler uses the service-role client to:

1. Create a confirmed Supabase Auth user (bypasses email verification)
2. Immediately set the user's profile to `status_id = active` and store their phone number
3. Grant `learner` portal access (`user_portals` row)
4. Assign the `member` role (`user_roles` row)

**Result:** The user is immediately active and can log in to the Learner Portal. No Command admin intervention is required.

```
Learner registration form
    │
    ▼
POST /api/register (service role — bypasses RLS)
    │
    ├─ auth.users row created (confirmed)
    ├─ profiles row: status = active, phone stored
    ├─ user_portals row: learner portal
    └─ user_roles row: member
    │
    ▼
User can log in immediately
```

### Manual (Command-admin) path

For Command portal users and any account that does not self-register through one of the portal registration forms:

```
User created by Command admin (via /api/users Route Handler)
    │
    ▼
profiles row: status = active (Command admin sets this explicitly)
    │
    ▼
Command admin grants portal access (user_portals row)
    │
    ▼
User can now log in
    │
    ▼ (optional — for elevated access)
Command admin assigns role (user_roles row)
    OR
Academy admin grants academy membership (academy_members row)
```

### App-level access verification

Each portal has a service function that re-checks access from the client side on session restore:

- `learner.service.ts` → `verifyLearnerAccess()`: checks `status = active` + `user_portals` (learner) + `user_roles` (member). Returns `{ allowed, reason }` where reason can be `"no_access"`, `"suspended"`, or `"pending"`.
- `command.service.ts` → `verifyCommandAccess()`: checks active + command portal + admin or root role.

These are in addition to RLS — they drive the login gate UI (showing appropriate error states). They do not replace RLS.

---

## Portals

Portals are rows in the `portals` table (seeded, not user-editable):

| ID | Name | Portal |
|----|------|--------|
| 1 | `academy` | School Portal (`./academy`) |
| 2 | `learner` | RS Learner (`./learner`) |
| 3 | `command` | RS Command (`./command`) |

Access to a portal is determined by the presence of a `user_portals` row for `(user_id, portal_id)`. A user can have access to multiple portals — their `profiles` row is shared across all of them.

The portals table is the gate. Having an active Supabase Auth session does not grant access to any data — the user must also have a portal row and an active status.

---

## Roles

Roles are rows in the `roles` table (seeded, not user-editable):

| ID | Name | Scope | Where assigned |
|----|------|-------|----------------|
| 1 | `root` | Platform-wide | `user_roles` |
| 2 | `admin` | Platform-wide | `user_roles` |
| 3 | `member` | Platform-wide | `user_roles` |
| 4 | `academy-admin` | Per-academy | `academy_members` |

**Platform-wide roles** (`user_roles`): Apply across the entire system. `root` is a superuser that can delete bookings and perform other destructive operations. `admin` can manage users and academies. `member` is the standard role — all learners and basic academy staff hold this role.

**Academy-scoped roles** (`academy_members`): `academy-admin` grants administrative access to a specific academy's data. A user can be `academy-admin` of multiple academies (one `academy_members` row per academy). The `academy_members.role_id` is constrained to `member` (3) or `academy-admin` (4) — platform roles belong in `user_roles`.

---

## RLS Helper Functions

All RLS policies use these `SECURITY DEFINER` functions defined in `20260504000002_schema.sql`. They are `SECURITY DEFINER` to avoid recursion (RLS on `profiles` would otherwise trigger when checking `profiles` inside a policy).

### `public.is_active() → boolean`
Returns `true` if the calling user's profile has `status_id = 1` (active).  
Used in nearly every RLS policy as the first gate.

```sql
create function public.is_active()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status_id = 1
  )
$$;
```

### `public.is_portal_member(portal_name text) → boolean`
Returns `true` if the calling user has a row in `user_portals` for the named portal (regardless of active status — `is_active()` should be called separately if needed).

```sql
create function public.is_portal_member(portal_name text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.user_portals up
    join public.portals p on p.id = up.portal_id
    where up.user_id = auth.uid() and p.name = portal_name
  )
$$;
```

### `public.has_role(role_name text) → boolean`
Returns `true` if the calling user has a platform-wide role assignment in `user_roles` for the named role.

```sql
create function public.has_role(role_name text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = role_name
  )
$$;
```

### `public.is_academy_member(academy_id uuid) → boolean`
Returns `true` if the calling user has any membership row in `academy_members` for the given academy.

### `public.has_academy_role(academy_id uuid, role_name text) → boolean`
Returns `true` if the calling user has a specific role at a specific academy.

```sql
create function public.has_academy_role(academy_id uuid, role_name text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.academy_members am
    join public.roles r on r.id = am.role_id
    where am.user_id = auth.uid()
      and am.academy_id = has_academy_role.academy_id
      and r.name = role_name
  )
$$;
```

---

## RLS Policy Patterns

### Learner data access pattern
```sql
-- Learners can only read their own data
using (learner_id = auth.uid() and public.is_active())
```

### Academy admin data access pattern
```sql
-- Academy admins can read all data for their academy
using (public.is_active() and public.has_academy_role(academy_id, 'academy-admin'))
```

### Command admin pattern
```sql
-- Command admins (admin or root) can read all data platform-wide
using (
  public.is_portal_member('command')
  and (public.has_role('admin') or public.has_role('root'))
)
```

### Public lookup table pattern
```sql
-- Lookup tables (statuses, portals, roles, offering_categories) are readable by all authenticated users
using (true)
```

### Learner browsing pattern (academies, schedules)
```sql
-- Active learners can read active records from any academy
-- (no academy membership required — this is public catalogue data)
using (public.is_active() and <record>.is_active = true)
```

---

## What Each Portal Can See

| Table | Learner | Academy Admin | Command Admin |
|-------|---------|---------------|---------------|
| `profiles` | Own row | Own row | All rows |
| `academies` | Active only | Own academy | All |
| `offerings` | Active only | Own academy | All |
| `schedules` | Active only | Own academy (all statuses) | All |
| `instructors` | — | Own academy | All |
| `bookings` | Own bookings | Own academy bookings | All |
| `booking_documents` | Own | Own academy's | All |

---

## Adding a New Portal or Role

If a new portal or role is ever needed:

1. Add a row to `portals` or `roles` via a new migration (these are seed tables — never mutate them directly)
2. Write RLS policies for any tables the new portal needs to access
3. Update the helper functions or add new ones if the access pattern doesn't fit existing helpers
4. Create a new Next.js app in the workspace root following the same conventions as the existing portals

---

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS. It must never appear in client-side code, `.env.local` committed to version control, or any `NEXT_PUBLIC_` variable.
- The service-role client (`lib/supabase/admin.ts` in the academy portal) is used exclusively in server-side Route Handlers (e.g., the registration endpoint). It must never be imported in client components.
- The `anon` key (used when no user is logged in) should only be able to read truly public data. Currently, all meaningful data requires an authenticated session.
- Session tokens are managed by `@supabase/ssr` — cookies are set server-side and refreshed automatically. Do not implement custom session management.
- `prevent_status_self_update()` is a DB trigger that blocks any non-admin from changing their own `status_id` via a direct update, even if they have an authenticated session.

---

## Future Considerations

- **Self-service registration:** Implemented for learners (immediate activation) and academy operators (academy pending activation). Command portal users still require manual creation by a Command admin.
- **SSO / OAuth:** Supabase Auth supports OAuth providers (Google, Facebook). If added, the `handle_new_user` trigger still fires and the portal-granting flow remains unchanged.
- **Academy-level roles beyond admin:** If schools need instructor-level portal access (view their own schedule, check in learners), a new role `academy-instructor` can be added to `roles` and `academy_members`, with targeted RLS policies.
- **Role expiry:** `user_portals.granted_at` and `academy_members.granted_at` record when access was granted but there is no expiry mechanism. Adding a `revoked_at` column and incorporating it into RLS policies would support time-limited access.
