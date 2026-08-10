# Password-recovery links fail silently — no error is ever shown

**Date:** 2026-08-10
**App / scope:** `command`, `vendor`, `booker` — password-recovery landing path
**Status:** IN PROGRESS — B1 ✅, I2 ✅ (2026-08-10; I2 closed by the user's live
production test). **I1 and I3 remain — both are dashboard reads only I cannot perform.**

> One-line framing: when Supabase rejects a recovery link, all three portals drop the
> user on a blank login page with no message and no next step. Optimize for *the user
> always learning why and what to do*, with the smallest change that achieves it.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "command I1").

---

## What was actually observed

2026-08-10, production (`pdkejyjidrfxksaczvfy`): root password reset requested from
`https://command.ezzy.ph`. The email arrived. Clicking the link landed on Command but
showed the **ordinary login form**, not the set-new-password form.

## Root cause — confirmed by probe, not inferred

A read-only probe against the live GoTrue with a deliberately invalid token:

```
GET https://pdkejyjidrfxksaczvfy.supabase.co/auth/v1/verify
      ?token=deadbeefdeadbeef&type=recovery&redirect_to=https%3A%2F%2Fcommand.ezzy.ph

HTTP/2 303
location: https://command.ezzy.ph#error=access_denied
          &error_code=otp_expired
          &error_description=Email+link+is+invalid+or+has+expired&sb=
```

**When a recovery link is rejected, the hash contains `error=…` and NOT `type=recovery`.**

Trace that through the app (identical code in all three portals):

| Step | Evidence |
|---|---|
| Recovery is detected *only* by the literal string `type=recovery` | `command/lib/supabase/client.ts:17-18` |
| An error hash has no `type=recovery`, so `recoveryDetected` stays `false` | probe output above |
| `PASSWORD_RECOVERY` never fires either — no session was created, so there is no event | `client.ts:20-24`, `useAppShell.ts:61-67` |
| `recoveryMode` therefore stays `false` | `useAppShell.ts:25,62,64` |
| `AppShell` falls through to the plain login branch | `AppShell.tsx:37-41` |
| Nothing anywhere reads `error`, `error_code`, or `error_description` | `grep` across `app/ components/ lib/ services/` in all three apps → **0 hits** |

The user sees a normal login page. No banner, no toast, no console message. The
failure is completely invisible — which is why this could not be diagnosed from the
symptom alone.

### Corrections to initial hypotheses

- **"Site URL is misconfigured"** — *false alarm.* The probe's fallback target was
  `https://command.ezzy.ph`, which proves Site URL is set correctly.
- **"The redirect allow-list is wrong"** — *not established either way.* With an
  invalid token GoTrue errors before evaluating `redirect_to`, so both the
  allow-listed and the deliberately-bogus probe returned the same Location. This
  probe **cannot** test allow-list membership; don't read it as proof.
- **"The app's recovery handling is broken"** — *downgraded.* The success path
  (`#access_token=…&type=recovery` → `recoveryMode` → `initialView="reset"`) is
  correctly wired. Only the *failure* path is unhandled. It remains unverified on
  production because no valid token has been through it yet — see I2.

### Why the link was rejected (secondary, unresolved)

`otp_expired` covers several causes and the probe cannot distinguish them:
link older than the configured OTP expiry; a corporate mail scanner pre-fetching the
URL and consuming the single-use token before the human clicked; or the token already
having been redeemed once. B1 exists precisely so this stops being guesswork — once the
error is displayed, the cause is on screen.

---

## BLOCKERS

### B1 — Auth errors in the URL hash are never surfaced  ✅ DONE (2026-08-10)

