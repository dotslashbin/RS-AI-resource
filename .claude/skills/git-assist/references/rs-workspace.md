# RS workspace: git facts

Read before planning git work in `/home/joshua/RS`. Recorded 2026-10-27, so re-check with the
commands shown rather than trusting a stale line.

## Seven repositories, not one

| Path | Repo | git-flow? |
|------|------|-----------|
| `/home/joshua/RS` (root) | `RS-AI-resource`: tracks only `architecture/`, `.plans/`, `.claude/`, `.codex/` and top-level Markdown | **No**, plain `master` |
| `booker/`, `vendor/`, `command/`, `backbone/` | one repo each | Yes |
| `ezzy-booker-mobile/`, `ezzy-vendor-mobile/` | one repo each | Yes |

The root `.gitignore` excludes the app folders, so running git from the root never touches an
app's history. Always use `git -C /home/joshua/RS/<app>`.

⚠️ **The root repo almost always holds other workstreams' uncommitted work.** Never `git add .`
or `-A` there. Stage with `git add -- <explicit paths>` and list what was left out, following
`commit-drafting` §2–§5. The same applies to `stash`: a bare `git stash` sweeps everyone's
changes. Use `git stash push -- <paths>` or ask.

## git-flow conventions (AVH 1.12.3)

Check with `git -C <repo> config --get-regexp '^gitflow'`.

- `master` = production-ready, `develop` = integration.
- Prefixes: `feature/`, `bugfix/`, `release/`, `hotfix/`, `support/`. Version-tag prefix is
  empty.
- **Releases are named `release/version-X.Y.Z` and tagged `version-X.Y.Z`.** Read
  `git log --merges --oneline -5 master` to confirm the latest number and naming before
  proposing a new one.
- Existing branch names mix `snake_case` and `kebab-case`. Ask or follow the user's wording.

## Branches that deploy or are shared

- **`production`** exists on the app repos alongside `master`. It is **not** part of
  git-flow, so `git flow release finish` does not touch it. Treat it as shared and
  deploy-sensitive, and ask how it is meant to move rather than guessing.
- ⚠️ **`backbone` `master`:** a GitHub integration watches it, and the release process is
  `supabase db push` plus a Vercel "Promote" of tested staging, all done manually. A merge or
  push to backbone `master` can trigger a deploy. Say so in the Assessment, recommend against
  it unless the user is deliberately releasing, and treat the step as ⚠️ separate confirm.
- `develop` and `master` on every repo are shared. Never force-push them (SKILL.md §5).

## Signing

`commit.gpgsign=true` on every repo. Every 🔏 step goes to the user, and that includes
`git flow feature finish` and `git flow release finish`, because both merge and the release
also tags. A `finish` that fails halfway through signing leaves a half-merged state, which is
the other reason it must not run from the agent.

## Plans

A plan under `.plans/` may list a commit or merge as a step. Under this skill, the user may
ask to carry it out. The commit itself is still 🔏, and Claude never marks the plan's step
done. The user closes it (core rules: never close follow-ups).
