# Local docs search (optional RAG) for the workspace

**Date:** 2026-09-24
**App / scope:** root repo only — `.plans/`, `architecture/`, `AGENTS.md`, `scripts/`; plus user-level config (`~/.claude.json`, `~/.codex/config.toml`) and a new folder outside every repo, `~/.local/share/rs-docsearch/`. **No app repo is touched.**
**Status:** IN PROGRESS — S0 ✅ and S2 ✅ COMPLETE (2026-09-24); S4 runs 1–2 = NO-GO (search 15 vs rg 14 of 20). **S1 formal trial running 2026-09-25 → ~2026-10-09** (user decision 2026-09-25): log hard-to-find questions in §8, then re-run S4 (run 3). Server installed at `~/.local/share/rs-docsearch/`, not registered. To resume, see §8.

> **Goal:** make "has this already been decided / where was this discussed?" answerable across ~125 plans and 15 architecture docs, for both Claude Code and Codex. Start with the cheapest fix that could work, and add semantic retrieval only if measurement shows it is needed. Every step must be removable without trace.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** I# = Important, D# = Decision, S# = Execution stage. Numbers are plan-local; qualify cross-plan references by app.

> **Git:** the user makes every Git operation by hand. No stage commits, pushes, or otherwise alters history in any repo. Where a stage changes tracked root files, it ends with "user commits".

---

## 1. Scope

**In scope:** better routing and indexing of the root docs; an optional local MCP search server over an explicit allowlist of Markdown; registering it with Claude Code and Codex; measuring whether it helps.

**Out of scope:**
- Indexing source code. `rg` handles it at this size (~130k lines of TS/SQL across six repos).
- Anything hosted, and Docker or Ollama.
- Git-based syncing.
- Changes inside `command`, `booker`, `vendor`, `backbone`, `ezzy-*-mobile`.

**Cross-app?** No. The only files changed are root-repo files and user-level config.

## 2. Findings (baseline, measured 2026-09-24)

| Corpus | Size | Fits in context? | Served today by |
|---|---|---|---|
| App code (6 repos) | ~130k lines. In `vendor`, 1,636 of its 2,059 tracked files are `public/ph-address` JSON | n/a | `rg`, agent exploration: **enough** |
| `architecture/` | 15 files, 7.3k lines, ~0.55 MB | Yes (~140k tokens) | Direct reads, but **no routing**: `AGENTS.md:13` describes it in one line |
| `.plans/` | 125 files, 73k lines, ~5 MB | **No** (≈1M+ tokens) | `rg`, but app names match nearly everything (`vendor` appears in 105 plans, `command` in 99) |

Plan-corpus quality problems. These hurt `rg` and RAG equally:
- **13 plans have no `**Status:**` header:** `2026-05-07-command-component-breakdown`, `2026-05-08-academy-component-breakdown`, `2026-05-12-backbone-migration-review`, `2026-05-14-learner-auth`, `2026-05-17-suppress-hydration-audit`, `2026-05-18-academy-dashboard-guide-panel`, `2026-05-18-dashboard-guide-panel`, `2026-05-18-learner-login-mobile`, `2026-05-23-webhook-is-paid-diagnosis` (uses `## Status`), `2026-05-25-login-modal-parity`, `2026-05-25-notifications`, `2026-06-06-exam-status-cards`, `2026-08-21-account-deletion-web-copy`.
- **Status headers are written in several formats:** `✅ COMPLETE`, `COMPLETE (date)`, `COMPLETE (closed …)`, `Planning`, `🔄 IN …`. This departs from the vocabulary in `.claude/skills/plan-authoring/SKILL.md:18`.
- **29 plans say `IN PROGRESS`.** Some are likely stale.
- **Legacy plans:** 8 filenames, and 10 plans in all, refer to `learner` / `academy`. Neither app exists in the workspace any more. Any search would return them next to current work.

Other context:
- `CLAUDE.md` files are `@AGENTS.md` pointers, and Codex reads `AGENTS.md` natively. The shared-instruction setup is already right.
- `.claude/skills` and `.codex/skills` have identical skill names.
- No MCP servers are configured in either tool today, so nothing can conflict.
- **Secret-bearing files present (names only), all to be kept out of any index:**
  - `vendor/.env.local`, `booker/.env.local`, `command/.env.local`
  - `backbone/.env`, `backbone/supabase/functions/send-notification-email/.env`
  - `ezzy-vendor-mobile/.env`, `ezzy-vendor-mobile/google-services.json`
  - root `supabase/` (mode 700), `test-db/` (root-owned)
