# Vendor Mobile Kiosk Mode

**Date:** 2026-09-03  
**App / scope:** `ezzy-vendor-mobile`, with a narrow authenticated API-contract change in `vendor`  
**Status:** IN PROGRESS — Stage 1 is complete (2026-09-10); stages 2–8 remain.

**Reassessed:** 2026-09-10 — implementation paused for review of this revised plan,
at the user's request. Existing code is retained; this assessment changes this plan only.
The stage table below supersedes earlier chat stage numbering. Web releases first;
mobile must preserve its customer workflow and server contracts.

## Current Assessment and Stages (2026-09-10)

| Stage | Items / status | What exists now | What remains |
|---|---|---|---|
| 1. API access | B1, B1.1, B1.2 — ✅ DONE | Bearer/cookie guard, mobile API client and FK fix; selected-vendor success and other-vendor 403 verified by emulator screenshots; temporary probe removed | None for Stage 1; production and full kiosk workflow verification remain in later stages |
| 2. Main-menu entry and containment | I1 — ⬜ TODO | Four staff navigation tabs; no customer kiosk route | Main-menu **Kiosk Mode** action, launcher, separate root kiosk route, persisted vendor, staff exit, session/back/deep-link guards |
| 3. Catalogue and schedules | I2, I7 — ⬜ TODO | Web catalogue, photos, eligibility, occurrence/capacity helpers; mobile booking history | Port read models and tests, seven-day picker, quantity/span rules, 24-hour and overnight dates; correct mobile history span formatting |
| 4. Customer and agreements | I3 — ⬜ TODO | Web name/email/optional PH mobile form, document review and consent | Native forms, conditional agreement step, safe document viewer, matching validation and reset behaviour |
| 5. Signatures | I5 — ⬜ TODO | Web PNG capture; server supports one signature shared by distinct acknowledgement rows | Full native capture before release, clear/redraw, multiple required documents, approved SDK-compatible dependency if necessary |
| 6. Checkout and receipt | B2, I6 — 🔄 IN PROGRESS | Mobile session creation, browser opener and RLS payment-status reader; web receipt re-read | Wire checkout, safe retry/recovery, return handling, verified payment state and actual receipt fields; resolve D6 before implementation |
| 7. Finish a booking | I4 — ⬜ TODO | Web identifier lookup and server-derived session/custody transitions | Native lookup/results/confirmation, duplicate/stale response handling, reset; no staff roster |
| 8. Release verification | B3, I8 — ⬜ TODO | Web staging payment and customer email proven in newer plan | Mobile end-to-end payment/email, lifecycle and privacy tests, Android/iOS checks; production evidence separately |

### Evidence and Corrections

- Reviewed current code, not just the original August plan: `vendor/lib/kioskAuth.ts:28`,
  `vendor/lib/kioskSteps.ts:34`, `vendor/lib/kioskAcknowledgements.ts:44`,
  `vendor/components/kiosk/KioskBooking/useKioskBooking.ts:84`,
  `vendor/components/kiosk/KioskBooking/useKioskCheckout.ts:29`,
  `vendor/components/kiosk/KioskBooking/useKioskReceipt.ts:26`,
  `vendor/services/kiosk.service.ts:206`, and all four kiosk API routes.
- **B1 is further along than the old chat recap:** the dated September 4–7 notes below
  record cookie/invalid-token probes and the authenticated query diagnosis. Do not erase
  that evidence or equate an invalid-token 401 with valid bearer success.
- **B2 has partial mobile code:** `src/services/kioskApi.ts:99` creates a session and
  `src/services/kioskPayment.service.ts:11` opens an ordinary browser and reads `is_paid`.
  These helpers are not connected to a customer screen and implement no native callback.
  The planned HTTPS bridge and `client: mobile` server contract do not exist.
- **Webhook setup is no longer globally missing:** the September 8 email plan records
  an actual staging kiosk payment and branded customer receipt, with production deployed
  but an actual production payment still awaiting proof. This is evidence recorded in
  that plan, not a new live verification in this assessment. Reuse that infrastructure.
- **Web fixes to carry forward:** August kiosk plan B31 fixes multiple signed documents;
  B33 uses `resolveSiteUrl` instead of localhost fallback; B38 corrects webhook event
  parsing; B39 clears consumed payment-return state; B40 re-reads real receipt values.
  See `architecture/booking-flow.md:622` and `:672` for the updated contracts.
- Assessment checks: vendor kiosk test files passed **5/5** and mobile test files passed
  **10/10** on 2026-09-10. No live requests, deployments, builds, or device tests were
  performed in this plan-only pass. These tests do not establish UI parity.

### Parity Acceptance Rules

- Main menu means the existing bottom navigation. Add an icon plus **Kiosk Mode** label
  (wrap within a stable target if needed), alongside Dashboard, Bookings, Transactions,
  and Alerts. Tapping opens the staff launch confirmation; starting leaves staff tabs.
  It must ship with usable kiosk content, not the development diagnostic probe.
- Home exposes **Book something** and **Finish a booking**, with the pinned vendor name
  prominent. Mode survives process death; loss of access keeps the device in the neutral
  kiosk gate. All staff destinations, notification taps and recovery deep links must obey
  that gate. Holding only the index redirect is insufficient because direct links bypass it.
- Match active offering eligibility (time-based session and custody; exclude date-based
  or unscheduled), ordered photos, seven-day choices, real-time slot order, span capacity
  and quantity limits. Keep PH calendar meaning independent of device timezone. Fail
  closed on incomplete availability or attachment reads; do not interpret errors as none.
