---
name: developerboss
description: Use before responding to any coding task, however small — a pre-flight checklist for scoping the ask, locating existing patterns before building, checking data-layer implications, identifying the risk surface, verifying SOLID adherence and render/style separation, and sizing the change before writing a line. Also defines the execution cadence for plan-driven work (one stage at a time by default) and the summary + checklist + plan status that must be reported after every stage.
---

# Engineering Start

Before responding to any task, work through the following. Do not skip steps even for tasks that seem small.

## 1. Understand the scope
- What exactly is being asked? State it in one sentence.
- What is NOT being asked? Name any related things that are out of scope.
- Does this touch more than one app (command / booker / vendor)? If yes, flag before proceeding — cross-app changes require approval.

## 2. Locate before building
- Is there existing code that already does this or something close?
- Is there an existing pattern (hook, service function, component) to follow?
- Which files will need to change? Name them before writing a line.

## 3. Check the data layer
- Does this require a schema change? If yes, stop and get approval before proceeding.
- Which tables are involved? What are the RLS implications?
- Is there a trigger, constraint, or cascade that could be affected?

## 4. Identify the risk surface
- What is the worst thing that could go wrong?
- Are there error paths (not just the happy path)?
- Does this expose any data to a user who should not see it?
- Is any secret or credential involved?

## 5. State assumptions
- List anything that is assumed to be true but not confirmed.
- If an assumption is wrong, would it change the approach?

## 6. Apply SOLID principles
- Single Responsibility — does this component/function/module do one thing, for one reason to change?
- Open/Closed — can this be extended without modifying existing, working code?
- Liskov Substitution — if this extends or implements something else, can it be swapped in without breaking callers' expectations?
- Interface Segregation — are consumers forced to depend on props/methods they don't actually use?
- Dependency Inversion — does this depend on abstractions (hooks, service functions, interfaces) rather than concrete implementations where it matters?

## 7. Separate styles from the rendering component
- Is the render layer (`.tsx`) free of `style={{}}` blocks, aside from genuinely dynamic one-off values?
- Does non-trivial styling live in a co-located `.module.css` or shared Tailwind tokens/utilities, not hardcoded inline?
- See `.claude/skills/component-separation/SKILL.md` for the full render/hook/style separation convention.

## 8. Size the change
- Is this task larger than it first appeared? If so, say so before starting.
- Is a plan file needed, or is this small enough to proceed directly?

Only after completing the above: write code.

---

# Execution Cadence

Applies whenever the work is driven by a plan file under `.plans/` (see
`.claude/skills/plan-authoring/SKILL.md` for how plans are written and how their
status model works). Sections 1–8 above still run first.

## Default: one stage at a time

**Execute a single stage, then stop and report.** Do not roll straight into the
next stage. Ending a stage is a checkpoint, not a pause to apologise for — it is
where the user gets to redirect before more work is built on top.

"Stage" means whatever the plan's own **Execution order** section calls a stage or
a step. If the plan has no such section, treat each top-level item (B1, I1, …) as
one stage.

## Overrides — the user's word wins

The default yields the moment the user says otherwise. Honour these for the whole
run, without re-asking at each boundary:

| The user says | Do this |
|---|---|
| "stages 1–5", "do steps 2 through 4", any explicit range | Run exactly that range, then stop. Report after **each** stage in the range (see below), and give a combined summary at the end of the range. |
| "execute to completion", "run the whole plan", "don't stop" | Run every remaining stage to the end of the approved scope. Still report after each stage. |
| "just stage 3" / a single stage | Run that one stage only. |
| nothing about cadence | One stage, then stop. |

Two things an override never buys:
- **It does not waive the approval gates.** A schema change, destructive SQL, a
  new dependency, or anything else listed under AGENTS.md "Ask Before" still stops
  and asks, mid-range or not. "Execute to completion" is permission to keep
  moving, not permission to skip a gate.
- **It does not mean push through a blocker.** If a stage uncovers something that
  makes later stages wrong, stop and say so — finish what is independent of the
  problem first, then report.

> History note: AGENTS.md "Default Working Style → Plan" used to say *"during
> execution of a large approved plan, do not stop until the full approved scope is
> complete"*. That bullet now defers to this section (2026-07-30), and the
> run-straight-through behaviour it described is the **"execute to completion"**
> override rather than the default.

## Always report after execution

After **every** stage — default or overridden, success or partial — show all three:

1. **Summary** — what actually changed, by file. Name the files. Say what was
   *not* done and why, if anything.
2. **Checklist** — each item attempted in that stage with its outcome, and the
   verification actually run. Distinguish machine-verified (build, type-check,
   tests, grep, measurement) from anything still needing a live environment or a
   human. Never present "should work" as verified.
3. **Plan status** — the plan file's current state: overall status, plus each
   item's marker (⬜ / 🔄 / ✅ / ⏸ / ✖) and what remains. Update the plan file
   itself in the same breath, with dates and how each ✅ was verified — a report
   that disagrees with the plan file means the plan file is now wrong, which is
   the failure mode the status model exists to prevent.

Findings discovered mid-stage — including pre-existing problems and anything you
fixed that the plan did not anticipate — get written into the plan as numbered
items with their own status, not left in chat only.

## On completion of the whole plan

State plainly: what shipped, what is parked or aborted **and why**, what
verification could not be run, and anything still sitting with the user. Flip the
plan's overall status. If any of that is unwelcome news, say it anyway — an
overstated "complete" costs more than an honest partial.
