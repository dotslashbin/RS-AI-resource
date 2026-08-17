# Ezzy Vendor Mobile — App Store & Google Play release-readiness audit

**Date:** 2026-08-16
**App / scope:** `./ezzy-vendor-mobile` **only**. Findings that land in `vendor` (web) or
`backbone` are *identified* as external dependencies and **not implemented here** — they
each need their own plan and their own approval gate.
**Status:** **IN PROGRESS** — all 5 decisions resolved 2026-08-16.
**Stage 1 ✅ COMPLETE (2026-08-16)** — I4, I9, I10 executed and machine-verified.
Stages 2–8 ⬜ TODO. Next up: **Stage 2 (X1, `backbone`)** — needs approval, and it gates Stage 3.

> One-line framing: establish exactly what stops `ezzy-vendor-mobile` from being submitted
> to and approved by the Apple App Store and Google Play **today**, measured against the
> official requirements in force on 2026-08-16, and order the remaining work by rejection
> risk.

> ### ⚠️ Read this before the tables below
>
> The audit was performed against **both** stores. The decisions taken on 2026-08-16 then
> narrowed what actually executes:
>
> - **D4 — iOS is ⏸ PARKED.** No Apple Developer Program enrolment, so no iOS build can
>   exist. **This plan executes as Google Play only.** The Apple columns and Apple-specific
>   items are kept deliberately — they are the standing debt for when iOS unparks, not
>   live work. Every Apple item below is either ⏸ PARKED or reclassified as "owed later".
> - **D2 — push SHIPS in v1.0. Reversed 2026-08-16** (it was briefly deferred; see the D2
>   entry for the full history and the reasoning on both sides). I3 is **unparked and in
>   release scope**, which brings **X1** onto the critical path and **cancels I11 entirely**.
> - **D3 — the Play Console account is an organisation.** The 12-tester / 14-day closed test
>   **does not apply**. B6 is ✖ resolved and the Android timeline carries no wall-clock gate.
> - **D1 — account deletion stays web-only.** B2 is a `vendor` route plus a one-line repoint.
> - **D5 — copy for a push-less v1.0.** ✖ **MOOT** once D2 reversed. I11 is ABORTED.
>
> **Net effect: five live blockers, all Google Play — B1, B2, B3, B4, B5 — plus I3 (push)
> and its prerequisite X1 now in release scope.** All decisions are resolved; the plan is
> ready for execution approval.
>
> **Note on this repo's share of the push work: zero lines of mobile code.** The client is
> complete (see I3). Everything push adds to the release lives in `backbone`, in the EAS
> credential store, and in device testing.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, X# = External-only, D# = Decision.
> Numbers are plan-local — qualify cross-plan references by app (e.g. "companion B6").
> **Compliance indicators:** ✅ Compliant · ⚠️ Needs verification · ❌ Missing /
> non-compliant · ➖ Not applicable · 🌐 External / store-console task.

> **Verification discipline used here.** Every ✅ below was established by opening the file
> or running the command named beside it. Anything that could only be confirmed from a
> store console, a built binary, or a live backend is ⚠️ or 🌐 — **not** ✅. In particular:
> **nothing in this app has ever been built or run on iOS** (companion plan B9), so every
> iOS runtime claim is inference from configuration, not observation.

---

## 0. Scope

**In scope:** the `ezzy-vendor-mobile` repository, its build configuration, its dependency
set, and the store-console/legal work that its submission depends on.

**Explicitly out of scope (identified, not planned):**
- The privacy-policy page and the account-deletion route themselves — those are **`vendor`
  (web) work** (§B1, §B2). This plan specifies what they must contain and links them as
  hard dependencies; it does not design or build them.
- Applying the `device_push_tokens` migration or deploying the push Edge Function — those
  are **`backbone`** (§X4). Per standing instruction, migrations are written but never
  applied by an agent.
- `ezzy-booker-mobile`, `booker`, `command`.

**Cross-app flag:** B1, B2 and X4 each touch a second repository. Each is an approval gate
in its own right and must not be folded into this plan's execution.

---

## 1. Current mobile stack — established by inspection

| Concern | Value | Source |
|---|---|---|
| Framework | Expo (managed / CNG), `expo-router` file-based routing | `package.json`, `src/app/` |
| Expo SDK | **57** (`expo ~57.0.9`) | `package.json:14` |
| React Native | **0.86.2** | `package.json:44` |
| React | 19.2.3 | `package.json:42` |
| Android compileSdk | **36** | `node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle:65` |
| Android targetSdk | **36** | same file `:69` |
| Android minSdk | **24** (Android 7) | same file `:68` |
| AGP / Gradle / Kotlin | Not pinned in-repo — supplied by the SDK 57 prebuild template | `/android` is gitignored (`.gitignore:34`) |
| iOS deployment target | **16.4** (SDK 57 default; not overridden) | [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) |
| Xcode required by SDK 57 | **26.4+** | same |
| CocoaPods | Managed by CNG; no `/ios` in repo | `.gitignore:34` |
| Package manager | npm (`package-lock.json`) | — |
| Build tooling | **EAS Build**, project `ff5bf2d4-…`, owner `ezzydevguys-team` | `app.json` `extra.eas`, `owner` |
| OTA updates | **None** — no `expo-updates`, no `updates` key | `package.json`, `app.json` |
| Config system | `app.json` (static) extended by `app.config.js`; `EXPO_PUBLIC_*` env vars | `app.config.js` |
| Release scripts | None beyond `expo` CLI defaults; no CI | `package.json` `scripts`, no `.github/` |
| Native projects | **Neither `/android` nor `/ios` is committed** — CNG regenerates both at build time | `.gitignore:33-34` |

**Baseline health, run 2026-08-16:**

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean, exit 0 |
| `expo lint` | ✅ clean, no findings |
| `npm test` (`node --test`) | ✅ **141 tests / 36 suites, 0 failures** |
| `npx expo-doctor` | ⚠️ **20/21** — one failure: 10 packages behind the SDK-57 patch line (see I5) |

---

## 2. Consolidated release-readiness table