- A scan of `.plans/`, `architecture/` and root Markdown found no JWT- or API-key-shaped strings.
- **Tooling:** Python 3.12 is available, and its stdlib `sqlite3` (3.45.1) supports **FTS5** and extension loading. So keyword search with BM25 ranking needs **no new dependency**. `uv`, `ollama` and `fd` are not installed.

**Assessment:** semantic retrieval is justified only for `.plans/` (and marginally `architecture/`), and only after the quality problems above are fixed. Otherwise a retriever would return stale or legacy decisions and present them as current. The payoff at this scale is modest, so the plan is staged with a go/no-go checkpoint after the non-RAG fixes.

---

## 3. Work items

### I1 — Architecture routing table in `AGENTS.md`  ✅ DONE (2026-09-24)
**File:** `AGENTS.md:13` (the one-line `architecture/` entry) and a new short subsection under **Workspace**.
**Gap:** agents can't tell which of the 15 docs answers which question, so they either read several or guess.
**Fix approach:**
- Add one line per `architecture/*.md` naming the question it answers, e.g. "`schema.md` — tables, columns, RLS, grants, audit logs".
- Derive each line from the doc's own headings; don't write it from memory.
- Keep the whole table under ~20 lines. It sits in the preamble-free body of the root `AGENTS.md` only (the layering preamble stays identical).
**Verification:** machine: every `architecture/*.md` appears exactly once (`ls` vs `grep`). Manual: user reads the table.
<!-- ✅ DONE (2026-09-24) — new `### Where to look` subsection under Workspace in `AGENTS.md`: a pointer to `.plans/INDEX.md` plus a 12-row table built from each doc's intro and H2 headings (the four email docs share one row). Verified by machine: all 15 docs referenced. Pending: user read-through. -->

### I2 — Standardise plan status headers  ✅ DONE (2026-09-24)  *(depends on D1, D3)*
**Files:** the 13 plans listed in §2, plus those whose header departs from the skill vocabulary.
**Fix approach:**
- Give every plan a line 4-ish `**Status:**` header using exactly `DRAFT | IN PROGRESS | COMPLETE | BLOCKED | ABORTED`. An optional ` — note` may follow.
- Mark legacy plans per D1.
- **Edit the header line only.** Plan bodies stay untouched: completed plans are a historical record.
- Stale `IN PROGRESS` plans are reclassified only as D3 allows.
**Guard against a weak implementation:** do not infer `COMPLETE` from the absence of ⬜ markers alone. The agent proposes a status with the evidence line, and the user confirms, in batches.
**Verification:** machine: `grep -L '^\*\*Status:\*\*' .plans/*.md` returns nothing. Every status value matches the vocabulary regex.
<!-- Approach refined 2026-09-24: bold and emoji around the status word are left as-is (the index parser strips `*` and the marker emoji), so only headers whose status *word* was missing or outside the vocabulary were edited. This leaves completed plans' headers untouched. -->
- ✅ Batch 1 (2026-09-24, user-approved): all 21 plans dated before the 2026-06-12 pivot → `ABORTED — legacy: pre-pivot DriveBook plan, retired by the 2026-06-18 platform pivot.` Old header text kept after `Last recorded:`; header-less plans say `Outcome not recorded.`
- ✅ Batch 2 (2026-09-24, user-approved): 10 post-pivot fixes. EXECUTED/IMPLEMENTED/BUILT → COMPLETE; the two SUPERSEDED plans → ABORTED with successor path; `Status (date):` key normalised; test script → DRAFT; research → COMPLETE; account-deletion-web-copy → COMPLETE (user confirmed the ezzy.ph edits were published).
- Verified: every plan's header matches the vocabulary once `*` is stripped; git diff = 31 files, 18 header lines replaced + 13 status lines inserted, no body changes.
- ✅ Batch 3 (2026-09-24, user-approved): the 10 oldest current IN PROGRESS/DRAFT plans (06-23 → 07-29). → COMPLETE: email-notifications-resend, email-hosted-cutover (user confirmed the override is off), booker-vendor-pwa-readiness (user confirmed Android + iOS installs), backbone-drift-audit (I3/I4 accepted as deferrals), ezzy-vendor-mobile-companion (superseded by later release plans), vendor-mobile-guard-fallback-route (user confirmed on device; its row was also removed from the unverified-work table in `architecture/portals.md`). Kept: loginpage-destyle-refactor (DRAFT), app-name-env-var (IN PROGRESS; 38 `bookdeck` hits still in `seed.sql`), vendor-code-review-hardening (DRAFT + re-check note), vendor-mobile-preview-crash (IN PROGRESS; only I4 remains).
  - Findings surfaced for the user, outside this plan's scope: **vendor B1 is a live bug**: `vendor/components/offerings/OfferingFormModal/useOfferingForm.ts:99` `parseInt(ofPrice)` drops centavos from a `numeric(10,2)` price. **preview-crash I4**: dev seed logins remain on an internet-reachable Supabase project.
