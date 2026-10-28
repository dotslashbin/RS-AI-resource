---
name: commit-drafting
description: >
  Use when work is ready to commit in this workspace — how to hand over a commit instead of
  making one. Covers the no-git-writes rule, drafting one message per repository, and the
  copy-paste scoped `git add` command every draft must carry so unrelated work in progress on
  the same branch is never swept in. Read it before writing any commit summary.
---

# Commit drafting

**Nobody commits in this workspace except the user.** Do not run `git add`, `git commit`,
`git push`, `git rm`, `git restore --staged`, or any other git write command. Read-only git —
`status`, `diff`, `log`, `ls-files`, `check-ignore` — is fine and encouraged, because an
accurate draft depends on it.

The one exception is when the user asks Claude to do git work itself: then `git-assist`
applies, which runs only an approved plan and still hands every commit to the user to sign.

At the point where work would be committed, hand over a **message plus the exact command to
stage it**, and stop.

⚠️ **Two reasons this is not negotiable here.** The user's commits are **GPG-signed** and the
signing prompt fails when a commit is run from an agent session. And the repo layout below
means a careless `git add .` commits someone else's work.

---

## 1. One draft per repository

⚠️ **This workspace is not a monorepo.** Each app folder — `booker/`, `vendor/`, `command/`,
`ezzy-booker-mobile/`, `ezzy-vendor-mobile/` — is **its own git repository**, and the root repo
tracks only `architecture/`, `.plans/`, `.claude/`, `.codex/` and the top-level Markdown. The
root `.gitignore` excludes the app folders outright.

So a change touching an app and its plan is **two commits in two repositories**. Each draft
block must `cd` into the right one; a command run from the wrong directory silently targets
the wrong repo or does nothing.

---

## 2. Every draft carries a scoped `git add`

Not a file list in prose — a command the user can paste.

```bash
cd /abs/path/to/repo && git add -- \
  path/one \
  path/two \
  dir/three
```

- **`git add -- <paths>`, never `.` and never `-A`.** The `--` guards against a path that
  looks like a flag.
- **Absolute `cd`**, so the command works from wherever they are.
- **Directories are fine** when everything beneath them belongs to the change.
- **Follow it with a verification line** so they can confirm nothing extra landed:

```bash
git status --short
git diff --cached --name-only
```

⚠️ **Verify every path exists before printing the command.** A draft that fails halfway leaves
a partly-staged index, which is worse than no command at all.

---

## 3. Say what is excluded, and why

⚠️ **The root repo almost always carries unrelated work in progress on the same branch.** This
is the single most likely way an agent causes damage here: not by writing bad code, but by
listing a path that belongs to someone else's half-finished workstream.

List the excluded paths explicitly under the command. Typical categories:

- another workstream's plans, scripts and notes
- stray files (Windows `:Zone.Identifier` markers, editor backups)
- generated artefacts that are gitignored anyway

---

## 4. Check what is already staged, first

⚠️ **The user sometimes stages before asking for the message.** Run `git status --porcelain`
and read the index column before drafting.

- A path already staged does not need to be in the `git add`.
- ⚠️ **A file deleted from disk but left in the index still commits, from the index.** Status
  shows `AD`. Deleting the file is not enough — say so and give the `git rm --cached <path>`
  line.
- If something was staged by mistake, **do not unstage it yourself** — give them
  `git restore --staged <paths>` and say what you saw.

---

## 5. Flag generated files that couple workstreams

Some tracked files are regenerated from everything in the repo, so staging one drags unrelated
work into the commit. ⚠️ **`.plans/INDEX.md` is the live example**: `scripts/plans-index.py`
rebuilds it from *every* plan on DISK, so a tree holding two workstreams produces an index
describing both. Name the coupling when it matters.

⚠️ **Since 2026-10-21 the generator defuses the worst of this itself**: a plan git does not
track yet is listed **unlinked and marked `(uncommitted)`**, so committing the index can no
longer ship a dead link to someone else's unshared plan. The row stays visible — another
session still needs to see that the work exists — without pointing at a file that is not there.

⚠️ **That makes the ORDER load-bearing.** "Tracked" is read from `git ls-files`, which counts
files that are **staged** as well as committed, so:

```bash
git add -- .plans/<the plans this commit ships>   # stage the plans FIRST
python3 scripts/plans-index.py                    # now they count as tracked
git add -- .plans/INDEX.md                        # stage the index it just wrote
```

Regenerating **before** staging marks this commit's own plans `(uncommitted)`, which is wrong
the moment it lands.

---

## 6. The message

Follow the repo's existing style — read `git log` before writing. What matters:

- **A subject line that names the outcome**, not the mechanism.
- **Why, where it is not obvious**, and especially **what was measured**. A claim like "the
  logo was rendering at 59% of its neighbours" is worth more than "fix logo size".
- ⚠️ **State what is NOT verified.** If a check needs staging, a device or a live session, the
  commit message is the right place to record that it did not run here.
- **Findings and corrections**, briefly — a bug introduced and caught during the work belongs
  in the record.
- End with the attribution lines the session provides, when it provides them.

**Do not split into several commits when an intermediate one would be broken.** If baselines,
generated files or fixtures were regenerated once at the end, a per-stage split leaves earlier
commits failing their own tests; one honest commit beats three that do not build.

---

## 7. What "the plan says commit" means

A plan may list a commit as a step. ⚠️ **That step means *draft the message*.** Mark it owned
by the user in any status table, and never tick it off as done yourself.
