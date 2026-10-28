---
name: git-assist
description: >
  Use when the user asks Claude to actually do something in a git repository: create, finish,
  merge, rebase, publish or delete branches; run a git-flow feature, bugfix, release or hotfix;
  stash, tag, cherry-pick, revert, undo, sync with the remote or untangle a messy state. It
  researches the repo and the official git and git-flow docs, judges whether the request is
  possible and the best way to get there, presents a numbered command plan, and runs nothing
  that writes until the user approves. Trigger on "/git-assist", and on phrases like "do the
  git for me", "start a feature branch", "finish the release", "git flow …", "merge X into Y",
  "undo my last commit", "clean up my branches", "how do I get my branch back in sync", even
  when the user does not say "git" outright. Not for drafting a commit message only (that is
  commit-drafting).
---

# Git assist

The user does not normally let Claude touch git. This skill is the one sanctioned way they
do: **research first, propose a plan, get one explicit approval, then run it.** Invoking this
skill is what lifts the usual "no git writes" rule from `commit-drafting` for the requested
task, and only for it. It covers nothing beyond the approved plan.

Two things never change, even inside this skill:

- **Commits are signed by the user.** `commit.gpgsign` is on, and signing fails from an agent
  session. Any step that creates a commit goes to the user as a `!` line to run (see §5).
- **Nothing that writes runs before approval.** Reading is always fine. That covers `status`,
  `log`, `diff`, `branch -a`, `reflog`, `show`, `rev-parse`, `config --get`, `ls-remote` and
  `fetch --dry-run`.

If this workspace is the RS workspace (`command/`, `booker/`, `vendor/`, `backbone/`, …),
read `references/rs-workspace.md` before planning. It records the repo layout, the git-flow
conventions in use and the branches that deploy.

---

## 1. Restate the goal

Say in one sentence what the user wants to **end up with**, not which command they named.
"Merge develop into my feature" and "get my feature up to date with develop" can have
different best answers. If the end state is genuinely ambiguous and the answer changes the
plan, ask one question before researching.

## 2. Look at the repo (read-only)

Gather what the plan depends on before deciding anything. The usual set:

```bash
git -C <repo> status --short --branch
git -C <repo> branch -vv                       # local branches, upstreams, ahead/behind
git -C <repo> log --oneline --graph -15 --all  # shape of recent history
git -C <repo> stash list
git -C <repo> config --get-regexp '^gitflow'   # is git-flow initialised, and with what names
git -C <repo> fetch --dry-run                  # is the remote ahead of us
```

Add whatever the task needs: `git log A..B` for what a merge would bring, `git merge-tree` to
preview conflicts, `git reflog` for undo work. Always use `git -C <abs-path>` or an absolute
`cd`. Several repos can sit in one folder tree, and running in the wrong one silently does the
wrong thing.

Note anything that would ambush the plan: uncommitted changes, a detached HEAD, a rebase or
merge already in progress, a branch with no upstream, a branch already pushed (rewriting it
affects others), or untracked files a checkout would overwrite.

## 3. Check the docs

Ground every command in the documentation for the **installed** version, not memory. Flags
drift between versions, and git-flow has two incompatible lineages (the original nvie and
AVH, with AVH being what most systems ship).

- **git, local and version-exact:** `git <cmd> -h` for the synopsis, and
  `man git-<cmd> | col -b | grep -n -A6 -- '--flag'` for a specific option's exact behaviour.
  Check `git --version`.
- **git-flow, local:** `git flow version`, then `git flow <type> help` and
  `git flow <type> <action> -h` (for example `git flow release finish -h`). The `-h` output
  lists every flag the installed version supports, including `--keepremote`, `-F` (fetch
  first) and `-S` (squash).
- **Online, when local docs are thin or the concept needs explaining:**
  `https://git-scm.com/docs/git-<cmd>`, the Pro Git book at `https://git-scm.com/book`, the
  git-flow AVH wiki at `https://github.com/petervanderdoes/gitflow-avh/wiki`, and the original
  branching model at `https://nvie.com/posts/a-successful-git-branching-model/`.

Read only what the plan needs. One flag looked up properly beats a page skimmed.

## 4. Judge the request

This is where the skill earns its keep. Before writing a plan, answer honestly:

- **Is it possible as asked?** For example, `git flow feature finish` on a branch that is not
  a feature branch, a fast-forward that cannot fast-forward, or a tag that already exists.
  If not, say so and say what is possible.
