---
name: plan-authoring
description: Use when asked to create a plan, run an audit, or scope any multi-step feature/production-hardening task that needs a written plan under .plans/ — defines the required status model, structure, severity tiers, engineering-judgment check, verification discipline, and the fixed local → staging → production release path (production always last) for plan documents.
---

# Plan Authoring

How to turn a non-trivial request into a `.plans/` document that stays honest as
work happens. Extends the Plan flow in the core rules
(`.claude/skills/core-rules/SKILL.md`; filenames date-prefixed,
under `.plans/`, kept up to date) — this skill is the *method* behind that flow.

Use this whenever a task is large enough to need a plan: audits, multi-step
features, production hardening, refactors, anything spanning more than one
session or one app.

---

## Status model (every plan, always)

A plan with no status is a lie waiting to happen. Each plan carries a status
**legend at the top**, an **overall status** line, and a **per-item status
marker** on every blocker/important/decision.

Status vocabulary — use exactly these:

| Marker | Meaning |
|--------|---------|
| ⬜ TODO | Identified, not started |
| 🔄 IN PROGRESS | Being worked now |
| ✅ DONE | Executed and verified (say how it was verified) |
| ⏸ PARKED | Intentionally deferred — **must state why and what unblocks it** |
| ✖ ABORTED | Decided against — **must state why** |

Rules:
- Every status change gets a **date** and, for DONE, a one-line note of *what
  was executed and how it was verified*.
- PARKED and ABORTED are not silent — they always carry a reason. A parked item
  names its unblock condition; an aborted item names the decision that killed it.
- The overall plan status is one of: `DRAFT` → `IN PROGRESS` → `COMPLETE`, or
  `BLOCKED` / `ABORTED`. Keep it accurate at the top of the file.
- A plan with a release (§12) adds where the release has reached to its status line,
  e.g. `IN PROGRESS — release: staging ✅ · production ⬜`. A plan is not
  `COMPLETE` while production is ⬜ or 🔄, unless production is ⏸ PARKED with a
  reason and the user agreed to close it that way.
- Never delete a completed or aborted item — strike its status, keep the record.

---

## 1. Scope before planning
- State what is being asked in one sentence; name what is explicitly out of scope.
- Flag if it touches more than one app/subsystem — cross-cutting work needs
  coordination and usually its own coupling notes.

## 2. Investigate before writing the plan
- Do not plan from memory or from a single report. Read the real code first.
- Fan out: for broad sweeps, dispatch read-only search agents per app/area; for
  a baseline, run the build/tests to know the current state before proposing
  changes.
- Locate existing patterns to follow before inventing new ones.
- Check `.plans/INDEX.md` for predecessor or overlapping plans before writing a
  new one. Re-run `python3 scripts/plans-index.py` after creating or closing a
  plan (the index is generated — never hand-edit it).
- Cross-check the plan's scope against `./architecture/*.md` (schema,
  conventions, portals, booking-flow, overview) — these are the project's own
  documented decisions and system design. A plan that silently diverges from
  them is a bug in the plan, not a new decision the plan gets to make quietly.

## 3. Apply engineering judgment before finalizing an approach
- A plan item can satisfy every documentation rule in this skill — severity
  tier, `file:line`, verification note — and still be a bad plan item because
  the underlying approach is poor engineering: over-engineered, violates an
  existing pattern for no reason, adds an abstraction nothing else needs yet,
  or ignores a simpler fix that was sitting right there.
- Before an item is written down, run its proposed approach through the
  pre-flight in `AGENTS.md` → "Working Flow" (scope, assumptions, sizing) and
  `.claude/skills/developerboss/SKILL.md`'s coding checks — locate existing
  patterns before inventing new ones, data-layer implications, risk surface,
  SOLID, simplicity-first — the same discipline that skill requires
  before writing code applies equally before *planning* code.
- This is a design-quality check, distinct from §2's investigation (finding out
  what the code currently does) and §7's decision-surfacing (choosing between
  reasonable options) — it's asking "is this option actually good engineering,"
  not just "did I look before proposing it."

