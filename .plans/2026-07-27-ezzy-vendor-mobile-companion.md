# Ezzy Vendor Mobile — companion app build-out plan

**Date:** 2026-07-27
**App / scope:** `./ezzy-vendor-mobile` (Expo SDK 57, own git repo, currently a pristine
`create-expo-app` template with zero app code). Phases 0–6 are additive to that project
only. **Ph7 (push notifications) touches `backbone`** — new table + Edge Function +
trigger — and is a cross-app approval gate.
**Status (2026-07-28):** **Ph0–Ph6 code complete; Ph7 and Ph8 in progress.** All 13
decisions resolved and the dependency list approved (2026-07-27); B2 approved and written
(2026-07-28).

**Nothing has been run on a device or emulator yet**, so no phase meets D10-A's
both-platforms bar — every ✅ below means "code complete and machine-verified"
(`tsc` · `expo lint` · `expo-doctor` 20/20), not "verified on hardware".

Open blockers: **B9** App Store Expo Go cannot open an SDK 57 project — **iOS verification
needs a paid Apple Developer account, decision required** · **B5** store *listing* assets
(icon + splash done 2026-07-30) · **B6**
privacy policy + deletion route · **B7** Play Console account type · **B8** Supabase redirect
allow-list (blocks the password-reset deep link). **B1 resolved 2026-07-28** (transactions migrations + seed Block 9 brought onto
`feature/vendor_mobile_dev`). **B2 approved and written.** Both B1 and B2 are **unapplied** —
there is no Supabase CLI or Deno here, so `supabase db reset` and the Edge Function tests
are outstanding manual steps.

> **Goal:** a *companion* app for Bookdeck Vendor — not parity. Four jobs, in priority
> order: (1) **know immediately** when something needs the vendor's attention
> (notifications), (2) **approve or reject a booking** in seconds from anywhere,
> (3) **check the money** (transactions summary + search), (4) **glance at the
> dashboard stats**. Everything else stays on the web portal. Same Supabase backbone,
> same RLS boundaries — this is a new *client*, not a new backend.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** Ph# = phase, B# = blocker, I# = important, D# = decision.
> Numbers are plan-local — qualify cross-plan references by app
> (e.g. "booker-mobile D3").

---

## 0. Architecture-doc freshness audit (requested pre-check)

Checked `architecture/*.md` against the actual code and migrations on disk, not against
each other. **Verdict: the docs are broadly current and safe to plan against, with four
concrete drifts — two of which change what this plan can assume.**

### A0-1 — `schema.md` is current for the newest work ✅ VERIFIED
`architecture/schema.md` (uncommitted working-tree edits) already documents
`platform_fee_settings` (`schema.md:456`), `booking_transactions` (`schema.md:474`), the
`divisions` table (`schema.md:228`), `vendors.division_id` (`schema.md:197`), the ERD, and
the `is_active() and has_vendor_role(...)` RLS pitfall (`schema.md:692`). `portals.md:138`
accurately describes the shipped Transactions page. Nothing this plan reads is
undocumented. **No action needed.**

### A0-2 — `backbone` working tree is missing migrations the docs describe ⚠️ AFFECTS THIS PLAN
- `schema.md:47` lists `20260724000004_divisions.sql`. **That file does not exist in
  `backbone/supabase/migrations/`** on the currently checked-out branch. It exists only on
  backbone branch `feature/division_assoc_reg` (commit `7da7bb8`); backbone's HEAD is
  `feature/vendor_transactions`.
- The three newest migrations — `20260725000001_platform_fee_settings.sql`,
  `20260725000002_booking_transactions.sql`, `20260726000001_platform_fee_settings_rls_tighten.sql`
  — are **untracked** (`??`) in backbone git, committed to no branch.
- **Consequence for this plan:** a `supabase db reset` from the current checkout produces a
  database with **no `booking_transactions` table**, so the mobile Transactions phase (Ph5)
  has nothing to read against local dev. This is a branch-integration gap, not lost work or
  a doc error — but it must be resolved before Ph5 starts. Tracked as **B1**.

### A0-3 — the vendor Dashboard is undocumented, and its stats are hard-coded ⚠️ AFFECTS THIS PLAN
`portals.md`'s vendor section (`portals.md:90–214`) documents Offerings, Schedules,
Calendar, Staff, Bookings, Transactions, Packages, Profile, Layout and PWA — but has **no
Dashboard subsection at all**, and the "What Is Live vs. Mock" table (`portals.md:168`)
never lists it. Reading the code instead of the doc:

| Stat card | `vendor/components/dashboard/DashboardPage.tsx` | Reality |
|---|---|---|
| Pending Approvals | `:20`, `:30` | ✅ real — derived from live bookings |
| Today's Schedule | `:21`, `:31` | ❌ **hard-coded to 23 April 2026** (`getSchedsForDay(23, 2026, 3, …)`), sub-label literal `"Apr 23"` |
| Completed This Month | `:22`, `:32` | ❌ counts **all** completed bookings ever; label says "This Month", sub-label says "All branches" (there are no branches) |
| Monthly Revenue | `:33` | ❌ **hard-coded string `"₱ 4,550"`** |

The user's ask is "all that shows stats that are in the main of the dashboard." Porting
these verbatim would ship three fabricated numbers into an App Store / Play Store binary
that a vendor would reasonably read as financial fact. **This is a decision, not something
to silently reinterpret — see D2.**

### A0-4 — `overview.md`'s mobile paragraph is now stale ⚠️ MINOR
`overview.md:126` says the native track is "blocked on open decisions, see
`.plans/2026-07-21-ezzy-booker-mobile-buildout.md`" and that neither app has code. Still
true today, but it points only at the booker plan. Once this plan is approved, that line
needs to name this document too. Tracked as **I8**.

### A0-5 — a gap this plan closes, not one it inherits ✅
`booker-mobile`'s plan left **D5 OPEN** ("`component-separation` skill file doesn't
exist"). It exists now — `.claude/skills/component-separation/SKILL.md`, with an explicit
React Native section mandating a co-located `ComponentName.styles.ts` and prohibiting
static inline `style={{}}`. This plan applies it directly and states satisfaction per
component (§4), so that question does not recur here.

---

## 1. Scope

**In scope (the four companion jobs):**
1. **Notifications** — in-app list backed by the existing `notifications` table + Realtime,
   arrival toast, read/archive/delete; **plus real push notifications** (Ph7), the one
   capability the web PWA fundamentally cannot have.
2. **Booking approvals** — browse existing bookings with status filters, open a booking,
   approve or reject with a reason.
3. **Transactions summary + search** — the payout/fee/collected totals and a searchable,
   filterable list. **Explicitly excluding the print/PDF surface** (per the request).
4. **Dashboard stats** — the four headline stat cards.

Plus the unavoidable substrate: authentication against existing Supabase accounts, session
persistence, the vendor access gate, multi-vendor selection, theming, navigation, and
store-readiness.

**Explicitly out of scope** (stays on the web portal, and the app should say so where a
user would look for it): offerings CRUD, schedules CRUD, staff CRUD, vendor profile
editing, the calendar, packages, KYC onboarding and resubmission, self-registration, and
the Transactions print/PDF export.

**Cross-app touch:** only Ph7 (push) touches `backbone`. Phases 0–6 touch nothing outside
`ezzy-vendor-mobile`. `vendor` (web) is **not** modified by this plan — the dashboard-stat
correction that D2 implies for the web app is flagged as a separate task (I9), not folded
in.

---

## 2. How this fits the existing architecture

Per root `AGENTS.md`'s shared-backend model: one Supabase project, no inter-app API, RLS as
the only real access boundary. The mobile app talks to Supabase directly via
`@supabase/supabase-js`, scoped by the same `vendor` portal / `vendor-admin` role checks the
web app already relies on.

**What this app needs from the backend that already exists — verified, no changes required
for Ph0–Ph6:**

| Need | Existing mechanism | Verified at |
|---|---|---|
| Sign in / reset password | Supabase Auth | `vendor/services/auth.service.ts` |
| Which vendors is this user an admin of? | `vendor_members` → `roles`/`vendors`/`statuses` | `vendor/services/vendor.service.ts:24` |
| Bookings for a vendor + booker contact | `bookings` select + `get_booker_contacts` RPC (profiles RLS blocks a direct join) | `vendor/services/bookings.service.ts:37` |
| Approve / reject | `bookings.status` update; DB trigger enforces legal transitions | `bookings.service.ts:65`, `backbone/…/20260516000004_booking_status_transition.sql` |
| Transactions | `booking_transactions` + same contacts RPC | `vendor/services/transactions.service.ts:70` |
| Notifications | `notifications` table, portal-scoped, own-rows RLS | `vendor/services/notifications.service.ts`, `20260525000002_notifications.sql:52` |
| Live updates | Realtime `postgres_changes` on `bookings` and `notifications` | `vendor/components/layout/AppShell/useAppShell.ts` |

**No service-role dependency in Ph0–Ph6.** Unlike booker-mobile — which needs booker's
`/api/register` and `/api/payment/create-session` — every companion-app operation here is
a plain RLS-scoped Supabase call. Registration and KYC (the only vendor flows that need
service-role) are out of scope, so **this app never needs to call the vendor web app's API
routes at all**, and `SUPABASE_SERVICE_ROLE_KEY` stays where it is. That is a genuinely
simpler position than the booker mobile app is in, and it should stay that way — if a
future phase needs service-role, it calls the deployed vendor app over HTTPS, never
embeds the key.

**One booking-approval subtlety the mobile client must respect (easy to get wrong):**
`validate_booking_status_transition` enforces `pending → confirmed | cancelled` and
`confirmed → completed | cancelled`. A stale mobile list (app resumed after hours in the
background) can show a `pending` badge for a booking a colleague already confirmed on the
web; tapping Approve then raises a Postgres exception, not a benign no-op. The mobile
approve/reject path must surface that as a clear "this booking was already handled" state
and refresh, not a generic red toast. Tracked as **B4**.

---

## 3. Phase roadmap

| Phase | Scope | Depends on |
|---|---|---|
| **Ph0** | ✅ **DONE 2026-07-28** — scaffolding cleared, 15 deps installed, theme tokens, Supabase RN client + chunked keystore adapter, ported types/format, query client. See the Ph0 note below | — |
| **Ph1** | ✅ **DONE 2026-07-28** (code complete; live verification pending — see the Ph1 note) — sign in, forgot/reset password deep link, session persistence, vendor access gate, multi-vendor picker, blocked states, sign out | Ph0 |
| **Ph2** | ✅ **DONE 2026-07-28** (code complete; live verification pending) — tab shell, theme override + persistence, `RefreshableList`, stale banner, Settings | Ph1 |
| **Ph3** | ✅ **DONE 2026-07-28** (code complete; B1 resolved — revenue card now has a table to read) — dashboard stats | Ph2 |
| **Ph4** | ✅ **DONE 2026-07-28** (code complete; live verification pending) — **bookings + approve/reject**, the highest-value phase | Ph2 |
| **Ph5** | ✅ **DONE 2026-07-28** (code complete; B1 resolved — runnable after a `db reset`) — transactions summary + search, no print | Ph2 |
| **Ph6** | ✅ **DONE 2026-07-28** (code complete; live verification pending) — in-app notifications, Realtime, arrival toast, unread badge | Ph2 |
| **Ph7** | 🔄 **IN PROGRESS 2026-07-28** — client + backbone code complete (**B2 approved 2026-07-28**); unapplied and untested locally, external credentials outstanding | Ph6 + approvals |
| **Ph8** | 🔄 **IN PROGRESS 2026-07-28** — config + declarations done, **B5/B6/B7 block submission**; see `ezzy-vendor-mobile/STORE-SUBMISSION.md` | All |

### Ph0 completion note — ✅ DONE 2026-07-28

**Built:** `src/theme/{tokens,useAppTheme}.ts` · `src/lib/supabase/{client,secureStorageAdapter}.ts`
· `src/lib/{constants,types,format,queryClient}.ts` · `.env.example` · placeholder
`src/app/{_layout,index}.tsx`. 17 template files moved out of `src/` (backed up to the
session scratchpad — no `trash` on this machine and the app repo has zero commits, so
deletion would have been unrecoverable).

