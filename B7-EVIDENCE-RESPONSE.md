# B7 — evidence response

**Date:** 2026-10-10
**Answers:** `CHECKOUT-HANDOFF.md` → "Evidence completion request — 2026-10-10"
**Scope:** read-only evidence supplement for the completed Backbone migration consolidation, plus one regression suite run on explicit user approval. **Not** new implementation, and **not** a closure of B7.

Every claim is labelled **OBSERVED** (a command run in this session, output read), **REPORTED** (stated by another party, not witnessed here) or **NOT CHECKED**. No credentials were read, no customer payloads accessed, no remote environment contacted, and no Git operation performed.

---

## 1 · Validation evidence

### 1.1 Reset — REPORTED, not observed

The 2026-10-09 `supabase db reset` was run by the user, who reported it done. **This session never captured its exit code or stdout.** What it observed is the resulting database state (§1.3 onward). The 2026-10-08 failure is the instructive counter-case: its background wrapper exited 0 while the captured log recorded `EXIT=1` with a `MigrationApplyError`, and that log is no longer reachable — which is exactly why wrapper exit and command exit are reported separately here.

### 1.2 Tested-file evidence — RECONSTRUCTED, not captured at replay time

| File state | SHA-256 | Lines | Relationship to the replay |
|---|---|---|---|
| Replayed 2026-10-09 | `b77573d113173571875d680a75a061e169f2878ba865dacf8456aae2fd001662` | 465 | The two-defect-repaired state; **this is what the reset applied** |
| Current source | `8e91abc8892ef39420ac22b2e205096031e67ecb36c09b83933d1e3455f1268a` | 468 | **NOT the replay input** |

The two differ by exactly three added lines — the `comment on function public.raise_booking_dispute(uuid, text, text)` statement and its surrounding blank line — and nothing else.

⚠️ **Codex's caution is correct and is not being argued with.** The 465-line hash comes from a backup this session took from the on-disk file *after* the reset and *before* splicing that comment, a window in which the file was not modified. It was **not hashed at the moment of replay**, so it is reconstructed evidence, not captured evidence. The current hash must not be described as replayed.

Originals at Backbone HEAD `5c7980a`, for reference (SHA-256, first 16): `938b51d9b1a81093` `20261003000001_booker_cancel_booking.sql` · `de37acd9f77ca39d` `20261003000002_refund_requests.sql` · `2d6da24df963602b` `20261003000003_resolve_dispute_status_note.sql` · `7dc34bbfbb3efb3a` `20261004000001_refund_from_delivered.sql`.

### 1.3 Local migration endpoint — OBSERVED

`select count(*), max(version) from supabase_migrations.schema_migrations` → **87** rows, max **`20261004000002`**. Versions ≥ `20261001`: `20261001000001`, `20261002000001`, `20261003000001`, `20261004000002` — the consolidated version is applied and the four superseded filenames are absent from both history and the working tree.

### 1.4 Function bodies — OBSERVED byte-identical

Method: dump each live `pg_proc.prosrc`; extract the corresponding dollar-quoted body from the original migration at HEAD `5c7980a`, taking the winning definition where one was redefined (`validate_booking_status_transition` three times — `20261004000001` wins); strip trailing whitespace; `diff`.

All four produced **no content difference**. The only diff lines were one leading and one trailing blank line, introduced by this session's own line-range slicing of the source files, not by the SQL.

### 1.5 Declarations, column, trigger and ACLs — OBSERVED

- `pg_get_function_result` / `prosecdef`: `validate_booking_status_transition → trigger`, `booker_cancel_booking → void`, **`raise_booking_dispute → uuid`**, `resolve_booking_dispute → void`; all four `SECURITY DEFINER`.
- `booking_disputes.kind`: `text`, `NOT NULL`, default `'complaint'::text`; `booking_disputes_kind_check` is `CHECK (kind = ANY (ARRAY['complaint','refund_request']))`; `col_description` returns the full **298-character** comment.
- Trigger `bookings_validate_status_transition`: `BEFORE UPDATE … FOR EACH ROW EXECUTE FUNCTION validate_booking_status_transition()`, enabled (`tgenabled = 'O'`).
- ACLs: the three RPCs each hold `authenticated=X` and `service_role=X`, with **no `PUBLIC` (`=X/`) and no `anon`** entry. `validate_booking_status_transition` retains the schema default, which matches the originals — none of them revoked it.

### 1.6 Known local gap — OBSERVED

`obj_description('public.raise_booking_dispute(uuid,text,text)'::regprocedure,'pg_proc')` is **NULL**. The statement exists in source and was parse-checked inside `begin … rollback` (returned `COMMENT`, then read back), but was deliberately not applied. It lands on the next reset. **No reset is warranted for it alone.**

### 1.7 Regression evidence — OBSERVED (run 2026-10-10, on explicit user approval)

This was the one bullet previously outstanding. It is now run, and it changed the picture.

