# Production Readiness — Learner Portal (DriveBook)

**Date:** 2026-06-09
**App:** `./learner`
**Status:** IN PROGRESS — B1, B2, B4, I1–I4, I6 executed (2026-06-12, build-verified). B3 (uploads) pending approval; I5 is a deployment-env item.

> Public-facing, handles real money via PayMongo. The bar is higher here than the internal tools — payment integrity and not lying to users are the themes.

> **Legend:** B# = Blocker, I# = Important. **These numbers are plan-local** — learner I1 is *not* the same as command I1 or backbone I1. Always qualify cross-plan references by app (e.g. "command I1", "backbone B3").

---

## BLOCKERS (must fix before launch)

### B1 — `/api/payment/create-session` trusts client-supplied price ⚠️ TOP PRIORITY  ✅ DONE (2026-06-12)
> Executed: route now authenticates via the SSR client (`auth.getUser()` → 401), fetches the booking with the service-role client, verifies `booking.learner_id === user.id` (404/403), and **derives `amountCentavos` from `booking.price_paid`** — `amountCentavos`/`description` are no longer read from the body (description built server-side from the offering). Build + TypeScript clean. Client still sends the old fields; server ignores them (backward-compatible).
> **Still needs a live check:** curl with tampered amount / no session / another user's booking (needs a running env). Logic verified by build only.

**File:** `learner/app/api/payment/create-session/route.ts:4–9`

The route takes `bookingId` **and `amountCentavos`** from the request body, with no authentication. Two exploits:
- **Underpayment:** change `amountCentavos` 120000 → 100, pay ₱1. The webhook still flips `is_paid = true` (it only matches `booking_id`, never checks amount).
- **Unauthenticated use:** anyone can open checkout sessions against any booking id.

**Fix approach:**
1. Authenticate: SSR client `auth.getUser()` → 401 if none.
2. Fetch the booking server-side by `bookingId`; 404 if missing.
3. Verify `booking.learner_id === user.id` → 403 otherwise.
4. **Derive the amount from the DB**: `amountCentavos = Math.round(booking.price_paid * 100)`. Never read it from the client.
5. Stop accepting `amountCentavos`/`description` from the body.

**Pairs with backbone B1** (DB `CHECK` that `is_paid` requires a `payment_reference`) — defence in depth.

