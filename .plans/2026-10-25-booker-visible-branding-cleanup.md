# Booker visible branding cleanup

**Date:** 2026-10-25
**App / scope:** Booker customer-visible naming only; read-only legacy staging exposure triage. No legacy hosted changes.
**Status:** IN PROGRESS — E2/E3 local work verified; hosted exposure pending; release: staging ⏸ · production ⏸ (user deferred 2026-10-26)

> Deliver visible Booker fixes independently of browser-key, Command namespace and workspace-folder changes.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** E# = execution stage; numbers are plan-local. References to umbrella I4/I5 mean `.plans/2026-10-25-rs-to-ezzy-cleanup.md` items, not additional local items.

## ▶ RESUME HERE (updated 2026-10-26, end of E3)

- **Done:** E1 local baseline; E2 two-file copy/import change; E3 local checks: 29 test entries, TypeScript, Webpack production build, exact source comparison, four local sidebar browser cases and six mocked before/after login cases passed.
- **Live where:** No source changes; staging/production untouched by this work. User reports both legacy surfaces on staging.
- **Next:** No further work authorised in this run. E4/E5 parked until user resumes hosted verification/release; E1 legacy hosted exposure still lacks URLs. For further work, start a fresh session with this plan; do not deploy or start lower-priority migrations implicitly.
- **Watch out:** Do not mistake the old website's outbound portal links for its own deployment URL. Do not let missing legacy URLs block an independently approved E2 delivery.

## Scope and approval

User authorised **Step 1 only** on 2026-10-25, then explicitly approved **E2 and continuing into E3** on 2026-10-26. User requested skipping E4 and E5 and saving staging verification for later; those stages are parked, not waived or completed. No staging or production action is authorised by this run. Umbrella D1–D3 are excluded from this delivery: no archives/deletions, historic proof rewrites, browser-storage migration, DB/schema change, Command styling rename or parent-folder move.

Architecture: follow `architecture/overview.md:11`, existing complete product name from `booker/lib/constants.ts:160`. No new naming abstraction. No data-layer changes. Risk is visible copy/name wrapping and misconfigured target APP_NAME; verify configured value without reading unrelated env/secret files.

## No behavioural changes — acceptance requirement (added 2026-10-26)

Only the approved displayed brand wording may change. Preserve navigation/routes, click and keyboard interactions, sidebar open/close state, authentication/recovery/access decisions, validation, loading/error transitions, API/network effects, booking/payment logic, stored data and browser storage. Existing APP_NAME configuration/fallback semantics remain unchanged. No dependency/configuration change, new side effect or incidental refactor belongs in this delivery.

E2 must remain a text/constant-import change in the two named files. E3 must inspect the complete diff for logic changes and compare unit/type-check results to E1; passing tests alone is not behavioural equivalence proof. E3/E4 must verify the same sidebar/drawer controls and no-access condition still behave as before, in both themes and desktop/phone layouts. Longer branding must not obstruct controls or change the user flow. Any behavioural deviation blocks acceptance and must be removed or separately scoped and approved; do not silently fix adjacent issues.

**Previous-stage confirmation (2026-10-26):** Read-only Git checks show Booker still at E1 HEAD `ac209296141fdc071557ab4c124f2940f0625c6a`, clean working tree, and an empty diff against that baseline (including both planned edit targets and constants). Step 1 changed plan documents/index only and ran tests/type-check/read-only searches; no app code, dependencies, configuration, data or hosted deployment was changed. Therefore Step 1 introduced no application behavioural change. This is change-scope verification, not a new runtime/end-to-end test. E1's 29 passing test entries and passing TypeScript check are prior evidence; they were not rerun for this documentation update. Live I5 exposure verification remains pending.

## Findings / work

### E1 — Baseline and exposure triage 🔄 IN PROGRESS (2026-10-25)

**Files/evidence:** `booker/package.json:6–13`, `booker/tsconfig.json:1`; `website/index.html:253,258`; `prototypes/school-client/README.md:1`; umbrella I5.

**Authorisation:** User explicitly requested Step 1 only.

**Machine-verified 2026-10-25:**

