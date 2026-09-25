# Vendor password recovery: make self-service reset links work in any browser

**Date:** 2026-09-25
**App / scope:** `vendor/` Next.js web app only — `services/auth.service.ts`, `lib/supabase/`, `lib/authHashError.ts`, `components/auth/LoginPage/useLoginPage.ts`, plus `architecture/` docs. Added 2026-09-25: B3, offering-price truncation, brought in from vendor B1 in `2026-07-22-vendor-code-review-hardening.md` (see B3).
**Status:** COMPLETE (2026-09-25) — **closed by you on 2026-09-25.** All items done: B1, B2, B3, I1, I2, K2, K5. Verified locally (unit, visual, headless live runs). Deployed to staging and production by you, and signed off by you as working in production. Follow-ups F1–F4 and K4 were moved to `vendor-launch-followups` F21–F25 on 2026-09-25.

> Implements the handoff [`2026-09-25-vendor-password-recovery-cross-browser-handoff.md`](2026-09-25-vendor-password-recovery-cross-browser-handoff.md). Goal: a reset requested in one browser can be completed in another, without touching Supabase config or other apps. If a link still can't be used, the user sees why instead of a plain login screen.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision, F# = Follow-up. Numbers are local to this plan. "handoff B1" means the investigation plan.

---

## Handoff review (2026-09-25)

Every cited `file:line` was opened against the installed packages (`@supabase/ssr` 0.10.3, `@supabase/auth-js` 2.105.4).

| Handoff claim | Verdict |
|---|---|
| 1. `resetPasswordForEmail` is called from the browser (`auth.service.ts:16-20`) | ✅ Confirmed |
| 2. `createBrowserClient` forces `flowType: "pkce"` (`createBrowserClient.js:37`) | ✅ Confirmed. `client.ts:4-21` already documents this. |
| 3. A PKCE callback is recognised only when **both** `code` and the stored verifier are present (`GoTrueClient.js:3131-3134`). The exchange fails without the verifier (`:1468-1480`). | ✅ Confirmed |
| 4. In another browser the URL is classified `none`, so no session and no event | ✅ Confirmed (`_initialize`, `GoTrueClient.js:283-333`). It falls through to `_recoverAndRefresh()`. |
| 5. The latch only matches `#…type=recovery` or the event (`client.ts:54-65`) | ✅ Confirmed |
| 6. `recoveryMode` is never set, so `AppShell` renders `LoginPage` | ✅ Confirmed (`useAppShell.ts:286-299`, `AppShell.tsx:136-160`) |

The root cause is correct. The handoff has these gaps and corrections:

- **Escalate the scope of handoff option 1 (token_hash + server callback).** The recovery email template belongs to the whole Supabase project, and five clients use it:
  - Vendor, Booker and Command web Forgot Password (browser PKCE)
  - Command's server onboarding (`command/app/api/users/route.ts:181`, `send-set-password-link/route.ts:58`)
  - `ezzy-vendor-mobile` (a deep link to `/reset-password` that calls `exchangeCodeForSession`)

  Switching the template to `…/auth/confirm?token_hash=…` breaks every client that has no such route. It is **not vendor-only**. It is a cross-app change plus hosted dashboard config (the templates are not in `config.toml`, so staging and prod would each need a hand edit).
- **Missing option: request the link with an implicit-flow client.** The link shape depends on the client that *requests* it. `resetPasswordForEmail` sends a `code_challenge` only when that client is PKCE. A PKCE-free requester makes GoTrue mail `redirectTo#access_token=…&type=recovery`. Vendor already consumes that shape through `readHashTokens` + `setSession` (`client.ts:83-139`), a path that runs in production for every Command-created user. This option is vendor-only, needs no config and adds no dependency. See D2.
- **Omission: the same defect exists elsewhere.**
  - Booker (`booker/services/auth.service.ts:35`) and Command web (`command/services/auth.service.ts:16`) have identical browser PKCE Forgot Password flows.
  - `ezzy-vendor-mobile` is same-device only by design.
  - The handoff is silent on all three. They are recorded as F1–F2, not fixed here.
- **Refinement for handoff B2: there is a clean detection signal.** auth-js deletes `code` from the URL only after a *successful* exchange (`_getSessionFromURL`: `url.searchParams.delete('code')` follows the exchange). So after `client.auth.initialize()` settles, a `code` still in the query string means the callback was not consumed. The two causes can be told apart:
  - missing verifier: `initialize()` returns no error, because the URL was never classified;
  - rejected exchange: an error is returned.
