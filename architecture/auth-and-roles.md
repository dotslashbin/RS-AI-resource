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
2. **The browser client is PKCE, not implicit — despite what `lib/supabase/client.ts` appears to say.** It passes `flowType: "implicit"`, and `@supabase/ssr`'s `createBrowserClient` **discards it**: the option is set *after* the caller's `auth` options are spread (`createBrowserClient.js` — `...options?.auth` then `flowType: "pkce"`). This file used to claim the opposite, and that false claim cost several production failures in August 2026. See "Two link shapes" below — the distinction is load-bearing.
3. Recovery is detected via a module-load `PASSWORD_RECOVERY` listener exposed as `isRecoveryDetected()`. `useAppShell` waits for `recoverySessionReady()` and then sets `recoveryMode`; `AppShell` renders `LoginPage` in a `"reset"` view (set-new-password form) — **keyed**, so switching views remounts it.
4. **The portal access gate is skipped during recovery.** The normal mount check (`verify*Access` → `signOut()` for users lacking that portal) would otherwise destroy the recovery session before the password is updated. During recovery the gate early-returns so the recovery session survives until `updatePassword(newPassword)` succeeds; portal access is still enforced at the next login.
5. The user leaves the reset view by setting a password, or via **"Back to Sign In"** (`handleCancelReset`), which clears the latch below, signs out and reloads to a clean origin.

Recovery (auth) emails are separate from notification emails — they are sent by Supabase Auth (GoTrue), delivered via Resend SMTP when hosted and via Supabase's local mailer (Mailpit) in local dev. They do **not** go through the `send-notification-email` Edge Function.

> ⚠️ **Auth SMTP is per-project dashboard configuration and is in no migration, no
> `config.toml`, and no repo file** — `[auth.email.smtp]` is commented out and
> `config push` must never be run. A hosted project without it falls back to Supabase's
> built-in mailer, which delivers **only to project team members** and returns
> *"Error sending recovery email"* for anyone else. **Production has it configured
> (Resend, `no-reply@ezzy.ph`); staging did not**, which is why every auth email failed
> there on 2026-08-18 while production was fine. Configure it per project at
> Authentication → Emails → SMTP Settings. Note there is **no** non-prod override for auth
> email — `NOTIFICATION_EMAIL_OVERRIDE_TO` covers only the notification Edge Function — so
> once staging SMTP is on, staging password resets reach real inboxes. Use test addresses.

#### Two link shapes, and why only one of them used to work

**There are two kinds of recovery link, decided by whichever client *requested* it.**

| Requested by | Link shape | Consumed how |
|---|---|---|
| The **browser** (Forgot Password) | `?code=…`, **no fragment** | PKCE client stores a `code-verifier` locally, exchanges the code. Request and consumption are the same client, so it matches. |
| The **server** (Command creating a user) | `#access_token=…&type=recovery` | The admin client is plain `@supabase/supabase-js`, sends no `code_challenge`, so GoTrue emails an *implicit* link. |

`resetPasswordForEmail` only attaches a `code_challenge` when the requesting client is
PKCE (`auth-js` — `if (this.flowType === 'pkce')`). So when Command began mailing
set-password links from the server (2026-08-17), the browser received an **implicit**
link — and auth-js refused it outright:

```
GoTrueClient._getSessionFromURL
  case 'implicit':
    if (this.flowType === 'pkce') throw AuthPKCEGrantCodeExchangeError
```

No session was created, yet the set-password form still rendered (it was gated on a bare
string match for `type=recovery` in the fragment), so submitting produced
**`Auth session missing!`**.

**The fix, in all three portals** (`lib/supabase/client.ts`, kept byte-identical):
`readHashTokens()` pulls the pair out of the fragment and `client.auth.setSession()`
establishes the session auth-js declined to — `setSession` is flow-agnostic, so this works
under PKCE. A `?code=` link puts nothing in the fragment, so the path is **inert for
Forgot Password**. `recoverySessionReady()` exposes when that has settled; a rejected token
routes into the existing `authHashError` path (see below) rather than a second one.

