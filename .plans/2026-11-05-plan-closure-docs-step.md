# Plan closure: a recorded docs step, and an index warning when it is missing

**Date:** 2026-11-05
**App / scope:** root workspace tooling only: `.claude/skills/plan-authoring/SKILL.md` (and its copy under `.codex/skills/`, if present) and `scripts/plans-index.py`. No app, schema, env or dependency change.
**Status:** COMPLETE (2026-11-05) — I1 and I2 done; D1 = A, D2 = A.

> Make "update the docs" an explicit, recorded part of closing a plan, so a COMPLETE plan always says which docs it
> changed, or why none needed changing.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** I# = Important, D# = Decision, F# = Finding. Numbers are plan-local.

Release: none (workspace docs and a local script; nothing deploys).

---

## ▶ RESUME HERE (updated 2026-11-05, handoff)
- **Done so far:** D1 and D2 answered; I1 and I2 executed and verified in one stage (2026-11-05). Plan COMPLETE.
- **Next:** nothing. The user commits (draft handed over in chat).
- **Watch out for:** `.claude/skills/core-rules/SKILL.md` says "the nine-step flow"; the closing step was folded into step 9
  so that count stays true (see F5).

---

## Background (found 2026-11-05, in `2026-11-04-booker-portrait-photo-square-cover.md`)
- **F1 — 26 of 75 non-legacy COMPLETE plans leave no trace of a docs check.** They have no explicit docs step, and no doc
  (`architecture/*.md`, any `AGENTS.md`, `README.md`) cites them by filename. Counts: explicit docs step 28 · mentions docs, no
  step 32 · no mention 15 · cited by a doc 41 of 75. These were regex heuristics, so they're approximate.
- **F2 — the content is mostly there anyway.** A spot-check of 10 of the 26 found every shipped behaviour described in the docs.
  What's missing is a **record**, not the docs. So a back-fill of the 26 is **not** proposed.
- **F3 — the portrait-cover plan was marked COMPLETE before its docs were updated.** The user had to ask. The fix there was a
  `## Docs (closing step)` section, the model for I1.
- **F4 — `plan-authoring` has no closing step for docs.** Its "Keeping it honest over time" and "The project flow, end to end"
  sections cover status and verification but never docs. The core rules only say "update … when they can be meaningfully
  improved", a preference, not a step.
- `INDEX.md` was current on 2026-11-05 (188 plans, 188 rows).

- **F5 — `core-rules` counts "the nine-step flow"** (`.claude/skills/core-rules/SKILL.md:181`). Adding a step 10 would have
  made that wrong, and that file holds unrelated work in progress. So the closing step went into step 9 instead, and
  core-rules was not touched. ✅ DONE (2026-11-05).

## IMPORTANT
### I1 — A "Closing a plan" checklist in `plan-authoring`  ✅ DONE
**File:** `.claude/skills/plan-authoring/SKILL.md`. Add it near "Keeping it honest over time" / step 9 of "The project flow".
Also add a `## Docs` line to the skeleton. Mirror the change to `.codex/skills/plan-authoring/SKILL.md` if that copy exists.
**Content (short):** before the overall status becomes COMPLETE, check the docs the plan affected (`architecture/*.md`, the
app's `AGENTS.md`, `README.md`) and update them. Then record one line in the plan: `**Docs:** <files changed>`, or
`**Docs:** none needed — <reason>`. Then regenerate the index. A plan with `Release: none` still needs the line.
**Verification:** read it back; the wording names the exact line format I2 checks for.
✅ DONE (2026-11-05) — added a `## Closing a plan` section after "Keeping it honest over time" (docs check → `**Docs:**` line
in one of its two forms → flip status → regenerate the index; `Release: none` still needs the line), a `## Docs` block with a
`**Docs:**` line at the end of the skeleton, and a closing clause in step 9 of "The project flow". Mirrored by copy to
`.codex/skills/plan-authoring/SKILL.md`. Verified: read back; `diff` of the two copies is empty; the wording names
`**Docs:**` and `## Docs`, the two forms `DOCS_RE` in I2 accepts.

### I2 — `plans-index.py` warns about a COMPLETE plan with no `Docs:` line  ✅ DONE
**File:** `scripts/plans-index.py` (standard library only; keep it that way).
**Approach:** when a plan's status is COMPLETE, look for a line starting `**Docs:**` (or a `## Docs` heading). If neither is there,
print a warning to stderr naming the file. The scope is D1 and the severity D2. Don't change the INDEX.md output itself.
**Verification:** run it, and confirm the expected warnings (or none). Run `--check` and confirm its exit code matches D2.
Then test it on a temporary COMPLETE plan without the line: warned. Add the line: silent. Delete the temporary plan afterwards.
✅ DONE (2026-11-05) — `DOCS_RE` (`^**Docs:**` or a `## Docs` heading, anywhere in the file) and `DOCS_SINCE = "2026-11-05"`;
`render()` prints one stderr warning per non-legacy COMPLETE plan dated on or after `DOCS_SINCE` without either. INDEX.md
output unchanged. Verified by running it: baseline `--check` exit 0 with no warnings. Two temporary COMPLETE plans without
the line: the 2026-11-05 one warned, the 2026-11-04 one did not (D1). Adding the `**Docs:**` line silenced it, and so did
the `## Docs` heading form. Both temporary plans moved to the trash with `gio trash` (`trash` is not installed); `--check`
exit 0 afterwards. D2 tested on this plan: marked COMPLETE with no Docs line, regenerated, then `--check` gave the warning
and exit 0; adding the line below silenced it.

## DECISIONS
<!-- No item may execute while an OPEN line remains. -->
- **D1 — which COMPLETE plans are checked** → **A: only plans dated 2026-11-05 or later** (resolved 2026-11-05, the user) —
  F2 says the old ones are documented, and it avoids ~47 warnings on the first run.
- **D2 — what a missing line does** → **A: warn only; `--check` still passes** (resolved 2026-11-05, the user) — visible,
  never blocks.

## Execution order
1. Ask the user D1 and D2; record the answers with the date.
2. I1, then I2 (I2 checks for the line format I1 defines).
3. Add this plan's own `**Docs:**` line, regenerate the index, and draft the commit for the user.

## Verification
- I1: the doc read back. I2: script runs as described under I2. Both machine-checkable locally; nothing live.

## Docs
**Docs:** `.claude/skills/plan-authoring/SKILL.md` and its mirror `.codex/skills/plan-authoring/SKILL.md` (the closing rule
itself), plus the `scripts/plans-index.py` docstring. No `architecture/` doc, `AGENTS.md` or `README.md` covers plan tooling.
