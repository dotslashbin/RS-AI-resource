---
name: supabase-exp
description: Use for any task touching Supabase — schema/migration changes, RLS policies, table grants, SECURITY DEFINER functions, Storage buckets, Realtime, or client usage in command/booker/vendor. Expert checklist for correct, secure, performant Postgres/Supabase work in this repo.
---

# Supabase Expert

Apply this whenever a task touches the shared Supabase project (the "backbone"):
migrations, RLS, grants, functions/triggers, Storage, Realtime, or how an app
talks to Supabase. This supplements `AGENTS.md` — where they overlap,
`AGENTS.md`'s invariants win; this skill is the depth behind them.

---

## 1. Ground every claim in `./architecture` — read before touching anything

`./architecture/*.md` is this repo's documented source of truth for what the
backbone is supposed to be. Before proposing or auditing anything, read the
files relevant to the area in play — don't rely on memory of a prior read or
on what a migration file alone implies:

- **`schema.md`** — tables, columns, relationships. The baseline for "does
  this table/column/FK already exist, and what does it mean."
- **`auth-and-roles.md`** — the three-layer access model (active status,
  portal membership, role) and which helper functions/columns enforce each
  layer. Any RLS policy touching auth must match this model, not reinvent it.
- **`conventions.md`** — established code/project patterns; a migration or
  client-code change that deviates needs a documented reason.
- **`overview.md`** / **`portals.md`** — which of command/booker/vendor owns
  a given concern, and current feature state per portal.
- **`booking-flow.md`**, **`vendor-kyc.md`** (and other feature docs) — the
  intended domain model for that subsystem before changing its tables/RLS.

Treat these docs as facts to verify against, not facts to assume are still
current — they can drift from the actual migrations. When "polishing the
backbone" (auditing/hardening existing schema, RLS, or grants), explicitly
diff what the docs say against what `backbone/supabase/migrations/` actually
does:

- **Docs match reality** — proceed, citing the doc.
- **Docs are stale** (migrations evolved, docs didn't) — flag it and propose
  the doc update alongside the code change; don't silently leave a false
  source of truth in place.
- **Reality diverges from a documented decision** (e.g. a grant broader than
  `auth-and-roles.md` implies, a policy that doesn't match the three-layer
  model) — this is a finding, not something to quietly "correct" by
  reinterpreting the doc. Surface it and ask, per `AGENTS.md`'s "if uncertain,
  stop and ask."

A change or an audit finding that isn't traceable to an actual file (a
migration, an architecture doc, or a grep result) is a guess — say so
explicitly rather than presenting it as verified.

## 2. Schema changes are an approval gate — draft first

- Any new table, column, index, constraint, or RLS policy requires explicit
  user approval before the migration file is written (`AGENTS.md`).
- Draft the exact SQL in the plan/response first. Do not create the migration
  file until the user says go.
- Never edit an applied migration — a new migration is always the fix, even
  for a typo in a comment.
- Filename convention: `YYYYMMDDHHMMSS_short_description.sql`, matching the
  existing sequence in `backbone/supabase/migrations/`. Check the latest
  timestamp before picking a new one so ordering stays monotonic.
- State the migration's **blast radius** before asking for approval:
  - Does it rewrite or validate existing rows? Could any fail?
  - What lock does it take, and for how long, on a live table?
  - What downstream work does it force — hand-written type updates, RPC
    changes, dependent app code in one or more of command/booker/vendor?
  - How would it be undone?

## 3. RLS + grants are a pair, never one alone

This repo learned this the hard way (`20260620000001_api_role_grants.sql`):
PostgREST checks table-level `GRANT`s *before* RLS is ever evaluated. RLS with
no grant silently 403s; a grant with no RLS silently leaks rows. Every new
table's migration must include both, and they must agree:

