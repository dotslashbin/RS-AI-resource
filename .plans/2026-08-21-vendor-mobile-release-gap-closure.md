# Ezzy Vendor Mobile — release gap closure (audit of work done 2026-08-16 → 08-21)

**Date:** 2026-08-21
**App / scope:** `ezzy-vendor-mobile`. Two items land outside it and are flagged as external
dependencies with their own approval gates, not implemented here: the account-deletion web
resource (`ezzy.ph` / `vendor`) and the privacy-policy wording gap (`ezzy.ph`).
**Status:** COMPLETE (2026-09-24, user-approved) — closed; remaining release work is owned by `.plans/2026-09-21-ezzy-vendor-mobile-store-submission.md`. Several items below are stale (e.g. N5: the version is now 0.12.0). Last recorded: IN PROGRESS — audit complete, **D1 resolved 2026-08-21** (see
`.plans/2026-08-21-vendor-account-deletion.md`). **Stage A closed for now
(2026-08-24):** N1 executed and machine-verified; N3 intentionally deferred by
the user with a close-out guide recorded below.

> One-line framing: an independent re-audit of `ezzy-vendor-mobile` against
> `.plans/2026-08-16-vendor-mobile-store-release-readiness.md`, establishing what actually
> landed while another model continued the work, and closing the remaining gap to a Google
> Play submission.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** N# = new finding from this audit; B#/I#/X# refer to the **08-16 plan**
> unless prefixed. Numbers are plan-local.

> **Predecessor:** `.plans/2026-08-16-vendor-mobile-store-release-readiness.md` remains the
> authoritative audit of *requirements*. This plan does not restate them — it records what
> changed since, corrects two of its entries, and re-scopes what is left.

---

## Verdict

**The app is in materially better shape than on 2026-08-16, and it is still not submittable.**

Real progress: the privacy policy now exists and is live, production app identity is settled,
FCM is wired, and Stage 1 + Stage 2 are done and verified. But **the three blockers that stop
a Play submission are the same three as on 08-16** — B1's in-app half, B2, and B3 — because
all of the completed work was either external or infrastructural. Not one line of the
Settings change that closes them has been written.

Nothing has regressed. `tsc` exit 0 · `expo lint` clean · `npm test` **141/141**.

---

## What landed since 2026-08-16 — verified, not assumed

| Item | State | Evidence |
|---|---|---|
| Stage 1 — I4 error boundary | ✅ intact | `src/components/common/AppErrorBoundary/` (3 files); `ErrorBoundary` export present in `src/app/_layout.tsx` |
| Stage 1 — I9 template assets | ✅ intact | `assets/` contains `brand/` only; 15 deletions staged |
| Stage 1 — I10 CI | ✅ intact | `.github/workflows/checks.yml` |
| **Stage 2 — X1** | ✅ **DONE + committed** | `backbone` `d642cb3 "updated demo seed"`; `demo-seed.sql:68` and `:382` now `disable/enable trigger user` — **both sides**, matching `seed.sql:713` |
| **Production app identity** | ✅ **DONE** | Bundle ID / package `com.ezzy.vendormobile` → **`ph.ezzy.vendormobile`**, consistent in `app.json:11,30`, `google-services.json`, `README.md:14`, `STORE-SUBMISSION.md:19-20`, `IOS-BUILD.md:80,115,211` |
| **FCM wiring** | ✅ **DONE** | `google-services.json` present (698 B, project `ezzy-vendor-mobile-fbase`), wired via `android.googleServicesFile`. Package inside the file **matches** `ph.ezzy.vendormobile` — the classic silent-FCM-failure mismatch is avoided |
| **Secrets hygiene** | ✅ improved | `.gitignore` now excludes `*firebase-adminsdk*.json`, `*service-account*.json`, `ezzy-vendor-companion-app-*.json`. Verified `google-services.json` holds **no** private-key material (`project_info` / `client` / `configuration_version` only) — Expo's docs confirm it is safe to commit |
| **B1 — external half** | ✅ **DONE** | **`https://ezzy.ph/privacy-policy/` returns HTTP 200.** Also live: `/terms-use/`, plus acceptable-use, cookie and refund policies (`vendor/lib/legal.ts:32-36`) |
| Web portals — legal links + consent | ✅ shipped | `.plans/2026-08-19-legal-links-and-consent.md` — COMPLETE. That plan explicitly scopes the **mobile apps out** (`:631-635`) and names the in-app link as still owed |
| `legal_acceptances` table | ✅ no mobile impact | `20260819000001` — append-only, `authenticated` gets **SELECT only**, no triggers. Gates **signup** only, and vendor signup is web-only, so the mobile sign-in path is untouched. **Checked because a login gate here would have broken the app** |

