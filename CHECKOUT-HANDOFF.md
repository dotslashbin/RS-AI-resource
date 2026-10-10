# Checkout collaboration and Claude resumption guide

**Updated:** 2026-10-10 (Claude's report received and reviewed; documentation reconciliation approved; durable validation evidence, environment history and S2 technical/approval gates remain open)
**Purpose:** a durable reference for this one-off Codex/Claude overlap. Not implementation approval, a second specification, or a command to start Claude.

## Source of truth

- [Canonical checkout plan](.plans/2026-09-29-vendor-kiosk-custom-checkout.md): approved D1–D34 (D32 superseded by D33), open G1–G8/B6/B7, shared backend, Vendor-first and Booker-later work packages, execution stages and evidence.
- [S2 contract appendix](.plans/2026-10-07-checkout-s2-contracts.md): subordinate `s2-draft-1`, state/operation/API/worker/delivery proposals, X1–X5 technical gaps and acceptance checks. Not frozen contracts or executable SQL; never implement both its proposed model and the canonical plan's old kiosk SQL sketch.
- [Vendor visual previews](.plans/previews/vendor-checkout/README.md): S3-P1/P1a design-only artifacts, thirteen mock states plus desktop/phone screenshots. Desktop and existing mobile visuals accepted by user; records reconciled 2026-10-08. S3-P3 revised compact phone preview executed/layout-checked after approval; revised visual acceptance pending, desktop screenshots unchanged. Application components deferred until explicit user resumption/approval. No app changes, new packages, live payment/auth or frozen API contract; mock navigation shortcuts are not payment logic.
- [Plan index](.plans/INDEX.md): other workstreams/statuses; generated, not hand-edited.
- [Project instructions](AGENTS.md), [Vendor instructions](vendor/AGENTS.md), [Booker instructions](booker/AGENTS.md); each applicable app's `CLAUDE.md` imports `AGENTS.md`.
- Architecture: [booking flow](architecture/booking-flow.md), [schema](architecture/schema.md), [auth/roles](architecture/auth-and-roles.md), [conventions](architecture/conventions.md), [portals](architecture/portals.md), [deployment safety](architecture/database-reset-and-deploy.md).

Project instructions constrain the work. The canonical plan owns current approved product decisions; older plan text or remembered chat does not override them. Code/migrations establish implemented behaviour, not approval. If actual code, docs or session memory disagree, report the conflict and reconcile before editing; do not silently choose whichever supports implementation.

## Approval boundaries — read before resuming

The canonical [approval boundary register](.plans/2026-09-29-vendor-kiosk-custom-checkout.md#approval-boundary-register--2026-10-08-h2-c--step-3) is the dated classification of existing authority, not another specification or new approval. Current product decisions D1–D31/D33–D34 and desktop/existing phone visuals are accepted; D32 is ABORTED. Mock app components are deferred by user direction. Shared backend ownership is assigned, but exact schema/security/implementation/deployment remains gated. `s2-draft-1` is still DRAFT; proposed API/record/worker/auth details are not frozen just because they are written down.

Distinguish explicit acceptance, S1's limited code checks and preview-only checks from unperformed DB/provider/email/installed-PWA/device verification. X4-tab research resumed 2026-10-08 and remains a rollout gate; Command/operator/native-mobile/extra-method follow-ups remain deferred. Operational email/Dashboard choices do not prove account permissions or delivery. No closure of a technical requirement or follow-up is implied by this reconciliation.

**H2-c / step 3 complete (2026-10-08):** classification was checked against the plan's Decisions/stage evidence and the user's approvals/deferrals, with local-link and whitespace checks. No app code, migration, technical contract semantics, Git state or runtime changed. Step 4 briefing preparation is now recorded below under H2-d; Claude must still identify its existing task/approval boundary, reconcile overlap and report before the user authorises further edits. This document does not launch Claude or hand it Booker S5 implementation authority.

## Ownership during this overlap

| Area | Boundary |
|---|---|
| Git operations in every repo | User performs commits, branches, switches, merges, rebases and pushes. Agents may inspect and advise only. |
| Vendor checkout | Codex's proposed immediate focus; implementation still requires stage approval. |
| Claude's existing task | Consolidation correction/local validation reported finished 2026-10-09. Next request is evidence/history clarification, not automatic resumption or Booker S5 assignment. |
| Shared backend | Codex assigned necessary Booker payment backend for Vendor-first S2 (D18). Claude supplies evidence for its completed consolidation. B7 and exact S2 approval gates remain open; shared files have one designated editor at a time. |
| Shared docs | Plan, architecture and app instructions: one editor at a time; preserve another session's notes and user-owned changes. |
| Command | Existing refund/dispute/payout paths stay compatible. No new Command UI authorised. |

No worktrees are required for this one-off arrangement. Different branches in one checkout do not isolate files; do not change a branch beneath a paused/running session. Independent Vendor/Booker repositories reduce file overlap but share Backbone, docs and runtime resources. Do not restart services, reset databases, migrate, deploy or change provider configuration without applicable approval.

## Latest local repository snapshot — 2026-10-08 (H2-b / step 2)

**Historical snapshot:** the 2026-10-10 reconciliation report below supplies the newer repository observation. Subsequent documentation edits affect root and Vendor/Booker instruction files; neither dated snapshot is a continuously current status feed.

Read-only Git inspection of the four checkout-relevant repositories. This supersedes earlier branch/commit/dirty-state observations, not historical design/verification evidence. It is a snapshot, not a guarantee about later edits. No fetch was run: upstream comparisons use the last locally available remote-tracking refs and do not establish current remote/staging/production state.

| Repository | Local branch / HEAD | Uncommitted state | Local upstream comparison |
|---|---|---|---|
| Workspace root | `master` / `86dac68` | Modified canonical checkout plan, S2 contract appendix and this guide; untracked `.plans/previews/vendor-checkout/` (five text/source files and twenty-four PNGs). Root also reports unrelated dirty contents in `ezzy-vendor-mobile`; not inspected/changed in this step. | Matches local `origin/master` ref |
| Vendor | `feature/booker_setup` / `325d5fe` | Clean. S1 `878155a` is an ancestor of HEAD (reverified). | Ahead of local `origin/feature/booker_setup` by two commits |
| Booker | `feature/search_ui_enhancements` / `ee1b483` | Modified `AGENTS.md` only; preserve the other session's instruction edit. No untracked files reported. | Matches local `origin/feature/search_ui_enhancements` ref |
| Backbone | `feature/booker_gaps` / `5c7980a` | Four tracked migration deletions; one untracked consolidated migration and one untracked SQL snippet, listed below. Preserve owner changes; no content/SQL validation performed in this step. | Matches local `origin/feature/booker_gaps` ref |

No staged changes were reported in these four repositories. All checkout documentation/preview work in the root is currently uncommitted; do not describe it as committed or deployed. User retains every Git write operation. The dirty mobile work is not checkout work merely because the root reports it.

**Backbone owner work awaiting reconciliation (paths only):**

- Deleted `supabase/migrations/20261003000001_booker_cancel_booking.sql`.
- Deleted `supabase/migrations/20261003000002_refund_requests.sql`.
- Deleted `supabase/migrations/20261003000003_resolve_dispute_status_note.sql`.
- Deleted `supabase/migrations/20261004000001_refund_from_delivered.sql`.
- Untracked `supabase/migrations/20261003000001_booker_refunds_and_cancellation.sql`.
- Untracked `supabase/snippets/Untitled query 177.sql` (contents not inspected).

**Verification and limits:** inspected local branches, HEAD subjects, status, tracked diff summaries, untracked paths and staged-path lists; checked S1 ancestry. No commits, switches, merges, resets, pushes/fetches, app/migration edits, service changes, credentials, database/provider checks or migration replay. Earlier unterminated-COMMENT/return-type findings below remain historical findings for the owner to revisit; their current presence/absence was not re-audited by a Git snapshot. Working-tree status cannot prove SQL correctness, deployed migration history or Claude's exact remaining task. B7 stays open. Steps 3–4 and Claude's read-only checkpoint remain pending; H2 is not complete. Refresh this snapshot again if files/commits change before Claude resumes.

## Historical snapshot — 2026-10-06, superseded by the 2026-10-08 local snapshot

This is a dated observation, not a promise that branches or dirty files remain unchanged.

| Repository | Observed branch / commit | Relevant state on 2026-10-06 |
|---|---|---|
| Workspace root | `9cd9635` before this documentation pass | This pass modifies the canonical plan/index and adds this guide. Existing mobile worktree changes are unrelated. |
| Vendor | Originally `bb8497b`; now merge `325d5fe` on `feature/booker_setup` | User integrated S1 `878155a`; ancestry verified. Working tree clean on 2026-10-07; ahead of upstream by two commits. User handles any push. |
| Booker | `feature/search_ui_enhancements` / `ee1b483` | `AGENTS.md` modified. Pay now and persisted-status return messaging are implemented; no direct checkout lifecycle yet. Preserve the instruction edit. |
| Backbone | `5c7980a` | Four tracked migration deletions and an untracked consolidated `20261003000001_booker_refunds_and_cancellation.sql`; snippets untracked. The replacement's COMMENT string at line 57 is unterminated; do not apply/copy as-is. Owner validates history and replay before dependent payment changes. |

No secret/env values, payment URLs, client keys, raw provider payloads or customer data belong in this guide. Refresh commit IDs and dirty-state summaries, not credential files. Do not auto-commit to make the snapshot clean.

### Subsequent checkpoint — 2026-10-06

The user merged Vendor `feature/payment_flow_revamp` into `feature/booker_setup`; merge `325d5fe` contains S1 `878155a` (Git ancestry verified). User assigned Codex the necessary shared Booker payment backend for Vendor-first S2, not Booker custom UI/S5. Claude retains correction/validation of its existing Backbone migration consolidation. Read-only comparison found a second consolidation defect: `raise_booking_dispute` declares void instead of its original UUID return type while retaining a return expression. No migration edits or DB checks were performed. Dependent implementation waits for Claude; design and independently reviewed subsets may continue. User accepted Supabase Cron + Edge Function as worker design direction (canonical D19), not deployment/configuration approval. Other snapshot entries above remain dated observations, not newly verified state.

## What Claude's recent plans actually say

**Preview checkpoint (2026-10-07):** user approved generating isolated Vendor checkout visual previews. S3 is now IN PROGRESS for design artifacts only; application integration remains unstarted. Standalone HTML/CSS/JS and a local Playwright check live in `.plans/previews/vendor-checkout/`. Theme/state, responsive, touch-target, mock navigation and privacy-copy checks passed; real cross-tab privacy/auth/payment/history behaviour was not tested. No Vendor, Booker, Command or Backbone application files changed in this checkpoint. This is not completion of H2 or authority to resume Claude; current baseline observations above remain dated.

**Phone-preview checkpoint (2026-10-07; acceptance update 2026-10-08):** user initially approved desktop visuals and requested responsive PWA screenshots, then explicitly accepted the existing mobile look. Added sixteen phone PNGs and extended the local verifier; previous checks plus 78 phone theme/state combinations passed. Desktop/mobile visual acceptance does not prove installed-PWA or provider behaviour. S3-P3 records the stacked-summary/initial-viewport UX finding and proposed compact phone summary; its design direction was subsequently approved on 2026-10-08 (bulk-list #1). The later independent checkpoint below records approved preview execution and verification. Revised visual review and application implementation remain pending. No native mobile scope, app edits, packages, backend approval or full H2 completion.

**Approval/deferral reconciliation (2026-10-08, H2-a / step 1 only):** user authorised updating the approval records, not application code. User explicitly deferred the proposed Vendor-only mock components/UI-gallery implementation to later while preparing Claude reconciliation. Do not infer execution approval from accepted screenshots; resume component work only on explicit user direction and subset approval. Updated canonical plan, preview README and this guide; no follow-up closed. Exact schema/security/deployment gates remain unchanged. X4-tab was then parked; research resumed 2026-10-08, without implementation authority. Branch/commit snapshot was subsequently recorded under H2-b above; wider contract/approval reconciliation and Claude's own read-only refresh still remain. This does not complete H2 or authorise Claude to resume edits.

- [Booker search/booking gaps](.plans/2026-10-02-booker-search-and-booking-gaps.md): recorded complete 2026-10-05, including Vendor customer-document reader and signed-link correction. Latest C1 notes record data-boundary verification; a second-tenant UI check remains. Earlier paragraphs still describe older unfinished states.
- [Booker payment lifecycle](.plans/2026-10-04-booker-payment-lifecycle.md): executable scope recorded complete 2026-10-05, but B1 abandoned holds remains PARKED and runtime checks remain. Its expiry reuse question/provisional session-creation timing is superseded for this payment workstream by canonical D11–D17.
- Those artifacts show no unfinished Vendor kiosk implementation assigned to Claude. They do **not** prove the paused conversation's next action. Ask Claude to identify its actual task before resuming edits.
- Vendor/Booker `AGENTS.md` still describe the earlier open B4 question. Refresh those references only with ownership/approval; the canonical plan records that the product decision is now resolved, not that expiry was implemented.
- Architecture has historical gaps (document-reader availability, explicit cancellation vs checkout Back, migration inventory). Reconcile against code; a headline COMPLETE or approved decision is not proof of deployed behaviour.

## When to reconcile

Canonical H2 is callable **at any time**. Normal checkpoints are after each Vendor stage and after Vendor completion. If Claude credits reset earlier, the user can request a partial-progress briefing immediately; Vendor completion is not required.

**Ready now (2026-10-08 clarification):** the checklist and copyable prompt below are already prepared. “Prepare Claude's checkpoint when available” means refresh the dated local snapshot and obtain Claude's actual read-only task/ownership report at resumption, not wait for all checkout design or preview work to finish. Claude can perform that read-only snapshot refresh as part of its report. Uncommitted documents are readable in the same workspace. What remains is the report and the user's decision on its proposed next action; reconciliation itself is not blocked by X1–X5 or the pending preview review. Those gates still block the dependent implementation/rollout they cover.

At each checkpoint, update this guide's snapshot/change summary and the canonical plan's actual status. Update architecture/references only for implemented facts or clearly labelled designs, and only when the user has authorised the files and shared ownership is clear. Do not close follow-ups on the user's behalf. A read-only reconciliation is always distinct from permission to resume implementation.

Include:

1. Repositories/branches/commits and relevant uncommitted edits.
2. Approved versus unapproved stages; new decisions since the old session.
3. What changed and which earlier assumptions became stale, with file/commit references.
4. Shared contract version/draft status and remaining blockers.
5. Checks actually run, runtime checks not run, and known baseline failures.
6. Exact ownership and the next independently safe action.

Keep the full spec in the plan; this guide points to it. The `$handoff` skill may produce a temporary session summary, but it must reference this durable guide and current plan. Refresh at actual resumption rather than treating an old temp file as current. Do not use `$claude-handoff` to launch a background agent unless the user explicitly asks.

## Copyable prompt: refresh Claude's existing task

### Reconciliation checklist and how to use it

When Claude is available, open its existing paused session from the RS root and paste the entire fenced prompt below, without the fence markers. Its variable checkpoint inputs are already filled from the user's 2026-10-08 screenshot; no manual additions or full-file paste are required. Paste this first, not after telling Claude to continue. Do not give it an implementation prompt alongside this one; first receive its report, then explicitly authorise any next action. If you prefer to commit the documents first, do that yourself; a commit is not required for another session using this same local checkout to read the uncommitted files.

Claude's report must cover:

1. **Existing task and authority:** identify its actual unfinished task, remaining steps and original approval; report missing memory rather than invent it. Booker S5 is not automatically that task.
2. **Current local state:** refresh branches/HEAD/dirty paths in relevant repos and compare with the dated snapshot. Preserve root previews/docs, Booker's instruction edit, Backbone consolidation and unrelated mobile work; do not fetch/switch/clean/stash/commit anything. Do not inspect credentials or unrelated file contents.
3. **Changes since pause:** method choice D33 supersedes D32; desktop/existing mobile visuals accepted; app components deferred; shared-backend assignment D18; operator/Command deferrals and X4-tab research resumption (2026-10-08); S3-P3 revised compact phone preview executed/layout-checked, revised visual acceptance pending. Read the appendix's 2026-10-08 payment-race review; X2/X3/X5 remain open. Separate these decisions from implementations and runtime evidence.
4. **Baseline and conflicts:** read its local consolidation to report historical COMMENT/UUID-return findings as present, corrected or not checked, with file/line evidence. Report migration-history/replay validation still needed; do not run SQL/apply/reset anything during reconciliation. Report stale predecessor/instruction/architecture references without editing them or declaring one source automatically correct.
5. **Ownership and remaining gates:** list exact shared-file/runtime overlaps, draft `s2-draft-1`, G1–G8/B6/B7/X1–X5 and research-only X4-tab resumption; do not reopen parked work or close follow-ups. Report any proposed ownership change for the user to decide.
6. **Next action:** propose one narrow action, allowed files and approvals/evidence needed; finish without executing it. User confirms the next action after the report.

**Preparation complete, not reconciliation complete (H2-d, 2026-10-08):** this checklist/prompt was reconciled against the current approval register and snapshot and checked for local links/whitespace. No Claude session was started/contacted, no current-task response received and no owner migration/runtime validation performed. A successful report makes the next approval decision informed; it is not deployment or checkout-readiness proof. Refresh the dated snapshot if intervening changes occurred. Step 5 operational/acceptance drafting is separate, not executed by this step.

```text
Role and purpose
You are Claude Code resuming your existing RS task. Produce a concise,
evidence-backed read-only reconciliation report for the user before edits.

Stable context
Independent app repositories share Backbone/Supabase. The user owns all
Git writes. Codex owns necessary shared Booker payment backend design
for Vendor-first checkout; you retain your existing Booker task and
its migration consolidation correction/validation. Exact remaining
task and approval must be established from your session, not assumed.
Booker custom checkout S5 is later, separately assigned/approved.

Task instructions
Read root/relevant app instructions, CHECKOUT-HANDOFF.md (latest snapshot,
approval boundaries and reconciliation checklist), the canonical plan
.plans/2026-09-29-vendor-kiosk-custom-checkout.md, its S2 appendix
.plans/2026-10-07-checkout-s2-contracts.md (DRAFT s2-draft-1), and relevant
linked predecessor/architecture references. Inspect local branches,
HEADs and uncommitted paths in repos your task touches. Follow the six
checklist items in the handoff. Check your local consolidation findings
read-only with file/line evidence; do not replay/apply SQL or infer
deployed history. Report contradictions, don't silently resolve them.
Accepted visuals and ownership are not implementation approval.

Output requirements
Use six short Markdown sections: Existing task/approval; Local state;
Changes since pause; Baseline/conflicts; Ownership/gates; Proposed next
action. Cite local file/line evidence where applicable. Distinguish
observed, historical and not checked; include tests not run and missing
task context. End with the narrow action/allowed files/approval needed.

Example classification
"Mobile visuals accepted; components deferred; installed-PWA behaviour
not tested." Do not translate that into "checkout implemented".

Critical reminders
Read-only: no file edits, Git writes/fetch, migrations/SQL replay/resets,
package installs, service starts/restarts, provider/DB/auth calls, emails
or deployment. No credentials/customer payload access. Preserve other
session changes and user-owned follow-up statuses. Do not begin payment
implementation, implement tab binding or change shared ownership; X4-tab is research-only, not proven.
Finish the report and wait for the user's direction before any edits.

Variable checkpoint inputs — prepared 2026-10-08
Existing task reminder: the user supplied a screenshot of your paused
session. You were checking migration-consolidation equivalence by
snapshotting live objects, resetting the local database and comparing
them. Establish the full task and its original approval from your own
session; if that context is missing, report it rather than invent it.

Pause evidence from the screenshot, not independent database verification:
- You reported a clean index with unstaged working-tree changes.
- A background command labelled "Reset the local database with the
  merged migration" reported completion with exit code 0.
- You then reported that your extraction stopped at the first semicolon
  inside a comment, leaving the extracted string unterminated, and
  proposed extracting by line range instead. This is an extraction
  finding, not proof that the migration source itself is malformed.
- A weekly usage-limit message interrupted the session.
- The transcript also displayed "Background shell command didn't finish
  before the previous session ended". Its relationship to the reported
  reset completion is unclear; do not assume which command it describes.

Changes since pause: read the latest on-disk guide, canonical plan and
S2 appendix, including the compact-phone preview and documentation-only
payment-race review checkpoints. Refresh local branches/HEADs/dirty paths
read-only; dated snapshots and uncommitted files are not deployment proof.

Specific reconciliation focus: establish what actually completed from
available session output and relevant non-sensitive local artifacts;
distinguish reset completion from successful equivalence validation.
Report whether the comparison finished and which findings remain, with
evidence or explicit uncertainty. Do not access the database, rerun the
reset, replay SQL, restart a command/service or resume edits during this
checkpoint. If further validation requires those actions, propose the
exact narrow next action and required approval, then stop for the user.
```

## Reconciliation report — delivered 2026-10-08, resolved 2026-10-09

Claude's read-only report against the checklist above was delivered in chat on 2026-10-08 and was **not written to a file at the time**, because the prompt's "no file edits" constraint was read literally; it is recorded here on 2026-10-10 at the user's instruction, with each finding marked against what has since actually happened. The six headings below map to the checklist's six required items. Items 1–4 and 6 are **closed**; two documentation conflicts remain **open**.

**1. Existing task and authority — ✅ COMPLETE (2026-10-09).** The unfinished task was correction and validation of the Backbone migration consolidation: four local-only migrations (`20261003000001_booker_cancel_booking`, `20261003000002_refund_requests`, `20261003000003_resolve_dispute_status_note`, `20261004000001_refund_from_delivered`) merged into `backbone/supabase/migrations/20261003000001_booker_refunds_and_cancellation.sql`. Original approval: the user chose "Merge 4 into 1" from three offered options after `supabase migration list` showed all six October migrations with an empty `remote` column — local-only, nothing pushed to staging — and added "I do not mind the db reset in my local." Booker S5 was confirmed **not** to be this task. Claude could not establish whether anything further was approved during the usage-limit interruption and reported that gap rather than filling it.

**2. Branches, commits and uncommitted changes — refreshed read-only 2026-10-10.**

| Repo | Branch / HEAD | Uncommitted |
|---|---|---|
| Root | `master` / `105151d` | 18 paths — canonical plan, S2 appendix, `previews/vendor-checkout/*`, this guide |
| Booker | `feature/search_ui_enhancements` / `ee1b483` | `AGENTS.md` only |
| Vendor | `feature/booker_setup` / `325d5fe` | clean |
| Backbone | `feature/booker_gaps` / `5c7980a` | 4 deletions (the originals), 2 untracked (`20261003000001_booker_refunds_and_cancellation.sql`, `supabase/snippets/`) |
| Command | `feature/bookings_related` / `6f461d8` | clean |

Root had already moved past the 2026-10-08 snapshot at report time (`86dac68` → `105151d`, "Claude handoff document updates"), with the preview assets now tracked. Backbone, Booker and Vendor matched the snapshot exactly and still do. **The consolidated migration remains untracked and the four originals remain uncommitted deletions** — all Git writes are the user's.

**3. Checkout-plan updates since the pause — read, not assumed.** D33 supersedes D32; desktop and existing mobile visuals accepted; app components deferred; **D18 assigns the shared Booker payment backend to Codex**; X4-tab research resumed 2026-10-08 with R1 and R2 recorded ✅ as *design direction accepted*, explicitly **not** implementation; S3-P3 compact phone preview executed with revised visual acceptance pending. These are decisions and documentation, not implementations. The S2 appendix is `s2-draft-1`, **DRAFT**: X1 (DDL/checks/FKs), X2 (lock order), X3 (QR expiry vs local hold) and X5 remain open, so nothing in it is a frozen contract.

**4. Whether migration validation finished — ✅ YES, as of 2026-10-09; it had NOT at report time.** The 2026-10-08 position was that the background wrapper exited 0 while `supabase db reset` itself returned `EXIT=1` with a `MigrationApplyError`; the equivalence comparison never ran, the "before" snapshots were unreachable, and the local database was left in an unknown, plausibly partial state. Three defects in the consolidated file were then repaired and the validation completed:

- **Defect 1 — unterminated COMMENT** (`:56`–`:57`). The `comment on column public.booking_disputes.kind` string never closed, because the generating extraction cut at the first `;`, which occurs *inside* the comment text. Repaired 2026-10-09 by splicing the statement from `git show HEAD:supabase/migrations/20261003000002_refund_requests.sql`. Verified: `col_description` returns the full text from the live database.
- **Defect 2 — wrong return type.** `raise_booking_dispute` declared `returns void` while its body ends `return v_dispute;`; both prior definitions declare `uuid` (`20260801000005:111`, `20261003000002:176`). Repaired 2026-10-09. Verified: `pg_get_function_result` returns `uuid`.
- **Defect 3 — dropped `comment on function raise_booking_dispute`** (originally `20261003000002:263`). **Found only by the replay**, not by the static reading in the 2026-10-08 report — the live function's `obj_description` was null. Repaired 2026-10-09; the statement was parse-checked inside `begin … rollback`, so it is valid SQL against the real signature but **has not been applied locally** and will land on the next `supabase db reset`. Until then the local database is one comment short of the file; nothing depends on it.

The user ran `supabase db reset` on 2026-10-09: **87 migrations applied cleanly**, local history ending at `20261004000002`. Equivalence was then validated by diffing each live `pg_proc.prosrc` against the originals at `HEAD`, taking the winning definition where one was redefined (`validate_booking_status_transition` was defined three times; `20261004000001` wins). **All four function bodies are byte-identical**; `booking_disputes.kind` is `text not null default 'complaint'` with `booking_disputes_kind_check` intact; the `bookings_validate_status_transition` trigger is bound; and all three RPCs carry `authenticated` + `service_role` EXECUTE with `PUBLIC` and `anon` absent, while `validate_…` correctly retains its default ACL. Seed data is restored (41 bookings, 32 offerings, 14 vendors, 17 users); `booking_disputes` is empty and the user's hand-made test offerings did not survive, so further flag/refund testing needs a fresh offering and booking.

⚠️ **Remaining conflicts — both still OPEN, documentation only.** `architecture/schema.md` documents all four original migrations by name and has **no entry for the consolidated file**; those filenames no longer exist in the repo. Vendor's and Booker's `AGENTS.md` still describe the earlier open B4 question. Neither has been edited. Canonical **B7** also remains ⬜ and its `…:56` citation now points at repaired rather than defective code; line numbers below `:372` shifted when Defect 3 was fixed (the file is now 468 lines).

**5. File ownership and blockers.** Claude's ownership was the consolidation file only, and that task is now finished. Codex retains the shared Booker payment backend (D18). Every Git write remains the user's. Open and untouched throughout: B6, B7, G1–G8, X1–X5, the `s2-draft-1` DRAFT status, and X4-tab as research-only. No follow-up was closed, no parked work reopened, and no ownership change was proposed.

**6. Proposed next action — ✅ EXECUTED.** The report proposed one narrow action: repair the defects in the consolidated file and nothing else, with a separate later approval for any reset or replay, and explicitly declined to claim equivalence until a replay-and-compare had run. The user approved the edits ("go ahead and fix both defects", then "go ahead and add that comment") and ran the reset themselves. That sequencing was vindicated — the replay found Defect 3, which no amount of static checking had caught.

**Historical report note, superseded by the 2026-10-10 reconciliation below:** Claude left the prior readiness sentence unchanged for the user/Codex to review. The current summary now records the completed-task report separately from outstanding evidence/history and S2 approvals; it does not declare S2 executable.

## Evidence completion request — 2026-10-10

**Current disposition:** the user accepted Codex's recommendation to reconcile documentation after reviewing Claude's report. The report covers all six requested topics; Claude's local consolidation task is reported finished. Codex independently verified repaired source declarations/comments and all four final function bodies against the original migrations at Backbone HEAD `5c7980a`, not the live database. The earlier report paragraph leaving readiness unchanged is historical; the current summary below now distinguishes that finished task from the still-open B7/S2 gates. Schema inventory and Vendor/Booker checkout references were updated; no follow-up is closed on the user's behalf.

**Source anchor observed by Codex on 2026-10-10:** `backbone/supabase/migrations/20261003000001_booker_refunds_and_cancellation.sql`, SHA-256 `8e91abc8892ef39420ac22b2e205096031e67ecb36c09b83933d1e3455f1268a`. This identifies the current file only, not the exact bytes used by the 2026-10-09 reset. Claude must identify any available tested-file evidence and the later comment-only edit explicitly; don't retroactively label this hash as replayed. No reset is needed merely to persist that comment.

**Remaining evidence — TODO, not new execution approval:**

- Durable sanitised commands/results or session references for the actual reset exit, local migration endpoint, body comparison, return type, constraint/trigger and ACL checks; distinguish saved evidence from narrative reports. Existing relevant regression results may be referenced; missing tests remain unrun, not implied by matching source bodies.
- Explicit environment labels and observation dates for local, staging and production migration inventories: originals versus consolidated version and what is applied. The earlier empty remote column concerns the linked environment observed then; it is not proof about every deployment today. Use existing approved evidence first. Unknown history stays unknown until a separately authorised check; no credentials or customer data in the appendix.
- Current narrow next action/allowed files/approval needed after evidence review, not a repeat of the already-executed correction proposal. User retains Git integration and closure of B7/H2/follow-ups. X1–X5, G1–G8 and schema/security/execution gates remain open regardless of this clarification.

### Copyable follow-up for the same Claude session

Paste only this fenced block. This is a request prepared for the user to send, not a Claude session launched/contacted by Codex. Return the answer here for review; any later file update needs explicit scope/approval.

```text
Role and purpose
You are Claude Code clarifying evidence for your completed RS migration
consolidation task. Produce a read-only evidence supplement, not new work.

Stable context
The user accepted your six-part reconciliation report. Codex independently
verified the current source bodies and repaired declarations/comments.
B7 remains open; S2 is DRAFT and implementation is not approved. The user
owns all Git operations and follow-up closure.

Task instructions
Read CHECKOUT-HANDOFF.md, especially the reconciliation report and
Evidence completion request. From your existing session output and known,
relevant non-sensitive artifacts, identify the commands/results supporting
the successful reset, migration history, function-body comparison, return
type, constraint/trigger and ACL checks. Identify tested-file evidence if
available and distinguish the later comment-only source edit. State which
linked environment the earlier empty remote column described; separately
report existing dated local/staging/production evidence or explicit unknowns.
Do not search credentials or invent missing proof. If additional checks
are needed, describe their scope and approval needed instead of running them.

Output requirements
Return three short sections: Validation evidence; Environment history;
Proposed next action. Give sanitised output excerpts or known artifact/
session references, dates and observed versus reported versus not checked.
End with one narrow next action, allowed files and approval needed.

Example classification
Current source hash observed October 10 is not proof of the bytes replayed
October 9. Historical linked staging evidence is not production evidence.

Critical reminders
No file edits, Git writes/fetch, database/provider/auth calls, SQL replay,
resets, service changes, dependency installs or deployment. No secrets or
customer payloads. Do not close B7/H2 or begin checkout implementation.
Report unavailable evidence honestly and stop for the user.

Variable checkpoint inputs
Your task is already reported finished. The restored function comment is
present in source but reportedly not persisted locally. Do not rerun a
reset just for that comment. Codex's current-source hash is recorded in
the guide; do not claim that it was the original replay input without proof.
```

### Claude's evidence supplement — 2026-10-10

Answering the three requested sections. Every line below is labelled **observed** (a command this session ran and read), **reported** (stated by another party, not witnessed here) or **not checked**. Read-only local `psql` queries were run at 01:44–01:52 on 2026-10-10 to re-confirm the figures; no reset, replay, write, fetch or remote call was made, and no credentials or customer rows were read.

**Validation evidence.**

- **Reset exit — REPORTED, not observed.** The 2026-10-09 reset was run by the user, who reported it done; this session never captured its exit code or stdout. What it *did* observe afterwards is the resulting state below. The earlier 2026-10-08 failure is the opposite case: its wrapper exited 0 while the captured log recorded `EXIT=1` with a `MigrationApplyError`, and that log file is no longer reachable.
- **Tested-file evidence — RECONSTRUCTED, not captured at replay time.** The bytes the 2026-10-09 reset applied were the 465-line, two-defect-repaired file, SHA-256 `b77573d113173571875d680a75a061e169f2878ba865dacf8456aae2fd001662`. That hash is of a backup this session took from the on-disk file *after* the reset and *before* splicing the function comment, during which window the file was not modified; it was not hashed at the moment of replay. **Codex's caution is correct:** the current file is 468 lines, SHA-256 `8e91abc8892ef39420ac22b2e205096031e67ecb36c09b83933d1e3455f1268a`, and was **not** the replay input — it differs from the replayed state by exactly the three added lines of `comment on function public.raise_booking_dispute(uuid, text, text)` and nothing else.
- **Local migration endpoint — OBSERVED.** `select count(*), max(version) from supabase_migrations.schema_migrations` → **87** rows, max **`20261004000002`**. Versions ≥ `20261001`: `20261001000001`, `20261002000001`, `20261003000001`, `20261004000002` — four rows, i.e. the consolidated version is present and the four superseded filenames are absent.
- **Function bodies — OBSERVED byte-identical.** Method: dump each live `pg_proc.prosrc`, extract the corresponding dollar-quoted body from the original migration at Backbone HEAD `5c7980a` (taking the winning definition where one was redefined — `validate_booking_status_transition` three times, `20261004000001` wins), strip trailing whitespace, `diff`. All four produced no content difference; the only diff lines were a leading and trailing blank line introduced by this session's own line-range slicing, not by the SQL.
- **Return types and security — OBSERVED.** `pg_get_function_result` / `prosecdef`: `validate_booking_status_transition → trigger`, `booker_cancel_booking → void`, `raise_booking_dispute → uuid`, `resolve_booking_dispute → void`; all four `SECURITY DEFINER`.
- **Column, constraint and trigger — OBSERVED.** `booking_disputes.kind` is `text`, `NOT NULL`, default `'complaint'::text`; `booking_disputes_kind_check` is `CHECK (kind = ANY (ARRAY['complaint','refund_request']))`; `col_description` on that column returns the full 298-character comment. Trigger `bookings_validate_status_transition` exists `BEFORE UPDATE … FOR EACH ROW EXECUTE FUNCTION validate_booking_status_transition()`, enabled (`tgenabled = 'O'`).
- **ACLs — OBSERVED.** The three RPCs each hold `authenticated=X` and `service_role=X` with no `PUBLIC` (`=X/`) and no `anon` entry; `validate_booking_status_transition` retains the schema default (`=X/postgres` plus `anon`/`authenticated`/`service_role`), which matches the originals, none of which revoked it.
- **Known local gap — OBSERVED.** `obj_description('public.raise_booking_dispute(uuid,text,text)'::regprocedure,'pg_proc')` is **NULL**. The statement exists in source and was parse-checked inside `begin … rollback` (it returned `COMMENT` and read back), but was deliberately not applied. It lands on the next reset. **No reset is warranted for it alone**, as Codex states.
- **Regression tests — RUN 2026-10-10 on explicit user approval; this bullet's earlier "NOT RUN" is superseded.** An existing suite already covered this function, `backbone/supabase/tests/booking_transitions_test.sql` (45 cases, from the August `20260801000002` rewrite): **45/45 passed, `psql` exit 0**. It predated every October addition and covered none of them, so **15 cases were added to that same file** for G3 (booker cancellation), G4/D8-c (Command-only refund before delivery) and K7 (Command-only refund after delivery/return): **60/60 passed, exit 0**. Each of the nine new denials was re-run capturing `SQLERRM` — eight `Invalid booking status transition … actor not permitted`, one `Command override … requires a reason` — so none was an unrelated error masquerading as a denial. All of it rolled back; every trigger on `public.bookings` was first checked against `pg_proc` and none makes a network call. **No RLS suite was run** — these cases isolate the trigger, not row visibility. Full detail: `B7-EVIDENCE-RESPONSE.md`.
- **Durability note.** The supporting scratch artifacts (the pre-splice backup, the extracted bodies, the parse-check script) live in a session-scoped temporary directory and will not survive. The figures recorded in this section, plus the session transcript, are the durable record; nothing else should be cited as saved evidence.

**Environment history.**

- **Local — OBSERVED 2026-10-10.** Consolidated version applied; four originals absent; endpoint `20261004000002`; 87 migrations total. Seed data present (41 bookings, 32 offerings, 14 vendors, 17 auth users); `booking_disputes` empty; manually created test offerings did not survive the reset.
- **Staging — NOT CHECKED this session, and the earlier observation was narrower than it sounds.** The "empty `remote` column" finding came from a single `supabase migration list` run earlier in October against the **linked** project only. Backbone is linked (a project ref exists under `supabase/.temp/`, not reproduced here), and per this repo's own environment notes that link points at **staging, not production**. So that observation describes staging at that date and nothing else; it is not evidence about staging today, and never was evidence about production.
- **Production — NOT CHECKED, and not checkable from the current link.** Establishing it needs a separate link or a dashboard read, which is a remote call requiring its own approval.
- **How to re-establish either — not run.** `npx supabase migration list` from `backbone/` (CLI 2.120.0 resolves through `npx`; the binary is not on this session's `PATH`). That is a remote call against whichever project is linked at the time, so the environment label must be recorded with the output rather than assumed.

**Proposed next action.**

⚠️ **Superseded 2026-10-10 — the action proposed here has been executed; see the regression bullet above and `B7-EVIDENCE-RESPONSE.md`.** It was: run the status-transition regression checks against the local post-reset database in rolled-back transactions and record the sanitised results. What remains is not technical — it is the user's decision on whether staging and production history must be established before B7 closes, plus the user-owned Git integration.

- **Scope:** exercise each transition the consolidated trigger governs — booker `pending → cancelled` and `confirmed → cancelled`, Command `pending/confirmed → refunded`, `fulfilled/returned → refunded`, `fulfilled/returned → completed`, `completed → refunded` — plus the negative cases a booker must not perform, each wrapped in `begin … rollback` with `get diagnostics row_count` assertions so a zero-row `UPDATE` cannot be misread as an allowed transition.
- **Allowed files:** one new SQL file under `backbone/supabase/tests/` (or a scratch path if you prefer nothing added to the repo), and an appendix to this guide for the sanitised output. No migration file is touched.
- **Approval needed:** explicit go-ahead, because it issues `UPDATE`s against the local database even though every transaction is rolled back. It touches no remote environment, no provider and no credentials.
- **Not proposed here:** any reset, any remote `migration list`, any staging or production check, any Git operation, and any S2 or checkout implementation. **B7, H2 and all follow-ups stay open for the user to close**; X1–X5 and G1–G8 are untouched by this supplement.

## Later Booker implementation handover

Prefer a fresh payment-focused session after Claude finishes its existing task. Give it the canonical **Booker-later work package (S5)** and the actual shared contracts/evidence produced by Vendor work. If Vendor is unfinished, identify which contracts are still draft and what can be designed/tested without real payments; do not authorise live integration by inference.

Suggested skills to read/apply, subject to availability in Claude: `developerboss`, `plan-authoring`, `supabase-exp`, `component-separation`, `ux-design`; `big-table` for status reporting. Do not duplicate their instructions here.

Before any implementation handover, specify the exact approved stage/subset, allowed files, shared ownership, verification requirements and limits. No second webhook/expiry system, no blanket historical expiry, and no automatic native-mobile adoption. A plan reference alone is not implementation permission.

## Later Command follow-up — parked, not current release

### Step 5 preparation — verification and manual operations (2026-10-08)

The canonical [acceptance checklist and manual exception runbook](.plans/2026-09-29-vendor-kiosk-custom-checkout.md#step-5--acceptance-evidence-checklist-and-manual-exception-runbook-draft) is a draft organising existing policy, not test results or permission to execute payments/refunds/emails. A1–A6 checks are TODO; owner verifies the monitored inbox and actual Dashboard investigation/refund workflow before rollout. O1 records user-confirmed inspection/refund access. O2 (2026-10-08) parks exception-tracking design until later Command work alongside I8/I9; do not require a new tracking tool now. Interim handling uses Dashboard, with prior-refund checks and durable financial evidence preserved. No new Command/operator tool or repository case register. Dashboard actions do not automatically resolve/refund local cases; no booking revival, ordinary payout for late funds or guaranteed customer-credit timing. Public official provider guidance was checked, not the user's account.

**H2-e complete:** checklist/runbook drafting and static link/whitespace review only. Claude should identify these as prepared documents with unperformed verification, not deployed behaviour. No inbox supplied, account accessed, message sent or refund attempted. All five preparation steps are documented; H2 remains IN PROGRESS pending Claude's actual read-only report/user-directed reconciliation and underlying gates remain open.

Initial operations owner is the user (canonical D21), responsible for investigating exceptions and initiating manual refunds. Canonical O1 records the user's 2026-10-08 confirmation of PayMongo access to inspect payments and initiate QR Ph/GCash refunds; the access question is closed by user confirmation, not an agent account check or refund test. Environment-specific setup, transaction restrictions, actual workflow outcomes and manual case tracking remain unverified. Email is the accepted primary current-release channel (D22). D34 (2026-10-08) approves proposed server-only `PAYMENT_EXCEPTION_OPS_EMAIL`: supply the actual monitored address at deployment, separately for staging/production; never expose it through `NEXT_PUBLIC_` or commit its value. Do not reuse the non-production global `NOTIFICATION_EMAIL_OVERRIDE_TO`. Validate recipient/configuration and verify delivery before rollout; missing/invalid configuration must not discard jobs or guess a recipient. Durable exception capture and financial processing remain independent of email configuration/delivery failure. The setting is not implemented/configured; G7/X5 validation/retry/readiness work remains open. User chose manual Dashboard handling for now (D23, 2026-10-07); separate restricted recording tool I9 is PARKED, not a current prerequisite. Do not treat operations readiness as verified or request credentials in a handoff. With no local recording mechanism, Dashboard actions do not automatically resolve local cases or prove refunds in the app.

Canonical D20/I8 records the user's instruction to keep Command unchanged for this release. For a later Command task or Claude handover, consider a small staff-only payment-exceptions page: unresolved exceptions, verified booking/payment references, and append-only investigation/refund-action records. Refunds remain manual through PayMongo Dashboard; no automated refund button is part of this proposal. Reuse actual implemented exception contracts; a staff-resolution contract/table is deferred, not assumed already implemented. Define that addition under later approval, without another settlement mechanism or local status as proof of money movement.

Include payment-exception notifications in Command as part of this later follow-up (D22), alongside the proposed exceptions page. Design authorised operations recipients, deduplication and visibility/read state using actual shared contracts; this does not authorise current-release Command changes.

This is a parked idea, not implementation approval or an addition to Booker S5. Unblock with a separately approved Command scope/plan and security review. Current-release operations use email + a documented manual PayMongo Dashboard procedure; local staff-resolution recording is deferred under D23. O1 records user-confirmed inspection/refund access; O2 parks case-tracking design until later Command work. Verify actual manual refund safety before rollout; canonical G7 remains open. Revisit I9 alongside this page and avoid building two recording tools. Do not close these follow-ups without the user.

Canonical O3 (2026-10-08) records the approved late-payment customer wording and equivalent reliably matched customer email. Use verified receipt/release evidence and authorised active-interaction/reference visibility; no refund promise, booking revival or stale-return customer disclosure. This is copy approval only, not implemented UI/email templates.

### Independent preview and payment-review checkpoint — 2026-10-08

User approved revised compact-phone preview execution and documentation-only payment-contract review. Standalone preview CSS/controller/checks were updated and twenty-four screenshots regenerated. Checks passed 26 desktop, 18 responsive, 78 phone theme/state and 21 compact-summary/action-placement assertions; eight desktop PNG hashes unchanged. Revised phone visual acceptance remains pending, app implementation deferred. No new packages or application/backend/migration edits. Historical fixture copy still needs C4d/O3 reconciliation before app use.

The S2 appendix now records focused payment-race findings against the current webhook, cancellation lock and email claim path: guarded settlement, all-writer lock graph, QR clock alignment, unknown provider outcomes, reclaimable/fenced payment email delivery and honest worker-health passes. X2/X3/X5 remain unresolved; no SQL/provider/account/email/runtime tests or follow-up closures. Public provider docs were rechecked, not account settings. This checkpoint is incremental context for the read-only reconciliation prompt, not authority to start backend implementation or proof that the migration baseline is ready.

### Tab-binding steps 1–2 checkpoint — 2026-10-08

User authorised documentation drafting only. Canonical T1/T2 and appendix C4d/C4e now contain `tab-binding-draft-1`: explicit station/interaction identity and memory-only proof candidate, hard-navigation/recovery rules, lifecycle operations, idempotent replay, stale-response/reset races, lock dependencies and blast radius. T2 marks the requested lifecycle draft delivered, not implementation or runtime proof; T1/X4-tab remain IN PROGRESS.

**X4-tab-R2 design direction approved (2026-10-08):** user accepted the supplementary memory-only interaction proof, narrowly amending C4's no-additional-bearer-capability draft constraint without replacing Supabase Auth. Keep it out of browser persistence/cookies/URLs/logs/cross-tab messages and never mint a replacement from a shared cookie/locator to resume an active customer. Full-page reload/GCash return normally loses proof and requires R1 staff recovery; payment reconciliation/deadlines remain unchanged. Exact registration/session alias/cookie/header/redaction/SQL/ACL/all-writer locks and prototype/device proof remain open. No real proof/credentials generated/handled, source/security/schema/config edits, DB/provider calls, browser prototype or enablement performed. Claude baseline dependency is unchanged. Next is review and separate approval of the smallest fake-data prototype scope—not S2 execution.

## Readiness summary

**Tab-ownership proof is 🔄 IN PROGRESS (2026-10-08):** user resumed research/documentation only (bulk-list #2); the 2026-10-07 pause is historical. Appendix C4c records the browser/server indistinguishability constraint and X4-tab-R1's approved ambiguous-return recovery fallback (2026-10-08): legitimate reloads/GCash returns may require staff recovery if safe ownership cannot be established. This qualifies D4/D26's resume expectations; retain D27–D31, privacy-safe screens and unchanged financial reconciliation/deadlines. No proof of working binding, capability/security/code/schema change or waiver of rollout gates. Other X4/reset requirements remain open.

Canonical D33 (accepted 2026-10-07) supersedes D32's automatic QR-first presentation: Vendor checkout offers Pay with QR Ph / Pay with GCash before generating the selected action. QR Ph can remain prominent/recommended. No automatic QR on mount; double-click/reload resumes the same idempotent attempt. First verified usable selected action starts the fixed five-minute window; existing two-minute preparation cap remains. Later switching or QR replacement still requires verified closure of the prior attempt and cannot renew the booking deadline; a status/retry-load button is not Renew QR. After release, a new booking needs fresh availability. D32 is historical/ABORTED, not a current implementation instruction. Cancellation guarantees and QR expiry alignment remain unverified X3/G6/R3; Booker S5 presentation is not implicitly changed. Contract appendix C5 records draft operations/tests; no implementation/provider calls approved.

Station/return invariants are drafted in contract appendix C4b (2026-10-07): one server-owned active interaction per registered browser-profile station, monotonic generation on reset, atomic admission/invalidation and no customer details before binding validation. X4 remains open: shared cookies do not identify tabs; sessionStorage can be copied; off-origin navigation/duplicate-tab ownership needs proof. Never solve this by silently making D4's locator a bearer credential, heartbeat takeover, historical booking adoption or extending payment deadlines. A capability requirement must be surfaced for review; no station schema/cookie/auth implementation approved.

Canonical D31 (accepted 2026-10-07) approves the currently signed-in admin's password freshly verified through Supabase Auth on each deliberate staff recovery; no reusable unlock/client assertion or silent identity switch. Contract appendix C4a remains a technical draft, not implementation. Existing browser-only kiosk exit verification is not API authority. Passwordless account readiness, isolated verification-session cleanup, deployed session/MFA/rate-limit settings and server-atomic generation checks remain security/verification gates. Preserve normal Next customer behaviour and existing exit; do not claim this makes the shared-admin kiosk a fully sandboxed device. No credentials/live Auth calls/code or migration changes approved by this product decision.

Canonical D30 (accepted 2026-10-07) limits Reset kiosk to signed-in `vendor-admin` users belonging to that vendor for the initial release. No new staff role/shared reset PIN. Customers must not gain recovery access merely because the shared kiosk is signed in; hidden UI/session membership alone is insufficient to establish staff presence. Exact staff-only access protection and server enforcement remain X4/G8 security design for review/approval, not implemented behaviour.

Canonical D26 (accepted 2026-10-07) limits each kiosk browser/profile to one active customer interaction across kiosk tabs. Other kiosk tabs show a privacy-safe in-use view; no silent takeover or customer details. Original interaction reload/GCash return may resume while active; Next customer invalidates old interactions across tabs. Other devices/profiles and dashboard tabs remain independent, and prior payments still reconcile. Preserve the tab-scoped locator. Exact server-side binding/security/tests remain X4/G8 design work, not implemented behaviour.

Canonical D27 (accepted 2026-10-07) permits authorised staff to explicitly recover/reset after a lost/crashed tab, with confirmation and no display of previous customer details. New tabs never automatically take over. Reset invalidates old interactions/returns, but preserves original payment deadlines and reconciliation; it is not cancellation/refund. Exact authorisation and atomic invalidation remain X4/G8 design work; no implementation approval implied.

Canonical D28 (accepted 2026-10-07) requires server-confirmed invalidation before the next customer can start after Next customer/staff recovery. On connectivity failure, immediately hide/clear previous customer details and show a privacy-safe reconnecting/wait view; local reset or a queued request is insufficient. Preserve original payment deadlines/reconciliation. Atomic enforcement, idempotent retries and multi-tab/offline/reload/return tests remain X4/G8 design work, not implemented behaviour.

Canonical D25 (accepted 2026-10-07) adds a customer email for reliably matched, verified late payment after managed release: payment received, booking not confirmed, operations investigation pending. No promise of guaranteed/completed refund. Unknown/mismatched payments alert operations only. Delivery is retryable/deduplicated and independent of durable financial evidence; exact contracts/tests remain draft, not permission to send messages now.

Canonical D29 (accepted 2026-10-07) clarifies staff force recovery: Reset kiosk retries/confirms invalidation through our backend, without waiting for PayMongo, payment completion or booking expiry. No unblock-anyway option when our backend is unreachable; another connected kiosk/device may be used. Preserve original payment deadlines/reconciliation and D24 admission health gates. Exact authorisation and atomic recovery tests remain X4/G8 draft work, not implemented behaviour.

Canonical D24 (accepted 2026-10-07) pauses admission of new custom checkouts after a defined expiry/reconciliation health failure, while preserving existing-payment settlement/recovery and late-payment handling. No automatic hosted fallback for existing managed bookings. Health threshold and recovery checks remain draft G7/G8 work; this is a policy decision, not implemented monitoring or rollout configuration.

Documentation organisation/briefing and S2 contract drafting are authorised. D1–D34 (D32 superseded by D33) are accepted choices; the linked appendix remains DRAFT. S1 is merged. Claude's consolidation correction/local validation is reported finished; its read-only report is received, not still awaited. Dependent S2 implementation remains gated by B7 evidence/environment-history reconciliation and the exact S2 design/approval package, not by an assumed unfinished Claude edit. G1–G8/B6/B7/X1–X5 remain open; no exact SQL/schema/security/deployment approval implied. I10 records the current sender's non-retryable claim gap. QR timing, all-writer locking, interaction binding and policy-convention conflicts must be resolved, not assumed. R3 provider/account and staging/device checks remain unverified. Command I8 and operator tool I9 are parked. Git operations remain the user's responsibility.

Workflow references: [Claude project memory](https://code.claude.com/docs/en/memory) and [parallel-work isolation](https://code.claude.com/docs/en/worktrees). These inform the briefing/ownership practice; they do not require worktrees for this particular arrangement.
