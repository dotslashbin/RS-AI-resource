# RS → Ezzy naming cleanup and workspace move

**Date:** 2026-10-25
**App / scope:** All five apps, backbone, root documentation/instructions, previews, tooling, website and prototypes; future parent-folder move assessed separately.
**Status:** DRAFT — prioritised by user impact; batch scope, decisions and explicit approval required before execution; release: staging ⬜ · production ⬜

> Remove stale project naming without breaking styling, password recovery, historical evidence or local tooling.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision, F# = audit Finding, S# = staging step, P# = production step. Numbers are plan-local.

## ▶ RESUME HERE (updated 2026-10-25, priority review handoff)

- **Done so far:** Read-only audit and location inventory; reprioritised findings on 2026-10-25 as customer/vendor-visible → data hygiene → architecture/branding consistency, with actual dependencies separated from priority. No cleanup executed.
- **Live where:** local source unchanged · no staging/production changes by this work. User reports both legacy surfaces already on staging; URLs and audience/access context pending.
- **Local retirement update (2026-10-26):** User-approved legacy folder removal executed; see I2 and D1. Hosted copies unverified; root instruction backup not removed.
- **Next:** Booker-only E2/E3 approved and completed locally on 2026-10-26; see `.plans/2026-10-25-booker-visible-branding-cleanup.md`. E4/E5 parked at user request; no release. Legacy URL-dependent exposure pending; lower groups remain draft.
- **Watch out for:** `rs.recovery` is part of a security-sensitive recovery latch; `RS-S2-*` labels identify existing payment-test evidence. Do not replace either blindly. Parent folder remains `/home/joshua/RS` until the user moves it.
- **Evidence:** [Full file/line inventory](2026-10-25-rs-to-ezzy-inventory.md). Existing unrelated changes/untracked checkout work were present before this audit; preserve them and do not close their follow-ups.

## Scope and assumptions

Requested: find stale RS references throughout the workspace and propose rename/deletion work with its blast radius, for review before execution. This is cross-app work; the audit is authorised, implementation is not.

Out of scope: implementing any cleanup now; moving the parent folder now; redesigning the product; renaming unrelated abbreviations or dependency identifiers; rewriting Git history; changing database schema/data without a separately evidenced and approved change, deployed domains, provider registrations, secrets, package identities, Expo bundle IDs or release processes. Bookdeck/DriveBook cleanup is not automatically included merely because those names appear near RS.

Assume Ezzy is the brand and existing `APP_NAME` configuration remains the web naming source of truth. `architecture/overview.md:11` says it contains the complete product name; never append another “Booker” or “Command”. Prefer workspace-relative documentation and script paths over hardcoding `/home/joshua/Ezzy`. Existing constant fallbacks in `booker/lib/constants.ts:160–161` are separate configuration debt; this plan does not silently widen to fix them.

## Priority groups — customer impact first (revised 2026-10-25)

Priority describes **when to deliver value**; severity describes **what must be safe within that batch**. B1–B3 are conditional blockers for their own changes, not prerequisites to removing visible RS text. The existing numbering is preserved for traceability.

“Clean data” is interpreted here as cleaning stale naming in persisted client state and classifying obsolete records/fixtures. No RS-named database rows were established by this source audit. Do not invent a DB migration or broaden to all legacy brands. If customer-visible stored data is later found, its read/display/write path moves into the visible group first; destructive cleanup waits for a precise approved specification.

| Priority | Audience / goal | Findings grouped here | Exposure and blast radius |
|---|---|---|---|
| **1 — Visible to customers/vendors** | Remove RS from screens customers use | **I4:** Booker sidebar/drawer product name, descriptor and no-access error | Confirmed in current source; deployed behaviour still needs staging/live confirmation. Small Booker-only UI copy/import change; no data or auth-state migration. |
| **1 — Conditional exposure check** | Do not overlook an externally shared old page | **I5**, then the public-facing part of **I2** only if exposed: old website and school prototype | User confirmed both surfaces are on staging (2026-10-25), with scope still flexible. URLs, access restrictions and customer/vendor sharing remain unverified; obtain these before choosing the hosted action under D1. |
| **2 — Clean data and obsolete material** | Preserve valid state while cleaning stale identifiers and unused content | **B1** browser recovery/vendor-selection names (if D3 chooses migration); local archive/removal part of **I2**; fixture/history classification part of **I3** | Auth-related migration is high risk despite being invisible. No DB cleanup evidenced; compatibility and recoverable retention come before cosmetic purity. |
| **3 — Architecture consistency with branding** | Align internal code, tooling and documentation with Ezzy | **B2** Command tokens/Tailwind/selectors plus matching preview adapters; **I1** internal docs/comments/prompts/preview brand; alias documentation part of **I3**; **B3** portable paths and later folder move | Broad internal change, little immediate customer benefit. Command is an internal portal; its CSS identifiers are not rendered brand copy. Local preview brand is design-review content, not proof of customer exposure. |

