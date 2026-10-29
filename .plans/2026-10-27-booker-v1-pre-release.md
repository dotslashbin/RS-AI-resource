# Booker v1 — pre-release checklist for the public production launch

**Date:** 2026-10-27
**App / scope:** `booker/` web (Ezzy Booker, `booker.ezzy.ph`) plus the hosted settings it depends on
(production Supabase Auth, Vercel env). **Out of scope:** new features, `ezzy-booker-mobile`, the
Checkout S2 work, vendor and command (read only, for comparison).
**Status:** IN PROGRESS — LAUNCHED 2026-10-29: staging ✅ (S0–S3), production ✅ (P1, P2a, P2, P3). Open: P4 / B1-d ⏸ (real paid booking, the user's later testing round), F12 ⏸ (past sessions bookable), and the daily abandoned-checkout routine from now on — release: staging ✅ · production ✅

> Booker has been deployed to production since 2026-09 (promoted again 2026-10-23/24) but is
> **not yet serving the public** (`2026-09-29-booker-live-verification.md`, line 38). This plan is
> the gap between "deployed" and "launched": what must be true before customers are pointed at it.
> No new features.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision, F# = Finding,
> S# / P# = staging / production release step; B1-a etc. = a step inside a must-do. Numbers are plan-local — qualify cross-plan refs
> by plan (e.g. "live-verification L3-a", "payment-lifecycle B1").

---

## ▶ RESUME HERE (updated 2026-10-29, staging green + patch I5)
- **2026-10-29:** S2 ✅ and S3 ✅ (user: "visual checks passes"). F11 (staging email override) and
  F12 (past sessions bookable, ⏸) recorded. Patch I5 coded on booker `release/version-0.30.0`,
  uncommitted; the user commits and pushes. **Next:** redeploy staging with I5 and glance at Home's
  carousel (no pause/play button, still autoplays), then production P1 → P2a → P2 → P3, promoting
  the deployment that contains I5.

**Earlier (2026-10-28, end of the code stage):**
- **Done so far:** must-dos 1–3 ✅ (B1-d ⏸; B2-c waits for P1). Every decision resolved; I2 approved 2026-10-28. Code stage ✅: I1 + I2-b on booker `feature/pre-release-prep` (uncommitted), I2-a migration file on backbone `develop` (uncommitted, not applied). tsc clean, 319/319 tests, lint at the pre-existing 18. Migration applied locally; a local sign-up wrote the welcome notification (test data removed).
- **Live where:** production booker = the build promoted for the carousel (2026-10-24); `develop` is at 0.29.5. Staging Auth: length 8, no character rule, leaked check on, Site URL staging-command, six redirects.
- **Next:** S2 (user): sign up on staging with a readable inbox (welcome email), password reset, test-mode book and pay; then S3 visual pass. S0 and S1 ✅ 2026-10-28. Booker was rebased onto develop 0.29.6 (commit `7f3b65a`; backup branch `backup/pre-release-prep-pre-rebase` kept).
- **Watch out for:** the favicon is **already** vendor's and already live (F1). Don't redo it —
  only the manifest colours differ.

---

## FINDINGS (from the 2026-10-27 investigation)

### F1 — The favicon is already vendor's, and already live in production  ✅ recorded
Every icon file in booker is **byte-identical** to vendor's (md5, 2026-10-27): `app/favicon.ico`,
`app/icon.svg`, `app/apple-icon.png`, `public/icons/icon-192.png`, `icon-512.png`,
`icon-maskable-512.png`. They came in with `2042092` (2026-09-29). Fetched live from
`booker.ezzy.ph`, `staging-booker.ezzy.ph` and `vendor.ezzy.ph`: **same hashes on all three**, and
production's HTML links `/favicon.ico`, `/icon.svg` and `/apple-icon.png`.
**If you still see an old icon,** it is your browser's favicon cache. Booker's service worker
(`public/sw.js:29–43`) also caches same-origin images forever. Fix: hard-refresh, or clear site
data for `booker.ezzy.ph`.
**What actually differs from vendor** is the web-app manifest only. See I1.

### F2 — Hosting posture is already sound  ✅ recorded
Probed live 2026-10-27: CSP pinned to the production Supabase project; HSTS, `X-Frame-Options:
DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy` all set; `/ui-gallery` 404s in
production (`app/ui-gallery/page.tsx:1104`); the build fails on Vercel if `NEXT_PUBLIC_APP_NAME`
is unset (`next.config.ts`). Production manifest says "Ezzy Booker" (staging's says
"STAGING BOOKER", as intended). Nothing to do.

### F3 — No error monitoring in any of the three web apps  ✅ recorded
No Sentry / analytics / Speed Insights dependency in `booker/package.json` (and none in vendor or
command). A failure customers hit will only show up in Vercel's function logs. See D5.

### F5 — B1-a1 probe results on `booker.ezzy.ph` (2026-10-28)  ✅ recorded
| Probe | Result | Verdict |
|---|---|---|
| Hosts named in the page | only `https://booker.ezzy.ph` | ✅ |
| `localhost` in the page | 0 | ✅ |
| CSP `connect-src` | production project `pdkejyjidrfxksaczvfy`, https + wss | ✅ |
| `POST /api/payment/webhook` | `400 {"error":"Invalid signature"}` (staging the same) | ✅ the secret is set |
| `POST /api/payment/create-session`, no body | `400 Missing bookingId` | ✅ see below |
| same, with a dummy `bookingId` | `401 Unauthorized` | ✅ auth runs before any lookup |
| `POST /api/register`, no body | `400 Invalid request body.` | ✅ no 500 |

⚠️ **The checklist's `→ 401` probe is vendor's kiosk route.** Booker's `create-session` validates
the body shape before auth (`app/api/payment/create-session/route.ts:15–16`), so an empty POST
gets 400. Nothing leaks: the auth check (`:32–33`) runs before the secret key, the booking lookup
or anything else. Not a defect.

### F6 — Public Auth settings, production and staging (2026-10-28)  ✅ recorded
Read from `/auth/v1/settings` with each site's publishable key (public by design; not printed).
- **`disable_signup: true` on both.** The open item in `supabase-production-setup.md` ("`enable_signup`
  is still true") was **stale**; that doc is corrected. Booker is unaffected: `/api/register` uses
  `auth.admin.createUser`, which this flag does not gate.
- Email is the only provider enabled; anonymous users off; `mailer_autoconfirm: false`. Booker's
  route confirms its users itself (`email_confirm: true`), which is I2/D3, not a setting.

### F7 — How booker handles password rules (2026-10-28)  ✅ recorded
- `components/auth/LoginPage/useLoginPage.ts:130` (sign-up) and `:88` (reset) both reject
  `< 8` characters **before** calling the server. So 8 is booker's effective minimum today,
  whatever Supabase says.
- Any other rejection is shown word for word: `/api/register` returns `createError.message`
  (`route.ts:64`), and the hook displays it (`useLoginPage.ts:150–153`); reset shows
  `error.message` (`:98–99`). Supabase's messages are readable sentences, so no code change is
  needed for B2-d.
- ⚠️ **Open (B2-e):** the form's check runs in the browser, and the route's comment says
  "Password strength is enforced by Supabase Auth". That is only true if `admin.createUser`
  applies the password policy. If it doesn't, a direct `POST /api/register` could set any
  password. **Test, on staging only:** `curl -X POST https://staging-booker.ezzy.ph/api/register`
  with a 3-character password and a throwaway address. Rejected → done. Created → delete that
  user in staging, and the fix (a length check in the route) joins the code stage with I1.
  ✅ **Answered 2026-10-28:** rejected with `400 "Password should be at least 6 characters."`, so
  `admin.createUser` **does** apply the policy, and no staging user was created. ⚠️ It also shows
  **staging's minimum is 6** (Supabase's default), while the form says 8. A direct POST with a
  6–7 character password would therefore succeed today. Setting the minimum to **8** in B2-b/B2-c
  (row 3) closes that gap with no code change.

### F8 — Production Auth rate limits (2026-10-28)  ✅ recorded
- **Emails 30/h counts Auth emails only** (password reset, Command's set-password invites, email
  change). Booker's booking and payment notifications go through the `send-notification-email`
  Edge Function straight to Resend, so they don't count. Booker itself sends **no** sign-up
  email (`email_confirm: true`, I2), so its only Auth email is a password reset.
- Enough for a soft launch. Before a public launch, raise it to about **100/h**, but **only up to
  what the Resend plan allows** (check its daily and monthly cap). A Supabase limit above Resend's
  only moves the failure from a clear "rate limit" error to a silently dropped email.
- ⚠️ Watch: **sign-ups and sign-ins 30 per 5 min per IP.** Philippine mobile carriers put many
  phones behind one shared address (carrier-grade NAT), so a busy moment could hit this. Booker's
  account creation runs from Vercel's server through the admin API, but the sign-in straight after
  it comes from the customer's own address. Not a launch blocker; if users report
  "too many requests", raise it.

### F9 — Production demands all four character types; booker's form only says "Min. 8 characters" (2026-10-28)  ✅ recorded
Production's **Password requirements** = lowercase, uppercase, digits **and** symbols. Booker's
sign-up and reset forms hint only `"Min. 8 characters"` (`components/auth/LoginPage/LoginPage.tsx:228, 255`)
and check only length (`useLoginPage.ts:88, 130`). So a customer who types `sunshine2026` passes
the form, and then gets Supabase's raw message back, which lists every allowed character set.
They have to guess what to change. This is the first screen a new customer sees, so it matters
for launch. It corrects F7's "no code change needed" for the **character** rule; the length
reasoning in F7 still holds.
- Staging's requirement setting is **unknown**. If it differs, every staging sign-up test so far
  ran under different rules from production. B2-b must read it and match production's final choice.
- The setting is **project-wide**: vendor and command sign in against the same project. Changing it
  changes it for them too (for new or changed passwords only).

### F10 — Staging Auth has NO redirect URLs and a localhost Site URL (2026-10-28)  ✅ recorded
Screenshot of project `fbxbwnfeimzhgxpshdpa` (backbone-staging; the dashboard's orange
"PRODUCTION" badge is Supabase's label for the project's `main` branch, not our production):
Site URL `http://localhost:3000`, Redirect URLs **empty**.
- This contradicts `2026-09-25-vendor-password-recovery-cross-browser-fix.md` K5, where
  `staging-vendor.ezzy.ph` was added to this list and the reset then worked. **Something has
  removed it since; the cause is unknown.** It does not match a `supabase config push`, which would
  have written the local localhost redirects rather than an empty list.
- Effect today: **every** staging password reset, from all three apps, falls back to
  `localhost:3000`. Production is unaffected (B2-a row 2).
- Fix, staging only: Site URL → `https://staging-command.ezzy.ph` (mirrors production) and the six
  bare + `/**` entries for staging-command, -vendor, -booker. All three hosts answer 200 (2026-10-28).
- Staging's *before* values for the password settings were not recorded before B2-b changed them.

### F11 — Staging redirects every notification email to one inbox (2026-10-29)  ✅ recorded
Staging's `send-notification-email` has `NOTIFICATION_EMAIL_OVERRIDE_TO` set (`handler.ts:54`,
documented in `email-secrets-setup.md` as non-prod only). Resend shows the S2 sign-up's welcome
email and its 5 Command alerts all **delivered to `cto@ezzy.ph`**, while `notification_emails.
recipient_email` records the *intended* recipient (`meefiebossman+ghoul@gmail.com`,
`*@bookdeck.com`). So on staging, read the log as "who it was for", and Resend as "where it went".
- Correction: on 2026-10-29 I told the user the welcome went to the dummy address and the admin
  alerts to `@bookdeck.com`; neither happened, the override caught both.
