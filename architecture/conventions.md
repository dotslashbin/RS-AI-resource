# Code Conventions

Patterns established across all three portals. New code should follow these without deviation unless there is a documented reason.

> **Scope of this document.** Everything below describes the **three Next.js portals** unless it says otherwise. The Expo mobile apps share the *principles* — service layer, hook-as-controller, no shared code, RLS-first — but almost none of the mechanics: no `@supabase/ssr`, no Route Handlers, no Tailwind, no CSS Modules, no server components. Their divergences are collected in **Mobile (Expo) Conventions** near the end of this file; read that section instead of adapting the web rules by eye.

---

## Project Structure

Each portal is a self-contained Next.js 16 App Router application. The root of each app looks like:

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

All three apps follow this same layout. There is no `src/` directory. (The Expo apps do have one — see Mobile Conventions.)

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
- `vendor/app/api/divisions/route.ts` — public GET, serves the active `divisions` list for the registration form's division select. Exists because the registration page is shown pre-account (`anon`, which has zero table grants in this schema — `20260620000001_api_role_grants.sql`) — a direct browser query against `divisions` 401s. Reads via `createAdminClient()` instead, the same public/anonymous exception the register route itself already relies on.
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
| `NEXT_PUBLIC_APP_VERSION` | Public (client + server) | Injected via `next.config.ts` from `package.json` version; read by `components/dev/DevVersionBadge.tsx`. Present in all three portals (uniform since 2026-07; command's badge is styled with Tailwind arbitrary-value classes rather than a CSS Module, unlike the rest of its CSS-Modules-first codebase — a deliberate exception for parity with booker/vendor) |

Each portal has its own `.env.local`. All three point to the same Supabase project URL and keys.

---

## TypeScript Conventions

- Strict mode is enabled in all three portals
- All shared types for an app live in `lib/types.ts` — no inline type definitions in component files unless they are truly local to that component (e.g., a props interface)
- Use `interface` for object shapes, `type` for unions and aliases
- Do not use `any` — use `unknown` with a type narrowing assertion where the DB returns untyped data (`as unknown as DbRow[]`)
- Type DB response shapes with private `interface DbRow` in the service file, map to clean types before returning

### Unit tests in the web apps (`vendor`, 2026-08)

`vendor` now carries the same zero-dependency runner the mobile app uses:
`npm test` → `node --test --experimental-strip-types "lib/**/*.test.ts"`. No
framework, no new dependency. `booker` and `command` have none yet.

**The same rule applies as on mobile: pure logic that needs a test lives in its own
module.** `node --test` has no bundler, so a test can only load files that resolve
without one. Three consequences, each of which cost a debugging cycle when
`lib/occurrence.ts` was first added:

1. **No `@/` alias in a module a test loads.** `node` cannot resolve it. Use relative
   imports (`./types`), which are identical under `tsc` and webpack.
2. **Value imports need an explicit `.ts` extension** (`from "./occurrence.ts"`).
   *Type-only* imports do not — type-stripping erases them before Node ever resolves
   them, which is why a file can look fine until its first value import.
3. **`allowImportingTsExtensions: true`** in `tsconfig.json` makes (2) legal. Prefer
   it over excluding `**/*.test.ts` from the config — excluding drops the tests out
   of `tsc --noEmit` entirely, which is how a broken test file goes unnoticed.

`npm run build` is the arbiter that Next still accepts the extension; it does.

### Display order is never database data

A UI array's **index must never be used as a stored value.** The vendor day-of-week
picker did exactly that — it wrote `WD_SHORT`'s array index into
`schedules.days_of_week`, whose encoding is `0=Mon … 6=Sun`. Reordering those labels
for display (Sunday-first) would silently have remapped every day a vendor picked,
with **no type error, no constraint violation and no failing test** — schedules would
simply have run on the wrong days.

Both apps now carry the encoding explicitly:

```ts
export const WEEKDAYS: { label: string; dbDow: number }[] = [
  { label: "Su", dbDow: 6 }, { label: "Mo", dbDow: 0 }, …
]
```

Read `dbDow` for anything that touches data; reorder the array freely for display.
Generalise the habit: when a list is both rendered and persisted, carry the stored
value on the item rather than relying on position.

---

## Component Conventions

- **Prefer server components** unless interactivity, browser APIs, or React state are required. Add `"use client"` only when necessary.
- **Leaflet** must always be dynamically imported (`ssr: false`) — never imported at module level from a server component. This applies to the booker portal only.
- **shadcn/ui components** are added via `npx shadcn@latest add <component>` — never hand-edited. They live in `components/ui/`.
- **Naming:** Component files use `PascalCase.tsx`. Hook files use `camelCase.ts`. Service files use `camelCase.service.ts`.
- **Co-location:** A component that owns a hook lives in the same folder: `ComponentName/ComponentName.tsx` + `ComponentName/useComponentName.ts`.
- **Separation of concerns (mandatory):** Every component with state, effects, or handlers gets a companion `useComponentName.ts` hook. The `.tsx` is a pure render layer — no `useState`/`useEffect`, no business logic, and no static inline `style={{}}`. Non-trivial styling goes in Tailwind utilities/tokens or a co-located `ComponentName.module.css`; only genuinely dynamic, one-off values (e.g. a width computed from state) may stay inline. A pure display component (no state/effects/handlers, no non-trivial styling) is the only exception and may have just the `.tsx`. See `.claude/skills/component-separation/SKILL.md`.

---

## Styling Conventions

- Tailwind utility classes for layout and spacing
- CSS custom properties (`var(--db-strong)`, `var(--db-text)`, etc.) for all theme-sensitive colours — never hardcode light/dark values
- Static inline `style` objects are **not** acceptable — move static styling to Tailwind utilities/tokens or a co-located `.module.css`. Only genuinely dynamic, state/data-driven one-off values (e.g. a width or transform computed at runtime) may remain inline. See `.claude/skills/component-separation/SKILL.md`.
- **CSS Modules** (`Component.module.css`) usage differs by app. **booker** and **vendor** are Tailwind-first, leaning on `db-*` token utility classes (`text-db-strong`, `db-sub`, `bg-[var(--db-card-bg)]`, etc.), with CSS Modules reserved for awkward geometry (e.g. the KYC camera widget: `CameraCapture.module.css`, `IdentityStep.module.css` — masked cut-out overlay, card frames, face dot). **command** is effectively CSS-Modules-first (~45 `.module.css` files). The login surfaces across the apps also use CSS Modules. When a component uses a CSS Module, keep the `.tsx` free of inline `style={{}}` and reference `styles.x`.
- `cn()` from `lib/utils.ts` for conditional class merging
- Theme variables are defined in `globals.css` under `:root` (light) and `.dark` selectors
- **Print styles** (first use: the vendor Transactions page, 2026-07). Per-component show/hide uses Tailwind `print:` variants (`print:hidden`, `hidden print:block`); **structural** resets on shared layout containers live in one `@media print` block in `globals.css`. The shell is built for a fixed-height scrolling viewport — `.sp-page` is `min-height:100vh; display:flex`, `<main>` is `overflow-hidden`, its content div `overflow-y-auto` — and any of those silently clips a printed document to a single page unless released.

> **Printing a paginated list — non-obvious, do not "simplify".** `window.print()` serialises the DOM as it stands; it does not re-render. A page that renders only the current page of rows will therefore print only those rows, silently truncating an export. The vendor Transactions page deliberately renders its filtered data **twice**: the paginated view (`print:hidden`) and a full unpaginated view (`hidden print:block`) that always receives every row matching the active filter. Collapsing these into one render reintroduces the truncation bug. See `.plans/2026-07-25-vendor-transactions-platform-fee.md` (I4).

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

## Mobile (Expo) Conventions

Applies to `ezzy-vendor-mobile` and `ezzy-booker-mobile`. These **override** the web rules above wherever they conflict. `ezzy-vendor-mobile` is the reference implementation; `ezzy-booker-mobile` is a scaffold whose own plan predates it.

**Read the versioned docs.** https://docs.expo.dev/versions/v57.0.0/ — SDK 57 is new enough that most recalled patterns for navigation, notifications and config are stale.

### Project structure

Unlike the portals, the mobile apps **do** have a `src/` directory, and `@/*` resolves to it.

```
src/
  app/                    expo-router file-based routes
    _layout.tsx           providers + Stack.Protected guards
    (app)/                the signed-in tab group
  components/<domain>/    ComponentName/{.tsx, .styles.ts, use*.ts}
  hooks/                  TanStack Query wrappers, Realtime subscriptions
  lib/
    supabase/client.ts    createClient from @supabase/supabase-js (NOT @supabase/ssr)
    supabase/secureStorageAdapter.ts
    constants.ts  format.ts  queryClient.ts  notifications.ts  pushModule.ts
  providers/              SessionGate, Snackbar, Push
  services/<domain>.service.ts
  theme/                  tokens.ts, AppThemeProvider, useAppTheme
```

Package and toolchain commands are **app-local**, not root-relative: `npm --prefix ezzy-vendor-mobile run start`, or run from inside the folder.

### Brand assets are generated, not hand-drawn

`ezzy-vendor-mobile/assets/brand/` holds the vector source and every icon/splash PNG derived from it. **Do not hand-edit the PNGs** — regenerate:

```bash
node scripts/generate-brand-assets.js      # from inside the app folder
```

| File | Role |
|---|---|
| `ezzy-mark-source.svg` | Supplier file, never modified — provenance |
| `ezzy-mark.svg` | Generated; a stray white trace artifact stripped out |
| `_master.png` | 2048² intermediate render |
| `icon-ios.png` · `icon-android-{foreground,monochrome}.png` · `splash-mark.png` | Outputs wired into `app.json` |

Three constraints make these non-obvious, and the script asserts all three so a regeneration cannot quietly break them:

- **The iOS icon must carry no alpha channel at all** — App Store Connect rejects one even when every pixel is opaque. Written with PNG colour type 2, not merely composited onto an opaque background.
- **Android adaptive layers are 108dp, but only a centred 66dp circle is guaranteed visible** — ~626px on a 1024 canvas. The mark is inscribed in that circle (483×398); anything larger gets cropped by some launcher's mask. This is why the Android mark is visibly smaller than the iOS one — it is the safe zone, not an inconsistency.
- **The Android foreground looks blank in an image viewer.** It is a white mark on transparency, so it composites white-on-white. Verify by compositing over `adaptiveIcon.backgroundColor`, not by opening the file.

Rasterization (SVG → master PNG) uses headless Chrome or Edge, auto-detected on the Windows side under WSL and writing back through a `\\wsl.localhost\<distro>\…` UNC path. No rasterizer is installed; derivation uses `jimp-compact`, which arrives transitively via `@expo/image-utils`. On a machine without a browser the script says to supply `_master.png` by hand and continues from there.

**Icons and splash are baked into the binary at build time** — they never appear on a Metro reload, and a preview build shows them only after a rebuild.

### Supabase client

`@supabase/ssr` does not apply — there is no SSR and no cookie jar. Use `createClient` from `@supabase/supabase-js` directly, which is the exact opposite of the web rule above.

```ts
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorageAdapter,   // OS keystore, not AsyncStorage
    detectSessionInUrl: false,       // no URL bar; deep links handled explicitly
    flowType: "pkce",                // web portals use implicit — deliberate divergence
    autoRefreshToken: true,
    persistSession: true,
  },
})
```

Four things that are all load-bearing:

- **`react-native-url-polyfill/auto` must be imported before the client is constructed.** Hermes ships an incomplete `URL` that realtime-js needs.
- **Session storage is `expo-secure-store` behind a chunking adapter.** iOS caps a Keychain value near 2 KB and a Supabase session exceeds it, so the adapter splits the value across numbered keys with a small manifest. Plain AsyncStorage is unencrypted on disk — acceptable for cached reads, never for a token that authorises approvals.
- **`flowType: "pkce"`** is correct for a public client that cannot hold a secret. Do not "align" it with the web portals.
- **Auto-refresh is tied to `AppState`** — a backgrounded app must not keep a refresh timer running.

### There are no Route Handlers

The mobile apps have no server. Anything needing the service-role key is called **over HTTPS against a deployed web app's Route Handler**; the key never enters the binary. Public config uses the `EXPO_PUBLIC_` prefix, and *anything* under that prefix is readable by anyone who unpacks the app.

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Publishable/anon key — RLS-protected access |
| `EXPO_PUBLIC_APP_NAME` | Display name; also read by `app.config.js` so the home-screen label and in-app branding cannot drift |
| `EXPO_PUBLIC_VENDOR_PORTAL_URL` | Where mobile links out to for registration, KYC, account deletion, privacy policy. Optional — links hide rather than break when unset |

**`.env` is gitignored and is not uploaded to EAS.** A build that bundles JS on EAS servers (`preview`, `production`) reads **EAS environment variables** instead, which must be set per environment with `eas env:set` and pinned by an `"environment"` field on the build profile. Skipping this produces a build that installs and then dies at startup — see `.plans/2026-07-28-vendor-mobile-preview-crash.md`.

**Configuration is validated without throwing.** `lib/constants.ts` exports `MISSING_CONFIG: string[]` and the root layout renders a `ConfigErrorScreen` when it is non-empty. A module-scope `throw` is a red box in a development build but a *silent process death* in a release build — do not reintroduce one.

### Component conventions — RN variant

The render/hook split is **unchanged**: every component with state, effects or handlers gets a companion `useComponentName.ts`, and the `.tsx` stays a pure render layer.

What differs: React Native has no CSS modules. Static styling lives in a co-located `ComponentName.styles.ts`, and in a theme-aware app it exports a **`makeStyles(tokens)` factory** that the component memoises — a module-level `StyleSheet.create` singleton would freeze one theme's colours at import time.

```ts
// ComponentName.styles.ts
export const makeStyles = (t: Tokens) => StyleSheet.create({ … })
```
```tsx
const { tokens } = useAppTheme()
const styles = useMemo(() => makeStyles(tokens), [tokens])
```

Static inline `style={{}}` remains prohibited; only genuinely dynamic values (a gesture-driven transform, a width from state) may stay inline. Pure display components with no state, effects, handlers or non-trivial styling are the only exception to the companion hook.

### Layout traps — where a style is silently ignored

Two library defaults quietly override styles written in a `.styles.ts`. Both have cost build cycles in `ezzy-vendor-mobile`, and both share a failure mode worth naming: **the style is accepted, type-checks, lints, bundles and does nothing.** No tool in the toolchain can see either one. When a spacing or sizing change appears to have no effect on device, suspect the container before re-tuning the value.

**A horizontal `ScrollView` fills its cross axis.** React Native puts `flexGrow: 1` in the base style of *every* `ScrollView` — `baseHorizontal: { flexGrow: 1, flexShrink: 1, … }` at `react-native/Libraries/Components/ScrollView/ScrollView.js:1887-1892`, applied unconditionally at `:1763`. In a `flex: 1` column parent, a horizontal scroller therefore expands to fill all remaining *vertical* space, and its content container's default `alignItems: "stretch"` stretches every child to that height. A filter-chip strip built this way rendered chips roughly 400pt tall, filling half the screen, while `minHeight` and `paddingVertical` on the chip had no effect whatsoever. Pass `style={{ flexGrow: 0 }}` to the ScrollView itself — not `contentContainerStyle`, which is a different element — and set `alignItems: "center"` on the content container as a second line of defence. Vertical scrollers want the default and must be left alone.

**`gap` on a FlashList content container is inert.** FlashList v2 lays every cell out absolutely (`ViewHolder.js:44`, `position: "absolute"`), so a flex `gap` in `contentContainerStyle` has nothing to act on; `padding` *is* honoured, which makes the failure look selective. Row spacing goes through `ItemSeparatorComponent`. Two further details: a separator renders only when `trailingItem !== undefined` (`ViewHolder.js:32`), so the last row has none by design, and the cell memo compares `ItemSeparatorComponent` **by identity** (`:75`) — an inline arrow component remounts every separator on each render, so memoise it.

### Routing

`expo-router` on `standard-navigation`. **`@react-navigation/*` is forbidden** — removed from the SDK at 56. Auth gating uses `Stack.Protected` guards in `app/_layout.tsx`.

Two traps: a route file and a group index that both resolve to `/` collide silently (hence `(app)/dashboard.tsx`, not `(app)/index.tsx`), and typed routes regenerate only when `expo start` actually runs — no flag does it.

**A guarded `<Stack>` must set `initialRouteName` explicitly.** A false guard removes the screen from the navigator entirely. If that empties the stack — which happens on every auth transition, because the access gate spends a network round trip in `checking` with no guard passing — `StackRouter` falls back to `initialRouteName`, or, absent it, to `routeNames[0]`: the first *declared* `<Stack.Screen>`. In `ezzy-vendor-mobile` that was the deliberately unguarded `reset-password` screen, so sign-in, sign-out and vendor switch all landed on a "this reset link is missing its code" error. Point it at the unguarded anchor route (`index`), whose job is deciding where a user belongs.

`unstable_settings.anchor` does **not** substitute: it only sorts *undeclared* routes, while the router reads the navigator prop. Related: a "back to sign in" affordance should replace to `/`, never `/sign-in` — that screen sits behind a `!signedIn` guard, so the navigation is silently dropped whenever a session exists.

### Native modules that throw on import

`expo-notifications` throws **during module evaluation** on Expo Go for Android, taking down every module that imports it — including the root layout, producing a crash with no logs. It is loaded through a guarded accessor (`lib/pushModule.ts`) and every consumer goes through that:

```ts
const Notifications = loadNotifications()
if (!Notifications) return
```

A plain `import * as Notifications from "expo-notifications"` is a bug even when guarded at the call site, because the guard sits inside a file that never finishes loading. `import type * as … from "expo-notifications"` is fine — type imports are erased and emit no `require`.

Detect Expo Go with `Constants.appOwnership === "expo"`. It is deprecated, but its replacement `executionEnvironment` reports `storeClient` for both Expo Go *and* dev clients, which is precisely the distinction needed.

### Services and state

Services follow the web pattern — one file per domain, `async` functions, no React imports, map `DbRow` to clean types, return safe fallbacks. Types and service logic are **copied and adapted** from the web app, never imported across the repo boundary.

Server state is TanStack Query with an `AppState` focus manager and bounded AsyncStorage persistence. Writes are never queued offline.

**Pure logic that needs testing must live in its own module.** Tests run under `node --test --experimental-strip-types` with no test framework, so anything importing `lib/supabase/client` cannot load. Extract the testable part (`vendorMapping.ts`, `bookingErrors.ts`, `transactionTotals.ts`) and leave the Supabase call in the service.

### Store compliance is a build requirement

Read `.claude/skills/mobile-dev/SKILL.md` before implementing or reviewing a mobile feature. The rules that most often change code rather than metadata: permission minimalism (re-read the *merged* manifest after `expo prebuild` — dependencies add permissions you did not ask for), every blocked/empty state needing real copy and a way forward, push tokens counting as a device identifier in data-safety declarations, and Apple 4.2 requiring genuine native capability rather than a web wrapper.

---

## Git and Deployment

- Apps deploy independently to Vercel — one Vercel project per portal
- There is no shared CI/CD pipeline
- Environment variables are set in the Vercel project settings for each app
- The `./backbone` folder contains the Supabase project config — migrations are applied via the Supabase CLI (`supabase db push` or via the Supabase dashboard)
- Migrations are version-controlled and must be committed before being applied to the production DB
- **Each app folder is its own git repository.** The workspace root repo tracks only `architecture/`, `.plans/`, `.claude/` and the top-level Markdown — a commit for an app must be made **inside that app's folder**, because the root repo does not contain its history
- **Mobile ships through EAS Build**, not Vercel. Environment variables live in EAS (`eas env:set`) per environment, separately from the app's gitignored `.env`. See `ezzy-vendor-mobile/EAS-SETUP.md`

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

**Mobile-specific (Expo apps):**

| Anti-pattern | Why |
|-------------|-----|
| `import * as Notifications from "expo-notifications"` at module level | Throws during evaluation on Expo Go/Android and takes the whole module graph above it down, crashing with no logs. Use `loadNotifications()` from `lib/pushModule.ts` |
| `@react-navigation/*` imports | Removed from the SDK at 56 — `expo-router` on `standard-navigation` is the only navigator |
| Any secret under `EXPO_PUBLIC_` | The prefix is inlined into the bundle; anyone who unpacks the app can read it |
| Session tokens in AsyncStorage | Unencrypted on disk. Use the SecureStore chunking adapter — a Supabase session exceeds iOS's ~2 KB Keychain cap |
| A module-scope `throw` for missing configuration | Silent process death in a release build. Report through `MISSING_CONFIG` + `ConfigErrorScreen` |
| Module-level `StyleSheet.create` in a theme-aware component | Freezes one theme's colours at import time — export `makeStyles(tokens)` instead |
| Optimistic write for booking approval | `validate_booking_status_transition` forbids `confirmed → pending`, so it cannot be undone. Use the deferred-commit pattern |
| Importing types or services from a web app across the repo boundary | Same copy-by-intent rule as between portals, plus the toolchains are incompatible |
| Assuming a feature verified on Android is done | No phase is complete until both platforms are exercised, and iOS has never been run here |