**What the audit did not find:** stale RS display text in current Vendor or either mobile app source under the stated exclusions. Do not prioritise renaming their invisible internals as though vendors currently see those names.

### Dependency order — promote only real prerequisites

| Delivery / item | Must happen first or together | Does **not** need to wait for | Why / verification |
|---|---|---|---|
| **I4 customer-visible copy** | Existing `APP_NAME` import; verify the configured complete name in the target deployment and narrow-screen layout; Booker local checks → staging → exact-deployment production promotion | B1 keys, B2 Command styling, B3 parent move, archives or history policy | `booker/lib/constants.ts:160` already exports the value. No new branding abstraction, schema or shared package needed. Staging must catch a missing/misconfigured app name rather than masking it with another hardcoded name. |
| **I5 exposure triage** | Establish whether `website/` / school prototype is published or actively shared, using nonsecret deployment/share information | Any code refactor or archive operation | Local stale content does not prove public exposure. If the hosting/share destination is absent from available records, record unknown and request the destination; do not claim the page is offline. |
| **I2 exposed-content action** | I5 exposure result + D1 disposition and concrete recoverable archive/replacement scope; if hosted, identify owner and release/takedown procedure before approval | Command token rename or parent-folder rename | Deleting a local ignored file does not remove a hosted copy. Rebranding old driving-school claims may need a separate content plan. |
| **B1 persisted-state migration** | D3; legacy/new read-write-clear contract and regression checks; corresponding recovery documentation updated together | I4, B2, B3 | State-safety is a prerequisite to this cosmetic rename, not to visible copy. Keep valid vendor membership checks and old recovery obligations. |
| **I2 local-only archives** | D1; inbound-reference review; verified recoverable copy before removal | I4, B1 or B2 | Ignored files may have no Git recovery path. Active prompts under `prototypes/` must remain. |
| **I3 historical/fixture disposition** | D2 for historical narrative; keep exact proof labels/recorded evidence; separately authorised alias/config change if ever selected | I4 and app branding delivery | Existing test resources use exact metadata identity. Preserving evidence is a constraint, not an upstream rebranding task. |
| **B2 Command namespace** | All declarations + Tailwind map + component/CSS consumers + test selectors + active preview adapters in one batch; visual checks | I4, browser-key migration, folder move | Renaming a CSS producer alone breaks consumers. Preserve values; internal namespace work does not unlock visible Booker fixes. |
| **I1 internal docs/preview copy** | B1 only for recovery-key documentation; B2 only for executable token examples/adapters | Other independent doc/title edits | Ordinary brand prose can change independently; technical docs must describe the code that actually exists. |
| **B3 physical parent move** | Portable active paths; nonsecret external path inventory; worktree/IDE checks; separate user move authorisation and fresh session at new root | UI branding or storage/CSS names | Move changes filesystem paths, not the deployed product. It is a prerequisite only if the move is brought forward, not a prerequisite to any customer copy release. |

**Recommended delivery strategy:** First scope a Booker-only I4 delivery and the read-only I5 triage. Give that delivery its own local → staging → production plan so it can ship without the higher-risk data/architecture changes. Then approve priority-2 and priority-3 batches independently, each deployable batch with its own staging gate and production-last release. Do not combine all 217 matching files into the first release. Until this split is written, this document remains an umbrella DRAFT and no item executes.

## Behaviour preservation requirement (added 2026-10-26)

All branding work must preserve functional behaviour: routes, interactions, auth/access/recovery decisions, validation, booking/payment flows, API effects and user data. Displayed brand text and approved internal names may change only within the selected batch. Identifier migrations must preserve consumers and existing state through the specified compatibility contract; they are not permission to alter product behaviour. Proposed archive/removal remains a separate explicit disposition decision, not a behaviour-neutral text change. Any broader behaviour change requires separate scoping and approval.

For the first Booker delivery, only approved visible wording/APP_NAME references may change; no state, logic, configuration or storage migration. Full diff review, baseline comparisons and local/staging interaction checks are acceptance gates. Details and Step 1 verification are recorded in `.plans/2026-10-25-booker-visible-branding-cleanup.md` under “No behavioural changes”.

**Step 1 audit (2026-10-26):** Booker HEAD remains the recorded `ac209296141fdc071557ab4c124f2940f0625c6a`; clean tree and empty baseline diff confirm no application changes. Only plan/index documentation changed during Step 1; no hosted/data changes occurred. No application behavioural change introduced; runtime checks remain pending, not newly claimed complete.

## Audit findings and coverage

### F1 — Inventory baseline ✅ DONE (2026-10-25)

Machine-verified hidden/ignored first-party text search plus read-only app/source review found **1,097 matched lines in 217 files**. These are search hits, not 1,097 edits; historical records are included. Counts exclude the newly written audit documents themselves.