## 4. Verify every claim — be skeptical
- Treat audit output (yours, an agent's, a tool's) as **unverified** until you
  open the file at the cited `file:line`.
- Expect to correct it. Real categories you will hit:
  - **False alarm** — the reported problem isn't real (e.g. "secrets committed"
    when they're gitignored). Say so and drop it.
  - **Downgrade** — real but lower impact than claimed.
  - **Escalate** — worse than claimed.
  - **Already handled** — the fix exists elsewhere (a framework layer, an
    existing guard). Don't rebuild it; note where it lives.
- Record the correction in the plan so the reasoning survives.

## 5. Structure findings by severity
Group items into tiers, not a flat list:
- **BLOCKER** — must fix before the goal (launch/merge) is safe.
- **IMPORTANT** — fix at or shortly after; degrades quality but not a stopper.
- **DEFERRED / COSMETIC** — accepted for now; say *why* it's acceptable.
Number items per tier (B1, B2, I1, …). **Numbers are plan-local** — add a legend
saying so, and qualify cross-plan references by app (e.g. "command I1").
The legend lists **every** prefix the plan uses, not just B# and I#. Common
ones here are D# (decision), F# (finding), R# (read-only pre-check), S#
(staging release step) and P# (production release step). A prefix that only
appears halfway down the plan still goes in the legend at the top.

## 6. Ground every item in `file:line`
Each item names the exact file and line(s), the precise risk or gap, and a
one-line fix direction. "Improve error handling" is not a plan item; "`route.ts:43`
DELETE has no caller auth — add `verifyCaller()` before the admin client" is.

## 7. Surface decisions — ask, don't guess
- When an item has more than one reasonable approach, make it an explicit
  **decision point**, not a silent assumption.
- Treat any conflict between the plan and `./architecture/*.md` the same way —
  a documented convention or design the plan would contradict or diverge from
  is a decision point, not something to silently reinterpret or override.
- Ask the user (with concrete options and a recommendation) rather than picking
  for them. Record the chosen option **and the date** in the plan, inline at the
  item. Keep an "open decisions" list until each is resolved.
- **Hard gate: a plan may not move to execution while any decision remains
  OPEN.** Every decision point — architecture-conflict or otherwise — must be
  asked and resolved, with the answer recorded in the plan, before the plan is
  presented for execution approval. An unresolved `OPEN:` line blocks the whole
  plan, not just the item it's attached to.

## 8. Risky or schema changes — draft, don't execute
- For schema changes, destructive SQL, or anything behind an approval gate: write
  the **exact change inline** in the plan and assess its **blast radius** before
  asking for approval:
  - **Data** — does it validate/rewrite existing rows? Will any fail?
  - **Lock / performance** — what does applying it hold, and for how long?
  - **Downstream** — type regen, dependent app code, other write paths.
  - **Reversibility** — how to undo it.
- Mark it as an approval gate. Do not write the migration/file until the user
  says go.

## 9. Couplings and cross-plan references
- If fixing X forces Y (e.g. a DB constraint that surfaces an unhandled error in
  another app), write the coupling on **both** items and require them to ship in
  the same batch.
- Trace dependency direction honestly. "Do the DB first" is not automatically
  right — often app-layer validation should land first and the DB constraint is
  the backstop. State the real order and why.

## 10. Execution order
- Order by risk and dependency, not by plan-numbering.
- Separate the **independent items safe to do now** from **coupled batches** that
  must move together. Make the safe prefix explicit so work can start without
  waiting on decisions.
- The release stages always come last, in the order §12 fixes. Build stages are
  ordered by dependency; the release stages are not up for reordering.

## 11. Verification — and its limits
- Every item names how it will be checked.
- Distinguish **machine-verifiable** (build, type-check, tests, grep) from
  **needs a live environment** (DB state, browser, third-party callback). When
  you mark something DONE, say which kind of verification was actually run and
  call out what still needs a runtime check.
