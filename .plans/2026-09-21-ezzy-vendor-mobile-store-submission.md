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

**Progress (2026-09-22):** The user installed the store-signed staging candidate on both a physical Android device (Play Internal testing) and a physical iPhone (TestFlight internal testing). Distribution and device installation are verified. Functional, accessibility, kiosk-payment, and Play pre-launch-report evidence are still outstanding.

**Finding (2026-09-23):** User reports the iPhone Home Screen and in-app sign-in label for the installed TestFlight build is `Ezzy Vendor`, not the expected `Ezzy Vendor Staging`. `ezzy-vendor-mobile/app.config.js:6-31` makes both depend on `EXPO_PUBLIC_APP_NAME` at build time, so the staging display-name override was absent or not consumed during this build. The user verified the build is nevertheless staging-backed: its portal link opens `staging-vendor.ezzy.ph`, and a staging account signs in successfully. This is a display-name packaging defect only, not evidence of a production backend target. Functional staging testing may continue, but a future staging rebuild must correct the name before this candidate is accepted as fully labelled.

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
- OPEN: D5 — Should kiosk ship in the first public build? **Recommended: no, unless it is required for the Philippines launch.** Keeping it off reduces the first-review surface; including it requires the full live payment/receipt checklist below against production before public submission. D3 remains valid: kiosk is included in the current staging candidate for testing.

## DEFERRED / COSMETIC

- iPad support — intentionally excluded: `ios.supportsTablet` is `false`; no iPad listing assets or layout work are owed for this release.
- New native features solely to appease review — deferred. The app already has native secure storage, haptics, push architecture, offline cache, and device-first interactions; proving their working production behaviour is safer than adding scope.
- Store-search optimisation and localisation — after first approved listing. Initial copy must be accurate, clear, and compliant rather than keyword-optimised.

## Execution order

**Current safe prefix — staging-only validation, no application or backend mutation:**

1. **Stage 1 — B2 staging artefact/distribution check:** inspect the Play pre-launch report and confirm the installed builds identify as the staging candidate; record device/OS/build number. The signed builds are already installed. No Store review or public availability starts here.
2. **Stage 2 — B4 staging core-flow test pass:** follow the release-owner checklist below on both phones. Record pass/fail only; do not include credentials, customer data, tokens, or payment details in the log. A defect returns the work to a staging fix/build/test cycle.
3. **Stage 3 — I1/D5 release-scope decision:** decide whether kiosk is in the first public binary. This is an explicit public-release gate; do not configure production kiosk values or submit a public build before it is resolved.
4. **Stage 4 — production candidate preparation:** create the controlled production reviewer vendor/data set, set production-safe public EAS values, build new signed production candidates, and repeat the applicable Stage 2 checks. The current staging binaries must never be promoted.

**Coupled batch — requires separate shared-backend approval:**

5. **Stage 5 — B3:** deploy the existing token/function work, configure push credentials, then prove push on both physical platforms. B3 and B4’s push acceptance must ship/test together.

**Release assembly:**

6. **Stage 6 — B5:** create reviewer account, final screenshots/listings, privacy/data declarations, and reviewer instructions against the accepted production build.
7. **Stage 7 — I2:** reconcile operational documentation with the verified release record.
8. **Stage 8 — public submission:** submit the production binary to App Review and Play Production, resolve store feedback, then release only after every blocker is ✅ DONE. Apple manual release and Google managed publishing/control settings must be selected before submission.

## Release-owner checklist

Use this in order. A checkbox becomes complete only after it has a result in a release log. A failure is useful evidence: record the scenario, platform, build, and symptom, then stop that path and fix/rebuild the **staging** candidate before continuing.

### Stage 1 — Current staging build distribution and artefact evidence  🔄 IN PROGRESS

**Why:** `eas.json:22-32` makes `store-staging` a store-signed build with preview/staging configuration; `constants.ts:1-44` confirms that public configuration is compiled into the binary. Installing it proves distribution, not functionality.