- `enable row level security` on every new table — no exceptions.
- `anon` gets no table privileges unless a policy explicitly targets `anon`
  (rare — check whether that's really intended).
- `authenticated` gets exactly the operations its policies allow — never
  more (no blanket `all`), never `TRUNCATE`.
- `service_role` gets full DML — it bypasses RLS and is the trusted
  server-side path (webhooks, atomic multi-table writes, signup triggers).
- If a table has no `INSERT` policy for `authenticated` because inserts only
  happen via a `SECURITY DEFINER` function or `service_role` route, say so in
  a comment next to the grant line (see the `vendor_kyc` grant comment for
  the pattern) — a bare missing grant looks like an oversight otherwise.
- Read every existing policy on a table before adding a new one — two
  permissive policies for the same role/action are OR'd together, so a
  narrow new policy can be silently widened by a pre-existing broad one.
- When auditing an existing table, check its actual grants (`\dp` / the
  grants migration) against `auth-and-roles.md`'s access model — a mismatch
  is a §1 finding.

## 4. Policy design

- Prefer small, purpose-named policies (`"vendor admins read own kyc"`) over
  one broad policy — easier to audit, easier to reason about interactions.
- `using` gates which rows are visible/matchable; `with check` gates what a
  write is allowed to result in. For `update`, both usually need to be
  present and are not required to say the same thing (e.g. resubmit: `using
  (status = 'rejected')`, `with check (status = 'submitted')`).
- Reuse existing helper functions (`is_active()`, `is_portal_member()`,
  `has_role()`, `has_vendor_role()`) instead of inlining the same subquery —
  cross-check `auth-and-roles.md` and existing migrations for the current
  set before writing a new one.
- Never write a policy that depends on data supplied by the same write it's
  checking without re-deriving it from a trusted source (e.g. don't trust a
  `vendor_id` column value for authorization if the row itself is attacker
  supplied — join back to the authoritative membership table).
- Watch for recursive RLS (a policy on table A that queries table A) —
  Postgres allows it but it's easy to get infinite recursion or wrong results;
  route through a `SECURITY DEFINER` helper function instead.

## 5. SECURITY DEFINER functions and triggers

- Always pin `set search_path = public` (or the exact needed schema) on any
  `SECURITY DEFINER` function — an unpinned search_path is a privilege
  escalation vector (a caller-controlled schema could shadow a called
  function/table).
- Keep them minimal — a `SECURITY DEFINER` function runs with the owner's
  full privileges regardless of caller, so it should do exactly one
  well-scoped thing (e.g. "insert a notification row") and validate its
  own inputs; don't let it become a general escape hatch around RLS.
- Document *why* it needs to bypass RLS in a comment (the existing
  migrations do this — e.g. "notifications has no INSERT policy for
  authenticated; written exclusively by SECURITY DEFINER triggers").

## 6. Table design

- Every FK column should have an index unless there's a specific reason not
  to — Postgres does not auto-index foreign keys, and missing ones show up
  as slow joins/deletes later.
- Prefer `check` constraints for small fixed enumerations (matches existing
  style — `status text not null check (status in (...))`) over a separate
  lookup table, unless the set is large, user-editable, or referenced by
  multiple tables (then a lookup table like `statuses`/`roles`/`portals` is
  right — confirm current lookup tables in `schema.md` before adding a new
  enum style that duplicates one).
- `on delete cascade` vs `on delete set null` vs `on delete restrict` is a
  real decision, not a default — state which was chosen and why for any new
  FK, especially where cascading could silently destroy audit/log data.
- Add `comment on table` / `comment on column` for anything non-obvious —
  this repo uses them consistently and they're the only inline documentation
  a future migration reader gets (no ORM model docstrings).
- Use `timestamptz`, not `timestamp`, for anything that isn't intentionally
  wall-clock/local.

## 7. Client usage (app code, all three apps)

- No raw SQL outside `backbone/supabase/migrations/` — app code only talks
  to Supabase via `@supabase/supabase-js` / `@supabase/ssr`.
- Server components/actions use the server client; never leak
  `SUPABASE_SERVICE_ROLE_KEY` into client-side code, a client component, or
  any `NEXT_PUBLIC_` variable — grep for accidental exposure before finishing
  any task that touches env handling.
- Prefer letting RLS do the access control — reach for the service-role
  client only for genuinely privileged server-side operations (webhooks,
  cross-tenant admin ops, atomic multi-table writes the anon/authenticated
  role structurally can't do), not as a convenience to skip writing a policy.
- Select only the columns needed (`select('id, name, ...')`), not `select('*')`,
  especially on tables that will grow wide.
- For multi-step writes that must be atomic (e.g. "create vendor_kyc header +
  insert documents"), do it in one RPC call to a `SECURITY DEFINER` function
  rather than sequential client-side calls that can partially fail — the
  `vendor_kyc` submit flow (see `vendor-kyc.md`) is the existing pattern to
  follow.
- Paginate/limit any list query that isn't bounded by construction; don't
  fetch an unbounded table client-side and filter in JS.
- Match `conventions.md` for where Supabase calls live in each app (service
  layer, not scattered inline in components) — don't introduce a new access
  pattern a task doesn't require.

## 8. Types — hand-written, kept in sync

- This repo hand-writes interfaces; it does not run `supabase gen types`.
- Every schema change (new/changed table, column, or nullability) must be
  followed by updating the corresponding hand-written interface in the
  relevant service file — do this in the same task, not as a follow-up.
- Match the existing interface's optionality/nullability exactly against the
  migration (a nullable DB column is an optional TS field, not a `| null`
  that's actually always present, or vice versa) — verify against `schema.md`
  and the actual `create table` statement, not just the interface's own name.

## 9. Storage

- Buckets holding user-supplied documents (KYC, uploads) should be private,
  not public — access goes through signed URLs or server-side proxying, not
  a public bucket URL. `vendor-kyc.md` documents the current bucket model —
  check new bucket work against it.
- Storage has its own RLS-like policy system (`storage.objects` policies) —
  it needs the same scrutiny as table RLS: check it actually restricts by
  the right owner/vendor/user, not just by bucket name.
- Mirror the DB-side authorization logic in the storage policy where
  relevant (e.g. a vendor should only read/write objects under their own
  vendor's path prefix) — don't rely on obscurity of the storage path alone.

## 10. Realtime

- Use only where explicitly needed (per `AGENTS.md`) — it has a cost (open
  connections, replication load) that a polling/refetch pattern usually
  doesn't.
- Anything published over Realtime is filtered by the table's RLS, but
  double-check that a broadcast doesn't include columns a subscriber
  shouldn't see (RLS is row-level, not column-level).

## 11. Before finishing

- Run type checks in every app whose interfaces or Supabase calls changed.
- Re-read the migration once fully written: RLS enabled, grants present and
  matching the policies, indexes on new FKs, comments on non-obvious columns,
  `search_path` pinned on any new `SECURITY DEFINER` function.
- Re-check §1: does anything just changed require an `architecture/*.md`
  update to stay accurate? A schema/RLS change that isn't reflected in the
  docs recreates the drift this skill exists to catch.
- State which parts were verified (type check, local `supabase db` diff/lint
  if run) vs. which need a live environment check (actual RLS behavior under
  a real session, Storage policy behavior) that couldn't be run here.
