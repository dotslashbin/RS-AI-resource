# Plan: DriveBook Learner — Supabase Auth Implementation

**Date:** 2026-05-14
**Scope:** `./learner` only

---

## Context

`./learner` currently has a mock login (button click = logged in, no credentials). Supabase is not installed. The objective is to wire real authentication with the same patterns used in `./academy` and `./command`, with one rule: only users with `status=active`, `learner` portal access, and `member` role may log in. No self-registration — accounts are created by the Command portal.

---

## Migration Required?

**No.** The DB already has:
- `learner` portal row in `portals`
- `member` role row in `roles`
- RLS helpers: `is_active()`, `is_portal_member('learner')`, `has_role('member')`
- Seed users: `liza@roadsafety.ph` (active member ✓), `sofia@roadsafety.ph` (active member ✓)

---

## New Dependencies — **Approval Required**

```
@supabase/supabase-js
@supabase/ssr
```

Same versions as `./academy` and `./command`.

---

## Access Rule

User may log in if and only if **all three** are true:
1. `profiles.statuses.name === "active"`
2. Has a row in `user_portals` where `portals.name === "learner"`
3. Has a row in `user_roles` where `roles.name === "member"`

Distinct error messages per failure mode (see `verifyLearnerAccess` below).

---

## Files Overview

| # | File | Action |
|---|------|--------|
| 1 | `lib/supabase/client.ts` | **New** — browser Supabase client |
| 2 | `lib/supabase/server.ts` | **New** — server Supabase client (for future use) |
| 3 | `services/auth.service.ts` | **New** — signIn, signOut, getUser, resetPassword, onAuthStateChange |
| 4 | `services/learner.service.ts` | **New** — verifyLearnerAccess() |
| 5 | `middleware.ts` | **New** — session cookie refresh on every request |
| 6 | `components/auth/LoginPage/useLoginPage.ts` | **New** — replaces mock with real auth logic |
| 7 | `components/auth/LoginPage/LoginPage.tsx` | **Modify** — wire to useLoginPage, add forgot flow |
| 8 | `components/layout/AppShell/useAppShell.ts` | **Modify** — session check on mount, currentUser, handleLogout |
| 9 | `components/layout/AppShell/AppShell.tsx` | **Modify** — loading state, pass handleLogout + userEmail |
| 10 | `components/layout/Sidebar/Sidebar.tsx` | **Modify** — real user email, logout button |

---

## Detailed Specs

### 1. `lib/supabase/client.ts` — identical to academy
```ts
import { createBrowserClient } from "@supabase/ssr"
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 2. `lib/supabase/server.ts` — identical to academy
```ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (t) => t.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )
}
```

### 3. `services/auth.service.ts` — identical to command
```ts
import { createClient } from "@/lib/supabase/client"
export async function signIn(email, password) { ... }
export async function signOut() { ... }
export async function getUser() { ... }
export async function resetPassword(email) { ... }
export function onAuthStateChange(callback) { ... }
```

### 4. `services/learner.service.ts` — new access gate
```ts
export type AccessDeniedReason = "no_access" | "suspended" | "pending"

