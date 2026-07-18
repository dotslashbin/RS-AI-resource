# Authentication and Access Control

## Model Summary

Access in this platform has three independent layers, all enforced at the database level:

1. **Active status** — Is this user account active? (`profiles.status_id = 1`)
2. **Portal membership** — Does this user have access to this portal? (row in `user_portals`)
3. **Role** — What can this user do within that portal? (`user_roles` or `vendor_members`)

A user can be active and have portal access but no elevated role — that is the default state for bookers and vendor members. Elevated roles (`admin`, `root`, `vendor-admin`) must be explicitly granted.

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

### Password recovery

Password recovery is implemented end-to-end in all three portals. The flow:

1. From the login screen the user requests a reset; the portal calls `resetPassword(email, redirectTo)` (in `auth.service.ts`), passing the app origin as `redirectTo` so the recovery link returns to the app.
2. The browser client (`lib/supabase/client.ts`) uses `flowType: "implicit"` — the recovery link returns the token in the URL hash rather than a PKCE `?code=` needing a same-origin `code_verifier`, which suits these client-rendered SPAs.
3. Recovery is detected via a module-load `PASSWORD_RECOVERY` listener exposed as `isRecoveryDetected()`. `useAppShell` reads it and sets a `recoveryMode`; `AppShell` then renders `LoginPage` in a `"reset"` view (set-new-password form).
4. **The portal access gate is skipped during recovery.** The normal mount check (`verify*Access` → `signOut()` for users lacking that portal) would otherwise destroy the recovery session before the password is updated. During recovery the gate early-returns so the recovery session survives until `updatePassword(newPassword)` succeeds; portal access is still enforced at the next login.

Recovery (auth) emails are separate from notification emails — they are sent by Supabase Auth (GoTrue), delivered via Resend SMTP when hosted and via Supabase's local mailer (Mailpit) in local dev. They do **not** go through the `send-notification-email` Edge Function.

---

## User Lifecycle

There are two onboarding paths depending on the portal:

### Vendor self-registration path (KYC-gated)

Vendor onboarding is a **required KYC stage** — see `vendor-kyc.md` for the full
subsystem. The key access-control property: **no auth user or vendor record is
created until the entire KYC flow is submitted** (D-7 = D). The multi-step form
fields live in browser `localStorage` and the documents are held in memory; only
the final submit creates anything. Abandoning KYC leaves nothing behind.

The final submit calls the server-side Route Handler `POST /api/auth/register`
(multipart: fields + applicant type + document files). Using the service-role
admin client, it **atomically** (rolling back on any failure):

1. Create a confirmed Supabase Auth user (bypasses email verification)
2. Immediately set the user's profile to `status_id = active`
3. Grant `vendor` portal access (`user_portals` row)
4. Create the vendor record with `status_id = pending_activation`
5. Link the user as `vendor-admin` in `vendor_members`
6. Create the `vendor_kyc` header (`status = submitted`) + upload the files to the
   `vendor-kyc` bucket + insert a `vendor_kyc_documents` row per file
7. Notify Command (`vendor_pending_approval` + `new_user_registration`)

**Result:** The user is immediately active and can log in, but until Command
approves and activates the vendor they see the KYC status surface
(`KycStatusPage`: under review / approved-awaiting-activation / rejected → revise
& resubmit), not the app. The *vendor itself* stays `pending_activation` and will
not appear to bookers until activated. KYC approval is currently **advisory** — a
Command admin flips the vendor active at their discretion (a hard gate is
deferred; see `vendor-kyc.md`).

```
Multi-step registration + KYC (form in localStorage; no account yet)
    │  (applicant type → documents → ID + selfie → review)
    ▼
POST /api/auth/register (service role — atomic, rollback on failure)
    │
    ├─ auth.users row created (confirmed)
    ├─ profiles row: status = active
    ├─ user_portals row: vendor portal
    ├─ vendors row: status = pending_activation
    ├─ vendor_members row: vendor-admin
    ├─ vendor_kyc header: status = submitted
    └─ vendor_kyc_documents + files in vendor-kyc bucket
    │
    ▼
User logs in → KYC status surface until Command approves + activates the vendor
```

### Booker self-registration path

The booker portal has a registration form that calls the server-side Route Handler `POST /api/register`. This handler uses the service-role client (inlined in the route rather than via a shared `lib/supabase/admin.ts`) to:

1. Create a confirmed Supabase Auth user (bypasses email verification)
2. Immediately set the user's profile to `status_id = active` and store their phone number
3. Grant `booker` portal access (`user_portals` row)
4. Assign the `member` role (`user_roles` row)
5. Roll back on any failure — if a step fails, the just-created auth user is removed via `admin.deleteUser` so no partial account is left behind
6. Notify Command — fires a `new_user_registration` notification to command admins (best-effort; failure never blocks the registration response)

**Result:** The user is immediately active and can log in to the Booker Portal. No Command admin intervention is required.

```
Booker registration form
    │
    ▼
POST /api/register (service role — bypasses RLS)
    │
    ├─ auth.users row created (confirmed)
    ├─ profiles row: status = active, phone stored
    ├─ user_portals row: booker portal
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
Vendor admin grants vendor membership (vendor_members row)
```

### App-level access verification

Each portal has a service function that re-checks access from the client side on session restore:

- `booker.service.ts` → `verifyBookerAccess()`: checks `status = active` + `user_portals` (booker) + `user_roles` (member). Returns `{ allowed, reason }` where reason can be `"no_access"`, `"suspended"`, or `"pending"`.
- `command.service.ts` → `verifyCommandAccess()`: checks active + command portal + admin or root role.

These are in addition to RLS — they drive the login gate UI (showing appropriate error states). They do not replace RLS.

---

## Portals