| Area | Files | Lines | Main meaning |
|---|---:|---:|---|
| Command | 129 | 703 | CSS/Tailwind namespace, selectors, recovery key, README/comment |
| Booker | 3 | 4 | Sidebar copy, access-error copy, recovery key |
| Vendor | 4 | 5 | Storage keys and stale KYC plan comment |
| Vendor mobile | 1 | 2 | Absolute instruction paths |
| Booker mobile / backbone source | 0 | 0 | No stale tokens under exclusions |
| Root plans/previews/harnesses | 66 | 344 | Token copies, absolute paths, historical evidence |
| Architecture | 3 | 6 | Prose, recovery-key contract, connection alias |
| Other root documents | 3 | 9 | Costs, handoff, obsolete instruction backup |
| Prototypes | 6 | 6 | Active prompts and old school prototype |
| Website | 1 | 17 | Old road-safety landing page |
| Shared core rules | 1 | 1 | “RS Command” in workspace map |

The appendix lists **every matching file and line** from this scan, its reproducible command and exclusions. Includes ignored app repositories, `website/` and `prototypes/`, which default root `rg` misses. Filename review additionally found `website/rs-logo.jpeg`, `.idea/RS.iml`, and paired `.idea/modules.xml:5`.

Excluded from content search: credential/env files and `.aws`, local agent settings, Git internals/history, dependencies/third-party skills, lockfiles, builds/caches, logs/reports, maps, SVG payloads and binary image content. No OCR or hosted/external configuration inspection. Local IDE references are supplemental. Therefore this is a bounded source/documentation audit, not a guarantee of zero RS strings anywhere on disk or in hosted accounts.

### F2 — Existing naming work and false positives ✅ DONE (2026-10-25)

Read `.plans/INDEX.md`, the 2026-07-14 app-name plan, 2026-10-18 preview-harness plan and 2026-10-20 dark-mode plan; cross-checked architecture overview, conventions, portals, schema and booking-flow. This plan follows their app independence, naming constants, CSS values, schema immutability and deployment direction.

- The 2026-07-14 plan's broad app-brand completion claim does not cover the current Booker sidebar/access-error literals. These are newly observed omissions, not permission to close or rewrite the predecessor's other follow-ups.
- All three web package names and both mobile app identities already say Ezzy. Command's actual sidebar uses `APP_NAME`; its many CSS hits do not imply its displayed brand is still RS.
- Initial broad suffix searches matched `members_` and `vendors_` inside SQL/index identifiers, including `architecture/schema.md:54`. Corrected with a leading word boundary; no SQL rename is justified. Also preserve `CORS`, `FIRST`, `HEADERS`, binary/base64 fragments and dependency names.
- `backbone/supabase/config.toml:5` uses local project ID `api`, independent of the parent folder. No schema, migration, seed or Edge Function naming change identified. No DB lock, data rewrite or generated type work is required.
- Both mobile app identity configurations already use Ezzy; neither has checked-out native `android/`/`ios/` projects. No store release or native identifier migration is justified.

## BLOCKERS — conditional safety requirements for their own batches

B1–B3 are not global prerequisites for I4. Their ordering follows the priority/dependency tables above.

### B1 — Preserve browser state during any key rename ⬜ TODO

**Files:** `command/lib/supabase/client.ts:43`, `booker/lib/supabase/client.ts:43`, `vendor/lib/supabase/client.ts:44`; `vendor/lib/constants.ts:1`; `vendor/components/layout/AppShell/useAppShell.ts:293,296,737,764`; `vendor/lib/supabase/recoveryRequestClient.ts:29`; `architecture/auth-and-roles.md:135`.

**Risk:** A simple `rs.recovery` replacement drops the tab's recovery obligation after the URL fragment has been consumed, allowing a refresh to skip the set-password screen. Losing `rs_selected_vendor` can switch a multi-vendor user's context. The separate recovery-request client has persistence disabled, so its key has lower migration impact, but remains auth configuration.

**Proposed exact naming contract, subject to D3:** `rs.recovery` → `ezzy.recovery`; `rs_selected_vendor` → `ezzy_selected_vendor`; `rs-recovery-request` → `ezzy-recovery-request`.

**Fix approach:** New recovery code reads both old and new flags (logical OR), maintains both while compatibility with older bundles/tabs is needed, and clears both on every existing discharge path. Keep privacy-mode try/catch behaviour. Vendor selection reads the new key first, falls back to the legacy key, validates against current memberships before using it, and writes/removes both through existing selection/logout paths during compatibility. Never broaden access or trust stored IDs. No auth algorithm, cookie/session ownership or PKCE change. Keep legacy support until a separately approved retirement; this plan may legitimately retain the old key strings as compatibility constants.

**Separation:** Any `useAppShell` changes stay in its existing controller hook; no persistence logic enters `AppShell.tsx`. Recovery helpers stay in the existing client modules; do not introduce a shared package across independent apps.

**Verification:** Focused regression cases for old-only/new-only/both/no keys, successful reset and “Back to Sign In” clearing, reload after fragment consumption, blocked storage, membership-invalid stored vendor, valid multi-vendor selection and logout. Local automated tests where practical; staging same-browser and cross-browser reset/onboarding checks for all three apps. Do not send recovery emails or operate real accounts during baseline testing without authorisation.

