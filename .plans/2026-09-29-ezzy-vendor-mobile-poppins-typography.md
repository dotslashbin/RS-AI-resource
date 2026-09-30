# Ezzy Vendor Mobile — global Poppins typography

**Date:** 2026-09-29  
**App / scope:** `ezzy-vendor-mobile` only — replace the app’s visual typeface with bundled Poppins on iOS and Android.  
**Status:** IN PROGRESS

> Make Poppins the consistent, offline-capable typeface for every user-facing mobile text surface without changing app behaviour, data access, kiosk scope, or the web portals.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.  
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local — qualify cross-plan references by app.

---

## Baseline and verified findings

- `package.json:11` currently depends on `@expo-google-fonts/inter`; `src/app/_layout.tsx:1-55` loads Inter regular through bold before hiding the splash screen.
- `src/theme/tokens.ts:315-325` defines `fontFamily = "Inter_400Regular"`, but no production style consumes that export. React Native has no inherited CSS font family, so the current app largely falls back to platform system fonts despite loading Inter.
- There are 53 co-located `*.styles.ts` modules, 45 render modules containing `<Text>`, and three `TextInput` renderers. All must be covered for “global” to be truthful; a root-only font-loader swap is insufficient.
- Two intentional system-family exceptions exist today: the booking action-info callout uses Georgia/serif at `src/components/bookings/ActionInfoTrigger/ActionInfoTrigger.styles.ts:45-48`, and the kiosk receipt reference uses monospace at `src/components/kiosk/KioskCheckout/KioskCheckout.styles.ts:29`. The user’s global-Poppins decision includes replacing both.
- Poppins is licensed under SIL Open Font License 1.1, which permits embedding it in application software. Retain the package’s included licence; no store declaration is required solely for the typeface.
- The current first public iOS scope excludes kiosk. This plan changes kiosk source styling for global consistency but must not enable it, change `EXPO_PUBLIC_KIOSK_ENABLED`, create an Android Play release, or alter the active store-submission plan’s reviewer scope.

## BLOCKERS

### B1 — Add and load the exact bundled Poppins faces  🔄 IN PROGRESS
**Files:** `ezzy-vendor-mobile/package.json:11-48`; `ezzy-vendor-mobile/package-lock.json`; `ezzy-vendor-mobile/src/app/_layout.tsx:1-55`.

The app currently loads four unused Inter assets. A custom face must be bundled and registered before any style can name it; otherwise iOS/Android silently fall back or synthesize a different weight.

**Fix approach:** At the dependency-install approval gate, replace `@expo-google-fonts/inter` with `@expo-google-fonts/poppins`. Register Poppins 400 Regular, 500 Medium, 600 SemiBold, 700 Bold, 800 ExtraBold, and 700 Bold Italic in the existing `useFonts` call. Keep `SplashScreen.preventAutoHideAsync()` and the existing `fontsLoaded` gate, so no screen renders with fallback text before its chosen face is available. Do not fetch fonts over the network or add a font provider.

**Component separation:** no component is introduced. `RootLayout` remains composition-only; its existing startup state stays within the function and it simply swaps the static font assets it registers.

**Approval gate:** installing/removing dependencies changes `package.json` and `package-lock.json`; obtain explicit approval immediately before running the package command.

**Verification:** machine — package lock resolves only the intended Poppins package; `npm run lint`, `npm test`, and `npx expo-doctor` pass. Live — cold-launch a native build with network disabled and confirm the splash does not hang and Poppins renders after launch.

**Progress (2026-09-29):** replaced `@expo-google-fonts/inter` with `@expo-google-fonts/poppins` and registered Poppins 400 Regular, 500 Medium, 600 SemiBold, 700 Bold, 700 Bold Italic, and 800 ExtraBold in the existing splash-gated root loader. Machine checks passed for the lockfile, lint, TypeScript, and 25 unit tests. Expo Doctor completed but currently reports seven newer Expo SDK patch versions; see I3. The native cold-launch check belongs to B3 and has not run.

### B2 — Apply weight-matched Poppins to every mobile text and input style  ✅ DONE (2026-09-29)
**Files:** `ezzy-vendor-mobile/src/theme/tokens.ts:315-325`; `ezzy-vendor-mobile/src/components/**/*.styles.ts`; `ezzy-vendor-mobile/src/components/bookings/ActionInfoTrigger/ActionInfoTrigger.styles.ts:45-48`; `ezzy-vendor-mobile/src/components/kiosk/KioskCheckout/KioskCheckout.styles.ts:29`.

React Native text does not inherit the loaded family globally. Setting a single root property or mutating `Text.defaultProps` would be incomplete, difficult to audit, and can produce platform-specific weight synthesis.

