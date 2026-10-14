# Staging read-only verification role

A temporary Postgres login on the **staging** project, used so an agent or a teammate can run
verification queries against staging without being handed the `postgres` credentials.

Created 2026-10-14 during the booker staging verification round
(`.plans/2026-09-29-booker-live-verification.md`, L1–L6), where it replaced a long sequence of
copy-paste-the-query-result round trips.

> **Status:** live and in use. Park it between rounds; tear it down when the production work
> starts. Both procedures are below.

---

## What it is

| | |
|---|---|
| Role | `claude_ro` |
| Environment | **staging only** — never create this on production |
| Privileges | `SELECT` on `public` and `storage`, nothing else |
| Attributes | `LOGIN`, `BYPASSRLS`, **not** superuser, cannot create databases or roles |
| Credential | a Postgres password, held in two local files (below) |

⚠️ **`BYPASSRLS` is the point, and it is also the exposure.** Without it the role is subject to
RLS and sees almost nothing, because every policy is written for `anon` / `authenticated` /
`service_role`. With it, the role reads **every customer row** — bookings, emails, phone numbers,
across all vendors. That is what makes a check like L1 meaningful (proving a count crosses the
booker boundary) and it is also why this must not become permanent.

It cannot write. Verified at creation: `UPDATE`, `DELETE` and `CREATE TABLE` are all refused with
`permission denied`.

---

## Where the credential lives

Two files, both `chmod 600`, both outside the repo:

- `~/.pg_service.conf` — a `[rs-staging]` block with host, port, dbname and user
- `~/.pgpass` — one line, `host:port:database:username:password`

⚠️ **`~/.pgpass` is silently ignored unless it is mode `0600`.** No error; it simply does not work.

Nothing about this role belongs in the repo: not the password, not the project ref, not the full
connection string. The files are referenced by path only.

Connect with:

```bash
psql "service=rs-staging" -c "select current_user, current_database();"
```

---

## Parking it between rounds

The cheapest safe state. Leaves the connection working but removes the ability to see across
customer boundaries, so a leaked password while parked is worth very little.

```sql
alter role claude_ro nobypassrls;   -- off: connects, but RLS hides nearly everything
alter role claude_ro bypassrls;     -- on:  re-armed for the next round
```

No file changes either way.

⚠️ **Do not instead delete the two files and leave the role in place.** That is the worst of the
options — the credential keeps full read access to staging on an internet-facing host, while
disappearing from every config you would normally look at. Either keep both so it stays visible, or
remove both.

---

## Teardown

Revoke before dropping; Postgres refuses to drop a role that still holds privileges. This mirrors
the grants exactly, in reverse.

```sql
alter default privileges in schema public revoke select on tables from claude_ro;
revoke all on all tables in schema public  from claude_ro;
revoke all on all tables in schema storage from claude_ro;
revoke all on schema public, storage from claude_ro;
revoke connect on database postgres from claude_ro;

drop role claude_ro;
```

⚠️ **Expect warnings**, and ignore them:

```
WARNING:  no privileges could be revoked for "s3_multipart_uploads"
WARNING:  no privileges could be revoked for "iceberg_tables"
```

Those storage tables belong to `supabase_storage_admin`, so `postgres` never granted them in the
first place.

**Confirm:**

```sql
select coalesce((select 'STILL PRESENT' from pg_roles where rolname = 'claude_ro'), 'removed');
```

**Then the files.** Delete the `[rs-staging]` block from `~/.pg_service.conf` and its line from
`~/.pgpass`, and check:

```bash
psql "service=rs-staging" -c "select 1"      # should fail: definition not found
```

---

## Re-creating it

```sql
create role claude_ro with login password '<a strong one>'
  nosuperuser nocreatedb nocreaterole;

grant connect on database postgres to claude_ro;
grant usage  on schema public, storage to claude_ro;
grant select on all tables in schema public  to claude_ro;
grant select on all tables in schema storage to claude_ro;
alter default privileges in schema public grant select on tables to claude_ro;

alter role claude_ro bypassrls;
```

**Verify it took:**

```sql
select rolname, rolcanlogin, rolsuper, rolbypassrls from pg_roles where rolname = 'claude_ro';
-- expect: claude_ro | t | f | t
```

Then restore the two files. The host and port can be read back from the CLI's own stored value
without exposing the credentials in it:

```bash
grep -oE '@[A-Za-z0-9.-]+:[0-9]+' backbone/supabase/.temp/pooler-url | sed 's/^@//'
```

The username is the role name plus the project ref, in the pooler's `<role>.<project-ref>` form —
the project ref is in `backbone/supabase/.temp/project-ref`.

⚠️ **Port 5432 (session mode), not 6543.** Transaction mode does not support anything spanning
statements, which breaks the `begin … rollback` pattern every safe verification query here uses.

---

## Two things it cannot do, by design

- **Execute `SECURITY DEFINER` RPCs that gate on the caller.** `get_slot_occupancy` raises
  `not permitted` for this role no matter what is granted, because it checks `public.is_active()`,
  which resolves `auth.uid()` — and a raw Postgres login carries no JWT. Verification queries
  should therefore **recompute** such an aggregate directly rather than call the RPC. That is
  better practice anyway: during L1 it meant a broken RPC could not have supplied both sides of the
  comparison.
- **Write anything.** Any check that needs a mutation stays with the user, or runs inside
  `begin … rollback`.

---

## Safety notes

- **Everything queried through this role ends up in the requesting agent's transcript.** During the
  2026-10-14 round that included roughly fifty booker email addresses. Fine for staging test data;
  worth deciding deliberately rather than by default.
- **The pooler host is reachable from the internet.** The role's safety rests on the password, not
  on where it happens to be written down.
- **Staging only.** The same role on production would have the same read access over real
  customers. If production verification is ever needed, that is a separate decision with its own
  approval, not a copy of this file.

## Related

- `database-reset-and-deploy.md` — which migration and seed command is safe in which environment
- `supabase-production-setup.md` — standing up a project from scratch
- `.plans/2026-09-29-booker-live-verification.md` — the round this was created for, and what each
  query was actually used to prove