- [x] iPhone: install TestFlight build `0.12.0 (2)` through the internal A-Team group.
- [x] Android: install version code `2` through the Play Internal testing opt-in link.
- [ ] On each phone, open the app and record: date, phone model, OS version, platform, and app build number. Confirm the visible name is **Ezzy Vendor Staging**, not a production label.
- [ ] Android console: Play Console → **Testing → Internal testing → Releases** → open the release → **Pre-launch report**. Record its status and any crash, compatibility, target-API, 16 KB, or permission finding. A missing/not-yet-ready report is not a pass; check again later.
- [ ] iOS console: App Store Connect → **Apps → Ezzy Vendor → TestFlight → build 0.12.0 (2) → Build Metadata**. Confirm no unresolved processing/compliance notice is shown. `app.json:9-27` is the source expectation for bundle ID, encryption declaration, and privacy manifest.

**Expected:** both apps open successfully and remain private to invited testers. Google/Apple are not conducting public-release review at this stage.

### Stage 2 — Staging vendor and resilience test pass  ⬜ TODO

**Setup:** use an already active staging vendor. The mobile app is deliberately post-KYC: `constants.ts:35-38` routes registration/KYC to the vendor web portal, so do not attempt to make a store tester complete KYC here.

**Progress (2026-09-23):** On iPhone 12 Pro Max / iOS 26.6.2, the user signed in with a staging account and confirmed the expected dashboard/vendor data loaded. Opening a test booking, completing a booking approve/reject action, and loading Transactions each passed. This is iOS-only evidence for the primary workflow; Android parity, the opposite booking action where applicable, session/recovery, accessibility, legal-link, and kiosk checks remain open.

**Progress (2026-09-23):** On the same iPhone, sign-out followed by sign-in with the staging account passed. In Airplane Mode, an in-app pull-to-refresh did not visibly change data or show an error, but closing/reopening the app did not crash; after connectivity returned, the app resumed normally without an error. This verifies iOS stability and reconnect recovery only. It does not yet verify a distinct offline/error/retry state because the tested refresh did not produce an observable failed request.

**Progress (2026-09-23):** On the same iPhone, Settings → Privacy Policy opened `https://ezzy.ph/privacy-policy/` in the browser, and Settings → Account & Data Deletion opened `https://ezzy.ph/account-data-deletion/` in the browser. Both iOS in-app legal-link checks passed.

**Progress (2026-09-23):** On the same iPhone, system Dark appearance was applied and the staging app dashboard, a booking, and Transactions remained readable and usable; no colour or button-visibility issue was reported. The user restored Light appearance afterwards. iOS dark-theme coverage for the primary screens passed; large-text and VoiceOver remain open.

**Progress (2026-09-23):** On the same iPhone, maximum Larger Accessibility Sizes was enabled. Dashboard, booking details/actions, Transactions, and Settings remained functional; text grew but was not reported clipped or unusable. The user restored their normal text size. iOS largest-text coverage passed; VoiceOver remains open.

**Progress (2026-09-23):** On the same iPhone, VoiceOver navigation and activation were tested across the app menu, Dashboard, a booking/action, Transactions, and Settings. The user reported that labels and controls were understandable and functional. iOS VoiceOver coverage for the primary vendor paths passed.

- [ ] **Core access — both phones:** sign in; verify the correct vendor/dashboard data; sign out; sign in again; test password recovery if it is enabled. Record the behaviour of a deliberately empty or blocked vendor account if a safe staging fixture exists.
- [ ] **Primary vendor work — both phones:** open a booking, exercise approve and reject using test data, and view transaction information. Test vendor switching if the test user has more than one permitted vendor.
- [ ] **Lifecycle/recovery — both phones:** background then return; disable connectivity and retry after reconnecting; verify a sensible offline/error/retry state rather than stale success. Test an expired session only with a safe staging fixture.
- [ ] **Accessibility — both phones:** test light and dark themes, largest system text, keyboard on sign-in/recovery, and the primary state-changing paths with VoiceOver (iOS) or TalkBack (Android). `mobile-dev` requires device-specific proof; source checks cannot substitute for this.
- [ ] **Legal links — both phones:** Settings → Privacy Policy and Account & Data Deletion open the live HTTPS pages. The fixed URLs are `constants.ts:69-119`; do not replace them with a staging-only legal URL.
- [ ] **Notifications:** record permission prompt/denial behaviour only. Do not count delivery as passed: remote push is B3 and requires a separately approved shared-backend deployment.