**Fix approach:** Replace the unused single `fontFamily` constant with a small static typography map in `theme/tokens.ts`, keyed by the weights actually used in styles (400/500/600/700/800 plus 700 italic). Each entry names the registered Poppins family directly. Update every `Text` and `TextInput` style to spread/use the matching static token, retaining its current font size, line height, letter spacing, `maxFontSizeMultiplier`, colour, and semantic weight. Once a Poppins family is assigned, remove the competing numeric `fontWeight` from that style so iOS and Android select the intended bundled asset rather than synthesize it. Replace the receipt reference’s monospace face with Poppins SemiBold while retaining its existing identifier spacing; replace the editorial Georgia/serif callout with Poppins Bold Italic.

Do not introduce a global `AppText` wrapper, modify React Native defaults, alter component render/hook ownership, or use inline font styles. Each affected component remains a pure render layer; all static typography stays in its co-located `*.styles.ts` module and consumes the shared static theme map.

**Verification:** machine — search produces no Inter import/name and no `fontFamily: "monospace"`, `"Georgia"`, or platform serif fallback in `src/`; inventory all `Text`/`TextInput` renderers and confirm their reachable style paths have a Poppins family. Run lint, unit tests, Expo Doctor, and a TypeScript-aware editor/build check. Live — inspect normal, medium, semibold, bold, extra-bold, and italic samples on both platforms; no clipped controls, missing glyphs, or synthetic-looking weight changes.

**Completed / verified (2026-09-29):** replaced the unused Inter token with the six-face static Poppins map and applied it to every static `fontSize` style in 47 style modules, including the three input paths. Numeric `fontWeight` and the former Georgia/serif and monospace exceptions were removed so each style selects a bundled face. Machine verification: typography inventory reports complete coverage; a source scan finds no Inter, numeric weight, serif, or monospace-family leftovers; `npm run lint`, `npx tsc --noEmit`, and 25/25 unit tests pass. Device visual/accessibility checks remain B3.

### B3 — Regression-test typography as a visual and accessibility change  ⬜ TODO
**Files:** `ezzy-vendor-mobile/src/app/_layout.tsx:45-79`; `ezzy-vendor-mobile/src/theme/tokens.ts:315-325`; `ezzy-vendor-mobile/src/components/common/`; `ezzy-vendor-mobile/src/components/auth/`; `ezzy-vendor-mobile/src/components/bookings/`; `ezzy-vendor-mobile/src/components/dashboard/`; `ezzy-vendor-mobile/src/components/transactions/`; `ezzy-vendor-mobile/src/components/notifications/`; `ezzy-vendor-mobile/src/components/settings/`; `ezzy-vendor-mobile/src/components/vendor/`; `ezzy-vendor-mobile/src/components/kiosk/`.

Poppins has different character widths and ascender/descender metrics from the system fonts. Existing compact controls, list rows, amount totals, the action bar, and maximum-text accessibility layouts can regress even when static checks pass.

**Fix approach:** Build a non-production iOS candidate after B1–B2 and verify: sign-in/recovery, vendor picker, dashboard, booking list/detail/actions, Transactions, notifications, Settings/legal links, blocked/error states, and any reachable kiosk screens. Test Light/Dark, maximum Larger Accessibility Sizes, and VoiceOver. Treat clipping, unreadable controls, missing fonts, or focus/label regressions as blockers; adjust only spacing/line-height required by the new metrics, not unrelated design.

**Verification:** machine — lint, tests, Doctor, and successful signed/internal build. Human/device — screenshots and a pass/fail log on the iPhone used for submission. Android visual validation is not a Google Play action, but it remains required before any future Android distribution because the same React Native style modules ship there.

### B4 — Fold the accepted font change into the iOS production candidate  ⬜ TODO
**Files:** `ezzy-vendor-mobile/package.json:1-48`; `ezzy-vendor-mobile/eas.json:20-39`; `.plans/2026-09-21-ezzy-vendor-mobile-store-submission.md:255-272` (reference only; do not edit without separate approval).

Font assets are compiled into the binary. A previous staging/TestFlight IPA cannot acquire Poppins through an over-the-air configuration change.

**Fix approach:** After B1–B3 pass and the intended source is committed, build a fresh iOS candidate from the production EAS profile with `EXPO_PUBLIC_KIOSK_ENABLED=false`. Install it through TestFlight, re-run the relevant production reviewer-account checks, and take final App Store screenshots from this exact candidate. Keep the same app record; this is a new build, not a new app or an Android submission.

**Verification:** live — TestFlight processing succeeds, installed production candidate shows Poppins across the reviewed screens, reviewer account can sign in, and final screenshots match the binary. Store metadata must not claim kiosk capability.

## IMPORTANT

### I1 — Preserve Android release pause while retaining cross-platform evidence  ⏸ PARKED
**Files / console targets:** `ezzy-vendor-mobile/eas.json:20-39`; Google Play Console Internal testing and Production tracks; `.plans/2026-09-21-ezzy-vendor-mobile-store-submission.md:134-142` (reference only).

