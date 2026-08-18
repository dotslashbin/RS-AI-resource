# Command-created users get no set-password email — onboarding path

**Date:** 2026-08-17
**App / scope:** `command` — `app/api/users/route.ts`, `components/users/*`, `lib/`
**Status:** ✅ **COMPLETE for the goal it was written for** (2026-08-18) — all code
shipped in all three portals; the Command flow is verified end to end in production.
A short tail of **non-blocking follow-ups** remains, listed under "What is left" below.

The user confirmed the full chain on production Command (v0.23.4): create a user → email
arrives → link opens the **set-password form** → password set → **login succeeds**. That
is B2, B3, B5 and B7 confirmed live, in the one flow they exist to serve. Four separate
production failures (`Auth session missing!`, the login-form latch, the portal/role
lockout, and the original silent no-email) are closed.

`vendor` (v0.43.2) and `booker` (v0.16.2) shipped the same B3/B4/B5 fix on 2026-08-18 —
verified in this repo: both working trees clean, `isRecoveryResolving` present in each
`HEAD:lib/supabase/client.ts`. Their **own** Forgot Password was never affected (B6).

## What is left

Nothing blocks the feature. Remaining items, none of which are code defects:

| Item | State | Why it is not blocking |
|---|---|---|
| **I12** staging Auth SMTP missing | 🔄 with the user | Dashboard config on the staging project; the user is handling it. Blocks *staging* email testing only — production is unaffected. |
| **I3** redirect-URL allowlist read | ⏸ parked | Cannot be checked from here; production demonstrably works, so it is confirmation rather than repair. |
| **I4** hosted rate-limit read | 🔄 with the user | One dashboard glance before any bulk onboarding. |
| **B4** rejected-link path | untested | Needs a spent/expired link. Expected: *"Email link is invalid or has expired"* instead of a dead form. |
| **B7** the block itself | untested | Command+Member should disable Save. Only the happy path was exercised. |
| **B8** write-failure path | untested | Needs an induced write failure. |
| **I6** root set-password / resend | untested | Shipped 2026-08-17, never exercised live. |
| **I11** extract + test `readHashTokens` | ⬜ TODO | Protects the Forgot-Password invariant from a future edit. The best remaining *code* task. |
| **I9** route-level root-gate test | ⬜ TODO | Needs a route-test harness this app lacks. |
| **I8** pre-existing `no-explicit-any` | ⬜ TODO | Predates this plan; not its work. |

**Remaining:** ship the identical B3/B4/B5 change to `vendor` and `booker` — the user is
handling that next. Their **own** Forgot Password is unaffected either way (B6); what is
still broken there is a *Command-created* vendor/booker user's set-password link.

The 2026-08-17 send worked as far as delivery: the email arrived, the link landed, the
reset form appeared. It failed on submit because **no session was ever created** — a
PKCE/implicit mismatch between the client that requested the link and the client that
consumes it (**B3**, root-caused against library source). B3 + B4 shipped together on
2026-08-18 and are **cross-app**: `command`, `vendor` and `booker` all needed the fix.

**2026-08-18, two retests, two distinct findings:**

1. Against **v0.23.1** (send shipped, landing fix not committed): failure reproduced and
   **B3's diagnosis confirmed by the captured landing URL** — GoTrue handed the browser a
   valid, unexpired production session and the browser refused it (**I10**).
2. Against **v0.23.2** (B3/B4 deployed): `Auth session missing!` is **gone** — the session
   is now created. But the link lands on the ordinary login form, because B3 turned a
   synchronous flag asynchronous and `LoginPage` latches its view on first mount
   (**B5** — a regression I introduced, fixed in code 2026-08-18, not yet deployed).

**Next action: deploy B5 and retest.** Until then, provision Command admins with
**Set password**, which touches no email or link and is unaffected by any of this.

<details><summary>Previous status (2026-08-17) — all code shipped, awaiting live verification</summary>

**Status:** IN PROGRESS — **all code shipped 2026-08-17 (Stages 0–4 complete); the plan
stays open on live verification, not on work.**

Every item is ✅ except: I3 ⏸ (Dashboard read, cannot be done from here), and I8/I9 ⬜
(discovered during execution — a pre-existing lint debt left alone, and a missing
route-test harness). **Nothing in this plan has been proven end-to-end against a real
mailbox.** `tsc`, `npm test` (41/41), `eslint` on changed files and a full `next build`
all pass, but no email has been sent or received by this work. Do not treat it as
verified in production until the staging round-trip in **Verification** is run.

</details>

> **The 2026-08-17 caution was right, and this is exactly why.** Everything machine-
> verifiable passed and the feature still did not work. The failure lives entirely in a
> layer no type-checker or unit test could reach.

> One-line framing: a user created in Command today receives nothing at all — no
> password, no email, no link. Give them a set-password link on creation, give root
> a way to resend it, and give root a direct password-set escape hatch. Optimize for
> *reusing the recovery path that already works* over inventing a second auth flow.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "command I1").

---

## 1. What was reported, and what is actually true

**Reported (2026-08-17, production):** an admin account was created in Command; the
new user never received an email with a link to set a password.

**Confirmed — this is the implementation, not a production misconfiguration.**

| Claim | Verdict | Evidence |
|---|---|---|
| No email was sent | **CONFIRMED** | `app/api/users/route.ts:25-29` calls `supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata })`. The GoTrue admin *create user* endpoint sends no mail of any kind — only `invite`, `signup`, `recover`, `magiclink` and `email_change` do. |
| The account has no password | **CONFIRMED** | No `password` field is passed at `route.ts:25-29`. The account exists, is email-confirmed, and has no credential. |
| Some other code path emails them | **FALSE** | `route.ts:34-55` performs only `statuses`/`portals`/`roles` reads and `profiles`/`user_portals`/`user_roles` writes. The `send-notification-email` Edge Function is DB-trigger driven and has no user-creation trigger. `grep` for `inviteUserByEmail`/`generateLink` across `command/` returns **zero** hits; the only `resetPasswordForEmail` is `services/auth.service.ts:17`, called from the login screen's Forgot Password form (`useLoginPage.ts:53`) and nowhere else. |
| Production auth email is broken | **FALSE — already working** | Auth SMTP is Resend / `no-reply@ezzy.ph`, "confirmed by a real recovery email" (`architecture/supabase-production-setup.md:23`), and `.plans/2026-08-10-auth-recovery-link-silent-failure.md` records a production recovery email that arrived and was clicked. The transport is fine; nothing asks it to send. |

**This was a deliberate prior decision, now being revisited.**
`.plans/2026-08-10-recovery-gate-escape-and-settings-password.md` §I2 (resolved
2026-08-10) explicitly considered sending an email on creation and **rejected it**,
on a concrete blocker rather than a preference:

> *"the route grants whatever portals the form selected, so a set-password link must
> target the user's own portal — and Command has no configuration that knows the
> vendor or booker origins… sending with no redirect would drop a vendor user on
> Command, where they would set a password and then be told they have no access."*

