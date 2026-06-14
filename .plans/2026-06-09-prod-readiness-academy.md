# Production Readiness — Academy Portal (School Portal)

**Date:** 2026-06-09
**App:** `./academy`
**Status:** IN PROGRESS — B1, B2 (route layer), B4 + Settings cleanup executed (2026-06-12, build-verified). B2's DB backstop (backbone B3) + IMPORTANT items (I1, I2, I5 doc-viewing) pending.

> Multi-tenant: every driving school sees this app. The theme is "no other school's data/name leaking in" and "don't strand a user on a blank screen."

> **Legend:** B# = Blocker, I# = Important. **These numbers are plan-local** — academy I1 is *not* the same as command I1 or backbone I1. Always qualify cross-plan references by app (e.g. "command I1", "backbone B3").

---

## BLOCKERS (must fix before launch)

### B1 — "Alpha Laguna" (seeded test academy) hardcoded in public surfaces ⚠️ ✅ DONE (2026-06-12)
> Executed: `layout.tsx:8` title → `"School Portal"`; `Sidebar.tsx:108,121` both fallbacks → `{userEmail ?? ""}`. Build clean.

**Files:**
- `academy/app/layout.tsx:8` — `title: "Alpha Laguna — School Portal"` → browser tab + link previews for *every* academy
- `components/layout/Sidebar/Sidebar.tsx:108,121` — fallback email "admin@alpha-laguna.com"

> **Correction from audit:** `SettingsPage.tsx:6–11` declares a `SCHOOL_INFO` const with "Alpha Laguna" but **never renders it** — it is dead code, not a user-visible leak. Removed as part of the Settings cleanup (see "Settings page cleanup" under DEFERRED/decided below), not here.

**Fix approach:**
- Metadata: generic title ("School Portal" / "RS School Portal"). Per-academy dynamic title is post-MVP.
- Sidebar: drop the hardcoded fallback; show the real user email or nothing.

No decision outstanding — both are straightforward de-branding.

### B2 — Registration route validates presence only  ✅ DONE — route layer (2026-06-12)
> Executed (route-layer): wraps `request.json()` in try/catch; required fields must be string + non-whitespace; normalizes (`trim`) all strings; validates email format + phone (PH-lenient, optional) + `yearEst` (optional, integer 1900–current year); inserts the cleaned values and uses them in notifications. Password left to GoTrue. Build clean. Shared validation shape matches learner I6.
> **Still pending (separate, deferred):** the DB-layer backstop = **backbone B3** (`academies` non-empty CHECK), approval-gated + coupled to command I1. The route validation above stands on its own; B3 is defence-in-depth on top.

**File:** `academy/app/api/auth/register/route.ts:6–10`

Public endpoint. Line 8 checks fields are *present* (truthy) but does no format / trim / range validation. Directly callable, bypassing the client form.