- For a live check, name the environment it needs: local, staging or production.
  Most of them belong on staging (§12). "Verify in production" is only for what
  staging cannot show, such as a live payment-provider callback or the first real use.

## 12. Release path: local → staging → production
Every plan that changes code, schema, Edge Functions, secrets or env vars ships
through one fixed path. The user pushes everything to **staging** and tests it
there. Only after that does it all move to **production**.

1. **Local:** build, type-check and tests pass, and migrations are applied and
   tested on the local DB (the user applies them, see core rules).
2. **Staging stage:** the user pushes everything: `db push` (linked = staging),
   Edge Function deploys, secrets and env vars, then the app deploys. Then the
   staging checks run. ⛔ **Staging fully green before anything touches production.**
3. **Production stage, always the plan's last stage:** the same set of changes,
   in the same order. That means `db push --project-ref <prod>`, then Edge
   Functions, then **Vercel Promote of the exact staging deployment that was
   tested** (not a fresh build from another commit), then the production checks.

Rules:
- **No stage before the last one touches production.** That includes migrations,
  Edge Functions, secrets, env vars, app deploys and production data fixes. If a
  production step shows up anywhere else in the execution order, the plan is wrong.
- **Production gets exactly what staging tested.** The production stage opens with
  a parity check: `migration list` on both projects, and the function and app
  versions. Its only pending changes are the ones this plan tested on staging.
  A fix found on staging goes back to local and then staging. It never goes
  straight to production.
- **Within each environment, state the order and why.** The default is DB first
  (additive migrations), then Edge Functions, then apps, as in
  `.plans/2026-10-23-production-sync-from-staging.md`. When a mismatch between
  the DB and the app could break a live app, add a short **safe-pause table**
  showing which in-between states are safe and how to recover from the others
  (model: the payouts REVISIT plan, "Safe and unsafe states").
- **Hosted steps are the user's.** Mark each release step 👤 (user) or 🤖 (agent).
  The plan gives the exact commands and the check for each step. Releases are
  manual: never plan a merge-to-deploy step, and never merge into backbone `master`.
- **A parked staging check does not quietly open production.** If a staging check
  can't run, the user decides whether production goes ahead anyway. Record that
  as a dated decision at the gate.
- **Work that has to wait until production is live**, such as the contract half of
  an expand/contract migration or retiring an old function, goes in a **follow-up
  plan**. That plan runs its own staging → production cycle. Production stays
  the last stage of every plan.
- **No deployable change** (docs, plans, previews only): write `Release: none`
  in the plan. Don't leave the section out.
- Only the user can change this order, for example for a production hotfix.
  Record their decision with its date at the gate.

---

## Plan file skeleton

