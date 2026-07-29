---
name: mobile-dev
description: >
  Mobile application engineering workflow for this project — pre-flight scoping,
  React Native / Expo implementation rules, and the App Store and Google Play
  acceptance criteria that every mobile change must satisfy. Use for tasks
  involving mobile UI, navigation, application lifecycle, device APIs,
  permissions, deep links, offline behaviour, platform-specific code, mobile
  builds, emulators, simulators, store submission, or mobile release
  configuration.
---

# Mobile development

Applies to `ezzy-booker-mobile` and `ezzy-vendor-mobile`. Work from the workspace root so
`architecture/`, `.plans/` and the shared skills stay in context.

**Expo has changed.** Read the exact versioned docs at
https://docs.expo.dev/versions/v57.0.0/ before writing code. Most training-data patterns for
navigation, notifications and config are stale at this SDK.

---

## 1. Pre-flight

`.claude/skills/developerboss/SKILL.md` is the full pre-flight checklist and still applies
in full. Work it through, then add these mobile-specific deltas at the matching step:

**Scope.** Does this touch `backbone` or one of the web apps as well as the mobile app?
Push notifications, new RPCs and anything service-role-adjacent do — that is a cross-app
change and an approval gate before proceeding.

**Locate before building.** The web app is the reference implementation for business rules,
not for interaction. Port the *service* logic and the *types*; do not port desktop
affordances — numbered pagination, dense tables, hover states, print views and ~24pt
controls all have different mobile answers. Types and services are **copied and adapted**
across repos, never imported.

**Data layer.** Same shared Supabase project, same RLS boundaries. A mobile client is a new
*client*, not a new backend. Schema changes remain an approval gate.
`SUPABASE_SERVICE_ROLE_KEY` must never reach a mobile binary under any prefix — anything
needing it is called over HTTPS against a deployed web app's API route. Public config uses
`EXPO_PUBLIC_`, and anything under that prefix is readable by anyone who unpacks the app.

**Risk surface.** Add the mobile-only failure modes to the usual list: the app is
backgrounded for hours and resumes with stale state; the network is absent or lying; the OS
kills the process mid-write; the user has the largest accessibility font enabled; a
server-side constraint rejects an action the stale UI still offers. Each of these is a
design requirement, not an edge case.

**SOLID.** Services are the Dependency-Inversion seam: screens depend on hooks, hooks depend
on service function signatures, and only services import `supabase`. Keep business logic
platform-independent — anything with a `Platform.OS` branch inside it is usually a
Single-Responsibility failure.

**Style separation — RN variant.** The render/hook split is unchanged: `Name.tsx` is a pure
render layer, `useName.ts` owns state, effects and handlers. React Native has no CSS
modules, so static styling lives in a co-located `Name.styles.ts` exporting
`StyleSheet.create({…})`. Static inline `style={{}}` remains prohibited; only genuinely
dynamic values (a gesture-driven transform, a width from state) may stay inline. In a
theme-aware app, export a `makeStyles(tokens)` factory the hook memoises rather than a
module-level singleton, which would freeze one theme's colours at import time. Full
convention: `.claude/skills/component-separation/SKILL.md`.

---

## 2. While implementing

- Keep business logic platform-independent where practical.
- Account for application lifecycle transitions — foreground, background, cold start,
  process death. Refetch on foreground; do not show hours-old data as though it were live.
- Handle permissions through the project's established abstraction, and request them **in
  context**, at the moment the feature needs them, never on first launch.
- Do not assume identical behaviour across supported platforms. Verify both.
- Preserve accessibility labels and dynamic text behaviour.
- Avoid blocking the UI thread.
- Every data surface needs four states — loading, empty, error, populated — and *offline*,
  *server error* and *session expired* must be visually distinguishable, because the user's
  next action differs in each.
- Touch targets ≥ 44×44pt. Type scales with the OS font setting.
- Swipe or long-press is a shortcut, never the only path to an action.

---

## 3. Store acceptance criteria — build to these, not to a rejection

Every mobile change is judged twice: by review, and by the stores. Treat the rules below as
build requirements from the first commit. Retrofitting them at submission is where releases
slip by weeks.

**Dates and thresholds below move.** Re-verify against Apple's App Review Guidelines and the
Play Console policy pages at submission time rather than trusting this file.

### 3.1 Rules that constrain what you write