**Priority:** Group 2; invisible browser state, not a customer-facing RS label. No dependency on I4 or B2.

**Gate:** Security-related and cross-app change requires explicit approval. Coupled with I1 recovery-key documentation; deploy the three app changes as one verified batch. No DB changes, locks or data rewrite. Rollback must keep both storage names readable; reverting to old-only readers is safe only while the compatibility write policy remains in place.

### B2 — Make Command namespace changes atomic ⬜ TODO

**Files:** `command/app/globals.css:7,72,146`; `command/tailwind.config.ts:14`; all Command locations in the inventory; `command/visual-tests/closures.spec.ts:31,53,69`; `command/visual-tests/payouts.spec.ts:48,277,306,339,361,378,418,435`; `.plans/previews/_shared/command.css:9`; `.plans/previews/_shared/shoot.mjs:438`; `.plans/previews/dark-lift-command/tokens.css:20`, `screens.js:56`, `preview.css:20`.

**Risk:** Missing one producer/consumer can remove colours, layout or selector coverage across nearly every Command page. Root preview tooling is in a different repository from Command.

**Exact rename direction:** `--rs-*` → `--ezzy-*`, `.rs-*` → `.ezzy-*`, Tailwind `colors.rs` → `colors.ezzy`, including `text-rs-*`/`border-rs-*` utility tokens, dynamic class strings and visual-test selectors. Change only identifier tokens, preserving CSS values, selector specificity and class combinations. Update preview generators, shared adapters, copied snapshots of tokens, active READMEs and comments in the same batch. Never edit historical evidence merely to make grep return zero.

**Separation:** For every inventoried Command component, edit class strings only in its existing render file and token references in its existing CSS module; hooks and event handlers stay in their current controller files. No new inline styles, new component logic or unrelated separation refactor. Standalone preview JS/CSS retains the existing preview architecture.

**Verification:** Inventory-based producer/consumer scan, `npx tsc --noEmit`, build, existing unit suites and Command visual suites; inspect light/dark desktop/mobile including error, not-found, dialogs, payouts, closures, settings and gallery. Run the existing preview runner after checking its documented invocation. Screenshots should remain visually equivalent except the explicit preview brand text under I1. No automatic blanket snapshot acceptance.

**Priority:** Group 3. This is not required for customer/vendor-visible branding fixes.

**Coupling:** Root preview consumers and Command namespace must land together locally. Coordinate with the existing dark-mode/preview plans; do not change their approved palette or reopen their completed work.

### B3 — Prepare the local folder move without breaking tooling ⬜ TODO

**Files:** `.plans/scripts/build-division-mask-css.mjs:4,7,8`; `.plans/previews/booker-home-divisions-layout/build-logos.mjs:6,8`; `measure.mjs:20`; `.plans/scripts/s1-tier-ladder-differential.ts:29–30`; `.plans/scripts/run-checkout-provider-tests.bash:29`; `.plans/scripts/README.md:87,153,215`; `ezzy-vendor-mobile/AGENTS.md:7,15`; `prototypes/prompts/2026-10-18-booker-ui-preview.md:7` and the other prompt paths in the appendix; `.idea/modules.xml:5`.

**Fix approach:** Resolve active JS imports/assets from `import.meta.url`/existing workspace-root helpers, shell commands from the script location or documented workspace-root working directory, and replace instruction paths with relative boundaries without weakening approval rules. For the one-off S1 differential script, preserve the dated proof and its explicit expired-baseline warning; classify as archival or make imports portable without rerunning obsolete proof. Do not recreate a baseline or run provider scripts as a naming check.

**Future user move:** `/home/joshua/RS` → `/home/joshua/Ezzy`. No move command runs in this plan until separately authorised for that action. Parent is outside the current writable root; end/reopen the session at the new path so sandbox permissions, skill paths and agent context are refreshed. Do not rename `.git` folders or nested app directories. A plain parent move keeps independent Git histories, remote URLs and relative paths intact, but absolute links, worktree metadata and running processes may not survive.

**External/local checks, user-owned:** Before moving, inventory worktrees/submodules with read-only Git metadata checks; confirm no absolute `gitdir`/worktree dependencies. Review only nonsecret path settings for Codex trusted-workspace/skill roots, Claude project/MCP registration, IDE project/modules, launchers, shell aliases, task configs, emulator/Metro watchers and any Docker bind mounts. Historical `.plans/2026-10-15-split-agents-md-into-skills.md:53` documents trust at the old path; `.plans/2026-09-24-local-docs-search-rag.md:4,109` records an external, unregistered `rs-docsearch` installation. These are leads, not live-configuration verification. Do not open `.env`, credential stores or provider state. No external edit, restart, deletion or reinstall is authorised by this draft.

**Verification:** Before move, static scan and offline module resolution for changed scripts. After user move, reopen workspace and each independent repo, confirm Git roots/status, skill discovery and app-local commands resolve, then rerun relevant local checks. Recreate ignored IDE state or rename the `RS.iml`/modules reference pair only after the user chooses to retain that project configuration. Do not delete `.idea` wholesale.