That plan instead made the behaviour *visible*: the add-mode note at
`components/users/UserModal/UserModal.tsx:112-119` ("creates the account with **no
password and sends no email** … use **Forgot Password**"), the 8-second creation
toast at `components/users/UsersPage/useUsers.ts:82-88`, and the renaming of every
"Invite" label to "Add"/"Create" (`UserModal.tsx:38` carries the reasoning inline).

**So the product is currently behaving exactly as designed and as documented — the
design is what is wrong.** This plan removes the blocker that forced that design
(B1) rather than treating the symptom again. `architecture/auth-and-roles.md:48`
already names the consequence: *"Command creates every user without one … making
recovery their only onboarding path"* — an onboarding path nobody is ever told to
walk, and which the person cannot start unless someone tells them out of band.

## 2. The flow, as it will work after this plan

1. Root/admin submits the Add User form → `POST /api/users`.
2. The route creates the auth user exactly as today (`createUser`, no password).
3. The route resolves the **target portal origin** from the granted portals
   (priority `command` > `vendor` > `booker`, B1) and calls
   `resetPasswordForEmail(email, { redirectTo: origin })`.
4. GoTrue sends the recovery email through Resend.
5. The link lands on that portal's origin with `#…&type=recovery`, which
   `lib/supabase/client.ts:42` already latches (identical code in all three
   portals), `useAppShell.ts:88` sets `recoveryMode`, and `AppShell` renders the
   set-new-password form. **No client-side change is required in any portal.**
6. On success the user is signed out and returns to a clean login (`useLoginPage.ts:64-84`).

## 3. Scope

**In scope:** `command` only — the create route, the users UI, and one new modal.
**Out of scope:** vendor/booker/mobile client code (deliberately — see §4 B1 rationale);
the notification Edge Function; any schema change; the vendor self-signup flow.
**Cross-app:** none in code. Two *configuration* touchpoints outside the repo — the
Supabase Redirect URL allowlist (I3) and the auth email rate limit (I4).

---

## 4. Operator setup guide — environment variables

> Answers "what do I set up, where, and why" without reading the rest of the plan.
> The reasoning behind each rule is in B1; this is the checklist.

**Three variables. `command` only. Vendor, booker and the two Expo apps need nothing.**

That is a consequence of the B2 decision, not a coincidence. The set-password link is
an ordinary **recovery** link, and every portal already handles one — the detection
code is *byte-identical* across the three web apps (verified 2026-08-17 by
`diff`-ing `lib/supabase/client.ts:1-60` in `command`, `vendor` and `booker`: no
differences). The receiving app therefore needs no new configuration and no new code.
Only the **sender** — Command's create route — needs to be told where to point.

| Variable | Production Command | Staging Command | Local `command/.env.local` |
|---|---|---|---|
| `PORTAL_URL_COMMAND` | `https://command.ezzy.ph` | `https://staging-command.ezzy.ph` | `http://localhost:3000` |
| `PORTAL_URL_VENDOR` | `https://vendor.ezzy.ph` | `https://staging-vendor.ezzy.ph` | `http://localhost:3001` |
| `PORTAL_URL_BOOKER` | **leave unset** (I1) | `https://staging-booker.ezzy.ph` | `http://localhost:3002` |

**Where:** Vercel → the **Command** project → the Production environment, and whichever
environment builds `staging-command.ezzy.ph`. Plus your local `command/.env.local`.
Nothing is set in the Vendor or Booker Vercel projects.

**What each one is for:** Command's Add User form grants any combination of portals, but
`app/api/users/route.ts` never reads that selection for anything except the grant
itself. These variables are how the route turns "this person was granted `vendor`" into
"send their set-password link to `https://vendor.ezzy.ph`". Without them the route has
no idea where the person is supposed to log in — Command's whole configured-URL surface
today is `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_APP_DOMAIN` (`lib/constants.ts:122-123`).
**This is the exact blocker that killed the email feature on 2026-08-10.**

**Rules that matter (each has bitten this project before):**

1. **Scheme + host only. No trailing slash, no path.** The value is handed to GoTrue as
   `redirect_to` and the allowlist match is exact.
2. **Every value must also be in that Supabase project's Redirect URL allowlist** (I3).
   Locally that list is `backbone/supabase/config.toml:160`, which already contains
   `http://localhost:3000`–`3002` — which is why those are the local ports. 3100/3200
   are the Playwright-only ports from `playwright.config.ts` and are **not** allow-listed.
   ⚠️ **The local port numbers are not configured anywhere** — all three apps run a bare
   `next dev` (`package.json:6` in each), which takes 3000 and auto-increments only if
   it is already busy. Which app lands on 3001 vs 3002 is therefore decided by *start
   order*, not by config. For local end-to-end testing, start them with explicit ports
   (`npm --prefix vendor run dev -- -p 3001`) or the link will point at the wrong app.
   See I7.
3. **`PORTAL_URL_BOOKER` stays unset in production, deliberately.** `booker.ezzy.ph`
   points at the *staging* Supabase project (`architecture/overview.md:89`), so a
   production-minted token sent there cannot validate. Unset means "do not send", so a
   booker-only user keeps today's manual instruction instead of getting a dead link.
   When booker is repointed, setting one variable turns it on — no code change (I1).

   **"Can I leave a placeholder instead?" (asked 2026-08-17)** — depends which
   placeholder, and one of them is harmful:

   | Production value | Behaviour | Verdict |
   |---|---|---|
   | variable omitted | resolver returns `null` → no email, warning toast | ✅ correct |
   | `PORTAL_URL_BOOKER=` (empty) | **identical** — B1 treats unset and empty the same | ✅ **preferred** |
   | `TODO` / `pending` / any non-URL | fails origin validation → treated as unset, reported (I2) | ⚠️ safe but ambiguous to the next operator |
   | `https://booker.ezzy.ph` | **valid, well-formed origin — passes every check and SENDS** | ❌ **the dead link I1 exists to prevent** |

   Empty is preferred over omitting purely for discoverability: the variable is visible
   in the settings page as deliberately blank rather than looking forgotten, and turning
   booker on later is pasting a URL into a field that already exists. If Vercel refuses
   to store an empty value, omit the variable — equally correct.

   ⚠️ **No code can catch the bad case.** `https://booker.ezzy.ph` is indistinguishable
   from a legitimately-launched booker; only the *deployment fact* behind it makes it
   wrong. A guard hardcoding that domain was considered and **rejected** — it would bake
   a transient deployment state into the app and contradict the "no booker special case"
   principle in I1. This is an operational rule, enforced by documentation.

   **Order of operations when booker launches:** repoint `booker.ezzy.ph` at the
   production Supabase project **first**, confirm it, *then* set `PORTAL_URL_BOOKER`.
   Setting the variable while booker still reads staging recreates the dead link.
4. **Server-only — deliberately NOT `NEXT_PUBLIC_`.** Nothing in the browser needs them,
   and `NEXT_PUBLIC_*` is inlined at build time, so per `architecture/overview.md:99` it
   takes a **cache-disabled** redeploy to apply — the trap behind both crossed-over
   deployments found on 2026-08-10. A server-only var is read at request time in the
   route handler, so an ordinary redeploy is enough.
5. **Vercel scopes variables per environment** (`architecture/overview.md:101`). A value
   set on Preview leaves Production untouched and the settings page looks correct either
   way — confirm which environment actually builds `staging-command.ezzy.ph` first.

**Nothing here is a secret.** These are public hostnames already visible in any browser
address bar. They are server-only for correctness and surface reduction, not secrecy.

---

## 5. Blast radius — what changes for whom

> Recorded because "does this touch vendor/booker?" is the first question this plan has
> to answer honestly, and the short answer ("Command only") is *nearly* right rather
> than exactly right.

**Unchanged — verified, not assumed:**

| Behaviour | Verified how |
|---|---|
| Vendor's Forgot Password | `vendor/components/auth/LoginPage/useLoginPage.ts:246` calls `resetPassword(forgotEmail, window.location.origin)` — self-contained in vendor, never routed through Command. Untouched by this plan. |
| Booker's Forgot Password | `booker/components/auth/LoginPage/useLoginPage.ts:71` — identical shape, same conclusion. |
| The recovery landing/reset form in all three portals | `lib/supabase/client.ts:1-60` is byte-identical across the three apps (`diff`, 2026-08-17) and **this plan edits none of them**. |
| Self-service password change while signed in | `architecture/auth-and-roles.md:65-80`; not touched. |
| Vendor self-signup | Not touched. |

**A vendor will still request a reset from `vendor.ezzy.ph`, still receive the same
email, and still use that link to set a password. That path is not modified, not
re-routed, and not re-implemented — the plan reuses it precisely so it does not have
to be.**

**What *does* change outside Command — stated plainly rather than glossed:**

1. **A newly created vendor-portal user now gets an email they previously did not.**
   The email is sent *by Command*, but the person lands on **`vendor.ezzy.ph`** and sets
   their password there, using vendor's existing reset form. No vendor code runs that
   isn't already running today for a normal reset — but it is a new experience for that
   person, on a portal other than Command. So "affects Command only" is true of the
   *code and the operator UI*; it is not true of *who receives mail*.
2. **The auth email budget is shared project-wide** (I4). Command bulk-onboarding staff
   consumes the same hourly quota as a vendor's genuine Forgot Password on the same
   Supabase project. A vendor could, in principle, be told "try again later" because of
   Command activity in the same hour. This is a real coupling, mitigated by the volumes
   involved (a handful of accounts) rather than by code. Worth confirming the hosted
   rate limit before a bulk onboarding session.
3. **The recovery email template is shared.** Nothing in this plan edits it — but if the
   dashboard "Reset Password" template is later reworded toward "welcome, set your
   password" (the tempting shortcut noted under DEFERRED), that copy would also be what
   an existing vendor sees on a genuine password reset. Do not reword it in place;
   the branded-email option exists for that.

**Existing users of any portal are entirely unaffected.** Nothing in this plan touches
an account that already exists unless root explicitly invokes one of the I6 actions on
it.

---

## BLOCKERS

### B1 — The route has no way to aim a set-password link at the user's portal  ✅ DONE (2026-08-17)

> **Executed:** new `command/lib/portalOrigins.server.ts` (`resolvePortalOrigin`,
> returning the `ResolvedOrigin` discriminated union) + `lib/portalOrigins.server.test.ts`
> (24 cases). **Verified — machine:** `npm test` → 41/41 pass (24 new, 17 pre-existing
> payout-crypto); `npx tsc --noEmit` exit 0; grep for `in process.env` / `!== undefined`
> / `hasOwnProperty` in the resolver returns **comment lines only**, no code — the
> load-bearing falsy-check rule holds. Tests cover `""` and `" "` → `not_configured`,
> nine malformed values → `misconfigured` (asserting *not* `not_configured`), priority
> order, unknown portal names ignored, trailing-slash normalisation, and laziness
> (re-reads env per call). **Not verified:** nothing — this is a pure function with no
> live-environment dependency.

**File:** `app/api/users/route.ts:9` (portals arrive in the body and are never used
for anything but the grant at `:36,47-51`); `lib/constants.ts:122-123` is Command's
*entire* configured-URL surface (`NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_DOMAIN`).

This is the exact blocker that killed the email in the 2026-08-10 plan. Nothing has
changed on its own; it has to be removed deliberately. Without it, a vendor user's
link lands on Command, where they set a password and are then told *"You do not have
access to the Command portal."* (`useLoginPage.ts:42`).

**Decision (resolved 2026-08-17): env-configured origins, priority `command` >
`vendor` > `booker`.**

**Fix approach** — new `lib/portalOrigins.server.ts`:

```ts
// Server-only: these are never needed in the browser, so they are NOT NEXT_PUBLIC_.
// Per-environment by design — staging Command must link to staging-vendor.ezzy.ph,
// production Command to vendor.ezzy.ph.
const ORIGIN_ENV: Record<Portal, string> = {
  command: "PORTAL_URL_COMMAND",
  vendor:  "PORTAL_URL_VENDOR",
  booker:  "PORTAL_URL_BOOKER",
}

// Highest privilege wins: a user granted command + vendor is a Command operator, and
// the Command origin is the one whose login they will actually be sent to.
const PRIORITY: Portal[] = ["command", "vendor", "booker"]

export function resolvePortalOrigin(portals: string[]): string | null { … }
```

Rules the implementation must satisfy (stated so a weak implementation cannot pass
review):
- Returns `not_configured` when the winning portal's variable is **unset or empty**
  (the two are deliberately equivalent — see §4 rule 3), and that must mean *do not
  send* — never *send with no redirect*, and never *fall back to the Command origin*. A
  silent fallback re-creates the exact failure the 2026-08-10 decision was avoiding.

  ⚠️ **Load-bearing detail — the emptiness test must be `!raw.trim()`, never an
  existence check.** Production sets `PORTAL_URL_BOOKER` to a **blank string** (user,
  2026-08-17), which puts this exact line on the critical path. Measured in Node
  (2026-08-17):

  | Value | `typeof` | falsy | `"KEY" in process.env` | `!(v ?? "").trim()` |
  |---|---|---|---|---|
  | `""` (Vercel blank) | `string` | ✅ true | **`true`** | ✅ true |
  | `" "` (stray space) | `string` | ❌ **false** | `true` | ✅ true |
  | absent | `undefined` | ✅ true | `false` | ✅ true |
  | real origin | `string` | false | `true` | false |

  Two ways to get this wrong, both silent:
  - `"PORTAL_URL_BOOKER" in process.env` or `!== undefined` → a blank string reads as
    **configured**, then fails origin validation, and every booker user creation raises
    a red `misconfigured` **error** toast for what is a deliberate opt-out. It would
    also make behaviour depend on whether Vercel stores a blank var or drops it — the
    two are indistinguishable to a falsy check but *opposite* to an existence check.
  - A bare `!raw` without `.trim()` → a stray space survives as a "configured" origin.

  So: `const raw = (process.env[key] ?? "").trim(); if (!raw) return not_configured`.
- The value is validated as an absolute `http(s)` origin before use; a malformed value
  returns `misconfigured` and is never passed to GoTrue. **`misconfigured` is a distinct
  outcome from `not_configured`, not a synonym** — see the B2 signature note.
- Origins come from configuration only. **The request's own origin is never used** —
  `proxy.ts` and the hosting layer make `req.nextUrl.origin` untrustworthy as a
  canonical public URL, and an attacker-controlled `Host` header must not be able to
  steer a recovery link.

**Environment variables to add — APPROVAL GATE** (AGENTS.md: "environment-variable
handling" is a security-related change).

**Three variables — `PORTAL_URL_COMMAND`, `PORTAL_URL_VENDOR`, `PORTAL_URL_BOOKER` — in
`command` only.** Values per environment, where to set them, and the five rules
governing them are in **§4 Operator setup guide**; not repeated here. No secret is
involved (public hostnames); they are server-only because nothing in the browser needs
them and `NEXT_PUBLIC_*` would require a cache-disabled rebuild to change.

**Blast radius:** none to existing behaviour — code that does not read these vars is
unaffected, and an unset var degrades to today's no-email path.

---

### B2 — Creation sends no email at all  ✅ DONE (2026-08-17; live-verified 2026-08-18, command)

> **Executed:** `app/api/users/route.ts` — imports `resolvePortalOrigin`, and after the
> `user_roles` insert resolves the origin and calls
> `supabase.auth.resetPasswordForEmail(email, { redirectTo })`, returning
> `{ error: null, emailStatus, emailError }`. `lib/types.ts` gains
> `CreateUserEmailStatus` and `CreateUserResult`.
> **Verified — machine:** `npx tsc --noEmit` exit 0; `npm test` 41/41; grep confirms the
> ordering — `user_roles` insert `route.ts:56`, send `route.ts:83`, response
> `route.ts:95` still `error: null`, so a mail failure cannot change the HTTP status.
> **NOT verified — needs a live environment:** that an email actually arrives and its
> link opens the set-password form on the target portal. Nothing here proves delivery.
> The staging round-trip in Verification remains the real gate.

**File:** `app/api/users/route.ts:25-57`

The core defect. After the three grant writes succeed, nothing notifies the user.

**Decision (resolved 2026-08-17): recovery email via `resetPasswordForEmail`.**
Rejected alternatives and why:

- **`inviteUserByEmail`** — semantically the right template, but its link carries
  `type=invite`, and recovery is latched on the literal string `"type=recovery"` in
  **all three** portals (`command/lib/supabase/client.ts:42`, `vendor/lib/supabase/client.ts:42`,
  `booker/lib/supabase/client.ts:42`). Adopting it turns a one-app fix into a
  cross-app auth change touching a path that has already produced two separate
  incident plans. Not worth the template wording.
- **`generateLink` + branded Resend email** — best copy, but the
  `send-notification-email` Edge Function is DB-trigger driven and would need an
  ad-hoc invocation path plus a new template. Deferred, not rejected (see DEFERRED).

**Fix approach** — after the grant writes at `route.ts:47-55`, and only then:

```ts
// Four outcomes, not three. `not_configured` (deliberate opt-out, e.g. booker) and
// `misconfigured` (a typo'd or malformed PORTAL_URL_*) must NOT collapse into one
// status — see the note below.
const resolved = resolvePortalOrigin(portals as string[])
let emailStatus: "sent" | "not_configured" | "misconfigured" | "failed"
let emailError: string | null = null

if (resolved.kind === "ok") {
  const { error: mailError } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: resolved.origin,
  })
  emailStatus = mailError ? "failed" : "sent"
  emailError  = mailError?.message ?? null
} else {
  emailStatus = resolved.kind          // "not_configured" | "misconfigured"
  emailError  = resolved.reason        // e.g. 'PORTAL_URL_VENDOR is not a valid origin'
}

return NextResponse.json({ error: null, emailStatus, emailError })
```

**Why `resolvePortalOrigin` returns a discriminated result rather than `string | null`
(revised 2026-08-17):** the original spec collapsed "no origin configured" and "the
configured origin is garbage" into a single `null`. That is a trap. A typo in
`PORTAL_URL_VENDOR` would then produce exactly the same warning toast as booker's
*deliberate* opt-out — so every vendor account created afterwards would silently get no
email while the operator reasonably read the warning as expected behaviour. Splitting
the two costs one union member and turns a silent misconfiguration into a loud one. B1's
resolver signature changes accordingly:

```ts
type ResolvedOrigin =
  | { kind: "ok"; origin: string }
  | { kind: "not_configured"; reason: string }   // var unset or empty — expected for booker
  | { kind: "misconfigured";  reason: string }   // var set but not a valid http(s) origin
```

Non-negotiable properties:
- **A failed email must not fail the request.** The auth user, profile, portals and
  roles are already written and there is no rollback; returning 4xx/5xx here would
  tell the operator the creation failed when it did not, and a retry would collide on
  the email. The account is created; the email is reported separately.
- **It runs after the grants, not before.** The link is only useful once the portal
  rows exist, and a recovery email for an account that then fails its grants is worse
  than none.
- `resetPasswordForEmail` is called on the **service-role client already in scope**
  (`route.ts:23`). This is the public `/recover` endpoint, so it is subject to the
  project's auth email rate limit either way (I4) — the key is not what grants the
  privilege here.
- **No email enumeration concern:** the caller is an already-verified Command
  admin (`verifyCommandCaller`, `route.ts:6-7`), and the address is one they just
  typed, so reporting per-address outcomes to *this* caller leaks nothing.

---

### B3 — `Auth session missing!` — the browser client is PKCE, the emailed link is implicit  ✅ DONE (2026-08-18; live-verified in `command`; shipped to vendor v0.43.2 / booker v0.16.2)

**Observed (production, 2026-08-18):** a Command-created user received the email, opened
the link, reached the set-password form, submitted, and got **`Auth session missing!`**.

**Root cause — confirmed by reading library source at every step, not inferred.**

| # | Fact | Evidence |
|---|---|---|
| 1 | `@supabase/ssr`'s `createBrowserClient` **hardcodes `flowType: "pkce"`** — and does so *after* spreading `...options?.auth`, so a caller's value is silently discarded | `node_modules/@supabase/ssr/dist/main/createBrowserClient.js:35-40` |
| 2 | All three portals pass `{ auth: { flowType: "implicit" } }`, which therefore **has never taken effect**. The comment above it in each file is wrong | `command/lib/supabase/client.ts:4-12`, byte-identical in `vendor/` and `booker/` |
| 3 | `resetPasswordForEmail` attaches a `code_challenge` **only when the requesting client is PKCE** | `auth-js/dist/main/GoTrueClient.js:3506-3518` (`if (this.flowType === 'pkce')`) |
| 4 | Our new send uses the **server admin client** — `@supabase/supabase-js` `createClient`, default flow, no challenge — so GoTrue emails a plain implicit link and redirects with **hash tokens** | `command/lib/supabase/admin.ts`, `app/api/users/route.ts:83` |
| 5 | On landing, auth-js classifies the URL as an **implicit** callback purely on `access_token` being present, regardless of flowType | `GoTrueClient.js:3122-3127` |
| 6 | `_getSessionFromURL` then hits an explicit mismatch guard and **throws**: `case 'implicit': if (this.flowType === 'pkce') throw AuthPKCEGrantCodeExchangeError('Not a valid PKCE flow url.')` — **no session is ever created** | `GoTrueClient.js:3039-3043` |
| 7 | The reset form still renders, because `recoveryDetected` is set from the **raw hash string** at module load, before and independent of any token validation | `command/lib/supabase/client.ts:40-45` |
| 8 | Submit calls `updateUser({ password })` with no session → `AuthSessionMissingError` → the exact message reported | `services/auth.service.ts:23-25` |

**✅ DIAGNOSIS CONFIRMED BY DIRECT EVIDENCE (2026-08-18).** A production retest against
**v0.23.1** (which ships the send but *not* this fix) reproduced the failure and captured
the landing URL. Token redacted; shape and decoded claims recorded:

```
https://command.ezzy.ph/#access_token=<JWT>&expires_at=…&expires_in=3600
   &refresh_token=<redacted>&sb=&token_type=bearer&type=recovery
```

| Evidence | Reading |
|---|---|
| **The fragment is still intact** on the form | The predicted signature of the broken build. auth-js strips the fragment **only after a token validates** — its survival is proof nothing consumed it. |
| `access_token` + `refresh_token` + `token_type=bearer` + `type=recovery` | A textbook **implicit-grant** callback — exactly the shape `_getSessionFromURL` refuses when `flowType === 'pkce'`. |
| JWT `iss` = `…pdkejyjidrfxksaczvfy…` | The **production** project. Rules out a staging/prod crossover. |
| JWT `amr` = `otp`, `session_id` present | GoTrue minted a genuine recovery session. The server side worked. |
| `iat` 14:43:59Z → `exp` 15:43:59Z (60 min) | Not expired at click time. Rules out the mail-scanner/expiry hypothesis. |

**Conclusion: GoTrue handed the browser a complete, valid, unexpired production session,
and the browser refused to adopt it.** Every competing hypothesis (wrong project, expired
token, scanner-consumed token, PKCE `?code=` link) is excluded by the evidence above. No
further investigation is warranted — the remaining work is to ship the fix.

**Why Forgot Password has always worked, and still does.** There the *browser* requests
the link: a PKCE client stores a `code-verifier` locally, GoTrue emails a `?code=` link,
`_isPKCECallback` sees code + verifier, `callbackUrlType` is `pkce`, flowType is `pkce` —
no mismatch, session created. **The bug is precisely that our change made one client
request a link that a differently-configured client consumes.** Nothing about the old
path was broken, and nothing about it protected the new one.

**⚠️ CORRECTION — a claim in this plan was wrong.** §4 and §5 state that reusing the
recovery path means "the receiving app needs no new configuration and no new code" and
that vendor/booker are untouched. That was based on the three portals' recovery
*detection* being byte-identical — which is true, and which is exactly why they are
**all three equally broken** for a Command-triggered link. A Command-created *vendor*
user will fail on `vendor.ezzy.ph` in the identical way. **This work is now cross-app**
(AGENTS.md approval gate), and the "zero portal changes" premise no longer holds.

**Fix approach (Option A, resolved 2026-08-18):** consume the fragment ourselves.

> **✅ EXECUTED (2026-08-18, code) — live check outstanding.**
>
> `lib/supabase/client.ts` in **all three portals** (byte-identical, verified by `diff`):
> - The misleading `flowType: "implicit"` comment is replaced with the real story — the
>   value is discarded by `@supabase/ssr`, why the app worked anyway, and what changed on
>   2026-08-17. The line is left in place so removing it stays a deliberate act.
> - New `readHashTokens()` — returns the `access_token`/`refresh_token` pair only when the
>   fragment is a `type=recovery` implicit callback; a PKCE `?code=` link puts nothing in
>   the fragment, so the whole path is inert for the existing Forgot Password flow.
> - New `recoveryReady` promise: when tokens are present, `client.auth.setSession(tokens)`
>   establishes the session auth-js refused to, then strips the spent fragment.
> - New export `recoverySessionReady()`.
>
> `components/layout/AppShell/useAppShell.ts` in all three portals — `setRecoveryMode(true)`
> now waits on `recoverySessionReady()` (B4).
>
> **Verified — machine:** `tsc --noEmit` exit 0 in command, vendor and booker;
> `npm run build` succeeds in all three; `diff` confirms the three `client.ts` files are
> byte-identical. **Lint improved:** vendor 4→3 errors, booker 2→1 (moving the setState
> into a promise callback cleared a pre-existing `set-state-in-effect`); command clean.
>
> **NOT verified — needs a live environment.** No unit test covers this: `client.ts`
> imports `@supabase/ssr` and touches `window`, and command's runner only executes
> `lib/**/*.test.ts` under plain node. **The only proof is a real link.**

### B4 — A failed recovery still renders a working-looking set-password form  ✅ DONE (2026-08-18, code) — live check outstanding

**File:** `command/lib/supabase/client.ts:40-45` (and the byte-identical copies in
`vendor/` and `booker/`); `components/layout/AppShell/useAppShell.ts:87-93`;
`components/layout/AppShell/AppShell.tsx:36-38`.

`recoveryDetected` is latched on `window.location.hash.includes("type=recovery")` — a
**string match on the raw fragment**, evaluated at module load, with no knowledge of
whether a session was created. So when B3's mismatch throws, the app confidently renders
a form the user cannot possibly submit, and the only feedback is a library error string
after they have typed a password twice.

The error is also **swallowed**: auth-js returns it from `_initialize`, and nothing reads
that. `lib/authHashError.ts` only parses `error=` *in the fragment* — this failure is a
client-side throw, so it is invisible to that guard. This is the same class of defect as
`.plans/2026-08-10-auth-recovery-link-silent-failure.md`, in a different layer.

**This is worth fixing even after B3 lands.** B3 makes the session appear in the expected
case; B4 is what stops the *next* unexpected case from presenting a dead form. Expired
links, consumed-by-scanner links and future flow changes all land here.

**Fix approach:** gate the reset view on an actual session rather than a string, and
surface the initialisation error. Concretely: after the client settles, check
`getSession()`; if recovery was detected but no session exists, render the login view
with a clear message ("This set-password link is no longer valid — ask an administrator
to send a new one") instead of the form. Couples to B3's chosen option, so it ships in
the same batch.

**Coupling:** B3 ↔ B4 — same files, same three portals, shipped together (2026-08-18).

> **✅ EXECUTED (2026-08-18, code) — live check outstanding.** Two halves:
> - **The form waits for a session.** `useAppShell.ts` (all three portals) gates
>   `setRecoveryMode(true)` on `recoverySessionReady()`, so the set-password form cannot
>   render before the session behind it exists.
> - **A rejected link explains itself.** When `setSession` fails — expired, revoked, or
>   already spent by an email security scanner prefetching the link — `client.ts`
>   discharges the recovery latch, rewrites the fragment into the
>   `error=access_denied&error_code=otp_expired` shape that `lib/authHashError.ts` already
>   parses, and reloads. **Deliberately reuses the existing, unit-tested error path**
>   (`vendor/lib/authHashError.test.ts`) rather than inventing a second one, so there is
>   one place that turns an auth failure into actionable copy.
>
> **Verified — machine:** as B3. **NOT verified:** the rejected-link path has not been
> exercised against a real expired token.

---

### B5 — The reset form never appears: LoginPage latches the "login" view  ✅ DONE (2026-08-18; live-verified in `command`; shipped to vendor v0.43.2 / booker v0.16.2)

**Observed (production v0.23.2, 2026-08-18):** with B3 deployed, `Auth session missing!` is
gone — the session is now created. But the link lands on the **ordinary login form**; the
set-password form never appears.

**⚠️ THIS IS A REGRESSION I INTRODUCED IN B3, not a pre-existing bug surfacing.** Recorded
plainly because the plan is worthless if it launders its own mistakes.

**Root cause — three facts, each verified in the code:**

| # | Fact | Evidence |
|---|---|---|
| 1 | `initialView` is read into `useState` on the component's **first mount only**; later prop changes are ignored | `components/auth/LoginPage/useLoginPage.ts:10` — `useState<LoginView>(initialView)` |
| 2 | Both branches render `<LoginPage>` at the **same position with the same element type**, so React treats the switch as an update and **preserves the existing state** | `components/layout/AppShell/AppShell.tsx:37-41` |
| 3 | `LoginPage` is `dynamic(…, { ssr: false })`, so its mount waits on a chunk load | `AppShell.tsx:7-10` |

Sequence: module load starts `setSession` (**a network round-trip**) → React mounts with
`recoveryMode` still false → renders `<LoginPage />` with no `initialView` → the chunk
lands and LoginPage mounts, latching `useState("login")` → `setSession` resolves →
`setRecoveryMode(true)` → `<LoginPage initialView="reset" />` renders into the **same
instance**, and the prop is ignored. The user sits on the login form.

**Why it worked before B3:** the old code flipped `recoveryMode` **synchronously** — a bare
string check, no I/O — which beat the dynamic chunk load, so LoginPage's *first* mount
already carried `initialView="reset"`. B3 inserted a network round-trip ahead of that flag
and lost the race. **The previous behaviour was a race that happened to fall the right
way**, sitting on a latent fragility (prop-as-initial-state behind a lazy component). That
is why no test caught it: nothing was ever asserting the ordering.

**Also fixed here — a second latent hole in B3, found while reading:** `_setSession`
returns `{ error }` for an `AuthError` but **re-throws anything else**
(`GoTrueClient.js:2852-2857`). A network blip or lock timeout would therefore leave
`recoveryReady` **rejected**, every `.then()` on it skipped, and the app silently stuck out
of recovery mode — B3's failure class arriving by a different route. The promise now has a
rejection arm.

> **Executed (2026-08-18) — all three portals:**
> - `lib/supabase/client.ts` — failure handling extracted to `failRecovery()`, wired to
>   **both** the `{ error }` result and the rejection arm; new synchronous
>   `isRecoveryResolving()` so the shell can know *before its first render* that it does
>   not yet know which view to show. All three files verified byte-identical by `diff`.
> - `useAppShell.ts` — new `recoveryResolving` state, seeded synchronously from the URL and
>   cleared when the promise settles (including on failure, so the shell can never stay
>   blank).
> - `AppShell.tsx` — `if (recoveryResolving) return null` before any LoginPage branch, plus
>   a **`key` on every LoginPage branch** (`reset` / `login` / vendor's `select_vendor`) so
>   a view switch always remounts. The key is the guard against this whole class of bug
>   recurring; the gate is what removes the race.
> - SSR-safe: `isRecoveryResolving()` is false on the server and the guarded branch renders
>   `null`, which is also what `dynamic(ssr:false)` renders there — so hydration matches.
>
> **Verified — machine:** `tsc --noEmit` exit 0 in all three; `npm run build` green in all
> three; `npm test` 41/41 in command; `diff` confirms the three `client.ts` remain
> byte-identical. Lint: 0 errors in command (3 pre-existing warnings — unused type imports
> and one exhaustive-deps, untouched).
>
> **NOT verified — needs a live environment.** The ordering this fixes is a browser race;
> no unit test in this repo can observe it. **A real link is still the only proof.**

**Lesson worth keeping:** B3 changed a synchronous flag into an asynchronous one. That is
never a local change — every render path that read the flag inherited a new "not known
yet" state, and the one that mattered silently committed to the wrong answer. When making
a flag async, audit its readers, not just its writer.

### B6 — Review: does B5 break Forgot Password in vendor/booker?  ✅ REVIEWED (2026-08-18) — no regression found

Requested review of the vendor/booker changes, with **Forgot Password continuing to work**
as the priority. Reviewed by reading every diff and tracing both flows end to end.

**Verdict: no regression found, and the `key` change makes Forgot Password *more*
reliable than it was.**

**The PKCE (Forgot Password) flow is untouched by the new code — traced step by step:**

| Step | What happens | Why the new code is inert |
|---|---|---|
| 1 | Browser requests the reset; PKCE client stores a `code-verifier` locally | unchanged |
| 2 | GoTrue mails a **`?code=…`** link — **no URL fragment at all** | — |
| 3 | `readHashTokens(window.location.hash)` runs on an **empty hash** → `URLSearchParams("")` → `type` is null → returns `null` | **`setSession` is never called.** The B3/B5 path does not execute. |
| 4 | `isRecoveryResolving()` → same check → `false` | `recoveryResolving` is false, so **no blank screen** and the shell renders normally |
| 5 | auth-js sees `?code=` + stored verifier → exchanges it → emits `PASSWORD_RECOVERY` | unchanged |
| 6 | `recoveryDetected` latches, `setRecoveryMode(true)` | unchanged |
| 7 | AppShell switches `key="login"` → `key="reset"` → **remount** → `useState("reset")` | **the improvement — see below** |

**⚠️ Finding: the PKCE flow had the SAME latent race as B5 all along.** Before this change,
step 7 reused one `LoginPage` instance, so `initialView="reset"` was ignored whenever
LoginPage had already mounted as `"login"` — which is decided by whether the code exchange
beats the component mount. Forgot Password worked because that race usually fell the right
way, not because it was correct. The `key` makes it deterministic in all three portals.
**This is a reliability gain for a flow that was previously working by luck.**

**Vendor-specific risk investigated and cleared — the third `LoginPage` branch.** Vendor
renders LoginPage in three places, so adding keys could have changed remount behaviour in
the vendor-selection step:

- The multi-vendor picker shown right after an interactive login is **internal to the
  `key="login"` instance** (`useLoginPage.ts:237-238` sets `userVendors` then
  `setLoginView("select_vendor")`). The key never changes during that transition, so there
  is no remount and no state loss. ✅
- The AppShell-level `key="select_vendor"` branch is reachable **only from the mount
  effect** (`useAppShell.ts:249` — `setPendingVendors(vendors)` then `setLoggedIn(true)`),
  where `isCheckingAuth` holds the render at `null` until it settles. LoginPage's **first**
  mount is therefore already the `select_vendor` one, with `initialVendors` populated. The
  key is inert there. ✅
- `handleLoginSuccess` always sets `selectedVendorId` (`useAppShell.ts:544`), so
  `loggedIn && !selectedVendorId` cannot arise from an interactive login — the
  `login → select_vendor` remount does not occur in practice. ✅

**Hydration checked, because vendor differs from the other two.** Vendor imports
`LoginPage` **statically** (`AppShell.tsx:6`), not via `dynamic(ssr:false)`, so a
client-only `return null` could have mismatched the server HTML. It does not:
`isCheckingAuth` starts `true` (`useAppShell.ts:150`), so vendor renders `null` on both the
server and the first client render regardless. Command and booker use `dynamic(ssr:false)`,
which renders `null` server-side anyway. ✅

**Verification run (2026-08-18):**

| Check | command | vendor | booker |
|---|---|---|---|
| `tsc --noEmit` | ✅ | ✅ | ✅ |
| `npm run build` | ✅ | ✅ | ✅ |
| Unit tests | ✅ 41/41 | ✅ 220/220 | — (no test script; pre-existing) |
| Lint, before vs after | 0 errors both | 5 problems both | 1 problem both |
| Line endings | — | — | 103/103 CRLF, none mixed |

Lint counts are **identical before and after** in vendor and booker (measured by stashing
the change and re-running), so nothing new was introduced; the remaining problems are
pre-existing.

**Residual risks, stated rather than buried:**
1. **No live browser test** has been run against vendor or booker. The tracing above is
   code reading, not evidence.
2. **If `setSession` never settles** — a hung network request — `recoveryResolving` stays
   `true` and the shell stays blank. There is no timeout. Low likelihood (auth-js applies
   its own lock timeouts) but real, and it only affects a visit that carries recovery
   tokens in the fragment.
3. **The invariant protecting Forgot Password is argued, not tested.** "`readHashTokens`
   returns null for a PKCE URL" is the single fact keeping the new path inert. It is a pure
   function and could be extracted into `lib/recoveryHash.ts` and unit-tested under the
   existing `lib/**/*.test.ts` glob in command and vendor — see I11.

### I11 — The Forgot-Password invariant is untested  ⬜ TODO

**File:** `lib/supabase/client.ts` (`readHashTokens`, all three portals).

The whole no-regression argument in B6 rests on one line: a PKCE `?code=` URL has no
fragment, so `readHashTokens` returns `null` and the new recovery path never runs. That is
currently guaranteed by reasoning alone — nothing fails if a future edit widens the parser.

**Fix approach:** extract `readHashTokens` into a pure `lib/recoveryHash.ts` (no `window`,
no `@supabase/ssr` import, so it is importable under plain node) and add
`lib/recoveryHash.test.ts` asserting: PKCE URL with `?code=` and empty hash → `null`;
empty hash → `null`; `#` alone → `null`; error fragment (`#error=access_denied…`) → `null`;
`type=recovery` with both tokens → the pair; `type=recovery` missing `refresh_token` →
`null`. Ships to all three portals to keep `client.ts` byte-identical; the test runs in
command and vendor (booker has no test script).

**Why it is I-tier and not a blocker:** the behaviour is currently correct — this protects
it from a future edit rather than fixing anything broken today.

### B7 — Command portal + a non-privileged role creates a guaranteed-lockout account  ✅ DONE (2026-08-18; happy path live-verified — Command+Admin creates and signs in)

**Observed (production, 2026-08-18):** the whole onboarding chain finally worked — email
received, link opened the set-password form, password set — and then login was refused
with **"You do not have access to the Command portal."** (`useLoginPage.ts:43`).

**Root cause: the account was created with a role that cannot sign in to Command.**
`verifyCommandAccess` (`command/services/command.service.ts:19-22`) requires **all three**
of active status, the `command` portal, **and** a role of `admin` or `root`. Granting the
portal alone is not enough. Meanwhile `useUserForm.ts:11` defaults the role to
**`member`** — so ticking "command" and leaving the role untouched produces an account
that can set a password and can never log in.

**Reproduced against the real local schema, with RLS enforced as the user** (script run
2026-08-18: create the user exactly as `POST /api/users` does, set a password, sign in
with the **anon** key, then run `verifyCommandAccess`'s three queries):

| Trial | profiles | user_portals | user_roles | Result |
|---|---|---|---|---|
| **A** role=`admin` + command | `active` | `command` | `admin` | **ALLOWED = true** |
| **B** role=`member` + command | `active` | `command` | `member` | **ALLOWED = false** ← the reported symptom |

**Hypotheses eliminated by this run — none of these are the problem:**
- *Writes failing silently.* All three writes return `ok`; the resulting rows are exactly
  right. Verified by replaying the route's sequence with every error checked.
- *RLS blocking a new user from reading their own rows.* `users can read own portals` /
  `users can read own roles` (`20260504000003_rls.sql:93,113`) plus self-read on
  `profiles` mean trial A reads everything back correctly.
- *Lookup tables unreadable.* `authenticated` has SELECT on `statuses`/`portals`/`roles`
  (`20260504000003_rls.sql:26-37`); the embedded reads return names fine.
- *`prevent_status_self_update` blocking the status change.* It explicitly exempts
  service-role — `auth.uid() is null` short-circuits it (`20260504000002_schema.sql:187-188`).
- *Missing table grants.* `service_role` holds full DML on all public tables
  (`20260620000001_api_role_grants.sql:33`).
- *The root-only tiering migration.* `20260807000001_command_access_grant_root_only.sql`
  deliberately leaves **reads wide open** and only narrows writes.

**✅ NO MIGRATION IS REQUIRED.** The schema, RLS, grants and triggers are all correct and
behave as designed. This is an application-layer validation gap.

**The rule is intentional and documented**, so the fix must enforce it rather than
loosen it: `architecture/auth-and-roles.md:252` states Command access is *"active + command
portal + admin or root role"*, and `:235` records that *"the command portal is root-only"*.
`route.ts:14-21` already guards **who may grant** command access — it never checks whether
the granted combination is **coherent**.

**Fix approach (pending the decision below):** reject the incoherent combination
server-side in `POST /api/users` — `portals` including `command` with a role outside
`PRIVILEGED_ROLES` returns 400 with a message naming the problem — and prevent it in the
Add/Edit form so the operator cannot reach that state. Same check on `PATCH`-equivalent
role edits so an existing Command admin cannot be demoted into a lockout.

**Immediate unblock, no code needed:** root opens that user in Command, sets **Role =
Admin**, saves. The account then logs in with the password already set.

> **Executed (2026-08-18) — `command` only, no migration.**
> - New **`lib/userAccess.ts`** — `commandAccessError(portals, role)` plus the
>   `PRIVILEGED_ROLES` set, dependency-free (no `window`, no `next/headers`, no Supabase)
>   so the server route, the browser edit mutation and the form can all share **one**
>   copy. `PRIVILEGED_ROLES` moved here from `commandAuth.server.ts`, which now imports
>   and re-exports it — that module pulls in `next/headers` and so could never be reached
>   from client code or a test.
> - New **`lib/userAccess.test.ts`** — 11 cases pinning both directions: command+admin and
>   command+root allowed; command+member (the form default), command+missing role,
>   command+unknown role rejected; and non-Command grants explicitly left alone.
> - **`app/api/users/route.ts`** — rejects the combination with 400 **before `createUser`**,
>   so nothing is written; past that point there is no rollback.
> - **`hooks/mutations/users/useUpdateUser.ts`** — same guard on the edit path. Edits go
>   straight to Supabase from the browser, not through the route, so without this an
>   existing Command admin could be demoted to `member` and locked out just as effectively.
> - **`components/users/UserModal/UserModal.tsx`** + `.module.css` — the reason is shown
>   inline and **Save is disabled**. Affordance, not boundary: both writes enforce it.
>
> **Component separation:** no new component; the message is static markup in the existing
> render layer, the rule is a pure function in `lib/`, styling is a new class in the
> co-located module CSS. No state added, no inline styles.
>
> **Verified — machine:** `npm test` **52/52** (41 → 52, +11 new); `tsc --noEmit` exit 0;
> `npm run build` green; lint unchanged at 6 pre-existing `no-explicit-any` errors (I8),
> none added.
> **NOT verified — needs a live environment:** creating a user through the real form and
> seeing the block, and the corrected account signing in.

### B8 — `POST /api/users` ignores the errors from all three post-create writes  ✅ DONE (2026-08-18, code) — live check outstanding

**File:** `command/app/api/users/route.ts:41-56`

```ts
await supabase.from("profiles").update({ … }).eq("id", userId)          // error discarded
if (portalRows?.length) await supabase.from("user_portals").insert(…)   // error discarded
if (roleRow)            await supabase.from("user_roles").insert(…)     // error discarded
```

None of these check `error`. The route then returns success regardless, so a partially
provisioned account — auth user created, portal or role missing — is reported as a clean
creation, an email goes out, the person sets a password, and the failure only surfaces as
the same opaque *"You do not have access to the Command portal."*

**This is not what happened on 2026-08-18** — the writes were verified to succeed (B7) —
which is precisely why it deserves fixing: it is a latent second cause of an identical,
already-confusing symptom, and it cost investigation time to rule out.

**Fix approach:** check each error; on failure return a 4xx/5xx naming which step failed,
and include it in the response so `notifyCreated` can surface it. The auth user already
exists at that point and there is no rollback, so the message must say the account was
created but is **incomplete**, and point at re-editing it — never imply nothing happened.

**Coupling:** ships with B7 — both are about the create route telling the truth about what
it produced.

> **Executed (2026-08-18):** each of the three writes now checks its error and returns a
> 500 naming the step that failed — *"The account was created, but granting portal access
> failed: … Edit the user to finish setting it up."* The wording never implies nothing
> happened, because the auth user exists by then and a retry would collide on the email.
> `useUsers.saveUser` also refreshes the list when an **add** fails, so the
> half-provisioned account is visible and can be completed rather than seeming to vanish.
> **Verified — machine:** `tsc`, `npm test` 52/52, `npm run build`. **NOT verified:** the
> failure path itself — it needs an induced write failure to exercise.

## IMPORTANT

### I1 — `booker.ezzy.ph` points at the STAGING Supabase project  ✅ DONE (2026-08-17)

> **Executed:** handled by configuration exactly as designed — **no booker branch exists
> in the code**, verified by grep. Production leaves `PORTAL_URL_BOOKER` blank, which
> `resolvePortalOrigin` reports as `not_configured`, which `notifyCreated` renders as the
> warning toast. Documented in `architecture/overview.md` beside the existing ⚠️ row
> (including the repoint-then-set ordering) and in the new `command/README.md` env
> section. **Verified — machine:** grep for `booker` in `app/api/users/**` returns only
> the shared resolver path. **NOT verified:** the live toast.

**File:** `architecture/overview.md:89` — *"`booker.ezzy.ph` | **staging**
`fbxbwnfeimzhgxpshdpa` | ⚠️ deliberate — booker is not launched; repoint at
production when it is"*.

A recovery token minted by the **production** project cannot be validated by a page
whose Supabase client points at **staging**. A booker-portal user created in
production Command would receive a link that lands on `booker.ezzy.ph` and fails with
`otp_expired` — which, thanks to `.plans/2026-08-10-auth-recovery-link-silent-failure.md`,
at least now shows an error banner instead of a blank login, but is still a dead link.

**This is handled by configuration, not by a code special case.** B1 already treats an
unset var as "do not send", so production Command simply **leaves `PORTAL_URL_BOOKER`
unset** until booker is repointed. Booker-only users then keep today's behaviour and
the operator is told so explicitly (I2). No booker-specific branch enters the code —
when booker launches, setting one variable turns it on.

**Fix approach:** document the deliberate omission in `architecture/overview.md`
beside the existing ⚠️ row, and in the README env table (I5).

### I2 — The operator is not told what happened to the email  ✅ DONE (2026-08-17, code) — toasts need a human

> **Executed:** `hooks/mutations/users/useCreateUser.ts` now returns `CreateUserResult`
> and passes `emailStatus`/`emailError` through instead of dropping them.
> `components/users/UsersPage/useUsers.ts` gains a module-level `notifyCreated()` with
> one branch per outcome — `sent` success, `not_configured` warning (8s),
> `misconfigured` error naming the variable (12s), `failed` error with the provider
> message (12s), plus a `default` for an unparsable/older response that claims only what
> is certain. `components/users/UserModal/UserModal.tsx` — the add-mode note no longer
> says "sends no email"; it now states a set-password link is emailed and that a portal
> must be granted for it to be sent. The `// "Add", not "Invite"` comment was updated
> rather than deleted: the name still avoids implying Supabase's invite flow, which this
> deliberately does not use.
> **Verified — machine:** `tsc --noEmit` exit 0; `eslint` clean on every file touched
> (see I8 for the pre-existing errors left alone).
> **Correction to this plan (2026-08-17): there is no `useraddmodal` baseline to
> regenerate.** The plan asserted a pixel-diff would need refreshing. In fact
> `find visual-tests -name '*.png'` returns **0** and `git ls-files visual-tests/*`
> returns nothing — Command tracks no baselines and has none on disk, so the reworded
> note invalidates nothing and a regeneration would only create first-ever snapshots,
> proving nothing about the change. Claiming "baseline regenerated" here would have been
> a fabricated verification.
> **NOT verified — needs a human:** the four toast variants rendering.

**Files:** `components/users/UsersPage/useUsers.ts:82-88` (the current toast asserts
*"no password set… No email was sent"* — about to become a lie);
`hooks/mutations/users/useCreateUser.ts:14-18` (discards everything in the response
body except `error`).

Three real outcomes now exist and the operator must be able to tell them apart —
"the invite is in their inbox" and "nobody has been told anything" cannot look alike.

**Fix approach:**
- `useCreateUser.ts` — widen the return to
  `{ error: string | null; emailStatus?: EmailStatus; emailError?: string | null }`,
  passing the body through instead of dropping it. Type the status as a union in
  `lib/types.ts`, not a bare `string`.
- `useUsers.ts:82-88` — replace the single toast with one per outcome:
  - `sent` → `toast.success("<name> created — set-password link sent to <email>.")`
  - `not_configured` → `toast.warning` retaining today's instruction copy
    ("no email was sent; they must use Forgot Password on their portal"), because
    that is once again the literal truth for this case. This is the *expected* path for
    a booker-only user in production.
  - `misconfigured` → `toast.error` naming the offending variable
    ("<name> was created, but PORTAL_URL_VENDOR is not a valid origin — no email was
    sent. Fix the environment variable and use Send set-password link."). Deliberately
    an **error, not a warning**: this is a deployment fault, and rendering it the same
    as booker's intentional opt-out is what would let it go unnoticed.
  - `failed` → `toast.error("<name> was created, but the set-password email failed: <emailError>")`,
    with the longer 8-second duration and an explicit "use Send set-password link to
    retry" pointer (I6). The account **exists** — the copy must not imply otherwise.
- `UserModal.tsx:112-119` — the add-mode note must stop promising no email. Reworded
  to state that a set-password link is emailed on creation, and that a portal must be
  selected for it to be sent. **This changes the `useraddmodal` visual baseline** — see
  Verification.

**Component separation:** no new component. `UserModal.tsx` stays a pure render layer
(the note is static markup); all new state and branching lives in the existing
`useUsers.ts` hook; the note's styling reuses the existing
`UserModal.module.css` `.noPassword*` classes — reworded copy, no inline styles.

### I3 — Redirect URLs must be allow-listed for every origin we send  ⏸ PARKED (2026-08-17)

**Why parked:** this is a Supabase Dashboard read/write (Authentication → URL
Configuration) that cannot be performed or verified from this repo. Marked ⏸ rather
than ✅ for the same reason `.plans/2026-08-10-auth-recovery-link-silent-failure.md`
parked its I1/I3 — nothing here can check it.
**Unblocked by:** the user confirming, in the production project
(`pdkejyjidrfxksaczvfy`), that the Redirect URL allowlist contains
`https://command.ezzy.ph` and `https://vendor.ezzy.ph` (and the staging equivalents in
`fbxbwnfeimzhgxpshdpa`). `architecture/supabase-production-setup.md:171-172` already
requires this.
**Consequence if missed:** GoTrue silently substitutes the Site URL, so a vendor user's
link would land on whatever Command/Site URL is configured — the exact wrong-portal
outcome B1 exists to prevent. **Low risk in practice:** vendor already runs its own
Forgot Password against the same project, so `vendor.ezzy.ph` is almost certainly
already allow-listed. Confirm rather than assume.

### I4 — Auth email rate limit and per-address cooldown  ✅ DONE (2026-08-17, code + docs) — dashboard read still with the user

> **Executed:** no code guard, as planned — GoTrue's own message is surfaced verbatim in
> the `failed` toast (`useUsers.ts`) and in the resend error toast, because duplicating
> the rule client-side would drift from it. Both limits documented in the new
> `command/README.md` "Auth email limits" section, including that the budget is shared
> project-wide with every portal's own Forgot Password. **Still with the user:**
> confirming the hosted hourly rate limit is sane for onboarding volume.

**File:** `backbone/supabase/config.toml:195-196` — `email_sent = 2` per hour (local);
`:225` — `max_frequency = "1s"` (local). The hosted project's values are dashboard
config and are **not** these.

Two distinct limits now sit on a user-facing action:
- **Hourly project cap.** Onboarding a batch of staff in one sitting will hit it, and
  GoTrue returns 429. B2 already routes that into `emailStatus: "failed"` with the
  provider message, so it surfaces as a per-user error instead of a silent drop.
- **Per-address `max_frequency` cooldown.** Two sends to the same address inside the
  window return *"For security purposes, you can only request this after N seconds."*
  This lands squarely on the resend action (I6) and on create-then-immediately-resend.

**Fix approach:** no code guard, no client-side timer — the server's message is
authoritative and duplicating the rule locally would drift from it. Surface the
provider message verbatim in the toast (I2/I6) and note both limits in the README
(I5). Ask the user to confirm the hosted `Rate limit for sending emails` value is
sane for onboarding volume (see DECISIONS — informational, not blocking).

### I5 — Documentation is now wrong in three places  ✅ DONE (2026-08-17)

> **Executed:** `architecture/auth-and-roles.md` — the line claiming recovery is an
> unstarted onboarding path now points at the new flow; the shared-minimum note records
> `lib/password.ts`; and a new **"How a Command-created user gets a password"** section
> gives the three paths, why it is a `recovery` and not an `invite` link, how the origin
> is resolved, and why blank ≠ malformed. `architecture/overview.md` — the booker row
> carries the consequence and the repoint ordering. `command/README.md` — new
> "Environment variables" section (all nine variables, the `PORTAL_URL_*` table, the five
> rules, auth email limits), the create-flow list gains step 5, and the key-files map
> gains the two new routes and two new hooks. **Verified — machine:** re-read against the
> shipped code; `grep` for "sends no email"/"No email was sent" across `components/` and
> `app/` now returns **only** the two root-set-password strings, where it is true.

**Files:**
- `architecture/auth-and-roles.md:48` — *"Command creates every user without one …
  making recovery their only onboarding path"*: still true that no password is set,
  but the recovery mail is now sent automatically. Update to describe the new flow.
- `architecture/auth-and-roles.md:65-80` — the "Changing a password while signed in"
  section should gain the root-set-password path (B3/I6) so the three ways a password
  can be established are documented in one place.
- `command/README.md` — **correction (2026-08-17): there is no env table to extend.**
  `grep -i env README.md` returns nothing across its 115 lines, so this is a *new*
  "Environment variables" section listing all nine vars the app reads (the six already
  in `.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_DOMAIN`,
  `PAYOUT_ENCRYPTION_KEY` — plus the three new `PORTAL_URL_*`), with the I1 note that
  `PORTAL_URL_BOOKER` is intentionally unset in production and the two limits from I4.

Also add a short "how a Command-created user gets a password" subsection to
`architecture/auth-and-roles.md` — the three paths (auto email on create, root
resend, root sets directly) and which to reach for.

**Noted, not fixed (out of scope):** `command/README.md` is stale in a larger way — it
is titled "RS Command" for the "DriveBook platform", describes an `academies`/"Schools"
page and an "academy, learner, command" portal trio, none of which match the current
Ezzy vendor/booker product. Rewriting it is a separate job; this plan only adds the
env section and does not inherit the surrounding inaccuracy.

### I6 — Root cannot set a password, and cannot resend the link  ✅ DONE (2026-08-17, code) — live check outstanding

> **Executed — 8 files.** New routes `app/api/users/password/route.ts` and
> `app/api/users/send-set-password-link/route.ts`, both root-gated. New
> `lib/password.ts` (`MIN_PASSWORD_LENGTH`), now the single source for the recovery form
> (`useLoginPage.ts`), Settings → Password (`useSecuritySettingsPage.ts`) and the new
> route — the literal `8` no longer appears in three places. New mutation hooks
> `useSetUserPassword.ts`, `useSendSetPasswordLink.ts`. New component
> `components/users/UserSetPasswordModal/` (`.tsx` + `useUserSetPasswordModal.ts` +
> `.module.css`). Entry points: two root-only footer buttons in `UserModal.tsx` view
> mode; modal state and the resend action in `useUsers.ts`; rendering in `UsersPage.tsx`.
> New `usersetpassword` ui-gallery fixture.
> **Verified — machine:** `tsc --noEmit` exit 0; `npm test` 41/41; eslint clean on every
> file touched; grep confirms `caller.isRoot` is checked *before* `createAdminClient()`
> in both routes (`password/route.ts:30` vs `:47`; `send-set-password-link/route.ts:27`
> vs `:34`); grep confirms the new `.tsx` contains no `useState`/`useEffect` and no
> `style={{}}`.
> **Component separation:** satisfied as planned — render layer is pure, all state and
> the submit handler are in the companion hook, all styling in the co-located module CSS
> (including the disabled-button treatment, which `UserModal` still does inline).
> **Deviation from plan, disclosed:** the plan called for the resend route to be
> root-gated "in the first cut" and it is; the plan also called for **route tests**
> asserting a non-root caller gets 403 before any admin-client call. Those were **not
> written** — see I9. The ordering is verified by grep and inspection only.
> **NOT verified — needs a live environment:** that a root-set password actually signs
> in, and that the resend link arrives.

**Files:** `app/api/users/route.ts` (new branch), `components/users/UserModal/UserModal.tsx`
(entry point), new `components/users/UserSetPasswordModal/`.

**Answering the sizing question directly: this is a small lift.** The Supabase side is
one call — `admin.updateUserById(id, { password })`. There is no schema change, no new
dependency, no new auth concept, and no RLS work (the route uses the service-role
client and the caller check already exists). The cost is almost entirely the modal.
Estimate: ~150 lines across 5 files, of which ~40 are the API branch.

**Decisions (resolved 2026-08-17): root-only, any target, from the user detail modal;
plus a "Send set-password link" action for existing users.**

**Route — two new actions on the users route.** Both gated on `caller.isRoot` from the
existing `verifyCommandCaller()` (`lib/commandAuth.server.ts:43`), rejecting non-root
with 403 before the admin client is touched:

```ts
// POST /api/users/password  — root only
{ id, password }  → admin.updateUserById(id, { password })

// POST /api/users/send-set-password-link  — root only
{ id }            → resolve target email + portals, then
                    resetPasswordForEmail(email, { redirectTo: resolvePortalOrigin(portals) })
```

Design notes carrying real weight:
- **Root-only for the password set, matching the existing tiering.** `route.ts:14-21`,
  `:94-96` and `:120-122` already reserve every privilege-adjacent operation for root,
  with the reasoning inline at `:11-13`. Letting an admin set another user's password
  would be a one-step account takeover of a root account and would defeat that
  tiering entirely — the identical hazard the PATCH route already guards.
- **No new privilege is created.** Root can already take over any account today via
  `PATCH /api/users` (change the login email, then reset). This makes an existing
  capability honest and one step instead of three.
- **The resend action may be admin-gated rather than root-gated**, since it only mails
  the address already on file and grants nothing — but it is kept root-only in the
  first cut for a single, simple rule. Revisit if admins need it.
- **New route file vs. a discriminator on POST:** these go in
  `app/api/users/password/route.ts` and `app/api/users/send-set-password-link/route.ts`
  rather than branching the existing `POST` on an action field. The existing POST means
  "create a user"; overloading it would put three unrelated authorization rules in one
  handler. Both new files import `verifyCommandCaller` and `resolvePortalOrigin` — no
  duplicated logic.
- **Minimum length 8**, mirroring `useSecuritySettingsPage.ts:8` and
  `useLoginPage.ts:65`, and enforced **server-side as well** — a client-only rule on an
  admin endpoint is not a rule. Extract the shared constant rather than typing `8` a
  fourth time.
- **The password is never logged, never echoed in a response, and never stored
  anywhere but GoTrue.** The response is `{ error: string | null }` only.
- **Root may set its own password here**; that is harmless (Settings → Password already
  does it) and excluding it adds a branch for no benefit.

**New component — `components/users/UserSetPasswordModal/`**, three files, satisfying
`.claude/skills/component-separation/SKILL.md` explicitly:
- `UserSetPasswordModal.tsx` — **pure render layer.** No `useState`, no `useEffect`, no
  business logic, no inline `style={{}}`. Composes the existing
  `ModalOverlay` + `FormLabel` primitives, and takes the hook's return as props.
- `useUserSetPasswordModal.ts` — all state (`password`, `confirm`, `show`, `saving`,
  `error`) and the submit handler. Deliberately modelled on
  `useSecuritySettingsPage.ts:10-46`, including the "only flag a mismatch once the
  confirm field has content" rule, so the three password forms in this app cannot
  disagree about what is acceptable.
- `UserSetPasswordModal.module.css` — all styling, using `--rs-*` tokens so both
  themes come free (the pattern `UserModal.module.css` established).

**Entry points in `UserModal.tsx` view mode, root-only** (`isRoot` is already a prop,
`UserModal.tsx:22`): a "Set password" button and a "Send set-password link" button in
the footer beside "Edit User". Both are gated on `isRoot` in the render layer for UX
only — the routes enforce it. The modal's open/close state and the resend call live in
`useUsers.ts` alongside the other user actions, not in the render layer.

### I7 — Local dev ports are start-order dependent, not configured  ✅ DONE (2026-08-17, documentation)

> **Executed:** documentation only, as planned — the three `dev` scripts are untouched.
> The explicit-port requirement is in §4 rule 2 of this plan and in the
> `command/README.md` `PORTAL_URL_*` section. **Verified — machine:** `git diff` shows no
> change to `package.json` in any app.

**Files:** `command/package.json:6`, `vendor/package.json:6`, `booker/package.json:6` —
all three are `"dev": "next dev --webpack"` with no `-p`.

Discovered while verifying Stage 0 (2026-08-17). The `PORTAL_URL_*` local values assert
vendor = 3001 and booker = 3002, but nothing enforces that: `next dev` takes 3000 and
increments only when the port is taken, so whichever app starts first wins 3000. Start
vendor before command and Command's "vendor" link points at Command.

**Why it matters here and not before:** until now no app needed to know another app's
port, so start-order drift was invisible. B2 makes Command send users to a port it
cannot observe.

**Fix approach:** documentation, not code — do **not** add `-p` flags to the shared
`dev` scripts, which would be an unrelated change to three repos for a testing
convenience. Note the explicit-port requirement in the §4 guide (done) and in the
`command/README.md` env section (I5). Confirm the actual port before trusting a local
end-to-end result.

**Severity:** IMPORTANT for *verification integrity*, not for production — deployed
environments use real hostnames and are unaffected.

### I10 — v0.23.1 shipped the send without the landing fix, and is minting dead links  ✅ RESOLVED (2026-08-18) — v0.23.4 deployed and verified; links minted between v0.23.1 and v0.23.4 are still dead and need a re-send

**Not a code defect — a release-sequencing one, and it is live right now.**

Commit `6f036c5` ("fix for user adding and password") shipped Stages 1–4 and was released
as **v0.23.1**. That release contains the *sending* half of the feature and none of the
*landing* half: B3/B4 were written afterwards and, as of 2026-08-18,
`git log -S "readHashTokens" -- lib/supabase/client.ts` returns **nothing** — they have
never been committed in any of the three portals.

**Consequence:** every user created through production Command since v0.23.1 receives a
set-password email whose link **cannot work**, and gets `Auth session missing!` on submit.
The 2026-08-18 retest was this, not a new bug.

**Mitigations, in order:**
1. **Now, without deploying anything:** provision Command admins with **Set password**
   (root-only, in the user detail modal). It touches no email and no link, so it is
   unaffected — this is also the path the 2026-08-18 decision already records as correct
   for admins.
2. **Commit B3/B4 in all three portals, deploy `command` first** (see the rollout note in
   the retest checklist).
3. **Anyone already created against v0.23.1 has a permanently dead link.** After the
   deploy, re-send with **Send set-password link**, or set their password directly. Their
   original email will never work no matter how long they wait.

**Process lesson worth keeping:** the feature and the thing that makes it work shipped in
different batches. B2 and B3 were only separable because the breakage was invisible to
`tsc`, `npm test` and `npm run build` — all of which passed on the release that did not
work. A "feature ships, its landing path follows" split needs the *feature* held back,
not the fix rushed.

### I12 — Staging has no Auth SMTP, so every auth email fails there  🔄 IN PROGRESS (2026-08-18)

**Observed (staging, 2026-08-18):** *"Error sending recovery email"* from **both** vendor's
Forgot Password and Command's create-user. Production is unaffected.

**Diagnosis: the staging Supabase project was never given SMTP settings.** Grounded in
what this repo does and does not record:

| Evidence | Reading |
|---|---|
| `architecture/supabase-production-setup.md:23` — *"Auth SMTP \| Resend configured, `no-reply@ezzy.ph` — confirmed by a real recovery email"* | That row is in the **production** setup log. It records a manual dashboard action taken against the production project. |
| No equivalent record for staging anywhere in `architecture/` | Staging never had the same step performed. |
| `backbone/supabase/config.toml` — `[auth.email.smtp]` is **commented out** | The repo does not configure SMTP for any hosted project. |
| `supabase-production-setup.md:33-34` — *"never run `config push`"*, and hosted auth settings *"must be read in the dashboard"* | There is no mechanism by which staging could inherit production's SMTP. It is per-project dashboard state. |
| **Both** failing paths are auth emails through GoTrue's mailer | Two unrelated features failing identically points at the shared transport, not at either feature. |

Without custom SMTP a hosted project falls back to Supabase's **built-in mailer**, which
delivers only to project **team members** and is severely rate-limited — and returns
exactly *"Error sending recovery email"* for anyone else.

**Falsifiable check before changing anything:** open **Resend → Logs** and look for the
staging attempts. *No send attempt logged at all* ⇒ staging has no SMTP (this diagnosis).
*A logged attempt that failed* ⇒ SMTP is configured but broken (bad key, unverified
sender) — a different fix.

**Fix — staging dashboard only, no code and no migration.** Supabase Dashboard → **staging
project** → Authentication → Emails → **SMTP Settings**, matching production:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| User | `resend` |
| Password | the Resend API key (**account-scoped — the same key works for staging**) |
| Sender email | `no-reply@ezzy.ph` |

Then check **Authentication → Rate Limits** on staging, and re-test.

**⚠️ Caution once this is on: staging will send real email to real inboxes.** The
`NOTIFICATION_EMAIL_OVERRIDE_TO` safety valve that redirects non-prod mail applies **only
to the notification pipeline** (the `send-notification-email` Edge Function, which calls
the Resend **API**). Auth email goes via Resend **SMTP** and has no such override, so a
staging password-reset for a real user's address will reach them. Use test addresses.

**Not this:** the `NOTIFICATION_EMAIL_*` secrets and the Edge Function are a **separate
path** from auth email (`architecture/auth-and-roles.md:42` states this explicitly). They
are not involved in this error and changing them will not fix it.

**Blocks:** the vendor/booker staging retest of B3/B4/B5 — a Command-created vendor user
cannot receive a link on staging until this is set.

### I8 — Pre-existing `no-explicit-any` lint errors, left alone  ⬜ TODO (not this plan's work)

**Files:** `app/api/users/route.ts:46,51,56,130,156` (the `statusRow`/`portalRows`/
`roleRow` casts and the two `targetRoles` maps) and
`hooks/mutations/users/useUpdateUser.ts:44`.

Six `@typescript-eslint/no-explicit-any` errors surfaced when linting the files this
plan touched. **All six pre-date this work** — verified by `git diff`, which shows no
added or removed `any` on any of those lines, and `useUpdateUser.ts` is not in the
changed-file list at all. Reported rather than silently fixed, per AGENTS.md "Surgical
Changes". `npm run lint` is not clean on this app today and was not made cleaner or
worse here.

**Fix approach if picked up:** type the PostgREST embedded-select rows properly rather
than casting. Out of scope for this plan.

### I9 — No route-level test for the root gate  ⬜ TODO

**Files:** `app/api/users/password/route.ts:30`,
`app/api/users/send-set-password-link/route.ts:27`.

The plan required tests asserting a non-root caller receives 403 **before** any
admin-client call — the security property, not the happy path. They were not written.
**Why:** `package.json:10` runs `node --test` against `"lib/**/*.test.ts"` only, and
there is no route-test harness in this app — no Next request mock, no Supabase double.
Standing one up for two routes is a larger change than the routes themselves and was
not in the approved scope.

**What stands in for it today:** the ordering is verified by grep (`isRoot` at :30 vs
`createAdminClient()` at :47; :27 vs :34) and by the same `verifyCommandCaller` the
three pre-existing user routes already rely on. That is weaker than a test — it proves
the lines are in the right order, not that a request is actually refused.

**Fix approach:** either add a minimal route-test harness (and widen the `test` glob
beyond `lib/`), or extract the gate into a `lib/` helper that can be unit-tested
directly. The second is cheaper but adds an indirection for two callers; recommend
deciding when a third route needs the same gate.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->

- How to fix B3 — the PKCE/implicit mismatch → **Option A, consume the implicit hash
  ourselves via `setSession`** (resolved 2026-08-18) — smallest fix that works with the
  link GoTrue already sends; no email, template or Supabase config change. Option B
  (`token_hash` + `verifyOtp`) recorded as the preferred longer-term shape.
- Temp-password delivery, **if** it is ever built → **generated and shown once in Command,
  never emailed** (resolved 2026-08-18). Nothing sensitive leaves the system, it works for
  someone with no reachable mailbox, and it is a small extension of the existing
  `Set password` modal rather than new email infrastructure. Emailing the password was
  rejected: strictly weaker than the link it would replace, since a link expires and a
  mailed credential is permanent and plaintext. **Currently ⏸ PARKED** — `Set password`
  already covers the Command-admin case; unblock condition is B5's retest failing, or
  provisioning becoming frequent enough that typing a password by hand is real friction.
- Fix the B5 login-view latch before considering temp passwords → **yes** (resolved
  2026-08-18) — the fix is ~10 lines with a confirmed mechanism; if it works the link flow
  is better than mailing credentials, and if it fails nothing has been lost.
- Should B4's dead-form guard ship with B3 → **yes, same batch** (resolved 2026-08-18) —
  same three files; shipping separately means editing three portals' auth files twice
  and leaves expired links showing an unusable form in the meantime.
- **Cross-app approval for B3+B4** → the fix must land in `command`, `vendor` **and**
  `booker`. Confirmed by the user's Option A choice on 2026-08-18, which was presented
  as cross-app.
- How a **command admin** should be provisioned → **root sets the password directly; no
  new code** (resolved 2026-08-18). The originating goal was "create one command admin",
  and for that job the email is the worst-fitting of the three paths: creating an admin is
  already root-only (`app/api/users/route.ts:14-21`), so the person creating the account is
  by definition allowed to use `Set password`, which involves no email, no GoTrue link, no
  redirect and no fragment parsing — it is immune to the entire B3 class of failure.
  Rejected alternatives, with reasons worth keeping:
  - **A fixed default password** (same value for every new account) → ✖ ABORTED. Command
    admins hold platform-wide power; the value would live in the repo and docs, be
    identical across every account ever created, and leave unclaimed accounts sitting
    with a known credential.
  - **Emailing the password** → ✖ ABORTED. Strictly worse than the link it would replace:
    a recovery link expires and is single-use, a mailed password is permanent, plaintext,
    and resident in two mailboxes indefinitely.
  - **A generated password shown once** → ⏸ PARKED, not rejected — it is the legitimate
    version of the idea and is what `Set password` already does minus the typing. Unblock
    condition: provisioning admins becomes frequent enough that inventing a password by
    hand is friction worth removing.

  **Honest scope note.** For the originating request the email machinery was over-built,
  and it was the piece that failed. It is not wasted — vendor staff are the volume case
  and genuinely need a self-service link — but it was the wrong path to lead with for a
  single admin, and the retest should be run on a **vendor** account, since that is the
  case the email actually serves.

<details><summary>Resolved 2026-08-18 — the three options as presented</summary>

  All three options were
  **cross-app** (the fix lands in `lib/supabase/client.ts`, byte-identical in command,
  vendor and booker), so all three need the AGENTS.md cross-app approval.

  | | Option | Size | Trade-off |
  |---|---|---|---|
  | **A** *(recommended)* | **Consume the implicit hash ourselves.** At module load, if the fragment carries `access_token` + `refresh_token` + `type=recovery`, call `client.auth.setSession({ access_token, refresh_token })` directly instead of leaving it to `detectSessionInUrl`, then clear the fragment. Bypasses the mismatch guard entirely. | ~20 lines × 3 portals, one file each | Smallest fix that works with the link GoTrue **already sends** — no email, template or config change. `setSession` is public API, not a workaround. Cost: we take over one step auth-js would normally do, and the async settle must be ordered before the form is usable (B4 covers that). |
  | **B** | **`token_hash` + `verifyOtp`.** Server calls `admin.generateLink({ type: 'recovery' })`, we email our own branded link carrying `token_hash`, and the portal calls `verifyOtp({ token_hash, type: 'recovery' })`. Flow-agnostic, and Supabase's own recommendation for server-generated links. | Largest — generateLink + a new email through `send-notification-email` + a landing handler in 3 portals | Also delivers the branded "Welcome — set your password" email currently in DEFERRED, and stops depending on GoTrue's redirect shape. But it is a second email path to own, and it changes what the link looks like. |
  | **C** | **Make the browser client genuinely implicit** — drop `createBrowserClient` for `supabase-js` `createClient` plus a hand-written cookie storage adapter, so the declared `flowType: "implicit"` finally takes effect. | Moderate code, **high risk** | Fixes the false comment at its source, but rewrites session storage for every signed-in user on a login path that has already produced two incident plans. Not recommended as a hotfix. |

  **Recommendation: A now, B later.** A restores the flow with the least surface and no
  new infrastructure; B is the better long-term shape and can subsume the deferred
  branded-email item once the breakage is gone. C is worth knowing about but is
  disproportionate to the failure.

</details>

- How to send the set-password email → **recovery email via `resetPasswordForEmail`**
  (resolved 2026-08-17) — reuses the `type=recovery` path already hardened in all three
  portals, so zero client changes; `inviteUserByEmail` was rejected because `type=invite`
  would force a cross-app change to `lib/supabase/client.ts:42` in command, vendor and booker.
- Where the link points → **env-configured origins, priority `command` > `vendor` >
  `booker`** (resolved 2026-08-17) — per-environment config, so staging Command links to
  staging portals; highest-privilege portal wins for multi-portal users.
- Root setting a password → **root-only, any target, from the user detail modal**
  (resolved 2026-08-17) — matches the existing root-only tiering on every other
  privilege-adjacent user operation.
- Resending the link → **yes, a "Send set-password link" action** (resolved 2026-08-17)
  — covers lost mail, pre-existing accounts, and expired links.
- Adding `PORTAL_URL_COMMAND` / `_VENDOR` / `_BOOKER` → **approval gate, requested at the
  top of execution** (B1). No secret involved; needed before B2 can do anything.

**Informational, non-blocking — for the user to confirm at their convenience:**
- The hosted auth email rate limit (Dashboard → Authentication → Rate Limits) — worth a
  look before onboarding several people in one sitting (I4).
- The production Redirect URL allowlist contains `https://vendor.ezzy.ph` (I3).

## DEFERRED / COSMETIC

- **Branded "Welcome to Ezzy — set your password" email** via `generateLink` +
  `send-notification-email`. Acceptable to defer: the wording is tolerable and this
  option can be added later without undoing anything here. ⚠️ **The tempting shortcut —
  rewording the dashboard "Reset Password" template toward "welcome, set your password"
  — is the wrong move and must not be taken:** that template is shared, so the new copy
  would also greet an existing vendor who simply forgot their password (§5.3). If the
  copy genuinely needs to differ for new users, it needs a separate email, i.e. this
  deferred item.
- **`type=invite` support in the three portals.** Not needed under the chosen approach;
  recorded because it is the prerequisite for ever adopting `inviteUserByEmail`.
- **Renaming the internal `onInvite` / `.inviteBtn` identifiers.** Left alone by the
  2026-08-10 plan as churn with no user-visible benefit; still true.
- **Forcing a password change after a root-set password.** GoTrue has no
  "must change password" flag, so it would need a `profiles` column and a gate in every
  portal — disproportionate. Root setting a password is a break-glass action for an
  operator who already holds full control of the account.
- **Audit logging of root password sets.** There is no admin audit table in the schema
  today; adding one for this single action is out of proportion. Worth raising
  separately if privileged-action logging is wanted platform-wide.

---

## Execution order

Ordered by dependency and risk, not by numbering. **Default cadence: one stage, then
stop and report** (`.claude/skills/developerboss/SKILL.md`).

**Stage 0 — approval gate (no code).** ✅ DONE (2026-08-17) — **local machine-verified;
Vercel set by the user and not machine-verifiable from here.** Does not block Stage 1.

- ✅ **Local (2026-08-17).** `command/.env.local:14-16` carries all three
  `PORTAL_URL_COMMAND=http://localhost:3000`, `PORTAL_URL_VENDOR=http://localhost:3001`,
  `PORTAL_URL_BOOKER=http://localhost:3002`. **Verified — machine:** grep of the three
  keys; all three values are scheme+host with no trailing slash; all three appear in
  `backbone/supabase/config.toml:160`; `command/.env.local:1` points at the **local**
  stack (`http://127.0.0.1:54321`), so that config file is genuinely the governing
  allowlist here; local Supabase auth answers `200` on `/auth/v1/health` and the mail UI
  answers `200` on `:54324`, so a local end-to-end test of Stage 2 is possible.
- 🔄 **Vercel — user-reported set (2026-08-17), not machine-verifiable from here.** No
  credentials in this repo and none should be used, so this rests on the user's report.
  **`PORTAL_URL_BOOKER` is set to a blank string in Production** — the ✅ preferred
  option from §4 rule 3, and confirmed safe against the resolver contract (B1's
  load-bearing `!raw.trim()` rule, with the Node semantics measured 2026-08-17). It is
  **not** a problem and does not block execution.
  **Still resting on the user's word:** that Production also carries
  `PORTAL_URL_COMMAND=https://command.ezzy.ph` and
  `PORTAL_URL_VENDOR=https://vendor.ezzy.ph`, and that the staging-building environment
  carries the three `staging-*` values.
  ⚠️ **A wrong or missing Vercel value is silently undetectable until Stage 2 ships** —
  no code reads these variables yet, so nothing can fail loudly today. The staging
  round-trip in Verification/B2 is the real gate on this, not a settings-page glance.

**Stage 1 — origin resolution (B1).** ✅ DONE (2026-08-17) — `lib/portalOrigins.server.ts`
+ `lib/portalOrigins.server.test.ts`. `npm test` 41/41, `tsc --noEmit` clean, existence-check
grep clean. See B1 for detail.

**Stage 2 — send on create (B2) + operator feedback (I2).** ✅ DONE (2026-08-17, code) —
shipped together as required. `tsc` clean, `npm test` 41/41, eslint clean on changed
files, send-ordering grep confirmed. **The "ends with the baseline regenerated" clause
was wrong** — Command has zero visual baselines, tracked or on disk; see I2. Live email
delivery still unverified.

**Stage 3 — root password actions (I6).** ✅ DONE (2026-08-17, code) — 8 new files, 5
modified. `tsc` clean, `npm test` 41/41, eslint clean on changed files, root-gate
ordering grep-verified. **Route tests not written — see I9.** Live checks outstanding.

**Stage 4 — documentation (I1, I4, I5, I7).** ✅ DONE (2026-08-17) —
`architecture/auth-and-roles.md` (new "How a Command-created user gets a password"
section), `architecture/overview.md` (booker row consequence + repoint ordering),
`command/README.md` (new env section, create-flow step 5, key-files map, auth email
limits).

**Stage 5 — the PKCE/implicit fix (B3 + B4).** ✅ DONE (2026-08-18, code) — **cross-app**,
approved via the Option A decision. `lib/supabase/client.ts` and
`components/layout/AppShell/useAppShell.ts` in **command, vendor and booker**. `tsc` clean
and `npm run build` green in all three; the three `client.ts` files verified byte-identical.
Added after the 2026-08-17 production test failed on submit.

**Stage 6 — the Command-access lockout (B7 + B8).** ✅ DONE (2026-08-18, code) —
`command` only, **no migration**. Root-caused by live local reproduction, fixed in the
route, the edit mutation and the form, with the rule extracted to a tested pure module.

**Alongside, not gating:** I3 sits with the user (Dashboard); I4's dashboard read
likewise.

---

## What to expect after the B3/B4 deploy (2026-08-18)

Two flows are easily conflated. They have different histories and different risks.

| Flow | Before B3 | After B3/B4 | Note |
|---|---|---|---|
| **Forgot Password** (user-initiated from a login screen) | **Worked** in all three portals — the browser both requests and consumes the link, so PKCE matched | Unchanged | B3 is **inert** here: a PKCE link arrives as `?code=` and puts nothing in the fragment, so `readHashTokens` returns `null`. **This is the fix's main regression risk** — verify it explicitly. |
| **Command-sent set-password link** (server-initiated) | **Broken in all three portals** | Expected to work | The flow this plan added, and the one that failed on 2026-08-17 |

So the correct expectation is *not* "password reset starts working everywhere" — it is
"the server-sent link starts working everywhere, and Forgot Password keeps working".

**A command-portal user needs only `command` deployed.** Their link targets
`PORTAL_URL_COMMAND`; vendor/booker deploys matter only for users granted those portals.

**⚠️ Granting the command portal is not enough to log in.**
`services/command.service.ts:19` requires active status **and** the command portal **and**
a role of `admin` or `root`. A `member` with the command portal will set a password
successfully and then be refused at login with *"You do not have access to the Command
portal."* Not a bug — but it makes a test look like a failure. Test with `admin`.

**A failure mode B3/B4 does NOT fix: mail-provider link prefetching.** Outlook/Defender
Safe Links and similar corporate scanners fetch URLs in email, which spends a one-time
recovery token before the human clicks. The user then correctly sees *"Email link is
invalid or has expired"* — B4 behaving as designed, but still a failed onboarding.
Recovery: root re-sends, or sets the password directly. **If this error appears during
the retest, suspect the mail scanner before suspecting the fix.**

---

## Retest result (2026-08-18) — ✅ command PASSED

**Confirmed by the user on production Command (v0.23.4):** created a user with Command
access, received the email, the link opened the **set-password form** (not the login
form), set a password, and **signed in successfully**.

That single pass closes B2 (the email is sent), B3 (the session is established from the
implicit fragment), B5 (the reset view is not latched away) and B7's happy path (an
`admin` + `command` account can actually sign in).

**Still unverified, and honestly so:**
- **B4's rejected-link path** — needs a spent or expired link; expected to show *"Email
  link is invalid or has expired"* on the login page rather than a dead form.
- **B7's block** — Command + Member should disable Save with the reason inline.
- **B8's failure path** — needs an induced write failure.
- **vendor / booker** — the fix is written and reviewed (B6) but not yet shipped, so a
  Command-created *vendor* user still hits B3/B5 there.

---

## Retest checklist (2026-08-18) — run this before believing any of it

**Rollout (decided 2026-08-18): commit all three, deploy `command` first.**
Committing all three immediately protects the byte-identical property of
`lib/supabase/client.ts` — three copies that are *meant* to agree will diverge if one
sits uncommitted while the others ship. Deploying is staged, because a command-portal
user's link targets `command.ezzy.ph` only: vendor and booker are irrelevant to that
path, and deploying command alone isolates the variable if anything misbehaves. Leaving
vendor/booker undeployed regresses nothing — it preserves today's behaviour (their own
Forgot Password was never broken; Command-created *vendor* users stay broken until vendor
ships). `booker` can wait indefinitely: `PORTAL_URL_BOOKER` is blank in production, so it
never receives a server-generated link.

Steps 1 and 3 below are the pair that matters for a command-only deploy — 1 is the fix,
3 is the regression it could plausibly cause.

1. **The failing case, repeated.** Create a user in Command with the **command** portal →
   they receive the email → open the link → set-password form → submit. **Expected: it
   succeeds and they can sign in.** This is the exact path that produced
   `Auth session missing!`.
2. **The vendor path.** Same, granting the **vendor** portal — confirm the link lands on
   `vendor.ezzy.ph` and the form works there. Vendor was equally broken and is equally
   fixed; do not assume Command passing means vendor passes.
3. **Forgot Password still works.** From each portal's login screen, for an existing user.
   **This is the regression check that matters most** — the PKCE path was the one thing
   that *was* working, and `readHashTokens` must stay inert for it.
4. **A dead link explains itself (B4).** Open a used or expired link a second time.
   **Expected: the login page with "Email link is invalid or has expired"** — *not* a
   set-password form, and not a silent blank login.
5. **Booker-only user.** Still gets the warning toast and no email (`PORTAL_URL_BOOKER`
   blank) — unchanged by this fix, worth confirming it did not regress.

---

## Post-execution review (2026-08-17)

**Final machine verification, run against the whole app after Stage 4:**

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 41/41 pass (24 new) |
| `npm run build` | ✓ compiled; both new routes registered as `ƒ` dynamic — `/api/users/password`, `/api/users/send-set-password-link` |
| `eslint` on every changed/new file | clean (6 pre-existing errors elsewhere — I8) |
| Stale-copy grep | "sends no email" / "No email was sent" now appear **only** in the root set-password modal and hook, where they are true |

**Newly discovered work, logged not swallowed:** I8 (pre-existing `no-explicit-any`) and
I9 (no route-test harness, so the root gate is grep-verified rather than tested).

**What no one has verified:** a single real email. Delivery, the link landing on the
right portal, the reset form appearing, the new password signing in, the four toasts
rendering, and the root-set password working are all still ⬜ — they need the staging
round-trip below.

---

## Verification

| Item | Machine-verifiable | Needs a live environment |
|---|---|---|
| B1 | `npx tsc --noEmit`; unit tests for `resolvePortalOrigin` — priority order; unset var → `not_configured`; **empty string `""` → `not_configured`** (production's live booker config, so this test guards a real deployment, not a hypothetical); **whitespace `" "` → `not_configured`**; malformed value → **`misconfigured`, and specifically NOT `not_configured`**; trailing slash normalized or rejected consistently; unknown portal name ignored. Plus a grep that the resolver contains no `in process.env` / `!== undefined` existence check | — |
| B2 | `tsc --noEmit`; grep that `resetPasswordForEmail` is called **after** the grant writes and that its error does not change the HTTP status | **Create a real user in staging Command with the vendor portal → an email arrives → the link lands on staging-vendor with the set-password form → the new password signs in.** This is the only check that proves the whole chain. |
| I1 | grep: no booker-specific branch exists in the route | Production `PORTAL_URL_BOOKER` is a **blank string** (user, 2026-08-17) — confirm a booker-only user therefore gets the `not_configured` warning toast and no mail, **not** a `misconfigured` error toast and not a broken link. The blank-vs-error distinction is the thing to watch: it is the live proof that B1's `!raw.trim()` rule was implemented correctly. |
| I2 | `tsc --noEmit`; **`useraddmodal` visual baseline regenerated** (`visual-tests/`, `maxDiffPixels: 0` — the reworded note guarantees a diff, so a stale baseline will fail the suite); the other Command baselines must stay pixel-identical | All four toast variants — `sent` needs a real send; `not_configured` needs an unset **or blank** origin (production booker is exactly this); `misconfigured` needs a deliberately malformed value; `failed` needs a forced send failure (easiest: exceed the rate limit, or point a `PORTAL_URL_*` at an origin missing from the allowlist) |
| I3 | — | Dashboard read. **Parked — cannot be verified from here.** |
| I4 | — | Dashboard read; plus one observed 429 or cooldown message rendering correctly in the toast |
| I5 | Docs re-read against the shipped code; grep that no doc still claims creation sends no email | — |
| B3 | `tsc --noEmit` and `npm run build` in **all three** portals; `diff` proving the three `client.ts` files stay byte-identical | **The whole retest checklist above.** No unit test is possible — `client.ts` imports `@supabase/ssr` and touches `window`, and the runner only executes `lib/**/*.test.ts` under plain node. The live link is the only evidence. |
| B4 | as B3 | Open a spent link and confirm the login page shows "Email link is invalid or has expired" instead of a set-password form |
| B7 | `npm test` 52/52 incl. 11 new cases for `commandAccessError`; `tsc`; `npm run build`; grep that the guard precedes `createUser` | Create a user with Command + Member in the real form → Save is disabled with the reason; switch to Admin → saves; the account signs in |
| B8 | `tsc`; `npm test`; `npm run build` | Induce a write failure (e.g. revoke a grant on a scratch DB) and confirm the 500 names the step and the list still shows the account |
| I7 | grep that the three `dev` scripts are unchanged; §4 and README carry the explicit-port note | Confirm the actual port each local app bound to before trusting any local end-to-end result |
| I6 | `tsc --noEmit`; unit test of the shared min-length predicate; **route tests that a non-root caller gets 403 before any admin-client call** — the security property, not just the happy path; new `usersetpassword` ui-gallery fixture + its baseline | Root sets a password for a test user → that user signs in with it; root resends the link → it arrives and works; a non-root admin does not see either control and a hand-rolled request is refused |

**Explicitly not claimed:** nothing in this plan can be marked ✅ on `tsc` alone. B2 and
I6 are auth flows whose failure modes (wrong redirect, unlisted URL, rate limit, silent
non-delivery) are all invisible to a type-checker — each needs the staging round-trip
named above before its status moves.