- Supabase **Auth** emails (reset, "password changed") bypass the override and go to the real
  address: Resend shows "Your password was changed" to `wolvi@rine.com` as **Suppressed**.
- ⚠️ Production must have this secret **unset**, or no booker ever gets an email. Added to P1.

### F12 — The S2 test booking is for a session that had already ended (2026-10-29)  ⏸ PARKED
⏸ **Parked 2026-10-29 by the user:** the test browser was **not** on Philippine time, which fits
the device-time-zone cause below. Not to be retested now; someone else will test it later, on a
browser set to Asia/Manila. Unblocks when that test runs: if past slots stay hidden there, the cause
is confirmed and the fix (compare in Asia/Manila, plus a database guard) gets its own plan.
Booking `62c0cf78…` ("Car Detailing", `session`) is for 2026-10-29, 12:00–14:00. It was created
at 15:01:57 UTC, which is **23:01 Manila**, nine hours after the session ended.
- Booker hides today's past slots (`useStep3Schedule.ts:93`, `slotInstant(...) > now`), but
  `slotInstant` builds the time in the **device's** time zone, not Asia/Manila. A browser outside
  UTC+8 would show the wrong slots as still open.
- The database has **no** past-slot guard. Nothing in the migrations rejects a `booked_date` and
  `start_time` already in the past, so a paid booking for an ended session is accepted.