**And one more, subtler failure it exposed** (`useAppShell` + `AppShell`): `LoginPage`
seeds its view from `initialView` via `useState` — **first mount only** — and both shell
branches render it at the same position, so React *updates* rather than remounts. Making
`recoveryMode` asynchronous meant the component mounted as `"login"` before the session
arrived, and the later `initialView="reset"` was silently ignored. Fixed by gating the
render on `recoveryResolving` until the fragment is consumed, **plus a `key` on every
`LoginPage` branch** so a view switch always remounts. The `key` also removes a
pre-existing race in the *PKCE* path, which had the same latent bug and only worked
because the code exchange usually beat the component mount.

> **Do not "simplify" any of this.** Every clause above is load-bearing and each one
> corresponds to a production failure: `.plans/2026-08-17-command-new-user-password-onboarding.md`
> B3 (the mismatch), B4 (dead form), B5 (the view latch), B6 (the vendor/booker review).

#### Two non-obvious things about the URL fragment

Both were production bugs on 2026-08-10. Both are easy to reintroduce by "simplifying" `lib/supabase/client.ts`, so the reasoning is recorded here.

**The fragment does not survive a refresh, and only when the token is *valid*.** `auth-js` clears it (`GoTrueClient.js` — `window.location.hash = ''`) on the line *after* `_getUser(access_token)` succeeds. An invalid token throws before that and leaves the fragment in place. So a good recovery link creates a session and erases the only evidence of *why* the session exists; on reload `isRecoveryDetected()` was false, `PASSWORD_RECOVERY` did not re-fire (it fires while processing a recovery URL, never when restoring a session from storage), and the app auto-logged the user straight in with **no password ever set**. That matters because Command creates every user without one (`command/app/api/users/route.ts`), making recovery their only onboarding path — and since 2026-08-17 Command *starts* that recovery itself on creation, so this is the path every new user actually walks (see "How a Command-created user gets a password" below).

> **Fix:** the flag is mirrored into `sessionStorage` under `rs.recovery`, so recovery mode survives a reload. `clearRecovery()` discharges it on a successful `updatePassword()` and on "Back to Sign In". `sessionStorage`, not `localStorage`, so an abandoned recovery dies with the tab instead of wedging a later visit. Storage access is `try`/`catch`-wrapped — privacy modes degrade to the old behaviour rather than throwing.
>
> Rejected alternative: reading `amr` from the JWT. GoTrue files recovery and magic-link under the same OTP method, and `amr` describes how the session *began* — it does not change once the password is set, so it would trap the user on the reset form forever.

**A rejected link carries `error=…` and NOT `type=recovery`.** Verified against live GoTrue:

```
#error=access_denied&error_code=otp_expired
&error_description=Email+link+is+invalid+or+has+expired
```

Nothing matched that shape, so every expired, reused or malformed link dropped the user on an ordinary login page with no banner, no toast and no console line — an invisible dead end.

> **Fix:** `lib/authHashError.ts` (present in all three portals) parses the fragment with `URLSearchParams` — `error_description` encodes spaces as `+`, which naive splitting mangles — maps `otp_expired` to actionable copy, and falls back to the provider's `error_description` verbatim so an unmapped code is still shown rather than swallowed. `client.ts` reads it at module load (same reason as the latch: `detectSessionInUrl` clears the hash before React mounts), rewrites the URL via `history.replaceState`, and exposes `getAuthUrlError()`, which seeds `loginError` in each `useLoginPage.ts`. Unit-tested in `vendor/lib/authHashError.test.ts`, including a regression that a **success** fragment is not misread as an error.

### Changing a password while signed in

Since 2026-08-10 every portal also exposes a self-service password change, so a user who skipped the recovery step is not dependent on another email:

| Portal | Where | Component |
|---|---|---|
| `command` | Settings → **Password** tab | `components/settings/SecuritySettingsPage/` |
| `vendor` | Settings → Password card | `components/settings/SecurityCard/` |
| `booker` | Settings → Password card | `components/settings/SecurityCard/` |

All three share the same hook logic (8-character minimum, mirroring the recovery form; mismatch warned only once the confirm field has content) and call the existing `updatePassword()` in `auth.service.ts`. In `command` that minimum is no longer a literal — it lives in `command/lib/password.ts` as `MIN_PASSWORD_LENGTH`, shared by the recovery form, this settings form and the root set-password route (2026-08-17).

Two deliberate choices:

- **No sign-out on success.** The recovery form signs out because there the session exists solely to set a password; here the user is mid-task and Supabase keeps the session valid across `updateUser({ password })`.
- **No current-password re-authentication.** Standard practice, skipped on purpose: every Command-created account has *no* password, so the prompt would lock out exactly the people the feature exists for. The session remains the auth boundary, consistent with the recovery form. Revisit if step-up auth is ever introduced.