**Blast radius/rollback:** Local workflows only; moving the local folder does not change deployed hosts or DB project IDs. User can move it back while tools are stopped and restore path settings. Hosted deployment impact is only through changed deployable app code, handled in Release. The path-preparation gate applies before the physical move only. Neither the move nor its post-move checks block a visible-copy release from the existing workspace.

## IMPORTANT

### I1 — Align internal documentation, comments and preview branding ⬜ TODO

**Files:** `command/README.md:1`; `production-costs.md:1`; `.claude/skills/core-rules/SKILL.md:12`; `command/services/kyc-admin.service.ts:1`; `vendor/services/kyc.service.ts:1–2`; `.plans/previews/dark-lift-command/screens.js:58`; `CHECKOUT-HANDOFF.md:621,636,767`; `architecture/supabase-production-setup.md:53`; `prototypes/prompts/2026-10-25-affiliate-dashboard-discovery.md:3`.

**Priority:** Group 3. Customer-visible Booker copy is tracked separately as I4.

**Fix approach:** Command preview brand becomes “Ezzy Command”. Active prose uses Ezzy; plan-location comments use workspace-relative paths. Update B1's documented key only with the implemented compatibility contract. Annotate the old-name history once where helpful instead of silently altering evidence. Keep completed plan dates/statuses and unrelated follow-ups intact.

**Separation:** Preview branding remains in the existing preview render helper and CSS architecture; no new state, inline styles or layout change. Documentation examples of tokens/keys are coupled to B2/B1 respectively, ordinary brand prose is independent.

**Verification:** Targeted internal literal scan, Markdown relative-link check and preview naming review. Verify recovery-key docs against B1 and executable token examples against B2 when those batches change. Historical narrative follows D2.

### I2 — Classify obsolete website, prototype and instruction backup 🔄 IN PROGRESS (2026-10-26)

**Local folder cleanup executed (2026-10-26):** Both target paths absent; recovery copies and their Git directories verified. Root `.gitignore` obsolete entry removed. No active first-party app/code/config imports or URLs referencing either folder, its legacy logo, or old linked portal domains found under the documented exclusions. Only historical plan/audit references remain. No app source was edited. Booker promo images changed concurrently during this operation; preserved as unrelated user work, so exact before/after clean-tree equality is not claimed. Builds/tests were not rerun because no application code or dependency changed. I2 remains in progress for the unapproved instruction backup disposition. I5 hosted exposure/removal remains unverified: local removal cannot prove a staging deployment is gone.

**Files:** `website/index.html:6,235,245,279,408,548,579`; `website/rs-logo.jpeg`; `prototypes/school-client/app/page.tsx:260`; `AGENTS.md.backup:7`.

**Priority:** I5 determines whether website/prototype content belongs in group 1 (external exposure) or group 2 (local archive); instruction backup is group 2. Neither disposition blocks I4.

**Risk:** The website promotes the retired driving-certification business, not simply a stale name. Replacing RS alone would make obsolete claims look current. These folders are ignored by the root repo, so deleting/archiving them may have no root-Git recovery path.

**Direction subject to D1:** Recommend a recoverable, user-approved archive of the obsolete website and school prototype, with a retained inventory/provenance note outside active product paths; verify inbound references first. Do not archive the whole `prototypes/` directory: it contains current prompts. For `AGENTS.md.backup`, verify it is unreferenced and contains no unique current rules, then use recoverable removal if approved; never replace the live AGENTS instructions with it. No deletion command or archive destination is authorised yet; D1 must settle exact retained paths/destination before approval.

**Verification:** Search all first-party references to candidate paths; confirm archive contents/checksum and recovery route before source removal. If rebranding is chosen instead, scope a separate content/design review rather than a blind text swap. No obsolete page is deployed by this plan.

### I3 — Preserve evidence and external aliases deliberately ⬜ TODO

**Priority:** Group 2 for records/fixtures; group 3 for internal alias documentation. No dependency on customer-facing copy.

**Files:** `.plans/scripts/checkout-provider-runner.mjs:9–14,107`; its test file; `.plans/2026-10-11-checkout-provider-verification.md:89,122–123,137,139`; `CHECKOUT-HANDOFF.md:446,456`; `architecture/staging-readonly-role.md:47,58,113,117`; historical plan locations in the inventory.

**Risk:** Payment harness constants compare exact metadata labels against existing provider resources. Renaming recorded labels invalidates fixture identity checks. `psql service=rs-staging` must match user-level connection configuration; changing only documentation breaks the runbook.

**Direction:** Preserve existing `RS-S2-*` proof identifiers, replay/idempotency evidence and recorded `/tmp/rs-checkout-syntax-*` paths. Add a legacy-evidence explanation to active harness docs; use Ezzy only for a future separately authorised fixture generation with matching tests. Do not run the existing provider harness or alter payment state. Preserve `rs-staging` as a documented legacy alias unless a later, specifically approved user-level configuration change atomically updates the alias and all instructions. No need to rename an external `rs-docsearch` directory for an unregistered server that is already covered by a completed plan.

