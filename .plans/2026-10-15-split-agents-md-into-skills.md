# Split root AGENTS.md into an always-loaded core-rules skill

**Date:** 2026-10-15
**App / scope:** Root instruction and agent-config files only (`AGENTS.md`, `CLAUDE.md`, `.claude/skills/`, `.claude/rules/`, `.codex/skills/` mirrors). No application code, no app repos, no nested `AGENTS.md`.
**Status:** COMPLETE (2026-10-15). All stages S0–S6 are done and verified. F2 closed and F9 accepted as-is by you. Still with you: the commit (see Handoff).

> Shrink the root `AGENTS.md` and move its rules into `.claude/skills/core-rules/SKILL.md`, which loads every session.
> Split `developerboss` into two parts:
> - **General workflow**: pre-flight, execution cadence and stage reporting. This lives in `AGENTS.md` → "Working Flow", where every agent gets it.
> - **Coding only**: everything else stays in `developerboss`.
>
> No rule, gate or convention becomes optional.

**Revision log**
- **r1 (2026-10-15):** first draft. All 13 recommendations accepted the same day.
- **r2 (2026-10-15):** at your request, `developerboss` was studied and split. Its non-coding parts and the non-coding working-style items now go to `AGENTS.md` ("Working Flow"). `developerboss` becomes coding-only. This **supersedes** two earlier points:
  - The brief's `developerboss` naming rule, which made it the home of "executing and reporting on plans".
  - The brief's "rules should not be in the minimal `AGENTS.md`" for this content.

  Affected: §5, §6, §6b, §7, §8, D2 (reopened), D7 (scope widened), D14–D15 (new), §10–§12.

---

## 1. Status legend

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED (needs a reason and an unblock condition) · ✖ ABORTED (needs a reason).
> **Numbering legend:**
> - `A#` = content item of the current root `AGENTS.md`.
> - `B#` = content item of the current `developerboss/SKILL.md`.
> - `U#` = unclassifiable line. `D#` = decision. `R#` = proposed rewording. `S#` = execution stage. `F#` = finding.
>
> All numbers are plan-local.

---

## 2. Loading model (verified 2026-10-15)

Checked against the official Claude Code docs (`code.claude.com/docs/en/memory`, `/context-window`, `/hooks`, `/skills`) and the Codex docs (`learn.chatgpt.com/docs/agent-configuration/agents-md`, `/docs/build-skills`). Installed Codex CLI: `0.162.1`.

| Mechanism | When its content reaches the agent | Guaranteed? | Differs from the brief? |
|---|---|---|---|
| `CLAUDE.md` + `@AGENTS.md` import | At launch, every session, from the working directory **and every ancestor** | Yes | Detail: Claude reads `AGENTS.md` natively **only when no `CLAUDE.md` exists**. Here one does, so the `@AGENTS.md` import is what loads it. |
| A file `@`-imported from `CLAUDE.md` | With `CLAUDE.md` | Yes | Detail: paths resolve **relative to the importing file**, with a maximum depth of **four hops**. Paths inside code spans and fenced blocks are **not** imports. |
| `.claude/rules/*.md`, no `paths:` | At launch, every session | Yes | Detail: discovery is recursive and symlinks are supported. |
| `.claude/rules/*.md` with `paths:` | When Read/Write/Edit touches a matching file, or `cat`/`head` views one | Yes, for matching files | Detail: after compaction it is **not** re-injected until a matching file is touched again. |
| `SessionStart` hook | At start. Matchers: `startup`, `resume`, `clear`, `compact`, **`fork`** | Yes, if configured and it succeeds | Adds `fork`. Hooks **merge** across settings levels. |
| `UserPromptSubmit` hook | Every prompt | Yes | Adds a **10,000-character cap** on stdout (a 2,000-character preview is injected above that). |
| Skill `SKILL.md` | Description always listed; body loads on invocation or match | **No** | Confirmed. No frontmatter field makes a body always-on. Invoked bodies are re-injected after compaction (up to 5,000 tokens per skill and 25,000 in total). |
| A line in `AGENTS.md` saying "read X" | Only if the agent complies | **No** | Confirmed. |

**After compaction:** the docs say the project-root `CLAUDE.md` and unscoped rules are re-injected. They do not mention `@`-imports separately, so S3 checks this by hand. The current `@AGENTS.md` import already relies on it.

**Codex** (the other agent; `~/.codex/config.toml` trusts `/home/joshua/RS`):
- **Instructions:** Codex reads `AGENTS.override.md` or `AGENTS.md` from the git root down to the cwd, up to 32 KiB, and does **not** follow imports or links. Content in `AGENTS.md` itself is therefore guaranteed for Codex. Anything else depends on a "read this path" line.
- **Skills:** Codex discovers skills in `.agents/skills` and `~/.agents/skills` only (see F2).

---

## 3. Baseline (recorded 2026-10-15, before any work)

`HEAD` = `2301a706b00344095e18d881d7b2396af17fc428` on `master`. `git status --porcelain`:

```
 M .plans/2026-09-29-vendor-kiosk-custom-checkout.md
 M .plans/2026-10-07-checkout-s2-contracts.md
 M B7-EVIDENCE-RESPONSE.md
 M CHECKOUT-HANDOFF.md
 M ezzy-vendor-mobile
?? .plans/2026-10-11-checkout-provider-verification.md
?? .plans/2026-10-14-booker-near-me-discovery.md
?? .plans/2026-10-15-checkout-s2-candidate-review.md
?? .plans/2026-10-15-checkout-s2-consolidated-brief.md
?? .plans/previews/kiosk-binding/
?? .plans/previews/near-me/
?? .plans/scripts/
```

**Every path above belongs to the other agent's session and is out of bounds.** That includes the nested `ezzy-vendor-mobile` repo, whose working tree is dirty. No file this plan changes appears in the baseline. This session adds exactly one path: `?? .plans/2026-10-15-split-agents-md-into-skills.md`. `.plans/INDEX.md` has not been regenerated; run `python3 scripts/plans-index.py` whenever you like.

**Target-file checksums (sha256, first 16 hex; re-checked before every stage):**

| File | sha256 | File | sha256 |
|---|---|---|---|
| `AGENTS.md` | `a20fdf8821e5a303` | `CLAUDE.md` | `4be085e5b886a6a6` |
| `.claude/skills/developerboss/SKILL.md` | `01f1cc03b731737b` | `.codex/skills/developerboss/SKILL.md` | `01f1cc03b731737b` |
| `.claude/skills/plan-authoring/SKILL.md` | `54930d7f86dfc258` | `.codex/skills/plan-authoring/SKILL.md` | `54930d7f86dfc258` |
| `.claude/skills/supabase-exp/SKILL.md` | `6074f9403ea32683` | `.codex/skills/supabase-exp/SKILL.md` | `6074f9403ea32683` |
| `.claude/skills/mobile-dev/SKILL.md` | `4c77a382797be363` | `.codex/skills/mobile-dev/SKILL.md` | `4c77a382797be363` |
| `.claude/settings.local.json` | `949d12f179377641` | | |

---

## 4. Current inventory

"Tracked" means tracked by the root repo unless stated otherwise. Nothing in this repo regenerates these files: searches of `scripts/`, `.plans/scripts/` and `architecture/` found no sync tooling.

| Path | Lines | Role | Status |
|---|---|---|---|
| `AGENTS.md` | 258 | Root instructions (subject of this plan) | Tracked |
| `CLAUDE.md` | 2 | `# CLAUDE.md` + `@AGENTS.md` | Tracked |
| `AGENTS.md.backup` | 222 | Old snapshot (2026-05-06), not loaded by anything | Tracked. Not touched, and **not** this plan's backup. |
| `.claude/settings.json` | 5 | `enabledPlugins` only, no hooks | Tracked, shared |
| `.claude/settings.local.json` | 99 | `permissions` only, no hooks | Ignored (local) |
| `~/.claude/settings.json`, `~/.claude-mine/settings.json` | n/a | User settings, no hooks | Outside the workspace. Read-only check. |
| `.claude/rules/` | n/a | **Does not exist** | n/a |
| `.claude/skills/developerboss/SKILL.md` | 126 | Pre-flight + execution cadence. **Split by this plan (§6b).** | Tracked |
| `.claude/skills/plan-authoring/SKILL.md` | 249 | Plan method, status model, nine-step flow | Tracked |
| `.claude/skills/mobile-dev/SKILL.md` | 163 | Mobile workflow; its §1 layers deltas onto developerboss steps | Tracked |
| `.claude/skills/supabase-exp/SKILL.md` | 220 | Supabase checklist | Tracked |
| `.claude/skills/{component-separation,ux-design,prompt-writing,big-table,website-eval}/SKILL.md` | 72 / 51 / 31 / 51 / 182 | Task skills | Tracked. Not touched. |
| `.claude/skills/{claude-handoff,grill-me,grill-with-docs,grilling,handoff}` | symlinks | Point to `../../.agents/skills/<name>` | Tracked symlinks |
| `.agents/skills/*` (5 skills) + `skills-lock.json` | small | Third-party skills from `mattpocock/skills` | Tracked, **managed** by the lock file. Not touched. |
| `.codex/skills/<9 project skills>/SKILL.md` | same | **Byte-identical manual copies** of the `.claude/skills` project skills | Tracked, hand-synced. See D7 and F2. |
| `~/.claude*/skills/synced/…` | n/a | claude.ai-synced user skills; no name clash | Outside the workspace, managed by sync. Not touched. |
| `booker/`, `vendor/`, `ezzy-booker-mobile/`, `ezzy-vendor-mobile/` `AGENTS.md` + `CLAUDE.md` | 236 / 187 / 5 / 301 (+1 each) | Nested app layers | Each tracked in its **own** repo. Out of scope. `ezzy-vendor-mobile` is dirty (other agent). |
| `command/`, `backbone/` | n/a | No `AGENTS.md` or `CLAUDE.md` | n/a |

