---
name: big-table
description: Generate or update a concise plan-stage status table with completion state, ownership, and honest notes. Use when the user asks for the big table, plan stages, or a stage/owner progress view; do not use for writing the plan itself.
---

# Big table

Present a plan's execution stages in a compact Markdown table that makes status,
ownership, and blockers legible at a glance.

## Source of truth

- Read the relevant plan and any execution evidence before reporting a table.
- Treat its status markers and verification notes as authoritative. Do not infer a
  stage is complete from intent, a code diff, or a user saying they will test it.
- If the plan is stale, say so and update it only when the user has authorised
  that file change. Preserve app-level write-boundary rules.

## Required table

Use these columns, in this order:

| Done | Stage | What | Owner | Notes |
|---|---|---|---|---|

- **Done:** one state marker: `✅` done, `🔄` in progress, `⬜` not started,
  `⏸` parked, or `✖` aborted.
- **Stage:** plan stage identifier and linked item(s), such as `S3 / I3–I4`.
- **What:** a short, outcome-focused description.
- **Owner:** `🤖 Mine`, `👤 Yours`, or `🤝 Shared`. Use the plan's actual
  assignment; do not assume that testing, approval, or committing belongs to one
  party.
- **Notes:** include the meaningful reason, current verification, dependency, or
  next action. For `⏸` parked and `✖` aborted rows, this is mandatory: state why
  and, for parked work, what would unblock it.

Order execution stages first in planned order. Put non-stage handoffs (such as
approval, device testing, or commit) last if they materially affect completion.
Include parked or aborted plan items either in their relevant stage row or as
separate rows so none are hidden.

## Reporting rules

- Reproduce the plan's stated status accurately; never convert a deferred item
  into done merely to make the table look complete.
- Keep notes short, specific, and user-actionable. Name the verification that
  occurred and distinguish user acceptance from machine checks.
- When no plan exists, say that a trustworthy big table cannot be generated yet
  and offer to create a plan instead.
- After the table, add at most one short sentence identifying the immediate next
  action, unless the user asks for more detail.
