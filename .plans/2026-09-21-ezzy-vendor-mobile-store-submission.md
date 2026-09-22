# Ezzy Vendor Mobile — App Store and Google Play submission

**Date:** 2026-09-21  
**App / scope:** `ezzy-vendor-mobile`, its existing shared Supabase push deployment, and the Apple/Google developer-console submission work  
**Status:** IN PROGRESS

> Take the existing Android-tested vendor companion app through reproducible release validation, beta distribution, and public-store submission. Out of scope: new product features, redesign, new dependencies, schema redesign, and changes to the web portals except the already-authored push deployment if approved.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.  
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local — qualify cross-plan references by app.

---

## Baseline and corrections

- ✅ DONE (2026-09-21) — source audit completed: `npm --prefix ezzy-vendor-mobile run lint` passed and all 25 Node tests passed. No iOS physical-device or release-binary validation has been performed.
- ✅ DONE (2026-09-21) — `https://ezzy.ph/privacy-policy/` and `https://ezzy.ph/account-data-deletion/` each returned HTTP 200. The live links are wired into mobile Settings at `ezzy-vendor-mobile/src/lib/constants.ts:73-119` and `src/components/settings/SettingsList/useSettingsList.ts:51-56`.
- **Correction to prior documentation:** `ezzy-vendor-mobile/STORE-SUBMISSION.md:161-165` still says privacy/deletion are absent. That is a false alarm from an older report; do not build a duplicate route. Its listings, reviewer access, push, and device-verification gaps remain real.
- **Cross-system coupling:** enabling remote push deploys the already-authored `backbone/supabase/migrations/20260728000001_device_push_tokens.sql:47-192` and `backbone/supabase/functions/send-push-notification/`. It changes the shared production backend, so it requires separate explicit approval before execution. The mobile client is already prepared at `ezzy-vendor-mobile/src/services/push.service.ts:103-135`.

## BLOCKERS

### B1 — Resolve publisher accounts and production-track eligibility  ✅ DONE (2026-09-21)
**Files / console targets:** `ezzy-vendor-mobile/IOS-BUILD.md:21-69`; Apple Developer Program / App Store Connect; Google Play Console.

The app cannot be released without active publisher accounts. Apple account type determines the public seller name and team access; Google personal accounts created after 2023-11-13 require 12 closed-test participants continuously opted in for 14 days before production access.

**Fix approach:** Enrol the chosen Apple publisher, enable 2FA, create/confirm the App Store Connect team and app record using `ph.ezzy.vendormobile`. In Play Console, create/confirm the app record with package `ph.ezzy.vendormobile`, record whether the account is Organisation or Personal, and start the required closed test immediately if it is Personal.

**User guide:**
1. Apple: enrol through the web flow, not the Apple Developer iOS app, so the organisation choice is available. Use a long-lived company-controlled Apple ID with 2FA.
2. Play: in Play Console → Account details, record account type and creation date. If the personal-test rule applies, create a closed testing track, invite at least 12 real testers, instruct them not to opt out, and retain their feedback/participation evidence for the production-access questionnaire.
3. Do not register a different bundle/package identifier: store identifiers cannot be changed after release.

**Verification:** needs live-console evidence: active Apple membership, App Store Connect record, active Play developer account, and—if applicable—Play’s 14-day eligibility signal.

**Progress (2026-09-21):** User confirmed active Individual Apple Developer membership, registered App ID `ph.ezzy.vendormobile` with the internal description “Ezzy Vendor,” accepted App Store Connect terms, created the App Store Connect app record, and can access it. User also confirmed creation of the Google Play app record with package `ph.ezzy.vendormobile` under the existing Organisation Play Console account. Verified by the user in both live consoles; the personal-account 12-tester/14-day gate does not apply.

### B2 — Build and inspect store-release artefacts  🔄 IN PROGRESS (2026-09-21)
**Files:** `ezzy-vendor-mobile/app.json:2-66`; `ezzy-vendor-mobile/app.config.js:21-26`; `ezzy-vendor-mobile/eas.json:3-29`; `ezzy-vendor-mobile/STORE-SUBMISSION.md:30-52`.

Source configuration specifies identifiers, a phone-only iOS app, privacy manifest declarations, Android notification/storage restrictions, and a production AAB. None of this proves the signed artefacts contain the expected merged manifest, target API, privacy manifest, icon, or build-time environment values.

**Fix approach:** With production-safe public configuration populated in EAS, build one signed Android AAB and one iOS archive through the `production` profile. Inspect the Android App Bundle/Play pre-launch report and Xcode/Transporter validation output; retain the build URLs and version/build numbers. Verify Android targets API 36 or higher—the required threshold as of 2026-08-31.