- Name and email are required; phone is optional but must validate as PH mobile when
  present. Match input filtering and validation timing in `vendor/lib/kioskSteps.ts:106`.
- Photos alone produce no agreement step. Every active document needs acceptance;
  a signature step appears if any document requires it. One PNG may cover multiple
  required documents, each with a distinct server-written acknowledgement id. Do not
  filter signature-required offerings out of the first mobile release (D3-B).
- Match the final review, real booking reference, service, date/time and actual charged
  amount. Payment status and booking approval status remain distinct: paid can still be
  pending vendor approval. Never label a redirect or a failed receipt read as paid.
- Checkout creates the booking as late as possible. Preserve a successful booking id
  during session-creation failure and reuse a returned checkout URL on browser-open
  retry. Do not automatically replay an ambiguous booking POST or create a second session
  when payment may already have succeeded; offer a staff recovery path.
- Customer data stays memory-only and outside the existing persisted staff query keys.
  Intentional document/payment browser handoffs must not trigger ordinary background reset.
  Suspend inactivity during the handoff; on resume recheck access and the elapsed deadline,
  refetch availability/payment as applicable, and ignore responses belonging to an old
  customer. On process death restore kiosk home safely, never invent a paid receipt.
- OS notification content and app-switcher previews need device checks during kiosk use:
  hiding tabs alone does not hide staff information outside the foreground UI. Document
  device lockdown/notification setup limitations; do not promise app-level OS lockdown.


> Give a vendor-owned Android or iOS device a customer-facing, full-screen kiosk flow
> that creates kiosk-origin bookings and starts a PayMongo Checkout Session without
> exposing staff UI, service-role credentials, or customer data.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.  
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local.

---

## Scope

**In scope**

- A native, kiosk-only route outside the mobile tab navigator, launched by a vendor
  from a main-menu **Kiosk** button and protected by a staff-password exit confirmation.
- Customer offering, slot, details, agreement, booking and PayMongo Checkout Session
  flow, built on the existing kiosk schema and server-side business rules.
- The existing server routes accept the Expo app's short-lived Supabase access token as
  well as the web portal's cookie session. No second privileged implementation.
- An authenticated, fixed mobile payment-return bridge and truthful pending-payment UI.
- Existing kiosk close-out lookup and confirmation on the mobile kiosk home screen.

**Explicitly out of scope**

- New tables, migrations, RLS changes, a new PayMongo webhook, a new payment provider,
  PayMongo key exposure, and an offline booking/payment mode.
- OS-level kiosk lockdown. Guided Access, Android screen pinning, or managed-device
  lock task remains the vendor's device configuration, not an app security boundary.
- Moving the current PayMongo integration from v1 to v2. PayMongo now recommends v2 for
  new integrations, but changing the shared booker/vendor payment contract is a separate
  cross-app migration and must not be smuggled into this feature.

## Investigation Record

- The web kiosk is implemented and its schema migrations are applied locally, staging,
  and production. It uses `booked_via = 'kiosk'`; the booking route derives price,
  booking span and capacity server-side, and the shared booker webhook settles payment.
  See [booking-flow.md](/home/joshua/RS/architecture/booking-flow.md:432) and
  [schema.md](/home/joshua/RS/architecture/schema.md:76).
- The mobile app has no Offering, Schedule, attachment, slot-availability or kiosk types
  yet; this is intentional scope from its original build-out, not a broken partial port.
  See [types.ts](/home/joshua/RS/ezzy-vendor-mobile/src/lib/types.ts:1).
- `vendor/lib/kioskAuth.ts:28` only obtains identity from cookie-bound SSR auth. An Expo
  bearer token would be rejected, so mobile cannot call the existing privileged booking,
  payment, or close-out routes until the guard has an authenticated bearer path.
- The existing payment route already owns PayMongo secrets and uses a server-derived
  amount, `metadata.booking_id`, and the shared webhook. It currently returns only to
  the web kiosk. See
  [create-session route](/home/joshua/RS/vendor/app/api/kiosk/payment/create-session/route.ts:32).