- Not yet known: the time zone of the user's test browser. If it was Manila, the client filter
  failed some other way. Either way the customer can pay for a slot they cannot attend.
- Severity to be set once the cause is known. Pre-existing; not caused by this plan's code.

### F4 — No `app/global-error.tsx` in any web app  ✅ recorded
`app/error.tsx` and `app/not-found.tsx` exist. A crash in the root layout itself would show Next's
unstyled default page. Vendor and command are the same, so this is consistent. DEFERRED below.

---

## BLOCKERS

### B1 — Production posture checks still parked  🔄 IN PROGRESS 👤 — pre-checks ✅ 2026-10-28 (must-do 1); B1-d waits for P4
**Source:** `2026-09-29-booker-live-verification.md` L3-a and L3-b (⏸ since 2026-10-01, with the
unblock condition "when a production deploy is actually planned", which is now) and
`2026-10-23-production-sync-from-staging.md` S5 ⏸ (one real paid booking).
- **L3-a:** re-run the occupancy check on **production**. The two RPCs reached production before
  their numbers were confirmed, and no command in this repo reads production.
- **L3-b:** walk `architecture/production-env-checklist.md` for booker. Pay particular attention to
  the **live** `PAYMONGO_SECRET_KEY`, the **live-mode** webhook to
  `https://booker.ezzy.ph/api/payment/webhook`, and `PAYMONGO_WEBHOOK_SECRET` coming from that same
  webhook.
- **S5:** one real, small paid booking end to end on production: `is_paid` settles, the
  confirmation email arrives, the vendor sees it. Then refund/cancel it.
**Check:** each item ticked in its own plan with a date. This plan only tracks that they are done.

### B2 — Production Supabase Auth settings for a public sign-up portal  🔄 IN PROGRESS 👤 — staging ✅ 2026-10-28 (must-do 2); B2-c waits for P1
**Source:** `architecture/supabase-production-setup.md:41–50, 164–190`.
- **Redirect URLs:** the bare origin `https://booker.ezzy.ph` must be listed under
  Authentication → URL Configuration. Booker's Forgot Password sends `window.location.origin`
  (`components/auth/LoginPage/useLoginPage.ts:76`). A missing entry **fails silently**: the reset
  link lands on the Site URL (Command) instead.
- **Password policy:** `minimum_password_length` and leaked-password protection are recorded as
  *unverified*. Booker relies on GoTrue for strength (`app/api/register/route.ts:51`), so whatever
  is set there is booker's whole password policy.
- ~~**`enable_signup` is still true.**~~ ✅ Already off on both projects (F6, 2026-10-28). Was: safe to turn off: booker registers through
  `auth.admin.createUser`, which this flag does not gate. It is not needed for booker, so turning it
  off only closes a side door.
- **SMTP:** Resend with `no-reply@ezzy.ph` is already confirmed. Check the Auth email rate limit
  is high enough for real password-reset traffic.
**Check:** a password reset requested from `booker.ezzy.ph` opens `booker.ezzy.ph`, not Command.

### B3 — An abandoned checkout holds the slot forever  ⏸ PARKED (inherited) — mitigated for launch by D1 (a), the daily routine (2026-10-28)
**Source:** `2026-10-04-booker-payment-lifecycle.md` B1, parked 2026-10-04 and handed to the kiosk
checkout plan. `confirmBooking()` inserts the booking before the checkout session exists, and
nothing expires it, so every booker who presses Pay and walks away permanently takes one place in
that slot. B2 there (the slot stays payable) is the current mitigation.
The fix is a cross-app lifecycle change behind the schema gate. It cannot be done inside this
plan. **D1 decides whether launch waits for it.**

## IMPORTANT

### I1 — Manifest colours: match vendor's brand blue  🔄 IN PROGRESS 🤖 — code ✅ 2026-10-28 (booker `feature/pre-release-prep`, `app/manifest.ts:12–14`: `#034bfc` + comment; tsc clean, lint unchanged at the pre-existing 18, none in this file); ✅ live on staging 2026-10-28 (S1 probe); ⬜ production (P2)
**File:** `booker/app/manifest.ts:11–12`
Booker: `theme_color: "#205cfc"`, `background_color: "#0b1020"`. Vendor (`vendor/app/manifest.ts`)
moved to `theme_color: "#034bfc"` because `#205cfc` disagreed with the icon tile. Booker has the
same icon, so it has the same mismatch: the installed-app chrome and splash colour don't match the
icon. That is the remaining part of "the favicon like vendor's".
**Fix approach:** set `theme_color` to `#034bfc`, with vendor's one-line reason as a comment.
`background_color` depends on D2. No component, so the render/hook/style split doesn't apply.
**Check:** `tsc`, `lint`; on staging, `/manifest.webmanifest` shows the new values. Machine-checkable
by `curl`. The installed-PWA splash is a human check on a phone.

### I2 — Register route: no email verification and no throttling  🔄 IN PROGRESS — D3: welcome email · ✅ APPROVED by the user 2026-10-28 ("approved, go ahead with the code stage") · code ✅ 2026-10-28; local ✅ 2026-10-28; ⬜ staging email (S2)
**File:** `booker/app/api/register/route.ts:59–64`
The public `POST /api/register` creates users with the **service-role** client and
`email_confirm: true`. That means:
- Anyone can create an account under **someone else's email address**, and it is active at once.
- There is no rate limit or CAPTCHA, so a script can create accounts in bulk. GoTrue's own
  sign-up rate limits do not apply to `admin.createUser`.
This is acceptable for a closed rollout, but it is a real gap for a public launch. Any change is an
auth-flow change, behind the security approval gate. **D3** picks the approach.