- **Confirmed statically, but still reproduce live:** the URL shape of the Vendor Forgot Password link. The browser PKCE client sends a `code_challenge`, so the link has `?code=`. `architecture/auth-and-roles.md` → "Two link shapes" records the same result from a live test on 2026-08.
- **Official docs checked (supabase.com/docs/guides/auth/passwords, 2026-09-25):**
  - Supabase recommends PKCE with a `token_hash` template and `/auth/confirm` + `verifyOtp` for SSR apps.
  - It notes the `?code=` exchange must finish on the same device.
  - It says the implicit flow is for client-only apps. Vendor's auth *is* client-only: all session and recovery logic runs in the browser client, and `proxy.ts` only refreshes cookies.

## Decisions

<!-- No item in this plan may execute while any OPEN: line below remains. None remain as of 2026-09-25. -->

- **D1 — Product requirement.** → **Yes, cross-browser/device reset must work** (resolved 2026-09-25, user accepted recommendation). Must reset work when the link is opened in a different browser or device from the one that requested it?
  - **Recommendation: yes.** Mobile mail apps open links in their own in-app browser, so same-browser-only fails a routine case.
- **D2 — Auth design.** → **(C) implicit-flow requester** (resolved 2026-09-25, user accepted recommendation).
  - **(C) Implicit-flow requester. Recommended.** Vendor requests the reset through a small non-SSR `@supabase/supabase-js` client with `flowType: "implicit"`. The emailed link carries tokens in the URL fragment and is consumed by the existing `readHashTokens` path.
    - *Security:* the link is a bearer credential. This is inherent to any cross-browser reset, including option A, and is already true of every Command onboarding link.
    - Fragments are never sent to a server, so the tokens never reach Vercel or Supabase request logs. The existing code drops the fragment with `replaceState` straight after `setSession`.
    - Email-scanner prefetch consumes the one-time token under both options, as it already does today.
    - *Change:* vendor code only. No config or template change. Reversible by reverting one service function.
  - **(A) token_hash template + server `/auth/confirm` route (`verifyOtp`).** This is Supabase's documented SSR recommendation.
    - *Security:* equivalent bearer semantics. The hash travels in the query string, so it can appear in server access logs.
    - *Change:* the project-wide recovery template in hosted dashboards (staging + prod), plus a confirm route in **every** app that sends recovery mail, plus a mobile deep-link story. That touches several apps and needs security config approval.
    - Best done later as one coordinated plan if the platform standardises on it (F3).
  - **(B) Keep PKCE and only explain the limitation.** Rejected if D1 = yes.
- **D3 — Ship B2 (unconsumed `?code=` guard) with B1?** → **Yes, same delivery** (resolved 2026-09-25, user accepted recommendation).
  - **Recommendation: yes, same delivery.** After B1, Vendor itself no longer mails `?code=` links. Two cases remain:
    - links sent **before** deploy stay live for up to the OTP expiry (`[auth.email] otp_expiry`, default 1 h);
    - an expired or reused same-browser `?code=` link today also lands on a silent login screen.
  - B2 is small and closes the handoff's "never silently degrade" requirement for both.
- **D5 — B3 price display.** → **(a) Include the display fix in B3** (resolved 2026-09-25 by you; confirmed frontend-only, vendor-only, no migration). Once B3 lets centavos be saved, three vendor surfaces render with a bare `toLocaleString()`: `OfferingCard.tsx:90`, `kiosk/KioskBooking/StepOffering.tsx:113` and `StepConfirmation.tsx:67`. A bare `toLocaleString()` shows ₱1,499.50 as **"₱1,499.5"**.
  - **(a) Include a display fix in B3. Recommended.** Whole pesos keep rendering exactly as today, so no visual baselines change. Prices with centavos always show 2 decimals.
  - **(b) Defer it** as a cosmetic follow-up.
  - `fmtPeso` (`lib/utils.ts:163`) is **not** a drop-in: it renders `"₱ 850.00"`, with a space and forced decimals, so every card would change and the committed `offerings` baselines would need regenerating.
- **D4 — Other apps.** → **Follow-ups F1–F2, separate plans** (resolved 2026-09-25, user accepted recommendation). Record Booker, Command web and vendor mobile as follow-ups (F1–F2) for separate plans? The alternative is widening this plan, which needs cross-app approval.
  - **Recommendation: follow-ups.** This keeps the change to one app, per the approval gate in `AGENTS.md`.

