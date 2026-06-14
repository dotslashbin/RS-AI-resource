# Production Readiness — Command Portal

**Date:** 2026-06-09
**App:** `./command`
**Status:** DRAFT — for fine-tuning, not yet approved for execution

> Command is an internal ops tool for a handful of staff. The bar is "no privilege holes, no silent data loss" — not polish.

> **Legend:** B# = Blocker, I# = Important. **These numbers are plan-local** — command I1 is *not* the same as academy I1 or backbone I1. Always qualify cross-plan references by app (e.g. "command I1", "backbone B3").

---

## BLOCKERS (must fix before launch)

### B1 — `/api/users` has no caller authorization ⚠️ TOP PRIORITY  ✅ DONE (2026-06-12)
> Executed: added a server-side `verifyCaller()` (cookie-bound SSR client → `auth.getUser()` + active status + `command` portal + `admin`/`root` role, mirroring `verifyCommandAccess`). Both POST and DELETE now `403` if it fails, *before* `createAdminClient()` is touched. Bonus: DELETE blocks self-deletion (`id === caller.id` → 400). `server.ts` already existed. Build + TypeScript clean.
> **Open follow-up (not done):** last-root deletion guard — recommended but deferred; needs a root-count query. Self-deletion guard covers the most common lockout.
> **Still needs a live check:** DELETE/POST with no cookie → 403; non-admin learner session → 403; admin → 200.

**File:** `command/app/api/users/route.ts` (POST lines 4–41, DELETE lines 43–52)

Both handlers instantiate the **service-role** admin client with zero auth check. Anyone who learns the deployed URL can `POST /api/users` to mint an admin account or `DELETE /api/users?id=<uuid>` to remove any user — including the only root.

**Fix approach:**
1. Add a `verifyCaller()` helper that uses the **cookie-aware SSR client** (`lib/supabase/server.ts`) to call `auth.getUser()`, then checks active status + `command` portal + `admin`/`root` role (mirror `verifyCommandAccess`, server-side).
2. Gate both POST and DELETE: return `403` if `verifyCaller()` fails, *before* `createAdminClient()` is touched.

**Decision point:** Does `lib/supabase/server.ts` exist in command, or only the browser client? If missing, we create it (standard `@supabase/ssr` server client). — *confirm during execution.*

**Open question:** Should DELETE also block self-deletion (admin removing their own account) and last-root deletion? Recommend yes — cheap guard, prevents lockout.

---

### B2 — Auth email delivery (SMTP) — shared launch dependency
**Not a code file — Supabase project config.**

New users are created with `email_confirm: true` and **no password**; they must use "Forgot Password" to set one. Supabase's built-in email sender is dev-only (~2–4/hr, not for production). Without custom SMTP, **every invited user is locked out and password reset is dead** — in all three portals.

**Fix approach:** Configure Supabase Auth → SMTP to use Resend (the provider already planned). Customize the invite/reset email templates. Test end-to-end: create user in command → receive email → set password → log in.

**Cross-app:** This unblocks command invites, academy password reset, and learner password reset simultaneously. Track once, here.

---

### B3 — No error boundaries
**Files:** `command/app/` missing `error.tsx` and `not-found.tsx`

A render-time throw shows the raw Next.js error overlay. Add a branded `error.tsx` (with reset button) and `not-found.tsx`. ~Same component in all three apps; copy-by-intent.

---

## IMPORTANT (fix at launch or shortly after)

### I1 — Mutations swallow errors
**Files:** `hooks/mutations/{schools,users}/*.ts` — create/update/delete

None check the Supabase response. On failure the optimistic UI already removed/changed the row, so the user sees success while the DB rejected it; the lie surfaces only on refresh. Wrap each in error handling: revert optimistic state + `toast.error()` on failure. (`<Toaster />` is now mounted, so toasts will actually show.)

> **⚠️ Coupling — promote to same batch as backbone B3.** The drafted `academies` non-empty CHECK migration (backbone plan **B3**) makes a blank `name`/`lto_accred_no` from the Command SchoolFormModal raise Postgres `23514`. With I1 unfixed, that insert appears to succeed optimistically then silently never persists — i.e. the constraint makes school-create *worse* until I1 surfaces the error. If backbone B3 ships, **I1 (at least the schools-create/update path) must ship with it.** Effectively raises this slice of I1 to blocker priority, conditional on B3.

### I2 — No loading/disabled state on form submit
Rapid double-click on Invite/Save fires duplicate requests. Add `isSubmitting` state, disable the button while in flight.

### I3 — School delete goes direct from browser
**File:** `hooks/mutations/schools/useDeleteSchool.ts:6`

Deletes `academies` straight from the client with the anon key, relying entirely on RLS being correct. Lower risk than B1 (RLS *does* gate it), but given the blast radius (cascades to offerings/instructors/schedules), consider routing through a server handler with the same `verifyCaller()` gate. **Decision point:** server route now, or accept RLS-only for MVP?

---

## DEFERRED / COSMETIC (accepted for MVP)

- **Transactions page** — 100% mock (`ALL_TXNS`). Blocked on `wallet_transactions` table not existing. Keep, but it's honestly labelled dev data.
- **KPI sparklines + booking/school trends + wallet balances** — seeded constants; only school count is live. **Recommend:** add a small "sample data" badge to these cards so internal staff aren't misled. Cheap, honest.
- **Unused import** `Dispatch, SetStateAction` in `useAppShell.ts` — remove during B3 pass.
- **Metadata** — title "RS Command" is fine for internal tool; add favicon link if trivial.
- **Suspended-user rejection** has no detailed explanation — acceptable.
- **`page` state is an untyped `string`** (`useAppShell.ts:23` — `useState("overview")`), unlike learner/academy which use a typed `PageId` union. This is why `AppShell.tsx:78` needs a catch-all fallback. Minor latent footgun: a typo'd `onNavigate("setting")` silently falls through to the overview fallback instead of failing at compile time. Low priority — tighten to a `PageId` union when convenient. (Noted 2026-06-12.)

---

## Proposed Execution Order
1. ✅ B1 (`/api/users` gate) — DONE 2026-06-12 (runtime check pending; last-root guard deferred)
2. B3 (error boundaries) — mechanical, shared across apps
3. I1 + I2 (mutation error handling + loading states) — same files, do together
4. I3 decision → maybe server route
5. KPI "sample data" badges
6. B2 (SMTP) — tracked in shared/backbone plan; verified once infra exists

## Verification
- B1: hit DELETE/POST with no session cookie → expect 403; with a non-admin learner session → 403; with admin → 200.
- I1: simulate a failing mutation (e.g. duplicate email) → row reverts, toast shows.
- Build: `npm run build` (currently passing).
