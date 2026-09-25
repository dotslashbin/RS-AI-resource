# Vendor password recovery: cross-browser callback investigation handoff

**Date:** 2026-09-25
**App / scope:** `vendor/` Next.js web app only — self-service password-recovery link handling.
**Status:** DRAFT — investigation complete; implementation is deliberately not planned or started here.

> One-line framing: a Vendor user who opens a self-service password-reset email in a browser context different from the one that requested it lands on the ordinary sign-in screen instead of the set-new-password screen. Optimise for a secure, intelligible recovery flow that works in the supported email-opening contexts.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local.

---

## Scope and non-scope

- **In scope:** Vendor's self-service **Forgot password** request, email callback, session creation, recovery-mode routing, and user-facing failure state.
- **Not in scope:** Command-created-account links, Booker, Command, Expo apps, database schema/RLS, migrations, dependency installation, or changing Supabase Auth configuration without an explicit decision.
- **Migration assessment:** none expected. This is a browser authentication/callback-flow defect; no table, policy, function, or type change is indicated.

## Confirmed behaviour and root cause

1. Vendor requests the email using `resetPasswordForEmail()` from the browser ([`vendor/services/auth.service.ts:16-20`](../vendor/services/auth.service.ts)).
2. Vendor creates its browser client with `@supabase/ssr` ([`vendor/lib/supabase/client.ts:22-26`](../vendor/lib/supabase/client.ts)). Although that source passes `flowType: "implicit"`, the installed `createBrowserClient` overrides it to `flowType: "pkce"` ([`vendor/node_modules/@supabase/ssr/dist/module/createBrowserClient.js:37`](../vendor/node_modules/@supabase/ssr/dist/module/createBrowserClient.js)).
3. A PKCE reset link returns with a `?code=` query parameter. Its exchange requires the code verifier stored in the browser that initiated the request. The installed auth client classifies the URL as a PKCE callback only when **both** `params.code` and the stored verifier exist ([`vendor/node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:3131-3134`](../vendor/node_modules/@supabase/auth-js/dist/main/GoTrueClient.js)). It explicitly fails an exchange without the verifier ([`GoTrueClient.js:1468-1480`](../vendor/node_modules/@supabase/auth-js/dist/main/GoTrueClient.js)).
4. Opening the email in a different browser, browser profile, mobile email in-app browser, or after browser-site-data removal therefore has no verifier. The URL is not handled as an auth callback, no recovery session or `PASSWORD_RECOVERY` event is made, and the app falls through to its normal login view.
5. Vendor's own recovery latch only recognises an implicit-flow `#...type=recovery` fragment or a recovery event ([`vendor/lib/supabase/client.ts:54-65`](../vendor/lib/supabase/client.ts)). It has no branch to identify a `?code=` callback whose verifier is absent.
6. `useAppShell` consequently does not set `recoveryMode` ([`vendor/components/layout/AppShell/useAppShell.ts:286-299`](../vendor/components/layout/AppShell/useAppShell.ts)); `AppShell` then renders normal `LoginPage` ([`vendor/components/layout/AppShell/AppShell.tsx:136-160`](../vendor/components/layout/AppShell/AppShell.tsx)). This exactly explains the reported symptom.

### Important distinction

The Vendor source already contains special handling for **implicit** recovery links carrying tokens in a URL fragment ([`vendor/lib/supabase/client.ts:68-139`](../vendor/lib/supabase/client.ts)). That was added for server-created Command links and does not solve a browser-originated PKCE `?code=` link opened where the verifier does not exist.

Existing handling also shows a clear error for rejected implicit links via `authHashError.ts`; this defect is different: the unprocessable PKCE URL silently becomes an ordinary login visit.

## Reproduction to validate before selecting a fix