| # | Requirement | Apple | Android | Current state | Gap / action required | Type | Priority |
|---|---|---|---|---|---|---|---|
| B1 | **Privacy policy reachable inside the app** | ❌ | ❌ | **No privacy-policy link exists anywhere in the app.** Settings has Appearance / Notifications / Vendor / Account / About only (`SettingsList.tsx`) | Publish a policy on the `vendor` portal (external), then add a Legal row in Settings | Privacy + Code | **P0** |
| B2 | **Account-deletion route that actually deletes** | ⚠️ | ❌ | Settings shows a "Delete account" row, but `openAccountDeletion` opens the **portal root** — the deletion route does not exist (`useSettingsList.ts:47-49`) | Build the deletion route in `vendor` (external), then point the link at it | Privacy + Backend | **P0** |
| B3 | **`EXPO_PUBLIC_VENDOR_PORTAL_URL` set in the EAS `production` environment** | ❌ | ❌ | Unset ⇒ `hasPortal` false ⇒ the **Delete account, privacy and registration links all vanish** (`constants.ts:38`, `SettingsList.tsx`) | Set the variable on the EAS `production` environment before the release build | Configuration | **P0** |
| B4 | **Demo account for review** (Play App access; Apple 2.1 later) | ⏸ | ❌ | Not created. `STORE-SUBMISSION.md §5` specifies it; nothing exists | Create a seeded, `active`, `db reset`-proof vendor account on production | Backend + QA | **P0** |
| B5 | **Store listing assets** | 🌐⏸ | 🌐❌ | Binary assets done; **screenshots, descriptions, 512² icon, 1024×500 feature graphic all absent** | Prepare the **Play set** per §8; the Apple set is ⏸ PARKED with iOS | Store Metadata | **P0** |
| B6 | ~~Play Console production access (12 testers / 14 days)~~ | ➖ | ✅ | **✖ RESOLVED (D3) — organisation account, exempt.** No closed-testing gate | None | Developer Account | ✖ |
| B7 | **Apple Developer Program membership** | ⏸ | ➖ | No membership ⇒ **no iOS build has ever existed** (companion B9, `IOS-BUILD.md`) | **⏸ PARKED (D4)** — unblocks when enrolment is funded | Developer Account | ⏸ |
| I1 | Android target API 36 (from 2026-08-31) | ➖ | ✅ | targetSdk **36**, compileSdk 36, minSdk 24 — SDK 57 default, verified in the gradle plugin | None. Re-verify on the real merged manifest of the release AAB | Configuration | P1 (verify) |
| I2 | Apple Xcode 26 / iOS 26 SDK (from 2026-04-28) | ⏸ | ➖ | SDK 57 requires Xcode 26.4+; `eas.json` pins **no `image`** | **⏸ PARKED with iOS (D4).** When it unparks: confirm the EAS default is Xcode 26.x, or pin `"image": "latest"` | Configuration | ⏸ |
| I3 | **Push notifications end-to-end** | ⏸ (APNs half) | ❌ | Client **complete**; migration **written, unapplied**; Edge Function **written + unit-tested, undeployed**; FCM v1 key **not uploaded** | **In v1.0 scope (D2).** Apply migration → deploy function → Vault secret → FCM v1 → device test. **No mobile code.** Blocked on X1 | Backend | **P1** |
| X1 | `demo-seed.sql` leaves the push trigger armed | ➖ | ❌ | `demo/demo-seed.sql:67` disables the email dispatcher **by name**; the push trigger would survive and fire real dispatch per seeded notification | Mirror `seed.sql`'s `disable trigger user`. **Prerequisite of both I3 and B4** | Backend | **P1** |
| ~~I11~~ | ~~Push copy for a push-less v1.0~~ | ➖ | ➖ | **✖ ABORTED (2026-08-16)** — D2 reversed, so there is no push-less build to write copy for | None | Code | ✖ |
| I4 | Error boundary | ✅ | ✅ | **✅ DONE (2026-08-16)** — `AppErrorBoundary/` + `ErrorBoundary` export at `_layout.tsx:37`. Machine-verified; **catching a real crash still needs a device** | Device check in §7 | Code | ✅ |
| I5 | Dependency patch drift | ⚠️ | ⚠️ | 10 packages behind the SDK-57 patch line (`expo`, `expo-router`, `expo-notifications`, …) | `npx expo install --check` before the release build — approval gate | Code | P1 |
| I6 | In-progress UI plans unverified on device | ⚠️ | ⚠️ | 6 mobile plans sit at IN PROGRESS with device verification outstanding | Close or park each before a release build; run §7 QA | QA | P1 |
| I7 | `predictiveBackGestureEnabled: false` | ➖ | ⚠️ | Opt-out set (`app.json`). Still honoured at API 36, **removed at API 37** | Plan the migration; not a submission blocker today | Configuration | P2 |
| I8 | Version strategy | ⚠️ | ⚠️ | `0.8.0`; `appVersionSource: "remote"` + `autoIncrement: true` on production ✅ | Bump to `1.0.0` for the first submission | Configuration | P2 |
| I9 | Template assets still in `assets/images/` | ➖ | ➖ | **✅ DONE (2026-08-16)** — all 15 removed via `git rm`; `assets/` is now `brand/` only | None | Code | ✅ |
| I10 | No CI | ⚠️ | ⚠️ | **✅ DONE (2026-08-16)** — `.github/workflows/checks.yml`: tsc + lint + tests on Node 22, PR/push to develop/master. **Never yet run on GitHub** | Confirm green on the first PR | Code | ✅ |
| — | Bundle ID / package | ✅ | ✅ | `com.ezzy.vendormobile` on both; no template/temp identifier | None | Configuration | — |
| — | Android App Bundle | ➖ | ✅ | `production.android.buildType: "app-bundle"` (`eas.json`) | None | Configuration | — |
| — | Signing | 🌐 | 🌐 | EAS-managed credentials; **no keystore, `.p8`, `.p12` or `.mobileprovision` in the repo or its history** (verified via `git ls-files` + `git log --all`); `.gitignore:19-23` blocks them | External verification in the EAS/Play/ASC consoles | Security | — |
| — | Secrets hygiene | ✅ | ✅ | `.env` untracked, never committed; no `service_role`, JWT, or PEM material in tracked files | None | Security | — |
| — | App icon / adaptive icon / splash | ⚠️ | ✅ | iOS icon 1024² **RGB, no alpha** ✅; Android foreground + monochrome 1024² RGBA on `#034BFC` ✅; splash configured | iOS icon has **never been seen rendered** (no iOS build) | Store Metadata | P1 (verify) |
| — | Permissions minimalism | ✅ | ✅ | Only `INTERNET`, `VIBRATE`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`; storage perms explicitly blocked | Re-verify the **merged** manifest from the release AAB | Privacy | P1 (verify) |
| — | Privacy manifest (`PrivacyInfo.xcprivacy`) | ✅ | ➖ | `ios.privacyManifests` declares UserDefaults (CA92.1) + FileTimestamp (C617.1); **13 dependency manifests present** in `node_modules` including RN core and AsyncStorage | Confirm no App Store Connect ITMS privacy warning on first upload | Privacy | P1 (verify) |
| — | App Tracking Transparency | ✅ | ➖ | **No tracking SDK, no analytics, no crash reporter, no ad SDK.** No `NSUserTrackingUsageDescription` — correctly absent | Do **not** add ATT | Privacy | — |
| — | Export compliance | ✅ | ➖ | `ITSAppUsesNonExemptEncryption: false` — HTTPS + OS keychain only, no bundled crypto | None | Legal/Business | — |
| — | Sign in with Apple | ➖ | ➖ | Email/password only; **no social or third-party login** (`auth.service.ts`) — 4.8 not triggered | Do **not** add SIWA. Adding any social login makes it mandatory | Code | — |
| — | IAP / Play Billing | ➖ | ➖ | App **sells nothing**. Transactions screens display a payout ledger; no purchase link in the binary | None — see §9 | Legal/Business | — |
| — | Token storage | ✅ | ✅ | Session in `expo-secure-store` (Keychain / Android Keystore) behind a chunking adapter | None | Security | — |
| — | Cleartext / ATS | ✅ | ✅ | **No `http://`, `localhost`, `127.0.0.1` or `10.0.2.2` anywhere in `src/`**; no ATS exception, no `usesCleartextTraffic` | Verify the production Supabase URL is `https://` at build time | Security | P1 (verify) |
| — | Production logging | ✅ | ✅ | 7 `console.*` calls total; the 2 verbose ones are `__DEV__`-gated; the 5 warnings carry no PII (`realtimeLog.ts:10`) | None | Security | — |
| — | Financial data at rest | ✅ | ✅ | **No bank/GCash/Maya/account numbers anywhere in the app** — only aggregate amounts and payout *statuses* | None. Keep it that way | Security | — |
| — | Edge-to-edge (Android 16) | ➖ | ✅ | App is edge-to-edge with no opt-out; insets composed through `useBottomInset` | Device QA (§7) | Code | P1 (verify) |
| — | Age / content rating | 🌐 | 🌐 | Not answered | §8 | Store Metadata | P1 |
| — | Data safety / App Privacy declarations | 🌐 | 🌐 | Drafted in `STORE-SUBMISSION.md`; **not entered** | §5, §6 | Privacy | P1 |
| — | CI / release pipeline | ⚠️ | ⚠️ | None. `lint`/`test` exist as scripts; no workflow file | See I10 in §4 | Code | P2 |

---

## BLOCKERS

### B1 — No privacy policy is reachable from inside the app  ⬜ TODO
**File:** `src/components/settings/SettingsList/SettingsList.tsx` (whole file — no Legal section)
**Also:** `vendor/app/` contains exactly two pages (`page.tsx`, `ui-gallery/page.tsx`) — verified
by `find app -name page.tsx`. **The vendor product has no privacy-policy route at all.**

Both stores block submission on this. Apple requires a privacy-policy URL in App Store
Connect *and* an accessible link in the app; Google requires one in Play Console *and*,
under the User Data policy, inside the app.

**Fix approach — two parts, in order:**
1. **External (`vendor`, own plan):** publish a public, unauthenticated privacy-policy page.
   Content it must cover, derived from this codebase (§4 data audit): vendor account email;
   booker name / email / phone displayed as business data; booking and fulfilment records;
   transaction, fee and payout **amounts and statuses**; the Expo push token when
   notifications are enabled; a bounded on-device cache (dashboard stats, bookings list,
   first transactions page — `queryClient.ts:11-16`); session tokens in the OS keystore;
   **no analytics, no crash reporting, no advertising, no tracking, no third-party
   processors beyond Supabase and Expo push**; retention and the deletion route (B2);
   contact address.
**A hosted page opened in the browser satisfies this — confirmed 2026-08-16.** Neither store
requires the policy to be *rendered* inside the app; both require it to be **reachable from**
the app and reachable from the store console. So the mobile side is a link, not a screen, and
the page can live anywhere stable and public. Three conditions it must meet:
- **Publicly reachable with no login** — a reviewer must be able to open it cold.
- **Stable URL** — it goes into the Play Console listing as well, and the two must match.
- **Not a 404 or a redirect chain** — an unreachable policy URL is a documented Play rejection.

It does **not** have to live on the `vendor` portal. Any stable public host works. Putting it
on the portal is the recommendation only because that domain already exists, is already
trusted, and keeps the policy beside the deletion route (B2) — not because the stores require it.

2. **This app:** a `Legal` section in `SettingsList` — Privacy Policy, Terms of Service (if
   one exists), opened via `expo-web-browser` exactly as `openPortal` already does.
   **Component convention:** no new component. `SettingsList.tsx` gains rows in the existing
   `styles.card` shape; the URL derivation and the `openPrivacyPolicy` callback go in
   `useSettingsList.ts`; no new styles, so `SettingsList.styles.ts` is untouched. Render /
   hook / style separation is preserved by construction.

**Coupling:** ships with B2 and B3 — one Settings edit, one release.

---

### B2 — "Delete account" opens the portal root, not a deletion route  ⬜ TODO
**File:** `src/components/settings/SettingsList/useSettingsList.ts:47-49`

```ts
const openAccountDeletion = useCallback(() => {
  if (WEB_PORTAL_URL) WebBrowser.openBrowserAsync(WEB_PORTAL_URL)
}, [])
```

The code comment is honest about it ("That route does not exist yet (B6)"). A reviewer who
follows this link lands on the portal home page. Google requires a *valid* deletion URL in
the Data safety form and an in-app path to it; an invalid one is a documented rejection
reason.

**Does Apple 5.1.1(v) require *in-app* deletion here?** The guideline binds apps that
**support account creation**. This app does not — registration is web-only, and the sign-in
screen says so (`SignInForm.tsx`, `canRegister` branch). On the letter of the rule the
web-resource route is sufficient; in practice reviewers apply it broadly, and Google
requires the web resource regardless. **D1 resolved 2026-08-16: web-only.**

**Can deletion be implemented *and* accessed only on the web? — mostly yes, with one
recommendation to keep.** The *implementation* is web-only, full stop: no mobile deletion
flow, no mobile endpoint. On *access*, the two halves differ:

- **Play:** the deletion **web resource** is mandatory and its URL goes in the Data safety
  form. The additional *in-app* option is required only of apps that let users **create an
  account in-app** — this one does not, so Play is satisfied by the web resource alone.
- **Apple 5.1.1(v):** binds on the same condition, so also not strictly triggered.

**Recommendation: keep the in-app link anyway.** It already exists in `SettingsList.tsx`;
removing it is work, not savings. And the exemption rests on a reviewer agreeing that an app
which *advertises registration from its sign-in screen* (`SignInForm.tsx`, the `canRegister`
branch) does not "support account creation". That reading is correct on the letter, but it is
an argument, and losing it costs a rejection cycle. One line of code defuses it entirely.

**One constraint on the page itself:** it must be reachable and its purpose visible **without
being signed in** — a reviewer checks the URL cold. Requiring auth to *complete* deletion is
fine and expected; requiring auth to *find* it is a documented Play rejection.

**Fix approach:**
1. **External (`vendor`, own plan):** a deletion route that actually deletes — the auth
   user, and the vendor-scoped rows the policy promises — with identity confirmation, and
   with any accounting/regulatory retention exception stated in the policy (B1). Deactivation
   does not qualify.