**Verification:** Offline diff review confirms existing proof constants/evidence are unchanged; docs clearly identify accepted exceptions. Alias is not claimed renamed or live-verified. D2 decides the historical prose policy; machine evidence stays exact even if prose policy changes.

### I4 — Correct customer-visible Booker branding ✅ DONE (2026-10-26) — local implementation and E3 checks verified; hosted staging/production deferred

**Local outcome (2026-10-26):** User approved E2 and continuing into E3, explicitly skipping E4/E5 for now. Sidebar renders existing APP_NAME/“Client Portal”; no-access message interpolates APP_NAME. 29 test entries, TypeScript, Webpack production build, exact diff, four light/dark phone/desktop sidebar cases and six mocked login-before/after cases passed. No application logic/storage/style/data changes. Hosted acceptance/release remains parked in the Booker-only plan; I4 local completion is not a deployment claim. No other app changed. Source and tests preserve unrelated promo-image work.

**Files:** `booker/components/layout/Sidebar/Sidebar.tsx:58–59`; `booker/components/auth/LoginPage/useLoginPage.ts:19`; existing source `booker/lib/constants.ts:160`.

**Priority:** Group 1, first implementation delivery after a scoped plan is approved. Confirmed source strings: “RS Booker”, “RS Client Portal”, “You do not have access to RS Booker.” These affect customers using navigation or seeing an access error. No corresponding stale display literals were found in vendor/mobile source.

**Fix approach:** Import the existing `APP_NAME` constant into both files. Render it verbatim for the product name and interpolate it in the access error; descriptor becomes “Client Portal”. Respect `architecture/overview.md:11`: `APP_NAME` is already the complete per-app product name. No parent-folder, CSS namespace, browser key, database or auth-flow change.

**Separation/UX:** `Sidebar.tsx` remains render-only with its existing CSS module and caller-supplied handlers; message construction stays in `useLoginPage.ts`. No new state, static inline styles or unrelated component refactor. Preserve navigation/accessibility and inspect configured-name wrapping/truncation at desktop and phone widths in both themes.

**Prerequisites:** Existing constant is available now. Verify the intended Ezzy value in the target environment without reading unrelated env/secret files. The current fallback is not an Ezzy name; fail the branding check if a deployment is misconfigured rather than silently widening this change into environment handling. No dependency on D1–D3, B1–B3 or I1. A separate first-delivery plan must exclude those decisions before execution so this draft's global decision gate does not hold up visible work.

**Verification:** Targeted source scan; Booker type-check, existing tests and build; local and staging sidebar/drawer, no-access message and long-name layout checks; user confirms staging before promoting the exact tested deployment. No claim that current deployed customers have seen this literal until runtime is checked.

### I5 — Establish exposure of legacy website/prototype 🔄 IN PROGRESS (2026-10-25)

**Files:** `website/index.html:6,235,279,579`; `prototypes/school-client/app/page.tsx:260`; exposure caveat `.plans/2026-08-02-web-apps-search-engine-exposure.md:31–33`; root `.gitignore:1–6`.

**Priority:** Group 1 investigation, before deciding the urgency of I2.

**Step 1 investigation (2026-10-25):** User authorised baseline/exposure investigation only. Local records searched; no authoritative staging URL mapping found. `website/index.html:253,258` links to old portal domains, which are not its own hosting evidence. Booker baseline: clean `feature/visible-branding-cleanup`, 29 test entries passed, TypeScript passed. Details in `.plans/2026-10-25-booker-visible-branding-cleanup.md` E1. Live I5 verification remains pending the two URLs and audience/access context; no source or hosted changes.

**User confirmation (2026-10-25):** Both `website/` and `prototypes/school-client/` are on staging and the user is still flexible about both. This supersedes the older not-deployed assumption for current planning. This is user-reported environment evidence, not an independently inspected deployment. Staging URLs, deployed-source mapping, access restrictions and whether vendors/customers use these surfaces remain unverified. Flexibility is not a decision to archive, rebrand, delete or deploy. Next: obtain the two URLs and audience/access context; then inspect read-only and refine D1.

**Approach:** Review available nonsecret deployment/link records for these two surfaces. Establish hosted URL/current deployment or active shared-preview use. If no authoritative destination is available, ask the user for it and record exposure unknown. Do not browse guessed domains, inspect credentials, deploy, disable hosting or delete local files. If exposed, raise I2's website/prototype action to group 1 and resolve D1 plus exact hosted-action scope before approval; if local-only, keep I2 in group 2.

**Verification:** Record evidence source/date and distinguish deployment record, live URL inspection and user confirmation. A confirmed public destination requires its own read-only page check; local archival is never proof of removal from hosting. This unknown must be disclosed but does not prevent independent I4 delivery.

## DECISIONS — resolve before execution approval