- `expo-web-browser` and the existing `ezzyvendormobile` scheme can return an installed
  development/production build from hosted checkout. PayMongo requires complete
  success/cancel URLs, so the server must use fixed HTTPS URLs then return only to the
  registered application scheme. The deep-link result is not payment confirmation:
  the webhook remains authoritative. [Expo linking guidance](https://docs.expo.dev/linking/into-other-apps/),
  [Expo WebBrowser API](https://docs.expo.dev/versions/v56.0.0/sdk/webbrowser/),
  [PayMongo hosted checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout).
- Baseline at plan creation: `npm --prefix ezzy-vendor-mobile run lint` passed and
  `npm --prefix ezzy-vendor-mobile test` passed (10/10) on 2026-09-03.

## BLOCKERS

### B1 — Preserve the privileged server boundary for mobile callers  ✅ DONE (2026-09-10)
**Stage 1 closeout (2026-09-10):** User supplied the second Android emulator screenshot
showing selected vendor `10000000-0000-0000-0000-000000000003`, other vendor
`10000000-0000-0000-0000-000000000002`, server `https://staging-vendor.ezzy.ph`, and
"Access to the other vendor was correctly denied (403)." The target is Harbor Sports
Complex, an actual vendor in `backbone/supabase/seed.sql`, not the similarly numbered
user UUID. Together with the earlier selected-vendor success, both authenticated live
checks pass. Evidence is user-operated emulator screenshots, not agent-captured HTTP bodies.

Removed the temporary Settings panel, hook state/handlers, probe-only styles and imports,
and the unused `verifyKioskAccess` helper from `src/services/kioskApi.ts`. Existing render,
hook and style separation is preserved in the three `SettingsList` files. Production
kiosk requests and server authorization are unchanged; no sibling app, schema, dependency
or version changes were made. User approved this cleanup and plan closeout in conversation.

**Cleanup verification:** mobile TypeScript, the standard `npm run lint` and all 10 Node
test files passed; `git diff --check` passed and source search found no remaining probe
references. No post-cleanup emulator screenshot or iOS run was performed; this records
source removal, not a new visual signoff. Earlier cookie/401 and vendor test evidence is
retained below. All outstanding Stage 1 wording in the dated history below is superseded
by this closeout. Stages 2–8 are not authorized by this cleanup and remain unfinished.

**Live verification update (2026-09-10):** User supplied an emulator screenshot showing
`https://staging-vendor.ezzy.ph`, selected vendor
`10000000-0000-0000-0000-000000000003`, and "Access to the selected vendor succeeded."
This verifies the signed mobile selected-vendor probe succeeds and the previously observed
500 is no longer reproduced on that path. The screenshot does not expose the raw response
body, so an empty bookings array was not independently inspected. B1.2 is closed on this
device evidence. B1 and B1.1 remain open for a known other-vendor 403 and probe removal.
The earlier checkpoint and next-step text below are retained as history, superseded by
this result for the selected-vendor test.

**Stage 1 checkpoint (2026-09-10):** User explicitly requested Stage 1 after the
reassessment; D6 concerns later checkout work and does not block these access checks.
Re-read the bearer guard, all previously recorded live results, the explicit profile FK
join and the mobile Settings probe. Vendor and mobile app-local TypeScript checks passed;
targeted vendor/mobile lint passed; bearer and close-out test files passed (2/2).
ADB was checked twice successfully outside the WSL sandbox and reported no devices.
Consequently no authenticated request was executed this session and no deployment was
verified. Keep B1/B1.1/B1.2 in progress and retain the development probe until a signed-in
staging device demonstrates selected-vendor success and a genuine other-vendor 403.
No application code was changed during this checkpoint.

**Next live steps:** Start the emulator, open the current development build and sign in
to staging. In Settings verify the displayed kiosk server is staging, then run
"Test selected vendor access". Expect selected-vendor success (the no-match endpoint
returns 200 with an empty bookings array). Use a known existing vendor UUID that this
account does not administer for "Test other vendor is denied"; expect 403. A fabricated
UUID alone is not evidence of isolation between two real vendors. Never copy a session
token or password into chat. If the selected-vendor test still returns 500, confirm the
FK fix was deployed and inspect a sanitised server error before changing more code.

> ## 🔗 COUPLING — THIS EDITS CODE THE KIOSK PLAN OWNS (added 2026-09-03)
>
> `lib/kioskAuth.ts` and the four kiosk routes are delivered by
> `.plans/2026-08-26-vendor-kiosk-mode-and-offering-attachments.md`, where they carry
> **B4**, **B15** and **B20**. That plan is complete and its schema is live in production,
> so a regression here lands on a shipped feature, not a draft.
>
> **Three invariants this item must not break** — each was a defect found and fixed there:
> 1. **B20** — auth precedes the `PAYMONGO_SECRET_KEY` check on `create-session`. Found by
>    a live probe returning `500 {"error":"Payment not configured"}` to an anonymous POST.
>    ✅ Re-verified after this change: `requireVendorAdmin` at `:49`, `secretKey` at `:52`.
> 2. **B15** — membership is checked with `verifyVendorAdminFor(user, vendorId)` against
>    the **pinned** vendor. `verifyVendorAccess` returns `activeRows[0]`, which for a
>    multi-vendor admin is the wrong vendor.
> 3. **B4** — the caller names `vendorId` so membership needs no database read, which is
>    what removes the booking-existence oracle.
>
> **Review outcome 2026-09-03: the implementation is sound.** The `undefined` vs `null`
> split is the good part — a *malformed* bearer header is rejected rather than falling
> through to a coincidental browser cookie, so a bad mobile request cannot inherit a web
> session. Token validated via `auth.getUser(token)`, anon key not service-role,
> membership check unchanged. Vendor suite passed and `tsc` clean.
>
> **One defect found and fixed during that review:** the scheme match was case-sensitive,
> so `bearer <token>` failed **closed** — RFC 7235 §2.1 makes the scheme case-insensitive.
> Now `/i`, covered by tests over four casings plus the malformed cases in lower case.
**Files:** `vendor/lib/kioskAuth.ts:1-53`,
`vendor/app/api/kiosk/{booking,close-out,close-out/confirm,payment/create-session}/route.ts`

All four kiosk routes execute service-role operations, but their sole guard currently
reads a cookie-bound SSR session. Making the mobile app write directly to Supabase would
either fail RLS or require a service-role secret in the binary, which is prohibited.

**Fix approach:** Extend `requireVendorAdmin` to accept the `NextRequest`. When an
`Authorization` header is present, require an exact Bearer token and resolve it with the
anon Supabase client and `auth.getUser(token)`; a malformed or invalid bearer token is
401 and never falls through. When the header is absent, retain the existing cookie-session
path for the web kiosk. Run the existing vendor-admin membership check unchanged after
identity is resolved. Every route passes its request to that one helper; no endpoint gets
a route-local auth branch.

The mobile `kioskApi` service obtains the current **access token** from the persisted
Supabase session for each request, sends it only over HTTPS to the configured vendor
portal origin, and maps 401/403/409/5xx to customer-safe states. It never stores or logs
the token, and it never sends a refresh token.

**Coupling / approval gate:** This changes `vendor` and `ezzy-vendor-mobile` together.
It is an auth-boundary change and requires the user's explicit approval before execution.
No schema or RLS change is required.

**Verification:** unit-test header parsing and cookie fallback in `vendor`; live probes
for unauthenticated (401), other-vendor admin (403), rightful bearer caller (success),
and existing browser-cookie caller (success). Review the deployed endpoint is HTTPS.

**Implementation note (2026-09-03):** Added `vendor/lib/kioskBearer.ts` and its unit
tests; changed all four kiosk routes to pass their `Request` to the one auth helper; and
added mobile `src/services/kioskApi.ts`, which sends the current access token only to the
configured HTTPS portal origin. Machine verification passed: vendor unit tests (26/26),
vendor targeted lint, vendor TypeScript check, mobile lint, mobile unit tests (10/10),
mobile TypeScript check and both diff checks. Full `vendor` lint is still blocked by 32
pre-existing errors outside this scope. Re-verified 2026-09-03: the same 26 vendor and 10
mobile tests, the vendor targeted lint, and both TypeScript checks pass. B1 still needs
deployed cookie and bearer probes. **Staging probe (2026-09-04):** an unauthenticated
HTTPS `POST /api/kiosk/close-out` with a non-existent vendor UUID returned `401 Not signed
in` and created no data. Cookie fallback, other-vendor bearer rejection, and rightful
mobile-bearer success remain to be checked with signed-in test accounts. **Staging browser
cookie probe (2026-09-04):** a signed-in vendor admin opened Kiosk Mode, selected “Finish
a booking”, searched the fake identifier `zzzz-no-match-staging-20260904`, and received
“Nothing found waiting on you. Please check the number, or see the front desk.” This
confirms the cookie-session fallback and a no-match lookup made no change.
**Staging invalid-bearer probe (2026-09-05):** a deliberately invalid
`Authorization: Bearer …` header returned `401 Not signed in` with no data change. This
verifies invalid credentials are rejected. It does not prove that the bearer branch is
deployed: a cookie-only server without cookies could return the same 401.

#### B1.2 — Diagnose authenticated staging HTTP 500  ✅ DONE (2026-09-10)
**Verification:** User's emulator screenshot confirms selected-vendor access succeeds
against staging after the FK query fix; the earlier HTTP 500 no longer reproduces in this
probe. Other-vendor rejection is still tracked under B1, not a condition for this bug fix.
**Cause identified (2026-09-07):** user Vercel trace shows auth/user, roles and
vendor_members calls followed by a bookings GET returning HTTP 300. The query embeds
`profiles` without distinguishing `booker_id` from `cancelled_by`, both foreign keys to
profiles (migrations `20260507000004` and `20260516000005`). Specified
`profiles!bookings_booker_id_fkey(phone, email)` in the close-out route. Deployment and
authenticated mobile re-test remain required; B1 is not yet complete.
**Local verification (2026-09-07):** vendor TypeScript check, targeted route lint,
bearer-parser and close-out test files, and vendor diff check passed. These do not
substitute for the staging query re-test.
**Files:** `vendor/app/api/kiosk/close-out/route.ts:33`,
`vendor/app/api/kiosk/close-out/route.ts:55`, `vendor/lib/kioskAuth.ts:42`.
**Evidence:** user screenshot shows the mobile selected-vendor probe received HTTP 500
from the configured staging endpoint. ADB is no longer blocking execution. HTTP 500 alone
does not establish whether identity validation, admin-client construction, the booking
query, or the hosting layer failed. The earlier claim that staging was fully healthy was
too broad: only unauthenticated rejection and the user-reported cookie lookup were proven.
**Next check:** inspect staging runtime logs for the failing POST and its response body;
request only a sanitised error/stack, never headers, cookies, tokens or environment values.
Fix the demonstrated cause and rerun the rightful-bearer and other-vendor tests. An EAS
build is not evidence that this server error is fixed.
**Verification:** real mobile bearer lookup returns 200 with an empty bookings array;
another vendor's admin receives 403. Both remain outstanding.

#### B1.1 — Development-only signed-bearer probe  ✅ DONE (2026-09-10)

**Closeout:** Both user-operated staging emulator access checks passed; temporary probe
removed and cleanup machine-verified as recorded under B1. The implementation notes below
describe the now-removed diagnostic, not current Settings functionality.
**Files:** `ezzy-vendor-mobile/src/services/kioskApi.ts`,
`src/components/settings/SettingsList/{SettingsList,useSettingsList,SettingsList.styles}.ts*`

The real customer kiosk surfaces that call the privileged routes are intentionally later
stages, so a signed mobile bearer caller cannot otherwise prove B1 before I1/I3/I4 are
built. A temporary staff probe is needed to test the already-deployed server boundary
without creating a booking or exposing a customer surface.

**Fix approach:** In development builds only, Settings calls the existing close-out route
with a non-matching marker and the selected vendor UUID; an optional, memory-only UUID
field tests that a second vendor-admin is rejected. It displays only success, 401, 403, or
generic failure states; it never renders, stores, or logs an access token. The render,
hook, and themed style files remain separated.

**Verification:** TypeScript, lint, tests and Android development-build check. With staging
configured, a rightful selected vendor returns success; a different vendor UUID returns
403. Remove this development-only probe after B1 is verified.

**Implementation note (2026-09-04):** Added the development-only Settings probe, backed by
the existing `kioskApi` service. It uses a non-matching close-out lookup and displays the
configured server before a test runs, preventing an accidental production validation. It
does not persist, render, or log tokens. Mobile lint, TypeScript and unit tests (10/10)
pass; Android device verification remains. **Device finding (2026-09-04):** the first
selected-vendor probe displayed only a generic failure, which could not distinguish an HTTP
error from an emulator network failure. The development-only result now reports a safe HTTP
status or an explicit no-response state; re-run the device check before drawing conclusions.

### B2 — Complete mobile payment return and reconciliation  🔄 IN PROGRESS (2026-09-10)
**Reassessment:** session creation/browser/status service code exists, but no kiosk UI
calls it. The bridge below is a proposal awaiting D6, not an implemented or approved
new vendor change. Preserve the web's existing return behaviour and `resolveSiteUrl`.
**Files:** `vendor/app/api/kiosk/payment/create-session/route.ts:85-120` (modify),
new `vendor/app/kiosk/payment-return/route.ts`,
new `ezzy-vendor-mobile/src/app/kiosk/payment-return.tsx`,
new `ezzy-vendor-mobile/src/services/kiosk.service.ts`

The current success/cancel URLs return to `/kiosk` in the web portal. From an Expo
in-app browser that leaves the customer in the web application and does not restore the
native wizard. Sending an app-controlled URL in the request body would create an open
redirect and must not be permitted.

**Fix approach:** Add a `client: 'mobile'` enum to the authenticated payment-session
request. The server accepts only `web` or `mobile`; for `mobile`, it uses two
server-constructed, HTTPS return URLs under the vendor portal, each with a fixed result
value. The return route redirects only to the compiled scheme
`ezzyvendormobile://kiosk/payment-return?result=success|cancel`; it accepts no target URL
and exposes no booking/customer information.

The mobile checkout opens the received `checkout_url` through
`WebBrowser.openAuthSessionAsync` with that exact scheme callback. On return it invalidates
the booking/transaction queries and displays **"Payment submitted; confirmation may take a
moment"** until the server row actually becomes `is_paid = true`. A cancel/close resets
only the local flow; it never deletes or marks a booking unpaid, because a callback is not
financial truth.

**Verification:** Android development build and iOS device build receive both callbacks;
test card completes, cancellation returns, forged deep-link does not display payment as
paid, and the customer cannot alter the HTTPS return destination. Test only when a
PayMongo test key is available.

### B3 — Verify mobile settlement through the existing webhook  ⬜ TODO (2026-09-10)
**Previous status:** ⏸ PARKED (2026-09-03), waiting for user webhook setup.
**Reopened:** the September 8 email plan records staging settlement and email delivery.
The remaining work is proving the mobile-created booking follows that same chain and
recording production verification separately. No new webhook is required.
**Files:** `booker/app/api/payment/webhook/route.ts` (existing owner),
`vendor/app/api/kiosk/payment/create-session/route.ts:17-22`, mobile payment-result UI

PayMongo's redirect only reports browser navigation. The shared webhook, keyed by
`metadata.booking_id`, is the sole authority that changes `bookings.is_paid`; a second
vendor/mobile webhook would race it and is explicitly rejected by the established kiosk
design.

**Verification:** Confirm the target environment is the one already validated by the
web release, without reading or copying its secrets. Run a mobile end-to-end sandbox
payment and verify exactly one paid
transition, ledger row, and vendor notification. No PayMongo secret belongs in mobile or
in `vendor` as a webhook secret.

## IMPORTANT

### I1 — Establish a native kiosk mode with a real lifecycle boundary  ⬜ TODO
**Files:** `ezzy-vendor-mobile/src/app/_layout.tsx:48-94`,
`src/app/index.tsx:11-35`, new `src/app/kiosk.tsx`,
new `src/lib/kioskMode.ts`, new `src/components/kiosk/KioskShell/*`,
`src/app/(app)/_layout.tsx:55`, new `src/components/kiosk/KioskLauncher/*`

Kiosk must not be another tab or a modal over the vendor dashboard: customer-facing UI
would coexist with staff navigation and a relaunch would return to admin content. The
current root always redirects a ready vendor to `/dashboard`.

**Fix approach:** Add a protected root `kiosk` route outside `(app)` and persist only the
pinned vendor UUID in AsyncStorage. The anchor route reads that flag before selecting the
dashboard and routes directly to `/kiosk`, avoiding a frame of staff content. The kiosk
shell re-verifies the authenticated vendor-admin has access to that exact vendor whenever
the app becomes active and on auth changes. Session/access loss, no network, or invalid
vendor access clears all in-memory customer state and shows a neutral customer panel with
a separate Staff sign-in action.

The main menu gains a **Kiosk** button (requested 2026-09-07), interpreted as the bottom
navigation alongside Dashboard, Bookings, Transactions and Alerts. It opens a launch
confirmation, then navigates outside the staff tab navigator; customer kiosk content must
never render inside the staff tabs. The confirmation shows vendor identity,
eligible-offering count, no-lockdown warning, and a single Start kiosk command. Exiting
requires the current staff password to be re-authenticated, clears the mode flag and all
customer state, and returns to the normal dashboard. Android back is intercepted while
in the customer flow but is not represented as device lockdown.

**Component separation:** `KioskShell.tsx` only renders gate/view states;
`useKioskShell.ts` owns mode persistence, AppState/auth checks, idle reset and exit;
`KioskShell.styles.ts` owns static themed styles. The launcher dialog follows the same
three-file convention. Route files remain composition only.

**Web behaviour acceptance checklist (2026-09-07):** reproduce the web kiosk's
“Book something” and “Finish a booking” home choices, offering/slot/customer/document/
signature/payment flow, identifier-only close-out, persisted mode and password-confirmed
staff exit. Use `vendor/components/kiosk/KioskShell/KioskShell.tsx:115` and
`architecture/portals.md:378` as references. Adapt layout and lifecycle to native; verify
booking rules against the current web services during I2–I5. The menu button ships with
the usable protected route, not a dead link or the development probe.

**Verification:** restart/relaunch returns to kiosk with no tabs flashing; Back cannot
reveal staff UI; session loss clears fields; wrong staff password cannot exit; correct
password can; both light/dark and largest text size are visually checked on Android.

### I2 — Port schedule-aware kiosk read models, including overnight correctness  ⬜ TODO
**Files:** new `ezzy-vendor-mobile/src/services/kiosk.service.ts`,
new `src/lib/{kioskEligibility,kioskSteps,occurrence,scheduleWindow,slotAvailability}.ts`,
new matching `*.test.ts`, `src/lib/types.ts:1-9`

The web kiosk's availability logic is deliberately split into pure modules and service
queries. Recreating only clock-time slots in a screen would regress the recent 24-hour
and overnight schedule work: a 00:00 slot belongs to its actual next-day `booked_date`,
and querying one date under-counts capacity.

**Fix approach:** Copy and adapt only the mobile-needed interfaces and pure business
rules from the vendor implementation; never import between repositories. Read active
offerings, schedules, document/photo attachments and aggregate booking occupancy through
the vendor-admin's normal RLS session. Query occupancy for the selected date **and the
following date**, select no profile/customer fields, page it defensively, and treat a
partial/error result as unavailable rather than free. The exact slot-date, occurrence,
span and eligibility test fixtures port with it.

Date-granular offerings remain excluded as the existing kiosk rule requires a time slot.
The offering grid shows a customer only what is eligible; the launcher tells staff why
anything is excluded. Post-midnight slots show their own day and remain in real-time
order. No booking price, end time or fulfilment pattern is derived in mobile code.

**Component separation:** pure rules live in `lib/` for Node tests; only services import
Supabase; kiosk hooks consume services; render components receive data and callbacks.

**Verification:** Node truth-table tests for eligibility, agreement steps, overnight slot
date/order and capacity spans; a live overnight schedule confirms that a 00:00 slot is
created under the following calendar day.

### I3 — Build the customer flow without retaining customer PII  ⬜ TODO
**Files:** new `src/components/kiosk/KioskBooking/*`,
new `src/components/kiosk/KioskOfferingGrid/*`,
new `src/components/kiosk/KioskSlotPicker/*`,
new `src/components/kiosk/KioskCustomerForm/*`,
new `src/components/kiosk/KioskPaymentResult/*`

The device is handed to a customer. Names, emails, phone numbers, agreements and any
signature must remain in component state only, never in AsyncStorage, TanStack query
persistence, logs, route parameters or error messages. A booking is created only after
the customer presses Pay, so an abandoned offering/customer form cannot occupy capacity.

**Fix approach:** Use a short, progress-labelled flow: offering → date/time/quantity →
customer details → required documents → payment → neutral confirmation. Every network
state has loading, unavailable, empty and recoverable-error rendering. Tapping an active
document obtains a short-lived signed URL from the RLS-bound service and opens it only for
review; the Continue action is disabled until all required document checkboxes are checked.
The server remains the authority for the actual document set and acceptance snapshot.

The payment action posts the minimal selected data to B1's booking endpoint, then B2's
payment endpoint. A failed payment-session start states that the booking exists but is
unpaid; it does not attempt a client-side rollback. The idle timer resets this entire
component subtree after 90 seconds of inactivity, access loss, or exit. Ordinary background
abandonment clears customer data; intentional document/payment handoffs follow the lifecycle
exception in the parity rules above, so opening a browser does not destroy checkout.

> **Web parity update (2026-09-12) — read before building this item.** The web kiosk now
> has concrete rules for the two things above
> (`.plans/2026-09-12-vendor-bookings-details-search-and-kiosk-guide.md` K1/K2, verified by
> the user on tablets, local and staging). Match them, or record a decision to differ:
> - **Uploaded documents are openable; written ones stay inline.** Web signs every uploaded
>   document when the agreements step mounts, re-signs every 240s, and keeps the last good
>   link on a failed refresh; the error state is "please ask a staff member" + Try again.
>   (Web's reason for pre-signing — Safari blocking `window.open` after an await — does not
>   apply to `Linking`/`expo-web-browser`, but the refresh and error rules do.)
> - **Ticking "I have read and agree" is NOT gated on opening a document** (plan D10); the
>   Continue gate stays "every document ticked", as written above.
> - **The idle reset pauses while the customer is away, with a 10-minute cap:** on return
>   after more than 10 minutes the kiosk starts over at once, so a walk-away's details never
>   wait on screen (`vendor/lib/kioskIdle.ts`, unit-tested). The "lifecycle exception" above
>   needs the same cap, not an unbounded pause; the payment confirmation's suspension still
>   wins.
> - The vendor now sees acknowledgements and the signature in the web booking details modal.
>   Mobile has no equivalent (launch follow-ups F8).
> - **Free (₱0) offerings skip payment** (hardening H1, 2026-09-12). The web kiosk booking route
>   now returns `free: true` for a booking it created settled; the client goes straight to the
>   receipt ("Confirm booking", receipt "Free") and must never call `create-session` for it. The
>   mobile flow calls the same route, so branch on that flag — never on the client's own total.
> - **Offering grid grouped by availability, and started times hidden** (hardening H8/H9,
>   2026-09-12). Web groups offerings into Available today / Later this week / Not available this
>   week from `vendor/lib/kioskAvailability.ts` (port it with its tests, as the other kiosk helpers
>   were), moves the day chips to the time step, and never lists a slot whose Manila start has
>   passed. The route now refuses a started time with 409 — handle that response.

**Component separation:** each stateful flow surface has `Component.tsx`,
`useComponent.ts`, and `Component.styles.ts`; the checkout orchestration lives in one
`useKioskCheckout` hook and calls only `kiosk.service.ts`.

**Verification:** Android device tests cover each loading/empty/error/populated state,
the idle and background reset, required-document gating, payment setup failure, return
from checkout, screen-reader labels and 44pt touch targets. Inspect persisted storage to
confirm no customer PII is present.

### I4 — Implement kiosk close-out without a public booking roster  ⬜ TODO
**Files:** new `src/components/kiosk/KioskCloseOut/*`,
new calls in `src/services/kiosk.service.ts`,
`vendor/app/api/kiosk/close-out/{route,confirm/route}.ts` (B1 guard call only)

Kiosk close-out is necessary for both session and custody bookings, but browsing a
vendor's open bookings on a customer-facing device would expose other customers' data.

**Fix approach:** Reuse the server's identifier-first contract. The customer enters a
minimum-length phone number, email, or booking reference; mobile renders only the
minimal matching records returned by the server. The confirm request sends only
`bookingId`; the server derives `in_progress → returned` or `fulfilled → completed`.
The component clears the identifier and results after confirmation, idle reset, loss of
access and error dismissal.

**Verification:** live API tests prove no identifier/short identifier returns a roster;
other-vendor bearer receives 403; forged target status is impossible; Android visual and
TalkBack passes show only the customer's matching result.

### I5 — Support signature-required documents before making them sellable  ⬜ TODO
**Files:** `src/components/kiosk/KioskBooking/*`, package manifest only if a reviewed
native signature dependency is approved, `vendor/app/api/kiosk/booking/route.ts:133-210`

The existing server expects a PNG signature and writes it server-side before the
append-only acknowledgement insert. The mobile app has no tested way to capture and
encode a PNG signature yet. Pretending these offerings are supported would produce a
server rejection at payment time.

**Fix approach:** Add a dedicated native signature capture surface that can clear/redraw,
exposes an accessibility alternative, produces a bounded PNG payload, and sends it only
in the booking request. Do not alter the server's append-only acknowledgement order or
upload signature bytes directly from mobile. Any library addition is an explicit
dependency approval gate after its Expo SDK 57 compatibility and permissions are reviewed.

**Verification:** test offerings with no documents, agreement-only documents, one and
multiple signed documents. A real device produces a PNG, the server stores distinct
acknowledgement rows sharing its path where required, and blank signatures are rejected.

### I6 — Recover an accurate receipt and reuse customer email delivery  ⬜ TODO (2026-09-10)
**Files:** `vendor/services/kiosk.service.ts:206` and
`vendor/components/kiosk/KioskBooking/useKioskReceipt.ts:26` (references only);
`ezzy-vendor-mobile/src/services/kioskPayment.service.ts:23` (extend), new
`src/components/kiosk/KioskPaymentResult/{KioskPaymentResult.tsx,useKioskPaymentResult.ts,KioskPaymentResult.styles.ts}`.
**Fix:** fetch a minimal receipt by booking id AND pinned vendor AND kiosk origin under
RLS. Read actual price, service and booking span; distinguish pending/paid/read failure.
Never default unavailable financial fields to zero. Clear receipt and consumed callback
state on Done/idle so the next customer cannot replay it. The existing booker webhook
creates the customer notification and email; mobile must not send a duplicate email.
**Separation:** hook owns read/poll/reset state; TSX renders; themed styles are co-located.
**Verification:** delayed webhook, failed receipt read, exact amount, duplicate callback,
next-customer reset, and one customer email with reference/service/date/amount.
**Coupling:** consumes the completed `.plans/2026-09-08-email-branding-and-kiosk-confirmation.md`
B3–B7 implementation; no change to that completed work is currently proposed.

### I7 — Existing booking history must represent overnight kiosk bookings  ⬜ TODO (2026-09-10)
**Files:** `ezzy-vendor-mobile/src/lib/format.ts:167`, `:183`, `src/lib/types.ts:53`,
`src/components/bookings/BookingDetail/BookingDetail.tsx:39`.
**Gap:** timed spans ignore `endDate`; day count treats any `endDate` as a date-based
booking. An overnight hourly booking can consequently look like a multi-day booking.
**Fix:** distinguish timed records by `startTime`, display the next-day boundary in
timed spans, retain inclusive day counts only for date-based records, correct the type
comment and affected callers. Preserve exact-midnight `24:00` semantics.
**Verification:** same-day, midnight, overnight timed and true multi-day fixtures; inspect
list/detail alongside the kiosk receipt. Rendering changes keep existing hook/style split.

### I8 — Complete parity and release verification  ⬜ TODO (2026-09-10)
**Files:** `ezzy-vendor-mobile/src/app/_layout.tsx:48`, `src/lib/queryClient.ts:15`,
`src/lib/notifications.ts:40`, `app.json:12`; component paths in I1–I6.
**Fix:** run the stage table's acceptance cases on Android and iOS, both themes and large
text, with keyboard and screen reader. Confirm main-menu target size and no staff content
through back/deep links/push/cold start. Preserve current portrait/iPhone support scope;
enabling native iPad distribution is separate from responsive Android-tablet checks.
**Verification:** app-local lint/type checks/tests/exports plus screenshots and live
customer flows. Record platform/environment evidence separately. Do not declare the whole
feature complete while only API helpers have passed tests.

## DECISIONS

<!-- No execution may begin while an OPEN decision remains. -->

- **D6 — Mobile checkout return** ⬜ TODO, **OPEN (2026-09-10):** recommend the fixed
  HTTPS bridge described in B2, preserving default web returns and using a mobile-only
  destination selector. This needs a specifically scoped vendor change and deployment
  under the current mobile AGENTS boundary. Alternative: retain current unmodified web
  checkout URLs and explicitly close the browser/return to mobile to check payment. The
  existing mobile helpers support that alternative, but it cannot automatically return
  to the native receipt and may show a web staff sign-in gate. User chooses after review.
- **D7 — Main menu** ✅ DONE (2026-09-10): user explicitly requires Kiosk Mode in the
  main menu; use the existing bottom navigation to launch a separate protected flow.
  Recorded in this plan and checked against the current four-tab layout; UI not yet built.

- **D1 — Native customer flow** → **Native kiosk route outside tabs** (resolved
  2026-09-03 from the requested mobile implementation). The web kiosk remains its own
  product surface; opening it in a browser would discard the existing mobile session,
  lifecycle and device ergonomics.
- **D2 — Privileged API contract** → **Bearer-token extension in `vendor`, shipped with
  mobile** (resolved 2026-09-03). User approved the narrow B1 change. It preserves the
  tested server routes and keeps both service-role and PayMongo secrets out of the mobile
  binary; new Supabase Edge Functions were rejected because they would duplicate
  privileged business logic and need a separate security and deployment plan.
- **D3 — Signature-required offerings in the first release** → **Native PNG signature
  capture before kiosk release** (resolved 2026-09-03). The user selected the complete
  flow rather than filtering these offerings out. I5 remains a dependency approval gate:
  no native package is installed until its Expo SDK 57 compatibility, permissions and
  implementation approach have been presented and approved.
- **D4 — Payment settlement owner** → **Existing booker webhook only** (resolved
  2026-09-03). The user will configure it when they have PayMongo dashboard access. No
  mobile or vendor webhook will be added.
- **D5 — Payment confirmation semantics** → **Webhook-backed only** (resolved
  2026-09-03). A PayMongo return is a navigation result, not financial confirmation.

## Deferred / Follow-up

- **I9 — Broad lint tooling scope — ⏸ PARKED (2026-09-10):** Direct `eslint .`
  flags pre-existing `__dirname` usage in `scripts/generate-brand-assets.js` and an unused
  disable in generated `.expo/types/router.d.ts`. The supported `npm run lint` passes.
  This is unrelated tooling scope, not a kiosk runtime defect; defer to tooling maintenance.

- **OS kiosk lockdown:** app copy points vendors to Android screen pinning / iOS Guided
  Access; enterprise lock task or MDM work is a separate device-management project.
- **PayMongo v2:** evaluate only in a payment-contract plan spanning both existing web
  checkout creators. It is not required to safely use the proven v1 flow today.
- **Webhook end-to-end check:** B3 now tracks mobile verification against the existing
  staging setup; its former account-access blocker was superseded by the September 8 work.

## Execution Order

Use stages **1–8 in the Current Assessment table** as the canonical order. D2 and D3
are already resolved; D6 and approval of this revised scope precede implementation.
Stage 1 live verification and probe cleanup are complete; local read-model work and native fixtures
do not require a new webhook and can be prepared independently after plan approval.
Keep customer launch unavailable in release builds until stages 2–7 form a complete flow.
Signature capture is mandatory under D3-B. Stage 8 records live payment and platform
evidence; it is not implicitly complete when unit tests pass. Web release need not wait
for mobile. Any B2 vendor bridge is an additive, separately reviewed change with default
web behaviour regression-tested before deployment; no schema change is proposed.

## Verification Matrix

| Area | Machine verification | Live / device verification |
|---|---|---|
| B1 API auth | unit tests, lint, TypeScript | bearer/cookie success; 401/403 boundaries |
| B2 payment return | TypeScript, fixed-target route test | Android and iOS hosted-checkout success/cancel callbacks |
| I1 kiosk lifecycle | TypeScript, storage tests | relaunch, Back, session loss, password exit, light/dark, large text |
| I2 schedules | pure Node tests | overnight and 24-hour slot booking/capacity scenario |
| I3/I4 PII + close-out | persistence/contract tests | no PII survives reset; TalkBack; no roster; real close-out |
| B3 payment settlement | none sufficient | PayMongo sandbox event updates `is_paid` once and creates one ledger row |

## Risks and Assumptions

- `EXPO_PUBLIC_VENDOR_PORTAL_URL` resolves to the deployed HTTPS vendor application in
  each build profile. Kiosk start is disabled, rather than falling back to localhost,
  when it does not.
- PayMongo must follow a redirect chain from a complete HTTPS URL to the registered app
  scheme. This is verified in the B2 sandbox test before release; a failure changes the
  bridge approach, not payment truth semantics.
- Android emulator checks are useful for layout and kiosk lifecycle, but PayMongo and
  eventual push/payment-return validation also require real Android and iOS devices.
- Any new native signature package is an explicit dependency approval gate and requires
  Expo SDK 57 compatibility, `expo-doctor`, platform build checks and permission review.