2. **This app (D1):** point `openAccountDeletion` at that route and **drop the `hasPortal`
   gate for it** — the deletion and privacy URLs become fixed public constants, so B3 cannot
   configure the two compliance-critical links out of a production build.
   **Component convention:** URL derivation and the callback live in `useSettingsList.ts`;
   `SettingsList.tsx` stays a render layer; no style change.

---

### B3 — `EXPO_PUBLIC_VENDOR_PORTAL_URL` unset silently removes every legal link  ⬜ TODO
**File:** `src/lib/constants.ts:38`, consumed at `useSettingsList.ts:70` (`hasPortal`)

Every outbound link — registration, portal, **and account deletion** — is rendered only when
`hasPortal` is true. The design intent is sound (a dead link is worse than none), but it means
a production build made without this variable set on the EAS `production` environment ships
**with no deletion link at all**, which is a straight policy violation. EAS variables are
scoped per environment (`AGENTS.md`, `EAS-SETUP.md §4`), so a value set for `development`
is invisible here.

**Fix approach:** set the variable on the EAS `production` environment, and verify from the
built binary — not from `.env`. Consider making the deletion + privacy URLs unconditional
(D1), so the compliance-critical links cannot be configured away.

---

### B4 — No demo account for review  ⬜ TODO
**Requirement:** Google requires review resources under **App access** when content is
restricted, which a login wall is. (Apple Guideline 2.1 imposes the same thing and becomes
live when iOS unparks — the same account serves both.)

`STORE-SUBMISSION.md §5` already specifies the shape; nothing has been created.

**Fix approach (external, production Supabase):** a vendor-admin account whose vendor is
`active` (a `pending_activation` vendor lands on `blocked.tsx` and the reviewer sees nothing
else), with ≥3 `pending` bookings so approve *and* reject are both exercisable, ≥1 paid
booking so Transactions is not empty, and ≥1 notification. **It must survive a `db reset`** —
seed it or protect it.

### B4a — Where the demo credentials are recorded  ⬜ TODO

**Not in this repository. Not in any repository.** Committing a working production login
violates the root `AGENTS.md` red line on secrets in workspace files, and Play states plainly:
*"Only provide account credentials specifically used for testing and do not provide any
production user's credentials."*

| What | Where it lives |
|---|---|
| **The actual username + password** | **Play Console → Policy and programs → App content → App access → "+ Add new instructions".** This field *is* the canonical home — it is where reviewers read them from. (App Store Connect → App Review Information → Sign-In Information when iOS unparks.) |
| A second copy for the team | The team password manager. Nowhere else. |
| **What the account must contain, and how to reseed it** | **`STORE-SUBMISSION.md` in this repo** — it already carries the right pattern: a `<EMAIL> / <PASSWORD>` **placeholder**, never the value. Extend it with the seed/restore procedure and a pointer to where the real credentials are held. |

Play's standing conditions on these credentials, which drive the seeding requirement: they
must be **accessible at all times, reusable, valid regardless of reviewer location, and
maintained without error**. A demo account wiped by a `db reset` mid-review fails all four.
If the account ever needs 2FA, supply a login path that bypasses it — a one-time code a
reviewer cannot receive is an automatic rejection.

---

### B5 — Store listing assets do not exist  ⬜ TODO — 🌐
Binary assets are done and verified (`.plans/2026-07-30-vendor-mobile-brand-assets.md`).
Listing assets are not. **Live scope is the Play set only** (D4): short + full description,
512×512 store icon, 1024×500 feature graphic, phone screenshots. The iPhone 6.9"/6.5"
screenshot sets and the App Store copy are ⏸ PARKED with iOS. Detail in §8.

---

### ~~B6 — Play Console account type~~  ✖ RESOLVED (2026-08-16)
**D3: the Console account is an organisation.** Organisation accounts are exempt from the
12-tester / 14-day closed-testing requirement for production access. **The Android timeline
carries no wall-clock gate.** Kept in the record because companion plan B7 flagged it as an
unknown and this closes it.

**Why this mattered more than its size suggests.** Had the account been personal and created
after 2023-11-13, Play would keep the **Production track disabled** until a closed test had
run with **≥12 testers opted in continuously for 14 days**. That is calendar time, not effort
— it cannot be compressed by working harder, it needs 12 real humans who install and stay
opted in, and a drop below the threshold restarts the clock. It would have had to start
*before* any of the actual blockers were fixed, purely to run in parallel, and it would have
set the floor on the release date regardless of how fast B1–B5 were cleared.

With the exemption, **the Production track is available as soon as the App content
requirements are satisfied.** The Android release date is now bounded only by the work in this
plan, which is the difference between an estimable schedule and an unestimable one.

Still owed on the account, and unaffected by the exemption: verified developer identity,
organisation details (including D-U-N-S where Play asks for it), and public developer
contact details — see §8.

---

### B7 — No Apple Developer Program membership ⇒ zero iOS verification  ⏸ PARKED (2026-08-16)
**Reason (D4):** enrolment is not being funded now, so iOS executes as nothing at all.
**Unblock condition:** an active Apple Developer Program membership. Everything below is
the standing debt that becomes live the moment it exists — it is recorded, not scheduled.

Companion plan B9. App Store Expo Go cannot open an SDK 57 project, so there is no path to
running this app on iOS without a paid membership. Consequences that are *audit findings*,
not speculation:
- The iOS icon has never been rendered (asserted 1024² alpha-free — confirmed by `file`, not by eye).
- No safe-area, Dynamic Island, keyboard, modal-dismissal or back-navigation behaviour has
  ever been observed on iOS.
- APNs credentials cannot be produced, so iOS push cannot exist.
- The Xcode-26 build path (I2) has never been exercised.

Procedure in `IOS-BUILD.md`.

---

## IMPORTANT

### I1 — Android target API 36  ✅ COMPLIANT (2026-08-16) — verify at build
Google requires **API 36+ for new apps and updates from 2026-08-31** (extension to
2026-11-01 available on request). Verified in
`node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle:65-69`:
`compileSdkVersion 36`, `targetSdkVersion 36`, `minSdkVersion 24`. No `expo-build-properties`
pin is needed. **Machine-verified from the resolved dependency, not the merged AAB manifest** —
confirm on the actual bundle before submission.

### I2 — Xcode 26 / iOS 26 SDK  ⚠️ NEEDS VERIFICATION
Apple has required Xcode 26 + the iOS 26 SDK for App Store Connect uploads **since
2026-04-28**. Expo SDK 57 states Xcode 26.4+, and EAS defaults SDK-54-and-newer projects to
an Xcode 26 image. `eas.json` pins no `image`, so this rests on the EAS default.
**Fix approach:** either confirm the resolved image on the first production iOS build, or pin
`"image": "latest"` on `build.production.ios` so the SDK floor is explicit rather than inherited.

### I3 — Push is code-complete but not deployed  ⬜ TODO — **in v1.0 scope (D2, reversed 2026-08-16)**
**Android half is live work. The APNs half stays ⏸ PARKED with B7** (no Apple membership ⇒
no APNs key can exist). Shipping push on Android alone is coherent: the client is
platform-agnostic and `push.service.ts` already records `platform` per token.

**Blocked on X1** — do not apply the migration until `demo-seed.sql` is fixed.

**Lift, sized properly on 2026-08-16 — this plan initially understated how much exists.**
**Remaining code: approximately none.** Verified by reading all of it:

| Piece | State |
|---|---|
| Mobile client | ✅ Complete — `push.service.ts`, `usePushRegistration`, `PushProvider`, lazy `pushModule`, tap-to-route in `lib/notifications.ts`, `PushPermissionCard` |
| Migration `20260728000001_device_push_tokens.sql` | ✅ Complete — 2 tables, RLS in all four directions, **table GRANTs included**, a per-portal kill switch, and an async `pg_net` trigger modelled on the existing email dispatcher. No-ops when Vault is unconfigured |
| Edge Function `send-push-notification` | ✅ Complete — 394 lines across 8 files, repo/sender split, **100-message batching**, `DeviceNotRegistered` dead-token cleanup, **unit tests** (`handler.test.ts`) |

**So the work is deployment, credentials and device testing — not building a feature:**
1. Apply the migration to staging, then production (**your call, not mine** — migrations are
   never applied from here). Cross-app approval gate: the table is shared with booker-mobile.
2. Fix **X1 below first** — the migration silently breaks a guarantee in `demo-seed.sql`.
3. Deploy the Edge Function; set the `notification_push_secret` Vault secret. **Order matters:**
   apply the migration *before* setting the secret. `is_push_enabled` defaults to `true` for
   every portal, so the Vault secret is the real on-switch — the trigger no-ops without it.
4. Upload an **FCM v1 service-account key** to EAS (Android only; APNs is parked with B7).
5. Build a dev client and test on a **physical Android device** — Expo Go cannot do push since
   SDK 53. Verify: token registers · background delivery · tap-to-route · sign-out
   unregisters · dead-token cleanup.
6. Add the Data safety device-identifier row (§6) before submitting.

Realistically one to two focused sessions plus your migration runs — **most of it verification,
almost none of it authoring.** The risk is not "will the code work"; it is that a trigger on
`notifications` fires for **every portal**, so the blast radius is the whole platform, not this app.

**Blast radius of applying the migration** (§8 of the plan-authoring skill — assess before approving):

| Axis | Assessment |
|---|---|
| **Data** | Additive only. Two new tables; no existing row is read, rewritten or validated. `insert into notification_push_settings select name from portals` writes one row per portal. **Nothing can fail on existing data.** |
| **Lock / performance** | `create table` + `create index` on empty tables — negligible. The `after insert` trigger on `notifications` adds two indexed single-row selects per insert, then an **async** `net.http_post` that does not block the transaction. |
| **Downstream** | `notifications` gains a trigger that fires for **every portal**, not just vendor — the real blast radius. `booker` and `command` also insert notifications. Mitigated three ways: the per-portal kill switch, the Vault no-op, and booker-mobile being scaffold-only so no booker tokens exist. **X1 is the one unmitigated path.** Also: hand-written types — `device_push_tokens` is already typed in the mobile client; no other app needs a type update since none reads these tables. |
| **Reversibility** | Clean. `drop trigger notifications_dispatch_push on public.notifications;` stops all dispatch instantly; dropping the two tables reverses the rest. **Faster kill switch, no deploy:** `update notification_push_settings set is_push_enabled = false;`, or delete the `notification_push_secret` Vault secret. |