**Expected:** each scenario works on both platforms, or produces clear, recoverable copy. A crash, invisible primary action at large text, cross-vendor data, or a blocked recovery path is a release blocker.

### Stage 2A — Staging kiosk acceptance  ⬜ TODO

**Why:** D3 includes kiosk in the staging candidate. `KIOSK-VERIFICATION.md:196-229` confirms code-level checkout/receipt coverage, but live payment and iOS evidence remain open.

**Progress (2026-09-23):** On iPhone 12 Pro Max / iOS 26.6.2, kiosk containment passed: staff tabs, Settings, and staff booking surfaces remained inaccessible while in kiosk; background/return and close/reopen restored kiosk without exposing staff UI; the staff-password exit returned to the dashboard; reopening remained outside kiosk. iOS customer journey, payment/receipt, accessibility/privacy, and all Android kiosk evidence remain open.

**Progress (2026-09-23):** On the same iPhone, the kiosk customer flow passed from offering selection through date/time, quantity, fictional customer details, applicable agreements/signature, and the review screen. Back/Continue controls and the review details were reported correct. No booking or payment was submitted in this check; iOS payment/receipt verification remains open.

**Progress (2026-09-23):** On the same iPhone, the user reported the successful staging/sandbox kiosk-payment flow passed: payment handoff/return worked and the app showed the expected confirmed receipt. No card data, credentials, payment reference, or customer data was recorded. A cancelled-payment, pending/delayed-webhook, duplicate-action, and Android-equivalent check remain open; test-email delivery was not separately evidenced in the release log.

**Progress (2026-09-23):** On the same iPhone, the user cancelled a staging/sandbox checkout. The app did not falsely show a paid receipt, but remained on the payment/pending page. This is a partial cancellation pass: false-success is excluded, while safe exit, explicit status refresh, and no-duplicate behaviour remain to be verified.

**Progress (2026-09-23):** On the same iPhone, the user returned from the cancelled checkout, safely exited the pending state, and confirmed the attempt stayed unpaid after refresh/wait. A fresh kiosk flow had no duplicate booking or stale customer details. The iOS cancelled-payment, safe-exit, and duplicate-state checks passed.

**Progress (2026-09-23):** On the same iPhone, fictional customer details and a test signature were entered, then the flow returned to kiosk start/slot selection. A subsequent customer flow, and a flow after staff exit/re-entry, had blank customer, agreement, and signature state. iOS kiosk cross-customer reset/privacy passed; kiosk accessibility remains open.

**Progress (2026-09-23):** On the same iPhone, kiosk screens/actions were checked in Dark appearance, at maximum Larger Accessibility Sizes, and with VoiceOver. The user reported that controls, including kiosk buttons, remained readable and usable. iOS kiosk accessibility passed.

**iOS staging-test position (2026-09-23):** Core vendor access, a booking action, Transactions, session sign-out/sign-in, legal links, dark appearance, maximum text, VoiceOver, kiosk containment, customer journey, successful/cancelled staging payments, receipt safety, and kiosk reset/accessibility have user-reported iOS evidence. Still open: an observable failed-network error/retry state, explicit staging test-email evidence, notification permission behaviour (push delivery is separately parked), Android parity, Play pre-launch report, and correction of the staging display-name packaging defect before accepting a final staging candidate.

- [ ] **Containment — iPhone:** enter kiosk, relaunch/background it, attempt navigation gestures/deep links where safe, and confirm staff tabs/settings never appear until the staff password exit succeeds. Android containment was user-accepted earlier; re-run only if the store build behaves differently.
- [ ] **Customer journey — both phones:** catalogue → date/time → quantity → customer details → agreement/signature when required → review. Use only fictional staging customer data.
- [ ] **Payment — both phones:** complete one approved sandbox/staging payment and one cancelled payment. Never use a real customer card or record payment details in the log.
- [ ] **Receipt and recovery — both phones:** return manually from the payment browser, wait for any delayed webhook, verify receipt amount/status/reference, then test pending/error/retry and duplicate-tap protection. Confirm exactly one customer email is sent if staging email delivery is enabled.
- [ ] **Kiosk accessibility/privacy — both phones:** verify theme, largest text, screen reader, background/idle reset, and that the next customer cannot see prior customer/signature data.