**An existing suite already covered this function:** `backbone/supabase/tests/booking_transitions_test.sql`, written for the August `20260801000002` rewrite. It asserts both ALLOW and DENY for every actor and enforces **fixture role-disjointness**, because seed user `00000000-…-0002` is both a vendor-admin and a Command admin — a trap that had previously made five cells report ALLOW where DENY was correct.

| Run | Cases | Result | `psql` exit |
|---|---|---|---|
| As found | 45 | **45 passed, 0 failed** | 0 |
| After extension | **60** | **60 passed, 0 failed** | 0 |

⚠️ **The suite as found predated every October addition and covered none of them.** The consolidation's own new cells were untested. Fifteen cases were therefore added to that existing file — not a parallel file:

- **G3** — booker is an accepted actor for `pending → cancelled` and `confirmed → cancelled` (2 ALLOW).
- **G4 / D8-c** — Command-only `pending/confirmed → refunded` (2 ALLOW with reason, 4 DENY for booker/vendor, 1 DENY for Command without a reason).
- **K7** — Command-only `fulfilled → refunded` and `returned → refunded` (2 ALLOW, 4 DENY for booker/vendor).

**Refusal reasons were verified, not assumed.** The suite's runner classifies *any* exception as DENY, so a DENY could in principle mask an unrelated error. Each of the nine new denials was re-run capturing `SQLERRM`: eight returned `Invalid booking status transition: … (actor not permitted)` and one returned `Command override of confirmed -> refunded requires a reason`. All nine come from `validate_booking_status_transition` itself; none was masking.

Everything ran inside a transaction that was **rolled back**; the suite's own design does this. Before running, every trigger on `public.bookings` was checked against `pg_proc` for `net.`/`pg_net`/`http_post`/`supabase_functions`/`dblink` — **none makes a network call**, so all side effects were local rows discarded with the rollback. No email or notification left the database.

**Still not run:** any RLS policy suite. These cases exercise the trigger as `postgres` with `request.jwt.claims` set, which isolates the transition logic but does not test row visibility.

### 1.8 Durability

Scratch artifacts (the pre-splice backup, extracted bodies, parse-check and deny-reason scripts) live in a session-scoped temporary directory and will not survive. The durable record is: this file, the figures in `CHECKOUT-HANDOFF.md`, the extended suite committed as a repo file, and the session transcript. Nothing else should be cited as saved evidence.

---

## 2 · Environment history

| Environment | Observed? | Date | State |
|---|---|---|---|
| **Local** | OBSERVED | 2026-10-10 | Consolidated version applied; four originals absent; endpoint `20261004000002`; 87 migrations. Seed data present (41 bookings, 32 offerings, 14 vendors, 17 auth users); `booking_disputes` empty; manually created test offerings did not survive the reset |
| **Staging** | NOT CHECKED | — | See the narrowing below |
| **Production** | NOT CHECKED | — | Not reachable from the current link |

⚠️ **The earlier "empty `remote` column" finding was narrower than it sounds, and should not be reused as current proof.** It came from a single `supabase migration list` run earlier in October against **the linked project only**. Backbone is linked (a project ref exists under `supabase/.temp/`, deliberately not reproduced here), and per this repo's own environment notes that link points at **staging, not production**. So that observation describes **staging at that date** — it is not evidence about staging today, and it was never evidence about production.

**To re-establish either — not run, needs approval:** `npx supabase migration list` from `backbone/` (CLI 2.120.0 resolves through `npx`; the binary is not on this session's `PATH`). It is a remote call against whichever project is linked at the time, so **the environment label must be recorded alongside the output rather than assumed**. Production requires a separate link or a dashboard read.

---

## 3 · Proposed next action

**One narrow action: nothing technical — the decision is yours.**

The three evidence bullets from the request now stand as: validation evidence **supplied** (§1), regression evidence **supplied** (§1.7), environment history **supplied for local and explicitly unknown for staging and production** (§2). No further check this session can run would change that; what remains needs either your approval for a remote call or your judgement.

Two things are waiting on you, in order:

1. **Decide whether staging and production history must be established before B7 can close.** If yes, approve `npx supabase migration list` from `backbone/` (staging, via the current link) and say how production should be read. If no, the unknown should be recorded as an accepted unknown rather than left implicit.
2. **Git integration.** Uncommitted: `backbone/` — four deleted originals, the untracked consolidated migration, and the extended test suite; root — `CHECKOUT-HANDOFF.md` and this file. Commit messages for the first two were drafted separately. ⚠️ `backbone/supabase/snippets/` is a Supabase Studio artifact and should not be committed; `.gitignore:5` fails to exclude it because the pattern `./supabase/snippets/*` has an invalid leading `./`.

**Allowed files if the regression work is continued:** `backbone/supabase/tests/booking_transitions_test.sql` only.

**Not proposed, and not done:** any reset, any remote call, any staging or production check, any Git write, any S2 or checkout implementation. **B7, H2 and all follow-ups remain open for the user to close.** X1–X5 and G1–G8 are untouched by this supplement; a finished local consolidation task does not freeze them or approve S2 execution.