**Approval gate — two of them, and they are separate.** (1) Applying the migration is a schema
change touching a shared table used by three apps. (2) X1 edits `backbone` seed tooling.
Neither is done from here; both need your explicit go.

#### Cross-app impact of arming the trigger — enumerated, not assumed (2026-08-16)

The trigger is `after insert on public.notifications`, and **three web apps insert into that
table directly**, in addition to the DB's own booking triggers:

| Insert path | App | What it notifies |
|---|---|---|
| `vendor/app/api/auth/register/route.ts:266,302` | `vendor` | vendor registration → command admins |
| `booker/app/api/register/route.ts:97` | `booker` | booker registration |
| `booker/app/api/payment/webhook/route.ts:80` | `booker` | **payment received** — the highest-frequency path |
| `command/services/kyc-admin.service.ts:145` | `command` | KYC decision |
| `bookings_notify_new` / `_status_change` / fulfilment triggers | DB | booking lifecycle |

**What this costs the three web apps: nothing in code, and nothing at runtime.**
- **No code change in any web app.** The trigger is entirely DB-side.
- **No added latency.** `net.http_post` is async via `pg_net` and fires *after* the inserting
  transaction commits — the same mechanism the email dispatcher has used since June.
- **No new failure mode.** A dispatch failure cannot roll back or slow the notification
  insert; in-app notifications stay primary. The migration is explicit about this.
- **The real change is volume:** it roughly doubles the existing async dispatch load, since
  every notification that already triggers an email now also triggers a push attempt.

**And most attempts will deliver nothing, by construction.** The Edge Function looks up rows in
`device_push_tokens` for the target user. **Only `ezzy-vendor-mobile` writes that table today** —
booker-mobile is scaffold-only and `command` has no mobile client. No token ⇒ no send.

#### ✖ WITHDRAWN — "narrow the portals before first apply" (2026-08-16)

An earlier revision of this plan recommended running, before the first production apply:

```sql
update public.notification_push_settings set is_push_enabled = false where portal <> 'vendor';
```

**That recommendation does not survive reading the Edge Function, and is withdrawn.** It was
written on the worry that a booker- or command-portal notification could reach a vendor-mobile
install belonging to the same person. **`lib/tokenRepo.ts:16-25` already prevents exactly that**,
and its comment names the scenario outright — *"a person who is both a vendor admin and a booker
has a row per app, and a vendor notification must not land on their booker install"*:

```ts
.eq("user_id", userId)
.eq("portal", portal)
```

With dispatch scoped by portal **and** by token, a portal with no registered installs cannot
deliver anything regardless of its `is_push_enabled` value. The `UPDATE` would therefore have
bought one avoided `net.http_post` per booker/command notification — **no correctness or safety
benefit at all**, at the cost of a manual production step and a piece of state someone has to
remember to reverse when booker-mobile ships.

**Corrected understanding: `device_push_tokens` is the real gate; `notification_push_settings`
is not.** The kill switch exists to *stop delivery that is happening*, not to prevent delivery
that cannot happen. The migration's default of all-portals-enabled is therefore correct as
written, and **no narrowing step is needed on staging or production.**

If an explicit off-by-default posture is ever wanted for booker, it belongs in the
booker-mobile plan at the point tokens start being written — not as a pre-emptive manual step
here.

### X1 — Applying the push migration silently breaks `demo-seed.sql`  ⬜ TODO — `backbone` — **now on the critical path**
**File:** `backbone/supabase/demo/demo-seed.sql:67` and `:381`

`seed.sql` is safe: line 713 uses `alter table public.notifications disable trigger user`,
which covers **all** user triggers, and its comment already anticipates this migration by name.

`demo-seed.sql` does **not**. It disables one trigger by name:

```sql
alter table public.notifications disable trigger notifications_dispatch_email;
```

Its own comment states the intent — *"belt and braces: if any other path creates a
notification during this run, it still cannot post"* — but enumerating a single trigger cannot
deliver that, and `notifications_dispatch_push` would be left armed. Seeding demo data would
fire a real push dispatch per notification insert.

**This collides directly with B4**, which needs a seeded demo account with bookings and
notifications. Whichever of the two lands first, the other is affected.

**Fix approach:** mirror `seed.sql` — `disable trigger user` / `enable trigger user` — so any
future dispatcher is covered without another edit. **`backbone` work, out of this plan's
implementation scope; recorded as a prerequisite of both I3 and B4.**

**Is a blanket `disable trigger user` safe here? Verified yes (2026-08-16).**
The obvious objection to widening the disable is that it might suppress something the seed
*needs*. Enumerated every trigger in `backbone/supabase/migrations/`: `public.notifications`
carries **exactly two**, both `after insert` dispatchers —
`notifications_dispatch_email` (`20260624000003:75`) and `notifications_dispatch_push`
(`20260728000001:206`). There is no `updated_at` trigger, no audit trigger, nothing else to
catch. `bookings_notify_new` and `bookings_notify_status_change` are on `public.bookings` and
are disabled separately, unchanged by this fix. **The widened disable is exactly equivalent to
naming both dispatchers, with the future-proofing `seed.sql` already has.**

**Why this matters more than a local seed script would.** `demo-seed.sql` is explicitly
**additive, tagged, reversible and safe to run against a hosted instance** (its own header),
attaching demo data to a **real vendor you can sign in as**. So the unfixed version is not a
local-only annoyance: run against production to build the B4 demo account, any notification
created during the run would dispatch **real push to real vendor admins' devices**.

`src/services/push.service.ts` is complete and correct; `usePushRegistration` reports
`unavailable` because the write target does not exist. Outstanding (all external, all parked):
`backbone/supabase/migrations/20260728000001_device_push_tokens.sql` **written, unapplied**;
`backbone/supabase/functions/send-push-notification` **written, undeployed**; FCM v1 service
account and APNs key **not uploaded to EAS**. Also required: the iOS APNs entitlement must be
`production` for the store build — the default is `development`, the classic
"works in TestFlight, dead in production" trap.

**Already correct, do not rebuild when it unparks:** the Android `bookings` channel is created
*before* the permission prompt (`push.service.ts:24-38`), and permission is requested **in
context** on the Alerts screen, never on launch (`PushPermissionCard.tsx:9-12`).

### ~~I11 — Settings and Alerts still offer push in a build that has none~~  ✖ ABORTED (2026-08-16)
**Reason:** **D2 was reversed** — push ships in v1.0, so there is no push-less build whose copy
needs softening. Writing "background notifications are coming", then reverting it weeks later,
would have been two edits to reach the state v1.0 now ships in.

**Record kept because it names a real trap for any future deferral.** The existing
`PUSH_LABELS` strings (`SettingsList.tsx:15-22`) and the `unavailable` card body were written
to describe a *development* gap — "Not ready yet", "the server isn't accepting registrations
yet". They are correct in a dev build and wrong in a shipped one. **If push is ever cut from a
release again, this item comes back.**

**Live consequence for I3's device testing:** those same strings are what a tester sees when
push registration fails, so during Stage 4 verification, `unavailable` appearing in Settings is
the signal that the migration or the Edge Function is not working — not a UI bug.

### I4 — No error boundary anywhere in the tree  ✅ DONE (2026-08-16)
**Executed:** new `src/components/common/AppErrorBoundary/` (`.tsx` + `useAppErrorBoundary.ts`
+ `.styles.ts`), re-exported as `ErrorBoundary` from `src/app/_layout.tsx:37`.
**Verified (machine):** `tsc --noEmit` exit 0 · `expo lint` clean · `npm test` 141/141 ·
`npx expo export --platform android` succeeded, proving the route tree still builds with the
export in place. Confirmed no other route exports `ErrorBoundary`, so coverage is a single
boundary rather than a fragmented set.
**NOT verified (needs a device):** that it actually catches a real render crash and that
`retry()` recovers. Force a throw in a list row on hardware — §7 QA.

**⚠️ The fix approach originally written in this plan would have produced a broken
implementation.** It specified `AppErrorBoundary.styles.ts` exporting `makeStyles(tokens)`,
following `ConfigErrorScreen`. That is impossible here, and the reason is worth keeping:

- expo-router's `Try` wraps **outside** the route component
  (`expo-router/build/useScreens.js:141-155` → `Try > component.default`), so when the
  boundary renders, `app/_layout.tsx` and therefore **`AppThemeProvider` are not mounted**.
- `useAppTheme()` **throws** without its provider (`theme/useAppTheme.ts:19`). Calling it in
  the boundary would throw *while rendering the error*, unmounting the whole tree —
  **strictly worse than having no boundary at all.**
- Same trap, second instance: `useSafeAreaInsets()` also throws without `SafeAreaProvider`
  (`SafeAreaContext.tsx:150-152`). `SafeAreaView` is safe — it is a pure native component
  with no context dependency (`SafeAreaView.tsx`), so that is what the component uses.
- `PrimaryButton` calls `useAppTheme()` too, so it could not be reused.

**Resolution:** the component is self-contained with a static palette — `darkTokens` values
verbatim plus the `app.json` splash background, so it reads as a continuation of the launch
surface. The deviation from `makeStyles(tokens)` is documented at the top of the styles file.
The usual argument for the factory (a singleton freezes one theme at import time) is exactly
the desired behaviour here, because there is no theme to read.

**Also confirmed while investigating:** expo-router installs **no default boundary in
production** — `useScreens.js:146` wraps a route only `if (ErrorBoundary)` is exported. This
corroborates AGENTS.md's account of the `NotificationListItem` crash killing the screen.
And `Try.getDerivedStateFromError` already calls `SplashScreen.hideAsync()`, so unlike
`ConfigErrorScreen` this component needs no splash handling — that logic was not duplicated.

<!-- superseded fix approach, kept for the record: -->
**File:** `src/app/_layout.tsx` (absent)

This is not theoretical. `AGENTS.md` records that `NotificationListItem` destructured an
exhaustive `Record<Union, …>` and four new fulfilment notification types **crashed the whole
Notifications screen**, because the database can emit a value newer than an installed binary.
Both stores treat a crash in a core flow as a rejection.