### How a Command-created user gets a password

Command creates accounts with **no password** (`auth.admin.createUser` is called without one). Until 2026-08-17 it also sent nothing — the GoTrue admin *create* endpoint has no mail path — so the account existed and nobody was ever told. There are now three ways a password gets set, in the order you should reach for them. See `.plans/2026-08-17-command-new-user-password-onboarding.md`.

| # | Path | Who triggers it | When to use |
|---|---|---|---|
| 1 | **Automatic on creation** — the create route calls `resetPasswordForEmail` after the grant writes | anyone who can add a user | the default; nothing to do |
| 2 | **Send set-password link** — button in the user detail modal | root only | the mail was lost or expired, or the account predates 2026-08-17 |
| 3 | **Set password** — root types one directly (`auth.admin.updateUserById`) | root only | **the normal path for a new Command admin** (see below); also break-glass when the person cannot receive mail |

**Provisioning a Command admin: use path 3, not path 1.** Creating an `admin`/`root` user
or granting the `command` portal is already root-only (`command/app/api/users/route.ts`),
so whoever creates the account can set its password on the spot. That path touches no
email, no GoTrue link, no redirect and no URL fragment — it cannot fail the way a mailed
link can. Path 1 exists for **vendor and booker** users, who are not in the room and need
a self-service link. Two things that are **not** acceptable substitutes: a fixed default
password (identical on every account, and discoverable from the repo), and emailing the
password (permanent and plaintext, where a link would have expired).

Three things about this that are easy to get wrong:

- **It sends a `recovery` link, not an `invite` link.** All three portals latch recovery on the literal string `type=recovery` (`lib/supabase/client.ts`, byte-identical across command/vendor/booker), so reusing recovery means the receiving portal needs **no new code**. `inviteUserByEmail` emits `type=invite` and would require changing all three. This is why the receiving apps were untouched by that work.
- **The link must be aimed at the user's own portal**, resolved by `command/lib/portalOrigins.server.ts` from `PORTAL_URL_COMMAND` / `PORTAL_URL_VENDOR` / `PORTAL_URL_BOOKER` (server-only, per-environment), priority `command` > `vendor` > `booker`. Sending a vendor to Command would let them set a password and then be told they have no access.
  📌 **The values for every environment — production, staging and local — live in `command/README.md` → "Environment variables" → "The `PORTAL_URL_*` trio".** That table is the reference to check when setting these up; this document deliberately does not duplicate it.
- **An unset or blank variable means "do not send", and that is deliberate.** Production leaves `PORTAL_URL_BOOKER` blank because `booker.ezzy.ph` still points at the *staging* Supabase project (see `overview.md`), so a production-minted token cannot validate there. A blank value and a *malformed* value are reported differently on purpose — the first is an expected opt-out, the second is a deployment fault.

Path 3 sends no email by design; the operator passes the password on out of band. There is no "must change password" flag in GoTrue, so it is a genuine break-glass rather than a routine onboarding step.

---

## User Lifecycle

There are two onboarding paths depending on the portal:

### Vendor self-registration path (KYC-gated)

Vendor onboarding is a **required KYC stage** — see `vendor-kyc.md` for the full
subsystem. The key access-control property: **no auth user or vendor record is
created until the entire KYC flow is submitted** (D-7 = D). The multi-step form
fields live in browser `localStorage` and the documents are held in memory; only
the final submit creates anything. Abandoning KYC leaves nothing behind.

The final submit is **three hops, not one** (2026-08-08 — the packet used to post
as a single multipart body, and Vercel's 4.5 MB serverless request-body cap made
registration impossible in production):

1. `POST /api/auth/register/prepare` — validates every field and the file
   manifest, then mints one signed upload URL per file under a staging prefix
   `pending/{submissionId}/`. **Creates nothing.**
2. The browser uploads each file **directly to Storage** with those tokens,
   bypassing the Route Handler body limit entirely.
3. `POST /api/auth/register` — a few KB of JSON. Re-validates everything (it may
   not assume step 1 ran), then creates the records and **moves** the staged
   objects to `{vendorId}/…`.