**User guide:**
1. In EAS, set only `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_APP_NAME`, and the deliberate kiosk flag for the **production** environment. Never paste service-role, payment, APNs, or FCM private credentials into the app configuration.
2. Start EAS production builds only after B1’s app records exist. Upload the AAB to Play internal testing and the iOS archive to TestFlight; these are beta-distribution actions, not public release.
3. From the final artefacts, confirm: package/bundle identifier, version and monotonic build number, target SDK ≥ 36, 16 KB compatibility report, final Android permissions, `ITSAppUsesNonExemptEncryption=false`, merged `PrivacyInfo.xcprivacy`, and rendered icons/splash.

**Verification:** machine/live: successful signed AAB and IPA/archive validation, Play Console pre-launch report, TestFlight processing, and retained release-artifact inspection notes. `expo-doctor` must pass before this item is marked done.

**Progress (2026-09-21):** Added `store-staging` to `ezzy-vendor-mobile/eas.json`. It inherits the existing store-signed production profile (including Android AAB output and remote build-number incrementing) but draws configuration from the independent EAS `preview` environment. This is the required staging-only candidate profile for D3; the existing `production` profile remains reserved for production services and public release.

**Progress (2026-09-21):** User configured the five required staging values in EAS's `preview` environment: Supabase URL, Supabase anon key, vendor portal URL, staging display name, and explicit kiosk enablement. Production EAS values are intentionally unset at this point. The first build must use `store-staging`; a future public candidate must use `production` after those values are separately configured and will require a new build/submission—client `EXPO_PUBLIC_*` values are baked into the binary.

**Progress (2026-09-21):** User ran a value-safe `eas env:exec preview` validation. All five required staging values were present; no values were disclosed.

**Finding (2026-09-21):** `npx expo-doctor` passed 20/21 checks but rejected the installed SDK 57 patch set: 21 dependencies—including `expo`, `expo-router`, `expo-notifications`, `expo-secure-store`, and `react-native`—are below Expo's current SDK 57-compatible patch versions. This blocks B2. The scoped remedy is `npx expo install --fix`, followed by lint, tests, Expo Doctor, and a staging-device smoke check before any signed store build. Installing dependencies is an explicit approval gate.

**Progress (2026-09-21):** User approved and ran the Expo SDK 57 patch update. User then confirmed `npx expo-doctor` passed all checks. Machine verification after the update: `npm run lint` passed; all 25 Node tests passed. The resolved dependency graph now includes `expo` 57.0.24, React Native 0.86.3, `expo-router` 57.0.22, `expo-notifications` 57.0.20, and `expo-secure-store` 57.0.4. The original Doctor finding is resolved; signed Android/iOS artefacts remain unbuilt.

**Progress (2026-09-21):** User completed the first signed Android `store-staging` build without reported build errors. This verifies EAS cloud compilation/signing only; Android App Bundle inspection, Google Play upload/pre-launch results, and physical-device validation are still outstanding. Build URLs/IDs are retained by the release owner and need not be copied into this plan.

**Progress (2026-09-21):** User completed the first signed iOS `store-staging` build without reported build errors. This verifies EAS cloud compilation/signing only; App Store Connect/TestFlight upload and processing, archive/privacy inspection, and physical-iPhone validation are still outstanding. Build URLs/IDs are retained by the release owner and need not be copied into this plan.

**Progress (2026-09-21):** User submitted the iOS staging build to App Store Connect successfully and can see it in TestFlight. The build has not yet been accepted as device-test evidence: it must finish Apple processing, have no unresolved compliance/upload warning, and be installed on a physical iPhone before B2 can advance.

**Progress (2026-09-21):** App Store Connect shows iOS version 0.12.0 build 2 upload status `Complete` and TestFlight status `Ready to Submit`. This confirms Apple processing completed with no visible compliance/upload error and the build is eligible for internal testers. It is not App Store submission or external TestFlight approval; physical-iPhone installation and archive/privacy inspection remain outstanding.

**Progress (2026-09-21):** User uploaded the Android staging AAB successfully to Google Play Internal testing as version code 2. Play reported two non-blocking warnings: no testers are yet assigned (must resolve before distribution), and no deobfuscation file is associated with the bundle. The latter is accepted for this build: no R8/ProGuard/minification configuration exists in the project, and Expo's current manual-upload guidance explicitly permits skipping this warning unless ProGuard is enabled. Play pre-launch, target-API, 16 KB, final-permission, and device-test evidence remain outstanding.

**Progress (2026-09-21):** User published the staging release to the Google Play Internal testing track and created an internal tester list containing their own Google account. The track can have up to 100 testers and the list can be changed without rebuilding. The first internal rollout may require Play publishing review before the opt-in link works; no installed-device or Play pre-launch evidence exists yet.