- Booker branch `feature/visible-branding-cleanup`, HEAD `ac209296141fdc071557ab4c124f2940f0625c6a`; initially clean, no source diff.
- From Booker: `npm test` exited 0, 29 test entries passed, 0 failures/skips.
- From Booker: `./node_modules/.bin/tsc --noEmit --incremental false` exited 0. Incremental writes disabled for the baseline.
- Available nonsecret local docs/config filename search found no authoritative deployment URL mapping for the two legacy surfaces. Website outbound `booking.co99.win`/`school.co99.win` links do not prove current hosting; prototype README is generic framework boilerplate.

**User-reported evidence 2026-10-25:** Both `website/` and `prototypes/school-client/` are on staging; scope remains flexible. This supersedes the older not-deployed assumption but does not establish audience, deployed commit or live content.

**Later local retirement (2026-10-26):** After viewing both folders, user explicitly authorised their deletion and reference cleanup. Removed from workspace; recoverable copies under `/tmp/ezzy-retired-legacy-2026-10-26-eejkvllz/` including independent Git histories. Root `.gitignore` obsolete entry removed. Active app-reference scan found no dependencies; historical evidence retained. This local retirement is separately authorised beyond E1's original read-only scope; E2 remains unstarted. Staging copies were not removed or verified. E1/umbrella I5 remain in progress for hosted verification; no closure inferred.

**Still required:** Two staging URLs and whether vendors/customers can access/use them. Inspect read-only once provided and record source-to-deployment mapping. If access requires a login, coordinate a safe review without requesting credentials. Keep E1 in progress until live exposure verification is performed or explicitly scoped out by the user. No guessed URLs visited, credentials read, provider harness run, hosted operation or service restart.

**Verification limits:** No baseline production build or visual/browser check run; those are E3. Missing I5 URLs do not block independently approved Booker E2.

### E2 — Correct visible Booker copy ✅ DONE (2026-10-26) — approved text/import edits executed; exact diff comparison, 29 test entries and TypeScript verified

**Files:** `booker/components/layout/Sidebar/Sidebar.tsx:58–59`; `booker/components/auth/LoginPage/useLoginPage.ts:19`; existing `booker/lib/constants.ts:160`.

**Behaviour constraint:** Apply the acceptance requirement above; no logic/handler/state changes.

**Approach:** Import APP_NAME into both existing files; product label renders it verbatim, no-access error interpolates it; descriptor becomes “Client Portal”. Retain existing fallback/configuration behaviour; missing Ezzy deployment configuration fails acceptance rather than expanding scope silently.

**Component separation:** Sidebar remains render-only, existing CSS module unchanged, caller-provided handlers retained. Message construction stays in the existing useLoginPage controller. No state, inline styling or unrelated refactor.

**Executed:** `Sidebar.tsx` imports/render APP_NAME and “Client Portal”; `useLoginPage.ts` imports APP_NAME and interpolates it only in the no-access message. Styles/handlers/state/auth/data unchanged. Exact source comparison against HEAD matches only these prescribed replacements. Browser/runtime limits are tracked in E3; E2 completion is not release or full behavioural-equivalence proof.

**Dependencies:** Existing APP_NAME available; E2 approval received 2026-10-26. No dependency on umbrella D1–D3, browser-key migration, Command styling or folder move. Read-only E1 exposure investigation can remain pending separately.

### E3 — Local verification ✅ DONE (2026-10-26) — tests, TypeScript, production build, exact diff and local browser/mocked-handler checks passed

**Who:** Agent machine checks; shared visual acceptance.

**Results (2026-10-26):**