**Fix approach:** export an `ErrorBoundary` from `src/app/_layout.tsx` (expo-router's
supported hook) rendering a recover-and-retry screen.
**Component convention:** new `components/common/AppErrorBoundary/` — `.tsx` render layer,
`useAppErrorBoundary.ts` for the reset handler, `AppErrorBoundary.styles.ts` exporting
`makeStyles(tokens)`. Follows `ConfigErrorScreen/`, which is the app's reference example.

### I5 — 10 dependencies behind the SDK-57 patch line  ⬜ TODO
`expo-doctor` 20/21. All are **patch** drift inside SDK 57 (`expo` 57.0.9→57.0.13,
`expo-router` 57.0.9→57.0.13, `expo-notifications` 57.0.8→57.0.11, …). **Category: required
for build compatibility**, not a compliance blocker. No deprecated, abandoned, or
permission-adding packages found; every dependency is a current Expo/RN-ecosystem package.

**Fix approach:** `npx expo install --check` from inside the app folder, then re-run
`tsc` + `expo lint` + `npm test` + a device smoke pass. Dependency changes are an approval gate.

### I6 — Six mobile plans sit IN PROGRESS with device verification outstanding  ⬜ TODO
`2026-08-05-scroll-header-and-fee` (stage 1 of 5 coded, unverified), `2026-08-11-unbounded-queries`,
`2026-08-14-dashboard-range-and-drilldown`, `2026-08-15-dashboard-parity-guide-and-insets`,
`2026-08-02-fulfilment-sync`, `2026-08-02-hidden-action-bar`. A release cut across half-verified
UI work is exactly the "substantially broken functionality" both stores reject on.
**Fix approach:** close or explicitly ⏸ PARK each before cutting a release build; then run §7.

### I7 — Predictive-back opt-out  ⬜ TODO (P2)
`app.json` sets `predictiveBackGestureEnabled: false` → `android:enableOnBackInvokedCallback="false"`.
At API 36 this opt-out is still honoured, so it is **not** a submission blocker. Android
documents it as temporary and it will not apply at API 37. Track it; do not fix it in this release.

### I8 — Version numbers  ⬜ TODO (P2)
`package.json` is the single source of truth and flows to `expo.version` via `app.config.js`
(`app.config.js:20-27`) — good. `eas.json` has `appVersionSource: "remote"` +
`autoIncrement: true` on production, so `buildNumber` / `versionCode` increment reliably on
EAS. **Action:** `npm version 1.0.0` before the first submission; `0.8.0` reads as pre-release.

### I9 — Dead template assets  ✅ DONE (2026-08-16)
**Executed:** removed all 15 files under `assets/images/` (`react-logo*`, `expo-badge*`,
`expo-logo`, `tutorial-web`, `logo-glow`, `favicon`, `tabIcons/`). `assets/` now contains
only `brand/`.

**Removed with `git rm`, not `rm`.** `trash` is not installed in this environment, and the
repo preference is "recoverable beats permanent" — all 15 were git-tracked (`git ls-files`,
0 untracked), so `git rm` keeps them fully recoverable from history, satisfying the intent.

**Verified (machine) before deleting:** the only asset `require()` in the entire app is
`@/assets/brand/mark-white.png` (`BrandMark.tsx:28`). An initial basename grep appeared to
show `home*.png` referenced in four files — **false positive**: those matched the prose
"home screen" and "home-indicator", not the asset. Re-checked by path reference instead.
Also confirmed `scripts/generate-brand-assets.js` reads only from `assets/brand/`
(`:90-99`), so nothing it needs was touched.
**Verified (machine) after:** `tsc` · `expo lint` · `npm test` · `expo export` all clean, and
the exported bundle contains no reference to any removed asset.

### I10 — No CI  ✅ DONE (2026-08-16)
**Executed:** added `.github/workflows/checks.yml` — one job on PR to and push on
`develop` / `master`, running `tsc --noEmit`, `expo lint` and `npm test` on Node 22
(required: `npm test` uses `--experimental-strip-types`). `npm ci` off the committed
lockfile; npm cache enabled; `concurrency` cancels superseded runs; each check uses
`if: ${{ !cancelled() }}` so one run reports every failure rather than only the first.

**Deliberately does not build a binary.** EAS already owns builds, credential injection and
version increment (`eas.json`); a second build system here would be weaker and divergent.
The workflow header records that, and records that a green run means "no regression in the
checks we have", never "verified" — the four style passes in AGENTS.md all passed these same
checks and did nothing on screen.

**Verified (machine):** all three commands run clean locally on Node 22.17.0 — the exact
commands the workflow invokes.
**NOT verified:** the workflow has never executed on GitHub. It runs on the first push to a
PR against `develop`/`master`; the current branch is `feature/publish_readiness_part_1`.

---

## 3. Permissions audit

| Permission | Platform | Where used | Necessary? | User-facing explanation | Action |
|---|---|---|---|---|---|
| `INTERNET` | Android | All Supabase traffic | Yes | n/a (no prompt) | Keep |
| `VIBRATE` | Android | `expo-haptics` on approve/reject; notification vibration pattern (`push.service.ts:33`) | Yes | n/a (no prompt) | Keep |
| `POST_NOTIFICATIONS` | Android 13+ | Booking alerts | Yes | Requested in context on the Alerts screen | Keep |
| `RECEIVE_BOOT_COMPLETED` | Android | `expo-notifications` — restores scheduled notifications after reboot | Yes (transitive) | n/a | Keep |
| `READ_EXTERNAL_STORAGE` | Android | Transitive from `expo-file-system` | **No** | n/a | ✅ Already blocked (`app.json` `android.blockedPermissions`) |
| `WRITE_EXTERNAL_STORAGE` | Android | Transitive from `expo-file-system` | **No** | n/a | ✅ Already blocked |
| `SYSTEM_ALERT_WINDOW` | Android | RN **debug** manifest (dev menu overlay) | No | n/a | ✅ Debug variant only — confirm absent from the release AAB |
| Notifications | iOS | Booking alerts | Yes | In-context card on Alerts | Keep |
| Camera / Photos / Microphone / Location / Contacts / Calendar / Bluetooth / Biometrics / Tracking | both | **Not requested** | — | — | ✅ None declared, none needed |

**Restricted / sensitive Play permissions:** none requested. No background location, SMS,
call log, contacts, exact alarms, accessibility service, all-files access, package
visibility, or declared foreground service types. **No Play Console permission declaration
form is owed.** KYC and document upload staying on the web is a genuine compliance asset —
it keeps camera, photo-library and file permissions out of the binary entirely.

**⚠️ One caveat carried forward from `STORE-SUBMISSION.md §2`:** the earlier check read the
**app-level** manifest from `expo prebuild`, not the fully merged one. Library manifests
merge during Gradle. **Re-read the merged `AndroidManifest.xml` from the release AAB** — and
re-run this table after every dependency addition. Two unused storage permissions arrived
unbidden once already.

---

## 4. Data-collection audit (source of §5 and §6)

Established by reading `src/services/*` and the dependency set.

| Data | Collected by the app | Where | Notes |
|---|---|---|---|
| Vendor account email | Yes | `auth.service.ts` sign-in / reset | Supabase Auth |
| Password | Yes, transit only | `signIn`, `updatePassword` | Never persisted client-side |
| Session tokens (JWT) | Yes | `secureStorageAdapter.ts` | **OS keystore**, chunked; not AsyncStorage |
| Booker name / email / phone | Yes — **other people's PII** | `bookings.service.getBookerContactsFor` | Displayed to the vendor as business data. **Both stores count this as collection** |
| Booking + fulfilment records | Yes | `bookings.service.ts` | — |
| Vendor / business identity | Yes | `vendor.service.ts` | — |
| Transaction, fee, payout **amounts and statuses** | Yes | `transactions.service.ts`, `financials.ts` | **Financial info — a sensitive category on Play** |
| Bank / GCash / Maya / account numbers | **No** | — | **Verified absent** from the entire app by grep. Payout *methods* live on the web only |
| Expo push token | Yes, optional | `push.service.ts` | Counts as a **device identifier** on both stores |
| Device name | Yes, optional | `push.service.ts` `Device.deviceName` | Stored alongside the push token |
| Cached data at rest | Yes, bounded | `queryClient.ts:11-16` | Dashboard stats, bookings list, first transactions page only; 24h max age; purged on sign-out and vendor switch (`purgePersistedCache`) |
| Location / photos / camera / files / contacts | **No** | — | No such API is called |
| Analytics | **No** | — | No SDK present |
| Crash reporting | **No** | — | No Sentry, no Firebase Crashlytics |
| Advertising / tracking | **No** | — | No ad or attribution SDK |

**Full third-party SDK inventory** (`package.json`, 34 runtime dependencies): Expo modules,
React Native core, `@supabase/supabase-js`, `@tanstack/*`, `@shopify/flash-list`,
`lucide-react-native`, `react-native-{gesture-handler,reanimated,safe-area-context,screens,svg,url-polyfill,web,worklets}`,
`@expo-google-fonts/inter`. **No Firebase, Sentry, Meta/Facebook, analytics, ads, maps or
payment SDK.** The only data leaving the device goes to **Supabase** (the shared project) and,
when push is enabled, **Expo's push service**.

**Cached PII note:** the persisted TanStack cache lives in **plain AsyncStorage**, and the
bookings page it holds contains booker names. This is a deliberate, documented trade
(`queryClient.ts:11-16`) with three real mitigations: the key set is allow-listed, the max
age is 24h, and it is purged on sign-out and vendor switch. **Assessment: acceptable, not a
blocker** — it is cached reads, not credentials, and the credentials are correctly in the
keystore. Recorded here so the Data safety answer ("data is encrypted in transit"; at-rest
caching disclosed in the policy) is accurate.

---

## 5. Proposed Apple App Privacy declaration — ⏸ PARKED with iOS (D4)

Kept because it is the same underlying data audit as §6 and will be needed unchanged when
iOS unparks. **The table below is accurate as written** — D2's reversal means the
*Identifiers / Device ID* row is collected from v1.0, matching §6.

All entries **Linked to the user**; **none used for tracking**; no `NSPrivacyTracking`.