### D1 — Obsolete content disposition ⬜ TODO

**Resolved for the two folders (2026-10-26):** After viewing them, user explicitly approved deleting `website/` and `prototypes/school-client/` and removing references. Both removed from the workspace with recoverable copies at `/tmp/ezzy-retired-legacy-2026-10-26-eejkvllz/website` and `/tmp/ezzy-retired-legacy-2026-10-26-eejkvllz/school-client`, including their independent Git histories. `/tmp` is temporary recovery, not durable backup. Removed obsolete `website/` root ignore entry; retained `prototypes/` ignore because current prompts/prototypes remain. Active app/tooling scans found no incoming references to remove. Historical audit/plan references remain evidence, marked retired rather than rewritten. No permission to remove `AGENTS.md.backup` was inferred; its disposition remains OPEN under I2. No hosted deletion performed or claimed.

### D2 — Historical documentation policy ⬜ TODO

**OPEN:** Preserve completed historical plans/proof text with a legacy note (recommended), or update historical narrative too? Active instructions and executable paths are updated either way; external proof labels and historical execution evidence remain exact. Asked 2026-10-25; no answer recorded yet.

### D3 — Browser key policy ⬜ TODO

**OPEN:** Migrate to Ezzy keys using B1 compatibility reads/writes/clears (recommended), or retain the old keys as explicitly documented legacy identifiers? The latter defers the security-sensitive migration and reduces immediate risk. Asked 2026-10-25; no answer recorded yet.

**Dated priority direction (2026-10-25):** User requested visible customer/vendor findings first, clean data second, architecture/branding consistency third. Recorded in the grouping and dependency tables; this does not resolve D1–D3 or authorise implementation.

All OPEN decisions block execution of this umbrella plan. A visible-only delivery must first be split into a plan excluding unrelated open decisions. This document is for review; it is not yet an execution approval request. Root folder move is a later user action, not implicit permission from choosing a naming policy.

## DEFERRED / COSMETIC

- **Historical proof labels, logs and migration identifiers:** retain because identity/provenance outweigh a literal zero-RS count. No migration rewrite or provider resource mutation.
- **Dependencies, locks, build output and binary payloads:** no source replacement. Regenerate relevant outputs from cleaned source; inspect visible artwork only if a stale mark is suspected. No evidence-based reason to rewrite dependency names or mobile identifiers.
- **External user configuration:** inventory/update only with explicit scope and safe nonsecret handling; outside-workspace writes remain gated. No claim that these checks have been completed.

## Blast radius

| Batch | Radius / severity | Data, performance and recovery |
|---|---|---|
| Active brand copy/docs (I1) | Low; Booker UI and root docs | No DB/data effect; longer-name layout check; revert text/imports if needed |
| Command namespace (B2) | Medium-high; nearly entire Command UI, visual selectors and root previews | No intended runtime behaviour/value change; missed tokens break styling; ship atomically, restore complete producer/consumer batch on rollback |
| Browser keys (B1) | High for recovery; all three web apps and vendor context | Browser state only; no server data migration/lock; preserve old/new compatibility through rollback; existing role checks remain authoritative |
| Parent path preparation/move (B3) | High local disruption potential; tooling, agents, IDE and running processes | No hosted change from moving folder; fresh session needed; restore old path/settings for rollback |
| Archive/delete candidates (I2) | Medium; ignored local content may lack Git recovery | Recoverable copy and verified provenance required; no permanent deletion; restore archive if needed |
| Proof and connection aliases (I3) | High if changed indiscriminately | Keep exact identifiers; no provider replay, no live DB operation; no rollback needed for retained aliases |

**No schema change is proposed.** No tables, RLS, grants, API contracts, notification audiences, storage buckets or hosted domain names need renaming based on this audit. No database lock/performance cost. Hosted configuration and actual stored rows were not queried, so external names remain an explicit audit limit.

## Execution order

**Planning prerequisite:** Separate the priority-1 delivery into its own approval-ready plan before implementation; leave lower-priority work in draft follow-ups. No decision is silently resolved or parked by this reprioritisation. Each deployable delivery has a separate local → staging → production cycle, production last; no single plan releases to production and then resumes implementation of another group.

For a priority-1 plan, the proposed stages are:

1. **Baseline and exposure triage:** Booker repo-specific diff/test baseline; I5 read-only exposure assessment. Record unknown external exposure honestly; do not block I4 on finding a URL.
2. **Visible-copy implementation:** I4 only; source/wording and both-theme narrow/wide layout checks. If I5 proves public legacy exposure, scope that action separately with D1 rather than bundling unapproved removal into I4.
3. **Local verification:** Booker type-check/build/tests, literal scan and manual drawer/access-error review. No provider harness, browser storage migration, Command rename or folder move.
4. **Staging release:** Apply S1–S3 narrowed to Booker and I4; user verifies staging green.
5. **Production release:** P1–P3 narrowed to the exact tested Booker deployment, always last.

Then, in separate plans/scopes approved before execution:

