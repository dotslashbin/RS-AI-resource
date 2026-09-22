# Ezzy Booker Mobile — real data: sign-in, Supabase, payment

**Date:** 2026-09-22
**App / scope:** `./ezzy-booker-mobile`. Reads `booker`, `backbone` and `ezzy-vendor-mobile` as **read-only reference**. Changes wanted in `booker` or `backbone` are requested through **Dependencies (W#)** and the mobile build plan's sync notes — never made from here.
**Status:** DRAFT — decisions D1–D7 are OPEN. **No stage may execute while an OPEN decision remains.**

> **Goal:** the app that exists today on sample data runs on the real shared Supabase project: a booker signs in, sees their own bookings, searches the real catalogue, books a real slot, pays, and gets real notifications — with the same screens, and no drop in the honesty the build plan fought for.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = blocker, I# = important, D# = decision, W# = dependency on another app, S# = execution stage. Numbers are plan-local; qualify cross-plan references by app (e.g. "web I14", "booker-mobile-app G2").

**Predecessor:** `.plans/2026-09-21-booker-mobile-app.md` (M1–M9, COMPLETE for the build scope). Its §9 backend gaps (G1–G6) and §12 carried notes are the raw material for this plan; each appears below with its plan-local number.

---

## 1. Scope

**In**
- Supabase client, session storage and token refresh on React Native.
- Sign in, register, forgot/reset password, sign out, and the booker access gate.
- Every `src/services/*.ts` body swapped from `src/mocks/` to real queries, keeping today's `{ data, error }` contract so no screen changes shape.
- Real booking creation and payment.
- Real notifications, including read/archive writes.
- Error, empty and offline states that today can never fire, because the mocks never fail.

**Out**
- Push notifications, EAS builds, store submission (each is its own plan).
- Any change to `booker`, `backbone`, `vendor` or `command` — requested as W# below.
- New features or screens. This plan changes the data behind the app, not the app.
- iOS verification: App Store Expo Go can't open an SDK 57 project and there's no Apple Developer account (vendor-mobile B9).

---

## 2. What exists today (the starting point)

- **10 service files** (`src/services/`), all mock-backed, all returning `{ data, error }`: `bookings`, `offerings`, `vendors`, `schedules`, `availability`, `notifications`, `drafts`, `searchHistory`, `exports`, `mockLatency`.
- **Only services import `src/mocks/`** — a boundary the build plan enforced with a grep on every stage, precisely so this plan is a service-body swap rather than a rewrite.
- **Pure rules already ported from booker and tested** (111 tests): `slots.ts` (byte-identical to booker's), `occurrence.ts` (cross-checked against booker's over a year), `bookingProgress`, `autoConfirm`, `payments`, `paymentsFilter`, `search`, `homeRules`, `statusExplain`, `bookingTimeline`, `divisions`, `statusPalette`, `manila`. These do **not** change here.
- **No auth at all:** a mock signed-in booker (build plan D3), no session, no guards, no `@supabase/supabase-js`.
- **Reference implementations:** `booker/services/*.ts` (the queries), `booker/lib/supabase/client.ts` (web auth), `ezzy-vendor-mobile/src/lib/supabase/*` (the React Native client, keystore adapter and `AppState` refresh — the tested native reference).

---

## 3. Dependencies on other apps (W#) — none of these are mine to change

| | What mobile needs | Where it lives | Status today |
|---|---|---|---|
| **W1** | Payment route usable from mobile: accept a **Bearer token** (it reads the SSR cookie only, `booker/app/api/payment/create-session/route.ts:31-33`) and refuse to charge an already-paid booking | `booker` | Web plan **P2 PARKED**; build-plan G1 |
| **W2** | Counts-only occupancy function, so "N left" is honest (a booker can only read their own bookings) | `backbone` migration + `booker` | Web plan **I14 / S3b**, approval gate, **not started** |
| **W3** | Somewhere for uploaded documents to live (bucket + row), for requirements | `backbone` + `booker` | Nothing today (web F4); build-plan G3 |
| **W4** | A booker write path for `booking_acknowledgements` (agreements, signatures) | `booker` | Only Vendor Kiosk writes it; build-plan G6 |
| **W5** | A booker-callable account-deletion route (`scope = 'user_only'` exists; no booker route does) | `booker` | Build-plan G4. **Blocks App Store submission** |
| **W6** | Paged `getBookings` (PostgREST caps at 1000 rows) | pattern from `booker` | Web plan **I5 / S1**, not started; build-plan G5 |

**Consequence for sequencing:** W1, W2 and W6 are all inside the approved web plan (`.plans/2026-09-18-booker-home-search-redesign.md`, S0–S9, **execution not started**). Doing the web plan first means mobile ports finished, reviewed code instead of guessing at it — see D7.

---

## 4. BLOCKERS

### B1 — Supabase client, session storage, token refresh  ⬜ TODO
**Files (new):** `src/lib/supabase/client.ts`, `src/lib/supabase/secureStorageAdapter.ts`, `src/lib/constants.ts`
**Reference:** `ezzy-vendor-mobile/src/lib/supabase/client.ts:1-50` and its adapter — a working, device-tested copy.
The web client can't be reused: no `localStorage`, no URL to read a session from, and a backgrounded app must not hold a refresh timer.
**Fix approach:** copy vendor-mobile's shape: `react-native-url-polyfill/auto` imported before the client is constructed (Hermes's `URL` is incomplete and realtime-js needs it); `storage: secureStorageAdapter`; `detectSessionInUrl: false`; `flowType: "pkce"` (a public client can hold no secret — a deliberate divergence from the web apps); `startAuthAutoRefresh()` tied to `AppState`.
⚠️ **`expo-secure-store` caps iOS Keychain values at ~2 KB**; vendor-mobile's adapter chunks around it. Copy the adapter, don't re-derive it.
**Approval gate:** installs `@supabase/supabase-js`, `expo-secure-store`, `react-native-url-polyfill`.

