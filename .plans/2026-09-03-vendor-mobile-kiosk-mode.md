# Vendor Mobile Kiosk Mode

**Date:** 2026-09-03  
**App / scope:** `ezzy-vendor-mobile`, with a narrow authenticated API-contract change in `vendor`  
**Status:** IN PROGRESS — B1 implementation is machine-verified; authenticated live-route
probes remain before it can close.

> Give a vendor-owned Android or iOS device a customer-facing, full-screen kiosk flow
> that creates kiosk-origin bookings and starts a PayMongo Checkout Session without
> exposing staff UI, service-role credentials, or customer data.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.  
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local.

---

## Scope

**In scope**

- A native, kiosk-only route outside the mobile tab navigator, launched by a vendor
  from Settings and protected by a staff-password exit confirmation.
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

### B1 — Preserve the privileged server boundary for mobile callers  🔄 IN PROGRESS (2026-09-03)
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
deployed cookie and bearer probes.

### B2 — Use a fixed payment return bridge, never an arbitrary redirect  ⬜ TODO
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

### B3 — Do not claim payment is complete before the shared webhook is live  ⏸ PARKED
**Files:** `booker/app/api/payment/webhook/route.ts` (existing owner),
`vendor/app/api/kiosk/payment/create-session/route.ts:17-22`, mobile payment-result UI

PayMongo's redirect only reports browser navigation. The shared webhook, keyed by
`metadata.booking_id`, is the sole authority that changes `bookings.is_paid`; a second
vendor/mobile webhook would race it and is explicitly rejected by the established kiosk
design.

**Unblock condition:** User creates/configures the PayMongo webhook pointing to the
existing deployed booker webhook endpoint and sets its webhook secret in that endpoint's
environment. Then run an end-to-end sandbox payment and verify exactly one paid
transition, ledger row, and vendor notification. No PayMongo secret belongs in mobile or
in `vendor` as a webhook secret.

## IMPORTANT

### I1 — Establish a native kiosk mode with a real lifecycle boundary  ⬜ TODO
**Files:** `ezzy-vendor-mobile/src/app/_layout.tsx:48-94`,
`src/app/index.tsx:11-35`, new `src/app/kiosk.tsx`,
new `src/lib/kioskMode.ts`, new `src/components/kiosk/KioskShell/*`,
`src/components/settings/SettingsList/{SettingsList,useSettingsList}.tsx`

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

Settings gains an Operations row that opens a launch confirmation: vendor identity,
eligible-offering count, no-lockdown warning, and a single Start kiosk command. Exiting
requires the current staff password to be re-authenticated, clears the mode flag and all
customer state, and returns to the normal dashboard. Android back is intercepted while
in the customer flow but is not represented as device lockdown.

**Component separation:** `KioskShell.tsx` only renders gate/view states;
`useKioskShell.ts` owns mode persistence, AppState/auth checks, idle reset and exit;
`KioskShell.styles.ts` owns static themed styles. The launcher dialog follows the same
three-file convention. Route files remain composition only.

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
review; an agreement checkbox cannot be enabled until all required documents are accepted.
The server remains the authority for the actual document set and acceptance snapshot.

The payment action posts the minimal selected data to B1's booking endpoint, then B2's
payment endpoint. A failed payment-session start states that the booking exists but is
unpaid; it does not attempt a client-side rollback. The idle timer resets this entire
component subtree after 90 seconds of inactivity or immediately on app background,
access loss, or exit.

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

**Verification:** test the no-signature eligibility boundary; after implementation, a
real device signs a document, server stores one PNG acknowledgement, and a missing or
empty signature remains rejected.

## DECISIONS

<!-- No execution may begin while an OPEN decision remains. -->

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

- **OS kiosk lockdown:** app copy points vendors to Android screen pinning / iOS Guided
  Access; enterprise lock task or MDM work is a separate device-management project.
- **PayMongo v2:** evaluate only in a payment-contract plan spanning both existing web
  checkout creators. It is not required to safely use the proven v1 flow today.
- **Webhook end-to-end check:** parked at B3 until the user configures PayMongo. The
  mobile feature remains usable for creating a session, but no build may claim that paid
  bookings settle until this is tested.

## Execution Order

1. **Approval gate:** resolve D2 and D3. No code or package installation before both.
2. **Coupled security batch:** B1, then B2's server return bridge. Deploy and prove bearer
   and cookie callers before creating a mobile checkout UI.
3. **Mobile foundations:** I1 and I2. The kiosk must have a separate route, a safe exit,
   and schedule-correct read models before it can show an offering.
4. **Customer experience:** I3, then I4. Customer data stays ephemeral and no public
   roster is introduced.
5. **Signature scope:** either retain I5's exclusion under D3-A or implement I5 under
   D3-B after an explicit dependency approval.
6. **Live payment verification:** B3 after the user configures the existing webhook.

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
