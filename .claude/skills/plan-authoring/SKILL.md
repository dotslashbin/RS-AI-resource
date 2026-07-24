---
name: plan-authoring
description: Use when asked to create a plan, run an audit, or scope any multi-step feature/production-hardening task that needs a written plan under .plans/ — defines the required status model, structure, severity tiers, engineering-judgment check, and verification discipline for plan documents.
---

# Plan Authoring

How to turn a non-trivial request into a `.plans/` document that stays honest as
work happens. Extends the Plan flow in `AGENTS.md` (filenames date-prefixed,
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
- Before an item is written down, run its proposed approach through
  `.claude/skills/developerboss/SKILL.md`'s judgment checks — scope, locate
  existing patterns before inventing new ones, data-layer implications, risk
  surface, SOLID, simplicity-first — the same discipline that skill requires
  before writing code applies equally before *planning* code.
- This is a design-quality check, distinct from §2's investigation (finding out
  what the code currently does) and §6's decision-surfacing (choosing between
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

## 11. Verification — and its limits
- Every item names how it will be checked.
- Distinguish **machine-verifiable** (build, type-check, tests, grep) from
  **needs a live environment** (DB state, browser, third-party callback). When
  you mark something DONE, say which kind of verification was actually run and
  call out what still needs a runtime check.

---

## Plan file skeleton

```markdown
# <Title>

**Date:** YYYY-MM-DD
**App / scope:** <path or area>
**Status:** DRAFT | IN PROGRESS | COMPLETE | BLOCKED | ABORTED

> One-line framing: what this plan is for and the theme to optimize.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "command I1").

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
<!-- No item in this plan may execute while any OPEN: line below remains — see §6. -->
- <question> → **<chosen option>** (resolved YYYY-MM-DD) — <one-line rationale>
- OPEN: <question> — <options + recommendation>

## DEFERRED / COSMETIC
- <item> — why it's acceptable for now.

## Execution order
1. <independent, safe-now items>
2. <coupled batch — note the cross-plan partners>

## Verification
- <per-item check; mark machine-verifiable vs needs-live-environment>
```

---

## Keeping it honest over time
- After each step or session, update statuses, fold in newly discovered work, and
  re-state the overall status. The plan is the source of truth — if it doesn't
  match reality, fix the plan in the same breath as the code.
- Do not mark DONE on the strength of "it should work." DONE means verified;
  if you couldn't verify, it's still 🔄 with a note on what's missing.