Portals are rows in the `portals` table (seeded, not user-editable):

| ID | Name | Portal |
|----|------|--------|
| 1 | `vendor` | Vendor Portal (`./vendor`) |
| 2 | `booker` | Bookdeck Booker (`./booker`) |
| 3 | `command` | Bookdeck Command (`./command`) |

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
| 4 | `vendor-admin` | Per-vendor | `vendor_members` |

**Platform-wide roles** (`user_roles`): Apply across the entire system. `root` is a superuser that can delete bookings and perform other destructive operations. `admin` can manage users and vendors. `member` is the standard role — all bookers and basic vendor staff hold this role.

**Vendor-scoped roles** (`vendor_members`): `vendor-admin` grants administrative access to a specific vendor's data. A user can be `vendor-admin` of multiple vendors (one `vendor_members` row per vendor). The `vendor_members.role_id` is constrained to `member` (3) or `vendor-admin` (4) — platform roles belong in `user_roles`.

---

## RLS Helper Functions

All RLS policies use these `SECURITY DEFINER` functions defined in `20260504000002_schema.sql`. They are `SECURITY DEFINER` to avoid recursion (RLS on `profiles` would otherwise trigger when checking `profiles` inside a policy).

### `public.is_active() → boolean`
Returns `true` if the calling user's profile has the `active` status.  
Used in nearly every RLS policy as the first gate.

```sql
create function public.is_active()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.statuses s on s.id = p.status_id
    where p.id = auth.uid() and s.name = 'active'
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

### `public.is_vendor_member(p_vendor_id uuid) → boolean`
Returns `true` if the calling user has any membership row in `vendor_members` for the given vendor.

### `public.has_vendor_role(p_vendor_id uuid, p_role_name text) → boolean`
Returns `true` if the calling user has a specific role at a specific vendor.

```sql
create function public.has_vendor_role(p_vendor_id uuid, p_role_name text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.vendor_members am
    join public.roles r on r.id = am.role_id
    where am.user_id = auth.uid()
      and am.vendor_id = has_vendor_role.p_vendor_id
      and r.name = has_vendor_role.p_role_name
  )
$$;
```

---

## Table Grants (privilege layer beneath RLS)

RLS is the *row* filter, but it only runs **after** PostgREST passes the table-level privilege check. The `public`-schema defaults grant the API roles no DML, so every table needs explicit `GRANT`s (see `20260620000001_api_role_grants.sql`):

- **`anon`** — no table privileges (no policy targets anon; unauthenticated requests read nothing).
- **`authenticated`** — only the operations each table's RLS policies permit (never `TRUNCATE`); RLS then narrows to the allowed rows.
- **`service_role`** — full DML (trusted server-side role; bypasses RLS).

A table with RLS but no grant returns `permission denied` for logged-in users — so **every new table migration must add its grants**.

## RLS Policy Patterns

### Booker data access pattern
```sql
-- Bookers can only read their own data
using (booker_id = auth.uid() and public.is_active())
```

### Vendor admin data access pattern
```sql
-- Vendor admins can read all data for their vendor
using (public.is_active() and public.has_vendor_role(vendor_id, 'vendor-admin'))
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
-- Lookup tables (statuses, portals, roles) are readable by all authenticated users
using (true)
```

### Booker browsing pattern (vendors, schedules)
```sql
-- Active bookers can read active records from any vendor
-- (no vendor membership required — this is public catalogue data)
using (public.is_active() and <record>.is_active = true)
```

---

## What Each Portal Can See

| Table | Booker | Vendor Admin | Command Admin |
|-------|---------|---------------|---------------|
| `profiles` | Own row | Own row | All rows |
| `vendors` | Active only | Own vendor | All |
| `offerings` | Active only | Own vendor | All |
| `schedules` | Active only | Own vendor (all statuses) | All |
| `staff` | Active only | Own vendor | All |
| `bookings` | Own bookings | Own vendor bookings | All |
| `booking_documents` | Own | Own vendor's | All |
| `vendor_kyc` | — | Own (read + resubmit) | All (read + review) |
| `vendor_kyc_documents` | — | Own (add/remove while `rejected`) | All (read) |
| `kyc_document_types` | All (guidance) | All (guidance) | All (+ manage) |

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
- The service-role client (`lib/supabase/admin.ts` in the vendor portal) is used exclusively in server-side Route Handlers (e.g., the registration endpoint). It must never be imported in client components.
- The `anon` key (used when no user is logged in) should only be able to read truly public data. Currently, all meaningful data requires an authenticated session.
- Session handling is client-side: these are implicit-flow SPAs with no `middleware.ts`, so the Supabase browser client persists and refreshes the session in the browser (the `useAppShell` hooks drive auth gating and token refresh on the client). `@supabase/ssr` server clients are used only for server-side reads (e.g. in Route Handlers), not for middleware-based cookie refresh. Do not implement custom session management.
- `prevent_status_self_update()` is a DB trigger that blocks any non-admin from changing their own `status_id` via a direct update, even if they have an authenticated session.

---

## Future Considerations

- **Self-service registration:** Implemented for bookers (immediate activation) and vendor operators (vendor pending activation). Command portal users still require manual creation by a Command admin.
- **SSO / OAuth:** Supabase Auth supports OAuth providers (Google, Facebook). If added, the `handle_new_user` trigger still fires and the portal-granting flow remains unchanged.
- **Vendor-level roles beyond admin:** If vendors need staff-level portal access (view their own schedule, check in bookers), a new role `vendor-staff` can be added to `roles` and `vendor_members`, with targeted RLS policies.
- **Role expiry:** `user_portals.granted_at` and `vendor_members.granted_at` record when access was granted but there is no expiry mechanism. Adding a `revoked_at` column and incorporating it into RLS policies would support time-limited access.