## BLOCKERS

### B1 — Request recovery links with an implicit-flow client  ✅ DONE (2026-09-25)  *(depends on D1 = yes, D2 = C)*

> ✅ DONE 2026-09-25. Added `lib/supabase/recoveryRequestClient.ts`, pointed `services/auth.service.ts` `resetPassword` at it, and updated the comment in `useLoginPage.ts`. Machine checks: `tsc --noEmit` clean; 471/471 unit tests pass; eslint clean on the new and changed service files. The 3 eslint errors in `useLoginPage.ts` were already there before this change (K2). Live checks: B1-a, B1-b, B1-c, B1-d and B1-f passed; B1-e was covered by link-shape equivalence. See the Stage log.

**Files:**
- new `vendor/lib/supabase/recoveryRequestClient.ts`
- `vendor/services/auth.service.ts:16-21`
- `vendor/components/auth/LoginPage/useLoginPage.ts:356-358` (comment only)

**Change:**
1. **New client, `recoveryRequestClient.ts`.** It exports a lazily created, module-level singleton made with `createClient` from `@supabase/supabase-js`. That package is already a direct dependency (`vendor/package.json:31`), so nothing is installed. Options:
   - `auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "rs-recovery-request" }`
   - A distinct `storageKey` plus `persistSession: false` keeps it clear of the main client's cookie session, and avoids auth-js's "Multiple GoTrueClient instances" warning, which is keyed on `storageKey`.
   - A singleton rather than a client per call, so repeat requests don't create more instances.
   - A comment at the top explains why this exists: the link shape is decided by the requester's flowType, `@supabase/ssr` forces PKCE, and PKCE ties the link to the requesting browser. It should point at `client.ts:4-21` rather than repeat that text.
2. **`auth.service.ts` `resetPassword`.** Call `resetPasswordForEmail` on the recovery request client. Keep the signature (`email, redirectTo?`), so the caller (`useLoginPage.handleForgot`) is unchanged.
3. **`useLoginPage.ts:356-358`.** Update the stale comment ("PASSWORD_RECOVERY event puts the app into the reset view"). The link now arrives as an implicit `#…type=recovery` fragment and is consumed by `client.ts`'s `readHashTokens`.

**Why this is enough:** after this change, a Vendor-requested link has the same shape as a Command onboarding link. `client.ts:54-56` latches recovery from `type=recovery` at module load, and `client.ts:119-139` sets the session. `useAppShell.ts:291-299` waits on `recoverySessionReady()`, and `AppShell` renders the keyed `"reset"` view. The refresh gate (`rs.recovery` in sessionStorage), the access-gate skip and the error rewrite (`failRecovery`) all come with that path unchanged.

**Components:** no component is created or restructured. `LoginPage`/`useLoginPage` keep their render/hook split, and the only hook change is a comment. No styling change.

**Rejected alternative:** a server API route that sends the reset. It would do the same thing with an anon client, but it adds a new unauthenticated email-sending endpoint. It would also put every request behind the Vercel egress IP for GoTrue's per-IP rate limits. The browser-side client keeps today's rate-limit and captcha behaviour.

**Verification:**
- Machine: `npm --prefix vendor run lint`; type-check with `npx --prefix vendor tsc --noEmit -p vendor`; `npm --prefix vendor test`. There is no unit test here: the change is SDK wiring with no pure logic to test.
- Live (local Supabase + Mailpit): the matrix rows marked B1 below. Before clicking, confirm the mailed link redirects to `…/#access_token=…&type=recovery`. Check the parameter *names* only; never copy the values.

### B2 — Never let an unconsumed `?code=` callback fall through to a plain login screen  ✅ DONE (2026-09-25)  *(depends on D3 = yes)*

> ✅ DONE 2026-09-25, as revised after K1.
> - Added `lib/authCodeCallback.ts` (+ 5 tests).
> - `client.ts`: the `codeCallback` guard, a parameterised `failRecovery`, and `isRecoveryResolving` now also covers `?code=`.
> - `authHashError.ts`: the `pkce_verifier_missing` copy (+ 2 tests).
> - Machine checks: `tsc` clean; 478/478 tests; eslint clean on every touched file.
> - Live checks: B2-a, B2-b and B2-c pass with real PKCE links, and the B1 flows were re-run afterwards with no regression. See the Stage log.