> ⚠️ **Why the files cannot be uploaded straight to their final path.** The
> bucket's policies key on `(storage.foldername(name))[1]::uuid = vendor id`
> (`20260706000002`). At upload time the vendor row does not exist yet, so there
> is no legal path to sign — hence the staging prefix and the later move.

Using the service-role admin client, step 3 **atomically** (rolling back on any
failure):

1. Create a confirmed Supabase Auth user (bypasses email verification)
2. Immediately set the user's profile to `status_id = active`
3. Grant `vendor` portal access (`user_portals` row)
4. Create the vendor record with `status_id = pending_activation`
5. Link the user as `vendor-admin` in `vendor_members`
6. Create the `vendor_kyc` header (`status = submitted`) + **move** each staged
   object from `pending/{submissionId}/` to `{vendorId}/` + insert a
   `vendor_kyc_documents` row per file
7. Notify Command (`vendor_pending_approval` + `new_user_registration`) **and the
   vendor** (`vendor_registration_received` — a plain acknowledgement, no link)

> **What "atomic" does and does not cover now.** No auth user, vendor, KYC header
> or document row exists unless step 3 succeeds — unchanged. What *can* survive a
> failure is orphaned bytes under `pending/`, so rollback sweeps that prefix and
> the success path clears any file uploaded but never claimed. An abandoned
> `prepare` leaves the same litter and wants a periodic sweep of anything older
> than a day — **not yet built**.
>
> **Where the upload limits are actually enforced.** The browser uploads with a
> signed token, so the sizes it declared at `prepare` are unverified claims.
> Per-file size (10 MB) and MIME are enforced by the **bucket**
> (`20260706000002`), which a signed upload cannot bypass. The per-submission
> **total** has no bucket equivalent, so step 3 re-derives it from the real Storage
> listing before creating anything.

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
    │   (vendor / booker — the command portal is root-only)
    ▼
User can now log in
    │
    ▼ (optional — for elevated access)
Command admin assigns role (user_roles row)  — member only
    OR
Root assigns admin / root, or grants the command portal
    OR
Vendor admin grants vendor membership (vendor_members row)
```

### App-level access verification

Each portal has a service function that re-checks access from the client side on session restore:

- `booker.service.ts` → `verifyBookerAccess()`: checks `status = active` + `user_portals` (booker) + `user_roles` (member). Returns `{ allowed, reason }` where reason can be `"no_access"`, `"suspended"`, or `"pending"`.
- `command.service.ts` → `verifyCommandAccess()`: checks active + command portal + admin or root role. Also returns `isRoot`, which drives **UI gating only** — Command hides the `admin`/`root` role options, the `command` portal toggle, and the edit/suspend/delete actions on privileged rows from non-root callers. That is an affordance, not a boundary: the Users page writes to Supabase directly from the browser, so RLS and the `/api/users` route are what actually enforce the rules.

These are in addition to RLS — they drive the login gate UI (showing appropriate error states). They do not replace RLS.

---

## Portals

Portals are rows in the `portals` table (seeded, not user-editable):

| ID | Name | Portal |
|----|------|--------|
| 1 | `vendor` | Ezzy Vendor (`./vendor`) |
| 2 | `booker` | Ezzy Booker (`./booker`) |
| 3 | `command` | Ezzy Command (`./command`) |

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

**`admin` and `root` are not interchangeable for user management.** Since
`20260807000001_command_access_grant_root_only.sql`, granting or revoking
**Command access is root-only**. Concretely, a non-root `admin` cannot:

- assign the `admin` or `root` role to anyone, including themselves;
- grant or revoke the `command` portal on any user;
- edit, suspend, or delete a user who already holds `admin` or `root`.

An `admin` keeps full CRUD over `member`-level users and over anyone's `vendor`
and `booker` portals, and still reads every user (see the read/write split
below). Existing non-root admins keep their own Command access — the restriction
governs who may *grant* access, never who currently holds it.

Two consequences worth knowing:

- **Containing a compromised admin now requires root.** The restriction is
  symmetric, so one admin can no longer suspend or de-role another. This is
  deliberate — it also stops an attacker holding one admin account from locking
  out the others — but it makes a reachable root part of incident response.
- **There is no cap on the number of roots.** More than one `root` is supported
  and is the recommended break-glass; only an existing root can create another.

**The root account cannot be removed through the app.** Three guards cover it,
none of which is a dedicated "protect root" check: `DELETE /api/users` rejects
self-delete, it rejects a non-root caller deleting a privileged target, and RLS
blocks an admin from suspending or de-roling a root. A last-root count check was
considered and rejected as unreachable — if "never zero roots" is ever needed as
a hard invariant, it belongs in a DB trigger or partial index on `user_roles`,
which would also cover the service-role and dashboard paths a route check cannot
see.

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

### `public.is_privileged_user(p_user_id uuid) → boolean`
Returns `true` if the **given** user (not the caller) holds `admin` or `root` in `user_roles`. Added by `20260807000001_command_access_grant_root_only.sql`. Every other helper answers "what may the caller do?"; this one answers "how protected is the target?", which is what makes admin-manages-admin expressible in a policy.

```sql
create or replace function public.is_privileged_user(p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id and r.name in ('admin', 'root')
  )