- `npm test`: 29 test entries passed, 0 failures/skips; same count as E1. `./node_modules/.bin/tsc --noEmit --incremental false` and `git diff --check` passed.
- Exact comparison to HEAD proved only approved APP_NAME imports/wording replacements in the two files; all remaining source in those files is identical. No handler/state/style/auth/config edits.
- Initial sandboxed default Turbopack build stalled during compilation; interrupted. Bounded approved outside-sandbox `timeout 180s npm run build -- --webpack` completed successfully, including TypeScript, static generation and traces. Existing Google font fetches logged transient DNS retries; they ultimately resolved without a code/config/font change. Existing ambiguous Tailwind utility warnings observed; not modified. No successful default Turbopack build is claimed.
- Chromium initially blocked by sandbox; approved outside-sandbox local check passed at 390px and 1280px in light/dark. Used existing sidebar gallery fixture and explicit test-only APP_NAME `Ezzy Booker`; verified label/descriptor, absence of RS, brand bounds and mobile close control visibility/no overlap. External browser requests were blocked; temporary server shut down after the check. Screenshots: `/tmp/ezzy-branding-checks/sidebar-{390,1280}-{light,dark}.png`; phone-light and desktop-dark images visually inspected. No snapshot baselines changed.
- Isolated offline TypeScript-transpiled hook comparison (old HEAD vs current, React/service dependencies mocked) passed six cases: no_access, absent reason fallback, suspended, pending, allowed, sign-in error. Call order, loading/error state and success callback outcomes were identical except the two approved no-access brand strings. First helper attempt hit a sandbox child-process restriction before running assertions; the approved offline rerun passed. No real auth/provider requests or accounts used.
- Unrelated Booker promo asset edits/deletions were already present and continued changing concurrently. They were not edited/reverted/staged by this work. Build checks apply to the current working tree; this is not an isolated release-artifact claim.

**Limits:** Local fixture used a controlled Ezzy name; hosted configuration not inspected. Mocked checks and exact source comparison are evidence of preserved logic, not a full authenticated end-to-end proof. Real login/onboarding/recovery, complete shell navigation, device review and hosted acceptance remain unverified/deferred; E4/E5 stay parked. No code changes were made to bypass verification failures.

Run Booker `npm test`, `./node_modules/.bin/tsc --noEmit --incremental false`, `npm run build`; review focused diff/literal scan. Check sidebar/drawer and access-error text on desktop/phone, light/dark, configured long product name. Preserve accessibility/navigation and loading/error states. Record existing failures independently. No automatic snapshot acceptance. No new dependency or auth/data change.

### E4 — Staging release and acceptance ⏸ PARKED (2026-10-26) — user requested staging verification later; resume only when user requests deployment/verification

**Who:** User deploys; shared checks; user accepts staging.

User manually deploys approved Booker changes to its existing staging Vercel project; record immutable deployment URL/ID and commit. Verify `staging-booker.ezzy.ph` product labels, no-access message, narrow/wide layout and correct staging Supabase target. Confirm APP_NAME is the intended complete Ezzy product name. No DB/function/secret changes. Stop until user confirms staging green; any parked check needs an explicit dated decision. Legacy website/prototype is outside deployment scope.

### E5 — Production promotion, always last ⏸ PARKED (2026-10-26) — user requested skipping production; unblock only after user resumes release and staging is accepted

**Who:** User promotes; shared verification.

Read-only parity check of app/deployment versions and existing migration/function records: expected pending set is this approved Booker change only, zero DB/function changes. User uses Vercel Promote on the exact E4 deployment, not a fresh build. Verify production labels/layout and correct production target; record deployment IDs and checks. On failure, user promotes a known-good prior deployment. No earlier stage changes production. Any fix returns to local then staging.

## Execution order

1. E1 baseline and read-only exposure triage — user authorised; local portion verified, URL-dependent portion pending.
2. E2 visible copy — user approved 2026-10-26; implemented and source-verified.
3. E3 local verification — authorised continuation 2026-10-26; completed with limits recorded above.
4. E4 staging — parked at user request; acceptance gate remains.
5. E5 production — parked at user request, always last.

## Release

Plan/audit documents: **Release: none**. Booker code, if approved: local E3 → staging E4 → production E5. No other app, legacy-hosted surface, DB, function, secret or mobile release.

## Completion and rollback

No Booker cleanup deployed yet. Source changes are two focused files; revert those changes or promote the prior Booker deployment if necessary. No stored-data rollback. Record dated outcomes per stage; user-owned follow-ups in other plans remain open. Re-run `python3 scripts/plans-index.py` after status/header changes. Fresh session recommended for E2, opening this plan at E2 after approval.
