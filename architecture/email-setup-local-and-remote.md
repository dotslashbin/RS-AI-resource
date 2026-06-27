# Notification email — local & remote setup (runbook)

**Purpose:** step-by-step to get notification emails actually sending — both for **local development (Docker)** and the **remote/hosted** project. Work the lists top to bottom; each ends with a test.

Related: `architecture/email-secrets-setup.md` (what each secret is), `architecture/email-sending-domain.md` (the From domain), `.plans/2026-06-23-email-notifications-resend.md` (the design).

---

## The 5 conditions (recap)
An email only goes out when ALL of these hold (local or remote):
1. The function is **running** (`functions serve` local / `functions deploy` remote).
2. The function has **its own secrets** (`RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM`, `NOTIFICATION_EMAIL_SECRET`).
3. The **Vault secrets** exist so the trigger calls it (`edge_function_base_url`, `notification_email_secret`).
4. The **DB can reach** the function URL (the local Docker catch — see Part A).
5. The **From domain is Verified** in Resend (or use `NOTIFICATION_EMAIL_OVERRIDE_TO` / `onboarding@resend.dev` for testing).

**Two secret stores, don't mix them:** function secrets = Edge Function env (`supabase secrets set` / local `.env`); the two `*_url` / `*_secret` the trigger reads = **Supabase Vault (in the DB)**.

---

## Part A — Local setup (Supabase running in Docker)