**Files:** `vendor/lib/supabase/client.ts:99-150`, new `vendor/lib/authCodeCallback.ts` (+ `.test.ts`), `vendor/lib/authHashError.ts:22-25`, `vendor/lib/authHashError.test.ts`.

**Change** *(revised 2026-09-25 after Stage 0 finding K1 — the original "is `code` still in the URL after `initialize()`" test is unreliable)*:
1. **Pure classifier, new `vendor/lib/authCodeCallback.ts`.** `classifyCodeCallback(search, cookieString)` returns one of three results:
   - `"none"`: no `code` query parameter.
   - `"missing_verifier"`: `code` is present but no cookie matching `/-code-verifier(\.\d+)?=/`.
   - `"exchange"`: `code` is present and the verifier cookie exists.

   It is window-free, so it can be unit-tested. It deliberately couples to `@supabase/ssr`'s cookie naming (`<storageKey>-code-verifier`, observed in Stage 0); a comment says so, in the same style as `client.ts`'s existing notes on auth-js internals. Recovery is the only flow in vendor that produces `?code=`; a grep found no `signUp`, OTP or OAuth code, so every `?code=` counts as a recovery callback.
2. **Guard at module load, in `client.ts`.**
   - `missing_verifier`: call `failRecovery("pkce_verifier_missing")` straight away. This case is known without waiting for `initialize()`.
   - `exchange`: set `recoveryReady = client.auth.initialize().then(…)`.
     - On an error, call `failRecovery(error.code)`. An unrecognised code falls back to the generic "could not be used" copy, and we never claim "expired" unless Supabase says so.
     - On success, resolve only **after one macrotask**. auth-js fires `PASSWORD_RECOVERY` in a `setTimeout` *after* `initialize` resolves (`GoTrueClient.js:317-324`).
     - The rejection arm calls `failRecovery()`, for the same reason `client.ts:128-136` gives.
3. **`failRecovery(errorCode = "otp_expired")`, in `client.ts`.** It builds the fragment from `URLSearchParams({ error, error_code })`, then `history.replaceState(pathname + "#…")` + `reload()`. That drops the query, including `code`, and still reloads when only the hash would differ. Existing callers keep their current copy, because `otp_expired` maps through `ERROR_COPY`.
4. **`isRecoveryResolving()`, in `client.ts`.** Also returns true when the classifier result is not `"none"`. The shell then renders nothing instead of briefly showing the login view (the B5 reason).
5. **`authHashError.ts`.** Add one copy entry, `pkce_verifier_missing`: *"This reset link can't be used in this browser. Request a new link below — new links work in any browser."* A comment marks it as a code we emit ourselves.

**Components:** none. The error reaches the user through the existing `getAuthUrlError()` → `useLoginPage` path.

**Guard against a weak implementation:** do **not** show the error just because `code` is present. With the verifier cookie present, the result must be decided *after* `initialize()`. Otherwise a valid same-browser link would briefly show an error.

**Verification:**
- Machine: add `authCodeCallback.test.ts` covering none, missing, exchange and chunked-cookie cases, plus a `pkce_verifier_missing` case in `authHashError.test.ts`. Then lint, `tsc` and `npm --prefix vendor test`.
- Live: the matrix rows marked B2.

### B3 — Offering price silently truncated to whole pesos  ✅ DONE (2026-09-25)  *(added 2026-09-25 at your request, from vendor B1 in `2026-07-22-vendor-code-review-hardening.md`; depends on D5)*

> ✅ DONE 2026-09-25 (Stage 4).
> - **Code:** new `lib/price.ts` (`parsePrice`, `fmtOfferingPrice`) + `lib/price.test.ts` (6 tests); `useOfferingForm.ts` now calls `parsePrice`; `step={0.01}` added in `OfferingFormModal.tsx`; `fmtOfferingPrice` used at `OfferingCard.tsx`, `StepOffering.tsx` and `StepConfirmation.tsx`.
> - **Machine checks:** `tsc` clean; eslint clean on the touched files; 484/484 unit tests.
> - **Visual:** full Playwright suite 187/187 passed on port 3100, with baselines unchanged (so whole-peso rendering is identical).
> - **Live (local, headless, `jose@bookdeck.com`, "Court Rental"):**
>   - Saving ₱850.50 stores `850.50` (checked with read-only `psql`) and the card shows "₱850.50", which survives a reload.
>   - Renaming the offering keeps `850.50`. That is the escalation case, now fixed.
>   - The row was restored through the UI to "Court Rental" / `850.00`, and the card shows "₱850" again.
> - **Harness notes:** the first-login "Getting Started" guide covers the page, so the harness closes it with Escape. One later run found an overlay still open and was restored in a fresh session. This was harness handling only, with no product change.
> - **Not live-tested:** the two kiosk price displays. They are covered by the formatter's unit tests and the unchanged kiosk baselines.
> - **Left open:** the old plan's vendor B1 status, for you to close (AGENTS.md).