**Corrections to the 08-16 plan** (§4 of `plan-authoring` — record them, don't bury them):
- 08-16 stated *"the `vendor` product has no privacy-policy route at all"*. **No longer true.**
  The policies live on `ezzy.ph`, not in the Next.js app, which is why a route search still
  finds nothing — a better answer than a route, since it needs no auth and no deploy.
- 08-16 header says "Stages 3–8 ⬜ TODO". **Stage 3 is partially done** — the FCM half of
  Stage 3 step 4 is complete. Steps 1–3 (migration, function, Vault secret) remain unverified.

---

## BLOCKERS — unchanged from 08-16, and still the whole story

### B1(mobile) — No privacy-policy link inside the app  ⬜ TODO
**File:** `src/components/settings/SettingsList/SettingsList.tsx` — no Legal section exists.
Verified by grep: the words Privacy / Terms / Legal appear **nowhere** in the Settings tree.

The external half is now done, which changes this from a multi-week dependency into a small,
unblocked edit. Both stores require the policy reachable **from inside the app**; a live URL
alone does not satisfy that.

**Fix approach:** a `Legal` section in `SettingsList` — Privacy Policy and Terms of Use —
opened with `WebBrowser.openBrowserAsync`, exactly as `openPortal` already does
(`useSettingsList.ts:40-42`). URLs as constants in `lib/constants.ts`, **not** env-derived
(see B3).
**Component convention:** no new component. Rows reuse the existing `styles.card` / `styles.row`
shape; the URL constants and the `openPrivacyPolicy` / `openTerms` callbacks go in
`useSettingsList.ts`; `SettingsList.tsx` stays a pure render layer; `SettingsList.styles.ts`
is untouched. Render/hook/style separation holds by construction.

**Ships with B2 and B3 as one change** — see Execution order.

### B2 — Account deletion: still no web resource anywhere  ⬜ TODO — **external dependency**
**File:** `src/components/settings/SettingsList/useSettingsList.ts:47-49` — unchanged since
08-16; `openAccountDeletion` still opens `WEB_PORTAL_URL`, the portal root.

**Newly established this audit — the external half is NOT done:**
- `https://ezzy.ph/account-deletion/` → **404**
- `https://ezzy.ph/delete-account/` → **404**
- `https://ezzy.ph/data-deletion/` → **404**
- The privacy policy's Section 7 states the *right* — *"Request deletion of your account where
  legally permitted… Requests may be submitted using the contact information provided below"* —
  pointing at a general `admin@ezzy.ph` address.

**Is Section 7 enough for Play?** Play requires a **readily discoverable** way to *initiate*
deletion via a web resource, whose URL goes in the Data safety form. A clause inside a
five-section rights list, resolving to a generic support mailbox, is a weak reading of
"readily discoverable" — and the URL field would have to point at the privacy policy, which
is not a deletion resource. **See D1.**

**Fix approach:** publish a deletion resource (D1 decides its shape), then point
`openAccountDeletion` at it and drop the `hasPortal` gate (B3). Mobile side is one constant
plus one callback edit.

### B3 — Legal links still hostage to an unset env var  ⬜ TODO
**File:** `src/lib/constants.ts:39` → `WEB_PORTAL_URL`, consumed as `hasPortal`
(`useSettingsList.ts:70`). `.env.example:18` still ships `EXPO_PUBLIC_VENDOR_PORTAL_URL=` empty.

Every legal affordance — portal, **and account deletion** — renders only when that variable is
set at build time. A production build made without it ships **with no deletion link at all**.

**Fix approach:** privacy, terms and deletion become **unconditional constants**; `hasPortal`
keeps gating only the optional "Open the web portal" convenience row. The compliance-critical
links then cannot be configured away, which is the whole point.

### B4 / B5 — demo account · Play listing assets  ⬜ TODO — 🌐 external
Unchanged from 08-16 (§B4, §B4a, §B5, §8). No evidence either has started. B4a's rule stands:
**credentials go in Play Console → App content → App access**, never in the repo.

---

## NEW FINDINGS from this audit

### N1 — `google-services.json` is untracked, though the repo intends to track it  ✅ DONE (2026-08-22)
**File:** `google-services.json` (untracked); `.gitignore` comment: *"Keep google-services.json
trackable; it is Android app config, not a private service-account key."*

The intent is explicit and correct — the file is safe to commit, and Expo's own documentation
says so — but it was never `git add`ed. A fresh clone, a new machine or CI has no FCM config.

**Severity corrected during this audit.** I first assumed EAS would omit an untracked file and
break the build. **Wrong** — EAS excludes files by `.gitignore`, and this file is not ignored
(`git check-ignore` confirms), so it *is* uploaded from the working directory. This is a
**reproducibility** gap, not a broken build.
**Fix approach:** `git add google-services.json`. One command; no code change.

**Executed 2026-08-22:** staged `google-services.json` in the `ezzy-vendor-mobile` Git index.
**Verified (machine):** `git ls-files --stage google-services.json` returns one tracked index
entry, and `git status --short google-services.json` reports `A  google-services.json`.

### N2 — The privacy policy omits the app's most sensitive data category  ⬜ TODO — **external**
The live policy covers personal data, **device identifiers**, third-party processors,
retention, the deletion right, and a contact address — genuinely good coverage, and it makes
the Data safety device-identifier row (needed now that push ships) defensible.

**What it does not cover: vendor payout, earnings and transaction data.** WebFetch of the live
page: *"does not mention transaction payouts, vendor financial data, or vendor business
financial information."* That is precisely what `transactions.service.ts` and `financials.ts`
put on screen, and Play classifies it as **Financial info — a sensitive category**.

Both stores require the policy to accurately describe what the app collects. Declaring
purchase/transaction history in Data safety (08-16 §6) while the policy is silent on it is the
kind of mismatch that draws a policy rejection.
**Fix approach:** add a clause covering vendor transaction, fee and payout records. **`ezzy.ph`
content work — out of scope here**, but it gates the Data safety declaration in Stage 8.

### N3 — Bundle-ID change may have orphaned a store/EAS record  ⏸ PARKED (2026-08-24) — 🌐 **verification only**
`com.ezzy.vendormobile` → `ph.ezzy.vendormobile` is a good change and correctly propagated
through every file. But an application ID is **immutable once an app exists on Play**.

**Verify before building:** that no Play Console app record, EAS Android credential, or Firebase
Android app was already created under the old `com.` ID. If one was, it is now orphaned and the
new ID needs its own record. Cheap to check now, expensive to discover at upload.

**Parked reason:** the user explicitly deferred this console check on 2026-08-24. No connected
Play Console, EAS, or Firebase console tool is available in this session, and the check cannot be
verified from repository files. **Unblocks when:** a human with console access confirms Play
Console, EAS Android credentials, and Firebase Android apps have no live record under
`com.ezzy.vendormobile`, or intentionally retires/recreates any old record.

**Close-out guide:**
1. **Google Play Console:** open **All apps**. Confirm there is no app with package name
   `com.ezzy.vendormobile`, and confirm the app intended for submission uses
   `ph.ezzy.vendormobile`.
2. **Expo / EAS:** run `eas credentials --platform android` from `ezzy-vendor-mobile`, select
   this project, and confirm Android credentials/application identifier are for
   `ph.ezzy.vendormobile`, not `com.ezzy.vendormobile`.
3. **Firebase Console:** open the vendor-mobile Firebase project, then
   **Project settings → General → Your apps**. Confirm the Android app package name is
   `ph.ezzy.vendormobile`; if an Android app entry for `com.ezzy.vendormobile` exists, confirm it
   is intentionally unused/removed.

**Mark DONE when all three are true:** Play submission target is `ph.ezzy.vendormobile`; EAS
Android credentials are under `ph.ezzy.vendormobile`; Firebase's active Android app for this
build is `ph.ezzy.vendormobile` and no active `com.ezzy.vendormobile` record remains.

### N4 — Dependency drift has grown  ⬜ TODO
`expo-doctor` still **20/21**, 10 packages behind the SDK-57 patch line — and further behind
than on 08-16 (`expo-router` 57.0.9 installed vs **57.0.15** expected; was 57.0.13).
No dependency was added or changed: `git diff package.json` is empty and the `package-lock.json`
diff is a version-field sync only (0.6.0 → 0.8.0). This is 08-16 **I5**, still open.

### N5 — Version is still `0.8.0`  ⬜ TODO
08-16 **I8**. Reads as pre-release for a first store submission.

### N6 — Nine mobile plans still IN PROGRESS  ⬜ TODO
08-16 **I6**. Unchanged count. Cutting a release across half-verified UI is the risk.

### N7 — Push deployment state is unverified  ⬜ TODO — 🌐
FCM config landing suggests Stage 3 started, but three of its four steps cannot be confirmed
from this repo: whether `20260728000001_device_push_tokens.sql` is **applied** (staging or
production), whether `send-push-notification` is **deployed**, and whether the
`notification_push_secret` **Vault secret** is set. Stage 3's `portals` pre-check (count = 3)
is likewise unconfirmed. **Stage 4 device verification has certainly not happened.**

---

## DECISIONS

<!-- No item may execute while any OPEN: line remains. -->

- **D1 — What form does the account-deletion web resource take (B2)?**
  → **(a) + (c): a thin static `https://ezzy.ph/account-deletion/` page AND an
  authenticated deletion flow in the `vendor` portal** (resolved 2026-08-21).
  Chosen with the reasoning and full design in
  `.plans/2026-08-21-vendor-account-deletion.md` (its D8; its B7 is this plan's B2).
  Public rather than portal-only because a login-gated page fails suspended and
  rejected-KYC vendors — the population most motivated to use it. **Stage B is unblocked;
  Stage C's URL target is that page.** The original options are kept below for the record.

  <details><summary>Original options as written 2026-08-21</summary>

  (a) **A dedicated `https://ezzy.ph/account-deletion/` page (Recommended).** Static content:
  what deletion removes, what is retained and why, and how to initiate it. Costs one page on a
  site that already hosts five policies. Gives Play an unambiguous URL for the Data safety
  field, gives the app an unambiguous link target, and is the reading of "readily discoverable"
  least likely to be argued with.
  (b) **Rely on the existing privacy-policy Section 7.** No new work. Risks the Data safety URL
  pointing at a policy page rather than a deletion resource, and a rights clause resolving to a
  generic mailbox being judged not readily discoverable.
  (c) **Build an authenticated deletion flow in the `vendor` portal.** Strongest UX and the
  clearest evidence of intent; largest scope, and a destructive flow needs its own plan.

  **Recommendation: (a) now, (c) later if wanted.** (a) unblocks submission this week and does
  not preclude (c). Note D1's answer does not change the mobile edit — only the URL it targets.
  </details>

---

## Execution order

**Target: Google Play.** iOS remains ⏸ PARKED (08-16 D4).
**Cadence: one stage at a time.**

| Stage | What | Repo / owner | Gate | Blocked by |
|---|---|---|---|---|
| **A** | ✅ N1 track FCM config · ⏸ N3 verify old-ID records | `ezzy-vendor-mobile` + consoles | — | Closed for now; N3 deferred by user |
| **B** | D1 → publish the deletion resource · N2 policy clause | `ezzy.ph` (external) | own work | D1 |
| **C** | **B1(mobile) + B2 + B3 — coupled** | `ezzy-vendor-mobile` | — | Stage B |
| **D** | N7 confirm/complete push deploy → Stage 4 device verify | `backbone` + EAS + device | **approval** | — |
| **E** | N4 (I5) · N5 (I8) · N6 (I6) | `ezzy-vendor-mobile` | approval (N4) | — |
| **F** | B4 demo account · B5 listing assets · Data safety · submit | Play Console | — | A–E |

**Stage A — closed for now 2026-08-24.** `git add google-services.json` is done and
machine-verified. The old-ID record check is intentionally deferred by the user; the N3 section
above carries the Play Console / EAS / Firebase close-out guide for later.

**Stage B — external, longest lead.** Answer D1, publish the deletion page, add the financial-
data clause (N2). Start in parallel with everything else; Stage C cannot land without it.

**Stage C — the one coupled mobile change.** B1(mobile) + B2 + B3 across `SettingsList.tsx`,
`useSettingsList.ts` and `constants.ts`. **Do not split:** a privacy link without a reachable
policy, or a deletion link without a resource, is worse than neither — and B3 is what stops a
production build from hiding both.

**Stage D — push.** Confirm what is already applied before applying anything (Stage 3's
`portals` pre-check and ordering rules in the 08-16 plan still govern). Then device-verify.

**Stage E — release hardening.** `npx expo install --check`, version → 1.0.0, close or ⏸ PARK
the nine in-progress plans.

**Stage F — submission.** 08-16 §7 QA on Android hardware, merged-manifest and target-API-36
check from the real AAB, listing assets, Data safety **including the financial row once N2
lands**, App access with the B4 credentials, internal track first.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| N1 | `git ls-files --stage google-services.json` returns one index entry | ✅ machine — done 2026-08-22 |
| N2 | Re-fetch the live policy; confirm payout/transaction wording | ⚠️ needs the page published |
| N3 | Play Console + EAS + Firebase list no `com.ezzy.vendormobile` app | ⏸ parked — deferred by user 2026-08-24; guide recorded in N3 |
| B1/B2/B3 | Tap each Settings row in a **production** build; confirm each URL loads | ⚠️ needs device + published pages |
| B3 | Read the value from the installed binary, not `.env` | ⚠️ needs the built artefact |
| N4 | `npx expo-doctor` → 21/21 | ✅ machine |
| N5 | Settings → About shows `1.0.0` | ✅ machine + device |
| N7 | Token row appears in `device_push_tokens`; background delivery; tap-to-route | ⚠️ **physical Android device** |
| Regression | `tsc --noEmit` · `expo lint` · `npm test` · `expo export` | ✅ machine — **all green as of 2026-08-21** |

---

## Bottom line

**Google Play — 🟠 Significant work remaining, materially improved.** The privacy policy is
live, app identity is production-correct and consistent, FCM is wired, and no code-level
Android compliance failure exists. What stands between the app and a submission is now
**one small, well-specified mobile change (Stage C)** plus **one external page (Stage B)** —
neither of which existed as a tractable task on 08-16, because the policy did not exist then.

**Apple — 🔴 unchanged, still ⏸ PARKED.** No Developer Program membership, so no iOS build.
