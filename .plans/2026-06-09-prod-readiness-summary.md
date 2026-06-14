# Production Readiness — Cross-App Summary

**Date:** 2026-06-09
**Scope:** learner, academy, command, backbone
**Status:** Audit complete. Execution in progress (academy + learner blockers landing).

> Index document. Full detail lives in the per-app plans:
> - `.plans/2026-06-09-prod-readiness-command.md`
> - `.plans/2026-06-09-prod-readiness-learner.md`
> - `.plans/2026-06-09-prod-readiness-academy.md`
> - `.plans/2026-06-09-prod-readiness-backbone.md`

---

## Execution progress (as of 2026-06-12)

All items below are build-verified; ⚠️ = still needs a live DB/browser runtime check.

| App | ✅ Done | Notes |
|-----|--------|-------|
| **academy** | B1 (de-brand), B2 (register validation — route layer), B3 (session/blank-screen) ⚠️, B4 (boundaries), Settings cleanup | "Hide wallet" was **moot**. B2's DB backstop (backbone B3) still gated. |
| **learner** | B1 (create-session payment integrity) ⚠️, B2 (settings real data) ⚠️, B4 (boundaries), I1–I4 (payment hardening; I2 ⚠️), I6 (register validation) | architecture `booking-flow.md`/`conventions.md` updated. I5 (`NEXT_PUBLIC_APP_URL`) is a deployment-env item. |
| **command** | B1 (`/api/users` caller auth gate) ⚠️ + self-delete guard | last-root delete guard deferred; B3 (boundaries) + I1/I2 still TODO |
| **backbone** | — | B1 (`is_paid`) ⏸ PARKED; nothing executed |

**Next decision-free candidates:** command B3 (boundaries) + I1/I2 (mutation error handling + loading states). Learner's decision-free items are all done except B3 (uploads, approval-gated) and env/polish. Command B1 (auth gate) ✅ done.

---

## Backbone audit result

**No privilege-escalation blockers.** The DB layer is well-built and verified:
- All 19 tables have RLS enabled.
- All 18 `SECURITY DEFINER` functions pin `search_path` (no search-path injection).
- A learner cannot self-escalate role / portal / academy-membership or self-activate — all trigger-blocked.

The one DB finding worth acting on: the **`is_paid` integrity gap** — the DB does not enforce that a paid booking has a real payment reference. It is the exact DB-side mirror of the learner `create-session` bug, so the two fixes reinforce each other.

---

## Blockers by app

| App | Top blocker | Other blockers |
|---|---|---|
| **command** | `/api/users` — no auth on service-role POST/DELETE (anyone can mint an admin or delete any user) | error boundaries; SMTP (shared) |
| **learner** | `create-session` — client-supplied price + no auth (underpayment + unauthenticated use) | fake settings data; phantom document uploads; error boundaries |
| **academy** | "Alpha Laguna" seeded name hardcoded in tab title / settings / sidebar | register validation (presence-only); zero-academy blank screen; error boundaries |
| **backbone** | `is_paid` not tied to a payment (needs CHECK constraint) | SMTP + full deployment checklist (shared) |

---

## Three cross-cutting threads

1. **SMTP/Resend is a hard launch gate, not a nice-to-have.** Without it, command invites and *all* password resets are dead in every portal. Tracked once in the backbone plan. (Deferred for now per decision.)
2. **The auth-gate pattern repeats.** Command `/api/users` and learner `create-session` are the same fix: read the session cookie server-side, verify identity before touching the service-role client. Learner additionally must price from the DB, never the client.
3. **Error boundaries** (`error.tsx` + `not-found.tsx`) are the same mechanical fix in all three apps.

---

## Corrections made during verification (vs. raw agent reports)

- **False alarm:** agents claimed `.env.local` secrets were committed. They are **not** — `.env*` is gitignored, `git ls-files` shows no env files. No key rotation needed.
- **Downgraded:** the learner webhook "replay" is **not** a payment blocker — re-setting `is_paid = true` is harmless. The only replay effect is **duplicate `payment_confirmed` notifications** (low priority).
- **Obsolete:** the command "Tailwind CDN injector" from the prototype era is gone — a proper Tailwind build pipeline exists.
- **Escalated:** the learner `create-session` price-tampering hole was worse than first reported — it accepts the amount from the client body, enabling ₱1 payments on any-priced booking.

---

## Decision points

### Resolved (2026-06-09)
- **Academy pending-window behaviour** → **Block at login with a message.** Login-time message already exists; real fix is clearing the lingering Supabase session in `useLoginPage.handleLogin` and `useAppShell` so the session-restore path no longer shows a blank screen. (See academy plan B3.) ✅ executed 2026-06-12.
- **Academy settings page** → **Strip the mock toggles** (remove 4 non-functional notification toggles + dead `SCHOOL_INFO` const; keep dark-mode). No schema work. (See academy plan "Settings page cleanup.") ✅ executed 2026-06-12.

### Resolved (2026-06-12)
- **Learner settings page** → **Wire name + email + phone (read-only); strip the rest.** Name/email from session, phone from a `profiles` fetch (new `useSettingsPage.ts`). Remove Edit buttons, bogus LTO field, notification toggles. (Learner B2.)
- **Learner document uploads** → **Wire for real** (multi-app feature, phased). Phase 1 = backbone private bucket + RLS (**backbone I1, now required**) + learner upload code; Phase 2 = **new academy document-viewing screen (academy I5)**. Storage bucket + RLS is an approval gate. This *expands MVP scope across all three apps* — the largest remaining piece. (Learner B3.)

### Still open
1. **`is_paid` enforcement depth** — CHECK constraint alone, or also a column-guard trigger blocking academy-admins from touching `is_paid` / `price_paid`?
2. **Schema changes** (backbone `is_paid` CHECK + trigger NULL guards + the academy non-empty CHECK B3 + the uploads bucket/RLS) need explicit approval before migrations/policies are written.
3. **SMTP + deployment checklist** — deferred for later by request. **Provider decided: Resend** (2026-06-12) as the SMTP provider for Supabase Auth emails. Verified: Resend has **no impact on any recent hardening change** (it's auth-email delivery, configured at the project level; no app-level email code exists). Forward note: future app-level emails from the webhook should sit behind the learner I4 transition guard. (Backbone B2.)

### Cross-plan coupling map (current)
- academy B2 (route validation) ⟷ backbone B3 (academies non-empty CHECK) ⟷ command I1 (mutation error handling) — *one batch; app code before the CHECK migration.*
- learner B3 (upload code) ⟷ backbone I1 (bucket + RLS, required) ⟷ academy I5 (document viewing) — *uploads feature; Phase 1 then Phase 2.*

---

## Build status at time of audit

All three apps produce a clean production build (`npm run build`, exit 0). No compile-level blockers.

---

## Tackle order (agreed)

- Academy decision point **first**.
- SMTP / infra work **deferred** until later.