**Re-verified 2026-09-25: still live, and escalated.**
- `components/offerings/OfferingFormModal/useOfferingForm.ts:99` is `price: parseInt(ofPrice) || 0`. The old plan cited `:52`; the line has since moved.
- `offerings.price` is still `numeric(10,2)` (`20260506000001_offerings.sql:23`); no later migration changes it.
- `parseInt("850.50")` gives `850`, so the centavos are dropped silently.
- **Escalation not in the old plan:** the form seeds `ofPrice` from `String(oTarget.price)` (`:16`). So editing *any* field on an offering that already has centavos (for example, one set via SQL or seed) truncates its price on save.
- The price input (`OfferingFormModal.tsx:122`) has no `step`, so the browser default `step=1` also marks `850.50` as invalid, and the spinner moves in whole pesos.

**Downstream: checked, safe for centavos.**
- The booking trigger copies `price_paid := v_price * quantity` in numeric (`20260803000004`).
- Both payment routes convert with `Math.round(Number(price_paid) * 100)`: `booker/.../create-session/route.ts:55` and `vendor/app/api/kiosk/payment/create-session/route.ts:80`.
- `lib/financials.ts:84` works in integer cents.
- No other `parseInt`/`parseFloat` of a price exists in vendor, booker or `ezzy-vendor-mobile`.

**Change:**
1. **New `vendor/lib/price.ts`** with `parsePrice(input: string): number`, which returns `Math.round(parseFloat(input) * 100) / 100`, or `0` for blank or non-numeric input. That keeps today's rule that a blank price means 0 (F3 in that hook). Rounding here matches what `numeric(10,2)` stores, so local state never shows more precision than the database keeps.
   - If D5 = (a), the same file also gets `fmtOfferingPrice(n)`: `n.toLocaleString(undefined, { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })`. The locale argument matches today's bare call, so whole-peso output is byte-identical.
   - It lives in its own file rather than `lib/utils.ts` so the unit test does not pull in `clsx`/`tailwind-merge`, matching the other small `lib/*.ts` + `.test.ts` pairs.
2. **`useOfferingForm.ts:99`** now calls `parsePrice(ofPrice)`.
3. **`OfferingFormModal.tsx:122`** gets `step={0.01}` on the price input. That is a render attribute only: no state and no styling, so the render/hook split is untouched.
4. **If D5 = (a):** replace `x.price.toLocaleString()` with `fmtOfferingPrice(x.price)` at `OfferingCard.tsx:90`, `StepOffering.tsx:113` and `StepConfirmation.tsx:67` (`pricePaid`). These are render-only changes and add no hook state. `PackagesPage.tsx:24` is excluded: packages don't go through this form.

**Out of scope:**
- Booker's own display of offering prices (cross-app; follow-up F4).
- The old plan's other open items.
- Its B1 status: that is left for you to close, per AGENTS.md.

**Verification:**
- Machine: `lib/price.test.ts`. Cases for `parsePrice`: "850.50" → 850.5, "99.99" → 99.99, "850" → 850, "" → 0, "abc" → 0, "1.005" → 2 dp. If D5 = (a), cases for `fmtOfferingPrice`: whole pesos unchanged, and 1499.5 → "1,499.50". Then `tsc`, eslint on the touched files, and `npm --prefix vendor test`.
- Visual: the `offerings` and `offeringform` Playwright baselines must pass **unchanged**, on port 3100 with no other vendor dev server running.
- Live (local): save an offering at ₱850.50 and reload. It must persist as 850.50 (check via `psql`, read-only) and display as ₱850.50. Editing its name must keep 850.50. Afterwards, restore or delete the test row.

## IMPORTANT

### I1 — Update architecture docs to match  ✅ DONE (2026-09-25)  *(after B1/B2)*