export async function verifyLearnerAccess(): Promise<{ allowed: boolean; reason: AccessDeniedReason | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { allowed: false, reason: "no_access" }

  const [{ data: profile }, { data: portals }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("statuses(name)").eq("id", user.id).single(),
    supabase.from("user_portals").select("portals(name)").eq("user_id", user.id),
    supabase.from("user_roles").select("roles(name)").eq("user_id", user.id),
  ])

  const hasPortal = portals?.some(p => (p.portals as any)?.name === "learner")
  const hasRole   = roles?.some(r => (r.roles as any)?.name === "member")
  if (!hasPortal || !hasRole) return { allowed: false, reason: "no_access" }

  const status = (profile?.statuses as any)?.name
  if (status === "suspended") return { allowed: false, reason: "suspended" }
  if (status !== "active")   return { allowed: false, reason: "pending" }
  return { allowed: true, reason: null }
}
```

### 5. `middleware.ts` — proper Next.js middleware (not proxy.ts)
Session cookie refresh on every request. Identical logic to `proxy.ts` in academy/command but wired correctly as `middleware.ts` at the app root. matcher excludes static assets and favicon.

### 6. `components/auth/LoginPage/useLoginPage.ts` — NEW file

`LoginView` = `"login" | "forgot" | "sent"`

`handleLogin(onLoginSuccess)`:
1. `signIn(email, password)` → on Supabase error, show `error.message`
2. `verifyLearnerAccess()` → on `!allowed`, `signOut()` then show reason-specific message:
   - `"suspended"` → "Your account has been suspended. Please contact support."
   - `"pending"` → "Your account is pending activation."
   - `"no_access"` → "You do not have access to DriveBook."
3. On success → call `onLoginSuccess()`

`handleForgot()`: calls `resetPassword(forgotEmail)` → on success, `setLoginView("sent")`

### 7. `components/auth/LoginPage/LoginPage.tsx` — wire up

Keep existing DriveBook UI (navy gradient, Car icon, FFC200 accent). Changes:
- Add `useLoginPage` import; destructure state
- `type="email"` on email input (was `type="text"`)
- Controlled `value` / `onChange` on both inputs
- `onKeyDown` on password field to submit on Enter
- Error message display below password
- Loading state: button text changes to "Signing in…", disabled during load
- Forgot password view: email input + "Send Reset Link" button
- Sent confirmation view: success message + "Back to Sign In"
- `interface LoginPageProps { onLogin: () => void }` — unchanged

### 8. `components/layout/AppShell/useAppShell.ts` — session on mount

New state: `isCheckingAuth: boolean` (true until mount check completes), `currentUser: User | null`

`useEffect` on mount:
```ts
getUser().then(async ({ data: { user } }) => {
  if (!user) { setIsCheckingAuth(false); return }
  const { allowed } = await verifyLearnerAccess()
  if (!allowed) { await signOut(); setIsCheckingAuth(false); return }
  setCurrentUser(user)
  setLoggedIn(true)
  setIsCheckingAuth(false)
})
```

`handleLoginSuccess()`: calls `getUser()` → sets `currentUser` + `setLoggedIn(true)`

`handleLogout()`: `signOut()` → clears state, resets page to `"dashboard"`

Remove `INIT_BOOKINGS` import from here — keep `bookings` state but initialise as `[]` (mock data will be wired separately when the booking feature is Supabase-wired).

Return additionally: `isCheckingAuth`, `currentUser`, `handleLoginSuccess`, `handleLogout`

### 9. `components/layout/AppShell/AppShell.tsx` — loading + callbacks

```tsx
const { ..., isCheckingAuth, loggedIn, currentUser, handleLoginSuccess, handleLogout } = useAppShell()

if (isCheckingAuth) return <FullPageSpinner />   // simple centered spinner, inline styles
if (!loggedIn) return <LoginPage onLogin={handleLoginSuccess} />
```

Pass `userEmail={currentUser?.email}` and `onLogout={handleLogout}` to `<Sidebar>`.

### 10. `components/layout/Sidebar/Sidebar.tsx` — real user

Add `userEmail?: string` and `onLogout: () => void` to `SidebarProps`.

Footer section: replace hardcoded "Juan Dela Cruz / juan@email.com" with:
- Avatar initial: `userEmail?.[0]?.toUpperCase() ?? "?"` 
- Display: `userEmail ?? "—"`
- Logout button (LogOut icon from lucide-react) next to or below the user row

---

## Environment Variables

No new secrets. Same vars as academy/command — add to `./learner/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<same as other apps>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same as other apps>
```

---

## What Is NOT In Scope

- Wiring `bookings` to Supabase (separate task — `INIT_BOOKINGS` removed from initial state but feature is kept with empty initial data)
- User profile editing in Settings page
- Self-registration (accounts managed via Command portal)

---

## Verification

1. `npm run dev` → login with `liza@roadsafety.ph` / `DevSeed@pass3` → enters app
2. Login with `sofia@roadsafety.ph` / `DevSeed@pass10` → enters app (member + learner portal)
3. Login with `marco@roadsafety.ph` (academy-admin, no member/learner role) → blocked: "You do not have access to DriveBook."
4. Login with `ana@roadsafety.ph` (pending_activation) → blocked: "Your account is pending activation."
5. Refresh while logged in → session restored, no redirect to login
6. Click logout → returns to login screen, session cleared
7. Forgot password → success toast / sent view (Supabase sends email)
8. `tsc --noEmit` passes
