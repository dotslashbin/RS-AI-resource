# Code Conventions

Patterns established across all three portals. New code should follow these without deviation unless there is a documented reason.

---

## Project Structure

Each portal is a self-contained Next.js 15 App Router application. The root of each app looks like:

```
app/
  layout.tsx          Root layout — ThemeProvider, SessionProvider (if used)
  page.tsx            Single-page SPA shell (all routing is internal state)
  globals.css         shadcn CSS variables + Tailwind directives
components/
  layout/             AppShell, Sidebar, TopBar, TabBar
  <domain>/           Feature components grouped by domain
hooks/                Reusable hooks (e.g. useGeolocation)
lib/
  constants.ts        Seed data, style constants, static lookup arrays
  types.ts            All TypeScript types and interfaces for this app
  utils.ts            Pure utility functions (cn, fmt*, haversine)
  supabase/
    client.ts         Browser Supabase client (createBrowserClient)
    server.ts         Server Supabase client (createServerClient)
services/
  <domain>.service.ts One file per DB domain, async functions only
public/               Static assets
```

All three apps follow this same layout. There is no `src/` directory.

---

## No Shared Code Between Apps

The booker, vendor, and command portals do not share any code. They are independent applications — no shared npm package, no symlinks, no monorepo tooling.

When the same utility (e.g., `fmt24to12`, `cn`) is needed in two portals, it is copied intentionally. This is a deliberate tradeoff: coupling the apps through a shared package creates deployment dependencies and forces version coordination that is premature at this scale.

**When to revisit:** If the same bug appears in the same copied utility across multiple apps, or if a shared domain type (e.g., a `Booking` shape) needs to stay in sync, that is a signal to evaluate a shared package.

---

## Service Layer

Each DB domain has exactly one service file: `services/<domain>.service.ts`.

Rules:
- Service files contain only `async` functions (or pure synchronous helpers that operate on data already fetched)
- Functions return typed data or a safe fallback (empty array, `null`) — they do not throw
- Error handling pattern: `if (error || !data) return []` (or `return null`)
- No UI code, no React imports, no state mutations inside service files
- Services use the browser Supabase client (`@/lib/supabase/client`) — never the server client from a client component
- No raw SQL — all queries go through the Supabase JS client

**Example pattern:**

```ts
// services/offerings.service.ts
export async function getActiveOfferings(): Promise<DbOffering[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("offerings")
    .select("id, name, code, description, price, duration, requirements, category")
    .eq("is_active", true)
    .order("code")
  if (error || !data) return []
  return (data as unknown as DbRow[]).map(toOffering)
}
```

**Row mapping:** Define a private `interface DbRow` that matches the raw Supabase response shape. Map it to the clean app type via a private `function toX(row: DbRow): X`. Never pass raw DB row shapes to components.

---

## Hook-as-Controller Pattern

Complex components use a custom hook that owns all state, fetching, validation, and submission logic. The component itself is a thin render layer.

```
useBookingWizard.ts    ← owns: state, effects, canNext, confirmBooking, reset
BookingWizard.tsx      ← owns: JSX layout, wires props from hook to step components
Step3Schedule.tsx      ← owns: local UI details (calendar cells, click handling)
```

Rules for hooks:
- State lives in the hook, not in the component
- Fetch logic (useEffect + service call) lives in the hook
- Validation / derived state (`canNext`, `allDocsUploaded`) lives in the hook
- The hook returns only what the component needs — no raw `setX` unless the component genuinely needs direct state control
- Where possible, expose named handler functions (`handleSelectTime`, `handleUpload`) rather than raw setters

**When not to use a hook:** Simple stateless presentational components don't need a hook. A hook is warranted when: (a) there is async data fetching, (b) there are multiple interdependent state fields, or (c) the component's logic is complex enough that mixing it with JSX would make either hard to read.

---

## Supabase Client Usage

| Context | Client to use | File |
|---------|--------------|------|
| Client components (browser) | `createBrowserClient` from `@supabase/ssr` | `lib/supabase/client.ts` |
| Server components / Route Handlers | `createServerClient` from `@supabase/ssr` | `lib/supabase/server.ts` |
| Server Route Handlers requiring RLS bypass | `createAdminClient()` from `@supabase/supabase-js` | `lib/supabase/admin.ts` |

Never use `createClient` from `@supabase/supabase-js` directly in Next.js apps — it does not handle cookie-based sessions correctly with SSR. The one exception is `lib/supabase/admin.ts`, which explicitly opts out of session management (`autoRefreshToken: false, persistSession: false`) because it is server-only and uses the service role key.

The browser client is used in all service files because those services are called from client components (hooks). If a service is ever needed in a Server Component or Route Handler, create a separate server-side version that uses `lib/supabase/server.ts`.