**What is ALREADY covered (don't rebuild):**
- **Email format + password length** → enforced by **Supabase Auth (GoTrue)** at `admin.auth.admin.createUser` (line 15). Bad email / short password → `createUserError` → route already returns 400 (lines 20–24). This lives in **Supabase project Auth config**, not in our code or migrations. *Action: confirm the project's min-password-length setting matches the client's 8-char rule.*
- **Partial-failure rollback** → **verified intact.** Every step deletes the user (and academy) on failure (lines 36, 47, 57, 78, 88–89). No repair needed.

**What backbone enforces (weak):** `lto_accred_no NOT NULL` and `email NOT NULL DEFAULT ''` — but `NOT NULL` permits empty strings, and there are **no CHECK constraints** for format or non-empty text anywhere in the migrations. Nothing is "planned" in backbone for this.

> **Sibling:** learner **I6** is the same class of fix (validate a public service-role register route). Neither is a caller-gate case — both routes are intentionally anonymous; the command B1 / learner B1 gate pattern does **not** apply. Land them with a consistent validation shape.

**Actual gaps B2 must close (neither GoTrue nor backbone covers):**
- Trim all string fields; reject whitespace-only `schoolName` / `ltoNo` / `address` (currently truthy → inserted verbatim).
- `yearEst` sanity: `Number(yearEst)` makes `"abc"` → `NaN` → silently `null`; negative/future years pass. Validate range or reject non-numeric.

**OPEN — where should the non-auth validation live? (explore before finalizing)**
- **App layer (route only):** fast, no migration; bypassable by *other* writers to `academies`.
- **Backbone CHECK constraints:** unbypassable, covers BOTH write paths into `academies` (self-register **and** the Command SchoolFormModal), aligns with the project's "DB-layer can't be bypassed" philosophy; costs a migration (approval gate). Candidate cheap checks: non-empty `name`, non-empty `lto_accred_no`. (Email-format CHECK in Postgres is imperfect — leave email to GoTrue.)
- **Leaning:** route-layer trim/sanity + a small backbone migration for non-empty `name`/`lto_accred_no` (defends the second write path). Not decided — flagged for exploration.

> **Drafted:** the backbone CHECK migration is written out in full (blast radius + lock + reversibility) in backbone plan **B3** (`20260612000001_academies_nonempty_checks.sql`). It couples to command **I1** — see that note. Still pending approval (schema change).

### B3 — Blank screen on session-restore for no-active-academy users ✅ DONE (2026-06-12)
> Executed: `useAppShell.ts` no-academy branch now `await signOut()` before returning; `useLoginPage.ts` added `signOut` to import + calls it in the no-academy login branch. Build + TypeScript clean.
> **Still needs a live-DB/browser check** (not machine-verifiable here): (a) pending-academy admin sees the message on login; (b) refresh after → login screen, not blank; (c) suspend-after-login + refresh → dropped to login.

**Files:** `components/layout/AppShell/useAppShell.ts:88–91`; `components/auth/LoginPage/useLoginPage.ts:56–66`

**DECISION: Block at login with a message** (resolved 2026-06-09).

> **Correction from audit:** the login-time message **already exists.** `useLoginPage.ts:59–66` already blocks a no-active-academy login and shows "Your academy application is pending approval…" (and distinguishes pending vs. zero-academy → "Contact support."). That half is done.

The actual bug: `signIn()` sets the Supabase **session cookie even when we block at the app layer.** So after a blocked login — or if an academy is suspended *after* a successful login — a page refresh runs `useAppShell` (lines 88–91), finds an authenticated user with no active academy, returns early without `setLoggedIn(true)`, and `AppShell` renders `null` → blank screen. The blank screen is a **session-restore** path, not a fresh-login path.

**Fix approach (clear the lingering session in both spots — no new screen needed):**
1. `useLoginPage.handleLogin`, the `active.length === 0` branch (lines 59–66): after setting the message, call `signOut()` so no session cookie lingers. The message persists in local `loginError` state and shows on the login screen. **Note: `useLoginPage.ts:3` imports only `{ signIn, resetPassword }` — add `signOut` to that import.**
2. `useAppShell`, the `academies.length === 0` branch (lines 88–91): replace the bare early return with `await signOut()` then `setIsCheckingAuth(false)` (leave `loggedIn` false). This drops the user back to the LoginPage instead of a blank screen, covering the suspended-after-login and stale-session cases.

**Net effect:** pending/zero-academy users always land on the login screen with the existing explanatory message; the blank screen is eliminated. Smaller change than originally scoped (no in-app status screen to build).

### B4 — No error boundaries ✅ DONE (2026-06-12)
> Executed: added `app/error.tsx` (client, "Try again" reset) and `app/not-found.tsx` ("Back to portal"), styled with `--sp-*` tokens. Build registers `/_not-found`.

`academy/app/` missing `error.tsx`, `not-found.tsx`. Same shared fix.

---

## IMPORTANT (fix at launch or shortly after)

### I1 — Offering active-toggle has no error rollback
**File:** `components/offerings/OfferingsPage/OfferingsPage.tsx:73–78`. Optimistic update only commits on success but never reverts or notifies on failure. Add revert + `toast.error`.

### I2 — Booking approve/reject concurrency
**File:** `useAppShell.ts:164–179`. If another admin/tab already changed the booking, the action errors and silently reverts to "pending" with no explanation. Add an error toast ("This booking was already updated — refreshing") and ideally refetch that row from DB on conflict.

### I5 — Document viewing (NEW — created by learner B3 decision, 2026-06-12)  ⬜ TODO
**Phase 2 of the uploads feature.** Learner B3 was resolved as "wire uploads for real," which captures booking documents into a private `booking-documents` bucket (backbone I1). The academy currently has **no UI to view them** — until this ships, uploaded docs are write-only/invisible.
**Scope:** add a document list/preview to the academy booking detail; read via Storage RLS (academy-admin reads their academy's objects) + `booking_documents` rows. Fast-follow after learner B3 Phase 1.
**Coupling:** learner B3 ⟷ backbone I1 ⟷ this.

### I3 — Registration notification failure only `console.error`
**File:** `register/route.ts:138–140`. If the notification insert fails, command admins never learn a new academy is pending → approval stalls indefinitely. Acceptable to log for MVP, but note it; a retry or fallback is post-MVP.

### I4 — Password reset depends on SMTP
Same shared dependency as command B2 / learner. `handleForgot` sends via Supabase; without SMTP configured it silently does nothing. Verified once infra is set up (tracked in shared plan). Confirm there's a reset-redeem landing experience (Supabase-hosted is acceptable for MVP).

---

## DECIDED — Settings page cleanup (2026-06-09) ✅ DONE (2026-06-12)
> Executed: `SettingsPage.tsx` rewritten — removed the 4 mock notification toggles, dead `SCHOOL_INFO`, and unused `Building2`/`Bell` imports; kept the Appearance/Dark Mode card. No stray references; build clean.

**DECISION: Strip the mock toggles.** No per-user notification-preferences table exists; wiring them would be schema work, deferred post-MVP.
**File:** `components/settings/SettingsPage/SettingsPage.tsx`
- Remove the 4 non-functional `NOTIF_SETTINGS` toggles (lines 13–18, 26–42) — the whole "Notification Settings" card.
- Remove the dead `SCHOOL_INFO` const (lines 6–11).
- Keep the working "Appearance" / Dark Mode card.
- Remove now-unused imports. `SettingsPage.tsx:3` imports `{ Building2, Bell }`; `Building2` already appears unused, and `Bell` becomes unused once the notification card is removed — drop both and confirm with a build.

---

## DEFERRED / COSMETIC (accepted for MVP)

- **Packages page** — `@ts-nocheck`, empty data, dead buttons. Already removed from nav (Sidebar:22 commented). Safe.
- **Wallet page** — ✖ MOOT (verified 2026-06-12): academy has **no wallet** — no `PageId`, no nav entry, no component, zero references. The "hide from nav" task doesn't apply; nothing to do. (Wallet appears in the architecture docs as a *planned* feature only.)
- **Calendar page** — mock data overlay. **KEEP in nav** (decided 2026-06-09 — building on it later); already present at `Sidebar.tsx:21`, no action. Mock overlay stays for now; revisit when wiring to real schedules/bookings.
- **BookingTrendsCard** — `MOCK_BOOKINGS` fallback with Apr–May 2026 dates (now past, so chart is empty until real bookings). Honest enough; "sample data" label optional.
- **Favicon** not referenced in metadata — add link.

---

## Proposed Execution Order
1. ✅ B1 (de-brand Alpha Laguna: title + sidebar) + Settings cleanup — DONE 2026-06-12
2. ✅ B4 (error boundaries) — DONE 2026-06-12
3. ✅ B3 (session cleanup so no blank screen) — DONE 2026-06-12 (runtime check pending)
4. ✅ B2 (register validation — route layer) — DONE 2026-06-12. DB backstop (backbone B3) still gated. — **batch with backbone B3 + command I1, not here**
5. I1 + I2 (optimistic error handling) — same pattern, do together
6. ~~Hide wallet from nav~~ (moot — no wallet exists); KEEP calendar (no action) + favicon (cosmetic)

**Remaining in this app:** B2 (coupled batch), I1, I2, I3 (note-only), I4 (SMTP-gated), I5 (document viewing — Phase 2 of learner B3), favicon. B3 needs a runtime check.

## Verification
- B1: grep the whole app for "Alpha Laguna" / "alpha-laguna" → zero hardcoded hits; tab title generic.
- Settings: page renders only the Appearance card; no notification toggles; no unused imports (build clean).
- B3: (a) log in as a pending-academy admin → see the "pending approval" message on login; (b) after that, refresh the page → returns to login screen, NOT a blank screen; (c) suspend an academy of a logged-in admin, refresh → dropped to login, not blank.
- B2: curl the register route with a malformed email / 3-char password → rejected.
- Build: `npm run build` (currently passing).