**Parked (2026-09-29):** the user has paused Android/Google Play submission work. This plan must not create an Android production AAB, modify Internal testing, add testers, or submit Play metadata.

**Unblock condition:** the user explicitly resumes Android work. Before the font-bearing Android build is distributed, perform the B3 Android visual/accessibility pass and then resume the submission plan from its recorded Play state.

### I2 — Avoid a web-portal typography migration in this release  ✅ DONE (2026-09-29)
**Files:** `vendor/` is deliberately out of scope; `ezzy-vendor-mobile/src/theme/tokens.ts:1-8` documents that mobile visual tokens are copied rather than imported.

The request is for the mobile app. Changing the Vendor web portal would be a second-app visual change, require separate approval, and add no value to the current iOS candidate.

**Resolved / verified (2026-09-29):** scope is limited to `ezzy-vendor-mobile`; no web files, backend/schema, EAS secrets, or store-console state will change during the typography implementation.

### I3 — Reconcile newly reported Expo SDK patch drift  ⬜ TODO
**Files:** `ezzy-vendor-mobile/package.json`; `ezzy-vendor-mobile/package-lock.json`.

`npx expo-doctor` on 2026-09-29 completed 20/21 checks and reported newer expected patch versions for seven existing Expo packages: `@expo/ui`, `expo`, `expo-constants`, `expo-glass-effect`, `expo-linking`, `expo-notifications`, and `expo-router`. This was not introduced by the Poppins package and the earlier project check had passed, but the new result means the plan's clean-Doctor verification is not yet satisfied.

**Next action:** review the precise SDK-57 patch upgrade with the user before changing dependencies; do not use an unreviewed bulk upgrade. Re-run Expo Doctor afterward. This is separate from the completed typography-style mapping and is not authorised by the B1–B2 approval.

## DECISIONS

<!-- No item in this plan may execute while any OPEN line remains — see plan-authoring §6. -->
- Typeface → **Poppins for all user-facing mobile text** (resolved 2026-09-29) — replaces the current system fallback, including the prior receipt monospace and booking-callout serif exceptions, as requested.
- Font delivery → **bundled static assets through `@expo-google-fonts/poppins`** (resolved 2026-09-29) — works offline, uses the project’s existing Expo font-loading pattern, and needs no new runtime service.
- Weight set → **400 / 500 / 600 / 700 / 800, plus 700 italic** (resolved 2026-09-29) — exactly covers the existing style vocabulary while preventing platform weight synthesis.
- Public kiosk scope → **remain excluded from the first iOS production build** (resolved 2026-09-29) — Poppins styling reaches kiosk source for global consistency, but production configuration remains false/unset and no App Store materials mention kiosk.

## DEFERRED / COSMETIC

- Variable-font adoption — deferred. Static faces are already used by the current Expo Google Fonts pattern; adding a variable-font asset pipeline would increase release risk without a user-visible benefit.
- Typography redesign (new scale, revised line-height system, web parity) — out of scope. This plan preserves existing sizes and adjusts geometry only to remedy a measured Poppins clipping or accessibility regression.
- Android Play artefact/release — parked under I1; source consistency does not authorise a Google Play change.

## Execution order

1. **Approval checkpoint:** review this plan, then obtain explicit approval to install/remove the font dependency. Do not modify source or dependencies before that approval.
2. **Stage 1 — B1:** replace and register the bundled font faces; run machine checks.
3. **Stage 2 — B2:** apply the shared weight map to every static text/input style; run coverage searches and machine checks.
4. **Stage 3 — B3:** make one non-production iOS build and complete the visual/accessibility pass. Stop and correct any typography regression before proceeding.
5. **Stage 4 — B4:** merge the accepted change into the existing iOS production-candidate workflow: production EAS values keep kiosk disabled, build a new IPA, TestFlight-test it, then produce store screenshots from that binary.
6. **Parked:** I1 is not part of this execution sequence. Resume it only with explicit user direction.

## Verification

- **Machine-verifiable:** dependency lockfile inspection; no Inter/serif/monospace family references; every registered Poppins family name has a matching style use; `npm run lint`; `npm test`; `npx expo-doctor`; successful EAS build.
- **Needs physical iOS evidence:** cold launch; font rendering across login, core vendor flows, error/blocked states, and reachable kiosk source screens; Light/Dark; maximum system text; VoiceOver; no clipping or fallback.
- **Needs future Android evidence:** the same visual/accessibility pass on an Android device before any new Android distribution. This is deliberately not a Play Console task while I1 is parked.
- **Needs live release evidence:** fresh production TestFlight build uses the approved Poppins source, points at production services, keeps kiosk false/unset, and remains usable with the App Review demo vendor.