### B3 — Enable and prove remote push on both platforms  ⬜ TODO
**Files:** `ezzy-vendor-mobile/src/services/push.service.ts:20-135`; `ezzy-vendor-mobile/src/hooks/usePushRegistration.ts:42-156`; `backbone/supabase/migrations/20260728000001_device_push_tokens.sql:47-192`; `backbone/supabase/functions/send-push-notification/`.

The app’s native-notification UI and permission flow exist, but the source records that the shared token table/function deployment and FCM/APNs credentials have not been verified in production. A failed token registration presents as “unavailable,” leaving the App Store 4.2 native-functionality case materially weaker.

**Fix approach:** After a separate shared-backend approval, deploy the existing migration/function and configure service-side credentials only in their approved secrets stores. Register Android FCM v1 and iOS APNs credentials with EAS, then test opt-in, foreground, background, cold-start tap routing, denial, sign-out unregistration, and a user switch on physical Android and iPhone devices.

**Approval gate / blast radius:** deployment writes push delivery addresses to the shared database and permits an Edge Function to dispatch notifications. It affects both mobile clients and the notification pipeline; it must ship as one backend batch, be tested with non-production accounts first, and have the portal-level kill switch ready. Reversal: disable push via the existing settings/secret configuration and stop client registration; do not delete production data without a separate approval.

**Verification:** needs live environment and physical devices on both platforms. Capture notification delivery logs without recording tokens or credentials in this plan.

### B4 — Complete end-to-end release and accessibility testing  ⬜ TODO
**Files:** `ezzy-vendor-mobile/src/app/_layout.tsx:45-83`; `ezzy-vendor-mobile/src/components/settings/SettingsList/SettingsList.tsx:130-203`; `ezzy-vendor-mobile/KIOSK-VERIFICATION.md:1-55`.

Android device validation is recorded, but iOS has never been tested. The kiosk document also leaves live payment/receipt acceptance open; kiosk is excluded from production unless `EXPO_PUBLIC_KIOSK_ENABLED=true` (`src/lib/constants.ts:44-48`).

**Fix approach:** Test the production candidates on current physical Android and iPhone devices, each in light/dark theme, largest system text, offline/recovery, expired-session, empty/blocked vendor account, password reset, vendor switching, booking approve/reject, transaction access, and screen-reader paths. Include kiosk browser/payment/receipt only if D3 elects to release kiosk.

**Verification:** needs live devices and production-like test accounts. Record tester, device/OS, build number, result, and blocker in a release test log; never put passwords or personal data in the log.

### B5 — Prepare accurate reviewer access, privacy declarations, and store listings  ⬜ TODO
**Files:** `ezzy-vendor-mobile/STORE-SUBMISSION.md:56-137`; `ezzy-vendor-mobile/src/lib/constants.ts:73-119`; `ezzy-vendor-mobile/app.json:14-66`.

Neither store can review a login-walled app without usable reviewer access. Listing screenshots/descriptions are not yet prepared. Existing privacy guidance is a useful draft but must be reconciled with the exact submitted artefacts and current server-side data flows.

**Fix approach:** Create a controlled production reviewer vendor-admin with active vendor access, representative pending and paid bookings, transactions, and notification coverage. Use fictional customer data in screenshots. Complete both stores’ privacy/data forms from a data inventory covering vendor account identity, booker contact details shown to vendors, transactions, Expo push token/device identifier when push is enabled, and every third-party SDK/service. Upload the live privacy-policy and deletion URLs.

**User guide:**
1. Create screenshots from the accepted release candidate, not mockups. Apple screenshots must show the app in use, not the login/splash alone.
2. In App Store Connect provide a privacy-policy URL, support URL/contact path, age rating, category, all screenshots, accurate metadata, and exact reviewer credentials/instructions. State that accounts are created/verified on the web, explain any non-obvious browser hand-off, and state that no digital goods are sold.
3. In Play Console provide the privacy-policy URL, Data Safety form, deletion-request mechanism, ads = no (if unchanged), target audience/content rating, sign-in instructions, store icon, feature graphic, screenshots, 80-character short description, and full description.
4. Before submitting, re-test every URL and reviewer credential from a clean device/browser session.

**Verification:** needs live-console confirmation and a second person’s clean-session review. Both submitted declarations must match the final binary and privacy policy.

## IMPORTANT

### I1 — Decide whether kiosk ships in the first public mobile release  ⬜ TODO
**Files:** `ezzy-vendor-mobile/src/lib/constants.ts:44-48`; `ezzy-vendor-mobile/KIOSK-VERIFICATION.md:94-96`; `ezzy-vendor-mobile/KIOSK-IMPLEMENTATION.md:48-63`.

Kiosk is disabled in production by default. Enabling it exposes browser payment/receipt functionality whose live end-to-end acceptance is outstanding.