| Apple category | Data type | Collected | Linked | Tracking | Purpose | Confidence |
|---|---|---|---|---|---|---|
| Contact Info | Email address | Yes | Yes | No | App Functionality (authentication) | ✅ from code |
| Contact Info | Name | Yes | Yes | No | App Functionality (booker shown on bookings) | ✅ from code |
| Contact Info | Phone number | Yes | Yes | No | App Functionality (vendor contacts booker) | ✅ from code |
| Financial Info | Purchase History | Yes | Yes | No | App Functionality (payout / fee ledger) | ✅ from code |
| Identifiers | Device ID | Yes (only when push enabled) | Yes | No | App Functionality (booking notifications) | ✅ from code |
| Usage Data / Diagnostics | — | **No** | — | — | — | ✅ no analytics or crash SDK |
| Location / Contacts / Photos / Health / Browsing | — | **No** | — | — | — | ✅ no API called |

**⚠️ Needs business confirmation:** whether Supabase, as processor, does anything Apple would
class as third-party collection beyond hosting; and whether "Other Financial Info" is the more
accurate category than "Purchase History" for a *payout* ledger the vendor receives rather than
a purchase they make. Both are declaration-wording questions, not code questions.

---

## 6. Proposed Google Play Data safety declaration

| Data type | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Email address | Yes | No | Required | Account management, App functionality |
| Name | Yes | No | Required | App functionality |
| Phone number | Yes | No | Required | App functionality |
| **Purchase history** (financial) | Yes | No | Required | App functionality |
| Device or other IDs (push token) | **Yes** — push ships in v1.0 (D2) | No | **Optional** — only when the vendor enables notifications | App functionality |
| Crash logs / diagnostics / analytics | **No** | — | — | — |
| Location / Photos / Files / Contacts | **No** | — | — | — |

**Security practices:** encrypted in transit — **yes** (HTTPS to Supabase throughout; no
cleartext exception anywhere in the config). **Users can request data deletion — yes**, via
the web resource, **which requires B2 to exist and its URL to be entered in the Data safety
form.** Data-deletion questions in the form are mandatory.

**⚠️ Needs backend confirmation:** what the deletion route actually deletes versus retains,
and any accounting/regulatory retention exception. The Data safety answer and the privacy
policy must say the same thing.

---

## 7. Release QA checklist — run per platform, on hardware

**For this release, only the Android column is live** (D4). The iOS column is ⏸ PARKED and
kept as the checklist for when enrolment happens — **do not tick it from inference.**
Journeys marked ❓ do not exist and should be answered "not applicable", not tested.

| Journey | Exists | Android | iOS |
|---|---|---|---|
| Cold launch → splash → session restore | ✅ `_layout.tsx` | ⬜ | ⬜ |
| Launch with missing config → `ConfigErrorScreen` | ✅ | ⬜ | ⬜ |
| Sign in (valid / invalid / keyboard over field) | ✅ | ⬜ | ⬜ |
| Registration in-app | **❓ web only** | ➖ | ➖ |
| Forgot password → email → **deep link** → reset (PKCE, same device) | ✅ | ⬜ | ⬜ |
| Reset link opened on a *different* device (expected failure path) | ✅ | ⬜ | ⬜ |
| Sign out → push token dropped → cache purged | ✅ | ⬜ | ⬜ |
| Blocked / `pending_activation` vendor → `blocked.tsx` with a way forward | ✅ | ⬜ | ⬜ |
| Multi-vendor picker + switch vendor | ✅ | ⬜ | ⬜ |
| Dashboard stats + range drilldown | ✅ (plan IN PROGRESS — I6) | ⬜ | ⬜ |
| Bookings list, six lifecycle filters, badges, search | ✅ | ⬜ | ⬜ |
| Approve / reject / hand over / mark done / got it back / undo / flag | ✅ | ⬜ | ⬜ |
| Stale-status action rejected by the DB → soft failure, not a crash | ✅ | ⬜ | ⬜ |
| Booking detail | ✅ | ⬜ | ⬜ |
| Offerings / Schedules / Staff management | **❓ web only** | ➖ | ➖ |
| Transactions list, period filter, summary cards, infinite scroll | ✅ | ⬜ | ⬜ |
| Payout **details / bank / GCash** entry | **❓ web only — by design** | ➖ | ➖ |
| Notifications list, unread badge, swipe actions, Realtime arrival | ✅ | ⬜ | ⬜ |
| **Unknown notification type from a newer DB (I4 regression)** | ✅ | ⬜ | ⬜ |
| **Push: in-context prompt → token row written → background delivery → tap-to-route** | ✅ in v1.0 (D2) | ⬜ | ➖ |
| **Push: sign-out deletes the token row** (`useSettingsList.ts:28-36`) | ✅ | ⬜ | ➖ |
| **Push: `DeviceNotRegistered` dead-token cleanup after uninstall** | ✅ | ⬜ | ➖ |
| **Push: notification content on the lock screen respects `PRIVATE` visibility** | ✅ | ⬜ | ➖ |
| **Push kill switch: `is_push_enabled = false` stops delivery** | ✅ | ⬜ | ➖ |
| Settings: theme light/dark/system, version, portal link, **privacy, delete account** | 🔄 blocked on B1/B2 | ⬜ | ⬜ |
| Getting-started guide | ✅ | ⬜ | ⬜ |
| Offline cold open (cached view + `StaleBanner`) | ✅ | ⬜ | ⬜ |
| Server error vs session expired vs offline — **visually distinguishable** | ✅ | ⬜ | ⬜ |
| Backgrounded for hours → foreground refetch, token refresh (`startAuthAutoRefresh`) | ✅ | ⬜ | ⬜ |
| **Android:** hardware Back, gesture Back, edge-to-edge insets, nav bar not covering the action row or Settings rows, keyboard | ✅ | ⬜ | ➖ |
| **iOS:** safe areas, home indicator, Dynamic Island, keyboard avoidance, modal dismissal, swipe-back, status-bar contrast in both themes | ✅ | ➖ | ⬜ |
| **Both:** largest OS font size on every screen; VoiceOver + TalkBack pass on booking actions | ✅ | ⬜ | ⬜ |
| Portrait lock ignored on ≥600dp displays (API 36 behaviour) | ✅ | ⬜ | ➖ |

**Accessibility posture — what can honestly be claimed.** 55 `accessibilityRole` and 27
`accessibilityLabel` usages; icon-only controls carry labels (e.g. the password toggle,
`SignInForm.tsx:60-64`); error banners use `accessibilityRole="alert"`; the tab badge has a
spoken label; the theme selector is a proper `radiogroup`/`radio`; **no `allowFontScaling={false}`
anywhere**, so Dynamic Type works. **Not yet verified:** touch-target sizes ≥44×44pt across
the board, colour contrast in both themes, and an actual screen-reader pass. Apple now
surfaces accessibility in App Store metadata — **claim only what the pass above confirms.**

---

## 8. Store metadata and asset preparation — 🌐 external

**Live scope is Google Play only** (D4). The Apple subsection is kept as parked debt.

**Both stores.** App name "Ezzy Vendor"; category **Business**; support URL + support email;
privacy-policy URL (B1); age/content rating; review/demo credentials (B4).

**Apple (App Store Connect) — ⏸ PARKED with iOS:** subtitle, description, keywords, copyright, promotional text,
**age rating under the 2026 questionnaire** (13+/16+/18+ now exist alongside 4+/9+; responses
become mandatory for new submissions from September 2026 — expect questions on in-app
controls, capabilities, medical/wellness and violent themes; this app should answer "none" to
essentially all of them), App Review contact, and the review notes drafted in
`STORE-SUBMISSION.md §4` — **update those notes** once push actually works.
**Screenshots: iPhone 6.9" and 6.5". No iPad set is owed** (`ios.supportsTablet: false`).

**Google (Play Console) — how assets are actually submitted.** Everything below goes in
**through the Play Console web UI**, not through EAS. Worth stating explicitly because
`eas.json` already carries a `submit` block: **`eas submit` uploads the binary (the AAB) and
nothing else.** Listing assets, descriptions and every declaration are a separate, manual,
browser-based step, and the release cannot go live until they are complete.

Two Console locations:

- **Grow → Store presence → Main store listing** — app name, short description, full
  description, and every graphic asset. Specs verified 2026-08-16:

  | Asset | Spec |
  |---|---|
  | Short description | **80 characters** max |
  | App icon | **512 × 512**, 32-bit PNG **with** alpha, ≤1024 KB |
  | Feature graphic | **1024 × 500**, JPEG or 24-bit PNG, **no** alpha |
  | Phone screenshots | JPEG or 24-bit PNG, no alpha. **Minimum two to publish**; **≥4 at ≥1080px recommended** for visibility across Play surfaces. Portrait 9:16, min 1080 × 1920. Min dimension 320px, max 3840px, and the long side may not exceed **twice** the short side |

  Note the alpha rule differs per asset — icon **with** alpha, feature graphic and screenshots
  **without**. Icon and feature graphic are derivable from `assets/brand/_master.png`
  (2048², RGBA) via `scripts/generate-brand-assets.js`; screenshots come off a device
  (capture plan below).

- **Policy and programs → App content** — content-rating questionnaire (**unrated apps are
  not permitted on Play**), Data safety (§6), target audience, **ads declaration: no ads**,
  and App access with the B4 credentials (procedure in B4a).

Also owed on the account: verified developer identity / organisation details (D-U-N-S where
Play asks for it), public developer contact details, and a payment profile only if monetised.

**Screenshot plan.** Six screens tell the product story, in this order: **Dashboard** (stats
at a glance) → **Bookings** with the pending filter and a visible approve/reject bar (the core
job) → **Booking detail** → **Transactions** with the summary cards → **Alerts** with an unread
badge → **Settings** showing theme control. Capture in **both light and dark** and pick the
stronger per screen. **Use seeded demo data, never a real vendor's** — real booker names,
phone numbers and payout figures must not appear in a public store listing.

---

## 9. Rules that were checked and found *not* to apply

Recorded so nobody re-opens them or "fixes" a non-problem.