**Never expose** `SUPABASE_SERVICE_ROLE_KEY` to client-side code. It must only appear in server-side code (Route Handlers, Server Actions) and must never be in a `NEXT_PUBLIC_` environment variable.

### Admin Client (`lib/supabase/admin.ts`)

Exists as a shared module in the **vendor portal**. The **booker portal** also has a server-side registration Route Handler that uses the service role key, but creates the admin client inline (no `admin.ts` module file). Prefer the module pattern (vendor style) for any new portal — it keeps service-role instantiation in one place and makes it easy to audit.

```ts
// lib/supabase/admin.ts — server-only, never import from client components
import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

### Route Handlers (`app/api/`)

Used when an operation must bypass RLS or use server-only secrets. Current examples:

- `vendor/app/api/auth/register/route.ts` — vendor self-registration (public, **KYC-gated**): a multipart submit (form fields + applicant type + document files) that atomically creates a confirmed user, activates their profile, grants portal access, creates the vendor (pending activation), assigns vendor-admin, creates the `vendor_kyc` header, uploads the files to the `vendor-kyc` bucket, and inserts the document rows — rolling back all of it (objects + vendor + user) on any failure. See `vendor-kyc.md`.
- `booker/app/api/register/route.ts` — booker self-registration (public): creates a confirmed user, sets profile to active, grants booker portal access, assigns the member role atomically.
- `command/app/api/users/route.ts` — admin user create/delete: **caller-gated** (see rule below) before any service-role action; DELETE also blocks self-deletion.
- `booker/app/api/payment/create-session/route.ts` — **caller-gated**; verifies the booking belongs to the caller and derives the amount from the DB (never the request body).

Rules:
- Import `createAdminClient()` from `lib/supabase/admin` — never the browser or SSR client
- **Verify the caller before any privileged action.** If a route acts *on behalf of an authenticated user* (anything except deliberately-public self-registration), authenticate the caller server-side with the SSR client (`lib/supabase/server.ts` → `auth.getUser()`), confirm the required status/role/ownership, and return `401`/`403` **before** touching the admin client. The service-role key bypasses RLS, so the route handler is the only place this check can live — RLS will not save you here.
- **Never trust amounts, ids, prices, or roles from the request body** for privileged operations — read them from the DB using the verified caller's identity.
- Public self-registration routes are the exception to caller-verification, but still validate/trim all input before writes.
- Validate all input fields before any DB writes
- Roll back (delete user / vendor) on any step failure to avoid partial state
- Return `NextResponse.json({ error })` on failure; `NextResponse.json({ ... })` on success
- Never put Route Handler logic in a client component or service file

---

## Supabase Storage

First live use: the private `vendor-kyc` bucket (vendor KYC documents). Patterns
established there, to follow for future buckets (see `vendor-kyc.md`, `schema.md`):

- **Buckets are private** (`public = false`) and provisioned **via migration**
  (`insert into storage.buckets …` + `storage.objects` RLS policies), not the
  dashboard — reproducible across local/hosted.
- **Path convention** puts the owning entity id first: `{vendor_id}/{uuid}-{filename}`.
  Storage RLS keys on it with `(storage.foldername(name))[1]::uuid`, mirroring the
  table's ownership helper (`has_vendor_role`).
- **Never expose public URLs** — read private files through short-lived
  `createSignedUrl(path, seconds)` (~60 s), wrapped in a service function
  (`signMyKycDocUrl`, `signKycUrl`).
- **Uploads from a client session** go through Storage RLS; uploads with **no
  session** (e.g. pre-account onboarding) go through a **service-role Route
  Handler**. Sanitize filenames before building a path.
- **Storage is not Postgres.** `db reset` and row/cascade deletes never remove
  file blobs — delete objects explicitly (`.remove([...])`) when deleting their
  metadata rows, or they orphan and keep consuming quota. A maintenance script
  lives at `backbone/scripts/wipe-kyc-storage.mjs`.

---

## Auth Service Pattern

Each portal has a thin `services/auth.service.ts` that wraps the Supabase Auth client methods. Components and hooks import from this file rather than calling `createClient().auth.*` directly.

```ts
// services/auth.service.ts — same structure in all three portals
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

export async function signIn(email: string, password: string) {
  return createClient().auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return createClient().auth.signOut()
}

export async function getUser() {
  return createClient().auth.getUser()
}

export async function resetPassword(email: string, redirectTo?: string) {
  return createClient().auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  )
}