> ✅ DONE 2026-09-25.
> - `auth-and-roles.md`: link-shape table split into Vendor vs Booker/Command; new section "A `?code=` link only works in the browser that requested it"; the "byte-identical" claim qualified (K3).
> - `email-notifications-guide.md`: new troubleshooting row.
> - Verified by grepping every file and function name the docs cite against `vendor/`.

- **`architecture/auth-and-roles.md` → "Two link shapes".** Vendor's browser Forgot Password now requests implicit links. Booker and Command web still mail `?code=` links (point to F1). Add B2's unconsumed-code guard.
- **`architecture/email-notifications-guide.md:165-166`.** Add a troubleshooting row: "reset link opened in another browser → login screen" → fixed in vendor, still open in booker/command (F1).

Docs are not a behaviour change. Verify by reading them back against the final code.

### I2 — Reset view: "Update Password" and "Back to Sign In" touch  ✅ DONE (2026-09-25)  *(found by you during the staging test)*

**File:** `vendor/components/auth/LoginPage/LoginPage.module.css`.
**Problem:** in the reset view (`LoginPage.tsx:257-258`), `.primaryBtn` sits directly above `.secondaryBtn` with no margin between them, and the primary button's glow runs into the secondary one.
**Fix:** one rule, `.primaryBtn + .secondaryBtn { margin-top: 12px; }`. It uses an adjacent-sibling selector, so a secondary button standing alone keeps its spacing (e.g. "Check your inbox"). The reset view is the only place a primary button is directly followed by a secondary one. It is CSS-module only, with no `.tsx` or hook change.

> ✅ DONE 2026-09-25.
> - The `loginreset` light and dark baselines failed before the update, as expected, and were regenerated with a scoped `--grep "ui-gallery loginreset" --update-snapshots`.
> - The dark baseline was reviewed: the 12 px gap is visible.
> - `ui-gallery login*` passed 15/15 twice, then the full suite passed 187/187.
> - Commit the 2 changed PNGs with the CSS.

## Follow-ups: moved out of this plan (2026-09-25)

Checked on 2026-09-25 that each one is in `.plans/2026-08-25-vendor-launch-followups.md`, then taken out of
this plan at your request. Track them only there. The IDs below remain so that older references to this
plan (the decisions above, `architecture/`) still resolve.

| Was here | Now | Topic |
|---|---|---|
| K4 | follow-ups **F21**, plan `.plans/2026-09-25-vendor-eslint-cleanup.md` | 28 pre-existing ESLint errors and 3 warnings in vendor |
| F1 | follow-ups **F22** | Booker and Command web reset links are tied to the requesting browser |
| F2 | follow-ups **F23** | `ezzy-vendor-mobile` reset is same-device only |
| F3 | follow-ups **F24** | `token_hash` recovery links platform-wide |
| F4 | follow-ups **F25** | Booker display of prices with centavos |

## Execution order

D1–D4 resolved 2026-09-25. Nothing starts until the plan is approved. Stages run one at a time.

1. ✅ **Stage 0 — Reproduce (live, read-only).** *DONE 2026-09-25: see "Stage log".* Run the handoff's reproduction steps 1–4 locally (Mailpit) and confirm the current `?code=` shape and the failure in another browser. No code changes.
2. ✅ **Stage 1 — B1.** *DONE 2026-09-25.* Then the machine checks and matrix rows B1-a to B1-d.
3. ✅ **Stage 2 — B2.** *DONE 2026-09-25.* Then the unit tests, machine checks and matrix rows B2-a to B2-c.
4. ✅ **Stage 3 — I1 docs + live.** *Docs ✅ DONE 2026-09-25. Staging and production round-trips done by you, 2026-09-25 (see Sign-off).* Hosted staging round-trip after deploy, done by the user.

B1 and B2 touch different code paths (the request side vs the `?code=` consumption side). Either could ship alone, but D3 recommends one delivery.

5. ✅ **Stage 4 — B3 offering price** (added 2026-09-25). *DONE 2026-09-25; see B3.* It ran before the staging test so one deploy covers both.

## Stage log

- **S0 ✅ (2026-09-25).** Headless Chromium against the local vendor dev server (:3000), local GoTrue and Mailpit, with test account `jose@bookdeck.com`. The harness recorded parameter *names* only.
  - The mailed link is `/auth/v1/verify?token,type=recovery,redirect_to`. It redirects to `/?code=`, confirming the PKCE shape.
  - The requesting context holds the cookie `sb-127-auth-token-code-verifier` (`base64-` encoded).
  - **Different browser:** plain login screen, no message. The bug is reproduced.
  - **Same browser:** reset form. The baseline works. The password was not submitted, so the account is unchanged.
  - Two recovery emails were sent (the local `email_sent` limit is 2/hour).