**Chosen approach (D3, 2026-10-28): a welcome email, sign-in not blocked.** Modelled on vendor's
`vendor_registration_received` (`vendor/app/api/auth/register/route.ts:255–280`,
`vendor/lib/registrationEmail.ts`, migration `20260808000001`).

**I2-a — backbone migration** — ✅ written 2026-10-28 after approval, as below (backbone `develop`, uncommitted). ✅ Applied to **local** by the user 2026-10-28 (verified: the row exists, `is_enabled` true; local `notification_email_settings` has booker email on). ✅ Staging (S0, 2026-10-28). ⬜ Production (P2a).

**Local sign-up check (2026-10-28) ✅ machine-verified:** `POST localhost:3000/api/register` (booker dev server on this branch) → 200. One `booker_welcome` notification, portal `booker`, with the expected title and body (local `APP_NAME` "Ezzy booker", URL `http://localhost:3000`); the 5 Command `new_user_registration` alerts still written. No email attempt logged locally, which is expected because the email function isn't served locally, so **delivery is a staging check (S2)**. The test user and its rows (3 consent rows, 5 Command alerts, the cascade) were deleted in one transaction; all counts verified 0. The dev server also served `theme_color: #034bfc` (I1, local).
`backbone/supabase/migrations/20261028000001_booker_welcome_notification_type.sql`:
```sql
-- Booker welcome email: the notification type it needs.
-- notifications.type is FK-constrained to this table (20260525000002), so booker's register
-- route cannot write a welcome notification until this row exists. Data only: no columns,
-- policies, grants or triggers. The existing dispatch trigger (20260624000003) already sends
-- an email for every notification insert, through the generic template.
-- Reversible: before go-live, delete the row; after, set is_enabled = false (the FK forbids
-- deleting a type that notifications reference).
insert into public.notification_type_settings (type, label, description) values
  ('booker_welcome', 'Welcome to Ezzy Booker',
   'Sent to a booker when their account is created. Tells the address owner the account exists.')
on conflict (type) do nothing;
```
Blast radius:
- **Data:** one row inserted; no existing row read or rewritten. `on conflict do nothing` makes a
  re-run harmless.
- **Lock / performance:** a single-row insert into a ~25-row lookup table. Instant.
- **Downstream:** Command's notification settings list shows one more type (it reads this table).
  No type regeneration (types are hand-written). The Edge Function needs **no redeploy**: an
  unknown type renders through the generic template (`types.ts` header). Optional: add
  `"booker_welcome"` to its documentation union in a later function deploy.
- **Reversibility:** as in the header.
- **RLS / grants:** unchanged. The table already has its read policy, and the row is written by
  the migration, not by any client.

**I2-b — booker code (`feature/pre-release-prep`)** — ✅ written 2026-10-28: `lib/welcomeEmail.ts` + `lib/welcomeEmail.test.ts` (5 tests), `app/api/register/route.ts` (new best-effort block before the Command one, plus 3 imports). Verified: `tsc --noEmit` clean; `npm test` 319/319; full lint 18 problems = the pre-existing count, the changed files lint clean. One change from the spec: the title and body take `APP_NAME` instead of a literal "Ezzy Booker" (booker's branding is configured, `6bdd9f1`); production renders the approved text exactly
- New `booker/lib/welcomeEmail.ts`: `WELCOME_TITLE` and `welcomeBody({ name, portalUrl })`. Pure,
  like vendor's `registrationEmail.ts`, plus `welcomeEmail.test.ts` (it renders with and without a
  URL, and never says "verify").
- `booker/app/api/register/route.ts`: inside the existing notification `try` block (`:127–153`),
  also read the `booker_welcome` type. If it is enabled, insert one row
  `{ user_id: uid, portal: "booker", type: "booker_welcome", title, body, data: { source: "booker" } }`.
  If it is missing or disabled, `console.warn` naming the migration, as vendor does. **Never
  throw:** the account already exists; the email is a consequence, not a precondition.
  `portalUrl` from `resolveSiteUrl()` in its own try, so a misconfigured deploy sends the
  link-less wording.
- No component change, so the render/hook/style split doesn't apply. No new dependency.

**I2-c — the email's wording (draft for the user to approve)**
> **Title:** Welcome to Ezzy Booker
> Hi {name}, your Ezzy Booker account is ready. You can sign in at {portalUrl} and book
> straight away.
> Didn't create this account? Someone may have used your email address by mistake. Use
> "Forgot password" at {portalUrl} to take control of it.

**Release order (safe in either order):** because of the guard, a booker build that arrives
before the migration just sends no welcome (a warning in the logs), and a migration that arrives
before the build adds an unused row. The planned order is still DB first: S0 before S1, P0 before P2.

**Checks:** `tsc`, `lint`, `npm test` (machine). Local: the user applies the migration, then a
sign-up writes a `booker_welcome` row (machine, via local psql). Staging: a sign-up with an inbox
you can read receives the email (human). Confirm `notification_email_settings` has booker email
enabled on staging and production (read-only query; the gate defaults to on if the row is missing).

**Accepted side effects:** a sign-up now sends mail to whatever address is typed, once per address
(emails are unique), so it can't be used to flood one inbox. These go through Resend directly,
not the 30/h Auth limit (F8).