**Nested rules that depend on moved content.** None break, because the D8 alias sentence covers them without any edits to these files:
- `booker/AGENTS.md:3`, `vendor/AGENTS.md:3-4` and `ezzy-vendor-mobile/AGENTS.md:5-6` all say they "layer on top of the workspace root `AGENTS.md`".
- `booker/AGENTS.md:59` and `vendor/AGENTS.md:60` point to the root component conventions (A97–A105).
- `vendor/AGENTS.md:83` points to the root approval gates (A59).
- `ezzy-vendor-mobile/AGENTS.md:139-166` quotes A102 verbatim and cites the "root tech-stack section". **A102's wording is frozen.**
- `ezzy-vendor-mobile/AGENTS.md:296-300` cites "every Red Line in the root file" (A41–A52).
- `ezzy-vendor-mobile/AGENTS.md:46-55` must stay identical to A73.
- Out-of-scope docs: `architecture/conventions.md:326` (A54), `architecture/schema.md:52` (A67) and `architecture/portals.md:454` (F3).

---

## 5. Overlap check, dangling references, contradictions

### `developerboss` naming rule: applied in r1, superseded for non-coding content in r2

The name appears at:
- `.claude/skills/developerboss/SKILL.md:2` and its `.codex` copy
- `AGENTS.md:181`
- `plan-authoring/SKILL.md:71,246`
- `mobile-dev/SKILL.md:26`

No skill named `developer` exists, so there is nothing to retire. Since r2, `developerboss` holds **coding** workflow only: locate, data layer, risk surface, SOLID, style separation, simplicity first, surgical changes and the coding parts of goal-driven execution. The non-coding developer workflow goes to `AGENTS.md` → "Working Flow": scope, assumptions, sizing, think-before-coding, execution cadence and stage/completion reporting.

### Dangling references

| Where | Text | Fix | Stage |
|---|---|---|---|
| `developerboss/SKILL.md:59` | "Sections 1–8 above still run first." | Moves to `AGENTS.md` with B12 → **R8** | S5 |
| `developerboss/SKILL.md:85` | "listed under AGENTS.md \"Ask Before\"" | Moves to `AGENTS.md` with B14 → **R9** | S5 |
| `developerboss/SKILL.md:92-96` | History note about the old AGENTS.md wording | B15 → **D15** (remove, or carry over) | S5 |
| `plan-authoring/SKILL.md:9` | "Extends the Plan flow in `AGENTS.md`" | → "Extends the Plan flow in the core rules (`.claude/skills/core-rules/SKILL.md`)" | S4 |
| `plan-authoring/SKILL.md:70-74` | "through `.claude/skills/developerboss/SKILL.md`'s judgment checks — scope, locate existing patterns …" | → **R12** | S5 |
| `plan-authoring/SKILL.md:245-247` | "Execution cadence is one stage at a time by default — see `.claude/skills/developerboss/SKILL.md`." | → **R13** | S5 |
| `mobile-dev/SKILL.md:26-27` | "`developerboss` is the full pre-flight checklist and still applies in full … deltas at the matching step". Its "**Scope.**" delta (line 29) now matches a step in `AGENTS.md`. | → **R14** | S5 |
| `supabase-exp/SKILL.md:10-11` | "This supplements `AGENTS.md` — where they overlap, `AGENTS.md`'s invariants win" | → "This supplements the core rules (`.claude/skills/core-rules/SKILL.md`) — where they overlap, the core rules' invariants win" | S4 |
| `supabase-exp/SKILL.md:47` | "per `AGENTS.md`'s \"if uncertain, stop and ask.\"" | → "per the core rules' \"if uncertain, stop and ask.\"" | S4 |
| `supabase-exp/SKILL.md:57` | "(`AGENTS.md`)" | → "(core rules → Ask Before)" | S4 |
| `supabase-exp/SKILL.md:202` | "(per `AGENTS.md`)" | → "(per the core rules)" | S4 |
| `.codex/skills` copies of the four skills | same lines | Mirrored (D7) | S4 / S5 |
| Nested app `AGENTS.md` files and `architecture/*.md` | "root `AGENTS.md`" | Not edited (out of scope); the D8 alias sentence resolves them | n/a |

### Findings and contradictions (reported, not fixed)

- **F1.** `AGENTS.md:17` says the root repo "tracks only `architecture/`, `.plans/`, `.claude/`, and the top-level Markdown". It also tracks `.agents/`, `.codex/` and `skills-lock.json`. The line moves verbatim.
- **F2.** Current Codex docs list only `.agents/skills` as the repo skills location, so the `.codex/skills` copies may never be discovered. Check with `/skills` in a new Codex session. This doesn't block the plan, because `AGENTS.md` points to skills by path.
  - **Evidence (2026-10-15): a false alarm.** The new Codex session's log (`~/.codex/sessions/2026/10/15/rollout-2026-10-15T21-37-36-….jsonl`, read-only grep) lists skill roots `r0` = `~/RS/.codex/skills` and `r7` = `~/RS/.agents/skills`. All 9 project skills load from `r0`; `grilling` loads from `r7` (the other four `.agents` skills set `disable-model-invocation`).
  - So Codex 0.162.1 **does** discover `.codex/skills`, and the docs fetched earlier were incomplete. This confirms D7: the `.codex` mirrors are live and must stay identical.
  - ✅ **CLOSED by you (2026-10-15).** You confirmed in Codex's skill list that the project skills are present, including the updated `developerboss`.
- **F3.** `architecture/portals.md:454` says "`AGENTS.md` forbids cross-app imports". No line says that literally (the closest is A3). Pre-existing.
- **F4.** A33 (non-negotiable rules first) is in tension with A73 ("More local files override broader guidance"). Pre-existing; both move unchanged.
- **F5.** Line 258 is a literal `...` (U1).
- **F6.** Duplicates within `AGENTS.md`: A16 ⇄ A54; A18 ⇄ A45, A66; A22 ⇄ A51; A26 ⇄ A62; A31 ⇄ A67; A32 ⇄ A68. All kept.
- **F7 (r2).** Once moved, two items are near-duplicates inside "Working Flow": B7 ("List anything that is assumed to be true but not confirmed") and A77 ("State important assumptions before implementation"). Both are kept, so nothing is lost. Merging them is a possible future clean-up.
- **F8 (r2).** "Think Before Coding" (A76–A81) has a coding-sounding title, but its content applies to any task. It goes to "Working Flow" with its heading verbatim.

---

## 6. Migration checklist: root `AGENTS.md` items

Destinations:
- **core** = `.claude/skills/core-rules/SKILL.md` (new).
- **mobile** = `.claude/rules/mobile-stack.md` (new, path-scoped).
- **AGENTS** = stays in or moves into `AGENTS.md`. **AGENTS·WF** means the new "Working Flow" section.
- **dboss** = `.claude/skills/developerboss/SKILL.md`, which is coding-only after r2.

Mechanisms:
- core: `@` import in `CLAUDE.md`; Codex reaches it through the Read-first path.
- AGENTS: the `@AGENTS.md` import plus Codex native discovery, so it is **guaranteed for both agents**.
- dboss: `@` import if D2 = A, otherwise skill description match.
- mobile: `paths:` glob.

Verification codes: **Vc** = coverage script (automatic). **Vq** = quote test (manual). **Vp** = path-trigger test (manual). **Vr** = reference check (automatic).