> **Executed.** New pure parser `lib/authHashError.ts` in all three apps; read + hash
> rewrite latched at module load in `lib/supabase/client.ts`; `loginError` seeded from
> `getAuthUrlError` in each `useLoginPage.ts`. Two files changed + one added per app.
>
> **Verified — machine:** 7 new unit tests in `vendor/lib/authHashError.test.ts`
> (suite 43 → **50 pass, 0 fail**), including the *verbatim* fragment captured from the
> live probe and a regression test that a **success** fragment is not misread as an
> error. `npx tsc --noEmit` clean in `command`, `vendor` and `booker`.
>
> **Verified — live browser:** Chromium against a throwaway `command` dev server on
> :3199, both fragment shapes —
> error fragment → message rendered **YES**, hash cleared **YES**, stayed on login view
> **YES**; success fragment → not flagged as an error **YES**, reset form reachable
> **YES**. Server stopped afterwards.
>
> **Not covered:** whether a *real* token completes the round-trip on production — that
> is I2, and this browser check does not substitute for it (the success fragment used a
> fake token, which proves routing, not session creation).

**Files:** `lib/supabase/client.ts:17-26`, `components/auth/LoginPage/useLoginPage.ts:17`
(same paths in `command`, `vendor`, `booker`)

Every failure mode of the recovery link — expired, already used, malformed, redirect
rejected — produces a hash the app ignores entirely, so the user is returned to a
login page that behaves as if nothing happened. There is no path to recovery: they
cannot tell whether to retry, wait, or report a bug.

This is a launch blocker for `vendor` specifically. Vendors are external users with no
support channel who will hit expired links routinely, and a silent dead end reads as
"the product is broken".

**Fix approach.** Follow the pattern already established directly above it for
recovery detection — latch at module load, because `detectSessionInUrl` clears the
hash asynchronously before React mounts (the reason is already documented in the
comment at `client.ts:13-16`).

1. In `client.ts`, alongside `recoveryDetected`, read the hash once at module load and
   export `getAuthUrlError(): string | null`.
   - Parse with `URLSearchParams`, **not** string splitting — `error_description`
     encodes spaces as `+`, which only `URLSearchParams` decodes correctly.
   - Map the known code to usable copy: `otp_expired` → *"This password reset link has
     expired or has already been used. Request a new one below."* Fall back to the raw
     `error_description` for anything unmapped, so a novel error is still shown rather
     than swallowed.
   - Clear the hash with `history.replaceState` after reading, so a refresh doesn't
     resurrect a stale error.
2. In `useLoginPage.ts:17`, seed `loginError` from that helper instead of `null`.

**Why this shape and not a new component:** `loginError` is already rendered in every
view (`LoginPage.tsx:156,175,215`) with existing styling. Seeding it reuses the whole
display path — no new component, no new CSS module, no new hook. Component-separation
(`.claude/skills/component-separation/SKILL.md`) is satisfied trivially: no `.tsx`
gains state or logic, and the one new function is a pure reader in an existing lib
module.

**Verification:** machine — unit-test the parser against the exact probe hash above
plus an unmapped code and an empty hash. Live — paste a hash of the probe's form onto
the deployed origin and confirm the message renders and the hash is cleared.

---

## IMPORTANT

### I1 — Confirm the redirect allow-list, which the probe could not test  ⬜ TODO

**Where:** Supabase Dashboard → Authentication → URL Configuration (`pdkejyjidrfxksaczvfy`)

Site URL is confirmed correct. Allow-list membership is **not** — the invalid-token
probe short-circuits before `redirect_to` is evaluated. If `https://command.ezzy.ph`
is absent, a *valid* token would still redirect to Site URL, which happens to be the
same host, so it would work by coincidence today and break the moment Site URL moves.

**Fix approach:** read the allow-list and confirm all six entries are present (three
origins + `/**` variants). Config only, no code.

**Cannot be executed from the CLI (checked 2026-08-10).** `supabase config` exposes only
`push`, no read. ⚠️ And `config push` must **not** be used as a shortcut here: it writes
*local* `config.toml` to the linked project, and `backbone/supabase/config.toml:65` holds
`site_url = "http://localhost:3000"` plus localhost-only redirects — pushing it would
overwrite production's URL configuration with development values.

**Verification:** needs a live environment — visual confirmation in the dashboard.

