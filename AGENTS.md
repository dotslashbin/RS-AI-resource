# AGENTS.md

Instructions for AI agents working in this workspace. This file is deliberately short:
the project's rules live in the files listed below, and they carry the same authority as
if they were written here. **Read them before starting any task.**

## Read first: every session

1. `.claude/skills/core-rules/SKILL.md`: workspace layout, shared tech stack and invariants,
   instruction priority, non-negotiable rules, red lines, approval gates, preferences,
   component conventions, and the plan and prompt-writing triggers.
2. `.claude/skills/developerboss/SKILL.md`: the coding pre-flight checklist and coding
   working style (simplicity first, surgical changes, test-backed execution).
3. When working on `ezzy-booker-mobile/` or `ezzy-vendor-mobile/`: `.claude/rules/mobile-stack.md`.

Claude Code loads 1 and 2 automatically (imported from `CLAUDE.md`) and loads 3 when it
touches a mobile file. Other agents must open these files by path.

Wherever another instruction file or document refers to the rules, approval gates, red
lines, invariants, tech-stack section or conventions of "the root `AGENTS.md`", it means
this file together with the files above.

- Before any coding task, read and apply `.claude/skills/developerboss/SKILL.md` — coding pre-flight checklist for locating existing patterns, data-layer implications, risk surface, SOLID and style separation.

## Skills

Task skills live in `.claude/skills/<name>/SKILL.md`. Read a skill's file when its task
applies; the core rules say which skill to read before which kind of work. Copies of the
project skills also sit in `.codex/skills/`. Third-party skills live in `.agents/skills/`,
pinned by `skills-lock.json`.

---

## AGENTS.md Use

- Read and apply all discovered instruction files together.
- Precedence is: global instructions, then project-root-to-current-directory `AGENTS.md` / `AGENTS.override.md`.
- More local files override broader guidance when they conflict.
- In the same directory, `AGENTS.override.md` takes precedence over `AGENTS.md`.
- Edit the global instruction file for cross-project defaults.
- Edit the project `AGENTS.md` for repo-specific rules.
- Edit a nested `AGENTS.override.md` or `AGENTS.md` when the rule is specific to a subdirectory or subsystem.
- Keep this preamble identical in every `AGENTS.md` so AI agents can interpret layering consistently.

---

## Session Start

- Make sure the context includes this `AGENTS.md`, the files under "Read first" above, plus the nested `AGENTS.md` of any app being worked on
- Do not reread startup again unless asked or some context is missing

---

## Working Flow

How every task runs, coding or not. Coding work adds the checklist in `.claude/skills/developerboss/SKILL.md`.

### Pre-flight

Before responding to any task, work through the following. Do not skip steps even for tasks that seem small.

#### Understand the scope
- What exactly is being asked? State it in one sentence.
- What is NOT being asked? Name any related things that are out of scope.
- Does this touch more than one app (command / booker / vendor)? If yes, flag before proceeding — cross-app changes require approval.

#### State assumptions
- List anything that is assumed to be true but not confirmed.
- If an assumption is wrong, would it change the approach?

#### Size the change
- Is this task larger than it first appeared? If so, say so before starting.
- Is a plan file needed, or is this small enough to proceed directly?

### Think Before Coding

Do not assume the task is fully understood.

- State important assumptions before implementation.
- If there are multiple reasonable interpretations, mention them.
- If the request is unclear in a way that affects implementation, ask before changing code.
- Surface tradeoffs instead of hiding uncertainty.
- Push back when a simpler or safer approach is available.

### Goal-Driven Execution

Convert the task into verifiable outcomes.

- Define what success means before making broad changes.
- For multi-step work, use a short plan where each step has a verification check.
- Continue until the work is verified or clearly explain what blocked verification.

### Completion Standard

Before saying work is complete:

- Summarize what changed.
- List the verification performed.
- List any verification that could not be run.
- Mention risks, assumptions, or follow-up work if relevant.

### Execution Cadence

Applies whenever the work is driven by a plan file under `.plans/` (see
`.claude/skills/plan-authoring/SKILL.md` for how plans are written and how their
status model works). The pre-flight above — and, for coding work, `.claude/skills/developerboss/SKILL.md` — still runs first.

#### Default: one stage at a time

**Execute a single stage, then stop and report.** Do not roll straight into the
next stage. Ending a stage is a checkpoint, not a pause to apologise for — it is
where the user gets to redirect before more work is built on top.

"Stage" means whatever the plan's own **Execution order** section calls a stage or
a step. If the plan has no such section, treat each top-level item (B1, I1, …) as
one stage.

#### Fresh session per stage

The plan file is the handoff between sessions, not the conversation. Long-running
sessions are the workspace's largest token cost and the main source of context
drift: every request re-sends the whole conversation, and each automatic summary
drops detail (measured 2026-10-23, see `.plans/2026-09-24-local-docs-search-rag.md` §8).

- Before ending a stage, make sure the plan file alone is enough to resume: statuses,
  findings, and the next stage's starting point are written down.
- In the stage report, recommend starting the next stage in a new session, and say
  which plan and stage to open it with.
- This is a recommendation, not a stop: if the user continues in the same session
  or has given a range override, keep going.
- The same applies to work without a plan: once the task is done, suggest a new
  session for unrelated follow-up work rather than carrying it on here.

#### Overrides — the user's word wins

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
  new dependency, or anything else listed under "Ask Before" in
  `.claude/skills/core-rules/SKILL.md` still stops
  and asks, mid-range or not. "Execute to completion" is permission to keep
  moving, not permission to skip a gate.
- **It does not mean push through a blocker.** If a stage uncovers something that
  makes later stages wrong, stop and say so — finish what is independent of the
  problem first, then report.

#### Always report after execution

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
   If the plan's overall `**Status:**` line (or its title or scope line)
   changed, re-run `python3 scripts/plans-index.py` so `.plans/INDEX.md` stays
   current, and say so in the report.

Findings discovered mid-stage — including pre-existing problems and anything you
fixed that the plan did not anticipate — get written into the plan as numbered
items with their own status, not left in chat only.

#### On completion of the whole plan

State plainly: what shipped, what is parked or aborted **and why**, what
verification could not be run, and anything still sitting with the user. Flip the
plan's overall status. If any of that is unwelcome news, say it anyway — an
overstated "complete" costs more than an honest partial.
