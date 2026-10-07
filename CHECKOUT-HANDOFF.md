# Checkout collaboration and Claude resumption guide

**Updated:** 2026-10-07
**Purpose:** a durable reference for this one-off Codex/Claude overlap. Not implementation approval, a second specification, or a command to start Claude.

## Source of truth

- [Canonical checkout plan](.plans/2026-09-29-vendor-kiosk-custom-checkout.md): approved D1–D25, open G1–G8/B6/B7, shared backend, Vendor-first and Booker-later work packages, execution stages and evidence.
- [S2 contract appendix](.plans/2026-10-07-checkout-s2-contracts.md): subordinate `s2-draft-1`, state/operation/API/worker/delivery proposals, X1–X5 technical gaps and acceptance checks. Not frozen contracts or executable SQL; never implement both its proposed model and the canonical plan's old kiosk SQL sketch.
- [Plan index](.plans/INDEX.md): other workstreams/statuses; generated, not hand-edited.
- [Project instructions](AGENTS.md), [Vendor instructions](vendor/AGENTS.md), [Booker instructions](booker/AGENTS.md); each applicable app's `CLAUDE.md` imports `AGENTS.md`.
- Architecture: [booking flow](architecture/booking-flow.md), [schema](architecture/schema.md), [auth/roles](architecture/auth-and-roles.md), [conventions](architecture/conventions.md), [portals](architecture/portals.md), [deployment safety](architecture/database-reset-and-deploy.md).

Project instructions constrain the work. The canonical plan owns current approved product decisions; older plan text or remembered chat does not override them. Code/migrations establish implemented behaviour, not approval. If actual code, docs or session memory disagree, report the conflict and reconcile before editing; do not silently choose whichever supports implementation.

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

## Historical snapshot — 2026-10-06, superseded where noted below

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

```text
You are resuming an existing task in the RS workspace. First reconcile
your previous assumptions with current evidence; this is read-only.

Stable context: the apps are independent repositories sharing Backbone.
The user owns all commits, branching, merges, rebases and pushes.
Codex is preparing Vendor-first checkout work. Booker custom checkout
is a later, separately approved task; this briefing is not its approval.

Read CHECKOUT-HANDOFF.md, the canonical checkout plan's current scope,
Decisions, readiness gaps and work packages, its linked S2 contract
appendix (still draft), the relevant project/app
instructions, and the predecessor documents linked by the guide.
Inspect branches, commits and uncommitted changes in repos your task
touches. Do not access credentials or copy customer/provider payloads.

Report concisely:
- Your existing task, remaining steps and original approval boundary.
- New changes/decisions that invalidate your previous assumptions.
- Any file, shared-backend or runtime overlap with Codex.
- Blockers, contradictions and the next safe action.

An approved design means only that design was accepted. A completed
mock screen does not prove a live payment flow. Do not assume another
session's uncommitted edits are disposable or deployed.

Do not edit during this checkpoint. Do not change Git state, migrate,
deploy, restart services or begin payment work. Do not touch Vendor,
the shared webhook, Backbone or shared docs without explicit ownership
handover. Finish the report and let the user confirm how to proceed.

Current task / checkpoint inputs:
<User supplies the existing task and any newer change briefing here.>
```

## Later Booker implementation handover

Prefer a fresh payment-focused session after Claude finishes its existing task. Give it the canonical **Booker-later work package (S5)** and the actual shared contracts/evidence produced by Vendor work. If Vendor is unfinished, identify which contracts are still draft and what can be designed/tested without real payments; do not authorise live integration by inference.

Suggested skills to read/apply, subject to availability in Claude: `developerboss`, `plan-authoring`, `supabase-exp`, `component-separation`, `ux-design`; `big-table` for status reporting. Do not duplicate their instructions here.

Before any implementation handover, specify the exact approved stage/subset, allowed files, shared ownership, verification requirements and limits. No second webhook/expiry system, no blanket historical expiry, and no automatic native-mobile adoption. A plan reference alone is not implementation permission.

## Later Command follow-up — parked, not current release

Initial operations owner is the user (canonical D21), responsible for investigating exceptions and initiating manual refunds. PayMongo Dashboard availability/refund permissions are assumed and must be verified before rollout. Email is the accepted primary current-release channel (D22); the exact monitored inbox is supplied before rollout. Durable exception capture and retryable email delivery must remain independent. User chose manual Dashboard handling for now (D23, 2026-10-07); separate restricted recording tool I9 is PARKED, not a current prerequisite. Do not treat operations readiness as verified or request credentials in a handoff. With no local recording mechanism, Dashboard actions do not automatically resolve local cases or prove refunds in the app.

Canonical D20/I8 records the user's instruction to keep Command unchanged for this release. For a later Command task or Claude handover, consider a small staff-only payment-exceptions page: unresolved exceptions, verified booking/payment references, and append-only investigation/refund-action records. Refunds remain manual through PayMongo Dashboard; no automated refund button is part of this proposal. Reuse actual implemented exception contracts; a staff-resolution contract/table is deferred, not assumed already implemented. Define that addition under later approval, without another settlement mechanism or local status as proof of money movement.

Include payment-exception notifications in Command as part of this later follow-up (D22), alongside the proposed exceptions page. Design authorised operations recipients, deduplication and visibility/read state using actual shared contracts; this does not authorise current-release Command changes.

This is a parked idea, not implementation approval or an addition to Booker S5. Unblock with a separately approved Command scope/plan and security review. Current-release operations use email + a documented manual PayMongo Dashboard procedure; local staff-resolution recording is deferred under D23. Verify Dashboard capability and manual case tracking before rollout; canonical G7 remains open. Revisit I9 alongside this page and avoid building two recording tools. Do not close these follow-ups without the user.

## Readiness summary

Canonical D25 (accepted 2026-10-07) adds a customer email for reliably matched, verified late payment after managed release: payment received, booking not confirmed, operations investigation pending. No promise of guaranteed/completed refund. Unknown/mismatched payments alert operations only. Delivery is retryable/deduplicated and independent of durable financial evidence; exact contracts/tests remain draft, not permission to send messages now.

Canonical D24 (accepted 2026-10-07) pauses admission of new custom checkouts after a defined expiry/reconciliation health failure, while preserving existing-payment settlement/recovery and late-payment handling. No automatic hosted fallback for existing managed bookings. Health threshold and recovery checks remain draft G7/G8 work; this is a policy decision, not implemented monitoring or rollout configuration.

Documentation organisation/briefing and S2 contract drafting are authorised. D1–D25 are accepted choices; the linked appendix remains DRAFT. S1 is merged; dependent S2 implementation waits for Claude's migration correction/validation. G1–G8/B6/B7/X1–X5 remain open; no exact SQL/schema/security/deployment approval implied. I10 records the current sender's non-retryable claim gap. QR timing, all-writer locking, interaction binding and policy-convention conflicts must be resolved, not assumed. R3 provider/account and staging/device checks remain unverified. Command I8 and operator tool I9 are parked. Git operations remain the user's responsibility.

Workflow references: [Claude project memory](https://code.claude.com/docs/en/memory) and [parallel-work isolation](https://code.claude.com/docs/en/worktrees). These inform the briefing/ownership practice; they do not require worktrees for this particular arrangement.