### I2 — The recovery success path is unverified on production  ✅ DONE (2026-08-10)

> **Verified live, by the user.** A real recovery link was clicked on production and the
> full set-password flow completed. This closes the item's whole purpose: the success
> branch (`client.ts` fragment latch → `useAppShell` → `AppShell.tsx:37-38` → reset form)
> is proven end to end against real Supabase, which no synthetic token could do.
> Confirmed alongside the sticky-latch fix from
> `2026-08-10-recovery-gate-escape-and-settings-password.md` B1.

**Files:** `client.ts:17-18` → `useAppShell.ts:61-67` → `AppShell.tsx:37-38`

The success branch is correctly wired by inspection, but no valid recovery token has
ever completed it against `pdkejyjidrfxksaczvfy`. B1 makes failures visible; it does
not prove success works.

**Fix approach:** after B1 ships, request a fresh reset and click it promptly. Confirm
the set-password form renders, 8-char validation fires, and the post-success
`signOut()` + redirect to a clean origin behaves (`useLoginPage.ts:80-81`).

**Partially advanced by B1 (2026-08-10):** the browser check proved a `type=recovery`
fragment routes to the reset form. It used a **fake** token, so it verifies routing
only — session creation, `updatePassword()` and the sign-out redirect remain untested
against a real token on production. Still ⬜.

**Verification:** needs a live environment. Note B1 must be **deployed** before this
test means anything — the fix is in the working tree, not on `command.ezzy.ph`.

### I3 — Review the OTP expiry window  ⬜ TODO

**Where:** Dashboard → Authentication → (email provider settings)

`otp_expired` is the code returned. If the expiry is at or below the default hour, a
recipient who reads mail on a delay will routinely arrive too late. Worth reading the
current value and deciding deliberately rather than inheriting it.

**Fix approach:** read the setting; raise only if it is unexpectedly short. Config
only. Do not raise it far — a recovery link is a bearer credential.

**Verification:** needs a live environment.

---

## DECISIONS

<!-- No item may execute while any OPEN: line remains — see skill §7. -->

- **Which apps does B1 ship to?** → **All three in one pass** (resolved 2026-08-10) —
  the defect is byte-identical in `command`, `vendor` and `booker`; `vendor` faces
  external users with no support channel and would hit it hardest. This resolution is
  also the AGENTS.md approval gate for a multi-app change.

- **How much error copy?** → **Map `otp_expired` only, fall back to raw
  `error_description`** (resolved 2026-08-10) — it is the one code actually observed;
  pre-mapping unseen codes is speculative error handling per Simplicity First, and the
  verbatim fallback guarantees nothing is swallowed.

No open decisions remain — the plan is clear to execute on approval.

---

## DEFERRED / COSMETIC

- **Mail-scanner pre-fetch hardening.** Moving to the `{{ .TokenHash }}` template plus
  a dedicated verify route would stop link-scanners consuming single-use tokens. It is
  a real risk for vendors on corporate mail, but it changes the email template and adds
  a route in all three apps — far larger than B1, and pointless to design before B1
  tells us whether pre-fetch is actually what is happening here. Revisit if expired
  links recur *after* B1 with users who clicked promptly.

---

## Execution order

1. **I1** — config-only, independent, and rules out an allow-list problem before code
   changes muddy the picture. Do it first because it costs one dashboard page-load.
2. **B1** — after both decisions are resolved. The only code change in this plan.
3. **I2** — immediately after B1 deploys; one email round-trip proves both.
4. **I3** — any time; independent of everything above.

---

## Verification summary

| Item | Machine-verifiable | Needs live environment |
|---|---|---|
| B1 | parser unit tests (`node --test`), type-check, existing suites | rendering the message on the deployed origin |
| I1 | — | dashboard read |
| I2 | — | full email → link → form → new password round-trip |
| I3 | — | dashboard read |

**Not claimable as done without a live run:** I2 is the only item that proves recovery
actually works end to end on production. B1 shipping green does not imply it.