> Local runs the whole stack in Docker. The important consequence: the dispatch
> trigger calls the function via `pg_net` **from inside the Postgres container**, so
> the URL it uses is **not** `127.0.0.1` (that's the container itself). Use the Docker
> host instead — `http://host.docker.internal:54321`.

### A1. Apply the schema locally
```bash
cd backbone
supabase start          # if not already up
supabase db reset       # applies migrations + seed (seed disables the email trigger, so no sends here)
```

### A2. Create the function's local secrets file
```bash
cd backbone/supabase/functions/send-notification-email
cp .env.example .env     # .env is gitignored
```
Edit `.env` and set: `RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM`, `NOTIFICATION_EMAIL_SECRET`
(any long random string — remember it for A5), and **`NOTIFICATION_EMAIL_OVERRIDE_TO=you@inbox`**
(so local never mails real users). Do **not** set `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — the CLI injects them.

### A3. Serve the function (keep this terminal open)
```bash
cd backbone
supabase functions serve send-notification-email \
  --env-file supabase/functions/send-notification-email/.env \
  --no-verify-jwt
```

### A4. Level-1 test — the function in isolation (no trigger, no Vault)
From your host shell (here `127.0.0.1` is correct — it's the host port):
```bash
curl -i -X POST http://127.0.0.1:54321/functions/v1/send-notification-email \
  -H "x-webhook-secret: <NOTIFICATION_EMAIL_SECRET from .env>" \
  -H "Content-Type: application/json" \
  -d '{"notification_id":"40000000-0000-0000-0000-000000000004"}'   # a seeded notification id
```
Expect: HTTP 200 `{"ok":true,"outcome":"sent"}`, an email in your override inbox, and a row in
`public.notification_emails`. POST the same id again → `{"outcome":"idempotent"}`, no second email.

### A5. Level-2 — the full chain (booking → email), local
Set the two **Vault** secrets in the local DB. `edge_function_base_url` uses the Docker host:
```sql
-- run in: supabase SQL editor (Studio at http://127.0.0.1:54323) or psql
select vault.create_secret('http://host.docker.internal:54321', 'edge_function_base_url', 'local');
select vault.create_secret('<SAME string as NOTIFICATION_EMAIL_SECRET>', 'notification_email_secret', 'local');
```
Now trigger a real event — create a booking in the booker app (or insert a notification manually
**outside** seed):
```sql
insert into public.notifications (user_id, portal, type, title, body)
values ('00000000-0000-0000-0000-000000000002','vendor','new_booking','Test','Local chain test.');
```
Expect: an email + a `notification_emails` row. Debug the trigger's HTTP call with pg_net's log:
```sql
select id, status_code, content, error_msg, created
from net._http_response order by created desc limit 5;
```

> ⚠️ **`supabase db reset` wipes the local Vault secrets** (they live in the DB, and are not in
> migrations/seed by design — committing secrets is not allowed). **Re-run the two `vault.create_secret`
> calls after every reset.** Tip: keep them in a gitignored `backbone/supabase/_local-vault.sql` and
> `psql ... -f` it after each reset.

### A6. Local troubleshooting
- **No `net._http_response` row / connection refused:** the Postgres container can't resolve
  `host.docker.internal`. On Docker Desktop (incl. WSL2 backend) it resolves automatically; on native
  Docker you may need the stack to map `host-gateway`. Test from the db container:
  `select net.http_get('http://host.docker.internal:54321/functions/v1/send-notification-email');`
  then check `net._http_response`. If unreachable, confirm Docker Desktop is the WSL2 backend, or ask
  for the host-gateway workaround.
- **401 from the function:** the `x-webhook-secret` (Vault `notification_email_secret`) doesn't match
  the function's `NOTIFICATION_EMAIL_SECRET`.
- **`outcome: skipped:disabled`:** that portal's email is off in `notification_email_settings`.
- **`outcome: skipped:no_recipient`:** the target user has no email on `profiles`/`auth.users`.

---

## Part B — Remote / hosted setup (project `yohbcehqstkhecdbxilm`)

> Confirm `yohbcehqstkhecdbxilm` is the project you intend before running these — they act on it.

### B1. Push the schema to hosted
```bash
cd backbone
supabase db push        # applies the 3 new migrations (tables + trigger + pg_net/vault extensions)
```
Safe: the trigger **no-ops until the Vault secrets are set** (B4), so this alone sends nothing.

### B2. Set the function secrets (hosted)
```bash
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  NOTIFICATION_EMAIL_FROM="Ezzy <no-reply@info.ezzy.com>" \
  NOTIFICATION_EMAIL_SECRET="<random — remember for B4>"
# until you're confident, keep prod pointed at a test inbox too:
supabase secrets set NOTIFICATION_EMAIL_OVERRIDE_TO="you@inbox"
supabase secrets list   # verify
```

### B3. Deploy the function
```bash
supabase functions deploy send-notification-email --no-verify-jwt
```

### B4. Set the Vault secrets (hosted)
SQL Editor on the hosted project:
```sql
select vault.create_secret('https://yohbcehqstkhecdbxilm.supabase.co', 'edge_function_base_url', 'prod');
select vault.create_secret('<SAME string as NOTIFICATION_EMAIL_SECRET in B2>', 'notification_email_secret', 'prod');
```
(No `host.docker.internal` here — the real project URL is reachable over HTTPS.)

### B5. Verify the domain & test
- Ensure `info.ezzy.com` is **Verified** in Resend (see `email-sending-domain.md`); until then keep
  `NOTIFICATION_EMAIL_OVERRIDE_TO` set to an address you can receive at.
- Create a booking against the hosted-backed app → expect an email + a `notification_emails` row.
- Inspect function logs: `supabase functions logs send-notification-email` (or the dashboard), and the
  trigger's HTTP call via `net._http_response` (SQL editor).
- When happy, **unset the prod override** so real recipients get mail:
  `supabase secrets unset NOTIFICATION_EMAIL_OVERRIDE_TO`.

---

## Local vs remote — quick reference

| | Local (Docker) | Remote (hosted) |
|---|---|---|
| Run the function | `supabase functions serve … --no-verify-jwt` (terminal open) | `supabase functions deploy … --no-verify-jwt` (one-time) |
| Function secrets | `.env` via `--env-file` | `supabase secrets set …` |
| Apply schema | `supabase db reset` | `supabase db push` |
| `edge_function_base_url` (Vault) | `http://host.docker.internal:54321` | `https://yohbcehqstkhecdbxilm.supabase.co` |
| `SUPABASE_URL` / service key | auto-injected (don't set) | auto-injected (don't set) |
| Vault persistence | **wiped by `db reset`** — re-add each time | persists |
| Email recipients | always override inbox | override until verified, then real |

## Golden rules
- `notification_email_secret` (Vault) **===** `NOTIFICATION_EMAIL_SECRET` (function). Identical strings, both stores.
- Never set `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` yourself — they're auto-injected.
- Re-add local Vault secrets after every `db reset`.
- Keep an override inbox set anywhere you don't want real users emailed.