1. In browser/profile A, open Vendor, choose **Forgot password**, and request a reset for a test Vendor account.
2. Open the received email URL in browser/profile B (or a phone email app's browser) rather than A.
3. Expected current result: URL contains `?code=...`; Vendor renders its ordinary sign-in screen rather than **Set a new password**.
4. Open a freshly requested email URL in the same browser/profile A. Expected current result: recovery session is established and the reset form appears.

Do not paste a live reset URL, access token, refresh token, or code into issues, commits, test fixtures, logs, or chat. They are bearer credentials.

## BLOCKERS

### B1 — Select and implement a supported cross-browser recovery design  ⬜ TODO

**Primary files to investigate:** `vendor/services/auth.service.ts:16-20`, `vendor/lib/supabase/client.ts:22-139`, `vendor/components/layout/AppShell/useAppShell.ts:204-210,286-299`, `vendor/components/auth/LoginPage/useLoginPage.ts:356-365`.

**Risk:** A routine email-opening pattern produces a dead-end login screen. The user cannot tell whether to retry, switch device, or contact support.

**Planning requirement:** First confirm the actual clicked URL shape (`?code=...` versus `#access_token=...&type=recovery`) without retaining its secret values. If it is the PKCE shape, choose a flow that can establish a recovery session without relying on requester-browser storage. The planner must verify the selected approach against the installed Supabase/Auth version and current official Supabase documentation before proposing code.

**Likely solution directions to evaluate (do not silently choose one):**

- A dedicated, server-side auth callback that exchanges a recovery `token_hash`/OTP and redirects to a Vendor reset route with a safe session hand-off.
- A supported implicit recovery-link design, if it can be configured without weakening the recovery security model or breaking existing server-created implicit links.
- Retain PKCE for same-browser completion but explicitly detect a missing verifier and show actionable recovery guidance. This improves the symptom but does **not** make cross-browser reset succeed, so it is acceptable only if product policy deliberately limits recovery to the requesting browser.

The first two may require a Supabase email-template or Auth URL-configuration change. Those are configuration/security decisions, not migrations, and must be documented and approved before execution.

**Component convention:** Reuse the existing `LoginPage`/`useLoginPage` render-hook split if the reset UI remains there. Any new interactive component requires its companion hook and co-located styling per project rules.

**Verification:** automated coverage for URL classification and callback/error routing; then live Supabase tests in same-browser and different-browser contexts, including mobile email-app opening where supported.

### B2 — Never silently degrade an unprocessable recovery callback to login  ⬜ TODO

**Primary files:** `vendor/lib/supabase/client.ts:54-65,141-178`; `vendor/components/auth/LoginPage/useLoginPage.ts`; `vendor/components/auth/LoginPage/LoginPage.tsx:225-259`.

**Risk:** Even if cross-browser recovery is intentionally unsupported, current UX falsely resembles an ordinary login visit.

**Fix direction:** Add a narrowly scoped, non-secret user-facing message when a recovery callback cannot create a session, with a clear next action. Do not expose raw codes/tokens or claim a link is expired unless Supabase actually reports expiry.

**Verification:** unit test the pure URL/error classifier where practical; browser test that a missing-verifier callback shows the intended guidance and that successful recovery is not misclassified.

## Decisions the planner must resolve before execution

- **OPEN — Product requirement:** Must a user be able to request reset on one device/browser and set the password on another? **Recommendation: yes.** Recovery emails are routinely opened in mobile mail apps, so same-browser-only behaviour is a poor fit for a public Vendor portal.
- **OPEN — Auth design:** Which supported Supabase recovery mechanism is appropriate for cross-browser use with the installed versions and deployed email templates? Evaluate the alternatives in B1; record the security properties and exact deployment/configuration changes.
- **OPEN — Scope:** Is an actionable fallback message sufficient for the current release if the robust cross-browser solution needs Supabase configuration changes? If yes, make it an explicit staged delivery decision, not an accidental partial fix.

No implementation stage may begin while these decisions are open.

## Existing related work

- [`2026-08-10-auth-recovery-link-silent-failure.md`](2026-08-10-auth-recovery-link-silent-failure.md) fixed visibility for rejected **implicit** links (`#error=...`) across Vendor, Booker, and Command. Do not treat it as proof that a PKCE `?code=` callback works cross-browser.
- [`2026-08-10-recovery-gate-escape-and-settings-password.md`](2026-08-10-recovery-gate-escape-and-settings-password.md) added the session-storage recovery latch and the existing password-setting UI. Preserve its anti-bypass intent: recovery mode must not accidentally admit a user into the dashboard before they set a password.

## Suggested execution order for the future implementation plan

1. Capture the non-secret callback shape and reproduce in same vs. different browser contexts.
2. Resolve the three open decisions and obtain approval for any Auth/email-template configuration or security-flow change.
3. Implement B1 within `vendor/` only; keep session/callback logic separate from rendering.
4. Implement B2 as part of the same delivery if B1 cannot make every callback succeed.
5. Add/adjust focused tests, run Vendor type-check and existing test suite, then conduct real Supabase email round-trips.
6. Verify that Command-created implicit links still work only if the changed Vendor client code shares that path; do not modify Command unless a later investigation proves it is necessary.

## Required verification matrix

| Scenario | Expected outcome |
|---|---|
| Reset requested and opened in same browser/profile | Reset form appears; password update succeeds; session is cleared/requires fresh sign-in afterwards. |
| Reset requested in browser A, opened in browser/profile B | Supported cross-browser flow reaches reset form; otherwise clearly explains the limitation and safe next step. |
| Expired/already-used link | Actionable error; never a silent ordinary login screen. |
| Refresh while on reset form | Existing recovery gate remains intact; no dashboard bypass. |
| Cancel reset | Existing sign-out/clean-origin behaviour remains intact. |
| Normal sign-in and existing implicit recovery link | No regression. |

## Handoff constraints

- No Supabase migration is needed for the identified defect.
- No new dependency is expected; installation is an approval gate if later proposed.
- Treat Supabase Auth email templates, redirect allow-list, and callback behaviour as security-sensitive configuration. Do not change them until the exact effect and rollback path are reviewed.
- Do not log or preserve live auth query/hash values during testing.