| ID | Content | Source `AGENTS.md` lines | Destination | Trigger | Mechanism | Overlap / dangling refs | Verification | Status |
|---|---|---|---|---|---|---|---|---|
| A1 | `# AGENTS.md` title | 1–2 | AGENTS | Stays in AGENTS.md | `@AGENTS.md` import; Codex native | none | Vc | ✅ (2026-10-15) |
| A2 | `## Workspace` + app tree | 3–16 | core | Every session, at start | `@` import in `CLAUDE.md` | `architecture/overview.md` | Vc | ✅ (2026-10-15) |
| A3 | Independent apps, not a monorepo, own git repos, what root tracks | 17–18 | core | Every session, at start | `@` import | F1 | Vc | ✅ (2026-10-15) |
| A4 | "Working from this root is the intended default …" | 19–20 | core | Every session, at start | `@` import | `ezzy-vendor-mobile/AGENTS.md:6-8`, `mobile-dev:14-15` | Vc | ✅ (2026-10-15) |
| A5 | RULE: nested `AGENTS.md` files layer on top "(see AGENTS.md Use)"; mobile RN overrides | 21 | core | Every session, at start | `@` import | Cross-file ref → **R1** | Vc | ✅ (2026-10-15) |
| A6 | RULE: package/toolchain commands are not root-relative | 22 | core | Every session, at start | `@` import | `ezzy-vendor-mobile/AGENTS.md:263` | Vc | ✅ (2026-10-15) |
| A7 | RULE: app git commits are made inside the app folder | 23–24 | core | Every session, at start | `@` import | `ezzy-vendor-mobile/AGENTS.md:104` | Vc | ✅ (2026-10-15) |
| A8 | `### Where to look`: check `.plans/INDEX.md` first | 25–28 | core | Every session, at start | `@` import | `plan-authoring:56-58` | Vc | ✅ (2026-10-15) |
| A9 | `architecture/` doc routing table | 29–44 | core | Every session, at start | `@` import | `supabase-exp:17-33` | Vc | ✅ (2026-10-15) |
| A10 | `---`, `## Shared Tech Stack`, `### Frontend`: Next.js stack; `package.json` is authoritative | 45–54 | core | Every session, at start | `@` import | "this file" now means core | Vc | ✅ (2026-10-15) |
| A11 | Maps are booker-only | 55–56 | core | Every session, at start | `@` import | `booker/AGENTS.md` | Vc | ✅ (2026-10-15) |
| A12 | `### Mobile (…)` heading | 57–58 | mobile | When files under `ezzy-*-mobile/**` are touched | `paths:` rule | `ezzy-vendor-mobile/AGENTS.md:164-166` (D8) | Vc, Vp | ✅ (2026-10-15) |
| A13 | Framework: Expo SDK 57, `expo-router` | 59 | mobile | Same as A12 | `paths:` rule | `mobile-dev` | Vc, Vp | ✅ (2026-10-15) |
| A14 | Language: TS strict, `@/*` alias | 60 | mobile | Same as A12 | `paths:` rule | none | Vc, Vp | ✅ (2026-10-15) |
| A15 | RULE: Expo has changed; read the v57 docs | 61 | mobile | Same as A12 | `paths:` rule | `mobile-dev:17-19`; `ezzy-vendor-mobile/AGENTS.md:36-38` | Vc, Vp | ✅ (2026-10-15) |
| A16 | **GATE**: installing a dependency is an approval gate (mobile) | 62 | mobile | Same as A12. **The gate is always on via A54.** | `paths:` rule | dup A54 | Vc, Vp | ✅ (2026-10-15) |
| A17 | Backend: same Supabase/RLS; RN session adapter | 63 | mobile | Same as A12 | `paths:` rule | A20–A26 | Vc, Vp | ✅ (2026-10-15) |
| A18 | RULE: `EXPO_PUBLIC_`; service-role key never reaches a mobile client | 64 | mobile | Same as A12. **The rule is always on via A45 and A66.** | `paths:` rule | dup A45, A66 | Vc, Vp | ✅ (2026-10-15) |
| A19 | RULE: store compliance; read `mobile-dev` | 65–66 | mobile | Same as A12 | `paths:` rule; skill description | `ezzy-booker-mobile/AGENTS.md:5`; `ezzy-vendor-mobile/AGENTS.md:40-42` | Vc, Vp | ✅ (2026-10-15) |
| A20 | `### Backend / Database` heading | 67–68 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A21 | Platform: Supabase; Database: Postgres | 69–70 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A22 | RULE: Supabase Auth only | 71 | core | Every session, at start | `@` import | dup A51 | Vc | ✅ (2026-10-15) |
| A23 | Storage: Supabase Storage | 72 | core | Every session, at start | `@` import | `supabase-exp` §9 | Vc | ✅ (2026-10-15) |
| A24 | RULE: Realtime only where explicitly needed | 73 | core | Every session, at start | `@` import | `supabase-exp:202` (S4) | Vc, Vr | ✅ (2026-10-15) |
| A25 | Client: `supabase-js` + `@supabase/ssr` | 74 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A26 | RULE: RLS on every table | 75–76 | core | Every session, at start | `@` import | dup A62 | Vc | ✅ (2026-10-15) |
| A27 | `### Shared Invariants (cross-app)` heading | 77–78 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A28 | RULE: one shared Supabase project | 79 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A29 | RULE: official client only; no raw SQL outside migrations | 80 | core | Every session, at start | `@` import | A65 | Vc | ✅ (2026-10-15) |
| A30 | RULE: env var naming pattern | 81 | core | Every session, at start | `@` import | A18 | Vc | ✅ (2026-10-15) |
| A31 | RULE: schema changes need a new migration | 82 | core | Every session, at start | `@` import | A67 | Vc | ✅ (2026-10-15) |
| A32 | RULE: hand-written TS interfaces | 83–84 | core | Every session, at start | `@` import | dup A68 | Vc | ✅ (2026-10-15) |
| A33 | RULE: `## Instruction Priority` + "If uncertain, stop and ask" (**GATE**) | 85–96 | core | Every session, at start | `@` import | `supabase-exp:47` (S4). Sections now span 3 files → **R2** | Vc, Vq | ✅ (2026-10-15) |
| A34 | `---`, `## Non-negotiable Rules`, `### Always` | 97–102 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A35 | RULE: minimal changes | 103 | core | Every session, at start | `@` import | A89–A96 | Vc | ✅ (2026-10-15) |
| A36 | RULE: plan before changes unless trivial or read-only | 104 | core | Every session, at start | `@` import | B10 | Vc | ✅ (2026-10-15) |
| A37 | RULE: match existing code style | 105 | core | Every session, at start | `@` import | A92 | Vc | ✅ (2026-10-15) |
| A38 | RULE: run type checks after changes | 106 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A39 | RULE: prefer server components | 107 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A40 | RULE: update `AGENTS.md` only when genuinely useful | 108–109 | core | Every session, at start | `@` import | → **R3** | Vc | ✅ (2026-10-15) |
| A41 | `### Never / Red Lines` heading | 110–111 | core | Every session, at start | `@` import | `ezzy-vendor-mobile/AGENTS.md:296-300` (D8) | Vc | ✅ (2026-10-15) |
| A42 | RULE: never cause harm | 112 | core | Every session, at start | `@` import | none | Vc, Vq | ✅ (2026-10-15) |
| A43 | RULE: never handle credentials without approval | 113 | core | Every session, at start | `@` import | B6 (line 29) | Vc | ✅ (2026-10-15) |
| A44 | RULE: no secrets in workspace files | 114 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A45 | RULE: never expose the service-role key | 115 | core | Every session, at start | `@` import | dup A66, A18 | Vc | ✅ (2026-10-15) |
| A46 | RULE: never contact anyone unless authorised | 116 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A47 | RULE: never share PII | 117 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A48 | RULE: never write outside the workspace | 118 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A49 | RULE: never restart, shut down or reload services | 119 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A50 | RULE / **GATE**: no destructive commands without asking | 120 | core | Every session, at start | `@` import | A57 | Vc, Vq | ✅ (2026-10-15) |
| A51 | RULE: never implement custom auth | 121 | core | Every session, at start | `@` import | dup A22 | Vc | ✅ (2026-10-15) |
| A52 | RULE: never close follow-up items | 122–123 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A53 | `### Ask Before / Approval Gates` heading | 124–125 | core | Every session, at start | `@` import | B14 (R9) | Vc, Vr | ✅ (2026-10-15) |
| A54 | **GATE**: new dependencies | 126 | core | Every session, at start | `@` import | A16; `architecture/conventions.md:326` | Vc, Vq | ✅ (2026-10-15) |
| A55 | **GATE**: any schema change | 127 | core | Every session, at start | `@` import | B5 (line 21); `supabase-exp:55-57` (S4); `plan-authoring:120-129` | Vc, Vq | ✅ (2026-10-15) |
| A56 | **GATE**: destructive SQL | 128 | core | Every session, at start | `@` import | none | Vc, Vq | ✅ (2026-10-15) |
| A57 | **GATE**: destructive shell commands | 129 | core | Every session, at start | `@` import | A50, A70 | Vc, Vq | ✅ (2026-10-15) |
| A58 | **GATE**: large rewrites or structural refactoring | 130 | core | Every session, at start | `@` import | none | Vc, Vq | ✅ (2026-10-15) |
| A59 | **GATE**: security-related changes | 131 | core | Every session, at start | `@` import | `vendor/AGENTS.md:83` | Vc, Vq | ✅ (2026-10-15) |
| A60 | **GATE**: changes touching more than one app | 132–133 | core | Every session, at start | `@` import | B3 (line 13); `mobile-dev:29-31` | Vc, Vq | ✅ (2026-10-15) |
| A61 | `### Invariants` heading | 134–135 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A62 | RULE: RLS on every table | 136 | core | Every session, at start | `@` import | dup A26 | Vc | ✅ (2026-10-15) |
| A63 | RULE: explicit table-level `GRANT`s | 137 | core | Every session, at start | `@` import | `supabase-exp` | Vc | ✅ (2026-10-15) |
| A64 | RULE: a `GRANT` only adds | 138 | core | Every session, at start | `@` import | `architecture/schema.md` | Vc | ✅ (2026-10-15) |
| A65 | RULE: no raw SQL outside migrations | 139 | core | Every session, at start | `@` import | A29 | Vc | ✅ (2026-10-15) |
| A66 | RULE: service-role key never client-side | 140 | core | Every session, at start | `@` import | dup A45 | Vc | ✅ (2026-10-15) |
| A67 | RULE: applied migrations never edited | 141 | core | Every session, at start | `@` import | A31; `architecture/schema.md:52` | Vc | ✅ (2026-10-15) |
| A68 | RULE: hand-written types after a schema change | 142–143 | core | Every session, at start | `@` import | dup A32 | Vc | ✅ (2026-10-15) |
| A69 | `### Preferences` heading | 144–145 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A70 | RULE: `trash` over `rm` | 146 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A71 | RULE: Canadian English | 147 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A72 | RULE: update `AGENTS.md` / `architecture/` / `README.md` when useful | 148–149 | core | Every session, at start | `@` import | → **R4** | Vc | ✅ (2026-10-15) |
| A73 | RULE: `---` + `## AGENTS.md Use` preamble | 150–162 | AGENTS | Stays in AGENTS.md | `@AGENTS.md`; Codex native | Must equal `ezzy-vendor-mobile/AGENTS.md:46-55` | Vc (diff) | ✅ (2026-10-15) |
| A74 | `---`, `## Default Working Style` heading | 163–166 | core | Every session, at start | `@` import | heads Component Conventions / Plan in core | Vc | ✅ (2026-10-15) |
| A75 | RULE: `### Session Start` | 167–171 | AGENTS | Stays in AGENTS.md | `@AGENTS.md`; Codex native | → **R5** | Vc | ✅ (2026-10-15) |
| A76 | `### Think Before Coding` + "Do not assume the task is fully understood." | 172–175 | **AGENTS·WF** | Every session, at start (both agents) | `@AGENTS.md`; Codex native | F8 | Vc | ✅ (2026-10-15) |
| A77 | State important assumptions | 176 | AGENTS·WF | Same as A76 | Same as A76 | B7 (F7) | Vc | ✅ (2026-10-15) |
| A78 | Mention multiple interpretations | 177 | AGENTS·WF | Same as A76 | Same as A76 | none | Vc | ✅ (2026-10-15) |
| A79 | **GATE**: unclear request → ask before changing code | 178 | AGENTS·WF | Same as A76. **Now guaranteed for Codex too.** | Same as A76 | A33 | Vc, Vq | ✅ (2026-10-15) |
| A80 | Surface tradeoffs | 179 | AGENTS·WF | Same as A76 | Same as A76 | none | Vc | ✅ (2026-10-15) |
| A81 | Push back when a simpler or safer approach exists | 180 | AGENTS·WF | Same as A76 | Same as A76 | none | Vc | ✅ (2026-10-15) |
| A82 | RULE: read `developerboss` before any task | 181–182 | AGENTS | Stays in AGENTS.md | `@AGENTS.md`; Codex native | Now coding-only → **R6** | Vc | ✅ (2026-10-15) |
| A83 | `### Simplicity First` + intro | 183–186 | dboss | Every session (D2 = A) or on demand (D2 = B) | `@` import, or description match | A35 | Vc | ✅ (2026-10-15) |
| A84 | No unrequested features | 187 | dboss | Same as A83 | Same as A83 | none | Vc | ✅ (2026-10-15) |
| A85 | No single-use abstractions | 188 | dboss | Same as A83 | Same as A83 | `plan-authoring:65-69` | Vc | ✅ (2026-10-15) |
| A86 | No speculative flexibility | 189 | dboss | Same as A83 | Same as A83 | none | Vc | ✅ (2026-10-15) |
| A87 | No speculative error handling | 190 | dboss | Same as A83 | Same as A83 | none | Vc | ✅ (2026-10-15) |
| A88 | Reconsider if a change grows | 191–192 | dboss | Same as A83 | Same as A83 | B10 | Vc | ✅ (2026-10-15) |
| A89 | `### Surgical Changes` + intro | 193–196 | dboss | Same as A83 | Same as A83 | A35 | Vc | ✅ (2026-10-15) |
| A90 | Don't refactor unrelated code | 197 | dboss | Same as A83 | Same as A83 | none | Vc | ✅ (2026-10-15) |
| A91 | Don't clean up adjacent code | 198 | dboss | Same as A83 | Same as A83 | none | Vc | ✅ (2026-10-15) |
| A92 | Match existing project style | 199 | dboss | Same as A83 | Same as A83 | A37 | Vc | ✅ (2026-10-15) |
| A93 | Mention unrelated problems; don't fix them silently | 200 | dboss | Same as A83 | Same as A83 | none | Vc | ✅ (2026-10-15) |
| A94 | Remove only what was made obsolete | 201 | dboss | Same as A83 | Same as A83 | none | Vc | ✅ (2026-10-15) |
| A95 | Focused changes only in required files | 202–203 | dboss | Same as A83 | Same as A83 | none | Vc | ✅ (2026-10-15) |
| A96 | "Every changed line should be explainable …" | 204–205 | dboss | Same as A83 | Same as A83 | none | Vc | ✅ (2026-10-15) |
| A97 | `### Component Conventions` heading | 206–207 | core | Every session, at start | `@` import | `booker/AGENTS.md:59`, `vendor/AGENTS.md:60` | Vc | ✅ (2026-10-15) |
| A98 | RULE: before a new component, read `component-separation` | 208–209 | core | Every session, at start | `@` import | B9; `plan-authoring:224` | Vc | ✅ (2026-10-15) |
| A99 | RULE: before a visual change, read `ux-design` | 210–211 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| A100 | RULE: companion `useComponentName.ts` | 212 | core | Every session, at start | `@` import | `component-separation:35-39` | Vc | ✅ (2026-10-15) |
| A101 | RULE: `.tsx` is a pure render layer | 213 | core | Every session, at start | `@` import | `component-separation:22-33`; B9 | Vc | ✅ (2026-10-15) |
| A102 | RULE: `.module.css` styling — **wording frozen** | 214 | core | Every session, at start | `@` import | quoted at `ezzy-vendor-mobile/AGENTS.md:147-148` | Vc | ✅ (2026-10-15) |
| A103 | RULE: pure display components are the only exception | 215 | core | Every session, at start | `@` import | `component-separation:60-64` | Vc | ✅ (2026-10-15) |
| A104 | RULE: plans call out the separation per component | 216–217 | core | Every session, at start | `@` import | `plan-authoring:224-227` | Vc | ✅ (2026-10-15) |
| A105 | `.module.css` is web-only; Expo apps override it | 218–219 | core | Every session, at start | `@` import | `ezzy-vendor-mobile/AGENTS.md:139-161` | Vc | ✅ (2026-10-15) |
| A106 | RULE: `### Plan`: read `plan-authoring`, write under `.plans/`, status model | 220–223 | core | Every session, at start | `@` import | `plan-authoring:9` (S4) | Vc, Vr | ✅ (2026-10-15) |
| A107 | RULE: plan filenames start with the date | 224 | core | Every session, at start | `@` import | `plan-authoring:9` | Vc | ✅ (2026-10-15) |
| A108 | Nine-step flow lives in `plan-authoring` | 225–227 | core | Every session, at start | `@` import | `plan-authoring:210-234` | Vc, Vr | ✅ (2026-10-15) |
| A109 | RULE: execution cadence is one stage at a time by default | 228–230 | **Remove** (D10, approved) | Nowhere. The full text arrives in AGENTS·WF via B13–B14. | n/a | dup of B13–B14; `plan-authoring:245-247` | Vc (checks B13) | ✅ removed (2026-10-15) |
| A110 | `### Goal-Driven Execution` + "Convert the task into verifiable outcomes." | 231–234 | AGENTS·WF | Same as A76 | Same as A76 | none | Vc | ✅ (2026-10-15) |
| A111 | Define success before broad changes | 235 | AGENTS·WF | Same as A76 | Same as A76 | none | Vc | ✅ (2026-10-15) |
| A112 | Bugs: failing reproduction first | 236 | dboss (under a new "Goal-Driven Execution — coding" heading) | Same as A83 | Same as A83 | none | Vc | ✅ (2026-10-15) |
| A113 | Behaviour changes: add or update tests | 237 | dboss | Same as A83 | Same as A83 | none | Vc | ✅ (2026-10-15) |
| A114 | Refactors: verify before and after | 238 | dboss | Same as A83 | Same as A83 | none | Vc | ✅ (2026-10-15) |
| A115 | Multi-step: short plan with a check per step | 239 | AGENTS·WF | Same as A76 | Same as A76 | `plan-authoring:145-150` | Vc | ✅ (2026-10-15) |
| A116 | Continue until verified, or explain the blocker | 240–241 | AGENTS·WF | Same as A76 | Same as A76 | B16 | Vc | ✅ (2026-10-15) |
| A117 | `### Completion Standard` + "Before saying work is complete:" | 242–245 | AGENTS·WF | Same as A76 | Same as A76 | B16, B17 | Vc | ✅ (2026-10-15) |
| A118 | Summarize what changed | 246 | AGENTS·WF | Same as A76 | Same as A76 | B16 (line 102) | Vc | ✅ (2026-10-15) |
| A119 | List verification performed | 247 | AGENTS·WF | Same as A76 | Same as A76 | B16 (lines 104-107) | Vc | ✅ (2026-10-15) |
| A120 | List verification not run | 248 | AGENTS·WF | Same as A76 | Same as A76 | B17 | Vc | ✅ (2026-10-15) |
| A121 | Mention risks, assumptions, follow-ups | 249–250 | AGENTS·WF | Same as A76 | Same as A76 | none | Vc | ✅ (2026-10-15) |
| A122 | `---`, `## Prompt Writing`: read `prompt-writing` | 251–257 | core | Every session, at start | `@` import | none | Vc | ✅ (2026-10-15) |
| U1 | Literal `...` | 258 | **Remove** (D10, approved) | Nowhere | n/a | F5 | n/a | ✅ removed (2026-10-15) |