export async function updatePassword(newPassword: string) {
  return createClient().auth.updateUser({ password: newPassword })
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  return createClient().auth.onAuthStateChange(callback)
}
```

This is the only file that ever calls `createClient().auth.*`. Do not scatter auth calls across components.

`resetPassword(email, redirectTo?)` forwards `redirectTo` (the app origin) so the recovery link returns to the app, and `updatePassword(newPassword)` sets the new password once recovery is detected. See `auth-and-roles.md` for the password-recovery flow.

**Browser client flow type.** The browser client (`lib/supabase/client.ts` in each portal) is created with `{ auth: { flowType: "implicit" } }`. These are pure client-rendered SPAs, so implicit flow is appropriate: password recovery returns the token in the URL hash rather than a PKCE `?code=` that would need a same-origin `code_verifier`, which makes the recovery flow reliable. The same file exposes `isRecoveryDetected()` (latched from a module-load `PASSWORD_RECOVERY` listener) that the app shell reads on mount.

---

## Access Verification Services

In addition to the database-level RLS, each portal has a client-side access check function that runs on session restore and drives the login gate UI. These functions are in the portal's domain service file and are **not** a replacement for RLS — they are a UX layer that shows meaningful error states (wrong portal, suspended, pending activation) when a user tries to access a portal they are not permitted to use.

**`booker.service.ts` → `verifyBookerAccess()`**

```ts
export type AccessDeniedReason = "no_access" | "suspended" | "pending"

export async function verifyBookerAccess(): Promise<{ allowed: boolean; reason: AccessDeniedReason | null }>
```

Checks: active Supabase session + `user_portals` row for `booker` + `user_roles` row for `member` + `profiles.status_id = active`. Returns `{ allowed: true, reason: null }` on full pass, or one of the three denial reasons.

**`command.service.ts` → `verifyCommandAccess()`**

```ts
export async function verifyCommandAccess(): Promise<{ allowed: boolean }>
```

Checks: active session + `user_portals` row for `command` + `user_roles` row for `admin` or `root` + `profiles.status_id = active`.

**Pattern rules:**
- These functions use the browser Supabase client (anon key, subject to RLS)
- They call `profiles`, `user_portals`, and `user_roles` in parallel via `Promise.all`
- They do not call `is_active()` or other DB helper functions directly — they read through RLS like any other client query
- Each portal that has a login gate must have one of these functions; add a new one if a new portal is created

---

## Environment Variables

| Variable | Side | Purpose |
|----------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (client + server) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (client + server) | Anon key for RLS-protected access |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Bypasses RLS — never expose to client |
| `NEXT_PUBLIC_APP_NAME` | Public (client + server) | App display name; re-exported as `APP_NAME` from each app's `lib/constants.ts` with a placeholder fallback. Also read server-side in booker's `create-session/route.ts` |
| `NEXT_PUBLIC_APP_DOMAIN` | Public (client + server) | App domain; re-exported as `APP_DOMAIN` from each app's `lib/constants.ts` with a placeholder fallback |
| `NEXT_PUBLIC_APP_URL` | Public (client + server) | Booker payment return URL — base for PayMongo success/cancel redirects |
| `NEXT_PUBLIC_APP_VERSION` | Public (client + server) | Injected via `next.config.ts` from `package.json` version; read by `components/dev/DevVersionBadge.tsx`. Present in all three portals (uniform since 2026-07; command's badge is styled with Tailwind arbitrary-value classes rather than a CSS Module, unlike the rest of its CSS-Modules-first codebase — a deliberate exception for parity with booker/vendor, see `.plans/2026-07-18-devversionbadge-uniform-patch.md`) |

Each portal has its own `.env.local`. All three point to the same Supabase project URL and keys.

---

## TypeScript Conventions

- Strict mode is enabled in all three portals
- All shared types for an app live in `lib/types.ts` — no inline type definitions in component files unless they are truly local to that component (e.g., a props interface)
- Use `interface` for object shapes, `type` for unions and aliases
- Do not use `any` — use `unknown` with a type narrowing assertion where the DB returns untyped data (`as unknown as DbRow[]`)
- Type DB response shapes with private `interface DbRow` in the service file, map to clean types before returning

---

## Component Conventions

- **Prefer server components** unless interactivity, browser APIs, or React state are required. Add `"use client"` only when necessary.
- **Leaflet** must always be dynamically imported (`ssr: false`) — never imported at module level from a server component. This applies to the booker portal only.
- **shadcn/ui components** are added via `npx shadcn@latest add <component>` — never hand-edited. They live in `components/ui/`.
- **Naming:** Component files use `PascalCase.tsx`. Hook files use `camelCase.ts`. Service files use `camelCase.service.ts`.
- **Co-location:** A component that owns a hook lives in the same folder: `ComponentName/ComponentName.tsx` + `ComponentName/useComponentName.ts`.
- **Separation of concerns (mandatory):** Every component with state, effects, or handlers gets a companion `useComponentName.ts` hook. The `.tsx` is a pure render layer — no `useState`/`useEffect`, no business logic, and no static inline `style={{}}`. Non-trivial styling goes in Tailwind utilities/tokens or a co-located `ComponentName.module.css`; only genuinely dynamic, one-off values (e.g. a width computed from state) may stay inline. A pure display component (no state/effects/handlers, no non-trivial styling) is the only exception and may have just the `.tsx`. See `skills/component-separation.md`.

---

## Styling Conventions

- Tailwind utility classes for layout and spacing
- CSS custom properties (`var(--db-strong)`, `var(--db-text)`, etc.) for all theme-sensitive colours — never hardcode light/dark values
- Static inline `style` objects are **not** acceptable — move static styling to Tailwind utilities/tokens or a co-located `.module.css`. Only genuinely dynamic, state/data-driven one-off values (e.g. a width or transform computed at runtime) may remain inline. See `skills/component-separation.md`.
- **CSS Modules** (`Component.module.css`) usage differs by app. **booker** and **vendor** are Tailwind-first, leaning on `db-*` token utility classes (`text-db-strong`, `db-sub`, `bg-[var(--db-card-bg)]`, etc.), with CSS Modules reserved for awkward geometry (e.g. the KYC camera widget: `CameraCapture.module.css`, `IdentityStep.module.css` — masked cut-out overlay, oval/card frames). **command** is effectively CSS-Modules-first (~45 `.module.css` files). The login surfaces across the apps also use CSS Modules. When a component uses a CSS Module, keep the `.tsx` free of inline `style={{}}` and reference `styles.x`.
- `cn()` from `lib/utils.ts` for conditional class merging
- Theme variables are defined in `globals.css` under `:root` (light) and `.dark` selectors

**Booker portal design tokens (examples):**

| Token | Light | Dark |
|-------|-------|------|
| `--db-strong` | `#0f172a` | `#f1f5f9` |
| `--db-text` | `#64748b` | `#94a3b8` |
| `--db-divider` | `#e2e8f0` | `#1e293b` |
| `--db-card-bg` | `#ffffff` | `#0f172a` |

