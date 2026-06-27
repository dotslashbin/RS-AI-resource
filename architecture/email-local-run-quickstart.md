# Notification email — local run quickstart (verified)

**Purpose:** the exact, working steps to run the notification-email pipeline locally
(verified 2026-06-26). This is the "what I actually did" reference. For the fuller
local+remote runbook see `architecture/email-setup-local-and-remote.md`; for what
each secret is, `architecture/email-secrets-setup.md`.

> No secret values are recorded here — only **where to get each one**.

---

## 1. Start the stack + apply the schema
```bash
cd backbone
supabase start          # if not already running (Docker)
supabase db reset       # applies migrations + seed; seed disables the email trigger so no sends here
```

## 2. Fill the function's `.env`
File: `backbone/supabase/functions/send-notification-email/.env` (gitignored).

| Variable | Where to get the value |
|----------|------------------------|
| `RESEND_API_KEY` | Resend dashboard → **API Keys** |
| `NOTIFICATION_EMAIL_FROM` | `Ezzy <no-reply@<your-verified-domain>>` — the domain you verified in Resend. (Before any domain is verified, use `Ezzy <onboarding@resend.dev>`, which only delivers to your own Resend-account email.) |
| `NOTIFICATION_EMAIL_SECRET` | Invent one: `openssl rand -hex 32`. Must match the Vault `notification_email_secret` in step 5. |
| `NOTIFICATION_EMAIL_OVERRIDE_TO` | An inbox you control — all local emails go here instead of real users. |

> Do **not** set `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — the CLI injects them.

## 3. Serve the function (keep this terminal open)
```bash
cd backbone
supabase functions serve send-notification-email \
  --env-file supabase/functions/send-notification-email/.env \
  --no-verify-jwt
```

## 4. Smoke test — the function alone (from the host shell)
```bash
curl -i -X POST http://127.0.0.1:54321/functions/v1/send-notification-email \
  -H "x-webhook-secret: <your NOTIFICATION_EMAIL_SECRET from .env>" \
  -H "Content-Type: application/json" \
  -d '{"notification_id":"40000000-0000-0000-0000-000000000004"}'   # a seeded notification id
```
Expect `200 {"ok":true,"outcome":"sent"}`, an email in the override inbox, and a row in
`notification_emails`. Same id again → `{"outcome":"idempotent"}` (no second send).

## 5. Set the Vault secrets (for the full trigger → email chain)
Run in Studio SQL editor (`http://127.0.0.1:54323`) or psql:
```sql
-- The base URL must be the Docker host, NOT 127.0.0.1 — the trigger calls out from
-- inside the Postgres container. This value is the same on every local machine.
select vault.create_secret('http://host.docker.internal:54321', 'edge_function_base_url', 'local');

-- Use the SAME string as NOTIFICATION_EMAIL_SECRET in the .env (step 2).
select vault.create_secret('<your NOTIFICATION_EMAIL_SECRET>', 'notification_email_secret', 'local');
```
Verify they exist:
```sql
select name from vault.secrets where name in ('edge_function_base_url','notification_email_secret');
```

## 6. Fire a real event + watch
A genuine INSERT fires the trigger (unlike seed). Example using a seeded vendor-admin (Marco):
```sql
insert into public.notifications (user_id, portal, type, title, body)
values ('00000000-0000-0000-0000-000000000002', 'vendor', 'new_booking',
        'Local chain test', 'Testing trigger → function → email.');
```
(Or just create a booking in the booker app — same path.)

Check delivery:
```sql
-- function's own delivery log
select recipient_email, status, error, attempted_at
from notification_emails order by attempted_at desc limit 5;

-- the trigger's outbound HTTP call (pg_net) — best debug tool
select id, status_code, content, error_msg, created
from net._http_response order by created desc limit 5;
```
`status_code = 200` + email in the override inbox = full chain working.

---

## Gotchas (the ones that bite)
- **`supabase db reset` wipes the Vault secrets** (they live in the DB). Re-run step 5 after every reset.
  Tip: keep step 5 in a gitignored `backbone/supabase/_local-vault.sql` and `psql … -f` it.
- **URL is `host.docker.internal:54321`, not `127.0.0.1`** for the Vault `edge_function_base_url`
  (the trigger runs inside the DB container). The step-4 `curl` is from the host, so it *does* use `127.0.0.1`.
- **The function must be serving** (step 3 terminal open) for local emails to send.
- **`NOTIFICATION_EMAIL_SECRET` (.env) must equal `notification_email_secret` (Vault)** or the function returns 401.
- **Override inbox** stays set locally so real users are never emailed.
- **Changing domain later:** verify the new domain in Resend, then update only `NOTIFICATION_EMAIL_FROM`
  (.env locally / `supabase secrets set` remotely). No code/migration/Vault change — see
  `architecture/email-sending-domain.md`.