**Expected:** payment truth comes from the server/receipt, never merely from closing the browser. Any incorrect amount, status, duplicate booking/charge, or cross-customer data exposure stops kiosk from public scope.

### Stage 3 — Decide first-public-release kiosk scope  ⬜ TODO

- [ ] Resolve D5 before any production EAS configuration or public submission.
- [ ] If **excluded**, production `EXPO_PUBLIC_KIOSK_ENABLED` remains unset/false and the public listing/reviewer notes do not claim kiosk functionality.
- [ ] If **included**, repeat Stage 2A against production using sandbox/test payment methods, confirm production browser/payment/receipt behaviour, and make the kiosk journey available to the reviewer demo vendor.

### Stage 4 — Production candidate and reviewer environment  ⬜ TODO

**Approval boundary:** creating production accounts/data or changing shared-backend state is outside this mobile app and needs separate explicit approval at execution time. Do not put reviewer credentials in this document.

- [ ] Create one reusable, fully activated production demo vendor; no KYC, email confirmation, OTP, or manual approval may block sign-in. Seed fictional pending and paid bookings, a transaction, and the data required by every public feature. `STORE-SUBMISSION.md:125-137` defines the minimum reviewer state.
- [ ] Set only safe `EXPO_PUBLIC_*` production EAS values: production Supabase URL, anon key, vendor portal URL, app name, and the resolved kiosk flag. Never use a service-role key or payment/APNs/FCM private credential.
- [ ] Build fresh Android AAB and iOS IPA with the `production` EAS profile. New monotonic build numbers are required. Do not repurpose the current staging artefacts.
- [ ] Upload the production candidates to private tracks, install them on both physical phones, and repeat all applicable Stage 1/Stage 2 checks against production before completing any public submission form.

### Stage 5 — Optional push batch  ⏸ PARKED

**Parked (2026-09-22):** requires a separate, explicit approval for the shared Supabase migration/Edge Function and provider credentials. It is not part of the current staging test pass. Unblock only when the shared-backend change is approved and non-production notification testing can be performed.

### Stage 6 — Store submission assembly  ⬜ TODO

- [ ] Create screenshots from the verified production candidate, with fictional data. Apple screenshots show real in-app use, not only login/splash.
- [ ] Apple: complete listing/privacy/age-rating fields and App Review Information. Provide the demo vendor login plus concise instructions: post-KYC vendor app; KYC is completed on the web; kiosk instructions only if D5 includes it; no digital goods are sold.
- [ ] Google: complete Store listing, Data safety, content rating/target audience, privacy/deletion URLs, ads declaration, and **Policy and programmes → App content → Sign-in details** using the same active demo vendor. Credentials must work from any reviewer location and remain valid.
- [ ] From a clean browser/device session, verify both legal URLs and reviewer access. A second person should follow the reviewer instructions without help.

### Stage 7 — Submit, review, and controlled launch  ⬜ TODO

- [ ] Apple: attach the verified production build to the App Store version, select **Manual release**, then submit for App Review. Monitor App Store Connect email/messages and keep the demo account/backend live.
- [ ] Google: upload the verified production AAB to **Production**, use Managed publishing (or the equivalent current publication control) and a controlled rollout, then send changes for review. Monitor Play Console policy/review inbox and keep the demo account/backend live.
- [ ] If either store asks a question or rejects the app, answer only through the relevant console, fix the stated issue, make a new production build if code/config changed, re-test, and resubmit. Never edit a shipped artefact in place.

## Verification

- **Machine-verifiable:** `npm --prefix ezzy-vendor-mobile run lint`; `npm --prefix ezzy-vendor-mobile test`; `npx expo-doctor`; EAS build success; archive/AAB inspection; Android target API and merged-permission report.
- **Needs live environment:** Apple membership and TestFlight processing; Play account eligibility and closed-test duration; public legal URLs; reviewer account; production backend/push deployment; APNs/FCM delivery; payment/browser hand-off if kiosk is enabled.
- **Needs physical-device/human validation:** Android and iPhone functional, accessibility, theme, large-font, sign-in/recovery, lifecycle, offline/error, notification, and reviewer-access passes.
- A blocker is **not** DONE until the named evidence exists. A passing source lint/test run is necessary but never substitutes for a signed, store-processed release candidate.