---

## Schema and Migration Conventions

- Every schema change must be a new migration file in `./backbone/supabase/migrations/`
- File naming: `YYYYMMDDNNNNNN_short_description.sql` where `NNNNNN` is a 6-digit sequence
- Never edit an applied migration — create a corrective migration instead
- After every migration, hand-update the TypeScript interface(s) in the relevant service — this repo does **not** use `supabase gen types` (types are hand-authored)
- Every new table must have RLS enabled (`alter table ... enable row level security`) and at least one policy
- New policies follow the helper function patterns in `auth-roles.md` — do not write raw `auth.uid()` checks without also checking `is_active()`
- Destructive SQL (`DROP`, `TRUNCATE`, `DELETE` without `WHERE`) requires explicit approval before running

---

## Git and Deployment

- Apps deploy independently to Vercel — one Vercel project per portal
- There is no shared CI/CD pipeline
- Environment variables are set in the Vercel project settings for each app
- The `./backbone` folder contains the Supabase project config — migrations are applied via the Supabase CLI (`supabase db push` or via the Supabase dashboard)
- Migrations are version-controlled and must be committed before being applied to the production DB

---

## What to Avoid

| Anti-pattern | Why |
|-------------|-----|
| `service_role_key` in client code | Bypasses all RLS — security critical |
| Filtering in app code instead of RLS | App-layer filtering can be bypassed; DB-layer cannot |
| Raw `setX` returned from hook when a named handler would be clearer | Makes the hook interface hard to understand |
| Importing directly from Supabase response without mapping | Raw DB shapes leak into components, making refactoring painful |
| Sharing types or utilities between apps via relative imports | Creates hidden coupling — use copy-by-intent instead |
| Editing a migration that has been applied | Can cause irrecoverable schema drift |
| Adding `NEXT_PUBLIC_` prefix to sensitive keys | Exposes secrets to the browser bundle |
| `import leaflet from "leaflet"` at the module level in any Next.js component | Breaks SSR — always use dynamic import with `ssr: false` |
| Importing `lib/supabase/admin.ts` from a client component or service file | Exposes `SUPABASE_SERVICE_ROLE_KEY` to the browser bundle — admin client is server-only |
| Calling `createClient().auth.*` directly in components instead of via `auth.service.ts` | Scatters auth calls — all auth operations go through the service wrapper |
| Adding access verification logic to RLS policies instead of separating it into a service | RLS is a security gate, not a UX layer — denial reasons belong in the app-level service |
