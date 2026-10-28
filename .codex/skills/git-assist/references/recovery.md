# Recovery and undo paths

Use these to give every plan an **Undo** line, and when the user arrives with something
already broken. Diagnose first with read-only commands, then propose. The usual plan
approval applies.

## Before anything that rewrites history

Make a backup ref, which is cheap and needs no signature:

```bash
git -C <repo> branch backup/<branch>-<YYYYMMDD-HHMM> <branch>
```

Mention it in the report. Deleting it later is a ⚠️ step.

## What went wrong → how back

| Situation | Look first | Recover |
|-----------|-----------|---------|
| Last local commit is wrong, not pushed | `git log -3` | `git reset --soft HEAD~1` keeps the changes staged. Recommitting is 🔏 |
| Commit already pushed to a shared branch | `git log origin/<b> -5` | `git revert <sha>` (🔏), never reset plus force |
| Reset, rebase or amend lost commits | `git reflog -20` | `git branch rescue/<x> <sha-from-reflog>`, then inspect |
| Deleted a branch | `git reflog`, or the sha printed when it was deleted | `git branch <name> <sha>` |
| Dropped a stash | `git fsck --no-reflog \| grep commit` | `git stash apply <sha>` |
| Merge or rebase in progress and confused | `git status` (says which) | `git merge --abort` / `git rebase --abort` / `git cherry-pick --abort` returns to before it started |
| `git flow … finish` stopped halfway | `git status`, `git branch`, `git tag -l '<tag>'` | Usually a merge conflict: resolve, then the user re-runs the same `finish` command, which resumes. Check the AVH wiki for the specific type |
| Committed on the wrong branch, not pushed | `git log -3` | `git branch <right> ` → `git reset --keep HEAD~N` on the wrong one (⚠️) |
| Detached HEAD with new commits | `git log -3` | `git switch -c <new-branch>` before switching away |

`--keep` is safer than `--hard` because it refuses to throw away uncommitted changes. Prefer it.

## Reflog limits

The reflog is local only and expires (90 days by default, 30 for unreachable commits). Work
that was never committed or stashed, such as changes wiped by `checkout -- .`, `restore` or
`reset --hard`, is **not** in the reflog. Say that plainly rather than promising a recovery.