### I3 — Which build goes live on launch day  ⬜ TODO — D4 resolved 2026-10-27: both go in
Production holds the carousel build (2026-10-24). On staging, but not in production:
- `2026-10-25-booker-home-divisions-layout.md`: staging ✅, production ⏸ ("ships with another
  feature").
- `2026-10-25-booker-visible-branding-cleanup.md`: built locally; staging and production ⏸
  (deferred by the user 2026-10-26).
- `develop` is at 0.29.5 ("clean up").
The launch should promote **one** tested staging build that contains everything you want customers
to see first. Promoting it per §12 is this plan's release. **D4** names the content.

### I5 — Carousel: config to hide the pause/play button  ✅ code (2026-10-29) · staging ⬜
User request after S3: a JSON setting to show or hide the carousel's pause/play button, set to
hidden for now. Booker only, no schema.
- `lib/promoSlides.json`: `"showPlayPauseButton": false` (alongside the user's own
  `autoplaySeconds` 2 → 5). `lib/promoSlides.ts`: `PromoConfig.showPlayPause` and
  `showPlayPauseProblem`; missing or invalid **shows** the button (the safe side).
  `app/page.tsx` → `HomePage` (`promoShowPlayPause`) → `PromoCarousel` (`showPlayPause`, default
  true), which skips rendering the button. The hook is unchanged.
- Tests: `promoSlides.test.ts` covers the setting and the shipped JSON; gallery mode
  `promoautohidden` (not baselined) + a `promo.spec.ts` test: no button, autoplay runs, a manual
  move stops it. booker `AGENTS.md` how-to updated.
- ✅ Verified 2026-10-29 (machine): tsc clean; `npm test` 323/323; `promo.spec.ts` 25/25;
  lint at the pre-existing 18.
- ⚠️ Accessibility trade-off, accepted by the user's request: with the button hidden, autoplay
  stops only on a booker's own move (swipe, ‹ ›, ← →) or holds on hover/focus. WCAG 2.2.2 expects a
  visible pause for motion over 5 s; `autoplaySeconds` is 5. Turning the button back on is
  one JSON line.

### I4 — Search indexing is off in production  ✖ ABORTED (2026-10-27) — D5(a): stays `noindex` for launch
`app/robots.ts` and `next.config.ts` serve `Disallow: /` and `X-Robots-Tag: noindex` unless
`ALLOW_INDEXING=1`. That was a deliberate choice for all portals
(`2026-08-21-web-apps-seo-indexing-audit.md` D1). Booker is the one customer-facing portal, so
confirm the choice still holds at launch. Turning it on is an env var plus a redeploy, with no code.

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains — see plan-authoring §7. -->
- **D1** — Launch with the abandoned-checkout slot leak (B3)? → **(a) launch now; release held
  slots by hand, daily, after 24 hours unpaid** (resolved 2026-10-28, user: "yes, go with daily and
  24 hours"). Based on B3-a: staging 2 old, 0 holding a future slot; production 0. The routine is
  `architecture/booker-abandoned-checkout-cleanup.md` (B3-c). The real fix stays with the kiosk
  checkout plan B4; the user may pursue it in a separate session; launch does not wait for it.
- **D2** — Manifest `background_color` (I1) → **(a) keep `#0b1020`** (resolved 2026-10-27, user
  approved the recommendation). The splash matches the dark theme booker opens in. `theme_color`
  becomes `#034bfc`.
- **D6** — The password character rule (F9) → **(a), set to "No required characters"**, keeping
  minimum length 8 and leaked-password protection on; **no code change** (resolved 2026-10-28,
  user: "I'll go to no requirement and avoid that code change for now"). Booker's "Min. 8
  characters" hint then states the whole rule. Applies project-wide (vendor, command too), to new
  or changed passwords only. Ships as B2-b (staging) then B2-c (production).
- **D3** — Register hardening (I2) → **a welcome email that does not block sign-in** (resolved
  2026-10-28, user: "lets go with that middle option"; "do not execute without my approval").
  Not the confirmation-email option (b) and not throttling (c). The account is still created and
  active at once; the address owner is told it exists, so a mistyped or borrowed address gets
  noticed. Cross-app (booker + one backbone migration), so I2 carries an **approval gate**.

## DEFERRED / COSMETIC
- **F4, no `global-error.tsx`.** It only covers a crash in the root layout itself, and it is the
  same in all three apps. Fine for v1.
- **Unused starter files** `public/{file,globe,next,vercel,window}.svg`: nothing references them
  (grep, 2026-10-27). They are harmless. Remove them in any later booker change.
- **The service worker caches same-origin images forever** (`public/sw.js:29–43`). This is already
  documented and handled for promo artwork by versioned names. The cost is only that an
  unversioned icon change is slow to reach returning visitors. Not a launch issue.
- **`booker-visual-baseline-remediation`** (29 drifted baselines, paused): test hygiene, not
  customer-facing.
- **live-verification F1** (the booker demo seed has no double-run guard): staging-only by
  decision L3-c. Not production.

## Launch must-dos — worked one at a time (added 2026-10-27 at the user's request)

The three blockers, taken in this order, one per session. Each is split into what can be done
**now** and what has to wait for the production stage. §12 forbids changing production before the
plan's last stage. **Reading** production is fine, the same way the production-sync plan's Stage 0
read-only checks were.

⚠️ **B2 does not resolve D1.** B2 is about sign-in and password reset (Supabase Auth). D1 is about
bookings holding slots (the booking lifecycle). They share no code, table or setting. D1 is
answered only by B3.

### Must-do 1 — B1, production posture  🔄 IN PROGRESS — every "now" step ✅ 2026-10-28; only B1-d remains, and it belongs to the production stage (P4)
| # | Who | Step | When | Check |
|---|---|---|---|---|
| B1-a1 | 🤖 | The checklist's public probes against `booker.ezzy.ph` | now | ✅ **DONE 2026-10-28**, machine-verified by `curl`; results under F5 |
| B1-a2 | 👤 | In Vercel → booker → Settings → Environment Variables, **Production** scope, tick each row of the table below. Read only: change nothing now | now | ✅ **DONE 2026-10-28**: the user checked every row in Vercel and reported all as expected (keys compared against the production Supabase project, and PayMongo key against vendor's Production value, by first/last characters; no values shared). Human-verified |
| B1-b | 👤 | PayMongo dashboard (**live mode**) → Developers → Webhooks: one webhook to `https://booker.ezzy.ph/api/payment/webhook`, **enabled**, event `checkout_session.payment.paid` | now | ✅ **DONE 2026-10-28**: the user confirmed in PayMongo (live mode) that the webhook to `booker.ezzy.ph/api/payment/webhook` exists, is enabled, and listens for `checkout_session.payment.paid`. Human-verified. This also confirms Vercel row 8 is a live-mode secret. Settlement itself is proven only by B1-d |
| B1-c | 👤 + 🤖 | L3-a, read-only stand-in (see below): run the query on **staging and production**, paste both results here | now | ✅ **DONE 2026-10-28**: the user ran the query on both projects. Staging and production returned **identical** rows, which also equal local: `get_popular_offerings` `642088ad…`, `get_slot_occupancy` `952409f6…`, both `secdef` true, `anon_exec` false, `auth_exec` true. Machine-verified (catalog query); the live two-account behaviour is still owed in B1-d |
| B1-d | 👤 | One real, small paid booking on production, then cancel and refund it. This is also the real L3-a: a second account sees the slot's "N left" drop | **production stage (P4)** | ⏸ **PARKED 2026-10-28 by the user**: "we will have a round of production testing later on". **Unblocks** when the user schedules that round. Until it runs, payment settlement on production is configured but not proven. Check when run: `is_paid` settles, the email arrives, the vendor sees it, the count drops |

**B1-a2 — Vercel rows for booker, Production scope**

| ✓ | Variable | Must be | Already proven by a probe? |
|---|---|---|---|
| ✅ | `NEXT_PUBLIC_SUPABASE_URL` | `https://pdkejyjidrfxksaczvfy.supabase.co` | ✅ the CSP names this project |
| ✅ | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **production** project's publishable key | ❌ the `sb_publishable_` format carries no project ref |
| ✅ | `SUPABASE_SERVICE_ROLE_KEY` | the **production** project's secret/service_role key, **not** the publishable one | ❌ server-only. Wrong key = a paid booking silently stays unpaid |
| ✅ | `NEXT_PUBLIC_APP_URL` | `https://booker.ezzy.ph`: scheme, no trailing slash | ✅ the page names only `booker.ezzy.ph`; no `localhost` |
| ✅ | `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_APP_DOMAIN` | "Ezzy Booker" / the booker domain | ✅ name (manifest); domain not probed |
| ✅ | `PAYMONGO_SECRET_KEY` | starts `sk_live_`, and **the same value as vendor's production** (same account) | ❌ compare the two values, not just the prefix |
| ✅ | `PAYMONGO_WEBHOOK_SECRET` | the secret of the **live-mode** webhook in B1-b | ½: it is set and non-empty (probe answered `Invalid signature`, not 500); the mode can't be probed |
| ✅ | `ALLOW_INDEXING` | **unset** (D5) | ✅ robots `Disallow: /` and `X-Robots-Tag: noindex` |
| ✅ | `CSP_REPORT_ONLY` | **unset** | ✅ the header is the enforcing `content-security-policy` |
| ✅ | `NEXT_PUBLIC_MAP_STYLE_URL[_DARK]`, `NEXT_SHOW_VERSION`, `NEXT_PUBLIC_APP_VERSION` | optional; unset is fine | — |
| ✅ | Every row above is scoped to **Production**, not Preview only | — | — |

The variable list was re-read from booker's source on 2026-10-28 (`grep process.env`). It matches
the checklist; booker reads nothing it doesn't list.

**B1-c — the read-only stand-in for L3-a, and why**
`get_slot_occupancy` refuses any caller who is not a signed-in active user
(`20260922000001_slot_occupancy_rpc.sql`, the `is_active()` check). So it **cannot be called from
the SQL editor**: it raises `42501`. The real test is two accounts in the UI, which writes a
booking, so it moves to B1-d. Proving production's function **byte-identical to staging's** (which
passed L1 on 2026-10-14), with the same grants, is the read-only half. Run on each project:

```sql
select p.proname,
       p.prosecdef                                   as secdef,
       md5(pg_get_functiondef(p.oid))                as def_md5,
       has_function_privilege('anon', p.oid, 'execute')          as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_slot_occupancy', 'get_popular_offerings')
order by 1;
```

Local reference (2026-10-28): `get_popular_offerings | t | 642088adba3f906219298294de92c3f9 | f | t`
and `get_slot_occupancy | t | 952409f6e713aec269f36c07e382f3f6 | f | t`. **Staging is the authority,
not local.** A local mismatch with both hosted projects agreeing is fine.

### Must-do 2 — B2, Supabase Auth  🔄 IN PROGRESS — every "now" step ✅ 2026-10-28; only B2-c remains, and it belongs to the production stage (P1)
| # | Who | Step | When | Check |
|---|---|---|---|---|
| B2-a0 | 🤖 | Read what Supabase publishes without a login (`/auth/v1/settings`, with the publishable key the site already ships), on both projects | now | ✅ **DONE 2026-10-28**, machine-verified; see F6 |
| B2-a | 👤 | **Read** the rest of production's Auth settings in the dashboard and report them (the B2-a table below). Change nothing | now | ✅ **DONE 2026-10-28**: all 7 rows read by the user from the production dashboard (screenshots); values recorded below the table. Human-verified |
| B2-b | 👤 | On **staging**: read its current values, then set minimum length **8**, requirements **none** (D6), leaked-password protection **on**; confirm `https://staging-booker.ezzy.ph` is in Redirect URLs. Then on `staging-booker.ezzy.ph`: request a password reset, and try sign-up with a 7-character and a leaked password (e.g. `password123`) | now | 🔄 **2026-10-28:** settings applied by the user (length 8, requirements none, leaked on; Site URL → `https://staging-command.ezzy.ph`; six redirect entries added, F10). ✅ Server-side checks machine-verified by direct `POST` to staging `/api/register`: `abcdefg` → 400 "at least 8 characters … known to be weak"; `password123` → 400 "known to be weak" **only**, which proves the character rule is off (`password123` has no uppercase or symbol, and Supabase checks that rule before the leaked list). No account created. ✅ **DONE 2026-10-28:** the user requested a reset on `staging-booker.ezzy.ph`; the email link opened staging booker and worked. Human-verified |
| B2-c | 👤 | On **production**: minimum length 6 → **8**, requirements → **none** (D6). Redirects, leaked passwords and SMTP need no change (B2-a). Emails/h 30 → ~100 within Resend's cap, before a public launch | **production stage (P1)** | ⛔ a reset requested on `booker.ezzy.ph` opens `booker.ezzy.ph` (P3) |
| B2-d | 🤖 | Check that booker's sign-up and reset forms show a password rejection clearly | now | ✅ **DONE 2026-10-28**, resolved by D6 with no code: once the character rule is "none", the form's "Min. 8 characters" is the whole rule, and the remaining rejection (a leaked password) is a readable sentence. Re-checked by trying a short and a leaked password in B2-b |
| B2-e | 🤝 | Does `auth.admin.createUser` enforce the password policy? Booker's route relies on it (`app/api/register/route.ts:51`) | with B2-b | ✅ **DONE 2026-10-28** (user approved the test): **yes, it does.** A direct `POST` to staging's `/api/register` with a 3-character password got `400 "Password should be at least 6 characters."`; no user was created. Machine-verified. See F7 |

**B2-a — what to read in the production dashboard, and the target**

**Production values read by the user (2026-10-28):** signups off, Confirm email on (screenshot,
matches F6). Plan: **Pro**. Row 6: emails **30/h** (project-wide, shared by all three apps);
token refresh 150/5 min, token verification 30/5 min, sign-ups and sign-ins **30/5 min per IP**,
minimum interval per user 60 s. Row 7: SMTP still Resend (user: "good to go"). Row 1: Site URL `https://command.ezzy.ph` ✅ (the documented default). Row 2: ✅ redirect list holds the bare origin **and** `/**` for all three apps: `command.ezzy.ph`, `vendor.ezzy.ph`, `booker.ezzy.ph` (screenshot, 6 entries). **So production's redirect part of B2-c is already in place; B2-c shrinks to row 3 (and 5/6 if changed).** Rows 3–5 (screenshot, 2026-10-28): minimum password length **6**; password requirements **"Lowercase, uppercase letters, digits and symbols"**; leaked-password protection **on**. Also seen: secure email change on, secure password change off, require current password off, email OTP expiry 3600 s. **B2-a ✅ complete.** Row 4 raises F9 / D6.
Row 6 assessment: see F8.

| # | Where (Supabase → production project → Authentication →) | Read | Target |
|---|---|---|---|
| 1 | URL Configuration → **Site URL** | the value | leave as is (command is the documented default) |
| 2 | URL Configuration → **Redirect URLs** | is `https://booker.ezzy.ph` listed **exactly**, with no trailing slash or path? | listed. A `https://booker.ezzy.ph/**` pattern alone does **not** cover it (`supabase-production-setup.md`) |
| 3 | Sign In / Providers → Email → **Minimum password length** | the number | **8**, matching booker's own form check (F7). Higher also works but the form would say 8 and Supabase another number |
| 4 | same page → **Password requirements** | the setting | your call; any rejection is shown verbatim (F7) |
| 5 | same page → **Prevent use of leaked passwords** | on or off, or unavailable | on, if your plan offers it. It may be a paid-plan feature; if it is unavailable, record that and move on |
| 6 | Rate Limits → **emails sent** per hour | the number | high enough for real resets. Supabase's default is very low; with Resend as SMTP you can raise it |
| 7 | Emails → SMTP Settings | still Resend, sender `no-reply@ezzy.ph` | unchanged (confirmed 2026-08) |

### Must-do 3 — B3, abandoned checkouts  ✅ DONE (2026-10-28) — D1 resolved; routine written and dry-run on staging
| # | Who | Step | When | Check |
|---|---|---|---|---|
| B3-a | 👤 + 🤖 | Measure the size of the problem on staging and production (read-only): count of `pending`, `is_paid = false` bookings, by age. 🤖 writes the query | now | ✅ **DONE 2026-10-28**, query run by the user. **Staging:** 2 bookings, both older than 7 days, both reached PayMongo, ₱1,800, **0 holding a future slot**. **Production:** no rows (not launched). So nothing is blocked today. Staging traffic is testing, so it does not predict launch volume |
| B3-b | 👤 | Answer D1 with those numbers in hand | after B3-a | ✅ **DONE 2026-10-28**: D1 = (a), daily, 24-hour cutoff |
| B3-c | 👤 + 🤖 | If D1 = (a): write the manual clean-up routine (who looks, how often, the query, how to cancel through the vendor/command UI so the transition trigger is respected) | after B3-b | 🔄 **Routine written 2026-10-28** as `architecture/booker-abandoned-checkout-cleanup.md` (query tested read-only on local; Reject path read from `vendor/services/bookings.service.ts:163` and `useBookingActions.ts:146–147`; the customer gets `booking_rejected`). Linked from `booking-flow.md` and the core-rules "Where to look" table. ✅ **DONE 2026-10-28:** the user ran the Step 1 query on staging: no rows, as predicted by B3-a (both staging stuck bookings are for past dates). The query runs on a hosted project **First production run 2026-10-29** (launch day): 0 rows, run by the user. The routine is now daily |

**B3-a — the query** (read only; tested on local 2026-10-28 inside a `begin read only … rollback`).
Run it in the SQL editor of **staging** and **production**, and paste both results.

```sql
-- B3-a: booker bookings that hold a slot without being paid. Read only.
with stuck as (
  select b.id,
         b.price_paid,
         b.payment_reference is not null                            as checkout_started,
         now() - b.created_at                                       as age,
         (b.booked_date + coalesce(b.start_time, time '00:00'))
           > (now() at time zone 'Asia/Manila')                     as slot_in_future
  from public.bookings b
  where b.booked_via = 'booker'
    and b.status = 'pending'
    and b.is_paid = false
    and coalesce(b.price_paid, 0) > 0
)
select case
         when age < interval '30 minutes' then '1: < 30 min (may still be paying)'
         when age < interval '1 day'      then '2: 30 min – 1 day'
         when age < interval '7 days'     then '3: 1 – 7 days'
         else                                  '4: > 7 days'
       end                                         as age_bucket,
       count(*)                                    as bookings,
       count(*) filter (where slot_in_future)      as still_holding_future_slot,
       count(*) filter (where checkout_started)    as reached_paymongo,
       sum(price_paid)                             as total_value_php
from stuck
group by 1
order by 1;
```

How to read it:
- **`still_holding_future_slot`** is the column that matters. These are places customers can't
  book right now. An unpaid booking whose date has passed blocks nobody.
- **`reached_paymongo`** separates abandoned payments (the customer got to PayMongo and left) from
  bookings that never reached a checkout at all.
- Bucket 1 is normal traffic: someone is likely paying right now.
- Scope: booker-origin, `pending`, unpaid, price above zero. Free and kiosk bookings are left out
  because they are never meant to be paid through PayMongo.

## Execution order
1. **Must-do 1 → 2 → 3**, one at a time (above). Each one's "now" rows only. Nothing in them changes production.
2. 👤 **D1 and D3 answered** (D1 by must-do 3). D2, D4, D5 resolved 2026-10-27.
3. ⛔ **Approval gate:** the user approves I2 (migration I2-a, code I2-b, wording I2-c), with any changes.
4. 🤖 **Code stage** on booker `feature/pre-release-prep`: I1 + I2-b; write the I2-a migration file.
   `tsc`, `lint`, `npm test`. The D4 content is already in `develop`.
5. 👤 **Local:** apply the migration locally; 🤖 checks a local sign-up writes the welcome row.
6. **Staging release** (S0–S3).
7. **Production release and launch gate** (P1–P4, including P2a, B2-c, and B1-d when the user's testing round runs). Always last.

## Release (§12)
One migration (I2-a, once approved). No Edge Function deploy is required (generic template).

### Staging (production untouched throughout)
| # | Who | Step | Check |
|---|---|---|---|
| S0 | 👤 | From `backbone/`: `supabase migration list --linked` → `supabase db push` (linked = staging) | ✅ **DONE 2026-10-28** (user ran `db push`): `migration list --linked` read by 🤖 shows `20261028000001` applied on staging, and local = remote for every migration, nothing extra either side. Machine-verified. The row itself isn't readable anonymously (the read policy is `authenticated` only); S2's welcome email proves it end to end |
| S1 | 👤 | Deploy the agreed build (D4) to staging | ✅ **DONE 2026-10-28**: the user pushed and released; 🤖 probes on deployment `dpl_E9s3YRZi4J18mSLGUub1GfQXZtdh`: manifest `#034bfc` / `#0b1020` / "STAGING BOOKER"; only `staging-booker.ezzy.ph` named, no `localhost`; CSP on the staging project; `noindex`; webhook 400 Invalid signature, create-session 401, register 400; favicon and icon hashes unchanged (vendor's). Machine-verified |
| S2 | 👤 | Sign up (with an inbox you can read), sign in, reset password, book and pay (test mode) on staging | ⛔ all pass; reset link opens staging booker; **welcome email arrives** — 🔄 **2026-10-29:** sign-up as `meefiebossman+ghoul@gmail.com` wrote `booker_welcome` (14:26:20 UTC), sent 2 s later; Resend shows it **Delivered to `cto@ezzy.ph`** (F11 override). ✅ The user read it in `cto@ezzy.ph` and confirmed it good (human-verified, 2026-10-29). ✅ **DONE 2026-10-29.** Book and pay: the user booked and paid in test mode as the same booker ("payment went as expected"). 🤖 read booking `62c0cf78…` on staging: `is_paid = true`, `payment_reference` `cs_…` set, ₱2,500, status `pending` (waiting for the vendor, which is correct), created 15:01:57 UTC, paid by webhook at 15:02:36. Vendor notifications `new_booking` and `payment_confirmed` were both sent. Sign-in is covered by the booking. Reset was human-verified on staging under B2-b (2026-10-28). See F12 for the booked slot's time |
| S3 | 👤 + 🤖 | Look at Home/Explore/Activity/Payments, light and dark, phone and desktop | ⛔ all green — ✅ **DONE 2026-10-29**, human-verified ("visual checks passes for me"). Followed by patch I5, which changes Home's carousel: re-glance after its staging deploy |

⛔ **Staging fully green before anything touches production.**

### Production (last stage)
| # | Who | Step | Check |
|---|---|---|---|
| P1 | 👤 | Parity: production env per `production-env-checklist.md` (B1 L3-b), Auth settings (B2); `supabase secrets list --project-ref <prod>` shows **no** `NOTIFICATION_EMAIL_OVERRIDE_TO` (F11) | ⛔ every row ticked — 🔄 **2026-10-29**, 🤖: `secrets list --project-ref` (names; values are digests) has **no** `NOTIFICATION_EMAIL_OVERRIDE_TO` ✅. `POST /api/register` with `abc12` (cannot create an account under either length) → "at least **6** characters … known to be weak": minimum length is **still 6** ⬜, leaked check on ✅, and no character-rule reason, so the rule looks **off** ✅ (inferred from the message, as on staging). Production env rows were ✅ under B1-a1. ✅ **DONE 2026-10-29:** the user set length 8 and emails/h 100; 🤖 re-probe: `abc12` and `abcdefg` both → "at least **8** characters … weak", no account created (machine-verified). Emails/h = 100 is user-reported; not readable from outside |
| P2a | 👤 | `supabase migration list --project-ref <prod>` → `supabase db push --project-ref <prod>` | ⛔ prod = staging minus `20261028000001` before; equal after — ✅ **DONE 2026-10-29** (user pushed). 🤖 `migration list --project-ref pdkejyjidrfxksaczvfy`: 89 rows, local = remote for every one, `20261028000001` included. Machine-verified |
| P2 | 👤 | Vercel **Promote** the exact staging deployment tested in S1–S3 | ⛔ same deployment id — 🔄 **2026-10-29 16:33 UTC:** the user reported P2 done, but 🤖 probe found production still serving the pre-I1 build (manifest `#205cfc`, fresh response, age 9 s). Not counted. The user is redoing it after P2a, promoting the deployment that includes I5 ✅ **DONE 2026-10-29** (user re-promoted after P2a): production manifest now `#034bfc`, so the build includes I1. Deployment id not compared by 🤖 |
| P3 | 👤 + 🤖 | Probes: `curl` manifest, robots, headers, favicon hashes; password reset from `booker.ezzy.ph` | ⛔ match expectations — 🔄 **2026-10-29**, 🤖 part ✅: manifest "Ezzy Booker" `#034bfc` / `#0b1020`; `Disallow: /`; `X-Robots-Tag` noindex; HSTS; CSP `connect-src` names only the production Supabase project; no staging host, staging ref or `localhost` in `/` or `/login`; favicon and icon-192 hashes equal staging's; `/` 200; register, create-session and webhook 400 on an empty body. ✅ **DONE 2026-10-29:** the user tested password reset and Home's carousel on production, both working (human-verified) |
| P4 | 👤 | B1: L3-a occupancy check + one real paid booking, then refund | ⛔ `is_paid` settles, email arrives |

Then announce. Production stays the last stage.

## Verification
- I1: `tsc` / `lint` (machine); live manifest via `curl` on staging and production (machine);
  installed-PWA colour on a phone (human).
- I2: depends on D3. Under (b), a sign-up must not sign in until the email link is opened (staging, human).
- B1, B2: hosted-only, the user's to run. The agent can `curl` public endpoints only.
- F1, F2 were machine-verified on 2026-10-27 (md5 of local files and live responses, response headers).