| Rule | What it means for the code |
|---|---|
| **Apple 4.2 — minimum functionality** | A login-walled app that only lists and displays records reads as a web wrapper. It needs native capability the browser lacks: push, offline persistence, haptics, biometrics, camera. Ship at least one, and know which one is your answer. |
| **Apple 4.8 — Sign in with Apple** | Triggered by adding *any* third-party or social login. Email/password alone does not trigger it. Adding "Sign in with Google" later makes SIWA mandatory — treat it as a scope change, not a quick win. |
| **Apple 5.1.1(v) — account deletion** | Binds any app that lets users **create** an account in-app. If it does, it must also delete the account and its data from within the app; deactivation is not deletion. Sign-in-only apps are exempt from the in-app requirement, but Play still expects a deletion-request URL. |
| **Apple 3.1.1 / 3.1.3(e) — payments** | Digital goods require IAP. Real-world goods and services do not. If the app displays money without selling anything, keep every "pay", "top up" and purchase link out of the binary — an outbound purchase link is anti-steering, while a link to create an account is fine. |
| **Apple 2.1 — completeness** | Any login wall requires working demo credentials in App Store Connect review notes, and the demo data must let the reviewer exercise the app's actual purpose. Seed it so a `db reset` cannot wipe it. |
| **Both — permission minimalism** | Every permission is a review question and a data-safety row. Declare only what a shipped feature uses. Re-read the **merged** `AndroidManifest.xml` and `Info.plist` after `expo prebuild` — dependencies add permissions you did not ask for. |
| **Both — blocked and empty states** | A reviewer creates a fresh account and lands in your least-tested state. A blank screen there is a rejection. Every "you don't have access" path needs real copy and a way forward. |

### 3.2 Privacy and data declarations

- **Play Data safety** and **Apple privacy nutrition labels** must match what the binary
  actually does. Common under-declarations: push tokens (a device identifier), any PII the
  app *displays* on behalf of a business, and financial or transaction history — which is a
  sensitive category on Play.
- **`PrivacyInfo.xcprivacy`** is required for the app and for third-party SDKs that use
  required-reason APIs. Configure it through Expo's `ios.privacyManifests` in the app config;
  storage libraries (SecureStore, AsyncStorage) are the usual entries.
- A **publicly reachable privacy policy URL** is required by both stores to submit at all. It
  must describe what the mobile app collects, which is rarely identical to the web product.
- Store credentials at rest with the platform keystore (`expo-secure-store` → Keychain /
  Android Keystore) for anything that authorises a state change. Plain AsyncStorage is
  unencrypted on disk; it is fine for cached reads, not for session tokens.

### 3.3 Platform requirements with hard deadlines

- **Google Play target API level.** New apps and updates must target a recent Android
  release; the threshold rises annually with an enforcement date, and missing it blocks
  submission outright. Confirm what the build actually emits — check the generated Gradle
  config, do not trust the SDK default — and pin with `expo-build-properties` if needed.
- **16 KB page sizes** are required for recent Android versions. Expo/RN comply out of the
  box; re-verify whenever a native module is added.
- **Play closed testing.** Personal Play Console accounts created after 13 November 2023
  must run a closed test with a minimum number of testers opted in for a continuous period
  (currently 12 testers / 14 days) before production access. Organisation accounts are
  exempt. This is wall-clock time — start it in parallel with release work, never after.
- **Push credentials.** Android needs an FCM v1 service-account key; iOS needs an APNs key
  from an Apple Developer account, and the entitlement defaults to `development` — the
  classic "works in TestFlight, dead in production" trap. Push cannot be tested in Expo Go on
  Android since SDK 53: a dev build and a **physical device** are required, guarded by
  `Device.isDevice`.
- **Android 13+ notifications** need a channel created *before* the permission prompt.

### 3.4 Listing and device support

- The app's `name` in the config is often the template slug. It must become a real product
  name, with real icons — shipping template artwork is a brand and review failure.
- Decide tablet support explicitly. An app that runs on iPad owes working iPad layouts *and*
  an iPad screenshot set; declaring `ios.supportsTablet: false` removes both obligations.
  Set it early — it changes what EAS builds and what must be verified.
- Age/content rating, export compliance (`ITSAppUsesNonExemptEncryption` — HTTPS and OS
  keychain use stays exempt), and screenshots per required device class are submission-time
  items, but the decisions behind them are made while building.

---

## 4. Before finishing

- Run the app's formatter and static checks.
- Run relevant unit and integration tests.
- Build each affected platform when practical, and **state which platform-specific
  validations were not performed** — an Android-only verification is not a completed one.
- Verify both themes and the largest OS font size on every screen touched.
- Run a screen-reader pass (VoiceOver and TalkBack) over any flow that changes state.
- After any dependency addition: `npx expo-doctor` stays green, and the merged manifest
  gained no permissions (§3.1).
- Before a release build: walk §3 top to bottom against the actual binary, not the intent.