**Fix approach:** Keep kiosk disabled for the first public submission unless it is a required launch capability. If it is required, treat B4’s kiosk tests and the web payment environment checks in `architecture/production-env-checklist.md` as blockers before release.

**Verification:** machine: inspect final public config; needs live environment if enabled: successful and cancelled sandbox payment, delayed webhook, receipt, browser return, and no cross-customer state leakage.

### I2 — Reconcile release documentation with verified reality  ⬜ TODO
**Files:** `ezzy-vendor-mobile/STORE-SUBMISSION.md:1-175`; `ezzy-vendor-mobile/AGENTS.md:65-94`; `ezzy-vendor-mobile/EAS-SETUP.md:214-221`.

The submission document has a known stale B6 claim and must become an accurate operations handoff after B1–B5—not a competing source of truth.

**Fix approach:** Update only verified statements, record build URLs/versions without secrets, replace the obsolete B6 claim with live-URL verification, and enumerate remaining post-launch obligations.

**Verification:** machine: link/path check; needs human review: release owner confirms the document matches the console records and submitted artefacts.

## DECISIONS

<!-- No item in this plan may execute while any OPEN line remains. -->

- D1 — Apple publisher enrolment type → **Individual** (resolved 2026-09-21) — selected because Ezzy is a sole proprietorship. The App Store seller name will be the account holder’s legal name. This membership cannot add people to the Apple Developer Program team, but it can grant up to 50 people App Store Connect-only access for functions such as internal TestFlight testing.
- D2 — Play Console account status → **existing Organisation account** (resolved 2026-09-21) — the personal-account 12-tester/14-day production-access gate does not apply. Confirm the account status displayed in Play Console before B1 is marked done.
- D3 — First release scope → **include kiosk in the release candidate, initially against staging** (resolved 2026-09-21) — this makes kiosk’s browser/payment/receipt acceptance testing mandatory. Staging is limited to internal/TestFlight/Play testing; before store review or public release, a stable review environment and then production must be selected and fully re-tested. No public binary may point at staging.
- D4a — Target age audience → **adults only** (resolved 2026-09-21) — configure the content-rating and target-audience questionnaires consistently for a business-facing adult vendor app.
- D4b — Launch storefront countries/regions → **Philippines only** (resolved 2026-09-21) — initial App Store and Google Play availability will be limited to the operating market. Expansion requires a deliberate later review of service readiness, privacy, payments, support, and local obligations.

## DEFERRED / COSMETIC

- iPad support — intentionally excluded: `ios.supportsTablet` is `false`; no iPad listing assets or layout work are owed for this release.
- New native features solely to appease review — deferred. The app already has native secure storage, haptics, push architecture, offline cache, and device-first interactions; proving their working production behaviour is safer than adding scope.
- Store-search optimisation and localisation — after first approved listing. Initial copy must be accurate, clear, and compliant rather than keyword-optimised.

## Execution order

**Safe prefix once decisions are resolved (no application or backend mutation):**

1. **Stage 1 — B1:** choose publisher/account setup; create the two app records; begin Play closed testing immediately if required.
2. **Stage 2 — B2:** configure production public values, make signed release candidates, and inspect/validate the final AAB and iOS archive.
3. **Stage 3 — B4 (core flows):** run cross-platform candidate testing and record results; do not enable kiosk unless D3 selects it.

**Coupled batch — requires separate shared-backend approval:**

4. **Stage 4 — B3:** deploy the existing token/function work, configure push credentials, then prove push on both physical platforms. B3 and B4’s push acceptance must ship/test together.

**Release assembly:**

5. **Stage 5 — B5:** create reviewer account, final screenshots/listings, privacy/data declarations, and reviewer instructions against the accepted final build.
6. **Stage 6 — I2:** reconcile operational documentation with the verified release record.
7. **Stage 7 — submission:** submit to TestFlight and Play internal/closed testing, resolve store feedback, then request public release only after every blocker is ✅ DONE.

## Verification

- **Machine-verifiable:** `npm --prefix ezzy-vendor-mobile run lint`; `npm --prefix ezzy-vendor-mobile test`; `npx expo-doctor`; EAS build success; archive/AAB inspection; Android target API and merged-permission report.
- **Needs live environment:** Apple membership and TestFlight processing; Play account eligibility and closed-test duration; public legal URLs; reviewer account; production backend/push deployment; APNs/FCM delivery; payment/browser hand-off if kiosk is enabled.
- **Needs physical-device/human validation:** Android and iPhone functional, accessibility, theme, large-font, sign-in/recovery, lifecycle, offline/error, notification, and reviewer-access passes.
- A blocker is **not** DONE until the named evidence exists. A passing source lint/test run is necessary but never substitutes for a signed, store-processed release candidate.