### B2 — Configuration that fails visibly, never at module scope  ⬜ TODO
**Files (new):** `src/lib/constants.ts`, `src/components/common/ConfigErrorScreen/`
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`, plus the booker web base URL for the API routes W1/W5 call.
⚠️ **Never throw at module scope for missing config** (vendor-mobile's recorded trap): in a release build there is no red box, the process dies looking like a native crash. Export `MISSING_CONFIG` and render a screen naming the missing variable.
🔒 `SUPABASE_SERVICE_ROLE_KEY` must never reach this app under any prefix. Service-role work stays behind booker's API routes.
**Verification:** temporarily unset a variable → the config screen renders instead of a crash (needs a device/emulator).

### B3 — Auth: sign in, register, forgot/reset password, sign out  ⬜ TODO
**Files (new):** `src/app/(auth)/*`, `src/services/auth.service.ts`, `src/components/auth/*`
**Reference:** `booker/services/auth.service.ts` (the web surface: `signInWithPassword`, `/api/register`, `resetPasswordForEmail`, `updateUser`), and vendor-mobile's auth screens for the native shape.
- **Register goes through booker's `/api/register`** over HTTPS, because it creates the profile and writes `legal_acceptances` rows; it refuses to create a user without `acceptedLegal` + `legalVersion`. Mobile must show the same consent and send the same fields.
- **Reset password arrives as a deep link** (`scheme: ezzybookermobile`), handled by a dedicated screen; web's hash-token handling does not apply.
⚠️ **A guarded `<Stack>` must set `initialRouteName` from the first commit.** When a guard empties the stack, expo-router falls back to the first *declared* screen — in vendor-mobile that was `reset-password`, so every sign-in landed on a reset error (`.plans/2026-07-29-vendor-mobile-guard-fallback-route.md` §2). `unstable_settings.anchor` does not cover it. "Back to sign in" must `replace('/')`.
**Component separation:** each screen is `Name.tsx` (render) + `useName.ts` (state, submit, errors) + `Name.styles.ts` (`makeStyles(tokens)`); no static inline styles. The auth surface reuses `PrimaryButton`, `SearchField`-style inputs and the existing tokens.

### B4 — Booker access gate  ⬜ TODO
**Reference:** `booker/services/booker.service.ts:6-12` — `verifyBookerAccess` checks the profile's status, `user_portals` and `user_roles`.
A signed-in user who isn't a booker (or is suspended) must land on a plain "you don't have access" screen, not an empty app.
**Fix approach:** port the check into `services/auth.service.ts`; the root layout gates on it, as vendor-mobile gates on its vendor check.

### B5 — Service bodies: mocks → Supabase  ⬜ TODO
One file at a time, each keeping its signature and `{ data, error }` contract. `src/mocks/` is deleted only when the last one lands (I4).

| Service | Real source | Notes |
|---|---|---|
| `bookings.service` | `bookings` + joins, RLS-scoped to the booker | **Paged** (W6). `getBookings`, `getBooking`, `getBookingStatusLog` (`booking_status_log`, web I6) |
| `bookings.service` writes | insert; `acknowledge_booking()` / `raise_booking_dispute()` RPCs | ⚠️ **never send `price_paid`** — the DB derives it (`20260803000004`); sending it is the hole booker closed |
| `offerings.service` | `offerings` (active) + `offering_attachments` (photos, documents) | Photos from the public `offering-photos` bucket |
| `vendors.service` | `vendors` (active) | Tagline, hours, address, phone |
| `schedules.service` | `schedules` for the offering | Keyed on **offering id**, never code (web I9) |
| `availability.service` | occupancy function (W2) | Until W2: no counts rather than wrong ones (web D9-B) |
| `notifications.service` | `notifications` where `portal = 'booker'` | Read/archive/delete writes already match booker's service |
| `drafts.service` | device storage (D4) | Today in memory (build-plan I7) |
| `searchHistory.service` | device storage (D4) | Today in memory |
| `exports.service` | unchanged | Already real (file system + share + print) |

### B6 — Booking creation and payment  ⬜ TODO
**Reference:** `booker/services/bookings.service.ts:26-40` (insert), `booker/app/api/payment/create-session/route.ts` (PayMongo).
Insert the booking (`status: "pending"`, no `price_paid`), then start payment through booker's route — which today only authenticates a browser cookie (**W1**).
The DB's `check_booking_placement()` is the authority on whether a slot is bookable; the app's slot maths (already ported) is a preview, so **every insert must surface the trigger's rejection as a readable message**, not a silent failure.
**Decision:** D3 (how the payment page opens).

### B7 — Documents and agreements  ⏸ PARKED (unblocked by W3 + W4)
Requirement uploads (W3) and agreement acknowledgements with signatures (W4). The app collects both today, in memory, and says on screen that nothing is saved. It keeps saying that until the write paths exist.
**Also needs:** a picker package (D5).

### B8 — Account deletion  ⏸ PARKED (unblocked by W5)
`account_deletion_requests` supports `scope = 'user_only'`, but only a service-role route creates requests. **Apple 5.1.1(v) requires in-app deletion** for an app that creates accounts — so this blocks store submission, not this plan. Today's Account screen shows the action and explains it isn't available yet.

---

## 5. IMPORTANT

### I1 — Error and offline states, for the first time  ⬜ TODO
Every screen has an error state, but the mocks never fail, so none has ever rendered outside a forced test. With real data they will: no network, an expired session, a failed insert.
**Fix approach:** a shared mapper from `PostgrestError`/`AuthError` to the plain sentences the screens already show; `services/` returns `error` strings, screens keep their existing `phase === "error"` branches. Add an offline check so "no connection" doesn't read as "nothing found" (the T7 trap the build plan repeats).

### I2 — Refresh strategy with real latency  ⬜ TODO
Today Home, Bookings and Payments reload on focus (build-plan I4) and there is no cache. With real queries that is more network than it sounds — and booker web keeps a realtime channel (`booker/components/layout/AppShell/useAppShell.ts:65-90`) instead.
**Decision:** D1 (plain services + focus refresh, or TanStack Query as vendor-mobile uses) and D6 (realtime or not).

### I3 — Occupancy across midnight  ⬜ TODO
`lib/slotPicker.remaining` counts by instant (build-plan I6), which is right, but the **query** that feeds it must read **two dates**: a booking of the 00:00 slot is stored under the next day (`booker/services/schedules.service.ts` `getSlotOccupancy`). Port that with W2.

### I4 — Retire the mock layer  ⬜ TODO
Delete `src/mocks/` and `services/mockLatency.ts` when the last service is real; keep every pure-rule test. The mock-boundary grep in the build plan's verification becomes "no `src/mocks/` at all".
**Watch:** `lib/statusExplain`, `homeRules`, `paymentsFilter` and friends are pure and stay; only data goes.

### I5 — Real catalogue size  ⬜ TODO
Explore loads the catalogue once and matches in memory (build-plan T5). That holds for today's catalogue; with hundreds of offerings it needs paging or server-side search (web P6 is parked for the same reason). Measure before changing anything.

### I6 — Session edge cases  ⬜ TODO
Signed out on another device, a revoked session, a token that expires while the app is backgrounded. `startAuthAutoRefresh` covers the last; the first two must land the user on sign-in with a message, not a blank screen.

### I7 — Secrets and logging  ⬜ TODO
No service-role key; no tokens or emails in logs; `.env*` never committed (check `.gitignore` before the first `.env` exists).

---

## 6. DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains. -->

- **OPEN D1 — Data layer.** (a) Keep today's plain services + reload on focus. (b) Add TanStack Query, as vendor-mobile does, for caching, refetch-on-foreground and retry. **Recommendation: (a) to start**, because every screen already works this way and it keeps the diff to service bodies; revisit if real latency makes it feel slow.
- **OPEN D2 — Registration in the app.** (a) Full sign-up in the app, via booker's `/api/register`. (b) Sign-in only, sign-up on the website. **Recommendation: (a)**, matching web — but note it makes **W5 (account deletion) mandatory before App Store submission**; (b) delays that obligation.
- **OPEN D3 — Where PayMongo opens.** (a) `expo-web-browser` (an in-app browser tab; same session handling as the Account screen's legal links). (b) A `react-native-webview` screen (an install). **Recommendation: (a)** — no new package, and it's the pattern Apple and Google both accept for a hosted checkout.
- **OPEN D4 — Device storage for drafts and recent searches.** (a) `@react-native-async-storage/async-storage`, the version vendor-mobile already uses. (b) `expo-secure-store` (already installed for the session) — but it is for secrets, and a draft is not one. (c) Leave both in memory. **Recommendation: (a).**
- **OPEN D5 — Document uploads.** Needs `expo-image-picker` and/or `expo-document-picker`. **Recommendation: defer the choice until W3 exists** — the bucket's shape decides what to send.
- **OPEN D6 — Realtime.** (a) Subscribe like booker web, so a vendor's acceptance appears without a refresh. (b) Refresh on focus only. **Recommendation: (b) first, (a) once the rest is stable** — realtime on mobile adds reconnect handling, and focus refresh already covers the common case.
- **OPEN D7 — Order of work against the web plan.** (a) Web plan first (S0–S9), then this. (b) This plan first. (c) Alternate. **Recommendation: (a)** — W1, W2 and W6 live in the web plan, and mobile has already ported rules from booker; see §9.

---

## 7. DEFERRED / COSMETIC
- **Push notifications** — their own plan; needs FCM/APNs credentials and a `device_push_tokens` migration (vendor-mobile Ph7 is stuck on exactly that).
- **Biometric unlock** (`expo-local-authentication`) — nice, not needed.
- **Date-granular booking** — the app shows day/week/month offerings but can't book them (web D11/P5); unchanged here.
- **iOS** — unverifiable from this machine; every item ships Android-verified only.

---

## 8. Execution order

Stages run **one at a time**, each ending with a report and the plan updated.

| Stage | Contents | Depends on |
|---|---|---|
| **R0** | B2 config + the config-error screen | — |
| **R1** | B1 client, storage, refresh | R0, install approval |
| **R2** | B3 auth screens + B4 access gate | R1, D2 |
| **R3** | B5 read services: offerings, vendors, schedules, bookings (paged), notifications | R2, W6 pattern |
| **R4** | B5 write paths: acknowledge / dispute / notification read-archive | R3 |
| **R5** | B6 booking creation + payment | R4, **W1** |
| **R6** | I1 error/offline states end to end; I6 session edge cases | R3–R5 |
| **R7** | Availability with real counts (I3) | **W2** |
| **R8** | I4 retire the mock layer; docs (`README`, `AGENTS.md`, `architecture/portals.md`) | R3–R7 |
| **Parked** | B7 documents + agreements (**W3, W4**), B8 deletion (**W5**) | those W# |

**Safe to start before any decision:** nothing. R0 is safe once D2 is settled only in the sense that config is shared; in practice D1/D2 should be answered first because they shape R2 and every service body.

---

## 9. Why the web plan probably goes first (context for D7)

- **Three of the six dependencies (W1, W2, W6) are web-plan items** that have not been written yet. Building mobile against guesses would mean rewriting when they land.
- **Mobile has already paid the porting cost once.** `lib/slots.ts` is byte-identical to booker's; `occurrence.ts` is cross-checked against booker's across a year; progress steps, auto-confirm, money rules, the search matcher, action copy and the status palette were all ported and tested here first. Web's S0 ("foundations: progress steps, auto-confirm, division colours, search matcher + tests") is **largely a copy back** of work that already exists and is tested.
- **Mobile found ten things web should change** (build-plan N1–N10): the unloaded Inter font, light and dark contrast failures, the Pets colour, a false "you have not been charged" line, price-unit inconsistency, division-name search, missing Call vendor, no photos on the detail, no account deletion, and slots sorted out of order across midnight.
- **Risk if web goes second:** the two apps drift on wording and rules, and each fix gets discovered twice.
- **Risk if web goes first:** mobile sits still for a while — but it is feature-complete on sample data and can be demonstrated today.

---

## 10. Verification

**Machine-checkable, every stage:** `tsc --noEmit`; `npm test`; `npm run lint`; a grep proving no `src/mocks/` import outside `services/` (and after R8, none at all); `npx expo export --platform android` builds.

**Needs a live environment — and this is most of it:**
- A **staging** Supabase project and a real booker account (local `127.0.0.1:54321` is the device itself on a phone; see the workspace notes on WSL and staging).
- A **second booker account** to prove RLS: their bookings must be invisible, and their booking must lower "N left" (W2).
- **PayMongo test keys** for a real payment round trip.
- **A device or emulator** for: the config-error screen, deep-link password reset, session expiry, offline behaviour, and the whole booking journey.
- iOS: not verifiable here.

**Honesty rule carried from the build plan:** an error must never render as "nothing found" (T7); refunds are never worded as money returned (T9); paid totals count only paid bookings (T8).

---

## 11. Big table

**Who:** Me = Claude, You = the user. Git is always yours.

| Done | ID | What | Who | Status | Why / notes |
|:-:|---|---|---|---|---|
| [ ] | D1–D7 | Open decisions | You | ⬜ TODO | **Nothing executes until these are answered** |
| [ ] | R0 | Config + config-error screen | Me | ⬜ TODO | Never throw at module scope |
| [ ] | R1 | Supabase client, keystore storage, AppState refresh | Me | ⬜ TODO | Install gate: supabase-js, expo-secure-store, url-polyfill |
| [ ] | R2 | Auth screens, deep-link reset, access gate | Me | ⬜ TODO | `initialRouteName` trap; register via booker's route |
| [ ] | R3 | Read services on real data | Me | ⬜ TODO | Paged bookings (W6) |
| [ ] | R4 | Write paths (acknowledge, dispute, notifications) | Me | ⬜ TODO | RPCs, never direct status writes |
| [ ] | R5 | Booking + payment | Me | ⬜ TODO | Blocked on **W1** |
| [ ] | R6 | Error, offline and session states | Me | ⬜ TODO | First time these can fire |
| [ ] | R7 | Honest "N left" | Me | ⬜ TODO | Blocked on **W2** |
| [ ] | R8 | Retire mocks; docs | Me | ⬜ TODO | |
| [ ] | B7 | Uploads + agreements | Me | ⏸ PARKED | Unblocked by **W3, W4** |
| [ ] | B8 | Account deletion | Me | ⏸ PARKED | Unblocked by **W5**; blocks App Store |
| [ ] | W1–W6 | Web/backbone dependencies | You / web session | ⬜ TODO | W1, W2, W6 are web-plan items |
| [ ] | Staging | Staging project, two booker accounts, PayMongo test keys | You | ⬜ TODO | Most verification needs these |
| [ ] | Git | Commits | You | ⬜ TODO | |