- **Apple 4.8 / Sign in with Apple — not triggered.** Email/password only; `auth.service.ts`
  has no OAuth call and there is no social provider anywhere in the app. **Do not add SIWA.**
  Adding any social login later makes it mandatory and is a scope change.
- **Apple 3.1.1 / 3.1.3(e) and Play Billing — not triggered.** The app sells nothing. It
  displays a payout ledger for real-world services already transacted on the web. There is no
  purchase link, no top-up, no subscription and no digital good in the binary — verified by
  grep. The registration link is a link to *create an account*, which is permitted; it is not
  an outbound purchase link. **Flag for business confirmation only if a vendor membership fee
  or in-app top-up is ever added.**
- **App Tracking Transparency — not applicable.** No tracking as Apple defines it, no
  analytics, no attribution SDK. `NSUserTrackingUsageDescription` is correctly absent.
  **Do not add an ATT prompt.**
- **Apple 4.2 minimum functionality — a real risk, and D2 made it worse.** A login-walled app
  that lists records is the classic 4.2 rejection. The defence is native capability the
  browser lacks: a persisted offline cache with a stale banner, haptics on state-changing
  actions, native list virtualisation, OS-keystore session storage, deep-link password
  recovery, and Realtime updates. **Push was the strongest item on that list and D2 removed it
  from v1.0.** No cost today — iOS is parked (D4) — but this must be re-examined before any
  App Store submission, and `STORE-SUBMISSION.md §4`'s review notes cite push explicitly and
  will need rewriting if push has not shipped by then.
- **Web-wrapper risk — none.** There is no `WebView` in the app. Navigation is native
  (`expo-router` stack + tabs), lists are `@shopify/flash-list`, animation is Reanimated, and
  the information architecture is deliberately *not* the web portal's (four tabs, not the web
  sidebar; Settings is a header action, not a fifth tab — `(app)/_layout.tsx`). Outbound links
  open in `expo-web-browser`, which is the correct pattern.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->

- **D1 — Account deletion: web-only, or in-app?** → **web-only, keeping D13-A**
  (resolved 2026-08-16) — build the deletion route in `vendor`, point the existing Settings
  link at it, and make the link unconditional so B3 cannot configure it away. Smallest correct
  change; satisfies Play in full and satisfies Apple 5.1.1(v) on the letter, since this app
  has no in-app account creation. *Consequence:* B2 stays a one-line repoint in this repo,
  and the `vendor` deletion route becomes a hard external dependency of the release.

- **D2 — Does v1.0 ship with push (I3)?** → **YES. Push ships in v1.0.**
  **Final answer 2026-08-16.** This decision moved twice in one day; the whole history is kept
  because the *reasoning* is what matters for the next scope call, not the outcome.

  **First answer — defer to v1.1.** Taken before the push code had been read, on the
  assumption that shipping it meant building it.

  **Then the lift was actually sized (I3), and one framing error was corrected.** The original
  recommendation had argued push *for approval*. That was the wrong axis, and it still is:
  **push buys nothing for Google Play approval.** Guideline 4.2 is Apple's; Play has no
  minimum-functionality analogue and reviews on policy — data safety, permissions, content.
  Push in fact *adds* Play surface: a device-identifier row in Data safety, a user-visible
  notification permission, and booker PII on lock screens (already mitigated — the channel
  sets `lockscreenVisibility: PRIVATE`). **Nothing below revives the approval argument.**

  **Final answer — ship it, on product and cost grounds:**
  1. **Zero mobile code.** The client is complete; the migration is complete with RLS, grants
     and a kill switch; the Edge Function is complete with unit tests. This is deployment and
     verification work, not feature work.
  2. **It cancels I11 outright.** Deferring cost an edit to soften the Settings copy *and* a
     later edit to revert it — two changes to reach the state v1.0 now ships in anyway.
  3. **It is the app's #1 stated job** — "know immediately when something needs attention"
     (companion plan). A vendor companion that cannot tell you a booking is waiting is a
     weaker product at launch, whatever the store thinks.
  4. **Cost only rises with delay.** A finished client sitting against an unapplied schema
     drifts; doing it while the code is fresh is the cheapest this ever gets.
  5. **It is the prerequisite for a credible Apple submission later**, where 4.2 *is* live.

  **Accepted costs, stated plainly:** a platform-wide trigger on `notifications` joins the
  release critical path (blast radius assessed in I3) · **X1 becomes mandatory** · a physical
  Android device is now required for release verification · two `backbone` approval gates.

  *Consequences recorded:* I3 unparked into v1.0 scope (Android half; APNs stays parked with
  B7) · **X1 promoted to the critical path** · **I11 ✖ ABORTED** · **D5 ✖ MOOT** · §5 and §6
  regain their device-identifier rows · new deferred item on the missing Command kill-switch UI.

- **D3 — Play Console account type?** → **organisation** (resolved 2026-08-16).
  *Consequence:* B6 ✖ resolved — the 12-tester / 14-day closed test does not apply and the
  Android timeline has no wall-clock gate. Identity/organisation verification is still owed.

- **D4 — Apple Developer Program enrolment (B7)?** → **park iOS; execute Android-only**
  (resolved 2026-08-16). *Consequences:* B7, I2, I3's APNs half, the Apple listing assets and
  every iOS QA row are ⏸ PARKED. The Apple columns stay in this document as the standing debt
  for when enrolment happens. **Unblock condition: an active Apple Developer Program membership.**

- ~~**D5 — What does a push-less v1.0 tell the user about notifications (I11)?**~~
  → **✖ MOOT (2026-08-16)** — answered "keep the section, fix the copy", then superseded
  within the hour when D2 reversed. There is no push-less v1.0, so there is no copy to soften.
  Kept in the record only so the abort of I11 traces to a decision rather than to silence.

**All decisions resolved. This plan is ready for execution approval.**

---

## DEFERRED / COSMETIC

- **I7 predictive-back opt-out** — honoured at API 36; only becomes a problem at API 37.
  Acceptable for this release.
- **I9 template assets** — unreferenced and unbundled; zero user impact.
- **`onlineManager` not wired to NetInfo** (`queryClient.ts:88-90`) — the manager stays
  optimistic. `StaleBanner` already covers "data on screen is not current", which is the
  state the user needs to distinguish. Acceptable; revisit only if offline QA exposes a gap.
- **Persisted cache in plain AsyncStorage** — see §4. Bounded, short-lived, purged on
  sign-out; credentials are correctly in the keystore. Acceptable, and disclosed in the policy.
- **`icon-android-foreground.png` and `icon-android-monochrome.png` are byte-identical.**
  Fine if the foreground is already a flat single-colour mark, which it is. Noted, not actioned.
- **No Command UI for the push kill switch** — verified 2026-08-16:
  `command/services/notifications-admin.service.ts:44,57` reads and writes
  `notification_email_settings` and has **no equivalent for `notification_push_settings`**.
  The switch therefore exists only as a DB row. **Acceptable for v1.0** — it is an emergency
  control, a one-line `update` reaches it, and it defaults to enabled, so nothing is blocked.
  **Not actioned here:** it is a `command` change, a different app and a different plan.
  Worth raising once push has been live long enough to want a non-engineer to reach it.

---

## Execution order

**Target: Google Play only.** iOS is ⏸ PARKED throughout (D4).
**Cadence: one stage at a time**, per `developerboss`. A stage range happens only if you ask.
Ordered by risk and dependency — not by item number.

| Stage | What | Repo | Gate | Blocked by |
|---|---|---|---|---|
| ~~**1**~~ | I4 · I9 · I10 | `ezzy-vendor-mobile` | — | **✅ DONE 2026-08-16** |
| **2** | X1 | `backbone` | approval | — |
| **3** | I3 deploy: migration → function → Vault → FCM v1 | `backbone` + EAS | **approval** | Stage 2 |
| **4** | I3 verify: push on a physical Android device | device | — | Stage 3 |
| **5** | B1a · B2a · B4 | `vendor` + prod data | own plans | Stage 2 (for B4) |
| **6** | B1b + B2b + B3 — coupled | `ezzy-vendor-mobile` | — | Stage 5 |
| **7** | I5 · I8 · I6 | `ezzy-vendor-mobile` | approval (I5) | — |
| **8** | §7 QA · artefact checks · B5 · §8 · §6 · submit | Play Console | — | 1–7 |

---

**~~Stage 1 — mobile code that is blocked on nothing.~~ ✅ COMPLETE (2026-08-16)**
I4 ✅ · I9 ✅ · I10 ✅. Machine-verified: `tsc` exit 0 · `expo lint` clean · `npm test`
141/141 · `expo export --platform android` succeeded. **Device verification still owed** on
the error boundary (§7), and the CI workflow has not yet run on GitHub.
**One correction fed back into the plan:** I4's originally specified `makeStyles(tokens)`
approach was unbuildable and would have crashed the boundary — see I4 for why.

**Stage 2 — X1, and it must precede Stage 3.**
Fix `demo/demo-seed.sql:67,381` to `disable trigger user` / `enable trigger user`, mirroring
`seed.sql:713`. **Small, but ordering-critical:** applying the push migration first would arm a
trigger the demo seed does not disable, and B4's seeded demo account is exactly the workload
that would fire it. `backbone` approval gate.

**Stage 3 — deploy push. `backbone` + EAS, no mobile code. Approval gate.**
In this order, and the order is load-bearing:
1. Apply `20260728000001_device_push_tokens.sql` to **staging** (blast radius assessed in I3).
   **Pre-check:** `select count(*) from public.portals` must return 3. The migration seeds
   `notification_push_settings` with `select name from portals` — an empty `portals` table
   seeds it empty, and the trigger reads a NULL `is_push_enabled`, which its
   `if v_enabled is not true` guard treats as **disabled**. Push would then silently never
   fire, with no error anywhere. `20260504000001_lookup_tables.sql:26-29` seeds vendor/booker/
   command, so this should already hold — verify rather than assume.
2. Deploy the `send-push-notification` Edge Function.
3. Set the `notification_push_secret` Vault secret. **This is the real on-switch** —
   the trigger stays a no-op until the secret exists, so setting it before the function is
   deployed would post to a 404.
4. Upload the **FCM v1 service-account key** to EAS. Android only — APNs is parked with B7.
5. Repeat 1–3 against **production** once Stage 4 passes on staging.

