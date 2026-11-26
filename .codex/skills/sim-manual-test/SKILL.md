---
name: sim-manual-test
description: >
  Run the manual / live checks for work in this workspace by actually driving the app from WSL —
  a visible browser on the WSLg desktop for the Next apps (command, booker, vendor, affiliate), or
  the Windows Android emulator / Expo web for the Expo apps — screenshotting each step, backing
  results with read-only SQL and the local mail catcher, and reporting. Two modes: PLAN mode (a
  plan path, optional stage: run that stage's manual local checks, writing the checklist into the
  plan first if it has none) and INSTRUCTIONS mode (the user's own steps, no plan). Use whenever
  the user asks to "run the manual tests", "do the live local checks", "try it out in the browser",
  "test it on the emulator", "click through the stage", "simulate a user", or runs
  /sim-manual-test — even if they don't say "manual test". Local environment only.
---

# sim-manual-test

This skill exists so that a plan's "live local" checks — the ones a type-check, unit test or
Playwright spec cannot settle — get run, observed and recorded, rather than left as a list the
user has to click through alone. It came out of the affiliate plan's stage 2 run (2026-11-25),
where 15 checks were driven in a visible Chromium on WSLg and each was backed by a screenshot and
a read-only SQL result.

Project-only: it lives in `/home/joshua/RS/.claude/skills/sim-manual-test/` and assumes this
workspace's layout, ports and local Supabase.

The rule that shapes everything below: **a check passes only when you observed it pass.** A
screenshot, a SQL row, a mail-catcher link or a log line is the evidence. "Should work" is not.
A failure is reported with its screenshot, never retried until it passes.

## Inputs

The argument decides the mode.

- **Plan mode** (default) — a plan path, optionally a stage: `/sim-manual-test
  .plans/2026-11-23-affiliate-command.md stage 2`. Without a stage, use the plan's current stage
  from its `▶ RESUME HERE`.
- **Instructions mode** — anything that is not a plan: free-text steps, or a path to a file of
  steps (`/sim-manual-test instructions: log in as a vendor admin, open Wallet, …` or
  `/sim-manual-test notes/kiosk-retest.md`). Use it to test a fix, a bug report, or a flow with no
  plan behind it.
- Optional: the target app if it isn't obvious (`app=vendor`), a test-data tag (`tag=l3`).

If the mode or target is genuinely unclear, ask once. Don't guess between two apps.

## Before anything runs: permission

UI actions write real rows to the local database, can send local emails, and may need a dev
server started or an env var added. So before the first action, confirm with the user (one
question, all of it):

- that you may run the checks on **local** (never staging or production — a hosted environment
  only if they say so explicitly, and then this skill's read-only and safety rules still apply);
- whether you may start the dev server(s) yourself and add any env var the checklist needs
  (name the one line; see "Environment" below);
- that they will sign in to the browser or app themselves.

A permission given for one run does not carry to the next.

## Step 1 — Build the checklist

**Plan mode.** Find the stage's manual checks: a `Manual local checks — stage N` block in
Verification, each item's "Live local" line, the plan's general "Live, local" paragraph.

- If a step-by-step checklist for the stage already exists, use it as written.
- If not, **write it into the plan's Verification section first** (just above the staging
  checks), then run it. Format, one table per stage:

```markdown
**Manual local checks — stage N (LN)**  ⬜ TODO (added <date>; none run yet)
<setup: app + URL, who signs in, env vars, servers, data prerequisites, what must never be done>

| # | Item | Steps | Expected | Status |
|---|---|---|---|---|
| LN.1 | B3 | Settings → Platform Fee | Card loads unset, "switched off" note | ⬜ |
| LN.9 | B2 | Remove for an affiliate with a money line | Refused | ⏸ waits for I5 (stage 3) — no way to create the line yet |
```

Derive steps from each item's Fix approach and Verification, not from imagination. A check that
cannot run yet (needs a later stage, a hosted service, a device) is written in and marked ⏸ with
the reason and what unblocks it — it is never silently dropped.

**Instructions mode.** Turn the user's steps into the same numbered table (`T.1`, `T.2`, …) with
an Expected column you can observe. Keep it in the report only; write it into a plan only if
asked. If an instruction has no observable outcome, say what you will check and confirm it.

## Step 2 — Prepare the environment

1. **Pick the route** — web: read `references/web.md`; mobile: read `references/mobile.md`.
2. **Check what is already running** (`ss -ltnp`): local Supabase (54321 API, 54322 DB, 54324
   mail catcher), the app's port. Don't start a second dev server for an app folder that already
   has one (Next locks per project directory) and **never stop a server you did not start** —
   ask the user instead.
3. **Snapshot before writing.** With `scripts/q-readonly.sh`, read every row the checklist will
   change (settings rows, the users you will edit, their portals/roles) so you can restore them
   exactly. Before mutating any table, list its triggers
   (`select tgname from pg_trigger where tgrelid='public.<t>'::regclass and not tgisinternal`):
   a guarded or audited transition may have no way back. Prefer reversible levers; ask before an
   irreversible one.
4. **Test data is identifiable.** Create only what the checklist needs, named so it is obvious
   later: `<tag>-test-N@example.com`, codes like `L2TEST01`, names like "L2 Test Affiliate One".
   Use seeded rows only for read checks or edits you will revert.

**Environment.** Add an env var only with permission, append the one line, and never print or
read a whole `.env*` file — grep for the key name only (`grep -c '^KEY=' .env.local`). Confirm
the file is gitignored. Note the addition in the report.

**One-way actions are off limits** unless the user says yes for this run: anything the system
stamps permanently (e.g. the affiliate tax rate's go-live), deleting audited rows, closing an
account. Walk a confirmation dialog up to its last step and press Cancel — that is usually the
check.

## Step 3 — Run each check

For every item, in order:

1. Drive the UI (web: one small step module per check via `scripts/cdp-step.cjs`; mobile: adb).
2. **Screenshot**, and show it to the user by reading the PNG with the Read tool. Take
   intermediate shots inside a step when the result is transient (toasts).
3. **Back it with independent evidence** where the check has a data effect: read-only SQL
   (`q-readonly.sh`), the mail catcher (`scripts/mailpit-links.sh` — tokens are hidden), the dev
   server log (status codes of the POST/PATCH/DELETE you caused, and any 5xx).
4. **Restore** what the check changed, if it can be restored exactly, and confirm by SQL.
5. Tell the user the result in a line or two, then move on.

When a step fails, look at the screenshot before deciding why: a selector/automation problem
(retry the *automation* differently — see web.md's lessons) is not an app failure, and an app
failure is not to be worked around. Record what you saw.

## Step 4 — Clean up

- Stop every server and browser **you started**, by listening PID (`scripts/stop-port.sh <port>
  <recorded-pid>`), and confirm the ports are free. Leave servers the user started alone.
- Don't delete test data unless the user asks: list it. A `db reset` is the user's call.
- Leave env-var lines in place unless asked to remove them; say they are there.

## Step 5 — Record (plan mode)

Update the plan in the same turn as the report — a report that disagrees with the plan means the
plan is wrong:

- The L-table: each run row gets `✅ <date> — <one-line evidence>` or `❌ <date> — <what
  happened>`; ⏸ rows keep their reason. The block's heading gets a count (`🔄 15/16 ✅ …`) and how
  it was run.
- Item statuses (B#/I#): flip to ✅ only where machine checks **and** every one of that item's
  manual checks passed; otherwise keep 🔄 and say what remains.
- Findings: each bug, cosmetic issue or noteworthy observation becomes a numbered F-item with its
  own status (⬜ for anything not fixed). Never close a follow-up yourself.
- A "test data left" note under the table.
- The status line / RESUME HERE / Big table rows that the run changes.
- If the overall `**Status:**` line changed: `python3 scripts/plans-index.py` then `--check`.

No git writes. Offer a commit draft (commit-drafting skill); the user commits, or runs
`/auto-git`.

## Running in the background

When the user asks for it to run in the background, the invoking session hands the whole run to a
background agent with: the mode and argument, the target app, the permissions the user granted
(and the ones they didn't), that the user is already signed in (or how they will sign in), the
scratchpad path, and "report when done". The background agent follows this skill unchanged and
ends with the report below; the invoking session relays it to the user. A background run that
hits something needing a decision (a one-way action, a server it didn't start, a missing login)
stops at that point and reports, rather than guessing.

## The report

Always this shape:

```markdown
**Result:** <n>/<total> passed · <n> failed · <n> waiting — <how it was run, e.g. visible
Chromium on WSLg over CDP, signed in by the user as <role>>

| # | Check | Result | Evidence |
|---|---|---|---|
| L2.7 | Create affiliate user; invite target | ✅ | user created (SQL: code L2TEST01, portal affiliate); mail link redirect_to=http://localhost:3002 |
| L2.16 | Refusals with money on record | ⏸ | needs I5 (stage 3) |

**Findings** — bugs (❌, with screenshot path) · cosmetic · pre-existing / not caused by this work
**Test data left** — every row created, with ids; anything changed and not restorable
**Stopped / cleaned** — servers and browsers stopped (port, pid), ports confirmed free; env lines added
**Plan** (plan mode) — what was updated; index check result
```

Screenshot paths are full absolute scratchpad paths, so the user can open them.

## Scripts

| Script | Does |
|---|---|
| `scripts/launch-browser.sh [--check] <url> [profile] [port]` | Opens a visible Chromium on WSLg with a CDP port; `--check` reports without launching |
| `scripts/cdp-step.cjs <step> <shot> --app <dir>` | Attaches, runs one step module, screenshots, detaches (window stays open); exit 1 on a thrown step |
| `scripts/q-readonly.sh "<sql>"` | Read-only SQL, local database only (refuses any other URL) |
| `scripts/mailpit-links.sh <to>` | Newest local email to an address, with links and tokens hidden |
| `scripts/stop-port.sh <port> [pid]` | Stops the listener on a port, refusing if it isn't the PID you recorded |

Node comes from nvm and isn't on PATH by default: `source ~/.nvm/nvm.sh && nvm use v22.17.0`.