- **K1 (found in S0, 2026-09-25).** Once `useAppShell`'s URL-state sync mounts, it rewrites the query to `?page=&from=&to=`. This happened in both the working and the failing run. So "is `code` still in the URL after `initialize()`" is **not** a reliable test of whether the exchange succeeded. ✅ Fixed by revising B2 to classify from the verifier cookie at module load.

- **S1 ✅ (2026-09-25).** Headless Chromium, local stack, `jose@bookdeck.com`.
  - The mailed link now redirects to `#access_token,…,refresh_token,type=recovery`, the implicit shape.
  - **B1-b** (request in A, open in B): reset form. The new password was set and a fresh sign-in with it succeeded. **The bug is fixed.**
  - **B1-c:** after a refresh, the reset form is still shown.
  - **B1-a** (same browser): reset form. The password was set back to the seed value `DevSeed@pass11` and signing in with it succeeded, so the account ends where it started.
  - **B1-d:** "Back to Sign In" goes to the login screen, and a refresh stays on the login screen.
  - **B1-f:** an unknown email gets the same "sent" view, so accounts can't be enumerated.
  - **B1-e** (Command onboarding link): not run through Command. After this change a Vendor link has the identical fragment shape and goes through the unchanged `readHashTokens` path that B1-a and B1-b just exercised.
  - The first B1-b attempt showed a blank page within its 4 s window. It was a cold dev compile after the edit (the next run passed with a 15 s window), so no product change.
  - Local email rate limit: 6 recovery emails in about 20 minutes all sent, so `email_sent = 2` was not what limited these runs.
- **K2 — 3 eslint `react-hooks/set-state-in-effect` errors in `useLoginPage.ts`. They were pre-existing (in HEAD before this plan).** ✅ DONE (2026-09-25, at your request):
  - (1) The `mobileView` reset on a view change now happens during render from the previous `loginView`, instead of in an effect.
  - (2) The onboarding-draft restore is now a lazy initialiser (`savedDraft`, which seeds `regForm` and `kycType`), like the existing `?ref=` and `getAuthUrlError` seeding. The `?ref=` code still wins over a saved draft's code. The division deep-link comment was updated: its ordering is now guaranteed, not incidental.
  - (3) Email availability now keeps only the last answer, keyed by address, and derives `emailTaken`/`emailChecking` from it. The Continue re-check writes that same state.
  - **Machine checks:** eslint clean on `components/auth/LoginPage/`; `tsc` clean; 478/478 tests.
  - **Live check (local, headless):**
    - A seeded draft resumes at step 2 with its fields restored.
    - An existing email shows "taken" and an unused one clears it.
    - Checking the existing email again shows "checking", then "taken"; an invalid address shows neither.
    - Autosave kept the draft and refreshed `savedAt`.
    - The first run hit a cold compile of `/api/auth/check-email` (3.1 s); the warm re-run passed.
  - **Review only:** the `mobileView` reset. The info panel's only view-changing control already sets `"form"` explicitly. The page renders without a render loop.
- **K4 (2026-09-25)** — pre-existing vendor lint debt. Moved to follow-ups **F21** and planned in `.plans/2026-09-25-vendor-eslint-cleanup.md`.

- **S2 ✅ (2026-09-25).** Real `?code=` links came from a Node PKCE client that held its verifier in memory. For the same-browser case, the verifier was set as the `sb-127-auth-token-code-verifier` cookie in the ssr `base64-` encoding.
  - **B2-a** (real link, other browser): about 1.5 s to the login screen with the "can't be used in this browser" copy. The URL is clean, and a refresh gives a plain login.
    - The first attempt still looked blank at 8 s. It was a cold dev compile straight after editing `client.ts`.
    - Warm timings in the same run: plain `/` 1.0 s, the existing `otp_expired` fragment 1.7 s, the B2 path 1.6 s.
  - **B2-c** (valid link, verifier present): blank, then the reset form, with **no login or error flash** in between (sampled every 100 ms). This confirms the macrotask wait.
  - **B2-b, PKCE** (used code, verifier present): GoTrue rejects it, and the user sees the generic "That link could not be used" copy, not a false "expired".
  - **B2-b, implicit** (spent link): the existing `otp_expired` copy, unchanged.
  - **Regressions:**
    - A rejected implicit fragment still goes through `failRecovery()` to the `otp_expired` copy.
    - B1-b and B1-a were re-run end to end: reset form in about 1 s, password set, fresh sign-in works. The seed password was restored.