**Config:** `ios.supportsTablet: false` (D12-A), `android.package` added (it was missing and
EAS builds need it), `name` → "Bookdeck Vendor" (provisional — B5's brand decision stands).
`expo-secure-store` registered its config plugin automatically.

**Verified:** `tsc --noEmit` clean — and the two known template type errors are gone, since
the files causing them were removed and `expo-env.d.ts` now exists · `expo lint` clean ·
`npx expo-doctor` 20/20 · all 15 approved packages present at SDK-57-compatible versions,
nothing outside the approved list.

**Not verified — deferred with reasons:**
- **S8 (targetSdkVersion 36).** Cannot be checked without `expo prebuild`, which generates a
  native `android/` directory this CNG project does not currently carry — a structural change
  beyond Ph0's scope. **Deferred to the first dev build (Ph7)**, where `android/` exists
  anyway. `expo-build-properties` is pre-approved for pinning it if the emitted value is
  below 36. Play's deadline is 31 Aug 2026, so this must not slip past Ph7.
- **Nothing was run on a device.** Ph0 produces no screens; the placeholder route renders a
  single line of text. D10-A's both-platforms bar first applies at Ph1.
- **`.env` not created.** `.env.example` documents the shape; the anon key was deliberately
  not copied out of `vendor/.env.local`. Also documents the device-networking trap —
  `localhost`/127.0.0.1 is unreachable from an emulator or phone (Android emulator needs
  `10.0.2.2`, a physical device needs the host's LAN IP).

**Incidental:** `npm run lint` self-installed `eslint@^9` + `eslint-config-expo@~57` as
devDependencies — the project's own lint script bootstrapping its tooling on first run, not
a chosen dependency, but it did change `package.json`.

**Deviation from the file plan (§4):** `lib/queryClient.ts` and
`lib/supabase/secureStorageAdapter.ts` are not in §4's tree. Both are Ph0 infrastructure the
plan describes in prose (D6-A's chunking adapter, D11's bounded cache) without naming a file.

### Ph1 completion note — ✅ DONE 2026-07-28 (code complete, not yet run on a device)

**Built:** `services/{auth,vendor}.service.ts` · `hooks/{useSession,useVendorGate}.ts` ·
`providers/SessionGateProvider.tsx` · `theme/AppThemeProvider.tsx` · components
`auth/{SignInForm,ForgotPasswordForm,ResetPasswordForm}`, `vendor/VendorPicker`,
`common/{FormField,PrimaryButton,AuthScreen,BlockedNotice,SignedInPlaceholder}` · routes
`sign-in`, `forgot-password`, `reset-password`, `select-vendor`, `blocked`, and `index` as
the guard anchor.

**Verified (machine):** `tsc --noEmit` clean · `expo lint` clean · `expo-doctor` 20/20 ·
typed-routes map regenerated (it still listed the deleted template `/explore`, which failed
the first type check — regenerating needs a real `expo start`, not a flag).

**BLOCKER for live verification — B8 (new):** `backbone/supabase/config.toml:160`
allow-lists only `localhost:3000-3002`. **The reset-password deep link cannot work until the
app's URL is added to `additional_redirect_urls`** — both the dev-build/production scheme
(`ezzyvendormobile://reset-password`) and the Expo Go form (`exp://<host>:8081/--/reset-password`).
That is a `backbone` edit, so it is a **cross-app approval gate** and was not made. Everything
else in Ph1 is testable without it.

**Not verified:** nothing has run on a device or emulator (needs `.env` — see Ph0). D10-A's
both-platforms bar therefore has **no** platforms recorded for Ph1 yet; it is code-complete,
not DONE under D10-A's own definition.

**Deliberate divergences, each for a stated reason:**
- **The web signs out a user with no vendor** (`useAppShell.ts:124`); mobile keeps the
  session and explains the state (D5-A). The service therefore does **not** pre-filter to
  active vendors — `pending_activation` / `suspended` / no-vendor have to stay
  distinguishable or the three blocked states collapse into one.
- **`reset-password` sits outside both guards.** The recovery link creates a session, so a
  `!signedIn` guard ejects the user mid-exchange and a `signedIn` guard blocks the
  expired-link error path. This is I4's "confirm the guard's scope excludes reset-password",
  now resolved in code.
- **PKCE reset**, so a reset link only works on the device that requested it — stated in the
  UI copy rather than left as a surprise.
- **Sign-in does not navigate.** The session change flips the guards; navigating from the
  form as well races with that and can strand a dead screen in history.

**Pulled forward from Ph2** (Ph1 screens cannot render without them): `AppThemeProvider`
(OS-scheme following; Ph2 still owns the manual override + persistence) and the
`Stack.Protected` guard tree. **Ph2's remaining scope is unchanged otherwise.**

**Additions not in §4's component table:** `FormField`, `PrimaryButton`, `AuthScreen`
(shared primitives the three forms need), `BlockedActions` (split out so `BlockedNotice`
stays pure display), `SignedInPlaceholder` (temporary Ph1 landing so auth is verifiable
end-to-end on a device; Ph2 replaces it with the tab group).

**Convention note:** route files under `app/` stay pure composition with no styling — a
co-located `Name.styles.ts` there would be picked up by expo-router as a route. All styling
lives in `components/`.

### Ph2 completion note — ✅ DONE 2026-07-28 (code complete, not yet run on a device)

**Built:** `app/(app)/_layout.tsx` (4 tabs: Dashboard · Bookings · Transactions · Alerts,
Settings as a header action per §5.2) · `(app)/{dashboard,bookings,transactions,notifications,settings}.tsx`
· `components/common/{ScreenShell,RefreshableList,StaleBanner}` ·
`components/layout/{TabBarBackground,SettingsAction,PhasePlaceholder}` ·
`components/settings/SettingsList` · theme preference now persisted with a
light/dark/system control. Root guard tree gained the `(app)` group; `index.tsx` redirects
`ready` → `/dashboard`. Ph1's `SignedInPlaceholder` deleted, as designed.

**Verified (machine):** `tsc --noEmit` clean · `expo lint` clean · `expo-doctor` 20/20.

**Three SDK-57 realities that contradicted the plan's assumptions:**
1. **`expo-router` no longer sits on `@react-navigation`.** SDK 56+ forbids importing
   `@react-navigation/*` in app code; `Tabs` and its options come from `expo-router` itself
   (the option *shape* is unchanged). `node_modules/@react-navigation` does not exist.
2. **Route collision.** §4's file plan puts the dashboard at `(app)/index.tsx`, but route
   groups are transparent, so that resolves to `/` — colliding with the root `index.tsx`
   anchor the guards redirect to. The dashboard is therefore **`(app)/dashboard.tsx`**.
   §4's tree is wrong on this point.
3. **`StyleSheet.absoluteFillObject` is gone from RN 0.86's types.** Written out longhand.

**Also deviating from §4:** bookings is a flat `(app)/bookings.tsx`, not `bookings/index.tsx`.
**Ph4 must convert it to a folder** when it adds `bookings/[id].tsx`.

**Limitation to accept or fix — offline detection.** The stale banner derives "we have data
and the last refetch failed" from query state rather than reading the radio. A real
connectivity source (`@react-native-community/netinfo` or `expo-network`, which would also
let `onlineManager` pause queries instead of failing them) is **not in the approved
dependency list (§6) and adding it is a fresh approval gate**. The derived version covers the
case the banner exists for; it cannot distinguish "airplane mode" from "server down", and it
will not show until a fetch has actually failed. Flag if that is not good enough.

**D13-A is wired but points at the portal root**, not a deletion route, because B6's route
does not exist. A Settings row pointing at a 404 would be worse than none at review — the
fallback stated at D13-A applies until B6 lands.

**Still no device run.** Ph1 and Ph2 are both code-complete and both remain un-DONE under
D10-A, which requires both platforms exercised. `.env` and B8 (redirect allow-list) are the
two things blocking that.

### Ph4 completion note — ✅ DONE 2026-07-28 (code complete, not yet run on a device)

**Built:** `services/bookings.service.ts` (paged) · `hooks/{useBookingsQuery,useBookingActions,useBookingsRealtime}.ts`
· `providers/SnackbarProvider.tsx` · components
`bookings/{BookingsList,BookingListItem,BookingFilterTabs,BookingDetail,ApproveRejectBar,RejectReasonSheet}`,
`common/Snackbar` · routes `(app)/bookings/{_layout,index,[id]}.tsx` (the folder conversion
Ph2 flagged). **Verified:** `tsc` clean · `expo lint` clean · `expo-doctor` 20/20 · route map
shows `/bookings` and `/bookings/[id]`.

#### ⚠️ §5.2's Undo is not implementable as written — design changed

§5.2 specifies "approve is one tap + optimistic update with a ~4s **Undo** snackbar". The
natural reading — write immediately, reverse on Undo — **cannot work**:
`validate_booking_status_transition` (`20260516000004`) permits `pending → confirmed` but
**not `confirmed → pending`**. A compensating write is rejected by the database, so the UI
would claim an undo that never happened.

**Implemented instead: deferred commit.** The approval patches the cache immediately, the
snackbar runs for 4 s, and the write is only sent when that window closes. Undo cancels the
timer and restores the cached row — no server round trip, nothing to reverse.

**The cost this introduces, and how it is handled:** an approval sitting in its undo window
is lost if the app closes. `useBookingActions.flush()` sends every pending approval when the
app leaves the foreground and on unmount. **This is the highest-risk logic in the phase and
needs deliberate live testing** — tap Approve and immediately background the app, and again
force-quit, then confirm the booking is confirmed server-side.

#### Other deliberate divergences from the web

- **Realtime invalidates, never patches.** The web patches UPDATE payloads into local state.
  Here the cache is paged *and* split across filter keys, so recomputing which pages a row
  belongs to after a status change is more error-prone than refetching — and the payload
  lacks the joined offering/schedule and the RPC-sourced contact anyway.
- **The channel is torn down on background and rebuilt on foreground** (I6). The web holds
  one socket for the tab's life; on a phone that socket is either killed by the OS or burns
  battery, and the foreground refetch has already re-synced the list.
- **Booker contacts are fetched once per vendor**, not per page. The RPC returns every
  contact for the vendor, so re-running it per page is pure waste. The bookings query waits
  for contacts so rows never flash blank names.
- **Rejection now requires a reason** (≥ 4 characters). The web permits an empty
  `rejection_reason`; the booker sees this text, and a blank one becomes a support ticket.
- **Page ordering adds `id` as a tiebreaker.** Rows sharing a `created_at` can otherwise
  swap between pages and appear twice or not at all — a bug that cannot occur in the web's
  fetch-everything approach.
- **`refunded` has empty-state copy but no filter chip.** The map is exhaustive over
  `BookingStatus`, so adding the chip later needs no second edit.

**B4 is handled end to end:** `StaleBookingError` is raised from the service when the trigger
message matches, and the UI says "This booking was already handled somewhere else" and
refetches — never "try again", which would be false.

### Ph6 completion note — ✅ DONE 2026-07-28 (code complete, not yet run on a device)

**Built:** `services/notifications.service.ts` (paged) · `hooks/{useNotificationsQuery,useNotificationsRealtime}.ts`
· components `notifications/{NotificationsList,NotificationListItem}` · Inbox/Archived
toggle, mark-all-read, per-row toggle read / archive / delete, unread tab badge.
**Verified:** `tsc` clean · `expo lint` clean · `expo-doctor` 20/20.

**Placement bug caught and fixed during the phase:** the Realtime subscription was initially
inside the notifications screen's hook. Tab screens only mount on first visit, so the arrival
toast and the unread badge would not have worked until the vendor had opened the Alerts tab
once — backwards for the feature this app exists to deliver. It now lives in
`(app)/_layout.tsx`, which is alive for the whole session. **Worth re-checking whenever a
screen-level hook has app-wide effects.**

**Divergences from the web service:**
- **Errors are thrown, not swallowed into `[]`.** The web returns an empty array on failure;
  mobile has a real error state and cannot tell "no notifications" from "the request failed"
  if the service hides it.
- **Mutations are optimistic with explicit rollback.** One-tap gestures on a list cannot
  wait for a round trip without feeling broken.
- **The unread badge uses a `head: true` count query**, not a fetch-and-count.
- The **client-side `portal` check is preserved** — `postgres_changes` takes a single filter
  condition, so `user_id` is filtered server-side and `portal` in the callback. Dropping it
  would leak booker-portal notifications into the vendor app.

### Ph7 progress note — 🔄 IN PROGRESS 2026-07-28 (client done; backbone half **not started**)

**Deliberately stopped at the approval gate.** §10 says the migration is not written until
approved, and B2 is still open, so **no migration, no Edge Function, no `seed.sql` change
was written.** Everything on the device side is finished and verified; enabling push is a
migration away, not a rewrite.

**Built (client only):** `services/push.service.ts` · `lib/notifications.ts` ·
`hooks/usePushRegistration.ts` · `providers/PushProvider.tsx` ·
`notifications/PushPermissionCard` · Settings row · `expo-notifications` installed (approved
in §6) and its config plugin added to `app.json` with the `bookings` default channel.
**Verified:** `tsc` clean · `expo lint` clean · `expo-doctor` 20/20.

**Two SDK-57 facts checked against the docs rather than recalled:**
1. **`shouldShowAlert` is deprecated** — the handler now returns the explicit
   `shouldShowBanner` / `shouldShowList` pair. Older examples set the dead field and silently
   show nothing.
2. **`getExpoPushTokenAsync` needs `projectId` passed explicitly**; the implicit lookup is
   unreliable outside a plain dev client. It is read from `app.json`'s `extra.eas.projectId`.

**Behaviour decisions worth knowing:**
- **Permission is requested in context, never on launch.** The prompt lives on the Alerts
  screen and in Settings. A cold first-launch prompt is the fastest path to a permanent
  "Don't allow", which iOS will not let the app re-ask.
- **`unavailable` is a distinct state from `denied`.** When the device is permitted but the
  token write fails — exactly what B2 causes today — the card says the server is not ready
  yet, rather than implying the vendor refused.
- **Sign-out deletes the token before ending the session**, so alerts stop reaching a phone
  nobody is signed in on. A failure there is swallowed: it must never trap a user in a
  signed-in state.
- **Foreground banners are shown.** The usual default suppresses them, but the entire point
  of this app is that a booking needing approval reaches the vendor immediately.
- **Taps route to the booking** via `routeForPayload`, handling both a warm app and a cold
  start (`getLastNotificationResponseAsync`).

#### B2 — ✅ APPROVED 2026-07-28, backbone half written

Approved with the recommended options on all five questions. Written:

- **`backbone/supabase/migrations/20260728000001_device_push_tokens.sql`** — the
  `device_push_tokens` table (shared across portals, `portal` FK to `portals.name`, `token`
  UNIQUE), own-rows-only RLS in all four directions, **explicit table-level GRANTs in the
  same migration** (the `kyc_document_types` gap that needed a follow-up a month later),
  `notification_push_settings` mirroring `notification_email_settings` as Command's
  per-portal kill switch, and the `notifications_dispatch_push` trigger.
- **`backbone/supabase/functions/send-push-notification/`** — entry point, pure handler
  behind interfaces, Supabase/Expo implementations, and `handler.test.ts` with fakes. Same
  layered shape as `send-notification-email`.
- **`seed.sql`** — comments only. `disable trigger user` already disables *all* user
  triggers on `notifications`, so the new dispatcher was covered automatically; the comments
  named only email and now name both.

**Decisions recorded:** shared table (not vendor-only) · per-portal kill switch, with a
missing row treated as **disabled** so an unconfigured portal never starts pushing ·
email + push both fire, redundancy accepted (suppression logic fails toward silence) ·
push-specific Vault secret so either channel rotates alone · landed on
`feature/vendor_mobile_dev`, the branch the local DB is built from — deliberately not
repeating B1's mistake.

**⚠️ Written but NOT verified.** Neither the Supabase CLI nor Deno is installed in this
environment, so **the migration has not been applied and `handler.test.ts` has not been
run.** Both need doing before this is trusted.

**Still required for Ph7 to be DONE — none of it is code in this repo:** apply the
migration, run the handler tests, deploy the Edge Function with `verify_jwt=false`, set the
`notification_push_secret` Vault entry and the function's `NOTIFICATION_PUSH_SECRET`, FCM v1
and APNs credentials, a dev build, and testing on **physical** devices on both platforms
(simulators cannot receive push).

### Ph8 progress note — 🔄 IN PROGRESS 2026-07-28

**Deliverable:** `ezzy-vendor-mobile/STORE-SUBMISSION.md` — the answers to transcribe into
App Store Connect and Play Console: data-safety table, nutrition labels, permission
justifications, review-notes draft, demo-account requirements, and the blockers. §12 keeps
the reasoning; that file keeps the answers.

**Config landed:** `ios.privacyManifests` (S6 — UserDefaults CA92.1, file timestamp C617.1)
· `android.blockedPermissions` for the two unused storage permissions · `eas.json` extended
with APK dev/preview, app-bundle production, Play `internal` track.

**S8 RESOLVED — no `expo-build-properties` needed.** SDK 57 already emits
`targetSdkVersion 36` (`expo-modules-core/android/ExpoModulesCorePlugin.gradle:69`,
`safeExtGet("targetSdkVersion", 36)`), which satisfies Play's 31 Aug 2026 requirement. The
package stays uninstalled; §6's conditional entry is closed unverified→verified.

**S7 — the check found real problems.** A real `expo prebuild --platform android` was run
and the manifest inspected, then `android/` was removed to restore the managed workflow
(`package.json`'s `android`/`ios` scripts, which prebuild rewrote to `expo run:*`, were
reverted).
- **`READ_EXTERNAL_STORAGE` + `WRITE_EXTERNAL_STORAGE`** arrive from `expo-file-system`, a
  transitive dependency of `expo` core. This app never touches user files, and declaring
  unused permissions is both an S7 violation and a data-safety question. **Blocked in
  `app.json`.**
- **`SYSTEM_ALERT_WINDOW`** comes from React Native's **debug** manifest only — it does not
  ship in a release build. Verified, not assumed.
- **Caveat that limits this whole check:** `expo prebuild` emits the *app-level* manifest,
  not the merged one. `POST_NOTIFICATIONS` and `RECEIVE_BOOT_COMPLETED` live in
  `expo-notifications`' library manifest and merge during Gradle. **The merged manifest from
  a release build still needs checking** — that is the artefact review actually sees.

**Not done, and not doable here:** B5 (brand assets — needs a brand decision, no logo
invented), B6 (privacy policy + deletion route — absent from the whole product, work in
another app), B7 (Play Console account type — determines whether the 12-tester/14-day gate
applies), the demo account (needs a production Supabase account seeded with pending
bookings and protected from `db reset`), and every EAS credential.

### Ph3 + Ph5 completion note — ✅ DONE 2026-07-28 (code complete; **B1 blocks both at runtime**)

**B1 re-checked, still open, and the branch has moved.** backbone is now on
`feature/vendor_mobile_dev`, and `booking_transactions` is on **none** of its migrations —
`20260725000001_platform_fee_settings.sql`, `20260725000002_booking_transactions.sql` and
`20260726000001_platform_fee_settings_rls_tighten.sql` exist only on
`feature/vendor_transactions`. Both phases were therefore built against the schema read from
that branch (`git show`) plus `schema.md`, and **neither can be exercised until those
migrations are on the branch the local database is built from.** Resolving that is a
`backbone` change and a cross-app approval gate.

**Ph3 built:** `services/dashboard.service.ts` · `hooks` via
`components/dashboard/DashboardView/useDashboardView.ts` · `dashboard/{StatCard,DashboardView}`
— four real stats (D2-A), pull-to-refresh, pending-approvals preview deep-linking into Ph4.
**Ph5 built:** `services/transactions.service.ts` · `hooks/useTransactionsQuery.ts` ·
`transactions/{TransactionsView,TransactionListItem,TransactionSummaryCards}` ·
`common/SearchField`. **Verified:** `tsc` clean · `expo lint` clean · `expo-doctor` 20/20.

**Revenue degrades instead of lying.** `getMonthlyRevenue` catches the error a missing
`booking_transactions` produces and returns `available: false`; the card then renders "—"
with "Payment ledger unavailable". The other three stats still work. **This is what makes
the dashboard usable while B1 is open** — a confident `₱ 0` would be worse than a dash.

**Ph3 divergences from the web dashboard:**
- **"Today's Schedule" became "Today's Bookings."** The web counts *schedules* for a
  hard-coded date; schedules are out of scope for this app (§1), so the card counts bookings
  whose `booked_date` is today in Manila, excluding cancelled. **The label was changed to
  match what is counted** rather than keeping the web's label over different data.
- All four dates resolve through `phToday()` / `phCurrentMonthRange()`. On mobile the device
  timezone is wherever the vendor is standing, so a bare `new Date()` would put a vendor
  abroad in the wrong month.

**Ph5 — how D9 was actually implemented**, since "capped window" left room for a weak build:
- The **date window is server-side** (`created_at` bounds) with presets This month / 3 months
  / 12 months. **There is deliberately no "all time"** — an unbounded window is the thing D9
  exists to avoid.
- **Rows page at 20** for infinite scroll; **search filters loaded rows client-side**.
- **Totals do NOT come from the loaded pages.** A separate lightweight query — money columns
  and the joined status only, no offerings, no contacts — totals the whole window up to a
  2,000-row ceiling, and reports `complete: false` past it. Totalling only what had been
  scrolled would understate a vendor's money, which is the worst failure this screen has.
- **The search scope is stated on screen** when more pages exist: without it, a vendor
  searching a booker whose payment sits on an unloaded page would conclude it doesn't exist.
- `payoutExclusionReason` is ported intact — a struck-through `pending` payout means "not
  yet" and cancelled/refunded means "not ever", and without the reason they read identically.
- The **UTC boundary bug is handled in both services**: `to` is an inclusive calendar day but
  `created_at` is a timestamptz, so the upper bound is the start of the following day.
  Comparing against `to` itself silently drops every payment after midnight on the last day.

**Swipe actions** use `ReanimatedSwipeable` from gesture-handler, already in the template —
no new dependency. Swipe left archives, swipe right deletes (with an `Alert` confirmation),
and **both have non-swipe equivalents** (a 44pt archive button in the row; long-press to
delete), per §5.2 — a swipe-only action is invisible to a screen reader.
`GestureHandlerRootView` was added at the root, without which gestures silently never fire
on Android.

---

Ph3–Ph6 are independent of each other once Ph2 lands, so they can be reordered or built in
parallel. **Recommended order is Ph4 → Ph6 → Ph3 → Ph5**: the two jobs the user named most
important first, cheapest-to-verify next.

---

## 4. Architecture — file plan and component-separation compliance

Builds on the template's existing `src/` layout (`@/*` → `./src/*`). Everything under
`src/` in the template today (`explore.tsx`, `themed-text.tsx`, `hint-row.tsx`,
`animated-icon.*`, `web-badge.tsx`, `app-tabs.*`, `global.css`, `animated-icon.module.css`)
is starter scaffolding and gets deleted in Ph0, not built on — `ezzy-vendor-mobile/AGENTS.md`
says as much explicitly.

```
src/
  theme/
    tokens.ts              # ported --sp-* values, light + dark (see D1)
    useAppTheme.ts         # resolves scheme → token set; exposes { tokens, isDark, setScheme }
  lib/
    supabase/client.ts     # RN client factory — storage adapter, AppState wiring, PKCE
    constants.ts           # APP_NAME etc. from EXPO_PUBLIC_*
    types.ts               # Booking/Transaction/AppNotification/… — COPIED from vendor/lib/types.ts
    format.ts              # fmtPeso/toPhDate/fmtPhDate/fmtRelativeTime/isPayable/statusStyle — ported from vendor/lib/utils.ts
  services/                # pure async functions, no React — the Dependency-Inversion seam
    auth.service.ts
    vendor.service.ts      # getUserVendors — ported from vendor/services/vendor.service.ts:24
    bookings.service.ts
    transactions.service.ts
    notifications.service.ts
    push.service.ts        # Ph7 only
  hooks/                   # cross-screen state (queries, session, realtime)
    useSession.ts
    useVendorGate.ts
    useBookingsQuery.ts
    useTransactionsQuery.ts
    useNotificationsQuery.ts
    useBookingsRealtime.ts
    useNotificationsRealtime.ts
  components/
    <Domain>/<Name>/       # Name.tsx + useName.ts + Name.styles.ts
  app/                     # expo-router
    _layout.tsx            # QueryClientProvider + theme + Stack.Protected guards
    sign-in.tsx
    forgot-password.tsx
    reset-password.tsx     # deep-link target
    select-vendor.tsx
    blocked.tsx            # pending-KYC / suspended / no-vendor-access
    (app)/
      _layout.tsx          # Tabs
      index.tsx            # Dashboard
      bookings/index.tsx
      bookings/[id].tsx
      transactions.tsx
      notifications.tsx
      settings.tsx
```

### Component-separation, stated per component (not left implicit)

`AGENTS.md`'s plan-review step 4 requires this explicitly. **Rule applied
(`component-separation/SKILL.md`, RN variant): `Name.tsx` is a pure render layer;
`useName.ts` holds all state/effects/handlers; `Name.styles.ts` exports
`StyleSheet.create({…})`. No static inline `style={{}}` anywhere.** Because RN styles are
`StyleSheet` objects and this app is theme-aware, each `.styles.ts` exports a
`makeStyles(tokens)` factory the hook memoises — not a module-level singleton, which
would freeze one theme's colours at import time. That is the one adaptation, and it is
deliberate.

| Component | Hook owns | Styles | Notes |
|---|---|---|---|
| `SignInForm` | email/password state, submit, error mapping | `SignInForm.styles.ts` | — |
| `ForgotPasswordForm` | email, submit, sent state | ✔ | — |
| `ResetPasswordForm` | code exchange, new password, validation | ✔ | reads deep-link params |
| `VendorPicker` | selection, persist to storage | ✔ | — |
| `BlockedNotice` | none (props only) | ✔ | **pure display** — no companion hook (skill §4 exception) |
| `StatCard` | none (props only) | ✔ | **pure display** — mirrors `vendor/components/ui/StatCard` |
| `StatGrid` | none | ✔ | pure display |
| `BookingListItem` | none (row is display; actions live in the screen hook) | ✔ | pure display — deliberately *not* the web's `useBookingRow`; see below |
| `BookingFilterTabs` | none (controlled) | ✔ | pure display |
| `ApproveRejectBar` | confirm/undo timer, reason draft, submit | ✔ | the one interactive booking component |
| `RejectReasonSheet` | reason text, validation, submit | ✔ | bottom sheet |
| `TransactionListItem` | none | ✔ | pure display |
| `TransactionSummaryCards` | none | ✔ | pure display |
| `TransactionFilterSheet` | local draft of filters, apply/reset | ✔ | applies to the screen hook on confirm |
| `SearchField` | debounce | ✔ | — |
| `NotificationListItem` | none | ✔ | pure display; swipe actions handled by the list |
| `EmptyState` / `ErrorState` / `LoadingState` | none | ✔ | pure display, shared |
| `RefreshableList` | refresh state wiring | ✔ | thin wrapper over FlashList + RefreshControl |
| `SettingsList` | theme override, sign-out, vendor switch | ✔ | also hosts D13-A's "Delete account" row (opens the web route via `expo-web-browser`) and the privacy-policy link (B6) |

**One deliberate divergence from the web, called out rather than silently made:** vendor
web puts approve/reject state in a per-row hook (`useBookingRow.ts`) because the row is
where the buttons live in a dense desktop table. On mobile the approve/reject action lives
on the **booking detail screen** and in a swipe/long-press affordance on the list, so row
components stay pure display and the mutation state belongs to the screen hook. Same
convention, correct application for the platform — not a relaxation of it.

**Services are the Dependency-Inversion seam.** Screens depend on hooks; hooks depend on
service function signatures; only services import `supabase`. No screen or component
imports the Supabase client directly. This is also what makes the services unit-testable
with a mocked client (see I7) — the same argument booker-mobile's D10 made.

---

## 5. UX specification (per `ux-design/SKILL.md` + `mobile-dev/SKILL.md`)

This section exists because booker-mobile's plan review found the equivalent gap (its D6
and D9): a plan that specs data and routing in detail but leaves states, touch targets,
accessibility and theming implicit will get built implicitly. Everything below is a build
requirement, not advice.

### 5.1 Four states on every data surface (skill §4) — mandatory, per screen

| Screen | Loading | Empty | Error | Populated |
|---|---|---|---|---|
| Dashboard | Skeleton stat tiles (not a spinner over a blank page) | "No bookings yet" with a line explaining stats appear as bookings arrive | Inline retry card; keeps last-known values visibly marked stale | 4 stat cards + pending-approvals preview |
| Bookings | Skeleton rows | Per-filter copy — "No pending bookings. You're all caught up." beats a generic empty | Retry; distinguishes offline from server error | Filtered list |
| Booking detail | Skeleton detail | n/a | Retry | Detail + action bar |
| Transactions | Skeleton rows + skeleton summary | "No transactions in this range" with a reset-filters CTA | Retry | Summary cards + list |
| Notifications | Skeleton rows | "Nothing new" | Retry | List |

Three failure modes must be **visually distinguishable**, because the user's next action
differs in each: *offline* (banner, cached data shown, "last updated hh:mm"), *server/RLS
error* (retry), and *session expired* (route to sign-in). Collapsing them into one red
toast is the failure this row exists to prevent.

### 5.2 Navigation and interaction — current accepted practice, chosen deliberately

- **Protected routes via `Stack.Protected`** (expo-router v5+/SDK 53+, current recommended
  pattern) rather than manual `useEffect` redirects. Guards are declared in the route tree,
  history is cleaned up automatically when a screen becomes protected, and there is no
  redirect flicker. Three guards: `hasSession`, `hasActiveVendor`, `hasSelectedVendor`.
  ([Expo docs — Protected routes](https://docs.expo.dev/router/advanced/protected/))
- **Bottom tabs** (`Tabs` layout): Dashboard · Bookings · Transactions · Notifications.
  Mirrors vendor web's own bottom `TabBar` information architecture
  (`vendor/components/layout/TabBar`). Settings lives in the header, not a fifth tab.
- **Pull-to-refresh on every list and the dashboard**, via `RefreshControl` — the platform
  convention on both OSes, and explicitly requested. It refetches through TanStack Query so
  it shares one cache with automatic refetch-on-foreground; pull-to-refresh must show its
  spinner even when the cache is warm, or it reads as broken.
- **Refetch on app foreground** — TanStack Query's `AppState` focus manager. On mobile the
  app is backgrounded constantly; without this, a vendor opens the app to hours-old data.
  This is the single most important "modern mobile" behaviour in the plan.
- **Infinite scroll** on Bookings/Transactions/Notifications (`useInfiniteQuery` + `onEndReached`),
  not the web's numbered pagination. Numbered page controls are a desktop affordance.
- **Swipe actions** on notification rows (archive) and an **approve/reject via swipe** on
  pending booking rows, both with an equivalent tappable control — swipe is a shortcut,
  never the only path (accessibility).
- **Haptic feedback** on approve/reject confirmation (`expo-haptics`). A destructive or
  financial state change deserves tactile confirmation on mobile.
- **Approve/reject confirmation model:** approve is one tap + optimistic update with a
  ~4s **Undo** snackbar (no modal — a modal on every approval destroys the "seconds from
  anywhere" job). Reject opens a bottom sheet for the reason, because the web already
  records `rejection_reason` and a rejection without one is a support ticket later.
- **Safe areas** via `react-native-safe-area-context` on every screen — notches, Dynamic
  Island, Android gesture bars.
- **Android hardware back** must be sane at every level: back from booking detail returns
  to the list with the filter preserved; back on a root tab exits the app rather than
  bouncing between tabs.

### 5.3 Accessibility (`ux-design` §5 + `mobile-dev` "preserve accessibility labels and
dynamic text behavior") — build requirements

- **Touch targets ≥ 44×44pt.** The web's approve/reject buttons are ~24pt tall
  (`BookingRow.tsx:39-40`, `py-[5px]`, `text-[11px]`). Porting those sizes is the single
  most likely accessibility failure in this plan — mobile controls get rebuilt at mobile
  sizes, not scaled from the desktop values.
- **Type scale must respect OS font scaling.** The web design system uses fixed pixel sizes
  (`text-[11px]`, `text-[13px]`). Porting those as fixed RN values silently ignores iOS
  Dynamic Type / Android font scale. Requirement: the token set defines a type scale that
  scales with the OS setting, with `maxFontSizeMultiplier` caps only where truncation would
  break meaning — and every screen verified at the largest accessibility text size.
- **`accessibilityLabel` + `accessibilityRole` on every icon-only control** (bell, back,
  filter, swipe actions, password visibility toggle) and `accessibilityHint` on
  approve/reject.
- **Never colour alone.** Status badges carry text already (`Pending`, `Confirmed`) —
  keep that; do not reduce to coloured dots on the smaller screen.
- **Contrast ≥ 4.5:1 body / 3:1 large.** The web's `--sp-text` (`#64748b` on `#ffffff` ≈
  4.8:1 light; `#94a3b8` on near-black dark) passes on web, but RN font rendering and the
  translucent card backgrounds (`rgba(255,255,255,0.028)` dark) are not the same substrate.
  **Verify on device — token parity does not guarantee contrast parity.**

### 5.4 Theming (`ux-design` §6)
Light and dark, following the OS by default with a manual override in Settings — the web
app is `next-themes` with a toggle, so this matches. `app.json` already declares
`"userInterfaceStyle": "automatic"` ✅. Every screen is verified in both themes before its
phase is marked DONE. Effects that have no RN equivalent and must be substituted, not
skipped: `backdrop-filter: blur(16px)` on dark cards → `expo-blur`; the page/button
gradients (`--sp-page-bg`, `.btn-primary`) → `expo-linear-gradient`; `box-shadow` →
`elevation` on Android + `shadow*` on iOS, which are not interchangeable and need per-
platform values.

---

## 6. Dependencies — ✅ **APPROVED 2026-07-27**

**Approved by the user on 2026-07-27.** The list below is the approved set; the decisions
closed every conditional entry. **Anything not on this list is a fresh approval gate** —
adding a package later is not covered by this approval, per root `AGENTS.md`.

Expo-adjacent packages via `npx expo install` (resolves the SDK-57-compatible version);
plain npm packages via `npm install`. Both from inside `ezzy-vendor-mobile/`.
`npx expo-doctor` must stay green after **each** addition, not just at the end (§14).

### Required (Ph0–Ph6) — 15 packages

| Package | Install | Why |
|---|---|---|
| `@supabase/supabase-js` | npm | Same client library as the web apps |
| `react-native-url-polyfill` | expo | Hermes lacks the full `URL` that realtime-js needs — required *before* Realtime is used, not after |
| `expo-secure-store` | expo | Session persistence — **D6-A**. Wrapped in the chunking adapter for the iOS ~2 KB value cap |
| `@react-native-async-storage/async-storage` | expo | Backs the persisted read cache only — **D11**. The session never touches it |
| `@tanstack/react-query` | npm | Server-state layer: caching, refetch-on-foreground, retry/backoff, request de-dup. The web's hand-rolled `useState`+`useEffect` pattern is not appropriate on a platform that backgrounds constantly |
| `@tanstack/react-query-persist-client` | npm | Cold-open-offline cache — **D8-A / D11** |
| `@tanstack/query-async-storage-persister` | npm | The persister half of the above |
| `@shopify/flash-list` | expo | Current recommended list for RN's New Architecture (v2, auto-sizing, no `estimatedItemSize`). Bookings/transactions lists are the app's core surfaces |
| `lucide-react-native` | npm | RN port of the exact icon set the web uses — visual parity for free |
| `react-native-svg` | expo | Peer dependency of `lucide-react-native` |
| `expo-linear-gradient` | expo | `--sp-page-bg`, `.btn-primary`, `.nav-active` are all gradients |
| `expo-blur` | expo | `--sp-card-blur: blur(16px)` on dark cards, and the topbar/tabbar blur |
| `expo-haptics` | expo | Tactile confirmation on approve/reject |
| `@expo-google-fonts/inter` | npm | The web app's font is `'Inter', system-ui` (`globals.css`, `.sp-page`). Loaded via `expo-font`, already in the template |
| `expo-dev-client` | expo | Dev builds. **Required** the moment push is on the roadmap — Expo Go cannot receive Android push from SDK 53 onward |

### Ph7 only (push)

| Package | Install | Why |
|---|---|---|
| `expo-notifications` | expo | Permissions, channels, handlers, `getExpoPushTokenAsync()` |
| `expo-device` | ✅ already present | Push tokens require a physical device; `Device.isDevice` is the documented guard |
| `eas-cli` | `npx` | Builds + credentials; no local install needed |

### Conditional on a verification, not a decision — 1 package

| Package | Gate | Why |
|---|---|---|
| `expo-build-properties` | **S8** | Install **only if** the SDK-57 build does not already emit `targetSdkVersion` 36. It is the supported way to pin it before Play's 31 Aug 2026 deadline. Config-plugin only, no runtime code. Covered by this approval *if* the Ph0 check shows it is needed |

### Already in the template — no install needed
`react-native-safe-area-context` (§5.2 safe areas) · `react-native-reanimated` 4.5.0 (D3's
snackbar, swipe actions) · `react-native-gesture-handler` (swipe actions) · `expo-web-browser`
(D13-A's deletion link, the D7-A registration link) · `expo-font` · `expo-device` · `expo-linking`
· `expo-constants`.

### Deliberately **not** installed

- `nativewind` + `tailwindcss@^3` — excluded by **D1-A**.
- `sonner-native` — excluded by **D3**; the snackbar is hand-rolled on Reanimated, which the
  template already ships.
- `date-fns` / `dayjs` — `vendor/lib/utils.ts` hand-rolls its date helpers with `Intl`
  (`toPhDate`, `fmtPhDate`, `fmtRelativeTime`). Porting ~40 lines beats a dependency and
  guarantees the PH-timezone semantics don't drift between web and mobile. (Simplicity
  first.)
- `expo-local-authentication` (biometric unlock) — genuinely nice for a financial app; no
  parity requirement forces it now. Backlog, same call booker-mobile made.
- Any PDF/print library — print is explicitly out of scope.

---

## 7. BLOCKERS

> **B5, B6 and B7 are defined in §12.3** — brand assets, the missing privacy-policy /
> deletion route, and the unknown Play Console account type. They live there because they
> came out of the store-compliance review, but they block release exactly as much as B1–B4
> block development.

### B1 — `booking_transactions` is absent from the current backbone checkout ✅ RESOLVED 2026-07-28
**File:** `backbone/supabase/migrations/` (missing `20260724000004_divisions.sql`;
untracked `20260725000001`, `20260725000002`, `20260726000001`) — see A0-2.
Ph5 cannot be built or verified locally against a database that has no
`booking_transactions` table, and a fresh `db reset` today produces exactly that. Also
blocks any local sign-in test involving a vendor with a `division_id`.
**Fix approach:** commit/merge the backbone branches so `develop` (or whichever branch the
mobile work develops against) contains all four migrations, then `supabase db reset` and
confirm the tables exist. **This is a `backbone` git action, not a schema change** — no new
migration is written, nothing is edited. Owner decision on branch strategy; the plan just
requires the state.
**Blocks:** Ph5. Does not block Ph0–Ph4, Ph6.

#### ✅ Resolved 2026-07-28
Brought onto `feature/vendor_mobile_dev` (the branch the local DB is built from) from
`feature/vendor_transactions` with `git checkout <branch> -- <paths>` — file-level, no merge
commit, no history rewrite, nothing on either branch modified:
- `20260725000001_platform_fee_settings.sql`
- `20260725000002_booking_transactions.sql`
- `20260726000001_platform_fee_settings_rls_tighten.sql`
- `seed.sql` — brings **Block 9**: 3 extra booker users and ~40 paid bookings distributed
  as Citywide 32 (pagination, incl. 3 refunded + 2 cancelled), Summit 8 (single page),
  Harbor 0 (empty state). Exactly the data Ph5's pagination, payout-exclusion and empty
  states need. Rows reach `booking_transactions` only by flipping `is_paid`, so the real
  trigger computes fee and payout rather than the seed hand-writing ledger rows.

**Verified by inspection:** dependency headers satisfied on this branch
(`20260507000004_bookings`, `20260504000002_schema` both present) · both new tables carry
explicit `authenticated`/`service_role` GRANTs in their own migration · `booking_transactions`
has vendor-admin and command-admin select policies · `get_booker_contacts` RPC present
(`20260620000002`) · no `divisions` reference in any of the four files, so A0-2's separate
divisions gap does **not** block this · migration ordering is clean —
`20260728000001_device_push_tokens.sql` (Ph7) sorts after all three.

**Two things this did NOT do.** The `divisions` migration on `feature/division_assoc_reg`
is still absent (A0-2) — it was never a Ph3/Ph5 dependency, and pulling it in would have
been scope creep. And **nothing was applied**: there is no Supabase CLI in this environment,
so `supabase db reset` and a confirmation that the tables exist is still an outstanding
manual step. The two comment edits from Ph7's seed change were re-applied after the
checkout overwrote them.

### B2 — Push notifications need a device-token table + dispatch path ⬜ TODO — **approval gate**
**File:** new migration in `backbone/supabase/migrations/`, new Edge Function alongside
`backbone/supabase/functions/send-notification-email/`.
There is no device-token storage anywhere in the schema today, so `expo-notifications` has
nowhere to persist a push token and no server path to deliver to it. Full draft, blast
radius, and the reason the existing email-dispatch pattern is the right template: **§10**.
**Blocks:** Ph7 only.

### B3 — iOS cannot be built or simulated in this environment ⬜ TODO
**File:** environment, not code. The dev machine is WSL2 Linux (`Linux 6.6.87.2-microsoft-standard-WSL2`)
— there is no iOS simulator and no local Xcode. The request explicitly targets **both**
iOS and Android, and `mobile-dev/SKILL.md` requires stating which platform validations were
not performed. Without a plan for this, "done" silently means "Android only."
**Fix approach — see B9. Two corrections have been made to this item; the second reverses
the first.**

- *First correction (2026-07-28, morning):* claimed Expo Go on a physical iPhone needs no
  Mac, EAS or Apple account, so Ph1–Ph6 were verifiable on iOS for free.
- **Second correction (2026-07-28, after testing): that was wrong for this project.** It is
  true of Expo Go in general but not at SDK 57 — the App Store build is on an older SDK and
  physically cannot open this project. Proven on an iPhone 12 with an up-to-date Expo Go:
  *"Project is incompatible with this version of Expo Go."* **Full analysis: B9.**

**Net position:** iOS verification of *any* phase requires a paid Apple Developer account.
Android verifies locally via Expo Go. A local iOS *simulator* remains impossible without
macOS, permanently.
**Blocks:** the iOS half of **every** phase, plus Ph8. Does not block Android.

### B9 — App Store Expo Go cannot open an SDK 57 project on iOS ⬜ TODO — **decision needed**

**Discovered 2026-07-28 while testing.** iPhone 12, Expo Go current from the App Store:
*"Project is incompatible with this version of Expo Go."* Updating does not help — there is
nothing newer to install.

**Cause, from Expo's own changelog** ([Expo Go and the App Store, May 2026](https://expo.dev/changelog/expo-go-and-app-store-may-2026)):
App Store Expo Go was on **SDK 54**, with SDK 55 pending review and no timeline given. Expo
Go supports **only the latest SDK it shipped with**, and Apple's rules mean **only the newest
Expo Go can be installed on a physical iPhone** — older builds cannot be side-loaded the way
they can on Android. This project is **SDK 57**.

**Why Android is unaffected:** `npx expo start` installs a *version-matched* Expo Go APK
directly to the device or emulator, bypassing the Play Store entirely. That asymmetry is the
whole of what was observed.

#### Options

| | Approach | Cost | Gets us | Verdict |
|---|---|---|---|---|
| **A** | **EAS development build for iOS** — `eas build --profile development --platform ios`, installed on the iPhone | Apple Developer Program ~$99/yr. No Mac needed | iOS verification of **every** phase **and Ph7 push**, since a dev build is required for push regardless | **Recommended** |
| **B** | **`eas go`** — a personalised Expo Go published to *your* TestFlight | Same ~$99/yr Apple account | iOS verification of Ph1–Ph6 only. **Never push** — it is still Expo Go | Not recommended: same price as A, strictly less capability |
| **C** | **Downgrade the project to SDK 54** | Free | App Store Expo Go works | **Reject.** Three phases were built against SDK-57-specific behaviour — `Tabs` off `@react-navigation`, FlashList v2 auto-sizing, `Stack.Protected`, the `shouldShowBanner`/`shouldShowList` handler. Downgrading re-opens all of it to chase a tool that is explicitly "an educational tool" |
| **D** | **Defer iOS** — Android-only until the Apple account exists | Free | Nothing on iOS | Viable as a *sequence*, not an answer. Ph8 cannot ship iOS without the account anyway |

#### Recommendation — A, and treat D as the interim

**A and B cost exactly the same money.** The only difference is that A also unblocks push,
which B can never do, so paying for B means paying again later. Go straight to a dev build.

Until the Apple account exists, proceed **Android-first (D)** and record every phase's DONE
note as Android-only, per D10-A. That is honest and unblocks all present work.

#### Changes this would require — none of them are app-code changes

1. **Apple Developer Program enrolment** (~$99/yr, 24–48 h approval, needs a D-U-N-S number
   for an organisation account — allow longer if enrolling as a company rather than an
   individual). **Longest lead time here; start it before anything else.**
2. **`eas.json`** — the `development` profile already exists and already sets
   `developmentClient: true`. It needs `"ios": { "simulator": false }` so the build targets a
   device, plus `"resourceClass"` only if build minutes become an issue.
3. **`eas login` + `eas build:configure`**, then register the iPhone's UDID
   (`eas device:create`) so the ad-hoc provisioning profile includes it.
4. **`eas build --profile development --platform ios`**, install the resulting build on the
   iPhone, then `npx expo start --dev-client` instead of Expo Go.
5. **No `app.json` change is needed** — `ios.bundleIdentifier`, `supportsTablet: false` and
   the privacy manifest are already set.
6. **Ph7 follow-on, same account:** an APNs key for push credentials. Doing 1–4 also
   completes most of what Ph7's iOS half needs, which is the argument for A over B.

#### Verification once it exists
Run the D10-A pass on iOS that Android is getting now: both themes, largest Dynamic Type
size, VoiceOver over approve/reject, safe-area insets on a notched device, `expo-blur` on
dark cards, and shadows — the last is the most likely divergence, since iOS `shadow*` and
Android `elevation` are not interchangeable and were implemented per-platform.

**Blocks:** iOS verification of every phase; Ph7's iOS half; Ph8's iOS submission.
**Does not block:** any Android work, or any further development.

### B4 — Stale-status approvals raise a DB exception, not a soft failure ⬜ TODO
**File:** `backbone/…/20260516000004_booking_status_transition.sql:29-33`, consumed by
`vendor/services/bookings.service.ts:65`.
`validate_booking_status_transition` raises `Invalid booking status transition: x → y` for
any illegal move. A backgrounded mobile app resuming with a stale list is *the* normal way
to hit this — colleague confirms on web, vendor taps Approve on a phone showing yesterday's
cache. The web app's handler (`useAppShell.ts` `approveB`) rolls back optimistically and
shows "Failed to approve booking. Please try again." — advice that is wrong here, because
retrying will fail identically.
**Fix approach:** the mobile mutation distinguishes this error class and shows "This
booking was already handled" + refetches the row, rather than offering a retry. Handled in
the Ph4 mutation hook; no backend change.

---

## 8. IMPORTANT

### I1 — Session persistence + `AppState` token refresh ⬜ TODO
**File:** new `src/lib/supabase/client.ts`.
RN has no `localStorage`; the Supabase client needs an explicit storage adapter,
`detectSessionInUrl: false` (no URL bar), and — the one that fails *silently* — `AppState`
wiring so `startAutoRefresh`/`stopAutoRefresh` track foreground/background. Without it a
session can silently fail to refresh after a long background, and the user finds out as a
mysterious empty screen. `flowType: "pkce"` (not the web apps' `implicit`): the web choice
is a browser-SPA workaround, and PKCE's `code_verifier` persists fine in native storage.
**Verification:** background the app past a token-refresh interval and confirm data still
loads — not just "it worked once."

### I2 — Vendor access gate, ported not reinvented ⬜ TODO
**File:** new `src/services/vendor.service.ts`, ported from `vendor/services/vendor.service.ts:24`.
`getUserVendors()` is pure Supabase queries — it ports near-verbatim. It filters to
`roles.name === 'vendor-admin'` and reads `statuses.name`. The gate then branches exactly
as `useAppShell.ts` does: active vendors → app; zero active but ≥1 pending → blocked/KYC
screen; zero vendors at all → sign out and back to sign-in (a session cookie survives even
when the app layer blocks login — the web app hit this and the same trap exists here).
**This is a UX layer over RLS, never a replacement for it** (`conventions.md`).

### I3 — Multi-vendor selection ⬜ TODO
`MULTI_VENDOR_ENABLED` is `true` and `useAppShell.ts` supports a user who is `vendor-admin`
at several vendors, persisting the choice under `rs_selected_vendor`. Every query in this
app is `vendor_id`-scoped, so silently defaulting to the first vendor would show a
*plausible but wrong* dataset — including wrong money. The mobile app gets a
`select-vendor` route (skipped when there is exactly one) plus a switcher in Settings, and
persists the selection. Switching vendors must tear down and re-establish the Realtime
subscriptions, same as the web effect does.

### I4 — Password recovery via deep link ⬜ TODO
**Config + code.** `app.json` already declares `"scheme": "ezzyvendormobile"` ✅. Needs a
one-time Supabase dashboard change: add `ezzyvendormobile://reset-password` to
Authentication → URL Configuration → Redirect URLs (additive; does not touch the web
origins). `reset-password.tsx` reads the params, exchanges the code
(`exchangeCodeForSession` under PKCE), then calls `updateUser({ password })`.
**Platform divergence, not a single mechanism:** iOS shows a one-time "Open in…?" prompt;
on Android some mail clients (Gmail notably) are inconsistent about honouring bare custom
schemes in email bodies. Universal Links / App Links are more reliable but need hosted
`.well-known` files and per-platform setup. **Accepted for v1: custom scheme, with the
Android mail-client caveat documented and a "paste this link into your browser" fallback on
the forgot-password confirmation screen.** Revisit if it bites in testing.
**Gate scoping (booker-mobile D7's question, answered structurally here):**
`reset-password.tsx` sits *outside* the `(app)` group, so the `Stack.Protected` guards never
wrap it and the web's `recoveryMode` early-return has no mobile equivalent to port. **This
must be re-confirmed when `_layout.tsx` is actually written** — it's a property of the
route tree, and a later refactor that hoists a guard to the root would break it silently.

### I5 — Transactions search cannot be a straight port ⬜ TODO — **has a real design constraint**
**File:** `vendor/services/transactions.service.ts:70`, `vendor/components/transactions/TransactionsPage/useTransactionsPage.ts:56`.
The web app pulls up to **10,000 rows** into memory and filters client-side, because the
searchable fields (booker name/email/phone) come from the `get_booker_contacts` **RPC**, not
from a joinable column — `profiles` RLS blocks a direct join for vendor-admins. That design
is defensible on desktop; on mobile it is a memory and mobile-data problem, and it is the
reason a naive port would feel broken on a large vendor.
**Options:**
- **(a) Recommended for v1 — capped recent window.** Fetch the most recent N transactions
  (N ≈ 500, one page) plus the contacts RPC, search client-side over that, and label the
  surface honestly ("Showing your most recent 500 transactions — use date filters to
  narrow"). Date/offering filters go server-side via `.gte`/`.lte` on `created_at`, so the
  cap never hides an *explicitly requested* range. **No backend change.**
- **(b) Server-side search via a new RPC or view** joining `booking_transactions` to booker
  contacts under a `SECURITY DEFINER` boundary. Correct long-term, **but it is a schema
  change behind an approval gate** and needs its own RLS reasoning — the RPC would expose
  booker PII on a new path, so it must replicate `get_booker_contacts`'s vendor scoping
  exactly.
- Recommend **(a) now, (b) as a tracked follow-up** if vendors report the cap. Tracked as
  **D9**.
**Same-basis totals must be preserved:** `useTransactionsPage.ts:76-90` computes
Collected/Fee/Payout over `isPayable` rows only, while the row count covers everything, and
labels which is which. Refunded/cancelled rows stay listed but excluded from totals. If the
mobile version quotes a payable-only sum next to a full row count without saying so, the
card contradicts itself — port the labelling, not just the arithmetic.

### I6 — Realtime on mobile is not the web subscription, verbatim ⬜ TODO
**File:** `vendor/…/useAppShell.ts` (bookings + notifications channels).
Two RN-specific corrections to the ported logic: (1) the web keeps its socket open for the
tab's life; a mobile app must **unsubscribe on background and resubscribe on foreground**,
or it holds a dead socket and misses the reconnect. (2) The web's notification channel
filters on `user_id` and re-checks `portal === "vendor"` client-side because
`postgres_changes` supports a single filter — port that check; dropping it leaks command/booker
notifications into the vendor app. On resume, a **refetch** is required regardless: events
that occurred while backgrounded are simply not delivered, so Realtime is a freshness
optimisation, never the source of truth.

### I7 — Unit tests for the ported services ✅ DONE 2026-07-28
`mobile-dev/SKILL.md` expects relevant unit and integration tests as part of finishing.
The services are pure logic over a mockable client — cheap to test and depended on by every
screen. Minimum bar: `getUserVendors()`'s role/status branching (I2), the approve/reject
error classification (B4), the transactions totals/`isPayable` split (I5), and the PH-date
helpers (`toPhDate` around the UTC-day boundary — an off-by-one there silently misfiles
payments). Device/E2E automation stays out of scope.

#### ✅ Done 2026-07-28 — **40 tests, 40 passing**, zero new dependencies
`npm test` → `node --experimental-strip-types --test`. jest/vitest were **not** installed:
that is a §6 approval gate, and Node's built-in runner needs neither for pure logic.
`@types/node` was already present transitively via `expo`, so `"types": ["node"]` in
`tsconfig.json` was enough to make `node:test` resolve — expo's base config sets
`customConditions: ["react-native"]`, under which the node builtins are otherwise skipped.

**A refactor was required to make this testable**, and it is an improvement in its own
right: the services imported `@/lib/supabase/client`, which pulls in React Native and cannot
load under Node. The pure logic now lives in three new modules the services delegate to —
`vendorMapping.ts` (I2's role/status branching), `bookingErrors.ts` (B4's classification),
`transactionTotals.ts` (I5's payable split). Public service APIs are unchanged; the
extracted names are re-exported, so no caller moved.

Coverage against I7's stated minimum bar:
- **I2** — vendor-admin filtering, null roles/joins, malformed rows, and the assertion that
  non-active statuses are **preserved not filtered** (the D5-A divergence; if that ever
  regresses, all three blocked states collapse into one).
- **B4** — the trigger message is recognised inside wrapper text, **and a network failure is
  explicitly asserted NOT to classify as stale**. That inverse case is the one that matters:
  misclassifying it would tell a vendor a booking was handled when it wasn't.
- **I5** — refunded/cancelled/pending excluded from money while still counted in
  `totalCount`; a missing booking join defaults to payable; numeric strings coerced
  (PostgREST returns `numeric` as text, and `+` on strings would concatenate).
- **PH dates** — the UTC-day boundary in both directions, exact midnight, one second either
  side, and lexicographic sortability, which the date-range filters depend on.

**Not covered, deliberately:** anything requiring a Supabase client or a React renderer.
Hook and component tests need a RN test environment, which is a dependency gate.

### I8 — Update `architecture/overview.md:126` ⬜ TODO
Currently says the native track is blocked on booker-mobile's open decisions and has no app
code. Once this plan is approved it must name this document and describe vendor-mobile as
a *companion*-scope app, not a parity app — otherwise the next reader plans against the
wrong scope. Also add a vendor-mobile section to `portals.md` when Ph4 ships.

### I9 — Vendor web dashboard has three fabricated stats ✖ ABORTED — no longer true (2026-07-28)
Was cited as `vendor/components/dashboard/DashboardPage.tsx:21,32,33` — a path that no
longer exists; the component moved to
`vendor/components/dashboard/DashboardPage/DashboardPage.tsx`.

**Re-verified 2026-07-28 while updating `architecture/`: the defect is gone.** All four stats
are now computed from real data — `pendingCount` and `completedCount` filter the live
`bookings` array (the latter scoped to the current PH month), `todayScheds` derives from
`schedules` on the PH day, and `monthPayout` comes from `getPayoutForRange()` in
`useDashboardPage.ts`. Fixed by `.plans/2026-07-28-vendor-payout-date-range-sums.md`, not by
this plan.

D2's coupling is therefore satisfied: web and mobile compute the same four numbers on the same
PH bounds. Aborted rather than deleted so the D2 ↔ I9 coupling note below still resolves.

---

## 9. DECISIONS

<!-- plan-authoring §7 gate: CLOSED 2026-07-27. All 13 decisions resolved.
     Any decision added later must be marked "OPEN:" and re-closed before execution. -->

> **2026-07-27 — the user selected the recommended option on all of D1–D10**, and D12–D13
> on the same day (§12.4). Each bullet below records its own resolution; the rejected
> options are kept as the rationale, not deleted. Two cross-plan consequences to carry:
> **D1-A contradicts booker-mobile's D1** (NativeWind) and that plan needs revisiting;
> **D6-A diverges from booker-mobile's D3** (AsyncStorage) deliberately, because this app
> carries payout data and approval authority.
>
> **RESOLVED 2026-07-27: D11 — where the persisted read cache lives.** D6-A and D8-A
> conflicted: the session goes to encrypted storage because this is a financial surface, yet
> the persisted query cache holds the same booker PII and transaction rows. Resolution: the
> session token stays in SecureStore; the query cache persists to **AsyncStorage**, limited
> to the keys that make a cold offline open useful (dashboard stats, bookings list, first
> page of transactions), with a 24 h `maxAge` and a hard purge on sign-out and on vendor
> switch. Rationale: the token is the escalation risk — it authorises approvals — while
> cached reads sit in app-private storage the OS sandbox already protects. Routing the whole
> cache through the chunked SecureStore adapter was rejected: the iOS ~2 KB value cap turns
> a ~200 KB cache into ~100 Keychain writes per persist.
>
> **D12 and D13 are new and OPEN** — see §12.4. They came out of the store-compliance
> review, not the original draft.

- **RESOLVED 2026-07-27: D1 — Option A, `StyleSheet` + typed theme tokens.** No NativeWind.
  Both can reproduce the web look; they differ in risk and in what "parity" actually buys.
  - **Option A (recommended) — `ComponentName.styles.ts` + a typed `theme/tokens.ts`.** This
    is `ezzy-vendor-mobile/AGENTS.md`'s own stated default and `component-separation`'s RN
    variant. Zero new build tooling on an SDK released four weeks ago (SDK 57 / RN 0.86,
    2026-06-30); NativeWind's documented install still pins `tailwindcss@^3.4.17` with v5 in
    pre-release and **no published compatibility statement for RN 0.86 / Reanimated 4**.
    Crucially, the class-parity benefit is smaller than it looks: the web design system's
    signature effects — `backdrop-filter: blur(16px)`, three gradients, `box-shadow` — have
    **no NativeWind equivalent** and need `expo-blur` / `expo-linear-gradient` / per-platform
    elevation regardless. What actually delivers visual parity is the token values, and a
    typed token module delivers those with compile-time safety.
  - **Option B — NativeWind v4.** Shares literal class names with the web app; this is what
    booker-mobile's plan chose (its D1, resolved 2026-07-21, **never executed** — that app
    has no code either). Keeping both mobile apps on one approach has real value.
  - **This decision should be made for both mobile apps at once**, since neither has code
    yet. If B is chosen here, booker-mobile's D1 stands; if A, booker-mobile's D1 should be
    revisited rather than left contradicting this.

- **RESOLVED 2026-07-27: D2 — Option A, compute all four stats correctly on mobile.**
  See A0-3. Three of the four web stat cards are fabricated (a date literal of 23 Apr 2026,
  an all-time count labelled "this month", and the string `"₱ 4,550"`).
  - **Option A (strongly recommended) — compute all four correctly on mobile.** Pending
    Approvals from live bookings (already correct); Today's Schedule from the *device's*
    current PH date; Completed This Month filtered to the current month; Monthly Revenue
    summed from `booking_transactions` for the current month (the table exists precisely
    for this — `schema.md:474`). Mobile then leads and the web app is corrected separately
    (I9). Cost: mobile and web briefly show different numbers for the same vendor, which
    must be expected and explained, not treated as a mobile bug.
  - **Option B — mirror the web exactly.** Consistent across clients, but ships three
    knowingly false figures — one of them a peso amount — into a store-distributed binary.
    Not recommended.
  - **Option C — ship only the stats that are real** (Pending Approvals + Today's Schedule
    computed correctly), and omit revenue/completed until the web is fixed. Honest, smaller,
    but ignores half the explicit request.

- **RESOLVED 2026-07-27: D3 — hand-rolled Reanimated snackbar.** No `sonner-native`.
  The web uses `sonner`. `sonner-native` matches its look with one dependency of unverified
  SDK-57 standing; a ~60-line Reanimated snackbar has zero dependency risk and is the same
  component that carries the approve **Undo** action (§5.2), which is a bespoke interaction
  either way. Recommend **hand-rolled**, but it is a taste call.

- **RESOLVED 2026-07-27: D4 — Option A, push is built, sequenced last as Ph7.** §12.2
  reinforces this: push is the capability that answers Apple's Guideline 4.2, so it ships
  before submission, not after.
  Notifications were named the single most important feature, and push is the only thing a
  companion app does that the existing PWA cannot. But it is also the only phase requiring
  a **schema change**, an **Edge Function**, **FCM + APNs credentials**, an **Apple
  Developer account**, and **dev builds** (Expo Go cannot receive Android push from SDK 53
  onward).
  - **Option A (recommended) — build it, but sequenced last (Ph7).** Ph0–Ph6 ship a fully
    usable app with in-app notifications + Realtime + arrival toast while credentials and
    the migration approval are sorted. Nothing is thrown away: Ph7 adds a token table and a
    dispatcher on top.
  - **Option B — push in the first release, before the read surfaces.** Front-loads the
    highest-risk, most-external-dependency work and delays anything demonstrable.

- **RESOLVED 2026-07-27: D5 — Option A, a read-only `blocked.tsx`.** §14 now verifies this
  on a clean device with a fresh account, because that is precisely what a store reviewer does.
  The web routes them to `KycStatusPage` (resubmit flow, camera, document upload) — all
  explicitly out of scope here.
  - **Option A (recommended)** — a read-only `blocked.tsx` explaining the exact state
    ("Your vendor account is under review" / "…has been suspended" / "…has no vendor
    access") with a button opening the web portal, and a sign-out. Honest, tiny, and it
    keeps the store reviewer from hitting a dead end — reviewers *will* create a fresh
    account and land exactly here, and an app that shows a blank screen there gets rejected.
  - **Option B** — block these users at sign-in with an error and no session. Simpler, but
    tells them less and looks like a broken login.

- **RESOLVED 2026-07-27: D6 — Option A, SecureStore with a chunking adapter.** The read
  cache goes elsewhere — see D11 above.
  - **Option A (recommended for *this* app) — SecureStore with a chunking adapter.** This
    app displays payout ledgers and booker PII, and its session token authorises approving
    bookings. AsyncStorage is unencrypted plaintext on disk. SecureStore uses Keychain /
    Android Keystore; the well-known ~2 KB iOS value cap is handled by splitting the session
    across numbered keys in the adapter (~30 lines).
  - **Option B — AsyncStorage.** Supabase's own documented RN pattern, no size ceiling, no
    chunking code, and what booker-mobile's D3 already chose (resolved 2026-07-21).
  - Genuine trade-off: A is the better security posture for a financial surface; B is
    simpler and consistent with the sibling plan. My recommendation is **A here** —
    booker-mobile handles less sensitive data and can reasonably differ, as long as the
    divergence is deliberate and written down.

- **RESOLVED 2026-07-27: D7 — Option A, no sign-up on mobile.** This is what exempts the app
  from Apple's account-deletion rule (§12, S2); D13 still adds a deletion link for Play.
  Vendor registration is a **6-step KYC flow** with camera ID capture, document upload,
  draft persistence, and an atomic service-role Route Handler (`portals.md:102`).
  - **Option A (strongly recommended)** — no sign-up on mobile. The sign-in screen links to
    the web portal to register. Keeps the app free of any service-role dependency (§2) and
    off the KYC surface entirely. **Store note:** both stores accept sign-in-only apps for
    business/enterprise tools, but Apple requires a working demo account in App Store
    Connect review notes — must be prepared in Ph8.
  - **Option B** — port registration + KYC to mobile. Roughly doubles the plan; contradicts
    "companion, not parity."

- **RESOLVED 2026-07-27: D8 — Option A, persisted read cache; writes are never queued.**
  Storage location settled by D11.
  - **Option A (recommended)** — persist the TanStack Query cache (SecureStore/AsyncStorage
    persister) so a cold open offline shows the last-known bookings/transactions/stats,
    clearly marked stale with a "last updated" timestamp and an offline banner. **Writes
    are never queued offline** — approve/reject is a server-validated state transition
    (B4); queueing one would let a vendor "approve" something that then fails hours later,
    which is worse than refusing at the tap. Costs 2 packages.
  - **Option B** — no persistence; offline shows the error state. Zero extra deps, but a
    vendor on a spotty connection opens the app to nothing.

- **RESOLVED 2026-07-27: D9 — capped recent window, client-side filter, server-side date
  bounds.** Confirms **Ph5 needs no schema change.** Original wording — see I5. The capped-window
  client-side approach for v1 (no backend change), with the server-side RPC tracked as a
  follow-up. Confirming this also confirms **no schema change is needed for Ph5**.

- **RESOLVED 2026-07-27: D10 — Option A, both platforms exercised before any phase is DONE.**
  Per D12, "both platforms" now means iPhone + Android phone; no tablet verification is owed.
  - **Option A (recommended)** — both iOS and Android exercised before any phase is marked
    DONE, accepting that iOS needs EAS Build + a physical iPhone (B3) and an Apple Developer
    account. Every DONE note states which platforms were run.
  - **Option B** — Android-first: build and verify Android per phase, iOS in one pass at
    Ph8. Faster iteration, at the risk of discovering an iOS-specific layout or permission
    problem late — safe-area, blur, and notification permission behaviour are the usual
    culprits.

---

## 10. Ph7 — push notifications: exact change, blast radius, approval gate

**Nothing here is written until you approve it.** Drafted now so the gate is a decision,
not a surprise.

### The mechanism (reuses the pattern that already works)
`backbone/…/20260624000003_notification_email_dispatch.sql` established the chokepoint:
`AFTER INSERT ON notifications` → `net.http_post` (pg_net, async, fires after commit) →
Edge Function → provider, with the URL and shared secret in Supabase Vault, and a silent
no-op when Vault is unconfigured so local dev and `seed.sql` are never blocked. **Push
follows the identical shape** — a second dispatcher and a `send-push-notification` Edge
Function calling the Expo Push API. Deliberately *not* a new architecture: every
notification already converges on one insert, and that is exactly where push belongs.

### New table (draft — approval gate, do not run until you say go)
```
device_push_tokens
  id           uuid pk default gen_random_uuid()
  user_id      uuid not null references profiles(id) on delete cascade
  token        text not null                        -- ExpoPushToken[...]
  platform     text not null check (platform in ('ios','android'))
  portal       text not null                        -- 'vendor' (one row per app install)
  device_name  text
  created_at   timestamptz not null default now()
  last_seen_at timestamptz not null default now()
  unique (token)
  index on (user_id, portal)
```
**RLS:** enabled. `authenticated` may `insert`/`update`/`delete` **only rows where
`user_id = auth.uid()`**; no cross-user select. Reads for dispatch happen inside a
`SECURITY DEFINER` function / service-role Edge Function, never from a client.
**Table-level GRANTs are mandatory and must be in the same migration** —
`authenticated`: `select, insert, update, delete` (never `truncate`); `anon`: none;
`service_role`: full DML. Per `20260620000001_api_role_grants.sql` and the
`kyc_document_types` grant-gap bug that needed a follow-up migration a month later
(`20260724000001`), RLS alone yields `permission denied`.

### Blast radius
- **Data:** purely additive — new table, no existing row is read, validated or rewritten.
- **Lock / performance:** `create table` takes no lock on existing tables. The new
  `AFTER INSERT` trigger on `notifications` adds one more async `net.http_post` per
  notification; pg_net is fire-and-forget, so a push failure can never roll back or slow a
  notification insert — the same guarantee the email dispatcher already relies on.
- **Downstream:** `seed.sql` already disables the email dispatcher around its Block 8
  notification inserts; the push dispatcher **must be added to that same disable list** or
  a `db reset` starts attempting sends. A new hand-written TS interface is required in the
  mobile app (types are hand-written in this repo — no `supabase gen types`).
- **Reversibility:** `drop trigger`, `drop function`, `drop table` — no data migration to
  unwind. Tokens are disposable; clients re-register on next launch.
- **Token hygiene:** the Expo Push API returns `DeviceNotRegistered` for dead tokens; the
  Edge Function must delete those rows, or the table accumulates garbage and every send
  slows down.

### Non-database prerequisites (external, lead-time-bearing)
- **Android:** an FCM v1 service-account key uploaded to EAS; `google-services.json` via the
  config plugin. A **notification channel must be created before requesting permission**
  on Android 13+ or the prompt misbehaves.
- **iOS:** an APNs key from an Apple Developer account; entitlement defaults to
  `development` and Xcode switches to `production` for release builds — a classic
  "push works in TestFlight, dies in production" trap.
- **Both:** a **dev build** (`expo-dev-client`); Expo Go cannot receive Android push from
  SDK 53 onward. A **physical device** is required — `Device.isDevice` must guard token
  registration; simulators cannot produce one.
- **Store disclosure:** push token collection is a privacy-manifest / data-safety
  declaration on both stores (Ph8).

---

## 11. Couplings

- **B1 ↔ Ph5.** Transactions cannot be built against a local DB lacking
  `booking_transactions`. Resolve the backbone branch state first; no code dependency, pure
  environment ordering.
- **D2 ↔ I9.** If mobile computes real stats (D2-A) and the web keeps its hard-coded ones,
  the two clients disagree about the same four numbers for the same vendor. These do not
  have to ship together, but the web fix must be *tracked* when D2-A is chosen, or the
  discrepancy becomes folklore.
- **Ph7 ↔ `backbone` ↔ `seed.sql`.** The migration, the Edge Function, and the seed's
  trigger-disable list must land in the same batch. Shipping the trigger without the seed
  change breaks `db reset` for everyone.
- **I5 option (b) ↔ backbone.** If server-side transaction search is ever chosen, it is a
  new `SECURITY DEFINER` RPC exposing booker PII on a new path — its own approval gate and
  its own RLS review, not a mobile-side change.

---

## 12. Store acceptance criteria — Apple App Store + Google Play

> The general, app-agnostic version of these rules now lives in
> `.claude/skills/mobile-dev/SKILL.md` §3 (updated 2026-07-27). This section is the
> **ezzy-vendor-mobile-specific** application of them: what is already satisfied, what is
> missing, and who owns it. Read the skill for the rule; read this for the status.

Ph8 was a single roadmap row ("icons/splash, permission strings, privacy disclosures, EAS
Build/Submit"). That is not a spec, and store rejection is a **schedule** risk rather than a
code risk — three items below have multi-week lead times that must start at **Ph0, not
Ph8**. Everything here is a build or submission requirement, verified against the rules in
force July 2026.

**The governing insight for this app:** a login-only companion app with four read-mostly
screens is exactly the profile Apple rejects under Guideline 4.2. What makes it a real app
rather than a web wrapper is **push notification** — which is why D4-A sequences push
*before* submission, not after. Deferring Ph7 past launch is not just a feature delay; it
materially raises rejection risk.

### 12.1 Requirement matrix

| # | Requirement | Store | How this plan satisfies it | Phase |
|---|---|---|---|---|
| S1 | Publicly reachable **privacy policy URL** | Both — blocks submission | **Does not exist today.** No privacy-policy route in `vendor` (verified: no match across `vendor/app/` or `vendor/components/`). See **B6** | Start Ph0, link Ph8 |
| S2 | **Account deletion** path | Apple 5.1.1(v); Play data-deletion policy | Apple's rule binds apps that *offer account creation*; D7-A ships none, so the app is exempt. **D13-A** still adds a Settings → "Delete account" row opening the web route, and gives that URL to Play. Gated on **B6** | Ph8 |
| S3 | **Demo account** in App Review notes | Apple 2.1 | Mandatory — the app is sign-in-only (D7-A). Needs a seeded vendor-admin with **bookings in `pending`** so the reviewer can actually exercise approve/reject, and it must survive a `db reset` | Ph8 |
| S4 | **Minimum functionality** | Apple 4.2 | Push (Ph7, per D4-A) + offline cache (D8/D11) + haptics + native list performance. The review notes must frame it as a business tool for existing Bookdeck vendors | Ph7 → Ph8 |
| S5 | **Data safety form / privacy nutrition labels** | Both | Declare: email (account), **push token as device ID** (Ph7), booker contact PII displayed, and **financial info** — payout/fee/transaction history. Encrypted in transit; session at rest in Keychain/Keystore (D6-A) | Ph8 |
| S6 | `PrivacyInfo.xcprivacy` + required-reason API declarations | Apple | Expo's `ios.privacyManifests` in `app.json`. Deps needing entries: `expo-secure-store`, `@react-native-async-storage/async-storage` (UserDefaults / file-timestamp reasons) | Ph8 |
| S7 | **Minimal permissions** | Both | Notifications only (`POST_NOTIFICATIONS` on Android 13+). No camera, location, contacts or photos — KYC being out of scope (§1) is a **compliance asset**, not just a scope decision. Re-check the merged manifest after every dependency addition | Ph7, Ph8 |
| S8 | **Target API level 36** (Android 16) | Play — **hard date 31 Aug 2026**, ~5 weeks out | Confirm what SDK 57 emits; pin explicitly via `expo-build-properties` if it is not 36. Extensions to 1 Nov 2026 are requestable but should not be planned around | Ph0 (verify), Ph8 |
| S9 | **16 KB page-size support** | Play — already in force | RN 0.86 / SDK 57 comply out of the box; re-verify if any native module joins the dependency list | Ph8 |
| S10 | **Closed testing: 12 testers, 14 continuous days** | Play — personal accounts created after 13 Nov 2023 | Applies or not depending on the account type behind `app.json`'s `"owner": "ezzydevguys-team"`. If it applies it is a **two-week wall clock** before production access. See **B7** | Start at Ph7 |
| S11 | No IAP obligation | Apple 3.1.1 / 3.1.3(e) | The app sells nothing; bookings are real-world services paid for on the web. **Constraint this imposes on the build:** no "pay", "top up" or purchase affordance may appear on the transactions screens, and no outbound purchase links. The D7-A "register on the web portal" link is an account link, not a purchase link — permitted | Ph5, Ph1 |
| S12 | Sign in with Apple | Apple 4.8 — **not triggered** | Email/password only. Adding *any* third-party/social login later makes SIWA mandatory | — |
| S13 | Export compliance | Apple | `ITSAppUsesNonExemptEncryption: false` is already in `app.json` and stays accurate: HTTPS + OS-provided keychain only, no bundled crypto | ✅ set |
| S14 | Age / content rating questionnaire | Both | Business tool, no UGC, no ads | Ph8 |
| S15 | **App identity and store assets** | Both | `"name": "ezzy-vendor-mobile"` is a slug, not a product name, and the icons are Expo template placeholders. See **B5** | Ph8 |
| S16 | Deep-link handling | Both | Custom scheme `ezzyvendormobile://` is accepted by both stores for the I4 reset-password link; Universal Links / App Links are an optional upgrade, not a gate | Ph1 |

### 12.2 The three most likely rejections, specifically

1. **Apple 4.2 (minimum functionality).** Mitigations, in order of weight: ship with push
   working; make the offline cache visible (D8/D11) so the app demonstrably works where a
   browser would not; write review notes that name the audience (existing Bookdeck vendors
   managing live bookings) rather than leaving the reviewer to guess.
2. **Apple 2.1 (incomplete submission — no working demo account).** The single most common
   cause of a wasted review cycle for login-walled apps. The demo vendor needs *live-looking*
   data: pending bookings to approve, transactions in range, and at least one notification.
3. **Missing privacy policy (B6).** Both stores block on this, and it is currently absent
   from the entire vendor product, not just the mobile app.

### 12.3 New blockers this review surfaced

#### B5 — No brand assets exist 🔄 IN PROGRESS — icon + splash ✅ DONE (2026-07-30), listing assets outstanding
`app.json` carries the Expo template icon, splash and adaptive-icon set, and the app's
`name` is its slug. §12's original Ph8 note already observed there is **no real logo
anywhere in this project** — that observation is now a submission blocker, not a
nice-to-have. Needed: app icon (iOS 1024², Android adaptive fore/back/monochrome), splash,
screenshots per required device class, and short + full descriptions. Per **D12-A** the
required set is iPhone + Android phone only — no iPad screenshots are owed. **Do not invent
a logo** — this needs the user's brand decision.

**Product name RESOLVED 2026-07-28: "Ezzy Vendor".** Now sourced from
`EXPO_PUBLIC_APP_NAME` via `app.config.js`, with the same value feeding `APP_NAME` in
`lib/constants.ts` so the home-screen label and the in-app branding cannot drift. The value
in `app.json` is the fallback.

**ICONS + SPLASH RESOLVED 2026-07-30** — executed under
`.plans/2026-07-30-vendor-mobile-brand-assets.md`, which supersedes this item for the
binary assets. The user supplied a true vector mark on the third attempt (the first two
files were a 64×64 PNG and an SVG that turned out to be a wrapper around a 200×62 raster).
Delivered: iOS 1024² alpha-free icon, Android adaptive foreground + monochrome inside the
66dp safe circle on a `#034BFC` background colour, splash on `#04060E`. Every Expo template
artifact deleted; verified through a real `expo prebuild`. Assets are **generated** from the
vector by `scripts/generate-brand-assets.js`, not hand-drawn — do not hand-edit the PNGs.

**B5 is NOT fully closed.** Still outstanding, and still blocking submission: screenshots
per required device class and the short + full descriptions. Those remain this plan's.

#### B6 — No privacy policy or data-deletion route exists in the vendor product ⬜ TODO — **cross-app**
Verified absent from `vendor`. Both stores require a reachable privacy-policy URL to
submit, and Play's data-deletion policy expects a deletion-request URL. The policy must
describe what the *mobile* app collects (push tokens, session, the booker PII it displays).
This is work in the `vendor` web app and/or a marketing site — **outside this plan's
one-app scope**, and it needs its own approval since it touches another app.

#### B7 — Play Console account type is unknown ⬜ TODO
Whether S10's 12-testers/14-day gate applies depends on whether the Play Console account is
an **organization** account (exempt) or a **personal** account created after 13 Nov 2023
(subject). This determines whether Ph8 is a few days or a few weeks. Must be answered before
Ph7 starts, because the closed test should run *concurrently* with push credential setup
rather than after it.

### 12.4 New decisions this review surfaced

- **RESOLVED 2026-07-27: D12 — phone-only (Option A).** Set `ios.supportsTablet: false` and
  keep `orientation: "portrait"`. Apple requires working iPad layouts *and* an iPad
  screenshot set from any app that runs on iPad; declaring phone-only removes an entire
  review surface for a companion app nobody will use on a tablet.
  - *Rejected:* tablet support — more reach, but every screen needs a verified large-screen
    layout and D10-A's per-phase verification bar doubles.
  - **Build consequences:** `app.json` sets `ios.supportsTablet: false` in **Ph0**, not Ph8 —
    it changes what EAS builds and what the D10-A verification bar covers. Layouts are still
    built responsively (a 6.9" iPhone and a small Android phone are far apart), but no
    large-screen breakpoint work is owed and no iPad screenshots are needed at S15.

- **RESOLVED 2026-07-27: D13 — web deletion link (Option A).** A Settings row, "Delete
  account", opening the vendor web portal's deletion route, with the same URL given in
  Play's data-deletion field. Satisfies Play cleanly and removes any argument about whether
  the D7-A exemption covers this app on Apple's side.
  - *Rejected:* relying on the D7-A exemption and shipping nothing — defensible against
    Apple's written rule, but leaves Play's data-safety form with no URL and invites a
    policy review.
  - **This decision depends on B6 and cannot be closed by mobile work alone.** That route
    does not exist in `vendor` today. The link target must exist and be reachable *before*
    submission; a Settings row pointing at a 404 is worse than no row. If B6's route slips,
    the fallback is a `mailto:` deletion-request address in the same Settings row and the
    same address in the Play field — still policy-compliant, and it keeps the mobile side
    unblocked.
  - **Placement:** Settings screen, grouped with sign-out, opened via `expo-web-browser`
    (already in the template) rather than a raw `Linking.openURL`, so the user stays in-app.

### 12.5 Store readiness is not a final phase

Three items must start early or they gate the release regardless of code completeness:
**B6** (privacy policy — begin at Ph0, it is someone else's writing time), **S10 / B7**
(Play closed testing — a 14-day clock that should run during Ph7), and the Apple Developer
account + APNs key already tracked in B3/§10. Ph8 then becomes assembly and submission
rather than discovery.

---

## 13. Execution order

**All decisions are resolved as of 2026-07-27.** The remaining gates are **dependency
approval (§6)** before Ph0, **B1** before Ph5 *and* before D2-A's revenue stat, **B2**
before Ph7, and — for release rather than development — **B5/B6/B7** per §12.5. With those
understood:

1. **Ph0** — delete template scaffolding; install approved deps; `theme/tokens.ts` from the
   real `--sp-*` values (`vendor/app/globals.css`, both `:root` and `.dark`) + Inter;
   `lib/supabase/client.ts` (I1); `lib/types.ts` + `lib/format.ts` ported; QueryClient with
   the `AppState` focus manager. Tokens land **before** any screen, so nothing is built
   generic and re-skinned.
2. **Ph1** — services (`auth`, `vendor`) + `useSession`/`useVendorGate` (I2, I3); screens
   `sign-in` → `forgot-password` → `reset-password` (I4 — the Supabase redirect-URL entry
   must exist first, or the deep link has nowhere valid to land) → `select-vendor` →
   `blocked` (D5).
3. **Ph2** — `_layout.tsx` with `Stack.Protected` guards (and **confirm the guard's scope
   excludes `reset-password`**, per I4); `(app)/_layout.tsx` tabs; theme provider;
   `RefreshableList`; offline/stale banner (D8).
4. **Ph4** — bookings list + filters + infinite scroll; detail screen; approve/reject with
   optimistic update, Undo, reason sheet, haptics, and the stale-transition handling (B4);
   bookings Realtime with background/foreground lifecycle (I6). *Built before Ph3 because
   it is the app's reason to exist.*
5. **Ph6** — notifications list, read/archive/delete, Realtime + arrival toast, unread badge
   on the tab.
6. **Ph3** — dashboard stats per D2, pull-to-refresh, pending-approvals preview that deep-
   links into Ph4's detail screen.
7. **Ph5** — transactions summary + search + filters per D9. *Requires B1 resolved.*
8. **Ph7** — push: migration approval → migration + grants → Edge Function → seed update →
   client registration → dev builds with FCM/APNs. *Requires B2 approved.*
9. **Ph8** — store submission against the full acceptance matrix in **§12**: brand assets
   (B5 — do not invent a logo), privacy-policy and deletion URLs (B6, D13), privacy manifest
   + data-safety declarations (S5/S6), target-API and page-size verification (S8/S9), demo
   account (S3), age rating, EAS Build + Submit. **B6 must have started at Ph0 and the Play
   closed test (S10/B7) during Ph7** — if either is left to this step, the release slips by
   weeks regardless of code state.

Ph3/Ph5/Ph6 are mutually independent after Ph2 and may be reordered.

---

## 14. Verification

**Machine-verifiable (run every phase):**
- `ezzy-vendor-mobile/node_modules/.bin/tsc --noEmit --project ezzy-vendor-mobile/tsconfig.json`
  — using the binary directly; `npm --prefix … exec tsc` resolves over the network and hangs
  (per that app's AGENTS.md). **Baseline note:** 2 pre-existing template type errors
  (`animated-icon.module.css`, `@/global.css`) come from the absent generated
  `expo-env.d.ts` and disappear after the first `expo start`; they are not regressions, and
  the files causing them are deleted in Ph0 anyway.
- `npm --prefix ezzy-vendor-mobile run lint`
- `npx expo-doctor` — must stay green after **each** dependency addition, not just at the end.
- Unit tests per I7.

**Needs a live environment (cannot be machine-verified — state explicitly what was run):**
- Sign in with a real vendor-admin account; session survives an app kill + relaunch; session
  survives backgrounding past a token-refresh interval (this specifically tests I1's
  `AppState` wiring, not just "it worked once").
- Each blocked state renders correctly: pending-KYC vendor, suspended user, user with no
  vendor (D5).
- Forgot password → email arrives (Mailpit locally / Resend hosted, per
  `email-notifications-guide.md`) → tapping the link opens the app at the reset screen →
  new password works. **Test on Android Gmail specifically** (I4's known-risk client).
- Approve and reject a real pending booking; confirm `booking_status_log` records it and the
  booker's web app sees the change live; then deliberately create the stale-status case
  (approve on web, then approve the same booking on a backgrounded phone) and confirm B4's
  message appears rather than a retry prompt.
- Transactions: totals on mobile match the web page for the same vendor and filter — same
  payable-only basis (I5).
- Multi-vendor: switch vendors and confirm bookings, transactions **and** the Realtime
  subscription all re-scope (I3).
- Pull-to-refresh on every list; refetch-on-foreground actually fires.
- **Both themes on every screen**; **largest OS font size on every screen**; VoiceOver and
  TalkBack passes over the approve/reject flow.
- Offline: cold open shows persisted data marked stale; approve while offline is refused
  clearly, not queued (D8).
- Ph7: push received with app foregrounded, backgrounded, and fully killed — on **both**
  platforms, on **physical devices** (simulators cannot receive push).

**Store acceptance (§12) — verify before submitting, not after a rejection:**
- `npx expo prebuild` then read the **merged** `AndroidManifest.xml` and `Info.plist`:
  confirm the only runtime permission present is notifications (S7). Any camera, location or
  photo permission dragged in by a dependency is a data-safety mismatch and a review question.
- Confirm the built `targetSdkVersion` is **36** (S8) — check the generated Gradle config,
  do not assume the SDK default.
- Confirm `PrivacyInfo.xcprivacy` is generated with entries for `expo-secure-store` and
  AsyncStorage's required-reason APIs (S6).
- Install a release build on a **clean device with a fresh account**, sign in with the demo
  credentials exactly as written in the review notes, and complete one approve and one
  reject (S3). A demo account that cannot reach a `pending` booking fails review.
- Walk the D5 blocked states on that same clean device — a reviewer creating an account
  lands there, and a blank screen at that point is a rejection.
- Confirm no purchase or payment affordance appears anywhere on the transactions screens
  (S11).

**Per D10, every phase's DONE note must name which platforms were exercised and which were
not.** A phase verified only on Android is not DONE if D10-A is chosen.

---

## 15. Notes
- No code changes made — plan only, per instruction.
- No commits by the agent — the user handles commits. Note that commits for this app must
  be made **inside `ezzy-vendor-mobile/`**; the root repo does not contain its history.
- Types and services are **copied and adapted** from `vendor`, never imported cross-repo —
  same rule as the three web apps, doubly true across platforms (`conventions.md`).
- `EXPO_PUBLIC_` prefix for public config; `SUPABASE_SERVICE_ROLE_KEY` never reaches this
  app under any prefix, and (per §2) this app never needs it.