$$;
```

`SECURITY DEFINER` is required, not stylistic: the `user_roles` policies call it while reading `user_roles`, and it would otherwise recurse.

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

### Privilege-tiered write pattern (`profiles`, `user_portals`, `user_roles`)
These three tables gate writes on the **target's** privilege as well as the
caller's. `profiles`, `user_portals` and `user_roles` are the only tables using
this shape:

```sql
-- Writes: root unrestricted; admin only on non-privileged targets
using (
  public.is_portal_member('command')
  and (
    public.has_role('root')
    or (public.has_role('admin') and not public.is_privileged_user(user_id))
  )
)
```

The `user_roles` insert/update `with check` adds a second, independent clause —
`role_id not in (select id from public.roles where name in ('admin','root'))` —
which is the actual escalation guard. It is evaluated on the literal row being
written and does not depend on whether `is_privileged_user()` can see that row
within the same statement. **Do not remove it as redundant.** The `user_portals`
policies likewise add `portal_id <> (select id from public.portals where name = 'command')`.

> ⚠️ **Reads and writes must be split.** `user_portals` and `user_roles`
> originally used a single `FOR ALL` policy, whose `USING` clause governs
> `SELECT` too. Narrowing it in place would have broken the Command Users page:
> portal chips disappear and `command/services/users.service.ts` falls back to
> `role: "member"`, displaying root and every admin as **Member**. Each table
> therefore has a broad `FOR SELECT` policy plus separate restricted
> `INSERT`/`UPDATE`/`DELETE` policies. Any future attempt to restrict writes on
> a `FOR ALL` table must split it the same way first.

### Where RLS is not enough: service-role routes
`command/app/api/users/route.ts` creates and deletes users with the
**service-role client, which bypasses every policy above**. The tiering is
therefore duplicated in the route: `verifyCaller()` reports whether the caller is
root, `POST` rejects a privileged role or the `command` portal from a non-root
caller, and `DELETE` rejects privileged targets. Without this, an admin could
create a `root` account on an email they control and password-reset into it.
**Any new service-role write path over these tables must re-implement the same
checks** — RLS will not do it for you.

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

- **Self-service registration:** Implemented for bookers (immediate activation) and vendor operators (vendor pending activation). Command portal users still require manual creation — **by root**, since the change above.
- **Production bootstrap:** `seed.sql` is local-only and must never run in production, and `db push` does not run seeds — so a hosted environment gets a working schema with no way to log in to Command. Use **`backbone/supabase/bootstrap/production-root.sql`**: create the auth user in the Dashboard with your chosen email and password (step 1), then run that file to set the profile active and grant the `command` portal + `root` role (step 2). It is idempotent, contains no credentials, and grants the command portal only. Because only root can mint privileged users, losing that account means no account can grant Command access again through the app — provision a reachable standby root (repeat both steps with a second email) or document a service-role break-glass. See also `.plans/2026-08-07-command-root-only-command-access.md` §5.
- **SSO / OAuth:** Supabase Auth supports OAuth providers (Google, Facebook). If added, the `handle_new_user` trigger still fires and the portal-granting flow remains unchanged.
- **Vendor-level roles beyond admin:** If vendors need staff-level portal access (view their own schedule, check in bookers), a new role `vendor-staff` can be added to `roles` and `vendor_members`, with targeted RLS policies.
- **Role expiry:** `user_portals.granted_at` and `vendor_members.granted_at` record when access was granted but there is no expiry mechanism. Adding a `revoked_at` column and incorporating it into RLS policies would support time-limited access.