**No per-portal narrowing step** — see the withdrawn recommendation in I3. Nothing else needs
running on either environment.

**Stage 4 — verify push on a physical Android device.** Expo Go cannot do push since SDK 53,
so this needs a dev/preview build and real hardware. The five push rows in §7. **Watch for
`unavailable` in Settings — per the aborted I11, that string is the signal that registration
is failing, not a UI bug.** Do not promote to production until this passes.

**Stage 5 — external dependencies. Runs in parallel with Stages 1–4.**
B1 part 1 (publish the privacy policy) · B2 part 1 (build the deletion route) · B4 (seed the
demo account — needs Stage 2 done first, see B4a for where the credentials live).
**Each is its own plan and its own approval gate**; this plan specifies their contents and
does not build them. Start these early — they are the items with the longest lead time now
that D3 removed the closed-testing gate.

**Stage 6 — the Settings coupled batch. Blocked on Stage 5.**
B1 part 2 + B2 part 2 + B3, as one change across `SettingsList.tsx` / `useSettingsList.ts` /
`constants.ts`. **Do not split them** — a privacy link without a policy, or a deletion link
without a route, is worse than neither, and B3 is what stops a production build from hiding both.

**Stage 7 — release hardening.**
I5 (dependency patch line — approval gate; re-run `tsc` · `expo lint` · `npm test` · a device
smoke pass afterwards) · I8 (`npm version 1.0.0`) · I6 (close or explicitly ⏸ PARK the six
in-progress mobile plans — a release cut across half-verified UI is the risk here).

**Stage 8 — verification and submission.**
Full §7 QA on Android hardware, both themes, largest OS font, TalkBack · verify the **merged**
`AndroidManifest.xml` and target API 36 from the **real release AAB**, not from the resolved
dependency · B5 + §8 Play listing assets and metadata · enter §6 Data safety **including the
device-identifier row now that push ships** · content rating · App access with the B4
credentials · submit to the **internal track first**
(`eas.json` already sets `submit.production.android.track: "internal"`), then promote.

---

**⏸ Deferred track — not scheduled, unblocks on an Apple Developer Program membership:**
B7 → I2 (confirm/pin the Xcode 26 image) → I3's APNs half → Apple listing assets → §5 App
Privacy → the 2026 age-rating questionnaire → every iOS row in §7.
**Re-read §9's Guideline 4.2 note before that submission** — push shipping in v1.0 strengthens
that defence considerably, which is a side benefit of D2's reversal, not its reason.

---

## Verification

| Item | How it is checked | Kind |
|---|---|---|
| I1 target API 36 | `aapt2 dump badging` / bundletool on the release **AAB** | ⚠️ needs the built artefact |
| I2 Xcode 26 | EAS build log image line on the first production iOS build | ⏸ parked with iOS |
| Permissions (§3) | Merged `AndroidManifest.xml` extracted from the release AAB | ⚠️ needs the built artefact |
| X1 | Run `demo-seed.sql` against a local reset with the push migration applied; confirm no `net.http_post` fires | ⚠️ needs a live DB |
| I3 push | Token row appears in `device_push_tokens` · background notification delivered · tap routes correctly · sign-out deletes the row · kill switch silences delivery | ⚠️ needs a **physical Android device** — Expo Go cannot do push |
| Privacy manifest | No ITMS privacy warning on the first App Store Connect upload | ⏸ parked with iOS |
| B1 / B2 links | Tap each row in a **production** build and confirm the page loads | ⚠️ needs a device + deployed web |
| B3 env var | Read the value from the installed production binary, **not** `.env` | ⚠️ needs the built artefact |
| I4 error boundary | Force a throw in a list row; confirm the recover screen renders and **`Try again` restores the app**. Machine side already done (build + export) | ⚠️ **still owed** — needs a device |
| I5 dependencies | `npx expo-doctor` returns 21/21 | ✅ machine-verifiable |
| I8 version | `Constants.expoConfig.version` in Settings → About reads `1.0.0` | ✅ machine + device |
| I9 / I10 | `tsc --noEmit` · `expo lint` · `npm test` · `npx expo export --platform android` | ✅ machine-verifiable |
| §7 QA | Manual, on **Android** hardware, both themes, largest OS font, TalkBack | ⚠️ needs a device |

**Standing limit:** no machine check in this repo can see a silently-overridden style or a
control hidden under system UI — `AGENTS.md` records four separate style passes that passed
every machine check and did nothing on screen. **Screenshots are required evidence for any
visual item.**

---

## A. Submission blockers — **five, all Google Play**

**B1** no in-app privacy policy · **B2** the deletion link opens the portal root · **B3** the
production env var that makes both links exist is unset · **B4** no demo account for App
access · **B5** no Play listing assets.

*Resolved:* **B6** — organisation account, closed testing exempt (D3).
*Parked:* **B7** — no Apple membership, so there is no Apple submission to block (D4).

## B. Code changes required in `ezzy-vendor-mobile`

Legal + privacy rows in Settings (B1 part 2) · repoint and de-gate the deletion link (B2
part 2, B3) · error boundary (I4) · dependency patch line (I5) · version → 1.0.0 (I8) ·
delete template assets (I9) · CI workflow (I10).
**Nothing else — and notably, push adds none of it** (I3 is entirely `backbone`, credentials
and device testing). The app's security, logging, secrets, permissions, token storage and
financial-data handling all audit clean.

## C. External / store-console work

**Live — `backbone`:** X1 (`demo-seed.sql` trigger fix) · apply the `device_push_tokens`
migration · deploy the `send-push-notification` Edge Function · set the
`notification_push_secret` Vault secret. **Two approval gates.**

**Live — `vendor` + production data:** privacy policy page · account-deletion route · demo
account seeded and protected against `db reset`.

**Live — consoles:** FCM v1 service-account key uploaded to EAS · Play Console
developer/organisation verification and public contact details · Play listing assets and
metadata · Data safety (**including the device-identifier row**) · content rating · target
audience · ads declaration · App access instructions · support URL and email.

**Parked (iOS, D4):** Apple Developer Program enrolment, agreements, tax/banking · App Store
Connect record and identifier · App Privacy labels · 2026 age-rating questionnaire · App
Review contact and notes · iPhone screenshot sets · **APNs key**.

## D. Recommended production improvements

Error boundary (I4 — strongly recommended; it has already taken out the Notifications screen
once) · CI (I10) · predictive-back migration before API 37 (I7) · NetInfo wiring · a
screen-reader and touch-target pass before claiming accessibility in store metadata.

---

## Approval risk assessment

### Apple App Store — 🔴 **Not ready** — and ⏸ **not being pursued** (D4)
Not a quality judgement: **the app cannot be submitted at all.** There is no Apple Developer
Program membership, so no iOS binary has ever been produced and nothing on iOS has ever been
observed — not the icon, not safe areas, not the keyboard, not push. D4 parks this
deliberately rather than leaving it as a failing item.

What the audit found for whenever it unparks: the compliance groundwork is largely sound —
permissions are minimal, the privacy manifest is declared and 13 dependency manifests are
present, encryption is exempt, SIWA is not triggered and IAP does not apply. Two risks will
need work at that point. First, **Guideline 4.2**: with push deferred (D2), a login-walled
approve-and-view app leans on offline cache, Realtime, haptics and deep links alone, which is
a thinner defence than the one `STORE-SUBMISSION.md §4` drafted — **either ship push before
the iOS submission or rewrite that argument.** Second, the first-ever iOS run will be the
first time anyone sees this UI on the platform, and the Android history in `AGENTS.md` shows
this codebase has produced layout bugs that no machine check could detect.

### Google Play — 🟠 **Significant work remaining** (improved by D3; scope widened by D2)
This is the live target and it is the better-positioned one. Already satisfied and verified in
this repo: **target API 36** (ahead of the 2026-08-31 deadline), AAB build type, a minimal
permission set with **no restricted permissions and no Play declaration form owed**, no
cleartext traffic, session tokens in the Android Keystore, no analytics or tracking SDKs, no
secrets in the repo or its history, and a Data safety answer that can be filled in accurately
from §6. **D3 removed the single largest scheduling risk** — as an organisation account there
is no 12-tester / 14-day gate, so nothing here is wall-clock bound.

What blocks it is a tight, well-understood set: the **account-deletion requirement** (Play
mandates a *valid* deletion URL, and today's link opens the portal root), the **missing
privacy policy**, the **production env var** that currently decides whether either link exists
at all, the demo account, and the listing assets. **There is no code-level Android compliance
failure in this repository** — the blockers are one small Settings edit plus work that lives
in `vendor` and the Play Console.

**D2's reversal widens the release scope without changing that assessment.** Push adds no
mobile code and no store blocker; it adds one Data safety row, a `backbone` deployment with a
platform-wide trigger, and a hard requirement for physical-device verification before
promoting past the internal track. It makes the release **later and better**, not riskier at
review — the risk it adds is operational (a trigger firing for every portal), and it is
mitigated by the kill switch, the Vault no-op, and X1.

**Neither assessment predicts approval.** They state which current, verified requirements are
satisfied by the code as it stands on 2026-08-16.

---

## Sources

- [Target API level requirements for Google Play apps](https://support.google.com/googleplay/android-developer/answer/11926878) · [Meet Google Play's target API level requirement](https://developer.android.com/google/play/requirements/target-sdk)
- [Apple — SDK minimum requirements (Xcode 26 / iOS 26 SDK, effective 2026-04-28)](https://developer.apple.com/news/upcoming-requirements/?id=02032026a)
- [Behavior changes: apps targeting Android 16 (API 36)](https://developer.android.com/about/versions/16/behavior-changes-16)
- [Apple — Offering account deletion in your app (5.1.1(v))](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Understanding Google Play's app account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469)
- [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Apple — Updated age ratings in App Store Connect](https://developer.apple.com/news/?id=ks775ehf)
- [Expo SDK 57 reference (RN 0.86, Xcode 26.4+, iOS 16.4+, compile/target SDK 36)](https://docs.expo.dev/versions/v57.0.0/)
- [Expo — App Store Connect minimum SDK 26 / EAS Xcode 26 images](https://expo.dev/blog/app-store-connect-minimum-sdk-26)