### B2 — Settings page shows fabricated account data  ✅ DONE (2026-06-12)
> Executed: added `useSettingsPage.ts` (fetches session user + `profiles.phone`); `SettingsPage.tsx` now shows real Full Name / Email / Phone read-only with loading + "Not set" states. Removed the dead Edit buttons, the bogus "LTO Client ID" field, and the entire Notifications card. Kept Appearance/Dark Mode. Build clean.
> **Still needs a live check:** real values render for a logged-in user (build can't confirm session data).

**File:** `components/settings/SettingsPage/SettingsPage.tsx:5–56`

Hardcoded "Juan Dela Cruz / juan@email.com / +63 912… / LTO-2024-001234", dead Edit buttons, dead notification toggles. A real user sees a stranger's identity.

**DECISION: Wire name + email + phone (read-only); strip the rest** (resolved 2026-06-12).

**Fix approach:**
- **Full Name** ← `currentUser.user_metadata.full_name`; **Email** ← `currentUser.email` (both already in the session via `useAppShell`).
- **Phone** ← fetch `profiles.phone` for the current user (one extra query; column exists since migration `20260515000003`). Add a small profile fetch in the settings hook (`SettingsPage` currently has no companion hook — add `useSettingsPage.ts` to own the fetch, per the component-hook rule).
- **Remove:** the dead Edit buttons, the bogus "LTO Client ID" field (not a column we collect), and the entire Notifications card (4 mock toggles — no per-user prefs table; same call as academy settings).
- **Keep:** the working Appearance / Dark Mode card.
- All fields read-only for MVP (no profile editing).

### B3 — Document uploads are silently fake  ⬜ TODO — multi-app feature
**Files:** `components/booking/steps/Step4Documents/*`, `useBookingWizard.ts:42,115–120,131`

Users pick files, see progress bars, believe documents were submitted. `handleUpload` (line 116) stores only `{name, size}` — the `File` content is discarded; nothing reaches Storage or `booking_documents`. Academy also has no viewing UI. Biggest trust risk in the app.

**DECISION: Wire uploads for real** (resolved 2026-06-12). This is a **multi-app feature**, not a learner-only fix — phased so Phase 1 is shippable alone.

**Phase 1 — capture & store (learner + backbone):**
1. **Backbone (approval gate):** create a **private** Storage bucket (e.g. `booking-documents`) + Storage RLS — learner reads/writes own booking's path, academy-admin reads their academy's, command reads all. ⟶ this is **backbone I1**, now promoted from conditional to **required**.
2. **Learner wizard state:** change `UploadEntry` to retain the actual `File` (currently `{name, size}` only — `useBookingWizard.ts:42,116`).
3. **Learner upload sequencing:** in `confirmBooking` (line 131), after `createBooking` returns the id and *before* the PayMongo redirect, upload each file to `booking-documents/{booking_id}/{doc_id}` and insert `booking_documents` rows. Handle upload failure (booking exists but docs failed — surface a retry path, don't silently proceed).
4. Client-side validation already advertised in the UI (JPG/PNG/PDF, 5 MB) — enforce it for real before upload.

**Phase 2 — view (academy, fast-follow):** new academy document-viewing screen on the booking detail. ⟶ tracked as **academy "Document viewing"** (new item). Until Phase 2 ships, docs are captured but not viewable.

**Approval gates:** Storage bucket + RLS policies (Phase 1, backbone). Get explicit go-ahead before creating them.

**Coupling:** learner B3 ⟷ backbone I1 (bucket + RLS, required) ⟷ academy "Document viewing" (Phase 2).

### B4 — No error boundaries  ✅ DONE (2026-06-12)
> Executed: added `app/error.tsx` (client, "Try again" reset) and `app/not-found.tsx` ("Back to DriveBook"), styled with `--db-*` tokens. Build registers `/_not-found`. Note: learner is an SPA, so `not-found.tsx` mainly guards hand-typed URLs; `error.tsx` is the one that catches live render crashes. Both added for parity.

**Files:** `learner/app/` missing `error.tsx`, `not-found.tsx`. Same fix as other apps.

---

## IMPORTANT (fix at launch or shortly after)

### I1 — `checkout_url` not validated before redirect  ✅ DONE (2026-06-12)
> Executed: `useBookingWizard.confirmBooking` now types `checkout_url` as optional and guards — missing url → `toast.error` + abort (no `window.location.href = undefined`). Also trimmed the request body to `{ bookingId }` (server ignores the old `amountCentavos`/`description`). Build clean.

### I2 — Payment success/cancel redirect is spoofable  ✅ DONE (2026-06-12)
> Executed: `useAppShell` success branch now reads `booking_id` and confirms ownership via an RLS-scoped `bookings` select (`maybeSingle`) before showing the success toast — a spoofed/foreign id returns nothing and stays silent. Cancel branch left as-is (low stakes). Build clean. *(Runtime check: needs a live session to confirm the owned-vs-spoofed paths.)*

### I3 — Webhook silently drops events missing `booking_id`  ✅ DONE (2026-06-12)
> Executed: `webhook/route.ts` now `console.warn`s when a paid-type event arrives with no `booking_id` instead of dropping it silently.

### I4 — Duplicate `payment_confirmed` notifications on webhook replay  ✅ DONE (2026-06-12)
> Executed: the `is_paid` update is now `.eq("is_paid", false).select("id")`; if nothing transitioned (replay → already paid), the route returns early and skips the notification. Genuinely idempotent now.

### I6 — Register route input validation (parallel to academy B2)  ✅ DONE (2026-06-12)
> Executed: after the existing presence checks, the route now normalizes (`trim`) name/email/phone, validates email format (`/^\S+@\S+\.\S+$/`) and phone (PH-lenient: `+`/digits/spaces/`()-`, 7–15 digits), and uses the cleaned values in `createUser`, the profile update, and the notification. Password strength left to GoTrue. Build clean. Shared validation shape matches academy B2.
**File:** `learner/app/api/register/route.ts:16–24`

Public + service-role route (the analogous risk surface to academy B2; **not** a caller-gate case — self-registration is meant to be anonymous). Verified 2026-06-12: learner register is the *least bad* of the validation surfaces — it already does typed + trimmed presence checks and leans on Supabase Auth (GoTrue) for email-format + password-length (same as academy B1's finding). Remaining small gaps:
- No `email`-format pre-check before the GoTrue call (GoTrue rejects it, but the error message is less friendly).
- `phone` accepts any non-empty string — no format validation.

**Fix approach:** add a light email-format check + basic phone sanity before the `createUser` call; trim is already done. Mirror whatever shape academy B2 lands on. Low severity — track so the parallel with academy B2 isn't lost.
**Coupling:** sibling of academy B2 (both are "validate public service-role register routes"). The caller-gate pattern (command B1 / learner B1) does **not** apply here.

### I5 — `NEXT_PUBLIC_APP_URL` fallback is `localhost:3000`  ⬜ TODO (deployment env, not code)
**File:** `create-session/route.ts:14`. If unset in prod, PayMongo redirect URLs point at localhost. Ensure it's set in Vercel env (deployment checklist), not a code fix.

---

## DEFERRED / COSMETIC

- Wallet page — static ₱0.00 placeholder. Hide from nav for MVP, or label clearly.
- `viewport` export missing in `layout.tsx` — add (mobile polish).
- `robots.txt` — add a disallow-all (portal shouldn't be indexed).
- `payment.failed` event unhandled — post-MVP nicety.
- Session-expiry warning UI — post-MVP.

---

## Proposed Execution Order
1. ✅ B1 (create-session auth + server-side price) — DONE 2026-06-12 (runtime check pending)
2. ✅ B4 (error boundaries) — DONE 2026-06-12
3. ✅ B2 (wire name+email+phone, strip the rest) — DONE 2026-06-12 (runtime check pending)
4. ✅ I1–I4 (payment hardening) — DONE 2026-06-12 (I2 runtime check pending)
5. `viewport` + `robots` polish  *(wallet hide — verify a wallet nav entry exists first; may be moot like academy)*
6. **B3 Phase 1** (uploads: backbone bucket+RLS → learner upload) — approval-gated; backbone I1 ships with it
7. **B3 Phase 2** (academy document-viewing) — fast-follow, tracked in academy plan

**Remaining in this app:** B4, I1–I4 (decision-free, independent), B3 (approval-gated multi-app), polish.

> B1–B2, B4, I1–I5 are independent and safe to do without the uploads feature. B3 is the large coupled batch — sequence it after the quick wins.

## Verification
- B1: tamper `amountCentavos` via curl → server ignores it, charges DB price; unauthenticated call → 401; other user's booking → 403.
- B2: settings shows the logged-in user's real name/email/phone; no Edit buttons, no LTO field, no notification toggles; build clean. (Phone value needs a live session to confirm.)
- B3 Phase 1: a booked exam's files land in the private `booking-documents` bucket + `booking_documents` rows; another learner cannot read them (Storage RLS); upload failure surfaces a retry, not a silent pass.
- B3 Phase 2: academy can view a booking's documents; a different academy cannot.
- PayMongo sandbox happy-path still completes (test cards in `booking-flow.md`).
- Build: `npm run build` (currently passing).