- **Priority 2:** D3 → B1 compatibility contract + I1 recovery docs → local regression checks → staging → production. Independently D1 → I2 verified local archival; D2 → I3 record policy. No SQL/data-write stage unless later evidence warrants a separately specified approval gate.
- **Priority 3:** B2 atomic Command/root-preview namespace batch + coupled I1 examples; other I1 prose independent. B3 portable-path preparation precedes any separately authorised folder move and does not block earlier releases. Each deployable batch ends with local → staging → production.

**Safe first implementation scope after its own approval:** I4. **Investigate early:** I5, because confirmed public exposure can raise I2. **Never promote merely because it is a safety blocker:** B1/B2/B3 become urgent when their corresponding migration/rename/move is scheduled, not because visible copy depends on them.

## Release

Audit/plan documents themselves: **Release: none**. The following is the release template for each separately approved delivery; narrow its checks to that delivery before approval. First recommended scope is I4/Booker only, not all three web apps. Future approved web code changes follow local → staging → production. Root docs, archives and mobile instruction paths require no hosted/mobile release.

### Staging — production untouched

| Step | Who | Exact action / check |
|---|---|---|
| S1 ⬜ TODO | 👤 + 🤖 | Record selected app commits/deployment scope; run `npx tsc --noEmit`, `npm test`, `npm run build` from each changed web-app directory. Resolve existing failures explicitly. Do not deploy unrelated pending checkout work. No `db push`, Edge Function or secret changes are needed. |
| S2 ⬜ TODO | 👤 | Manually deploy the approved commits to each app's existing staging Vercel project using its established dashboard workflow. Record the three immutable deployment URLs/IDs; this draft does not invent unverified project IDs or CLI flags. |
| S3 ⬜ TODO | 👤 + 🤖 | Verify `staging-command.ezzy.ph`, `staging-booker.ezzy.ph`, `staging-vendor.ezzy.ph`: configured product names, Command light/dark styling and dialogs, Booker desktop/drawer/error copy, old/new recovery reload+clearing, vendor selection/logout. Confirm correct staging Supabase connection. User records staging green; a parked test requires an explicit dated decision before production. |

**Staging fully green and user-confirmed before production.** If a staging fix is needed, return to local and repeat staging. B1 compatibility supports app version skew because each portal has its own origin/storage; do not make a cross-origin storage migration.

### Production — last stage

| Step | Who | Exact action / check |
|---|---|---|
| P1 ⬜ TODO | 👤 + 🤖 | Parity pre-check: compare staging/production app versions, migration histories and function versions using established read-only deployment records. Expected pending set: this plan's approved web-app commits only, zero DB/function/secret changes. Record exact tested staging deployment IDs. Stop on unrelated drift; this plan does not authorise fixing it. |
| P2 ⬜ TODO | 👤 | In each existing Vercel project, **Promote the exact S2 deployment tested by S3** to production; do not rebuild from a different commit. Record promotion/deployment IDs. No database/function operations. |
| P3 ⬜ TODO | 👤 + 🤖 | Check production Booker brand/error surfaces and Command styling, correct Supabase targets and compatible recovery/selection behaviour using user-authorised checks. If rollback is needed, promote a known tested compatible deployment; retain old/new browser keys. Record verification limits and any remaining user-owned checks before closing. |

## Verification and completion criteria

- **Priority review 2026-10-25:** Reopened Booker visible literals, existing naming constant, browser-state key and Command token map; cross-checked architecture naming and the historical website-exposure caveat. Split I4/I5 from internal cleanup and reviewed each dependency for necessity. Deployment later confirmed by the user for both legacy surfaces on staging; URLs, audience/access and live content remain unverified. I5 investigation is in progress; no implementation item marked done.
- **Performed 2026-10-25:** read-only hidden/ignored lexical scans, file/line inventories, actual source review per app, filename review, predecessor/architecture review; generated index refreshed after writing this draft.
- **Not performed during this audit:** baseline app builds/tests, browser/device checks, live recovery emails, provider harnesses, DB queries, hosted deployments, external configuration inspection or parent-folder move. This is audit evidence, not behavioural readiness. Baseline app tests belong to execution stage 1; existing checkout harness restrictions remain in force.
- Each B#/I# has its own checks above. No “DONE” execution marker until those checks actually pass; distinguish machine output from user-reported live checks.
- For all files in the inventory, record rename, recoverable removal/archive, or retained-exception disposition. Retained compatibility constants, evidence and external alias names are expected. New audit documents necessarily mention the old name.
- Before approval, review for weak interpretations: no global `RS` substring replacement, no cosmetic-only auth rename, no partial namespace rename, no delete of ignored content without recovery, no rewriting past evidence, no current instruction path changed prematurely, no unrelated changes bundled into deployment. Existing component separation, roles and data invariants remain unchanged.
- On completion, update this plan's dated item statuses and RESUME block, regenerate `.plans/INDEX.md`, and report shipped/retained/parked outcomes and outstanding live checks honestly.