- **Is it the best way?** If a safer or simpler route reaches the same end state, recommend
  it and say why, while still offering what they asked for. Typical cases:
  - `revert` instead of `reset` plus force-push once a commit is on a shared branch
  - `git flow feature finish` instead of a hand-rolled merge when git-flow is initialised,
    so the branch bookkeeping stays consistent
  - `switch`/`restore` instead of the older catch-all `checkout`
  - `push --force-with-lease` instead of `--force`
  - a backup branch before anything that rewrites history
- **What does it affect beyond what they named?** Remote branches, other people's clones,
  deploy hooks, open pull requests, stashes, untracked files.

If the request is fine as is, say so in a line. Do not invent objections.

## 5. Present the plan, then wait

The user reads this in a terminal and only needs two things to decide: your assessment and
the commands. Send exactly those, and aim for about 250 words.

```
**Assessment:** <repo and branch, one line. Possible? Best way? Anything found that changes
the plan, e.g. an uncommitted edit or a surprising commit, as short bullets with the
option you picked and any decision the user must make>

| # | Command | What it does | Risk |
|---|---------|--------------|------|
| 1 | git fetch origin | update remote-tracking refs | none |
| 2 | git switch develop | … | low |
| 3 | 🔏 ! git flow feature finish foo | merges into develop (signed commit) | you run it |
| 4 | ⚠️ git push --force-with-lease | rewrites origin/foo | separate confirm |

Approve to run 1–2. Step 3 is yours to run, and I'll pick up after it.
```

- **Name the repo once**, in the assessment, and write commands without the path so the
  table stays readable. When you actually run them, use `git -C <abs-path>`. The `!` lines
  for the user include `-C <path>` only if their prompt's working directory is not the repo.
- **Leave out** sections on checks, undo or docs used. You still check every step's output,
  stop on surprises (§6) and know the undo path. Mention undo only for a ⚠️ step, in its
  "What it does" cell, and give it in full in the report (§7).
- **Only the steps the request needs.** No extra housekeeping, such as version bumps,
  changelog edits or branch cleanup, unless the user asked. Mention it in one line as an
  option instead.

Risk legend:

- **none / low** – reads, fetches, creating a branch, switching with a clean tree, stashing.
- **🔏 you run it** – anything that **creates a commit** and so needs the user's signature:
  `commit`, a non-fast-forward `merge`, `git flow … finish`, `rebase`, `cherry-pick`,
  `revert`, `pull` that merges or rebases, `commit --amend`, and signed or annotated `tag`
  when `tag.gpgsign` is set. Give the exact line prefixed with `!` so they can run it in this
  prompt, with the reason. If `!` cannot reach their GPG agent, it runs in their own terminal
  just as well. After they run it, re-check with `git status` / `git log -3` and continue.
- **⚠️ separate confirm** – anything that destroys or rewrites: `reset --hard`, `clean -f`,
  `branch -D`, deleting a remote branch, `push --force[-with-lease]`, `stash drop/clear`,
  `checkout/restore` over uncommitted changes, `filter-repo`. Plan approval does not cover
  these. Stop at the step, restate exactly what will be lost, and wait for a fresh yes. For
  force-pushing a shared branch (`master`, `main`, `develop`, `production` or anything
  others build on), do not propose it. If the user asks for it, explain the consequence for
  everyone else's clones and the alternative, and run it only on an explicit, specific yes.

**Then stop and wait.** Approval means a clear yes to this plan. Silence, "looks
interesting" or a question is not approval. If the user changes the plan, re-present the
changed part before running.

## 6. Run it

- Run the approved steps **one at a time**, in order, exactly as shown. If a step needs to
  change, for example because a flag turns out wrong, stop and re-present it. Do not improvise.
- After each step, read the output against the check you stated. **Stop on anything
  unexpected**: a conflict, a non-zero exit, "nothing to commit", a hook failure, or a
  different branch from the one expected. Report what happened and the current state, and
  propose the next move as a new mini-plan.
- **Conflicts:** do not resolve them silently. List the conflicted files, show the hunks if
  they are small, propose resolutions, and get approval before editing. Finishing the merge
  or rebase is then a 🔏 step for the user.
- Never add flags that bypass safety on your own initiative: `--no-verify`, `--no-gpg-sign`,
  `-f`, `-X theirs`.

## 7. Report

Finish with:

- **Done:** each step and its result, including which ones the user ran.
- **State now:** `git status --short --branch` and `git log --oneline -5` (or the graph) for
  the repos touched.
- **Not done / follow-up:** anything skipped, parked or left for the user, such as a push
  they chose to do later, or a stale branch noticed but not touched.
- **Undo:** the recovery path, while it is still easy.

See `references/recovery.md` when a plan needs an undo path, or when something has already
gone wrong and the user wants it fixed.