- **S3 docs ✅ (2026-09-25).** See I1.
- **K3 (2026-09-25).** `auth-and-roles.md` said all three portals keep `lib/supabase/client.ts` byte-identical. Vendor's now differs from Booker's and Command's (the `codeCallback` guard, and `failRecovery(errorCode)`). The doc now says so. F1 (now follow-ups F22) would bring them back in line.
- **Still unverified (needs you, on staging):** a real Resend-delivered email opened (1) in a different desktop browser and (2) in a phone's mail app / in-app browser, plus a B1-e check using a real Command-created vendor user. None of these can run locally: the phone can't reach local Supabase (see memory: device checks need staging).

- **K5 — Staging reset links went to `localhost:3000` (found during the staging test, 2026-09-25).** This was Supabase Auth URL configuration, not code: Vendor sends `redirectTo = window.location.origin`. GoTrue replaces any address missing from the allow-list with the Site URL, which on staging was `http://localhost:3000`. You fixed it by adding `staging-vendor.ezzy.ph` to the staging redirect URLs, and confirmed the link then works.
  - **Production:** check the Site URL and the allow-list for each app's bare origin. `architecture/supabase-production-setup.md` shows `https://<vendor-domain>/*`, which may not match a bare origin with no trailing slash. On production that would fall back to the Command Site URL.
  - ✅ Doc note DONE 2026-09-25 (you approved it). `supabase-production-setup.md` now lists bare origins, explains the silent Site-URL fallback with this staging incident, and warns against relying on `/*`. `email-notifications-guide.md` step 8 now says "bare origin" and drops the stale "Pending real app URLs" note. No code change: this is configuration plus docs. You found production already configured correctly (reset works there).

## Sign-off (2026-09-25)

- **Staging:** you reported the reset link working once the bare `staging-vendor.ezzy.ph` origin was allow-listed (K5). During that test you found I2 (button spacing), which is now fixed.
- **Production:** you deployed all the changes and reported that it "seems to have worked well". The plan is closed on that sign-off.
- **Honest limit:** the individual live rows were not reported back to me one by one: another desktop browser, a phone's mail app, a Command-created vendor user's link, registration draft and email check, and centavos on the card and kiosk. Each of these was verified locally (see the Stage log); on hosted environments they rest on your overall sign-off.
- **Still open, not closed by this plan:**
  - F1–F4 (now follow-ups F22–F25).
  - K4 (now F21, with its own plan).

## Verification matrix

Each row is live (browser + local Supabase/Mailpit) unless marked. "Other browser" means a separate profile or incognito window. Mobile in-app browsers need staging (see memory: device checks need staging).

| # | Scenario | Expected |
|---|---|---|
| B1-a | Request in browser A, open in A | Reset form. Password updates, then sign-out and a clean reload to origin (`useLoginPage.ts:389-391`). New password signs in. |
| B1-b | Request in A, open in other browser B | Reset form in B. Same result as B1-a. **This is the bug.** |
| B1-c | Refresh on reset form | Still on reset form (`rs.recovery` latch). No dashboard. |
| B1-d | "Back to Sign In" from reset form | Existing sign-out/clean-origin behaviour. |
| B1-e | Command-created user's onboarding link (vendor role) | No change: reset form, password set. |
| B1-f | Normal sign-in, and forgot-password on an unknown email | No change (same "sent" view, no account enumeration). |
| B2-a | A `?code=` link requested **before** B1 (stash one before Stage 1), opened in B | Login screen **with** the `pkce_verifier_missing` message; `code` gone from the URL; refresh shows a clean login. |
| B2-b | Expired or used link, both shapes | Actionable error (existing `otp_expired` copy or Supabase's description), never a silent login. |
| B2-c | Valid same-browser `?code=` link (pre-B1 stash) | Reset form with no error flash. This checks the macrotask wait. |
| M | lint, `tsc --noEmit`, `npm test` (machine) | Clean |

Never paste live link values, codes or tokens into chat, logs, fixtures or commits.
