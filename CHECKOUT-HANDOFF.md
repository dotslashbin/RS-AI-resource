# Checkout collaboration and Claude resumption guide

**Updated:** 2026-10-08 (steps 1–5: documentation preparation complete; Claude's read-only checkpoint and unresolved technical/operational checks remain pending)
**Purpose:** a durable reference for this one-off Codex/Claude overlap. Not implementation approval, a second specification, or a command to start Claude.

## Source of truth

- [Canonical checkout plan](.plans/2026-09-29-vendor-kiosk-custom-checkout.md): approved D1–D33 (D32 superseded by D33), open G1–G8/B6/B7, shared backend, Vendor-first and Booker-later work packages, execution stages and evidence.
- [S2 contract appendix](.plans/2026-10-07-checkout-s2-contracts.md): subordinate `s2-draft-1`, state/operation/API/worker/delivery proposals, X1–X5 technical gaps and acceptance checks. Not frozen contracts or executable SQL; never implement both its proposed model and the canonical plan's old kiosk SQL sketch.
- [Vendor visual previews](.plans/previews/vendor-checkout/README.md): S3-P1/P1a design-only artifacts, thirteen mock states plus desktop/phone screenshots. Desktop and existing mobile visuals accepted by user; records reconciled 2026-10-08. Application components deferred until explicit user resumption/approval. Compact mobile-summary suggestion S3-P3 remains TODO and unapproved. No app changes, new packages, live payment/auth or frozen API contract; mock navigation shortcuts are not payment logic.
- [Plan index](.plans/INDEX.md): other workstreams/statuses; generated, not hand-edited.
- [Project instructions](AGENTS.md), [Vendor instructions](vendor/AGENTS.md), [Booker instructions](booker/AGENTS.md); each applicable app's `CLAUDE.md` imports `AGENTS.md`.
- Architecture: [booking flow](architecture/booking-flow.md), [schema](architecture/schema.md), [auth/roles](architecture/auth-and-roles.md), [conventions](architecture/conventions.md), [portals](architecture/portals.md), [deployment safety](architecture/database-reset-and-deploy.md).

Project instructions constrain the work. The canonical plan owns current approved product decisions; older plan text or remembered chat does not override them. Code/migrations establish implemented behaviour, not approval. If actual code, docs or session memory disagree, report the conflict and reconcile before editing; do not silently choose whichever supports implementation.

## Approval boundaries — read before resuming

The canonical [approval boundary register](.plans/2026-09-29-vendor-kiosk-custom-checkout.md#approval-boundary-register--2026-10-08-h2-c--step-3) is the dated classification of existing authority, not another specification or new approval. Current product decisions D1–D31/D33 and desktop/existing phone visuals are accepted; D32 is ABORTED. Mock app components are deferred by user direction. Shared backend ownership is assigned, but exact schema/security/implementation/deployment remains gated. `s2-draft-1` is still DRAFT; proposed API/record/worker/auth details are not frozen just because they are written down.

Distinguish explicit acceptance, S1's limited code checks and preview-only checks from unperformed DB/provider/email/installed-PWA/device verification. Parked X4-tab remains a rollout gate; Command/operator/native-mobile/extra-method follow-ups remain deferred. Operational email/Dashboard choices do not prove account permissions or delivery. No closure of a technical requirement or follow-up is implied by this reconciliation.

**H2-c / step 3 complete (2026-10-08):** classification was checked against the plan's Decisions/stage evidence and the user's approvals/deferrals, with local-link and whitespace checks. No app code, migration, technical contract semantics, Git state or runtime changed. Step 4 briefing preparation is now recorded below under H2-d; Claude must still identify its existing task/approval boundary, reconcile overlap and report before the user authorises further edits. This document does not launch Claude or hand it Booker S5 implementation authority.

## Ownership during this overlap

| Area | Boundary |
|---|---|
| Git operations in every repo | User performs commits, branches, switches, merges, rebases and pushes. Agents may inspect and advise only. |
| Vendor checkout | Codex's proposed immediate focus; implementation still requires stage approval. |
| Claude's existing Booker task | Claude resumes only its existing approved scope after the read-only refresh below. Exact pending next action must be confirmed. |
| Shared backend | Codex assigned necessary Booker payment backend for Vendor-first S2 (D18). Claude retains existing migration consolidation correction/validation; dependent Backbone implementation waits. Shared files have one designated editor at a time. |
| Shared docs | Plan, architecture and app instructions: one editor at a time; preserve another session's notes and user-owned changes. |
| Command | Existing refund/dispute/payout paths stay compatible. No new Command UI authorised. |

No worktrees are required for this one-off arrangement. Different branches in one checkout do not isolate files; do not change a branch beneath a paused/running session. Independent Vendor/Booker repositories reduce file overlap but share Backbone, docs and runtime resources. Do not restart services, reset databases, migrate, deploy or change provider configuration without applicable approval.

## Latest local repository snapshot — 2026-10-08 (H2-b / step 2)

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

**Phone-preview checkpoint (2026-10-07; acceptance update 2026-10-08):** user initially approved desktop visuals and requested responsive PWA screenshots, then explicitly accepted the existing mobile look. Added sixteen phone PNGs and extended the local verifier; previous checks plus 78 phone theme/state combinations passed. Desktop/mobile visual acceptance does not prove installed-PWA or provider behaviour. S3-P3 records the stacked-summary/initial-viewport UX finding and proposed compact phone summary; that redesign remains unapproved and unimplemented. No native mobile scope, app edits, packages, backend approval or full H2 completion.

**Approval/deferral reconciliation (2026-10-08, H2-a / step 1 only):** user authorised updating the approval records, not application code. User explicitly deferred the proposed Vendor-only mock components/UI-gallery implementation to later while preparing Claude reconciliation. Do not infer execution approval from accepted screenshots; resume component work only on explicit user direction and subset approval. Updated canonical plan, preview README and this guide; no follow-up closed. Exact schema/security/deployment gates and parked X4-tab remain unchanged. Branch/commit snapshot was subsequently recorded under H2-b above; wider contract/approval reconciliation and Claude's own read-only refresh still remain. This does not complete H2 or authorise Claude to resume edits.

- [Booker search/booking gaps](.plans/2026-10-02-booker-search-and-booking-gaps.md): recorded complete 2026-10-05, including Vendor customer-document reader and signed-link correction. Latest C1 notes record data-boundary verification; a second-tenant UI check remains. Earlier paragraphs still describe older unfinished states.
- [Booker payment lifecycle](.plans/2026-10-04-booker-payment-lifecycle.md): executable scope recorded complete 2026-10-05, but B1 abandoned holds remains PARKED and runtime checks remain. Its expiry reuse question/provisional session-creation timing is superseded for this payment workstream by canonical D11–D17.
- Those artifacts show no unfinished Vendor kiosk implementation assigned to Claude. They do **not** prove the paused conversation's next action. Ask Claude to identify its actual task before resuming edits.
- Vendor/Booker `AGENTS.md` still describe the earlier open B4 question. Refresh those references only with ownership/approval; the canonical plan records that the product decision is now resolved, not that expiry was implemented.
- Architecture has historical gaps (document-reader availability, explicit cancellation vs checkout Back, migration inventory). Reconcile against code; a headline COMPLETE or approved decision is not proof of deployed behaviour.

## When to reconcile

Canonical H2 is callable **at any time**. Normal checkpoints are after each Vendor stage and after Vendor completion. If Claude credits reset earlier, the user can request a partial-progress briefing immediately; Vendor completion is not required.

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

When Claude is available, open its existing paused session from the RS root and paste the prompt below. Optional changing inputs go at the end. Do not give it an implementation prompt alongside this one; first receive its report, then explicitly authorise any next action. If you prefer to commit the documents first, do that yourself; a commit is not required for another session using this same local checkout to read the uncommitted files.

Claude's report must cover:

1. **Existing task and authority:** identify its actual unfinished task, remaining steps and original approval; report missing memory rather than invent it. Booker S5 is not automatically that task.
2. **Current local state:** refresh branches/HEAD/dirty paths in relevant repos and compare with the dated snapshot. Preserve root previews/docs, Booker's instruction edit, Backbone consolidation and unrelated mobile work; do not fetch/switch/clean/stash/commit anything. Do not inspect credentials or unrelated file contents.
3. **Changes since pause:** method choice D33 supersedes D32; desktop/existing mobile visuals accepted; app components deferred; shared-backend assignment D18; operator/Command/tab-proof deferrals. Separate these decisions from implementations and runtime evidence.
4. **Baseline and conflicts:** read its local consolidation to report historical COMMENT/UUID-return findings as present, corrected or not checked, with file/line evidence. Report migration-history/replay validation still needed; do not run SQL/apply/reset anything during reconciliation. Report stale predecessor/instruction/architecture references without editing them or declaring one source automatically correct.
5. **Ownership and remaining gates:** list exact shared-file/runtime overlaps, draft `s2-draft-1`, G1–G8/B6/B7/X1–X5 and parked X4-tab; do not reopen parked work or close follow-ups. Report any proposed ownership change for the user to decide.
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
implementation, reopen parked tab proof or change shared ownership.
Finish the report and wait for the user's direction before any edits.

Variable checkpoint inputs (optional; user supplies latest facts)
Existing task reminder: <use your paused task context; if unavailable,
report that and ask the user instead of inventing a task>
Newer changes since the dated guide: <none supplied, or user notes>
Specific reconciliation focus: <existing task and migration baseline>
```

## Later Booker implementation handover

Prefer a fresh payment-focused session after Claude finishes its existing task. Give it the canonical **Booker-later work package (S5)** and the actual shared contracts/evidence produced by Vendor work. If Vendor is unfinished, identify which contracts are still draft and what can be designed/tested without real payments; do not authorise live integration by inference.

Suggested skills to read/apply, subject to availability in Claude: `developerboss`, `plan-authoring`, `supabase-exp`, `component-separation`, `ux-design`; `big-table` for status reporting. Do not duplicate their instructions here.

Before any implementation handover, specify the exact approved stage/subset, allowed files, shared ownership, verification requirements and limits. No second webhook/expiry system, no blanket historical expiry, and no automatic native-mobile adoption. A plan reference alone is not implementation permission.

## Later Command follow-up — parked, not current release

### Step 5 preparation — verification and manual operations (2026-10-08)

The canonical [acceptance checklist and manual exception runbook](.plans/2026-09-29-vendor-kiosk-custom-checkout.md#step-5--acceptance-evidence-checklist-and-manual-exception-runbook-draft) is a draft organising existing policy, not test results or permission to execute payments/refunds/emails. A1–A6 checks are TODO; owner verifies the monitored inbox, Dashboard account/method/permissions and an approved restricted manual tracking process before rollout. No new Command/operator tool or repository case register. Dashboard actions do not automatically resolve/refund local cases; no booking revival, ordinary payout for late funds or guaranteed customer-credit timing. Public official provider guidance was checked, not the user's account.

**H2-e complete:** checklist/runbook drafting and static link/whitespace review only. Claude should identify these as prepared documents with unperformed verification, not deployed behaviour. No inbox supplied, account accessed, message sent or refund attempted. All five preparation steps are documented; H2 remains IN PROGRESS pending Claude's actual read-only report/user-directed reconciliation and underlying gates remain open.

Initial operations owner is the user (canonical D21), responsible for investigating exceptions and initiating manual refunds. PayMongo Dashboard availability/refund permissions are assumed and must be verified before rollout. Email is the accepted primary current-release channel (D22); the exact monitored inbox is supplied before rollout. Durable exception capture and retryable email delivery must remain independent. User chose manual Dashboard handling for now (D23, 2026-10-07); separate restricted recording tool I9 is PARKED, not a current prerequisite. Do not treat operations readiness as verified or request credentials in a handoff. With no local recording mechanism, Dashboard actions do not automatically resolve local cases or prove refunds in the app.

Canonical D20/I8 records the user's instruction to keep Command unchanged for this release. For a later Command task or Claude handover, consider a small staff-only payment-exceptions page: unresolved exceptions, verified booking/payment references, and append-only investigation/refund-action records. Refunds remain manual through PayMongo Dashboard; no automated refund button is part of this proposal. Reuse actual implemented exception contracts; a staff-resolution contract/table is deferred, not assumed already implemented. Define that addition under later approval, without another settlement mechanism or local status as proof of money movement.

Include payment-exception notifications in Command as part of this later follow-up (D22), alongside the proposed exceptions page. Design authorised operations recipients, deduplication and visibility/read state using actual shared contracts; this does not authorise current-release Command changes.

This is a parked idea, not implementation approval or an addition to Booker S5. Unblock with a separately approved Command scope/plan and security review. Current-release operations use email + a documented manual PayMongo Dashboard procedure; local staff-resolution recording is deferred under D23. Verify Dashboard capability and manual case tracking before rollout; canonical G7 remains open. Revisit I9 alongside this page and avoid building two recording tools. Do not close these follow-ups without the user.

## Readiness summary

**Tab-ownership proof is ⏸ PARKED (2026-10-07) at user request:** focus now on feature design, not the C4b duplicate-tab/reload/off-origin binding gap. Resume on user direction; reviewed binding/prototype/target-device verification remains required before customer-facing rollout. Preserve D4/D26–D31; do not label X4 solved, waive security/privacy gates or implement a speculative bearer-capability shortcut. Other X4/reset security requirements remain open. D33 now resolves the initial method-action question; neither parking nor this product approval authorises code changes.

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

Documentation organisation/briefing and S2 contract drafting are authorised. D1–D33 (D32 superseded by D33) are accepted choices; the linked appendix remains DRAFT. S1 is merged; dependent S2 implementation waits for Claude's migration correction/validation. G1–G8/B6/B7/X1–X5 remain open; no exact SQL/schema/security/deployment approval implied. I10 records the current sender's non-retryable claim gap. QR timing, all-writer locking, interaction binding and policy-convention conflicts must be resolved, not assumed. R3 provider/account and staging/device checks remain unverified. Command I8 and operator tool I9 are parked. Git operations remain the user's responsibility.

Workflow references: [Claude project memory](https://code.claude.com/docs/en/memory) and [parallel-work isolation](https://code.claude.com/docs/en/worktrees). These inform the briefing/ownership practice; they do not require worktrees for this particular arrangement.