```markdown
# <Title>

**Date:** YYYY-MM-DD
**App / scope:** <path or area>
**Status:** DRAFT | IN PROGRESS | COMPLETE | BLOCKED | ABORTED
<!-- with a release: append "— release: staging ⬜ · production ⬜" -->

> One-line framing: what this plan is for and the theme to optimize.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision, F# = Finding,
> S# / P# = staging / production release step — list every prefix this plan
> uses; numbers are plan-local — qualify cross-plan refs by app (e.g. "command I1").

---

## ▶ RESUME HERE (updated YYYY-MM-DD, end of stage <n>)
<!-- Rewrite at the end of every stage. The next session starts here, not in chat history. -->
- **Done so far:** <stages finished, one line each>
- **Live where:** local <state> · staging <state> · production <state>
- **Next:** stage <n+1> — <first concrete step>, and what it's waiting on (if anything)
- **Watch out for:** <the non-obvious things the next session would otherwise trip on>

---

## BLOCKERS
### B1 — <short title>  ⬜ TODO
**File:** `path:line`
<risk / gap, grounded in the code>
**Fix approach:** <one or two lines>
<!-- on completion: ✅ DONE (YYYY-MM-DD) — what was executed + how verified -->
<!-- if deferred: ⏸ PARKED (YYYY-MM-DD) — why + unblock condition -->

## IMPORTANT
### I1 — <short title>  ⬜ TODO
...

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains — see §7. -->
- <question> → **<chosen option>** (resolved YYYY-MM-DD) — <one-line rationale>
- OPEN: <question> — <options + recommendation>

## DEFERRED / COSMETIC
- <item> — why it's acceptable for now.

## Execution order
1. <independent, safe-now items>
2. <coupled batch — note the cross-plan partners>
3. Staging release (see Release)
4. Production release — always last

## Release (§12) — or `Release: none` if nothing deploys
### Staging (production untouched throughout)
| # | Who | Step | Check |
|---|---|---|---|
| S1 | 👤 | `migration list --linked` → `db push` | ⛔ only this plan's migrations pending |
| S2 | 👤 | Edge Functions / secrets / env vars | ⛔ new version visible |
| S3 | 👤 | Deploy app(s) to staging | — |
| S4 | 👤 + 🤖 | Staging checks | ⛔ all green |

⛔ **Staging fully green before anything touches production.**

### Production (last stage)
| # | Who | Step | Check |
|---|---|---|---|
| P1 | 👤 | Parity: `migration list --project-ref <prod>` | ⛔ prod = staging minus this plan |
| P2 | 👤 | `db push --project-ref <prod>` → Edge Functions | ⛔ same checks as S1–S2 |
| P3 | 👤 | Vercel **Promote** the tested staging deployment(s) | — |
| P4 | 👤 + 🤖 | Production checks | ⛔ all green |

## Verification
- <per-item check; mark machine-verifiable vs needs-live-environment>
```

---

## Keeping it honest over time
- After each step or session, update statuses, fold in newly discovered work, and
  re-state the overall status. Rewrite the **▶ RESUME HERE** block at the end of
  every stage. AGENTS.md recommends a fresh session per stage, and this block is
  how that session picks up. Replace it each time rather than appending to it,
  because the history already lives in the items. The plan is the source of truth — if it doesn't
  match reality, fix the plan in the same breath as the code.
- Do not mark DONE on the strength of "it should work." DONE means verified;
  if you couldn't verify, it's still 🔄 with a note on what's missing.

---

## The project flow, end to end

Unless explicitly told otherwise, plan-driven work in this repo follows this
sequence. Steps 2–5 are the ones people skip, and they are the ones that keep a
plan from being confidently wrong.

1. Create a plan.
2. Review the plan and carry out any investigations or auditing. Identify gaps and
   fill them in if obvious or trivial, otherwise ask. If there are decisions to
   make, ask.
3. Review the plan for under-specified areas where a poor solution could still
   satisfy the written plan.
4. Check all planned changes against best practices for the relevant layer —
   schema design, RLS, TypeScript, React, SQL, security. For any new or modified
   component this explicitly includes `.claude/skills/component-separation/SKILL.md`:
   the plan item must **state** how render/hook/style separation is satisfied, not
   assume it. Flag any violations or concerns before execution. Do not proceed if a
   critical issue is found. This step also checks the release path against §12:
   staging comes before production, production is the last stage, and no earlier
   stage touches production.
5. Resolve questions and problems.
6. Refine the plan into an explicit execution order that references the detailed
   sections rather than duplicating their detail inline.
7. Present the plan to the user and get explicit approval before executing.
8. Execute.
9. Review results and add newly discovered follow-up work to the plan before
   continuing.

Alongside the sequence:

- For large multi-phase requests or list-based changes, keep the plan document up
  to date with accurate completion checklists.
- Plans should carry the non-obvious context later phases will need, if execution
  may span enough work to risk losing it.
- Plan review must explicitly check for places where the current wording could
  permit a weak or incorrect implementation.
- Resolve or document ambiguities before execution starts.
- **Execution cadence is one stage at a time by default** — see
  `AGENTS.md` → "Working Flow" → Execution Cadence. Running a stage range, or the full
  scope in one pass, happens when the user asks for it.
- After each major step or phase, review the work done and update the plan with
  completion state, important findings, and any newly discovered required work.