- ✅ Batch 4 (2026-09-24, user-answered): the next 10 (08-01 → 08-12). → COMPLETE: vendor-mobile-fulfilment-sync and vendor-mobile-live-reload (both device-confirmed by the user; live-reload's I1–I5 recorded as not executed), vendor-signup-production-preparations (user confirmed the vendor registration email now arrives). scroll-header-and-fee stays IN PROGRESS with a note (stage 1 device-confirmed; B3 deferred by the user). `architecture/portals.md` unverified-work table: live-reload and scroll/header rows removed, the following paragraph now names the plan it refers to, and roadmap item 1's stale "four plans" count removed. Untouched: hidden-action-bar (not device-confirmed), the two 08-01 fulfilment docs (user will revisit).
  - ✅ Applied 2026-09-24 after user approval: re-check notes on web-apps-production-launch-readiness (partly superseded), vendor-stale-service-worker-cache (B1 fixed by `2026-08-18-command-vendor-nav-branding-responsive` I5; B2 still open at `vendor/components/layout/AppShell/useAppShell.ts:198-202`), notification-email-rate-limit (no edit needed).
- ✅ Batch 5 (2026-09-24, user-answered): 10 plans, 08-14 → 08-26. → COMPLETE: vendor-mobile-store-release-readiness and vendor-mobile-release-gap-closure (successor: 2026-09-21-ezzy-vendor-mobile-store-submission), vendor-form-modals-to-radix-dialog (I2/I3/B6a carried as follow-ups), plus four confirmed by the user on an Android device: mobile-vendor-dashboard-range-and-drilldown, vendor-mobile-dashboard-parity-guide-and-insets, vendor-mobile-guide-modal-and-legal-links, vendor-mobile-filter-toolbar-redesign. Kept unedited: payout-deferred-followups (DRAFT holding), vendor-launch-followups (DRAFT holding; note its L3: Command's KYC emails to vendors have never sent), booker-visual-baseline-remediation (paused). `architecture/` references to these plans are descriptive and needed no change. (08-17 command-new-user-password-onboarding was a false match, already COMPLETE.)
- ✅ Batch 6 (2026-09-24, user-answered): only 9 September plans remained (the earlier count of ~20 was inflated by a filter that matched body lines; INDEX.md was never affected). 3 were checked; the other 6 are clearly active. → COMPLETE: vendor-mobile-kiosk-mode (built; live acceptance owned by 09-21 store-submission Stage 2A / I1), booker-production-minimal-for-vendor (the user confirmed prod data and a live payment). Kept: paymongo-to-maya-migration-research (DRAFT; D0 undecided).
  - Possible follow-up, not edited (it's a body item, not a header): `2026-08-25-vendor-launch-followups.md` F20 (real-money kiosk end-to-end, ⬜) may be closed by the live payment the user confirmed.
- **I2 closed 2026-09-24.** Final: 126 plans, current COMPLETE 79 · IN PROGRESS 11 · DRAFT 11 · ABORTED 3 · BLOCKED 1, legacy 21.

### I3 — Generated `.plans/INDEX.md`  ✅ DONE (2026-09-24)
**Files:** new `scripts/plans-index.py` (stdlib only) and generated `.plans/INDEX.md`.
**Fix approach:**
- The script reads each plan's title, date, `**App / scope:**` and `**Status:**` lines, plus any `Predecessor` / `Supersedes` line.
- It writes one table, sorted newest first, with legacy plans in a separate trailing section.
- The script is the source of truth: re-run it rather than hand-edit (header comment says so).
- The script has a `--check` mode that exits non-zero if `INDEX.md` is stale, for optional manual use.
**Verification:** machine: run twice and get identical output. `--check` passes. The row count equals `ls .plans/2*.md | wc -l`.
<!-- ✅ DONE (2026-09-24) — `scripts/plans-index.py` (stdlib only) writes a Current table and a Legacy table, plus a status summary line. Verified by machine: idempotent; `--check` passes when clean and exits 1 after a temporary plan was added (then removed); 126 rows = 126 plans. Known limit: 14 plans (mostly legacy) have no recognisable scope line, so their Scope cell is blank. -->

### I4 — Point `plan-authoring` at the index  ✅ DONE (2026-09-24)
**Files:** `.claude/skills/plan-authoring/SKILL.md` §2 "Investigate", and its copy under `.codex/skills/`.
**Fix approach:** one bullet: "check `.plans/INDEX.md` for predecessor or overlapping plans before writing a new one; re-run `scripts/plans-index.py` after creating or closing a plan".
**Verification:** machine: diff the two skill copies after editing to confirm they are identical.
<!-- ✅ DONE (2026-09-24) — bullet added to §2 of both copies; `diff` confirms they are still identical. -->
<!-- Follow-on (2026-09-24, user-approved): plan-authoring loads mainly when a plan is written, but plans are usually closed during execution, so the same reminder was added to `developerboss` §"Always report after execution" item 3 (both copies, `diff` identical): re-run the script whenever a plan's Status, title or scope line changes. -->

### I5 — `rs-docsearch` MCP server, keyword-only (FTS5)  ✅ DONE (2026-09-24)  *(D7: standard library only, no dependencies; approval gate: writing to `~/.local/share/rs-docsearch/`, outside the workspace)*
**Location:** `~/.local/share/rs-docsearch/` (outside every repo): `server.py`, `allowlist.txt`, `test_server.py`, `index.sqlite` (no venv, per D7).
**Design:**
- **Allowlist (globs, relative to `/home/joshua/RS`):** `.plans/*.md`, `architecture/*.md`, `AGENTS.md`, `*/AGENTS.md`, `ezzy-vendor-mobile/*.md`, `ezzy-booker-mobile/*.md`, plus root notes per D5.
- **Denylist applied on top, as a backstop:** `.env*`, `*.json`, `node_modules`, `.git`, `supabase/`, `test-db/`, `*.backup`. A file must match the allowlist **and** miss the denylist.
- **Chunking:** split on Markdown headings (H2/H3), with a cap of ~1,500 chars per chunk; split long sections on paragraph boundaries. Each chunk stores `path`, `start_line`, the heading trail, and the plan's date, status and legacy flag, read from I2's headers.
- **Search:** SQLite FTS5 with BM25 ranking over chunk text plus heading trail. Stdlib `sqlite3` only.
- **Tools, two only:**
  - `search_docs(query, k=8, include_legacy=false, status=None)` returns `path:line`, the heading trail, status and a ~300-char snippet.
  - `reindex()` returns counts of added, changed and removed files.
- **Sync:** at startup and on `reindex()`, walk the allowlist and compare `(mtime, size)`, then `sha256` on mismatch. Re-chunk only changed files and drop rows for deleted files. The working tree is the only source; no Git and no network.
- **Kill switch:** if `~/.local/share/rs-docsearch/DISABLED` exists, the server starts, exposes no tools, and logs why.
- **Read-only:** the server never writes inside `/home/joshua/RS`.
**Guard against a weak implementation:**
- Results are pointers; the tool description must say "open the cited file before relying on it".
- Snippets never exceed the cap.
- Legacy plans are excluded unless requested.
**Verification:**
- Machine: unit smoke test with a fixture dir. A denied file (e.g. a fake `.env`) is never indexed, even if the allowlist is widened. Touching one plan re-indexes exactly one file. A no-change reindex takes under 1 s.
- Machine: `sqlite3 index.sqlite 'select distinct path'` contains no path outside the allowlist.
<!-- 🔄 2026-09-24 — built and tested in the session scratchpad (not yet installed). Design as above, plus: only `.md`/`.txt` are ever indexed; symlinks and paths resolving outside the root are skipped; `.plans/INDEX.md` is excluded (generated); H1–H3 split, ignoring fenced code; a short stopword list keeps question words from dominating BM25; chunks with no words are skipped; the schema version forces a rebuild when chunking changes. CLI for evaluation without registering: `server.py --reindex`, `server.py --search "q" [--legacy] [--k N]`.
  Verified by machine: `test_server.py`, 6/6 pass — the denylist holds with a `**/*` allowlist (`.env*`, `.json`, `node_modules`, root `supabase/`, `test-db/`, `.backup`, `.tsx` and an outside-root symlink all excluded); edit one file → 1 changed; delete → 1 removed; no-op reindex <1 s; legacy excluded by default; a full MCP exchange works (initialize, notification gets no reply, tools/list, search_docs, reindex, unknown method → -32601); the DISABLED file exposes no tools and creates no index.
  Real workspace (index in the scratchpad): 157 files, 4,744 chunks, 13 MB; full build 0.56 s, no-op 0.014 s; `git status` unchanged. 4 sample questions (payout fee withholding, overnight schedules, refunds, kiosk in first release) each put the right plan or doc in the top results.
  ✅ Installed 2026-09-24 (user-approved): `server.py`, `allowlist.txt`, `test_server.py` copied to `~/.local/share/rs-docsearch/`. The installed copy passes 6/6 tests, built its own `index.sqlite` (157 files, 0.82 s; no-op 0.012 s) and answered a live initialize + search_docs exchange. Not registered with Claude Code or Codex. Remove with `trash ~/.local/share/rs-docsearch`. -->

### I6 — Register with both agents  ⬜ TODO  *(approval gate: edits user-level config; depends on I5, D4)*
**Fix approach:**
- **Claude Code:** `claude mcp add --scope user rs-docsearch -- ~/.local/share/rs-docsearch/.venv/bin/python ~/.local/share/rs-docsearch/server.py`.
- **Codex:** a `[mcp_servers.rs-docsearch]` block in `~/.codex/config.toml` with the same command.
- Before writing the Codex block, confirm the key names and any `enabled` flag against the installed Codex version's docs; don't write it from memory.
- Back up both config files to `~/.local/share/rs-docsearch/backup/` before editing.
**Verification:** live: `/mcp` in Claude Code shows the server as connected and the tools as listed. Codex lists the tool in a fresh session. One query returns hits in each.

### I7 — Measure before adopting  ✅ DONE (2026-09-25)  *(runs 1 and 2 via CLI, before I6; see §6: NO-GO)*
**Fix approach:**
- The user supplies ~10 real questions from recent sessions, e.g. "what did we decide about withholding the EZZY fee on payouts?"
- For each, record whether the correct plan/section lands in the top 3 for (a) `rg` over `.plans/` + `INDEX.md` and (b) `search_docs`.
- Record the results in this plan (§6).
**Go/no-go:** adopt (S5) only if (b) beats (a) on at least 3 of 10 questions. Consider semantic embeddings (I8) only if most of (b)'s misses are vocabulary mismatches.
**Verification:** the results table in §6 is filled in.

### I8 — Semantic embeddings (hybrid)  ⏸ PARKED
**Why parked:** it adds a model download plus `fastembed`/ONNX and `sqlite-vec` dependencies, and the gain is unproven. **Unblock condition:** I7 shows most misses are vocabulary mismatches.
**Sketch, if unblocked:**
- Small local CPU model (`bge-small-en-v1.5` class) and `sqlite-vec` table beside FTS5.
- Merge the two rankings with reciprocal-rank fusion. The same `search_docs` signature, so no config changes.
- Needs its own approval.

### I9 — Optional-use note in `AGENTS.md`  ⬜ TODO  *(depends on I7 go)*
**File:** `AGENTS.md`, new short subsection after **Workspace**.
**Text (draft):** "If the `rs-docsearch` MCP tool is available, use it for *has this been decided / where was this discussed* questions across `.plans/` and `architecture/`. Use `rg` for code and exact identifiers (table names, `D#`/`B#`, migration numbers). Always open the cited file and check the plan's `Status:` before relying on a result."
**Guard against a weak implementation:** the wording must be a no-op when the server is absent. It must not make the tool required.
**Verification:** manual read. The layering preamble stays unchanged (diff).

---

## 4. Decisions
<!-- All decisions resolved 2026-09-24. Options kept below for the record. -->
- **D1** — How are legacy `learner`/`academy` plans marked? → **(a) header note, files stay in place** (resolved 2026-09-24 — user accepted recommendation)
  - (a) **`**Status:** COMPLETE — legacy: app removed from workspace` (or `ABORTED — legacy`), leaving files in place.** *(recommended: header-only edit, no file moves, INDEX puts them in the trailing section)*
  - (b) Move them to `.plans/archive/`: visible file moves in Git.
  - (c) Leave them as-is and filter by filename in the index. Brittle.
- **D2** — Is `INDEX.md` generated by a script or maintained by hand? → **(a) generated by `scripts/plans-index.py`** (resolved 2026-09-24 — user accepted recommendation)
  - **(a) Generated by `scripts/plans-index.py`** *(recommended: can't drift; `--check` catches staleness)*
  - (b) Hand-maintained: zero code, but it will drift.
- **D3** — Who decides the status of the 29 `IN PROGRESS` and 13 header-less plans? → **(a) agent proposes with evidence, user confirms in batches of ~10** (resolved 2026-09-24 — user accepted recommendation)
  - **(a) The agent proposes each with an evidence line, and the user confirms in batches of ~10** *(recommended)*
  - (b) The agent decides alone. Risks mislabelling live work.
  - (c) Only fix header *format*, leaving status values as-is.
- **D4** — Where are the servers registered? → **(a) user scope for both tools** (resolved 2026-09-24 — user accepted recommendation)
  - **(a) User scope for both tools (`claude mcp add --scope user`, `~/.codex/config.toml`)** *(recommended: no tracked file, removal is one command each)*
  - (b) Project `.mcp.json` in the root repo: shared, but a tracked file the user must commit, and Claude-only.
- **D5** — Are root business/notes files indexed (`pitch_deck.md`, `production-costs.md`, `notes.txt`, `IOS-STAGING-TEST-REPORT-*.md`)? → **(a) test reports and `notes.txt` only** (resolved 2026-09-24 — user accepted recommendation)
  - (a) Test reports and `notes.txt` only *(recommended)*
  - (b) All of them.
  - (c) None.
- **D6** — Stop after S1 if I1–I4 prove sufficient? → **(a) yes, S1 is a real go/no-go** (resolved 2026-09-24 — user accepted recommendation). **Amended 2026-09-24 (user):** build I5 early, without registering it, so it can be evaluated from the command line; S3 registration remains gated on the I7 evaluation.
- **D7** — How is the server built? → **(B) standard library only**: a hand-written MCP stdio subset (`initialize`, `ping`, `tools/list`, `tools/call`) plus stdlib `sqlite3` FTS5; no packages installed (resolved 2026-09-24 — user choice). Rejected: (A) the official `mcp` SDK in a venv (28 packages, about a third of them HTTP/auth code this tool never uses); (C) a Docker container (real read-only isolation, but a container per agent session and an image to maintain). Tradeoff accepted: protocol changes must be handled by editing `server.py`, not by an SDK update.
  - **(a) Yes: S1 is a real go/no-go, and I5–I9 are ABORTED if the user reports no remaining pain after 1–2 weeks** *(recommended)*
  - (b) Proceed to the proof of concept regardless, for evaluation's sake.

## 5. Execution order

| Stage | Items | Touches | Gate | Undo |
|---|---|---|---|---|
| **S0** | I1, then I2 → I3 → I4 | root repo files (user commits) | plan approval | revert the files in the root repo |
| **S1** | Checkpoint: use S0 for 1–2 weeks | — | D6 | — |
| **S2** | I5 | `~/.local/share/rs-docsearch/` only | **Approval:** writing outside the workspace (no dependencies, per D7) | `trash ~/.local/share/rs-docsearch` |
| **S3** | I6 | `~/.claude.json` (via CLI), `~/.codex/config.toml` | **Approval:** user config edits; D4 | `claude mcp remove rs-docsearch`; delete the Codex block (or restore the backup) |
| **S4** | I7 | this plan (§6) | — | — |
| **S5** | I9, and I8 only if unparked | `AGENTS.md` (user commits) | I7 go; I8 needs its own approval | revert the `AGENTS.md` hunk |

The safe prefix is **I1**. It has no decision dependency and can start once the plan is approved. Cadence is one stage at a time.

**Per-session enable/disable (after S3):**
- Claude Code: toggle in `/mcp`, or `claude mcp remove`/`add`.
- Codex: comment out the block, or use `enabled = false` if the version supports it (checked in I6).
- Both tools: `touch ~/.local/share/rs-docsearch/DISABLED`.

**Full removal:** the S3 undo, then `trash ~/.local/share/rs-docsearch`, then revert the I9 hunk. S0's improvements remain useful on their own.

## 6. Verification

| Item | Machine-verifiable | Needs live environment |
|---|---|---|
| I1 | every `architecture/*.md` listed once | user read-through |
| I2 | `grep -L '^\*\*Status:\*\*'` is empty; values match the vocabulary regex | user confirms reclassifications (D3) |
| I3 | idempotent output; `--check` passes; row count matches | — |
| I4 | skill copies identical (`diff`) | — |
| I5 | fixture tests: denylist holds, incremental reindex, <1 s no-op, no out-of-allowlist paths | — |
| I6 | backups exist | `/mcp` shows connected; Codex lists the tool; a query returns hits in each |
| I7 | — | results table below |
| I9 | preamble unchanged (`diff`) | user read-through |

**I7 results:** *(filled at S4)*

| # | Question | `rg` + INDEX top-3? | `search_docs` top-3? | Miss reason |
|---|---|---|---|---|
| 1 | Did the vendor registration email ever get fixed? | ✖ | ✅ | rg: 'registration email' matches 12 files; the right plan says 'registering vendor receives no email' |
| 2 | Who owns the kiosk live payment test on mobile? | ✅ | ✅ |  |
| 3 | Did push notifications reach the backend, with a device token table? | ✅ | ✅ |  |
| 4 | Is the vendor service worker stale cache bug fixed? | ✅ | ✅ |  |
| 5 | Why couldn't schedules cross midnight? | ✅ | ✅ |  |
| 6 | What did we decide about withholding tax and the Ezzy fee on payouts? | ✅ | ✅ |  |
| 7 | Why does an offering price lose its centavos when saved? | ✖ | ✅ | rg: 'centavo|truncat' matches 45 files, mostly query-truncation plans; the right plan says 'truncated to whole pesos' |
| 8 | Is NOTIFICATION_EMAIL_OVERRIDE_TO still on? | ✅ | ✅ |  |
| 9 | Did we decide to switch from PayMongo to Maya? | ✅ | ✅ |  |
| 10 | Why was the Command user admin privilege tiering plan abandoned? | ✅ | ✅ |  |

**Run 1 (2026-09-24), questions from the S0 plan review.** Answer key and `rg` patterns were written before either method ran (`questions.json` in the session scratchpad; not kept). Method: `rg -c -i` over the same corpus, files ranked by matching-line count, INDEX.md included; search = installed CLI, top 15 chunks deduplicated to files. Score: an expected source in the top 3 files.
- **Result: search 10/10, rg + INDEX 8/10. Search-only wins: 2 (Q1, Q7); rg-only wins: 0.**
- **Go/no-go (I7 rule: search must beat rg on ≥3 of 10): NO-GO for S3 on this run.**
- Observations: both misses were wording mismatches (the doc uses different words from the question), exactly the case search is for. On the hits, search returned fewer irrelevant files (Q6 and Q9 gave just the one right plan; rg's top 3 padded with incidental mentions). `rg` found the exact identifier (Q8) as well as search did.
- Biases: the questions came from this session, so the answer locations were known; each `rg` pattern was a single try, where an agent would retry a failed grep (that favours search); ranking `rg` by match count is generous to `rg`.
- Next: re-run with the user's S1 trial questions (fresh, unknown answers) before deciding S3.

**Run 2 (2026-09-25), questions from the user's past Codex sessions** (S1 shortened by the user). Source: the user's own messages in the 14 Codex sessions run in `/home/joshua/RS` (402 messages → 21 question-like → 10 standalone, reworded, all approved by the user). Answer key from each session's outcome: doc paths in Codex's tool calls and replies, then the session's main plan by tool-call paths; each key file was checked to still contain the answer. Q4's key is judgement (session cited nothing; the companion plan's B3 answers it directly). Nothing from the logs was written to disk. Method as run 1, except `rg` now searches exactly the server's file list (+ INDEX.md); run 1's `rg` list missed the mobile apps' top-level Markdown.

| # | Question | `rg` + INDEX | search |
|---|---|---|---|
| 1 | Why does mobile push need Firebase, and is there an option that doesn't? | ✅ | ✅ |
| 2 | Can Expo Go open this SDK 57 app on an iPhone? | ✅ | ✅ |
| 3 | How do I trigger a test push notification on staging? | ✖ | ✅ |
| 4 | Can I run an iOS simulator in this environment? | ✅ | ✅ |
| 5 | Why can't the mobile kiosk call the backend directly, like vendor web does? | ✅ | ✖ |
| 6 | Was it decided that kiosk payments need no vendor web changes? | ✖ | ✖ |
| 7 | Why doesn't the booking-complete screen show after paying in the browser? | ✅ | ✖ |
| 8 | Why doesn't kiosk mode appear in the iOS menu? | ✖ | ✖ |
| 9 | What does fulfilled mean for a booking? | ✖ | ✖ |
| 10 | Do reviewers need a production vendor account, and do they go through KYC? | ✅ | ✅ |

- **Result: rg + INDEX 6/10, search 5/10. Search-only wins: 1 (Q3); rg-only wins: 2 (Q5, Q7).**
- Key strictness cut both ways: on Q9 both methods returned the dual-acknowledgement plan, which also defines "fulfilled"; on Q8 search returned `KIOSK-VERIFICATION.md` and the kiosk-mode plan. Loosening the key would add hits to both, not separate them.
- Search's misses were long natural-language questions whose words appear across many kiosk/payment plans; BM25 without meaning-matching spreads across them.
- **Combined (20 questions): search 15, rg + INDEX 14; search-only 3, rg-only 2.** No clear advantage either way.
- **Go/no-go: NO-GO for S3.** Neither run met the ≥3 search-only wins rule, and run 2, the less biased set, favoured `rg` slightly. Semantic embeddings (I8) are not indicated either: the misses are ranking spread, not a missing concept match that embeddings would clearly fix.

## 7. Risks
- **Stale or legacy results returned with confidence.** This is the main risk. Mitigated by I2/D1 status metadata, legacy exclusion by default, and the "open the file, check Status" rule.
- **Snippet over-trust.** Plans often reverse decisions in later sections, so a snippet can be wrong about the outcome. Mitigated by pointer-only results and the I9 wording.
- **Maintenance:** a venv, a pinned SDK, and config in two tools that may change their MCP formats. Mitigated by keyword-only first (stdlib FTS5) and user-scope registration.
- **Secret leakage into the index.** Mitigated by allowlist plus denylist and the I5 fixture test. The index stays local, but it is a second copy of everything indexed.
- **Low payoff at this scale.** Mitigated by the S1 checkpoint and the I7 go/no-go.

## 8. S1 trial (2026-09-25 → ~2026-10-09) and how to resume

**Decision (2026-09-25, user):** run the formal 1–2 week trial before closing, rather than closing now. Nothing is registered during the trial; sessions on every account behave as with S0 alone.

**During the trial (any account, any agent):** when a "was this decided / where did we discuss X?" question is hard to answer, add a row below. Fill in the last column once you find the answer; it becomes the answer key, so nobody (including the evaluating agent) chooses it after the fact. Rows with no answer found are still useful; keep them.

| Date | Question (as you'd naturally ask it) | What happened (agent grepped a lot / missed it / you dug) | Where the answer turned out to be (file, section) |
|---|---|---|---|

**To resume (after ~2026-10-09, or once the table has ~10 rows):** open a new session in `/home/joshua/RS` from any account and give it the resume prompt below. The conversation that ran runs 1–2 is not needed; this plan holds everything.

Resume prompt:

> Resume `.plans/2026-09-24-local-docs-search-rag.md` at §8: the S1 trial is over. Re-run the S4 evaluation as run 3 using the questions in the §8 trial table, following the run-2 method in §6 exactly: lock in each question's answer key (from the table's last column) and one `rg` pattern before running anything; `rg -c -i` over exactly the files the server indexes (import `candidate_files()` from `~/.local/share/rs-docsearch/server.py`) plus `.plans/INDEX.md`, files ranked by matching-line count; search via `python3 ~/.local/share/rs-docsearch/server.py --search "<question>" --k 15`, deduplicated to files; score "an expected file in the top 3". Record run 3 in §6. Then apply the I7 rule: register (S3) only if search has ≥3 search-only wins; otherwise propose the close-out (I6/I8/I9 ✖ ABORTED, plan COMPLETE) and ask me whether to keep or remove the installed server. Do not register anything or edit my Claude Code or Codex config without asking.

**If fewer than ~5 rows were logged:** that is itself the result. S0 was enough in practice; propose the close-out above without a run 3.