## 6b. Migration checklist: current `developerboss/SKILL.md` items (r2)

| ID | Content | Source `developerboss/SKILL.md` lines | Destination | Trigger | Mechanism | Overlap / refs | Verification | Status |
|---|---|---|---|---|---|---|---|---|
| B1 | Frontmatter: `name`, `description` | 1–5 | dboss | Description always listed | Skill listing | Description rewritten → **R7** | Vc | ✅ (2026-10-15) |
| B2 | `# Engineering Start` + "Before responding to any task, work through the following. Do not skip steps even for tasks that seem small." | 6–9 | AGENTS·WF (as the "Pre-flight" intro) | Every session, at start (both agents) | `@AGENTS.md`; Codex native | dboss gets a new coding intro → **R10** | Vc | ✅ (2026-10-15) |
| B3 | §1 Understand the scope: one-sentence ask; what is NOT asked; RULE/**GATE** "Does this touch more than one app? … flag before proceeding — cross-app changes require approval." | 10–14 | AGENTS·WF | Same as B2 | Same as B2 | A60; `mobile-dev:29` "Scope." delta → **R14** | Vc, Vq | ✅ (2026-10-15) |
| B4 | §2 Locate before building | 15–19 | dboss | Every session (D2 = A) or on demand | `@` import, or description match | `mobile-dev:33` | Vc | ✅ (2026-10-15) |
| B5 | §3 Check the data layer; **GATE** "schema change? stop and get approval" | 20–24 | dboss | Same as B4. **The gate is always on via A55.** | Same as B4 | A55; `mobile-dev:39` | Vc | ✅ (2026-10-15) |
| B6 | §4 Identify the risk surface | 25–30 | dboss | Same as B4 | Same as B4 | A43; `mobile-dev:45` | Vc | ✅ (2026-10-15) |
| B7 | §5 State assumptions | 31–34 | AGENTS·WF | Same as B2 | Same as B2 | A77 (F7) | Vc | ✅ (2026-10-15) |
| B8 | §6 Apply SOLID principles | 35–41 | dboss | Same as B4 | Same as B4 | `mobile-dev:51` | Vc | ✅ (2026-10-15) |
| B9 | §7 Separate styles from the rendering component | 42–46 | dboss | Same as B4 | Same as B4 | A98–A105; `mobile-dev:56` | Vc | ✅ (2026-10-15) |
| B10 | §8 Size the change (larger than it looked? plan file needed?) | 47–50 | AGENTS·WF | Same as B2 | Same as B2 | A36, A88 | Vc | ✅ (2026-10-15) |
| B11 | "Only after completing the above: write code." | 51–52 | dboss | Same as B4 | Same as B4 | none | Vc | ✅ (2026-10-15) |
| B12 | `---`, `# Execution Cadence`, intro ("Applies whenever the work is driven by a plan file … Sections 1–8 above still run first.") | 53–60 | AGENTS·WF | Same as B2 | Same as B2 | → **R8** | Vc, Vr | ✅ (2026-10-15) |
| B13 | RULE: `## Default: one stage at a time` + definition of "stage" | 61–70 | AGENTS·WF | Same as B2 | Same as B2 | A109; `plan-authoring:245-247` (R13) | Vc, Vq | ✅ (2026-10-15) |
| B14 | `## Overrides — the user's word wins` table + "Two things an override never buys" (**GATE**: "does not waive the approval gates"; does not push through a blocker) | 71–91 | AGENTS·WF | Same as B2 | Same as B2 | "listed under AGENTS.md \"Ask Before\"" → **R9** | Vc, Vq | ✅ (2026-10-15) |
| B15 | History note (2026-07-30) about the old AGENTS.md Plan bullet | 92–97 | **Remove** (D15 = A, approved) | n/a | n/a | Historical; preserved in git history | Vc (if kept) | ✅ removed (2026-10-15) |
| B16 | RULE: `## Always report after execution`: Summary / Checklist / Plan status, plans-index re-run, findings go into the plan | 98–120 | AGENTS·WF | Same as B2 | Same as B2 | A117–A121; `big-table` skill | Vc, Vq | ✅ (2026-10-15) |
| B17 | `## On completion of the whole plan` | 121–126 | AGENTS·WF | Same as B2 | Same as B2 | A120 | Vc | ✅ (2026-10-15) |

---

## 7. Coverage check

**Root `AGENTS.md`:** 123 contiguous ranges cover lines 1–258 with no gaps or overlaps. The ranges are:

1–2, 3–16, 17–18, 19–20, 21, 22, 23–24, 25–28, 29–44, 45–54, 55–56, 57–58, 59 … 64, 65–66, 67–68, 69–70, 71 … 74, 75–76, 77–78, 79 … 82, 83–84, 85–96, 97–102, 103 … 107, 108–109, 110–111, 112 … 121, 122–123, 124–125, 126 … 131, 132–133, 134–135, 136 … 141, 142–143, 144–145, 146, 147, 148–149, 150–162, 163–166, 167–171, 172–175, 176 … 180, 181–182, 183–186, 187 … 190, 191–192, 193–196, 197 … 201, 202–203, 204–205, 206–207, 208–209, 210–211, 212 … 215, 216–217, 218–219, 220–223, 224, 225–227, 228–230, 231–234, 235 … 239, 240–241, 242–245, 246 … 248, 249–250, 251–257, 258.

**`developerboss`:** 17 ranges cover lines 1–126: 1–5, 6–9, 10–14, 15–19, 20–24, 25–30, 31–34, 35–41, 42–46, 47–50, 51–52, 53–60, 61–70, 71–91, 92–97, 98–120, 121–126.

| Destination | From `AGENTS.md` | From `developerboss` | Total |
|---|---|---|---|
| core (always) | A2–A11, A20–A72, A74, A97–A108, A122 = **77** | none | 77 |
| AGENTS: stays, plus Working Flow (always, both agents) | A1, A73, A75, A82 + A76–A81, A110, A111, A115–A121 = **19** | B2, B3, B7, B10, B12, B13, B14, B16, B17 = **9** | 28 |
| dboss, coding only (always if D2 = A) | A83–A96, A112–A114 = **17** | B1, B4, B5, B6, B8, B9, B11 = **7** | 24 |
| mobile (path-scoped) | A12–A19 = **8** | none | 8 |
| Remove | A109, U1 = **2** (approved) | B15 = **1** (D15, approved) | 3 |
| **Total** | **123** | **17** | 140 |

**Every gate and where it ends up:**

| Gate | Source | Destination | Always on after? | Wording |
|---|---|---|---|---|
| "If uncertain, stop and ask" (A33) | AGENTS 95 | core | Yes | Unchanged (R2 adds locations to the list) |
| No destructive commands without asking (A50) | AGENTS 120 | core | Yes | Unchanged |
| New dependencies (A54) | AGENTS 126 | core | Yes | Unchanged |
| Schema change (A55) | AGENTS 127 | core | Yes | Unchanged |
| Destructive SQL (A56) | AGENTS 128 | core | Yes | Unchanged |
| Destructive shell (A57) | AGENTS 129 | core | Yes | Unchanged |
| Large rewrites (A58) | AGENTS 130 | core | Yes | Unchanged |
| Security change (A59) | AGENTS 131 | core | Yes | Unchanged |
| More than one app (A60) | AGENTS 132 | core | Yes | Unchanged |
| Mobile dependency install (A16) | AGENTS 62 | mobile | Path-scoped; always on via A54 | Unchanged |
| Ask before changing code if unclear (A79) | AGENTS 178 | AGENTS·WF | Yes. **Stronger: now guaranteed for Codex** | Unchanged |
| Cross-app flag (B3) | dboss 13 | AGENTS·WF | Yes. **Stronger: was on demand** | Unchanged |
| Schema → stop and get approval (B5) | dboss 21 | dboss | If D2 = A; always on via A55 regardless | Unchanged |
| Override never waives approval gates (B14) | dboss 83-87 | AGENTS·WF | Yes. **Stronger: was on demand** | R9 changes only the location pointer |

All Never / Red Lines (A42–A52) and Invariants (A62–A68) go to core with their wording unchanged.

---

## 8. Target layout

```
AGENTS.md                                   (~165 lines, ~8 KB: pointer + AGENTS.md Use + Session Start + Working Flow)
CLAUDE.md                                   (+2 import lines)
.claude/
  rules/mobile-stack.md                     (new: path-scoped, A12–A19)
  skills/
    core-rules/SKILL.md                     (new: 77 items, ~11.5 KB)
    developerboss/SKILL.md                  (coding only, ~65 lines, ~3.8 KB)
    plan-authoring/SKILL.md                 (ref fixes: lines 9, 70-74, 245-247)
    supabase-exp/SKILL.md                   (ref fixes: lines 10-11, 47, 57, 202)
    mobile-dev/SKILL.md                     (ref fix: lines 26-27)
.codex/skills/{developerboss,plan-authoring,supabase-exp,mobile-dev}/SKILL.md   (byte-identical mirrors, D7)
.git/agent-config-backup/2026-10-15/        (backups; never tracked)
```

**Always-loaded context:** today about 15.8 KB, plus `developerboss` (6.9 KB) whenever A82 is obeyed. After the change: about 23.3 KB with D2 = A, or about 19.5 KB with D2 = B.

### Proposed full text of `AGENTS.md`

Provenance of each block:
- **Verbatim:** A1, A73, B2-text, B3, B7, B10, B13, B14, B16, B17, A76–A81, A110, A111, A115–A121.
- **Reworded:** A75 per R5, A82 per R6, B12 per R8, B14 line 85 per R9.
- **Formatting only (R11):** heading levels change and the pre-flight steps lose their numbers.
- **New text, approved under D8/D12 in r1:** the intro, "Read first", the alias sentence and "Skills".
- **New text, for approval under D14:** the "Working Flow" intro line.

```markdown
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
[developerboss lines 63–69, verbatim]

#### Overrides — the user's word wins
[developerboss lines 73–90, verbatim, except line 85 per R9:
 "new dependency, or anything else listed under \"Ask Before\" in
 `.claude/skills/core-rules/SKILL.md` still stops"]

#### Always report after execution
[developerboss lines 100–119, verbatim]

#### On completion of the whole plan
[developerboss lines 123–126, verbatim]
```

The bracketed blocks are copied word for word in S5. They are shown by line reference here only to keep the plan readable. The source text is in `developerboss/SKILL.md` and the S0 backup.

### Proposed `CLAUDE.md`

```markdown
# CLAUDE.md
@AGENTS.md
@.claude/skills/core-rules/SKILL.md
@.claude/skills/developerboss/SKILL.md
```

The last line is present only if D2 = A.

### `core-rules/SKILL.md` layout

The frontmatter `name` is `core-rules`. The description: "Always-on project rules for this workspace — workspace layout, shared tech stack and Supabase invariants, instruction priority, non-negotiable rules, red lines, approval gates, preferences, component conventions, and when to read the plan-authoring and prompt-writing skills. Loaded every session via CLAUDE.md; invoke it to re-read the rules mid-session."

The body has a new `# Core rules` H1 and then these items, in their original order and wording except for approved R1–R4:
- A2–A11
- a new one-line pointer to `.claude/rules/mobile-stack.md`
- A20–A72, A74, A97–A108, A122

### `developerboss/SKILL.md` after the split

```markdown
---
name: developerboss
description: [R7]
---

# Engineering Start

[R10] Before writing code, work through the following, after the general pre-flight in
`AGENTS.md` → "Working Flow". Do not skip steps even for tasks that seem small.

## 1. Locate before building            [B4; was §2]
## 2. Check the data layer              [B5; was §3]
## 3. Identify the risk surface         [B6; was §4]
## 4. Apply SOLID principles            [B8; was §6]
## 5. Separate styles from the rendering component   [B9; was §7]

Only after completing the above: write code.   [B11]

---

# Default Working Style — coding      [new heading]

### Simplicity First                   [A83–A88 verbatim]
### Surgical Changes                   [A89–A96 verbatim]
### Goal-Driven Execution — coding     [new heading; A112–A114 verbatim]
```

`mobile-dev` matches its deltas by step **name** ("**Scope.**", "**Locate before building.**", …), not number, so the renumbering doesn't break it. R14 tells it that "Scope" now lives in `AGENTS.md`.

### `mobile-stack.md`

The frontmatter sets `paths:` to `"ezzy-booker-mobile/**"` and `"ezzy-vendor-mobile/**"`. The body is A12–A19 verbatim.

### Rewordings: originals kept alongside

R1–R5 were approved in r1 (D12). R6–R14 were approved in r2 (2026-10-15).

| R | Item | Original | Proposed |
|---|---|---|---|
| R1 | A5 | "(see AGENTS.md Use)" | "(see the AGENTS.md Use section in `AGENTS.md`)" |
| R2 | A33 | "1. Non-Negotiable Rules / 2. AGENTS.md Use / 3. Default Working Style" | "1. Non-Negotiable Rules (this file) / 2. AGENTS.md Use (`AGENTS.md`) / 3. Default Working Style (this file, `AGENTS.md` → Working Flow, and `.claude/skills/developerboss/SKILL.md`)". *r2 adds "`AGENTS.md` → Working Flow".* |
| R3 | A40 | "Update `AGENTS.md` only when …" | "Update `AGENTS.md` or this core-rules file only when …" |
| R4 | A72 | "Update `AGENTS.md` (root or nested), the relevant `architecture/` document, …" | "Update `AGENTS.md` (root or nested), the core-rules file, the relevant `architecture/` document, …" |
| R5 | A75 | "…includes this `AGENTS.md`, plus the nested `AGENTS.md` …" | "…includes this `AGENTS.md`, the files under \"Read first\" above, plus the nested `AGENTS.md` …" |
| R6 | A82 | "Before responding to any task, read and apply `.claude/skills/developerboss/SKILL.md` — pre-flight checklist for scope, locating existing patterns, data-layer implications, and risk surface." | "Before any coding task, read and apply `.claude/skills/developerboss/SKILL.md` — coding pre-flight checklist for locating existing patterns, data-layer implications, risk surface, SOLID and style separation." |
| R7 | B1 description | (current: "Use before responding to any coding task … Also defines the execution cadence … reported after every stage.") | "Use before any coding task, however small — the coding pre-flight checklist (locate existing patterns before building, data-layer implications, risk surface, SOLID adherence, render/style separation) plus the coding working style (simplicity first, surgical changes, test-backed execution). The general pre-flight, execution cadence and stage reporting live in AGENTS.md → Working Flow." |
| R8 | B12 line 59 | "Sections 1–8 above still run first." | "The pre-flight above — and, for coding work, `.claude/skills/developerboss/SKILL.md` — still runs first." |
| R9 | B14 line 85 | "listed under AGENTS.md \"Ask Before\"" | "listed under \"Ask Before\" in `.claude/skills/core-rules/SKILL.md`" |
| R10 | new dboss intro | (was B2: "Before responding to any task, work through the following. Do not skip steps even for tasks that seem small.") | "Before writing code, work through the following, after the general pre-flight in `AGENTS.md` → \"Working Flow\". Do not skip steps even for tasks that seem small." |
| R11 | headings | `# Engineering Start` / `## 1.`–`## 8.` / `# Execution Cadence` / `## Default…` | In AGENTS: `### Pre-flight` / `#### Understand the scope` etc. / `### Execution Cadence` / `#### Default…`. In dboss: renumbered §1–§5, plus the two new headings shown above. Formatting only. |
| R12 | `plan-authoring:70-74` | "run its proposed approach through `.claude/skills/developerboss/SKILL.md`'s judgment checks — scope, locate existing patterns before inventing new ones, data-layer implications, risk surface, SOLID, simplicity-first —" | "run its proposed approach through the pre-flight in `AGENTS.md` → \"Working Flow\" (scope, assumptions, sizing) and `.claude/skills/developerboss/SKILL.md`'s coding checks — locate existing patterns before inventing new ones, data-layer implications, risk surface, SOLID, simplicity-first —" |
| R13 | `plan-authoring:245-247` | "see `.claude/skills/developerboss/SKILL.md`." | "see `AGENTS.md` → \"Working Flow\" → Execution Cadence." |
| R14 | `mobile-dev:26-27` | "`.claude/skills/developerboss/SKILL.md` is the full pre-flight checklist and still applies in full. Work it through, then add these mobile-specific deltas at the matching step:" | "The general pre-flight in `AGENTS.md` → \"Working Flow\" and the coding pre-flight in `.claude/skills/developerboss/SKILL.md` still apply in full. Work them through, then add these mobile-specific deltas at the matching step:" |

### Expected changed paths

| Action | Path | Condition |
|---|---|---|
| Create | `.claude/skills/core-rules/SKILL.md` | always |
| Create | `.claude/rules/mobile-stack.md` | always (D5 = A) |
| Modify | `AGENTS.md` | always (S5) |
| Modify | `CLAUDE.md` | always (D1 = A) |
| Modify | `.claude/skills/developerboss/SKILL.md` | always (S2 additive, then S5 split) |
| Modify | `.claude/skills/plan-authoring/SKILL.md` | always (S4, S5) |
| Modify | `.claude/skills/supabase-exp/SKILL.md` | always (S4) |
| Modify | `.claude/skills/mobile-dev/SKILL.md` | always (S5; **new in r2**) |
| Modify | `.codex/skills/{developerboss,plan-authoring,supabase-exp,mobile-dev}/SKILL.md` | always (D7 = A; `mobile-dev` new in r2) |
| Create | `.git/agent-config-backup/2026-10-15/**` + `.git/agent-config-backup/2026-10-15.SHA256SUMS` | always (D9 = A); invisible to `git status` |
| Modify | `.plans/2026-10-15-split-agents-md-into-skills.md` (this plan) | status upkeep |
| Delete | none | n/a |

---

## 9. Decisions

<!-- No stage may execute while any OPEN: line below remains. -->

Resolved 2026-10-15 (r1, all recommendations accepted). Restated with r2 effects:
- **D1** → **A**: `@` imports in `CLAUDE.md`.
- **D3** → **A**: Codex reads the core rules by path. *r2 effect:* Working Flow sits in `AGENTS.md` itself, so it is guaranteed for Codex.
- **D4** → none (no every-prompt hook).
- **D5** → **A**: `.claude/rules/mobile-stack.md`.
- **D6** → `core-rules`, default frontmatter.
- **D7** → **A**: mirror skill edits to `.codex`, with no `core-rules` copy. *r2 effect:* `mobile-dev` joins the mirrored set under the same policy.
- **D8** → yes: alias sentence. *r2 wording:* "this file together with the files above".
- **D9** → **A**: `.git/agent-config-backup/2026-10-15/`.
- **D10** → remove A109 and U1. A109's content now arrives in AGENTS·WF through B13–B14, so the removal stays safe under either D2 option.
- **D11** → `.claude/settings.local.json`. Moot, because no hook is created.
- **D12** → R1–R5 approved as written.
- **D13** → tracked destinations accepted; `.agents/skills` is not touched.

Resolved by your instruction (r2, 2026-10-15):
- **D14** → **split `developerboss`**. Non-coding workflow goes to `AGENTS.md` → "Working Flow" (B2, B3, B7, B10, B12–B14, B16, B17; A76–A81, A110, A111, A115–A121). `developerboss` keeps coding only.
  - Trade-off accepted by that instruction: `AGENTS.md` ends up about 165 lines and 8 KB, not about 45 lines. In return, the workflow is guaranteed for Codex as well as Claude.
  - The alternative of putting Working Flow in `core-rules` would keep `AGENTS.md` minimal, but would leave Codex relying on a pointer.
  - **Still to confirm:** rewordings R6–R14 and the new "Working Flow" intro line.

Resolved 2026-10-15 (r2, all recommendations accepted):
- **D2** → **A**: the coding-only `developerboss` is still imported every session through `CLAUDE.md`.
- **D15** → **A**: remove B15 (the 2026-07-30 history note). Git history keeps it.
- **D14 confirmation** → R6–R14 and the "Working Flow" intro line approved as written.

No decisions remain open. Execution still needs your explicit approval.

---

## 10. Approval gates

| Change | Exact change | Undo |
|---|---|---|
| Rewrite `AGENTS.md` (S5) — **a file Codex and the other session rely on** | Replace the 258 lines with the §8 text | `cp .git/agent-config-backup/2026-10-15/AGENTS.md AGENTS.md` |
| Split `developerboss` (S5) | Remove B2, B3, B7, B10, B12–B17; apply R7, R10, R11 | Restore from backup |
| `CLAUDE.md` | Add 1–2 import lines | Restore from backup |
| Edits to other tracked skills and `.codex` mirrors | §5 reference fixes (R12–R14 and the S4 fixes) | Restore from backup |
| Removals | A109, U1, B15 (all approved) | Re-add from backup |

---

## 11. Execution stages

The rules stay loaded at every point. Everything is created and wired **additively** while the full `AGENTS.md` and `developerboss` are still in place. The content that moves *out of* `developerboss` into `AGENTS.md` moves in a single stage (S5), so it is never absent from both.

Before each stage:
- re-check `git status --porcelain` and the §3 checksums of that stage's files; if anything changed, stop and ask;
- report afterwards which paths actually changed.

- [x] **S0 — Backup + baseline re-check.** ✅ DONE (2026-10-15)
  - **Executed:** before copying, `git status --porcelain` matched §3 plus this plan, and all 11 checksums matched the §3 table. Then the 11 files were copied to `.git/agent-config-backup/2026-10-15/` (`cp -a --parents`) and their checksums written to `.git/agent-config-backup/2026-10-15.SHA256SUMS`.
  - **Verified (machine):** `sha256sum -c` passes against the originals (11/11 OK) and against the copies (11/11 OK); 11 files are in the backup.
  - **Secrets check FAILED: F9.** The backed-up `.claude/settings.local.json` has a database password inline in a permission allowlist entry at line 85 (`Bash(PGPASSWORD=… psql *)`). The value was not printed. The original file is gitignored and the credential was already there; this plan does not touch it. Because of it, the backup now holds a credential, which breaks the "no credentials in backups" constraint.
    - ✅ **F9 resolved (2026-10-15, with your approval):** the backup copy was removed with `rm` (not `trash`) and its line was deleted from `SHA256SUMS`.
      - **Verified:** the backup now holds 10 files with 10 checksum lines. `sha256sum -c` gives 10/10 OK against both the copies and the originals. A secret-pattern scan of the whole `.git/agent-config-backup/` finds 0 matches.
      - The original `.claude/settings.local.json` is unchanged (sha `949d12f179377641`).
      - **Still for you:** consider rotating that password and moving it out of the permission entry. This plan does not touch it.
  - **Scope:** `git status` still shows 13 lines (12 baseline + this plan). No instruction or skill path changed.
  - **Note:** the first copy attempt failed (zsh does not word-split `$F`) after creating only the empty backup directory. It was retried with an array, and nothing else was written.
  - Copy the 10 files from the §3 checksum table (`AGENTS.md`, `CLAUDE.md`, the four skills, their four `.codex` copies) to `.git/agent-config-backup/2026-10-15/`, keeping relative paths. `.claude/settings.local.json` was also copied, then removed (F9).
  - Write checksums to `.git/agent-config-backup/2026-10-15.SHA256SUMS`, outside the copied tree.
  - Verify with `sha256sum -c` from the workspace root.
- [x] **S1 — Create `core-rules/SKILL.md` and `.claude/rules/mobile-stack.md`.** ✅ DONE (2026-10-15)
  - **Executed:** a scratchpad script built both files from the S0 backup of `AGENTS.md`, copying lines exactly.
    - `core-rules/SKILL.md` (179 lines, 12.0 KB): frontmatter + `# Core rules` + A2–A11, the new mobile pointer line, A20–A72, A74, A97–A108, one added blank line (so `---` after A108 is not read as a heading), and A122. R1–R4 applied.
    - `mobile-stack.md` (15 lines, 1.2 KB): `paths:` frontmatter + A12–A19.
  - **Verified (machine):**
    - The coverage script confirms both files tile exactly (AGENTS.md 123 items over 1–258; developerboss 17 items over 1–126).
    - 85/85 core and mobile items are present (exact text, or the approved R1–R4 wording). All 10 gates in scope are OK: A16, A33, A50, A54–A60.
    - No text line directly above a `---` (so no accidental headings).
    - The 10 pre-existing target files still match their S0 checksums.
  - **Scope:** the only new paths in `git status` are `.claude/rules/` and `.claude/skills/core-rules/`.
  - **Notes:**
    - Claude Code listed `core-rules` as an available skill straight away. Nothing imports it yet (that is S3), so it is not always-on yet.
    - Two forward references resolve later: the description's "Loaded every session via CLAUDE.md" (true after S3) and R2's "`AGENTS.md` → Working Flow" (exists after S5).
    - Scripts: `scratchpad/s1_build.py` and `scratchpad/coverage.py` (session scratchpad, not the repo).
  - Verify: the coverage script (in the scratchpad, not the repo) confirms the core and mobile items.
- [x] **S2 — Additive `developerboss` change.** ✅ DONE (2026-10-15)
  - **Executed:** inserted after line 52 of `developerboss/SKILL.md`, copied exactly from the `AGENTS.md` backup:
    - `---`
    - `# Default Working Style — coding`
    - A83–A96 (Simplicity First, Surgical Changes)
    - `### Goal-Driven Execution — coding` + A112–A114

    126 → 159 lines. The `.codex` copy was then replaced with a byte copy.
  - **Verified (machine):**
    - `diff` against the backup shows a pure insertion (33 lines added, 0 removed).
    - `cmp` of the `.claude` and `.codex` copies matches.
    - Coverage of the dboss, core and mobile items: 109/109 OK. The B5 gate is still present.
    - No accidental headings.
  - **Scope:** the only new changes are the two `developerboss` files (` M`).
  - **Notes:**
    - The description (R7) and the removal of non-coding parts happen in S5, as planned.
    - Until S5, the skill holds both the coding section and the old execution-cadence content.
  - Append "Default Working Style — coding" (A83–A96, A112–A114). Nothing is removed yet. Mirror to `.codex`.
  - Verify: coverage for those items; `cmp` of the two copies.
- [x] **S3 — Wire the loader.** ✅ DONE (2026-10-15)
  - **Done (machine):** checked that `CLAUDE.md` was unchanged (sha `4be085e5b886a6a6`), then appended `@.claude/skills/core-rules/SKILL.md` and `@.claude/skills/developerboss/SKILL.md`. All three import targets exist (`test -f`). Scope: `M CLAUDE.md` is the only new change.
  - **Pending (yours):** the manual fresh-session checks below. S3 is marked ✅ only when you report that they pass.
    - Use a **new** `claude` session. All four checks run in that one session.
    - A resumed session is not a valid test: whether resume reloads `CLAUDE.md` is undocumented. Sessions that are already open pick up the imports only after `/compact` (confirm with `/context`).
  - **Check 1 (loaded at start): ✅ PASS (2026-10-15, user-run fresh session).**
    - `/memory` shows `./CLAUDE.md` with three `@`-imports below it: `AGENTS.md`, `.claude/skills/core-rules/SKILL.md` and `.claude/skills/developerboss/SKILL.md`.
    - `/context all` Memory files: `CLAUDE.md` 66 tokens, `AGENTS.md` 5.6k, `core-rules` 4.2k, `developerboss` 2.5k, `MEMORY.md` 909, for a total of 13.3k.
  - **Mobile path rule check: ✅ PASS (2026-10-15, user-run, same fresh session).**
    - After the session read files in `ezzy-vendor-mobile/` (and `booker/`), it listed `.claude/rules/mobile-stack.md` in context, plus the nested `ezzy-vendor-mobile/CLAUDE.md` + `AGENTS.md` and `booker/CLAUDE.md` + `AGENTS.md`.
    - Evidence is the session's own listing of files in context. `/context` lists launch-time memory only, so files loaded mid-session do not appear there.
    - **Not isolated:** the first read covered both apps in one command, so "the rule does not load for a `booker/` file" was not shown separately. It is re-tested in S6 with a fresh session that reads only `booker/`.
  - **Post-`/compact` check:** deferred to S6. Until S5 the old `AGENTS.md` still holds every rule, so a compaction quote test cannot tell the sources apart. Add the import lines to `CLAUDE.md` (developerboss only if D2 = A).
  - **Manual:** in a fresh session, `/context` lists the imported files; the quote test passes; after `/compact` the quote test still passes; `cat` of a file under `ezzy-vendor-mobile/src/` shows "Loaded" for `mobile-stack.md`.
- [x] **S4 — Reference fixes not tied to the split:** ✅ DONE (2026-10-15; run in parallel with S3's manual checks, at your request)
  - **Executed:** before editing, the four files matched their S0 checksums. Then the 5 replacements were applied, each matched exactly once:
    - `plan-authoring:9`
    - `supabase-exp:10-11`, `:47`, `:57`, `:202`

    Line wrapping was adjusted where the new text is longer (`plan-authoring` +1 line, `supabase-exp` +1 line). Both files were then byte-copied to `.codex`.
  - **Verified (machine):**
    - `diff` against the backups shows only the 5 planned hunks.
    - `cmp` of `.claude` vs `.codex` matches for both files.
    - `grep "AGENTS"` across all skills leaves only `developerboss:118` ("listed under AGENTS.md \"Ask Before\"") and `:125` (the history note). Both are handled in S5 (R9, D15).
    - The new targets resolve: `core-rules/SKILL.md` exists and has a `### Ask Before / Approval Gates` heading.
  - **Scope:** the only new changes are ` M` on `plan-authoring` and `supabase-exp` (`.claude` and `.codex`). `plan-authoring:9` and `supabase-exp:10-11,47,57,202`, plus their `.codex` mirrors.
  - Verify: grep for the old phrases returns nothing.
- [x] **S5 — The move.** ✅ DONE (2026-10-15; you confirmed the other session can tolerate it: "proceed with S5")
  - **Pre-check:**
    - `AGENTS.md` and `mobile-dev` matched their S0 checksums.
    - `developerboss` = backup + the S2 insertion only; `plan-authoring` = backup + the S4 hunk only.
    - All `.codex` copies were identical to their `.claude` versions.
  - **Executed** (`scratchpad/s5_build.py`, all moved text taken from the S0 backups):
    - (a) `AGENTS.md` rewritten: 258 → 168 lines, 15.8 → 8.0 KB, laid out as in §8, with R5, R6, R8, R9 and R11 applied.
    - (b) `developerboss` cut to coding only: 159 → 71 lines, 3.6 KB. R7 and R10 applied, sections renumbered §1–§5, B15 history note removed (D15). The script checked that the coding section is byte-identical to what S2 inserted.
    - (c) R12 and R13 applied in `plan-authoring`; R14 applied in `mobile-dev`.
    - (d) `developerboss`, `plan-authoring` and `mobile-dev` byte-copied to `.codex`.
  - **Verified (machine):**
    - Coverage from the backups: 137/137 items present (140 minus the 3 approved removals). All 14 gates OK.
    - A109, U1 and B15 are absent.
    - The A73 preamble is identical to `ezzy-vendor-mobile/AGENTS.md`.
    - Every Working Flow anchor that other files reference exists (`## Working Flow`, `### Execution Cadence`).
    - No stale phrases remain ("Sections 1–8", "per `AGENTS.md`", "AGENTS.md \"Ask Before\"", "full pre-flight checklist").
    - All 9 `.claude`/`.codex` skill pairs are identical.
    - No accidental headings (the only flag is the frontmatter closer in `mobile-dev:12`, which is pre-existing and correct).
    - Path check: the only unresolved names are pre-existing, app-relative or generic (`package.json`, `tsconfig.json`, `src/app/`, `node_modules/`, `README.md`, `AGENTS.override.md`, the migration filename template).
  - **Scope:** `git status` shows 25 lines = 13 (baseline + plan) + the 12 expected instruction paths. No other path changed.
  - **Handoff line for open sessions:** *"`AGENTS.md` and `developerboss` were reorganised; run `/compact` (Claude) or re-read `AGENTS.md` and its 'Read first' files (Codex) before continuing."
  - (a) Rewrite `AGENTS.md` to the §8 text.
  - (b) Strip `developerboss` to coding only (R7, R10, R11; B15 per D15).
  - (c) Apply R12–R13 in `plan-authoring` and R14 in `mobile-dev`.
  - (d) Mirror (b) and (c) to `.codex`.
  - The other session keeps its loaded copies until it re-reads or restarts. Hand it this line: *"`AGENTS.md` and `developerboss` were reorganised; run `/compact` (Claude) or re-read `AGENTS.md` and its 'Read first' files (Codex) before continuing."*
    - Why `/compact`: per the docs (checked 2026-10-15), `/compact` is the only documented way an open session re-reads `CLAUDE.md` from disk. Whether `--resume`/`--continue` reloads it is undocumented. Confirm with `/context`.
  - Verify: A73 `diff` against `ezzy-vendor-mobile/AGENTS.md:46-55` is empty; coverage passes for every B-item.
- [x] **S6 — Full verification (§12) and handoff (§14).** ✅ DONE (2026-10-15)
  - **Fresh session, before compaction (user-run): ✅ PASS.**
    - `/context`: 5 memory files, 9k tokens (was 13.3k in S3, when the rules were loaded twice).
    - Quote test without tools:
      - All 7 Ask Before gates listed, with their meaning intact.
      - Red lines listed.
      - The execution cadence reproduced in full: one stage then stop; overrides; "never waives an approval gate"; "never pushes through a blocker"; the 3-part stage report. That content now exists only in `AGENTS.md` → Working Flow.
      - Minor: it attributed "never close follow-up items" to auto-memory. It is actually core-rules A52. The rule was applied correctly; only the source was misnamed.
  - **After `/compact`: ✅ PASS.** It quoted A45 word for word ("Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code or public environment variables") and attributed it to core-rules → Never / Red Lines. `@`-imported files survive compaction.
  - **Booker-only read: ✅ PASS.** After reading `booker/package.json`, it listed `booker/CLAUDE.md` + `booker/AGENTS.md` in context, and `.claude/rules/mobile-stack.md` was **not** loaded. The path scope is confirmed.
  - **Final machine checks: ✅.**
    - Coverage 137/137, gates 14/14.
    - `.claude`/`.codex` parity for all 4 changed skills.
    - `AGENTS.md` 8,021 bytes (under Codex's 32 KiB limit).
    - `git status` sorted equals baseline + plan + the 12 expected instruction paths **exactly**.
  - **Codex session checks (user-run, new Codex session at the repo root, 2026-10-15): ✅ PASS.**
    - **A (no tools):** it reproduced the Working Flow cadence and the 3-part stage report from `AGENTS.md` alone. It omitted the "override never waives gates / never pushes through a blocker" bullets; that is a summarisation gap, not a missing source (the text is in `AGENTS.md`, and B shows the gates are known).
    - **B:** it followed "Read first", opened `.claude/skills/core-rules/SKILL.md`, and quoted all 7 Ask Before gates exactly.

---

## 12. Verification

| Check | How | Auto / manual |
|---|---|---|
| Instruction coverage | The script reads the **backups** of `AGENTS.md` and `developerboss/SKILL.md`, splits them by the §6 and §6b ranges, and asserts that every non-blank line of each non-Remove item appears in its destination (or matches its approved R# text). It prints per-gate results for the 14 gates in §7. | Automatic |
| Broken references | Extract every backticked path and every `.claude/skills/<name>` mention from the new or changed files, then `test -e` each one. Every "`AGENTS.md` → \"Working Flow\"" reference must resolve to a heading that exists. | Automatic |
| Stale refs and headings | `grep -rn` across `AGENTS.md`, `CLAUDE.md`, `.claude/` and `.codex/` for "Sections 1–8", "per `AGENTS.md`", "AGENTS.md \"Ask Before\"", "developerboss/SKILL.md`. Running a stage", "full pre-flight checklist", and the moved headings. Only intended hits remain. | Automatic |
| `.codex` parity | `cmp` of each `.claude` skill against its `.codex` copy | Automatic |
| A73 preamble identical | `diff` against the nested copy | Automatic |
| Codex size limit | `wc -c AGENTS.md` < 32 KiB | Automatic |
| Scope | `git status --porcelain` vs §3: only the §8 expected paths differ | Automatic |
| Loaded at session start | Fresh session → `/context` and `/memory` | **Manual** |
| Quote test | Ask for an approval gate, a red line, and the "one stage at a time" cadence rule without pointing to them | **Manual** |
| Post-compaction | `/compact`, then repeat the quote test | **Manual** |
| Path-scoped rule | Touch a mobile file → "Loaded"; touch a `booker/` file → not loaded | **Manual** |
| On-demand skills | A plan request loads `plan-authoring`. If D2 = B, a coding request loads `developerboss` and an unrelated question doesn't. | **Manual** |
| Codex | New Codex session at the root: ask for the execution cadence (it is in `AGENTS.md`, so it should answer without opening anything) and the approval gates (it has to read `core-rules`). Also run `/skills` for F2. | **Manual** |

---

## 13. Rollback

One step, from the workspace root:

```bash
cp -a .git/agent-config-backup/2026-10-15/. . && trash .claude/skills/core-rules .claude/rules/mobile-stack.md && sha256sum -c .git/agent-config-backup/2026-10-15.SHA256SUMS
```

---

## 14. Handoff (2026-10-15)

### Files

| Action | Path |
|---|---|
| Created | `.claude/skills/core-rules/SKILL.md`: 179 lines; always-on rules (77 items) |
| Created | `.claude/rules/mobile-stack.md`: 15 lines; path-scoped to `ezzy-*-mobile/**` |
| Modified | `AGENTS.md`: 258 → 168 lines; pointer + AGENTS.md Use + Session Start + Working Flow |
| Modified | `CLAUDE.md`: +2 `@` imports (`core-rules`, `developerboss`) |
| Modified | `.claude/skills/developerboss/SKILL.md`: 126 → 71 lines; coding only |
| Modified | `.claude/skills/plan-authoring/SKILL.md`: references (line 9, R12, R13) |
| Modified | `.claude/skills/supabase-exp/SKILL.md`: references (lines 10-11, 47, 57, 202) |
| Modified | `.claude/skills/mobile-dev/SKILL.md`: reference (R14) |
| Modified | `.codex/skills/{developerboss,plan-authoring,supabase-exp,mobile-dev}/SKILL.md`: byte-identical mirrors |
| Created | `.plans/2026-10-15-split-agents-md-into-skills.md` (this plan) |
| Created (local, untracked) | `.git/agent-config-backup/2026-10-15/` (10 files) + `.git/agent-config-backup/2026-10-15.SHA256SUMS` |
| Moved / deleted | none |

### Where each old `AGENTS.md` section went

| Old section (lines) | New location |
|---|---|
| Workspace, Where to look (3–44) | `core-rules` → Workspace |
| Shared Tech Stack: Frontend (45–56) | `core-rules` → Shared Tech Stack |
| Shared Tech Stack: Mobile (57–66) | `.claude/rules/mobile-stack.md` (pointer line in `core-rules`) |
| Backend / Database, Shared Invariants (67–84) | `core-rules` |
| Instruction Priority (85–96) | `core-rules` (R2 names the three locations) |
| Non-negotiable Rules: Always, Never, Ask Before, Invariants, Preferences (97–149) | `core-rules` |
| AGENTS.md Use (150–162) | stays in `AGENTS.md` |
| Session Start (167–171) | stays in `AGENTS.md` (R5) |
| Think Before Coding (172–180) | `AGENTS.md` → Working Flow |
| "read developerboss before any task" (181) | stays in `AGENTS.md`, now "before any coding task" (R6) |
| Simplicity First, Surgical Changes (183–205) | `developerboss` → Default Working Style — coding |
| Component Conventions, Plan (206–227) | `core-rules` → Default Working Style |
| Plan: execution cadence bullet (228–229) | removed as a duplicate (D10); the full text is in `AGENTS.md` → Working Flow → Execution Cadence |
| Goal-Driven Execution (231–241) | split: general bullets → `AGENTS.md` → Working Flow; bugs/tests/refactors → `developerboss` |
| Completion Standard (242–250) | `AGENTS.md` → Working Flow |
| Prompt Writing (251–257) | `core-rules` |
| `...` (258) | removed (D10) |

From `developerboss`:
- Scope, assumptions, sizing, Execution Cadence, the report-after-execution and on-completion sections → `AGENTS.md` → Working Flow.
- The 2026-07-30 history note → removed (D15).

### Organisational vs substantive changes

- **Organisational (most of it):** text moved word for word. Headings changed level or number (R11). Pointers were updated to the new locations: R1, R2, R3, R4, R5, R8, R9, R10, R12, R13, R14, and the S4 references.
- **Substantive, approved:**
  - R6: the `developerboss` pointer is now scoped to coding tasks.
  - R7: new `developerboss` description.
  - Three removals: A109 duplicate, U1 `...`, B15 history note.
  - New text in `AGENTS.md`: intro, Read first, the alias sentence (D8), Skills, and the Working Flow intro line.
- **Stronger than before:** three gates and rules that were only in the on-demand `developerboss` are now always loaded and guaranteed for Codex too: the cross-app flag (B3), "override never waives approval gates" (B14), and the stage report (B16). A79 ("ask before changing code if unclear") is now in `AGENTS.md`, guaranteed for Codex.
- **Weaker than before:**
  - The 8 mobile tech-stack lines are now path-scoped instead of always on. Their gate and red-line content is still always on through A54, A45 and A66.
  - For Codex, `core-rules` content is reached by following a path, not loaded automatically (D3, accepted).
- **No approval gate or red line was weakened or dropped.** 14/14 gates are verified at their destinations.

### How things load now

| Content | Claude | Codex |
|---|---|---|
| `AGENTS.md` (incl. Working Flow) | every session (`@AGENTS.md`) | every session (native) |
| `core-rules` | every session (`@` import); survives `/compact` (verified) | must read by path (AGENTS.md "Read first") |
| `developerboss` (coding) | every session (`@` import) | must read by path |
| `mobile-stack.md` | when a mobile file is read (verified: not on booker) | must read by path |
| Task skills (`plan-authoring`, `component-separation`, …) | on demand: description match, or the core-rules triggers | via `AGENTS.md` → Skills, by path |

- Sessions already open before S5 keep the old text until `/compact` (Claude) or a re-read (Codex). The handoff line is in S5.
- Whether `--resume` reloads `CLAUDE.md` is undocumented.

### Unresolved and omitted

- **F1:** the "root tracks only …" line (now in `core-rules`) is inaccurate; it moved unchanged.
- **F2:** ✅ closed by you (2026-10-15). Codex loads `.codex/skills` (false alarm). Keep the `.codex` mirrors in sync on every skill edit.
- **F3:** `architecture/portals.md:454` wording. Out of scope.
- **F4:** precedence tension between A33 and A73. Unchanged.
- **F7:** near-duplicate B7 / A77 in Working Flow. Both kept.
- **F9:** a database password is inline in `.claude/settings.local.json:85` (pre-existing, untouched) and was removed from the backup. ✖ **Not rotating, your decision (2026-10-15):** it is a local-only credential used inside your Docker container. Closed by you.
- Nested app `AGENTS.md` files and `architecture/*.md` still say "root `AGENTS.md`". They resolve through the D8 alias sentence and were not edited (out of scope).
- `.plans/INDEX.md` was not regenerated (it is outside this plan's write set). Run `python3 scripts/plans-index.py` to list this plan.
- F-items are left open for you to close, per the core rule.

### Untouched

- No plan other than this one, and no doc, script or application file, was modified by this work.
- The other agent's baseline files (2 plans, `B7-EVIDENCE-RESPONSE.md`, `CHECKOUT-HANDOFF.md`, the `ezzy-vendor-mobile` repo, untracked plans/previews/scripts) are untouched by this session.
- `git status` equals baseline + plan + the 12 expected paths exactly.

### Validation performed

| Check | Result | Kind |
|---|---|---|
| Instruction coverage from backups (all 140 items) | 137/137 present, 3 approved removals absent; 14/14 gates | machine |
| Broken references / stale phrases | none (only pre-existing app-relative or generic names) | machine |
| AGENTS.md Use preamble identical to the nested copy | identical | machine |
| `.codex` parity | 9/9 skill pairs identical | machine |
| Scope vs baseline | exact match | machine |
| Fresh session loads the imports | `/memory` + `/context`: 5 files, 9k tokens | you |
| Quote test (gates, cadence) | pass | you |
| After `/compact` | exact quote of A45 | you |
| Path rule: mobile loads / booker does not | both pass | you |
| Codex session (A: cadence from `AGENTS.md`; B: gates via Read first) | pass | you |
| Codex skill discovery (F2) | `.codex/skills` is loaded (session log) | machine (read-only log grep) |

### Rollback

```bash
cp -a .git/agent-config-backup/2026-10-15/. . && trash .claude/skills/core-rules .claude/rules/mobile-stack.md && sha256sum -c .git/agent-config-backup/2026-10-15.SHA256SUMS
```

The backup can be deleted once you've committed and are satisfied.
